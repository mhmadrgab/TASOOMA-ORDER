// 🎨 (v271) تنسيق الدردشة، فُصل عن bchat.js (كان 45 ألف حرف في أول الملف). أي كلاس جديد للدردشة يُكتب هنا.
export const STYLE=`
.bcv [hidden]{display:none!important}
.bcv{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--card);color:var(--ink);height:100%}
/* رأس المحادثة: صورة + اسم + حالة، زي تطبيقات التواصل */
.bch{display:flex;align-items:center;gap:11px;padding:9px 12px;background:var(--card);color:var(--ink);border-bottom:1px solid var(--line);flex:none;z-index:3;box-shadow:0 2px 10px rgba(0,0,0,.04)}
.bch>div{flex:1;min-width:0}.bch b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch small{display:flex;align-items:center;gap:4px;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch button,.bclh button{font:inherit;background:transparent;color:inherit;border:0;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;flex:none;display:grid;place-items:center;transition:background .15s}
.bch button:hover,.bclh button:hover{background:var(--soft,#f6eee3)}
.bch #bcav:empty{display:none}
/* الصور الرمزية: صورة الشخص، أو أول حرف بلون ثابت لكل اسم */
.av{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:16px;flex:0 0 auto!important;/* (v235) قواعد زي «.gfi span{flex:1}» كانت بتمطّ الصورة الحرفية لبيضاوي */color:#fff;direction:ltr;object-fit:cover;position:relative;overflow:hidden;letter-spacing:-.3px}
.av.c0{background:linear-gradient(135deg,#b48aab,#8a5a83)}.av.c1{background:linear-gradient(135deg,#3f8fd8,#235f9e)}.av.c2{background:linear-gradient(135deg,#3fb27f,#1f7a52)}.av.c3{background:linear-gradient(135deg,#e0776a,#b04538)}
.av.c4{background:linear-gradient(135deg,#8b74e0,#5a43b0)}.av.c5{background:linear-gradient(135deg,#2bb3c0,#17808b)}.av.c6{background:linear-gradient(135deg,#e39a4a,#b36b1e)}.av.c7{background:linear-gradient(135deg,#4b4b4b,#2a1d2c);color:#e3c8dd}
.av.sm{width:40px;height:40px;font-size:14.5px}.av.avb{font-size:13.5px}.av.avd{font-size:21px}
img.av{background:#2a1d2c}
/* منطقة الرسايل: خلفية بنقشة هادية */
.bcms{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 14px 14px;display:flex;flex-direction:column;gap:0;overscroll-behavior:contain;scroll-behavior:auto;contain:strict;overflow-anchor:none;-webkit-overflow-scrolling:touch;
 background-color:#efe8db;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23a07a2c' stroke-opacity='.10' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3Cpath d='M128 128c0-6 10-6 10 0s-10 10-10 10-10-4-10-10 10-6 10 0'/%3E%3Ccircle cx='140' cy='40' r='2'/%3E%3Ccircle cx='70' cy='140' r='2'/%3E%3Ccircle cx='8' cy='70' r='2'/%3E%3C/g%3E%3C/svg%3E")}
.bcmt{margin:auto;text-align:center;color:var(--mut);font-size:14.5px;line-height:1.9;padding:18px 22px;background:rgba(255,255,255,.75);border-radius:14px;max-width:340px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bcmt.ok b{display:block;font-size:34px;line-height:1.3}
.bcday{position:sticky;top:4px;z-index:2;align-self:center;font-size:12px;font-weight:700;color:#5b5446;background:rgba(255,253,248,.95);border-radius:9px;padding:4px 12px;margin:10px 0 6px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
/* الفقاعة */
.bcg{position:relative;display:flex;flex-wrap:wrap;align-items:flex-end;column-gap:10px;max-width:min(80%,560px);border-radius:12px;padding:6px 10px 5px;font-size:15px;line-height:1.55;word-wrap:break-word;overflow-wrap:anywhere;margin-top:8px;box-shadow:0 1px 1px rgba(0,0,0,.12);touch-action:pan-y;-webkit-touch-callout:none;transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .2s}
.bcg.in{animation:bc-in .32s cubic-bezier(.2,.8,.2,1) both}
.bcg.sw{transition:none}
@media (hover:none){.bcg{-webkit-user-select:none;user-select:none}}
/* ↩️ الرد: المقتطف داخل الفقاعة + سهم يظهر وقت السحب */
.bcrp{flex-basis:100%;display:block;text-align:start;font:inherit;border:0;cursor:pointer;background:rgba(0,0,0,.055);border-inline-start:3px solid #8a5a83;border-radius:8px;padding:5px 9px;margin:2px 0 5px;color:inherit;min-width:0;max-width:100%}
.bcrp b{display:block;font-size:12.5px;font-weight:800;color:#8a5a83;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcrp span{display:block;font-size:13px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcg.ot .bcrp{border-inline-start-color:#2bb3a0}.bcg.ot .bcrp b{color:#1f8a7a}
.bcsw{position:absolute;top:50%;width:30px;height:30px;margin-top:-15px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.08);color:#5b5446;opacity:0;transform:scale(.4);transition:opacity .15s,transform .15s;pointer-events:none}
.bcg.me .bcsw{inset-inline-end:-40px}.bcg.ot .bcsw{inset-inline-start:-40px}.bcsw svg{width:17px;height:17px}
.bcsw.on{opacity:1;transform:scale(1)}.bcsw.go{background:#8a5a83;color:#fff}
/* ✏️ معدّلة · 🚫 محذوفة · ✨ تمييز الرسالة الأصلية بعد الضغط على الرد */
.bcg small .bced{font-style:italic;opacity:.85;margin-inline-end:2px}
.bcg.del .bcx{font-style:italic;opacity:.65;display:inline-flex;align-items:center;gap:6px}.bcg.del .bcx svg{width:15px;height:15px;flex:none}
.bcg.bchl{animation:bc-hl 1.4s ease}
@keyframes bc-hl{0%,60%{box-shadow:0 0 0 3px rgba(138,90,131,.55),0 1px 1px rgba(0,0,0,.12)}100%{box-shadow:0 1px 1px rgba(0,0,0,.12)}}
.bcg.sel{transform:scale(1.02);box-shadow:0 10px 30px rgba(0,0,0,.18)}
/* زر القائمة على الفقاعة (الحاسوب): يظهر عند المرور */
.bcmb{position:absolute;top:3px;inset-inline-end:4px;width:24px;height:24px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;background:inherit;color:rgba(0,0,0,.45);opacity:0;transition:opacity .15s;box-shadow:-6px 0 8px -2px currentColor;box-shadow:none}
.bcmb svg{width:16px;height:16px}
@media (hover:hover){.bcg:hover .bcmb,.bcmb:focus-visible{opacity:1}}
/* شريط الرد/التعديل فوق خانة الكتابة */
.bcrb{display:flex;align-items:center;gap:10px;padding:8px 12px 2px;background:#efe8db;flex:none;animation:bc-up .22s cubic-bezier(.2,.8,.2,1) both}
.bcrb>div{flex:1;min-width:0;background:var(--card);border-radius:12px;padding:7px 11px;border-inline-start:4px solid #8a5a83;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bcrb b{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#8a5a83}.bcrb b svg{width:14px;height:14px}
.bcrb span{display:block;font-size:13.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcrb button{font:inherit;border:0;background:rgba(0,0,0,.07);color:var(--ink);border-radius:50%;width:30px;height:30px;cursor:pointer;flex:none;display:grid;place-items:center}
.bcrb button svg{width:15px;height:15px}
@keyframes bc-up{from{opacity:0;transform:translateY(10px)}}
/* القائمة على الرسالة: زي قوائم أبل (رد، نسخ، تعديل، حذف) */
#bcamv{position:fixed;inset:0;z-index:96;background:rgba(20,14,22,.18);animation:ui-fade .15s ease both}
#bcam{position:fixed;z-index:97;min-width:210px;max-width:min(280px,calc(100vw - 24px));background:var(--card,#fffaf3);color:var(--ink,#2a1d2c);border-radius:14px;padding:5px;box-shadow:0 16px 48px rgba(0,0,0,.24),0 0 0 .5px rgba(0,0,0,.08);transform-origin:var(--ox,50%) var(--oy,0);animation:bc-am .22s cubic-bezier(.2,.9,.25,1.12) both}
@keyframes bc-am{from{opacity:0;transform:scale(.86)}}
#bcam button{display:flex;align-items:center;gap:12px;width:100%;font:inherit;font-size:15px;text-align:start;border:0;background:none;color:inherit;border-radius:10px;padding:10px 12px;cursor:pointer}
#bcam button:hover,#bcam button:focus-visible{background:var(--soft,#f6eee3);outline:0}
#bcam button svg{width:19px;height:19px;flex:none;opacity:.8}
#bcam button span{flex:1}#bcam button small{font-size:11.5px;color:var(--mut)}
#bcam hr{border:0;height:1px;background:var(--line,#e3d5c3);margin:4px 8px}
#bcam .rd{color:#d4342a}#bcam .rd svg{opacity:1}#bcam .rd.cf{background:#d4342a;color:#fff}
#bcam .inf{display:block;font-size:12px;color:var(--mut);padding:6px 12px 4px;line-height:1.5}
/* 🔍 (v179) البحث داخل المحادثة */
.bch #bcsrb svg{width:20px;height:20px}
.bcsb{display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--card);border-bottom:1px solid var(--line);flex:none;animation:bc-dn .2s cubic-bezier(.2,.8,.2,1) both}
.bcsb input{flex:1;min-width:0;font:inherit;font-size:15px;border:0;border-radius:999px;background:var(--field,#f2e9dd);color:var(--ink);padding:8px 14px}
.bcsb input:focus{outline:0;box-shadow:0 0 0 2px rgba(180,138,171,.55)}
.bcsb small{font-size:12.5px;color:var(--mut);white-space:nowrap;min-width:44px;text-align:center;direction:ltr}
.bcsb button{font:inherit;border:0;background:none;color:var(--ink);width:34px;height:34px;border-radius:50%;cursor:pointer;display:grid;place-items:center;flex:none}
.bcsb button:hover{background:var(--soft,#f6eee3)}.bcsb button svg{width:18px;height:18px}.bcsb button:disabled{opacity:.35;cursor:default}
@keyframes bc-dn{from{opacity:0;transform:translateY(-6px)}}
.bcg mark{background:#ffe08a;color:inherit;border-radius:3px;padding:0 1px}
.bcg.bcfcur{box-shadow:0 0 0 2.5px #e8a317,0 1px 1px rgba(0,0,0,.12)}
.bcsmore{align-self:center;font:inherit;font-size:13px;font-weight:700;border:0;background:rgba(255,253,248,.95);color:#8a5a83;border-radius:999px;padding:6px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);margin:4px 0}
/* 📌 الرسالة المثبّتة */
.bcpin{display:flex;align-items:center;gap:10px;width:100%;font:inherit;text-align:start;border:0;border-bottom:1px solid var(--line);background:var(--card);color:var(--ink);padding:7px 14px;cursor:pointer;flex:none}
.bcpin svg{width:17px;height:17px;flex:none;color:#8a5a83}
.bcpin span{flex:1;min-width:0}.bcpin b{display:block;font-size:12px;color:#8a5a83;font-weight:800}
.bcpin i{display:block;font-style:normal;font-size:13.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcpin:hover{background:var(--soft,#f6eee3)}
/* ↪️ محوَّلة · ✍️ يكتب الآن */
.bcfwd{flex-basis:100%;display:flex;align-items:center;gap:4px;font-size:12px;font-style:italic;opacity:.65;margin-bottom:1px}.bcfwd svg{width:13px;height:13px}
.bcty{color:#1f9d55;font-weight:700;display:inline-flex;align-items:center;gap:5px}
.bcty i{display:inline-flex;gap:2px}.bcty i b{width:4px;height:4px;border-radius:50%;background:currentColor;animation:bc-dot 1.2s infinite ease-in-out}
.bcty i b:nth-child(2){animation-delay:.15s}.bcty i b:nth-child(3){animation-delay:.3s}
@keyframes bc-dot{0%,60%,100%{opacity:.25;transform:none}30%{opacity:1;transform:translateY(-2px)}}
.bcr .nm small .bcty{font-weight:700}
/* ↪️ نافذة التحويل */
#bcfw{position:fixed;inset:0;z-index:98;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:14px;animation:ui-fade .15s ease both}
#bcfw .fwp{width:100%;max-width:440px;max-height:min(640px,calc(100dvh - 28px));display:flex;flex-direction:column;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.4);animation:bc-am .22s cubic-bezier(.2,.9,.25,1.12) both}
#bcfw .fwh{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}#bcfw .fwh b{flex:1;font-size:17px}
#bcfw .fwh button{font:inherit;border:0;background:rgba(0,0,0,.06);color:inherit;border-radius:50%;width:34px;height:34px;cursor:pointer;display:grid;place-items:center}#bcfw .fwh button svg{width:16px;height:16px}
#bcfw .fwq{margin:0 16px 8px;font:inherit;font-size:15px;border:0;border-radius:999px;background:var(--field,#f2e9dd);color:var(--ink);padding:9px 14px}
#bcfw .fwm{margin:0 16px 8px;font-size:13px;color:var(--mut);background:var(--soft,#f6eee3);border-radius:10px;padding:7px 11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bcfw .fwl{overflow-y:auto;padding:0 8px 10px;flex:1}
#bcfw .fwl button{display:flex;align-items:center;gap:11px;width:100%;font:inherit;text-align:start;border:0;background:none;color:inherit;border-radius:12px;padding:8px 10px;cursor:pointer}
#bcfw .fwl button:hover,#bcfw .fwl button:focus-visible{background:var(--soft,#f6eee3);outline:0}#bcfw .fwl button span{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bcfw .fwl button small{color:var(--mut);font-size:12px}#bcfw .fwl button.go{background:#8a5a83;color:#fff}#bcfw .fwl button.go small{color:#f1e3ee}
#bcfw .fwe{padding:24px;text-align:center;color:var(--mut)}
:where([data-theme=dark]) .bcg mark{background:#8a6a10;color:#fff}:where([data-theme=dark]) .bcpin b,:where([data-theme=dark]) .bcpin svg{color:#e3c8dd}
:where([data-theme=dark]) #bcfw .fwh button{background:rgba(255,255,255,.1)}
@media (prefers-reduced-motion:reduce){.bcty i b,.bcsb,#bcfw .fwp{animation:none}}
.bcdown b{position:absolute;top:-6px;inset-inline-end:-4px;background:#8a5a83;color:#fff;border-radius:999px;font-size:11px;min-width:19px;line-height:19px;padding:0 5px;font-weight:800}
.bcg.cont{margin-top:2px}
.bcg>i{flex-basis:100%;display:flex;align-items:center;gap:6px;font-style:normal;font-size:12.5px;font-weight:800;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcg>i img{width:18px;height:18px;border-radius:50%;object-fit:cover}
.bcg .bcx{flex:1 1 auto;white-space:pre-wrap;min-width:0}
.bcg small{flex:none;display:inline-flex;align-items:center;gap:3px;margin-inline-start:auto;font-size:11px;line-height:1;color:rgba(0,0,0,.45);padding-top:6px;white-space:nowrap;direction:ltr}
.bcg .tk{width:17px;height:11px;flex:none;color:#8d8778}.bcg .tk.rd{color:#2a9df4}
.bcg .rqt{flex-basis:100%;display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;background:rgba(0,0,0,.06);border-inline-start:3px solid #8a5a83;border-radius:6px;padding:4px 8px;margin:2px 0 5px}
.bcg.me{align-self:flex-start;background:#efdcea;color:#1f1a10;border-start-start-radius:3px}
.bcg.ot{align-self:flex-end;background:#fff;color:#2a1d2c;border-start-end-radius:3px}
.bcg.cont.me{border-start-start-radius:12px}.bcg.cont.ot{border-start-end-radius:12px}
.bcg:not(.cont)::before{content:"";position:absolute;top:0;width:9px;height:13px}
.bcg.me:not(.cont)::before{right:-8px;background:#efdcea;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot:not(.cont)::before{left:-8px;background:#fff;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.me:not(.cont)::before{right:auto;left:-8px;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.ot:not(.cont)::before{left:auto;right:-8px;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot>i{color:#8a5a83}
/* 📷 الصور + 👥 الجروبات */
.bcf button.pic{background:transparent;color:var(--mut);box-shadow:none;width:42px}.bcf button.pic svg{width:24px;height:24px}
.bcg.pic{padding:4px 4px 5px}.bcfile{display:flex;align-items:center;gap:10px;border:0;background:rgba(0,0,0,.06);border-radius:12px;padding:10px 12px;cursor:pointer;font:inherit;color:inherit;text-align:start;max-width:260px}.bcfile i{font-style:normal;font-size:26px}.bcfile b{display:block;font-size:13.5px;word-break:break-all}.bcfile small{display:block;font-size:11.5px;opacity:.7}
.bcimg{display:block;border:0;padding:0;margin:0 0 4px;border-radius:9px;overflow:hidden;cursor:zoom-in;background:rgba(0,0,0,.08);width:min(280px,62vw);max-height:340px}.bcimg img{width:100%;height:100%;object-fit:cover;display:block}
.bcg.pic .bcx{padding:0 6px}.bcg.pic>i{padding:2px 6px 0}.bcg.pic small{padding:0 6px}
#bciv{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.92);flex-direction:column;align-items:center;justify-content:center;padding:12px}#bciv.on{display:flex}
#bciv img{max-width:100%;max-height:78vh;object-fit:contain;border-radius:8px}#bciv .iv-t{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:12px 16px;color:#fff}#bciv .iv-t small{opacity:.7}#bciv .iv-t button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:50%;width:40px;height:40px;cursor:pointer}
#bciv .iv-l{color:#fff;margin-top:12px;text-align:center;line-height:1.8}#bciv .iv-l a{display:inline-block;color:#2a1d2c;background:#b48aab;font-weight:800;border-radius:999px;padding:8px 18px;text-decoration:none}
.bclh .bcng{font:inherit;font-weight:800;font-size:13px;border:0;border-radius:999px;padding:8px 14px;width:auto;height:auto;background:#2a1d2c;color:#e3c8dd;cursor:pointer;white-space:nowrap}.bclh .bcng:hover{background:#2d2131}
.bcr .nm small .gwho{font-weight:700;color:var(--ink)}
#bcgm,#bcgi{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);padding:14px;overflow:auto}#bcgm.on,#bcgi.on{display:block}
.gfk2{max-width:560px;margin:3vh auto;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.gfh{display:flex;align-items:center;gap:10px;padding:14px 18px;background:linear-gradient(120deg,#2d2131,#2a1d2c);color:#fff;border-bottom:3px solid #b48aab}.gfh b{font-size:18px}.gfh button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;width:36px;height:36px;cursor:pointer}
.gfb{padding:14px 18px;max-height:62vh;overflow:auto}.gfb label{display:block;font-size:13px;color:var(--mut);margin:8px 0 4px}.gfb input[type=search],#gfn{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f2e9dd);color:var(--ink);padding:9px 12px}
.gfs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.gfs button{font:inherit;font-size:12.5px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}
.gft{font-weight:800;font-size:14px;margin:12px 0 4px}.gfi{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:12px;cursor:pointer}.gfi.on{background:var(--soft,#f6eee3)}.gfi input{width:20px;height:20px;flex:none}.gfi span{flex:1;min-width:0;font-weight:600}.gfa{color:#8a5a83;font-weight:700}
.gff{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--line);background:var(--soft,#f6eee3)}.gff button{flex:1;font:inherit;font-weight:800;border-radius:12px;padding:11px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.gff .ok{background:#2a1d2c;color:#fff;border-color:#2a1d2c}.gff .del{color:#c4362b;border-color:#c4362b}
.bcg.pend{opacity:.74}.bcg .pc{width:12px;height:12px;flex:none;opacity:.75}.bcg.fail{box-shadow:inset 0 0 0 1.5px #c0392b}
.bcfail{align-self:flex-start;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;color:#c0392b;margin:3px 4px 6px;font-weight:700}
.bcfail button{font:inherit;font-size:12px;border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:4px 11px;cursor:pointer;min-height:30px}.bcfail button.x{border-color:transparent;color:#6d6656;font-weight:400}
:where([data-theme=dark]) .bcfail{color:#ff8a7a}:where([data-theme=dark]) .bcfail button.x{color:#b9b0a2}
/* ⌨️ (v269) الكيبورد على الجوال: النافذة تأخذ المساحة الظاهرة فقط، فالرأس وآخر الرسائل يبقيان أمامك */
html.bc-kb #bcm{top:var(--bcvt,0px);bottom:auto;height:var(--bcvh,100dvh)}html.bc-kb #bcm .bcp{height:var(--bcvh,100dvh);padding-bottom:0}
html.bc-kb .bcw:not(.one).open>.bcv{top:var(--bcvt,0px);bottom:auto;height:var(--bcvh,100dvh);padding-bottom:0}html.bc-kb .bcq{display:none}
.bcseen{align-self:flex-start;display:flex;align-items:center;gap:4px;font-size:11.5px;color:#6d6656;margin:3px 4px 0;animation:ui-fade .3s ease both}
.bcseen .tk{width:16px;height:11px;color:#8d8778}.bcseen .tk.rd{color:#2a9df4}
@keyframes bc-in{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
/* الرسالة الصوتية: موجة بتتملي وهي شغّالة */
.bcvo{display:flex;align-items:center;gap:10px;min-width:210px;direction:ltr;flex:1 1 auto;padding:2px 0}
.bcvo button{width:40px;height:40px;border-radius:50%;border:0;background:#8a5a83;color:#fff;font-size:15px;cursor:pointer;flex:none;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.bcg.ot .bcvo button{background:#2a1d2c}
.bcvo span.bar{flex:1;height:26px;position:relative;background:rgba(0,0,0,.2);
 -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat;
 mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat}
.bcvo span.bar b{position:absolute;inset:0 auto 0 0;display:block;width:0;background:#8a5a83;transition:width .2s linear}
.bcg.ot .bcvo span.bar b{background:#2a1d2c}
.bcvo span.du{font-size:12px;font-weight:700;opacity:.7;min-width:30px}
.bcgone{font-size:13px;opacity:.75;font-style:italic;flex:1 1 auto}
.bcmore{align-self:center;font:inherit;font-size:13px;font-weight:700;border:0;background:rgba(255,253,248,.95);color:#5b5446;border-radius:999px;padding:6px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);margin:4px 0}
/* زرار النزول لآخر رسالة */
.bcdown{position:absolute;inset-inline-start:16px;bottom:96px;z-index:4;width:42px;height:42px;border-radius:50%;border:0;background:var(--card);color:var(--ink);box-shadow:0 3px 12px rgba(0,0,0,.2);cursor:pointer;display:grid;place-items:center;animation:ui-fade .2s ease both}
.bcdown svg{width:20px;height:20px}
.bcrq{display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;background:var(--card);border-top:1px solid var(--line);font-size:13.5px;font-weight:700;flex:none;color:var(--ink)}
.bcrq span{flex:1;border-inline-start:3px solid #8a5a83;padding-inline-start:9px;color:#7a4c73}
.bcrq button{font:inherit;border:0;background:var(--soft,#f2e9dd);color:inherit;border-radius:50%;width:28px;height:28px;cursor:pointer}
/* الردود السريعة + خانة الكتابة */
.bcq{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 0;scrollbar-width:none;flex:none;background:#efe8db}.bcq::-webkit-scrollbar{display:none}
.bcq button{font:inherit;font-size:13px;font-weight:600;white-space:nowrap;border-radius:999px;border:1px solid rgba(138,90,131,.35);background:rgba(255,253,248,.95);color:#4e2f4a;padding:5px 13px;cursor:pointer;flex:none;transition:transform .12s,background .12s}
.bcq button:hover{background:#fff6dc}.bcq button:active{transform:scale(.96)}
.bcf{display:flex;gap:8px;align-items:flex-end;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcf textarea{flex:1;resize:none;font:inherit;font-size:16px;line-height:1.45;max-height:130px;min-height:48px;border-radius:24px;border:0;background:var(--card);color:var(--ink);padding:12px 18px;box-shadow:0 1px 2px rgba(0,0,0,.12);field-sizing:content;overflow-y:auto;contain:layout style}
.bcf textarea:focus{outline:0;box-shadow:0 0 0 2px rgba(180,138,171,.6),0 1px 2px rgba(0,0,0,.12)}
.bcf button{border:0;border-radius:50%;width:48px;height:48px;padding:0;background:linear-gradient(135deg,#b48aab,#8a5a83);color:#fff;cursor:pointer;flex:none;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .15s}
.bcf button:active{transform:scale(.92)}.bcf button svg{width:22px;height:22px}
.bcf button:disabled{opacity:.5}
.bcf.has #bcmic{display:none}.bcf:not(.has) #bcsend{display:none}
#bcsend svg{animation:bc-pop .18s ease both}html[dir="rtl"] #bcsend svg{transform:scaleX(-1)}
@keyframes bc-pop{from{transform:scale(.5)}}
html[dir="rtl"] #bcsend svg{animation:none}
/* التسجيل */
.bcr2{display:flex;align-items:center;gap:10px;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcr2 .pill{flex:1;display:flex;align-items:center;gap:10px;background:var(--card);border-radius:24px;height:48px;padding:0 16px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.bcr2 .dot{width:11px;height:11px;border-radius:50%;background:#e03b2f;animation:bc-pulse 1s ease-in-out infinite;flex:none}
.bcr2 .tm{flex:1;font-weight:800;font-size:16px;direction:ltr;text-align:right}.bcr2 .tm small{font-weight:400;color:var(--mut);font-size:12.5px}
.bcr2 button{font:inherit;font-weight:800;border:0;border-radius:50%;width:48px;height:48px;cursor:pointer;flex:none;display:grid;place-items:center;font-size:18px}
.bcr2 .x{background:var(--card);color:#c4362b;box-shadow:0 1px 2px rgba(0,0,0,.12)}.bcr2 .ok{background:linear-gradient(135deg,#b48aab,#8a5a83);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.bcr2 .ok svg{width:22px;height:22px}html[dir="rtl"] .bcr2 .ok svg{transform:scaleX(-1)}
@keyframes bc-pulse{50%{opacity:.25;transform:scale(.8)}}
/* القايمة + المحادثة */
.bcw{display:grid;grid-template-columns:340px 1fr;height:calc(100dvh - 112px);min-height:460px;background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.06)}
.bcl{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0;background:var(--card)}
.bclh{display:flex;align-items:center;gap:10px;padding:14px 16px 4px;flex:none}
.bclh>div{flex:1;min-width:0}.bclh b{display:block;font-size:22px;font-weight:800}.bclh small{display:block;color:var(--mut);font-size:12.5px;margin-top:2px}
.bcs{padding:10px 14px 8px;flex:none}
.bcs input{width:100%;font:inherit;font-size:15px;border-radius:999px;border:0;background:var(--field,#f2e9dd);color:var(--ink);padding:10px 16px}
.bcs input:focus{outline:0;box-shadow:0 0 0 2px rgba(180,138,171,.55)}
.bcfl{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}/* كل الأقسام ظاهرة (كانت سطر بيتسحب ومابيتسحبش على الكمبيوتر) */
.bcfl button{font:inherit;font-size:12.5px;font-weight:700;white-space:nowrap;border-radius:999px;border:0;background:var(--field,#f2e9dd);color:var(--mut);padding:5px 10px;cursor:pointer;transition:background .15s,color .15s}
.bcfl button.on{background:#2a1d2c;color:#e3c8dd}
.bcli{overflow-y:auto;flex:1;padding:2px 6px 8px}
.bcr{display:flex;gap:12px;align-items:center;width:100%;padding:9px 10px;border:0;border-radius:14px;background:none;text-align:start;font:inherit;color:var(--ink);cursor:pointer;transition:background .15s}
.bcr:hover{background:var(--soft,#f6eee3)}.bcr.on{background:#f4e9f0}
.bcr .av{width:50px;height:50px}
.avw{position:relative;flex:none;display:inline-flex}.bcon{position:absolute;bottom:1px;right:1px;width:14px;height:14px;border-radius:50%;background:#25d366;border:2.5px solid var(--card,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.06)}
.bcpr{color:#1f9d55;font-weight:700}
.bcr .nm{flex:1;min-width:0}.bcr .nm b{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden}
.bcr .nm b bdi{overflow:hidden;text-overflow:ellipsis}
.bcr .nm b u{text-decoration:none;font-weight:600;font-size:11px;color:#7a4c73;background:#f4e9f0;border-radius:6px;padding:0 6px;flex:none}
.bcr .nm small{display:flex;align-items:center;gap:3px;color:var(--mut);font-size:13.5px;white-space:nowrap;overflow:hidden;margin-top:2px}
.bcr .nm small span{overflow:hidden;text-overflow:ellipsis}
.bcr .nm small .tk{width:16px;height:11px;flex:none;color:#8d8778}.bcr .nm small .tk.rd{color:#2a9df4}
.bcr.nw .nm small{color:var(--ink);font-weight:700}
.bcr .mt{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none;align-self:stretch;justify-content:center}.bcr .mt small{color:var(--mut);font-size:11.5px}
.bcr.nw .mt small{color:#8a5a83;font-weight:800}
.bcr .mt i,.bcbd{font-style:normal;background:#8a5a83;color:#fff;border-radius:999px;min-width:21px;padding:0 6px;font-size:12px;line-height:21px;text-align:center;font-weight:800}
.bcnone{margin:auto;text-align:center;color:var(--mut);font-size:15px;line-height:2;padding:30px}
.bcnone b{display:grid;place-items:center;width:84px;height:84px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,#f4e9f0,#e3c8dd);font-size:38px}
.bcw>.bcv.empty .bch,.bcw>.bcv.empty .bcq,.bcw>.bcv.empty .bcf,.bcw>.bcv.empty .bcr2,.bcw>.bcv.empty .bcrq,.bcw>.bcv.empty .bcdown{display:none}
.bcw>.bcv.empty .bcms{background:var(--soft,#f6eee3)}
.bcback{display:none!important}
html[dir="ltr"] .bcback{transform:scaleX(-1)}
@media (max-width:760px){
 .bcw:not(.one){grid-template-columns:1fr;height:auto;min-height:0}.bcw:not(.one) .bcl{border:0}.bcw:not(.one) .bcli{overflow:visible}
 .bcw:not(.one)>.bcv{display:none}.bcw:not(.one).open>.bcv{display:flex;position:fixed;inset:0;z-index:60;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}
 .bcw .bcback{display:grid!important}
 .bcg{max-width:86%}
}
/* صفحة الفرع والسائق: نافذة فيها القايمة أو المحادثة (عمود واحد) */
.bcw.one{grid-template-columns:1fr;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none}
.bcw.one .bcl{border:0}.bcw.one>.bcv{display:none}.bcw.one.open>.bcv{display:flex}.bcw.one.open>.bcl{display:none}
.bcw.one .bcback{display:grid!important}
#bcfab{position:fixed;left:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#2d2131,#2a1d2c);color:#e3c8dd;border:2px solid #b48aab;box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;animation:ui-fade .3s ease both}
#bcfab svg{width:28px;height:28px}
#bcfab i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:22px;padding:0 6px;font-size:12.5px;line-height:22px;font-weight:800;border:2px solid #fff}
#bcfab.nw{animation:bc-ring 1.6s ease-in-out infinite}
@keyframes bc-ring{0%,100%{transform:rotate(0)}10%{transform:rotate(-12deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
#me #bcme{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:#2a1d2c;color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-start:auto}
#me #bcme i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#bcm{display:none;position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.55);padding:14px}/* (v178) بلا blur: كان يُعاد حسابه مع كل حرف يُكتب = تقل على الجوال */
#bcm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
#bcm .bcp{width:100%;max-width:580px;height:min(760px,calc(100dvh - 28px));border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.4);background:var(--card)}
@media (max-width:600px){#bcm{padding:0}#bcm .bcp{height:100dvh;max-width:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px)}}
.bcrqb{font:inherit;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}

 :where([data-theme=dark]) .bcms{background-color:#0f0d0a;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23d4ae5c' stroke-opacity='.06' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3C/g%3E%3C/svg%3E")}
 :where([data-theme=dark]) .bcq,:where([data-theme=dark]) .bcf,:where([data-theme=dark]) .bcr2,:where([data-theme=dark]) .bcrb{background:#0f0d0a}
 :where([data-theme=dark]) .bcrp{background:rgba(255,255,255,.08)}:where([data-theme=dark]) .bcrp b,:where([data-theme=dark]) .bcrb b{color:#e3c8dd}:where([data-theme=dark]) .bcg.ot .bcrp b{color:#5fd3c2}
 :where([data-theme=dark]) .bcrb button,:where([data-theme=dark]) .bcsw{background:rgba(255,255,255,.12);color:#ece6d8}:where([data-theme=dark]) .bcmb{color:rgba(255,255,255,.6)}
 :where([data-theme=dark]) #bcam{background:#24221e;color:#ece6d8;box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 0 .5px rgba(255,255,255,.08)}:where([data-theme=dark]) #bcam button:hover{background:#2d2a25}:where([data-theme=dark]) #bcam .rd{color:#ff6b5e}
 :where([data-theme=dark]) #bcamv{background:rgba(0,0,0,.35)}
 :where([data-theme=dark]) .bcg.me{background:#4e2f4a;color:#f5eaf2}:where([data-theme=dark]) .bcg.me:not(.cont)::before{background:#4e2f4a}
 :where([data-theme=dark]) .bcg.ot{background:#24221e;color:#ece6d8}:where([data-theme=dark]) .bcg.ot:not(.cont)::before{background:#24221e}
 :where([data-theme=dark]) .bcg small{color:rgba(255,255,255,.5)}:where([data-theme=dark]) .bcg .tk{color:rgba(255,255,255,.5)}:where([data-theme=dark]) .bcg .tk.rd{color:#53bdeb}
 :where([data-theme=dark]) .bcg.ot>i{color:#e3c8dd}:where([data-theme=dark]) .bcg .rqt{background:rgba(255,255,255,.08)}
 :where([data-theme=dark]) .bcday,:where([data-theme=dark]) .bcmore{background:rgba(36,34,30,.95);color:#d8cfbd}:where([data-theme=dark]) .bcmt{background:rgba(36,34,30,.9)}
 :where([data-theme=dark]) .bcq button{background:#24221e;color:#e3c8dd;border-color:rgba(180,138,171,.3)}
 :where([data-theme=dark]) .bcvo span.bar{background:rgba(255,255,255,.25)}:where([data-theme=dark]) .bcvo span.bar b,:where([data-theme=dark]) .bcvo button{background:#b48aab}:where([data-theme=dark]) .bcg.ot .bcvo button,:where([data-theme=dark]) .bcg.ot .bcvo span.bar b{background:#ece6d8;color:#2a1d2c}
 :where([data-theme=dark]) .bcr.on{background:#2d2131}:where([data-theme=dark]) .bcr .nm b u{background:#2d2131;color:#e3c8dd}:where([data-theme=dark]) .bcrq span{color:#e3c8dd}
 :where([data-theme=dark]) .bcfl button.on{background:#b48aab;color:#2a1d2c}:where([data-theme=dark]) .bcnone b{background:linear-gradient(135deg,#3d2b40,#4e2f4a)}

.tabs .tbn{background:#c0392b;color:#fff;border-radius:999px;padding:0 7px;font-size:12px;line-height:19px;display:inline-block;margin-inline-start:4px;font-weight:800}
@media print{#bcfab,#bcm,#bcme,.bcrqb{display:none!important}}
@media (prefers-reduced-motion:reduce){.bcg,.bcg.in,.bcg.bchl,#bcfab.nw,#bcam,.bcrb{animation:none}.bcg{transition:none}}
html.lite .bcg.in,html.lite #bcam{animation:none}
`;
