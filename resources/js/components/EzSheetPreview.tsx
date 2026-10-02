import React, { useEffect, useRef, useState, useMemo } from 'react';
import WALL_CORE_SCRIPT from './wall-core.js?raw';

/* ============================================================
 * EzSheetPreview.tsx — full-featured wall preview
 * Mirrors wall-editor-v620.01.html: all zones, 3D, Markdown,
 * effects, sync, resize, insert, filter, i18n (6 languages).
 *
 * FIX: the core script below contains regex literals that use
 * backticks (e.g. Markdown inline-code and fence parsing). Those
 * cannot live unescaped inside a template literal, so every
 * backtick inside WALL_CORE_SCRIPT is written as \x60 instead.
 * ============================================================ */

interface EzSheetItem {
  _raw?: string;
  _id?: string;
  type?: 'youtube' | 'html' | 'web' | 'model' | 'md';
  url?: string;
  id?: string;
  html?: string;
  md?: string;
  mdl?: { d?: string; u?: string; e?: string; n?: string };
  w?: number; h?: number; mh?: number;
  title?: string;
  tags?: string[] | string;
  zone?: 'a' | 'b' | 'c';
  at?: number; pub?: number; dur?: number;
  span?: number; rh?: number;
  emb?: 'yes' | 'no';
  blk?: boolean;
  manual?: boolean;
  free?: boolean;
  px?: number; py?: number;
  pic?: boolean;
}

interface EzSheetPreviewProps {
  content: string;
  title?: string;
  className?: string;
  height?: number;
  wallId?: string;
  lang?: string;
  cols?: number;
  car?: boolean;
  filter?: boolean;
  editable?: boolean;
  zones?: { a?: boolean; b?: boolean; c?: boolean };
  zorder?: ('a' | 'b' | 'c')[];
  fireworks?: boolean;
  flying?: boolean;
  sound?: boolean;
  sprites?: string[];
  syncUrl?: string;
  frameCheckUrl?: string;
  metaUrl?: string;
  auth?: { user?: any };
  isOwner?: boolean;
  onItemsChange?: (items: EzSheetItem[]) => void;
}

/* ============================================================
 * WALL CORE SCRIPT — from wall-editor-v620.01.html
 * Backticks inside regex literals are written as \x60 so this
 * string can safely sit inside a template literal.
 * ============================================================ */
// WALL_CORE_SCRIPT imported from ./wall-core.js?raw for pristine JS execution without escaping issues


/* ============================================================
 * WALL CSS — from wall-editor-v620.01.html
 * ============================================================ */
