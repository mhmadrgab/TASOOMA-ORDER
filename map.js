// خرائط جوه المنصة (من غير ما نفتح خرائط جوجل): مكتبة Leaflet من cdnjs + خريطة TomTom وطبقة الزحمة اللايف (حساب مجاني، نوفمبر 2026).
// TomTom المجاني: ~50 ألف جزء خريطة و2,500 حساب مسار في اليوم. المفتاح ده بيبان في الصفحة عادي (زي أي مفتاح خرائط)؛ اقفله على
// الدومين من my.tomtom.com ← Keys ← Domain whitelist = mhmadrgab.github.io. لو TomTom وقع بنرجع لـ OpenStreetMap لوحده.
// المكتبة بتتحمّل أول مرة بس حد يفتح خريطة، ومعاها بصمة (integrity) علشان محدش يقدر يبدّلها.
const V="1.9.4",CDN=`https://cdnjs.cloudflare.com/ajax/libs/leaflet/${V}/`;
const SRI_JS="sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==";
const SRI_CSS="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==";
let ready=null;
export function leaflet(){
 if(window.L&&window.L.map)return Promise.resolve(window.L);
 if(ready)return ready;
 ready=new Promise((res,rej)=>{
  if(!document.getElementById("lf-css")){const l=document.createElement("link");l.id="lf-css";l.rel="stylesheet";l.href=CDN+"leaflet.min.css";l.integrity=SRI_CSS;l.crossOrigin="anonymous";document.head.appendChild(l)}
  const s=document.createElement("script");s.src=CDN+"leaflet.min.js";s.integrity=SRI_JS;s.crossOrigin="anonymous";
  s.onload=()=>window.L&&window.L.map?res(window.L):(ready=null,rej(new Error("leaflet")));
  s.onerror=()=>{ready=null;s.remove();rej(new Error("leaflet"))};// لا يوجد نت: نحاول مجدداً المرة الجاية
  document.head.appendChild(s);
 });
 return ready;
}
const TT="EKvqbvD3N1wXR53fTP5Ti4XF6lB4BOKX",TTA='&copy; <a href="https://www.tomtom.com" target="_blank" rel="noopener noreferrer">TomTom</a>';
const dark=()=>!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
const lsG=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsS=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
// خريطة جديدة جوه عنصر (المركز الافتراضي الرياض إلى ما نعرف الأماكن) + زرار 🚦 الزحمة (بيتفتكر)
export function baseMap(L,el){
 const m=L.map(el,{zoomControl:true,attributionControl:true,scrollWheelZoom:true}).setView([24.71,46.68],11);
 const base=L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/${dark()?"night":"main"}/{z}/{x}/{y}.png?key=${TT}&tileSize=256&language=ar`,{maxZoom:20,attribution:TTA}).addTo(m);
 // TomTom لم يتم (المفتاح اتقفل أو الحد خلص): نرجع لـ OpenStreetMap
 let bad=0;base.on("tileerror",()=>{if(++bad===6){m.removeLayer(base);if(dark())el.classList.add("tz-dark");L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(m)}});
 // الزحمة اللايف (أخضر = ماشي، أصفر/أحمر = زحمة)
 const tr=L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TT}&tileSize=256`,{maxZoom:20,opacity:.85,zIndex:5});
 if(lsG("tz_traffic")!=="0")tr.addTo(m);
 const C=L.Control.extend({options:{position:"topleft"},onAdd(){const b=L.DomUtil.create("button","tz-trf");b.type="button";const paint=()=>{b.textContent=m.hasLayer(tr)?"🚦 الزحام: ظاهر":"🚦 الزحام: مخفي";b.classList.toggle("off",!m.hasLayer(tr))};paint();
  L.DomEvent.on(b,"click",e=>{L.DomEvent.stop(e);if(m.hasLayer(tr)){m.removeLayer(tr);lsS("tz_traffic","0")}else{tr.addTo(m);lsS("tz_traffic","1")}paint()});L.DomEvent.disableClickPropagation(b);return b}});
 new C().addTo(m);
 return m;
}
// المسار على الطريق الحقيقي + الوقت بالزحمة حالياً (TomTom Routing). pts = [{lat,lng},...] بالترتيب (إلى 25 نقطة).
// النتيجة بتتحفظ على الجهاز علشان مانصرفش من الحد اليومي على نفس المسار: {path:[[lat,lng]], sec, m, delay}
const RC=new Map();
export async function roadRoute(pts,maxAgeMin=10){
 pts=(pts||[]).filter(okPt).slice(0,25);if(pts.length<2)return null;
 const key=pts.map(p=>(+p.lat).toFixed(4)+","+(+p.lng).toFixed(4)).join(":"),c=RC.get(key);
 if(c&&Date.now()-c.at<maxAgeMin*6e4)return c.r;
 try{
  const r=await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${key}/json?key=${TT}&traffic=true&routeType=fastest&travelMode=car`);
  if(!r.ok)return null;const j=await r.json(),rt=j&&j.routes&&j.routes[0];if(!rt)return null;
  const out={path:rt.legs.flatMap(l=>l.points.map(p=>[p.latitude,p.longitude])),sec:rt.summary.travelTimeInSeconds,m:rt.summary.lengthInMeters,delay:rt.summary.trafficDelayInSeconds||0,legs:rt.legs.map(l=>l.summary.travelTimeInSeconds)};
  RC.set(key,{at:Date.now(),r:out});if(RC.size>80)RC.delete(RC.keys().next().value);return out;
 }catch(e){return null}
}
// حركة ناعمة للعلامة من مكانها لمكان جديد (بدل ما تنط)
export function glide(mk,to,ms=1500){
 const a=mk.getLatLng(),b={lat:+to.lat,lng:+to.lng};if(!a||(Math.abs(a.lat-b.lat)<1e-6&&Math.abs(a.lng-b.lng)<1e-6))return;
 if(mk._gl)cancelAnimationFrame(mk._gl);const t0=performance.now();
 const step=t=>{const k=Math.min(1,(t-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;mk.setLatLng([a.lat+(b.lat-a.lat)*e,a.lng+(b.lng-a.lng)*e]);if(k<1)mk._gl=requestAnimationFrame(step);else mk._gl=0};
 mk._gl=requestAnimationFrame(step);
}
// ── العربية ماشية على الشارع (نوفمبر 2026، طلب محمد: "كأني فاتح خرائط جوجل") ──
// بدل ما العلامة تقطع خط مستقيم فوق المباني بين كل إشارة والتانية، بنلزقها على المسار الحقيقي اللي TomTom حسبه (roadRoute)
// ونمشّيها على شكل الشارع نفسه (الملفات والدورانات) بسرعة ثابتة لحد الإشارة الجاية. من غير أي طلبات زيادة لـ TomTom.
const RAD=Math.PI/180;
const mDist=(a,b)=>{const x=(b[1]-a[1])*RAD*Math.cos((a[0]+b[0])/2*RAD),y=(b[0]-a[0])*RAD;return Math.sqrt(x*x+y*y)*6371e3};
// المسار + المسافة التراكمية لكل نقطة (بالمتر)
export function prepPath(path){
 if(!Array.isArray(path)||path.length<2)return null;
 const c=[0];for(let i=1;i<path.length;i++)c.push(c[i-1]+mDist(path[i-1],path[i]));
 return {p:path,c,len:c[c.length-1]};
}
// أقرب نقطة على المسار لنقطة معيّنة: d = المسافة من أول المسار، off = بُعدها عن الطريق بالمتر
// (hint = آخر مكان كان فيه، علشان لو الطريق راجع على نفسه مانختارش الناحية الغلط)
export function projectOn(P,pt,hint){
 if(!P||!okPt(pt))return null;
 const q=[+pt.lat,+pt.lng],k=Math.cos(q[0]*RAD);let best=null;
 for(let i=1;i<P.p.length;i++){
  const a=P.p[i-1],b=P.p[i],ax=(a[1]-q[1])*k,ay=a[0]-q[0],bx=(b[1]-q[1])*k,by=b[0]-q[0],dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;
  let t=L2?-(ax*dx+ay*dy)/L2:0;t=t<0?0:t>1?1:t;
  const s=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],off=mDist(s,q),d=P.c[i-1]+(P.c[i]-P.c[i-1])*t;
  // لو فيه أكتر من مكان قريب بنفس الدرجة، الأقرب لآخر مكان كان فيه (وماترجعش لورا)
  const pen=hint!=null&&d<hint-30?(hint-d):0;
  if(!best||off+pen<best.score)best={d,off,lat:s[0],lng:s[1],score:off+pen};
 }
 return best;
}
// النقطة اللي على بُعد d متر من أول المسار + اتجاه الطريق عندها (بالدرجات، 0 = الشمال)
export function pointAt(P,d){
 d=Math.max(0,Math.min(P.len,d));let lo=1,hi=P.c.length-1;
 while(lo<hi){const m=(lo+hi)>>1;if(P.c[m]<d)lo=m+1;else hi=m}
 const a=P.p[lo-1],b=P.p[lo],seg=P.c[lo]-P.c[lo-1],t=seg?(d-P.c[lo-1])/seg:0;
 const brg=(Math.atan2((b[1]-a[1])*Math.cos(a[0]*RAD),b[0]-a[0])/RAD+360)%360;
 return {lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t,brg};
}
// المسار من d لآخره (علشان الخط يبدأ من العربية زي جوجل)
export function pathFrom(P,d){
 const s=pointAt(P,d),out=[[s.lat,s.lng]];
 for(let i=0;i<P.p.length;i++)if(P.c[i]>d)out.push(P.p[i]);
 return out;
}
// جزء من المسار بين d0 و d1
export function slicePath(P,d0,d1){
 const a=pointAt(P,d0),b=pointAt(P,d1),out=[[a.lat,a.lng]];
 for(let i=0;i<P.p.length;i++)if(P.c[i]>d0&&P.c[i]<d1)out.push(P.p[i]);
 out.push([b.lat,b.lng]);return out;
}
// يمشّي العلامة على المسار من d0 لـ d1 في ms (سرعة ثابتة، زي العربية الحقيقية). onStep(نقطة) مع كل خطوة
export function glideAlong(mk,P,d0,d1,ms,onStep){
 if(mk._gl)cancelAnimationFrame(mk._gl);const t0=performance.now();mk._d=d0;
 const step=t=>{const k=Math.min(1,Math.max(0,(t-t0)/ms)),pt=pointAt(P,d0+(d1-d0)*k);mk._d=d0+(d1-d0)*k;mk.setLatLng([pt.lat,pt.lng]);if(onStep)onStep(pt,k);if(k<1)mk._gl=requestAnimationFrame(step);else mk._gl=0};
 mk._gl=requestAnimationFrame(step);
}
// اتجاه بين نقطتين (لما مفيش مسار)
export const bearing=(a,b)=>(Math.atan2((+b.lng-+a.lng)*Math.cos(+a.lat*RAD),+b.lat-+a.lat)/RAD+360)%360;
// علامة HTML (من غير صور): مركزها على النقطة بالظبط
export const pin=(L,html)=>L.divIcon({className:"tz-pin",html:`<div class="tz-in">${html}</div>`,iconSize:[0,0],iconAnchor:[0,0],popupAnchor:[0,-18],tooltipAnchor:[0,-16]});
export const okPt=p=>!!(p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&!(+p.lat===0&&+p.lng===0));
export const MAP_CSS=`
.tz-map{background:var(--card);border-radius:16px;padding:10px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.tz-mapc{height:380px;border-radius:12px;overflow:hidden;background:#dfe3e6;z-index:0;position:relative}
@media (max-width:600px){.tz-mapc{height:300px}}
.tz-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--mut);margin-top:8px}.tz-bar .bt{width:auto}
.tz-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9)}
.tz-trf{font:700 12.5px "IBM Plex Sans Arabic",Tahoma,sans-serif;background:#fff;color:#1b1b1b;border:2px solid rgba(0,0,0,.2);border-radius:8px;padding:5px 9px;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.2)}.tz-trf.off{opacity:.75}
.tz-pin{background:none;border:0}
.tz-in{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:2px;font:600 12px/1.2 "IBM Plex Sans Arabic",Tahoma,sans-serif}
.tz-d b{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#6a56c9;color:#fff;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.tz-d.old b{background:#8d8a85}
.tz-d b{position:relative}
.tz-hd{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;display:none}
.tz-hd::before{content:"";position:absolute;left:-7px;top:-29px;border:7px solid transparent;border-top:0;border-bottom:10px solid #6a56c9;filter:drop-shadow(0 0 1.5px #fff)}
.tz-d.old .tz-hd{display:none!important}
.tz-d span,.tz-s span{background:rgba(27,27,27,.85);color:#fff;border-radius:8px;padding:2px 7px}
.tz-w{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#1b1b1b;border:2px solid #d4ae5c;font-size:17px;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.tz-b{background:#fff;color:#1b1b1b;border:2px solid #a8832f;border-radius:999px;padding:1px 7px;font-size:11.5px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.tz-b.nx{background:#d4ae5c;border-color:#1b1b1b;font-size:13px;padding:2px 9px}
.tz-s b{display:grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;background:#2f8f3e;color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);font-size:13px}
.tz-s.wait b{background:#8d8a85}.tz-s.pk b{background:#1c4f86}.tz-s.st b{background:#1b1b1b}.tz-s.end b{background:#c4362b}
.leaflet-popup-content{direction:rtl;text-align:right;font:14px/1.6 "IBM Plex Sans Arabic",Tahoma,sans-serif;margin:10px 14px}
.leaflet-container{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif}
`;
