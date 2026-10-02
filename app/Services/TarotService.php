<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class TarotService
{
    public const MAJORS = [
        ["0","愚者","沒有計劃地出發",1,1,-2,2,0,-1],
        ["I","魔术师","手上的工具都能用",0,1,2,0,2,2],
        ["II","女教皇","沉默比说话有用",1,0,0,-1,-2,0],
        ["III","皇后","丰盛与照顾",2,2,1,0,1,1],
        ["IV","皇帝","秩序与界线",0,-1,2,-1,1,2],
        ["V","教皇","照既有规矩来",0,1,1,-1,1,1],
        ["VI","恋人","必须选一边",0,2,0,1,1,0],
        ["VII","战车","推进，而且推得动",1,-1,1,2,0,2],
        ["VIII","力量","以柔克刚",2,1,0,0,1,1],
        ["IX","隐者","独处与盘点",1,-2,0,-2,-1,1],
        ["X","命运之轮","外力突然转动",0,0,2,1,0,1],
        ["XI","正义","衡量与结算",0,0,1,0,1,1],
        ["XII","倒吊人","卡住，换个角度",-1,0,-1,-2,-1,-1],
        ["XIII","死神","结束一段才空得出位置",-1,-1,0,1,0,-1],
        ["XIV","节制","调配比例，留余裕",2,1,1,0,1,1],
        ["XV","恶魔","被欲望或习惯绑住",-2,-1,-2,-1,-2,-1],
        ["XVI","高塔","既有结构动摇",-2,-2,-1,-2,-1,-2],
        ["XVII","星星","希望重新亮起",1,1,0,1,1,1],
        ["XVIII","月亮","看不清楚，情绪放大",-1,-1,-1,-2,-2,-1],
        ["XIX","太阳","坦白与明亮",2,2,2,2,2,2],
        ["XX","审判","旧事重提，需要回应",0,1,0,0,2,1],
        ["XXI","世界","完成一整圈",1,1,2,2,1,2],
    ];

    public const SUITS = [
        ['nm'=>'权杖','g'=>'🜂','zh'=>'火：行动与热情','v'=>['h'=>2,'s'=>0,'m'=>1,'t'=>2,'w'=>0,'l'=>1]],
        ['nm'=>'圣杯','g'=>'🜄','zh'=>'水：感情与流动','v'=>['h'=>1,'s'=>2,'m'=>-1,'t'=>0,'w'=>1,'l'=>0]],
        ['nm'=>'宝剑','g'=>'🜁','zh'=>'风：思辨与冲突','v'=>['h'=>-1,'s'=>-2,'m'=>0,'t'=>1,'w'=>2,'l'=>-1]],
        ['nm'=>'钱币','g'=>'🜃','zh'=>'土：实务与积累','v'=>['h'=>1,'s'=>1,'m'=>2,'t'=>-2,'w'=>0,'l'=>1]],
    ];

    public const RANKS = ["A","2","3","4","5","6","7","8","9","10","侍者","骑士","王后","国王"];
    public const PR    = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

    public const PS = [
        'S' => ['nm'=>'黑桃','g'=>'♠','red'=>false,'dom'=>'w'],
        'H' => ['nm'=>'红心','g'=>'♥','red'=>true, 'dom'=>'s'],
        'D' => ['nm'=>'方块','g'=>'♦','red'=>true, 'dom'=>'m'],
        'C' => ['nm'=>'梅花','g'=>'♣','red'=>false,'dom'=>'t'],
    ];

    public function languages(): array
    {
        return [
            'zh-TW' => '繁體中文',
            'zh-CN' => '简体中文',
            'ja'    => '日本語',
            'ko'    => '한국어',
            'th'    => 'ไทย',
            'ms'    => 'Bahasa Melayu',
            'id'    => 'Bahasa Indonesia',
            'hi'    => 'हिन्दी',
            'ru'    => 'Русский',
        ];
    }

    public function i18n(): array
    {
        $path = resource_path('data/i18n.json');
        if (!file_exists($path)) {
            Log::error('i18n.json not found at: ' . $path);
            return [];
        }
        $raw = file_get_contents($path);
        $json = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('i18n.json parse error: ' . json_last_error_msg());
            return [];
        }
        return is_array($json) ? $json : [];
    }

    public function buildDeck(): array
    {
        $deck = [];

        foreach (self::MAJORS as $i => $m) {
            $deck[] = [
                'kind'  => 'major',
                'i'     => $i,
                'num'   => $m[0],
                'nm'    => $m[1],
                'theme' => $m[2],
                'v'     => ['h'=>$m[3],'s'=>$m[4],'m'=>$m[5],'t'=>$m[6],'w'=>$m[7],'l'=>$m[8]],
                'g'     => $m[0],
                'red'   => false,
            ];
        }

        foreach (self::SUITS as $s) {
            foreach (self::RANKS as $ri => $r) {
                $deck[] = [
                    'kind'  => 'minor',
                    's'     => $s,
                    'rank'  => $r,
                    'k'     => ($ri + 1) / 14,
                    'ri'    => $ri,
                    'nm'    => $s['nm'] . $r,
                    'g'     => $s['g'],
                    'theme' => $s['zh'],
                    'red'   => false,
                ];
            }
        }

        foreach (['S','H','D','C'] as $sk) {
            foreach (self::PR as $ri => $r) {
                $ps = self::PS[$sk];
                $deck[] = [
                    'kind'  => 'poker',
                    'sk'    => $sk,
                    'ps'    => $ps,
                    'rank'  => $r,
                    'mag'   => ($ri + 1) / 13,
                    'ri'    => $ri,
                    'nm'    => $ps['nm'] . $r,
                    'g'     => $ps['g'],
                    'theme' => '强度 ' . $r,
                    'red'   => $ps['red'],
                ];
            }
        }

        $deck[] = ['kind'=>'joker','nm'=>'鬼牌','g'=>'★','theme'=>'変数そのもの','red'=>true,'mag'=>0.5,'ri'=>6];
        $deck[] = ['kind'=>'joker','nm'=>'鬼牌','g'=>'★','theme'=>'変数そのもの','red'=>true,'mag'=>0.5,'ri'=>0];

        return $deck;
    }

    public function hash(string $s): int
    {
        $h = 2166136261;
        $len = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $h ^= ord($s[$i]);
            $h = ($h * 16777619) & 0xFFFFFFFF;
        }
        return $h;
    }

    public function rngOf(int $seed): callable
    {
        $a = $seed;
        return function () use (&$a) {
            $a = ($a + 0x6D2B79F5) & 0xFFFFFFFF;
            $t = $a;
            $t = ($t ^ (($t >> 15) & 0xFFFFFFFF)) & 0xFFFFFFFF;
            $t = ($t * (1 | $t)) & 0xFFFFFFFF;
            $t = ($t + (($t ^ (($t >> 7) & 0xFFFFFFFF)) * (61 | $t))) & 0xFFFFFFFF;
            $t = ($t ^ (($t >> 14) & 0xFFFFFFFF)) & 0xFFFFFFFF;
            return $t / 4294967296;
        };
    }

    public function deal(array $deck, callable $rand): array
    {
        for ($i = count($deck) - 1; $i > 0; $i--) {
            $j = (int) floor($rand() * ($i + 1));
            [$deck[$i], $deck[$j]] = [$deck[$j], $deck[$i]];
        }
        $cards = array_slice($deck, 0, 8);
        foreach ($cards as &$c) {
            $c['rev'] = ($c['kind'] !== 'poker' && $c['kind'] !== 'joker') && $rand() < 0.3;
        }
        unset($c);
        return $cards;
    }

    public function dealDaily(string $who, string $day, string $lang = 'zh-TW'): array
    {
        $deck = $this->buildDeck();
        $seed = $this->hash($day . '|' . $who);
        $cards = $this->deal($deck, $this->rngOf($seed));
        return $this->localizeCards($cards, $lang);
    }

    public function dealPractice(string $lang = 'zh-TW'): array
    {
        $deck = $this->buildDeck();
        $cards = $this->deal($deck, fn() => mt_rand() / mt_getrandmax());
        return $this->localizeCards($cards, $lang);
    }

    /**
     * Attach a localized "nm" to each card while keeping the structural fields.
     * This is what the frontend renders.
     */
    public function localizeCards(array $cards, string $lang): array
    {
        $i18n = $this->i18n();
        $t = $i18n[$lang] ?? $i18n['zh-TW'] ?? [];
        $majors = $t['majors'] ?? [];
        $suits  = $t['suits'] ?? [];
        $poker  = $t['pokerSuits'] ?? [];
        $ranks  = $t['ranks'] ?? [];
        $joker  = $t['jokerName'] ?? 'Joker';

        foreach ($cards as &$c) {
            if ($c['kind'] === 'joker') {
                $c['nm'] = $joker;
            } elseif ($c['kind'] === 'major') {
                $c['nm'] = $majors[$c['num']] ?? $c['nm'];
            } elseif ($c['kind'] === 'minor') {
                $suitNm = $suits[$c['s']['nm']] ?? $c['s']['nm'];
                $rankNm = $ranks[$c['rank']] ?? $c['rank'];
                $c['nm'] = $suitNm . $rankNm;
            } elseif ($c['kind'] === 'poker') {
                $suitNm = $poker[$c['ps']['nm']] ?? $c['ps']['nm'];
                $c['nm'] = $suitNm . $c['rank'];
            }
        }
        unset($c);
        return $cards;
    }

    public function findCard(array $spec): ?array
    {
        $norm = fn($s) => strtoupper(preg_replace('/\s+/', '', (string) $s));

        $type = $norm($spec['type'] ?? '');
        $num  = $norm($spec['num'] ?? $spec['rank'] ?? $spec['code'] ?? '');
        $suit = $norm($spec['suit'] ?? '');
        $nm   = $spec['nm'] ?? '';
        $sk   = $norm($spec['sk'] ?? '');

        $deck = $this->buildDeck();

        if ($type === 'JOKER' || $num === 'JOKER' || $nm === '鬼牌') {
            foreach ($deck as $c) if ($c['kind'] === 'joker') return $c;
        }

        if ($type === 'MAJOR' || (!$suit && preg_match('/^[0-9IVXL]+$/', $num))) {
            foreach ($deck as $c) {
                if ($c['kind'] === 'major' && $norm($c['num']) === $num) return $c;
            }
        }

        $minorAlias = [
            '權杖'=>'权杖','WANDS'=>'权杖','WAND'=>'权杖',
            '聖杯'=>'圣杯','CUPS'=>'圣杯','CUP'=>'圣杯',
            '寶劍'=>'宝剑','SWORDS'=>'宝剑','SWORD'=>'宝剑',
            '錢幣'=>'钱币','PENTACLES'=>'钱币','PENTACLE'=>'钱币','COINS'=>'钱币',
        ];
        if ($type === 'MINOR' || (!$sk && isset($minorAlias[$suit]))) {
            $sn = $minorAlias[$suit] ?? $spec['suit'] ?? '';
            foreach ($deck as $c) {
                if ($c['kind'] === 'minor'
                    && $c['s']['nm'] === $sn
                    && ($norm($c['rank']) === $num || $c['rank'] === ($spec['rank'] ?? null))) {
                    return $c;
                }
            }
        }

        $pokerAlias = [
            'SPADES'=>'S','黑桃'=>'S',
            'HEARTS'=>'H','紅心'=>'H','红心'=>'H',
            'DIAMONDS'=>'D','方塊'=>'D','方块'=>'D',
            'CLUBS'=>'C','梅花'=>'C',
        ];
        if ($type === 'POKER' || $sk || isset($pokerAlias[$suit])) {
            $realSk = $sk ?: ($pokerAlias[$suit] ?? $suit);
            foreach ($deck as $c) {
                if ($c['kind'] === 'poker'
                    && $c['sk'] === $realSk
                    && ($norm($c['rank']) === $num || $c['rank'] === ($spec['rank'] ?? null))) {
                    return $c;
                }
            }
        }

        return null;
    }
}