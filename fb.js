// إعدادات Firebase لمشروع TASOOMA (مشتركة بين صفحة الفرع وصفحة المستودع)
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,collection,doc,addDoc as _addDoc,setDoc as _setDoc,getDoc,getDocs,updateDoc as _updateDoc,deleteDoc as _deleteDoc,onSnapshot,query,where,writeBatch as _writeBatch,arrayUnion,orderBy,limit,increment,deleteField} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {getAuth,initializeAuth,browserLocalPersistence,inMemoryPersistence,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
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
  // الدخول بيتفتكر على الجهاز ده إلى ما يدوس "خروج" (طلب محمد، نوفمبر 2026). كل صفحة ليها دخول لوحدها (فرع / مستودع / سائق).
  // "sec" (إنشاء حسابات الفروع والموظفين) مابيتفتكرش خالص
  // localStorage بس، من غير indexedDB: على بعض الموبايلات indexedDB بيعلّق، وFirebase بيستنى كل الأنواع قبل ما يبدأ،
  // فتسجيل الدخول كان بيقف ويقول "الاتصال بطيء" (نوفمبر 2026). لو localStorage مقفول (تصفح خاص) Firebase بيكمّل في الذاكرة.
  let auth;try{auth=initializeAuth(app,{persistence:name==="sec"?inMemoryPersistence:browserLocalPersistence})}catch(e){auth=getAuth(app)}
  return {app,db:getFirestore(app),auth};
}
export const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),ms))]);
// ---------- إشعارات الجوال (حتى والتطبيق مقفول) ----------
// بعد الدخول وتفعيل التنبيهات: الجهاز يسجّل نفسه في push/{token}، والسيرفر بيبعتله.
// info = {role: "staff"|"branch"|"driver", key: البريد الإلكتروني أو كود الفرع أو اسم السائق, email}
export async function pushRegister(app,db,info){
  try{
    if(!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator))return false;
    const m=await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js");
    if(!(await m.isSupported()))return false;
    // نسجّل خدمة الإشعارات بنفسنا (لو مسجّلة قبل كده بيرجع نفس التسجيل) ونستنى إلى ما تشتغل
    await navigator.serviceWorker.register("./sw.js");
    const reg=await withTimeout(navigator.serviceWorker.ready,20000);
    const msg=m.getMessaging(app),tok=await withTimeout(m.getToken(msg,{serviceWorkerRegistration:reg}),20000);
    if(!tok)return false;
    // الصفحة مفتوحة: Firebase بيدّي الإشعار للصفحة بدل ما يظهر على الجهاز. لو الصفحة مش قدامه (مثلاً شغّال في برنامج مجدداً
    // على الحاسوب) بنعرضه احنا. (إشعار التجربة بيظهر دايماً)
    if(!window.__fgm){window.__fgm=1;m.onMessage(msg,p=>{
      const n=(p&&p.notification)||{},d=(p&&p.data)||{};
      if(!(document.hidden||!document.hasFocus())&&d.tag!=="test")return;
      reg.showNotification(n.title||d.t||"تاسومة",{body:n.body||d.b||"",tag:d.tag||undefined,icon:"./icon-192.png",dir:document.documentElement.dir||"rtl",lang:document.documentElement.lang||"ar",data:{link:(p.fcmOptions&&p.fcmOptions.link)||d.link||""}}).catch(()=>{});
    })}
    // نفس الجوال ممكن يبقى مستودع وفرع وسائق مع بعض (نفس الموقع = نفس رقم الجهاز)، فكل دور ليه تسجيل لوحده.
    // dv = جوال ولا حاسوب (المالك بيشوف أجهزة كل واحد في تبويب الموظفين)
    await pushSave(db,info,tok);
    return true;
  }catch(e){console.warn("push",e);return false}
}
// تسجيل رقم الجهاز في push (من المتصفح، أو من تطبيق TASOOMA للسائقين اللي بيدّي رقمه بنفسه)
export async function pushSave(db,info,tok){
  const mob=/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)||(/macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  const rec={role:info.role,key:String(info.key),email:String(info.email||"").toLowerCase(),tok,ts:Date.now()},ref=doc(db,"push",info.role+"__"+tok);
  // لو القواعد اللي في Firebase لا يزال قديمة (مابتعرفش dv)، بنسجّل من غيره بدل ما الجهاز يفضل من غير إشعارات
  // lg = لغة الجهاز (English فقط): السيرفر يبعت الإشعارات بالإنجليزية. لو القواعد قديمة نسجّل بدونها بدل ما الجهاز يفضل من غير إشعارات
  const en=window.TZL&&TZL.lang==="en",dv=mob?"m":"pc",deny=e=>e&&e.code==="permission-denied";
  try{await setDoc(ref,{...rec,dv,...(en?{lg:"en"}:{})})}catch(e){if(!deny(e))throw e;try{await setDoc(ref,{...rec,dv})}catch(e2){if(deny(e2))await setDoc(ref,rec);else throw e2}}
}
// ---------- تنبيه سيرفر الإشعارات (Cloudflare) إن طلب اتغيّر، علشان يبعت للموبايلات في نفس الثانية ----------
// السيرفر بيقرا الطلب بنفسه ويقرر يبعت لمين؛ هنا بس بنقوله "بص على الطلبات دي" ومعانا توكن الدخول
export const PUSH_URL="https://tasooma-push.tasooma.workers.dev";// سيرفر الإشعارات على Cloudflare (مجلد push-server)
// ids = طلبات اتغيّرت، chats = محادثات خاصة (dm: كود الفرع__إيميل الشخص) أُرسل فيها رسالة جديدة، trips = رحلات بدأت أو خلصت
export async function ping(auth,ids,chats,trips,gifts){
  try{
    const u0=a=>[...new Set((a||[]).filter(Boolean))];ids=u0(ids);chats=u0(chats);trips=u0(trips);gifts=u0(gifts);
    // 👥 رسالة في جروب ("g_"+رقمه): ليها مسار لوحدها على دفعات (أعضاء كتير)
    chats.filter(c=>/^g_/.test(c)).forEach(c=>multiPush(auth,"/grp",{gid:c.slice(2)}));chats=chats.filter(c=>!/^g_/.test(c));
    if(!PUSH_URL||!(ids.length||chats.length||trips.length||gifts.length))return;
    const u=auth&&auth.currentUser;if(!u)return;
    const t=await u.getIdToken();
    // كل طلب / محادثة / رحلة في نداء لوحده: السيرفر المجاني بيسمح بـ 50 طلب خارجي بس في النداء الواحد،
    // ورحلة فيها فروع كتير كانت بتتعدّاهم، فآخر الإشعارات (زي "بدأ رحلة") كانت بتضيع
    const jobs=[...trips.map(x=>({trips:[x]})),...ids.map(x=>({ids:[x]})),...chats.map(x=>({chats:[x]})),...gifts.map(x=>({gifts:[x]}))].slice(0,40);
    jobs.forEach(b=>fetch(PUSH_URL+"/notify",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},body:JSON.stringify({ids:[],chats:[],trips:[],gifts:[],...b}),keepalive:true}).catch(()=>{}));
  }catch(e){}
}
// إشعار تجربة: لأجهزتي أنا، أو (للمالك) لأجهزة شخص مجدداً. بيرجّع {n: عدد الأجهزة, dev:[{dv, ok, gone}]}
// التعميم (ann.js): الإشعار لكل الفروع والمستودع على دفعات (part) علشان حد Cloudflare المجاني (50 طلب في النداء)
export const annPush=(auth,id)=>multiPush(auth,"/ann",{id});
// إشعار لناس كتير على دفعات: السيرفر بيرد {more:true} لو لسه فيه أجهزة
async function multiPush(auth,path,body){
  try{const u=auth&&auth.currentUser;if(!u||!PUSH_URL)return;const t=await u.getIdToken();
    for(let part=0;part<12;part++){const r=await fetch(PUSH_URL+path,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},body:JSON.stringify({...body,part})});
      const j=await r.json().catch(()=>({}));if(!r.ok||!j.more)break}}catch(e){}
}
export async function pushTest(auth,to){
  const u=auth&&auth.currentUser;if(!u)throw new Error("login");
  const r=await withTimeout(fetch(PUSH_URL+"/test",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+await u.getIdToken()},body:JSON.stringify(to?{to}:{})}),20000);
  if(!r.ok)throw new Error("http "+r.status);return r.json();
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
  quota:"خدمة Firebase توقفت مؤقتاً لأن الحد اليومي المجاني انتهى (وليس الإنترنت). البيانات محفوظة على جهازك، حاول لاحقاً، وأبلغ المستودع.",
  offline:"لا يوجد اتصال بالإنترنت حالياً. البيانات محفوظة، حاول مجدداً فور عودة الإنترنت.",
  slow:"الاتصال بطيء ولم نتأكد من اكتمال الحفظ. اضغط مجدداً ولن يتكرر."
};
if(typeof document!=="undefined"){
  let last=0;const chk=()=>{if(Date.now()-last<5*6e4)return;last=Date.now();checkQuota()};
  setTimeout(chk,1500);// أول ما الصفحة تفتح
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)chk()});// لما ترجع للصفحة
  addEventListener("online",chk);
  if(/admin/.test(location.pathname))setInterval(chk,20*6e4);// لوحة المستودع بتفضل مفتوحة طول اليوم
}
// ---------- سجل "مين عمل إيه" (لوحة المستودع بس) ----------
// كل حفظ/تعديل/حذف بيعمله حساب في المستودع بيتسجّل لوحده في log/{id} = {e:إيميله, n:اسمه, op, c:المجموعة, id, t:وصف, k:الحقول, s:الحالة, x?:عدد, ts}
// (بعد ما الحفظ ينجح بس). المالك بس اللي بيشوف السجل (audit.js). صفحات الفرع والسائق مش بتسجّل (setAudit مش متنادية فيها).
// الدردشة والإشعارات والصور ومواقع الفروع مش بتتسجّل (كتير ومالهاش لازمة).
let AUD=null;
export function setAudit(a){AUD=a&&a.db&&a.e?a:null}
const NOLOG=new Set(["dm","whdir","ddir","push","geo","meta","log","ava","pushlog","chats","pods","giftimg"]);
function note(op,r,d){
  if(!AUD||!r||!r.path)return null;const p=String(r.path).split("/");if(p.length!==2||NOLOG.has(p[0]))return null;
  if(d&&typeof d==="object"&&Object.keys(d).join()==="msgs")return null;// مسح الدردشة القديم (مرة واحدة)
  // الوصف بيتحسب قبل الحفظ (بعد الحذف الحاجة بتختفي من الصفحة)
  let t="";try{t=String(AUD.label&&AUD.label(p[0],p[1],d)||"")}catch(e){}
  const o=d&&typeof d==="object"?d:{};
  const s=typeof o.st==="string"?o.st:typeof o.enabled==="boolean"?(o.enabled?"on":"off"):typeof o.admin==="boolean"?(o.admin?"adm":"acc"):"";
  return {e:AUD.e,n:String(AUD.n&&AUD.n()||"").slice(0,60),op,c:p[0].slice(0,30),id:p[1].slice(0,60),t:t.slice(0,100),k:Object.keys(o).slice(0,12).map(x=>x.slice(0,30)),s:s.slice(0,20)};
}
const put=L=>{if(AUD)L.filter(Boolean).forEach(o=>_addDoc(collection(AUD.db,"log"),{...o,ts:Date.now()}).catch(()=>{}))};
// دفعة فيها كذا حاجة من نفس النوع (زي إقفال العهدة): سطر واحد في السجل بالعدد
const group=L=>{const g={};L.filter(Boolean).forEach(o=>{const k=o.c+"|"+o.op;(g[k]=g[k]||[]).push(o)});return Object.values(g).map(a=>a.length===1?a[0]:{...a[0],id:"",t:"",x:a.length})};
const setDoc=(r,d,o)=>{const L=[note("set",r,d)];return _setDoc(r,d,o).then(x=>{put(L);return x})};
const updateDoc=(r,d,...a)=>{const L=[note("upd",r,d)];return _updateDoc(r,d,...a).then(x=>{put(L);return x})};
const deleteDoc=r=>{const L=[note("del",r,null)];return _deleteDoc(r).then(x=>{put(L);return x})};
const addDoc=(c,d)=>_addDoc(c,d).then(ref=>{put([note("set",ref,d)]);return ref});
function writeBatch(db){
  const b=_writeBatch(db),L=[],w={
    set(r,d,o){L.push(note("set",r,d));b.set(r,d,o);return w},
    update(r,d,...a){L.push(note("upd",r,d));b.update(r,d,...a);return w},
    delete(r){L.push(note("del",r,null));b.delete(r);return w},
    commit(){return b.commit().then(x=>{put(group(L));return x})}};
  return w;
}
export {collection,doc,addDoc,setDoc,getDoc,getDocs,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch,arrayUnion,orderBy,limit,increment,deleteField,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword};
