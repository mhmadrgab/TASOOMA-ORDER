// لوحة المستودع: السيارات والسواقين والرحلات والبنزين
import {makeFb,emailOf,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch,createUserWithEmailAndPassword,signInWithEmailAndPassword,updatePassword,signOut} from "./fb.js";
import {E,N,fmt,today,stmtHtml,printStmt,ensurePrintCss} from "./cust.js";
import {notify,beep,pushOn} from "./notify.js";
import {ledger} from "./ad-extra.js";
import {leaflet,baseMap,pin,okPt,MAP_CSS} from "./map.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const dk=t=>new Date(N(t)).toLocaleDateString("en-CA"),hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dur=ms=>{const m=Math.max(0,Math.round(N(ms)/60000)),h=Math.floor(m/60);return h?`${h}س ${m%60}د`:`${m}د`};
const ago=t=>{const m=Math.round((Date.now()-N(t))/60000);return m<1?"الآن":m<60?`منذ ${m} د`:`منذ ${Math.round(m/60)} س`};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const genPw=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join("")};
let X=null,CARS=[],DRV=[],TR=[],FU=[],PW={},GEOD=null,geoReady=false,un=[],pT=null,pF=null,mode="",fday="",fmon="",ctxEd=null;
let BK=new Set(),bkD="",bkC="";// الطلبات المتعلّم عليها للتعيين الجماعي، والسائق والسيارة المختارين
// رقم الموبايل: 05xxxxxxxx أو 5xxxxxxxx ← 9665xxxxxxxx (لواتساب)
const waNum=p=>{let d=toEn(p).replace(/\D/g,"");if(d.startsWith("00"))d=d.slice(2);if(/^05\d{8}$/.test(d))d="966"+d.slice(1);else if(/^5\d{8}$/.test(d))d="966"+d;return d};
const telBtn=d=>d&&d.phone?`<a class="bt s" href="tel:${E(toEn(d.phone).replace(/[^\d+]/g,""))}">📞 اتصال</a>`:"";
const isImg=s=>typeof s==="string"&&/^data:image\/(png|jpe?g|webp);base64,/.test(s);
const CSS=`
.fm{display:none;position:fixed;inset:0;z-index:76;background:rgba(0,0,0,.55);overflow:auto;padding:18px}.fm.on{display:block}
.fk{max-width:560px;margin:4vh auto;background:var(--card);border-radius:18px;padding:20px 22px}.fk h3{margin:0 0 4px}.fk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}.fk input,.fk select{width:100%}.fk .bt{width:auto}
.al{background:#f8d9d5;color:#8a2218;border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:14.5px}.al.w{background:#f6edd2;color:#6b5314}
.tr{background:var(--card);border-radius:16px;padding:14px 18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-inline-start:6px solid #6a56c9}
.tr h4{margin:0 0 4px;font-size:17px}.tr .st1{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.tr .st1 span{background:var(--soft);border-radius:10px;padding:4px 10px;font-size:14px}.tr .st1 span.ok{background:#d8efd9;color:#1d5a24}
.pill{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:#d8efd9;color:#1d5a24}.pill.off2{background:#f8d9d5;color:#8a2218}.pill.go{background:#e4def7;color:#44348a}
.fl2{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.sub{margin:22px 0 8px;font-size:18px}
@media (prefers-color-scheme:dark){.al{background:#40191a;color:#f1a5a0}.al.w{background:#3a3115;color:#e8cf8a}.pill{background:#173a1b;color:#8fd39a}.pill.go{background:#2a2450;color:#c3b8f5}}
@media print{.fm{display:none!important}}
`;
export const cars=()=>CARS;
// ---------- حسابات ----------
const odoOf=c=>{let m=0;TR.filter(t=>t.car===c).forEach(t=>{m=Math.max(m,N(t.odo0),N(t.odo1))});FU.filter(f=>f.car===c).forEach(f=>{m=Math.max(m,N(f.odo))});return m};
const monthOf=t=>dk(t).slice(0,7);
function econ(c){
 const fl=FU.filter(f=>f.car===c).sort((a,b)=>N(a.odo)-N(b.odo));let last=null,acc=0,km=0,lit=0;
 fl.forEach(f=>{if(last!==null)acc+=N(f.liters);if(f.full){if(last!==null&&N(f.odo)>last){km+=N(f.odo)-last;lit+=acc}last=N(f.odo);acc=0}});
 return lit>0?km/lit:null;
}
function carStat(c){
 const m=dk(Date.now()).slice(0,7),tr=TR.filter(t=>t.car===c.id&&t.st==="done"&&monthOf(t.start)===m);
 const km=tr.reduce((a,t)=>a+Math.max(0,N(t.odo1)-N(t.odo0)),0);
 const fu=FU.filter(f=>f.car===c.id&&String(f.dt).slice(0,7)===m),fl=fu.reduce((a,f)=>a+N(f.liters),0),fc=fu.reduce((a,f)=>a+N(f.cost),0);
 const oth=ledger().filter(e=>e.type==="exp"&&e.car===c.id&&String(e.dt).slice(0,7)===m&&e.cat!=="بنزين").reduce((a,e)=>a+N(e.amt),0);
 return {km,fl,fc,oth,kmpl:econ(c.id),cpk:km>0?(fc+oth)/km:null,odo:odoOf(c.id),trips:tr.length};
}
// الوقت بين كل مكانين حسب "من فين لفين" (WH = المستودع): المستودع←الملقا غير غرناطة←الملقا
const bc=b=>String(b||"").split("-")[0];
function pairs(){const m={};TR.filter(t=>t.st==="done").forEach(t=>{let p=N(t.start),prev="WH";(Array.isArray(t.stops)?t.stops:[]).filter(s=>s&&s.arr).sort((a,b)=>N(a.arr)-N(b.arr)).forEach(s=>{const l=N(s.arr)-p,c=bc(s.brn);if(l>0&&l<12*36e5)(m[prev+">"+c]=m[prev+">"+c]||[]).push(l);p=N(s.arr);prev=c})});
 const o={};Object.entries(m).forEach(([k,v])=>o[k]=Math.max(1,Math.round(v.reduce((a,b)=>a+b,0)/v.length/6e4)));return o}
