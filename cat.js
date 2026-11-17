// 📦 كتالوج الأصناف (17 نوفمبر 2026، طلب محمد): الكود ← ألوانه بس ← مقاساته بس، من ملف سيستم الشركة (كود، لون، مقاس، اسم، UPC).
// - الرفع (للمالك الأصلي ومالك النظام): ⚙ الإعدادات ← «📦 كتالوج الأصناف» ← ملف xlsx أو csv ← معاينة (العدد، المكرر، الجديد والمحذوف) ← اعتماد ونشر.
// - التخزين: cat/meta = {v, n, rows, parts, at, by, src} و cat/p0..p29 = {v, r:[[كود,لون,مقاس,UPC]...], nm:{كود:اسم}} (2500 سطر في الجزء).
// - كل جهاز بينزّل الكتالوج مرة واحدة لكل نسخة (v) ويحتفظ بيه في localStorage (tz_cat)، فالكتابة فورية ومن غير قراءات زيادة.
// - ورقة نواقص الفرع (catSheet): اقتراحات الكود من الكتالوج، واللون = ألوان الكود ده بس، والمقاس = مقاسات الكود واللون دول بس،
//   والـ UPC (مسدس باركود أو كتابة) بيملّى الكود واللون والمقاس لوحده. الكود/اللون/المقاس اللي مش في السيستم بيتعلّم بالأصفر (تحذير بس، مش منع).
const FB=()=>import("./fb.js");// وقت الحاجة بس: الورقة اليدوية (sheet.html) بتستورد الملف ده من غير Supabase
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const nk=s=>String(s==null?"":s).toUpperCase().replace(/\s+/g,"");// مفتاح الكود: من غير مسافات ومن غير فرق كابيتال
const lc=s=>String(s==null?"":s).trim().toLowerCase();
const PART=2500;
let CAT=null,LOADING=null,X=null,PREV=null,BUSY=false,MSG="";

