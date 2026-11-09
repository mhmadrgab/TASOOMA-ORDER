// 📢 التعميمات (نوفمبر 2026، طلب محمد): "جروب" فيه المستودع والمدير وكل الفروع. المالك والمديرين بيبعتوا، والكل بيشوف.
// ann/{id} = {t: النص, by: إيميل اللي بعت, n: اسمه, ts}. ann/{id}/rd/{الطرف} = {ts, n} قرأها إمتى (الطرف = كود الفرع أو الإيميل)
// الإشعار لكل الأجهزة من السيرفر (/ann) على دفعات (annPush في fb.js). العلامة الحمرا على الزرار = جديد من آخر مرة فتحت (على الجهاز ده).
import {collection,doc,addDoc,setDoc,getDoc,getDocs,onSnapshot,query,orderBy,limit,withTimeout,failReason,FAIL_MSG,annPush} from "./fb.js";
const g=id=>document.getElementById(id);
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const LS="ann_seen";
let X=null,UN=null,A=[],CNT={},RDU=null,busy=false;
const CSS=`
#annb{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:linear-gradient(135deg,#f1d58e,#a8832f);color:#1b1b1b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;position:relative}
#annb i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#annb.nw{animation:ann-ring 1.8s ease-in-out infinite}@keyframes ann-ring{0%,100%{transform:rotate(0)}8%{transform:rotate(-8deg)}16%{transform:rotate(8deg)}24%{transform:rotate(0)}}
#annm{display:none;position:fixed;inset:0;z-index:86;background:rgba(0,0,0,.55);padding:14px;overflow:auto;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}#annm.on{display:block}
.annk{max-width:640px;margin:3vh auto;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.annh{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(120deg,#2b2416,#1b1b1b);color:#fff;border-bottom:3px solid #d4ae5c}
.annh b{font-size:19px;display:block}.annh small{color:#cdb67a;font-size:12.5px}.annh button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;width:38px;height:38px;cursor:pointer;font-size:17px}
.annc{padding:14px 18px;border-bottom:1px solid var(--line);background:var(--soft,#f6f2e9)}
.annc textarea{width:100%;min-height:90px;resize:vertical;font:inherit;font-size:16px;line-height:1.6;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:10px 14px}
.annc .row{display:flex;gap:8px;align-items:center;margin-top:8px}.annc .row small{color:var(--mut);font-size:12.5px;flex:1}
.annc button{font:inherit;font-weight:800;border:0;border-radius:12px;padding:10px 18px;background:#1b1b1b;color:#fff;cursor:pointer}.annc button:disabled{opacity:.5}
.annl{padding:12px 18px 18px;max-height:62vh;overflow:auto}
.anni{border-radius:16px;padding:12px 16px;margin-top:10px;background:var(--card);border:1.5px solid var(--line);border-inline-start:5px solid #d4ae5c}
.anni.nw{background:#fff8e6}.anni .hd2{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--mut)}.anni .hd2 b{color:var(--ink);font-size:14.5px}
.anni .tx{white-space:pre-wrap;word-wrap:break-word;font-size:16px;line-height:1.7;margin-top:6px}
.anni .rd{margin-top:8px;font-size:12.5px;color:#1d6fb8;font-weight:700;cursor:pointer}
.annrd{margin-top:6px;font-size:12.5px;color:var(--mut);line-height:1.9}
.anne{text-align:center;color:var(--mut);padding:30px 10px;line-height:2}
@media (prefers-color-scheme:dark){.anni.nw{background:#2b2210}}
@media print{#annb,#annm{display:none!important}}
`;
const me=()=>X&&X.party;
const seen=()=>{try{return N(localStorage.getItem(LS))}catch(e){return 0}};
const markSeen=()=>{const t=A.length?N(A[0].ts):0;try{localStorage.setItem(LS,String(Math.max(seen(),t)))}catch(e){}paintBtn()};
const unread=()=>A.filter(a=>N(a.ts)>seen()&&a.by!==X.email).length;
function paintBtn(){const b=g("annb");if(!b)return;const n=unread();b.innerHTML=`📢 التعميمات${n?` <i>${n}</i>`:""}`;b.classList.toggle("nw",!!n);if(X&&X.onBadge)X.onBadge(n)}
// زرار جاهز كـ HTML (لوحة المستودع بتعيد رسم الشريط كتير)
export const annBtn=()=>{if(!X)return "";const n=unread();return `<button id="annb" type="button" data-annopen class="${n?"nw":""}">📢 التعميمات${n?` <i>${n}</i>`:""}</button>`};
const when=t=>new Date(N(t)).toLocaleString("ar-EG-u-nu-latn",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

// ctx: {db, auth, toast, party: "003" | إيميل, email, name(), canPost, mount(btn), total: عدد الفروع (للقراءة)}
export function initAnn(ctx){
  stopAnn();X=ctx;
  if(!g("ann-css")){const s=document.createElement("style");s.id="ann-css";s.textContent=CSS;document.head.appendChild(s)}
  if(X.mount){const b=document.createElement("button");b.id="annb";b.type="button";b.dataset.annopen="1";X.mount(b)}paintBtn();
  // آخر 30 تعميم (قراءة خفيفة)
  UN=onSnapshot(query(collection(X.db,"ann"),orderBy("ts","desc"),limit(30)),sn=>{
    const old=A.length?N(A[0].ts):0;A=sn.docs.map(d=>({id:d.id,...d.data()}));paintBtn();
    const nw=A[0];if(old&&nw&&N(nw.ts)>old&&nw.by!==X.email&&X.toast)X.toast(`📢 تعميم جديد من ${nw.n||"الإدارة"}`);
    if(g("annm")&&g("annm").classList.contains("on")){paint();markRead()}
  },()=>{});
  if(new URLSearchParams(location.search).get("ann"))setTimeout(open,900);
}
export function stopAnn(){if(UN){UN();UN=null}if(RDU){RDU();RDU=null}A=[];CNT={};const b=g("annb");if(b)b.remove();const m=g("annm");if(m)m.remove();X=null}

function box(){let m=g("annm");if(!m){m=document.createElement("div");m.id="annm";m.addEventListener("click",e=>{if(e.target===m)close()});document.body.appendChild(m)}return m}
function close(){const m=g("annm");if(m)m.className="";markSeen()}
function open(){if(!X)return;const m=box();m.className="on";paint();markRead();markSeen()}
function paint(){
  const m=g("annm");if(!m||!X)return;const s=seen(),keep=g("annt")?g("annt").value:"";
  m.innerHTML=`<div class="annk"><div class="annh"><span style="font-size:30px">📢</span><div><b>التعميمات</b><small>رسائل الإدارة والمستودع لكل الفروع</small></div><button type="button" data-annx aria-label="إغلاق">✕</button></div>
  ${X.canPost?`<div class="annc"><textarea id="annt" maxlength="2000" placeholder="اكتب تعميماً يصل إلى كل الفروع والمستودع..."></textarea><div class="row"><small>سيصل إشعار فوري لكل الفروع والمستودع</small><button type="button" data-anns>📢 إرسال للجميع</button></div></div>`:""}
  <div class="annl">${A.length?A.map(a=>`<div class="anni${N(a.ts)>s&&a.by!==X.email?" nw":""}"><div class="hd2"><b>${E(a.n||"الإدارة")}</b><span>· ${when(a.ts)}</span></div><div class="tx" data-notr>${E(a.t)}</div>
   ${X.canPost?`<div class="rd" data-annr="${E(a.id)}">👁 ${CNT[a.id]!=null?`قرأه ${CNT[a.id].n}`:"من قرأه؟"}</div>${CNT[a.id]&&CNT[a.id].open?`<div class="annrd">${CNT[a.id].names.map(E).join(" · ")||"لا أحد بعد"}</div>`:""}`:""}</div>`).join(""):`<div class="anne">📭<br>لا توجد تعميمات بعد</div>`}</div></div>`;
  const t=g("annt");if(t&&keep)t.value=keep;
}
// "قرأتها": كل طرف بيسجّل مرة واحدة على آخر التعميمات اللي ظهرتله
async function markRead(){
  if(!X)return;const p=me();if(!p)return;
  for(const a of A.slice(0,10)){if(a.by===X.email||a._r)continue;a._r=1;
    try{const ref=doc(X.db,"ann",a.id,"rd",p),s=await getDoc(ref);if(!s.exists())await setDoc(ref,{ts:Date.now(),n:String(X.name()||p).slice(0,60)})}catch(e){}}
}
async function readers(id){
  try{const sn=await withTimeout(getDocs(collection(X.db,"ann",id,"rd")),15000);const names=sn.docs.map(d=>d.data().n||d.id);CNT[id]={n:names.length,names,open:!(CNT[id]&&CNT[id].open)};paint()}
  catch(e){X.toast("تعذر تحميل من قرأ التعميم")}
}
async function post(){
  if(busy||!X||!X.canPost)return;const t=String((g("annt")||{}).value||"").trim().slice(0,2000);
  if(!t){X.toast("اكتب نص التعميم أولاً");return}
  if(!confirm("إرسال هذا التعميم إلى كل الفروع والمستودع؟"))return;
  busy=true;const b=document.querySelector("[data-anns]");if(b){b.disabled=true;b.textContent="⏳ جاري الإرسال..."}
  try{const ref=await withTimeout(addDoc(collection(X.db,"ann"),{t,by:X.email,n:String(X.name()||"الإدارة").slice(0,60),ts:Date.now()}),20000);
    g("annt").value="";X.toast("📢 أُرسل التعميم، وجاري إبلاغ الجميع");annPush(X.auth,ref.id)}
  catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
  busy=false;const b2=document.querySelector("[data-anns]");if(b2){b2.disabled=false;b2.textContent="📢 إرسال للجميع"}
}
document.addEventListener("click",e=>{
  if(!X)return;const t=e.target;
  if(t.closest("[data-annopen]"))return void open();
  if(t.closest("[data-annx]"))return void close();
  if(t.closest("[data-anns]"))return void post();
  const r=t.closest("[data-annr]");if(r)return void readers(r.dataset.annr);
});
