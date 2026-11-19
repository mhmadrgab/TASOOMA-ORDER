// 🔔 (v179، 19 نوفمبر 2026، طلب محمد: «سجل الإشعارات») جرس فيه كل الإشعارات اللي وصلت على الجهاز ده: حالة طلب، رسالة، هدية، صيانة...
// لو حد ضيّع إشعار على الموبايل يلاقيه هنا. السجل على الجهاز نفسه (مش في القاعدة: بلا أي قراءة أو كتابة زيادة):
//   • إشعارات السيرفر والمنصة مقفولة: sw.js بيحفظها في IndexedDB (tz-notes) ← الصفحة بتنقلها هنا أول ما تفتح.
//   • الإشعارات والمنصة مفتوحة: notify.js و fb.js (onMessage) بينادوا window.__tzNote.
//   • السجل لكل حساب: localStorage.tz_notes_{الحساب} (150 إشعار بالكثير)، والمكرر (نفس العنوان والنص خلال 3 دقائق) يُحفظ مرة.
// الرابط: صفحات المنصة فقط (index/admin/driver.html بـ ?...)، وأي رابط تاني بيتجاهل.
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const g=id=>document.getElementById(id);
const MAX=150,DUP=3*6e4;
let X=null,L=[],KEY="",OPEN=false,MT=0;
const LINK=/^(\.\/)?(index|admin|driver)\.html(\?[A-Za-z0-9_=&%@.,:+-]*)?$/;
const okLink=l=>{l=String(l||"").trim();if(!l)return "";try{const u=new URL(l,location.href);if(u.origin!==location.origin)return "";const p=u.pathname.split("/").pop();return LINK.test(p+u.search)?p+u.search:""}catch(e){return ""}};
function load(){try{const a=JSON.parse(localStorage.getItem(KEY)||"[]");L=Array.isArray(a)?a.filter(x=>x&&typeof x.t==="string").slice(0,MAX):[]}catch(e){L=[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(L.slice(0,MAX)))}catch(e){}}
function add(n){
  const t=String(n.t||"").slice(0,140).trim(),b=String(n.b||"").slice(0,400).trim(),at=+n.at||Date.now();if(!t&&!b)return false;
  if(L.some(x=>x.t===t&&x.b===b&&Math.abs(x.at-at)<DUP))return false;
  L.unshift({t,b,l:okLink(n.l),at,rd:0});L.sort((a,c)=>c.at-a.at);if(L.length>MAX)L.length=MAX;return true;
}
export function noteAdd(t,b,l){if(!X)return;if(add({t,b,l}))save(),paint()}
// اللي حفظه sw.js وقت ما المنصة كانت مقفولة
function fromSw(){
  return new Promise(done=>{let fin=false;const end=()=>{if(!fin){fin=true;done()}};setTimeout(end,1500);
    try{const r=indexedDB.open("tz-notes",1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("n"))d.createObjectStore("n",{keyPath:"id",autoIncrement:true})};
      r.onerror=end;r.onsuccess=()=>{const d=r.result;try{const tx=d.transaction("n","readwrite"),s=tx.objectStore("n"),q=s.getAll();
        q.onsuccess=()=>{let ch=false;(q.result||[]).forEach(x=>{if(x&&add({t:x.t,b:x.b,l:x.l,at:x.at}))ch=true});s.clear();if(ch){save();paint()}};tx.oncomplete=()=>{d.close();end()};tx.onerror=()=>{d.close();end()}}catch(e){d.close();end()}}}
    catch(e){end()}});
}
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);if(m<1)return "الآن";if(m<60)return `منذ ${m} د`;if(m<1440)return `منذ ${Math.round(m/60)} س`;const d=new Date(t);return d.toLocaleDateString("ar-EG-u-nu-latn",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
const BELL=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
const CSS=`.tznb{position:relative;font:inherit;border:0;background:transparent;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;display:inline-grid;place-items:center;flex:none}
.tznb:hover{background:rgba(127,127,127,.14)}.tznb i{position:absolute;top:3px;inset-inline-end:2px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;font-size:11px;line-height:17px;min-width:17px;padding:0 4px;font-weight:800;border:2px solid var(--card,#fff)}
#tznc{position:fixed;z-index:89;inset:0;display:none}#tznc.on{display:block}
#tznc .ncv{position:absolute;inset:0;background:rgba(20,14,22,.25)}
#tznc .ncp{position:absolute;top:64px;inset-inline-end:16px;width:min(400px,calc(100vw - 24px));max-height:min(620px,calc(100dvh - 90px));display:flex;flex-direction:column;background:var(--card,#fffaf3);color:var(--ink,#2a1d2c);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3),0 0 0 .5px rgba(0,0,0,.08);overflow:hidden;transform-origin:top var(--o,right);animation:nc-in .22s cubic-bezier(.2,.9,.25,1.1) both}
@keyframes nc-in{from{opacity:0;transform:scale(.94) translateY(-6px)}}
#tznc .nch{display:flex;align-items:center;gap:8px;padding:14px 16px 10px;border-bottom:1px solid var(--line,#e3d5c3)}#tznc .nch b{flex:1;font-size:17px}
#tznc .nch button{font:inherit;font-size:12.5px;font-weight:700;border:0;background:var(--soft,#f6eee3);color:var(--ink);border-radius:999px;padding:6px 11px;cursor:pointer}
#tznc .ncl{overflow-y:auto;flex:1;padding:4px 6px 8px}
#tznc .ncd{font-size:12px;font-weight:800;color:var(--mut);padding:10px 10px 4px}
#tznc .nci{display:flex;gap:10px;width:100%;font:inherit;text-align:start;border:0;background:none;color:inherit;border-radius:12px;padding:10px;cursor:pointer;position:relative}
#tznc .nci:hover,#tznc .nci:focus-visible{background:var(--soft,#f6eee3);outline:0}
#tznc .nci.nw{background:color-mix(in srgb,#8a5a83 9%,transparent)}#tznc .nci.nw::before{content:"";position:absolute;top:16px;inset-inline-start:2px;width:7px;height:7px;border-radius:50%;background:#8a5a83}
#tznc .nci div{flex:1;min-width:0;padding-inline-start:6px}#tznc .nci b{display:block;font-size:14px;line-height:1.45}
#tznc .nci span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;color:var(--mut);line-height:1.5}
#tznc .nci small{flex:none;font-size:11.5px;color:var(--mut);white-space:nowrap}
#tznc .nce{padding:40px 20px;text-align:center;color:var(--mut);line-height:1.9}#tznc .nce b{display:block;font-size:36px}
#tznc .ncf{padding:8px 14px 10px;border-top:1px solid var(--line,#e3d5c3);font-size:12px;color:var(--mut);text-align:center}
@media (max-width:600px){#tznc .ncp{top:auto;bottom:0;inset-inline:0;width:auto;max-height:82dvh;border-radius:20px 20px 0 0;transform-origin:bottom;animation-name:nc-up}}
@keyframes nc-up{from{transform:translateY(30px);opacity:0}}
@media (prefers-reduced-motion:reduce){#tznc .ncp{animation:none}}
:where([data-theme=dark]) #tznc .ncp{background:#24221e;color:#ece6d8}:where([data-theme=dark]) #tznc .nci:hover{background:#2d2a25}`;
function paintBtn(){const b=g("tznb");if(!b)return;const n=L.filter(x=>!x.rd).length,h=BELL+(n?`<i>${n>99?"99+":n}</i>`:"");if(b.dataset.h!==h){b.innerHTML=h;b.dataset.h=h}b.title=n?`${n} إشعار جديد`:"الإشعارات";b.setAttribute("aria-label",b.title)}
function paint(){paintBtn();if(OPEN)paintPanel()}
function paintPanel(){
  const p=g("tznc");if(!p)return;const l=p.querySelector(".ncl");if(!l)return;
  if(!L.length){l.innerHTML=`<div class="nce"><b>🔔</b>لا توجد إشعارات بعد.<br>كل إشعار يصل على هذا الجهاز يُحفظ هنا.</div>`;return}
  let d="",h="";const today=new Date().toDateString(),yd=new Date(Date.now()-864e5).toDateString();
  L.forEach((x,i)=>{const dd=new Date(x.at).toDateString(),lb=dd===today?"اليوم":dd===yd?"أمس":new Date(x.at).toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});
    if(lb!==d){d=lb;h+=`<div class="ncd">${E(lb)}</div>`}
    h+=`<button class="nci${x.rd?"":" nw"}" type="button" data-nci="${i}"><div><b data-notr>${E(x.t)}</b>${x.b?`<span data-notr>${E(x.b)}</span>`:""}</div><small>${E(ago(x.at))}</small></button>`});
  l.innerHTML=h;
}
function openPanel(){
  let p=g("tznc");if(!p){p=document.createElement("div");p.id="tznc";p.setAttribute("role","dialog");p.setAttribute("aria-label","الإشعارات");
    p.innerHTML=`<div class="ncv"></div><div class="ncp"><div class="nch"><b>🔔 الإشعارات</b><button type="button" data-ncr>تعليم الكل كمقروء</button><button type="button" data-ncc>مسح</button></div><div class="ncl"></div><div class="ncf">الإشعارات المحفوظة على هذا الجهاز فقط (آخر ${MAX})</div></div>`;
    document.body.appendChild(p);
    p.addEventListener("click",e=>{const t=e.target;if(t.classList.contains("ncv"))return closePanel();
      if(t.closest("[data-ncr]")){L.forEach(x=>x.rd=1);save();paint();return}
      if(t.closest("[data-ncc]")){if(!L.length||!confirm("مسح كل الإشعارات المحفوظة على هذا الجهاز؟"))return;L=[];save();paint();return}
      const it=t.closest("[data-nci]");if(!it)return;const x=L[+it.dataset.nci];if(!x)return;x.rd=1;save();paint();
      if(x.l){closePanel();const u=new URL(x.l,location.href);if(u.pathname===location.pathname&&!u.search)return;location.href=x.l}});
    addEventListener("keydown",e=>{if(e.key==="Escape"&&OPEN)closePanel()})}
  OPEN=true;p.className="on";paintPanel();
}
function closePanel(){const p=g("tznc");if(p)p.className="";OPEN=false}
function mount(){
  if(!X||g("tznb"))return true;const a=X.anchor&&X.anchor();if(!a||!a.parentNode)return false;
  const b=document.createElement("button");b.id="tznb";b.className="tznb";b.type="button";b.setAttribute("data-noico","");b.onclick=()=>OPEN?closePanel():openPanel();
  a.parentNode.insertBefore(b,a);paintBtn();return true;
}
// ctx = {acct: الحساب (الطرف)، anchor: ()=>العنصر اللي الجرس يتحط قبله}
export function initNotes(ctx){
  stopNotes();if(!ctx||!ctx.acct)return;X=ctx;KEY="tz_notes_"+String(ctx.acct).toLowerCase().replace(/[^a-z0-9@._-]/g,"_").slice(0,80);
  if(!g("tzn-css")){const s=document.createElement("style");s.id="tzn-css";s.textContent=CSS;document.head.appendChild(s)}
  load();window.__tzNote=(t,b,l)=>noteAdd(t,b,l);
  if(!mount())MT=setInterval(()=>{if(mount())clearInterval(MT)},1200);
  fromSw();
  // إشعار وصل وهي مفتوحة في الخلفية (sw.js بيحفظ) ← لما ترجع قدامه نجيبه
  document.addEventListener("visibilitychange",onVis);
}
function onVis(){if(!document.hidden&&X)fromSw()}
export function stopNotes(){clearInterval(MT);document.removeEventListener("visibilitychange",onVis);closePanel();const b=g("tznb");if(b)b.remove();X=null;L=[];window.__tzNote=null}
export const notesState=()=>({n:L.length,unread:L.filter(x=>!x.rd).length,key:KEY});
