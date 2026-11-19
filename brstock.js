// 📦 (v179، 19 نوفمبر 2026، طلب محمد: «الفرع يشوف المتوفر في المستودع وهو بيكتب الطلب + طلب مقترح من مبيعاته»)
// المصدر: تحليل المخزون (stock.js) بينشر بعد كل ملف كميات في stkpub:
//   stkpub/meta = {v, at, to (تاريخ التقرير), parts}، stkpub/a0..a9 = {v, c:{كود:{"لون|مقاس": 0/1/2}}} (مستويات بلا أرقام)،
//   stkpub/b{كود الفرع} = {v, at, to, l:[[كود,لون,مقاس,رصيدك,مبيعاتك,المقترح]]} (الفرع يقرأ ملفه هو بس، القواعد)
// - ورقة النواقص: جنب كل سطر «متوفر / كمية قليلة / غير متوفر في المستودع» + سطر ملخّص تحت الجدول. تحذير بس، الإرسال مسموح دايماً.
// - زر «✨ الطلب المقترح (N)» في شريط الورقة: نافذة فيها الأصناف بالكمية المقترحة، الفرع يختار ويعدّل ويضيفها للورقة.
// المتوفر بيتخزن على الجهاز (localStorage.tz_stkav) لكل نسخة (v)، فالقراءة مرة واحدة لكل تقرير جديد.
import {doc,getDoc} from "./fb.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const nk=s=>String(s==null?"":s).toUpperCase().replace(/\s+/g,"");
const lc=s=>String(s==null?"":s).trim().toLowerCase();
let X=null,AV=null,META=null,SUG=null,GEN=0,MO=null,TM=0,wired=false;
const LV=[["a0","غير متوفر","غير متوفر في المستودع"],["a1","كمية قليلة","كمية قليلة في المستودع"],["a2","متوفر","متوفر في المستودع"]];
const CSS=`#rs td{position:relative}
#rs .avb{position:absolute;bottom:2px;inset-inline-end:4px;font-size:10.5px;line-height:1;font-weight:800;border-radius:6px;padding:2px 5px;pointer-events:none;white-space:nowrap;z-index:1}
#rs .avb.a2{background:#e3f1d8;color:#3d5a1e}#rs .avb.a1{background:#fdecc8;color:#7a4b00}#rs .avb.a0{background:#fbe0dc;color:#9b2a1e}
#stkn{margin:8px 0 0;padding:8px 12px;border-radius:12px;background:var(--soft,#f6eee3);color:var(--ink,#2a1d2c);font-size:13.5px;line-height:1.7}
#stkn[hidden]{display:none}#stkn b{font-weight:800}#stkn .g{color:#4b6b25}#stkn .y{color:#946000}#stkn .r{color:#b0392b}#stkn small{display:block;color:var(--mut);font-size:12px}
#sgb{display:inline-flex;align-items:center;gap:6px}#sgb i{font-style:normal;background:#8a5a83;color:#fff;border-radius:999px;font-size:12px;line-height:20px;min-width:22px;padding:0 6px;text-align:center}
#stsg{display:none;position:fixed;inset:0;z-index:88;background:rgba(0,0,0,.55);padding:14px;align-items:center;justify-content:center}#stsg.on{display:flex}
#stsg .sgp{width:100%;max-width:640px;max-height:calc(100dvh - 28px);display:flex;flex-direction:column;background:var(--card,#fffaf3);color:var(--ink,#2a1d2c);border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.4)}
#stsg .sgh{padding:16px 18px 10px;border-bottom:1px solid var(--line,#e3d5c3)}#stsg .sgh b{display:block;font-size:18px}#stsg .sgh small{display:block;color:var(--mut);font-size:13px;line-height:1.7;margin-top:4px}
#stsg .sgt{display:flex;gap:8px;align-items:center;padding:10px 18px;flex-wrap:wrap}#stsg .sgt input[type=search]{flex:1;min-width:150px;font:inherit;font-size:15px;border:0;border-radius:999px;background:var(--field,#f2e9dd);color:var(--ink);padding:9px 14px}
#stsg .sgt button,#stsg .sgf button{font:inherit;font-weight:700;border-radius:12px;border:1.5px solid var(--line,#e3d5c3);background:var(--card);color:var(--ink);padding:8px 14px;cursor:pointer}
#stsg .sgl{overflow-y:auto;flex:1;padding:0 10px 8px}
#stsg .sgr{display:grid;grid-template-columns:28px 1fr auto 78px;gap:10px;align-items:center;padding:9px 8px;border-radius:12px;cursor:pointer}
#stsg .sgr:hover{background:var(--soft,#f6eee3)}#stsg .sgr input[type=checkbox]{width:20px;height:20px;margin:0;accent-color:#8a5a83}
#stsg .sgr b{display:block;font-size:15px}#stsg .sgr span{color:var(--mut);font-size:12.5px}#stsg .sgr em{font-style:normal;font-size:12px;color:var(--mut);text-align:center;line-height:1.4}
#stsg .sgr input[type=number]{width:100%;font:inherit;font-size:16px;font-weight:800;text-align:center;border:1.5px solid var(--line,#e3d5c3);border-radius:10px;padding:7px 4px;background:var(--field,#fff);color:var(--ink)}
#stsg .sgr.off{opacity:.5}#stsg .sge{padding:30px;text-align:center;color:var(--mut);line-height:1.9}
#stsg .sgf{display:flex;gap:8px;padding:12px 18px 14px;border-top:1px solid var(--line,#e3d5c3);background:var(--soft,#f6eee3)}
#stsg .sgf .ok{flex:1;background:#2a1d2c;color:#fff;border-color:#2a1d2c}#stsg .sgf .ok:disabled{opacity:.5}
@media (max-width:520px){#stsg{padding:0}#stsg .sgp{max-height:100dvh;height:100dvh;border-radius:0}#stsg .sgr{grid-template-columns:24px 1fr 64px}#stsg .sgr em{grid-column:2;text-align:start}}
:where([data-theme=dark]) #rs .avb.a2{background:#2c3a1f;color:#bfe39b}:where([data-theme=dark]) #rs .avb.a1{background:#3d2f12;color:#f3cf7e}:where([data-theme=dark]) #rs .avb.a0{background:#3d1d19;color:#f2a497}
@media print{#rs .avb,#stkn,#sgb,#stsg{display:none!important}}`;
const cssOn=()=>{if(!g("brs-css")){const s=document.createElement("style");s.id="brs-css";s.textContent=CSS;document.head.appendChild(s)}};
// ---------- التحميل ----------
function readCache(){try{const o=JSON.parse(localStorage.getItem("tz_stkav")||"null");return o&&o.c&&typeof o.c==="object"?o:null}catch(e){return null}}
function writeCache(o){try{localStorage.setItem("tz_stkav",JSON.stringify(o))}catch(e){}}
function index(raw){const m=new Map();Object.keys(raw.c).forEach(c=>{const src=raw.c[c],o={};if(src&&typeof src==="object")Object.keys(src).forEach(k=>{o[lc(k)]=N(src[k])});m.set(nk(c),o)});return m}
async function loadAv(my){
  const cached=readCache();let m=null;
  try{const s=await getDoc(doc(X.db,"stkpub","meta"));m=s.exists()?s.data():null}catch(e){m=null}
  if(my!==GEN)return;
  if(!m||!N(m.parts)){if(cached){AV=index(cached);META={v:cached.v,to:cached.to}}return}
  META=m;if(cached&&N(cached.v)===N(m.v)){AV=index(cached);return}
  let P=[];try{P=await Promise.all(Array.from({length:Math.min(10,N(m.parts))},(_,i)=>getDoc(doc(X.db,"stkpub","a"+i)).then(s=>s.exists()?s.data():null)))}catch(e){P=[]}
  if(my!==GEN)return;
  if(!P.length||P.some(p=>!p||N(p.v)!==N(m.v))){if(cached){AV=index(cached);META={v:cached.v,to:cached.to}}return}// نشر لم يكتمل: نكمّل بالقديم
  const raw={v:N(m.v),to:String(m.to||""),c:Object.assign.apply(Object,[{}].concat(P.map(p=>p.c||{})))};writeCache(raw);AV=index(raw);
}
async function loadSug(my){
  try{const s=await getDoc(doc(X.db,"stkpub","b"+X.code));if(my!==GEN)return;const d=s.exists()?s.data():null;
    SUG=d&&Array.isArray(d.l)?{to:String(d.to||""),at:N(d.at),l:d.l.filter(r=>Array.isArray(r)&&r.length>=6&&String(r[0]||"")&&N(r[5])>0)}:null}
  catch(e){if(my===GEN)SUG=null}
}
// ---------- مستوى سطر في الورقة ----------
export function levelOf(k,c,z){
  if(!AV)return null;const o=AV.get(nk(k));if(!o)return null;const C=lc(c),Z=lc(z);
  if(C&&Z){const v=o[C+"|"+Z];return v===undefined?null:v}
  let best=-1;for(const key in o){const p=key.split("|");if(C&&p[0]!==C)continue;if(Z&&p[1]!==Z)continue;if(o[key]>best)best=o[key]}
  return best<0?null:best;
}
const inp=(i,k)=>document.querySelector(`#rs input[data-i="${i}"][data-k="${k}"]`);
function markAll(){
  const rs=g("rs");if(!rs||!AV)return;const cnt=[0,0,0];
  rs.querySelectorAll('input[data-k="k"]').forEach(K=>{const i=K.dataset.i,td=K.parentElement,C=inp(i,"c"),Z=inp(i,"z"),Q=inp(i,"q");
    let b=td.querySelector(".avb");const lv=K.value.trim()?levelOf(K.value,C&&C.value,Z&&Z.value):null;
    if(lv==null){if(b)b.remove();return}
    if(!(Q&&N(Q.value)>0)&&!(C&&C.value.trim()))return void(b&&b.remove());
    cnt[lv]++;const L=LV[lv];if(!b){b=document.createElement("span");b.setAttribute("aria-hidden","true");td.appendChild(b)}
    if(b.className!=="avb "+L[0]){b.className="avb "+L[0];b.textContent=L[1]}K.title=L[2]+(META&&META.to?" (تقرير "+META.to+")":"")});
  const n=g("stkn");if(!n)return;const tot=cnt[0]+cnt[1]+cnt[2];n.hidden=!tot;
  if(tot)n.innerHTML=`📦 في المستودع: <b class="g">${cnt[2]} متوفر</b>${cnt[1]?` · <b class="y">${cnt[1]} كمية قليلة</b>`:""}${cnt[0]?` · <b class="r">${cnt[0]} غير متوفر</b>`:""}<small>حسب تقرير المخزون${META&&META.to?` بتاريخ <bdi dir="ltr">${E(META.to)}</bdi>`:""}. قد يتغيّر حتى يُجهَّز الطلب، والإرسال مسموح دائماً.</small>`;
}
const later=()=>{clearTimeout(TM);TM=setTimeout(markAll,120)};
function sheetWire(){
  const rs=g("rs");if(!rs)return;
  if(!g("stkn")){const tb=rs.closest("table"),host=tb&&tb.parentNode;if(host){const n=document.createElement("div");n.id="stkn";n.hidden=true;n.setAttribute("role","status");const cat=g("catn");(cat||host).parentNode.insertBefore(n,(cat||host).nextSibling)}}
  if(MO)MO.disconnect();MO=new MutationObserver(later);MO.observe(rs,{childList:true});
  if(!wired){wired=true;document.addEventListener("input",e=>{const t=e.target;if(X&&t&&t.closest&&t.closest("#rs"))later()});document.addEventListener("change",e=>{const t=e.target;if(X&&t&&t.closest&&t.closest("#rs"))later()})}
  markAll();
}
// ---------- ✨ الطلب المقترح ----------
let SEL=new Map(),SQ="";
function paintBtn(){
  const act=document.querySelector(".act"),add=g("add");let b=g("sgb");const n=SUG?SUG.l.length:0;
  if(!n){if(b)b.remove();return}
  if(!b&&act){b=document.createElement("button");b.className="b";b.id="sgb";b.type="button";b.onclick=openSug;act.insertBefore(b,add||null)}
  if(b)b.innerHTML=`✨ الطلب المقترح <i>${n}</i>`;
}
function box(){let m=g("stsg");if(!m){m=document.createElement("div");m.id="stsg";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-labelledby","stsg-h");document.body.appendChild(m);
  m.addEventListener("click",onClick);m.addEventListener("input",onInput);m.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close()}})}return m}
