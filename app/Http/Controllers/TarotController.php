<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Services\TarotService;

class TarotController extends Controller
{
    public function __construct(protected TarotService $tarot) {}

    public function index()
    {
        return view('tarot.index', [
            'langs' => $this->tarot->languages(),
            'i18n'  => $this->tarot->i18n(),
        ]);
    }

    public function draw(Request $request)
    {
        $who  = trim($request->input('who', '')) ?: '無名氏';
        $lang = $request->input('lang', 'zh-TW');
        $day  = now()->format('Y-m-d');

        return response()->json([
            'ok'    => true,
            'who'   => $who,
            'day'   => $day,
            'cards' => $this->tarot->dealDaily($who, $day, $lang),
        ]);
    }

    public function practice(Request $request)
    {
        $lang = $request->input('lang', 'zh-TW');
        return response()->json([
            'ok'    => true,
            'cards' => $this->tarot->dealPractice($lang),
        ]);
    }

    public function apiDraw(Request $request)
    {
        $who  = trim($request->input('who', '')) ?: '無名氏';
        $lang = $request->input('lang', 'zh-TW');
        $day  = now()->format('Y-m-d');

        $key = config('services.moonshot.api_key');
        if (empty($key)) {
            return response()->json([
                'ok'    => false,
                'error' => 'Server is missing MOONSHOT_API_KEY in .env',
            ], 500);
        }

        $majors = collect(TarotService::MAJORS)->pluck(0)->implode(', ');

        $prompt = "你是一個塔羅撲克抽牌器。牌庫共132張：\n"
            . "1) 大阿爾克那22張，編號：{$majors}（可用羅馬數字）；\n"
            . "2) 小阿爾克那56張，四個牌組：权杖、圣杯、宝剑、钱币，每組14張，牌階：A,2,3,4,5,6,7,8,9,10,侍者,骑士,王后,国王；\n"
            . "3) 撲克52張：黑桃、红心、方块、梅花 × A,2,3,4,5,6,7,8,9,10,J,Q,K；\n"
            . "4) 鬼牌2張（joker）。\n"
            . "請為「{$who}」在 {$day} 依直覺抽出8張不重複的牌（順序：健康星、人際星、錢財星、出行星、言語星、工作星、吉時星、快閃星）。"
            . "塔羅牌約三成給逆位。只回傳JSON，格式：\n"
            . '{"cards":[{"type":"major|minor|poker|joker","suit":"牌組名（minor/poker才需要）","num":"牌面（major用羅馬數字，poker用A..K）","reversed":true/false},...共8張]}'
            . "\n不要輸出任何其他文字。";

        try {
            $res = Http::withToken($key)
                ->timeout(config('services.moonshot.timeout', 60))
                ->acceptJson()
                ->post(rtrim(config('services.moonshot.base_url'), '/') . '/chat/completions', [
                    'model'           => config('services.moonshot.model'),
                    'temperature'     => (float) config('services.moonshot.temperature', 1),
                    'max_tokens'      => (int) config('services.moonshot.max_tokens', 2000),
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                ]);

            if ($res->failed()) {
                Log::warning('Moonshot API failed', ['status' => $res->status(), 'body' => $res->body()]);
                return response()->json([
                    'ok'    => false,
                    'error' => 'Upstream API error ('.$res->status().')',
                ], 502);
            }

            $content = $res->json('choices.0.message.content', '');
            $content = trim(preg_replace('/```json|```/', '', $content));
            $parsed  = json_decode($content, true);

            $specs = $parsed['cards'] ?? $parsed;
            if (!is_array($specs)) {
                return response()->json(['ok' => false, 'error' => 'Malformed AI response'], 502);
            }

            $cards = [];
            foreach ($specs as $spec) {
                if (!is_array($spec)) continue;
                $c = $this->tarot->findCard($spec);
                if ($c) {
                    $c['rev'] = !empty($spec['reversed'])
                        && $c['kind'] !== 'poker'
                        && $c['kind'] !== 'joker';
                    $cards[] = $c;
                }
                if (count($cards) === 8) break;
            }

            if (count($cards) < 8) {
                return response()->json([
                    'ok'    => false,
                    'error' => 'AI returned unmapped cards ('.count($cards).'/8). Try again.',
                ], 502);
            }

            // Re-localize names for the requested language
            $cards = $this->tarot->localizeCards($cards, $lang);

            return response()->json([
                'ok'    => true,
                'who'   => $who,
                'day'   => $day,
                'cards' => $cards,
            ]);
        } catch (\Throwable $e) {
            Log::error('Moonshot proxy exception', ['msg' => $e->getMessage()]);
            return response()->json(['ok' => false, 'error' => 'Request failed'], 500);
        }
    }
}