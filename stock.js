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
// (v174) تبويب «اسأل»: سؤال حر (كود، فرع، لون، مقاس، فترة) ← parseAsk (قواعد ثابتة، لا تخمين) ← storeCard / codeCard (جمع مباشر من الملفين).
//   ضمان الأرقام: num() لا يحوّل غير الرقم إلى صفر، والملف الذي لا يطابق سطر Total لا يُحفظ، coverage() تحذّر بالشهر واليوم، reconcile() يطابق الملفين.
//   عمود RCVD_QTY ليس استلام الفرع (رقم واحد يتكرر على كل الفروع): لا يُعرض ولا يُستخدم. الخانة الرابعة في لقطة الكميات صارت مورد السطر (rv:1).
// دوال القاعدة (doc, getDoc, setDoc, writeBatch) تمرّرها اللوحة في initStock({fb}): الملف نفسه بلا import
const FB=()=>X&&X.fb?Promise.resolve(X.fb):Promise.reject(new Error("nofb"));
const g=id=>document.getElementById(id);
export const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=v=>{const n=+v;return isFinite(n)?n:0};
// رقم من خانة في الملف: يقبل 1,234 و (5) والأرقام العربية والفراغ (= صفر)؛ غير ذلك NaN، فلا يتحول خطأ القراءة إلى صفر بصمت (v174)
export const num=v=>{if(typeof v==="number")return isFinite(v)?v:NaN;let s=String(v==null?"":v).replace(/[\s ‎‏]/g,"");if(!s)return 0;
 s=s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/٫/g,".").replace(/٬/g,",");let neg=false;if(/^\(.+\)$/.test(s)){neg=true;s=s.slice(1,-1)}
 if(/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.split(",").join("");if(!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s))return NaN;const n=+s;return neg?-n:n};
const SEP="\u0001";
export const DEF={min:2,keep:2,slow:0,days:60,stale:5,ex:["000-SERVER"],wh:"001-WEARHOUSE",ov:[]};
let X=null,ROOT=null,DATA=null,CFG=Object.assign({},DEF),META=null,LOADED=false,LOADING=false,BUSY="",REP=[],SOLDC={},SENT=[],un=[];
const SENT_DAYS=14;// طلب التحويل المُنشأ يبقى معلَّماً على اقتراحه 14 يوماً (حتى يظهر أثره في تقرير السيستم)
let UI={tab:"ask",st:"",vn:"",q:"",sold:1,min:"",per:"ytd",from:"",to:"",fr:"",tt:"",code:"",cl:"",sz:"",show:"b",son:"",lim:200,aq:"",a:null,rec:null};

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
 let H=null,type="",n=0;const st=[],sti=new Map(),vn=[],vni=new Map(),k=[],ki=new Map(),q=new Map(),mon={},days=new Set(),vs=[];
 const sum={sold:0,on:0,rc:0},tot={},R={trunc:false,from:"",to:"",bad:0,nan:0,dup:0};
 const qn=v=>{const x=num(v);if(x!==x){R.nan++;return 0}return x};// خانة كمية غير رقمية تُعدّ (والملف يُرفض عند الحفظ)
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
  if(!store){if(/^total$/i.test(code)){const a=num(r[H.sold]);if(a===a)tot.sold=a;if(H.on!==undefined){const b=num(r[H.on]);if(b===b)tot.on=b}if(H.rc!==undefined)tot.rc=N(r[H.rc])}else if(code)R.bad++;return}
  if(!code){R.bad++;return}
  // السطر يُراجَع كله قبل أن يدخل في أي مجموع: سطر تاريخه غير مفهوم لا يُحسب (فيظهر الفرق أمام سطر الإجمالي ويُرفض الملف)
  let y=0,mo=0,dy=0;
  if(type==="d"){if(H.dt!==undefined&&H.mo===undefined){const d=dateOf(r[H.dt]);if(!d){R.bad++;return}y=d[0];mo=d[1];dy=d[2]}else{y=H.yr!==undefined?N(r[H.yr]):new Date().getFullYear();mo=moNum(r[H.mo]);dy=N(r[H.dy])}
   if(!mo||y<2000||y>2100||dy<1||dy!==Math.floor(dy)||dy>new Date(y,mo,0).getDate()){R.bad++;return}}
  const sold=qn(r[H.sold]),rc=H.rc!==undefined?N(r[H.rc]):0,cl=H.color!==undefined?String(r[H.color]||"").trim():"",z=H.size!==undefined?String(r[H.size]||"").trim():"";
  const key=code+SEP+cl+SEP+z;let kk=ki.get(key);
  const vi=H.vendor!==undefined?ix(vn,vni,String(r[H.vendor]||"").trim()):-1;
  if(kk===undefined){kk=k.length;k.push([code,cl,z,vi]);ki.set(key,kk)}
  const ti=ix(st,sti,store);n++;sum.sold+=sold;sum.rc+=rc;
  // الخانة الرابعة = مورد هذا السطر (v174): في التقرير 21 صنفاً مكتوب لها موردان في فروع مختلفة، فالمورد يُحفظ لكل (صنف، فرع) لا للصنف. (كانت «المستلم»، وهو عمود غير صالح)
  if(type==="q"){const on=qn(r[H.on]);sum.on+=on;let a=q.get(kk);if(!a){a=[];q.set(kk,a)}let j=0;for(;j<a.length;j+=4)if(a[j]===ti)break;if(j<a.length){a[j+1]+=on;a[j+2]+=sold;R.dup++;if(vi!==a[j+3])vs.push(kk,ti,vi,on,sold)}else a.push(ti,on,sold,vi)}// سطر ثانٍ لنفس (صنف، فرع) بمورد آخر: يُجمع في الرصيد، ونصيب المورد الثاني يُحفظ في vs
  else if(type==="d"){const ym=y+"-"+p2(mo);(mon[ym]||(mon[ym]=[])).push(kk,ti,dy,sold,rc);days.add(ym+"-"+p2(dy))}
 }
 return {row,done:()=>Object.assign(R,{ok:!!H&&!!type,type,n,st,vn,k,q,vs,mon,days:[...days].sort(),sum,tot})};
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
export const packQ=R=>JSON.stringify({st:R.st,vn:R.vn,k:R.k,rv:1,vs:R.vs||[],r:[...R.q].map(e=>[e[0]].concat(e[1]))});// rv:1 = الخانة الرابعة في كل سطر هي رقم المورد (لقطات v173 فيها «المستلم»)
// شهر من ملف تاريخ ← مستند مستقل بقاموسه (فلا يتأثر بتغيّر ترتيب الأصناف في رفع لاحق)
export function packMonth(k,st,flat){const km=new Map(),K=[],r=[];for(let i=0;i<flat.length;i+=5){let j=km.get(flat[i]);if(j===undefined){j=K.length;K.push(k[flat[i]].slice(0,3));km.set(flat[i],j)}r.push(j,flat[i+1],flat[i+2],flat[i+3],flat[i+4])}return {st,k:K,r}}

