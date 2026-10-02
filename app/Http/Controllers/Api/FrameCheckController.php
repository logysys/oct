<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FrameCheckController extends Controller
{
    public function check(Request $r)
    {
        $url = (string) $r->query('url', '');

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['error' => 'bad-url'], 400);
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return response()->json(['error' => 'bad-scheme'], 400);
        }

        // -----------------------------------------------------------------
        // SSRF guard: resolve the host and reject private / reserved ranges.
        // This blocks http://169.254.169.254/, http://localhost:6379/, etc.
        // -----------------------------------------------------------------
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return response()->json(['error' => 'bad-host'], 400);
        }

        $ips = @gethostbynamel($host);
        if (!$ips || !is_array($ips) || !count($ips)) {
            return response()->json(['error' => 'unresolvable-host'], 400);
        }

        foreach ($ips as $ip) {
            $ok = filter_var(
                $ip,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            );
            if ($ok === false) {
                return response()->json(['error' => 'blocked-host'], 400);
            }
        }

        // Also block obvious loopback / link-local hostnames by name
        $lower = strtolower($host);
        if ($lower === 'localhost' || str_ends_with($lower, '.localhost') || $lower === '0.0.0.0') {
            return response()->json(['error' => 'blocked-host'], 400);
        }

        $cacheKey = 'frame:' . sha1($url);

        $result = Cache::remember($cacheKey, now()->addHours(6), function () use ($url) {
            return $this->probe($url);
        });

        // Do NOT set Access-Control-Allow-Origin manually — the HandleCors
        // middleware already adds it from config/cors.php. Setting it here
        // would duplicate the header and some browsers reject the response.
        return response()->json($result, 200, [
            'Cache-Control' => 'public, max-age=21600',
        ]);
    }

    private function probe(string $url): array
    {
        try {
            $options = [
                'allow_redirects' => ['max' => 3, 'strict' => true],
                'timeout'         => 6,
                'connect_timeout' => 4,
                'http_errors'     => false,
                'headers'         => [
                    'User-Agent' => 'Mozilla/5.0 (compatible; ez.wiki embed-check/1.0)',
                ],
            ];

            // Try HEAD first (cheapest). Many servers reject HEAD with 405/501,
            // so fall back to a ranged GET which returns headers without body.
            $res = Http::withOptions($options)->head($url);

            if (in_array($res->status(), [405, 501, 400], true) || $res->status() === 0) {
                $res = Http::withOptions($options)
                    ->withHeaders(['Range' => 'bytes=0-0'])
                    ->get($url);
            }

            $xfo  = strtolower((string) $res->header('X-Frame-Options'));
            $csp  = strtolower((string) $res->header('Content-Security-Policy'));
            $acao = (string) $res->header('Access-Control-Allow-Origin');

            $embeddable = true;
            if ($xfo === 'deny' || $xfo === 'sameorigin') {
                $embeddable = false;
            }
            if (preg_match("/frame-ancestors\s+([^;]+)/i", $csp, $m)) {
                $anc = strtolower(trim($m[1]));
                if ($anc === "'none'" || $anc === "'self'") {
                    $embeddable = false;
                }
            }

            return [
                'embeddable' => $embeddable,
                'xfo'        => $xfo ?: null,
                'csp'        => $csp ?: null,
                'acao'       => $acao ?: null,
                'status'     => $res->status(),
            ];
        } catch (\Throwable $e) {
            // Can't tell — assume embeddable so the client still shows the card.
            return ['embeddable' => true, 'error' => $e->getMessage()];
        }
    }
}