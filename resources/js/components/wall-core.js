(function(){
const VERSION='V618.19';
const MODEL_W=380,MODEL_H=285;   /* 3D 卡的預設尺寸（4:3） */
function verBadge(){if(document.getElementById('verBadge'))return;const d=document.createElement('div');d.id='verBadge';d.className='ver-badge';d.textContent=VERSION;document.body.appendChild(d);}
const STD_W=340,STD_H=220,HTML_W=520,HTML_H=720,GRID=20,MIN=120,MAX=4000,DAY=86400000;
const YT=/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>ESC[c]);}
function httpUrl(s){try{const u=new URL(String(s));return (u.protocol==='http:'||u.protocol==='https:')?u.href:'';}catch(e){return '';}}
function size(v,d){v=Math.round(Number(v));return Number.isFinite(v)&&v>=MIN&&v<=MAX?v:d;}
function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);}
/* 一般 Spotify 網址自動轉成嵌入網址 */
function toEmbed(u){
  try{const x=new URL(u);
    if(x.hostname==='open.spotify.com'){const m=x.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|episode|show|album|playlist|artist)\/([A-Za-z0-9]+)/);
      if(m)return 'https://open.spotify.com/embed/'+m[1]+'/'+m[2]+x.search;}
  }catch(e){}
  return u;
}
/* 每張卡的「合身規則」：
   fixed＝固定內容高度（Spotify、SoundCloud、Apple Podcasts、嵌入碼寫了 height 但寬度是 %）
   ratio＝固定比例（YouTube、Vimeo、嵌入碼寬高都是數字）
   auto ＝HTML 嵌入碼，由 iframe 內回報實際高度
   page ＝一般網頁，看不到內容高度，用版面預設比例 */