function close(){const m=g("stsg");if(m){m.className="";m.innerHTML=""}}
function openSug(){
  if(!SUG||!SUG.l.length)return;SEL=new Map();SUG.l.forEach((r,i)=>SEL.set(i,N(r[5])));SQ="";
  const m=box();m.innerHTML=`<div class="sgp"><div class="sgh"><b id="stsg-h">✨ الطلب المقترح لفرعك</b><small>من تقرير المخزون${SUG.to?` بتاريخ <bdi dir="ltr">${E(SUG.to)}</bdi>`:""}: أصناف رصيدك منها أقل من الحد وكانت تُباع عندك، والمستودع عنده منها. الكمية المقترحة تكمل رصيدك للحد، ويمكنك تعديلها أو إلغاء أي صنف.</small></div>
  <div class="sgt"><input type="search" id="sgq" placeholder="ابحث بالكود أو اللون" autocomplete="off"><button type="button" data-sg="all">تحديد الكل</button><button type="button" data-sg="none">إلغاء التحديد</button></div>
  <div class="sgl" id="sgl"></div>
  <div class="sgf"><button type="button" class="ok" data-sg="add"></button><button type="button" data-sg="close">إغلاق</button></div></div>`;
  m.className="on";paintList();setTimeout(()=>{const q=g("sgq");if(q&&!/android|iphone|ipad|mobile/i.test(navigator.userAgent))q.focus()},40);
}
function paintList(){
  const L=g("sgl");if(!L||!SUG)return;const q=SQ.toLowerCase();
  const rows=SUG.l.map((r,i)=>({r,i})).filter(x=>!q||String(x.r[0]).toLowerCase().includes(q)||String(x.r[1]).toLowerCase().includes(q));
  L.innerHTML=rows.length?rows.map(({r,i})=>{const on=SEL.has(i);return `<label class="sgr${on?"":" off"}"><input type="checkbox" data-sgc="${i}" ${on?"checked":""}><div><b><bdi dir="ltr" data-notr>${E(r[0])}</bdi></b><span><bdi dir="ltr" data-notr>${E(r[1]||"-")}${r[2]?" · "+E(r[2]):""}</bdi></span></div><em>رصيدك ${N(r[3])}<br>بِعتَ ${N(r[4])}</em><input type="number" min="1" max="9999" inputmode="numeric" data-sgq="${i}" value="${on?SEL.get(i):N(r[5])}" aria-label="الكمية"></label>`}).join("")
    :`<div class="sge">لا توجد نتائج</div>`;
  paintFoot();
}
function paintFoot(){const b=document.querySelector('#stsg [data-sg="add"]');if(!b)return;let n=0,q=0;SEL.forEach(v=>{if(v>0){n++;q+=v}});b.disabled=!n;b.textContent=n?`➕ أضف ${n} صنف (${q} قطعة) إلى الورقة`:"اختر صنفاً واحداً على الأقل"}
function onInput(e){const t=e.target;
  if(t.id==="sgq"){SQ=t.value.trim();paintList();return}
  if(t.dataset.sgq!=null){const i=+t.dataset.sgq,v=Math.max(0,Math.min(9999,Math.round(N(t.value))));if(SEL.has(i)||v>0){if(v>0)SEL.set(i,v);else SEL.delete(i)}const row=t.closest(".sgr"),cb=row&&row.querySelector("[data-sgc]");if(cb)cb.checked=SEL.has(i);if(row)row.classList.toggle("off",!SEL.has(i));paintFoot()}}
