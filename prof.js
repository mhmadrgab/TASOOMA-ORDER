// الملف الشخصي لحسابات المستودع: صورة لكل واحد (ava/{email}) + اسم وكنية مالك النظام (meta/me).
// كل واحد بيرفع صورته هو بس (بتتصغّر لـ 160×160 قبل الرفع، حوالي 15 كيلو). اسم وكنية الموظفين والمديرين بيحددهم المالك من تبويب "الموظفين".
// ctx = {db, me:إيميلي, owner, name:()=>اسمي, k:()=>كنيتي, toast, redraw, onMe(ME) للمالك}
import {collection,doc,onSnapshot,setDoc,deleteDoc} from "./fb.js";
import {E} from "./cust.js";
const STYLE=`.pfa{border-radius:50%;object-fit:cover;flex:none;display:inline-block;vertical-align:middle;background:#1b1b1b}
.pfi{display:inline-grid;place-items:center;color:#d4ae5c;font-weight:800;line-height:1}
.pfme{display:inline-flex!important;align-items:center;gap:7px;padding:3px 12px 3px 4px!important}.pfme span{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:600px){.pfme span{display:none}.pfme{padding:3px!important}}
#pfm{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);padding:16px;align-items:center;justify-content:center}
#pfm.on{display:flex}#pfm .bx{background:var(--card);color:var(--ink);border-radius:20px;width:100%;max-width:400px;padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#pfm h3{margin:12px 0 2px;font-size:20px}#pfm .k{color:var(--acc);font-weight:700;min-height:22px}#pfm .off{font-size:13px}
#pfm .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
#pfm input[type=text]{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:9px 12px;margin-top:8px}
#pfm label{display:block;text-align:start;font-size:13px;color:var(--mut);margin-top:10px}`;
let X=null,AV={},ME=null,un=[],busy=false;
export const photo=em=>AV[String(em||"").toLowerCase()]||"";
// صورة الشخص، ولو مفيش: أول حرف من اسمه
export function avatar(em,name,sz){
  sz=sz||36;const p=photo(em),st=`width:${sz}px;height:${sz}px`;
  return p?`<img class="pfa" src="${p}" alt="" style="${st}">`:`<span class="pfa pfi" style="${st};font-size:${Math.round(sz*.44)}px">${E([...String(name||"؟").trim()][0]||"؟")}</span>`;
}
export const ownerMe=()=>ME||{};
export const meReady=()=>ME!==null;// اسم المالك اتحمّل؟
// زرار "أنا" في شريط اللوحة
export const chip=()=>X?`<button id="pfme" class="pfme" type="button" title="ملفي الشخصي">${avatar(X.me,X.name(),28)}<span>${E(X.name())}</span></button>`:"";
// الصورة بتتقص مربع من النص وتتصغّر (علشان الحجم يفضل صغير في Firebase)
async function shrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
    const S=160,c=document.createElement("canvas");c.width=c.height=S;const s=Math.min(img.naturalWidth,img.naturalHeight);
    const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,S,S);g.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,S,S);
    return c.toDataURL("image/jpeg",.82);
  }finally{URL.revokeObjectURL(url)}
}
function paint(){
  const m=document.getElementById("pfm");if(!m||!X)return;
  const own=X.owner,n=X.name(),k=X.k?X.k():"";
  m.innerHTML=`<div class="bx">${avatar(X.me,n,96)}<h3>${E(n)}</h3><div class="k">${E(k)}</div><div class="off" dir="ltr">${E(X.me)}</div>
  ${own?`<label for="pfn">اسمك (بيظهر للفروع في الشات)</label><input id="pfn" type="text" maxlength="60" value="${E(ME&&ME.n||n)}">
  <label for="pfk">كنيتك (بتظهر جنب اسمك)</label><input id="pfk" type="text" maxlength="40" placeholder="مثلاً: المدير العام" value="${E(ME&&ME.k||"")}">`
  :`<p class="off" style="margin:12px 0 0">الاسم والكنية بيحددهم مالك النظام.</p>`}
  <input id="pff" type="file" accept="image/*" hidden>
  <div class="row"><button class="bt p" data-pf="up" type="button" ${busy?"disabled":""}>${busy?"⏳ جاري الرفع...":photo(X.me)?"📷 غيّر الصورة":"📷 ارفع صورتك"}</button>${photo(X.me)?`<button class="bt" data-pf="rm" type="button">🗑 شيل الصورة</button>`:""}</div>
  <div class="row">${own?`<button class="bt g" data-pf="save" type="button">حفظ الاسم والكنية</button>`:""}<button class="bt" data-pf="x" type="button">إغلاق</button></div></div>`;
}
function open(){let m=document.getElementById("pfm");if(!m){m=document.createElement("div");m.id="pfm";document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)m.className=""})}m.className="on";paint()}
async function click(e){
  if(!X)return;
  if(e.target.closest("#pfme,[data-pfopen]"))return void open();
  const b=e.target.closest("[data-pf]");if(!b)return;const a=b.dataset.pf,m=document.getElementById("pfm");
  if(a==="x"){m.className="";return}
  if(a==="up"){document.getElementById("pff").click();return}
  try{
    if(a==="rm"&&confirm("تشيل صورتك؟")){await deleteDoc(doc(X.db,"ava",X.me));X.toast("اتشالت الصورة")}
    if(a==="save"&&X.owner){
      const n=document.getElementById("pfn").value.trim().slice(0,60),k=document.getElementById("pfk").value.trim().slice(0,40);
      if(!n)return void X.toast("اكتب اسمك");
      await setDoc(doc(X.db,"meta","me"),{n,k});X.toast("اتحفظ الاسم والكنية");m.className="";
    }
  }catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}
}
async function pick(e){
  if(!X||e.target.id!=="pff")return;const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  if(!/^image\//.test(f.type))return void X.toast("اختار صورة");
  busy=true;paint();
  try{const ph=await shrink(f);if(ph.length>78000)throw new Error("big");await setDoc(doc(X.db,"ava",X.me),{ph,ts:Date.now()});X.toast("✅ اترفعت صورتك")}
  catch(x){X.toast(x&&x.message==="big"?"الصورة كبيرة، جرّب صورة تانية":"تعذر رفع الصورة: "+(x&&x.code||x&&x.message))}
  busy=false;paint();
}
export function initProf(ctx){
  stopProf();X=ctx;
  if(!document.getElementById("pf-css")){const s=document.createElement("style");s.id="pf-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(!window.__pfc){window.__pfc=1;document.addEventListener("click",click);document.addEventListener("change",pick)}
  un.push(onSnapshot(collection(X.db,"ava"),sn=>{AV={};sn.docs.forEach(d=>{const p=d.data().ph;if(typeof p==="string"&&/^data:image\/jpeg;base64,/.test(p))AV[d.id]=p});paint();X.redraw()},()=>{}));
  if(X.owner)un.push(onSnapshot(doc(X.db,"meta","me"),d=>{ME=d.exists()?d.data():{};if(X.onMe)X.onMe(ME);paint()},()=>{}));
}
export function stopProf(){un.forEach(f=>f());un=[];AV={};ME=null;X=null;const m=document.getElementById("pfm");if(m)m.remove()}
