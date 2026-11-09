// الدردشة الخاص: نص + رسايل صوتية. كل محادثة بين طرفين بس، ومحدش غيرهم يقدر يشوفها (ولا حتى المالك والمديرين).
// الأطراف: الفروع (b-كود)، اللي في المستودع (w-إيميل)، السائقين (d-رقم). سائق مع سائق ممنوع (نوفمبر 2026).
//   فرع مع المستودع (الشكل القديم، زي ما هو):
// كل محادثة = فرع واحد + شخص واحد من المستودع (المالك أو مدير أو موظف طلبات). محدش غيرهم يقدر يشوفها، حتى المالك والمديرين
// (firestore.rules هي اللي بتمنع ده، مش الصفحة بس). الفرع بيختار يكلّم مين من قايمة الأسماء (whdir).
//   dm/{code}__{email}  = ملخّص: {br, brn, wh:إيميل الشخص, whn:اسمه, last:{by,n,t,ts,v}, lb, lw, rb, rw, nb, nw}
//                         lb/lw = آخر رسالة من الفرع/المستودع، rb/rw = قرا إلى إمتى، nb/nw = رسايل لم تُقرأ بعد عند الفرع/المستودع
//   dm/{cid}/msgs/{id}  = رسالة: {by:"br"|"wh", n:اسم اللي كتب, t?:النص, v?+d?:صوت ومدته بالثواني, ts, rq?:{id,no} بخصوص طلب, rd?:قُرئت إمتى}
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
const QUICK={b:["نحتاج بضاعة بشكل عاجل 🙏","أين طلبنا؟","حسناً، شكراً 👍"],w:["حسناً 👍","جاري التجهيز ⏳","سيصلكم اليوم 🚚","الصنف غير متوفر حالياً"],d:["في الطريق 🚚","وصلت ✅","سأتأخر قليلاً ⏳","حسناً 👍"]};
// المحادثات الجديدة (سواقين، موظفين مع بعض، فروع مع بعض): dm/{طرف1}__{طرف2} مترتبين = {ps:[الطرفين], nm:{طرف:اسمه}, last:{by:الطرف,...},
//   l0/l1 آخر رسالة من الطرف 0/1، r0/r1 قرا إلى إمتى، n0/n1 لا يزال ماقراش كام}، والرسائل by = الطرف. ddir/{drv1} = {n} أسماء السائقين
const QALL=new Set([].concat(...Object.values(QUICK)));// الردود السريعة تُترجم، أما ما يكتبه الناس فلا (data-notr)
const ROLE_O={owner:0,admin:1,req:2};// ترتيب القايمة عند الفرع بس (مش بيظهر)
// CUR = المحادثة المفتوحة (cid). CTX = "بخصوص طلب" لكل محادثة، PEND = طلب مستني الفرع يختار يكلّم مين عنه. AVA = الصور
let X=null,SUMS={},SO={},SN={},DIR={},DDIR={},AVA={},FILT="",CUR=null,GEN=0,UNM=null,UNS=null,UNS2=null,UND=null,UNA=null,UNDD=null,MSGS=[],LIM=PAGE,DRAFT={},CTX={},PEND=null,REC=null,PLAY={id:null,au:null},busy=false,marking=false,first=true,keepTop=null,ROOT=null,Q="";
const AUD=new Map();let SCR={t:0,end:true,l:0};
const STYLE=`
.bcv [hidden]{display:none!important}
.bcv{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--card);color:var(--ink);height:100%}
/* رأس المحادثة: صورة + اسم + حالة، زي تطبيقات التواصل */
.bch{display:flex;align-items:center;gap:11px;padding:9px 12px;background:var(--card);color:var(--ink);border-bottom:1px solid var(--line);flex:none;z-index:3;box-shadow:0 2px 10px rgba(0,0,0,.04)}
.bch>div{flex:1;min-width:0}.bch b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch small{display:flex;align-items:center;gap:4px;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch button,.bclh button{font:inherit;background:transparent;color:inherit;border:0;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;flex:none;display:grid;place-items:center;transition:background .15s}
.bch button:hover,.bclh button:hover{background:var(--soft,#f6f2e9)}
.bch #bcav:empty{display:none}
/* الصور الرمزية: صورة الشخص، أو أول حرف بلون ثابت لكل اسم */
.av{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:16px;flex:none;color:#fff;direction:ltr;object-fit:cover;position:relative;overflow:hidden;letter-spacing:-.3px}
.av.c0{background:linear-gradient(135deg,#d9b25f,#a8832f)}.av.c1{background:linear-gradient(135deg,#3f8fd8,#235f9e)}.av.c2{background:linear-gradient(135deg,#3fb27f,#1f7a52)}.av.c3{background:linear-gradient(135deg,#e0776a,#b04538)}
.av.c4{background:linear-gradient(135deg,#8b74e0,#5a43b0)}.av.c5{background:linear-gradient(135deg,#2bb3c0,#17808b)}.av.c6{background:linear-gradient(135deg,#e39a4a,#b36b1e)}.av.c7{background:linear-gradient(135deg,#4b4b4b,#1b1b1b);color:#e8cf8a}
.av.sm{width:40px;height:40px;font-size:14.5px}.av.avb{font-size:13.5px}.av.avd{font-size:21px}
img.av{background:#1b1b1b}
/* منطقة الرسايل: خلفية بنقشة هادية */
.bcms{flex:1;overflow-y:auto;padding:10px 14px 14px;display:flex;flex-direction:column;gap:0;overscroll-behavior:contain;scroll-behavior:auto;
 background-color:#efe8db;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23a07a2c' stroke-opacity='.10' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3Cpath d='M128 128c0-6 10-6 10 0s-10 10-10 10-10-4-10-10 10-6 10 0'/%3E%3Ccircle cx='140' cy='40' r='2'/%3E%3Ccircle cx='70' cy='140' r='2'/%3E%3Ccircle cx='8' cy='70' r='2'/%3E%3C/g%3E%3C/svg%3E")}
.bcmt{margin:auto;text-align:center;color:var(--mut);font-size:14.5px;line-height:1.9;padding:18px 22px;background:rgba(255,255,255,.75);border-radius:14px;max-width:340px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bcmt.ok b{display:block;font-size:34px;line-height:1.3}
.bcday{position:sticky;top:4px;z-index:2;align-self:center;font-size:12px;font-weight:700;color:#5b5446;background:rgba(255,253,248,.95);border-radius:9px;padding:4px 12px;margin:10px 0 6px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
/* الفقاعة */
.bcg{position:relative;display:flex;flex-wrap:wrap;align-items:flex-end;column-gap:10px;max-width:min(80%,560px);border-radius:12px;padding:6px 10px 5px;font-size:15px;line-height:1.55;word-wrap:break-word;overflow-wrap:anywhere;margin-top:8px;box-shadow:0 1px 1px rgba(0,0,0,.12);animation:bc-in .22s cubic-bezier(.2,.9,.3,1.2) both}
.bcg.cont{margin-top:2px}
.bcg>i{flex-basis:100%;display:flex;align-items:center;gap:6px;font-style:normal;font-size:12.5px;font-weight:800;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcg>i img{width:18px;height:18px;border-radius:50%;object-fit:cover}
.bcg .bx{flex:1 1 auto;white-space:pre-wrap;min-width:0}
.bcg small{flex:none;display:inline-flex;align-items:center;gap:3px;margin-inline-start:auto;font-size:11px;line-height:1;color:rgba(0,0,0,.45);padding-top:6px;white-space:nowrap;direction:ltr}
.bcg .tk{width:17px;height:11px;flex:none;color:#8d8778}.bcg .tk.rd{color:#2a9df4}
.bcg .rqt{flex-basis:100%;display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;background:rgba(0,0,0,.06);border-inline-start:3px solid #a8832f;border-radius:6px;padding:4px 8px;margin:2px 0 5px}
.bcg.me{align-self:flex-start;background:#f6e2b0;color:#1f1a10;border-start-start-radius:3px}
.bcg.ot{align-self:flex-end;background:#fff;color:#1b1b1b;border-start-end-radius:3px}
.bcg.cont.me{border-start-start-radius:12px}.bcg.cont.ot{border-start-end-radius:12px}
.bcg:not(.cont)::before{content:"";position:absolute;top:0;width:9px;height:13px}
.bcg.me:not(.cont)::before{right:-8px;background:#f6e2b0;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot:not(.cont)::before{left:-8px;background:#fff;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.me:not(.cont)::before{right:auto;left:-8px;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.ot:not(.cont)::before{left:auto;right:-8px;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot>i{color:#a8832f}
.bcseen{align-self:flex-start;display:flex;align-items:center;gap:4px;font-size:11.5px;color:#6d6656;margin:3px 4px 0;animation:ui-fade .3s ease both}
.bcseen .tk{width:16px;height:11px;color:#8d8778}.bcseen .tk.rd{color:#2a9df4}
@keyframes bc-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
/* الرسالة الصوتية: موجة بتتملي وهي شغّالة */
.bcvo{display:flex;align-items:center;gap:10px;min-width:210px;direction:ltr;flex:1 1 auto;padding:2px 0}
.bcvo button{width:40px;height:40px;border-radius:50%;border:0;background:#a8832f;color:#fff;font-size:15px;cursor:pointer;flex:none;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.bcg.ot .bcvo button{background:#1b1b1b}
.bcvo span.bar{flex:1;height:26px;position:relative;background:rgba(0,0,0,.2);
 -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat;
 mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat}
.bcvo span.bar b{position:absolute;inset:0 auto 0 0;display:block;width:0;background:#a8832f;transition:width .2s linear}
.bcg.ot .bcvo span.bar b{background:#1b1b1b}
.bcvo span.du{font-size:12px;font-weight:700;opacity:.7;min-width:30px}
.bcgone{font-size:13px;opacity:.75;font-style:italic;flex:1 1 auto}
.bcmore{align-self:center;font:inherit;font-size:13px;font-weight:700;border:0;background:rgba(255,253,248,.95);color:#5b5446;border-radius:999px;padding:6px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);margin:4px 0}
/* زرار النزول لآخر رسالة */
.bcdown{position:absolute;inset-inline-start:16px;bottom:96px;z-index:4;width:42px;height:42px;border-radius:50%;border:0;background:var(--card);color:var(--ink);box-shadow:0 3px 12px rgba(0,0,0,.2);cursor:pointer;display:grid;place-items:center;animation:ui-fade .2s ease both}
.bcdown svg{width:20px;height:20px}
.bcrq{display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;background:var(--card);border-top:1px solid var(--line);font-size:13.5px;font-weight:700;flex:none;color:var(--ink)}
.bcrq span{flex:1;border-inline-start:3px solid #a8832f;padding-inline-start:9px;color:#8a6a22}
.bcrq button{font:inherit;border:0;background:var(--soft,#f3f1ed);color:inherit;border-radius:50%;width:28px;height:28px;cursor:pointer}
/* الردود السريعة + خانة الكتابة */
.bcq{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 0;scrollbar-width:none;flex:none;background:#efe8db}.bcq::-webkit-scrollbar{display:none}
.bcq button{font:inherit;font-size:13px;font-weight:600;white-space:nowrap;border-radius:999px;border:1px solid rgba(168,131,47,.35);background:rgba(255,253,248,.95);color:#5b4512;padding:5px 13px;cursor:pointer;flex:none;transition:transform .12s,background .12s}
.bcq button:hover{background:#fff6dc}.bcq button:active{transform:scale(.96)}
.bcf{display:flex;gap:8px;align-items:flex-end;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcf textarea{flex:1;resize:none;font:inherit;font-size:16px;line-height:1.45;max-height:130px;min-height:48px;border-radius:24px;border:0;background:var(--card);color:var(--ink);padding:12px 18px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.bcf textarea:focus{outline:0;box-shadow:0 0 0 2px rgba(212,174,92,.6),0 1px 2px rgba(0,0,0,.12)}
.bcf button{border:0;border-radius:50%;width:48px;height:48px;padding:0;background:linear-gradient(135deg,#d9b25f,#a8832f);color:#fff;cursor:pointer;flex:none;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .15s}
.bcf button:active{transform:scale(.92)}.bcf button svg{width:22px;height:22px}
.bcf button:disabled{opacity:.5}
.bcf.has #bcmic{display:none}.bcf:not(.has) #bcsend{display:none}
#bcsend svg{animation:bc-pop .18s ease both}html[dir="rtl"] #bcsend svg{transform:scaleX(-1)}
@keyframes bc-pop{from{transform:scale(.5)}}
html[dir="rtl"] #bcsend svg{animation:none}
/* التسجيل */
.bcr2{display:flex;align-items:center;gap:10px;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcr2 .pill{flex:1;display:flex;align-items:center;gap:10px;background:var(--card);border-radius:24px;height:48px;padding:0 16px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.bcr2 .dot{width:11px;height:11px;border-radius:50%;background:#e03b2f;animation:bc-pulse 1s ease-in-out infinite;flex:none}
.bcr2 .tm{flex:1;font-weight:800;font-size:16px;direction:ltr;text-align:right}.bcr2 .tm small{font-weight:400;color:var(--mut);font-size:12.5px}
.bcr2 button{font:inherit;font-weight:800;border:0;border-radius:50%;width:48px;height:48px;cursor:pointer;flex:none;display:grid;place-items:center;font-size:18px}
.bcr2 .x{background:var(--card);color:#c4362b;box-shadow:0 1px 2px rgba(0,0,0,.12)}.bcr2 .ok{background:linear-gradient(135deg,#d9b25f,#a8832f);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.bcr2 .ok svg{width:22px;height:22px}html[dir="rtl"] .bcr2 .ok svg{transform:scaleX(-1)}
@keyframes bc-pulse{50%{opacity:.25;transform:scale(.8)}}
/* القايمة + المحادثة */
.bcw{display:grid;grid-template-columns:340px 1fr;height:calc(100dvh - 175px);min-height:460px;background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.06)}
.bcl{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0;background:var(--card)}
.bclh{display:flex;align-items:center;gap:10px;padding:14px 16px 4px;flex:none}
.bclh>div{flex:1;min-width:0}.bclh b{display:block;font-size:22px;font-weight:800}.bclh small{display:block;color:var(--mut);font-size:12.5px;margin-top:2px}
.bcs{padding:10px 14px 8px;flex:none}
.bcs input{width:100%;font:inherit;font-size:15px;border-radius:999px;border:0;background:var(--field,#f3f1ed);color:var(--ink);padding:10px 16px}
.bcs input:focus{outline:0;box-shadow:0 0 0 2px rgba(212,174,92,.55)}
.bcfl{display:flex;gap:6px;overflow-x:auto;margin-top:10px;scrollbar-width:none}.bcfl::-webkit-scrollbar{display:none}
.bcfl button{font:inherit;font-size:13px;font-weight:700;white-space:nowrap;border-radius:999px;border:0;background:var(--field,#f3f1ed);color:var(--mut);padding:6px 14px;cursor:pointer;transition:background .15s,color .15s}
.bcfl button.on{background:#1b1b1b;color:#e8cf8a}
.bcli{overflow-y:auto;flex:1;padding:2px 6px 8px}
.bcr{display:flex;gap:12px;align-items:center;width:100%;padding:9px 10px;border:0;border-radius:14px;background:none;text-align:start;font:inherit;color:var(--ink);cursor:pointer;transition:background .15s}
.bcr:hover{background:var(--soft,#f6f2e9)}.bcr.on{background:#f6ecd2}
.bcr .av{width:50px;height:50px}
.bcr .nm{flex:1;min-width:0}.bcr .nm b{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden}
.bcr .nm b bdi{overflow:hidden;text-overflow:ellipsis}
.bcr .nm b u{text-decoration:none;font-weight:600;font-size:11px;color:#8a6a22;background:#f6ecd2;border-radius:6px;padding:0 6px;flex:none}
.bcr .nm small{display:flex;align-items:center;gap:3px;color:var(--mut);font-size:13.5px;white-space:nowrap;overflow:hidden;margin-top:2px}
.bcr .nm small span{overflow:hidden;text-overflow:ellipsis}
.bcr .nm small .tk{width:16px;height:11px;flex:none;color:#8d8778}.bcr .nm small .tk.rd{color:#2a9df4}
.bcr.nw .nm small{color:var(--ink);font-weight:700}
.bcr .mt{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none;align-self:stretch;justify-content:center}.bcr .mt small{color:var(--mut);font-size:11.5px}
.bcr.nw .mt small{color:#a8832f;font-weight:800}
.bcr .mt i,.bcbd{font-style:normal;background:#a8832f;color:#fff;border-radius:999px;min-width:21px;padding:0 6px;font-size:12px;line-height:21px;text-align:center;font-weight:800}
.bcnone{margin:auto;text-align:center;color:var(--mut);font-size:15px;line-height:2;padding:30px}
.bcnone b{display:grid;place-items:center;width:84px;height:84px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,#f6ecd2,#ecd193);font-size:38px}
.bcw>.bcv.empty .bch,.bcw>.bcv.empty .bcq,.bcw>.bcv.empty .bcf,.bcw>.bcv.empty .bcr2,.bcw>.bcv.empty .bcrq,.bcw>.bcv.empty .bcdown{display:none}
.bcw>.bcv.empty .bcms{background:var(--soft,#f6f2e9)}
.bcback{display:none!important}
html[dir="ltr"] .bcback{transform:scaleX(-1)}
@media (max-width:760px){
 .bcw:not(.one){grid-template-columns:1fr;height:auto;min-height:0}.bcw:not(.one) .bcl{border:0}.bcw:not(.one) .bcli{overflow:visible}
 .bcw:not(.one)>.bcv{display:none}.bcw:not(.one).open>.bcv{display:flex;position:fixed;inset:0;z-index:60;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}
 .bcw .bcback{display:grid!important}
 .bcg{max-width:86%}
}
/* صفحة الفرع والسائق: نافذة فيها القايمة أو المحادثة (عمود واحد) */
.bcw.one{grid-template-columns:1fr;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none}
.bcw.one .bcl{border:0}.bcw.one>.bcv{display:none}.bcw.one.open>.bcv{display:flex}.bcw.one.open>.bcl{display:none}
.bcw.one .bcback{display:grid!important}
#bcfab{position:fixed;left:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#2b2416,#1b1b1b);color:#e8cf8a;border:2px solid #d4ae5c;box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;animation:ui-fade .3s ease both}
#bcfab svg{width:28px;height:28px}
#bcfab i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:22px;padding:0 6px;font-size:12.5px;line-height:22px;font-weight:800;border:2px solid #fff}
#bcfab.nw{animation:bc-ring 1.6s ease-in-out infinite}
@keyframes bc-ring{0%,100%{transform:rotate(0)}10%{transform:rotate(-12deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
#me #bcme{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:#1b1b1b;color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-start:auto}
#me #bcme i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#bcm{display:none;position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.55);padding:14px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#bcm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
#bcm .bcp{width:100%;max-width:580px;height:min(760px,calc(100dvh - 28px));border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.4);background:var(--card)}
@media (max-width:600px){#bcm{padding:0}#bcm .bcp{height:100dvh;max-width:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px)}}
.bcrqb{font:inherit;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}
@media (prefers-color-scheme:dark){
 .bcms{background-color:#0f0d0a;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23d4ae5c' stroke-opacity='.06' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3C/g%3E%3C/svg%3E")}
 .bcq,.bcf,.bcr2{background:#0f0d0a}
 .bcg.me{background:#5a4618;color:#f7ecd0}.bcg.me:not(.cont)::before{background:#5a4618}
 .bcg.ot{background:#24221e;color:#ece6d8}.bcg.ot:not(.cont)::before{background:#24221e}
 .bcg small{color:rgba(255,255,255,.5)}.bcg .tk{color:rgba(255,255,255,.5)}.bcg .tk.rd{color:#53bdeb}
 .bcg.ot>i{color:#e8cf8a}.bcg .rqt{background:rgba(255,255,255,.08)}
 .bcday,.bcmore{background:rgba(36,34,30,.95);color:#d8cfbd}.bcmt{background:rgba(36,34,30,.9)}
 .bcq button{background:#24221e;color:#e8cf8a;border-color:rgba(212,174,92,.3)}
 .bcvo span.bar{background:rgba(255,255,255,.25)}.bcvo span.bar b,.bcvo button{background:#d4ae5c}.bcg.ot .bcvo button,.bcg.ot .bcvo span.bar b{background:#ece6d8;color:#1b1b1b}
 .bcr.on{background:#2b2416}.bcr .nm b u{background:#2b2416;color:#e8cf8a}.bcrq span{color:#e8cf8a}
 .bcfl button.on{background:#d4ae5c;color:#1b1b1b}.bcnone b{background:linear-gradient(135deg,#3a3115,#5a4618)}
}
.tabs .tbn{background:#c0392b;color:#fff;border-radius:999px;padding:0 7px;font-size:12px;line-height:19px;display:inline-block;margin-inline-start:4px;font-weight:800}
@media print{#bcfab,#bcm,#bcme,.bcrqb{display:none!important}}
@media (prefers-reduced-motion:reduce){.bcg,#bcfab.nw{animation:none}}
`;
// ---------- مساعدات ----------
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayOf=t=>{const d=new Date(N(t)),n=new Date(),y=new Date(n.getTime()-864e5);return d.toDateString()===n.toDateString()?"اليوم":d.toDateString()===y.toDateString()?"أمس":d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"})};
// أيقونات (SVG) زي تطبيقات التواصل
const IC={
  send:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>`,
  mic:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.6a6 6 0 0 0 5-5.9z"/></svg>`,
  down:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
  chat:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.6 22l4.2-2.2c1 .3 2.1.4 3.2.4 5.5 0 10-3.9 10-8.6S17.5 3 12 3zm-4 10a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 8 13zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="22" height="22"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  lock:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="11" height="11"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z"/></svg>`
};
// علامة الإرسال: ✓ وصلت، ✓✓ زرقا = اتقرت
const tick=rd=>rd?`<svg class="tk rd" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6l3.2 3.2L11 2M7.5 9.2 8.3 10 16.8 1.5"/></svg>`:`<svg class="tk" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l3.2 3.2L14 2"/></svg>`;
// لون ثابت للصورة الرمزية حسب الاسم
const avc=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return "c"+(h%8)};
// الصورة الرمزية لأي طرف: صورته، أو أول حرف من اسمه، أو رقم الفرع، أو 🚚 للسائق
function avHtml(p,n,cls){const img=ph(p),t=p[0];if(img)return `<img class="av${cls||""}" src="${img}" alt="">`;
  const txt=t==="b"?E(pv(p)):t==="d"?"🚚":E([...String(n||"").replace(/^[^\p{L}\p{N}]+/u,"")][0]||"؟");
  return `<span class="av ${avc(p)}${t==="b"?" avb":t==="d"?" avd":""}${cls||""}">${txt}</span>`}