function attrNum(raw,name){const m=String(raw).match(new RegExp('\\s'+name+'\\s*=\\s*["\']?\\s*([0-9.]+)\\s*(%)?','i'));return m?{v:parseFloat(m[1]),pct:!!m[2]}:null;}
function fitOf(o){
  if(isTomb(o))return {t:'fixed',h:250};
  if(o.type==='youtube')return {t:'ratio',r:16/9};
  if(o.type==='html'||o.type==='md')return {t:'auto'};
  /* 3D 視窗用固定長寬比，不隨內容變高，也不需要量高度 */
  if(o.type==='model')return {t:'ratio',r:4/3};
  const raw=String(o._raw||''),u=String(o.url||'');
  /* Facebook 外掛：影片區依寬度等比縮放，下方貼文文字／按讚列高度固定 */
  const fbm=u.match(/^https:\/\/(?:www\.)?facebook\.com\/plugins\/[^?]+\?(.*)$/);
  if(fbm){const q=new URLSearchParams(fbm[1]),uw=+q.get('width'),uh=+q.get('height'),H=(attrNum(raw,'height')||{}).v;
    if(uw>0&&uh>0)return {t:'lin',r:uh/uw,x:H>uh?Math.round(H-uh):0};}
  const ifr=(raw.match(/<iframe\b[^>]*>/i)||[])[0];
  if(ifr){
    const w=attrNum(ifr,'width'),h=attrNum(ifr,'height');
    if(h&&!h.pct&&h.v>=40){if(w&&!w.pct&&w.v>0)return {t:'ratio',r:w.v/h.v};return {t:'fixed',h:Math.round(h.v)};}
  }
  let host='';try{host=new URL(u).hostname;}catch(e){}
  if(host==='open.spotify.com'&&/\/embed\//.test(u))return {t:'fixed',h:/\/embed\/(track|episode)\//.test(u)?232:352};
  if(host==='w.soundcloud.com')return {t:'fixed',h:166};
  if(/(^|\.)sketchfab\.com$/.test(host)&&/\/embed/.test(u))return {t:'ratio',r:4/3};
  if(host==='embed.podcasts.apple.com')return {t:'fixed',h:/[?&]i=/.test(u)?175:450};
  if(host==='player.vimeo.com'||host==='player.bilibili.com'||(host==='www.dailymotion.com'&&/\/embed\//.test(u)))return {t:'ratio',r:16/9};
  return {t:'page'};
}
/* 已知會拒絕被嵌入（X-Frame-Options／CSP frame-ancestors）的網站；路徑含 embed／preview／pub 的例外 */
const NO_FRAME=/(^|\.)(google\.[a-z.]+|facebook\.com|fb\.com|instagram\.com|threads\.net|x\.com|twitter\.com|linkedin\.com|github\.com|gitlab\.com|amazon\.[a-z.]+|reddit\.com|stackoverflow\.com|stackexchange\.com|medium\.com|apple\.com|openai\.com|chatgpt\.com|claude\.ai|notion\.so|paypal\.com|netflix\.com|discord\.com|tiktok\.com|zhihu\.com|weibo\.com|ebay\.[a-z.]+|dropbox\.com|zoom\.us|youtube\.com|figma\.com|canva\.com)$/i;
/* 官方嵌入網址一律放行：…/embed、/preview、/pub、Facebook 的 /plugins/…、embed.xxx 子網域（embed.reddit.com、embed.music.apple.com） */
const FRAME_OK=/\/(embed|preview|pub|pubhtml|plugins)(\/|\?|$)|[?&](embed|output=embed)/i;
function knownBlocked(u){try{const x=new URL(u);return NO_FRAME.test(x.hostname)&&!/^embed\./i.test(x.hostname)&&!FRAME_OK.test(x.pathname+x.search);}catch(e){return false;}}
/* emb：'no'＝手動標成墓碑、'yes'＝手動強制嵌入；blk＝伺服器檢查判定不能嵌入 */
function isTomb(o){return o.type==='web'&&(o.emb==='no'||(o.emb!=='yes'&&(o.blk||knownBlocked(o.url))));}
const GAP=18,BORDER=5;
/* 依寬度算出合身高度；k＝欄數（一般網頁 1 欄用 16:9，其餘 4:3） */
/* 會自己回報高度的卡（HTML 嵌入、Markdown）：內容再長，卡片也只長到這個上限，
   多出來的在卡片裡捲動，底部出現「展開全文」；展開後才用完整高度（只影響這位觀看者）。 */
function autoCap(w){return Math.max(420,Math.min(900,Math.round(w*1.25)));}
function fitH(o,w,k){
  const f=o.fit||{t:'page'};let h;
  if(f.t==='fixed')h=f.h+BORDER;
  else if(f.t==='ratio')h=Math.round((w-BORDER)/f.r)+BORDER;
  else if(f.t==='lin')h=Math.round((w-BORDER)*f.r+f.x)+BORDER;
  else if(f.t==='auto')h=o.mh?Math.min(o.mh,o.full?Infinity:autoCap(w))+BORDER:Math.round(Math.min(w*1.2,autoCap(w)));
  else h=Math.round(w*(k===1?0.5625:0.75));
  return Math.max(f.t==='page'?MIN:40,Math.min(MAX,h));
}
function sameOrigin(url){try{return new URL(url).origin===location.origin;}catch(e){return false;}}

/* 所有資料（localStorage、上傳 JSON、獨立牆）都必須經過這裡：只放行合法類型與 http(s) 網址 */
/* 貼進來的東西若只是「一層 srcdoc 外框」（例如從預覽複製出來的 iframe），拆掉外框只留裡面的內容。
   用 DOMParser 解析：它是惰性文件，不會載入圖片也不會觸發 onerror 之類的處理常式 */
function unwrapSrcdoc(h){
  const s=String(h||'').trim();
  if(!/^<iframe\b/i.test(s))return h;
  try{
    const d=new DOMParser().parseFromString(s,'text/html'),k=d.body.children;
    if(k.length!==1)return h;
    const f=k[0];
    if(f.tagName!=='IFRAME'||f.hasAttribute('src')||!f.hasAttribute('srcdoc'))return h;
    if(d.body.textContent.trim())return h;
    return f.getAttribute('srcdoc');
  }catch(e){return h;}
}

/* ==================== Markdown 卡 ====================
   <md> … </md> 包起來的一段文字。自寫的零依賴渲染器（GFM 子集）：
   標題、段落、粗斜體、刪除線、行內程式碼、程式碼區塊、引言、清單（含任務清單與巢狀）、
   表格、水平線、連結、圖片。原生 HTML 一律當文字顯示，所以來客的 MD 不可能夾帶 script。
   圖片只接受 https，連結只接受 http(s)。 */
const MD_W=420,MD_H=520,MD_MAX=60000;
const MD_RE=/^<md>[\s\S]*<\/md>$/i;
function mdInner(raw){return String(raw||'').trim().replace(/^<md>[ \t]*\r?\n?/i,'').replace(/\r?\n?[ \t]*<\/md>$/i,'');}
function mdTag(md){return '<md>\n'+md+'\n</md>';}
const MD_A=u=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">';
function mdInline(s){
  const keep=[],hold=h=>'\u0001'+(keep.push(h)-1)+'\u0002';
  s=String(s).replace(/[\u0001\u0002]/g,'');
  s=s.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g,(m,f,x)=>hold('<code>'+esc(x.trim())+'</code>'));
  s=s.replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g,(m,ch)=>hold(esc(ch)));
  s=s.replace(/!\[([^\]\n]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g,(m,a,u)=>{
    const x=/^https:\/\//i.test(u)?httpUrl(u):'';
    return x?hold('<img src="'+esc(x)+'" alt="'+esc(a)+'" loading="lazy">'):hold(esc(m));});
  s=s.replace(/\[([^\]\n]+)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g,(m,a,u)=>{
    const x=httpUrl(u);return x?hold(MD_A(x))+a+hold('</a>'):m;});
  s=s.replace(/<(https?:\/\/[^\s<>]+)>/g,(m,u)=>{const x=httpUrl(u);return x?hold(MD_A(x)+esc(u)+'</a>'):m;});
  s=s.replace(/(^|[\s(（])(https?:\/\/[^\s<>()（）]*[^\s<>()（）.,;:!?'"。，、！？])/g,(m,p,u)=>{const x=httpUrl(u);return x?p+hold(MD_A(x)+esc(u)+'</a>'):m;});
  s=esc(s)
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g,'$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g,'<em>$1</em>')
    .replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/g,'$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g,'<del>$1</del>')
    .replace(/(?: {2,}|\\)\n/g,'<br>');
  return s.replace(/\u0001(\d+)\u0002/g,(m,i)=>keep[+i]);
}
const MD_FENCE=/^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/,MD_HR=/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
      MD_HD=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/,MD_Q=/^ {0,3}>/,MD_LI=/^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,
      MD_SETEXT=/^ {0,3}(=+|-+)[ \t]*$/,MD_TSEP=/^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;
function mdBlockStart(l){return MD_FENCE.test(l)||MD_HD.test(l)||MD_Q.test(l)||MD_HR.test(l)||MD_LI.test(l);}
function mdCells(s){return s.trim().replace(/^\|/,'').replace(/(^|[^\\])\|$/,'$1').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));}
function mdRender(src,depth){
  depth=depth||0;if(depth>12)return '<p>'+esc(src)+'</p>';
  const L=String(src).replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n'),out=[],blank=s=>!s.trim();
  let i=0,m;
  while(i<L.length){
    const l=L[i];
    if(blank(l)){i++;continue;}
    if((m=l.match(MD_FENCE))){
      const f=m[1],buf=[];i++;
      while(i<L.length&&!(L[i].trim().startsWith(f[0].repeat(f.length))&&!L[i].trim().replace(/[`~]/g,''))){buf.push(L[i]);i++;}
      i++;out.push('<pre><code'+(m[2]?' class="lang-'+esc(m[2])+'"':'')+'>'+esc(buf.join('\n'))+'</code></pre>');continue;
    }
    if((m=l.match(MD_HD))){const n=m[1].length;out.push('<h'+n+'>'+mdInline(m[2]||'')+'</h'+n+'>');i++;continue;}
    if(MD_HR.test(l)){out.push('<hr>');i++;continue;}
    if(MD_Q.test(l)){
      const buf=[];
      while(i<L.length&&!blank(L[i])&&(MD_Q.test(L[i])||!mdBlockStart(L[i]))){buf.push(L[i].replace(/^ {0,3}> ?/,''));i++;}
      out.push('<blockquote>'+mdRender(buf.join('\n'),depth+1)+'</blockquote>');continue;
    }
    if(l.includes('|')&&i+1<L.length&&L[i+1].includes('-')&&MD_TSEP.test(L[i+1])){
      const al=mdCells(L[i+1]).map(x=>/^:-+:$/.test(x)?'center':/-:$/.test(x)?'right':/^:/.test(x)?'left':'');
      const cell=(tag,x,k)=>'<'+tag+(al[k]?' style="text-align:'+al[k]+'"':'')+'>'+mdInline(x)+'</'+tag+'>';
      let h='<table><thead><tr>'+mdCells(l).map((x,k)=>cell('th',x,k)).join('')+'</tr></thead><tbody>';
      i+=2;
      while(i<L.length&&!blank(L[i])&&L[i].includes('|')){h+='<tr>'+mdCells(L[i]).map((x,k)=>cell('td',x,k)).join('')+'</tr>';i++;}
      out.push('<div class="tw">'+h+'</tbody></table></div>');continue;
    }
    if((m=l.match(MD_LI))){
      const ord=/\d/.test(m[2]),base=m[1].length,items=[];let loose=false;
      while(i<L.length){
        const x=L[i],mm=x.match(MD_LI);
        if(mm&&mm[1].length<=base+1&&/\d/.test(mm[2])===ord){items.push({pad:mm[1].length+mm[2].length+1,lines:[mm[3]]});i++;continue;}
        if(mm&&mm[1].length<=base+1)break;
        const cur=items[items.length-1];
        if(blank(x)){
          const nx=L[i+1];
          if(nx!==undefined&&!blank(nx)&&(/^ /.test(nx)&&nx.match(/^ */)[0].length>base||(nx.match(MD_LI)&&nx.match(MD_LI)[1].length<=base+1))){cur.lines.push('');loose=true;i++;continue;}
          break;
        }
        const ind=x.match(/^ */)[0].length;
        if(ind>base||!mdBlockStart(x)){cur.lines.push(x.slice(Math.min(ind,cur.pad)));i++;continue;}
        break;
      }
      const start=ord?parseInt(m[2],10):1;
      out.push((ord?'<ol'+(start!==1?' start="'+start+'"':'')+'>':'<ul>')+items.map(it=>{
        let first=it.lines[0],task='';
        const tk=first.match(/^\[([ xX])\][ \t]+/);
        if(tk){task='<input type="checkbox" disabled'+(tk[1]===' '?'':' checked')+'> ';first=first.slice(tk[0].length);}
        let body=mdRender([first].concat(it.lines.slice(1)).join('\n'),depth+1);
        if(!loose)body=body.replace(/^<p>([\s\S]*?)<\/p>/,'$1');
        return '<li'+(task?' class="task"':'')+'>'+task+body+'</li>';
      }).join('')+(ord?'</ol>':'</ul>'));
      continue;
    }
    const buf=[l];i++;
    while(i<L.length&&!blank(L[i])&&!MD_SETEXT.test(L[i])&&!mdBlockStart(L[i])){buf.push(L[i]);i++;}
    if(i<L.length&&MD_SETEXT.test(L[i])){const n=L[i].trim()[0]==='='?1:2;out.push('<h'+n+'>'+mdInline(buf.join('\n'))+'</h'+n+'>');i++;continue;}
    out.push('<p>'+mdInline(buf.join('\n'))+'</p>');
  }
  return out.join('\n');
}
const MD_CSS="html{scrollbar-width:thin;scrollbar-color:#bbb transparent}html,body{margin:0;background:#fff}::-webkit-scrollbar{width:7px}::-webkit-scrollbar-thumb{background:#c9c5bd;border-radius:9px}body{padding:18px 20px 46px;color:#111;font:14px/1.7 -apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang TC\",\"Microsoft JhengHei\",\"Noto Sans TC\",\"Noto Sans\",sans-serif;overflow-wrap:anywhere}"
 +".md::before{content:\"\";float:left;width:40px;height:40px;margin:-18px 0 0 -20px;shape-outside:polygon(0 0,100% 0,0 100%)}"
 +".md>:first-child{margin-top:0}.md>:last-child{margin-bottom:0}h1,h2,h3,h4,h5,h6{line-height:1.3;margin:1.1em 0 .45em;font-weight:900}h1{font-size:1.6em}h2{font-size:1.32em}h3{font-size:1.12em}h4,h5,h6{font-size:1em}"
 +"p,ul,ol,blockquote,pre,.tw{margin:0 0 .8em}ul,ol{padding-left:1.4em}li+li{margin-top:.2em}li.task{list-style:none;margin-left:-1.3em}li.task input{margin:0 .4em 0 0;vertical-align:-1px;accent-color:#0E7C7B}"
 +"a{color:#0E7C7B;font-weight:700;text-decoration:underline;text-underline-offset:2px}img{max-width:100%;height:auto;border-radius:10px;display:block;margin:.4em 0}"
 +"code{font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#F2EFE9;border-radius:5px;padding:.1em .35em}pre{background:#111;color:#F7F5F1;border-radius:12px;padding:12px 14px;overflow:auto}pre code{background:none;padding:0;color:inherit}"
 +"blockquote{border-left:4px solid #FFE27A;background:#FFFBEA;padding:.5em .9em;border-radius:0 10px 10px 0}blockquote>:last-child{margin-bottom:0}hr{border:0;border-top:2px dashed #ccc;margin:1.2em 0}"
 +".tw{overflow-x:auto}table{border-collapse:collapse;min-width:60%;font-size:13px}th,td{border:1.5px solid #111;padding:5px 9px}th{background:#FFE27A;font-weight:900}tr:nth-child(even) td{background:#F7F5F1}del{opacity:.6}";
function mdDoc(md){
  return '<!doctype html><html><head><meta charset="utf-8">'
    +'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+MD_CSS+'</style></head>'
    +'<body><article class="md">'+mdRender(md)+'</article></body></html>';
}
function mdTitle(md){
  const h=String(md).match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t#]*$/m);
  const s=h?h[1]:(String(md).split('\n').find(x=>x.trim())||'');
  return s.replace(/[*_`~>#\[\]]|\(https?:[^)]*\)/g,'').trim().slice(0,80);
}

/* 「外包一層」的嵌入碼：只有一個 iframe，旁邊只有文字與連結（Sketchfab、Vimeo、Spotify 的署名段落）。
   當成 HTML 卡會被放進沒有 same-origin 的 sandbox，裡面的 iframe 繼承限制，
   WebGL 播放器（Sketchfab 等）因此載不起來。改成直接嵌入 iframe 的網址，原文照樣保留在 _raw。
   用 DOMParser 解析：惰性文件，不載入任何東西。 */
const SOLO_OK=/^(DIV|P|SPAN|A|B|STRONG|EM|I|U|BR|SMALL|IFRAME|FIGURE|FIGCAPTION|CENTER|SECTION|H[1-6])$/;
function soloIframe(h){
  const s=String(h||'').trim();
  if(!/^<[a-z]/i.test(s)||!/<iframe\b/i.test(s))return null;
  try{
    const d=new DOMParser().parseFromString(s,'text/html'),fs=d.querySelectorAll('iframe');
    if(fs.length!==1||d.head.children.length)return null;
    if([...d.body.querySelectorAll('*')].some(e=>!SOLO_OK.test(e.tagName)))return null;
    const f=fs[0],src=httpUrl((f.getAttribute('src')||'').trim());
    if(!src||f.hasAttribute('srcdoc'))return null;
    return {src,title:(f.getAttribute('title')||'').trim().slice(0,200)};
  }catch(e){return null;}
}
function normalize(o){
  if(!o||typeof o!=='object')return null;
  const raw=String(o._raw||o.html||o.url||'');
  const _id=/^[a-z0-9]{6,32}$/i.test(String(o._id||''))?o._id:uid();
  const extra={manual:!!o.manual,zone:(o.zone==='a'||o.zone==='c')?o.zone:'b'};
  const px=Number(o.px),py=Number(o.py);
  if(o.free&&Number.isFinite(px)&&Number.isFinite(py)&&px>=0&&py>=0&&px<20000&&py<200000){extra.free=true;extra.px=Math.round(px);extra.py=Math.round(py);}
  /* 篩選用的資料：at＝加入時間、pub＝發布時間、title／tags／dur（秒） */
  const at=Number(o.at);if(at>946684800000&&at<Date.now()+DAY)extra.at=at;
  const pub=Number(o.pub);if(pub>0&&pub<Date.now()+2*DAY)extra.pub=pub;
  if(typeof o.title==='string'&&o.title.trim())extra.title=o.title.trim().slice(0,200);
  let tg=o.tags;if(typeof tg==='string')tg=tg.split(',');
  if(Array.isArray(tg)){tg=tg.map(x=>String(x).trim().replace(/^#/,'').slice(0,40)).filter(Boolean).slice(0,20);if(tg.length)extra.tags=tg;}
  const du=Number(o.dur);if(du>0&&du<172800)extra.dur=Math.round(du);if(o.emb==='no'||o.emb==='yes')extra.emb=o.emb;if(o.blk===true)extra.blk=true;if(o.pic===true)extra.pic=true;const sp=Number(o.span),rh=Number(o.rh);
  if(Number.isInteger(sp)&&sp>=1&&sp<=8)extra.span=sp;if(rh>=0.3&&rh<=3)extra.rh=rh;const mh=Number(o.mh);if(mh>0&&mh<MAX)extra.mh=Math.round(mh);
  const done=r=>r?Object.assign(r,extra,{fit:fitOf(r)}):null;
  if(o.type==='youtube'){
    const id=/^[a-zA-Z0-9_-]{11}$/.test(String(o.id||''))?o.id:(String(o.embedSrc||o.url||raw).match(YT)||[])[1];
    return done(id?{_id,_raw:raw,type:'youtube',id,url:String(o.url||raw),w:size(o.w,STD_W),h:size(o.h,STD_H)}:null);
  }
  if(o.type==='model'){
    /* 兩種來源：d＝內嵌 data URI（版主上傳），u＝公開的 https 模型網址（來客也能用） */
    const m=o.mdl||{},d=String(m.d||''),u=/^https:\/\//i.test(String(m.u||''))?httpUrl(m.u):'',e=String(m.e||'').toLowerCase();
    const inl=/^data:[^,]{0,120},/.test(d);
    if(!M3D_OK.test(e)||!(inl||u))return null;
    const mdl=inl?{d,e,n:String(m.n||'').slice(0,120)}:{u,e,n:String(m.n||'').slice(0,120)};
    const r=done({_id,_raw:raw&&(raw.charAt(0)==='<'||mdl.u)?raw:modelTag(mdl),type:'model',mdl,
      html:modelDoc(mdl),w:size(o.w,MODEL_W),h:size(o.h,MODEL_H)});
    /* 存檔時不要把組好的 srcdoc 一起寫進去，只留模型資料本身 */
    if(r)Object.defineProperty(r,'toJSON',{value:function(){
      const c=Object.assign({},this);delete c.html;delete c.fit;return c;}});
    return r;
  }
  if(o.type==='md'){
    const md=typeof o.md==='string'?o.md:mdInner(raw);
    if(!md.trim()||md.length>MD_MAX)return null;
    const r=done({_id,_raw:MD_RE.test(raw.trim())?raw.trim():mdTag(md),type:'md',md,html:mdDoc(md),w:size(o.w,MD_W),h:size(o.h,MD_H)});
    if(r)Object.defineProperty(r,'toJSON',{value:function(){
      const c=Object.assign({},this);delete c.html;delete c.fit;delete c.md;return c;}});
    return r;
  }
  if(o.type==='html'){
    const html=unwrapSrcdoc(o.html||raw);
    const solo=soloIframe(html);
    if(solo){
      const base=Object.assign({},o,{_id,_raw:raw||html,html:undefined});
      if(!base.title&&solo.title)base.title=solo.title;
      const yt=solo.src.match(YT);
      return normalize(yt?Object.assign(base,{type:'youtube',id:yt[1],url:solo.src}):Object.assign(base,{type:'web',url:solo.src}));
    }
    return done(html.trim()?{_id,_raw:raw||html,type:'html',html,w:size(o.w,HTML_W),h:size(o.h,HTML_H)}:null);
  }
  const url=toEmbed(httpUrl(o.url||raw));
  return done(url?{_id,_raw:raw||url,type:'web',url,w:size(o.w,STD_W),h:size(o.h,STD_H)}:null);
}

function fitPluginUrl(u,w){
  try{const x=new URL(u);
    if(!w||!/(^|\.)facebook\.com$/.test(x.hostname)||!/^\/plugins\//.test(x.pathname))return u;
    const ow=+x.searchParams.get('width'),oh=+x.searchParams.get('height');
    x.searchParams.set('width',Math.round(w));if(ow>0&&oh>0)x.searchParams.set('height',Math.round(oh*w/ow));
    return x.href;
  }catch(e){return u;}
}
function frameHTML(o,w){
  if(o.type==='youtube')return `<iframe class="embed" src="https://www.youtube-nocookie.com/embed/${esc(o.id)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  /* 使用者貼的 HTML：不給 allow-same-origin，讀不到主頁的 localStorage 與 DOM */
  if(o.type==='html')return `<iframe class="html-frame" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation" loading="lazy"></iframe>`;
  /* 3D 檢視器只需要跑 script，不給彈窗、不給同源 */
  if(o.type==='model')return `<iframe class="html-frame m3d" sandbox="allow-scripts" loading="lazy"></iframe>`;
  /* Markdown：內容全部跳脫過，script 只給量高度用；連結可以開新分頁 */
  if(o.type==='md')return `<iframe class="html-frame md" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy"></iframe>`;
  /* 同網域網頁不能同時給 scripts + same-origin，否則可自行拆掉 sandbox */
  const sb=sameOrigin(o.url)?'allow-scripts allow-popups allow-forms':'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation';
  const cls=o.fit&&o.fit.t!=='page'?' class="embed"':'';
  return `<iframe${cls} src="${esc(fitPluginUrl(o.url,w))}" sandbox="${sb}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; xr-spatial-tracking; accelerometer; gyroscope; web-share" allowfullscreen></iframe>`;
}

const TOMB_SVG='<svg class="tomb-img" viewBox="0 0 120 104" aria-hidden="true">'
 +'<ellipse cx="60" cy="98" rx="54" ry="6" fill="#0A7A34" opacity=".22"/>'
 +'<path d="M30 97V44a30 30 0 0 1 60 0v53z" fill="#D6D2CA" stroke="#111" stroke-width="3" stroke-linejoin="round"/>'
 +'<path d="M38 94V46a22 22 0 0 1 22-22" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>'
 +'<text x="60" y="56" text-anchor="middle" font-size="15" font-weight="900" fill="#111" opacity=".72" font-family="Georgia,serif">R.I.P.</text>'
 +'<path d="M46 67h28M50 76h20" stroke="#111" stroke-width="2.5" stroke-linecap="round" opacity=".3"/>'
 +'<path d="M81 27l-6 9 5 5-5 8" fill="none" stroke="#111" stroke-width="2" stroke-linejoin="round" opacity=".45"/>'
 +'<path d="M20 98h80" stroke="#111" stroke-width="3" stroke-linecap="round"/>'
 +'<path d="M14 98l4-9 3 9 3-11 3 11 3-8 2 8zM88 98l3-8 3 8 3-11 3 11 4-9 3 9z" fill="#0A7A34" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>'
 +'<path d="M36 97v-10" stroke="#0A7A34" stroke-width="2.5" stroke-linecap="round"/><circle cx="36" cy="85" r="4.5" fill="#FFE27A" stroke="#111" stroke-width="1.5"/>'
 +'</svg>';
function hostOf(u){try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return '';}}
function tombHTML(o){
  return '<div class="tomb-body">'+TOMB_SVG+'<div class="tomb-label">Non-Embeddable</div>'
    +'<div class="tomb-host">'+esc(hostOf(o.url))+'</div><div class="tomb-note" data-i18n="tombNote">'+esc(t('tombNote'))+'</div>'
    +'<a class="tomb-link" href="'+esc(o.url)+'" target="_blank" rel="noopener noreferrer"><span data-i18n="openTab">'+esc(t('openTab'))+'</span><span aria-hidden="true">↗</span></a></div>';
}
/* 左上三角：主人卡 WiKi（黃）／來客卡 Co-WiKi（青）。
   來客卡待審時是淺色虛線，版主認可後變成實心實線，但保留 Co-WiKi 的來源標記。 */
function cornerHTML(o){
  const co=!!o.guest,cls=co?'co '+(o.ok?'ok':'pend'):'own';
  return '<div class="corner '+cls+'" aria-hidden="true"><svg viewBox="0 0 52 52"><path class="c-fill" d="M0 0H52L0 52Z"/><path class="c-edge" d="M52 0L0 52"/></svg><span class="c-lbl">'+(co?'Co-WiKi':'WiKi')+'</span></div>';
}
function cardHTML(o,ro){
  const tomb=isTomb(o);
  const isOwner = (typeof window !== 'undefined' && window.isOwner) ? true : false;
  const tog=!ro&&o.type==='web'?'<button class="tog" data-act="emb" data-i18n-aria="'+(tomb?'tryEmbed':'markTomb')+'" aria-label="'+esc(t(tomb?'tryEmbed':'markTomb'))+'" title="'+esc(t(tomb?'tryEmbed':'markTomb'))+'">'+(tomb?'↻':'🪦')+'</button>':'';
  /* 插卡鍵：版主與訪客都有。訪客自己插的卡只有牆主能移除。 */
  const ins='<button class="ins" data-act="ins" title="'+esc(t('insCard'))+'" aria-label="'+esc(t('insCard'))+'" data-i18n-aria="insCard">\uFF0B</button>'
    +(isOwner&&ro&&o.guest&&!o.ok?'<button class="gdel" data-act="gdel" title="'+esc(t('insDel'))+'" aria-label="'+esc(t('insDel'))+'" data-i18n-aria="insDel">\u2715</button>':'');
  /* 調整大小的把手：訪客也有；搬移、刪除、編輯仍然只有版主 */
  const grips='<div class="side-anchor"></div><div class="resize-anchor"></div>';
  const fold=o.fit&&o.fit.t==='auto'?'<div class="fold"><button type="button" class="fold-btn" data-i18n="foldMore">'+esc(t('foldMore'))+'</button></div>':'';
  const delBtn=isOwner?'<button class="del" data-act="del" aria-label="'+esc(t('del'))+'">✕</button>':'';
  const tools=ins+(ro?grips:tog+delBtn+'<button class="edit" data-act="edit" aria-label="'+esc(t('edit'))+'">✎</button><div class="move-anchor" title="'+esc(t('moveCard'))+'"></div>'+grips);
  return `<div class="item${tomb?' tomb':''}${o.guest?' guest '+(o.ok?'ok':'pending'):''}" data-id="${esc(o._id)}" style="width:${o.w}px;height:${o.h}px">${cornerHTML(o)}${ro?'':'<div class="corner-dim">'+o.w+'×'+o.h+'</div>'}${tomb?tombHTML(o):(LAZY?phHTML(o):frameHTML(o))}${fold}${tools}</div>`;
}

/* ==================== 3D 模型卡 ====================
   支援三種最通用的格式：glTF（.glb／.gltf）、STL（二進位與 ASCII）、OBJ。
   檔案以 base64 data URI 內嵌，卡片裡是一個 sandbox iframe，
   內含一支不依賴任何函式庫、也不連外網的 WebGL 檢視器。
   模型資料只存 mdl{d,e,n}，srcdoc 在載入時才組出來，所以
   localStorage 與獨立牆匯出都不會被重複的檢視器程式碼灌大。 */
const M3D_EXT=/\.(glb|gltf|stl|obj)$/i;
const M3D_MIME={glb:'model/gltf-binary',gltf:'model/gltf+json',stl:'model/stl',obj:'model/obj'};
const M3D_OK=/^(glb|gltf|stl|obj)$/;
const M3D_CSS="html,body{margin:0;height:100%;background:transparent;font:13px/1.5 -apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang TC\",\"Noto Sans\",sans-serif}#w{position:relative;width:100%;height:100vh;background:radial-gradient(120% 120% at 50% 0%,#ffffff 0%,#EAE7E1 100%)}canvas{width:100%;height:100%;display:block;cursor:grab;touch-action:none}#n{display:none;position:absolute;inset:0;padding:22px;align-items:center;justify-content:center;text-align:center;font-weight:700;color:#666}#b{display:none;position:absolute;right:9px;bottom:9px;background:rgba(17,17,17,.82);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;letter-spacing:.05em}";
const VIEWER3D="/* ============================================================\n   Tiny self-contained 3D card viewer.\n   Formats: glTF (.glb / .gltf), STL (binary + ASCII), OBJ.\n   Raw WebGL, no libraries, no network. Runs inside the card's\n   sandboxed iframe; the model arrives as a base64 data URI.\n   ============================================================ */\n(function(){\nvar C=document.getElementById('c'),NOTE=document.getElementById('n'),BADGE=document.getElementById('b');\nvar SRC=C.getAttribute('data-src'),EXT=(C.getAttribute('data-ext')||'').toLowerCase();\nfunction say(m){NOTE.textContent=m;NOTE.style.display='flex';}\n\n/* ---------- data URI -> ArrayBuffer ---------- */\nfunction toBuf(u){\n  var b=u.indexOf(',')+1,s=u.slice(b);\n  if(/;base64/i.test(u.slice(0,b))){\n    var bin=atob(s),n=bin.length,a=new Uint8Array(n);\n    for(var i=0;i<n;i++)a[i]=bin.charCodeAt(i);\n    return a.buffer;\n  }\n  return new TextEncoder().encode(decodeURIComponent(s)).buffer;\n}\nvar td=new TextDecoder();\n\n/* ================= mat4 (column-major) ================= */\nfunction mIdent(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}\nfunction mMul(a,b){\n  var o=new Float32Array(16);\n  for(var c=0;c<4;c++)for(var r=0;r<4;r++){\n    var s=0;for(var k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];\n    o[c*4+r]=s;\n  }\n  return o;\n}\nfunction mTRS(t,q,s){\n  var x=q[0],y=q[1],z=q[2],w=q[3];\n  var x2=x+x,y2=y+y,z2=z+z;\n  var xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;\n  return new Float32Array([\n    (1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,\n    (xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,\n    (xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,\n    t[0],t[1],t[2],1]);\n}\nfunction mPersp(f,a,n,fr){\n  var t=1/Math.tan(f/2),d=1/(n-fr);\n  return new Float32Array([t/a,0,0,0, 0,t,0,0, 0,0,(fr+n)*d,-1, 0,0,2*fr*n*d,0]);\n}\nfunction mLook(e,c,u){\n  var z=norm([e[0]-c[0],e[1]-c[1],e[2]-c[2]]),x=norm(cross(u,z)),y=cross(z,x);\n  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,\n    -dot(x,e),-dot(y,e),-dot(z,e),1]);\n}\nfunction cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}\nfunction dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}\nfunction norm(a){var l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}\n/* upper-left 3x3 inverse-transpose, for normals under non-uniform scale */\nfunction mNormal(m){\n  var a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];\n  var A=e*i-f*h,B=f*g-d*i,Cc=d*h-e*g,det=a*A+b*B+c*Cc;\n  if(!det)return new Float32Array([1,0,0,0,1,0,0,0,1]);\n  var id=1/det;\n  return new Float32Array([A*id,B*id,Cc*id,\n    (c*h-b*i)*id,(a*i-c*g)*id,(b*g-a*h)*id,\n    (b*f-c*e)*id,(c*d-a*f)*id,(a*e-b*d)*id]);\n}\n\n/* ================= flat-shaded normals ================= */\nfunction faceNormals(pos){\n  var n=new Float32Array(pos.length);\n  for(var i=0;i<pos.length;i+=9){\n    var ax=pos[i+3]-pos[i],ay=pos[i+4]-pos[i+1],az=pos[i+5]-pos[i+2];\n    var bx=pos[i+6]-pos[i],by=pos[i+7]-pos[i+1],bz=pos[i+8]-pos[i+2];\n    var v=norm([ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx]);\n    for(var k=0;k<3;k++){n[i+k*3]=v[0];n[i+k*3+1]=v[1];n[i+k*3+2]=v[2];}\n  }\n  return n;\n}\n\n/* ================= STL ================= */\nfunction parseSTL(buf){\n  var u8=new Uint8Array(buf);\n  /* ASCII if it starts with \"solid\" and has no plausible binary triangle count */\n  var head=td.decode(u8.subarray(0,Math.min(84,u8.length)));\n  var isAscii=/^\\s*solid/i.test(head);\n  if(isAscii&&u8.length>84){\n    var dv0=new DataView(buf),tri=dv0.getUint32(80,true);\n    if(84+tri*50===u8.length)isAscii=false;\n  }\n  if(isAscii){\n    var txt=td.decode(u8),pos=[],m,re=/vertex\\s+(-?[\\d.eE+-]+)\\s+(-?[\\d.eE+-]+)\\s+(-?[\\d.eE+-]+)/g;\n    while((m=re.exec(txt)))pos.push(+m[1],+m[2],+m[3]);\n    var p=new Float32Array(pos);\n    return [{pos:p,nrm:faceNormals(p),color:[.62,.66,.72]}];\n  }\n  var dv=new DataView(buf),n=dv.getUint32(80,true);\n  if(84+n*50>buf.byteLength)n=Math.floor((buf.byteLength-84)/50);\n  var P=new Float32Array(n*9),N=new Float32Array(n*9),o=84;\n  for(var i=0;i<n;i++){\n    var nx=dv.getFloat32(o,true),ny=dv.getFloat32(o+4,true),nz=dv.getFloat32(o+8,true);o+=12;\n    for(var v=0;v<3;v++){\n      var k=i*9+v*3;\n      P[k]=dv.getFloat32(o,true);P[k+1]=dv.getFloat32(o+4,true);P[k+2]=dv.getFloat32(o+8,true);o+=12;\n      N[k]=nx;N[k+1]=ny;N[k+2]=nz;\n    }\n    o+=2;\n  }\n  if(!N.some(function(x){return x;}))N=faceNormals(P);\n  return [{pos:P,nrm:N,color:[.62,.66,.72]}];\n}\n\n/* ================= OBJ ================= */\nfunction parseOBJ(buf){\n  var lines=td.decode(new Uint8Array(buf)).split(/\\r?\\n/);\n  var V=[],VN=[],P=[],N=[];\n  function idx(s,len){var i=parseInt(s,10);return i<0?len+i:i-1;}\n  for(var L=0;L<lines.length;L++){\n    var t=lines[L].trim();\n    if(!t||t.charCodeAt(0)===35)continue;\n    var p=t.split(/\\s+/),k=p[0];\n    if(k==='v')V.push([+p[1],+p[2],+p[3]]);\n    else if(k==='vn')VN.push([+p[1],+p[2],+p[3]]);\n    else if(k==='f'){\n      var f=[];\n      for(var i=1;i<p.length;i++){\n        var s=p[i].split('/');\n        f.push([idx(s[0],V.length),s[2]?idx(s[2],VN.length):-1]);\n      }\n      /* fan-triangulate any polygon */\n      for(var j=1;j+1<f.length;j++){\n        var tri=[f[0],f[j],f[j+1]];\n        for(var q=0;q<3;q++){\n          var vv=V[tri[q][0]];if(!vv)continue;\n          P.push(vv[0],vv[1],vv[2]);\n          var nn=tri[q][1]>=0?VN[tri[q][1]]:null;\n          N.push(nn?nn[0]:0,nn?nn[1]:0,nn?nn[2]:0);\n        }\n      }\n    }\n  }\n  var pos=new Float32Array(P),nrm=new Float32Array(N);\n  if(!nrm.some(function(x){return x;}))nrm=faceNormals(pos);\n  return [{pos:pos,nrm:nrm,color:[.70,.72,.76]}];\n}\n\n/* ================= glTF / GLB ================= */\nvar CSZ={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},\n    NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},\n    CA={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};\n\nfunction parseGLB(buf){\n  var dv=new DataView(buf);\n  if(dv.getUint32(0,true)!==0x46546C67)throw new Error('not a GLB');\n  var len=dv.getUint32(8,true),o=12,json=null,bin=null;\n  while(o+8<=len&&o+8<=buf.byteLength){\n    var cl=dv.getUint32(o,true),ct=dv.getUint32(o+4,true);o+=8;\n    if(ct===0x4E4F534A)json=JSON.parse(td.decode(new Uint8Array(buf,o,cl)));\n    else if(ct===0x004E4942)bin=buf.slice(o,o+cl);\n    o+=cl+((4-cl%4)%4===4?0:0);\n    o+=(4-(cl%4))%4;\n  }\n  if(!json)throw new Error('GLB has no JSON chunk');\n  return buildGLTF(json,bin);\n}\nfunction parseGLTF(buf){\n  var j=JSON.parse(td.decode(new Uint8Array(buf)));\n  return buildGLTF(j,null);\n}\n\nfunction buildGLTF(j,bin){\n  if(j.extensionsRequired&&j.extensionsRequired.some(function(x){return /draco|meshopt/i.test(x);}))\n    throw new Error('compressed');\n  /* buffers: GLB chunk, or embedded data URIs (external .bin cannot be fetched) */\n  var bufs=(j.buffers||[]).map(function(b,i){\n    if(b.uri==null)return bin;\n    if(/^data:/i.test(b.uri))return toBuf(b.uri);\n    throw new Error('external');\n  });\n  function view(i){\n    var v=j.bufferViews[i],b=bufs[v.buffer];\n    if(!b)throw new Error('external');\n    return {buf:b,off:v.byteOffset||0,len:v.byteLength,stride:v.byteStride||0};\n  }\n  function acc(i){\n    if(i==null)return null;\n    var a=j.accessors[i],nc=NC[a.type]||1,cs=CSZ[a.componentType],Ctor=CA[a.componentType];\n    var out=new Float32Array(a.count*nc);\n    if(a.bufferView==null)return out;\n    var v=view(a.bufferView),base=v.off+(a.byteOffset||0),stride=v.stride||nc*cs;\n    for(var e=0;e<a.count;e++){\n      var t=new Ctor(v.buf,base+e*stride,nc);\n      for(var c=0;c<nc;c++)out[e*nc+c]=t[c];\n    }\n    return out;\n  }\n  function accInt(i){\n    if(i==null)return null;\n    var a=j.accessors[i],cs=CSZ[a.componentType],Ctor=CA[a.componentType];\n    if(a.bufferView==null)return null;\n    var v=view(a.bufferView),base=v.off+(a.byteOffset||0),stride=v.stride||cs;\n    var out=new Uint32Array(a.count);\n    for(var e=0;e<a.count;e++)out[e]=new Ctor(v.buf,base+e*stride,1)[0];\n    return out;\n  }\n  function matColor(mi){\n    if(mi==null||!j.materials||!j.materials[mi])return [.78,.78,.80];\n    var m=j.materials[mi],p=m.pbrMetallicRoughness||{},f=p.baseColorFactor;\n    return f?[f[0],f[1],f[2]]:[.78,.78,.80];\n  }\n  var parts=[];\n  function node(ni,parent){\n    var n=j.nodes[ni];if(!n)return;\n    var local=n.matrix?new Float32Array(n.matrix)\n      :mTRS(n.translation||[0,0,0],n.rotation||[0,0,0,1],n.scale||[1,1,1]);\n    var world=mMul(parent,local);\n    if(n.mesh!=null&&j.meshes[n.mesh]){\n      (j.meshes[n.mesh].primitives||[]).forEach(function(pr){\n        if(pr.mode!=null&&pr.mode!==4)return;               /* triangles only */\n        var P=acc(pr.attributes&&pr.attributes.POSITION);if(!P||!P.length)return;\n        var N=acc(pr.attributes&&pr.attributes.NORMAL);\n        var I=accInt(pr.indices);\n        var pos,nrm;\n        if(I){\n          pos=new Float32Array(I.length*3);\n          nrm=N?new Float32Array(I.length*3):null;\n          for(var k=0;k<I.length;k++){\n            var s=I[k]*3,d=k*3;\n            pos[d]=P[s];pos[d+1]=P[s+1];pos[d+2]=P[s+2];\n            if(nrm){nrm[d]=N[s];nrm[d+1]=N[s+1];nrm[d+2]=N[s+2];}\n          }\n        }else{pos=P;nrm=N;}\n        if(!nrm)nrm=faceNormals(pos);\n        parts.push({pos:pos,nrm:nrm,color:matColor(pr.material),mat:world,nmat:mNormal(world)});\n      });\n    }\n    (n.children||[]).forEach(function(c){node(c,world);});\n  }\n  var scene=j.scenes&&j.scenes[j.scene||0];\n  var roots=scene&&scene.nodes?scene.nodes:(j.nodes||[]).map(function(_,i){return i;});\n  roots.forEach(function(r){node(r,mIdent());});\n  if(!parts.length)throw new Error('empty');\n  return parts;\n}\n\n/* ================= load + render ================= */\nfunction start(buf){\nvar parts;\ntry{\n  parts=EXT==='glb'?parseGLB(buf):EXT==='gltf'?parseGLTF(buf):EXT==='stl'?parseSTL(buf):parseOBJ(buf);\n}catch(e){\n  var m=String(e&&e.message||e);\n  say(m==='compressed'?'This glTF uses Draco/meshopt compression, which this viewer cannot unpack.'\n    :m==='external'?'This .gltf refers to a separate .bin file. Use a .glb instead — it bundles everything.'\n    :'Could not read this model file.');\n  return;\n}\nvar tris=0;parts.forEach(function(p){tris+=p.pos.length/9;});\nif(!tris){say('This model has no triangles to draw.');return;}\n\n/* bounds in world space */\nvar lo=[1e30,1e30,1e30],hi=[-1e30,-1e30,-1e30];\nparts.forEach(function(p){\n  var m=p.mat;\n  for(var i=0;i<p.pos.length;i+=3){\n    var x=p.pos[i],y=p.pos[i+1],z=p.pos[i+2],X,Y,Z;\n    if(m){X=m[0]*x+m[4]*y+m[8]*z+m[12];Y=m[1]*x+m[5]*y+m[9]*z+m[13];Z=m[2]*x+m[6]*y+m[10]*z+m[14];}\n    else{X=x;Y=y;Z=z;}\n    if(X<lo[0])lo[0]=X;if(Y<lo[1])lo[1]=Y;if(Z<lo[2])lo[2]=Z;\n    if(X>hi[0])hi[0]=X;if(Y>hi[1])hi[1]=Y;if(Z>hi[2])hi[2]=Z;\n  }\n});\nvar ctr=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];\nvar rad=Math.max(1e-4,Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2);\n\nvar gl=C.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:false})\n     ||C.getContext('experimental-webgl');\nif(!gl){say('WebGL is not available in this browser.');return;}\n\nvar VS='attribute vec3 p;attribute vec3 n;uniform mat4 mvp;uniform mat4 mdl;uniform mat3 nm;'\n      +'varying vec3 vn;varying vec3 vp;'\n      +'void main(){vn=normalize(nm*n);vec4 w=mdl*vec4(p,1.0);vp=w.xyz;gl_Position=mvp*vec4(p,1.0);}';\nvar FS='precision mediump float;varying vec3 vn;varying vec3 vp;uniform vec3 col;uniform vec3 eye;'\n      +'void main(){vec3 N=normalize(vn);if(!gl_FrontFacing)N=-N;'\n      +'vec3 V=normalize(eye-vp);'\n      +'vec3 L1=normalize(vec3(0.45,0.80,0.60)),L2=normalize(vec3(-0.6,0.25,-0.5));'\n      +'float d=max(dot(N,L1),0.0)*0.85+max(dot(N,L2),0.0)*0.28;'\n      +'float rim=pow(1.0-max(dot(N,V),0.0),2.5)*0.22;'\n      +'vec3 H=normalize(L1+V);float s=pow(max(dot(N,H),0.0),34.0)*0.30;'\n      +'vec3 c=col*(0.26+d)+vec3(s)+vec3(0.06,0.09,0.10)*rim;'\n      +'gl_FragColor=vec4(pow(clamp(c,0.0,1.0),vec3(0.4545)),1.0);}';\nfunction sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}\nvar pg=gl.createProgram();\ngl.attachShader(pg,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pg,sh(gl.FRAGMENT_SHADER,FS));\ngl.bindAttribLocation(pg,0,'p');gl.bindAttribLocation(pg,1,'n');\ngl.linkProgram(pg);\nif(!gl.getProgramParameter(pg,gl.LINK_STATUS)){say('WebGL shader failed to build.');return;}\ngl.useProgram(pg);\nvar U={mvp:gl.getUniformLocation(pg,'mvp'),mdl:gl.getUniformLocation(pg,'mdl'),\n       nm:gl.getUniformLocation(pg,'nm'),col:gl.getUniformLocation(pg,'col'),\n       eye:gl.getUniformLocation(pg,'eye')};\n\nparts.forEach(function(p){\n  p.vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p.vb);gl.bufferData(gl.ARRAY_BUFFER,p.pos,gl.STATIC_DRAW);\n  p.nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p.nb);gl.bufferData(gl.ARRAY_BUFFER,p.nrm,gl.STATIC_DRAW);\n  p.count=p.pos.length/3;\n  p.mat=p.mat||mIdent();p.nmat=p.nmat||mNormal(p.mat);\n});\ngl.enable(gl.DEPTH_TEST);gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);\n\n/* camera: yaw / pitch / distance around the model centre */\nvar yaw=0.7,pitch=0.38,dist=rad*2.7,spin=true,W=0,H=0;\nfunction resize(){\n  var dpr=Math.min(window.devicePixelRatio||1,2);\n  var w=C.clientWidth||300,h=C.clientHeight||220;\n  if(w===W&&h===H)return;\n  W=w;H=h;C.width=Math.round(w*dpr);C.height=Math.round(h*dpr);\n  gl.viewport(0,0,C.width,C.height);\n}\nfunction draw(){\n  resize();\n  if(spin)yaw+=0.0042;\n  var cp=Math.cos(pitch),eye=[ctr[0]+dist*Math.sin(yaw)*cp,ctr[1]+dist*Math.sin(pitch),ctr[2]+dist*Math.cos(yaw)*cp];\n  var vp=mMul(mPersp(0.82,(C.width/C.height)||1,rad*0.02,rad*40),mLook(eye,ctr,[0,1,0]));\n  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n  gl.uniform3fv(U.eye,eye);\n  for(var i=0;i<parts.length;i++){\n    var p=parts[i];\n    gl.uniformMatrix4fv(U.mvp,false,mMul(vp,p.mat));\n    gl.uniformMatrix4fv(U.mdl,false,p.mat);\n    gl.uniformMatrix3fv(U.nm,false,p.nmat);\n    gl.uniform3fv(U.col,p.color);\n    gl.bindBuffer(gl.ARRAY_BUFFER,p.vb);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);\n    gl.bindBuffer(gl.ARRAY_BUFFER,p.nb);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);\n    gl.drawArrays(gl.TRIANGLES,0,p.count);\n  }\n  raf=requestAnimationFrame(draw);\n}\nvar raf=requestAnimationFrame(draw);\n/* stop drawing while the card is off screen or the tab is hidden */\nfunction pause(){if(raf){cancelAnimationFrame(raf);raf=0;}}\nfunction resume(){if(!raf)raf=requestAnimationFrame(draw);}\ndocument.addEventListener('visibilitychange',function(){document.hidden?pause():resume();});\nif(window.IntersectionObserver)new IntersectionObserver(function(es){\n  es[0].isIntersecting?resume():pause();\n}).observe(C);\n\n/* ---------- orbit / zoom ---------- */\nvar drag=false,lx=0,ly=0;\nC.addEventListener('pointerdown',function(e){\n  drag=true;spin=false;lx=e.clientX;ly=e.clientY;C.setPointerCapture(e.pointerId);C.style.cursor='grabbing';\n});\nC.addEventListener('pointermove',function(e){\n  if(!drag)return;\n  yaw-=(e.clientX-lx)*0.0095;\n  pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-ly)*0.0095));\n  lx=e.clientX;ly=e.clientY;\n});\n['pointerup','pointercancel'].forEach(function(k){\n  C.addEventListener(k,function(){drag=false;C.style.cursor='grab';});\n});\nC.addEventListener('wheel',function(e){\n  e.preventDefault();\n  dist=Math.max(rad*1.15,Math.min(rad*14,dist*(1+(e.deltaY>0?0.12:-0.12))));\n},{passive:false});\nC.addEventListener('dblclick',function(){yaw=0.7;pitch=0.38;dist=rad*2.7;spin=true;});\nBADGE.textContent=EXT.toUpperCase()+' · '+tris.toLocaleString()+' tri';\nBADGE.style.display='block';\n}\n/* https 模型：用 fetch 取回（對方主機必須送 Access-Control-Allow-Origin），上限 40 MB */\nif(/^https:/i.test(SRC)){\n  say('Loading 3D model\\u2026');\n  fetch(SRC,{credentials:'omit'}).then(function(r){\n    if(!r.ok)throw new Error('http');\n    var n=+(r.headers.get('content-length')||0);if(n>41943040)throw new Error('big');\n    return r.arrayBuffer();\n  }).then(function(b){\n    if(b.byteLength>41943040)throw new Error('big');\n    NOTE.style.display='none';start(b);\n  }).catch(function(e){\n    say(e&&e.message==='big'?'This model is larger than 40 MB.':'Could not download this model. Its host must allow cross-origin (CORS) access.');\n  });\n}else start(toBuf(SRC));\n})();\n";
/* 一張 3D 卡的完整文件 */
function modelDoc(m){
  return '<!doctype html><html><head><meta charset="utf-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+M3D_CSS+'</style></head>'
    +'<body><div id="w"><canvas id="c" data-ext="'+esc(m.e)+'" data-src="'+esc(m.d||m.u)+'"></canvas>'
    +'<div id="n"></div><div id="b"></div></div><script>'+VIEWER3D+'<\/script></body></html>';
}
/* EzSheet 裡的可讀表示法，貼回去也還原得回來 */
function modelTag(m){
  return '<model type="'+esc(m.e)+'" name="'+esc(m.n||'')+'" src="'+esc(m.d||m.u)+'"></model>';
}
/* <model …> 標籤 -> mdl 物件 */
function parseModelTag(s){
  const g=k=>((s.match(new RegExp('\\b'+k+'=["\']([^"\']*)["\']','i'))||[])[1]||'');
  const d=g('src').replace(/&amp;/g,'&'),e=g('type').toLowerCase()||(d.match(/^data:model\/(gltf-binary|gltf\+json|stl|obj)/i)||[])[1]||'';
  let ex=e==='gltf-binary'?'glb':e==='gltf+json'?'gltf':e;
  if(/^https:\/\//i.test(d)){
    const u=httpUrl(d);if(!u)return null;
    if(!ex)ex=modelExt(new URL(u).pathname);
    return M3D_OK.test(ex)?{u,e:ex,n:g('name')||decodeURIComponent(new URL(u).pathname.split('/').pop()||'')}:null;
  }
  return M3D_OK.test(ex)&&/^data:[^,]{0,120},/.test(d)?{d,e:ex,n:g('name')}:null;
}
const isModelFile=f=>M3D_EXT.test(f&&f.name||'');
const modelExt=name=>String(name||'').toLowerCase().replace(/^.*\./,'');

/* ==================== 插卡 ====================
   每張卡左下角一個「＋」：在這張卡前面插入一張新的。
   編輯器裡是版主在編自己的牆；獨立牆裡開放給任何訪客，
   但訪客插的卡只寫進他自己瀏覽器的 localStorage，不會influence別人。 */

/* 把一段貼上的內容變成一張卡；看不懂就回 null。
   編輯器的 makeItem 與插卡對話框共用這一份，判斷標準永遠一致。 */
function parseOne(raw){
  raw=String(raw||'').trim();if(!raw)return null;
  if(MD_RE.test(raw))return normalize({_raw:raw,type:'md'});
  if(raw.startsWith('<')){
    if(/^<model\b/i.test(raw)){const m=parseModelTag(raw);if(m)return normalize({_raw:raw,type:'model',mdl:m});}
    const src=((raw.match(/\bsrc=["']([^"']+)["']/i)||[])[1]||'').replace(/&amp;/g,'&');
    const yt=src.match(YT);
    if(yt)return normalize({_raw:raw,type:'youtube',id:yt[1],url:src});
    if(/^<iframe\b[^>]*>\s*<\/iframe>$/i.test(raw)){const u=httpUrl(src);if(u)return normalize({_raw:raw,type:'web',url:u});}
    return normalize({_raw:raw,type:'html',html:raw});
  }
  const yt=raw.match(YT);if(yt)return normalize({_raw:raw,type:'youtube',id:yt[1],url:raw});
  let s=raw;
  if(!/^https?:\/\//i.test(s)){
    if(/\s/.test(s)||!/^[^\/\s]+\.[a-z]{2,}(\/|:|\?|$)/i.test(s))return null;
    s='https://'+s;
  }
  const u=httpUrl(s);if(!u)return null;
  /* 直接指向 .glb／.gltf／.stl／.obj 的 https 網址 → 3D 卡（對方主機要允許 CORS） */
  try{const x=new URL(u);if(x.protocol==='https:'&&M3D_EXT.test(x.pathname))
    return normalize({_raw:raw,type:'model',mdl:{u,e:modelExt(x.pathname),n:decodeURIComponent(x.pathname.split('/').pop())}});}catch(e){}
  return normalize({_raw:raw,type:'web',url:u});
}
/* 訪客插的卡要記住「插在誰前面」。卡片的 _id 每次載入都會重新產生，
   不能當錨點，所以用原文的雜湊值。 */
function rawHash(s){
  let x=2166136261;s=String(s||'');
  for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}
  return (x>>>0).toString(36);
}

/* ---------- 調整卡片大小（編輯器與獨立牆共用） ----------
   右下角把手同時調寬高，側邊把手只調寬度。
   內容有固定長寬比的卡（影片之類）預設維持比例，按住 Shift 才能自由拉高。 */
function resizeStart(a,el,o,side,ev,onDone){
  ev.preventDefault();
  try{a.setPointerCapture(ev.pointerId);}catch(e){}
  document.body.classList.add('resizing');el.classList.add('dragging');
  const sx=ev.clientX,sy=ev.clientY,sw=el.offsetWidth,sh=el.offsetHeight;
  const locked=o.fit&&o.fit.t!=='page';let free=false;
  const move=e2=>{
    o.w=Math.max(MIN,Math.round((sw+e2.clientX-sx)/GRID)*GRID);
    free=side?false:(!locked||e2.shiftKey);
    o.h=free?Math.max(MIN,Math.round((sh+e2.clientY-sy)/GRID)*GRID)
            :(locked?fitH(o,o.w,2):Math.max(MIN,Math.round(sh*(o.w/Math.max(1,sw))/GRID)*GRID));
    applySize(el,o);
  };
  const up=()=>{
    a.removeEventListener('pointermove',move);a.removeEventListener('pointerup',up);
    a.removeEventListener('pointercancel',up);
    document.body.classList.remove('resizing');el.classList.remove('dragging');
    o.manual=locked&&free;o.span=0;
    if(onDone)onDone();
  };
  a.addEventListener('pointermove',move);a.addEventListener('pointerup',up);
  a.addEventListener('pointercancel',up);
}

let insBox=null;
function insClose(){if(insBox){insBox.remove();insBox=null;}}
/* 插卡對話框：貼上 → 檢查 → 可以呈現才交給 onSave */
function insertDialog(guest,onSave){
  insClose();
  const box=document.createElement('div');
  box.className='ins-modal';box.id='insModal';
  box.innerHTML='<div class="ins-card" role="dialog" aria-modal="true" aria-labelledby="insHead">'
    +'<b id="insHead" data-i18n="insTitle"></b>'
    /* 三種情況說三種話：沒接伺服器／連著／設了但現在斷線 */
    +'<p class="ins-hint" data-i18n="'+(guest?(SYNC?(SYNC_UP?'insHintLive':'insDown'):'insHintGuest'):'insHintOwner')+'"></p>'
    +'<textarea id="insTa" rows="3" spellcheck="false" data-i18n-ph="insPh" data-i18n-aria="insTitle"></textarea>'
    +'<div class="ins-kinds"><button type="button" class="ins-kind" id="insMd" data-i18n="insMd"></button><span class="ins-kinds-note" data-i18n="insKinds"></span></div>'
    +'<div class="ins-err" id="insErr" role="alert"></div>'
    +'<div class="ins-go"><button type="button" class="ins-btn" id="insNo" data-i18n="insCancel"></button>'
    +'<button type="button" class="ins-btn on" id="insYes" data-i18n="insSave"></button></div></div>';
  document.body.appendChild(box);insBox=box;
  applyI18n();
  const ta=box.querySelector('#insTa'),err=box.querySelector('#insErr');
  const btnYes=box.querySelector('#insYes'),btnNo=box.querySelector('#insNo');
  box.addEventListener('click',e=>{if(e.target===box)insClose();});
  btnNo.addEventListener('click',insClose);
  /* 一鍵包成 Markdown 卡：已經有內容就把它包進 <md>，沒有就放一個範本 */
  box.querySelector('#insMd').addEventListener('click',()=>{
    const v=ta.value.trim();
    if(!MD_RE.test(v)){ta.value=mdTag(v||t('insMdTpl'));}
    ta.focus();const p=ta.value.indexOf('\n')+1;ta.setSelectionRange(p,ta.value.length-6);err.textContent='';
  });
  let isSubmitting = false;
  const commit = () => {
    if (isSubmitting) return;
    const v = ta.value.trim();
    if (MD_RE.test(v) && mdInner(v).length > MD_MAX) { err.textContent = t('insBig'); ta.focus(); return; }
    const o = parseOne(v);
    if (!o) { err.textContent = t('insBad'); ta.focus(); return; }

    isSubmitting = true;
    btnYes.disabled = true;
    btnNo.disabled = true;
    btnYes.style.pointerEvents = 'none';
    const origYesHtml = btnYes.innerHTML;
    btnYes.innerHTML = '<span class="ins-spin"></span><span>' + (t('insSaving') || t('insSave') || 'Saving...') + '</span>';
    err.textContent = '';

    const back = why => {
      isSubmitting = false;
      btnYes.disabled = false;
      btnNo.disabled = false;
      btnYes.style.pointerEvents = '';
      btnYes.innerHTML = origYesHtml;
      err.textContent = t(why || 'insBusy');
      ta.focus();
    };

    try {
      const r = onSave(o);
      if (!r || typeof r.then !== 'function') {
        setTimeout(() => insClose(), 250);
        return;
      }
      r.then(
        ok => {
          if (ok === true) insClose();
          else back(typeof ok === 'string' ? ok : 'insBusy');
        },
        () => back('insDown')
      );
    } catch (e) {
      back('insBusy');
    }
  };
  btnYes.addEventListener('click',commit);
  ta.addEventListener('input',()=>{err.textContent='';});
  box.addEventListener('keydown',e=>{
    e.stopPropagation();                       /* 別讓「/」開篩選之類的快捷鍵插手 */
    if(e.key==='Escape'){e.preventDefault();insClose();}
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commit();}
  });
  setTimeout(()=>ta.focus(),30);
}

/* ==================== 伺服器同步（選配） ====================
   setWallSync('https://ez.wiki') 之後，訪客插的卡改走伺服器：
   立刻公開、用 SSE 推給所有正在看的人，版主另外有一份待審列表。
   沒設就完全是原本的行為——卡片只存在訪客自己的瀏覽器裡。 */
let SYNC='',SYNC_ES=null,SYNC_UP=false;   /* SYNC＝有沒有設定；SYNC_UP＝此刻通不通 */
function setWallSync(u){
  SYNC=httpUrl(u)?String(u).replace(/\/+$/,''):'';
  /* 同步和嵌入檢查是同一台伺服器，沒有另外指定就自動接上 */
  if(SYNC&&!FRAME_CHECK)setFrameCheck(SYNC+'/api/frame-check');
}
/* 這位訪客的身分：只用來讓他刪掉自己貼的卡，伺服器只存雜湊後的值 */
function wallMe(){
  let v='';try{v=localStorage.getItem('wall_me')||'';}catch(e){}
  if(!/^[a-z0-9-]{8,64}$/i.test(v)){
    v=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Math.random()).slice(2)+Date.now().toString(36);
    try{localStorage.setItem('wall_me',v);}catch(e){}
  }
  return v;
}
function ownerToken(){try{return localStorage.getItem('wall_owner')||'';}catch(e){return '';}}
function setOwnerToken(v){try{v?localStorage.setItem('wall_owner',v):localStorage.removeItem('wall_owner');}catch(e){}}
function syncHeaders(json){
  const hd={'x-wall-me':wallMe()};
  if(json)hd['content-type']='application/json';
  const o=ownerToken();if(o)hd['x-wall-owner']=o;
  if(typeof window !== 'undefined' && window.auth && window.auth.user) {
    hd['x-user-id'] = String(window.auth.user.id || '');
  }
  if(typeof window !== 'undefined' && window.isOwner) {
    hd['x-is-owner'] = '1';
  }
  return hd;
}
function getEffectiveOrigin(){
  if (SYNC && SYNC !== 'null' && !SYNC.startsWith('about:')) return SYNC;
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('about:')) {
    return window.location.origin;
  }
  return '';
}
const syncBase=id=>{
  let o = String(getEffectiveOrigin() || '');
  while(o.endsWith('/')) o = o.slice(0, -1);
  return (o ? o : '') + '/api/wall/' + encodeURIComponent(id);
};
function syncAdd(id,card){
  const url = syncBase(id)+'/cards';
  const bodyData = Object.assign({}, card, { wall_id: id });
  return fetch(url, {
    method: 'POST',
    headers: syncHeaders(true),
    credentials: 'same-origin',
    body: JSON.stringify(bodyData)
  }).then(async r => {
    let j = null;
    try { j = await r.json(); } catch(e){}
    return { ok: r.ok, status: r.status, j };
  });
}
function syncDrop(id,cid){
  return fetch(syncBase(id)+'/cards/'+encodeURIComponent(cid),{
    method:'DELETE',
    headers:syncHeaders(false),
    credentials:'same-origin'
  }).then(r=>({ok:r.ok,status:r.status}));
}
function syncApprove(id,cid){
  return fetch(syncBase(id)+'/cards/'+encodeURIComponent(cid)+'/approve',{
    method:'POST',
    headers:syncHeaders(false),
    credentials:'same-origin'
  }).then(r=>({ok:r.ok,status:r.status}));
}
function syncReview(id){
  return fetch(syncBase(id)+'/review',{headers:syncHeaders(false)})
    .then(r=>r.ok?r.json():Promise.reject(r.status));
}
/* SSE：sync＝一次給全部，card／drop＝單張增減，ping＝心跳 */
function syncStream(id,on){
  if(!SYNC||typeof EventSource==='undefined')return null;
  let es;
  try{es=new EventSource(syncBase(id)+'/stream');}catch(e){return null;}
  SYNC_ES=es;
  es.addEventListener('sync',e=>{try{on('sync',JSON.parse(e.data));}catch(x){}});
  es.addEventListener('card',e=>{try{on('card',JSON.parse(e.data));}catch(x){}});
  es.addEventListener('drop',e=>{try{on('drop',JSON.parse(e.data));}catch(x){}});
  es.addEventListener('promote',e=>{try{on('promote',JSON.parse(e.data));}catch(x){}});
  es.addEventListener('error',()=>{SYNC_UP=false;on('down',null);});
  es.addEventListener('open',()=>{SYNC_UP=true;on('up',null);});
  addEventListener('pagehide',()=>{try{es.close();}catch(x){}});
  return es;
}
/* 連線狀態的小圓點，和版主的待審鍵 */
function syncBtnHTML(){
  return '<span id="syncDot" class="pill sync" hidden title=""><span class="mi">●</span></span>'
        +'<button id="revBtn" class="pill rev" title="Review List (🛡)" aria-label="Review List" data-i18n-aria="revTitle"><span class="mi">🛡</span></button>';
}

/* 附在 HTML 嵌入碼後面：量內容實際高度回報給外層（Twitter 等載入後長高也會再回報） */
const REPORT='<script>(function(){var last=-1;function m(){var b=document.body;if(!b)return;var r=b.getBoundingClientRect(),h=r.bottom+(parseFloat(getComputedStyle(b).marginBottom)||0);for(var i=0;i<b.children.length;i++){var c=b.children[i].getBoundingClientRect().bottom;if(c>h)h=c;}h=Math.ceil(h+(window.scrollY||0));if(Math.abs(h-last)>1){last=h;parent.postMessage({__wallH:h},"*");}}addEventListener("load",m);if(window.ResizeObserver&&document.body)new ResizeObserver(m).observe(document.body);setTimeout(m,60);setTimeout(m,900);setTimeout(m,3000);})();<\/script>';
/* 3D 卡有自己的長寬比，不必附上量高度的腳本 */
function srcdocOf(o){return o.type==='model'?o.html:o.html+REPORT;}   /* md 也要量高度 */
const measureCbs=[];
window.addEventListener('message',e=>{
  const d=e.data;if(!d||typeof d.__wallH!=='number'||!(d.__wallH>0))return;
  const f=[...document.querySelectorAll('iframe.html-frame')].find(x=>x.contentWindow===e.source);if(!f)return;
  const el=f.closest('.item');
  /* A 區卡片的 id 前面多了 a-，回報時換回原本的卡片 id */
  if(el)measureCbs.forEach(cb=>cb(el.dataset.id.replace(/^[ac]-/,''),Math.min(Math.round(d.__wallH),MAX-BORDER)));
});
function onMeasure(cb){measureCbs.push(cb);}
/* 選配：伺服器端嵌入檢查。瀏覽器讀不到別的網站能不能被嵌入，只有伺服器能看 X-Frame-Options／CSP。
   setFrameCheck('https://ez.wiki/api/frame-check') 後，會對一般網頁卡 GET ?url=…，
   回傳 {"embeddable":false} 的就改成墓碑。未設定時只用上面的已知清單與手動標記。 */
let FRAME_CHECK='';const asked=new Set();
function setFrameCheck(u){FRAME_CHECK=httpUrl(u)?u:'';}
function checkFrames(list,onBlocked){
  if(!FRAME_CHECK)return;
  list.forEach(o=>{
    if(o.type!=='web'||o.emb||o.blk||isTomb(o)||(o.fit&&o.fit.t!=='page')||asked.has(o.url))return;
    asked.add(o.url);
    fetch(FRAME_CHECK+(FRAME_CHECK.includes('?')?'&':'?')+'url='+encodeURIComponent(o.url))
      .then(r=>r.ok?r.json():null).then(j=>{if(j&&j.embeddable===false){o.blk=true;o.fit=fitOf(o);onBlocked(o);}}).catch(()=>{});
  });
}
/* ---------- 延遲載入 ----------
   卡片接近畫面（上下一個螢幕高內）才建立 iframe，每個畫面格最多建 3 個，避免一次塞爆；
   離開很遠（上下三個螢幕外）超過 10 秒就卸載，換回佔位。
   使用者點進去互動過的卡（例如正在播的 Podcast）永遠不卸載。
   牆放在 ez.wiki 預覽框裡也有效：交集是以最外層分頁的可視範圍計算。 */
const LAZY='IntersectionObserver' in window;
let nearIO=null,farIO=null,qRaf=0;const mountQ=new Set();
function phHTML(o){
  const k={video:'▶',audio:'♪',html:'</>',page:'🌐',model:'◈',md:'M↓'}[kindOf(o)]||'🌐';   /* sketchfab → ◈ */
  const lbl=o.type==='md'?'Markdown':o.type==='model'?(o.mdl&&o.mdl.e||'3d').toUpperCase()
    :o.type==='html'?'HTML':o.type==='youtube'?'youtube.com':hostOf(o.url);
  return '<div class="ph" aria-hidden="true"><span class="ph-i">'+k+'</span><span class="ph-h">'+esc(lbl)+'</span></div>';
}
function mount(el){
  if(el._mounted||!el._o)return;const ph=el.querySelector('.ph');if(!ph)return;
  el._pw=el.clientWidth-BORDER;
  const tp=document.createElement('template');tp.innerHTML=frameHTML(el._o,el._pw);
  const f=tp.content.firstElementChild;if(f.classList.contains('html-frame'))f.srcdoc=srcdocOf(el._o);
  ph.replaceWith(f);el._mounted=true;
}
function unmount(el){
  if(!el._mounted||el._keep||el.classList.contains('engaged'))return;
  const f=el.querySelector('iframe');if(!f)return;
  const tp=document.createElement('template');tp.innerHTML=phHTML(el._o);
  f.replaceWith(tp.content.firstElementChild);el._mounted=false;
}
function pump(){
  if(qRaf)return;
  qRaf=requestAnimationFrame(()=>{
    qRaf=0;
    if(document.body.classList.contains('shuffling'))return;
    let n=0;
    for(const el of mountQ){mountQ.delete(el);if(!el.isConnected||!(el._vis||el._keep))continue;mount(el);if(++n>=3)break;}
    if(mountQ.size)pump();
  });
}
function observeCard(el){
  if(!nearIO){
    nearIO=new IntersectionObserver(es=>es.forEach(e=>{
      const el=e.target;el._vis=e.isIntersecting;
      if(e.isIntersecting){clearTimeout(el._unT);if(!document.body.classList.contains('shuffling')){mountQ.add(el);pump();}}
    }),{rootMargin:'100% 50%'});
    farIO=new IntersectionObserver(es=>es.forEach(e=>{
      const el=e.target;clearTimeout(el._unT);
      if(!e.isIntersecting)el._unT=setTimeout(()=>unmount(el),10000);
    }),{rootMargin:'300% 200%'});
    /* 點進 iframe（播放、捲動內容）時外層會失焦：標記這張卡為互動中 */
    addEventListener('blur',()=>setTimeout(()=>{const f=document.activeElement;if(f&&f.tagName==='IFRAME'){const it=f.closest('.item');if(it)it.classList.add('engaged');}},0));
  }
  nearIO.observe(el);farIO.observe(el);
}
function dropCard(el){if(nearIO){nearIO.unobserve(el);farIO.unobserve(el);}clearTimeout(el._unT);mountQ.delete(el);el.remove();}
function makeCard(o,ro){
  bindFold();
  const tp=document.createElement('template');tp.innerHTML=cardHTML(o,ro);
  const el=tp.content.firstElementChild;el._o=o;
  const f=el.querySelector('.html-frame');if(f)f.srcdoc=srcdocOf(o);
  if(el.querySelector('.ph'))observeCard(el);
  return el;
}

function renderAll(wall,list,ro){wall.replaceChildren(...list.map(o=>makeCard(o,ro)));}

function applySize(el,o){el.style.width=o.w+'px';el.style.height=o.h+'px';const t=el.querySelector('.corner-dim');if(t)t.textContent=o.w+'×'+o.h;}
/* 內容比卡片高：顯示底部的淡出與「展開全文」；展開中則顯示「收合」 */
function foldSync(el,o,h){
  const f=el.querySelector('.fold');if(!f)return;
  const cut=!!(o.mh&&o.mh+BORDER>h+6),open=!!o.full&&!!o.mh&&o.mh+BORDER>autoCap(el.clientWidth||h)+6;
  el.classList.toggle('clipped',cut);el.classList.toggle('unfolded',!cut&&open);
  const b=f.querySelector('.fold-btn'),k=cut?'foldMore':'foldLess';
  if(b.dataset.i18n!==k){b.dataset.i18n=k;b.textContent=t(k);}
}
let foldBound=false;
function bindFold(){
  if(foldBound)return;foldBound=true;
  document.addEventListener('click',e=>{
    const b=e.target.closest('.fold-btn');if(!b)return;
    const el=b.closest('.item'),o=el&&el._o;if(!o)return;
    e.preventDefault();e.stopPropagation();
    o.full=!o.full;
    /* 拉過高度的卡：展開＝用完整高度，收合＝回到上限 */
    if(o.manual)o.manual=false;
    if(!o.full&&el.getBoundingClientRect().top<0)el.scrollIntoView({block:'start',behavior:'smooth'});
    dispatchEvent(new Event('wall:relayout'));
  },true);
}
/* 來客卡被認可：就地換掉標記與移除鍵，iframe 不重新載入 */
function markApproved(o){
  o.ok=true;
  ['', 'a-', 'c-'].forEach(p=>document.querySelectorAll('.item[data-id="'+p+o._id+'"]').forEach(el=>{
    el.classList.remove('pending');el.classList.add('ok');
    const k=el.querySelector('.corner');if(k)k.outerHTML=cornerHTML(o);
    const g=el.querySelector('.gdel');if(g)g.remove();
  }));
}

/* N 欄：依牆面寬度均分；太窄時自動降欄，每張不小於 MIN */
function colSize(wall,n){
  const W=wall.clientWidth;
  const k=Math.max(1,Math.min(n,Math.floor((W+GAP)/(MIN+GAP))));
  return {k,w:Math.max(MIN,Math.floor((W-GAP*(k-1))/k))};
}
/* 排版：cols>0 → 等寬，每張依內容定高，放進目前最短的一欄
          cols=0 → 保留各卡寬高，用 skyline 找最高能放的位置，不等寬也能緊密排 */
function carK(W,cols){return cols>0?Math.max(1,Math.min(cols,Math.floor((W+GAP)/(MIN+GAP)))):Math.max(1,Math.min(4,Math.floor((W+GAP)/(340+GAP))));}
function layoutWall(wall,list,cols,car){
  const W=wall.clientWidth,pos=new Map(),sz=new Map();let H=0;
  /* 使用者拖過的卡片固定在自己的位置，其他卡片排版時會往下避開它們 */
  const fixed=[];
  if(!car)list.forEach(o=>{
    if(!o.free||o.px==null)return;
    const w=Math.min(o.w,W),x=Math.max(0,Math.min(o.px,Math.max(0,W-w))),y=Math.max(0,o.py);
    pos.set(o._id,[x,y]);fixed.push([x,y,w,o.h]);H=Math.max(H,y+o.h);
  });
  const avoid=(x,y,w,h)=>{
    let moved=true,guard=0;
    while(moved&&guard++<40){
      moved=false;
      for(const f of fixed){
        if(x<f[0]+f[2]+GAP&&f[0]<x+w+GAP&&y<f[1]+f[3]+GAP&&f[1]<y+h+GAP){y=f[1]+f[3]+GAP;moved=true;}
      }
    }
    return y;
  };
  if(car){
    /* 輪播：一次顯示的張數＝欄位設定（隨機／原始時依寬度自動 1~4 張）。
       尺寸只用來顯示，不寫回卡片資料，關掉輪播後原本的版面不變 */
    const k=carK(W,cols),w=Math.max(MIN,Math.floor((W-GAP*(k-1))/k));
    wall._hs=[];
    list.forEach((o,i)=>{const h=fitH(o,w,k);sz.set(o._id,{w,h});pos.set(o._id,[i*(w+GAP),0]);wall._hs.push(h);if(h>H)H=h;});
    wall.dataset.k=k;wall._step=w+GAP;wall._n=list.length;wall._ids=list.map(o=>o._id);
  }else if(cols>0){
    const {k,w}=colSize(wall,cols),colH=new Array(k).fill(0);
    list.forEach(o=>{
      o.w=w;o.h=fitH(o,w,k);o.manual=false;o.span=0;
      if(pos.has(o._id))return;                       /* 已固定的卡片不參與排版 */
      let c=0;for(let i=1;i<k;i++)if(colH[i]<colH[c]-.5)c=i;
      const x=c*(w+GAP),y=avoid(x,colH[c],w,o.h);
      pos.set(o._id,[x,y]);colH[c]=y+o.h+GAP;
    });
    H=Math.max(H,Math.max(...colH)-GAP);
  }else{
    /* 自由／隨機：把牆切成 G 條細欄（約 190px 一條），每張卡橫跨 1~3 條。
       隨機的卡記的是「跨幾條＋高寬比」，換螢幕寬度也會整齊貼齊左右兩邊；
       手動拉過的卡保留自己的寬度，佔用夠放它的條數 */
    const G=Math.max(2,Math.min(8,Math.round((W+GAP)/(190+GAP)))),cw=(W-GAP*(G-1))/G,colH=new Array(G).fill(0);
    list.forEach(o=>{
      let s;
      if(o.span){s=Math.min(o.span,G);o.w=Math.round(s*cw+(s-1)*GAP);o.h=(o.fit||{}).t==='page'?Math.max(MIN,Math.round(o.w*(o.rh||.75))):fitH(o,o.w,2);}
      else s=Math.min(G,Math.max(1,Math.ceil((Math.min(o.w,W)+GAP)/(cw+GAP)-.001)));
      if(pos.has(o._id))return;
      let bc=0,by=Infinity;
      for(let c=0;c+s<=G;c++){let y=0;for(let j=c;j<c+s;j++)if(colH[j]>y)y=colH[j];if(y<by-.5){by=y;bc=c;}}
      const x=Math.round(bc*(cw+GAP));by=avoid(x,by,Math.round(s*cw+(s-1)*GAP),o.h);
      pos.set(o._id,[x,by]);for(let j=bc;j<bc+s;j++)colH[j]=by+o.h+GAP;
    });
    H=Math.max(H,Math.max(0,...colH)-GAP);
  }
  const byId=new Map(list.map(o=>[o._id,o]));
  wall.querySelectorAll('.item').forEach(el=>{
    const o=byId.get(el.dataset.id),p=pos.get(el.dataset.id);if(!o||!p)return;
    const d=sz.get(el.dataset.id)||o;
    el._o=o;applySize(el,d);foldSync(el,o,d.h);el.style.left=p[0]+'px';el.style.top=p[1]+'px';
    el.classList.toggle('free',!!o.free&&!car);
    /* Facebook 外掛寬度寫在網址裡：卡片寬度變很多時換一個對應寬度的新框 */
    if(el._mounted&&o.fit&&o.fit.t==='lin'&&Math.abs((el._pw||0)-(d.w-BORDER))>24){
      const f=el.querySelector('iframe'),tp=document.createElement('template');el._pw=d.w-BORDER;
      tp.innerHTML=frameHTML(o,el._pw);if(f)f.replaceWith(tp.content.firstElementChild);
    }
  });
  wall.style.height=list.length?Math.max(0,H)+'px':'';
  if(!wall.classList.contains('ready'))requestAnimationFrame(()=>requestAnimationFrame(()=>wall.classList.add('ready')));
  if(car){
    /* 版面變動後瀏覽器會「追著原本貼齊的那張」捲動，所以明確捲回目前這一頁 */
    const {k,step,pages}=carState(wall),pg=Math.min(wall._carPage||0,pages-1);
    const sb=wall.style.scrollBehavior;wall.style.scrollBehavior='auto';wall.scrollLeft=pg*k*step;wall.style.scrollBehavior=sb;
    carSync(wall,true);
  }
}

/* ---------- 輪播控制：底部 ‹ 點點 ›、方向鍵、觸控滑動（原生捲動） ---------- */
function carouselBtnHTML(){return '<button id="carBtn" class="pill car" aria-pressed="false" data-i18n-aria="carousel"><span class="mi">🎠</span><span class="lbl" data-i18n="carousel"></span></button>';}
function carState(wall){const k=+wall.dataset.k||1,step=wall._step||1,n=wall._n||0;return {k,step,n,pages:Math.max(1,Math.ceil(n/k))};}
function carCurrent(wall){
  const {k,step,pages}=carState(wall);if(!wall._n)return 0;
  if(wall.scrollLeft>=wall.scrollWidth-wall.clientWidth-2&&wall.scrollLeft>0)return pages-1;
  return Math.max(0,Math.min(pages-1,Math.round(wall.scrollLeft/step/k)));
}
function carGo(wall,p){const {k,step,pages}=carState(wall);p=Math.max(0,Math.min(pages-1,p));wall.scrollTo({left:p*k*step});}
let carRaf=0;
function placeSides(wall){
  const L=document.getElementById('carL'),R=document.getElementById('carR');if(!L)return;
  const on=wall.classList.contains('carousel');L.hidden=R.hidden=!on;if(!on)return;
  const r=wall.getBoundingClientRect(),h=parseFloat(wall.style.height)||r.height,sz=L.offsetWidth||44;
  const y=r.top+scrollY+Math.min(h/2,260)-sz/2;
  L.style.top=R.style.top=Math.round(y)+'px';
  L.style.left=Math.round(r.left+scrollX+6)+'px';
  R.style.left=Math.round(r.right+scrollX-sz-6)+'px';
}
function carSync(wall,force){
  const nav=document.getElementById('carNav');if(!nav||nav.hidden){placeSides(wall);return;}
  const {pages,k,step,n}=carState(wall),cur=carCurrent(wall),box=nav.querySelector('.car-dots');
  const first=Math.max(0,Math.min(Math.round(wall.scrollLeft/step),n-k));
  if(!force&&cur===wall._carPage&&first===wall._carFirst)return;
  wall._carPage=cur;wall._carFirst=first;
  if(wall._ids){
    const idx=new Map(wall._ids.map((id,i)=>[id,i])),from=first-k,to=first+2*k;
    wall.querySelectorAll('.item').forEach(el=>{const i=idx.get(el.dataset.id);el._keep=i!=null&&i>=from&&i<to;if(el._keep)mountQ.add(el);});
    pump();
  }
  /* 牆高＝目前看得到的幾張裡最高的那張，不留下方空白 */
  if(wall._hs&&wall._hs.length){const vis=wall._hs.slice(first,first+k);if(vis.length)wall.style.height=Math.max(...vis)+'px';}
  if(pages<=10){
    if(box.children.length!==pages||box.firstElementChild&&!box.firstElementChild.classList.contains('car-dot')){
      box.innerHTML='';for(let i=0;i<pages;i++){const d=document.createElement('button');d.className='car-dot';d.dataset.page=i;box.appendChild(d);}
    }
    [...box.children].forEach((d,i)=>{d.setAttribute('aria-current',i===cur);d.setAttribute('aria-label',t('page',{n:i+1}));});
  }else box.innerHTML='<span class="car-count">'+(cur+1)+' / '+pages+'</span>';
  const [prev,next]=nav.querySelectorAll('.car-arrow'),L=document.getElementById('carL'),R=document.getElementById('carR');
  prev.disabled=L.disabled=cur<=0;next.disabled=R.disabled=cur>=pages-1;
  [prev,L].forEach(b=>b.setAttribute('aria-label',t('prev')));[next,R].forEach(b=>b.setAttribute('aria-label',t('next')));
  placeSides(wall);
}
function setCarousel(wall,on){
  let nav=document.getElementById('carNav');
  if(!nav){
    nav=document.createElement('div');nav.id='carNav';nav.className='car-nav';nav.hidden=true;
    nav.innerHTML='<button class="car-arrow" data-dir="-1">‹</button><div class="car-dots"></div><button class="car-arrow" data-dir="1">›</button>';
    wall.before(nav);
    /* 兩側箭頭 */
    document.body.insertAdjacentHTML('beforeend','<button id="carL" class="car-side" data-dir="-1" hidden>‹</button><button id="carR" class="car-side" data-dir="1" hidden>›</button>');
    ['carL','carR'].forEach(id=>document.getElementById(id).addEventListener('click',e=>carGo(wall,carCurrent(wall)+ +e.currentTarget.dataset.dir)));
    wall.addEventListener('transitionend',e=>{if(e.target===wall)placeSides(wall);});
    addEventListener('resize',()=>placeSides(wall));
    addEventListener('wall:offset',()=>placeSides(wall));
    nav.addEventListener('click',e=>{
      const a=e.target.closest('[data-dir]');if(a){carGo(wall,carCurrent(wall)+ +a.dataset.dir);return;}
      const d=e.target.closest('[data-page]');if(d)carGo(wall,+d.dataset.page);
    });
    wall.addEventListener('scroll',()=>{if(!carRaf)carRaf=requestAnimationFrame(()=>{carRaf=0;carSync(wall);});},{passive:true});
    document.addEventListener('keydown',e=>{
      if(!wall.classList.contains('carousel')||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
      if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable],.menu'))return;
      const panel=document.getElementById('panel');if(panel&&!panel.classList.contains('hidden'))return;
      e.preventDefault();carGo(wall,carCurrent(wall)+(e.key==='ArrowRight'?1:-1));
    });
  }
  wall._carPage=0;wall.classList.toggle('carousel',on);nav.hidden=!on;
  if(!on)wall.querySelectorAll('.item').forEach(el=>{el._keep=false;});document.body.classList.toggle('car-on',on);
  wall._carFirst=-1;if(!on)wall.scrollLeft=0;
  const b=document.getElementById('carBtn');if(b)b.setAttribute('aria-pressed',on);
  dispatchEvent(new Event('wall:carousel'));placeSides(wall);
}
/* 牆面寬度改變（視窗縮放、捲軸出現）時回呼，只看寬度避免無限迴圈 */
function watchWidth(wall,cb){
  let last=wall.clientWidth,raf=0,pending=false;
  const run=()=>{raf=0;if(document.hidden){pending=true;return;}const W=wall.clientWidth;if(W!==last){last=W;cb();}};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pending){pending=false;last=-1;run();}});
  const kick=()=>{if(!raf)raf=requestAnimationFrame(run);};
  if('ResizeObserver' in window)new ResizeObserver(kick).observe(wall);else window.addEventListener('resize',kick);
}
/* Content 牆的欄數：0＝隨機瀑布流，1~COLS_MAX＝等寬欄。
   實際畫出幾欄還會被寬度限制（見 colSize），放不下就自動少排幾欄。 */
const COLS_MAX=5,COLS_QUICK=5;
const validCols=c=>Number.isInteger(c)&&c>=0&&c<=COLS_MAX;


/* ---------- 多語系（編輯器與獨立牆共用，預設英文） ---------- */
const I18N={"en": {"title": "Wall editor", "upload": "Upload", "download": "Download", "copyWall": "Copy standalone wall", "dlWall": "Download standalone wall", "clear": "Clear", "hint": "Enter adds a ━━━━ divider | a boundary labels the block above it: ### = InfoMercial, === = Topic; whatever is left is Content | Shift+Enter: line break only | Ctrl+Enter: push to wall", "placeholder": "Paste URLs, one per line", "cancel": "Cancel", "push": "✓ Push to wall", "count": "{n} items", "layout": "Layout", "random": "Random", "cols": "{n} columns", "col1": "1 column", "openEditor": "Open editor", "close": "Close", "edit": "Edit", "language": "Language", "noInput": "No URLs or embed code found", "skipped": "Skipped {n} unrecognized line(s)", "storageFull": "⚠️ Not saved: browser storage is full or disabled. Download a backup first.", "emptyWall": "The wall is empty. Add content first.", "copied": "✓ Standalone wall HTML copied ({n} items)", "clipFallback": "Clipboard unavailable. Downloaded .html instead.", "downloaded": "✓ Standalone wall downloaded ({n} items)", "fileEmpty": "No usable content in this file", "loaded": "✓ Loaded {n} items", "loadedSkip": ", {n} skipped", "confirmClear": "Clear this wall?", "wallEmpty": "This wall has no content yet", "del": "Delete", "original": "Original", "shuffle": "Shuffle", "tombNote": "This site doesn't allow embedding", "openTab": "Open in new tab", "markTomb": "Mark as non-embeddable", "tryEmbed": "Try embedding again", "carousel": "Carousel", "prev": "Previous", "next": "Next", "page": "Page {n}", "filter": "Filter", "searchPh": "Search titles, sites, #tags…", "fType": "Type", "fDate": "Date", "fSort": "Sort", "tAll": "All types", "tVideo": "Video", "tAudio": "Audio", "tPage": "Web pages", "tHtml": "HTML", "tBlocked": "Non-embeddable", "dAny": "Any date", "dToday": "Today", "d7": "Last 7 days", "d30": "Last 30 days", "sWall": "Sort: wall order", "sNew": "Newest first", "sOld": "Oldest first", "sLong": "Longest first", "sShort": "Shortest first", "sAz": "Title A–Z", "results": "{n} of {m}", "fClear": "Clear", "noMatch": "No cards match these filters", "fTitle": "Title", "fTags": "Tags", "fLength": "Length", "tagsPh": "comma, separated", "lenPh": "mm:ss", "fxToggle": "Effects", "resetPos": "Reset positions", "moveCard": "Move card", "fxFire": "Fireworks", "fxFly": "Flying bees", "fxSound": "Sound", "tabSheet": "EzSheet", "tabPics": "Images & 3D", "picDrop": "Drop images or 3D models here, or click to choose files", "picHint": "Images and 3D models (.glb .gltf .stl .obj) are inlined into the wall, so nothing is fetched from the network. Each one can become a card; images can also replace the flying sprites in Topic.", "asCard": "As card", "asSprite": "As flying sprite", "picAdd": "Add as cards", "picSprites": "Use as sprites", "spriteReset": "Default bees", "picZoneA": "Topic", "picZoneB": "Content", "picAdded": "{n} image card(s) added", "spriteOk": "{n} flying sprite(s) applied", "picNone": "No images yet", "zA": "Topic band", "zB": "Content wall", "zC": "InfoMercial band", "zorder": "Zone order", "zorderHint": "Drag to set the order of the two top bands", "picZoneC": "InfoMercial", "tModel": "3D models", "picTooBig": "{n} file(s) skipped: over 12 MB", "picBadType": "{n} file(s) skipped: not an image or 3D model", "insCard": "Insert a card before this one", "insTitle": "Insert a card", "insHintOwner": "Paste a URL, an embed code, or Markdown. It goes in right before this card.", "insHintGuest": "Paste a URL, an embed code, or Markdown. It goes in right before this card, and is kept only in this browser — other visitors will not see it.", "insPh": "https://…  ·  <iframe> embed code  ·  <md>…</md>  ·  https://…/model.glb", "insSave": "Save and insert", "insCancel": "Cancel", "insBad": "That is not a URL, an embed code, or a <md>…</md> block this wall can show.", "insDone": "✓ One card inserted", "insDel": "Remove the card you added", "revTitle": "Co-WiKi cards", "revDrop": "Remove this card", "revHint": "Visitor cards go live immediately as Co-WiKi. ✓ approves one and makes it permanent; ✕ removes it for everyone.", "revNone": "No visitor cards yet", "revDenied": "Wrong owner key.", "revFail": "Could not reach the server.", "revAsk": "Owner key", "syncOn": "Live — shared with every visitor", "syncOff": "Offline — new cards stay in this browser until the connection is back", "insHintLive": "Paste a URL, an embed code, or Markdown. It goes in right before this card as a Co-WiKi card, every visitor sees it straight away, and it becomes permanent once the owner approves it.", "insBusy": "The server would not take that card.", "insRate": "Too many cards from here for now. Try again later.", "insDown": "This wall is offline at the moment, so a new card cannot be shared yet. Wait for the dot on the bar to turn green, then try again.", "insBig": "This Markdown card is too long.", "insMd": "M↓ Markdown", "insKinds": "3D: paste a Sketchfab embed or a public https link to .glb / .stl / .obj", "insMdTpl": "# Title\n\nWrite **Markdown** here — lists, tables, links and https images all work.", "revOk": "Approve — make this card permanent", "revPend": "Pending", "revOkd": "Approved", "tMd": "Markdown", "sprTitle": "Flying sprites 🐝", "sprHint": "The two built-in bees are ready to swap: ⇄ replaces one, ✕ removes it, ＋ adds one (up to 4), or drop an image on a slot. Remove them all and the 🐝 button is disabled for visitors.", "sprRep": "Replace image", "sprDel": "Remove", "sprAdd": "Add a flying sprite", "sprReset": "Back to the built-in bees", "sprDef": "built-in", "sprNone": "No flying sprites — the 🐝 button will be disabled.", "sprBig": "That image is over 2 MB.", "foldMore": "⌄ Show all", "foldLess": "⌃ Show less"}, "zh-TW": {"title": "牆面編輯", "upload": "上傳", "download": "下載", "copyWall": "複製獨立牆", "dlWall": "下載獨立牆", "clear": "清空", "hint": "Enter 自動加━━━━分隔｜界線標記「線以上那一段」：### 以上是 InfoMercial，=== 以上是 Topic，其餘是 Content｜Shift+Enter 純換行｜Ctrl+Enter 推上牆", "placeholder": "貼網址，每行一個", "cancel": "取消", "push": "✓ 推上牆", "count": "{n} 組", "layout": "版面", "random": "自由隨機", "cols": "{n} 欄", "openEditor": "開啟編輯面板", "close": "關閉", "edit": "編輯", "language": "語言", "noInput": "沒抓到可用的網址或嵌入碼", "skipped": "已略過 {n} 行無法辨識的內容", "storageFull": "⚠️ 沒存到：瀏覽器儲存空間已滿或被停用，請先下載備份", "emptyWall": "牆是空的，先推內容上牆", "copied": "✓ 已複製獨立牆 HTML（{n} 組）", "clipFallback": "剪貼簿無法使用，已改為下載 .html", "downloaded": "✓ 已下載獨立牆（{n} 組）", "fileEmpty": "檔案裡沒有可用的內容", "loaded": "✓ 已載入 {n} 組", "loadedSkip": "，略過 {n} 組", "confirmClear": "清空這面牆？", "wallEmpty": "這面牆目前沒有內容", "del": "刪除", "original": "原始版面", "shuffle": "洗牌", "tombNote": "此網站不允許嵌入", "openTab": "在新分頁開啟", "markTomb": "標示為無法嵌入", "tryEmbed": "重新嘗試嵌入", "carousel": "輪播", "prev": "上一頁", "next": "下一頁", "page": "第 {n} 頁", "filter": "篩選", "searchPh": "搜尋標題、網站、#標籤…", "fType": "類型", "fDate": "日期", "fSort": "排序", "tAll": "所有類型", "tVideo": "影片", "tAudio": "音訊", "tPage": "網頁", "tHtml": "HTML", "tBlocked": "無法嵌入", "dAny": "不限日期", "dToday": "今天", "d7": "最近 7 天", "d30": "最近 30 天", "sWall": "排序：牆面順序", "sNew": "最新優先", "sOld": "最舊優先", "sLong": "最長優先", "sShort": "最短優先", "sAz": "標題 A–Z", "results": "{n} / {m}", "fClear": "清除", "noMatch": "沒有符合篩選條件的卡片", "fTitle": "標題", "fTags": "標籤", "fLength": "長度", "tagsPh": "以逗號分隔", "lenPh": "分:秒", "fxToggle": "特效", "resetPos": "一鍵復位", "moveCard": "拖曳搬移", "fxFire": "煙火", "fxFly": "飛行物", "fxSound": "音效", "tabSheet": "EzSheet", "tabPics": "圖檔與 3D", "picDrop": "把圖檔或 3D 模型拖到這裡，或點一下選擇檔案", "picHint": "圖片與 3D 模型（.glb .gltf .stl .obj）會直接內嵌進牆面，不依賴外部網址。每個都可以變成一張卡片；圖片還可以取代 Topic 區的飛行圖示。", "asCard": "當卡片", "asSprite": "當飛行圖示", "picAdd": "加入為卡片", "picSprites": "套用為飛行圖示", "spriteReset": "回到預設蜜蜂", "picZoneA": "放 Topic", "picZoneB": "放 Content", "picAdded": "已加入 {n} 張圖卡", "spriteOk": "已套用 {n} 個飛行圖示", "picNone": "還沒有圖檔", "zA": "Topic（主題帶）", "zB": "Content（內容牆）", "zC": "InfoMercial（業配帶）", "zorder": "區塊順序", "zorderHint": "拖曳調整上方兩條帶（Topic／InfoMercial）的順序", "picZoneC": "放 InfoMercial", "tModel": "3D 模型", "picTooBig": "已略過 {n} 個檔案：超過 12 MB", "picBadType": "已略過 {n} 個檔案：不是圖檔或 3D 模型", "insCard": "在這張卡前面插入一張", "insTitle": "插入新卡", "insHintOwner": "貼上網址、嵌入碼或 Markdown，會插在這張卡的前面。", "insHintGuest": "貼上網址、嵌入碼或 Markdown，會插在這張卡的前面。只存在你這台瀏覽器裡，其他訪客看不到。", "insPh": "https://…　·　<iframe> 嵌入碼　·　<md>…</md>　·　https://…/model.glb", "insSave": "儲存並插入", "insCancel": "取消", "insBad": "這段內容不是網址、嵌入碼，也不是這面牆能呈現的 <md>…</md> 區塊。", "insDone": "✓ 已插入一張卡", "insDel": "移除你加的這張卡", "revTitle": "Co-WiKi 來客卡", "revDrop": "移除這張卡", "revHint": "來客卡以 Co-WiKi 即時公開。按 ✓ 認可成為永久卡；按 ✕ 移除，所有人那邊會立刻消失。", "revNone": "目前沒有訪客卡片", "revDenied": "版主金鑰不對。", "revFail": "連不上伺服器。", "revAsk": "版主金鑰", "syncOn": "連線中——所有訪客同步看到", "syncOff": "離線——新卡先留在這台瀏覽器，連上後再送出", "insHintLive": "貼上網址、嵌入碼或 Markdown，會以 Co-WiKi 卡插在這張卡的前面，所有訪客立刻看得到；版主認可後成為永久卡。", "insBusy": "伺服器不接受這張卡。", "insRate": "這裡送出的卡太多了，請稍後再試。", "insDown": "這面牆目前連不上伺服器，新卡還送不出去。等上方那顆點變綠再試一次。", "insBig": "這張 Markdown 卡太長了。", "insMd": "M↓ Markdown", "insKinds": "3D：貼 Sketchfab 嵌入碼，或 .glb／.stl／.obj 的公開 https 網址", "insMdTpl": "# 標題\n\n在這裡寫 **Markdown**：清單、表格、連結、https 圖片都可以。", "revOk": "認可：升級為永久卡", "revPend": "待審", "revOkd": "已認可", "tMd": "Markdown", "sprTitle": "飛行圖示 🐝", "sprHint": "內建的兩隻蜜蜂可以直接替換：⇄ 換圖、✕ 移除、＋ 新增（最多 4 張），也可以把圖檔拖到格子上。全部移除時，訪客的 🐝 鍵會停用。", "sprRep": "換圖", "sprDel": "移除", "sprAdd": "新增飛行圖示", "sprReset": "恢復內建蜜蜂", "sprDef": "內建", "sprNone": "沒有飛行圖示：🐝 鍵將停用。", "sprBig": "圖檔超過 2 MB。", "foldMore": "⌄ 展開全文", "foldLess": "⌃ 收合"}, "zh-CN": {"title": "墙面编辑", "upload": "上传", "download": "下载", "copyWall": "复制独立墙", "dlWall": "下载独立墙", "clear": "清空", "hint": "Enter 自动加━━━━分隔｜界线标记“线以上那一段”：### 以上是 InfoMercial，=== 以上是 Topic，其余是 Content｜Shift+Enter 纯换行｜Ctrl+Enter 推上墙", "placeholder": "粘贴网址，每行一个", "cancel": "取消", "push": "✓ 推上墙", "count": "{n} 组", "layout": "版面", "random": "自由随机", "cols": "{n} 栏", "openEditor": "打开编辑面板", "close": "关闭", "edit": "编辑", "language": "语言", "noInput": "没抓到可用的网址或嵌入码", "skipped": "已跳过 {n} 行无法识别的内容", "storageFull": "⚠️ 没保存：浏览器存储空间已满或被禁用，请先下载备份", "emptyWall": "墙是空的，先推内容上墙", "copied": "✓ 已复制独立墙 HTML（{n} 组）", "clipFallback": "剪贴板无法使用，已改为下载 .html", "downloaded": "✓ 已下载独立墙（{n} 组）", "fileEmpty": "文件里没有可用的内容", "loaded": "✓ 已载入 {n} 组", "loadedSkip": "，跳过 {n} 组", "confirmClear": "清空这面墙？", "wallEmpty": "这面墙目前没有内容", "del": "删除", "original": "原始版面", "shuffle": "洗牌", "tombNote": "此网站不允许嵌入", "openTab": "在新标签页打开", "markTomb": "标记为无法嵌入", "tryEmbed": "重新尝试嵌入", "carousel": "轮播", "prev": "上一页", "next": "下一页", "page": "第 {n} 页", "filter": "筛选", "searchPh": "搜索标题、网站、#标签…", "fType": "类型", "fDate": "日期", "fSort": "排序", "tAll": "所有类型", "tVideo": "视频", "tAudio": "音频", "tPage": "网页", "tHtml": "HTML", "tBlocked": "无法嵌入", "dAny": "不限日期", "dToday": "今天", "d7": "最近 7 天", "d30": "最近 30 天", "sWall": "排序：墙面顺序", "sNew": "最新优先", "sOld": "最旧优先", "sLong": "最长优先", "sShort": "最短优先", "sAz": "标题 A–Z", "results": "{n} / {m}", "fClear": "清除", "noMatch": "没有符合筛选条件的卡片", "fTitle": "标题", "fTags": "标签", "fLength": "长度", "tagsPh": "用逗号分隔", "lenPh": "分:秒", "fxToggle": "特效", "resetPos": "一键复位", "moveCard": "拖曳搬移", "fxFire": "烟火", "fxFly": "飞行物", "fxSound": "音效", "tabSheet": "EzSheet", "tabPics": "图档与 3D", "picDrop": "把图档或 3D 模型拖到这里，或点一下选择文件", "picHint": "图片与 3D 模型（.glb .gltf .stl .obj）会直接内嵌进墙面，不依赖外部网址。每个都可以变成一张卡片；图片还可以取代 Topic 区的飞行图示。", "asCard": "当卡片", "asSprite": "当飞行图示", "picAdd": "加入为卡片", "picSprites": "套用为飞行图示", "spriteReset": "回到默认蜜蜂", "picZoneA": "放 Topic", "picZoneB": "放 Content", "picAdded": "已加入 {n} 张图卡", "spriteOk": "已套用 {n} 个飞行图示", "picNone": "还没有图档", "zA": "Topic（主题带）", "zB": "Content（内容墙）", "zC": "InfoMercial（推广带）", "zorder": "区块顺序", "zorderHint": "拖拽调整上方两条带（Topic／InfoMercial）的顺序", "picZoneC": "放 InfoMercial", "tModel": "3D 模型", "picTooBig": "已跳过 {n} 个文件：超过 12 MB", "picBadType": "已跳过 {n} 个文件：不是图档或 3D 模型", "insCard": "在这张卡前面插入一张", "insTitle": "插入新卡", "insHintOwner": "粘贴网址、嵌入码或 Markdown，会插在这张卡的前面。", "insHintGuest": "粘贴网址、嵌入码或 Markdown，会插在这张卡的前面。只存在你这台浏览器里，其他访客看不到。", "insPh": "https://…　·　<iframe> 嵌入码　·　<md>…</md>　·　https://…/model.glb", "insSave": "保存并插入", "insCancel": "取消", "insBad": "这段内容不是网址、嵌入码，也不是这面墙能呈现的 <md>…</md> 区块。", "insDone": "✓ 已插入一张卡", "insDel": "移除你加的这张卡", "revTitle": "Co-WiKi 来客卡", "revDrop": "移除这张卡", "revHint": "来客卡以 Co-WiKi 即时公开。按 ✓ 认可成为永久卡；按 ✕ 移除，所有人那边会立刻消失。", "revNone": "目前没有访客卡片", "revDenied": "版主密钥不对。", "revFail": "连不上服务器。", "revAsk": "版主密钥", "syncOn": "连线中——所有访客同步看到", "syncOff": "离线——新卡先留在这台浏览器，连上后再送出", "insHintLive": "粘贴网址、嵌入码或 Markdown，会以 Co-WiKi 卡插在这张卡的前面，所有访客立刻看得到；版主认可后成为永久卡。", "insBusy": "服务器不接受这张卡。", "insRate": "这里送出的卡太多了，请稍后再试。", "insDown": "这面墙目前连不上服务器，新卡还送不出去。等上方那颗点变绿再试一次。", "insBig": "这张 Markdown 卡太长了。", "insMd": "M↓ Markdown", "insKinds": "3D：粘贴 Sketchfab 嵌入码，或 .glb／.stl／.obj 的公开 https 网址", "insMdTpl": "# 标题\n\n在这里写 **Markdown**：列表、表格、链接、https 图片都可以。", "revOk": "认可：升级为永久卡", "revPend": "待审", "revOkd": "已认可", "tMd": "Markdown", "sprTitle": "飞行图示 🐝", "sprHint": "内置的两只蜜蜂可以直接替换：⇄ 换图、✕ 移除、＋ 新增（最多 4 张），也可以把图片拖到格子上。全部移除时，访客的 🐝 键会停用。", "sprRep": "换图", "sprDel": "移除", "sprAdd": "新增飞行图示", "sprReset": "恢复内置蜜蜂", "sprDef": "内置", "sprNone": "没有飞行图示：🐝 键将停用。", "sprBig": "图片超过 2 MB。", "foldMore": "⌄ 展开全文", "foldLess": "⌃ 收起"}, "ja": {"title": "ウォール編集", "upload": "アップロード", "download": "ダウンロード", "copyWall": "単体ウォールをコピー", "dlWall": "単体ウォールを保存", "clear": "クリア", "hint": "Enterで━━━━区切り｜区切り線はその上のブロックを指します：### は InfoMercial、=== は Topic、残りが Content｜Shift+Enterは改行のみ｜Ctrl+Enterで追加", "placeholder": "URLを1行に1つずつ貼り付け", "cancel": "キャンセル", "push": "✓ ウォールに追加", "count": "{n}件", "layout": "レイアウト", "random": "ランダム", "cols": "{n}列", "openEditor": "エディタを開く", "close": "閉じる", "edit": "編集", "language": "言語", "noInput": "URLや埋め込みコードが見つかりません", "skipped": "認識できない{n}行をスキップしました", "storageFull": "⚠️ 保存できません：ブラウザのストレージが満杯か無効です。先にバックアップをダウンロードしてください", "emptyWall": "ウォールが空です。先に内容を追加してください", "copied": "✓ 単体ウォールのHTMLをコピーしました（{n}件）", "clipFallback": "クリップボードが使えないため .html をダウンロードしました", "downloaded": "✓ 単体ウォールを保存しました（{n}件）", "fileEmpty": "このファイルに使える内容がありません", "loaded": "✓ {n}件を読み込みました", "loadedSkip": "（{n}件スキップ）", "confirmClear": "このウォールをクリアしますか？", "wallEmpty": "このウォールにはまだ内容がありません", "del": "削除", "original": "オリジナル", "shuffle": "シャッフル", "tombNote": "このサイトは埋め込みを許可していません", "openTab": "新しいタブで開く", "markTomb": "埋め込み不可にする", "tryEmbed": "もう一度埋め込む", "carousel": "カルーセル", "prev": "前へ", "next": "次へ", "page": "{n}ページ目", "filter": "フィルター", "searchPh": "タイトル・サイト・#タグを検索…", "fType": "種類", "fDate": "日付", "fSort": "並べ替え", "tAll": "すべての種類", "tVideo": "動画", "tAudio": "音声", "tPage": "ウェブページ", "tHtml": "HTML", "tBlocked": "埋め込み不可", "dAny": "すべての日付", "dToday": "今日", "d7": "過去7日間", "d30": "過去30日間", "sWall": "並び：ウォール順", "sNew": "新しい順", "sOld": "古い順", "sLong": "長い順", "sShort": "短い順", "sAz": "タイトル順", "results": "{n} / {m}件", "fClear": "クリア", "noMatch": "条件に合うカードがありません", "fTitle": "タイトル", "fTags": "タグ", "fLength": "長さ", "tagsPh": "カンマ区切り", "lenPh": "分:秒", "fxToggle": "エフェクト", "resetPos": "位置をリセット", "moveCard": "カードを移動", "fxFire": "花火", "fxFly": "飛行体", "fxSound": "サウンド", "tabSheet": "EzSheet", "tabPics": "画像と3D", "picDrop": "画像や3Dモデルをここにドロップ、またはクリックして選択", "picHint": "画像と3Dモデル（.glb .gltf .stl .obj）はウォールに直接埋め込まれ、外部からの読み込みはありません。どれもカードにでき、画像は Topic の飛行画像にもできます。", "asCard": "カードにする", "asSprite": "飛ぶ画像にする", "picAdd": "カードとして追加", "picSprites": "飛行画像に使う", "spriteReset": "既定のミツバチ", "picZoneA": "Topic へ", "picZoneB": "Content へ", "picAdded": "{n}枚の画像カードを追加しました", "spriteOk": "飛行画像 {n}件を適用しました", "picNone": "画像がありません", "zA": "Topic（トピック帯）", "zB": "Content（コンテンツ）", "zC": "InfoMercial（PR 帯）", "zorder": "区の並び", "zorderHint": "上の2帯（Topic／InfoMercial）の順番をドラッグで入れ替え", "picZoneC": "InfoMercial へ", "tModel": "3Dモデル", "picTooBig": "{n}件をスキップ：12 MB を超えています", "picBadType": "{n}件をスキップ：画像でも3Dモデルでもありません", "insCard": "このカードの前に1枚挿入", "insTitle": "カードを挿入", "insHintOwner": "URL・埋め込みコード・Markdown を貼り付けてください。このカードの前に入ります。", "insHintGuest": "URL・埋め込みコード・Markdown を貼り付けてください。このカードの前に入ります。このブラウザにだけ保存され、他の訪問者には見えません。", "insPh": "https://…　·　<iframe> 埋め込みコード　·　<md>…</md>　·　https://…/model.glb", "insSave": "保存して挿入", "insCancel": "キャンセル", "insBad": "URL でも、埋め込みコードでも、表示できる <md>…</md> ブロックでもありません。", "insDone": "✓ カードを1枚挿入しました", "insDel": "自分が追加したカードを削除", "revTitle": "Co-WiKi カード", "revDrop": "このカードを削除", "revHint": "訪問者のカードは Co-WiKi としてすぐ公開されます。✓ で承認して常設に、✕ で全員の画面から削除します。", "revNone": "訪問者のカードはまだありません", "revDenied": "オーナーキーが違います。", "revFail": "サーバーに接続できません。", "revAsk": "オーナーキー", "syncOn": "接続中 — すべての訪問者と共有", "syncOff": "オフライン — 新しいカードは接続が戻るまでこのブラウザに残ります", "insHintLive": "URL・埋め込みコード・Markdown を貼り付けてください。このカードの前に Co-WiKi カードとして入り、すぐに全員に表示されます。オーナーが承認すると常設カードになります。", "insBusy": "サーバーがこのカードを受け付けませんでした。", "insRate": "ここからの投稿が多すぎます。しばらくしてからお試しください。", "insDown": "このウォールは現在オフラインのため、新しいカードをまだ共有できません。上のドットが緑になってからもう一度お試しください。", "insBig": "この Markdown カードは長すぎます。", "insMd": "M↓ Markdown", "insKinds": "3D：Sketchfab の埋め込み、または .glb／.stl／.obj の公開 https リンク", "insMdTpl": "# タイトル\n\nここに **Markdown** を書きます。リスト・表・リンク・https 画像が使えます。", "revOk": "承認して常設カードにする", "revPend": "承認待ち", "revOkd": "承認済み", "tMd": "Markdown", "sprTitle": "飛ぶ画像 🐝", "sprHint": "内蔵の 2 匹のハチはそのまま差し替えできます：⇄ で交換、✕ で削除、＋ で追加（最大 4 枚）。画像を枠にドロップしても交換できます。すべて削除すると訪問者の 🐝 ボタンは無効になります。", "sprRep": "画像を交換", "sprDel": "削除", "sprAdd": "飛ぶ画像を追加", "sprReset": "内蔵のハチに戻す", "sprDef": "内蔵", "sprNone": "飛ぶ画像がありません：🐝 ボタンは無効になります。", "sprBig": "画像が 2 MB を超えています。", "foldMore": "⌄ 全文を表示", "foldLess": "⌃ 折りたたむ"}, "ko": {"title": "월 편집", "upload": "업로드", "download": "다운로드", "copyWall": "독립 월 복사", "dlWall": "독립 월 저장", "clear": "비우기", "hint": "Enter로 ━━━━ 구분선｜경계선은 그 위 블록을 가리킵니다: ### 는 InfoMercial, === 는 Topic, 나머지는 Content｜Shift+Enter는 줄바꿈만｜Ctrl+Enter로 올리기", "placeholder": "URL을 한 줄에 하나씩 붙여넣기", "cancel": "취소", "push": "✓ 월에 올리기", "count": "{n}개", "layout": "레이아웃", "random": "랜덤", "cols": "{n}열", "openEditor": "편집기 열기", "close": "닫기", "edit": "편집", "language": "언어", "noInput": "URL이나 임베드 코드를 찾지 못했습니다", "skipped": "인식할 수 없는 {n}줄을 건너뛰었습니다", "storageFull": "⚠️ 저장 실패: 브라우저 저장 공간이 가득 찼거나 꺼져 있습니다. 먼저 백업을 다운로드하세요", "emptyWall": "월이 비어 있습니다. 먼저 콘텐츠를 올리세요", "copied": "✓ 독립 월 HTML을 복사했습니다({n}개)", "clipFallback": "클립보드를 쓸 수 없어 .html로 다운로드했습니다", "downloaded": "✓ 독립 월을 저장했습니다({n}개)", "fileEmpty": "이 파일에 사용할 수 있는 내용이 없습니다", "loaded": "✓ {n}개를 불러왔습니다", "loadedSkip": ", {n}개 건너뜀", "confirmClear": "이 월을 비울까요?", "wallEmpty": "이 월에는 아직 콘텐츠가 없습니다", "del": "삭제", "original": "원본", "shuffle": "셔플", "tombNote": "이 사이트는 임베드를 허용하지 않습니다", "openTab": "새 탭에서 열기", "markTomb": "임베드 불가로 표시", "tryEmbed": "다시 임베드 시도", "carousel": "캐러셀", "prev": "이전", "next": "다음", "page": "{n}페이지", "filter": "필터", "searchPh": "제목, 사이트, #태그 검색…", "fType": "유형", "fDate": "날짜", "fSort": "정렬", "tAll": "모든 유형", "tVideo": "동영상", "tAudio": "오디오", "tPage": "웹페이지", "tHtml": "HTML", "tBlocked": "임베드 불가", "dAny": "모든 날짜", "dToday": "오늘", "d7": "최근 7일", "d30": "최근 30일", "sWall": "정렬: 월 순서", "sNew": "최신순", "sOld": "오래된순", "sLong": "긴 순", "sShort": "짧은 순", "sAz": "제목순", "results": "{n} / {m}", "fClear": "지우기", "noMatch": "조건에 맞는 카드가 없습니다", "fTitle": "제목", "fTags": "태그", "fLength": "길이", "tagsPh": "쉼표로 구분", "lenPh": "분:초", "fxToggle": "이펙트", "resetPos": "위치 초기화", "moveCard": "카드 이동", "fxFire": "불꽃", "fxFly": "비행체", "fxSound": "사운드", "tabSheet": "EzSheet", "tabPics": "이미지 · 3D", "picDrop": "이미지나 3D 모델을 끌어다 놓거나 클릭해서 선택", "picHint": "이미지와 3D 모델(.glb .gltf .stl .obj)은 월에 직접 포함되어 외부 요청이 없습니다. 각각 카드로 쓸 수 있고, 이미지는 Topic 영역의 나는 이미지로도 쓸 수 있습니다.", "asCard": "카드로", "asSprite": "나는 이미지로", "picAdd": "카드로 추가", "picSprites": "나는 이미지로 적용", "spriteReset": "기본 벌로", "picZoneA": "Topic", "picZoneB": "Content", "picAdded": "이미지 카드 {n}개를 추가했습니다", "spriteOk": "나는 이미지 {n}개를 적용했습니다", "picNone": "이미지가 없습니다", "zA": "Topic(주제 밴드)", "zB": "Content(콘텐츠 월)", "zC": "InfoMercial(광고 밴드)", "zorder": "영역 순서", "zorderHint": "위 두 밴드(Topic／InfoMercial) 순서를 끌어서 변경", "picZoneC": "InfoMercial", "tModel": "3D 모델", "picTooBig": "{n}개 건너뜀: 12 MB 초과", "picBadType": "{n}개 건너뜀: 이미지나 3D 모델이 아닙니다", "insCard": "이 카드 앞에 한 장 삽입", "insTitle": "카드 삽입", "insHintOwner": "URL, 임베드 코드 또는 Markdown을 붙여 넣으세요. 이 카드 앞에 들어갑니다.", "insHintGuest": "URL, 임베드 코드 또는 Markdown을 붙여 넣으세요. 이 카드 앞에 들어갑니다. 이 브라우저에만 저장되어 다른 방문자에게는 보이지 않습니다.", "insPh": "https://…  ·  <iframe> 임베드 코드  ·  <md>…</md>  ·  https://…/model.glb", "insSave": "저장하고 삽입", "insCancel": "취소", "insBad": "URL, 임베드 코드, 또는 표시할 수 있는 <md>…</md> 블록이 아닙니다.", "insDone": "✓ 카드 한 장을 삽입했습니다", "insDel": "내가 추가한 카드 삭제", "revTitle": "Co-WiKi 카드", "revDrop": "이 카드 삭제", "revHint": "방문자 카드는 Co-WiKi로 바로 공개됩니다. ✓ 로 승인하면 영구 카드가 되고, ✕ 로 모두의 화면에서 삭제합니다.", "revNone": "아직 방문자 카드가 없습니다", "revDenied": "소유자 키가 올바르지 않습니다.", "revFail": "서버에 연결할 수 없습니다.", "revAsk": "소유자 키", "syncOn": "연결됨 — 모든 방문자와 공유", "syncOff": "오프라인 — 새 카드는 연결될 때까지 이 브라우저에 남습니다", "insHintLive": "URL, 임베드 코드 또는 Markdown을 붙여 넣으세요. 이 카드 앞에 Co-WiKi 카드로 들어가 모든 방문자에게 바로 보이며, 운영자가 승인하면 영구 카드가 됩니다.", "insBusy": "서버가 이 카드를 받지 않았습니다.", "insRate": "이곳에서 보낸 카드가 너무 많습니다. 잠시 후 다시 시도하세요.", "insDown": "이 월은 지금 오프라인이라 새 카드를 아직 공유할 수 없습니다. 위쪽 점이 초록색이 되면 다시 시도하세요.", "insBig": "이 Markdown 카드는 너무 깁니다.", "insMd": "M↓ Markdown", "insKinds": "3D: Sketchfab 임베드 또는 .glb / .stl / .obj 공개 https 링크", "insMdTpl": "# 제목\n\n여기에 **Markdown**을 쓰세요. 목록, 표, 링크, https 이미지를 쓸 수 있습니다.", "revOk": "승인하여 영구 카드로", "revPend": "승인 대기", "revOkd": "승인됨", "tMd": "Markdown", "sprTitle": "나는 이미지 🐝", "sprHint": "기본 벌 두 마리를 바로 바꿀 수 있습니다: ⇄ 교체, ✕ 삭제, ＋ 추가(최대 4장). 이미지를 칸에 끌어다 놓아도 됩니다. 모두 삭제하면 방문자의 🐝 버튼이 비활성화됩니다.", "sprRep": "이미지 교체", "sprDel": "삭제", "sprAdd": "나는 이미지 추가", "sprReset": "기본 벌로 되돌리기", "sprDef": "기본", "sprNone": "나는 이미지가 없습니다: 🐝 버튼이 비활성화됩니다.", "sprBig": "이미지가 2 MB를 넘습니다.", "foldMore": "⌄ 전체 보기", "foldLess": "⌃ 접기"}, "th": {"title": "แก้ไขวอลล์", "upload": "อัปโหลด", "download": "ดาวน์โหลด", "copyWall": "คัดลอกวอลล์แบบแยก", "dlWall": "ดาวน์โหลดวอลล์แบบแยก", "clear": "ล้าง", "hint": "Enter เพิ่มเส้นคั่น ━━━━ | เส้นแบ่งกำกับบล็อกเหนือมัน: ### คือ InfoMercial, === คือ Topic, ที่เหลือคือ Content | Shift+Enter ขึ้นบรรทัด | Ctrl+Enter ส่งขึ้นวอลล์", "placeholder": "วาง URL บรรทัดละหนึ่งรายการ", "cancel": "ยกเลิก", "push": "✓ ส่งขึ้นวอลล์", "count": "{n} รายการ", "layout": "เลย์เอาต์", "random": "สุ่ม", "cols": "{n} คอลัมน์", "openEditor": "เปิดตัวแก้ไข", "close": "ปิด", "edit": "แก้ไข", "language": "ภาษา", "noInput": "ไม่พบ URL หรือโค้ดฝัง", "skipped": "ข้ามบรรทัดที่อ่านไม่ออก {n} บรรทัด", "storageFull": "⚠️ บันทึกไม่ได้: พื้นที่เบราว์เซอร์เต็มหรือถูกปิดไว้ โปรดดาวน์โหลดสำรองก่อน", "emptyWall": "วอลล์ยังว่างอยู่ เพิ่มเนื้อหาก่อน", "copied": "✓ คัดลอก HTML วอลล์แบบแยกแล้ว ({n} รายการ)", "clipFallback": "ใช้คลิปบอร์ดไม่ได้ จึงดาวน์โหลดเป็น .html แทน", "downloaded": "✓ ดาวน์โหลดวอลล์แบบแยกแล้ว ({n} รายการ)", "fileEmpty": "ไม่มีเนื้อหาที่ใช้ได้ในไฟล์นี้", "loaded": "✓ โหลดแล้ว {n} รายการ", "loadedSkip": " ข้าม {n} รายการ", "confirmClear": "ล้างวอลล์นี้หรือไม่?", "wallEmpty": "วอลล์นี้ยังไม่มีเนื้อหา", "del": "ลบ", "original": "ต้นฉบับ", "shuffle": "สับไพ่", "tombNote": "เว็บไซต์นี้ไม่อนุญาตให้ฝัง", "openTab": "เปิดในแท็บใหม่", "markTomb": "ทำเครื่องหมายว่าฝังไม่ได้", "tryEmbed": "ลองฝังอีกครั้ง", "carousel": "ภาพหมุน", "prev": "ก่อนหน้า", "next": "ถัดไป", "page": "หน้า {n}", "filter": "ตัวกรอง", "searchPh": "ค้นหาชื่อ เว็บไซต์ #แท็ก…", "fType": "ประเภท", "fDate": "วันที่", "fSort": "เรียงลำดับ", "tAll": "ทุกประเภท", "tVideo": "วิดีโอ", "tAudio": "เสียง", "tPage": "หน้าเว็บ", "tHtml": "HTML", "tBlocked": "ฝังไม่ได้", "dAny": "ทุกวันที่", "dToday": "วันนี้", "d7": "7 วันล่าสุด", "d30": "30 วันล่าสุด", "sWall": "เรียง: ตามวอลล์", "sNew": "ใหม่สุดก่อน", "sOld": "เก่าสุดก่อน", "sLong": "ยาวสุดก่อน", "sShort": "สั้นสุดก่อน", "sAz": "เรียงตามชื่อ", "results": "{n} จาก {m}", "fClear": "ล้าง", "noMatch": "ไม่มีการ์ดที่ตรงกับตัวกรอง", "fTitle": "ชื่อ", "fTags": "แท็ก", "fLength": "ความยาว", "tagsPh": "คั่นด้วยจุลภาค", "lenPh": "นาที:วินาที", "fxToggle": "เอฟเฟกต์", "resetPos": "รีเซ็ตตำแหน่ง", "moveCard": "ย้ายการ์ด", "fxFire": "พลุ", "fxFly": "ตัวบิน", "fxSound": "เสียง", "tabSheet": "EzSheet", "tabPics": "รูปและ 3D", "picDrop": "วางรูปหรือโมเดล 3D ที่นี่ หรือคลิกเพื่อเลือกไฟล์", "picHint": "รูปและโมเดล 3D (.glb .gltf .stl .obj) จะฝังลงในวอลล์โดยตรง ไม่ดึงจากเครือข่าย แต่ละไฟล์ทำเป็นการ์ดได้ และรูปยังใช้แทนตัวบินในโซน Topic ได้", "asCard": "เป็นการ์ด", "asSprite": "เป็นตัวบิน", "picAdd": "เพิ่มเป็นการ์ด", "picSprites": "ใช้เป็นตัวบิน", "spriteReset": "กลับเป็นผึ้ง", "picZoneA": "Topic", "picZoneB": "Content", "picAdded": "เพิ่มการ์ดรูป {n} ใบแล้ว", "spriteOk": "ใช้ตัวบิน {n} รูปแล้ว", "picNone": "ยังไม่มีรูป", "zA": "Topic (แถบหัวข้อ)", "zB": "Content (ผนังเนื้อหา)", "zC": "InfoMercial (แถบโฆษณา)", "zorder": "ลำดับโซน", "zorderHint": "ลากเพื่อจัดลำดับสองแถบบน (Topic／InfoMercial)", "picZoneC": "InfoMercial", "tModel": "โมเดล 3D", "picTooBig": "ข้าม {n} ไฟล์: เกิน 12 MB", "picBadType": "ข้าม {n} ไฟล์: ไม่ใช่รูปหรือโมเดล 3D", "insCard": "แทรกการ์ดก่อนใบนี้", "insTitle": "แทรกการ์ด", "insHintOwner": "วาง URL โค้ดฝัง หรือ Markdown การ์ดจะแทรกก่อนการ์ดนี้", "insHintGuest": "วาง URL โค้ดฝัง หรือ Markdown การ์ดจะแทรกก่อนการ์ดนี้ และเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ผู้เยี่ยมชมคนอื่นจะไม่เห็น", "insPh": "https://…  ·  โค้ดฝัง <iframe>  ·  <md>…</md>  ·  https://…/model.glb", "insSave": "บันทึกและแทรก", "insCancel": "ยกเลิก", "insBad": "นี่ไม่ใช่ URL โค้ดฝัง หรือบล็อก <md>…</md> ที่ผนังนี้แสดงได้", "insDone": "✓ แทรกการ์ดแล้ว 1 ใบ", "insDel": "ลบการ์ดที่คุณเพิ่ม", "revTitle": "การ์ด Co-WiKi", "revDrop": "ลบการ์ดนี้", "revHint": "การ์ดของผู้เยี่ยมชมเผยแพร่ทันทีในชื่อ Co-WiKi กด ✓ เพื่ออนุมัติเป็นการ์ดถาวร กด ✕ เพื่อลบออกจากทุกคน", "revNone": "ยังไม่มีการ์ดจากผู้เข้าชม", "revDenied": "คีย์เจ้าของไม่ถูกต้อง", "revFail": "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "revAsk": "คีย์เจ้าของ", "syncOn": "เชื่อมต่ออยู่ — ผู้เข้าชมทุกคนเห็นตรงกัน", "syncOff": "ออฟไลน์ — การ์ดใหม่จะอยู่ในเบราว์เซอร์นี้จนกว่าจะเชื่อมต่อได้", "insHintLive": "วาง URL โค้ดฝัง หรือ Markdown การ์ดจะแทรกก่อนการ์ดนี้เป็นการ์ด Co-WiKi ทุกคนเห็นทันที และจะกลายเป็นการ์ดถาวรเมื่อเจ้าของอนุมัติ", "insBusy": "เซิร์ฟเวอร์ไม่รับการ์ดนี้", "insRate": "ส่งการ์ดจากที่นี่มากเกินไป กรุณาลองใหม่ภายหลัง", "insDown": "ขณะนี้วอลล์นี้ออฟไลน์ จึงยังแชร์การ์ดใหม่ไม่ได้ รอให้จุดด้านบนเป็นสีเขียวแล้วลองอีกครั้ง", "insBig": "การ์ด Markdown นี้ยาวเกินไป", "insMd": "M↓ Markdown", "insKinds": "3D: วางโค้ดฝัง Sketchfab หรือลิงก์ https สาธารณะของ .glb / .stl / .obj", "insMdTpl": "# หัวเรื่อง\n\nเขียน **Markdown** ที่นี่ ใช้รายการ ตาราง ลิงก์ และรูป https ได้", "revOk": "อนุมัติเป็นการ์ดถาวร", "revPend": "รออนุมัติ", "revOkd": "อนุมัติแล้ว", "tMd": "Markdown", "sprTitle": "ภาพที่บินได้ 🐝", "sprHint": "ผึ้งในตัวสองตัวเปลี่ยนได้ทันที: ⇄ เปลี่ยนภาพ ✕ ลบ ＋ เพิ่ม (สูงสุด 4 ภาพ) หรือลากภาพมาวางบนช่อง ถ้าลบหมด ปุ่ม 🐝 ของผู้เยี่ยมชมจะใช้ไม่ได้", "sprRep": "เปลี่ยนภาพ", "sprDel": "ลบ", "sprAdd": "เพิ่มภาพที่บินได้", "sprReset": "กลับเป็นผึ้งในตัว", "sprDef": "ในตัว", "sprNone": "ไม่มีภาพที่บินได้ ปุ่ม 🐝 จะใช้ไม่ได้", "sprBig": "ภาพใหญ่เกิน 2 MB", "foldMore": "⌄ ดูทั้งหมด", "foldLess": "⌃ ย่อ"}};
let LANG='en';
function setLangCode(l){LANG=I18N[l]?l:'en';return LANG;}
function getLang(){return LANG;}
function t(k,v){let s=(I18N[LANG]||{})[k];if(s==null)s=I18N.en[k];if(s==null)s=k;return v?s.replace(/\{(\w+)\}/g,(_,x)=>v[x]!=null?v[x]:''):s;}
function colsText(n){return t(n===1&&I18N[LANG].col1?'col1':'cols',{n});}
function applyI18n(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.i18nAria));el.title=t(el.dataset.i18nAria);});
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
  document.querySelectorAll('[data-i18n-cols]').forEach(el=>{el.textContent=colsText(+el.dataset.i18nCols);});
  document.querySelectorAll('.item .del').forEach(b=>b.setAttribute('aria-label',t('del')));
  document.querySelectorAll('.item .edit').forEach(b=>b.setAttribute('aria-label',t('edit')));
}
const LANGS=[['en','EN'],['zh-TW','繁中'],['zh-CN','简中'],['ja','日本語'],['ko','한국어'],['th','ไทย']];
function langSelectHTML(){return '<select id="lang" class="lang-select" data-i18n-aria="language">'+LANGS.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('')+'</select>';}

/* ---------- 版面下拉：-1＝原始（獨立牆專用）、0＝隨機、1~4＝欄 ---------- */
const bars=n=>'<span class="ci">'+'<i></i>'.repeat(n)+'</span>';
function menuHTML(withOriginal){
  let items=withOriginal?'<button role="menuitemradio" data-cols="-1"><span class="mi">📌</span><span data-i18n="original"></span></button>':'';
  items+='<button data-reset="1"><span class="mi">↺</span><span data-i18n="resetPos"></span></button><hr>';
  items+='<button role="menuitemradio" data-cols="0"><span class="mi">🎲</span><span data-i18n="random"></span></button><hr>';
  for(let n=1;n<=COLS_QUICK;n++)items+='<button role="menuitemradio" data-cols="'+n+'"><span class="mi">'+bars(Math.min(n,4))+(n>4?'<b class="cn">'+n+'</b>':'')+'</span><span data-i18n-cols="'+n+'"></span></button>';
  return '<div class="menu-wrap" id="menuWrap"><button id="layoutBtn" class="pill" aria-haspopup="menu" aria-expanded="false" aria-controls="layoutMenu"><span class="mi" id="layoutIcon"></span><span class="lbl" id="layoutText"></span><span class="caret">▼</span></button><div id="layoutMenu" class="menu" role="menu" hidden>'+items+'</div></div>';
}
function updateLayoutUI(mode){
  document.querySelectorAll('#layoutMenu [data-cols]').forEach(b=>{const on=+b.dataset.cols===mode;b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});
  const txt=mode>0?colsText(mode):mode===0?t('random'):t('original');
  const icon=document.getElementById('layoutIcon');if(!icon)return;
  icon.innerHTML=mode>0?bars(Math.min(mode,4))+(mode>4?'<b class="cn">'+mode+'</b>':''):mode===0?'🎲':'📌';
  document.getElementById('layoutText').textContent=txt;
  const b=document.getElementById('layoutBtn');b.classList.toggle('random',mode===0);
  b.setAttribute('aria-label',t('layout')+': '+txt);b.title=t('layout')+': '+txt;
}
/* 點外面、Esc、選完都會關閉；方向鍵、Home、End 可移動 */
function bindMenu(onPick){
  const menu=document.getElementById('layoutMenu'),btn=document.getElementById('layoutBtn'),wrap=document.getElementById('menuWrap');
  const items=()=>[...menu.querySelectorAll('button')];
  const open=()=>{menu.hidden=false;btn.setAttribute('aria-expanded','true');(menu.querySelector('.on')||items()[0]).focus();};
  const close=f=>{if(menu.hidden)return;menu.hidden=true;btn.setAttribute('aria-expanded','false');if(f)btn.focus();};
  btn.addEventListener('click',()=>menu.hidden?open():close(false));
  btn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&menu.hidden){e.preventDefault();open();}});
  menu.addEventListener('click',e=>{
    const r=e.target.closest('[data-reset]');if(r){close(true);onPick('reset');return;}
    const b=e.target.closest('[data-cols]');if(!b)return;close(true);onPick(+b.dataset.cols);
  });

  menu.addEventListener('keydown',e=>{
    const it=items(),i=it.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault();it[(i+1)%it.length].focus();}
    else if(e.key==='ArrowUp'){e.preventDefault();it[(i-1+it.length)%it.length].focus();}
    else if(e.key==='Home'){e.preventDefault();it[0].focus();}
    else if(e.key==='End'){e.preventDefault();it[it.length-1].focus();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
    else if(e.key==='Tab')close(false);
  });
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!wrap.contains(e.target))close(false);});
}


