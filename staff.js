// لوحة المستودع (للمدير فقط): إدارة المحاسبين وصلاحياتهم
import {makeFb,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,createUserWithEmailAndPassword,signInWithEmailAndPassword,updatePassword,signOut} from "./fb.js";
import {E} from "./cust.js";
import {avatar,ownerMe,meReady} from "./prof.js";
// اسم المالك اللي بيظهر لو لسه ماكتبش اسمه في "ملفي الشخصي"
export const OWNER_NAME="محمد رجب";
const g=id=>document.getElementById(id);
const PERMS=[["req","الطلبات"],["cus","العهدة"],["fl","السيارات والسواقين"]];
const genPw=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join("")};
const EMAIL=/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/;
// DV = أجهزة الإشعارات لكل إيميل [{dv:"m"|"pc"|"", ts}] (المالك بس)
let DV={},testing="";
let X=null,S=[],SL=false,WD=null,PW=()=>({}),un=[],f={e:"",n:"",p:"",r:"acc"},busy=false;
// قايمة الأسماء اللي الفروع بتختار تكلّم مين (whdir): المالك + كل حد مفعّل وعنده صلاحية "الطلبات" أو مدير، باسمه وكنيته.
// المالك بس بيكتبها، وبتتظبط لوحدها كل ما الموظفين يتغيّروا (تفعيل/تعطيل/صلاحية/حذف/اسم/كنية)
export function syncDir(){
 if(!X||!X.owner||!SL||!WD||!X.me||!meReady())return;
 const me=ownerMe(),want={[X.me]:{n:String(me.n||OWNER_NAME).slice(0,60),k:String(me.k||"").slice(0,40),r:"owner"}};
 S.forEach(s=>{const id=String(s.id).toLowerCase();if(id!==X.me&&s.enabled&&(s.admin===true||(s.p&&s.p.req)))want[id]={n:String(s.name||id.split("@")[0]).slice(0,60),k:String(s.k||"").slice(0,40),r:s.admin===true?"admin":"req"}});
 Object.entries(want).forEach(([id,v])=>{const o=WD[id];if(!o||o.n!==v.n||(o.k||"")!==v.k||o.r!==v.r)setDoc(doc(X.db,"whdir",id),v).catch(()=>{})});
 Object.keys(WD).forEach(id=>{if(!want[id])deleteDoc(doc(X.db,"whdir",id)).catch(()=>{})});
}
export const staffName=id=>{const s=S.find(x=>x.id===id);return s?s.name||id:id};
const AERR=e=>({"auth/email-already-in-use":"الإيميل ده عنده حساب في Firebase بالفعل. اكتب كلمة سره الحالية علشان نربطه.","auth/operation-not-allowed":"فعّل Email/Password من Authentication في Firebase","auth/weak-password":"كلمة السر ضعيفة (6 حروف على الأقل)","auth/network-request-failed":"مفيش اتصال بالإنترنت","auth/invalid-credential":"كلمة السر غلط","auth/invalid-email":"الإيميل غير صحيح","auth/too-many-requests":"محاولات كتير، استنى شوية","auth/admin-restricted-operation":"التسجيل متوقف في Firebase. فعّله مؤقتاً من Authentication ← Settings ← User actions"}[e&&e.code]||("خطأ: "+(e&&e.code||e&&e.message)));
const msg=s=>`أهلاً ${s.name||""}\nلوحة المستودع:\n${new URL("./admin.html",location.href).href}\nالإيميل: ${s.id}\nكلمة السر: ${PW()[s.id]||""}`;
const cpy=async t=>{try{await navigator.clipboard.writeText(t);X.toast("تم النسخ")}catch(e){prompt("انسخ الرسالة:",t)}};
// الصفحة مقسومة: مالك النظام، المديرين، المحاسبين. المالك بس اللي بيعدّل؛ المدير بيشوف بس (ويلاقي نفسه في قسم المديرين)
export function view(){
 // V = المتابعين (صاحب الشركة): بيشوفوا كل حاجة من غير تعديل
 const pw=PW(),own=X.owner,me=X.me,V=S.filter(s=>s.v===true),M=S.filter(s=>s.v!==true&&s.admin===true),A=S.filter(s=>s.v!==true&&s.admin!==true);
 const you=id=>id===me?' <span class="pill go">أنت</span>':"";
 const st=s=>`<span class="pill ${s.enabled?"":"off2"}">${s.enabled?"مفعّل":"معطّل"}</span>`;
 const pwc=s=>`<td>${pw[s.id]?`<span class="pin" data-spc="${E(s.id)}">••••••••</span> <button class="bt s" data-sf="show" data-id="${E(s.id)}" type="button">إظهار</button>`:'<span class="off">—</span>'}</td>`;
 const acts=(s,role)=>`<td style="white-space:nowrap">${role}<button class="bt s" data-sf="tg" data-id="${E(s.id)}" type="button">${s.enabled?"تعطيل":"تفعيل"}</button> <button class="bt s" data-sf="pw" data-id="${E(s.id)}" type="button">كلمة سر جديدة</button> <button class="bt s" data-sf="cp" data-id="${E(s.id)}" type="button">نسخ رسالة</button> <button class="bt s r" data-sf="del" data-id="${E(s.id)}" type="button">حذف</button></td>`;
 const empty=(n,t)=>`<tr><td colspan="${n}" class="off" style="text-align:center;padding:18px">${t}</td></tr>`;
 // قسم مالك النظام وخانة الإضافة بيظهروا للمالك بس؛ المديرين بيشوفوا المديرين والمحاسبين بس
 // الاسم بالصورة + الكنية (المالك بيكتبها، وبتظهر جنب الاسم في الشات)
 const who=s=>`<td><span style="display:inline-flex;align-items:center;gap:8px">${avatar(s.id,s.name,30)}<b>${E(s.name||"")}</b></span>${you(s.id)}</td>`;
 const kc=s=>`<td>${own?`<input data-sk="${E(s.id)}" value="${E(s.k||"")}" maxlength="40" placeholder="مثلاً: مسؤول الطلبات" style="min-width:150px">`:E(s.k||"—")}</td>`;
 const mo=ownerMe(),on=mo.n||OWNER_NAME;
 // الإشعارات: الأجهزة المتسجّلة للشخص ده + زرار تجربة (المالك بس)
 const dvs=id=>{const L=DV[String(id).toLowerCase()]||[],m=L.filter(x=>x.dv==="m").length,pc=L.filter(x=>x.dv==="pc").length,o=L.length-m-pc;
  return L.length?[m?`📱 موبايل${m>1?" ×"+m:""}`:"",pc?`💻 كمبيوتر${pc>1?" ×"+pc:""}`:"",o?`❔ جهاز${o>1?" ×"+o:""}`:""].filter(Boolean).join(" · "):`<span style="color:#c0392b">⚠️ مفيش جهاز</span>`};
 const nc=s=>own?`<td style="white-space:nowrap">${dvs(s.id)} <button class="bt s" data-sf="ntest" data-id="${E(s.id)}" type="button" ${testing?"disabled":""}>${testing===s.id?"⏳":"🔔 جرّب"}</button></td>`:"";
 return `${own?`<div class="pan"><h3 style="margin:0 0 10px">👑 مالك النظام</h3><div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px">${avatar(me,on,44)}<div><b>${E(on)}</b>${mo.k?` <span class="pill">${E(mo.k)}</span>`:""}<div class="off" dir="ltr" style="font-size:13px">${E(me)}</div></div><span class="pill go">أنت</span><span class="off" style="font-size:13.5px">🔔 ${dvs(me)}</span> <button class="bt s" data-sf="ntest" data-id="${E(me)}" type="button" ${testing?"disabled":""}>${testing===me?"⏳":"🔔 جرّب"}</button><button class="bt s" data-pfopen type="button" style="margin-inline-start:auto">✏️ اسمي وكنيتي وصورتي</button></div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 10px">➕ إضافة موظف</h3>
 <div class="fl" style="margin:0"><input id="sfe" type="email" dir="ltr" placeholder="الإيميل" value="${E(f.e)}" autocomplete="off" style="flex:1;min-width:190px"><input id="sfn" placeholder="الاسم" value="${E(f.n)}" maxlength="40" style="flex:1;min-width:140px"><input id="sfp" dir="ltr" placeholder="كلمة السر (اختياري)" value="${E(f.p)}" autocomplete="off" style="flex:1;min-width:150px"><select id="sfr"><option value="acc" ${f.r==="acc"?"selected":""}>محاسب</option><option value="adm" ${f.r==="adm"?"selected":""}>مدير</option><option value="view" ${f.r==="view"?"selected":""}>👁 متابع (صاحب الشركة)</option></select><button class="bt p" data-sf="add" type="button" ${busy?"disabled":""}>إضافة</button></div></div>`:""}
 ${own||V.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">👁 المتابعين (${V.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">زي صاحب الشركة: بيشوف لوحة الأداء والطلبات والتحويلات والعهدة والعربيات والعمال والسجل، ومايقدرش يعدّل أو يمسح أي حاجة. ومالوش شات ولا كلمات سر.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>الإيميل</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة السر</th><th></th>":""}</tr></thead><tbody>
 ${V.length?V.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,""):""}</tr>`).join(""):empty(own?7:4,"لسه مفيش متابعين. ضيفه من فوق واختار \"👁 متابع\"")}</tbody></table></div></div>`:""}
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">🛡 المديرين (${M.length})</h3><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>الإيميل</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة السر</th><th></th>":""}</tr></thead><tbody>
 ${M.length?M.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,`<button class="bt s" data-sf="toacc" data-id="${E(s.id)}" type="button">تحويل لمحاسب</button> `):""}</tr>`).join(""):empty(own?7:4,"لسه مفيش مديرين")}</tbody></table></div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">🧾 المحاسبين (${A.length})</h3><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>الإيميل</th><th>الحالة</th>${PERMS.map(p=>`<th>${p[1]}</th>`).join("")}${own?"<th>الإشعارات</th><th>كلمة السر</th><th></th>":""}</tr></thead><tbody>
 ${A.length?A.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${PERMS.map(p=>`<td><input type="checkbox" data-sp2="${p[0]}" data-id="${E(s.id)}" ${s.p&&s.p[p[0]]===true?"checked":""} ${own?"":"disabled"}></td>`).join("")}${own?nc(s)+pwc(s)+acts(s,`<button class="bt s g" data-sf="toadm" data-id="${E(s.id)}" type="button">ترقية لمدير</button> `):""}</tr>`).join(""):empty(own?10:7,"لسه مفيش محاسبين")}</tbody></table></div></div>`;
}
async function add(){
 const e=f.e.trim().toLowerCase(),n=f.n.trim().slice(0,40);
 if(!EMAIL.test(e)||e.length>120||e.endsWith("@tasooma.app")){X.toast("اكتب إيميل صحيح");return}
 if(!n){X.toast("اكتب اسم المحاسب");return}
 if(S.some(s=>s.id===e)){X.toast("المحاسب ده مضاف بالفعل");return}
 busy=true;X.redraw();
 try{
  const a=makeFb("sec").auth;let pw=f.p.trim();
  if(pw){try{await signInWithEmailAndPassword(a,e,pw)}finally{try{await signOut(a)}catch(x){}}}
  else{pw=genPw();try{await createUserWithEmailAndPassword(a,e,pw)}finally{try{await signOut(a)}catch(x){}}}
  await setDoc(doc(X.db,"secrets",e),{pw});
  const adm=f.r==="adm",vw=f.r==="view";
  // المتابع: من غير أي صلاحية تعديل (v = يشوف بس)
  await setDoc(doc(X.db,"staff",e),vw?{name:n,enabled:true,admin:false,v:true,p:{}}:{name:n,enabled:true,admin:adm,p:{req:true,cus:true,fl:true}});
  f={e:"",n:"",p:"",r:"acc"};X.toast("تمت إضافة "+n+(vw?" كمتابع (يشوف بس)":adm?" كمدير":" — راجع الصلاحيات"));
 }catch(x){if(!(window.uiAuthErr&&uiAuthErr(x,"الموظف")))X.toast(AERR(x))}
 busy=false;X.redraw();
}
async function click(e){
 const t=e.target.closest("[data-sf]");if(!t||!X)return;
 const a=t.dataset.sf,id=t.dataset.id,s=S.find(x=>x.id===id);
 if(!X.owner&&a!=="show"){X.toast("التعديل لمالك النظام بس");return}
 try{
  if(a==="add")await add();
  else if((a==="toadm"||a==="toacc")&&s){const up=a==="toadm";
   if(confirm(up?`ترقية ${s.name} لمدير؟`:`تحويل ${s.name} لمحاسب؟`)){await updateDoc(doc(X.db,"staff",id),{admin:up});X.toast(up?"بقى مدير 🛡":"بقى محاسب")}}
  else if(a==="show"){const el=document.querySelector(`[data-spc="${id}"]`);if(el){const sh=el.dataset.v==="1";el.textContent=sh?"••••••••":PW()[id];el.dataset.v=sh?"0":"1";t.textContent=sh?"إظهار":"إخفاء"}}
  else if(a==="tg"&&s){if(!s.enabled||confirm(`تعطيل ${s.name}؟ هيتفصل فوراً ومش هيقدر يدخل.`)){await updateDoc(doc(X.db,"staff",id),{enabled:!s.enabled});X.toast(s.enabled?"تم التعطيل":"تم التفعيل")}}
  else if(a==="pw"&&s){
   const old=PW()[id];if(!old){X.toast("كلمة السر الحالية مش متسجلة");return}
   const nw=(prompt("كلمة السر الجديدة (6 حروف على الأقل). سيبها فاضية لتوليد واحدة:","")||"").trim()||genPw();
   const au=makeFb("sec").auth;try{const cr=await signInWithEmailAndPassword(au,id,old);await updatePassword(cr.user,nw)}finally{try{await signOut(au)}catch(x){}}
   await setDoc(doc(X.db,"secrets",id),{pw:nw});X.toast("تم تغيير كلمة السر");
  }
  // إشعار تجربة لأجهزة الشخص ده، ونقول وصل لأنهي جهاز
  else if(a==="ntest"&&X.test){
   testing=id;X.redraw();
   try{const r=await X.test(id),nm=id===X.me?"ليك":"لـ "+(s&&s.name||id);
    if(!r.n)X.toast(`⚠️ مفيش ولا جهاز متسجّل ${nm}. لازم يفتح المنصة من الموبايل أو الكمبيوتر ويدوس "🔔 فعّل الإشعارات"`);
    else X.toast(`اتبعت ${nm}: `+r.dev.map(d=>`${d.dv==="m"?"📱":d.dv==="pc"?"💻":"❔"} ${d.ok?"✅ وصل":d.gone?"❌ الجهاز ده مابقاش بيستقبل (اتشال)":"❌ مارضيش"}`).join(" · "))}
   catch(x){X.toast("تعذر الإرسال. اتأكد إن السيرفر اتحدّث (wrangler deploy) وإن النت شغّال")}
   testing="";X.redraw();return;
  }
  else if(a==="cp"&&s){if(!PW()[id]){X.toast("كلمة السر مش متسجلة");return}cpy(msg(s))}
  else if(a==="del"&&s){if(confirm(`حذف المحاسب ${s.name}؟ هيفقد كل الصلاحيات.`)){await deleteDoc(doc(X.db,"staff",id));await deleteDoc(doc(X.db,"secrets",id));X.toast("تم الحذف")}}
 }catch(x){X.toast(AERR(x))}
}
export function initStaff(ctx){
 X=ctx;stop();PW=ctx.pw;
 if(!window.__stc){window.__stc=1;
  document.addEventListener("click",click);
  document.addEventListener("input",e=>{const k={sfe:"e",sfn:"n",sfp:"p"}[e.target.id];if(k)f[k]=e.target.value});
  document.addEventListener("change",async e=>{const t=e.target;if(!X||!t.dataset)return;
   if(t.id==="sfr"){f.r=t.value;return}
   // الكنية: بتتحفظ أول ما تخلّص كتابة (وبتظهر للفروع في الشات لوحدها)
   if(t.dataset.sk&&X.owner){try{await updateDoc(doc(X.db,"staff",t.dataset.sk),{k:t.value.trim().slice(0,40)});X.toast("اتحفظت الكنية")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}return}
   if(!t.dataset.sp2||!X.owner)return;
   try{await updateDoc(doc(X.db,"staff",t.dataset.id),{["p."+t.dataset.sp2]:t.checked});X.toast("تم حفظ الصلاحية")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message));X.redraw()}});
 }
 un.push(onSnapshot(collection(X.db,"staff"),sn=>{S=sn.docs.map(d=>({id:d.id,...d.data()}));SL=true;syncDir();if(X.tab()==="stf"&&!busy)X.redraw()},()=>X.toast("تعذر قراءة الموظفين. حدّث القواعد (Rules)")));
 if(X.owner)un.push(onSnapshot(collection(X.db,"whdir"),sn=>{WD={};sn.docs.forEach(d=>{WD[d.id]=d.data()});syncDir()},()=>{}));
 // أجهزة الإشعارات (موبايل/كمبيوتر) لكل واحد في المستودع
 if(X.owner)un.push(onSnapshot(query(collection(X.db,"push"),where("role","==","staff")),sn=>{DV={};sn.docs.forEach(d=>{const x=d.data(),k=String(x.email||"").toLowerCase();(DV[k]=DV[k]||[]).push({dv:x.dv||"",ts:x.ts||0})});if(X.tab()==="stf"&&!busy)X.redraw()},()=>{}));
}
export function stop(){un.forEach(x=>x());un=[];S=[];SL=false;WD=null;DV={};testing="";busy=false}
