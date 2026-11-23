// 🧭 المشاوير (v223، 23 نوفمبر 2026، طلب محمد: «السواقين بيروحو مشاوير خارج الفروع زي الإدارة يودّي عينات تصوير… ومديري في الإدارة حابب يتابع»)
//   قسم في «السيارات»: مشوار جديد (المكان + ماذا يحمل + السائق) ← يظهر عند السائق في تطبيقه بجانب توصيلاته، ويخرج به في رحلة
//   ويسجّل الوصول باسم المستلم وصورة (إجباري). المتابعة على خريطة السيارات اللايف. الإشعارات من السيرفر (onErrand).
//   errands/{id} = {no, brn (المكان), note, ct?, st: prep|go|done|x, asg:{drv,drvn}, by:{e,n}, ts, upd, dep?, eta?, dlv?, pod?, x?}
//   places/main = {l:[{n, lat?, lng?}]}: أسماء الأماكن، والموقع اختياري (يُتعلَّم من وصول السائقين في geo/main كأي فرع).
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});// نفس صيغة السيارات
const day=t=>new Date(N(t)).toLocaleDateString("en-CA");
export const placeName=s=>String(s==null?"":s).replace(/[<>"&]/g,"").replace(/-/g," ").replace(/\s+/g," ").trim().slice(0,40);
let X=null,OPEN=new Map(),RECENT=new Map(),PL=[],un=[],BUSY=false;
const all=()=>{const m=new Map(RECENT);OPEN.forEach((v,k)=>m.set(k,v));return [...m.values()]};
// ---------- الأماكن ----------
export function errPlace(code){const c=String(code||"");const p=PL.find(x=>x.n===c);return p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)?{lat:+p.lat,lng:+p.lng}:null}
export const errIsPlace=code=>PL.some(x=>x.n===String(code||""));
// رابط خرائط جوجل أو «خط العرض، خط الطول»
export function parseLoc(s){
 const t=String(s||"").trim();let m=t.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)||t.match(/[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i)||t.match(/^\s*(-?\d{1,2}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)\s*$/)||t.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
 if(!m)return null;const lat=+(+m[1]).toFixed(5),lng=+(+m[2]).toFixed(5);if(Math.abs(lat)>90||Math.abs(lng)>180||(lat===0&&lng===0))return null;return {lat,lng};
}
async function savePlaces(l){const by={e:String(X.me.e||"").slice(0,120),n:String(X.me.n||"").slice(0,60)};await X.fb.setDoc(X.fb.doc(X.db,"places","main"),{l:l.slice(0,100),at:Date.now(),by})}
// ---------- العرض ----------
const ST={prep:["⏳ بانتظار خروج السائق","#946000"],go:["🚚 في الطريق","#2a78d6"],done:["✅ وصل","#4b6b25"],x:["ملغى","#74687a"]};
export function errandView(){
 if(!X)return "";
 const L=all().filter(r=>r.st!=="x").sort((a,b)=>(a.st==="done")-(b.st==="done")||N(b.ts)-N(a.ts));
 const dr=(X.drivers?X.drivers():[]).filter(d=>d.enabled);const can=X.staff===true;
 const row=r=>{const s=ST[r.st]||ST.prep;
  const stat=r.st==="done"?`<span style="color:${s[1]};font-weight:700">${s[0]} ${hm(r.dlv)}</span>${r.pod&&r.pod.name?`<small class="off" style="display:block">استلم: <span data-notr>${E(r.pod.name)}</span></small>`:""}${r.pod&&r.pod.ph?`<button class="bt s" type="button" data-podv="${E(r.id)}|img" data-zt="صورة الوصول · ${E(r.brn)}">📷 صورة الوصول</button>`:""}`
   :`<span style="color:${s[1]};font-weight:700">${s[0]}</span>${r.st==="go"&&N(r.eta)?`<small class="off" style="display:block">متوقع ~${hm(r.eta)}</small>`:""}`;
  const act=can&&r.st==="prep"?`<select data-erd="${E(r.id)}" aria-label="السائق">${dr.map(d=>`<option value="${E(d.id)}" ${d.id===(r.asg&&r.asg.drv)?"selected":""}>${E(d.name)}</option>`).join("")}</select> <button class="bt s" data-er="re" data-id="${E(r.id)}" type="button">تعيين</button> <button class="bt s r" data-er="x" data-id="${E(r.id)}" type="button">إلغاء</button>`:"";
  return `<tr><td class="l"><b data-notr>${E(r.brn)}</b><small class="off" style="display:block">${day(r.ts)} ${hm(r.ts)}</small></td><td class="l" style="white-space:normal;max-width:260px"><span data-notr>${E(r.note)}</span>${r.ct?`<small class="off" style="display:block">المستلم: <span data-notr>${E(r.ct)}</span></small>`:""}</td><td>${E(r.asg&&r.asg.drvn||"")}</td><td>${stat}</td><td><small data-notr>${E(r.by&&r.by.n||"")}</small></td><td style="white-space:nowrap">${act}</td></tr>`};
 const plc=PL.map(p=>{const k=Number.isFinite(+p.lat);return `<div class="er-pl"><b data-notr>${E(p.n)}</b><span class="off">${k?"📍 موقعه محفوظ":"الموقع يُعرف من أول وصول للسائق"}</span>${can?`<button class="bt s" data-er="ploc" data-n="${E(p.n)}" type="button">📍 ${k?"تعديل":"تحديد"} الموقع</button><button class="bt s" data-er="pdel" data-n="${E(p.n)}" type="button">حذف</button>`:""}</div>`}).join("");
 return `<style>.er-pl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-bottom:1px dashed var(--line)}.er-pl b{min-width:120px}</style>
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">🧭 المشاوير</h3>${can?`<button class="bt s g" data-er="new" type="button" style="margin-inline-start:auto">➕ مشوار جديد</button>`:""}</div>
 <div class="pan"><p class="off" style="font-size:13px;margin:0 0 8px">مشوار لمكان غير الفروع (الإدارة، استوديو التصوير…): يظهر عند السائق في تطبيقه بجانب توصيلاته، ويسجّل الوصول باسم المستلم وصورة. تابعه على الخريطة أعلاه.</p>
 <div class="tw"><table><thead><tr><th>المكان</th><th>ماذا يحمل</th><th>السائق</th><th>الحالة</th><th>أنشأه</th><th></th></tr></thead><tbody>${L.length?L.map(row).join(""):'<tr><td colspan="6" class="off" style="text-align:center;padding:18px">لا توجد مشاوير مفتوحة أو حديثة</td></tr>'}</tbody></table></div>
 ${PL.length||can?`<details style="margin-top:10px"><summary>📍 الأماكن المحفوظة (${PL.length})</summary>${plc||'<div class="off" style="padding:6px 0">تُحفظ تلقائياً مع أول مشوار لكل مكان.</div>'}</details>`:""}</div>`;
}
// ---------- النافذة ----------
function box(){let m=g("erm");if(!m){m=document.createElement("div");m.id="erm";m.className="fm";document.body.appendChild(m)}return m}
function closeM(){const m=box();m.className="fm";m.innerHTML="";BUSY=false}
function form(){
 const dr=(X.drivers?X.drivers():[]).filter(d=>d.enabled);
 const m=box();m.innerHTML=`<div class="fk"><h3>🧭 مشوار جديد</h3>
 <label>المكان *</label><input id="er-p" list="er-pl" maxlength="40" autocomplete="off" placeholder="مثلاً: الإدارة"><datalist id="er-pl">${PL.map(p=>`<option value="${E(p.n)}">`).join("")}</datalist>
 <label>ماذا يحمل / ماذا يفعل *</label><input id="er-n" maxlength="200" autocomplete="off" placeholder="مثلاً: عينات تصوير">
 <label>اسم أو جوال من سيستلم (اختياري)</label><input id="er-c" maxlength="80" autocomplete="off">
 <label>السائق *</label><select id="er-d"><option value="">اختر</option>${dr.map(d=>`<option value="${E(d.id)}">${E(d.name)}</option>`).join("")}</select>
 <label>موقع المكان (اختياري، لمكان جديد)</label><input id="er-l" dir="ltr" autocomplete="off" placeholder="الصق رابط خرائط جوجل أو 24.71, 46.67">
 <small class="off" style="display:block;line-height:1.7">إن تركته فارغاً يُعرف الموقع تلقائياً من أول وصول للسائق.</small>
 <div class="fl2" style="margin-top:16px"><button class="bt p" data-er="save" type="button">إرسال للسائق</button><button class="bt" data-er="close" type="button">رجوع</button></div></div>`;
 m.className="fm on";setTimeout(()=>{const i=g("er-p");if(i)i.focus()},40);
}
async function save(btn){
 if(BUSY)return;const brn=placeName(g("er-p").value),note=String(g("er-n").value||"").trim().slice(0,200),ct=String(g("er-c").value||"").trim().slice(0,80),dv=(X.drivers?X.drivers():[]).find(d=>d.id===g("er-d").value),lr=String(g("er-l").value||"").trim();
 if(!brn){X.toast("اكتب اسم المكان");return}if(!note){X.toast("اكتب ماذا يحمل السائق أو ماذا يفعل");return}if(!dv){X.toast("اختر السائق");return}
 const loc=lr?parseLoc(lr):null;if(lr&&!loc){X.toast("لم أفهم الموقع. الصق رابط خرائط جوجل الكامل أو اكتب الإحداثيات مثل 24.71, 46.67","er");return}
 BUSY=true;btn.disabled=true;const ts=Date.now(),d=new Date(ts),p2=x=>String(x).padStart(2,"0");
 try{
  const ref=X.fb.doc(X.fb.collection(X.db,"errands")),data={no:`M-${p2(d.getMonth()+1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`,brn,note,st:"prep",asg:{drv:dv.id,drvn:String(dv.name||"").slice(0,60)},by:{e:String(X.me.e||"").slice(0,120),n:String(X.me.n||"").slice(0,60)},ts,upd:ts};if(ct)data.ct=ct;
  await X.fb.setDoc(ref,data);
  const i=PL.findIndex(p=>p.n===brn);if(i<0||loc){const l=PL.map(p=>({...p}));const o=i<0?{n:brn}:l[i];if(loc){o.lat=loc.lat;o.lng=loc.lng}if(i<0)l.push(o);try{await savePlaces(l)}catch(e){}}
  closeM();if(X.ping)X.ping([ref.id]);X.toast(`✅ أُرسل المشوار إلى ${dv.name}`);
 }catch(e){BUSY=false;btn.disabled=false;X.toast("تعذّر الحفظ: "+(e&&(e.code||e.message)||""),"er")}
}
// المشاوير التي لم يصل إليها السائق في رحلة انتهت أو أُزيلت منها: ترجع «بانتظار خروج السائق» لنفس السائق
export async function errBack(ids){
 const L=(ids||[]).filter(id=>{const r=OPEN.get(id);return r&&r.st==="go"});if(!L.length||!X)return 0;
 const b=X.fb.writeBatch(X.db),ts=Date.now();L.forEach(id=>b.update(X.fb.doc(X.db,"errands",id),{st:"prep",upd:ts}));
 try{await b.commit();return L.length}catch(e){return 0}
}
export const errHas=id=>OPEN.has(id)||RECENT.has(id);
if(!errandView.w){errandView.w=1;
 document.addEventListener("click",async e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-er]");if(!b||!X)return;const a=b.dataset.er,id=b.dataset.id;
  if(a==="close")return void closeM();
  if(X.staff!==true)return;
  if(a==="new")return void form();
  if(a==="save")return void save(b);
  const r=id?OPEN.get(id):null;
  if(a==="re"&&r){const sel=document.querySelector(`[data-erd="${id}"]`),dv=(X.drivers?X.drivers():[]).find(d=>d.id===(sel&&sel.value));if(!dv)return;
   try{await X.fb.updateDoc(X.fb.doc(X.db,"errands",id),{asg:{drv:dv.id,drvn:String(dv.name||"").slice(0,60)},upd:Date.now()});if(X.ping)X.ping([id]);X.toast("✅ عُيّن المشوار إلى "+dv.name)}catch(x){X.toast("تعذّر الحفظ","er")}return}
  if(a==="x"&&r){if(!confirm(`إلغاء مشوار «${r.brn}»؟`))return;try{await X.fb.updateDoc(X.fb.doc(X.db,"errands",id),{st:"x",x:{at:Date.now(),e:String(X.me.e||"").slice(0,120),n:String(X.me.n||"").slice(0,60)},upd:Date.now()});if(X.ping)X.ping([id]);X.toast("أُلغي المشوار")}catch(x){X.toast("تعذّر الإلغاء","er")}return}
  if(a==="ploc"){const n=b.dataset.n,p=PL.find(x=>x.n===n);if(!p)return;const v=prompt(`موقع «${n}»: الصق رابط خرائط جوجل أو اكتب الإحداثيات (مثل 24.71, 46.67). اتركه فارغاً لمسح الموقع المحفوظ.`,Number.isFinite(+p.lat)?p.lat+", "+p.lng:"");if(v===null)return;
   const loc=v.trim()?parseLoc(v):null;if(v.trim()&&!loc){X.toast("لم أفهم الموقع. الصق الرابط الكامل أو الإحداثيات","er");return}
   const l=PL.map(x=>{if(x.n!==n)return x;const o={n:x.n};if(loc){o.lat=loc.lat;o.lng=loc.lng}return o});try{await savePlaces(l);X.toast(loc?"✅ حُفظ الموقع":"مُسح الموقع")}catch(x){X.toast("تعذّر الحفظ","er")}return}
  if(a==="pdel"){const n=b.dataset.n;if(!confirm(`حذف «${n}» من الأماكن المحفوظة؟ (المشاوير السابقة لا تتأثر)`))return;try{await savePlaces(PL.filter(x=>x.n!==n));X.toast("حُذف المكان")}catch(x){X.toast("تعذّر الحذف","er")}return}
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){const m=g("erm");if(m&&m.className.includes("on"))closeM()}});
}
// ---------- التشغيل ----------
export function initErrand(ctx){
 stopErrand();X=ctx;const F=X.fb,since=Date.now()-3*864e5;
 const tick=()=>{if(X&&X.redraw)X.redraw()};
 un.push(F.onSnapshot(F.query(F.collection(X.db,"errands"),F.where("st","in",["prep","go"])),sn=>{OPEN=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));tick()},()=>{}));
 un.push(F.onSnapshot(F.query(F.collection(X.db,"errands"),F.where("ts",">=",since)),sn=>{RECENT=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));tick()},()=>{}));
 un.push(F.onSnapshot(F.doc(X.db,"places","main"),d=>{const l=d.exists()&&Array.isArray(d.data().l)?d.data().l:[];PL=l.filter(p=>p&&p.n).map(p=>({n:String(p.n),...(Number.isFinite(+p.lat)?{lat:+p.lat,lng:+p.lng}:{})}));tick()},()=>{}));
}
export function stopErrand(){un.forEach(f=>{try{f()}catch(e){}});un=[];OPEN=new Map();RECENT=new Map();PL=[];const m=g("erm");if(m){m.className="fm";m.innerHTML=""}X=null}
export const errState=()=>({open:OPEN.size,recent:RECENT.size,places:PL.length});
