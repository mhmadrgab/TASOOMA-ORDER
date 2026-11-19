// 📊 تحليل المخزون (stock.js — v173، 19 نوفمبر 2026، طلب محمد: «أرفع تقرير السيستم والمنصة تطلّع نواقص الفروع وتقترح التحويلات»).
// للأدمن ومالك النظام فقط (القواعد: مجموعة stk قراءة وكتابة is_owner()). لا سيرفر.
// المصدر: ملفان من Power BI بنفس الأعمدة (DESCRIPTION2 الكود، ATTRIBUTE اللون، ITEM_SIZE المقاس، Store Name، Vendor Name، RCVD_QTY، SOLD_QTY):
//   1) ملف الكميات: فيه OH_QTY (الرصيد) بلا تاريخ، والمبيعات فيه من أول السنة حتى يوم التنزيل.
//   2) ملف التاريخ: فيه Date - Year / Month / Day بلا رصيد. ⚠️ Power BI يقطع التصدير عند 150 ألف سطر ويكتب في آخره
//      «Exported data exceeded the allowed volume»: الملف المقطوع يُرفض، ويُنزَّل على فترات أقصر والمنصة تجمعها (كل ملف يستبدل أيام فترته فقط).
// القراءة: xlsx يُفكّ ويُقرأ سطراً سطراً (الورقة 70 ميجا مفكوكة، فلا DOMParser)، أو csv. الربط بين الملفين بالمفتاح (كود، لون، مقاس، فرع).
// التخزين (مضغوط gzip ثم base64): stk/meta، stk/q0..q9 (لقطة الكميات)، stk/d{YYYY-MM}[_n] (مبيعات كل شهر باليوم)، stk/cfg (القواعد).
// القواعد يغيّرها المستخدم من تبويب «القواعد»: حد النواقص (min)، أقل كمية تبقى عند الفرع المسحوب منه (keep)، متى يُعتبر الفرع «لا يبيع» (slow)،
// المخازن المستثناة (ex)، وحدود خاصة لمورد أو كود (ov). الاختبار: supabase\test-stock.mjs على الملفين الحقيقيين.
// دوال القاعدة (doc, getDoc, setDoc, writeBatch) تمرّرها اللوحة في initStock({fb}): الملف نفسه بلا import
const FB=()=>X&&X.fb?Promise.resolve(X.fb):Promise.reject(new Error("nofb"));
const g=id=>document.getElementById(id);
export const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=v=>{const n=+v;return isFinite(n)?n:0};
const SEP="\u0001";
export const DEF={min:2,keep:2,slow:0,days:60,stale:5,ex:["000-SERVER"],wh:"001-WEARHOUSE",ov:[]};
let X=null,ROOT=null,DATA=null,CFG=Object.assign({},DEF),META=null,LOADED=false,LOADING=false,BUSY="",REP=[],SOLDC={},SENT=[],un=[];
const SENT_DAYS=14;// طلب التحويل المُنشأ يبقى معلَّماً على اقتراحه 14 يوماً (حتى يظهر أثره في تقرير السيستم)
let UI={tab:"need",st:"",vn:"",q:"",sold:1,min:"",per:"ytd",from:"",to:"",fr:"",tt:"",code:"",cl:"",sz:"",show:"b",son:"",lim:200};

/* ============ 1) قراءة الملفات ============ */
const dec=s=>s.indexOf("&")<0?s:s.replace(/&(#x?[0-9a-fA-F]+|lt|gt|quot|apos|amp);/g,(m,k)=>k==="lt"?"<":k==="gt"?">":k==="quot"?'"':k==="apos"?"'":k==="amp"?"&":k.charAt(1)==="x"||k.charAt(1)==="X"?String.fromCodePoint(parseInt(k.slice(2),16)||32):String.fromCodePoint(parseInt(k.slice(1),10)||32));
function zipDir(buf){
 const u8=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
 for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
 if(e<0)throw new Error("notzip");
 const cnt=dv.getUint16(e+10,true),td=new TextDecoder();let off=dv.getUint32(e+16,true);const F=[];
 for(let k=0;k<cnt;k++){if(off+46>u8.length||dv.getUint32(off,true)!==0x02014b50)break;
  const meth=dv.getUint16(off+10,true),csz=dv.getUint32(off+20,true),usz=dv.getUint32(off+24,true),nl=dv.getUint16(off+28,true),xl=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lho=dv.getUint32(off+42,true);
  F.push({name:td.decode(u8.subarray(off+46,off+46+nl)),meth,csz,usz,lho});off+=46+nl+xl+cl}
 const open=f=>{const st=f.lho+30+dv.getUint16(f.lho+26,true)+dv.getUint16(f.lho+28,true);let s=new Blob([u8.subarray(st,st+f.csz)]).stream();
  if(f.meth===8){if(typeof DecompressionStream==="undefined")throw new Error("nodecomp");s=s.pipeThrough(new DecompressionStream("deflate-raw"))}else if(f.meth!==0)throw new Error("zipmeth");return s};
 return {F,open};
}
const colIx=a=>{let n=0;for(let i=0;i<a.length;i++)n=n*26+(a.charCodeAt(i)-64);return n-1};
const RROW=/<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g,RCELL=/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,RT=/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g,RV=/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/;
// نص ورقة xlsx على دفعات ← صفوف (كل صف مصفوفة خلايا نصية). يتحمّل الخلايا بلا عنوان (تصدير Power BI) وبعنوان (ملف محفوظ من إكسل)
export function rowFeeder(onRow,shared){
 let buf="";
 const cells=x=>{const out=[];let i=0,m;RCELL.lastIndex=0;
  while((m=RCELL.exec(x))){const a=m[1],b=m[2]||"",r=/\br="([A-Z]+)\d+"/.exec(a);if(r)i=colIx(r[1]);let v="";
   if(b){if(/\bt="s"/.test(a)){const q=RV.exec(b);v=q&&shared?shared[+q[1]]||"":""}
    else if(b.indexOf("<")>=0&&/<(?:\w+:)?is>/.test(b)){let t;RT.lastIndex=0;while((t=RT.exec(b)))v+=dec(t[1])}
    else{const q=RV.exec(b);v=q?dec(q[1]):""}}
   while(out.length<i)out.push("");out[i]=v;i++}
  return out};
 return {push(txt){buf+=txt;let m,last=0;RROW.lastIndex=0;while((m=RROW.exec(buf))){last=RROW.lastIndex;onRow(m[1]?cells(m[1]):[])}if(last)buf=buf.slice(last)},rest:()=>buf.length};
}
async function streamText(stream,onText,onTick){
 const rd=stream.getReader(),td=new TextDecoder("utf-8");let n=0,k=0;
 for(;;){const x=await rd.read();if(x.done)break;n+=x.value.length;onText(td.decode(x.value,{stream:true}));if(++k%24===0&&onTick){onTick(n);await new Promise(r=>setTimeout(r,0))}}
 const t=td.decode();if(t)onText(t);
}
function csvRows(txt,onRow){
 const d=(txt.split("\n")[0].split("\t").length>txt.split("\n")[0].split(",").length)?"\t":",";let row=[],cur="",q=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];
  if(q){if(ch==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
  else if(ch==='"')q=true;else if(ch===d){row.push(cur);cur=""}else if(ch==="\n"){row.push(cur);onRow(row);row=[];cur=""}else if(ch!=="\r")cur+=ch}
 if(cur||row.length){row.push(cur);onRow(row)}
}
const HMAP={code:["description2","الكود","كود","code","item code"],color:["attribute","اللون","لون","color"],size:["item_size","المقاس","مقاس","size"],store:["store name","store_name","الفرع","المخزن","store"],vendor:["vendor name","vendor_name","المورد","vendor"],
 rc:["rcvd_qty","received_qty","المستلم","received"],sold:["sold_qty","المبيعات","مبيعات","sold"],on:["oh_qty","onhand qty","on hand qty","oh qty","onhand","الكمية","الرصيد"],
 yr:["date - year","year","السنة"],mo:["date - month","month","الشهر"],dy:["date - day","day","اليوم"],dt:["date","التاريخ"]};
const MON={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,
 "يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"ابريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"اغسطس":8,"سبتمبر":9,"أكتوبر":10,"اكتوبر":10,"نوفمبر":11,"ديسمبر":12};
const p2=n=>(n<10?"0":"")+n;
const moNum=v=>{const s=String(v).trim().toLowerCase();return MON[s]||(/^\d{1,2}$/.test(s)&&+s>=1&&+s<=12?+s:0)};
// تاريخ في خانة واحدة: 2026-11-17، 17/11/2026، أو رقم إكسل
const dateOf=v=>{const s=String(v).trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);if(m)return [+m[1],+m[2],+m[3]];m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s);if(m)return [+m[3],+m[2],+m[1]];
 if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(+s)*864e5);return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}return null};
