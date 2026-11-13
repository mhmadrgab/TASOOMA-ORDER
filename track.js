// 📍 "تابع السائق" عند الفرع (نوفمبر 2026، طلب محمد: الفرع يشوف السائق جايله على الخريطة زي تطبيقات التوصيل).
// - الفرع بيقرا live/{السائق} (القواعد بتسمحله بس لو كوده في b = الفروع اللي لسه مستنية السائق ده، والسيرفر هو اللي بيكتبها)
//   وgeo/main مرة واحدة (أماكن الفروع). مفيش أي كتابة من هنا.
// - توفير القراءات: السماع شغّال بس والخريطة مفتوحة والصفحة ظاهرة (بيقف لو المستخدم خرج من الصفحة أو قفل الخريطة).
// - الطريق والوقت من TomTom (roadRoute): من مكان السائق، على الفروع اللي قبلك بالترتيب (لو فيه)، لحد فرعك.
//   بيتحسب تاني بس لو اتحرك 2 كم، أو عدّى 10 دقايق، أو خرج عن الطريق، أو ترتيب الفروع اتغيّر (الحد المجاني 2,500 في اليوم).
// - لو السائق مش مشغّل تطبيق التتبع (مفيش live): رسالة واضحة، والوقت المتوقع العادي يفضل ظاهر في الطلب.
import {doc,getDoc,onSnapshot} from "./fb.js";
import {leaflet,baseMap,pin,okPt,MAP_CSS,roadRoute,prepPath,pathFrom,driveTo} from "./map.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const hm=t=>new Date(t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"الآن":m<60?`منذ ${m} د`:`منذ ${Math.round(m/60)} س`};
const km=(a,b)=>{const R=6371,t=x=>x*Math.PI/180,dl=t(b.lat-a.lat),dn=t(b.lng-a.lng),h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const STALE=6*6e4,STOP_MIN=5;
let C=null;// {db, code, getReq}
let GEO=null;// أماكن الفروع (بتتقري مرة واحدة)
let T=null;// الخريطة المفتوحة حالياً
const CSS=MAP_CSS+`
#trk{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
#trk .trk-in{background:var(--card,#fff);color:var(--tx,#2a1d2c);width:min(720px,100%);max-height:96vh;overflow:auto;border-radius:20px 20px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.3)}
@media (min-width:760px){#trk{align-items:center}#trk .trk-in{border-radius:20px}}
#trk h3{margin:0 0 4px;font-size:17px}
#trk .trk-s{font-size:14px;font-weight:700;border-radius:12px;padding:9px 12px;margin:8px 0;background:#e3f0fb;color:#1c4f86}
#trk .trk-s.n{background:#1f8a3c;color:#fff}#trk .trk-s.w{background:#fdecea;color:#c0392b}
#trk .trk-m{font-size:12.5px;color:var(--mut,#74687a);margin-top:6px;line-height:1.7}
#trk .tz-mapc{height:min(56vh,440px)}
#trk .trk-x{width:100%;margin-top:12px;padding:12px;border:0;border-radius:12px;font:700 15px inherit;background:#2a1d2c;color:#fff;cursor:pointer}
.trkb{display:block;width:100%;margin-top:6px;padding:10px;border:0;border-radius:10px;font:700 14px inherit;background:#6a56c9;color:#fff;cursor:pointer}
.tz-me{background:#1f8a3c;color:#fff;border:2px solid #fff;border-radius:999px;padding:3px 10px;font-size:12.5px;box-shadow:0 2px 8px rgba(0,0,0,.35)}
@media (prefers-color-scheme:dark){#trk .trk-s{background:#14304d;color:#9cc7f0}#trk .trk-s.n{background:#1f8a3c;color:#fff}#trk .trk-s.w{background:#4a1f1b;color:#f3b0a8}}
`;
export function initTrack(o){
 C=o;
 if(!document.getElementById("trk-css")){const s=document.createElement("style");s.id="trk-css";s.textContent=CSS;document.head.appendChild(s)}
 if(!initTrack.on){initTrack.on=true;
  document.addEventListener("click",e=>{const b=e.target.closest("[data-trk]");if(b){openTrack(b.dataset.trk);return}if(e.target.closest("[data-trkx]")||e.target.id==="trk")closeTrack()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&T)closeTrack()});
  // توفير القراءات: الصفحة مش ظاهرة = مفيش سماع
  document.addEventListener("visibilitychange",()=>{if(!T)return;if(document.hidden)unlisten();else listen()});
 }
}
export function stopTrack(){closeTrack();C=null;GEO=null}
// زرار جوه كارت الطلب (بيظهر بس والطلب مع سائق معروف)
export const trackBtn=r=>r&&r.st==="go"&&r.asg&&r.asg.drv?`<button class="trkb" data-trk="${E(r.id)}" type="button">📍 تابع السائق على الخريطة</button>`:"";
function closeTrack(){
 if(!T)return;unlisten();clearInterval(T.tick);try{if(T.map)T.map.remove()}catch(e){}
 const el=document.getElementById("trk");if(el)el.remove();T=null;
}
function unlisten(){if(T&&T.un){T.un();T.un=null}}
function listen(){
 if(!T||T.un||!C)return;const me=T;
 me.un=onSnapshot(doc(C.db,"live",T.drv),d=>{if(T!==me)return;me.lv=d.exists()?d.data():null;me.got=true;me.denied=false;paint()},
  e=>{if(T!==me)return;me.got=true;me.lv=null;me.denied=!!(e&&e.code==="permission-denied");me.un=null;paint()});
}
async function openTrack(id){
 if(!C)return;const r=C.getReq(id);if(!r||r.st!=="go"||!r.asg||!r.asg.drv)return;
 closeTrack();
 const el=document.createElement("div");el.id="trk";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");
 el.innerHTML=`<div class="trk-in"><h3>🚚 ${r.asg.drvn?`السائق <span data-notr>${E(r.asg.drvn)}</span> في الطريق إليك`:"السائق في الطريق إليك"}</h3>
 <div class="trk-s" id="trk-s">⏳ جارٍ تحديد مكان السائق…</div><div class="tz-mapc" id="trk-map"></div>
 <div class="trk-m" id="trk-m"></div><button class="trk-x" data-trkx type="button">إغلاق</button></div>`;
 document.body.appendChild(el);
 const me=T={id,drv:String(r.asg.drv),map:null,L:null,car:null,line:null,un:null,lv:null,got:false,denied:false,rt:null,fit:false,tick:0};
 // كل 20 ثانية: نحدّث "منذ…"، ونقفل لوحدنا لو الطلب اتسلّم
 me.tick=setInterval(()=>{if(T!==me)return;const q=C&&C.getReq(me.id);if(!q||q.st!=="go"){closeTrack();return}paint()},20000);
 listen();
 if(!GEO){try{const g=await getDoc(doc(C.db,"geo","main"));GEO=g.exists()?g.data():{}}catch(e){GEO=null}}
 if(T!==me)return;
 try{const L=await leaflet();if(T!==me)return;me.L=L;me.map=baseMap(L,document.getElementById("trk-map"));setTimeout(()=>{if(T===me&&me.map)me.map.invalidateSize()},80);paint()}
 catch(e){const m=document.getElementById("trk-map");if(m)m.innerHTML='<div style="padding:30px;text-align:center">تعذر تحميل الخريطة. تأكد من الإنترنت.</div>'}
}
const brPt=c=>GEO&&GEO.br&&okPt(GEO.br[c])?{lat:+GEO.br[c].lat,lng:+GEO.br[c].lng}:null;
function paint(){
 const me=T;if(!me||!C)return;const s=document.getElementById("trk-s"),m=document.getElementById("trk-m");if(!s||!m)return;
 const r=C.getReq(me.id)||{},lv=me.lv,mine=brPt(C.code),L=me.L,map=me.map;
 const eta=N(r.eta),etaTxt=eta?`الوقت المتوقع للوصول حوالي ${hm(eta)}`:"";
 if(map&&mine&&!me.meMk){me.meMk=L.marker([mine.lat,mine.lng],{icon:pin(L,`<div class="tz-me">📍 فرعك</div>`),zIndexOffset:500,keyboard:false}).addTo(map);if(!me.fit)map.setView([mine.lat,mine.lng],14)}
 if(!me.got)return;
 if(!lv||!okPt(lv)){
  s.className="trk-s w";s.textContent=me.denied?"📵 موقع السائق غير متاح حالياً":"📵 لم يصل موقع من جوال السائق بعد";
  m.textContent=(etaTxt?etaTxt+". ":"")+"يظهر السائق على الخريطة عندما يعمل تطبيق التتبع على جواله.";return;
 }
 const old=Date.now()-N(lv.ts)>STALE,loc={lat:+lv.lat,lng:+lv.lng,ts:N(lv.ts)};
 // الفروع اللي قبلك بالترتيب (b = ترتيب محطات السائق اللي لسه ماوصلهاش)
 const b=Array.isArray(lv.b)?lv.b.map(String):[],ix=b.indexOf(String(C.code)),before=ix>0?b.slice(0,ix).map(brPt).filter(Boolean):[];
 if(map){
  const html=`<div class="tz-d${old?" old":""}"><b>🚚<i class="tz-hd"></i></b></div>`;
  if(!me.car){me.car=L.marker([loc.lat,loc.lng],{icon:pin(L,html),zIndexOffset:1000,keyboard:false}).addTo(map);me.car._h=html}
  else if(me.car._h!==html){me.car.setIcon(pin(L,html));me.car._h=html}
  const P=me.rt&&me.rt.P;let lt=0;
  driveTo(me.car,loc,P,{old,onMove:(pt,k)=>{const n=performance.now();if((n-lt>400||k>=1)&&me.line&&me.car._P&&me.car._d!=null){lt=n;me.line.setLatLngs(pathFrom(me.car._P,me.car._d))}}});
  if(mine){
   // المسار: نحسبه أول مرة، ولاحقاً بس لو اتحرك 2 كم / عدّى 10 دقايق / خرج عن الطريق (مرة كل دقيقة ونص) / ترتيب الفروع اتغيّر
   const sig=before.map(p=>p.lat.toFixed(4)+","+p.lng.toFixed(4)).join("|")+"#"+ix,o=me.rt,off=!old&&o&&o.P&&me.car._off!=null&&me.car._off>80;
   // علامة صغيرة لكل فرع هيعدّي عليه قبلك
   if(me.bsig!==sig){me.bsig=sig;(me.bm||[]).forEach(x=>map.removeLayer(x));me.bm=before.map((p,i)=>L.marker([p.lat,p.lng],{icon:pin(L,`<div class="tz-b">${i+1}</div>`),keyboard:false,interactive:false}).addTo(map))}
   if(!old&&(!o||(!o.busy&&(o.sig!==sig||Date.now()-o.at>10*6e4||km(o.from,loc)>2||(off&&Date.now()-o.at>9e4))))){
    me.rt={...(o||{}),busy:true,sig,from:loc,at:Date.now()};
    roadRoute([loc,...before,mine],10).then(x=>{if(T!==me)return;const P2=x&&x.path?prepPath(x.path):null;me.rt={r:x||(o&&o.r)||null,P:P2||(o&&o.P)||null,sig,from:loc,at:Date.now(),busy:false};
     if(P2){if(!me.line)me.line=L.polyline(x.path,{color:"#6a56c9",weight:5,opacity:.85}).addTo(map);else me.line.setLatLngs(x.path)}paint()});
   }
   if(!me.fit){me.fit=true;map.fitBounds([[loc.lat,loc.lng],[mine.lat,mine.lng]],{padding:[45,45],maxZoom:16})}
   else{const bb=map.getBounds();if(!bb.contains([loc.lat,loc.lng])||!bb.contains([mine.lat,mine.lng]))map.fitBounds([[loc.lat,loc.lng],[mine.lat,mine.lng]],{padding:[45,45],maxZoom:16})}
  }else if(!me.fit){me.fit=true;map.setView([loc.lat,loc.lng],15)}
 }
 // الحالة: الوقت من TomTom (بالزحام) + 5 دقايق لكل فرع قبلك، وإلا الوقت المتوقع المسجّل على الطلب
 const x=me.rt&&me.rt.r,sec=x&&Number.isFinite(x.sec)?x.sec:0,min=sec?Math.max(1,Math.round(sec/60)+before.length*STOP_MIN):eta?Math.round((eta-Date.now())/6e4):0;
 // على وشك الوصول: أقرب من 400 متر من الفرع ومفيش فروع قبلك، أو السيرفر قال "قرب" وفاضل 3 دقايق بالكتير
 const here=!!mine&&!before.length&&km(loc,mine)<.4,near=N(r.near)>N(r.dep);
 if(old){s.className="trk-s w";s.textContent=`📵 آخر موقع وصل من السائق ${ago(loc.ts)}`}
 else if(here||(near&&min<=3)){s.className="trk-s n";s.textContent="🔔 السائق على وشك الوصول إليك"}
 else if(min>0){s.className="trk-s"+(min<=10?" n":"");s.textContent=`🕒 يصل خلال ~${min>=60?Math.floor(min/60)+" س "+(min%60)+" د":min+" د"}${sec?" (مع الزحام حالياً)":""}`}
 else{s.className="trk-s";s.textContent="🚚 السائق في الطريق إليك"}
 m.innerHTML=`${before.length?`سيمرّ السائق على ${before.length===1?"فرع واحد":before.length===2?"فرعين":before.length+" فروع"} قبلك. `:""}${N(lv.spd)>0&&!old?`السرعة حالياً ${N(lv.spd)} كم/س. `:""}آخر تحديث للموقع: ${ago(loc.ts)} (${hm(loc.ts)}).${mine?"":" (لم يُسجَّل مكان فرعك على الخريطة بعد)"}`;
}
