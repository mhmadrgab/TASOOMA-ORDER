// 📣 الحملات التسويقية (v246، 26 نوفمبر 2026، طلب محمد: «مديول ذكي يدير حملات الشركة التسويقية»):
//   مدير التسويق (p.gm، والأدمن ومالك النظام) ينشئ الحملة: الهدف، القنوات، المدة، الميزانية، الأهداف بالأرقام، وفريق الحملة.
//   ويوزّع المهام حسب الدور (تصوير، محتوى، مؤثرون، تصاريح، تحديث أسعار، إعلانات ممولة) بمواعيدها وقوائمها الفرعية.
//   موظف المؤثرين (أي عضو في فريق الحملة أو فريق التسويق p.mk) يسجّل الاتفاق والآيبان ← مدير التسويق يعتمد ← المالية (p.mf) تسجّل التحويل بمرجعه.
//   المصروف = الاتفاقات المعتمدة + المصروفات الأخرى، مقابل الميزانية والوقت، والنتائج مقابل الأهداف، وقراءة ذكية وتقرير مطبوع.
//   mkc/{id} الحملة · mkt/{id} مهمة · mkd/{id} اتفاق مؤثر · mkdi/{id} الآيبان (منفصل، لمدير التسويق والمالية ومن سجّله) · mkx/{id} مصروف.
//   القواعد mk_read / mk_write في 002_rules.sql (v246)، والإشعارات onMkTask / onMkDeal في السيرفر.
import {collection,doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,onSnapshot,query,where,withTimeout} from "./fb.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number.isFinite(+v)?+v:0;
const g=id=>document.getElementById(id);
const money=v=>Math.round(N(v)).toLocaleString("en-US");
const big=v=>{v=N(v);return v>=1e6?(Math.round(v/1e5)/10)+"M":v>=1e4?(Math.round(v/100)/10)+"K":Math.round(v).toLocaleString("en-US")};
const pct=(a,b)=>b>0?Math.round(a/b*100):0;
const ymd=d=>{const z=n=>(n<10?"0":"")+n;return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())};
const today=()=>ymd(new Date());
const dmy=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?m[3]+"/"+m[2]+"/"+m[1]:""};
const dm=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?m[3]+"/"+m[2]:""};
const dOf=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?new Date(+m[1],+m[2]-1,+m[3]):null};
const days=(a,b)=>{const x=dOf(a),y=dOf(b);return x&&y?Math.round((y-x)/864e5):0};
const addD=(s,k)=>{const d=dOf(s)||new Date();d.setDate(d.getDate()+k);return ymd(d)};
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const num=s=>{const t=String(s==null?"":s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫]/g,".").replace(/[,\s،]/g,"");if(t==="")return 0;return /^\d+(\.\d+)?$/.test(t)?+t:NaN};
export const CH=[["ig","إنستغرام"],["tt","تيك توك"],["sc","سناب شات"],["x","إكس"],["yt","يوتيوب"],["wa","واتساب"],["web","الموقع الإلكتروني"],["st","الفروع"],["oth","أخرى"]];
const PF=[["ig","إنستغرام"],["tt","تيك توك"],["sc","سناب شات"],["x","إكس"],["yt","يوتيوب"],["oth","أخرى"]];
const KP=[["reach","الوصول (أشخاص)"],["views","المشاهدات"],["eng","التفاعلات"],["fol","متابعون جدد"],["vis","زيارات الموقع"],["ord","عدد الطلبات"],["rev","المبيعات (ريال)"],["oth","هدف آخر"]];
const RL=[["ph","📷","التصوير"],["ct","✍","المحتوى والتصميم"],["inf","🤝","المؤثرون"],["prm","📜","التصاريح"],["prc","🏷","تحديث الأسعار"],["ad","📢","الإعلانات الممولة"],["oth","📌","أخرى"]];
const XK=[["inf","المؤثرون","#8a5a83"],["ads","إعلانات ممولة","#3d7cc9"],["ph","التصوير","#d08a2c"],["prod","إنتاج وتصميم","#3a9488"],["prm","تصاريح ورسوم","#b4553e"],["evt","فعاليات","#6f7d45"],["gift","هدايا وعينات","#c06c95"],["oth","أخرى","#8e8e93"]];
const CST={plan:"مخطط لها",live:"جارية",done:"منتهية",x:"ملغاة"};
const DST={pend:"بانتظار الاعتماد",ok:"معتمد · بانتظار التحويل",no:"مرفوض",paid:"تم التحويل",x:"ملغى"};
const TST={todo:"لم تبدأ",doing:"جارية",done:"منتهية"};
const CLR=["#8a5a83","#3d7cc9","#d08a2c","#3a9488","#b4553e","#6f7d45","#c06c95","#5e5ce6"];
const TPL=[["ph","تصوير المنتجات",-7],["ct","كتابة المحتوى والنصوص",-5],["ct","تصميم الإعلانات والبوسترات",-4],["inf","الاتفاق مع المؤثرين",-6],["prm","استخراج تصريح الإعلان",-10],["prc","تحديث الأسعار في السيستم",-1],["prc","تحديث الأسعار في الموقع الإلكتروني",-1],["ad","إطلاق الإعلانات الممولة",0]];
const lab=(L,k)=>(L.find(x=>x[0]===k)||[k,k])[1];
const rl=k=>RL.find(x=>x[0]===k)||RL[6];
// 🏦 الآيبان: التحقق الدولي (mod 97) + الإخفاء
export function ibanNorm(s){return String(s||"").toUpperCase().replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^A-Z0-9]/g,"")}
export function ibanOk(s){
 const v=ibanNorm(s);if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v))return false;if(v.slice(0,2)==="SA"&&v.length!==24)return false;
 const r=v.slice(4)+v.slice(0,4);let m=0;for(let i=0;i<r.length;i++){const c=r.charCodeAt(i),d=c>=65?String(c-55):r[i];for(let j=0;j<d.length;j++)m=(m*10+(+d[j]))%97}return m===1;
}
const ibanFmt=s=>ibanNorm(s).replace(/(.{4})/g,"$1 ").trim();
const ibanMask=s=>{const v=ibanNorm(s);return v.length>8?v.slice(0,4)+" •••• •••• "+v.slice(-4):v};
let X=null,C=new Map(),T=new Map(),D=new Map(),XS=new Map(),WD=new Map(),UN=[],ON=false,BUSY=false,S={c:"",sub:"ov",f:"act",vw:"cards"},PENDOPEN="",LOADED=false,IBC=new Map();
const CSS=`
.mkp{display:block;--mk-ok:#4c6b2a;--mk-w:#b36b1e;--mk-r:#b03a2e;--mk-soft:rgba(138,90,131,.08)}
.mkp-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}.mkp-h h2{margin:0;flex:1;min-width:0}
.mkp .b.p,#mkm .b.p{background:var(--acc,#8a5a83);color:#fff;border-color:transparent}.mkp .b.p:hover,#mkm .b.p:hover{filter:brightness(1.08)}.mkp .b.mok,#mkm .b.mok{background:var(--olive,#6f7d45);color:#fff;border-color:transparent;width:auto}.mkp .b.on{background:var(--acc,#8a5a83);color:#fff;border-color:transparent}
.mkp-tl{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 14px}
.mkp-tl>div,.mkp-tl>button{all:unset;box-sizing:border-box;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:block}
.mkp-tl>button{cursor:pointer}.mkp-tl>button:hover,.mkp-tl>button:focus-visible{border-color:var(--acc,#8a5a83)}
.mkp-tl small{display:block;color:var(--mut);font-size:12.5px}.mkp-tl b{display:block;font-size:22px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}
.mkp-tl em{display:block;font-style:normal;font-size:12px;color:var(--mut);margin-top:2px}.mkp-tl .w b{color:var(--mk-w)}.mkp-tl .r b{color:var(--mk-r)}.mkp-tl .k b{color:var(--mk-ok)}
.mkp-act{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 14px}
.mkp-act h3{margin:0 0 8px;font-size:15px}.mkp-ai{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 0;border-top:1px dashed var(--line)}.mkp-ai:first-of-type{border-top:0}
.mkp-ai .t{flex:1;min-width:180px}.mkp-ai .t b{display:block}.mkp-ai .t small{color:var(--mut);font-size:12.5px}
.mkp-ai .bt2{display:flex;gap:6px;flex-wrap:wrap}.mkp .sm{padding:5px 11px;font-size:12.5px;min-height:0}
.mkp-fl{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.mkp-fl .sp{flex:1}
.mkp-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.mkp-cd{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;position:relative;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.mkp-cd:hover,.mkp-cd:focus-visible{border-color:var(--acc,#8a5a83);box-shadow:0 6px 20px rgba(42,29,44,.08)}
.mkp-cd::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:var(--cc,#8a5a83)}
.mkp-cd .top{display:flex;gap:12px;align-items:flex-start}.mkp-cd .nm{flex:1;min-width:0}.mkp-cd .nm b{display:block;font-size:16px;line-height:1.35}
.mkp-cd .nm small{display:block;color:var(--mut);font-size:12.5px;margin-top:3px}
.mkp-st{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.mkp-st.plan{background:#ece4f0;color:#5d3a59}.mkp-st.live{background:#e3efd6;color:#3f5a20}.mkp-st.done{background:#e3ecf7;color:#1d4f86}.mkp-st.x{background:#eee;color:#666}
.mkp-st.pend{background:#fff1dc;color:#8a5212}.mkp-st.ok{background:#e3ecf7;color:#1d4f86}.mkp-st.no{background:#fde2df;color:#8a2218}.mkp-st.paid{background:#e3efd6;color:#3f5a20}
.mkp-st.todo{background:#eee;color:#555}.mkp-st.doing{background:#fff1dc;color:#8a5212}
.mkp-ch{display:flex;gap:4px;flex-wrap:wrap}.mkp-ch span{font-size:11.5px;padding:1px 8px;border-radius:999px;background:var(--mk-soft);color:var(--ink)}
.mkp-bar{height:7px;border-radius:99px;background:rgba(0,0,0,.07);overflow:hidden;position:relative}.mkp-bar i{display:block;height:100%;border-radius:99px;background:var(--acc,#8a5a83);transition:width .6s cubic-bezier(.16,1,.3,1)}
.mkp-bar.t i{background:#9aa0a6}.mkp-bar.k i{background:var(--mk-ok)}.mkp-bar.w i{background:var(--mk-w)}.mkp-bar.r i{background:var(--mk-r)}
.mkp-mt{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;font-size:12.5px;color:var(--mut)}.mkp-mt b{color:var(--ink);font-variant-numeric:tabular-nums}
.mkp-ring{position:relative;flex:0 0 auto}.mkp-ring svg{display:block;transform:rotate(-90deg)}.mkp-ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.1}
.mkp-ring .c b{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}.mkp-ring .c small{font-size:10.5px;color:var(--mut)}
.mkp-ring circle{transition:stroke-dasharray .7s cubic-bezier(.16,1,.3,1)}
.mkp-ft{display:flex;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--mut)}.mkp-ft span{display:inline-flex;gap:4px;align-items:center}.mkp-ft .bad{color:var(--mk-r);font-weight:700}.mkp-ft .warn{color:var(--mk-w);font-weight:700}
.mkp-e{margin:14px 0;padding:26px 14px;border:1px dashed var(--line);border-radius:16px;text-align:center;color:var(--mut)}
.mkp-e b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
/* الجدول الزمني */
.mkp-tm{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;overflow-x:auto}
.mkp-tm .ax{position:relative;height:22px;margin-inline-start:150px;border-bottom:1px solid var(--line);font-size:11.5px;color:var(--mut);min-width:420px}
.mkp-tm .ax span{position:absolute;top:2px;transform:translateX(50%)}
.mkp-tm .rw{display:flex;align-items:center;min-height:38px;border-bottom:1px dashed var(--line);min-width:570px}
.mkp-tm .rn{width:150px;flex:0 0 150px;font-size:13px;padding-inline-end:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkp-tm .tr{position:relative;flex:1;height:38px}.mkp-tm .bx{all:unset;cursor:pointer;position:absolute;top:8px;height:22px;border-radius:8px;background:var(--cc,#8a5a83);color:#fff;font-size:11.5px;display:flex;align-items:center;padding:0 8px;box-sizing:border-box;overflow:hidden;white-space:nowrap;min-width:6px}
.mkp-tm .bx.x{opacity:.4}.mkp-tm .now{position:absolute;top:0;bottom:0;width:2px;background:var(--mk-r);opacity:.7;z-index:1}
/* تفاصيل الحملة */
.mkp-dh{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 12px;position:relative;overflow:hidden}
.mkp-dh::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:6px;background:var(--cc,#8a5a83)}
.mkp-dh .r1{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.mkp-dh h2{margin:0;flex:1;min-width:0;font-size:20px}
.mkp-dh p{margin:8px 0 0;color:var(--mut);font-size:13.5px;line-height:1.7}.mkp-dh .r2{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.mkp-sb{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 12px;border-bottom:1px solid var(--line)}
.mkp-sb button{all:unset;cursor:pointer;padding:9px 12px;font-size:14px;border-bottom:3px solid transparent;color:var(--mut)}.mkp-sb button.on{color:var(--ink);font-weight:800;border-bottom-color:var(--acc,#8a5a83)}
.mkp-sb button:focus-visible{outline:2px solid var(--acc,#8a5a83);border-radius:6px}.mkp-sb i{font-style:normal;font-size:11.5px;background:var(--mk-soft);border-radius:99px;padding:0 7px;margin-inline-start:4px}
.mkp-2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px}
.mkp-bx{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin:0 0 12px}.mkp-bx h3{margin:0 0 10px;font-size:15px}
.mkp-bud{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.mkp-lg{flex:1;min-width:170px;display:grid;gap:6px;font-size:13px}
.mkp-lg div{display:flex;align-items:center;gap:8px}.mkp-lg i{width:10px;height:10px;border-radius:3px;flex:0 0 10px}.mkp-lg span{flex:1}.mkp-lg b{font-variant-numeric:tabular-nums}
.mkp-pace{margin-top:12px;display:grid;gap:6px;font-size:12.5px;color:var(--mut)}.mkp-pace div{display:grid;grid-template-columns:90px 1fr 48px;gap:8px;align-items:center}.mkp-pace b{color:var(--ink);text-align:end;font-variant-numeric:tabular-nums}
.mkp-kp{display:grid;gap:10px}.mkp-kp .k{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;font-size:13.5px}.mkp-kp .k .mkp-bar{grid-column:1/-1;height:9px}
.mkp-kp small{color:var(--mut);font-size:12px;grid-column:1/-1}.mkp-kp b{font-variant-numeric:tabular-nums}
.mkp-ins{display:grid;gap:8px}.mkp-ins div{padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.6;background:var(--mk-soft)}
.mkp-ins .ok{background:#eef4e4;color:#3f5a20}.mkp-ins .warn{background:#fff3e0;color:#7a4510}.mkp-ins .bad{background:#fdeceb;color:#8a2218}
.mkp-team{display:flex;flex-wrap:wrap;gap:8px}.mkp-team span{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:99px;background:var(--mk-soft);font-size:12.5px}
.mkp-av{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11.5px;font-weight:800;flex:0 0 24px}
.mkp-tk{display:grid;gap:12px}.mkp-rg h4{margin:0 0 6px;font-size:14px;display:flex;gap:6px;align-items:center}.mkp-rg h4 small{color:var(--mut);font-weight:400}
.mkp-tr{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-bottom:6px}
.mkp-tr.dn{opacity:.62}.mkp-tr.dn .tt b{text-decoration:line-through}.mkp-tr .tt{flex:1;min-width:170px}.mkp-tr .tt b{display:block;font-size:14px}.mkp-tr .tt small{display:block;color:var(--mut);font-size:12px;margin-top:2px}
.mkp-tr .od{color:var(--mk-r);font-weight:700}.mkp-tr .cl{display:flex;flex-direction:column;gap:3px;width:100%;margin-top:4px;font-size:13px}.mkp-tr .cl label{display:flex;gap:6px;align-items:center;cursor:pointer}
.mkp-tb{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--card);border-radius:14px;overflow:hidden}
.mkp-tb th{text-align:start;font-size:12px;color:var(--mut);font-weight:600;padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}.mkp-tb td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.mkp-tb td.n{direction:ltr;text-align:right;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}.mkp-tb small{display:block;color:var(--mut);font-size:12px}
.mkp-pp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}.mkp-pp div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 12px}
.mkp-pp small{display:block;color:var(--mut);font-size:12px}.mkp-pp b{font-size:18px;font-variant-numeric:tabular-nums}
.mkp-ib{font-family:ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:isolate;letter-spacing:.5px}
.mkp-note{font-size:12.5px;color:var(--mut);margin:10px 0 0;line-height:1.7}
#mkm{position:fixed;inset:0;z-index:79;display:none;align-items:center;justify-content:center;background:rgba(20,12,20,.5);padding:16px}
#mkm.on{display:flex}#mkm>div{background:var(--card);color:var(--ink);border-radius:18px;padding:18px;width:min(600px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);box-sizing:border-box}
#mkm h3{margin:0 0 4px}#mkm .sub{color:var(--mut);font-size:13px;margin:0 0 10px}
#mkm label.l{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}#mkm input:not([type=checkbox]),#mkm select,#mkm textarea{width:100%;box-sizing:border-box}
#mkm .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}#mkm .g2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}#mkm .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 10px}
#mkm .chs{display:flex;flex-wrap:wrap;gap:6px}#mkm .chs label{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--line);border-radius:99px;font-size:13px;cursor:pointer;color:var(--ink)}
#mkm .chs label:has(input:checked){border-color:var(--acc,#8a5a83);background:var(--mk-soft,rgba(138,90,131,.08))}
#mkm .kr{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;gap:6px;margin-bottom:6px;align-items:center}#mkm .kr button{padding:6px 10px;min-height:0}
#mkm .ppl{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px}#mkm .ppl label{display:flex;gap:8px;align-items:center;padding:6px;border-radius:8px;cursor:pointer;font-size:13.5px;color:var(--ink)}
#mkm .ppl label:hover{background:rgba(138,90,131,.06)}#mkm .ppl small{color:var(--mut)}
#mkm .ibh{font-size:12.5px;margin-top:4px;min-height:18px}#mkm .ibh.ok{color:#3f5a20}#mkm .ibh.bad{color:#8a2218}
#mkm .pay{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:8px 0}#mkm .pay div{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line);font-size:14px;align-items:center}#mkm .pay div:last-child{border-bottom:0}
#mkm .pay b{font-variant-numeric:tabular-nums}#mkm .tpl{display:grid;grid-template-columns:auto minmax(0,1.4fr) minmax(0,1fr) minmax(0,.8fr);gap:6px;align-items:center;margin-bottom:6px;font-size:13px}
#mkm .err{color:#8a2218;font-size:13px;margin-top:8px;min-height:18px}
[data-theme=dark] .mkp{--mk-soft:rgba(180,138,171,.12);--mk-ok:#a4b46e;--mk-w:#e0a05a;--mk-r:#f08a7e}
[data-theme=dark] .mkp-st.plan{background:#3a2a3a;color:#e5cfe0}[data-theme=dark] .mkp-st.live,[data-theme=dark] .mkp-st.paid{background:#2c3a1f;color:#cfe0b6}
[data-theme=dark] .mkp-st.done,[data-theme=dark] .mkp-st.ok{background:#1f3047;color:#b9d2f0}[data-theme=dark] .mkp-st.x,[data-theme=dark] .mkp-st.todo{background:#333;color:#ccc}
[data-theme=dark] .mkp-st.pend,[data-theme=dark] .mkp-st.doing{background:#4a3519;color:#f2d1a0}[data-theme=dark] .mkp-st.no{background:#4a2420;color:#f4b5ad}
[data-theme=dark] .mkp-ins .ok{background:#26301b;color:#cfe0b6}[data-theme=dark] .mkp-ins .warn{background:#3a2c18;color:#f2d9b0}[data-theme=dark] .mkp-ins .bad{background:#3a1f1d;color:#f4b5ad}
[data-theme=dark] .mkp-bar{background:rgba(255,255,255,.1)}[data-theme=dark] #mkm .ibh.ok{color:#cfe0b6}[data-theme=dark] #mkm .ibh.bad,[data-theme=dark] #mkm .err{color:#f4b5ad}
@media (max-width:980px){.mkp-tl{grid-template-columns:repeat(3,minmax(0,1fr))}.mkp-2{grid-template-columns:1fr}}
@media (max-width:620px){.mkp-tl{grid-template-columns:1fr 1fr}.mkp-pp{grid-template-columns:1fr 1fr}.mkp-g{grid-template-columns:1fr}#mkm .g2,#mkm .g3{grid-template-columns:1fr}
 .mkp-tb thead{display:none}.mkp-tb,.mkp-tb tbody,.mkp-tb tr,.mkp-tb td{display:block;width:100%;box-sizing:border-box}.mkp-tb tr{border-bottom:1px solid var(--line);padding:8px 4px}.mkp-tb td{border:0;padding:3px 8px}
 .mkp-tb td.n{text-align:start}.mkp-tb td[data-l]::before{content:attr(data-l) ": ";color:var(--mut);font-weight:400;font-size:12px}
 #mkm .tpl{grid-template-columns:auto 1fr}#mkm .tpl select,#mkm .tpl input[type=date]{grid-column:2}.mkp-tm .rn{width:96px;flex-basis:96px}.mkp-tm .ax{margin-inline-start:96px}}
body.mkpr>*:not(#mkpr){display:none!important}#mkpr{display:none}body.mkpr #mkpr{display:block}
@media print{#mkpr{font-size:12.5px;color:#111}#mkpr h1{font-size:20px;margin:0 0 4px}#mkpr h2{font-size:15px;margin:16px 0 6px;border-bottom:2px solid #8a5a83;padding-bottom:3px}
 #mkpr table{width:100%;border-collapse:collapse}#mkpr th,#mkpr td{border:1px solid #ccc;padding:5px 6px;text-align:start}#mkpr th{background:#f3ecf2}#mkpr .kv{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
 #mkpr .kv div{border:1px solid #ccc;border-radius:8px;padding:6px 8px}#mkpr .kv small{display:block;color:#555}#mkpr .kv b{font-size:15px}#mkpr p{margin:4px 0}}
`;
const css=()=>{if(!g("mkp-css")){const s=document.createElement("style");s.id="mkp-css";s.textContent=CSS;document.head.appendChild(s)}};
const me=()=>X&&X.me?String(X.me.e||"").toLowerCase():"";
const myN=()=>X&&X.me?String(X.me.n||"").slice(0,60):"";
const nameOf=e=>{const w=WD.get(String(e||"").toLowerCase());return w&&w.n?w.n:String(e||"").split("@")[0]};
const avc=e=>{let h=0;String(e).split("").forEach(c=>{h=(h*31+c.charCodeAt(0))>>>0});return CLR[h%CLR.length]};
const av=e=>{const n=nameOf(e);return `<i class="mkp-av" style="background:${avc(e)}" aria-hidden="true">${E((n.replace(/^(ال|م\.\s*)/,"")||"?").charAt(0))}</i>`};
const pg=list=>{try{if(X&&X.ping&&list&&list.length)X.ping(list)}catch(e){}};
const can={mgr:()=>!!(X&&X.mgr),team:()=>!!(X&&X.team),fin:()=>!!(X&&X.fin),all:()=>!!(X&&X.all)};
const errTxt=e=>{const m=String(e&&(e.code||e.message)||"");return /permission|denied|42501/.test(m)?"غير مسموح. ربما لم تتحدّث قواعد المنصة بعد، أو ليس لديك الصلاحية":/timeout/.test(m)?"الاتصال بطيء، حاول مرة أخرى":"تعذّر الحفظ، تحقّق من الاتصال وحاول مرة أخرى"};
// ctx: {db, toast, me:{e,n}, mgr, team, fin, all, ping(list), redraw(), show()}
export function initMk(ctx){
 stopMk();X=ctx;css();
 document.addEventListener("click",onClick);document.addEventListener("change",onChange);document.addEventListener("input",onInput);
 start();
}
export function stopMk(){UN.forEach(f=>{try{f()}catch(e){}});UN=[];ON=false;C=new Map();T=new Map();D=new Map();XS=new Map();WD=new Map();LOADED=false;IBC=new Map();BUSY=false;
 document.removeEventListener("click",onClick);document.removeEventListener("change",onChange);document.removeEventListener("input",onInput);
 const m=g("mkm");if(m)m.remove();X=null}
