// 🖼 صور الأصناف (v221، 23 نوفمبر 2026، طلب محمد: «صورة المنتج في ورقة النواقص ونربطها بكود المنتج»، والملاحظات تفضل، والرفع للأدمن ومالك النظام بس)
//   مكتبة: صورة واحدة لكل كود. pimg/c{hex الكود} = {c, t مصغّرة, at, by} · pimgf/c{hex} = {c, img كبيرة} · pimgm/main = {v, l:[[كود, at]]}
//   العرض: أي عنصر <span class="pim" data-pimg="الكود"> بيتملى بالصورة لوحده (MutationObserver)، والضغط عليه يكبّرها.
//   ورقة النواقص (#rs): الصورة مكان رقم السطر. الورقة اليدوية جوّا اللوحة (iframe) بتستعير window.__tzPimg من اللوحة (pimgFrame).
//   الملف ده مابيستوردش fb.js: الدوال بتيجي من الصفحة (initPimg({db, fb:{doc,getDoc,writeBatch}, zoom, ...})).
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const nk=s=>String(s==null?"":s).toUpperCase().replace(/\s+/g,"");
export const pimgId=c=>"c"+Array.from(new TextEncoder().encode(String(c))).map(b=>(b<16?"0":"")+b.toString(16)).join("");
const CSS=`.pim{display:none}
.pim.on{display:inline-block;width:40px;height:40px;border-radius:9px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(42,29,44,.14),0 2px 6px rgba(42,29,44,.12);cursor:zoom-in;vertical-align:middle;flex:none}
.pim.on img{width:100%;height:100%;object-fit:cover;display:block}
html.pim-on .en th:first-child,html.pim-on .en td:first-child{width:50px!important;min-width:50px}
#rs td.hpi{font-size:0!important;padding:3px!important;text-align:center;vertical-align:middle}
#rs td.hpi .pim.on{width:42px;height:42px;border-radius:9px;margin:0 auto;display:block}
@media (max-width:560px){html.pim-on .en tr{grid-template-columns:40px repeat(6,minmax(0,1fr)) 46px}#rs td.hpi .pim.on{width:38px;height:38px}}
.kc .pim.on,td.k .pim.on{display:block;width:46px;height:46px;margin:6px auto 0}
@media print{.pim{display:none!important}#rs td.hpi{font-size:14px!important}}`;
function css(d){if(!d.getElementById("pim-css")){const s=d.createElement("style");s.id="pim-css";s.textContent=CSS;d.head.appendChild(s)}}