const when=t=>{if(!t)return "";const d=new Date(N(t)),n=new Date();return d.toDateString()===n.toDateString()?hm(t):Date.now()-N(t)<6*864e5?d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"short"}):d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})};
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
// الأطراف: b-كود الفرع / w-إيميل الشخص اللي في المستودع / d-رقم السائق. X.me = طرفي أنا
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
// لا يزال ماقريتش كام في المحادثة دي
function unreadOf(s){if(!s)return 0;
  if(s._old)return T()==="b"?(N(s.nb)||(N(s.lw)>N(s.rb)?1:0)):(N(s.nw)||(N(s.lb)>N(s.rw)?1:0));
  const i=s.ps.indexOf(X.me),o=1-i;return N(s["n"+i])||(N(s["l"+o])>N(s["r"+i])?1:0)}
// المستودع: كام محادثة بانتظار رد. الفرع والسائق: كام رسالة جديدة
export function unreadTotal(){if(!X)return 0;return Object.values(SUMS).reduce((a,s)=>a+(T()==="w"?(unreadOf(s)?1:0):unreadOf(s)),0)}
// زرار "كلّم ... عن الطلب ده" على كارت الطلب (cls = شكل الزرار في الصفحة)
export const rqBtn=(r,cls)=>X&&T()!=="d"?`<button class="${cls||"bcrqb"}" data-bcrq="${E(r.id)}" data-no="${E(r.no||"")}" data-br="${E(r.br||"")}" type="button" title="محادثة خاصة بخصوص هذا الطلب">💬 ${T()==="b"?"تواصل مع المستودع":"تواصل مع الفرع"}</button>`:"";
const modal=()=>T()!=="w";// الفرع والسائق: نافذة. المستودع: تبويب
const GRP={w:[["","الكل"],["b","الفروع"],["d","السائقين"],["w","الموظفين"]],b:[["","الكل"],["w","المستودع"],["d","السائقين"],["b","الفروع"]],d:[["","الكل"],["w","المستودع"],["b","الفروع"]]};
// ---------- المحادثة نفسها (مشتركة بين اللوحة والفرع والسائق) ----------
function convHtml(){
  return `<div class="bch"><button class="bcback" data-bcback type="button" aria-label="رجوع">→</button><span id="bcav"></span><div><b id="bct"></b><small id="bcsub"></small></div>${modal()?`<button data-bcclose type="button" aria-label="إغلاق">✕</button>`:""}</div>
  <div class="bcms" id="bcms"></div>
  <button class="bcdown" id="bcdown" data-bcdown type="button" aria-label="آخر رسالة" title="آخر رسالة" hidden>${IC.down}</button>
  <div class="bcrq" id="bcrq" hidden></div>
  <div class="bcq">${(QUICK[T()]||[]).map(q=>`<button data-bcq="${E(q)}" type="button">${E(q)}</button>`).join("")}</div>
  <div class="bcf" id="bcfoot"><textarea id="bcin" rows="1" maxlength="${LEN}" placeholder="اكتب رسالة..."></textarea><button class="mic" id="bcmic" type="button" title="رسالة صوتية" aria-label="رسالة صوتية">${IC.mic}</button><button id="bcsend" type="button" title="إرسال" aria-label="إرسال">${IC.send}</button></div>
  <div class="bcr2" id="bcrec" hidden><button class="x" data-bccancel type="button" title="إلغاء" aria-label="إلغاء">${IC.trash}</button><div class="pill"><span class="dot"></span><span class="tm" id="bcrt">0:00</span></div><button class="ok" data-bcstop type="button" title="إرسال" aria-label="إرسال">${IC.send}</button></div>`;
}
const emptyTxt=()=>`<div class="bcnone"><b>💬</b>اختر من القائمة لتبدأ محادثة<br><small>🔒 محادثاتك خاصة بك، لا يراها أحد غيرك</small></div>`;
function buildRoot(){
  const r=document.createElement("div");r.className="bcw"+(modal()?" one":"");
  r.innerHTML=`<aside class="bcl"><div class="bclh"><div><b>المحادثات</b><small id="bcpend">${modal()?"":"🔒 كل محادثة خاصة بين طرفيها فقط"}</small></div>${modal()?`<button data-bcclose type="button" aria-label="إغلاق">✕</button>`:""}</div><div class="bcs"><input id="bcqs" type="search" placeholder="🔎 ابحث عن اسم أو فرع" autocomplete="off"><div class="bcfl">${(GRP[T()]||[]).filter(([k])=>!(T()==="w"&&k==="b"&&!X.canBr)).map(([k,l])=>`<button type="button" data-bcf="${k}" class="${FILT===k?"on":""}">${E(l)}</button>`).join("")}</div></div><div class="bcli"></div></aside><section class="bcv empty">${convHtml()}</section>`;
  wire(r);
  r.addEventListener("scroll",e=>{const t=e.target;if(t.id==="bcms"){SCR={...SCR,t:t.scrollTop,end:t.scrollHeight-t.scrollTop-t.clientHeight<90};paintDown()}else if(t.classList&&t.classList.contains("bcli"))SCR.l=t.scrollTop},true);
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
    if(t.closest("[data-bcdown]")){const b=g("bcms");if(b)b.scrollTo({top:b.scrollHeight,behavior:"smooth"});return}
    if(t.closest("[data-bcmore]")){keepTop={h:g("bcms").scrollHeight,t:g("bcms").scrollTop};LIM+=PAGE;listen(GEN);return}
    if(t.closest("[data-bcback]")){if(ROOT)ROOT.classList.remove("open");setCode(null);paintList();return}
    if(t.closest("[data-bcclose]"))return void closeBr();
    const f=t.closest("[data-bcf]");if(f){FILT=f.dataset.bcf;el.querySelectorAll("[data-bcf]").forEach(b=>b.classList.toggle("on",b.dataset.bcf===FILT));paintList();return}
    const r=t.closest("[data-bcc]");if(r){setCode(cidFor(r.dataset.bcc));if(ROOT)ROOT.classList.add("open");paintList();if(!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},50)}
  });
  el.addEventListener("keydown",e=>{
    // الحاسوب: Enter يبعت و Shift+Enter سطر جديد. الجوال: Enter سطر جديد عادي
    if(e.target.id==="bcin"&&e.key==="Enter"&&!e.shiftKey&&!isMob()){e.preventDefault();sendText()}
  });
  el.addEventListener("input",e=>{if(e.target.id==="bcin"){grow();if(CUR)DRAFT[CUR]=e.target.value}if(e.target.id==="bcqs"){Q=e.target.value.trim().toLowerCase();paintList()}});
}
// خانة الكتابة بتكبر مع النص، والزرار بيتبدّل: 🎤 لما فاضية، وسهم الإرسال لما فيها كلام
function grow(){const t=g("bcin");if(!t)return;t.style.height="auto";t.style.height=Math.min(130,t.scrollHeight+2)+"px";const f=g("bcfoot");if(f)f.classList.toggle("has",!!t.value.trim())}
function paintDown(){const b=g("bcdown"),m=g("bcms");if(b&&m)b.hidden=!CUR||m.scrollHeight-m.scrollTop-m.clientHeight<200}
function paintHead(){
  if(!g("bct"))return;
  const av=g("bcav");if(av)av.innerHTML="";
  if(!CUR){g("bct").textContent="";g("bcsub").textContent="";return}
  const p=peerOf(CUR),k=pk(p),n=pname(p,CUR);
  g("bct").innerHTML=`<bdi${p[0]==="b"?' dir="ltr"':""}>${E(n)}</bdi>`;
  const kind=p[0]==="d"?"سائق":p[0]==="b"?"فرع":"";
  g("bcsub").innerHTML=`${k?E(k)+" · ":kind?E(kind)+" · ":""}${IC.lock} محادثة خاصة بينكما فقط`;
  if(av)av.innerHTML=avHtml(p,n," sm");
}
function paintCtx(){const b=g("bcrq");if(!b)return;const c=CUR&&CTX[CUR];b.hidden=!c;if(c)b.innerHTML=`<span>📦 بخصوص طلب <bdi dir="ltr">${E(c.no)}</bdi></span><button data-bcrqx type="button" aria-label="أزل">✕</button>`}
function paintPend(){const p=g("bcpend");if(p)p.innerHTML=PEND?`📦 بخصوص طلب <bdi dir="ltr">${E(PEND.no)}</bdi> — اختر من تريد محادثته`:"اختر من تريد محادثته · 🔒 كل محادثة خاصة"}
// كل تغيير في المحادثة المفتوحة: نقفل السماع القديم ونبدأ جديد. GEN بيتأكد إن أي رد متأخر من محادثة تانية يتجاهل (لا يوجد تداخل)
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
    // محادثة جديدة لا يزال مااتعملتش (لا يوجد ولا رسالة): مش غلط
    if(e&&e.code==="permission-denied"&&!SUMS[cid]){MSGS=[];paintMsgs();return}
    g("bcms").innerHTML=`<div class="bcmt">⚠️ تعذر تحميل الرسائل${e&&e.code==="permission-denied"?" (غير مسموح)":"، تأكد من الإنترنت"}</div>`});
}
// قُرئت إمتى: لو نفس يوم الإرسال الساعة بس، غير كده اليوم أيضاً
const rdAt=(rd,ts)=>new Date(N(rd)).toDateString()===new Date(N(ts)).toDateString()?hm(rd):when(rd)+" "+hm(rd);
function whoHtml(ap,m){
  if(ap[0]==="w"){const img=ph(ap),k=pk(ap),n=(DIR[pv(ap)]&&DIR[pv(ap)].n)||m.n||"المستودع";return `${img?`<img src="${img}" alt="">`:""}${E(n)}${k?` · ${E(k)}`:""}`}
  if(ap[0]==="b")return `${m.n?E(m.n)+" · ":""}فرع <bdi dir="ltr">${E(X.brn(pv(ap))||pv(ap))}</bdi>`;
  return `🚚 ${E(m.n||pname(ap))}`;
}
function paintMsgs(){
  const box=g("bcms");if(!box||!CUR)return;
  const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<90,firstPaint=!box.querySelector(".bcg,.bcmt.ok");
  let h=MSGS.length>=LIM?`<button class="bcmore" data-bcmore type="button">⬆ رسائل أقدم</button>`:"",d="",prev=null;
  const lastMe=[...MSGS].reverse().find(m=>mine(CUR,m.by));
  if(!MSGS.length)h+=`<div class="bcmt ok"><b>👋</b>لا توجد رسائل بعد.<br>اكتب لـ ${E(pname(peerOf(CUR),CUR))} أي شيء، أو اضغط 🎤 وسجّل رسالة صوتية.<br><small>🔒 الرسائل هنا لا يراها أحد غيركم</small></div>`;
  MSGS.forEach(m=>{const dd=dayOf(m.ts);if(dd!==d){d=dd;prev=null;h+=`<div class="bcday">${E(dd)}</div>`}
    const me=mine(CUR,m.by);
    // رسايل ورا بعض من نفس الشخص خلال 5 دقايق = مجموعة واحدة (من غير اسم ولا ذيل)، زي تطبيقات التواصل
    const cont=!!prev&&prev.by===m.by&&String(prev.n||"")===String(m.n||"")&&N(m.ts)-N(prev.ts)<5*6e4&&!(m.rq&&m.rq.no);prev=m;
    // gone: السيرفر مسح الصوت بعد 30 يوم (علشان مساحة Firebase المجانية)
    const body=m.v&&m.gone?`<div class="bcgone">🎤 رسالة صوتية (${mmss(m.d)}) · حُذفت تلقائياً بعد 30 يوماً</div>`:m.v?`<div class="bcvo"><button data-play="${E(m.id)}" type="button" aria-label="تشغيل">${PLAY.id===m.id?"⏸":"▶"}</button><span class="bar"><b id="bcpb-${E(m.id)}"></b></span><span class="du">${mmss(m.d)}</span></div>`:QALL.has(m.t)?`<span class="bx">${E(m.t)}</span>`:`<span class="bx" data-notr>${E(m.t||"")}</span>`;
    const rq=m.rq&&m.rq.no?`<span class="rqt">📦 بخصوص طلب <bdi dir="ltr">${E(m.rq.no)}</bdi></span>`:"";
    // اسم اللي كتب (للطرف التاني بس، وأول المجموعة) + الوقت + علامة القراءة لرسايلي (والوقت بالظبط لما تقف عليها)
    const who=!me&&!cont?`<i>${whoHtml(byParty(CUR,m.by),m)}</i>`:"";
    const rdT=me?(m.rd?`قُرئت ${rdAt(m.rd,m.ts)}`:"لم تُقرأ بعد"):"";
    h+=`<div class="bcg ${me?"me":"ot"}${cont?" cont":""}">${who}${rq}${body}<small${rdT?` title="${E(rdT)}"`:""}>${hm(m.ts)}${me?tick(m.rd):""}</small></div>`;
    // تحت آخر رسالة ليا: "قُرئت الساعة كام" (زي "Seen" في تطبيقات التواصل)
    if(m===lastMe&&m===MSGS[MSGS.length-1])h+=`<div class="bcseen">${m.rd?`${tick(1)} قُرئت ${rdAt(m.rd,m.ts)}`:`${tick(0)} لم تُقرأ بعد`}</div>`});
  box.innerHTML=h;
  if(keepTop){box.scrollTop=box.scrollHeight-keepTop.h+keepTop.t;keepTop=null}
  else if(atEnd||firstPaint)box.scrollTop=box.scrollHeight;
  paintDown();
}
// "قُرئت": لما المحادثة مفتوحة قدامه فعلاً. بنسجّل وقت القراية على كل رسالة من الطرف المجدداً (rd) + نصفّر العدّاد
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
    // النت بطيء: الرسالة محفوظة على الجهاز وهتتبعت لوحدها (ما نبعتهاش مجدداً علشان ما تتكررش)
    if(w==="slow"){onOk&&onOk();X.toast("⏳ الإنترنت بطيء: سترسل الرسالة تلقائياً فور تحسّن الاتصال");X.ping(cid)}
    else{const p=peerOf(cid),gone=(p[0]==="w"&&!DIR[pv(p)])||(p[0]==="d"&&!DDIR[pv(p)]);
      X.toast(w==="denied"?(gone?"هذا الشخص لم يعد موجوداً. اختر شخصاً آخر":"غير مسموح لك بالإرسال في هذه المحادثة (ربما لم تتحدّث القواعد بعد)"):FAIL_MSG[w]||"تعذر الإرسال",true)}
  }
  busy=false;if(g("bcsend"))g("bcsend").disabled=false;
}
function sendText(){
  const i=g("bcin");if(!i||!CUR||busy)return;
  const t=i.value.trim().slice(0,LEN),cid=CUR;if(!t)return;
  deliver(cid,{t},null,()=>{DRAFT[cid]="";if(CUR===cid){i.value="";grow()}});
}