// المسافة بخط مستقيم × 1.3 (تقريب للطريق الفعلي)
const kmBetween=(a,b)=>{if(!a||!b||!Number.isFinite(+a.lat)||!Number.isFinite(+b.lat))return null;const R=6371,t=x=>x*Math.PI/180,dl=t(b.lat-a.lat),dn=t(b.lng-a.lng),h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))*1.3};
const geoPt=c=>c==="WH"?(GEOD&&GEOD.wh)||null:(GEOD&&GEOD.br&&GEOD.br[c])||null;
// الوقت المتوقع لمشوار: من رحلات قبل كده لنفس المشوار، ولو أول مرة نقدّره من المسافة (35 كم/س + 5 دقايق تسليم)
function legMs(prev,code,pp){if(pp[prev+">"+code])return pp[prev+">"+code]*6e4;const k=kmBetween(geoPt(prev),geoPt(code));if(k!==null)return (k/35*60+5)*6e4;const a=geoPt(code);return a&&a.avg?a.avg*6e4:null}
// المكان اللي السائق أنهى فيه الرحلة: تطبيق السائق بيسجّل loc بنفس وقت الإنهاء (end) بالظبط.
// (لو المستودع اللي قفلها، أو الموبايل مارضيش يدّي الموقع، يبقى مفيش نقطة نهاية ونقف عند آخر فرع)
const endPt=t=>t.st==="done"&&t.loc&&Number.isFinite(+t.loc.lat)&&N(t.loc.ts)===N(t.end)?{lat:+t.loc.lat,lng:+t.loc.lng}:null;
// مكان كل توصيلة: مكان التسليم الفعلي، وإلا موقع الفرع. التحويل: الفرع اللي استلم منه الأول
const stopPts=s=>[s.fr?(Number.isFinite(+s.plat)?{lat:+s.plat,lng:+s.plng}:geoPt(s.fr)):null,Number.isFinite(+s.lat)?{lat:+s.lat,lng:+s.lng}:geoPt(bc(s.brn))];
// الرحلة ليها خريطة؟ (فيه نقطة واحدة على الأقل: بداية / تسليم / مكانه دلوقتي / نهاية)
const hasMap=t=>[t.loc0,t.loc,endPt(t),...(Array.isArray(t.stops)?t.stops:[]).flatMap(stopPts)].some(okPt);
// اسم الفرع من الكود (من الطلبات والرحلات اللي عندنا)
function brNames(){const m={};const add=b=>{const c=bc(b);if(c&&!m[c])m[c]=String(b)};X.R().forEach(r=>add(r.brn));TR.forEach(t=>(Array.isArray(t.stops)?t.stops:[]).forEach(s=>{add(s.brn);if(s.fr&&s.frn)add(s.frn)}));return m}
// ---------- الخريطة اللايف: كل السواقين اللي في رحلة + الفروع + المستودع ----------
// اللوحة كلها بتترسم من الأول مع كل تحديث، فالخريطة عنصر ثابت بننقله في مكانه (flmap-slot) بعد كل رسم،
// والعلامات بتتحدّث في مكانها (من غير ما تتمسح) علشان لو فيه نافذة مفتوحة على سواق ماتتقفلش.
const LM={host:null,map:null,L:null,mk:new Map(),fitKey:"",loading:false};
function attachLive(){
 const slot=g("flmap-slot");if(!slot)return;
 if(!LM.host){LM.host=document.createElement("div");LM.host.className="tz-map";LM.host.innerHTML=`<div class="tz-mapc"></div><div class="tz-bar"><button class="bt s" data-fl="mfit" type="button">⤢ وريني الكل</button><span>🚚 سواق في رحلة</span><span>🏭 المستودع</span><span><b style="background:#d4ae5c;border-radius:8px;padding:0 6px;color:#1b1b1b">كود</b> الفرع اللي رايحله</span><span>المكان بيتحدّث لوحده</span></div>`}
 if(LM.host.parentNode!==slot)slot.appendChild(LM.host);
 if(LM.map){LM.map.invalidateSize();paintLive();return}
 if(LM.loading)return;LM.loading=true;
 leaflet().then(L=>{LM.loading=false;if(LM.map||!X)return;LM.L=L;LM.map=baseMap(L,LM.host.querySelector(".tz-mapc"));paintLive()})
  .catch(()=>{LM.loading=false;const c=LM.host&&LM.host.querySelector(".tz-mapc");if(c)c.innerHTML='<div class="off" style="padding:30px;text-align:center">تعذر تحميل الخريطة. اتأكد من النت وحدّث الصفحة.</div>'});
}
// علامة واحدة: لو موجودة نحرّكها ونحدّث شكلها، ولو جديدة نعملها
function mark(key,pt,html,pop,tip,z){
 const L=LM.L;let m=LM.mk.get(key);
 if(!m){m=L.marker([+pt.lat,+pt.lng],{icon:pin(L,html),zIndexOffset:z||0,keyboard:false});m._h=html;if(pop)m.bindPopup(pop);if(tip)m.bindTooltip(tip,{direction:"top"});m.addTo(LM.map);LM.mk.set(key,m)}
 else{m.setLatLng([+pt.lat,+pt.lng]);if(m._h!==html){m.setIcon(pin(L,html));m._h=html}if(pop){if(m.getPopup())m.setPopupContent(pop);else m.bindPopup(pop)}}
 m._seen=1;return m;
}
function line(key,pts,opt){
 const L=LM.L;let l=LM.mk.get(key);const ll=pts.map(p=>[+p.lat,+p.lng]);
 if(!l){l=L.polyline(ll,opt).addTo(LM.map);LM.mk.set(key,l)}else l.setLatLngs(ll);
 l._seen=1;return l;
}
function paintLive(){
 if(!LM.map||!X)return;
 LM.mk.forEach(m=>{m._seen=0});
 const nm=brNames(),wh=geoPt("WH"),act=TR.filter(t=>t.st==="active"),br=(GEOD&&GEOD.br)||{},nxt=new Set(),fit=[];
 if(okPt(wh)){mark("wh",wh,`<div class="tz-w">🏭</div>`,"<b>🏭 المستودع</b>",null,500);fit.push(wh)}
 const cols=["#6a56c9","#c4362b","#1c4f86","#2f8f3e","#a8832f","#b0478f"];
 act.forEach((t,i)=>{
  const st=Array.isArray(t.stops)?t.stops:[],done=st.filter(s=>s.arr).length,rem=st.filter(s=>!s.arr);
  const rq=s=>X.R().find(r=>r.id===s.rid),eta=s=>{const r=rq(s);return N(r&&r.eta)||N(s.eta)};
  rem.forEach(s=>{nxt.add(bc(s.brn));if(s.fr&&!s.pk)nxt.add(String(s.fr))});
  if(!okPt(t.loc))return;
  const old=Date.now()-N(t.loc.ts)>10*6e4,nx=rem[0];
  const pop=`<b>🚚 ${E(t.drvn)}</b><br>${E(t.carn)}<br>سلّم ${done} من ${st.length}${nx?`<br>رايح لـ <b><bdi dir="ltr">${E(nx.fr&&!nx.pk?(nx.frn||nx.fr)+" (استلام)":nx.brn)}</bdi></b>${eta(nx)?` · متوقع ~${hm(eta(nx))}`:""}`:"<br>خلّص التوصيلات"}<br><span style="color:#6f6b64">آخر مكان: ${ago(t.loc.ts)} (${hm(t.loc.ts)})${t.loc.src==="bg"?" · من التطبيق":""}</span>`;
  mark("d_"+t.id,t.loc,`<div class="tz-d${old?" old":""}"><b>🚚</b><span>${E(t.drvn)}</span></div>`,pop,null,1000);fit.push(t.loc);
  // الطريق اللي فاضل: من مكانه دلوقتي على الفروع اللي لسه ماسلّمهاش بالترتيب (خطوط مستقيمة)
  const path=[t.loc,...rem.flatMap(s=>[s.fr&&!s.pk?geoPt(String(s.fr)):null,geoPt(bc(s.brn))])].filter(okPt);
  if(path.length>1){line("p_"+t.id,path,{color:cols[i%cols.length],weight:4,opacity:.75,dashArray:"8 8"});path.slice(1,2).forEach(p=>fit.push(p))}
 });
 Object.entries(br).forEach(([c,p])=>{if(!okPt(p))return;const n=nm[c]||c,on=nxt.has(c);mark("b_"+c,p,`<div class="tz-b${on?" nx":""}">${E(c)}</div>`,`<b><bdi dir="ltr">${E(n)}</bdi></b>${on?"<br>🚚 سواق رايحله دلوقتي":""}`,null,on?800:0);if(!act.length)fit.push(p)});
 // نشيل اللي مابقاش موجود (رحلة خلصت مثلاً)
 [...LM.mk.entries()].forEach(([k,m])=>{if(!m._seen){LM.map.removeLayer(m);LM.mk.delete(k)}});
 // نظبط الزوم: أول مرة، ولما رحلة تبدأ أو تخلص (مش مع كل تحديث، علشان مانبوّظش الزوم اللي انت عامله)
 const key=act.map(t=>t.id).sort().join(",")+"|"+(fit.length?1:0);
 if(key!==LM.fitKey){LM.fitKey=key;fitLive(fit)}
}
function fitLive(pts){
 if(!LM.map)return;pts=pts||[...LM.mk.values()].filter(m=>m.getLatLng).map(m=>m.getLatLng());
 const ll=pts.map(p=>[+(p.lat),+(p.lng)]);if(!ll.length)return;
 if(ll.length===1)LM.map.setView(ll[0],14);else LM.map.fitBounds(ll,{padding:[40,40],maxZoom:15});
}
function dropLive(){try{if(LM.map)LM.map.remove()}catch(e){}LM.host=null;LM.map=null;LM.mk=new Map();LM.fitKey="";LM.loading=false}
// ---------- خريطة في نافذة: مسار رحلة، أو نقطة واحدة ----------
let MM=null;
const dropM=()=>{try{if(MM)MM.remove()}catch(e){}MM=null};
function mapModal(title,sub,back,build){
 openM(`<h3>${title}</h3>${sub?`<div class="off" style="margin-bottom:8px">${sub}</div>`:""}<div class="tz-mapc" id="tzm" style="height:min(62vh,520px)"></div>
 <div class="off" style="font-size:12.5px;margin-top:6px">الخطوط بتوصل الأماكن بالترتيب (مستقيمة، مش الطريق بالظبط).</div>
 <div class="fl2" style="margin-top:12px">${back?`<button class="bt" data-fl="trd" data-id="${E(back)}" type="button">↩ التفاصيل</button>`:""}<button class="bt" data-fl="cancel" type="button">إغلاق</button></div>`);
 const el=g("tzm");
 leaflet().then(L=>{if(!el.isConnected)return;MM=baseMap(L,el);const pts=build(L,MM)||[];
  const ll=pts.filter(okPt).map(p=>[+p.lat,+p.lng]);if(ll.length===1)MM.setView(ll[0],15);else if(ll.length)MM.fitBounds(ll,{padding:[36,36],maxZoom:16});
  setTimeout(()=>{if(MM)MM.invalidateSize()},60)})
  .catch(()=>{el.innerHTML='<div class="off" style="padding:30px;text-align:center">تعذر تحميل الخريطة. اتأكد من النت.</div>'});
}
function tripMapM(id){
 const t=TR.find(x=>x.id===id);if(!t)return;
 mapModal(`🗺 رحلة ${E(t.drvn)} — ${E(t.carn)}`,`${dk(t.start)} · ${hm(t.start)} ← ${t.end?hm(t.end):"شغّالة"}`,t.id,(L,M)=>{
  const st=(Array.isArray(t.stops)?t.stops:[]),pts=[],route=[],add=(p,html,pop,z)=>{if(!okPt(p))return;L.marker([+p.lat,+p.lng],{icon:pin(L,html),zIndexOffset:z||0}).bindPopup(pop).addTo(M);pts.push(p)};
  const s0=okPt(t.loc0)?t.loc0:geoPt("WH");
  add(s0,`<div class="tz-s st"><b>🚩</b><span>البداية ${hm(t.start)}</span></div>`,`<b>🚩 بداية الرحلة</b><br>${hm(t.start)}${okPt(t.loc0)?"":"<br>(مكان المستودع)"}`,600);if(okPt(s0))route.push(s0);
  // التوصيلات اللي اتسلّمت بترتيب التسليم، وبعدين اللي لسه
  const dn=st.filter(s=>s.arr).sort((a,b)=>N(a.arr)-N(b.arr)),wt=st.filter(s=>!s.arr);let n=0;
  dn.forEach(s=>{const [pk,dl]=stopPts(s);
   if(s.fr&&okPt(pk)){add(pk,`<div class="tz-s pk"><b>📦</b></div>`,`<b>📦 استلام التحويل</b><br><bdi dir="ltr">${E(s.frn||s.fr)}</bdi>${s.pk?"<br>"+hm(s.pk):""}`,300);route.push(pk)}
   n++;add(dl,`<div class="tz-s"><b>${n}</b><span>${hm(s.arr)}</span></div>`,`<b>✔ ${n}. <bdi dir="ltr">${E(s.brn)}</bdi></b><br>اتسلّم ${hm(s.arr)}${s.rcvr?"<br>استلم: "+E(s.rcvr):""}${Number.isFinite(+s.lat)?"":"<br>(مكان الفرع، الموبايل ماسجّلش مكان التسليم)"}`,400);if(okPt(dl))route.push(dl)});
  const e=endPt(t);
  if(t.st==="active"&&okPt(t.loc)){add(t.loc,`<div class="tz-d"><b>🚚</b><span>دلوقتي</span></div>`,`<b>🚚 ${E(t.drvn)} دلوقتي</b><br>آخر مكان: ${ago(t.loc.ts)} (${hm(t.loc.ts)})`,1000);route.push(t.loc)}
  if(route.length>1)L.polyline(route.map(p=>[+p.lat,+p.lng]),{color:"#6a56c9",weight:4,opacity:.8}).addTo(M);
  // اللي لسه ما اتسلّمش: خط متقطّع من آخر نقطة
  const rest=[];wt.forEach(s=>{const [pk,dl]=[s.fr&&!s.pk?geoPt(String(s.fr)):null,geoPt(bc(s.brn))];
   if(okPt(pk)){add(pk,`<div class="tz-s wait"><b>📦</b></div>`,`<b>📦 لسه هيستلم من</b> <bdi dir="ltr">${E(s.frn||s.fr)}</bdi>`,200);rest.push(pk)}
   add(dl,`<div class="tz-s wait"><b>⏳</b><span><bdi dir="ltr">${E(bc(s.brn))}</bdi></span></div>`,`<b>⏳ <bdi dir="ltr">${E(s.brn)}</bdi></b><br>${t.st==="active"?"لسه ما وصلش":"ما اتسلّمش في الرحلة دي"}`,200);if(okPt(dl))rest.push(dl)});
  if(rest.length&&route.length&&t.st==="active")L.polyline([route[route.length-1],...rest].map(p=>[+p.lat,+p.lng]),{color:"#6a56c9",weight:3,opacity:.6,dashArray:"8 8"}).addTo(M);
  if(t.st==="done"&&okPt(e)){add(e,`<div class="tz-s end"><b>🏁</b><span>${hm(t.end)}</span></div>`,`<b>🏁 إنهاء الرحلة</b><br>${hm(t.end)}`,700);if(route.length)L.polyline([route[route.length-1],e].map(p=>[+p.lat,+p.lng]),{color:"#c4362b",weight:3,opacity:.7,dashArray:"4 6"}).addTo(M)}
  if(!pts.length){const el=g("tzm");if(el)el.insertAdjacentHTML("beforeend",'<div class="off" style="position:absolute;inset:auto 0 10px;text-align:center;z-index:999">مفيش أماكن مسجّلة للرحلة دي</div>')}
  return pts;
 });
}
function pointM(lat,lng,title,sub,back){
 const p={lat:+lat,lng:+lng};if(!okPt(p))return;
 mapModal(`📍 ${E(title)}`,sub?E(sub):"",back,(L,M)=>{L.marker([p.lat,p.lng],{icon:pin(L,`<div class="tz-s"><b>📍</b></div>`)}).bindPopup(`<b>${E(title)}</b>${sub?"<br>"+E(sub):""}`).addTo(M);return [p]});
}
function legs(){const m={};TR.filter(t=>t.st==="done").forEach(t=>{let p=N(t.start);(Array.isArray(t.stops)?t.stops:[]).filter(s=>s&&s.arr).sort((a,b)=>N(a.arr)-N(b.arr)).forEach(s=>{const l=N(s.arr)-p;p=N(s.arr);if(l>0&&l<864e5)(m[s.brn]=m[s.brn]||[]).push(l)})});const o={};Object.entries(m).forEach(([k,v])=>o[k]=v.reduce((a,b)=>a+b,0)/v.length);return o}
function alerts(){
 const A=[],now=Date.now();
 CARS.forEach(c=>{
  const odo=odoOf(c.id),due=N(c.oilLast)+N(c.oilEvery||5000);
  if(c.oilEvery&&N(c.oilLast)>=0&&odo>0){const rem=due-odo;if(rem<=0)A.push({l:"al",t:`🛢 ${E(c.name)}: تغيير الزيت متأخر ${fmt(-rem)} كم`});else if(rem<=500)A.push({l:"al w",t:`🛢 ${E(c.name)}: باقي ${fmt(rem)} كم على تغيير الزيت`})}
  [["insExp","التأمين"],["licExp","رخصة السيارة"]].forEach(([f,n])=>{if(c[f]){const d=Math.ceil((new Date(c[f]).getTime()-now)/864e5);if(d<0)A.push({l:"al",t:`📄 ${E(c.name)}: ${n} منتهي من ${-d} يوم`});else if(d<=30)A.push({l:"al w",t:`📄 ${E(c.name)}: ${n} ينتهي بعد ${d} يوم`})}});
 });
 TR.filter(t=>t.st==="active").forEach(t=>{if(now-N(t.start)>10*36e5)A.push({l:"al",t:`⏱ رحلة ${E(t.drvn)} مفتوحة من ${dur(now-N(t.start))}`})});
 const byC={};TR.filter(t=>t.st==="done").sort((a,b)=>N(a.start)-N(b.start)).forEach(t=>{const p=byC[t.car];if(p!==undefined&&N(t.odo0)<p-1)A.push({l:"al w",t:`🔢 ${E(t.drvn)}: عداد بداية رحلة (${fmt(t.odo0)}) أقل من آخر قراءة (${fmt(p)}) — راجع`});byC[t.car]=Math.max(byC[t.car]||0,N(t.odo1))});
 return A.slice(-12);
}
// ---------- الواجهة ----------
export function view(){
 const R=X.R(),A=alerts(),act=TR.filter(t=>t.st==="active"),lg=legs(),pp=pairs();
 const openR=R.filter(r=>(r.st==="new"||r.st==="prep")).sort((a,b)=>N(a.ts)-N(b.ts));
 const days=[...new Set(TR.map(t=>dk(t.start)))].sort().reverse();if(!fday||!days.includes(fday))fday=days[0]||today();
 const dTr=TR.filter(t=>dk(t.start)===fday).sort((a,b)=>N(a.start)-N(b.start));
 const dOpt=(a,sel)=>a.map(([v,l])=>`<option value="${E(v)}" ${v===sel?"selected":""}>${E(l)}</option>`).join("");
 const dr=DRV.filter(d=>d.enabled);
 BK=new Set([...BK].filter(id=>openR.some(r=>r.id===id)));
 return `${A.length?A.map(a=>`<div class="${a.l}">${a.t}</div>`).join(""):""}
 <h3 class="sub" style="margin-top:4px">🚚 على الطريق دلوقتي</h3>
 ${act.length||okPt(geoPt("WH"))||Object.keys((GEOD&&GEOD.br)||{}).length?(setTimeout(attachLive,0),'<div id="flmap-slot"></div>'):""}
 ${act.length?act.map(t=>{const st=Array.isArray(t.stops)?t.stops:[];let p=N(t.start);const done=st.filter(s=>s.arr).length;
  return `<div class="tr"><h4>${E(t.drvn)} — ${E(t.carn)} <span class="pill go">في رحلة</span></h4><div class="off" style="font-size:14px">بدأ ${hm(t.start)} · بقاله ${dur(Date.now()-N(t.start))} · سلّم ${done} من ${st.length}${okPt(t.loc)?` · <a href="#" data-fl="tmap" data-id="${E(t.id)}">📍 مكانه (${ago(t.loc.ts)})</a>`:" · <span>لسه مفيش موقع مسجّل</span>"}</div>
  <div class="st1">${(()=>{let prev="WH";return st.map(s=>{const c=bc(s.brn);if(s.arr){const l=N(s.arr)-p;p=N(s.arr);prev=c;return `<span class="ok">✔ ${E(s.brn)} ${hm(s.arr)} (${dur(l)})</span>`}
   // الوقت المتوقع الأحدث: اللي على الطلب (تطبيق السائق بيحدّثه وهو ماشي)، وإلا اللي على الرحلة
   const rq=X.R().find(r=>r.id===s.rid),eta=N(rq&&rq.eta)||N(s.eta);
   const a=legMs(prev,c,pp);if(a&&!eta)p+=a;prev=c;return `<span>⏳ ${E(s.brn)}${eta?` · متوقع ~${hm(eta)}`:a?` · متوقع ~${hm(p)}`:""}${rq&&N(rq.near)>N(rq.dep)?" · 🔔 قرب":""}</span>`}).join("")})()}</div>
  <div class="fl2" style="margin:0">${telBtn(DRV.find(d=>d.id===t.drv))}<button class="bt s" data-fl="trd" data-id="${E(t.id)}" type="button">تفاصيل</button>${hasMap(t)?`<button class="bt s" data-fl="tmap" data-id="${E(t.id)}" type="button">🗺 خريطة</button>`:""}<button class="bt s r" data-fl="tend" data-id="${E(t.id)}" type="button">⏹ إنهاء الرحلة من المستودع</button></div></div>`}).join(""):'<div class="pan off">مفيش سيارة على الطريق دلوقتي.</div>'}
 <h3 class="sub">📦 تعيين التوصيلات</h3><div class="pan">${openR.length>1?`<div class="fl2 bk"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="bkall" style="width:auto" ${openR.every(r=>BK.has(r.id))?"checked":""}> الكل</label><span class="off">متعلّم <b id="bkn">${BK.size}</b></span><select id="bkd"><option value="">السائق</option>${dOpt(dr.map(d=>[d.id,d.name]),bkD)}</select><select id="bkc"><option value="">السيارة</option>${dOpt(CARS.filter(c=>c.active!==false).map(c=>[c.id,c.name+(c.plate?" "+c.plate:"")]),bkC)}</select><button class="bt s g" data-fl="bulk" type="button">تعيين المتعلّم عليهم</button></div>`:""}<div class="tw"><table><thead><tr>${openR.length>1?"<th></th>":""}<th>الفرع</th><th>الطلب</th><th>قطع</th><th>المعيّن</th><th>سائق</th><th>سيارة</th><th></th></tr></thead><tbody>${openR.length?openR.map(r=>`<tr>${openR.length>1?`<td><input type="checkbox" data-bk="${E(r.id)}" style="width:20px;height:20px" ${BK.has(r.id)?"checked":""}></td>`:""}<td class="l">${r.tr?`🔄 استلم من <bdi dir="ltr">${E(r.tr.frn)}</bdi>${N(r.rdy)?" ✅":" ⏳"}<br>← سلّم لـ `:""}${E(r.brn)}</td><td><bdi dir="ltr">${E(r.no)}</bdi></td><td>${N(r.pcs)}</td><td>${r.asg&&r.asg.drvn?`<span class="pill go">${E(r.asg.drvn)} · ${E(r.asg.carn||"")}</span>`:'<span class="off">—</span>'}</td><td><select data-asd="${E(r.id)}"><option value="">اختر</option>${dOpt(dr.map(d=>[d.id,d.name]),r.asg&&r.asg.drv)}</select></td><td><select data-asc="${E(r.id)}"><option value="">اختر</option>${dOpt(CARS.filter(c=>c.active!==false).map(c=>[c.id,c.name+(c.plate?" "+c.plate:"")]),r.asg&&r.asg.car)}</select></td><td style="white-space:nowrap"><button class="bt s g" data-fl="asg" data-id="${E(r.id)}" type="button">تعيين</button>${r.asg&&r.asg.drv?` <button class="bt s" data-fl="unasg" data-id="${E(r.id)}" type="button">إلغاء</button>`:""}</td></tr>`).join(""):'<tr><td colspan="7" class="off" style="text-align:center;padding:20px">مفيش طلبات مفتوحة</td></tr>'}</tbody></table></div><p class="off" style="font-size:13px;margin:8px 0 0">بعد التعيين الطلب بيظهر عند السائق في تطبيقه، والفرع بيشوف "في الطريق" لما السائق يبدأ الرحلة.</p></div>
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">🚗 السيارات</h3>${X.admin?'<button class="bt s g" data-fl="car" type="button" style="margin-inline-start:auto">➕ إضافة سيارة</button>':""}<button class="bt s" data-fl="fuel" type="button" ${X.admin?"":'style="margin-inline-start:auto"'}>⛽ تسجيل بنزين</button></div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السيارة</th><th>العداد</th><th>كم الشهر</th><th>بنزين الشهر</th><th>كم/لتر</th><th>تكلفة/كم</th><th>الزيت</th><th>التأمين / الرخصة</th><th></th></tr></thead><tbody>${CARS.length?CARS.map(c=>{const s=carStat(c),due=N(c.oilLast)+N(c.oilEvery||5000);return `<tr><td class="l" style="direction:rtl">${E(c.name)}<small class="off" style="display:block;direction:ltr">${E(c.plate||"")}</small></td><td>${s.odo?fmt(s.odo):"—"}</td><td>${fmt(s.km)}</td><td>${fmt(s.fl)} لتر<small class="off" style="display:block">${fmt(s.fc)}</small></td><td>${s.kmpl?s.kmpl.toFixed(1):"—"}</td><td>${s.cpk!==null?s.cpk.toFixed(2):"—"}</td><td>${c.oilEvery&&s.odo?(due-s.odo<=0?`<span style="color:#c4362b;font-weight:700">متأخر</span>`:`باقي ${fmt(due-s.odo)} كم`):"—"}</td><td style="font-size:13px">${E(c.insExp||"—")}<br>${E(c.licExp||"—")}</td><td>${X.admin?`<button class="bt s" data-fl="car" data-id="${E(c.id)}" type="button">تعديل</button>`:""}</td></tr>`}).join(""):'<tr><td colspan="9" class="off" style="text-align:center;padding:20px">أضف السيارتين من زرار "إضافة سيارة"</td></tr>'}</tbody></table></div></div>
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">👷 السواقين</h3>${X.admin?'<button class="bt s g" data-fl="drv" type="button" style="margin-inline-start:auto">➕ إضافة سائق</button>':""}</div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السائق</th><th>اسم الدخول</th><th>الحالة</th><th>رحلات الشهر</th><th>كم الشهر</th><th>كلمة السر</th><th></th></tr></thead><tbody>${DRV.length?DRV.map(d=>{const m=dk(Date.now()).slice(0,7),t=TR.filter(x=>x.drv===d.id&&x.st==="done"&&monthOf(x.start)===m);return `<tr><td><b>${E(d.name)}</b>${d.phone?`<small class="off" style="display:block;direction:ltr;text-align:right">${E(d.phone)}</small>`:""}</td><td class="l">${E(d.id)}</td><td><span class="pill ${d.enabled?"":"off2"}">${d.enabled?"مفعّل":"معطّل"}</span></td><td>${t.length}</td><td>${fmt(t.reduce((a,x)=>a+Math.max(0,N(x.odo1)-N(x.odo0)),0))}</td><td>${PW[d.id]?`<span class="pin" data-fpw="${E(d.id)}">••••••••</span> <button class="bt s" data-fl="spw" data-id="${E(d.id)}" type="button">إظهار</button>`:'<span class="off">—</span>'}</td><td style="white-space:nowrap">${telBtn(d)} ${X.admin?`<button class="bt s ${d.gps?"g":""}" data-fl="gps" data-id="${E(d.id)}" type="button" title="تتبع السائق في الخلفية">📡 التتبع${d.gps?" ✓":""}</button> <button class="bt s" data-fl="dwa" data-id="${E(d.id)}" type="button">📲 واتساب</button> <button class="bt s" data-fl="dedit" data-id="${E(d.id)}" type="button">تعديل</button> <button class="bt s" data-fl="dtg" data-id="${E(d.id)}" type="button">${d.enabled?"تعطيل":"تفعيل"}</button> <button class="bt s" data-fl="dpw" data-id="${E(d.id)}" type="button">كلمة سر جديدة</button> <button class="bt s" data-fl="dcp" data-id="${E(d.id)}" type="button">نسخ رسالة</button>`:""}</td></tr>`}).join(""):'<tr><td colspan="7" class="off" style="text-align:center;padding:20px">لسه مفيش سواقين</td></tr>'}</tbody></table></div></div>
${evalView()}
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">🗓 سجل الرحلات</h3><select id="fday" style="margin-inline-start:auto">${days.length?days.map(d=>`<option ${d===fday?"selected":""}>${d}</option>`).join(""):`<option>${today()}</option>`}</select><button class="bt s" data-fl="rep" type="button">🖨 تقرير اليوم</button></div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السائق / السيارة</th><th>من ← إلى</th><th>المدة</th><th>كم</th><th>التسليمات</th><th></th></tr></thead><tbody>${dTr.length?dTr.map(t=>{const st=Array.isArray(t.stops)?t.stops:[];return `<tr><td><b>${E(t.drvn)}</b><small class="off" style="display:block">${E(t.carn)}</small></td><td>${hm(t.start)} ← ${t.end?hm(t.end):'<span class="pill go">شغّال</span>'}</td><td>${t.end?dur(N(t.end)-N(t.start)):dur(Date.now()-N(t.start))}</td><td>${t.st==="done"?fmt(Math.max(0,N(t.odo1)-N(t.odo0))):"—"}</td><td>${st.filter(s=>s.arr).length}/${st.length} · ${st.reduce((a,s)=>a+N(s.pcs),0)} قطعة</td><td style="white-space:nowrap"><button class="bt s" data-fl="trd" data-id="${E(t.id)}" type="button">تفاصيل</button> ${X.admin?`<button class="bt s" data-fl="trx" data-id="${E(t.id)}" type="button">حذف</button>`:""}</td></tr>`}).join(""):'<tr><td colspan="6" class="off" style="text-align:center;padding:20px">مفيش رحلات في اليوم ده</td></tr>'}</tbody></table></div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">⏱ متوسط زمن الوصول لكل فرع</h3>${Object.keys(lg).length?Object.entries(lg).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar"><span>${E(k)}</span><i style="width:${Math.max(4,v/Math.max(...Object.values(lg))*50)}%"></i><em>${dur(v)}</em></div>`).join(""):'<div class="off">بيتحسب من الرحلات اللي بتخلص</div>'}</div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 8px">⛽ آخر تعبئات البنزين</h3><div class="tw"><table><thead><tr><th>التاريخ</th><th>السيارة</th><th>السائق</th><th>لترات</th><th>المبلغ</th><th>العداد</th><th>فُل؟</th><th></th></tr></thead><tbody>${FU.slice().sort((a,b)=>N(b.ts)-N(a.ts)).slice(0,15).map(f=>`<tr><td>${E(f.dt)}</td><td>${E(f.carn||"")}</td><td>${E(f.drvn||"")}</td><td>${fmt(f.liters)}</td><td>${fmt(f.cost)}</td><td>${fmt(f.odo)}</td><td>${f.full?"✔":""}</td><td>${X.admin?`<button class="bt s" data-fl="fx" data-id="${E(f.id)}" type="button">حذف</button>`:""}</td></tr>`).join("")||'<tr><td colspan="8" class="off" style="text-align:center;padding:20px">لا يوجد</td></tr>'}</tbody></table></div></div>`;
}
// ---------- تقييم السواقين الشهري ----------
const months=()=>{const m=new Set([dk(Date.now()).slice(0,7)]);TR.forEach(t=>m.add(monthOf(t.start)));return [...m].sort().reverse()};
function drvStats(mo){
 return DRV.map(d=>{
  const tr=TR.filter(t=>t.drv===d.id&&t.st==="done"&&monthOf(t.start)===mo),st=tr.flatMap(t=>Array.isArray(t.stops)?t.stops:[]);
  const del=st.filter(x=>x.arr),km=tr.reduce((a,t)=>a+Math.max(0,N(t.odo1)-N(t.odo0)),0),min=tr.reduce((a,t)=>a+(N(t.end)-N(t.start))/6e4,0);
  const lit=FU.filter(f=>f.drv===d.id&&String(f.dt).slice(0,7)===mo).reduce((a,f)=>a+N(f.liters),0);
  return {d,trips:tr.length,del:del.length,miss:st.length-del.length,km,avg:del.length?min/del.length:null,lit,kpl:lit>0&&km>0?km/lit:null,pod:del.length?del.filter(x=>x.rcvr).length/del.length:null};
 });
}
function evalView(){
 const mo=fmon&&months().includes(fmon)?fmon:months()[0],rows=drvStats(mo).sort((a,b)=>b.del-a.del);
 return `<div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">📊 تقييم السواقين</h3><select id="fmon" style="margin-inline-start:auto">${months().map(m=>`<option ${m===mo?"selected":""}>${m}</option>`).join("")}</select><button class="bt s" data-fl="mrep" type="button">🖨 تقرير شهري</button></div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السائق</th><th>رحلات</th><th>توصيلات</th><th>لم تُسلَّم</th><th>كم</th><th>متوسط الدقايق/توصيلة</th><th>بنزين (لتر)</th><th>كم/لتر</th><th>إثبات تسليم</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><b>${E(r.d.name)}</b></td><td>${r.trips}</td><td>${r.del}</td><td>${r.miss?`<span style="color:#c4362b;font-weight:700">${r.miss}</span>`:0}</td><td>${fmt(r.km)}</td><td>${r.avg!==null?Math.round(r.avg):"—"}</td><td>${fmt(r.lit)}</td><td>${r.kpl?r.kpl.toFixed(1):"—"}</td><td>${r.pod!==null?Math.round(r.pod*100)+"%":"—"}</td></tr>`).join(""):'<tr><td colspan="9" class="off" style="text-align:center;padding:20px">أضف سواقين وابدأوا رحلات</td></tr>'}</tbody></table></div><p class="off" style="font-size:13px;margin:8px 0 0">كم/لتر هنا تقريبي (الكيلومترات ÷ البنزين اللي السائق سجّله). المتوسط = وقت الرحلة ÷ عدد التوصيلات.</p></div>`;
}
function monthReport(){
 const mo=fmon&&months().includes(fmon)?fmon:months()[0],ds=drvStats(mo).sort((a,b)=>b.del-a.del);
 const cr=CARS.map(c=>{const s=carStat(c);return `<tr><td>${E(c.name)} ${E(c.plate||"")}</td><td class="n">${fmt(s.km)}</td><td class="n">${fmt(s.fl)}</td><td class="n">${fmt(s.fc)}</td><td class="n">${fmt(s.oth)}</td><td class="n">${s.kmpl?s.kmpl.toFixed(1):"—"}</td><td class="n">${s.cpk!==null?s.cpk.toFixed(2):"—"}</td></tr>`}).join("");
 printStmt(`<div class="st"><div class="ph"><h2>تقرير شهري — السيارات والسواقين</h2><div>${E(mo)}</div></div>
 <h3 style="margin:0 0 6px">السواقين</h3><table class="stt"><thead><tr><th>السائق</th><th>رحلات</th><th>توصيلات</th><th>لم تُسلَّم</th><th>كم</th><th>دقيقة/توصيلة</th><th>لتر</th></tr></thead><tbody>${ds.map(r=>`<tr><td>${E(r.d.name)}</td><td class="n">${r.trips}</td><td class="n">${r.del}</td><td class="n">${r.miss}</td><td class="n">${fmt(r.km)}</td><td class="n">${r.avg!==null?Math.round(r.avg):"—"}</td><td class="n">${fmt(r.lit)}</td></tr>`).join("")||'<tr><td colspan="7" style="text-align:center">—</td></tr>'}</tbody></table>
 <h3 style="margin:14px 0 6px">السيارات (الشهر الحالي)</h3><table class="stt"><thead><tr><th>السيارة</th><th>كم</th><th>لتر</th><th>تكلفة بنزين</th><th>مصاريف أخرى</th><th>كم/لتر</th><th>تكلفة/كم</th></tr></thead><tbody>${cr||'<tr><td colspan="7" style="text-align:center">—</td></tr>'}</tbody></table>
 <div class="sg"><span>مسؤول المستودع</span><span>المحاسب</span><span>المدير</span></div></div>`);
}
// ---------- مواقع الفروع ومتوسط الوصول (المستودع يحسبها، والسائق يقرأها) ----------
// مهم: Firebase بيرجّع المفاتيح مترتبة أبجدياً، فالمقارنة لازم ماتتأثرش بترتيب المفاتيح.
// المقارنة القديمة (JSON.stringify) كانت بتشوف فرق كل مرة، فتكتب، فيوصل تحديث، فتكتب تاني... لحد ما الحصة اليومية خلصت.
const canon=v=>v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}":JSON.stringify(v);
let geoAt=0,geoBusy=false;
function syncGeo(){
 // حماية إضافية: كتابة واحدة بالكتير كل 10 دقايق من الجهاز ده (والقواعد بتمنع أكتر من كده من أي جهاز)
 if(X.view||!geoReady||!TR.length||geoBusy||Date.now()-geoAt<10*6e4)return;// المتابع مابيكتبش
 const acc={},lg=legs(),lgc={},wh={la:0,ln:0,n:0};
 TR.filter(t=>t.st==="done").forEach(t=>{
  (Array.isArray(t.stops)?t.stops:[]).forEach(x=>{if(x&&x.arr&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lng)){const c=String(x.brn||"").split("-")[0],a=acc[c]||(acc[c]={la:0,ln:0,n:0});a.la+=+x.lat;a.ln+=+x.lng;a.n++}});
  if(t.loc0&&Number.isFinite(+t.loc0.lat)){wh.la+=+t.loc0.lat;wh.ln+=+t.loc0.lng;wh.n++}
 });
 Object.entries(lg).forEach(([b,v])=>{const c=b.split("-")[0];(lgc[c]=lgc[c]||[]).push(v)});
 const br={};Object.entries(acc).forEach(([c,a])=>{const o={lat:+(a.la/a.n).toFixed(5),lng:+(a.ln/a.n).toFixed(5),n:a.n};if(lgc[c])o.avg=Math.max(1,Math.round(lgc[c].reduce((x,y)=>x+y,0)/lgc[c].length/6e4));br[c]=o});
 const nw={br};if(wh.n)nw.wh={lat:+(wh.la/wh.n).toFixed(5),lng:+(wh.ln/wh.n).toFixed(5)};
 const pp=pairs();if(Object.keys(pp).length)nw.pairs=pp;// أوقات "من فين لفين" علشان تطبيق السائق يحسب الوقت المتوقع صح
 const cur=GEOD?{br:GEOD.br||{},...(GEOD.wh?{wh:GEOD.wh}:{}),...(GEOD.pairs?{pairs:GEOD.pairs}:{})}:null;
 if(canon(cur)===canon(nw))return;
 geoBusy=true;geoAt=Date.now();
 setDoc(doc(X.db,"geo","main"),{...nw,upd:Date.now()}).catch(()=>{}).finally(()=>{geoBusy=false});
}
// ---------- النوافذ ----------
function box(){let m=g("flm");if(!m){m=document.createElement("div");m.id="flm";m.className="fm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function closeM(){dropM();mode="";ctxEd=null;const m=box();m.className="fm";m.innerHTML=""}
const openM=h=>{dropM();mode="m";const m=box();m.className="fm on";m.innerHTML=`<div class="fk">${h}</div>`};
const sel=(id,arr,v)=>`<select id="${id}">${arr.map(([a,b])=>`<option value="${E(a)}" ${a===v?"selected":""}>${E(b)}</option>`).join("")}</select>`;
function carForm(id){
 const c=CARS.find(x=>x.id===id)||{};ctxEd=id||null;
 openM(`<h3>${id?"تعديل":"إضافة"} سيارة</h3><label>الاسم (مثلاً: سيارة 1 — دينا)</label><input id="cn" maxlength="60" value="${E(c.name||"")}"><label>رقم اللوحة</label><input id="cp" maxlength="30" value="${E(c.plate||"")}">
 <label>كل كام كم بتغيّر الزيت</label><input id="co" inputmode="numeric" value="${E(c.oilEvery||5000)}"><label>عداد آخر تغيير زيت (كم)</label><input id="cl" inputmode="numeric" value="${E(c.oilLast||"")}">
 <label>انتهاء التأمين</label><input id="ci" type="date" value="${E(c.insExp||"")}"><label>انتهاء رخصة السيارة</label><input id="cx" type="date" value="${E(c.licExp||"")}">
 <div class="fl2" style="margin-top:16px"><button class="bt p" data-fl="carsave" type="button">حفظ</button><button class="bt" data-fl="cancel" type="button">رجوع</button>${id?'<button class="bt r" style="margin-inline-start:auto" data-fl="cardel" type="button">حذف السيارة</button>':""}</div>`);
}
function fuelForm(){
 openM(`<h3>تسجيل بنزين</h3><label>السيارة</label>${sel("fc",CARS.map(c=>[c.id,c.name]),"")}<label>السائق (اختياري)</label>${sel("fd",[["","—"]].concat(DRV.map(d=>[d.id,d.name])),"")}
 <label>اللترات</label><input id="fl" inputmode="decimal"><label>المبلغ</label><input id="fm" inputmode="decimal"><label>قراءة العداد (كم)</label><input id="fo" inputmode="numeric"><label>التاريخ</label><input id="fdt" type="date" value="${today()}">
 <label style="display:flex;gap:8px;align-items:center"><input id="ff" type="checkbox" style="width:auto"> التانك اتملّى فُل (علشان نحسب الاستهلاك)</label>
 <div class="fl2" style="margin-top:16px"><button class="bt p" data-fl="fuelsave" type="button">حفظ</button><button class="bt" data-fl="cancel" type="button">رجوع</button></div>`);
}
// إثبات التسليم (التوقيع والصورة) محفوظ في الطلب نفسه
function podHtml(rid){
 const r=X.R().find(x=>x.id===rid),p=r&&r.pod;if(!p||typeof p!=="object")return "";
 const sg=isImg(p.sig)?`<img src="${E(p.sig)}" alt="توقيع" style="height:56px;background:#fff;border:1px solid var(--line);border-radius:8px">`:"";
 const im=isImg(p.img)?`<img src="${E(p.img)}" alt="صورة التسليم" style="max-width:100%;max-height:220px;border-radius:10px">`:"";
 return sg||im?`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin-top:6px">${sg}${im}</div>`:"";
}
function tripDetail(id){
 const t=TR.find(x=>x.id===id);if(!t)return;const st=Array.isArray(t.stops)?t.stops:[];let p=N(t.start);
 // كيلومترات تقريبية لكل مشوار: من المكان اللي قبله (أول مشوار من مكان بداية الرحلة) للفرع ده
 // (التحويل: المشوار بيعدّي على الفرع اللي استلم منه الأول)
 let pt=t.loc0||geoPt("WH");const kmTo=here=>{const k=kmBetween(pt,here);if(here)pt=here;return k};
 const kmLeg=s=>{let sum=null;stopPts(s).forEach(h=>{if(!h)return;const k=kmTo(h);if(k!==null)sum=(sum||0)+k});return sum},map=hasMap(t);
 // آخر مشوار: من آخر تسليم للمكان اللي أنهى فيه الرحلة (غالباً الرجوع للمستودع)
 const e=endPt(t),lastArr=st.reduce((m,s)=>Math.max(m,N(s.arr)),N(t.start));
 const fu=FU.filter(f=>f.drv===t.drv&&f.car===t.car&&N(f.ts)>=N(t.start)&&(!t.end||N(f.ts)<=N(t.end)+36e5));
 openM(`<h3>${E(t.drvn)} — ${E(t.carn)}</h3><div class="off">${dk(t.start)} · ${hm(t.start)} ← ${t.end?hm(t.end):"شغّال"} · عداد ${fmt(t.odo0)}${t.st==="done"?` ← ${fmt(t.odo1)} (${fmt(N(t.odo1)-N(t.odo0))} كم)`:""}</div>
 <div style="margin:12px 0">${st.map(s=>{const l=s.arr?N(s.arr)-N(p):0;if(s.arr)p=N(s.arr);const k=kmLeg(s);return `<div class="le" style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><div><b>${E(s.brn)}</b><small class="off" style="display:block"><bdi dir="ltr">${E(s.no)}</bdi> · ${N(s.pcs)} قطعة${s.rcvr?" · استلم: "+E(s.rcvr):""}${s.fr?` · 🔄 اتاخد من <bdi dir="ltr">${E(s.frn||s.fr)}</bdi>${s.pk?" "+hm(s.pk):""}`:""}</small>${podHtml(s.rid)}</div><div style="text-align:left">${s.arr?`✔ ${hm(s.arr)}<small class="off" style="display:block">${dur(l)}${k!==null?` · ~${k.toFixed(1)} كم`:""}</small>${s.lat?`<a href="#" data-fl="pmap" data-id="${E(t.id)}" data-lat="${N(s.lat)}" data-lng="${N(s.lng)}" data-t="${E(s.brn)}" data-s="${E("اتسلّم "+hm(s.arr))}">📍</a>`:""}`:'<span class="off">لم يصل</span>'}</div></div>`}).join("")||'<div class="off">لا توجد توصيلات</div>'}
 ${t.st==="done"?(()=>{const k=e?kmTo(e):null,l=N(t.end)-lastArr;return `<div class="le" style="display:flex;justify-content:space-between;gap:8px;padding:8px 0"><div><b>🏁 إنهاء الرحلة</b><small class="off" style="display:block">${e?"المكان اللي السائق قفل فيه الرحلة":t.forced?"اتقفلت من المستودع (مفيش موقع)":"الموبايل ماسجّلش موقع الإنهاء"}</small></div><div style="text-align:left">${hm(t.end)}<small class="off" style="display:block">${l>0?dur(l):""}${k!==null?` · ~${k.toFixed(1)} كم`:""}</small>${e?`<a href="#" data-fl="pmap" data-id="${E(t.id)}" data-lat="${N(e.lat)}" data-lng="${N(e.lng)}" data-t="إنهاء الرحلة" data-s="${E(hm(t.end))}">📍</a>`:""}</div></div>`})():""}</div>
 ${t.note?`<div class="gn">${t.forced?"⏹ ":"ملاحظة السائق: "}${E(t.note)}</div>`:""}${fu.length?`<div class="off">⛽ بنزين في الرحلة: ${fu.map(f=>fmt(f.liters)+" لتر / "+fmt(f.cost)).join(" · ")}</div>`:""}
 <div class="off" style="font-size:12.5px">الكيلومترات اللي جنب كل فرع تقريبية (من أماكن التسليم)، والإجمالي الدقيق من العداد فوق.</div>
 <div class="fl2" style="margin-top:14px">${map?`<button class="bt p" data-fl="tmap" data-id="${E(t.id)}" type="button">🗺 الرحلة على الخريطة</button>`:""}<button class="bt" data-fl="cancel" type="button">إغلاق</button></div>`);
}
function report(){
 const d=fday,tr=TR.filter(t=>dk(t.start)===d).sort((a,b)=>N(a.start)-N(b.start));
 const km=tr.reduce((a,t)=>a+(t.st==="done"?Math.max(0,N(t.odo1)-N(t.odo0)):0),0),del=tr.reduce((a,t)=>a+(Array.isArray(t.stops)?t.stops.filter(s=>s.arr).length:0),0),fu=FU.filter(f=>f.dt===d);
 const body=tr.map(t=>{const st=Array.isArray(t.stops)?t.stops:[];return `<tr><td>${E(t.drvn)}<br>${E(t.carn)}</td><td>${hm(t.start)} ← ${t.end?hm(t.end):"—"}</td><td>${t.end?dur(N(t.end)-N(t.start)):"—"}</td><td class="n">${t.st==="done"?fmt(N(t.odo1)-N(t.odo0)):"—"}</td><td>${st.map(s=>E(s.brn)+(s.arr?" ("+hm(s.arr)+")":" (لم يصل)")).join("<br>")}</td></tr>`}).join("");
 printStmt(`<div class="st"><div class="ph"><h2>تقرير حركة السيارات</h2><div>${E(d)}</div></div><div class="rt"><div><small>عدد الرحلات</small><b>${tr.length}</b></div><div><small>التسليمات</small><b>${del}</b></div><div><small>إجمالي الكيلومترات</small><b>${fmt(km)}</b></div><div><small>بنزين</small><b>${fmt(fu.reduce((a,f)=>a+N(f.liters),0))} لتر / ${fmt(fu.reduce((a,f)=>a+N(f.cost),0))}</b></div></div>
 <table class="stt"><thead><tr><th>السائق / السيارة</th><th>من ← إلى</th><th>المدة</th><th>كم</th><th>الفروع</th></tr></thead><tbody>${body||'<tr><td colspan="5" style="text-align:center">لا توجد رحلات</td></tr>'}</tbody></table><div class="sg"><span>مسؤول المستودع</span><span>المحاسب</span><span>المدير</span></div></div>`);
}
// ---------- حسابات السواقين ----------
async function mkDriver(name,phone){
 let n=1;while(DRV.some(d=>d.id==="drv"+n)||PW["drv"+n])n++;if(n>99)throw new Error("max");
 const code="drv"+n,pw=genPw(),a=makeFb("sec").auth;
 try{await createUserWithEmailAndPassword(a,emailOf(code),pw)}finally{try{await signOut(a)}catch(e){}}
 await setDoc(doc(X.db,"secrets",code),{pw});await setDoc(doc(X.db,"drivers",code),phone?{name,phone,enabled:true}:{name,enabled:true});return code;
}
const dmsg=d=>`أهلاً ${d.name}\nتطبيق السائق:\n${new URL("./driver.html",location.href).href}\nاسم المستخدم: ${d.id}\nكلمة السر: ${PW[d.id]}`;
const cpy=async t=>{try{await navigator.clipboard.writeText(t);X.toast("تم النسخ")}catch(e){prompt("انسخ الرسالة:",t)}};
// ---------- تتبع السائق في الخلفية ----------
// أندرويد: تطبيق TASOOMA للسواقين (tasooma-driver.apk) بيشتغل لوحده مع بدء الرحلة، ومن غير أي إعدادات.
// آيفون: تطبيق Traccar Client بالرمز السري (drivers/{id}.gps). الاتنين بيبعتوا مكانه للسيرفر كل دقيقة حتى والموبايل مقفول،
// والسيرفر بيحدّث الوقت المتوقع للفروع ويبعت "السواق قرب يوصلك". الرمز الجديد بيلغي القديم.
const GPS_URL="https://tasooma-push.tasooma.workers.dev/gps";
const APK_URL="https://github.com/mhmadrgab/TASOOMA-ORDER/releases/latest/download/tasooma-driver.apk";// GitHub Releases، "latest" = آخر نسخة
const gpsTok=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(20))].map(x=>a[x%a.length]).join("")};
const gpsMsg=(d,tok)=>`أهلاً ${d.name}\nعلشان المنصة تعرف مكانك وتقول للفروع إمتى هتوصل، حتى والموبايل في جيبك:\n\n📱 لو موبايلك أندرويد:\nنزّل تطبيق TASOOMA للسواقين من الرابط ده:\n${APK_URL}\nافتحه وادخل بنفس اسم المستخدم وكلمة السر، ووافق على الموقع والإشعارات. خلاص كده، التتبع بيشتغل لوحده أول ما تبدأ الرحلة.\n(لو الموبايل سألك، اسمح بالتثبيت من المصدر ده)\n\n🍎 لو موبايلك آيفون:\n1) نزّل تطبيق "Traccar Client" من App Store (ببلاش)\n2) افتحه واكتب:\nDevice identifier: ${tok}\nServer URL: ${GPS_URL}\nFrequency: 60\n3) شغّل Service status\n4) اسمح بالموقع "طول الوقت / Always"\nوخلّيه شغّال على طول، وشغلك نفسه يفضل من تطبيقنا عادي.`;
function gpsForm(d){
 const tok=d.gps,row=(l,v)=>`<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><span class="off" style="min-width:130px">${l}</span><b dir="ltr" style="flex:1;word-break:break-all">${E(v)}</b><button class="bt s" data-fl="gcp" data-v="${E(v)}" type="button">نسخ</button></div>`;
 const a=TR.find(t=>t.drv===d.id&&t.st==="active"),bg=a&&a.loc&&a.loc.src==="bg"?a.loc:null;
 openM(`<h3>📡 تتبع ${E(d.name)} في الخلفية</h3>
 <p class="off" style="margin:0 0 10px">مكان السواق بيوصل للمنصة كل دقيقة <b>حتى والموبايل مقفول</b>، والمنصة بتحسب الوقت المتوقع لكل فرع وبتبعت للفرع "🔔 السواق قرب يوصلك". المكان بيتسجّل بس وهو في رحلة.</p>
 <div style="border:1.5px solid var(--line,#ddd);border-radius:12px;padding:10px 12px;margin:8px 0"><b>📱 أندرويد: تطبيق TASOOMA للسواقين</b><div class="off" style="margin:4px 0">ينزّله من الرابط، ويدخل بنفس اسم المستخدم وكلمة السر. <b>مفيش أي إعدادات</b>: التتبع بيشتغل لوحده مع بدء الرحلة وبيقف مع إنهائها، والإشعارات بتوصله والتطبيق مقفول.</div>${row("رابط التطبيق",APK_URL)}</div>
 <div style="border:1.5px solid var(--line,#ddd);border-radius:12px;padding:10px 12px;margin:8px 0"><b>🍎 آيفون: تطبيق Traccar Client</b>
 ${row("Device identifier",tok)}${row("Server URL",GPS_URL)}${row("Frequency",60)}
 <ol class="off" style="padding-inline-start:18px;line-height:1.9;margin:8px 0"><li>ينزّل <b>Traccar Client</b> من App Store</li><li>يكتب الـ 3 حاجات اللي فوق في الإعدادات</li><li>يشغّل <b>Service status</b></li><li>يسمح بالموقع <b>طول الوقت (Always)</b></li></ol></div>
 <div class="off" style="margin:6px 0">${a?(bg?`✅ شغّال: آخر مكان وصل من التطبيق ${ago(bg.ts)}`:"⏳ عنده رحلة دلوقتي بس لسه ماوصلش مكان من التطبيق"):"المكان بيظهر هنا أول ما يبدأ رحلة."}</div>
 <div class="fl2" style="margin-top:12px"><button class="bt p" data-fl="gmsg" data-id="${E(d.id)}" type="button">📋 نسخ رسالة للسواق</button><button class="bt" data-fl="gnew" data-id="${E(d.id)}" type="button">🔄 رمز جديد</button><button class="bt" data-fl="cancel" type="button">إغلاق</button></div>`);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-fl]");if(!t)return;const a=t.dataset.fl,id=t.dataset.id;
 try{
  if(!X.admin&&["car","carsave","cardel","fx","trx","drv","dtg","dpw","dcp","spw","dedit","dsave","dwa","gps","gnew","gmsg","gcp"].includes(a)){X.toast("الصلاحية دي للمدير فقط");return}
  if(a==="tmap"||a==="pmap"||a==="mfit")e.preventDefault();// لينكات الخريطة (#)
  if(a==="cancel")closeM();
  else if(a==="tmap")tripMapM(id);
  else if(a==="pmap")pointM(t.dataset.lat,t.dataset.lng,t.dataset.t||"",t.dataset.s||"",id);
  else if(a==="mfit")fitLive();
  else if(a==="car")carForm(id);
  else if(a==="carsave"){
   const nm=g("cn").value.trim();if(!nm){X.toast("اكتب اسم السيارة");return}
   const d={name:nm.slice(0,60),plate:g("cp").value.trim().slice(0,30),oilEvery:N(toEn(g("co").value))||5000,oilLast:N(toEn(g("cl").value)),insExp:g("ci").value,licExp:g("cx").value,active:true};
   await setDoc(doc(X.db,"cars",ctxEd||doc(collection(X.db,"cars")).id),d);closeM();X.toast("تم الحفظ");
  }
  else if(a==="cardel"){if(ctxEd&&confirm("حذف السيارة؟ الرحلات القديمة هتفضل في السجل."))await deleteDoc(doc(X.db,"cars",ctxEd));closeM()}
  else if(a==="fuel")fuelForm();
  else if(a==="fuelsave"){
   const c=CARS.find(x=>x.id===g("fc").value),dv=DRV.find(x=>x.id===g("fd").value),l=N(toEn(g("fl").value)),m=N(toEn(g("fm").value)),o=N(toEn(g("fo").value));
   if(!c||!(l>0)||!(o>0)){X.toast("اختر السيارة واكتب اللترات والعداد");return}
   await setDoc(doc(collection(X.db,"fuel")),{drv:dv?dv.id:"admin",drvn:dv?dv.name:"المستودع",car:c.id,carn:c.name,ts:Date.now(),dt:g("fdt").value||today(),liters:l,cost:m,odo:o,full:g("ff").checked});closeM();X.toast("تم التسجيل");
  }
  else if(a==="fx"){if(confirm("حذف التعبئة؟"))await deleteDoc(doc(X.db,"fuel",id))}
  else if(a==="trd")tripDetail(id);
  else if(a==="trx"){if(confirm("حذف الرحلة من السجل؟"))await deleteDoc(doc(X.db,"trips",id))}
  else if(a==="rep")report();
  else if(a==="mrep")monthReport();
  else if(a==="asg"){
   const dv=DRV.find(x=>x.id===document.querySelector(`[data-asd="${id}"]`).value),c=CARS.find(x=>x.id===document.querySelector(`[data-asc="${id}"]`).value),r=X.R().find(x=>x.id===id);
   if(!dv||!c){X.toast("اختر السائق والسيارة");return}
   const u={asg:{drv:dv.id,drvn:dv.name,car:c.id,carn:c.name+(c.plate?" "+c.plate:"")},upd:Date.now()};if(r&&r.st==="new")u.st="prep";
   await updateDoc(doc(X.db,"requests",id),u);if(X.ping)X.ping([id]);X.toast("تم التعيين: "+dv.name);
  }
  else if(a==="unasg"){await updateDoc(doc(X.db,"requests",id),{asg:null,upd:Date.now()});X.toast("اتلغى التعيين")}
  else if(a==="bulk"){
   const dv=DRV.find(x=>x.id===bkD),c=CARS.find(x=>x.id===bkC),rs=X.R().filter(r=>BK.has(r.id)&&(r.st==="new"||r.st==="prep"));
   if(!rs.length){X.toast("علّم على طلب واحد على الأقل");return}
   if(!dv||!c){X.toast("اختر السائق والسيارة");return}
   const b=writeBatch(X.db),ts=Date.now(),asg={drv:dv.id,drvn:dv.name,car:c.id,carn:c.name+(c.plate?" "+c.plate:"")};
   rs.forEach(r=>{const u={asg,upd:ts};if(r.st==="new")u.st="prep";b.update(doc(X.db,"requests",r.id),u)});
   await b.commit();if(X.ping)X.ping(rs.map(r=>r.id));BK.clear();X.toast(`تم تعيين ${rs.length} طلب لـ ${dv.name}`);
  }
  else if(a==="tend"){
   // رحلة السائق نسي يقفلها: المستودع يقفلها، والفروع اللي ماوصلهاش ترجع "قيد التجهيز"
   const t0=TR.find(x=>x.id===id);if(!t0||t0.st!=="active")return;const left=(t0.stops||[]).filter(s=>!s.arr);
   const o=prompt(`إنهاء رحلة ${t0.drvn}.\n${left.length?`فيه ${left.length} توصيلة ما اتسلمتش وهترجع "قيد التجهيز".\n`:""}اكتب قراءة العداد في آخر الرحلة (سيبها فاضية لو مش معروفة):`,"");if(o===null)return;
   const odo=N(toEn(o))||N(t0.odo0);if(odo<N(t0.odo0)){X.toast("العداد لازم يكون أكبر من البداية ("+fmt(t0.odo0)+")");return}
   const b=writeBatch(X.db),ts=Date.now();
   b.update(doc(X.db,"trips",id),{st:"done",end:ts,odo1:odo,forced:true,note:"أنهاها المستودع"+(N(toEn(o))?"":" (العداد غير معروف)")});
   left.forEach(s=>b.update(doc(X.db,"requests",s.rid),{st:"prep",upd:ts}));
   await b.commit();if(X.ping)X.ping(left.map(s=>s.rid),[id]);X.toast("تم إنهاء الرحلة");
  }
  else if(a==="drv"){const nm=(prompt("اسم السائق:","")||"").trim();if(!nm)return;const ph=(prompt("رقم موبايل السائق (اختياري، مثلاً 0551234567):","")||"").trim();const c=await mkDriver(nm.slice(0,60),toEn(ph).slice(0,20));X.toast("تم إنشاء حساب "+c)}
  else if(a==="dedit"){const d=DRV.find(x=>x.id===id);if(!d)return;ctxEd=id;
   openM(`<h3>تعديل بيانات السائق (${E(id)})</h3><label>الاسم</label><input id="dn" maxlength="60" value="${E(d.name||"")}"><label>رقم الموبايل</label><input id="dph" maxlength="20" inputmode="tel" dir="ltr" placeholder="0551234567" value="${E(d.phone||"")}">
   <div class="fl2" style="margin-top:16px"><button class="bt p" data-fl="dsave" type="button">حفظ</button><button class="bt" data-fl="cancel" type="button">رجوع</button></div>`)}
  else if(a==="dsave"){const nm=g("dn").value.trim();if(!nm){X.toast("اكتب الاسم");return}await setDoc(doc(X.db,"drivers",ctxEd),{name:nm.slice(0,60),phone:toEn(g("dph").value).trim().slice(0,20)},{merge:true});closeM();X.toast("تم الحفظ")}
  else if(a==="dwa"){const d=DRV.find(x=>x.id===id);if(!d)return;const n=waNum(d.phone);if(!n){X.toast("سجّل رقم موبايل السائق الأول من تعديل");return}
   window.open(`https://wa.me/${n}?text=${encodeURIComponent(PW[id]?dmsg(d):"أهلاً "+d.name)}`,"_blank","noopener")}
  else if(a==="spw"){const el=document.querySelector(`[data-fpw="${id}"]`);if(el){const sh=el.dataset.v==="1";el.textContent=sh?"••••••••":PW[id];el.dataset.v=sh?"0":"1";t.textContent=sh?"إظهار":"إخفاء"}}
  else if(a==="dtg"){const d=DRV.find(x=>x.id===id);if(d&&(!d.enabled||confirm("تعطيل السائق؟")))await setDoc(doc(X.db,"drivers",id),{enabled:!d.enabled},{merge:true})}
  else if(a==="dpw"){
   const d=DRV.find(x=>x.id===id);if(!d||!PW[id]){X.toast("كلمة السر الحالية مش متسجلة");return}
   const nw=(prompt("كلمة السر الجديدة (6 حروف على الأقل). سيبها فاضية لتوليد واحدة:","")||"").trim()||genPw();
   const au=makeFb("sec").auth;try{const cr=await signInWithEmailAndPassword(au,emailOf(id),PW[id]);await updatePassword(cr.user,nw)}finally{try{await signOut(au)}catch(x){}}
   await setDoc(doc(X.db,"secrets",id),{pw:nw});X.toast("تم تغيير كلمة السر");
  }
  else if(a==="gps"||a==="gnew"){
   const d=DRV.find(x=>x.id===id);if(!d)return;
   if(a==="gnew"&&!confirm("رمز جديد؟ الرمز القديم هيبطّل يشتغل، ولازم السواق يكتب الجديد في التطبيق."))return;
   if(!d.gps||a==="gnew"){const tok=gpsTok();await updateDoc(doc(X.db,"drivers",id),{gps:tok});d.gps=tok}
   gpsForm(d);
  }
  else if(a==="gcp")cpy(t.dataset.v);
  else if(a==="gmsg"){const d=DRV.find(x=>x.id===id);if(d&&d.gps)cpy(gpsMsg(d,d.gps))}
  else if(a==="dcp"){const d=DRV.find(x=>x.id===id);if(d&&PW[id])cpy(dmsg(d))}
 }catch(x){if(!(window.uiAuthErr&&uiAuthErr(x,"السائق")))X.toast("تعذر التنفيذ: "+(x&&x.code||x&&x.message))}
}
// بداية/نهاية الرحلة والتسليم: السيرفر بيبعتهم كإشعار للجهاز، فالصفحة بتعرض إشعار بس لو الجهاز ده مش متسجّل
function note(t,b,tag){X.toast(b?t+" — "+b:t);if(!pushOn())notify(t,b,tag);beep()}
export function alertsCount(){return X?alerts().length:0}
export function initFleet(ctx){
 X=ctx;stop();
 if(!g("fl-css")){const s=document.createElement("style");s.id="fl-css";s.textContent=CSS+MAP_CSS;document.head.appendChild(s);ensurePrintCss()}
 if(!window.__flc){window.__flc=1;document.addEventListener("click",click);document.addEventListener("change",e=>{const t=e.target;if(t.id==="fday"){fday=t.value;X.redraw()}if(t.id==="fmon"){fmon=t.value;X.redraw()}
  // التعيين الجماعي: بنحفظ الاختيار في الذاكرة علشان التحديث اللحظي مايمسحوش
  if(t.id==="bkd")bkD=t.value;if(t.id==="bkc")bkC=t.value;
  if(t.dataset&&t.dataset.bk){t.checked?BK.add(t.dataset.bk):BK.delete(t.dataset.bk)}
  if(t.id==="bkall")document.querySelectorAll("[data-bk]").forEach(c=>{c.checked=t.checked;t.checked?BK.add(c.dataset.bk):BK.delete(c.dataset.bk)});
  if(t.id==="bkall"||(t.dataset&&t.dataset.bk)){const n=g("bkn");if(n)n.textContent=BK.size}})}
 pT=null;pF=null;
 const draw=()=>{if(X.tab()==="fl"&&mode==="")X.redraw()};
 un.push(onSnapshot(collection(X.db,"cars"),sn=>{CARS=sn.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{}));
 un.push(onSnapshot(collection(X.db,"drivers"),sn=>{DRV=sn.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{}));
 if(X.admin)un.push(onSnapshot(collection(X.db,"secrets"),sn=>{PW={};sn.docs.forEach(d=>{if(/^drv\d+$/.test(d.id))PW[d.id]=d.data().pw});draw()},()=>{}));
 // توفير القراءات: الرحلات والبنزين بتاعة آخر 13 شهر بس (كفاية للتقارير الشهرية ومتوسطات الوصول)
 const since=Date.now()-400*864e5;
 un.push(onSnapshot(query(collection(X.db,"trips"),where("start",">=",since)),sn=>{
  const nx=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pT)nx.forEach(t=>{const o=pT[t.id];if(!o){if(t.st==="active")note("🚚 بدأت رحلة",`${t.drvn} — ${t.carn}`,"t"+t.id)}else{const n=(Array.isArray(t.stops)?t.stops:[]).filter(s=>s.arr),oo=o.n;if(n.length>oo){const s=n[n.length-1];note("📦 وصلت توصيلة",`${t.drvn} → ${s.brn}`,"s"+t.id+n.length)}if(o.st==="active"&&t.st==="done")note("🏁 انتهت رحلة",`${t.drvn} — ${fmt(N(t.odo1)-N(t.odo0))} كم`,"d"+t.id)}});
  pT={};nx.forEach(t=>pT[t.id]={st:t.st,n:(Array.isArray(t.stops)?t.stops:[]).filter(s=>s.arr).length});TR=nx;draw();syncGeo();
 },()=>X.toast("تعذر قراءة الرحلات. حدّث القواعد (Rules)")));
 un.push(onSnapshot(doc(X.db,"geo","main"),d=>{GEOD=d.exists()?d.data():null;geoReady=true;syncGeo()},()=>{}));
 un.push(onSnapshot(query(collection(X.db,"fuel"),where("ts",">=",since)),sn=>{
  FU=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pF)FU.forEach(f=>{if(!(f.id in pF)&&f.drv!=="admin")X.toast(`⛽ ${f.drvn}: ${fmt(f.liters)} لتر بنزين`)});
  pF={};FU.forEach(f=>pF[f.id]=1);draw();
 },()=>{}));
}
export function stop(){un.forEach(f=>f());un=[];dropLive();dropM();CARS=[];DRV=[];TR=[];FU=[];PW={};GEOD=null;geoReady=false;mode="";const m=g("flm");if(m){m.className="fm";m.innerHTML=""}}
