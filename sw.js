// Ø®Ø¯Ù…Ø© Ø¨Ø³ÙŠØ·Ø©: Ø´Ø¨ÙƒØ© Ø£ÙˆÙ„Ø§Ù‹ØŒ ÙˆÙ„Ùˆ Ø§Ù„Ù†Øª Ù‚Ø·Ø¹ ØªÙØªØ­ Ø¢Ø®Ø± Ù†Ø³Ø®Ø© Ù…Ù† Ø§Ù„ØµÙØ­Ø©. Ù…ÙÙŠØ´ ØªØ®Ø²ÙŠÙ† Ù„Ø¨ÙŠØ§Ù†Ø§Øª Firebase.
const V="tasooma-v69";
const SHELL=["./index.html","./admin.html","./ui.css","./ui.js","./i18n.js","./i18n-en.js","./workers.js","./bchat.js","./prof.js","./audit.js","./backup.js","./dash.js","./fb.js","./cust.js","./notify.js","./br-extra.js","./ad-extra.js","./fleet.js","./map.js","./zoom.js","./gifts.js","./staff.js","./driver.html","./manifest-driver.json","./icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.endsWith(".apk"))return;// Ù…Ù„Ù ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø³ÙˆØ§Ù‚ÙŠÙ†: ØªØ­Ù…ÙŠÙ„ Ø¹Ø§Ø¯ÙŠ Ù…Ù† ØºÙŠØ± ØªØ®Ø²ÙŠÙ†
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true})));
});
// Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù„ÙŠ Ø§Ù„ØµÙØ­Ø© Ù†ÙØ³Ù‡Ø§ Ø¨ØªØ¹Ø±Ø¶Ù‡Ø§ (Ù„Ù…Ø§ ØªÙƒÙˆÙ† Ù…ÙØªÙˆØ­Ø© ÙˆÙ…Ø´ Ù‚Ø¯Ø§Ù…Ù‡): Ø§Ù„Ø¶ØºØ· Ø¹Ù„ÙŠÙ‡Ø§ Ø¨ÙŠÙØªØ­ Ø§Ù„Ø±Ø§Ø¨Ø·
self.addEventListener("notificationclick",e=>{
 const l=e.notification.data&&e.notification.data.link;if(!l||typeof l!=="string")return;
 e.notification.close();
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(w=>w.url.split("?")[0]===l.split("?")[0]);return c?c.focus().then(w=>w&&w.navigate?w.navigate(l):w).catch(()=>clients.openWindow(l)):clients.openWindow(l)}));
});
// Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…ÙˆØ¨Ø§ÙŠÙ„ ÙˆØ§Ù„ØªØ·Ø¨ÙŠÙ‚ Ù…Ù‚ÙÙˆÙ„ (Firebase Cloud Messaging): Ø§Ù„Ù…ÙƒØªØ¨Ø© Ø¨ØªØ¹Ø±Ø¶ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± Ù„ÙˆØ­Ø¯Ù‡Ø§ØŒ ÙˆØ§Ù„Ø¶ØºØ· Ø¹Ù„ÙŠÙ‡ Ø¨ÙŠÙØªØ­ Ø§Ù„ØµÙØ­Ø©
try{
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
 firebase.initializeApp({apiKey:"AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",authDomain:"tasooma-ad4fe.firebaseapp.com",projectId:"tasooma-ad4fe",storageBucket:"tasooma-ad4fe.firebasestorage.app",messagingSenderId:"463966731953",appId:"1:463966731953:web:6b43696b49837494d82c90"});
 firebase.messaging();
}catch(e){}
