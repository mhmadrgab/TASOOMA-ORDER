// 🧾 يومية الفرع (v241، 24 نوفمبر 2026، طلب محمد: «بدل ما موظف الفرع يبعت صور سندات الشبكة للمحاسب على واتساب»):
//   الفرع: يومية لكل يوم: الشبكة لكل جهاز (من فاتورة الموازنة)، الكاش في الدرج، مدفوعات أخرى، مبيعات السيستم، المرتجع، ملاحظات،
//   وصور الموازنة والسندات إجبارياً (حتى 10). الفرق يُحسب وحده = (الشبكة + الكاش + الأخرى) − (مبيعات السيستم − المرتجع).
//   يعدّلها طول ما هي «بانتظار المراجعة» أو «مرجّعة». المحاسب (p.dc) والأدمن ومالك النظام: اعتماد وإقفال، أو إرجاع بسبب، وإعادة فتح المعتمدة بسبب.
//   dclose/{فرع}_{YYYY-MM-DD} = {br, dt, net:[{n,a}], cash, oth?, sys, ret?, note?, ni, by:{e,n}, ts, upd?, st: pend|ok|back, rv?, hx?}
//   dcimg/{فرع}_{YYYY-MM-DD}_{1..10} = {img}. القواعد في 002_rules.sql (v241)، والإشعارات onDc في السيرفر.
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {zoomOpen} from "./zoom.js";
import {openBytes} from "./att.js";// (v244) فتح/تنزيل مرفق PDF
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number.isFinite(+v)?+v:0;
const R2=v=>Math.round(N(v)*100)/100;
const g=id=>document.getElementById(id);
const money=v=>R2(v).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});
const ymd=d=>{const z=n=>(n<10?"0":"")+n;return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())};
const today=()=>ymd(new Date());
const dayAgo=k=>{const d=new Date();d.setDate(d.getDate()-k);return ymd(d)};
const dmy=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?m[3]+"/"+m[2]+"/"+m[1]:""};
const WD=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const wday=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?WD[new Date(+m[1],+m[2]-1,+m[3]).getDay()]:""};
const dts=t=>{if(!t)return "";const d=new Date(N(t));return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
const STL={pend:"بانتظار المراجعة",ok:"معتمدة ومقفولة",back:"مرجّعة للتصحيح"};
const MAXI=10,MAXN=8,LIVE_DAYS=40;
let X=null,LIVE=new Map(),PB=new Map(),LOADED=false,HIST=new Map(),HK="",UN=[],ON=false,BUSY=false,F=null,OPEN="",IMGS=[],IMGK="";
// الحساب: المحصّل والمطلوب والفرق
export function dcCalc(r){
 const net=(Array.isArray(r&&r.net)?r.net:[]).reduce((a,x)=>a+N(x&&x.a),0);
 const got=R2(net+N(r&&r.cash)+N(r&&r.oth)),want=R2(N(r&&r.sys)-N(r&&r.ret)),diff=R2(got-want);
 return {net:R2(net),got,want,diff};
}
const diffTxt=d=>Math.abs(d)<0.005?"مطابقة":d<0?"عجز "+money(-d):"زيادة "+money(d);
const diffCls=d=>Math.abs(d)<0.005?"eq":d<0?"neg":"pos";
const CSS=`
.dcx{display:block}
.dcx-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}.dcx-h h2,.dcx-h h3{margin:0;flex:1;min-width:0}
.dcx-t{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}
.dcx-t>div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
.dcx-t>button{all:unset;cursor:pointer;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px;box-sizing:border-box}
.dcx-t>button:hover,.dcx-t>button:focus-visible{border-color:var(--acc,#8a5a83)}.dcx-t>.on{box-shadow:inset 0 0 0 2px var(--acc,#8a5a83)}
.dcx-t small{display:block;color:var(--mut);font-size:12.5px}.dcx-t b{display:block;font-size:20px;font-weight:800;direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
.dcx-t .w b{color:#b36b1e}.dcx-t .r b{color:#b03a2e}.dcx-t .k b{color:#4c6b2a}
.dcx-f{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:0 0 12px}
.dcx-f label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--mut)}.dcx-f select,.dcx-f input{min-width:0}
.dcx-q{display:flex;gap:6px;flex-wrap:wrap}.dcx-q .b{padding:5px 10px;font-size:12.5px;min-height:0}.dcx-q .b.on{background:var(--acc,#8a5a83);color:#fff;border-color:transparent}
.dcx-miss{margin:0 0 12px;padding:10px 12px;border-radius:14px;background:#fff6e8;border:1px solid #f0d3a8;color:#6b4513;font-size:13.5px}
.dcx-miss b{font-weight:800}.dcx-miss summary{cursor:pointer}.dcx-miss .ch{display:inline-block;margin:3px 4px 0 0;padding:1px 8px;border-radius:999px;background:#fff;border:1px solid #f0d3a8;font-size:12px}
.dcx-ok{margin:0 0 12px;padding:10px 12px;border-radius:14px;background:#eef4e4;border:1px solid #cfe0b6;color:#3f5a20;font-size:13.5px}
.dcx-l{width:100%;border-collapse:collapse;font-size:14px;background:var(--card);border-radius:14px;overflow:hidden}
.dcx-l th{text-align:start;font-size:12px;color:var(--mut);font-weight:600;padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}
.dcx-l td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.dcx-l td.n{direction:ltr;text-align:right;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.dcx-l tr[data-dco]{cursor:pointer}.dcx-l tr[data-dco]:hover td{background:rgba(138,90,131,.06)}
.dcx-d{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12.5px;font-weight:800;white-space:nowrap;direction:rtl}
.dcx-d.eq{background:#e6efd9;color:#3f5a20}.dcx-d.neg{background:#fde2df;color:#8a2218}.dcx-d.pos{background:#e3ecf7;color:#1d4f86}
.dcx-s{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.dcx-s.pend{background:#fff1dc;color:#8a5212}.dcx-s.ok{background:#e6efd9;color:#3f5a20}.dcx-s.back{background:#fde2df;color:#8a2218}
.dcx-r{display:block;font-size:12px;color:var(--mut);margin-top:2px}.dcx-r.bad{color:#8a2218;font-weight:700}
.dcx-e{margin:14px 0;padding:14px;border:1px dashed var(--line);border-radius:14px;text-align:center;color:var(--mut)}
.dcx-a{display:flex;gap:6px;flex-wrap:wrap}.dcx-a .b,.dcx-a .bt{padding:4px 10px;font-size:12.5px;min-height:0}
.dcx-bk{margin:0 0 12px;padding:12px;border-radius:14px;background:#fdeceb;border:1px solid #f3c4bf}
.dcx-bk h4{margin:0 0 6px;color:#8a2218}.dcx-bk p{margin:4px 0}
[data-theme=dark] .dcx-miss{background:#3a2c18;border-color:#6b4f25;color:#f2d9b0}[data-theme=dark] .dcx-miss .ch{background:transparent;border-color:#6b4f25}
[data-theme=dark] .dcx-ok{background:#26301b;border-color:#45562d;color:#cfe0b6}[data-theme=dark] .dcx-bk{background:#3a1f1d;border-color:#6b3430}[data-theme=dark] .dcx-bk h4{color:#f4b5ad}
[data-theme=dark] .dcx-d.eq,[data-theme=dark] .dcx-s.ok{background:#2c3a1f;color:#cfe0b6}[data-theme=dark] .dcx-d.neg,[data-theme=dark] .dcx-s.back{background:#4a2420;color:#f4b5ad}
[data-theme=dark] .dcx-d.pos{background:#1f3047;color:#b9d2f0}[data-theme=dark] .dcx-s.pend{background:#4a3519;color:#f2d1a0}
#dcxm{position:fixed;inset:0;z-index:79;display:none;align-items:center;justify-content:center;background:rgba(20,12,20,.5);padding:16px}
#dcxm.on{display:flex}#dcxm>div{background:var(--card);color:var(--ink);border-radius:18px;padding:18px;width:min(560px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);box-sizing:border-box}
#dcxm h3{margin:0 0 4px}#dcxm .sub{color:var(--mut);font-size:13px;margin:0 0 10px}
#dcxm label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}#dcxm input,#dcxm select,#dcxm textarea{width:100%;box-sizing:border-box}
#dcxm .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
#dcxm .g2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
#dcxm .nt{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;margin-bottom:6px}
#dcxm .nt button{padding:6px 10px;min-height:0}
#dcxm .sum{margin-top:12px;border-radius:14px;border:1px solid var(--line);overflow:hidden}
#dcxm .sum div{display:flex;justify-content:space-between;gap:10px;padding:7px 12px;font-size:14px;border-bottom:1px solid var(--line)}#dcxm .sum div:last-child{border-bottom:0}
#dcxm .sum b{direction:ltr;font-variant-numeric:tabular-nums}#dcxm .sum .df{font-size:16px;font-weight:800}
#dcxm .sum .df.eq{background:#e6efd9;color:#3f5a20}#dcxm .sum .df.neg{background:#fde2df;color:#8a2218}#dcxm .sum .df.pos{background:#e3ecf7;color:#1d4f86}
[data-theme=dark] #dcxm .sum .df.eq{background:#2c3a1f;color:#cfe0b6}[data-theme=dark] #dcxm .sum .df.neg{background:#4a2420;color:#f4b5ad}[data-theme=dark] #dcxm .sum .df.pos{background:#1f3047;color:#b9d2f0}
#dcxm .th{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:8px}
#dcxm .th button{all:unset;cursor:pointer;position:relative;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--line);aspect-ratio:3/4;background:var(--bg,#f4efe8)}
#dcxm .th img{width:100%;height:100%;object-fit:cover;display:block}#dcxm .th i{position:absolute;inset-inline-start:4px;top:4px;background:rgba(0,0,0,.55);color:#fff;font-style:normal;font-size:11px;padding:0 6px;border-radius:999px}
#dcxm .th .ld{display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:12px;height:100%}
#dcxm .ach{display:grid;gap:6px;margin-top:8px}#dcxm .ach button{all:unset;cursor:pointer;display:block;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}#dcxm .ach button:hover,#dcxm .ach button:focus-visible{border-color:var(--acc,#8a5a83)}#dcxm .ach b{display:block;font-size:14.5px}#dcxm .ach small{display:block;color:var(--mut);font-size:12px;margin-top:2px}
#dcxm .th .pdf{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:100%;padding:6px;box-sizing:border-box;text-align:center;background:#fdecea;color:#8a2218}#dcxm .th .pdf b{font-size:15px}#dcxm .th .pdf small{font-size:10.5px;word-break:break-all;line-height:1.3;max-height:4em;overflow:hidden}
[data-theme=dark] #dcxm .th .pdf{background:#3a1f1d;color:#f4b5ad}
#dcxm .hx{margin-top:12px;font-size:13px;color:var(--mut)}#dcxm .hx p{margin:3px 0}
#dcxm .pg{font-size:13px;color:var(--mut);margin-top:8px;min-height:18px}
@media (max-width:720px){.dcx-t{grid-template-columns:1fr 1fr}.dcx-l thead{display:none}.dcx-l,.dcx-l tbody,.dcx-l tr,.dcx-l td{display:block;width:100%;box-sizing:border-box}
 .dcx-l tr{border-bottom:1px solid var(--line);padding:8px 4px;display:grid;grid-template-columns:1fr auto;gap:2px 10px}.dcx-l td{border:0;padding:2px 8px}
 .dcx-l td.n{text-align:start}.dcx-l td[data-l]::before{content:attr(data-l) ": ";color:var(--mut);font-weight:400;font-size:12px}.dcx-l td.hm{display:none}
 #dcxm .g2{grid-template-columns:1fr}.dcx-f label{flex:1 1 40%}}
@media print{.dcx .dcx-a,.dcx-h .b,.dcx-f,.dcx-q{display:none!important}}
`;
const css=()=>{if(!g("dcx-css")){const s=document.createElement("style");s.id="dcx-css";s.textContent=CSS;document.head.appendChild(s)}};
const isWh=()=>X&&X.mode==="wh";
const canAct=()=>isWh()&&X.staff===true;
const pg=id=>{try{if(X.ping&&id)X.ping(id)}catch(e){}};
const brName=c=>{const L=(X&&X.branches?X.branches():[]).map(String);return L.find(b=>b.split("-")[0]===c)||c};
const all=()=>{const m=new Map(HIST);PB.forEach((v,k)=>m.set(k,v));LIVE.forEach((v,k)=>m.set(k,v));return m};
// ctx: {db, toast, mode:"branch"|"wh", code?, brn?, me:{e,n}, staff?:bool, branches?:()=>[...], redraw?:()=>void, ping?:(id)=>void}
export function initDay(ctx){
 stopDay();X=ctx;css();F={br:"",from:dayAgo(7),to:today(),st:"",q:"7"};
 document.addEventListener("click",onClick);document.addEventListener("change",onChange);document.addEventListener("input",onInput);
 if(X.mode==="branch"){let h=g("bday");if(!h){h=document.createElement("div");h.id="bday";h.className="dcx";const w=document.querySelector(".w"),a=g("bcus")||g("hist");if(w)w.insertBefore(h,a?a.nextSibling:null)}start()}
}
export function stopDay(){UN.forEach(f=>{try{f()}catch(e){}});UN=[];ON=false;LIVE=new Map();PB=new Map();LOADED=false;HIST=new Map();HK="";BUSY=false;OPEN="";IMGS=[];
 document.removeEventListener("click",onClick);document.removeEventListener("change",onChange);document.removeEventListener("input",onInput);
 const h=g("bday");if(h)h.remove();const m=g("dcxm");if(m)m.remove();X=null}
function start(){
 if(ON||!X)return;ON=true;const from=dayAgo(LIVE_DAYS);
 const q=X.mode==="branch"?query(collection(X.db,"dclose"),where("br","==",X.code),where("dt",">=",from)):query(collection(X.db,"dclose"),where("dt",">=",from));
 UN.push(onSnapshot(q,s=>{LIVE=new Map();LOADED=true;s.docs.forEach(d=>LIVE.set(d.id,Object.assign({id:d.id},d.data())));paint();if(OPEN&&g("dcxm")&&g("dcxm").dataset.v==="view")viewForm(OPEN,true)},()=>{if(X)X.toast("تعذّرت قراءة اليوميات. ربما لم تتحدّث القواعد بعد","er")}));
 // المستودع: كل ما ينتظر المراجعة أو مرجّع، مهما كان قديماً (قائمة صغيرة)
 if(X.mode!=="branch")UN.push(onSnapshot(query(collection(X.db,"dclose"),where("st","in",["pend","back"])),s=>{PB=new Map();s.docs.forEach(d=>PB.set(d.id,Object.assign({id:d.id},d.data())));paint()},()=>{}));
}
function paint(){if(!X)return;if(X.mode==="branch"){const h=g("bday");if(h){h.innerHTML=branchHtml();h.dataset.n=String(dayBadge())}}else if(X.redraw)X.redraw()}
// عدد ما يحتاج تصرّف الفرع (مرجّعة) للقائمة الجانبية
export const dayBadge=()=>[...LIVE.values()].filter(r=>r.st==="back").length;
export const dcPend=()=>{let n=0;all().forEach(r=>{if(r.st==="pend")n++});return n};
// ---------- الفرع ----------
function branchHtml(){
 const L=[...LIVE.values()].sort((a,b)=>String(b.dt).localeCompare(String(a.dt)));
 const back=L.filter(r=>r.st==="back"),y=dayAgo(1),t=today(),hasY=LIVE.has(X.code+"_"+y),hasT=LIVE.has(X.code+"_"+t);
 const nudge=LOADED&&!hasY?`<div class="dcx-miss">⚠️ لم تُرسل يومية أمس (<b>${E(wday(y))} ${E(dmy(y))}</b>) بعد. <button type="button" class="b p" data-dc="new" data-d="${y}">أرسلها الآن</button></div>`:"";
 const bk=back.map(r=>`<div class="dcx-bk"><h4>↩️ أُرجعت يومية ${E(wday(r.dt))} ${E(dmy(r.dt))} للتصحيح</h4><p>السبب: <b data-notr>${E(r.rv&&r.rv.note||"")}</b></p><p class="dcx-r">بواسطة <bdi data-notr>${E(r.rv&&r.rv.n||"")}</bdi> · <bdi dir="ltr">${E(dts(r.rv&&r.rv.at))}</bdi></p><div class="dcx-a" style="margin-top:8px"><button type="button" class="b p" data-dc="edit" data-i="${E(r.id)}">✏️ صحّح وأعد الإرسال</button><button type="button" class="b" data-dc="open" data-i="${E(r.id)}">عرض</button></div></div>`).join("");
 return `<div class="dcx-h"><h2>🧾 اليومية</h2><button type="button" class="b p" data-dc="new" data-d="${hasT?"":t}">➕ يومية جديدة</button></div>
 <p class="off" style="margin:0 0 12px;font-size:13px">في آخر اليوم: اطبع فاتورة الموازنة من جهاز الشبكة، وطابق الكاش في الدرج، ثم سجّل اليومية هنا مع صور الموازنة والسندات. المحاسب يراجعها ويقفلها، أو يرجعها لك بالسبب.</p>
 ${bk}${nudge}${rows(L,false)}`;
}
function rows(L,wh){
 if(!L.length)return `<div class="dcx-e">${wh?"لا توجد يوميات بهذا الفلتر":"لم تُسجَّل أي يومية بعد"}</div>`;
 return `<div style="overflow-x:auto"><table class="dcx-l"><thead><tr>${wh?"<th>الفرع</th>":""}<th>التاريخ</th><th>الشبكة</th><th>الكاش</th><th>المحصّل</th><th>صافي السيستم</th><th>الفرق</th><th>الحالة</th><th class="hm"></th></tr></thead><tbody>${L.map(r=>{
  const c=dcCalc(r),why=r.st==="back"&&r.rv&&r.rv.note?`<span class="dcx-r bad" data-notr>${E(r.rv.note)}</span>`:r.st==="ok"&&r.rv&&r.rv.n?`<span class="dcx-r">اعتمدها <span data-notr>${E(r.rv.n)}</span></span>`:"";
  const acts=[`<button type="button" class="b" data-dc="open" data-i="${E(r.id)}">فتح</button>`];
  if(!wh&&(r.st==="pend"||r.st==="back"))acts.push(`<button type="button" class="b" data-dc="edit" data-i="${E(r.id)}">تعديل</button>`);
  return `<tr data-dco="${E(r.id)}" data-tzi="dc:${E(r.id)}" data-tzs="${E(r.st)}" data-tzt="${N(r.ts)}">${wh?`<td data-notr><b>‎${E(brName(r.br))}</b></td>`:""}<td><b>${E(dmy(r.dt))}</b><span class="dcx-r">${E(wday(r.dt))}</span></td><td class="n" data-l="الشبكة">${money(c.net)}</td><td class="n" data-l="الكاش">${money(r.cash)}</td><td class="n" data-l="المحصّل">${money(c.got)}</td><td class="n" data-l="صافي السيستم">${money(c.want)}</td><td><span class="dcx-d ${diffCls(c.diff)}">${diffTxt(c.diff)}</span></td><td><span class="dcx-s ${E(r.st)}">${E(STL[r.st]||r.st)}</span>${why}</td><td class="hm"><div class="dcx-a">${acts.join("")}</div></td></tr>`}).join("")}</tbody></table></div>`;
}
// ---------- المحاسب (اللوحة) ----------
function quick(q){const t=today();F.q=q;if(q==="y"){F.from=F.to=dayAgo(1)}else if(q==="t"){F.from=F.to=t}else if(q==="7"){F.from=dayAgo(7);F.to=t}else if(q==="m"){F.from=t.slice(0,8)+"01";F.to=t}else if(q==="30"){F.from=dayAgo(30);F.to=t}}
function needHist(){
 if(!X||!F.from||F.from>=dayAgo(LIVE_DAYS))return;const k=F.from+"|"+F.to;if(HK===k)return;HK=k;
 getDocs(query(collection(X.db,"dclose"),where("dt",">=",F.from),where("dt","<=",F.to))).then(s=>{if(!X||HK!==k)return;HIST=new Map();s.docs.forEach(d=>HIST.set(d.id,Object.assign({id:d.id},d.data())));if(X.redraw)X.redraw()}).catch(()=>{HK="";if(X)X.toast("تعذّرت قراءة الفترة","er")});
}
function filtered(){
 needHist();
 return [...all().values()].filter(r=>(!F.br||r.br===F.br)&&(!F.from||r.dt>=F.from)&&(!F.to||r.dt<=F.to)&&(!F.st||r.st===F.st))
  .sort((a,b)=>(a.st==="pend"?0:a.st==="back"?1:2)-(b.st==="pend"?0:b.st==="back"?1:2)||String(b.dt).localeCompare(String(a.dt))||String(a.br).localeCompare(String(b.br)));
}
export function dcView(){
 if(!X||!isWh())return "";start();
 const codes=(X.branches?X.branches():[]).map(b=>String(b).split("-")[0]),M=all(),y=dayAgo(1);
 const pend=[...M.values()].filter(r=>r.st==="pend").length,back=[...M.values()].filter(r=>r.st==="back").length;
 const L=filtered(),P=L,sumD=R2(P.reduce((a,r)=>a+dcCalc(r).diff,0)),okN=P.filter(r=>r.st==="ok").length;
 const miss=codes.filter(c=>!M.has(c+"_"+y));
 const opt=`<option value="">كل الفروع</option>${codes.map(c=>`<option value="${E(c)}"${c===F.br?" selected":""}>‎${E(brName(c))}</option>`).join("")}`;
 const sto=[["","كل الحالات"],["pend","بانتظار المراجعة"],["back","مرجّعة"],["ok","معتمدة"]].map(s=>`<option value="${s[0]}"${s[0]===F.st?" selected":""}>${s[1]}</option>`).join("");
 const Q=[["y","أمس"],["t","اليوم"],["7","آخر 7 أيام"],["m","هذا الشهر"],["30","آخر 30 يوماً"]].map(q=>`<button type="button" class="b${F.q===q[0]?" on":""}" data-dc="q" data-q="${q[0]}">${q[1]}</button>`).join("");
 return `<div class="pan dcx"><div class="dcx-h"><h2>🧾 يومية الفروع</h2><button type="button" class="b" data-dc="csv">⬇️ إكسل</button></div>
 <div class="dcx-t"><button type="button" class="w${F.st==="pend"?" on":""}" data-dc="st" data-s="pend"><small>بانتظار المراجعة</small><b>${pend}</b></button><button type="button" class="r${F.st==="back"?" on":""}" data-dc="st" data-s="back"><small>مرجّعة للفروع</small><b>${back}</b></button><div class="k"><small>معتمدة في القائمة</small><b>${okN}</b></div><div class="${sumD<0?"r":""}"><small>صافي الفروقات في القائمة</small><b>${sumD>0?"+":""}${money(sumD)}</b></div></div>
 ${miss.length?`<details class="dcx-miss"><summary>⚠️ <b>${miss.length}</b> فرع لم يرسل يومية أمس (${E(wday(y))} ${E(dmy(y))}) — اضغط للأسماء</summary>${miss.map(c=>`<span class="ch" data-notr>‎${E(brName(c))}</span>`).join("")}</details>`:`<div class="dcx-ok">✅ كل الفروع أرسلت يومية أمس.</div>`}
 <div class="dcx-f"><label>الفرع<select data-dcf="br">${opt}</select></label><label>من<input type="date" data-dcf="from" value="${E(F.from)}" max="${today()}"></label><label>إلى<input type="date" data-dcf="to" value="${E(F.to)}" max="${today()}"></label><label>الحالة<select data-dcf="st">${sto}</select></label></div>
 <div class="dcx-q" style="margin:0 0 12px">${Q}</div>
 ${rows(L,true)}
 <p class="off" style="font-size:12.5px;margin-top:12px">الفرق = (الشبكة + الكاش + المدفوعات الأخرى) − (مبيعات السيستم − المرتجع). اضغط أي يومية لفتح صورها ومراجعتها.${canAct()?"":" المراجعة لمن معه صلاحية «يومية الفروع»."}</p></div>`;
}
// ---------- النوافذ ----------
function modal(h,v){let m=g("dcxm");if(!m){m=document.createElement("div");m.id="dcxm";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");document.body.appendChild(m)}m.innerHTML=`<div>${h}</div>`;m.className="on";m.dataset.v=v||"";return m}
const closeM=()=>{const m=g("dcxm");if(m){m.className="";m.innerHTML="";m.dataset.v=""}BUSY=false;OPEN="";IMGS=[]};
const devKey=()=>"tz_dcdev_"+(X&&X.code||"");
function devNames(){try{const a=JSON.parse(localStorage.getItem(devKey())||"[]");return Array.isArray(a)?a.filter(s=>typeof s==="string").slice(0,MAXN):[]}catch(e){return []}}
function netRow(n,a,k){return `<div class="nt" data-nr><input data-nn maxlength="30" value="${E(n)}" placeholder="اسم الجهاز" aria-label="اسم جهاز الشبكة ${k}"><input data-na type="text" inputmode="decimal" dir="ltr" value="${a===""?"":E(a)}" placeholder="0.00" aria-label="مبلغ الشبكة ${k}"><button type="button" class="b" data-dc="nrm" aria-label="حذف الجهاز">×</button></div>`}
function dayForm(r,dflt){
 IMGS=[];const dv=devNames(),net=r?r.net:(dv.length?dv:["جهاز 1"]).map(n=>({n,a:""}));
 const m=modal(`<h3>${r?"تعديل يومية "+E(wday(r.dt))+" "+E(dmy(r.dt)):"يومية جديدة"}</h3><p class="sub">من فاتورة الموازنة في جهاز الشبكة، ومطابقة الكاش في الدرج.</p>
 ${r&&r.st==="back"?`<div class="dcx-bk"><h4>↩️ سبب الإرجاع</h4><p data-notr>${E(r.rv&&r.rv.note||"")}</p></div>`:""}
 <label for="dc-d">التاريخ</label><input id="dc-d" type="date" value="${E(r?r.dt:dflt||"")}" max="${today()}" min="${dayAgo(60)}"${r?" disabled":""}>
 <label>الشبكة (مدى/فيزا) لكل جهاز</label><div id="dc-net">${net.map((x,k)=>netRow(x.n,x.a,k+1)).join("")}</div>
 <button type="button" class="b" data-dc="nadd" style="padding:4px 10px;min-height:0">➕ جهاز آخر</button>
 <div class="g2"><div><label for="dc-c">الكاش في الدرج</label><input id="dc-c" type="text" inputmode="decimal" dir="ltr" value="${r?E(r.cash):""}" placeholder="0.00"></div>
 <div><label for="dc-o">مدفوعات أخرى (تابي، تمارا، تحويل) — اختياري</label><input id="dc-o" type="text" inputmode="decimal" dir="ltr" value="${r&&r.oth?E(r.oth):""}" placeholder="0.00"></div>
 <div><label for="dc-s">إجمالي مبيعات اليوم في السيستم</label><input id="dc-s" type="text" inputmode="decimal" dir="ltr" value="${r?E(r.sys):""}" placeholder="0.00"></div>
 <div><label for="dc-r">المرتجع — اختياري</label><input id="dc-r" type="text" inputmode="decimal" dir="ltr" value="${r&&r.ret?E(r.ret):""}" placeholder="0.00"></div></div>
 <div class="sum" id="dc-sum"></div>
 <label for="dc-n">ملاحظات (اختياري، مثلاً سبب الفرق)</label><textarea id="dc-n" rows="2" maxlength="400">${r?E(r.note||""):""}</textarea>
 <label>ملفات PDF للموازنة والسندات ${r?"(أضف ملفات جديدة فقط لو تريد استبدال الحالية: "+N(r.ni)+")":"(إجباري، حتى "+MAXI+" ملفات، كل ملف حتى 3 ميجا)"}</label>
 <button type="button" class="b p" data-dc="pdf">📑 إضافة ملف PDF</button>
 <input id="dc-p" type="file" accept="application/pdf,.pdf" multiple hidden>
 <div class="th" id="dc-th"></div><div class="pg" id="dc-pg" aria-live="polite"></div>
 <div class="row"><button type="button" class="b" data-dc="mx">إلغاء</button><button type="button" class="b p" data-dc="${r?"esave":"save"}" data-i="${r?E(r.id):""}">${r&&r.st==="back"?"حفظ وإعادة الإرسال":"حفظ وإرسال للمحاسب"}</button></div>`,"form");
 sumPaint();const f=m.querySelector(r?"[data-na]":"#dc-d");if(f)setTimeout(()=>{try{f.focus()}catch(e){}},60);
}
const num=s=>{const t=String(s==null?"":s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g,".").replace(/\s/g,"");if(t==="")return 0;return /^\d+(\.\d+)?$/.test(t)?R2(+t):NaN};
function readForm(){
 const net=[];let bad=false;
 document.querySelectorAll("#dc-net [data-nr]").forEach(row=>{const n=String(row.querySelector("[data-nn]").value||"").trim().slice(0,30),a=num(row.querySelector("[data-na]").value);if(isNaN(a))bad=true;else if(a>0||n)net.push({n:n||"جهاز",a})});
 const v={dt:String(g("dc-d").value||""),net,cash:num(g("dc-c").value),oth:num(g("dc-o").value),sys:num(g("dc-s").value),ret:num(g("dc-r").value),note:String(g("dc-n").value||"").trim().slice(0,400)};
 return {v,bad:bad||[v.cash,v.oth,v.sys,v.ret].some(x=>isNaN(x))};
}
function sumPaint(){const s=g("dc-sum");if(!s)return;const f=readForm().v,c=dcCalc({net:f.net,cash:N(f.cash),oth:N(f.oth),sys:N(f.sys),ret:N(f.ret)});
 s.innerHTML=`<div><span>الشبكة</span><b>${money(c.net)}</b></div><div><span>المحصّل (شبكة + كاش + أخرى)</span><b>${money(c.got)}</b></div><div><span>صافي السيستم (المبيعات − المرتجع)</span><b>${money(c.want)}</b></div><div class="df ${diffCls(c.diff)}"><span>الفرق</span><b>${diffTxt(c.diff)}</b></div>`}
// (v249، محمد: «المرفقات في اليوميات PDF فقط») المرفق = {k:"pdf", d: data URL, nm, sz}. الصور القديمة تُعرض كما هي.
const pdfTile=(nm,sz)=>`<span class="pdf"><b>📄 PDF</b><small data-notr>${E(nm||"")}</small>${sz?`<small dir="ltr">${sz<104858?Math.max(1,Math.round(sz/1024))+" KB":(sz/1048576).toFixed(1)+" MB"}</small>`:""}</span>`;
function thumbs(){const t=g("dc-th");if(!t)return;t.innerHTML=IMGS.map((x,k)=>`<button type="button" data-dc="irm" data-k="${k}" title="إزالة الملف">${pdfTile(x.nm,x.sz)}<i>${k+1} ×</i></button>`).join("")}
const fnm=s=>String(s||"").replace(/[<>"'&\\/:*?|\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g,"").trim().slice(0,80);
const PDF_ONE=1150000,PDF_PART=1100000,PDF_MAX=3145728;// مستند واحد لحد 1.15 مليون حرف، وإلا أجزاء 1.1 مليون (حتى 4)، والملف حتى 3 ميجا
function addPdfs(files){
 const L=[].slice.call(files||[]);let bad=0,big=0;
 Promise.all(L.map(f=>new Promise(ok=>{if(!/\.pdf$/i.test(f.name)&&f.type!=="application/pdf"){bad++;return ok(null)}if(f.size>PDF_MAX){big++;return ok(null)}
  const rd=new FileReader();rd.onload=()=>{const d=String(rd.result||"").replace(/^data:[^;,]*;base64,/,"data:application/pdf;base64,");
   if(d.indexOf("data:application/pdf;base64,JVBERi0")!==0){bad++;return ok(null)}ok({k:"pdf",d,nm:fnm(f.name)||"ملف.pdf",sz:f.size})};
  rd.onerror=()=>{bad++;ok(null)};rd.readAsDataURL(f)}))).then(R=>{
  const b0=IMGS.length;R.filter(Boolean).forEach(x=>IMGS.push(x));if(IMGS.length>MAXI){IMGS=IMGS.slice(0,MAXI);X.toast("الحد "+MAXI+" ملفات","er")}
  if(big)X.toast("ملف PDF أكبر من 3 ميجا. صغّره ثم أرفقه","er");else if(bad)X.toast("الملف ليس PDF صالحاً","er");
  if(IMGS.length!==b0)thumbs()})}
// الرفع: الملف الصغير مستند واحد، والكبير أجزاء أولاً ثم الرأس {nm, pn, sz}. ترجع عدد الأجزاء لكل ملف (0 = مستند واحد)
async function upImgs(id){const P=g("dc-pg"),out=[];for(let k=0;k<IMGS.length;k++){const x=IMGS[k],nm=`جاري رفع الملف ${k+1} من ${IMGS.length}`;
  if(x.d.length<=PDF_ONE){if(P)P.textContent=nm+"…";await withTimeout(setDoc(doc(X.db,"dcimg",id+"_"+(k+1)),{pdf:x.d,nm:x.nm}),30000);out.push(0);continue}
  const b=x.d.slice(x.d.indexOf(",")+1),pn=Math.ceil(b.length/PDF_PART);
  for(let j=1;j<=pn;j++){if(P)P.textContent=`${nm} (جزء ${j} من ${pn})…`;await withTimeout(setDoc(doc(X.db,"dcimg",id+"_"+(k+1)+"p"+j),{d:b.slice((j-1)*PDF_PART,j*PDF_PART)}),45000)}
  await withTimeout(setDoc(doc(X.db,"dcimg",id+"_"+(k+1)),{nm:x.nm,pn,sz:x.sz}),30000);out.push(pn)}
 if(P)P.textContent="";return out}
// بعد التعديل: امسح أجزاء قديمة لم تعد مستخدمة (ملف استُبدل بأصغر، أو ملفات زادت عن العدد الجديد)
function cleanParts(id,keep,n0){const J=[];for(let k=1;k<=Math.max(n0,keep.length);k++)for(let j=(keep[k-1]||0)+1;j<=4;j++)J.push(deleteDoc(doc(X.db,"dcimg",id+"_"+k+"p"+j)).catch(()=>{}));return Promise.all(J)}
async function fail(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما أُقفلت اليومية أو لم تتحدّث القواعد بعد":FAIL_MSG[w]||"تعذّر الحفظ","er")}
function check(v,isNew){
 if(isNew&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.dt)||v.dt>today()||v.dt<dayAgo(60))){X.toast("اختر تاريخ اليومية (ليس في المستقبل)","er");return false}
 if(v.net.length>MAXN){X.toast("الحد "+MAXN+" أجهزة","er");return false}
 if(!(v.sys>0)&&!(dcCalc(v).got>0)){X.toast("اكتب مبالغ اليوم (الشبكة أو الكاش ومبيعات السيستم)","er");return false}
 if(!(v.sys>0)){X.toast("اكتب إجمالي مبيعات اليوم في السيستم","er");return false}
 return true;
}
const body=(v,o)=>{const d={net:v.net,cash:N(v.cash),sys:N(v.sys)};if(v.oth>0||o&&o.oth!=null)d.oth=N(v.oth);if(v.ret>0||o&&o.ret!=null)d.ret=N(v.ret);if(v.note||o&&o.note!=null)d.note=v.note;return d};
// نافذة العرض (الفرع والمحاسب)
function viewForm(id,keep){
 const r=all().get(id);if(!r){closeM();return}OPEN=id;const c=dcCalc(r);
 const prev=keep&&g("dc-imgs")?g("dc-imgs").innerHTML:"",note=keep&&g("dc-rn")?g("dc-rn").value:"";
 const acts=[];
 if(canAct()&&r.st==="pend"){acts.push(`<button type="button" class="b p" data-dc="ok" data-i="${E(id)}">✅ اعتماد وإقفال</button>`);acts.push(`<button type="button" class="b" data-dc="back" data-i="${E(id)}">↩️ إرجاع للفرع</button>`)}
 if(canAct()&&r.st==="ok")acts.push(`<button type="button" class="b" data-dc="back" data-i="${E(id)}">↩️ إعادة فتح وإرجاع للفرع</button>`);
 if(!isWh()&&(r.st==="pend"||r.st==="back"))acts.push(`<button type="button" class="b p" data-dc="edit" data-i="${E(id)}">✏️ تعديل</button>`);
 const hx=(Array.isArray(r.hx)?r.hx:[]).map(h=>`<p>↩️ <bdi dir="ltr">${E(dts(h.at))}</bdi> · <bdi data-notr>${E(h.n||"")}</bdi>: <span data-notr>${E(h.note||"")}</span></p>`).join("");
 modal(`<h3>🧾 يومية ${isWh()?`<span data-notr>‎${E(brName(r.br))}</span> · `:""}${E(wday(r.dt))} ${E(dmy(r.dt))}</h3>
 <p class="sub"><span class="dcx-s ${E(r.st)}">${E(STL[r.st]||r.st)}</span> · سجّلها <bdi data-notr>${E(r.by&&r.by.n||"")}</bdi> · <bdi dir="ltr">${E(dts(r.upd||r.ts))}</bdi>${r.st==="ok"&&r.rv?` · اعتمدها <bdi data-notr>${E(r.rv.n||"")}</bdi> <bdi dir="ltr">${E(dts(r.rv.at))}</bdi>`:""}</p>
 ${r.st==="back"&&r.rv&&r.rv.note?`<div class="dcx-bk"><h4>↩️ سبب الإرجاع</h4><p data-notr>${E(r.rv.note)}</p></div>`:""}
 <div class="sum">${(r.net||[]).map(x=>`<div><span data-notr>${E(x.n||"جهاز")}</span><b>${money(x.a)}</b></div>`).join("")}<div><span>الكاش في الدرج</span><b>${money(r.cash)}</b></div>${N(r.oth)?`<div><span>مدفوعات أخرى</span><b>${money(r.oth)}</b></div>`:""}
 <div><span><b>المحصّل</b></span><b>${money(c.got)}</b></div><div><span>مبيعات السيستم</span><b>${money(r.sys)}</b></div>${N(r.ret)?`<div><span>المرتجع</span><b dir="ltr">−${money(r.ret)}</b></div>`:""}<div><span><b>صافي السيستم</b></span><b>${money(c.want)}</b></div>
 <div class="df ${diffCls(c.diff)}"><span>الفرق</span><b>${diffTxt(c.diff)}</b></div></div>
 ${r.note?`<label>ملاحظة الفرع</label><p style="margin:0" data-notr>${E(r.note)}</p>`:""}
 <label>المرفقات (${N(r.ni)})</label><div class="th" id="dc-imgs">${prev||Array.from({length:N(r.ni)},(_,k)=>`<button type="button" data-dc="img" data-i="${E(id)}" data-k="${k+1}"><span class="ld">جاري التحميل…</span><i>${k+1}</i></button>`).join("")}</div>
 ${hx?`<div class="hx"><b>سجل الإرجاع</b>${hx}</div>`:""}
 ${acts.length&&isWh()?`<label for="dc-rn">سبب الإرجاع (يظهر للفرع)</label><textarea id="dc-rn" rows="2" maxlength="300" placeholder="مثال: الكاش ناقص 50 ريال، أو صورة الموازنة غير واضحة">${E(note)}</textarea>`:""}
 <div class="row"><button type="button" class="b" data-dc="mx">إغلاق</button>${acts.join("")}</div>`,"view");
 if(!prev||IMGK!==id+":"+N(r.ni)+":"+N(r.upd))loadImgs(id,N(r.ni),N(r.upd));
}
const ICACHE=new Map();
async function loadImgs(id,n,upd){IMGK=id+":"+n+":"+upd;
 for(let k=1;k<=n;k++){const key=id+"_"+k+"@"+upd;let d=ICACHE.get(key);
  if(!d){try{const s=await getDoc(doc(X.db,"dcimg",id+"_"+k)),v=s.exists()?s.data():null;d=v&&v.pdf?{pdf:String(v.pdf),nm:String(v.nm||"")}:v&&v.pn?{pn:+v.pn,nm:String(v.nm||""),sz:+v.sz||0}:v&&v.img?{img:String(v.img)}:null;if(d){if(ICACHE.size>40)ICACHE.delete(ICACHE.keys().next().value);ICACHE.set(key,d)}}catch(e){d=null}}
  if(OPEN!==id)return;const b=document.querySelector(`#dc-imgs [data-k="${k}"]`);if(b)b.innerHTML=d&&(d.pdf||d.pn)?`${pdfTile(d.nm,d.sz)}<i>${k}</i>`:d?`<img alt="صورة ${k}" src="${E(d.img)}"><i>${k}</i>`:`<span class="ld">غير موجودة</span><i>${k}</i>`}}
// (v249) فتح PDF: مستند واحد، أو تجميع الأجزاء p1..pn ثم التأكد أن أوله %PDF- (openBytes يتأكد)
async function openPdf(d,base){try{let b64="";if(d.pn){X.toast("جاري تحميل الملف…");for(let j=1;j<=d.pn;j++){const s=await getDoc(doc(X.db,"dcimg",base+"p"+j));if(!s.exists())throw new Error("part");b64+=String(s.data().d||"")}}else b64=d.pdf.split(",")[1]||"";
 const bin=atob(b64),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);openBytes(u8,d.nm||"yomia.pdf",X.toast,b64)}catch(e){X.toast("تعذّر فتح الملف","er")}}
function csv(){
 const L=filtered(),q=v=>{let s=String(v==null?"":v);if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 const rows=[["الفرع","التاريخ","اليوم","أجهزة الشبكة","الشبكة","الكاش","مدفوعات أخرى","المحصّل","مبيعات السيستم","المرتجع","صافي السيستم","الفرق","الحالة","سجّلها","راجعها","سبب الإرجاع","ملاحظة الفرع","عدد الصور"]].concat(L.map(r=>{const c=dcCalc(r);
  return [brName(r.br),dmy(r.dt),wday(r.dt),(r.net||[]).map(x=>(x.n||"")+": "+N(x.a)).join(" | "),c.net,N(r.cash),N(r.oth),c.got,N(r.sys),N(r.ret),c.want,c.diff,STL[r.st]||r.st,r.by&&r.by.n||"",r.rv&&r.rv.n||"",r.st==="back"&&r.rv?r.rv.note||"":"",r.note||"",N(r.ni)]}));
 const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=u;a.download=`tasooma-daily-${F.br||"all"}-${F.from}-${F.to}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function onClick(e){
 const t=e.target.closest&&e.target.closest("[data-dc],[data-dco]");if(!t||!X)return;if(!t.closest("#bday,#dcxm,.dcx"))return;
 if(t.dataset.dco!==undefined&&!e.target.closest("button")){viewForm(t.dataset.dco);return}
 const a=t.dataset.dc,id=t.dataset.i,M=all(),r=id?M.get(id):null;
 if(a==="new"){const d=t.dataset.d||"";if(d&&LIVE.has(X.code+"_"+d)){const o=LIVE.get(X.code+"_"+d);if(o.st==="ok")viewForm(o.id);else dayForm(o)}else dayForm(null,d);return}
 if(a==="mx"){closeM();return}
 if(a==="open"&&r){viewForm(id);return}
 if(a==="edit"&&r&&!isWh()){dayForm(r);return}
 if(a==="nadd"){const w=g("dc-net");if(w&&w.querySelectorAll("[data-nr]").length<MAXN){const k=w.querySelectorAll("[data-nr]").length+1;w.insertAdjacentHTML("beforeend",netRow("جهاز "+k,"",k));const f=w.lastElementChild.querySelector("[data-na]");if(f)f.focus()}else X.toast("الحد "+MAXN+" أجهزة","er");return}
 if(a==="nrm"){const row=t.closest("[data-nr]");if(row)row.remove();sumPaint();return}
 if(a==="irm"){IMGS.splice(+t.dataset.k,1);thumbs();return}
 if(a==="img"){const d=r?ICACHE.get(id+"_"+t.dataset.k+"@"+N(r.upd)):null;if(d&&(d.pdf||d.pn)){openPdf(d,id+"_"+t.dataset.k);return}const b=t.querySelector("img");if(b&&b.src)zoomOpen(b.src,"يومية "+(r?brName(r.br)+" "+dmy(r.dt):""));return}
 if(a==="pdf"){if(IMGS.length>=MAXI){X.toast("الحد "+MAXI+" ملفات","er");return}const i=g("dc-p");if(i)i.click();return}
 if(a==="q"){quick(t.dataset.q);if(X.redraw)X.redraw();return}
 if(a==="st"){F.st=F.st===t.dataset.s?"":t.dataset.s;if(F.st&&F.st!=="ok"){F.from="";F.to="";F.q=""}if(X.redraw)X.redraw();return}
 if(a==="csv"){csv();return}
 if(BUSY)return;
 if(a==="save"||a==="esave"){
  const {v,bad}=readForm();if(bad){X.toast("اكتب المبالغ أرقاماً فقط","er");return}
  const isNew=a==="save";if(!check(v,isNew))return;
  if(isNew&&!IMGS.length){X.toast("ملف PDF للموازنة والسندات إجباري","er");return}
  BUSY=true;t.disabled=true;
  try{
   if(isNew){const did=X.code+"_"+v.dt;
    const ex=await withTimeout(getDoc(doc(X.db,"dclose",did)),15000);if(ex.exists()){BUSY=false;t.disabled=false;X.toast("يومية هذا اليوم مسجّلة بالفعل. افتحها من القائمة وعدّلها","er");return}
    await upImgs(did);
    await withTimeout(setDoc(doc(X.db,"dclose",did),Object.assign({br:X.code,dt:v.dt},body(v),{ni:IMGS.length,by:{e:X.me.e,n:String(X.me.n||"").slice(0,60)},ts:Date.now(),st:"pend"})),20000);
    try{localStorage.setItem(devKey(),JSON.stringify(v.net.map(x=>x.n).slice(0,MAXN)))}catch(x){}
    closeM();X.toast("✅ أُرسلت اليومية للمحاسب");pg(did)}
   else if(r){const n0=N(r.ni);let ni=n0;
    let keep=[];if(IMGS.length){keep=await upImgs(id);ni=IMGS.length}
    await withTimeout(updateDoc(doc(X.db,"dclose",id),Object.assign(body(v,r),{ni,upd:Date.now(),st:"pend"})),20000);
    for(let k=ni+1;k<=n0;k++){try{await deleteDoc(doc(X.db,"dcimg",id+"_"+k))}catch(x){}}
    if(IMGS.length||n0>ni)await cleanParts(id,keep,n0);
    const was=r.st;closeM();X.toast(was==="back"?"✅ أُعيد إرسال اليومية للمحاسب":"✅ عُدّلت اليومية");if(was==="back")pg(id)}
  }catch(x){BUSY=false;t.disabled=false;const P=g("dc-pg");if(P)P.textContent="";fail(x)}
  return}
 if((a==="ok"||a==="back")&&r&&canAct()){
  let note="";if(a==="back"){note=String(g("dc-rn")&&g("dc-rn").value||"").trim().slice(0,300);if(note.length<2){X.toast("اكتب سبب الإرجاع ليصل للفرع","er");const f=g("dc-rn");if(f)f.focus();return}}
  else if(Math.abs(dcCalc(r).diff)>=0.005&&!confirm(`في هذه اليومية ${diffTxt(dcCalc(r).diff)} ريال. اعتمادها وإقفالها رغم الفرق؟`))return;
  const rv=Object.assign({e:X.me.e,n:String(X.me.n||"").slice(0,60),at:Date.now()},note?{note}:{}),u={st:a,rv};
  if(a==="back")u.hx=(Array.isArray(r.hx)?r.hx:[]).concat([{at:Date.now(),n:rv.n,note,st:r.st}]).slice(-30);
  BUSY=true;t.disabled=true;
  try{await withTimeout(updateDoc(doc(X.db,"dclose",id),u),15000);if(HIST.has(id)){HK="";needHist()}closeM();X.toast(a==="ok"?"✅ اعتُمدت وأُقفلت، وأُبلغ الفرع":"↩️ أُرجعت للفرع بالسبب");pg(id)}catch(x){BUSY=false;t.disabled=false;fail(x)}
  return}
}
function onChange(e){
 const t=e.target;if(!X||!t)return;
 if(t.id==="dc-p"){addPdfs(t.files);t.value="";return}
 if(t.matches&&t.matches("[data-dcf]")){const k=t.dataset.dcf;F[k]=String(t.value||"");if(k==="from"||k==="to")F.q="";if(F.from&&F.to&&F.from>F.to){const z=F.from;F.from=F.to;F.to=z}if(X.redraw)X.redraw()}
}
function onInput(e){const t=e.target;if(!X||!t||!t.closest||!t.closest("#dcxm"))return;if(t.matches("[data-na],#dc-c,#dc-o,#dc-s,#dc-r"))sumPaint()}