/* ---------- 洗牌 ----------
   只改資料順序再重新排版，卡片節點不搬動，所以 iframe 不會重新載入。
   動畫三段：收成一疊 → 左右分兩半交錯洗兩次 → 依新順序一張張發回去 */
function shuffled(a){
  if(a.length<2)return a.slice();
  let b;do{b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}}
  while(b.every((o,i)=>o===a[i]));
  return b;
}
function shuffleBtnHTML(){return '<button id="shuffleBtn" class="pill shuffle" data-i18n-aria="shuffle"><span class="mi">🔀</span><span class="lbl" data-i18n="shuffle"></span></button>';}
let busy=false;
async function reorderAnimated(wall,next,commit){
  if(busy)return false;
  const els=new Map([...wall.querySelectorAll('.item')].map(el=>[el.dataset.id,el]));
  const apply=()=>{if(commit)commit();};
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||typeof Element.prototype.animate!=='function'||els.size<2||wall.classList.contains('carousel')){wall._carPage=0;wall._carFirst=-1;wall.scrollLeft=0;apply();return true;}
  busy=true;document.body.classList.add('shuffling');
  const btn=document.getElementById('shuffleBtn');if(btn)btn.setAttribute('aria-busy','true');
  const cards=[...els.values()].filter(el=>!el.classList.contains('f-out'));
  try{
    const cx=innerWidth/2,cy=innerHeight/2,CARD=150,n=cards.length;
    const info=new Map(cards.map(el=>{const r=el.getBoundingClientRect();return [el,{r,s:Math.min(1,CARD/Math.max(1,r.width)),rot:Math.random()*14-7}];}));
    /* 把卡片中心移到畫面中心，縮成撲克牌大小並微微歪斜；dx/rot 用來做洗牌時的左右分開 */
    const T=(el,dx=0,rot=0)=>{const f=info.get(el);return `translate(${cx-(f.r.left+f.r.width/2)+dx}px,${cy-(f.r.top+f.r.height/2)}px) rotate(${f.rot+rot}deg) scale(${f.s})`;};
    const setZ=list=>list.forEach((el,k)=>{el.style.zIndex=String(1+k);});

    /* 1. 收牌 */
    setZ(cards);
    const g=Math.min(35,520/n);
    await Promise.all(cards.map((el,k)=>el.animate([{transform:'none'},{transform:T(el)}],
      {duration:480,delay:k*g,easing:'cubic-bezier(.55,0,.25,1)',fill:'forwards'}).finished));

    /* 2. 洗兩次：分成左右兩半、交錯疊回。第二次疊回時，最上面就是新順序的第一張 */
    const dealOrder=next.map(o=>els.get(o._id)).filter(el=>el&&!el.classList.contains('f-out'));
    for(let pass=0;pass<2;pass++){
      const stackNow=[...cards].sort((a,b)=>(+a.style.zIndex)-(+b.style.zIndex));
      const half=Math.max(1,Math.ceil(n/2)),L=stackNow.slice(0,half),R=stackNow.slice(half);
      const woven=[];for(let i=0;i<half;i++){if(L[i])woven.push(L[i]);if(R[i])woven.push(R[i]);}
      const zAfter=pass===0?woven:[...dealOrder].reverse();
      const anims=stackNow.map((el,k)=>{const side=k<half?-1:1;
        return el.animate([{transform:T(el)},{transform:T(el,side*120,side*8),offset:.45},{transform:T(el)}],
          {duration:600,delay:(k%half)*8,easing:'ease-in-out',fill:'forwards'}).finished;});
      setTimeout(()=>setZ(zAfter),300);
      await Promise.all(anims);
    }

    /* 3. 發牌：同一個步驟內取消動畫、換順序、量新位置，再從牌堆飛回，畫面不會閃 */
    cards.forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
    apply();
    dealOrder.forEach((el,k)=>{info.get(el).r=el.getBoundingClientRect();el.style.zIndex=String(n+1-k);});
    const d=Math.min(80,1200/n);
    await Promise.all(dealOrder.map((el,k)=>el.animate([{transform:T(el)},{transform:'none'}],
      {duration:560,delay:k*d,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}).finished));
  }catch(e){cards.forEach(el=>el.getAnimations().forEach(a=>a.cancel()));apply();}
  finally{
    cards.forEach(el=>{el.style.zIndex='';});
    document.body.classList.remove('shuffling');
    if(btn)btn.removeAttribute('aria-busy');
    busy=false;
    /* 洗牌途中所有卡都經過畫面中央；等可見範圍更新後，只載入真正落在畫面附近的 */
    requestAnimationFrame(()=>requestAnimationFrame(()=>{wall.querySelectorAll('.item').forEach(el=>{if(el._vis||el._keep)mountQ.add(el);});pump();}));
  }
  return true;
}