const WALL_CSS = `
:root{--cloud:#F7F5F1;--teal:#0E7C7B;--green:#0A7A34;--yellow:#FFE27A;--ink:#111}
*{box-sizing:border-box}
html{scrollbar-gutter:stable}
body{margin:0;padding:16px;background:var(--cloud);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",sans-serif;display:flex;flex-direction:column}
html:lang(zh-TW) body{font-family:-apple-system,"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif}
html:lang(zh-CN) body{font-family:-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif}
html:lang(ja) body{font-family:-apple-system,"Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif}
html:lang(ko) body{font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif}
html:lang(th) body{font-family:-apple-system,"Thonburi","Leelawadee UI","Noto Sans Thai",sans-serif}
.masonry{position:relative;z-index:0;min-height:40px}
.zone-c{margin:0 auto 14px}
#wall[hidden]{display:none}
.pill.zord .lbl{letter-spacing:.08em}
.pill.zone{min-width:34px;justify-content:center;gap:4px}
@media (max-width:620px){.pill.zone .lbl{font-size:10px}}
.zn{font-size:9px;opacity:.75;font-weight:900}
.pill.zone[aria-pressed="false"]{opacity:.5}
.pill.zone[aria-pressed="true"]{background:var(--ink);color:#fff}
.masonry>.item{position:absolute;left:0;top:0}
.masonry.ready>.item{transition:left .4s cubic-bezier(.2,.8,.2,1),top .4s cubic-bezier(.2,.8,.2,1),width .4s cubic-bezier(.2,.8,.2,1),height .4s cubic-bezier(.2,.8,.2,1)}
body.resizing .masonry>.item,body.shuffling .masonry>.item{transition:none}
.masonry>.item.dragging{z-index:5}
@media (prefers-reduced-motion:reduce){.masonry.ready>.item{transition:none}}
.item{max-width:100%;border-radius:18px;overflow:hidden;background:#111;border:2.5px solid var(--ink);position:relative;box-shadow:0 10px 24px rgba(0,0,0,.14)}
.item iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.item iframe.embed{background:transparent}
.ins,.gdel{position:absolute;bottom:6px;width:22px;height:22px;padding:0;border-radius:50%;
  border:1.5px solid var(--ink);cursor:pointer;z-index:9;font-weight:900;font-size:13px;
  line-height:19px;text-align:center;opacity:.42;transition:opacity .15s,transform .15s}
.ins{left:6px;background:var(--teal);color:#fff}
.gdel{left:32px;background:#fff;color:var(--ink);font-size:10px}
.item:hover .ins,.item:hover .gdel,.ins:focus-visible,.gdel:focus-visible{opacity:1}
.ins:hover,.gdel:hover{transform:scale(1.12)}
@media (pointer:coarse){.ins,.gdel{opacity:.62}}
@media (prefers-reduced-motion:reduce){.ins,.gdel{transition:none}}
.item.guest{border-color:var(--teal);box-shadow:0 10px 24px rgba(14,124,123,.28)}
.pill[hidden],.pill.sync[hidden],.pill.rev[hidden]{display:none}
.pill.sync{padding:7px 9px;cursor:default;border-color:var(--ink)}
.pill.sync .mi{font-size:10px;width:auto}
.pill.sync.on .mi{color:var(--green)}
.pill.sync.off .mi{color:#c0392b}
.pill.rev{padding:7px 10px}
.rev-card{width:min(760px,100%)}
.rev-topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px}
.rev-title-group{display:flex;flex-direction:column;gap:3px}
.rev-cnt-pill{display:inline-block;font-size:11px;font-weight:800;background:#fef3c7;color:#b45309;padding:3px 10px;border-radius:999px;border:1.5px solid #f59e0b;white-space:nowrap}
.rev-list{max-height:55vh;overflow:auto;display:flex;flex-direction:column;gap:8px;
  border:2px solid var(--ink);border-radius:12px;padding:10px;background:var(--cloud)}
.rev-row{position:relative;background:#fff;border:1.5px solid rgba(0,0,0,.15);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;transition:all .15s ease}
.rev-row.pending{border-left:4px solid #f59e0b;background:#fffdfa}
.rev-row.ok{border-left:4px solid var(--teal);background:#fafffd}
.rev-meta{display:flex;gap:8px;align-items:center;font-size:11px;font-weight:700;color:var(--ink);flex-wrap:wrap}
.rev-st{font-size:10px;font-weight:900;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px}
.rev-st-pend{background:#fef3c7;color:#b45309;border:1.5px dashed #f59e0b}
.rev-st-ok{background:var(--teal);color:#fff;border:1.5px solid var(--teal)}
.rev-time{opacity:.8;font-size:10.5px}
.rev-zone{background:var(--ink);color:#fff;border-radius:999px;padding:1px 8px;font-size:10px}
.rev-fp{background:#e2e8f0;color:#334155;border-radius:6px;padding:1px 6px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px}
.rev-body{margin:2px 0}
.rev-raw{display:block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.45;word-break:break-all;white-space:pre-wrap;max-height:72px;overflow:auto;background:#f8fafc;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0}
.rev-acts{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:2px}
.rev-ok{display:inline-flex;align-items:center;gap:4px;border-radius:999px;border:1.5px solid var(--teal);background:var(--teal);color:#fff;font-weight:900;cursor:pointer;padding:4px 12px;font-size:11px;transition:transform .1s ease}
.rev-ok:hover{background:#0d7a71;transform:scale(1.02)}
.rev-ok:disabled{opacity:.4;cursor:default}
.rev-x{display:inline-flex;align-items:center;gap:4px;border-radius:999px;border:1.5px solid #ef4444;background:#fff;color:#ef4444;font-weight:900;cursor:pointer;padding:4px 12px;font-size:11px;transition:transform .1s ease}
.rev-x:hover{background:#fef2f2;transform:scale(1.02)}
.rev-x:disabled{opacity:.4;cursor:default}
.rev-permanent-tag{font-size:10.5px;font-weight:800;color:var(--teal);padding:3px 8px;background:#ecfdf5;border-radius:999px;border:1px solid #a7f3d0}
.rev-none{font-size:12px;font-weight:800;opacity:.65;padding:16px;text-align:center}
.ins-modal{position:fixed;inset:0;z-index:120;background:rgba(17,17,17,.45);
  display:flex;align-items:center;justify-content:center;padding:18px}
.ins-card{width:min(560px,100%);background:#fff;border:2.5px solid var(--ink);border-radius:18px;
  padding:16px 18px;box-shadow:0 18px 44px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:8px}
.ins-card b{font-size:14px}
.ins-hint{margin:0;font-size:11px;line-height:1.6;opacity:.65;font-weight:700}
.ins-card textarea, #insTa{width:100%;height:88px!important;min-height:60px!important;max-height:180px;flex:0 0 auto!important;resize:vertical;border:2px solid var(--ink);border-radius:12px;
  padding:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;
  background:var(--cloud);color:var(--ink)}
.ins-err{min-height:15px;font-size:11px;font-weight:800;color:#c0392b}
.ins-go{display:flex;justify-content:flex-end;gap:8px}
.ins-btn{border:2.5px solid var(--ink);border-radius:999px;padding:8px 16px;font:inherit;font-size:12px;
  font-weight:900;cursor:pointer;background:#fff;color:var(--ink);transition:opacity .15s}
.ins-btn.on{background:var(--teal);color:#fff}
.ins-btn:disabled{opacity:.65;cursor:not-allowed;pointer-events:none}
@keyframes insSpin{to{transform:rotate(360deg)}}
.ins-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:insSpin .75s linear infinite;vertical-align:-2px;margin-right:6px}
.resize-anchor{position:absolute;right:0;bottom:0;width:44px;height:44px;cursor:nwse-resize;z-index:8;touch-action:none;background:linear-gradient(135deg,transparent 50%,rgba(255,226,122,0.95) 50%)}
.resize-anchor::after{content:'↘';position:absolute;right:5px;bottom:2px;font-weight:900;font-size:15px}
.side-anchor{position:absolute;right:0;top:34px;bottom:44px;width:28px;max-width:30%;cursor:ew-resize;z-index:7;touch-action:none;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.side-anchor::after{content:'';width:8px;height:54px;border-radius:999px;background:var(--ink);opacity:.35;box-shadow:0 0 0 2px rgba(255,255,255,.65)}
.item:hover .side-anchor{opacity:1}
body.resizing .side-anchor{opacity:1}
@media (pointer:coarse){.side-anchor{width:36px;opacity:.55}.side-anchor::after{width:10px;height:64px}}
body.resizing{user-select:none;cursor:nwse-resize}
body.resizing iframe{pointer-events:none}
.ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:repeating-linear-gradient(135deg,#1b1b1b 0 14px,#222 14px 28px);color:#fff;font-weight:900;pointer-events:none}
.ph-i{font-size:22px;opacity:.75}
.ph-h{font-size:11px;opacity:.55;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item.tomb{background:#FBFAF7}
.tomb-body{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 12px;text-align:center;color:var(--ink);overflow:hidden}
.tomb-img{width:86px;height:auto;flex:0 0 auto;margin-bottom:2px}
.tomb-label{font-weight:900;font-size:14px;letter-spacing:.02em}
.tomb-host{font-size:11px;font-weight:800;opacity:.6;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tomb-note{font-size:11px;opacity:.55;line-height:1.35}
.tomb-link{margin-top:6px;display:inline-flex;gap:6px;align-items:center;background:var(--teal);color:#fff;border:2px solid var(--ink);border-radius:999px;padding:7px 13px;font-size:11px;font-weight:900;text-decoration:none;white-space:nowrap}
.tomb-link:hover{filter:brightness(1.12)}
.tomb-link:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
.corner{position:absolute;left:0;top:0;width:52px;height:52px;z-index:5;pointer-events:none}
.corner svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.corner .c-fill{fill:var(--yellow)}
.corner .c-edge{fill:none;stroke:var(--ink);stroke-width:1.6}
.corner .c-lbl{position:absolute;left:-5px;top:12px;width:44px;text-align:center;font-size:9px;font-weight:900;line-height:10px;letter-spacing:-.15px;color:var(--green);transform:rotate(-45deg);white-space:nowrap}
.corner.co.pend .c-fill{fill:#D9F0EE}
.corner.co.pend .c-edge{stroke:var(--teal);stroke-width:2;stroke-dasharray:4 3}
.corner.co.pend .c-lbl{color:var(--teal)}
.corner.co.ok .c-fill{fill:var(--teal)}
.corner.co.ok .c-lbl{color:#fff}
.item.guest.pending{border-style:dashed}
.corner-dim{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);z-index:6;pointer-events:none;background:rgba(17,17,17,.8);color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;opacity:0;transition:opacity .15s;white-space:nowrap}
.item:hover .corner-dim,.item.dragging .corner-dim{opacity:1}
.bar-zone{position:sticky;top:8px;z-index:70;display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 0 14px}
.zone-a{position:relative;overflow:hidden;width:100%;margin:0 auto 18px;transition:height .45s cubic-bezier(.2,.8,.2,1)}
.zone-a[hidden]{display:none}
.za-track{position:relative;height:100%}
.za-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:7;width:38px;height:38px;border-radius:50%;border:2.5px solid var(--ink);background:var(--yellow);color:var(--ink);font-size:24px;font-weight:900;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0 0 3px;box-shadow:0 6px 16px rgba(0,0,0,.22);opacity:.55;transition:opacity .15s,transform .15s}
.zone-a:hover .za-arrow,.za-arrow:focus-visible{opacity:1}
.za-arrow:hover{transform:translateY(-50%) scale(1.08)}
.za-arrow[hidden]{display:none}
.za-l{left:6px}.za-r{right:6px}
@media (max-width:560px){.za-arrow{width:32px;height:32px;font-size:20px;opacity:.85}}
.za-track>.item{position:absolute;left:0;top:0;transition:left .6s cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:reduce){.za-track>.item,.zone-a,.za-arrow{transition:none}}
.fx-layer{position:fixed;left:0;top:0;z-index:8;pointer-events:none}
.fx-bee{position:fixed;left:0;top:0;z-index:9;pointer-events:none;width:max-content;will-change:transform;filter:drop-shadow(0 8px 14px rgba(0,0,0,.28))}
.fx-bee{transform-style:preserve-3d}
.fx-bee img{display:block;width:150px;height:auto;backface-visibility:visible}
.fx-bee .wob{display:block;transform-style:preserve-3d;animation:fxwob .42s ease-in-out infinite alternate}
@keyframes fxwob{from{transform:translateY(-6px) rotateX(10deg) rotateZ(-4deg)}to{transform:translateY(6px) rotateX(-8deg) rotateZ(4deg)}}
@media (max-width:560px){.fx-bee img{width:104px}}
.fx-spark{position:fixed;z-index:8;pointer-events:none;width:16px;height:16px;border-radius:50%;background:var(--yellow);box-shadow:0 0 22px 6px rgba(255,226,122,.9);animation:fxspark 1.2s ease-out forwards}
@keyframes fxspark{from{transform:scale(1);opacity:.95}to{transform:scale(.2) translateY(18px);opacity:0}}
@media (prefers-reduced-motion:reduce){.fx-layer,.fx-ship{display:none}}
.ver-badge{position:fixed;top:10px;right:12px;z-index:75;padding:5px 10px;border:2px solid var(--ink);border-radius:999px;background:rgba(255,255,255,.88);color:var(--ink);font-size:11px;font-weight:900;letter-spacing:.04em;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.12)}
@media (max-width:420px){.ver-badge{top:auto;bottom:10px;right:8px;font-size:10px;padding:4px 8px;opacity:.85}}
.empty{padding:40px 16px;text-align:center;opacity:.55;font-weight:800}
.fab-wrap{position:relative;z-index:1;max-width:100%;display:flex;gap:8px;align-items:center;background:#fff;border:2.5px solid var(--ink);border-radius:999px;padding:6px 12px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
.fab{background:var(--teal);color:#fff;border:2px solid var(--ink);border-radius:999px;padding:9px 14px;font-weight:900;cursor:pointer;font-size:12px;max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lang-select{border:2px solid var(--ink);border-radius:999px;padding:7px 12px;font-weight:800;background:#fff;font-size:12px;cursor:pointer;outline:none}
button,select{font-family:inherit}
@media (max-width:760px){
  .fab-wrap{flex-wrap:wrap;justify-content:center;border-radius:22px;padding:8px 10px}
  .fab{max-width:46vw}
}
.menu-wrap{position:relative;flex:0 0 auto}
.pill{display:inline-flex;align-items:center;gap:6px;background:#fff;border:2px solid var(--ink);border-radius:999px;padding:7px 10px;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;color:var(--ink)}
.pill.random{background:var(--yellow)}
.pill .caret{font-size:9px;transition:transform .15s}
.pill[aria-expanded="true"] .caret{transform:rotate(180deg)}
.menu{position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%);min-width:176px;background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:6px;box-shadow:0 12px 28px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:2px}
.menu[hidden]{display:none}
.menu button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;border-radius:10px;padding:9px 10px;font-size:12px;font-weight:800;text-align:left;cursor:pointer;color:var(--ink)}
.menu button:hover,.menu button:focus-visible{background:var(--cloud);outline:none}
.menu button.on{background:var(--ink);color:#fff}
.menu button[data-cols="0"].on{background:var(--yellow);color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
.menu hr{border:0;border-top:1.5px dashed rgba(0,0,0,.25);margin:4px 6px}
.mi{display:inline-flex;justify-content:center;width:22px;flex:0 0 22px}
.cn{font-size:10px;font-weight:900;margin-left:1px}
.fx-group{display:contents}
.fx-group[hidden]{display:none}
.ci{display:inline-flex;gap:2px;width:20px;height:12px}.ci i{flex:1;background:currentColor;border-radius:1.5px}
.pill.exp{background:#F3E5F5;border-color:var(--ink)}
#copyBtn{margin-left:6px}
body.empty-wall .pill.exp{display:none}
.pill .lbl{display:none}
.pill.zone .lbl{display:inline}
.pill{padding:7px 9px}
.pill.zone{padding:7px 11px}
@media (max-width:560px){.fab{max-width:28vw}}
@media (max-width:420px){.fab-wrap{gap:4px;padding:4px 6px}.pill{padding:6px 7px}.fab{padding:8px 10px;max-width:22vw}.lang-select{padding:6px 4px;max-width:64px}}
@media (prefers-reduced-motion:reduce){.pill .caret{transition:none}}
button:focus-visible,.tool-btn:focus-within,select:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
.fab.badge{cursor:default}
.pill.filt.active{background:var(--yellow)}
.pill.fx[aria-pressed="false"]{opacity:.55}
.pill.fx[aria-pressed="true"]{background:var(--yellow)}
.pill.snd[aria-pressed="true"]{background:var(--teal);color:#fff}
.pill.filt[aria-pressed="true"]{box-shadow:inset 0 0 0 2px var(--ink)}
.filter-bar{position:relative;z-index:1;width:min(920px,100%);display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border:2.5px solid var(--ink);border-radius:20px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.filter-bar[hidden]{display:none}
.filter-bar input{flex:1 1 220px;min-width:0;border:2px solid var(--ink);border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;background:var(--cloud);color:var(--ink)}
.filter-bar select{border:2px solid var(--ink);border-radius:999px;padding:7px 10px;font:inherit;font-size:12px;font-weight:800;background:#fff;color:var(--ink);max-width:100%}
.filter-bar input:focus-visible,.filter-bar select:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
.f-count{font-size:12px;font-weight:900;opacity:.7;white-space:nowrap}
.f-clear{border:2px solid var(--ink);border-radius:999px;padding:7px 12px;font:inherit;font-size:12px;font-weight:800;background:#fff;cursor:pointer;color:var(--ink)}
.masonry>.item.f-out{display:none}
.no-match{padding:48px 16px;text-align:center;font-weight:800;opacity:.55}
.pill.car[aria-pressed="true"]{background:var(--ink);color:#fff}
.masonry.carousel{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;scrollbar-width:none}
.masonry.carousel::-webkit-scrollbar{display:none}
.masonry.carousel>.item{scroll-snap-align:start}
.masonry.carousel.ready>.item{transition:none}
.masonry.carousel.ready{transition:height .3s ease}
.masonry.carousel .resize-anchor,.masonry.carousel .side-anchor{display:none}
.car-nav{position:relative;z-index:6;margin:0 auto 14px;width:max-content;max-width:calc(100% - 8px);display:flex;align-items:center;gap:10px;background:#fff;border:2.5px solid var(--ink);border-radius:999px;padding:6px 8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.car-nav[hidden]{display:none}
.car-arrow{width:34px;height:34px;border-radius:50%;border:2px solid var(--ink);background:var(--yellow);font-size:20px;font-weight:900;line-height:1;cursor:pointer;color:var(--ink);flex:0 0 auto}
.car-arrow:disabled{opacity:.35;cursor:default}
.car-side{position:absolute;z-index:6;width:44px;height:44px;border-radius:50%;border:2.5px solid var(--ink);background:var(--yellow);color:var(--ink);font-size:28px;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.22);display:grid;place-items:center;padding:0 0 4px;transition:opacity .15s,transform .15s}
.car-side[hidden]{display:none}
.car-side:hover:not(:disabled){transform:scale(1.08)}
.car-side:disabled{opacity:.25;cursor:default}
@media (max-width:560px){.car-side{width:36px;height:36px;font-size:22px}}
@media (prefers-reduced-motion:reduce){.car-side{transition:none}}
.car-dots{display:flex;align-items:center;gap:6px;overflow:hidden}
.car-dot{width:10px;height:10px;padding:0;border-radius:50%;border:2px solid var(--ink);background:#fff;cursor:pointer;flex:0 0 auto;transition:width .2s,background .2s}
.car-dot[aria-current="true"]{width:24px;border-radius:999px;background:var(--teal)}
.car-count{font-size:12px;font-weight:900;min-width:54px;text-align:center}
@media (prefers-reduced-motion:reduce){.masonry.carousel{scroll-behavior:auto}.car-dot{transition:none}}
.pill.shuffle:hover{background:var(--cloud)}
.pill[aria-busy="true"]{opacity:.55;cursor:progress}
body.shuffling iframe{pointer-events:none}
body.shuffling{overflow-x:hidden}
.menu button[data-cols="-1"].on{background:var(--teal);color:#fff}
.ins-kinds{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ins-kind{border:2px solid var(--ink);border-radius:999px;background:#fff;padding:4px 11px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}
.ins-kind:hover{background:var(--yellow)}
.ins-kinds-note{font-size:10.5px;font-weight:700;opacity:.55}
.spr-box{display:flex;flex-direction:column;gap:6px;border:2px dashed var(--ink);border-radius:14px;padding:10px 12px;background:#fff}
.spr-box>b{font-size:12px}
.spr-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.spr{position:relative;width:74px;height:74px;border:2px solid var(--ink);border-radius:12px;background:var(--cloud);display:flex;align-items:center;justify-content:center}
.spr img{max-width:58px;max-height:58px;object-fit:contain}
.spr-tag{position:absolute;left:4px;top:3px;font-size:8.5px;font-weight:900;color:var(--green)}
.spr-acts{position:absolute;right:-6px;bottom:-8px;display:flex;gap:3px}
.spr-acts button,.spr-add,.spr-reset{border:2px solid var(--ink);background:#fff;border-radius:50%;width:24px;height:24px;padding:0;font:inherit;font-size:11px;font-weight:900;cursor:pointer;line-height:1}
.spr-acts button[data-rep]{background:var(--yellow)}
.spr-add{width:74px;height:74px;border-radius:12px;border-style:dashed;font-size:22px}
.spr-reset{width:30px;height:30px}
.spr-acts button:hover,.spr-add:hover,.spr-reset:hover{background:var(--teal);color:#fff}
.spr-note{font-size:11px;font-weight:800;opacity:.6}.spr-note.bad{color:#c0392b;opacity:1}
.pill.fx:disabled{opacity:.35;cursor:not-allowed}
.fold{display:none;position:absolute;left:0;right:0;bottom:0;z-index:7;height:74px;align-items:flex-end;justify-content:center;padding-bottom:10px;pointer-events:none;background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,.92) 62%)}
.item.clipped .fold{display:flex}
.item.unfolded .fold{display:flex;height:auto;background:none}
.fold-btn{pointer-events:auto;border:2px solid var(--ink);background:var(--yellow);color:var(--ink);border-radius:999px;padding:4px 14px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15)}
.fold-btn:hover{background:var(--teal);color:#fff}
.item.unfolded .fold-btn{background:#fff}
.masonry.carousel .fold{display:none!important}
.ins,.gdel{z-index:9}
.del,.edit,.tog{position:absolute;top:6px;width:18px;height:18px;padding:0;border-radius:50%;border:0;cursor:pointer;z-index:9;font-weight:900;font-size:9px;line-height:18px;text-align:center;opacity:.35;transition:opacity .15s}
.del{right:6px;background:rgba(0,0,0,.6);color:#fff}
.edit{right:28px;background:rgba(255,255,255,.75);color:#111}
.tog{right:50px;background:rgba(255,255,255,.75);color:#111;font-size:10px}
.item:hover .del,.item:hover .edit,.item:hover .tog,.del:focus-visible,.edit:focus-visible,.tog:focus-visible{opacity:1}
@media (pointer:coarse){.del,.edit,.tog{width:22px;height:22px;line-height:22px;font-size:10px;opacity:.5}.edit{right:32px}.tog{right:58px}}
@media (prefers-reduced-motion:reduce){.del,.edit,.tog{transition:none}}
.move-anchor{position:absolute;left:0;top:0;bottom:0;width:28px;cursor:grab;z-index:7;touch-action:none;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.move-anchor::after{content:'⠿';font-size:18px;font-weight:900;color:var(--ink);opacity:.5;text-shadow:0 0 3px rgba(255,255,255,.9)}
.item:hover .move-anchor{opacity:1}
body.dragging-card .move-anchor{opacity:1;cursor:grabbing}
.item.moving{cursor:grabbing;box-shadow:0 18px 36px rgba(0,0,0,.28);z-index:6!important}
.item.free::after{content:'📌';position:absolute;left:48px;top:4px;z-index:6;font-size:13px;line-height:1;pointer-events:none}
.masonry.carousel .move-anchor,body.guest .move-anchor{display:none}
@media (pointer:coarse){.move-anchor{width:34px;opacity:.5}}
.import-panel{position:fixed;top:68px;left:50%;transform:translateX(-50%);width:min(920px,96vw);background:#fff;border:2.5px solid var(--ink);border-radius:20px;padding:16px;max-height:92vh;display:flex;flex-direction:column;z-index:85;overflow:auto}
.import-panel.hidden{display:none}
.import-panel textarea, .ta-wrap textarea, textarea#input{width:100%;flex:1;min-height:380px;border:2px solid var(--ink);border-radius:12px;padding:12px;font-family:monospace;background:var(--cloud);line-height:1.8;font-size:12px}
.ta-wrap{display:flex;gap:8px;flex:1;min-height:380px;position:relative}
.ta-wrap.sized{flex:0 0 auto;height:var(--ta-h);min-height:0}
.ta-wrap.sized #input{min-height:0;height:100%}
#input{resize:none}
.ta-grip{position:absolute;right:6px;bottom:6px;width:22px;height:22px;z-index:4;
  cursor:ns-resize;border-radius:6px;touch-action:none;
  background:linear-gradient(135deg,transparent 0 46%,var(--ink) 46% 54%,transparent 54% 70%,var(--ink) 70% 78%,transparent 78%);
  opacity:.38;transition:opacity .15s}
.ta-grip:hover,.ta-grip:focus-visible{opacity:.95;outline:none}
.ta-grip:focus-visible{box-shadow:0 0 0 2px var(--teal)}
.ta-wrap #input{flex:1;min-height:0;scrollbar-width:none}
.ta-wrap #input::-webkit-scrollbar{width:0;height:0}
.ta-bar{width:30px;flex:0 0 30px;border:2px solid var(--ink);border-radius:999px;background:var(--cloud);position:relative;touch-action:none;cursor:pointer}
.ta-bar[hidden]{display:none}
.ta-thumb{position:absolute;left:3px;right:3px;top:0;min-height:56px;border-radius:999px;background:var(--teal);box-shadow:inset 0 0 0 1.5px var(--ink);cursor:grab}
.ta-bar.drag .ta-thumb{cursor:grabbing;background:#0b6b6a}
.import-panel{scrollbar-width:auto}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center}
.tool-btn{border:2px solid var(--ink);border-radius:999px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;background:#fff}
.tool-btn.primary{background:var(--teal);color:#fff}
.zdrag{display:flex;align-items:center;gap:6px}
.zchip{display:inline-flex;align-items:center;gap:5px;border:2px solid var(--ink);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:900;background:#fff;cursor:grab;user-select:none}
.zchip .grip{opacity:.45;font-size:12px}
.zchip.fixed{background:var(--cloud);cursor:default;opacity:.7}
.zchip.drag{opacity:.45;cursor:grabbing}
.zchip.over{box-shadow:0 0 0 3px var(--teal)}
.tabs{display:flex;gap:6px;margin:6px 0 2px}
.tab{border:2px solid var(--ink);border-radius:999px;padding:6px 14px;font:inherit;font-size:11px;font-weight:900;background:#fff;cursor:pointer;color:var(--ink)}
.tab[aria-selected="true"]{background:var(--ink);color:#fff}
.pane[hidden]{display:none}
.pane-pics{display:flex;flex-direction:column;gap:10px;flex:1;min-height:320px}
.drop{border:2.5px dashed var(--ink);border-radius:16px;padding:22px;text-align:center;font-weight:800;font-size:12px;background:var(--cloud);cursor:pointer}
.drop.over{background:var(--yellow)}
.pics{display:flex;flex-wrap:wrap;gap:10px;overflow:auto;max-height:280px}
.pic .m3d{width:100%;height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:radial-gradient(120% 120% at 50% 0%,#fff,#E6E2DB);color:#111;font-weight:900}
.pic .m3d b{font-size:19px;line-height:1}
.pic .m3d span{font-size:9px;letter-spacing:.09em;opacity:.7}
.pic .m3d i{font-size:9px;font-style:normal;opacity:.5;max-width:92%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pic{width:150px;border:2px solid var(--ink);border-radius:12px;overflow:hidden;background:var(--cloud)}
.pic img{display:block;width:100%;height:92px;object-fit:contain;background:#fff}
.pic .row{display:flex;align-items:center;gap:4px;padding:6px;font-size:10px;font-weight:800}
.pic select{flex:1;min-width:0;border:1.5px solid var(--ink);border-radius:999px;padding:3px 4px;font:inherit;font-size:10px;font-weight:800;background:#fff}
.pic button{border:1.5px solid var(--ink);background:#fff;border-radius:999px;width:22px;height:22px;cursor:pointer;font-weight:900}
.meta-fields{display:grid;grid-template-columns:2fr 1.5fr 1fr;gap:8px;margin:4px 0 8px}
.meta-fields[hidden]{display:none}
.meta-fields label{display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:900;opacity:.85}
.meta-fields input{border:2px solid var(--ink);border-radius:10px;padding:7px 10px;font:inherit;font-size:12px;font-weight:700;background:var(--cloud);color:var(--ink)}
@media (max-width:560px){.meta-fields{grid-template-columns:1fr}}
.globe{background:#fff;border:2.5px solid var(--ink);border-radius:50%;width:36px;height:36px;cursor:pointer;flex:0 0 auto}
@media (max-width:420px){.globe{display:none}}
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);background:var(--ink);color:#fff;padding:10px 16px;border-radius:999px;font-size:12px;font-weight:800;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:95;max-width:92vw}
.toast.show{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.toast{transition:none}}
`;