function sub(q,M,last){UN.push(onSnapshot(q,s=>{M.clear();s.docs.forEach(d=>M.set(d.id,Object.assign({id:d.id},d.data())));if(last)LOADED=true;paint()},e=>{if(X&&last)X.toast("تعذّرت قراءة الحملات. ربما لم تتحدّث قواعد المنصة بعد","er")}))}
function start(){
 if(ON||!X)return;ON=true;const db=X.db,m=me();
 UN.push(onSnapshot(collection(db,"whdir"),s=>{WD=new Map();s.docs.forEach(d=>WD.set(d.id.toLowerCase(),d.data()));paint()},()=>{}));
 if(can.all()){sub(collection(db,"mkt"),T);sub(collection(db,"mkd"),D);sub(collection(db,"mkx"),XS);sub(collection(db,"mkc"),C,true)}
 else{sub(query(collection(db,"mkt"),where("as","==",m)),T);sub(query(collection(db,"mkd"),where("by.e","==",m)),D);sub(query(collection(db,"mkc"),where("tm","array-contains",m)),C,true)}
}
function paint(){if(!X)return;if(PENDOPEN&&C.has(PENDOPEN)){S.c=PENDOPEN;S.sub="ov";PENDOPEN="";if(X.show)X.show()}if(X.redraw)X.redraw();const m=g("mkm");if(m&&m.dataset.mkv==="pay"&&m.dataset.mki&&!D.has(m.dataset.mki))closeM()}
// ---------- الحسابات ----------
const tasksOf=c=>[...T.values()].filter(t=>t.c===c);
const dealsOf=c=>[...D.values()].filter(d=>d.c===c);
const exOf=c=>[...XS.values()].filter(x=>x.c===c);
export function spend(c){
 const by={};XK.forEach(k=>by[k[0]]=0);let paid=0,wait=0,pend=0;
 dealsOf(c).forEach(d=>{if(d.st==="ok"||d.st==="paid"){by.inf+=N(d.amt);if(d.st==="paid")paid+=N(d.amt);else wait+=N(d.amt)}if(d.st==="pend")pend+=N(d.amt)});
 exOf(c).forEach(x=>{by[x.k in by?x.k:"oth"]+=N(x.a);paid+=N(x.a)});
 const tot=XK.reduce((a,k)=>a+by[k[0]],0);return {by,tot,paid,wait,pend};
}
function timeP(c){const t=today();if(!c.from||!c.to)return 0;if(t<c.from)return 0;if(t>c.to)return 100;return Math.min(100,Math.round((days(c.from,t)+1)/(days(c.from,c.to)+1)*100))}
const kpOf=c=>Array.isArray(c.kp)?c.kp:[];
const kpName=k=>k.k==="oth"&&k.l?k.l:lab(KP,k.k);
function tkStat(c){const L=tasksOf(c),t=today(),done=L.filter(x=>x.st==="done").length,od=L.filter(x=>x.st!=="done"&&x.du&&x.du<t).length;return {n:L.length,done,od}}
// 💡 القراءة الذكية (من الأرقام فقط)
function insights(c){
 const out=[],s=spend(c.id),bud=N(c.bud),up=pct(s.tot,bud),tp=timeP(c),ts=tkStat(c.id),t=today(),L=dealsOf(c.id);
 if(bud>0&&s.tot>bud)out.push(["bad",`تجاوزت الحملة ميزانيتها بـ ${money(s.tot-bud)} ريال (${up}% من الميزانية).`]);
 else if(bud>0&&c.st==="live"&&up>tp+20)out.push(["warn",`الصرف أسرع من الوقت: استُهلك ${up}% من الميزانية بينما مضى ${tp}% فقط من مدة الحملة.`]);
 else if(bud>0&&c.st==="live"&&tp>=60&&up<tp-35)out.push(["info",`الصرف أبطأ من المتوقع: استُهلك ${up}% من الميزانية ومضى ${tp}% من المدة. المتبقي ${money(bud-s.tot)} ريال.`]);
 if(c.st==="live"&&c.to>=t){const k=days(t,c.to);out.push(["info",k===0?"اليوم آخر أيام الحملة.":`حتى نهاية الحملة: ${k} يوماً.`])}
 if(c.st==="plan"&&c.from>=t){const k=days(t,c.from);out.push(["info",k===0?"تبدأ الحملة اليوم.":`تبدأ الحملة بعد ${k} يوماً.`])}
 if(ts.od)out.push(["bad",`${ts.od} مهمة تأخرت عن موعدها.`]);
 const kps=kpOf(c);kps.forEach(k=>{const v=N(k.v),tg=N(k.t);if(!tg)return;const p=pct(v,tg);
  if(p>=100)out.push(["ok",`تحقق هدف «${kpName(k)}»: ${big(v)} من ${big(tg)} (${p}%).`]);
  else if(c.st==="live"&&tp>=40&&p<tp-25)out.push(["warn",`هدف «${kpName(k)}» متأخر: تحقق ${p}% ومضى ${tp}% من المدة.`])});
 const sp=s.tot;if(sp>0){
  const rev=kps.find(k=>k.k==="rev"&&N(k.v)>0);if(rev)out.push([N(rev.v)>=sp?"ok":"warn",`العائد: كل ريال صُرف أعاد ${(N(rev.v)/sp).toFixed(1)} ريال مبيعات (${money(rev.v)} مبيعات مقابل ${money(sp)} مصروف).`]);
  const rc=kps.find(k=>(k.k==="reach"||k.k==="views")&&N(k.v)>0);if(rc)out.push(["info",`${rc.k==="reach"?"تكلفة الوصول لكل 1000 شخص:":"تكلفة كل 1000 مشاهدة:"} ${(sp/N(rc.v)*1000).toFixed(1)} ريال.`]);
  const od=kps.find(k=>k.k==="ord"&&N(k.v)>0);if(od)out.push(["info",`تكلفة الطلب الواحد: ${money(sp/N(od.v))} ريال.`]);
 }
 const ranked=L.filter(d=>(d.st==="ok"||d.st==="paid")&&d.rs&&N(d.rs.v)>0).map(d=>({d,cpm:N(d.amt)/N(d.rs.v)*1000})).sort((a,b)=>a.cpm-b.cpm);
 if(ranked.length>=2)out.push(["ok",`أفضل مؤثر من حيث التكلفة: ${ranked[0].d.n} (${ranked[0].cpm.toFixed(1)} ريال لكل 1000 مشاهدة)، والأعلى تكلفة: ${ranked[ranked.length-1].d.n} (${ranked[ranked.length-1].cpm.toFixed(1)}).`]);
 const pe=L.filter(d=>d.st==="pend").length,wt=L.filter(d=>d.st==="ok").length;
 if(pe)out.push(["warn",`${pe} اتفاق مع مؤثر بانتظار اعتماد مدير التسويق (${money(s.pend)} ريال).`]);
 if(wt)out.push(["warn",`${wt} اتفاق معتمد بانتظار التحويل من المالية (${money(s.wait)} ريال).`]);
 if(!out.length)out.push(["ok","كل شيء على المسار. أضف النتائج الفعلية أولاً بأول لتظهر قراءات أدق."]);
 return out;
}
// ---------- الرسوم ----------
function ring(p,col,size,sw,center){const r=(size-sw)/2,Cc=2*Math.PI*r,v=Math.max(0,Math.min(100,p)),L=Cc*v/100;
 return `<div class="mkp-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(128,128,128,.18)" stroke-width="${sw}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${L} ${Cc}"/></svg><div class="c">${center}</div></div>`}
