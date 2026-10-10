<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>塔羅撲克今日八星</title>
<style>
:root{--bg:#06232A;--pane:#0C323B;--line:#1C525E;--card:#F2EFE3;--cyan:#5AD1C8;--gold:#E8B45C;
  --txt:#E8F3F1;--dim:#8FB2B4;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:20px 16px 46px;color:var(--txt);
  background:radial-gradient(1100px 560px at 50% -12%,#0F4450,#06232A 62%);
  font-family:-apple-system,"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif;line-height:1.75}
.wrap{max-width:900px;margin:0 auto}
h1{margin:4px 0 2px;font-size:clamp(1.4rem,4.4vw,2rem);font-weight:900;letter-spacing:.1em}
.sub{margin:0 0 16px;color:var(--dim);font-size:.85rem}
input,button{font:inherit}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input[type=text]{flex:1 1 170px;min-width:0;background:#0A2C34;border:1px solid var(--line);border-radius:999px;
  padding:9px 15px;color:var(--txt);font-size:.9rem}
button{cursor:pointer;border-radius:999px;border:1px solid var(--line);background:#0E3945;color:var(--txt);
  padding:9px 16px;font-size:.88rem;font-weight:700}
button.main{background:linear-gradient(180deg,#6FE0D4,#37A99F);color:#04222A;border-color:#2C7E77}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.msg{margin:8px 0 16px;min-height:1.4em;font-size:.82rem;color:var(--cyan)}
.spread{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin-bottom:22px}
@media (max-width:900px){.spread{grid-template-columns:repeat(4,1fr)}}
@media (max-width:480px){.spread{grid-template-columns:repeat(2,1fr)}}
.pos{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.pos .lab{font-size:.72rem;letter-spacing:.16em;color:var(--dim);text-align:center}
.slot{perspective:900px}
.flip{position:relative;width:100%;aspect-ratio:2/3;transform-style:preserve-3d;
  transition:transform .7s cubic-bezier(.2,.85,.2,1)}
.slot.open .flip{transform:rotateY(180deg)}
.face{position:absolute;inset:0;border-radius:10px;backface-visibility:hidden;overflow:hidden;
  border:1px solid #9FBEB8;box-shadow:0 10px 20px rgba(0,0,0,.45)}
.back{background:repeating-linear-gradient(45deg,#0E3945 0 8px,#134653 8px 16px);
  display:grid;place-items:center;color:var(--cyan);font-size:1.3rem}
.front{transform:rotateY(180deg);background:var(--card);color:#1C2B2A;
  display:flex;flex-direction:column;justify-content:space-between;padding:7px}
.front .g{text-align:center;font-size:1.7rem;line-height:1}
.front .g.red{color:#B8323F}
.front .n{font-size:.7rem;font-weight:900;text-align:center;line-height:1.2}
.front .r{font-size:.56rem;text-align:center;color:#8A7060;letter-spacing:.08em}
.pos.gold .lab{color:#F5C84C}
.pos.gold .back{background:repeating-linear-gradient(45deg,#4A3510 0 8px,#5E4413 8px 16px);color:#F5C84C}
.pos.gold .face{border-color:#F5C84C;box-shadow:0 10px 24px rgba(245,200,76,.28)}
.pos.gold .front{background:linear-gradient(160deg,#FBEFC9,#EFD48A);color:#4A3510}
.pos.gold .val{color:#F5C84C}
.flash{border-color:#7A5E1E !important;background:linear-gradient(160deg,#143741,#2C2A16)}
.flash h2{color:#F5C84C}
.flash .win{font-size:1.7rem;font-weight:900;color:#F5C84C;letter-spacing:.04em}
.pos .val{text-align:center;font-size:.78rem;font-weight:800}
.pos .track{height:6px;border-radius:99px;background:#123C47;overflow:hidden}
.pos .fill{height:100%;width:0;border-radius:99px;transition:width .9s cubic-bezier(.2,.8,.2,1)}
.panel{background:var(--pane);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:14px}
.panel h2{margin:0 0 8px;font-size:.95rem;letter-spacing:.12em;color:var(--cyan)}
.panel p{margin:0 0 6px;font-size:.93rem}
.rows{display:grid;gap:8px;margin-top:4px}
.row{display:flex;gap:10px;align-items:baseline;font-size:.88rem}
.row b{flex:none;width:3.4em;color:var(--dim);font-size:.76rem;letter-spacing:.1em}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tags span{padding:3px 11px;border-radius:999px;font-size:.78rem;border:1px solid var(--line);background:#0A2C34}
.tags .yi{border-color:#2C7E77;color:#8FE6DB}
.tags .ji{border-color:#7E4A3C;color:#F0AC96}
.hour{display:flex;flex-wrap:wrap;gap:16px;align-items:center}
.hour .big{font-size:1.7rem;font-weight:900;color:var(--gold);letter-spacing:.06em}

.mode{display:flex;gap:8px;margin:0 0 8px}
.mode button{flex:0 0 auto;padding:7px 16px;font-size:.82rem}
.mode button.active{background:linear-gradient(180deg,#6FE0D4,#37A99F);color:#04222A;border-color:#2C7E77;font-weight:900}
.note{margin-top:20px;font-size:.75rem;color:var(--dim);line-height:1.6}
.lang-selector{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;justify-content:center}
.lang-selector button{padding:6px 12px;font-size:.75rem;border-radius:999px;background:#0A2C34;border:1px solid var(--line);color:var(--txt)}
.lang-selector button.active{background:linear-gradient(180deg,#6FE0D4,#37A99F);color:#04222A;border-color:#2C7E77;font-weight:900}
</style>
</head>
<body>
<div class="wrap">
  <div class="lang-selector" id="langSelector"></div>

  <h1 id="title">塔羅撲克今日八星</h1>
  <p class="sub" id="subtitle"></p>

  <div class="mode" id="modeBar">
    <button type="button" id="modeOffline" class="active"></button>
    <button type="button" id="modeApi"></button>
  </div>
  <div class="bar">
    <input type="text" id="who" placeholder="" autocomplete="off" maxlength="24">
    <button class="main" id="drawBtn"></button>
    <button id="practiceBtn"></button>
  </div>
  <p class="msg" id="msg"></p>

  <div class="spread" id="spread"></div>

  <div id="result" hidden>
    <div class="panel">
      <h2 id="sumTitle"></h2>
      <p id="sumText"></p>
      <div class="tags" id="sumTags"></div>
    </div>
    <div class="panel flash">
      <h2 id="flashTitle"></h2>
      <div class="hour">
        <div class="win" id="flashWin">—</div>
        <div id="flashText" style="flex:1 1 240px;font-size:.88rem;color:#E4DCC2"></div>
      </div>
      <div class="tags" id="flashTags"></div>
    </div>
    <div class="panel">
      <h2 id="hourTitle"></h2>
      <div class="hour">
        <div class="big" id="hourBig">—</div>
        <div id="hourText" style="flex:1 1 220px;font-size:.88rem;color:#BFD8D6"></div>
      </div>
    </div>
    <div class="panel">
      <h2 id="detailTitle"></h2>
      <div class="rows" id="detail"></div>
    </div>
  </div>

  <p class="note" id="note"></p>
</div>

<script>
window.__TAROT__ = {
  langs: @json($langs),
  i18n:  @json($i18n),
  routes: {
    draw:     "{{ route('tarot.draw') }}",
    practice: "{{ route('tarot.practice') }}",
    apiDraw:  "{{ route('tarot.apiDraw') }}",
    csrf:     "{{ csrf_token() }}"
  }
};
</script>
<script src="{{ asset('js/tarot.js') }}"></script>
</body>
</html>