/* ---------- 開場特效 ----------
   1) B 區滿版煙火 2 秒 2) 接著一艘飛船掠過 A 區。
   都畫在暫時的圖層上，播完立刻移除，不影響卡片與嵌入內容。 */
/* 想換成自己的飛碟圖片：填直接的圖片網址（.png/.webp，建議透明背景）或 data: URI。
   留空就用內建的向量飛碟。圖片載入失敗會自動退回向量版。 */
const BEE_DEFAULT=['data:image/webp;base64,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','data:image/webp;base64,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'];
/* Flying sprites can be replaced at runtime (window.WALL_SPRITES), so the editor and
   exported walls can carry their own artwork. */
/* 飛行圖示清單：'bee:0'／'bee:1' 代表內建的兩隻蜜蜂（不必重複內嵌），其餘是 data:image/…。
   編輯器與產生器把目前的清單寫進 window.WALL_SPRITES；空陣列＝不放飛行物，🐝 鍵停用。
   舊版匯出沒有這個變數時，才退回內建蜜蜂。 */
const SPRITE_MAX=4,SPRITE_BYTES=2*1024*1024,SPRITE_DEF=['bee:0','bee:1'];
function spriteSrc(x){const m=/^bee:(\d)$/.exec(String(x));return m?(BEE_DEFAULT[+m[1]]||''):(/^data:image\/[\w.+-]+[;,]/.test(String(x))?String(x):'');}
function validSprites(a){return Array.isArray(a)?a.filter(x=>typeof x==='string'&&spriteSrc(x)).slice(0,SPRITE_MAX):null;}
const beeImgs=()=>(validSprites(window.WALL_SPRITES)||SPRITE_DEF).map(spriteSrc);
/* 飛行圖示編輯列（編輯器、產生器共用）：縮圖＋⇄ 換圖＋✕ 移除＋＋ 新增＋↺ 恢復內建。
   也可以直接把圖檔拖到某一格上替換。get() 取目前清單，set(新清單) 存回去。 */
