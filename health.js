// 📏 صحة المنصة (18 نوفمبر 2026، طلب محمد: "القاعدة هتكبر، مش عايز أتفاجئ بوقوع"): مساحة قاعدة البيانات ومين واخدها.
// للأدمن ومالك النظام فقط (⚙ الإعدادات ← صحة المنصة). القياس من دالة db_health() في القواعد (بترجّع null لغيرهم)،
// وبيتحفظ على الجهاز 6 ساعات. حد الخطة في cfg/plan = {mb} (500 المجاني، 8192 للخطة المدفوعة)، والسيرفر بيقراه
// وبيبعت إشعاراً يومياً لما المساحة تعدّي 80%. لو القاعدة امتلأت في الخطة المجانية: المنصة تتوقف عن الحفظ.
import {doc,getDoc,setDoc} from "./fb.js";
import {E} from "./cust.js";
const MB=1048576,KEY="tz_health",TTL=6*36e5;
let X=null,H=null,PLAN=500,busy=false,err="";
const NAMES={pods:"صور التسليم",dm:"الدردشة (رسائل وصور وصوت)",grp:"مجموعات الدردشة",mntimg:"صور الصيانة",giftimg:"سندات الهدايا",requests:"الطلبات",log:"سجل العمليات",cat:"كتالوج الأصناف",pushlog:"سجل الإشعارات",trips:"الرحلات",ann:"التعميمات",ledger:"العهدة والفواتير",poatt:"مرفقات أوامر الشراء",gifts:"الهدايا والعينات",ava:"الصور الشخصية",push:"أجهزة الإشعارات",mnt:"طلبات الصيانة",po:"أوامر الشراء",fuel:"الوقود",call:"المكالمات",staff:"الموظفون",secrets:"كلمات المرور",branches:"الفروع",whdir:"دليل الدردشة",seen:"آخر ظهور",live:"مواقع السائقين",geo:"مواقع الفروع",clean:"جدول النظافة",settlements:"إقفال العهدة",workers:"العمال",chats:"دردشة قديمة"};
const sz=b=>{b=+b||0;return b>=MB*1024?(b/MB/1024).toFixed(1)+" جيجا":b>=MB?(b/MB).toFixed(b>=10*MB?0:1)+" ميجا":Math.max(1,Math.round(b/1024))+" كيلو"};
const pctOf=()=>H?Math.min(100,(+H.db||0)/(PLAN*MB)*100):0;
const paint=()=>{if(X&&X.redraw)X.redraw()};
const CSS=`
.tzh h2{margin:0 0 4px;font-size:21px}.tzh-sub{color:var(--mut);font-size:13.5px;margin:0 0 14px;line-height:1.7}
.tzh-card{background:var(--card);border-radius:18px;padding:18px;margin:0 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.tzh-top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}.tzh-top b{font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}.tzh-top span{color:var(--mut);font-size:14px}
.tzh-top em{font-style:normal;font-weight:800;font-size:13px;border-radius:999px;padding:3px 12px;margin-inline-start:auto;background:#e5ecd0;color:#45512a}
.tzh-card.w .tzh-top em{background:#fff1d6;color:#8a5a00}.tzh-card.r .tzh-top em{background:#fbe3e0;color:#9b2a1f}
.tzh-bar{height:14px;border-radius:8px;background:var(--soft,#f6eee3);overflow:hidden}.tzh-bar i{display:block;height:100%;border-radius:8px;background:#6f7d45;min-width:6px}
.tzh-card.w .tzh-bar i{background:#d99a1c}.tzh-card.r .tzh-bar i{background:#c4362b}
.tzh-msg{margin:12px 0 0;font-size:14.5px;line-height:1.8}.tzh-card.r .tzh-msg{color:#9b2a1f;font-weight:700}
.tzh-facts{display:flex;gap:8px 22px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);color:var(--mut);font-size:13.5px}.tzh-facts b{color:var(--ink);font-variant-numeric:tabular-nums}
.tzh-card h3{margin:0 0 4px;font-size:16px}.tzh-card>small{display:block;color:var(--mut);font-size:13px;line-height:1.7;margin-bottom:10px}
.tzh-plan{display:flex;gap:8px;flex-wrap:wrap}.tzh-plan button{flex:1 1 180px;font:inherit;text-align:start;border:1.5px solid var(--line);background:none;color:var(--ink);border-radius:14px;padding:10px 14px;cursor:pointer}
.tzh-plan button b{display:block;font-size:15px}.tzh-plan button small{color:var(--mut);font-size:12.5px}.tzh-plan button.on{border-color:var(--acc,#8a5a83);background:rgba(138,90,131,.08)}
.tzh-row{display:grid;grid-template-columns:minmax(120px,1.2fr) 2fr auto;gap:12px;align-items:center;padding:8px 0;font-size:14px}.tzh-row+.tzh-row{border-top:1px solid var(--line)}
.tzh-row span small{display:block;color:var(--mut);font-size:12px}.tzh-row i{height:8px;border-radius:6px;background:var(--soft,#f6eee3);overflow:hidden}.tzh-row u{display:block;height:100%;border-radius:6px;background:var(--acc,#8a5a83);opacity:.75}
.tzh-row em{font-style:normal;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.tzh-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--mut);font-size:13px}.tzh-foot button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:8px 14px;cursor:pointer}.tzh-foot button:disabled{opacity:.6}
.tzh-err{color:#9b2a1f;font-weight:700}
@media (max-width:640px){.tzh-row{grid-template-columns:1fr auto}.tzh-row i{display:none}.tzh-top b{font-size:26px}}
@media (prefers-color-scheme:dark){.tzh-top em{background:#2a301b;color:#b9c68a}.tzh-card.w .tzh-top em{background:#3a2a08;color:#f6c770}.tzh-card.r .tzh-top em{background:#40191a;color:#f1a5a0}.tzh-card.r .tzh-msg,.tzh-err{color:#f1a5a0}}
`;
export function initHealth(ctx){
 X=ctx;H=null;err="";busy=false;PLAN=500;
 if(!document.getElementById("tzh-css")){const s=document.createElement("style");s.id="tzh-css";s.textContent=CSS;document.head.appendChild(s)}
 try{const c=JSON.parse(localStorage.getItem(KEY)||"null");if(c&&c.h&&c.e===ctx.me)H=c.h}catch(e){}
 const next=()=>{if(!X)return;if(!H||Date.now()-(+H.at||0)>TTL)load(false);else{paint();warn()}};
 getDoc(doc(X.db,"cfg","plan")).then(s=>{const v=s.exists()?+s.data().mb:0;if(v>0)PLAN=v}).catch(()=>{}).then(next);
 if(!window.__tzhc){window.__tzhc=1;document.addEventListener("click",click)}
}
export function stopHealth(){X=null;H=null;busy=false;err=""}
async function load(manual){
 if(!X||busy)return;busy=true;err="";paint();
 try{
  const c=X.db&&X.db.c;if(!c||!c.rpc)throw new Error("no client");
  const r=await c.rpc("db_health");if(r.error)throw r.error;
  if(!r.data||!(+r.data.db>0))throw new Error("no data");
  H=r.data;try{localStorage.setItem(KEY,JSON.stringify({e:X.me,h:H}))}catch(e){}
  if(manual&&X.toast)X.toast("تم تحديث القياس ✅");
 }catch(e){err=H?"تعذّر تحديث القياس، تأكد من الإنترنت":"تعذّر قياس المساحة. تأكد من لصق القواعد الجديدة في Supabase"}
 busy=false;if(!X)return;paint();warn();
}
// تحذير عند فتح اللوحة (مرة في اليوم) لو المساحة عدّت 80%
function warn(){
 if(!X||!H)return;const pc=Math.round(pctOf());if(pc<80)return;
 const d=new Date().toDateString();try{if(localStorage.getItem(KEY+"_w")===d)return;localStorage.setItem(KEY+"_w",d)}catch(e){}
 if(X.toast)X.toast(`⚠️ مساحة قاعدة البيانات ${pc}%. افتح الإعدادات ← صحة المنصة`,"er");
}
export function healthView(){
 if(!X)return "";
 if(!H)return `<div class="tzh"><h2>📏 صحة المنصة</h2><div class="tzh-card"><div class="tzh-foot">${busy?"<span>⏳ جاري قياس المساحة...</span>":`<span class="tzh-err">${E(err||"لم يُقَس بعد")}</span><button type="button" data-hl="refresh">أعد المحاولة</button>`}</div></div></div>`;
 const lim=PLAN*MB,pc=pctOf(),lv=pc>=85?"r":pc>=70?"w":"",wk=+H.b7||0,left=Math.max(0,lim-(+H.db||0)),mon=wk>0?left/wk/4.345:0;
 const top=Array.isArray(H.top)?H.top:[],mx=top.length?Math.max(1,+top[0].b||1):1;
 const msg=lv==="r"?"خطر: عند امتلاء المساحة تتوقف المنصة عن حفظ أي شيء جديد. رقِّ الاشتراك الآن.":lv==="w"?"المساحة اقتربت من الحد. خطّط لترقية الاشتراك قبل أن تمتلئ.":"المساحة مطمئنة.";
 return `<div class="tzh"><h2>📏 صحة المنصة</h2><p class="tzh-sub">مساحة قاعدة البيانات وما الذي يملؤها. يصلك إشعار تلقائي كل صباح إذا تجاوزت 80%.</p>
 <div class="tzh-card ${lv}"><div class="tzh-top"><b>${sz(H.db)}</b><span>من ${sz(lim)}</span><em>${pc<1?"أقل من 1%":Math.round(pc)+"%"}</em></div>
 <div class="tzh-bar"><i style="width:${Math.max(1,pc).toFixed(1)}%"></i></div><p class="tzh-msg">${msg}</p>
 <div class="tzh-facts"><span><b>${(+H.n||0).toLocaleString("en-US")}</b> مستند</span>${wk>0?`<span>الجديد والمعدَّل آخر 7 أيام <b>${sz(wk)}</b></span><span>بهذا المعدل تكفي المساحة تقريباً <b>${mon>=24?"أكثر من سنتين":mon>=1?Math.round(mon)+" شهر":"أقل من شهر"}</b></span>`:""}</div></div>
 <div class="tzh-card"><h3>خطة الاشتراك في Supabase</h3><small>اختر الخطة الحالية ليُحسب الحد والتنبيه عليها. الخطة المجانية لا تأخذ نسخاً احتياطية تلقائية.</small>
 <div class="tzh-plan">${[[500,"المجانية","500 ميجا · بدون نسخ احتياطي تلقائي"],[8192,"Pro","8 جيجا · نسخة احتياطية يومية"]].map(p=>`<button type="button" class="${PLAN===p[0]?"on":""}" data-hl="plan" data-id="${p[0]}" aria-pressed="${PLAN===p[0]}"><b>${p[1]}</b><small>${p[2]}</small></button>`).join("")}</div></div>
 <div class="tzh-card"><h3>ما الذي يملأ المساحة</h3><small>الصور والمرفقات هي الأكبر دائماً. الأرقام للبيانات نفسها دون الفهارس.</small>
 ${top.map(t=>`<div class="tzh-row"><span>${E(NAMES[t.c]||t.c)}<small>${(+t.n||0).toLocaleString("en-US")} مستند</small></span><i><u style="width:${Math.max(2,(+t.b||0)/mx*100).toFixed(1)}%"></u></i><em>${sz(t.b)}</em></div>`).join("")||'<div class="tzh-foot">لا توجد بيانات</div>'}</div>
 <div class="tzh-foot"><span>آخر قياس: <bdi dir="ltr">${new Date(+H.at||Date.now()).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</bdi></span><button type="button" data-hl="refresh" ${busy?"disabled":""}>${busy?"⏳ جاري القياس...":"🔄 قِس الآن"}</button>${err?`<span class="tzh-err">${E(err)}</span>`:""}</div></div>`;
}
async function click(e){
 const t=e.target.closest("[data-hl]");if(!t||!X)return;const a=t.dataset.hl;
 if(a==="refresh")return void load(true);
 if(a==="plan"){const mb=+t.dataset.id;if(!(mb>0)||mb===PLAN)return;const old=PLAN;PLAN=mb;paint();
  try{await setDoc(doc(X.db,"cfg","plan"),{mb,at:Date.now()});if(X.toast)X.toast("تم حفظ الخطة ✅")}
  catch(x){PLAN=old;paint();if(X&&X.toast)X.toast("تعذّر حفظ الخطة. تأكد من لصق القواعد الجديدة","er")}}
}
