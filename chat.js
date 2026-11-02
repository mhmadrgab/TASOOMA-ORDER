// محادثة جوه كل طلب بين الفرع والمستودع (بدل جروب الواتساب)
// الرسايل محفوظة على الطلب نفسه: requests/{id}.msgs = [{id, by:"br"|"wh", n:الاسم, t:النص, ts}]
// كده مفيش أي قراءة زيادة من Firebase: الصفحة أصلاً بتسمع للطلبات، والرسايل بتيجي معاها.
// "اتقرت لحد فين" محفوظة على الجهاز نفسه (localStorage)، والسيرفر بيبعت إشعار للطرف التاني (ping).
import {doc,updateDoc,arrayUnion,withTimeout,failReason,FAIL_MSG} from "./fb.js";
const MAX=200,LEN=500;// نفس الحدود اللي في firestore.rules
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
let X=null,OPEN=null,LAST={},busy=false;
const QUICK={br:["محتاجينه ضروري 🙏","الطلب هيوصل امتى؟","تمام، شكراً 👍"],wh:["الصنف مش موجود حالياً","هيتبعت مع الطلب الجاي","تمام، جاري التجهيز 👍"]};
const CSS=`
.chb{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13.5px;font-weight:700;border-radius:999px;padding:5px 13px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap}
.chb:hover{border-color:var(--acc)}.chb b{background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px;text-align:center;animation:ch-pop .3s ease}
.chb.nw{border-color:#c0392b;box-shadow:0 0 0 3px rgba(192,57,43,.12)}
@keyframes ch-pop{0%{transform:scale(.4)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
#chm{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.55);padding:14px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#chm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
.chk{width:100%;max-width:560px;height:min(680px,calc(100dvh - 28px));background:var(--card);color:var(--ink);border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.chh{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#1b1b1b,#2b2416);color:#f3e7c8}
.chh>div{flex:1;min-width:0}.chh b{display:block;font-size:16.5px}.chh small{display:block;opacity:.75;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chh button{font:inherit;background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer;flex:none}
.chl{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px;background:var(--soft,#f6f2e9)}
.chl .ce{margin:auto;text-align:center;color:var(--mut);font-size:14px;line-height:1.8;padding:20px}
.chd{align-self:center;font-size:11.5px;color:var(--mut);background:var(--card);border-radius:999px;padding:2px 12px;margin:6px 0}
.cmsg{max-width:82%;border-radius:16px;padding:7px 12px 6px;font-size:15px;line-height:1.6;word-wrap:break-word;white-space:pre-wrap;animation:ui-fade .2s ease both}
.cmsg i{display:block;font-style:normal;font-size:11.5px;font-weight:700;opacity:.7;margin-bottom:1px}
.cmsg small{display:block;font-size:11px;opacity:.6;text-align:left;margin-top:2px}
.cmsg.me{align-self:flex-start;background:#d4ae5c;color:#1b1b1b;border-start-start-radius:5px}
.cmsg.ot{align-self:flex-end;background:var(--card);color:var(--ink);border:1px solid var(--line);border-start-end-radius:5px}
.chq{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 0;scrollbar-width:none}.chq::-webkit-scrollbar{display:none}
.chq button{font:inherit;font-size:13px;white-space:nowrap;border-radius:999px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:5px 12px;cursor:pointer;flex:none}
.chf{display:flex;gap:8px;align-items:flex-end;padding:10px}
.chf textarea{flex:1;resize:none;font:inherit;font-size:16px;line-height:1.5;max-height:120px;min-height:46px;border-radius:14px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:10px 12px}
.chf textarea:focus{outline:0;border-color:var(--acc)}
.chf button{font:inherit;font-weight:800;border:0;border-radius:14px;height:46px;padding:0 18px;background:#1b1b1b;color:#fff;cursor:pointer;flex:none}
.chf button:disabled{opacity:.5}
.chn{font-size:12px;color:var(--mut);text-align:center;padding:0 10px 8px}
@media (prefers-color-scheme:dark){.chf button{background:#d4ae5c;color:#1b1b1b}.cmsg.ot{background:#262626}}
@media print{.chb,#chm{display:none!important}}
`;
// ---------- اتقرت لحد فين (على الجهاز) ----------
const SK=()=>"chs_"+X.me;
let SM=null;// نسخة في الذاكرة علشان ما نقراش من التخزين مع كل كارت
function seenMap(){if(SM)return SM;try{SM=JSON.parse(localStorage.getItem(SK())||"{}")||{}}catch(e){SM={}}return SM}
function saveSeen(m){SM=m;try{const old=Date.now()-120*864e5;Object.keys(m).forEach(k=>{if(k!=="_b"&&m[k]<old)delete m[k]});localStorage.setItem(SK(),JSON.stringify(m))}catch(e){}}
// أول مرة الجهاز يفتح: الرسايل الأقدم من 3 أيام ما تتحسبش "جديدة"
function base(m){if(!m._b){m._b=Date.now()-3*864e5;saveSeen(m)}return m._b}
const list=r=>(r&&Array.isArray(r.msgs)?r.msgs:[]).filter(m=>m&&typeof m==="object"&&typeof m.t==="string");
// عدد الرسايل الجديدة من الطرف التاني
export function unread(r){
  if(!X||!r)return 0;const m=seenMap(),s=Math.max(base(m),N(m[r.id]));
  return list(r).filter(x=>x.by!==X.by&&N(x.ts)>s).length;
}
function markSeen(r){if(!r)return;const L=list(r),m=seenMap();m[r.id]=Math.max(N(m[r.id]),...L.map(x=>N(x.ts)),Date.now());saveSeen(m)}
// زرار المحادثة على كارت الطلب
export function chatBtn(r){
  if(!X||!r)return "";const n=unread(r),c=list(r).length;
  return `<button class="chb${n?" nw":""}" data-chat="${E(r.id)}" type="button">💬 ${c?"المحادثة":"محادثة"}${n?` <b>${n}</b>`:c?` <span style="opacity:.6">(${c})</span>`:""}</button>`;
}
// ---------- النافذة ----------
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayOf=t=>new Date(N(t)).toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});
function box(){
  let m=g("chm");
  if(!m){
    m=document.createElement("div");m.id="chm";document.body.appendChild(m);
    m.addEventListener("click",e=>{
      if(e.target===m||e.target.closest("[data-chx]"))return close();
      const q=e.target.closest("[data-q]");if(q){const t=g("cht");t.value=t.value?t.value+" "+q.dataset.q:q.dataset.q;t.focus();grow()}
      if(e.target.closest("#chs"))send();
    });
    m.addEventListener("keydown",e=>{
      // على الكمبيوتر: Enter يبعت، و Shift+Enter سطر جديد. على الموبايل Enter سطر جديد عادي
      if(e.target.id==="cht"&&e.key==="Enter"&&!e.shiftKey&&!/android|iphone|ipad|mobile/i.test(navigator.userAgent)){e.preventDefault();send()}
      if(e.key==="Escape")close();
    });
    m.addEventListener("input",e=>{if(e.target.id==="cht")grow()});
  }
  return m;
}
function grow(){const t=g("cht");if(!t)return;t.style.height="auto";t.style.height=Math.min(120,t.scrollHeight+2)+"px";const c=g("chc");if(c)c.textContent=t.value.length>LEN-80?`${t.value.length}/${LEN}`:""}
function bubbles(r){
  const L=list(r);if(!L.length)return `<div class="ce">💬 مفيش رسايل لسه.<br>اكتب أي سؤال أو ملاحظة عن الطلب ده،<br>و${X.by==="br"?"المستودع":"الفرع"} هيوصله إشعار على طول.</div>`;
  let h="",d="";
  L.forEach(x=>{const dd=dayOf(x.ts);if(dd!==d){d=dd;h+=`<div class="chd">${E(dd)}</div>`}
    const me=x.by===X.by,who=x.by==="wh"?("المستودع"+(x.n?" · "+x.n:"")):("الفرع"+(x.n?" · "+x.n:""));
    h+=`<div class="cmsg ${me?"me":"ot"}">${me?"":`<i>${E(who)}</i>`}${E(x.t)}<small>${hm(x.ts)}</small></div>`});
  return h;
}
// quiet = جاية من تحديث الطلبات (الصفحة هترسم نفسها بعدها، فمش محتاجين نطلب رسم تاني)
function render(scroll,quiet){
  const m=g("chm"),r=OPEN&&X.get(OPEN);if(!m||!OPEN)return;
  if(!r){m.querySelector(".chl").innerHTML=`<div class="ce">الطلب ده مش ظاهر دلوقتي.</div>`;return}
  const l=m.querySelector(".chl"),atEnd=l.scrollHeight-l.scrollTop-l.clientHeight<80;
  l.innerHTML=bubbles(r);
  if(scroll||atEnd)l.scrollTop=l.scrollHeight;
  const full=list(r).length>=MAX;g("cht").disabled=full;g("chs").disabled=full||busy;
  g("chn").textContent=full?"المحادثة دي وصلت لأقصى عدد رسايل. لو محتاج تكمّل، كلّمهم من طلب تاني.":"";
  markSeen(r);if(!quiet&&X.onChange)X.onChange();
}
function open(id){
  const r=X.get(id);if(!r)return;OPEN=id;const m=box();
  m.innerHTML=`<div class="chk" role="dialog" aria-modal="true"><div class="chh"><div><b>💬 محادثة طلب <bdi dir="ltr">${E(r.no||"")}</bdi></b><small>${X.by==="br"?"مع المستودع":`<bdi dir="ltr">${E(r.brn||"")}</bdi>`}</small></div><button data-chx type="button" aria-label="قفل">✕</button></div>
  <div class="chl"></div><div class="chq">${QUICK[X.by].map(q=>`<button data-q="${E(q)}" type="button">${E(q)}</button>`).join("")}</div>
  <div class="chf"><textarea id="cht" rows="1" maxlength="${LEN}" placeholder="اكتب رسالتك..."></textarea><button id="chs" type="button">إرسال</button></div><div class="chn" id="chn"></div><div class="chn" id="chc"></div></div>`;
  m.className="on";render(true);
  if(matchMedia("(pointer:fine)").matches)setTimeout(()=>{const t=g("cht");if(t&&!t.disabled)t.focus()},60);
}
function close(){const m=g("chm");if(m){m.className="";m.innerHTML=""}OPEN=null;if(X&&X.onChange)X.onChange()}
async function send(){
  const t=g("cht"),b=g("chs");if(!t||!OPEN||busy)return;
  const txt=t.value.replace(/\s+$/,"").replace(/^\s+/,"").slice(0,LEN),id=OPEN,r=X.get(id);
  if(!txt||!r)return;
  if(list(r).length>=MAX){X.toast("المحادثة دي وصلت لأقصى عدد رسايل");return}
  const m={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),by:X.by,n:String(X.name()||"").trim().slice(0,60),t:txt,ts:Date.now()};
  busy=true;b.disabled=true;b.textContent="⏳";
  try{
    await withTimeout(updateDoc(doc(X.db,"requests",id),{msgs:arrayUnion(m)}),15000);
    if(OPEN===id){t.value="";grow()}
    X.ping([id]);// إشعار للطرف التاني في نفس الثانية
  }catch(x){
    const w=await failReason(x);
    if(w==="slow"){// الرسالة محفوظة على الجهاز وهتتبعت لوحدها أول ما الاتصال يتحسّن (ما نبعتهاش تاني علشان ما تتكررش)
      if(OPEN===id){t.value="";grow()}X.toast("⏳ النت بطيء: الرسالة هتتبعت لوحدها أول ما الاتصال يتحسّن");X.ping([id]);
    }else X.toast(w==="denied"?"مش مسموح لك تبعت رسالة على الطلب ده":FAIL_MSG[w]||"تعذر إرسال الرسالة",true);
  }
  busy=false;if(g("chs")){b.disabled=false;b.textContent="إرسال"}
  if(OPEN===id)render(true);
}
// ---------- بعد كل تحديث للطلبات: رسالة جديدة وصلت؟ ----------
// all = كل الطلبات اللي الصفحة شايفاها
export function chatSync(all){
  if(!X)return;const first=LAST===null;const now={};let fresh=null;
  (all||[]).forEach(r=>{const L=list(r);now[r.id]=L.length;
    if(!first&&r.id in LAST&&L.length>LAST[r.id]){const nw=L.slice(LAST[r.id]).filter(x=>x.by!==X.by);if(nw.length)fresh={r,x:nw[nw.length-1]}}});
  LAST=now;
  if(OPEN)render(false,true);
  if(fresh&&fresh.r.id!==OPEN){
    const who=fresh.x.by==="wh"?"المستودع":X.label(fresh.r);
    X.toast(`💬 ${who}: ${fresh.x.t.slice(0,70)}`);if(X.beep)X.beep();
    if(X.notify)X.notify("💬 رسالة جديدة — طلب "+(fresh.r.no||""),`${who}: ${fresh.x.t.slice(0,120)}`,"c"+fresh.r.id);
  }
}
export function unreadAll(all){return X?(all||[]).reduce((a,r)=>a+(unread(r)?1:0),0):0}
// ctx = {db, by:"br"|"wh", me: مفتاح الجهاز للقراءة, name:()=>اسم الكاتب, label:r=>اسم الفرع, get:id=>الطلب, toast, beep, notify, ping, onChange}
export function initChat(ctx){
  X=ctx;LAST=null;SM=null;
  if(!g("ch-css")){const s=document.createElement("style");s.id="ch-css";s.textContent=CSS;document.head.appendChild(s)}
}
export function stopChat(){close();X=null;LAST={}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-chat]");if(b&&X){e.preventDefault();e.stopPropagation();open(b.dataset.chat)}},true);
