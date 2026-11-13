// 📎 صور متعددة لأي مرفق (13 نوفمبر 2026، طلب محمد: "أي عدد صور مش صورة واحدة").
// الصورة الأولى بتفضل في مكانها القديم زي ما هي (giftimg/{id}.img ، pods/{id}.img ، ledger/{id}.img)
// علشان كل حاجة قديمة تفضل شغّالة، والباقي في {المجموعة}/{الرقم}/x/2 .. x/10 = {img} (مستند لكل صورة).
// القواعد في supabase/002_rules.sql (can_read / can_write: sub = 'x').
import {doc,getDoc,getDocs,collection,setDoc,deleteDoc} from "./fb.js";
import {shrink} from "./cust.js";
export const MAXI=10;
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CSS=`.mp{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;margin-top:6px}
.mp .mt{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f3edf1;border:1px solid var(--line,#e3d5c3)}
.mp .mt img{width:100%;height:100%;object-fit:cover;display:block}
.mp .mt b{position:absolute;top:4px;inset-inline-start:4px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border-radius:8px;padding:1px 6px}
.mp .mt button{position:absolute;top:4px;inset-inline-end:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:15px;line-height:26px;padding:0;cursor:pointer}
.mp .ma{aspect-ratio:1;border-radius:12px;border:2px dashed var(--line,#d9d4cb);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--mut,#74687a);font-size:12.5px;text-align:center;padding:6px;background:transparent;font-family:inherit}
.mp .ma i{font-style:normal;font-size:24px}
.mp .ma.wait{cursor:progress;opacity:.7}
.mp-h{font-size:12.5px;color:var(--mut,#74687a);margin-top:4px}
@media (prefers-color-scheme:dark){.mp .mt{background:#282029}}`;
function css(){if(!document.getElementById("mp-css")){const s=document.createElement("style");s.id="mp-css";s.textContent=CSS;document.head.appendChild(s)}}
let SEQ=0;
// صندوق اختيار صور: el = العنصر اللي هيترسم جوّاه. بيرجّع {imgs(), busy(), set(list)}
// opts: max (عدد الصور)، w (أقصى عرض بالبكسل)، cap (أقصى حجم للصورة)، add (نص زرار الإضافة)، cam (يفتح الكاميرا على الموبايل)، onChange
export function multiPick(el,opts={}){
 css();
 const max=Math.max(1,Math.min(MAXI,opts.max||MAXI)),w=opts.w||1400,cap=opts.cap||230000,id="mpf"+(++SEQ);
 let L=[],wait=0;
 const paint=()=>{
  el.innerHTML=`<input type="file" id="${id}" accept="image/*" multiple hidden${opts.cam?' capture="environment"':""}><div class="mp">${L.map((s,i)=>`<div class="mt"><img src="${s}" alt="" data-zoom data-zt="صورة ${i+1}"><b>${i+1}</b><button type="button" data-mx="${i}" aria-label="حذف الصورة ${i+1}" title="حذف">×</button></div>`).join("")}${L.length+wait<max?`<label class="ma${wait?" wait":""}" for="${id}"><i>${wait?"⏳":"📷"}</i>${wait?`جاري التجهيز (${wait})...`:E(opts.add||(L.length?"إضافة صورة أخرى":"إضافة صور"))}</label>`:""}</div><div class="mp-h">${L.length?`${L.length} من ${max} صور`:`يمكنك اختيار أكثر من صورة (حتى ${max})`}</div>`;
  el.querySelectorAll("[data-mx]").forEach(b=>b.onclick=e=>{e.preventDefault();L.splice(+b.dataset.mx,1);paint();if(opts.onChange)opts.onChange(L.slice())});
  const inp=el.querySelector("input");if(inp)inp.onchange=async()=>{
   const fs=[...inp.files].slice(0,max-L.length);inp.value="";if(!fs.length)return;
   const skipped=inp.files&&inp.files.length>fs.length;
   wait+=fs.length;paint();let bad=0;
   for(const f of fs){try{L.push(await shrink(f,w,cap))}catch(e){bad++}wait--;paint()}
   if(opts.onChange)opts.onChange(L.slice());
   if((bad||skipped)&&opts.toast)opts.toast(bad?`تعذّر تجهيز ${bad} من الصور (ملف غير صالح)`:`الحد الأقصى ${max} صور`,"er");
  };
 };
 paint();
 return {imgs:()=>L.slice(),busy:()=>wait>0,set:l=>{L=(l||[]).slice(0,max);paint()}};
}
// حفظ الصور الإضافية (من التانية للآخر) بعد ما المستند الأساسي اتحفظ. صورة صورة علشان حجم الطلب يفضل صغير.
// بيرجّع عدد اللي ماتحفظش.
// start = رقم أول صورة إضافية (2 عادةً، أو بعد آخر صورة موجودة لو بنضيف على مرفق قديم)
export async function saveExtras(db,col,id,extra,start=2){
 let bad=0;
 for(let k=0;k<extra.length;k++){const n=start+k;if(n>MAXI){bad+=extra.length-k;break}try{await setDoc(doc(db,col,id,"x",String(n)),{img:extra[k]})}catch(e){bad++}}
 return bad;
}
// قراءة الصور الإضافية: [{src, path}] بالترتيب
export async function loadExtras(db,col,id){
 try{const s=await getDocs(collection(db,col,id,"x"));return s.docs.map(d=>({k:+d.id,src:(d.data()||{}).img,path:`${col}/${id}/x/${d.id}`})).filter(x=>x.k>=2&&typeof x.src==="string"&&/^data:image\//.test(x.src)).sort((a,b)=>a.k-b.k)}
 catch(e){return []}
}
// مسح كل الصور الإضافية (للمالك: تعديل أو حذف المستند)
export async function dropExtras(db,col,id){
 const L=await loadExtras(db,col,id);for(const x of L){try{await deleteDoc(doc(db,...x.path.split("/")))}catch(e){}}
}