// ---------- التحميل والكاش ----------
function readCache(){try{const s=localStorage.getItem("tz_cat");if(!s)return null;const o=JSON.parse(s);return o&&Array.isArray(o.r)?o:null}catch(e){return null}}
function writeCache(raw){try{localStorage.setItem("tz_cat",JSON.stringify(raw))}catch(e){}}
function index(raw){
 const codes=new Map(),upc=new Map();
 raw.r.forEach(a=>{const c=String(a[0]||""),cl=String(a[1]||""),z=String(a[2]||""),u=String(a[3]||"");if(!c)return;
  const k=nk(c);let o=codes.get(k);if(!o){o={c,n:String(raw.nm&&raw.nm[c]||""),cols:new Map(),all:new Set()};codes.set(k,o)}
  if(cl){if(!o.cols.has(cl))o.cols.set(cl,new Set());if(z)o.cols.get(cl).add(z)}
  if(z)o.all.add(z);
  if(u)upc.set(u,{c,cl,z})});
 return {v:N(raw.v),at:N(raw.at),src:raw.src||"",by:raw.by||null,n:codes.size,rows:raw.r.length,codes,upc,raw};
}
export const catNow=()=>CAT;
// الورقة اليدوية (iframe): الكتالوج من الكاش اللي اللوحة نزّلته
export function catFromCache(){const r=readCache();if(r&&(!CAT||N(CAT.v)!==N(r.v)))CAT=index(r);return CAT}
export function catLoad(db,force){
 if(LOADING&&!force)return LOADING;
 LOADING=(async()=>{
  const cached=readCache();
  const {doc,getDoc}=await FB();
  let m=null;try{const s=await getDoc(doc(db,"cat","meta"));m=s.exists()?s.data():null}catch(e){m=null}
  if(!m){if(cached)CAT=index(cached);return CAT}
  if(cached&&N(cached.v)===N(m.v)){CAT=index(cached);return CAT}
  const n=Math.max(1,Math.min(30,N(m.parts)));let parts=[];
  try{parts=await Promise.all(Array.from({length:n},(_,i)=>getDoc(doc(db,"cat","p"+i)).then(s=>s.exists()?s.data():null)))}catch(e){parts=[]}
  if(!parts.length||parts.some(p=>!p||N(p.v)!==N(m.v))){if(cached)CAT=index(cached);return CAT}// نسخة نصّها لسه بيترفع: نكمّل بالقديمة
  const raw={v:N(m.v),at:N(m.at),src:m.src||"",by:m.by||null,r:[].concat.apply([],parts.map(p=>Array.isArray(p.r)?p.r:[])),nm:Object.assign.apply(Object,[{}].concat(parts.map(p=>p.nm||{})))};
  writeCache(raw);CAT=index(raw);return CAT;
 })();
 return LOADING;
}
// ---------- البحث ----------
export const catCode=c=>CAT&&c?CAT.codes.get(nk(c))||null:null;
function colorKey(o,cl){if(!o||!cl)return null;if(o.cols.has(cl))return cl;const l=lc(cl);for(const k of o.cols.keys())if(lc(k)===l)return k;return null}
function sizesFor(o,cl){if(!o)return [];const k=colorKey(o,cl),S=k&&o.cols.get(k).size?o.cols.get(k):o.all;return [...S]}
function zSort(a,b){const x=parseFloat(a),y=parseFloat(b);if(!isNaN(x)&&!isNaN(y)&&x!==y)return x-y;const O=["XS","S","M","L","XL","XXL","2XL","3XL"];const i=O.indexOf(String(a).toUpperCase()),j=O.indexOf(String(b).toUpperCase());if(i>=0&&j>=0)return i-j;return String(a).localeCompare(String(b))}
// تحقق سطر: {k:مش موجود, c:اللون مش من ألوان الكود, z:المقاس مش من مقاساته}
export function catCheck(k,cl,z){
 const r={k:false,c:false,z:false,o:null};if(!CAT||!String(k||"").trim())return r;
 const o=catCode(k);r.o=o;if(!o){r.k=true;return r}
 if(String(cl||"").trim()&&o.cols.size&&!colorKey(o,String(cl).trim()))r.c=true;
 if(String(z||"").trim()){const S=sizesFor(o,String(cl||"").trim());if(S.length&&!S.some(x=>lc(x)===lc(z)))r.z=true}
 return r;
}

