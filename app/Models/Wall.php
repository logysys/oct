<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Wall extends Model
{
    protected $fillable = ['slug', 'owner_hash', 'meta'];
    protected $casts    = ['meta' => 'array'];

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

        // If content is provided, parse items into WallCards
        if (!empty($content)) {
            $lines = preg_split('/\r\n|\r|\n/', trim($content));
            $currentZone = 'content';
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line === '━━━━') continue;
                if (str_starts_with($line, '###')) {
                    $currentZone = 'infomercial';
                    continue;
                } elseif (str_starts_with($line, '===')) {
                    $currentZone = 'topic';
                    continue;
                }

                try {
                    WallCard::create([
                        'wall_id' => $wall->id,
                        'cid'     => \App\Services\WallHasher::cid(),
                        'raw'     => $line,
                        'zone'    => $currentZone,
                        'ok'      => true,
                        'ip_hash' => request() ? \App\Services\WallHasher::ip(request()->ip() ?? '') : null,
                    ]);
                } catch (\Exception $e) {
                    // Continue gracefully if card creation encounters issues
                }
            }
        }

        return $wall;
    }
}