function spriteStrip(box,get,set,tr){
  tr=tr||t;
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.hidden=true;
  let slot=-1;
  const put=(file,i)=>{
    if(!file||!/^image\//.test(file.type))return;
    if(file.size>SPRITE_BYTES){box.dataset.err=tr('sprBig');paint();return;}
    const r=new FileReader();
    r.onload=()=>{const a=get().slice(),v=String(r.result);if(!spriteSrc(v))return;
      if(i>=0&&i<a.length)a[i]=v;else if(a.length<SPRITE_MAX)a.push(v);else a[a.length-1]=v;
      delete box.dataset.err;set(a);paint();};
    r.readAsDataURL(file);
  };
  function paint(){
    const a=get();
    box.innerHTML='<div class="spr-row">'+a.map((x,i)=>'<div class="spr" data-i="'+i+'">'
        +'<img src="'+esc(spriteSrc(x))+'" alt="">'+(/^bee:/.test(x)?'<span class="spr-tag">'+esc(tr('sprDef'))+'</span>':'')
        +'<div class="spr-acts"><button type="button" data-rep="'+i+'" title="'+esc(tr('sprRep'))+'" aria-label="'+esc(tr('sprRep'))+'">⇄</button>'
        +'<button type="button" data-del="'+i+'" title="'+esc(tr('sprDel'))+'" aria-label="'+esc(tr('sprDel'))+'">✕</button></div></div>').join('')
      +(a.length<SPRITE_MAX?'<button type="button" class="spr-add" data-add title="'+esc(tr('sprAdd'))+'" aria-label="'+esc(tr('sprAdd'))+'">＋</button>':'')
      +'<button type="button" class="spr-reset" data-reset title="'+esc(tr('sprReset'))+'" aria-label="'+esc(tr('sprReset'))+'">↺</button></div>'
      +(a.length?'':'<div class="spr-note">'+esc(tr('sprNone'))+'</div>')
      +(box.dataset.err?'<div class="spr-note bad">'+esc(box.dataset.err)+'</div>':'');
    box.appendChild(inp);
  }
  box.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!box.contains(b))return;
    if(b.dataset.rep!=null){slot=+b.dataset.rep;inp.click();}
    else if(b.dataset.add!=null){slot=-1;inp.click();}
    else if(b.dataset.del!=null){const a=get().slice();a.splice(+b.dataset.del,1);set(a);paint();}
    else if(b.dataset.reset!=null){delete box.dataset.err;set(SPRITE_DEF.slice());paint();}
  });
  inp.addEventListener('change',()=>{put(inp.files[0],slot);inp.value='';});
  box.addEventListener('dragover',e=>{if(e.target.closest('.spr,.spr-add')){e.preventDefault();e.stopPropagation();}});
  box.addEventListener('drop',e=>{
    const el=e.target.closest('.spr,.spr-add');if(!el)return;
    e.preventDefault();e.stopPropagation();
    put(e.dataTransfer.files[0],el.classList.contains('spr')?+el.dataset.i:-1);
  });
  paint();
  return {paint};
}
const FX_COLORS=['#FFE27A','#0E7C7B','#F7F5F1','#FF8A65','#81C784','#64B5F6'];
const fxReduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
/* 煙火固定在可視範圍內：不論捲到哪裡都看得到，也不會多畫看不見的地方 */
function fireworks(target,ms,done){
  if(fxReduce()){if(done)done();return;}
  const W=Math.max(320,innerWidth),H=Math.max(240,innerHeight);
  const cv=document.createElement('canvas');
  cv.className='fx-layer';cv.width=W;cv.height=H;cv.style.width=W+'px';cv.style.height=H+'px';
  document.body.appendChild(cv);
  const g=cv.getContext('2d'),parts=[],rockets=[],t0=performance.now(),fade=900,CAP=2400;
  let next=0,lastFinale=-9000;
  const launch=()=>{
    const x=W*(0.12+Math.random()*0.76),y=H*(0.14+Math.random()*0.42);
    rockets.push({x,y:H+10,tx:x,ty:y,c:FX_COLORS[(Math.random()*FX_COLORS.length)|0]});
    sfxLaunch();
  };
  /* gen 0：主爆；gen 1：碎裂後的二次小爆，畫面更熱鬧 */
  const burst=(x,y,c,gen)=>{
    const big=!gen,ring=big&&Math.random()<0.3,willow=big&&!ring&&Math.random()<0.28;
    const n=big?(120+((Math.random()*70)|0)):(22+((Math.random()*14)|0)),sp=(big?5.2:2.4)+Math.random()*3.6;
    for(let i=0;i<n;i++){
      const a=(Math.PI*2*i)/n+Math.random()*(ring?.05:.2);
      const v=sp*(ring?(0.92+Math.random()*0.16):(0.45+Math.random()*1.05));
      parts.push({x,y,px:x,py:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,c,
        r:(big?5.6:3.2)+Math.random()*4.2,gen:gen||0,split:big&&Math.random()<0.26,
        drag:willow?0.995:0.988,fall:willow?0.022:0.045,slow:willow?0.0055:0});   /* 垂枝：慢慢往下淌 */
    }
    if(parts.length>CAP)parts.splice(0,parts.length-CAP);
  };
  const tick=now=>{
    const el=now-t0;
    /* 每約 14 秒來一次大齊放 */
    if(el-lastFinale>14000&&el<ms){lastFinale=el;for(let f=0;f<6;f++)setTimeout(launch,f*90);}
    if(el>=next&&el<ms){
      launch();if(Math.random()<.6)launch();
      if(Math.random()<.16){launch();launch();}        /* 偶爾來個齊放 */
      next=el+(ms>10000?380+Math.random()*220:Math.max(140,ms/16));
    }
    /* 背景短暫壓暗，煙火才亮得起來 */
    /* 開場壓暗讓煙火跳出來，接著慢慢還原亮度，長時間播放也不會遮住內容 */
    const hold=Math.min(ms,9000),ease=Math.min(1,Math.max(0,(el-hold)/6000));
    const base=0.46-(0.46-0.14)*ease;
    const veil=base*Math.min(1,el/240)*(ms===Infinity?1:Math.min(1,Math.max(0,(ms+fade-el)/fade)));
    g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
    g.fillStyle='rgba(12,12,14,'+veil.toFixed(3)+')';g.fillRect(0,0,W,H);
    g.globalCompositeOperation='lighter';
    for(let i=rockets.length-1;i>=0;i--){
      const k=rockets[i];k.y-=10+Math.random()*3;
      g.strokeStyle=k.c;g.lineWidth=3.4;g.globalAlpha=.95;
      g.beginPath();g.moveTo(k.x,k.y);g.lineTo(k.x,k.y+20);g.stroke();
      if(k.y<=k.ty){burst(k.x,k.ty,k.c,0);sfxBoom(k.x/W);rockets.splice(i,1);}
    }
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      p.px=p.x;p.py=p.y;p.x+=p.vx;p.y+=p.vy;p.vy+=(p.fall||0.045);
      const dr=p.drag||0.988;p.vx*=dr;p.vy*=dr;
      p.life-=p.gen?0.016:(p.slow?p.slow:0.009);
      if(p.life<=0){parts.splice(i,1);continue;}
      if(p.split&&p.life<0.55){p.split=false;burst(p.x,p.y,FX_COLORS[(Math.random()*FX_COLORS.length)|0],1);}
      const tw=p.life>0.6?1:0.55+0.45*Math.sin(el/28+p.x);       /* 尾段閃爍 */
      g.globalAlpha=Math.max(0,p.life*tw);g.lineCap='round';
      g.strokeStyle=p.c;g.lineWidth=p.r;
      g.beginPath();g.moveTo(p.px,p.py);g.lineTo(p.x,p.y);g.stroke();
      if(p.life>0.45){                                            /* 中心白熱核心，更亮 */
        g.globalAlpha=Math.max(0,(p.life-0.45)*1.6*tw);g.strokeStyle='#fff';g.lineWidth=Math.max(1,p.r*0.42);
        g.beginPath();g.moveTo(p.px,p.py);g.lineTo(p.x,p.y);g.stroke();
      }
    }
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if(cv._stop){cv.remove();return;}
    if(ms===Infinity||el<ms+fade+400)requestAnimationFrame(tick);
    else{cv.remove();if(done)done();}
  };
  requestAnimationFrame(tick);
}
/* 兩隻蜜蜂在 A 區帶狀範圍內各自亂飛，路徑隨機所以會交錯而過。
   位置固定在視界內，捲動時不會飛走；每飛完一段就重新抽一條新路徑。 */
