// ✅ المهام والتذكيرات (v243، 25 نوفمبر 2026، طلب محمد: «مديول مهام وتذكيرات قوي لفريق المستودع والإدارة»).
//   الفكرة (قاعدة مهام بخصائص وعروض متعددة) مأخوذة كوظائف عامة معروفة، والكود والشكل من المنصة نفسها بثوبها.
//   tasks/{id} = {t, d?, by:{e,n}, ts, upd?, as:[بريد], tm?, du?, ad?, rm?:[دقائق], nx?, rp?: d|w|m, pr: 0..3, st: todo|doing|done,
//                 tg?:[وسم], cl?:[{t,k}], ln?:{k,v,l}, dn?:{e,n,at}, dt?, ld?:{e,n,at}, rc?}
//   tasks/{id}/cm/{رقم} = {t, by:{e,n}, ts} · tasks/{id}/x/{2..10} مرفقات (att.js). القواعد في 002_rules.sql (v243)، والتذكير من السيرفر كل 5 دقائق (taskRemind).
import {collection,doc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,deleteField} from "./fb.js";
import {multiPick,putAtt,loadAtts,dropAtt} from "./att.js";
import {zoomGallery} from "./zoom.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number.isFinite(+v)?+v:0;
const g=id=>document.getElementById(id);
const DAY=864e5,DONE_DAYS=30;
const RMS=[[0,"عند الموعد"],[5,"قبل 5 دقائق"],[15,"قبل 15 دقيقة"],[30,"قبل 30 دقيقة"],[60,"قبل ساعة"],[120,"قبل ساعتين"],[1440,"قبل يوم"],[2880,"قبل يومين"]];
const PRS=[[0,"بلا"],[1,"منخفضة"],[2,"متوسطة"],[3,"عالية"]];
const STS=[["todo","لم تبدأ"],["doing","جارية"],["done","منتهية"]];
const RPS=[["","لا تتكرر"],["d","يومياً"],["w","أسبوعياً"],["m","شهرياً"]];
const LNK=[["","بلا ربط"],["req","طلب فرع"],["br","فرع"],["po","أمر شراء"]];
const WD=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MN=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const LISTS=[["today","اليوم","☀"],["up","المجدولة","📅"],["late","المتأخرة","⏰"],["mine","مهامي","👤"],["all","الكل","☰"],["done","المنتهية","✓"]];
let X=null,UN=[],OPN=new Map(),DNE=new Map(),DIR=new Map(),LOADED=false,V=null,F=null,PICK=null,BUSY=false,CMUN=null,CMS=[],ATT=[],PEND="",TIMER=0;
// ---------- التاريخ ----------
const sod=t=>{const d=new Date(N(t));d.setHours(0,0,0,0);return d.getTime()};
const eod=t=>sod(t)+DAY-1;
const z2=n=>(n<10?"0":"")+n;
const ymd=t=>{const d=new Date(N(t));return d.getFullYear()+"-"+z2(d.getMonth()+1)+"-"+z2(d.getDate())};
const hhmm=t=>{const d=new Date(N(t));return z2(d.getHours())+":"+z2(d.getMinutes())};
const EN=()=>document.documentElement.lang==="en";
const t12=t=>{const d=new Date(N(t)),h=d.getHours(),m=d.getMinutes();return (h%12||12)+(m?":"+z2(m):"")+" "+(EN()?(h<12?"am":"pm"):(h<12?"ص":"م"))};
function dayLbl(t){
 const d0=sod(Date.now()),d=sod(t),k=Math.round((d-d0)/DAY),x=new Date(N(t));
 if(k===0)return "اليوم";if(k===1)return "غداً";if(k===-1)return "أمس";
 if(k>1&&k<7)return WD[x.getDay()];
 return x.getDate()+" "+MN[x.getMonth()]+(x.getFullYear()!==new Date().getFullYear()?" "+x.getFullYear():"");
}
const dueTxt=t=>!N(t.du)?"":dayLbl(t.du)+(t.ad?"":" · "+t12(t.du));
const isLate=t=>t.st!=="done"&&N(t.du)>0&&(t.ad?eod(t.du):N(t.du))<Date.now();
// الموعد التالي للمكررة: من الموعد الحالي بخطوة، لحد ما يبقى بعد دلوقتي
function roll(du,rp){
 const d=new Date(N(du)),now=Date.now();let k=0;
 do{if(rp==="d")d.setDate(d.getDate()+1);else if(rp==="w")d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1);k++}while(d.getTime()<=now&&k<800);
 return d.getTime();
}
// وقت التذكير القادم (السيرفر بيرسله ويقدّمه للي بعده)
export function nextNx(t,now){
 now=now||Date.now();if(t.st==="done"||!N(t.du))return 0;
 const L=(Array.isArray(t.rm)?t.rm:[]).map(N).map(m=>N(t.du)-m*6e4).filter(a=>a>now).sort((a,b)=>a-b);
 return L.length?L[0]:0;
}
// ---------- الإضافة السريعة: «اتصل بالمورد بكرة 10ص #موردين !! @أحمد» ----------
const AR_D=s=>String(s).replace(/[٠-٩]/g,c=>"٠١٢٣٤٥٦٧٨٩".indexOf(c));
export function parseQuick(s,dir,now){
 now=now||Date.now();let t=" "+AR_D(String(s||""))+" ",day=null,tm=null;const out={tg:[],as:[],pr:0};
 const cut=re=>{const m=re.exec(t);if(m){t=t.replace(m[0]," ")}return m};
 let m;
 while((m=/(^|\s)#([^\s#!@]{1,24})(?=\s)/.exec(t))){if(out.tg.indexOf(m[2])<0&&out.tg.length<6)out.tg.push(m[2]);t=t.replace(m[0]," ")}
 if((m=cut(/(^|\s)(!{1,3})(?=\s)/)))out.pr=m[2].length;
 while((m=/(^|\s)@([^\s@#!]{2,30})(?=\s)/.exec(t))){const k=m[2];let hit=null;(dir||[]).forEach(p=>{if(!hit&&String(p.n||"").replace(/\s+/g,"").indexOf(k)===0)hit=p});if(!hit)(dir||[]).forEach(p=>{if(!hit&&String(p.n||"").indexOf(k)>=0)hit=p});if(hit&&out.as.indexOf(hit.e)<0)out.as.push(hit.e);t=t.replace(m[0]," ")}
 const D0=sod(now);
 if(cut(/(^|\s)(بعد\s+(بكرة|بكره|بكرا|غد))(?=\s)/))day=D0+2*DAY;
 else if(cut(/(^|\s)(بكرة|بكره|بكرا|غدا|غداً|غدًا|الغد)(?=\s)/))day=D0+DAY;
 else if(cut(/(^|\s)(اليوم|النهارده|النهاردة|انهارده)(?=\s)/))day=D0;
 else if(cut(/(^|\s)(الأسبوع|الاسبوع)\s+(الجاي|القادم|اللي\s+جاي)(?=\s)/))day=D0+7*DAY;
 if(day==null){for(let i=0;i<7&&day==null;i++){const re=new RegExp("(^|\\s)(يوم\\s+)?(ال)?"+WD[i].replace(/^ال/,"")+"(?=\\s)");if(cut(re)){const cur=new Date(D0).getDay();let k=(i-cur+7)%7;if(k===0)k=7;day=D0+k*DAY}}}
 if(day==null&&(m=cut(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/))){const y=m[4]?(+m[4]<100?2000+ +m[4]:+m[4]):new Date(now).getFullYear();let d=new Date(y,+m[3]-1,+m[2]).getTime();if(!m[4]&&d<D0)d=new Date(y+1,+m[3]-1,+m[2]).getTime();day=d}
 // الوقت: «الساعة 3» أو «3م» أو «10:30 ص» أو «15:00»
 m=cut(/(^|\s)(?:الساعة|الساعه|ساعة)\s*(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحا|صباحاً|الصبح|مساء|مساءً|بالليل|العصر|الظهر|الضهر)?(?=\s)/)||cut(/(^|\s)(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحا|صباحاً|الصبح|مساء|مساءً|بالليل|العصر|الظهر|الضهر)(?=\s)/)||cut(/(^|\s)(\d{1,2}):(\d{2})()(?=\s)/);
 if(m){let h=+m[2];const mi=+(m[3]||0),sf=m[4]||"";if(h<=23&&mi<=59){const pm=/^(م|مساء|مساءً|بالليل|العصر)$/.test(sf)||(/^(الظهر|الضهر)$/.test(sf)&&h<5);if(pm&&h<12)h+=12;if(/^(ص|صباحا|صباحاً|الصبح)$/.test(sf)&&h===12)h=0;if(!sf&&!m[3]&&h>=1&&h<=7)h+=12;tm=h*60+mi}}
 if(tm!=null){if(day==null){day=D0;if(D0+tm*6e4<=now)day=D0+DAY}out.du=day+tm*6e4;out.ad=false}
 else if(day!=null){out.du=day+9*36e5;out.ad=true}
 out.t=t.replace(/\s+/g," ").trim().slice(0,140);
 return out;
}
// ---------- التنسيق ----------
const CSS=`
.tkx,#tkm{--tk-a:#8a5a83;--tk-o:#5d7a34;--tk-r:#b03a2e;--tk-w:#b36b1e;--tk-s:rgba(138,90,131,.08)}.tkx{display:block;max-width:1180px;margin:0 auto}
.tkx .b,#tkm .b{font:inherit;font-weight:700;font-size:14px;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:11px;padding:8px 16px;min-height:0;line-height:1.3;transition:transform .12s,box-shadow .12s}
.tkx .b:hover,#tkm .b:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}.tkx .b.p,#tkm .b.p{background:var(--tk-a);border-color:var(--tk-a);color:#fff}.tkx .b:disabled,#tkm .b:disabled{opacity:.55;cursor:default}
#tkm textarea,#tkm input,#tkm select{font:inherit}
.tkx-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}.tkx-hd h2{margin:0;flex:1;min-width:0;font-size:22px}
.tkx-seg{display:inline-flex;background:var(--tk-s);border-radius:11px;padding:3px;gap:2px}
.tkx-seg button{all:unset;cursor:pointer;padding:6px 14px;border-radius:9px;font-size:13.5px;font-weight:700;color:var(--mut);white-space:nowrap}
.tkx-seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.12)}
.tkx-add{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:6px 6px 6px 10px;margin:0 0 6px;box-shadow:0 2px 10px rgba(60,30,60,.05)}
.tkx-add:focus-within{border-color:var(--tk-a);box-shadow:0 0 0 3px rgba(138,90,131,.15)}
.tkx-add .pl{width:26px;height:26px;border-radius:50%;background:var(--tk-a);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}
.tkx-add input{flex:1;min-width:0;border:0!important;background:transparent!important;box-shadow:none!important;font-size:15px;padding:8px 2px!important;outline:0}
.tkx-add .b,.tkx-add .bt{min-height:0;padding:7px 14px;border-radius:11px}
.tkx-qp{min-height:22px;display:flex;gap:6px;flex-wrap:wrap;margin:0 4px 12px;font-size:12.5px;color:var(--mut)}
.tkx-qp span{background:var(--tk-s);color:var(--ink);border-radius:999px;padding:1px 9px}
.tkx-sl{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:0 0 12px}
.tkx-sl button{all:unset;cursor:pointer;box-sizing:border-box;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px 12px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;transition:transform .15s,box-shadow .15s}
.tkx-sl button:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(60,30,60,.08)}
.tkx-sl button.on{border-color:transparent;box-shadow:inset 0 0 0 2px var(--c)}
.tkx-sl i{grid-row:1/3;width:32px;height:32px;border-radius:50%;background:var(--c);color:#fff;font-style:normal;display:flex;align-items:center;justify-content:center;font-size:15px}
.tkx-sl b{font-size:22px;font-weight:800;line-height:1.1;text-align:end;font-variant-numeric:tabular-nums}
.tkx-sl span{font-size:12.5px;color:var(--mut);font-weight:700;grid-column:1/3;margin-top:4px}
.tkx-sv{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px}
.tkx-sv .tkch{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:3px 4px 3px 10px;font-size:12.5px}
.tkx-sv .tkch button{all:unset;cursor:pointer}.tkx-sv .tkch .x{color:var(--mut);padding:0 5px}
.tkx-sv .tkch.on{border-color:var(--tk-a);background:var(--tk-s)}
.tkx-f{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}
.tkx-f select,.tkx-f input{min-width:0;flex:0 1 auto;max-width:200px;padding:7px 10px;border-radius:10px}
.tkx-f input{flex:1 1 160px;max-width:none}
.tkx-f .clr{all:unset;cursor:pointer;color:var(--tk-a);font-size:13px;font-weight:700}
.tkx-g{margin:0 0 16px}.tkx-g h4{margin:0 0 6px;font-size:13px;color:var(--mut);font-weight:800;display:flex;gap:6px;align-items:center}
.tkx-g h4.late{color:var(--tk-r)}.tkx-g h4 b{background:var(--tk-s);color:var(--ink);border-radius:999px;padding:0 8px;font-size:12px}
.tkx-ls{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.tk-r{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);position:relative}
.tk-r:last-child{border-bottom:0}.tk-r:hover{background:var(--tk-s)}
.tk-c{all:unset;cursor:pointer;flex:0 0 auto;width:20px;height:20px;border-radius:50%;border:2px solid var(--pc,#b9aab6);margin-top:1px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;transition:background .15s,transform .15s}
.tk-c:hover{transform:scale(1.08)}.tk-c::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--pc,#b9aab6);transform:scale(0);transition:transform .15s}
.tk-c:hover::after{transform:scale(1)}.tk-r.done .tk-c{background:var(--pc,var(--tk-a));border-color:var(--pc,var(--tk-a))}
.tk-r.done .tk-c::after{content:"✓";background:none;color:#fff;font-size:12px;font-weight:900;width:auto;height:auto;transform:none}
.tk-r.p1{--pc:var(--tk-a)}.tk-r.p2{--pc:var(--tk-w)}.tk-r.p3{--pc:var(--tk-r)}
.tk-b{all:unset;cursor:pointer;flex:1;min-width:0;display:block}
.tk-t{font-size:15px;font-weight:600;line-height:1.35;word-break:break-word}.tk-t .pr{color:var(--pc);font-weight:900;margin-inline-end:4px}
.tk-r.done .tk-t{color:var(--mut);text-decoration:line-through;text-decoration-color:rgba(0,0,0,.25)}
.tk-m{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:3px;font-size:12.5px;color:var(--mut);align-items:center}
.tk-m .du.late{color:var(--tk-r);font-weight:800}.tk-m .du.today{color:var(--tk-a);font-weight:800}
.tk-m .tktg{color:var(--tk-o);font-weight:700}.tk-m .ln{background:var(--tk-s);border-radius:6px;padding:0 6px;color:var(--ink)}
.tk-av{display:inline-flex}.tk-av span{width:22px;height:22px;border-radius:50%;background:#e8dbe5;color:#5b3756;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;border:2px solid var(--card);margin-inline-start:-6px}
.tk-av span:first-child{margin-inline-start:0}.tk-av span.tm{background:#e3ead8;color:#3f5a20}
.tk-sx{flex:0 0 auto;font-size:11.5px;font-weight:800;border-radius:999px;padding:2px 9px;background:#fff1dc;color:#8a5212;align-self:center}
.tkx-e{padding:28px 14px;text-align:center;color:var(--mut);background:var(--card);border:1px dashed var(--line);border-radius:16px}
.tkx-e b{display:block;font-size:30px;margin-bottom:6px;color:var(--tk-o)}
.tkx-bd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}
.tkx-col{background:var(--tk-s);border-radius:16px;padding:10px;min-height:160px;transition:box-shadow .15s}
.tkx-col.tkov{box-shadow:inset 0 0 0 2px var(--tk-a)}
.tkx-col h4{margin:2px 4px 10px;font-size:13.5px;display:flex;gap:6px;align-items:center}.tkx-col h4 b{background:var(--card);border-radius:999px;padding:0 8px;font-size:12px}
.tkx-col h4 i{width:9px;height:9px;border-radius:50%;background:var(--c)}
.tk-k{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:10px 11px;margin:0 0 8px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.tk-k:active{cursor:grabbing}.tk-k.p3{border-inline-start:3px solid var(--tk-r)}.tk-k.p2{border-inline-start:3px solid var(--tk-w)}.tk-k.p1{border-inline-start:3px solid var(--tk-a)}
.tk-k .tk-t{font-size:14px}.tk-k .mv{display:none;gap:4px;margin-top:8px}.tk-k .mv button{all:unset;cursor:pointer;font-size:12px;font-weight:700;border:1px solid var(--line);border-radius:8px;padding:2px 8px}
.tkx-cal{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.tkx-ch{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line)}.tkx-ch h4{margin:0;flex:1;font-size:16px}
.tkx-ch button{all:unset;cursor:pointer;padding:4px 10px;border-radius:8px;font-weight:700}.tkx-ch button:hover{background:var(--tk-s)}
.tkx-cg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.tkx-cg .wd{font-size:11.5px;color:var(--mut);font-weight:800;text-align:center;padding:6px 0;border-bottom:1px solid var(--line)}
.tkx-cg .dy{all:unset;cursor:pointer;box-sizing:border-box;min-height:86px;padding:4px 5px;border-inline-end:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px;overflow:hidden}
.tkx-cg .dy:nth-child(7n+7){border-inline-end:0}.tkx-cg .dy.out{opacity:.45}.tkx-cg .dy:hover{background:var(--tk-s)}
.tkx-cg .dy.sel{box-shadow:inset 0 0 0 2px var(--tk-a)}
.tkx-cg .dy u{text-decoration:none;font-size:12.5px;font-weight:800;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.tkx-cg .dy.td u{background:var(--tk-a);color:#fff}
.tkx-cg .dy s{text-decoration:none;font-size:11.5px;line-height:1.3;background:var(--tk-s);border-radius:5px;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-inline-start:2px solid var(--pc,var(--tk-a))}
.tkx-cg .dy s.done{opacity:.55;text-decoration:line-through}.tkx-cg .dy s.p2{--pc:var(--tk-w)}.tkx-cg .dy s.p3{--pc:var(--tk-r)}
.tkx-cg .dy em{font-style:normal;font-size:11px;color:var(--mut)}
.tkx-cd{margin-top:14px}
#tkm{position:fixed;inset:0;z-index:79;display:none;align-items:center;justify-content:center;background:rgba(20,12,20,.45);padding:16px}
#tkm.on{display:flex}#tkm>div{background:var(--card);color:var(--ink);border-radius:20px;width:min(640px,100%);max-height:92vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.3);box-sizing:border-box;padding:16px 18px}
#tkm .tp{display:flex;gap:10px;align-items:center;margin:0 0 6px}
#tkm .tp input{flex:1;min-width:0;font-size:19px;font-weight:700;border:0!important;background:transparent!important;box-shadow:none!important;padding:6px 2px!important;outline:0}
#tkm .tp .x{all:unset;cursor:pointer;font-size:22px;color:var(--mut);padding:0 6px}
#tkm .tp .tk-c{width:24px;height:24px}
#tkm textarea,#tkm input,#tkm select{box-sizing:border-box}
#tkm .tknt{width:100%;border:0!important;background:var(--tk-s)!important;border-radius:12px;padding:9px 11px!important;font-size:14px;resize:vertical;box-shadow:none!important}
#tkm .sx{border:1px solid var(--line);border-radius:14px;margin:10px 0 0;overflow:hidden}
#tkm .sx>div{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}#tkm .sx>div:last-child{border-bottom:0}
#tkm .sx label.k{flex:0 0 104px;font-size:13px;color:var(--mut);font-weight:700;display:flex;gap:6px;align-items:center}
#tkm .sx .v{flex:1;min-width:0;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#tkm .sx input[type=date],#tkm .sx input[type=time]{width:auto;padding:5px 8px;border-radius:9px}
#tkm .sx select{width:auto;max-width:100%;padding:5px 8px;border-radius:9px}
#tkm .pp{all:unset;cursor:pointer;font-size:12.5px;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:3px 10px;white-space:nowrap}
#tkm .pp.on{background:var(--tk-a);border-color:var(--tk-a);color:#fff}#tkm .pp:disabled,#tkm .pp[aria-disabled=true]{opacity:.5;cursor:default}
#tkm .pp.p1.on{background:var(--tk-a)}#tkm .pp.p2.on{background:var(--tk-w);border-color:var(--tk-w)}#tkm .pp.p3.on{background:var(--tk-r);border-color:var(--tk-r)}
#tkm .ck{display:inline-flex;gap:6px;align-items:center;font-size:13px}#tkm .ck input{width:auto}
#tkm .who{display:inline-flex;align-items:center;gap:4px;background:var(--tk-s);border-radius:999px;padding:2px 4px 2px 10px;font-size:12.5px;font-weight:700}
#tkm .who button{all:unset;cursor:pointer;color:var(--mut);padding:0 4px}
#tkm .tkcl{display:flex;gap:8px;align-items:center;width:100%}#tkm .tkcl input[type=checkbox]{width:18px;height:18px;flex:0 0 auto}
#tkm .tkcl input[type=text]{flex:1;min-width:0;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:4px 2px!important}
#tkm .tkcl.k input[type=text]{color:var(--mut);text-decoration:line-through}#tkm .tkcl button{all:unset;cursor:pointer;color:var(--mut);padding:0 6px}
#tkm .clb{width:100%}#tkm .clb .tkbar{height:5px;border-radius:9px;background:var(--tk-s);overflow:hidden;margin:2px 0 6px}#tkm .clb .tkbar i{display:block;height:100%;background:var(--tk-o);transition:width .25s}
#tkm .h{font-size:12px;color:var(--mut);margin:0;width:100%}
#tkm .ax{display:flex;gap:8px;flex-wrap:wrap;width:100%}#tkm .ax button{all:unset;cursor:pointer;position:relative;width:72px;height:72px;border-radius:10px;overflow:hidden;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;text-align:center;background:var(--tk-s)}
#tkm .ax img{width:100%;height:100%;object-fit:cover}#tkm .ax .dl{position:absolute;top:2px;inset-inline-end:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:18px;text-align:center}
#tkm .tkcms{width:100%;display:flex;flex-direction:column;gap:8px}
#tkm .tkcm{background:var(--tk-s);border-radius:12px;padding:7px 10px;font-size:13.5px}#tkm .tkcm small{display:flex;gap:6px;color:var(--mut);font-size:11.5px;margin-bottom:2px}#tkm .tkcm small button{all:unset;cursor:pointer;margin-inline-start:auto}
#tkm .tkcm p{margin:0;white-space:pre-wrap;word-break:break-word}#tkm .tkcmw{display:flex;gap:6px;width:100%}#tkm .tkcmw textarea{flex:1;min-width:0;border-radius:12px;padding:8px 10px;resize:none}
#tkm .mt{font-size:12px;color:var(--mut);margin:12px 2px 0}
#tkm .ft{display:flex;gap:8px;align-items:center;margin-top:14px;position:sticky;bottom:-16px;background:var(--card);padding:10px 0 2px}
#tkm .ft .sp{flex:1}#tkm .ft .del{color:var(--tk-r)}
[data-theme=dark] .tkx,[data-theme=dark] #tkm{--tk-s:rgba(214,176,208,.1)}[data-theme=dark] .tk-sx{background:#4a3519;color:#f2d1a0}
[data-theme=dark] .tk-av span{background:#4b3247;color:#f1d9ec;border-color:var(--card)}[data-theme=dark] .tk-av span.tm{background:#33402a;color:#d4e4bf}
[data-theme=dark] .tk-r.done .tk-t{text-decoration-color:rgba(255,255,255,.3)}
@media (max-width:1024px){.tkx-sl{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){
 .tkx-hd h2{font-size:19px;flex-basis:100%}.tkx-sl{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.tkx-sl button{padding:8px 9px;border-radius:14px}
 .tkx-sl i{width:26px;height:26px;font-size:13px}.tkx-sl b{font-size:18px}.tkx-sl span{font-size:12px;margin-top:2px}.tkx-qp{min-height:0}
 .tkx-add [data-tk=new]{display:none}.tkx-f select{flex:1 1 30%;max-width:none}
 .tkx-bd{grid-template-columns:1fr}.tk-k{cursor:default}.tk-k .mv{display:flex}
 .tkx-cg .dy{min-height:56px;padding:3px}.tkx-cg .dy s{font-size:0;height:5px;padding:0;border-radius:3px;border:0;background:var(--pc,var(--tk-a))}.tkx-cg .dy s.done{opacity:.35}
 #tkm{padding:0;align-items:flex-end}#tkm>div{width:100%;max-height:94vh;border-radius:20px 20px 0 0}
 #tkm .sx label.k{flex-basis:100%}
}
@media print{.tkx-add,.tkx-qp,.tkx-sv,.tkx-f,.tkx-seg,.tk-c{display:none!important}}
`;
const css=()=>{if(!g("tkx-css")){const s=document.createElement("style");s.id="tkx-css";s.textContent=CSS;document.head.appendChild(s)}};
// ---------- البيانات ----------
const me=()=>X&&X.me?X.me.e:"";
const asOf=t=>(Array.isArray(t.as)?t.as:[]).map(e=>String(e).toLowerCase());
const mine=t=>{const a=asOf(t);return a.indexOf(me())>=0||(!a.length&&String(t.by&&t.by.e||"").toLowerCase()===me())};
// 🔒 (v247) خاصة: من أنشأها ومن أُسندت إليه فقط (حتى الأدمن ومالك النظام لا يرون مهام غيرهم)
const canSee=t=>String(t.by&&t.by.e||"").toLowerCase()===me()||asOf(t).indexOf(me())>=0;
const canEdit=t=>!t||String(t.by&&t.by.e||"").toLowerCase()===me();
const canAct=t=>canEdit(t)||asOf(t).indexOf(me())>=0;
const nameOf=e=>{e=String(e||"").toLowerCase();if(e===me())return X.me.n||"أنا";const d=DIR.get(e);return d?d.n:e.split("@")[0]};
const ini=s=>{s=String(s||"").trim();return s?s.charAt(0):"؟"};
function all(){const m=new Map();DNE.forEach((v,k)=>m.set(k,v));OPN.forEach((v,k)=>m.set(k,v));return [...m.values()].filter(canSee)}
const pg=ids=>{try{if(X&&X.ping&&ids&&ids.length)X.ping(ids)}catch(e){}};
const gid=()=>{const a="abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";const r=new Uint8Array(20);crypto.getRandomValues(r);r.forEach(b=>s+=a[b%a.length]);return s};
const vKey=()=>"tz_tk_v_"+me(),svKey=()=>"tz_tk_sv_"+me();
const loadV=()=>{let v={};try{v=JSON.parse(localStorage.getItem(vKey())||"{}")||{}}catch(e){}const d=new Date();return {l:v.l||"today",mode:v.mode||"list",who:v.who||"",tag:v.tag||"",pr:v.pr||"",q:"",cy:d.getFullYear(),cm:d.getMonth(),sel:ymd(Date.now())}};
const saveV=()=>{try{localStorage.setItem(vKey(),JSON.stringify({l:V.l,mode:V.mode,who:V.who,tag:V.tag,pr:V.pr}))}catch(e){}};
const getSV=()=>{try{const a=JSON.parse(localStorage.getItem(svKey())||"[]");return Array.isArray(a)?a.slice(0,8):[]}catch(e){return []}};
const setSV=a=>{try{localStorage.setItem(svKey(),JSON.stringify(a.slice(0,8)))}catch(e){}};
// ctx: {db, toast, me:{e,n}, owner:bool, ping:(ids)=>void, branches:()=>[...], redraw:()=>void}
export function initTasks(ctx){
 stopTasks();X=ctx;X.me={e:String(ctx.me&&ctx.me.e||"").toLowerCase(),n:String(ctx.me&&ctx.me.n||"").slice(0,60)};V=loadV();css();
 document.addEventListener("click",onClick);document.addEventListener("input",onInput);document.addEventListener("change",onChange);document.addEventListener("keydown",onKey);
 document.addEventListener("dragstart",onDrag);document.addEventListener("dragover",onOver);document.addEventListener("dragleave",onLeave);document.addEventListener("drop",onDrop);
 const err=()=>{if(X)X.toast("تعذّرت قراءة المهام. ربما لم تتحدّث القواعد بعد","er")};
 UN.push(onSnapshot(query(collection(X.db,"tasks"),where("st","in",["todo","doing"])),s=>{OPN=new Map();LOADED=true;s.docs.forEach(d=>OPN.set(d.id,Object.assign({id:d.id},d.data())));paint()},err));
 UN.push(onSnapshot(query(collection(X.db,"tasks"),where("dt",">=",Date.now()-DONE_DAYS*DAY)),s=>{DNE=new Map();s.docs.forEach(d=>{const v=d.data();if(v.st==="done")DNE.set(d.id,Object.assign({id:d.id},v))});paint()},()=>{}));
 UN.push(onSnapshot(collection(X.db,"whdir"),s=>{DIR=new Map();s.docs.forEach(d=>{const v=d.data()||{};if(v.n)DIR.set(String(d.id).toLowerCase(),{e:String(d.id).toLowerCase(),n:String(v.n)})});paint()},()=>{}));
 TIMER=setInterval(()=>{if(X&&X.tab&&X.tab()==="tk"&&!document.hidden&&!(g("tkm")&&g("tkm").classList.contains("on")))paint()},60e3);// «متأخرة» بتتحدّث مع الوقت
}
export function stopTasks(){UN.forEach(f=>{try{f()}catch(e){}});UN=[];if(CMUN){try{CMUN()}catch(e){}CMUN=null}clearInterval(TIMER);OPN=new Map();DNE=new Map();DIR=new Map();LOADED=false;F=null;PEND="";
 document.removeEventListener("click",onClick);document.removeEventListener("input",onInput);document.removeEventListener("change",onChange);document.removeEventListener("keydown",onKey);
 document.removeEventListener("dragstart",onDrag);document.removeEventListener("dragover",onOver);document.removeEventListener("dragleave",onLeave);document.removeEventListener("drop",onDrop);
 const m=g("tkm");if(m)m.remove();X=null}
function paint(){if(!X)return;if(PEND&&LOADED){const id=PEND;PEND="";const t=all().find(x=>x.id===id);if(t)openTask(id);else X.toast("المهمة غير موجودة أو ليست من مهامك","er")}if(X.redraw)X.redraw();if(F&&F.id)liveForm()}
// العدد في القائمة الجانبية: مهامي المتأخرة أو اللي موعدها النهارده
export const tkCount=()=>{if(!X)return 0;const e=eod(Date.now());return all().filter(t=>t.st!=="done"&&mine(t)&&N(t.du)>0&&N(t.du)<=e).length};
// (v245) أرقام لمخططات المهام: مهامي (مسندة لي أو أنشأتها بلا مسؤول) والمهام التي أراها، والمنتهية آخر 30 يوماً
export function tkStats(){
 const z=()=>({todo:0,doing:0,done:0,late:0,today:0,pr:[0,0,0,0]});const R={mine:z(),all:z(),loaded:LOADED};if(!X)return R;const e=eod(Date.now());
 all().forEach(t=>{[R.all].concat(mine(t)?[R.mine]:[]).forEach(o=>{o[t.st==="doing"?"doing":t.st==="done"?"done":"todo"]++;if(t.st!=="done"){if(isLate(t))o.late++;else if(N(t.du)>0&&N(t.du)<=e)o.today++;const p=Math.max(0,Math.min(3,N(t.pr)));o.pr[p]++}})});
 return R}
export function tkOpen(id){if(!X||!/^[A-Za-z0-9_-]{1,64}$/.test(String(id||"")))return;if(LOADED&&all().some(t=>t.id===id))openTask(id);else PEND=id}
// ---------- العرض ----------
function inList(t,l){
 const done=t.st==="done";
 if(l==="done")return done;if(done)return false;
 if(l==="today")return N(t.du)>0&&N(t.du)<=eod(Date.now());
 if(l==="up")return N(t.du)>0;if(l==="late")return isLate(t);if(l==="mine")return mine(t);return true;
}
function filt(L){
 const q=String(V.q||"").trim().toLowerCase();
 return L.filter(t=>(!V.who||(V.who==="me"?mine(t):V.who==="none"?!asOf(t).length:asOf(t).indexOf(V.who)>=0))
  &&(!V.tag||(Array.isArray(t.tg)&&t.tg.indexOf(V.tag)>=0))&&(!V.pr||String(N(t.pr))===V.pr)
  &&(!q||(String(t.t||"")+" "+String(t.d||"")+" "+(t.tg||[]).join(" ")).toLowerCase().indexOf(q)>=0));
}
const sortT=(a,b)=>(isLate(b)-isLate(a))||((N(a.du)||9e15)-(N(b.du)||9e15))||(N(b.pr)-N(a.pr))||(N(a.ts)-N(b.ts));
function rowHtml(t){
 const done=t.st==="done",late=isLate(t),today=!late&&N(t.du)>0&&N(t.du)<=eod(Date.now()),a=asOf(t),cl=Array.isArray(t.cl)?t.cl:[],ck=cl.filter(c=>c.k).length;
 const lk=t.ln&&t.ln.k?`<span class="ln" data-notr>${t.ln.k==="req"?"📦":t.ln.k==="br"?"🏬":"🚢"} ${E(t.ln.l||t.ln.v)}</span>`:"";
 const av=a.length?`<span class="tk-av" data-notr title="${E(a.map(nameOf).join("، "))}">${a.slice(0,3).map(e=>`<span>${E(ini(nameOf(e)))}</span>`).join("")}${a.length>3?`<span>+${a.length-3}</span>`:""}</span>`:t.tm?`<span class="tk-av"><span class="tm">👥</span></span>`:"";
 const meta=[N(t.du)?`<span class="du${late?" late":today?" today":""}">${late?"⏰ ":""}${E(dueTxt(t))}</span>`:"",t.rp?`<span>🔁 ${E(RPS.find(r=>r[0]===t.rp)[1])}</span>`:"",
  (t.rm&&t.rm.length&&!done)?`<span title="تذكير">🔔</span>`:"",cl.length?`<span>☑ ${ck}/${cl.length}</span>`:"",(t.tg||[]).map(x=>`<span class="tktg" data-notr>#${E(x)}</span>`).join(""),lk,
  done&&t.dn?`<span>✓ ${E(t.dn.n||"")} · ${E(dayLbl(t.dt))}</span>`:"",av].filter(Boolean).join("");
 return `<div class="tk-r p${N(t.pr)}${done?" done":""}" data-tzi="tk:${E(t.id)}" data-tzs="${E(t.st)}" data-tzt="${N(t.ts)}">
  <button type="button" class="tk-c" data-tk="tog" data-id="${E(t.id)}" aria-label="${done?"إعادة فتح المهمة":"إنهاء المهمة"}" title="${done?"إعادة فتح":"إنهاء"}"${canAct(t)?"":" disabled"}></button>
  <button type="button" class="tk-b" data-tk="open" data-id="${E(t.id)}"><div class="tk-t">${N(t.pr)?`<span class="pr">${"!".repeat(N(t.pr))}</span>`:""}<span data-notr>${E(t.t)}</span></div>${meta?`<div class="tk-m">${meta}</div>`:""}</button>
  ${t.st==="doing"?`<span class="tk-sx">جارية</span>`:""}</div>`;
}
function groupsOf(L){
 const now=Date.now(),d0=sod(now),G=[["late","فات موعدها",[]],["d0","اليوم",[]],["d1","غداً",[]],["wk","خلال 7 أيام",[]],["lt","لاحقاً",[]],["nd","بلا موعد",[]]];
 L.forEach(t=>{const du=N(t.du);const k=!du?"nd":isLate(t)?"late":du<d0+DAY?"d0":du<d0+2*DAY?"d1":du<d0+8*DAY?"wk":"lt";G.find(x=>x[0]===k)[2].push(t)});
 return G.filter(x=>x[2].length);
}
function listHtml(L){
 if(!L.length)return emptyHtml();
 if(V.l==="done")return `<div class="tkx-ls">${L.sort((a,b)=>N(b.dt)-N(a.dt)).map(rowHtml).join("")}</div>`;
 return groupsOf(L.sort(sortT)).map(([k,n,a])=>`<div class="tkx-g"><h4${k==="late"?' class="late"':""}>${n} <b>${a.length}</b></h4><div class="tkx-ls">${a.map(rowHtml).join("")}</div></div>`).join("");
}
function emptyHtml(){
 const msg={today:"لا شيء لليوم. يومك فاضي 🎉",up:"لا مهام مجدولة",late:"لا مهام متأخرة. ممتاز",mine:"لا مهام لك الآن",all:"لا مهام بعد",done:"لا مهام منتهية في آخر 30 يوماً"}[V.l]||"";
 return `<div class="tkx-e"><b>✓</b>${E(msg)}<br><small>اكتب مهمة في الخانة بالأعلى واضغط Enter</small></div>`;
}
function boardHtml(L){
 const cols=[["todo","لم تبدأ","#b9aab6"],["doing","جارية","#b36b1e"],["done","منتهية","#5d7a34"]];
 const A=filt(all());
 return `<div class="tkx-bd">${cols.map(([s,n,c])=>{const a=A.filter(t=>t.st===s&&(s==="done"||inList(t,V.l==="done"?"all":V.l))).sort(s==="done"?(x,y)=>N(y.dt)-N(x.dt):sortT).slice(0,s==="done"?30:200);
  return `<div class="tkx-col" data-tkcol="${s}"><h4><i style="--c:${c}"></i>${n} <b>${a.length}</b></h4>${a.map(t=>`<div class="tk-k p${N(t.pr)}" draggable="${canAct(t)}" data-id="${E(t.id)}" data-tzi="tk:${E(t.id)}" data-tzs="${E(t.st)}" data-tzt="${N(t.ts)}">
   <button type="button" class="tk-b" data-tk="open" data-id="${E(t.id)}"><div class="tk-t">${N(t.pr)?`<span class="pr" style="--pc:${["","var(--tk-a)","var(--tk-w)","var(--tk-r)"][N(t.pr)]}">${"!".repeat(N(t.pr))}</span>`:""}<span data-notr>${E(t.t)}</span></div>
   <div class="tk-m">${N(t.du)?`<span class="du${isLate(t)?" late":""}">${E(dueTxt(t))}</span>`:""}${(t.tg||[]).slice(0,2).map(x=>`<span class="tktg" data-notr>#${E(x)}</span>`).join("")}${asOf(t).length?`<span class="tk-av" data-notr>${asOf(t).slice(0,3).map(e=>`<span>${E(ini(nameOf(e)))}</span>`).join("")}</span>`:""}</div></button>
   ${canAct(t)?`<div class="mv">${cols.filter(x=>x[0]!==s).map(x=>`<button type="button" data-tk="mv" data-id="${E(t.id)}" data-s="${x[0]}">← ${x[1]}</button>`).join("")}</div>`:""}</div>`).join("")||`<div class="tkx-e" style="padding:14px"><small>اسحب مهمة إلى هنا</small></div>`}</div>`}).join("")}</div>`;
}
function calHtml(L){
 const y=V.cy,m=V.cm,f=new Date(y,m,1),start=new Date(y,m,1-f.getDay()),td=ymd(Date.now()),by={};
 filt(all()).forEach(t=>{if(N(t.du)){const k=ymd(t.du);(by[k]=by[k]||[]).push(t)}});
 let cells="";for(let i=0;i<42;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),k=ymd(d.getTime()),a=(by[k]||[]).sort(sortT);
  cells+=`<button type="button" class="dy${d.getMonth()!==m?" out":""}${k===td?" td":""}${k===V.sel?" sel":""}" data-tk="day" data-d="${k}"><u>${d.getDate()}</u>${a.slice(0,3).map(t=>`<s class="p${N(t.pr)}${t.st==="done"?" done":""}" data-notr>${E(t.t)}</s>`).join("")}${a.length>3?`<em>+${a.length-3}</em>`:""}</button>`}
 const sel=(by[V.sel]||[]).sort(sortT),sd=V.sel.split("-");
 return `<div class="tkx-cal"><div class="tkx-ch"><button type="button" data-tk="cm" data-v="-1" aria-label="الشهر السابق">›</button><h4>${MN[m]} ${y}</h4><button type="button" data-tk="ctoday">اليوم</button><button type="button" data-tk="cm" data-v="1" aria-label="الشهر التالي">‹</button></div>
  <div class="tkx-cg">${WD.map(w=>`<div class="wd">${w}</div>`).join("")}${cells}</div></div>
  <div class="tkx-cd tkx-g"><h4>${E(dayLbl(new Date(+sd[0],+sd[1]-1,+sd[2]).getTime()))} <b>${sel.length}</b></h4>${sel.length?`<div class="tkx-ls">${sel.map(rowHtml).join("")}</div>`:`<div class="tkx-e" style="padding:14px"><small>لا مهام في هذا اليوم</small></div>`}</div>`;
}
export function tkView(){
 if(!X)return "";
 const A=all(),cnt=l=>A.filter(t=>inList(t,l)).length,tags=[...new Set(A.reduce((a,t)=>a.concat(t.tg||[]),[]))].sort();
 const L=filt(A.filter(t=>inList(t,V.l))),dirL=[...DIR.values()].filter(p=>p.e!==me()).sort((a,b)=>a.n.localeCompare(b.n,"ar")),SV=getSV(),curSV=JSON.stringify([V.l,V.who,V.tag,V.pr,V.mode]);
 const col={today:"#8a5a83",up:"#b36b1e",late:"#b03a2e",mine:"#5d7a34",all:"#6b5a68",done:"#8f8a8e"};
 const opt=(v,n,cur)=>`<option value="${E(v)}"${v===cur?" selected":""}>${E(n)}</option>`,whoOpts=dirL.map(p=>opt(p.e,p.n,V.who)).join("");
 return `<div class="tkx">
 <div class="tkx-hd"><h2>✅ المهام والتذكيرات</h2><div class="tkx-seg" role="tablist">${[["list","☰ قائمة"],["board","▦ لوحة"],["cal","📅 تقويم"]].map(([k,n])=>`<button type="button" data-tk="mode" data-v="${k}" class="${V.mode===k?"on":""}">${n}</button>`).join("")}</div></div>
 <div class="tkx-add"><span class="pl">＋</span><input id="tkq" maxlength="220" autocomplete="off" placeholder="مهمة جديدة… مثال: اتصل بالمورد بكرة 10ص #موردين !!"><button type="button" class="b p" data-tk="qadd">إضافة</button><button type="button" class="b" data-tk="new">تفاصيل…</button></div>
 <div class="tkx-qp" id="tkqp"></div>
 <div class="tkx-sl">${LISTS.map(([k,n,ic])=>`<button type="button" data-tk="list" data-v="${k}" class="${V.l===k?"on":""}" style="--c:${col[k]}"><i>${ic}</i><b data-tzn="tkl:${k}">${cnt(k)}</b><span>${n}</span></button>`).join("")}</div>
 <div class="tkx-f">
  <select id="tkf-who" data-tkv="who" aria-label="المسؤول">${opt("","كل المسؤولين",V.who)}${opt("me","أنا",V.who)}${opt("none","بلا مسؤول",V.who)}${whoOpts}</select>
  <select id="tkf-tag" data-tkv="tag" aria-label="الوسم">${opt("","كل الوسوم",V.tag)}${tags.map(x=>opt(x,"#"+x,V.tag)).join("")}</select>
  <select id="tkf-pri" data-tkv="pr" aria-label="الأولوية">${opt("","كل الأولويات",V.pr)}${opt("3","!!! عالية",V.pr)}${opt("2","!! متوسطة",V.pr)}${opt("1","! منخفضة",V.pr)}${opt("0","بلا أولوية",V.pr)}</select>
  <input id="tkf-q" data-tkv="q" type="search" placeholder="بحث في المهام" value="${E(V.q)}">
  ${V.who||V.tag||V.pr||V.q?`<button type="button" class="clr" data-tk="fclr">✕ مسح الفلاتر</button>`:""}
 </div>
 <div class="tkx-sv">${SV.map((s,i)=>`<span class="tkch${JSON.stringify([s.l,s.who,s.tag,s.pr,s.mode])===curSV?" on":""}"><button type="button" data-tk="sv" data-i="${i}">★ <span data-notr>${E(s.n)}</span></button><button type="button" class="x" data-tk="svx" data-i="${i}" aria-label="حذف العرض">×</button></span>`).join("")}
  <button type="button" class="b" style="min-height:0;padding:3px 10px;font-size:12.5px" data-tk="svadd">☆ احفظ هذا العرض</button></div>
 ${!LOADED?`<div class="tkx-e">جاري تحميل المهام…</div>`:V.mode==="board"?boardHtml(L):V.mode==="cal"?calHtml(L):listHtml(L)}
 </div>`;
}
// ---------- الحفظ ----------
const stamp=()=>({e:X.me.e,n:X.me.n||X.me.e.split("@")[0],at:Date.now()});
async function setSt(t,st){
 if(!t||!canAct(t)||BUSY)return;
 const r=stPatch(t,st);BUSY=true;
 try{await updateDoc(doc(X.db,"tasks",t.id),r.u);if(r.msg)X.toast(r.msg);pg([t.id])}
 catch(e){X.toast("تعذّر الحفظ، حاول مرة أخرى","er")}
 finally{BUSY=false}
}
// تغيير الحالة: الإنهاء بيسجّل مين أنهاها، والمكررة بتترحّل لموعدها التالي بدل ما تتقفل
function stPatch(t,st){
 const u={upd:Date.now()};let msg="";
 if(st==="done"&&t.rp&&N(t.du)){const nd=roll(t.du,t.rp),nt=Object.assign({},t,{du:nd,st:"todo"}),nx=nextNx(nt);
  Object.assign(u,{du:nd,st:"todo",ld:stamp(),rc:N(t.rc)+1});if(Array.isArray(t.cl)&&t.cl.length)u.cl=t.cl.map(c=>({t:c.t,k:false}));if(nx)u.nx=nx;else if(t.nx!=null)u.nx=deleteField();
  if(t.dn)u.dn=deleteField();if(t.dt!=null)u.dt=deleteField();msg="✓ أُنجزت. موعدها القادم: "+dueTxt(nt)}
 else if(st==="done"){Object.assign(u,{st:"done",dn:stamp(),dt:Date.now()});if(t.nx!=null)u.nx=deleteField();msg="✓ أُنجزت المهمة"}
 else{u.st=st;if(t.dn)u.dn=deleteField();if(t.dt!=null)u.dt=deleteField();const nx=nextNx(Object.assign({},t,{st}));if(nx&&nx!==N(t.nx))u.nx=nx;if(t.st==="done")msg="أُعيد فتح المهمة"}
 return {u,msg};
}
async function quickAdd(){
 const el=g("tkq");if(!el||BUSY)return;const raw=String(el.value||"").trim();if(!raw)return;
 const p=parseQuick(raw,[...DIR.values()]);if(!p.t){X.toast("اكتب عنوان المهمة","er");return}
 const d={t:p.t,by:{e:X.me.e,n:X.me.n||X.me.e.split("@")[0]},ts:Date.now(),as:p.as.slice(0,10),pr:p.pr,st:"todo"};
 if(!d.as.length&&V.who&&V.who!=="me"&&V.who!=="none")d.as=[V.who];
 if(p.du){d.du=p.du;if(p.ad)d.ad=true}else if(V.l==="today"){d.du=sod(Date.now())+9*36e5;d.ad=true}
 if(d.du){d.rm=[0];const nx=nextNx(d);if(nx)d.nx=nx}
 if(p.tg.length)d.tg=p.tg;else if(V.tag)d.tg=[V.tag];
 const id=gid();BUSY=true;
 try{await setDoc(doc(X.db,"tasks",id),d);el.value="";const qp=g("tkqp");if(qp)qp.innerHTML="";if(d.as.some(e=>e!==X.me.e))pg([id]);
  const here=inList(d,V.l)&&filt([d]).length;X.toast(here?"✓ أُضيفت المهمة":"✓ أُضيفت المهمة في «"+(d.du?"المجدولة":"الكل")+"»")}
 catch(e){X.toast("تعذّرت الإضافة. ربما لم تتحدّث القواعد بعد","er")}
 finally{BUSY=false;if(X.redraw)X.redraw();setTimeout(()=>{const q=g("tkq");if(q)q.focus()},30)}
}
function qPreview(){
 const el=g("tkq"),qp=g("tkqp");if(!el||!qp)return;const v=String(el.value||"").trim();if(!v){qp.innerHTML="";return}
 const p=parseQuick(v,[...DIR.values()]),c=[];
 if(p.du)c.push("📅 "+dayLbl(p.du)+(p.ad?"":" "+t12(p.du)));if(p.pr)c.push("! ".repeat(p.pr).trim()+" "+PRS[p.pr][1]);
 p.tg.forEach(x=>c.push("#"+x));p.as.forEach(e=>c.push("👤 "+nameOf(e)));
 qp.innerHTML=c.length?`<small>سأفهمها هكذا:</small>${c.map(x=>`<span data-notr>${E(x)}</span>`).join("")}`:`<small>اضغط Enter للإضافة</small>`;
}
// ---------- نافذة المهمة ----------
function newF(){
 const d={id:"",t:"",d:"",st:"todo",pr:0,du:0,ad:false,rm:[],rp:"",as:[],tm:false,tg:[],cl:[],ln:null};
 if(V.who&&V.who!=="me"&&V.who!=="none")d.as=[V.who];if(V.tag)d.tg=[V.tag];
 if(V.l==="today"){d.du=sod(Date.now())+9*36e5;d.ad=true;d.rm=[0]}
 if(V.mode==="cal"&&V.sel){const s=V.sel.split("-");d.du=new Date(+s[0],+s[1]-1,+s[2]).getTime()+9*36e5;d.ad=true;d.rm=[0]}
 return d;
}
function fromT(t){return {id:t.id,t:t.t||"",d:t.d||"",st:t.st||"todo",pr:N(t.pr),du:N(t.du),ad:t.ad===true,rm:(t.rm||[]).map(N),rp:t.rp||"",as:asOf(t),tm:t.tm===true,tg:(t.tg||[]).slice(),cl:(t.cl||[]).map(c=>({t:String(c.t||""),k:c.k===true})),ln:t.ln&&t.ln.k?{k:t.ln.k,v:String(t.ln.v||""),l:String(t.ln.l||"")}:null}}
function openTask(id){const t=id?all().find(x=>x.id===id):null;if(id&&!t){X.toast("المهمة غير موجودة","er");return}F=t?fromT(t):newF();F._t=t||null;PICK=null;ATT=[];CMS=[];drawForm();if(t){loadAx();listenCm()}}
function modal(){let m=g("tkm");if(!m){m=document.createElement("div");m.id="tkm";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");document.body.appendChild(m)}return m}
function closeForm(){const m=g("tkm");if(m){m.classList.remove("on");m.innerHTML=""}F=null;PICK=null;if(CMUN){try{CMUN()}catch(e){}CMUN=null}}
const ED=()=>canEdit(F&&F._t);
function drawForm(){
 const m=modal(),t=F._t,ed=ED(),ac=!t||canAct(t),dis=ed?"":" disabled",dirL=[...DIR.values()].sort((a,b)=>a.n.localeCompare(b.n,"ar")),tags=[...new Set(all().reduce((a,x)=>a.concat(x.tg||[]),[]))];
 const brs=(X.branches?X.branches():[]).map(String);
 m.innerHTML=`<div>
 <div class="tp"><button type="button" class="tk-c" data-tkf="done" style="--pc:var(--tk-a)" aria-label="إنهاء"${t&&ac?"":" disabled"}></button><input id="tkf-t" maxlength="140" placeholder="عنوان المهمة" value="${E(F.t)}"${dis}><button type="button" class="x" data-tk="close" aria-label="إغلاق">×</button></div>
 <textarea id="tkf-d" class="tknt" rows="2" maxlength="3000" placeholder="ملاحظات"${dis}>${E(F.d)}</textarea>
 <div class="sx">
  <div><label class="k">◐ الحالة</label><div class="v" id="tkf-st"></div></div>
  <div><label class="k">! الأولوية</label><div class="v" id="tkf-pr"></div></div>
 </div>
 <div class="sx">
  <div><label class="k">📅 الموعد</label><div class="v"><input type="date" id="tkf-dd" value="${F.du?ymd(F.du):""}"${dis}><input type="time" id="tkf-tm" value="${F.du&&!F.ad?hhmm(F.du):""}"${dis}${F.ad?' style="display:none"':""}>
   <label class="ck"><input type="checkbox" id="tkf-ad"${F.ad?" checked":""}${dis}> طوال اليوم</label>
   ${ed?`<button type="button" class="pp" data-tkf="qd" data-v="0">اليوم</button><button type="button" class="pp" data-tkf="qd" data-v="1">غداً</button><button type="button" class="pp" data-tkf="qd" data-v="7">بعد أسبوع</button><button type="button" class="pp" data-tkf="qd" data-v="x">بلا موعد</button>`:""}</div></div>
  <div><label class="k">🔔 التذكير</label><div class="v" id="tkf-rm"></div></div>
  <div><label class="k">🔁 التكرار</label><div class="v"><select id="tkf-rp"${dis}>${RPS.map(([k,n])=>`<option value="${k}"${F.rp===k?" selected":""}>${n}</option>`).join("")}</select></div></div>
 </div>
 <div class="sx">
  <div><label class="k">👥 المسؤولون</label><div class="v" id="tkf-as"></div></div>
  ${ed?`<div><label class="k"></label><div class="v"><select id="tkf-asadd" aria-label="أضف مسؤولاً"><option value="">＋ أضف مسؤولاً…</option>${dirL.map(p=>`<option value="${E(p.e)}">${E(p.n)}</option>`).join("")}</select>
   <p class="h">🔒 المهمة لك وحدك، ولا يراها غيرك إلا من تُسندها إليه.</p></div></div>`:""}
  <div><label class="k">🏷 الوسوم</label><div class="v"><input id="tkf-tg" list="tkf-tgl" placeholder="مثال: موردين، جرد (افصل بفاصلة)" value="${E(F.tg.join("، "))}"${dis} style="flex:1"><datalist id="tkf-tgl">${tags.map(x=>`<option value="${E(x)}">`).join("")}</datalist></div></div>
  <div><label class="k">🔗 ربط</label><div class="v"><select id="tkf-lk"${dis}>${LNK.map(([k,n])=>`<option value="${k}"${(F.ln?F.ln.k:"")===k?" selected":""}>${n}</option>`).join("")}</select>
   <input id="tkf-lv" list="tkf-lvl" maxlength="40" placeholder="${F.ln&&F.ln.k==="br"?"اختر الفرع":"رقم الطلب أو أمر الشراء"}" value="${E(F.ln?(F.ln.l||F.ln.v):"")}"${dis}${F.ln?"":' style="display:none"'}><datalist id="tkf-lvl">${brs.map(b=>`<option value="${E(b)}">`).join("")}</datalist></div></div>
 </div>
 <div class="sx"><div><label class="k">☑ قائمة فرعية</label><div class="v" id="tkf-cl"></div></div></div>
 <div class="sx"><div><label class="k">📎 المرفقات</label><div class="v"><div class="ax" id="tkf-ax"></div>${t&&ac||!t?`<div id="tkf-pk" style="width:100%"></div>`:""}</div></div></div>
 ${t?`<div class="sx"><div><label class="k">💬 التعليقات</label><div class="v"><div class="tkcms" id="tkf-cm"><p class="h">جاري التحميل…</p></div>
  <div class="tkcmw"><textarea id="tkf-cmt" rows="2" maxlength="1000" placeholder="اكتب تعليقاً… (يصل إشعار للمسؤولين ومن أنشأها)"></textarea><button type="button" class="b p" data-tk="cmsend">إرسال</button></div></div></div></div>`:""}
 ${t?`<p class="mt">أنشأها ${E(t.by&&t.by.n||"")} · ${E(dayLbl(t.ts))} ${E(t12(t.ts))}${t.dn?` · أنهاها ${E(t.dn.n||"")}`:""}${t.ld?` · آخر إنجاز ${E(t.ld.n||"")} ${E(dayLbl(t.ld.at))}`:""}${N(t.rc)?` · أُنجزت ${N(t.rc)} مرة`:""}${ed?"":` · <b>يمكنك تغيير الحالة والقائمة الفرعية والتعليق فقط</b>`}</p>`:""}
 <div class="ft">${t&&ed?`<button type="button" class="b del" data-tk="del">🗑 حذف</button>`:""}<span class="sp"></span><button type="button" class="b" data-tk="close">إلغاء</button>${ac?`<button type="button" class="b p" data-tk="save">${t?"حفظ":"إضافة المهمة"}</button>`:""}</div>
 </div>`;
 m.classList.add("on");drawParts();
 if(g("tkf-pk"))PICK=multiPick(g("tkf-pk"),{max:Math.max(1,9-ATT.length),w:1400,cap:300000,toast:X.toast});
 if(!t)setTimeout(()=>{const i=g("tkf-t");if(i)i.focus()},40);
}
function drawParts(){
 if(!F)return;const ed=ED(),t=F._t,ac=!t||canAct(t);
 const st=g("tkf-st");if(st)st.innerHTML=STS.map(([k,n])=>`<button type="button" class="pp${F.st===k?" on":""}" data-tkf="st" data-v="${k}"${ac?"":" disabled"}>${n}</button>`).join("");
 const pr=g("tkf-pr");if(pr)pr.innerHTML=PRS.map(([k,n])=>`<button type="button" class="pp p${k}${F.pr===k?" on":""}" data-tkf="pr" data-v="${k}"${ed?"":" disabled"}>${k?"!".repeat(k)+" ":""}${n}</button>`).join("");
 const rm=g("tkf-rm");if(rm)rm.innerHTML=F.du?RMS.map(([k,n])=>`<button type="button" class="pp${F.rm.indexOf(k)>=0?" on":""}" data-tkf="rm" data-v="${k}"${ed?"":" disabled"}>${n}</button>`).join("")+`<p class="h">حتى 3 تذكيرات، تصل على موبايل المسؤولين (أو موبايلك لو بلا مسؤول). الدقة حتى 5 دقائق.</p>`:`<p class="h">حدّد موعداً أولاً لتضيف تذكيراً</p>`;
 const as=g("tkf-as");if(as)as.innerHTML=(F.as.length?F.as.map(e=>`<span class="who"><span data-notr>${E(nameOf(e))}</span>${ed?`<button type="button" data-tkf="asx" data-v="${E(e)}" aria-label="إزالة">×</button>`:""}</span>`).join(""):`<span class="h" style="width:auto">بلا مسؤول (لك أنت)</span>`);
 const sa=g("tkf-asadd");if(sa)[...sa.options].forEach(o=>{if(o.value)o.hidden=F.as.indexOf(o.value)>=0});
 const cl=g("tkf-cl");if(cl){const k=F.cl.filter(c=>c.k).length;cl.innerHTML=(F.cl.length?`<div class="clb"><div class="tkbar"><i style="width:${Math.round(k/F.cl.length*100)}%"></i></div><small class="h">${k} من ${F.cl.length}</small></div>`:"")+
  F.cl.map((c,i)=>`<div class="tkcl${c.k?" k":""}"><input type="checkbox" data-tkc="k" data-i="${i}"${c.k?" checked":""}${ac?"":" disabled"} aria-label="تم"><input type="text" data-tkc="t" data-i="${i}" maxlength="200" value="${E(c.t)}"${ed?"":" disabled"}>${ed?`<button type="button" data-tkf="clx" data-i="${i}" aria-label="حذف البند">×</button>`:""}</div>`).join("")+
  (ed&&F.cl.length<40?`<div class="tkcl"><input type="checkbox" disabled aria-hidden="true"><input type="text" id="tkf-cln" maxlength="200" placeholder="＋ أضف بنداً ثم Enter"></div>`:"")}
 const ax=g("tkf-ax");if(ax)ax.innerHTML=ATT.length?ATT.map((a,i)=>`<button type="button" data-tkf="ax" data-i="${i}" title="${E(a.nm||"صورة")}">${a.file||a.pdf?`<span data-notr>📄<br>${E(String(a.nm||"ملف").slice(0,18))}</span>`:`<img src="${E(a.src)}" alt="">`}${(ED()||canAct(F._t))?`<span class="dl" data-tkf="axd" data-i="${i}" aria-label="حذف المرفق">×</span>`:""}</button>`).join(""):(F._t?`<p class="h">لا مرفقات</p>`:"");
}
// البيانات اتغيّرت والنافذة مفتوحة: نحدّث المعلومات اللي محدش بيكتب فيها (الحالة، القائمة الفرعية لغير صاحبها)
function liveForm(){
 const t=all().find(x=>x.id===F.id);if(!t){closeForm();X.toast("المهمة أُغلقت أو حُذفت");return}
 const a=document.activeElement,typing=a&&g("tkm")&&g("tkm").contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
 F._t=t;if(!F._dirty&&!typing){F.st=t.st;F.cl=(t.cl||[]).map(c=>({t:String(c.t||""),k:c.k===true}));drawParts()}
}
function readF(){
 const v=id=>{const el=g(id);return el?String(el.value||""):""};
 F.t=v("tkf-t").replace(/\s+/g," ").trim().slice(0,140);F.d=v("tkf-d").trim().slice(0,3000);
 const dd=v("tkf-dd"),tm=v("tkf-tm"),ad=g("tkf-ad")&&g("tkf-ad").checked;
 if(/^\d{4}-\d{2}-\d{2}$/.test(dd)){const s=dd.split("-").map(Number);let h=9,mi=0;if(!ad&&/^\d{2}:\d{2}$/.test(tm)){h=+tm.slice(0,2);mi=+tm.slice(3,5)}F.du=new Date(s[0],s[1]-1,s[2],h,mi).getTime();F.ad=!!ad||!/^\d{2}:\d{2}$/.test(tm)}else{F.du=0;F.ad=false}
 F.rp=v("tkf-rp");if(g("tkf-team"))F.tm=g("tkf-team").checked;
 F.tg=[...new Set(v("tkf-tg").split(/[,،]/).map(x=>x.replace(/^#/,"").trim().slice(0,24)).filter(Boolean))].slice(0,6);
 const lk=v("tkf-lk"),lv=v("tkf-lv").trim().slice(0,40);F.ln=lk&&lv?{k:lk,v:lv,l:lv}:null;
 F.cl=F.cl.map(c=>({t:String(c.t||"").trim().slice(0,200),k:c.k===true})).filter(c=>c.t);
}
async function saveForm(){
 if(!F||BUSY)return;const t=F._t,ed=ED();
 if(ed)readF();
 if(!F.t){X.toast("اكتب عنوان المهمة","er");const i=g("tkf-t");if(i)i.focus();return}
 if(PICK&&PICK.busy()){X.toast("انتظر حتى تجهز المرفقات");return}
 const now=Date.now(),id=t?t.id:gid();let d,ids=[];
 if(ed){
  d={t:F.t,by:t?t.by:{e:X.me.e,n:X.me.n||X.me.e.split("@")[0]},ts:t?t.ts:now,as:F.as.slice(0,10),pr:F.pr,st:F.st};
  if(t)d.upd=now;if(F.d)d.d=F.d;
  if(F.du){d.du=F.du;if(F.ad)d.ad=true;if(F.rm.length)d.rm=F.rm.slice(0,3);if(F.rp)d.rp=F.rp}
  if(F.tg.length)d.tg=F.tg;if(F.cl.length)d.cl=F.cl.slice(0,40);if(F.ln)d.ln=F.ln;
  if(F.st==="done"){d.dn=t&&t.st==="done"&&t.dn?t.dn:stamp();d.dt=t&&t.st==="done"&&t.dt?t.dt:now}
  if(t){if(t.ld)d.ld=t.ld;if(N(t.rc))d.rc=N(t.rc)}
  if(!t&&d.st==="done"){d.st="todo";delete d.dn;delete d.dt}
  // مكررة اتعلّمت «منتهية»: تترحّل لموعدها التالي (زي الضغط على الدائرة)
  if(t&&d.st==="done"&&t.st!=="done"&&d.rp&&N(d.du)){d.du=roll(d.du,d.rp);d.st="todo";delete d.dn;delete d.dt;d.ld=stamp();d.rc=N(t.rc)+1;if(d.cl)d.cl=d.cl.map(c=>({t:c.t,k:false}))}
  const nx=nextNx(d,now);if(nx)d.nx=nx;
  const prev=t?asOf(t):[];if(d.as.some(e=>e!==X.me.e&&prev.indexOf(e)<0)||(t&&d.st==="done"&&t.st!=="done")||(t&&d.ld&&d.ld!==t.ld))ids=[id];
 }
 BUSY=true;const btn=document.querySelector('#tkm [data-tk="save"]');if(btn)btn.disabled=true;
 try{
  if(ed)await setDoc(doc(X.db,"tasks",id),d);
  else{
   // المسؤول: الحالة والقائمة الفرعية فقط
   let u={upd:now};const cl0=(t.cl||[]).map(c=>({t:String(c.t||""),k:c.k===true}));if(JSON.stringify(F.cl)!==JSON.stringify(cl0))u.cl=F.cl;
   if(F.st!==t.st){const r=stPatch(Object.assign({},t,u.cl?{cl:u.cl}:{}),F.st);if(r.u.cl&&u.cl)r.u.cl=r.u.cl;else if(u.cl)r.u.cl=u.cl;u=r.u;ids=[id]}
   if(Object.keys(u).length>1)await updateDoc(doc(X.db,"tasks",id),u);
  }
  const files=PICK?PICK.imgs().concat(PICK.files()):[];let bad=0,n=ATT.reduce((a,x)=>Math.max(a,x.k),1)+1;
  for(const f of files){if(n>10){bad++;continue}try{await putAtt(X.db,"tasks",id,"x",n,f)}catch(e){bad++}n++}
  if(ids.length)pg(ids);
  X.toast(bad?`حُفظت المهمة، وتعذّر رفع ${bad} من المرفقات`:t?"✓ حُفظت المهمة":"✓ أُضيفت المهمة",bad?"er":undefined);closeForm();
 }catch(e){X.toast("تعذّر الحفظ. ربما لم تتحدّث القواعد بعد","er");if(btn)btn.disabled=false}
 finally{BUSY=false}
}
async function delTask(){
 const t=F&&F._t;if(!t||!canEdit(t)||BUSY)return;
 if(!confirm("حذف المهمة «"+t.t+"» وكل تعليقاتها ومرفقاتها؟ لا يمكن التراجع."))return;
 BUSY=true;
 try{
  for(const a of ATT){try{await dropAtt(X.db,a.path,a.file?a.src:"")}catch(e){}}
  try{const s=await getDocs(collection(X.db,"tasks",t.id,"cm"));for(const d of s.docs){try{await deleteDoc(doc(X.db,"tasks",t.id,"cm",d.id))}catch(e){}}}catch(e){}
  await deleteDoc(doc(X.db,"tasks",t.id));X.toast("حُذفت المهمة");closeForm();
 }catch(e){X.toast("تعذّر الحذف","er")}finally{BUSY=false}
}
async function loadAx(){const id=F&&F.id;if(!id)return;try{const L=await loadAtts(X.db,"tasks",id,"x");if(F&&F.id===id){ATT=L;drawParts()}}catch(e){if(F&&F.id===id){ATT=[];drawParts()}}}
function listenCm(){
 const id=F.id;if(CMUN){try{CMUN()}catch(e){}}
 CMUN=onSnapshot(collection(X.db,"tasks",id,"cm"),s=>{if(!F||F.id!==id)return;CMS=s.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>N(a.ts)-N(b.ts));drawCm()},()=>{const c=g("tkf-cm");if(c)c.innerHTML=`<p class="h">تعذّرت قراءة التعليقات</p>`});
}
function drawCm(){const c=g("tkf-cm");if(!c)return;c.innerHTML=CMS.length?CMS.map(x=>`<div class="tkcm"><small><b data-notr>${E(x.by&&x.by.n||"")}</b><span>${E(dayLbl(x.ts))} ${E(t12(x.ts))}</span>${String(x.by&&x.by.e||"").toLowerCase()===me()||canEdit(F._t)?`<button type="button" data-tk="cmdel" data-id="${E(x.id)}" aria-label="حذف التعليق">🗑</button>`:""}</small><p data-notr>${E(x.t)}</p></div>`).join(""):`<p class="h">لا تعليقات بعد</p>`;c.scrollTop=c.scrollHeight}
async function sendCm(){
 const el=g("tkf-cmt"),t=F&&F._t;if(!el||!t||BUSY)return;const v=String(el.value||"").trim().slice(0,1000);if(!v)return;
 const cid=Date.now().toString(36)+gid().slice(0,6);BUSY=true;
 try{await setDoc(doc(X.db,"tasks",t.id,"cm",cid),{t:v,by:{e:X.me.e,n:X.me.n||X.me.e.split("@")[0]},ts:Date.now()});el.value="";pg([t.id+"/"+cid])}
 catch(e){X.toast("تعذّر إرسال التعليق","er")}finally{BUSY=false}
}
// ---------- الأحداث ----------
function onClick(e){
 if(!X)return;const b=e.target.closest&&e.target.closest("[data-tk],[data-tkf]");if(!b)return;
 const a=b.dataset.tk,f=b.dataset.tkf,id=b.dataset.id;
 if(a){
  if(a==="list"){V.l=b.dataset.v;if(V.mode==="board"&&V.l==="done")V.mode="list";saveV();X.redraw();return}
  if(a==="mode"){V.mode=b.dataset.v;saveV();X.redraw();return}
  if(a==="qadd"){quickAdd();return}
  if(a==="new"){const q=g("tkq"),p=q&&q.value.trim()?parseQuick(q.value,[...DIR.values()]):null;openTask("");if(p&&F){F.t=p.t;if(p.du){F.du=p.du;F.ad=!!p.ad;F.rm=[0]}F.pr=p.pr||F.pr;if(p.tg.length)F.tg=p.tg;if(p.as.length)F.as=p.as;drawForm();q.value="";qPreview()}return}
  if(a==="open"){openTask(id);return}
  if(a==="tog"){const t=all().find(x=>x.id===id);if(t)setSt(t,t.st==="done"?"todo":"done");return}
  if(a==="mv"){const t=all().find(x=>x.id===id);if(t)setSt(t,b.dataset.s);return}
  if(a==="fclr"){V.who="";V.tag="";V.pr="";V.q="";saveV();X.redraw();return}
  if(a==="day"){V.sel=b.dataset.d;X.redraw();return}
  if(a==="cm"){const d=new Date(V.cy,V.cm+N(b.dataset.v),1);V.cy=d.getFullYear();V.cm=d.getMonth();X.redraw();return}
  if(a==="ctoday"){const d=new Date();V.cy=d.getFullYear();V.cm=d.getMonth();V.sel=ymd(Date.now());X.redraw();return}
  if(a==="sv"){const s=getSV()[N(b.dataset.i)];if(s){V.l=s.l||"all";V.who=s.who||"";V.tag=s.tag||"";V.pr=s.pr||"";V.mode=s.mode||"list";saveV();X.redraw()}return}
  if(a==="svx"){const L=getSV();L.splice(N(b.dataset.i),1);setSV(L);X.redraw();return}
  if(a==="svadd"){const L=getSV();if(L.length>=8){X.toast("حتى 8 عروض محفوظة. احذف واحداً أولاً","er");return}const ln=(LISTS.find(x=>x[0]===V.l)||["","الكل"])[1];const n=prompt("اسم العرض (يُحفظ على هذا الجهاز):",ln+(V.tag?" #"+V.tag:"")+(V.who?" · "+(V.who==="me"?"أنا":V.who==="none"?"بلا مسؤول":nameOf(V.who)):""));if(n&&n.trim()){L.push({n:n.trim().slice(0,30),l:V.l,who:V.who,tag:V.tag,pr:V.pr,mode:V.mode});setSV(L);X.redraw()}return}
  if(a==="close"){closeForm();return}
  if(a==="save"){saveForm();return}
  if(a==="del"){delTask();return}
  if(a==="cmsend"){sendCm();return}
  if(a==="cmdel"){if(!F||!confirm("حذف التعليق؟"))return;deleteDoc(doc(X.db,"tasks",F.id,"cm",id)).catch(()=>X.toast("تعذّر الحذف","er"));return}
  return;
 }
 if(!F)return;const ed=ED();
 if(f==="st"){F.st=b.dataset.v;F._dirty=true;drawParts();return}
 if(f==="done"){if(F._t){const t=F._t;closeForm();setSt(t,t.st==="done"?"todo":"done")}return}
 if(!ed&&f!=="ax"&&f!=="axd")return;
 if(f==="pr"){F.pr=N(b.dataset.v);drawParts();return}
 if(f==="rm"){const k=N(b.dataset.v),i=F.rm.indexOf(k);if(i>=0)F.rm.splice(i,1);else if(F.rm.length<3)F.rm.push(k);else{X.toast("حتى 3 تذكيرات");return}F.rm.sort((x,y)=>y-x);drawParts();return}
 if(f==="asx"){F.as=F.as.filter(x=>x!==b.dataset.v);drawParts();return}
 if(f==="clx"){F.cl.splice(N(b.dataset.i),1);drawParts();return}
 if(f==="qd"){readF();const v=b.dataset.v;if(v==="x"){F.du=0;F.ad=false;F.rm=[];F.rp=""}else{const h=F.du&&!F.ad?new Date(F.du).getHours():9,mi=F.du&&!F.ad?new Date(F.du).getMinutes():0,d=new Date(sod(Date.now())+N(v)*DAY);d.setHours(h,mi,0,0);F.du=d.getTime();if(!F.rm.length)F.rm=[0]}const keepT=F.t;drawForm();if(g("tkf-t"))g("tkf-t").value=keepT;return}
 if(f==="axd"){e.stopPropagation();const x=ATT[N(b.dataset.i)];if(!x||!confirm("حذف المرفق؟"))return;dropAtt(X.db,x.path,x.file?x.src:"").then(()=>{ATT.splice(N(b.dataset.i),1);drawParts()}).catch(()=>X.toast("تعذّر حذف المرفق","er"));return}
 if(f==="ax"){zoomGallery(ATT.map(x=>({src:x.src,nm:x.nm})),F.t||"مرفقات المهمة",N(b.dataset.i));return}
}
function onInput(e){
 if(!X)return;const t=e.target;
 if(t.id==="tkq"){qPreview();return}
 if(t.dataset&&t.dataset.tkv==="q"){V.q=t.value;clearTimeout(onInput.q);onInput.q=setTimeout(()=>{if(X)X.redraw()},250);return}
 if(F&&t.dataset&&t.dataset.tkc==="t"){const c=F.cl[N(t.dataset.i)];if(c)c.t=t.value}
}
function onChange(e){
 if(!X)return;const t=e.target;
 if(t.dataset&&t.dataset.tkv&&t.dataset.tkv!=="q"){V[t.dataset.tkv]=t.value;saveV();X.redraw();return}
 if(!F)return;
 if(t.dataset&&t.dataset.tkc==="k"){const c=F.cl[N(t.dataset.i)];if(c){c.k=t.checked;F._dirty=true;drawParts()}return}
 if(t.id==="tkf-asadd"&&t.value){if(F.as.length>=10){X.toast("حتى 10 مسؤولين","er")}else if(F.as.indexOf(t.value)<0)F.as.push(t.value);t.value="";drawParts();return}
 if(t.id==="tkf-ad"){const tm=g("tkf-tm");if(tm)tm.style.display=t.checked?"none":"";return}
 if(t.id==="tkf-dd"){const had=F.du;readF();if(!had&&F.du&&!F.rm.length)F.rm=[0];drawParts();return}
 if(t.id==="tkf-lk"){const lv=g("tkf-lv");if(lv){lv.style.display=t.value?"":"none";lv.placeholder=t.value==="br"?"اختر الفرع":"رقم الطلب أو أمر الشراء";if(t.value)lv.focus()}return}
}
function onKey(e){
 if(!X)return;const t=e.target;
 if(e.key==="Enter"&&t.id==="tkq"&&!e.isComposing){e.preventDefault();quickAdd();return}
 if(e.key==="Enter"&&t.id==="tkf-cln"&&!e.isComposing){e.preventDefault();const v=String(t.value||"").trim().slice(0,200);if(v&&F&&F.cl.length<40){F.cl.push({t:v,k:false});drawParts();const n=g("tkf-cln");if(n)n.focus()}return}
 if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&t.id==="tkf-cmt"){e.preventDefault();sendCm();return}
 if(e.key==="Escape"&&F&&g("tkm")&&g("tkm").classList.contains("on")){e.stopPropagation();closeForm()}
}
// السحب في اللوحة (كمبيوتر). الموبايل: أزرار «← جارية» تحت كل كارت
let DRAG="";
function onDrag(e){const k=e.target.closest&&e.target.closest(".tk-k[draggable=true]");if(!k)return;DRAG=k.dataset.id;try{e.dataTransfer.setData("text/plain",DRAG);e.dataTransfer.effectAllowed="move"}catch(x){}}
function onOver(e){if(!DRAG)return;const c=e.target.closest&&e.target.closest("[data-tkcol]");if(!c)return;e.preventDefault();document.querySelectorAll(".tkx-col.tkov").forEach(x=>{if(x!==c)x.classList.remove("tkov")});c.classList.add("tkov")}
function onLeave(e){const c=e.target.closest&&e.target.closest("[data-tkcol]");if(c&&!c.contains(e.relatedTarget))c.classList.remove("tkov")}
function onDrop(e){if(!DRAG)return;const c=e.target.closest&&e.target.closest("[data-tkcol]");document.querySelectorAll(".tkx-col.tkov").forEach(x=>x.classList.remove("tkov"));const id=DRAG;DRAG="";if(!c)return;e.preventDefault();const t=all().find(x=>x.id===id);if(t&&t.st!==c.dataset.tkcol)setSt(t,c.dataset.tkcol)}
