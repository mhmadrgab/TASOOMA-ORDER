// 📎 مرفقات متعددة لأي حاجة (13 نوفمبر 2026، طلب محمد: "أي عدد صور مش صورة واحدة").
// الصورة الأولى بتفضل في مكانها القديم زي ما هي (giftimg/{id}.img ، pods/{id}.img ، ledger/{id}.img)
// علشان كل حاجة قديمة تفضل شغّالة، والباقي في {المجموعة}/{الرقم}/x/2 .. x/10 = {img} (مستند لكل صورة).
// 📄 (15 نوفمبر 2026) PDF حتى 2 ميجا في مستند واحد: x/N = {pdf:"data:application/pdf;base64,...", nm}. (الشكل القديم، ما زال يُقرأ)
// 📎 (19 نوفمبر 2026، v175، طلب محمد: "ملفات مش بس صور، وأكبر من 2 ميجا، وفي كل المرفقات"):
//   • أي ملف من الأنواع المسموحة (PDF، إكسل، وورد، باوربوينت، نص، ملف مضغوط) حتى 3 ميجا (FILE_MAX).
//   • الملف لا يُحفظ في مستند واحد: «رأس» صغير في مكان المرفق x/N = {fl:1, nm, sz, pn}، والمحتوى base64 مقسوم على pn جزء
//     (كل جزء ≤ 900 ألف حرف) في {المجموعة}/{الرقم}/xf/{N}_{k} = {d}. الأجزاء تُكتب أولاً ثم الرأس (المرفق لا يظهر إلا كاملاً).
//     فالطلب الواحد يبقى صغيراً، وقائمة المرفقات (loadExtras) لا تنزّل محتوى الملفات: التنزيل عند الضغط فقط.
//   • الملف في القائمة يُمثَّل بنص مرجعي src = "tzf:{مسار الرأس}|{pn}|{sz}" (isFileRef) فتبقى الأماكن التي تمرّر {src,nm} كما هي.
//   • الأمان: الامتداد من القائمة فقط (والقواعد ترفض غيرها)، والملف لا يُفتح داخل الصفحة أبداً: تنزيل عبر Blob بنوع
//     application/octet-stream، وPDF فقط يُفتح في تبويب جديد بعد التأكد من أول بايتاته (%PDF-).
// القواعد في supabase/002_rules.sql (att_ok / fhead_ok / fpart_ok، و xf / af في can_read و can_write).
import {doc,getDoc,getDocs,collection,setDoc,deleteDoc} from "./fb.js";
import {shrink} from "./cust.js";
export const MAXI=10;
export const FILE_MAX=3*1024*1024;// 3 ميجا: نفس الرقم في القواعد (file_max) وفي السيرفر (رابط السائق الخارجي)
export const PDF_MAX=FILE_MAX;
// 📎 (v263) أوامر الشراء فقط: 15 ميجا للملف (محمد). القواعد نفس الرقم (file_max_po). باقي المرفقات 3 ميجا زي ما هي
export const PO_FILE_MAX=15*1024*1024;
export const fileMaxOf=col=>col==="poatt"?PO_FILE_MAX:FILE_MAX;
export const mbText=n=>Math.round((+n||0)/1048576)+" ميجا";
export const FILE_CH=900000;// حروف base64 في الجزء الواحد (من مضاعفات 4، فكل جزء base64 صالح وحده)
export const FILE_EXT=["pdf","xlsx","xls","csv","docx","doc","pptx","ppt","txt","zip","rar"];
// أنواع MIME أيضاً (تطبيق الأندرويد يختار بالنوع لا بالامتداد)
export const FILE_ACCEPT="image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/comma-separated-values,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,text/plain,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed,"+FILE_EXT.map(e=>"."+e).join(",");
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CSS=`.mp{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;margin-top:6px}
.mp .mt{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f3edf1;border:1px solid var(--line,#e3d5c3)}
.mp .mt img{width:100%;height:100%;object-fit:cover;display:block}
.mp .mt.pdf{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;text-align:center;background:#fbf3f2}
.mp .mt.pdf i{font-style:normal;font-size:28px;line-height:1}.mp .mt.pdf span{font-size:11.5px;line-height:1.3;word-break:break-all;color:var(--ink,#2a1d2c);max-height:3.9em;overflow:hidden}
.mp .mt.pdf small{font-size:10.5px;color:var(--mut,#74687a)}
.mp .mt b{position:absolute;top:4px;inset-inline-start:4px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border-radius:8px;padding:1px 6px}
.mp .mt button{position:absolute;top:4px;inset-inline-end:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:15px;line-height:26px;padding:0;cursor:pointer}
.mp .ma{aspect-ratio:1;border-radius:12px;border:2px dashed var(--line,#d9d4cb);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--mut,#74687a);font-size:12.5px;text-align:center;padding:6px;background:transparent;font-family:inherit}
.mp .ma.cam{border-style:solid;border-color:var(--acc,#8a5a83);color:var(--acc,#8a5a83);font-weight:700}
.mp .ma i{font-style:normal;font-size:24px}
.mp .ma.wait{cursor:progress;opacity:.7}
.mp-h{font-size:12.5px;color:var(--mut,#74687a);margin-top:4px}
:where([data-theme=dark]) .mp .mt{background:#282029}:where([data-theme=dark]) .mp .mt.pdf{background:#2e2427}`;
function css(){if(!document.getElementById("mp-css")){const s=document.createElement("style");s.id="mp-css";s.textContent=CSS;document.head.appendChild(s)}}
let SEQ=0;
export const kbText=n=>{n=+n||0;return n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB"};
const kb=kbText;
export const isPdfData=s=>typeof s==="string"&&/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(s);
const pdfName=n=>String(n||"ملف.pdf").replace(/[\u0000-\u001f<>"'\\/:*?|]/g,"").slice(0,100)||"ملف.pdf";
const isPdfFile=f=>f&&(f.type==="application/pdf"||/\.pdf$/i.test(f.name||""));
// ---------- أسماء الملفات وأنواعها ----------
export const extOf=n=>{const m=/\.([A-Za-z0-9]{1,5})$/.exec(String(n||"").trim());return m?m[1].toLowerCase():""};
export const extOk=n=>FILE_EXT.indexOf(extOf(n))>=0;
// رموز HTML وفواصل المسارات ورموز التحكم ورموز قلب الاتجاه (تُستعمل لتزوير الامتداد): تُحذف من الاسم
const BADCH=/[\u0000-\u001f\u007f<>"'&\\/:*?|‎‏‪-‮⁦-⁩]/g;
// اسم نظيف بامتداد مسموح، أو "" لو الامتداد غير مسموح
export function fileName(n){
 const s=String(n||"").replace(BADCH,"").replace(/\s+/g," ").trim(),e=extOf(s);
 if(!e||FILE_EXT.indexOf(e)<0)return "";
 const base=s.slice(0,s.length-e.length-1).replace(/[. ]+$/,"").trim()||"ملف";
 return base.slice(0,100)+"."+e;
}
export const fileLabel=n=>(extOf(n)||"ملف").toUpperCase();
export const filePn=sz=>Math.max(1,Math.ceil(Math.ceil((+sz||0)/3)*4/FILE_CH));
const isImgFile=f=>f&&(/^image\//.test(f.type||"")||(!f.type&&/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name||"")));
// ---------- المرجع النصي للملف: "tzf:{المجموعة}/{الرقم}/{x أو a}/{N}|{pn}|{sz}" ----------
const REF=/^tzf:([A-Za-z0-9_-]{1,40})\/([A-Za-z0-9_-]{1,64})\/(x|a)\/([0-9]{1,2})\|([0-9]{1,2})\|([0-9]{1,8})$/;
export const fileRef=(col,id,sub,k,pn,sz)=>`tzf:${col}/${id}/${sub}/${k}|${pn}|${sz}`;
export const isFileRef=s=>typeof s==="string"&&REF.test(s);
export function parseRef(s){const m=REF.exec(String(s||""));return m?{col:m[1],id:m[2],sub:m[3],k:+m[4],pn:+m[5],sz:+m[6],path:`${m[1]}/${m[2]}/${m[3]}/${m[4]}`}:null}
const partDoc=(db,r,j)=>doc(db,r.col,r.id,r.sub+"f",r.k+"_"+j);
// ---------- قراءة ملف من الجهاز ----------
// بيرجّع {fl:1, nm, sz, b64}. الأخطاء: big (أكبر من الحد) · type (نوع غير مسموح) · notpdf (اسمه PDF وليس PDF) · empty · read
export function readFile(f,mx){
 return new Promise((ok,no)=>{
  if(!f)return no(new Error("read"));
  const nm=fileName(f.name);if(!nm)return no(new Error("type"));
  if(!(f.size>0))return no(new Error("empty"));
  if(f.size>(mx||FILE_MAX))return no(new Error("big"));
  const r=new FileReader();r.onerror=()=>no(new Error("read"));
  r.onload=()=>{const s=String(r.result||""),i=s.indexOf(","),b=i>0?s.slice(i+1):"";
   if(!b||!/^[A-Za-z0-9+/]+={0,2}$/.test(b))return no(new Error("read"));
   if(extOf(nm)==="pdf"&&!/^JVBERi0/.test(b))return no(new Error("notpdf"));
   ok({fl:1,nm,sz:f.size,b64:b})};
  r.readAsDataURL(f);
 });
}
// (الشكل القديم) قراءة PDF كرابط data: — باقية لمن يستوردها
export function readPdf(f){
 return new Promise((ok,no)=>{
  if(!f||f.size>PDF_MAX)return no(new Error("big"));
  const r=new FileReader();r.onerror=()=>no(new Error("read"));
  r.onload=()=>{const s=String(r.result||""),i=s.indexOf(",");const b=i>0?s.slice(i+1):"";if(!/^JVBERi0/.test(b))return no(new Error("notpdf"));ok({pdf:"data:application/pdf;base64,"+b,nm:pdfName(f.name),sz:f.size})};
  r.readAsDataURL(f);
 });
}
export const fileErr=e=>{const m=e&&e.message;return m==="big"?"الملف أكبر من 3 ميجا، صغّره ثم أعد المحاولة":m==="type"?"نوع الملف غير مسموح. المسموح: صور، PDF، إكسل، وورد، باوربوينت، نص، ملف مضغوط":m==="notpdf"?"هذا الملف ليس PDF صالحاً":m==="empty"?"الملف فارغ":"تعذّر تجهيز الملف"};
// ---------- رفع وتنزيل الأجزاء ----------
export function partsOf(b64){const a=[];for(let i=0;i<b64.length;i+=FILE_CH)a.push(b64.slice(i,i+FILE_CH));return a}
// mk(j) = مستند الجزء رقم j (من 1). tries = عدد المحاولات لكل جزء (2 للمرفقات: الجزء يُعاد رفعه قبل كتابة الرأس؛ 1 للدردشة)
export async function putParts(mk,b64,tries,onProg){
 const P=partsOf(b64);
 for(let j=0;j<P.length;j++){
  let done=false,err=null;
  for(let a=0;a<(tries||1)&&!done;a++){try{await setDoc(mk(j+1),{d:P[j]});done=true}catch(e){err=e;if(e&&e.code==="permission-denied")break}}
  if(!done)throw err||new Error("part");
  if(onProg)onProg(j+1,P.length);
 }
 return P.length;
}
const b64Bytes=s=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);return u};
// تنزيل الأجزاء وتجميعها: بيرجّع {u8, b64} أو يرمي خطأ (gone = جزء ناقص · bad = محتوى غير صالح أو حجم لا يطابق)
export async function getParts(mk,pn,sz,onProg,mx){
 mx=mx||FILE_MAX;pn=+pn||0;sz=+sz||0;if(pn<1||pn>filePn(mx)||sz<1||sz>mx)throw new Error("bad");
 const u8=new Uint8Array(sz),B=[];let at=0;
 for(let j=1;j<=pn;j++){
  const s=await getDoc(mk(j));if(!s.exists())throw new Error("gone");
  const d=String((s.data()||{}).d||"");if(!d||d.length>FILE_CH||!/^[A-Za-z0-9+/]+={0,2}$/.test(d))throw new Error("bad");
  const u=b64Bytes(d);if(at+u.length>sz)throw new Error("bad");
  u8.set(u,at);at+=u.length;B.push(d);if(onProg)onProg(j,pn);
 }
 if(at!==sz)throw new Error("bad");
 return {u8,b64:B.join("")};
}
const isPdfBytes=u=>u&&u.length>4&&u[0]===0x25&&u[1]===0x50&&u[2]===0x44&&u[3]===0x46&&u[4]===0x2d;// "%PDF-"
const inApp=()=>!!window.TasoomaApp;
// داخل تطبيق الأندرويد لا يوجد تنزيل من الصفحة: لو التطبيق فيه saveFile (نسخة أحدث) نستعمله، وإلا نقول للمستخدم
function appSave(nm,b64,toast){
 try{if(window.TasoomaApp&&typeof window.TasoomaApp.saveFile==="function"){window.TasoomaApp.saveFile(String(nm),String(b64));return true}}catch(e){}
 if(toast)toast("تنزيل الملفات غير متاح داخل تطبيق الأندرويد الحالي. افتح المنصة من المتصفح لتنزيل الملف","er");
 return false;
}
// تنزيل بايتات كملف: النوع دائماً application/octet-stream (المتصفح لا يعرضه ولا ينفّذه)، والاسم نظيف بامتداد مسموح
export function saveBytes(u8,nm,toast,b64){
 const name=fileName(nm)||"tasooma-file.bin";
 if(inApp())return appSave(name,b64||"",toast);
 try{const url=URL.createObjectURL(new Blob([u8],{type:"application/octet-stream"}));
  const a=document.createElement("a");a.href=url;a.download=name;a.rel="noopener";a.style.display="none";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);return true}
 catch(e){if(toast)toast("تعذّر حفظ الملف على هذا الجهاز","er");return false}
}
// فتح: PDF حقيقي فقط يُفتح في تبويب جديد (عارض المتصفح)، وأي شيء آخر يُنزَّل
export function openBytes(u8,nm,toast,b64){
 if(extOf(nm)!=="pdf"||!isPdfBytes(u8)||inApp())return saveBytes(u8,nm,toast,b64);
 try{const url=URL.createObjectURL(new Blob([u8],{type:"application/pdf"}));
  const w=window.open(url,"_blank");// (من غير noopener: معاه window.open بيرجّع null دايماً)
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  if(!w)return saveBytes(u8,nm,toast,b64);return true}
 catch(e){return saveBytes(u8,nm,toast,b64)}
}
// ملف من مرجعه (مرفقات x / a): تنزيل الأجزاء ثم فتح أو حفظ. how = "open" | "save". onProg(تم، الكل)
const FC=new Map();// آخر 3 ملفات نُزّلت (علشان «فتح» ثم «تنزيل» لا ينزّلان مرتين)
export async function fetchRef(db,ref,onProg){
 const r=parseRef(ref);if(!r||!db)throw new Error("bad");
 const c=FC.get(ref);if(c&&c.db===db)return c.v;// (نفس الاتصال فقط: لا يُسلَّم ملف نزّله حساب آخر)
 const v=await getParts(j=>partDoc(db,r,j),r.pn,r.sz,onProg,fileMaxOf(r.col));
 FC.set(ref,{db,v});if(FC.size>3)FC.delete(FC.keys().next().value);
 return v;
}
export async function openRef(db,ref,nm,how,toast,onProg){
 try{const v=await fetchRef(db,ref,onProg);return how==="open"?openBytes(v.u8,nm,toast,v.b64):saveBytes(v.u8,nm,toast,v.b64)}
 catch(e){if(toast)toast(e&&e.code==="permission-denied"?"غير مسموح لك بفتح هذا الملف":e&&e.message==="gone"?"الملف غير مكتمل أو حُذف":e&&e.message==="bad"?"الملف تالف ولا يمكن فتحه":"تعذّر تحميل الملف، تأكد من الإنترنت","er");return false}
}
// فتح PDF القديم (رابط data:): بنحوّله لملف مؤقت في الذاكرة (المتصفحات بتمنع فتح data: مباشرة)، ولو الفتح اتمنع بنحمّله
export function openPdf(data,nm){
 try{const i=data.indexOf(","),b=data.slice(i+1),u8=b64Bytes(b);openBytes(u8,fileName(nm)||"tasooma.pdf",null,b)}catch(e){}
}
// صندوق المرفقات: el = العنصر اللي هيترسم جوّاه. بيرجّع {imgs(), files(), busy(), set(list)}
// opts: max (عدد المرفقات)، w (أقصى عرض للصورة)، cap (أقصى حجم للصورة)، add (نص زرار الإضافة)، pdf (يقبل ملفات، افتراضياً آه)، onChange
export function multiPick(el,opts={}){
 css();
 const max=Math.max(1,Math.min(MAXI,opts.max||MAXI)),w=opts.w||1400,cap=opts.cap||230000,id="mpf"+(++SEQ),pdfOk=opts.pdf!==false,fmax=opts.fmax||FILE_MAX;
 let L=[],F=[],wait=0;
 const n=()=>L.length+F.length;
 const paint=()=>{
  const room=n()+wait<max;
  el.innerHTML=`<input type="file" id="${id}c" accept="image/*" capture="environment" hidden><input type="file" id="${id}" accept="${pdfOk?FILE_ACCEPT:"image/*"}" multiple hidden>
  <div class="mp">${L.map((s,i)=>`<div class="mt"><img src="${s}" alt="" data-zoom data-zt="صورة ${i+1}"><b>${i+1}</b><button type="button" data-mx="${i}" aria-label="حذف الصورة ${i+1}" title="حذف">×</button></div>`).join("")}
  ${F.map((f,i)=>`<div class="mt pdf"><i>📄</i><span data-notr><bdi>${E(f.nm)}</bdi></span><small data-notr>${E(fileLabel(f.nm))} · ${kb(f.sz||0)}</small><button type="button" data-fx="${i}" aria-label="حذف الملف" title="حذف">×</button></div>`).join("")}
  ${room?(wait?`<div class="ma wait"><i>⏳</i>جاري التجهيز (${wait})...</div>`:`<label class="ma cam" for="${id}c"><i>📷</i>تصوير</label><label class="ma" for="${id}"><i>📎</i>${E(opts.add||(pdfOk?"صور أو ملفات":(n()?"إضافة صورة أخرى":"إضافة صور")))}</label>`):""}</div>
  <div class="mp-h">${n()?`${n()} من ${max}`:`يمكنك إضافة حتى ${max}${pdfOk?" (صور، أو ملفات PDF وإكسل ووورد حتى "+mbText(fmax)+" للملف)":" صور"}`}</div>`;
  el.querySelectorAll("[data-mx]").forEach(b=>b.onclick=e=>{e.preventDefault();L.splice(+b.dataset.mx,1);paint();if(opts.onChange)opts.onChange(L.slice())});
  el.querySelectorAll("[data-fx]").forEach(b=>b.onclick=e=>{e.preventDefault();F.splice(+b.dataset.fx,1);paint()});
  el.querySelectorAll('input[type="file"]').forEach(inp=>inp.onchange=async()=>{
   const all=[...inp.files],fs=all.slice(0,max-n());inp.value="";if(!fs.length)return;
   const skipped=all.length>fs.length;
   wait+=fs.length;paint();let bad=0,big=0,typ=0;
   for(const f of fs){
    try{if(isImgFile(f))L.push(await shrink(f,w,cap));else{if(!pdfOk)throw new Error("type");F.push(await readFile(f,fmax))}}
    catch(e){const m=e&&e.message;if(m==="big"&&!isImgFile(f))big++;else if(m==="type")typ++;else bad++}
    wait--;paint();
   }
   if(opts.onChange)opts.onChange(L.slice());
   if(opts.toast&&(bad||big||typ||skipped))opts.toast(big?`ملف أكبر من ${mbText(fmax)} (${big})، صغّره ثم أعد المحاولة`:typ?`نوع غير مسموح (${typ}). المسموح: صور، PDF، إكسل، وورد، باوربوينت، نص، ملف مضغوط`:bad?`تعذّر تجهيز ${bad} من الملفات (ملف غير صالح)`:`الحد الأقصى ${max}`,"er");
  });
 };
 paint();
 return {imgs:()=>L.slice(),files:()=>F.map(f=>({fl:1,nm:f.nm,sz:f.sz,b64:f.b64})),busy:()=>wait>0,set:l=>{L=(l||[]).slice(0,max);paint()}};
}
// حفظ مرفق واحد في {col}/{id}/{sub}/{n}: صورة (نص data:image) أو PDF قديم {pdf,nm} أو ملف {fl,nm,sz,b64} (الأجزاء أولاً ثم الرأس).
// more = حقول إضافية على الرأس (مرفقات المحاسب: {n, at})
export async function putAtt(db,col,id,sub,n,x,more){
 if(typeof x==="string")return setDoc(doc(db,col,id,sub,String(n)),Object.assign({img:x},more||{}));
 if(x&&x.fl===1&&typeof x.b64==="string"){
  const nm=fileName(x.nm);if(!nm)throw new Error("type");
  const pn=await putParts(j=>doc(db,col,id,sub+"f",n+"_"+j),x.b64,2);
  return setDoc(doc(db,col,id,sub,String(n)),Object.assign({fl:1,nm,sz:+x.sz,pn},more||{}));
 }
 return setDoc(doc(db,col,id,sub,String(n)),Object.assign({pdf:x.pdf,nm:pdfName(x.nm)},more||{}));
}
// حفظ المرفقات الإضافية (من التانية للآخر) بعد ما المستند الأساسي اتحفظ. واحد واحد علشان حجم الطلب يفضل صغير.
// extra = صور (نص data:image) أو ملفات. بيرجّع عدد اللي ماتحفظش.
// start = رقم أول مرفق إضافي (2 عادةً، أو بعد آخر واحد موجود لو بنضيف على مرفق قديم)
export async function saveExtras(db,col,id,extra,start=2){
 let bad=0;
 for(let k=0;k<extra.length;k++){const n=start+k;if(n>MAXI){bad+=extra.length-k;break}
  try{await putAtt(db,col,id,"x",n,extra[k])}catch(e){bad++}}
 return bad;
}
// مستند مرفق ← عنصر للعرض: {k, src, path, pdf?, file?, nm?, sz?, n?, at?} (src = الصورة، أو الـ PDF القديم، أو مرجع الملف tzf:)
export function attItem(col,id,sub,did,v){
 v=v||{};const k=+did,path=`${col}/${id}/${sub}/${did}`,who=typeof v.n==="string"?{n:v.n,at:+v.at||0}:{};
 if(v.fl===1&&typeof v.nm==="string"&&+v.pn>=1&&+v.sz>=1){const src=fileRef(col,id,sub,k,+v.pn,+v.sz);return isFileRef(src)?Object.assign({k,src,file:true,nm:v.nm,sz:+v.sz,path},who):null}
 if(isPdfData(v.pdf))return Object.assign({k,src:v.pdf,pdf:true,nm:v.nm||"",path},who);
 if(typeof v.img==="string"&&/^data:image\//.test(v.img))return Object.assign({k,src:v.img,path},who);
 return null;
}
// قاعدة البيانات التي قُرئت منها المرفقات آخر مرة (العارض zoom.js ينزّل بها الملف عند الضغط، حتى في الصفحات التي لا تنادي initZoom)
let ATTDB=null;
export const attDb=()=>ATTDB;
// قراءة مرفقات مجموعة فرعية (x من 2، a من 1) بالترتيب. محتوى الملفات الجديدة لا يُنزَّل هنا. throws لو القراءة فشلت
export async function loadAtts(db,col,id,sub){
 ATTDB=db;const s=await getDocs(collection(db,col,id,sub));
 return s.docs.map(d=>attItem(col,id,sub,d.id,d.data())).filter(x=>x&&x.k>=(sub==="a"?1:2)&&x.k<=MAXI).sort((a,b)=>a.k-b.k);
}
// قراءة المرفقات الإضافية بالترتيب
export async function loadExtras(db,col,id){
 try{return await loadAtts(db,col,id,"x")}catch(e){return []}
}
// حذف مرفق كامل بمسار رأسه (المالك): أجزاء الملف أولاً ثم الرأس. ref = مرجع الملف لو معروف (وإلا نقرأ الرأس لنعرف عدد الأجزاء)
export async function dropAtt(db,path,ref){
 const p=String(path).split("/");let r=parseRef(ref);
 if(!r&&p.length===4){try{const s=await getDoc(doc(db,...p));const v=s.exists()?s.data()||{}:{};if(v.fl===1&&+v.pn>=1)r={col:p[0],id:p[1],sub:p[2],k:+p[3],pn:Math.min(+v.pn,filePn(fileMaxOf(p[0])))}}catch(e){}}
 if(r)for(let j=1;j<=r.pn;j++)await deleteDoc(partDoc(db,r,j));
 await deleteDoc(doc(db,...p));
}
// مسح كل المرفقات الإضافية (للمالك: تعديل أو حذف المستند)
// (v239) strict = للاستبدال: لو قراءة المرفقات القديمة فشلت نرمي الخطأ ومانكمّلش (كانت بترجع فاضية فالقديم يفضل ويتلخبط مع الجديد)
export async function dropExtras(db,col,id,strict){
 const L=strict?await loadAtts(db,col,id,"x"):await loadExtras(db,col,id);for(const x of L){try{await dropAtt(db,x.path,x.file?x.src:"")}catch(e){}}
}