// ---------- ورقة نواقص الفرع ----------
const opts=L=>L.map(x=>`<option value="${E(x)}">`).join("");
let SHEETON=false,REFRESH=null;
export function catSheet(){
 if(SHEETON){if(REFRESH)REFRESH();return}
 if(!CAT||!g("rs"))return;SHEETON=true;
 const dc=g("dc"),dz=g("dz"),DC0=dc?dc.innerHTML:"",DZ0=dz?dz.innerHTML:"";
 let dk=g("dk");if(!dk){dk=document.createElement("datalist");dk.id="dk";document.body.appendChild(dk)}
 const fillDk=()=>{dk.innerHTML=[...CAT.codes.values()].map(o=>`<option value="${E(o.c)}"${o.n?` label="${E(o.n)}"`:""}>`).join("")};fillDk();
 if(!g("cat-css")){const s=document.createElement("style");s.id="cat-css";s.textContent=`#rs input.catw{box-shadow:inset 0 0 0 2px #e8a317!important;background:color-mix(in srgb,#e8a317 12%,var(--field,#fff))!important}
#catn{margin:8px 0 0;padding:8px 12px;border-radius:12px;background:color-mix(in srgb,#e8a317 14%,transparent);color:var(--ink,#2a1d2c);font-size:13.5px;line-height:1.6}
#catn[hidden]{display:none}`;document.head.appendChild(s)}
 const tb=g("rs").closest("table"),host=tb&&tb.parentNode;if(host&&!g("catn")){const n=document.createElement("div");n.id="catn";n.hidden=true;n.setAttribute("role","status");host.parentNode.insertBefore(n,host.nextSibling)}
 const inp=(i,k)=>document.querySelector(`#rs input[data-i="${i}"][data-k="${k}"]`);
 const set=(el,v)=>{if(!el||el.value===v)return;el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))};
 const mark=i=>{const K=inp(i,"k"),C=inp(i,"c"),Z=inp(i,"z");if(!K)return false;const r=catCheck(K.value,C&&C.value,Z&&Z.value);
  const w=(el,on,t)=>{if(!el)return;el.classList.toggle("catw",!!on);if(on)el.title=t;else if(el===K)el.title=r.o&&r.o.n?r.o.n:"";else el.removeAttribute("title")};
  w(K,r.k,"الكود غير موجود في سيستم الشركة");w(C,r.c,"هذا اللون غير موجود لهذا الكود في السيستم");w(Z,r.z,"هذا المقاس غير موجود لهذا الكود واللون في السيستم");
  return r.k||r.c||r.z};
 const markAll=()=>{let n=0;document.querySelectorAll('#rs input[data-k="k"]').forEach(el=>{if(mark(el.dataset.i))n++});const b=g("catn");if(b){b.hidden=!n;b.textContent=n?`⚠️ ${n} ${n===1?"سطر فيه":"أسطر فيها"} كود أو لون أو مقاس غير موجود في سيستم الشركة (مُعلَّم بالأصفر). يمكنك الإرسال، لكن راجِعها أولاً.`:""}};
 let tm=0;const later=()=>{clearTimeout(tm);tm=setTimeout(markAll,120)};
 document.addEventListener("focusin",e=>{const t=e.target;if(!CAT||!t||!t.closest||!t.closest("#rs")||t.dataset.i==null)return;const i=t.dataset.i,o=catCode(inp(i,"k")&&inp(i,"k").value);
  if(t.dataset.k==="k"){if(t.getAttribute("list")!=="dk")t.setAttribute("list","dk");return}
  // كود معروف ← اختياراته هو بس (حتى لو فاضية: الكود مالوش ألوان/مقاسات). كود مش معروف ← القايمة العامة زي الأول
  if(t.dataset.k==="c"&&dc)dc.innerHTML=o?opts([...o.cols.keys()]):DC0;
  if(t.dataset.k==="z"&&dz)dz.innerHTML=o?opts(sizesFor(o,inp(i,"c")&&inp(i,"c").value).sort(zSort)):DZ0;
 },true);
 document.addEventListener("input",e=>{const t=e.target;if(!CAT||!t||!t.closest||!t.closest("#rs")||t.dataset.i==null)return;const i=t.dataset.i;
  // UPC (مسدس الباركود أو كتابة): بيملّى الكود واللون والمقاس ويروح للكمية
  if(t.dataset.k==="k"){const v=t.value.trim();if(/^\d{8,20}$/.test(v)){const h=CAT.upc.get(v);if(h){set(t,h.c);set(inp(i,"c"),h.cl||"");set(inp(i,"z"),h.z||"");const q=inp(i,"q");if(q)q.focus()}}}
  later()});
 // كود اتكتب: لو ليه لون واحد بس أو مقاس واحد بس والخانة فاضية، نملاها
 document.addEventListener("change",e=>{const t=e.target;if(!CAT||!t||!t.closest||!t.closest("#rs")||t.dataset.i==null)return;const i=t.dataset.i;
  if(t.dataset.k==="k"||t.dataset.k==="c"){const o=catCode(inp(i,"k")&&inp(i,"k").value);if(o){const C=inp(i,"c"),Z=inp(i,"z");
   if(t.dataset.k==="k"&&o.c!==t.value&&nk(o.c)===nk(t.value))set(t,o.c);// نفس الكود بشكل مختلف (مسافات/حروف صغيرة) ← زي السيستم
   if(C&&!C.value.trim()&&o.cols.size===1)set(C,[...o.cols.keys()][0]);
   else if(C&&C.value.trim()){const k=colorKey(o,C.value.trim());if(k&&k!==C.value)set(C,k)}
   const S=sizesFor(o,C&&C.value);if(Z&&!Z.value.trim()&&S.length===1)set(Z,S[0])}}
  later()});
 const mo=new MutationObserver(later);mo.observe(g("rs"),{childList:true});
 REFRESH=()=>{fillDk();markAll()};
 markAll();
}

