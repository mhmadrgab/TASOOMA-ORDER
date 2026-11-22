// 💼 عهدة الفروع (v218، 22 نوفمبر 2026، طلب محمد: «ضيف مديول العهدة لكل الفروع»، والطريقة اللي وافق عليها):
//   الفرع: يسجّل مصروفاته (البند، المبلغ، التاريخ، صورة الفاتورة إجبارياً) ويرى رصيده وكشف حسابه، ويعدّل أو يحذف ما لم يُراجَع.
//   المستودع (المدير وصلاحية العهدة؛ المتابع يرى فقط): يسلّم مبالغ للفرع، يراجع كل مصروف (معتمد / مرفوض بسبب)، ويقفل الفترة فيُرحَّل الرصيد.
//   bled/{id} = {br, k: in|out, amt, dt, cat?, note?, img?:1, by:{e,n}, ts, st: pend|ok|no, rv?:{e,n,at,note?}, o: 1 مفتوح|0 مقفول, sid?}
//   bledimg/{id} = {img} صورة الفاتورة · bset/{id} = {br, at, bal, cnt, by, ts, from?}. القواعد في 002_rules.sql (v218).
//   الرصيد = آخر إقفال + ما سُلِّم في الفترة − المصروف المعتمد. المرفوض لا يُخصم، والمنتظر يظهر منفصلاً.
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {zoomOpen} from "./zoom.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>Number.isFinite(+v)?+v:0;
const g=id=>document.getElementById(id);
const money=v=>(Math.round(N(v)*100)/100).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});
const today=()=>new Date().toLocaleDateString("en-CA");
const dmy=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?m[3]+"/"+m[2]+"/"+m[1]:""};
const dts=t=>{if(!t)return "";const d=new Date(N(t));return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"})};
const CATS=["نظافة","ضيافة","صيانة بسيطة","مواصلات","مستلزمات مكتبية","كهرباء وماء","مشتريات للفرع","أخرى"];
const STL={pend:"بانتظار المراجعة",ok:"معتمد",no:"مرفوض"};
let X=null,OPEN=new Map(),SETS=new Map(),UN=[],ON=false,SEL="",VIEW=null,BUSY=false;
const CSS=`
.bcx{display:block}
.bcx-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}.bcx-h h2,.bcx-h h3{margin:0;flex:1;min-width:0}
.bcx-t{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}
.bcx-t>div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
.bcx-t small{display:block;color:var(--mut);font-size:12.5px}.bcx-t b{display:block;font-size:20px;font-weight:800;direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
.bcx-t .neg b{color:#b03a2e}.bcx-t .pend b{color:#b36b1e}
.bcx-l{width:100%;border-collapse:collapse;font-size:14px;background:var(--card);border-radius:14px;overflow:hidden}
.bcx-l th{text-align:start;font-size:12px;color:var(--mut);font-weight:600;padding:8px;border-bottom:1px solid var(--line)}
.bcx-l td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.bcx-l td.n{direction:ltr;text-align:right;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
.bcx-l tr.in td.n{color:#4c6b2a}.bcx-l tr.no td{opacity:.6}.bcx-l tr.no td.n{text-decoration:line-through}
.bcx-s{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.bcx-s.pend{background:#fff1dc;color:#8a5212}.bcx-s.ok{background:#e6efd9;color:#3f5a20}.bcx-s.no{background:#fde2df;color:#8a2218}.bcx-s.in{background:#e3ecf7;color:#1d4f86}
.bcx-a{display:flex;gap:6px;flex-wrap:wrap}.bcx-a .bt,.bcx-a .b{padding:4px 10px;font-size:12.5px;min-height:0}
.bcx-r{display:block;font-size:12px;color:var(--mut);margin-top:2px}
.bcx-e{margin:14px 0;padding:14px;border:1px dashed var(--line);border-radius:14px;text-align:center;color:var(--mut)}
.bcx-p{margin-top:16px}.bcx-p h4{margin:0 0 8px}
.bcx-br{width:100%;border-collapse:collapse;font-size:14px;background:var(--card)}
.bcx-br td,.bcx-br th{padding:8px;border-bottom:1px solid var(--line);text-align:start}.bcx-br td.n{direction:ltr;text-align:right;font-weight:800}
.bcx-br tr[data-bx]{cursor:pointer}.bcx-br tr[data-bx]:hover td{background:rgba(138,90,131,.06)}
#bcxm{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;background:rgba(20,12,20,.5);padding:16px}
#bcxm.on{display:flex}#bcxm>div{background:var(--card);color:var(--ink);border-radius:18px;padding:18px;width:min(460px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
#bcxm h3{margin:0 0 12px}#bcxm label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}#bcxm input,#bcxm select,#bcxm textarea{width:100%;box-sizing:border-box}
#bcxm .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}#bcxm .pv{margin-top:8px;max-width:100%;max-height:180px;border-radius:10px;display:block}
@media (max-width:640px){.bcx-t{grid-template-columns:1fr 1fr}.bcx-l thead{display:none}.bcx-l,.bcx-l tbody,.bcx-l tr,.bcx-l td{display:block;width:100%;box-sizing:border-box}
 .bcx-l tr{border-bottom:1px solid var(--line);padding:6px 4px}.bcx-l td{border:0;padding:3px 8px}.bcx-l td.n{text-align:start}}
@media print{.bcx .bcx-a,.bcx-h .b,.bcx-h .bt{display:none!important}}
`;
const css=()=>{if(!g("bcx-css")){const s=document.createElement("style");s.id="bcx-css";s.textContent=CSS;document.head.appendChild(s)}};
const isWh=()=>X&&X.mode==="wh";
const canAct=()=>isWh()&&X.staff===true;
const brName=c=>{const L=(X&&X.branches?X.branches():[]).map(String);return L.find(b=>b.split("-")[0]===c)||c};
// ctx: {db, toast, mode:"branch"|"wh", code?, brn?, me:{e,n}, staff?:bool, branches?:()=>[...], redraw?:()=>void}
export function initBCus(ctx){
 stopBCus();X=ctx;css();
 document.addEventListener("click",onClick);document.addEventListener("change",onChange);
 if(X.mode==="branch"){let h=g("bcus");if(!h){h=document.createElement("div");h.id="bcus";h.className="bcx";const w=document.querySelector(".w"),hist=g("hist");if(w)w.insertBefore(h,hist?hist.nextSibling:null)}start()}
}
export function stopBCus(){UN.forEach(f=>{try{f()}catch(e){}});UN=[];ON=false;OPEN=new Map();SETS=new Map();VIEW=null;SEL="";BUSY=false;
 document.removeEventListener("click",onClick);document.removeEventListener("change",onChange);
 const h=g("bcus");if(h)h.remove();const m=g("bcxm");if(m)m.remove();X=null}
function start(){
 if(ON||!X)return;ON=true;
 const qo=X.mode==="branch"?query(collection(X.db,"bled"),where("br","==",X.code),where("o","==",1)):query(collection(X.db,"bled"),where("o","==",1));
 const qs=X.mode==="branch"?query(collection(X.db,"bset"),where("br","==",X.code)):collection(X.db,"bset");
 const err=()=>{if(X)X.toast("تعذّرت قراءة العهدة. ربما لم تتحدّث القواعد بعد","er")};
 UN.push(onSnapshot(qo,s=>{OPEN=new Map();s.docs.forEach(d=>OPEN.set(d.id,Object.assign({id:d.id},d.data())));paint()},err));
 UN.push(onSnapshot(qs,s=>{SETS=new Map();s.docs.forEach(d=>SETS.set(d.id,Object.assign({id:d.id},d.data())));paint()},()=>{}));
}
function paint(){if(!X)return;if(X.mode==="branch"){const h=g("bcus");if(h)h.innerHTML=branchHtml()}else if(X.redraw)X.redraw()}
// الحساب لفرع: آخر إقفال + المفتوح
function calc(br){
 const sets=[...SETS.values()].filter(s=>s.br===br).sort((a,b)=>N(b.at)-N(a.at)),last=sets[0]||null;
 const L=[...OPEN.values()].filter(r=>r.br===br);
 const inn=L.filter(r=>r.k==="in").reduce((a,r)=>a+N(r.amt),0),ok=L.filter(r=>r.k==="out"&&r.st==="ok").reduce((a,r)=>a+N(r.amt),0);
 const pend=L.filter(r=>r.k==="out"&&r.st==="pend"),pendA=pend.reduce((a,r)=>a+N(r.amt),0);
 const open=last?N(last.bal):0;
 return {last,sets,L,open,inn,ok,pend:pend.length,pendA,bal:Math.round((open+inn-ok)*100)/100};
}
function tiles(c){
 return `<div class="bcx-t"><div class="${c.bal<0?"neg":""}"><small>الرصيد الآن</small><b>${money(c.bal)}</b></div><div><small>استُلم في هذه الفترة</small><b>${money(c.inn)}</b></div><div><small>المصروف المعتمد</small><b>${money(c.ok)}</b></div><div class="pend"><small>بانتظار المراجعة (${c.pend})</small><b>${money(c.pendA)}</b></div></div>
 <p class="off" style="margin:0 0 12px;font-size:13px">${c.last?`الرصيد الافتتاحي <b dir="ltr">${money(c.open)}</b> من إقفال ${E(dts(c.last.at))}`:"لا توجد فترة مقفولة بعد: الرصيد الافتتاحي صفر"}</p>`;
}
function rowsHtml(L,br,closed){
 const R=L.slice().sort((a,b)=>String(b.dt).localeCompare(String(a.dt))||N(b.ts)-N(a.ts));
 if(!R.length)return `<div class="bcx-e">${closed?"لا حركات في هذه الفترة":"لا حركات في الفترة المفتوحة بعد"}</div>`;
 return `<div style="overflow-x:auto"><table class="bcx-l"><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>${R.map(r=>{
  const inn=r.k==="in",st=inn?`<span class="bcx-s in">تسليم عهدة</span>`:`<span class="bcx-s ${E(r.st)}">${E(STL[r.st]||r.st)}</span>`;
  const why=r.st==="no"&&r.rv&&r.rv.note?`<span class="bcx-r">السبب: <span data-notr>${E(r.rv.note)}</span></span>`:r.rv&&r.rv.n?`<span class="bcx-r">${r.st==="ok"?"اعتمده":"رفضه"} <span data-notr>${E(r.rv.n)}</span></span>`:"";
  const acts=[];
  if(r.img)acts.push(`<button type="button" class="b" data-bx="img" data-i="${E(r.id)}">📎 الفاتورة</button>`);
  if(!closed&&!isWh()&&r.k==="out"&&r.st==="pend"){acts.push(`<button type="button" class="b" data-bx="edit" data-i="${E(r.id)}">تعديل</button>`);acts.push(`<button type="button" class="b" data-bx="del" data-i="${E(r.id)}">حذف</button>`)}
  if(!closed&&canAct()&&r.k==="out"){if(r.st!=="ok")acts.push(`<button type="button" class="bt g" data-bx="ok" data-i="${E(r.id)}">✅ اعتماد</button>`);if(r.st!=="no")acts.push(`<button type="button" class="bt" data-bx="no" data-i="${E(r.id)}">❌ رفض</button>`)}
  if(!closed&&canAct()&&inn)acts.push(`<button type="button" class="bt" data-bx="idel" data-i="${E(r.id)}">حذف</button>`);
  return `<tr class="${inn?"in":E(r.st)}"><td>${E(dmy(r.dt))}</td><td><b data-notr>${E(inn?"استلام عهدة":r.cat||"")}</b>${r.note?`<span class="bcx-r" data-notr>${E(r.note)}</span>`:""}<span class="bcx-r">بواسطة <span data-notr>${E(r.by&&r.by.n||"")}</span></span>${why}</td><td class="n">${inn?"+":"−"}${money(r.amt)}</td><td>${st}</td><td><div class="bcx-a">${acts.join("")}</div></td></tr>`}).join("")}</tbody></table></div>`;
}
function setsHtml(c,br){
 if(!c.sets.length)return "";
 return `<div class="bcx-p"><h4>🔒 الفترات المقفولة</h4><div style="overflow-x:auto"><table class="bcx-br"><thead><tr><th>تاريخ الإقفال</th><th>الرصيد المرحَّل</th><th>الحركات</th><th>بواسطة</th></tr></thead><tbody>${c.sets.map(s=>`<tr data-bx="set" data-i="${E(s.id)}" data-b="${E(br)}"><td>${E(dts(s.at))}</td><td class="n">${money(s.bal)}</td><td>${N(s.cnt)}</td><td data-notr>${E(s.by&&s.by.n||"")}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function viewHtml(){
 if(!VIEW)return "";const s=SETS.get(VIEW.id);
 return `<div class="pan bcx-p"><div class="bcx-h"><h3>🔒 فترة مقفولة ${s?E(dts(s.at)):""} · الرصيد المرحَّل <span dir="ltr">${s?money(s.bal):""}</span></h3><button type="button" class="b" data-bx="vx">إغلاق</button></div>${VIEW.L?rowsHtml(VIEW.L,VIEW.br,true):`<p class="off">جاري التحميل…</p>`}</div>`;
}
function branchHtml(){
 const c=calc(X.code);
 return `<div class="bcx-h"><h2>💼 عهدة الفرع</h2><button type="button" class="b p" data-bx="new">➕ تسجيل مصروف</button><button type="button" class="b" data-bx="csv" data-b="${E(X.code)}">⬇️ إكسل</button></div>${tiles(c)}${rowsHtml(c.L,X.code,false)}${viewHtml()}${setsHtml(c,X.code)}
 <p class="off" style="font-size:12.5px;margin-top:14px">صورة الفاتورة إجبارية مع كل مصروف. يمكنك تعديل المصروف أو حذفه حتى يراجعه المحاسب. يسجّل المحاسب المبالغ التي تستلمها، ويقفل الفترة فيُرحَّل الرصيد.</p>`;
}
// اللوحة: كل الفروع ثم تفاصيل الفرع المختار
export function bcusView(){
 if(!X||!isWh())return "";start();
 const brs=[...new Set([...OPEN.values()].map(r=>r.br).concat([...SETS.values()].map(s=>s.br)))].sort();
 const all=(X.branches?X.branches():[]).map(b=>String(b).split("-")[0]);
 const sum=brs.map(b=>({b,c:calc(b)})),pendT=sum.reduce((a,x)=>a+x.c.pend,0);
 const opt=`<option value="">كل الفروع</option>${all.map(c=>`<option value="${E(c)}"${c===SEL?" selected":""}>‎${E(brName(c))}</option>`).join("")}`;
 const head=`<div class="bcx-h"><h2>💼 عهدة الفروع</h2><select data-bx-sel aria-label="الفرع">${opt}</select>${SEL&&canAct()?`<button type="button" class="b p" data-bx="give">➕ تسليم عهدة للفرع</button><button type="button" class="b" data-bx="close">🔒 إقفال الفترة</button>`:""}${SEL?`<button type="button" class="b" data-bx="csv" data-b="${E(SEL)}">⬇️ إكسل</button>`:""}</div>`;
 if(!SEL)return `<div class="pan bcx">${head}<p class="off" style="margin:0 0 10px">${pendT?`<b>${pendT}</b> مصروف بانتظار المراجعة في كل الفروع. `:""}اختر فرعاً لعرض كشف حسابه${canAct()?" وتسليم عهدة أو المراجعة أو الإقفال":""}.</p>
  ${sum.length?`<div style="overflow-x:auto"><table class="bcx-br"><thead><tr><th>الفرع</th><th>الرصيد الآن</th><th>بانتظار المراجعة</th><th>آخر إقفال</th></tr></thead><tbody>${sum.sort((a,b)=>b.c.pend-a.c.pend||a.b.localeCompare(b.b)).map(x=>`<tr data-bx="pick" data-b="${E(x.b)}"><td data-notr>‎${E(brName(x.b))}</td><td class="n">${money(x.c.bal)}</td><td>${x.c.pend?`<span class="bcx-s pend">${x.c.pend} · ${money(x.c.pendA)}</span>`:"—"}</td><td>${x.c.last?E(dts(x.c.last.at)):"—"}</td></tr>`).join("")}</tbody></table></div>`:`<div class="bcx-e">لا توجد حركات عهدة لأي فرع بعد.${canAct()?" اختر فرعاً وسلّمه عهدة.":""}</div>`}</div>`;
 const c=calc(SEL);
 return `<div class="pan bcx">${head}${tiles(c)}${rowsHtml(c.L,SEL,false)}${viewHtml()}${setsHtml(c,SEL)}</div>`;
}
export const bcusPend=()=>[...OPEN.values()].filter(r=>r.k==="out"&&r.st==="pend").length;
// ---------- النموذج ----------
function modal(h){let m=g("bcxm");if(!m){m=document.createElement("div");m.id="bcxm";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");document.body.appendChild(m)}m.innerHTML=`<div>${h}</div>`;m.className="on";const f=m.querySelector("input,select,textarea");if(f)setTimeout(()=>{try{f.focus()}catch(e){}},60)}
const closeM=()=>{const m=g("bcxm");if(m){m.className="";m.innerHTML=""}BUSY=false};
let IMGD="";
function expForm(r){
 IMGD="";const cat=r?r.cat:"",other=r&&CATS.indexOf(cat)<0;
 modal(`<h3>${r?"تعديل مصروف":"تسجيل مصروف"}</h3>
 <label for="bcx-c">البند</label><select id="bcx-c">${CATS.map(c=>`<option${(other?"أخرى":cat)===c?" selected":""}>${E(c)}</option>`).join("")}</select>
 <div id="bcx-ow"${other?"":" hidden"}><label for="bcx-o">اسم البند</label><input id="bcx-o" maxlength="40" value="${other?E(cat):""}"></div>
 <label for="bcx-a">المبلغ (ريال)</label><input id="bcx-a" type="number" inputmode="decimal" min="0.01" step="0.01" value="${r?E(r.amt):""}" dir="ltr">
 <label for="bcx-d">التاريخ</label><input id="bcx-d" type="date" value="${E(r?r.dt:today())}" max="${today()}">
 <label for="bcx-n">ملاحظة (اختياري)</label><textarea id="bcx-n" rows="2" maxlength="300">${r?E(r.note||""):""}</textarea>
 ${r?"":`<label for="bcx-f">صورة الفاتورة (إجباري)</label><input id="bcx-f" type="file" accept="image/*"><img id="bcx-pv" class="pv" alt="" hidden>`}
 <div class="row"><button type="button" class="b" data-bx="mx">إلغاء</button><button type="button" class="b p" data-bx="${r?"esave":"save"}" data-i="${r?E(r.id):""}">حفظ</button></div>`);
}
function giveForm(){
 modal(`<h3>تسليم عهدة لفرع ‎${E(brName(SEL))}</h3>
 <label for="bcx-a">المبلغ (ريال)</label><input id="bcx-a" type="number" inputmode="decimal" min="0.01" step="0.01" dir="ltr">
 <label for="bcx-d">التاريخ</label><input id="bcx-d" type="date" value="${today()}" max="${today()}">
 <label for="bcx-n">ملاحظة (اختياري)</label><textarea id="bcx-n" rows="2" maxlength="300" placeholder="مثال: عهدة شهر نوفمبر"></textarea>
 <div class="row"><button type="button" class="b" data-bx="mx">إلغاء</button><button type="button" class="b p" data-bx="gsave">حفظ</button></div>`);
}
// صورة الفاتورة: JPEG حتى 1600 بكسل وأقل من 1.2 مليون حرف
function shrink(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);let w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,1600/Math.max(w,h));
 const cv=document.createElement("canvas");let q=.82,d="";for(let t=0;t<6;t++){cv.width=Math.max(1,Math.round(w*k));cv.height=Math.max(1,Math.round(h*k));const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);d=cv.toDataURL("image/jpeg",q);if(d.length<=1200000)break;q-=.12;k*=.8}
 d.length<=1200000&&/^data:image\/jpeg;base64,/.test(d)?ok(d):no(new Error("big"))};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error("img"))};im.src=u})}
