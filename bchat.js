// شات الفروع مع المستودع (قسم مستقل، مش مربوط بطلب): نص + رسايل صوتية.
// كل فرع ليه محادثة واحدة مع المستودع، ومفيش فرع يقدر يقرا أو يكتب في محادثة فرع تاني (firestore.rules بتمنع ده).
//   chats/{code}          = ملخّص: {br, brn, last:{by,n,t,ts,v}, lb, lw, rb, rw, nb, nw}
//                           lb/lw = آخر رسالة من الفرع/المستودع، rb/rw = الفرع/المستودع قرا لحد إمتى، nb/nw = رسايل لسه ماتقرتش عند الفرع/المستودع
//   chats/{code}/msgs/{id} = رسالة: {by:"br"|"wh", n:الاسم, t?:النص, v?:صوت, d?:مدة الصوت بالثواني, ts}
//   chats/{code}/aud/{id}  = الصوت نفسه {a: data URL}، بيتحمّل بس لما حد يدوس تشغيل (توفير قراءات)
import {collection,doc,getDoc,updateDoc,onSnapshot,query,orderBy,limit,writeBatch,increment,withTimeout,failReason,FAIL_MSG} from "./fb.js";
const LEN=1000,MAXS=60,MAXB=470000,PAGE=40;// نفس الحدود اللي في firestore.rules
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const isMob=()=>/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
const SILENT="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const QUICK={br:["محتاجين بضاعة ضروري 🙏","فين طلبنا؟","تمام، شكراً 👍"],wh:["تمام 👍","جاري التجهيز ⏳","هيوصلكم النهارده 🚚"]};
let X=null,SUMS={},CUR=null,GEN=0,UNM=null,UNS=null,MSGS=[],LIM=PAGE,DRAFT={},REC=null,PLAY={id:null,au:null},busy=false,marking=false,first=true,keepTop=null,ROOT=null,Q="";
const AUD=new Map();let SCR={t:0,end:true,l:0};
const STYLE=`
.bcv [hidden]{display:none!important}
.bcv{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--card);color:var(--ink);height:100%}
.bch{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1b1b1b,#2b2416);color:#f3e7c8;flex:none}
.bch>div{flex:1;min-width:0}.bch b{display:block;font-size:16.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bch small{display:block;opacity:.75;font-size:12.5px}
.bch button{font:inherit;background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer;flex:none}
.bcms{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:7px;background:var(--soft,#f6f2e9);overscroll-behavior:contain}
.bcmt{margin:auto;text-align:center;color:var(--mut);font-size:14.5px;line-height:1.9;padding:20px}
.bcday{align-self:center;font-size:11.5px;color:var(--mut);background:var(--card);border-radius:999px;padding:2px 12px;margin:6px 0}
.bcg{max-width:80%;border-radius:16px;padding:7px 12px 5px;font-size:15px;line-height:1.6;word-wrap:break-word;white-space:pre-wrap;animation:ui-fade .2s ease both}
.bcg i{display:block;font-style:normal;font-size:11.5px;font-weight:700;opacity:.7;margin-bottom:1px}
.bcg small{display:flex;gap:4px;justify-content:flex-end;font-size:11px;opacity:.65;margin-top:2px;direction:ltr}
.bcg small em{font-style:normal;color:#1d6fb8;font-weight:700}
.bcg.me{align-self:flex-start;background:#d4ae5c;color:#1b1b1b;border-start-start-radius:5px}
.bcg.ot{align-self:flex-end;background:var(--card);color:var(--ink);border:1px solid var(--line);border-start-end-radius:5px}
.bcvo{display:flex;align-items:center;gap:9px;min-width:190px;direction:ltr}
.bcvo button{width:38px;height:38px;border-radius:50%;border:0;background:#1b1b1b;color:#fff;font-size:15px;cursor:pointer;flex:none}
.bcg.me .bcvo button{background:#fff;color:#1b1b1b}
.bcvo span.bar{flex:1;height:5px;border-radius:9px;background:rgba(0,0,0,.15);overflow:hidden}.bcvo span.bar b{display:block;height:100%;width:0;background:currentColor;transition:width .2s linear}
.bcvo span.du{font-size:12.5px;font-weight:700;opacity:.8}
.bcmore{align-self:center;font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}
.bcq{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 0;scrollbar-width:none;flex:none}.bcq::-webkit-scrollbar{display:none}
.bcq button{font:inherit;font-size:13px;white-space:nowrap;border-radius:999px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:5px 12px;cursor:pointer;flex:none}
.bcf{display:flex;gap:8px;align-items:flex-end;padding:10px;flex:none}
.bcf textarea{flex:1;resize:none;font:inherit;font-size:16px;line-height:1.5;max-height:120px;min-height:46px;border-radius:14px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:10px 12px}
.bcf textarea:focus{outline:0;border-color:var(--acc)}
.bcf button{font:inherit;font-weight:800;border:0;border-radius:14px;height:46px;min-width:46px;padding:0 14px;background:#1b1b1b;color:#fff;cursor:pointer;flex:none;font-size:15px}
.bcf button.mic{background:var(--card);color:var(--ink);border:1.5px solid var(--line);font-size:20px;padding:0 10px}
.bcf button:disabled{opacity:.5}
.bcr2{display:flex;align-items:center;gap:10px;padding:10px;flex:none}
.bcr2 .dot{width:12px;height:12px;border-radius:50%;background:#e03b2f;animation:bc-pulse 1s ease-in-out infinite;flex:none}
.bcr2 .tm{flex:1;font-weight:800;font-size:16px;direction:ltr;text-align:right}.bcr2 .tm small{font-weight:400;color:var(--mut);font-size:12.5px}
.bcr2 button{font:inherit;font-weight:800;border:0;border-radius:14px;height:46px;padding:0 16px;cursor:pointer}
.bcr2 .x{background:var(--field,#f3f1ed);color:var(--ink)}.bcr2 .ok{background:#1f8a3c;color:#fff}
@keyframes bc-pulse{50%{opacity:.25;transform:scale(.8)}}
/* لوحة المستودع: قائمة الفروع + المحادثة */
.bcw{display:grid;grid-template-columns:320px 1fr;height:calc(100dvh - 175px);min-height:460px;background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,.05)}
.bcl{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.bcs{padding:10px;flex:none}.bcs input{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:9px 12px}
.bcli{overflow-y:auto;flex:1}
.bcr{display:flex;gap:10px;align-items:center;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:none;text-align:start;font:inherit;color:var(--ink);cursor:pointer}
.bcr:hover{background:var(--soft,#f6f2e9)}.bcr.on{background:var(--soft,#f6f2e9);box-shadow:inset -4px 0 0 var(--acc)}
.bcr .av{width:42px;height:42px;border-radius:50%;background:#1b1b1b;color:#d4ae5c;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;direction:ltr}
.bcr .nm{flex:1;min-width:0}.bcr .nm b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcr .nm small{display:block;color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcr.nw .nm small{color:var(--ink);font-weight:700}
.bcr .mt{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}.bcr .mt small{color:var(--mut);font-size:11.5px}
.bcr .mt i,.bcbd{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:21px;padding:0 6px;font-size:12px;line-height:21px;text-align:center;font-weight:800}
.bcnone{margin:auto;text-align:center;color:var(--mut);font-size:15px;line-height:2;padding:30px}
.bcw>.bcv.empty .bch,.bcw>.bcv.empty .bcq,.bcw>.bcv.empty .bcf,.bcw>.bcv.empty .bcr2{display:none}
.bcback{display:none!important}
@media (max-width:760px){
 .bcw{grid-template-columns:1fr;height:auto;min-height:0}.bcl{border:0}.bcli{overflow:visible}
 .bcw>.bcv{display:none}.bcw.open>.bcv{display:flex;position:fixed;inset:0;z-index:60;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}
 .bcw .bcback{display:block!important}
}
/* صفحة الفرع: زرار عائم + نافذة */
#bcfab{position:fixed;left:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9;width:60px;height:60px;border-radius:50%;background:#1b1b1b;color:#fff;font-size:27px;border:2px solid #d4ae5c;box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;animation:ui-fade .3s ease both}
#bcfab i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:22px;padding:0 6px;font-size:12.5px;line-height:22px;font-weight:800;border:2px solid #fff}
#bcfab.nw{animation:bc-ring 1.6s ease-in-out infinite}
@keyframes bc-ring{0%,100%{transform:rotate(0)}10%{transform:rotate(-12deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
#me #bcme{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:#1b1b1b;color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-start:auto}
#me #bcme i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#bcm{display:none;position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.55);padding:14px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#bcm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
#bcm .bcp{width:100%;max-width:560px;height:min(740px,calc(100dvh - 28px));border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
@media (max-width:600px){#bcm{padding:0}#bcm .bcp{height:100dvh;max-width:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px);background:var(--card)}}
@media (prefers-color-scheme:dark){.bcf button:not(.mic){background:#d4ae5c;color:#1b1b1b}.bcg.ot{background:#262626}}
.tabs .tbn{background:#c0392b;color:#fff;border-radius:999px;padding:0 7px;font-size:12px;line-height:19px;display:inline-block;margin-inline-start:4px;font-weight:800}
@media print{#bcfab,#bcm,#bcme{display:none!important}}
`;
// ---------- مساعدات ----------
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayOf=t=>new Date(N(t)).toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});
const when=t=>{if(!t)return "";const d=new Date(N(t)),n=new Date();return d.toDateString()===n.toDateString()?hm(t):Date.now()-N(t)<6*864e5?d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"short"}):d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})};
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const nameOf=code=>X.brn(code)||code;
// رسايل لسه ماتقرتش عند الطرف ده
function unreadOf(s){if(!s)return 0;return X.by==="br"?(N(s.nb)||(N(s.lw)>N(s.rb)?1:0)):(N(s.nw)||(N(s.lb)>N(s.rw)?1:0))}
export function unreadTotal(){if(!X)return 0;return X.by==="br"?unreadOf(SUMS[X.code]):Object.values(SUMS).reduce((a,s)=>a+(unreadOf(s)?1:0),0)}
// ---------- المحادثة نفسها (مشتركة بين اللوحة والفرع) ----------
function convHtml(){
  return `<div class="bch"><button class="bcback" data-bcback type="button" aria-label="رجوع">→</button><div><b id="bct"></b><small id="bcsub"></small></div>${X.by==="br"?`<button data-bcclose type="button" aria-label="قفل">✕</button>`:""}</div>
  <div class="bcms" id="bcms"></div>
  <div class="bcq">${QUICK[X.by].map(q=>`<button data-bcq="${E(q)}" type="button">${E(q)}</button>`).join("")}</div>
  <div class="bcf" id="bcfoot"><textarea id="bcin" rows="1" maxlength="${LEN}" placeholder="اكتب رسالة..."></textarea><button class="mic" id="bcmic" type="button" title="رسالة صوتية" aria-label="رسالة صوتية">🎤</button><button id="bcsend" type="button">إرسال</button></div>
  <div class="bcr2" id="bcrec" hidden><span class="dot"></span><span class="tm" id="bcrt">0:00</span><button class="x" data-bccancel type="button">✕ إلغاء</button><button class="ok" data-bcstop type="button">✔ إرسال</button></div>`;
}
function wire(el){
  el.addEventListener("click",e=>{
    const t=e.target;
    if(t.closest("[data-bcq]")){const i=g("bcin"),q=t.closest("[data-bcq]").dataset.bcq;i.value=i.value?i.value+" "+q:q;i.focus();grow();return}
    if(t.closest("#bcsend"))return void sendText();
    if(t.closest("#bcmic"))return void startRec();
    if(t.closest("[data-bcstop]"))return void stopRec(false);
    if(t.closest("[data-bccancel]"))return void stopRec(true);
    if(t.closest("[data-play]"))return void play(t.closest("[data-play]").dataset.play);
    if(t.closest("[data-bcmore]")){keepTop={h:g("bcms").scrollHeight,t:g("bcms").scrollTop};LIM+=PAGE;listen(GEN);return}
    if(t.closest("[data-bcback]")){if(ROOT)ROOT.classList.remove("open");setCode(null);paintList();return}
    if(t.closest("[data-bcclose]"))return void closeBr();
    const r=t.closest("[data-bcc]");if(r){setCode(r.dataset.bcc);if(ROOT)ROOT.classList.add("open");paintList();if(!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},50)}
  });
  el.addEventListener("keydown",e=>{
    // الكمبيوتر: Enter يبعت و Shift+Enter سطر جديد. الموبايل: Enter سطر جديد عادي
    if(e.target.id==="bcin"&&e.key==="Enter"&&!e.shiftKey&&!isMob()){e.preventDefault();sendText()}
  });
  el.addEventListener("input",e=>{if(e.target.id==="bcin"){grow();if(CUR)DRAFT[CUR]=e.target.value}if(e.target.id==="bcqs"){Q=e.target.value.trim().toLowerCase();paintList()}});
}
function grow(){const t=g("bcin");if(!t)return;t.style.height="auto";t.style.height=Math.min(120,t.scrollHeight+2)+"px"}
function paintHead(){
  if(!g("bct"))return;const s=SUMS[CUR]||{};
  if(X.by==="br"){g("bct").textContent="💬 المستودع";g("bcsub").textContent="رسايلك بتوصل للمستودع على طول"}
  else{g("bct").innerHTML=CUR?`<bdi dir="ltr">${E(nameOf(CUR))}</bdi>`:"";g("bcsub").textContent=s.last?"آخر رسالة "+when(s.last.ts):"محادثة جديدة"}
}
// كل تغيير في الفرع المفتوح: نقفل السماع القديم ونبدأ جديد. GEN بيتأكد إن أي رد متأخر من فرع تاني يتجاهل (مفيش تداخل)
function setCode(code){
  if(CUR===code)return;
  stopRec(true);stopPlay();
  if(UNM){UNM();UNM=null}
  CUR=code;GEN++;MSGS=[];LIM=PAGE;keepTop=null;SCR.end=true;
  const v=ROOT?ROOT.querySelector(".bcv"):g("bcm")&&g("bcm").querySelector(".bcv");if(v)v.classList.toggle("empty",!code);
  if(!g("bcms"))return;
  const i=g("bcin");if(i){i.value=code?DRAFT[code]||"":"";grow()}
  paintHead();
  if(!code){g("bcms").innerHTML=X.by==="wh"?`<div class="bcnone">💬<br>اختار فرع من القائمة علشان تكلّمه</div>`:"";return}
  g("bcms").innerHTML=`<div class="bcmt">⏳ لحظة...</div>`;
  listen(GEN);
}
function listen(my){
  if(UNM){UNM();UNM=null}
  const code=CUR;if(!code)return;
  UNM=onSnapshot(query(collection(X.db,"chats",code,"msgs"),orderBy("ts","desc"),limit(LIM)),sn=>{
    if(my!==GEN||code!==CUR)return;
    MSGS=sn.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m&&(m.by==="br"||m.by==="wh")).sort((a,b)=>N(a.ts)-N(b.ts));
    paintMsgs();markRead();
  },e=>{if(my!==GEN||!g("bcms"))return;g("bcms").innerHTML=`<div class="bcmt">⚠️ تعذر تحميل الرسايل${e&&e.code==="permission-denied"?" (مش مسموح)":"، اتأكد من النت"}</div>`});
}
function paintMsgs(){
  const box=g("bcms");if(!box||!CUR)return;
  const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<90,firstPaint=!box.querySelector(".bcg,.bcmt.ok");
  const s=SUMS[CUR]||{},seen=N(X.by==="br"?s.rw:s.rb);
  let h=MSGS.length>=LIM?`<button class="bcmore" data-bcmore type="button">⬆ رسايل أقدم</button>`:"",d="";
  if(!MSGS.length)h+=`<div class="bcmt ok">💬 مفيش رسايل لسه.<br>${X.by==="br"?"اكتب للمستودع أي حاجة، أو دوس 🎤 وسجّل رسالة صوتية.":"ابدأ المحادثة مع الفرع."}</div>`;
  MSGS.forEach(m=>{const dd=dayOf(m.ts);if(dd!==d){d=dd;h+=`<div class="bcday">${E(dd)}</div>`}
    const me=m.by===X.by,who=m.by==="wh"?"المستودع"+(m.n?" · "+m.n:""):"الفرع"+(m.n?" · "+m.n:"");
    const body=m.v?`<div class="bcvo"><button data-play="${E(m.id)}" type="button" aria-label="تشغيل">${PLAY.id===m.id?"⏸":"▶"}</button><span class="bar"><b id="bcpb-${E(m.id)}"></b></span><span class="du">${mmss(m.d)}</span></div>`:E(m.t||"");
    h+=`<div class="bcg ${me?"me":"ot"}">${me?"":`<i>${E(who)}</i>`}${body}<small>${hm(m.ts)}${me?(N(m.ts)<=seen?" <em>✓✓</em>":" ✓"):""}</small></div>`});
  box.innerHTML=h;
  if(keepTop){box.scrollTop=box.scrollHeight-keepTop.h+keepTop.t;keepTop=null}
  else if(atEnd||firstPaint)box.scrollTop=box.scrollHeight;
}
// "اتقرت": لما المحادثة مفتوحة قدامه فعلاً
function markRead(){
  if(!X||!CUR||document.hidden||marking||!X.visible())return;const s=SUMS[CUR];if(!s||!unreadOf(s))return;
  marking=true;const code=CUR;
  updateDoc(doc(X.db,"chats",code),X.by==="br"?{rb:Date.now(),nb:0}:{rw:Date.now(),nw:0}).catch(()=>{}).finally(()=>{marking=false});
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)markRead()});
// ---------- الإرسال ----------
function write(code,m,a){
  const ts=Date.now(),by=X.by,n=String(X.name()||"").trim().slice(0,60),b=writeBatch(X.db),ref=doc(collection(X.db,"chats",code,"msgs"));
  const msg={by,n,ts,...m};
  if(a)b.set(doc(X.db,"chats",code,"aud",ref.id),{a});
  b.set(ref,msg);
  const sum={br:code,brn:String(nameOf(code)).slice(0,40),last:{by,n,t:m.v?"🎤 رسالة صوتية":String(m.t).slice(0,200),ts,v:!!m.v}};
  if(by==="br")Object.assign(sum,{lb:ts,rb:ts,nw:increment(1)});else Object.assign(sum,{lw:ts,rw:ts,nb:increment(1)});
  b.set(doc(X.db,"chats",code),sum,{merge:true});
  return b.commit();
}
async function deliver(code,m,a,onOk){
  busy=true;const sb=g("bcsend");if(sb)sb.disabled=true;
  try{await withTimeout(write(code,m,a),20000);onOk&&onOk();X.ping(code)}
  catch(x){
    const w=await failReason(x);
    // النت بطيء: الرسالة محفوظة على الجهاز وهتتبعت لوحدها (ما نبعتهاش تاني علشان ما تتكررش)
    if(w==="slow"){onOk&&onOk();X.toast("⏳ النت بطيء: الرسالة هتتبعت لوحدها أول ما الاتصال يتحسّن");X.ping(code)}
    else X.toast(w==="denied"?"مش مسموح لك تبعت في المحادثة دي":FAIL_MSG[w]||"تعذر الإرسال",true);
  }
  busy=false;if(g("bcsend"))g("bcsend").disabled=false;
}
function sendText(){
  const i=g("bcin");if(!i||!CUR||busy)return;
  const t=i.value.trim().slice(0,LEN),code=CUR;if(!t)return;
  deliver(code,{t},null,()=>{DRAFT[code]="";if(CUR===code){i.value="";grow()}});
}
// ---------- الرسايل الصوتية ----------
function paintRec(){
  const r=g("bcrec"),f=g("bcfoot"),q=document.querySelector(".bcq");if(!r)return;
  r.hidden=!REC;f.hidden=!!REC;if(q)q.hidden=!!REC;
  if(REC)g("bcrt").innerHTML=`${mmss((Date.now()-REC.t0)/1000)} <small>/ ${mmss(MAXS)} · بيسجّل…</small>`;
}
async function startRec(){
  if(!CUR||REC||busy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)return void X.toast("المتصفح ده مش بيدعم تسجيل الصوت. جرّب Chrome أو حدّث المتصفح.",true);
  const code=CUR,my=GEN;let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){return void X.toast(e&&(e.name==="NotAllowedError"||e.name==="SecurityError")?(isMob()?"اسمح للمنصة تستخدم المايك: من إعدادات الموقع أو التطبيق ← الميكروفون ← سماح":"اسمح للمنصة تستخدم المايك: علامة القفل 🔒 جنب الرابط ← الميكروفون ← سماح"):"مفيش مايك شغّال على الجهاز ده",true)}
  if(my!==GEN||code!==CUR||REC){stream.getTracks().forEach(t=>t.stop());return}
  const type=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"].find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(e){return false}})||"";
  let mr;try{mr=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:24000})}catch(e){mr=new MediaRecorder(stream)}
  const r={code,my,mr,stream,chunks:[],size:0,t0:Date.now(),cancel:false,done:false};REC=r;
  mr.ondataavailable=e=>{if(e.data&&e.data.size){r.chunks.push(e.data);r.size+=e.data.size;if(r.size>MAXB&&REC===r)stopRec(false)}};
  mr.onstop=()=>finishRec(r);
  try{mr.start(1000)}catch(e){stream.getTracks().forEach(t=>t.stop());REC=null;return void X.toast("تعذر بدء التسجيل",true)}
  r.timer=setInterval(()=>{if(REC!==r)return;if((Date.now()-r.t0)/1000>=MAXS)stopRec(false);else paintRec()},250);
  paintRec();
}
function stopRec(cancel){
  const r=REC;if(!r)return;REC=null;r.cancel=!!cancel;r.dur=(Date.now()-r.t0)/1000;clearInterval(r.timer);
  try{if(r.mr.state!=="inactive")r.mr.stop();else finishRec(r)}catch(e){finishRec(r)}
  paintRec();
}
async function finishRec(r){
  if(r.done)return;r.done=true;try{r.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  if(r.cancel)return;
  if(r.my!==GEN||r.code!==CUR)return;// الفرع اتغيّر أثناء التسجيل: نلغي
  if(N(r.dur)<1)return void X.toast("الرسالة قصيرة أوي. دوس 🎤 واتكلم، وبعدين دوس إرسال");
  const blob=new Blob(r.chunks,{type:String(r.mr.mimeType||(r.chunks[0]&&r.chunks[0].type)||"audio/webm").split(";")[0]||"audio/webm"});
  if(blob.size>MAXB*1.05)return void X.toast("الرسالة الصوتية طويلة. سجّل رسالة أقصر",true);
  let a="";try{a=await new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(String(f.result||""));f.onerror=no;f.readAsDataURL(blob)})}catch(e){}
  if(!/^data:audio\/[a-z0-9.+-]+;base64,/.test(a))return void X.toast("تعذر تجهيز الرسالة الصوتية",true);
  deliver(r.code,{v:true,d:Math.max(1,Math.round(r.dur))},a);
}
// ---------- تشغيل الصوت ----------
function stopPlay(){const p=PLAY;PLAY={id:null,au:null};if(p.au){try{p.au.pause()}catch(e){}}if(p.id){const b=document.querySelector(`[data-play="${p.id}"]`);if(b)b.textContent="▶";const bar=g("bcpb-"+p.id);if(bar)bar.style.width="0"}}
async function play(id){
  if(PLAY.id===id)return void stopPlay();
  stopPlay();
  const code=CUR,my=GEN,key=code+"/"+id,btn=()=>document.querySelector(`[data-play="${id}"]`);
  // بنجهّز الصوت جوه الضغطة نفسها (الآيفون مش بيشغّل صوت إلا من ضغطة مباشرة)
  const au=new Audio();PLAY={id,au};au.src=SILENT;au.play().catch(()=>{});
  let a=AUD.get(key);
  if(!a){
    const b=btn();if(b)b.textContent="⏳";
    try{const s=await withTimeout(getDoc(doc(X.db,"chats",code,"aud",id)),15000);a=s.exists()?String(s.data().a||""):""}catch(e){a=""}
    if(my!==GEN||PLAY.au!==au)return;
    if(!/^data:audio\//.test(a)){stopPlay();return void X.toast("تعذر تحميل الرسالة الصوتية",true)}
    AUD.set(key,a);if(AUD.size>40)AUD.delete(AUD.keys().next().value);
  }
  au.src=a;
  au.ontimeupdate=()=>{const bar=g("bcpb-"+id);if(bar&&au.duration&&isFinite(au.duration))bar.style.width=Math.min(100,au.currentTime/au.duration*100)+"%"};
  au.onended=()=>{if(PLAY.au===au)stopPlay()};
  au.onerror=()=>{if(PLAY.au===au){stopPlay();X.toast("الجهاز ده مش قادر يشغّل الرسالة الصوتية دي",true)}};
  try{await au.play();const b=btn();if(b&&PLAY.au===au)b.textContent="⏸"}catch(e){if(PLAY.au===au){stopPlay();X.toast("دوس ▶ تاني علشان تسمع الرسالة")}}
}
// ---------- لوحة المستودع ----------
function paintList(){
  if(!ROOT||X.by!=="wh")return;const box=ROOT.querySelector(".bcli");if(!box)return;
  const codes=[...new Set([...X.codes.map(b=>String(b).split("-")[0]),...Object.keys(SUMS)])];
  const rows=codes.map(c=>({c,s:SUMS[c],u:unreadOf(SUMS[c]),n:nameOf(c)})).filter(x=>!Q||x.n.toLowerCase().includes(Q)||x.c.includes(Q))
    .sort((a,b)=>(b.u>0)-(a.u>0)||N(b.s&&b.s.last&&b.s.last.ts)-N(a.s&&a.s.last&&a.s.last.ts)||a.c.localeCompare(b.c));
  box.innerHTML=rows.map(x=>{const l=x.s&&x.s.last;const pv=l?(l.by==="wh"?"أنت: ":"")+l.t:"مفيش رسايل لسه";
    return `<button class="bcr${x.c===CUR?" on":""}${x.u?" nw":""}" data-bcc="${E(x.c)}" type="button"><span class="av">${E(x.c)}</span><span class="nm"><b><bdi dir="ltr">${E(x.n)}</bdi></b><small>${E(pv)}</small></span><span class="mt"><small>${l?when(l.ts):""}</small>${x.u?`<i>${x.u}</i>`:""}</span></button>`}).join("")||`<div class="bcnone">مفيش فرع بالاسم ده</div>`;
}
// الصفحة بتعيد رسم نفسها كتير، فالشات عنصر ثابت بنحطّه في مكانه كل مرة (الكتابة والتسجيل مايضيعوش)
export function mountWh(host){
  if(!X||!host)return;
  if(!ROOT){ROOT=document.createElement("div");ROOT.className="bcw";ROOT.innerHTML=`<aside class="bcl"><div class="bcs"><input id="bcqs" type="search" placeholder="🔎 دوّر على فرع" autocomplete="off"></div><div class="bcli"></div></aside><section class="bcv empty">${convHtml()}</section>`;wire(ROOT);
    ROOT.addEventListener("scroll",e=>{const t=e.target;if(t.id==="bcms")SCR={...SCR,t:t.scrollTop,end:t.scrollHeight-t.scrollTop-t.clientHeight<90};else if(t.classList&&t.classList.contains("bcli"))SCR.l=t.scrollTop},true);
    g2(ROOT,"#bcms").innerHTML=`<div class="bcnone">💬<br>اختار فرع من القائمة علشان تكلّمه</div>`}
  // نقل العنصر بيصفّر مكان السكرول، فبنرجّعه زي ما كان
  host.appendChild(ROOT);paintList();
  const ms=g2(ROOT,"#bcms"),li=g2(ROOT,".bcli");ms.scrollTop=SCR.end?ms.scrollHeight:SCR.t;li.scrollTop=SCR.l;
  if(CUR){paintHead();markRead()}
}
const g2=(r,s)=>r.querySelector(s);
// خرجنا من تبويب الشات: نقفل المحادثة المفتوحة (توفير قراءات + وقف أي تسجيل)
export function hideWh(){if(CUR&&X&&X.by==="wh"){setCode(null);if(ROOT)ROOT.classList.remove("open")}}
export function openWh(code){if(!X||X.by!=="wh"||!code)return;setCode(code);if(ROOT){ROOT.classList.add("open");paintList()}}
// ---------- صفحة الفرع ----------
function paintFab(){
  if(X.by!=="br")return;const n=unreadOf(SUMS[X.code]);
  const f=g("bcfab");if(f){f.innerHTML=`💬${n?`<i>${n}</i>`:""}`;f.classList.toggle("nw",!!n);f.title=n?`${n} رسالة جديدة من المستودع`:"كلّم المستودع"}
  const m=g("bcme");if(m)m.innerHTML=`💬 كلّم المستودع${n?` <i>${n}</i>`:""}`;
  if(X.onBadge)X.onBadge(n);
}
export function openBr(){
  if(!X||X.by!=="br")return;
  let m=g("bcm");
  if(!m){m=document.createElement("div");m.id="bcm";m.innerHTML=`<div class="bcp"><section class="bcv">${convHtml()}</section></div>`;document.body.appendChild(m);wire(m);
    m.addEventListener("click",e=>{if(e.target===m)closeBr()});addEventListener("keydown",e=>{if(e.key==="Escape"&&g("bcm")&&g("bcm").classList.contains("on")&&!REC)closeBr()})}
  m.className="on";setCode(X.code);markRead();
  if(!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},60);
}
function closeBr(){const m=g("bcm");if(m)m.className="";setCode(null);paintFab()}
// ---------- التشغيل ----------
// ctx = {db, by:"br"|"wh", name:()=>اسم الكاتب, brn:code=>اسم الفرع, toast, beep, notify, ping:code=>..., visible:()=>المحادثة قدامه؟
//        الفرع: code, onBadge(n) | المستودع: codes:[قائمة الفروع], onBadge(n)}
export function initBChat(ctx){
  stopBChat();X=ctx;first=true;SUMS={};
  if(!g("bc-css")){const s=document.createElement("style");s.id="bc-css";s.textContent=STYLE;document.head.appendChild(s)}
  const onSum=(list)=>{
    const old=SUMS;SUMS={};list.forEach(s=>{if(s&&s.br)SUMS[String(s.br)]=s});
    if(!first)Object.entries(SUMS).forEach(([c,s])=>{const l=s.last,o=old[c]&&old[c].last;
      if(l&&l.by!==X.by&&N(l.ts)>N(o&&o.ts)&&!(CUR===c&&X.visible()&&!document.hidden)){
        const who=X.by==="br"?"المستودع":nameOf(c);X.toast(`💬 ${who}: ${String(l.t).slice(0,70)}`);if(X.beep)X.beep();
        if(X.notify)X.notify("💬 "+(X.by==="br"?"رسالة من المستودع":nameOf(c)),String(l.t).slice(0,140),"g"+c);
      }});
    first=false;paintHead();if(CUR)paintMsgs();paintList();paintFab();markRead();
    if(X.by==="wh"&&X.onBadge)X.onBadge(unreadTotal());
  };
  if(X.by==="br"){
    UNS=onSnapshot(doc(X.db,"chats",X.code),d=>onSum(d.exists()?[{...d.data(),br:X.code}]:[]),()=>{});
    if(!g("bcfab")){const f=document.createElement("button");f.id="bcfab";f.type="button";f.setAttribute("aria-label","كلّم المستودع");f.onclick=openBr;document.body.appendChild(f)}
    const mx=g("mx");if(mx&&!g("bcme")){const b=document.createElement("button");b.id="bcme";b.type="button";b.onclick=openBr;mx.parentNode.insertBefore(b,mx)}
    paintFab();
  }else UNS=onSnapshot(collection(X.db,"chats"),sn=>onSum(sn.docs.map(d=>({...d.data(),br:d.id}))),()=>{});
}
export function stopBChat(){
  if(!X)return;stopRec(true);stopPlay();if(UNM){UNM();UNM=null}if(UNS){UNS();UNS=null}
  CUR=null;GEN++;MSGS=[];SUMS={};DRAFT={};AUD.clear();
  const m=g("bcm");if(m)m.remove();["bcfab","bcme"].forEach(id=>{const e=g(id);if(e)e.remove()});
  if(ROOT){ROOT.remove();ROOT=null}
  X=null;
}
