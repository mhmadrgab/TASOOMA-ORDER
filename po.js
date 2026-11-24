// 🚢 أوامر الشراء والحاويات (15 نوفمبر 2026، طلب محمد): مسؤول المشتريات (staff.p.po، حساب مالوش غير المديول ده) بيعمل أمر الشراء
// ويتابع المورد بالجوال ويحدّث المرحلة بنفسه لحد ما الحاوية تبقى "متجهة للمستودع". الاستلام في المستودع للمالك واللي المالك
// اداله "📦 استلام الحاويات" (staff.p.rcv، زي أحمد سعيد) بس. والمنصة بتحسب كل أمر/حاوية لكل مورد وصل في كام يوم،
// علشان الشركة تعرف تطلب من كل مورد قبل احتياجها بقد إيه.
// البيانات: po/{id} (الأمر + سجل المراحل h)، posup/{id} (الموردين)، poatt/{id}/x/2..10 (المرفقات، att.js).
// القواعد: supabase/002_rules.sql (po_ok / po_rcv_ok / posup_ok). الإشعارات: ping(...,pos) ← السيرفر onPo.
import {collection,doc,getDoc,setDoc,updateDoc,deleteDoc,onSnapshot,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {multiPick,saveExtras,loadExtras,dropExtras} from "./att.js";
import {zoomGallery} from "./zoom.js";
import {catLoad,catNow,catCode,catColors,catSizes,catUpc,catColorKey,catCodes,catCheck} from "./cat.js";
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
#pom>.mk.wide{max-width:860px}
#pom .it-tb input.catw{box-shadow:inset 0 0 0 2px #e8a317;background:color-mix(in srgb,#e8a317 12%,var(--field,#f2e9dd))}
#pom .it-w{margin-top:8px;padding:8px 12px;border-radius:12px;background:color-mix(in srgb,#e8a317 14%,transparent);font-size:13px;line-height:1.6}#pom .it-w[hidden]{display:none}
#pom>.mk{max-width:600px;margin:4vh auto;transition:max-width .25s ease;background:var(--card);color:var(--ink);border-radius:20px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
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
#pom .it{margin-top:14px}
#pom .it-tg{width:100%;display:flex;align-items:center;gap:10px;font:inherit;font-weight:700;font-size:15px;border:1.5px dashed #8a5a83;background:color-mix(in srgb,#8a5a83 7%,var(--card));color:var(--ink);border-radius:14px;padding:12px 14px;cursor:pointer;text-align:start}
#pom .it-tg small{flex:1;color:var(--mut);font-weight:600;font-size:13px}
#pom .it-tg .ar{font-style:normal;font-size:14px;transition:transform .2s ease}
#pom .it-tg[aria-expanded="true"]{border-style:solid;border-radius:14px 14px 0 0}#pom .it-tg[aria-expanded="true"] .ar{transform:rotate(180deg)}
#pom .it-bx{border:1.5px solid #8a5a83;border-top:0;border-radius:0 0 14px 14px;padding:10px 8px}
#pom .it-tw{overflow-x:auto}
#pom .it-tb{width:100%;border-collapse:collapse;font-size:14px}
#pom .it-tb th{font-size:12px;color:var(--mut);font-weight:600;text-align:start;padding:2px 3px 6px;white-space:nowrap}
#pom .it-tb td{padding:3px}
#pom .it-tb td.n{color:var(--mut);font-size:12px;text-align:center;width:22px}
#pom .it-tb td.iq{width:84px}#pom .it-tb td.iz{width:78px}#pom .it-tb td.it-k{width:76px}#pom .it-tb td.ix{width:58px;white-space:nowrap}
#pom .it-tb input,#pom .it-tb select{padding:7px 8px;font-size:14px;border-radius:9px}
#pom .it-tb.nok .it-k,#pom .it-tb.nok .it-kh{display:none}
#pom .it-tb .ix button{font:inherit;border:0;background:none;color:#c4362b;font-size:20px;line-height:1;cursor:pointer;padding:4px}#pom .it-tb .ix button.dup{color:#8a5a83;font-size:18px}
#pom .it-tb tr.nw td{background:color-mix(in srgb,#6f7d45 16%,transparent);transition:background .8s ease}
#pom .it-h{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
#pom .it-h button,#pom .it-p button{font:inherit;font-size:13.5px;font-weight:600;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:6px 12px;cursor:pointer}
#pom .it-p{margin-top:8px}#pom .it-p textarea{min-height:90px;direction:ltr;text-align:left}
@media (max-width:560px){#pom .it-tb thead{display:none}#pom .it-tb,#pom .it-tb tbody{display:block}
 #pom .it-tb tr{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:6px;border:1px solid var(--line);border-radius:12px;padding:8px;margin-bottom:8px;position:relative}
 #pom .it-tb td{padding:0;width:auto!important}#pom .it-tb td.n{display:none}
 #pom .it-tb td.ic{grid-column:1/-1;margin-inline-end:64px}
 #pom .it-tb td.icl{grid-column:1}#pom .it-tb td.iz{grid-column:2}#pom .it-tb td.iq{grid-column:3}
 #pom .it-tb td.it-k{grid-column:1}#pom .it-tb td.in{grid-column:2/-1}#pom .it-tb.nok td.in{grid-column:1/-1}
 #pom .it-tb td.ix{position:absolute;top:2px;inset-inline-end:2px}}
`;
function css(){if(!g("po-css")){const s=document.createElement("style");s.id="po-css";s.textContent=CSS;document.head.appendChild(s)}}

// ---------- البداية ----------
// ctx: {db, toast, me:{e,n}, owner, edit (مسؤول المشتريات/المالك), rcv (يستلم في المستودع), redraw(), active(), ping(ids), badge()}
export function initPo(ctx){
 stopPo();X=ctx;css();
 catLoad(X.db).then(()=>{if(g("po-itb"))itRender()}).catch(()=>{});// 📦 كتالوج الأصناف (من الكاش غالباً)
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
 const Vv=L.filter(r=>(F.st==="all"||(fk?fk[3](r):r.st===F.st))&&(!F.sup||r.sup===F.sup)&&(!F.cty||r.cty===F.cty)&&(!q||[r.no,r.supn,r.desc,r.ref,r.bl,r.cnos,r.line,Array.isArray(r.it)?r.it.map(x=>[x.c,x.cl,x.z,x.n].filter(Boolean).join(" ")).join(" "):""].join(" ").toLowerCase().includes(q)));
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
 if(Array.isArray(r.it)&&r.it.length)tags.push(`📋 ${r.it.length} صنف · ${r.it.reduce((s,x)=>s+N(x.q),0).toLocaleString("en-US")} قطعة`);
 if(r.cnos)tags.push(`📦 الحاويات: <bdi dir="ltr">${E(r.cnos)}</bdi>`);
 if(r.ref)tags.push(`📋 فاتورة المورد: <bdi dir="ltr">${E(r.ref)}</bdi>`);
 let ac="";
 if(open&&canEdit())ac+=`<button class="p" data-po="up" data-id="${E(r.id)}" type="button">⏭ تحديث المرحلة</button><button data-po="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button>`;
 if(open&&canRcv())ac+=`<button class="g" data-po="rcv" data-id="${E(r.id)}" type="button">✅ تأكيد الاستلام في المستودع</button>`;
 const sup=S.get(r.sup),ph=sup&&sup.ph?String(sup.ph).replace(/[^\d+]/g,""):"";
 if(ph)ac+=`<a href="tel:${E(ph)}">📞 المورد</a><a href="https://wa.me/${E(ph.replace(/^\+/,""))}" target="_blank" rel="noopener">💬 واتساب</a>`;
 if(Array.isArray(r.it)&&r.it.length)ac+=`<button data-po="items" data-id="${E(r.id)}" type="button">📋 الأصناف</button>`;
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
function closeM(){const m=g("pom");if(m){m.className="";m.innerHTML="";m.dataset.v=""}PK=null;busy=false;PDRAFT=null}
let PDRAFT=null;// 🛟 (v238) رقم أمر الشراء الجديد ثابت طول ما النموذج مفتوح (الضغط تاني بعد رد متأخر مابيعملش أمر تاني)
const err=async e=>{const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد أو تغيّرت الحالة":FAIL_MSG[w],"er")};
const btnBusy=(sel,t)=>{const b=document.querySelector(sel);if(b){b.disabled=!!t;if(t){b.dataset.t=b.dataset.t||b.textContent;b.textContent=t}else if(b.dataset.t)b.textContent=b.dataset.t}};

// أمر شراء جديد / تعديل
function form(id){
 const r=id?A.get(id):null;if(id&&!r)return;
 const sups=[...S.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
 const o=r||{dt:Date.now(),cn:1,ctype:"40HC",cur:"USD",pod:"الدمام"};
 if(!KEEP){IT=(r&&Array.isArray(r.it)?r.it:[]).map(x=>({c:x.c||"",cl:x.cl||"",z:x.z||"",q:String(x.q||""),k:x.k?String(x.k):"",n:x.n||""}));ITO=false}KEEP=false;
 openM(`<h3>${r?"✏️ تعديل أمر الشراء":"➕ أمر شراء جديد"}</h3>
 <label>المورد *</label><div style="display:flex;gap:8px"><select id="po-su" style="flex:1"><option value="">اختر المورد</option>${sups.map(s=>`<option value="${E(s.id)}" ${o.sup===s.id?"selected":""}>${E(s.n)} (${ctyOf(s.cty)[1]})</option>`).join("")}</select><button type="button" class="bt" data-po="supnew" style="white-space:nowrap">➕ مورد</button></div>
 ${sups.length?"":`<div class="warn">أضف المورد أولاً من زر «مورد» بجانب القائمة (الاسم والدولة ورقم الجوال).</div>`}
 <div class="row"><div><label>تاريخ أمر الشراء *</label><input id="po-dt" type="date" value="${E(dstr(o.dt||o.ts))}" max="${today()}"></div>
 <div><label>رقم فاتورة المورد (PI)</label><input id="po-ref" maxlength="60" dir="ltr" value="${E(o.ref||"")}"></div></div>
 <label>وصف البضاعة * (يُكتب تلقائياً إن أضفت أصنافاً وتركته فارغاً)</label><textarea id="po-ds" maxlength="1000" placeholder="مثلاً: أحذية رجالي شتوي، 4,800 زوج">${E(o.desc||"")}</textarea>
 <div class="row"><div><label>عدد الحاويات *</label><input id="po-cn" inputmode="numeric" value="${E(o.cn||1)}"></div>
 <div><label>نوع الحاوية</label><select id="po-ct">${CTYPE.map(([k,l])=>`<option value="${k}" ${o.ctype===k?"selected":""}>${l}</option>`).join("")}</select></div></div>
 <div class="it"><button type="button" class="it-tg" data-po="ittog" aria-expanded="false" aria-controls="po-itbx"><span>📦 إضافة أصناف</span><small id="po-itt"></small><i class="ar">▾</i></button>
 <div class="it-bx" id="po-itbx" hidden><div class="it-tw"><table class="it-tb"><thead><tr><th>#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th>الكمية</th><th class="it-kh">الحاوية</th><th>ملاحظات</th><th></th></tr></thead><tbody id="po-itb"></tbody></table><datalist id="po-dk"></datalist><datalist id="po-dc"></datalist><datalist id="po-dz"></datalist></div>
 <div class="it-h"><button type="button" data-po="itadd">＋ سطر</button><button type="button" data-po="itpaste">📋 لصق من إكسل</button><button type="button" data-po="itclr">مسح الأصناف</button></div>
 <div class="it-p" id="po-itpw" hidden><label>كل سطر صنف: الكود، اللون، المقاس، الكمية، رقم الحاوية (اختياري). انسخ الأعمدة من إكسل والصقها هنا</label><textarea id="po-itp" placeholder="A1023&#9;أسود&#9;42&#9;120&#9;1"></textarea><button type="button" data-po="itparse">إضافة الأسطر</button></div></div></div>
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
 itRender();
}
function readForm(){
 const sid=g("po-su").value,s=S.get(sid);if(!s){X.toast("اختر المورد");return null}
 const dt=dms(g("po-dt").value);if(!dt||dt>Date.now()+DAY){X.toast("اكتب تاريخ أمر الشراء");return null}
 const cn=Math.round(N(toEn(g("po-cn").value)));if(cn<1||cn>50){X.toast("عدد الحاويات من 1 إلى 50");return null}
 const its=itRead(cn);if(its===false)return null;
 let desc=g("po-ds").value.trim().slice(0,1000);
 if(!desc&&its.length)desc=`${its.length} صنف · إجمالي ${its.reduce((s,x)=>s+x.q,0).toLocaleString("en-US")} قطعة`;
 if(!desc){X.toast("اكتب البضاعة أو أضف أصنافاً");g("po-ds").focus();return null}
 const val=Math.round(N(toEn(g("po-val").value).replace(/,/g,""))*100)/100;
 const d={sup:sid,supn:String(s.n).slice(0,80),cty:CTY.some(c=>c[0]===s.cty)?s.cty:"ot",dt,desc,cn,ctype:g("po-ct").value,cur:g("po-cur").value,pod:g("po-pod").value};
 const opt=(k,id,mx)=>{const el=g(id);if(!el)return;const v=el.value.trim().slice(0,mx);if(v)d[k]=v;else d[k]=null};
 opt("ref","po-ref",60);opt("pol","po-pol",60);opt("note","po-nt",500);opt("inc","po-inc",10);
 opt("line","po-line",60);opt("ves","po-ves",60);opt("bl","po-bl",60);opt("cnos","po-cnos",200);opt("etd","po-etd",10);opt("eta","po-eta",10);
 if(val>0)d.val=val;else d.val=null;
 d.it=its.length?its:null;
 return d;
}
const clean=d=>{const o={};Object.keys(d).forEach(k=>{if(d[k]!=null&&d[k]!=="")o[k]=d[k]});return o};
async function save(id){
 if(busy)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور والملفات");return}
 const d=readForm();if(!d)return;
 busy=true;btnBusy('[data-po="save"]',"⏳ جاري الحفظ...");
 try{
  if(id){let r=A.get(id);if(!r)throw new Error("gone");
   // 🛟 (v238) نقرا الأمر من القاعدة قبل الحفظ: النسخة اللي في الصفحة ممكن تكون أقدم من تحديث مرحلة عمله حد تاني، فالحفظ كان بيرجّعه
   try{const f=await withTimeout(getDoc(doc(X.db,"po",id)),10000);if(f.exists())r=Object.assign({id},f.data())}catch(x){}
   // التعديل: من غير ما نلمس المرحلة والسجل. الحقول اللي اتمسحت بتتشال
   const patch={upd:Date.now()};Object.keys(d).forEach(k=>{patch[k]=d[k]==null?null:d[k]});
   const nx={...r,...patch};delete nx.id;Object.keys(nx).forEach(k=>{if(nx[k]==null)delete nx[k]});
   await withTimeout(setDoc(doc(X.db,"po",id),nx),15000);busy=false;X.toast("✅ حُفظ التعديل");closeM();return}
  const ts=Date.now(),t=new Date(ts),p=n=>String(n).padStart(2,"0");
  if(!PDRAFT)PDRAFT=doc(collection(X.db,"po")).id;
  const ref=doc(X.db,"po",PDRAFT);
  const IMS=PK?PK.imgs():[],PDFS=PK?PK.files():[],ATT=IMS.concat(PDFS);
  const o=clean({...d,no:`PO-${String(t.getFullYear()).slice(2)}${p(t.getMonth()+1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}`,st:"new",ts,by:who(),
   h:[{s:"new",at:d.dt,ts,...who()}]});
  if(ATT.length)o.att=1;
  await withTimeout(setDoc(ref,o),20000);
  let bad=0;if(ATT.length){btnBusy('[data-po="save"]',`⏳ رفع المرفقات (${ATT.length})...`);bad=await saveExtras(X.db,"poatt",ref.id,ATT,2)}
  busy=false;PDRAFT=null;if(X.ping)X.ping([ref.id]);
  X.toast(bad?`أُنشئ الأمر، لكن تعذّر رفع ${bad} من المرفقات`:"✅ أُنشئ أمر الشراء "+o.no,bad?"er":undefined);closeM();
 }catch(e){
  if(!id&&PDRAFT){try{const s=await withTimeout(getDoc(doc(X.db,"po",PDRAFT)),8000);if(s.exists()){const pid=PDRAFT;busy=false;PDRAFT=null;if(X.ping)X.ping([pid]);X.toast("✅ أُنشئ أمر الشراء "+(s.data().no||"")+" (الاتصال كان بطيئاً). لو المرفقات ناقصة أضفها من الأمر");closeM();return}}catch(x){}}
  busy=false;btnBusy('[data-po="save"]',"");err(e)}
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
function backToForm(sel){KEEP=true;form(SUPBACK_ID||undefined);if(FS)Object.keys(FS).forEach(k=>{const el=g(k);if(el&&el.type!=="file")el.value=FS[k]});FS=null;if(sel&&g("po-su"))g("po-su").value=sel;itRender()}


// ---------- الأصناف داخل أمر الشراء (16 نوفمبر 2026، طلب محمد: "إضافة أصناف وتفتح في قايمة منسدلة زي ورقة نواقص الفروع") ----------
// po/{id}.it = [{c:الكود, cl?:اللون, z?:المقاس, q:الكمية, k?:رقم الحاوية, n?:ملاحظات}] لحد 200 صنف.
// زرار "📦 إضافة أصناف" بيفتح جدول تحته (زي ورقة الفرع): # · الكود · اللون · المقاس · الكمية · الحاوية · ملاحظات · ×.
// الكتابة في آخر سطر بتزوّد سطر فاضي لوحدها، وEnter بينزل للسطر اللي تحته. "لصق من إكسل" للكميات الكبيرة.
let IT=[],KEEP=false,ITO=false;const MAXIT=200;
const ITF=["c","cl","z","q","k","n"];
// اختيارات زي ورقة الفرع (16 نوفمبر 2026): الألوان والمقاسات نفس قايمة ورقة النواقص + اللي اتكتب قبل كده في أوامر الشراء، والأكواد من الأوامر القديمة
const PO_COL=["Black","Brown","Blue","Green","BEIGE","White","CAMEL","Grey","D.BLUE","GRAY","D Brown","Navy","Olive","Bordo","Khaki","D Blue","L Brown","RED","BEIG","Havan","D.BROWN","CUOIO","PINK","L.BROWN","OF White","L Grey","D Grey","Yellow","LT.GREY","TURQUOIS","CRÈME","L.GRAY","STONE","BLACK+BL","TAN","BEGE.PIN","اسود","Coffee","D.GRAY","NAVY MAT","DK.BROWN","ابيض","BROWEN","زيتي","CAMAL","LINEN","BLACK-GR","أبيض","NUEZ","GR PLUE","L Blue","L.BEIGE","B LBROWN","L Beige","D GRAY","L.GREEN","زيتى","Jeans","TAUPE.GR","كحلي","Kakhi","NAVY/B","كريمى","BLUE-BL","WHITE.LT","بني","BEIGE-W","KHAKI-BG","GREY-BL","BRWON","BEIGE.PN","NAVY NU","D GREEN","WHITE/G","GRAY/W","D.GREEN","GREY.BLU","كريمي","كحلى","D. Blue","SAND WOL","KHAKI-B","NAVY-W","KHAKI-W","BLACK-W","Honey","WHIET","بيج","B Grey","BEIEGE","W Green","KAHKI","BLACK-K","S Blue","O Green","بنى","orange","B Brown","WAHITE","BLUE.M","BLACK.M","عنابي","TAUPE","NAVY-K","O BROWN","MOSS","R BLACK","NAVY-G","G Orange","GRAY-K","BLACK-G","G Green","GRAY-M","DK GREY","B Orange","BROWN-M","رمادي","تيتانيوم","DBLUE","فضي","رصاصى","اصفر","L-GRAY","YE Brown","Kaky","جملى","WHITEE","برتقالى","سماوى","احمر","Bige","SKY BLUE","OFF WHIT","BEGE","هافان","Ice","D.ORANGE","Br Brown","أسود","L.YELLOW","4BLUE-BR","5GRY-BIG","1GREN-BR","3BLUE-GR","6BIG-BLU","2BLCK-BR","1","رمادي كا","F","3","2","هافان z","رمادي غ","رمادي ف","بنى منقش","2-1","2-3","5-2","1-3","2-2","1-1","3-2","5-1","4-2","1-2","3-3","4-4","5-3","3-1","4-1","3-4","D Blu Gr","4-3","BROWN- B","اسود كار","Flands","أزرق-بنى","ازرق-اسو","اصفر-ابي","اصفر ش","Bordo CR","Blak Gry","اصفرغامق","رصاصى غ","بنى غامق","اسود ش","Bordo LO","Black CR","هافان كا","جملي","بترولي","BABY BLU","D GRY","PURPLE","B D Grey","READ","WAIHT","Black LO","Blue CR","Blue LO","B Green","GERY","عودى","L PINK","R BLUE","Beige CR","Green LO","رمادى","BA POWDR","L GREEN","N COLOR","Lodo","SUOIO","Forest","Black Bo","y Green","POWDER","KAHIKE","H POWDER","BO Black","B Red","فضى","CREME","SO Brown","DK BEIGE","LT BEIGE","CU Brown","D BL Blk","BLACK/WH","LT GREY","رصاصي","BBrown *","B Grey *","OLIV","NIGER","BLUE/W","GREEN-GR","تركواز","بني/اصفر","أزرق","ازرق","MAROON","L GRAY"],PO_SZ=["40","41","43","45","44","42","46","58","60","48","F","37","38","47","36","39","M","55","XL","2XL","L","3.5","35","S","3XL","54","56","50","52","1","75 ML","75ML","طويل","62","80ML","قصير","75","34","2","52/5","51/5","21","21.5","22","23","22.5","53/5","54/5","50/5","100ML","51/4.5","28 K","52/4.5","54/4.5","26 K","30 K","53/4.5","22 K","24 K","50/4.5","49","20.5","18 K","20 K","18 R","20 R","30 R","22 R","24 R","28 R","26 R","63","20","XXL","61","52/5.5","53/5.5","50/5.5","51/5.5","0","54/5.5"];
let DC0="",DZ0="";// القايمة العامة (كود مش في السيستم)
function itLists(){const dk=g("po-dk"),dc=g("po-dc"),dz=g("po-dz");if(!dk||dk.dataset.ok===String(catNow()?catNow().v:0))return;dk.dataset.ok=String(catNow()?catNow().v:0);
 const K=new Set(),C=new Set(),Z=new Set();[...A.values()].forEach(r=>(Array.isArray(r.it)?r.it:[]).forEach(x=>{if(x.c)K.add(String(x.c));if(x.cl)C.add(String(x.cl));if(x.z)Z.add(String(x.z))}));
 PO_COL.forEach(x=>C.add(x));PO_SZ.forEach(x=>Z.add(x));
 const op=S=>[...S].slice(0,1500).map(x=>`<option value="${E(x)}">`).join("");DC0=op(C);DZ0=op(Z);dc.innerHTML=DC0;dz.innerHTML=DZ0;
 // 📦 كتالوج الشركة: كل الأكواد باسم الصنف، وبعدها أكواد الأوامر القديمة اللي مش في الكتالوج
 const CC=catCodes(),seen=new Set(CC.map(x=>String(x[0]).toUpperCase()));
 dk.innerHTML=CC.map(x=>`<option value="${E(x[0])}"${x[1]?` label="${E(x[1])}"`:""}>`).join("")+op([...K].filter(k=>!seen.has(String(k).toUpperCase())))}
// 📦 الربط بالكتالوج (17 نوفمبر 2026، محمد: "ورقة أوامر الشراء ماوصلهاش ربط الأصناف بالألوان والمقاسات"):
// اللون = ألوان الكود ده بس، والمقاس = مقاسات الكود واللون دول بس، والـ UPC بيملّى الصنف، واللي مش في السيستم بيتعلّم بالأصفر (تحذير بس: ممكن يبقى صنف جديد)
const itEl=(i,f)=>document.querySelector(`#po-itb tr[data-i="${i}"] [data-f="${f}"]`);
const itSet=(i,f,v)=>{if(!IT[i])return;IT[i][f]=v;const el=itEl(i,f);if(el&&el.value!==v)el.value=v};
let MKT=0;
function itMark(){
 const b=g("po-itb");if(!b)return;let bad=0,nw=0;const has=!!catNow();
 IT.forEach((x,i)=>{const K=itEl(i,"c"),C=itEl(i,"cl"),Z=itEl(i,"z");if(!K)return;
  const r=has?catCheck(x.c,x.cl,x.z):{k:false,c:false,z:false,o:null};
  const w=(el,on,t)=>{if(!el)return;el.classList.toggle("catw",!!on);if(on)el.title=t;else if(el===K)el.title=r.o&&r.o.n?r.o.n:"";else el.removeAttribute("title")};
  w(K,r.k,"الكود غير موجود في سيستم الشركة (ربما صنف جديد)");w(C,r.c,"هذا اللون غير موجود لهذا الكود في السيستم");w(Z,r.z,"هذا المقاس غير موجود لهذا الكود واللون في السيستم");
  if(r.k)nw++;else if(r.c||r.z)bad++});
 let n=g("po-itw");const bx=g("po-itbx");if(!n&&bx){n=document.createElement("div");n.id="po-itw";n.className="it-w";n.setAttribute("role","status");const tw=bx.querySelector(".it-tw");if(tw)tw.insertAdjacentElement("afterend",n)}
 if(n){const P=[];if(nw)P.push(`${nw} ${nw===1?"كود غير موجود":"أكواد غير موجودة"} في سيستم الشركة (صنف جديد؟)`);if(bad)P.push(`${bad} ${bad===1?"سطر فيه":"أسطر فيها"} لون أو مقاس غير مسجّل لهذا الكود`);n.hidden=!P.length;n.textContent=P.length?"⚠️ "+P.join(" · ")+". مُعلَّمة بالأصفر، ويمكنك الحفظ.":""}
}
const itMarkLater=()=>{clearTimeout(MKT);MKT=setTimeout(itMark,150)};
// الكود اتكتب/اتغيّر: نكتبه زي السيستم، ولو ليه لون واحد أو مقاس واحد والخانة فاضية نملاها
function itAuto(i,f){
 const x=IT[i];if(!x||!catNow())return;const o=catCode(x.c);if(!o)return;
 if(f==="c"&&o.c!==x.c)itSet(i,"c",o.c);
 const cols=catColors(x.c)||[];
 if(!String(x.cl||"").trim()&&cols.length===1)itSet(i,"cl",cols[0]);
 else if(String(x.cl||"").trim()){const k=catColorKey(x.c,x.cl);if(k&&k!==x.cl)itSet(i,"cl",k)}
 const S=catSizes(x.c,IT[i].cl)||[];if(!String(x.z||"").trim()&&S.length===1)itSet(i,"z",S[0]);
}
const itEmpty=x=>!x||!(String(x.c||"").trim()||String(x.cl||"").trim()||String(x.z||"").trim()||String(x.q||"").trim()||String(x.n||"").trim()||x.k);
const itCn=()=>Math.max(1,Math.min(50,Math.round(N(toEn((g("po-cn")||{value:"1"}).value)))||1));
function itRow(x,i,cn){
 return `<tr data-i="${i}"><td class="n">${i+1}</td>`
 +`<td class="ic"><input data-f="c" list="po-dk" autocomplete="off" maxlength="40" dir="ltr" placeholder="الكود" aria-label="الكود" value="${E(x.c)}"></td>`
 +`<td class="icl"><input data-f="cl" list="po-dc" autocomplete="off" maxlength="40" placeholder="اللون" aria-label="اللون" value="${E(x.cl)}"></td>`
 +`<td class="iz"><input data-f="z" list="po-dz" autocomplete="off" maxlength="20" dir="ltr" placeholder="المقاس" aria-label="المقاس" value="${E(x.z)}"></td>`
 +`<td class="iq"><input data-f="q" inputmode="numeric" placeholder="الكمية" aria-label="الكمية" value="${E(x.q)}"></td>`
 +`<td class="it-k">${cn>1?`<select data-f="k" aria-label="الحاوية"><option value="">الحاوية</option>${Array.from({length:cn},(_,j)=>`<option value="${j+1}" ${String(x.k)===String(j+1)?"selected":""}>${j+1}</option>`).join("")}</select>`:""}</td>`
 +`<td class="in"><input data-f="n" autocomplete="off" maxlength="100" placeholder="ملاحظات" aria-label="ملاحظات" value="${E(x.n)}"></td>`
 +`<td class="ix"><button type="button" class="dup" data-po="itdup" data-i="${i}" aria-label="تكرار السطر" title="سطر مشابه (نفس الكود واللون والمقاس والكمية)">⧉</button><button type="button" data-po="itdel" data-i="${i}" aria-label="حذف السطر" title="حذف السطر">×</button></td></tr>`}
function itPad(){if(!ITO)return;while(IT.length<5)IT.push({c:"",cl:"",z:"",q:"",k:"",n:""});if(!itEmpty(IT[IT.length-1])&&IT.length<MAXIT)IT.push({c:"",cl:"",z:"",q:"",k:"",n:""})}
function itRender(){const b=g("po-itb");if(!b)return;const cn=itCn();itPad();if(ITO)itLists();
 b.innerHTML=IT.map((x,i)=>itRow(x,i,cn)).join("");
 const tb=b.closest("table");if(tb)tb.classList.toggle("nok",cn<2);
 const bx=g("po-itbx"),tg=document.querySelector('[data-po="ittog"]');if(bx)bx.hidden=!ITO;if(tg)tg.setAttribute("aria-expanded",ITO?"true":"false");
 const mk=b.closest(".mk");if(mk)mk.classList.toggle("wide",ITO);
 itTot();itMark()}
function itTot(){const t=g("po-itt");if(!t)return;const L=IT.filter(x=>!itEmpty(x)),q=L.reduce((s,x)=>s+Math.round(N(toEn(x.q))),0);t.textContent=L.length?`${L.length} صنف · إجمالي ${q.toLocaleString("en-US")} قطعة`:(ITO?"اكتب الأصناف في الجدول":"اضغط لكتابة الأصناف")}
function itRead(cn){const out=[];for(let i=0;i<IT.length;i++){const x=IT[i];if(itEmpty(x))continue;
  const c=String(x.c||"").trim().slice(0,40),cl=String(x.cl||"").trim().slice(0,40),z=String(x.z||"").trim().slice(0,20),n=String(x.n||"").trim().slice(0,100),qs=toEn(x.q).replace(/,/g,"").trim();
  if(!c&&!n){ITO=true;itRender();X.toast("السطر رقم "+(i+1)+" في الأصناف: اكتب الكود");return false}
  const q=Math.round(N(qs));if(!(q>=1)||q>1e7){ITO=true;itRender();X.toast("السطر رقم "+(i+1)+" في الأصناف: اكتب الكمية");return false}
  const o={q};if(c)o.c=c;if(cl)o.cl=cl;if(z)o.z=z;if(n)o.n=n;
  if(x.k){const k=Math.round(N(toEn(x.k)));if(k<1||k>cn){X.toast("السطر رقم "+(i+1)+": رقم الحاوية أكبر من عدد الحاويات");return false}o.k=k}
  out.push(o)}
 if(out.length>MAXIT){X.toast("الحد الأقصى "+MAXIT+" صنف في الأمر الواحد");return false}
 return out}
function itParse(){const t=g("po-itp");if(!t)return;const lines=t.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);let add=0;
 IT=IT.filter(x=>!itEmpty(x));
 const isN=s=>/^[\d٠-٩۰-۹,]+$/.test(String(s||"").trim());
 for(const ln of lines){if(IT.length>=MAXIT)break;const C=ln.split(/\t|;|,|،/).map(s=>s.trim());let o;
  if(C.length>=4)o={c:C[0],cl:C[1],z:C[2],q:C[3],k:isN(C[4])?C[4]:"",n:isN(C[4])?(C[5]||""):(C[4]||"")};
  else if(C.length===3)o=isN(C[2])?{c:C[0],cl:C[1],z:"",q:C[2]}:{c:C[0],cl:C[1],z:C[2],q:""};
  else if(C.length===2)o=isN(C[1])?{c:C[0],q:C[1]}:{c:C[0],cl:C[1],q:""};
  else o={c:C[0],q:""};
  IT.push({c:String(o.c||"").slice(0,40),cl:String(o.cl||"").slice(0,40),z:String(o.z||"").slice(0,20),q:String(o.q||""),k:String(o.k||""),n:String(o.n||"").slice(0,100)});add++}
 t.value="";if(g("po-itpw"))g("po-itpw").hidden=true;ITO=true;itRender();X.toast(add?"أُضيف "+add+" سطر. راجع الكميات ثم احفظ":"لا يوجد أسطر")}
function showItems(id){const r=A.get(id);if(!r||!Array.isArray(r.it)||!r.it.length)return;const L=r.it,tot=L.reduce((s,x)=>s+N(x.q),0),hk=L.some(x=>x.k),hn=L.some(x=>x.n);
 openM(`<h3>📋 أصناف الأمر</h3><p style="margin:0 0 10px;color:var(--mut)"><bdi dir="ltr">${E(r.no)}</bdi> · 🏭 <bdi data-notr>${E(r.supn)}</bdi> · ${L.length} صنف · ${tot.toLocaleString("en-US")} قطعة</p>
 <div class="po-tw"><table class="po-t" style="min-width:0"><thead><tr><th>#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th>الكمية</th>${hk?"<th>الحاوية</th>":""}${hn?"<th>ملاحظات</th>":""}</tr></thead><tbody>${L.map((x,i)=>`<tr><td>${i+1}</td><td><bdi dir="ltr" data-notr>${E(x.c||"")}</bdi></td><td data-notr>${E(x.cl||"")}</td><td><bdi dir="ltr" data-notr>${E(x.z||"")}</bdi></td><td class="n">${N(x.q).toLocaleString("en-US")}</td>${hk?`<td>${x.k?E(x.k):""}</td>`:""}${hn?`<td style="white-space:normal" data-notr>${E(x.n||"")}</td>`:""}</tr>`).join("")}</tbody></table></div>
 <div class="act"><button data-po="close" type="button">رجوع</button></div>`,"items")}
document.addEventListener("input",e=>{if(!X)return;const t=e.target;if(!t||!t.closest)return;
 if(t.id==="po-cn"&&g("po-itb")){itRender();return}
 const row=t.closest("#po-itb tr");if(!row||!t.dataset.f)return;const i=+row.dataset.i;if(!IT[i])return;IT[i][t.dataset.f]=t.value;
 // UPC (مسدس الباركود أو كتابة) في خانة الكود ← الكود واللون والمقاس، وننزل على الكمية
 if(t.dataset.f==="c"&&/^\d{8,20}$/.test(t.value.trim())){const h=catUpc(t.value);if(h){itSet(i,"c",h.c);itSet(i,"cl",h.cl||"");itSet(i,"z",h.z||"");const q=itEl(i,"q");if(q)q.focus()}}
 itMarkLater();
 // الكتابة في آخر سطر: سطر فاضي جديد تحته (من غير ما نرسم الجدول من الأول علشان التركيز مايضيعش)
 if(i===IT.length-1&&!itEmpty(IT[i])&&IT.length<MAXIT){IT.push({c:"",cl:"",z:"",q:"",k:"",n:""});row.insertAdjacentHTML("afterend",itRow(IT[IT.length-1],IT.length-1,itCn()))}
 itTot()});
document.addEventListener("change",e=>{if(!X)return;const t=e.target;if(!t||!t.closest)return;const row=t.closest("#po-itb tr");if(!row||!t.dataset.f)return;const i=+row.dataset.i;if(!IT[i])return;
 if(t.tagName==="SELECT"){IT[i][t.dataset.f]=t.value;itTot();return}
 if(t.dataset.f==="c"||t.dataset.f==="cl"){itAuto(i,t.dataset.f);itTot();itMarkLater()}});
// التركيز على اللون/المقاس: اختيارات الكود ده بس (كود مش في السيستم ← القايمة العامة)
document.addEventListener("focusin",e=>{if(!X)return;const t=e.target;if(!t||!t.closest||!t.dataset||!t.dataset.f)return;const row=t.closest("#po-itb tr");if(!row)return;const x=IT[+row.dataset.i];if(!x)return;
 const op=L=>L.map(v=>`<option value="${E(v)}">`).join("");
 if(t.dataset.f==="cl"){const dc=g("po-dc"),L=catColors(x.c);if(dc)dc.innerHTML=L?op(L):DC0}
 if(t.dataset.f==="z"){const dz=g("po-dz"),L=catSizes(x.c,x.cl);if(dz)dz.innerHTML=L?op(L):DZ0}},true);
// Enter: نفس الخانة في السطر اللي تحته (زي ورقة الفرع)
document.addEventListener("keydown",e=>{if(!X||e.key!=="Enter")return;const t=e.target;if(!t||!t.closest||t.tagName!=="INPUT")return;const row=t.closest("#po-itb tr");if(!row)return;e.preventDefault();
 let nx=row.nextElementSibling;if(!nx&&IT.length<MAXIT){IT.push({c:"",cl:"",z:"",q:"",k:"",n:""});row.insertAdjacentHTML("afterend",itRow(IT[IT.length-1],IT.length-1,itCn()));nx=row.nextElementSibling}
 if(nx){const f=nx.querySelector(`[data-f="${t.dataset.f}"]`)||nx.querySelector("input");if(f)f.focus()}});

// ---------- الضغطات ----------
document.addEventListener("click",e=>{
 if(!X)return;const t=e.target.closest&&e.target.closest("[data-po]");if(!t)return;
 const a=t.dataset.po,id=t.dataset.id;
 const RO=["fst","v","sups","att","gal","close","csv","supback","items"];
 if(!canEdit()&&!canRcv()&&!X.owner&&!RO.includes(a))return;
 if(a==="close")return void closeM();
 if(a==="v"){V=t.dataset.v==="stats"?"stats":"list";if(X.redraw)X.redraw();return}
 if(a==="fst"){F.st=t.dataset.v;if(X.redraw)X.redraw();return}
 if(a==="csv")return void csv();
 if(a==="sups")return void supList();
 if(a==="att")return void showAtt(id);
 if(a==="gal")return void gallery(id);
 if(a==="items")return void showItems(id);
 if(a==="supback"){if(SUPBACK==="form")return void backToForm("");return void supList()}
 if(a==="rcv"){if(canRcv())rcvForm(id);return}
 if(a==="rcvsave"){if(canRcv())rcvSave(id);return}
 if(a==="attsave"){if(canEdit()||canRcv())attSave(id);return}
 if(a==="del"){if(X.owner)del(id);return}
 if(!canEdit())return;
 if(a==="ittog"){ITO=!ITO;itRender();if(ITO){const rs=[...document.querySelectorAll("#po-itb tr")],r0=rs.find(r=>{const i=+r.dataset.i;return itEmpty(IT[i])})||rs[0];const f=r0&&r0.querySelector("input");if(f)f.focus()}return}
 if(a==="itadd"){if(IT.length>=MAXIT){X.toast("الحد الأقصى "+MAXIT+" صنف");return}ITO=true;IT.push({c:"",cl:"",z:"",q:"",k:"",n:""});itRender();const rs=document.querySelectorAll("#po-itb tr"),l=rs[rs.length-1];if(l){const f=l.querySelector("input");if(f)f.focus()}return}
 if(a==="itdel"){IT.splice(+t.dataset.i,1);itRender();return}
 if(a==="itdup"){const i=+t.dataset.i;if(!IT[i])return;if(IT.filter(x=>!itEmpty(x)).length>=MAXIT){X.toast("الحد الأقصى "+MAXIT+" صنف");return}IT.splice(i+1,0,{...IT[i]});itRender();const r=document.querySelector(`#po-itb tr[data-i="${i+1}"]`),z=r&&r.querySelector('[data-f="z"]');if(z){z.focus();z.select&&z.select()}if(r){r.classList.add("nw");setTimeout(()=>r.classList.remove("nw"),900)}return}
 if(a==="itclr"){if(IT.some(x=>!itEmpty(x))&&!confirm("مسح كل الأصناف المكتوبة في هذا الأمر؟"))return;IT=[];itRender();return}
 if(a==="itpaste"){const w=g("po-itpw");if(w){w.hidden=!w.hidden;if(!w.hidden)g("po-itp").focus()}return}
 if(a==="itparse")return void itParse();
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