function beeBand(){
  const za=document.getElementById('zoneA');
  if(za&&!za.hidden){
    const r=za.getBoundingClientRect();
    if(r.bottom>0&&r.top<innerHeight)return {top:Math.max(4,r.top),h:Math.max(120,r.height)};
  }
  return {top:Math.round(innerHeight*0.08),h:Math.round(innerHeight*0.3)};
}
/* 3D 飛行：除了左右上下，還有遠近（Z 軸）。
   近的放大、亮一點、蓋住另一隻；遠的縮小、淡一點、稍微模糊，兩隻交錯時就有前後穿越的感覺。
   轉向用 rotateY，轉彎時 rotateZ 帶一點側傾。 */
const PERSP=900;
function beeHop(el,i){
  if(!el.isConnected||el._stopped)return;
  const band=beeBand(),W=innerWidth,img=el.querySelector('img'),bw=(img&&img.width)||150;
  const k=[],n=5+((Math.random()*3)|0);
  let x=el._x==null?(i?W+bw:-bw):el._x,
      y=el._y==null?band.top+band.h*(i?0.55:0.25):el._y,
      z=el._z==null?(i?-200:60):el._z;
  const frame=(px,py,pz,off)=>{
    const dx=px-x,dy=py-y;
    const yaw=Math.max(-52,Math.min(52,dx*0.16))+(dx<0?180:0);   /* 朝著去向轉身 */
    const bank=Math.max(-16,Math.min(16,-dx*0.035+dy*0.03));      /* 轉彎側傾 */
    const sc=PERSP/(PERSP-pz);
    k.push({
      transform:'perspective('+PERSP+'px) translate3d('+Math.round(px)+'px,'+Math.round(py)+'px,'+Math.round(pz)+'px) rotateY('+yaw.toFixed(1)+'deg) rotateZ('+bank.toFixed(1)+'deg)',
      opacity:(0.72+0.28*Math.min(1,sc)).toFixed(2),
      filter:'drop-shadow(0 '+Math.round(6*sc)+'px '+Math.round(12*sc)+'px rgba(0,0,0,.3)) blur('+(pz<-260?1.2:0).toFixed(1)+'px) brightness('+(0.86+0.14*Math.min(1.2,sc)).toFixed(2)+')',
      offset:off
    });
    x=px;y=py;z=pz;
  };
  frame(x,y,z,0);
  for(let j=1;j<=n;j++){
    const px=-bw*0.4+Math.random()*(W-bw*0.2),
          py=band.top+Math.random()*(band.h-40),
          pz=-420+Math.random()*560;                              /* 由遠到近 */
    frame(px,py,pz,j/n);
  }
  el._x=x;el._y=y;el._z=z;
  if(i===0)buzzAt(x/Math.max(1,innerWidth),(z+420)/560);
  /* 近的那隻蓋住遠的那隻 */
  clearInterval(el._zt);
  el._zt=setInterval(()=>{
    const m=(el.style.transform||'').match(/translate3d\([^,]+,[^,]+,(-?[\d.]+)px\)/);
    if(m)el.style.zIndex=String(9+Math.round((+m[1]+420)/120));
  },500);
  const a=el.animate(k,{duration:7000+Math.random()*6000,easing:'ease-in-out',fill:'forwards'});
  el._anim=a;
  a.finished.then(()=>beeHop(el,i)).catch(()=>{});
}
function flyBees(){
  beeImgs().forEach((src,i)=>{
    if(document.querySelector('.fx-bee[data-bee="'+i+'"]'))return;
    const d=document.createElement('div');d.className='fx-bee';d.dataset.bee=i;
    const wob=document.createElement('span');wob.className='wob';
    const im=new Image();im.src=src;im.alt='';im.decoding='async';
    im.onerror=()=>d.remove();
    wob.appendChild(im);d.appendChild(wob);
    d._stop=()=>{d._stopped=true;clearInterval(d._zt);if(d._anim)d._anim.cancel();d.remove();};
    document.body.appendChild(d);
    setTimeout(()=>beeHop(d,i),i*900);
  });
}
/* ---------- 音效 ----------
   全部用 Web Audio 即時合成，沒有任何外部音檔，所以獨立牆仍然是單檔、離線可用。
   瀏覽器規定要有使用者動作才能出聲，因此音訊在第一次點擊後才會啟動。 */
let AC=null,MASTER=null,SND=true;
function audio(){
  if(AC)return AC;
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  AC=new C();MASTER=AC.createGain();MASTER.gain.value=SND?0.5:0;MASTER.connect(AC.destination);
  return AC;
}
function audioResume(){const c=audio();if(c&&c.state==='suspended')c.resume();}
function sndSet(on){
  SND=!!on;try{localStorage.setItem('wiki_snd',SND?'1':'0');}catch(e){}
  if(MASTER&&AC)MASTER.gain.setTargetAtTime(SND?0.5:0,AC.currentTime,0.05);
  const b=document.getElementById('sndBtn');
  if(b){b.setAttribute('aria-pressed',SND);b.querySelector('.mi').textContent=SND?'🔊':'🔇';}
  if(SND){audioResume();if(fxFly)buzzStart();}else buzzStop();
}
/* 升空：短促的上滑哨音 */
function sfxLaunch(){
  const c=audio();if(!c||!SND||!fxFw)return;
  const o=c.createOscillator(),g=c.createGain();
  o.type='sine';o.frequency.setValueAtTime(420,c.currentTime);
  o.frequency.exponentialRampToValueAtTime(1500,c.currentTime+0.45);
  g.gain.setValueAtTime(0.0001,c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.05,c.currentTime+0.06);
  g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.5);
  o.connect(g);g.connect(MASTER);o.start();o.stop(c.currentTime+0.55);
}
/* 爆炸：低頻轟聲＋白噪尾巴，位置決定左右聲道 */
function sfxBoom(pan){
  const c=audio();if(!c||!SND||!fxFw)return;
  const dur=1.1,sr=c.sampleRate,buf=c.createBuffer(1,Math.round(sr*dur),sr),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(Math.random()*2-1)*Math.pow(1-t,3);}
  const n=c.createBufferSource();n.buffer=buf;
  const lp=c.createBiquadFilter();lp.type='lowpass';
  lp.frequency.setValueAtTime(1800,c.currentTime);
  lp.frequency.exponentialRampToValueAtTime(220,c.currentTime+0.7);
  const g=c.createGain();
  g.gain.setValueAtTime(0.28,c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008,c.currentTime+dur);
  const th=c.createOscillator(),tg=c.createGain();
  th.type='sine';th.frequency.setValueAtTime(90,c.currentTime);
  th.frequency.exponentialRampToValueAtTime(38,c.currentTime+0.35);
  tg.gain.setValueAtTime(0.22,c.currentTime);
  tg.gain.exponentialRampToValueAtTime(0.0008,c.currentTime+0.5);
  let out=MASTER;
  if(c.createStereoPanner){const sp=c.createStereoPanner();sp.pan.value=Math.max(-1,Math.min(1,(pan||0.5)*2-1));sp.connect(MASTER);out=sp;}
  n.connect(lp);lp.connect(g);g.connect(out);th.connect(tg);tg.connect(out);
  n.start();th.start();th.stop(c.currentTime+0.5);
}
/* 飛行物：持續的嗡嗡聲，音量與左右位置跟著飛行位置走 */
let BUZZ=null;
function buzzStart(){
  const c=audio();if(!c||!SND||!fxFly||BUZZ)return;
  const o1=c.createOscillator(),o2=c.createOscillator(),lfo=c.createOscillator();
  const lg=c.createGain(),lp=c.createBiquadFilter(),g=c.createGain();
  o1.type='sawtooth';o1.frequency.value=112;o2.type='sawtooth';o2.frequency.value=119;
  lfo.type='sine';lfo.frequency.value=7.5;lg.gain.value=14;lfo.connect(lg);
  lg.connect(o1.frequency);lg.connect(o2.frequency);
  lp.type='lowpass';lp.frequency.value=900;lp.Q.value=6;
  g.gain.value=0.0001;
  let out=g;
  const pan=c.createStereoPanner?c.createStereoPanner():null;
  o1.connect(lp);o2.connect(lp);lp.connect(g);
  if(pan){g.connect(pan);pan.connect(MASTER);}else g.connect(MASTER);
  o1.start();o2.start();lfo.start();
  g.gain.setTargetAtTime(0.035,c.currentTime,0.6);
  BUZZ={o1,o2,lfo,g,pan};
}
function buzzStop(){
  if(!BUZZ||!AC)return;
  const b=BUZZ;BUZZ=null;
  b.g.gain.setTargetAtTime(0.0001,AC.currentTime,0.15);
  setTimeout(()=>{try{b.o1.stop();b.o2.stop();b.lfo.stop();}catch(e){}},400);
}
/* 蜜蜂飛到哪，嗡嗡聲就偏到哪、近的大聲遠的小聲 */
function buzzAt(x,depth){
  if(!BUZZ||!AC)return;
  if(BUZZ.pan)BUZZ.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,x*2-1)),AC.currentTime,0.25);
  BUZZ.g.gain.setTargetAtTime(0.02+0.03*Math.max(0,Math.min(1,depth)),AC.currentTime,0.4);
}

/* ---------- 特效開關 ----------
   煙火與飛行物各自獨立，狀態分開記住；另有一顆音效總開關。
   兩個特效都從載入就開始跑，分頁切到背景時自動暫停。 */
let fxFw=false,fxFly=false,fxT=0,fxWall=null;   /* 預設關閉 */
function fxClearFly(){
  document.querySelectorAll('.fx-bee,.fx-spark').forEach(el=>{
    if(el._stop)el._stop();
    el.getAnimations&&el.getAnimations().forEach(a=>a.cancel());el.remove();
  });
  buzzStop();
}
function fxClearFw(){document.querySelectorAll('.fx-layer').forEach(c=>{c._stop=true;});}
function fxClear(){fxClearFly();fxClearFw();}
function fxStart(wall){
  fxWall=wall||fxWall;
  if(document.hidden||fxReduce()||!fxWall)return;
  if(fxFly&&beeImgs().length){flyBees();if(SND)buzzStart();}
  if(fxFw&&!document.querySelector('.fx-layer'))fireworks(fxWall,Infinity,null);
}
function fxPaint(){
  const f=document.getElementById('fwBtn'),y=document.getElementById('flyBtn'),n=document.getElementById('sndBtn');
  if(f){f.setAttribute('aria-pressed',fxFw);f.querySelector('.mi').textContent=fxFw?'🎆':'🌑';}
  if(y){y.setAttribute('aria-pressed',fxFly);y.querySelector('.mi').textContent=fxFly?'🐝':'💤';y.disabled=!beeImgs().length;}
  if(n){n.setAttribute('aria-pressed',SND);n.querySelector('.mi').textContent=SND?'🔊':'🔇';}
}
function fxSetFw(on){
  fxFw=!!on;try{localStorage.setItem('wiki_fx_fw2',fxFw?'1':'0');}catch(e){}
  fxPaint();audioResume();
  fxFw?fxStart():fxClearFw();
}
function fxSetFly(on){
  fxFly=!!on;try{localStorage.setItem('wiki_fx_fly2',fxFly?'1':'0');}catch(e){}
  fxPaint();audioResume();
  fxFly?fxStart():fxClearFly();
}
function fxSet(on){fxSetFw(on);fxSetFly(on);}        /* 舊介面：兩個一起開關 */
/* 目前的特效開關，匯出獨立牆時當作預設值寫進去 */
function fxState(){return {fw:fxFw,fly:fxFly,snd:SND};}
/* 作者匯出時的特效預設；訪客自己在 localStorage 的選擇仍然優先（見 fxInit） */
/* 煙火與飛行物一律預設關閉，不看 EzSheet／匯出設定；只剩音效沿用作者的設定 */
function fxDefaults(d){
  if(!d||typeof d!=='object')return;
  if(typeof d.snd==='boolean')SND=d.snd;
}
function fwBtnHTML(){return '<button id="fwBtn" class="pill fx" aria-pressed="false" data-i18n-aria="fxFire"><span class="mi">🎆</span></button>';}
function flyBtnHTML(){return '<button id="flyBtn" class="pill fx" aria-pressed="false" data-i18n-aria="fxFly"><span class="mi">🐝</span></button>';}
function sndBtnHTML(){return '<button id="sndBtn" class="pill snd" aria-pressed="true" data-i18n-aria="fxSound"><span class="mi">🔊</span></button>';}
function fxBtnHTML(){return '<span id="fxGroup" class="fx-group">'+fwBtnHTML()+flyBtnHTML()+sndBtnHTML()+'</span>';}
/* 這面牆有沒有「放進來的東西」——圖卡、3D 卡，或自訂的飛行圖示。
   都沒有的話特效就沒有對象，MagicBar 上不擺特效鍵，特效本身也不跑。 */
