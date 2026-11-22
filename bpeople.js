// 👥 أشخاص الفروع + 🖥 كمبيوتر الفروع (v215، 22 نوفمبر 2026). ⚙ الإعدادات ← «أشخاص الفروع» (الأدمن ومالك النظام فقط؛ القواعد كذلك).
// الشخص: حساب دخول p{رقم}@tasooma.app (يكتب رقمه فقط في شاشة دخول الفرع) + ملف bper/{رقم} = {n, br, r: e|m, on, h?, at, by}.
//   موظف (e): الطلب والاستلام والمتابعة والدردشة. مدير الفرع (m): كل شيء في فرعه. النقل بين الفروع يُحفظ في h (من أي فرع، متى، ومن نقله).
// الكمبيوتر: bdev/{رقم} = {br, h: بصمة المفتاح, n, on, at, by}. الرمز (رقم.مفتاح) يظهر مرة واحدة ويُكتب في إعدادات الفرع على ذلك الكمبيوتر.
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number(v)||0;
const g=id=>document.getElementById(id);
const AL="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",AN="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rnd=(n,a)=>[...crypto.getRandomValues(new Uint32Array(n))].map(x=>a[x%a.length]).join("");
const dt=t=>{if(!t)return "";const d=new Date(N(t));return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"})};
const ROLE={e:"موظف",m:"مدير الفرع"};
let X=null,P=new Map(),DV=new Map(),UN=[],ON=false,LAST=null,DLAST=null,F={br:"",q:""},BUSY=false;
const CSS=`
.bpx-g{display:grid;grid-template-columns:minmax(140px,1.4fr) minmax(130px,1fr) minmax(110px,.8fr) auto;gap:8px;align-items:end}
.bpx-g label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:3px}
.bpx-g input,.bpx-g select{width:100%;box-sizing:border-box}
.bpx-new{margin:12px 0 0;padding:12px 14px;border-radius:14px;background:rgba(111,125,69,.12);border:1px solid rgba(111,125,69,.35)}
.bpx-new b{font-size:15px}.bpx-new code{font-size:16px;font-weight:800;direction:ltr;unicode-bidi:isolate;letter-spacing:.5px}
.bpx-new .bpx-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.bpx-f{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 8px}.bpx-f>*{min-width:0}
.bpx-t{width:100%;border-collapse:collapse;font-size:14px}
.bpx-t th{text-align:start;font-size:12px;color:var(--mut);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line)}
.bpx-t td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}
.bpx-t td.n{font-weight:800;direction:ltr;text-align:end;white-space:nowrap}
.bpx-t tr.off td{opacity:.55}
.bpx-r{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(138,90,131,.14);color:var(--ink)}.bpx-r.m{background:#8a5a83;color:#fff}
.bpx-a{display:flex;gap:6px;flex-wrap:wrap}.bpx-a .bt{padding:4px 10px;font-size:12.5px}
.bpx-a select{max-width:150px;font-size:12.5px;padding:3px 6px}
.bpx-h{display:block;font-size:11.5px;color:var(--mut);margin-top:2px}
@media (max-width:760px){.bpx-g{grid-template-columns:1fr 1fr}.bpx-t thead{display:none}.bpx-t,.bpx-t tbody,.bpx-t tr,.bpx-t td{display:block;width:100%;box-sizing:border-box}
 .bpx-t tr{border:1px solid var(--line);border-radius:12px;margin-bottom:8px;padding:4px}.bpx-t td{border:0;padding:4px 8px}.bpx-t td.n{text-align:start}}
`;
function css(){if(!g("bpx-css")){const s=document.createElement("style");s.id="bpx-css";s.textContent=CSS;document.head.appendChild(s)}}
// ctx: {db, fb:{collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot}, mkUser(email,pw), setPw(email,pw), branches:()=>["003-EL MALQA",…], toast, redraw, me}
export function initBp(ctx){X=ctx;css();document.removeEventListener("click",onClick);document.addEventListener("click",onClick);document.removeEventListener("change",onChange);document.addEventListener("change",onChange)}
function start(){
 if(ON||!X)return;ON=true;const {collection,onSnapshot}=X.fb;
 UN.push(onSnapshot(collection(X.db,"bper"),s=>{P=new Map();s.docs.forEach(d=>P.set(d.id,d.data()));X.redraw()},()=>{}));
 UN.push(onSnapshot(collection(X.db,"bdev"),s=>{DV=new Map();s.docs.forEach(d=>DV.set(d.id,d.data()));X.redraw()},()=>{}));
}
export function stopBp(){UN.forEach(f=>{try{f()}catch(e){}});UN=[];ON=false;P=new Map();DV=new Map();LAST=null;DLAST=null;document.removeEventListener("click",onClick);document.removeEventListener("change",onChange);X=null}
const brs=()=>(X&&X.branches?X.branches():[]).map(String);
const brName=c=>brs().find(b=>b.split("-")[0]===c)||c;
const opts=(sel,all)=>(all?`<option value="">كل الفروع</option>`:"")+brs().map(b=>{const c=b.split("-")[0];return `<option value="${E(c)}"${c===sel?" selected":""}>‎${E(b)}</option>`}).join("");
export function bpView(){
 if(!X)return "";start();
 const L=[...P.entries()].map(([i,d])=>Object.assign({i},d)).filter(p=>(!F.br||p.br===F.br)&&(!F.q||(String(p.n||"")+" "+p.i).toLowerCase().indexOf(F.q.toLowerCase())>=0))
  .sort((a,b)=>String(a.br).localeCompare(String(b.br))||(a.r===b.r?0:a.r==="m"?-1:1)||String(a.n).localeCompare(String(b.n),"ar"));
 const cnt=c=>[...P.values()].filter(p=>p.br===c&&p.on).length;
 const D=[...DV.entries()].map(([i,d])=>Object.assign({i},d)).sort((a,b)=>String(a.br).localeCompare(String(b.br))||N(b.at)-N(a.at));
 return `<div class="pan" id="bpx"><h3>👤 أشخاص الفروع</h3>
<p class="off" style="margin:0 0 12px">كل موظف ومدير فرع له <b>رقم شخصي</b> وكلمة مرور، يدخل بهما من صفحة الفرع (الدخول برقمك الشخصي) من الكمبيوتر أو الجوال. <b>الموظف:</b> يرسل الطلب ويتابعه ويؤكد استلامه. <b>مدير الفرع:</b> كل شيء في فرعه (الهدايا والعينات، الصيانة، تجهيز التحويلات). تأكيد الاستلام بالرقم الشخصي يتم من <b>كمبيوتر الفرع المسجّل</b> فقط.</p>
<div class="bpx-g"><div><label for="bpx-n">الاسم</label><input id="bpx-n" maxlength="60" placeholder="مثال: أحمد علي"></div><div><label for="bpx-b">الفرع</label><select id="bpx-b">${opts(F.br||"",false)}</select></div><div><label for="bpx-r">الدور</label><select id="bpx-r"><option value="e">موظف</option><option value="m">مدير الفرع</option></select></div><button type="button" class="bt p" data-bpx="add"${BUSY?" disabled":""}>➕ إضافة</button></div>
${LAST?`<div class="bpx-new" role="status"><b>✅ أُنشئ حساب ${E(LAST.n)} (${E(ROLE[LAST.r])} · ‎${E(brName(LAST.br))})</b><div>الرقم الشخصي: <code data-notr>${E(LAST.i)}</code> · كلمة المرور: <code data-notr>${E(LAST.pw)}</code></div><small class="off">تظهر كلمة المرور هنا مرة واحدة فقط ولا تُحفظ. انسخ الرسالة وأرسلها له.</small><div class="bpx-row"><button type="button" class="bt" data-bpx="copy">📋 نسخ الرسالة</button><button type="button" class="bt" data-bpx="hide">إخفاء</button></div></div>`:""}
<div class="bpx-f"><select data-bpx-f="br" aria-label="الفرع">${opts(F.br,true)}</select><input data-bpx-f="q" value="${E(F.q)}" placeholder="بحث بالاسم أو الرقم" aria-label="بحث"><span class="off" style="align-self:center">${P.size} شخص${F.br?` · في هذا الفرع ${cnt(F.br)} مفعّل`:""}</span></div>
${L.length?`<div style="overflow-x:auto"><table class="bpx-t"><thead><tr><th>الرقم</th><th>الاسم</th><th>الفرع</th><th>الدور</th><th>إجراءات</th></tr></thead><tbody>${L.map(p=>{const h=Array.isArray(p.h)&&p.h.length?p.h[p.h.length-1]:null;
  return `<tr class="${p.on?"":"off"}"><td class="n" data-notr>${E(p.i)}</td><td><b data-notr>${E(p.n)}</b>${p.on?"":` <span class="bpx-r">موقوف</span>`}${h?`<span class="bpx-h">نُقل من ‎${E(brName(h.br))} · ${E(dt(h.at))}</span>`:""}</td><td data-notr>‎${E(brName(p.br))}</td><td><span class="bpx-r ${p.r==="m"?"m":""}">${E(ROLE[p.r]||p.r)}</span></td>
  <td><div class="bpx-a"><select data-bpx-mv="${E(p.i)}" aria-label="نقل إلى فرع"><option value="">نقل إلى…</option>${brs().filter(b=>b.split("-")[0]!==p.br).map(b=>`<option value="${E(b.split("-")[0])}">‎${E(b)}</option>`).join("")}</select><button type="button" class="bt" data-bpx="role" data-i="${E(p.i)}">${p.r==="m"?"اجعله موظفاً":"اجعله مدير الفرع"}</button><button type="button" class="bt" data-bpx="on" data-i="${E(p.i)}">${p.on?"إيقاف":"تفعيل"}</button><button type="button" class="bt" data-bpx="pw" data-i="${E(p.i)}">🔑 كلمة مرور جديدة</button></div></td></tr>`}).join("")}</tbody></table></div>`:`<p class="off">${P.size?"لا نتائج لهذا البحث.":"لم يُضف أي شخص بعد. أضف أول موظف أو مدير فرع من الأعلى."}</p>`}
</div>
<div class="pan" id="bpx-dv"><h3>🖥 كمبيوتر الفروع</h3>
<p class="off" style="margin:0 0 12px">سجّل كمبيوتر كل فرع مرة واحدة: أنشئ رمزاً هنا، ثم على كمبيوتر الفرع افتح الإعدادات ← «تسجيل هذا الكمبيوتر للفرع» واكتب الرمز. منه فقط يتم تأكيد استلام الطلبات بالرقم الشخصي. لو فُقد الجهاز أو تغيّر: أوقف رمزه.</p>
<div class="bpx-g"><div><label for="bpx-dn">اسم الجهاز</label><input id="bpx-dn" maxlength="60" placeholder="مثال: كاشير الملقا"></div><div><label for="bpx-db">الفرع</label><select id="bpx-db">${opts(F.br||"",false)}</select></div><div></div><button type="button" class="bt p" data-bpx="dadd"${BUSY?" disabled":""}>➕ إنشاء رمز</button></div>
${DLAST?`<div class="bpx-new" role="status"><b>✅ رمز ${E(DLAST.n||"الجهاز")} (‎${E(brName(DLAST.br))})</b><div>الرمز: <code data-notr>${E(DLAST.code)}</code></div><small class="off">يظهر مرة واحدة فقط. اكتبه في إعدادات صفحة الفرع على ذلك الكمبيوتر.</small><div class="bpx-row"><button type="button" class="bt" data-bpx="dcopy">📋 نسخ الرمز</button><button type="button" class="bt" data-bpx="dhide">إخفاء</button></div></div>`:""}
${D.length?`<div style="overflow-x:auto;margin-top:12px"><table class="bpx-t"><thead><tr><th>الجهاز</th><th>الفرع</th><th>أُنشئ</th><th>إجراءات</th></tr></thead><tbody>${D.map(d=>`<tr class="${d.on?"":"off"}"><td><b data-notr>${E(d.n||d.i)}</b>${d.on?"":` <span class="bpx-r">موقوف</span>`}</td><td data-notr>‎${E(brName(d.br))}</td><td>${E(dt(d.at))}</td><td><div class="bpx-a"><button type="button" class="bt" data-bpx="don" data-i="${E(d.i)}">${d.on?"إيقاف":"تفعيل"}</button><button type="button" class="bt" data-bpx="ddel" data-i="${E(d.i)}">حذف</button></div></td></tr>`).join("")}</tbody></table></div>`:`<p class="off" style="margin-top:10px">لا يوجد كمبيوتر مسجّل بعد.</p>`}
</div>`;
}
const msg=p=>`أهلاً ${p.n}\nحسابك في منصة تاسومة (${ROLE[p.r]} · ${brName(p.br)}):\nالرابط: ${new URL("./index.html",location.href).href}\nاضغط «الدخول برقمك الشخصي» واكتب:\nالرقم: ${p.i}\nكلمة المرور: ${p.pw}`;
async function copy(t){try{await navigator.clipboard.writeText(t);X.toast("تم النسخ ✅")}catch(e){X.toast("تعذّر النسخ، انسخها يدوياً","er")}}
async function hex(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const ERR=e=>{const c=String(e&&e.code||e&&e.message||"");return /already/.test(c)?"الرقم مستخدم":/permission|denied/.test(c)?"غير مسموح (الأدمن ومالك النظام فقط، أو لم تُلصق القواعد بعد)":/not-allowed|x\/not/.test(c)?"غير مسموح. تأكد من تحديث الخادم":"تعذّر الحفظ: "+c};
async function add(){
 const n=String(g("bpx-n").value||"").trim().replace(/\s+/g," ").slice(0,60),br=g("bpx-b").value,r=g("bpx-r").value==="m"?"m":"e";
 if(n.length<2){X.toast("اكتب اسم الشخص","er");return}if(!/^[0-9]{3}$/.test(br)){X.toast("اختر الفرع","er");return}
 if([...P.values()].some(p=>p.br===br&&String(p.n).trim()===n)&&!confirm("يوجد شخص بنفس الاسم في هذا الفرع. أضيفه مع ذلك؟"))return;
 BUSY=true;X.redraw();const {doc,setDoc}=X.fb;
 let id=Math.max(1000,...[...P.keys()].map(Number).filter(Number.isFinite))+1,pw=rnd(8,AL),ok=false;
 try{for(let k=0;k<4&&!ok;k++){try{await X.mkUser("p"+id+"@tasooma.app",pw);ok=true}catch(e){if(/already/.test(String(e&&e.code||"")))id++;else throw e}}
  if(!ok)throw new Error("already");
  await setDoc(doc(X.db,"bper",String(id)),{n,br,r,on:true,at:Date.now(),by:X.me});
  LAST={i:String(id),n,br,r,pw};DLAST=null;g("bpx-n").value="";X.toast("✅ أُضيف "+n)}
 catch(e){X.toast(ERR(e),"er")}finally{BUSY=false;X.redraw()}
}
async function upd(i,data,okMsg){try{await X.fb.updateDoc(X.fb.doc(X.db,"bper",i),data);if(okMsg)X.toast(okMsg)}catch(e){X.toast(ERR(e),"er")}}
async function onClick(e){
 const t=e.target.closest&&e.target.closest("[data-bpx]");if(!t||!X||!g("bpx"))return;const a=t.dataset.bpx,i=t.dataset.i,p=i?P.get(i):null;
 if(a==="add")return add();
 if(a==="copy"&&LAST)return copy(msg(LAST));
 if(a==="hide"){LAST=null;X.redraw();return}
 if(a==="role"&&p){const r=p.r==="m"?"e":"m";if(!confirm(`تغيير دور ${p.n} إلى «${ROLE[r]}»؟`))return;return upd(i,{r},"✅ تغيّر الدور")}
 if(a==="on"&&p){if(p.on&&!confirm(`إيقاف حساب ${p.n}؟ لن يستطيع الدخول.`))return;return upd(i,{on:!p.on},p.on?"تم الإيقاف":"✅ تم التفعيل")}
 if(a==="pw"&&p){if(!confirm(`إنشاء كلمة مرور جديدة لـ ${p.n}؟ القديمة تتوقف فوراً.`))return;const pw=rnd(8,AL);
  try{await X.setPw("p"+i+"@tasooma.app",pw);LAST={i,n:p.n,br:p.br,r:p.r,pw};X.toast("✅ كلمة مرور جديدة");X.redraw()}catch(e){X.toast(ERR(e),"er")}return}
 if(a==="dadd"){const n=String(g("bpx-dn").value||"").trim().slice(0,60),br=g("bpx-db").value;if(!/^[0-9]{3}$/.test(br)){X.toast("اختر الفرع","er");return}
  BUSY=true;X.redraw();const id=rnd(8,AN),key=rnd(24,AL);
  try{await X.fb.setDoc(X.fb.doc(X.db,"bdev",id),{br,h:await hex(key),n:n||("كمبيوتر "+brName(br)),on:true,at:Date.now(),by:X.me});DLAST={code:id+"."+key,n,br};LAST=null;g("bpx-dn").value="";X.toast("✅ أُنشئ الرمز")}
  catch(e){X.toast(ERR(e),"er")}finally{BUSY=false;X.redraw()}return}
 if(a==="dcopy"&&DLAST)return copy(DLAST.code);
 if(a==="dhide"){DLAST=null;X.redraw();return}
 if(a==="don"&&DV.get(i)){const d=DV.get(i);try{await X.fb.updateDoc(X.fb.doc(X.db,"bdev",i),{on:!d.on});X.toast(d.on?"أُوقف الجهاز":"✅ فُعّل الجهاز")}catch(e){X.toast(ERR(e),"er")}return}
 if(a==="ddel"&&DV.get(i)){if(!confirm("حذف هذا الجهاز؟ لن يصلح رمزه بعد الآن."))return;try{await X.fb.deleteDoc(X.fb.doc(X.db,"bdev",i));X.toast("حُذف الجهاز")}catch(e){X.toast(ERR(e),"er")}}
}
async function onChange(e){
 const t=e.target;if(!X||!t||!t.closest||!t.closest("#bpx"))return;
 if(t.dataset.bpxF){F[t.dataset.bpxF]=String(t.value||"");X.redraw();return}
 if(t.dataset.bpxMv){const i=t.dataset.bpxMv,p=P.get(i),to=t.value;if(!p||!/^[0-9]{3}$/.test(to))return;
  if(!confirm(`نقل ${p.n} من ‎${brName(p.br)} إلى ‎${brName(to)}؟`)){t.value="";return}
  const h=(Array.isArray(p.h)?p.h:[]).concat([{br:p.br,at:Date.now(),by:X.me}]).slice(-60);
  return upd(i,{br:to,h},"✅ نُقل إلى "+brName(to))}
}