// ---------- الرسائل الصوتية ----------
function paintRec(){
  const r=g("bcrec"),f=g("bcfoot"),q=ROOT&&ROOT.querySelector(".bcq");if(!r)return;
  r.hidden=!REC;f.hidden=!!REC;if(q)q.hidden=!!REC;
  if(REC)g("bcrt").innerHTML=`${mmss((Date.now()-REC.t0)/1000)} <small>/ ${mmss(MAXS)} · يسجّل…</small>`;
}
async function startRec(){
  if(!CUR||REC||busy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)return void X.toast("هذا المتصفح لا يدعم تسجيل الصوت. جرّب Chrome أو حدّث المتصفح.",true);
  const cid=CUR,my=GEN;let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){return void X.toast(e&&(e.name==="NotAllowedError"||e.name==="SecurityError")?(isMob()?"اسمح للمنصة باستخدام الميكروفون: من إعدادات الموقع أو التطبيق ← الميكروفون ← سماح":"اسمح للمنصة باستخدام الميكروفون: علامة القفل 🔒 بجانب الرابط ← الميكروفون ← سماح"):"لا يوجد ميكروفون يعمل على هذا الجهاز",true)}
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
  if(N(r.dur)<1)return void X.toast("الرسالة قصيرة جداً. اضغط 🎤 وتحدّث، ثم اضغط إرسال");
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
    if(!/^data:audio\//.test(a)){stopPlay();return void X.toast(none?"حُذفت هذه الرسالة الصوتية (أقدم من 30 يوماً)":"تعذر تحميل الرسالة الصوتية",true)}
    AUD.set(key,a);if(AUD.size>40)AUD.delete(AUD.keys().next().value);
  }
  au.src=a;
  au.ontimeupdate=()=>{const bar=g("bcpb-"+id);if(bar&&au.duration&&isFinite(au.duration))bar.style.width=Math.min(100,au.currentTime/au.duration*100)+"%"};
  au.onended=()=>{if(PLAY.au===au)stopPlay()};
  au.onerror=()=>{if(PLAY.au===au){stopPlay();X.toast("هذا الجهاز غير قادر على تشغيل هذه الرسالة الصوتية",true)}};
  try{await au.play();const b=btn();if(b&&PLAY.au===au)b.textContent="⏸"}catch(e){if(PLAY.au===au){stopPlay();X.toast("اضغط ▶ مجدداً لتسمع الرسالة")}}
}
// ---------- القايمة: كل اللي أقدر أكلّمهم ----------
// المستودع: الفروع (لو معاه الطلبات أو مدير) + السائقين + الموظفين. الفرع: المستودع (اللي بيرد على الفروع بس) + السائقين + الفروع.
// السائق: المستودع + الفروع. (سائق مع سائق ممنوع)
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
    const role=t==="w"?(d?d.k||"":"لم يعد في المستودع"):t==="d"?(DDIR[pv(p)]?"سائق":"لم يعد موجوداً"):"";
    return {p,cid,s,u:unreadOf(s),n,img:ph(p),av:t==="b"?E(pv(p)):t==="d"?"🚚":E([...n][0]||"؟"),cls:t==="b"?"":" p",role,o:t==="w"?(d?ROLE_O[d.r]??3:9):t==="d"?4:5};
  }).filter(x=>!Q||x.n.toLowerCase().includes(Q)||x.p.toLowerCase().includes(Q))
    .sort((a,b)=>(b.u>0)-(a.u>0)||N(b.s&&b.s.last&&b.s.last.ts)-N(a.s&&a.s.last&&a.s.last.ts)||a.o-b.o||a.n.localeCompare(b.n));
  box.innerHTML=rows.map(x=>{const l=x.s&&x.s.last,my=l&&mine(x.cid,l.by);
    // آخر رسالة: لو مني بعلامة ✓/✓✓ (اتقرت لو الطرف التاني فتح بعدها)
    const seen=my&&x.s?(x.s._old?(T()==="b"?N(x.s.rw)>=N(l.ts):N(x.s.rb)>=N(l.ts)):N(x.s["r"+(1-x.s.ps.indexOf(X.me))])>=N(l.ts)):false;
    const pvw=l?`${my?tick(seen):""}${l.v?"🎤 ":""}<span data-notr>${E(l.v?String(l.t).replace(/^🎤\s*/,""):l.t)}</span>`:`<span>${E("ابدأ محادثة")}</span>`;
    return `<button class="bcr${x.cid===CUR?" on":""}${x.u?" nw":""}" data-bcc="${E(x.p)}" type="button">${avHtml(x.p,x.n)}<span class="nm"><b><bdi${x.p[0]==="b"?' dir="ltr"':""}>${E(x.n)}</bdi>${x.role?`<u>${E(x.role)}</u>`:""}</b><small>${pvw}</small></span><span class="mt"><small>${l?when(l.ts):""}</small>${x.u?`<i>${x.u}</i>`:""}</span></button>`}).join("")
    ||`<div class="bcnone"><b>🔎</b>${Q?"لا توجد نتائج بهذا الاسم":"لا يوجد أحد هنا بعد"}</div>`;
}
// الصفحة بتعيد رسم نفسها كتير، فالدردشة عنصر ثابت بنحطّه في مكانه كل مرة (الكتابة والتسجيل مايضيعوش)
export function mountWh(host){
  if(!X||!host||modal())return;
  if(!ROOT)ROOT=buildRoot();
  // نقل العنصر بيصفّر مكان السكرول، فبنرجّعه زي ما كان
  host.appendChild(ROOT);paintList();
  const ms=ROOT.querySelector("#bcms"),li=ROOT.querySelector(".bcli");ms.scrollTop=SCR.end?ms.scrollHeight:SCR.t;li.scrollTop=SCR.l;
  if(CUR){paintHead();markRead()}
}
// خرجنا من تبويب الدردشة: نقفل المحادثة المفتوحة (توفير قراءات + وقف أي تسجيل)
export function hideWh(){if(CUR&&X&&!modal()){setCode(null);if(ROOT)ROOT.classList.remove("open")}}
// المستودع: يفتح محادثة مع طرف (rq = بخصوص طلب)
export function openPeer(p,rq){
  if(!X||!/^[bdw]-./.test(String(p||""))||p===X.me)return;
  if(modal())return void openBr(p,rq);
  if(!ROOT)ROOT=buildRoot();
  const cid=cidFor(p);if(rq)CTX[cid]=rq;setCode(cid);paintCtx();ROOT.classList.add("open");paintList();
}
export function openWh(code,rq){if(/^\d{3}$/.test(String(code||"")))openPeer("b-"+code,rq)}
// ---------- الفرع والسائق: زرار عائم + نافذة ----------
function paintFab(){
  if(!X||!modal())return;const n=unreadTotal();
  const f=g("bcfab");if(f){f.innerHTML=`${IC.chat}${n?`<i>${n}</i>`:""}`;f.classList.toggle("nw",!!n);f.title=n?`${n} رسالة جديدة`:"المحادثات"}
  const m=g("bcme");if(m)m.innerHTML=`💬 ${T()==="b"?"المحادثات":"الرسائل"}${n?` <i>${n}</i>`:""}`;
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
// ctx = {db, party:"b-003"|"w-email"|"d-drv1", name:()=>اسم الكاتب, myLabel?:()=>اسمي في القايمة عند المجدداً, brn:code=>اسم الفرع,
//        codes:[قائمة الفروع], canBr (المستودع: يقدر يكلّم الفروع؟), toast, beep, notify, ping:cid=>..., visible:()=>المحادثة قدامه؟,
//        onBadge(n), show:()=>يفتح تبويب الدردشة (المستودع)}
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
  // أسماء وكنيات وصور اللي في المستودع، وأسماء السائقين
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

// ---------- مسح الدردشة القديم المشترك (مرة واحدة، من جهاز المالك) ----------
// الدردشة قبل كده كان مشترك (chats/{code} و msgs جوه كل طلب)، فبنمسحه كله علشان محدش يشوف رسايل حد مجدداً.
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
