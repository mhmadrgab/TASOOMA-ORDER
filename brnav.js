// 🧭 القائمة الجانبية لصفحة الفرع (v214، 22 نوفمبر 2026، محمد: «عايز نظام المنصة للفروع يكون بقائمة جانبية زي اللوحة بتاعتنا»)
// الصفحة نفسها لم تتغيّر: القائمة تعرض قسماً واحداً في كل مرة (html[data-bsec]) وتخفي الباقي بالـ CSS،
// والأقسام اللي هي نوافذ (الهدايا، الصيانة، المحادثات، الإعدادات) تفتح نوافذها كما كانت.
// الحاسوب: القائمة ثابتة على جنب الصفحة. الجوال والتابلت (≤1024px): درج يُفتح بزر ☰ ويُقفل بنفس الزر أو Esc أو الضغط خارجه أو اختيار قسم.
const g=id=>document.getElementById(id);
const ICO={
 new:'<path d="M12 5v14M5 12h14"/>',
 my:'<path d="M9 5h10M9 12h10M9 19h10"/><path d="M4.5 5h.01M4.5 12h.01M4.5 19h.01"/>',
 hist:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
 gift:'<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8c-2-3.5-6-3.5-6-1s4 1 6 1c2 0 6 1.5 6-1s-4-2.5-6 1z"/>',
 mnt:'<path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17l3 3 5.3-5.2a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.4-.6-.6-2.4z"/>',
 cus:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 15h2"/>',
 chat:'<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
 set:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
const CSS=`
#bnv,#bnv-veil,#bnv-btn{display:none}
.lock #bnv{display:flex}
#bnv{position:fixed;top:0;bottom:0;inset-inline-start:0;z-index:60;width:236px;flex-direction:column;background:#2a1d2c;color:#e9dfe8;padding:16px 10px 12px;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain}
#bnv .bnv-h{display:flex;align-items:center;gap:10px;padding:2px 8px 14px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:10px}
#bnv .bnv-h b{display:block;font-size:15px;color:#fff;line-height:1.3}#bnv .bnv-h small{display:block;font-size:12px;color:#b9a6b6}
#bnv .bnv-lg{width:34px;height:34px;border-radius:10px;background:#8a5a83;display:grid;place-items:center;color:#fff;font-weight:800;flex:none}
#bnv .bnv-g{font-size:11.5px;color:#a8939f;letter-spacing:0;padding:12px 10px 4px}
#bnv button.bnv-i{position:relative;display:flex;align-items:center;gap:11px;width:100%;min-height:42px;padding:0 12px;border:0;border-radius:12px;background:none;color:#e9dfe8;font:inherit;font-size:14.5px;font-weight:600;text-align:start;cursor:pointer}
#bnv button.bnv-i:hover{background:rgba(255,255,255,.07)}
#bnv button.bnv-i.on{background:#8a5a83;color:#fff}
#bnv button.bnv-i:focus-visible{outline:2px solid #c9a3c2;outline-offset:2px}
#bnv .bnv-i span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bnv .bnv-n{min-width:20px;padding:0 6px;border-radius:999px;background:#c0392b;color:#fff;font-size:12px;font-weight:700;line-height:20px;text-align:center;font-style:normal}
#bnv .bnv-sp{flex:1}
#bnv .bnv-x{display:none;margin-inline-start:auto;width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;place-items:center;flex:none}
#bnv .bnv-f{border-top:1px solid rgba(255,255,255,.1);padding-top:8px;margin-top:8px}
@media (min-width:1025px){.lock .w{max-width:900px}html.bnv .lock{padding-inline-start:236px}}
@media (max-width:1024px){
 .lock #bnv-btn{display:inline-grid;place-items:center;width:40px;height:40px;border:0;border-radius:12px;background:#2a1d2c;color:#fff;cursor:pointer;flex:none;order:-1}
 #bnv .bnv-x{display:grid}
 #bnv{transform:translateX(105%);transition:transform .22s cubic-bezier(.16,1,.3,1);box-shadow:none;width:min(280px,84vw)}
 html[dir="ltr"] #bnv{transform:translateX(-105%)}
 html.bnv-open #bnv{transform:none;box-shadow:0 0 40px rgba(0,0,0,.35)}
 html.bnv-open #bnv-veil{display:block;position:fixed;inset:0;z-index:59;background:rgba(20,12,20,.45)}
}
html.lite #bnv{transition:none}
@media (prefers-reduced-motion:reduce){#bnv{transition:none}}
/* الأقسام: قسم واحد ظاهر في المرة */
html[data-bsec="new"] .lock #my,html[data-bsec="new"] .lock #xf,html[data-bsec="new"] .lock #hist{display:none!important}
html[data-bsec="my"] .lock .sheet,html[data-bsec="my"] .lock .act,html[data-bsec="my"] .lock .tip,html[data-bsec="my"] .lock #hist,html[data-bsec="my"] .lock #stkn,html[data-bsec="my"] .lock #catn{display:none!important}
html[data-bsec="hist"] .lock .sheet,html[data-bsec="hist"] .lock .act,html[data-bsec="hist"] .lock .tip,html[data-bsec="hist"] .lock #my,html[data-bsec="hist"] .lock #xf,html[data-bsec="hist"] .lock #stkn,html[data-bsec="hist"] .lock #catn,html[data-bsec="hist"] .lock #hello{display:none!important}
html.bnv .lock #gfbtn,html.bnv .lock #mtbtn{display:none!important}
html.bnv[data-bsec="hist"] .lock #hist{display:block!important}
@media print{#bnv,#bnv-btn,#bnv-veil{display:none!important}html.bnv .lock{padding:0!important}}
`;
let X=null,SEC="new",OBS=null,TMR=0;
const H=document.documentElement;
const SECS=[["new","طلب جديد","new"],["my","طلباتي ومتابعتها","my"],["hist","سجل الأوراق","hist"]];
function cnt(id,sel){const b=g(id);if(!b)return 0;let n=0;b.querySelectorAll(sel).forEach(s=>{const m=/\d+/.exec(String(s.textContent||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)));if(m)n+=+m[0]});return n}
function items(){
 const L=[["الطلبات"]].concat(SECS.map(s=>({k:s[0],t:s[1],ic:s[2],n:s[0]==="my"?(X.myCount?X.myCount():0):0})));
 const fr=[];
 if(g("gfbtn"))fr.push({a:"gfbtn",t:"الهدايا والعينات",ic:"gift",n:cnt("gfbtn",".bd span")});
 if(g("mtbtn"))fr.push({a:"mtbtn",t:"طلبات الصيانة",ic:"mnt",n:cnt("mtbtn",".m-bd span")});
 (X.extra?X.extra():[]).forEach(e=>fr.push(e));
 if(fr.length)L.push(["الفرع"]),fr.forEach(x=>L.push(x));
 if(g("bcme")){L.push(["التواصل"]);L.push({a:"bcme",t:"المحادثات",ic:"chat",n:X.chatCount?X.chatCount():0})}
 return L;
}
function html(){
 const who=X.who?X.who():"";
 return `<div class="bnv-h"><span class="bnv-lg" aria-hidden="true">T</span><div><b data-notr><bdi dir="ltr">${String(who).replace(/[&<>"']/g,"")}</bdi></b><small>منصة تاسومة</small></div><button type="button" class="bnv-x" data-bact="__x" aria-label="إغلاق القائمة" data-noico><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`+
  items().map(x=>Array.isArray(x)?`<div class="bnv-g">${x[0]}</div>`:
   `<button type="button" class="bnv-i${x.k&&x.k===SEC?" on":""}" ${x.k?`data-bsec="${x.k}"${x.k===SEC?' aria-current="page"':""}`:`data-bact="${x.a}"`}>${svg(x.ic)}<span>${x.t}</span>${x.n?`<i class="bnv-n" data-notr>${x.n>99?"99+":x.n}</i>`:""}</button>`).join("")+
  `<div class="bnv-sp"></div><div class="bnv-f"><button type="button" class="bnv-i" data-bact="mx">${svg("set")}<span>الإعدادات</span></button></div>`;
}
let LAST="";
function paint(){const a=g("bnv");if(!a||!X)return;const h=html();if(h===LAST)return;LAST=h;const st=a.scrollTop;a.innerHTML=h;a.scrollTop=st}
export function brNavSec(k,keep){
 if(!SECS.some(s=>s[0]===k))return;SEC=k;H.setAttribute("data-bsec",k);try{sessionStorage.setItem("tz_bsec",k)}catch(e){}
 paint();if(!keep)window.scrollTo(0,0);
}
function open(on){on=!!on&&innerWidth<=1024;H.classList.toggle("bnv-open",on);const b=g("bnv-btn");if(b)b.setAttribute("aria-expanded",String(on));if(on){const f=document.querySelector("#bnv .bnv-i.on")||document.querySelector("#bnv .bnv-i");if(f)setTimeout(()=>{try{f.focus({preventScroll:true})}catch(e){}},60)}}
function onClick(e){
 const t=e.target.closest&&e.target.closest("#bnv [data-bsec],#bnv [data-bact],#bnv-btn,#bnv-veil");if(!t)return;
 if(t.id==="bnv-btn"){open(!H.classList.contains("bnv-open"));return}// ☰ يفتح ويقفل
 if(t.id==="bnv-veil"){open(false);return}
 if(t.dataset.bsec){open(false);brNavSec(t.dataset.bsec);return}
 if(t.dataset.bact==="__x"){open(false);const b=g("bnv-btn");if(b)b.focus();return}
 if(t.dataset.bact){open(false);const b=g(t.dataset.bact);if(b)b.click();else if(X.act)X.act(t.dataset.bact)}
}
function onKey(e){if(e.key==="Escape"&&H.classList.contains("bnv-open")){open(false);const b=g("bnv-btn");if(b)b.focus()}}
function onResize(){if(innerWidth>1024&&H.classList.contains("bnv-open"))open(false)}
// ctx: {who:()=>اسم الفرع, myCount:()=>عدد, chatCount:()=>عدد, extra:()=>[{a|k,t,ic,n}], act:(id)=>void}
export function initBrNav(ctx){
 stopBrNav();X=ctx||{};
 if(!g("bnv-css")){const s=document.createElement("style");s.id="bnv-css";s.textContent=CSS;document.head.appendChild(s)}
 const a=document.createElement("aside");a.id="bnv";a.setAttribute("aria-label","القائمة");document.body.appendChild(a);
 const v=document.createElement("div");v.id="bnv-veil";document.body.appendChild(v);
 const me=g("me");if(me&&!g("bnv-btn")){const b=document.createElement("button");b.id="bnv-btn";b.type="button";b.setAttribute("aria-label","القائمة");b.setAttribute("aria-controls","bnv");b.setAttribute("aria-expanded","false");b.dataset.noico="";b.innerHTML=svg("menu");me.insertBefore(b,me.firstChild)}
 H.classList.add("bnv");
 let s="new";try{s=sessionStorage.getItem("tz_bsec")||"new"}catch(e){}
 if(!SECS.some(x=>x[0]===s))s="new";SEC=s;H.setAttribute("data-bsec",s);
 document.addEventListener("click",onClick);document.addEventListener("keydown",onKey);addEventListener("resize",onResize);
 LAST="";paint();
 // العدّادات والكروت اللي بتظهر متأخرة (الهدايا والصيانة والمحادثات): نحدّث القائمة لما تتغيّر
 OBS=new MutationObserver(()=>{clearTimeout(TMR);TMR=setTimeout(paint,120)});
 const w=document.querySelector(".w");if(w)OBS.observe(w,{subtree:true,childList:true,characterData:true});
}
export function stopBrNav(){
 if(OBS){OBS.disconnect();OBS=null}clearTimeout(TMR);
 document.removeEventListener("click",onClick);document.removeEventListener("keydown",onKey);removeEventListener("resize",onResize);
 ["bnv","bnv-veil","bnv-btn"].forEach(id=>{const e=g(id);if(e)e.remove()});H.classList.remove("bnv","bnv-open");H.removeAttribute("data-bsec");X=null;LAST="";
}
export const brNavRefresh=()=>paint();
