// 📦 استلام الحاويات بلا تفاصيل (18 نوفمبر 2026، محمد: "لو اتقفل علينا مديول أوامر الشراء هنقدر ندخل نستلم البضاعة؟" ← "أيوه، اعملها").
// لمن حُجب عنه قسم أوامر الشراء وأذن له مالك النظام بالاستلام (cfg/lock.po.rcv، زر 📦 في جدول «الأقسام الخاصة»).
// الشاشة لا تقرأ أمر الشراء نفسه (القواعد تمنع): تأتيها قائمة آمنة من الدالة po_rcv_list() فيها ما يلزم للاستلام فقط
// (المورد، الوصف، عدد الحاويات وأرقامها، الميناء، الأصناف والكميات، المرحلة) — بلا قيمة ولا مرفقات ولا ملاحظات الأمر.
// «تأكيد الاستلام» يكتب نفس ما تكتبه نافذة الاستلام في po.js: po/{id} = {st:"wh", rcv:{at,ok,note?,ts,e,n}, upd, att?}
// وصور الاستلام في poatt/{id}/x/{ax+1..10} (ax = آخر رقم مرفق موجود، يأتي من القائمة لأن المرفقات نفسها لا تُقرأ).
// القائمة ليست لحظية (دالة لا سماع): تتحدّث عند فتح التبويب، وكل 3 دقائق والتبويب ظاهر، وبزر «تحديث».
import {doc,updateDoc,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E} from "./cust.js";
import {multiPick,saveExtras,PO_FILE_MAX} from "./att.js";
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const DAY=864e5;
const dstr=t=>N(t)?new Date(N(t)).toLocaleDateString("en-CA"):"";
const dms=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?new Date(v+"T12:00:00").getTime():0;
const today=()=>new Date().toLocaleDateString("en-CA");
let X=null,L=[],LOADED=false,LOADING=false,ERR="",AT=0,OPEN=new Set(),PK=null,RK=true,busy=false,tm=null,wired=false;
const STG={out:["🚚","متجه إلى المستودع"],cust:["📋","التخليص الجمركي"],port:["⚓","وصل ميناء الوصول"],ship:["🚢","تم الشحن (في البحر)"]};
const PRC_CSS=`.prc-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 4px}.prc-hd h3{margin:0}.prc-hd .bt{margin-inline-start:auto}
.prc-c{border:1px solid var(--line);border-inline-start:5px solid var(--mut);border-radius:16px;padding:14px 16px;margin-top:12px;background:var(--card)}
.prc-c.s-out{border-inline-start-color:#2f7d62}.prc-c.s-cust{border-inline-start-color:#c98a1b}.prc-c.s-port{border-inline-start-color:#2f6f9e}.prc-c.s-ship{border-inline-start-color:var(--acc)}
.prc-top{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap}.prc-top b{font-size:16.5px}.prc-top .no{color:var(--mut);font-size:13px}
.prc-sg{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;border-radius:999px;padding:4px 12px;background:var(--bg);border:1px solid var(--line)}
.prc-c.s-out .prc-sg{background:#2f7d62;border-color:#2f7d62;color:#fff}
.prc-m{display:flex;flex-wrap:wrap;gap:6px 18px;margin:10px 0 0;font-size:14px;line-height:1.7}.prc-m span b{font-weight:700}.prc-m small{color:var(--mut);font-size:12.5px;display:block}
.prc-ac{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.prc-it{margin-top:12px;overflow:auto}.prc-it table{border-collapse:collapse;width:100%;min-width:420px;font-size:13.5px}
.prc-it th,.prc-it td{border-bottom:1px solid var(--line);padding:7px 8px;text-align:start}.prc-it th{color:var(--mut);font-size:12.5px;font-weight:700}.prc-it td.q{font-weight:800}
.prc-dn{display:flex;align-items:center;gap:6px 12px;flex-wrap:wrap;border-bottom:1px dashed var(--line);padding:9px 0;font-size:14px}.prc-dn:last-child{border-bottom:0}.prc-dn small{color:var(--mut)}
.prc-e{text-align:center;color:var(--mut);padding:26px 10px;line-height:2}
#prm{display:none;position:fixed;inset:0;z-index:82;background:rgba(0,0,0,.55);overflow:auto;padding:16px}#prm.on{display:block}
#prm>.mk{max-width:600px;margin:4vh auto;background:var(--card);color:var(--ink);border-radius:20px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
#prm h3{margin:0 0 12px;font-size:19px}#prm label{display:block;font-size:13.5px;color:var(--mut);margin:12px 0 5px}
#prm input,#prm textarea{font:inherit;width:100%;border:1.5px solid var(--line);background:var(--field,#f2e9dd);color:var(--ink);border-radius:12px;padding:10px 12px;min-width:0}
#prm textarea{min-height:76px;resize:vertical}#prm .chs{display:flex;flex-wrap:wrap;gap:6px}
#prm .chs button{font:inherit;font-size:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}
#prm .chs button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
#prm .act{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
#prm .act button{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:10px 18px;cursor:pointer}
#prm .act button.g{background:#6f7d45;border-color:#6f7d45;color:#fff}#prm .act button:disabled{opacity:.6;cursor:progress}`;
const css=()=>{if(!g("prc-css")){const st=document.createElement("style");st.id="prc-css";st.textContent=PRC_CSS;document.head.appendChild(st)}};
async function load(silent){
 if(!X||LOADING)return;LOADING=true;if(!silent&&X.active())X.redraw();
 try{const r=await withTimeout(X.db.c.rpc("po_rcv_list"),15000);if(!X)return;if(r&&r.error)throw r.error;
  L=Array.isArray(r&&r.data)?r.data:[];ERR=r&&r.data===null?"no":"";LOADED=true;AT=Date.now()}
 catch(e){if(!X)return;ERR="fail"}
 LOADING=false;if(X.badge)X.badge();if(X.active())X.redraw();
}
const itSum=r=>{const it=Array.isArray(r.it)?r.it:[];return {cnt:it.length,q:it.reduce((a,x)=>a+N(x.q),0)}};
function itTable(r){const it=Array.isArray(r.it)?r.it:[],hasK=it.some(x=>N(x.k)>0),hasN=it.some(x=>x.n);
 return `<div class="prc-it"><table><thead><tr><th>#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th>الكمية</th>${hasK?"<th>الحاوية</th>":""}${hasN?"<th>ملاحظات</th>":""}</tr></thead><tbody>${it.map((x,i)=>`<tr><td>${i+1}</td><td><bdi dir="ltr" data-notr>${E(x.c||"")}</bdi></td><td data-notr>${E(x.cl||"—")}</td><td data-notr>${E(x.z||"—")}</td><td class="q">${N(x.q)}</td>${hasK?`<td>${N(x.k)||"—"}</td>`:""}${hasN?`<td data-notr>${E(x.n||"")}</td>`:""}</tr>`).join("")}</tbody></table></div>`}