/* ============ 3) البيانات في الذاكرة ============ */
export function newData(){return {st:[],sti:new Map(),vn:[],vni:new Map(),k:[],ki:new Map(),q:[],code:new Map(),d:{},vx:new Map(),has:false}}
const dIx=(D,arr,map,v)=>{let i=map.get(v);if(i===undefined){i=arr.length;arr.push(v);map.set(v,i)}return i};
const dKey=(D,c,cl,z,vi)=>{const key=c+SEP+cl+SEP+z;let i=D.ki.get(key);if(i===undefined){i=D.k.length;D.k.push([c,cl,z,vi==null?-1:vi]);D.ki.set(key,i);let a=D.code.get(c);if(!a){a=[];D.code.set(c,a)}a.push(i)}else if(vi!=null&&vi>=0&&D.k[i][3]<0)D.k[i][3]=vi;return i};
export function loadQ(D,P){// P = {st,vn,k,r}
 D.q=[];D.has=true;const sm=P.st.map(s=>dIx(D,D.st,D.sti,s)),vm=P.vn.map(v=>dIx(D,D.vn,D.vni,v));
 const km=P.k.map(x=>dKey(D,x[0],x[1],x[2],x[3]>=0?vm[x[3]]:-1));
 // مورد السطر: من اللقطة الجديدة (rv)، وفي لقطة قديمة = مورد الصنف
 for(const row of P.r){const a=[],ki=km[row[0]],kv=D.k[ki][3];for(let j=1;j<row.length;j+=4)a.push(sm[row[j]],row[j+1],row[j+2],P.rv?(row[j+3]>=0&&vm[row[j+3]]!==undefined?vm[row[j+3]]:-1):kv);D.q[ki]=a}
 // نصيب المورد الثاني لسطر مكتوب في التقرير بموردين: (صنف*1000+فرع) ← [مورد، رصيد، مبيعات، …]
 D.vx=new Map();const V=P.vs||[];for(let i=0;i+4<V.length;i+=5){const key=km[V[i]]*1000+sm[V[i+1]];let a=D.vx.get(key);if(!a){a=[];D.vx.set(key,a)}a.push(V[i+2]>=0&&vm[V[i+2]]!==undefined?vm[V[i+2]]:-1,V[i+3],V[i+4])}
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
// حد النواقص للصنف: حد خاص للكود، ثم حد خاص للمورد (مورد السطر vi لو أُعطي، وإلا مورد الصنف)، ثم الحد العام
const minOf=(C,D,ki,vi)=>{const x=D.k[ki],v=vi===undefined?x[3]:vi;for(const o of C.ov||[]){if(o.t==="c"&&o.k===x[0])return N(o.min)}for(const o of C.ov||[]){if(o.t==="v"&&v>=0&&o.k===D.vn[v])return N(o.min)}return N(C.min)};
// هل المورد fv أحد موردي هذا السطر؟ (مورد السطر، أو المورد الثاني لسطر مكتوب في التقرير بموردين)
const vHit=(D,ki,ti,vi,fv)=>{if(vi===fv)return true;const sp=D.vx?D.vx.get(ki*1000+ti):null;if(sp)for(let i=0;i<sp.length;i+=3)if(sp[i]===fv)return true;return false};
const exSet=(C,D)=>{const s=new Set();(C.ex||[]).forEach(n=>{const i=D.sti.get(n);if(i!==undefined)s.add(i)});return s};
const soldOf=(P,ki,ti,snap)=>P?(P.get(ki*1000+ti)||0):snap;
// نواقص الفروع: رصيد الفرع أقل من الحد والمستودع عنده. المقترح = ما يكمل الحد، ويُوزَّع رصيد المستودع على الأعلى مبيعاً أولاً
export function shortages(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase();
 const om=o.min!=null&&o.min!=="";
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];if(q&&x[0].toLowerCase().indexOf(q)<0)continue;
  let w=0;for(let j=0;j<a.length;j+=4)if(a[j]===wh)w+=a[j+1];if(w<=0)continue;
  const L=[];
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti))continue;const on=a[j+1],vi=a[j+3],mn=om?N(o.min):minOf(C,D,ki,vi);if(on>=mn)continue;const sold=soldOf(P,ki,ti,a[j+2]);if(o.sold&&sold<=0)continue;L.push({ki,ti,vi,on,sold,wh:w,need:mn-Math.max(0,on),give:0})}
  if(!L.length)continue;L.sort((p,r)=>r.sold-p.sold);let left=w;for(const l of L){l.give=Math.max(0,Math.min(l.need,left));left-=l.give}
  // فلترا الفرع والمورد بعد التوزيع (فلا يتغيّر «المقترح» بتغيّر الفلتر). المورد = مورد السطر في التقرير
  for(const l of L)if((fs===undefined||l.ti===fs)&&(fv===-2||vHit(D,l.ki,l.ti,l.vi,fv)))out.push(l)}
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
// 📦 (v179) ما يُنشر للفروع: (1) المتوفر في المستودع لكل صنف بمستوى فقط بلا أرقام: 2 متوفر، 1 كمية قليلة (≤ LOWQ)، 0 غير متوفر
// (2) الطلب المقترح لكل فرع = نواقصه (رصيده أقل من الحد والمستودع عنده) بالكمية الموزّعة، الأعلى مبيعاً أولاً، 200 بالكثير.
// parts = أجزاء المتوفر {كود:{"لون|مقاس":مستوى}} كل جزء ≤ 700 ألف حرف، br = {كود الفرع: [[كود،لون،مقاس،رصيده،مبيعاته،المقترح]...]}
export const LOWQ=5;
export function pubData(D,C){
 const wh=D.sti.get(C.wh),ex=exSet(C,D),av={};let n=0;
 for(let ki=0;ki<D.k.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];let w=0;for(let j=0;j<a.length;j+=4)if(a[j]===wh)w+=a[j+1];
  (av[x[0]]=av[x[0]]||{})[x[1]+"|"+x[2]]=w>LOWQ?2:w>0?1:0;n++}
 const parts=[];let cur={},sz=2,cn=0;
 for(const c of Object.keys(av).sort()){const add=JSON.stringify(c).length+JSON.stringify(av[c]).length+2;if(cn&&sz+add>700000){parts.push(cur);cur={};sz=2;cn=0}cur[c]=av[c];sz+=add;cn++}
 if(cn)parts.push(cur);
 const by={};for(const l of shortages(D,C,{})){if(l.give<=0)continue;const m=/^(\d{3})-/.exec(D.st[l.ti]||"");if(m)(by[m[1]]=by[m[1]]||[]).push(l)}
 const br={};D.st.forEach((nm,ti)=>{const m=/^(\d{3})-/.exec(nm||"");if(m&&ti!==wh&&!ex.has(ti))br[m[1]]=[]});
 Object.keys(by).forEach(code=>{br[code]=by[code].sort((p,r)=>r.sold-p.sold||r.give-p.give).slice(0,200).map(l=>{const x=D.k[l.ki];return [x[0],x[1],x[2],l.on,l.sold,l.give]})});
 return {parts,br,n};
}
// راكد: رصيد الفرع ≥ الحد ولم يبع في الفترة
export function stale(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,mn=Math.max(1,N(o.min==null||o.min===""?C.stale:o.min));
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti)||(fs!==undefined&&ti!==fs)||(fv!==-2&&!vHit(D,ki,ti,a[j+3],fv)))continue;if(a[j+1]<mn)continue;const sold=soldOf(P,ki,ti,a[j+2]);if(sold>0)continue;out.push({ki,ti,vi:a[j+3],on:a[j+1],sold})}}
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
/* ---- (v174) بطاقات «اسأل»: كل رقم هنا جمع مباشر من صفوف الملفين، بلا تقدير ---- */
// يمرّ على صفوف ملفات التاريخ داخل الفترة: fn(صنف، فرع، اليوم، الكمية)
const scan=(D,from,to,fn)=>{for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;fn(r[i],r[i+1],d,r[i+3])}}};
// بطاقة فرع: عنده كم، باع كم، نواقصه وراكده وما نفد وهو يبيع، أعلى الأصناف مبيعاً، وترتيبه بين الفروع.
// المبيعات: من ملف الكميات (من أول السنة) أو من ملفات التاريخ لو حُدّدت فترة {from,to}
export function storeCard(D,C,store,period){
 const ti=D.sti.get(store);if(ti===undefined)return null;
 const P=period?soldMap(D,period.from,period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),tot=[];for(let i=0;i<D.st.length;i++)tot.push(0);
 let on=0,neg=0,negN=0,skus=0,inSt=0,sold=0;const byC=new Map(),byV=new Map(),out=[];
 for(let ki=0;ki<D.k.length;ki++){const a=D.q[ki],x=D.k[ki];let o=0,s=0,has=false,w=0,rv=x[3];
  if(a)for(let j=0;j<a.length;j+=4){if(a[j]===ti){o+=a[j+1];s+=a[j+2];has=true;rv=a[j+3]}if(a[j]===wh)w+=a[j+1];if(!P)tot[a[j]]+=a[j+2]}
  if(P)s=P.get(ki*1000+ti)||0;if(!has&&!s)continue;
  skus++;if(o>0)inSt++;else if(o<0){neg+=o;negN++}on+=o;sold+=s;
  let c=byC.get(x[0]);if(!c){c={code:x[0],on:0,sold:0};byC.set(x[0],c)}c.on+=o;c.sold+=s;
  const vOf=i=>{const vn=i>=0?D.vn[i]:"";let v=byV.get(vn);if(!v){v={v:vn,on:0,sold:0};byV.set(vn,v)}return v},v=vOf(rv);v.on+=o;v.sold+=s;
  const sp=has?D.vx.get(ki*1000+ti):null;if(sp)for(let i=0;i<sp.length;i+=3){const v2=vOf(sp[i]);v2.on+=sp[i+1];v.on-=sp[i+1];if(!P){v2.sold+=sp[i+2];v.sold-=sp[i+2]}}// سطر بموردين في التقرير: لكل مورد نصيبه
  if(o<=0&&s>0)out.push({ki,on:o,sold:s,wh:w})}
 if(P)P.forEach((v,k)=>{tot[k%1000]+=v});
 // الترتيب بين الفروع (بلا المستودع والمخازن الخارجة عن التحليل)
 let rank=0,of=0,all=0;for(let i=0;i<tot.length;i++){if(i===wh||ex.has(i))continue;of++;all+=tot[i];if(i!==ti&&tot[i]>tot[ti])rank++}
 const inRank=ti!==wh&&!ex.has(ti);
 let ret=null,gross=null,days=null;if(period){ret=0;gross=0;const ds=new Set();scan(D,period.from,period.to,(ki,t,d,n)=>{if(t!==ti)return;if(n<0)ret-=n;else if(n>0){gross+=n;ds.add(d)}});days=ds.size}
 let short=null,idle=null;
 if(ti!==wh&&!ex.has(ti)){const L=shortages(D,C,{store,period}),S=L.filter(l=>l.sold>0);short={n:S.length,all:L.length,need:S.reduce((s,l)=>s+l.need,0),give:S.reduce((s,l)=>s+l.give,0)};
  const T=stale(D,C,{store,period});idle={n:T.length,pcs:T.reduce((s,l)=>s+l.on,0)}}
 return {ti,isWh:ti===wh,on,neg,negN,skus,inSt,sold,ret,gross,days,rank:inRank&&sold>0?rank+1:0,of:inRank?of:0,share:inRank&&all>0?sold/all:null,short,idle,
  out:out.sort((p,r)=>r.sold-p.sold),top:[...byC.values()].filter(c=>c.sold>0).sort((p,r)=>r.sold-p.sold||(p.code<r.code?-1:1)),vendors:[...byV.values()].sort((p,r)=>r.sold-p.sold||r.on-p.on)};
}
// بطاقة صنف (كود، ولون ومقاس وفرع اختيارياً): الأرصدة من ملف الكميات، والمبيعات منه أو من ملفات التاريخ لو حُدّدت فترة.
// drange = مدى ملفات التاريخ المحمَّلة لحساب أيام البيع وأول وآخر بيع والمرتجع عندما لا فترة محددة
export function codeCard(D,C,code,o){
 o=o||{};const all=D.code.get(String(code||"").trim());if(!all||!all.length)return null;
 const ids=all.filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z)).sort((p,r)=>cmpK(D.k[p],D.k[r]));if(!ids.length)return {none:true,ids};
 const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),fs=o.store?D.sti.get(o.store):undefined,S=new Map(),vars=[];
 const sOf=ti=>{let s=S.get(ti);if(!s){s={ti,on:0,sold:0,last:""};S.set(ti,s)}return s};
 for(const ki of ids){const a=D.q[ki]||[],v={ki,on:0,sold:0,wh:0,br:0};
  for(let j=0;j<a.length;j+=4){const ti=a[j],s=sOf(ti);s.on+=a[j+1];if(!P)s.sold+=a[j+2];if(ti===wh)v.wh+=a[j+1];else v.br+=a[j+1];if(fs===undefined||ti===fs){v.on+=a[j+1];if(!P)v.sold+=a[j+2]}}
  if(P)for(let ti=0;ti<D.st.length;ti++){const x=P.get(ki*1000+ti);if(x){sOf(ti).sold+=x;if(fs===undefined||ti===fs)v.sold+=x}}
  vars.push(v)}
 let whOn=0,allOn=0,allSold=0;S.forEach(s=>{allOn+=s.on;allSold+=s.sold;if(s.ti===wh)whOn+=s.on});
 const R=o.period||o.drange||null;let ret=null,gross=null,days=null,first="",last="";
 if(R){const idset=new Set(ids),ds=new Set();ret=0;gross=0;scan(D,R.from,R.to,(ki,ti,d,n)=>{if(!idset.has(ki))return;if(n>0){const s=sOf(ti);if(d>s.last)s.last=d}if(fs!==undefined&&ti!==fs)return;
   if(n<0)ret-=n;else if(n>0){gross+=n;ds.add(d);if(!first||d<first)first=d;if(d>last)last=d}});days=ds.size}
 const stores=[...S.values()].filter(s=>s.on!==0||s.sold!==0).sort((p,r)=>r.sold-p.sold||r.on-p.on||(D.st[p.ti]<D.st[r.ti]?-1:1));
 const me=fs!==undefined?(S.get(fs)||{ti:fs,on:0,sold:0,last:""}):null,brs=stores.filter(s=>s.ti!==wh);
 const on=me?me.on:allOn,sold=me?me.sold:allSold;
 return {ids,vendor:D.k[ids[0]][3],wh:whOn,br:allOn-whOn,allOn,allSold,on,sold,ret,gross,days,first,last,dated:!!R,dnet:R?gross-ret:null,stores,vars,me,
  nSold:brs.filter(s=>s.sold>0).length,rank:me&&me.ti!==wh&&me.sold>0?brs.filter(s=>s.sold>me.sold).length+1:0,of:brs.filter(s=>s.sold>0).length,share:me&&allSold>0?me.sold/allSold:null,/* الترتيب بين الفروع التي باعت، ولمن باع فقط */thru:sold+Math.max(0,on)>0&&sold>=0?sold/(sold+Math.max(0,on)):null};
}
// مطابقة الملفين: مبيعات الأيام في الفترة = مبيعات ملف الكميات لكل (صنف، فرع)
export function reconcile(D,from,to){
 const m=soldMap(D,from,to),seen=new Set(),diff=[];let pairs=0,same=0,snap=0,daily=0;
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const t={};for(let j=0;j<a.length;j+=4)t[a[j]]=(t[a[j]]||0)+a[j+2];
  for(const x in t){const ti=+x,k=ki*1000+ti,d=m.get(k)||0;seen.add(k);snap+=t[x];daily+=d;if(!t[x]&&!d)continue;pairs++;if(near(t[x],d))same++;else diff.push({ki,ti,snap:t[x],daily:d})}}
 m.forEach((d,k)=>{if(seen.has(k))return;daily+=d;if(!d)return;pairs++;diff.push({ki:Math.floor(k/1000),ti:k%1000,snap:0,daily:d})});
 diff.sort((p,r)=>Math.abs(r.snap-r.daily)-Math.abs(p.snap-p.daily));return {pairs,same,n:diff.length,diff:diff.slice(0,300),snap,daily};
}
// جودة بيانات ملف الكميات: أرصدة سالبة، وصافي مبيعات سالب (مرتجع أكثر من البيع)
export function quality(D){
 const neg=[],ns=[];for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;for(let j=0;j<a.length;j+=4){if(a[j+1]<0)neg.push({ki,ti:a[j],on:a[j+1],sold:a[j+2]});if(a[j+2]<0)ns.push({ki,ti:a[j],on:a[j+1],sold:a[j+2]})}}
 return {neg:neg.sort((p,r)=>p.on-r.on),ns:ns.sort((p,r)=>p.sold-r.sold)};
}

