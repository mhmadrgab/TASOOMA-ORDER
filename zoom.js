// عارض الصور: أي صورة عليها data-zoom لما حد يدوس عليها بتفتح كبيرة على الشاشة كلها، ومعاها "حفظ الصورة".
// الحذف للمالك فقط (محمد): data-zdel="المجموعة/الرقم/الحقل" (القواعد كمان بتمنع أي حد غيره).
// 📎 (13 نوفمبر 2026) عرض أكتر من صورة: zoomGallery(list) بأسهم ‹ › وعدّاد وسحب بالصباع، والصورة الإضافية
// (x/2..x/10 من att.js) بتتمسح كمستند كامل: del = "doc:المسار".
import {doc,getDoc,updateDoc,deleteDoc,deleteField} from "./fb.js";
import {loadExtras} from "./att.js";
let C=null,cur=null;
// الحاجات اللي ينفع تتمسح من هنا بس (مايتمسحش أي حقل مجدداً بالغلط)
const OK={"requests":["pod.img","pod.sig"],"ledger":["img"],"pods":["img","sig"],"giftimg":["img"]};
const XOK=/^((giftimg|pods|ledger)\/[A-Za-z0-9_-]{1,64}\/x\/([2-9]|10)|giftimg\/[A-Za-z0-9_-]{1,64}\/a\/([1-9]|10))$/;// a = مرفقات المحاسب على الهدية
// صور التسليم الجديدة في pods/{رقم الطلب}: لما تتمسح بنشيل العلامة اللي على الطلب أيضاً (ph/sg)
const FLAG={img:"pod.ph",sig:"pod.sg"};
const isData=s=>typeof s==="string"&&/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const CSS=`#zbx{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.92);align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:14px}
#zbx.on{display:flex}#zbx .zi{position:relative;display:flex;align-items:center;justify-content:center;max-width:100%}
#zbx img{max-width:96vw;max-height:74vh;object-fit:contain;border-radius:10px;background:#fff;touch-action:pinch-zoom;user-select:none}
#zbx .zt{color:#fff;font-size:15px;text-align:center}#zbx .zb{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
#zbx .zb>*{font:inherit;font-weight:700;border:0;border-radius:12px;padding:11px 20px;cursor:pointer;background:#fff;color:#2a1d2c;text-decoration:none}
#zbx .zb .d{background:#c4362b;color:#fff}
#zbx .zn{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#2a1d2c;font-size:28px;line-height:44px;cursor:pointer;padding:0}
#zbx .zn.p{inset-inline-start:6px}#zbx .zn.n{inset-inline-end:6px}#zbx .zn:disabled{opacity:.3;cursor:default}
#zbx .zc{color:#fff;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700}
#zbx .zd{display:flex;gap:6px;max-width:92vw;overflow-x:auto;padding:2px}#zbx .zd img{width:46px;height:46px;max-height:none;object-fit:cover;border-radius:8px;opacity:.5;cursor:pointer;border:2px solid transparent;background:#333}
#zbx .zd img.on{opacity:1;border-color:#fff}
img[data-zoom]{cursor:zoom-in}`;
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function box(){
 let b=document.getElementById("zbx");
 if(!b){b=document.createElement("div");b.id="zbx";b.addEventListener("click",e=>{if(e.target===b)zoomClose()});document.body.appendChild(b)}
 return b;
}
export function zoomClose(){const b=document.getElementById("zbx");if(b){b.className="";b.innerHTML=""}cur=null}
const canDelOf=del=>{
 if(!C||!C.owner())return false;const s=String(del||"");
 if(s.startsWith("doc:"))return XOK.test(s.slice(4));
 const [col,id,field]=s.split("/");return !!(col&&id&&OK[col]&&OK[col].includes(field));
};
// فتح صورة واحدة: src = الصورة، title = عنوان تحتها، del = "المجموعة/الرقم/الحقل" (اختياري)
export function zoomOpen(src,title,del){zoomGallery([{src,del}],title,0)}
// فتح أكتر من صورة: list = [{src, del?}]
const zcss=()=>{if(!document.getElementById("zb-css")){const s=document.createElement("style");s.id="zb-css";s.textContent=CSS;document.head.appendChild(s)}};
let keys=false;// الأسهم وEscape (لو الصفحة مانادتش initZoom، زي التعميمات عند الفرع)
export function zoomGallery(list,title,start=0){
 list=(list||[]).filter(x=>x&&isData(x.src));if(!list.length)return;zcss();
 if(!keys&&!window.__zoom){keys=true;document.addEventListener("keydown",onKey)}
 cur={list,i:Math.max(0,Math.min(start,list.length-1)),title};
 const b=box();b.className="on";draw();
}
function draw(){
 const b=box();if(!cur)return;const {list,i,title}=cur,it=list[i],many=list.length>1;
 const ext=it.src.startsWith("data:image/png")?"png":"jpg",del=canDelOf(it.del),rtl=document.documentElement.dir!=="ltr";
 b.innerHTML=`<div class="zi"><img alt="" src="${it.src}">${many?`<button class="zn p" type="button" data-zx="prev" aria-label="السابقة" ${i===0?"disabled":""}>${rtl?"›":"‹"}</button><button class="zn n" type="button" data-zx="next" aria-label="التالية" ${i===list.length-1?"disabled":""}>${rtl?"‹":"›"}</button>`:""}</div>
 ${many?`<span class="zc">${i+1} / ${list.length}</span>`:""}<div class="zt">${E(title||"")}</div>
 ${many?`<div class="zd">${list.map((x,k)=>`<img src="${x.src}" alt="" data-zx="go" data-k="${k}" class="${k===i?"on":""}">`).join("")}</div>`:""}
 <div class="zb"><a href="${it.src}" download="tasooma-${Date.now()}-${i+1}.${ext}">⬇️ حفظ الصورة</a>${del?'<button class="d" type="button" data-zx="del">🗑 حذف</button>':""}<button type="button" data-zx="close">إغلاق</button></div>`;
 b.querySelector('[data-zx="close"]').onclick=zoomClose;
 const nv=d=>{if(!cur)return;const j=cur.i+d;if(j<0||j>=cur.list.length)return;cur.i=j;draw()};
 const p=b.querySelector('[data-zx="prev"]'),n=b.querySelector('[data-zx="next"]');
 // الأسهم: في العربي ‹ على اليمين = السابقة
 if(p)p.onclick=()=>nv(-1);if(n)n.onclick=()=>nv(1);
 b.querySelectorAll('[data-zx="go"]').forEach(t=>t.onclick=()=>{cur.i=+t.dataset.k;draw()});
 const th=b.querySelector(".zd img.on");if(th)th.scrollIntoView({block:"nearest",inline:"center"});
 // سحب بالصباع
 const big=b.querySelector(".zi img");let x0=null;
 big.ontouchstart=e=>{x0=e.touches.length===1?e.touches[0].clientX:null};
 big.ontouchend=e=>{if(x0==null||!many)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)<50)return;const rtl=document.documentElement.dir!=="ltr";nv((dx<0)!==rtl?1:-1)};
 const d=b.querySelector('[data-zx="del"]');
 if(d)d.onclick=async()=>{
  if(!confirm("هل تريد حذف هذه الصورة نهائياً؟ لن تتمكن من استعادتها."))return;
  d.disabled=true;d.textContent="جاري الحذف...";
  const s=String(it.del);
  try{
   if(s.startsWith("doc:")){await deleteDoc(doc(C.db,...s.slice(4).split("/")))}
   else{const [col,id,field]=s.split("/");
    await updateDoc(doc(C.db,col,id),{[field]:deleteField()});
    if(col==="pods")PC.delete(id);
    if(col==="giftimg")await updateDoc(doc(C.db,"gifts",id),{img:deleteField()}).catch(()=>{});// علامة "فيه سند" على الهدية
    if(col==="pods")await updateDoc(doc(C.db,"requests",id),{[FLAG[field]]:deleteField()}).catch(()=>{});
   }
   C.toast("حُذفت ✅");
   if(!cur)return;cur.list.splice(cur.i,1);if(!cur.list.length)return zoomClose();cur.i=Math.min(cur.i,cur.list.length-1);draw();
  }catch(e){d.disabled=false;d.textContent="🗑 حذف";C.toast(e&&e.code==="permission-denied"?"الحذف للمالك فقط":"تعذر الحذف، حاول مجدداً")}
 };
}
// بنجيب الصورة من pods/{رقم الطلب} وقت الضغط بس (قراءة واحدة) + الصور الإضافية pods/{رقم}/x
const PC=new Map();
export async function podOpen(rid,which,title,btn){
 if(!C||!/^[A-Za-z0-9_-]{1,64}$/.test(rid)||!(which in FLAG))return;
 const t0=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent="⏳"}
 try{
  let d=PC.get(rid);if(!d){const s=await getDoc(doc(C.db,"pods",rid));d=s.exists()?s.data():{};PC.set(rid,d);setTimeout(()=>PC.delete(rid),5*6e4)}
  if(which==="img"){
   const ex=await loadExtras(C.db,"pods",rid),L=[];
   if(isData(d.img))L.push({src:d.img,del:`pods/${rid}/img`});
   ex.forEach(x=>L.push({src:x.src,del:"doc:"+x.path}));
   if(L.length)zoomGallery(L,title,0);else C.toast("لا توجد صورة (ربما حُذفت)");
  }
  else if(isData(d[which]))zoomOpen(d[which],title,`pods/${rid}/${which}`);else C.toast("لا يوجد توقيع (ربما حُذف)");
 }catch(e){C.toast(e&&e.code==="permission-denied"?"غير مسموح لك برؤية هذه الصورة":"تعذر تحميل الصورة، تأكد من الإنترنت")}
 finally{if(btn){btn.disabled=false;btn.textContent=t0}}
}
function onKey(e){if(cur===null)return;if(e.key==="Escape")zoomClose();else if(e.key==="ArrowLeft"||e.key==="ArrowRight"){const rtl=document.documentElement.dir!=="ltr";const d=(e.key==="ArrowLeft")===rtl?1:-1;const j=cur.i+d;if(j>=0&&j<cur.list.length){cur.i=j;draw()}}}
export function initZoom(ctx){
 C=ctx;
 zcss();
 if(window.__zoom)return;window.__zoom=1;
 // (capture: قبل ما الضغطة تفتح/تقفل "تفاصيل" أو أي حاجة تحت الصورة)
 document.addEventListener("click",e=>{const im=e.target&&e.target.closest&&e.target.closest("img[data-zoom]");if(!im)return;e.preventDefault();e.stopPropagation();zoomOpen(im.getAttribute("src"),im.dataset.zt||"",im.dataset.zdel||"")},true);
 if(!keys){keys=true;document.addEventListener("keydown",onKey)}
 // زرار "📷 صورة التسليم" / "✍ التوقيع": data-podv="رقم الطلب|img أو sig" + data-zt
 document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("[data-podv]");if(!b)return;e.preventDefault();e.stopPropagation();const [rid,w]=String(b.dataset.podv).split("|");podOpen(rid,w,b.dataset.zt||"",b)},true);
}
