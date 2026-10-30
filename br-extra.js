// صفحة الفرع: تأكيد الاستلام + العهدة + التنبيهات
import {collection,doc,setDoc,deleteDoc,updateDoc,onSnapshot,query,where,withTimeout} from "./fb.js";
import {calc,CATS,E,N,fmt,today,SL,shrink,stmtHtml,printStmt,ensurePrintCss} from "./cust.js";
import {notify,beep,badge,wireButtons,regSW} from "./notify.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
let X=null,L=[],S=[],un=[],view="req",pL=null,pS=null,rcvId=null,imgBusy=false;
const CSS=`
#nv{display:none;gap:8px;margin:0 0 12px}.lock #nv{display:flex}
#nv .nb{flex:1;background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:10px 8px;cursor:pointer;font:inherit;font-weight:700;color:var(--ink)}
#nv .nb.on{background:var(--btn);color:var(--btnink);border-color:var(--btn)}
#me .tl{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#me .tl button{font-size:13px}
#cv{display:none}body.vc #cv{display:block}
body.vc .sheet,body.vc #my,body.vc .hist,body.vc .tip,body.vc .act,body.vc .sb{display:none!important}
.cb{background:var(--btn);color:var(--btnink);border-radius:18px;padding:20px 22px;margin-bottom:14px}
.cb small{opacity:.75;display:block}.cb .bg{font-size:40px;font-weight:700;line-height:1.2;direction:ltr;text-align:right}
.cb .sub{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:14px;opacity:.9}
.cb.neg .bg{color:#ff8a80}
.ca{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.ca .b{padding:13px 10px}
.cpn{background:var(--card);border-radius:16px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,.05)}.cpn h3{margin:0 0 8px;font-size:17px}
.er1{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 2px;border-bottom:1px solid var(--line);flex-wrap:wrap}.er1:last-child{border:0}
.er1 small{display:block;color:var(--mut);font-size:12.5px}.er1 .am{font-weight:700;font-size:17px;direction:ltr}.am.in{color:#2f8f3e}.am.ex{color:#c4362b}
.sc2{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:#f6edd2;color:#6b5314}.sc2.approved{background:#d8efd9;color:#1d5a24}.sc2.rejected{background:#f8d9d5;color:#8a2218}
.xb{background:none;border:0;cursor:pointer;font-size:17px;padding:2px 6px}
.xm{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);overflow:auto;padding:16px}.xm.on{display:block}
.xk{max-width:520px;margin:4vh auto;background:var(--card);border-radius:18px;padding:20px}.xk h3{margin:0 0 10px}.xk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}
.xk input,.xk select,.xk textarea{width:100%;background:var(--field);border:1.5px solid transparent;border-radius:11px;padding:10px 12px;font:inherit;color:var(--ink)}
.xk .row{display:flex;gap:10px;margin-top:16px}.xk .row .b{flex:1}
.xk table{width:100%;border-collapse:collapse;font-size:14px}.xk th{text-align:right;color:var(--mut);font-weight:500;padding:4px;border-bottom:2px solid var(--acc);font-size:12.5px}.xk td{padding:5px 4px;border-bottom:1px solid var(--line)}.xk td input{padding:6px;text-align:center;width:64px;font-weight:700}
.xk img.rc{max-width:100%;border-radius:10px}
.mr{flex-wrap:wrap}.rcvb{background:var(--btn);color:var(--btnink);border:0;border-radius:10px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer}
.chp.recv{background:#d8efd9;color:#1d5a24}.rcn{font-size:12.5px;color:#8a2218;font-weight:700}
@media (prefers-color-scheme:dark){.chp.recv{background:#173a1b;color:#8fd39a}.sc2{background:#3a3115;color:#e8cf8a}.sc2.approved{background:#173a1b;color:#8fd39a}.sc2.rejected{background:#40191a;color:#f1a5a0}}
`;
function ui(){
 if(!g("cx-css")){const s=document.createElement("style");s.id="cx-css";s.textContent=CSS;document.head.appendChild(s)}
 ensurePrintCss();
 if(!g("pa")){const p=document.createElement("div");p.id="pa";document.body.appendChild(p)}
 if(!g("nv")){
  const nv=document.createElement("div");nv.id="nv";
  nv.innerHTML=`<button class="nb on" data-v="req" type="button">📦 طلب بضاعة</button><button class="nb" data-v="cus" type="button">💰 العهدة</button>`;
  g("me").after(nv);
  const cv=document.createElement("div");cv.id="cv";nv.after(cv);
  nv.onclick=e=>{const b=e.target.closest("[data-v]");if(b)setView(b.dataset.v)};
  const mx=g("mx");const tl=document.createElement("div");tl.className="tl";
  tl.innerHTML=`<button id="bell" type="button" hidden></button><button data-install type="button" hidden>📲 تثبيت التطبيق</button>`;
  mx.before(tl);tl.appendChild(mx);
  const bell=g("bell");bell.hidden=false;wireButtons();
  const xm=document.createElement("div");xm.id="xm";xm.className="xm";document.body.appendChild(xm);
  xm.onclick=e=>{if(e.target===xm)closeX()};
  g("ml").addEventListener("click",e=>{const b=e.target.closest("[data-rcv]");if(b)openRcv(b.dataset.rcv)});
 }
}
function setView(v){view=v;document.body.classList.toggle("vc",v==="cus");document.querySelectorAll("#nv .nb").forEach(b=>b.classList.toggle("on",b.dataset.v===v));if(v==="cus")draw();window.scrollTo(0,0)}
const closeX=()=>{g("xm").className="xm";g("xm").innerHTML=""};
const openX=h=>{g("xm").innerHTML=`<div class="xk">${h}</div>`;g("xm").className="xm on"};

