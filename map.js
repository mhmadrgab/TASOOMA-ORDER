// خرائط جوه المنصة (من غير ما نفتح خرائط جوجل): مكتبة Leaflet من cdnjs + خريطة OpenStreetMap الرسمية (ببلاش، وأسماء الشوارع عربي).
// (CARTO بقت بتطلب مفتاح مدفوع، نوفمبر 2026.) شروط OpenStreetMap: استخدام خفيف + كتابة اسمهم على الخريطة (attribution).
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
  s.onerror=()=>{ready=null;s.remove();rej(new Error("leaflet"))};// مفيش نت: نحاول تاني المرة الجاية
  document.head.appendChild(s);
 });
 return ready;
}
const dark=()=>!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
// خريطة جديدة جوه عنصر (المركز الافتراضي الرياض لحد ما نعرف الأماكن)
export function baseMap(L,el){
 if(dark())el.classList.add("tz-dark");// الوضع الليلي: نفس الخريطة بألوان غامقة (فلتر)
 const m=L.map(el,{zoomControl:true,attributionControl:true,scrollWheelZoom:true}).setView([24.71,46.68],11);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(m);
 return m;
}
// علامة HTML (من غير صور): مركزها على النقطة بالظبط
export const pin=(L,html)=>L.divIcon({className:"tz-pin",html:`<div class="tz-in">${html}</div>`,iconSize:[0,0],iconAnchor:[0,0],popupAnchor:[0,-18],tooltipAnchor:[0,-16]});
export const okPt=p=>!!(p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&!(+p.lat===0&&+p.lng===0));
export const MAP_CSS=`
.tz-map{background:var(--card);border-radius:16px;padding:10px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.tz-mapc{height:380px;border-radius:12px;overflow:hidden;background:#dfe3e6;z-index:0;position:relative}
@media (max-width:600px){.tz-mapc{height:300px}}
.tz-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--mut);margin-top:8px}.tz-bar .bt{width:auto}
.tz-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9)}
.tz-pin{background:none;border:0}
.tz-in{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:2px;font:600 12px/1.2 "IBM Plex Sans Arabic",Tahoma,sans-serif}
.tz-d b{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#6a56c9;color:#fff;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.tz-d.old b{background:#8d8a85}
.tz-d span,.tz-s span{background:rgba(27,27,27,.85);color:#fff;border-radius:8px;padding:2px 7px}
.tz-w{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#1b1b1b;border:2px solid #d4ae5c;font-size:17px;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.tz-b{background:#fff;color:#1b1b1b;border:2px solid #a8832f;border-radius:999px;padding:1px 7px;font-size:11.5px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.tz-b.nx{background:#d4ae5c;border-color:#1b1b1b;font-size:13px;padding:2px 9px}
.tz-s b{display:grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;background:#2f8f3e;color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);font-size:13px}
.tz-s.wait b{background:#8d8a85}.tz-s.pk b{background:#1c4f86}.tz-s.st b{background:#1b1b1b}.tz-s.end b{background:#c4362b}
.leaflet-popup-content{direction:rtl;text-align:right;font:14px/1.6 "IBM Plex Sans Arabic",Tahoma,sans-serif;margin:10px 14px}
.leaflet-container{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif}
`;
