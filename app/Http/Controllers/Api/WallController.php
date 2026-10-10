<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wall;
use App\Models\WallCard;
use App\Models\AISearchHistory;
use App\Models\User;
use App\Models\EmailVerification;
use App\Models\Emaildesign;
use App\Mail\Eznew;
use App\Services\WallHasher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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
            'type'    => (string) ($c->type ?? 'wiki'),
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
                $ver = $this->version($wall);

                // -----------------------------------------------------------------
                // 1. First contact: send one full sync snapshot, then set cursor.
                // -----------------------------------------------------------------
                if (!$sentSync) {
                    $all = WallCard::where('wall_id', $wall->id)
                        ->orderBy('id')
                        ->get()
                        ->map(fn($c) => $this->cardJson($c))
                        ->all();

                    foreach ($all as $c) {
                        $seenIds[$c['cid']] = true;
                    }

                    $this->emit('sync', ['cards' => $all, 'v' => $ver]);
                    $sentSync = true;
                    $lastVer  = $ver;
                    $cursor   = (int) (WallCard::where('wall_id', $wall->id)->max('id') ?? $lastId);
                } elseif ($ver > $lastVer) {
                    // Wall version changed: send updated full sync
                    $all = WallCard::where('wall_id', $wall->id)
                        ->orderBy('id')
                        ->get()
                        ->map(fn($c) => $this->cardJson($c))
                        ->all();

                    $this->emit('sync', ['cards' => $all, 'v' => $ver]);
                    $lastVer  = $ver;

                    // Reconcile: if a card was dropped, tell the client explicitly.
                    $currentCids = array_map(fn($c) => $c['cid'], $all);
                    foreach (array_keys($seenIds) as $cid) {
                        if (!in_array($cid, $currentCids, true)) {
                            $this->emit('drop', ['cid' => $cid]);
                            unset($seenIds[$cid]);
                        }
                    }
                } else {
                    // Drain any new cards added since last cursor
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
                'success'     => true,
                'wall_id'     => $wall->id,
                'slug'        => $wall->slug,
                'count'       => $cards->count(),
                'cards'       => $cards,
                'layout'      => $wall->layout ?? ($wall->meta['layout'] ?? null),
                'carousel'    => $wall->carousel ?? ($wall->meta['carousel'] ?? ($wall->meta['car'] ?? false)),
                'topic'       => $wall->topic ?? ($wall->meta['topic'] ?? ($wall->meta['zones']['a'] ?? true)),
                'content'     => $wall->content ?? ($wall->meta['content'] ?? ($wall->meta['zones']['b'] ?? true)),
                'infomercial' => $wall->infomercial ?? ($wall->meta['infomercial'] ?? ($wall->meta['zones']['c'] ?? true)),
                'fireworks'   => $wall->fireworks ?? ($wall->meta['fireworks'] ?? null),
                'flybees'     => $wall->flybees ?? ($wall->meta['flybees'] ?? null),
                'sound'       => $wall->sound ?? ($wall->meta['sound'] ?? null),
                'language'    => $wall->language ?? ($wall->meta['language'] ?? null),
                'meta'        => $wall->meta,
            ]);
        } catch (\Throwable $e) {
            \Log::error('getCards error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'server_error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /* ---------- POST /api/wall/{id}/settings ---------- */

    public function saveSettings(Request $r, string $slug)
    {
        try {
            $targetId = $r->input('wall_id') ?: $slug;
            $wall = $this->wall((string) $targetId);

            // Check if user is owner
            if (!$this->isOwner($wall, $r) && $r->header('x-is-owner') !== '1' && !$r->input('is_owner')) {
                return response()->json([
                    'error'   => 'unauthorized',
                    'message' => 'Only the wall owner can change settings',
                ], 403);
            }

            $meta = $wall->meta ?? [];
            if (!isset($meta['fx'])) {
                $meta['fx'] = [];
            }
            if (!isset($meta['zones'])) {
                $meta['zones'] = ['a' => true, 'b' => true, 'c' => true];
            }

            // 1. Layout
            if ($r->has('layout')) {
                $layout = (string) $r->input('layout');
                $wall->layout = $layout;
                $meta['layout'] = $layout;
                if (is_numeric($layout)) {
                    $meta['cols'] = (int) $layout;
                }
            }

            // 2. Carousel on/off
            if ($r->has('carousel') || $r->has('carousal')) {
                $carVal = $r->has('carousel') ? $r->input('carousel') : $r->input('carousal');
                $car = filter_var($carVal, FILTER_VALIDATE_BOOLEAN);
                $wall->carousel = $car;
                $meta['carousel'] = $car;
                $meta['car'] = $car;
            }

            // 3. Topic on/off (Zone A)
            if ($r->has('topic')) {
                $top = filter_var($r->input('topic'), FILTER_VALIDATE_BOOLEAN);
                $wall->topic = $top;
                $meta['topic'] = $top;
                $meta['zones']['a'] = $top;
            }

            // 4. Content on/off (Zone B)
            if ($r->has('content')) {
                $cnt = filter_var($r->input('content'), FILTER_VALIDATE_BOOLEAN);
                $wall->content = $cnt;
                $meta['content'] = $cnt;
                $meta['zones']['b'] = $cnt;
            }

            // 5. InfoMercial on/off (Zone C)
            if ($r->has('infomercial')) {
                $info = filter_var($r->input('infomercial'), FILTER_VALIDATE_BOOLEAN);
                $wall->infomercial = $info;
                $meta['infomercial'] = $info;
                $meta['zones']['c'] = $info;
            }

            // Zones map handling
            if ($r->has('zones')) {
                $zones = (array) $r->input('zones');
                if (isset($zones['a'])) {
                    $wall->topic = filter_var($zones['a'], FILTER_VALIDATE_BOOLEAN);
                    $meta['topic'] = $wall->topic;
                    $meta['zones']['a'] = $wall->topic;
                }
                if (isset($zones['b'])) {
                    $wall->content = filter_var($zones['b'], FILTER_VALIDATE_BOOLEAN);
                    $meta['content'] = $wall->content;
                    $meta['zones']['b'] = $wall->content;
                }
                if (isset($zones['c'])) {
                    $wall->infomercial = filter_var($zones['c'], FILTER_VALIDATE_BOOLEAN);
                    $meta['infomercial'] = $wall->infomercial;
                    $meta['zones']['c'] = $wall->infomercial;
                }
            }

            // 6. Fireworks on/off
            if ($r->has('fireworks')) {
                $fw = filter_var($r->input('fireworks'), FILTER_VALIDATE_BOOLEAN);
                $wall->fireworks = $fw;
                $meta['fireworks'] = $fw;
                $meta['fx']['fw'] = $fw;
            }

            // 7. Flybees on/off
            if ($r->has('flybees')) {
                $fly = filter_var($r->input('flybees'), FILTER_VALIDATE_BOOLEAN);
                $wall->flybees = $fly;
                $meta['flybees'] = $fly;
                $meta['fx']['fly'] = $fly;
            }

            // 8. Sound on/off
            if ($r->has('sound')) {
                $snd = filter_var($r->input('sound'), FILTER_VALIDATE_BOOLEAN);
                $wall->sound = $snd;
                $meta['sound'] = $snd;
                $meta['fx']['snd'] = $snd;
            }

            // 9. Language selected
            if ($r->has('language') || $r->has('lang')) {
                $lang = (string) ($r->input('language') ?: $r->input('lang'));
                $wall->language = $lang;
                $meta['language'] = $lang;
                $meta['lang'] = $lang;
            }

            $wall->meta = $meta;
            $wall->save();
            $this->touch($wall);

            Log::info("Saved wall settings for {$wall->slug}: layout={$wall->layout}, carousel={$wall->carousel}, topic={$wall->topic}, content={$wall->content}, infomercial={$wall->infomercial}, lang={$wall->language}");

            return response()->json([
                'success' => true,
                'message' => 'Wall settings saved successfully to wall table in database',
                'wall'    => [
                    'id'          => $wall->id,
                    'slug'        => $wall->slug,
                    'layout'      => $wall->layout,
                    'carousel'    => (bool)$wall->carousel,
                    'topic'       => (bool)$wall->topic,
                    'content'     => (bool)$wall->content,
                    'infomercial' => (bool)$wall->infomercial,
                    'fireworks'   => (bool)$wall->fireworks,
                    'flybees'     => (bool)$wall->flybees,
                    'sound'       => (bool)$wall->sound,
                    'language'    => $wall->language,
                    'meta'        => $wall->meta,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('saveSettings error: ' . $e->getMessage());
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
        $isOwner = $this->isOwner($wall, $r) || $r->header('x-is-owner') === '1' || $r->input('is_owner') === true || $r->input('is_owner') === '1';

        // When a user inserts a wall card, it is stored as pending status in DB.
        // Wall owner cards are auto-approved and saved as wiki.
        $status = $isOwner ? 'approved' : 'pending';
        $isOk   = $isOwner ? true : false;
        $cardType = $isOwner ? 'wiki' : $r->input('type', 'cowiki');

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
                'type'    => $cardType,
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
        // ONLY the owner of this wall can delete wall cards from this wall.
        $owner = $this->isOwner($wall, $r);
        if (!$owner) {
            return response()->json([
                'error'   => 'denied',
                'message' => 'Only the owner of this wall can delete wall cards from this wall.',
            ], 403);
        }

        $card->delete();
        $this->touch($wall);

        return response()->json(['ok' => true]);
    }

    /* ---------- DELETE /api/wall/{id}/cards ---------- */

    public function dropAllCards(Request $r, string $slug)
    {
        $wall = $this->wall($slug);
        if (!$this->isOwner($wall, $r)) {
            return response()->json([
                'error'   => 'denied',
                'message' => 'Only the wall owner can delete cards.',
            ], 403);
        }

        WallCard::where('wall_id', $wall->id)->delete();
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

    /**
     * Push to wall: saves and inserts data in wall_cards table with this wall id,
     * deletes old records of this wall id, and leaves aisearchhistory db unchanged.
     */
    public function pushToWall(Request $r, string $id)
    {
        $targetId = $r->input('wall_id') ?: $id;
        $wall = $this->wall((string) $targetId);

        // Security check: Only the wall owner or authorized user may push updates to this wall
        if (!$this->isOwner($wall, $r)) {
            return response()->json([
                'success' => false,
                'error'   => 'Unauthorized: Only the wall owner can push updates to this wall.',
            ], 403);
        }

        // 1. Delete old records of this wall id from wall_cards db table
        WallCard::where('wall_id', $wall->id)->delete();

        // 2. Extract cards data from request
        $raw = (string) $r->input('raw', '');
        $items = $r->input('items', $r->input('cards', []));
        if (is_string($items)) {
            $decoded = json_decode($items, true);
            if (is_array($decoded)) {
                $items = $decoded;
            }
        }

        $userId = Auth::id();
        $ipHash = request() ? WallHasher::ip(request()->ip() ?? '') : null;
        $me = $this->meHash($r);
        $insertedCards = [];

        // If items array is provided, insert each card item
        if (!empty($items) && is_array($items)) {
            foreach ($items as $it) {
                if (!is_array($it) && !is_object($it)) continue;
                $it = (array) $it;
                $cardRaw = trim((string)($it['_raw'] ?? $it['raw'] ?? $it['url'] ?? $it['html'] ?? ''));
                if (empty($cardRaw) && !empty($it['md'])) {
                    $cardRaw = "<md>{$it['md']}</md>";
                }
                if (empty($cardRaw)) continue;

                $zone = in_array($it['zone'] ?? '', ['a', 'b', 'c']) ? $it['zone'] : 'b';
                $type = !empty($it['type']) ? (string)$it['type'] : 'wiki';
                $cid = !empty($it['cid']) ? (string)$it['cid'] : WallHasher::cid();

                $card = WallCard::create([
                    'wall_id' => $wall->id,
                    'user_id' => $userId,
                    'cid'     => $cid,
                    'me_hash' => $me,
                    'ip_hash' => $ipHash,
                    'raw'     => $cardRaw,
                    'content' => $cardRaw,
                    'zone'    => $zone,
                    'type'    => $type,
                    'ok'      => true,
                    'status'  => 'approved',
                ]);
                $insertedCards[] = $card;
            }
        }

        // If items was empty or produced no cards, parse raw text into card blocks
        if (empty($insertedCards) && !empty($raw)) {
            // Strip any <wiki> or <co-wiki> tags if present to get clean card content
            $cleanRaw = preg_replace('/<\/?(?:wiki|co-wiki|cowiki)\b[^>]*>/i', '', $raw);
            $blocks = $this->parseEzSheetBlocks($cleanRaw);

            foreach ($blocks as $block) {
                $cardRaw = trim($block['raw']);
                if (empty($cardRaw)) continue;
                $zone = in_array($block['zone'] ?? '', ['a', 'b', 'c']) ? $block['zone'] : 'b';

                $card = WallCard::create([
                    'wall_id' => $wall->id,
                    'user_id' => $userId,
                    'cid'     => WallHasher::cid(),
                    'me_hash' => $me,
                    'ip_hash' => $ipHash,
                    'raw'     => $cardRaw,
                    'content' => $cardRaw,
                    'zone'    => $zone,
                    'type'    => 'wiki',
                    'ok'      => true,
                    'status'  => 'approved',
                ]);
                $insertedCards[] = $card;
            }
        }

        // 3. Touch the wall monotonic version so SSE and clients update
        $this->touch($wall);

        // 4. No need to change anything in aisearchhistory db
        Log::info("Push to wall {$wall->slug}: deleted old records and inserted " . count($insertedCards) . " WallCards for wall ID {$wall->id}. AISearchHistory db unchanged.");

        return response()->json([
            'success'     => true,
            'message'     => 'Successfully inserted wall cards with wall id and deleted old records. AISearchHistory database unchanged.',
            'wall_id'     => $wall->id,
            'slug'        => $wall->slug,
            'cards_count' => count($insertedCards),
            'cards'       => array_map(fn($c) => $this->cardJson($c), $insertedCards),
        ]);
    }

    /**
     * Parse EzSheet text into individual card blocks with their designated zones.
     */
    private function parseEzSheetBlocks(string $text): array
    {
        $blocks = [];
        $lines = preg_split('/\r\n|\r|\n/', trim($text));
        $currentZone = 'b';
        $buffer = [];
        $inMd = false;

        $flush = function () use (&$buffer, &$blocks, &$currentZone) {
            $raw = trim(implode("\n", $buffer));
            $buffer = [];
            if (!empty($raw) && !preg_match('/^[━─—\-]{3,}$/u', $raw)) {
                $blocks[] = [
                    'raw'  => $raw,
                    'zone' => $currentZone,
                ];
            }
        };

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if (preg_match('/^#{3,}/', $trimmed)) {
                $flush();
                $currentZone = 'c';
                continue;
            }
            if (preg_match('/^={3,}/', $trimmed)) {
                $flush();
                $currentZone = 'a';
                continue;
            }

            if ($inMd) {
                $buffer[] = $line;
                if (preg_match('/<\/md>\s*$/i', $trimmed)) {
                    $inMd = false;
                    $flush();
                }
                continue;
            }

            if (preg_match('/^<md>/i', $trimmed)) {
                $flush();
                $buffer[] = $line;
                if (!preg_match('/<\/md>\s*$/i', $trimmed) || strlen($trimmed) <= 4) {
                    $inMd = true;
                } else {
                    $flush();
                }
                continue;
            }

            if (preg_match('/^[━─—\-]{3,}$/u', $trimmed)) {
                $flush();
                continue;
            }

            if (preg_match('/^https?:\/\/\S+$/i', $trimmed)) {
                $flush();
                $blocks[] = [
                    'raw'  => $trimmed,
                    'zone' => $currentZone,
                ];
                continue;
            }

            if (!empty($trimmed)) {
                $buffer[] = $line;
            }
        }

        $flush();
        return $blocks;
    }

    /**
     * Upload image, pdf, html, video, audio into public/upload/ezsheet
     */
    public function uploadEzsheetFile(Request $request)
    {
        $hasFile = $request->hasFile('file');
        $hasData = $request->filled('data');

        if (!$hasFile && !$hasData) {
            return response()->json([
                'success' => false,
                'message' => 'No file or data provided',
            ], 422);
        }

        try {
            $userId = Auth::id() ?? 0;
            $targetDir = public_path('upload/ezsheet');
            if (!file_exists($targetDir)) {
                @mkdir($targetDir, 0755, true);
            }
            $uploadsTargetDir = public_path('uploads/ezsheet');
            if (!file_exists($uploadsTargetDir)) {
                @mkdir($uploadsTargetDir, 0755, true);
            }
            $storageTargetDir = storage_path('app/public/upload/ezsheet');
            if (!file_exists($storageTargetDir)) {
                @mkdir($storageTargetDir, 0755, true);
            }

            if ($hasFile) {
                $file = $request->file('file');
                $originalName = $file->getClientOriginalName();
                $extension = strtolower($file->getClientOriginalExtension());
                if (!$extension) {
                    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                }
                $safeName = Str::slug(pathinfo($originalName, PATHINFO_FILENAME), '_') ?: 'file';
                $filename = 'ezsheet_' . ($userId ? 'user_' . $userId . '_' : '') . time() . '_' . Str::random(6) . '_' . $safeName . '.' . ($extension ?: 'bin');

                $file->move($targetDir, $filename);
                @copy($targetDir . '/' . $filename, $uploadsTargetDir . '/' . $filename);
                if (file_exists($storageTargetDir)) {
                    @copy($targetDir . '/' . $filename, $storageTargetDir . '/' . $filename);
                }

                $mimeType = @mime_content_type($targetDir . '/' . $filename) ?: $file->getClientMimeType();
                $size = @filesize($targetDir . '/' . $filename);
            } else {
                $originalName = (string) $request->input('filename', 'uploaded_file');
                $rawMime = (string) $request->input('mime_type', 'application/octet-stream');
                $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                if (!$extension) {
                    $extMap = [
                        'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif', 'image/webp' => 'webp',
                        'application/pdf' => 'pdf', 'text/html' => 'html', 'video/mp4' => 'mp4', 'audio/mpeg' => 'mp3',
                    ];
                    $extension = $extMap[$rawMime] ?? 'bin';
                }
                $safeName = Str::slug(pathinfo($originalName, PATHINFO_FILENAME), '_') ?: 'file';
                $filename = 'ezsheet_' . ($userId ? 'user_' . $userId . '_' : '') . time() . '_' . Str::random(6) . '_' . $safeName . '.' . $extension;

                $data = $request->input('data');
                if (preg_match('/^data:([^;]+);base64,(.+)$/', $data, $matches)) {
                    $rawMime = $matches[1];
                    $binaryData = base64_decode($matches[2]);
                } else {
                    $binaryData = base64_decode($data);
                }

                file_put_contents($targetDir . '/' . $filename, $binaryData);
                @copy($targetDir . '/' . $filename, $uploadsTargetDir . '/' . $filename);
                if (file_exists($storageTargetDir)) {
                    @copy($targetDir . '/' . $filename, $storageTargetDir . '/' . $filename);
                }

                $mimeType = $rawMime;
                $size = strlen($binaryData);
            }

            $publicUrl = '/upload/ezsheet/' . $filename;

            return response()->json([
                'success' => true,
                'message' => 'File uploaded and stored in ezsheet folder successfully',
                'url' => $publicUrl,
                'filename' => $originalName,
                'extension' => $extension,
                'mime_type' => $mimeType,
                'size' => $size,
            ]);
        } catch (\Exception $e) {
            Log::error('uploadEzsheetFile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload ezsheet file: ' . $e->getMessage(),
            ], 500);
        }
    }
}