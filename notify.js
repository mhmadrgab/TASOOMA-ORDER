// تنبيهات + تثبيت التطبيق (مشترك)
export const canNotify=()=>"Notification" in window;
export async function askNotify(){if(!canNotify())return "unsupported";try{return await Notification.requestPermission()}catch(e){return "denied"}}
export function notify(title,body,tag){try{if(canNotify()&&Notification.permission==="granted"&&document.hidden){new Notification(title,{body,tag,icon:"./icon-192.png",dir:"rtl",lang:"ar"})}}catch(e){}}
export function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),v=c.createGain();o.connect(v);v.connect(c.destination);o.frequency.value=880;v.gain.setValueAtTime(.2,c.currentTime);v.gain.exponentialRampToValueAtTime(.001,c.currentTime+.6);o.start();o.stop(c.currentTime+.6)}catch(e){}}
export function badge(n){try{if(navigator.setAppBadge){n>0?navigator.setAppBadge(n):navigator.clearAppBadge()}}catch(e){}}
let dip=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();dip=e;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=false)});
addEventListener("appinstalled",()=>document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true));
export async function install(){if(!dip)return false;dip.prompt();try{await dip.userChoice}catch(e){}dip=null;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true);return true}
export const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone=()=>(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
// لو الصفحة خلصت تحميل خلاص (زي لوحة المستودع اللي بتنادي دي بعد الدخول) نسجّل على طول، وإلا نستنى التحميل
export function regSW(){if(!("serviceWorker" in navigator))return;const go=()=>navigator.serviceWorker.register("./sw.js").catch(()=>{});document.readyState==="complete"?go():addEventListener("load",go)}
// ربط زرار الجرس وزرار التثبيت
export function wireButtons(){
  const bell=document.getElementById("bell"),ins=document.querySelectorAll("[data-install]");
  const paint=()=>{if(!bell)return;if(!canNotify()){bell.hidden=true;return}bell.textContent=Notification.permission==="granted"?"🔔 التنبيهات مفعّلة":"🔔 تفعيل التنبيهات";bell.dataset.on=Notification.permission==="granted"?"1":"0"};
  paint();
  if(bell)bell.onclick=async()=>{if(Notification.permission==="denied"){alert("التنبيهات مقفولة من إعدادات المتصفح. افتح إعدادات الموقع (القفل جنب الرابط) وفعّل الإشعارات.");return}
   if(isIOS()&&!isStandalone()){alert("على الآيفون: الإشعارات بتشتغل بس من التطبيق المثبّت. دوس زرار المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من هناك وفعّل التنبيهات.");return}
   await askNotify();paint();
   // تسجيل الجهاز لإشعارات الموبايل، ونقول النتيجة بوضوح
   if(Notification.permission==="granted"&&window.__push){bell.textContent="⏳ جاري التسجيل...";const ok=await window.__push();paint();
    alert(ok?"✅ تم! الموبايل ده هيوصله الإشعارات حتى والتطبيق مقفول.":"⚠️ ماقدرناش نسجّل الموبايل للإشعارات. اتأكد إن النت شغّال، ولو آيفون لازم التطبيق يكون مثبّت على الشاشة الرئيسية. جرّب تاني.")}};
  ins.forEach(b=>b.onclick=async()=>{if(!(await install())&&isIOS()){alert("على الآيفون: دوس زرار المشاركة (المربع والسهم) ثم اختار «إضافة إلى الشاشة الرئيسية».")}});
  if(isIOS()&&!isStandalone())ins.forEach(b=>b.hidden=false);
}