// ---------- المكتبة (الصفحة الأساسية: اللوحة أو صفحة الفرع) ----------
let X=null,MAP=new Map(),VER=0,LOADED=null,LAST=0,TH=new Map(),PEND=new Map(),SAVE=0;
function readLs(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function writeLs(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function setList(l,v){MAP=new Map();(Array.isArray(l)?l:[]).forEach(x=>{if(Array.isArray(x)&&x[0])MAP.set(nk(x[0]),{c:String(x[0]),at:N(x[1])})});VER=N(v)}
async function loadMeta(){
 if(!X)return;LAST=Date.now();
 try{const s=await X.fb.getDoc(X.fb.doc(X.db,"pimgm","main"));const d=s.exists()?s.data():null;setList(d&&d.l,d&&d.v);writeLs("tz_pimgm",{v:VER,l:[...MAP.values()].map(o=>[o.c,o.at])})}
 catch(e){const c=readLs("tz_pimgm");if(c)setList(c.l,c.v)}
 fillSoon();
}
const has=code=>MAP.has(nk(code));
// المصغّرات محفوظة على الجهاز (tz_pimgt) لحد ~1.5 مليون حرف، والقديم بيتشال
// (v240) الكاش بيتقري من الجهاز مرة واحدة في الذاكرة (كان بيتقري ~1.5 مليون حرف مع كل صورة)، والحفظ بيكتب كل الصور الجديدة
// (كان المؤقّت بيتلغي مع كل صورة فبتتحفظ آخر صورة بس، وكل الباقي يتنزّل تاني مع كل فتحة)
let TC=null;const tc=()=>TC||(TC=readLs("tz_pimgt")||{});
function cacheGet(c,at){const v=tc()[c];return v&&N(v[0])===at?String(v[1]||""):""}
function cachePut(c,at,t){const o=tc();delete o[c];o[c]=[at,t];clearTimeout(SAVE);SAVE=setTimeout(()=>{let s=JSON.stringify(o);
 while(s.length>1500000){const k=Object.keys(o);if(k.length<2)break;k.slice(0,Math.ceil(k.length/3)).forEach(x=>{delete o[x]});s=JSON.stringify(o)}
 try{localStorage.setItem("tz_pimgt",s)}catch(e){}},400)}
function thumb(code){
 const m=MAP.get(nk(code));if(!m||!X)return Promise.resolve(null);
 const key=m.c+"|"+m.at;if(TH.has(key))return Promise.resolve(TH.get(key));
 const cached=cacheGet(m.c,m.at);if(cached){TH.set(key,cached);return Promise.resolve(cached)}
 if(PEND.has(key))return PEND.get(key);
 const p=X.fb.getDoc(X.fb.doc(X.db,"pimg",pimgId(m.c))).then(s=>{const t=s.exists()?String(s.data().t||""):"";if(t){TH.set(key,t);cachePut(m.c,m.at,t)}PEND.delete(key);return t||null},()=>{PEND.delete(key);return null});
 PEND.set(key,p);return p;
}
async function open(code){
 const m=MAP.get(nk(code));if(!m||!X)return;
 let src="";try{const s=await X.fb.getDoc(X.fb.doc(X.db,"pimgf",pimgId(m.c)));src=s.exists()?String(s.data().img||""):""}catch(e){}
 if(!src)src=await thumb(m.c)||"";
 if(!src){if(X.toast)X.toast("تعذّر فتح الصورة");return}
 if(X.zoom)X.zoom(src,m.c);
}
const API={has,thumb,open,ver:()=>VER,n:()=>MAP.size,code:c=>{const m=MAP.get(nk(c));return m?m.c:""}};

// ---------- الرسم: أي .pim[data-pimg] + صفوف ورقة النواقص ----------
function sheetRows(d){
 const rs=d.getElementById("rs");if(!rs)return;
 rs.querySelectorAll("tr").forEach(tr=>{const td=tr.firstElementChild,K=tr.querySelector('input[data-k="k"]');if(!td||!K)return;
  let sp=td.querySelector(".pim");const v=K.value.trim();
  if(!sp){if(!v)return;sp=d.createElement("span");sp.className="pim";sp.setAttribute("aria-hidden","true");td.appendChild(sp)}
  if(sp.getAttribute("data-pimg")!==v)sp.setAttribute("data-pimg",v)});
}
function fill(d,api){
 if(!api)return;d.documentElement.classList.toggle("pim-on",api.n()>0);sheetRows(d);
 d.querySelectorAll(".pim[data-pimg]").forEach(sp=>{const c=sp.getAttribute("data-pimg")||"",td=sp.parentElement,num=td&&td.parentElement&&td.parentElement.parentElement&&td.parentElement.parentElement.id==="rs"&&td===td.parentElement.firstElementChild;
  const off=()=>{if(sp.className!=="pim"){sp.className="pim";sp.innerHTML=""}sp.removeAttribute("data-pf");if(num)td.classList.remove("hpi")};
  if(!c||!api.has(c))return off();
  const want=api.code(c)+"|"+api.ver();if(sp.getAttribute("data-pf")===want)return;sp.setAttribute("data-pf",want);
  api.thumb(c).then(t=>{if(sp.getAttribute("data-pf")!==want)return;if(!t)return off();
   sp.innerHTML=`<img src="${E(t)}" alt="" loading="lazy" decoding="async">`;sp.className="pim on";sp.title="صورة الصنف "+api.code(c)+" · اضغط للتكبير";if(num)td.classList.add("hpi")})});
}
function wire(d,getApi){
 css(d);let tm=0;const soon=()=>{clearTimeout(tm);tm=setTimeout(()=>fill(d,getApi()),140)};
 new MutationObserver(soon).observe(d.body,{childList:true,subtree:true});
 d.addEventListener("input",e=>{const t=e.target;if(t&&t.getAttribute&&t.getAttribute("data-k")==="k")soon()});
 d.addEventListener("change",e=>{const t=e.target;if(t&&t.getAttribute&&t.getAttribute("data-k")==="k")soon()});
 d.addEventListener("click",e=>{const sp=e.target&&e.target.closest&&e.target.closest(".pim.on");if(!sp)return;e.preventDefault();e.stopPropagation();const a=getApi();if(a)a.open(sp.getAttribute("data-pimg"))},true);
 soon();return soon;
}
let soonMain=null;const fillSoon=()=>{if(soonMain)soonMain()};
export function initPimg(ctx){
 X=ctx;const c=readLs("tz_pimgm");if(c&&!MAP.size)setList(c.l,c.v);
 window.__tzPimg=API;if(!soonMain)soonMain=wire(document,()=>X?API:null);
 LOADED=loadMeta();
 if(!initPimg.w){initPimg.w=1;document.addEventListener("visibilitychange",()=>{if(!document.hidden&&X&&Date.now()-LAST>10*6e4)loadMeta()})}
 return LOADED;
}
export function stopPimg(){X=null;TH=new Map();PEND=new Map();if(window.__tzPimg===API)window.__tzPimg=null}
// الورقة اليدوية (sheet.html جوّا اللوحة): نفس العرض، والقراءة والتكبير من اللوحة نفسها
export function pimgFrame(){
 const getApi=()=>{try{return window.parent&&window.parent!==window&&window.parent.__tzPimg||null}catch(e){return null}};
 const soon=wire(document,getApi);let n=0;const iv=setInterval(()=>{n++;soon();if(n>=20||(getApi()&&getApi().ver()))clearInterval(iv)},1500);
 window.addEventListener("focus",soon);
}
export const pimgState=()=>({n:MAP.size,v:VER,cached:TH.size});

// ---------- 🖼 صفحة الرفع (⚙ الإعدادات، للأدمن ومالك النظام) ----------
let PICK=null,BUSY=false,PROG="",Q="",SHOW=60,MISS=false;
const baseName=n=>String(n||"").replace(/^.*[\\/]/,"").replace(/\.[A-Za-z0-9]{2,5}$/,"").replace(/\s*\(\d+\)$/,"").replace(/[_\s]+$/,"").trim();
function catMap(){const m=new Map();(X&&X.codes?X.codes():[]).forEach(x=>{const c=Array.isArray(x)?x[0]:x;if(c)m.set(nk(c),{c:String(c),n:Array.isArray(x)?String(x[1]||""):""})});return m}
function plan(files){
 const C=catMap(),seen=new Set(),ok=[],bad=[],dup=[];
 Array.from(files||[]).forEach(f=>{if(!/^image\//.test(f.type||"")&&!/\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(f.name))return;
  const b=baseName(f.name);if(!b){bad.push(f.name);return}
  const k=nk(b),hit=C.size?C.get(k):{c:b};if(!hit||b.length>40){bad.push(f.name);return}
  if(seen.has(k)){dup.push(f.name);return}seen.add(k);ok.push({f,c:hit.c,n:hit.n||"",old:MAP.has(k)})});
 ok.sort((a,b)=>a.c.localeCompare(b.c,"en",{numeric:true}));
 return {ok,bad,dup,cat:C.size};
}
function readImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{res(im)};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("img"))};im.src=u;im._u=u})}
function draw(im,max,q,limit){
 let w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(!w||!h)throw new Error("img");
 let sc=Math.min(1,max/Math.max(w,h)),out="";
 for(let tries=0;tries<6;tries++){const W=Math.max(1,Math.round(w*sc)),H=Math.max(1,Math.round(h*sc)),cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,W,H);x.drawImage(im,0,0,W,H);
  out=cv.toDataURL("image/jpeg",q);if(out.length<=limit)return out;if(q>.55)q-=.1;else sc*=.8}
 if(out.length>limit)throw new Error("big");return out;
}
async function shrink(file){const im=await readImg(file);try{return {img:draw(im,1100,.82,500000),t:draw(im,200,.74,38000)}}finally{try{URL.revokeObjectURL(im._u)}catch(e){}}}
async function saveMeta(add,del){
 const s=await X.fb.getDoc(X.fb.doc(X.db,"pimgm","main"));const d=s.exists()?s.data():null,m=new Map();
 (d&&Array.isArray(d.l)?d.l:[]).forEach(x=>{if(Array.isArray(x)&&x[0])m.set(nk(x[0]),[String(x[0]),N(x[1])])});
 (add||[]).forEach(x=>m.set(nk(x[0]),x));(del||[]).forEach(c=>m.delete(nk(c)));
 const l=[...m.values()].sort((a,b)=>a[0].localeCompare(b[0],"en",{numeric:true})),v=Date.now();
 await X.fb.setDoc(X.fb.doc(X.db,"pimgm","main"),{v,l,at:v,by:{e:String(X.me&&X.me.e||"").slice(0,120),n:String(X.me&&X.me.n||"").slice(0,60)}});
 setList(l,v);writeLs("tz_pimgm",{v,l});fillSoon();
}
async function upload(list){
 if(BUSY||!list.length)return;BUSY=true;let done=0,fail=[],batch=[],added=[];const by={e:String(X.me&&X.me.e||"").slice(0,120),n:String(X.me&&X.me.n||"").slice(0,60)};
 const flush=async()=>{if(!batch.length)return;const b=X.fb.writeBatch(X.db);batch.forEach(x=>{b.set(X.fb.doc(X.db,"pimgf",pimgId(x.c)),{c:x.c,img:x.img,at:x.at});b.set(X.fb.doc(X.db,"pimg",pimgId(x.c)),{c:x.c,t:x.t,at:x.at,by})});
  try{await b.commit();batch.forEach(x=>added.push([x.c,x.at]))}catch(e){batch.forEach(x=>fail.push(x.c+" (الحفظ)"))}batch=[]};
 try{for(const it of list){PROG=`جاري الرفع… ${done} من ${list.length}`;paint();
   try{const r=await shrink(it.f);batch.push({c:it.c,img:r.img,t:r.t,at:Date.now()})}catch(e){fail.push(it.c+" (الصورة)")}
   done++;if(batch.length>=4)await flush();if(added.length&&added.length%40===0)await saveMeta(added.splice(0),[])}
  await flush();if(added.length)await saveMeta(added,[]);
  PICK=null;PROG="";X.toast(fail.length?`رُفعت ${list.length-fail.length} صورة، وتعذّرت ${fail.length}: ${fail.slice(0,5).join("، ")}`:`✅ رُفعت ${list.length} صورة`,fail.length?"er":"")}
 catch(e){X.toast("تعذّر الرفع: "+(e&&(e.code||e.message)||""),"er")}
 BUSY=false;PROG="";paint();
}
async function remove(c){
 if(!confirm(`حذف صورة الكود ${c}؟`))return;
 try{const b=X.fb.writeBatch(X.db);b.delete(X.fb.doc(X.db,"pimg",pimgId(c)));b.delete(X.fb.doc(X.db,"pimgf",pimgId(c)));await b.commit();await saveMeta([],[c]);X.toast("حُذفت الصورة")}
 catch(e){X.toast("تعذّر الحذف: "+(e&&(e.code||e.message)||""),"er")}paint();
}
function paint(){if(X&&X.redraw)X.redraw()}
export function pimgAdminView(){
 if(!X||!X.owner)return `<div class="pan"><p class="off" style="margin:0">صور الأصناف يرفعها الأدمن ومالك النظام.</p></div>`;
 const C=catMap(),all=[...MAP.values()].sort((a,b)=>a.c.localeCompare(b.c,"en",{numeric:true})),q=nk(Q);
 const list=all.filter(o=>!q||nk(o.c).includes(q)),inCat=C.size?all.filter(o=>C.has(nk(o.c))).length:0;
 const miss=C.size?[...C.values()].filter(o=>!MAP.has(nk(o.c))):[];
 const P=PICK;
 return `<div class="pan pmg"><style>.pmg .pmh{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.pmg .pmh label.b{cursor:pointer}.pmg .pmh input[type=file]{display:none}
.pmg .pmgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;margin-top:10px}.pmg .pmc{background:var(--soft,#f6eee3);border-radius:14px;padding:8px;text-align:center;font-size:13px}
.pmg .pmc .pim.on{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:10px}.pmg .pmc b{display:block;margin:6px 0 4px;direction:ltr}.pmg .pmc .x{display:flex;gap:4px;justify-content:center}.pmg .pmc .x button,.pmg .pmc .x label{font:inherit;font-size:12px;border:1px solid var(--line,#e3d5c3);background:var(--card,#fff);color:var(--ink);border-radius:8px;padding:3px 7px;cursor:pointer}.pmg .pmc .x input{display:none}
.pmg .pmp{background:var(--soft,#f6eee3);border-radius:14px;padding:12px 14px;margin:10px 0;line-height:1.8}.pmg .pmp .r{color:#b0392b}.pmg .pmp ul{margin:4px 0;padding-inline-start:18px;max-height:180px;overflow:auto;font-size:13px}
.pmg .pmq{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px}.pmg .pmq input[type=search]{flex:1;min-width:160px;font:inherit;border:1.5px solid var(--line,#e3d5c3);border-radius:999px;padding:8px 14px;background:var(--card);color:var(--ink)}
.pmg .pmm{font-size:13px;color:var(--mut);line-height:1.9;margin-top:8px}.pmg .pmm bdi{background:var(--soft,#f6eee3);border-radius:6px;padding:1px 6px;margin:2px;display:inline-block}</style>
 <h2 style="margin:0 0 6px">🖼 صور الأصناف</h2>
 <p class="off" style="margin:0;line-height:1.9">صورة واحدة لكل كود، تظهر تلقائياً في ورقة النواقص عند الفروع وفي الورقة اليدوية وفي الطلبات بمجرد كتابة الكود. <b>سمِّ كل صورة باسم الكود</b> (مثل <bdi dir="ltr">13016.jpg</bdi>) ثم اختر الصور كلها أو الفولدر مرة واحدة. صورة الكود الموجود تُستبدل.</p>
 <div class="pmh">${BUSY?`<b>${E(PROG)}</b>`:`<label class="b p">📁 اختر صوراً<input type="file" accept="image/*" multiple data-pi="files"></label><label class="b">🗂 اختر فولدراً<input type="file" multiple webkitdirectory data-pi="files"></label>`}</div>
 ${P&&!BUSY?`<div class="pmp"><b>${P.ok.length} صورة جاهزة للرفع</b>${P.ok.filter(x=>x.old).length?` (منها ${P.ok.filter(x=>x.old).length} ستستبدل صورة موجودة)`:""}.${P.cat?"":" لا يوجد كتالوج أصناف محمَّل، فكل اسم صورة سيُعتبر كوداً."}
  ${P.bad.length?`<div class="r">${P.bad.length} ملف لم يُعرف كوده${P.cat?" في الكتالوج":""} ولن يُرفع:</div><ul>${P.bad.slice(0,60).map(n=>`<li><bdi dir="ltr" data-notr>${E(n)}</bdi></li>`).join("")}</ul>`:""}
  ${P.dup.length?`<div>${P.dup.length} ملف مكرر لنفس الكود (سيُرفع الأول فقط).</div>`:""}
  <div class="pmh">${P.ok.length?`<button type="button" class="b p" data-pi="go">⬆️ رفع ${P.ok.length} صورة</button>`:""}<button type="button" class="b" data-pi="cancel">إلغاء</button></div></div>`:""}
 <div class="pmq"><b>${all.length} كود له صورة</b>${C.size?`<span class="off">· ${inCat} من ${C.size} كود في الكتالوج</span>`:""}<input type="search" placeholder="ابحث بالكود" value="${E(Q)}" data-pi="q" autocomplete="off">${miss.length?`<button type="button" class="b" data-pi="miss">${MISS?"إخفاء":"عرض"} الأكواد بلا صورة (${miss.length})</button>`:""}</div>
 ${MISS&&miss.length?`<div class="pmm">${miss.slice(0,400).map(o=>`<bdi dir="ltr" data-notr>${E(o.c)}</bdi>`).join("")}${miss.length>400?` … و${miss.length-400} أخرى`:""}</div>`:""}
 <div class="pmgrid">${list.slice(0,SHOW).map(o=>`<div class="pmc"><span class="pim" data-pimg="${E(o.c)}"></span><b><bdi data-notr>${E(o.c)}</bdi></b><div class="x"><label>استبدال<input type="file" accept="image/*" data-pi="one" data-c="${E(o.c)}"></label><button type="button" data-pi="del" data-c="${E(o.c)}">حذف</button></div></div>`).join("")}</div>
 ${list.length>SHOW?`<div class="pmh"><button type="button" class="b" data-pi="more">عرض المزيد (${list.length-SHOW})</button></div>`:""}
 ${!all.length?`<p class="off" style="margin:14px 0 0">لا توجد صور بعد.</p>`:""}</div>`;
}
if(!pimgAdminView.w){pimgAdminView.w=1;
 document.addEventListener("change",e=>{const t=e.target;if(!X||!X.owner||!t||!t.getAttribute)return;const a=t.getAttribute("data-pi");
  if(a==="files"){PICK=plan(t.files);t.value="";paint();return}
  if(a==="one"&&t.files&&t.files[0]){const f=t.files[0],c=t.getAttribute("data-c");t.value="";upload([{f,c,old:true}]);return}});
 document.addEventListener("input",e=>{const t=e.target;if(!X||!t||!t.getAttribute||t.getAttribute("data-pi")!=="q")return;Q=t.value;SHOW=60;clearTimeout(pimgAdminView.tq);pimgAdminView.tq=setTimeout(()=>{paint();setTimeout(()=>{const i=document.querySelector('[data-pi="q"]');if(i){i.focus();const n=i.value.length;try{i.setSelectionRange(n,n)}catch(x){}}},60)},250)});
 document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("button[data-pi]");if(!b||!X||!X.owner)return;const a=b.getAttribute("data-pi");
  if(a==="go"&&PICK)return void upload(PICK.ok);
  if(a==="cancel"){PICK=null;paint();return}
  if(a==="more"){SHOW+=120;paint();return}
  if(a==="miss"){MISS=!MISS;paint();return}
  if(a==="del")return void remove(b.getAttribute("data-c"));});
}
