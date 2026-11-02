// لوحة المستودع (للمدير فقط): إدارة المحاسبين وصلاحياتهم
import {makeFb,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,createUserWithEmailAndPassword,signInWithEmailAndPassword,updatePassword,signOut} from "./fb.js";
import {E} from "./cust.js";
const g=id=>document.getElementById(id);
const PERMS=[["req","الطلبات"],["cus","العهدة"],["fl","السيارات والسواقين"]];
const genPw=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join("")};
const EMAIL=/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/;
let X=null,S=[],PW=()=>({}),un=[],f={e:"",n:"",p:"",r:"acc"},busy=false;
const AERR=e=>({"auth/email-already-in-use":"الإيميل ده عنده حساب في Firebase بالفعل. اكتب كلمة سره الحالية علشان نربطه.","auth/operation-not-allowed":"فعّل Email/Password من Authentication في Firebase","auth/weak-password":"كلمة السر ضعيفة (6 حروف على الأقل)","auth/network-request-failed":"مفيش اتصال بالإنترنت","auth/invalid-credential":"كلمة السر غلط","auth/invalid-email":"الإيميل غير صحيح","auth/too-many-requests":"محاولات كتير، استنى شوية","auth/admin-restricted-operation":"التسجيل متوقف في Firebase. فعّله مؤقتاً من Authentication ← Settings ← User actions"}[e&&e.code]||("خطأ: "+(e&&e.code||e&&e.message)));
const msg=s=>`أهلاً ${s.name||""}\nلوحة المستودع:\n${new URL("./admin.html",location.href).href}\nالإيميل: ${s.id}\nكلمة السر: ${PW()[s.id]||""}`;
const cpy=async t=>{try{await navigator.clipboard.writeText(t);X.toast("تم النسخ")}catch(e){prompt("انسخ الرسالة:",t)}};
// الصفحة مقسومة: مالك النظام، المديرين، المحاسبين. المالك بس اللي بيعدّل؛ المدير بيشوف بس (ويلاقي نفسه في قسم المديرين)
export function view(){
 const pw=PW(),own=X.owner,me=X.me,M=S.filter(s=>s.admin===true),A=S.filter(s=>s.admin!==true);
 const you=id=>id===me?' <span class="pill go">أنت</span>':"";
 const st=s=>`<span class="pill ${s.enabled?"":"off2"}">${s.enabled?"مفعّل":"معطّل"}</span>`;
 const pwc=s=>`<td>${pw[s.id]?`<span class="pin" data-spc="${E(s.id)}">••••••••</span> <button class="bt s" data-sf="show" data-id="${E(s.id)}" type="button">إظهار</button>`:'<span class="off">—</span>'}</td>`;
 const acts=(s,role)=>`<td style="white-space:nowrap">${role}<button class="bt s" data-sf="tg" data-id="${E(s.id)}" type="button">${s.enabled?"تعطيل":"تفعيل"}</button> <button class="bt s" data-sf="pw" data-id="${E(s.id)}" type="button">كلمة سر جديدة</button> <button class="bt s" data-sf="cp" data-id="${E(s.id)}" type="button">نسخ رسالة</button> <button class="bt s r" data-sf="del" data-id="${E(s.id)}" type="button">حذف</button></td>`;
 const empty=(n,t)=>`<tr><td colspan="${n}" class="off" style="text-align:center;padding:18px">${t}</td></tr>`;
 return `<div class="pan"><h3 style="margin:0 0 10px">👑 مالك النظام</h3><div class="bar" style="justify-content:flex-start;gap:14px;margin:0"><b style="width:auto">محمد</b><span class="off" dir="ltr" style="width:auto">mohamedrgab20@gmail.com</span>${own?'<span class="pill go">أنت</span>':""}</div></div>
 ${own?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 10px">➕ إضافة موظف</h3>
 <div class="fl" style="margin:0"><input id="sfe" type="email" dir="ltr" placeholder="الإيميل" value="${E(f.e)}" autocomplete="off" style="flex:1;min-width:190px"><input id="sfn" placeholder="الاسم" value="${E(f.n)}" maxlength="40" style="flex:1;min-width:140px"><input id="sfp" dir="ltr" placeholder="كلمة السر (اختياري)" value="${E(f.p)}" autocomplete="off" style="flex:1;min-width:150px"><select id="sfr"><option value="acc" ${f.r!=="adm"?"selected":""}>محاسب</option><option value="adm" ${f.r==="adm"?"selected":""}>مدير</option></select><button class="bt p" data-sf="add" type="button" ${busy?"disabled":""}>إضافة</button></div></div>`:""}
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">🛡 المديرين (${M.length})</h3><div class="tw"><table><thead><tr><th>الاسم</th><th>الإيميل</th><th>الحالة</th>${own?"<th>كلمة السر</th><th></th>":""}</tr></thead><tbody>
 ${M.length?M.map(s=>`<tr><td><b>${E(s.name||"")}</b>${you(s.id)}</td><td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?pwc(s)+acts(s,`<button class="bt s" data-sf="toacc" data-id="${E(s.id)}" type="button">تحويل لمحاسب</button> `):""}</tr>`).join(""):empty(own?5:3,"لسه مفيش مديرين")}</tbody></table></div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">🧾 المحاسبين (${A.length})</h3><div class="tw"><table><thead><tr><th>الاسم</th><th>الإيميل</th><th>الحالة</th>${PERMS.map(p=>`<th>${p[1]}</th>`).join("")}${own?"<th>كلمة السر</th><th></th>":""}</tr></thead><tbody>
 ${A.length?A.map(s=>`<tr><td><b>${E(s.name||"")}</b>${you(s.id)}</td><td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${PERMS.map(p=>`<td><input type="checkbox" data-sp2="${p[0]}" data-id="${E(s.id)}" ${s.p&&s.p[p[0]]===true?"checked":""} ${own?"":"disabled"}></td>`).join("")}${own?pwc(s)+acts(s,`<button class="bt s g" data-sf="toadm" data-id="${E(s.id)}" type="button">ترقية لمدير</button> `):""}</tr>`).join(""):empty(own?8:6,"لسه مفيش محاسبين")}</tbody></table></div></div>`;
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
  const adm=f.r==="adm";
  await setDoc(doc(X.db,"staff",e),{name:n,enabled:true,admin:adm,p:{req:true,cus:true,fl:true}});
  f={e:"",n:"",p:"",r:"acc"};X.toast("تمت إضافة "+n+(adm?" كمدير":" — راجع الصلاحيات"));
 }catch(x){X.toast(AERR(x))}
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
   if(!t.dataset.sp2||!X.owner)return;
   try{await updateDoc(doc(X.db,"staff",t.dataset.id),{["p."+t.dataset.sp2]:t.checked});X.toast("تم حفظ الصلاحية")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message));X.redraw()}});
 }
 un.push(onSnapshot(collection(X.db,"staff"),sn=>{S=sn.docs.map(d=>({id:d.id,...d.data()}));if(X.tab()==="stf"&&!busy)X.redraw()},()=>X.toast("تعذر قراءة الموظفين. حدّث القواعد (Rules)")));
}
export function stop(){un.forEach(x=>x());un=[];S=[];busy=false}
