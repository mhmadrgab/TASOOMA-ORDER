// لوحة المستودع: السيارات والسواقين والرحلات والبنزين
import {makeFb,emailOf,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,createUserWithEmailAndPassword,signInWithEmailAndPassword,updatePassword,signOut} from "./fb.js";
import {E,N,fmt,today,stmtHtml,printStmt,ensurePrintCss} from "./cust.js";
import {notify,beep} from "./notify.js";
import {ledger} from "./ad-extra.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const dk=t=>new Date(N(t)).toLocaleDateString("en-CA"),hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dur=ms=>{const m=Math.max(0,Math.round(N(ms)/60000)),h=Math.floor(m/60);return h?`${h}س ${m%60}د`:`${m}د`};
const ago=t=>{const m=Math.round((Date.now()-N(t))/60000);return m<1?"الآن":m<60?`منذ ${m} د`:`منذ ${Math.round(m/60)} س`};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const genPw=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join("")};
const mapUrl=(la,ln)=>`https://www.google.com/maps?q=${N(la)},${N(ln)}`;
let X=null,CARS=[],DRV=[],TR=[],FU=[],PW={},GEOD=null,geoReady=false,un=[],pT=null,pF=null,mode="",fday="",fmon="",ctxEd=null;
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
 const R=X.R(),A=alerts(),act=TR.filter(t=>t.st==="active"),lg=legs();
 const openR=R.filter(r=>(r.st==="new"||r.st==="prep")).sort((a,b)=>N(a.ts)-N(b.ts));
 const days=[...new Set(TR.map(t=>dk(t.start)))].sort().reverse();if(!fday||!days.includes(fday))fday=days[0]||today();
 const dTr=TR.filter(t=>dk(t.start)===fday).sort((a,b)=>N(a.start)-N(b.start));
 const dOpt=(a,sel)=>a.map(([v,l])=>`<option value="${E(v)}" ${v===sel?"selected":""}>${E(l)}</option>`).join("");
 const dr=DRV.filter(d=>d.enabled);
 return `${A.length?A.map(a=>`<div class="${a.l}">${a.t}</div>`).join(""):""}
 <h3 class="sub" style="margin-top:4px">🚚 على الطريق دلوقتي</h3>
 ${act.length?act.map(t=>{const st=Array.isArray(t.stops)?t.stops:[];let p=N(t.start);const done=st.filter(s=>s.arr).length;
  return `<div class="tr"><h4>${E(t.drvn)} — ${E(t.carn)} <span class="pill go">في رحلة</span></h4><div class="off" style="font-size:14px">بدأ ${hm(t.start)} · بقاله ${dur(Date.now()-N(t.start))} · سلّم ${done} من ${st.length}${t.loc?` · <a href="${mapUrl(t.loc.lat,t.loc.lng)}" target="_blank" rel="noopener noreferrer">📍 آخر موقع مسجّل (${ago(t.loc.ts)})</a>`:" · <span>لسه مفيش موقع مسجّل</span>"}</div>
  <div class="st1">${st.map(s=>{if(s.arr){const l=N(s.arr)-p;p=N(s.arr);return `<span class="ok">✔ ${E(s.brn)} ${hm(s.arr)} (${dur(l)})</span>`}const a=lg[s.brn];return `<span>⏳ ${E(s.brn)}${s.eta?` · متوقع ~${hm(s.eta)}`:a?` · متوقع ~${hm(p+a)}`:""}</span>`}).join("")}</div></div>`}).join(""):'<div class="pan off">مفيش سيارة على الطريق دلوقتي.</div>'}
 <h3 class="sub">📦 تعيين التوصيلات</h3><div class="pan"><div class="tw"><table><thead><tr><th>الفرع</th><th>الطلب</th><th>قطع</th><th>المعيّن</th><th>سائق</th><th>سيارة</th><th></th></tr></thead><tbody>${openR.length?openR.map(r=>`<tr><td class="l">${E(r.brn)}</td><td><bdi dir="ltr">${E(r.no)}</bdi></td><td>${N(r.pcs)}</td><td>${r.asg&&r.asg.drvn?`<span class="pill go">${E(r.asg.drvn)} · ${E(r.asg.carn||"")}</span>`:'<span class="off">—</span>'}</td><td><select data-ad="${E(r.id)}"><option value="">اختر</option>${dOpt(dr.map(d=>[d.id,d.name]),r.asg&&r.asg.drv)}</select></td><td><select data-ac="${E(r.id)}"><option value="">اختر</option>${dOpt(CARS.filter(c=>c.active!==false).map(c=>[c.id,c.name+(c.plate?" "+c.plate:"")]),r.asg&&r.asg.car)}</select></td><td style="white-space:nowrap"><button class="bt s g" data-fl="asg" data-id="${E(r.id)}" type="button">تعيين</button>${r.asg&&r.asg.drv?` <button class="bt s" data-fl="unasg" data-id="${E(r.id)}" type="button">إلغاء</button>`:""}</td></tr>`).join(""):'<tr><td colspan="7" class="off" style="text-align:center;padding:20px">مفيش طلبات مفتوحة</td></tr>'}</tbody></table></div><p class="off" style="font-size:13px;margin:8px 0 0">بعد التعيين الطلب بيظهر عند السائق في تطبيقه، والفرع بيشوف "في الطريق" لما السائق يبدأ الرحلة.</p></div>
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">🚗 السيارات</h3>${X.admin?'<button class="bt s g" data-fl="car" type="button" style="margin-inline-start:auto">➕ إضافة سيارة</button>':""}<button class="bt s" data-fl="fuel" type="button" ${X.admin?"":'style="margin-inline-start:auto"'}>⛽ تسجيل بنزين</button></div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السيارة</th><th>العداد</th><th>كم الشهر</th><th>بنزين الشهر</th><th>كم/لتر</th><th>تكلفة/كم</th><th>الزيت</th><th>التأمين / الرخصة</th><th></th></tr></thead><tbody>${CARS.length?CARS.map(c=>{const s=carStat(c),due=N(c.oilLast)+N(c.oilEvery||5000);return `<tr><td class="l" style="direction:rtl">${E(c.name)}<small class="off" style="display:block;direction:ltr">${E(c.plate||"")}</small></td><td>${s.odo?fmt(s.odo):"—"}</td><td>${fmt(s.km)}</td><td>${fmt(s.fl)} لتر<small class="off" style="display:block">${fmt(s.fc)}</small></td><td>${s.kmpl?s.kmpl.toFixed(1):"—"}</td><td>${s.cpk!==null?s.cpk.toFixed(2):"—"}</td><td>${c.oilEvery&&s.odo?(due-s.odo<=0?`<span style="color:#c4362b;font-weight:700">متأخر</span>`:`باقي ${fmt(due-s.odo)} كم`):"—"}</td><td style="font-size:13px">${E(c.insExp||"—")}<br>${E(c.licExp||"—")}</td><td>${X.admin?`<button class="bt s" data-fl="car" data-id="${E(c.id)}" type="button">تعديل</button>`:""}</td></tr>`}).join(""):'<tr><td colspan="9" class="off" style="text-align:center;padding:20px">أضف السيارتين من زرار "إضافة سيارة"</td></tr>'}</tbody></table></div></div>
 <div class="fl2" style="margin-top:22px"><h3 class="sub" style="margin:0">👷 السواقين</h3>${X.admin?'<button class="bt s g" data-fl="drv" type="button" style="margin-inline-start:auto">➕ إضافة سائق</button>':""}</div>
 <div class="pan"><div class="tw"><table><thead><tr><th>السائق</th><th>اسم الدخول</th><th>الحالة</th><th>رحلات الشهر</th><th>كم الشهر</th><th>كلمة السر</th><th></th></tr></thead><tbody>${DRV.length?DRV.map(d=>{const m=dk(Date.now()).slice(0,7),t=TR.filter(x=>x.drv===d.id&&x.st==="done"&&monthOf(x.start)===m);return `<tr><td><b>${E(d.name)}</b></td><td class="l">${E(d.id)}</td><td><span class="pill ${d.enabled?"":"off2"}">${d.enabled?"مفعّل":"معطّل"}</span></td><td>${t.length}</td><td>${fmt(t.reduce((a,x)=>a+Math.max(0,N(x.odo1)-N(x.odo0)),0))}</td><td>${PW[d.id]?`<span class="pin" data-fpw="${E(d.id)}">••••••••</span> <button class="bt s" data-fl="spw" data-id="${E(d.id)}" type="button">إظهار</button>`:'<span class="off">—</span>'}</td><td style="white-space:nowrap">${X.admin?`<button class="bt s" data-fl="dtg" data-id="${E(d.id)}" type="button">${d.enabled?"تعطيل":"تفعيل"}</button> <button class="bt s" data-fl="dpw" data-id="${E(d.id)}" type="button">كلمة سر جديدة</button> <button class="bt s" data-fl="dcp" data-id="${E(d.id)}" type="button">نسخ رسالة</button>`:""}</td></tr>`}).join(""):'<tr><td colspan="7" class="off" style="text-align:center;padding:20px">لسه مفيش سواقين</td></tr>'}</tbody></table></div></div>
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
function syncGeo(){
 if(!geoReady||!TR.length)return;
 const acc={},lg=legs(),lgc={},wh={la:0,ln:0,n:0};
 TR.filter(t=>t.st==="done").forEach(t=>{
  (Array.isArray(t.stops)?t.stops:[]).forEach(x=>{if(x&&x.arr&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lng)){const c=String(x.brn||"").split("-")[0],a=acc[c]||(acc[c]={la:0,ln:0,n:0});a.la+=+x.lat;a.ln+=+x.lng;a.n++}});
  if(t.loc0&&Number.isFinite(+t.loc0.lat)){wh.la+=+t.loc0.lat;wh.ln+=+t.loc0.lng;wh.n++}
 });
 Object.entries(lg).forEach(([b,v])=>{const c=b.split("-")[0];(lgc[c]=lgc[c]||[]).push(v)});
 const br={};Object.entries(acc).forEach(([c,a])=>{const o={lat:+(a.la/a.n).toFixed(5),lng:+(a.ln/a.n).toFixed(5),n:a.n};if(lgc[c])o.avg=Math.max(1,Math.round(lgc[c].reduce((x,y)=>x+y,0)/lgc[c].length/6e4));br[c]=o});
 const nw={br};if(wh.n)nw.wh={lat:+(wh.la/wh.n).toFixed(5),lng:+(wh.ln/wh.n).toFixed(5)};
 const cur=GEOD?{br:GEOD.br||{},...(GEOD.wh?{wh:GEOD.wh}:{})}:null;
 if(JSON.stringify(cur)!==JSON.stringify(nw))setDoc(doc(X.db,"geo","main"),{...nw,upd:Date.now()}).catch(()=>{});
}
// ---------- النوافذ ----------
function box(){let m=g("flm");if(!m){m=document.createElement("div");m.id="flm";m.className="fm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function closeM(){mode="";ctxEd=null;const m=box();m.className="fm";m.innerHTML=""}
const openM=h=>{mode="m";const m=box();m.className="fm on";m.innerHTML=`<div class="fk">${h}</div>`};
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
function tripDetail(id){
 const t=TR.find(x=>x.id===id);if(!t)return;const st=Array.isArray(t.stops)?t.stops:[];let p=N(t.start);
 const fu=FU.filter(f=>f.drv===t.drv&&f.car===t.car&&N(f.ts)>=N(t.start)&&(!t.end||N(f.ts)<=N(t.end)+36e5));
 openM(`<h3>${E(t.drvn)} — ${E(t.carn)}</h3><div class="off">${dk(t.start)} · ${hm(t.start)} ← ${t.end?hm(t.end):"شغّال"} · عداد ${fmt(t.odo0)}${t.st==="done"?` ← ${fmt(t.odo1)} (${fmt(N(t.odo1)-N(t.odo0))} كم)`:""}</div>
 <div style="margin:12px 0">${st.map(s=>{const l=s.arr?N(s.arr)-N(p):0;if(s.arr)p=N(s.arr);return `<div class="le" style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><div><b>${E(s.brn)}</b><small class="off" style="display:block"><bdi dir="ltr">${E(s.no)}</bdi> · ${N(s.pcs)} قطعة${s.rcvr?" · استلم: "+E(s.rcvr):""}</small></div><div style="text-align:left">${s.arr?`✔ ${hm(s.arr)}<small class="off" style="display:block">${dur(l)}</small>${s.lat?`<a href="${mapUrl(s.lat,s.lng)}" target="_blank" rel="noopener noreferrer">📍</a>`:""}`:'<span class="off">لم يصل</span>'}</div></div>`}).join("")||'<div class="off">لا توجد توصيلات</div>'}</div>
 ${t.note?`<div class="gn">ملاحظة السائق: ${E(t.note)}</div>`:""}${fu.length?`<div class="off">⛽ بنزين في الرحلة: ${fu.map(f=>fmt(f.liters)+" لتر / "+fmt(f.cost)).join(" · ")}</div>`:""}
 <div class="fl2" style="margin-top:14px"><button class="bt" data-fl="cancel" type="button">إغلاق</button></div>`);
}
function report(){
 const d=fday,tr=TR.filter(t=>dk(t.start)===d).sort((a,b)=>N(a.start)-N(b.start));
 const km=tr.reduce((a,t)=>a+(t.st==="done"?Math.max(0,N(t.odo1)-N(t.odo0)):0),0),del=tr.reduce((a,t)=>a+(Array.isArray(t.stops)?t.stops.filter(s=>s.arr).length:0),0),fu=FU.filter(f=>f.dt===d);
 const body=tr.map(t=>{const st=Array.isArray(t.stops)?t.stops:[];return `<tr><td>${E(t.drvn)}<br>${E(t.carn)}</td><td>${hm(t.start)} ← ${t.end?hm(t.end):"—"}</td><td>${t.end?dur(N(t.end)-N(t.start)):"—"}</td><td class="n">${t.st==="done"?fmt(N(t.odo1)-N(t.odo0)):"—"}</td><td>${st.map(s=>E(s.brn)+(s.arr?" ("+hm(s.arr)+")":" (لم يصل)")).join("<br>")}</td></tr>`}).join("");
 printStmt(`<div class="st"><div class="ph"><h2>تقرير حركة السيارات</h2><div>${E(d)}</div></div><div class="rt"><div><small>عدد الرحلات</small><b>${tr.length}</b></div><div><small>التسليمات</small><b>${del}</b></div><div><small>إجمالي الكيلومترات</small><b>${fmt(km)}</b></div><div><small>بنزين</small><b>${fmt(fu.reduce((a,f)=>a+N(f.liters),0))} لتر / ${fmt(fu.reduce((a,f)=>a+N(f.cost),0))}</b></div></div>
 <table class="stt"><thead><tr><th>السائق / السيارة</th><th>من ← إلى</th><th>المدة</th><th>كم</th><th>الفروع</th></tr></thead><tbody>${body||'<tr><td colspan="5" style="text-align:center">لا توجد رحلات</td></tr>'}</tbody></table><div class="sg"><span>مسؤول المستودع</span><span>المحاسب</span><span>المدير</span></div></div>`);
}
// ---------- حسابات السواقين ----------
async function mkDriver(name){
 let n=1;while(DRV.some(d=>d.id==="drv"+n)||PW["drv"+n])n++;if(n>99)throw new Error("max");
 const code="drv"+n,pw=genPw(),a=makeFb("sec").auth;
 try{await createUserWithEmailAndPassword(a,emailOf(code),pw)}finally{try{await signOut(a)}catch(e){}}
 await setDoc(doc(X.db,"secrets",code),{pw});await setDoc(doc(X.db,"drivers",code),{name,enabled:true});return code;
}
const dmsg=d=>`أهلاً ${d.name}\nتطبيق السائق:\n${new URL("./driver.html",location.href).href}\nاسم المستخدم: ${d.id}\nكلمة السر: ${PW[d.id]}`;
const cpy=async t=>{try{await navigator.clipboard.writeText(t);X.toast("تم النسخ")}catch(e){prompt("انسخ الرسالة:",t)}};
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-fl]");if(!t)return;const a=t.dataset.fl,id=t.dataset.id;
 try{
  if(!X.admin&&["car","carsave","cardel","fx","trx","drv","dtg","dpw","dcp","spw"].includes(a)){X.toast("الصلاحية دي للمدير فقط");return}
  if(a==="cancel")closeM();
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
   const dv=DRV.find(x=>x.id===document.querySelector(`[data-ad="${id}"]`).value),c=CARS.find(x=>x.id===document.querySelector(`[data-ac="${id}"]`).value),r=X.R().find(x=>x.id===id);
   if(!dv||!c){X.toast("اختر السائق والسيارة");return}
   const u={asg:{drv:dv.id,drvn:dv.name,car:c.id,carn:c.name+(c.plate?" "+c.plate:"")},upd:Date.now()};if(r&&r.st==="new")u.st="prep";
   await updateDoc(doc(X.db,"requests",id),u);X.toast("تم التعيين: "+dv.name);
  }
  else if(a==="unasg"){await updateDoc(doc(X.db,"requests",id),{asg:null,upd:Date.now()});X.toast("اتلغى التعيين")}
  else if(a==="drv"){const nm=(prompt("اسم السائق:","")||"").trim();if(!nm)return;const c=await mkDriver(nm.slice(0,60));X.toast("تم إنشاء حساب "+c)}
  else if(a==="spw"){const el=document.querySelector(`[data-fpw="${id}"]`);if(el){const sh=el.dataset.v==="1";el.textContent=sh?"••••••••":PW[id];el.dataset.v=sh?"0":"1";t.textContent=sh?"إظهار":"إخفاء"}}
  else if(a==="dtg"){const d=DRV.find(x=>x.id===id);if(d&&(!d.enabled||confirm("تعطيل السائق؟")))await setDoc(doc(X.db,"drivers",id),{name:d.name,enabled:!d.enabled})}
  else if(a==="dpw"){
   const d=DRV.find(x=>x.id===id);if(!d||!PW[id]){X.toast("كلمة السر الحالية مش متسجلة");return}
   const nw=(prompt("كلمة السر الجديدة (6 حروف على الأقل). سيبها فاضية لتوليد واحدة:","")||"").trim()||genPw();
   const au=makeFb("sec").auth;try{const cr=await signInWithEmailAndPassword(au,emailOf(id),PW[id]);await updatePassword(cr.user,nw)}finally{try{await signOut(au)}catch(x){}}
   await setDoc(doc(X.db,"secrets",id),{pw:nw});X.toast("تم تغيير كلمة السر");
  }
  else if(a==="dcp"){const d=DRV.find(x=>x.id===id);if(d&&PW[id])cpy(dmsg(d))}
 }catch(x){X.toast("تعذر التنفيذ: "+(x&&x.code||x&&x.message))}
}
function note(t,b,tag){X.toast(b?t+" — "+b:t);notify(t,b,tag);beep()}
export function alertsCount(){return X?alerts().length:0}
export function initFleet(ctx){
 X=ctx;stop();
 if(!g("fl-css")){const s=document.createElement("style");s.id="fl-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(!window.__flc){window.__flc=1;document.addEventListener("click",click);document.addEventListener("change",e=>{if(e.target.id==="fday"){fday=e.target.value;X.redraw()}if(e.target.id==="fmon"){fmon=e.target.value;X.redraw()}})}
 pT=null;pF=null;
 const draw=()=>{if(X.tab()==="fl"&&mode==="")X.redraw()};
 un.push(onSnapshot(collection(X.db,"cars"),sn=>{CARS=sn.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{}));
 un.push(onSnapshot(collection(X.db,"drivers"),sn=>{DRV=sn.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{}));
 if(X.admin)un.push(onSnapshot(collection(X.db,"secrets"),sn=>{PW={};sn.docs.forEach(d=>{if(/^drv\d+$/.test(d.id))PW[d.id]=d.data().pw});draw()},()=>{}));
 un.push(onSnapshot(collection(X.db,"trips"),sn=>{
  const nx=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pT)nx.forEach(t=>{const o=pT[t.id];if(!o){if(t.st==="active")note("🚚 بدأت رحلة",`${t.drvn} — ${t.carn}`,"t"+t.id)}else{const n=(Array.isArray(t.stops)?t.stops:[]).filter(s=>s.arr),oo=o.n;if(n.length>oo){const s=n[n.length-1];note("📦 وصلت توصيلة",`${t.drvn} → ${s.brn}`,"s"+t.id+n.length)}if(o.st==="active"&&t.st==="done")note("🏁 انتهت رحلة",`${t.drvn} — ${fmt(N(t.odo1)-N(t.odo0))} كم`,"d"+t.id)}});
  pT={};nx.forEach(t=>pT[t.id]={st:t.st,n:(Array.isArray(t.stops)?t.stops:[]).filter(s=>s.arr).length});TR=nx;draw();syncGeo();
 },()=>X.toast("تعذر قراءة الرحلات. حدّث القواعد (Rules)")));
 un.push(onSnapshot(doc(X.db,"geo","main"),d=>{GEOD=d.exists()?d.data():null;geoReady=true;syncGeo()},()=>{}));
 un.push(onSnapshot(collection(X.db,"fuel"),sn=>{
  FU=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pF)FU.forEach(f=>{if(!(f.id in pF)&&f.drv!=="admin")X.toast(`⛽ ${f.drvn}: ${fmt(f.liters)} لتر بنزين`)});
  pF={};FU.forEach(f=>pF[f.id]=1);draw();
 },()=>{}));
}
export function stop(){un.forEach(f=>f());un=[];CARS=[];DRV=[];TR=[];FU=[];PW={};GEOD=null;geoReady=false;mode="";const m=g("flm");if(m){m.className="fm";m.innerHTML=""}}
