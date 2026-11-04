// الشات الخاص: نص + رسايل صوتية. كل محادثة بين طرفين بس، ومحدش غيرهم يقدر يشوفها (ولا حتى المالك والمديرين).
// الأطراف: الفروع (b-كود)، اللي في المستودع (w-إيميل)، السواقين (d-رقم). سواق مع سواق ممنوع (نوفمبر 2026).
//   فرع مع المستودع (الشكل القديم، زي ما هو):
// كل محادثة = فرع واحد + شخص واحد من المستودع (المالك أو مدير أو موظف طلبات). محدش غيرهم يقدر يشوفها، حتى المالك والمديرين
// (firestore.rules هي اللي بتمنع ده، مش الصفحة بس). الفرع بيختار يكلّم مين من قايمة الأسماء (whdir).
//   dm/{code}__{email}  = ملخّص: {br, brn, wh:إيميل الشخص, whn:اسمه, last:{by,n,t,ts,v}, lb, lw, rb, rw, nb, nw}
//                         lb/lw = آخر رسالة من الفرع/المستودع، rb/rw = قرا لحد إمتى، nb/nw = رسايل لسه ماتقرتش عند الفرع/المستودع
//   dm/{cid}/msgs/{id}  = رسالة: {by:"br"|"wh", n:اسم اللي كتب, t?:النص, v?+d?:صوت ومدته بالثواني, ts, rq?:{id,no} بخصوص طلب, rd?:اتقرت إمتى}
//   dm/{cid}/aud/{id}   = الصوت نفسه {a: data URL}، بيتحمّل بس لما حد يدوس تشغيل (توفير قراءات)
//   whdir/{email}       = {n, k, r}: أسماء اللي في المستودع وكنيتهم (المالك بس بيكتبها، staff.js). ava/{email} = صورهم
//   كل شخص بيظهر باسمه وكنيته وصورته بس (من غير "مدير" أو "مالك النظام")
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,onSnapshot,query,where,orderBy,limit,writeBatch,increment,deleteField,withTimeout,failReason,FAIL_MSG} from "./fb.js";
const LEN=1000,MAXS=60,MAXB=470000,PAGE=40,SEP="__";// نفس الحدود اللي في firestore.rules
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const isMob=()=>/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
const SILENT="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const QUICK={b:["محتاجين بضاعة ضروري 🙏","فين طلبنا؟","تمام، شكراً 👍"],w:["تمام 👍","جاري التجهيز ⏳","هيوصلكم النهارده 🚚","الصنف مش موجود حالياً"],d:["في الطريق 🚚","وصلت ✅","هتأخر شوية ⏳","تمام 👍"]};
// المحادثات الجديدة (سواقين، موظفين مع بعض، فروع مع بعض): dm/{طرف1}__{طرف2} مترتبين = {ps:[الطرفين], nm:{طرف:اسمه}, last:{by:الطرف,...},
//   l0/l1 آخر رسالة من الطرف 0/1، r0/r1 قرا لحد إمتى، n0/n1 لسه ماقراش كام}، والرسايل by = الطرف. ddir/{drv1} = {n} أسماء السواقين
const ROLE_O={owner:0,admin:1,req:2};// ترتيب القايمة عند الفرع بس (مش بيظهر)
// CUR = المحادثة المفتوحة (cid). CTX = "بخصوص طلب" لكل محادثة، PEND = طلب مستني الفرع يختار يكلّم مين عنه. AVA = الصور
let X=null,SUMS={},SO={},SN={},DIR={},DDIR={},AVA={},FILT="",CUR=null,GEN=0,UNM=null,UNS=null,UNS2=null,UND=null,UNA=null,UNDD=null,MSGS=[],LIM=PAGE,DRAFT={},CTX={},PEND=null,REC=null,PLAY={id:null,au:null},busy=false,marking=false,first=true,keepTop=null,ROOT=null,Q="";
const AUD=new Map();let SCR={t:0,end:true,l:0};
const STYLE=`
.bcv [hidden]{display:none!important}
.bcv{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--card);color:var(--ink);height:100%}
.bch{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1b1b1b,#2b2416);color:#f3e7c8;flex:none}
.bch>div{flex:1;min-width:0}.bch b{display:block;font-size:16.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bch small{display:block;opacity:.75;font-size:12.5px}
.bch button,.bclh button{font:inherit;background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer;flex:none}
.bcms{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:7px;background:var(--soft,#f6f2e9);overscroll-behavior:contain}
.bcmt{margin:auto;text-align:center;color:var(--mut);font-size:14.5px;line-height:1.9;padding:20px}
.bcday{align-self:center;font-size:11.5px;color:var(--mut);background:var(--card);border-radius:999px;padding:2px 12px;margin:6px 0}
.bcg{max-width:80%;border-radius:16px;padding:7px 12px 5px;font-size:15px;line-height:1.6;word-wrap:break-word;white-space:pre-wrap;animation:ui-fade .2s ease both}
.bcg i{display:block;font-style:normal;font-size:11.5px;font-weight:800;opacity:.75;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcg small{display:flex;flex-wrap:wrap;gap:2px 8px;justify-content:flex-end;font-size:11px;opacity:.7;margin-top:3px}
.bcg small em{font-style:normal;color:#1d6fb8;font-weight:700}
.bcg .rqt{display:inline-block;font-size:11.5px;font-weight:700;background:rgba(0,0,0,.08);border-radius:999px;padding:0 9px;margin-bottom:3px}
.bcg.me{align-self:flex-start;background:#d4ae5c;color:#1b1b1b;border-start-start-radius:5px}
.bcg.ot{align-self:flex-end;background:var(--card);color:var(--ink);border:1px solid var(--line);border-start-end-radius:5px}
.bcvo{display:flex;align-items:center;gap:9px;min-width:190px;direction:ltr}
.bcvo button{width:38px;height:38px;border-radius:50%;border:0;background:#1b1b1b;color:#fff;font-size:15px;cursor:pointer;flex:none}
.bcg.me .bcvo button{background:#fff;color:#1b1b1b}
.bcvo span.bar{flex:1;height:5px;border-radius:9px;background:rgba(0,0,0,.15);overflow:hidden}.bcvo span.bar b{display:block;height:100%;width:0;background:currentColor;transition:width .2s linear}
.bcvo span.du{font-size:12.5px;font-weight:700;opacity:.8}
.bcgone{font-size:13px;opacity:.75;font-style:italic}
.bcmore{align-self:center;font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}
.bcrq{display:flex;align-items:center;gap:8px;margin:8px 10px 0;padding:6px 8px 6px 12px;border-radius:12px;background:#fdf3dc;color:#6b5314;font-size:13.5px;font-weight:700;flex:none}
.bcrq span{flex:1}.bcrq button{font:inherit;border:0;background:rgba(0,0,0,.08);color:inherit;border-radius:8px;width:28px;height:28px;cursor:pointer}
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
/* القايمة (فروع للمستودع، أشخاص للفرع) + المحادثة */
.bcw{display:grid;grid-template-columns:320px 1fr;height:calc(100dvh - 175px);min-height:460px;background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,.05)}
.bcl{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.bclh{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1b1b1b,#2b2416);color:#f3e7c8;flex:none}
.bclh>div{flex:1;min-width:0}.bclh b{display:block;font-size:16.5px}.bclh small{display:block;opacity:.8;font-size:12.5px}
.bcs{padding:10px;flex:none}.bcfl{display:flex;gap:6px;overflow-x:auto;margin-top:8px;scrollbar-width:none}.bcfl::-webkit-scrollbar{display:none}.bcfl button{font:inherit;font-size:13px;white-space:nowrap;border-radius:999px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:4px 12px;cursor:pointer}.bcfl button.on{background:#1b1b1b;color:#fff;border-color:#1b1b1b}.bcs input{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:9px 12px}
.bcli{overflow-y:auto;flex:1}
.bcr{display:flex;gap:10px;align-items:center;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:none;text-align:start;font:inherit;color:var(--ink);cursor:pointer}
.bcr:hover{background:var(--soft,#f6f2e9)}.bcr.on{background:var(--soft,#f6f2e9);box-shadow:inset -4px 0 0 var(--acc)}
.bcr .av{width:42px;height:42px;border-radius:50%;background:#1b1b1b;color:#d4ae5c;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;direction:ltr}
.bcr .av.p{font-size:17px}.bcr img.av,.bch img.av{object-fit:cover;background:#1b1b1b}
.bch img.av{width:38px;height:38px;border-radius:50%;flex:none}
.bcg i img{width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:-4px;margin-inline-end:5px}
.bcr .nm{flex:1;min-width:0}.bcr .nm b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcr .nm b u{text-decoration:none;font-weight:600;font-size:11.5px;color:var(--acc);margin-inline-start:6px}
.bcr .nm small{display:block;color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcr.nw .nm small{color:var(--ink);font-weight:700}
.bcr .mt{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}.bcr .mt small{color:var(--mut);font-size:11.5px}
.bcr .mt i,.bcbd{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:21px;padding:0 6px;font-size:12px;line-height:21px;text-align:center;font-weight:800}
.bcnone{margin:auto;text-align:center;color:var(--mut);font-size:15px;line-height:2;padding:30px}
.bcw>.bcv.empty .bch,.bcw>.bcv.empty .bcq,.bcw>.bcv.empty .bcf,.bcw>.bcv.empty .bcr2,.bcw>.bcv.empty .bcrq{display:none}
.bcback{display:none!important}
@media (max-width:760px){
 .bcw:not(.one){grid-template-columns:1fr;height:auto;min-height:0}.bcw:not(.one) .bcl{border:0}.bcw:not(.one) .bcli{overflow:visible}
 .bcw:not(.one)>.bcv{display:none}.bcw:not(.one).open>.bcv{display:flex;position:fixed;inset:0;z-index:60;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}
 .bcw .bcback{display:block!important}
}
/* صفحة الفرع: نافذة فيها القايمة أو المحادثة (عمود واحد) */
.bcw.one{grid-template-columns:1fr;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none}
.bcw.one .bcl{border:0}.bcw.one>.bcv{display:none}.bcw.one.open>.bcv{display:flex}.bcw.one.open>.bcl{display:none}
.bcw.one .bcback{display:block!important}
#bcfab{position:fixed;left:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9;width:60px;height:60px;border-radius:50%;background:#1b1b1b;color:#fff;font-size:27px;border:2px solid #d4ae5c;box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;animation:ui-fade .3s ease both}
#bcfab i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:22px;padding:0 6px;font-size:12.5px;line-height:22px;font-weight:800;border:2px solid #fff}
#bcfab.nw{animation:bc-ring 1.6s ease-in-out infinite}
@keyframes bc-ring{0%,100%{transform:rotate(0)}10%{transform:rotate(-12deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
#me #bcme{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:#1b1b1b;color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-start:auto}
#me #bcme i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#bcm{display:none;position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.55);padding:14px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#bcm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
#bcm .bcp{width:100%;max-width:560px;height:min(740px,calc(100dvh - 28px));border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);background:var(--card)}
@media (max-width:600px){#bcm{padding:0}#bcm .bcp{height:100dvh;max-width:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px)}}
.bcrqb{font:inherit;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}
@media (prefers-color-scheme:dark){.bcf button:not(.mic){background:#d4ae5c;color:#1b1b1b}.bcg.ot{background:#262626}.bcrq{background:#3a3115;color:#e8cf8a}.bcg .rqt{background:rgba(255,255,255,.1)}}
.tabs .tbn{background:#c0392b;color:#fff;border-radius:999px;padding:0 7px;font-size:12px;line-height:19px;display:inline-block;margin-inline-start:4px;font-weight:800}
@media print{#bcfab,#bcm,#bcme,.bcrqb{display:none!important}}
`;
// ---------- مساعدات ----------
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayOf=t=>new Date(N(t)).toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});
const when=t=>{if(!t)return "";const d=new Date(N(t)),n=new Date();return d.toDateString()===n.toDateString()?hm(t):Date.now()-N(t)<6*864e5?d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"short"}):d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})};
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
// الأطراف: b-كود الفرع / w-إيميل الشخص اللي في المستودع / d-رقم السواق. X.me = طرفي أنا
const T=()=>X.me[0];
const pv=p=>String(p).slice(2);
const isOld=c=>/^\d{3}__/.test(c);// فرع مع المستودع: الشكل القديم {كود}__{إيميل}
// اسم المحادثة مع الطرف ده: فرع مع المستودع بالشكل القديم، والباقي {طرف}__{طرف} مترتبين
function cidFor(peer){const t=[T(),peer[0]].sort().join("");if(t==="bw"){const b=T()==="b"?X.me:peer,w=T()==="w"?X.me:peer;return pv(b)+SEP+pv(w)}return [X.me,peer].sort().join(SEP)}
function peerOf(c){if(isOld(c)){const i=c.indexOf(SEP);return T()==="b"?"w-"+c.slice(i+SEP.length):"b-"+c.slice(0,i)}const [a,b]=c.split(SEP);return a===X.me?b:a}
const oldBy=()=>T()==="b"?"br":"wh";// اسمي جوه المحادثات القديمة
const mine=(c,by)=>isOld(c)?by===oldBy():by===X.me;
// صاحب الرسالة (كطرف): القديمة br/wh، الجديدة الطرف نفسه
const byParty=(c,by)=>isOld(c)?(by==="br"?"b-"+c.slice(0,c.indexOf(SEP)):"w-"+c.slice(c.indexOf(SEP)+SEP.length)):String(by||"");
function pname(p,c){const t=p[0],v=pv(p),s=c&&SUMS[c];
  if(t==="b")return X.brn(v)||v;
  if(t==="d"){const d=DDIR[v];return (d&&d.n)||(s&&s.nm&&s.nm[p])||v}
  const d=DIR[v];return (d&&d.n)||(s&&(s.whn||(s.nm&&s.nm[p])))||v.split("@")[0]}
