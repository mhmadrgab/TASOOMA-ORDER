// Ø®Ø¯Ù…Ø© Ø¨Ø³ÙŠØ·Ø©: Ø´Ø¨ÙƒØ© Ø£ÙˆÙ„Ø§Ù‹ØŒ ÙˆÙ„Ùˆ Ø§Ù„Ù†Øª Ù‚Ø·Ø¹ ØªÙØªØ­ Ø¢Ø®Ø± Ù†Ø³Ø®Ø© Ù…Ù† Ø§Ù„ØµÙØ­Ø©. Ù…ÙÙŠØ´ ØªØ®Ø²ÙŠÙ† Ù„Ø¨ÙŠØ§Ù†Ø§Øª Firebase.
const V="tasooma-v257";
const SHELL=["./index.html","./admin.html","./ui.css","./ui.js","./icons.js","./mnt.js","./mkt.js","./i18n.js","./i18n-en.js","./workers.js","./clean.js","./bchat.js","./prof.js","./audit.js","./backup.js","./dash.js","./fb.js","./sb-lib.js","./sbcore.js","./sb-config.js","./cust.js","./notify.js","./br-extra.js","./ad-extra.js","./fleet.js","./map.js","./zoom.js","./att.js","./gifts.js","./brsheet.js","./po.js","./porcv.js","./privacy.html","./terms.html","./legal.css","./cat.js","./health.js","./pwself.js","./tzset.js","./stock.js","./call.js","./staff.js","./ann.js","./short.js","./pres.js","./track.js","./notes.js","./brstock.js","./dmap.js","./brnav.js","./bcus.js","./bday.js","./tasks.js","./space.js","./pimg.js","./errand.js","./driver.html","./ext.html","./manifest-driver.json","./icon-192.png"];
// (15 Ù†ÙˆÙÙ…Ø¨Ø± 2026) Ù„Ùˆ Ø§Ù„ØªÙ†Ø²ÙŠÙ„ ÙØ´Ù„ (Ù†Øª Ø¶Ø¹ÙŠÙ) Ø§Ù„ØªØ«Ø¨ÙŠØª Ø¨ÙŠÙØ´Ù„ ÙˆØ§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ø¨ØªÙØ¶Ù„ Ø´ØºÙ‘Ø§Ù„Ø©ØŒ ÙˆØ§Ù„Ù…ØªØµÙØ­ Ø¨ÙŠØ­Ø§ÙˆÙ„ ØªØ§Ù†ÙŠ Ø¨Ø¹Ø¯ÙŠÙ†.
// (ÙƒØ§Ù† Ø§Ù„ÙØ´Ù„ Ø¨ÙŠØªØ¨Ù„Ø¹ ÙØ§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ØªØ´ØªØºÙ„ Ø¨ÙƒØ§Ø´ Ù†Ø§Ù‚Øµ ÙˆØªÙ…Ø³Ø­ Ø§Ù„Ù‚Ø¯ÙŠÙ… â† ÙƒÙ„ Ù…Ù„Ù Ù…Ù† Ø§Ù„Ù†Øª â† Ø´Ø§Ø´Ø© Ø¨ÙŠØ¶Ø§ Ø·ÙˆÙŠÙ„Ø©)
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"}))).then(()=>Promise.all(EXTRA.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{}))))).then(()=>self.skipWaiting()))});
// ملفات مفيدة بلا نت (أيقونات التطبيق المثبّت وبياناته): لو واحد منها غير موجود لا يفشل التثبيت
const EXTRA=["./manifest.json","./manifest-admin.json","./icon-512.png"];
// (16 Ù†ÙˆÙÙ…Ø¨Ø± 2026) Ø§Ù„ØµÙØ­Ø© Ø¨ØªØ³Ø£Ù„ "Ø¥Ù†Øª Ø£Ù†Ù‡ÙŠ Ù†Ø³Ø®Ø©ØŸ" Ø¹Ù„Ø´Ø§Ù† ØªØ¹Ø±Ø¶ Ø±Ù‚Ù… Ø§Ù„Ù†Ø³Ø®Ø© Ø¨Ø¹Ø¯ Ø§Ù„ØªØ­Ø¯ÙŠØ«
let PENDC=null;// {id,act,ts}: ضغطة "رد/رفض" على إشعار مكالمة والمنصة مقفولة (17 نوفمبر 2026)
self.addEventListener("message",e=>{const d=e.data;if(d&&d.t==="ver"&&e.source)e.source.postMessage({t:"ver",v:V});
 if(d&&d.t==="call-pend"&&e.source&&PENDC){const p=PENDC;PENDC=null;if(Date.now()-p.ts<60000)e.source.postMessage({t:"tz-call",id:p.id,act:p.act})}});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.endsWith(".apk"))return;// Ù…Ù„Ù ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø³ÙˆØ§Ù‚ÙŠÙ†: ØªØ­Ù…ÙŠÙ„ Ø¹Ø§Ø¯ÙŠ Ù…Ù† ØºÙŠØ± ØªØ®Ø²ÙŠÙ†
 // (14 Ù†ÙˆÙÙ…Ø¨Ø± 2026ØŒ "Ø§Ù„Ù…Ù†ØµØ© ØªÙ‚ÙŠÙ„Ø©") Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø² Ø§Ù„Ø£ÙˆÙ„: Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ù†ØµØ© Ø¨ØªØªÙ†Ø²Ù‘Ù„ Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© Ù„ÙƒÙ„ Ù†Ø³Ø®Ø© (V) ÙˆÙ‚Øª Ø§Ù„ØªØ«Ø¨ÙŠØªØŒ ÙˆØ¨Ø¹Ø¯Ù‡Ø§ Ø¨ØªÙØªØ­ Ù…Ù† Ø§Ù„Ø¬Ù‡Ø§Ø² ÙÙˆØ±Ø§Ù‹
 // Ù…Ù† ØºÙŠØ± Ù…Ø§ ØªØ³ØªÙ†Ù‰ Ø§Ù„Ù†Øª (ÙƒØ§Ù† ÙƒÙ„ Ù…Ù„Ù Ø¨ÙŠØ³Ø£Ù„ GitHub ÙƒÙ„ ÙØªØ­Ø©ØŒ ~36 Ù…Ù„Ù = Ø«ÙˆØ§Ù†ÙŠ Ø¹Ù„Ù‰ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…ÙˆØ¨Ø§ÙŠÙ„).
 // Ø§Ù„ØªØ­Ø¯ÙŠØ«: Ø£ÙŠ Ø±ÙØ¹ Ø¬Ø¯ÙŠØ¯ Ø¨ÙŠØºÙŠÙ‘Ø± V Ù‡Ù†Ø§ â† Ø§Ù„Ù…ØªØµÙØ­ Ø¨ÙŠÙ„Ø§Ø­Ø¸ Ø¥Ù† sw.js Ø§ØªØºÙŠÙ‘Ø± â† Ø¨ÙŠÙ†Ø²Ù‘Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ÙƒÙ„Ù‡Ø§ ÙÙŠ Ø§Ù„Ø®Ù„ÙÙŠØ© â† ui.js Ø¨ÙŠØ¹Ù…Ù„ Ø±ÙŠÙØ±Ø´ Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø©.
 // âš ï¸ Ù„Ø§Ø²Ù… V ÙŠØªØºÙŠÙ‘Ø± Ù…Ø¹ ÙƒÙ„ Ø±ÙØ¹ (ÙˆØ¥Ù„Ø§ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ù‡ØªÙØ¶Ù„ Ø¨Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø©).
 const nav=r.mode==="navigate",key=nav?(/\/$/.test(u.pathname)?new URL("./index.html",self.registration.scope).href:u.origin+u.pathname):r;
 e.respondWith(caches.open(V).then(c=>c.match(key,{ignoreSearch:true}).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&res.type==="basic"&&!res.redirected)c.put(key,res.clone());return res})))
  .catch(()=>caches.match(key,{ignoreSearch:true}).then(h=>h||(nav?offPage():fetch(r)))));
});
// 📡 (21 نوفمبر 2026) صفحة غير محفوظة والنت مقطوع: بدل صفحة المتصفح البيضاء نعرض صفحة بهوية المنصة تعيد المحاولة وحدها
function offPage(){
 const h='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#2a1d2c"><title>تاسومة</title>'+
  '<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#2a1d2c;color:#f3edf1;font:17px/1.8 Tahoma,sans-serif;text-align:center;padding:24px}b{font-size:13px;letter-spacing:.5em;color:#b48aab}p{margin:0;color:#b9a9ba;font-size:14.5px}a{background:#b48aab;color:#2a1d2c;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:14px}</style></head>'+
  '<body><b>TASOOMA</b><div>لا يوجد اتصال بالإنترنت</div><p>ستفتح المنصة تلقائياً فور عودة الاتصال</p><a href="">إعادة المحاولة</a>'+
  '<script>addEventListener("online",function(){location.reload()});setInterval(function(){if(navigator.onLine)location.reload()},15000)</script></body></html>';
 return new Response(h,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
// Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù„ÙŠ Ø§Ù„ØµÙØ­Ø© Ù†ÙØ³Ù‡Ø§ Ø¨ØªØ¹Ø±Ø¶Ù‡Ø§ (Ù„Ù…Ø§ ØªÙƒÙˆÙ† Ù…ÙØªÙˆØ­Ø© ÙˆÙ…Ø´ Ù‚Ø¯Ø§Ù…Ù‡): Ø§Ù„Ø¶ØºØ· Ø¹Ù„ÙŠÙ‡Ø§ Ø¨ÙŠÙØªØ­ Ø§Ù„Ø±Ø§Ø¨Ø·
// 📞 (17 نوفمبر 2026) إشعار المكالمة: "رد" بيفتح المنصة ويرد على طول، "رفض" بيرفض (لو المنصة مفتوحة من غير ما تظهر قدامه)
// إشعارات Firebase نفسها شايلة الرابط جوه FCM_MSG، فبنقراه من هناك ونوقف معالج Firebase علشان مايفتحش مرتين
self.addEventListener("notificationclick",e=>{
 const nd=e.notification.data||{},fm=nd.FCM_MSG||null;
 let l=nd.link||(fm&&((fm.data&&fm.data.link)||(fm.fcmOptions&&fm.fcmOptions.link)||(fm.notification&&fm.notification.click_action)))||"";
 if(!l||typeof l!=="string")return;
 if(/[?&]call=/.test(l)){
  e.notification.close();if(fm)e.stopImmediatePropagation();
  const act=e.action==="reject"?"rej":"acc",id=(l.match(/[?&]call=([^&#]+)/)||[])[1]||"";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
   const c=cs.find(w=>w.url.split("?")[0]===l.split("?")[0]);
   if(c){c.postMessage({t:"tz-call",act,id});return act==="rej"?null:c.focus().catch(()=>{})}
   PENDC={id,act,ts:Date.now()};return clients.openWindow(l);
  }));
  return;
 }
 if(fm){e.notification.close();e.stopImmediatePropagation();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(w=>w.url.split("?")[0]===l.split("?")[0]);return c?c.focus().then(w=>w&&w.navigate?w.navigate(l):w).catch(()=>clients.openWindow(l)):clients.openWindow(l)}));return}
 e.notification.close();
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(w=>w.url.split("?")[0]===l.split("?")[0]);return c?c.focus().then(w=>w&&w.navigate?w.navigate(l):w).catch(()=>clients.openWindow(l)):clients.openWindow(l)}));
});
// Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…ÙˆØ¨Ø§ÙŠÙ„ ÙˆØ§Ù„ØªØ·Ø¨ÙŠÙ‚ Ù…Ù‚ÙÙˆÙ„ (Firebase Cloud Messaging): Ø§Ù„Ù…ÙƒØªØ¨Ø© Ø¨ØªØ¹Ø±Ø¶ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± Ù„ÙˆØ­Ø¯Ù‡Ø§ØŒ ÙˆØ§Ù„Ø¶ØºØ· Ø¹Ù„ÙŠÙ‡ Ø¨ÙŠÙØªØ­ Ø§Ù„ØµÙØ­Ø©
// 🔔 (v179) سجل الإشعارات: كل إشعار يوصل الجهاز يتحفظ في IndexedDB (tz-notes)، وصفحة المنصة بتنقله للسجل (notes.js) أول ما تفتح.
// ماعدا المكالمات. مابنعرضش حاجة هنا (Firebase هي اللي بتعرض الإشعار).
self.addEventListener("push",e=>{let d=null;try{d=e.data&&e.data.json()}catch(x){d=null}if(!d||typeof d!=="object")return;
 const n=d.notification||{},dt=d.data||{},tag=String(dt.tag||"");
 // ⚡ (v213) مكالمة واردة والمنصة مفتوحة: نبلّغ الصفحة فوراً برقم المكالمة (ترن من غير انتظار السماع اللحظي)
 if(tag.indexOf("call")===0&&dt.type!=="callend"&&/^[A-Za-z0-9_-]{8,64}$/.test(tag.slice(4)))e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{cs.forEach(c=>{try{c.postMessage({t:"tz-call-in",id:tag.slice(4)})}catch(x){}})}).catch(()=>{}));
 if(dt.type==="call"||dt.type==="callend"||tag.indexOf("call")===0)return;
 const t=String(n.title||dt.t||"").slice(0,140),b=String(n.body||dt.b||"").slice(0,400),l=String((d.fcmOptions&&d.fcmOptions.link)||dt.link||n.click_action||"").slice(0,300);if(!t&&!b)return;
 e.waitUntil(new Promise(ok=>{try{const r=indexedDB.open("tz-notes",1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("n"))db.createObjectStore("n",{keyPath:"id",autoIncrement:true})};r.onerror=()=>ok();
  r.onsuccess=()=>{const db=r.result;try{const tx=db.transaction("n","readwrite"),s=tx.objectStore("n");s.add({t,b,l,at:Date.now()});tx.oncomplete=()=>{db.close();ok()};tx.onerror=()=>{db.close();ok()}}catch(x){db.close();ok()}}}catch(x){ok()}}));
});
try{
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
 firebase.initializeApp({apiKey:"AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",authDomain:"tasooma-ad4fe.firebaseapp.com",projectId:"tasooma-ad4fe",storageBucket:"tasooma-ad4fe.firebasestorage.app",messagingSenderId:"463966731953",appId:"1:463966731953:web:6b43696b49837494d82c90"});
 firebase.messaging();
}catch(e){}
