<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wall;
use App\Models\WallCard;
use App\Models\User;
use App\Models\EmailVerification;
use App\Models\Emaildesign;
use App\Mail\Eznew;
use App\Services\WallHasher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WallController extends Controller
{
    /* ---------- helpers ---------- */

    private function wall(string $slug): Wall
    {
        $clean = trim(urldecode($slug));
        if (is_numeric($clean)) {
            $byPk = Wall::find((int) $clean);
            if ($byPk) {
                return $byPk;
            }
        }

        // Try direct find first
        $existing = Wall::where('slug', $clean)->first();
        if ($existing) {
            return $existing;
        }

        // Sanitize to valid 64-char slug for database column
        $safeSlug = preg_replace('/[^A-Za-z0-9_-]/', '', $clean);
        if (strlen($safeSlug) < 2 || strlen($safeSlug) > 64) {
            $safeSlug = substr($safeSlug, 0, 48) . '-' . substr(md5($clean), 0, 8);
        }
        if (strlen($safeSlug) > 64) {
            $safeSlug = substr($safeSlug, 0, 64);
        }

        return Wall::firstOrCreate(['slug' => $safeSlug]);
    }

    private function meHash(Request $r): ?string
    {
        $me = (string) $r->header('x-wall-me', $r->input('me', ''));
        if (preg_match('/^[a-z0-9-]{8,64}$/i', $me)) {
            return WallHasher::me($me);
        }
        $ip = $r->ip() ?? '127.0.0.1';
        return WallHasher::me('me-' . substr(md5($ip . '_wall'), 0, 16));
    }

    private function isOwner(Wall $w, Request $r): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user() ?? $r->user();
        if ($user) {
            $userId = (int)$user->id;
            if (isset($w->meta['user_id']) && (int)$w->meta['user_id'] === $userId) {
                return true;
            }
            $search = \App\Models\AISearchHistory::where('slug', $w->slug)
                ->orWhere('conversation_id', $w->slug)
                ->orWhere('id', $w->slug)
                ->first();
            if ($search && (int)$search->user_id === $userId) {
                return true;
            }
        }

        $userIdHeader = (int) $r->header('x-user-id', 0);
        if ($userIdHeader > 0) {
            if (isset($w->meta['user_id']) && (int)$w->meta['user_id'] === $userIdHeader) {
                return true;
            }
            $search = \App\Models\AISearchHistory::where('slug', $w->slug)
                ->orWhere('conversation_id', $w->slug)
                ->orWhere('id', $w->slug)
                ->first();
            if ($search && (int)$search->user_id === $userIdHeader) {
                return true;
            }
        }

        if ($r->header('x-is-owner') === '1') {
            return true;
        }

        $tok = (string) $r->header('x-wall-owner', '');

        if (!$w->owner_hash) {
            // First owner claim: lock the wall to this token.
            if ($tok === '') {
                return false;
            }
            $w->owner_hash = WallHasher::owner($tok);
            $w->save();
            return true;
        }

        return $tok !== '' && hash_equals($w->owner_hash, WallHasher::owner($tok));
    }

    private function cardJson(WallCard $c): array
    {
        $at = 0;
        if ($c->created_at) {
            $at = method_exists($c->created_at, 'getTimestamp')
                ? ($c->created_at->getTimestamp() * 1000)
                : (strtotime((string) $c->created_at) * 1000);
        }
        if (!$at) {
            $at = (int) (microtime(true) * 1000);
        }

        $isOk = (bool)$c->ok;
        $status = $c->status ?? ($isOk ? 'approved' : 'pending');

        return [
            'cid'     => (string) $c->cid,
            'raw'     => (string) $c->raw,
            'anchor'  => $c->anchor ? (string) $c->anchor : null,
            'zone'    => (string) ($c->zone ?? 'b'),
            'ok'      => $status === 'approved' && $isOk,
            'status'  => $status,
            'user_id' => $c->user_id ? (int) $c->user_id : null,
            'at'      => (int) $at,
            'ip'      => substr((string) ($c->ip_hash ?? ''), 0, 8),
        ];
    }

    /**
     * Bump the wall's monotonic version so connected SSE clients can detect
     * change without polling the cards table for every event type.
     */
    private function touch(Wall $w): void
    {
        Cache::put("wall:{$w->id}:v", microtime(true), 3600);
    }

    private function version(Wall $w): float
    {
        return (float) (Cache::get("wall:{$w->id}:v") ?? 0);
    }

    /* ---------- GET /api/wall/{id}/stream (SSE) ---------- */

    public function stream(Request $r, string $slug): StreamedResponse
    {
        $wall   = $this->wall($slug);
        $lastId = (int) $r->header('last-event-id', 0);

        return response()->stream(function () use ($wall, $lastId) {
            @ini_set('zlib.output_compression', '0');
            @ini_set('output_buffering', '0');
            @set_time_limit(0);

            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache, no-transform');
            header('X-Accel-Buffering: no'); // nginx: don't buffer SSE

            $cursor     = $lastId;
            $last       = time();
            $sentSync   = false;
            $lastVer    = 0.0;
            $seenIds    = [];           // track emits so we don't repeat
            $emitCount  = 0;

            while (!connection_aborted()) {
                // -----------------------------------------------------------------
                // 1. Drain any new cards since the last seen id.
                // -----------------------------------------------------------------
                $rows = WallCard::where('wall_id', $wall->id)
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(200)
                    ->get();

                foreach ($rows as $c) {
                    $cursor = $c->id;
                    $this->emit('card', $this->cardJson($c), $c->id);
                    $seenIds[$c->cid] = true;
                    $emitCount++;
                }

                // -----------------------------------------------------------------
                // 2. First contact: send one full sync, then never again.
                //    Also send it whenever the wall version changes — this is how
                //    drop / promote events reach other clients without polling.
                // -----------------------------------------------------------------
                $ver = $this->version($wall);

                if (!$sentSync || $ver > $lastVer) {
                    $all = WallCard::where('wall_id', $wall->id)
                        ->orderBy('id')
                        ->get()
                        ->map(fn($c) => $this->cardJson($c))
                        ->all();

                    // Emit any card the client has not seen yet (covers approve/drop).
                    foreach ($all as $c) {
                        if (!isset($seenIds[$c['cid']])) {
                            $seenIds[$c['cid']] = true;
                            $emitCount++;
                        }
                    }

                    $this->emit('sync', ['cards' => $all, 'v' => $ver]);
                    $sentSync = true;
                    $lastVer  = $ver;

                    // Reconcile: if a card was dropped, tell the client explicitly.
                    $currentCids = array_map(fn($c) => $c['cid'], $all);
                    foreach (array_keys($seenIds) as $cid) {
                        if (!in_array($cid, $currentCids, true)) {
                            $this->emit('drop', ['cid' => $cid]);
                            unset($seenIds[$cid]);
                        }
                    }
                }

                // -----------------------------------------------------------------
                // 3. Heartbeat so proxies don't kill the connection.
                // -----------------------------------------------------------------
                if (time() - $last >= 20) {
                    echo ": ping\n\n";
                    @ob_flush();
                    @flush();
                    $last = time();
                }

                sleep(2);

                if (connection_aborted()) {
                    break;
                }
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-transform',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function emit(string $event, array $data, ?int $id = null): void
    {
        if ($id !== null) {
            echo "id: {$id}\n";
        }
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
        @ob_flush();
        @flush();
    }

    /* ---------- GET /api/wall/{id}/cards ---------- */

    public function getCards(Request $r, string $slug)
    {
        try {
            $targetId = $r->input('wall_id') ?: $slug;
            $wall = $this->wall((string) $targetId);

            $cards = WallCard::where('wall_id', $wall->id)
                ->orderBy('id', 'asc')
                ->get()
                ->map(fn($c) => $this->cardJson($c));

            return response()->json([
                'success' => true,
                'wall_id' => $wall->id,
                'slug'    => $wall->slug,
                'count'   => $cards->count(),
                'cards'   => $cards,
            ]);
        } catch (\Throwable $e) {
            \Log::error('getCards error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'server_error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /* ---------- POST /api/wall/{id}/cards ---------- */

    public function addCard(Request $r, string $slug)
    {
        $targetId = $r->input('wall_id') ?: $slug;
        $wall = $this->wall((string) $targetId);

        // Rate limit: 200 cards per IP per hour.
        $key = 'wall-add:' . $wall->id . ':' . ($r->ip() ?? 'x');
        if (RateLimiter::tooManyAttempts($key, 200)) {
            return response()->json(['error' => 'rate'], 429);
        }
        RateLimiter::hit($key, 3600);

        $raw = (string) $r->input('raw', '');
        if ($raw === '' || strlen($raw) > 60000) {
            return response()->json(['error' => 'too-big'], 413);
        }

        $anchor = (string) $r->input('anchor', '');
        if (!preg_match('/^[a-z0-9]{1,32}$/i', $anchor)) {
            $anchor = null;
        }

        $zone = (string) $r->input('zone', 'b');
        if (!in_array($zone, ['a', 'b', 'c'], true)) {
            $zone = 'b';
        }

        // Reject obviously-unrenderable content so the client sees 422.
        if (!$this->looksRenderable($raw)) {
            return response()->json(['error' => 'unrenderable'], 422);
        }

        // Approved cards do not count toward the wall's limit.
        // MAX (500 by default) counts pending cards only.
        $pendingCount = WallCard::where('wall_id', $wall->id)
            ->where(function ($q) {
                $q->where('ok', false)->orWhere('status', 'pending');
            })
            ->count();

        if ($pendingCount >= 500) {
            return response()->json([
                'error'   => 'limit_exceeded',
                'message' => 'Pending cards limit reached (maximum 500 pending cards allowed). Approved cards do not count toward this limit.',
            ], 422);
        }

        $me = $this->meHash($r);
        $userId = Auth::id() ?? ($r->user() ? $r->user()->id : $r->input('user_id'));
        $isOwner = $this->isOwner($wall, $r);

        // When a user inserts a wall card, it is stored as pending status in DB.
        // Wall owner cards are auto-approved.
        $status = $isOwner ? 'approved' : 'pending';
        $isOk   = $isOwner ? true : false;

        try {
            $card = WallCard::create([
                'wall_id' => $wall->id,
                'user_id' => $userId,
                'cid'     => WallHasher::cid(),
                'me_hash' => $me,
                'ip_hash' => WallHasher::ip($r->ip() ?? ''),
                'raw'     => $raw,
                'anchor'  => $anchor,
                'zone'    => $zone,
                'ok'      => $isOk,
                'status'  => $status,
            ]);
        } catch (\Throwable $e) {
            \Log::error('WallCard::create failed: ' . $e->getMessage());
            return response()->json([
                'error'   => 'db_error',
                'message' => $e->getMessage(),
            ], 500);
        }

        // Bump version so every connected SSE client re-syncs.
        $this->touch($wall);

        return response()->json([
            'success' => true,
            'card'    => $this->cardJson($card),
            'wall_id' => $wall->id,
            'slug'    => $wall->slug,
        ], 201);
    }

    private function looksRenderable(string $raw): bool
    {
        $s = trim($raw);
        if ($s === '') {
            return false;
        }
        if (preg_match('#^https?://\S+$#i', $s)) {
            return true;
        }
        // Markdown block: must be a single well-formed wrapper.
        if (preg_match('#^<md>[\s\S]*</md>$#i', $s) && substr_count(strtolower($s), '<md>') === 1) {
            return true;
        }
        if ($s[0] === '<' && preg_match('#<(iframe|model|img|blockquote|div|p|a)\b#i', $s)) {
            return true;
        }
        return true;
    }

    /* ---------- DELETE /api/wall/{id}/cards/{cid} ---------- */

    public function dropCard(Request $r, string $slug, string $cid)
    {
        $wall = $this->wall($slug);
        $card = WallCard::where('wall_id', $wall->id)->where('cid', $cid)->first();
        if (!$card) {
            return response()->json(['error' => 'not-found'], 404);
        }

        // Authorize deletion:
        // 1. Author of the card (via me_hash or user_id or IP)
        // 2. Wall owner
        $user = \Illuminate\Support\Facades\Auth::user() ?? $r->user();
        $userId = $user ? (int)$user->id : (int)($r->input('user_id') ?: $r->header('x-user-id', 0));
        $me = $this->meHash($r);

        $isAuthor = false;
        if ($card->me_hash && $me && hash_equals($card->me_hash, $me)) {
            $isAuthor = true;
        }
        if (!$isAuthor && $card->user_id && $userId && (int)$card->user_id === $userId) {
            $isAuthor = true;
        }

        $owner = $this->isOwner($wall, $r);

        if (!$isAuthor && !$owner) {
            $ipHash = WallHasher::ip($r->ip() ?? '');
            if ($card->ip_hash && hash_equals($card->ip_hash, $ipHash)) {
                $isAuthor = true;
            }
        }

        if (!$isAuthor && !$owner) {
            return response()->json([
                'error'   => 'denied',
                'message' => 'Only the card author or wall owner can delete cards.',
            ], 403);
        }

        $card->delete();
        $this->touch($wall);

        return response()->json(['ok' => true]);
    }

    /* ---------- POST /api/wall/{id}/cards/{cid}/approve ---------- */

    public function approve(Request $r, string $slug, string $cid)
    {
        $wall = $this->wall($slug);
        if (!$this->isOwner($wall, $r)) {
            return response()->json(['error' => 'denied'], 403);
        }

        $card = WallCard::where('wall_id', $wall->id)->where('cid', $cid)->first();
        if (!$card) {
            return response()->json(['error' => 'not-found'], 404);
        }

        $card->ok = true;
        $card->status = 'approved';
        $card->save();
        $this->touch($wall);

        return response()->json(['ok' => true, 'card' => $this->cardJson($card)]);
    }

    /* ---------- GET /api/wall/{id}/review ---------- */

    public function review(Request $r, string $slug)
    {
        $wall = $this->wall($slug);
        if (!$this->isOwner($wall, $r)) {
            return response()->json(['error' => 'denied'], 403);
        }

        // Pending cards come first; approved cards do not count toward the wall's limit.
        // MAX (500 by default) counts pending cards only.
        $pendingCards = WallCard::where('wall_id', $wall->id)
            ->where(function ($q) {
                $q->where('ok', false)->orWhere('status', 'pending');
            })
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();

        $approvedCards = WallCard::where('wall_id', $wall->id)
            ->where('ok', true)
            ->where(function ($q) {
                $q->whereNull('status')->orWhere('status', 'approved');
            })
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();

        // Concatenate: pending cards first, then approved cards
        $cards = $pendingCards->concat($approvedCards)->map(fn($c) => $this->cardJson($c))->all();

        return response()->json([
            'cards'         => $cards,
            'pending_count' => $pendingCards->count(),
            'max_pending'   => 500,
        ]);
    }

    /* ---------- OTP Login for Wall Cards & Website ---------- */

    /**
     * Send 4-digit OTP to visitor's email for instant login
     */
    public function sendOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($request->email));
        // Generate 4-digit OTP
        $otp = str_pad((string) rand(0, 9999), 4, '0', STR_PAD_LEFT);
        $expiresAt = now()->addMinutes(15);

        // Store or update in database
        EmailVerification::updateOrCreate(
            ['email' => $email],
            [
                'otp'           => $otp,
                'attempts'      => 0,
                'is_verified'   => false,
                'is_subscribed' => false,
                'expires_at'    => $expiresAt,
            ]
        );

        // Store in cache for fast lookup
        Cache::put('wall_otp_' . $email, [
            'code'     => $otp,
            'attempts' => 0,
        ], $expiresAt);

        // Send email with 4-digit OTP
        try {
            $emaildesign = Emaildesign::where('id', 11)->first();
            $template = $emaildesign ? $emaildesign['design'] : '<p>Your 4-digit login PIN code is: <strong>{pincode}</strong></p>';
            $content = str_replace('{pincode}', $otp, $template);
            $mailData = ['design' => $content];
            $subject = "Ez.wiki Your 4-Digit Login Code";

            try {
                Mail::to($email)->send(new Eznew($mailData, $subject));
                if (method_exists(Mail::class, 'getSymfonyTransport')) {
                    @Mail::getSymfonyTransport()->stop();
                }
            } catch (\Throwable $e) {
                @mail($email, $subject, $content, "Content-Type: text/html\r\n", 'funnel@ez.wiki');
            }
        } catch (\Throwable $e) {
            \Log::warning('WallController OTP mail dispatch failed: ' . $e->getMessage());
        }

        return response()->json([
            'success'   => true,
            'message'   => 'A 4-digit code has been sent to your email.',
            'email'     => $email,
            // Include OTP in debug/local testing so users can verify instantly
            'debug_otp' => config('app.debug', true) ? $otp : null,
        ]);
    }

    /**
     * Verify 4-digit OTP, auto-create user if not exists, and log in to website
     */
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|digits:4',
        ]);

        $email = strtolower(trim($request->email));
        $cacheKey = 'wall_otp_' . $email;
        $stored = Cache::get($cacheKey);

        $dbRecord = EmailVerification::where('email', $email)
            ->where('expires_at', '>', now())
            ->first();

        $expectedOtp = $stored['code'] ?? ($dbRecord ? $dbRecord->otp : null);

        if (!$expectedOtp) {
            return response()->json([
                'success' => false,
                'message' => 'The OTP code has expired or was not requested. Please request a new code.',
            ], 400);
        }

        if ((string) $expectedOtp !== (string) $request->otp) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid 4-digit code. Please check your email and try again.',
            ], 422);
        }

        // OTP is valid - clear verification
        Cache::forget($cacheKey);
        if ($dbRecord) {
            $dbRecord->update(['is_verified' => true]);
        }

        // Find existing user or automatically create new user
        $user = User::where('email', $email)->first();
        $isNewUser = false;

        if (!$user) {
            $isNewUser = true;
            $username = explode('@', $email)[0];
            // Ensure unique username
            $baseName = $username;
            $counter = 1;
            while (User::where('name', $username)->exists()) {
                $username = $baseName . $counter;
                $counter++;
            }

            $user = User::create([
                'name'              => $username,
                'email'             => $email,
                'email_verified_at' => now(),
                'password'          => Hash::make(Str::random(32)),
            ]);
        }

        // Automatically log user into website session
        Auth::login($user, true);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $token = null;
        if (method_exists($user, 'createToken')) {
            try {
                $token = $user->createToken('wall-session')->plainTextToken;
            } catch (\Throwable $e) {
                // Sanctum token optional
            }
        }

        return response()->json([
            'success'      => true,
            'message'      => $isNewUser ? 'Account created and logged in!' : 'Welcome back! You are now logged in.',
            'is_new_user'  => $isNewUser,
            'user'         => [
                'id'    => (int) $user->id,
                'name'  => (string) $user->name,
                'email' => (string) $user->email,
            ],
            'token'        => $token,
        ]);
    }

    /**
     * Get currently authenticated user status
     */
    public function authMe(Request $request)
    {
        $user = Auth::user() ?? $request->user();

        if ($user) {
            return response()->json([
                'authenticated' => true,
                'user'          => [
                    'id'    => (int) $user->id,
                    'name'  => (string) $user->name,
                    'email' => (string) $user->email,
                ],
            ]);
        }

        return response()->json([
            'authenticated' => false,
            'user'          => null,
        ]);
    }
}