const pk=p=>p[0]==="w"?((DIR[pv(p)]||{}).k||""):"";
const ph=p=>p&&p[0]==="w"?AVA[pv(p)]||"":"";
// لسه ماقريتش كام في المحادثة دي
function unreadOf(s){if(!s)return 0;
  if(s._old)return T()==="b"?(N(s.nb)||(N(s.lw)>N(s.rb)?1:0)):(N(s.nw)||(N(s.lb)>N(s.rw)?1:0));
  const i=s.ps.indexOf(X.me),o=1-i;return N(s["n"+i])||(N(s["l"+o])>N(s["r"+i])?1:0)}
// المستودع: كام محادثة مستنية رد. الفرع والسواق: كام رسالة جديدة
export function unreadTotal(){if(!X)return 0;return Object.values(SUMS).reduce((a,s)=>a+(T()==="w"?(unreadOf(s)?1:0):unreadOf(s)),0)}
// زرار "كلّم ... عن الطلب ده" على كارت الطلب (cls = شكل الزرار في الصفحة)
export const rqBtn=(r,cls)=>X&&T()!=="d"?`<button class="${cls||"bcrqb"}" data-bcrq="${E(r.id)}" data-no="${E(r.no||"")}" data-br="${E(r.br||"")}" type="button" title="محادثة خاصة بخصوص الطلب ده">💬 ${T()==="b"?"كلّم المستودع":"كلّم الفرع"}</button>`:"";
const modal=()=>T()!=="w";// الفرع والسواق: نافذة. المستودع: تبويب
const GRP={w:[["","الكل"],["b","الفروع"],["d","السواقين"],["w","الموظفين"]],b:[["","الكل"],["w","المستودع"],["d","السواقين"],["b","الفروع"]],d:[["","الكل"],["w","المستودع"],["b","الفروع"]]};
// ---------- المحادثة نفسها (مشتركة بين اللوحة والفرع والسواق) ----------
function convHtml(){
  return `<div class="bch"><button class="bcback" data-bcback type="button" aria-label="رجوع">→</button><span id="bcav"></span><div><b id="bct"></b><small id="bcsub"></small></div>${modal()?`<button data-bcclose type="button" aria-label="قفل">✕</button>`:""}</div>
  <div class="bcms" id="bcms"></div>
  <div class="bcrq" id="bcrq" hidden></div>
  <div class="bcq">${(QUICK[T()]||[]).map(q=>`<button data-bcq="${E(q)}" type="button">${E(q)}</button>`).join("")}</div>
  <div class="bcf" id="bcfoot"><textarea id="bcin" rows="1" maxlength="${LEN}" placeholder="اكتب رسالة..."></textarea><button class="mic" id="bcmic" type="button" title="رسالة صوتية" aria-label="رسالة صوتية">🎤</button><button id="bcsend" type="button">إرسال</button></div>
  <div class="bcr2" id="bcrec" hidden><span class="dot"></span><span class="tm" id="bcrt">0:00</span><button class="x" data-bccancel type="button">✕ إلغاء</button><button class="ok" data-bcstop type="button">✔ إرسال</button></div>`;
}
const emptyTxt=()=>`<div class="bcnone">💬<br>اختار من القائمة علشان تبدأ محادثة<br><small>🔒 محادثاتك خاصة بيك، محدش غيرك بيشوفها</small></div>`;
function buildRoot(){
  const r=document.createElement("div");r.className="bcw"+(modal()?" one":"");
  r.innerHTML=`<aside class="bcl">${modal()?`<div class="bclh"><div><b>💬 المحادثات</b><small id="bcpend"></small></div><button data-bcclose type="button" aria-label="قفل">✕</button></div>`:""}<div class="bcs"><input id="bcqs" type="search" placeholder="🔎 دوّر على اسم أو فرع" autocomplete="off"><div class="bcfl">${(GRP[T()]||[]).filter(([k])=>!(T()==="w"&&k==="b"&&!X.canBr)).map(([k,l])=>`<button type="button" data-bcf="${k}" class="${FILT===k?"on":""}">${E(l)}</button>`).join("")}</div></div><div class="bcli"></div></aside><section class="bcv empty">${convHtml()}</section>`;
  wire(r);
  r.addEventListener("scroll",e=>{const t=e.target;if(t.id==="bcms")SCR={...SCR,t:t.scrollTop,end:t.scrollHeight-t.scrollTop-t.clientHeight<90};else if(t.classList&&t.classList.contains("bcli"))SCR.l=t.scrollTop},true);
  r.querySelector("#bcms").innerHTML=modal()?"":emptyTxt();
  return r;
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
    if(t.closest("[data-bcrqx]")){if(CUR)delete CTX[CUR];paintCtx();return}
    if(t.closest("[data-bcmore]")){keepTop={h:g("bcms").scrollHeight,t:g("bcms").scrollTop};LIM+=PAGE;listen(GEN);return}
    if(t.closest("[data-bcback]")){if(ROOT)ROOT.classList.remove("open");setCode(null);paintList();return}
    if(t.closest("[data-bcclose]"))return void closeBr();
    const f=t.closest("[data-bcf]");if(f){FILT=f.dataset.bcf;el.querySelectorAll("[data-bcf]").forEach(b=>b.classList.toggle("on",b.dataset.bcf===FILT));paintList();return}
    const r=t.closest("[data-bcc]");if(r){setCode(cidFor(r.dataset.bcc));if(ROOT)ROOT.classList.add("open");paintList();if(!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},50)}
  });
  el.addEventListener("keydown",e=>{
    // الكمبيوتر: Enter يبعت و Shift+Enter سطر جديد. الموبايل: Enter سطر جديد عادي
    if(e.target.id==="bcin"&&e.key==="Enter"&&!e.shiftKey&&!isMob()){e.preventDefault();sendText()}
  });
  el.addEventListener("input",e=>{if(e.target.id==="bcin"){grow();if(CUR)DRAFT[CUR]=e.target.value}if(e.target.id==="bcqs"){Q=e.target.value.trim().toLowerCase();paintList()}});
}
function grow(){const t=g("bcin");if(!t)return;t.style.height="auto";t.style.height=Math.min(120,t.scrollHeight+2)+"px"}
function paintHead(){
  if(!g("bct"))return;
  const av=g("bcav");if(av)av.innerHTML="";
  if(!CUR){g("bct").textContent="";g("bcsub").textContent="";return}
  const p=peerOf(CUR),k=pk(p),img=ph(p);
  g("bct").innerHTML=`${p[0]==="d"?"🚚 ":p[0]==="b"?"🏬 ":""}<bdi${p[0]==="b"?' dir="ltr"':""}>${E(pname(p,CUR))}</bdi>`;
  g("bcsub").textContent=`${k?k+" · ":""}🔒 محادثة خاصة بينكم بس`;
  if(av&&img)av.innerHTML=`<img class="av" src="${img}" alt="">`;
}
function paintCtx(){const b=g("bcrq");if(!b)return;const c=CUR&&CTX[CUR];b.hidden=!c;if(c)b.innerHTML=`<span>📦 بخصوص طلب <bdi dir="ltr">${E(c.no)}</bdi></span><button data-bcrqx type="button" aria-label="شيل">✕</button>`}
function paintPend(){const p=g("bcpend");if(p)p.innerHTML=PEND?`📦 بخصوص طلب <bdi dir="ltr">${E(PEND.no)}</bdi> — اختار تكلّم مين`:"اختار تكلّم مين · 🔒 كل محادثة خاصة"}
// كل تغيير في المحادثة المفتوحة: نقفل السماع القديم ونبدأ جديد. GEN بيتأكد إن أي رد متأخر من محادثة تانية يتجاهل (مفيش تداخل)
function setCode(cid){
  if(CUR===cid)return;
  stopRec(true);stopPlay();
  if(UNM){UNM();UNM=null}
  CUR=cid;GEN++;MSGS=[];LIM=PAGE;keepTop=null;SCR.end=true;
  if(cid&&PEND){CTX[cid]=PEND;PEND=null;paintPend()}
  const v=ROOT&&ROOT.querySelector(".bcv");if(v)v.classList.toggle("empty",!cid);
  if(!g("bcms"))return;
  const i=g("bcin");if(i){i.value=cid?DRAFT[cid]||"":"";grow()}
  paintHead();paintCtx();
  if(!cid){g("bcms").innerHTML=modal()?"":emptyTxt();return}
  g("bcms").innerHTML=`<div class="bcmt">⏳ لحظة...</div>`;
  listen(GEN);
}
function listen(my){
  if(UNM){UNM();UNM=null}
  const cid=CUR;if(!cid)return;
  UNM=onSnapshot(query(collection(X.db,"dm",cid,"msgs"),orderBy("ts","desc"),limit(LIM)),sn=>{
    if(my!==GEN||cid!==CUR)return;
    MSGS=sn.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m&&typeof m.by==="string").sort((a,b)=>N(a.ts)-N(b.ts));
    paintMsgs();markRead();
  },e=>{if(my!==GEN||!g("bcms"))return;
    // محادثة جديدة لسه مااتعملتش (مفيش ولا رسالة): مش غلط
    if(e&&e.code==="permission-denied"&&!SUMS[cid]){MSGS=[];paintMsgs();return}
    g("bcms").innerHTML=`<div class="bcmt">⚠️ تعذر تحميل الرسايل${e&&e.code==="permission-denied"?" (مش مسموح)":"، اتأكد من النت"}</div>`});
}
// اتقرت إمتى: لو نفس يوم الإرسال الساعة بس، غير كده اليوم كمان
const rdAt=(rd,ts)=>new Date(N(rd)).toDateString()===new Date(N(ts)).toDateString()?hm(rd):when(rd)+" "+hm(rd);
function whoHtml(ap,m){
  if(ap[0]==="w"){const img=ph(ap),k=pk(ap),n=(DIR[pv(ap)]&&DIR[pv(ap)].n)||m.n||"المستودع";return `${img?`<img src="${img}" alt="">`:""}${E(n)}${k?` · ${E(k)}`:""}`}
  if(ap[0]==="b")return `${m.n?E(m.n)+" · ":""}فرع <bdi dir="ltr">${E(X.brn(pv(ap))||pv(ap))}</bdi>`;
  return `🚚 ${E(m.n||pname(ap))}`;
}
function paintMsgs(){
  const box=g("bcms");if(!box||!CUR)return;
  const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<90,firstPaint=!box.querySelector(".bcg,.bcmt.ok");
  let h=MSGS.length>=LIM?`<button class="bcmore" data-bcmore type="button">⬆ رسايل أقدم</button>`:"",d="";
  if(!MSGS.length)h+=`<div class="bcmt ok">💬 مفيش رسايل لسه.<br>اكتب لـ ${E(pname(peerOf(CUR),CUR))} أي حاجة، أو دوس 🎤 وسجّل رسالة صوتية.<br><small>🔒 الرسايل هنا محدش يشوفها غيركم</small></div>`;
  MSGS.forEach(m=>{const dd=dayOf(m.ts);if(dd!==d){d=dd;h+=`<div class="bcday">${E(dd)}</div>`}
    const me=mine(CUR,m.by),who=whoHtml(byParty(CUR,m.by),m);
    // gone: السيرفر مسح الصوت بعد 30 يوم (علشان مساحة Firebase المجانية)
    const body=m.v&&m.gone?`<div class="bcgone">🎤 رسالة صوتية (${mmss(m.d)}) · اتمسحت تلقائياً بعد 30 يوم</div>`:m.v?`<div class="bcvo"><button data-play="${E(m.id)}" type="button" aria-label="تشغيل">${PLAY.id===m.id?"⏸":"▶"}</button><span class="bar"><b id="bcpb-${E(m.id)}"></b></span><span class="du">${mmss(m.d)}</span></div>`:E(m.t||"");
    const rq=m.rq&&m.rq.no?`<span class="rqt">📦 بخصوص طلب <bdi dir="ltr">${E(m.rq.no)}</bdi></span>`:"";
    // الاسم + وقت الإرسال + (لرسايلي) اتقرت إمتى
    h+=`<div class="bcg ${me?"me":"ot"}"><i>${who}</i>${rq}${body}<small><span>🕒 ${hm(m.ts)}</span>${me?(m.rd?`<em>✓✓ اتقرت ${rdAt(m.rd,m.ts)}</em>`:"<span>✓ لسه ماتقرتش</span>"):""}</small></div>`});
  box.innerHTML=h;
  if(keepTop){box.scrollTop=box.scrollHeight-keepTop.h+keepTop.t;keepTop=null}
  else if(atEnd||firstPaint)box.scrollTop=box.scrollHeight;
}
// "اتقرت": لما المحادثة مفتوحة قدامه فعلاً. بنسجّل وقت القراية على كل رسالة من الطرف التاني (rd) + نصفّر العدّاد
function markRead(){
  if(!X||!CUR||document.hidden||marking||!X.visible())return;
  const s=SUMS[CUR],un=MSGS.filter(m=>!mine(CUR,m.by)&&!m.rd).slice(-100);
  if(!(s&&unreadOf(s))&&!un.length)return;
  marking=true;const cid=CUR,now=Date.now(),b=writeBatch(X.db);
  if(s&&unreadOf(s)){if(s._old)b.update(doc(X.db,"dm",cid),T()==="b"?{rb:now,nb:0}:{rw:now,nw:0});else{const i=s.ps.indexOf(X.me);b.update(doc(X.db,"dm",cid),{["r"+i]:now,["n"+i]:0})}}
  un.forEach(m=>b.update(doc(X.db,"dm",cid,"msgs",m.id),{rd:now}));
  b.commit().catch(()=>{}).finally(()=>{marking=false});
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)markRead()});
// ---------- الإرسال ----------
function write(cid,m,a){
  const ts=Date.now(),n=String(X.name()||"").trim().slice(0,60),b=writeBatch(X.db),ref=doc(collection(X.db,"dm",cid,"msgs"));
  const old=isOld(cid),by=old?oldBy():X.me,rq=CTX[cid],msg={by,n,ts,...m,...(rq?{rq:{id:String(rq.id).slice(0,40),no:String(rq.no).slice(0,40)}}:{})};
  if(a)b.set(doc(X.db,"dm",cid,"aud",ref.id),{a});
  b.set(ref,msg);
  const last={by,n,t:m.v?"🎤 رسالة صوتية":String(m.t).slice(0,200),ts,v:!!m.v};
  if(old){
    const code=cid.slice(0,cid.indexOf(SEP)),wh=cid.slice(cid.indexOf(SEP)+SEP.length),sum={brn:String(X.brn(code)||code).slice(0,40),last};
    // اسم الشخص: المستودع بيحدّثه دايماً، والفرع بيكتبه بس في أول رسالة (القواعد مش بتسمح للفرع يغيّره)
    if(by==="wh")Object.assign(sum,{br:code,wh,whn:n||"المستودع",lw:ts,rw:ts,nb:increment(1)});
    else Object.assign(sum,SUMS[cid]?{}:{br:code,wh,whn:String(pname("w-"+wh,cid)).slice(0,60)},{lb:ts,rb:ts,nw:increment(1)});
    b.set(doc(X.db,"dm",cid),sum,{merge:true});
  }else{
    // الجديدة: الطرفين مترتبين، وأنا الطرف رقم i. اسمي في nm (كل واحد بيكتب اسمه هو بس)
    const peer=peerOf(cid),ps=[X.me,peer].sort(),i=ps.indexOf(X.me),o=1-i;
    b.set(doc(X.db,"dm",cid),{ps,nm:{[X.me]:String(X.myLabel?X.myLabel():n||pname(X.me)).slice(0,60)},last,["l"+i]:ts,["r"+i]:ts,["n"+o]:increment(1)},{merge:true});
  }
  return b.commit();
}
async function deliver(cid,m,a,onOk){
  busy=true;const sb=g("bcsend");if(sb)sb.disabled=true;
  try{await withTimeout(write(cid,m,a),20000);onOk&&onOk();X.ping(cid)}
  catch(x){
    const w=await failReason(x);
    // النت بطيء: الرسالة محفوظة على الجهاز وهتتبعت لوحدها (ما نبعتهاش تاني علشان ما تتكررش)
    if(w==="slow"){onOk&&onOk();X.toast("⏳ النت بطيء: الرسالة هتتبعت لوحدها أول ما الاتصال يتحسّن");X.ping(cid)}
    else{const p=peerOf(cid),gone=(p[0]==="w"&&!DIR[pv(p)])||(p[0]==="d"&&!DDIR[pv(p)]);
      X.toast(w==="denied"?(gone?"الشخص ده مابقاش موجود. اختار حد تاني":"مش مسموح لك تبعت في المحادثة دي (ممكن القواعد لسه ما اتحدّثتش)"):FAIL_MSG[w]||"تعذر الإرسال",true)}
  }
  busy=false;if(g("bcsend"))g("bcsend").disabled=false;
}
function sendText(){
  const i=g("bcin");if(!i||!CUR||busy)return;
  const t=i.value.trim().slice(0,LEN),cid=CUR;if(!t)return;
  deliver(cid,{t},null,()=>{DRAFT[cid]="";if(CUR===cid){i.value="";grow()}});
}