// ---------- تأكيد الاستلام ----------
function openRcv(id){
 const r=(X.reqs()||{})[id];if(!r||r.st!=="done")return;rcvId=id;
 const rows=(Array.isArray(r.rows)?r.rows:[]).slice(0,400);
 openX(`<h3>تأكيد استلام طلب <bdi dir="ltr">${E(r.no)}</bdi></h3><p style="margin:0 0 8px;color:var(--mut);font-size:14px">لو كل حاجة وصلت زي ما هي اضغط تأكيد مباشرة. لو فيه نقص أو تالف اكتب الكمية اللي استلمتها فعلاً.</p>
 <div style="max-height:46vh;overflow:auto"><table><thead><tr><th>الكود</th><th>اللون</th><th>المقاس</th><th>مطلوب</th><th>استلمت</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td><bdi dir="ltr">${E(x.k)}</bdi></td><td><bdi dir="ltr">${E(x.c||"-")}</bdi></td><td>${E(x.z||"")}</td><td><b>${N(x.q)}</b></td><td><input data-i="${i}" type="number" inputmode="numeric" min="0" max="99999" value="${N(x.q)}"></td></tr>`).join("")}</tbody></table></div>
 <label for="rn">ملاحظات (تالف، ناقص، مختلف...)</label><textarea id="rn" rows="2" maxlength="500" placeholder="اختياري"></textarea>
 <div class="row"><button class="b" id="rc0" type="button">رجوع</button><button class="b p" id="rc1" type="button">✅ تأكيد الاستلام</button></div>`);
 g("rc0").onclick=closeX;
 g("rc1").onclick=async()=>{
  const lines=[];document.querySelectorAll("#xm input[data-i]").forEach(inp=>{
   const i=+inp.dataset.i,x=rows[i],v=Math.max(0,Math.min(99999,Math.round(+toEn(inp.value)||0)));
   if(v!==N(x.q))lines.push({k:String(x.k||"").slice(0,40),c:String(x.c||"").slice(0,40),z:String(x.z||"").slice(0,20),q:N(x.q),r:v});
  });
  const note=g("rn").value.trim().slice(0,500),rcv={at:Date.now(),ok:!lines.length&&!note,lines,note};
  if(!note)delete rcv.note;
  g("rc1").disabled=true;
  try{await withTimeout(updateDoc(doc(X.db,"requests",id),{st:"recv",rcv}),15000);closeX();X.toast(rcv.ok?"تم تأكيد الاستلام ✅":"تم تسجيل الاستلام مع الملاحظات ✅")}
  catch(e){g("rc1").disabled=false;X.toast(e&&e.code==="permission-denied"?"مش مسموح. ممكن المستودع غيّر حالة الطلب.":"لم يتم الحفظ، جرّب تاني","er")}
 };
}

// ---------- العهدة ----------
function draw(){
 if(view!=="cus"||!X)return;
 const c=calc(L,S),pendS=S.find(s=>s.st==="pending"),locked=new Set(pendS&&Array.isArray(pendS.ids)?pendS.ids:[]);
 const hist=S.slice().sort((a,b)=>N(b.ts)-N(a.ts));
 const ent=L.filter(e=>!e.sid).sort((a,b)=>N(b.ts)-N(a.ts));
 g("cv").innerHTML=`<div class="cb ${c.bal<0?"neg":""}"><small>رصيد العهدة الحالي</small><div class="bg">${fmt(c.bal)}</div><div class="sub"><span>افتتاحي ${fmt(c.opening)}</span><span>عهدة +${fmt(c.ins)}</span><span>مصروفات −${fmt(c.exps)}</span>${c.pin?`<span>عهدة بانتظار الاعتماد ${fmt(c.pin)}</span>`:""}</div></div>
 <div class="ca"><button class="b p" id="cx1" type="button">➕ تسجيل مصروف</button><button class="b" id="cx2" type="button">💵 استلمت عهدة</button><button class="b" id="cx3" type="button" ${pendS||!c.open.length?"disabled":""}>🧾 طلب تسوية العهدة</button><button class="b" id="cx4" type="button">🖨 كشف الحساب</button></div>
 ${pendS?`<div class="cpn" style="border:1.5px solid var(--acc)">طلب التسوية <bdi dir="ltr">${E(pendS.no)}</bdi> بانتظار اعتماد المستودع — الرصيد ${fmt(pendS.bal)}</div>`:""}
 <div class="cpn"><h3>حركات العهدة الحالية</h3>${ent.length?ent.map(e=>`<div class="er1"><div><b>${E(e.cat||"")}</b> <span class="sc2 ${E(e.st)}">${SL[e.st]||""}</span><small>${E(e.dt)}${e.note?" · "+E(e.note):""}</small></div><div style="display:flex;gap:6px;align-items:center"><span class="am ${e.type==="in"?"in":"ex"}">${e.type==="in"?"+":"−"}${fmt(e.amt)}</span>${e.img?`<button class="xb" data-img="${E(e.id)}" type="button" title="الإيصال">📎</button>`:""}${e.st==="pending"&&!locked.has(e.id)?`<button class="xb" data-del="${E(e.id)}" type="button" title="حذف">🗑</button>`:""}</div></div>`).join(""):'<small style="color:var(--mut)">مفيش حركات لسه.</small>'}</div>
 <div class="cpn"><h3>التسويات السابقة</h3>${hist.length?hist.map(s=>`<div class="er1"><div><b><bdi dir="ltr">${E(s.no)}</bdi></b> <span class="sc2 ${E(s.st)}">${SL[s.st]||""}</span><small>${E(s.from)} ← ${E(s.to)} · الرصيد ${fmt(s.bal)}${s.rnote?" · "+E(s.rnote):""}</small></div>${s.st==="approved"?`<button class="b sm2" data-ps="${E(s.id)}" type="button">🖨 طباعة</button>`:""}</div>`).join(""):'<small style="color:var(--mut)">لا توجد تسويات.</small>'}</div>`;
 g("cx1").onclick=()=>entryForm("exp");g("cx2").onclick=()=>entryForm("in");
 g("cx3").onclick=reqSettle;g("cx4").onclick=()=>printStmt(stmtHtml({brn:X.brn(),title:"كشف حساب العهدة (الفترة الحالية)",opening:c.opening,rows:c.open,from:c.open[0]?c.open[0].dt:today(),to:today()},X.logo));
 g("cv").querySelectorAll("[data-img]").forEach(b=>b.onclick=()=>{const e=L.find(x=>x.id===b.dataset.img);if(e&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(e.img||""))openX(`<h3>إيصال ${E(e.cat)}</h3><img class="rc" alt="" src="${e.img}"><div class="row"><button class="b" id="xc" type="button">إغلاق</button></div>`),g("xc").onclick=closeX});
 g("cv").querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!(await X.ask({i:"🗑",t:"حذف الحركة؟",p:"مش هترجع تاني.",ok:"احذف"})))return;try{await deleteDoc(doc(X.db,"ledger",b.dataset.del))}catch(e){X.toast("تعذر الحذف","er")}});
 g("cv").querySelectorAll("[data-ps]").forEach(b=>b.onclick=()=>printSettle(b.dataset.ps));
}
function printSettle(id){
 const s=S.find(x=>x.id===id);if(!s)return;
 const rows=L.filter(e=>e.sid===id);
 printStmt(stmtHtml({brn:X.brn(),title:"كشف تسوية العهدة "+s.no,opening:N(s.opening),rows,from:s.from,to:s.to},X.logo));
}
function entryForm(type){
 const ex=type==="exp";imgBusy=false;let img="";
 openX(`<h3>${ex?"تسجيل مصروف":"تسجيل عهدة مستلمة"}</h3>
 <label for="ea">المبلغ</label><input id="ea" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off">
 ${ex?`<label for="ec">البند</label><select id="ec">${CATS.map(c=>`<option>${E(c)}</option>`).join("")}</select>`:""}
 <label for="ed">التاريخ</label><input id="ed" type="date" value="${today()}">
 <label for="en">${ex?"البيان (اختياري)":"ملاحظة (مثلاً: استلمتها من فلان)"}</label><input id="en" type="text" maxlength="300">
 ${ex?`<label for="ef">صورة الإيصال (اختياري)</label><input id="ef" type="file" accept="image/*"><small id="eh" style="color:var(--mut)"></small>`:""}
 <div class="row"><button class="b" id="e0" type="button">رجوع</button><button class="b p" id="e1" type="button">حفظ</button></div>
 ${ex?"":'<p style="font-size:12.5px;color:var(--mut);margin:10px 0 0">العهدة بتتحسب في رصيدك بعد ما المستودع يعتمدها.</p>'}`);
 g("e0").onclick=closeX;
 if(ex)g("ef").onchange=async()=>{const f=g("ef").files[0];img="";if(!f)return;imgBusy=true;g("eh").textContent="جاري ضغط الصورة...";try{img=await shrink(f);g("eh").textContent="تم تجهيز الصورة ✅"}catch(e){g("ef").value="";g("eh").textContent="الصورة مش صالحة، جرّب صورة تانية"}imgBusy=false};
 g("e1").onclick=async()=>{
  if(imgBusy){X.toast("استنى الصورة تخلص","er");return}
  const amt=Math.round(N(toEn(g("ea").value))*100)/100;
  if(!(amt>0)||amt>1000000){X.toast("اكتب مبلغ صحيح","er");return}
  const dt=g("ed").value||today();
  const e={br:X.code(),type,amt,cat:ex?g("ec").value:"عهدة",dt,ts:Date.now(),st:"pending"};
  const note=g("en").value.trim().slice(0,300);if(note)e.note=note;if(img)e.img=img;
  g("e1").disabled=true;
  try{await withTimeout(setDoc(doc(collection(X.db,"ledger")),e),15000);closeX();X.toast(ex?"تم تسجيل المصروف":"تم تسجيل العهدة — بانتظار اعتماد المستودع")}
  catch(x){g("e1").disabled=false;X.toast(x&&x.code==="permission-denied"?"مش مسموح بالحفظ":"لم يتم الحفظ، جرّب تاني","er")}
 };
}
async function reqSettle(){
 const c=calc(L,S);if(!c.open.length||S.some(s=>s.st==="pending"))return;
 const ids=c.open.map(e=>e.id).slice(0,500);
 if(c.pin>0){X.toast("فيه عهدة بانتظار اعتماد المستودع. استنى اعتمادها الأول.","er");return}
 const ok=await X.ask({i:"🧾",t:"طلب تسوية العهدة؟",p:`مصروفات ${fmt(c.exps)} · عهدة ${fmt(c.ins)} · الرصيد المتبقي ${fmt(c.bal)}`,ok:"أرسل للتسوية"});
 if(!ok)return;
 const d=new Date(),p=n=>String(n).padStart(2,"0");
 const s={br:X.code(),no:`S-${X.code()}-${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,from:c.open[0].dt,to:today(),opening:c.opening,ins:c.ins,exps:c.exps,bal:c.bal,ids,st:"pending",ts:Date.now()};
 try{await withTimeout(setDoc(doc(collection(X.db,"settlements")),s),15000);X.toast("اتبعت طلب التسوية للمستودع")}
 catch(e){X.toast("لم يتم الإرسال، جرّب تاني","er")}
}
function note(t,b,tag){X.toast(b?t+": "+b:t);notify(t,b,tag);if(document.hidden)beep()}
export function initBranch(ctx){
 X=ctx;ui();stopBranch(true);L=[];S=[];pL=null;pS=null;
 const c=X.code();
 un.push(onSnapshot(query(collection(X.db,"ledger"),where("br","==",c)),sn=>{
  L=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pL)L.forEach(e=>{const o=pL[e.id];if(o&&o!==e.st&&e.st!=="pending")note(e.st==="approved"?"✅ اتعتمد":"❌ اترفض",`${e.type==="in"?"عهدة":"مصروف"} ${fmt(e.amt)}`,"l"+e.id)});
  pL={};L.forEach(e=>pL[e.id]=e.st);draw();
 },()=>{}));
 un.push(onSnapshot(query(collection(X.db,"settlements"),where("br","==",c)),sn=>{
  S=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pS)S.forEach(s=>{const o=pS[s.id];if(o&&o!==s.st&&s.st!=="pending")note(s.st==="approved"?"✅ اتعتمدت التسوية":"❌ اترفضت التسوية",s.no,"s"+s.id)});
  pS={};S.forEach(s=>pS[s.id]=s.st);draw();
 },()=>{}));
 setView("req");
}
export function stopBranch(soft){un.forEach(f=>f());un=[];if(!soft){L=[];S=[];view="req";document.body.classList.remove("vc");closeX&&g("xm")&&closeX()}}
export {note as branchNote};
regSW();