/* ---- (v174) فهم السؤال: قواعد ثابتة، لا تخمين. ما لم يُفهم يُعاد في unk، وما يحتمل أكثر من معنى في amb ---- */
const arDig=s=>s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
export const normAr=s=>arDig(String(s==null?"":s)).toLowerCase().replace(/[ً-ْـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي");
// كلمة بلا «ال» وحروف الجر الملتصقة (بالملقا، للملقا، والملقا ← ملقا)
const bare=w=>w.length>=5?w.replace(/^لل/,"").replace(/^[وفبلك]?ال/,""):w;
const wkey=s=>normAr(s).split(/[\s\-_]+/).filter(Boolean).map(bare).join(" ");
// أسماء عربية معروفة لمخازن التقرير (بأول 3 أرقام من اسم المخزن). ما يضيفه المستخدم من «القواعد» يغلبها
export const ALIAS={"000":["السيرفر","سيرفر"],"001":["المستودع","مستودع","المخزن الرئيسي","warehouse"],"002":["الباحه"],"003":["الملقا","الملقي"],"004":["غرناطه"],"005":["المدار"],"006":["الملك عبدالله","الملك عبد الله","طريق الملك عبدالله"],"007":["الربيع"],"008":["الازدهار"],
 "009":["ظهره لبن","لبن"],"010":["الروابي"],"011":["السعاده","الصدي"],"013":["ابها"],"014":["رافال"],"015":["اونلاين","اون لاين","المتجر الالكتروني"],"016":["ايفنت 1","ايفنت1"],"017":["القصيم"],"018":["قطر"],"019":["العقيق"],"020":["ايفنت 2","ايفنت2"],
 "021":["الحمدانيه"],"022":["حفر الباطن"],"023":["الاحساء","الاحسا","الحسا"],"024":["السامر","جده"],"025":["ايفنت 3","ايفنت3"],"026":["ايفنت 4","ايفنت4"],"027":["حايل"],"028":["خميس مشيط","خميس"],"029":["الاجاويد"],"030":["تبوك"],"031":["الخبر"],"032":["جيزان","جازان"],"033":["السويدي"],"034":["دارين مول","دارين"]};
const ARCOL={"اسود":["black"],"بني":["brown"],"ازرق":["blue"],"اخضر":["green"],"رمادي":["grey","gray"],"رصاصي":["grey","gray"],"ابيض":["white"],"بيج":["beige","beig"],"جملي":["camel"],"كحلي":["navy"],"زيتي":["olive"],"خاكي":["khaki","kakhi","kahki"],"احمر":["red"],"اصفر":["yellow"],"وردي":["pink"],"عنابي":["bordo"],"هافان":["havan"],"قهوي":["coffee"]};
const MONN={};Object.keys(MON).forEach(k=>{MONN[normAr(k)]=MON[k]});
const SKA={"ب":"b","ت":"t","ث":"t","ج":"j","خ":"k","د":"d","ذ":"d","ر":"r","ز":"z","س":"s","ش":"s","ص":"s","ض":"d","ط":"t","ظ":"z","غ":"g","ف":"f","ق":"k","ك":"k","ل":"l","م":"m","ن":"n"};
const skAr=w=>{let o="";for(const c of w)o+=SKA[c]||"";return o.replace(/(.)\1+/g,"$1")};
const skLa=w=>w.toLowerCase().replace(/kh/g,"k").replace(/gh/g,"g").replace(/sh/g,"s").replace(/th/g,"t").replace(/[^a-z]/g,"").replace(/[aeiouyh]/g,"").replace(/[qc]/g,"k").replace(/(.)\1+/g,"$1");
const GEN=new Set(["el","al","z","the"]),GEN1=new Set(["city","mall","plaza","branch","store","shop","king","jed"]);// كلمات عامة لا تدل وحدها على مخزن
let ASKC=null;// جدول العبارات ← المخازن (يُبنى مرة لكل قائمة مخازن وأسماء مضافة)
function askTable(ctx){
 const sig=ctx.stores.join("|")+"#"+(ctx.alias||[]).map(a=>a.k+">"+a.s).join("|");if(ASKC&&ASKC.sig===sig)return ASKC;
 const ph=new Map(),pre=new Map(),sk=new Map(),add=(k,s)=>{if(!k)return;let a=ph.get(k);if(!a){a=[];ph.set(k,a)}if(a.indexOf(s)<0)a.push(s)};
 for(const s of ctx.stores){const m=/^(\d{3})\s*-\s*(.+)$/.exec(s),nm=normAr(m?m[2]:s).replace(/[^a-z0-9؀-ۿ]+/g," ").trim(),ws=nm.split(" ").filter(Boolean);
  if(m)pre.set(m[1],s);const core=ws.filter(w=>!GEN.has(w));if(ws.length>1)add(ws.join(" "),s);if(core.length>1)add(core.join(" "),s);
  for(const w of core){if(GEN1.has(w))continue;if(w.length>=3)add(w,s);const b=w.replace(/\d+$/,"");if(b!==w&&b.length>=3&&!GEN1.has(b))add(b,s)}
  const k=skLa(core.join(""));if(k.length>=3){let a=sk.get(k);if(!a){a=[];sk.set(k,a)}a.push(s)}for(const w of core){const k2=skLa(w);if(k2.length>=3&&k2!==k){let a=sk.get(k2);if(!a){a=[];sk.set(k2,a)}if(a.indexOf(s)<0)a.push(s)}}
  if(m&&ALIAS[m[1]])for(const al of ALIAS[m[1]])add(wkey(al),s)}
 // «ايفنت» وحدها = كل مخازن الإيفنت (يُسأل المستخدم أيها)
 const ev=ctx.stores.filter(s=>/event/i.test(s));ev.forEach(s=>add("ايفنت",s));ev.forEach(s=>add("الايفنت",s));
 const cust=new Map();for(const a of ctx.alias||[]){if(a&&a.k&&a.s&&ctx.stores.indexOf(a.s)>=0)cust.set(wkey(a.k),[a.s])}
 cust.forEach((v,k)=>ph.set(k,v));
 let mx=1;ph.forEach((v,k)=>{const n=k.split(" ").length;if(n>mx)mx=n});
 // اسم المخزن كاملاً كما في التقرير («003-EL MALQA»): كلماته المتتالية
 const full=ctx.stores.map(s=>({s,w:normAr(s).split(/\s+/).filter(Boolean)})).sort((p,r)=>r.w.length-p.w.length);
 ASKC={sig,ph,pre,sk,mx,full};return ASKC;
}
const STW=new Set(["فرع","الفرع","بفرع","لفرع","محل","المحل","مخزن","المخزن","معرض","branch","store","shop"]),CDW=new Set(["كود","الكود","صنف","الصنف","موديل","الموديل","code","item","model","sku"]),SZW=new Set(["مقاس","المقاس","مقاسات","قياس","نمره","size"]);
const UNITS={"يوم":1,"ايام":1,"يوما":1,"day":1,"days":1,"اسبوع":7,"اسابيع":7,"week":7,"weeks":7,"شهر":30,"شهور":30,"اشهر":30,"month":30,"months":30},DUAL={"يومين":2,"اسبوعين":14,"شهرين":60};
const ENSTOP=new Set(["the","in","of","at","for","from","to","and","how","many","much","sold","sales","sale","stock","has","have","did","does","on","hand","qty","quantity","last","this","year","since","until","till","show","me","what","is","was","by","with","between","received","receive"]);
const okDate=(y,m,d)=>y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=new Date(y,m,0).getDate();
const ds=(y,m,d)=>y+"-"+p2(m)+"-"+p2(d);
// سؤال حر ← {kind, store, code, cl, z, per:"ytd"|"c", from, to, amb:{store,code,cl}, unk, rc}
// ctx = {stores:[أسماء المخازن], codes:Map(كود←أصنافه), k:[[كود،لون،مقاس]], alias:[{k,s}], today, end (آخر يوم في البيانات), wh}
export function parseAsk(text,ctx){
 const out={kind:"",store:"",code:"",cl:"",z:"",per:"ytd",from:"",to:"",amb:{store:[],code:[],cl:[]},unk:[],rc:false,txt:String(text||"").slice(0,200)};
 const t=normAr(out.txt).replace(/[،؛؟?!()«»"'`:\[\]{}]|,(?!\d)/g," ").replace(/\s+/g," ").trim();if(!t)return out;
 out.rc=/استلم|مستلم|استلام|وارد|received|receiv/.test(t);
 const W=t.split(" "),U=W.map(()=>false),B=W.map(bare),end=ctx.end||ctx.today,ey=+end.slice(0,4),T=askTable(ctx);
 const isNum=w=>/^\d+$/.test(w);
 /* 1) التواريخ */
 const dts=[];let lastN=0,ytd=false;
 const dayTok=w=>{let m=/^(20\d{2})-(\d{1,2})-(\d{1,2})$/.exec(w);if(m)return okDate(+m[1],+m[2],+m[3])?ds(+m[1],+m[2],+m[3]):"";
  m=/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/.exec(w);if(m){const y=m[3].length===2?2000+(+m[3]):+m[3];return okDate(y,+m[2],+m[1])?ds(y,+m[2],+m[1]):""}
  m=/^(\d{1,2})\/(\d{1,2})$/.exec(w);if(m){let y=ey;if(!okDate(y,+m[2],+m[1]))return "";if(ds(y,+m[2],+m[1])>ctx.today)y--;return okDate(y,+m[2],+m[1])?ds(y,+m[2],+m[1]):""}return ""};
 const monRange=(mo,y)=>{if(!y){y=ey;if(ds(y,mo,1)>ctx.today)y--}return {from:ds(y,mo,1),to:ds(y,mo,new Date(y,mo,0).getDate())}};
 for(let i=0;i<W.length;i++){if(U[i])continue;const w=W[i],nx=W[i+1]||"",n2=W[i+2]||"",pv=W[i-1]||"";
  if(w==="اخر"||w==="last"||w==="past"||w==="اخير"){if(DUAL[nx]){lastN=DUAL[nx];U[i]=U[i+1]=true;continue}if(isNum(nx)&&UNITS[n2]){lastN=Math.min(3660,(+nx)*UNITS[n2]);U[i]=U[i+1]=U[i+2]=true;continue}if(UNITS[nx]){lastN=UNITS[nx];U[i]=U[i+1]=true;continue}}
  if(DUAL[w]&&(pv==="اخر")){lastN=DUAL[w];U[i]=true;continue}
  const d=dayTok(w);if(d){dts.push({i,from:d,to:d,kind:"d"});U[i]=true;continue}
  if((w==="شهر"||w==="month")&&isNum(nx)&&+nx>=1&&+nx<=12){const y=/^20\d{2}$/.test(n2)?+n2:0;dts.push(Object.assign({i,kind:"m"},monRange(+nx,y)));U[i]=U[i+1]=true;if(y)U[i+2]=true;continue}
  if(MONN[w]&&!isNum(w)){const y=/^20\d{2}$/.test(nx)?+nx:0;dts.push(Object.assign({i,kind:"m"},monRange(MONN[w],y)));U[i]=true;if(y)U[i+1]=true;if(pv==="شهر"||pv==="month")U[i-1]=true;continue}
  if(w==="اليوم"||w==="النهارده"||w==="today"){dts.push({i,from:ctx.today,to:ctx.today,kind:"d"});U[i]=true;continue}
  if(w==="امس"||w==="امبارح"||w==="yesterday"){const y=addDays(ctx.today,-1);dts.push({i,from:y,to:y,kind:"d"});U[i]=true;continue}
  if(w==="الشهر"){const prev=/^(اللي|الماضي|السابق|الفايت|فات)$/.test(nx);U[i]=true;if(/^(ده|دا|الحالي|هذا|الجاري|اللي|الماضي|السابق|الفايت)$/.test(nx))U[i+1]=true;if(nx==="اللي"&&n2==="فات")U[i+2]=true;
   const y0=+end.slice(0,4),m0=+end.slice(5,7);if(prev){const pm=m0===1?12:m0-1,py=m0===1?y0-1:y0;dts.push(Object.assign({i,kind:"m"},monRange(pm,py)))}else dts.push({i,kind:"m",from:ds(y0,m0,1),to:end});continue}
  if(w==="السنه"||w==="سنه"||w==="العام"||w==="ytd"||(w==="year"&&pv==="this")){ytd=true;U[i]=true;continue}}
 if(lastN){out.per="c";out.to=end;out.from=addDays(end,-(lastN-1))}
 else if(dts.length>=2){const a=dts[0],b=dts[1];out.per="c";out.from=a.from<b.from?a.from:b.from;out.to=a.to>b.to?a.to:b.to}
 else if(dts.length===1){const a=dts[0],pv=W[a.i-1]||"";out.per="c";out.from=a.from;out.to=a.to;
  if(a.kind==="d"){if(/^(من|منذ|from|since)$/.test(pv))out.to=end>a.from?end:a.from;else if(/^(حتي|لحد|لغايه|الي|to|until|till)$/.test(pv))out.from=a.from.slice(0,4)+"-01-01"}}
 else if(ytd)out.per="ytd";
 if(out.per==="c"&&out.to>end&&out.from<=end&&dts.every(d=>d.kind==="m"))out.to=end;// شهر لم يكتمل: حتى آخر يوم في البيانات
 /* 2) المخازن: أطول عبارة أولاً */
 const lower=new Map();ctx.codes.forEach((v,c)=>{lower.set(String(c).toLowerCase().replace(/\s+/g,""),c)});// الكود بحروف صغيرة وبلا مسافات ← الكود كما في السيستم
 const stores=[],pushSt=a=>{for(const s of a)if(stores.indexOf(s)<0)stores.push(s)},ambSt=[];
 for(const f of T.full)for(let i=0;i+f.w.length<=W.length;i++){let eq=true;for(let j=0;j<f.w.length;j++)if(U[i+j]||W[i+j]!==f.w[j]){eq=false;break}if(!eq)continue;pushSt([f.s]);for(let j=0;j<f.w.length;j++)U[i+j]=true;if(i>0&&STW.has(W[i-1]))U[i-1]=true}
 // «003-» في أول كلمة (اسم مخزن مكتوب ناقصاً): الرقم يكفي
 for(let i=0;i<W.length;i++){if(U[i])continue;const m=/^(\d{3})-[^\d]/.exec(W[i]),s=m?T.pre.get(m[1]):null;if(s&&!lower.has(W[i])){pushSt([s]);U[i]=true}}
 for(let n=Math.min(T.mx,4);n>=1;n--)for(let i=0;i+n<=W.length;i++){let free=true;for(let j=i;j<i+n;j++)if(U[j])free=false;if(!free)continue;
  const k=B.slice(i,i+n).join(" "),k0=W.slice(i,i+n).join(" ");let hit=T.ph.get(k)||T.ph.get(k0);
  if(!hit&&n===1&&W[i].length>=4&&/^[وفبل][؀-ۿ]+$/.test(W[i]))hit=T.ph.get(W[i].slice(1));// بتبوك، لتبوك، وتبوك
  if(!hit)continue;
  if(n===1&&isNum(W[i]))continue;if(n===1&&/^[a-z]+$/.test(W[i])&&ctx.codes.has(W[i].toUpperCase()))continue;
  if(hit.length===1)pushSt(hit);else for(const s of hit)if(ambSt.indexOf(s)<0)ambSt.push(s);for(let j=i;j<i+n;j++)U[j]=true;if(i>0&&STW.has(W[i-1]))U[i-1]=true}
 for(let i=0;i<W.length;i++){if(U[i]||!isNum(W[i])||W[i].length>3)continue;const pv=W[i-1]||"",p=("00"+W[i]).slice(-3),s=T.pre.get(p);if(!s)continue;
  if(STW.has(pv)){pushSt([s]);U[i]=U[i-1]=true}else if(W[i].length===3&&!CDW.has(pv)){if(lower.has(W[i])){if(ambSt.indexOf(s)<0)ambSt.push(s)}else{pushSt([s]);U[i]=true}}}
 // اسم بعد كلمة «فرع» لم يُعرف: اقتراح بالهيكل الصوتي (اقتراح فقط، لا يُعتمد وحده)
 for(let i=1;i<W.length;i++){if(U[i]||!STW.has(W[i-1])||!/[؀-ۿ]/.test(W[i]))continue;const k=skAr(B[i]),hit=k.length>=3?T.sk.get(k):null;U[i]=U[i-1]=true;
  if(hit){for(const s of hit)if(ambSt.indexOf(s)<0)ambSt.push(s)}else out.unk.push(W[i])}
 if(stores.length){out.store=stores[0];out.amb.store=stores.length>1?stores.slice():[]}else if(ambSt.length)out.amb.store=ambSt.slice(0,8);
 if(stores.length&&ambSt.length)for(const s of ambSt)if(out.amb.store.indexOf(s)<0&&s!==out.store){if(!out.amb.store.length)out.amb.store.push(out.store);out.amb.store.push(s)}
 /* 3) الأكواد: مطابقة تامة (حتى 3 كلمات متتالية للأكواد التي فيها مسافات مثل «31001 - T») */
 const codes=[];
 for(let n=3;n>=1;n--)for(let i=0;i+n<=W.length;i++){let free=true;for(let j=i;j<i+n;j++)if(U[j])free=false;if(!free)continue;const c=lower.get(W.slice(i,i+n).join(""));if(!c)continue;
  if(n>1&&!/\s/.test(c))continue;// ضمّ كلمتين لا يُقبل إلا لكود مكتوب في السيستم بمسافات (فلا يُركَّب كود من رقمين متجاورين)
  if(n===1&&W[i].length<3&&!CDW.has(W[i-1]||""))continue;if(codes.indexOf(c)<0)codes.push(c);for(let j=i;j<i+n;j++)U[j]=true}
 for(let i=0;i<W.length;i++)if(!U[i]&&/^20\d{2}$/.test(W[i])&&!lower.has(W[i]))U[i]=true;// سنة مكتوبة وحدها
 if(!codes.length)for(let i=0;i<W.length;i++){if(U[i]||!isNum(W[i]))continue;const pv=W[i-1]||"";
  if(CDW.has(pv)&&W[i].length<5){const c=lower.get(("00000"+W[i]).slice(-5));if(c){codes.push(c);U[i]=true;continue}}
  if(W[i].length>=3){const sug=[],pad=W[i].length<5?("00000"+W[i]).slice(-5):"";lower.forEach((c,k)=>{if(sug.length<8&&(k.indexOf(W[i])===0||(pad&&k===pad)))sug.push(c)});if(sug.length){out.amb.code=sug;U[i]=true}}}
 if(codes.length){out.code=codes[0];if(codes.length>1)out.amb.code=codes.slice()}
 /* 4) اللون والمقاس: من ألوان ومقاسات هذا الكود فقط */
 if(out.code){const ids=ctx.codes.get(out.code)||[],cols=[],szs=[];for(const ki of ids){const x=ctx.k[ki];if(cols.indexOf(x[1])<0)cols.push(x[1])}
  const cl=new Map();cols.forEach(c=>{if(c)cl.set(normAr(c).replace(/\s+/g," ").trim(),c)});
  for(let n=3;n>=1&&!out.cl;n--)for(let i=0;i+n<=W.length;i++){let free=true;for(let j=i;j<i+n;j++)if(U[j])free=false;if(!free)continue;const c=cl.get(W.slice(i,i+n).join(" "));if(c){out.cl=c;for(let j=i;j<i+n;j++)U[j]=true;break}}
  if(!out.cl)for(let i=0;i<W.length;i++){if(U[i])continue;const en=ARCOL[B[i]]||ARCOL[W[i]];if(!en)continue;const hit=cols.filter(c=>en.indexOf(normAr(c).trim())>=0);U[i]=true;if(hit.length===1)out.cl=hit[0];else if(hit.length>1)out.amb.cl=hit;else out.unk.push(W[i]);break}
  for(const ki of ids){const x=ctx.k[ki];if((!out.cl||x[1]===out.cl)&&szs.indexOf(x[2])<0)szs.push(x[2])}
  const sz=new Map();szs.forEach(z=>{if(z)sz.set(normAr(z).replace(/\s+/g,""),z)});
  for(let i=0;i<W.length&&!out.z;i++){if(U[i])continue;const z=sz.get(W[i])||(W[i+1]&&!U[i+1]?sz.get(W[i]+W[i+1]):undefined);if(!z)continue;if(/^[a-z]+$/.test(W[i])&&!SZW.has(W[i-1]||""))continue;out.z=z;U[i]=true;if(!sz.get(W[i]))U[i+1]=true}}
 /* 5) ما لم يُفهم: الكلمات التي فيها أرقام أو حروف لاتينية فقط (الكلمات العربية الباقية حشو السؤال) */
 for(let i=0;i<W.length;i++){if(U[i])continue;const w=W[i];if(/[a-z0-9]/.test(w)&&!ENSTOP.has(w)&&!STW.has(w)&&!CDW.has(w)&&!SZW.has(w)&&!UNITS[w]&&out.unk.indexOf(w)<0)out.unk.push(w)}
 out.kind=out.code&&out.store?"cs":out.code?"c":out.store?"s":"";return out;
}
const near=(a,b)=>Math.abs(N(a)-N(b))<1e-6;
const dim=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();// عدد أيام الشهر
// يضيف مدى أيام [a,b] إلى قائمة مدى الشهر ويدمج المتلاصق (حتى 8 مدى)
export const cvAdd=(list,a,b)=>{const L=(list||[]).filter(r=>Array.isArray(r)&&r.length===2).map(r=>[N(r[0]),N(r[1])]);if(a>=1&&b>=a)L.push([a,b]);L.sort((p,r)=>p[0]-r[0]);const o=[];for(const r of L){const l=o[o.length-1];if(l&&r[0]<=l[1]+1)l[1]=Math.max(l[1],r[1]);else o.push([r[0],r[1]])}return o.slice(0,8)};
// تغطية ملفات التاريخ لفترة: الشهور الناقصة كلها، والأيام الناقصة داخل شهر مرفوع. approx = شهر رُفع قبل v174 (بلا مدى محفوظ) فيُقدَّر من أول وآخر يوم فيه بيع
export function coverage(M,P){
 const out={mon:[],days:[],approx:false,ok:true};if(!P)return out;const d=M&&M.d?M.d:{};
 for(const ym of months(P.from,P.to)){const a=P.from.slice(0,7)===ym?+P.from.slice(8):1,b=P.to.slice(0,7)===ym?+P.to.slice(8):dim(ym),x=d[ym];if(!x){out.mon.push(ym);continue}
  let cv=x.cv;if(!Array.isArray(cv)||!cv.length){cv=[[N(x.dmin)||1,N(x.dmax)||dim(ym)]];out.approx=true}
  let c=a;for(const r of cvAdd(cv,0,0)){if(r[1]<c)continue;if(r[0]>b)break;if(r[0]>c)out.days.push([ymd(ym,c),ymd(ym,Math.min(b,r[0]-1))]);c=Math.max(c,r[1]+1);if(c>b)break}
  if(c<=b)out.days.push([ymd(ym,c),ymd(ym,b)])}
 out.ok=!out.mon.length&&!out.days.length;return out;
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
  await loadPub();
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
 const meta=Object.assign({v:1},META||{},{at:Date.now(),by:by(),q:{at:Date.now(),parts:P.length,rows:R.n,skus:R.k.length,sold:R.sum.sold,on:R.sum.on,from:R.from||"",to:R.to||"",src:String(src||"").slice(0,120),chk:R.tot.sold!==undefined?1:0}});if(!meta.d)meta.d={};
 b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=meta;
 DATA=newData();loadQ(DATA,{st:R.st,vn:R.vn,k:R.k,rv:1,vs:R.vs||[],r:[...R.q].map(e=>[e[0]].concat(e[1]))});SOLDC={};// شهور التاريخ تُحمَّل من جديد عند الطلب (على القاموس الجديد)
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
  // الأيام التي يغطيها ما رُفع لهذا الشهر (من فترة ذيل الملف؛ وبلا ذيل: من أول يوم إلى آخر يوم فيه)، مدموجة مع ما سبق
  let ca,cb;if(R.from){ca=from.slice(0,7)===ym?+from.slice(8):1;cb=to.slice(0,7)===ym?+to.slice(8):dim(ym)}else{const ds=R.days.filter(d=>d.slice(0,7)===ym);ca=ds.length?+ds[0].slice(8):0;cb=ds.length?+ds[ds.length-1].slice(8):0}
  const pm=META&&META.d&&META.d[ym],cv=cvAdd(pm?(Array.isArray(pm.cv)&&pm.cv.length?pm.cv:[[N(pm.dmin)||1,N(pm.dmax)||1]]):[],ca,cb);
  const b=fb.writeBatch(X.db),oldP=META&&META.d&&META.d[ym]?Math.max(1,N(META.d[ym].parts)):0;
  if(!r.length){for(let i=0;i<oldP;i++)b.delete(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym));delete meta.d[ym];delete DATA.d[ym]}
  else{const P=parts(await gz(JSON.stringify(monthDoc(DATA,ym))));if(P.length>10)throw new Error("big");P.forEach((p,i)=>b.set(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<oldP;i++)b.delete(fb.doc(X.db,"stk","d"+ym+"_"+i));
   meta.d[ym]={n:r.length/5,parts:P.length,sold,dmin,dmax,cv,at:Date.now()}}
  meta.at=Date.now();meta.by=by();b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=Object.assign({},meta)}
 SOLDC={};return all.length;
}
// 📤 (v179) النشر للفروع (stkpub): الأجزاء والفروع أولاً ثم meta (الفرع يقرأ meta ويتجاهل أي جزء رقمه مختلف = نشر لم يكتمل)
let PUB=null,PUBBUSY=false;
async function loadPub(){try{const fb=await FB();const s=await fb.getDoc(fb.doc(X.db,"stkpub","meta"));PUB=s.exists()?s.data():null}catch(e){PUB=null}}
async function publish(quiet){
 if(!DATA||!DATA.has||PUBBUSY||!X)return false;PUBBUSY=true;if(!quiet){BUSY="جاري النشر للفروع…";paint()}
 try{const fb=await FB(),P=pubData(DATA,CFG),v=Date.now(),to=META&&META.q&&META.q.to?String(META.q.to).slice(0,12):"";
  if(!PUB)await loadPub();const oldP=PUB?N(PUB.parts):0;
  for(let i=0;i<P.parts.length;i++)await fb.setDoc(fb.doc(X.db,"stkpub","a"+i),{v,c:P.parts[i]});
  const codes=Object.keys(P.br);for(let i=0;i<codes.length;i+=12){const b=fb.writeBatch(X.db);codes.slice(i,i+12).forEach(c=>b.set(fb.doc(X.db,"stkpub","b"+c),{v,at:v,to,l:P.br[c]}));await b.commit()}
  const meta={v,at:v,to,parts:P.parts.length,n:P.n,by:by().e};await fb.setDoc(fb.doc(X.db,"stkpub","meta"),meta);PUB=meta;
  for(let i=P.parts.length;i<oldP;i++)try{const b=fb.writeBatch(X.db);b.delete(fb.doc(X.db,"stkpub","a"+i));await b.commit()}catch(e){}
  if(!quiet&&X.toast)X.toast("📤 نُشر للفروع ✅");return true}
 catch(e){if(X.toast)X.toast(e&&e.code==="permission-denied"?"تعذّر النشر للفروع: الصق القواعد الجديدة في Supabase":"تعذّر النشر للفروع، حاول مرة أخرى");return false}
 finally{PUBBUSY=false;if(!quiet){BUSY="";paint()}}
}
async function onFiles(files){
 if(BUSY||!files||!files.length)return;REP=[];UI.rec=null;
 if(typeof CompressionStream==="undefined"||typeof DecompressionStream==="undefined"){REP=[{kind:"r",t:"هذا المتصفح قديم ولا يستطيع قراءة ملفات الإكسل هنا. استخدم Chrome أو Edge حديثاً."}];paint();return}
 for(const f of [...files]){const nm=String(f.name||"ملف");
  try{BUSY="جاري قراءة "+nm+"…";paint();let last=0;const R=await readFile(f,p=>{const pc=Math.round(p*100);if(pc-last>=4){last=pc;const e=g("stk-pg");if(e)e.textContent=pc+"%"}});
   if(!R.ok){REP.push({kind:"r",f:nm,t:"لم نتعرّف على أعمدة هذا الملف. المطلوب: DESCRIPTION2 و Store Name و SOLD_QTY، ومعها OH_QTY (ملف الكميات) أو أعمدة التاريخ (ملف التاريخ)."});continue}
   const chk=R.tot.sold!==undefined?" · المجموع مطابق لسطر الإجمالي":"";
   // 🛡 (v174) لا يُحفظ ملف فيه خانة كمية غير رقمية، ولا ملف مجموع صفوفه يخالف سطر الإجمالي (المقطوع له رسالته الخاصة تحت)
   if(R.nan){REP.push({kind:"r",f:nm,t:"في الملف "+R.nan+" خانة كمية ليست رقماً، فلم يُحفظ. تأكد أن أعمدة الكميات أرقام ثم أعد تنزيل التقرير."});continue}
   if(!R.trunc&&R.tot.sold!==undefined&&(!near(R.tot.sold,R.sum.sold)||(R.type==="q"&&R.tot.on!==undefined&&!near(R.tot.on,R.sum.on)))){
    REP.push({kind:"r",f:nm,t:"مجموع الصفوف لا يطابق سطر الإجمالي في الملف (المبيعات "+R.sum.sold+" والإجمالي "+R.tot.sold+(R.type==="q"&&R.tot.on!==undefined?"، الرصيد "+R.sum.on+" والإجمالي "+R.tot.on:"")+")، فلم يُحفظ حتى لا تُبنى الأرقام على ملف ناقص. أعد تنزيل التقرير."});continue}
   if(R.tot.sold===undefined)REP.push({kind:"w",f:nm,t:"لا يوجد سطر إجمالي في هذا الملف، فلم تُراجَع مجاميعه."});
   if(R.type==="q"){if(R.trunc){REP.push({kind:"r",f:nm,t:"ملف الكميات مقطوع من Power BI (أكثر من 150 ألف سطر)، فلم يُحفظ. نزّله بلا أعمدة زائدة أو على مجموعتين من الفروع."});continue}
    BUSY="جاري حفظ الكميات…";paint();await saveQ(R,nm);BUSY="جاري النشر للفروع…";paint();const pubOk=await publish(true);REP.push({kind:pubOk?"g":"w",f:nm,t:pubOk?"📤 نُشر للفروع: المتوفر في المستودع والطلب المقترح لكل فرع.":"لم يُنشر للفروع (الصق القواعد الجديدة ثم اضغط «انشر للفروع الآن»)."});REP.push({kind:"g",f:nm,t:"ملف الكميات: "+R.n+" سطر · "+R.k.length+" صنف · "+R.st.length+" مخزن · الرصيد "+R.sum.on+" · المبيعات "+R.sum.sold+chk})}
   else{if(R.trunc){const cov=R.tot.sold?Math.round(R.sum.sold/R.tot.sold*100):0;
     REP.push({kind:"r",f:nm,t:"ملف التاريخ مقطوع من Power BI عند 150 ألف سطر"+(cov?" (يحتوي على "+cov+"% فقط من مبيعات الفترة)":"")+"، فلم يُحفظ. نزّله على فترات أقصر (شهر أو شهرين في كل ملف) وارفع الملفات كلها: المنصة تجمعها، وكل ملف يستبدل أيام فترته فقط."});continue}
    BUSY="جاري حفظ مبيعات الأيام…";paint();const n=await saveD(R);REP.push({kind:"g",f:nm,t:"ملف التاريخ: "+R.n+" سطر · "+R.days.length+" يوماً"+(R.from?" · الفترة من "+R.from+" إلى "+addDays(R.to,-1):"")+" · "+n+" شهر محدَّث · المبيعات "+R.sum.sold+chk})}
   if(R.bad)REP.push({kind:"w",f:nm,t:R.bad+" سطر تُرك لنقص الكود أو التاريخ."})}
  catch(e){const c=e&&(e.code||e.message)||"";REP.push({kind:"r",f:nm,t:c==="notzip"?"الملف ليس xlsx ولا csv صالحاً.":c==="permission-denied"?"غير مسموح بالحفظ. تأكد من لصق القواعد الجديدة في Supabase.":c==="big"?"الملف أكبر من المسموح بتخزينه.":"تعذّرت قراءة الملف أو حفظه ("+String(c).slice(0,60)+")."})}}
 BUSY="";if(DATA&&DATA.has&&!REP.some(r=>r.kind==="r"))UI.tab="up";paint();
}
async function saveCfg(){try{const fb=await FB();const c={min:N(CFG.min),keep:N(CFG.keep),slow:N(CFG.slow),days:N(CFG.days),stale:N(CFG.stale),ex:(CFG.ex||[]).slice(0,40),wh:String(CFG.wh||DEF.wh),ov:(CFG.ov||[]).slice(0,60),at:Date.now(),by:by().e};
  await fb.setDoc(fb.doc(X.db,"stk","cfg"),c);if(X.toast)X.toast("تم حفظ القواعد ✅");if(DATA&&DATA.has)publish(true)}catch(e){if(X.toast)X.toast("تعذّر حفظ القواعد")}}

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
.stk-askb{display:flex;gap:8px;margin:10px 0 4px}.stk-askb input{flex:1;min-width:0;height:50px;font-size:16.5px;margin:0}.stk-askb .bt{height:50px;padding:0 24px;font-size:16px}
.stk-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.stk-chips i{font-style:normal;color:var(--mut);font-size:12.5px;margin-inline-end:2px}.stk-chips button{border:1.5px solid var(--line);background:var(--soft);color:var(--ink);border-radius:999px;padding:4px 13px;font:inherit;font-size:13.5px;cursor:pointer;min-height:34px;unicode-bidi:plaintext}.stk-chips button:hover{border-color:var(--acc)}
.stk-ask{margin:0 0 12px}.stk-und .stk-undt{flex:1 1 100%;font-size:13px;color:var(--mut);font-weight:600}
.stk-ttl{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:6px 4px 10px}.stk-ttl h3{margin:0;font-size:21px}.stk-ttl small{color:var(--mut);font-size:13.5px}
.stk-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;margin:0 0 12px}.stk-tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0}
.stk-tile b{font-size:25px;line-height:1.2;font-variant-numeric:tabular-nums}.stk-tile span{color:var(--mut);font-size:12.5px;line-height:1.5}.stk-tile.dt b{font-size:18px;white-space:nowrap;line-height:1.7}.stk-tile.k{border-color:var(--acc)}.stk-tile.k b{color:var(--acc)}.stk-tile.bad b{color:#c4362b}
.stk-tile.go{cursor:pointer;background:var(--soft)}.stk-tile.go:hover{border-color:var(--acc)}.stk-tile.go span::after{content:" ‹";font-weight:800}
.stk-act{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.stk-src{color:var(--mut);font-size:12.5px;line-height:1.9;margin:12px 4px 0}.stk-ph{margin:8px 10px 6px;font-size:16px}.stk-t td.n{direction:ltr}
:where([data-theme=dark]) .stk-tile.bad b{color:#f1a5a0}
@media (max-width:760px){.stk-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.stk-tile b{font-size:21px}.stk-askb .bt{padding:0 16px}}
.stk-busy{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--acc);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-weight:700}.stk-busy::before{content:"";width:16px;height:16px;border:2.5px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:ui-spin .7s linear infinite}
:where([data-theme=dark]) .stk-tabs button.on{color:#141015}:where([data-theme=dark]) .stk-rep.r,:where([data-theme=dark]) .stk-mx td.need{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .stk-rep.w,:where([data-theme=dark]) .stk-mx td.idle{background:#3a2a08;color:#f6c770}:where([data-theme=dark]) .stk-t .z{color:#f1a5a0}:where([data-theme=dark]) .stk-t .no{color:#f6c770}
@media (max-width:760px){.stk-up{grid-template-columns:1fr}.stk-bar label{flex:1 1 calc(50% - 4px)}.stk-bar select,.stk-bar input,.stk-bar input[type=number],.stk-bar input[type=search],.stk-bar input[type=text]{width:100%}.stk-bar .sp{display:none}.stk-bar .bt{flex:1 1 calc(50% - 4px)}}
@media print{.stk-tabs,.stk-bar,.stk-drop,.stk-more{display:none!important}}`;
const TABS=[["ask","💬","اسأل"],["need","🧺","نواقص الفروع"],["tr","🔄","تحويلات مقترحة"],["item","🔍","تحليل صنف"],["sales","📅","مبيعات بالتاريخ"],["stale","💤","الراكد"],["up","⬆️","الملفات"],["cfg","⚙","القواعد"]];
const fmt=n=>String(Math.round(N(n))).replace(/\B(?=(\d{3})+(?!\d))/g,",");
const dts=t=>{if(!t)return "";const d=new Date(N(t));return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+" "+p2(d.getHours())+":"+p2(d.getMinutes())};
// ‎ قبل النص: اسم المخزن «003-EL MALQA» يُعرض بترتيبه داخل قائمة عربية (كان يظهر «EL MALQA-003»)
const opt=(arr,cur,all)=>`<option value="">${all}</option>`+arr.map(v=>`<option data-notr value="${E(v)}"${v===cur?" selected":""}>‎${E(v)}</option>`).join("");
const stores=noWh=>DATA.st.filter(s=>(!noWh||s!==CFG.wh)).slice().sort();
const vendors=()=>DATA.vn.filter(Boolean).slice().sort();
// الفترة المختارة ← {from,to} أو null (من أول السنة = مبيعات ملف الكميات)
function period(){
 if(UI.per==="ytd")return null;const end=qEnd();
 if(UI.per==="c")return UI.from&&UI.to&&UI.from<=UI.to?{from:UI.from,to:UI.to}:null;
 return {from:addDays(end,-(N(UI.per)-1)),to:end};
}
const dHas=()=>!!(META&&META.d&&Object.keys(META.d).length);
// آخر يوم في بيانات ملف الكميات (فترة ذيله تنتهي «قبل» يوم التنزيل)
const qEnd=()=>META&&META.q&&META.q.to?addDays(META.q.to,-1):today();
// مدى ملف الكميات كله (من أول السنة حتى آخر يوم فيه): لحساب أيام البيع وللمطابقة
const fullR=()=>META&&META.q&&META.q.from?{from:META.q.from,to:qEnd()}:null;
const perSel=()=>`<label>مبيعات الفترة<select data-sf="per" id="stk-per"><option value="ytd"${UI.per==="ytd"?" selected":""}>من أول السنة</option>${dHas()?[["30","آخر 30 يوماً"],["60","آخر 60 يوماً"],["90","آخر 90 يوماً"],["c","فترة أحددها"]].map(a=>`<option value="${a[0]}"${UI.per===a[0]?" selected":""}>${a[1]}</option>`).join(""):""}</select></label>${UI.per==="c"?`<label>من<input type="date" data-sf="from" id="stk-from" value="${E(UI.from)}"></label><label>إلى<input type="date" data-sf="to" id="stk-to" value="${E(UI.to)}"></label>`:""}`;
// تحذير ظاهر لو ملفات التاريخ لا تغطي الفترة كلها (بالشهر وباليوم): الرقم المعروض ناقص بقدرها
const gapNote=P=>{if(!P)return "";const c=coverage(META,P);if(c.ok)return "";const rg=r=>r[0]===r[1]?r[0]:r[0]+" ← "+r[1];
 return `<div class="stk-rep w">⚠️ ملفات التاريخ لا تغطي هذه الفترة كلها، فالمبيعات المعروضة أقل من الحقيقة بقدر الناقص.${c.mon.length?` شهور غير مرفوعة: <b data-notr>${E(c.mon.join(" · "))}</b>.`:""}${c.days.length?` أيام غير مرفوعة: <b data-notr>${E(c.days.slice(0,6).map(rg).join(" · "))}${c.days.length>6?" …":""}</b>${c.approx?" (تقدير: بعض الشهور رُفعت قبل هذا التحديث)":""}.`:""} ارفع ملف التاريخ لها من تبويب «الملفات».</div>`};
const sn=ti=>`<bdi dir="ltr" data-notr>${E(DATA.st[ti])}</bdi>`;
const kCells=ki=>{const x=DATA.k[ki];return `<td class="c" data-notr><a href="#" data-sk="code" data-c="${E(x[0])}" style="color:inherit">${E(x[0])}</a></td><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td>`};
const more=n=>n>UI.lim?`<button class="bt stk-more" type="button" data-sk="more">عرض المزيد (${fmt(n-UI.lim)} سطر آخر)</button>`:"";
let LASTX=null;// آخر نتيجة معروضة (للتصدير)
function vNeed(){
 const P=period(),L=shortages(DATA,CFG,{store:UI.st,vendor:UI.vn,q:UI.q,sold:UI.sold,min:UI.min,period:P});
 L.sort((a,b)=>a.ti!==b.ti?(DATA.st[a.ti]<DATA.st[b.ti]?-1:1):cmpK(DATA.k[a.ki],DATA.k[b.ki]));
 const give=L.reduce((s,l)=>s+l.give,0),need=L.reduce((s,l)=>s+l.need,0),nb=new Set(L.map(l=>l.ti)).size;
 LASTX={name:"نواقص-الفروع",head:["الفرع","الكود","اللون","المقاس","المورد","رصيد الفرع","المبيعات","رصيد المستودع","المطلوب","المقترح من المستودع"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.vi>=0?DATA.vn[l.vi]:"",l.on,l.sold,l.wh,l.need,l.give]})};
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
 LASTX={name:"الراكد",head:["الفرع","الكود","اللون","المقاس","المورد","الرصيد","المبيعات"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.vi>=0?DATA.vn[l.vi]:"",l.on,l.sold]})};
 return `<div class="stk-bar"><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(1),UI.st,"كل الفروع")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>الرصيد من<input type="number" min="1" max="9999" data-sf="son" id="stk-son" value="${E(UI.son)}" placeholder="${E(CFG.stale)}"></label>${perSel()}<span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>سطر راكد</span><span><b>${fmt(L.reduce((s,l)=>s+l.on,0))}</b>قطعة</span></div>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr>${UI.st?"":"<th>الفرع</th>"}<th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">الرصيد</th><th class="n">المبيعات</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr>${UI.st?"":`<td>${sn(l.ti)}</td>`}${kCells(l.ki)}<td class="n"><b>${l.on}</b></td><td class="n">${l.sold}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا أصناف راكدة بهذه الشروط.</div></div>`}`;
}
// (v174) فحص المطابقة: يحمّل شهور السنة ثم يقارن مبيعات الأيام بمبيعات ملف الكميات لكل (صنف، فرع)
async function doRecon(){
 const R=fullR();if(!R||!DATA||!DATA.has||BUSY)return;const c=coverage(META,R);if(!c.ok){UI.rec={cov:c};paint();return}
 await needMonths(R.from,R.to);if(months(R.from,R.to).some(ym=>META.d[ym]&&!(DATA.d[ym]&&DATA.d[ym].length))){UI.rec={err:1};paint();return}
 UI.rec=Object.assign({at:Date.now(),from:R.from,to:R.to},reconcile(DATA,R.from,R.to));paint();
}
// تصدير قوائم خارج الجدول المعروض (فروق المطابقة، الأرصدة السالبة، صافي المبيعات السالب)
function xOther(k){
 const kk=l=>{const x=DATA.k[l.ki]||["","",""];return [DATA.st[l.ti],x[0],x[1],x[2]]};
 if(k==="rec")return UI.rec&&UI.rec.diff?{name:"فروق-المطابقة",head:["الفرع","الكود","اللون","المقاس","ملف الكميات","ملفات التاريخ","الفرق"],rows:()=>UI.rec.diff.map(l=>kk(l).concat([l.snap,l.daily,l.daily-l.snap]))}:null;
 const Q=quality(DATA),L=k==="neg"?Q.neg:Q.ns;return {name:k==="neg"?"أرصدة-سالبة":"صافي-مبيعات-سالب",head:["الفرع","الكود","اللون","المقاس","الرصيد","المبيعات"],rows:()=>L.map(l=>kk(l).concat([l.on,l.sold]))};
}
function recHtml(){
 const r=UI.rec;if(!r)return "";
 if(r.cov){const c=r.cov,rg=x=>x[0]===x[1]?x[0]:x[0]+" ← "+x[1];return `<div class="stk-rep w">المطابقة غير ممكنة بعد: ملفات التاريخ لا تغطي فترة ملف الكميات كلها.${c.mon.length?` شهور غير مرفوعة: <b data-notr>${E(c.mon.join(" · "))}</b>.`:""}${c.days.length?` أيام غير مرفوعة: <b data-notr>${E(c.days.slice(0,6).map(rg).join(" · "))}</b>.`:""}</div>`}
 if(r.err)return `<div class="stk-rep r">تعذّر تحميل بعض شهور ملفات التاريخ. تأكد من الإنترنت ثم أعد الفحص.</div>`;
 const per=`<span data-notr dir="ltr">${E(r.from)}</span> ← <span data-notr dir="ltr">${E(r.to)}</span>`;
 if(!r.n)return `<div class="stk-rep g">✅ مطابق تماماً: <b data-notr>${fmt(r.pairs)}</b> خانة (صنف × فرع) متساوية في الملفين، ومجموع المبيعات <b data-notr>${fmt(r.snap)}</b> قطعة. الفترة ${per}</div>`;
 return `<div class="stk-rep r">❌ <b data-notr>${fmt(r.n)}</b> خانة مختلفة من <b data-notr>${fmt(r.pairs)}</b>. مجموع ملف الكميات <b data-notr>${fmt(r.snap)}</b> ومجموع ملفات التاريخ <b data-notr>${fmt(r.daily)}</b>. الفترة ${per}. السبب المعتاد: تنزيل الملفين في وقتين مختلفين، أو ملف تاريخ لا يشمل كل الفروع.</div>
 <div class="tw"><table class="stk-t"><thead><tr><th>الفرع</th><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">ملف الكميات</th><th class="n">ملفات التاريخ</th></tr></thead><tbody>${r.diff.slice(0,25).map(l=>`<tr><td>${sn(l.ti)}</td>${kCells(l.ki)}<td class="n">${fmt(l.snap)}</td><td class="n z">${fmt(l.daily)}</td></tr>`).join("")}</tbody></table></div><button class="bt s" type="button" data-sk="recx" style="margin-top:8px">⬇️ إكسل (أكبر 300 فرق)</button>`;
}
function vUp(){
 const q=META&&META.q,d=META&&META.d?META.d:{},yms=Object.keys(d).sort(),dsold=yms.reduce((s,ym)=>s+N(d[ym].sold),0),cov=q&&N(q.sold)?Math.round(dsold/N(q.sold)*100):0;
 const need=q&&q.from&&q.to?months(q.from,addDays(q.to,-1)):yms;
 const has=DATA&&DATA.has,FR=fullR(),Q=has?quality(DATA):null;
 const chk=has?`<div class="stk-up"><div class="stk-card"><h3>فحص المطابقة بين الملفين</h3><p>يتأكد أن مبيعات الأيام في ملفات التاريخ تساوي مبيعات ملف الكميات لكل صنف في كل فرع، فتطمئن أن الملفين كاملان ومن نفس اللحظة.</p>${!FR?`<p>يحتاج ملف كميات فيه فترة التقرير في آخره.</p>`:!yms.length?`<p>ارفع ملفات التاريخ أولاً.</p>`:`<button class="bt p" type="button" data-sk="recon">افحص الآن</button>`}<div style="margin-top:10px">${recHtml()}</div></div>
 <div class="stk-card"><h3>أرقام تحتاج مراجعة في السيستم</h3><p>جاءت من تقرير السيستم كما هي، وتدخل في الحساب كما هي. تُعرض هنا لتُراجَع هناك.</p>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">أصناف رصيدها سالب</span><b data-notr>${fmt(Q.neg.length)}</b>${Q.neg.length?`<button class="bt s" type="button" data-sk="qx" data-k="neg">⬇️ إكسل</button>`:""}</div>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">أصناف مرتجعها أكثر من بيعها</span><b data-notr>${fmt(Q.ns.length)}</b>${Q.ns.length?`<button class="bt s" type="button" data-sk="qx" data-k="ns">⬇️ إكسل</button>`:""}</div>
 <p style="margin-top:10px">عمود «المستلم» (<span data-notr>RCVD_QTY</span>) في التقرير ليس استلام الفرع: رقم واحد يتكرر على كل الفروع، فلا يُستخدم في أي حساب هنا.</p></div></div>`:"";
 const pub=has?`<div class="stk-card"><h3>📤 النشر للفروع</h3><p>تشاهد الفروع وهي تكتب ورقة النواقص هل الصنف «متوفر» أو «كمية قليلة» أو «غير متوفر» في المستودع (بلا أرقام)، ولكل فرع «طلب مقترح» بالأصناف التي رصيده منها أقل من الحد وكانت تُباع عنده. يُنشر تلقائياً مع كل ملف كميات ومع حفظ القواعد.</p>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">آخر نشر</span><b data-notr>${PUB&&PUB.at?E(new Date(N(PUB.at)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):"لم يُنشر بعد"}</b></div>
 <button class="bt p" type="button" data-sk="pub" style="margin-top:8px">📤 انشر للفروع الآن</button></div>`:"";
 return `${pub}<label class="stk-drop" id="stk-drop"><input type="file" id="stk-file" accept=".xlsx,.csv" multiple><b>⬆️ ارفع ملفات اليوم</b><small>اختر ملف الكميات وملف التاريخ معاً (أو اسحبهما هنا). المنصة تتعرّف على كل ملف من أعمدته وتربط بينهما.</small></label>
 ${REP.map(r=>`<div class="stk-rep ${r.kind==="g"?"g":r.kind==="w"?"w":"r"}">${r.f?`<b data-notr>${E(r.f)}</b> — `:""}${E(r.t)}</div>`).join("")}
 <div class="stk-up"><div class="stk-card"><h3>📦 ملف الكميات</h3>${q?`<p>آخر رفع: <b data-notr dir="ltr">${dts(q.at)}</b>${q.src?` · <span data-notr>${E(q.src)}</span>`:""}</p><p>${fmt(q.rows)} سطر · ${fmt(q.skus)} صنف (كود ولون ومقاس)</p><p>الرصيد ${fmt(q.on)} قطعة · المبيعات ${fmt(q.sold)} قطعة${q.from?` · من <span data-notr dir="ltr">${E(q.from)}</span> إلى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه <b data-notr>OH_QTY</b> (الكمية) بلا تاريخ.</p>`}</div>
 <div class="stk-card"><h3>📅 ملف التاريخ</h3>${yms.length?`<p>${yms.length} شهر محفوظ · ${fmt(dsold)} قطعة مباعة${q?` · يغطي <b>${cov}%</b> من مبيعات ملف الكميات`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه السنة والشهر واليوم بلا كمية.</p>`}
 <div class="stk-mo">${need.map(ym=>d[ym]?`<span data-notr title="${fmt(d[ym].n)} · ${N(d[ym].dmin)}–${N(d[ym].dmax)}">${ym} ✓</span>`:`<span class="x" data-notr>${ym}</span>`).join("")}</div>
 <p style="margin-top:10px">Power BI يقطع التصدير عند 150 ألف سطر. نزّل ملف التاريخ على فترات (شهر أو شهرين) وارفعها كلها مرة واحدة للتأسيس، ثم يكفي كل يوم ملف الشهر الحالي: كل ملف يستبدل أيام فترته فقط.</p></div></div>${chk}`;
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
 <div style="margin-top:8px">${(CFG.ov||[]).map((o,i)=>o.t==="a"?"":`<div class="stk-day"><span style="width:auto" data-notr>${o.t==="c"?"كود":"مورد"}: ${E(o.k)}</span><b>أقل من ${N(o.min)}</b><button class="bt s" type="button" data-sk="ovx" data-i="${i}">حذف</button></div>`).join("")||`<small>لا حدود خاصة.</small>`}</div>
 <div class="stk-bar" style="margin-top:10px;border:0;padding:0;background:none"><label>النوع<select id="stk-ot"><option value="v">مورد</option><option value="c">كود</option></select></label><label>المورد<select id="stk-ov">${opt(vendors(),"","اختر المورد")}</select></label><label>أو الكود<input type="text" id="stk-oc" list="stk-codes2" dir="ltr" autocomplete="off"></label><label>الحد<input type="number" id="stk-om" min="1" max="9999" value="20"></label><button class="bt" type="button" data-sk="ova">إضافة</button></div><datalist id="stk-codes2">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist></div></div>
 <div class="f"><div><b>أسماء الفروع في «اسأل»</b><small>الاسم الذي تكتبه في السؤال ليُفهم أنه هذا المخزن (مثلاً «النخيل»). رقم الفرع واسمه الإنجليزي وأشهر الأسماء العربية مفهومة من غير إضافة. الاسم الذي تضيفه يغلب المعروف.</small>
 <div style="margin-top:8px">${(CFG.ov||[]).map((o,i)=>o.t!=="a"?"":`<div class="stk-day"><span style="width:auto;direction:rtl" data-notr>${E(o.k)}</span><b data-notr dir="ltr">${E(o.s)}</b><button class="bt s" type="button" data-sk="ovx" data-i="${i}">حذف</button></div>`).join("")||`<small>لم تُضف أسماء.</small>`}</div>
 <div class="stk-bar" style="margin-top:10px;border:0;padding:0;background:none"><label>الاسم كما تكتبه<input type="text" id="stk-an" maxlength="40" autocomplete="off"></label><label>المخزن<select id="stk-as">${opt(DATA.st.slice().sort(),"","اختر المخزن")}</select></label><button class="bt" type="button" data-sk="ala">إضافة</button></div>
 <details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px;color:var(--mut)">الأسماء العربية المعروفة تلقائياً</summary><div style="margin-top:6px;font-size:13px;line-height:2" data-notr>${DATA.st.slice().sort().map(s=>{const al=ALIAS[s.slice(0,3)];return al?`<bdi dir="ltr">${E(s)}</bdi> ← ${E(al.join("، "))}<br>`:""}).join("")}</div></details></div></div>
 <div class="f"><div></div><button class="bt p" type="button" data-sk="cfgsave">حفظ القواعد</button><button class="bt" type="button" data-sk="cfgdef">رجوع للقواعد الأصلية</button></div></div>`;
}
/* ---- (v174) تبويب «اسأل» ---- */
const pct=x=>x==null?"—":(Math.round(x*1000)/10)+"%";
const tile=(v,l,cls,extra)=>`<div class="stk-tile${cls?" "+cls:""}"${extra||""}><b><bdi dir="ltr" data-notr>${E(v)}</bdi></b><span>${l}</span></div>`;
const em=t=>`<div class="stk-pan"><div class="stk-em">${t}</div></div>`;
const askCtx=()=>({stores:DATA.st,codes:DATA.code,k:DATA.k,alias:(CFG.ov||[]).filter(o=>o&&o.t==="a"),today:today(),end:qEnd(),wh:CFG.wh});
const askP=()=>{const a=UI.a;return a&&a.per==="c"&&a.from&&a.to&&a.from<=a.to?{from:a.from,to:a.to}:null};
// الفترة التي يحتاج الجواب شهورها من ملفات التاريخ: الفترة المحددة، أو السنة كلها لصنف (أيام البيع وآخر بيع)
// (السنة كلها تُحمَّل فقط لو ملفات التاريخ تغطيها كاملة؛ وإلا فأيام البيع لا تُعرض أصلاً حتى لا يظهر رقم ناقص)
const yearR=()=>{const R=dHas()?fullR():null;return R&&coverage(META,R).ok?R:null};
const askNeed=()=>{const a=UI.a;if(!a||!DATA||!DATA.has)return null;return askP()||(a.code?yearR():null)};
const hGet=()=>{try{const a=JSON.parse(localStorage.getItem("stk_ask")||"[]");return Array.isArray(a)?a.filter(x=>typeof x==="string"&&x).slice(0,8):[]}catch(e){return []}};
const hAdd=q=>{try{localStorage.setItem("stk_ask",JSON.stringify([q].concat(hGet().filter(x=>x!==q)).slice(0,8)))}catch(e){}};
function doAsk(q){q=String(q||"").trim().slice(0,200);UI.aq=q;UI.lim=200;if(!q||!DATA||!DATA.has){UI.a=null;paint(false);return}UI.a=parseAsk(q,askCtx());hAdd(q);paint(false)}
let EXC=null;// أمثلة من بيانات الملف نفسه (أعلى كود وأعلى فرع مبيعاً)
function askEx(en){
 if(!EXC||EXC.D!==DATA){const bc=new Map(),bs={},wh=DATA.sti.get(CFG.wh);DATA.q.forEach((a,ki)=>{if(!a)return;const c=DATA.k[ki][0];for(let j=0;j<a.length;j+=4){bc.set(c,(bc.get(c)||0)+a[j+2]);if(a[j]!==wh)bs[a[j]]=(bs[a[j]]||0)+a[j+2]}});
  let c="",cm=-1;bc.forEach((v,k)=>{if(v>cm&&/^[0-9A-Za-z]+$/.test(k)){cm=v;c=k}});let s=-1,sm=-1;for(const t in bs)if(bs[t]>sm&&/^\d{3}-/.test(DATA.st[t])){sm=bs[t];s=+t}
  EXC={D:DATA,c,s:s>=0?DATA.st[s]:""}}
 const c=EXC.c,s=EXC.s,p=s.slice(0,3),ar=ALIAS[p]?ALIAS[p][0].replace(/ه$/,"ة"):"",nm=s.slice(4),out=[];if(!c||!s)return out;
 if(en){out.push("code "+c,"branch "+p,c+" "+nm.toLowerCase());if(dHas())out.push(c+" last 30 days","branch "+p+" last 7 days")}
 else{const b=ar?"فرع "+ar:"فرع "+p;out.push("الكود "+c+" بيع منه كم",b+" باع كم وعنده كم",c+" في "+(ar||nm));if(dHas())out.push(c+" آخر 30 يوم",b+" آخر 7 أيام")}
 return out;
}
const chip=x=>`<button type="button" data-sk="ex" data-x="${E(x)}" data-notr>${E(x)}</button>`;
function vAsk(){
 const en=document.documentElement.classList.contains("tz-en"),a=UI.a,H=hGet(),X0=askEx(en);
 const box=`<div class="stk-card stk-ask"><h3>💬 اسأل عن أي صنف أو فرع</h3><p>اكتب الكود أو اسم الفرع أو كليهما، ومعهما الفترة إن أردت. كل رقم يُحسب مباشرة من الملفين المرفوعين.</p>
 <div class="stk-askb"><input type="search" id="stk-ask" value="${E(UI.aq)}" placeholder="الكود، الفرع، الفترة" autocomplete="off" enterkeyhint="search" maxlength="200"><button class="bt p" type="button" data-sk="ask">اسأل</button></div>
 ${X0.length?`<div class="stk-chips"><i>أمثلة</i>${X0.map(chip).join("")}</div>`:""}${H.length?`<div class="stk-chips"><i>آخر أسئلتك</i>${H.map(chip).join("")}</div>`:""}</div>`;
 if(!a){LASTX=null;return box}
 const P=askP(),ids=a.code?DATA.code.get(a.code)||[]:[],cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!a.cl||DATA.k[k][1]===a.cl).map(k=>DATA.k[k][2]))].sort((x,y)=>zk(x)-zk(y));
 const curZ=a.z,pEnd=P?P.to:"";
 const und=`<div class="stk-bar stk-und"><b class="stk-undt">فهمتُ سؤالك هكذا (غيّر ما تريد)</b><label>الفرع<select data-af="store" id="stk-a-st">${opt(stores(0),a.store,"كل الفروع")}</select></label><label>الكود<input type="text" data-af="code" id="stk-a-code" list="stk-codes" value="${E(a.code)}" placeholder="كل الأصناف" dir="ltr" autocomplete="off"></label>${ids.length?`<label>اللون<select data-af="cl" id="stk-a-cl">${opt(cols,a.cl,"كل الألوان")}</select></label><label>المقاس<select data-af="z" id="stk-a-z">${opt(szs,curZ,"كل المقاسات")}</select></label>`:""}
 <label>الفترة<select data-af="per" id="stk-a-per"><option value="ytd"${a.per!=="c"?" selected":""}>من أول السنة</option><option value="c"${a.per==="c"?" selected":""}>فترة أحددها</option></select></label>${a.per==="c"?`<label>من يوم<input type="date" data-af="from" id="stk-a-from" value="${E(a.from)}"></label><label>إلى يوم<input type="date" data-af="to" id="stk-a-to" value="${E(a.to)}"></label>`:""}<span class="sp"></span><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 const pk=(k,v)=>`<button class="bt s" type="button" data-sk="pick" data-k="${k}" data-v="${E(v)}" data-notr>${E(v)}</button>`,nt=[];
 if(a.amb.store.length)nt.push(`<div class="stk-rep w">أكثر من فرع يطابق ما كتبت. اختر الفرع: ${a.amb.store.map(s=>pk("store",s)).join(" ")}</div>`);
 if(a.amb.code.length)nt.push(`<div class="stk-rep w">${a.code?"كتبت أكثر من كود. اختر الكود:":"لم أجد هذا الكود كاملاً. أكواد تبدأ بما كتبت:"} ${a.amb.code.map(s=>pk("code",s)).join(" ")}</div>`);
 if(a.amb.cl.length)nt.push(`<div class="stk-rep w">أكثر من لون يطابق ما كتبت. اختر اللون: ${a.amb.cl.map(s=>pk("cl",s)).join(" ")}</div>`);
 if(a.unk.length)nt.push(`<div class="stk-rep">لم أفهم من سؤالك: <b data-notr>${E(a.unk.join(" · "))}</b> — لم يدخل في الحساب.</div>`);
 if(a.rc)nt.push(`<div class="stk-rep w">«المستلم» غير متاح: عمود <b data-notr>RCVD_QTY</b> في تقرير السيستم ليس استلام الفرع (رقم واحد يتكرر على كل الفروع)، فلا يُعرض. المتاح: الرصيد والمبيعات.</div>`);
 if(a.per==="c"&&!dHas())nt.push(`<div class="stk-rep w">المبيعات بين يومين تحتاج ملف التاريخ، ولم يُرفع بعد. ارفعه من تبويب «الملفات».</div>`);
 else if(a.per==="c"&&!P)nt.push(`<div class="stk-rep w">تاريخ البداية بعد تاريخ النهاية.</div>`);
 const q=META&&META.q?META.q:{},sp=d=>`<span data-notr dir="ltr">${E(d)}</span>`;
 const src=`<p class="stk-src">المصدر: الأرصدة من ملف الكميات المرفوع ${sp(dts(q.at))}${q.to?` (حتى نهاية يوم ${sp(qEnd())})`:""}. المبيعات ${P?`من ملفات التاريخ، من ${sp(P.from)} إلى ${sp(pEnd)}`:`من ملف الكميات${q.from?`، من ${sp(q.from)} إلى ${sp(qEnd())}`:"، من أول السنة"}`}. الأرقام صافية بعد المرتجع.</p>`;
 let ans="";const perBad=a.per==="c"&&!P;
 if(perBad){LASTX=null}
 else if(a.code)ans=ansCode(a,P);
 else if(a.store)ans=ansStore(a,P);
 else{LASTX=null;ans=em("لم أجد في سؤالك كوداً ولا فرعاً.<br>اكتب كود الصنف (مثل الأمثلة في الأعلى) أو اسم الفرع أو رقمه، أو اخترهما من القوائم.")}
 return box+und+nt.join("")+gapNote(P)+ans+(ans&&(a.code||a.store)&&!perBad?src:"");
}
function ansStore(a,P){
 const R=storeCard(DATA,CFG,a.store,P);if(!R){LASTX=null;return em("هذا الفرع غير موجود في ملف الكميات.")}
 LASTX={name:"فرع-"+cd(a.store),head:["الكود","المبيعات","الرصيد"],rows:()=>R.top.map(c=>[c.code,c.sold,c.on])};
 const T=[tile(fmt(R.on),"قطعة عنده الآن","k"),tile(fmt(R.sold),"قطعة باعها (الصافي)","k"),tile(fmt(R.inSt),"صنف له رصيد عنده")];
 if(R.ret!=null)T.push(tile(fmt(R.ret),"قطعة مرتجعة"),tile(fmt(R.days),"يوم فيه بيع"));
 if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيبه بين الفروع في المبيعات"),tile(pct(R.share),"نصيبه من مبيعات الفروع"));
 if(R.short)T.push(tile(fmt(R.short.n),"صنف يبيعه ورصيده ناقص","go",` data-sk="goneed" role="button" tabindex="0"`),tile(fmt(R.idle.n),"صنف راكد عنده","go",` data-sk="gostale" role="button" tabindex="0"`),tile(fmt(R.idle.pcs),"قطعة راكدة"));
 T.push(tile(fmt(R.out.length),"صنف نفد عنده وهو يبيعه"));if(R.negN)T.push(tile(fmt(R.negN),"صنف رصيده سالب في السيستم","bad"));
 const top=R.top.slice(0,20),vs=R.vendors.filter(v=>v.sold||v.on).slice(0,15),out=R.out.slice(0,40);
 return `<div class="stk-ttl"><h3>${sn(R.ti)}</h3><small>${R.isWh?"مخزن المستودع":"بطاقة الفرع"}</small></div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-up"><div class="stk-card"><h3>أعلى الأصناف مبيعاً</h3>${top.length?`<table class="stk-t"><thead><tr><th>الكود</th><th class="n">المبيعات</th><th class="n">الرصيد</th></tr></thead><tbody>${top.map(c=>`<tr><td class="c" data-notr><a href="#" data-sk="acode" data-c="${E(c.code)}" style="color:inherit">${E(c.code)}</a></td><td class="n"><b>${fmt(c.sold)}</b></td><td class="n${c.on<=0?" z":""}">${fmt(c.on)}</td></tr>`).join("")}</tbody></table>`:`<p>لا مبيعات في الفترة.</p>`}</div>
 <div class="stk-card"><h3>حسب المورد</h3>${vs.length?`<table class="stk-t"><thead><tr><th>المورد</th><th class="n">المبيعات</th><th class="n">الرصيد</th></tr></thead><tbody>${vs.map(v=>`<tr><td data-notr style="white-space:normal">${E(v.v||"—")}</td><td class="n"><b>${fmt(v.sold)}</b></td><td class="n">${fmt(v.on)}</td></tr>`).join("")}</tbody></table>`:`<p>لا بيانات.</p>`}</div></div>
 ${out.length?`<div class="stk-pan"><h3 class="stk-ph">نفد عنده وهو يبيعه (${fmt(R.out.length)})</h3><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">المبيعات</th><th class="n">رصيد الفرع</th><th class="n">رصيد المستودع</th></tr></thead><tbody>${out.map(l=>`<tr>${kCells(l.ki)}<td class="n"><b>${fmt(l.sold)}</b></td><td class="n z">${fmt(l.on)}</td><td class="n">${l.wh>0?fmt(l.wh):`<span class="no">0</span>`}</td></tr>`).join("")}</tbody></table></div></div>`:""}`;
}
function ansCode(a,P){
 const DR=P||yearR(),R=codeCard(DATA,CFG,a.code,{cl:a.cl,z:a.z,store:a.store,period:P,drange:P?null:DR});
 if(!R){LASTX=null;return em(`الكود <b data-notr dir="ltr">${E(a.code)}</b> غير موجود في ملف الكميات.`)}
 if(R.none){LASTX=null;return em("لا يوجد هذا اللون أو المقاس لهذا الكود.")}
 const cov=DR?coverage(META,DR):null,loaded=!!DR&&months(DR.from,DR.to).every(ym=>!(META.d&&META.d[ym])||DATA.d[ym]),dat=!!DR&&loaded,x0=DATA.k[R.ids[0]],sub=[a.cl,a.z].filter(Boolean).join(" · ");
 const T=[],dT=()=>{if(!dat)return;T.push(tile(fmt(R.ret),"قطعة مرتجعة"),tile(fmt(R.days),"يوم فيه بيع"));if(R.first&&!a.store)T.push(tile(R.first,"أول يوم بيع","dt"));if(R.last)T.push(tile(R.last,"آخر يوم بيع","dt"))};
 let tabs="";
 if(a.store){const me=R.me,mn=k=>minOf(CFG,DATA,k);
  LASTX={name:"صنف-"+a.code+"-"+cd(a.store),head:["اللون","المقاس","رصيد الفرع","مبيعات الفرع","رصيد المستودع"],rows:()=>R.vars.map(v=>{const x=DATA.k[v.ki];return [x[1],x[2],v.on,v.sold,v.wh]})};
  T.push(tile(fmt(R.on),"قطعة عند الفرع الآن","k"),tile(fmt(R.sold),"قطعة باعها الفرع (الصافي)","k"));dT();T.push(tile(fmt(R.wh),"قطعة في المستودع"));
  if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيب الفرع في هذا الصنف"),tile(pct(R.share),"نصيبه من مبيعات الصنف"));
  const vs=R.vars.filter(v=>v.on||v.sold||v.wh);
  tabs=`<div class="stk-pan"><h3 class="stk-ph">الألوان والمقاسات عند الفرع</h3>${vs.length?`<div class="tw"><table class="stk-t"><thead><tr><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">مبيعات الفرع</th><th class="n">رصيد المستودع</th></tr></thead><tbody>${vs.map(v=>{const x=DATA.k[v.ki],need=me&&me.ti!==DATA.sti.get(CFG.wh)&&v.on<mn(v.ki)&&v.sold>0;return `<tr><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td><td class="n${need?" z":""}">${fmt(v.on)}</td><td class="n"><b>${fmt(v.sold)}</b></td><td class="n">${fmt(v.wh)}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="stk-em">لا رصيد ولا مبيعات لهذا الصنف في هذا الفرع.</div>`}</div>`}
 else{LASTX={name:"صنف-"+a.code,head:["الفرع","الرصيد","المبيعات","آخر يوم بيع"],rows:()=>R.stores.map(s=>[DATA.st[s.ti],s.on,s.sold,s.last])};
  T.push(tile(fmt(R.sold),"قطعة مباعة (الصافي)","k"),tile(fmt(R.nSold),"فرع باع منه"),tile(fmt(R.wh),"قطعة في المستودع","k"),tile(fmt(R.br),"قطعة في الفروع"));dT();if(R.thru!=null)T.push(tile(pct(R.thru),"نسبة ما بيع منه"));
  const vs=R.vars.filter(v=>v.wh||v.br||v.sold);
  tabs=`<div class="stk-up"><div class="stk-card"><h3>الفروع</h3><table class="stk-t"><thead><tr><th>الفرع</th><th class="n">الرصيد</th><th class="n">المبيعات</th><th class="n">النصيب</th>${dat?`<th class="n">آخر بيع</th>`:""}</tr></thead><tbody>${R.stores.map(s=>`<tr><td><a href="#" data-sk="pick" data-k="store" data-v="${E(DATA.st[s.ti])}" style="color:inherit">${sn(s.ti)}</a></td><td class="n${s.on<=0?" z":""}">${fmt(s.on)}</td><td class="n"><b>${fmt(s.sold)}</b></td><td class="n">${R.allSold>0?pct(s.sold/R.allSold):"—"}</td>${dat?`<td class="n" data-notr>${E(s.last||"—")}</td>`:""}</tr>`).join("")}</tbody></table></div>
  <div class="stk-card"><h3>الألوان والمقاسات</h3><table class="stk-t"><thead><tr><th>اللون</th><th class="n">المقاس</th><th class="n">المستودع</th><th class="n">الفروع</th><th class="n">المبيعات</th></tr></thead><tbody>${vs.slice(0,80).map(v=>{const x=DATA.k[v.ki];return `<tr><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td><td class="n${v.wh<=0?" z":""}">${fmt(v.wh)}</td><td class="n">${fmt(v.br)}</td><td class="n"><b>${fmt(v.sold)}</b></td></tr>`}).join("")}</tbody></table></div></div>`}
 const nt=[];
 if(!P&&DR&&!loaded)nt.push(`<div class="stk-rep">أيام البيع وآخر يوم بيع تظهر بعد تحميل ملفات التاريخ…</div>`);
 if(!P&&!DR)nt.push(`<div class="stk-rep">عدد أيام البيع وأول وآخر يوم بيع والمرتجع تظهر هنا عندما تغطي ملفات التاريخ السنة كلها، أو عندما تختار فترة مرفوعة من خانة «الفترة». المبيعات والأرصدة أعلاه كاملة من ملف الكميات.</div>`);
 if(!P&&dat&&cov&&cov.ok&&!near(R.dnet,R.sold))nt.push(`<div class="stk-rep w">⚠️ ملفات التاريخ تعطي <b data-notr>${fmt(R.dnet)}</b> قطعة لهذا الصنف وملف الكميات يعطي <b data-notr>${fmt(R.sold)}</b>. المعروض من ملف الكميات. راجع «فحص المطابقة» في تبويب «الملفات».</div>`);
 return `<div class="stk-ttl"><h3 data-notr><bdi dir="ltr">${E(a.code)}</bdi>${sub?` <small>${E(sub)}</small>`:""}</h3><small data-notr>${x0[3]>=0?E(DATA.vn[x0[3]]):""}</small>${a.store?`<small>الفرع: ${sn(R.me.ti)}</small>`:""}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="goitem">🔍 جدول الصنف في كل الفروع</button>${dHas()?`<button class="bt" type="button" data-sk="gosales">📅 مبيعاته يوماً بيوم</button>`:""}${a.store?`<button class="bt" type="button" data-sk="pick" data-k="store" data-v="">كل الفروع لهذا الصنف</button>`:""}</div>${nt.join("")}${tabs}`;
}
function body(){
 if(LOADING&&!DATA)return `<div class="stk-busy">جاري تحميل بيانات المخزون…</div>`;
 const has=DATA&&DATA.has,t=has?UI.tab:"up",q=META&&META.q;
 const hd=`<div class="stk-hd"><div><small>${q?`آخر ملف كميات: <span data-notr dir="ltr">${dts(q.at)}</span> · ${fmt(q.skus)} صنف${q.to?` · المبيعات حتى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}`:"ارفع ملف الكميات لتبدأ"}</small></div></div>`;
 const tabs=`<nav class="stk-tabs" aria-label="أقسام تحليل المخزون">${TABS.filter(a=>has||a[0]==="up").map(a=>`<button type="button" class="${t===a[0]?"on":""}" data-sk="tab" data-t="${a[0]}">${a[1]} ${a[2]}</button>`).join("")}</nav>`;
 const busy=BUSY?`<div class="stk-busy">${E(BUSY)} <span id="stk-pg" data-notr></span></div>`:"";
 // ملف الكميات أقدم من اليوم: الأرصدة المعروضة ليست أرصدة اللحظة
 const old=q&&q.to&&q.to<today()?Math.round((new Date(today()+"T12:00:00")-new Date(q.to+"T12:00:00"))/864e5):0;
 const stl=has&&old>0&&t!=="up"?`<div class="stk-rep w">ملف الكميات المرفوع قديم (${old===1?"من أمس":"منذ "+old+" يوماً"}): الأرصدة هنا حتى نهاية يوم <b data-notr>${E(qEnd())}</b>. ارفع ملف اليوم من تبويب «الملفات» لتكون الأرقام محدَّثة.</div>`:"";
 let v="";try{v=t==="up"?vUp():!has?vUp():t==="ask"?vAsk():t==="need"?vNeed():t==="tr"?vTr():t==="item"?vItem():t==="sales"?vSales():t==="stale"?vStale():vCfg()}catch(e){v=`<div class="stk-rep r">تعذّر عرض هذا التبويب (${E(String(e&&e.message||e).slice(0,80))}).</div>`}
 return hd+tabs+busy+(t!=="cfg"?stl:"")+v;
}
let PT=0;
function paint(keepFocus){
 if(!ROOT)return;const a=document.activeElement,id=a&&ROOT.contains(a)?a.id:"",s0=a&&id?[a.selectionStart,a.selectionEnd]:null;
 ROOT.innerHTML=body();
 if(id&&keepFocus!==false){const el=g(id);if(el&&el.focus){try{el.focus({preventScroll:true});if(s0&&s0[0]!=null&&el.setSelectionRange)el.setSelectionRange(s0[0],s0[1])}catch(e){}}}
 // فترة تحتاج شهوراً لم تُحمَّل بعد
 const P=UI.tab==="ask"?askNeed():UI.tab==="sales"?(UI.from&&UI.to&&UI.from<=UI.to&&UI.code?{from:UI.from,to:UI.to}:null):(UI.tab==="up"||UI.tab==="cfg"?null:period());
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
  else if(a==="ask"){const el=g("stk-ask");doAsk(el?el.value:UI.aq)}
  else if(a==="ex")doAsk(t.dataset.x);
  else if(a==="pick"&&UI.a){e.preventDefault();const k=t.dataset.k;if(k==="store"||k==="code"||k==="cl"){UI.a[k]=t.dataset.v||"";UI.a.amb[k]=[];if(k==="code"){UI.a.cl="";UI.a.z="";UI.a.amb.cl=[]}paint(false)}}
  else if(a==="acode"&&UI.a){e.preventDefault();UI.a.code=t.dataset.c;UI.a.cl="";UI.a.z="";UI.a.amb.code=[];paint(false);window.scrollTo(0,0)}
  else if((a==="goneed"||a==="gostale"||a==="goitem"||a==="gosales")&&UI.a){const q=UI.a,P=askP();
   if(a==="goitem"){UI.code=q.code;UI.tab="item"}
   else if(a==="gosales"){UI.code=q.code;UI.cl=q.cl;UI.sz=q.z;UI.st=q.store;if(P){UI.from=P.from;UI.to=P.to}UI.tab="sales"}
   else{UI.st=q.store;UI.vn="";UI.q="";UI.tab=a==="goneed"?"need":"stale";if(P){UI.per="c";UI.from=P.from;UI.to=P.to}else UI.per="ytd"}
   UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="recon")doRecon();
  else if(a==="pub")publish(false);
  else if(a==="recx"||a==="qx"){const X1=xOther(a==="recx"?"rec":t.dataset.k);if(X1){const keep=LASTX;LASTX=X1;csv();LASTX=keep}}
  else if(a==="ala"){const k=String(g("stk-an").value||"").trim().slice(0,40),s=g("stk-as").value;if(!k||!s){if(X.toast)X.toast("اكتب الاسم واختر المخزن");return}
   const rest=(CFG.ov||[]).filter(o=>!(o.t==="a"&&wkey(o.k)===wkey(k)));if(rest.length>=60){if(X.toast)X.toast("وصلت الحد الأقصى (60) للحدود الخاصة والأسماء");return}CFG.ov=rest.concat([{t:"a",k,s}]);ASKC=null;paint()}
  else if(a==="mk")mkTransfer(t.dataset.f,t.dataset.d);
  else if(a==="prv"){UI.fr=t.dataset.f;UI.tt=t.dataset.d;UI.lim=200;paint(false)}
  else if(a==="prsmore"){UI.prs=(UI.prs||8)+20;paint()}
  else if(a==="cfgsave")saveCfg();
  else if(a==="cfgdef"){CFG=Object.assign({},DEF,{ex:DEF.ex.slice(),ov:[]});paint()}
  else if(a==="ovx"){CFG.ov=(CFG.ov||[]).filter((o,i)=>i!==+t.dataset.i);ASKC=null;paint()}
  else if(a==="ova"){const ty=g("stk-ot").value,k=String(ty==="c"?g("stk-oc").value:g("stk-ov").value).trim(),mn=N(g("stk-om").value);if(!k||mn<1){if(X.toast)X.toast(ty==="c"?"اكتب الكود":"اختر المورد");return}
   CFG.ov=(CFG.ov||[]).filter(o=>!(o.t===ty&&o.k===k)).concat([{t:ty,k:k.slice(0,60),min:Math.min(9999,mn)}]);paint()}});
 const set=t=>{const af=t.dataset.af;
  if(af&&UI.a){const q=UI.a;q[af]=t.value;UI.lim=200;if(af==="code"){q.code=String(t.value).trim();q.cl="";q.z="";q.amb.code=[];q.amb.cl=[]}if(af==="cl")q.z="";if(af==="store")q.amb.store=[];
   if(af==="per"&&t.value==="c"&&!(q.from&&q.to)){q.to=qEnd();q.from=addDays(q.to,-29)}return true}
  const k=t.dataset.sf;if(k){UI[k]=t.type==="checkbox"?(t.checked?1:0):t.value;UI.lim=200;if(k==="code"){UI.cl="";UI.sz=""}if(k==="cl")UI.sz="";return true}
  if(t.dataset.cf){const c=t.dataset.cf;CFG[c]=c==="wh"?t.value:Math.max(0,Math.min(9999,N(t.value)));return false}
  if(t.dataset.cx!==undefined){const s=new Set(CFG.ex||[]);if(t.checked)s.add(t.dataset.cx);else s.delete(t.dataset.cx);CFG.ex=[...s];return false}return false};
 ROOT.addEventListener("keydown",e=>{const t=e.target;if(e.key==="Enter"&&t&&t.id==="stk-ask"){e.preventDefault();doAsk(t.value)}
  else if((e.key==="Enter"||e.key===" ")&&t&&t.classList&&t.classList.contains("go")){e.preventDefault();t.click()}});
 ROOT.addEventListener("input",e=>{const t=e.target;if(t.id==="stk-file")return;if(t.id==="stk-ask"){UI.aq=t.value;return}if(t.id==="stk-an")return;if(t.tagName==="SELECT"||t.type==="checkbox"||t.type==="date")return;if(set(t))later()});
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
