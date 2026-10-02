(function(){
"use strict";
const $ = s => document.querySelector(s);
const KEY = 'sevenstars_multilang_v1';

const LANGS = {
  'zh-TW': { name: '繁體中文' },
  'zh-CN': { name: '简体中文' },
  'ja':    { name: '日本語' },
  'ko':    { name: '한국어' },
  'th':    { name: 'ไทย' },
  'ms':    { name: 'Bahasa Melayu' },
  'id':    { name: 'Bahasa Indonesia' },
  'hi':    { name: 'हिन्दी' },
  'ru':    { name: 'Русский' }
};

const FALLBACK_I18N = {
  'zh-TW': { drawBtn:'抽今日八星', practiceBtn:'練習抽', practiceLabel:'練習抽', reverse:'逆位', modeOffline:'離線抽牌', modeApi:'Kimi 抽牌' },
  'zh-CN': { drawBtn:'抽今日八星', practiceBtn:'练习抽', practiceLabel:'练习抽', reverse:'逆位', modeOffline:'离线抽牌', modeApi:'Kimi 抽牌' },
  'ja':    { drawBtn:'今日の八星を引く', practiceBtn:'練習で引く', practiceLabel:'練習', reverse:'逆位置', modeOffline:'オフラインで引く', modeApi:'Kimi で引く' },
  'ko':    { drawBtn:'오늘의 여덟 별 뽑기', practiceBtn:'연습 뽑기', practiceLabel:'연습', reverse:'역방향', modeOffline:'오프라인 뽑기', modeApi:'Kimi 뽑기' },
  'th':    { drawBtn:'จั่วแปดดาววันนี้', practiceBtn:'จั่วฝึก', practiceLabel:'ฝึก', reverse:'กลับหัว', modeOffline:'จั่วออฟไลน์', modeApi:'จั่วด้วย Kimi' },
  'ms':    { drawBtn:'Cabut Lapan Bintang', practiceBtn:'Cuba Cabut', practiceLabel:'Cuba', reverse:'Terbalik', modeOffline:'Cabut Luar Talian', modeApi:'Cabut Kimi' },
  'id':    { drawBtn:'Ambil Delapan Bintang', practiceBtn:'Latihan Ambil', practiceLabel:'Latihan', reverse:'Terbalik', modeOffline:'Ambil Luring', modeApi:'Ambil Kimi' },
  'hi':    { drawBtn:'आज के आठ सितारे निकालें', practiceBtn:'अभ्यास', practiceLabel:'अभ्यास', reverse:'उल्टा', modeOffline:'ऑफ़लाइन निकालें', modeApi:'Kimi से निकालें' },
  'ru':    { drawBtn:'Вытянуть восемь звёзд', practiceBtn:'Пробная', practiceLabel:'Проба', reverse:'Перевёрнутая', modeOffline:'Офлайн-вытягивание', modeApi:'Kimi' }
};

const RAW_I18N = (window.__TAROT__ && window.__TAROT__.i18n) ? window.__TAROT__.i18n : {};
const I18N = (Object.keys(RAW_I18N).length) ? RAW_I18N : FALLBACK_I18N;

/* Card structural data — language-neutral keys only. */
const MAJOR_KEYS = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI"];
const MAJORS = [
 ["0","愚者","没有计划地出发",1,1,-2,2,0,-1],
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
 ["XXI","世界","完成一整圈",1,1,2,2,1,2]
];
const SUITS = [
 {nm:"权杖",g:"🜂",zh:"火：行动与热情",v:{h:2,s:0,m:1,t:2,w:0,l:1}},
 {nm:"圣杯",g:"🜄",zh:"水：感情与流动",v:{h:1,s:2,m:-1,t:0,w:1,l:0}},
 {nm:"宝剑",g:"🜁",zh:"风：思辨与冲突",v:{h:-1,s:-2,m:0,t:1,w:2,l:-1}},
 {nm:"钱币",g:"🜃",zh:"土：实务与积累",v:{h:1,s:1,m:2,t:-2,w:0,l:1}}
];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","侍者","骑士","王后","国王"];
const PS = {S:{nm:"黑桃",g:"♠",red:false,dom:"w"},H:{nm:"红心",g:"♥",red:true,dom:"s"},
            D:{nm:"方块",g:"♦",red:true,dom:"m"},C:{nm:"梅花",g:"♣",red:false,dom:"t"}};
const PR = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

const CMT = {
 h:[[0,0],[40,1],[60,2],[80,3]],
 s:[[0,0],[40,1],[60,2],[80,3]],
 m:[[0,0],[40,1],[60,2],[80,3]],
 t:[[0,0],[40,1],[60,2],[80,3]],
 w:[[0,0],[40,1],[60,2],[80,3]],
 l:[[0,0],[40,1],[60,2],[80,3]]
};

/* ---------- Core logic ---------- */
function hash(s){ let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619) >>> 0; } return h >>> 0; }
function rngOf(seed){ let a = seed >>> 0;
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const POS = [
 ["h","#7FD6A0"], ["s","#F2A0C4"], ["m","#E8C25C"],
 ["t","#7FB8E8"], ["w","#C79BE8"], ["l","#5AD1C8"],
 ["x","#E8B45C"], ["f","#F5C84C"]
];
const DOM = ["h","s","m","t","w","l"];

function buildDeck(){
  const d = [];
  MAJORS.forEach((m,i)=> d.push({kind:"major", i, num:m[0], nm:m[1], theme:m[2],
    v:{h:m[3], s:m[4], m:m[5], t:m[6], w:m[7], l:m[8]}, g:m[0], red:false}));
  SUITS.forEach(s => RANKS.forEach((r,ri)=> d.push({kind:"minor", s, rank:r, k:(ri+1)/14, ri,
    nm:s.nm+r, g:s.g, theme:s.zh, red:false})));
  "SHDC".split("").forEach(sk => PR.forEach((r,ri)=> d.push({kind:"poker", sk, ps:PS[sk], rank:r,
    mag:(ri+1)/13, ri, nm:PS[sk].nm+r, g:PS[sk].g, theme:"强度 "+r, red:PS[sk].red})));
  d.push({kind:"joker", nm:"鬼牌", g:"★", theme:"変数そのもの", red:true, mag:.5, ri:6});
  d.push({kind:"joker", nm:"鬼牌", g:"★", theme:"変数そのもの", red:true, mag:.5, ri:0});
  return d;
}
const DECK = buildDeck();

function dealEight(rand){
  const d = DECK.slice();
  for (let i=d.length-1;i>0;i--){ const j = Math.floor(rand()*(i+1)); const t=d[i]; d[i]=d[j]; d[j]=t; }
  return d.slice(0,8).map(c => ({...c, rev: c.kind!=="poker" && c.kind!=="joker" && rand() < .3}));
}

function value(c, dom){
  const sign = c.rev ? -0.6 : 1;
  if (c.kind === "major") return c.v[dom] * 15 * sign;
  if (c.kind === "minor") return c.s.v[dom] * 12 * c.k * sign;
  if (c.kind === "joker") return 0;
  return (c.ps.red ? 1 : -1) * c.mag * 16 + (c.ps.dom === dom ? c.mag * 10 : 0);
}
const clamp = v => Math.max(5, Math.min(98, Math.round(50 + v)));

/* ---------- i18n helpers ---------- */
function T(lang){ return I18N[lang] || I18N['zh-TW'] || FALLBACK_I18N['zh-TW'] || {}; }

function translateCardName(c, lang){
  const t = T(lang);
  if (c.kind === 'joker') return t.jokerName || c.nm;
  if (c.kind === 'major') {
    const map = t.majors || {};
    return map[c.num] || c.nm;
  }
  if (c.kind === 'minor') {
    const sm = (t.suits || {})[c.s.nm] || c.s.nm;
    const rm = (t.ranks || {})[c.rank] || c.rank;
    return sm + rm;
  }
  if (c.kind === 'poker') {
    const sm = (t.pokerSuits || {})[c.ps.nm] || c.ps.nm;
    return sm + c.rank;
  }
  return c.nm;
}

function readHour(c, lang){
  const t = T(lang);
  const hours = t.hours || (I18N['zh-TW'] && I18N['zh-TW'].hours) || [];
  if (c.kind === "poker" || c.kind === "joker") return hours[c.ri % 12] || '';
  if (c.kind === "minor") return hours[c.ri % 12] || '';
  return hours[MAJOR_KEYS.indexOf(c.num) % 12] || '';
}

function cmt(k, v, lang){
  const t = T(lang);
  const arr = (t.cmt && t.cmt[k]) || [];
  const bands = CMT[k];
  let idx = 0;
  for (const [threshold, i] of bands) { if (v >= threshold) idx = i; }
  return arr[idx] || '';
}

function toneOf(c, lang){
  const t = T(lang);
  if (c.kind === "joker") return t.toneJoker || '';
  if (c.kind === "poker") {
    let s = c.red ? (t.tonePokerRed || '') : (t.tonePokerBlack || '');
    if (c.mag >= .77) s += (t.toneBigNumber || '');
    else if (c.mag <= .31) s += (t.toneLowNumber || '');
    return s;
  }
  if (c.kind === "minor") {
    const sm = (t.suits || {})[c.s.nm] || c.s.nm;
    return sm + (t.toneMinorSuffix || '') + Math.round(c.k * 14) + (t.toneMinorOf || '/14');
  }
  return c.theme;
}

function flashOf(c, lang){
  const t = T(lang);
  const band = (c.kind === "major" ? MAJOR_KEYS.indexOf(c.num) : c.ri) % 12;
  const startH = (band * 2 + 23) % 24;
  const mag = (c.kind === "poker" || c.kind === "joker") ? c.mag : (c.k || .5);
  const min = Math.round(mag * 50) % 50;
  const dur = 15 + Math.round(mag * 45);
  const end = new Date(2000, 0, 1, startH, min + dur);
  const pad = n => String(n).padStart(2, "0");
  const kind = c.kind === "joker" ? "joker"
             : c.kind === "poker" ? (c.red ? "gain" : "warn")
             : (c.rev ? "warn" : "gain");
  const missions = t.missions || (I18N['zh-TW'] && I18N['zh-TW'].missions) || [];
  const text = kind === "joker" ? (t.flashJokerText || '')
             : kind === "gain" ? (t.flashGainText || '')
             : (t.flashWarnText || '');
  return {
    window: pad(startH) + ":" + pad(min) + "–" + pad(end.getHours()) + ":" + pad(end.getMinutes()),
    mins: dur,
    mission: missions[(band + (c.ri || 0)) % 12] || '',
    kind, text
  };
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));
const ymd = d => new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const msg = t => { const el = $('#msg'); if (el) el.textContent = t; };