function donut(parts,size,sw,center){const r=(size-sw)/2,Cc=2*Math.PI*r,tot=parts.reduce((a,x)=>a+x.v,0);let off=0;
 const seg=tot>0?parts.filter(x=>x.v>0).map(x=>{const L=Cc*x.v/tot,s=`<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${x.c}" stroke-width="${sw}" stroke-dasharray="${Math.max(0,L-1.5)} ${Cc}" stroke-dashoffset="${-off}"/>`;off+=L;return s}).join(""):"";
 return `<div class="mkp-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(128,128,128,.18)" stroke-width="${sw}"/>${seg}</svg><div class="c">${center}</div></div>`}
const barC=p=>p>100?"r":p>=85?"w":"";
// ---------- القائمة ----------
export function mkVisible(){return !!X&&(can.all()||C.size>0||T.size>0)}
export function mkCount(){if(!X)return 0;let n=0;const m=me(),t=addD(today(),2);
 if(can.mgr())D.forEach(d=>{if(d.st==="pend")n++});if(can.fin())D.forEach(d=>{if(d.st==="ok")n++});
 T.forEach(x=>{if(x.as===m&&x.st!=="done"&&x.du&&x.du<=t)n++});return n}
export function mkOpen(id){if(!X)return;id=String(id||"");if(C.has(id)){S.c=id;S.sub="ov";if(X.redraw)X.redraw()}else PENDOPEN=id}
export function mkView(){
 if(!X)return "";start();
 if(S.c&&C.has(S.c))return detail(C.get(S.c));S.c="";
 const L=[...C.values()],t=today(),m=me(),all=can.all();
 const act=L.filter(c=>c.st==="live"),bud=L.filter(c=>c.st==="live"||c.st==="plan").reduce((a,c)=>a+N(c.bud),0),sp=L.filter(c=>c.st==="live"||c.st==="plan").reduce((a,c)=>a+spend(c.id).tot,0);
 const pend=[...D.values()].filter(d=>d.st==="pend"),wait=[...D.values()].filter(d=>d.st==="ok"),mine=[...T.values()].filter(x=>x.as===m&&x.st!=="done").sort((a,b)=>String(a.du||"9").localeCompare(String(b.du||"9")));
 const tiles=all?`<div class="mkp-tl"><div class="k"><small>حملات جارية الآن</small><b>${act.length}</b><em>من ${L.filter(c=>c.st!=="x").length} حملة</em></div>
  <div><small>ميزانية الحملات الجارية والمخططة</small><b>${money(bud)}</b><em>ريال</em></div>
  <div class="${bud&&sp>bud?"r":""}"><small>المصروف منها</small><b>${money(sp)}</b><em>${pct(sp,bud)}% من الميزانية</em></div>
  <div class="${pend.length?"w":""}"><small>اتفاقات بانتظار الاعتماد</small><b>${pend.length}</b><em>${money(pend.reduce((a,d)=>a+N(d.amt),0))} ريال</em></div>
  <div class="${wait.length?"w":""}"><small>بانتظار التحويل للمؤثرين</small><b>${wait.length}</b><em>${money(wait.reduce((a,d)=>a+N(d.amt),0))} ريال</em></div></div>`:"";
 // مطلوب منك
 const req=[];
 if(can.mgr())pend.forEach(d=>req.push(`<div class="mkp-ai"><div class="t"><b>🤝 اعتماد اتفاق: <bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</b><small>${E(lab(PF,d.pf))}${d.h?` · <bdi data-notr dir="ltr">${E(d.h)}</bdi>`:""} · حملة «<bdi data-notr>${E(cn(d.c))}</bdi>» · سجّله <bdi data-notr>${E(d.by&&d.by.n||"")}</bdi></small></div><div class="bt2"><button type="button" class="b sm mok" data-mkq="dok" data-mki="${E(d.id)}">✅ اعتماد</button><button type="button" class="b sm" data-mkq="dno" data-mki="${E(d.id)}">رفض</button><button type="button" class="b sm" data-mkq="open" data-mki="${E(d.c)}" data-mks="inf">عرض</button></div></div>`));
 if(can.fin())wait.forEach(d=>req.push(`<div class="mkp-ai"><div class="t"><b>💸 تحويل لمؤثر: <bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</b><small>حملة «<bdi data-notr>${E(cn(d.c))}</bdi>» · اعتمده <bdi data-notr>${E(d.ap&&d.ap.n||"")}</bdi> ${d.ap?"· "+E(dts(d.ap.at)):""}</small></div><div class="bt2"><button type="button" class="b sm p" data-mkq="pay" data-mki="${E(d.id)}">💸 بيانات التحويل وتسجيله</button></div></div>`));
 mine.slice(0,8).forEach(x=>req.push(taskAct(x,true)));
 const reqH=req.length?`<div class="mkp-act"><h3>📥 مطلوب منك (${req.length})</h3>${req.join("")}</div>`:"";
 const F=[["act","الجارية والمخططة"],["live","جارية"],["plan","مخطط لها"],["done","منتهية"],["x","ملغاة"],["all","الكل"]];
 const vis=L.filter(c=>S.f==="all"||(S.f==="act"?(c.st==="live"||c.st==="plan"):c.st===S.f)).sort((a,b)=>(a.st==="live"?0:a.st==="plan"?1:2)-(b.st==="live"?0:b.st==="plan"?1:2)||String(a.from).localeCompare(String(b.from)));
 const fl=`<div class="mkp-fl">${F.map(f=>`<button type="button" class="b sm${S.f===f[0]?" on":""}" data-mkq="f" data-mkf="${f[0]}">${f[1]}</button>`).join("")}<span class="sp"></span><button type="button" class="b sm${S.vw==="cards"?" on":""}" data-mkq="vw" data-mkv="cards">▦ بطاقات</button><button type="button" class="b sm${S.vw==="time"?" on":""}" data-mkq="vw" data-mkv="time">📅 جدول زمني</button></div>`;
 const body=!LOADED?`<div class="mkp-e">جاري التحميل…</div>`:!L.length?`<div class="mkp-e"><b>لا توجد حملات بعد</b>${can.mgr()?"ابدأ بإنشاء أول حملة: الهدف والميزانية والمدة والقنوات، ثم وزّع المهام على الفريق.":"ستظهر هنا الحملات التي أنت ضمن فريقها."}${can.mgr()?`<div style="margin-top:12px"><button type="button" class="b p" data-mkq="new">➕ حملة جديدة</button></div>`:""}</div>`
  :!vis.length?`<div class="mkp-e">لا توجد حملات بهذا الفلتر</div>`:S.vw==="time"?timeline(vis):`<div class="mkp-g">${vis.map(card).join("")}</div>`;
 return `<div class="pan mkp"><div class="mkp-h"><h2>📣 الحملات التسويقية</h2>${can.mgr()?`<button type="button" class="b p" data-mkq="new">➕ حملة جديدة</button>`:""}</div>${tiles}${reqH}${L.length?fl:""}${body}
 ${all?"":`<p class="mkp-note">تظهر لك الحملات التي أنت ضمن فريقها ومهامك فيها.</p>`}</div>`;
}
const cn=id=>{const c=C.get(id);return c?c.n:"—"};
const dts=t=>{if(!t)return "";const d=new Date(N(t));return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
function card(c){
 const s=spend(c.id),bud=N(c.bud),up=pct(s.tot,bud),tp=timeP(c),ts=tkStat(c.id),col=CLR[N(c.cl)%CLR.length]||CLR[0],showB=can.all();
 const kps=kpOf(c).slice(0,3).map(k=>{const p=pct(N(k.v),N(k.t));return `<span>${E(kpName(k))}</span><div class="mkp-bar ${p>=100?"k":""}" title="${p}%"><i style="width:${Math.min(100,p)}%"></i></div>`}).join("");
 const flags=[];if(ts.od)flags.push(`<span class="bad">⏰ ${ts.od} متأخرة</span>`);if(bud&&s.tot>bud)flags.push(`<span class="bad">تجاوز الميزانية</span>`);else if(c.st==="live"&&bud&&up>tp+20)flags.push(`<span class="warn">الصرف أسرع من الوقت</span>`);
 const pe=dealsOf(c.id).filter(d=>d.st==="pend").length;if(pe)flags.push(`<span class="warn">🤝 ${pe} بانتظار الاعتماد</span>`);
 return `<button type="button" class="mkp-cd" style="--cc:${col}" data-mkq="open" data-mki="${E(c.id)}" data-tzi="mk:${E(c.id)}" data-tzs="${E(c.st)}" data-tzt="${N(c.ts)}">
 <div class="top"><div class="nm"><b data-notr>${E(c.n)}</b><small><bdi dir="ltr">${E(dmy(c.from))}</bdi> ← <bdi dir="ltr">${E(dmy(c.to))}</bdi> · ${days(c.from,c.to)+1} يوماً</small></div>${showB?ring(up,up>100?"#b03a2e":up>=85?"#d08a2c":col,64,7,`<b>${up}%</b><small>المصروف</small>`):""}</div>
 <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="mkp-st ${E(c.st)}">${E(CST[c.st]||c.st)}</span><span class="mkp-ch">${(c.ch||[]).map(x=>`<span>${E(lab(CH,x))}</span>`).join("")}</span></div>
 <div class="mkp-mt"><span>الوقت</span><div class="mkp-bar t"><i style="width:${tp}%"></i></div>${showB?`<span>الميزانية</span><div class="mkp-bar ${barC(up)}"><i style="width:${Math.min(100,up)}%"></i></div>`:""}${kps}</div>
 <div class="mkp-ft"><span>✅ ${ts.done}/${ts.n} مهمة</span>${showB?`<span>💰 ${money(s.tot)} / ${money(bud)} ريال</span>`:""}${flags.join("")}</div></button>`;
}
function timeline(L){
 const t=today();let a=L.reduce((m,c)=>c.from<m?c.from:m,t),b=L.reduce((m,c)=>c.to>m?c.to:m,addD(t,30));
 a=addD(a,-3);b=addD(b,3);const span=Math.max(1,days(a,b)),pos=s=>Math.max(0,Math.min(100,days(a,s)/span*100));
 const ms=[];const d0=dOf(a);d0.setDate(1);d0.setMonth(d0.getMonth()+1);while(ymd(d0)<b){ms.push(ymd(d0));d0.setMonth(d0.getMonth()+1)}
 const MN=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
 return `<div class="mkp-tm"><div class="ax">${ms.map(m=>`<span style="inset-inline-start:${pos(m)}%">${MN[+m.slice(5,7)-1]}</span>`).join("")}</div>
 ${L.map(c=>{const l=pos(c.from),w=Math.max(1.2,pos(addD(c.to,1))-l),col=CLR[N(c.cl)%CLR.length]||CLR[0];return `<div class="rw"><div class="rn" data-notr title="${E(c.n)}">${E(c.n)}</div><div class="tr"><span class="now" style="inset-inline-start:${pos(t)}%" aria-hidden="true"></span><button type="button" class="bx${c.st==="x"?" x":""}" style="--cc:${col};inset-inline-start:${l}%;width:${w}%" data-mkq="open" data-mki="${E(c.id)}" title="${E(c.n)} · ${E(dmy(c.from))} ← ${E(dmy(c.to))}">${E(CST[c.st]||"")}</button></div></div>`}).join("")}
 <p class="mkp-note">الخط الأحمر = اليوم. اضغط أي حملة لفتحها.</p></div>`;
}
function taskAct(x,withC){
 const t=today(),od=x.st!=="done"&&x.du&&x.du<t,r=rl(x.r),m=me(),mine=x.as===m,mgr=can.mgr();
 const cl=Array.isArray(x.cl)?x.cl:[],cd=cl.filter(k=>k.k).length;
 const btn=(mine||mgr)?(x.st==="todo"?`<button type="button" class="b sm" data-mkq="tst" data-mki="${E(x.id)}" data-mks="doing">▶ بدأت</button><button type="button" class="b sm mok" data-mkq="tst" data-mki="${E(x.id)}" data-mks="done">✓ أنجزتها</button>`
   :x.st==="doing"?`<button type="button" class="b sm mok" data-mkq="tst" data-mki="${E(x.id)}" data-mks="done">✓ أنجزتها</button>`:`<button type="button" class="b sm" data-mkq="tst" data-mki="${E(x.id)}" data-mks="todo">↩ إعادة فتح</button>`):"";
 const ed=mgr?`<button type="button" class="b sm" data-mkq="tedit" data-mki="${E(x.id)}">تعديل</button>`:"";
 const cls=cl.length?`<div class="cl">${cl.map((k,i)=>`<label><input type="checkbox" data-mkcl="${E(x.id)}" data-mkk="${i}"${k.k?" checked":""}${(mine||mgr)&&x.st!=="done"?"":" disabled"}><span data-notr>${E(k.t)}</span></label>`).join("")}</div>`:"";
 return `<div class="mkp-tr${x.st==="done"?" dn":""}" data-tzi="mkt:${E(x.id)}" data-tzs="${E(x.st)}" data-tzt="${N(x.ts)}"><div class="tt"><b><span aria-hidden="true">${r[1]}</span> <span data-notr>${E(x.t)}</span></b>
 <small>${withC?`حملة «<bdi data-notr>${E(cn(x.c))}</bdi>» · `:""}${av(x.as)} <bdi data-notr>${E(nameOf(x.as))}</bdi> · <span class="mkp-st ${E(x.st)}">${E(TST[x.st]||x.st)}</span>${x.du?` · <span class="${od?"od":""}">${od?"⏰ تأخرت · ":"الموعد "}<bdi dir="ltr">${E(dmy(x.du))}</bdi></span>`:""}${cl.length?` · ☑ ${cd}/${cl.length}`:""}${x.st==="done"&&x.dn?` · أنجزها <bdi data-notr>${E(x.dn.n)}</bdi>`:""}</small>
 ${x.nt?`<small data-notr>📝 ${E(x.nt)}</small>`:""}${x.rs?`<small data-notr>📎 ${E(x.rs)}</small>`:""}</div><div class="bt2" style="display:flex;gap:6px;flex-wrap:wrap">${btn}${(mine&&x.st!=="todo")?`<button type="button" class="b sm" data-mkq="trs" data-mki="${E(x.id)}">📎 ملاحظة التسليم</button>`:""}${ed}${withC?`<button type="button" class="b sm" data-mkq="open" data-mki="${E(x.c)}" data-mks="tk">الحملة</button>`:""}</div>${cls}</div>`;
}
// ---------- تفاصيل الحملة ----------
function detail(c){
 const col=CLR[N(c.cl)%CLR.length]||CLR[0],mgr=can.mgr(),all=can.all(),ts=tkStat(c.id),Ls=dealsOf(c.id);
 const subs=[["ov","نظرة عامة",""],["tk","المهام",ts.n],["inf","المؤثرون",Ls.length]].concat(all?[["sp","المصروفات",exOf(c.id).length+Ls.filter(d=>d.st==="ok"||d.st==="paid").length],["rs","النتائج",""]]:[]);
 if(!subs.find(x=>x[0]===S.sub))S.sub="ov";
 const stB=mgr?(c.st==="plan"?`<button type="button" class="b sm mok" data-mkq="cst" data-mks="live">▶ بدء الحملة</button>`:c.st==="live"?`<button type="button" class="b sm" data-mkq="cst" data-mks="done">🏁 إنهاء الحملة</button>`:c.st==="done"||c.st==="x"?`<button type="button" class="b sm" data-mkq="cst" data-mks="live">↩ إعادة تفعيل</button>`:""):"";
 const head=`<div class="mkp-dh" style="--cc:${col}"><div class="r1"><button type="button" class="b sm" data-mkq="back" aria-label="رجوع للحملات">→ الحملات</button><h2 data-notr>${E(c.n)}</h2><span class="mkp-st ${E(c.st)}">${E(CST[c.st]||c.st)}</span></div>
 ${c.gl?`<p data-notr>🎯 ${E(c.gl)}</p>`:""}<p><bdi dir="ltr">${E(dmy(c.from))}</bdi> ← <bdi dir="ltr">${E(dmy(c.to))}</bdi> · ${days(c.from,c.to)+1} يوماً · أنشأها <bdi data-notr>${E(c.by&&c.by.n||"")}</bdi></p>
 <div class="mkp-ch" style="margin-top:8px">${(c.ch||[]).map(x=>`<span>${E(lab(CH,x))}</span>`).join("")}</div>
 <div class="r2">${stB}${mgr?`<button type="button" class="b sm" data-mkq="cedit">✏️ تعديل الحملة</button>`:""}${mgr&&c.st!=="x"&&c.st!=="done"?`<button type="button" class="b sm" data-mkq="cst" data-mks="x">إلغاء الحملة</button>`:""}${mgr&&(c.st==="plan"||c.st==="x")?`<button type="button" class="b sm" data-mkq="cdel">🗑 حذف</button>`:""}${all?`<button type="button" class="b sm" data-mkq="prn">🖨 تقرير الحملة</button>`:""}</div></div>`;
 const sb=`<div class="mkp-sb" role="tablist">${subs.map(x=>`<button type="button" role="tab" aria-selected="${S.sub===x[0]}" class="${S.sub===x[0]?"on":""}" data-mkq="sub" data-mks="${x[0]}">${x[1]}${x[2]!==""&&x[2]!=null?`<i>${x[2]}</i>`:""}</button>`).join("")}</div>`;
 const body=S.sub==="tk"?tkTab(c):S.sub==="inf"?infTab(c):S.sub==="sp"?spTab(c):S.sub==="rs"?rsTab(c):ovTab(c);
 return `<div class="pan mkp">${head}${sb}${body}</div>`;
}
function ovTab(c){
 const all=can.all(),s=spend(c.id),bud=N(c.bud),up=pct(s.tot,bud),tp=timeP(c),ts=tkStat(c.id);
 const parts=XK.map(k=>({v:s.by[k[0]],c:k[2],l:k[1]}));
 const budB=all?`<div class="mkp-bx"><h3>💰 الميزانية والمصروف</h3><div class="mkp-bud">${donut(parts,150,18,`<b>${money(s.tot)}</b><small>من ${money(bud)} ريال</small>`)}
 <div class="mkp-lg">${parts.filter(x=>x.v>0).map(x=>`<div><i style="background:${x.c}"></i><span>${E(x.l)}</span><b>${money(x.v)}</b></div>`).join("")||`<div class="off" style="font-size:13px">لا مصروفات بعد</div>`}
 <div style="border-top:1px solid var(--line);padding-top:6px"><span>المتبقي</span><b style="color:${bud-s.tot<0?"var(--mk-r)":"var(--mk-ok)"}">${money(bud-s.tot)}</b></div>${s.wait?`<div><span>منه بانتظار التحويل</span><b>${money(s.wait)}</b></div>`:""}</div></div>
 <div class="mkp-pace"><div><span>الميزانية</span><div class="mkp-bar ${barC(up)}"><i style="width:${Math.min(100,up)}%"></i></div><b>${up}%</b></div><div><span>مدة الحملة</span><div class="mkp-bar t"><i style="width:${tp}%"></i></div><b>${tp}%</b></div><div><span>المهام</span><div class="mkp-bar k"><i style="width:${pct(ts.done,ts.n)}%"></i></div><b>${pct(ts.done,ts.n)}%</b></div></div></div>`:"";
 const kps=kpOf(c),kpB=`<div class="mkp-bx"><h3>🎯 الأهداف مقابل المتحقق</h3>${kps.length?`<div class="mkp-kp">${kps.map(k=>{const v=N(k.v),tg=N(k.t),p=pct(v,tg);return `<div class="k"><span>${E(kpName(k))}</span><b>${big(v)} / ${big(tg)}</b><div class="mkp-bar ${p>=100?"k":p<tp-25&&c.st==="live"?"w":""}"><i style="width:${Math.min(100,p)}%"></i></div><small>${p}%${all&&s.tot&&v?` · ${k.k==="rev"?"العائد "+(v/s.tot).toFixed(1)+"×":"تكلفة الوحدة "+(s.tot/v).toFixed(2)+" ريال"}`:""}</small></div>`}).join("")}</div>`:`<p class="off" style="font-size:13px">لم تُحدَّد أهداف بالأرقام لهذه الحملة.</p>`}
 ${(can.mgr()||can.team())&&kps.length?`<button type="button" class="b sm" data-mkq="kpe" style="margin-top:10px">📈 تحديث النتائج الفعلية</button>`:""}</div>`;
 const insB=all?`<div class="mkp-bx"><h3>💡 قراءة ذكية</h3><div class="mkp-ins">${insights(c).map(x=>`<div class="${x[0]}">${E(x[1])}</div>`).join("")}</div></div>`:"";
 const tm=Array.isArray(c.tm)?c.tm:[],teamB=`<div class="mkp-bx"><h3>👥 فريق الحملة</h3>${tm.length?`<div class="mkp-team">${tm.map(e=>{const L=tasksOf(c.id).filter(x=>x.as===e),d=L.filter(x=>x.st==="done").length;return `<span>${av(e)}<bdi data-notr>${E(nameOf(e))}</bdi>${all?` · ${d}/${L.length}`:""}</span>`}).join("")}</div>`:`<p class="off" style="font-size:13px">لا أعضاء بعد. ${can.mgr()?"أضفهم من «تعديل الحملة» أو عند إسناد مهمة.":""}</p>`}
 ${c.nt?`<p class="mkp-note" data-notr>📝 ${E(c.nt)}</p>`:""}</div>`;
 const myT=tasksOf(c.id).filter(x=>x.as===me()&&x.st!=="done");
 return `${myT.length?`<div class="mkp-act"><h3>📥 مهامك في هذه الحملة</h3>${myT.map(x=>taskAct(x,false)).join("")}</div>`:""}<div class="mkp-2"><div>${budB}${kpB}</div><div>${insB}${teamB}</div></div>`;
}
function tkTab(c){
 const L=tasksOf(c.id),mgr=can.mgr();
 const top=mgr?`<div class="mkp-fl"><button type="button" class="b p sm" data-mkq="tnew">➕ مهمة</button><button type="button" class="b sm" data-mkq="tpl">⚡ المهام المعتادة لحملة</button></div>`:"";
 if(!L.length)return `${top}<div class="mkp-e"><b>لا مهام بعد</b>${mgr?"أضف المهام واحدة واحدة، أو اختر «المهام المعتادة لحملة» لإضافتها مرة واحدة وتوزيعها على الفريق.":"ستظهر هنا مهامك في هذه الحملة."}</div>`;
 return `${top}<div class="mkp-tk">${RL.map(r=>{const G=L.filter(x=>x.r===r[0]).sort((a,b)=>(a.st==="done"?1:0)-(b.st==="done"?1:0)||String(a.du||"9").localeCompare(String(b.du||"9")));if(!G.length)return "";const d=G.filter(x=>x.st==="done").length;
  return `<div class="mkp-rg"><h4><span aria-hidden="true">${r[1]}</span> ${r[2]} <small>${d}/${G.length}</small></h4>${G.map(x=>taskAct(x,false)).join("")}</div>`}).join("")}</div>`;
}
function infTab(c){
 const L=dealsOf(c.id).sort((a,b)=>N(b.ts)-N(a.ts)),mgr=can.mgr(),fin=can.fin(),m=me(),cr=!(X&&X.ro)&&(mgr||can.team()||(Array.isArray(c.tm)&&c.tm.includes(m)));
 const sum=st=>L.filter(d=>d.st===st).reduce((a,d)=>a+N(d.amt),0),cnt=st=>L.filter(d=>d.st===st).length;
 const pp=`<div class="mkp-pp"><div><small>بانتظار الاعتماد</small><b>${cnt("pend")}</b><small>${money(sum("pend"))} ريال</small></div><div><small>معتمد · بانتظار التحويل</small><b>${cnt("ok")}</b><small>${money(sum("ok"))} ريال</small></div><div><small>تم التحويل</small><b>${cnt("paid")}</b><small>${money(sum("paid"))} ريال</small></div><div><small>مرفوض أو ملغى</small><b>${cnt("no")+cnt("x")}</b><small>${money(sum("no")+sum("x"))} ريال</small></div></div>`;
 const top=cr&&c.st!=="x"?`<div class="mkp-fl"><button type="button" class="b p sm" data-mkq="dnew">➕ اتفاق مع مؤثر</button><span class="mkp-note" style="margin:0">الآيبان يراه مدير التسويق والمالية ومن سجّل الاتفاق فقط.</span></div>`:"";
 if(!L.length)return `${top}<div class="mkp-e"><b>لا اتفاقات بعد</b>سجّل الاتفاق مع المؤثر (المبلغ والمطلوب منه والآيبان)، فيصل لمدير التسويق للاعتماد ثم للمالية للتحويل.</div>`;
 const rows=L.map(d=>{const mine=d.by&&d.by.e===m,cpm=d.rs&&N(d.rs.v)>0?N(d.amt)/N(d.rs.v)*1000:0,acts=[];
  if(mgr&&d.st==="pend"){acts.push(`<button type="button" class="b sm mok" data-mkq="dok" data-mki="${E(d.id)}">✅ اعتماد</button>`);acts.push(`<button type="button" class="b sm" data-mkq="dno" data-mki="${E(d.id)}">رفض</button>`)}
  if(fin&&d.st==="ok")acts.push(`<button type="button" class="b sm p" data-mkq="pay" data-mki="${E(d.id)}">💸 تسجيل التحويل</button>`);
  if((mine||mgr)&&(d.st==="pend"||d.st==="no"))acts.push(`<button type="button" class="b sm" data-mkq="dedit" data-mki="${E(d.id)}">${d.st==="no"?"صحّح وأعد الإرسال":"تعديل"}</button>`);
  if((mine||mgr||can.team())&&(d.st==="ok"||d.st==="paid"))acts.push(`<button type="button" class="b sm" data-mkq="dres" data-mki="${E(d.id)}">📊 النتائج</button>`);
  if(mgr&&d.st==="ok")acts.push(`<button type="button" class="b sm" data-mkq="dx" data-mki="${E(d.id)}">إلغاء</button>`);
  if((mgr&&(d.st==="pend"||d.st==="no"||d.st==="x"))||(mine&&(d.st==="pend"||d.st==="no")))acts.push(`<button type="button" class="b sm" data-mkq="ddel" data-mki="${E(d.id)}" aria-label="حذف الاتفاق">🗑</button>`);
  if((mgr||fin||mine)&&!(X&&X.ro))acts.push(`<button type="button" class="b sm" data-mkq="ibv" data-mki="${E(d.id)}">🏦 الآيبان</button>`);
  const why=(d.st==="no"||d.st==="x")&&d.ap&&d.ap.note?`<small style="color:var(--mk-r)" data-notr>السبب: ${E(d.ap.note)}</small>`:d.st==="paid"&&d.pd?`<small>حوّلها <bdi data-notr>${E(d.pd.n)}</bdi> · المرجع <bdi data-notr dir="ltr">${E(d.pd.ref||"")}</bdi></small>`:d.ap&&d.st==="ok"?`<small>اعتمده <bdi data-notr>${E(d.ap.n)}</bdi></small>`:"";
  const ibs=IBC.get(d.id);
  return `<tr data-tzi="mkd:${E(d.id)}" data-tzs="${E(d.st)}" data-tzt="${N(d.ts)}"><td><b data-notr>${E(d.n)}</b><small>${E(lab(PF,d.pf))}${d.h?` · <bdi data-notr dir="ltr">${E(d.h)}</bdi>`:""}${N(d.fl)?" · "+big(d.fl)+" متابع":""}</small>${ibs?`<small class="mkp-ib">${E(ibanFmt(ibs.ib))}</small>`:""}</td>
  <td data-l="المطلوب"><span data-notr>${E(d.dl)}</span>${d.dt?`<small>النشر <bdi dir="ltr">${E(dmy(d.dt))}</bdi></small>`:""}<small>سجّله <bdi data-notr>${E(d.by&&d.by.n||"")}</bdi></small></td>
  <td class="n" data-l="المبلغ">${money(d.amt)}</td><td data-l="الحالة"><span class="mkp-st ${E(d.st)}">${E(DST[d.st]||d.st)}</span>${why}</td>
  <td data-l="النتائج">${d.rs&&(N(d.rs.v)||N(d.rs.e)||N(d.rs.sl))?`${N(d.rs.v)?big(d.rs.v)+" مشاهدة":""}${N(d.rs.e)?" · "+big(d.rs.e)+" تفاعل":""}${N(d.rs.sl)?" · "+money(d.rs.sl)+" ريال":""}${cpm?`<small>${cpm.toFixed(1)} ريال / 1000 مشاهدة</small>`:""}`:"—"}</td>
  <td><div style="display:flex;gap:6px;flex-wrap:wrap">${acts.join("")}</div></td></tr>`}).join("");
 return `${top}${pp}<div style="overflow-x:auto"><table class="mkp-tb"><thead><tr><th>المؤثر</th><th>المطلوب منه</th><th>المبلغ (ريال)</th><th>الحالة</th><th>النتائج</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function spTab(c){
 const s=spend(c.id),wr=can.mgr()||can.team(),m=me(),L=[];
 dealsOf(c.id).filter(d=>d.st==="ok"||d.st==="paid").forEach(d=>L.push({k:"inf",a:N(d.amt),dt:d.dt||(d.ap?ymd(new Date(N(d.ap.at))):""),t:"مؤثر: "+d.n+(d.st==="ok"?" (بانتظار التحويل)":""),by:d.by&&d.by.n,id:""}));
 exOf(c.id).forEach(x=>L.push({k:x.k,a:N(x.a),dt:x.dt,t:x.nt||"",by:x.by&&x.by.n,id:x.id,own:x.by&&x.by.e===m}));
 L.sort((a,b)=>String(b.dt).localeCompare(String(a.dt)));
 const bud=N(c.bud),up=pct(s.tot,bud);
 return `<div class="mkp-fl">${wr?`<button type="button" class="b p sm" data-mkq="xnew">➕ مصروف</button>`:""}<button type="button" class="b sm" data-mkq="csv">⬇️ إكسل</button><span class="sp"></span><b>${money(s.tot)} / ${money(bud)} ريال (${up}%)</b></div>
 <div class="mkp-bx"><div class="mkp-lg" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${XK.map(k=>`<div><i style="background:${k[2]}"></i><span>${E(k[1])}</span><b>${money(s.by[k[0]])}</b></div>`).join("")}</div></div>
 ${L.length?`<div style="overflow-x:auto"><table class="mkp-tb"><thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th>المبلغ (ريال)</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td data-l="التاريخ"><bdi dir="ltr">${E(dmy(x.dt))}</bdi></td><td data-l="البند">${E(lab(XK,x.k))}</td><td data-l="البيان"><span data-notr>${E(x.t)}</span><small>سجّله <bdi data-notr>${E(x.by||"")}</bdi></small></td><td class="n" data-l="المبلغ">${money(x.a)}</td><td>${x.id&&(can.mgr()||x.own)?`<div style="display:flex;gap:6px"><button type="button" class="b sm" data-mkq="xedit" data-mki="${E(x.id)}">تعديل</button><button type="button" class="b sm" data-mkq="xdel" data-mki="${E(x.id)}" aria-label="حذف المصروف">🗑</button></div>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="mkp-e">لا مصروفات بعد. الاتفاقات المعتمدة مع المؤثرين تُحسب هنا تلقائياً.</div>`}
 <p class="mkp-note">المصروف = الاتفاقات المعتمدة مع المؤثرين (حتى قبل تحويلها) + المصروفات المسجّلة هنا (إعلانات، تصوير، إنتاج، تصاريح…).</p>`;
}
function rsTab(c){
 const s=spend(c.id),kps=kpOf(c),ts=tkStat(c.id),Ls=dealsOf(c.id).filter(d=>(d.st==="ok"||d.st==="paid"));
 const tv=Ls.reduce((a,d)=>a+N(d.rs&&d.rs.v),0),te=Ls.reduce((a,d)=>a+N(d.rs&&d.rs.e),0),tsl=Ls.reduce((a,d)=>a+N(d.rs&&d.rs.sl),0);
 return `<div class="mkp-tl" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><small>المصروف</small><b>${money(s.tot)}</b><em>من ${money(c.bud)} ريال</em></div><div><small>مشاهدات المؤثرين</small><b>${big(tv)}</b><em>${big(te)} تفاعل</em></div><div><small>مبيعات منسوبة للمؤثرين</small><b>${money(tsl)}</b><em>ريال</em></div><div><small>المهام المنجزة</small><b>${ts.done}/${ts.n}</b><em>${ts.od?ts.od+" متأخرة":"بلا تأخير"}</em></div></div>
 <div class="mkp-bx"><h3>🎯 الأهداف</h3>${kps.length?`<div style="overflow-x:auto"><table class="mkp-tb"><thead><tr><th>الهدف</th><th>المستهدف</th><th>المتحقق</th><th>النسبة</th><th>تكلفة الوحدة</th></tr></thead><tbody>${kps.map(k=>{const v=N(k.v),tg=N(k.t);return `<tr><td>${E(kpName(k))}</td><td class="n" data-l="المستهدف">${money(tg)}</td><td class="n" data-l="المتحقق">${money(v)}</td><td data-l="النسبة"><b style="color:${pct(v,tg)>=100?"var(--mk-ok)":"inherit"}">${pct(v,tg)}%</b></td><td class="n" data-l="تكلفة الوحدة">${v&&s.tot?(k.k==="rev"?"عائد "+(v/s.tot).toFixed(2)+"×":(s.tot/v).toFixed(2)):"—"}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="off">لا أهداف بالأرقام.</p>`}
 ${(can.mgr()||can.team())&&kps.length?`<button type="button" class="b sm" data-mkq="kpe" style="margin-top:10px">📈 تحديث النتائج الفعلية</button>`:""}</div>
 <div class="mkp-bx"><h3>💡 الخلاصة</h3><div class="mkp-ins">${insights(c).map(x=>`<div class="${x[0]}">${E(x[1])}</div>`).join("")}</div><button type="button" class="b sm" data-mkq="prn" style="margin-top:10px">🖨 تقرير الحملة الكامل (PDF)</button></div>`;
}
// ---------- النوافذ ----------
function modal(h,v,i){let m=g("mkm");if(!m){m=document.createElement("div");m.id="mkm";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");document.body.appendChild(m)}m.innerHTML=`<div>${h}</div>`;m.className="on";m.dataset.mkv=v||"";m.dataset.mki=i||"";return m}
const closeM=()=>{const m=g("mkm");if(m){m.className="";m.innerHTML="";m.dataset.mkv="";m.dataset.mki=""}BUSY=false};
const errM=t=>{const e=g("mk-err");if(e)e.textContent=t;else if(X)X.toast(t,"er")};
const people=()=>[...WD.entries()].filter(x=>x[1]&&x[1].n).map(x=>({e:x[0],n:x[1].n})).sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
function campForm(c){
 const k0=c?kpOf(c):[{k:"reach",t:""},{k:"rev",t:""}],tm=c&&Array.isArray(c.tm)?c.tm:[],t=today();
 modal(`<h3>${c?"تعديل الحملة":"حملة جديدة"}</h3><p class="sub">الهدف والمدة والميزانية والقنوات والأهداف بالأرقام وفريق العمل.</p>
 <label class="l" for="mk-n">اسم الحملة</label><input id="mk-n" maxlength="80" value="${c?E(c.n):""}" placeholder="مثال: حملة الشتاء للأحذية">
 <label class="l" for="mk-gl">الهدف من الحملة (اختياري)</label><textarea id="mk-gl" rows="2" maxlength="400">${c?E(c.gl||""):""}</textarea>
 <div class="g3"><div><label class="l" for="mk-f">من</label><input id="mk-f" type="date" value="${E(c?c.from:t)}"></div><div><label class="l" for="mk-t">إلى</label><input id="mk-t" type="date" value="${E(c?c.to:addD(t,30))}"></div>
 <div><label class="l" for="mk-b">الميزانية (ريال)</label><input id="mk-b" inputmode="decimal" dir="ltr" value="${c?E(c.bud):""}" placeholder="0"></div></div>
 <label class="l">القنوات</label><div class="chs">${CH.map(x=>`<label><input type="checkbox" data-mkch="${x[0]}"${c&&(c.ch||[]).includes(x[0])?" checked":""}>${x[1]}</label>`).join("")}</div>
 <label class="l">الأهداف بالأرقام (المستهدف)</label><div id="mk-kps">${k0.map(kpRow).join("")}</div><button type="button" class="b sm" data-mkq="kadd">➕ هدف</button>
 <label class="l">فريق الحملة (من يعمل فيها)</label><input id="mk-pq" placeholder="بحث بالاسم" aria-label="بحث في الموظفين"><div class="ppl" id="mk-ppl">${people().map(p=>`<label data-pn="${E(p.n)}"><input type="checkbox" data-mktm="${E(p.e)}"${tm.includes(p.e)?" checked":""}>${av(p.e)}<span data-notr>${E(p.n)}</span></label>`).join("")||`<span class="off">لا أسماء في دليل المستودع</span>`}</div>
 <label class="l">اللون</label><div class="chs">${CLR.map((x,i)=>`<label><input type="radio" name="mk-cl" value="${i}"${N(c&&c.cl)===i?" checked":""}><i style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${x}"></i></label>`).join("")}</div>
 <label class="l" for="mk-nt">ملاحظات (اختياري)</label><textarea id="mk-nt" rows="2" maxlength="1000">${c?E(c.nt||""):""}</textarea>
 <div class="err" id="mk-err" aria-live="polite"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="csave">${c?"حفظ":"إنشاء الحملة"}</button></div>`,"camp",c?c.id:"");
 setTimeout(()=>{const f=g("mk-n");if(f)f.focus()},60);
}
function kpRow(k){return `<div class="kr" data-kr><select data-kk aria-label="نوع الهدف">${KP.map(x=>`<option value="${x[0]}"${k.k===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select><input data-kt inputmode="decimal" dir="ltr" value="${k.t===""?"":E(k.t)}" placeholder="المستهدف" aria-label="المستهدف"><button type="button" class="b" data-mkq="krm" aria-label="حذف الهدف">×</button><input data-kl maxlength="40" value="${E(k.l||"")}" placeholder="اسم الهدف" style="grid-column:1/-1;${k.k==="oth"?"":"display:none"}" aria-label="اسم الهدف"></div>`}
async function campSave(){
 if(BUSY)return;const id=g("mkm").dataset.mki,old=id?C.get(id):null,n=String(g("mk-n").value||"").trim(),from=g("mk-f").value,to=g("mk-t").value,bud=num(g("mk-b").value);
 if(n.length<2)return errM("اكتب اسم الحملة");if(!from||!to||to<from)return errM("تاريخ النهاية لازم يكون بعد البداية");if(isNaN(bud)||bud<0)return errM("الميزانية رقم غير صحيح");
 const kp=[];let bad=false;document.querySelectorAll("#mk-kps [data-kr]").forEach((r,i)=>{const k=r.querySelector("[data-kk]").value,t=num(r.querySelector("[data-kt]").value),l=String(r.querySelector("[data-kl]").value||"").trim().slice(0,40);if(isNaN(t))bad=true;else if(t>0){const o={k,t};const prev=old?kpOf(old).find(x=>x.k===k&&(x.l||"")===(k==="oth"?l:(x.l||""))):null;if(prev&&prev.v!=null)o.v=N(prev.v);if(k==="oth"&&l)o.l=l;kp.push(o)}});
 if(bad)return errM("قيمة هدف غير صحيحة");if(kp.length>8)return errM("حتى 8 أهداف");
 const ch=[...document.querySelectorAll("#mkm [data-mkch]:checked")].map(x=>x.dataset.mkch),tm=[...document.querySelectorAll("#mkm [data-mktm]:checked")].map(x=>x.dataset.mktm);
 if(tm.length>30)return errM("فريق الحملة حتى 30 شخصاً");
 // من له مهام لا يُزال من الفريق
 if(old){const keep=tasksOf(old.id).map(x=>x.as).filter(e=>tm.indexOf(e)<0);if(keep.length)[...new Set(keep)].forEach(e=>tm.push(e))}
 const clv=document.querySelector('#mkm input[name="mk-cl"]:checked'),d={n:n.slice(0,80),ch,from,to,bud,kp,tm,st:old?old.st:"plan",by:old?old.by:{e:me(),n:myN()},ts:old?old.ts:Date.now()};
 const gl=String(g("mk-gl").value||"").trim().slice(0,400),nt=String(g("mk-nt").value||"").trim().slice(0,1000);if(gl)d.gl=gl;if(nt)d.nt=nt;if(clv)d.cl=+clv.value;if(old&&old.cd)d.cd=old.cd;if(old)d.upd=Date.now();
 BUSY=true;const nid2=id||nid();
 try{await withTimeout(setDoc(doc(X.db,"mkc",nid2),d));closeM();X.toast(old?"✅ حُفظت الحملة":"✅ أُنشئت الحملة. أضف المهام الآن");if(!old){S.c=nid2;S.sub="tk"}if(X.redraw)X.redraw()}
 catch(e){BUSY=false;errM(errTxt(e))}
}
function taskForm(c,x){
 const tm=Array.isArray(c.tm)?c.tm:[],P=people(),t=today();
 modal(`<h3>${x?"تعديل مهمة":"مهمة جديدة"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>»</p>
 <label class="l" for="mk-tt">المهمة</label><input id="mk-tt" maxlength="140" value="${x?E(x.t):""}" placeholder="مثال: تصوير مجموعة الشتاء">
 <div class="g2"><div><label class="l" for="mk-tr">الدور</label><select id="mk-tr">${RL.map(r=>`<option value="${r[0]}"${x&&x.r===r[0]?" selected":""}>${r[1]} ${r[2]}</option>`).join("")}</select></div>
 <div><label class="l" for="mk-td">الموعد</label><input id="mk-td" type="date" value="${E(x?x.du||"":addD(t,3))}"></div></div>
 <label class="l" for="mk-ta">المسؤول</label><select id="mk-ta"><option value="">— اختر —</option><optgroup label="فريق الحملة">${tm.map(e=>`<option value="${E(e)}"${x&&x.as===e?" selected":""}>${E(nameOf(e))}</option>`).join("")}</optgroup><optgroup label="موظفون آخرون (يُضافون لفريق الحملة)">${P.filter(p=>tm.indexOf(p.e)<0).map(p=>`<option value="${E(p.e)}">${E(p.n)}</option>`).join("")}</optgroup></select>
 <label class="l" for="mk-tn">تفاصيل (اختياري)</label><textarea id="mk-tn" rows="2" maxlength="500">${x?E(x.nt||""):""}</textarea>
 <label class="l" for="mk-tc">قائمة فرعية (اختياري): بند في كل سطر</label><textarea id="mk-tc" rows="3" placeholder="مثال:&#10;الأحذية&#10;الشنط&#10;العطور">${x&&Array.isArray(x.cl)?E(x.cl.map(k=>k.t).join("\n")):""}</textarea>
 <div class="err" id="mk-err" aria-live="polite"></div><div class="row">${x?`<button type="button" class="b" data-mkq="tdel" data-mki="${E(x.id)}">🗑 حذف</button>`:""}<button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="tsave" data-mki="${x?E(x.id):""}">${x?"حفظ":"إسناد المهمة"}</button></div>`,"task",c.id);
 setTimeout(()=>{const f=g("mk-tt");if(f)f.focus()},60);
}
async function taskSave(tid){
 if(BUSY)return;const c=C.get(g("mkm").dataset.mki);if(!c)return;const old=tid?T.get(tid):null;
 const t=String(g("mk-tt").value||"").trim(),r=g("mk-tr").value,du=g("mk-td").value,as=g("mk-ta").value,nt=String(g("mk-tn").value||"").trim().slice(0,500);
 if(t.length<2)return errM("اكتب المهمة");if(!as)return errM("اختر المسؤول");
 const lines=String(g("mk-tc").value||"").split(/\n/).map(s=>s.trim().slice(0,120)).filter(Boolean).slice(0,20);
 const ocl=old&&Array.isArray(old.cl)?old.cl:[],cl=lines.map(s=>{const o=ocl.find(k=>k.t===s);return {t:s,k:!!(o&&o.k)}});
 const d=old?Object.assign({},old):{c:c.id,st:"todo",by:{e:me(),n:myN()},ts:Date.now()};delete d.id;
 d.t=t.slice(0,140);d.r=r;d.as=as;if(du)d.du=du;else delete d.du;if(nt)d.nt=nt;else delete d.nt;if(cl.length)d.cl=cl;else delete d.cl;if(old)d.upd=Date.now();
 const id=tid||nid(),tm=Array.isArray(c.tm)?c.tm.slice():[];BUSY=true;
 try{const b=writeBatch(X.db);if(tm.indexOf(as)<0){tm.push(as);b.update(doc(X.db,"mkc",c.id),{tm,upd:Date.now()})}b.set(doc(X.db,"mkt",id),d);await withTimeout(b.commit());
  closeM();X.toast(old?"✅ حُفظت المهمة":"✅ أُسندت المهمة ووصل إشعار للمسؤول");pg(["t:"+id])}
 catch(e){BUSY=false;errM(errTxt(e))}
}
function tplForm(c){
 const P=people(),tm=Array.isArray(c.tm)?c.tm:[],have=tasksOf(c.id).map(x=>x.t);
 const opts=sel=>`<option value="">— المسؤول —</option>${tm.map(e=>`<option value="${E(e)}"${e===sel?" selected":""}>${E(nameOf(e))}</option>`).join("")}${P.filter(p=>tm.indexOf(p.e)<0).map(p=>`<option value="${E(p.e)}">${E(p.n)}</option>`).join("")}`;
 modal(`<h3>⚡ المهام المعتادة لحملة</h3><p class="sub">اختر المهام واختر المسؤول عن كل واحدة. المواعيد محسوبة من بداية الحملة (${E(dmy(c.from))}) ويمكن تغييرها.</p>
 ${TPL.map((x,i)=>{const prev=tasksOf(c.id).find(t=>t.r===x[0]);return `<div class="tpl" data-tp="${i}"><input type="checkbox" data-tpk${have.indexOf(x[1])<0?" checked":""} aria-label="${E(x[1])}"><span>${rl(x[0])[1]} ${E(x[1])}${have.indexOf(x[1])>=0?' <small class="off">(موجودة)</small>':""}</span><select data-tpa aria-label="المسؤول">${opts(prev?prev.as:"")}</select><input type="date" data-tpd value="${E(addD(c.from,x[2])<today()?today():addD(c.from,x[2]))}" aria-label="الموعد"></div>`}).join("")}
 <div class="err" id="mk-err" aria-live="polite"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="tplsave">إضافة المهام المختارة</button></div>`,"tpl",c.id);
}
async function tplSave(){
 if(BUSY)return;const c=C.get(g("mkm").dataset.mki);if(!c)return;const tm=Array.isArray(c.tm)?c.tm.slice():[],L=[];let miss=false;
 document.querySelectorAll("#mkm [data-tp]").forEach(r=>{if(!r.querySelector("[data-tpk]").checked)return;const x=TPL[+r.dataset.tp],as=r.querySelector("[data-tpa]").value,du=r.querySelector("[data-tpd]").value;if(!as){miss=true;return}L.push({c:c.id,t:x[1],r:x[0],as,du,st:"todo",by:{e:me(),n:myN()},ts:Date.now()});if(tm.indexOf(as)<0)tm.push(as)});
 if(miss)return errM("اختر المسؤول لكل مهمة مختارة");if(!L.length)return errM("لم تختر أي مهمة");if(tm.length>30)return errM("فريق الحملة حتى 30 شخصاً");
 L.forEach(x=>{if(!x.du)delete x.du});BUSY=true;const ids=L.map(()=>nid());
 try{const b=writeBatch(X.db);if(tm.length!==(c.tm||[]).length)b.update(doc(X.db,"mkc",c.id),{tm,upd:Date.now()});L.forEach((x,i)=>b.set(doc(X.db,"mkt",ids[i]),x));await withTimeout(b.commit());
  closeM();X.toast(`✅ أُضيفت ${L.length} مهام ووصل إشعار لكل مسؤول`);pg(ids.map(i=>"t:"+i))}
 catch(e){BUSY=false;errM(errTxt(e))}
}
async function taskSt(id,st){
 const x=T.get(id);if(!x||BUSY)return;const d={st,upd:Date.now()};BUSY=true;
 try{if(st==="done")d.dn={e:me(),n:myN(),at:Date.now()};
  if(st!=="done"&&x.dn){const n=Object.assign({},x,d);delete n.id;delete n.dn;await withTimeout(setDoc(doc(X.db,"mkt",id),n))}else await withTimeout(updateDoc(doc(X.db,"mkt",id),d));
  BUSY=false;if(st==="done")X.toast("✅ أحسنت! وصل إشعار لمدير التسويق");pg(["t:"+id])}
 catch(e){BUSY=false;X.toast(errTxt(e),"er")}
}
async function taskCl(id,k,on){const x=T.get(id);if(!x)return;const cl=(x.cl||[]).map((y,i)=>i===k?{t:y.t,k:on}:{t:y.t,k:!!y.k});try{await withTimeout(updateDoc(doc(X.db,"mkt",id),{cl,upd:Date.now()}))}catch(e){X.toast(errTxt(e),"er");if(X.redraw)X.redraw()}}
function resForm(x){modal(`<h3>📎 ملاحظة التسليم</h3><p class="sub" data-notr>${E(x.t)}</p><label class="l" for="mk-rs">رابط المجلد أو ملاحظة لمدير التسويق</label><textarea id="mk-rs" rows="3" maxlength="500">${E(x.rs||"")}</textarea><div class="err" id="mk-err"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="trsave" data-mki="${E(x.id)}">حفظ</button></div>`,"trs",x.c)}
async function resSave(id){const v=String(g("mk-rs").value||"").trim().slice(0,500),x=T.get(id);if(!x)return;try{if(v)await withTimeout(updateDoc(doc(X.db,"mkt",id),{rs:v,upd:Date.now()}));else{const n=Object.assign({},x);delete n.id;delete n.rs;n.upd=Date.now();await withTimeout(setDoc(doc(X.db,"mkt",id),n))}closeM();X.toast("✅ حُفظت")}catch(e){errM(errTxt(e))}}
// اتفاق المؤثر + الآيبان
async function dealForm(c,d){
 let ib=null;if(d){try{const s=await withTimeout(getDoc(doc(X.db,"mkdi",d.id)),10000);ib=s.exists()?s.data():null}catch(e){}}
 modal(`<h3>${d?(d.st==="no"?"تصحيح الاتفاق وإعادة إرساله":"تعديل الاتفاق"):"اتفاق جديد مع مؤثر"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>» · يُرسل لمدير التسويق للاعتماد، ثم للمالية للتحويل.</p>
 ${d&&d.st==="no"&&d.ap&&d.ap.note?`<div class="mkp-ins"><div class="bad" data-notr>سبب الرفض: ${E(d.ap.note)}</div></div>`:""}
 <div class="g2"><div><label class="l" for="mk-dn">اسم المؤثر</label><input id="mk-dn" maxlength="60" value="${d?E(d.n):""}"></div><div><label class="l" for="mk-dp">المنصة</label><select id="mk-dp">${PF.map(x=>`<option value="${x[0]}"${d&&d.pf===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></div>
 <div><label class="l" for="mk-dh">الحساب (اختياري)</label><input id="mk-dh" maxlength="60" dir="ltr" value="${d?E(d.h||""):""}" placeholder="@name"></div><div><label class="l" for="mk-df">عدد المتابعين (اختياري)</label><input id="mk-df" inputmode="numeric" dir="ltr" value="${d&&d.fl?E(d.fl):""}"></div></div>
 <label class="l" for="mk-dl">المطلوب منه</label><input id="mk-dl" maxlength="300" value="${d?E(d.dl):""}" placeholder="مثال: 3 ستوريات + ريل واحد + زيارة فرع">
 <div class="g2"><div><label class="l" for="mk-da">المبلغ المتفق عليه (ريال)</label><input id="mk-da" inputmode="decimal" dir="ltr" value="${d?E(d.amt):""}"></div><div><label class="l" for="mk-dd">تاريخ النشر (اختياري)</label><input id="mk-dd" type="date" value="${d?E(d.dt||""):""}"></div></div>
 <label class="l" for="mk-ib">الآيبان (IBAN)</label><input id="mk-ib" maxlength="42" dir="ltr" class="mkp-ib" autocomplete="off" value="${ib?E(ibanFmt(ib.ib)):""}" placeholder="SA00 0000 0000 0000 0000 0000"><div class="ibh" id="mk-ibh" aria-live="polite"></div>
 <div class="g2"><div><label class="l" for="mk-an">اسم صاحب الحساب كما في البنك</label><input id="mk-an" maxlength="80" value="${ib?E(ib.an):""}"></div><div><label class="l" for="mk-bn">البنك (اختياري)</label><input id="mk-bn" maxlength="40" value="${ib?E(ib.bn||""):""}"></div></div>
 <div class="err" id="mk-err" aria-live="polite"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="dsave" data-mki="${d?E(d.id):""}">${d?(d.st==="no"?"إعادة الإرسال للاعتماد":"حفظ"):"إرسال للاعتماد"}</button></div>`,"deal",c.id);
 ibHint();setTimeout(()=>{const f=g("mk-dn");if(f)f.focus()},60);
}
function ibHint(){const i=g("mk-ib"),h=g("mk-ibh");if(!i||!h)return;const v=ibanNorm(i.value);if(!v){h.className="ibh";h.textContent="";return}
 if(ibanOk(v)){h.className="ibh ok";h.textContent="✓ آيبان صحيح"+(v.slice(0,2)==="SA"?" (سعودي)":"")}else{h.className="ibh bad";h.textContent=v.slice(0,2)==="SA"&&v.length<24?"الآيبان السعودي 24 حرفاً (المكتوب "+v.length+")":"الآيبان غير صحيح، راجع الأرقام"}}
async function dealSave(did){
 if(BUSY)return;const c=C.get(g("mkm").dataset.mki);if(!c)return;const old=did?D.get(did):null;
 const n=String(g("mk-dn").value||"").trim().slice(0,60),pf=g("mk-dp").value,h=String(g("mk-dh").value||"").trim().slice(0,60),fl=num(g("mk-df").value),dl=String(g("mk-dl").value||"").trim().slice(0,300),amt=num(g("mk-da").value),dt=g("mk-dd").value;
 const ib=ibanNorm(g("mk-ib").value),an=String(g("mk-an").value||"").trim().replace(/[<>"'&\\]/g,"").slice(0,80),bn=String(g("mk-bn").value||"").trim().replace(/[<>"'&\\]/g,"").slice(0,40);
 if(n.length<2)return errM("اكتب اسم المؤثر");if(!dl)return errM("اكتب المطلوب من المؤثر");if(isNaN(amt)||amt<=0)return errM("اكتب المبلغ");if(isNaN(fl))return errM("عدد المتابعين رقم غير صحيح");
 if(!ibanOk(ib))return errM("الآيبان غير صحيح");if(an.length<2)return errM("اكتب اسم صاحب الحساب");
 const d={c:c.id,n,pf,dl,amt,st:"pend",by:old?old.by:{e:me(),n:myN()},ts:old?old.ts:Date.now(),ib:1};if(h)d.h=h;if(fl>0)d.fl=fl;if(dt)d.dt=dt;if(old)d.upd=Date.now();
 const ibd={ib,an,ts:Date.now()};if(bn)ibd.bn=bn;
 BUSY=true;const id=did||nid();
 try{const b=writeBatch(X.db);b.set(doc(X.db,"mkdi",id),ibd);b.set(doc(X.db,"mkd",id),d);await withTimeout(b.commit());IBC.delete(id);
  closeM();X.toast(old&&old.st!=="no"?"✅ حُفظ الاتفاق":"✅ أُرسل الاتفاق لمدير التسويق للاعتماد");pg(["d:"+id])}
 catch(e){BUSY=false;errM(errTxt(e))}
}
async function dealOk(id){const d=D.get(id);if(!d||BUSY)return;if(!confirm(`اعتماد الاتفاق مع ${d.n} بمبلغ ${money(d.amt)} ريال؟ سيصل للمالية للتحويل.`))return;BUSY=true;
 try{await withTimeout(updateDoc(doc(X.db,"mkd",id),{st:"ok",ap:{e:me(),n:myN(),at:Date.now()},upd:Date.now()}));BUSY=false;X.toast("✅ اعتُمد ووصل إشعار للمالية");pg(["d:"+id])}catch(e){BUSY=false;X.toast(errTxt(e),"er")}}
function reasonForm(id,kind){const d=D.get(id);if(!d)return;modal(`<h3>${kind==="no"?"رفض الاتفاق":"إلغاء الاتفاق المعتمد"}</h3><p class="sub"><bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</p><label class="l" for="mk-why">السبب (يصل لمن سجّله)</label><textarea id="mk-why" rows="3" maxlength="300"></textarea><div class="err" id="mk-err"></div><div class="row"><button type="button" class="b" data-mkq="mx">رجوع</button><button type="button" class="b p" data-mkq="whysave" data-mki="${E(id)}" data-mkk="${kind}">${kind==="no"?"رفض":"إلغاء الاتفاق"}</button></div>`,"why",d.c);setTimeout(()=>{const f=g("mk-why");if(f)f.focus()},60)}
async function whySave(id,kind){const v=String(g("mk-why").value||"").trim().slice(0,300);if(v.length<2)return errM("اكتب السبب");if(BUSY)return;BUSY=true;
 try{await withTimeout(updateDoc(doc(X.db,"mkd",id),{st:kind,ap:{e:me(),n:myN(),at:Date.now(),note:v},upd:Date.now()}));closeM();X.toast(kind==="no"?"تم الرفض ووصل السبب لمن سجّله":"أُلغي الاتفاق");pg(["d:"+id])}catch(e){BUSY=false;errM(errTxt(e))}}
async function loadIb(id){try{const s=await withTimeout(getDoc(doc(X.db,"mkdi",id)),10000);return s.exists()?s.data():null}catch(e){return null}}
async function payForm(id){
 const d=D.get(id);if(!d)return;modal(`<h3>💸 تحويل لمؤثر</h3><p class="sub">جاري تحميل بيانات التحويل…</p>`,"pay",id);
 const ib=await loadIb(id);if(!g("mkm")||g("mkm").dataset.mkv!=="pay")return;
 modal(`<h3>💸 تحويل لمؤثر</h3><p class="sub">حملة «<bdi data-notr>${E(cn(d.c))}</bdi>» · اعتمده <bdi data-notr>${E(d.ap&&d.ap.n||"")}</bdi></p>
 <div class="pay"><div><span>المؤثر</span><b data-notr>${E(d.n)}</b></div><div><span>المبلغ</span><b>${money(d.amt)} ريال</b></div>
 <div><span>الآيبان</span><span style="display:flex;gap:6px;align-items:center"><b class="mkp-ib">${ib?E(ibanFmt(ib.ib)):"—"}</b>${ib?`<button type="button" class="b sm" data-mkq="ibcp" data-mkv="${E(ib.ib)}">نسخ</button>`:""}</span></div>
 <div><span>صاحب الحساب</span><b data-notr>${ib?E(ib.an):"—"}</b></div>${ib&&ib.bn?`<div><span>البنك</span><b data-notr>${E(ib.bn)}</b></div>`:""}
 <div><span>المطلوب منه</span><span data-notr style="text-align:end">${E(d.dl)}</span></div></div>
 ${ib&&!ibanOk(ib.ib)?`<div class="mkp-ins"><div class="bad">تنبيه: رقم الآيبان لا يجتاز فحص الصحة. تأكّد منه قبل التحويل.</div></div>`:""}
 <label class="l" for="mk-ref">رقم مرجع التحويل من البنك</label><input id="mk-ref" maxlength="60" dir="ltr">
 <div class="err" id="mk-err" aria-live="polite"></div><div class="row"><button type="button" class="b" data-mkq="mx">إغلاق</button><button type="button" class="b p" data-mkq="paysave" data-mki="${E(id)}">✔ تم التحويل</button></div>`,"pay",id);
}
async function paySave(id){const ref=String(g("mk-ref").value||"").trim().slice(0,60);if(ref.length<2)return errM("اكتب رقم مرجع التحويل");if(BUSY)return;BUSY=true;
 try{await withTimeout(updateDoc(doc(X.db,"mkd",id),{st:"paid",pd:{e:me(),n:myN(),at:Date.now(),ref},upd:Date.now()}));closeM();X.toast("✅ سُجّل التحويل ووصل إشعار لمدير التسويق ومن سجّل الاتفاق");pg(["d:"+id])}catch(e){BUSY=false;errM(errTxt(e))}}
async function ibView(id){if(IBC.has(id)){IBC.delete(id);if(X.redraw)X.redraw();return}const ib=await loadIb(id);if(!ib){X.toast("لا يمكنك عرض بيانات التحويل","er");return}IBC.set(id,ib);if(X.redraw)X.redraw()}
function dresForm(d){const r=d.rs||{};modal(`<h3>📊 نتائج المؤثر</h3><p class="sub"><bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</p>
 <div class="g3"><div><label class="l" for="mk-rv">المشاهدات</label><input id="mk-rv" inputmode="numeric" dir="ltr" value="${r.v?E(r.v):""}"></div><div><label class="l" for="mk-re">التفاعلات</label><input id="mk-re" inputmode="numeric" dir="ltr" value="${r.e?E(r.e):""}"></div><div><label class="l" for="mk-rsl">مبيعات منسوبة (ريال)</label><input id="mk-rsl" inputmode="decimal" dir="ltr" value="${r.sl?E(r.sl):""}"></div></div>
 <label class="l" for="mk-rn">ملاحظة (اختياري)</label><input id="mk-rn" maxlength="300" value="${E(r.note||"")}"><div class="err" id="mk-err"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="drsave" data-mki="${E(d.id)}">حفظ</button></div>`,"dres",d.c)}
async function dresSave(id){const v=num(g("mk-rv").value),e=num(g("mk-re").value),sl=num(g("mk-rsl").value),note=String(g("mk-rn").value||"").trim().slice(0,300);if([v,e,sl].some(isNaN))return errM("أرقام غير صحيحة");
 const rs={};if(v)rs.v=v;if(e)rs.e=e;if(sl)rs.sl=sl;if(note)rs.note=note;try{await withTimeout(updateDoc(doc(X.db,"mkd",id),{rs,upd:Date.now()}));closeM();X.toast("✅ حُفظت النتائج")}catch(er){errM(errTxt(er))}}
function exForm(c,x){modal(`<h3>${x?"تعديل مصروف":"مصروف جديد"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>»</p>
 <div class="g3"><div><label class="l" for="mk-xk">البند</label><select id="mk-xk">${XK.filter(k=>k[0]!=="inf").map(k=>`<option value="${k[0]}"${x&&x.k===k[0]?" selected":""}>${k[1]}</option>`).join("")}</select></div><div><label class="l" for="mk-xa">المبلغ (ريال)</label><input id="mk-xa" inputmode="decimal" dir="ltr" value="${x?E(x.a):""}"></div><div><label class="l" for="mk-xd">التاريخ</label><input id="mk-xd" type="date" value="${E(x?x.dt:today())}"></div></div>
 <label class="l" for="mk-xn">البيان</label><input id="mk-xn" maxlength="200" value="${x?E(x.nt||""):""}" placeholder="مثال: إعلان ممول على إنستغرام أسبوع"><div class="err" id="mk-err"></div>
 <div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="xsave" data-mki="${x?E(x.id):""}">حفظ</button></div>`,"ex",c.id);setTimeout(()=>{const f=g("mk-xa");if(f)f.focus()},60)}
async function exSave(xid){if(BUSY)return;const c=C.get(g("mkm").dataset.mki);if(!c)return;const old=xid?XS.get(xid):null,a=num(g("mk-xa").value),dt=g("mk-xd").value,nt=String(g("mk-xn").value||"").trim().slice(0,200);
 if(isNaN(a)||a<=0)return errM("اكتب المبلغ");if(!dt)return errM("اختر التاريخ");const d={c:c.id,k:g("mk-xk").value,a,dt,by:old?old.by:{e:me(),n:myN()},ts:old?old.ts:Date.now()};if(nt)d.nt=nt;if(old)d.upd=Date.now();BUSY=true;
 try{await withTimeout(setDoc(doc(X.db,"mkx",xid||nid()),d));closeM();X.toast("✅ حُفظ المصروف")}catch(e){BUSY=false;errM(errTxt(e))}}
function kpForm(c){modal(`<h3>📈 النتائج الفعلية</h3><p class="sub">اكتب ما تحقق حتى الآن لكل هدف (من تقارير المنصات والسيستم).</p>
 ${kpOf(c).map((k,i)=>`<label class="l" for="mk-kv${i}">${E(kpName(k))} <small class="off">(المستهدف ${money(k.t)})</small></label><input id="mk-kv${i}" data-kv="${i}" inputmode="decimal" dir="ltr" value="${k.v!=null?E(k.v):""}">`).join("")}
 <div class="err" id="mk-err"></div><div class="row"><button type="button" class="b" data-mkq="mx">إلغاء</button><button type="button" class="b p" data-mkq="kpsave">حفظ</button></div>`,"kp",c.id)}
async function kpSave(){const c=C.get(g("mkm").dataset.mki);if(!c)return;let bad=false;const kp=kpOf(c).map((k,i)=>{const o={k:k.k,t:k.t};if(k.l!=null)o.l=k.l;const raw=g("mk-kv"+i).value,v=num(raw);if(isNaN(v))bad=true;else if(String(raw).trim()!=="")o.v=v;return o});
 if(bad)return errM("أرقام غير صحيحة");try{await withTimeout(updateDoc(doc(X.db,"mkc",c.id),{kp,upd:Date.now()}));closeM();X.toast("✅ حُفظت النتائج")}catch(e){errM(errTxt(e))}}
async function campSt(st){const c=C.get(S.c);if(!c||BUSY)return;if(st==="x"&&!confirm("إلغاء الحملة؟ تبقى بياناتها للرجوع إليها."))return;if(st==="done"&&!confirm("إنهاء الحملة؟ سجّل النتائج الفعلية أولاً لتظهر في التقرير."))return;
 BUSY=true;try{await withTimeout(updateDoc(doc(X.db,"mkc",c.id),{st,upd:Date.now()}));BUSY=false;X.toast(st==="live"?"▶ بدأت الحملة":st==="done"?"🏁 انتهت الحملة":"أُلغيت الحملة")}catch(e){BUSY=false;X.toast(errTxt(e),"er")}}
async function campDel(){const c=C.get(S.c);if(!c)return;const nT=tasksOf(c.id).length,nD=dealsOf(c.id).filter(d=>d.st==="ok"||d.st==="paid").length;
 if(nD){X.toast("لا يمكن حذف حملة فيها اتفاقات معتمدة. ألغِها بدلاً من الحذف","er");return}if(!confirm(`حذف الحملة «${c.n}» نهائياً${nT?" مع "+nT+" مهام":""}؟ لا يمكن التراجع.`))return;
 try{const b=writeBatch(X.db);tasksOf(c.id).forEach(x=>b.delete(doc(X.db,"mkt",x.id)));exOf(c.id).forEach(x=>b.delete(doc(X.db,"mkx",x.id)));dealsOf(c.id).forEach(d=>{b.delete(doc(X.db,"mkdi",d.id));b.delete(doc(X.db,"mkd",d.id))});b.delete(doc(X.db,"mkc",c.id));await withTimeout(b.commit());S.c="";X.toast("حُذفت الحملة");if(X.redraw)X.redraw()}catch(e){X.toast(errTxt(e),"er")}}
function csv(c){const s=spend(c.id),q=v=>{v=String(v==null?"":v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'},R=[["التاريخ","البند","البيان","المبلغ","سجّله"]];
 dealsOf(c.id).filter(d=>d.st==="ok"||d.st==="paid").forEach(d=>R.push([d.dt||"","المؤثرون","مؤثر: "+d.n+" · "+(DST[d.st]||""),N(d.amt),d.by&&d.by.n]));exOf(c.id).forEach(x=>R.push([x.dt,lab(XK,x.k),x.nt||"",N(x.a),x.by&&x.by.n]));R.push(["","","الإجمالي",s.tot,""]);R.push(["","","الميزانية",N(c.bud),""]);
 const b=new Blob(["﻿"+R.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="tasooma-campaign-"+c.from+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
// 🖨 تقرير الحملة الكامل
function printRep(c){
 const s=spend(c.id),ts=tkStat(c.id),kps=kpOf(c),Ls=dealsOf(c.id).filter(d=>d.st!=="x"),bud=N(c.bud);let p=g("mkpr");if(!p){p=document.createElement("div");p.id="mkpr";document.body.appendChild(p)}
 p.innerHTML=`<h1>تقرير حملة: <span data-notr>${E(c.n)}</span></h1><p>${E(CST[c.st]||"")} · <bdi dir="ltr">${E(dmy(c.from))}</bdi> ← <bdi dir="ltr">${E(dmy(c.to))}</bdi> · القنوات: ${(c.ch||[]).map(x=>E(lab(CH,x))).join("، ")||"—"}</p>${c.gl?`<p data-notr>الهدف: ${E(c.gl)}</p>`:""}
 <div class="kv"><div><small>الميزانية</small><b>${money(bud)}</b></div><div><small>المصروف</small><b>${money(s.tot)} (${pct(s.tot,bud)}%)</b></div><div><small>المتبقي</small><b>${money(bud-s.tot)}</b></div><div><small>المهام المنجزة</small><b>${ts.done}/${ts.n}</b></div></div>
 <h2>الأهداف</h2>${kps.length?`<table><tr><th>الهدف</th><th>المستهدف</th><th>المتحقق</th><th>النسبة</th></tr>${kps.map(k=>`<tr><td>${E(kpName(k))}</td><td>${money(k.t)}</td><td>${money(k.v)}</td><td>${pct(N(k.v),N(k.t))}%</td></tr>`).join("")}</table>`:"<p>—</p>"}
 <h2>المصروف حسب البند</h2><table><tr><th>البند</th><th>المبلغ</th><th>النسبة</th></tr>${XK.filter(k=>s.by[k[0]]>0).map(k=>`<tr><td>${E(k[1])}</td><td>${money(s.by[k[0]])}</td><td>${pct(s.by[k[0]],s.tot)}%</td></tr>`).join("")||"<tr><td colspan=3>—</td></tr>"}</table>
 <h2>المؤثرون</h2>${Ls.length?`<table><tr><th>المؤثر</th><th>المنصة</th><th>المطلوب</th><th>المبلغ</th><th>الحالة</th><th>المشاهدات</th><th>ريال/1000 مشاهدة</th></tr>${Ls.map(d=>`<tr><td data-notr>${E(d.n)}</td><td>${E(lab(PF,d.pf))}</td><td data-notr>${E(d.dl)}</td><td>${money(d.amt)}</td><td>${E(DST[d.st]||"")}</td><td>${d.rs&&d.rs.v?money(d.rs.v):"—"}</td><td>${d.rs&&N(d.rs.v)?(N(d.amt)/N(d.rs.v)*1000).toFixed(1):"—"}</td></tr>`).join("")}</table>`:"<p>—</p>"}
 <h2>المهام</h2><table><tr><th>الدور</th><th>المهمة</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th></tr>${tasksOf(c.id).map(x=>`<tr><td>${E(rl(x.r)[2])}</td><td data-notr>${E(x.t)}</td><td data-notr>${E(nameOf(x.as))}</td><td>${E(dmy(x.du))}</td><td>${E(TST[x.st]||"")}</td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>"}</table>
 <h2>الخلاصة</h2>${insights(c).map(x=>`<p>• ${E(x[1])}</p>`).join("")}<p style="margin-top:14px;color:#666">طُبع من منصة تاسومة · ${E(dmy(today()))}</p>`;
 document.body.classList.add("mkpr");const done=()=>{document.body.classList.remove("mkpr");window.removeEventListener("afterprint",done)};window.addEventListener("afterprint",done);setTimeout(()=>{try{window.print()}catch(e){}setTimeout(done,1500)},60);
}
// ---------- الأحداث ----------
function onClick(e){
 if(!X)return;const ck=e.target.closest("[data-mkq]");if(!ck)return;if(!ck.closest(".mkp,#mkm"))return;
 const a=ck.dataset.mkq,i=ck.dataset.mki,c=C.get(S.c);
 if(a==="new"){campForm(null);return}if(a==="f"){S.f=ck.dataset.mkf;X.redraw();return}if(a==="vw"){S.vw=ck.dataset.mkv;X.redraw();return}
 if(a==="open"){S.c=i;S.sub=ck.dataset.mks||"ov";window.scrollTo(0,0);X.redraw();return}if(a==="back"){S.c="";X.redraw();return}if(a==="sub"){S.sub=ck.dataset.mks;X.redraw();return}
 if(a==="mx"){closeM();return}if(a==="kadd"){const k=g("mk-kps");if(k&&k.children.length<8)k.insertAdjacentHTML("beforeend",kpRow({k:"views",t:""}));return}if(a==="krm"){const r=ck.closest("[data-kr]");if(r)r.remove();return}
 if(a==="csave"){campSave();return}if(a==="cedit"&&c){campForm(c);return}if(a==="cst"){campSt(ck.dataset.mks);return}if(a==="cdel"){campDel();return}if(a==="prn"&&c){printRep(c);return}
 if(a==="tnew"&&c){taskForm(c,null);return}if(a==="tedit"){const x=T.get(i);if(x&&C.get(x.c))taskForm(C.get(x.c),x);return}if(a==="tsave"){taskSave(i);return}
 if(a==="tdel"){if(confirm("حذف المهمة؟")){deleteDoc(doc(X.db,"mkt",i)).then(()=>{closeM();X.toast("حُذفت المهمة")}).catch(er=>errM(errTxt(er)))}return}
 if(a==="tpl"&&c){tplForm(c);return}if(a==="tplsave"){tplSave();return}if(a==="tst"){taskSt(i,ck.dataset.mks);return}if(a==="trs"){const x=T.get(i);if(x)resForm(x);return}if(a==="trsave"){resSave(i);return}
 if(a==="dnew"&&c){dealForm(c,null);return}if(a==="dedit"){const d=D.get(i);if(d&&C.get(d.c))dealForm(C.get(d.c),d);return}if(a==="dsave"){dealSave(i);return}
 if(a==="dok"){dealOk(i);return}if(a==="dno"){reasonForm(i,"no");return}if(a==="dx"){reasonForm(i,"x");return}if(a==="whysave"){whySave(i,ck.dataset.mkk);return}
 if(a==="ddel"){const d=D.get(i);if(d&&confirm(`حذف الاتفاق مع ${d.n}؟`)){const b=writeBatch(X.db);b.delete(doc(X.db,"mkdi",i));b.delete(doc(X.db,"mkd",i));b.commit().then(()=>X.toast("حُذف الاتفاق")).catch(er=>X.toast(errTxt(er),"er"))}return}
 if(a==="pay"){payForm(i);return}if(a==="paysave"){paySave(i);return}if(a==="ibv"){ibView(i);return}
 if(a==="ibcp"){const v=ck.dataset.mkv;try{navigator.clipboard.writeText(v).then(()=>X.toast("نُسخ الآيبان"),()=>X.toast(v))}catch(er){X.toast(v)}return}
 if(a==="dres"){const d=D.get(i);if(d)dresForm(d);return}if(a==="drsave"){dresSave(i);return}
 if(a==="xnew"&&c){exForm(c,null);return}if(a==="xedit"){const x=XS.get(i);if(x&&C.get(x.c))exForm(C.get(x.c),x);return}if(a==="xsave"){exSave(i);return}
 if(a==="xdel"){if(confirm("حذف المصروف؟"))deleteDoc(doc(X.db,"mkx",i)).then(()=>X.toast("حُذف المصروف")).catch(er=>X.toast(errTxt(er),"er"));return}
 if(a==="kpe"&&c){kpForm(c);return}if(a==="kpsave"){kpSave();return}if(a==="csv"&&c){csv(c);return}
}
function onChange(e){if(!X)return;const t=e.target;
 if(t.matches&&t.matches("[data-mkcl]")){taskCl(t.dataset.mkcl,+t.dataset.mkk,t.checked);return}
 if(t.matches&&t.matches("#mkm [data-kk]")){const r=t.closest("[data-kr]"),l=r&&r.querySelector("[data-kl]");if(l)l.style.display=t.value==="oth"?"":"none"}}
function onInput(e){if(!X)return;const t=e.target;if(t.id==="mk-ib"){ibHint();return}
 if(t.id==="mk-pq"){const q=String(t.value||"").trim();document.querySelectorAll("#mk-ppl [data-pn]").forEach(l=>{l.style.display=!q||l.dataset.pn.indexOf(q)>=0?"":"none"})}}