function card(r){const sg=STG[r.st]||["📦",""],s=itSum(r),op=OPEN.has(r.id);
 return `<article class="prc-c s-${E(r.st)}"><div class="prc-top"><span class="prc-sg">${sg[0]} ${sg[1]}</span><b>🏭 <bdi data-notr>${E(r.supn||"")}</bdi></b><bdi dir="ltr" class="no">${E(r.no||"")}</bdi></div>
 <div class="prc-m"><span><small>الحاويات</small><b>${Math.max(1,N(r.cn))} × <bdi dir="ltr">${E(r.ctype||"")}</bdi></b></span>${r.desc?`<span><small>البضاعة</small><span data-notr>${E(r.desc)}</span></span>`:""}${r.cnos?`<span><small>أرقام الحاويات</small><bdi dir="ltr" data-notr>${E(r.cnos)}</bdi></span>`:""}${r.pod?`<span><small>ميناء الوصول</small><span data-notr>${E(r.pod)}</span></span>`:""}${r.eta?`<span><small>الوصول المتوقع</small><bdi dir="ltr">${E(r.eta)}</bdi></span>`:""}</div>
 ${op&&s.cnt?itTable(r):""}
 <div class="prc-ac">${s.cnt?`<button class="bt s" data-prc="it" data-id="${E(r.id)}" type="button">📋 ${op?"إخفاء الأصناف":`الأصناف (${s.cnt} صنف · ${s.q} قطعة)`}</button>`:""}<button class="bt g" data-prc="rcv" data-id="${E(r.id)}" type="button">✅ تأكيد الاستلام</button></div></article>`}
