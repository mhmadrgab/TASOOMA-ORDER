// عارض الصور: أي صورة عليها data-zoom لما حد يدوس عليها بتفتح كبيرة على الشاشة كلها، ومعاها "حفظ الصورة".
// الحذف للمالك بس (محمد): data-zdel="المجموعة/الرقم/الحقل" (القواعد في Firebase كمان بتمنع أي حد غيره).
import {doc,updateDoc,deleteField} from "./fb.js";
let C=null,cur=null;
// الحاجات اللي ينفع تتمسح من هنا بس (مايتمسحش أي حقل تاني بالغلط)
const OK={"requests":["pod.img","pod.sig"],"ledger":["img"]};
const isData=s=>typeof s==="string"&&/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const CSS=`#zbx{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.9);align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:14px}
#zbx.on{display:flex}#zbx img{max-width:96vw;max-height:78vh;object-fit:contain;border-radius:10px;background:#fff;touch-action:pinch-zoom}
#zbx .zt{color:#fff;font-size:15px;text-align:center}#zbx .zb{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
#zbx .zb>*{font:inherit;font-weight:700;border:0;border-radius:12px;padding:11px 20px;cursor:pointer;background:#fff;color:#1b1b1b;text-decoration:none}
#zbx .zb .d{background:#c4362b;color:#fff}
img[data-zoom]{cursor:zoom-in}`;
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function box(){
 let b=document.getElementById("zbx");
 if(!b){b=document.createElement("div");b.id="zbx";b.addEventListener("click",e=>{if(e.target===b)zoomClose()});document.body.appendChild(b)}
 return b;
}
export function zoomClose(){const b=document.getElementById("zbx");if(b){b.className="";b.innerHTML=""}cur=null}
// فتح صورة: src = الصورة، title = عنوان تحتها، del = "المجموعة/الرقم/الحقل" (اختياري)
export function zoomOpen(src,title,del){
 if(!isData(src))return;
 const [col,id,field]=String(del||"").split("/"),canDel=!!(C&&C.owner()&&col&&id&&OK[col]&&OK[col].includes(field));
 cur={col,id,field};
 const ext=src.startsWith("data:image/png")?"png":"jpg",b=box();
 b.innerHTML=`<img alt="" src="${src}"><div class="zt">${E(title||"")}</div><div class="zb"><a href="${src}" download="tasooma-${Date.now()}.${ext}">⬇️ حفظ الصورة</a>${canDel?'<button class="d" type="button" data-zx="del">🗑 حذف</button>':""}<button type="button" data-zx="close">إغلاق</button></div>`;
 b.className="on";
 b.querySelector('[data-zx="close"]').onclick=zoomClose;
 const d=b.querySelector('[data-zx="del"]');
 if(d)d.onclick=async()=>{
  if(!confirm("تمسح الصورة دي نهائياً؟ مش هتقدر ترجّعها."))return;
  d.disabled=true;d.textContent="جاري الحذف...";
  try{await updateDoc(doc(C.db,cur.col,cur.id),{[cur.field]:deleteField()});C.toast("اتمسحت ✅");zoomClose()}
  catch(e){d.disabled=false;d.textContent="🗑 حذف";C.toast(e&&e.code==="permission-denied"?"الحذف للمالك بس":"تعذر الحذف، جرّب تاني")}
 };
}
export function initZoom(ctx){
 C=ctx;
 if(!document.getElementById("zb-css")){const s=document.createElement("style");s.id="zb-css";s.textContent=CSS;document.head.appendChild(s)}
 if(window.__zoom)return;window.__zoom=1;
 // (capture: قبل ما الضغطة تفتح/تقفل "تفاصيل" أو أي حاجة تحت الصورة)
 document.addEventListener("click",e=>{const im=e.target&&e.target.closest&&e.target.closest("img[data-zoom]");if(!im)return;e.preventDefault();e.stopPropagation();zoomOpen(im.getAttribute("src"),im.dataset.zt||"",im.dataset.zdel||"")},true);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&cur!==null)zoomClose()});
}
