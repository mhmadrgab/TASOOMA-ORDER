// 🚢 أوامر الشراء والحاويات (15 نوفمبر 2026، طلب محمد): مسؤول المشتريات (staff.p.po، حساب مالوش غير المديول ده) بيعمل أمر الشراء
// ويتابع المورد بالجوال ويحدّث المرحلة بنفسه لحد ما الحاوية تبقى "متجهة للمستودع". الاستلام في المستودع للمالك واللي المالك
// اداله "📦 استلام الحاويات" (staff.p.rcv، زي أحمد سعيد) بس. والمنصة بتحسب كل أمر/حاوية لكل مورد وصل في كام يوم،
// علشان الشركة تعرف تطلب من كل مورد قبل احتياجها بقد إيه.
// البيانات: po/{id} (الأمر + سجل المراحل h)، posup/{id} (الموردين)، poatt/{id}/x/2..10 (المرفقات، att.js).
// القواعد: supabase/002_rules.sql (po_ok / po_rcv_ok / posup_ok). الإشعارات: ping(...,pos) ← السيرفر onPo.
import {collection,doc,getDoc,setDoc,updateDoc,deleteDoc,onSnapshot,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {multiPick,saveExtras,loadExtras,dropExtras} from "./att.js";
import {zoomGallery} from "./zoom.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const DAY=864e5;
// المراحل بالترتيب (الحاوية من أمر الشراء لحد المستودع). wh = الاستلام (للمالك و rcv بس)، x = ملغي
export const STG=[
 ["new","أمر شراء جديد","📋","#8a5a83","أُنشئ أمر الشراء"],
 ["sent","أُرسل للمورد","📤","#7d6b91","وصل الأمر إلى المورد"],
 ["conf","أكّد المورد","🤝","#9a6b2f","أكّد المورد الأمر والسعر"],
 ["prod","قيد التجهيز عند المورد","🏭","#b7791f","يجهّز المورد البضاعة أو يصنّعها"],
 ["ready","جاهز للشحن","📦","#c46a1a","البضاعة جاهزة بانتظار الحاوية"],
 ["ship","تم الشحن (في البحر)","🚢","#0b6bdb","غادرت الحاوية ميناء التحميل"],
 ["port","وصل ميناء الوصول","⚓","#0a8fa3","وصلت الحاوية إلى الميناء في السعودية"],
 ["cust","التخليص الجمركي","🧾","#7b4bb3","الحاوية لدى الجمارك"],
 ["out","متجه إلى المستودع","🚚","#2f7d62","خرجت من الميناء في الطريق إلى المستودع"],
 ["wh","وصل المستودع","✅","#6f7d45","تم الاستلام في المستودع"]
];
const SI={};STG.forEach((s,i)=>{SI[s[0]]=i});// (من غير Object.fromEntries: الموبايلات القديمة)
const XST=["x","ملغي","❌","#e5372b"];
const stOf=k=>k==="x"?XST:(STG[SI[k]]||STG[0]);
export const CTY=[["tr","تركيا","🇹🇷"],["cn","الصين","🇨🇳"],["es","إسبانيا","🇪🇸"],["it","إيطاليا","🇮🇹"],["ot","أخرى","🌍"]];
const ctyOf=k=>CTY.find(c=>c[0]===k)||CTY[4];
const PODS=["الدمام","جدة","الرياض (الميناء الجاف)","أخرى"];
const CTYPE=[["20","20 قدم"],["40","40 قدم"],["40HC","40 قدم عالية (HC)"],["LCL","شحنة جزئية (LCL)"]];
const CUR=["USD","EUR","CNY","TRY","SAR"];
const INC=["FOB","CIF","CFR","EXW","DAP","DDP"];
let X=null,A=new Map(),S=new Map(),un=[],F={st:"open",sup:"",cty:"",q:""},V="list",PK=null,busy=false,openH=new Set();
const all=()=>[...A.values()].sort((a,b)=>N(b.dt||b.ts)-N(a.dt||a.ts));
const canEdit=()=>!!X&&X.edit===true;
const canRcv=()=>!!X&&X.rcv===true;
const isOpen=r=>r.st!=="wh"&&r.st!=="x";
const days=ms=>Math.round(ms/DAY);
const dstr=t=>N(t)?new Date(N(t)).toLocaleDateString("en-CA"):"";
const dms=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?new Date(v+"T12:00:00").getTime():0;// تاريخ اليوم (12 الظهر علشان فرق التوقيت)
const today=()=>new Date().toLocaleDateString("en-CA");
const who=()=>({e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)});
const dd=n=>n==null?"—":`${Math.round(n)} يوم`;

// ---------- الحسابات ----------
// تاريخ كل مرحلة (آخر مرة اتسجّلت فيها). البداية = تاريخ أمر الشراء، والوصول = تاريخ الاستلام
export function tl(r){const m={};(Array.isArray(r.h)?r.h:[]).forEach(x=>{if(x&&SI[x.s]!=null&&N(x.at))m[x.s]=N(x.at)});
 m.new=N(r.dt)||m.new||N(r.ts);if(r.rcv&&N(r.rcv.at))m.wh=N(r.rcv.at);else delete m.wh;return m}
// المدد بالأيام: الإجمالي، والتجهيز عند المورد (للشحن)، والبحر، والميناء والجمارك، والطريق للمستودع
export function segs(r){const m=tl(r),d=(a,b)=>m[a]&&m[b]&&m[b]>=m[a]?(m[b]-m[a])/DAY:null;
 return {total:d("new","wh"),prep:d("new","ship"),sea:d("ship","port"),port:m.out?d("port","out"):d("port","wh"),inland:m.out?d("out","wh"):null,
  late:r.eta&&m.port?(m.port-dms(r.eta))/DAY:null}}
