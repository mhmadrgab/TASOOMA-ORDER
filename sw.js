// خدمة بسيطة: شبكة أولاً، ولو النت قطع تفتح آخر نسخة من الصفحة. مفيش تخزين لبيانات Firebase.
const V="tasooma-v8";
const SHELL=["./index.html","./admin.html","./ui.css","./ui.js","./fb.js","./cust.js","./notify.js","./br-extra.js","./ad-extra.js","./fleet.js","./staff.js","./driver.html","./manifest-driver.json","./icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 const u=new URL(r.url);if(u.origin!==location.origin)return;
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true})));
});