// ---------- الرسايل الصوتية ----------
function paintRec(){
  const r=g("bcrec"),f=g("bcfoot"),q=ROOT&&ROOT.querySelector(".bcq");if(!r)return;
  r.hidden=!REC;f.hidden=!!REC;if(q)q.hidden=!!REC;
  if(REC)g("bcrt").innerHTML=`${mmss((Date.now()-REC.t0)/1000)} <small>/ ${mmss(MAXS)} · بيسجّل…</small>`;
}
async function startRec(){
  if(!CUR||REC||busy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)return void X.toast("المتصفح ده مش بيدعم تسجيل الصوت. جرّب Chrome أو حدّث المتصفح.",true);
  const cid=CUR,my=GEN;let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){return void X.toast(e&&(e.name==="NotAllowedError"||e.name==="SecurityError")?(isMob()?"اسمح للمنصة تستخدم المايك: من إعدادات الموقع أو التطبيق ← الميكروفون ← سماح":"اسمح للمنصة تستخدم المايك: علامة القفل 🔒 جنب الرابط ← الميكروفون ← سماح"):"مفيش مايك شغّال على الجهاز ده",true)}
  if(my!==GEN||cid!==CUR||REC){stream.getTracks().forEach(t=>t.stop());return}
  const type=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"].find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(e){return false}})||"";
  let mr;try{mr=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:24000})}catch(e){mr=new MediaRecorder(stream)}
  const r={cid,my,mr,stream,chunks:[],size:0,t0:Date.now(),cancel:false,done:false};REC=r;
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
  if(r.my!==GEN||r.cid!==CUR)return;// المحادثة اتغيّرت أثناء التسجيل: نلغي
  if(N(r.dur)<1)return void X.toast("الرسالة قصيرة أوي. دوس 🎤 واتكلم، وبعدين دوس إرسال");
  const blob=new Blob(r.chunks,{type:String(r.mr.mimeType||(r.chunks[0]&&r.chunks[0].type)||"audio/webm").split(";")[0]||"audio/webm"});
  if(blob.size>MAXB*1.05)return void X.toast("الرسالة الصوتية طويلة. سجّل رسالة أقصر",true);
  let a="";try{a=await new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(String(f.result||""));f.onerror=no;f.readAsDataURL(blob)})}catch(e){}
  if(!/^data:audio\/[a-z0-9.+-]+;base64,/.test(a))return void X.toast("تعذر تجهيز الرسالة الصوتية",true);
  deliver(r.cid,{v:true,d:Math.max(1,Math.round(r.dur))},a);
}
// ---------- تشغيل الصوت ----------
function stopPlay(){const p=PLAY;PLAY={id:null,au:null};if(p.au){try{p.au.pause()}catch(e){}}if(p.id){const b=document.querySelector(`[data-play="${p.id}"]`);if(b)b.textContent="▶";const bar=g("bcpb-"+p.id);if(bar)bar.style.width="0"}}
async function play(id){
  if(PLAY.id===id)return void stopPlay();
  stopPlay();
  const cid=CUR,my=GEN,key=cid+"/"+id,btn=()=>document.querySelector(`[data-play="${id}"]`);
  // بنجهّز الصوت جوه الضغطة نفسها (الآيفون مش بيشغّل صوت إلا من ضغطة مباشرة)
  const au=new Audio();PLAY={id,au};au.src=SILENT;au.play().catch(()=>{});
  let a=AUD.get(key);
  if(!a){
    const b=btn();if(b)b.textContent="⏳";
    let none=false;
    try{const s=await withTimeout(getDoc(doc(X.db,"dm",cid,"aud",id)),15000);none=!s.exists();a=none?"":String(s.data().a||"")}catch(e){a=""}
    if(my!==GEN||PLAY.au!==au)return;
    if(!/^data:audio\//.test(a)){stopPlay();return void X.toast(none?"الرسالة الصوتية دي اتمسحت (أقدم من 30 يوم)":"تعذر تحميل الرسالة الصوتية",true)}
    AUD.set(key,a);if(AUD.size>40)AUD.delete(AUD.keys().next().value);
  }
  au.src=a;
  au.ontimeupdate=()=>{const bar=g("bcpb-"+id);if(bar&&au.duration&&isFinite(au.duration))bar.style.width=Math.min(100,au.currentTime/au.duration*100)+"%"};
  au.onended=()=>{if(PLAY.au===au)stopPlay()};
  au.onerror=()=>{if(PLAY.au===au){stopPlay();X.toast("الجهاز ده مش قادر يشغّل الرسالة الصوتية دي",true)}};
  try{await au.play();const b=btn();if(b&&PLAY.au===au)b.textContent="⏸"}catch(e){if(PLAY.au===au){stopPlay();X.toast("دوس ▶ تاني علشان تسمع الرسالة")}}
}
// ---------- القايمة: كل اللي أقدر أكلّمهم ----------
// المستودع: الفروع (لو معاه الطلبات أو مدير) + السواقين + الموظفين. الفرع: المستودع (اللي بيرد على الفروع بس) + السواقين + الفروع.
// السواق: المستودع + الفروع. (سواق مع سواق ممنوع)
function people(){
  const out=[],seen=new Set(),add=p=>{if(p&&p!==X.me&&!seen.has(p)){seen.add(p);out.push(p)}};
  const brs=()=>(X.codes||[]).forEach(b=>add("b-"+String(b).split("-")[0]));
  if(T()==="w"){if(X.canBr)brs();Object.keys(DDIR).forEach(d=>add("d-"+d));Object.keys(DIR).forEach(e=>add("w-"+e))}
  else if(T()==="b"){Object.entries(DIR).forEach(([e,d])=>{if(["owner","admin","req"].includes(d&&d.r))add("w-"+e)});Object.keys(DDIR).forEach(d=>add("d-"+d));brs()}
  else{Object.keys(DIR).forEach(e=>add("w-"+e));brs()}
  Object.values(SUMS).forEach(s=>add(s._peer));// محادثات مع ناس مابقوش في القايمة بتفضل ظاهرة
  return out;
}
function paintList(){
  if(!ROOT)return;const box=ROOT.querySelector(".bcli");if(!box)return;
  const rows=people().filter(p=>!FILT||p[0]===FILT).map(p=>{
    const cid=cidFor(p),s=SUMS[cid],n=pname(p,cid),t=p[0],d=t==="w"?DIR[pv(p)]:null;
    const role=t==="w"?(d?d.k||"":"مابقاش في المستودع"):t==="d"?(DDIR[pv(p)]?"سواق":"مابقاش موجود"):"";
    return {p,cid,s,u:unreadOf(s),n,img:ph(p),av:t==="b"?E(pv(p)):t==="d"?"🚚":E([...n][0]||"؟"),cls:t==="b"?"":" p",role,o:t==="w"?(d?ROLE_O[d.r]??3:9):t==="d"?4:5};
  }).filter(x=>!Q||x.n.toLowerCase().includes(Q)||x.p.toLowerCase().includes(Q))
    .sort((a,b)=>(b.u>0)-(a.u>0)||N(b.s&&b.s.last&&b.s.last.ts)-N(a.s&&a.s.last&&a.s.last.ts)||a.o-b.o||a.n.localeCompare(b.n));
  box.innerHTML=rows.map(x=>{const l=x.s&&x.s.last;const pvw=l?(mine(x.cid,l.by)?"أنت: ":"")+l.t:"ابدأ محادثة";
    return `<button class="bcr${x.cid===CUR?" on":""}${x.u?" nw":""}" data-bcc="${E(x.p)}" type="button">${x.img?`<img class="av" src="${x.img}" alt="">`:`<span class="av${x.cls}">${x.av}</span>`}<span class="nm"><b><bdi${x.p[0]==="b"?' dir="ltr"':""}>${E(x.n)}</bdi>${x.role?`<u>${E(x.role)}</u>`:""}</b><small>${E(pvw)}</small></span><span class="mt"><small>${l?when(l.ts):""}</small>${x.u?`<i>${x.u}</i>`:""}</span></button>`}).join("")
    ||`<div class="bcnone">${Q?"مفيش نتايج بالاسم ده":"لسه مفيش حد هنا"}</div>`;
}
// الصفحة بتعيد رسم نفسها كتير، فالشات عنصر ثابت بنحطّه في مكانه كل مرة (الكتابة والتسجيل مايضيعوش)
export function mountWh(host){
  if(!X||!host||modal())return;
  if(!ROOT)ROOT=buildRoot();
  // نقل العنصر بيصفّر مكان السكرول، فبنرجّعه زي ما كان
  host.appendChild(ROOT);paintList();
  const ms=ROOT.querySelector("#bcms"),li=ROOT.querySelector(".bcli");ms.scrollTop=SCR.end?ms.scrollHeight:SCR.t;li.scrollTop=SCR.l;
  if(CUR){paintHead();markRead()}
}
// خرجنا من تبويب الشات: نقفل المحادثة المفتوحة (توفير قراءات + وقف أي تسجيل)
export function hideWh(){if(CUR&&X&&!modal()){setCode(null);if(ROOT)ROOT.classList.remove("open")}}
// المستودع: يفتح محادثة مع طرف (rq = بخصوص طلب)
export function openPeer(p,rq){
  if(!X||!/^[bdw]-./.test(String(p||""))||p===X.me)return;
  if(modal())return void openBr(p,rq);
  if(!ROOT)ROOT=buildRoot();
  const cid=cidFor(p);if(rq)CTX[cid]=rq;setCode(cid);paintCtx();ROOT.classList.add("open");paintList();
}
export function openWh(code,rq){if(/^\d{3}$/.test(String(code||"")))openPeer("b-"+code,rq)}
// ---------- الفرع والسواق: زرار عائم + نافذة ----------
function paintFab(){
  if(!X||!modal())return;const n=unreadTotal();
  const f=g("bcfab");if(f){f.innerHTML=`💬${n?`<i>${n}</i>`:""}`;f.classList.toggle("nw",!!n);f.title=n?`${n} رسالة جديدة`:"المحادثات"}
  const m=g("bcme");if(m)m.innerHTML=`💬 ${T()==="b"?"المحادثات":"الرسايل"}${n?` <i>${n}</i>`:""}`;
  if(X.onBadge)X.onBadge(n);
}
// peer = الطرف (أو إيميل الشخص من إشعارات قديمة)، rq = بخصوص طلب (الفرع يختار يكلّم مين عنه)
export function openBr(peer,rq){
  if(!X||!modal())return;
  if(typeof peer==="string"&&peer.includes("@")&&!/^w-/.test(peer))peer="w-"+peer;
  let m=g("bcm");
  if(!m){m=document.createElement("div");m.id="bcm";m.innerHTML=`<div class="bcp"></div>`;document.body.appendChild(m);ROOT=buildRoot();m.firstChild.appendChild(ROOT);
    m.addEventListener("click",e=>{if(e.target===m)closeBr()});addEventListener("keydown",e=>{if(e.key==="Escape"&&g("bcm")&&g("bcm").classList.contains("on")&&!REC)closeBr()})}
  m.className="on";
  if(rq){PEND=rq;setCode(null);ROOT.classList.remove("open");if(T()==="b"){FILT="w";ROOT.querySelectorAll("[data-bcf]").forEach(b=>b.classList.toggle("on",b.dataset.bcf===FILT))}}
  else if(peer&&typeof peer==="string"&&/^[bdw]-./.test(peer)&&peer!==X.me){setCode(cidFor(peer));ROOT.classList.add("open")}
  else if(!CUR)ROOT.classList.remove("open");
  paintPend();paintList();markRead();
  if(CUR&&!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},60);
}
function closeBr(){const m=g("bcm");if(m)m.className="";PEND=null;setCode(null);if(ROOT)ROOT.classList.remove("open");paintFab()}
// ---------- التشغيل ----------
// ctx = {db, party:"b-003"|"w-email"|"d-drv1", name:()=>اسم الكاتب, myLabel?:()=>اسمي في القايمة عند التاني, brn:code=>اسم الفرع,
//        codes:[قائمة الفروع], canBr (المستودع: يقدر يكلّم الفروع؟), toast, beep, notify, ping:cid=>..., visible:()=>المحادثة قدامه؟,
//        onBadge(n), show:()=>يفتح تبويب الشات (المستودع)}
export function initBChat(ctx){
  stopBChat();
  // (توافق: الصفحات القديمة كانت بتبعت by + me/code)
  const party=ctx.party||(ctx.by==="br"?"b-"+ctx.code:ctx.by==="wh"?"w-"+String(ctx.me||"").toLowerCase():"");
  if(!/^[bdw]-./.test(party))return;
  X={...ctx,me:party,by:party[0]==="b"?"br":party[0]==="w"?"wh":"d",canBr:party[0]==="w"?ctx.canBr!==false:false,brn:ctx.brn||(c=>c)};
  first=true;SUMS={};SO={};SN={};DIR={};DDIR={};FILT="";
  if(!g("bc-css")){const s=document.createElement("style");s.id="bc-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(!window.__bcrq){window.__bcrq=1;document.addEventListener("click",e=>{const b=e.target.closest("[data-bcrq]");if(!b||!X)return;
    const rq={id:b.dataset.bcrq,no:b.dataset.no};if(T()==="w"){if(X.show)X.show();openWh(b.dataset.br,rq)}else openBr(null,rq)})}
  const onSum=()=>{
    const old=SUMS;SUMS={};
    Object.entries(SO).forEach(([cid,s])=>{if(s&&s.br&&s.wh)SUMS[cid]={...s,cid,_old:true,_peer:peerOf(cid)}});
    Object.entries(SN).forEach(([cid,s])=>{if(s&&Array.isArray(s.ps)&&s.ps.includes(X.me))SUMS[cid]={...s,cid,_peer:peerOf(cid)}});
    if(!first)Object.entries(SUMS).forEach(([cid,s])=>{const l=s.last,o=old[cid]&&old[cid].last;
      if(l&&!mine(cid,l.by)&&N(l.ts)>N(o&&o.ts)&&!(CUR===cid&&X.visible()&&!document.hidden)){
        const who=pname(s._peer,cid);X.toast(`💬 ${who}: ${String(l.t).slice(0,70)}`);if(X.beep)X.beep();
        if(X.notify)X.notify("💬 "+who,String(l.t).slice(0,140),"g"+cid);
      }});
    first=false;paintHead();if(CUR)paintMsgs();paintList();paintFab();markRead();
    if(!modal()&&X.onBadge)X.onBadge(unreadTotal());
  };
  let gotO=T()==="d"||(T()==="w"&&!X.canBr),gotN=false;
  const fire=()=>{if(gotO&&gotN)onSum()};
  // أسماء وكنيات وصور اللي في المستودع، وأسماء السواقين
  const again=()=>{paintList();paintHead();if(CUR)paintMsgs()};
  UND=onSnapshot(collection(X.db,"whdir"),sn=>{DIR={};sn.docs.forEach(d=>{DIR[d.id]=d.data()});again()},()=>{});
  UNA=onSnapshot(collection(X.db,"ava"),sn=>{AVA={};sn.docs.forEach(d=>{const p=d.data().ph;if(typeof p==="string"&&/^data:image\/jpeg;base64,/.test(p))AVA[d.id]=p});again()},()=>{});
  UNDD=onSnapshot(collection(X.db,"ddir"),sn=>{DDIR={};sn.docs.forEach(d=>{DDIR[d.id]=d.data()});again()},()=>{});
  // محادثاتي: القديمة (فرع مع المستودع) + الجديدة (ps فيها أنا)
  if(T()==="b")UNS=onSnapshot(query(collection(X.db,"dm"),where("br","==",pv(X.me))),sn=>{SO={};sn.docs.forEach(d=>SO[d.id]=d.data());gotO=true;fire()},()=>{gotO=true;fire()});
  else if(T()==="w"&&X.canBr)UNS=onSnapshot(query(collection(X.db,"dm"),where("wh","==",pv(X.me))),sn=>{SO={};sn.docs.forEach(d=>SO[d.id]=d.data());gotO=true;fire()},()=>{gotO=true;fire()});
  UNS2=onSnapshot(query(collection(X.db,"dm"),where("ps","array-contains",X.me)),sn=>{SN={};sn.docs.forEach(d=>SN[d.id]=d.data());gotN=true;fire()},()=>{gotN=true;fire()});
  if(modal()){
    if(!g("bcfab")){const f=document.createElement("button");f.id="bcfab";f.type="button";f.setAttribute("aria-label","المحادثات");f.onclick=()=>openBr();document.body.appendChild(f)}
    const at=g("mx")||g("out");if(at&&!g("bcme")){const b=document.createElement("button");b.id="bcme";b.type="button";b.onclick=()=>openBr();at.parentNode.insertBefore(b,at)}
    paintFab();
  }
}
export function stopBChat(){
  if(!X)return;stopRec(true);stopPlay();[UNM,UNS,UNS2,UND,UNA,UNDD].forEach(f=>f&&f());UNM=UNS=UNS2=UND=UNA=UNDD=null;
  CUR=null;GEN++;MSGS=[];SUMS={};SO={};SN={};DIR={};DDIR={};AVA={};DRAFT={};CTX={};PEND=null;AUD.clear();
  const m=g("bcm");if(m)m.remove();["bcfab","bcme"].forEach(id=>{const e=g(id);if(e)e.remove()});
  if(ROOT){ROOT.remove();ROOT=null}
  X=null;
}