// يجمع صفوف ملف واحد: يتعرّف على الرأس والنوع (كميات q / تاريخ d)، يجمع المكرر، ويلتقط ذيل Power BI (Total، الفترة، تحذير القطع)
export function ingest(){
 let H=null,type="",n=0;const st=[],sti=new Map(),vn=[],vni=new Map(),k=[],ki=new Map(),q=new Map(),mon={},days=new Set();
 const sum={sold:0,on:0,rc:0},tot={},R={trunc:false,from:"",to:"",bad:0};
 const ix=(arr,map,v)=>{let i=map.get(v);if(i===undefined){i=arr.length;arr.push(v);map.set(v,i)}return i};
 const head=row=>{const h={},low=row.map(c=>String(c).trim().toLowerCase());for(const f in HMAP){const i=low.findIndex(c=>HMAP[f].indexOf(c)>=0);if(i>=0)h[f]=i}
  return h.code!==undefined&&h.store!==undefined&&h.sold!==undefined?h:null};
 function row(r){
  if(!r.length)return;
  if(!H){H=head(r);if(H)type=H.on!==undefined&&H.mo===undefined&&H.dt===undefined?"q":(H.mo!==undefined&&H.dy!==undefined)||H.dt!==undefined?"d":"";return}
  const c0=String(r[0]||"");
  if(r.length<=2&&c0.length>12){// ذيل Power BI
   if(/exceeded the allowed volume/i.test(c0))R.trunc=true;
   const m=/on or after (\d{1,2})-([A-Za-z]{3})-(\d{2,4}) and is before (\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(c0);
   if(m){const y=s=>s.length===2?2000+(+s):+s;R.from=y(m[3])+"-"+p2(MON[m[2].toLowerCase()]||1)+"-"+p2(+m[1]);R.to=y(m[6])+"-"+p2(MON[m[5].toLowerCase()]||1)+"-"+p2(+m[4])}
   return}
  const code=String(r[H.code]||"").trim(),store=String(r[H.store]||"").trim();
  if(!store){if(/^total$/i.test(code)){tot.sold=N(r[H.sold]);if(H.on!==undefined)tot.on=N(r[H.on]);if(H.rc!==undefined)tot.rc=N(r[H.rc])}return}
  if(!code){R.bad++;return}
  const sold=N(r[H.sold]),rc=H.rc!==undefined?N(r[H.rc]):0,cl=H.color!==undefined?String(r[H.color]||"").trim():"",z=H.size!==undefined?String(r[H.size]||"").trim():"";
  const key=code+SEP+cl+SEP+z;let kk=ki.get(key);
  if(kk===undefined){kk=k.length;k.push([code,cl,z,H.vendor!==undefined?ix(vn,vni,String(r[H.vendor]||"").trim()):-1]);ki.set(key,kk)}
  const ti=ix(st,sti,store);n++;sum.sold+=sold;sum.rc+=rc;
  if(type==="q"){const on=N(r[H.on]);sum.on+=on;let a=q.get(kk);if(!a){a=[];q.set(kk,a)}let j=0;for(;j<a.length;j+=4)if(a[j]===ti)break;if(j<a.length){a[j+1]+=on;a[j+2]+=sold;a[j+3]+=rc}else a.push(ti,on,sold,rc)}
  else if(type==="d"){let y,mo,dy;if(H.dt!==undefined&&H.mo===undefined){const d=dateOf(r[H.dt]);if(!d){R.bad++;return}y=d[0];mo=d[1];dy=d[2]}else{y=H.yr!==undefined?N(r[H.yr]):new Date().getFullYear();mo=moNum(r[H.mo]);dy=N(r[H.dy])}
   if(!mo||dy<1||dy>31||y<2000){R.bad++;return}const ym=y+"-"+p2(mo);(mon[ym]||(mon[ym]=[])).push(kk,ti,dy,sold,rc);days.add(ym+"-"+p2(dy))}
 }
 return {row,done:()=>Object.assign(R,{ok:!!H&&!!type,type,n,st,vn,k,q,mon,days:[...days].sort(),sum,tot})};
}
// ملف (File أو {name, arrayBuffer()}) ← ناتج ingest
export async function readFile(file,onProg){
 const name=String(file.name||"");const buf=await file.arrayBuffer();
 if(/\.csv$|\.txt$/i.test(name)){const I=ingest();let t=new TextDecoder("utf-8").decode(buf);if(t.charCodeAt(0)===0xFEFF)t=t.slice(1);csvRows(t,I.row);return I.done()}
 const Z=zipDir(buf);let shared=null;const sf=Z.F.find(f=>f.name==="xl/sharedStrings.xml");
 if(sf){let t="";await streamText(Z.open(sf),x=>{t+=x});shared=[];const re=/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;let m;while((m=re.exec(t))){let v="",q;RT.lastIndex=0;while((q=RT.exec(m[1])))v+=dec(q[1]);shared.push(v)}}
 // أكبر الأوراق أولاً (ورقة البيانات)، وأول ورقة رأسها صحيح تُعتمد
 const sheets=Z.F.filter(f=>/^xl\/worksheets\/[^\/]+\.xml$/.test(f.name)).sort((a,b)=>b.usz-a.usz).slice(0,4);
 for(const f of sheets){const I=ingest(),fd=rowFeeder(I.row,shared);await streamText(Z.open(f),x=>fd.push(x),n=>{if(onProg)onProg(f.usz?Math.min(1,n/f.usz):0)});const R=I.done();if(R.ok)return R}
 return {ok:false};
}

/* ============ 2) الضغط والتخزين ============ */
const b64=u8=>{let s="";for(let i=0;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return btoa(s)};
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
export async function gz(str){const s=new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));return b64(new Uint8Array(await new Response(s).arrayBuffer()))}
export async function gun(z){const s=new Blob([unb64(z)]).stream().pipeThrough(new DecompressionStream("gzip"));return await new Response(s).text()}
const PART=880000;// حروف base64 للجزء (حد المستند 1.2 ميجا)
const parts=z=>{const a=[];for(let i=0;i<z.length;i+=PART)a.push(z.slice(i,i+PART));return a.length?a:[""]};
// لقطة الكميات ← نص مضغوط
export const packQ=R=>JSON.stringify({st:R.st,vn:R.vn,k:R.k,r:[...R.q].map(e=>[e[0]].concat(e[1]))});
// شهر من ملف تاريخ ← مستند مستقل بقاموسه (فلا يتأثر بتغيّر ترتيب الأصناف في رفع لاحق)
export function packMonth(k,st,flat){const km=new Map(),K=[],r=[];for(let i=0;i<flat.length;i+=5){let j=km.get(flat[i]);if(j===undefined){j=K.length;K.push(k[flat[i]].slice(0,3));km.set(flat[i],j)}r.push(j,flat[i+1],flat[i+2],flat[i+3],flat[i+4])}return {st,k:K,r}}

/* ============ 3) البيانات في الذاكرة ============ */
export function newData(){return {st:[],sti:new Map(),vn:[],vni:new Map(),k:[],ki:new Map(),q:[],code:new Map(),d:{},has:false}}
const dIx=(D,arr,map,v)=>{let i=map.get(v);if(i===undefined){i=arr.length;arr.push(v);map.set(v,i)}return i};
const dKey=(D,c,cl,z,vi)=>{const key=c+SEP+cl+SEP+z;let i=D.ki.get(key);if(i===undefined){i=D.k.length;D.k.push([c,cl,z,vi==null?-1:vi]);D.ki.set(key,i);let a=D.code.get(c);if(!a){a=[];D.code.set(c,a)}a.push(i)}else if(vi!=null&&vi>=0&&D.k[i][3]<0)D.k[i][3]=vi;return i};
export function loadQ(D,P){// P = {st,vn,k,r}
 D.q=[];D.has=true;const sm=P.st.map(s=>dIx(D,D.st,D.sti,s)),vm=P.vn.map(v=>dIx(D,D.vn,D.vni,v));
 const km=P.k.map(x=>dKey(D,x[0],x[1],x[2],x[3]>=0?vm[x[3]]:-1));
 for(const row of P.r){const a=[];for(let j=1;j<row.length;j+=4)a.push(sm[row[j]],row[j+1],row[j+2],row[j+3]);D.q[km[row[0]]]=a}
}
export function loadMonth(D,ym,P,keep){// يضيف صفوف الشهر (keep = الصفوف القديمة الباقية بعد حذف أيام الفترة)
 const sm=P.st.map(s=>dIx(D,D.st,D.sti,s)),km=P.k.map(x=>dKey(D,x[0],x[1],x[2],null)),r=keep?keep.slice():[];
 for(let i=0;i<P.r.length;i+=5)r.push(km[P.r[i]],sm[P.r[i+1]],P.r[i+2],P.r[i+3],P.r[i+4]);D.d[ym]=r;
}
// مستند شهر من الذاكرة (لحفظه بعد الدمج)
export function monthDoc(D,ym){return packMonth(D.k,D.st,D.d[ym]||[])}

