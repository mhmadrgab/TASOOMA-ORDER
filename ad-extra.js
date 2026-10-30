// لوحة المستودع: العهد + إشعارات
import {collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,writeBatch} from "./fb.js";
import {calc,CATS,E,N,fmt,today,SL,stmtHtml,printStmt,ensurePrintCss} from "./cust.js";
import {notify,beep,badge,wireButtons,regSW} from "./notify.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
let X=null,LA=[],SA=[],un=[],cur=null,mode="main",pL=null,pS=null,q="";
const CSS=`
.cm{display:none;position:fixed;inset:0;z-index:75;background:rgba(0,0,0,.55);overflow:auto;padding:18px}.cm.on{display:block}
.ck2{max-width:880px;margin:0 auto;background:var(--card);border-radius:18px;padding:20px 22px}.ck2 h3{margin:0 0 4px}.ck2 label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}
.ck2 input,.ck2 select{width:100%}
.bal{background:#1b1b1b;color:#fff;border-radius:16px;padding:16px 20px;margin:12px 0;display:flex;gap:20px;flex-wrap:wrap;align-items:center}.bal b{font-size:34px;direction:ltr;display:block}.bal small{color:#cdb67a}.bal.neg b{color:#ff8a80}
.le{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 2px;border-bottom:1px solid var(--line);flex-wrap:wrap}.le small{display:block;color:var(--mut);font-size:12.5px}
.am{font-weight:700;font-size:17px;direction:ltr}.am.in{color:var(--done)}.am.ex{color:#c4362b}
.sc2{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:#f6edd2;color:#6b5314}.sc2.approved{background:#d8efd9;color:#1d5a24}.sc2.rejected{background:#f8d9d5;color:#8a2218}
.bx{border:1.5px solid var(--acc);border-radius:14px;padding:12px 14px;margin:12px 0;background:var(--soft)}
.nb2:empty{display:none}.bal small{display:block}.nb2{background:#c4362b;color:#fff;border-radius:999px;font-size:12px;padding:0 7px;margin-inline-start:6px;font-weight:700}
.rcb{background:#f8d9d5;color:#8a2218;border-radius:10px;padding:8px 12px;margin:0 18px 12px;font-size:14px}.rcb.ok{background:#d8efd9;color:#1d5a24}
.rq.recv{border-inline-start-color:var(--done);opacity:.85}.rq.recv .chp{background:#d8efd9;color:#1d5a24}
.tools{display:flex;gap:8px;align-items:center}.tools button{background:none;border:1.5px solid #444;color:#ddd;border-radius:999px;padding:6px 14px;cursor:pointer;font:inherit;font-size:14px}
img.rc{max-width:100%;border-radius:10px}
.le .bt,.bx .bt,.ck2 .bt{width:auto}.le>div:first-child{flex:1;min-width:150px}
@media (prefers-color-scheme:dark){.sc2{background:#3a3115;color:#e8cf8a}.sc2.approved{background:#173a1b;color:#8fd39a}.sc2.rejected{background:#40191a;color:#f1a5a0}.rcb{background:#40191a;color:#f1a5a0}.rcb.ok{background:#173a1b;color:#8fd39a}}
@media print{.cm{display:none!important}}
`;
const byBr=c=>({L:LA.filter(e=>e.br===c),S:SA.filter(s=>s.br===c)});
export const pendCount=()=>LA.filter(e=>e.st==="pending").length+SA.filter(s=>s.st==="pending").length;
function sync(){if(X.tab()==="cus")X.redraw();if(cur&&mode==="main")modal();hdr()}
function hdr(){if(!X)return;const n=pendCount();document.querySelectorAll("[data-cnt]").forEach(b=>b.textContent=n?String(n):"");badge(n+X.newReqs())}
// ---------- تبويب العهد ----------
export function view(){
 const rows=X.BR.map(b=>{const c=X.code(b),{L,S}=byBr(c),k=calc(L,S),pe=L.filter(e=>e.st==="pending").length,ps=S.filter(s=>s.st==="pending").length;return {b,c,k,pe,ps,act:L.length||S.length}});
 const tot=rows.reduce((a,r)=>a+r.k.bal,0),pe=rows.reduce((a,r)=>a+r.pe,0),ps=rows.reduce((a,r)=>a+r.ps,0);
 const list=rows.filter(r=>(!q||r.b.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>(b.pe+b.ps)-(a.pe+a.ps)||b.act-a.act);
 return `<div class="stats"><div class="sc"><small>إجمالي العهد مع الفروع</small><b style="font-size:28px">${fmt(tot)}</b></div><div class="sc n"><small>حركات بانتظار الاعتماد</small><b>${pe}</b></div><div class="sc p"><small>تسويات بانتظار الاعتماد</small><b>${ps}</b></div><div class="sc d"><small>فروع عليها رصيد</small><b>${rows.filter(r=>r.k.bal!==0).length}</b></div></div>
 <div class="pan"><div class="fl" style="margin:0 0 10px"><h3 style="margin:0">عهد الفروع</h3><input id="cq" placeholder="ابحث عن فرع" value="${E(q)}" style="margin-inline-start:auto"></div><div class="tw"><table><thead><tr><th>الفرع</th><th>الرصيد</th><th>افتتاحي</th><th>عهدة</th><th>مصروفات</th><th>بانتظار</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td class="l">${E(r.b)}</td><td><b style="direction:ltr;display:inline-block;color:${r.k.bal<0?"#c4362b":"inherit"}">${fmt(r.k.bal)}</b></td><td>${fmt(r.k.opening)}</td><td>${fmt(r.k.ins)}</td><td>${fmt(r.k.exps)}</td><td>${r.pe+r.ps?`<span class="nb2">${r.pe} حركة${r.ps?" + تسوية":""}</span>`:'<span class="off">—</span>'}</td><td><button class="bt s ${r.pe+r.ps?"g":""}" data-cx="open" data-c="${E(r.c)}">فتح</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
// ---------- نافذة الفرع ----------
function box(){let m=g("cmx");if(!m){m=document.createElement("div");m.id="cmx";m.className="cm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function closeM(){cur=null;mode="main";const m=box();m.className="cm";m.innerHTML=""}
function modal(){
 const m=box(),c=cur,b=X.BR.find(x=>X.code(x)===c),{L,S}=byBr(c),k=calc(L,S);
 const pend=L.filter(e=>e.st==="pending").sort((a,b)=>N(a.ts)-N(b.ts)),ps=S.filter(s=>s.st==="pending"),hist=S.filter(s=>s.st!=="pending").sort((a,b)=>N(b.ts)-N(a.ts));
 const ent=k.open.slice().reverse();
 const row=(e,act)=>`<div class="le"><div><b>${E(e.cat||"")}</b> <span class="sc2 ${E(e.st)}">${SL[e.st]||""}</span><small>${E(e.dt)}${e.note?" · "+E(e.note):""}</small></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="am ${e.type==="in"?"in":"ex"}">${e.type==="in"?"+":"−"}${fmt(e.amt)}</span>${e.img?`<button class="bt s" data-cx="img" data-id="${E(e.id)}">📎 إيصال</button>`:""}${act}</div></div>`;
 m.className="cm on";
 m.innerHTML=`<div class="ck2"><div class="fl" style="margin:0"><h3 style="margin:0"><bdi dir="ltr">${E(b)}</bdi> — العهدة</h3><button class="bt s" data-cx="close" style="margin-inline-start:auto">إغلاق ✕</button></div>
 <div class="bal ${k.bal<0?"neg":""}"><div><small>الرصيد الحالي</small><b>${fmt(k.bal)}</b></div><div><small>افتتاحي</small>${fmt(k.opening)}</div><div><small>عهدة معتمدة</small>${fmt(k.ins)}</div><div><small>مصروفات</small>${fmt(k.exps)}</div></div>
 <div class="fl"><button class="bt p" data-cx="addin">💵 تسليم عهدة للفرع</button><button class="bt" data-cx="addex">➕ مصروف يدوي</button><button class="bt" data-cx="stmt">🖨 كشف الفترة الحالية</button></div>
 ${ps.map(s=>`<div class="bx"><b>طلب تسوية <bdi dir="ltr">${E(s.no)}</bdi></b><div class="off" style="font-size:14px">${E(s.from)} ← ${E(s.to)} · عهدة ${fmt(s.ins)} · مصروفات ${fmt(s.exps)} · المتبقي ${fmt(s.bal)}</div><div class="fl" style="margin:10px 0 0"><button class="bt g" data-cx="sok" data-id="${E(s.id)}">✔ اعتماد التسوية</button><button class="bt r" style="margin-inline-start:0" data-cx="sno" data-id="${E(s.id)}">✖ رفض</button></div></div>`).join("")}
 ${pend.length?`<h3 style="margin:16px 0 4px">بانتظار اعتمادك</h3>${pend.map(e=>row(e,`<button class="bt s g" data-cx="ok" data-id="${E(e.id)}">اعتماد</button><button class="bt s" data-cx="no" data-id="${E(e.id)}">رفض</button>`)).join("")}`:""}
 <h3 style="margin:16px 0 4px">حركات الفترة الحالية</h3>${ent.filter(e=>e.st!=="pending").length?ent.filter(e=>e.st!=="pending").map(e=>row(e,`<button class="bt s" data-cx="del" data-id="${E(e.id)}">حذف</button>`)).join(""):'<div class="off">لا توجد حركات معتمدة</div>'}
 <h3 style="margin:16px 0 4px">التسويات السابقة</h3>${hist.length?hist.map(s=>`<div class="le"><div><b><bdi dir="ltr">${E(s.no)}</bdi></b> <span class="sc2 ${E(s.st)}">${SL[s.st]||""}</span><small>${E(s.from)} ← ${E(s.to)} · المتبقي ${fmt(s.bal)}${s.rnote?" · "+E(s.rnote):""}</small></div>${s.st==="approved"?`<button class="bt s" data-cx="ps" data-id="${E(s.id)}">🖨 طباعة</button>`:""}</div>`).join(""):'<div class="off">لا توجد تسويات</div>'}</div>`;
}
function form(type){
 mode="form";const ex=type==="exp";
 box().innerHTML=`<div class="ck2" style="max-width:480px"><h3>${ex?"مصروف يدوي":"تسليم عهدة للفرع"}</h3>
 <label>المبلغ</label><input id="fa" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off">
 ${ex?`<label>البند</label><select id="fc">${CATS.map(c=>`<option>${E(c)}</option>`).join("")}</select>`:""}
 <label>التاريخ</label><input id="fd2" type="date" value="${today()}">
 <label>${ex?"البيان":"ملاحظة"}</label><input id="fn" type="text" maxlength="300">
 <div class="fl" style="margin-top:16px"><button class="bt p" data-cx="fsave" data-type="${type}">حفظ (معتمد)</button><button class="bt" data-cx="fback">رجوع</button></div></div>`;
 g("fa").focus();
}
async function sOk(id){
 const s=SA.find(x=>x.id===id);if(!s)return;
 const sids=Array.isArray(s.ids)?s.ids:[];
 const ents=LA.filter(e=>sids.includes(e.id)&&e.br===s.br&&!e.sid&&e.st!=="rejected");
 if(!ents.length){X.toast("مفيش حركات صالحة في التسوية دي");return}
 const prev=SA.filter(x=>x.br===s.br&&x.st==="approved").sort((a,b)=>N(a.ts)-N(b.ts)).pop(),opening=prev?N(prev.bal):0;
 const ins=ents.filter(e=>e.type==="in").reduce((a,e)=>a+N(e.amt),0),exps=ents.filter(e=>e.type==="exp").reduce((a,e)=>a+N(e.amt),0),bal=Math.round((opening+ins-exps)*100)/100;
 if(!confirm(`اعتماد التسوية؟\nعهدة ${fmt(ins)} · مصروفات ${fmt(exps)} · المتبقي ${fmt(bal)}`))return;
 for(let i=0;i<ents.length;i+=400){const bt=writeBatch(X.db);ents.slice(i,i+400).forEach(e=>bt.update(doc(X.db,"ledger",e.id),{sid:id,st:"approved"}));await bt.commit()}
 const rej=LA.filter(e=>e.br===s.br&&!e.sid&&e.st==="rejected");
 for(let i=0;i<rej.length;i+=400){const bt=writeBatch(X.db);rej.slice(i,i+400).forEach(e=>bt.update(doc(X.db,"ledger",e.id),{sid:id}));await bt.commit()}
 await updateDoc(doc(X.db,"settlements",id),{st:"approved",opening,ins,exps,bal,appr:Date.now()});
 X.toast("تم اعتماد التسوية. الرصيد المرحّل "+fmt(bal));
}
function printS(id){
 const s=SA.find(x=>x.id===id);if(!s)return;
 printStmt(stmtHtml({brn:X.BR.find(b=>X.code(b)===s.br)||s.br,title:"كشف تسوية العهدة "+s.no,opening:N(s.opening),rows:LA.filter(e=>e.sid===id),from:s.from,to:s.to},X.logo));
}
async function click(e){
 const t=e.target.closest("[data-cx]");if(!t)return;
 const a=t.dataset.cx,id=t.dataset.id;
 try{
  if(a==="open"){cur=t.dataset.c;mode="main";modal()}
  else if(a==="close")closeM();
  else if(a==="fback"){mode="main";modal()}
  else if(a==="addin")form("in");else if(a==="addex")form("exp");
  else if(a==="fsave"){
   const type=t.dataset.type,amt=Math.round(N(toEn(g("fa").value))*100)/100;
   if(!(amt>0)||amt>1000000){X.toast("اكتب مبلغ صحيح");return}
   const d={br:cur,type,amt,cat:type==="in"?"عهدة":g("fc").value,dt:g("fd2").value||today(),ts:Date.now(),st:"approved"};
   const n=g("fn").value.trim().slice(0,300);if(n)d.note=n;
   await setDoc(doc(collection(X.db,"ledger")),d);mode="main";modal();X.toast("تم الحفظ");
  }
  else if(a==="ok")await updateDoc(doc(X.db,"ledger",id),{st:"approved",apr:Date.now()});
  else if(a==="no"){const r=prompt("سبب الرفض (اختياري):","");if(r===null)return;await updateDoc(doc(X.db,"ledger",id),{st:"rejected",rnote:r.trim().slice(0,200)})}
  else if(a==="del"){if(confirm("حذف الحركة نهائياً؟"))await deleteDoc(doc(X.db,"ledger",id))}
  else if(a==="img"){const en=LA.find(x=>x.id===id);if(en&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(en.img||"")){mode="img";box().innerHTML=`<div class="ck2" style="max-width:640px"><h3>إيصال ${E(en.cat)} — ${fmt(en.amt)}</h3><img class="rc" alt="" src="${en.img}"><div class="fl" style="margin-top:12px"><button class="bt" data-cx="fback">رجوع</button></div></div>`}}
  else if(a==="sok")await sOk(id);
  else if(a==="sno"){const r=prompt("سبب رفض التسوية (اختياري):","");if(r===null)return;await updateDoc(doc(X.db,"settlements",id),{st:"rejected",rnote:r.trim().slice(0,200)})}
  else if(a==="ps")printS(id);
  else if(a==="stmt"){const {L,S}=byBr(cur),k=calc(L,S);printStmt(stmtHtml({brn:X.BR.find(b=>X.code(b)===cur),title:"كشف حساب العهدة (الفترة الحالية)",opening:k.opening,rows:k.open.filter(x=>x.st==="approved"||x.type==="exp"),from:k.open[0]?k.open[0].dt:today(),to:today()},X.logo))}
 }catch(x){X.toast("تعذر التنفيذ: "+(x&&x.code||x&&x.message))}
}
function note(t,b,tag){X.toast(b?t+" — "+b:t);notify(t,b,tag);beep()}
export function initExtra(ctx){
 X=ctx;stop();
 if(!g("ax-css")){const s=document.createElement("style");s.id="ax-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(!window.__axc){window.__axc=1;document.addEventListener("click",click);document.addEventListener("input",e=>{if(e.target.id==="cq"){q=e.target.value;const p=e.target.selectionStart;X.redraw();const n=g("cq");if(n){n.focus();try{n.setSelectionRange(p,p)}catch(x){}}}})}
 pL=null;pS=null;
 un.push(onSnapshot(collection(X.db,"ledger"),sn=>{
  LA=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pL)LA.forEach(e=>{if(!(e.id in pL)&&e.st==="pending"){const b=X.BR.find(x=>X.code(x)===e.br)||e.br;note(e.type==="in"?"💵 عهدة مسجّلة":"🧾 مصروف جديد",`${b} — ${fmt(e.amt)}`,"l"+e.id)}});
  pL={};LA.forEach(e=>pL[e.id]=e.st);sync();
 },()=>X.toast("تعذر قراءة العهد. تأكد من تحديث القواعد (Rules)")));
 un.push(onSnapshot(collection(X.db,"settlements"),sn=>{
  SA=sn.docs.map(d=>({id:d.id,...d.data()}));
  if(pS)SA.forEach(s=>{if(!(s.id in pS)&&s.st==="pending"){const b=X.BR.find(x=>X.code(x)===s.br)||s.br;note("📑 طلب تسوية عهدة",b,"s"+s.id)}});
  pS={};SA.forEach(s=>pS[s.id]=s.st);sync();
 },()=>{}));
 regSW();
}
export function stop(){un.forEach(f=>f());un=[];LA=[];SA=[];cur=null;mode="main";const m=g("cmx");if(m){m.className="cm";m.innerHTML=""}}
export {note as adminNote,hdr as adminHdr};