/* ---------- Language state ---------- */
let currentLang = 'zh-TW';
try { const saved = localStorage.getItem(KEY + '_lang'); if (saved && I18N[saved]) currentLang = saved; } catch(e){}

function setLang(lang) {
  currentLang = lang;
  try { localStorage.setItem(KEY + '_lang', lang); } catch(e){}
  const t = T(lang);
  document.documentElement.lang = lang;
  if ($('#title') && t.title) $('#title').textContent = t.title;
  if ($('#subtitle') && t.subtitle) $('#subtitle').textContent = t.subtitle;
  if ($('#who') && t.placeholder) $('#who').placeholder = t.placeholder;
  if ($('#drawBtn') && t.drawBtn) $('#drawBtn').textContent = t.drawBtn;
  if ($('#practiceBtn') && t.practiceBtn) $('#practiceBtn').textContent = t.practiceBtn;
  if ($('#modeOffline') && t.modeOffline) $('#modeOffline').textContent = t.modeOffline;
  if ($('#modeApi') && t.modeApi) $('#modeApi').textContent = t.modeApi;
  if ($('#note') && t.note) $('#note').textContent = t.note;
  if ($('#sumTitle') && t.sumTitle) $('#sumTitle').textContent = t.sumTitle;
  if ($('#flashTitle') && t.flashTitle) $('#flashTitle').textContent = t.flashTitle;
  if ($('#hourTitle') && t.hourTitle) $('#hourTitle').textContent = t.hourTitle;
  if ($('#detailTitle') && t.detailTitle) $('#detailTitle').textContent = t.detailTitle;

  const tPos = t.positions || [];
  document.querySelectorAll('.pos').forEach((el,i) => {
    const lab = el.querySelector('.lab');
    if (lab) lab.textContent = tPos[i] || '';
  });

  document.querySelectorAll('#langSelector button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function buildLangSelector() {
  const container = $('#langSelector');
  if (!container) return;
  container.innerHTML = '';
  Object.keys(LANGS).forEach(code => {
    const btn = document.createElement('button');
    btn.textContent = LANGS[code].name;
    btn.dataset.lang = code;
    btn.type = 'button';
    btn.addEventListener('click', () => setLang(code));
    container.appendChild(btn);
  });
}

function shell(){
  const t = T(currentLang);
  const tPos = t.positions || [];
  const spread = $('#spread');
  if (!spread) return;
  spread.innerHTML = POS.map(([k,color],i)=>
    '<div class="pos'+(k === "f" ? " gold" : "")+'"><div class="lab">'+(tPos[i]||'')+'</div>'+
    '<div class="slot" id="s'+i+'"><div class="flip">'+
    '<div class="face back">✧</div><div class="face front" id="f'+i+'"></div></div></div>'+
    '<div class="track"><div class="fill" id="b'+i+'" style="background:'+color+'"></div></div>'+
    '<div class="val" id="v'+i+'">&nbsp;</div></div>').join('');
}

let busy = false;
async function show(cards, label, who){
  busy = true;
  if ($('#drawBtn')) $('#drawBtn').disabled = true;
  if ($('#practiceBtn')) $('#practiceBtn').disabled = true;
  if ($('#result')) $('#result').hidden = true;
  POS.forEach((p,i)=>{
    const s = $('#s'+i); if (s) s.classList.remove('open');
    const b = $('#b'+i); if (b) b.style.width='0';
    const v = $('#v'+i); if (v) v.innerHTML='&nbsp;';
  });
  await sleep(140);

  const scores = {};
  cards.forEach((c,i)=>{
    const t = T(currentLang);
    const cn = translateCardName(c, currentLang);
    const f = $('#f'+i);
    if (f) f.innerHTML = '<div class="g'+(c.red?' red':'')+'">'+c.g+'</div>'+
      '<div><div class="n">'+cn+'</div>'+(c.rev?'<div class="r">'+(t.reverse||'')+'</div>':'')+'</div>';
    setTimeout(()=>{ const s = $('#s'+i); if (s) s.classList.add('open'); }, 150*i);
  });
  await sleep(1000);

  DOM.forEach((k,i)=>{
    const v = clamp(value(cards[i], k));
    scores[k] = v;
    const b = $('#b'+i); if (b) b.style.width = v + '%';
    const vv = $('#v'+i); if (vv) vv.textContent = v;
  });
  const t = T(currentLang);
  const hour = readHour(cards[6], currentLang);
  if ($('#v6')) $('#v6').textContent = hour.split(' ')[0] || '';
  if ($('#b6')) $('#b6').style.width = '100%';
  const fl = flashOf(cards[7], currentLang);
  if ($('#v7')) $('#v7').textContent = fl.window.split('–')[0] || '';
  if ($('#b7')) $('#b7').style.width = '100%';

  const avg = Math.round(DOM.reduce((a,k)=>a+scores[k],0)/6);
  const rank = DOM.slice().sort((a,b)=>scores[b]-scores[a]);
  const hi = rank[0], lo = rank[5];
  const nameOf = k => (t.positions||[])[POS.findIndex(p=>p[0]===k)] || k;
  const joker = cards.some(c=>c.kind==="joker");
  const card5Name = translateCardName(cards[5], currentLang) + (cards[5].rev ? ' ' + (t.reverse||'') : '');
  const card6Name = translateCardName(cards[6], currentLang) + (cards[6].rev ? ' ' + (t.reverse||'') : '');
  const card7Name = translateCardName(cards[7], currentLang) + (cards[7].rev ? ' ' + (t.reverse||'') : '');

  if ($('#sumTitle')) $('#sumTitle').textContent = label + '　' + (t.total||'') + ' ' + avg;
  if ($('#sumText')) $('#sumText').textContent =
    (t.brightest||'') + nameOf(hi) + '（' + scores[hi] + '），' + (t.darkest||'') + nameOf(lo) + '（' + scores[lo] + '）。' +
    (t.workTone||'').replace('{card}', card5Name) + toneOf(cards[5], currentLang) + '。' +
    (joker ? ' ' + (t.jokerNote||'') : '') +
    (avg >= 62 ? ' ' + (t.overallGood||'') : avg <= 42 ? ' ' + (t.overallBad||'') : ' ' + (t.overallMid||''));
  if ($('#sumTags')) {
    const yiArr = (t.yi_map && t.yi_map[hi]) || [];
    const jiArr = (t.ji_map && t.ji_map[lo]) || [];
    $('#sumTags').innerHTML =
      yiArr.slice(0,2).map(x=>'<span class="yi">' + (t.yi_prefix||'') + x + '</span>').join('') +
      jiArr.slice(0,2).map(x=>'<span class="ji">' + (t.ji_prefix||'') + x + '</span>').join('');
  }

  if ($('#flashWin')) $('#flashWin').textContent = fl.window;
  if ($('#flashText')) $('#flashText').textContent =
    (t.flashWindow||'').replace('{card}', card7Name).replace('{mins}', fl.mins) + ' ' + fl.text;
  if ($('#flashTags')) $('#flashTags').innerHTML =
    '<span class="yi">' + (t.flashMission||'') + fl.mission + '</span>' +
    '<span>' + (t.flashLength||'').replace('{mins}', fl.mins) + '</span>';

  if ($('#hourBig')) $('#hourBig').textContent = hour;
  if ($('#hourText')) $('#hourText').textContent =
    (t.hourText||'').replace('{card}', card6Name) +
    (cards[6].kind === 'joker' ? ' ' + (t.hourJoker||'') : '');

  if ($('#detail')) {
    $('#detail').innerHTML = DOM.map((k,i)=>{
      const cn = translateCardName(cards[i], currentLang) + (cards[i].rev ? ' ' + (t.reverse||'') : '');
      return '<div class="row"><b>' + nameOf(k) + '</b><span>' + scores[k] + '　' + cmt(k, scores[k], currentLang) +
        '　<span style="color:#7E9C9E">（' + cn + '）</span></span></div>';
    }).join('');
  }
  if ($('#result')) $('#result').hidden = false;

  if (who !== null){ try { localStorage.setItem(KEY, JSON.stringify({who})); } catch(e){} }
  busy = false;
  if ($('#drawBtn')) $('#drawBtn').disabled = false;
  if ($('#practiceBtn')) $('#practiceBtn').disabled = false;
}

function daily(){
  if (busy) return;
  const t = T(currentLang);
  const who = ($('#who') && $('#who').value.trim()) || '無名氏';
  const day = ymd(new Date());
  msg((t.msgDaily||'').replace('{who}', who).replace('{day}', day));
  show(dealEight(rngOf(hash(day + '|' + who))), day + ' · ' + who, who);
}
function practice(){
  if (busy) return;
  const t = T(currentLang);
  msg(t.msgPractice||'');
  show(dealEight(Math.random), t.practiceLabel||'', null);
}

/* ---------- API mode ---------- */
let apiMode = false;
try { apiMode = localStorage.getItem(KEY + '_mode') === 'api'; } catch(e){}

function applyMode(){
  if ($('#modeOffline')) $('#modeOffline').classList.toggle('active', !apiMode);
  if ($('#modeApi')) $('#modeApi').classList.toggle('active', apiMode);
}

const modeOfflineEl = $('#modeOffline');
const modeApiEl = $('#modeApi');
if (modeOfflineEl) modeOfflineEl.addEventListener('click', ()=>{ if(busy) return; apiMode=false;
  try{ localStorage.setItem(KEY+'_mode','offline'); }catch(e){} applyMode(); msg(''); });
if (modeApiEl) modeApiEl.addEventListener('click', ()=>{ if(busy) return; apiMode=true;
  try{ localStorage.setItem(KEY+'_mode','api'); }catch(e){} applyMode(); msg(''); });

async function drawViaApi(){
  busy = true;
  if ($('#drawBtn')) $('#drawBtn').disabled = true;
  if ($('#practiceBtn')) $('#practiceBtn').disabled = true;
  const t = T(currentLang);
  msg(t.apiDrawing||'');
  const who = ($('#who') && $('#who').value.trim()) || '無名氏';

  try {
    const res = await fetch(window.__TAROT__.routes.apiDraw, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': window.__TAROT__.routes.csrf,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ who: who, lang: currentLang })
    });

    const data = await res.json();

    if (!data.ok) {
      msg((t.apiError||'').replace('{err}', data.error || '?'));
      busy = false;
      if ($('#drawBtn')) $('#drawBtn').disabled = false;
      if ($('#practiceBtn')) $('#practiceBtn').disabled = false;
      return;
    }

    msg((t.apiDone||'').replace('{who}', data.who).replace('{day}', data.day));
    await show(data.cards, data.day + ' · ' + data.who + ' · API', data.who);
  } catch(e){
    msg((t.apiFail||'').replace('{err}', e.message));
  }
  busy = false;
  if ($('#drawBtn')) $('#drawBtn').disabled = false;
  if ($('#practiceBtn')) $('#practiceBtn').disabled = false;
}

/* ---------- Init ---------- */
buildLangSelector();
shell();
setLang(currentLang);
applyMode();

const drawBtnEl = $('#drawBtn');
if (drawBtnEl) drawBtnEl.addEventListener('click', () => {
  if (apiMode) { drawViaApi(); } else { daily(); }
});
const practiceBtnEl = $('#practiceBtn');
if (practiceBtnEl) practiceBtnEl.addEventListener('click', practice);
const whoEl = $('#who');
if (whoEl) whoEl.addEventListener('keydown', e=>{
  if (e.key === 'Enter') { if (apiMode) { drawViaApi(); } else { daily(); } }
});
try { const l = JSON.parse(localStorage.getItem(KEY) || 'null'); if (l && l.who && whoEl) whoEl.value = l.who; } catch(e){}

})();