/* ============ 4) المحرك ============ */
const ORD=["XXS","XS","S","M","L","XL","XXL","2XL","3XL","4XL","5XL"];
const zk=z=>{const n=parseFloat(z);return isNaN(n)?(ORD.indexOf(String(z).toUpperCase())+1||99)+1000:n};
export const cmpK=(a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:zk(a[2])-zk(b[2]);
const ymd=(ym,d)=>ym+"-"+p2(d);
// مبيعات فترة من ملفات التاريخ: خريطة (صنف*1000+فرع) ← كمية. الفترة {from,to} بالأيام شاملة الطرفين
export function soldMap(D,from,to){
 const key=from+"|"+to;if(SOLDC.k===key&&SOLDC.D===D)return SOLDC.m;const m=new Map();
 for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;const kk=r[i]*1000+r[i+1];m.set(kk,(m.get(kk)||0)+r[i+3])}}
 SOLDC={k:key,D,m};return m;
}
const minOf=(C,D,ki)=>{const x=D.k[ki];for(const o of C.ov||[]){if(o.t==="c"&&o.k===x[0])return N(o.min)}for(const o of C.ov||[]){if(o.t==="v"&&x[3]>=0&&o.k===D.vn[x[3]])return N(o.min)}return N(C.min)};
const exSet=(C,D)=>{const s=new Set();(C.ex||[]).forEach(n=>{const i=D.sti.get(n);if(i!==undefined)s.add(i)});return s};
const soldOf=(P,ki,ti,snap)=>P?(P.get(ki*1000+ti)||0):snap;
// نواقص الفروع: رصيد الفرع أقل من الحد والمستودع عنده. المقترح = ما يكمل الحد، ويُوزَّع رصيد المستودع على الأعلى مبيعاً أولاً
export function shortages(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase();
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];if(fv!==-2&&x[3]!==fv)continue;if(q&&x[0].toLowerCase().indexOf(q)<0)continue;
  let w=0;for(let j=0;j<a.length;j+=4)if(a[j]===wh)w+=a[j+1];if(w<=0)continue;
  const mn=o.min!=null&&o.min!==""?N(o.min):minOf(C,D,ki),L=[];
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti))continue;const on=a[j+1];if(on>=mn)continue;const sold=soldOf(P,ki,ti,a[j+2]);if(o.sold&&sold<=0)continue;L.push({ki,ti,on,sold,wh:w,need:mn-Math.max(0,on),give:0})}
  if(!L.length)continue;L.sort((p,r)=>r.sold-p.sold);let left=w;for(const l of L){l.give=Math.max(0,Math.min(l.need,left));left-=l.give}
  for(const l of L)if(fs===undefined||l.ti===fs)out.push(l)}
 return out;
}
// غير متاح بالمستودع ومتاح في فروع ← اقتراح تحويل: من فرع «لا يبيع» (مبيعاته ≤ slow) وعنده أكثر من keep، إلى فرع رصيده أقل من الحد ويبيع (الأعلى مبيعاً أولاً).
// لا يُسحب من فرع كل كميته أبداً: يبقى عنده keep على الأقل.
export function transfers(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase(),keep=Math.max(0,N(C.keep)),slow=N(C.slow);
 let skus=0,unmet=0;
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];if(fv!==-2&&x[3]!==fv)continue;if(q&&x[0].toLowerCase().indexOf(q)<0)continue;
  let w=0,any=false;for(let j=0;j<a.length;j+=4){if(a[j]===wh)w+=a[j+1];else if(a[j+1]>0&&!ex.has(a[j]))any=true}if(w>0||!any)continue;skus++;
  const mn=minOf(C,D,ki),give=[],take=[];
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti))continue;const on=a[j+1],sold=soldOf(P,ki,ti,a[j+2]);
   if(on>keep&&sold<=slow)give.push({ti,on,sold,free:on-keep});else if(on<mn&&sold>0)take.push({ti,on,sold,want:mn-Math.max(0,on)})}
  if(!take.length)continue;give.sort((p,r)=>p.sold-r.sold||r.free-p.free);take.sort((p,r)=>r.sold-p.sold);
  for(const t of take){for(const d of give){if(t.want<=0)break;if(d.free<=0)continue;const n=Math.min(d.free,t.want);d.free-=n;t.want-=n;out.push({ki,src:d.ti,fon:d.on,fsold:d.sold,dst:t.ti,ton:t.on,tsold:t.sold,n})}if(t.want>0)unmet++}}
 const fr=o.from?D.sti.get(o.from):undefined,tt=o.to?D.sti.get(o.to):undefined;
 return {rows:out.filter(l=>(fr===undefined||l.src===fr)&&(tt===undefined||l.dst===tt)),skus,unmet};
}
// راكد: رصيد الفرع ≥ الحد ولم يبع في الفترة
export function stale(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,mn=Math.max(1,N(o.min==null||o.min===""?C.stale:o.min));
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;if(fv!==-2&&D.k[ki][3]!==fv)continue;
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti)||(fs!==undefined&&ti!==fs))continue;if(a[j+1]<mn)continue;const sold=soldOf(P,ki,ti,a[j+2]);if(sold>0)continue;out.push({ki,ti,on:a[j+1],sold})}}
 return out.sort((p,r)=>r.on-p.on);
}
// تحليل صنف: كل ألوان ومقاسات الكود × كل المخازن (رصيد ومبيعات)
export function matrix(D,C,code,period){
 const ids=(D.code.get(String(code).trim())||[]).slice().sort((p,r)=>cmpK(D.k[p],D.k[r]));if(!ids.length)return null;
 const P=period?soldMap(D,period.from,period.to):null,use=new Set(),rows=[];
 for(const ki of ids){const a=D.q[ki]||[],m={};for(let j=0;j<a.length;j+=4){m[a[j]]=[a[j+1],soldOf(P,ki,a[j],a[j+2])];use.add(a[j])}
  if(P)for(let ti=0;ti<D.st.length;ti++){const s=P.get(ki*1000+ti);if(s&&!m[ti]){m[ti]=[0,s];use.add(ti)}}rows.push({ki,m})}
 const wh=D.sti.get(C.wh),st=[...use].sort((p,r)=>p===wh?-1:r===wh?1:D.st[p]<D.st[r]?-1:1);
 return {rows,st,wh};
}
// مبيعات كود (ولون ومقاس وفرع اختيارياً) من يوم إلى يوم، من ملفات التاريخ
export function salesQuery(D,o){
 const ids=new Set((D.code.get(String(o.code||"").trim())||[]).filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z))),fs=o.store?D.sti.get(o.store):undefined,byDay={},bySt={},byK={};let total=0,ret=0;
 if(!ids.size)return null;
 for(const ym in D.d){if(ym+"-31"<o.from||ym+"-01">o.to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){if(!ids.has(r[i]))continue;if(fs!==undefined&&r[i+1]!==fs)continue;const d=ymd(ym,r[i+2]);if(d<o.from||d>o.to)continue;const n=r[i+3];
   total+=n;if(n<0)ret-=n;byDay[d]=(byDay[d]||0)+n;bySt[r[i+1]]=(bySt[r[i+1]]||0)+n;byK[r[i]]=(byK[r[i]]||0)+n}}
 return {total,ret,byDay,bySt,byK};
}
export const months=(from,to)=>{const a=[];let y=+from.slice(0,4),m=+from.slice(5,7);const ey=+to.slice(0,4),em=+to.slice(5,7);while(y<ey||(y===ey&&m<=em)){a.push(y+"-"+p2(m));if(++m>12){m=1;y++}if(a.length>60)break}return a};

