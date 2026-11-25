// لوحة المستودع (للمدير فقط): إدارة المحاسبين وصلاحياتهم
import {makeFb,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,createUserWithEmailAndPassword,signInWithEmailAndPassword,updatePassword,signOut} from "./fb.js";
import {E} from "./cust.js";
import {avatar,ownerMe,meReady} from "./prof.js";
// اسم المالك اللي بيظهر لو لا يزال ماكتبش اسمه في "ملفي الشخصي"
export const OWNER_NAME="محمد رجب";
const g=id=>document.getElementById(id);
// gift = محاسب الهدايا: يشوف الهدايا والعينات ويطلّع تقاريرها بس (الاعتماد للي معاه "الطلبات" وللمديرين)
const PERMS=[["req","الطلبات"],["cus","العهدة"],["fl","السيارات والسائقين"],["gift","🎁 الهدايا (مشاهدة وتقارير)"],["ga","✅ اعتماد الهدايا"],["mt","🔧 الصيانة"],["po","🚢 أوامر الشراء"],["rcv","📦 استلام الحاويات"]];
// مدير التسويق: الهدايا والعينات فقط (يعتمدها ويرفضها). p.gm فقط من غير أي صلاحية تانية
// 🔑 المدير اللي معاه p.pm (المالك بيحدده) يغيّر صلاحيات المحاسبين دي بس (القواعد كمان). "اعتماد الهدايا" للمالك بس
const PM_KEYS=["req","cus","fl","gift"];
// 🔧 مهندس الصيانة (13 نوفمبر 2026): p.mt بس، بيشوف مديول الصيانة لوحده
// 💼 منصب يضيفه الأدمن أو مالك النظام بنفسه (18 نوفمبر 2026، طلب محمد: "في خانة محاسب ألاقي إضافة منصب جديد").
// staff.t = اسم المنصب (نص للعرض فقط). ما يدخله الموظف يحدده p كالعادة (من النموذج ثم من جدول الصلاحيات)، فلا تغيير في القواعد ولا في الخادم.
// قائمة المناصب = المناصب المكتوبة على الموظفين الحاليين (TL)، فلا مجموعة جديدة في القاعدة.
const hasT=s=>s.v!==true&&s.admin!==true&&typeof s.t==="string"&&!!s.t.trim();
const tClean=x=>String(x||"").replace(/[\u0000-\u001f<>]/g,"").replace(/\s+/g," ").trim().slice(0,30);
const T_RES=["محاسب","مدير","متابع","مالك النظام","الأدمن","مدير تسويق","مدير التسويق","مهندس صيانة","مهندس الصيانة","مدير مشتريات","مدير المشتريات"];
const tErr=v=>!v?"اكتب اسم المنصب":T_RES.includes(v)?"هذا المنصب موجود في القائمة بالفعل، اختره منها":"";
const TL=()=>{const o=[];S.forEach(s=>{if(hasT(s)){const v=tClean(s.t);if(v&&!o.includes(v))o.push(v)}});return o.sort((a,b)=>a.localeCompare(b,"ar"))};
const tSame=v=>TL().find(x=>x.toLowerCase()===String(v).toLowerCase())||v;
const SECL={req:"الطلبات",cus:"العهدة",fl:"السيارات والسائقين",gift:"الهدايا: مشاهدة وتسوية",mt:"الصيانة",po:"أوامر الشراء"};
const isCus=()=>f.r==="new"||f.r.indexOf("t:")===0;
// 🔒 الأقسام الخاصة (cfg/lock): po أوامر الشراء · cus العهدة · gift الهدايا والعينات · mt الصيانة · log السجل.
// لكل قسم: hide (مخفي عنهم بالاسم) · on + al (خاص + المستثنون) · mute (جرس الإشعارات مطفأ). نفس منطق القواعد (sec_ok) والسيرفر.
const SECS=[["po","أوامر الشراء"],["cus","العهدة"],["gift","الهدايا والعينات"],["mt","الصيانة"],["log","السجل"]];
const SEC_EXP={po:["po","rcv"],cus:["cus"],gift:["gm","ga","gift"],mt:["mt"],log:[]};
const SEC_KEY={po:"po",rcv:"po",cus:"cus",gm:"gift",ga:"gift",gift:"gift",mt:"mt"};
const lkArr=a=>Array.isArray(a)?a.map(x=>String(x).toLowerCase()):[];
const lkGet=()=>{const L=(X&&X.lock&&X.lock())||{},o={};SECS.forEach(a=>{const x=(L[a[0]]&&typeof L[a[0]]==="object")?L[a[0]]:{};o[a[0]]={on:x.on===true,al:lkArr(x.al),hide:lkArr(x.hide),mute:lkArr(x.mute),rcv:lkArr(x.rcv)}});return o};
// القسم محجوب عني (أو «خاص») ولست مالك النظام: لا أمنح صلاحياته لأحد (القواعد ترفض)
const secDeny=k=>{if(!X||X.co)return false;const x=lkGet()[k];return !!x&&(x.on||x.hide.includes(String(X.me||"").toLowerCase()))};
const secDenyKey=pk=>!!SEC_KEY[pk]&&secDeny(SEC_KEY[pk]);
const poDeny=()=>secDeny("po");
const LK_MSG="هذا القسم خاص الآن: صلاحيته يمنحها مالك النظام فقط";
const tP=()=>{const p={};Object.keys(SECL).forEach(k=>{if(f.tp[k]&&!secDenyKey(k))p[k]=true});return p};
const isEng=s=>!hasT(s)&&s.v!==true&&s.admin!==true&&!!(s.p&&s.p.mt===true&&!s.p.req&&!s.p.cus&&!s.p.fl&&!s.p.gift&&!s.p.gm);
// 🚢 مدير المشتريات (15 نوفمبر 2026): p.po بس، بيشوف أوامر الشراء والدردشة
const isPur=s=>!hasT(s)&&s.v!==true&&s.admin!==true&&!!(s.p&&s.p.po===true&&!s.p.req&&!s.p.cus&&!s.p.fl&&!s.p.gift&&!s.p.gm&&!s.p.mt&&!s.p.rcv);
const isMkt=s=>!hasT(s)&&s.v!==true&&s.admin!==true&&!!(s.p&&s.p.gm===true&&!s.p.req&&!s.p.cus&&!s.p.fl&&!s.p.gift);
// ga = "اعتماد الهدايا": المالك بيدّيها لأي مدير أو محاسب (غير مدير التسويق اللي بيعتمد أصلاً)
const genPw=()=>{const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";return [...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join("")};
const EMAIL=/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/;
// DV = أجهزة الإشعارات لكل إيميل [{dv:"m"|"pc"|"", ts}] (المالك بس)
let DV={},testing="";
let X=null,S=[],SL=false,WD=null,PW=()=>({}),un=[],f={e:"",n:"",p:"",r:"acc",t:"",tp:{}},busy=false;
// قايمة أسماء المستودع للشات (whdir): المالك + كل موظف مفعّل (مش المتابع)، باسمه وكنيته. الفروع بتشوف منها owner/admin/req بس.
// المالك بس بيكتبها، وبتتظبط لوحدها كل ما الموظفين يتغيّروا (تفعيل/تعطيل/صلاحية/حذف/اسم/كنية)
export function syncDir(){
 if(!X||!X.owner||!SL||!WD||!X.me||(X.root&&!meReady()))return;
 // (18 نوفمبر 2026) مالك النظام كمان بيظبط الدليل (كان الأدمن بس، فالصلاحية اللي مالك النظام يدّيها ماكانتش بتظهر للفروع لحد ما الأدمن يفتح اللوحة). سطر الأدمن نفسه للأدمن بس.
 const want={};if(X.root){const me=ownerMe();want[X.me]={n:String(me.n||OWNER_NAME).slice(0,60),k:String(me.k||"").slice(0,40),r:"owner"}}
 const RT=String(X.rootEmail||"").toLowerCase();
 // كل الموظفين المفعّلين (ما عدا المتابع): r = admin/req بيكلّموا الفروع، و staff بيكلّموا السائقين والموظفين بس (نوفمبر 2026)
 // نوفمبر 2026 (طلب محمد): مدير التسويق (gm) وصاحب الشركة (v) بقوا في الشات، في قسم "الإدارة" مع المديرين، وظاهرين لكل الفروع
 // w = يظهر للفروع في قسم "المستودع" بالشات (المالك بيختاره من تبويب الموظفين، staff.cw). المالك ظاهر دايماً
 S.forEach(s=>{const id=String(s.id).toLowerCase();if((X.root?id!==X.me:id!==RT)&&s.enabled&&!(s.p&&s.p.nc===true&&s.co!==true)){want[id]={n:String(s.name||id.split("@")[0]).slice(0,60),k:String(s.k||"").slice(0,40),r:s.v===true?"v":s.admin===true?"admin":(s.p&&s.p.gm)?"gm":(s.p&&s.p.req)?"req":"staff"};if(s.cw===true)want[id].w=true}});
 Object.entries(want).forEach(([id,v])=>{const o=WD[id];if(!o||o.n!==v.n||(o.k||"")!==v.k||o.r!==v.r||!!o.w!==!!v.w)setDoc(doc(X.db,"whdir",id),v).catch(()=>{})});
 Object.keys(WD).forEach(id=>{if(!want[id]&&(X.root||String(id).toLowerCase()!==RT))deleteDoc(doc(X.db,"whdir",id)).catch(()=>{})});
}
export const staffName=id=>{const s=S.find(x=>x.id===id);return s?s.name||id:id};
const AERR=e=>({"auth/email-already-in-use":"هذا البريد لديه حساب في Firebase بالفعل. اكتب كلمة مروره الحالية لنربطه.","auth/operation-not-allowed":"فعّل Email/Password من Authentication في Firebase","auth/weak-password":"كلمة المرور ضعيفة (6 أحرف على الأقل)","auth/network-request-failed":"لا يوجد اتصال بالإنترنت","auth/invalid-credential":"كلمة المرور غير صحيحة","x/exists-wrong-pw":"هذا البريد لديه حساب بالفعل وكلمة المرور المكتوبة ليست كلمته الحالية. اكتب كلمته الحالية أو استخدم بريداً آخر.","auth/invalid-email":"البريد الإلكتروني غير صحيح","auth/too-many-requests":"محاولات كثيرة، انتظر قليلاً","x/not-allowed":"غير مسموح لك بتغيير كلمة مرور هذا الحساب","x/no-user":"لا يوجد حساب دخول لهذا المستخدم","x/server":"تعذّر تغيير كلمة المرور. تأكد من تحديث الخادم (wrangler deploy) وأن الإنترنت يعمل","auth/admin-restricted-operation":"التسجيل متوقف في Firebase. فعّله مؤقتاً من Authentication ← Settings ← User actions"}[e&&e.code]||("خطأ: "+(e&&e.code||e&&e.message)));
const msg=s=>`أهلاً ${s.name||""}\nلوحة المستودع:\n${new URL("./admin.html",location.href).href}\nالبريد الإلكتروني: ${s.id}\nكلمة المرور: ${PW()[s.id]||""}`;
const cpy=async t=>{try{await navigator.clipboard.writeText(t);X.toast("تم النسخ")}catch(e){prompt("انسخ الرسالة:",t)}};
// الصفحة مقسومة: مالك النظام، المديرين، المحاسبين. المالك بس اللي بيعدّل؛ المدير بيشوف بس (ويلاقي نفسه في قسم المديرين)
// صندوق المنصب تحت نموذج الإضافة: اسم المنصب (للجديد) + الأقسام التي يدخلها
const ttlBox=()=>{if(!isCus())return "";const nw=f.r==="new";
 return `<div class="sft-box" style="margin-top:10px;padding:12px 14px;border:1px dashed var(--line);border-radius:12px">${nw?`<input id="sft" placeholder="اسم المنصب (مثلاً: أمين مخزن)" value="${E(f.t)}" maxlength="30" autocomplete="off" style="display:block;width:100%;max-width:340px;margin:0 0 12px">`:""}<div style="font-size:13.5px;margin:0 0 8px"><b>الأقسام التي يدخلها صاحب هذا المنصب</b></div><div style="display:flex;flex-wrap:wrap;gap:10px 20px">${Object.keys(SECL).filter(k=>!secDenyKey(k)).map(k=>`<label style="display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-size:14px"><input type="checkbox" data-stp="${k}" ${f.tp[k]?"checked":""} style="width:19px;height:19px;margin:0;accent-color:var(--acc)">${SECL[k]}</label>`).join("")}</div><p class="off" style="margin:10px 0 0;font-size:13px;line-height:1.8">بدون أي قسم يدخل الدردشة فقط. تستطيع تعديل صلاحياته في أي وقت من «🔐 جدول الصلاحيات».</p></div>`};
export function view(){// (خانات الصلاحيات انتقلت إلى permView: جدول الصلاحيات)
 // V = المتابعين (صاحب الشركة): بيشوفوا كل حاجة من غير تعديل
 const pw=PW(),own=X.owner,me=X.me,V=S.filter(s=>s.v===true),M=S.filter(s=>s.v!==true&&s.admin===true&&s.co!==true),C=S.filter(s=>s.v!==true&&s.admin===true&&s.co===true),G=S.filter(s=>isMkt(s)),T=S.filter(s=>isEng(s)),U=S.filter(s=>isPur(s)),O=S.filter(hasT),A=S.filter(s=>s.v!==true&&s.admin!==true&&!hasT(s)&&!isMkt(s)&&!isEng(s)&&!isPur(s));
 const you=id=>id===me?' <span class="pill go">أنت</span>':"";
 const st=s=>`<span class="pill ${s.enabled?"":"off2"}">${s.enabled?"مفعّل":"معطّل"}</span>`;
 const pwc=s=>`<td>${pw[s.id]?`<span class="pin" data-spc="${E(s.id)}">••••••••</span> <button class="bt s" data-sf="show" data-id="${E(s.id)}" type="button">إظهار</button>`:'<span class="off" title="كلمة المرور لا تُحفظ: تظهر مرة واحدة بعد الإنشاء أو التغيير">لا تُحفظ</span>'}</td>`;
 const acts=(s,role)=>s.co&&!X.root?'<td></td>':`<td style="white-space:nowrap">${role}${s.co?"":`<button class="bt s ${s.p&&s.p.nc===true?"r":""}" data-sf="chat" data-id="${E(s.id)}" type="button" title="فتح أو قفل الدردشة لهذا الموظف">${s.p&&s.p.nc===true?"💬 الدردشة مقفولة":"💬 الدردشة مفتوحة"}</button> `}<button class="bt s" data-sf="tg" data-id="${E(s.id)}" type="button">${s.enabled?"تعطيل":"تفعيل"}</button> <button class="bt s" data-sf="pw" data-id="${E(s.id)}" type="button">كلمة مرور جديدة</button> <button class="bt s" data-sf="cp" data-id="${E(s.id)}" type="button">نسخ رسالة</button> <button class="bt s r" data-sf="del" data-id="${E(s.id)}" type="button">حذف</button></td>`;
 const empty=(n,t)=>`<tr><td colspan="${n}" class="off" style="text-align:center;padding:18px">${t}</td></tr>`;
 // قسم مالك النظام وخانة الإضافة بيظهروا للمالك بس؛ المديرين بيشوفوا المديرين والمحاسبين بس
 // الاسم بالصورة + الكنية (المالك بيكتبها، وبتظهر جنب الاسم في الدردشة)
 const who=s=>`<td><span style="display:inline-flex;align-items:center;gap:8px">${avatar(s.id,s.name,30)}<b>${E(s.name||"")}</b></span>${you(s.id)}</td>`;
 const kc=s=>`<td>${own&&!(s.co&&!X.root)?`<input data-sk="${E(s.id)}" value="${E(s.k||"")}" maxlength="40" placeholder="مثلاً: مسؤول الطلبات" style="min-width:150px">`:E(s.k||"—")}</td>`;
 const mo=ownerMe(),on=mo.n||OWNER_NAME,rt=X.rootEmail||me;
 // صلاحية المحاسب دي: المالك، أو مدير معاه 🔑 (مش لمدير التسويق، ومش "اعتماد الهدايا")
 const canP=(s,k)=>own||(X.pm&&PM_KEYS.includes(k)&&!(s.p&&s.p.gm)&&s.id!==me);
 // يظهر للفروع في "المستودع" بالدردشة (المالك بيختار)
 const cwc=s=>`<td><input type="checkbox" data-scw="${E(s.id)}" ${s.cw===true?"checked":""} ${own?"":"disabled"}></td>`;
 // الإشعارات: الأجهزة المتسجّلة للشخص ده + زرار تجربة (المالك بس)
 const dvs=id=>{const L=DV[String(id).toLowerCase()]||[],m=L.filter(x=>x.dv==="m").length,pc=L.filter(x=>x.dv==="pc").length,o=L.length-m-pc;
  return L.length?[m?`📱 جوال${m>1?" ×"+m:""}`:"",pc?`💻 حاسوب${pc>1?" ×"+pc:""}`:"",o?`❔ جهاز${o>1?" ×"+o:""}`:""].filter(Boolean).join(" · "):`<span style="color:#c0392b">⚠️ لا يوجد جهاز</span>`};
 const nc=s=>own?`<td style="white-space:nowrap">${dvs(s.id)} <button class="bt s" data-sf="ntest" data-id="${E(s.id)}" type="button" ${testing?"disabled":""}>${testing===s.id?"⏳":"🔔 جرّب"}</button></td>`:"";
 return `${own?`<div class="pan"><h3 style="margin:0 0 10px">👑 الأدمن</h3><div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px">${avatar(rt,on,44)}<div><b>${E(on)}</b>${mo.k?` <span class="pill">${E(mo.k)}</span>`:""}<div class="off" dir="ltr" style="font-size:13px">${E(rt)}</div></div>${X.root?`<span class="pill go">أنت</span>`:""}<span class="off" style="font-size:13.5px">🔔 ${dvs(rt)}</span> <button class="bt s" data-sf="ntest" data-id="${E(rt)}" type="button" ${testing?"disabled":""}>${testing===rt?"⏳":"🔔 جرّب"}</button>${X.root?`<button class="bt s" data-pfopen type="button" style="margin-inline-start:auto">✏️ اسمي وكنيتي وصورتي</button>`:""}</div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 10px">➕ إضافة موظف</h3>
 <div class="fl" style="margin:0"><input id="sfe" type="email" dir="ltr" placeholder="البريد الإلكتروني" value="${E(f.e)}" autocomplete="off" style="flex:1;min-width:190px"><input id="sfn" placeholder="الاسم" value="${E(f.n)}" maxlength="40" style="flex:1;min-width:140px"><input id="sfp" dir="ltr" placeholder="كلمة المرور (اختياري)" value="${E(f.p)}" autocomplete="off" style="flex:1;min-width:150px"><select id="sfr"><option value="acc" ${f.r==="acc"?"selected":""}>محاسب</option><option value="adm" ${f.r==="adm"?"selected":""}>مدير</option>${secDeny("gift")?"":`<option value="mkt" ${f.r==="mkt"?"selected":""}>📣 مدير تسويق (الهدايا فقط)</option>`}${secDeny("mt")?"":`<option value="eng" ${f.r==="eng"?"selected":""}>🔧 مهندس صيانة (الصيانة فقط)</option>`}${poDeny()?"":`<option value="pur" ${f.r==="pur"?"selected":""}>🚢 مدير المشتريات (أوامر الشراء فقط)</option>`}${TL().map(x=>`<option data-notr value="t:${E(x)}" ${f.r==="t:"+x?"selected":""}>💼 ${E(x)}</option>`).join("")}${X.root?`<option value="co" ${f.r==="co"?"selected":""}>👑 مالك النظام (كل الصلاحيات)</option>`:""}<option value="view" ${f.r==="view"?"selected":""}>👁 متابع (صاحب الشركة)</option><option value="new" ${f.r==="new"?"selected":""}>➕ إضافة منصب جديد…</option></select><button class="bt p" data-sf="add" type="button" ${busy?"disabled":""}>إضافة</button></div>${ttlBox()}</div>`:""}
 ${own||V.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">👁 المتابعين (${V.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">مثل صاحب الشركة: يرى لوحة الأداء والطلبات والتحويلات والعهدة والسيارات والعمال والسجل، ولا يستطيع تعديل أو حذف أي شيء. وليس له دردشة ولا كلمات مرور.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
 ${V.length?V.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,""):""}</tr>`).join(""):empty(own?7:4,"لا يوجد متابعون بعد. أضفه من الأعلى واختر \"👁 متابع\"")}</tbody></table></div></div>`:""}
 ${own||G.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">📣 مديرو التسويق (${G.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">يدخل ويرى مديول الهدايا والعينات فقط، ويعتمد هدايا الفروع والمستودع أو يرفضها. لو أردت أن يعتمد شخص آخر، فعّل له "✅ اعتماد الهدايا" في جدول المديرين أو المحاسبين.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
 ${G.length?G.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,""):""}</tr>`).join(""):empty(own?7:4,"لا يوجد مديرو تسويق بعد. أضفه من الأعلى واختر \"📣 مدير تسويق\"")}</tbody></table></div></div>`:""}
 ${own||T.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">🔧 مهندسو الصيانة (${T.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">يدخل ويرى مديول الصيانة فقط: يعتمد طلبات الفروع ويحدد الموعد والفني، ويسجّل الإصلاح، ويستطيع فتح طلب صيانة لأي فرع بنفسه.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
 ${T.length?T.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,""):""}</tr>`).join(""):empty(own?7:4,"لا يوجد مهندسو صيانة بعد. أضفه من الأعلى واختر \"🔧 مهندس صيانة\"")}</tbody></table></div></div>`:""}
  ${own||U.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">🚢 مديرو المشتريات (${U.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">يدخل ويرى أوامر الشراء فقط: يُنشئ أمر الشراء للمورد ويحدّث مراحل الحاوية حتى «متجه إلى المستودع». تأكيد الاستلام في المستودع لك ولمن تفعّل له «📦 استلام الحاويات» في جدول المديرين أو المحاسبين.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
  ${U.length?U.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,""):""}</tr>`).join(""):empty(own?7:4,"لا يوجد مديرو مشتريات بعد. أضفه من الأعلى واختر \"🚢 مدير المشتريات\"")}</tbody></table></div></div>`:""}
  ${O.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">💼 مناصب أخرى (${O.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">مناصب أُضيفت من نموذج الإضافة. ما يدخله كل موظف يُعدَّل من «🔐 جدول الصلاحيات» في القائمة.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>المنصب</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
  ${O.map(s=>`<tr>${who(s)}<td><span class="pill" data-notr style="white-space:nowrap">${E(s.t)}</span></td>${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,`<button class="bt s" data-sf="ttl" data-id="${E(s.id)}" type="button">✏️ تغيير المنصب</button> <button class="bt s g" data-sf="toadm" data-id="${E(s.id)}" type="button">ترقية لمدير</button> `):""}</tr>`).join("")}</tbody></table></div></div>`:""}
   ${own||C.length?`<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">👑 ملّاك النظام (${C.length})</h3>${X.root?`<p class="off" style="margin:0 0 8px;font-size:13px">لهم كل الصلاحيات (الطلبات والعهدة والموظفين والإعدادات وغيرها)، لكنهم لا يستطيعون تعيين مالك نظام آخر ولا لمس حسابك ولا حسابات ملّاك النظام الآخرين. التعيين والإزالة لك وحدك.</p>`:""}<div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
  ${C.length?C.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,X.root?`<button class="bt s r" data-sf="unco" data-id="${E(s.id)}" type="button">إزالة صلاحية المالك</button> `:""):""}</tr>`).join(""):empty(own?7:4,X.root?'لا يوجد ملّاك نظام بعد. أضف من الأعلى واختر "👑 مالك النظام"، أو رقِّ مديراً من جدول المديرين.':'لا يوجد ملّاك نظام آخرون.')}</tbody></table></div></div>`:""}
  <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">🛡 المديرين (${M.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">صلاحيات كل موظف تُعدَّل من «🔐 جدول الصلاحيات» في القائمة.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
 ${M.length?M.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,`${X.root?`<button class="bt s g" data-sf="tocoo" data-id="${E(s.id)}" type="button">👑 ترقية لمالك نظام</button> `:""}<button class="bt s" data-sf="toacc" data-id="${E(s.id)}" type="button">تحويل لمحاسب</button> `):""}</tr>`).join(""):empty(own?7:4,"لا يوجد مديرون بعد")}</tbody></table></div></div>
 <div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">🧾 المحاسبين (${A.length})</h3><p class="off" style="margin:0 0 8px;font-size:13px">صلاحيات كل موظف تُعدَّل من «🔐 جدول الصلاحيات» في القائمة.</p><div class="tw"><table><thead><tr><th>الاسم</th><th>الكنية</th><th>البريد الإلكتروني</th><th>الحالة</th>${own?"<th>الإشعارات</th><th>كلمة المرور</th><th></th>":""}</tr></thead><tbody>
 ${A.length?A.map(s=>`<tr>${who(s)}${kc(s)}<td class="l" dir="ltr">${E(s.id)}</td><td>${st(s)}</td>${own?nc(s)+pwc(s)+acts(s,`<button class="bt s" data-sf="ttl" data-id="${E(s.id)}" type="button">💼 تحديد منصب</button> <button class="bt s g" data-sf="toadm" data-id="${E(s.id)}" type="button">ترقية لمدير</button> `):""}</tr>`).join(""):empty(own?7:4,"لا يوجد محاسبون بعد")}</tbody></table></div></div>`;
}
// 🔐 جدول الصلاحيات (18 نوفمبر 2026، طلب محمد: "أي صلاحية حطها في الإعدادات في مكانها وأنا أختار أديها لمين، أنا أو مالك النظام").
// صف لكل موظف وعمود لكل صلاحية، والعلامة تُحفظ فوراً. قبل ذلك الخانات كانت في جدولي المديرين والمحاسبين فقط،
// فمهندس الصيانة ومدير المشتريات ومدير التسويق لم يكن لهم أي خانة (مثلاً «مراسلة الفروع» لمهندس الصيانة).
//   المدير يدخل كل الأقسام تلقائياً (خاناتها مقفولة ✓)، ومالك النظام له كل شيء، والمتابع يرى كل شيء ويعمل فقط فيما يُعلَّم له (v222).
//   من يعدّل: الأدمن ومالك النظام كل شيء (حساب مالك النظام للأدمن فقط)، والمدير الذي معه 🔑 يعدّل الأربعة الأولى للمحاسبين.
const PG=[["أقسام يدخلها",[["req","الطلبات"],["cus","العهدة"],["fl","السيارات والسائقين"],["gift","الهدايا: مشاهدة وتسوية"],["mt","الصيانة"],["po","أوامر الشراء"],["stk","تحليل المخزون"],["dc","يومية الفروع"]]],
 ["الحملات التسويقية",[["mk","فريق التسويق"],["mf","تحويلات المؤثرين"]]],// 📣 (v246) مدير التسويق (p.gm) يدير الحملات بحكم دوره
 ["اعتماد واستلام",[["ga","اعتماد الهدايا"],["rcv","استلام الحاويات"]]],
 ["الدردشة",[["cw","مراسلة الفروع"],["chat","الدردشة مفتوحة"]]],
 ["إدارة",[["pm","تعديل صلاحيات المحاسبين"]]]];
const SECK=["req","cus","fl","gift","mt","po"];
const PMX_CSS=`.pmx-t{border-collapse:separate;border-spacing:0;min-width:640px;width:100%;table-layout:auto}.pmx-t th,.pmx-t td{text-align:center;padding:9px 4px;border-bottom:1px solid var(--line)}
.pmx-t thead th{font-size:12px;color:var(--mut);font-weight:700;white-space:normal;line-height:1.4;vertical-align:bottom;min-width:44px}.pmx-t thead tr:first-child th{font-size:13px;color:var(--ink);border-bottom:0;padding-bottom:2px}
.pmx-t thead th.gs,.pmx-t td.gs{border-inline-start:2px solid var(--line)}
.pmx-t td.pn{text-align:start;white-space:normal;min-width:120px;max-width:180px;position:sticky;inset-inline-start:0;background:var(--card);z-index:1}.pmx-t th.pn{text-align:start;position:sticky;inset-inline-start:0;background:var(--card);z-index:1}
.pmx-t td.pn small{display:block;color:var(--mut);font-size:12px;margin-top:2px}.pmx-t tr.dis td{opacity:.55}
.pmx-t input[type=checkbox]{width:20px;height:20px;margin:0;cursor:pointer;accent-color:var(--acc)}.pmx-t input:disabled{cursor:default}
.pmx-lk{color:var(--olive,#6f7d45);font-weight:800}.pmx-na{color:var(--mut);opacity:.5}
.pmx-leg{display:flex;gap:6px 18px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin:0 0 10px}
@media (max-width:760px){.pmx-t{min-width:0;width:100%}.pmx-t thead{display:none}.pmx-t tr{display:grid;grid-template-columns:1fr 1fr;gap:0 10px;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:10px}
 .pmx-t td{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;border-bottom:1px dashed var(--line);padding:8px 0;text-align:start}.pmx-t td.gs{border-inline-start:0}
 .pmx-t td::before{content:attr(data-l);font-size:13px;color:var(--ink)}.pmx-t td.pn{grid-column:1/-1;position:static;border-bottom:1px solid var(--line);padding-bottom:10px}.pmx-t td.pn::before{content:none}}`;
const roleLbl=s=>s.co===true&&s.admin===true?"👑 مالك نظام":s.v===true?"👁 متابع":s.admin===true?"🛡 مدير":isMkt(s)?"📣 مدير تسويق":isEng(s)?"🔧 مهندس صيانة":isPur(s)?"🚢 مدير مشتريات":hasT(s)?'💼 <span data-notr>'+E(s.t)+"</span>":"🧾 محاسب";
export function permView(){
 if(!X)return "";
 if(!g("pmx-css")){const st=document.createElement("style");st.id="pmx-css";st.textContent=PMX_CSS;document.head.appendChild(st)}
 const own=X.owner,me=X.me,L=S.slice().sort((a,b)=>{const r=s=>s.co&&s.admin?0:s.admin&&!s.v?1:s.v?3:2;return r(a)-r(b)||String(a.name||"").localeCompare(String(b.name||""),"ar")});
 const cell=(s,k,first)=>{
  const co=s.co===true&&s.admin===true,vw=s.v===true,adm=s.admin===true&&!vw,id=E(s.id),lab=PG.reduce((a,gp)=>a||((gp[1].find(x=>x[0]===k)||[])[1]),"")||k;
  const td=h=>`<td class="${first?"gs":""}" data-l="${lab}">${h}</td>`,lk='<span class="pmx-lk" title="تلقائياً">✓</span>',na='<span class="pmx-na">—</span>';
  const lockedCo=co&&!X.root;// حساب مالك النظام يعدّله الأدمن فقط
  if(k==="chat"){if(co)return td(lk);const on=!(s.p&&s.p.nc===true);return td(`<input type="checkbox" data-snc="${id}" ${on?"checked":""} ${own?"":"disabled"} aria-label="الدردشة مفتوحة">`)}
  if(k==="cw"){if(vw)return td(lk);return td(`<input type="checkbox" data-scw="${id}" ${s.cw===true?"checked":""} ${own&&!lockedCo?"":"disabled"} aria-label="مراسلة الفروع">`)}
  // 👁 (v222، طلب محمد) المتابع: يرى كل الأقسام كما هو، والقسم الذي يُعلَّم له يعمل فيه فعلاً كأي موظف معه الصلاحية. يمنحها الأدمن ومالك النظام فقط
  if(vw){if(k==="pm")return td(na);const lkv=secDenyKey(k);return td(`<input type="checkbox" data-sp2="${k}" data-id="${id}" ${s.p&&s.p[k]===true?"checked":""} ${own&&!lkv?"":"disabled"} ${lkv?'title="قسم خاص: يعدّلها مالك النظام فقط"':""} aria-label="${lab}">`)}
  if(co)return td(lk);
  if(k==="pm")return adm?td(`<input type="checkbox" data-sp2="pm" data-id="${id}" ${s.p&&s.p.pm===true?"checked":""} ${own?"":"disabled"} aria-label="${lab}">`):td(na);
  if(adm&&SECK.includes(k))return td(lk);
  const lkd=secDenyKey(k);// 🔒 قسم محجوب عني أو «خاص»: صلاحيته لمالك النظام فقط
  const can=!lkd&&(own||(X.pm&&PM_KEYS.includes(k)&&!adm&&!(s.p&&s.p.gm)&&s.id!==me));
  return td(`<input type="checkbox" data-sp2="${k}" data-id="${id}" ${s.p&&s.p[k]===true?"checked":""} ${can?"":"disabled"} ${lkd?'title="قسم خاص: يعدّلها مالك النظام فقط"':""} aria-label="${lab}">`);
 };
 const rows=L.map(s=>`<tr class="${s.enabled?"":"dis"}"><td class="pn"><b>${E(s.name||"")}</b>${s.id===me?' <span class="pill go">أنت</span>':""}<small>${roleLbl(s)}${s.enabled?"":" · معطّل"}</small></td>${PG.map(gp=>gp[1].map((c,i)=>cell(s,c[0],i===0)).join("")).join("")}</tr>`).join("");
 return `<div class="pan"><h3 style="margin:0 0 4px">🔐 جدول الصلاحيات</h3>
 <p class="off" style="margin:0 0 8px;font-size:13.5px;line-height:1.8">${own?"ضع العلامة لمنح الصلاحية وأزلها لسحبها، وتُحفظ فوراً. تصل الموظف عند فتحه المنصة أو خلال لحظات إن كانت مفتوحة.":X.pm?"🔑 يمكنك تعديل الطلبات والعهدة والسيارات والهدايا للمحاسبين. باقي الصلاحيات للأدمن ومالك النظام.":"للمشاهدة. التعديل للأدمن ومالك النظام."}</p>
 <div class="pmx-leg"><span><span class="pmx-lk">✓</span> تلقائياً بحكم الدور (المدير يدخل كل الأقسام)</span><span><span class="pmx-na">—</span> لا تنطبق على هذا الدور</span></div>
 <div class="tw"><table class="pmx-t"><thead><tr><th class="pn" rowspan="2">الموظف</th>${PG.map(gp=>`<th class="gs" colspan="${gp[1].length}">${gp[0]}</th>`).join("")}</tr><tr>${PG.map(gp=>gp[1].map((c,i)=>`<th class="${i===0?"gs":""}">${c[1]}</th>`).join("")).join("")}</tr></thead>
 <tbody>${rows||`<tr><td class="off" colspan="12" style="padding:18px">لا يوجد موظفون بعد. أضفهم من «👥 الموظفون والحسابات».</td></tr>`}</tbody></table></div>
 <p class="off" style="margin:10px 0 0;font-size:13px;line-height:1.8">«تحليل المخزون»: يفتح القسم للمشاهدة والتحليل والإكسل فقط (رفع الملفات والقواعد وإنشاء الطلبات للأدمن ومالك النظام)، ويمنحه الأدمن أو مالك النظام حتى للمدير. «مراسلة الفروع»: يرى الفروع في الدردشة ويراسلها، ويظهر لها في قسم المستودع. «الدردشة مفتوحة»: إزالتها تقفل الدردشة كلها عن الموظف.</p></div>`;
}
// 🔒 الأقسام الخاصة v2 (18 نوفمبر 2026): جدول الأشخاص × الأقسام. مالك النظام يضغط العين ليخفي القسم عن شخص بعينه أو يظهره،
// والجرس ليوقف إشعارات القسم عنه أو يشغّلها، و«خاص» في رأس العمود ليحجبه عن كل من ليس له صلاحيته صراحةً. الأدمن يرى الجدول للعرض فقط.
const LKM_CSS=`.lkm-t{border-collapse:separate;border-spacing:0;width:100%;min-width:620px}.lkm-t th,.lkm-t td{text-align:center;padding:9px 6px;border-bottom:1px solid var(--line)}
.lkm-t thead th{font-size:13px;color:var(--ink);font-weight:700;vertical-align:bottom;line-height:1.5}.lkm-t thead th span{display:block}.lkm-t thead th small{display:block;color:var(--acc);font-size:12px}
.lkm-t th.pn,.lkm-t td.pn{text-align:start;position:sticky;inset-inline-start:0;background:var(--card);z-index:1;min-width:130px;max-width:190px}.lkm-t td.pn small{display:block;color:var(--mut);font-size:12px;margin-top:2px}
.lkm-on{font:inherit;font-size:12px;font-weight:700;margin-top:5px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--mut);cursor:pointer}.lkm-on.on{background:var(--acc);border-color:var(--acc);color:#fff}
.lkm-c{display:inline-flex;gap:6px;align-items:center;justify-content:center}
.lkm-b{font:inherit;font-size:16px;line-height:1;width:38px;height:36px;padding:0;border-radius:10px;border:1px solid var(--line);background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.lkm-b:disabled{cursor:default}.lkm-b.v{background:color-mix(in srgb,var(--olive,#6f7d45) 14%,transparent);border-color:color-mix(in srgb,var(--olive,#6f7d45) 45%,transparent);color:var(--olive,#6f7d45)}
.lkm-b.h{background:rgba(196,54,43,.12);border-color:rgba(196,54,43,.4);color:#c4362b}.lkm-b.r{background:color-mix(in srgb,var(--acc) 16%,transparent);border-color:var(--acc);color:var(--acc)}.lkm-b.x{color:var(--mut);opacity:.5;border-style:dashed}.lkm-b.n{color:var(--ink)}.lkm-b.m{color:var(--mut);opacity:.6;border-style:dashed}
.lkm-leg{display:flex;gap:6px 18px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin:12px 0 0}.lkm-n{color:var(--mut);font-size:13px;line-height:1.9;margin:10px 0 0}
@media (max-width:760px){.lkm-t{min-width:0}.lkm-t thead{display:none}.lkm-t tr{display:block;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:10px}
 .lkm-t td{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;border-bottom:1px dashed var(--line);padding:8px 0;text-align:start}.lkm-t td:last-child{border-bottom:0}
 .lkm-t td::before{content:attr(data-l);font-size:13.5px;color:var(--ink)}.lkm-t td.pn{position:static;max-width:none;border-bottom:1px solid var(--line);padding-bottom:10px}.lkm-t td.pn::before{content:none}
 .lkm-mode{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.lkm-mode span{display:inline-flex;align-items:center;gap:6px;font-size:13px}}
@media (min-width:761px){.lkm-mode{display:none}}`;
const lkPeople=()=>{const rt=String(X.rootEmail||"").toLowerCase(),L=[{id:rt,n:ownerMe().n||OWNER_NAME,r:"👑 الأدمن",root:true,adm:true,vw:false,p:{}}];
 S.filter(s=>s.enabled&&!(s.admin===true&&s.co===true&&s.v!==true)).sort((a,b)=>{const r=s=>s.admin&&!s.v?0:s.v?1:2;return r(a)-r(b)||String(a.name||"").localeCompare(String(b.name||""),"ar")})
  .forEach(s=>L.push({id:String(s.id).toLowerCase(),n:s.name||s.id,r:roleLbl(s),root:false,adm:s.v!==true&&s.admin===true,vw:s.v===true,p:s.p||{}}));return L};// (v222) صلاحيات المتابع المعلَّمة تُحسب كما في القواعد
const secRole=(u,k)=>k==="log"?(u.root||u.vw):(u.root||u.adm||u.vw||(k==="gift"&&u.p.req===true)||SEC_EXP[k].some(x=>u.p[x]===true));
const secExpU=(u,k)=>!u.root&&SEC_EXP[k].some(x=>u.p[x]===true);
const secVis=(o,u,k)=>!o[k].hide.includes(u.id)&&(!o[k].on||o[k].al.includes(u.id)||secExpU(u,k));
// من تصله إشعارات القسم أصلاً (نفس جمهور السيرفر): الحاويات للأدمن والمديرين والمحاسبين ومن يستلم؛ الهدايا لمن يعتمد ويسوّي؛ الصيانة للأدمن والمهندس
const secNtf=(u,k)=>!u.vw&&(k==="po"?(u.root||u.adm||["rcv","po","req","cus","fl","gift"].some(x=>u.p[x]===true)):k==="gift"?["gm","ga","gift"].some(x=>u.p[x]===true):k==="mt"?(u.root||u.p.mt===true):false);
export function lockView(){
 if(!X||!X.owner)return "";
 if(!g("lkm-css")){const st=document.createElement("style");st.id="lkm-css";st.textContent=LKM_CSS;document.head.appendChild(st)}
 const o=lkGet(),P=lkPeople(),co=X.co===true,dis=co?"":"disabled",me=String(X.me||"").toLowerCase();
 const modeBtn=k=>co?`<button type="button" class="lkm-on ${o[k].on?"on":""}" data-lkon="${k}" title="خاص: يُحجب عن كل من ليس له صلاحية القسم صراحةً، حتى من يُضاف لاحقاً">${o[k].on?"🔒 خاص":"عادي"}</button>`:o[k].on?"<small>🔒 خاص</small>":"";
 const cell=(u,a)=>{const k=a[0],l=a[1],role=secRole(u,k),ntf=secNtf(u,k);
  const vis=role&&secVis(o,u,k),mu=o[k].mute.includes(u.id),nm=E(u.n)+" · "+l;
  // 📦 استلام الحاويات بلا تفاصيل (عمود أوامر الشراء فقط): لمن لا يستلم من القسم نفسه. المتابع لا يستلم
  const rOn=k==="po"&&o.po.rcv.includes(u.id),rc=k==="po"&&!u.vw&&!(vis&&(u.root||u.p.rcv===true))&&(co||rOn);
  if(!role&&!ntf&&!rc)return `<td data-l="${l}"><span class="pmx-na" style="color:var(--mut);opacity:.5">—</span></td>`;
  return `<td data-l="${l}"><span class="lkm-c">${role?`<button type="button" class="lkm-b ${vis?"v":"h"}" data-lkc="${E(u.id)}|${k}" ${dis} aria-label="${nm}: ${vis?"يرى":"مخفي عنه"}" title="${vis?"يرى القسم":"مخفي عنه"}">${vis?"👁":"🚫"}</button>`:""}${ntf?`<button type="button" class="lkm-b ${mu?"m":"n"}" data-lkb="${E(u.id)}|${k}" ${dis} aria-label="${nm}: ${mu?"الإشعارات متوقفة":"تصله الإشعارات"}" title="${mu?"الإشعارات متوقفة":"تصله الإشعارات"}">${mu?"🔕":"🔔"}</button>`:""}${rc?`<button type="button" class="lkm-b ${rOn?"r":"x"}" data-lkr="${E(u.id)}|po" ${dis} aria-label="${nm}: ${rOn?"يستلم الحاويات بلا تفاصيل":"لا يستلم الحاويات"}" title="${rOn?"يستلم الحاويات بلا تفاصيل":"لا يستلم الحاويات"}">📦</button>`:""}</span></td>`};
 const rows=P.map(u=>`<tr><td class="pn"><b data-notr>${E(u.n)}</b>${u.id===me?' <span class="pill go">أنت</span>':""}<small>${u.r}</small></td>${SECS.map(a=>cell(u,a)).join("")}</tr>`).join("");
 const mine=SECS.filter(a=>{const u=P.find(p=>p.id===me);return u&&secRole(u,a[0])&&!secVis(o,u,a[0])}).map(a=>a[1]);
 return `<div class="pan"><h3 style="margin:0 0 4px">🔒 الأقسام الخاصة</h3>
 <p class="off" style="margin:0 0 10px;font-size:13.5px;line-height:1.8">${co?"اضغط العين لتخفي القسم عن الشخص أو تظهره له، والجرس لتوقف إشعاراته عنه أو تشغّلها. يُحفظ فوراً، والتعديل هنا لك وحدك.":"للعرض فقط. الإخفاء والإظهار والإشعارات يحددها مالك النظام."}</p>
 ${co?`<div class="lkm-mode">${SECS.map(a=>`<span>${a[1]} ${modeBtn(a[0])}</span>`).join("")}</div>`:""}
 <div class="tw"><table class="lkm-t"><thead><tr><th class="pn">الشخص</th>${SECS.map(a=>`<th><span>${a[1]}</span>${modeBtn(a[0])}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
 <div class="lkm-leg"><span>👁 يرى القسم</span><span>🚫 مخفي عنه</span><span>🔔 تصله إشعاراته</span><span>🔕 إشعاراته متوقفة</span><span>📦 يستلم الحاويات بلا تفاصيل</span><span>— ليس من صلاحيته</span></div>
 ${co?`<p class="lkm-n">«خاص» يحجب القسم عن كل من ليس له صلاحيته صراحةً (الأدمن والمديرون والمتابع)، حتى من يُضاف لاحقاً، ثم تُظهره لمن تريد من الجدول. والإخفاء بالاسم يغلب أي صلاحية.<br>الإخفاء لا يوقف الإشعارات: أطفئ الجرس لمن لا تريد أن تصله. لا أسعار ولا مرفقات في أي إشعار.<br>📦 في عمود أوامر الشراء يفتح للشخص شاشة «استلام الحاويات» فقط، حتى لو كان القسم مخفياً عنه: يرى المورد والوصف وأرقام الحاويات والأصناف ويؤكد الاستلام، بلا قيمة ولا مرفقات.<br>القسم المحجوب عن شخص لا يدخل نسخته الاحتياطية، فخذ نسختك من زر «📥 نسخة». كل تغيير هنا يُسجَّل في «📜 السجل».</p>`
 :mine.length?`<p class="lkm-n">ما حُجب عنك (${mine.join("، ")}) لا يدخل في النسخة الاحتياطية التي تأخذها. النسخة الكاملة عند مالك النظام.</p>`:""}</div>`;
}
async function lockSave(o){const out={at:Date.now(),by:String(X.me||"").slice(0,120)};SECS.forEach(a=>{const x=o[a[0]];if(x.on||x.al.length||x.hide.length||x.mute.length||x.rcv.length){out[a[0]]={on:x.on,al:x.al.slice(0,80),hide:x.hide.slice(0,80),mute:x.mute.slice(0,80)};if(a[0]==="po"&&x.rcv.length)out.po.rcv=x.rcv.slice(0,80)}});await setDoc(doc(X.db,"cfg","lock"),out)}
async function lockClick(t){
 if(!X.co){X.toast("قفل الأقسام وفتحها لمالك النظام فقط");return}
 const o=lkGet(),P=lkPeople();
 try{
  if(t.dataset.lkon){const k=t.dataset.lkon,nm=(SECS.find(a=>a[0]===k)||[])[1],x=o[k];if(!x)return;
   if(!confirm(x.on?`إلغاء «خاص» عن ${nm}؟\n\nسيراه كل من يسمح له دوره، إلا من أخفيته عنه بالاسم.`:`جعل ${nm} قسماً خاصاً؟\n\nسيُحجب عن كل من ليس له صلاحيته صراحةً (الأدمن والمديرون والمتابع)، حتى من يُضاف لاحقاً. بعدها أظهره لمن تريد من الجدول.\n\nتذكّر: خذ نسختك الاحتياطية بنفسك، فنسخة غيرك لن تشمل هذا القسم.`))return;
   x.on=!x.on;await lockSave(o);X.toast(x.on?"🔒 أصبح القسم خاصاً":"🔓 أُلغي «خاص» عن القسم");return}
  if(t.dataset.lkr){const rid=t.dataset.lkr.split("|")[0],ru=P.find(p=>p.id===rid),rx=o.po;if(!ru)return;const ri=rx.rcv.indexOf(rid);if(ri>=0)rx.rcv.splice(ri,1);else rx.rcv.push(rid);await lockSave(o);
   X.toast(ri>=0?"أُلغي استلام الحاويات عن "+ru.n:"📦 أصبح "+ru.n+" يستلم الحاويات من شاشة الاستلام، بلا قيمة ولا مرفقات");return}
  const parts=String(t.dataset.lkc||t.dataset.lkb||"").split("|"),id=parts[0],k=parts[1],u=P.find(p=>p.id===id),x=o[k],nm=(SECS.find(a=>a[0]===k)||[])[1];if(!u||!x)return;
  if(t.dataset.lkb){const i=x.mute.indexOf(id);if(i>=0)x.mute.splice(i,1);else x.mute.push(id);await lockSave(o);X.toast(i>=0?"🔔 عادت إشعارات «"+nm+"» إلى "+u.n:"🔕 أُوقفت إشعارات «"+nm+"» عن "+u.n);return}
  const vis=secVis(o,u,k);
  if(vis){if(x.on&&x.al.includes(id)&&!secExpU(u,k))x.al=x.al.filter(v=>v!==id);else x.hide.push(id)}
  else{x.hide=x.hide.filter(v=>v!==id);if(x.on&&!secExpU(u,k)&&!x.al.includes(id))x.al.push(id)}
  await lockSave(o);
  X.toast(vis?("أُخفي «"+nm+"» عن "+u.n+(secNtf(u,k)&&!x.mute.includes(id)?". الإشعارات ما زالت تصله: اضغط الجرس لإيقافها":"")):"أصبح "+u.n+" يرى «"+nm+"»");
 }catch(e){X.toast("تعذر الحفظ: "+(e&&e.code||e&&e.message));X.redraw()}
}
async function add(){
 const e=f.e.trim().toLowerCase(),n=f.n.trim().slice(0,40);
 if(f.r==="co"&&!X.root){X.toast("تعيين مالك النظام للأدمن فقط");return}
  if(!EMAIL.test(e)||e.length>120||e.endsWith("@tasooma.app")){X.toast("اكتب بريداً إلكترونياً صحيحاً");return}
 if(!n){X.toast("اكتب اسم المحاسب");return}
 if(S.some(s=>s.id===e)){X.toast("هذا المحاسب مضاف بالفعل");return}
 // 💼 منصب جديد أو منصب أُضيف من قبل
 if((f.r==="pur"&&secDeny("po"))||(f.r==="mkt"&&secDeny("gift"))||(f.r==="eng"&&secDeny("mt"))){X.toast(LK_MSG);return}
 const cus=isCus();let ttl="";
 if(cus){ttl=tClean(f.r==="new"?f.t:f.r.slice(2));const te=tErr(ttl);if(te){X.toast(te);const el=g("sft");if(el)el.focus();return}ttl=tSame(ttl)}
 busy=true;X.redraw();
 try{
  const a=makeFb("sec").auth;let pw=f.p.trim();
  // كلمة مرور مكتوبة: ننشئ الحساب بها، ولو البريد له حساب بالفعل نربطه بنفس كلمة المرور (لازم تكون كلمته الحالية)
  if(pw){
   try{await createUserWithEmailAndPassword(a,e,pw)}
   catch(x){if(x&&x.code==="auth/email-already-in-use"){try{await signInWithEmailAndPassword(a,e,pw)}catch(y){if(y&&(y.code==="auth/invalid-credential"||y.code==="auth/wrong-password"))throw {code:"x/exists-wrong-pw"};throw y}}else throw x}
   finally{try{await signOut(a)}catch(x){}}
  }
  // 🛟 (v239) محاولة سابقة عملت الحساب وفشلت قبل ملف الموظف: البريد «موجود» وكلمة المرور الجديدة غلط فكانت الإضافة بتقف للأبد.
  // دلوقتي (البريد مش موظف عندنا أصلاً) بنظبط كلمة المرور من السيرفر ونكمّل
  else{pw=genPw();try{await createUserWithEmailAndPassword(a,e,pw)}catch(x){if(x&&x.code==="auth/email-already-in-use"&&X.setPw)await X.setPw(e,pw);else throw x}finally{try{await signOut(a)}catch(x){}}}
  X.tmpPw[e]=pw;// 🔑 لا تُحفظ في القاعدة: تظهر في فتحة الصفحة هذه فقط
  const adm=f.r==="adm",vw=f.r==="view",mk=f.r==="mkt",eg=f.r==="eng",pu=f.r==="pur",co=f.r==="co"&&X.root===true;
  // المتابع: من غير أي صلاحية تعديل (v = يشوف بس)
  await setDoc(doc(X.db,"staff",e),co?{name:n,enabled:true,admin:true,co:true,p:{}}:vw?{name:n,enabled:true,admin:false,v:true,p:{}}:mk?{name:n,enabled:true,admin:false,p:{gm:true}}:eg?{name:n,enabled:true,admin:false,cw:true,p:{mt:true}}:pu?{name:n,enabled:true,admin:false,p:{po:true}}:cus?{name:n,enabled:true,admin:false,t:ttl,p:tP()}:{name:n,enabled:true,admin:adm,p:secDeny("cus")?{req:true,fl:true}:{req:true,cus:true,fl:true}});
  f={e:"",n:"",p:"",r:"acc",t:"",tp:{}};X.toast("تمت إضافة "+n+(co?" كمالك نظام (كل الصلاحيات)":vw?" كمتابع (للمشاهدة فقط)":mk?" كمدير تسويق (الهدايا فقط)":eg?" كمهندس صيانة (الصيانة فقط)":pu?" كمدير مشتريات (أوامر الشراء فقط)":cus?" بمنصب «"+ttl+"» — راجع الصلاحيات":adm?" كمدير":" — راجع الصلاحيات"));
 }catch(x){if(!(window.uiAuthErr&&uiAuthErr(x,"الموظف")))X.toast(AERR(x))}
 busy=false;X.redraw();
}
async function click(e){
 const lk=e.target.closest("[data-lkc],[data-lkb],[data-lkon],[data-lkr]");if(lk&&X){lockClick(lk);return}
 const t=e.target.closest("[data-sf]");if(!t||!X)return;
 const a=t.dataset.sf,id=t.dataset.id,s=S.find(x=>x.id===id);
 if(!X.owner&&a!=="show"){X.toast("التعديل لمالك النظام فقط");return}
  if(s&&s.co&&!X.root&&a!=="show"){X.toast("حسابات ملّاك النظام للأدمن فقط");return}
  if((a==="tocoo"||a==="unco")&&!X.root){X.toast("تعيين ملّاك النظام وإزالتهم للأدمن فقط");return}
 try{
  if(a==="add")await add();
  else if(a==="chat"&&s){const off=!(s.p&&s.p.nc===true);if(!off||confirm(`قفل الدردشة لـ ${s.name}؟\nلن يرى المحادثات ولا يستطيع المراسلة حتى تفتحها له مرة أخرى.`)){await updateDoc(doc(X.db,"staff",id),{"p.nc":off});X.toast(off?"🔒 قُفلت الدردشة لـ "+s.name:"💬 فُتحت الدردشة لـ "+s.name)}}
   else if(a==="tocoo"&&s){if(confirm(`ترقية ${s.name} لمالك نظام؟\n\nسيحصل على كل صلاحياتك تقريباً: الموظفين والعهدة والطلبات والإعدادات وغيرها. ولن يستطيع لمس حساب الأدمن ولا تعيين ملّاك آخرين.`)){await updateDoc(doc(X.db,"staff",id),{co:true,admin:true});X.toast("👑 أصبح مالك نظام");
    // 🛡 (17 نوفمبر 2026) كلمة مروره الحالية كان أي مدير يقدر يشوفها قبل الترقية، فبنعرض على الأدمن تغييرها فوراً
    if(confirm(`يُنصح بتغيير كلمة مرور ${s.name} الآن، فقد تكون معروفة لغيره.\n\nهل تريد تغييرها الآن؟ بعدها اضغط «إظهار» لنسخ الكلمة الجديدة وإرسالها له.`)){
     const nw=genPw();await X.setPw(id,nw);X.tmpPw[id]=nw;X.toast("تم تغيير كلمة المرور. اضغط «إظهار» لنسخها");X.redraw()}}}
   else if(a==="unco"&&s){if(confirm(`إزالة صلاحية مالك النظام من ${s.name}؟\nسيرجع مديراً عادياً.`)){await updateDoc(doc(X.db,"staff",id),{co:false});X.toast("رجع مديراً عادياً")}}
   else if((a==="toadm"||a==="toacc")&&s){const up=a==="toadm";
   if(confirm(up?`ترقية ${s.name} لمدير؟`:`تحويل ${s.name} لمحاسب؟`)){await updateDoc(doc(X.db,"staff",id),{admin:up});X.toast(up?"أصبح مديراً 🛡":"أصبح محاسباً")}}
  else if(a==="ttl"&&s){
   const q=prompt(hasT(s)?"اكتب المنصب الجديد، أو اتركه فارغاً لإزالة المنصب وإرجاعه محاسباً:":"اكتب منصب "+s.name+" (مثلاً: أمين مخزن):",s.t||"");if(q===null)return;
   const v=tClean(q);if(v){const te=tErr(v);if(te){X.toast(te);return}}else if(!hasT(s))return;
   await updateDoc(doc(X.db,"staff",id),{t:v?tSame(v):""});X.toast(v?"حُفظ المنصب":"أُزيل المنصب");
  }
  else if(a==="show"){const el=document.querySelector(`[data-spc="${id}"]`);if(el){const sh=el.dataset.v==="1";el.textContent=sh?"••••••••":PW()[id];el.dataset.v=sh?"0":"1";t.textContent=sh?"إظهار":"إخفاء"}}
  else if(a==="tg"&&s){if(!s.enabled||confirm(`تعطيل ${s.name}؟ سيتم فصله فوراً ولن يتمكن من الدخول.`)){await updateDoc(doc(X.db,"staff",id),{enabled:!s.enabled});X.toast(s.enabled?"تم التعطيل":"تم التفعيل")}}
  else if(a==="pw"&&s){
   const q=prompt("كلمة المرور الجديدة (6 أحرف على الأقل). اتركها فارغة لتوليد واحدة:","");if(q===null)return;
   const nw=q.trim()||genPw();await X.setPw(id,nw);X.tmpPw[id]=nw;X.toast("تم تغيير كلمة المرور ✅ انسخ الرسالة الآن: الكلمة لا تُحفظ ولن تظهر بعد إغلاق الصفحة");X.redraw();
  }
  // إشعار تجربة لأجهزة الشخص ده، ونقول وصل لأنهي جهاز
  else if(a==="ntest"&&X.test){
   testing=id;X.redraw();
   try{const r=await X.test(id),nm=id===X.me?"لك":"لـ "+(s&&s.name||id);
    if(!r.n)X.toast(`⚠️ لا يوجد أي جهاز مسجّل ${nm}. عليه فتح المنصة من الجوال أو الحاسوب والضغط على "🔔 فعّل الإشعارات"`);
    else X.toast(`أُرسل ${nm}: `+r.dev.map(d=>`${d.dv==="m"?"📱":d.dv==="pc"?"💻":"❔"} ${d.ok?"✅ وصل":d.gone?"❌ هذا الجهاز لم يعد يستقبل (أُزيل)":"❌ لم يتم"}`).join(" · "))}
   catch(x){X.toast("تعذر الإرسال. تأكد من تحديث الخادم (wrangler deploy) وأن الإنترنت يعمل")}
   testing="";X.redraw();return;
  }
  else if(a==="cp"&&s){if(!PW()[id]){X.toast("كلمة المرور لا تُحفظ. غيّرها أولاً ثم انسخ الرسالة");return}cpy(msg(s))}
  else if(a==="del"&&s){if(confirm(`حذف المحاسب ${s.name}؟ سيفقد كل الصلاحيات.`)){await deleteDoc(doc(X.db,"staff",id));delete X.tmpPw[id];X.toast("تم الحذف")}}
 }catch(x){X.toast(AERR(x))}
}
export function initStaff(ctx){
 X=ctx;stop();PW=ctx.pw;
 if(!window.__stc){window.__stc=1;
  document.addEventListener("click",click);
  document.addEventListener("input",e=>{const k={sfe:"e",sfn:"n",sfp:"p",sft:"t"}[e.target.id];if(k)f[k]=e.target.value});
  document.addEventListener("change",async e=>{const t=e.target;if(!X||!t.dataset)return;
   if(t.id==="sfr"){const was=isCus();f.r=t.value;f.tp={};
    // منصب أُضيف من قبل: نبدأ بنفس أقسام من يشغله الآن (تظهر في الخانات قبل الإضافة)
    if(f.r.indexOf("t:")===0){const h=S.filter(x=>hasT(x)&&tClean(x.t)===f.r.slice(2)).sort((a,b)=>(b.enabled?1:0)-(a.enabled?1:0))[0];if(h&&h.p)Object.keys(SECL).forEach(k=>{if(h.p[k]===true)f.tp[k]=true})}
    if(was||isCus()){X.redraw();if(f.r==="new")setTimeout(()=>{const el=g("sft");if(el)el.focus()},260)}return}
   if(t.dataset.stp){if(X.owner)f.tp[t.dataset.stp]=t.checked;return}
   if(t.dataset.sp2&&secDenyKey(t.dataset.sp2)){t.checked=!t.checked;X.toast(LK_MSG);return}
   // الكنية: بتتحفظ أول ما تخلّص كتابة (وبتظهر للفروع في الدردشة لوحدها)
   if(t.dataset.sk&&X.owner){try{await updateDoc(doc(X.db,"staff",t.dataset.sk),{k:t.value.trim().slice(0,40)});X.toast("حُفظت الكنية")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}return}
   if(t.dataset.scw&&X.owner){try{await updateDoc(doc(X.db,"staff",t.dataset.scw),{cw:t.checked});X.toast(t.checked?"💬 يستطيع مراسلة الفروع ويظهر لها":"لن يراسل الفروع ولن يظهر لها")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message));X.redraw()}return}
   if(t.dataset.snc&&X.owner){const off=!t.checked,s=S.find(x=>x.id===t.dataset.snc);
    if(off&&!confirm(`قفل الدردشة لـ ${s&&s.name||""}؟\nلن يرى المحادثات ولا يستطيع المراسلة حتى تفتحها له مرة أخرى.`)){t.checked=true;return}
    try{await updateDoc(doc(X.db,"staff",t.dataset.snc),{"p.nc":off});X.toast(off?"🔒 قُفلت الدردشة":"💬 فُتحت الدردشة")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message));X.redraw()}return}
   if(!t.dataset.sp2||!(X.owner||(X.pm&&PM_KEYS.includes(t.dataset.sp2))))return;
   try{await updateDoc(doc(X.db,"staff",t.dataset.id),{["p."+t.dataset.sp2]:t.checked});X.toast("تم حفظ الصلاحية")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message));X.redraw()}});
 }
 un.push(onSnapshot(collection(X.db,"staff"),sn=>{S=sn.docs.map(d=>({id:d.id,...d.data()}));SL=true;syncDir();if(X.tab()==="stf"&&!busy)X.redraw()},()=>X.toast("تعذر قراءة الموظفين. حدّث القواعد (Rules)")));
 if(X.owner)un.push(onSnapshot(collection(X.db,"whdir"),sn=>{WD={};sn.docs.forEach(d=>{WD[d.id]=d.data()});syncDir()},()=>{}));
 // أجهزة الإشعارات (جوال/حاسوب) لكل واحد في المستودع
 if(X.owner)un.push(onSnapshot(query(collection(X.db,"push"),where("role","==","staff")),sn=>{DV={};sn.docs.forEach(d=>{const x=d.data(),k=String(x.email||"").toLowerCase();(DV[k]=DV[k]||[]).push({dv:x.dv||"",ts:x.ts||0})});if(X.tab()==="stf"&&!busy)X.redraw()},()=>{}));
}
export function stop(){un.forEach(x=>x());un=[];S=[];SL=false;WD=null;DV={};testing="";busy=false}
