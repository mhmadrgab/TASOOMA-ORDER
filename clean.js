// 🧹 جدول نظافة المستودع (15 نوفمبر 2026، طلب محمد): كل يوم عاملين بينضّفوا، وعلى مدار الأسبوع الكل بينضّف.
// الأزواج بتتغيّر كل أسبوع (round-robin: كل عامل بيشتغل مع زميل مختلف)، وكل زوج بياخد يومين في الأسبوع (6 أيام / 3 أزواج).
// المدير بيقيّم كل يوم: مين نضّف فعلاً + نجوم ١–٥ + ملاحظة. ترتيب شهري و"بطل النظافة". الجدول بيتطبع ويتعلّق في المستودع.
// البيانات: clean/{YYYY-MM-DD} = {d, as:[المكلّفين], ws?:[اللي نضّفوا], st?:"done"|"miss", r?:1..5, note?, sw?:true (تبديل), by, at}
//           cleancfg/main = {days:[أرقام getDay], since:"YYYY-MM-DD", by, at}. القواعد: supabase/002_rules.sql (clean_ok).
import {collection,doc,setDoc,deleteDoc,onSnapshot,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E,N,printStmt,ensurePrintCss} from "./cust.js";
const g=id=>document.getElementById(id);
const DAYN=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];// حسب getDay
const WEEK=[6,0,1,2,3,4,5];// الأسبوع بيبدأ السبت
const DEF_DAYS=[6,0,1,2,3,4];// السبت → الخميس
const ANCH=new Date(2026,10,14);// سبت مرجعي لترقيم الأسابيع (تبديل الأزواج)
const DAY=864e5;
let X=null,W=()=>[],C={},CFG=null,un=[],WOFF=0,busy=false,ST=0;
const dkey=d=>{const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const fromKey=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const satOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+1)%7));return x};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const todayKey=()=>dkey(new Date());
const days=()=>(CFG&&Array.isArray(CFG.days)&&CFG.days.length?CFG.days:DEF_DAYS).slice().sort((a,b)=>WEEK.indexOf(a)-WEEK.indexOf(b));
const since=()=>(CFG&&/^\d{4}-\d{2}-\d{2}$/.test(CFG.since||"")?CFG.since:"2026-11-15");
const active=()=>W().filter(w=>w.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar")||String(a.id).localeCompare(String(b.id)));
const nm=id=>{const w=W().find(x=>x.id===id);return w?w.name:"—"};
const names=ids=>(ids||[]).map(nm).join(" و ");
const didOf=(as,r)=>r&&r.st==="done"&&Array.isArray(r.ws)&&r.ws.length?r.ws:as;
const absOf=(as,r)=>r&&r.st==="done"&&Array.isArray(r.ws)?(as||[]).filter(id=>r.ws.indexOf(id)<0):[];

// الأزواج للأسبوع رقم k: الأول ثابت والباقي بيلفّوا (كل أسبوع شريك مختلف). لو العدد فردي: اللي مالوش شريك بينضم لآخر زوج (3).
export function pairsFor(ids,k){
 const a=ids.slice();if(a.length<2)return a.length?[a]:[];
 if(a.length%2)a.push(null);
 const n=a.length,m=n-1,r=((k%m)+m)%m,rest=a.slice(1),rot=rest.slice(r).concat(rest.slice(0,r)),row=[a[0]].concat(rot),out=[];let lone=null;
 for(let i=0;i<n/2;i++){const q=[row[i],row[n-1-i]].filter(x=>x!=null);if(q.length===1)lone=q[0];else out.push(q)}
 if(lone!=null){if(out.length)out[out.length-1].push(lone);else out.push([lone])}
 // ترتيب الأزواج على الأيام بيتزحزح كل أسبوع (مش نفس الزوج كل سبت)
 const s=out.length?((k%out.length)+out.length)%out.length:0;return out.slice(s).concat(out.slice(0,s));
}
const weekNo=sat=>Math.round((satOf(sat)-ANCH)/(7*DAY));
// جدول الأسبوع اللي بيبدأ بالسبت sat: [{k (التاريخ), dow, as:[المكلّفين], rec}]
export function weekPlan(sat){
 const ids=active().map(w=>w.id),P=pairsFor(ids,weekNo(sat)),D=days();
 return D.map((dow,i)=>{const k=dkey(addD(sat,WEEK.indexOf(dow))),rec=C[k];
  const as=rec&&Array.isArray(rec.as)&&rec.as.length?rec.as:(P.length?P[i%P.length]:[]);return {k,dow,as,rec}});
}
// الترتيب الشهري: من الأيام اللي اتقيّمت بس
export function monthStats(mo){
 const S=new Map(),get=id=>{if(!S.has(id))S.set(id,{id,as:0,done:0,miss:0,extra:0,stars:0,rated:0});return S.get(id)};
 Object.keys(C).filter(k=>k.slice(0,7)===mo&&k>=since()).forEach(k=>{const r=C[k];if(!r||!r.st)return;
  const as=Array.isArray(r.as)?r.as:[],ws=r.st==="done"&&Array.isArray(r.ws)?r.ws:[];
  as.forEach(id=>{const s=get(id);s.as++;if(ws.indexOf(id)<0)s.miss++});
  ws.forEach(id=>{const s=get(id);s.done++;if(as.indexOf(id)<0)s.extra++;if(N(r.r)){s.stars+=N(r.r);s.rated++}})});
 const L=[...S.values()].filter(s=>W().some(w=>w.id===s.id));
 // الدرجة من 100: جودة 70 (متوسط النجوم) + التزام 30 (نضّف في أيامه). المساعدة في يوم مش يومه بتحسب في الالتزام
 L.forEach(s=>{s.avg=s.rated?s.stars/s.rated:null;const att=s.as?Math.min(1,(s.done)/s.as):(s.done?1:0);s.score=Math.round((s.avg==null?0:s.avg/5*70)+att*30)});
 return L.sort((a,b)=>b.score-a.score||b.done-a.done);
}

const CSS=`
.cl-sub{display:inline-flex;gap:4px;padding:4px;border-radius:14px;background:var(--field,#f2e9dd);margin-bottom:14px}
.cl-sub button{font:inherit;font-weight:700;font-size:14.5px;border:0;background:transparent;color:var(--mut);border-radius:10px;padding:8px 16px;cursor:pointer}
.cl-sub button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.cl-today{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(135deg,#2a1d2c,#2d2131);color:#fff;border-radius:16px;padding:16px 20px;margin-bottom:14px;border:1px solid rgba(180,138,171,.35)}
.cl-today .ic{font-size:36px}.cl-today small{display:block;color:#cfb1c8}.cl-today b{font-size:21px}
.cl-today .cl-st{margin-inline-start:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cl-today .cl-st button{font:inherit;font-weight:700;border:0;border-radius:12px;padding:9px 16px;cursor:pointer;background:#6f7d45;color:#fff}
.cl-today .cl-st span{background:rgba(255,255,255,.12);border-radius:999px;padding:4px 12px;font-weight:700}
.cl-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
@media (max-width:900px){.cl-wk{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cl-d{border:1.5px solid var(--line);border-radius:14px;padding:10px;background:var(--card);display:grid;gap:6px;align-content:start;min-height:118px}
.cl-d.td{border-color:var(--acc,#8a5a83);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc,#8a5a83) 25%,transparent)}
.cl-d.off{opacity:.55;background:transparent;border-style:dashed}
.cl-d .dn{font-weight:700;font-size:14.5px}.cl-d .dt{font-size:12px;color:var(--mut)}
.cl-d .ws{font-size:14px;line-height:1.5}
.cl-d .chp{justify-self:start;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700;background:var(--field,#f2e9dd)}
.cl-d .chp.ok{background:color-mix(in srgb,#6f7d45 18%,transparent);color:#4e5a2c}
.cl-d .chp.no{background:color-mix(in srgb,#e5372b 14%,transparent);color:#b3261e}
.cl-d .chp.wt{background:color-mix(in srgb,#e8740c 15%,transparent);color:#a4520a}
.cl-d .acts{display:flex;gap:6px;flex-wrap:wrap}
.cl-d .acts button{font:inherit;font-size:12.5px;font-weight:600;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:4px 9px;cursor:pointer}
.cl-d .acts button.p{background:#6f7d45;border-color:#6f7d45;color:#fff}
.cl-stars{color:#e0a106;letter-spacing:1px}
.cl-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.cl-nav h3{margin:0}.cl-nav .sp{flex:1}
.cl-m{display:none;position:fixed;inset:0;z-index:78;background:rgba(0,0,0,.55);overflow:auto;padding:18px}.cl-m.on{display:block}
.cl-m>.k{max-width:460px;margin:6vh auto;background:var(--card);color:var(--ink);border-radius:18px;padding:20px 22px}
.cl-m h3{margin:0 0 4px}.cl-m label.t{display:block;font-size:13.5px;color:var(--mut);margin:12px 0 6px}
.cl-m .wp{display:flex;gap:10px;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding:9px 12px;margin:6px 0;cursor:pointer}.cl-m .wp input{width:20px;height:20px;flex:none}
.cl-m .wp:has(input:checked){border-color:var(--acc);background:var(--soft)}
.cl-m .wp small{color:var(--mut);margin-inline-start:auto}
.cl-m .rate{display:flex;gap:6px;direction:ltr;justify-content:flex-end}
.cl-m .rate button{font-size:26px;line-height:1;border:0;background:none;cursor:pointer;color:#cfc6bb;padding:2px}
.cl-m .rate button.on{color:#e0a106}
.cl-m textarea{font:inherit;width:100%;border:1.5px solid var(--line);background:var(--field,#f2e9dd);color:var(--ink);border-radius:12px;padding:9px 12px;min-height:64px}
.cl-m .act{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.cl-m .act button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:9px 16px;cursor:pointer}
.cl-m .act button.p{background:#6f7d45;border-color:#6f7d45;color:#fff}.cl-m .act button.r{color:#c4362b}
.cl-m .act button:disabled{opacity:.6}
.cl-team{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
.cl-team .cl-tm{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;font-size:14px;font-weight:600}
.cl-team .cl-tm small{color:var(--mut);font-weight:500;font-size:12px}
.cl-add{display:flex;flex-wrap:wrap;gap:8px}.cl-add input{flex:1;min-width:200px;font:inherit;border:1.5px solid var(--line);background:var(--field,#f2e9dd);color:var(--ink);border-radius:12px;padding:9px 12px}
.cl-champ{display:flex;align-items:center;gap:12px;border:1.5px solid color-mix(in srgb,#e0a106 45%,var(--line));background:color-mix(in srgb,#e0a106 9%,var(--card));border-radius:14px;padding:12px 16px;margin-bottom:12px}
.cl-champ .ic{font-size:30px}.cl-champ small{display:block;color:var(--mut)}.cl-champ b{font-size:19px}.cl-champ .sc{margin-inline-start:auto;font-size:26px;font-weight:700}
`;

// ---------- البداية ----------
// ctx: {db, toast, admin (يقيّم ويبدّل), owner, me:{e,n}, workers:()=>W, redraw(), active()}
export function initClean(ctx){
 stopClean();X=ctx;W=ctx.workers||(()=>[]);
 if(!g("cl-css")){const s=document.createElement("style");s.id="cl-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 const re=()=>{if(X&&X.active&&X.active())X.redraw()};
 un.push(onSnapshot(collection(X.db,"clean"),sn=>{C={};sn.docs.forEach(d=>{C[d.id]=d.data()});re()},()=>{}));
 un.push(onSnapshot(doc(X.db,"cleancfg","main"),d=>{CFG=d.exists()?d.data():null;re()},()=>{}));
}
export function stopClean(){un.forEach(f=>f());un=[];C={};CFG=null;closeM();X=null}

// ---------- الواجهة ----------
// كام مرة كل عامل بينضّف في الأسبوع (أيام النظافة ÷ عدد الأزواج)
const perW=(nd,nw)=>{const np=Math.max(1,Math.floor(nw/2)),p=nd/np;return p===2?"كل عامل ينظّف مرتين في الأسبوع.":p===1?"كل عامل ينظّف مرة في الأسبوع.":p>=1?"كل عامل ينظّف مرة أو أكثر في الأسبوع.":"بعض العمال لن يأتي دورهم كل أسبوع (أيام النظافة أقل من عدد الأزواج)."};
const stars=n=>n?`<span class="cl-stars" aria-label="${n} من 5">${"★".repeat(n)}${"☆".repeat(5-n)}</span>`:"";
function chip(x,isOff){
 const r=x.rec;if(isOff)return "";
 if(r&&r.st==="done")return `<span class="chp ok">✅ نظّف ${stars(N(r.r))}</span>`;
 if(r&&r.st==="miss")return `<span class="chp no">❌ لم ينظّف</span>`;
 if(x.k<todayKey())return `<span class="chp wt">⏳ لم يُقيَّم</span>`;
 if(x.k===todayKey())return `<span class="chp wt">🧹 اليوم</span>`;
 return "";
}
export function cleanView(mo){
 if(!X)return "";
 const A=active();
 if(A.length<2)return `<div class="pan"><h3>🧹 جدول النظافة</h3><p class="off">أضف عاملين على الأقل في «تقييم العمال» حتى يبدأ جدول النظافة.</p></div>`;
 const tk=todayKey(),sat=addD(satOf(new Date()),WOFF*7),plan=weekPlan(sat),D=days();
 const td=weekPlan(satOf(new Date())).find(x=>x.k===tk);
 const tdHtml=td?`<div class="cl-today"><div class="ic">🧹</div><div><small>نظافة اليوم · ${DAYN[new Date().getDay()]} <bdi dir="ltr">${tk}</bdi></small><b>${E(names(didOf(td.as,td.rec)))}</b>${absOf(td.as,td.rec).length?`<small>غاب: ${E(names(absOf(td.as,td.rec)))}</small>`:""}</div>
  <div class="cl-st">${td.rec&&td.rec.st==="done"?`<span>✅ تمت ${stars(N(td.rec.r))}</span>`:td.rec&&td.rec.st==="miss"?`<span>❌ لم تتم</span>`:""}${X.admin?`<button type="button" data-cl="ev" data-k="${tk}">${td.rec&&td.rec.st?"✏️ تعديل التقييم":"✅ تقييم نظافة اليوم"}</button>`:""}</div></div>`
  :`<div class="cl-today"><div class="ic">🧹</div><div><small>${DAYN[new Date().getDay()]} <bdi dir="ltr">${tk}</bdi></small><b>اليوم إجازة من النظافة</b></div></div>`;
 // الأسبوع: كل الأيام من السبت للجمعة، والأيام اللي مفيهاش نظافة باهتة
 const cells=WEEK.map(dow=>{const k=dkey(addD(sat,WEEK.indexOf(dow))),x=plan.find(p=>p.dow===dow),isOff=!x||k<since();
  const it=x||{k,as:[],rec:C[k]};
  return `<div class="cl-d ${k===tk?"td":""} ${isOff?"off":""}"><div><div class="dn">${DAYN[dow]}</div><div class="dt"><bdi dir="ltr">${k}</bdi></div></div>
  ${isOff?`<div class="ws off">${x?"—":"بدون نظافة"}</div>`:`<div class="ws">👷 ${E(names(didOf(it.as,it.rec)))}${absOf(it.as,it.rec).length?`<div class="dt">غاب: ${E(names(absOf(it.as,it.rec)))}</div>`:""}${it.rec&&it.rec.sw&&!it.rec.st?` <small class="off">(تبديل)</small>`:""}</div>${chip(it,false)}
  ${it.rec&&it.rec.note?`<div class="dt" data-notr>🗒 ${E(it.rec.note)}</div>`:""}
  ${X.admin?`<div class="acts">${k<=tk?`<button type="button" class="${it.rec&&it.rec.st?"":"p"}" data-cl="ev" data-k="${k}">${it.rec&&it.rec.st?"✏️ تعديل":"✅ تقييم"}</button>`:""}${!(it.rec&&it.rec.st)?`<button type="button" data-cl="sw" data-k="${k}">🔁 تبديل</button>`:""}</div>`:""}`}</div>`}).join("");
 const L=monthStats(mo),top=L.find(s=>s.avg!=null);
 const sw=WOFF===0?"هذا الأسبوع":WOFF===1?"الأسبوع القادم":WOFF===-1?"الأسبوع الماضي":`<bdi dir="ltr">${dkey(sat)}</bdi>`;
 return `${tdHtml}
 <div class="pan"><div class="cl-nav"><h3>🗓 جدول النظافة · ${sw}</h3><span class="sp"></span>
  <button class="bt s" data-cl="wk" data-v="-1" type="button" aria-label="الأسبوع السابق">→</button><button class="bt s" data-cl="wk" data-v="0" type="button">هذا الأسبوع</button><button class="bt s" data-cl="wk" data-v="1" type="button" aria-label="الأسبوع التالي">←</button>
  <button class="bt s" data-cl="pr" type="button">🖨 طباعة الجدول</button>${X.admin?`<button class="bt s" data-cl="cfg" type="button">⚙ أيام النظافة</button>`:""}</div>
 <div class="cl-wk">${cells}</div>
 <p class="wnote" style="margin-top:10px">كل يوم عاملان، والأزواج تتغيّر كل أسبوع حتى يعمل كل عامل مع زملاء مختلفين. ${perW(D.length,A.length)} «تبديل» لتغيير من سينظّف في يوم معيّن (غياب أو إجازة).</p></div>
 <div class="pan" style="margin-top:12px"><h3>👥 فريق النظافة (${A.length})</h3><div class="cl-team">${A.map(w=>`<span class="cl-tm"><bdi data-notr>${E(w.name)}</bdi>${w.cl?` <small>🧹 نظافة فقط</small>`:""}</span>`).join("")}</div>
 ${X.admin?`<div class="cl-add"><input id="cl-new" maxlength="200" placeholder="أضف عاملاً أو أكثر، افصل بين الأسماء بفاصلة. مثال: عثمان، عبد الوهاب"><button class="bt p" data-cl="addw" type="button">➕ إضافة لفريق النظافة</button></div><p class="wnote" style="margin-top:8px">من يُضاف من هنا يظهر في جدول النظافة فقط، ولا يدخل في تقييم تجهيز الطلبات. يمكنك تغيير ذلك من تبويب «تقييم العمال».</p>`:""}</div>
 <div class="pan" style="margin-top:12px"><h3>🏆 ترتيب النظافة · <bdi dir="ltr">${E(mo)}</bdi></h3>
 ${top?`<div class="cl-champ"><div class="ic">🧹</div><div><small>بطل النظافة لهذا الشهر</small><b>${E(nm(top.id))}</b><small>نظّف ${top.done} يوم · متوسط التقييم ${top.avg.toFixed(1)} من 5</small></div><div class="sc">${top.score}</div></div>`:""}
 <div class="tw"><table><thead><tr><th>#</th><th>العامل</th><th>الدرجة</th><th>متوسط التقييم</th><th>أيام نظّفها</th><th>غاب عن دوره</th><th>ساعد في غير يومه</th></tr></thead><tbody>
 ${L.length?L.map((s,i)=>`<tr><td>${i+1}</td><td><b>${E(nm(s.id))}</b></td><td><span class="wsc ${s.score>=80?"a":s.score>=60?"b":"c"}">${s.score}</span></td><td>${s.avg==null?"—":`${stars(Math.round(s.avg))} <small class="off">${s.avg.toFixed(1)}</small>`}</td><td>${s.done}</td><td>${s.miss?`<span style="color:#c4362b;font-weight:700">${s.miss}</span>`:"0"}</td><td>${s.extra||"—"}</td></tr>`).join(""):`<tr><td colspan="7" class="off" style="text-align:center;padding:20px">لم يُقيَّم أي يوم نظافة في هذا الشهر بعد.</td></tr>`}
 </tbody></table></div>
 <p class="wnote">الدرجة من 100: <b>جودة النظافة 70</b> (متوسط النجوم في الأيام التي نظّفها) · <b>الالتزام 30</b> (نظّف في أيامه دون غياب). يتغيّر الشهر من القائمة في الأعلى.</p></div>`;
}

// ---------- النوافذ ----------
function box(){let m=g("clm");if(!m){m=document.createElement("div");m.id="clm";m.className="cl-m";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(h){const m=box();m.innerHTML=`<div class="k">${h}</div>`;m.className="cl-m on"}
function closeM(){const m=g("clm");if(m){m.className="cl-m";m.innerHTML=""}busy=false}
const planOf=k=>{const p=weekPlan(satOf(fromKey(k))).find(x=>x.k===k);return p||{k,as:[],rec:C[k]}};
const who=()=>({e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)});
const err=async e=>{const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")};
// التقييم: مين نضّف فعلاً (المكلّفين متعلّم عليهم) + النجوم + ملاحظة
function evForm(k){
 const p=planOf(k),r=p.rec||{},did=r.st==="done"&&Array.isArray(r.ws)?r.ws:(r.st==="miss"?[]:p.as);ST=N(r.r)||0;
 const A=active(),extra=(Array.isArray(r.ws)?r.ws:[]).filter(id=>!A.some(w=>w.id===id));
 openM(`<h3>🧹 تقييم النظافة</h3><p class="off" style="margin:0">${DAYN[fromKey(k).getDay()]} <bdi dir="ltr">${E(k)}</bdi> · المكلّفان: ${E(names(p.as))}</p>
 <label class="t">من نظّف فعلاً؟</label>
 ${A.concat(extra.map(id=>({id,name:nm(id)}))).map(w=>`<label class="wp"><input type="checkbox" value="${E(w.id)}" ${did.indexOf(w.id)>=0?"checked":""}><b>${E(w.name)}</b>${p.as.indexOf(w.id)>=0?`<small>مكلّف اليوم</small>`:""}</label>`).join("")}
 <label class="t">تقييم النظافة</label><div class="rate" id="cl-rate">${[1,2,3,4,5].map(n=>`<button type="button" data-n="${n}" class="${n<=ST?"on":""}" aria-label="${n} من 5">★</button>`).join("")}</div>
 <label class="t">ملاحظة (اختياري)</label><textarea id="cl-nt" maxlength="300" placeholder="مثلاً: الممرات نظيفة لكن الكراتين لم تُرتَّب">${E(r.note||"")}</textarea>
 <div class="act"><button class="p" data-cl="evsave" data-k="${E(k)}" type="button">حفظ التقييم</button><button class="r" data-cl="evmiss" data-k="${E(k)}" type="button">❌ لم ينظّف أحد</button>${r.st?`<button class="r" data-cl="evdel" data-k="${E(k)}" type="button">مسح التقييم</button>`:""}<button data-cl="close" type="button">رجوع</button></div>`);
 g("cl-rate").onclick=e=>{const b=e.target.closest("[data-n]");if(!b)return;ST=+b.dataset.n;g("cl-rate").querySelectorAll("button").forEach(x=>x.classList.toggle("on",+x.dataset.n<=ST))};
}
async function evSave(k,miss){
 if(busy)return;const p=planOf(k),ws=miss?[]:[...document.querySelectorAll("#clm .wp input:checked")].map(i=>i.value).slice(0,12);
 if(!miss&&!ws.length){X.toast("اختر من نظّف، أو اضغط «لم ينظّف أحد»");return}
 if(!miss&&!ST){X.toast("اختر عدد النجوم");return}
 const note=(g("cl-nt").value||"").trim().slice(0,300);
 const d={d:k,as:p.as.slice(0,12),st:miss?"miss":"done",by:who(),at:Date.now()};if(!miss){d.ws=ws;d.r=ST}if(note)d.note=note;
 busy=true;try{await withTimeout(setDoc(doc(X.db,"clean",k),d),15000);busy=false;X.toast(miss?"سُجّل أن النظافة لم تتم":"✅ حُفظ تقييم النظافة");closeM()}catch(e){busy=false;err(e)}
}
async function evDel(k){
 if(busy)return;const r=C[k];if(!r)return closeM();if(!confirm("مسح تقييم هذا اليوم؟"))return;
 busy=true;try{// لو كان فيه تبديل بنسيبه، غير كده بنمسح اليوم
  if(r.sw)await withTimeout(setDoc(doc(X.db,"clean",k),{d:k,as:r.as,sw:true,by:who(),at:Date.now()}),15000);else await withTimeout(deleteDoc(doc(X.db,"clean",k)),15000);
  busy=false;X.toast("مُسح التقييم");closeM()}catch(e){busy=false;err(e)}
}
// التبديل: مين هينضّف في يوم معيّن (قبل التقييم)
function swForm(k){
 const p=planOf(k),A=active();
 openM(`<h3>🔁 تبديل عمال النظافة</h3><p class="off" style="margin:0">${DAYN[fromKey(k).getDay()]} <bdi dir="ltr">${E(k)}</bdi></p>
 <label class="t">من سينظّف في هذا اليوم؟ (عاملان عادةً)</label>
 ${A.map(w=>`<label class="wp"><input type="checkbox" value="${E(w.id)}" ${p.as.indexOf(w.id)>=0?"checked":""}><b>${E(w.name)}</b></label>`).join("")}
 <div class="act"><button class="p" data-cl="swsave" data-k="${E(k)}" type="button">حفظ</button>${C[k]&&C[k].sw?`<button class="r" data-cl="swreset" data-k="${E(k)}" type="button">رجوع للجدول الأصلي</button>`:""}<button data-cl="close" type="button">رجوع</button></div>`);
}
async function swSave(k,reset){
 if(busy)return;busy=true;
 try{if(reset){await withTimeout(deleteDoc(doc(X.db,"clean",k)),15000);busy=false;X.toast("رجع اليوم للجدول الأصلي");closeM();return}
  const as=[...document.querySelectorAll("#clm .wp input:checked")].map(i=>i.value).slice(0,12);
  if(!as.length){busy=false;X.toast("اختر عاملاً واحداً على الأقل");return}
  await withTimeout(setDoc(doc(X.db,"clean",k),{d:k,as,sw:true,by:who(),at:Date.now()}),15000);busy=false;X.toast("✅ حُفظ التبديل");closeM()}
 catch(e){busy=false;err(e)}
}
// إضافة عمال نظافة (أكتر من اسم مرة واحدة). الموجود بنفس الاسم مابيتكررش، والموقوف بيتفعّل
async function addWorkers(){
 if(busy)return;const inp=g("cl-new");if(!inp)return;
 const names=[...new Set(String(inp.value||"").split(/[,،;\n]+/).map(x=>x.replace(/\s+/g," ").trim().slice(0,40)).filter(Boolean))].slice(0,12);
 if(!names.length){X.toast("اكتب اسم عامل واحد على الأقل");return}
 const all=W(),low=s=>String(s).toLowerCase(),b=writeBatch(X.db);let added=0,woke=0,had=[];
 names.forEach(n=>{const ex=all.find(w=>low(w.name)===low(n));
  if(ex){if(ex.active===false){b.set(doc(X.db,"workers",ex.id),{active:true},{merge:true});woke++}else had.push(n)}
  else{b.set(doc(collection(X.db,"workers")),{name:n,active:true,cl:true,ts:Date.now()});added++}});
 if(!added&&!woke){X.toast(had.length>1?"هؤلاء موجودون بالفعل في فريق النظافة":"هذا العامل موجود بالفعل في فريق النظافة");return}
 busy=true;
 try{await withTimeout(b.commit(),15000);busy=false;inp.value="";
  X.toast("✅ "+(added?"أُضيف "+added+(added>1?" عمال":" عامل")+" لفريق النظافة":"")+(woke?(added?" · ":"")+"أُعيد تفعيل "+woke:"")+(had.length?" · موجود بالفعل: "+had.join("، "):""))}
 catch(e){busy=false;err(e)}
}
function cfgForm(){
 const D=days();
 openM(`<h3>⚙ أيام النظافة</h3><p class="off" style="margin:0">اختر الأيام التي ينظّف فيها العمال المستودع.</p>
 ${WEEK.map(d=>`<label class="wp"><input type="checkbox" value="${d}" ${D.indexOf(d)>=0?"checked":""}><b>${DAYN[d]}</b></label>`).join("")}
 <div class="act"><button class="p" data-cl="cfgsave" type="button">حفظ</button><button data-cl="close" type="button">رجوع</button></div>`);
}
async function cfgSave(){
 if(busy)return;const ds=[...document.querySelectorAll("#clm .wp input:checked")].map(i=>+i.value).filter(n=>n>=0&&n<=6);
 if(!ds.length){X.toast("اختر يوماً واحداً على الأقل");return}
 busy=true;try{await withTimeout(setDoc(doc(X.db,"cleancfg","main"),{days:ds,since:since(),by:who(),at:Date.now()}),15000);busy=false;X.toast("✅ حُفظت أيام النظافة");closeM()}catch(e){busy=false;err(e)}
}
// ورقة تتعلّق في المستودع: الأسبوع المعروض
function print(){
 const sat=addD(satOf(new Date()),WOFF*7),plan=weekPlan(sat);
 printStmt(`<div class="st"><div class="ph"><h2>جدول نظافة المستودع</h2><div>الأسبوع من <bdi dir="ltr">${dkey(sat)}</bdi> إلى <bdi dir="ltr">${dkey(addD(sat,6))}</bdi></div></div>
 <table class="stt"><thead><tr><th>اليوم</th><th>التاريخ</th><th>العاملان</th><th>تمت</th><th>التوقيع</th></tr></thead><tbody>
 ${plan.map(x=>`<tr><td>${DAYN[x.dow]}</td><td class="n">${x.k}</td><td><b>${E(names(x.as))}</b></td><td style="width:18mm"></td><td style="width:40mm"></td></tr>`).join("")}</tbody></table>
 <p style="font-size:10pt;color:#444">النظافة تشمل: الممرات، أرضية المستودع، منطقة التجهيز، ترتيب الكراتين، وإخراج المخلفات.</p>
 <div class="sg"><span>مسؤول المستودع</span><span>المدير</span></div></div>`);
}

// ---------- الضغطات ----------
document.addEventListener("click",e=>{
 if(!X)return;const t=e.target.closest&&e.target.closest("[data-cl]");if(!t)return;
 const a=t.dataset.cl,k=t.dataset.k;
 if(a==="close")return void closeM();
 if(a==="wk"){const v=+t.dataset.v;WOFF=v===0?0:Math.max(-26,Math.min(4,WOFF+v));X.redraw();return}
 if(a==="pr")return void print();
 if(!X.admin){X.toast("هذه الصلاحية للمدير فقط");return}
 if(k&&!/^\d{4}-\d{2}-\d{2}$/.test(k))return;
 if(a==="ev")return void evForm(k);
 if(a==="evsave")return void evSave(k,false);
 if(a==="evmiss")return void evSave(k,true);
 if(a==="evdel")return void evDel(k);
 if(a==="sw")return void swForm(k);
 if(a==="swsave")return void swSave(k,false);
 if(a==="swreset")return void swSave(k,true);
 if(a==="cfg")return void cfgForm();
 if(a==="cfgsave")return void cfgSave();
 if(a==="addw")return void addWorkers();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&g("clm")&&g("clm").classList.contains("on"))closeM()});