function readForm(needCat){
 const c=g("bcx-c")?g("bcx-c").value:"",cat=c==="أخرى"&&g("bcx-o")&&g("bcx-o").value.trim()?g("bcx-o").value.trim().slice(0,40):c;
 const amt=Math.round(N(String(g("bcx-a").value).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)))*100)/100,dt=String(g("bcx-d").value||""),note=String(g("bcx-n").value||"").trim().slice(0,300);
 if(needCat&&!cat){X.toast("اختر البند","er");return null}
 if(!(amt>0)||amt>1000000){X.toast("اكتب مبلغاً صحيحاً","er");return null}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dt)||dt>today()){X.toast("اختر تاريخاً صحيحاً (ليس في المستقبل)","er");return null}
 return {cat,amt,dt,note};
}
async function fail(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما لم تتحدّث القواعد بعد":FAIL_MSG[w]||"تعذّر الحفظ","er")}
function csv(br,L){
 const R=L.slice().sort((a,b)=>String(a.dt).localeCompare(String(b.dt))),c=calc(br);let bal=c.open;
 const q=v=>{let s=String(v==null?"":v);if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 const rows=[["التاريخ","البيان","ملاحظة","وارد","منصرف","الحالة","الرصيد","بواسطة"],["","الرصيد الافتتاحي","","","","","",""]].concat(R.map(r=>{
  if(r.k==="in"||r.st==="ok")bal+=r.k==="in"?N(r.amt):-N(r.amt);
  return [dmy(r.dt),r.k==="in"?"استلام عهدة":r.cat,r.note||"",r.k==="in"?r.amt:"",r.k==="out"?r.amt:"",r.k==="in"?"تسليم":STL[r.st],Math.round(bal*100)/100,r.by&&r.by.n||""]}));
 rows[1][6]=c.open;
 const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=u;a.download=`tasooma-custody-${br}-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function onClick(e){
 const t=e.target.closest&&e.target.closest("[data-bx]");if(!t||!X)return;if(!t.closest("#bcus,#bcxm,.bcx"))return;
 const a=t.dataset.bx,id=t.dataset.i,r=id?OPEN.get(id):null;
 if(a==="new"){expForm(null);return}
 if(a==="mx"){closeM();return}
 if(a==="edit"&&r){expForm(r);return}
 if(a==="img"){const r0=r||(VIEW&&VIEW.L||[]).find(x=>x.id===id);if(!r0)return;
  try{const d=await getDoc(doc(X.db,"bledimg",id)),im=d.exists()?String(d.data().img||""):"";
   if(im)zoomOpen(im,"فاتورة: "+(r0.cat||""));else X.toast("الصورة غير موجودة","er")}catch(x){X.toast("تعذّر فتح الصورة","er")}return}
 if(a==="csv"){const br=t.dataset.b;csv(br,[...OPEN.values()].filter(x=>x.br===br));return}
 if(a==="pick"){SEL=t.dataset.b||"";VIEW=null;if(X.redraw)X.redraw();return}
 if(a==="set"){VIEW={id,br:t.dataset.b,L:null};paint();try{const s=await getDocs(query(collection(X.db,"bled"),where("sid","==",id)));if(VIEW&&VIEW.id===id){VIEW.L=s.docs.map(d=>Object.assign({id:d.id},d.data()));paint()}}catch(x){X.toast("تعذّرت قراءة الفترة","er")}return}
 if(a==="vx"){VIEW=null;paint();return}
 if(a==="give"&&canAct()&&SEL){giveForm();return}
 if(BUSY)return;
 if(a==="save"){const f=readForm(true);if(!f)return;const fi=g("bcx-f")&&g("bcx-f").files&&g("bcx-f").files[0];if(!fi){X.toast("صورة الفاتورة إجبارية","er");return}
  BUSY=true;t.disabled=true;try{const img=await shrink(fi),ref=doc(collection(X.db,"bled")),b=writeBatch(X.db);
   b.set(doc(X.db,"bledimg",ref.id),{img});b.set(ref,Object.assign({br:X.code,k:"out",amt:f.amt,dt:f.dt,cat:f.cat,img:1,by:{e:X.me.e,n:String(X.me.n||"").slice(0,60)},ts:Date.now(),st:"pend",o:1},f.note?{note:f.note}:{}));
   await withTimeout(b.commit(),20000);closeM();X.toast("✅ سُجّل المصروف، بانتظار مراجعة المحاسب")}catch(x){BUSY=false;t.disabled=false;if(x&&/big|img/.test(x.message))X.toast("تعذّر تجهيز الصورة. جرّب صورة أخرى","er");else fail(x)}return}
 if(a==="esave"&&r){const f=readForm(true);if(!f)return;BUSY=true;t.disabled=true;
  try{await withTimeout(updateDoc(doc(X.db,"bled",id),{amt:f.amt,dt:f.dt,cat:f.cat,note:f.note}),15000);closeM();X.toast("✅ عُدّل")}catch(x){BUSY=false;t.disabled=false;fail(x)}return}
 if(a==="del"&&r){if(!confirm("حذف هذا المصروف؟"))return;BUSY=true;try{const b=writeBatch(X.db);b.delete(doc(X.db,"bled",id));b.delete(doc(X.db,"bledimg",id));await withTimeout(b.commit(),15000);X.toast("حُذف")}catch(x){fail(x)}BUSY=false;return}
 if(a==="gsave"&&canAct()&&SEL){const f=readForm(false);if(!f)return;BUSY=true;t.disabled=true;
  try{await withTimeout(setDoc(doc(collection(X.db,"bled")),Object.assign({br:SEL,k:"in",amt:f.amt,dt:f.dt,by:{e:X.me.e,n:String(X.me.n||"").slice(0,60)},ts:Date.now(),st:"ok",o:1},f.note?{note:f.note}:{})),15000);closeM();X.toast("✅ سُجّل التسليم")}catch(x){BUSY=false;t.disabled=false;fail(x)}return}
 if((a==="ok"||a==="no")&&r&&canAct()){let note="";if(a==="no"){note=String(prompt("سبب الرفض (يظهر للفرع):")||"").trim().slice(0,300);if(note.length<2){X.toast("اكتب سبب الرفض","er");return}}
  BUSY=true;try{await withTimeout(updateDoc(doc(X.db,"bled",id),{st:a,rv:Object.assign({e:X.me.e,n:String(X.me.n||"").slice(0,60),at:Date.now()},note?{note}:{})}),15000);X.toast(a==="ok"?"✅ اعتُمد":"رُفض")}catch(x){fail(x)}BUSY=false;return}
 if(a==="idel"&&r&&canAct()){if(!confirm("حذف تسليم العهدة هذا؟"))return;BUSY=true;try{await withTimeout(deleteDoc(doc(X.db,"bled",id)),15000);X.toast("حُذف")}catch(x){fail(x)}BUSY=false;return}
 if(a==="close"&&canAct()&&SEL){const c=calc(SEL);if(c.pend){X.toast(`راجع المصروفات المنتظرة أولاً (${c.pend})`,"er");return}if(!c.L.length){X.toast("لا حركات في الفترة المفتوحة","er");return}
  if(!confirm(`إقفال فترة فرع ${brName(SEL)}؟\nالرصيد المرحَّل: ${money(c.bal)} ريال (${c.L.length} حركة). لا يمكن التعديل بعد الإقفال.`))return;
  BUSY=true;t.disabled=true;try{const sref=doc(collection(X.db,"bset")),L=c.L;
   for(let i=0;i<L.length;i+=390){const b=writeBatch(X.db);if(i===0)b.set(sref,Object.assign({br:SEL,at:Date.now(),bal:c.bal,cnt:L.length,by:{e:X.me.e,n:String(X.me.n||"").slice(0,60)},ts:Date.now()},c.last?{from:N(c.last.at)}:{}));
    L.slice(i,i+390).forEach(r=>b.update(doc(X.db,"bled",r.id),{sid:sref.id,o:0}));await withTimeout(b.commit(),30000)}
   X.toast("🔒 أُقفلت الفترة ورُحّل الرصيد")}catch(x){fail(x)}BUSY=false;t.disabled=false;return}
}
function onChange(e){
 const t=e.target;if(!X||!t)return;
 if(t.id==="bcx-c"){const w=g("bcx-ow");if(w)w.hidden=t.value!=="أخرى";return}
 if(t.id==="bcx-f"){const f=t.files&&t.files[0],pv=g("bcx-pv");if(f&&pv){const u=URL.createObjectURL(f);pv.onload=()=>URL.revokeObjectURL(u);pv.src=u;pv.hidden=false}return}
 if(t.matches&&t.matches("[data-bx-sel]")){SEL=t.value||"";VIEW=null;if(X.redraw)X.redraw()}
}
