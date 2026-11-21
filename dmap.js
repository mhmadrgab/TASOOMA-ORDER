// 🧭 خريطة السائق داخل تطبيقه (v203، 21 نوفمبر 2026، طلب محمد «اعمل 7»):
// مكانه الآن (من جواله)، المحطات الباقية بالترتيب، والمسار على الطريق الحقيقي بالزحام (TomTom)، ولوحة «المحطة التالية»
// بالمسافة والوقت وموعد الوصول، وزر «ابدأ الملاحة» يفتح خرائط جوجل للمحطة التالية فقط (للتوجيه صوتياً).
// الخريطة عنصر ثابت ننقله في مكانه بعد كل رسم للصفحة (driver.html يعيد رسم الصفحة كلها مع كل تحديث)، فلا تُعاد من الأول.
// المسار يُحسب من جديد فقط لو تحرّك 1.5 كم، أو مرّت 8 دقائق، أو تغيّرت المحطات، أو خرج عن المسار (مرة كل دقيقة ونص بالكثير).
import {leaflet,baseMap,pin,okPt,MAP_CSS,roadRoute,prepPath,pathFrom,driveTo} from "./map.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number(v)||0;
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const km2=(a,b)=>{if(!okPt(a)||!okPt(b))return 99;const R=6371,t=x=>x*Math.PI/180,dl=t(b.lat-a.lat),dn=t(b.lng-a.lng),h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const WH=`<div class="tz-w"><span class="tzw-i"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6 2.4 7.4a.9.9 0 0 0-.5.8V20.2c0 .5.4.9.9.9H6V12.6c0-.5.4-.9.9-.9h10.2c.5 0 .9.4.9.9v8.5h3.2c.5 0 .9-.4.9-.9V8.2a.9.9 0 0 0-.5-.8L12 2.6Z"/><path d="M7.8 13.5h8.4v2H7.8zM7.8 16.8h8.4v2H7.8zM7.8 20.1h8.4v1H7.8z"/></svg></span><span class="tzw-l">المستودع</span></div>`;
const CSS=`
.dm-card{background:var(--card,#fffaf3);border-radius:16px;padding:12px;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.dm-next{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.dm-next .dm-i{flex:1;min-width:0}
.dm-next small{display:block;color:var(--mut,#6b5d6c);font-size:12.5px}
.dm-next b{display:block;font-size:16px;line-height:1.4;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-kv{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.dm-kv span{background:rgba(138,90,131,.12);color:var(--ink,#2a1d2c);border-radius:999px;padding:2px 10px;font-size:13px;font-weight:600}
.dm-nav{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:46px;padding:0 16px;border-radius:14px;background:#6f7d45;color:#fff!important;font-weight:700;text-decoration:none;white-space:nowrap}
.dm-mapc{height:300px;border-radius:12px;overflow:hidden;background:#dfe3e6;position:relative;z-index:0}
.dm-big .dm-mapc{height:min(70vh,640px)}
.dm-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.dm-bar button{min-height:40px;border-radius:12px;border:1px solid rgba(0,0,0,.14);background:transparent;color:inherit;font:600 13.5px "IBM Plex Sans Arabic",Tahoma,sans-serif;padding:0 12px;cursor:pointer}
.dm-bar button.on{background:#2a1d2c;color:#fff;border-color:#2a1d2c}
.dm-off{font-size:13px;color:var(--mut,#6b5d6c);margin-top:6px}
.dm-hide .dm-mapc,.dm-hide .dm-bar>:not([data-dm="show"]),.dm-hide .dm-off{display:none}
.tz-s.nx b{background:#8a5a83;min-width:32px;height:32px;font-size:15px;border-width:3px}
.tz-s.pk b{background:#1c4f86}
[data-theme=dark] .dm-bar button{border-color:rgba(255,255,255,.18)}
[data-theme=dark] .dm-bar button.on{background:#b48aab;color:#2a1d2c;border-color:#b48aab}
`;
let C=null,D=null;// C = {trip, geo, codeOf, shipOf}; D = حالة الخريطة
function pend(){
 const t=C&&C.trip();if(!t)return [];const G=C.geo()||{},br=G.br||{};
 const out=[];(Array.isArray(t.stops)?t.stops:[]).filter(s=>s&&!s.arr).forEach(s=>{
  if(s.fr&&!s.pk){const p=br[String(s.fr)];if(okPt(p))out.push({lat:+p.lat,lng:+p.lng,n:s.frn||s.fr,kind:"pk",rid:s.rid})}
  const p=br[C.codeOf(s.brn)];if(okPt(p))out.push({lat:+p.lat,lng:+p.lng,n:s.brn,kind:C.shipOf&&C.shipOf(s)?"sh":"dl",rid:s.rid});
 });
 return out;
}
const pathKm=(path,from,to)=>{let k=0;for(let i=Math.max(1,from+1);i<=to&&i<path.length;i++)k+=km2({lat:path[i-1][0],lng:path[i-1][1]},{lat:path[i][0],lng:path[i][1]});return k};
export function initDMap(ctx){
 C=ctx;
 if(!document.getElementById("dm-css")){const s=document.createElement("style");s.id="dm-css";s.textContent=MAP_CSS+CSS;document.head.appendChild(s)}
}
// بعد كل رسم: ننقل الكارت لمكانه (#dmap-slot) ونحدّث المحتوى
export function dmapMount(slot){
 if(!slot||!C)return;
 if(!D){
  const host=document.createElement("div");host.className="dm-card"+(ls("drv_map")==="0"?" dm-hide":"")+(ls("drv_mapbig")==="1"?" dm-big":"");
  host.innerHTML=`<div class="dm-next" id="dm-next"></div><div class="dm-mapc"></div><div class="dm-bar"><button type="button" data-dm="follow" class="on">📍 تابع موقعي</button><button type="button" data-dm="fit">⤢ كل المسار</button><button type="button" data-dm="big">${ls("drv_mapbig")==="1"?"تصغير الخريطة":"تكبير الخريطة"}</button><button type="button" data-dm="show">${ls("drv_map")==="0"?"🗺 أظهر الخريطة":"إخفاء الخريطة"}</button></div><div class="dm-off" id="dm-st"></div>`;
  D={host,map:null,L:null,me:null,mk:new Map(),line:null,rt:null,rtKey:"",rtAt:0,rtFrom:null,busy:false,follow:true,loading:false,pos:null,fitKey:""};
  host.addEventListener("click",onClick);
 }
 if(D.host.parentNode!==slot)slot.appendChild(D.host);
 if(!D.pos){const t=C.trip();if(t&&okPt(t.loc))D.pos={lat:+t.loc.lat,lng:+t.loc.lng,ts:N(t.loc.ts)}}
 paintNext();
 if(D.host.classList.contains("dm-hide"))return;
 if(D.map){D.map.invalidateSize();paint();return}
 if(D.loading)return;D.loading=true;
 leaflet().then(L=>{if(!D)return;D.loading=false;D.L=L;D.map=baseMap(L,D.host.querySelector(".dm-mapc"),{coop:true});
  D.map.on("dragstart",()=>{if(D&&D.follow){D.follow=false;btn()}});paint()})
  .catch(()=>{if(!D)return;D.loading=false;const c=D.host.querySelector(".dm-mapc");if(c)c.innerHTML='<div style="padding:30px;text-align:center;color:#888">تعذّر تحميل الخريطة. تأكد من الإنترنت.</div>'});
}
export function dmapStop(){if(!D)return;try{if(D.map)D.map.remove()}catch(e){}if(D.host&&D.host.parentNode)D.host.remove();D=null}
// مكان جديد من جوال السائق (watchPosition في driver.html)
export function dmapPos(pt){if(!D||!okPt(pt))return;D.pos={lat:+pt.lat,lng:+pt.lng,ts:Date.now()};paintNext();if(D.map)paint()}
function btn(){if(!D)return;const b=D.host.querySelector('[data-dm="follow"]');if(b)b.classList.toggle("on",D.follow)}
function onClick(e){
 const b=e.target.closest("[data-dm]");if(!b||!D)return;const a=b.dataset.dm;
 if(a==="follow"){D.follow=true;btn();if(D.map&&D.pos)D.map.setView([D.pos.lat,D.pos.lng],Math.max(D.map.getZoom(),15),{animate:true})}
 else if(a==="fit"){D.follow=false;btn();fit()}
 else if(a==="big"){const big=!D.host.classList.contains("dm-big");D.host.classList.toggle("dm-big",big);ls("drv_mapbig",big?"1":"0");b.textContent=big?"تصغير الخريطة":"تكبير الخريطة";setTimeout(()=>{if(D&&D.map)D.map.invalidateSize()},260)}
 else if(a==="show"){const hide=!D.host.classList.contains("dm-hide");D.host.classList.toggle("dm-hide",hide);ls("drv_map",hide?"0":"1");b.textContent=hide?"🗺 أظهر الخريطة":"إخفاء الخريطة";if(!hide)dmapMount(D.host.parentNode)}
}
function fit(){
 if(!D||!D.map)return;const ll=[];if(D.pos)ll.push([D.pos.lat,D.pos.lng]);pend().forEach(p=>ll.push([p.lat,p.lng]));
 if(ll.length===1)D.map.setView(ll[0],15);else if(ll.length)D.map.fitBounds(ll,{padding:[40,40],maxZoom:16});
}
function mark(key,pt,html,z,pop){
 const L=D.L;let m=D.mk.get(key);
 if(!m){m=L.marker([pt.lat,pt.lng],{icon:pin(L,html),zIndexOffset:z||0,keyboard:false});if(pop)m.bindPopup(pop);m.addTo(D.map);D.mk.set(key,m);m._tzH=html}
 else{m.setLatLng([pt.lat,pt.lng]);if(m._tzH!==html){m.setIcon(pin(L,html));m._tzH=html}if(pop)m.setPopupContent(pop)}
 m._tzSeen=1;return m;
}
function paint(){
 if(!D||!D.map||!C)return;const L=D.L,G=C.geo()||{},P=pend();
 D.mk.forEach(m=>{m._tzSeen=0});
 if(okPt(G.wh))mark("wh",{lat:+G.wh.lat,lng:+G.wh.lng},WH,300,"<b>المستودع</b>");
 P.forEach((p,i)=>{const nx=i===0;mark("s"+i+"_"+p.rid+p.kind,p,`<div class="tz-s${nx?" nx":""}${p.kind==="pk"?" pk":""}"><b>${p.kind==="pk"?"استلام":i+1}</b><span><bdi dir="ltr">${E(String(p.n).split("-")[0])}</bdi></span></div>`,nx?800:500,`<b><bdi dir="ltr">${E(p.n)}</bdi></b><br>${p.kind==="pk"?"استلام تحويل":p.kind==="sh"?"تسليم لشركة الشحن":"تسليم"}${nx?"<br>المحطة التالية":""}`)});
 // مكاني: العربية بتمشي على المسار المحسوب لو قريبة منه (نفس حركة خريطة المستودع)
 if(D.pos){
  const car=mark("me",D.pos,`<div class="tz-d"><b>🚚<i class="tz-hd"></i></b><span>أنت</span></div>`,1000);
  const RP=D.rt&&D.rt.path&&D.rt.path.length>1?(D.rt._P||(D.rt._P=prepPath(D.rt.path))):null;
  driveTo(car,{...D.pos},RP,{ms:4000,onMove:pt=>{if(D&&D.follow&&D.map)D.map.panTo([pt.lat,pt.lng],{animate:false});if(D&&D.line&&RP&&car._P&&car._d!=null&&(car._P===RP||car._P.of===RP))D.line.setLatLngs(pathFrom(car._P,car._d))}});
 }
 [...D.mk.entries()].forEach(([k,m])=>{if(!m._tzSeen){D.map.removeLayer(m);D.mk.delete(k)}});
 // المسار
 if(D.pos&&P.length){
  const key=P.map(p=>p.lat.toFixed(4)+","+p.lng.toFixed(4)).join("|"),car=D.mk.get("me"),off=car&&car._tzOff!=null&&car._tzOff>150;
  if(!D.busy&&(key!==D.rtKey||Date.now()-D.rtAt>8*6e4||km2(D.rtFrom,D.pos)>1.5||(off&&Date.now()-D.rtAt>9e4))){
   D.busy=true;D.rtKey=key;D.rtAt=Date.now();D.rtFrom={...D.pos};
   roadRoute([D.pos,...P],8).then(r=>{if(!D)return;D.busy=false;if(r){D.rt=r;paintNext();paint()}}).catch(()=>{if(D)D.busy=false});
  }
  const pts=D.rt&&D.rt.path&&D.rt.path.length>1?D.rt.path:[[D.pos.lat,D.pos.lng],...P.map(p=>[p.lat,p.lng])];
  if(!D.line)D.line=L.polyline(pts,{color:"#8a5a83",weight:6,opacity:.85,lineJoin:"round"}).addTo(D.map);else D.line.setLatLngs(pts);
  D.line.setStyle(D.rt?{dashArray:null,opacity:.85}:{dashArray:"8 8",opacity:.6});
 }else if(D.line){D.map.removeLayer(D.line);D.line=null}
 const fk=P.map(p=>p.rid).join(",")+"|"+(D.pos?1:0);
 if(fk!==D.fitKey){D.fitKey=fk;if(D.follow&&D.pos)D.map.setView([D.pos.lat,D.pos.lng],15);else fit()}
}
// لوحة «المحطة التالية»
function paintNext(){
 if(!D)return;const el=D.host.querySelector("#dm-next"),st=D.host.querySelector("#dm-st"),P=pend();if(!el)return;
 if(!P.length){el.innerHTML=`<div class="dm-i"><b style="direction:rtl;text-align:right">سلّمت كل المحطات 👏</b><small>ارجع إلى المستودع وأنهِ الرحلة.</small></div>`;if(st)st.textContent="";return}
 const nx=P[0],r=D.rt,leg=r&&Array.isArray(r.legs)?N(r.legs[0]):0,cut=r&&Array.isArray(r.cuts)?r.cuts[0]:-1;
 const km=r&&r.path&&cut>0?pathKm(r.path,0,cut):(D.pos?km2(D.pos,nx)*1.3:0),tot=r?N(r.sec):0;
 const nav=`https://www.google.com/maps/dir/?api=1&destination=${nx.lat},${nx.lng}&travelmode=driving`;
 el.innerHTML=`<div class="dm-i"><small>${nx.kind==="pk"?"المحطة التالية: استلام تحويل من":nx.kind==="sh"?"المحطة التالية: شركة الشحن لفرع":"المحطة التالية"}</small><b>${E(nx.n)}</b><div class="dm-kv">${leg?`<span>~${Math.max(1,Math.round(leg/60))} د</span>`:""}${km?`<span>${km.toFixed(1)} كم</span>`:""}${leg?`<span>الوصول ~${hm(Date.now()+leg*1000)}</span>`:""}${P.length>1?`<span>باقي ${P.length} محطات${tot?` · ~${Math.round(tot/60)} د`:""}</span>`:""}</div></div><a class="dm-nav" href="${E(nav)}" target="_blank" rel="noopener noreferrer">🧭 ابدأ الملاحة</a>`;
 if(st)st.textContent=!D.pos?"بانتظار موقعك من الجوال… تأكد أن الموقع (GPS) مفعّل.":r?(N(r.delay)>60?`الوقت محسوب مع الزحام الحالي (منه ~${Math.round(N(r.delay)/60)} د زحام).`:"الوقت محسوب مع الزحام الحالي."):"جاري حساب المسار على الطريق…";
}
