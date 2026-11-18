// 📎 مرفقات متعددة لأي حاجة (13 نوفمبر 2026، طلب محمد: "أي عدد صور مش صورة واحدة").
// الصورة الأولى بتفضل في مكانها القديم زي ما هي (giftimg/{id}.img ، pods/{id}.img ، ledger/{id}.img)
// علشان كل حاجة قديمة تفضل شغّالة، والباقي في {المجموعة}/{الرقم}/x/2 .. x/10 = {img} (مستند لكل صورة).
// 📄 (15 نوفمبر 2026، "المرفقات تقبل PDF + السواق يفتح الكاميرا"):
//   • ملفات PDF (لحد 2 ميجا) بتتحفظ في نفس المكان الإضافي: x/N = {pdf:"data:application/pdf;base64,...", nm:"اسم الملف"}.
//     بنتأكد إنه PDF حقيقي من أول بايتات الملف (%PDF-) مش من الاسم بس، والقواعد كمان بترفض أي حاجة مش صورة JPEG أو PDF.
//   • زرارين: «📷 تصوير» بيفتح كاميرا الموبايل على طول (آيفون وأندرويد)، و«📎 صور أو PDF» من المعرض أو الملفات.
// القواعد في supabase/002_rules.sql (can_read / can_write: sub = 'x' و att_ok).
import {doc,getDoc,getDocs,collection,setDoc,deleteDoc} from "./fb.js";
import {shrink} from "./cust.js";
export const MAXI=10;
export const PDF_MAX=2*1024*1024;// 2 ميجا
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
const kb=n=>n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
export const isPdfData=s=>typeof s==="string"&&/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(s);
const pdfName=n=>String(n||"ملف.pdf").replace(/[\u0000-\u001f<>"'\\/:*?|]/g,"").slice(0,100)||"ملف.pdf";
const isPdfFile=f=>f&&(f.type==="application/pdf"||/\.pdf$/i.test(f.name||""));
// قراءة PDF: حجمه، وإنه PDF فعلاً (أول بايتات "%PDF-" = "JVBERi0" بعد التحويل)
export function readPdf(f){
 return new Promise((ok,no)=>{
  if(!f||f.size>PDF_MAX)return no(new Error("big"));
  const r=new FileReader();r.onerror=()=>no(new Error("read"));
  r.onload=()=>{const s=String(r.result||""),i=s.indexOf(",");const b=i>0?s.slice(i+1):"";if(!/^JVBERi0/.test(b))return no(new Error("notpdf"));ok({pdf:"data:application/pdf;base64,"+b,nm:pdfName(f.name),sz:f.size})};
  r.readAsDataURL(f);
 });
}
// فتح PDF: بنحوّله لملف مؤقت في الذاكرة (المتصفحات بتمنع فتح data: مباشرة)، ولو الفتح اتمنع بنحمّله
export function openPdf(data,nm){
 try{const i=data.indexOf(","),bin=atob(data.slice(i+1)),u8=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u8[k]=bin.charCodeAt(k);
  const url=URL.createObjectURL(new Blob([u8],{type:"application/pdf"}));
  const w=window.open(url,"_blank");// (من غير noopener: معاه window.open بيرجّع null دايماً)
  if(!w){const a=document.createElement("a");a.href=url;a.download=pdfName(nm);document.body.appendChild(a);a.click();a.remove()}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){}
}
// صندوق المرفقات: el = العنصر اللي هيترسم جوّاه. بيرجّع {imgs(), files(), busy(), set(list)}
// opts: max (عدد المرفقات)، w (أقصى عرض للصورة)، cap (أقصى حجم للصورة)، add (نص زرار الإضافة)، pdf (يقبل PDF، افتراضياً آه)، onChange
export function multiPick(el,opts={}){
 css();
 const max=Math.max(1,Math.min(MAXI,opts.max||MAXI)),w=opts.w||1400,cap=opts.cap||230000,id="mpf"+(++SEQ),pdfOk=opts.pdf!==false;
 let L=[],F=[],wait=0;
 const n=()=>L.length+F.length;
 const paint=()=>{
  const room=n()+wait<max;
  el.innerHTML=`<input type="file" id="${id}c" accept="image/*" capture="environment" hidden><input type="file" id="${id}" accept="${pdfOk?"image/*,application/pdf,.pdf":"image/*"}" multiple hidden>
  <div class="mp">${L.map((s,i)=>`<div class="mt"><img src="${s}" alt="" data-zoom data-zt="صورة ${i+1}"><b>${i+1}</b><button type="button" data-mx="${i}" aria-label="حذف الصورة ${i+1}" title="حذف">×</button></div>`).join("")}
  ${F.map((f,i)=>`<div class="mt pdf"><i>📄</i><span data-notr><bdi>${E(f.nm)}</bdi></span><small>PDF · ${kb(f.sz||0)}</small><button type="button" data-fx="${i}" aria-label="حذف الملف" title="حذف">×</button></div>`).join("")}
  ${room?(wait?`<div class="ma wait"><i>⏳</i>جاري التجهيز (${wait})...</div>`:`<label class="ma cam" for="${id}c"><i>📷</i>تصوير</label><label class="ma" for="${id}"><i>📎</i>${E(opts.add||(pdfOk?"صور أو PDF":(n()?"إضافة صورة أخرى":"إضافة صور")))}</label>`):""}</div>
  <div class="mp-h">${n()?`${n()} من ${max}`:`يمكنك إضافة حتى ${max}${pdfOk?" (صور أو ملفات PDF حتى 2 ميجا)":" صور"}`}</div>`;
  el.querySelectorAll("[data-mx]").forEach(b=>b.onclick=e=>{e.preventDefault();L.splice(+b.dataset.mx,1);paint();if(opts.onChange)opts.onChange(L.slice())});
  el.querySelectorAll("[data-fx]").forEach(b=>b.onclick=e=>{e.preventDefault();F.splice(+b.dataset.fx,1);paint()});
  el.querySelectorAll('input[type="file"]').forEach(inp=>inp.onchange=async()=>{
   const all=[...inp.files],fs=all.slice(0,max-n());inp.value="";if(!fs.length)return;
   const skipped=all.length>fs.length;
   wait+=fs.length;paint();let bad=0,big=0;
   for(const f of fs){
    try{if(isPdfFile(f)){if(!pdfOk)throw new Error("type");F.push(await readPdf(f))}else L.push(await shrink(f,w,cap))}
    catch(e){if(e&&e.message==="big")big++;else bad++}
    wait--;paint();
   }
   if(opts.onChange)opts.onChange(L.slice());
   if(opts.toast&&(bad||big||skipped))opts.toast(big?`ملف PDF أكبر من 2 ميجا (${big})، صغّره ثم أعد المحاولة`:bad?`تعذّر تجهيز ${bad} من الملفات (ملف غير صالح)`:`الحد الأقصى ${max}`,"er");
  });
 };
 paint();
 return {imgs:()=>L.slice(),files:()=>F.map(f=>({pdf:f.pdf,nm:f.nm})),busy:()=>wait>0,set:l=>{L=(l||[]).slice(0,max);paint()}};
}
// حفظ المرفقات الإضافية (من التانية للآخر) بعد ما المستند الأساسي اتحفظ. واحد واحد علشان حجم الطلب يفضل صغير.
// extra = صور (نص data:image) أو ملفات ({pdf,nm}). بيرجّع عدد اللي ماتحفظش.
// start = رقم أول مرفق إضافي (2 عادةً، أو بعد آخر واحد موجود لو بنضيف على مرفق قديم)
export async function saveExtras(db,col,id,extra,start=2){
 let bad=0;
 for(let k=0;k<extra.length;k++){const n=start+k;if(n>MAXI){bad+=extra.length-k;break}
  const x=extra[k],d=typeof x==="string"?{img:x}:{pdf:x.pdf,nm:pdfName(x.nm)};
  try{await setDoc(doc(db,col,id,"x",String(n)),d)}catch(e){bad++}}
 return bad;
}
// قراءة المرفقات الإضافية: [{k, src, path, pdf?, nm?}] بالترتيب (src = الصورة أو الـ PDF)
export async function loadExtras(db,col,id){
 try{const s=await getDocs(collection(db,col,id,"x"));return s.docs.map(d=>{const v=d.data()||{};return isPdfData(v.pdf)?{k:+d.id,src:v.pdf,pdf:true,nm:v.nm||"",path:`${col}/${id}/x/${d.id}`}:{k:+d.id,src:v.img,path:`${col}/${id}/x/${d.id}`}})
  .filter(x=>x.k>=2&&typeof x.src==="string"&&(x.pdf||/^data:image\//.test(x.src))).sort((a,b)=>a.k-b.k)}
 catch(e){return []}
}
// مسح كل المرفقات الإضافية (للمالك: تعديل أو حذف المستند)
export async function dropExtras(db,col,id){
 const L=await loadExtras(db,col,id);for(const x of L){try{await deleteDoc(doc(db,...x.path.split("/")))}catch(e){}}
}