// ---------- قراية الملف (xlsx أو csv) ----------
async function unzip(buf){
 const u8=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
 for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
 if(e<0)throw new Error("zip");
 const cnt=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);const F={};
 for(let k=0;k<cnt;k++){if(dv.getUint32(off,true)!==0x02014b50)break;
  const meth=dv.getUint16(off+10,true),csz=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),xl=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lho=dv.getUint32(off+42,true);
  F[new TextDecoder().decode(u8.subarray(off+46,off+46+nl))]={meth,csz,lho};off+=46+nl+xl+cl}
 return async name=>{const f=F[name];if(!f)return null;const st=f.lho+30+dv.getUint16(f.lho+26,true)+dv.getUint16(f.lho+28,true),data=u8.subarray(st,st+f.csz);
  if(f.meth===0)return new TextDecoder().decode(data);if(f.meth!==8)throw new Error("zipmeth");
  if(typeof DecompressionStream==="undefined")throw new Error("nodecomp");
  return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text()};
}
const XP=s=>new DOMParser().parseFromString(s,"application/xml");
async function readXlsx(buf){
 const get=await unzip(buf);let sheet="xl/worksheets/sheet1.xml";
 try{const wb=XP(await get("xl/workbook.xml")),rel=XP(await get("xl/_rels/workbook.xml.rels"));const s1=wb.getElementsByTagName("sheet")[0];
  const rid=s1&&(s1.getAttribute("r:id")||s1.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id"));
  const R=[...rel.getElementsByTagName("Relationship")].find(r=>r.getAttribute("Id")===rid);if(R){const t=R.getAttribute("Target").replace(/^\/?(xl\/)?/,"");sheet="xl/"+t}}catch(e){}
 const ssx=await get("xl/sharedStrings.xml"),SS=ssx?[...XP(ssx).getElementsByTagName("si")].map(si=>[...si.getElementsByTagName("t")].map(t=>t.textContent).join("")):[];
 const shx=await get(sheet);if(!shx)throw new Error("nosheet");
 const col=r=>{let n=0;for(const ch of String(r).replace(/\d+/g,""))n=n*26+ch.charCodeAt(0)-64;return n-1};
 const out=[];[...XP(shx).getElementsByTagName("row")].forEach(row=>{const a=[];[...row.getElementsByTagName("c")].forEach(c=>{const t=c.getAttribute("t"),v=c.getElementsByTagName("v")[0],is=c.getElementsByTagName("t")[0];
  a[col(c.getAttribute("r"))]=t==="s"?(SS[+(v&&v.textContent)]||""):t==="inlineStr"?(is?is.textContent:""):(v?v.textContent:"")});out.push(a)});
 return out;
}
function readCsv(txt){
 txt=txt.replace(/^﻿/,"");const first=txt.split(/\r?\n/)[0]||"",sep=[["\t",(first.match(/\t/g)||[]).length],[";",(first.match(/;/g)||[]).length],[",",(first.match(/,/g)||[]).length]].sort((a,b)=>b[1]-a[1])[0][0];
 const out=[];let row=[],cur="",q=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];
  if(q){if(ch==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch;continue}
  if(ch==='"')q=true;else if(ch===sep){row.push(cur);cur=""}else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&txt[i+1]==="\n")i++;row.push(cur);out.push(row);row=[];cur=""}else cur+=ch}
 if(cur||row.length){row.push(cur);out.push(row)}
 return out;
}
const ROLE={c:["description2","code","itemcode","item_code","style","stylecode","الكود","كود","كودالصنف","رقمالصنف"],cl:["attribute","color","colour","اللون","لون"],z:["item_size","itemsize","size","المقاس","مقاس"],n:["description1","description","name","itemname","item_name","اسمالصنف","الاسم","الصنف","البيان","الوصف"],u:["upc","barcode","ean","الباركود","باركود","upccode"]};
function build(rows){
 const key=s=>String(s==null?"":s).trim().toLowerCase().replace(/\s+/g,"");
 let hi=-1,M=null;
 for(let i=0;i<Math.min(10,rows.length);i++){const r=rows[i]||[],m={};r.forEach((v,j)=>{const k=key(v);Object.keys(ROLE).forEach(R=>{if(m[R]==null&&ROLE[R].includes(k))m[R]=j})});if(m.c!=null&&Object.keys(m).length>=2){hi=i;M=m;break}}
 if(!M)return {err:"لم أجد عمود الكود في الملف. يجب أن يكون في أول صف عناوين مثل: الكود، اللون، المقاس، UPC (أو DESCRIPTION2, ATTRIBUTE, ITEM_SIZE, UPC)."};
 const T=(r,R)=>M[R]==null?"":String(r[M[R]]==null?"":r[M[R]]).trim();
 const seen=new Set(),out=[],nm={},kz={};let empty=0,dupe=0,noUpc=0,sci=0;
 for(let i=hi+1;i<rows.length;i++){const r=rows[i]||[];const c=T(r,"c").slice(0,40),cl=T(r,"cl").slice(0,40),z=T(r,"z").slice(0,20),u=T(r,"u").slice(0,30),n=T(r,"n").slice(0,80);
  if(!c){if(cl||z||u)empty++;continue}
  if(/e\+/i.test(u))sci++;if(!u)noUpc++;
  const id=[c,cl,z,u].join("\u0001");if(seen.has(id)){dupe++;continue}seen.add(id);
  out.push([c,cl,z,u]);if(n&&!nm[c])nm[c]=n;if(cl||z){const k=c+"|"+cl+"|"+z;kz[k]=(kz[k]||0)+1}}
 const codes=new Set(out.map(a=>a[0])),cols=new Set(out.map(a=>a[1]).filter(Boolean)),szs=new Set(out.map(a=>a[2]).filter(Boolean));
 const dk=Object.keys(kz).filter(k=>kz[k]>1);
 return {rows:out,nm,codes:codes.size,colors:cols.size,sizes:szs.size,empty,dupe,noUpc,sci,dupKeys:dk.length,dupCodes:[...new Set(dk.map(k=>k.split("|")[0]))].slice(0,5),
  cols:Object.keys(M).map(R=>({c:"الكود",cl:"اللون",z:"المقاس",n:"الاسم",u:"UPC"}[R]))};
}