function isMediaCard(o){
  if(!o)return false;
  if(o.type==='model'||o.pic===true)return true;
  return o.type==='html'&&/<img\b[^>]*\bsrc=["']data:image\//i.test(o.html||'');
}
/* 特效鍵一律出現（不再看牆裡有沒有圖卡／3D 卡） */
function fxAvailable(){return true;}
/* 顯示／收起整組特效鍵。收起時特效停掉，但不寫進 localStorage，
   之後放了檔案再出現時，使用者原本的開關選擇還在。 */
let fxOff=false;
function fxShow(on){
  const g=document.getElementById('fxGroup');
  if(g)g.hidden=!on;
  const was=fxOff;fxOff=!on;
  if(fxOff){fxClear();buzzStop();}
  else if(was&&fxWall)playFX(fxWall,200);
}
function playFX(wall,delay){
  fxWall=wall;
  if(fxOff)return;
  clearTimeout(fxT);
  fxT=setTimeout(()=>fxStart(wall),delay||0);
}
function fxInit(wall){
  /* 訪客自己按過的開關優先於作者匯出時的預設；沒按過才用作者的預設 */
  try{
    const g=k=>localStorage.getItem(k);
    if(g('wiki_fx_fw2')!==null)fxFw=g('wiki_fx_fw2')==='1';
    if(g('wiki_fx_fly2')!==null)fxFly=g('wiki_fx_fly2')==='1';
    if(g('wiki_snd')!==null)SND=g('wiki_snd')==='1';
  }catch(e){}
  fxPaint();
  const f=document.getElementById('fwBtn'),y=document.getElementById('flyBtn'),n=document.getElementById('sndBtn');
  if(f)f.addEventListener('click',()=>fxSetFw(!fxFw));
  if(y)y.addEventListener('click',()=>fxSetFly(!fxFly));
  if(n)n.addEventListener('click',()=>sndSet(!SND));
  /* 瀏覽器要求：先有使用者動作才能播放聲音 */
  const wake=()=>{audioResume();if(SND&&fxFly)buzzStart();};
  ['pointerdown','keydown'].forEach(k=>document.addEventListener(k,wake,{once:false,passive:true}));
  document.addEventListener('visibilitychange',()=>{document.hidden?fxClear():fxStart();});
  addEventListener('resize',()=>{fxClear();setTimeout(()=>fxStart(),260);});
  playFX(wall,300);
}
const introFX=playFX;

/* ---------- A 區：頂部走馬燈 ----------
   編輯區裡一行「===」以上的卡片屬於 A 區，以下屬於 B 區，兩區內容各自獨立、不會互相流通。
   「===」只是輸入時的分隔記號，前端不顯示。
   A 區一次顯示 3 張（窄螢幕 2 或 1 張），每 3.5 秒滑一張。
   位置用「環狀座標」計算，節點從不搬動，所以 iframe 不會重新載入；
   只有看得到的 3 張＋下一張會真的載入，其餘維持佔位。 */
const ZA_MS=3500;
/* A band is a marquee strip: 3 cards at a time (2 or 1 on narrow screens), advancing one card
   every 3.5s, paused while the pointer is over it. Zone A and Zone C are two independent bands
   built from the same code, so they behave identically. */
function Band(id){return {id,els:new Map(),items:[],off:0,timer:0,step:0,h:0,k:3,hover:false,paused:false};}
const ZA=Band('zoneA'),ZC=Band('zoneC');
const bandOf=id=>id==='zoneC'?ZC:ZA;
const zaSig=o=>o._raw+'|'+(o.emb||'')+'|'+(o.blk?1:0);
const zaCols=W=>W<560?1:W<860?2:3;
const zaReduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function zaStop(B){clearInterval(B.timer);B.timer=0;}
function zaStart(B){
  zaStop(B);
  if(B.items.length>B.k&&!B.hover&&!B.paused&&!zaReduce())B.timer=setInterval(()=>zaMove(B,1),ZA_MS);
}
/* Side arrows: one card per press, and the timer restarts after a manual move. */
function zaMove(B,d){
  const n=B.items.length;if(n<=B.k)return;
  B.off=(B.off+d+n)%n;zaPlace(B,false);
  if(B.timer)zaStart(B);
}
function zaPlace(B,instant){
  const n=B.items.length,cw=B.step-GAP;
  /* The band height is the tallest card, so its bottom edge never shifts while sliding. */
  const band=B.h;
  const sec=document.getElementById(B.id);
  B.items.forEach((o,i)=>{
    const el=B.els.get(o._id);if(!el)return;
    const rel=(i-B.off+n)%n,x=rel*B.step,h=Math.min(fitH(o,cw,B.k),B.h);
    applySize(el,{w:cw,h});foldSync(el,o,h);
    el.style.top=Math.round((band-h)/2)+'px';
    /* The card that wraps to the back jumps instead of sliding across the whole track. */
    if(instant||el._rel==null||Math.abs(el._rel-rel)>1){el.style.transition='none';el.style.left=x+'px';void el.offsetWidth;el.style.transition='';}
    else el.style.left=x+'px';
    el._rel=rel;el._keep=rel<=B.k;
    if(el._keep)mountQ.add(el);
  });
  pump();
}
function bandUpdate(B,items){
  const sec=document.getElementById(B.id);if(!sec)return;
  const track=sec.querySelector('.za-track');
  const on=items.length>0,was=!sec.hidden;
  sec.hidden=!on;
  if(B.id==='zoneA')document.body.classList.toggle('za-on',on);
  if(was!==on){sec.style.marginTop='';dispatchEvent(new Event('wall:carousel'));}
  if(!on){B.els.forEach(el=>dropCard(el));B.els.clear();B.items=[];zaStop(B);return;}
  const keep=new Map(items.map(o=>[o._id,o]));
  B.els.forEach((el,id)=>{const o=keep.get(id);if(!o||el._sig!==zaSig(o)){dropCard(el);B.els.delete(id);}});
  B.items=items;
  const W=sec.clientWidth||document.documentElement.clientWidth;
  B.k=Math.min(zaCols(W),items.length);
  B.step=Math.round((W-GAP*(B.k-1))/B.k)+GAP;
  let h=0;items.forEach(o=>{const ih=fitH(o,B.step-GAP,B.k);if(ih>h)h=ih;});
  B.h=Math.max(160,Math.min(h,600));sec.style.height=B.h+'px';
  items.forEach(o=>{
    let el=B.els.get(o._id);
    if(!el){el=makeCard(o,true);el.dataset.id=(B.id==='zoneC'?'c-':'a-')+o._id;el._sig=zaSig(o);track.appendChild(el);B.els.set(o._id,el);}
    el._o=o;
  });
  if(B.off>=items.length)B.off=0;
  sec.querySelectorAll('.za-arrow').forEach(b=>{b.hidden=items.length<=B.k;});
  zaPlace(B,true);
  /* Measure any HTML card that has not reported a height yet, so the band opens tall enough. */
  items.forEach(o=>{if(o.type==='html'&&!o.mh){const el=B.els.get(o._id);if(el){el._keep=true;mountQ.add(el);}}});
  pump();
  zaStart(B);
}
function bandInit(B,before,cls){
  if(document.getElementById(B.id))return;
  before.insertAdjacentHTML('beforebegin','<section id="'+B.id+'" class="zone-a '+(cls||'')+'" hidden aria-label="'+(B.id==='zoneC'?'InfoMercial':'Topic')+'"><div class="za-track"></div></section>');
  const sec=document.getElementById(B.id);
  sec.insertAdjacentHTML('beforeend','<button class="za-arrow za-l" data-za="-1" data-i18n-aria="prev" hidden>‹</button><button class="za-arrow za-r" data-za="1" data-i18n-aria="next" hidden>›</button>');
  sec.addEventListener('click',e=>{const b=e.target.closest('[data-za]');if(b)zaMove(B,+b.dataset.za);});
  sec.addEventListener('pointerenter',()=>{B.hover=true;zaStop(B);});
  sec.addEventListener('pointerleave',()=>{B.hover=false;zaStart(B);});
  sec.addEventListener('focusin',()=>{B.hover=true;zaStop(B);});
  sec.addEventListener('focusout',()=>{B.hover=false;zaStart(B);});
  document.addEventListener('visibilitychange',()=>{B.paused=document.hidden;B.paused?zaStop(B):zaStart(B);});
  if('IntersectionObserver' in window)new IntersectionObserver(es=>{B.paused=!es[0].isIntersecting;B.paused?zaStop(B):zaStart(B);},{threshold:0}).observe(sec);
  addEventListener('resize',()=>{if(B.items.length)bandUpdate(B,B.items);});
}
function zoneAInit(before){bandInit(ZA,before,'');}
function zoneAUpdate(items){bandUpdate(ZA,items);}
function zoneCInit(before){bandInit(ZC,before,'zone-c');}
function zoneCUpdate(items){bandUpdate(ZC,items);}

/* ---------- 版主的待審列表 ----------
   卡片是即時公開的，這裡是事後把關：看得到誰什麼時候貼了什麼，一鍵刪除。 */
let revBox=null;
function reviewClose(){if(revBox){revBox.remove();revBox=null;}}
function reviewOpen(id,onDrop,onOk){
  reviewClose();
  const box=document.createElement('div');
  box.className='ins-modal';box.id='revModal';
  box.innerHTML='<div class="ins-card rev-card" role="dialog" aria-modal="true" aria-labelledby="revHead">'
    +'<div class="rev-topbar"><div class="rev-title-group"><b id="revHead" data-i18n="revTitle">Review Cards (🛡)</b>'
    +'<p class="ins-hint" data-i18n="revHint">Pending cards come first. Approved cards do not count toward the wall’s limit (MAX 500 counts pending only).</p></div>'
    +'<div id="revCount"></div></div>'
    +'<div class="rev-list" id="revList"></div>'
    +'<div class="ins-go"><button type="button" class="ins-btn" id="revClose" data-i18n="insCancel">Close</button></div></div>';
  document.body.appendChild(box);revBox=box;
  applyI18n();
  box.addEventListener('click',e=>{if(e.target===box)reviewClose();});
  box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')reviewClose();});
  box.querySelector('#revClose').addEventListener('click',reviewClose);
  const list=box.querySelector('#revList');
  const paint=(cards, pCount)=>{
    if(!cards.length){list.innerHTML='<div class="rev-none" data-i18n="revNone">No cards to review.</div>';applyI18n();return;}
    // Pending cards come first; within same status, newest first
    const sorted = cards.slice().sort((a,b)=>{
      const aPend = (!a.ok || a.status === 'pending') ? 0 : 1;
      const bPend = (!b.ok || b.status === 'pending') ? 0 : 1;
      return (aPend - bPend) || (b.at - a.at);
    });

    const pendingNum = (typeof pCount === 'number') ? pCount : sorted.filter(c => !c.ok || c.status === 'pending').length;
    const cntEl = box.querySelector('#revCount');
    if (cntEl) {
      cntEl.innerHTML = '<span class="rev-cnt-pill">' + pendingNum + ' / 500 pending (MAX)</span>';
    }

    list.innerHTML = sorted.map(c => {
      const isApproved = (c.ok && c.status !== 'pending');
      const timeStr = c.at ? new Date(c.at).toLocaleString() : '';
      const zoneName = ZNAME[c.zone] ? (ZNAME[c.zone] + ' (' + c.zone.toUpperCase() + ')') : ('Zone ' + c.zone.toUpperCase());
      const fp = esc(String(c.ip || (c.user_id ? ('user #' + c.user_id) : (c.cid || 'anon'))).slice(0, 12));
      const pasted = esc(String(c.raw || '').slice(0, 300));

      return '<div class="rev-row' + (isApproved ? ' ok' : ' pending') + '" data-cid="' + esc(c.cid) + '">'
        + '<div class="rev-meta">'
          + '<span class="rev-st ' + (isApproved ? 'rev-st-ok' : 'rev-st-pend') + '">' + (isApproved ? 'Approved' : 'Pending') + '</span>'
          + '<span class="rev-time" title="' + esc(timeStr) + '">🕒 ' + esc(timeStr) + '</span>'
          + '<span class="rev-zone">📍 ' + esc(zoneName) + '</span>'
          + '<span class="rev-fp" title="Visitor fingerprint">👤 ' + fp + '</span>'
        + '</div>'
        + '<div class="rev-body"><code class="rev-raw">' + pasted + '</code></div>'
        + '<div class="rev-acts">'
          + (!isApproved ? '<button type="button" class="rev-ok" data-ok="' + esc(c.cid) + '" title="Approve - The card becomes permanent" aria-label="Approve">✓ <span class="rev-btn-lbl">Approve</span></button>' : '<span class="rev-permanent-tag">Permanent</span>')
          + '<button type="button" class="rev-x" data-drop="' + esc(c.cid) + '" title="Remove - The card disappears from every open screen at once" aria-label="Remove">✕ <span class="rev-btn-lbl">Remove</span></button>'
        + '</div>'
      + '</div>';
    }).join('');
    applyI18n();
  };
  list.innerHTML='<div class="rev-none">…</div>';
  syncReview(id).then(r => {
    const cards = Array.isArray(r) ? r : (r.cards || []);
    paint(cards, r.pending_count);
  }).catch(code => {
    list.innerHTML = '<div class="rev-none">' + esc(t(code === 403 ? 'revDenied' : 'revFail')) + '</div>';
  });
  list.addEventListener('click',e=>{
    const a=e.target.closest('[data-ok]');
    if(a){
      const cid=a.dataset.ok;a.disabled=true;
      syncApprove(id,cid).then(r=>{
        if(!r.ok){a.disabled=false;return;}
        const row=a.closest('.rev-row');
        if(row){
          row.classList.remove('pending');
          row.classList.add('ok');
          const st=row.querySelector('.rev-st');
          if(st){
            st.className='rev-st rev-st-ok';
            st.textContent='Approved';
          }
          a.outerHTML='<span class="rev-permanent-tag">Permanent</span>';
        }
        if(onOk)onOk(cid);
      },()=>{a.disabled=false;});
      return;
    }
    const b=e.target.closest('[data-drop]');if(!b)return;
    const cid=b.dataset.drop;b.disabled=true;
    syncDrop(id,cid).then(r=>{
      if(!r.ok){b.disabled=false;return;}
      const row=b.closest('.rev-row');if(row)row.remove();
      if(!list.querySelector('.rev-row'))paint([], 0);
      if(onDrop)onDrop(cid);
    },()=>{b.disabled=false;});
  });
}

/* ---------- 篩選與排序（關鍵字／類型／日期／長度） ----------
   篩掉的卡只是隱藏（display:none），節點不動、iframe 不重新載入 */
const FDEF={q:'',type:'all',date:'any',sort:'wall'};
/* 獨立牆只有超過這個張數才附篩選功能 */
const FILTER_MIN=16;
const txtCache=new WeakMap();
function textOf(o){
  if(o.type==='md')return String(o.md||'').replace(/\s+/g,' ').trim();
  if(o.type!=='html')return '';
  if(!txtCache.has(o)){let x='';try{const d=new DOMParser().parseFromString(o.html,'text/html');d.querySelectorAll('script,style').forEach(e=>e.remove());x=(d.body.textContent||'').replace(/\s+/g,' ').trim();}catch(e){}txtCache.set(o,x);}
  return txtCache.get(o);
}
function kindOf(o){
  if(isTomb(o))return 'blocked';
  if(o.type==='model')return 'model';
  if(o.type==='md')return 'md';
  if(o.type==='html')return 'html';
  if(o.type==='youtube')return 'video';
  const h=hostOf(o.url);
  if(/(^|\.)(sketchfab\.com)$/.test(h))return 'model';
  if(/(^|\.)(open\.spotify\.com|soundcloud\.com|podcasts\.apple\.com)$/.test(h))return 'audio';
  if((o.fit&&(o.fit.t==='ratio'||(o.fit.t==='lin'&&/\/plugins\/video/.test(o.url))))||/(^|\.)(vimeo\.com|bilibili\.com|dailymotion\.com|tiktok\.com)$/.test(h))return 'video';
  return 'page';
}
function titleOf(o){return o.title||(o.type==='model'?(o.mdl&&o.mdl.n||'3D model'):o.type==='md'?mdTitle(o.md):o.type==='html'?textOf(o).slice(0,80):'')||hostOf(o.url)||o.type;}
/* 日期：有發布時間用發布時間，否則用加入牆面的時間 */
function dateOf(o){return o.pub||o.at||0;}
function matches(o,F){
  if(F.type!=='all'&&kindOf(o)!==F.type)return false;
  if(F.date!=='any'){
    const d=dateOf(o);if(!d)return false;
    const lim=F.date==='today'?new Date().setHours(0,0,0,0):Date.now()-(F.date==='7d'?7:30)*DAY;
    if(d<lim)return false;
  }
  const q=String(F.q||'').trim().toLowerCase();if(!q)return true;
  const hay=[o.title,(o.tags||[]).map(x=>'#'+x).join(' '),hostOf(o.url),o.url,t('t'+kindOf(o).replace(/^./,c=>c.toUpperCase())),textOf(o)].join(' ').toLowerCase();
  return q.split(/\s+/).every(w=>hay.includes(w));
}
function viewOf(list,F){
  let v=list.filter(o=>matches(o,F));
  /* 沒有資料的（例如不知道長度）一律排最後 */
  const by=(f,dir)=>{v=v.map((o,i)=>[o,f(o),i]).sort((a,b)=>{if(a[1]==null&&b[1]==null)return a[2]-b[2];if(a[1]==null)return 1;if(b[1]==null)return -1;return dir*(a[1]-b[1])||a[2]-b[2];}).map(x=>x[0]);};
  if(F.sort==='new')by(o=>dateOf(o)||null,-1);
  else if(F.sort==='old')by(o=>dateOf(o)||null,1);
  else if(F.sort==='long')by(o=>o.dur||null,-1);
  else if(F.sort==='short')by(o=>o.dur||null,1);
  else if(F.sort==='az'){const c=new Intl.Collator(LANG,{sensitivity:'base',numeric:true});v=[...v].sort((a,b)=>c.compare(titleOf(a),titleOf(b)));}
  return v;
}
function filterActive(F){return String(F.q||'').trim()!==''||F.type!=='all'||F.date!=='any'||F.sort!=='wall';}
function applyView(wall,list,F,more){
  const v=viewOf(list,F),keep=new Set(v.map(o=>o._id));
  [wall].concat(more||[]).filter(Boolean).forEach(w=>
    w.querySelectorAll('.item').forEach(el=>el.classList.toggle('f-out',!keep.has(el.dataset.id))));
  let nm=wall.querySelector('.no-match');
  if(list.length&&!v.length){if(!nm){nm=document.createElement('div');nm.className='no-match';wall.appendChild(nm);}nm.textContent=t('noMatch');}
  else if(nm)nm.remove();
  const c=document.getElementById('fcount');if(c)c.textContent=filterActive(F)?t('results',{n:v.length,m:list.length}):'';
  const b=document.getElementById('filterBtn');if(b)b.classList.toggle('active',filterActive(F));
  return v;
}
/* ---------- Zone switches ----------
   A, B and C can each be turned off. In the editor the current state is also the default
   written into an exported wall; visitors can still toggle zones for themselves. */
const ZONES=['a','b','c'];
/* Display names: Zone A = Topic, Zone B = Content, Zone C = InfoMercial */
/* 三個區塊的名字，介面各處與 EzSheet 說明都用同一組字 */
const ZNAME={a:'Topic',b:'Content',c:'InfoMercial'};
function zoneBtnHTML(){
  return ZONES.map(z=>'<button id="zone'+z.toUpperCase()+'Btn" class="pill zone" data-zone="'+z
    +'" aria-pressed="true" data-i18n-aria="z'+z.toUpperCase()+'"><span class="lbl">'+ZNAME[z]+'</span>'
    +'<span class="zn" id="zn'+z.toUpperCase()+'"></span></button>').join('');
}
/* Show how many cards each zone holds, so it is obvious where content ended up */
function zonePaint(state,counts){
  ZONES.forEach(z=>{
    const b=document.getElementById('zone'+z.toUpperCase()+'Btn');if(!b)return;
    b.setAttribute('aria-pressed',!!state[z]);
    const n=document.getElementById('zn'+z.toUpperCase());
    if(n&&counts)n.textContent=counts[z]?String(counts[z]):'';
    b.title=t('z'+z.toUpperCase())+(counts?' · '+(counts[z]||0):'');
    b.hidden=!!(counts&&!counts[z]&&!state[z]===false&&counts[z]===0&&false);
  });
}
function zoneCounts(list){
  const c={a:0,b:0,c:0};
  (list||[]).forEach(o=>{const z=(o.zone==='a'||o.zone==='c')?o.zone:'b';c[z]++;});
  return c;
}
function bindZones(state,onChange){
  ZONES.forEach(z=>{const b=document.getElementById('zone'+z.toUpperCase()+'Btn');
    if(b)b.addEventListener('click',()=>{state[z]=!state[z];zonePaint(state);onChange(z);});});
  zonePaint(state);
}
function validZones(o){
  const r={a:true,b:true,c:true};
  if(o&&typeof o==='object')ZONES.forEach(z=>{if(typeof o[z]==='boolean')r[z]=o[z];});
  return r;
}
/* ---------- Zone order ----------
   The three zones can be shown in any order. Order is expressed with CSS `order` on a flex
   body, so no node is ever moved and no iframe reloads. Zone B always keeps the control bar
   and the carousel page bar directly above it. */
/* Zone B is always last, with the control bar directly above it; only C and A swap. */
const ZORDERS=[['c','a','b'],['a','c','b']];
function validOrder(o){
  if(Array.isArray(o)&&o.indexOf('a')>=0&&o.indexOf('c')>=0)
    return o.indexOf('a')<o.indexOf('c')?['a','c','b']:['c','a','b'];
  return ZORDERS[0].slice();
}
function orderLabel(o){return o.map(z=>ZNAME[z]).join(' · ');}
function applyZoneOrder(order){
  const put=(id,v)=>{const el=document.getElementById(id);if(el)el.style.order=v;};
  order.forEach((z,i)=>{
    const base=(i+1)*10;
    if(z==='b'){put('barZone',base+1);put('carNav',base+2);put('wall',base+3);}
    else put(z==='a'?'zoneA':'zoneC',base+1);
  });
}
function zordBtnHTML(){return '';}
function filterBtnHTML(){return '<button id="filterBtn" class="pill filt" aria-pressed="false" aria-controls="filterBar" data-i18n-aria="filter"><span class="mi">🔍</span><span class="lbl" data-i18n="filter"></span></button>';}
function filterBarHTML(){
  const sel=(id,aria,opts)=>'<select id="'+id+'" data-i18n-aria="'+aria+'">'+opts.map(([v,k])=>'<option value="'+v+'" data-i18n="'+k+'"></option>').join('')+'</select>';
  return '<div id="filterBar" class="filter-bar" role="search" hidden>'
    +'<input id="fq" type="search" autocomplete="off" spellcheck="false" data-i18n-ph="searchPh" data-i18n-aria="searchPh">'
    +sel('ftype','fType',[['all','tAll'],['video','tVideo'],['audio','tAudio'],['page','tPage'],['html','tHtml'],['md','tMd'],['model','tModel'],['blocked','tBlocked']])
    +sel('fdate','fDate',[['any','dAny'],['today','dToday'],['7d','d7'],['30d','d30']])
    +sel('fsort','fSort',[['wall','sWall'],['new','sNew'],['old','sOld'],['long','sLong'],['short','sShort'],['az','sAz']])
    +'<span id="fcount" class="f-count" aria-live="polite"></span><button id="fclear" class="f-clear" data-i18n="fClear"></button></div>';
}
function bindFilter(wall,F,onChange){
  const $=id=>document.getElementById(id),bar=$('filterBar'),btn=$('filterBtn'),q=$('fq'),ty=$('ftype'),dt=$('fdate'),so=$('fsort');
  const sync=()=>{q.value=F.q;ty.value=F.type;dt.value=F.date;so.value=F.sort;};
  /* 篩選列打開時把牆往下推，列有換行也不會蓋到卡片 */
  /* 篩選列就排在操縱桿底下，不必再推開版面 */
  const offset=()=>{dispatchEvent(new Event('wall:offset'));};
  addEventListener('wall:carousel',offset);
  const show=(on,quiet)=>{bar.hidden=!on;btn.setAttribute('aria-pressed',on);offset();if(on&&!quiet)q.focus();};
  btn.addEventListener('click',()=>show(bar.hidden));
  let tm=0;q.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(()=>{F.q=q.value;onChange();},150);});
  q.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(q.value){q.value='';F.q='';onChange();}else show(false);}});
  ty.addEventListener('change',()=>{F.type=ty.value;onChange();});
  dt.addEventListener('change',()=>{F.date=dt.value;onChange();});
  so.addEventListener('change',()=>{F.sort=so.value;onChange();});
  $('fclear').addEventListener('click',()=>{Object.assign(F,FDEF);sync();onChange();q.focus();});
  /* 讓外部可以問「篩選列開著嗎」、也可以直接把它打開並帶入條件 */
  const open=()=>!bar.hidden;
  /* 「/」快速搜尋 */
  document.addEventListener('keydown',e=>{
    if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]'))return;
    const panel=$('panel');if(panel&&!panel.classList.contains('hidden'))return;
    e.preventDefault();show(true);
  });
  addEventListener('resize',offset);
  sync();
  return {sync,show,open};
}

/* ---------- 自動抓標題／長度／發布日 ----------
   Spotify、Vimeo 的官方 oEmbed 可以直接讀；設定 setMetaFetch() 後改用自己的伺服器，任何網站都能補 */