/* ============ 5) القراءة والحفظ من القاعدة ============ */
const today=()=>{const d=new Date();return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())};
const addDays=(s,n)=>{const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())};
const pid=(id,i)=>id==="q"?"q"+i:i?id+"_"+i:id;// q0..q9 للّقطة، و d2026-06 ثم d2026-06_1.. للشهر
async function getParts(fb,id,n){const a=[];for(let i=0;i<n;i++){const s=await fb.getDoc(fb.doc(X.db,"stk",pid(id,i)));if(!s.exists())return null;a.push(String(s.data().z||""))}return a.join("")}
async function load(){
 if(LOADED||LOADING||!X)return;LOADING=true;paint();
 try{const fb=await FB();const m=await fb.getDoc(fb.doc(X.db,"stk","meta"));META=m.exists()?m.data():null;
  try{const c=await fb.getDoc(fb.doc(X.db,"stk","cfg"));if(c.exists())CFG=Object.assign({},DEF,c.data())}catch(e){}
  try{const c=await fb.getDoc(fb.doc(X.db,"stk","sent"));SENT=c.exists()&&Array.isArray(c.data().l)?c.data().l:[]}catch(e){SENT=[]}
  DATA=newData();SOLDC={};
  if(META&&META.q&&N(META.q.parts)>0){const z=await getParts(fb,"q",N(META.q.parts));if(z)loadQ(DATA,JSON.parse(await gun(z)))}
  }catch(e){if(!DATA)DATA=newData();REP=[{kind:"r",t:"تعذّر تحميل بيانات المخزون. تأكد من الإنترنت ومن لصق القواعد الجديدة، ثم أعد فتح القسم."}];UI.tab="up"}
 LOADED=true;
 LOADING=false;if(!DATA||!DATA.has)UI.tab="up";paint();
}
// تحميل شهور ملفات التاريخ عند الحاجة فقط
async function needMonths(from,to){
 if(!META||!META.d||!DATA)return;const want=months(from,to).filter(ym=>META.d[ym]&&!DATA.d[ym]);if(!want.length)return;
 BUSY="جاري تحميل مبيعات الفترة…";paint();
 try{const fb=await FB();for(const ym of want){const z=await getParts(fb,"d"+ym,Math.max(1,N(META.d[ym].parts)));if(z)loadMonth(DATA,ym,JSON.parse(await gun(z)));else DATA.d[ym]=[]}SOLDC={}}catch(e){want.forEach(ym=>{if(!DATA.d[ym])DATA.d[ym]=[]});if(X.toast)X.toast("تعذّر تحميل مبيعات الفترة")}
 BUSY="";paint();
}
const by=()=>({e:String(X.me&&X.me.e||"").slice(0,120),n:String(X.me&&X.me.n||"").slice(0,60)});
async function saveQ(R,src){
 const fb=await FB(),z=await gz(packQ(R)),P=parts(z);if(P.length>10)throw new Error("big");
 const old=META&&META.q?N(META.q.parts):0,b=fb.writeBatch(X.db);P.forEach((p,i)=>b.set(fb.doc(X.db,"stk","q"+i),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<old;i++)b.delete(fb.doc(X.db,"stk","q"+i));
 const meta=Object.assign({v:1},META||{},{at:Date.now(),by:by(),q:{at:Date.now(),parts:P.length,rows:R.n,skus:R.k.length,sold:R.sum.sold,on:R.sum.on,from:R.from||"",to:R.to||"",src:String(src||"").slice(0,120)}});if(!meta.d)meta.d={};
 b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=meta;
 DATA=newData();loadQ(DATA,{st:R.st,vn:R.vn,k:R.k,r:[...R.q].map(e=>[e[0]].concat(e[1]))});SOLDC={};// شهور التاريخ تُحمَّل من جديد عند الطلب (على القاموس الجديد)
}
// ملف تاريخ: يستبدل أيام فترته فقط في كل شهر يمسّه (الفترة من ذيل الملف، وإلا الأيام الموجودة فيه)
async function saveD(R){
 const fb=await FB(),touched=Object.keys(R.mon).sort();if(!touched.length)return 0;
 const from=R.from||R.days[0],to=R.to?addDays(R.to,-1):R.days[R.days.length-1],inR=R.from?(d=>d>=from&&d<=to):(set=>d=>set.has(d))(new Set(R.days));
 const all=R.from?months(from,to):touched,meta=Object.assign({v:1,d:{}},META||{});meta.d=Object.assign({},meta.d);if(!DATA)DATA=newData();
 const sg=new Set(R.st.map(x=>dIx(DATA,DATA.st,DATA.sti,x)));// مخازن هذا الملف
 for(const ym of all){
  // القديم الباقي من الشهر (أيام خارج فترة الملف)
  if(META&&META.d&&META.d[ym]&&!DATA.d[ym]){const z=await getParts(fb,"d"+ym,Math.max(1,N(META.d[ym].parts)));if(z)loadMonth(DATA,ym,JSON.parse(await gun(z)))}
  const old=DATA.d[ym]||[],keep=[];for(let i=0;i<old.length;i+=5)if(!inR(ymd(ym,old[i+2]))||!sg.has(old[i+1]))keep.push(old[i],old[i+1],old[i+2],old[i+3],old[i+4]);
  loadMonth(DATA,ym,{st:R.st,k:R.k,r:R.mon[ym]||[]},keep);
  const r=DATA.d[ym];let sold=0,dmin=32,dmax=0;for(let i=0;i<r.length;i+=5){sold+=r[i+3];if(r[i+2]<dmin)dmin=r[i+2];if(r[i+2]>dmax)dmax=r[i+2]}
  const b=fb.writeBatch(X.db),oldP=META&&META.d&&META.d[ym]?Math.max(1,N(META.d[ym].parts)):0;
  if(!r.length){for(let i=0;i<oldP;i++)b.delete(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym));delete meta.d[ym];delete DATA.d[ym]}
  else{const P=parts(await gz(JSON.stringify(monthDoc(DATA,ym))));if(P.length>10)throw new Error("big");P.forEach((p,i)=>b.set(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<oldP;i++)b.delete(fb.doc(X.db,"stk","d"+ym+"_"+i));
   meta.d[ym]={n:r.length/5,parts:P.length,sold,dmin,dmax,at:Date.now()}}
  meta.at=Date.now();meta.by=by();b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=Object.assign({},meta)}
 SOLDC={};return all.length;
}
async function onFiles(files){
 if(BUSY||!files||!files.length)return;REP=[];
 if(typeof CompressionStream==="undefined"||typeof DecompressionStream==="undefined"){REP=[{kind:"r",t:"هذا المتصفح قديم ولا يستطيع قراءة ملفات الإكسل هنا. استخدم Chrome أو Edge حديثاً."}];paint();return}
 for(const f of [...files]){const nm=String(f.name||"ملف");
  try{BUSY="جاري قراءة "+nm+"…";paint();let last=0;const R=await readFile(f,p=>{const pc=Math.round(p*100);if(pc-last>=4){last=pc;const e=g("stk-pg");if(e)e.textContent=pc+"%"}});
   if(!R.ok){REP.push({kind:"r",f:nm,t:"لم نتعرّف على أعمدة هذا الملف. المطلوب: DESCRIPTION2 و Store Name و SOLD_QTY، ومعها OH_QTY (ملف الكميات) أو أعمدة التاريخ (ملف التاريخ)."});continue}
   const chk=R.tot.sold!==undefined?(R.tot.sold===R.sum.sold?" · المجموع مطابق لسطر الإجمالي":" · مجموع المبيعات في الصفوف "+R.sum.sold+" وسطر الإجمالي "+R.tot.sold):"";
   if(R.type==="q"){if(R.trunc){REP.push({kind:"r",f:nm,t:"ملف الكميات مقطوع من Power BI (أكثر من 150 ألف سطر)، فلم يُحفظ. نزّله بلا أعمدة زائدة أو على مجموعتين من الفروع."});continue}
    BUSY="جاري حفظ الكميات…";paint();await saveQ(R,nm);REP.push({kind:"g",f:nm,t:"ملف الكميات: "+R.n+" سطر · "+R.k.length+" صنف · "+R.st.length+" مخزن · الرصيد "+R.sum.on+" · المبيعات "+R.sum.sold+chk})}
   else{if(R.trunc){const cov=R.tot.sold?Math.round(R.sum.sold/R.tot.sold*100):0;
     REP.push({kind:"r",f:nm,t:"ملف التاريخ مقطوع من Power BI عند 150 ألف سطر"+(cov?" (يحتوي على "+cov+"% فقط من مبيعات الفترة)":"")+"، فلم يُحفظ. نزّله على فترات أقصر (شهر أو شهرين في كل ملف) وارفع الملفات كلها: المنصة تجمعها، وكل ملف يستبدل أيام فترته فقط."});continue}
    BUSY="جاري حفظ مبيعات الأيام…";paint();const n=await saveD(R);REP.push({kind:"g",f:nm,t:"ملف التاريخ: "+R.n+" سطر · "+R.days.length+" يوماً"+(R.from?" · الفترة من "+R.from+" إلى "+addDays(R.to,-1):"")+" · "+n+" شهر محدَّث · المبيعات "+R.sum.sold+chk})}
   if(R.bad)REP.push({kind:"w",f:nm,t:R.bad+" سطر تُرك لنقص الكود أو التاريخ."})}
  catch(e){const c=e&&(e.code||e.message)||"";REP.push({kind:"r",f:nm,t:c==="notzip"?"الملف ليس xlsx ولا csv صالحاً.":c==="permission-denied"?"غير مسموح بالحفظ. تأكد من لصق القواعد الجديدة في Supabase.":c==="big"?"الملف أكبر من المسموح بتخزينه.":"تعذّرت قراءة الملف أو حفظه ("+String(c).slice(0,60)+")."})}}
 BUSY="";if(DATA&&DATA.has&&!REP.some(r=>r.kind==="r"))UI.tab="up";paint();
}
async function saveCfg(){try{const fb=await FB();const c={min:N(CFG.min),keep:N(CFG.keep),slow:N(CFG.slow),days:N(CFG.days),stale:N(CFG.stale),ex:(CFG.ex||[]).slice(0,40),wh:String(CFG.wh||DEF.wh),ov:(CFG.ov||[]).slice(0,60),at:Date.now(),by:by().e};
  await fb.setDoc(fb.doc(X.db,"stk","cfg"),c);if(X.toast)X.toast("تم حفظ القواعد ✅")}catch(e){if(X.toast)X.toast("تعذّر حفظ القواعد")}}

/* ============ 6) الواجهة ============ */
const CSS=`#stk{display:block}.stk-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px}.stk-hd h2{margin:0;font-size:21px}.stk-hd small{display:block;color:var(--mut);font-size:13px;line-height:1.7}
.stk-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 14px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:14px}.stk-tabs::-webkit-scrollbar{display:none}
.stk-tabs button{flex:none;min-height:40px;border:0;background:none;color:var(--mut);border-radius:10px;padding:0 14px;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;white-space:nowrap}.stk-tabs button:hover{background:var(--soft);color:var(--ink)}.stk-tabs button.on{background:var(--acc);color:#fff;font-weight:700}
.stk-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;margin:0 0 12px}
.stk-bar label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--mut);margin:0;min-width:0}.stk-bar select,.stk-bar input{height:42px;min-width:0;margin:0}.stk-bar input[type=number]{width:86px}.stk-bar input[type=search],.stk-bar input[type=text]{width:150px}
.stk-bar .ck{flex-direction:row;align-items:center;gap:7px;height:42px;font-size:14px;color:var(--ink);cursor:pointer}.stk-bar .ck input{width:18px;height:18px}
.stk-bar .sp{flex:1}.stk-sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.stk-sum span{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:7px 13px;font-size:13.5px;color:var(--mut)}.stk-sum b{color:var(--ink);font-size:16px;font-variant-numeric:tabular-nums;margin-inline-end:5px}
.stk-t{width:100%;border-collapse:collapse;font-size:14.5px}.stk-t th{position:sticky;top:0;background:var(--card);text-align:start;color:var(--mut);font-weight:600;font-size:12.5px;padding:9px 10px;border-bottom:2px solid var(--acc);white-space:nowrap}.stk-t td{padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.stk-t td.n,.stk-t th.n{text-align:center;font-variant-numeric:tabular-nums}.stk-t td.c{font-weight:700;direction:ltr;text-align:start}.stk-t tr:hover td{background:var(--soft)}
.stk-t .z{color:#c4362b;font-weight:700}.stk-t .gv{background:var(--olive-s,#e9ecd9);color:var(--olive-t,#3f4a22);font-weight:800;border-radius:8px}.stk-t .no{color:#b8720f;font-weight:700}
.stk-pan{background:var(--card);border-radius:16px;padding:6px 8px 10px;box-shadow:0 1px 2px rgba(0,0,0,.06)}.stk-pan .tw{overflow:auto;max-width:100%}
.stk-prs{padding:14px 16px;margin:0 0 4px}.stk-prs h3{margin:0 0 4px;font-size:17px}.stk-prs p{margin:0 0 8px;font-size:13px;line-height:1.8}.stk-pr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line)}.stk-pr>span{flex:1;min-width:200px;font-weight:700}.stk-pr>span i{font-style:normal;color:var(--mut);margin:0 6px}.stk-pr>b{font-size:13.5px;color:var(--mut);font-weight:600;font-variant-numeric:tabular-nums}.stk-t tr.snt td{opacity:.6}.stk-t tr.snt td:nth-child(6){opacity:1}
.stk-em{text-align:center;color:var(--mut);padding:44px 14px;line-height:1.9}.stk-more{display:block;margin:12px auto 4px}
.stk-up{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}.stk-card{background:var(--card);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.06)}.stk-card h3{margin:0 0 6px;font-size:17px}.stk-card p{margin:0 0 6px;color:var(--mut);font-size:13.5px;line-height:1.8}
.stk-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;border:2px dashed var(--acc);border-radius:18px;padding:26px 16px;background:var(--soft);margin:0 0 12px;cursor:pointer;transition:background-color .15s}.stk-drop.ov{background:var(--card)}.stk-drop b{font-size:17px}.stk-drop small{color:var(--mut);font-size:13.5px;line-height:1.8}.stk-drop input{display:none}
.stk-rep{border-radius:12px;padding:10px 14px;margin:0 0 8px;font-size:14px;line-height:1.8;border:1px solid var(--line);background:var(--card)}.stk-rep b{direction:ltr;unicode-bidi:isolate}.stk-rep.g{border-color:var(--olive,#6f7d45);background:var(--olive-s,#e9ecd9);color:var(--olive-t,#3f4a22)}.stk-rep.r{border-color:#c4362b;background:#fdecea;color:#8a2218}.stk-rep.w{border-color:#b8720f;background:#fff4e2;color:#6b4300}
.stk-mo{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.stk-mo span{border-radius:999px;padding:3px 11px;font-size:12.5px;font-weight:700;background:var(--olive-s,#e9ecd9);color:var(--olive-t,#3f4a22);font-variant-numeric:tabular-nums}.stk-mo span.x{background:var(--soft);color:var(--mut);font-weight:500}
.stk-mx td.s{position:sticky;inset-inline-start:0;background:var(--card);z-index:1;font-weight:700}.stk-mx th.s{position:sticky;inset-inline-start:0;z-index:2}.stk-mx th{font-size:11.5px;max-width:92px;white-space:normal;line-height:1.35;vertical-align:bottom;text-align:center}.stk-mx td{text-align:center;padding:6px 8px;font-variant-numeric:tabular-nums}
.stk-mx td b{display:block;font-size:15px;line-height:1.25}.stk-mx td i{display:block;font-style:normal;color:var(--mut);font-size:11.5px;line-height:1.3}.stk-mx td.need i,.stk-mx td.idle i{color:inherit;opacity:.8}.stk-mx td.need{background:#fdecea;color:#8a2218;font-weight:800}.stk-mx td.idle{background:#fff4e2;color:#6b4300}.stk-mx td.wh{background:var(--soft);font-weight:800}.stk-mx tr.tot td{border-top:2px solid var(--acc);font-weight:800}.stk-mx td.e{color:var(--line)}
.stk-day{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:3px 0}.stk-day span{width:92px;flex:none;direction:ltr;font-variant-numeric:tabular-nums;color:var(--mut)}.stk-day i{display:block;height:12px;border-radius:6px;background:var(--acc);min-width:2px}.stk-day i.m{background:#c4362b}.stk-day b{font-variant-numeric:tabular-nums}
.stk-cfg{display:grid;gap:12px}.stk-cfg .f{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--line)}.stk-cfg .f:first-of-type{border-top:0}.stk-cfg .f>div{flex:1;min-width:220px}.stk-cfg .f b{display:block}.stk-cfg .f small{color:var(--mut);font-size:13px;line-height:1.7}.stk-cfg input[type=number]{width:96px;height:42px;text-align:center;font-weight:700;font-size:17px}
.stk-chk{display:flex;gap:6px;flex-wrap:wrap}.stk-chk label{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:10px;padding:5px 10px;font-size:13px;cursor:pointer;margin:0;color:var(--ink)}.stk-chk input{width:16px;height:16px}
.stk-busy{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--acc);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-weight:700}.stk-busy::before{content:"";width:16px;height:16px;border:2.5px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:ui-spin .7s linear infinite}
:where([data-theme=dark]) .stk-tabs button.on{color:#141015}:where([data-theme=dark]) .stk-rep.r,:where([data-theme=dark]) .stk-mx td.need{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .stk-rep.w,:where([data-theme=dark]) .stk-mx td.idle{background:#3a2a08;color:#f6c770}:where([data-theme=dark]) .stk-t .z{color:#f1a5a0}:where([data-theme=dark]) .stk-t .no{color:#f6c770}
@media (max-width:760px){.stk-up{grid-template-columns:1fr}.stk-bar label{flex:1 1 calc(50% - 4px)}.stk-bar select,.stk-bar input,.stk-bar input[type=number],.stk-bar input[type=search],.stk-bar input[type=text]{width:100%}.stk-bar .sp{display:none}.stk-bar .bt{flex:1 1 calc(50% - 4px)}}
@media print{.stk-tabs,.stk-bar,.stk-drop,.stk-more{display:none!important}}`;
const TABS=[["need","🧺","نواقص الفروع"],["tr","🔄","تحويلات مقترحة"],["item","🔍","تحليل صنف"],["sales","📅","مبيعات بالتاريخ"],["stale","💤","الراكد"],["up","⬆️","الملفات"],["cfg","⚙","القواعد"]];
const fmt=n=>String(Math.round(N(n))).replace(/\B(?=(\d{3})+(?!\d))/g,",");
const dts=t=>{if(!t)return "";const d=new Date(N(t));return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+" "+p2(d.getHours())+":"+p2(d.getMinutes())};
const opt=(arr,cur,all)=>`<option value="">${all}</option>`+arr.map(v=>`<option data-notr${v===cur?" selected":""}>${E(v)}</option>`).join("");
const stores=noWh=>DATA.st.filter(s=>(!noWh||s!==CFG.wh)).slice().sort();
const vendors=()=>DATA.vn.filter(Boolean).slice().sort();
// الفترة المختارة ← {from,to} أو null (من أول السنة = مبيعات ملف الكميات)
function period(){
 if(UI.per==="ytd")return null;const end=META&&META.q&&META.q.to?addDays(META.q.to,-1):today();
 if(UI.per==="c")return UI.from&&UI.to&&UI.from<=UI.to?{from:UI.from,to:UI.to}:null;
 return {from:addDays(end,-(N(UI.per)-1)),to:end};
}
const dHas=()=>!!(META&&META.d&&Object.keys(META.d).length);
// تغطية ملفات التاريخ للفترة: الشهور الناقصة
const gaps=P=>P?months(P.from,P.to).filter(ym=>!(META&&META.d&&META.d[ym])):[];
const perSel=()=>`<label>مبيعات الفترة<select data-sf="per" id="stk-per"><option value="ytd"${UI.per==="ytd"?" selected":""}>من أول السنة</option>${dHas()?[["30","آخر 30 يوماً"],["60","آخر 60 يوماً"],["90","آخر 90 يوماً"],["c","فترة أحددها"]].map(a=>`<option value="${a[0]}"${UI.per===a[0]?" selected":""}>${a[1]}</option>`).join(""):""}</select></label>${UI.per==="c"?`<label>من<input type="date" data-sf="from" id="stk-from" value="${E(UI.from)}"></label><label>إلى<input type="date" data-sf="to" id="stk-to" value="${E(UI.to)}"></label>`:""}`;
const gapNote=P=>{const gp=gaps(P);return gp.length?`<div class="stk-rep w">ملفات التاريخ لا تغطي: <b data-notr>${E(gp.join(" · "))}</b>. مبيعات هذه الشهور غير محسوبة في الفترة. ارفع ملف التاريخ لها من تبويب «الملفات».</div>`:""};
const sn=ti=>`<bdi dir="ltr" data-notr>${E(DATA.st[ti])}</bdi>`;
const kCells=ki=>{const x=DATA.k[ki];return `<td class="c" data-notr><a href="#" data-sk="code" data-c="${E(x[0])}" style="color:inherit">${E(x[0])}</a></td><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td>`};
const more=n=>n>UI.lim?`<button class="bt stk-more" type="button" data-sk="more">عرض المزيد (${fmt(n-UI.lim)} سطر آخر)</button>`:"";
let LASTX=null;// آخر نتيجة معروضة (للتصدير)
function vNeed(){
 const P=period(),L=shortages(DATA,CFG,{store:UI.st,vendor:UI.vn,q:UI.q,sold:UI.sold,min:UI.min,period:P});
 L.sort((a,b)=>a.ti!==b.ti?(DATA.st[a.ti]<DATA.st[b.ti]?-1:1):cmpK(DATA.k[a.ki],DATA.k[b.ki]));
 const give=L.reduce((s,l)=>s+l.give,0),need=L.reduce((s,l)=>s+l.need,0),nb=new Set(L.map(l=>l.ti)).size;
 LASTX={name:"نواقص-الفروع",head:["الفرع","الكود","اللون","المقاس","المورد","رصيد الفرع","المبيعات","رصيد المستودع","المطلوب","المقترح من المستودع"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],x[3]>=0?DATA.vn[x[3]]:"",l.on,l.sold,l.wh,l.need,l.give]})};
 return `<div class="stk-bar"><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(1),UI.st,"كل الفروع")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" placeholder="مثلاً 13016" dir="ltr"></label><label>الحد (أقل من)<input type="number" min="1" max="999" data-sf="min" id="stk-min" value="${E(UI.min)}" placeholder="${E(CFG.min)}"></label>${perSel()}<label class="ck"><input type="checkbox" data-sf="sold" id="stk-sold"${UI.sold?" checked":""}> ما باعه الفرع فقط</label><span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>سطر ناقص</span><span><b>${fmt(nb)}</b>فرع</span><span><b>${fmt(need)}</b>قطعة مطلوبة</span><span><b>${fmt(give)}</b>يغطيها المستودع</span>${need>give?`<span><b style="color:#c4362b">${fmt(need-give)}</b>لا يكفيها المستودع</span>`:""}</div>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr>${UI.st?"":"<th>الفرع</th>"}<th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">المبيعات</th><th class="n">رصيد المستودع</th><th class="n">المقترح</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr>${UI.st?"":`<td>${sn(l.ti)}</td>`}${kCells(l.ki)}<td class="n${l.on<=0?" z":""}">${l.on}</td><td class="n">${l.sold}</td><td class="n">${l.wh}</td><td class="n">${l.give?`<span class="gv" style="padding:2px 10px">${l.give}</span>`:`<span class="no" title="رصيد المستودع ذهب لفروع مبيعاتها أعلى">لا يكفي</span>`}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا نواقص بهذه الشروط 👌</div></div>`}`;
}
// ما أُنشئ له طلب تحويل حديثاً: مفتاح (كود، لون، مقاس، من، إلى) ← رقم الطلب
const cd=s=>String(s||"").slice(0,3);
const sentMap=()=>{const m=new Map(),lim=Date.now()-SENT_DAYS*864e5;for(const e of SENT)if(e&&N(e.at)>lim)m.set([e.c,e.cl,e.z,e.f,e.t].join(SEP),e);return m};
const sentKey=l=>{const x=DATA.k[l.ki];return [x[0],x[1],x[2],cd(DATA.st[l.src]),cd(DATA.st[l.dst])].join(SEP)};
const isBr=name=>{const b=X&&X.branches?X.branches():null;return !b||b.indexOf(cd(name))>=0};
let TRL=[];// آخر تحويلات معروضة (غير المُنشأ لها طلب)
function vTr(){
 const P=period(),T=transfers(DATA,CFG,{from:UI.fr,to:UI.tt,vendor:UI.vn,q:UI.q,period:P}),SM=sentMap(),L=T.rows;
 L.forEach(l=>{l.sent=SM.get(sentKey(l))||null});
 L.sort((a,b)=>a.src!==b.src?(DATA.st[a.src]<DATA.st[b.src]?-1:1):a.dst!==b.dst?(DATA.st[a.dst]<DATA.st[b.dst]?-1:1):cmpK(DATA.k[a.ki],DATA.k[b.ki]));
 TRL=L.filter(l=>!l.sent);const nSent=L.length-TRL.length;
 // الأزواج (من ← إلى) الأكبر أولاً: لكل زوج طلب تحويل واحد
 const pm=new Map();for(const l of TRL){const k=l.src+"|"+l.dst;let e=pm.get(k);if(!e){e={src:l.src,dst:l.dst,n:0,pcs:0};pm.set(k,e)}e.n++;e.pcs+=l.n}
 const pairs=[...pm.values()].sort((a,b)=>b.pcs-a.pcs),can=!!(X&&X.transfer);
 LASTX={name:"تحويلات-مقترحة",head:["من فرع","إلى فرع","الكود","اللون","المقاس","المورد","الكمية","رصيد المُرسِل","مبيعات المُرسِل","رصيد المستلم","مبيعات المستلم","طلب التحويل"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.src],DATA.st[l.dst],x[0],x[1],x[2],x[3]>=0?DATA.vn[x[3]]:"",l.n,l.fon,l.fsold,l.ton,l.tsold,l.sent?l.sent.no:""]})};
 const mkBtn=p=>{const ok=isBr(DATA.st[p.src])&&isBr(DATA.st[p.dst]);return ok?`<button class="bt g s" type="button" data-sk="mk" data-f="${E(DATA.st[p.src])}" data-d="${E(DATA.st[p.dst])}">📤 أنشئ طلب التحويل</button>`:`<small class="off">أحدهما ليس فرعاً في المنصة</small>`};
 return `<div class="stk-bar"><label>من فرع<select data-sf="fr" id="stk-fr">${opt(stores(1),UI.fr,"الكل")}</select></label><label>إلى فرع<select data-sf="tt" id="stk-tt">${opt(stores(1),UI.tt,"الكل")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" dir="ltr"></label>${perSel()}<span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(T.skus)}</b>صنف غير متاح بالمستودع ومتاح في فروع</span><span><b>${fmt(TRL.length)}</b>تحويل مقترح</span><span><b>${fmt(TRL.reduce((s,l)=>s+l.n,0))}</b>قطعة</span><span><b>${fmt(T.unmet)}</b>طلب بلا فرع يُسحب منه</span>${nSent?`<span><b>${fmt(nSent)}</b>أُنشئ لها طلب تحويل</span>`:""}</div>
 <p class="off" style="margin:0 4px 10px;font-size:13px">القاعدة: نسحب من فرع مبيعاته من الصنف ${N(CFG.slow)?"لا تزيد على "+N(CFG.slow):"صفر"} في الفترة ويبقى عنده ${N(CFG.keep)} على الأقل، ونرسل لفرع رصيده أقل من الحد ويبيع الصنف (الأعلى مبيعاً أولاً). تتغيّر من تبويب «القواعد».</p>
 ${can&&pairs.length?`<div class="stk-pan stk-prs"><h3>📤 حوّلها إلى طلبات تحويل</h3><p class="off">كل زر ينشئ طلب «تحويل بين الفروع» واحداً بأصناف هذا الزوج (حتى 400 سطر)، ويصل الفرعين إشعار ويظهر في «الطلبات». ما أُنشئ له طلب يبقى معلَّماً ${SENT_DAYS} يوماً فلا يتكرر.</p>${pairs.slice(0,UI.prs||8).map(p=>`<div class="stk-pr"><span>${sn(p.src)} <i aria-hidden="true">←</i> ${sn(p.dst)}</span><b>${fmt(p.n)} صنف · ${fmt(p.pcs)} قطعة</b><button class="bt s" type="button" data-sk="prv" data-f="${E(DATA.st[p.src])}" data-d="${E(DATA.st[p.dst])}">عرض الأصناف</button>${mkBtn(p)}</div>`).join("")}${pairs.length>(UI.prs||8)?`<button class="bt s stk-more" type="button" data-sk="prsmore">عرض المزيد (${fmt(pairs.length-(UI.prs||8))} زوج آخر)</button>`:""}</div>`:""}
 ${L.length?`<div class="stk-pan" style="margin-top:12px"><div class="tw"><table class="stk-t"><thead><tr><th>من فرع</th><th>إلى فرع</th><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">الكمية</th><th class="n">رصيد المُرسِل</th><th class="n">مبيعاته</th><th class="n">رصيد المستلم</th><th class="n">مبيعاته</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr${l.sent?' class="snt"':""}><td>${sn(l.src)}</td><td>${sn(l.dst)}</td>${kCells(l.ki)}<td class="n">${l.sent?`<span class="no" title="أُنشئ طلب التحويل" data-notr dir="ltr">${E(l.sent.no)}</span>`:`<span class="gv" style="padding:2px 10px">${N(l.n)}</span>`}</td><td class="n">${l.fon}</td><td class="n">${l.fsold}</td><td class="n${l.ton<=0?" z":""}">${l.ton}</td><td class="n">${l.tsold}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا تحويلات مقترحة بهذه الشروط.</div></div>`}`;
}
// ينشئ طلب تحويل حقيقي بأصناف زوج (من ← إلى) المعروضة، ثم يعلّمها حتى لا تتكرر
async function mkTransfer(fName,dName){
 if(BUSY||!X||!X.transfer)return;const fi=DATA.sti.get(fName),di=DATA.sti.get(dName),L=TRL.filter(l=>l.src===fi&&l.dst===di).slice(0,400);if(!L.length)return;
 const pcs=L.reduce((s,l)=>s+l.n,0),more=TRL.filter(l=>l.src===fi&&l.dst===di).length-L.length;
 if(!confirm("إنشاء طلب تحويل من "+fName+" إلى "+dName+"؟\n\n"+L.length+" صنف · "+pcs+" قطعة"+(more>0?"\n(أول 400 سطر، والباقي "+more+" يُنشأ بطلب آخر)":"")+"\n\nسيصل الفرعين إشعار، ويظهر الطلب في «الطلبات»."))return;
 BUSY="جاري إنشاء طلب التحويل…";paint();let r=null;
 try{r=await X.transfer({fr:cd(fName),to:cd(dName),rows:L.map(l=>{const x=DATA.k[l.ki];return {k:x[0],c:x[1],z:x[2],q:l.n}}),gn:"تحويل مقترح من تحليل المخزون: الصنف غير متاح بالمستودع، والفرع المُرسِل لا يبيعه في الفترة."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
 if(r&&r.ok){const at=Date.now(),lim=at-SENT_DAYS*864e5;SENT=SENT.filter(e=>e&&N(e.at)>lim).concat(L.map(l=>{const x=DATA.k[l.ki];return {c:x[0],cl:x[1],z:x[2],f:cd(fName),t:cd(dName),n:l.n,at,no:String(r.no||"").slice(0,40)}})).slice(-3000);
  try{const fb=await FB();await fb.setDoc(fb.doc(X.db,"stk","sent"),{l:SENT,at,by:by().e})}catch(e){if(X.toast)X.toast("أُنشئ الطلب، لكن تعذّر حفظ علامته: لا تنشئه مرة أخرى")}
  BUSY="";paint();if(X.toast)X.toast("✅ أُنشئ طلب التحويل "+String(r.no||"")+" ووصل الفرعين إشعار")}
 else{BUSY="";paint();if(X.toast)X.toast("تعذّر إنشاء الطلب: "+String(r&&r.err||"").slice(0,90))}
}
function vItem(){
 const P=period(),code=String(UI.code||"").trim(),M=code?matrix(DATA,CFG,code,P):null;
 const bar=`<div class="stk-bar"><label>الكود<input type="text" data-sf="code" id="stk-code" list="stk-codes" value="${E(UI.code)}" placeholder="اكتب الكود" dir="ltr" autocomplete="off"></label>${perSel()}<label>أعرض<select data-sf="show" id="stk-show"><option value="b"${UI.show==="b"?" selected":""}>الرصيد والمبيعات</option><option value="o"${UI.show==="o"?" selected":""}>الرصيد فقط</option><option value="s"${UI.show==="s"?" selected":""}>المبيعات فقط</option></select></label><span class="sp"></span>${M?`<button class="bt" type="button" data-sk="xls">⬇️ إكسل</button>`:""}</div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 if(!code){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">اكتب كود الصنف لترى كل الفروع في جدول واحد:<br>رصيد كل فرع ومبيعاته لكل لون ومقاس، ومن يحتاج ومن عنده راكد.</div></div>`}
 if(!M){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">الكود <b data-notr dir="ltr">${E(code)}</b> غير موجود في ملف الكميات.</div></div>`}
 const mn=k=>minOf(CFG,DATA,k),ex=exSet(CFG,DATA),tot={};let allOn=0,allSold=0;
 M.rows.forEach(r=>{for(const ti in r.m){const t=tot[ti]||(tot[ti]=[0,0]);t[0]+=r.m[ti][0];t[1]+=r.m[ti][1];if(+ti!==M.wh){allSold+=r.m[ti][1]}allOn+=r.m[ti][0]}});
 const cell=(v,ki,ti)=>{if(!v)return `<td class="e">·</td>`;const isWh=ti===M.wh,cls=isWh?"wh":ex.has(ti)?"":v[0]<mn(ki)&&v[1]>0?"need":v[0]>=N(CFG.stale)&&v[1]<=0?"idle":"";
  return `<td class="${cls}">${UI.show==="s"?v[1]:UI.show==="o"?v[0]:`<b>${v[0]}</b><i>${v[1]}</i>`}</td>`};
 const vnm=DATA.k[M.rows[0].ki][3];
 LASTX={name:"تحليل-"+code,head:["اللون","المقاس"].concat([].concat.apply([],M.st.map(ti=>[DATA.st[ti]+" رصيد",DATA.st[ti]+" مبيعات"]))),rows:()=>M.rows.map(r=>{const x=DATA.k[r.ki];return [x[1],x[2]].concat([].concat.apply([],M.st.map(ti=>r.m[ti]?[r.m[ti][0],r.m[ti][1]]:["",""])))})};
 return bar+gapNote(P)+`<div class="stk-sum"><span data-notr><b dir="ltr">${E(code)}</b>${vnm>=0?E(DATA.vn[vnm]):""}</span><span><b>${fmt(tot[M.wh]?tot[M.wh][0]:0)}</b>رصيد المستودع</span><span><b>${fmt(allOn-(tot[M.wh]?tot[M.wh][0]:0))}</b>رصيد الفروع</span><span><b>${fmt(allSold)}</b>مبيعات الفروع</span><span><b>${M.rows.length}</b>لون ومقاس</span></div>
 <p class="off" style="margin:0 4px 10px;font-size:13px">في كل خانة: الرصيد في الأعلى والمبيعات تحته بخط أصغر. <span style="background:#fdecea;color:#8a2218;border-radius:6px;padding:1px 8px;font-weight:700">أحمر</span> = يبيع ورصيده أقل من الحد · <span style="background:#fff4e2;color:#6b4300;border-radius:6px;padding:1px 8px;font-weight:700">أصفر</span> = عنده ${N(CFG.stale)} أو أكثر ولم يبع.</p>
 <div class="stk-pan"><div class="tw"><table class="stk-t stk-mx"><thead><tr><th class="s">اللون / المقاس</th>${M.st.map(ti=>`<th>${sn(ti)}</th>`).join("")}<th>الإجمالي</th></tr></thead><tbody>${M.rows.map(r=>{const x=DATA.k[r.ki];let a=0,b=0;for(const ti in r.m){a+=r.m[ti][0];b+=r.m[ti][1]}return `<tr><td class="s" data-notr>${E(x[1]||"—")} · ${E(x[2]||"—")}</td>${M.st.map(ti=>cell(r.m[ti],r.ki,ti)).join("")}<td><b>${a}</b><i>${b}</i></td></tr>`}).join("")}
 <tr class="tot"><td class="s">الإجمالي</td>${M.st.map(ti=>`<td><b>${tot[ti]?tot[ti][0]:0}</b><i>${tot[ti]?tot[ti][1]:0}</i></td>`).join("")}<td><b>${allOn}</b><i>${allSold+(tot[M.wh]?tot[M.wh][1]:0)}</i></td></tr>
 <tr><td class="s">نسبة المبيعات</td>${M.st.map(ti=>`<td>${ti===M.wh||!allSold?"—":Math.round((tot[ti]?tot[ti][1]:0)/allSold*100)+"%"}</td>`).join("")}<td></td></tr></tbody></table></div></div>`;
}
function vSales(){
 const code=String(UI.code||"").trim(),end=META&&META.q&&META.q.to?addDays(META.q.to,-1):today();if(!UI.from)UI.from=addDays(end,-29);if(!UI.to)UI.to=end;
 const ids=DATA.code.get(code)||[],cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!UI.cl||DATA.k[k][1]===UI.cl).map(k=>DATA.k[k][2]))].sort((a,b)=>zk(a)-zk(b));
 const bar=`<div class="stk-bar"><label>الكود<input type="text" data-sf="code" id="stk-code" list="stk-codes" value="${E(UI.code)}" placeholder="اكتب الكود" dir="ltr" autocomplete="off"></label><label>اللون<select data-sf="cl" id="stk-cl">${opt(cols,UI.cl,"كل الألوان")}</select></label><label>المقاس<select data-sf="sz" id="stk-sz">${opt(szs,UI.sz,"كل المقاسات")}</select></label><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(0),UI.st,"كل الفروع")}</select></label><label>من يوم<input type="date" data-sf="from" id="stk-from" value="${E(UI.from)}"></label><label>إلى يوم<input type="date" data-sf="to" id="stk-to" value="${E(UI.to)}"></label><span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 if(!dHas()){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">لم يُرفع ملف التاريخ بعد.<br>ارفعه من تبويب «الملفات» لتسأل: كم بيع من الكود في فرع من يوم إلى يوم.</div></div>`}
 if(!code){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">اكتب الكود واختر الفرع والفترة.</div></div>`}
 if(!(UI.from<=UI.to)){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">تاريخ البداية بعد تاريخ النهاية.</div></div>`}
 const P={from:UI.from,to:UI.to},R=salesQuery(DATA,{code,cl:UI.cl,z:UI.sz,store:UI.st,from:UI.from,to:UI.to});
 if(!R){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">الكود <b data-notr dir="ltr">${E(code)}</b> غير موجود.</div></div>`}
 const days=Object.keys(R.byDay).sort(),mx=Math.max(1,...days.map(d=>Math.abs(R.byDay[d]))),sts=Object.keys(R.bySt).map(Number).sort((a,b)=>R.bySt[b]-R.bySt[a]),ks=Object.keys(R.byK).map(Number).sort((a,b)=>R.byK[b]-R.byK[a]);
 LASTX={name:"مبيعات-"+code+"-"+UI.from+"-"+UI.to,head:["اليوم","الكمية"],rows:()=>days.map(d=>[d,R.byDay[d]]).concat([["",""],["الفرع","الكمية"]]).concat(sts.map(t=>[DATA.st[t],R.bySt[t]]))};
 return bar+gapNote(P)+`<div class="stk-sum"><span><b>${fmt(R.total)}</b>قطعة مباعة (الصافي)</span>${R.ret?`<span><b>${fmt(R.ret)}</b>مرتجع</span>`:""}<span><b>${days.length}</b>يوم فيه حركة</span><span><b>${sts.length}</b>فرع</span></div>
 <div class="stk-up"><div class="stk-card"><h3>حسب الفرع</h3>${sts.length?`<table class="stk-t"><tbody>${sts.map(t=>`<tr><td>${sn(t)}</td><td class="n"><b>${R.bySt[t]}</b></td><td class="n">${R.total?Math.round(R.bySt[t]/R.total*100)+"%":""}</td></tr>`).join("")}</tbody></table>`:`<p>لا مبيعات في الفترة.</p>`}
 ${ks.length>1?`<h3 style="margin-top:14px">حسب اللون والمقاس</h3><table class="stk-t"><tbody>${ks.slice(0,40).map(k=>`<tr><td data-notr>${E(DATA.k[k][1]||"—")} · ${E(DATA.k[k][2]||"—")}</td><td class="n"><b>${R.byK[k]}</b></td></tr>`).join("")}</tbody></table>`:""}</div>
 <div class="stk-card"><h3>يوماً بيوم</h3>${days.length?days.map(d=>`<div class="stk-day"><span data-notr>${d}</span><i class="${R.byDay[d]<0?"m":""}" style="width:${Math.round(Math.abs(R.byDay[d])/mx*62)}%"></i><b>${R.byDay[d]}</b></div>`).join(""):`<p>لا مبيعات في الفترة.</p>`}</div></div>`;
}
function vStale(){
 const P=period(),L=stale(DATA,CFG,{store:UI.st,vendor:UI.vn,min:UI.son,period:P});
 LASTX={name:"الراكد",head:["الفرع","الكود","اللون","المقاس","المورد","الرصيد","المبيعات"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],x[3]>=0?DATA.vn[x[3]]:"",l.on,l.sold]})};
 return `<div class="stk-bar"><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(1),UI.st,"كل الفروع")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>الرصيد من<input type="number" min="1" max="9999" data-sf="son" id="stk-son" value="${E(UI.son)}" placeholder="${E(CFG.stale)}"></label>${perSel()}<span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>سطر راكد</span><span><b>${fmt(L.reduce((s,l)=>s+l.on,0))}</b>قطعة</span></div>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr>${UI.st?"":"<th>الفرع</th>"}<th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">الرصيد</th><th class="n">المبيعات</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr>${UI.st?"":`<td>${sn(l.ti)}</td>`}${kCells(l.ki)}<td class="n"><b>${l.on}</b></td><td class="n">${l.sold}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا أصناف راكدة بهذه الشروط.</div></div>`}`;
}
function vUp(){
 const q=META&&META.q,d=META&&META.d?META.d:{},yms=Object.keys(d).sort(),dsold=yms.reduce((s,ym)=>s+N(d[ym].sold),0),cov=q&&N(q.sold)?Math.round(dsold/N(q.sold)*100):0;
 const need=q&&q.from&&q.to?months(q.from,addDays(q.to,-1)):yms;
 return `<label class="stk-drop" id="stk-drop"><input type="file" id="stk-file" accept=".xlsx,.csv" multiple><b>⬆️ ارفع ملفات اليوم</b><small>اختر ملف الكميات وملف التاريخ معاً (أو اسحبهما هنا). المنصة تتعرّف على كل ملف من أعمدته وتربط بينهما.</small></label>
 ${REP.map(r=>`<div class="stk-rep ${r.kind==="g"?"g":r.kind==="w"?"w":"r"}">${r.f?`<b data-notr>${E(r.f)}</b> — `:""}${E(r.t)}</div>`).join("")}
 <div class="stk-up"><div class="stk-card"><h3>📦 ملف الكميات</h3>${q?`<p>آخر رفع: <b data-notr dir="ltr">${dts(q.at)}</b>${q.src?` · <span data-notr>${E(q.src)}</span>`:""}</p><p>${fmt(q.rows)} سطر · ${fmt(q.skus)} صنف (كود ولون ومقاس)</p><p>الرصيد ${fmt(q.on)} قطعة · المبيعات ${fmt(q.sold)} قطعة${q.from?` · من <span data-notr dir="ltr">${E(q.from)}</span> إلى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه <b data-notr>OH_QTY</b> (الكمية) بلا تاريخ.</p>`}</div>
 <div class="stk-card"><h3>📅 ملف التاريخ</h3>${yms.length?`<p>${yms.length} شهر محفوظ · ${fmt(dsold)} قطعة مباعة${q?` · يغطي <b>${cov}%</b> من مبيعات ملف الكميات`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه السنة والشهر واليوم بلا كمية.</p>`}
 <div class="stk-mo">${need.map(ym=>d[ym]?`<span data-notr title="${fmt(d[ym].n)} · ${N(d[ym].dmin)}–${N(d[ym].dmax)}">${ym} ✓</span>`:`<span class="x" data-notr>${ym}</span>`).join("")}</div>
 <p style="margin-top:10px">Power BI يقطع التصدير عند 150 ألف سطر. نزّل ملف التاريخ على فترات (شهر أو شهرين) وارفعها كلها مرة واحدة للتأسيس، ثم يكفي كل يوم ملف الشهر الحالي: كل ملف يستبدل أيام فترته فقط.</p></div></div>`;
}
function vCfg(){
 const row=(k,t,s,mn)=>`<div class="f"><div><b>${t}</b><small>${s}</small></div><input type="number" min="${mn}" max="9999" data-cf="${k}" id="stk-c-${k}" value="${E(CFG[k])}"></div>`;
 return `<div class="stk-card stk-cfg"><h3>⚙ قواعد التحليل</h3><p>تُطبَّق على كل التبويبات، وتُحفظ لك ولملّاك النظام.</p>
 ${row("min","حد النواقص","الفرع يحتاج تزويداً لو رصيده من الصنف أقل من هذا الرقم.",1)}
 ${row("keep","أقل كمية تبقى عند الفرع المسحوب منه","عند اقتراح التحويل لا يُسحب من الفرع ما ينزل رصيده عن هذا الرقم.",0)}
 ${row("slow","الفرع «لا يبيع» لو مبيعاته لا تزيد على","يُسحب فقط من فرع مبيعاته من الصنف في الفترة لا تزيد على هذا الرقم (صفر = لم يبع شيئاً).",0)}
 ${row("stale","حد الراكد","الصنف راكد في الفرع لو رصيده هذا الرقم أو أكثر ولم يبع.",1)}
 <div class="f"><div><b>مخزن المستودع</b><small>المخزن الذي تُحسب منه النواقص.</small></div><select data-cf="wh" id="stk-c-wh" style="height:42px;max-width:220px">${DATA.st.slice().sort().map(s=>`<option data-notr${s===CFG.wh?" selected":""}>${E(s)}</option>`).join("")}</select></div>
 <div class="f"><div><b>مخازن خارج التحليل</b><small>لا تظهر في النواقص ولا يُسحب منها ولا يُرسل إليها.</small><div class="stk-chk" style="margin-top:8px">${DATA.st.filter(s=>s!==CFG.wh).sort().map(s=>`<label data-notr><input type="checkbox" data-cx="${E(s)}"${(CFG.ex||[]).indexOf(s)>=0?" checked":""}>${E(s)}</label>`).join("")}</div></div></div>
 <div class="f"><div><b>حدود خاصة</b><small>حد نواقص مختلف لمورد أو لكود بعينه (مثلاً 20 لمورد معيّن). الكود يغلب المورد.</small>
 <div style="margin-top:8px">${(CFG.ov||[]).map((o,i)=>`<div class="stk-day"><span style="width:auto" data-notr>${o.t==="c"?"كود":"مورد"}: ${E(o.k)}</span><b>أقل من ${N(o.min)}</b><button class="bt s" type="button" data-sk="ovx" data-i="${i}">حذف</button></div>`).join("")||`<small>لا حدود خاصة.</small>`}</div>
 <div class="stk-bar" style="margin-top:10px;border:0;padding:0;background:none"><label>النوع<select id="stk-ot"><option value="v">مورد</option><option value="c">كود</option></select></label><label>المورد<select id="stk-ov">${opt(vendors(),"","اختر المورد")}</select></label><label>أو الكود<input type="text" id="stk-oc" list="stk-codes2" dir="ltr" autocomplete="off"></label><label>الحد<input type="number" id="stk-om" min="1" max="9999" value="20"></label><button class="bt" type="button" data-sk="ova">إضافة</button></div><datalist id="stk-codes2">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist></div></div>
 <div class="f"><div></div><button class="bt p" type="button" data-sk="cfgsave">حفظ القواعد</button><button class="bt" type="button" data-sk="cfgdef">رجوع للقواعد الأصلية</button></div></div>`;
}
function body(){
 if(LOADING&&!DATA)return `<div class="stk-busy">جاري تحميل بيانات المخزون…</div>`;
 const has=DATA&&DATA.has,t=has?UI.tab:"up",q=META&&META.q;
 const hd=`<div class="stk-hd"><div><small>${q?`آخر ملف كميات: <span data-notr dir="ltr">${dts(q.at)}</span> · ${fmt(q.skus)} صنف${q.to?` · المبيعات حتى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}`:"ارفع ملف الكميات لتبدأ"}</small></div></div>`;
 const tabs=`<nav class="stk-tabs" aria-label="أقسام تحليل المخزون">${TABS.filter(a=>has||a[0]==="up").map(a=>`<button type="button" class="${t===a[0]?"on":""}" data-sk="tab" data-t="${a[0]}">${a[1]} ${a[2]}</button>`).join("")}</nav>`;
 const busy=BUSY?`<div class="stk-busy">${E(BUSY)} <span id="stk-pg" data-notr></span></div>`:"";
 let v="";try{v=t==="up"?vUp():!has?vUp():t==="need"?vNeed():t==="tr"?vTr():t==="item"?vItem():t==="sales"?vSales():t==="stale"?vStale():vCfg()}catch(e){v=`<div class="stk-rep r">تعذّر عرض هذا التبويب (${E(String(e&&e.message||e).slice(0,80))}).</div>`}
 return hd+tabs+busy+v;
}
let PT=0;
function paint(keepFocus){
 if(!ROOT)return;const a=document.activeElement,id=a&&ROOT.contains(a)?a.id:"",s0=a&&id?[a.selectionStart,a.selectionEnd]:null;
 ROOT.innerHTML=body();
 if(id&&keepFocus!==false){const el=g(id);if(el&&el.focus){try{el.focus({preventScroll:true});if(s0&&s0[0]!=null&&el.setSelectionRange)el.setSelectionRange(s0[0],s0[1])}catch(e){}}}
 // فترة تحتاج شهوراً لم تُحمَّل بعد
 const P=UI.tab==="sales"?(UI.from&&UI.to&&UI.from<=UI.to&&UI.code?{from:UI.from,to:UI.to}:null):(UI.tab==="up"||UI.tab==="cfg"?null:period());
 if(P&&!BUSY&&META&&META.d&&DATA&&months(P.from,P.to).some(ym=>META.d[ym]&&!DATA.d[ym]))needMonths(P.from,P.to);
}
const later=()=>{clearTimeout(PT);PT=setTimeout(()=>paint(),260)};
function csv(){
 if(!LASTX)return;const q=v=>{let s=String(v==null?"":v);if(/^[=+\-@]/.test(s)&&isNaN(+s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const t="﻿"+[LASTX.head].concat(LASTX.rows()).map(r=>r.map(q).join(",")).join("\r\n"),a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob([t],{type:"text/csv;charset=utf-8"}));a.download="tasooma-"+LASTX.name+"-"+today()+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
}
function wire(){
 ROOT.addEventListener("click",e=>{const t=e.target.closest("[data-sk]");if(!t)return;const a=t.dataset.sk;
  if(a==="tab"){UI.tab=t.dataset.t;UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="more"){UI.lim+=400;paint()}
  else if(a==="xls")csv();
  else if(a==="code"){e.preventDefault();UI.code=t.dataset.c;UI.tab="item";UI.cl="";UI.sz="";paint(false);window.scrollTo(0,0)}
  else if(a==="mk")mkTransfer(t.dataset.f,t.dataset.d);
  else if(a==="prv"){UI.fr=t.dataset.f;UI.tt=t.dataset.d;UI.lim=200;paint(false)}
  else if(a==="prsmore"){UI.prs=(UI.prs||8)+20;paint()}
  else if(a==="cfgsave")saveCfg();
  else if(a==="cfgdef"){CFG=Object.assign({},DEF,{ex:DEF.ex.slice(),ov:[]});paint()}
  else if(a==="ovx"){CFG.ov=(CFG.ov||[]).filter((o,i)=>i!==+t.dataset.i);paint()}
  else if(a==="ova"){const ty=g("stk-ot").value,k=String(ty==="c"?g("stk-oc").value:g("stk-ov").value).trim(),mn=N(g("stk-om").value);if(!k||mn<1){if(X.toast)X.toast(ty==="c"?"اكتب الكود":"اختر المورد");return}
   CFG.ov=(CFG.ov||[]).filter(o=>!(o.t===ty&&o.k===k)).concat([{t:ty,k:k.slice(0,60),min:Math.min(9999,mn)}]);paint()}});
 const set=t=>{const k=t.dataset.sf;if(k){UI[k]=t.type==="checkbox"?(t.checked?1:0):t.value;UI.lim=200;if(k==="code"){UI.cl="";UI.sz=""}if(k==="cl")UI.sz="";return true}
  if(t.dataset.cf){const c=t.dataset.cf;CFG[c]=c==="wh"?t.value:Math.max(0,Math.min(9999,N(t.value)));return false}
  if(t.dataset.cx!==undefined){const s=new Set(CFG.ex||[]);if(t.checked)s.add(t.dataset.cx);else s.delete(t.dataset.cx);CFG.ex=[...s];return false}return false};
 ROOT.addEventListener("input",e=>{const t=e.target;if(t.id==="stk-file")return;if(t.tagName==="SELECT"||t.type==="checkbox"||t.type==="date")return;if(set(t))later()});
 ROOT.addEventListener("change",e=>{const t=e.target;if(t.id==="stk-file"){const f=[...t.files];t.value="";onFiles(f);return}if(set(t)){clearTimeout(PT);paint()}});
 ROOT.addEventListener("dragover",e=>{const d=e.target.closest&&e.target.closest("#stk-drop");if(d){e.preventDefault();d.classList.add("ov")}});
 ROOT.addEventListener("dragleave",e=>{const d=e.target.closest&&e.target.closest("#stk-drop");if(d)d.classList.remove("ov")});
 ROOT.addEventListener("drop",e=>{const d=e.target.closest&&e.target.closest("#stk-drop");if(!d)return;e.preventDefault();d.classList.remove("ov");onFiles(e.dataTransfer&&e.dataTransfer.files)});
}
export function initStock(ctx){X=ctx;if(!g("stk-css")){const s=document.createElement("style");s.id="stk-css";s.textContent=CSS;document.head.appendChild(s)}}
// اللوحة تعيد رسم المحتوى مع كل تحديث لحظي: عنصر المديول ثابت ويُعاد وضعه في مكانه (ما يكتبه المستخدم لا يضيع)
export function stockMount(host){
 if(!X||!host)return;if(!ROOT){ROOT=document.createElement("div");ROOT.id="stk";wire();paint()}
 if(ROOT.parentNode!==host)host.appendChild(ROOT);
 if(!LOADED&&!LOADING)load();
}
export function stopStock(){un.forEach(f=>f());un=[];X=null;DATA=null;META=null;SENT=[];TRL=[];LOADED=false;LOADING=false;BUSY="";REP=[];SOLDC={};CFG=Object.assign({},DEF);if(ROOT){ROOT.remove();ROOT=null}}
export const stockState=()=>({loaded:LOADED,has:!!(DATA&&DATA.has),meta:META,cfg:CFG,ui:UI,rep:REP,busy:BUSY});
