<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Wall extends Model
{
    protected $fillable = [
        'slug',
        'owner_hash',
        'meta',
        'layout',
        'carousel',
        'topic',
        'content',
        'infomercial',
        'fireworks',
        'flybees',
        'sound',
        'language',
    ];
    protected $casts = [
        'meta'        => 'array',
        'carousel'    => 'boolean',
        'topic'       => 'boolean',
        'content'     => 'boolean',
        'infomercial' => 'boolean',
        'fireworks'   => 'boolean',
        'flybees'     => 'boolean',
        'sound'       => 'boolean',
    ];

    public function cards()
    {
        return $this->hasMany(WallCard::class);
    }

    /**
     * Generate the next unique sequential wall ID: W0000000, W0000001, W0000002, so on.
     */
    public static function generateNextWallId(): string
    {
        // Query existing wall slugs that start with 'W' and are 8 characters long (W + 7 digits)
        $existing = static::where('slug', 'LIKE', 'W%')
            ->whereRaw('LENGTH(slug) = 8')
            ->pluck('slug')
            ->toArray();

        $maxNum = -1;
        foreach ($existing as $slug) {
            if (preg_match('/^W(\d{7})$/', $slug, $matches)) {
                $num = (int)$matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $nextNum = $maxNum + 1;

        // Ensure candidate is strictly unique in database
        do {
            $candidate = sprintf('W%07d', $nextNum);
            if (!static::where('slug', $candidate)->exists()) {
                return $candidate;
            }
            $nextNum++;
        } while (true);
    }

    /**
     * Create a new Wall record for an EzSheet post with a unique wall ID.
     */
    public static function createForEzSheet(string $content = '', ?string $title = null, ?int $userId = null, array $extraMeta = []): self
    {
        $wallId = static::generateNextWallId();

        $meta = array_merge([
            'source' => 'ezsheet',
            'format' => 'ezsheet',
            'title' => $title ?: 'EzSheet Wall',
            'user_id' => $userId,
            'created_at' => now()->toISOString(),
        ], $extraMeta);

        $wall = static::create([
            'slug' => $wallId,
            'meta' => $meta,
        ]);

        // If content is provided, parse items into WallCards with type 'wiki'
        if (!empty($content)) {
            $blocks = static::parseEzSheetBlocks($content);
            $ipHash = request() ? \App\Services\WallHasher::ip(request()->ip() ?? '') : null;
            // Generate a me_hash for the owner. Using a static string or a hash of the user ID.
            // This is what the WallController uses to identify the "me" (current user).
            $meHash = \App\Services\WallHasher::me('system_ezsheet_' . ($userId ?? 'guest'));

            foreach ($blocks as $block) {
                $raw = trim($block['raw'] ?? '');
                if (empty($raw)) continue;
                $zone = in_array($block['zone'] ?? 'b', ['a', 'b', 'c']) ? $block['zone'] : 'b';

                try {
                    WallCard::create([
                        'wall_id' => $wall->id,
                        'user_id' => $userId,
                        'cid'     => \App\Services\WallHasher::cid(),
                        'me_hash' => $meHash, // <--- ADDED THIS LINE
                        'raw'     => $raw,
                        'content' => $raw,
                        'zone'    => $zone,
                        'type'    => 'wiki',
                        'ok'      => true,
                        'status'  => 'approved',
                        'ip_hash' => $ipHash,
                    ]);
                } catch (\Exception $e) {
                    \Log::error('Failed to create WallCard in createForEzSheet: ' . $e->getMessage());
                }
            }
        }

        return $wall;
    }

    /**
     * Parse EzSheet text into individual card blocks with their designated zones.
     */
    public static function parseEzSheetBlocks(string $text): array
    {
        $blocks = [];
        $cleanText = trim($text);
        if (empty($cleanText)) {
            return [];
        }

        // 1. If explicit <wiki>...</wiki> tags exist
        if (preg_match_all('/<wiki\b[^>]*>(.*?)<\/wiki>/is', $cleanText, $matches)) {
            foreach ($matches[1] as $wikiInner) {
                $innerBlocks = static::parseEzSheetBlocks($wikiInner);
                foreach ($innerBlocks as $ib) {
                    $blocks[] = [
                        'raw'  => $ib['raw'],
                        'zone' => $ib['zone'],
                    ];
                }
            }
            // Check remaining text outside wiki tags if any
            $remaining = trim(preg_replace('/<wiki\b[^>]*>.*?<\/wiki>/is', '', $cleanText));
            if (!empty($remaining) && !preg_match('/^<(?:co-wiki|cowiki)\b/i', $remaining)) {
                $remBlocks = static::parseEzSheetBlocks($remaining);
                foreach ($remBlocks as $rb) {
                    $blocks[] = $rb;
                }
            }
            if (!empty($blocks)) {
                return $blocks;
            }
        }

        // 2. Split lines and extract card blocks by separators and boundary markers
        $lines = preg_split('/\r\n|\r|\n/', $cleanText);
        $rawBlocks = [];
        $buf = null;
        $md = null;

        foreach ($lines as $rawLine) {
            $line = trim($rawLine);
            if ($md !== null) {
                $md .= "\n" . $rawLine;
                if (preg_match('/<\/md>\s*$/i', $line)) {
                    $rawBlocks[] = trim($md);
                    $md = null;
                }
                continue;
            }
            if ($buf === null && preg_match('/^<md>/i', $line)) {
                if (preg_match('/<\/md>\s*$/i', $line) && strlen($line) > 4) {
                    $rawBlocks[] = $line;
                } else {
                    $md = $rawLine;
                }
                continue;
            }
            if ($buf !== null) {
                if (preg_match('/^[━─—\-]{3,}$/u', $line) || preg_match('/^={3,}$/', $line) || preg_match('/^#{1,}$/', $line) || (preg_match('/^https?:\/\/\S+$/i', $line) && strrpos($buf, '<') <= strrpos($buf, '>'))) {
                    $rawBlocks[] = trim($buf);
                    $buf = null;
                } else {
                    $buf .= "\n" . $rawLine;
                    continue;
                }
            }
            if (preg_match('/^={3,}$/', $line)) { $rawBlocks[] = '__ZONE_A__'; continue; }
            if (preg_match('/^#{1,}$/', $line)) { $rawBlocks[] = '__ZONE_C__'; continue; }
            if (empty($line) || preg_match('/^[━─—\-]{3,}$/u', $line)) continue;
            if (str_starts_with($line, '<')) {
                $buf = $rawLine;
                continue;
            }
            if (preg_match_all('/https?:\/\/[^\s"\'<>]+/i', $line, $urls) && !empty($urls[0])) {
                foreach ($urls[0] as $u) {
                    $rawBlocks[] = $u;
                }
            } else {
                $rawBlocks[] = $line;
            }
        }
        if ($buf !== null) $rawBlocks[] = trim($buf);
        if ($md !== null) $rawBlocks[] = trim($md);

        $items = [];
        $cardBuf = [];
        $flush = function (string $zone) use (&$cardBuf, &$items) {
            foreach ($cardBuf as $raw) {
                $rawTrimmed = trim($raw);
                if (!empty($rawTrimmed)) {
                    $items[] = [
                        'raw'  => $rawTrimmed,
                        'zone' => $zone,
                    ];
                }
            }
            $cardBuf = [];
        };

        foreach ($rawBlocks as $b) {
            if ($b === '__ZONE_C__') { $flush('c'); continue; }
            if ($b === '__ZONE_A__') { $flush('a'); continue; }
            $cardBuf[] = $b;
        }
        $flush('b');

        if (empty($items) && !empty($cleanText)) {
            $items[] = [
                'raw'  => $cleanText,
                'zone' => 'b',
            ];
        }

        return $items;
    }
}