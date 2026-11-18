// Ø®Ø¯Ù…Ø© Ø¨Ø³ÙŠØ·Ø©: Ø´Ø¨ÙƒØ© Ø£ÙˆÙ„Ø§Ù‹ØŒ ÙˆÙ„Ùˆ Ø§Ù„Ù†Øª Ù‚Ø·Ø¹ ØªÙØªØ­ Ø¢Ø®Ø± Ù†Ø³Ø®Ø© Ù…Ù† Ø§Ù„ØµÙØ­Ø©. Ù…ÙÙŠØ´ ØªØ®Ø²ÙŠÙ† Ù„Ø¨ÙŠØ§Ù†Ø§Øª Firebase.
const V="tasooma-v163";
const SHELL=["./index.html","./admin.html","./ui.css","./ui.js","./icons.js","./mnt.js","./i18n.js","./i18n-en.js","./workers.js","./clean.js","./bchat.js","./prof.js","./audit.js","./backup.js","./dash.js","./fb.js","./sb-lib.js","./sbcore.js","./sb-config.js","./cust.js","./notify.js","./br-extra.js","./ad-extra.js","./fleet.js","./map.js","./zoom.js","./att.js","./gifts.js","./brsheet.js","./po.js","./cat.js","./health.js","./pwself.js","./call.js","./staff.js","./ann.js","./short.js","./pres.js","./track.js","./driver.html","./ext.html","./manifest-driver.json","./icon-192.png"];
// (15 Ù†ÙˆÙÙ…Ø¨Ø± 2026) Ù„Ùˆ Ø§Ù„ØªÙ†Ø²ÙŠÙ„ ÙØ´Ù„ (Ù†Øª Ø¶Ø¹ÙŠÙ) Ø§Ù„ØªØ«Ø¨ÙŠØª Ø¨ÙŠÙØ´Ù„ ÙˆØ§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ø¨ØªÙØ¶Ù„ Ø´ØºÙ‘Ø§Ù„Ø©ØŒ ÙˆØ§Ù„Ù…ØªØµÙØ­ Ø¨ÙŠØ­Ø§ÙˆÙ„ ØªØ§Ù†ÙŠ Ø¨Ø¹Ø¯ÙŠÙ†.
// (ÙƒØ§Ù† Ø§Ù„ÙØ´Ù„ Ø¨ÙŠØªØ¨Ù„Ø¹ ÙØ§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ØªØ´ØªØºÙ„ Ø¨ÙƒØ§Ø´ Ù†Ø§Ù‚Øµ ÙˆØªÙ…Ø³Ø­ Ø§Ù„Ù‚Ø¯ÙŠÙ… â† ÙƒÙ„ Ù…Ù„Ù Ù…Ù† Ø§Ù„Ù†Øª â† Ø´Ø§Ø´Ø© Ø¨ÙŠØ¶Ø§ Ø·ÙˆÙŠÙ„Ø©)
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()))});
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
  .catch(()=>caches.match(key,{ignoreSearch:true}).then(h=>h||fetch(r))));
});
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
try{
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
 firebase.initializeApp({apiKey:"AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",authDomain:"tasooma-ad4fe.firebaseapp.com",projectId:"tasooma-ad4fe",storageBucket:"tasooma-ad4fe.firebasestorage.app",messagingSenderId:"463966731953",appId:"1:463966731953:web:6b43696b49837494d82c90"});
 firebase.messaging();
}catch(e){}
