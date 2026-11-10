// 🟢 "متصل الآن" و"آخر ظهور" في الشات (نوفمبر 2026، طلب محمد).
// على Firebase Realtime Database مش Firestore: الحضور بيتغيّر كتير، ولو على Firestore كل تغيير بيتقري عند كل الناس فالحصة المجانية
// (50 ألف قراءة) كانت هتخلص في ساعات. Realtime Database المجانية: 100 اتصال في نفس الوقت، و10 جيجا تحميل في الشهر (الحضور كام بايت).
// on/{الطرف}/{الجهاز} = {on: فاتح والصفحة قدامه, ts: آخر تغيير (وقت السيرفر)}. الطرف = b-003 / d-drv1 / w-الإيميل (النقطة ← فاصلة)
// "onDisconnect": لو النت فصل أو الصفحة اتقفلت، سيرفر Firebase نفسه بيكتب on:false. ولو الصفحة راحت في الخلفية (الموبايل) بنكتب on:false.
// قاعدة البيانات لازم تتعمل مرة واحدة من Firebase (الولايات المتحدة us-central1)، والقواعد في database.rules.json
const RTDB="https://tasooma-ad4fe-default-rtdb.firebaseio.com";
let F=null,D=null,devRef=null,un=null,vis=null,M={},cb=null,me=null,gen=0;
const K=p=>String(p||"").toLowerCase().replace(/\./g,",");
const DEV=(()=>{try{let d=localStorage.getItem("pres_dev");if(!d){d=Math.random().toString(36).slice(2,10);localStorage.setItem("pres_dev",d)}return d}catch(e){return "t"+Math.random().toString(36).slice(2,8)}})();
export async function initPres(app,party,onChange){
  stopPres();me=party;cb=onChange;const my=++gen;
  if(window.__mock){window.__pres=d=>{M=d||{};if(cb)cb()};return}// النسخة التجريبية
  try{
    F=F||await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");
    if(my!==gen)return;
    D=F.getDatabase(app,RTDB);devRef=F.ref(D,`on/${K(party)}/${DEV}`);
    const up=()=>F.set(devRef,{on:!document.hidden,ts:F.serverTimestamp()}).catch(()=>{});
    // كل ما الاتصال يرجع: نجهّز "آخر ظهور" عند الانقطاع، وبعدين نسجّل إننا متصلين
    const u1=F.onValue(F.ref(D,".info/connected"),s=>{if(s.val()!==true||!devRef)return;F.onDisconnect(devRef).set({on:false,ts:F.serverTimestamp()}).then(up).catch(()=>{})});
    vis=()=>up();document.addEventListener("visibilitychange",vis);
    const u2=F.onValue(F.ref(D,"on"),s=>{M=s.val()||{};if(cb)cb()},()=>{});
    un=()=>{u1();u2()};
  }catch(e){}// لو قاعدة البيانات لسه ماتعملتش: الشات بيشتغل عادي من غير "متصل"
}
export function stopPres(){
  gen++;if(un){un();un=null}if(vis){document.removeEventListener("visibilitychange",vis);vis=null}
  if(devRef&&F){const r=devRef;F.set(r,{on:false,ts:F.serverTimestamp()}).catch(()=>{});F.onDisconnect(r).cancel().catch(()=>{})}
  devRef=null;M={};cb=null;me=null;
}
// {on, ts} للطرف ده (لو أي جهاز من أجهزته فاتح = متصل)
export function presOf(p){
  const d=M[K(p)];if(!d||typeof d!=="object")return null;let on=false,ts=0;
  Object.values(d).forEach(x=>{if(!x||typeof x!=="object")return;if(x.on===true)on=true;ts=Math.max(ts,+x.ts||0)});
  return ts||on?{on,ts}:null;
}
const hm=t=>new Date(t).toLocaleTimeString("ar-EG-u-nu-latn",{hour:"numeric",minute:"2-digit"});
// "🟢 متصل الآن" أو "آخر ظهور اليوم 3:40 م"
export function presTxt(p){
  const s=presOf(p);if(!s)return "";if(s.on)return "متصل الآن";
  const t=s.ts,d=new Date(t),n=new Date(),y=new Date(n);y.setDate(n.getDate()-1);
  const m=Math.round((Date.now()-t)/6e4);
  if(m<1)return "آخر ظهور منذ لحظات";if(m<60)return `آخر ظهور منذ ${m} د`;
  if(d.toDateString()===n.toDateString())return `آخر ظهور اليوم ${hm(t)}`;
  if(d.toDateString()===y.toDateString())return `آخر ظهور أمس ${hm(t)}`;
  return `آخر ظهور ${d.toLocaleDateString("ar-EG-u-nu-latn",{day:"numeric",month:"short"})} ${hm(t)}`;
}