/* ============================================================
 * Multi-line HTML/Markdown splitter (mirrors editor logic)
 * ============================================================ */
const SEP_RE = /^[━─—–\-_*•·・－ー]{3,}$/;
const ZONE_A_RE = /^={3,}$/;
const ZONE_C_RE = /^#{1,}$/;
const VOID_TAGS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

function tagDepth(s: string): number {
  let depth = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (VOID_TAGS.test(m[2]) || m[3]) continue;
    depth += m[1] ? -1 : 1;
  }
  return depth;
}
const isClosed = (s: string) => s.lastIndexOf('<') <= s.lastIndexOf('>') && tagDepth(s) <= 0;

function splitBlocks(text: string): string[] {
  const out: string[] = [];
  let buf: string | null = null;
  let md: string | null = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (md !== null) {
      md += '\n' + rawLine;
      if (/<\/md>\s*$/i.test(line)) { out.push(md.trim()); md = null; }
      continue;
    }
    if (buf === null && /^<md>/i.test(line)) {
      if (/<\/md>\s*$/i.test(line) && line.length > 4) out.push(line);
      else md = rawLine;
      continue;
    }
    if (buf !== null) {
      if (ZONE_C_RE.test(line) || ZONE_A_RE.test(line) || SEP_RE.test(line) ||
          (/^https?:\/\/\S+$/i.test(line) && buf.lastIndexOf('<') <= buf.lastIndexOf('>'))) {
        out.push(buf.trim()); buf = null;
      } else {
        buf += '\n' + rawLine;
        if (isClosed(buf)) { out.push(buf.trim()); buf = null; }
        continue;
      }
    }
    if (ZONE_C_RE.test(line)) { out.push('__ZONE_C__'); continue; }
    if (ZONE_A_RE.test(line)) { out.push('__ZONE_A__'); continue; }
    if (!line || SEP_RE.test(line)) continue;
    if (line.startsWith('<')) {
      if (/^<script\b/i.test(line) && out.length && out[out.length - 1].startsWith('<'))
        buf = out.pop() + '\n' + rawLine;
      else buf = rawLine;
      if (isClosed(buf)) { out.push(buf.trim()); buf = null; }
      continue;
    }
    const found = line.match(/https?:\/\/[^\s"'<>]+/gi);
    if (found) out.push(...found);
    else out.push(line);
  }
  if (buf !== null) out.push(buf.trim());
  if (md !== null) out.push(md.trim());
  return out;
}

/* ============================================================
 * React component
 * ============================================================ */
const EzSheetPreview: React.FC<EzSheetPreviewProps> = ({
  content,
  title = 'EzSheet Preview',
  className = '',
  height = 900,
  wallId = 'ezsheet',
  lang = 'en',
  cols,
  car,
  filter,
  editable = false,
  zones,
  zorder,
  fireworks,
  flying,
  sound,
  sprites,
  syncUrl,
  frameCheckUrl,
  metaUrl,
  auth,
  isOwner = false,
  onItemsChange,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedAuth = useMemo(() => {
    if (auth?.user) return auth;
    if (typeof window !== 'undefined') {
      if ((window as any).auth?.user) {
        return (window as any).auth;
      }
      try {
        const appEl = document.getElementById('app');
        if (appEl?.dataset?.page) {
          const p = JSON.parse(appEl.dataset.page);
          if (p?.props?.auth?.user) {
            return p.props.auth;
          }
        }
      } catch (e) {}
    }
    return auth || { user: null };
  }, [auth]);

  const payload = useMemo(() => {
    if (!content) return null;

    let list: any[] = [];
    let detectedId = wallId;
    let detectedCols = typeof cols === 'number' ? cols : undefined;
    let detectedCar = typeof car === 'boolean' ? car : undefined;
    let detectedFilter: boolean | undefined = typeof filter === 'boolean' ? filter : undefined;
    let detectedLang = lang;
    let detectedZones = zones;
    let detectedZorder = zorder;
    let detectedFx =
      fireworks !== undefined || flying !== undefined || sound !== undefined
        ? { fw: !!fireworks, fly: !!flying, snd: sound !== false }
        : undefined;

    const trimmed = String(content).trim();

    const dataMatch = trimmed.match(
      /<script\s+id=["']wall-data["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (dataMatch?.[1]) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        if (parsed && typeof parsed === 'object') {
          if (parsed.id) detectedId = String(parsed.id);
          if (Array.isArray(parsed.list)) list = parsed.list;
          else if (Array.isArray(parsed)) list = parsed;
          if (typeof parsed.cols === 'number') detectedCols = parsed.cols;
          if (typeof parsed.car === 'boolean') detectedCar = parsed.car;
          if (typeof parsed.filter === 'boolean') detectedFilter = parsed.filter;
          if (typeof parsed.lang === 'string') detectedLang = parsed.lang;
          if (parsed.zones && typeof parsed.zones === 'object') detectedZones = parsed.zones;
          if (Array.isArray(parsed.zorder)) detectedZorder = parsed.zorder;
          if (parsed.fx && typeof parsed.fx === 'object') detectedFx = parsed.fx;
        }
      } catch (e) {
        console.warn('EzSheetPreview: failed to parse wall-data JSON', e);
      }
    }

    if (list.length === 0 && /^[\[{]/.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.id) detectedId = String(parsed.id);
          if (Array.isArray(parsed.list)) list = parsed.list;
          if (typeof parsed.cols === 'number') detectedCols = parsed.cols;
          if (typeof parsed.car === 'boolean') detectedCar = parsed.car;
          if (typeof parsed.filter === 'boolean') detectedFilter = parsed.filter;
          if (typeof parsed.lang === 'string') detectedLang = parsed.lang;
          if (parsed.zones && typeof parsed.zones === 'object') detectedZones = parsed.zones;
          if (Array.isArray(parsed.zorder)) detectedZorder = parsed.zorder;
          if (parsed.fx && typeof parsed.fx === 'object') detectedFx = parsed.fx;
        }
      } catch (e) {
        console.warn('EzSheetPreview: failed to parse JSON content', e);
      }
    }

    if (list.length === 0 && trimmed) {
      const blocks = splitBlocks(trimmed);
      const out: any[] = [];
      let buf: any[] = [];
      const flush = (zone: 'a' | 'b' | 'c') => {
        buf.forEach((o) => { o.zone = zone; out.push(o); });
        buf = [];
      };
      for (const b of blocks) {
        if (b === '__ZONE_C__') { flush('c'); continue; }
        if (b === '__ZONE_A__') { flush('a'); continue; }
        const block = b.trim();
        if (!block) continue;
        const it = parseOneBlock(block);
        if (it) buf.push(it);
      }
      flush('b');
      list = out;
    }

    if (list.length === 0) return null;

    const normalized = list
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const raw =
          item._raw ||
          (item.type === 'html' && item.html) ||
          (item.type === 'md' && item.md && `<md>${item.md}</md>`) ||
          item.url ||
          '';
        const out: any = {
          _raw: raw,
          type: item.type || (item.html ? 'html' : item.md ? 'md' : 'web'),
          w: Number(item.w) || 340,
          h: Number(item.h) || 220,
          zone: item.zone === 'a' || item.zone === 'c' ? item.zone : 'b',
        };
        [
          'url','id','html','md','mdl','title','tags','at','pub','dur','span','rh',
          'emb','blk','manual','free','px','py','pic','mh',
        ].forEach((k) => {
          if (item[k] !== undefined) out[k] = item[k];
        });
        if (!out.type || out.type === 'web') {
          const yt = String(out.url || '').match(
            /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
          );
          if (yt) { out.type = 'youtube'; out.id = yt[1]; }
        }
        return out;
      })
      .filter(Boolean) as any[];

    return {
      id: detectedId,
      cols: detectedCols !== undefined ? detectedCols : 0,
      car: detectedCar === true,
      lang: detectedLang,
      zones: detectedZones,
      zorder: detectedZorder,
      fx: detectedFx,
      filter: detectedFilter === true ? true : detectedFilter === false ? false : undefined,
      list: normalized,
      editable,
      sprites,
    };
  }, [content, wallId, lang, cols, car, filter, zones, zorder, fireworks, flying, sound, sprites, editable]);

  useEffect(() => {
    if (!payload || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const json = JSON.stringify(payload)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    const spriteInit = `window.WALL_SPRITES=${JSON.stringify(sprites || ['bee:0','bee:1']).replace(/</g, '\\u003c')};`;

    const parentOrigin =
      typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('about:')
        ? window.location.origin
        : '';
    const effectiveSyncUrl = syncUrl || parentOrigin;

    const doc = `<!DOCTYPE html>
<html lang="${payload.lang || 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>${WALL_CSS}</style>
</head>
<body class="${editable ? 'edit' : 'ro'}">
<div id="wall" class="masonry"></div>
<script id="wall-data" type="application/json">${json}</script>
<script>${spriteInit}</script>
<script>${WALL_CORE_SCRIPT}</script>
<script>
window.auth = ${JSON.stringify(resolvedAuth)};
window.isOwner = ${JSON.stringify(!!isOwner)};
window.WALL_ORIGIN = ${JSON.stringify(parentOrigin)};
try{WallCore.setWallSync(${JSON.stringify(effectiveSyncUrl)});}catch(e){}
${frameCheckUrl ? `try{WallCore.setFrameCheck(${JSON.stringify(frameCheckUrl)});}catch(e){}` : ''}
${metaUrl ? `try{WallCore.setMetaFetch(${JSON.stringify(metaUrl)});}catch(e){}` : ''}
try { WallCore.bootReadonly(); } catch (e) { console.error('bootReadonly failed', e); }
${editable && onItemsChange ? `
window.addEventListener('message', function(e){
  if(e.data && e.data.__ezsheetRequestItems){
    try {
      var el = document.getElementById('wall-data');
      if(el) parent.postMessage({__ezsheetItems: JSON.parse(el.textContent).list}, '*');
    } catch(err){}
  }
});
try {
  setInterval(function(){
    try {
      var el = document.getElementById('wall-data');
      if(el) parent.postMessage({__ezsheetItems: JSON.parse(el.textContent).list}, '*');
    } catch(err){}
  }, 4000);
} catch(e){}
` : ''}
</script>
</body>
</html>`;

    try {
      iframe.srcdoc = doc;
      setError(null);
    } catch (e) {
      setError('Failed to render EzSheet preview');
      console.error('EzSheetPreview: error setting srcdoc', e);
    }
  }, [payload, title, syncUrl, frameCheckUrl, metaUrl, editable, onItemsChange, sprites]);

  useEffect(() => {
    if (!onItemsChange) return;
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.__ezsheetItems) onItemsChange(e.data.__ezsheetItems);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onItemsChange]);

  if (!content) {
    return (
      <div className={`w-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 ${className}`}>
        <div className="text-center text-gray-500 text-sm">
          <div className="text-2xl mb-2">📊</div>
          <p>No EzSheet content to preview</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className={`w-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
      <iframe
        ref={iframeRef}
        title={title}
        className="w-full block bg-[#F7F5F1]"
        style={{ height: `${height}px`, border: 0 }}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation allow-same-origin allow-downloads"
        loading="lazy"
      />
    </div>
  );
};

/* ============================================================
 * Client-side block parser (mirrors core's parseOne)
 * ============================================================ */
function parseOneBlock(raw: string): any | null {
  raw = String(raw || '').trim();
  if (!raw) return null;

  if (/^<md>[\s\S]*<\/md>$/i.test(raw)) {
    return { _raw: raw, type: 'md', md: raw.replace(/^<md>[ \t]*\r?\n?/i, '').replace(/\r?\n?[ \t]*<\/md>$/i, ''), w: 420, h: 520 };
  }

  if (raw.startsWith('<')) {
    const modelMatch = raw.match(/^<model\b/i);
    if (modelMatch) {
      const g = (k: string) => ((raw.match(new RegExp('\\b' + k + '=["\']([^"\']*)["\']', 'i')) || [])[1] || '');
      const src = g('src').replace(/&amp;/g, '&');
      const type = g('type').toLowerCase() || (src.match(/^data:model\/(gltf-binary|gltf\+json|stl|obj)/i) || [])[1] || '';
      const ex = type === 'gltf-binary' ? 'glb' : type === 'gltf+json' ? 'gltf' : type;
      if (ex && /^(glb|gltf|stl|obj)$/.test(ex) && src) {
        return {
          _raw: raw, type: 'model',
          mdl: /^https?:\/\//i.test(src) ? { u: src, e: ex, n: g('name') } : { d: src, e: ex, n: g('name') },
          w: 380, h: 285,
        };
      }
    }
    const srcMatch = raw.match(/\bsrc=["']([^"']+)["']/i);
    const src = (srcMatch?.[1] || '').replace(/&amp;/g, '&');
    const ytMatch = (src || raw).match(
      /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      return {
        type: 'youtube', id: ytMatch[1],
        url: src || `https://www.youtube.com/watch?v=${ytMatch[1]}`,
        w: 340, h: 220, _raw: raw,
      };
    }
    if (/^<iframe\b[^>]*>\s*<\/iframe>$/i.test(raw) && src) {
      return { type: 'web', url: src, w: 340, h: 220, _raw: raw };
    }
    return { type: 'html', html: raw, w: 520, h: 720, _raw: raw };
  }

  const yt = raw.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt) {
    return { type: 'youtube', id: yt[1], url: raw, w: 340, h: 220, _raw: raw };
  }

  let s = raw;
  if (!/^https?:\/\//i.test(s)) {
    if (/\s/.test(s) || !/^[^\/\s]+\.[a-z]{2,}(\/|:|\?|$)/i.test(s)) return null;
    s = 'https://' + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.protocol === 'https:' && /\.(glb|gltf|stl|obj)$/i.test(u.pathname)) {
      return {
        type: 'model',
        mdl: { u: u.href, e: u.pathname.toLowerCase().replace(/^.*\./, ''), n: decodeURIComponent(u.pathname.split('/').pop() || '') },
        w: 380, h: 285, _raw: raw,
      };
    }
    return { type: 'web', url: u.href, w: 340, h: 220, _raw: raw };
  } catch {
    return null;
  }
}

export default EzSheetPreview;
export type { EzSheetItem, EzSheetPreviewProps };