function onClick(e){const t=e.target;
  if(t.dataset&&t.dataset.sgc!=null){const i=+t.dataset.sgc,row=t.closest(".sgr"),qi=row&&row.querySelector("[data-sgq]");if(t.checked)SEL.set(i,Math.max(1,N(qi&&qi.value)||N(SUG.l[i][5])));else SEL.delete(i);if(row)row.classList.toggle("off",!t.checked);paintFoot();return}
  const b=t.closest&&t.closest("[data-sg]");if(!b)return;const a=b.dataset.sg;
  if(a==="close")return close();
  if(a==="all"){SUG.l.forEach((r,i)=>{if(!SEL.has(i))SEL.set(i,N(r[5]))});paintList();return}
  if(a==="none"){SEL.clear();paintList();return}
  if(a==="add"){const list=[];SEL.forEach((q,i)=>{const r=SUG.l[i];if(r&&q>0)list.push({k:String(r[0]),c:String(r[1]||""),z:String(r[2]||""),q})});
    const res=typeof window.__sheetAdd==="function"?window.__sheetAdd(list):null;
    if(!res){X.toast("تعذّرت الإضافة إلى الورقة. حدّث الصفحة وحاول مرة أخرى","er");return}
    close();X.toast(`✨ أُضيف ${res.a} صنف إلى الورقة${res.u?` وحُدّثت كمية ${res.u}`:""}${res.s?` (${res.s} موجود بكميته في الورقة)`:""}. راجِعها ثم «إرسال للمستودع»`);
    const rs=g("rs");if(rs)rs.scrollIntoView({block:"start",behavior:"smooth"})}}
// ---------- التشغيل ----------
export async function initBrStock(ctx){
  stopBrStock();X=ctx;const my=++GEN;cssOn();
  await Promise.all([loadAv(my),loadSug(my)]);if(my!==GEN)return;
  if(AV)sheetWire();paintBtn();
}
export function stopBrStock(){GEN++;X=null;AV=null;META=null;SUG=null;if(MO){MO.disconnect();MO=null}close();const b=g("sgb");if(b)b.remove();const n=g("stkn");if(n)n.remove();document.querySelectorAll("#rs .avb").forEach(x=>x.remove())}
export const brStockState=()=>({av:!!AV,n:AV?AV.size:0,meta:META,sug:SUG?SUG.l.length:0});