let META='';const metaAsked=new Set();
function setMetaFetch(u){META=httpUrl(u)?u:'';}
function pageUrlOf(o){return o.type==='youtube'?'https://www.youtube.com/watch?v='+o.id:o.url;}
function metaSource(o){
  if(o.type!=='web')return '';
  let m=o.url.match(/^https:\/\/open\.spotify\.com\/embed\/(track|episode|show|album|playlist|artist)\/([A-Za-z0-9]+)/);
  if(m)return 'https://open.spotify.com/oembed?url='+encodeURIComponent('https://open.spotify.com/'+m[1]+'/'+m[2]);
  m=o.url.match(/^https:\/\/player\.vimeo\.com\/video\/(\d+)/);
  if(m)return 'https://vimeo.com/api/oembed.json?url='+encodeURIComponent('https://vimeo.com/'+m[1]);
  return '';
}
function fetchMeta(list,onUpdate){
  list.forEach(o=>{
    if(o.type==='html'||(o.title&&o.dur))return;
    const key=pageUrlOf(o);if(!key||metaAsked.has(key))return;
    const src=META?META+(META.includes('?')?'&':'?')+'url='+encodeURIComponent(key):metaSource(o);if(!src)return;
    metaAsked.add(key);
    fetch(src).then(r=>r.ok?r.json():null).then(j=>{
      if(!j)return;let ch=false;
      if(!o.title&&typeof j.title==='string'&&j.title.trim()){o.title=j.title.trim().slice(0,200);ch=true;}
      const d=Number(j.duration);if(!o.dur&&d>0&&d<172800){o.dur=Math.round(d);ch=true;}
      const p=Date.parse(j.published||j.upload_date||j.release_date||'');if(!o.pub&&p>0){o.pub=p;ch=true;}
      if(ch)onUpdate(o);
    }).catch(()=>{});
  });
}
function parseDur(s){
  s=String(s||'').trim();if(!s)return 0;
  if(/^\d+(\.\d+)?$/.test(s))return Math.round(parseFloat(s)*60);
  const p=s.split(':').map(Number);if(p.some(n=>!Number.isFinite(n)))return 0;
  return p.reduce((a,n)=>a*60+n,0);
}
function fmtDur(n){if(!n)return '';const h=Math.floor(n/3600),m=Math.floor(n%3600/60),x=n%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');}

/* 隨機：跨 1~3 條細欄（2 條最常見）；一般網頁再隨機高寬比，嵌入類高度照內容 */
function randomSize(o){
  const span=[1,1,2,2,2,3][Math.floor(Math.random()*6)];
  return {...o,span,rh:Math.round((0.6+Math.random()*0.7)*100)/100,manual:false};
}

/* 獨立牆啟動：讀 <script id="wall-data">，加上頂部「版面／語言」列，依觀看者的選擇呈現 */
function bootReadonly(){
  let d={};try{d=JSON.parse(document.getElementById('wall-data').textContent);}catch(e){}
  const arr=Array.isArray(d)?d:(Array.isArray(d.list)?d.list:[]);
  const items=arr.map(normalize).filter(Boolean);
  /* 這位訪客自己插過的卡：存在他的 localStorage，靠原文雜湊記得插在誰前面 */
  const AKEY='wall_add_'+(String(d.id||'')||'default');
  let adds=[];
  try{const a=JSON.parse(localStorage.getItem(AKEY)||'[]');
    if(Array.isArray(a))adds=a.filter(x=>x&&typeof x.raw==='string').slice(0,200);}catch(e){}
  const saveAdds=()=>{try{localStorage.setItem(AKEY,JSON.stringify(adds));}catch(e){}};
  /* 放回原來的位置：找到錨點就插在它前面，找不到就接在同一區的最後 */
  function placeGuest(o,anchor,zone){
    o.guest=true;o.zone=(zone==='a'||zone==='c')?zone:'b';
    let at=-1;
    if(anchor)at=items.findIndex(x=>!x.guest&&rawHash(x._raw)===anchor);
    if(at<0){
      for(let k=items.length-1;k>=0;k--){
        const z=items[k].zone||'b';
        if(z===o.zone){at=k+1;break;}
      }
    }
    if(at<0)at=items.length;
    items.splice(at,0,o);
    return at;
  }
  adds.forEach(a=>{const o=parseOne(a.raw);if(o)placeGuest(o,a.anchor,a.zone);});
  const orig=new Map(items.map((o,i)=>[o._id,{w:o.w,h:o.h,span:o.span,rh:o.rh,i}]));
  /* 訪客自己拉過的卡片尺寸：存在他的瀏覽器，用原文雜湊認卡。
     orig 已經先記下作者的原始尺寸，所以「原始版面」還是回得去。 */
  const ZSKEY='wall_size_'+(String(d.id||'')||'default');
  let sizes={};
  try{const s=JSON.parse(localStorage.getItem(ZSKEY)||'{}');if(s&&typeof s==='object')sizes=s;}catch(e){}
  const saveSizes=()=>{try{localStorage.setItem(ZSKEY,JSON.stringify(sizes));}catch(e){}};
  const clampSize=v=>Math.max(MIN,Math.min(MAX,Math.round(+v||0)));
  items.forEach(o=>{
    const s=sizes[rawHash(o._raw)];if(!s)return;
    if(+s.w>0)o.w=clampSize(s.w);
    if(+s.h>0)o.h=clampSize(s.h);
    o.manual=!!s.manual;o.span=0;o.rh=0;
  });
  const byId=new Map(items.map(o=>[o._id,o]));
  const id=String(d.id||'');
  /* 作者匯出時的欄位設定是預設值；沒有欄位就用原始版面 */
  const authorMode=validCols(d.cols)&&d.cols>0?d.cols:-1;
  const VKEY='wall_view_'+(id||'default');
  let pref={};try{pref=JSON.parse(localStorage.getItem(VKEY)||'{}')||{};}catch(e){}
  let mode=pref.mode===-1||validCols(pref.mode)?pref.mode:authorMode;
  let car=typeof pref.car==='boolean'?pref.car:!!d.car;
  const useFilter=typeof d.filter==='boolean'?d.filter:items.length>FILTER_MIN;
  /* 作者在編輯器裡設定的特效／音效，當作這面牆的預設 */
  fxDefaults(d.fx);
  setLangCode(I18N[pref.lang]?pref.lang:d.lang);
  const savePref=()=>{try{localStorage.setItem(VKEY,JSON.stringify({mode,lang:LANG,car,zones,zorder}));}catch(e){}};

  document.body.insertAdjacentHTML('afterbegin','<div class="bar-zone" id="barZone" aria-label="EzBar"><div class="fab-wrap"><span class="fab badge">'+esc(id||'Wall')+'</span>'+menuHTML(true)+shuffleBtnHTML()+carouselBtnHTML()+(useFilter?filterBtnHTML():'')+zoneBtnHTML()+fxBtnHTML()+syncBtnHTML()+langSelectHTML()+'</div>'+(useFilter?filterBarHTML():'')+'</div>');
  if(id)document.title=id;
  const wall=document.getElementById('wall');
  let empty=null;
  const bItems=items.filter(o=>o.zone==='b'||!o.zone);
  if(bItems.length)renderAll(wall,bItems,true);
  else if(!items.length){empty=document.createElement('div');empty.className='empty';wall.replaceChildren(empty);}
  const zones=validZones(typeof pref.zones==='object'?pref.zones:d.zones);
  let zorder=validOrder(pref.zorder||d.zorder);

  function apply(){
    if(mode===-1)items.forEach(o=>{const g=orig.get(o._id);o.w=g.w;o.h=g.h;o.span=g.span;o.rh=g.rh;});
    /* 拉過大小的卡不再參與隨機，否則每次重排 span 又被設回去、尺寸就被抹掉。
       o.manual 只代表「高度也自由拉過」，所以另外看這位訪客存了尺寸沒有。 */
    else if(mode===0)items.forEach((o,i)=>{
      if(o.manual||sizes[rawHash(o._raw)])return;
      items[i]=Object.assign(o,randomSize(o));
    });
    pack();
    updateLayoutUI(mode);
  }
  const F={...FDEF};
  function pack(){
    const v=applyView(wall,items,F);
    const A=zones.a?v.filter(o=>o.zone==='a'):[],
          B=zones.b?v.filter(o=>o.zone==='b'||!o.zone):[],
          C=zones.c?v.filter(o=>o.zone==='c'):[];
    zoneCUpdate(C);zoneAUpdate(A);
    zonePaint(zones,zoneCounts(items));
    wall.hidden=!zones.b;
    if(B.length)layoutWall(wall,B,mode>0?mode:0,car);else wall.style.height='';
  }
  let raf=0;const later=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;pack();});};
  addEventListener('wall:relayout',later);
  const grow=new Map();
  onMeasure((cid,h)=>{
    const o=byId.get(cid);if(!o||Math.abs((o.mh||0)-h)<=2)return;
    if(o.mh&&h>o.mh){const g=(grow.get(cid)||0)+1;grow.set(cid,g);if(g>4)return;}
    o.mh=h;if(mode!==-1||!orig.get(cid)||o.h>fitH(o,o.w,mode>0?mode:2))o.h=fitH(o,o.w,mode>0?mode:2);later();
  });
  function applyLangUI(){applyI18n();updateLayoutUI(mode);applyZoneOrder(zorder);carSync(wall,true);if(empty)empty.textContent=t('wallEmpty');
    const dot=document.getElementById('syncDot');
    if(dot&&!dot.hidden)dot.title=t(dot.classList.contains('on')?'syncOn':'syncOff');}

  const reorder=next=>reorderAnimated(wall,next,()=>{items.splice(0,items.length,...next);pack();playFX(wall,60);});
  /* 訪客拉動把手：改完切回自由版面（欄位版面會覆寫尺寸），並記在本機 */
  wall.addEventListener('pointerdown',e=>{
    const a=e.target.closest('.resize-anchor,.side-anchor');if(!a)return;
    const el=a.closest('.item');if(!el)return;
    const o=byId.get(el.dataset.id);if(!o)return;
    resizeStart(a,el,o,a.classList.contains('side-anchor'),e,()=>{
      /* 欄位版面會覆寫尺寸，「原始版面」會還原成作者的尺寸，
         兩種都留不住訪客自己拉的大小，所以一律切到自由版面 */
      if(mode!==0){mode=0;savePref();updateLayoutUI(mode);}
      sizes[rawHash(o._raw)]={w:o.w,h:o.h,manual:!!o.manual};saveSizes();
      pack();
    });
  });
  bindMenu(n=>{if(n==='reset'){
      items.forEach(o=>{delete o.free;delete o.px;delete o.py;
        const g=orig.get(o._id);
        if(g){o.w=g.w;o.h=g.h;o.span=g.span;o.rh=g.rh;o.manual=false;}});
      sizes={};saveSizes();
      pack();playFX(wall,120);return;}
    mode=n;savePref();apply();playFX(wall,120);
    if(n===-1){const back=[...items].sort((a,b)=>orig.get(a._id).i-orig.get(b._id).i);if(back.some((o,i)=>o!==items[i]))reorder(back);}});
  const fb=useFilter?bindFilter(wall,F,pack):null;
  /* 作者匯出時篩選列是開著的，就照他留下的條件開著 */
  /* 讓外層（例如產生器的預覽框）讀回此刻畫面上的設定，當作匯出的預設值 */
  try{window.wallSettings=function(){
    const open=!!(fb&&fb.open&&fb.open());
    return {cols:mode,car:car,zones:Object.assign({},zones),zorder:zorder.slice(),
      lang:getLang(),fx:fxState(),filter:open||useFilter,
      fset:open?{q:F.q,type:F.type,date:F.date,sort:F.sort}:null};
  };}catch(e){}
  if(fb&&d.fset&&typeof d.fset==='object'){
    ['q','type','date','sort'].forEach(k=>{if(typeof d.fset[k]==='string')F[k]=d.fset[k];});
    fb.sync();fb.show(true,true);
  }
  bindZones(zones,()=>{savePref();pack();});
  applyZoneOrder(zorder);
  document.getElementById('shuffleBtn').addEventListener('click',()=>{if(items.length<2)return;if(fb&&F.sort!=='wall'){F.sort='wall';fb.sync();}reorder(shuffled(items));});
  const sel=document.getElementById('lang');sel.value=LANG;
  sel.addEventListener('change',()=>{setLangCode(sel.value);applyLangUI();savePref();});
  document.getElementById('carBtn').addEventListener('click',()=>{car=!car;savePref();setCarousel(wall,car);pack();playFX(wall,120);});
  setCarousel(wall,car&&items.length>0);
  zoneAInit(document.getElementById('barZone'));
  zoneCInit(document.getElementById('zoneA'));   /* Zone C band sits above Zone A */
  applyLangUI();apply();
  verBadge();fxInit(wall);
  /* 這面牆沒有圖卡／3D 卡／自訂飛行圖示時，不顯示特效鍵 */
  fxShow(fxAvailable(items));
  /* ---- 插卡：訪客把新卡插在某張卡前面，只存進自己的瀏覽器 ---- */
  function remountB(){
    const B=items.filter(o=>o.zone==='b'||!o.zone);
    if(B.length&&empty){empty.remove();empty=null;}
    const have=new Set([...wall.children].map(el=>el.dataset.id));
    B.forEach(o=>{if(!have.has(o._id))wall.appendChild(makeCard(o,true));});
  }
  function loadCardsFromDB(){
    const url = syncBase(typeof WALL_ID !== 'undefined' ? WALL_ID : 'default')+'/cards';
    const doFetch = (fn) => fn(url, { headers: syncHeaders(false) }).then(r=>r.ok?r.json():null);
    const applyCards = (data) => {
      if(data && Array.isArray(data.cards) && data.cards.length){
        let touched=false;
        data.cards.forEach(c=>{
          touched = addServerCard(c) || touched;
          if(c.ok) promoteServerCard(c.cid);
        });
        if(touched){ remountB(); pack(); fxShow(fxAvailable(items)); }
      }
    };
    doFetch(fetch).then(applyCards).catch(()=>{});
  }
  loadCardsFromDB();

  function showWallOtpModal(onSuccess){
    let modal = document.getElementById('wallOtpModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'wallOtpModal';
    modal.className = 'ins-modal';
    modal.innerHTML = '<div class="ins-card wall-otp-card" role="dialog" aria-modal="true" style="max-width:390px;text-align:left;position:relative;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
      + '<b style="font-size:16px;color:var(--ink,#fff);">Sign in to Add Card</b>'
      + '<button type="button" class="otp-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;line-height:1;padding:4px;">✕</button>'
      + '</div>'
      + '<p id="otpPromptHint" class="ins-hint" style="margin-bottom:14px;color:#cbd5e1;font-size:12px;line-height:1.5;">'
      + 'Please enter your email to sign in and insert your card on this wall.'
      + '</p>'
      + '<div id="otpStepEmail">'
      + '<label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Email Address</label>'
      + '<input type="email" id="wallEmailInput" placeholder="yourname@domain.com" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:13px;margin-bottom:12px;outline:none;" />'
      + '<div id="wallEmailErr" class="ins-err" style="color:#f87171;font-size:11px;margin-bottom:10px;min-height:16px;"></div>'
      + '<div class="ins-go" style="display:flex;justify-content:flex-end;gap:8px;">'
      + '<button type="button" class="ins-btn" id="wallEmailCancel">Cancel</button>'
      + '<button type="button" class="ins-btn on" id="wallEmailSubmit" style="background:#0d9488;color:#fff;border-color:#0d9488;">Send 4-Digit Code</button>'
      + '</div></div>'
      + '<div id="otpStepVerify" style="display:none;">'
      + '<label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">4-Digit Verification Code</label>'
      + '<input type="text" id="wallCodeInput" maxlength="4" placeholder="••••" style="letter-spacing:10px;font-weight:bold;font-size:22px;text-align:center;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#2dd4bf;margin-bottom:8px;outline:none;" />'
      + '<div id="wallOtpDebug" style="font-size:11px;color:#2dd4bf;margin-bottom:8px;display:none;background:rgba(45,212,191,0.1);padding:4px 8px;border-radius:4px;"></div>'
      + '<div id="wallCodeErr" class="ins-err" style="color:#f87171;font-size:11px;margin-bottom:10px;min-height:16px;"></div>'
      + '<div class="ins-go" style="display:flex;justify-content:space-between;align-items:center;">'
      + '<button type="button" id="wallResendOtp" style="background:transparent;border:none;color:#38bdf8;font-size:11px;cursor:pointer;text-decoration:underline;">Resend Code</button>'
      + '<div style="display:flex;gap:8px;">'
      + '<button type="button" class="ins-btn" id="wallCodeBack">Back</button>'
      + '<button type="button" class="ins-btn on" id="wallCodeSubmit" style="background:#0d9488;color:#fff;border-color:#0d9488;">Verify & Log in</button>'
      + '</div></div></div>'
      + '</div>';

    document.body.appendChild(modal);

    const close = () => { modal.remove(); };
    modal.querySelector('.otp-close-btn').onclick = close;
    modal.querySelector('#wallEmailCancel').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    let currentEmail = '';

    const sendOtpRequest = (email) => {
      const errEl = modal.querySelector('#wallEmailErr');
      const submitBtn = modal.querySelector('#wallEmailSubmit');
      errEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      fetch('/api/wall/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(async r => {
        const data = await r.json().catch(() => ({}));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send 4-Digit Code';
        if (!r.ok || !data.success) {
          errEl.textContent = data.message || 'Failed to send code. Please try again.';
          return;
        }
        currentEmail = email;
        modal.querySelector('#otpStepEmail').style.display = 'none';
        modal.querySelector('#otpStepVerify').style.display = 'block';
        modal.querySelector('#otpPromptHint').textContent = 'We sent a 4-digit code to ' + email + '. Enter it below:';
        if (data.debug_otp) {
          const dbg = modal.querySelector('#wallOtpDebug');
          dbg.style.display = 'block';
          dbg.textContent = 'Test Code: ' + data.debug_otp;
        }
        const codeInp = modal.querySelector('#wallCodeInput');
        codeInp.value = '';
        codeInp.focus();
      }).catch(err => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send 4-Digit Code';
        errEl.textContent = 'Network error. Please try again.';
      });
    };

    modal.querySelector('#wallEmailSubmit').onclick = () => {
      const val = modal.querySelector('#wallEmailInput').value.trim();
      if (!val || !val.includes('@')) {
        modal.querySelector('#wallEmailErr').textContent = 'Please enter a valid email address.';
        return;
      }
      sendOtpRequest(val);
    };

    modal.querySelector('#wallEmailInput').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); modal.querySelector('#wallEmailSubmit').click(); }
    };

    modal.querySelector('#wallCodeBack').onclick = () => {
      modal.querySelector('#otpStepVerify').style.display = 'none';
      modal.querySelector('#otpStepEmail').style.display = 'block';
      modal.querySelector('#otpPromptHint').textContent = 'Please enter your email to sign in and insert your card on this wall.';
    };

    modal.querySelector('#wallResendOtp').onclick = () => {
      if (currentEmail) sendOtpRequest(currentEmail);
    };

    modal.querySelector('#wallCodeSubmit').onclick = () => {
      const code = modal.querySelector('#wallCodeInput').value.trim();
      const errEl = modal.querySelector('#wallCodeErr');
      const submitBtn = modal.querySelector('#wallCodeSubmit');
      errEl.textContent = '';
      if (!code || code.length !== 4) {
        errEl.textContent = 'Please enter all 4 digits.';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      fetch('/api/wall/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: currentEmail, otp: code })
      }).then(async r => {
        const data = await r.json().catch(() => ({}));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify & Log in';
        if (!r.ok || !data.success) {
          errEl.textContent = data.message || 'Verification failed. Please check code.';
          return;
        }
        window.auth = window.auth || {};
        window.auth.user = data.user;
        close();
        if (typeof onSuccess === 'function') {
          onSuccess(data.user);
        }
      }).catch(err => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify & Log in';
        errEl.textContent = 'Network error. Please try again.';
      });
    };

    modal.querySelector('#wallCodeInput').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); modal.querySelector('#wallCodeSubmit').click(); }
    };

    setTimeout(() => {
      const inp = modal.querySelector('#wallEmailInput');
      if (inp) inp.focus();
    }, 50);
  }

  function checkAuthThenInsert(el, anchorItem){
    const auth = (typeof window !== 'undefined' ? window.auth : null) || {};
    if (auth?.user) {
      insertBefore(el, anchorItem);
      return;
    }

    fetch('/api/wall/auth/me', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    }).then(r => r.json()).then(data => {
      if (data && data.authenticated && data.user) {
        window.auth = { user: data.user };
        insertBefore(el, anchorItem);
      } else {
        showWallOtpModal(() => {
          insertBefore(el, anchorItem);
        });
      }
    }).catch(() => {
      fetch('/wall/auth/me', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      }).then(r2 => r2.json()).then(d2 => {
        if (d2 && d2.authenticated && d2.user) {
          window.auth = { user: d2.user };
          insertBefore(el, anchorItem);
        } else {
          showWallOtpModal(() => {
            insertBefore(el, anchorItem);
          });
        }
      }).catch(() => {
        showWallOtpModal(() => {
          insertBefore(el, anchorItem);
        });
      });
    });
  }

  function insertBefore(el,anchorItem){
    insertDialog(true,o=>{
      const zone=anchorItem.zone||'b',anchor=rawHash(anchorItem._raw);
      const targetWallId = wallId || (typeof WALL_ID !== 'undefined' ? WALL_ID : 'default');
      const userId = (window.auth && window.auth.user) ? window.auth.user.id : null;

      const isOwner = (typeof window !== 'undefined' && window.isOwner);
      const showCardNow = (c) => {
        if(!addServerCard(c)){
          const isApproved = !!c.ok && c.status !== 'pending';
          o.guest = !isOwner;
          o.zone = zone;
          o.cid = c.cid;
          o.ok = isApproved;
          o.status = c.status || (isApproved ? 'approved' : 'pending');
          o.user_id = userId;
          const at=items.indexOf(anchorItem);
          items.splice(at<0?items.length:at,0,o);
          orig.set(o._id,{w:o.w,h:o.h,span:o.span,rh:o.rh,i:at<0?items.length:at});
          byId.set(o._id,o);
        }
        remountB();pack();fxShow(fxAvailable(items));
      };

      return syncAdd(targetWallId,{raw:o._raw,anchor,zone,wall_id:targetWallId,user_id:userId}).then(r=>{
        if(r.status===413)return 'insBig';
        const cardObj = (r.ok&&r.j&&r.j.card) ? r.j.card : {
          cid: 'c_' + Date.now().toString(36),
          raw: o._raw,
          anchor,
          zone,
          ok: isOwner ? true : false,
          status: isOwner ? 'approved' : 'pending',
          user_id: userId,
          at: Date.now()
        };
        showCardNow(cardObj);
        return true;
      }).catch(()=>{
        const fallbackCard = {
          cid: 'c_' + Date.now().toString(36),
          raw: o._raw,
          anchor,
          zone,
          ok: isOwner ? true : false,
          status: isOwner ? 'approved' : 'pending',
          user_id: userId,
          at: Date.now()
        };
        showCardNow(fallbackCard);
        return true;
      });
    });
  }
  function removeGuest(o){
    if(SYNC&&o.cid){
      syncDrop(wallId,o.cid).then(r=>{
        if(r.ok&&dropServerCard(o.cid)){remountB();pack();fxShow(fxAvailable(items));}
      });
      return;
    }
    const at=items.indexOf(o);if(at<0)return;
    items.splice(at,1);byId.delete(o._id);orig.delete(o._id);
    const k=adds.findIndex(a=>a.raw===o._raw);if(k>=0){adds.splice(k,1);saveAdds();}
    const el=document.querySelector('.item[data-id="'+o._id+'"]');if(el)dropCard(el);
    pack();fxShow(fxAvailable(items));
  }
  /* ---- 伺服器同步：有設 setWallSync() 才啟用 ---- */
  const wallId=String(d.id||'')||'default';
  const byCid=new Map();                       /* 伺服器卡片 id -> 卡片物件 */
  function addServerCard(c){
    if(!c||!c.cid||byCid.has(c.cid))return false;
    const o=parseOne(c.raw);if(!o)return false;
    o.guest=true;o.ok=!!c.ok;o.cid=c.cid;o.at=c.at||Date.now();
    placeGuest(o,c.anchor,c.zone);
    byCid.set(c.cid,o);
    orig.set(o._id,{w:o.w,h:o.h,span:o.span,rh:o.rh,i:items.indexOf(o)});
    byId.set(o._id,o);
    return true;
  }
  function promoteServerCard(cid){
    const o=byCid.get(cid);if(!o||o.ok)return false;
    markApproved(o);return true;
  }
  function dropServerCard(cid){
    const o=byCid.get(cid);if(!o)return false;
    byCid.delete(cid);
    const at=items.indexOf(o);if(at>=0)items.splice(at,1);
    byId.delete(o._id);orig.delete(o._id);
    const el=document.querySelector('.item[data-id="'+o._id+'"]');if(el)dropCard(el);
    return true;
  }
  function syncPaint(state){
    const dot=document.getElementById('syncDot');if(!dot)return;
    dot.hidden=!SYNC;
    dot.classList.toggle('on',state==='up');
    dot.classList.toggle('off',state!=='up');
    dot.title=t(state==='up'?'syncOn':'syncOff');
  }
  if(SYNC){
    /* 伺服器是這面牆的訪客卡片來源，本機那份就不再套用，免得重複 */
    adds.length=0;
    syncStream(wallId,(kind,data)=>{
      if(kind==='up'||kind==='down'){syncPaint(kind);return;}
      let touched=false;
      if(kind==='sync'){
        const seen=new Set((data.cards||[]).map(c=>c.cid));
        [...byCid.keys()].forEach(cid=>{if(!seen.has(cid))touched=dropServerCard(cid)||touched;});
        (data.cards||[]).forEach(c=>{touched=addServerCard(c)||touched;if(c.ok)promoteServerCard(c.cid);});
      }
      else if(kind==='promote'){promoteServerCard(data.cid);return;}
      else if(kind==='card')touched=addServerCard(data);
      else if(kind==='drop')touched=dropServerCard(data.cid);
      if(touched){remountB();pack();fxShow(fxAvailable(items));}
    });
    syncPaint('down');
    /* 版主輸入金鑰或已登入之後才看得到待審列表 */
    const rb=document.getElementById('revBtn');
    if(rb){
      const showRev=()=>{
        const isOw = (typeof window !== 'undefined' && (window.isOwner || (window.auth && window.auth.user))) || !!ownerToken();
        rb.hidden = !isOw;
      };
      showRev();
      rb.addEventListener('click',()=>reviewOpen(wallId,cid=>{
        if(dropServerCard(cid)){remountB();pack();fxShow(fxAvailable(items));}
      },promoteServerCard));
      /* 版主用 ?owner=… 進來一次，金鑰就記在這台瀏覽器裡 */
      try{
        const q=new URLSearchParams(location.search).get('owner');
        if(q){setOwnerToken(q);showRev();
          history.replaceState(null,'',location.pathname+location.hash);}
      }catch(e){}
      /* 長按牆名可以輸入或清掉金鑰 */
      const fab=document.querySelector('.fab.badge');
      if(fab){
        let hold=0;
        const ask=()=>{
          const v=prompt(t('revAsk'),ownerToken());
          if(v===null)return;
          setOwnerToken(v.trim());showRev();
        };
        fab.addEventListener('pointerdown',()=>{hold=setTimeout(ask,700);});
        ['pointerup','pointerleave','pointercancel'].forEach(k=>fab.addEventListener(k,()=>clearTimeout(hold)));
      }
    }
  }
  ['wall','zoneA','zoneC'].forEach(cid=>{
    const host=document.getElementById(cid);if(!host)return;
    host.addEventListener('click',e=>{
      const b=e.target.closest('[data-act]');if(!b)return;
      const el=b.closest('.item');if(!el)return;
      /* A／C 區的卡片 id 前面多了 a-／c- */
      const o=byId.get(String(el.dataset.id).replace(/^[ac]-/,''));if(!o)return;
      if(b.dataset.act==='ins'){e.preventDefault();checkAuthThenInsert(el,o);}
      else if(b.dataset.act==='gdel'||b.dataset.act==='del'){
        if(!window.isOwner){
          e.preventDefault();
          console.warn('Only the owner of the wall can delete cards');
          return;
        }
        if(b.dataset.act==='gdel'&&o.guest&&!o.ok){e.preventDefault();removeGuest(o);}
      }
    });
  });
  /* 伺服器端的嵌入檢查：有些網站肯讓你嵌，卻回一張機器人驗證或登入牆，
     瀏覽器看不出來，只有伺服器能分辨。擋下來的換成墓碑卡＋開新分頁連結。 */
  checkFrames(items,o=>{
    const el=document.querySelector('.item[data-id="'+o._id+'"]');
    if(el)dropCard(el);
    remountB();pack();
  });
  watchWidth(wall,pack);
}

window.WallCore={STD_W,STD_H,GRID,MIN,YT,esc,httpUrl,normalize,makeCard,renderAll,applySize,watchWidth,validCols,bootReadonly,layoutWall,fitH,onMeasure,fitOf,isTomb,setFrameCheck,checkFrames,dropCard,carouselBtnHTML,setCarousel,carSync,
  VERSION,verBadge,parseOne,autoCap,foldSync,spriteStrip,validSprites,spriteSrc,SPRITE_DEF,SPRITE_MAX,fxPaint,soloIframe,cornerHTML,markApproved,mdRender,mdDoc,mdInner,mdTag,MD_RE,MD_MAX,rawHash,insertDialog,resizeStart,setWallSync,wallMe,setOwnerToken,ownerToken,syncBtnHTML,reviewOpen,modelDoc,modelTag,parseModelTag,isModelFile,modelExt,M3D_EXT,M3D_OK,MODEL_W,MODEL_H,ZONES,ZNAME,ZORDERS,validOrder,applyZoneOrder,orderLabel,zoneBtnHTML,zonePaint,zoneCounts,bindZones,validZones,FDEF,FILTER_MIN,applyView,zoneAInit,zoneAUpdate,zoneCInit,zoneCUpdate,introFX,playFX,fxInit,fxSet,fxSetFw,fxSetFly,fxState,fxDefaults,fxShow,fxAvailable,isMediaCard,sndSet,fxBtnHTML,fwBtnHTML,flyBtnHTML,sndBtnHTML,fireworks,flyBees,filterBtnHTML,filterBarHTML,bindFilter,setMetaFetch,fetchMeta,parseDur,fmtDur,
  I18N,t,colsText,setLangCode,getLang,applyI18n,langSelectHTML,menuHTML,updateLayoutUI,bindMenu,randomSize,
  shuffled,shuffleBtnHTML,reorderAnimated};
})();
