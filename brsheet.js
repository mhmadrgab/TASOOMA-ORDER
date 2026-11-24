// 📄 ورقة الطلب عند الفرع (15 نوفمبر 2026، طلب محمد: "كارت لكل طلب، والضغط يفتحه في شكل ورقة حلوة بدل تفاصيل الطلب،
// ولو شركة الشحن استلمت الفرع يشوف المرفقات بنفسه"). كل طلب في "طلباتي" بقى كارت، والضغط عليه بيفتح ورقة فيها:
// بيانات الطلب، مراحله بالوقت، الأصناف في جدول (غير المتوفر مشطوب، والمضاف ➕، والكمية اللي اتغيّرت)، التسليم/الشحن
// (السائق، المستلم، شركة الشحن، البوليصة) + صور التسليم وإيصال الشحن والتوقيع (pods/{رقم الطلب} + x/N)، وملاحظات الاستلام.
// القواعد: الفرع بيقرا pods لطلباته بس (can_read في 002_rules.sql).
import {doc,getDoc} from "./fb.js";
import {loadExtras} from "./att.js";
import {zoomGallery} from "./zoom.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const isImg=s=>typeof s==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(s);
const ORD=["XXS","XS","S","M","L","XL","XXL","2XL","3XL","4XL"];
const sk=z=>{const n=parseFloat(z);return isNaN(n)?(ORD.indexOf(String(z).toUpperCase())+1||99)+1000:n};
const dt=t=>{if(!N(t))return "";const d=new Date(N(t));return d.toLocaleDateString("en-GB")+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
let X=null,CUR=null;

const OSH_CSS=`
#ml .mr{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:14px 16px;margin:0 0 10px;border:1px solid var(--line);border-inline-start:5px solid var(--sc,#8a5a83);border-radius:16px;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 20px -16px rgba(40,30,10,.45);cursor:pointer;transition:box-shadow .2s,transform .2s}
#ml .mr:last-child{border-bottom:1px solid var(--line)}
#ml .mr:hover{box-shadow:0 2px 4px rgba(0,0,0,.06),0 14px 28px -16px rgba(40,30,10,.5)}
#ml .mr:active{transform:scale(.995)}
#ml .mr>div:first-child{flex:1;min-width:150px}
#ml .mr[data-st="new"]{--sc:#8a5a83}#ml .mr[data-st="prep"]{--sc:#0a8fa3}#ml .mr[data-st="go"]{--sc:#0b6bdb}#ml .mr[data-st="done"]{--sc:#6f7d45}#ml .mr[data-st="recv"]{--sc:#9aa48a}
#ml .oshb{font:inherit;font-size:13.5px;font-weight:700;border:1.5px solid var(--sc,#8a5a83);color:var(--ink);background:color-mix(in srgb,var(--sc,#8a5a83) 9%,transparent);border-radius:999px;padding:5px 14px;cursor:pointer;white-space:nowrap}
#osh{display:none;position:fixed;inset:0;z-index:83;background:rgba(20,12,22,.62);overflow:auto;padding:16px}
#osh.on{display:block}
#osh .os-pp{position:relative;padding-top:46px!important;max-width:760px;margin:2vh auto 4vh;background:#fffdf8;color:#231a25;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.45);padding:26px 28px 22px;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;background-image:linear-gradient(transparent 0 0)}
#osh .os-pp:before{content:"";position:absolute;inset:0 0 auto 0;height:6px;border-radius:6px 6px 0 0;background:linear-gradient(90deg,#6f7d45,#b48aab 45%,#b48aab 55%,#6f7d45)}
#osh .os-ph{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;border-bottom:2px solid #231a25;padding-bottom:12px;margin-bottom:14px}
#osh .os-ph .os-lg b{display:block;font-size:22px;letter-spacing:.5px}#osh .os-ph .os-lg small{color:#6b5f6e;font-size:13px}
#osh .os-ph .os-no{text-align:end}#osh .os-ph .os-no small{display:block;color:#6b5f6e;font-size:12.5px}#osh .os-ph .os-no b{font-size:20px;direction:ltr;unicode-bidi:isolate}
#osh .os-st{display:inline-block;margin-top:6px;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700;background:#efe6ee;color:#5f3a59}
#osh .os-mt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 16px;margin-bottom:14px}
@media (max-width:560px){#osh .os-mt{grid-template-columns:repeat(2,minmax(0,1fr))}#osh .os-pp{padding:20px 16px}}
#osh .os-mt div small{display:block;color:#6b5f6e;font-size:12px}#osh .os-mt div b{font-size:15px}
#osh .os-tl{display:flex;gap:0;margin:4px 0 18px;overflow-x:auto;padding-bottom:4px}
#osh .os-tl .os-s{flex:1;min-width:92px;text-align:center;position:relative;font-size:12px;color:#8b7f8d;padding-top:22px}
#osh .os-tl .os-s:before{content:"";position:absolute;top:6px;inset-inline-start:50%;width:100%;height:3px;background:#e7dfe6}
#osh .os-tl .os-s:last-child:before{display:none}
#osh .os-tl .os-s i{position:absolute;top:0;inset-inline-start:calc(50% - 8px);width:16px;height:16px;border-radius:50%;background:#e7dfe6;border:3px solid #fffdf8;box-sizing:border-box;z-index:1}
#osh .os-tl .os-s.ok{color:#231a25}#osh .os-tl .os-s.ok i{background:#6f7d45}#osh .os-tl .os-s.ok:before{background:#6f7d45}
#osh .os-tl .os-s.cur i{background:#8a5a83;box-shadow:0 0 0 4px rgba(138,90,131,.2)}
#osh .os-tl.os-up .os-s.cur i{animation:os-pulse .9s var(--ease-smooth-out,ease-out)}
@keyframes os-pulse{0%{box-shadow:0 0 0 0 rgba(138,90,131,.55)}100%{box-shadow:0 0 0 12px rgba(138,90,131,0)}}
@media (prefers-reduced-motion:reduce){#osh .os-tl.os-up .os-s.cur i{animation:none}}
#osh .os-tl .os-s b{display:block;font-size:12.5px}#osh .os-tl .os-s small{display:block;font-size:11px;direction:ltr}
@media (max-width:560px){
 #osh .os-tl{flex-direction:column;overflow:visible;margin-bottom:12px}
 #osh .os-tl .os-s{flex:none;min-width:0;text-align:start;padding:0 0 14px;padding-inline-start:28px;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 10px}
 #osh .os-tl .os-s:before{top:18px;height:calc(100% - 4px);width:3px;inset-inline-start:6.5px}
 #osh .os-tl .os-s i{top:2px;inset-inline-start:0}
 #osh .os-tl .os-s b,#osh .os-tl .os-s small{display:inline}
 #osh .os-tl .os-s:last-child{padding-bottom:0}
}
#osh h4{margin:16px 0 8px;font-size:15.5px;display:flex;align-items:center;gap:6px}
#osh table{width:100%;border-collapse:collapse;font-size:14px}
#osh th{background:#f3ece4;color:#4a3f4c;font-weight:700;font-size:12.5px;padding:7px 8px;border:1px solid #d9cfc4;text-align:start}
#osh td{padding:7px 8px;border:1px solid #d9cfc4;vertical-align:top}
#osh td.k{font-weight:700;direction:ltr;text-align:start;white-space:nowrap}
#osh td.q{text-align:center;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
#osh .os-zq{display:inline-flex;align-items:baseline;gap:3px;border:1px solid #d9cfc4;border-radius:8px;padding:1px 7px;margin:2px;background:#fff;direction:ltr;font-variant-numeric:tabular-nums}
#osh .os-zq i{font-style:normal;color:#6b5f6e;font-size:12px}#osh .os-zq b{font-size:14px}
#osh .os-zq.na{text-decoration:line-through;opacity:.55;background:#f6e3e1}#osh .os-zq.ad{border-color:#6f7d45;background:#eef1e3}
#osh .os-zq s{color:#a33;font-size:11.5px}
#osh tfoot td{background:#f8f3ec;font-weight:700}
#osh .os-nt{background:#f8f3ec;border:1px dashed #d9cfc4;border-radius:10px;padding:8px 12px;font-size:14px;white-space:pre-wrap;word-break:break-word}
#osh .os-ed{background:#f2e9f0;border-radius:10px;padding:8px 12px;font-size:13.5px;margin-bottom:8px}
#osh .os-dv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
@media (max-width:560px){#osh .os-dv{grid-template-columns:1fr}}
#osh .os-dv div small{display:block;color:#6b5f6e;font-size:12px}#osh .os-dv div b{font-size:14.5px}
#osh .os-at{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#osh .os-at button{font:inherit;font-weight:700;font-size:14px;border:1.5px solid #6f7d45;background:#eef1e3;color:#2f3a17;border-radius:12px;padding:9px 14px;cursor:pointer}
#osh .os-at button:disabled{opacity:.6;cursor:progress}
#osh .os-rc{border-radius:10px;padding:8px 12px;font-size:13.5px;background:#eef1e3}#osh .os-rc.bad{background:#f6e3e1}
#osh .os-ft{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:20px;border-top:1px solid #d9cfc4;padding-top:14px}
#osh .os-ft button{font:inherit;font-weight:700;border:1.5px solid #cfc3b6;background:#fff;color:#231a25;border-radius:12px;padding:9px 16px;cursor:pointer}
#osh .os-ft button.p{background:#6f7d45;border-color:#6f7d45;color:#fff}
#osh .os-x{position:absolute;top:12px;inset-inline-end:12px;width:34px;height:34px;border-radius:50%;border:0;background:#f1ebe4;color:#231a25;font-size:18px;cursor:pointer}
@media print{#osh{position:static;background:none;padding:0;overflow:visible}#osh .os-pp{box-shadow:none;margin:0;max-width:none}#osh .os-ft,#osh .os-x,#osh .os-at{display:none!important}
 body.osh-pr>*:not(#osh){display:none!important}}
`;
function css(){if(!g("osh-css")){const s=document.createElement("style");s.id="osh-css";s.textContent=OSH_CSS;document.head.appendChild(s)}}

// ctx: {db, toast, get(id) → الطلب، lbl(r), isShip(r), ship() اسم شركة الشحن، brn() اسم الفرع}
export function initSheet(ctx){X=ctx;css()}
export function stopSheet(){closeSheet();X=null}

// الأصناف: كود ← لون ← مقاسات وكميات (زي ورقة المستودع)
function table(rows){
 const A=(Array.isArray(rows)?rows:[]).filter(r=>r&&typeof r==="object"),m=new Map();
 A.forEach(r=>{const k=String(r.k||"");if(!m.has(k))m.set(k,new Map());const cm=m.get(k),c=String(r.c||"-");if(!cm.has(c))cm.set(c,[]);cm.get(c).push(r)});
 let h="",tot=0,codes=0;
 [...m].sort((a,b)=>a[0].localeCompare(b[0],"en",{numeric:true})).forEach(([k,cm])=>{const cols=[...cm];let first=true;codes++;
  cols.forEach(([c,rs])=>{rs=rs.slice().sort((a,b)=>sk(a.z)-sk(b.z));const q=rs.reduce((s,r)=>s+(r.na?0:N(r.q)),0);tot+=q;
   const ns=[...new Set(rs.map(r=>String(r.n||"")).filter(Boolean))].join(" / ");
   h+=`<tr>${first?`<td class="k" rowspan="${cols.length}"><bdi>${E(k)}</bdi><span class="pim" data-pimg="${E(k)}"></span></td>`:""}<td><bdi dir="ltr">${E(c)}</bdi></td><td>${rs.map(r=>`<span class="os-zq ${r.na?"na":r.add?"ad":""}" title="${r.na?"غير متوفر":r.add?"أضافه المستودع":""}">${r.add?"➕":""}${r.z?`<i>${E(r.z)}</i>`:""}<b>${N(r.q)}</b>${r.oq!=null&&!r.na?`<s>${N(r.oq)}</s>`:""}</span>`).join("")}${ns?`<div style="font-size:12px;color:#6b5f6e;margin-top:3px" data-notr>${E(ns)}</div>`:""}</td><td class="q">${q}</td></tr>`;first=false})});
 const na=A.filter(r=>r.na).length,ad=A.filter(r=>r.add).length,ch=A.filter(r=>!r.na&&r.oq!=null).length;
 const ed=na||ad||ch?`<div class="os-ed">✏️ عدّل المستودع هذا الطلب:${na?` 🚫 ${na} غير متوفر`:""}${ad?` · ➕ ${ad} أضافه المستودع`:""}${ch?` · 🔁 ${ch} تغيّرت كميته (الرقم المشطوب = ما طلبته)`:""}</div>`:"";
 return ed+`<table><thead><tr><th>الكود</th><th>اللون</th><th>المقاسات والكميات</th><th>الإجمالي</th></tr></thead><tbody>${h||`<tr><td colspan="4" style="text-align:center;color:#6b5f6e">لا توجد أصناف</td></tr>`}</tbody><tfoot><tr><td colspan="3">الإجمالي: ${codes} صنف</td><td class="q">${tot}</td></tr></tfoot></table>`;
}
function steps(r,ship){
 const S=[["أُرسل الطلب",N(r.ts)],["بدأ التجهيز",N(r.prep&&r.prep.at)||((r.st!=="new")?1:0)],["تم التجهيز",N(r.pdn)||(["go","done","recv"].indexOf(r.st)>=0?1:0)],
  [ship?"خرج إلى شركة الشحن":"خرج مع السائق",N(r.dep)||(["go","done","recv"].indexOf(r.st)>=0?1:0)],[ship?"سُلِّم لشركة الشحن":"تم التسليم",N(r.dlv)||(["done","recv"].indexOf(r.st)>=0?1:0)],[r.rcv&&r.rcv.bp&&r.rcv.bp.n?"استلمه "+String(r.rcv.bp.n).slice(0,40):"استلمه الفرع",N(r.rcv&&r.rcv.at)||(r.st==="recv"?1:0)]];
 let last=-1;S.forEach((s,i)=>{if(s[1])last=i});
 return `<div class="os-tl">${S.map((s,i)=>`<div class="os-s ${s[1]?"ok":""} ${i===last+1&&r.st!=="recv"?"cur":""}"><i></i><b>${E(s[0])}</b>${s[1]>1?`<small>${E(dt(s[1]))}</small>`:""}</div>`).join("")}</div>`;
}
// ⚡ (v176، 19 نوفمبر 2026، محمد: "مراحل تجهيز الطلب عند الفروع مش بتتحدث لايف") الورقة المفتوحة تتحدّث لوحدها
// مع أي تغيير في الطلب (index.html بينادي refreshSheet بعد كل بيانات جديدة). نرسم من جديد بس لو الطلب اتغيّر فعلاً،
// ونحافظ على مكان التمرير، ومابنرسمش وقت الطباعة. لو الطلب خرج من القائمة بتفضل آخر نسخة ظاهرة.
let SIG="";
export function refreshSheet(){
 if(!X||!CUR)return;const m=g("osh");if(!m||m.className!=="on"||document.body.classList.contains("osh-pr"))return;
 const r=X.get(CUR);if(!r)return;let s="";try{s=JSON.stringify(r)+"|"+(X.ship?X.ship():"")}catch(e){return}
 if(s===SIG)return;
 const top=m.scrollTop,f=document.activeElement&&m.contains(document.activeElement)?document.activeElement.getAttribute("data-osh-a"):null;
 openSheet(CUR,true);m.scrollTop=top;
 if(f){const b=m.querySelector(`[data-osh-a="${f}"]`);if(b)try{b.focus({preventScroll:true})}catch(e){}}
 const st=m.querySelector(".os-tl");if(st&&!document.documentElement.classList.contains("lite")){st.classList.add("os-up");setTimeout(()=>st.classList.remove("os-up"),900)}
}
export function openSheet(id,live){
 if(!X)return;const r=X.get(id);if(!r)return;css();CUR=id;try{SIG=JSON.stringify(r)+"|"+(X.ship?X.ship():"")}catch(e){SIG=""}
 const ship=!!(X.isShip&&X.isShip(r)),pod=r.pod&&typeof r.pod==="object"?r.pod:null,v=r.rcv&&typeof r.rcv==="object"?r.rcv:null;
 const hasPics=pod&&(pod.ph||isImg(pod.img)),hasSig=pod&&(pod.sg||isImg(pod.sig));
 const dv=pod||r.asg?`<h4>${ship?"📦 التسليم لشركة الشحن":"🚚 التسليم"}</h4><div class="os-dv">
  ${r.asg&&r.asg.drvn?`<div><small>السائق</small><b data-notr>${E(r.asg.drvn)}</b></div>`:""}
  ${N(r.dep)?`<div><small>خرج من المستودع</small><b><bdi dir="ltr">${E(dt(r.dep))}</bdi></b></div>`:""}
  ${ship?`<div><small>شركة الشحن</small><b data-notr>${E(pod&&pod.co||(X.ship&&X.ship())||"")}</b></div>`:""}
  ${pod&&pod.wb?`<div><small>رقم البوليصة</small><b><bdi dir="ltr">${E(pod.wb)}</bdi></b></div>`:""}
  ${pod&&pod.name?`<div><small>${ship?"استلمه من شركة الشحن":"المستلم"}</small><b data-notr>${E(pod.name)}</b></div>`:""}
  ${N(r.dlv)||N(pod&&pod.at)?`<div><small>${ship?"وقت التسليم للشركة":"وقت التسليم"}</small><b><bdi dir="ltr">${E(dt(N(r.dlv)||N(pod.at)))}</bdi></b></div>`:""}</div>
  ${hasPics||hasSig?`<div class="os-at">${hasPics?`<button type="button" data-osh-a="img">${ship?"🧾 إيصال الشحن والصور":"📷 صور التسليم"}</button>`:""}${hasSig?`<button type="button" data-osh-a="sig">✍ التوقيع</button>`:""}</div>`:""}`:"";
 const rc=v?`<h4>✅ استلامكم</h4><div class="os-rc ${v.ok===false?"bad":""}">${v.ok?"استلمتم الطلب كاملاً":"ملاحظات الاستلام:"}${(Array.isArray(v.lines)?v.lines:[]).filter(x=>x&&typeof x==="object").map(x=>`<div><bdi dir="ltr">${E(x.k)} ${E(x.c||"")} ${E(x.z||"")}</bdi>: مطلوب ${N(x.q)} · استلمتم ${N(x.r)}</div>`).join("")}${v.note?`<div data-notr>${E(v.note)}</div>`:""}${N(v.at)?`<div style="font-size:12px;color:#6b5f6e;margin-top:4px"><bdi dir="ltr">${E(dt(v.at))}</bdi></div>`:""}</div>`:"";
 const by=r.tr?`تحويل من <bdi dir="ltr" data-notr>${E(r.tr.frn||"")}</bdi>`:r.by==="wh"?"أنشأه المستودع":"طلب الفرع";
 let m=g("osh");if(!m){m=document.createElement("div");m.id="osh";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.addEventListener("click",e=>{if(e.target===m)closeSheet()});document.body.appendChild(m)}
 m.innerHTML=`<div class="os-pp"><button class="os-x" type="button" data-osh-a="close" aria-label="إغلاق">✕</button>
 <div class="os-ph"><div class="os-lg"><b>تاسومة · TASOOMA</b><small>ورقة طلب من المستودع</small></div><div class="os-no"><small>رقم الطلب</small><b>${E(r.no||"")}</b><div><span class="os-st">${E(X.lbl?X.lbl(r):r.st)}</span></div></div></div>
 <div class="os-mt"><div><small>الفرع</small><b><bdi dir="ltr">${E(r.brn||(X.brn&&X.brn())||"")}</bdi></b></div><div><small>تاريخ الطلب</small><b><bdi dir="ltr">${E(dt(r.ts))}</bdi></b></div><div><small>النوع</small><b>${by}</b></div>
 <div><small>عدد الأصناف</small><b>${N(r.codes)}</b></div><div><small>إجمالي القطع</small><b>${N(r.pcs)}</b></div>${r.bp&&r.bp.n?`<div><small>اسم من طلب</small><b data-notr>${E(r.bp.n)}</b></div>`:r.dr?`<div><small>اسم من طلب</small><b data-notr>${E(r.dr)}</b></div>`:r.edn?`<div><small>آخر من عدّل</small><b data-notr>${E(r.edn)}</b></div>`:""}</div>
 ${steps(r,ship)}
 <h4>📦 الأصناف</h4>${table(r.rows)}
 ${r.gn?`<h4>🗒 ملاحظات</h4><div class="os-nt" data-notr>${E(r.gn)}</div>`:""}
 ${dv}${rc}
 <div class="os-ft"><button type="button" data-osh-a="print">🖨 طباعة</button>${r.st==="done"?`<button type="button" class="p" data-osh-a="rcv">✅ استلمت الطلب</button>`:""}<button type="button" data-osh-a="close">إغلاق</button></div></div>`;
 if(live)return;
 m.className="on";m.scrollTop=0;document.documentElement.style.overflow="hidden";
}
export function closeSheet(){const m=g("osh");if(m){m.className="";m.innerHTML=""}document.documentElement.style.overflow="";document.body.classList.remove("osh-pr");CUR=null;SIG=""}
// صور التسليم/إيصال الشحن والتوقيع: قراءة وقت الضغط بس (pods/{رقم الطلب} + x/N)
async function pics(which,btn){
 if(!X||!CUR)return;const r=X.get(CUR);if(!r)return;const t0=btn.textContent;btn.disabled=true;btn.textContent="⏳ جاري التحميل...";
 try{
  const pod=r.pod||{},L=[];let d={};
  if(!(which==="img"?isImg(pod.img):isImg(pod.sig))){const s=await getDoc(doc(X.db,"pods",r.id));d=s.exists()?s.data()||{}:{}}
  if(which==="sig"){const s=isImg(pod.sig)?pod.sig:d.sig;if(isImg(s))L.push({src:s})}
  else{const s=isImg(pod.img)?pod.img:d.img;if(isImg(s))L.push({src:s});const ex=await loadExtras(X.db,"pods",r.id);ex.forEach(x=>L.push({src:x.src,nm:x.nm}))}
  if(L.length)zoomGallery(L,`${r.no||""} · ${which==="sig"?"التوقيع":"صور التسليم"}`,0);else X.toast("لا توجد مرفقات (ربما حُذفت)");
 }catch(e){X.toast(e&&e.code==="permission-denied"?"غير مسموح بعرض المرفقات. ربما القواعد (Rules) لم تتحدّث بعد":"تعذر تحميل المرفقات، تأكد من الإنترنت","er")}
 btn.disabled=false;btn.textContent=t0;
}
document.addEventListener("click",e=>{
 if(!X)return;
 const a=e.target.closest&&e.target.closest("[data-osh-a]");
 if(a){const w=a.dataset.oshA;
  if(w==="close")return void closeSheet();
  // (v237) الآيفون أحياناً مابيطلقش afterprint، فالورقة كانت تفضل «وضع طباعة» وماتتحدّثش لايف: بنرجّعها كمان لما الصفحة ترجع قدامه
  if(w==="print"){document.body.classList.add("osh-pr");const done=()=>{document.body.classList.remove("osh-pr");removeEventListener("afterprint",done);removeEventListener("focus",done);document.removeEventListener("visibilitychange",vis);refreshSheet()},vis=()=>{if(!document.hidden)setTimeout(done,300)};
   addEventListener("afterprint",done);setTimeout(()=>{window.print();setTimeout(()=>{addEventListener("focus",done);document.addEventListener("visibilitychange",vis)},400)},50);return}
  if(w==="rcv"){const id=CUR;closeSheet();const b=document.querySelector(`#ml [data-rcv="${CSS.escape(id||"")}"]`);if(b)b.click();return}
  if(w==="img"||w==="sig")return void pics(w,a);
  return}
 // زرار "عرض الطلب" أو الضغط على الكارت نفسه (مش على زرار جوّاه)
 const ob=e.target.closest&&e.target.closest("[data-osh]");if(ob){e.preventDefault();return void openSheet(ob.dataset.osh)}
 const card=e.target.closest&&e.target.closest("#ml .mr[data-id]");
 if(card&&!e.target.closest("button,a,input,select,textarea,label,details,summary,[data-rcv],[data-bc],[data-trk]"))openSheet(card.dataset.id);
});
// Esc يقفل عارض الصور لوحده لو مفتوح (من غير ما يقفل الورقة اللي تحته)، وبعدين Esc تاني يقفل الورقة
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;const z=g("zbx");if(z&&z.classList.contains("on"))return;if(g("osh")&&g("osh").className==="on")closeSheet()});