// ---------- قسم الإعدادات (للمالك) ----------
export function initCat(ctx){X=ctx;PREV=null;BUSY=false;MSG="";if(X&&X.db)catLoad(X.db).then(()=>{if(X&&X.redraw)X.redraw()})}
const dstr=t=>N(t)?new Date(N(t)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
export function catAdminView(){
 const c=CAT,fmt=n=>N(n).toLocaleString("en-US");
 const cur=c?`<div class="cat-st"><div><b>${fmt(c.n)}</b><small>كود</small></div><div><b>${fmt(c.rows)}</b><small>صنف (كود + لون + مقاس)</small></div><div><b>${fmt(c.upc.size)}</b><small>UPC</small></div></div>
  <p class="off" style="margin:8px 0 0;font-size:13px">آخر تحديث: <bdi dir="ltr">${dstr(c.at)}</bdi>${c.by&&c.by.n?` · بواسطة ${E(c.by.n)}`:""}${c.src?` · الملف: <bdi dir="ltr" data-notr>${E(c.src)}</bdi>`:""}</p>`
  :`<p class="off" style="margin:0">لم يُرفع كتالوج بعد. ارفع ملف الأصناف من سيستم الشركة لتبدأ ورقة النواقص في اقتراح الألوان والمقاسات الصحيحة لكل كود.</p>`;
 let pv="";
 if(PREV&&PREV.err)pv=`<div class="cat-w bad">❌ ${E(PREV.err)}</div>`;
 else if(PREV){const p=PREV,old=c?new Set([...c.codes.values()].map(o=>o.c)):new Set(),nw=new Set(p.rows.map(a=>a[0])),add=[...nw].filter(x=>!old.has(x)),rem=[...old].filter(x=>!nw.has(x));
  const W=[];if(p.dupKeys)W.push(`${p.dupKeys} صنف مكرر بنفس الكود واللون والمقاس وبأكثر من UPC (مثل: ${p.dupCodes.map(E).join("، ")}). سيُقبل كما هو.`);
  if(p.empty)W.push(`${p.empty} صف بدون كود، سيُتجاهل.`);if(p.dupe)W.push(`${p.dupe} صف مكرر بالكامل، سيُحذف التكرار.`);if(p.noUpc)W.push(`${p.noUpc} صف بدون UPC.`);
  if(p.sci)W.push(`${p.sci} رقم UPC مكتوب بالصيغة العلمية (مثل 6.29E+12)، أي أن الإكسل غيّره. اجعل عمود UPC «نصاً» وصدّر الملف من جديد.`);
  pv=`<div class="cat-pv"><h4>معاينة الملف <small><bdi dir="ltr" data-notr>${E(p.src)}</bdi></small></h4>
  <div class="cat-st"><div><b>${fmt(p.codes)}</b><small>كود</small></div><div><b>${fmt(p.rows.length)}</b><small>صنف</small></div><div><b>${fmt(p.colors)}</b><small>لون</small></div><div><b>${fmt(p.sizes)}</b><small>مقاس</small></div></div>
  <p class="off" style="margin:8px 0;font-size:13px">الأعمدة التي وُجدت: ${p.cols.join("، ")}${c?` · مقارنة بالكتالوج الحالي: <b>${fmt(add.length)}</b> كود جديد و<b>${fmt(rem.length)}</b> كود لم يعد موجوداً`:""}</p>
  ${W.length?`<div class="cat-w">${W.map(x=>`<div>⚠️ ${x}</div>`).join("")}</div>`:`<div class="cat-w ok">✅ لا توجد مشاكل في الملف</div>`}
  <div class="tw" style="margin-top:10px"><table><thead><tr><th>الكود</th><th>اللون</th><th>المقاس</th><th>UPC</th><th>الاسم</th></tr></thead><tbody>${p.rows.slice(0,6).map(a=>`<tr><td dir="ltr" data-notr>${E(a[0])}</td><td data-notr>${E(a[1])}</td><td dir="ltr" data-notr>${E(a[2])}</td><td dir="ltr" data-notr>${E(a[3])}</td><td data-notr>${E(p.nm[a[0]]||"")}</td></tr>`).join("")}</tbody></table></div>
  <div class="fl" style="margin-top:12px"><button class="bt g" data-cat="pub" type="button" ${BUSY?"disabled":""}>${BUSY?"⏳ جاري النشر...":"✅ اعتماد ونشر الكتالوج"}</button><button class="bt" data-cat="cancel" type="button" ${BUSY?"disabled":""}>إلغاء</button></div></div>`}
 return `<div class="pan cat"><h3 style="margin:0 0 6px">📦 كتالوج الأصناف</h3>
 <p class="off" style="margin:0 0 12px;font-size:13.5px">الأصناف من سيستم الشركة (الكود واللون والمقاس وUPC). بعد النشر تقترح ورقة نواقص الفروع ألوان الكود المكتوب فقط، ثم مقاساته فقط، ويُملأ الصنف تلقائياً من الباركود.</p>
 ${cur}
 <div class="cat-up"><label class="bt p" for="cat-f">📤 رفع ملف الأصناف (Excel أو CSV)</label><input id="cat-f" type="file" accept=".xlsx,.csv,.txt" hidden>
 <small class="off">أول صف عناوين: الكود، اللون، المقاس، UPC، الاسم (أو كما يخرج من السيستم: DESCRIPTION2, ATTRIBUTE, ITEM_SIZE, UPC, Description1).</small></div>
 ${MSG?`<div class="cat-w ok">${E(MSG)}</div>`:""}${pv}</div>
 <style>.cat-st{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.cat-st div{background:var(--soft,#f6eee3);border-radius:12px;padding:10px 12px}.cat-st b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.cat-st small{color:var(--mut);font-size:12.5px}
 .cat-up{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 0}.cat-up label{cursor:pointer}
 .cat-pv{margin-top:14px;border:1.5px dashed var(--line);border-radius:14px;padding:12px}.cat-pv h4{margin:0 0 8px}.cat-pv h4 small{color:var(--mut);font-weight:500;margin-inline-start:6px}
 .cat-w{margin-top:10px;background:color-mix(in srgb,#e8a317 14%,transparent);border-radius:12px;padding:8px 12px;font-size:13.5px;line-height:1.7}.cat-w.ok{background:color-mix(in srgb,#6f7d45 14%,transparent)}.cat-w.bad{background:color-mix(in srgb,#c4362b 14%,transparent)}</style>`;
}
const redraw=()=>{if(X&&X.redraw)X.redraw()};
async function onFile(f){
 if(!f)return;MSG="";PREV=null;
 try{if(f.size>15e6)throw new Error("big");const nm=f.name||"";let rows;
  if(/\.xlsx$/i.test(nm))rows=await readXlsx(await f.arrayBuffer());else rows=readCsv(await f.text());
  const p=build(rows);p.src=nm.slice(0,120);PREV=p.err?{err:p.err}:p;if(!p.err&&!p.rows.length)PREV={err:"الملف لا يحتوي على أصناف"};
  if(!p.err&&p.rows.length>30*PART)PREV={err:"الملف أكبر من الحد (75,000 صنف)"};
 }catch(e){const m=String(e&&e.message);PREV={err:m==="big"?"الملف أكبر من 15 ميجا":m==="nodecomp"?"هذا المتصفح لا يقرأ ملفات Excel مباشرة. احفظ الملف بصيغة CSV UTF-8 من Excel وارفعه، أو استخدم Chrome.":"تعذّرت قراءة الملف. تأكد أنه ملف Excel (.xlsx) أو CSV"}}
 redraw();
}
async function publish(){
 if(!PREV||PREV.err||BUSY||!X)return;
 if(!confirm(`نشر الكتالوج الجديد؟\n${PREV.codes} كود · ${PREV.rows.length} صنف\nسيحل محل الكتالوج الحالي عند كل الفروع.`))return;
 BUSY=true;redraw();
 try{
  const {doc,writeBatch}=await FB();
  const v=Date.now(),R=PREV.rows,parts=Math.max(1,Math.ceil(R.length/PART)),old=CAT?Math.max(0,N(CAT.raw&&CAT.raw.parts)||Math.ceil(CAT.rows/PART)):0;
  const b=writeBatch(X.db);
  for(let i=0;i<parts;i++){const r=R.slice(i*PART,(i+1)*PART),nm={};r.forEach(a=>{if(PREV.nm[a[0]])nm[a[0]]=PREV.nm[a[0]]});b.set(doc(X.db,"cat","p"+i),{v,r,nm})}
  for(let i=parts;i<Math.max(old,parts+3)&&i<30;i++)b.delete(doc(X.db,"cat","p"+i));
  const by={e:String(X.me&&X.me.e||"").slice(0,120),n:String(X.me&&X.me.n||"").slice(0,60)};
  b.set(doc(X.db,"cat","meta"),{v,n:PREV.codes,rows:R.length,parts,at:v,by,src:PREV.src||""});
  await b.commit();
  const raw={v,at:v,src:PREV.src||"",by,parts,r:R,nm:PREV.nm};writeCache(raw);CAT=index(raw);LOADING=Promise.resolve(CAT);
  MSG=`✅ نُشر الكتالوج: ${PREV.codes} كود و${R.length} صنف. سيصل للفروع عند فتح المنصة.`;PREV=null;
 }catch(e){X.toast&&X.toast("تعذّر نشر الكتالوج. ربما القواعد (Rules) لم تتحدّث بعد","er")}
 BUSY=false;redraw();
}
document.addEventListener("change",e=>{if(e.target&&e.target.id==="cat-f"){const f=e.target.files&&e.target.files[0];e.target.value="";onFile(f)}});
document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-cat]");if(!t||!X)return;const a=t.dataset.cat;
 if(a==="pub")publish();else if(a==="cancel"){PREV=null;MSG="";redraw()}});