const avg=L=>{const v=L.filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
// إحصائيات مجموعة أوامر مستلمة (مورد أو دولة)
function agg(L){const S2=L.map(segs),T=S2.map(s=>s.total).filter(x=>x!=null);
 const a=avg(T),mx=T.length?Math.max(...T):null,mn=T.length?Math.min(...T):null;
 // المقترح: المتوسط + نص المسافة لأطول مرة، علشان تبقى في الأمان من غير مبالغة
 return {n:L.length,cn:L.reduce((s,r)=>s+Math.max(1,N(r.cn)),0),avg:a,min:mn,max:mx,plan:a==null?null:Math.ceil(a+(mx-a)/2),
  prep:avg(S2.map(s=>s.prep)),sea:avg(S2.map(s=>s.sea)),port:avg(S2.map(s=>s.port)),inland:avg(S2.map(s=>s.inland)),late:avg(S2.map(s=>s.late))}}
const supDone=sid=>all().filter(r=>r.sup===sid&&r.st==="wh");
// المتوقع لأمر مفتوح: تاريخ الأمر + متوسط المورد (لو عنده أوامر وصلت قبل كده)
function expect(r){const a=agg(supDone(r.sup));if(a.avg==null)return null;const t=N(r.dt||r.ts)+a.avg*DAY;return {t,late:Date.now()-t>DAY?days(Date.now()-t):0,n:a.n}}

// ---------- الشكل ----------
const CSS=`
.po-h{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:4px 0 14px}
.po-h h2{margin:0;font-size:22px}.po-h .po-hb{display:flex;gap:8px;flex-wrap:wrap}
.po-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:14px;background:var(--field,#f2e9dd);margin-bottom:14px}
.po-tabs button{font:inherit;font-weight:700;font-size:14.5px;border:0;background:transparent;color:var(--mut);border-radius:10px;padding:8px 16px;cursor:pointer}
.po-tabs button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.po-k{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}
@media (max-width:900px){.po-k{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.po-k{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.po-k button{padding:10px;border-radius:14px}.po-k button b{font-size:22px}.po-k button small{font-size:12px;line-height:1.35}}
.po-k button{font:inherit;text-align:start;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;padding:12px 14px;cursor:pointer;display:grid;gap:2px;--c:#636a75;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.po-k button b{font-size:26px;font-variant-numeric:tabular-nums;color:var(--c)}
.po-k button small{color:var(--mut);font-size:13px}
.po-k button.on{border-color:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 30%,transparent)}
.po-f{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.po-f .ch{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px}
.po-f .ch.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.po-f select,.po-f input{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:7px 10px;min-width:0;max-width:100%}
.po-c{--c:#8a5a83;background:var(--card);border:1px solid var(--line);border-inline-start:6px solid var(--c);border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 26px -18px rgba(40,30,10,.45)}
.po-c .p-hd{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;padding:12px 14px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 11%,transparent),transparent)}
.po-c .p-hd small bdi{white-space:nowrap}
.po-c .p-hd b{font-size:18px}.po-c .p-hd small{display:block;color:var(--mut);font-size:13px;margin-top:2px}
.p-cy{display:inline-block;font-size:12px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:0 8px;vertical-align:middle}
.po-c .p-st{background:var(--c);color:#fff;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700;white-space:nowrap}
.po-c .p-tr{display:flex;gap:3px;padding:0 14px 10px}
.po-c .p-tr i{flex:1;height:6px;border-radius:99px;background:var(--line)}
.po-c .p-tr i.on{background:var(--c)}
.po-c .p-bd{padding:0 14px 12px;display:grid;gap:8px}
.po-c .p-ds{font-size:15.5px;font-weight:600;white-space:pre-wrap;word-break:break-word}
.po-c .p-tg{display:flex;flex-wrap:wrap;gap:6px}
.po-c .p-tg span{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px;font-size:13px;background:var(--field,#f2e9dd);max-width:100%;overflow-wrap:anywhere}
.po-c .p-nt{border-radius:12px;padding:8px 12px;font-size:14px;background:var(--field,#f2e9dd)}
.po-c .p-nt.bad{background:color-mix(in srgb,#e5372b 12%,transparent)}
.po-c .p-nt.ok{background:color-mix(in srgb,#6f7d45 13%,transparent)}
.po-c .p-nt.wr{background:color-mix(in srgb,#e8740c 13%,transparent)}
.po-c details.p-hi{border-top:1px dashed var(--line);padding:8px 14px}
.po-c details.p-hi summary{cursor:pointer;font-size:14px;color:var(--mut);font-weight:600}
.po-c .p-hl{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.po-c .p-hl li{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13.5px;align-items:start}
.po-c .p-hl li>span:first-child{font-size:16px;line-height:1.3}
.po-c .p-hl small{color:var(--mut)}
.po-c .p-ac{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--field,#f2e9dd) 55%,transparent)}
.po-c .p-ac button,.po-c .p-ac a{font:inherit;font-weight:600;font-size:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:8px 14px;cursor:pointer;text-decoration:none}
.po-c .p-ac .p{background:#2f7d62;border-color:#2f7d62;color:#fff}
.po-c .p-ac .g{background:#6f7d45;border-color:#6f7d45;color:#fff}
.po-c .p-ac .r{color:#c4362b}
.po-e{text-align:center;color:var(--mut);padding:40px 12px;border:1.5px dashed var(--line);border-radius:16px}
.po-s{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.po-s h3{margin:0 0 4px;font-size:17px}.po-s p.hint{margin:0 0 10px;color:var(--mut);font-size:13.5px}
.po-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.po-t{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}
.po-t th,.po-t td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:start;white-space:nowrap}
.po-t th{font-size:12.5px;color:var(--mut);font-weight:600}
.po-t td.n{font-variant-numeric:tabular-nums}
.po-t .pl{background:color-mix(in srgb,#2f7d62 14%,transparent);color:var(--ink);border-radius:999px;padding:2px 10px;font-weight:700}
.po-bar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:var(--line);min-width:120px}
.po-bar i{display:block;height:100%}
.po-lg{display:flex;flex-wrap:wrap;gap:10px;font-size:12.5px;color:var(--mut);margin-top:8px}.po-lg span{display:inline-flex;align-items:center;gap:5px}.po-lg i{width:10px;height:10px;border-radius:3px;display:inline-block}
#pom{display:none;position:fixed;inset:0;z-index:82;background:rgba(0,0,0,.55);overflow:auto;padding:16px}
#pom.on{display:block}
#pom>.mk{max-width:600px;margin:4vh auto;background:var(--card);color:var(--ink);border-radius:20px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
#pom h3{margin:0 0 12px;font-size:19px}
#pom label{display:block;font-size:13.5px;color:var(--mut);margin:12px 0 5px}
#pom input,#pom textarea,#pom select{font:inherit;width:100%;border:1.5px solid var(--line);background:var(--field,#f2e9dd);color:var(--ink);border-radius:12px;padding:10px 12px;min-width:0}
#pom textarea{min-height:76px;resize:vertical}
#pom .row{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
@media (max-width:520px){#pom .row{grid-template-columns:1fr}}
#pom .chs{display:flex;flex-wrap:wrap;gap:6px}
#pom .chs button{font:inherit;font-size:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}
#pom .chs button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
#pom .chs button.pa{opacity:.55}
#pom .act{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
#pom .act button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:10px 18px;cursor:pointer}
#pom .act button.p{background:#2f7d62;border-color:#2f7d62;color:#fff}
#pom .act button.g{background:#6f7d45;border-color:#6f7d45;color:#fff}
#pom .act button.r{background:#e5372b;border-color:#e5372b;color:#fff}
#pom .act button:disabled{opacity:.6;cursor:progress}
#pom .sub{border:1px dashed var(--line);border-radius:14px;padding:4px 12px 12px;margin-top:12px}
#pom .sl{display:grid;gap:8px;margin:0 0 12px}
#pom .sl>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--line);border-radius:14px;padding:10px 12px}
#pom .sl b{font-size:15.5px}#pom .sl small{color:var(--mut);font-size:12.5px;display:block}
#pom .sl .sp{flex:1;min-width:150px}
#pom .sl a,#pom .sl button{font:inherit;font-size:13.5px;font-weight:600;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:6px 10px;cursor:pointer;text-decoration:none}
#pom .warn{background:color-mix(in srgb,#e8740c 14%,transparent);border-radius:12px;padding:8px 12px;font-size:13.5px;margin-top:10px}
`;
function css(){if(!g("po-css")){const s=document.createElement("style");s.id="po-css";s.textContent=CSS;document.head.appendChild(s)}}

// ---------- البداية ----------
// ctx: {db, toast, me:{e,n}, owner, edit (مسؤول المشتريات/المالك), rcv (يستلم في المستودع), redraw(), active(), ping(ids), badge()}
export function initPo(ctx){
 stopPo();X=ctx;css();
 const err=()=>{if(X&&X.toast)X.toast("تعذر قراءة أوامر الشراء")};
 const re=()=>{if(!X)return;if(X.badge)X.badge();if(X.redraw&&X.active&&X.active())X.redraw()};
 un.push(onSnapshot(collection(X.db,"po"),sn=>{A=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));re()},err));
 un.push(onSnapshot(collection(X.db,"posup"),sn=>{S=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));re();if(g("pom")&&g("pom").dataset.v==="sups")supList()},err));
}
export function stopPo(){un.forEach(f=>f());un=[];A=new Map();S=new Map();closeM();X=null}
// الرقم على التبويب: للي بيستلم = الحاويات المتجهة للمستودع، ولمسؤول المشتريات = الأوامر المتأخرة عن المعتاد
export const poCount=()=>{if(!X)return 0;const L=[...A.values()];
 if(canRcv())return L.filter(r=>r.st==="out").length;
 if(canEdit())return L.filter(r=>isOpen(r)&&(()=>{const e=expect(r);return e&&e.late})()).length;return 0};