// ---------- مسح الشات القديم المشترك (مرة واحدة، من جهاز المالك) ----------
// الشات قبل كده كان مشترك (chats/{code} و msgs جوه كل طلب)، فبنمسحه كله علشان محدش يشوف رسايل حد تاني.
export async function wipeOldChat(db){
  try{
    if((await getDoc(doc(db,"meta","chatv2"))).exists())return;
    let n=0;const del=async refs=>{for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}n+=refs.length};
    const cs=await getDocs(collection(db,"chats"));
    for(const c of cs.docs)for(const sub of ["msgs","aud"])await del((await getDocs(collection(db,"chats",c.id,sub))).docs.map(d=>doc(db,"chats",c.id,sub,d.id)));
    await del(cs.docs.map(d=>doc(db,"chats",d.id)));
    const rq=(await getDocs(query(collection(db,"requests"),where("msgs","!=",null)))).docs;
    for(let i=0;i<rq.length;i+=400){const b=writeBatch(db);rq.slice(i,i+400).forEach(d=>b.update(doc(db,"requests",d.id),{msgs:deleteField()}));await b.commit()}
    await setDoc(doc(db,"meta","chatv2"),{at:Date.now(),n:n+rq.length});
  }catch(e){console.warn("wipe old chat",e&&(e.code||e.message))}
}