export function poRcvView(){
 if(!X)return "";css();
 if(LOADED&&!LOADING&&Date.now()-AT>60000)setTimeout(()=>load(true),0);// فُتح التبويب والقائمة قديمة: نحدّثها في الخلفية
 const open=L.filter(r=>r.st!=="wh"),done=L.filter(r=>r.st==="wh");
 const body=!LOADED&&ERR!=="fail"?`<div class="prc-e">⏳ جاري تحميل الحاويات…</div>`
  :ERR==="fail"&&!LOADED?`<div class="prc-e">تعذّر تحميل الحاويات. تأكد من الاتصال ثم أعد المحاولة.<br><button class="bt p" data-prc="reload" type="button">إعادة المحاولة</button></div>`
  :ERR==="no"?`<div class="prc-e">لم يعد استلام الحاويات متاحاً لحسابك. راجع مالك النظام.</div>`
  :open.length?open.map(card).join(""):`<div class="prc-e">📦<br>لا توجد حاويات قادمة الآن.<br>عند شحن حاوية ستظهر هنا، ويصلك إشعار عند وصولها الميناء وعند توجهها إلى المستودع.</div>`;
 return `<div class="pan prc"><div class="prc-hd"><h3>📦 استلام الحاويات</h3><button class="bt s" data-prc="reload" type="button" ${LOADING?"disabled":""}>${LOADING?"⏳":"🔄"} تحديث</button></div>
 <p class="off" style="margin:0;font-size:13.5px;line-height:1.8">تظهر هنا الحاويات القادمة إلى المستودع وما يلزم لاستلامها. بعد وصول الحاوية ومطابقة الأصناف اضغط «تأكيد الاستلام».</p>
 ${body}</div>
 ${done.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 6px">استُلمت مؤخراً</h3>${done.map(r=>`<div class="prc-dn"><span>✅</span><b>🏭 <bdi data-notr>${E(r.supn||"")}</bdi></b><bdi dir="ltr" class="off">${E(r.no||"")}</bdi><span>${Math.max(1,N(r.cn))} × <bdi dir="ltr">${E(r.ctype||"")}</bdi></span><small><bdi dir="ltr">${dstr(r.rcv&&r.rcv.at)}</bdi>${r.rcv&&r.rcv.n?` · <span data-notr>${E(r.rcv.n)}</span>`:""}${r.rcv&&r.rcv.ok===false?" · ⚠️ بملاحظات":""}</small></div>`).join("")}</div>`:""}`;
}
// ---------- نافذة التأكيد ----------
function box(){let m=g("prm");if(!m){m=document.createElement("div");m.id="prm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function closeM(){const m=g("prm");if(m){m.className="";m.innerHTML=""}PK=null;busy=false}
function rcvForm(id){const r=L.find(x=>x.id===id);if(!r||!X)return;css();RK=true;
 const slots=Math.max(0,10-Math.max(1,N(r.ax))),m=box();
 m.innerHTML=`<div class="mk"><h3>✅ تأكيد الاستلام في المستودع</h3><p style="margin:0;color:var(--mut)"><bdi dir="ltr">${E(r.no||"")}</bdi> · 🏭 <bdi data-notr>${E(r.supn||"")}</bdi> · 📦 ${Math.max(1,N(r.cn))} × ${E(r.ctype||"")}${r.cnos?` · <bdi dir="ltr">${E(r.cnos)}</bdi>`:""}</p>
 <label>تاريخ الوصول للمستودع *</label><input id="prc-ra" type="date" value="${today()}" max="${today()}">
 <label>حالة البضاعة</label><div class="chs" id="prc-rk"><button type="button" data-k="1" class="on">✅ سليمة</button><button type="button" data-k="0">⚠️ بملاحظات</button></div>
 <label>ملاحظة</label><textarea id="prc-rn" maxlength="500" placeholder="مثلاً: كرتونتان تالفتان، أو نقص في الكمية"></textarea>
 ${slots?`<label>صور الاستلام (اختياري)</label><div id="prc-rp"></div>`:""}
 <div class="act"><button class="g" data-prc="save" data-id="${E(id)}" type="button">تأكيد الاستلام</button><button data-prc="close" type="button">رجوع</button></div></div>`;
 m.className="on";
 PK=slots?multiPick(g("prc-rp"),{w:1600,cap:280000,max:Math.min(9,slots),fmax:PO_FILE_MAX,toast:X.toast}):null;
 g("prc-rk").onclick=e=>{const b=e.target.closest("[data-k]");if(!b)return;RK=b.dataset.k==="1";g("prc-rk").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b))};
}
async function rcvSave(id){const r=L.find(x=>x.id===id);if(!r||!X||busy)return;if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const at=dms(g("prc-ra").value);if(!at||at>Date.now()+DAY){X.toast("اختر تاريخ الوصول");return}
 if(at<N(r.dt)){X.toast("التاريخ قبل تاريخ أمر الشراء");return}
 const note=g("prc-rn").value.trim().slice(0,500);if(!RK&&!note){X.toast("اكتب الملاحظات");g("prc-rn").focus();return}
 const rcv={at,ok:RK,ts:Date.now(),e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)};if(note)rcv.note=note;
 const ATT=PK?PK.imgs().concat(PK.files()):[],btn=document.querySelector('[data-prc="save"]');
 busy=true;if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 try{await withTimeout(updateDoc(doc(X.db,"po",id),{st:"wh",rcv,upd:Date.now(),...(ATT.length?{att:1}:{})}),15000);
  if(ATT.length){const bad=await saveExtras(X.db,"poatt",id,ATT,Math.max(1,N(r.ax))+1);/* 📎 (v263) العدد التقريبي (ax = آخر رقم موجود)، ويتصلّح أول ما حد يفتح المرفقات من أوامر الشراء */try{const n=Math.min(10,(N(r.ax)>=2?N(r.ax)-1:0)+ATT.length-bad);if(n>0)await updateDoc(doc(X.db,"po",id),{ac:n,att:1})}catch(e){}if(bad)X.toast(`سُجّل الاستلام، لكن تعذّر رفع ${bad} من الصور`,"er")}
  busy=false;if(X.ping)X.ping([id]);X.toast("✅ استُلم في المستودع");OPEN.delete(id);closeM();load(true)}
 catch(x){busy=false;if(btn){btn.disabled=false;btn.textContent="تأكيد الاستلام"}
  const w=await failReason(x);if(X)X.toast(w==="denied"?"غير مسموح. ربما استُلمت الحاوية بالفعل أو تغيّر الإذن. حدّث القائمة":FAIL_MSG[w],"er");if(w==="denied")load(true)}
}
function click(e){const t=e.target.closest("[data-prc]");if(!t||!X)return;const a=t.dataset.prc,id=t.dataset.id;
 if(a==="reload")load();
 else if(a==="it"){if(OPEN.has(id))OPEN.delete(id);else OPEN.add(id);X.redraw()}
 else if(a==="rcv")rcvForm(id);
 else if(a==="save")rcvSave(id);
 else if(a==="close")closeM();
}
// ctx: {db, toast, me:{e,n}, redraw(), active(), ping(ids), badge()}
export function initPoRcv(ctx){
 X=ctx;L=[];LOADED=false;ERR="";AT=0;OPEN=new Set();
 if(!wired){wired=true;document.addEventListener("click",click);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&g("prm")&&g("prm").className==="on"&&!busy)closeM()});
  document.addEventListener("visibilitychange",()=>{if(X&&!document.hidden&&Date.now()-AT>60000)load(true)})}
 clearInterval(tm);tm=setInterval(()=>{if(X&&!document.hidden&&X.active()&&!(g("prm")&&g("prm").className==="on"))load(true)},180000);
 load(true);
}
export function stopPoRcv(){clearInterval(tm);tm=null;closeM();X=null;L=[];LOADED=false;LOADING=false;ERR=""}
// الرقم على التبويب: الحاويات المتجهة إلى المستودع الآن
export const poRcvCount=()=>X?L.filter(r=>r.st==="out").length:0;
