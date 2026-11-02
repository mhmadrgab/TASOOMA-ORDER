// إعدادات Firebase لمشروع TASOOMA (مشتركة بين صفحة الفرع وصفحة المستودع)
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {getAuth,initializeAuth,browserSessionPersistence,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
const firebaseConfig = {
  apiKey: "AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",
  authDomain: "tasooma-ad4fe.firebaseapp.com",
  projectId: "tasooma-ad4fe",
  storageBucket: "tasooma-ad4fe.firebasestorage.app",
  messagingSenderId: "463966731953",
  appId: "1:463966731953:web:6b43696b49837494d82c90"
};
export const DOMAIN="tasooma.app";
export const ADMIN_EMAIL="mohamedrgab20@gmail.com";
export const emailOf=c=>`${c}@${DOMAIN}`;
// كل صفحة بتفتح "تطبيق" باسم مختلف علشان جلسة الدخول ما تتخلطش (فرع / مستودع / إنشاء حسابات)
export function makeFb(name){
  const app=getApps().find(a=>a.name===name)||initializeApp(firebaseConfig,name);
  // الدخول بيتنسي أول ما الصفحة أو التطبيق يتقفل: كل مرة تفتح لازم تكتب كلمة السر (مفيش فتح لوحده)
  let auth;try{auth=initializeAuth(app,{persistence:browserSessionPersistence})}catch(e){auth=getAuth(app)}
  return {app,db:getFirestore(app),auth};
}
export const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),ms))]);
// ---------- إشعارات الموبايل (حتى والتطبيق مقفول) ----------
// بعد الدخول وتفعيل التنبيهات: الجهاز بيسجّل نفسه في push/{token}، والسيرفر بيبعتله.
// info = {role: "staff"|"branch"|"driver", key: الإيميل أو كود الفرع أو اسم السائق, email}
export async function pushRegister(app,db,info){
  try{
    if(!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator))return false;
    const m=await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js");
    if(!(await m.isSupported()))return false;
    const reg=await navigator.serviceWorker.ready;
    const tok=await m.getToken(m.getMessaging(app),{serviceWorkerRegistration:reg});
    if(!tok)return false;
    await setDoc(doc(db,"push",tok),{role:info.role,key:String(info.key),email:String(info.email||"").toLowerCase(),ts:Date.now()});
    return true;
  }catch(e){console.warn("push",e);return false}
}
// ---------- تنبيه سيرفر الإشعارات (Cloudflare) إن طلب اتغيّر، علشان يبعت للموبايلات في نفس الثانية ----------
// السيرفر بيقرا الطلب بنفسه ويقرر يبعت لمين؛ هنا بس بنقوله "بص على الطلبات دي" ومعانا توكن الدخول
export const PUSH_URL="https://tasooma-push.tasooma.workers.dev";// سيرفر الإشعارات على Cloudflare (مجلد push-server)
export async function ping(auth,ids){
  try{
    ids=[...new Set((ids||[]).filter(Boolean))];if(!PUSH_URL||!ids.length)return;
    const u=auth&&auth.currentUser;if(!u)return;
    const t=await u.getIdToken();
    fetch(PUSH_URL+"/notify",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},body:JSON.stringify({ids}),keepalive:true}).catch(()=>{});
  }catch(e){}
}
// ---------- الحد اليومي المجاني لـ Firebase ----------
// لما الحد يخلص، Firebase بيفضل يعيد المحاولة في صمت، فكانت الصفحة بتقول "النت ضعيف" وهو مش ضعيف.
// بنسأل السيرفر سؤال صغير (من غير دخول) ونشوف رده: 429 = الحد خلص.
const PROBE=`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/geo/main`;
export async function quotaOut(){try{const r=await fetch(PROBE,{cache:"no-store"});return r.status===429}catch(e){return false}}
let qT=null;
export async function checkQuota(){
  const q=await quotaOut();
  document.documentElement.classList.toggle("ui-quota",q);
  clearTimeout(qT);if(q)qT=setTimeout(checkQuota,10*6e4);// طول ما هو واقف نراجع كل 10 دقايق، وأول ما يرجع الشريط يختفي
  return q;
}
// ليه الحفظ فشل؟ (denied / quota / offline / slow)
export async function failReason(x){
  if(x&&x.code==="permission-denied")return "denied";
  if(x&&x.code==="resource-exhausted"){checkQuota();return "quota"}
  if(!navigator.onLine)return "offline";
  if(await checkQuota())return "quota";
  return "slow";
}
export const FAIL_MSG={
  quota:"خدمة Firebase وقفت مؤقتاً لأن الحد اليومي المجاني خلص (مش النت). البيانات محفوظة على جهازك، جرّب تاني بعدين، وبلّغ المستودع.",
  offline:"مفيش اتصال بالإنترنت دلوقتي. البيانات محفوظة، جرّب تاني أول ما النت يرجع.",
  slow:"الاتصال بطيء ومتأكدناش إن الحفظ تم. اضغط تاني، ومش هيتكرر."
};
if(typeof document!=="undefined"){
  let last=0;const chk=()=>{if(Date.now()-last<5*6e4)return;last=Date.now();checkQuota()};
  setTimeout(chk,1500);// أول ما الصفحة تفتح
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)chk()});// لما ترجع للصفحة
  addEventListener("online",chk);
  if(/admin/.test(location.pathname))setInterval(chk,20*6e4);// لوحة المستودع بتفضل مفتوحة طول اليوم
}
export {collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword};
