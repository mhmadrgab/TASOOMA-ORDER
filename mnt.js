// 🔧 طلبات الصيانة (13 نوفمبر 2026، طلب محمد): الفرع بيطلب صيانة لحاجة معيّنة، ومهندس الصيانة (staff.p.mt، حساب مالوش غير
// المديول ده) بيعتمد ويحدد ميعاد وفني، ويبدأ، ويقفل "تم الإصلاح" بملاحظة وتكلفة وصور بعد، والفرع يأكد أو يرجّعه.
// المهندس (والمدير) يقدر يفتح طلب بنفسه لأي فرع. البيانات: mnt/{id}، والصور mntimg/{id} + x/2..10 (att.js).
// الحالات: new جديد · ok معتمد ومجدول · go قيد التنفيذ · done تم الإصلاح (بانتظار الفرع) · conf أكّده الفرع · no مرفوض
// القواعد: supabase/002_rules.sql (mnt_ok / mnt_upd_ok). الإشعارات: ping(...,[ids]) ← السيرفر onMnt.
import {collection,doc,getDoc,setDoc,updateDoc,onSnapshot,query,where,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {multiPick,saveExtras,loadExtras} from "./att.js";
import {zoomGallery} from "./zoom.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d));
export const CATS=[["كهرباء","⚡"],["تكييف","❄️"],["سباكة","🚿"],["إضاءة","💡"],["نجارة وأبواب","🔨"],["أقفال ومفاتيح","🔑"],["كاشير وأجهزة","💻"],["كاميرات","📷"],["دهانات","🎨"],["زجاج وواجهات","🪟"],["أخرى","🔧"]];
const CI=c=>(CATS.find(x=>x[0]===c)||["","🔧"])[1];
const PRI={n:["عادي","#636a75"],u:["عاجل","#e8740c"],x:["طارئ","#e5372b"]};
const ST={new:["جديد","#b8892a","⏳"],ok:["مجدول","#0b6bdb","🗓"],go:["قيد التنفيذ","#0a8fa3","🔧"],done:["تم الإصلاح","#1f9d45","✅"],conf:["أكّده الفرع","#5f7d6b","✔"],no:["مرفوض","#e5372b","❌"]};
let X=null,A=new Map(),un=null,F={st:"open",br:"",q:""},PK=null,busy=false;
const all=()=>[...A.values()].sort((a,b)=>(a.st==="new")-(b.st==="new")||0).sort((a,b)=>N(b.ts)-N(a.ts));
const isWh=()=>X&&X.mode!=="branch";
const canAct=()=>isWh()&&X.eng===true;// المهندس أو المدير (المتابع لأ)
const ago=t=>{const m=Math.max(0,Math.round((Date.now()-N(t))/6e4));return m<1?"الآن":m<60?`منذ ${m} دقيقة`:m<1440?`منذ ${Math.round(m/60)} ساعة`:`منذ ${Math.round(m/1440)} يوم`};
const dts=t=>new Date(N(t)).toLocaleDateString("en-CA");

const CSS=`
.mt-h{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:4px 0 14px}
.mt-h h2{margin:0;font-size:22px}
.mt-k{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
@media (max-width:720px){.mt-k{grid-template-columns:repeat(2,minmax(0,1fr))}}
.mt-k button{font:inherit;text-align:start;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;padding:12px 14px;cursor:pointer;display:grid;gap:2px;--c:#636a75;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.mt-k button b{font-size:26px;font-variant-numeric:tabular-nums;color:var(--c)}
.mt-k button small{color:var(--mut);font-size:13px}
.mt-k button.on{border-color:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 30%,transparent)}
.mt-f{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.mt-f .ch{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px}
.mt-f .ch.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.mt-f select,.mt-f input{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:7px 10px;min-width:0}
.mt-c{--c:#b8892a;background:var(--card);border:1px solid var(--line);border-inline-start:6px solid var(--c);border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 26px -18px rgba(40,30,10,.45)}
.mt-c .m-hd{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;padding:12px 14px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 11%,transparent),transparent)}
.mt-c .m-hd b{font-size:18px}.mt-c .m-hd small{display:block;color:var(--mut);font-size:13px}
.mt-c .m-st{background:var(--c);color:#fff;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700;white-space:nowrap}
.mt-c .m-bd{padding:0 14px 12px;display:grid;gap:8px}
.mt-c .m-it{font-size:16.5px;font-weight:700}
.mt-c .m-ds{color:var(--ink);opacity:.85;font-size:14.5px;white-space:pre-wrap;word-break:break-word}
.mt-c .m-tg{display:flex;flex-wrap:wrap;gap:6px}
.mt-c .m-tg span{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px;font-size:13px;background:var(--field,#f3f1ed)}
.mt-c .m-tg .m-pri{color:#fff;font-weight:700}
.mt-c .m-nt{border-radius:12px;padding:8px 12px;font-size:14px;background:var(--field,#f3f1ed)}
.mt-c .m-nt.bad{background:color-mix(in srgb,#e5372b 12%,transparent);color:inherit}
.mt-c .m-nt.ok{background:color-mix(in srgb,#1f9d45 12%,transparent)}
.mt-c .m-ac{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--field,#f3f1ed) 55%,transparent)}
.mt-c .m-ac button{font:inherit;font-weight:600;font-size:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:8px 14px;cursor:pointer}
.mt-c .m-ac button.p{background:#1f9d45;border-color:#1f9d45;color:#fff}
.mt-c .m-ac button.b{background:#0b6bdb;border-color:#0b6bdb;color:#fff}
.mt-c .m-ac button.r{color:#c4362b}
.mt-e{text-align:center;color:var(--mut);padding:40px 12px;border:1.5px dashed var(--line);border-radius:16px}
#mtm{display:none;position:fixed;inset:0;z-index:82;background:rgba(0,0,0,.55);overflow:auto;padding:16px}
#mtm.on{display:block}
#mtm>.mk{max-width:560px;margin:4vh auto;background:var(--card);color:var(--ink);border-radius:20px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
#mtm h3{margin:0 0 12px;font-size:19px}
#mtm label{display:block;font-size:13.5px;color:var(--mut);margin:12px 0 5px}
#mtm input,#mtm textarea,#mtm select{font:inherit;width:100%;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);border-radius:12px;padding:10px 12px}
#mtm textarea{min-height:84px;resize:vertical}
#mtm .cats{display:flex;flex-wrap:wrap;gap:6px}
#mtm .cats button,#mtm .pr button{font:inherit;font-size:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}
#mtm .cats button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
#mtm .pr{display:flex;gap:6px;flex-wrap:wrap}
#mtm .pr button.on{color:#fff;border-color:transparent}
#mtm .act{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
#mtm .act button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:10px 18px;cursor:pointer}
#mtm .act button.p{background:#1f9d45;border-color:#1f9d45;color:#fff}
#mtm .act button.r{background:#e5372b;border-color:#e5372b;color:#fff}
#mtm .act button:disabled{opacity:.6;cursor:progress}
#mtbtn{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 14px;padding:14px 18px;border:1px solid var(--line);border-radius:18px;cursor:pointer;font:inherit;text-align:start;color:var(--ink);background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 24px -14px rgba(11,107,219,.35)}
#mtbtn .ic{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;font-size:34px;flex:none;background:none}
#mtbtn .tx{flex:1;min-width:0}#mtbtn .tx b{display:block;font-size:19px}#mtbtn .tx small{display:block;color:var(--mut);font-size:13.5px}
#mtbtn .m-bd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#mtbtn .m-bd span{background:#0b6bdb;color:#fff;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:700}#mtbtn .m-bd span.g{background:#1f9d45}
#mtbtn .ar{font-size:24px;opacity:.6;transform:scaleX(-1)}
@media (prefers-color-scheme:dark){#mtbtn .ic{background:none}}
`;
function css(){if(!g("mt-css")){const s=document.createElement("style");s.id="mt-css";s.textContent=CSS;document.head.appendChild(s)}}

// ---------- البداية ----------
// ctx: {db, toast, mode:"wh"|"branch", me:{e,n}, eng (يقدر يعتمد/يقفل), owner, view (متابع), code, brn (للفرع), branches:[...], ping(ids), redraw(), badge(), mount(btn)}
export function initMnt(ctx){
 stopMnt();X=ctx;css();
 const q=X.mode==="branch"?query(collection(X.db,"mnt"),where("br","==",X.code)):collection(X.db,"mnt");
 un=onSnapshot(q,sn=>{A=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
  if(X.mode==="branch")paintBtn();else{if(X.badge)X.badge();if(X.redraw&&X.active&&X.active())X.redraw()}
  if(g("mtm")&&g("mtm").dataset.v==="list")openBranch();
 },()=>{if(X&&X.toast)X.toast("تعذر قراءة طلبات الصيانة")});
 if(X.mode==="branch"&&X.mount){const b=document.createElement("button");b.id="mtbtn";b.type="button";b.dataset.mt="bopen";X.mount(b);paintBtn()}
}
export function stopMnt(){if(un){un();un=null}A=new Map();const b=g("mtbtn");if(b)b.remove();closeM();X=null}
export const mntCount=()=>X?[...A.values()].filter(r=>canAct()?r.st==="new":r.st==="done").length:0;

// ---------- كارت الفرع ----------
function paintBtn(){const b=g("mtbtn");if(!b)return;const L=[...A.values()],op=L.filter(r=>["new","ok","go"].includes(r.st)).length,dn=L.filter(r=>r.st==="done").length;
 b.innerHTML=`<span class="ic">🔧</span><span class="tx"><b>طلبات الصيانة</b><small>اطلب صيانة لأي شيء في الفرع وتابع المهندس</small>${op||dn?`<span class="m-bd">${op?`<span>${op} مفتوح</span>`:""}${dn?`<span class="g">${dn} بانتظار تأكيدك</span>`:""}</span>`:""}</span><span class="ar">→</span>`}

// ---------- لوحة المستودع / المهندس ----------
export function mntView(){
 if(!X)return "";const L=all();
 const cnt=k=>L.filter(r=>r.st===k).length;
 const K=[["new","جديد","#b8892a"],["ok","مجدول","#0b6bdb"],["go","قيد التنفيذ","#0a8fa3"],["done","بانتظار تأكيد الفرع","#1f9d45"]];
 const brs=[...new Set(L.map(r=>r.brn||r.br))].sort();
 const q=F.q.trim().toLowerCase();
 const V=L.filter(r=>(F.st==="all"||(F.st==="open"?["new","ok","go","done"].includes(r.st):r.st===F.st))&&(!F.br||(r.brn||r.br)===F.br)&&(!q||[r.no,r.brn,r.item,r.desc,r.cat].join(" ").toLowerCase().includes(q)));
 return `<div class="mt-h"><h2>🔧 طلبات الصيانة</h2>${canAct()?`<button class="bt p" data-mt="new" type="button">➕ طلب صيانة جديد</button>`:""}</div>
 <div class="mt-k">${K.map(([k,l,c])=>`<button type="button" data-mt="fst" data-v="${k}" class="${F.st===k?"on":""}" style="--c:${c}"><b>${cnt(k)}</b><small>${l}</small></button>`).join("")}</div>
 <div class="mt-f">${[["open","المفتوحة"],["all","الكل"],["conf","المؤكدة"],["no","المرفوضة"]].map(([k,l])=>`<button type="button" class="ch ${F.st===k?"on":""}" data-mt="fst" data-v="${k}">${l}</button>`).join("")}
 <select id="mt-br" aria-label="الفرع"><option value="">كل الفروع</option>${brs.map(b=>`<option ${F.br===b?"selected":""}>${E(b)}</option>`).join("")}</select>
 <input id="mt-q" type="search" placeholder="بحث: رقم، فرع، صنف..." value="${E(F.q)}" style="flex:1;min-width:160px"></div>
 <div id="mt-list">${V.length?V.map(card).join(""):`<div class="mt-e">🔧<br>${L.length?"لا توجد طلبات بهذا الفلتر":"لا توجد طلبات صيانة بعد"}</div>`}</div>`;
}
function card(r){
 const s=ST[r.st]||ST.new,p=PRI[r.pri]||PRI.n,pl=r.plan||{},fn=r.fin||{},cf=r.conf||{},rj=r.rj||{},wh=isWh();
 let ac="";
 if(wh&&canAct()){
  if(r.st==="new")ac=`<button class="b" data-mt="ap" data-id="${E(r.id)}" type="button">🗓 اعتماد وتحديد موعد</button><button class="r" data-mt="rj" data-id="${E(r.id)}" type="button">❌ رفض</button>`;
  else if(r.st==="ok")ac=`<button class="b" data-mt="go" data-id="${E(r.id)}" type="button">🔧 بدء التنفيذ</button><button class="p" data-mt="fin" data-id="${E(r.id)}" type="button">✅ تم الإصلاح</button><button data-mt="ap" data-id="${E(r.id)}" type="button">✏️ تعديل الموعد</button><button class="r" data-mt="rj" data-id="${E(r.id)}" type="button">❌ رفض</button>`;
  else if(r.st==="go")ac=`<button class="p" data-mt="fin" data-id="${E(r.id)}" type="button">✅ تم الإصلاح</button><button data-mt="ap" data-id="${E(r.id)}" type="button">✏️ تعديل الموعد</button>`;
 }
 if(!wh&&r.st==="done")ac=`<button class="p" data-mt="cok" data-id="${E(r.id)}" type="button">✅ نعم، تم الإصلاح</button><button class="r" data-mt="cno" data-id="${E(r.id)}" type="button">↩️ لم يُصلح</button>`;
 const pic=r.img?`<button data-mt="img" data-id="${E(r.id)}" type="button">📷 الصور</button>`:"";
 return `<div class="mt-c" style="--c:${s[1]}"><div class="m-hd"><div><b><bdi dir="ltr">${E(r.brn||r.br)}</bdi></b><small><bdi dir="ltr">${E(r.no||"")}</bdi> · ${ago(r.ts)}${r.src==="eng"?" · 🧑‍🔧 فتحه المهندس":""}</small></div><span class="m-st">${s[2]} ${s[0]}</span></div>
 <div class="m-bd"><div class="m-it">${CI(r.cat)} ${E(r.item||"")}</div>${r.desc?`<div class="m-ds" data-notr>${E(r.desc)}</div>`:""}
 <div class="m-tg"><span class="m-pri" style="background:${p[1]}">${p[0]}</span><span>${E(r.cat||"")}</span>${pl.vd?`<span>🗓 الموعد: <bdi dir="ltr">${E(pl.vd)}</bdi></span>`:""}${pl.tech?`<span>👷 ${E(pl.tech)}</span>`:""}${N(fn.cost)?`<span>💵 ${N(fn.cost)} ريال</span>`:""}</div>
 ${pl.note?`<div class="m-nt" data-notr>🗒 ${E(pl.note)}</div>`:""}${r.st==="no"&&rj.note?`<div class="m-nt bad" data-notr>❌ سبب الرفض: ${E(rj.note)}</div>`:""}
 ${fn.at?`<div class="m-nt ok"><b>✅ تم الإصلاح ${dts(fn.at)}</b>${fn.note?`<div data-notr>${E(fn.note)}</div>`:""}</div>`:""}
 ${cf.at&&cf.ok===false?`<div class="m-nt bad"><b>↩️ الفرع أفاد بأن المشكلة لم تُحل</b>${cf.note?`<div data-notr>${E(cf.note)}</div>`:""}</div>`:""}
 ${r.st==="conf"?`<div class="m-nt ok">✔ أكّد الفرع الإصلاح ${dts(cf.at)}</div>`:""}</div>
 ${ac||pic?`<div class="m-ac">${ac}${pic}</div>`:""}</div>`;
}

// ---------- النوافذ ----------
function box(){let m=g("mtm");if(!m){m=document.createElement("div");m.id="mtm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(html,v){const m=box();m.innerHTML=`<div class="mk">${html}</div>`;m.dataset.v=v||"";m.className="on"}
function closeM(){const m=g("mtm");if(m){m.className="";m.innerHTML="";m.dataset.v=""}PK=null;busy=false}

// نافذة الفرع: طلباته + زرار طلب جديد
function openBranch(){
 const L=all();
 openM(`<h3>🔧 طلبات الصيانة · <bdi dir="ltr">${E(X.brn||X.code)}</bdi></h3>
 <div class="act" style="margin:0 0 12px"><button class="p" data-mt="new" type="button">➕ طلب صيانة جديد</button><button data-mt="close" type="button">إغلاق</button></div>
 ${L.length?L.map(card).join(""):`<div class="mt-e">🔧<br>لم تطلب أي صيانة بعد</div>`}`,"list");
}
// طلب جديد (الفرع أو المهندس)
function form(){
 let cat="",pri="n";
 const wh=isWh(),brs=wh?(X.branches||[]):[];
 openM(`<h3>➕ طلب صيانة جديد</h3>
 ${wh?`<label>الفرع *</label><select id="mt-fb">${brs.map(b=>`<option>${E(b)}</option>`).join("")}</select>`:""}
 <label>نوع العطل *</label><div class="cats" id="mt-cats">${CATS.map(([c,i])=>`<button type="button" data-c="${E(c)}" class="${c===cat?"on":""}">${i} ${E(c)}</button>`).join("")}</div>
 <label>الشيء المطلوب صيانته *</label><input id="mt-it" maxlength="100" placeholder="مثلاً: مكيف الصالة، باب المخزن، لمبة الواجهة">
 <label>وصف المشكلة</label><textarea id="mt-ds" maxlength="1000" placeholder="اكتب ما الذي يحدث بالضبط"></textarea>
 <label>الأولوية</label><div class="pr" id="mt-pr">${Object.entries(PRI).map(([k,[l,c]])=>`<button type="button" data-p="${k}" class="${k===pri?"on":""}" ${k===pri?`style="background:${c}"`:""}>${l}</button>`).join("")}</div>
 <label>صور المشكلة (اختياري)</label><div id="mt-mp"></div>
 <div class="act"><button class="p" data-mt="save" type="button">إرسال الطلب</button><button data-mt="${wh?"close":"bopen"}" type="button">رجوع</button></div>`,"form");
 PK=multiPick(g("mt-mp"),{w:1400,cap:230000,toast:X.toast});
 g("mt-cats").onclick=e=>{const b=e.target.closest("[data-c]");if(!b)return;cat=b.dataset.c;g("mt-cats").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b))};
 g("mt-pr").onclick=e=>{const b=e.target.closest("[data-p]");if(!b)return;pri=b.dataset.p;g("mt-pr").querySelectorAll("button").forEach(x=>{const on=x===b;x.classList.toggle("on",on);x.style.background=on?PRI[x.dataset.p][1]:""})};
 g("mt-it").focus();
 form.get=()=>({cat,pri});
}
async function save(){
 if(busy)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const {cat,pri}=form.get();if(!cat){X.toast("اختر نوع العطل");return}const item=g("mt-it").value.trim().slice(0,100),desc=g("mt-ds").value.trim().slice(0,1000),IMS=PK?PK.imgs():[];
 if(!item){X.toast("اكتب الشيء المطلوب صيانته");g("mt-it").focus();return}
 const wh=isWh(),brn=wh?String(g("mt-fb").value||""):String(X.brn||X.code),br=brn.split("-")[0];
 if(!/^\d{3}$/.test(br)){X.toast("اختر الفرع");return}
 const ts=Date.now(),dd=new Date(ts),p=n=>String(n).padStart(2,"0");
 const ref=doc(collection(X.db,"mnt"));
 const d={br,brn:brn.slice(0,40),no:`M-${br}-${p(dd.getMonth()+1)}${p(dd.getDate())}-${p(dd.getHours())}${p(dd.getMinutes())}`,ts,dt:dd.toLocaleDateString("en-CA"),cat,item,pri,st:wh?"ok":"new",by:{e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)},src:wh?"eng":"br"};
 if(desc)d.desc=desc;if(IMS.length)d.img=1;
 const btn=document.querySelector('[data-mt="save"]');busy=true;if(btn){btn.disabled=true;btn.textContent="⏳ جاري الإرسال..."}
 try{const b=writeBatch(X.db);b.set(ref,d);if(IMS[0])b.set(doc(X.db,"mntimg",ref.id),{img:IMS[0]});await withTimeout(b.commit(),20000);
  let bad=0;if(IMS.length>1){if(btn)btn.textContent=`⏳ رفع الصور (${IMS.length})...`;bad=await saveExtras(X.db,"mntimg",ref.id,IMS.slice(1))}
  if(X.ping)X.ping([ref.id]);busy=false;
  X.toast(bad?`أُرسل الطلب، لكن تعذّر رفع ${bad} من الصور`:wh?"✅ فُتح طلب الصيانة للفرع":"✅ أُرسل طلب الصيانة للمهندس",bad?"er":undefined);
  if(wh)closeM();else openBranch();
 }catch(e){busy=false;if(btn){btn.disabled=false;btn.textContent="إرسال الطلب"}const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")}
}
// المهندس: اعتماد/تعديل الموعد
function apForm(id){const r=A.get(id);if(!r)return;const pl=r.plan||{};
 openM(`<h3>🗓 ${r.st==="new"?"اعتماد وتحديد موعد":"تعديل الموعد"}</h3><div class="mt-c" style="--c:${(ST[r.st]||ST.new)[1]};margin:0"><div class="m-hd"><div><b><bdi dir="ltr">${E(r.brn)}</bdi></b><small>${CI(r.cat)} ${E(r.item)}</small></div></div></div>
 <label>موعد الزيارة</label><input id="mt-vd" type="date" value="${E(pl.vd||new Date(Date.now()+864e5).toLocaleDateString("en-CA"))}">
 <label>اسم الفني</label><input id="mt-tc" maxlength="60" value="${E(pl.tech||"")}" placeholder="من سيقوم بالإصلاح">
 <label>ملاحظة للفرع (اختياري)</label><textarea id="mt-nt" maxlength="300">${E(pl.note||"")}</textarea>
 <div class="act"><button class="p" data-mt="apsave" data-id="${E(id)}" type="button">حفظ</button><button data-mt="close" type="button">رجوع</button></div>`,"ap")}
async function upd(id,patch,okMsg){
 if(busy)return false;busy=true;
 try{await withTimeout(updateDoc(doc(X.db,"mnt",id),{...patch,upd:Date.now()}),15000);busy=false;if(X.ping)X.ping([id]);X.toast(okMsg);return true}
 catch(e){busy=false;const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما الطلب تغيّر أو القواعد لم تتحدّث":FAIL_MSG[w],"er");return false}
}
const who=()=>({e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)});
async function apSave(id){const r=A.get(id);if(!r)return;
 const vd=g("mt-vd").value,tech=g("mt-tc").value.trim().slice(0,60),note=g("mt-nt").value.trim().slice(0,300);
 const plan={vd:String(vd||"").slice(0,20),at:Date.now(),...who()};if(tech)plan.tech=tech;if(note)plan.note=note;
 if(await upd(id,{plan,st:r.st==="new"?"ok":r.st},r.st==="new"?"✅ اعتُمد الطلب وأُبلغ الفرع بالموعد":"تم تعديل الموعد"))closeM();
}
function rjForm(id){const r=A.get(id);if(!r)return;
 openM(`<h3>❌ رفض طلب الصيانة</h3><p style="margin:0;color:var(--mut)"><bdi dir="ltr">${E(r.brn)}</bdi> · ${E(r.item)}</p>
 <label>سبب الرفض *</label><textarea id="mt-rn" maxlength="300" placeholder="سيصل السبب إلى الفرع"></textarea>
 <div class="act"><button class="r" data-mt="rjsave" data-id="${E(id)}" type="button">رفض</button><button data-mt="close" type="button">رجوع</button></div>`,"rj");g("mt-rn").focus()}
async function rjSave(id){const note=g("mt-rn").value.trim().slice(0,300);if(!note){X.toast("اكتب سبب الرفض");return}
 if(await upd(id,{st:"no",rj:{at:Date.now(),note,...who()}},"رُفض الطلب وأُبلغ الفرع"))closeM()}
function finForm(id){const r=A.get(id);if(!r)return;
 openM(`<h3>✅ تم الإصلاح</h3><p style="margin:0;color:var(--mut)"><bdi dir="ltr">${E(r.brn)}</bdi> · ${CI(r.cat)} ${E(r.item)}</p>
 <label>ما الذي تم؟</label><textarea id="mt-fn" maxlength="500" placeholder="مثلاً: تم تغيير الكمبروسر وتنظيف الفلاتر"></textarea>
 <label>التكلفة بالريال (اختياري)</label><input id="mt-fc" inputmode="decimal" placeholder="0">
 <label>صور بعد الإصلاح (اختياري)</label><div id="mt-fp"></div>
 <div class="act"><button class="p" data-mt="finsave" data-id="${E(id)}" type="button">تم، أبلغ الفرع</button><button data-mt="close" type="button">رجوع</button></div>`,"fin");
 PK=multiPick(g("mt-fp"),{w:1400,cap:230000,toast:X.toast})}
async function finSave(id){const r=A.get(id);if(!r)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const note=g("mt-fn").value.trim().slice(0,500),cost=Math.round(N(toEn(g("mt-fc").value))*100)/100,IMS=PK?PK.imgs():[];
 const fin={at:Date.now(),...who()};if(note)fin.note=note;if(cost>0)fin.cost=cost;
 const btn=document.querySelector('[data-mt="finsave"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 // صور بعد الإصلاح: بعد آخر صورة موجودة (أو الأولى لو مفيش)
 if(IMS.length){try{let L=IMS;if(!r.img){await setDoc(doc(X.db,"mntimg",id),{img:IMS[0]});L=IMS.slice(1)}const ex=await loadExtras(X.db,"mntimg",id);const st=ex.length?Math.max(...ex.map(x=>x.k))+1:2;if(L.length)await saveExtras(X.db,"mntimg",id,L,st)}catch(e){X.toast("تعذّر رفع بعض الصور","er")}}
 const ok=await upd(id,{st:"done",fin,...(IMS.length&&!r.img?{img:1}:{})},"✅ سُجّل الإصلاح وأُبلغ الفرع ليؤكد");
 if(ok)closeM();else if(btn){btn.disabled=false;btn.textContent="تم، أبلغ الفرع"}
}
// الفرع: تأكيد أو "لم يُصلح"
function cnoForm(id){const r=A.get(id);if(!r)return;
 openM(`<h3>↩️ لم يُصلح؟</h3><p style="margin:0;color:var(--mut)">${CI(r.cat)} ${E(r.item)}</p>
 <label>ما المشكلة الآن؟ *</label><textarea id="mt-cn" maxlength="300" placeholder="سيصل للمهندس"></textarea>
 <div class="act"><button class="r" data-mt="cnosave" data-id="${E(id)}" type="button">إرجاع للمهندس</button><button data-mt="bopen" type="button">رجوع</button></div>`,"cno");g("mt-cn").focus()}
async function conf(id,ok,note){
 const c={at:Date.now(),ok,n:String(X.me.n||X.brn||X.code||"").slice(0,60)};if(note)c.note=note;
 if(await upd(id,{st:ok?"conf":"ok",conf:c},ok?"✔ شكراً، تم تأكيد الإصلاح":"↩️ أُرجع الطلب للمهندس"))openBranch()}
async function showImgs(id){
 try{const [s,ex]=await Promise.all([getDoc(doc(X.db,"mntimg",id)),loadExtras(X.db,"mntimg",id)]);const L=[];const im=s.exists()?s.data().img:"";
  if(im)L.push({src:im,del:`mntimg/${id}/img`});ex.forEach(x=>L.push({src:x.src,del:"doc:"+x.path}));
  const r=A.get(id);if(!L.length){X.toast("لا توجد صور");return}zoomGallery(L,`${r?r.no:""} · ${r?r.item:""}`,0)}
 catch(e){X.toast("تعذر تحميل الصور")}
}

// ---------- الضغطات ----------
document.addEventListener("click",e=>{
 if(!X)return;const t=e.target.closest&&e.target.closest("[data-mt]");if(!t)return;
 const a=t.dataset.mt,id=t.dataset.id;
 if(X.view&&!["fst","img","close","bopen"].includes(a))return;
 if(a==="bopen")return void openBranch();
 if(a==="close")return void closeM();
 if(a==="new")return void form();
 if(a==="save")return void save();
 if(a==="fst"){F.st=t.dataset.v;if(X.redraw)X.redraw();return}
 if(a==="img")return void showImgs(id);
 if(a==="ap")return void apForm(id);
 if(a==="apsave")return void apSave(id);
 if(a==="rj")return void rjForm(id);
 if(a==="rjsave")return void rjSave(id);
 if(a==="go")return void upd(id,{st:"go"},"🔧 بدأ التنفيذ، وأُبلغ الفرع");
 if(a==="fin")return void finForm(id);
 if(a==="finsave")return void finSave(id);
 if(a==="cok")return void conf(id,true);
 if(a==="cno")return void cnoForm(id);
 if(a==="cnosave"){const n=g("mt-cn").value.trim().slice(0,300);if(!n){X.toast("اكتب ما المشكلة");return}return void conf(id,false,n)}
});
document.addEventListener("change",e=>{if(!X)return;if(e.target.id==="mt-br"){F.br=e.target.value;if(X.redraw)X.redraw()}});
document.addEventListener("input",e=>{if(!X||e.target.id!=="mt-q")return;F.q=e.target.value;const L=g("mt-list");if(!L)return;
 // بحث فوري من غير إعادة رسم الصفحة (علشان الخانة ماتفقدش التركيز)
 const q=F.q.trim().toLowerCase();L.querySelectorAll(".mt-c").forEach(c=>{c.hidden=!!q&&!c.textContent.toLowerCase().includes(q)})});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&g("mtm")&&g("mtm").className==="on")closeM()});