// ---------- الصفحة ----------
export function poView(){
 if(!X)return "";
 const L=all();
 const head=`<div class="po-h"><h2>🚢 أوامر الشراء والحاويات</h2><div class="po-hb">${canEdit()?`<button class="bt p" data-po="new" type="button">➕ أمر شراء جديد</button>`:""}<button class="bt" data-po="sups" type="button">🏭 الموردون (${S.size})</button></div></div>
 <div class="po-tabs" role="tablist"><button type="button" role="tab" data-po="v" data-v="list" class="${V==="list"?"on":""}">📋 الأوامر</button><button type="button" role="tab" data-po="v" data-v="stats" class="${V==="stats"?"on":""}">📊 مدة الوصول لكل مورد</button></div>`;
 return head+(V==="stats"?statsView(L):listView(L));
}
function listView(L){
 const cnt=f=>L.filter(f).length,mon=new Date();mon.setDate(1);mon.setHours(0,0,0,0);
 const K=[["open","مفتوحة","#8a5a83",r=>isOpen(r)],["sea","في البحر","#0b6bdb",r=>r.st==="ship"],["port","في الميناء والجمارك","#0a8fa3",r=>r.st==="port"||r.st==="cust"],["out","متجهة للمستودع","#2f7d62",r=>r.st==="out"],["whm","وصلت هذا الشهر","#6f7d45",r=>r.st==="wh"&&r.rcv&&N(r.rcv.at)>=mon.getTime()]];
 const sups=[...S.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
 const q=F.q.trim().toLowerCase();
 const fk=K.find(k=>k[0]===F.st);
 const Vv=L.filter(r=>(F.st==="all"||(fk?fk[3](r):r.st===F.st))&&(!F.sup||r.sup===F.sup)&&(!F.cty||r.cty===F.cty)&&(!q||[r.no,r.supn,r.desc,r.ref,r.bl,r.cnos,r.line].join(" ").toLowerCase().includes(q)));
 return `<div class="po-k">${K.map(([k,l,c,f])=>`<button type="button" data-po="fst" data-v="${k}" class="${F.st===k?"on":""}" style="--c:${c}"><b>${cnt(f)}</b><small>${l}</small></button>`).join("")}</div>
 <div class="po-f">${[["open","المفتوحة"],["all","الكل"],["wh","المستلمة"],["x","الملغاة"]].map(([k,l])=>`<button type="button" class="ch ${F.st===k?"on":""}" data-po="fst" data-v="${k}">${l}</button>`).join("")}
 <select id="po-fs" aria-label="المورد"><option value="">كل الموردين</option>${sups.map(s=>`<option value="${E(s.id)}" ${F.sup===s.id?"selected":""}>${E(s.n)}</option>`).join("")}</select>
 <select id="po-fc" aria-label="الدولة"><option value="">كل الدول</option>${CTY.map(c=>`<option value="${c[0]}" ${F.cty===c[0]?"selected":""}>${c[1]}</option>`).join("")}</select>
 <input id="po-q" type="search" placeholder="بحث: رقم الأمر، المورد، البوليصة، الحاوية..." value="${E(F.q)}" style="flex:1;min-width:170px"></div>
 <div id="po-list">${Vv.length?Vv.map(card).join(""):`<div class="po-e">🚢<br>${L.length?"لا توجد أوامر بهذا الفلتر":canEdit()?"لا توجد أوامر شراء بعد. ابدأ بـ «➕ أمر شراء جديد»":"لا توجد أوامر شراء بعد"}</div>`}</div>`;
}
function card(r){
 const s=stOf(r.st),i=SI[r.st],c=ctyOf(r.cty),m=tl(r),age=days(Date.now()-N(r.dt||r.ts)),open=isOpen(r);
 const ex=open?expect(r):null,sg=r.st==="wh"?segs(r):null;
 const tags=[`📦 ${Math.max(1,N(r.cn))} × ${E((CTYPE.find(x=>x[0]===r.ctype)||["",r.ctype||""])[1])}`];
 if(N(r.val))tags.push(`💵 <bdi dir="ltr">${N(r.val).toLocaleString("en-US")} ${E(r.cur||"")}</bdi>`);
 if(r.inc)tags.push(`<bdi dir="ltr">${E(r.inc)}</bdi>`);
 if(r.pol&&r.pod)tags.push(`⚓ ${E(r.pol)} ← ${E(r.pod)}`);else if(r.pod)tags.push(`⚓ ميناء الوصول: ${E(r.pod)}`);else if(r.pol)tags.push(`⚓ ميناء التحميل: ${E(r.pol)}`);
 if(r.etd)tags.push(`🗓 الإبحار: <bdi dir="ltr">${E(r.etd)}</bdi>`);
 if(r.eta)tags.push(`🗓 الوصول المتوقع للميناء: <bdi dir="ltr">${E(r.eta)}</bdi>`);
 if(r.line)tags.push(`🚢 ${E(r.line)}${r.ves?` · ${E(r.ves)}`:""}`);
 if(r.bl)tags.push(`🧾 البوليصة: <bdi dir="ltr">${E(r.bl)}</bdi>`);
 if(r.cnos)tags.push(`📦 الحاويات: <bdi dir="ltr">${E(r.cnos)}</bdi>`);
 if(r.ref)tags.push(`📋 فاتورة المورد: <bdi dir="ltr">${E(r.ref)}</bdi>`);
 let ac="";
 if(open&&canEdit())ac+=`<button class="p" data-po="up" data-id="${E(r.id)}" type="button">⏭ تحديث المرحلة</button><button data-po="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button>`;
 if(open&&canRcv())ac+=`<button class="g" data-po="rcv" data-id="${E(r.id)}" type="button">✅ تأكيد الاستلام في المستودع</button>`;
 const sup=S.get(r.sup),ph=sup&&sup.ph?String(sup.ph).replace(/[^\d+]/g,""):"";
 if(ph)ac+=`<a href="tel:${E(ph)}">📞 المورد</a><a href="https://wa.me/${E(ph.replace(/^\+/,""))}" target="_blank" rel="noopener">💬 واتساب</a>`;
 ac+=`<button data-po="att" data-id="${E(r.id)}" type="button">📎 المرفقات</button>`;
 if(open&&canEdit())ac+=`<button class="r" data-po="cx" data-id="${E(r.id)}" type="button">إلغاء الأمر</button>`;
 if(X.owner)ac+=`<button class="r" data-po="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`;
 const H=(Array.isArray(r.h)?r.h:[]).slice().sort((a,b)=>N(a.at)-N(b.at)||N(a.ts)-N(b.ts));
 const hist=H.map(x=>{const t=stOf(x.s);return `<li><span>${t[2]}</span><div><b>${t[1]}</b> · <bdi dir="ltr">${dstr(x.at)}</bdi><br><small>${E(x.n||"")}${x.note?` · <span data-notr>${E(x.note)}</span>`:""}</small></div></li>`}).join("")
  +(r.rcv?`<li><span>✅</span><div><b>استُلم في المستودع</b> · <bdi dir="ltr">${dstr(r.rcv.at)}</bdi><br><small>${E(r.rcv.n||"")}${r.rcv.note?` · <span data-notr>${E(r.rcv.note)}</span>`:""}</small></div></li>`:"");
 return `<div class="po-c" style="--c:${s[3]}"><div class="p-hd"><div><b>🏭 <bdi data-notr>${E(r.supn||"")}</bdi></b> <span class="p-cy">${E(c[1])}</span><small><bdi dir="ltr">${E(r.no||"")}</bdi> · أمر بتاريخ <bdi dir="ltr">${dstr(r.dt||r.ts)}</bdi>${open?(age<1?" · اليوم":` · منذ ${age} يوم`):""}</small></div><span class="p-st">${s[2]} ${s[1]}</span></div>
 ${r.st==="x"?"":`<div class="p-tr" aria-label="المرحلة ${i+1} من ${STG.length}">${STG.map((x,k)=>`<i class="${k<=i?"on":""}" title="${E(x[1])}"></i>`).join("")}</div>`}
 <div class="p-bd"><div class="p-ds" data-notr>${E(r.desc||"")}</div><div class="p-tg">${tags.map(t=>`<span>${t}</span>`).join("")}</div>
 ${r.note?`<div class="p-nt" data-notr>🗒 ${E(r.note)}</div>`:""}
 ${ex?ex.late?`<div class="p-nt wr">⚠️ متأخر عن المعتاد بنحو ${ex.late} يوم<br><small>الموعد المعتاد: <bdi dir="ltr">${dstr(ex.t)}</bdi> · عدد الأوامر السابقة: ${ex.n}</small></div>`:`<div class="p-nt">🕒 الوصول المتوقع للمستودع: <bdi dir="ltr">${dstr(ex.t)}</bdi><br><small>حسب متوسط هذا المورد · عدد الأوامر السابقة: ${ex.n}</small></div>`:""}
 ${r.st==="out"&&canRcv()?`<div class="p-nt ok">🚚 الحاوية في الطريق إليكم. عند وصولها اضغط زر تأكيد الاستلام.</div>`:""}
 ${sg?`<div class="p-nt ok"><b>✅ وصل المستودع خلال ${dd(sg.total)}</b>${sg.prep!=null||sg.sea!=null?` · عند المورد ${dd(sg.prep)} · في البحر ${dd(sg.sea)} · الميناء والجمارك ${dd(sg.port)}${sg.inland!=null?` · الطريق للمستودع ${dd(sg.inland)}`:""}`:""}${r.rcv&&r.rcv.ok===false?`<br>⚠️ استُلم بملاحظات`:""}</div>`:""}
 ${r.st==="x"&&r.x?`<div class="p-nt bad">❌ أُلغي: <span data-notr>${E(r.x.note||"")}</span></div>`:""}</div>
 ${H.length||r.rcv?`<details class="p-hi" data-po-h="${E(r.id)}" ${openH.has(r.id)?"open":""}><summary>📜 سجل المراحل (${H.length+(r.rcv?1:0)})</summary><ul class="p-hl">${hist}</ul></details>`:""}
 <div class="p-ac">${ac}</div></div>`;
}

// ---------- التحليل: كل مورد بيوصل في قد إيه ----------
function statsView(L){
 const done=L.filter(r=>r.st==="wh");
 if(!done.length)return `<div class="po-e">📊<br>لا توجد حاويات وصلت المستودع بعد.<br>بعد أول استلام ستظهر هنا مدة الوصول لكل مورد وكل دولة، وكم يوماً قبل احتياجكم يجب أن تطلبوا.</div>`;
 const bySup=new Map();done.forEach(r=>{const k=r.sup||r.supn;if(!bySup.has(k))bySup.set(k,[]);bySup.get(k).push(r)});
 const sups=[...bySup.entries()].map(([k,rs])=>({k,n:(S.get(k)||{}).n||rs[0].supn,cty:(S.get(k)||{}).cty||rs[0].cty,a:agg(rs)})).sort((a,b)=>(a.a.avg||0)-(b.a.avg||0));
 const ctys=CTY.map(c=>({c,a:agg(done.filter(r=>(r.cty||"ot")===c[0]))})).filter(x=>x.a.n);
 const COL={prep:"#b7791f",sea:"#0b6bdb",port:"#7b4bb3",inland:"#2f7d62"};
 const bar=a=>{const t=(a.prep||0)+(a.sea||0)+(a.port||0)+(a.inland||0);if(!t)return "";return `<div class="po-bar" title="عند المورد ${dd(a.prep)} · في البحر ${dd(a.sea)} · الميناء والجمارك ${dd(a.port)} · الطريق للمستودع ${dd(a.inland)}">${["prep","sea","port","inland"].map(k=>a[k]?`<i style="width:${(a[k]/t*100).toFixed(1)}%;background:${COL[k]}"></i>`:"").join("")}</div>`};
 const lg=`<div class="po-lg"><span><i style="background:${COL.prep}"></i>عند المورد حتى الشحن</span><span><i style="background:${COL.sea}"></i>في البحر</span><span><i style="background:${COL.port}"></i>الميناء والجمارك</span><span><i style="background:${COL.inland}"></i>الطريق للمستودع</span></div>`;
 const recent=done.slice().sort((a,b)=>N(b.rcv&&b.rcv.at)-N(a.rcv&&a.rcv.at)).slice(0,40);
 return `<div class="po-s"><h3>🏭 مدة الوصول لكل مورد</h3><p class="hint">من تاريخ أمر الشراء حتى الاستلام في المستودع. «اطلب قبل» = كم يوماً قبل احتياجكم يجب أن يخرج الأمر لهذا المورد (المتوسط مع هامش أمان نحو أطول مرة).</p>
 <div class="po-tw"><table class="po-t"><thead><tr><th>المورد</th><th>الأوامر</th><th>الحاويات</th><th>المتوسط</th><th>الأسرع</th><th>الأبطأ</th><th>تأخير عن موعد الميناء</th><th>توزيع المدة</th><th>اطلب قبل</th></tr></thead><tbody>
 ${sups.map(x=>`<tr><td><b><bdi data-notr>${E(x.n)}</bdi></b> <small class="p-cy">${ctyOf(x.cty)[1]}</small></td><td class="n">${x.a.n}</td><td class="n">${x.a.cn}</td><td class="n"><b>${dd(x.a.avg)}</b></td><td class="n">${dd(x.a.min)}</td><td class="n">${dd(x.a.max)}</td><td class="n">${x.a.late==null?"—":x.a.late>0.5?`⚠️ ${dd(x.a.late)}`:"في الموعد"}</td><td>${bar(x.a)}</td><td><span class="pl">${dd(x.a.plan)}</span></td></tr>`).join("")}
 </tbody></table></div>${lg}</div>
 <div class="po-s"><h3>🌍 حسب الدولة</h3><div class="po-tw"><table class="po-t"><thead><tr><th>الدولة</th><th>الأوامر</th><th>الحاويات</th><th>المتوسط</th><th>الأسرع</th><th>الأبطأ</th><th>عند المورد</th><th>في البحر</th><th>الميناء والجمارك</th><th>اطلب قبل</th></tr></thead><tbody>
 ${ctys.map(x=>`<tr><td><b>${x.c[1]}</b></td><td class="n">${x.a.n}</td><td class="n">${x.a.cn}</td><td class="n"><b>${dd(x.a.avg)}</b></td><td class="n">${dd(x.a.min)}</td><td class="n">${dd(x.a.max)}</td><td class="n">${dd(x.a.prep)}</td><td class="n">${dd(x.a.sea)}</td><td class="n">${dd(x.a.port)}</td><td><span class="pl">${dd(x.a.plan)}</span></td></tr>`).join("")}
 </tbody></table></div></div>
 <div class="po-s"><h3>📦 كل أمر وصل: كم استغرق</h3><p class="hint">أحدث الأوامر المستلمة (${recent.length}) <button class="bt s" data-po="csv" type="button">⬇️ إكسل</button></p>
 <div class="po-tw"><table class="po-t"><thead><tr><th>رقم الأمر</th><th>المورد</th><th>الحاويات</th><th>تاريخ الأمر</th><th>تاريخ الاستلام</th><th>الإجمالي</th><th>عند المورد</th><th>في البحر</th><th>الميناء والجمارك</th><th>الطريق للمستودع</th></tr></thead><tbody>
 ${recent.map(r=>{const s=segs(r);return `<tr><td><bdi dir="ltr">${E(r.no)}</bdi></td><td><bdi data-notr>${E(r.supn)}</bdi></td><td class="n">${Math.max(1,N(r.cn))} × ${E(r.ctype||"")}</td><td class="n"><bdi dir="ltr">${dstr(r.dt||r.ts)}</bdi></td><td class="n"><bdi dir="ltr">${dstr(r.rcv&&r.rcv.at)}</bdi></td><td class="n"><b>${dd(s.total)}</b></td><td class="n">${dd(s.prep)}</td><td class="n">${dd(s.sea)}</td><td class="n">${dd(s.port)}</td><td class="n">${dd(s.inland)}</td></tr>`}).join("")}
 </tbody></table></div></div>`;
}
function csv(){
 const rows=[["رقم الأمر","المورد","الدولة","عدد الحاويات","النوع","تاريخ الأمر","تاريخ الشحن","وصول الميناء","تاريخ الاستلام","الإجمالي (يوم)","عند المورد","في البحر","الميناء والجمارك","الطريق","البوليصة","أرقام الحاويات"]];
 all().filter(r=>r.st==="wh").forEach(r=>{const m=tl(r),s=segs(r),R=x=>x==null?"":Math.round(x);
  rows.push([r.no,r.supn,ctyOf(r.cty)[1],Math.max(1,N(r.cn)),r.ctype||"",dstr(r.dt||r.ts),dstr(m.ship),dstr(m.port),dstr(m.wh),R(s.total),R(s.prep),R(s.sea),R(s.port),R(s.inland),r.bl||"",r.cnos||""])});
 // خانة بتبدأ بـ = + - @ ممكن إكسل يشغّلها كمعادلة: بنحط قبلها ' (اسم مورد أو بوليصة مكتوبة بإيد حد)
 const q=v=>{let s=String(v==null?"":v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const b=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(b);a.download=`أوامر-الشراء-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}

// ---------- النوافذ ----------
function box(){let m=g("pom");if(!m){m=document.createElement("div");m.id="pom";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(html,v){const m=box();m.innerHTML=`<div class="mk">${html}</div>`;m.dataset.v=v||"";m.className="on"}
function closeM(){const m=g("pom");if(m){m.className="";m.innerHTML="";m.dataset.v=""}PK=null;busy=false}
const err=async e=>{const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد أو تغيّرت الحالة":FAIL_MSG[w],"er")};
const btnBusy=(sel,t)=>{const b=document.querySelector(sel);if(b){b.disabled=!!t;if(t){b.dataset.t=b.dataset.t||b.textContent;b.textContent=t}else if(b.dataset.t)b.textContent=b.dataset.t}};

// أمر شراء جديد / تعديل
function form(id){
 const r=id?A.get(id):null;if(id&&!r)return;
 const sups=[...S.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
 const o=r||{dt:Date.now(),cn:1,ctype:"40HC",cur:"USD",pod:"الدمام"};
 openM(`<h3>${r?"✏️ تعديل أمر الشراء":"➕ أمر شراء جديد"}</h3>
 <label>المورد *</label><div style="display:flex;gap:8px"><select id="po-su" style="flex:1"><option value="">اختر المورد</option>${sups.map(s=>`<option value="${E(s.id)}" ${o.sup===s.id?"selected":""}>${E(s.n)} (${ctyOf(s.cty)[1]})</option>`).join("")}</select><button type="button" class="bt" data-po="supnew" style="white-space:nowrap">➕ مورد</button></div>
 ${sups.length?"":`<div class="warn">أضف المورد أولاً من زر «مورد» بجانب القائمة (الاسم والدولة ورقم الجوال).</div>`}
 <div class="row"><div><label>تاريخ أمر الشراء *</label><input id="po-dt" type="date" value="${E(dstr(o.dt||o.ts))}" max="${today()}"></div>
 <div><label>رقم فاتورة المورد (PI)</label><input id="po-ref" maxlength="60" dir="ltr" value="${E(o.ref||"")}"></div></div>
 <label>البضاعة *</label><textarea id="po-ds" maxlength="1000" placeholder="مثلاً: أحذية رجالي شتوي، 4,800 زوج">${E(o.desc||"")}</textarea>
 <div class="row"><div><label>عدد الحاويات *</label><input id="po-cn" inputmode="numeric" value="${E(o.cn||1)}"></div>
 <div><label>نوع الحاوية</label><select id="po-ct">${CTYPE.map(([k,l])=>`<option value="${k}" ${o.ctype===k?"selected":""}>${l}</option>`).join("")}</select></div></div>
 <div class="row"><div><label>قيمة الأمر (اختياري)</label><input id="po-val" inputmode="decimal" dir="ltr" value="${N(o.val)?E(o.val):""}"></div>
 <div><label>العملة</label><select id="po-cur">${CUR.map(c=>`<option ${o.cur===c?"selected":""}>${c}</option>`).join("")}</select></div></div>
 <div class="row"><div><label>شرط التسليم (Incoterm)</label><select id="po-inc"><option value="">—</option>${INC.map(c=>`<option ${o.inc===c?"selected":""}>${c}</option>`).join("")}</select></div>
 <div><label>ميناء الوصول</label><select id="po-pod">${PODS.map(p=>`<option ${o.pod===p?"selected":""}>${E(p)}</option>`).join("")}</select></div></div>
 <label>ميناء التحميل (اختياري)</label><input id="po-pol" maxlength="60" placeholder="مثلاً: إسطنبول، نينغبو، فالنسيا، جنوة" value="${E(o.pol||"")}">
 ${r?`<div class="sub"><label>بيانات الشحن</label><div class="row"><div><label>شركة الشحن</label><input id="po-line" maxlength="60" value="${E(o.line||"")}"></div><div><label>اسم السفينة</label><input id="po-ves" maxlength="60" value="${E(o.ves||"")}"></div></div>
 <div class="row"><div><label>رقم البوليصة (B/L)</label><input id="po-bl" maxlength="60" dir="ltr" value="${E(o.bl||"")}"></div><div><label>أرقام الحاويات</label><input id="po-cnos" maxlength="200" dir="ltr" value="${E(o.cnos||"")}"></div></div>
 <div class="row"><div><label>تاريخ الإبحار (ETD)</label><input id="po-etd" type="date" value="${E(o.etd||"")}"></div><div><label>الوصول المتوقع للميناء (ETA)</label><input id="po-eta" type="date" value="${E(o.eta||"")}"></div></div></div>`:""}
 <label>ملاحظة (اختياري)</label><textarea id="po-nt" maxlength="500">${E(o.note||"")}</textarea>
 ${r?"":`<label>مرفقات: فاتورة المورد أو صور (اختياري)</label><div id="po-mp"></div>`}
 <div class="act"><button class="p" data-po="save" ${r?`data-id="${E(r.id)}"`:""} type="button">${r?"حفظ التعديل":"إنشاء أمر الشراء"}</button><button data-po="close" type="button">رجوع</button></div>`,"form");
 if(!r)PK=multiPick(g("po-mp"),{w:1600,cap:280000,max:9,toast:X.toast});
}
function readForm(){
 const sid=g("po-su").value,s=S.get(sid);if(!s){X.toast("اختر المورد");return null}
 const dt=dms(g("po-dt").value);if(!dt||dt>Date.now()+DAY){X.toast("اكتب تاريخ أمر الشراء");return null}
 const desc=g("po-ds").value.trim().slice(0,1000);if(!desc){X.toast("اكتب البضاعة");g("po-ds").focus();return null}
 const cn=Math.round(N(toEn(g("po-cn").value)));if(cn<1||cn>50){X.toast("عدد الحاويات من 1 إلى 50");return null}
 const val=Math.round(N(toEn(g("po-val").value).replace(/,/g,""))*100)/100;
 const d={sup:sid,supn:String(s.n).slice(0,80),cty:CTY.some(c=>c[0]===s.cty)?s.cty:"ot",dt,desc,cn,ctype:g("po-ct").value,cur:g("po-cur").value,pod:g("po-pod").value};
 const opt=(k,id,mx)=>{const el=g(id);if(!el)return;const v=el.value.trim().slice(0,mx);if(v)d[k]=v;else d[k]=null};
 opt("ref","po-ref",60);opt("pol","po-pol",60);opt("note","po-nt",500);opt("inc","po-inc",10);
 opt("line","po-line",60);opt("ves","po-ves",60);opt("bl","po-bl",60);opt("cnos","po-cnos",200);opt("etd","po-etd",10);opt("eta","po-eta",10);
 if(val>0)d.val=val;else d.val=null;
 return d;
}
const clean=d=>{const o={};Object.keys(d).forEach(k=>{if(d[k]!=null&&d[k]!=="")o[k]=d[k]});return o};
async function save(id){
 if(busy)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور والملفات");return}
 const d=readForm();if(!d)return;
 busy=true;btnBusy('[data-po="save"]',"⏳ جاري الحفظ...");
 try{
  if(id){const r=A.get(id);if(!r)throw new Error("gone");
   // التعديل: من غير ما نلمس المرحلة والسجل. الحقول اللي اتمسحت بتتشال
   const patch={upd:Date.now()};Object.keys(d).forEach(k=>{patch[k]=d[k]==null?null:d[k]});
   const nx={...r,...patch};delete nx.id;Object.keys(nx).forEach(k=>{if(nx[k]==null)delete nx[k]});
   await withTimeout(setDoc(doc(X.db,"po",id),nx),15000);busy=false;X.toast("✅ حُفظ التعديل");closeM();return}
  const ts=Date.now(),t=new Date(ts),p=n=>String(n).padStart(2,"0");
  const ref=doc(collection(X.db,"po"));
  const IMS=PK?PK.imgs():[],PDFS=PK?PK.files():[],ATT=IMS.concat(PDFS);
  const o=clean({...d,no:`PO-${String(t.getFullYear()).slice(2)}${p(t.getMonth()+1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}`,st:"new",ts,by:who(),
   h:[{s:"new",at:d.dt,ts,...who()}]});
  if(ATT.length)o.att=1;
  await withTimeout(setDoc(ref,o),20000);
  let bad=0;if(ATT.length){btnBusy('[data-po="save"]',`⏳ رفع المرفقات (${ATT.length})...`);bad=await saveExtras(X.db,"poatt",ref.id,ATT,2)}
  busy=false;if(X.ping)X.ping([ref.id]);
  X.toast(bad?`أُنشئ الأمر، لكن تعذّر رفع ${bad} من المرفقات`:"✅ أُنشئ أمر الشراء "+o.no,bad?"er":undefined);closeM();
 }catch(e){busy=false;btnBusy('[data-po="save"]',"");err(e)}
}
// تحديث المرحلة (مسؤول المشتريات): المرحلة + تاريخ حصولها الفعلي + ملاحظة، ولو "تم الشحن" بيانات الشحن
let UPS="";
function upForm(id){const r=A.get(id);if(!r)return;const cur=SI[r.st];
 const nx=STG.find((x,k)=>k>cur&&x[0]!=="wh");UPS=nx?nx[0]:"";
 const m=tl(r),last=Math.max(...Object.values(m).filter(Boolean));
 openM(`<h3>⏭ تحديث المرحلة · <bdi dir="ltr">${E(r.no)}</bdi></h3><p style="margin:0;color:var(--mut)">🏭 <bdi data-notr>${E(r.supn)}</bdi> · الآن: ${stOf(r.st)[2]} ${stOf(r.st)[1]}</p>
 <label>المرحلة الجديدة *</label><div class="chs" id="po-stg">${STG.filter(x=>x[0]!=="wh"&&x[0]!==r.st).map(x=>`<button type="button" data-s="${x[0]}" class="${x[0]===UPS?"on":""} ${SI[x[0]]<cur?"pa":""}">${x[2]} ${x[1]}</button>`).join("")}</div>
 <p id="po-sd" style="margin:8px 0 0;color:var(--mut);font-size:13.5px"></p><div id="po-sh"></div>
 <label>متى حصلت؟ *</label><input id="po-at" type="date" value="${today()}" max="${today()}">
 <label>ملاحظة (اختياري)</label><input id="po-un" maxlength="200" placeholder="مثلاً: المورد أرسل صورة البوليصة على الواتساب">
 <div class="warn" id="po-bk" hidden>⚠️ اخترت مرحلة سابقة. استخدمها فقط لتصحيح خطأ.</div>
 <p style="margin:12px 0 0;color:var(--mut);font-size:13px">آخر تاريخ مسجّل: <bdi dir="ltr">${dstr(last)}</bdi>. «وصل المستودع» يسجّله المسؤولون عن الاستلام فقط.</p>
 <div class="act"><button class="p" data-po="upsave" data-id="${E(id)}" type="button">حفظ المرحلة</button><button data-po="close" type="button">رجوع</button></div>`,"up");
 const paint=()=>{g("po-stg").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.s===UPS));g("po-bk").hidden=!(SI[UPS]<cur);g("po-sd").textContent=UPS?stOf(UPS)[4]||"":"";
  // بيانات الشحن بتظهر لما المرحلة "تم الشحن" ولسه مش مكتوبة
  g("po-sh").innerHTML=UPS==="ship"?`<div class="sub"><label>بيانات الشحن (اختياري، تُستكمل لاحقاً من «تعديل»)</label><div class="row"><div><label>شركة الشحن</label><input id="po-line" maxlength="60" value="${E(r.line||"")}"></div><div><label>رقم البوليصة (B/L)</label><input id="po-bl" maxlength="60" dir="ltr" value="${E(r.bl||"")}"></div></div>
   <label>أرقام الحاويات</label><input id="po-cnos" maxlength="200" dir="ltr" value="${E(r.cnos||"")}"><label>الوصول المتوقع للميناء (ETA)</label><input id="po-eta" type="date" value="${E(r.eta||"")}"></div>`:UPS==="conf"?`<label>رقم فاتورة المورد (PI)</label><input id="po-ref" maxlength="60" dir="ltr" value="${E(r.ref||"")}">`:""};
 g("po-stg").onclick=e=>{const b=e.target.closest("[data-s]");if(!b)return;UPS=b.dataset.s;paint()};paint();
}
async function upSave(id){const r=A.get(id);if(!r||busy)return;
 if(!UPS||UPS==="wh"||SI[UPS]==null){X.toast("اختر المرحلة");return}
 const at=dms(g("po-at").value);if(!at||at>Date.now()+DAY){X.toast("اختر التاريخ (لا يمكن أن يكون في المستقبل)");return}
 if(at<N(r.dt)){X.toast("التاريخ قبل تاريخ أمر الشراء");return}
 const note=g("po-un").value.trim().slice(0,200);
 const h=(Array.isArray(r.h)?r.h:[]).slice(-38);const e={s:UPS,at,ts:Date.now(),...who()};if(note)e.note=note;h.push(e);
 const patch={st:UPS,h,upd:Date.now()};
 const v=(k,id,mx)=>{const el=g(id);if(el){const x=el.value.trim().slice(0,mx);if(x)patch[k]=x}};
 v("line","po-line",60);v("bl","po-bl",60);v("cnos","po-cnos",200);v("eta","po-eta",10);v("ref","po-ref",60);
 if(UPS==="ship"&&!r.etd)patch.etd=dstr(at);
 busy=true;btnBusy('[data-po="upsave"]',"⏳ جاري الحفظ...");
 try{await withTimeout(updateDoc(doc(X.db,"po",id),patch),15000);busy=false;if(X.ping)X.ping([id]);X.toast(`✅ ${stOf(UPS)[1]}`);closeM()}
 catch(x){busy=false;btnBusy('[data-po="upsave"]',"");err(x)}
}
// الاستلام في المستودع (المالك و rcv بس)
let RCVOK=true;
function rcvForm(id){const r=A.get(id);if(!r)return;RCVOK=true;
 openM(`<h3>✅ تأكيد الاستلام في المستودع</h3><p style="margin:0;color:var(--mut)"><bdi dir="ltr">${E(r.no)}</bdi> · 🏭 <bdi data-notr>${E(r.supn)}</bdi> · 📦 ${Math.max(1,N(r.cn))} × ${E(r.ctype||"")}${r.cnos?` · <bdi dir="ltr">${E(r.cnos)}</bdi>`:""}</p>
 <label>تاريخ الوصول للمستودع *</label><input id="po-ra" type="date" value="${today()}" max="${today()}">
 <label>حالة البضاعة</label><div class="chs" id="po-rk"><button type="button" data-k="1" class="on">✅ سليمة</button><button type="button" data-k="0">⚠️ بملاحظات</button></div>
 <label>ملاحظة</label><textarea id="po-rn" maxlength="500" placeholder="مثلاً: كرتونتان تالفتان، أو نقص في الكمية"></textarea>
 <label>صور الاستلام (اختياري)</label><div id="po-rp"></div>
 <div class="act"><button class="g" data-po="rcvsave" data-id="${E(id)}" type="button">تأكيد الاستلام</button><button data-po="close" type="button">رجوع</button></div>`,"rcv");
 PK=multiPick(g("po-rp"),{w:1600,cap:280000,max:9,toast:X.toast});
 g("po-rk").onclick=e=>{const b=e.target.closest("[data-k]");if(!b)return;RCVOK=b.dataset.k==="1";g("po-rk").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b))};
}
async function rcvSave(id){const r=A.get(id);if(!r||busy)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const at=dms(g("po-ra").value);if(!at||at>Date.now()+DAY){X.toast("اختر تاريخ الوصول");return}
 if(at<N(r.dt)){X.toast("التاريخ قبل تاريخ أمر الشراء");return}
 const note=g("po-rn").value.trim().slice(0,500);if(!RCVOK&&!note){X.toast("اكتب الملاحظات");g("po-rn").focus();return}
 const rcv={at,ok:RCVOK,ts:Date.now(),...who()};if(note)rcv.note=note;
 const ATT=PK?PK.imgs().concat(PK.files()):[];
 busy=true;btnBusy('[data-po="rcvsave"]',"⏳ جاري الحفظ...");
 try{await withTimeout(updateDoc(doc(X.db,"po",id),{st:"wh",rcv,upd:Date.now(),...(ATT.length?{att:1}:{})}),15000);
  if(ATT.length){const ex=await loadExtras(X.db,"poatt",id),st=ex.length?Math.max(...ex.map(x=>x.k))+1:2;const bad=await saveExtras(X.db,"poatt",id,ATT,st);if(bad)X.toast(`سُجّل الاستلام، لكن تعذّر رفع ${bad} من الصور`,"er")}
  busy=false;if(X.ping)X.ping([id]);const s=segs({...r,rcv});X.toast(`✅ استُلم في المستودع${s.total!=null?` · مدة الوصول: ${Math.round(s.total)} يوم`:""}`);closeM()}
 catch(x){busy=false;btnBusy('[data-po="rcvsave"]',"");err(x)}
}
function cxForm(id){const r=A.get(id);if(!r)return;
 openM(`<h3>إلغاء أمر الشراء</h3><p style="margin:0;color:var(--mut)"><bdi dir="ltr">${E(r.no)}</bdi> · 🏭 <bdi data-notr>${E(r.supn)}</bdi></p>
 <label>سبب الإلغاء *</label><textarea id="po-xn" maxlength="300"></textarea>
 <div class="act"><button class="r" data-po="cxsave" data-id="${E(id)}" type="button">إلغاء الأمر</button><button data-po="close" type="button">رجوع</button></div>`,"cx");g("po-xn").focus()}
async function cxSave(id){if(busy)return;const note=g("po-xn").value.trim().slice(0,300);if(!note){X.toast("اكتب سبب الإلغاء");return}
 busy=true;try{await withTimeout(updateDoc(doc(X.db,"po",id),{st:"x",x:{at:Date.now(),note,...who()},upd:Date.now()}),15000);busy=false;X.toast("أُلغي أمر الشراء");closeM()}
 catch(x){busy=false;err(x)}}
async function del(id){const r=A.get(id);if(!r)return;
 if(!confirm(`حذف أمر الشراء ${r.no} نهائياً مع مرفقاته؟ لا يمكن استعادته.`))return;
 try{await dropExtras(X.db,"poatt",id);await withTimeout(deleteDoc(doc(X.db,"po",id)),15000);X.toast("حُذف أمر الشراء")}catch(x){err(x)}}
// المرفقات: عرض + إضافة (مسؤول المشتريات طول ما الأمر مفتوح، واللي بيستلم)
async function showAtt(id){const r=A.get(id);if(!r)return;
 let L=[];try{L=await loadExtras(X.db,"poatt",id)}catch(e){}
 const add=(isOpen(r)&&(canEdit()||canRcv()))||X.owner;
 openM(`<h3>📎 المرفقات · <bdi dir="ltr">${E(r.no)}</bdi></h3>
 ${L.length?`<div class="act" style="margin:0 0 6px"><button class="p" data-po="gal" data-id="${E(id)}" type="button">🖼 عرض المرفقات (${L.length})</button></div>`:`<p style="color:var(--mut)">لا توجد مرفقات بعد.</p>`}
 ${add&&L.length<9?`<label>إضافة مرفقات (فاتورة، بوليصة، شهادة منشأ، صور)</label><div id="po-ap"></div><div class="act"><button class="p" data-po="attsave" data-id="${E(id)}" type="button">رفع</button><button data-po="close" type="button">إغلاق</button></div>`:`<div class="act"><button data-po="close" type="button">إغلاق</button></div>`}`,"att");
 if(add&&L.length<9)PK=multiPick(g("po-ap"),{w:1600,cap:280000,max:9-L.length,toast:X.toast});
 showAtt.L=L;
}
async function attSave(id){if(busy)return;if(!PK){closeM();return}if(PK.busy()){X.toast("انتظر حتى تنتهي الصور والملفات");return}
 const ATT=PK.imgs().concat(PK.files());if(!ATT.length){X.toast("اختر صورة أو ملفاً واحداً على الأقل");return}
 busy=true;btnBusy('[data-po="attsave"]',"⏳ جاري الرفع...");
 try{const ex=await loadExtras(X.db,"poatt",id),st=ex.length?Math.max(...ex.map(x=>x.k))+1:2;const bad=await saveExtras(X.db,"poatt",id,ATT,st);
  const r=A.get(id);if(r&&!r.att&&ATT.length>bad&&isOpen(r)&&canEdit())try{await updateDoc(doc(X.db,"po",id),{att:1})}catch(e){}
  busy=false;X.toast(bad?`تعذّر رفع ${bad} من المرفقات`:"✅ رُفعت المرفقات",bad?"er":undefined);showAtt(id)}
 catch(x){busy=false;err(x)}}
function gallery(id){const r=A.get(id),L=showAtt.L||[];if(!L.length)return;
 zoomGallery(L.map(x=>({src:x.src,nm:x.nm,del:"doc:"+x.path})),`${r?r.no:""} · ${r?r.supn:""}`,0)}

// ---------- الموردون ----------
function supList(){
 const L=[...S.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
 openM(`<h3>🏭 الموردون (${L.length})</h3>
 ${canEdit()?`<div class="act" style="margin:0 0 12px"><button class="p" data-po="supnew" type="button">➕ مورد جديد</button><button data-po="close" type="button">إغلاق</button></div>`:""}
 <div class="sl">${L.length?L.map(s=>{const a=agg(supDone(s.id)),open=all().filter(r=>r.sup===s.id&&isOpen(r)).length,ph=String(s.ph||"").replace(/[^\d+]/g,"");
  return `<div><div class="sp"><b><bdi data-notr>${E(s.n)}</bdi></b><small>${E(ctyOf(s.cty)[1])}${s.ct?` · ${E(s.ct)}`:""}${ph?` · <bdi dir="ltr">${E(s.ph)}</bdi>`:""}</small><small>${open?`أوامر مفتوحة: ${open} · `:""}${a.n?`مستلمة: ${a.n} · المتوسط: ${dd(a.avg)}`:"لم يصل منه شيء بعد"}</small></div>
  ${ph?`<a href="tel:${E(ph)}">📞</a><a href="https://wa.me/${E(ph.replace(/^\+/,""))}" target="_blank" rel="noopener">💬</a>`:""}${canEdit()?`<button type="button" data-po="supedit" data-id="${E(s.id)}">✏️</button>`:""}</div>`}).join(""):`<div class="po-e">🏭<br>لا يوجد موردون بعد</div>`}</div>
 ${canEdit()?"":`<div class="act"><button data-po="close" type="button">إغلاق</button></div>`}`,"sups");
}
let SUPBACK="";
function supForm(id,back){const s=id?S.get(id):null;SUPBACK=back||"";
 openM(`<h3>${s?"✏️ تعديل المورد":"➕ مورد جديد"}</h3>
 <label>اسم المورد *</label><input id="ps-n" maxlength="80" value="${E(s?s.n:"")}">
 <label>الدولة *</label><div class="chs" id="ps-c">${CTY.map(c=>`<button type="button" data-c="${c[0]}" class="${(s?s.cty:"")===c[0]?"on":""}">${c[1]}</button>`).join("")}</div>
 <div class="row"><div><label>جوال المورد (مع رمز الدولة)</label><input id="ps-ph" maxlength="30" dir="ltr" inputmode="tel" placeholder="+90 5xx xxx xx xx" value="${E(s?s.ph||"":"")}"></div>
 <div><label>اسم الشخص المسؤول</label><input id="ps-ct" maxlength="60" value="${E(s?s.ct||"":"")}"></div></div>
 <label>ملاحظة</label><input id="ps-nt" maxlength="200" value="${E(s?s.note||"":"")}">
 <div class="act"><button class="p" data-po="supsave" ${s?`data-id="${E(s.id)}"`:""} type="button">حفظ</button><button data-po="supback" type="button">رجوع</button></div>`,"supf");
 g("ps-c").onclick=e=>{const b=e.target.closest("[data-c]");if(!b)return;g("ps-c").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b))};
 g("ps-n").focus();
}
async function supSave(id){if(busy)return;
 const n=g("ps-n").value.trim().slice(0,80),cb=g("ps-c").querySelector(".on"),cty=cb?cb.dataset.c:"";
 if(!n){X.toast("اكتب اسم المورد");return}if(!cty){X.toast("اختر الدولة");return}
 if(!id&&[...S.values()].some(s=>String(s.n).trim().toLowerCase()===n.toLowerCase())){X.toast("هذا المورد مضاف بالفعل");return}
 const d={n,cty};const ph=toEn(g("ps-ph").value).replace(/[^\d+ ]/g,"").trim().slice(0,30),ct=g("ps-ct").value.trim().slice(0,60),nt=g("ps-nt").value.trim().slice(0,200);
 if(ph)d.ph=ph;if(ct)d.ct=ct;if(nt)d.note=nt;
 busy=true;
 try{const ref=id?doc(X.db,"posup",id):doc(collection(X.db,"posup"));const old=id?S.get(id):null;
  await withTimeout(setDoc(ref,{...d,by:old&&old.by?old.by:who(),ts:old&&old.ts?old.ts:Date.now()}),15000);busy=false;X.toast("✅ حُفظ المورد");
  if(SUPBACK==="form"){S.set(ref.id,{id:ref.id,...d});backToForm(ref.id)}else supList()}
 catch(x){busy=false;err(x)}}
// الرجوع لنموذج أمر الشراء بنفس اللي كان مكتوب (FS)، والمورد الجديد مختار
let SUPBACK_ID="",FS=null;
function stash(){FS={};const m=g("pom");if(m)m.querySelectorAll("input[id],select[id],textarea[id]").forEach(el=>{if(el.type!=="file")FS[el.id]=el.value})}
function backToForm(sel){form(SUPBACK_ID||undefined);if(FS)Object.keys(FS).forEach(k=>{const el=g(k);if(el&&el.type!=="file")el.value=FS[k]});FS=null;if(sel&&g("po-su"))g("po-su").value=sel}

// ---------- الضغطات ----------
document.addEventListener("click",e=>{
 if(!X)return;const t=e.target.closest&&e.target.closest("[data-po]");if(!t)return;
 const a=t.dataset.po,id=t.dataset.id;
 const RO=["fst","v","sups","att","gal","close","csv","supback"];
 if(!canEdit()&&!canRcv()&&!X.owner&&!RO.includes(a))return;
 if(a==="close")return void closeM();
 if(a==="v"){V=t.dataset.v==="stats"?"stats":"list";if(X.redraw)X.redraw();return}
 if(a==="fst"){F.st=t.dataset.v;if(X.redraw)X.redraw();return}
 if(a==="csv")return void csv();
 if(a==="sups")return void supList();
 if(a==="att")return void showAtt(id);
 if(a==="gal")return void gallery(id);
 if(a==="supback"){if(SUPBACK==="form")return void backToForm("");return void supList()}
 if(a==="rcv"){if(canRcv())rcvForm(id);return}
 if(a==="rcvsave"){if(canRcv())rcvSave(id);return}
 if(a==="attsave"){if(canEdit()||canRcv())attSave(id);return}
 if(a==="del"){if(X.owner)del(id);return}
 if(!canEdit())return;
 if(a==="new")return void form();
 if(a==="edit")return void form(id);
 if(a==="save")return void save(id);
 if(a==="up")return void upForm(id);
 if(a==="upsave")return void upSave(id);
 if(a==="cx")return void cxForm(id);
 if(a==="cxsave")return void cxSave(id);
 if(a==="supnew"){const inForm=g("pom")&&g("pom").dataset.v==="form";if(inForm){SUPBACK_ID=(document.querySelector('[data-po="save"]')||{dataset:{}}).dataset.id||"";stash()}return void supForm("",inForm?"form":"")}
 if(a==="supedit")return void supForm(id);
 if(a==="supsave")return void supSave(id);
});
document.addEventListener("change",e=>{if(!X)return;const t=e.target;
 if(t.id==="po-fs"){F.sup=t.value;if(X.redraw)X.redraw()}else if(t.id==="po-fc"){F.cty=t.value;if(X.redraw)X.redraw()}});
document.addEventListener("toggle",e=>{const d=e.target;if(!d||!d.dataset||!d.dataset.poH)return;if(d.open)openH.add(d.dataset.poH);else openH.delete(d.dataset.poH)},true);
document.addEventListener("input",e=>{if(!X||e.target.id!=="po-q")return;F.q=e.target.value;const L=g("po-list");if(!L)return;
 // بحث فوري من غير إعادة رسم الصفحة (علشان الخانة ماتفقدش التركيز)
 const q=F.q.trim().toLowerCase();L.querySelectorAll(".po-c").forEach(c=>{c.hidden=!!q&&!c.textContent.toLowerCase().includes(q)})});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&g("pom")&&g("pom").className==="on")closeM()});
