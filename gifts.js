// 🎁 الهدايا والعينات: الفرع (أو المستودع) يسجّل هدية/عينة طلعت + سند يثبتها، والمديرين أو المستودع بيعتمدوها،
// والمحاسب (صلاحية gift) بيشوف ويطلّع تقارير لكل فرع أو للمستودع (طباعة PDF وملف إكسل). التعديل والمسح لمالك النظام بس.
// gifts/{id} = {br:"003"|"WH", brn, no, ts, dt, rows:[{k,c,z,q}], pcs, to:{n,ph?}, why, note?, img:1, by:{e,n}, st:"pend"|"ok"|"no", ap?:{e,n,at,note?}}
// صورة السند لوحدها في giftimg/{id} = {img} (بتتحمّل بس لما حد يدوس 📎، علشان القايمة تفضل خفيفة).
import {collection,doc,getDoc,getDocs,setDoc,deleteDoc,updateDoc,onSnapshot,query,where,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E,N,fmt,today,shrink,printStmt,ensurePrintCss} from "./cust.js";
import {initZoom,zoomOpen} from "./zoom.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const WHY=["هدية لعميل","تعويض عميل","عينة","تسويق / مؤثر","مناسبة / حدث","أخرى"];
const STL={pend:"⏳ بانتظار الاعتماد",ok:"✅ معتمدة",no:"❌ مرفوضة"};
const D=864e5,LIVE=90;// آخر 90 يوم بيتسمعوا لايف في المستودع، والأقدم بيتحمّل وقت التقرير
let X=null,L=new Map(),PEND=new Map(),OLD=new Map(),un=[],bun=null,BL=[],img="",imgBusy=false,edit=null;
let F={from:"",to:"",br:"",st:""};
const CSS=`
.gfm{display:none;position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);overflow:auto;padding:16px}.gfm.on{display:block}
.gfk{max-width:620px;margin:3vh auto;background:var(--card);border-radius:18px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.gfk h3{margin:0 0 4px}.gfk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}.gfk input,.gfk select,.gfk textarea{width:100%}
.gfk textarea{background:var(--field);border:1.5px solid transparent;border-radius:11px;padding:10px 12px;font:inherit;color:var(--ink)}
.gf-rows{display:grid;gap:6px}.gf-row{display:grid;grid-template-columns:1.4fr 1fr .8fr .7fr auto;gap:6px;align-items:center}.gf-row input{padding:9px 8px;text-align:center}
.gf-row button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--mut)}
.gf-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.gf-2{grid-template-columns:1fr}.gf-row{grid-template-columns:1fr 1fr 1fr .8fr auto}}
.gf-up{border:2px dashed var(--line);border-radius:14px;padding:14px;text-align:center;cursor:pointer;display:block;color:var(--mut)}.gf-up.ok{border-color:#2f8f3e;color:#1d5a24;background:#eaf6eb}
.gf-up img{max-height:120px;max-width:100%;border-radius:8px;display:block;margin:8px auto 0}
.gf-act{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.gf-act>*{flex:1;min-width:120px}
.gf-card{background:var(--card);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-inline-start:6px solid #d4ae5c}
.gf-card.ok{border-inline-start-color:#2f8f3e}.gf-card.no{border-inline-start-color:#c4362b;opacity:.85}
.gf-card h4{margin:0 0 4px;font-size:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.gf-card .m{color:var(--mut);font-size:13.5px}
.gf-st{border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700;background:#f6edd2;color:#6b5314}.gf-st.ok{background:#d8efd9;color:#1d5a24}.gf-st.no{background:#f8d9d5;color:#8a2218}
.gf-it{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.gf-it span{background:var(--soft);border-radius:9px;padding:3px 9px;font-size:13.5px}
.gf-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.gf-b .bt,.gf-b button{width:auto}
.gf-f{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:0 0 12px}.gf-f>div{display:flex;flex-direction:column;gap:3px}.gf-f small{color:var(--mut);font-size:12px}
.gf-sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.gf-sum span{background:var(--card);border-radius:999px;padding:7px 14px;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.gf-pend{background:#fff7e6;border:1px solid #efc47c;border-radius:16px;padding:12px 14px;margin-bottom:14px}
.gfbtn{font-size:13px}
@media (prefers-color-scheme:dark){.gf-st{background:#3a3115;color:#e8cf8a}.gf-st.ok{background:#173a1b;color:#8fd39a}.gf-st.no{background:#40191a;color:#f1a5a0}.gf-up.ok{background:#173a1b;color:#8fd39a}.gf-pend{background:#2b2210;border-color:#6b5226}}
#gfm .bt{font:inherit;font-weight:700;border-radius:12px;padding:10px 16px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}#gfm .bt.s{padding:6px 12px;font-size:13.5px}
#gfm .bt.p{background:#1b1b1b;border-color:#1b1b1b;color:#fff}#gfm .bt.g{background:#d4ae5c;border-color:#d4ae5c;color:#1b1b1b}#gfm .bt.r{color:#c4362b;border-color:#c4362b}#gfm .bt:disabled{opacity:.6}
@media print{.gfm{display:none!important}}
`;
const all=()=>{const m=new Map([...OLD,...L,...PEND]);return [...m.values()]};
const hm=t=>new Date(N(t)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const brName=c=>c==="WH"?"المستودع":((X&&X.branches||[]).find(b=>String(b).split("-")[0]===c)||c);
const itemsTxt=r=>(Array.isArray(r.rows)?r.rows:[]).map(x=>[x.k,x.c,x.z].filter(Boolean).join(" ")+" × "+N(x.q)).join(" · ");
const canApprove=()=>!!(X&&X.approver);
const isOwner=()=>!!(X&&X.owner&&X.owner());
// ---------- البداية ----------
// ctx: {db,toast,ping(ids),mode:"wh"|"branch",me:{e,n},approver,acc,view,owner(),branches,redraw,tab, code,brn (للفرع)}
export function initGifts(ctx){
 stopGifts();X=ctx;
 if(!g("gf-css")){const s=document.createElement("style");s.id="gf-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(ctx.mode==="branch"){initZoom({db:ctx.db,toast:ctx.toast,owner:()=>false});addBranchButton()}
 else{
  const draw=()=>{if(X&&X.tab()==="gift")X.redraw();else if(X&&X.badge)X.badge()};
  if(canApprove())un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","pend")),sn=>{PEND=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
  un.push(onSnapshot(query(collection(X.db,"gifts"),where("ts",">=",Date.now()-LIVE*D)),sn=>{L=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>X.toast("تعذر قراءة الهدايا. تأكد من نشر القواعد (Rules) الجديدة")));
 }
 if(!window.__gfc){window.__gfc=1;document.addEventListener("click",click);document.addEventListener("change",change)}
}
export function stopGifts(){un.forEach(f=>f());un=[];if(bun){bun();bun=null}L=new Map();PEND=new Map();OLD=new Map();closeM()}
export const pendingCount=()=>PEND.size;
// ---------- الفرع: زرار فوق + نافذة فيها هداياه ----------
function addBranchButton(){
 if(g("gfbtn"))return;const mx=g("mx");if(!mx)return;
 const b=document.createElement("button");b.id="gfbtn";b.type="button";b.className="gfbtn";b.textContent="🎁 هدايا وعينات";b.dataset.gf="bopen";
 mx.parentNode.insertBefore(b,mx);
}
function openBranch(){
 if(bun)bun();BL=[];
 bun=onSnapshot(query(collection(X.db,"gifts"),where("br","==",X.code)),sn=>{BL=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>N(b.ts)-N(a.ts));if(g("gfm")&&g("gfm").dataset.v==="list")paintBranch()},e=>X.toast("تعذر قراءة الهدايا. تواصل مع المستودع","er"));
 paintBranch();
}
function paintBranch(){
 const pend=BL.filter(r=>r.st==="pend").length;
 openM(`<h3>🎁 الهدايا والعينات</h3><div class="m" style="color:var(--mut);font-size:14px;margin-bottom:10px">أي هدية أو عينة تخرج من الفرع يجب تسجيلها هنا (ويمكنك إرفاق صورة السند)، ويعتمدها المستودع.</div>
 <button class="b p" data-gf="new" type="button" style="width:100%">➕ تسجيل هدية / عينة جديدة</button>
 <div style="margin-top:14px">${BL.length?`${pend?`<div class="m" style="margin-bottom:6px">⏳ ${pend} بانتظار الاعتماد</div>`:""}${BL.slice(0,40).map(r=>card(r,false)).join("")}`:'<div class="m" style="text-align:center;padding:20px;color:var(--mut)">لا توجد هدايا مسجّلة بعد</div>'}</div>
 <div class="gf-act"><button class="b" data-gf="close" type="button">إغلاق</button></div>`,"list");
}
// ---------- الكارت ----------
function card(r,wh){
 const st=r.st||"pend",ap=r.ap||{};
 return `<div class="gf-card ${st}"><h4>${wh?`<bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi>`:""}<span class="gf-st ${st}">${STL[st]||st}</span><small class="m"><bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.dt||"")}</small></h4>
 <div class="m">👤 ${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?` · <bdi dir="ltr">${E(r.to.ph)}</bdi>`:""} · 🏷 ${E(r.why||"")}${r.note?` · ${E(r.note)}`:""}</div>
 <div class="gf-it">${(Array.isArray(r.rows)?r.rows:[]).map(x=>`<span><bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi> × <b>${N(x.q)}</b></span>`).join("")}</div>
 <div class="m">سجّلها: ${E(r.by&&r.by.n||"")} · ${hm(r.ts)} · ${N(r.pcs)} قطعة${st!=="pend"&&ap.n?` · ${st==="ok"?"اعتمدها":"رفضها"}: ${E(ap.n)} ${hm(ap.at)}`:""}${st==="no"&&ap.note?`<br><b style="color:#c4362b">سبب الرفض: ${E(ap.note)}</b>`:""}</div>
 <div class="gf-b">${r.img?`<button class="bt s" data-gf="img" data-id="${E(r.id)}" type="button">📎 السند</button>`:'<span class="m">بدون مرفق</span>'}
 ${wh&&canApprove()&&st==="pend"?`<button class="bt s g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${isOwner()?`<button class="bt s" data-gf="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button><button class="bt s" data-gf="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`:""}</div></div>`;
}
// ---------- تبويب المستودع ----------
function filtered(){
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0,b=F.to?new Date(F.to+"T23:59:59").getTime():Infinity;
 return all().filter(r=>N(r.ts)>=a&&N(r.ts)<=b&&(!F.br||r.br===F.br)&&(!F.st||r.st===F.st)).sort((x,y)=>N(y.ts)-N(x.ts));
}
export function giftsView(){
 if(!X)return "";
 if(!F.from){F.from=new Date(Date.now()-30*D).toLocaleDateString("en-CA");F.to=today()}
 const rs=filtered(),pend=canApprove()?[...PEND.values()].sort((a,b)=>N(a.ts)-N(b.ts)):[];
 const ok=rs.filter(r=>r.st==="ok"),pcs=ok.reduce((s,r)=>s+N(r.pcs),0);
 const per={};ok.forEach(r=>{const k=r.br;(per[k]=per[k]||{n:0,p:0}).n++;per[k].p+=N(r.pcs)});
 const brs=[...new Set(all().map(r=>r.br))].sort();
 return `<div class="fl" style="margin:0 0 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><h2 style="margin:0">🎁 الهدايا والعينات</h2>${canApprove()&&!X.noNew?`<button class="bt g" data-gf="new" type="button" style="margin-inline-start:auto">➕ هدية / عينة من المستودع</button>`:""}</div>
 ${pend.length?`<div class="gf-pend"><h3 style="margin:0 0 8px">⏳ بانتظار اعتمادك (${pend.length})</h3>${pend.map(r=>card(r,true)).join("")}</div>`:""}
 <div class="gf-f"><div><small>من</small><input type="date" id="gff" value="${E(F.from)}"></div><div><small>إلى</small><input type="date" id="gft" value="${E(F.to)}"></div>
 <div><small>الفرع</small><select id="gfb"><option value="">كل الفروع والمستودع</option><option value="WH" ${F.br==="WH"?"selected":""}>المستودع</option>${(X.branches||[]).map(b=>{const c=String(b).split("-")[0];return `<option value="${E(c)}" ${F.br===c?"selected":""}>${E(b)}</option>`}).join("")}${brs.filter(c=>c!=="WH"&&!(X.branches||[]).some(b=>String(b).split("-")[0]===c)).map(c=>`<option value="${E(c)}" ${F.br===c?"selected":""}>${E(c)}</option>`).join("")}</select></div>
 <div><small>الحالة</small><select id="gfs"><option value="">الكل</option>${Object.entries(STL).map(([k,v])=>`<option value="${k}" ${F.st===k?"selected":""}>${v}</option>`).join("")}</select></div>
 <button class="bt" data-gf="print" type="button">🖨 تقرير PDF</button><button class="bt" data-gf="csv" type="button">⬇️ إكسل</button></div>
 <div class="gf-sum"><span>🎁 <b>${rs.length}</b> في الفترة</span><span>✅ <b>${ok.length}</b> معتمدة · <b>${fmt(pcs)}</b> قطعة</span><span>⏳ <b>${rs.filter(r=>r.st==="pend").length}</b> بانتظار</span><span>❌ <b>${rs.filter(r=>r.st==="no").length}</b> مرفوضة</span></div>
 ${Object.keys(per).length>1?`<div class="pan" style="margin-bottom:12px"><h3 style="margin:0 0 8px">المعتمد لكل فرع</h3><div class="tw"><table><thead><tr><th>الفرع</th><th>عدد</th><th>قطع</th></tr></thead><tbody>${Object.entries(per).sort((a,b)=>b[1].p-a[1].p).map(([k,v])=>`<tr><td class="l"><bdi dir="ltr">${E(brName(k))}</bdi></td><td>${v.n}</td><td>${fmt(v.p)}</td></tr>`).join("")}</tbody></table></div></div>`:""}
 ${rs.length?rs.map(r=>card(r,true)).join(""):'<div class="pan off" style="text-align:center;padding:24px">لا توجد هدايا في هذه الفترة</div>'}`;
}
// لو الفترة أقدم من اللي بيتسمع لايف: نحمّلها مرة واحدة
async function ensureRange(){
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0;if(a>=Date.now()-LIVE*D)return;
 const b=Math.min(F.to?new Date(F.to+"T23:59:59").getTime():Date.now(),Date.now()-LIVE*D);
 try{const sn=await getDocs(query(collection(X.db,"gifts"),where("ts",">=",a),where("ts","<=",b)));sn.docs.forEach(d=>OLD.set(d.id,{id:d.id,...d.data()}))}
 catch(e){X.toast("تعذر تحميل هذه الفترة، تأكد من الإنترنت")}
}
// ---------- النافذة ----------
function box(){let m=g("gfm");if(!m){m=document.createElement("div");m.id="gfm";m.className="gfm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(h,v){const m=box();m.innerHTML=`<div class="gfk">${h}</div>`;m.className="gfm on";m.dataset.v=v||""}
function closeM(){const m=g("gfm");if(m){m.className="gfm";m.innerHTML="";m.dataset.v=""}img="";imgBusy=false;edit=null;if(bun&&!(g("gfm")&&g("gfm").dataset.v)){bun();bun=null}}
// ---------- نموذج التسجيل ----------
const rowHtml=(x={})=>`<div class="gf-row"><input data-r="k" placeholder="الكود" dir="ltr" maxlength="40" value="${E(x.k||"")}"><input data-r="c" placeholder="اللون" maxlength="40" value="${E(x.c||"")}"><input data-r="z" placeholder="المقاس" maxlength="20" value="${E(x.z||"")}"><input data-r="q" placeholder="العدد" inputmode="numeric" value="${x.q?E(x.q):""}"><button type="button" data-gf="rmrow" title="احذف السطر">✕</button></div>`;
function form(r){
 edit=r||null;img="";imgBusy=false;
 const wh=X.mode!=="branch",lsName=(()=>{try{return localStorage.getItem("gf_by")||""}catch(e){return ""}})();
 openM(`<h3>${r?"✏️ تعديل":"🎁 تسجيل"} هدية / عينة</h3><div style="color:var(--mut);font-size:13.5px">${r?`<bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.brn||brName(r.br))}`:wh?"من المستودع (تُعتمد مباشرة)":"من "+E(X.brn)+" — سترسل إلى المستودع ليعتمدها"}</div>
 <label>الأصناف</label><div class="gf-rows" id="gfrows">${(r&&Array.isArray(r.rows)&&r.rows.length?r.rows:[{}]).map(rowHtml).join("")}</div>
 <button class="bt s" data-gf="addrow" type="button" style="margin-top:6px;width:auto">➕ صنف</button>
 <div class="gf-2"><div><label>اسم المستلم *</label><input id="gfn" maxlength="60" value="${E(r&&r.to&&r.to.n||"")}" placeholder="مثلاً: أ. محمد علي"></div>
 <div><label>جوال المستلم</label><input id="gfp" maxlength="20" inputmode="tel" dir="ltr" value="${E(r&&r.to&&r.to.ph||"")}" placeholder="05xxxxxxxx"></div></div>
 <div class="gf-2"><div><label>السبب *</label><select id="gfw">${WHY.map(w=>`<option ${r&&r.why===w?"selected":""}>${E(w)}</option>`).join("")}</select></div>
 <div><label>${wh?"اسمك":"اسمك (من يسجّل) *"}</label><input id="gfby" maxlength="60" value="${E(r&&r.by?r.by.n:wh?(X.me.n||""):lsName)}" ${wh||r?"disabled":""}></div></div>
 <label>ملاحظة</label><textarea id="gfnote" rows="2" maxlength="300" placeholder="اختياري">${E(r&&r.note||"")}</textarea>
 <label>صورة السند (اختياري)</label><input type="file" id="gff1" accept="image/*" hidden><label class="gf-up" id="gfup" for="gff1"><span id="gfupt">📎 ${r?"صورة سند جديدة (اختياري)":"اضغط هنا لإضافة صورة السند (اختياري)"}</span><img id="gfupi" alt="" hidden></label>
 <div class="gf-act"><button class="bt p" data-gf="save" type="button">${r?"💾 حفظ التعديل":"✅ تسجيل"}</button><button class="bt" data-gf="${X.mode==="branch"&&!r?"bopen":"close"}" type="button">رجوع</button></div>`,"form");
 g("gff1").onchange=async()=>{const f=g("gff1").files[0],u=g("gfup"),tx=g("gfupt"),pv=g("gfupi");if(!f)return;imgBusy=true;u.className="gf-up";tx.textContent="⏳ جاري تجهيز الصورة...";pv.hidden=true;
  try{img=await shrink(f,1400,230000);u.className="gf-up ok";tx.textContent="✅ السند جاهز (اضغط مجدداً إن أردت تغييره)";pv.src=img;pv.hidden=false}
  catch(e){img="";tx.textContent="⚠️ الصورة غير صالحة، حاول مجدداً"}
  imgBusy=false};
}
async function save(){
 if(imgBusy){X.toast("انتظر حتى تنتهي الصورة");return}
 const rows=[...document.querySelectorAll("#gfrows .gf-row")].map(el=>{const v=k=>el.querySelector(`[data-r="${k}"]`).value.trim();return {k:v("k").slice(0,40),c:v("c").slice(0,40),z:v("z").slice(0,20),q:Math.min(99999,Math.round(N(toEn(v("q")))))}}).filter(x=>x.k&&x.q>0).map(x=>{const o={k:x.k,q:x.q};if(x.c)o.c=x.c;if(x.z)o.z=x.z;return o});
 const to={n:g("gfn").value.trim().slice(0,60)},ph=toEn(g("gfp").value).replace(/[^\d+]/g,"").slice(0,20);if(ph)to.ph=ph;
 const why=g("gfw").value,note=g("gfnote").value.trim().slice(0,300),byN=g("gfby").value.trim().slice(0,60);
 if(!rows.length){X.toast("اكتب صنفاً واحداً على الأقل (الكود والعدد)");return}
 if(rows.length>100){X.toast("الأصناف كثيرة جداً (أكثر من 100)");return}
 if(!to.n){X.toast("اكتب اسم المستلم");return}
 if(!byN){X.toast("اكتب اسمك");return}
 
 const btn=document.querySelector('[data-gf="save"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 try{
  const pcs=rows.reduce((s,x)=>s+x.q,0);
  if(edit){// المالك بس
   const d={...edit,rows,pcs,to,why,note};delete d.id;if(!note)delete d.note;if(img)d.img=1;
   const b=writeBatch(X.db);b.set(doc(X.db,"gifts",edit.id),d);if(img)b.set(doc(X.db,"giftimg",edit.id),{img});
   await withTimeout(b.commit(),20000);X.toast("تم حفظ التعديل ✅");closeM();if(X.mode==="branch")openBranch();return;
  }
  const wh=X.mode!=="branch",ts=Date.now(),dd=new Date(ts),p=n=>String(n).padStart(2,"0"),br=wh?"WH":X.code;
  const ref=doc(collection(X.db,"gifts")),no=`G-${br}-${p(dd.getMonth()+1)}${p(dd.getDate())}-${p(dd.getHours())}${p(dd.getMinutes())}`;
  const d={br,brn:wh?"المستودع":String(X.brn||br).slice(0,40),no,ts,dt:today(),rows,pcs,to,why,by:{e:X.me.e,n:byN},st:wh?"ok":"pend"};
  if(note)d.note=note;if(img)d.img=1;if(wh)d.ap={e:X.me.e,n:byN,at:ts};
  const b=writeBatch(X.db);b.set(ref,d);if(img)b.set(doc(X.db,"giftimg",ref.id),{img});
  await withTimeout(b.commit(),20000);
  if(!wh)try{localStorage.setItem("gf_by",byN)}catch(e){}
  if(X.ping)X.ping([ref.id]);
  X.toast(wh?"تم التسجيل ✅":"سُجّلت ✅ وبانتظار اعتماد المستودع");
  if(X.mode==="branch")openBranch();else closeM();
 }catch(e){if(btn){btn.disabled=false;btn.textContent=edit?"💾 حفظ التعديل":"✅ تسجيل"}const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")}
}
// ---------- الاعتماد / الرفض ----------
async function decide(id,ok){
 const r=PEND.get(id)||L.get(id);if(!r||r.st!=="pend")return;
 let note="";if(!ok){note=(prompt(`سبب رفض هدية ${r.no}؟`)||"").trim().slice(0,300);if(!note){X.toast("يجب كتابة سبب الرفض");return}}
 else if(!confirm(`اعتماد هدية ${r.no} (${r.brn||brName(r.br)} · ${N(r.pcs)} قطعة)؟`))return;
 const ap={e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60),at:Date.now()};if(note)ap.note=note;
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),{st:ok?"ok":"no",ap}),15000);if(X.ping)X.ping([id]);X.toast(ok?"اعتُمدت ✅":"رُفضت")}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح (ربما اعتمدها شخص آخر)":FAIL_MSG[w])}
}
// ---------- السند ----------
async function showImg(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);
 try{const s=await withTimeout(getDoc(doc(X.db,"giftimg",id)),15000);const im=s.exists()?s.data().img:"";
  if(!im){X.toast("لا توجد صورة سند (ربما حُذفت)");return}
  zoomOpen(im,`سند ${r?r.no:""} · ${r?(r.brn||brName(r.br)):""}`,`giftimg/${id}/img`);
 }catch(e){X.toast(e&&e.code==="permission-denied"?"غير مسموح لك برؤية هذا السند":"تعذر تحميل السند، تأكد من الإنترنت")}
}
// ---------- التقارير ----------
function reportRows(){return filtered()}
function printReport(){
 const rs=reportRows(),ok=rs.filter(r=>r.st==="ok"),per={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=N(r.pcs)});
 const who=F.br?brName(F.br):"كل الفروع والمستودع",stl=F.st?STL[F.st]:"كل الحالات";
 printStmt(`<div class="st"><div class="ph"><h2>تقرير الهدايا والعينات</h2><div>${E(today())}</div></div>
 <div class="rt"><div><small>الفرع</small><b><bdi dir="ltr">${E(who)}</bdi></b></div><div><small>الفترة</small><b style="font-size:11pt">${E(F.from||"—")} ← ${E(F.to||today())}</b></div><div><small>الحالة</small><b style="font-size:11pt">${E(stl)}</b></div></div>
 ${Object.keys(per).length?`<table class="stt" style="margin-bottom:5mm"><thead><tr><th>الفرع</th><th>عدد المعتمد</th><th>قطع</th></tr></thead><tbody>${Object.entries(per).map(([k,v])=>`<tr><td>${E(brName(k))}</td><td class="n">${v.n}</td><td class="n">${fmt(v.p)}</td></tr>`).join("")}</tbody></table>`:""}
 <table class="stt"><thead><tr><th>#</th><th>التاريخ</th><th>الفرع</th><th>الرقم</th><th>المستلم</th><th>السبب</th><th>الأصناف</th><th>قطع</th><th>الحالة</th><th>سجّلها / اعتمدها</th></tr></thead><tbody>
 ${rs.map((r,i)=>`<tr><td>${i+1}</td><td>${E(r.dt||"")}</td><td>${E(r.brn||brName(r.br))}</td><td>${E(r.no)}</td><td>${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?"<br>"+E(r.to.ph):""}</td><td>${E(r.why||"")}${r.note?"<br>"+E(r.note):""}</td><td>${E(itemsTxt(r))}</td><td class="n">${N(r.pcs)}</td><td>${E((STL[r.st]||"").replace(/^\S+\s/,""))}${r.st==="no"&&r.ap&&r.ap.note?"<br>"+E(r.ap.note):""}</td><td>${E(r.by&&r.by.n||"")}${r.ap&&r.ap.n?"<br>"+E(r.ap.n):""}</td></tr>`).join("")||'<tr><td colspan="10" style="text-align:center">لا توجد هدايا</td></tr>'}</tbody></table>
 <div class="tt"><span>العدد ${rs.length}</span><span>المعتمد ${ok.length}</span><span><b>قطع معتمدة ${fmt(ok.reduce((s,r)=>s+N(r.pcs),0))}</b></span></div>
 <div class="sg"><span>المحاسب</span><span>مدير المستودع</span><span>المدير</span></div></div>`);
}
function csv(){
 const rs=reportRows(),q=v=>{const s=String(v==null?"":v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const head=["التاريخ","الوقت","الفرع","الرقم","المستلم","جوال المستلم","السبب","ملاحظة","الأصناف","عدد القطع","الحالة","سجّلها","اعتمدها/رفضها","وقت الاعتماد","سبب الرفض","فيه سند"];
 const lines=rs.map(r=>[r.dt,new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),r.brn||brName(r.br),r.no,r.to&&r.to.n,r.to&&r.to.ph?`="${r.to.ph}"`:"",r.why,r.note,itemsTxt(r),N(r.pcs),(STL[r.st]||"").replace(/^\S+\s/,""),r.by&&r.by.n,r.ap&&r.ap.n,r.ap&&r.ap.at?new Date(N(r.ap.at)).toLocaleString("en-GB"):"",r.st==="no"&&r.ap?r.ap.note:"",r.img?"نعم":"لا"].map(q).join(","));
 const blob=new Blob(["﻿"+[head.join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`tasooma-gifts-${F.br||"all"}-${F.from}-${F.to}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-gf]");if(!t||!X)return;const a=t.dataset.gf,id=t.dataset.id;
 if(a==="bopen")return void openBranch();
 if(a==="close")return void closeM();
 if(a==="new")return void form(null);
 if(a==="addrow"){const w=g("gfrows");if(w&&w.children.length<100)w.insertAdjacentHTML("beforeend",rowHtml());return}
 if(a==="rmrow"){const w=g("gfrows"),row=t.closest(".gf-row");if(w&&row&&w.children.length>1)row.remove();return}
 if(a==="save")return void save();
 if(a==="img")return void showImg(id);
 if(a==="ok"||a==="no")return void decide(id,a==="ok");
 if(a==="print")return void printReport();
 if(a==="csv")return void csv();
 if(a==="edit"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(r)form(r);return}
 if(a==="del"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!confirm(`حذف هدية ${r.no} نهائياً مع السند الخاص بها؟`))return;
  try{const b=writeBatch(X.db);b.delete(doc(X.db,"gifts",id));b.delete(doc(X.db,"giftimg",id));await withTimeout(b.commit(),15000);L.delete(id);OLD.delete(id);PEND.delete(id);X.toast("حُذفت");if(X.redraw)X.redraw()}
  catch(e){X.toast("تعذر الحذف")}}
}
function change(e){
 const id=e.target&&e.target.id;if(!X||!["gff","gft","gfb","gfs"].includes(id))return;
 if(id==="gff")F.from=e.target.value;if(id==="gft")F.to=e.target.value;if(id==="gfb")F.br=e.target.value;if(id==="gfs")F.st=e.target.value;
 if(F.from&&F.to&&F.from>F.to)[F.from,F.to]=[F.to,F.from];
 ensureRange().then(()=>X.redraw());
}
