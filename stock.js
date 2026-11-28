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
//   (v190) عمود المستلم (RECEIVED_QTY / RCVD_QTY) يُحفظ ويُعرض لو فيه استلام لعشرين كوداً فأكثر (D.rc، من أول السنة، للعرض فقط). تقرير قديم كان فيه كود واحد برقم مكرر: لا يُعتمد. الخانة الرابعة في لقطة الكميات صارت مورد السطر (rv:1).
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
let X=null,ROOT=null,DATA=null,CFG=Object.assign({},DEF),META=null,LOADED=false,LOADING=false,BUSY="",REP=[],SOLDC={},SENT=[],un=[],MFAIL={};// MFAIL: شهور تاريخ فشل تحميلها
const SENT_DAYS=14;// طلب التحويل المُنشأ يبقى معلَّماً على اقتراحه 14 يوماً (حتى يظهر أثره في تقرير السيستم)
let UI={tab:"home",dp:"",hx:"",hk:"n",bh:60,ba:30,bs:"cover",bx:"",trv:"pair",st:"",vn:"",q:"",sold:1,min:"",per:"ytd",from:"",to:"",fr:"",tt:"",code:"",cl:"",sz:"",pf:"",pt:"",psort:"q",pxd:"",vf:"",vt:"",vs:"",show:"b",son:"",lim:200,aq:"",a:null,rec:null};

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
 rc:["rcvd_qty","received_qty","المستلم","received","rcvd qty","received qty","receive qty","receive_qty","rcv qty","rcv_qty","rec qty","qty received","voucher qty","vou qty","vou_qty","purchase qty","purchased qty","purchases","الكمية المستلمة","المشتريات","الاستلام"],sold:["sold_qty","المبيعات","مبيعات","sold"],on:["oh_qty","onhand qty","on hand qty","oh qty","onhand","الكمية","الرصيد"],
 yr:["date - year","year","السنة"],mo:["date - month","month","الشهر"],dy:["date - day","day","اليوم"],dt:["date","التاريخ","voucher date","vou date","vou_date","receive date","received date","rcvd date","rcvd_date","تاريخ الاستلام","تاريخ السند","created_date","created date","post_date","post date"]};
const MON={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,
 "يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"ابريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"اغسطس":8,"سبتمبر":9,"أكتوبر":10,"اكتوبر":10,"نوفمبر":11,"ديسمبر":12};
const p2=n=>(n<10?"0":"")+n;
const moNum=v=>{const s=String(v).trim().toLowerCase();return MON[s]||(/^\d{1,2}$/.test(s)&&+s>=1&&+s<=12?+s:0)};
// تاريخ في خانة واحدة: 2026-11-17، 17/11/2026، أو رقم إكسل
const dateOf=v=>{const s=String(v).trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);if(m)return [+m[1],+m[2],+m[3]];m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s);if(m)return [+m[3],+m[2],+m[1]];
 if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(+s)*864e5);return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}return null};
// يجمع صفوف ملف واحد: يتعرّف على الرأس والنوع (كميات q / تاريخ d)، يجمع المكرر، ويلتقط ذيل Power BI (Total، الفترة، تحذير القطع)
export function ingest(){
 let H=null,type="",n=0;const st=[],sti=new Map(),vn=[],vni=new Map(),k=[],ki=new Map(),q=new Map(),mon={},days=new Set(),vs=[],rq=new Map(),rcC=new Set();// rq (v190): المستلم لكل (صنف*1000+فرع)
 const sum={sold:0,on:0,rc:0},tot={},R={trunc:false,from:"",to:"",bad:0,nan:0,dup:0};
 const qn=v=>{const x=num(v);if(x!==x){R.nan++;return 0}return x};// خانة كمية غير رقمية تُعدّ (والملف يُرفض عند الحفظ)
 const ix=(arr,map,v)=>{let i=map.get(v);if(i===undefined){i=arr.length;arr.push(v);map.set(v,i)}return i};
 const head=row=>{const h={},low=row.map(c=>String(c).trim().toLowerCase());for(const f in HMAP){const i=low.findIndex(c=>HMAP[f].indexOf(c)>=0);if(i>=0)h[f]=i}
  // (v253) أعمدة التاريخ بأي اسم تاريخ قبلها: «CREATED_DATE - Year» مثل «Date - Year»
  for(const [f,s] of [["yr","year"],["mo","month"],["dy","day"]])if(h[f]===undefined){const i=low.findIndex(c=>c.indexOf(" - ")>0&&c.split(" - ").pop().trim()===s);if(i>=0)h[f]=i}
  // (v248) ملف المشتريات: الكود والمخزن والتاريخ والكمية المستلمة بلا عمود مبيعات
  const dated=h=>(h.mo!==undefined&&h.dy!==undefined)||h.dt!==undefined;
  return h.code!==undefined&&h.store!==undefined&&(h.sold!==undefined||(h.rc!==undefined&&dated(h)&&h.on===undefined))?h:null};
 function row(r){
  if(!r.length)return;
  if(!H){H=head(r);if(H){const dt=(H.mo!==undefined&&H.dy!==undefined)||H.dt!==undefined;type=H.sold===undefined?"r":H.on!==undefined&&H.mo===undefined&&H.dt===undefined?"q":dt?"d":""}return}
  const c0=String(r[0]||"");
  if(r.length<=2&&c0.length>12){// ذيل Power BI
   if(/exceeded the allowed volume/i.test(c0))R.trunc=true;
   const m=/on or after (\d{1,2})-([A-Za-z]{3})-(\d{2,4}) and is before (\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(c0);
   if(m){const y=s=>s.length===2?2000+(+s):+s;R.from=y(m[3])+"-"+p2(MON[m[2].toLowerCase()]||1)+"-"+p2(+m[1]);R.to=y(m[6])+"-"+p2(MON[m[5].toLowerCase()]||1)+"-"+p2(+m[4])}
   return}
  const code=String(r[H.code]||"").trim(),store=String(r[H.store]||"").trim();
  if(!store){if(/^total$/i.test(code)){const a=H.sold!==undefined?num(r[H.sold]):NaN;if(a===a)tot.sold=a;if(H.on!==undefined){const b=num(r[H.on]);if(b===b)tot.on=b}if(H.rc!==undefined)tot.rc=N(r[H.rc])}else if(code)R.bad++;return}
  if(!code){R.bad++;return}
  // السطر يُراجَع كله قبل أن يدخل في أي مجموع: سطر تاريخه غير مفهوم لا يُحسب (فيظهر الفرق أمام سطر الإجمالي ويُرفض الملف)
  let y=0,mo=0,dy=0;
  if(type==="d"||type==="r"){if(H.dt!==undefined&&H.mo===undefined){const d=dateOf(r[H.dt]);if(!d){R.bad++;return}y=d[0];mo=d[1];dy=d[2]}else{y=H.yr!==undefined?N(r[H.yr]):new Date().getFullYear();mo=moNum(r[H.mo]);dy=N(r[H.dy])}
   if(!mo||y<2000||y>2100||dy<1||dy!==Math.floor(dy)||dy>new Date(y,mo,0).getDate()){R.bad++;return}}
  const sold=H.sold!==undefined?qn(r[H.sold]):0,rc=H.rc!==undefined?(type==="q"||type==="r"?qn(r[H.rc]):N(r[H.rc])):0;
  if(type==="r"&&!rc)return;// سطر مشتريات كميته صفر: لا معنى له
  const cl=H.color!==undefined?String(r[H.color]||"").trim():"",z=H.size!==undefined?String(r[H.size]||"").trim():"";
  const key=code+SEP+cl+SEP+z;let kk=ki.get(key);
  const vi=H.vendor!==undefined?ix(vn,vni,String(r[H.vendor]||"").trim()):-1;
  if(kk===undefined){kk=k.length;k.push([code,cl,z,vi]);ki.set(key,kk)}
  const ti=ix(st,sti,store);n++;sum.sold+=sold;sum.rc+=rc;
  // الخانة الرابعة = مورد هذا السطر (v174): في التقرير 21 صنفاً مكتوب لها موردان في فروع مختلفة، فالمورد يُحفظ لكل (صنف، فرع) لا للصنف. (كانت «المستلم»، وهو عمود غير صالح)
  if(type==="q"){const on=qn(r[H.on]);sum.on+=on;if(rc){const rk=kk*1000+ti;rq.set(rk,(rq.get(rk)||0)+rc);rcC.add(code)}let a=q.get(kk);if(!a){a=[];q.set(kk,a)}let j=0;for(;j<a.length;j+=4)if(a[j]===ti)break;if(j<a.length){a[j+1]+=on;a[j+2]+=sold;R.dup++;if(vi!==a[j+3])vs.push(kk,ti,vi,on,sold)}else a.push(ti,on,sold,vi)}// سطر ثانٍ لنفس (صنف، فرع) بمورد آخر: يُجمع في الرصيد، ونصيب المورد الثاني يُحفظ في vs
  else if(type==="d"||type==="r"){const ym=y+"-"+p2(mo);(mon[ym]||(mon[ym]=[])).push(kk,ti,dy,type==="r"?0:sold,rc);days.add(ym+"-"+p2(dy))}
 }
 // rcOk: عمود المستلم يُعتمد فقط لو فيه استلام لعشرين كوداً فأكثر (تقرير قديم كان فيه كود واحد برقم مكرر على كل الفروع: لا يُعتمد)
 return {row,done:()=>Object.assign(R,{ok:!!H&&!!type,type,n,st,vn,k,q,vs,mon,days:[...days].sort(),sum,tot,rq,rcn:rcC.size,rcOk:type==="q"&&rcC.size>=20})};
}
// ملف (File أو {name, arrayBuffer()}) ← ناتج ingest
export async function readFile(file,onProg){
 const name=String(file.name||"");const buf=await file.arrayBuffer();
 if(/\.csv$|\.txt$/i.test(name)){const I=ingest(),V=ingestV();let t=new TextDecoder("utf-8").decode(buf);if(t.charCodeAt(0)===0xFEFF)t=t.slice(1);csvRows(t,r=>{I.row(r);V.row(r)});const R0=I.done();if(R0.ok)return R0;const V0=V.done();return V0.ok?V0:R0}
 const Z=zipDir(buf);let shared=null;const sf=Z.F.find(f=>f.name==="xl/sharedStrings.xml");
 if(sf){let t="";await streamText(Z.open(sf),x=>{t+=x});shared=[];const re=/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;let m;while((m=re.exec(t))){let v="",q;RT.lastIndex=0;while((q=RT.exec(m[1])))v+=dec(q[1]);shared.push(v)}}
 // أكبر الأوراق أولاً (ورقة البيانات)، وأول ورقة رأسها صحيح تُعتمد
 const sheets=Z.F.filter(f=>/^xl\/worksheets\/[^\/]+\.xml$/.test(f.name)).sort((a,b)=>b.usz-a.usz).slice(0,4);
 for(const f of sheets){const I=ingest(),V=ingestV(),fd=rowFeeder(r=>{I.row(r);V.row(r)},shared);await streamText(Z.open(f),x=>fd.push(x),n=>{if(onProg)onProg(f.usz?Math.min(1,n/f.usz):0)});const R=I.done();if(R.ok)return R;const V0=V.done();if(V0.ok)return V0}
 return {ok:false};
}
// (v251) 📥 ملف إكسل/csv ← نص كل ورقة بأعمدة مفصولة بتاب (يستعمله أمر الشراء لقراءة «البيان» بـ parseStatement)
export async function sheetTexts(file){
 const name=String(file.name||""),buf=await file.arrayBuffer(),cl=v=>String(v==null?"":v).replace(/[\t\r\n]+/g," ");
 if(/\.(csv|txt)$/i.test(name)){let t=new TextDecoder("utf-8").decode(buf);if(t.charCodeAt(0)===0xFEFF)t=t.slice(1);const L=[];csvRows(t,r=>L.push(r.map(cl).join("\t")));return [L.join("\n")]}
 const Z=zipDir(buf);let shared=null;const sf=Z.F.find(f=>f.name==="xl/sharedStrings.xml");
 if(sf){let t="";await streamText(Z.open(sf),x=>{t+=x});shared=[];const re=/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;let m;while((m=re.exec(t))){let v="",q;RT.lastIndex=0;while((q=RT.exec(m[1])))v+=dec(q[1]);shared.push(v)}}
 const num=n=>+((/(\d+)\.xml$/.exec(n)||[0,0])[1]),sheets=Z.F.filter(f=>/^xl\/worksheets\/[^\/]+\.xml$/.test(f.name)).sort((a,b)=>num(a.name)-num(b.name)).slice(0,6),out=[];
 for(const f of sheets){if(f.usz>8e6)continue;const L=[],fd=rowFeeder(r=>L.push(r.map(cl).join("\t")),shared);await streamText(Z.open(f),x=>fd.push(x));out.push(L.join("\n"))}
 return out;
}

/* ============ 2) الضغط والتخزين ============ */
const b64=u8=>{let s="";for(let i=0;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return btoa(s)};
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
export async function gz(str){const s=new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));return b64(new Uint8Array(await new Response(s).arrayBuffer()))}
export async function gun(z){const s=new Blob([unb64(z)]).stream().pipeThrough(new DecompressionStream("gzip"));return await new Response(s).text()}
const PART=880000;// حروف base64 للجزء (حد المستند 1.2 ميجا)
const parts=z=>{const a=[];for(let i=0;i<z.length;i+=PART)a.push(z.slice(i,i+PART));return a.length?a:[""]};
// لقطة الكميات ← نص مضغوط
const rcFlat=R=>{if(!R.rcOk||!R.rq)return undefined;const a=[];R.rq.forEach((v,k)=>{if(v)a.push(Math.floor(k/1000),k%1000,v)});return a};// (v190) المستلم: [صنف، فرع، كمية، …]
export const packQ=R=>JSON.stringify({st:R.st,vn:R.vn,k:R.k,rv:1,vs:R.vs||[],rc:rcFlat(R),r:[...R.q].map(e=>[e[0]].concat(e[1]))});// rv:1 = الخانة الرابعة في كل سطر هي رقم المورد (لقطات v173 فيها «المستلم»)
// شهر من ملف تاريخ ← مستند مستقل بقاموسه (فلا يتأثر بتغيّر ترتيب الأصناف في رفع لاحق)
export function packMonth(k,st,flat){const km=new Map(),K=[],r=[];for(let i=0;i<flat.length;i+=5){let j=km.get(flat[i]);if(j===undefined){j=K.length;K.push(k[flat[i]].slice(0,3));km.set(flat[i],j)}r.push(j,flat[i+1],flat[i+2],flat[i+3],flat[i+4])}return {st,k:K,r}}

/* ============ 3) البيانات في الذاكرة ============ */
export function newData(){return {st:[],sti:new Map(),vn:[],vni:new Map(),k:[],ki:new Map(),q:[],code:new Map(),d:{},vx:new Map(),rc:new Map(),hasRc:false,has:false}}
// (v190) المستلم من أول السنة لصنف في مخزن (من ملف الكميات، لو فيه عمود استلام صالح)
export const rcOf=(D,ki,ti)=>D.rc?D.rc.get(ki*1000+ti)||0:0;
const dIx=(D,arr,map,v)=>{let i=map.get(v);if(i===undefined){i=arr.length;arr.push(v);map.set(v,i)}return i};
const dKey=(D,c,cl,z,vi)=>{const key=c+SEP+cl+SEP+z;let i=D.ki.get(key);if(i===undefined){i=D.k.length;D.k.push([c,cl,z,vi==null?-1:vi]);D.ki.set(key,i);let a=D.code.get(c);if(!a){a=[];D.code.set(c,a)}a.push(i)}else if(vi!=null&&vi>=0&&D.k[i][3]<0)D.k[i][3]=vi;return i};
export function loadQ(D,P){// P = {st,vn,k,r}
 D.q=[];D.has=true;const sm=P.st.map(s=>dIx(D,D.st,D.sti,s)),vm=P.vn.map(v=>dIx(D,D.vn,D.vni,v));
 const km=P.k.map(x=>dKey(D,x[0],x[1],x[2],x[3]>=0?vm[x[3]]:-1));
 // مورد السطر: من اللقطة الجديدة (rv)، وفي لقطة قديمة = مورد الصنف
 for(const row of P.r){const a=[],ki=km[row[0]],kv=D.k[ki][3];for(let j=1;j<row.length;j+=4)a.push(sm[row[j]],row[j+1],row[j+2],P.rv?(row[j+3]>=0&&vm[row[j+3]]!==undefined?vm[row[j+3]]:-1):kv);D.q[ki]=a}
 // نصيب المورد الثاني لسطر مكتوب في التقرير بموردين: (صنف*1000+فرع) ← [مورد، رصيد، مبيعات، …]
 D.rc=new Map();const RC=P.rc||[];for(let i=0;i+2<RC.length;i+=3){const key=km[RC[i]]*1000+sm[RC[i+1]];D.rc.set(key,(D.rc.get(key)||0)+RC[i+2])}D.hasRc=D.rc.size>0;
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
/* (v205) سياق التشغيل للنواقص والتحويلات: tr = ما في الطريق (Map صنف*1000+مخزن ← +وارد/−صادر، من طلبات أُنشئت بعد ملف الأرصدة)، nd = مخازن لا تستقبل تحويلاً (ليست فروعاً في المنصة) */
let ENV={tr:null,nd:null,days:0,rcv:null};
export function setEnv(e){ENV={tr:e&&e.tr?e.tr:null,nd:e&&e.nd?e.nd:null,days:e&&e.days>0?e.days:0,rcv:e&&e.rcv?e.rcv:null}}
/* 📥 (v248) المشتريات: صنف استلمه الفرع خلال آخر N يوماً ليس راكداً (لم يأخذ وقته ليُباع). N من «القواعد»، صفر = بلا استثناء */
export const freshOf=C=>{for(const o of (C&&C.ov)||[])if(o&&o.t==="fr")return Math.max(0,Math.min(365,N(o.min)));return 60};
// (صنف*1000+فرع) ← آخر يوم استلام (YYYY-MM-DD) من سطور المشتريات المحمّلة بين from و to
export function rcvMap(D,from,to){const m=new Map();for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){if(!(r[i+4]>0))continue;const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;const k=r[i]*1000+r[i+1],o=m.get(k);if(!o||d>o.d)m.set(k,{d,q:(o?o.q:0)+r[i+4]});else o.q+=r[i+4]}}return m}
/* (v260) المشتريات (ملف المشتريات = الخانة الخامسة في مستندات الشهور) لكود أو لكل الأكواد، في فترة، ولمخزن واحد اختياري:
   المجموع، لكل شهر، لكل مخزن، لكل لون ومقاس، لكل كود، وآخر يوم استلام */
export function purchStat(D,o){
 o=o||{};const from=o.from||"0000",to=o.to||"9999",fs=o.store?D.sti.get(o.store):undefined;if(o.store&&fs===undefined)return null;
 const ids=o.code?new Set((D.code.get(String(o.code).trim())||[]).filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z))):null;if(ids&&!ids.size)return null;
 let q=0,n=0,ret=0,last="";const byM={},byS=new Map(),byV=new Map(),byC=new Map();
 for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){const v=r[i+4];if(!v)continue;const ki=r[i],ti=r[i+1];if(ids&&!ids.has(ki))continue;if(fs!==undefined&&ti!==fs)continue;const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;
  q+=v;n++;if(v<0)ret-=v;else if(d>last)last=d;byM[ym]=(byM[ym]||0)+v;byS.set(ti,(byS.get(ti)||0)+v);byV.set(ki,(byV.get(ki)||0)+v);const c=D.k[ki][0];byC.set(c,(byC.get(c)||0)+v)}}
 const srt=m=>[...m].map(x=>({k:x[0],q:x[1]})).sort((a,b)=>b.q-a.q);
 return {q,n,ret,last,byM,stores:srt(byS),vars:srt(byV),codes:srt(byC)};
}
/* (v276) سجل المشتريات: متى اشترينا وكم مرة (المرة = يوم استلام)، أول وآخر شراء، كل يوم استلام بأصنافه، ولكل لون ومقاس ولكل كود.
   من نفس سطور ملف المشتريات (الخانة الخامسة في مستندات الشهور). vendor = مورد الصنف */
export function purchLog(D,o){
 o=o||{};const from=o.from||"0000",to=o.to||"9999",fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2;if((o.store&&fs===undefined)||(o.vendor&&fv<0))return null;
 const ids=o.code?new Set((D.code.get(String(o.code).trim())||[]).filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z))):null;if(ids&&!ids.size)return null;
 let q=0,n=0,ret=0,first="",last="";const byM={},byD=new Map(),V=new Map(),C=new Map();
 for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){const v=r[i+4];if(!v)continue;const ki=r[i],ti=r[i+1];if(ids&&!ids.has(ki))continue;if(fs!==undefined&&ti!==fs)continue;if(fv!==-2&&D.k[ki][3]!==fv)continue;const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;
  const pos=v>0;q+=v;n++;if(!pos)ret-=v;else{if(!first||d<first)first=d;if(d>last)last=d}byM[ym]=(byM[ym]||0)+v;// السالب = مرتجع للمورد: يدخل الصافي ولا يُحسب «مرة شراء»
  let e=byD.get(d);if(!e){e={d,q:0,p:0,n:0,it:[]};byD.set(d,e)}e.q+=v;e.n++;if(pos)e.p+=v;if(ids)e.it.push([ki,ti,v]);
  let x=V.get(ki);if(!x){x={k:ki,q:0,last:"",ds:new Set()};V.set(ki,x)}x.q+=v;if(pos){x.ds.add(d);if(d>x.last)x.last=d}
  const c=D.k[ki][0];let y=C.get(c);if(!y){y={k:c,vi:D.k[ki][3],q:0,first:"",last:"",ds:new Set()};C.set(c,y)}y.q+=v;if(pos){y.ds.add(d);if(d>y.last)y.last=d;if(!y.first||d<y.first)y.first=d}}}
 const fin=m=>[...m.values()].map(x=>{x.times=x.ds.size;delete x.ds;return x}).sort((a,b)=>b.q-a.q);
 let times=0;byD.forEach(e=>{if(e.p>0)times++});
 return {q,n,ret,first,last,times,byM,dates:[...byD.values()].sort((a,b)=>a.d<b.d?1:-1),vars:fin(V),codes:fin(C)};
}
/* (v209) الكمية المطلوبة للفرع = ما يكفيه cov يوماً من بيعه (ولا تقل عن حد النواقص). cov من القواعد (عنصر {t:"cov",min} داخل ov، الافتراضي 14، صفر = إكمال الحد فقط).
   تعمل فقط حين يُعرف عدد أيام المبيعات (days): من النداء، أو طول الفترة، أو setEnv({days}) لمبيعات «من أول السنة». بلا أيام = إكمال الحد كما كان. */
export const covOf=C=>{for(const o of (C&&C.ov)||[])if(o&&o.t==="cov")return Math.max(0,Math.min(365,N(o.min)));return 14};
/* ترتيب أولوية الأكواد: الأكواد التي تبدأ بهذه الأرقام أولاً بهذا الترتيب، ثم الباقي. محفوظ في cfg.ov كعنصر {t:"pri",s}؛ بلا عنصر = ترتيب محمد */
export const PRI_DEF="111,13,21,22,25,41006,41007,41008";
export const priParse=s=>String(s==null?"":s).split(/[\s,،+;]+/).map(x=>x.replace(/[^0-9A-Za-z\-]/g,"").slice(0,20)).filter(Boolean).slice(0,30);
export const priList=C=>{for(const o of (C&&C.ov)||[])if(o&&o.t==="pri")return priParse(o.s);return priParse(PRI_DEF)};
export const priRank=(L,code)=>{code=String(code||"").trim();let best=L.length,bl=-1;for(let i=0;i<L.length;i++){const p=L[i];if(p.length>bl&&code.indexOf(p)===0){best=i;bl=p.length}}return best};
const spanD=p=>p&&p.from&&p.to?Math.round((new Date(p.to+"T12:00:00")-new Date(p.from+"T12:00:00"))/864e5)+1:0;
const daysOf=o=>o&&o.days>0?o.days:o&&o.period?spanD(o.period):ENV.days||0;
const tgtOf=(mn,sold,days,cov)=>days>0&&cov>0&&sold>0?Math.max(mn,Math.ceil(sold/days*cov)):mn;
// توزيع رصيد المستودع w على سطور مرتّبة (الأعلى مبيعاً أولاً): أولاً يكمل كل فرع حتى الحد (base)، ثم الباقي بنسبة ما ينقص كل فرع ليبلغ أيام التغطية
function allocW(L,w){
 let left=Math.max(0,w);for(const l of L){const g=Math.min(l.base,left);l.give=g;left-=g}
 let ext=0;for(const l of L)ext+=l.need-l.base;if(left<=0||ext<=0)return;
 if(left>=ext){for(const l of L)l.give=l.need;return}
 const pool=left;for(const l of L){const g=Math.floor(pool*(l.need-l.base)/ext);l.give+=g;left-=g}
 for(const l of L){if(left<=0)break;if(l.give<l.need){l.give++;left--}}
}
const way=(ki,ti)=>ENV.tr?ENV.tr.get(ki*1000+ti)||0:0;
// طلبات المنصة التي أُنشئت بعد لحظة ملف الأرصدة (since) لم تدخل في أرصدته: تُضاف لرصيد الفرع المستلم وتُطرح من المصدر (المستودع، أو الفرع المُرسِل في التحويل).
// reqs = [{br:"003", fr:"028"|"", ts, st, rows:[{k,c,z,q,na}]}]. الصنف غير الموجود في الملف والسطر «غير متوفر» يُتجاهلان (فلا يُخفى نقص حقيقي).
export function transitMap(D,reqs,since,whName){
 const m=new Map(),bc=new Map();D.st.forEach((nm,ti)=>{const x=/^(\d{3})-/.exec(nm||"");if(x&&!bc.has(x[1]))bc.set(x[1],ti)});
 const wh=D.sti.get(whName);let n=0,pcs=0;const add=(ki,ti,q)=>{if(ti===undefined)return;const k=ki*1000+ti;m.set(k,(m.get(k)||0)+q)};
 for(const r of reqs||[]){if(!r||!(N(r.ts)>N(since))||r.st==="x")continue;const dst=bc.get(String(r.br||""));if(dst===undefined)continue;const src=r.fr?bc.get(String(r.fr)):wh;let hit=0;
  for(const w of r.rows||[]){if(!w||w.na)continue;const q=Math.round(N(w.q));if(!(q>0))continue;const ki=D.ki.get(String(w.k||"").trim()+SEP+String(w.c||"").trim()+SEP+String(w.z||"").trim());if(ki===undefined)continue;add(ki,dst,q);add(ki,src,-q);pcs+=q;hit=1}
  n+=hit}
 return {m,n,pcs};
}
// نواقص الفروع: رصيد الفرع أقل من الحد والمستودع عنده. المقترح = ما يكمل الحد، ويُوزَّع رصيد المستودع على الأعلى مبيعاً أولاً
export function shortages(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase();
 const om=o.min!=null&&o.min!=="",dys=daysOf(o),cov=covOf(C);
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];if(q&&x[0].toLowerCase().indexOf(q)<0)continue;
  let w=way(ki,wh);for(let j=0;j<a.length;j+=4)if(a[j]===wh)w+=a[j+1];if(w<=0)continue;
  const L=[];
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti))continue;const on=a[j+1],wy=way(ki,ti),ef=on+wy,vi=a[j+3],mn=om?N(o.min):minOf(C,D,ki,vi),ytd=a[j+2],sold=soldOf(P,ki,ti,ytd),tg=tgtOf(mn,sold,dys,cov);if(ef>=tg)continue;
   // (v205) فرع نفد عنده الصنف وكان يبيعه في السنة يبقى محتاجاً حتى لو مبيعاته في الفترة صفر (لا شيء عنده ليبيعه)
   if(o.sold&&sold<=0&&!(P&&ytd>0&&ef<=0))continue;L.push({ki,ti,vi,on,way:wy,sold,ytd,wh:w,mn,tg,need:tg-Math.max(0,ef),base:Math.max(0,Math.min(tg,mn)-Math.max(0,ef)),give:0})}
  if(!L.length)continue;L.sort((p,r)=>r.sold-p.sold||r.ytd-p.ytd);allocW(L,w);
  // فلترا الفرع والمورد بعد التوزيع (فلا يتغيّر «المقترح» بتغيّر الفلتر). المورد = مورد السطر في التقرير
  for(const l of L)if((fs===undefined||l.ti===fs)&&(fv===-2||vHit(D,l.ki,l.ti,l.vi,fv)))out.push(l)}
 return out;
}
// غير متاح بالمستودع ومتاح في فروع ← اقتراح تحويل: من فرع «لا يبيع» (مبيعاته ≤ slow) وعنده أكثر من keep، إلى فرع رصيده أقل من الحد ويبيع (الأعلى مبيعاً أولاً).
// لا يُسحب من فرع كل كميته أبداً: يبقى عنده keep على الأقل.
export function transfers(D,C,o){
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase(),keep=Math.max(0,N(C.keep)),slow=N(C.slow),dys=daysOf(o),cov=covOf(C);
 let skus=0,unmet=0;const BC=new Map(),PU=new Map(),part={skus:0,lines:0,pcs:0,unmetPcs:0};
 // BC: لكل كود خلا منه المستودع وهو في الفروع. part: (v205) أصناف المستودع عنده منها لكنه لا يكفي كل الفروع التي تبيعها: الباقي يُغطّى من فروع لا تبيع.
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;const x=D.k[ki];if(fv!==-2&&x[3]!==fv)continue;if(q&&x[0].toLowerCase().indexOf(q)<0)continue;
  let w=way(ki,wh),any=false;for(let j=0;j<a.length;j+=4){if(a[j]===wh)w+=a[j+1];else if(a[j+1]>0&&!ex.has(a[j]))any=true}const empty=w<=0;if(!any&&empty)continue;let bc=null;
  if(empty){skus++;bc=BC.get(x[0]);if(!bc){bc={code:x[0],vi:x[3],skus:0,on:0,sold:0,st:new Set(),lines:0,pcs:0,unmet:0,unmetPcs:0};BC.set(x[0],bc)}bc.skus++}
  const mn=minOf(C,D,ki),give=[],take=[];
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti))continue;const on=a[j+1],wy=way(ki,ti),ef=on+wy,ytd=a[j+2],sold=soldOf(P,ki,ti,ytd);if(bc){bc.on+=on;bc.sold+=sold;if(sold>0)bc.st.add(ti)}
   // محتاج: رصيده (مع ما في الطريق) أقل من الحد ويبيع الصنف، أو نفد عنده وكان يبيعه في السنة. nd: مخزن ليس فرعاً في المنصة لا يُحوَّل إليه (لكنه يأخذ نصيبه من المستودع في الحساب).
   const tg=tgtOf(mn,sold,dys,cov);if(ef<tg&&(sold>0||(P&&ytd>0&&ef<=0)))take.push({ti,on,way:wy,ef,sold,ytd,tg,want:tg-Math.max(0,ef),need:tg-Math.max(0,ef),base:Math.max(0,Math.min(tg,mn)-Math.max(0,ef)),give:0,nd:!!(ENV.nd&&ENV.nd.has(ti))});
   else if(ef>keep&&sold<=slow)give.push({ti,on,sold,ytd,free:ef-keep})}
  if(!take.length)continue;take.sort((p,r)=>r.sold-p.sold||r.ytd-p.ytd);
  if(!empty){let short=0;allocW(take,w);for(const t of take){t.want-=t.give;if(t.want>0&&!t.nd)short=1}if(!short)continue;part.skus++}
  for(const t of take){if(t.want<=0||t.nd)continue;
   // الأقل مبيعاً أولاً، ثم فرع نحوّل منه لهذا الفرع أصلاً (طلبات أقل)، ثم الأكثر فائضاً
   const G=give.filter(d=>d.free>0).sort((p,r)=>p.sold-r.sold||(PU.get(r.ti*1000+t.ti)||0)-(PU.get(p.ti*1000+t.ti)||0)||r.free-p.free);
   for(const d of G){if(t.want<=0)break;const n=Math.min(d.free,t.want);d.free-=n;t.want-=n;const pk=d.ti*1000+t.ti;PU.set(pk,(PU.get(pk)||0)+1);if(bc){bc.lines++;bc.pcs+=n}else{part.lines++;part.pcs+=n}
    // sure «مؤكد»: المُرسِل لم يبع الصنف طول السنة، والمستلم رصيده صفر (مع ما في الطريق) ويبيعه
    out.push({ki,src:d.ti,fon:d.on,fsold:d.sold,fytd:d.ytd,dst:t.ti,ton:t.on,tsold:t.sold,tytd:t.ytd,tway:t.way,ttg:t.tg,n,part:!empty,sure:d.ytd<=0&&t.ef<=0})}
   if(t.want>0){if(bc){unmet++;bc.unmet++;bc.unmetPcs+=t.want}else part.unmetPcs+=t.want}}}
 const fr=o.from?D.sti.get(o.from):undefined,tt=o.to?D.sti.get(o.to):undefined;
 const codes=[...BC.values()].map(c=>({code:c.code,vi:c.vi,skus:c.skus,on:c.on,sold:c.sold,sell:c.st.size,lines:c.lines,pcs:c.pcs,unmet:c.unmet,unmetPcs:c.unmetPcs})).sort((p,r)=>r.sold-p.sold||r.on-p.on||(p.code<r.code?-1:1));
 return {rows:out.filter(l=>(fr===undefined||l.src===fr)&&(tt===undefined||l.dst===tt)),skus,unmet,codes,part};
}
/* 🗓 (v208) خطة اليوم بترتيب الأولوية: (1) need = فروع لها نواقص يغطيها المستودع، (2) tr = فروع تحتاج أصنافاً ليست في المستودع وتُحوَّل لها من فروع لا تبيعها.
   الترتيب: الفرع الذي يخسر مبيعات أكثر أولاً = مجموع معدل البيع اليومي للأصناف التي رصيده منها صفر (lost)، ثم عدد هذه الأصناف (zero)، ثم القطع. */
export function dayPlan(D,C,o){
 o=o||{};const days=o.days>0?o.days:1,okB=o.isBranch||(()=>true),skip=o.skip||(()=>false),NB=new Map(),TB=new Map();
 const g=(M,ti)=>{let b=M.get(ti);if(!b){b={ti,lines:[],n:0,pcs:0,zero:0,lost:0,srcs:new Set(),sure:0,seen:new Set()};M.set(ti,b)}return b};
 for(const l of shortages(D,C,{sold:1,period:o.period,days:o.days})){if(!(l.give>0)||!okB(l.ti))continue;const b=g(NB,l.ti);b.lines.push(l);b.n++;b.pcs+=l.give;if(l.on+(l.way||0)<=0){b.zero++;b.lost+=Math.max(0,l.sold)/days}}
 for(const l of transfers(D,C,{period:o.period,days:o.days}).rows){if(!okB(l.src)||!okB(l.dst)||skip(l))continue;const b=g(TB,l.dst);b.lines.push(l);b.n++;b.pcs+=l.n;b.srcs.add(l.src);if(l.sure)b.sure+=l.n;
  if(!b.seen.has(l.ki)){b.seen.add(l.ki);if(l.ton+(l.tway||0)<=0){b.zero++;b.lost+=Math.max(0,l.tsold)/days}}}
 const ord=(p,r)=>r.lost-p.lost||r.zero-p.zero||r.pcs-p.pcs||(D.st[p.ti]<D.st[r.ti]?-1:1),fin=M=>[...M.values()].map(b=>({ti:b.ti,lines:b.lines,n:b.n,pcs:b.pcs,zero:b.zero,lost:b.lost,srcs:b.srcs.size,sure:b.sure})).sort(ord);
 const need=fin(NB),tr=fin(TB);
 need.forEach(b=>b.lines.sort((p,r)=>((p.on+(p.way||0)<=0)?0:1)-((r.on+(r.way||0)<=0)?0:1)||r.sold-p.sold||cmpK(D.k[p.ki],D.k[r.ki])));
 tr.forEach(b=>b.lines.sort((p,r)=>p.src!==r.src?(D.st[p.src]<D.st[r.src]?-1:1):cmpK(D.k[p.ki],D.k[r.ki])));
 return {need,tr,days};
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
 o=o||{};const wh=D.sti.get(C.wh),ex=exSet(C,D),out=[],P=o.period?soldMap(D,o.period.from,o.period.to):null,fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2,mn=Math.max(1,N(o.min==null||o.min===""?C.stale:o.min)),q=String(o.q||"").trim().toLowerCase();
 const RV=o.rcv===undefined?ENV.rcv:o.rcv;let fr=0,frq=0;
 for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(!a)continue;if(q&&D.k[ki][0].toLowerCase().indexOf(q)<0)continue;
  for(let j=0;j<a.length;j+=4){const ti=a[j];if(ti===wh||ex.has(ti)||(fs!==undefined&&ti!==fs)||(fv!==-2&&!vHit(D,ki,ti,a[j+3],fv)))continue;if(a[j+1]<mn)continue;const sold=soldOf(P,ki,ti,a[j+2]);if(sold>0)continue;
   if(RV&&(RV.has(ki*1000+ti)||(wh!==undefined&&RV.has(ki*1000+wh)))){fr++;frq+=a[j+1];continue}// (v251) استلمه الفرع حديثاً، أو (v252) استلمه المستودع حديثاً من المورد: بضاعة جديدة تُوزَّع على كل الفروع
   out.push({ki,ti,vi:a[j+3],on:a[j+1],sold})}}
 out.sort((p,r)=>r.on-p.on);out.fresh=fr;out.freshQ=frq;return out;
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
 for(const ym in D.d){if(ym+"-31"<o.from||ym+"-01">o.to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){if(!ids.has(r[i]))continue;if(fs!==undefined&&r[i+1]!==fs)continue;const d=ymd(ym,r[i+2]);if(d<o.from||d>o.to)continue;const n=r[i+3];if(!n)continue;
   total+=n;if(n<0)ret-=n;byDay[d]=(byDay[d]||0)+n;bySt[r[i+1]]=(bySt[r[i+1]]||0)+n;byK[r[i]]=(byK[r[i]]||0)+n}}
 return {total,ret,byDay,bySt,byK};
}
// (v276) مبيعات كل الأكواد في فترة (وفرع ومورد اختيارياً) من ملفات التاريخ: المجموع، يوماً بيوم، لكل فرع، ولكل كود
export function salesOverview(D,o){
 o=o||{};const fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2;if((o.store&&fs===undefined)||(o.vendor&&fv<0))return null;
 let total=0,ret=0;const byDay={},bySt={},C=new Map();
 for(const ym in D.d){if(ym+"-31"<o.from||ym+"-01">o.to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){const n=r[i+3];if(!n)continue;const ki=r[i],ti=r[i+1];if(fs!==undefined&&ti!==fs)continue;if(fv!==-2&&D.k[ki][3]!==fv)continue;const d=ymd(ym,r[i+2]);if(d<o.from||d>o.to)continue;
  total+=n;if(n<0)ret-=n;byDay[d]=(byDay[d]||0)+n;bySt[ti]=(bySt[ti]||0)+n;const c=D.k[ki][0];C.set(c,(C.get(c)||0)+n)}}
 return {total,ret,byDay,bySt,codes:[...C].map(x=>({k:x[0],q:x[1]})).sort((a,b)=>b.q-a.q)};
}
/* (v277) 💰 قيمة مبيعات الفروع بالريال: تقرير Power BI بأعمدة (السنة، الشهر، اليوم، الفرع، Net Sales WoTax) بلا أكواد.
   مجموعة مستقلة stkv (لمن له صلاحية sv فقط): stkv/meta + stkv/y2026 (مضغوط). كل ملف يستبدل أيام فترته فقط */
const VAMT=["net sales wotax","net sales w/o tax","net sales","net_sales","sales amount","sales_amount","net amount","amount","قيمة المبيعات","المبيعات بالريال","صافي المبيعات","القيمة"];
export function ingestV(){
 let H=null,n=0,sum=0;const st=[],sti=new Map(),rows=[],days=new Set(),tot={},R={from:"",to:"",bad:0,nan:0,trunc:false};
 const head=row=>{const low=row.map(c=>String(c).trim().toLowerCase()),fi=a=>low.findIndex(c=>a.indexOf(c)>=0),h={st:fi(HMAP.store),am:fi(VAMT),dt:fi(HMAP.dt)};
  for(const p of [["yr","year"],["mo","month"],["dy","day"]]){let i=fi(HMAP[p[0]]);if(i<0)i=low.findIndex(c=>c.indexOf(" - ")>0&&c.split(" - ").pop().trim()===p[1]);h[p[0]]=i}
  return fi(HMAP.code)>=0||h.st<0||h.am<0||!((h.mo>=0&&h.dy>=0)||h.dt>=0)?null:h};
 function row(r){
  if(!r.length)return;if(!H){H=head(r);return}
  for(const c of r){const s=String(c==null?"":c);if(s.length<20)continue;if(/exceeded the allowed volume/i.test(s))R.trunc=true;
   let m=/on or after (\d{1,2})\/(\d{1,2})\/(\d{4}) and is before (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
   if(m){const us=+m[2]>12||+m[5]>12,dm=(a,b,y)=>y+"-"+p2(us?+a:+b)+"-"+p2(us?+b:+a);R.from=dm(m[1],m[2],m[3]);R.to=dm(m[4],m[5],m[6])}
   else{m=/on or after (\d{1,2})-([A-Za-z]{3})-(\d{2,4}) and is before (\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(s);if(m){const y=x=>x.length===2?2000+(+x):+x;R.from=y(m[3])+"-"+p2(MON[m[2].toLowerCase()]||1)+"-"+p2(+m[1]);R.to=y(m[6])+"-"+p2(MON[m[5].toLowerCase()]||1)+"-"+p2(+m[4])}}}
  const store=String(r[H.st]==null?"":r[H.st]).trim();
  if(!store){if(r.some(c=>/^total$/i.test(String(c==null?"":c).trim()))){const a=num(r[H.am]);if(a===a)tot.am=a}return}
  let y=0,mo=0,dy=0;if(H.dt>=0&&H.mo<0){const d=dateOf(r[H.dt]);if(!d){R.bad++;return}y=d[0];mo=d[1];dy=d[2]}else{y=H.yr>=0?N(r[H.yr]):new Date().getFullYear();mo=moNum(r[H.mo]);dy=N(r[H.dy])}
  if(!(y>=2000&&y<=2100&&mo>=1&&mo<=12&&dy>=1&&dy<=new Date(y,mo,0).getDate())){R.bad++;return}
  const a=num(r[H.am]);if(a!==a){R.nan++;return}
  let ti=sti.get(store);if(ti===undefined){ti=st.length;st.push(store);sti.set(store,ti)}
  const d=y+"-"+p2(mo)+"-"+p2(dy);rows.push({d,s:store,a});sum+=a;n++;days.add(d)}
 return {row,done:()=>Object.assign(R,{ok:!!H,type:"v",n,st,rows,days:[...days].sort(),sum,tot})};
}
const r2=x=>Math.round(x*100)/100;
// صفوف سنة واحدة ← نص مضغوط الشكل: {y, st:[فروع], r:[شهر*100+يوم، فرع، مبلغ…]} (المكرر لنفس اليوم والفرع يُجمع)
export function valPack(year,rows){
 const st=[],sti=new Map(),m=new Map();for(const x of rows){if(x.d.slice(0,4)!==String(year))continue;let ti=sti.get(x.s);if(ti===undefined){ti=st.length;st.push(x.s);sti.set(x.s,ti)}const k=(+x.d.slice(5,7)*100+(+x.d.slice(8,10)))*1000+ti;m.set(k,(m.get(k)||0)+x.a)}
 const r=[];[...m.keys()].sort((a,b)=>a-b).forEach(k=>{r.push(Math.floor(k/1000),k%1000,r2(m.get(k)))});return JSON.stringify({y:+year,st,r})};
export function valUnpack(o){const out=[];if(!o||!Array.isArray(o.r)||!Array.isArray(o.st))return out;for(let i=0;i+2<o.r.length;i+=3){const md=o.r[i];out.push({d:o.y+"-"+p2(Math.floor(md/100))+"-"+p2(md%100),s:String(o.st[o.r[i+1]]||""),a:N(o.r[i+2])})}return out}
// يستبدل أيام الفترة [from,to] (شاملة) بصفوف الملف الجديد ويبقي ما عداها
export const valMerge=(old,nw,from,to)=>(old||[]).filter(x=>x.d<from||x.d>to).concat((nw||[]).filter(x=>x.d>=from&&x.d<=to));
// مدى تواريخ مغطّاة (نصوص YYYY-MM-DD): يضيف [a,b] ويدمج المتلاصق
export const cvDates=(list,a,b,nextDay)=>{const L=(list||[]).filter(r=>Array.isArray(r)&&r.length===2).map(r=>[String(r[0]),String(r[1])]);if(a&&b&&a<=b)L.push([a,b]);L.sort((p,r)=>p[0]<r[0]?-1:1);const o=[];for(const r of L){const l=o[o.length-1];if(l&&r[0]<=nextDay(l[1])){if(r[1]>l[1])l[1]=r[1]}else o.push([r[0],r[1]])}return o.slice(0,24)};
// ملخّص الفترة: المجموع، يوماً بيوم، لكل شهر، لكل فرع (ومتوسط يومه)، وجدول الفرع × الشهر
export function valStats(rows,o){
 o=o||{};const from=o.from||"0000",to=o.to||"9999",byDay={},byM={},S=new Map();let total=0,n=0;
 for(const x of rows||[]){if(x.d<from||x.d>to)continue;if(o.store&&x.s!==o.store)continue;total+=x.a;n++;byDay[x.d]=(byDay[x.d]||0)+x.a;const ym=x.d.slice(0,7);byM[ym]=(byM[ym]||0)+x.a;
  let e=S.get(x.s);if(!e){e={s:x.s,a:0,ds:new Set(),m:{}};S.set(x.s,e)}e.a+=x.a;e.ds.add(x.d);e.m[ym]=(e.m[ym]||0)+x.a}
 const days=Object.keys(byDay).sort();let best="";for(const d of days)if(!best||byDay[d]>byDay[best])best=d;
 const stores=[...S.values()].map(e=>({s:e.s,a:e.a,days:e.ds.size,m:e.m})).sort((a,b)=>b.a-a.a);
 return {total,n,days,byDay,byM,months:Object.keys(byM).sort(),stores,best,avg:days.length?total/days.length:0};
}
/* ---- (v174) بطاقات «اسأل»: كل رقم هنا جمع مباشر من صفوف الملفين، بلا تقدير ---- */
// يمرّ على صفوف ملفات التاريخ داخل الفترة: fn(صنف، فرع، اليوم، الكمية)
const scan=(D,from,to,fn)=>{for(const ym in D.d){if(ym+"-31"<from||ym+"-01">to)continue;const r=D.d[ym];for(let i=0;i<r.length;i+=5){if(!r[i+3])continue;const d=ymd(ym,r[i+2]);if(d<from||d>to)continue;fn(r[i],r[i+1],d,r[i+3])}}};// (v248) سطور المشتريات (مبيعها صفر) لا تُحسب أيام بيع
// بطاقة فرع: عنده كم، باع كم، نواقصه وراكده وما نفد وهو يبيع، أعلى الأصناف مبيعاً، وترتيبه بين الفروع.
// المبيعات: من ملف الكميات (من أول السنة) أو من ملفات التاريخ لو حُدّدت فترة {from,to}
export function storeCard(D,C,store,period){
 const ti=D.sti.get(store);if(ti===undefined)return null;
 const P=period?soldMap(D,period.from,period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),tot=[];for(let i=0;i<D.st.length;i++)tot.push(0);
 let on=0,neg=0,negN=0,skus=0,inSt=0,sold=0,rc=0;const byC=new Map(),byV=new Map(),out=[];
 for(let ki=0;ki<D.k.length;ki++){const a=D.q[ki],x=D.k[ki];let o=0,s=0,has=false,w=0,rv=x[3];
  if(a)for(let j=0;j<a.length;j+=4){if(a[j]===ti){o+=a[j+1];s+=a[j+2];has=true;rv=a[j+3]}if(a[j]===wh)w+=a[j+1];if(!P)tot[a[j]]+=a[j+2]}
  if(P)s=P.get(ki*1000+ti)||0;if(!has&&!s)continue;
  const g=rcOf(D,ki,ti);rc+=g;
  skus++;if(o>0)inSt++;else if(o<0){neg+=o;negN++}on+=o;sold+=s;
  let c=byC.get(x[0]);if(!c){c={code:x[0],on:0,sold:0,rc:0};byC.set(x[0],c)}c.on+=o;c.sold+=s;c.rc+=g;
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
 return {ti,isWh:ti===wh,on,neg,negN,skus,inSt,sold,rc:D.hasRc?rc:null,ret,gross,days,rank:inRank&&sold>0?rank+1:0,of:inRank?of:0,share:inRank&&all>0?sold/all:null,short,idle,
  out:out.sort((p,r)=>r.sold-p.sold),top:[...byC.values()].filter(c=>c.sold>0).sort((p,r)=>r.sold-p.sold||(p.code<r.code?-1:1)),vendors:[...byV.values()].sort((p,r)=>r.sold-p.sold||r.on-p.on)};
}
// بطاقة صنف (كود، ولون ومقاس وفرع اختيارياً): الأرصدة من ملف الكميات، والمبيعات منه أو من ملفات التاريخ لو حُدّدت فترة.
// drange = مدى ملفات التاريخ المحمَّلة لحساب أيام البيع وأول وآخر بيع والمرتجع عندما لا فترة محددة
export function codeCard(D,C,code,o){
 o=o||{};const all=D.code.get(String(code||"").trim());if(!all||!all.length)return null;
 const ids=all.filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z)).sort((p,r)=>cmpK(D.k[p],D.k[r]));if(!ids.length)return {none:true,ids};
 const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),fs=o.store?D.sti.get(o.store):undefined,S=new Map(),vars=[];
 const exS=exSet(C,D);// المستلم «في الفروع» = بلا مخزن المستودع والمخازن المستثناة (كالترتيب)
 const sOf=ti=>{let s=S.get(ti);if(!s){s={ti,on:0,sold:0,rc:0,last:""};S.set(ti,s)}return s};
 for(const ki of ids){const a=D.q[ki]||[],v={ki,on:0,sold:0,wh:0,br:0,rc:0};
  for(let j=0;j<a.length;j+=4){const ti=a[j],s=sOf(ti),g=rcOf(D,ki,ti);s.on+=a[j+1];s.rc+=g;if(!P)s.sold+=a[j+2];if(ti===wh)v.wh+=a[j+1];else v.br+=a[j+1];if(fs===undefined?(ti!==wh&&!exS.has(ti)):ti===fs)v.rc+=g;if(fs===undefined||ti===fs){v.on+=a[j+1];if(!P)v.sold+=a[j+2]}}
  if(P)for(let ti=0;ti<D.st.length;ti++){const x=P.get(ki*1000+ti);if(x){sOf(ti).sold+=x;if(fs===undefined||ti===fs)v.sold+=x}}
  vars.push(v)}
 let whOn=0,allOn=0,allSold=0;S.forEach(s=>{allOn+=s.on;allSold+=s.sold;if(s.ti===wh)whOn+=s.on});
 const R=o.period||o.drange||null;let ret=null,gross=null,days=null,first="",last="";
 if(R){const idset=new Set(ids),ds=new Set();ret=0;gross=0;scan(D,R.from,R.to,(ki,ti,d,n)=>{if(!idset.has(ki))return;if(n>0){const s=sOf(ti);if(d>s.last)s.last=d}if(fs!==undefined&&ti!==fs)return;
   if(n<0)ret-=n;else if(n>0){gross+=n;ds.add(d);if(!first||d<first)first=d;if(d>last)last=d}});days=ds.size}
 let rcBr=0;S.forEach(s=>{if(s.ti!==wh&&!exS.has(s.ti))rcBr+=s.rc});// المستلم في الفروع (بلا مخزن المستودع)
 const stores=[...S.values()].filter(s=>s.on!==0||s.sold!==0||s.rc!==0).sort((p,r)=>r.sold-p.sold||r.on-p.on||(D.st[p.ti]<D.st[r.ti]?-1:1));
 const me=fs!==undefined?(S.get(fs)||{ti:fs,on:0,sold:0,rc:0,last:""}):null,brs=stores.filter(s=>s.ti!==wh);
 const on=me?me.on:allOn,sold=me?me.sold:allSold;
 return {rc:D.hasRc?(me?me.rc:rcBr):null,ids,vendor:D.k[ids[0]][3],wh:whOn,br:allOn-whOn,allOn,allSold,on,sold,ret,gross,days,first,last,dated:!!R,dnet:R?gross-ret:null,stores,vars,me,
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
/* ---- (v180) الترتيب، «مين عنده»، المورد، المقارنة: جمع مباشر من الصفوف كما في البطاقات ---- */
// يمرّ على كل (صنف، فرع، مورد): fn(صنف، فرع، مورد، رصيد، مبيعات). السطر المكتوب في التقرير بموردين يُقسم بنصيب كلٍّ منهما (كبطاقة الفرع).
// المبيعات من ملف الكميات، أو من ملفات التاريخ لو أُعطيت P (وتُنسب لمورد السطر، أو لمورد الصنف لو لم يكن له سطر في ملف الكميات)
function eachCell(D,P,ids,fn){
 const seen=P?new Set():null,idset=ids?new Set(ids):null;
 const one=ki=>{const a=D.q[ki];if(!a)return;for(let j=0;j<a.length;j+=4){const ti=a[j],key=ki*1000+ti,sp=D.vx?D.vx.get(key):null;let mo=a[j+1],ms=P?0:a[j+2];
   if(P&&!seen.has(key)){seen.add(key);ms=P.get(key)||0}
   if(sp)for(let i=0;i<sp.length;i+=3){mo-=sp[i+1];if(!P)ms-=sp[i+2];fn(ki,ti,sp[i],sp[i+1],P?0:sp[i+2])}
   fn(ki,ti,a[j+3],mo,ms)}};
 if(ids)ids.forEach(one);else for(let ki=0;ki<D.q.length;ki++)one(ki);
 if(P)P.forEach((v,key)=>{if(seen.has(key))return;const ki=Math.floor(key/1000);if(idset&&!idset.has(ki))return;fn(ki,key%1000,D.k[ki][3],0,v)});
}
const idsOf=(D,o)=>o.code?(D.code.get(String(o.code).trim())||[]).filter(ki=>(!o.cl||D.k[ki][1]===o.cl)&&(!o.z||D.k[ki][2]===o.z)):((o.zs&&o.zs.length)||(o.cls&&o.cls.length))?attrIds(D,o):null;
// (v210) أصناف كل الأكواد التي مقاسها/لونها من القائمة (سؤال «مقاس 40 في كل الأصناف»)
const attrIds=(D,o)=>{const zs=o.zs&&o.zs.length?new Set(o.zs):null,cs=o.cls&&o.cls.length?new Set(o.cls):null,a=[];for(let ki=0;ki<D.k.length;ki++){const x=D.k[ki];if((!zs||zs.has(x[2]))&&(!cs||cs.has(x[1])))a.push(ki)}return a};
/* (v210) بطاقة مقاس أو لون على كل الأكواد: المبيعات والرصيد ونصيبه من كل المبيعات وترتيبه بين المقاسات، ولكل فرع ولكل كود.
   كل رقم جمع مباشر من نفس صفوف الملفين (eachCell)، فالسطر المكتوب بموردين يُقسم كما في باقي البطاقات */
export function attrCard(D,C,o){
 o=o||{};const zs=o.zs&&o.zs.length?new Set(o.zs):null,cs=o.cls&&o.cls.length?new Set(o.cls):null;if(!zs&&!cs)return null;
 const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2;
 if((o.store&&fs===undefined)||(o.vendor&&fv<0))return null;
 const byCl=cs&&!zs,hit=ki=>{const x=D.k[ki];return (!zs||zs.has(x[2]))&&(!cs||cs.has(x[1]))};
 let sold=0,on=0,brOn=0,whOn=0,all=0;const G=new Map(),ST=new Map(),CD=new Map(),allZ=new Map(),stAll=new Map();
 eachCell(D,P,null,(ki,ti,vi,o1,s1)=>{if(fv!==-2&&vi!==fv)return;const x=D.k[ki],br=ti!==wh&&!ex.has(ti);
  if(fs===undefined||ti===fs){all+=s1;if(x[2])allZ.set(x[2],(allZ.get(x[2])||0)+s1)}
  if(br)stAll.set(ti,(stAll.get(ti)||0)+s1);
  if(!hit(ki))return;
  let c=CD.get(x[0]);if(!c){c={code:x[0],vi:x[3],sold:0,on:0,wh:0};CD.set(x[0],c)}if(ti===wh){c.wh+=o1;whOn+=o1}
  if(br){let e=ST.get(ti);if(!e){e={ti,sold:0,on:0};ST.set(ti,e)}e.sold+=s1;e.on+=o1}
  if(fs!==undefined&&ti!==fs)return;
  sold+=s1;on+=o1;if(br)brOn+=o1;c.sold+=s1;c.on+=o1;
  const gk=byCl?x[1]:x[2];let g=G.get(gk);if(!g){g={k:gk,sold:0,on:0,wh:0};G.set(gk,g)}g.sold+=s1;g.on+=o1;if(ti===wh)g.wh+=o1});
 // ترتيب المقاس بين كل المقاسات (في نفس الفرع والمورد والفترة)
 const allL=[...allZ.values()],rankOf=v=>1+allL.filter(x=>x>v).length;
 const groups=[...G.values()].map(g=>Object.assign(g,{share:all>0?g.sold/all:null,rank:cs?0:rankOf(g.sold)}));
 groups.sort(byCl?(p,r)=>r.sold-p.sold:(p,r)=>zk(p.k)-zk(r.k)||(p.k<r.k?-1:p.k>r.k?1:0));
 const stores=[...ST.values()].map(e=>Object.assign(e,{share:stAll.get(e.ti)>0?e.sold/stAll.get(e.ti):null})).sort((p,r)=>r.sold-p.sold||r.on-p.on);
 const codes=[...CD.values()].filter(c=>c.sold!==0||c.on!==0||c.wh!==0).sort((p,r)=>r.sold-p.sold||r.on-p.on||(p.code<r.code?-1:1));
 return {sold,on,br:brOn,wh:whOn,all,share:all>0?sold/all:null,rank:!cs&&zs.size===1?rankOf(sold):0,of:allZ.size,groups,stores,codes,
  nCodes:codes.length,nSold:codes.filter(c=>c.sold>0).length,noWh:codes.filter(c=>c.sold>0&&c.wh<=0).length,byCl};
}
// ترتيب «أكثر/أقل»: by = code | store | vendor | color | size | var (لون ومقاس الكود)، m = sold | on، dir = -1 الأعلى أولاً، 1 الأقل أولاً.
// ترتيب الفروع بلا المستودع والمخازن المستثناة (كترتيب بطاقة الفرع)، ويشمل كل فرع حتى لو صفر. غير ذلك: كل المخازن (كبطاقة الصنف).
export function rankBy(D,C,o){
 o=o||{};const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),fs=o.store?D.sti.get(o.store):undefined,fv=o.vendor?D.vn.indexOf(o.vendor):-2;
 if((o.store&&fs===undefined)||(o.vendor&&fv<0))return null;const ids=idsOf(D,o);if(ids&&!ids.length)return null;
 const by=o.by||(o.code?(o.store?"var":"store"):"code"),m=o.m==="on"?"on":o.m==="rc"&&D.hasRc?"rc":"sold",om=m==="sold"?"on":"sold",dir=o.dir===1?1:-1,G=new Map();// (v191) m = rc: المستلم من أول السنة (بلا مخزن المستودع والمخازن المستثناة، إلا لو المطلوب هو المستودع نفسه)
 const gk=(ki,ti,vi)=>by==="code"?D.k[ki][0]:by==="store"?ti:by==="vendor"?vi:by==="color"?D.k[ki][1]:by==="size"?D.k[ki][2]:ki;
 if(by==="store")for(let ti=0;ti<D.st.length;ti++)if(ti!==wh&&!ex.has(ti)&&(fs===undefined||ti===fs))G.set(ti,{k:ti,on:0,sold:0,rc:0});
 eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{if(fs!==undefined&&ti!==fs)return;if(fv!==-2&&vi!==fv)return;if(by==="store"&&(ti===wh||ex.has(ti)))return;
  const k=gk(ki,ti,vi);let g=G.get(k);if(!g){g={k,on:0,sold:0,rc:0};G.set(k,g)}g.on+=on;g.sold+=sold});
 if(D.hasRc){const idset=ids?new Set(ids):null;D.rc.forEach((v,key)=>{const ki=Math.floor(key/1000),ti=key%1000;if(idset&&!idset.has(ki))return;if(fs!==undefined?ti!==fs:(ti===wh||ex.has(ti)))return;
   let vi=D.k[ki][3];const a=D.q[ki];if(a)for(let j=0;j<a.length;j+=4)if(a[j]===ti){vi=a[j+3];break}// المستلم يُنسب لمورد السطر
   if(fv!==-2&&vi!==fv)return;const k=gk(ki,ti,vi);let g=G.get(k);if(!g){g={k,on:0,sold:0,rc:0};G.set(k,g)}g.rc+=v})}
 const lab=g=>by==="store"?D.st[g.k]:by==="vendor"?(g.k>=0?D.vn[g.k]||"":""):by==="var"?"":String(g.k);
 const rows=[...G.values()].filter(g=>by==="store"||g.on!==0||g.sold!==0||g.rc!==0).sort((p,r)=>dir*(p[m]-r[m])||(r[om]-p[om])||(by==="var"?cmpK(D.k[p.k],D.k[r.k]):by==="size"?zk(lab(p))-zk(lab(r))||(lab(p)<lab(r)?-1:lab(p)>lab(r)?1:0):lab(p)<lab(r)?-1:lab(p)>lab(r)?1:0));
 let on=0,sold=0,rc=0;for(const g of rows){on+=g.on;sold+=g.sold;rc+=g.rc}
 return {by,m,dir,rows,on,sold,rc};
}
// «مين عنده الصنف؟»: المخازن التي لها رصيد منه (المستودع أولاً ثم الأكثر رصيداً)، والفروع التي نفد عندها وهي تبيعه
export function whoHas(D,C,code,o){
 o=o||{};const ids=idsOf(D,{code,cl:o.cl,z:o.z});if(!ids||!ids.length)return null;const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),S=new Map();
 eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{let s=S.get(ti);if(!s){s={ti,on:0,sold:0};S.set(ti,s)}s.on+=on;s.sold+=sold});
 const all=[...S.values()],nm=(p,r)=>D.st[p.ti]<D.st[r.ti]?-1:1;
 const has=all.filter(s=>s.on>0).sort((p,r)=>(p.ti===wh?-1:r.ti===wh?1:0)||r.on-p.on||r.sold-p.sold||nm(p,r));
 const out=all.filter(s=>s.on<=0&&s.sold>0&&s.ti!==wh).sort((p,r)=>r.sold-p.sold||nm(p,r));
 let on=0;for(const s of has)on+=s.on;const w=S.get(wh);
 return {ids,has,out,on,wh:w?w.on:0,n:has.filter(s=>s.ti!==wh).length};
}
// بطاقة مورد: رصيده ومبيعاته (في كل الفروع أو فرع واحد)، أكواده، كل فرع، ترتيبه بين الموردين، نواقصه وراكده، وما نفد من المستودع وهو يُباع
export function vendorCard(D,C,vendor,o){
 o=o||{};const fv=D.vn.indexOf(vendor);if(fv<0||!vendor)return null;const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),fs=o.store?D.sti.get(o.store):undefined;if(o.store&&fs===undefined)return null;
 let on=0,sold=0,whOn=0;const byC=new Map(),byS=new Map(),ks=new Set(),ksOn=new Map();
 eachCell(D,P,null,(ki,ti,vi,o1,s1)=>{if(vi!==fv)return;const x=D.k[ki];let c=byC.get(x[0]);if(!c){c={code:x[0],on:0,sold:0,wh:0};byC.set(x[0],c)}if(ti===wh)c.wh+=o1;
  if(fs!==undefined&&ti!==fs)return;on+=o1;sold+=s1;if(ti===wh)whOn+=o1;c.on+=o1;c.sold+=s1;
  let s=byS.get(ti);if(!s){s={ti,on:0,sold:0};byS.set(ti,s)}s.on+=o1;s.sold+=s1;if(o1!==0||s1!==0)ks.add(ki);ksOn.set(ki,(ksOn.get(ki)||0)+o1)});
 const codes=[...byC.values()].filter(c=>c.on!==0||c.sold!==0).sort((p,r)=>r.sold-p.sold||r.on-p.on||(p.code<r.code?-1:1));
 const reorder=codes.filter(c=>c.sold>0&&c.wh<=0);
 const RV=rankBy(D,C,{by:"vendor",store:o.store,period:o.period}),sv=RV?RV.rows.filter(r=>r.sold>0):[],me=sv.findIndex(r=>r.k===fv);
 const SH=shortages(D,C,{vendor,store:o.store,period:o.period,sold:1}),ST=stale(D,C,{vendor,store:o.store,period:o.period});
 let inSt=0;ksOn.forEach(v=>{if(v>0)inSt++});
 return {fv,on,sold,wh:whOn,br:on-whOn,skus:ks.size,inSt,codes,reorder,stores:[...byS.values()].filter(s=>s.on!==0||s.sold!==0).sort((p,r)=>r.sold-p.sold||r.on-p.on||(D.st[p.ti]<D.st[r.ti]?-1:1)),
  rank:me>=0?me+1:0,of:sv.length,share:RV&&RV.sold>0?sold/RV.sold:null,short:{n:SH.length,need:SH.reduce((s,l)=>s+l.need,0)},idle:{n:ST.length,pcs:ST.reduce((s,l)=>s+l.on,0)}};
}
// مقارنة فروع (2–4) جنباً إلى جنب: لكل فرع رصيده ومبيعاته وأصنافه، ولكل كود (أو لكل لون ومقاس لو حُدّد كود) رصيده ومبيعاته في كل فرع (الأعلى مبيعاً في الفروع معاً أولاً)
export function cmpStores(D,C,stores,o){
 o=o||{};const tis=[];for(const s of stores||[]){const ti=D.sti.get(s);if(ti!==undefined&&tis.indexOf(ti)<0)tis.push(ti)}if(tis.length<2)return null;
 const ids=idsOf(D,o);if(ids&&!ids.length)return null;const fv=o.vendor?D.vn.indexOf(o.vendor):-2;if(o.vendor&&fv<0)return null;
 const P=o.period?soldMap(D,o.period.from,o.period.to):null,col=new Map(tis.map((t,i)=>[t,i])),tot=tis.map(ti=>({ti,on:0,sold:0})),cell=new Map(),byC=new Map();
 eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{const i=col.get(ti);if(i===undefined||(fv!==-2&&vi!==fv))return;tot[i].on+=on;tot[i].sold+=sold;
  const k=ki*8+i;let c=cell.get(k);if(!c){c=[0,0];cell.set(k,c)}c[0]+=on;c[1]+=sold;
  const gk=ids?ki:D.k[ki][0];let r=byC.get(gk);if(!r){r={k:gk,v:tis.map(()=>({on:0,sold:0})),sold:0};byC.set(gk,r)}r.v[i].on+=on;r.v[i].sold+=sold;r.sold+=sold});
 tot.forEach(t=>{t.inSt=0;t.out=0});cell.forEach((c,k)=>{const t=tot[k%8];if(c[0]>0)t.inSt++;if(c[0]<=0&&c[1]>0)t.out++});
 const rows=[...byC.values()].filter(r=>r.v.some(x=>x.on!==0||x.sold!==0)).sort((p,r)=>r.sold-p.sold||(ids?cmpK(D.k[p.k],D.k[r.k]):p.k<r.k?-1:1));
 return {tis,tot,rows,by:ids?"var":"code"};
}
// مقارنة فترتين (أ = الفترة المسؤول عنها، ب = التي تُقارن بها) من ملفات التاريخ: المجموع والمرتجع وأيام البيع، والأكثر صعوداً وهبوطاً.
// التجميع: بالكود؛ ولكود بعينه: بالفرع؛ ولكود في فرع: باللون والمقاس
export function cmpPeriods(D,C,o){
 o=o||{};const A=o.a,B=o.b;if(!A||!B)return null;const fs=o.store?D.sti.get(o.store):undefined;if(o.store&&fs===undefined)return null;const ids=idsOf(D,o);if(ids&&!ids.length)return null;
 const idset=ids?new Set(ids):null,fv=o.vendor?D.vn.indexOf(o.vendor):-2;if(o.vendor&&fv<0)return null;
 let vm=null;if(fv!==-2){vm=new Map();for(let ki=0;ki<D.q.length;ki++){const a=D.q[ki];if(a)for(let j=0;j<a.length;j+=4)if(!vm.has(ki*1000+a[j]))vm.set(ki*1000+a[j],a[j+3])}}
 const by=o.code?(o.store?"var":"store"):"code",S={a:{sold:0,ret:0,days:new Set()},b:{sold:0,ret:0,days:new Set()}},G=new Map();
 const from=A.from<B.from?A.from:B.from,to=A.to>B.to?A.to:B.to;
 scan(D,from,to,(ki,ti,d,n)=>{if(idset&&!idset.has(ki))return;if(fs!==undefined&&ti!==fs)return;if(vm){const v=vm.has(ki*1000+ti)?vm.get(ki*1000+ti):D.k[ki][3];if(v!==fv)return}
  const inA=d>=A.from&&d<=A.to,inB=d>=B.from&&d<=B.to;if(!inA&&!inB)return;const k=by==="code"?D.k[ki][0]:by==="store"?ti:ki;let g=G.get(k);if(!g){g={k,a:0,b:0};G.set(k,g)}
  if(inA){g.a+=n;S.a.sold+=n;if(n<0)S.a.ret-=n;else if(n>0)S.a.days.add(d)}if(inB){g.b+=n;S.b.sold+=n;if(n<0)S.b.ret-=n;else if(n>0)S.b.days.add(d)}});
 const rows=[...G.values()].filter(g=>g.a!==0||g.b!==0);rows.forEach(g=>{g.d=g.a-g.b});
 const key=g=>by==="store"?D.st[g.k]:by==="var"?D.k[g.k].join(" "):String(g.k),kc=(p,r)=>key(p)<key(r)?-1:key(p)>key(r)?1:0;
 return {by,a:{sold:S.a.sold,ret:S.a.ret,days:S.a.days.size},b:{sold:S.b.sold,ret:S.b.ret,days:S.b.days.size},rows:rows.sort((p,r)=>r.a-p.a||r.b-p.b||kc(p,r)),
  up:rows.filter(g=>g.d>0).sort((p,r)=>r.d-p.d||kc(p,r)),down:rows.filter(g=>g.d<0).sort((p,r)=>p.d-r.d||kc(p,r))};
}
/* ---- (v182) مقارنة أكواد (2–15): أيها الأعلى مبيعاً، ورصيد كلٍّ منها، ومن الأعلى في كل فرع ---- */
export function cmpCodes(D,C,codes,o){
 o=o||{};const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),fs=o.store?D.sti.get(o.store):undefined;if(o.store&&fs===undefined)return null;
 const L=[];for(const code of codes||[]){const ids=D.code.get(code);if(!ids||!ids.length||L.some(r=>r.code===code))continue;const r={code,on:0,sold:0,wh:0,st:new Map()};
  eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{if(ti===wh)r.wh+=on;let s=r.st.get(ti);if(!s){s={on:0,sold:0};r.st.set(ti,s)}s.on+=on;s.sold+=sold;if(fs!==undefined&&ti!==fs)return;r.on+=on;r.sold+=sold});
  r.nSold=0;r.st.forEach((s,ti)=>{if(ti!==wh&&s.sold>0)r.nSold++});r.thru=r.sold+Math.max(0,r.on)>0&&r.sold>=0?r.sold/(r.sold+Math.max(0,r.on)):null;L.push(r)}
 if(L.length<2)return null;let tot=0;for(const r of L)tot+=r.sold;
 const rows=L.sort((p,r)=>r.sold-p.sold||r.on-p.on||(p.code<r.code?-1:1));rows.forEach(r=>{r.share=tot>0?r.sold/tot:null;r.wins=0});
 const stores=[];for(let ti=0;ti<D.st.length;ti++){if(ti===wh||ex.has(ti)||(fs!==undefined&&ti!==fs))continue;const v=rows.map(r=>r.st.get(ti)||{on:0,sold:0});if(!v.some(x=>x.on||x.sold))continue;
  const mx=Math.max.apply(null,v.map(x=>x.sold));if(mx>0)v.forEach((x,i)=>{if(x.sold===mx)rows[i].wins++});stores.push({ti,v,sold:v.reduce((s,x)=>s+x.sold,0),mx})}
 stores.sort((p,r)=>r.sold-p.sold||(D.st[p.ti]<D.st[r.ti]?-1:1));
 return {rows,stores,tot};
}
/* ---- (v186) الشراء المقترح ---- */
// كود يُباع، وله كمية مطلوبة، و(المستودع خالٍ منه أو رصيده كله يكفي أقل من alert يوماً بمعدل بيعه).
// الكمية لكل لون ومقاس = ما يكفي horizon يوماً بمعدل بيع هذا اللون والمقاس نفسه − رصيده الحالي (مستودع + فروع)، فالأكثر مبيعاً يأخذ أكثر.
// المعدل = المبيعات ÷ days (طول الفترة). المخازن المستثناة خارج الحساب. تقدير من معدل البيع الماضي، لا توقّع.
export function reorder(D,C,o){
 o=o||{};const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),days=Math.max(1,N(o.days)),H=Math.max(1,N(o.horizon)||60),AL=Math.max(1,N(o.alert)||30),fv=o.vendor?D.vn.indexOf(o.vendor):-2,q=String(o.q||"").trim().toLowerCase();
 if(o.vendor&&fv<0)return null;const V=new Map();
 eachCell(D,P,null,(ki,ti,vi,on,sold)=>{if(ex.has(ti))return;let v=V.get(ki);if(!v){v={ki,on:0,wh:0,sold:0};V.set(ki,v)}v.on+=on;v.sold+=sold;if(ti===wh)v.wh+=on});
 const BC=new Map();V.forEach(v=>{const x=D.k[v.ki];if(q&&x[0].toLowerCase().indexOf(q)<0)return;let c=BC.get(x[0]);if(!c){c={code:x[0],vi:x[3],wh:0,on:0,sold:0,qty:0,vars:[]};BC.set(x[0],c)}
  v.qty=v.sold>0?Math.max(0,Math.ceil(v.sold/days*H-Math.max(0,v.on)-1e-9)):0;c.wh+=v.wh;c.on+=v.on;c.sold+=v.sold;c.qty+=v.qty;c.vars.push(v)});
 const rows=[];BC.forEach(c=>{if(fv!==-2&&c.vi!==fv)return;if(c.sold<=0||c.qty<=0)return;c.rate=c.sold/days;c.cover=Math.max(0,c.on)/c.rate;c.br=c.on-c.wh;if(c.wh>0&&c.cover>=AL)return;c.vars.sort((p,r)=>cmpK(D.k[p.ki],D.k[r.ki]));rows.push(c)});
 rows.sort((p,r)=>p.cover-r.cover||r.qty-p.qty||(p.code<r.code?-1:1));let qty=0;for(const c of rows)qty+=c.qty;
 return {rows,qty,H,AL,days};
}
/* ---- (v187) توزيع حاوية على الفروع ---- */
// يوزّع كمية سطر واحد (total بوحدة السطر: كرتون أو حبة) على: الأونلاين (نسبة ثابتة) + المستودع (نسبة احتياطي) + الفروع بأوزانها.
// الحساب بـ«خطوات» صحيحة (step = أصغر وحدة توزيع: كرتون، نصف كرتون، حبة، 5 حبات…) فلا كسور ضائعة والمجموع = الكمية بالضبط.
// brs = [{id, w}] (w = وزن الفرع ≥ 0؛ صفر = لا يأخذ). r = {on %, wh %, min, max, hasOnline}. الأقل نصيباً يُعطى للأعلى وزناً أولاً لو الكمية لا تكفي الكل،
// والباقي بالأوزان (أكبر باقٍ)، وما يزيد على الحد الأقصى يُعاد توزيعه، وما لا يجد مكاناً يبقى في المستودع.
export function distribute(total,step,brs,r){
 r=r||{};step=N(step)>0?N(step):1;const tot=Math.max(0,N(total)),Tt=Math.floor(tot/step+1e-9);
 const on=r.hasOnline?Math.min(Tt,Math.round(Tt*Math.max(0,Math.min(100,N(r.on)))/100)):0,whT=Math.min(Tt-on,Math.round(Tt*Math.max(0,Math.min(100,N(r.wh)))/100));let R=Tt-on-whT;
 const act=(brs||[]).map(b=>({id:b.id,w:Math.max(0,N(b.w)),t:0})).filter(b=>b.w>0).sort((p,q)=>q.w-p.w||(p.id<q.id?-1:1));
 const mB=Math.max(0,Math.ceil(N(r.min)/step-1e-9)),cap=r.max!==""&&r.max!=null&&N(r.max)>0?Math.max(0,Math.floor(N(r.max)/step+1e-9)):Infinity;
 if(mB>0){const g=Math.min(mB,cap);for(const b of act){if(R<g||g<=0)break;b.t=g;R-=g}}
 let guard=0;while(R>0&&guard++<60){const pool=act.filter(b=>b.t<cap);if(!pool.length)break;let sw=0;for(const b of pool)sw+=b.w;if(sw<=0)break;let used=0;const fr=[];
  for(const b of pool){const x=R*b.w/sw,f=Math.floor(x+1e-9),g=Math.min(f,cap-b.t);b.t+=g;used+=g;fr.push([x-f,b])}
  let left=R-used;fr.sort((p,q)=>q[0]-p[0]||q[1].w-p[1].w||(p[1].id<q[1].id?-1:1));for(const e of fr){if(left<=0)break;if(e[1].t<cap){e[1].t++;left--}}
  if(left===R)break;R=left}
 const a={};let sum=0;for(const b of act){a[b.id]=b.t*step;sum+=b.t}
 return {on:on*step,a,wh:Math.round((tot-on*step-sum*step)*1e6)/1e6};
}
// وزن كل فرع = مبيعاته. mode: smart = مبيعات «الكود المرجعي» لو كُتب، وإلا مبيعات الكود نفسه لو له سجل كافٍ (≥ 20 قطعة في الفروع)، وإلا مبيعات الفرع كلها · all = مبيعات الفرع كلها
export function distWeights(D,C,o){
 o=o||{};const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),m=new Map();
 const run=ids=>{m.clear();let t=0;eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{if(ti===wh)return;m.set(ti,(m.get(ti)||0)+sold);t+=sold});return t};
 if(o.mode!=="all"){const ref=String(o.ref||"").trim(),code=String(o.code||"").trim(),ir=ref?D.code.get(ref)||D.code.get(ref.toUpperCase()):null,ic=code?D.code.get(code)||D.code.get(code.toUpperCase()):null;
  if(ir&&ir.length&&run(ir)>0)return {m:new Map(m),src:"ref"};if(ic&&ic.length&&run(ic)>=20)return {m:new Map(m),src:"code"}}
 run(null);return {m:new Map(m),src:"all"};
}
/* ---- (v181) «تحليل صنف» v2: جدول محوري لصنف واحد بدل جداول إكسل المحورية ---- */
// خانات الصنف: (لون ومقاس، مخزن) ← {رصيد، مبيعات، ناقص؟، راكد؟}. ناقص = فرع يبيعه ورصيده أقل من الحد، راكد = فرع عنده ≥ حد الراكد ولم يبع (كجدول الصنف القديم)
function itemAtoms(D,C,code,o){
 const ids=idsOf(D,{code,cl:o.cl,z:o.z});if(!ids||!ids.length)return null;const P=o.period?soldMap(D,o.period.from,o.period.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),A=new Map();
 eachCell(D,P,ids,(ki,ti,vi,on,sold)=>{const k=ki*1000+ti;let a=A.get(k);if(!a){a={ki,ti,on:0,sold:0};A.set(k,a)}a.on+=on;a.sold+=sold});
 const stl=Math.max(1,N(C.stale));A.forEach(a=>{a.rc=rcOf(D,a.ki,a.ti);const br=a.ti!==wh&&!ex.has(a.ti);a.need=br&&a.sold>0&&a.on<minOf(C,D,a.ki);a.idle=br&&a.on>=stl&&a.sold<=0});
 return {ids,A,wh,ex};
}
// الجدول المحوري: rows/cols = store | color | size | var | "" (بلا أعمدة). كل خانة {on,sold,need,idle} = مجموع خاناتها. الإجماليات للصفوف والأعمدة والكل
export function itemPivot(D,C,code,o){
 o=o||{};const T=itemAtoms(D,C,code,o);if(!T)return null;const rd=o.rows||"store",cd=o.cols===undefined?"size":o.cols,wh=T.wh;
 const key=(d,a)=>d==="store"?a.ti:d==="color"?D.k[a.ki][1]:d==="size"?D.k[a.ki][2]:d==="var"?a.ki:"";
 const cells=new Map(),R=new Map(),Cc=new Map(),tot={on:0,sold:0,rc:0,need:0,idle:0},add=(m,k,a)=>{let c=m.get(k);if(!c){c={k,on:0,sold:0,rc:0,need:0,idle:0};m.set(k,c)}c.on+=a.on;c.sold+=a.sold;c.rc+=a.rc;if(a.need)c.need++;if(a.idle)c.idle++;return c};
 T.A.forEach(a=>{if(a.on===0&&a.sold===0&&!a.rc)return;const r=key(rd,a),c=key(cd,a);add(R,r,a);add(Cc,c,a);const x=add(cells,JSON.stringify([r,c]),a);x.r=r;x.c=c;tot.on+=a.on;tot.sold+=a.sold;tot.rc+=a.rc;if(a.need)tot.need++;if(a.idle)tot.idle++});
 const nm=(d,k)=>d==="store"?D.st[k]:String(k);
 const ord=(d,m)=>{const L=[...m.values()];if(d==="size")return L.sort((p,r)=>zk(p.k)-zk(r.k)||(p.k<r.k?-1:p.k>r.k?1:0));if(d==="var")return L.sort((p,r)=>cmpK(D.k[p.k],D.k[r.k]));
  return L.sort((p,r)=>(d==="store"?(p.k===wh?-1:r.k===wh?1:0):0)||r.sold-p.sold||r.on-p.on||(nm(d,p.k)<nm(d,r.k)?-1:1))};
 return {rows:ord(rd,R),cols:ord(cd,Cc),cell:(r,c)=>cells.get(JSON.stringify([r,c]))||null,tot,rd,cd,wh};
}
// ملخّص الصنف: الأرصدة والمبيعات ونسبة ما بيع، وكم يوماً يكفي الرصيد بمعدل البيع، ومنحنى المقاسات والألوان (نصيب المبيعات مقابل نصيب الرصيد)، وما يُستنتج منها
export function itemInfo(D,C,code,o){
 o=o||{};const T=itemAtoms(D,C,code,o);if(!T)return null;const wh=T.wh;let whOn=0,brOn=0,sold=0,need=0,needWh=0,idle=0,idlePcs=0;const sell=new Set(),hold=new Set(),bz=new Map(),bc=new Map(),needSt=new Map();
 const cur=(m,k)=>{let c=m.get(k);if(!c){c={k,on:0,sold:0};m.set(k,c)}return c};
 const whK=new Map();T.A.forEach(a=>{if(a.ti===wh)whK.set(a.ki,(whK.get(a.ki)||0)+a.on)});
 let rcBr=0;T.A.forEach(a=>{const x=D.k[a.ki];if(a.ti===wh)whOn+=a.on;else{brOn+=a.on;if(!T.ex.has(a.ti))rcBr+=a.rc}sold+=a.sold;if(a.ti!==wh&&a.sold>0)sell.add(a.ti);if(a.ti!==wh&&a.on>0)hold.add(a.ti);
  const z=cur(bz,x[2]),c=cur(bc,x[1]);z.on+=a.on;z.sold+=a.sold;c.on+=a.on;c.sold+=a.sold;
  if(a.need){need++;if((whK.get(a.ki)||0)>0)needWh++;needSt.set(a.ti,1)}if(a.idle){idle++;idlePcs+=a.on}});
 const days=o.days>0?o.days:0,rate=days?sold/days:0,on=whOn+brOn,cover=rate>0?Math.max(0,on)/rate:null;
 const curve=m=>{const L=[...m.values()],ts=L.reduce((s,x)=>s+Math.max(0,x.sold),0),to=L.reduce((s,x)=>s+Math.max(0,x.on),0);L.forEach(x=>{x.ss=ts>0?Math.max(0,x.sold)/ts:0;x.os=to>0?Math.max(0,x.on)/to:0;x.gap=x.ss-x.os});return L};
 const sizes=curve(bz).sort((p,r)=>zk(p.k)-zk(r.k)||(p.k<r.k?-1:p.k>r.k?1:0)),colors=curve(bc).sort((p,r)=>r.sold-p.sold||(p.k<r.k?-1:1));
 return {ids:T.ids,rc:D.hasRc?rcBr:null,wh:whOn,br:brOn,on,sold,thru:sold+Math.max(0,on)>0&&sold>=0?sold/(sold+Math.max(0,on)):null,rate,cover,sell:sell.size,hold:hold.size,need,needWh,needSt:needSt.size,idle,idlePcs,sizes,colors,vendor:D.k[T.ids[0]][3]};
}

/* ---- (v204) تقرير الصنف: الخلاصة، أداء كل فرع، والقرارات المقترحة. كله جمع من دوال المحرك المختبَرة (لا تقدير جديد) ---- */
// حالة الصنف من أرقامه: hot يُباع بسرعة والمستودع خالٍ · fast سينفد قريباً · nowh المستودع خالٍ · sold نفد · ok متوازن · slow بطيء · over مخزون زائد · dead راكد · none بلا حركة
export function itemVerdict(I,alert){
 const AL=Math.max(1,N(alert)||30),c=I.cover;
 if(I.sold<=0)return I.on>0?"dead":"none";if(I.on<=0)return "sold";
 const noWh=I.wh<=Math.max(0,(I.rate||0)*7);// المستودع خالٍ أو لا يكفي أسبوعاً من البيع
 if(c!=null&&c<AL)return noWh?"hot":"fast";if(noWh)return "nowh";if(c!=null&&c>365)return "over";if(c!=null&&c>150)return "slow";return "ok";
}
export function itemReport(D,C,code,o){
 o=o||{};const I=itemInfo(D,C,code,o);if(!I)return null;
 const wh=D.sti.get(C.wh),ex=exSet(C,D),ids=new Set(I.ids),days=o.days>0?o.days:0,stl=Math.max(1,N(C.stale));
 const K=codeCard(D,C,code,{cl:o.cl,z:o.z,period:o.period}),PV=itemPivot(D,C,code,{cl:o.cl,z:o.z,period:o.period,rows:"store",cols:""}),cells=new Map();PV.rows.forEach(r=>cells.set(r.k,r));
 const inC=l=>ids.has(l.ki),SH=shortages(D,C,{q:code,period:o.period,days:o.days}).filter(inC),TR=transfers(D,C,{q:code,period:o.period,days:o.days}).rows.filter(inC),ST=stale(D,C,{q:code,period:o.period}).filter(inC);
 const add=(m,k,v)=>m.set(k,(m.get(k)||0)+v),give=new Map(),unmet=new Map(),tin=new Map(),tout=new Map(),idl=new Map();
 let sendPcs=0,sendLines=0,unmetPcs=0,trPcs=0,pullPcs=0;
 SH.forEach(l=>{if(l.give>0){add(give,l.ti,l.give);sendPcs+=l.give;sendLines++}const u=Math.max(0,l.need-l.give);if(u>0&&l.sold>0){add(unmet,l.ti,u);unmetPcs+=u}});
 TR.forEach(l=>{add(tin,l.dst,l.n);add(tout,l.src,l.n);trPcs+=l.n});ST.forEach(l=>{add(idl,l.ti,l.on);pullPcs+=l.on});
 // فرع لا رصيد عنده ولا مبيعات من الصنف لكنه في النواقص أو التحويلات: يُضاف بأصفار حتى يطابق مجموع الفروع الإجمالي
 const KS=K.stores.slice(),hasS=new Set(KS.map(s=>s.ti));[give,tin,tout,idl,unmet].forEach(m=>m.forEach((v,ti)=>{if(!hasS.has(ti)){hasS.add(ti);KS.push({ti,on:0,sold:0,rc:D.hasRc?I.ids.reduce((a,ki)=>a+rcOf(D,ki,ti),0):0})}}));
 const stores=KS.filter(s=>!ex.has(s.ti)).map(s=>{const c=cells.get(s.ti)||{need:0,idle:0},isWh=s.ti===wh,rate=days?s.sold/days:0,cover=rate>0?Math.max(0,s.on)/rate:null,
   thru=s.sold+Math.max(0,s.on)>0&&s.sold>=0?s.sold/(s.sold+Math.max(0,s.on)):null,ip=idl.get(s.ti)||0;
  const st=isWh?"wh":s.on<=0&&s.sold>0?"out":c.need>0||give.get(s.ti)>0?"low":ip>0&&s.sold<=0?"idle":cover!=null&&cover>365&&s.on>=stl?"over":s.on<=0&&s.sold<=0?"none":"ok";
  return {ti:s.ti,isWh,on:s.on,sold:s.sold,rc:s.rc||0,thru,cover,need:c.need,idle:c.idle,give:give.get(s.ti)||0,unmet:unmet.get(s.ti)||0,tin:tin.get(s.ti)||0,tout:tout.get(s.ti)||0,idlePcs:ip,st}});
 // الشراء: من reorder لنفس الكود (وبفلتر اللون والمقاس لو حُدّدا)
 const RO=reorder(D,C,{period:o.period,days:days||1,horizon:o.horizon,alert:o.alert,q:code}),B=RO?RO.rows.find(r=>r.code===code):null;let buy=0;if(B)B.vars.forEach(v=>{if(ids.has(v.ki))buy+=v.qty});
 const cnt=k=>stores.filter(s=>s.st===k).length;
 return {I,stores,verdict:itemVerdict(I,o.alert),send:{pcs:sendPcs,lines:sendLines,br:give.size},unmet:{pcs:unmetPcs,br:unmet.size},tr:{pcs:trPcs,lines:TR.length},pull:{pcs:pullPcs,lines:ST.length,br:idl.size},buy:{qty:buy,H:RO?RO.H:60,AL:RO?RO.AL:30},
  n:{out:cnt("out"),low:cnt("low"),idle:cnt("idle"),over:cnt("over"),ok:cnt("ok")}};
}
// مبيعات الصنف أسبوعاً بأسبوع (من ملفات التاريخ)، الأقدم أولاً، وآخر أسبوع ينتهي عند to
export function weekSeries(D,code,o){
 o=o||{};const R=salesQuery(D,{code,cl:o.cl,z:o.z,store:o.store,from:o.from,to:o.to});if(!R)return null;const dn=x=>Math.round(new Date(x+"T12:00:00").getTime()/864e5),a=dn(o.from),b=dn(o.to),nw=Math.max(1,Math.min(53,Math.ceil((b-a+1)/7))),W=[];
 const iso=d=>{const t=new Date(d*864e5);return t.getUTCFullYear()+"-"+p2(t.getUTCMonth()+1)+"-"+p2(t.getUTCDate())};
 for(let i=0;i<nw;i++){const e=b-(nw-1-i)*7;W.push({from:iso(Math.max(a,e-6)),to:iso(e),sold:0})}
 for(const d in R.byDay){const i=nw-1-Math.floor((b-dn(d))/7);if(i>=0&&i<nw)W[i].sold+=R.byDay[d]}
 return W;
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
let ATT=null;// (v210) جدول المقاسات وكلمات الألوان من الملف
const attrTable=K=>{if(ATT&&ATT.K===K)return ATT;const sz=new Map(),cw=new Map();for(const x of K){const z=String(x[2]||"").trim();if(z){const k=normAr(z).replace(/\s+/g,"");if(!sz.has(k))sz.set(k,z)}
  const c=String(x[1]||"").trim();if(c)normAr(c).split(/[^a-z\u0621-\u064A]+/).forEach(wd=>{if(wd.length<3)return;let a=cw.get(wd);if(!a){a=[];cw.set(wd,a)}if(a.indexOf(c)<0)a.push(c)})}
 ATT={K,sz,cw};return ATT};
const CLW=new Set(["لون","اللون","بلون","باللون","الوان","الالوان","color","colour"]);
const ARCOL={"سوداء":["black"],"سودا":["black"],"بيضاء":["white"],"بيضا":["white"],"زرقاء":["blue"],"زرقا":["blue"],"خضراء":["green"],"خضرا":["green"],"حمراء":["red"],"حمرا":["red"],"صفراء":["yellow"],"صفرا":["yellow"],"اسود":["black"],"بني":["brown"],"ازرق":["blue"],"اخضر":["green"],"رمادي":["grey","gray"],"رصاصي":["grey","gray"],"ابيض":["white"],"بيج":["beige","beig"],"جملي":["camel"],"كحلي":["navy"],"زيتي":["olive"],"خاكي":["khaki","kakhi","kahki"],"احمر":["red"],"اصفر":["yellow"],"وردي":["pink"],"عنابي":["bordo"],"هافان":["havan"],"قهوي":["coffee"]};
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
const STW=new Set(["فرع","الفرع","بفرع","لفرع","محل","المحل","مخزن","المخزن","معرض","branch","store","shop"]),CDW=new Set(["كود","الكود","صنف","الصنف","موديل","الموديل","code","item","model","sku"]),SZW=new Set(["مقاس","المقاس","مقاسات","المقاسات","بمقاس","لمقاس","قياس","نمره","سايز","السايز","size"]);
const UNITS={"يوم":1,"ايام":1,"يوما":1,"day":1,"days":1,"اسبوع":7,"اسابيع":7,"week":7,"weeks":7,"شهر":30,"شهور":30,"اشهر":30,"month":30,"months":30},DUAL={"يومين":2,"اسبوعين":14,"شهرين":60};
// حشو الأسئلة بالعربية (بعد توحيد الحروف): لا يُسأل المستخدم عن معناه
const ARFILL=new Set("كام كم وكام وكم باع باعت بيع بيعت اتباع اتباعت مباع مبيعات مبيعاته مبيعاتها مبيعا عنده عندها عندنا عندهم وعنده رصيد رصيده رصيدها رصيدا موجود متوفر متاح من في الي علي عن مع هل ايه ايش وش ما ماذا هو هي ده دي دا هذا هذه اللي الذي التي عايز عاوز اريد ابغي ابي اعرف اشوف شوف شوفلي وريني هات هاتلي قولي قلي كل منه منها فيه فيها بتاع بتاعه بتاعت سمحت ممكن طيب قطعه قطع حبه حبات عدد كميه كميات اجمالي مجموع لون الوان خلال فتره يوم ايام اسبوع شهر سنه بين حتي لحد الان دلوقتي حاليا كمان وكمان بس فقط ايضا تم قد كان كانت يكون نفس واحد منهم لنا لها عليه عليها اللى هناك هنا جدا اوي قوي حاجه شي شيء بقي يعني مثلا اذا لما عند الفتره المده وصل وصلت نزل نزلت دخل دخلت خرج طلع طلعت اجيب جيب جبلي عرفني اعطني اعطيني وريني خليني ابغا تبع حق حقه مال ماله استلم استلمت استلموا استلام مستلم وارد حلل حللي تحليل اعلي اقل اكثر اكتر ترتيب رتب رتبلي قارن مقارنه مقابل مين فين وين اين بيتباع يتباع تتباع بتتباع بيبيع بتبيع يبيع تبيع بيبيعوا بيتبيع قد اد قداش اصناف الاصناف بالاصناف الموديلات موديلات كله كلها جميع احذيه الاحذيه بالاحذيه حذاء الحذاء جزم نسبه النسبه بنسبه نصيب مخزون المخزون للكود بالكود للصنف بالصنف الاكواد بالاكواد".split(" "));
const ENSTOP=new Set(["the","in","of","at","for","from","to","and","how","many","much","sold","sales","sale","stock","has","have","did","does","on","hand","qty","quantity","last","this","year","since","until","till","show","me","what","is","was","by","with","between","received","receive"]);
/* (v180) نوع السؤال: ترتيب «أكثر/أقل»، «مين عنده»، المقارنة، والمورد */
const RK_D=new Set(["اكتر","اكثر","الاكتر","الاكثر","اعلي","الاعلي","افضل","الافضل","اكبر","الاكبر","ترتيب","رتب","رتبلي","top","most","best","highest","rank","ranking"]),RK_A=new Set(["اقل","الاقل","اضعف","الاضعف","اسوا","الاسوا","اصغر","least","lowest","worst","bottom"]);
const ENT_P={"اكواد":"code","الاكواد":"code","كودات":"code","اصناف":"code","الاصناف":"code","موديلات":"code","الموديلات":"code","codes":"code","items":"code","products":"code","models":"code","skus":"code","فروع":"store","الفروع":"store","محلات":"store","المحلات":"store","معارض":"store","المعارض":"store","branches":"store","stores":"store","shops":"store","موردين":"vendor","الموردين":"vendor","vendors":"vendor","suppliers":"vendor","الوان":"color","الالوان":"color","colors":"color","colours":"color","مقاسات":"size","المقاسات":"size","sizes":"size"};
const ENT_S={"كود":"code","الكود":"code","صنف":"code","الصنف":"code","موديل":"code","code":"code","item":"code","product":"code","فرع":"store","الفرع":"store","محل":"store","معرض":"store","branch":"store","store":"store","shop":"store","مورد":"vendor","المورد":"vendor","vendor":"vendor","supplier":"vendor","لون":"color","اللون":"color","color":"color","colour":"color","مقاس":"size","المقاس":"size","size":"size"};
const MS_SOLD=new Set(["مبيعا","مبيعات","المبيعات","بالمبيعات","بيعا","بيع","مبيع","باع","باعو","باعوا","اتباع","اتباعت","sold","selling","sales","seller","sellers"]),MS_ON=new Set(["رصيد","رصيدا","الرصيد","بالرصيد","مخزون","مخزونا","المخزون","عنده","عندها","عندهم","stock","inventory","onhand"]);
const CMPW=new Set(["قارن","قارنلي","قارني","قارنه","مقارنه","المقارنه","بمقارنه","مقابل","بالمقابل","ضد","vs","vs.","versus","compare","comparison","compared"]),WHW=new Set(["مين","فين","وين","اين","where","who"]);
/* (v260) نواقص، مشتريات، وما لا يتحرك */
const NEEDW=new Set(["ناقص","ناقصه","ناقصين","نواقص","النواقص","نقص","النقص","ينقص","تنقص","shortage","shortages","missing","short"]),BUYW=new Set(["اشترينا","اشتري","اشتريت","اشتروا","اشترت","مشتريات","المشتريات","مشترياتنا","شراء","الشراء","استوردنا","purchase","purchases","purchased","bought"]);
const STLW=new Set(["راكد","راكده","الراكد","الراكده","رواكد","الرواكد","مابيتباعش","ماتباعش","مبيتباعش","مابتتباعش","ميتباعش","واقف","واقفه","stale","dead","idle"]),NEGW=new Set(["مش","مو","مب","غير","ما","لا","مابقاش","not"]),MOVW=new Set(["شغال","شغاله","شغالين","ماشي","ماشيه","ماشيين","بيتباع","يتباع","بتتباع","تتباع","بيتحرك","متحرك","متحركه","بيمشي","moving","selling"]);
const VMK=new Set(["مورد","المورد","للمورد","لمورد","بمورد","والمورد","vendor","supplier"]);
// كلمات عامة في أسماء الموردين لا تدل وحدها على مورد بعينه
const VGEN=new Set(["مورد","شركه","متنوع","تركي","تركيا","صيني","الصين","اسباني","اسبانيا","اسبانى","محلي","وطني","داخلي","قديم","ملابس","للملابس","مريح","مصنع","ابو","علي","احذيه","الاحذيه","حذاء","الحذاء","جزم","شنط","الشنط","عطور","العطور","شموع","الشموع","اكسسوارات"]);
let VTC=null;
const vsk=w=>bare(w).replace(/[اوي]/g,"");
function vendTable(vs){
 const sig=vs.join("|");if(VTC&&VTC.sig===sig)return VTC;const list=[],cnt=new Map();
 vs.forEach(v=>{if(!v)return;const raw=normAr(v).replace(/[^a-z0-9؀-ۿ]+/g," ").trim().split(" ").filter(Boolean),ws=new Set();raw.forEach(w=>{ws.add(w);ws.add(bare(w))});list.push({v,raw,bw:raw.map(bare),ws});new Set(raw).forEach(w=>cnt.set(w,(cnt.get(w)||0)+1))});
 const uniq=new Map();for(const e of list)for(const w of e.raw){if(cnt.get(w)!==1||w.length<4||VGEN.has(w)||/^\d+$/.test(w)||ARCOL[w]||STW.has(w)||CDW.has(w)||SZW.has(w)||UNITS[w]||ENSTOP.has(w)||MONN[w])continue;uniq.set(w,e.v);const b=bare(w);if(b!==w&&b.length>=4&&!uniq.has(b))uniq.set(b,e.v)}
 // (v260) هيكل الكلمة بلا حروف المد: «شربات» = «شرابات»، فكلمة تطابق أكثر من مورد = مجموعة موردين
 const sk=new Map();for(const e of list){e.sk=new Set();for(const w of e.raw){if(VGEN.has(w)||/^\d+$/.test(w)||ARCOL[w]||STW.has(w))continue;const s=vsk(w);if(s.length<3)continue;e.sk.add(s);let a=sk.get(s);if(!a){a=[];sk.set(s,a)}if(a.indexOf(e.v)<0)a.push(e.v)}}
 VTC={sig,list:list.slice().sort((p,r)=>r.raw.length-p.raw.length),uniq,sk};return VTC;
}
const okDate=(y,m,d)=>y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=new Date(y,m,0).getDate();
const ds=(y,m,d)=>y+"-"+p2(m)+"-"+p2(d);
// سؤال حر ← {kind, store, code, cl, z, per:"ytd"|"c", from, to, amb:{store,code,cl}, unk, rc}
// ctx = {stores:[أسماء المخازن], codes:Map(كود←أصنافه), k:[[كود،لون،مقاس]], alias:[{k,s}], today, end (آخر يوم في البيانات), wh}
export function parseAsk(text,ctx){
 const out={kind:"",store:"",code:"",cl:"",z:"",vendor:"",per:"ytd",from:"",to:"",amb:{store:[],code:[],cl:[],vendor:[]},unk:[],rc:false,rank:null,where:false,cmp:null,txt:String(text||"").slice(0,200)};
 // (v183) «13038+13040+13037» و«13038,13040»: الزائد يفصل دائماً (لا كود فيه +)، والفاصلة بين رقمين تفصل لو كل جزء كود موجود (وإلا فهي رقم مثل 1,234)
 const isC=s=>ctx.codes.has(s)||ctx.codes.has(s.toUpperCase());
 const t=normAr(out.txt).replace(/[،؛؟?!()«»"'`:\[\]{}+]|,(?!\d)/g," ").split(/\s+/).map(w=>{if(w.indexOf(",")<0)return w;const p=w.split(",").filter(Boolean);return p.length>1&&p.every(isC)?p.join(" "):w}).join(" ").replace(/(\d)([ء-ي])/g,"$1 $2").replace(/([ء-ي])(\d)/g,"$1 $2").replace(/\s+/g," ").trim();if(!t)return out;// (v260) «13027اعلى» ملتصقة: الرقم والكلمة العربية كلمتان
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
  if((w==="شهر"||w==="بشهر"||w==="وشهر"||w==="month")&&isNum(nx)&&+nx>=1&&+nx<=12){const y=/^20\d{2}$/.test(n2)?+n2:0;dts.push(Object.assign({i,kind:"m"},monRange(+nx,y)));U[i]=U[i+1]=true;if(y)U[i+2]=true;continue}
  const mw=MONN[w]||(/^[وب][؀-ۿ]{3,}$/.test(w)?MONN[w.slice(1)]:0);// «بأكتوبر»، «وسبتمبر»
  if(mw&&!isNum(w)){const y=/^20\d{2}$/.test(nx)?+nx:0;dts.push(Object.assign({i,kind:"m"},monRange(mw,y)));U[i]=true;if(y)U[i+1]=true;if(pv==="شهر"||pv==="month")U[i-1]=true;continue}
  if(w==="اليوم"||w==="النهارده"||w==="today"){dts.push({i,from:ctx.today,to:ctx.today,kind:"d"});U[i]=true;continue}
  if(w==="امس"||w==="امبارح"||w==="yesterday"){const y=addDays(ctx.today,-1);dts.push({i,from:y,to:y,kind:"d"});U[i]=true;continue}
  if(w==="الشهر"||w==="بالشهر"||w==="والشهر"||w==="للشهر"){const prev=/^(اللي|الماضي|السابق|الفايت|فات)$/.test(nx);U[i]=true;if(/^(ده|دا|الحالي|هذا|الجاري|اللي|الماضي|السابق|الفايت)$/.test(nx))U[i+1]=true;if(nx==="اللي"&&n2==="فات")U[i+2]=true;
   const y0=+end.slice(0,4),m0=+end.slice(5,7);if(prev){const pm=m0===1?12:m0-1,py=m0===1?y0-1:y0;dts.push(Object.assign({i,kind:"m"},monRange(pm,py)))}else dts.push({i,kind:"m",from:ds(y0,m0,1),to:end});continue}
  if(w==="السنه"||w==="سنه"||w==="العام"||w==="ytd"||(w==="year"&&pv==="this")){ytd=true;U[i]=true;continue}}
 if(lastN){out.per="c";out.to=end;out.from=addDays(end,-(lastN-1))}
 else if(dts.length>=2){const a=dts[0],b=dts[1];out.per="c";out.from=a.from<b.from?a.from:b.from;out.to=a.to>b.to?a.to:b.to}
 else if(dts.length===1){const a=dts[0],pv=W[a.i-1]||"";out.per="c";out.from=a.from;out.to=a.to;
  if(a.kind==="d"){if(/^(من|منذ|from|since)$/.test(pv))out.to=end>a.from?end:a.from;else if(/^(حتي|لحد|لغايه|الي|to|until|till)$/.test(pv))out.from=a.from.slice(0,4)+"-01-01"}}
 else if(ytd)out.per="ytd";
 if(out.per==="c"&&out.to>end&&out.from<=end&&dts.every(d=>d.kind==="m"))out.to=end;// شهر لم يكتمل: حتى آخر يوم في البيانات
 /* 1ب) (v180) نوع السؤال: «أكثر/أقل» (ترتيب)، «قارن/مقابل»، «مين عنده/فين» */
 let rk=0,rkI=-1,rkN=0,rkBy="",rkM="",cmpW=false;
 for(let i=0;i<W.length;i++){if(U[i])continue;const w=W[i];
  if(RK_D.has(w)||RK_A.has(w)){if(!rk){rk=RK_A.has(w)?1:-1;rkI=i}U[i]=true}
  else if(CMPW.has(w)){cmpW=true;U[i]=true}
  else if(WHW.has(w)){out.where=true;U[i]=true}
  else if(NEEDW.has(w)||NEEDW.has(B[i])){out.need=true;U[i]=true}
  else if(BUYW.has(w)||BUYW.has(B[i])){out.buy=true;U[i]=true}
  else if(STLW.has(w)||STLW.has(B[i])){out.stale=true;U[i]=true}
  else if(NEGW.has(w)&&W[i+1]&&MOVW.has(W[i+1])){out.stale=true;U[i]=U[i+1]=true}}
 if(out.need||out.buy||out.stale)out.where=false;// «ناقص فين» = النواقص، لا «مين عنده»
 if(rk){for(const j of [rkI+1,rkI+2,rkI-1]){const w=W[j];if(w&&!U[j]&&/^\d{1,3}$/.test(w)&&+w>=1&&+w<=500){rkN=+w;U[j]=true;break}}
  for(let i=0;i<W.length;i++){if(U[i]||rkBy)continue;const e=ENT_P[W[i]]||(i>rkI&&i<=rkI+3?ENT_S[W[i]]:"");if(e){rkBy=e;U[i]=true}}
  for(let i=0;i<W.length;i++){if(U[i])continue;if(MS_SOLD.has(W[i])){rkM="sold";U[i]=true}else if(MS_ON.has(W[i])){if(!rkM)rkM="on";U[i]=true}}
  out.rank={dir:rk,n:rkN||10,by:rkBy,m:rkM||(out.rc?"rc":"sold")}}// (v191) «أكثر فرع استلم» = ترتيب بالمستلم
 // مقارنة فترتين: «أكتوبر مقابل سبتمبر»، «قارن الشهر ده بالشهر اللي فات»، أو فترة واحدة تُقارن بالتي قبلها مباشرة
 if(cmpW){const cut=x=>({from:x.from,to:x.kind==="m"&&x.to>end&&x.from<=end?end:x.to});let A=null,Bp=null;
  if(dts.length>=2){A=cut(dts[0]);Bp=cut(dts[1]);
   // الشهر الحالي لم يكتمل (حتى آخر يوم في البيانات) ويُقارن بشهر كامل: نفس الأيام منه (1–18 مقابل 1–18)
   const dimOf=s=>new Date(+s.slice(0,4),+s.slice(5,7),0).getDate();
   if(dts[0].kind==="m"&&dts[1].kind==="m"&&+A.to.slice(8,10)<dimOf(A.to)&&A.from.slice(8)==="01"&&Bp.from.slice(8)==="01"&&+Bp.to.slice(8,10)===dimOf(Bp.to)){const y=+Bp.from.slice(0,4),m=+Bp.from.slice(5,7);Bp={from:Bp.from,to:ds(y,m,Math.min(+A.to.slice(8,10),new Date(y,m,0).getDate()))}}}
  else if(dts.length===1||lastN){A=lastN?{from:addDays(end,-(lastN-1)),to:end}:cut(dts[0]);
   if(!lastN&&dts[0].kind==="m"){const y=+A.from.slice(0,4),m=+A.from.slice(5,7),py=m===1?y-1:y,pm=m===1?12:m-1,dd=Math.min(+A.to.slice(8,10),new Date(py,pm,0).getDate());Bp={from:ds(py,pm,1),to:ds(py,pm,A.to.slice(0,7)===A.from.slice(0,7)&&+A.to.slice(8,10)===new Date(y,m,0).getDate()?new Date(py,pm,0).getDate():dd)}}
   else{const len=Math.round((new Date(A.to+"T12:00:00")-new Date(A.from+"T12:00:00"))/864e5)+1;Bp={from:addDays(A.from,-len),to:addDays(A.from,-1)}}}
  if(A&&Bp&&A.from<=A.to&&Bp.from<=Bp.to){out.per="c";out.from=A.from;out.to=A.to;out.cmp={a:A,b:Bp}}}
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
 for(let i=1;i<W.length;i++){if(U[i]||U[i-1]||!STW.has(W[i-1])||!/[؀-ۿ]/.test(W[i]))continue;const k=skAr(B[i]),hit=k.length>=3?T.sk.get(k):null;U[i]=U[i-1]=true;
  if(hit){for(const s of hit)if(ambSt.indexOf(s)<0)ambSt.push(s)}else out.unk.push(W[i])}
 // (v180) فرعان أو أكثر مكتوبان صراحة = مقارنة بينهم (حتى 4)، لا سؤال «أيهما؟»
 if(stores.length){out.store=stores[0];if(stores.length>1&&!out.cmp)out.cmp={st:stores.slice(0,4)}}else if(ambSt.length)out.amb.store=ambSt.slice(0,8);
 if(stores.length&&ambSt.length)for(const s of ambSt)if(out.amb.store.indexOf(s)<0&&s!==out.store){if(!out.amb.store.length)out.amb.store.push(out.store);out.amb.store.push(s)}
 /* 3) الأكواد: مطابقة تامة (حتى 3 كلمات متتالية للأكواد التي فيها مسافات مثل «31001 - T») */
 const codes=[];
 for(let n=3;n>=1;n--)for(let i=0;i+n<=W.length;i++){let free=true;for(let j=i;j<i+n;j++)if(U[j])free=false;if(!free)continue;const c=lower.get(W.slice(i,i+n).join(""))||(n===1&&/^و[0-9a-z]/.test(W[i])?lower.get(W[i].slice(1)):undefined);if(!c)continue;// «و15002»
  if(n>1&&!/\s/.test(c))continue;// ضمّ كلمتين لا يُقبل إلا لكود مكتوب في السيستم بمسافات (فلا يُركَّب كود من رقمين متجاورين)
  if(n===1&&W[i].length<3&&!CDW.has(W[i-1]||""))continue;if(codes.indexOf(c)<0)codes.push(c);for(let j=i;j<i+n;j++)U[j]=true}
 for(let i=0;i<W.length;i++)if(!U[i]&&/^20\d{2}$/.test(W[i])&&!lower.has(W[i]))U[i]=true;// سنة مكتوبة وحدها
 if(!codes.length)for(let i=0;i<W.length;i++){if(U[i]||!isNum(W[i]))continue;const pv=W[i-1]||"";
  if(CDW.has(pv)&&W[i].length<5){const c=lower.get(("00000"+W[i]).slice(-5));if(c){codes.push(c);U[i]=true;continue}}
  if(W[i].length>=3){const sug=[],pad=W[i].length<5?("00000"+W[i]).slice(-5):"";lower.forEach((c,k)=>{if(sug.length<8&&(k.indexOf(W[i])===0||(pad&&k===pad)))sug.push(c)});if(sug.length){out.amb.code=sug;U[i]=true}}}
 // (v182) كودان أو أكثر = مقارنة أكواد (حتى 15)، إلا لو السؤال مقارنة فترات أو فروع فيُسأل «أي كود؟» كما كان
 if(codes.length){out.code=codes[0];if(codes.length>1){if(!out.cmp){out.cmp={codes:codes.slice(0,15)};out.code=""}else out.amb.code=codes.slice()}}
 /* 3ب) (v180) المورد: بعد كلمة «مورد» تكفي كلمة أو أكثر من اسمه؛ وبلا «مورد» يُقبل اسمه كاملاً أو كلمة لا توجد إلا في اسمه */
 if(ctx.vendors&&ctx.vendors.length){const VT=vendTable(ctx.vendors),has=(e,j)=>e.ws.has(W[j])||e.ws.has(B[j])||(e.sk&&/^[ء-ي]{3,}$/.test(W[j])&&e.sk.has(vsk(W[j])));let vh=null;
  // الاسم كاملاً أولاً (الأطول أولاً): «مورد شربات» لا يلتبس بـ«مورد شربات اسباني»
  for(const e of VT.list){if(e.raw.length<2)continue;const n=e.raw.length;for(let i=0;i+n<=W.length&&!vh;i++){let eq=true;for(let j=0;j<n;j++)if(U[i+j]||(W[i+j]!==e.raw[j]&&B[i+j]!==e.bw[j])){eq=false;break}if(eq){vh=[e.v];for(let j=0;j<n;j++)U[i+j]=true;if(i>0&&VMK.has(W[i-1]))U[i-1]=true}}if(vh)break}
  for(let i=0;i<W.length&&!vh;i++){if(U[i]||!VMK.has(W[i]))continue;U[i]=true;
   for(let n=Math.min(4,W.length-i-1);n>=1&&!vh;n--){let free=true;for(let j=i+1;j<=i+n;j++)if(U[j])free=false;if(!free)continue;
    const hit=VT.list.filter(e=>{for(let j=i+1;j<=i+n;j++)if(!has(e,j))return false;return true});
    if(hit.length){vh=hit.map(e=>e.v);for(let j=i+1;j<=i+n;j++)U[j]=true}}
   if(!vh){const nx=W[i+1];if(nx&&!U[i+1]&&!isNum(nx)){out.unk.push(nx);U[i+1]=true}}}
  if(!vh)for(let i=0;i<W.length;i++){if(U[i])continue;const v=VT.uniq.get(W[i])||VT.uniq.get(B[i]);if(v){vh=[v];U[i]=true;break}}
  if(!vh)for(let i=0;i<W.length;i++){if(U[i]||!/^[ء-ي]{4,}$/.test(W[i])||ARFILL.has(W[i])||ARFILL.has(B[i])||VGEN.has(W[i])||VGEN.has(B[i]))continue;const h=VT.sk.get(vsk(W[i]));if(h&&h.length){vh=h.slice();U[i]=true;break}}// «شربات» بلا كلمة «مورد»
  if(vh){if(vh.length===1)out.vendor=vh[0];else{out.vgrp=vh.slice(0,12);out.amb.vendor=vh.slice(0,8)}}}
 /* 4) اللون والمقاس: من ألوان ومقاسات هذا الكود فقط */
 if(out.code){const ids=ctx.codes.get(out.code)||[],cols=[],szs=[];for(const ki of ids){const x=ctx.k[ki];if(cols.indexOf(x[1])<0)cols.push(x[1])}
  const cl=new Map();cols.forEach(c=>{if(c)cl.set(normAr(c).replace(/\s+/g," ").trim(),c)});
  for(let n=3;n>=1&&!out.cl;n--)for(let i=0;i+n<=W.length;i++){let free=true;for(let j=i;j<i+n;j++)if(U[j])free=false;if(!free)continue;const c=cl.get(W.slice(i,i+n).join(" "));if(c){out.cl=c;for(let j=i;j<i+n;j++)U[j]=true;break}}
  if(!out.cl)for(let i=0;i<W.length;i++){if(U[i])continue;const en=ARCOL[B[i]]||ARCOL[W[i]];if(!en)continue;const hit=cols.filter(c=>en.indexOf(normAr(c).trim())>=0);U[i]=true;if(hit.length===1)out.cl=hit[0];else if(hit.length>1)out.amb.cl=hit;else out.unk.push(W[i]);break}
  for(const ki of ids){const x=ctx.k[ki];if((!out.cl||x[1]===out.cl)&&szs.indexOf(x[2])<0)szs.push(x[2])}
  const sz=new Map();szs.forEach(z=>{if(z)sz.set(normAr(z).replace(/\s+/g,""),z)});
  for(let i=0;i<W.length&&!out.z;i++){if(U[i])continue;const z=sz.get(W[i])||(W[i+1]&&!U[i+1]?sz.get(W[i]+W[i+1]):undefined);if(!z)continue;if(/^[a-z]+$/.test(W[i])&&!SZW.has(W[i-1]||""))continue;out.z=z;U[i]=true;if(!sz.get(W[i]))U[i+1]=true}}
 /* 4ب) (v210) المقاس واللون بلا كود: «مقاس 40 في كل الأصناف»، «مقاس 40 و41 و42»، «اللون الأسود». المقاس من مقاسات الملف نفسه؛
    الرقم وحده يُقبل مقاساً لو خانتين أو ثلاث (الأكواد والفروع وأعداد الترتيب والتواريخ أُخذت قبله)، والحروف (XL…) بعد كلمة «مقاس» أو لو خانتين فأكثر */
 out.zs=[];out.cls=[];out.cn="";
 if(!out.code&&!(out.cmp&&out.cmp.codes)&&ctx.k){const T2=attrTable(ctx.k);let lastZ=-9;
  for(let i=0;i<W.length;i++){if(U[i])continue;let w=W[i];if(/^و./.test(w)&&!T2.sz.has(w)&&T2.sz.has(w.slice(1)))w=w.slice(1);const z=T2.sz.get(w);if(!z)continue;
   const pv=W[i-1]||"",mark=SZW.has(pv)||SZW.has(B[i-1]||""),list=lastZ>=0&&(i-lastZ===1||(i-lastZ===2&&/^(و|،|,|او)$/.test(pv)));
   if(!(mark||list||(/^\d{2,3}$/.test(w))||(/[a-z]/.test(w)&&w.length>=2)))continue;
   if(out.zs.indexOf(z)<0&&out.zs.length<12)out.zs.push(z);U[i]=true;if(mark)U[i-1]=true;lastZ=i}
  for(let i=0;i<W.length&&!out.cls.length;i++){if(U[i])continue;const w=W[i],b=B[i],mark=CLW.has(W[i-1]||"");let ws=ARCOL[b]||ARCOL[w]||null;
   if(!ws&&mark&&/^[a-z]{3,}$/.test(w)&&T2.cw.has(w))ws=[w];if(!ws)continue;const set=new Set();ws.forEach(x=>(T2.cw.get(x)||[]).forEach(c=>set.add(c)));
   U[i]=true;if(mark)U[i-1]=true;if(set.size){out.cls=[...set].sort();out.cn=W[i]}else out.unk.push(W[i])}
  for(let i=0;i<W.length;i++)if(!U[i]&&(SZW.has(W[i])||CLW.has(W[i]))&&(out.zs.length||out.cls.length))U[i]=true;
  if(out.cmp&&out.cmp.need&&out.zs.length>1)out.cmp=null}
 /* 5) ما لم يُفهم: الكلمات التي فيها أرقام أو حروف لاتينية فقط (الكلمات العربية الباقية حشو السؤال) */
 for(let i=0;i<W.length;i++){if(U[i])continue;const w=W[i];if(/[a-z0-9]/.test(w)&&!ENSTOP.has(w)&&!STW.has(w)&&!CDW.has(w)&&!SZW.has(w)&&!UNITS[w]&&out.unk.indexOf(w)<0)out.unk.push(w)}
 // (v196) كلمات عربية بقيت بلا استعمال وليست من حشو الأسئلة المعروف: تُعرض بهدوء ليعلّم المستخدم المنصةَ معناها (لا تُعدّ خطأ)
 out.left=[];for(let i=0;i<W.length;i++){if(U[i])continue;const w=W[i],b0=bare(w);if(/^[\u0621-\u064A]{3,}$/.test(w)&&!ARFILL.has(w)&&!ARFILL.has(b0)&&!ENT_P[w]&&!ENT_S[w]&&!ENT_P[b0]&&!ENT_S[b0]&&!STW.has(w)&&!CDW.has(w)&&!SZW.has(w)&&out.left.indexOf(w)<0&&out.unk.indexOf(w)<0)out.left.push(w)}
 if(out.cmp&&out.cmp.codes){out.rank=null;out.where=false}// «13016 و15002 مين الأعلى» = مقارنة أكواد، لا ترتيب ولا «مين عنده»
 if(cmpW&&!out.cmp)out.cmp={need:1};// «قارن» بلا فرعين ولا فترة: يُطلب منه ما يقارنه
 if(out.rc&&out.where&&!out.rank&&out.code&&!(out.cmp&&!out.cmp.need)){out.where=false;out.rank={dir:-1,n:40,by:"store",m:"rc"}}// (v191) «مين استلم الكود» = الفروع مرتّبة بالمستلم
 if(out.vendor||out.code)out.vgrp=null;
 out.kind=out.cmp&&!out.cmp.need?"x":out.rank?"r":out.buy?"p":out.need&&(out.code||out.store||out.vendor)?"n":out.stale?"st":out.where&&out.code&&!out.store?"w":out.vgrp&&out.vgrp.length&&!out.zs.length&&!out.cls.length?"vg":(out.zs.length||out.cls.length)&&!out.code?"z":out.vendor&&!out.code?"v":out.code&&out.store?"cs":out.code?"c":out.store?"s":"";return out;
}
const near=(a,b)=>Math.abs(N(a)-N(b))<1e-6;
const dim=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();// عدد أيام الشهر
// يضيف مدى أيام [a,b] إلى قائمة مدى الشهر ويدمج المتلاصق (حتى 8 مدى)
export const cvAdd=(list,a,b)=>{const L=(list||[]).filter(r=>Array.isArray(r)&&r.length===2).map(r=>[N(r[0]),N(r[1])]);if(a>=1&&b>=a)L.push([a,b]);L.sort((p,r)=>p[0]-r[0]);const o=[];for(const r of L){const l=o[o.length-1];if(l&&r[0]<=l[1]+1)l[1]=Math.max(l[1],r[1]);else o.push([r[0],r[1]])}return o.slice(0,8)};
// تغطية ملفات التاريخ لفترة: الشهور الناقصة كلها، والأيام الناقصة داخل شهر مرفوع. approx = شهر رُفع قبل v174 (بلا مدى محفوظ) فيُقدَّر من أول وآخر يوم فيه بيع
export function coverage(M,P){
 const out={mon:[],days:[],approx:false,ok:true};if(!P)return out;const d=M&&M.d?M.d:{};
 for(const ym of months(P.from,P.to)){const a=P.from.slice(0,7)===ym?+P.from.slice(8):1,b=P.to.slice(0,7)===ym?+P.to.slice(8):dim(ym),x=d[ym];if(!x||(Array.isArray(x.cv)&&!x.cv.length)){out.mon.push(ym);continue}// (v248) شهر فيه مشتريات فقط = مبيعاته لم تُرفع
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
  try{const c=await fb.getDoc(fb.doc(X.db,"stk","lex"));lexFromDb(c.exists()?c.data():null)}catch(e){}// (v197) القاموس المشترك
  await loadPub();if(!X.ro&&rpcC())tabStatus();// 🗄 (v234) حالة جداول قاعدة البيانات (من غير انتظار)
  DATA=newData();SOLDC={};
  if(META&&META.q&&N(META.q.parts)>0){const z=await getParts(fb,"q",N(META.q.parts));if(z)loadQ(DATA,JSON.parse(await gun(z)))}
  }catch(e){if(!DATA)DATA=newData();REP=[{kind:"r",t:"تعذّر تحميل بيانات المخزون. تأكد من الإنترنت ومن لصق القواعد الجديدة، ثم أعد فتح القسم."}];UI.tab="up"}
 LOADED=true;
 LOADING=false;if(!DATA||!DATA.has)UI.tab="up";paint();
}
// تحميل شهور ملفات التاريخ عند الحاجة فقط
async function needMonths(from,to){
 if(!META||!META.d||!DATA)return;const want=months(from,to).filter(ym=>META.d[ym]&&!DATA.d[ym]&&!MFAIL[ym]);if(!want.length)return;
 BUSY="جاري تحميل مبيعات الفترة…";paint();const D0=DATA;
 // (v192) كل شهر وحده: شهر فشل تحميله يُعلَّم (MFAIL) ويظهر تنبيه أحمر بزر «أعد المحاولة»، ولا يُحسب صفراً بصمت كما كان
 try{const fb=await FB();let i=0;for(const ym of want){BUSY="جاري تحميل مبيعات الفترة… ("+(++i)+" من "+want.length+")";const e=g("stk-pg");if(e)e.textContent="("+i+" / "+want.length+")";
   try{const z=await getParts(fb,"d"+ym,Math.max(1,N(META.d[ym].parts)));if(DATA!==D0)break;if(z)loadMonth(DATA,ym,JSON.parse(await gun(z)));else MFAIL[ym]=1}catch(x){MFAIL[ym]=1}}SOLDC={}}catch(e){want.forEach(ym=>{if(!DATA.d[ym])MFAIL[ym]=1})}
 BUSY="";paint();
}
const by=()=>({e:String(X.me&&X.me.e||"").slice(0,120),n:String(X.me&&X.me.n||"").slice(0,60)});
async function saveQ(R,src){
 const fb=await FB(),z=await gz(packQ(R)),P=parts(z);if(P.length>10)throw new Error("big");
 const old=META&&META.q?N(META.q.parts):0,b=fb.writeBatch(X.db);P.forEach((p,i)=>b.set(fb.doc(X.db,"stk","q"+i),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<old;i++)b.delete(fb.doc(X.db,"stk","q"+i));
 const meta=Object.assign({v:1},META||{},{at:Date.now(),by:by(),q:{at:Date.now(),parts:P.length,rows:R.n,skus:R.k.length,sold:R.sum.sold,on:R.sum.on,from:R.from||"",to:R.to||"",src:String(src||"").slice(0,120),chk:R.tot.sold!==undefined?1:0,rc:R.rcOk?R.sum.rc:0}});if(!meta.d)meta.d={};
 b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=meta;
 DATA=newData();loadQ(DATA,{st:R.st,vn:R.vn,k:R.k,rv:1,vs:R.vs||[],rc:rcFlat(R),r:[...R.q].map(e=>[e[0]].concat(e[1]))});SOLDC={};// شهور التاريخ تُحمَّل من جديد عند الطلب (على القاموس الجديد)
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
  // (v248) لو الشهر فيه ملف مشتريات (rv): المشتريات تبقى كما هي، وعمود الاستلام في ملف التاريخ يُتجاهل حتى لا يتكرر
  const pm0=META&&META.d&&META.d[ym],hasRv=!!(pm0&&Array.isArray(pm0.rv)&&pm0.rv.length);
  const old=DATA.d[ym]||[],keep=[];for(let i=0;i<old.length;i+=5){if(!inR(ymd(ym,old[i+2]))||!sg.has(old[i+1]))keep.push(old[i],old[i+1],old[i+2],old[i+3],old[i+4]);else if(hasRv&&old[i+4])keep.push(old[i],old[i+1],old[i+2],0,old[i+4])}
  const inc=R.mon[ym]||[],inc2=[];for(let i=0;i<inc.length;i+=5){if(!inc[i+3]&&(hasRv||!inc[i+4]))continue;inc2.push(inc[i],inc[i+1],inc[i+2],inc[i+3],hasRv?0:inc[i+4])}
  loadMonth(DATA,ym,{st:R.st,k:R.k,r:inc2},keep);
  const r=DATA.d[ym];let sold=0,dmin=32,dmax=0;for(let i=0;i<r.length;i+=5){sold+=r[i+3];if(!r[i+3])continue;if(r[i+2]<dmin)dmin=r[i+2];if(r[i+2]>dmax)dmax=r[i+2]}if(dmin>dmax){dmin=0;dmax=0}
  // الأيام التي يغطيها ما رُفع لهذا الشهر (من فترة ذيل الملف؛ وبلا ذيل: من أول يوم إلى آخر يوم فيه)، مدموجة مع ما سبق
  let ca,cb;if(R.from){ca=from.slice(0,7)===ym?+from.slice(8):1;cb=to.slice(0,7)===ym?+to.slice(8):dim(ym)}else{const ds=R.days.filter(d=>d.slice(0,7)===ym);ca=ds.length?+ds[0].slice(8):0;cb=ds.length?+ds[ds.length-1].slice(8):0}
  const pm=META&&META.d&&META.d[ym],cv=cvAdd(pm?(Array.isArray(pm.cv)?pm.cv:[[N(pm.dmin)||1,N(pm.dmax)||1]]):[],ca,cb);
  const b=fb.writeBatch(X.db),oldP=META&&META.d&&META.d[ym]?Math.max(1,N(META.d[ym].parts)):0;
  if(!r.length){for(let i=0;i<oldP;i++)b.delete(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym));delete meta.d[ym];delete DATA.d[ym]}
  else{const P=parts(await gz(JSON.stringify(monthDoc(DATA,ym))));if(P.length>10)throw new Error("big");P.forEach((p,i)=>b.set(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<oldP;i++)b.delete(fb.doc(X.db,"stk","d"+ym+"_"+i));
   meta.d[ym]=Object.assign({n:r.length/5,parts:P.length,sold,dmin,dmax,cv,at:Date.now()},hasRv?{rv:pm0.rv,rq:N(pm0.rq)}:{})}
  meta.at=Date.now();meta.by=by();b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=Object.assign({},meta)}
 SOLDC={};LASTD=all;return all.length;
}
/* 📥 (v248) ملف المشتريات (الاستلام من المورد بالتاريخ، من Power BI يدوياً حتى يتم الربط بالسيستم):
   يُحفظ في نفس مستندات الشهر (الخانة الخامسة = المستلم) فلا يحتاج قواعد جديدة. يستبدل استلام أيام فترته في مخازن الملف فقط،
   ولا يلمس المبيعات. meta.d[ym].rv = الأيام التي يغطيها ملف مشتريات، rq = مجموع المستلم في الشهر. */
async function saveR(R){
 const fb=await FB(),touched=Object.keys(R.mon).sort();if(!touched.length)return 0;
 const from=R.from||R.days[0],to=R.to?addDays(R.to,-1):R.days[R.days.length-1],inR=R.from?(d=>d>=from&&d<=to):(set=>d=>set.has(d))(new Set(R.days));
 const all=R.from?months(from,to):touched,meta=Object.assign({v:1,d:{}},META||{});meta.d=Object.assign({},meta.d);if(!DATA)DATA=newData();
 const sg=new Set(R.st.map(x=>dIx(DATA,DATA.st,DATA.sti,x)));
 for(const ym of all){
  if(META&&META.d&&META.d[ym]&&!DATA.d[ym]){const z=await getParts(fb,"d"+ym,Math.max(1,N(META.d[ym].parts)));if(z)loadMonth(DATA,ym,JSON.parse(await gun(z)))}
  const old=DATA.d[ym]||[],keep=[];
  for(let i=0;i<old.length;i+=5){const own=inR(ymd(ym,old[i+2]))&&sg.has(old[i+1]);if(!own){keep.push(old[i],old[i+1],old[i+2],old[i+3],old[i+4]);continue}
   if(old[i+3])keep.push(old[i],old[i+1],old[i+2],old[i+3],0)}// المبيعات تبقى، واستلامها القديم يُستبدل
  loadMonth(DATA,ym,{st:R.st,k:R.k,r:R.mon[ym]||[]},keep);
  const r=DATA.d[ym];let sold=0,rq=0,dmin=32,dmax=0;for(let i=0;i<r.length;i+=5){sold+=r[i+3];rq+=r[i+4];if(!r[i+3])continue;if(r[i+2]<dmin)dmin=r[i+2];if(r[i+2]>dmax)dmax=r[i+2]}if(dmin>dmax){dmin=0;dmax=0}
  let ca,cb;if(R.from){ca=from.slice(0,7)===ym?+from.slice(8):1;cb=to.slice(0,7)===ym?+to.slice(8):dim(ym)}else{const ds=R.days.filter(d=>d.slice(0,7)===ym);ca=ds.length?+ds[0].slice(8):0;cb=ds.length?+ds[ds.length-1].slice(8):0}
  const pm=META&&META.d&&META.d[ym],rv=cvAdd(pm&&Array.isArray(pm.rv)?pm.rv:[],ca,cb);
  const b=fb.writeBatch(X.db),oldP=pm?Math.max(1,N(pm.parts)):0;
  if(!r.length){for(let i=0;i<oldP;i++)b.delete(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym));delete meta.d[ym];delete DATA.d[ym]}
  else{const P=parts(await gz(JSON.stringify(monthDoc(DATA,ym))));if(P.length>10)throw new Error("big");P.forEach((p,i)=>b.set(fb.doc(X.db,"stk",i?"d"+ym+"_"+i:"d"+ym),{v:1,z:p,at:Date.now()}));for(let i=P.length;i<oldP;i++)b.delete(fb.doc(X.db,"stk","d"+ym+"_"+i));
   // شهر بلا ملف مبيعات: cv فارغة (coverage تعتبره غير مرفوع)
   meta.d[ym]=Object.assign({},pm||{},{n:r.length/5,parts:P.length,sold,dmin:pm?N(pm.dmin)||dmin:dmin,dmax:pm?N(pm.dmax)||dmax:dmax,cv:pm&&Array.isArray(pm.cv)?pm.cv:pm?[[N(pm.dmin)||1,N(pm.dmax)||1]]:[],rv,rq,at:Date.now()})}
  meta.at=Date.now();meta.by=by();b.set(fb.doc(X.db,"stk","meta"),meta);await b.commit();META=Object.assign({},meta)}
 SOLDC={};ENVK="";LASTD=all;return all.length;
}
const rcvMonths=()=>Object.keys(META&&META.d||{}).filter(ym=>Array.isArray(META.d[ym].rv)&&META.d[ym].rv.length).sort();
// مدى ملفات المشتريات المطلوب للراكد: آخر N يوماً حتى يوم ملف الأرصدة
const rcvRange=()=>{const f=freshOf(CFG);if(!f||!rcvMonths().length||!(META&&META.q))return null;const e=qEnd(),t=today();return {from:addDays(e,-(f-1)),to:t>e?t:e}};// حتى اليوم: استلام بعد ملف الأرصدة يُحسب كذلك
let LASTD=[];// (v234) الشهور اللي آخر ملف تاريخ لمسها (لجداول قاعدة البيانات)
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
/* 🗄 (v234) جداول قاعدة البيانات الحقيقية (schema stock) للإدارة والـ IT: سطر لكل صنف في كل مخزن، تتملى من الذاكرة بعد كل رفع.
   الصفحة تبعت على دفعات (4000 سطر) والسيرفر يبدّل «الحالي» مرة واحدة في الآخر، فمحدش يشوف نص ملف. */
const TAB_CH=4000;let TABST=null,TABBUSY=false;
const rpcC=()=>X&&X.db&&X.db.c&&typeof X.db.c.rpc==="function"?X.db.c:null;
async function rpcx(fn,args){const c=rpcC();if(!c)throw new Error("norpc");const r=await c.rpc(fn,args);if(r&&r.error)throw r.error;return r?r.data:null}
async function tabPush(kind,ym,meta,rows,lbl){
 const id=await rpcx("stk_tab_begin",{p_kind:kind,p_ym:ym||"",p_meta:Object.assign({n:rows.length},meta||{})});
 for(let i=0;i<rows.length;i+=TAB_CH){const e=g("stk-pg");if(e)e.textContent=lbl+" "+Math.min(100,Math.round((i+TAB_CH)/rows.length*100))+"%";await rpcx("stk_tab_rows",{p_id:id,p_rows:rows.slice(i,i+TAB_CH)})}
 return await rpcx("stk_tab_end",{p_id:id});
}
export function tabOnhandRows(D){const L=[];D.q.forEach((a,ki)=>{if(!a)return;const k=D.k[ki];for(let j=0;j<a.length;j+=4)L.push([k[0],k[1]||"",k[2]||"",D.st[a[j]],a[j+3]>=0&&D.vn[a[j+3]]!==undefined?D.vn[a[j+3]]:"",N(a[j+1]),N(a[j+2]),D.hasRc?rcOf(D,ki,a[j]):null])});return L}
export function tabSalesRows(D,ym){const r=D.d[ym]||[],L=[];for(let i=0;i<r.length;i+=5){const k=D.k[r[i]];L.push([ym+"-"+String(r[i+2]).padStart(2,"0"),k[0],k[1]||"",k[2]||"",D.st[r[i+1]],N(r[i+3]),N(r[i+4])?N(r[i+4]):null])}return L}
async function tabStatus(){try{TABST=await rpcx("stk_tab_status",{})}catch(e){TABST=undefined}}
const tabErr=e=>{const c=String(e&&(e.code||e.message)||e||"");return /PGRST202|Could not find the function|norpc/.test(c)?"الصق القواعد الجديدة في Supabase أولاً":c.slice(0,80)};
async function tabSync(opt){
 if(X.ro||TABBUSY||!DATA||!DATA.has||!rpcC())return null;TABBUSY=true;const out={ok:0,err:""};
 try{
  if(opt.q){const q=META&&META.q||{};await tabPush("onhand","",{from:q.from||"",to:q.to?addDays(q.to,-1):"",src:q.src||""},tabOnhandRows(DATA),"الأرصدة");out.ok++}
  const yms=(opt.yms||[]).filter(ym=>META&&META.d&&META.d[ym]);let fb=null;
  for(const ym of yms){if(!DATA.d[ym]){fb=fb||await FB();const z=await getParts(fb,"d"+ym,Math.max(1,N(META.d[ym].parts)));if(z){loadMonth(DATA,ym,JSON.parse(await gun(z)));SOLDC={}}}
   const rows=tabSalesRows(DATA,ym);if(rows.length){await tabPush("sales",ym,{},rows,"مبيعات "+ym);out.ok++}}
 }catch(e){out.err=tabErr(e)}
 finally{TABBUSY=false;await tabStatus()}
 return out;
}
async function tabAll(){if(BUSY)return;BUSY="جاري تحديث جداول قاعدة البيانات…";paint();const r=await tabSync({q:true,yms:Object.keys(META&&META.d||{}).sort()});BUSY="";
 if(X.toast)X.toast(!r?"غير متاح هنا":r.err?"تعذّر تحديث الجداول: "+r.err:"🗄 اتحدّثت جداول قاعدة البيانات ✅");paint()}
function tabCard(){
 if(X.ro||!DATA||!DATA.has)return "";const L=Array.isArray(TABST)?TABST:[],oh=L.find(x=>x.kind==="onhand"),sm=L.filter(x=>x.kind==="sales");
 const dt=t=>t?E(new Date(t).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):"";
 return `<div class="stk-card"><h3>🗄 جداول قاعدة البيانات (للإدارة والـ IT)</h3><p>نفس البيانات محفوظة كجداول حقيقية في Supabase (schema <b data-notr dir="ltr">stock</b>): سطر لكل صنف في كل مخزن. تُقرأ من Table Editor أو SQL Editor أو أي برنامج تقارير، وتتحدّث تلقائياً مع كل رفع.</p>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">الأرصدة <b data-notr dir="ltr">stock.onhand</b></span><b data-notr>${oh?fmt(oh.rows)+" سطر · "+dt(oh.at):TABST===undefined?"—":"لم تُملأ بعد"}</b></div>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">المبيعات اليومية <b data-notr dir="ltr">stock.sales_daily</b></span><b data-notr>${sm.length?sm.length+" شهر · "+fmt(sm.reduce((s,x)=>s+N(x.rows),0))+" سطر":TABST===undefined?"—":"لم تُملأ بعد"}</b></div>
 ${TABST===undefined?`<p style="color:#8a2218">تعذّر قراءة حالة الجداول: الصق القواعد الجديدة في Supabase ثم اضغط الزر.</p>`:""}
 <button class="bt" type="button" data-sk="tabs" style="margin-top:8px">🗄 حدّث الجداول الآن</button></div>`;
}
async function onFiles(files){
 if(X.ro){if(X.toast)X.toast("رفع الملفات للأدمن ومالك النظام فقط");return}
 if(BUSY||!files||!files.length)return;REP=[];UI.rec=null;MFAIL={};UI.nsel={};UI.tsel={};UI.nrx=null;
 if(typeof CompressionStream==="undefined"||typeof DecompressionStream==="undefined"){REP=[{kind:"r",t:"هذا المتصفح قديم ولا يستطيع قراءة ملفات الإكسل هنا. استخدم Chrome أو Edge حديثاً."}];paint();return}
 let TQ=false;const TY=new Set();// 🗄 (v234) اللي اتحفظ ← جداول قاعدة البيانات مرة واحدة بعد كل الملفات
 for(const f of [...files]){const nm=String(f.name||"ملف");
  try{BUSY="جاري قراءة "+nm+"…";paint();let last=0;const R=await readFile(f,p=>{const pc=Math.round(p*100);if(pc-last>=4){last=pc;const e=g("stk-pg");if(e)e.textContent=pc+"%"}});
   if(!R.ok){REP.push({kind:"r",f:nm,t:"لم نتعرّف على أعمدة هذا الملف. المطلوب: DESCRIPTION2 و Store Name، ومعها SOLD_QTY و OH_QTY (ملف الكميات)، أو SOLD_QTY وأعمدة التاريخ (ملف التاريخ)، أو RCVD_QTY وأعمدة التاريخ (ملف المشتريات)، أو الفرع وأعمدة التاريخ و Net Sales WoTax بلا أكواد (ملف قيمة المبيعات)."});continue}
   // 💰 (v277) ملف قيمة المبيعات بالريال
   if(R.type==="v"){
    if(R.nan){REP.push({kind:"r",f:nm,t:"في ملف قيمة المبيعات "+R.nan+" خانة مبلغ ليست رقماً، فلم يُحفظ."});continue}
    if(R.trunc){REP.push({kind:"r",f:nm,t:"ملف قيمة المبيعات مقطوع من Power BI، فلم يُحفظ. نزّله على فترات أقصر."});continue}
    if(R.tot.am!==undefined&&Math.abs(R.tot.am-R.sum)>1){REP.push({kind:"r",f:nm,t:"مجموع الصفوف لا يطابق سطر الإجمالي في ملف قيمة المبيعات ("+fmt(R.sum)+" والإجمالي "+fmt(R.tot.am)+")، فلم يُحفظ. أعد تنزيل التقرير."});continue}
    if(!R.n){REP.push({kind:"w",f:nm,t:"ملف قيمة المبيعات ليس فيه أي سطر."});continue}
    if(R.tot.am===undefined)REP.push({kind:"w",f:nm,t:"لا يوجد سطر إجمالي في ملف قيمة المبيعات، فلم تُراجَع مجاميعه."});
    BUSY="جاري حفظ قيمة المبيعات…";paint();
    try{const o=await saveV(R);REP.push({kind:"g",f:nm,t:"ملف قيمة المبيعات: "+R.n+" سطر · "+R.st.length+" فرع · "+R.days.length+" يوماً · من "+o.from+" إلى "+o.to+" · المجموع "+fmt(R.sum)+" ريال"+(R.tot.am!==undefined?" · مطابق لسطر الإجمالي":"")})}
    catch(e){REP.push({kind:"r",f:nm,t:String(e&&e.message)==="valbig"?"ملف قيمة المبيعات أكبر من المسموح، نزّله على فترات أقصر.":"تعذّر حفظ قيمة المبيعات. تأكد من لصق القواعد الجديدة ومن الإنترنت ثم أعد الرفع."})}
    if(R.bad)REP.push({kind:"w",f:nm,t:R.bad+" سطر تُرك لنقص التاريخ."});continue}
   // 📥 (v248) ملف المشتريات
   if(R.type==="r"){
    if(R.nan){REP.push({kind:"r",f:nm,t:"في ملف المشتريات "+R.nan+" خانة كمية ليست رقماً، فلم يُحفظ."});continue}
    if(R.trunc){REP.push({kind:"r",f:nm,t:"ملف المشتريات مقطوع من Power BI عند 150 ألف سطر، فلم يُحفظ. نزّله على فترات أقصر (شهر أو شهرين في كل ملف) وارفعها كلها."});continue}
    if(R.tot.rc!==undefined&&!near(R.tot.rc,R.sum.rc)){REP.push({kind:"r",f:nm,t:"مجموع الصفوف لا يطابق سطر الإجمالي في ملف المشتريات (المستلم "+R.sum.rc+" والإجمالي "+R.tot.rc+")، فلم يُحفظ. أعد تنزيل التقرير."});continue}
    if(!R.n){REP.push({kind:"w",f:nm,t:"ملف المشتريات ليس فيه أي كمية مستلمة."});continue}
    if(R.tot.rc===undefined)REP.push({kind:"w",f:nm,t:"لا يوجد سطر إجمالي في ملف المشتريات، فلم تُراجَع مجاميعه."});
    BUSY="جاري حفظ المشتريات…";paint();const n=await saveR(R);LASTD.forEach(ym=>TY.add(ym));
    REP.push({kind:"g",f:nm,t:"ملف المشتريات: "+R.n+" سطر · "+R.days.length+" يوماً"+(R.from?" · الفترة من "+R.from+" إلى "+addDays(R.to,-1):"")+" · "+n+" شهر محدَّث · المستلم "+R.sum.rc+(R.tot.rc!==undefined?" · المجموع مطابق لسطر الإجمالي":"")});
    if(R.bad)REP.push({kind:"w",f:nm,t:R.bad+" سطر تُرك لنقص الكود أو التاريخ."});continue}
   const chk=R.tot.sold!==undefined?" · المجموع مطابق لسطر الإجمالي":"";
   // 🛡 (v174) لا يُحفظ ملف فيه خانة كمية غير رقمية، ولا ملف مجموع صفوفه يخالف سطر الإجمالي (المقطوع له رسالته الخاصة تحت)
   if(R.nan){REP.push({kind:"r",f:nm,t:"في الملف "+R.nan+" خانة كمية ليست رقماً، فلم يُحفظ. تأكد أن أعمدة الكميات أرقام ثم أعد تنزيل التقرير."});continue}
   if(!R.trunc&&R.tot.sold!==undefined&&(!near(R.tot.sold,R.sum.sold)||(R.type==="q"&&R.tot.on!==undefined&&!near(R.tot.on,R.sum.on)))){
    REP.push({kind:"r",f:nm,t:"مجموع الصفوف لا يطابق سطر الإجمالي في الملف (المبيعات "+R.sum.sold+" والإجمالي "+R.tot.sold+(R.type==="q"&&R.tot.on!==undefined?"، الرصيد "+R.sum.on+" والإجمالي "+R.tot.on:"")+")، فلم يُحفظ حتى لا تُبنى الأرقام على ملف ناقص. أعد تنزيل التقرير."});continue}
   if(R.tot.sold===undefined)REP.push({kind:"w",f:nm,t:"لا يوجد سطر إجمالي في هذا الملف، فلم تُراجَع مجاميعه."});
   if(R.type==="q"){if(R.trunc){REP.push({kind:"r",f:nm,t:"ملف الكميات مقطوع من Power BI (أكثر من 150 ألف سطر)، فلم يُحفظ. نزّله بلا أعمدة زائدة أو على مجموعتين من الفروع."});continue}
    BUSY="جاري حفظ الكميات…";paint();await saveQ(R,nm);TQ=true;BUSY="جاري النشر للفروع…";paint();const pubOk=await publish(true);REP.push({kind:pubOk?"g":"w",f:nm,t:pubOk?"📤 نُشر للفروع: المتوفر في المستودع والطلب المقترح لكل فرع.":"لم يُنشر للفروع (الصق القواعد الجديدة ثم اضغط «انشر للفروع الآن»)."});REP.push({kind:"g",f:nm,t:"ملف الكميات: "+R.n+" سطر · "+R.k.length+" صنف · "+R.st.length+" مخزن · الرصيد "+R.sum.on+" · المبيعات "+R.sum.sold+(R.rcOk?" · المستلم "+R.sum.rc:"")+chk});
    if(!R.from)REP.push({kind:"w",f:nm,t:"الملف ليس في آخره فترة التقرير (تصدير بلا سطر الإجمالي)، فاعتبرنا مبيعاته من 1 يناير حتى اليوم. معدل البيع في «الشراء المقترح» و«يكفي كم يوماً» محسوب على ذلك."});
    if(!R.rcOk&&R.rcn)REP.push({kind:"w",f:nm,t:"عمود المستلم في هذا الملف فيه "+R.rcn+" كود فقط، فلم يُعتمد (يُعتمد لو فيه استلام لعشرين كوداً فأكثر)."})}
   else{if(R.trunc){const cov=R.tot.sold?Math.round(R.sum.sold/R.tot.sold*100):0;
     REP.push({kind:"r",f:nm,t:"ملف التاريخ مقطوع من Power BI عند 150 ألف سطر"+(cov?" (يحتوي على "+cov+"% فقط من مبيعات الفترة)":"")+"، فلم يُحفظ. نزّله على فترات أقصر (شهر أو شهرين في كل ملف) وارفع الملفات كلها: المنصة تجمعها، وكل ملف يستبدل أيام فترته فقط."});continue}
    BUSY="جاري حفظ مبيعات الأيام…";paint();const n=await saveD(R);LASTD.forEach(ym=>TY.add(ym));REP.push({kind:"g",f:nm,t:"ملف التاريخ: "+R.n+" سطر · "+R.days.length+" يوماً"+(R.from?" · الفترة من "+R.from+" إلى "+addDays(R.to,-1):"")+" · "+n+" شهر محدَّث · المبيعات "+R.sum.sold+chk})}
   if(R.bad)REP.push({kind:"w",f:nm,t:R.bad+" سطر تُرك لنقص الكود أو التاريخ."})}
  catch(e){const c=e&&(e.code||e.message)||"";REP.push({kind:"r",f:nm,t:c==="notzip"?"الملف ليس xlsx ولا csv صالحاً.":c==="permission-denied"?"غير مسموح بالحفظ. تأكد من لصق القواعد الجديدة في Supabase.":c==="big"?"الملف أكبر من المسموح بتخزينه.":"تعذّرت قراءة الملف أو حفظه ("+String(c).slice(0,60)+")."})}}
 if((TQ||TY.size)&&rpcC()){BUSY="جاري تحديث جداول قاعدة البيانات…";paint();const tb=await tabSync({q:TQ,yms:[...TY].sort()});
  if(tb)REP.push(tb.err?{kind:"w",t:"لم تتحدّث جداول قاعدة البيانات ("+tb.err+"). البيانات محفوظة في المنصة عادي، واضغط «حدّث الجداول الآن» بعدين."}:{kind:"g",t:"🗄 اتحدّثت جداول قاعدة البيانات (stock.onhand و stock.sales_daily) للإدارة والـ IT."})}
 BUSY="";if(DATA&&DATA.has&&!REP.some(r=>r.kind==="r"))UI.tab="up";paint();
}
async function saveCfg(){try{const fb=await FB();const c={min:N(CFG.min),keep:N(CFG.keep),slow:N(CFG.slow),days:N(CFG.days),stale:N(CFG.stale),ex:(CFG.ex||[]).slice(0,40),wh:String(CFG.wh||DEF.wh),ov:(CFG.ov||[]).slice(0,60),at:Date.now(),by:by().e};
  await fb.setDoc(fb.doc(X.db,"stk","cfg"),c);if(X.toast)X.toast("تم حفظ القواعد ✅");if(DATA&&DATA.has)publish(true)}catch(e){if(X.toast)X.toast("تعذّر حفظ القواعد")}}

/* ============ 6) الواجهة ============ */
const CSS=`.stk-lqn{margin:8px 0 0;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--acc,#8a5a83) 10%,transparent);font-size:13px}
.stk-lqp{margin-top:10px;padding:12px;border:1px solid var(--line,#e3d6c4);border-radius:12px;background:var(--card,#fffaf3)}
.stk-lql{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.stk-lql li{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4px 10px;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#e3d6c4)}
.stk-lql li.ok{opacity:.62}.stk-lql li>b{font-weight:600;overflow-wrap:anywhere}.stk-lql li>small{grid-column:2;opacity:.7}
.stk-lqk{font-size:12px;white-space:nowrap;opacity:.85}.stk-lqb{grid-row:1/3;grid-column:3;display:flex;gap:4px}
@media(max-width:560px){.stk-lql li{grid-template-columns:1fr auto}.stk-lqk{grid-column:1}.stk-lql li>b,.stk-lql li>small{grid-column:1}.stk-lqb{grid-row:1/4;grid-column:2;flex-direction:column}}
#stk{display:block}.stk-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px}.stk-hd h2{margin:0;font-size:21px}.stk-hd small{display:block;color:var(--mut);font-size:13px;line-height:1.7}
.stk-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 14px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:14px}.stk-tabs::-webkit-scrollbar{display:none}
@media (hover:hover) and (pointer:fine){.stk-tabs{flex-wrap:wrap;overflow-x:visible}}/* (v226) بالماوس لا يوجد سحب: الأقسام تنزل سطراً ثانياً فتظهر كلها. باللمس تبقى شريطاً يُسحب */
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
.stk-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
.stk-fo{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin:0 0 12px}.stk-foh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.stk-foh .sp{flex:1}.stk-fon{color:var(--mut);font-size:13.5px}.stk-foe{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)}.stk-foe>div{min-width:0}.stk-foe label{display:block;font-size:13px;color:var(--mut)}.stk-foe select,.stk-foe input{display:block;width:100%;margin-top:4px}.stk-t tr.fo>td:first-child{box-shadow:inset -4px 0 0 var(--olive,#6f7d45)}html.tz-en .stk-t tr.fo>td:first-child{box-shadow:inset 4px 0 0 var(--olive,#6f7d45)}.stk-chips i{font-style:normal;color:var(--mut);font-size:12.5px;margin-inline-end:2px}.stk-chips button{border:1.5px solid var(--line);background:var(--soft);color:var(--ink);border-radius:999px;padding:4px 13px;font:inherit;font-size:13.5px;cursor:pointer;min-height:34px;unicode-bidi:plaintext}.stk-chips button:hover{border-color:var(--acc)}
.stk-ask{margin:0 0 12px}.stk-und .stk-undt{flex:1 1 100%;font-size:13px;color:var(--mut);font-weight:600}
.stk-ttl{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:6px 4px 10px}.stk-ttl h3{margin:0;font-size:21px}.stk-ttl small{color:var(--mut);font-size:13.5px}
.stk-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;margin:0 0 12px}.stk-tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0}
.stk-tile b{font-size:25px;line-height:1.2;font-variant-numeric:tabular-nums}.stk-tile span{color:var(--mut);font-size:12.5px;line-height:1.5}.stk-tile.dt b{font-size:18px;white-space:nowrap;line-height:1.7}.stk-tile.k{border-color:var(--acc)}.stk-tile.k b{color:var(--acc)}.stk-tile.bad b{color:#c4362b}
.stk-tile.go{cursor:pointer;background:var(--soft)}.stk-tile.go:hover{border-color:var(--acc)}.stk-tile.go span::after{content:" ‹";font-weight:800}
.stk-act{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.stk-src{color:var(--mut);font-size:12.5px;line-height:1.9;margin:12px 4px 0}.stk-ph{margin:8px 10px 6px;font-size:16px}.stk-t td.n{direction:ltr}
:where([data-theme=dark]) .stk-tile.bad b{color:#f1a5a0}
.stk-ins{list-style:none;margin:0;padding:0}.stk-ins li{padding:9px 0;border-top:1px solid var(--line);font-size:14.5px;line-height:1.85}.stk-ins li:first-child{border-top:0}.stk-ins .bt.s{margin-inline-start:4px;vertical-align:middle}
.stk-crvl{display:flex;gap:14px;font-size:12.5px;color:var(--mut);margin:0 0 8px}.stk-crvl i{display:inline-block;width:12px;height:8px;border-radius:4px;margin-inline-end:5px;vertical-align:middle}
.stk-crv{display:grid;grid-template-columns:minmax(44px,auto) 1fr auto;gap:7px 10px;align-items:center}.stk-crv>b{font-size:13.5px}.stk-crv .bars{display:flex;flex-direction:column;gap:3px;min-width:0}.stk-crv .bars i{display:block;height:8px;border-radius:4px;min-width:2px}.stk-crv>span{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums;white-space:nowrap}
.stk-crv i.s,.stk-crvl i.s{background:var(--acc)}.stk-crv i.o,.stk-crvl i.o{background:var(--olive,#6f7d45)}:where([data-theme=dark]) .stk-crv i.o,:where([data-theme=dark]) .stk-crvl i.o{background:#a4b46e}
.stk-piv{margin-top:12px}.stk-pvb{box-shadow:none;border:0;padding:8px 6px 4px;margin:0}.stk-mx td.t{font-weight:800;border-inline-start:2px solid var(--line)}.stk-mx tr.whr td.s{background:var(--soft)}
.stk-lg{border-radius:6px;padding:1px 8px;font-weight:700}.stk-lg.need{background:#fdecea;color:#8a2218}.stk-lg.idle{background:#fff4e2;color:#6b4300}.stk-lg.wh{background:var(--soft);color:var(--ink)}:where([data-theme=dark]) .stk-lg.need{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .stk-lg.idle{background:#3a2a08;color:#f6c770}
.stk-t input.stk-tq{width:74px;height:36px;margin:0;text-align:center;font-weight:800}.stk-dl td{padding:4px 5px}.stk-dl input,.stk-dl select{height:38px;margin:0;width:118px;min-width:0}.stk-dl input.sm{width:78px;text-align:center}.stk-dl select{width:104px}
.stk-dg th{font-size:11.5px;padding:6px 4px}.stk-dg th.rt{border-inline:2px solid var(--line);background:var(--soft);font-size:12.5px;color:var(--ink)}.stk-dg th.on,.stk-dg td.on{background:var(--soft)}.stk-dg th.off{opacity:.45;text-decoration:line-through}
.stk-dg td{padding:3px 2px}.stk-dg td.s{padding:6px 10px;text-align:start;min-width:120px}.stk-dg td.s i,.stk-dg td.t i{white-space:nowrap}.stk-dg td.t,.stk-dg td.wh{padding:6px 10px}
.stk-dg .dgi{width:44px;height:34px;margin:0;padding:0 2px;text-align:center;border:1px solid transparent;background:transparent;border-radius:8px;font:inherit;font-weight:700;font-variant-numeric:tabular-nums;color:inherit;-moz-appearance:textfield}.stk-dg .dgi::-webkit-outer-spin-button,.stk-dg .dgi::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.stk-dg .dgi:hover{border-color:var(--line)}.stk-dg .dgi:focus{border-color:var(--acc);background:var(--card);outline:0}.stk-dg td.ov .dgi{border-color:var(--acc);background:var(--card)}.stk-dg .dgi::placeholder{color:var(--line);font-weight:400}
.stk-lvg{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}.stk-lvg>b{flex:0 0 100%;font-size:13px;color:var(--mut)}.stk-lvg label{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;margin:0}.stk-lvg select{height:36px;margin:0;width:auto;min-width:0;padding-inline:8px}
.stk-up>.stk-card{min-width:0;overflow-x:auto}.stk-seg{display:inline-flex;gap:4px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 12px;max-width:100%;overflow-x:auto}.stk-seg button{border:0;background:none;color:var(--mut);border-radius:9px;padding:0 14px;min-height:38px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}.stk-seg button.on{background:var(--acc);color:#fff;font-weight:700}:where([data-theme=dark]) .stk-seg button.on{color:#141015}
.stk-t tr.stk-dx>td{background:var(--soft);padding:8px 12px 12px;white-space:normal}.stk-t tr.stk-dx:hover>td{background:var(--soft)}.stk-dx .stk-t{background:var(--card);border-radius:10px}.stk-bar .stk-fx{height:42px;white-space:nowrap}.stk-bar input.cc{width:280px}.stk-cbar{display:block;height:8px;border-radius:4px;background:var(--acc);min-width:2px;margin-top:4px}.stk-t td.win{background:var(--olive-s,#e9ecd9);color:var(--olive-t,#3f4a22);font-weight:800}:where([data-theme=dark]) .stk-t td.win{background:#2c3318;color:#cbd89a}
.stk-t td.rk{color:var(--mut);width:34px}.stk-t td.up{color:var(--olive,#6f7d45);font-weight:800}.stk-t td.dn{color:#c4362b;font-weight:800}.stk-cmp td.best{background:var(--olive-s,#e9ecd9);color:var(--olive-t,#3f4a22);font-weight:800;border-radius:8px}.stk-cmp th a{font-weight:700}.stk-cmp td:first-child{white-space:normal;min-width:96px;line-height:1.5}.stk-cmp th{white-space:normal}@media (max-width:560px){.stk-cmp td,.stk-cmp th{padding:7px 6px;font-size:13px}}.stk-und+.stk-und{margin-top:-4px}
:where([data-theme=dark]) .stk-t td.up{color:#a4b46e}:where([data-theme=dark]) .stk-t td.dn{color:#f1a5a0}:where([data-theme=dark]) .stk-cmp td.best{background:#2c3318;color:#cbd89a}
@media (max-width:760px){.stk-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.stk-tile b{font-size:21px}.stk-askb .bt{padding:0 16px}}
.stk-busy{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--acc);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-weight:700}.stk-busy::before{content:"";width:16px;height:16px;border:2.5px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:ui-spin .7s linear infinite}
:where([data-theme=dark]) .stk-tabs button.on{color:#141015}:where([data-theme=dark]) .stk-rep.r,:where([data-theme=dark]) .stk-mx td.need{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .stk-rep.w,:where([data-theme=dark]) .stk-mx td.idle{background:#3a2a08;color:#f6c770}:where([data-theme=dark]) .stk-t .z{color:#f1a5a0}:where([data-theme=dark]) .stk-t .no{color:#f6c770}
@media (max-width:760px){.stk-up{grid-template-columns:1fr}.stk-bar label{flex:1 1 calc(50% - 4px)}.stk-bar select,.stk-bar input,.stk-bar input[type=number],.stk-bar input[type=search],.stk-bar input[type=text]{width:100%}.stk-bar .sp{display:none}.stk-bar .bt{flex:1 1 calc(50% - 4px)}}
.stk-lxf{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1.5px solid var(--acc);border-radius:12px;background:var(--soft)}.stk-lxf label{display:block;font-size:12.5px;color:var(--mut)}.stk-lxf input,.stk-lxf select{display:block;margin-top:3px;min-width:150px}.stk-lxf small{flex-basis:100%}.stk-lxl{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}.stk-chips button.stk-lxu{padding:4px 8px;min-width:0;margin-inline-start:-4px;color:var(--mut)}
.stk-dw th,.stk-dw td{text-align:center;padding:5px 6px}.stk-dw td.c,.stk-dw th:first-child{text-align:start}.stk-dw input.sm{width:62px;text-align:center;padding:4px 2px}.stk-dw tr.tot td{font-weight:700;background:var(--soft)}.stk-dw td.t{background:var(--soft)}
.stk-ih{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:0 0 12px}.stk-iht{display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap}.stk-iht h3{margin:0;font-size:24px}.stk-iht h3 small{font-size:14px;color:var(--mut);font-weight:600}.stk-iht>small{color:var(--mut);font-size:13px}.stk-ihv{margin:8px 0 0;font-size:15px;line-height:1.9;color:var(--ink)}
.stk-vd{display:inline-block;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700;background:var(--soft);color:var(--ink);border:1px solid var(--line);white-space:nowrap}.stk-vd.s{padding:1px 9px;font-size:12px}.stk-vd.bad{background:#fbe9e7;color:#9a2a20;border-color:#efc4be}.stk-vd.warn{background:#fdf1dc;color:#8a5a12;border-color:#ecd5a6}.stk-vd.good{background:#eef2e2;color:#4c5a2b;border-color:#d3dcb6}
.stk-iac h3{margin:0 0 10px}.stk-iac{margin:0 0 12px}.stk-ial{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.stk-ia{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-inline-start:5px solid var(--mut);border-radius:12px;padding:10px 12px;background:var(--soft)}.stk-ia.bad{border-inline-start-color:#c4362b}.stk-ia.warn{border-inline-start-color:#c98a1b}.stk-ia.good{border-inline-start-color:var(--olive,#6f7d45)}.stk-ia b.n{font-size:22px;font-weight:800;min-width:54px;text-align:center}.stk-ia div{flex:1;min-width:0}.stk-ia strong{display:block;font-size:14.5px}.stk-ia span{display:block;font-size:12.5px;color:var(--mut);line-height:1.6}.stk-iok{margin:0;color:var(--mut)}
.stk-itr{margin:0 0 8px;font-size:13.5px;line-height:1.8}.stk-itr .up{color:var(--olive,#6f7d45);font-weight:700}.stk-itr .dn{color:#c4362b;font-weight:700}.stk-wk{direction:ltr;display:flex;align-items:flex-end;gap:3px;height:120px;border-bottom:1px solid var(--line);padding-top:16px}.stk-wb{flex:1;min-width:4px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}.stk-wb i{display:block;width:100%;max-width:26px;background:var(--acc);opacity:.55;border-radius:4px 4px 0 0}.stk-wb i.l{opacity:1}.stk-wb:hover i{opacity:1}.stk-wb em{position:absolute;bottom:calc(100% - 16px);font-style:normal;font-size:11px;color:var(--mut);white-space:nowrap}.stk-wkx{display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:3px}
.stk-ist{display:flex;gap:6px 16px;flex-wrap:wrap;margin:0 0 10px;font-size:13px;color:var(--mut)}.stk-it td.stk-ibr{width:22%;min-width:70px;padding-inline:4px}.stk-it td.stk-ibr i{display:block;height:8px;border-radius:0 4px 4px 0;background:var(--acc);opacity:.75;min-width:1px}html.tz-en .stk-it td.stk-ibr i{border-radius:4px 0 0 4px}.stk-it td.stk-isg{font-size:12.5px;color:var(--mut);white-space:normal;min-width:130px}.stk-it tr.whr td{background:var(--soft)}
.stk-hm td,.stk-hm th{text-align:center;padding:6px 8px}.stk-hm td:first-child,.stk-hm th:first-child{text-align:start}.stk-hm td.dk{color:#fff}.stk-hm td.out{box-shadow:inset 0 0 0 2px #c4362b}.stk-hm tr.tot td,.stk-hm td.t{background:var(--soft);font-weight:700}
[data-theme=dark] .stk-vd.bad{background:#4a211d;color:#f3b6ae;border-color:#6a2e28}[data-theme=dark] .stk-vd.warn{background:#463514;color:#f0d08e;border-color:#5f4a1f}[data-theme=dark] .stk-vd.good{background:#2f3a1c;color:#cbd9a3;border-color:#44542a}
@media (max-width:640px){.stk-iht h3{font-size:20px}.stk-ia b.n{font-size:19px;min-width:44px}.stk-wk{height:96px}}
.stk-pls{display:flex;width:100%;margin:0 0 12px}.stk-pls button{flex:1;display:flex;gap:8px;align-items:center;justify-content:center;padding:12px 10px;font-size:15px;white-space:normal}.stk-pls button>b{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;background:var(--line);font-size:13px;flex:none}.stk-pls button.on>b{background:rgba(255,255,255,.25)}.stk-pls button small{opacity:.75;font-weight:400}
.stk-ox tr.oxr{cursor:pointer}.stk-ox tr.oxr:hover td,.stk-ox tr.oxr:focus-visible td{background:var(--soft)}.stk-ox tr.oxo td{background:var(--soft);border-bottom-color:transparent}.stk-ox td.oxc{width:22px;color:var(--mut);text-align:center}.stk-ox tr.oxdr>td{padding:0 10px 14px;background:var(--soft);white-space:normal}
.stk-oxd{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.stk-oxts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}.stk-oxt{flex:1 1 130px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;min-width:0}.stk-oxt b{display:block;font-size:20px;font-weight:800}.stk-oxt span{font-size:12px;color:var(--mut)}.stk-oxt.bad b{color:#c4362b}.stk-oxt.good b{color:var(--olive,#6f7d45)}
.stk-oxl td.oxa{color:var(--mut);text-align:center;padding-inline:2px}.stk-oxl tr[data-g] td{border-top:2px solid var(--line)}.stk-oxl tbody tr:first-child td{border-top:0}
.stk-ocs{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}.stk-oc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}.stk-oc.fo{border-inline-start:4px solid var(--olive,#6f7d45)}.stk-och{display:flex;gap:6px 10px;align-items:baseline;flex-wrap:wrap}.stk-och a{font-size:19px;font-weight:800;color:inherit}.stk-och small,.stk-oc p.off{color:var(--mut);font-size:12.5px}.stk-och .sp,.stk-ocf .sp{flex:1}
.stk-oc p{margin:0;font-size:13.5px;line-height:1.8}.stk-oc p.z{color:#c4362b}.stk-oc p i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px;background:var(--mut)}.stk-oc p i.g{background:var(--olive,#6f7d45)}.stk-oc p i.r{background:#c4362b}.stk-ocf{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:auto;padding-top:6px}
@media (max-width:640px){.stk-ocs{grid-template-columns:1fr}}
.stk-zb{display:block;height:8px;border-radius:4px;background:var(--acc)}
.stk-selb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:8px 12px;margin:0 0 12px;font-size:13.5px}.stk-selb .sp{flex:1}.stk-selb small{flex-basis:100%}.stk-t th.ck,.stk-t td.ck{width:38px;text-align:center;padding-inline:6px}.stk-t td.ck input,.stk-t th.ck input{width:19px;height:19px;margin:0;cursor:pointer;accent-color:var(--acc)}.stk-rvh{margin:14px 0 6px;font-size:15px}.stk-rvh small{color:var(--mut);font-weight:400;margin-inline-start:8px}
.stk-dhero{display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap;background:linear-gradient(135deg,var(--acc),#5d3a59);color:#fff;border-radius:18px;padding:16px 18px;margin:0 0 12px;box-shadow:0 6px 18px rgba(60,30,60,.18)}.stk-dhero h2{margin:0;font-size:21px;color:#fff}.stk-dhero small{color:rgba(255,255,255,.82);font-size:12.5px}.stk-dhero small b{color:#fff}.stk-dhero .sp{flex:1}.stk-dhero .bt.p{background:#fff;color:#5d3a59;border-color:#fff}
.stk-dseg{margin:0!important;background:rgba(255,255,255,.14)!important;border-color:transparent!important}.stk-dseg button{color:#fff!important}.stk-dseg button.on{background:#fff!important;color:#5d3a59!important}
.stk-dks{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:0 0 12px}.stk-dk{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:2px;min-width:0;position:relative;overflow:hidden;transition:transform .15s,border-color .15s}
.stk-dk::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:4px;background:var(--line)}.stk-dk.k::before{background:var(--acc)}.stk-dk.warn::before{background:#d99a1c}.stk-dk.bad::before{background:#c4362b}.stk-dk.good::before{background:var(--olive,#6f7d45)}
.stk-dk b{font-size:27px;line-height:1.15;font-variant-numeric:tabular-nums}.stk-dk.bad b{color:#c4362b}.stk-dk.k b{color:var(--acc)}.stk-dk span{color:var(--mut);font-size:12.5px;line-height:1.5}.stk-dk small{font-size:12px;font-weight:800}.stk-dk small.up{color:var(--olive,#6f7d45)}.stk-dk small.dn{color:#c4362b}
.stk-dk[role=button]{cursor:pointer}.stk-dk[role=button]:hover{transform:translateY(-2px);border-color:var(--acc)}.stk-dk[role=button] span::after{content:" ‹";font-weight:800}
.stk-dtip ul{margin:4px 0 0;padding-inline-start:20px}.stk-dtip li{margin:4px 0;line-height:1.9;font-size:14px}
.stk-dgrid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:12px;margin:0 0 12px;align-items:start}.stk-dcol{display:flex;flex-direction:column;gap:12px;min-width:0}
.stk-dstep{display:flex;align-items:center;gap:8px;margin:12px 0 6px;font-weight:800}.stk-dstep b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;font-size:13px}.stk-dstep small{color:var(--mut);font-weight:600;margin-inline-start:auto}
.stk-dl2{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px}.stk-dl2 li{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--soft,transparent)}.stk-dl2 li.dn{opacity:.55}.stk-dl2 li.dn .stk-dt b{text-decoration:line-through}
.stk-dcb input{width:20px;height:20px;margin:0;accent-color:var(--olive,#6f7d45);cursor:pointer}.stk-dn{font-weight:800;color:var(--mut);min-width:16px;text-align:center}.stk-dt{flex:1;min-width:0;display:flex;flex-direction:column}.stk-dt a{color:inherit;text-decoration:none}.stk-dt small{color:var(--mut);font-size:12.5px;line-height:1.7}
.stk-dtb td.w,.stk-dbr td.w{width:34%;min-width:90px}.stk-db{display:block;height:9px;border-radius:5px;background:linear-gradient(90deg,var(--acc),#b48aab)}.stk-db.lw{background:linear-gradient(90deg,#d99a1c,#f0c869)}.stk-dtb td.c small{display:block;color:var(--mut);font-size:11.5px;white-space:normal}
.stk-dbw{display:flex;align-items:center;gap:8px}.stk-dbw .stk-db{flex:none}.stk-dbw em{font-style:normal;font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--mut)}
.stk-dgrid>*,.stk-dcol>*,.stk-dks>*{min-width:0}.stk-drow{cursor:pointer}.stk-drow:hover td{background:var(--soft,rgba(0,0,0,.03))}
@media (max-width:1100px){.stk-dks{grid-template-columns:repeat(3,minmax(0,1fr))}.stk-dgrid{grid-template-columns:1fr}}
@media (max-width:640px){.stk-dks{grid-template-columns:repeat(2,minmax(0,1fr))}.stk-dk b{font-size:22px}.stk-dhero .bt.p{flex:1 1 100%}.stk-dseg{flex:1 1 100%}.stk-dtb td.w,.stk-dbr td.w{min-width:56px;width:26%}.stk-dtb th:nth-child(5),.stk-dtb td:nth-child(5),.stk-dbr th:nth-child(5),.stk-dbr td:nth-child(5),.stk-dbr th:nth-child(6),.stk-dbr td:nth-child(6){display:none}}
:where([data-theme=dark]) .stk-dk.bad b{color:#f1a5a0}:where([data-theme=dark]) .stk-dhero{background:linear-gradient(135deg,#6b4566,#3b2439)}
@media print{#pa.stkd{-webkit-print-color-adjust:exact;print-color-adjust:exact}#pa.stkd .pks{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin:0 0 3mm}#pa.stkd .pk{border:1px solid #999;border-radius:2mm;padding:2mm;border-inline-start:3mm solid #8a5a83}#pa.stkd .pk.w{border-inline-start-color:#d99a1c}#pa.stkd .pk.r{border-inline-start-color:#c4362b}#pa.stkd .pk b{display:block;font-size:14pt}#pa.stkd .pk span{font-size:8pt;color:#444}#pa.stkd .pb{border:1px solid #bbb;border-radius:2mm;padding:2mm 3mm;margin:0 0 3mm;break-inside:avoid}#pa.stkd .pb h3{margin:0 0 1.5mm;font-size:11pt;color:#5d3a59}#pa.stkd .pb ul{margin:0;padding-inline-start:5mm}#pa.stkd .pb li{font-size:9.5pt;line-height:1.6}#pa.stkd .pg2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}#pa.stkd .pg2 .pb{margin:0 0 3mm}}
@keyframes stkUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes stkRing{from{stroke-dashoffset:326.7}}@keyframes stkGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes stkW{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.stk-dhero{display:grid;grid-template-columns:1fr auto;grid-template-areas:"x s" "a a";gap:14px 18px;background:radial-gradient(120% 140% at 0% 0%,#b48aab 0%,#8a5a83 38%,#4a2c47 100%);color:#fff;border-radius:22px;padding:20px 22px;margin:0 0 14px;box-shadow:0 14px 30px -12px rgba(74,44,71,.55);position:relative;overflow:hidden}
.stk-dhero::after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.07);inset-inline-start:-80px;bottom:-140px;pointer-events:none}
.stk-dhero .hx{grid-area:x;min-width:0}.stk-dhero .hx small{opacity:.85;font-size:13px}.stk-dhero h2{margin:2px 0 4px;font-size:26px;color:#fff;letter-spacing:0}.stk-dhero p{margin:0;font-size:12.5px;opacity:.85}.stk-dhero p b{opacity:1}
.stk-dhero .hs{grid-area:s;display:flex;gap:12px;align-items:stretch}.stk-dhero .hn{background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:10px 16px;min-width:120px;display:flex;flex-direction:column;backdrop-filter:blur(4px)}.stk-dhero .hn b{font-size:28px;line-height:1.1;font-variant-numeric:tabular-nums}.stk-dhero .hn span{font-size:12px;opacity:.85}.stk-dhero .hn em{font-style:normal;font-size:12px;font-weight:800;margin-top:2px}.stk-dhero .hn em.up{color:#d9f0a8}.stk-dhero .hn em.dn{color:#ffc4bd}
.stk-dhero .ha{grid-area:a;display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:relative;z-index:1}.stk-dhero .ha .stk-seg{flex:1 1 auto}.stk-dhero .bt.p{background:#fff;color:#4a2c47;border-color:#fff;font-weight:800}
.stk-rgs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 12px}.stk-rg{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px 10px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:0;transition:transform .2s,box-shadow .2s}.stk-rg.go{cursor:pointer}.stk-rg:hover{transform:translateY(-3px);box-shadow:0 10px 22px -14px rgba(0,0,0,.35)}
.stk-rg .rw{position:relative;width:min(128px,100%);aspect-ratio:1}.stk-rg svg,.stk-bc .mr svg{width:100%;height:100%;transform:rotate(-90deg)}.stk-rg circle,.stk-bc .mr circle{fill:none;stroke-width:11}.stk-rg circle.b,.stk-bc .mr circle.b{stroke:var(--line)}.stk-rg circle.f,.stk-bc .mr circle.f{stroke-linecap:round}.stk-rg circle.f.an,.stk-bc .mr circle.f.an{animation:stkRing 1.4s cubic-bezier(.16,1,.3,1) both}
.stk-rg .v{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.stk-rg .v b{font-size:24px;font-variant-numeric:tabular-nums;line-height:1.1}.stk-rg .v small{font-size:10.5px;color:var(--mut);line-height:1.4;max-width:80%}.stk-rg>span{font-size:13px;font-weight:700;line-height:1.5}.stk-rg.go>span::after{content:" ‹"}
.stk-mks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}.stk-mk{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;min-width:0;cursor:pointer;transition:transform .2s,border-color .2s}.stk-mk:hover{transform:translateY(-2px);border-color:var(--acc)}
.stk-mk>i{font-style:normal;width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--acc) 14%,transparent)}.stk-mk.bad>i{background:color-mix(in srgb,#c4362b 14%,transparent)}.stk-mk.warn>i{background:color-mix(in srgb,#d99a1c 16%,transparent)}.stk-mk b{display:block;font-size:22px;line-height:1.1;font-variant-numeric:tabular-nums}.stk-mk.bad b{color:#c4362b}.stk-mk span{font-size:12px;color:var(--mut)}
.stk-dch .chh{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap}.stk-dch .chh small{color:var(--mut);font-size:12.5px}.stk-dch .cols{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:3px;align-items:end;height:130px;margin-top:10px;direction:ltr}.stk-dch .c{height:100%;display:flex;align-items:flex-end;cursor:default}.stk-dch .c i{display:block;width:100%;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#b48aab,var(--acc));transform-origin:bottom}.stk-dch .c.hi i{background:linear-gradient(180deg,#a4b46e,#6f7d45)}.stk-dch .c:hover i{filter:brightness(1.15)}.stk-dch.an .c i{animation:stkGrow .7s cubic-bezier(.16,1,.3,1) both}.stk-dch .cx{display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:4px}
.stk-sec{margin:0 0 14px}.stk-sec>h3{margin:4px 2px 10px;font-size:17px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.stk-sec>h3 small,.stk-hb h3 small{font-size:12px;color:var(--mut);font-weight:500}
.stk-bcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.stk-bc{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;cursor:pointer;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s,border-color .2s;min-width:0}
.stk-bc::before{content:"";position:absolute;top:0;inset-inline:0;height:4px;background:var(--olive,#6f7d45)}.stk-bc.warn::before{background:#d99a1c}.stk-bc.bad::before{background:#c4362b}.stk-bc:hover{transform:translateY(-3px);box-shadow:0 12px 24px -16px rgba(0,0,0,.4)}.stk-bc.on{border-color:var(--acc);box-shadow:0 0 0 2px var(--acc)}.stk-bc.dn{opacity:.6}.stk-bc.an{animation:stkUp .5s cubic-bezier(.16,1,.3,1) both}
.stk-bc .bt1{display:flex;align-items:center;gap:8px}.stk-bc .bt1 b{flex:1;min-width:0;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stk-bc .rk{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--soft,rgba(0,0,0,.05));flex:none}.stk-bc.bad .rk{background:#c4362b;color:#fff}.stk-bc.warn .rk{background:#d99a1c;color:#fff}
.stk-bc .ck input{width:19px;height:19px;margin:0;accent-color:var(--olive,#6f7d45);cursor:pointer}.stk-bc .okb{color:var(--olive,#6f7d45);font-weight:900}
.stk-bc .bt2{display:flex;align-items:center;gap:12px}.stk-bc .mr{position:relative;width:62px;height:62px;flex:none}.stk-bc .mr circle{stroke-width:13}.stk-bc .mr circle.f{stroke:var(--acc)}.stk-bc.bad .mr circle.f{stroke:#c4362b}.stk-bc.warn .mr circle.f{stroke:#d99a1c}.stk-bc.good .mr circle.f{stroke:var(--olive,#6f7d45)}.stk-bc .mr em{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:13px;font-weight:800}
.stk-bc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--mut)}.stk-bc ul b{color:var(--ink,inherit);font-variant-numeric:tabular-nums;font-size:14px}.stk-bc ul li.z b{color:#c4362b}
.stk-bc .bt3{display:flex;gap:6px;flex-wrap:wrap}.stk-bc .tg{font-size:11.5px;border-radius:999px;padding:2px 9px;background:var(--soft,rgba(0,0,0,.05))}.stk-bc .tg.n{background:color-mix(in srgb,var(--acc) 13%,transparent)}.stk-bc .tg.t{background:color-mix(in srgb,#30b0c7 15%,transparent)}.stk-bc .tg.g{color:var(--olive,#6f7d45)}
.stk-bd{margin-top:12px;border:1.5px solid var(--acc)}.stk-bd.an{animation:stkUp .35s cubic-bezier(.16,1,.3,1) both}.stk-bd .bdh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}.stk-bd .bdh h3{margin:0}.stk-bd .bdh .stk-seg{margin:0}.stk-bd .bdh .sp{flex:1}
.stk-hb .hbr{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--line)}.stk-hb .hbr:first-of-type{border-top:0}.stk-hb.an .hbr{animation:stkUp .45s cubic-bezier(.16,1,.3,1) both}.stk-hb .m{width:28px;text-align:center;font-size:19px;flex:none}.stk-hb .m i{font-style:normal;font-size:13px;font-weight:800;color:var(--mut)}
.stk-hb .hbx{flex:1;min-width:0}.stk-hb .hbt{display:flex;align-items:baseline;gap:8px}.stk-hb .hbt a{font-weight:800}.stk-hb .hbt small{flex:1;min-width:0;color:var(--mut);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stk-hb .hbt>b{font-variant-numeric:tabular-nums}
.stk-hb .tr{height:8px;border-radius:5px;background:var(--line);margin:5px 0 3px;overflow:hidden}.stk-hb .tr i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--acc),#b48aab);transform-origin:right}.stk-hb.lw .tr i{background:linear-gradient(90deg,#d99a1c,#f0c869)}.stk-hb.an .tr i{animation:stkW .9s cubic-bezier(.16,1,.3,1) both}.stk-hb .hbx>small{font-size:11.5px;color:var(--mut)}.stk-hb small.z,.stk-hb b.z{color:#c4362b}
.stk-tcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:0 0 8px}.stk-tc{display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:"f a t" "s s s";gap:6px 8px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;cursor:pointer;transition:transform .2s,border-color .2s;min-width:0}.stk-tc:hover{transform:translateY(-2px);border-color:#30b0c7}.stk-tc.an{animation:stkUp .45s cubic-bezier(.16,1,.3,1) both}
.stk-tc .fr{grid-area:f;font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stk-tc .to{grid-area:t;font-size:12.5px;font-weight:800;text-align:end;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stk-tc .ar{grid-area:a;display:flex;flex-direction:column;align-items:center;background:color-mix(in srgb,#30b0c7 14%,transparent);border-radius:12px;padding:4px 10px;line-height:1.2}.stk-tc .ar b{font-size:17px}.stk-tc .ar span{font-size:10px;color:var(--mut)}.stk-tc .ar i{font-style:normal;color:#30b0c7;font-weight:900}.stk-tc>small{grid-area:s;color:var(--mut);font-size:11.5px}.stk-tc .ok{color:var(--olive,#6f7d45)}
.stk-chs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.stk-chip{display:inline-flex;gap:8px;align-items:baseline;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 14px;color:inherit;text-decoration:none;font-weight:800}.stk-chip:hover{border-color:var(--acc)}.stk-chip small{font-weight:500;color:var(--mut)}
@media (max-width:1100px){.stk-rgs,.stk-mks{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.stk-dhero{grid-template-columns:1fr;grid-template-areas:"x" "s" "a";padding:16px}.stk-dhero .hs{flex-wrap:wrap}.stk-dhero .hn{flex:1 1 40%;min-width:0}.stk-dhero .hn b{font-size:22px}.stk-dhero .bt.p,.stk-dhero .ha .stk-seg{flex:1 1 100%}.stk-rg .rw{width:104px}.stk-rg .v b{font-size:20px}.stk-mk{padding:10px}.stk-mk>i{width:36px;height:36px;font-size:17px}.stk-mk b{font-size:19px}.stk-bcs,.stk-tcs{grid-template-columns:1fr}}
html.lite .an,html.lite .an *,html.lite .stk-rg circle.f.an{animation:none!important}@media (prefers-reduced-motion:reduce){.stk-dch .c i,.stk-bc,.stk-hb .hbr,.stk-hb .tr i,.stk-tc,.stk-bd,.stk-rg circle.f,.stk-bc .mr circle.f{animation:none!important}}
:where([data-theme=dark]) .stk-dhero{background:radial-gradient(120% 140% at 0% 0%,#7b5576 0%,#5a3856 40%,#2c1a2b 100%)}:where([data-theme=dark]) .stk-mk.bad b,:where([data-theme=dark]) .stk-bc ul li.z b{color:#f1a5a0}
@media print{.stk-tabs,.stk-bar,.stk-drop,.stk-more{display:none!important}#pa.stkp{font-size:10pt}#pa.stkp .ph h2{font-size:17pt}#pa.stkp .ps{font-size:14pt;font-weight:700;margin:0 0 2mm;unicode-bidi:plaintext}#pa.stkp .pi{font-size:9pt;color:#444;margin:0 0 3mm}#pa.stkp .pt{width:100%;border-collapse:collapse}#pa.stkp .pt th,#pa.stkp .pt td{border:1px solid #777;padding:1.3mm 1.6mm;text-align:center;font-size:9.5pt;unicode-bidi:plaintext}#pa.stkp .pt th{background:#eee;font-size:9pt}#pa.stkp .pt td.bl{min-width:26mm}}`;
const TABS=[["home","📊","لوحة اليوم"],["out","📦","نفد من المستودع"],["ask","💬","اسأل"],["need","🧺","نواقص الفروع"],["tr","🔄","تحويلات مقترحة"],["buy","🛒","الشراء المقترح"],["dist","🚚","توزيع حاوية"],["item","🔍","تحليل صنف"],["pur","📥","المشتريات"],["sales","📅","المبيعات"],["val","💰","مبيعات الفروع بالريال"],["stale","💤","الراكد"],["up","⬆️","الملفات"],["cfg","⚙","القواعد"]];
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
// (v193) ملف كميات بلا ذيل الفترة (تصدير بلا سطر الإجمالي): آخر يوم = يوم رفع الملف (كان «اليوم» فيتحرك كل يوم)
const qEnd=()=>META&&META.q&&META.q.to?addDays(META.q.to,-1):META&&META.q&&N(META.q.at)?dts(META.q.at).slice(0,10):today();
// مدى ملف الكميات كله (من أول السنة حتى آخر يوم فيه): لحساب أيام البيع وللمطابقة
const fullR=()=>META&&META.q&&META.q.from?{from:META.q.from,to:qEnd()}:null;
// (v193) المدة التي تغطيها مبيعات ملف الكميات لحساب «معدل البيع اليومي»: من ذيل الملف، وإلا من 1 يناير حتى يوم الرفع (تقدير).
// بدونها كانت المدة = يوماً واحداً لملف بلا ذيل، فيخرج «الشراء المقترح» و«يكفي كام يوم» بأرقام خيالية
const spanR=()=>{const r=fullR();if(r)return r;if(!(META&&META.q))return null;const e=qEnd();return {from:e.slice(0,4)+"-01-01",to:e,guess:true}};
const perSel=()=>`<label>مبيعات الفترة<select data-sf="per" id="stk-per"><option value="ytd"${UI.per==="ytd"?" selected":""}>من أول السنة</option>${dHas()?[["30","آخر 30 يوماً"],["60","آخر 60 يوماً"],["90","آخر 90 يوماً"],["c","فترة أحددها"]].map(a=>`<option value="${a[0]}"${UI.per===a[0]?" selected":""}>${a[1]}</option>`).join(""):""}</select></label>${UI.per==="c"?`<label>من<input type="date" data-sf="from" id="stk-from" value="${E(UI.from)}"></label><label>إلى<input type="date" data-sf="to" id="stk-to" value="${E(UI.to)}"></label>`:""}`;
// تحذير ظاهر لو ملفات التاريخ لا تغطي الفترة كلها (بالشهر وباليوم): الرقم المعروض ناقص بقدرها
const gapNote=P=>{if(!P)return "";const c=coverage(META,P);if(c.ok)return "";const rg=r=>r[0]===r[1]?r[0]:r[0]+" ← "+r[1];
 return `<div class="stk-rep w">⚠️ ملفات التاريخ لا تغطي هذه الفترة كلها، فالمبيعات المعروضة أقل من الحقيقة بقدر الناقص.${c.mon.length?` شهور غير مرفوعة: <b data-notr>${E(c.mon.join(" · "))}</b>.`:""}${c.days.length?` أيام غير مرفوعة: <b data-notr>${E(c.days.slice(0,6).map(rg).join(" · "))}${c.days.length>6?" …":""}</b>${c.approx?" (تقدير: بعض الشهور رُفعت قبل هذا التحديث)":""}.`:""} ارفع ملف التاريخ لها من تبويب «الملفات».</div>`};
const sn=ti=>`<bdi dir="ltr" data-notr>${E(DATA.st[ti])}</bdi>`;
const kCells=ki=>{const x=DATA.k[ki];return `<td class="c" data-notr><a href="#" data-sk="code" data-c="${E(x[0])}" style="color:inherit">${E(x[0])}</a></td><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td>`};
const more=n=>n>UI.lim?`<button class="bt stk-more" type="button" data-sk="more">عرض المزيد (${fmt(n-UI.lim)} سطر آخر)</button>`:"";
// (v184) الفلاتر لا «تلزق»: زر ظاهر يمسحها متى كان أحدها مفعَّلاً، وزر «صنف آخر» بجوار خانة الكود
const fclr=keys=>keys.split(",").some(k=>UI[k]!==""&&UI[k]!=null&&UI[k]!==undefined)?`<button class="bt s stk-fx" type="button" data-sk="fclr" data-k="${keys}">✕ مسح الفلاتر</button>`:"";
const cBtn=()=>UI.code?`<button class="bt s stk-fx" type="button" data-sk="iclr">✕ صنف آخر</button>`:"";
let LASTX=null;// آخر نتيجة معروضة (للتصدير)
/* (v195) 🖨 الطباعة + ☑ تحديد السطور + 📤 طلب مباشر للفرع من النواقص المحدَّدة (بكميات تُعدَّل قبل الإنشاء) */
let NLIST=[],TLIST=[];// آخر قائمة معروضة: النواقص، والتحويلات (حسب الفروع)
const selOf=k=>UI[k]||(UI[k]={});
const nkOf=l=>l.ki+"|"+l.ti,tkOf=l=>l.ki+"|"+l.src+"|"+l.dst;
const nSel=()=>{const S=selOf("nsel");return NLIST.filter(l=>S[nkOf(l)])},tSel=()=>{const S=selOf("tsel");return TLIST.filter(l=>S[tkOf(l)])};
const tPick=L=>{const S=selOf("tsel"),a=L.filter(l=>S[tkOf(l)]);return a.length?a:L};// لو حُدّدت سطور من هذا الزوج فالطلب يقتصر عليها
// ما أُنشئ له طلب من النواقص (على هذا الجهاز، 14 يوماً): (كود|لون|مقاس|فرع) ← {no,at}
let NSENT=null;
const nsLoad=()=>{if(NSENT)return NSENT;let o=null;try{o=JSON.parse(localStorage.getItem("stk_nsent")||"null")}catch(e){}NSENT={};const lim=Date.now()-SENT_DAYS*864e5;if(o&&typeof o==="object")for(const k in o)if(o[k]&&N(o[k].at)>lim)NSENT[k]=o[k];return NSENT};
const nsKey=l=>{const x=DATA.k[l.ki];return [x[0],x[1],x[2],cd(DATA.st[l.ti])].join("|")};
const nsOf=l=>nsLoad()[nsKey(l)]||null;
const nQty=l=>{const q=UI.nrx&&UI.nrx.q?UI.nrx.q[nkOf(l)]:undefined;return q!==undefined?N(q):(l.give>0?l.give:Math.max(1,N(l.need)))};
const nSelInfo=()=>{const S=nSel();return S.length?fmt(S.length)+" سطر محدَّد · "+fmt(new Set(S.map(l=>l.ti)).size)+" فرع":"لم تحدِّد سطوراً: الطباعة والإكسل للقائمة كلها"};
const tSelInfo=()=>{const S=tSel();return S.length?fmt(S.length)+" سطر محدَّد · "+fmt(S.reduce((a,l)=>a+N(l.n),0))+" قطعة":"لم تحدِّد سطوراً: الطباعة والإكسل للقائمة كلها"};
function nSelBar(){const can=!!(X&&X.dispatch),has=nSel().length>0;
 return '<div class="stk-selb" id="stk-nselb"><b id="stk-nseli">'+nSelInfo()+'</b><span class="sp"></span><button class="bt s" type="button" data-sk="prn">🖨 '+(has?"اطبع المحدَّد":"اطبع القائمة")+"</button>"+(can?'<button class="bt g s" type="button" data-sk="nmk">📤 أنشئ طلباً للفرع من المحدَّد</button>':"")+(has?'<button class="bt s" type="button" data-sk="nsclr">إلغاء التحديد</button>':"")+"</div>"}
function tSelBar(){const has=tSel().length>0;
 return '<div class="stk-selb" id="stk-tselb"><b id="stk-tseli">'+tSelInfo()+'</b><span class="sp"></span><button class="bt s" type="button" data-sk="prn">🖨 '+(has?"اطبع المحدَّد":"اطبع القائمة")+"</button>"+(has?'<button class="bt s" type="button" data-sk="tsclr">إلغاء التحديد</button>':"")+'<small class="off">حدِّد سطوراً من زوج (من ← إلى) ليقتصر طلب تحويله عليها.</small></div>'}
// مراجعة طلب النواقص: المحدَّد مقسوماً على الفروع، وكل سطر كميته تُعدَّل (صفر = لا يُرسل)
function nRev(){
 if(!UI.nrx||!X||!X.dispatch)return "";const S=nSel();if(!S.length){UI.nrx=null;return ""}
 const G=new Map();for(const l of S){let a=G.get(l.ti);if(!a){a=[];G.set(l.ti,a)}a.push(l)}
 const tis=[...G.keys()].sort((a,b)=>DATA.st[a]<DATA.st[b]?-1:1);let nOrd=0,pcs=0,skip=0;
 const parts=tis.map(ti=>{const L=G.get(ti),ok=isBr(DATA.st[ti]);let np=0,nl=0;L.forEach(l=>{const q=nQty(l);if(q>0){nl++;np+=q}});if(ok&&nl){nOrd++;pcs+=np}else if(!ok)skip++;
  return '<h4 class="stk-rvh">'+sn(ti)+" <small>"+(ok?fmt(nl)+" صنف · "+fmt(np)+" قطعة":"ليس فرعاً في المنصة: لن يُنشأ له طلب")+(L.length>400?" · أول 400 سطر فقط":"")+'</small></h4><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">المبيعات</th><th class="n">رصيد المستودع</th><th class="n">المقترح</th><th class="n">الكمية</th></tr></thead><tbody>'+L.slice(0,400).map(l=>{const q=nQty(l);return "<tr"+(q>0?"":' class="snt"')+">"+kCells(l.ki)+'<td class="n">'+N(l.on)+'</td><td class="n">'+N(l.sold)+'</td><td class="n'+(l.wh<=0?" z":"")+'">'+N(l.wh)+'</td><td class="n">'+N(l.give)+'</td><td class="n"><input type="number" class="stk-tq" min="0" max="99999" step="1" data-nq="'+nkOf(l)+'" id="nq'+l.ki+"_"+l.ti+'" value="'+q+'" aria-label="الكمية"'+(ok?"":" disabled")+"></td></tr>"}).join("")+"</tbody></table></div>"}).join("");
 return '<div class="stk-card" style="margin:0 0 12px;border:1.5px solid var(--acc)"><h3>📤 مراجعة طلبات الفروع من النواقص المحدَّدة</h3><p>طلب واحد لكل فرع بأصنافه، يصله إشعار ويظهر في «الطلبات» كطلب من المستودع. عدّل كمية أي سطر قبل الإنشاء (صفر = لا يُرسل). الكمية المبدئية هي «المقترح» من المستودع، وإن كان صفراً فالناقص عن الحد.</p>'+parts+'<div class="stk-act" style="margin:12px 0 0"><button class="bt p" type="button" data-sk="nmkgo"'+(nOrd?"":" disabled")+">📤 أنشئ "+fmt(nOrd)+" طلباً ("+fmt(pcs)+' قطعة)</button><button class="bt" type="button" data-sk="nmkx">إلغاء</button>'+(skip?'<small class="off">'+fmt(skip)+" مخزن ليس فرعاً في المنصة لن يُنشأ له طلب.</small>":"")+"</div></div>";
}
// طلبات الفروع من المحدَّد (دالة نقية للاختبار): [{ti, rows:[{k,c,z,q}], lines:[l], pcs}]
export function needOrders(D,S,qtyOf){const G=new Map();for(const l of S){const q=Math.max(0,Math.min(99999,Math.round(N(qtyOf(l)))));if(!(q>0))continue;let o=G.get(l.ti);if(!o){o={ti:l.ti,rows:[],lines:[],pcs:0};G.set(l.ti,o)}if(o.rows.length>=400)continue;const x=D.k[l.ki];o.rows.push({k:x[0],c:x[1],z:x[2],q,n:""});o.lines.push(l);o.pcs+=q}
 return [...G.values()].sort((a,b)=>D.st[a.ti]<D.st[b.ti]?-1:1)}
async function nSend(){
 if(BUSY||!X||!X.dispatch)return;const O=needOrders(DATA,nSel(),nQty).filter(o=>isBr(DATA.st[o.ti]));if(!O.length){if(X.toast)X.toast("لا أصناف بكمية أكبر من صفر");return}
 const pcs=O.reduce((s,o)=>s+o.pcs,0);
 if(!confirm("إنشاء "+O.length+" طلباً للفروع ("+fq(pcs)+" قطعة)؟\n\nسيصل كل فرع إشعار، ويظهر الطلب في «الطلبات» كطلب من المستودع.\nلا يمكن التراجع إلا بحذف الطلبات من «الطلبات»."))return;
 let okN=0;const bad=[],NS=nsLoad(),S=selOf("nsel");
 for(let i=0;i<O.length;i++){const o=O[i];BUSY="جاري إنشاء الطلبات… "+(i+1)+" من "+O.length;paint();let r=null;
  try{r=await X.dispatch({to:cd(DATA.st[o.ti]),rows:o.rows,rid:rid20(),gn:"نواقص مقترحة من تحليل المخزون: رصيد الفرع أقل من الحد."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
  if(r&&r.ok){okN++;const at=Date.now();o.lines.forEach(l=>{NS[nsKey(l)]={no:String(r.no||"").slice(0,40),at};delete S[nkOf(l)]});try{localStorage.setItem("stk_nsent",JSON.stringify(NS))}catch(e){}}
  else bad.push(DATA.st[o.ti]+": "+String(r&&r.err||"").slice(0,60))}
 BUSY="";UI.nrx=null;paint();if(X.toast)X.toast(bad.length?"أُنشئ "+okN+" طلباً، وتعذّر "+bad.length+": "+bad[0]:"✅ أُنشئ "+okN+" طلباً ووصل الفروع إشعار")
}
// 🖨 طباعة ما في الجدول المعروض (أو المحدَّد منه) على ورقة A4 من منطقة الطباعة #pa في اللوحة
function printX(){
 const tell=m=>{if(X&&X.toast)X.toast(m)};if(!LASTX){tell("لا شيء للطباعة في هذه الصفحة");return}const pa=document.getElementById("pa");if(!pa){tell("الطباعة غير متاحة هنا");return}
 const rows=LASTX.rows(),P=LASTX.prn||{};if(!rows.length){tell("لا شيء للطباعة");return}
 if(rows.length>1500&&!confirm("القائمة "+rows.length+" سطراً (حوالي "+Math.ceil(rows.length/36)+" صفحة). حدِّد سطوراً أو استخدم الفلاتر لتصغيرها.\n\nأتطبعها كلها؟"))return;
 const head=LASTX.head.concat(P.ask?["رد الفرع"]:[]),ttl=P.ttl||String(LASTX.name||"").split("-").join(" "),q=META&&META.q;
 pa.className="stkp";
 pa.innerHTML='<div class="ph"><h2>'+E(ttl)+'</h2><div><b>تاسومة</b> · تحليل المخزون</div></div>'+(P.sub?'<p class="ps">'+E(P.sub)+"</p>":"")+'<p class="pi">تاريخ الطباعة: '+E(today())+(q&&q.at?" · أرصدة ملف: "+E(dts(q.at)):"")+" · "+rows.length+" سطر"+(P.note?" · "+E(P.note):"")+'</p><table class="pt"><thead><tr><th>#</th>'+head.map(x=>"<th>"+E(x)+"</th>").join("")+"</tr></thead><tbody>"+rows.map((r,i)=>"<tr><td>"+(i+1)+"</td>"+r.map(c=>"<td>"+E(c==null?"":c)+"</td>").join("")+(P.ask?'<td class="bl"></td>':"")+"</tr>").join("")+'</tbody></table><div class="sg"><span>أمين المستودع</span><span>'+(P.ask?"مسؤول الفرع":"المستلم")+"</span></div>";
 const off=()=>{pa.className="";window.removeEventListener("afterprint",off)};window.addEventListener("afterprint",off);setTimeout(()=>window.print(),80);
}
/* (v193) 🎯 قائمة التركيز: موردون وأكواد يختارها المستخدم، تُعرض «أولاً» أو «فقط» في النواقص والتحويلات والشراء والراكد. محفوظة على الجهاز (localStorage.stk_focus) */
let FOC=null;
const focLoad=()=>{if(FOC)return FOC;let o=null;try{o=JSON.parse(localStorage.getItem("stk_focus")||"null")}catch(e){}o=o&&typeof o==="object"?o:{};
 FOC={v:Array.isArray(o.v)?o.v.filter(x=>typeof x==="string").slice(0,60):[],c:Array.isArray(o.c)?o.c.filter(x=>typeof x==="string").slice(0,400):[],m:o.m==="only"||o.m==="first"?o.m:"first",open:false};return FOC};
const focSave=()=>{try{localStorage.setItem("stk_focus",JSON.stringify({v:FOC.v,c:FOC.c,m:FOC.m}))}catch(e){}HOMEC=null};
const focOn=()=>{const F=focLoad();return F.m!=="off"&&(F.v.length>0||F.c.length>0)};
// يعلّم سطور القائمة (l.fo) ثم يضعها أولاً أو يبقيها وحدها. codeOf/vnOf: كود السطر واسم مورده
export const focusApply=(L,F,codeOf,vnameOf)=>{if(!F||F.m==="off"||(!F.v.length&&!F.c.length))return L;const C=new Set(F.c),V=new Set(F.v),a=[],b=[];
 for(const l of L){if(C.has(codeOf(l))||V.has(vnameOf(l))){l.fo=1;a.push(l)}else{l.fo=0;b.push(l)}}return F.m==="only"?a:a.concat(b)};
const focL=(L,codeOf,vnameOf)=>focusApply(L,focLoad(),codeOf,vnameOf);
const foCls=l=>l.fo?' class="fo"':"";
// أكواد مكتوبة أو ملصوقة من إكسل: تُفصل بمسافة أو فاصلة أو + أو سطر جديد
export const focusCodes=(txt,has)=>{const ok=[],bad=[];String(txt||"").split(/[\s,،;+\n\r\t]+/).map(x=>x.trim()).filter(Boolean).forEach(x=>{const c=has(x)?x:has(x.toUpperCase())?x.toUpperCase():"";if(c){if(ok.indexOf(c)<0)ok.push(c)}else if(bad.indexOf(x)<0)bad.push(x)});return {ok,bad}};
function focBar(){
 const F=focLoad(),n=F.v.length+F.c.length,vAll=vendors().filter(v=>F.v.indexOf(v)<0),miss=F.c.filter(c=>!DATA.code.has(c)).length;
 const seg=m=>'<button type="button" data-sk="fom" data-v="'+m[0]+'" class="'+(F.m===m[0]?"on":"")+'">'+m[1]+"</button>";
 const head='<div class="stk-foh"><b>🎯 قائمة التركيز</b>'+(n?'<span class="stk-seg" role="tablist" style="margin:0">'+[["first","أولاً في الصفحة"],["only","هذه فقط"],["off","إيقاف"]].map(seg).join("")+"</span>":"")+'<span class="stk-fon">'+(n?fmt(F.v.length)+" مورد · "+fmt(F.c.length)+" كود":"اختر موردين أو أكواداً لتظهر أولاً في النواقص والتحويلات والشراء والراكد")+'</span><span class="sp"></span><button class="bt s" type="button" data-sk="foed">'+(F.open?"إغلاق":n?"✏️ تعديل القائمة":"＋ اختر موردين أو أكواداً")+"</button></div>";
 if(!F.open)return '<div class="stk-fo">'+head+"</div>";
 const vch=F.v.map(v=>'<button type="button" data-sk="fovx" data-v="'+E(v)+'" data-notr title="إزالة">'+E(v)+" ✕</button>").join(""),cch=F.c.slice(0,120).map(c=>'<button type="button" data-sk="focx" data-c="'+E(c)+'" data-notr dir="ltr" title="إزالة"'+(DATA.code.has(c)?"":' style="opacity:.55;text-decoration:line-through"')+">"+E(c)+" ✕</button>").join("");
 return '<div class="stk-fo">'+head+'<div class="stk-foe"><div><label>أضف مورداً<select data-fo="v" id="stk-fov">'+opt(vAll,"","اختر مورداً…")+'</select></label><div class="stk-chips">'+(vch||"<i>لا موردين مختارين</i>")+'</div></div><div><label>أضف أكواداً (اكتبها أو الصقها من إكسل، وافصل بينها بمسافة أو فاصلة أو +)<input type="text" data-fo="c" id="stk-foc" dir="ltr" placeholder="13016 15002 41007" autocomplete="off"></label><div class="stk-chips">'+(cch||"<i>لا أكواد مختارة</i>")+(F.c.length>120?"<i>… و"+fmt(F.c.length-120)+" أخرى</i>":"")+"</div>"+(F.bad&&F.bad.length?'<p class="stk-src" style="color:#c4362b">أكواد ليست في ملف الكميات ولم تُضَف: <b data-notr dir="ltr">'+E(F.bad.slice(0,20).join(" · "))+"</b></p>":"")+(miss?'<p class="stk-src">'+fmt(miss)+" كود في القائمة ليس في ملف الكميات الحالي (مشطوب).</p>":"")+"</div></div>"+(n?'<div class="stk-act" style="margin:10px 0 0"><button class="bt s" type="button" data-sk="foclr">🗑 مسح القائمة</button><small class="off">القائمة محفوظة على هذا الجهاز.</small></div>':"")+"</div>";
}
function focChange(t){const F=focLoad();F.bad=[];
 if(t.dataset.fo==="v"){const v=t.value;if(v&&F.v.indexOf(v)<0&&F.v.length<60)F.v.push(v)}
 else{const r=focusCodes(t.value,c=>DATA.code.has(c));r.ok.forEach(c=>{if(F.c.indexOf(c)<0&&F.c.length<400)F.c.push(c)});F.bad=r.bad}
 if(F.m==="off")F.m="first";focSave();UI.lim=200;paint(false)}
function vNeed(){
 const P=period(),L0=shortages(DATA,CFG,{store:UI.st,vendor:UI.vn,q:UI.q,sold:UI.sold,min:UI.min,period:P});
 const PL=priList(CFG),prk=ki=>priRank(PL,DATA.k[ki][0]);L0.sort((a,b)=>a.ti!==b.ti?(DATA.st[a.ti]<DATA.st[b.ti]?-1:1):(prk(a.ki)-prk(b.ki))||cmpK(DATA.k[a.ki],DATA.k[b.ki]));
 const L=focL(L0,l=>DATA.k[l.ki][0],l=>vnOf(l.vi)),give=L.reduce((s,l)=>s+l.give,0),need=L.reduce((s,l)=>s+l.need,0),nb=new Set(L.map(l=>l.ti)).size;
 LASTX={name:"نواقص-الفروع",head:["الفرع","الكود","اللون","المقاس","المورد","رصيد الفرع","المبيعات","رصيد المستودع","المطلوب","المقترح من المستودع"],rows:()=>{const S=nSel();return (S.length?S:L).map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.vi>=0?DATA.vn[l.vi]:"",l.on,l.sold,l.wh,l.need,l.give]})},prn:{ttl:"نواقص الفروع (مقترح من المستودع)",sub:UI.st?"الفرع: "+UI.st:"",ask:1}};
 NLIST=L;const NSM=nsLoad(),NSEL=selOf("nsel"),rev=nRev();
 return focBar()+`<div class="stk-bar"><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(1),UI.st,"كل الفروع")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" placeholder="مثلاً 13016" dir="ltr"></label><label>الحد (أقل من)<input type="number" min="1" max="999" data-sf="min" id="stk-min" value="${E(UI.min)}" placeholder="${E(CFG.min)}"></label>${perSel()}<label class="ck"><input type="checkbox" data-sf="sold" id="stk-sold"${UI.sold?" checked":""}> ما باعه الفرع فقط</label><span class="sp"></span>${fclr("st,vn,q,min")}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${priNote(PL)}${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>سطر ناقص</span><span><b>${fmt(nb)}</b>فرع</span><span><b>${fmt(need)}</b>قطعة مطلوبة</span><span><b>${fmt(give)}</b>يغطيها المستودع</span>${need>give?`<span><b style="color:#c4362b">${fmt(need-give)}</b>لا يكفيها المستودع</span>`:""}</div>${nSelBar()}
 ${rev?rev:L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th class="ck"><input type="checkbox" id="stk-nsall" aria-label="تحديد كل المعروض" title="تحديد كل المعروض"></th>${UI.st?"":"<th>الفرع</th>"}<th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">المبيعات</th><th class="n">رصيد المستودع</th><th class="n">المقترح</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>{const sn0=NSM[nsKey(l)],ck=sn0?'<span class="gv" title="أُنشئ له طلب '+E(sn0.no)+'">✓</span>':'<input type="checkbox" data-nsk="'+nkOf(l)+'" id="ns'+l.ki+"_"+l.ti+'"'+(NSEL[nkOf(l)]?" checked":"")+' aria-label="تحديد السطر">';return `<tr${foCls(l)}><td class="ck">${ck}</td>${UI.st?"":`<td>${sn(l.ti)}</td>`}${kCells(l.ki)}<td class="n${l.on<=0?" z":""}">${l.on}</td><td class="n">${l.sold}</td><td class="n">${l.wh}</td><td class="n">${l.give?`<span class="gv" style="padding:2px 10px">${l.give}</span>`:`<span class="no" title="رصيد المستودع ذهب لفروع مبيعاتها أعلى">لا يكفي</span>`}</td></tr>`}).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا نواقص بهذه الشروط 👌</div></div>`}`;
}
// ما أُنشئ له طلب تحويل حديثاً: مفتاح (كود، لون، مقاس، من، إلى) ← رقم الطلب
const cd=s=>String(s||"").slice(0,3);
const sentMap=()=>{const m=new Map(),lim=Date.now()-SENT_DAYS*864e5;for(const e of SENT)if(e&&N(e.at)>lim)m.set([e.c,e.cl,e.z,e.f,e.t].join(SEP),e);return m};
const sentKey=l=>{const x=DATA.k[l.ki];return [x[0],x[1],x[2],cd(DATA.st[l.src]),cd(DATA.st[l.dst])].join(SEP)};
const isBr=name=>{const b=X&&X.branches?X.branches():null;return !b||b.indexOf(cd(name))>=0};
let TRL=[];// آخر تحويلات معروضة (غير المُنشأ لها طلب)
/* (v205) ما في الطريق + المخازن التي لا تستقبل تحويلاً: تُحسب مرة لكل تغيّر في طلبات المنصة أو ملف الأرصدة */
let ENVK="",WAY=null,OUTR=new Map();
function envSync(){
 const since=META&&META.q?N(META.q.at):0,R=X&&X.reqs?X.reqs():null;let mx=0,cn=0;if(R)for(const r of R){if(r&&N(r.ts)>since){cn++;if(N(r.ts)>mx)mx=N(r.ts)}}
 const RR=rcvRange(),rl=RR?months(RR.from,RR.to).filter(ym=>DATA.d[ym]).join(","):"";
 const dy=pDays(null),k=since+"|"+cn+"|"+mx+"|"+(R?R.length:-1)+"|"+DATA.st.length+"|"+CFG.wh+"|"+dy+"|"+(RR?RR.from:"")+"|"+rl;if(k===ENVK)return;ENVK=k;
 const nd=new Set();if(X&&X.branches)DATA.st.forEach((nm,ti)=>{if(!isBr(nm))nd.add(ti)});
 const T=R&&since&&cn?transitMap(DATA,R,since,CFG.wh):null;setEnv({tr:T&&T.pcs?T.m:null,nd,days:dy,rcv:RR?rcvMap(DATA,RR.from,RR.to):null});WAY=T&&T.pcs?{n:T.n,pcs:T.pcs}:null;HOMEC=null;
}
const priNote=PL=>PL&&PL.length?'<p class="stk-src" style="margin:0 4px 10px">ترتيب الأكواد في كل فرع: <b data-notr>'+PL.map(x=>"<bdi>"+E(x)+"</bdi>").join(" ← ")+'</b> ثم باقي الأكواد'+(X&&!X.ro?" (يُغيَّر من «القواعد»)":"")+".</p>":"";
const covNote=()=>{const c=covOf(CFG);return c>0?' <span data-notr dir="rtl">الكمية المقترحة تكفي الفرع '+fmt(c)+" يوماً من بيعه للصنف (تتغيّر من «القواعد»)، والمستودع يكمل الحد لكل الفروع أولاً ثم يوزّع الباقي بنسبة الحاجة.</span>":""};
const wayNote=()=>WAY?'<div class="stk-rep">🚚 محسوب معك: <b data-notr>'+fmt(WAY.n)+'</b> طلباً أُنشئ في المنصة بعد رفع ملف الأرصدة (<b data-notr>'+fmt(WAY.pcs)+"</b> قطعة في الطريق). أُضيفت لرصيد الفرع المستلم وطُرحت من المصدر، فلا يُقترح الشيء نفسه مرتين.</div>":"";
const cfB=l=>(l.sure?'<span class="stk-vd s good" title="المُرسِل لم يبع الصنف طول السنة، والمستلم رصيده صفر ويبيعه">مؤكد</span>':'<span class="stk-vd s warn" title="'+(l.fytd>0?"المُرسِل باع الصنف خلال السنة":"المستلم ما زال عنده رصيد")+'">راجعه</span>')+(l.part?' <small class="off">المستودع لا يكفي</small>':"");
/* 📦 (v205) «نفد من المستودع»: لكل كود خلا منه المستودع — أين هو ولا يُباع، ومن يحتاجه، وأمر التحويل بضغطة */
function vOut(){
 const P=period(),T=transfers(DATA,CFG,{vendor:UI.vn,q:UI.q,period:P}),SM=sentMap(),can=!!(X&&X.transfer)&&!X.ro,BY=new Map();
 T.rows.forEach(l=>{if(l.part)return;l.sent=SM.get(sentKey(l))||null;const c=DATA.k[l.ki][0];let a=BY.get(c);if(!a){a=[];BY.set(c,a)}a.push(l)});OUTR=BY;
 const of=UI.of||"t",L0=focL(T.codes.slice().sort((p,r)=>(r.lines>0?1:0)-(p.lines>0?1:0)),c=>c.code,c=>vnOf(c.vi)).filter(c=>c.sold>0||c.lines)/* ما له تحويل ممكن أولاً، ثم الأعلى مبيعاً */,L=L0.filter(c=>of==="t"?c.lines>0:of==="b"?c.unmetPcs>0:true);if(UI.ox&&!L.some(c=>c.code===UI.ox))UI.ox="";
 const pcs=L.reduce((a,c)=>a+c.pcs,0),up=L.reduce((a,c)=>a+c.unmetPcs,0);let sure=0;BY.forEach(a=>a.forEach(l=>{if(l.sure&&!l.sent)sure+=l.n}));
 LASTX={name:"نفد-من-المستودع",head:["الكود","المورد","ألوان ومقاسات نفدت","رصيد الفروع","المبيعات","فروع تبيعه","قطع تُحوَّل بين الفروع","نقص بلا مصدر (شراء)"],rows:()=>L.map(c=>[c.code,vnOf(c.vi),c.skus,c.on,c.sold,c.sell,c.pcs,c.unmetPcs]),prn:{ttl:"أصناف نفدت من المستودع",sub:"ما يُحوَّل بين الفروع وما يحتاج شراء"}};
 /* (v206) قائمة هادئة: سطر لكل كود، والضغط عليه يفتح «من ← إلى» بالأرصدة (المستودع، المُرسِل، المستلم) لكل لون ومقاس */
 const whI=DATA.sti.get(CFG.wh),whOf=ki=>{const a=DATA.q[ki];let w=0;if(a)for(let j=0;j<a.length;j+=4)if(a[j]===whI)w+=a[j+1];return w},whC=code=>(DATA.code.get(code)||[]).reduce((t,ki)=>t+whOf(ki),0);
 const nm=ti=>DATA.st[ti]||"",ordR=(p,r)=>p.dst!==r.dst?(nm(p.dst)<nm(r.dst)?-1:1):p.src!==r.src?(nm(p.src)<nm(r.src)?-1:1):cmpK(DATA.k[p.ki],DATA.k[r.ki]);
 const det=c=>{const R=(BY.get(c.code)||[]).slice().sort(ordR),open=R.filter(l=>!l.sent),okR=open.filter(l=>isBr(nm(l.src))&&isBr(nm(l.dst))),prs=new Set(okR.map(l=>l.src+"|"+l.dst)).size,op=okR.reduce((t,l)=>t+l.n,0),wt=whC(c.code);
  const tl=(v,l,cls)=>'<div class="stk-oxt'+(cls?" "+cls:"")+'"><b data-notr>'+fmt(v)+"</b><span>"+l+"</span></div>";let last=-1;
  const rows=R.map(l=>{const x=DATA.k[l.ki],first=l.dst!==last;last=l.dst;return "<tr"+(l.sent?' class="snt"':"")+(first?' data-g="1"':"")+"><td>"+(first?"<b>"+sn(l.dst)+"</b>":"")+'</td><td class="n'+(l.ton<=0?" z":"")+'">'+fmt(l.ton)+(l.tway?' <small class="off">+'+fmt(l.tway)+" في الطريق</small>":"")+'</td><td class="n">'+fmt(l.tsold)+'</td><td data-notr dir="ltr">'+E(x[1]||"—")+'</td><td class="n" data-notr dir="ltr">'+E(x[2]||"—")+'</td><td class="n'+(whOf(l.ki)<=0?" z":"")+'">'+fmt(whOf(l.ki))+'</td><td class="oxa" aria-hidden="true">←</td><td>'+sn(l.src)+'</td><td class="n">'+fmt(l.fon)+'</td><td class="n">'+fmt(l.fsold)+'</td><td class="n">'+(l.sent?'<span class="no" data-notr dir="ltr" title="أُنشئ طلب التحويل">'+E(l.sent.no)+"</span>":'<span class="gv" style="padding:2px 10px">'+fmt(l.n)+"</span>")+"</td><td>"+cfB(l)+"</td></tr>"}).join("");
  return '<div class="stk-oxd"><div class="stk-oxts">'+tl(wt,"في المستودع من الكود كله",wt<=0?"bad":"")+tl(c.on,"في الفروع")+tl(c.sold,P?"باعته الفروع في الفترة":"باعته الفروع من أول السنة")+tl(c.pcs,"قطعة تُحوَّل بين الفروع","good")+tl(c.unmetPcs,"قطعة لا يغطيها أي فرع (شراء)",c.unmetPcs?"bad":"")+"</div>"
   +(R.length?'<div class="tw"><table class="stk-t stk-oxl"><thead><tr><th>الفرع المحتاج</th><th class="n">رصيده</th><th class="n">باع</th><th>اللون</th><th class="n">المقاس</th><th class="n">المستودع</th><th></th><th>يأخذ من فرع</th><th class="n">رصيده</th><th class="n">باع</th><th class="n">الكمية</th><th>الثقة</th></tr></thead><tbody>'+rows+"</tbody></table></div>":'<p class="off" style="margin:8px 4px">لا تحويل ممكناً الآن: لا فرع عنده فائض منه لا يبيعه، أو أُنشئ طلبه وهو في الطريق.</p>')
   +'<div class="stk-act" style="margin:10px 0 0">'+(can&&prs?'<button class="bt g" type="button" data-sk="mkc" data-c="'+E(c.code)+'">📤 أنشئ '+(prs===1?"أمر التحويل":fmt(prs)+" أوامر تحويل")+" ("+fmt(op)+" قطعة)</button>":"")+'<button class="bt" type="button" data-sk="code" data-c="'+E(c.code)+'">🔍 تحليل الصنف</button>'+(c.unmetPcs?'<button class="bt" type="button" data-sk="obuy" data-c="'+E(c.code)+'">🛒 الشراء المقترح</button>':"")+'<button class="bt" type="button" data-sk="trc" data-c="'+E(c.code)+'">تعديل الكميات في «تحويلات مقترحة»</button></div></div>'};
 const row=c=>{const R=BY.get(c.code)||[],open=R.filter(l=>!l.sent),sp=open.reduce((t,l)=>t+(l.sure?l.n:0),0),rp=open.reduce((t,l)=>t+(l.sure?0:l.n),0),ns=new Set(open.map(l=>l.src)).size,nd=new Set(open.map(l=>l.dst)).size,on=UI.ox===c.code,wt=whC(c.code);
  return '<tr class="oxr'+(on?" oxo":"")+(c.fo?" fo":"")+'" data-sk="oexp" data-c="'+E(c.code)+'" tabindex="0" role="button" aria-expanded="'+(on?"true":"false")+'"><td class="oxc" aria-hidden="true">'+(on?"▾":"◂")+'</td><td class="c" data-notr dir="ltr"><b>'+E(c.code)+'</b></td><td data-notr style="white-space:normal">'+E(vnOf(c.vi)||"—")+'</td><td class="n"><b>'+fmt(c.sold)+'</b></td><td class="n'+(wt<=0?" z":"")+'">'+fmt(wt)+'</td><td class="n">'+fmt(c.on)+"</td><td>"+(open.length?fmt(nd)+" فرع يحتاج · "+fmt(ns)+" فرع يعطي":R.length?'<span class="off">أُنشئ طلبه</span>':'<span class="off">لا فائض في الفروع</span>')+'</td><td class="n">'+(sp?'<span class="stk-vd s good">'+fmt(sp)+"</span>":"")+(rp?' <span class="stk-vd s warn">'+fmt(rp)+"</span>":"")+(!sp&&!rp?"0":"")+'</td><td class="n'+(c.unmetPcs?" z":"")+'">'+fmt(c.unmetPcs)+"</td></tr>"+(on?'<tr class="oxdr"><td colspan="9">'+det(c)+"</td></tr>":"")};
 return focBar()+'<div class="stk-bar"><label>المورد<select data-sf="vn" id="stk-vn">'+opt(vendors(),UI.vn,"كل الموردين")+'</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="'+E(UI.q)+'" placeholder="مثلاً 13016" dir="ltr"></label><label>اعرض<select data-sf="of" id="stk-of"><option value="t"'+(of==="t"?" selected":"")+'>ما له تحويل ممكن</option><option value="b"'+(of==="b"?" selected":"")+'>ما يحتاج شراء</option><option value="a"'+(of==="a"?" selected":"")+">كل ما نفد</option></select></label>"+perSel()+'<span class="sp"></span>'+fclr("vn,q")+'<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>'+gapNote(P)+wayNote()
  +'<div class="stk-sum"><span><b>'+fmt(L.length)+"</b>كود</span><span><b>"+fmt(pcs)+'</b>قطعة تُحوَّل بين الفروع</span><span><b style="color:var(--olive,#6f7d45)">'+fmt(sure)+'</b>منها مؤكدة</span><span><b style="color:#c4362b">'+fmt(up)+"</b>قطعة تحتاج شراء</span></div>"
  +'<p class="off" style="margin:0 4px 10px;font-size:13px">اضغط أي سطر ليفتح: من يحتاج، ومن أي فرع يأخذ، ورصيد المستودع وكل فرع لكل لون ومقاس، ثم أنشئ أمر التحويل. الأخضر «مؤكد» (المُرسِل لم يبع الصنف طول السنة والمستلم رصيده صفر) والأصفر «راجعه».</p>'
  +(L.length?'<div class="stk-pan"><div class="tw"><table class="stk-t stk-ox"><thead><tr><th></th><th>الكود</th><th>المورد</th><th class="n">باع</th><th class="n">المستودع</th><th class="n">الفروع</th><th>التحويل</th><th class="n">قطع التحويل</th><th class="n">يحتاج شراء</th></tr></thead><tbody>'+L.slice(0,UI.olim||40).map(row).join("")+"</tbody></table></div>"+(L.length>(UI.olim||40)?'<button class="bt stk-more" type="button" data-sk="omore">عرض المزيد ('+fmt(L.length-(UI.olim||40))+" كود آخر)</button>":"")+"</div>":em("لا شيء بهذه الشروط 👌"));
}
/* 🗓 (v208) «خطة اليوم»: خطوتان بترتيب الأولوية — (1) نواقص يغطيها المستودع، (2) ما ليس في المستودع يُحوَّل بين الفروع. سطر لكل فرع يُفتح بالضغط. */
let PLN=null;
function vPlan(){
 const P=period(),days=pDays(P)||1,SM=sentMap(),can=!X.ro,since=META&&META.q?N(META.q.at):0;
 PLN=dayPlan(DATA,CFG,{period:P,days,isBranch:ti=>isBr(DATA.st[ti]),skip:l=>SM.has(sentKey(l))});
 const st=UI.ps==="t"?"t":"n",L=st==="t"?PLN.tr:PLN.need,whI=DATA.sti.get(CFG.wh),whOf=ki=>{const a=DATA.q[ki];let w=0;if(a)for(let j=0;j<a.length;j+=4)if(a[j]===whI)w+=a[j+1];return w};
 // ما أُنشئ بعد ملف الأرصدة (من طلبات المنصة)
 const done=new Map();if(X.reqs&&since)for(const r of X.reqs()){if(!r||!(N(r.ts)>since)||(st==="t")!==!!r.fr)continue;let q=0;for(const w of r.rows||[])if(w&&!w.na)q+=Math.round(N(w.q))||0;if(q>0)done.set(String(r.br),(done.get(String(r.br))||0)+q)}
 const lostT=b=>b.lost>=0.95?fmt(b.lost):b.lost>0?"أقل من 1":"0",tot=L.reduce((a,b)=>a+b.pcs,0),zr=L.reduce((a,b)=>a+b.zero,0);
 if(UI.px&&!L.some(b=>String(b.ti)===UI.px))UI.px="";
 const PL=priList(CFG),srtP=R=>R.map((l,i)=>[l,priRank(PL,DATA.k[l.ki][0]),i]).sort((p,q)=>(p[1]-q[1])||(p[2]-q[2])).map(x=>x[0]);
 const detN=b=>{const R=srtP(b.lines),sh=R.slice(0,80);
  return '<div class="stk-oxd"><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">باع</th><th class="n">في المستودع</th><th class="n">يُرسل له</th></tr></thead><tbody>'+sh.map(l=>"<tr>"+kCells(l.ki)+'<td class="n'+(l.on<=0?" z":"")+'">'+fmt(l.on)+(l.way?' <small class="off">+'+fmt(l.way)+" في الطريق</small>":"")+'</td><td class="n">'+fmt(l.sold)+'</td><td class="n">'+fmt(l.wh)+'</td><td class="n"><span class="gv" style="padding:2px 10px">'+fmt(l.give)+"</span></td></tr>").join("")+"</tbody></table></div>"+(R.length>80?'<p class="stk-src" style="margin:6px 4px 0">معروض أول 80 من '+fmt(R.length)+" صنفاً (الأهم أولاً). الطلب والطباعة يشملان الكل.</p>":"")
   +'<div class="stk-act" style="margin:10px 0 0">'+(can&&X.dispatch?'<button class="bt g" type="button" data-sk="pgo" data-v="'+b.ti+'">📤 أنشئ طلب الفرع ('+fmt(Math.min(400,b.n))+" صنف · "+fmt(R.slice(0,400).reduce((a,l)=>a+l.give,0))+" قطعة)</button>":"")+'<button class="bt" type="button" data-sk="prn">🖨 اطبع ورقة الفرع</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button><button class="bt" type="button" data-sk="pneed" data-v="'+E(DATA.st[b.ti])+'">اختر أصنافاً أو عدّل الكميات</button></div></div>'};
 const detT=b=>{const R=b.lines,sh=R.slice(0,80),ok=R.filter(l=>isBr(DATA.st[l.src])),prs=new Set(ok.map(l=>l.src)).size;let last=-1;
  return '<div class="stk-oxd"><div class="tw"><table class="stk-t stk-oxl"><thead><tr><th>يأخذ من فرع</th><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد المُرسِل</th><th class="n">باع المُرسِل</th><th class="n">رصيد هذا الفرع</th><th class="n">باع</th><th class="n">الكمية</th><th>الثقة</th></tr></thead><tbody>'+sh.map(l=>{const first=l.src!==last;last=l.src;return "<tr"+(first?' data-g="1"':"")+"><td>"+(first?"<b>"+sn(l.src)+"</b>":"")+"</td>"+kCells(l.ki)+'<td class="n">'+fmt(l.fon)+'</td><td class="n">'+fmt(l.fsold)+'</td><td class="n'+(l.ton<=0?" z":"")+'">'+fmt(l.ton)+'</td><td class="n">'+fmt(l.tsold)+'</td><td class="n"><span class="gv" style="padding:2px 10px">'+fmt(l.n)+"</span></td><td>"+cfB(l)+"</td></tr>"}).join("")+"</tbody></table></div>"+(R.length>80?'<p class="stk-src" style="margin:6px 4px 0">معروض أول 80 من '+fmt(R.length)+" سطراً. الأوامر والطباعة تشمل الكل.</p>":"")
   +'<div class="stk-act" style="margin:10px 0 0">'+(can&&X.transfer&&prs?'<button class="bt g" type="button" data-sk="pdst" data-v="'+b.ti+'">📤 أنشئ '+(prs===1?"أمر التحويل":fmt(prs)+" أوامر تحويل")+" لهذا الفرع ("+fmt(b.pcs)+" قطعة)</button>":"")+'<button class="bt" type="button" data-sk="prn">🖨 اطبع ورقة الفرع</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button><button class="bt" type="button" data-sk="ptr" data-v="'+E(DATA.st[b.ti])+'">عدّل الكميات في «تحويلات مقترحة»</button></div></div>'};
 const row=(b,i)=>{const on=UI.px===String(b.ti);return '<tr class="oxr'+(on?" oxo":"")+'" data-sk="pexp" data-v="'+b.ti+'" tabindex="0" role="button" aria-expanded="'+(on?"true":"false")+'"><td class="oxc" aria-hidden="true">'+(on?"▾":"◂")+'</td><td class="n" data-notr>'+(i+1)+"</td><td><b>"+sn(b.ti)+'</b></td><td class="n'+(b.zero?" z":"")+'"><b>'+fmt(b.zero)+'</b></td><td class="n">'+lostT(b)+'</td><td class="n">'+fmt(b.n)+'</td><td class="n"><b>'+fmt(b.pcs)+"</b></td>"+(st==="t"?'<td class="n">'+fmt(b.srcs)+'</td><td class="n">'+(b.sure?'<span class="stk-vd s good">'+fmt(b.sure)+"</span>":"0")+"</td>":"")+"</tr>"+(on?'<tr class="oxdr"><td colspan="'+(st==="t"?9:7)+'">'+(st==="t"?detT(b):detN(b))+"</td></tr>":"")};
 const O=UI.px?L.find(b=>String(b.ti)===UI.px):null;
 if(O&&st==="n")LASTX={name:"نواقص-"+cd(DATA.st[O.ti]),head:["الكود","اللون","المقاس","رصيد الفرع","باع","في المستودع","يُرسل له"],rows:()=>srtP(O.lines).map(l=>{const x=DATA.k[l.ki];return [x[0],x[1],x[2],l.on,l.sold,l.wh,l.give]}),prn:{ttl:"نواقص فرع "+DATA.st[O.ti],sub:fmt(O.n)+" صنف · "+fmt(O.pcs)+" قطعة من المستودع",ask:1}};
 else if(O)LASTX={name:"تحويلات-إلى-"+cd(DATA.st[O.ti]),head:["يأخذ من فرع","الكود","اللون","المقاس","رصيد المُرسِل","باع المُرسِل","رصيد الفرع","باع","الكمية","الثقة"],rows:()=>O.lines.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.src],x[0],x[1],x[2],l.fon,l.fsold,l.ton,l.tsold,l.n,l.sure?"مؤكد":"راجعه"]}),prn:{ttl:"تحويلات إلى فرع "+DATA.st[O.ti],sub:fmt(O.pcs)+" قطعة من "+fmt(O.srcs)+" فرع",ask:1}};
 else LASTX={name:st==="t"?"خطة-التحويلات":"خطة-النواقص",head:["الترتيب","الفرع","نفد عنده ويبيعه","يخسر يومياً (قطعة تقريباً)","أصناف","قطع"].concat(st==="t"?["من كم فرع","مؤكد"]:[]),rows:()=>L.map((b,i)=>[i+1,DATA.st[b.ti],b.zero,Math.round(b.lost*10)/10,b.n,b.pcs].concat(st==="t"?[b.srcs,b.sure]:[])),prn:{ttl:st==="t"?"خطة اليوم: تحويلات بين الفروع":"خطة اليوم: نواقص من المستودع"}};
 const dn=[...done.entries()].map(e=>{const ti=DATA.st.findIndex(x=>cd(x)===e[0]);return (ti>=0?sn(ti):E(e[0]))+' <b data-notr>('+fmt(e[1])+")</b>"});
 return '<div class="stk-seg stk-pls" role="tablist"><button type="button" data-sk="ps" data-v="n" class="'+(st==="n"?"on":"")+'"><b>1</b> نواقص يغطيها المستودع <small data-notr>'+fmt(PLN.need.length)+' فرع</small></button><button type="button" data-sk="ps" data-v="t" class="'+(st==="t"?"on":"")+'"><b>2</b> ليس في المستودع: تحويل بين الفروع <small data-notr>'+fmt(PLN.tr.length)+" فرع</small></button></div>"
  +'<div class="stk-bar">'+perSel()+'<span class="sp"></span><button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>'+gapNote(P)+wayNote()
  +'<div class="stk-sum"><span><b>'+fmt(L.length)+"</b>فرع</span><span><b style=\"color:#c4362b\">"+fmt(zr)+"</b>صنف نفد عند فرع وهو يبيعه</span><span><b>"+fmt(tot)+"</b>"+(st==="t"?"قطعة تُحوَّل بين الفروع":"قطعة تُرسل من المستودع")+"</span></div>"+(st==="n"?priNote(PL):"")
  +'<p class="off" style="margin:0 4px 10px;font-size:13px">'+(st==="n"?"ابدأ من أول سطر: الفرع الذي يخسر مبيعات أكثر أولاً (أصناف رصيده منها صفر وهي تُباع عنده). اضغط الفرع لترى أصنافه ثم أنشئ طلبه. بعد أن تنتهي انتقل للخطوة 2."+covNote():"أصناف خلا منها المستودع أو لا يكفي: لكل فرع محتاج، من أي فروع يأخذها (فروع عندها الصنف ولا تبيعه). اضغط الفرع لترى التفاصيل ثم أنشئ أوامر تحويله.")+"</p>"
  +(L.length?'<div class="stk-pan"><div class="tw"><table class="stk-t stk-ox"><thead><tr><th></th><th class="n">#</th><th>الفرع</th><th class="n">نفد عنده ويبيعه</th><th class="n">يخسر يومياً (قطعة تقريباً)</th><th class="n">أصناف</th><th class="n">'+(st==="t"?"قطع تُحوَّل له":"قطع من المستودع")+"</th>"+(st==="t"?'<th class="n">من كم فرع</th><th class="n">مؤكد</th>':"")+"</tr></thead><tbody>"+L.map(row).join("")+"</tbody></table></div></div>":em(st==="n"?"لا نواقص يغطيها المستودع الآن 👌":"لا تحويلات ممكنة الآن 👌"))
  +(dn.length?'<p class="stk-src" style="margin:10px 4px 0">✅ أُنشئت طلباتها بعد ملف الأرصدة: '+dn.join("، ")+".</p>":"");
}
// طلب واحد من المستودع بكل نواقص الفرع المقترحة (حتى 400 سطر)
async function planSend(ti){
 if(BUSY||!X||!X.dispatch||X.ro||!PLN)return;const b=PLN.need.find(x=>x.ti===ti);if(!b)return;const R=b.lines.slice(0,400),nm=DATA.st[ti],pcs=R.reduce((a,l)=>a+l.give,0);
 if(!confirm("إنشاء طلب من المستودع لفرع "+nm+"؟\n\n"+R.length+" صنف · "+pcs+" قطعة"+(b.lines.length>400?"\n(أول 400 سطر، والباقي بطلب آخر بعده)":"")+"\n\nسيصل الفرع إشعار، ويظهر الطلب في «الطلبات» كطلب من المستودع."))return;
 BUSY="جاري إنشاء طلب الفرع…";paint();let r=null;
 try{r=await X.dispatch({to:cd(nm),rows:R.map(l=>{const x=DATA.k[l.ki];return {k:x[0],c:x[1],z:x[2],q:l.give,n:""}}),rid:rid20(),gn:"نواقص مقترحة من تحليل المخزون: رصيد الفرع أقل من الحد."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
 if(r&&r.ok){const NS=nsLoad(),at=Date.now();R.forEach(l=>{NS[nsKey(l)]={no:String(r.no||"").slice(0,40),at}});try{localStorage.setItem("stk_nsent",JSON.stringify(NS))}catch(e){}}
 BUSY="";ENVK="";UI.px="";paint();if(X.toast)X.toast(r&&r.ok?"✅ أُنشئ طلب "+String(r.no||"")+" لفرع "+nm+" ووصله إشعار":"تعذّر إنشاء الطلب: "+String(r&&r.err||""));
}
// أوامر التحويل لفرع محتاج: أمر لكل فرع يأخذ منه
async function mkDst(ti){
 if(BUSY||!X||!X.transfer||X.ro||!PLN)return;const b=PLN.tr.find(x=>x.ti===ti);if(!b)return;const R=b.lines.filter(l=>isBr(DATA.st[l.src])),dN=DATA.st[ti];if(!R.length)return;
 const pm=new Map();R.forEach(l=>{let a=pm.get(l.src);if(!a){a=[];pm.set(l.src,a)}if(a.length<400)a.push(l)});const pairs=[...pm.values()],pcs=pairs.reduce((a,L)=>a+L.reduce((t,l)=>t+l.n,0),0),rv=R.reduce((a,l)=>a+(l.sure?0:l.n),0);
 if(!confirm("إنشاء "+pairs.length+" أمر تحويل إلى فرع "+dN+"؟\n\n"+pcs+" قطعة"+(rv?"\nمنها "+rv+" قطعة بعلامة «راجعه»":"\nكلها بعلامة «مؤكد»")+"\n\nأمر لكل فرع يُؤخذ منه، ويصل الفرعين إشعار ويظهر في «الطلبات»."))return;
 let ok=0,fail="",add=[];const at=Date.now(),lim=at-SENT_DAYS*864e5;
 for(let i=0;i<pairs.length;i++){const L=pairs[i],fN=DATA.st[L[0].src];BUSY="جاري إنشاء أوامر التحويل… "+(i+1)+" من "+pairs.length;paint();let r=null;
  try{r=await X.transfer({fr:cd(fN),to:cd(dN),rows:L.map(l=>{const x=DATA.k[l.ki];return {k:x[0],c:x[1],z:x[2],q:l.n}}),gn:"تحويل من تحليل المخزون: الصنف ليس في المستودع، والفرع المُرسِل لا يبيعه."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
  if(r&&r.ok){ok++;add=add.concat(L.map(l=>{const x=DATA.k[l.ki];return {c:x[0],cl:x[1],z:x[2],f:cd(fN),t:cd(dN),n:l.n,at,no:String(r.no||"").slice(0,40)}}))}else{fail=String(r&&r.err||"تعذّر الإنشاء");break}}
 if(add.length){SENT=SENT.filter(e=>e&&N(e.at)>lim).concat(add).slice(-3000);try{const fb=await FB();await fb.setDoc(fb.doc(X.db,"stk","sent"),{l:SENT,at,by:by().e})}catch(e){if(X.toast)X.toast("أُنشئت الأوامر، لكن تعذّر حفظ علامتها: لا تنشئها مرة أخرى")}}
 BUSY="";ENVK="";UI.px="";paint();if(X.toast)X.toast(fail?(ok?"أُنشئ "+ok+" من "+pairs.length+"، ثم توقّف: "+fail:"تعذّر إنشاء أمر التحويل: "+fail):"✅ أُنشئ "+ok+" أمر تحويل إلى فرع "+dN+" ووصل الفروع إشعار");
}
// ينشئ طلبات التحويل لكود واحد (طلب لكل فرعين) ثم يعلّم سطوره حتى لا تتكرر
async function mkCode(code){
 if(BUSY||!X||!X.transfer||X.ro)return;const R=(OUTR.get(code)||[]).filter(l=>!l.sent&&isBr(DATA.st[l.src])&&isBr(DATA.st[l.dst]));if(!R.length)return;
 const pm=new Map();R.forEach(l=>{const k=l.src+"|"+l.dst;let a=pm.get(k);if(!a){a=[];pm.set(k,a)}a.push(l)});const pairs=[...pm.values()],pcs=R.reduce((a,l)=>a+l.n,0),rv=R.reduce((a,l)=>a+(l.sure?0:l.n),0);
 if(!confirm("إنشاء "+pairs.length+" طلب تحويل للكود "+code+"؟\n\n"+pcs+" قطعة"+(rv?"\nمنها "+rv+" قطعة بعلامة «راجعه»":"\nكلها بعلامة «مؤكد»")+"\n\nطلب لكل فرعين، ويصلهما إشعار ويظهر في «الطلبات»."))return;
 BUSY="جاري إنشاء طلبات التحويل…";paint();let ok=0,fail="",add=[];const at=Date.now(),lim=at-SENT_DAYS*864e5;
 for(const L of pairs){const fN=DATA.st[L[0].src],dN=DATA.st[L[0].dst];let r=null;
  try{r=await X.transfer({fr:cd(fN),to:cd(dN),rows:L.map(l=>{const x=DATA.k[l.ki];return {k:x[0],c:x[1],z:x[2],q:l.n}}),gn:"تحويل من تحليل المخزون: الصنف نفد من المستودع، والفرع المُرسِل لا يبيعه."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
  if(r&&r.ok){ok++;add=add.concat(L.map(l=>{const x=DATA.k[l.ki];return {c:x[0],cl:x[1],z:x[2],f:cd(fN),t:cd(dN),n:l.n,at,no:String(r.no||"").slice(0,40)}}))}else{fail=String(r&&r.err||"تعذّر الإنشاء");break}}
 if(add.length){SENT=SENT.filter(e=>e&&N(e.at)>lim).concat(add).slice(-3000);try{const fb=await FB();await fb.setDoc(fb.doc(X.db,"stk","sent"),{l:SENT,at,by:by().e})}catch(e){if(X.toast)X.toast("أُنشئت الطلبات، لكن تعذّر حفظ علامتها: لا تنشئها مرة أخرى")}}
 BUSY="";ENVK="";paint();if(X.toast)X.toast(fail?(ok?"أُنشئ "+ok+" من "+pairs.length+"، ثم توقّف: "+fail:"تعذّر إنشاء طلب التحويل: "+fail):"✅ أُنشئ "+ok+" طلب تحويل للكود "+code+" ووصل الفروع إشعار");
}
/* (v186) التحويلات: عرضان — «حسب الفروع» (كما كان) و«حسب الكود» (سطر لكل كود خلا منه المستودع وهو في الفروع) */
const pDays=P=>{const x=P||spanR();return x?Math.round((new Date(x.to+"T12:00:00")-new Date(x.from+"T12:00:00"))/864e5)+1:0};
const vnOf=vi=>vi>=0&&DATA.vn[vi]?DATA.vn[vi]:"";
function vTr(){
 const seg=`<div class="stk-seg" role="tablist"><button type="button" data-sk="trv" data-v="pair" class="${UI.trv!=="code"?"on":""}">حسب الفروع (من ← إلى)</button><button type="button" data-sk="trv" data-v="code" class="${UI.trv==="code"?"on":""}">حسب الكود</button></div>`;
 return seg+(UI.trv==="code"?vTrCodes():vTrPairs());
}
function vTrCodes(){
 const P=period(),T=transfers(DATA,CFG,{vendor:UI.vn,q:UI.q,period:P}),L=focL(T.codes,c=>c.code,c=>vnOf(c.vi)),up=L.reduce((s,c)=>s+c.unmetPcs,0),pcs=L.reduce((s,c)=>s+c.pcs,0);
 LASTX={name:"غير-متاح-بالمستودع-بالكود",head:["الكود","المورد","ألوان ومقاسات خلا منها المستودع","رصيد الفروع","المبيعات","فروع تبيعه","تحويلات ممكنة","قطع التحويل","نقص بلا فرع يُسحب منه (قطعة)"],rows:()=>L.map(c=>[c.code,vnOf(c.vi),c.skus,c.on,c.sold,c.sell,c.lines,c.pcs,c.unmetPcs])};
 return focBar()+`<div class="stk-bar"><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" placeholder="مثلاً 13016" dir="ltr"></label>${perSel()}<span class="sp"></span>${fclr("vn,q")}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>كود خلا المستودع من ألوان أو مقاسات منه وهي في الفروع</span><span><b>${fmt(pcs)}</b>قطعة يمكن تحويلها بين الفروع</span><span><b style="color:#c4362b">${fmt(up)}</b>قطعة ناقصة بلا فرع يُسحب منه (تحتاج شراء)</span></div>
 <p class="off" style="margin:0 4px 10px;font-size:13px">سطر لكل كود، الأعلى مبيعاً أولاً. «تحويلات ممكنة» تُحل بين الفروع، و«نقص بلا مصدر» لا يحله إلا الشراء. اضغط «التحويلات» لترى سطور الكود، أو الكود نفسه لتحليله.</p>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>المورد</th><th class="n">ألوان ومقاسات</th><th class="n">رصيد الفروع</th><th class="n">المبيعات</th><th class="n">فروع تبيعه</th><th class="n">تحويلات ممكنة</th><th class="n">نقص بلا مصدر</th><th></th></tr></thead><tbody>${L.slice(0,UI.lim).map(c=>`<tr${foCls(c)}><td class="c" data-notr><a href="#" data-sk="code" data-c="${E(c.code)}" style="color:inherit">${E(c.code)}</a></td><td data-notr style="white-space:normal">${E(vnOf(c.vi)||"—")}</td><td class="n">${fmt(c.skus)}</td><td class="n">${fmt(c.on)}</td><td class="n"><b>${fmt(c.sold)}</b></td><td class="n">${fmt(c.sell)}</td><td class="n">${c.lines?`<span class="gv" style="padding:2px 10px">${fmt(c.pcs)}</span>`:"0"}</td><td class="n${c.unmetPcs?" z":""}">${fmt(c.unmetPcs)}</td><td>${c.lines?`<button class="bt s" type="button" data-sk="trc" data-c="${E(c.code)}">التحويلات</button>`:""}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:em("لا شيء بهذه الشروط 👌")}`;
}
function vTrPairs(){
 const P=period(),T=transfers(DATA,CFG,{from:UI.fr,to:UI.tt,vendor:UI.vn,q:UI.q,period:P}),SM=sentMap(),L1=T.rows.filter(l=>!UI.cf||(UI.cf==="s"?l.sure:!l.sure));
 L1.forEach(l=>{l.sent=SM.get(sentKey(l))||null});
 L1.sort((a,b)=>a.src!==b.src?(DATA.st[a.src]<DATA.st[b.src]?-1:1):a.dst!==b.dst?(DATA.st[a.dst]<DATA.st[b.dst]?-1:1):cmpK(DATA.k[a.ki],DATA.k[b.ki]));
 const L=focL(L1,l=>DATA.k[l.ki][0],l=>vnOf(DATA.k[l.ki][3]));// «هذه فقط» تقصر الأزواج وطلبات التحويل على أصناف القائمة
 TRL=L.filter(l=>!l.sent);const nSent=L.length-TRL.length;
 // الأزواج (من ← إلى) الأكبر أولاً: لكل زوج طلب تحويل واحد
 const pm=new Map();for(const l of TRL){const k=l.src+"|"+l.dst;let e=pm.get(k);if(!e){e={src:l.src,dst:l.dst,n:0,pcs:0};pm.set(k,e)}e.n++;e.pcs+=l.n}
 const pairs=[...pm.values()].sort((a,b)=>b.pcs-a.pcs),can=!!(X&&X.transfer);
 LASTX={name:"تحويلات-مقترحة",head:["من فرع","إلى فرع","الكود","اللون","المقاس","المورد","الكمية","رصيد المُرسِل","مبيعات المُرسِل","رصيد المستلم","مبيعات المستلم","طلب التحويل","الثقة"],rows:()=>{const S=tSel();return (S.length?S:L).map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.src],DATA.st[l.dst],x[0],x[1],x[2],x[3]>=0?DATA.vn[x[3]]:"",l.n,l.fon,l.fsold,l.ton,l.tsold,l.sent?l.sent.no:"",l.sure?"مؤكد":"راجعه"]})},prn:{ttl:"تحويلات مقترحة بين الفروع",sub:[UI.fr?"من: "+UI.fr:"",UI.tt?"إلى: "+UI.tt:""].filter(Boolean).join("  ←  "),ask:1}};
 TLIST=L;const TSEL=selOf("tsel");
 const mkBtn=p=>{const ok=isBr(DATA.st[p.src])&&isBr(DATA.st[p.dst]);return ok?`<button class="bt g s" type="button" data-sk="mk" data-f="${E(DATA.st[p.src])}" data-d="${E(DATA.st[p.dst])}">📤 أنشئ طلب التحويل</button>`:`<small class="off">أحدهما ليس فرعاً في المنصة</small>`};
 // (v188) مراجعة طلب التحويل قبل إنشائه: كل سطر كميته تُعدَّل (صفر = لا يُرسل)، ولا تزيد على رصيد المُرسِل
 let rev="";if(UI.trx&&can){const fi=DATA.sti.get(UI.trx.f),di=DATA.sti.get(UI.trx.d),RL=tPick(TRL.filter(l=>l.src===fi&&l.dst===di)),R4=RL.slice(0,400),Q=UI.trx.q||{};
  if(!R4.length)UI.trx=null;else{let n=0,pcs=0;const qv=l=>Q[l.ki]!==undefined?N(Q[l.ki]):l.n;R4.forEach(l=>{const q=qv(l);if(q>0){n++;pcs+=q}});
   rev=`<div class="stk-card" style="margin:0 0 12px;border:1.5px solid var(--acc)"><h3>📤 مراجعة طلب التحويل: ${sn(fi)} <span aria-hidden="true">←</span> ${sn(di)}</h3><p>عدّل كمية أي سطر قبل الإنشاء (صفر = لا يُرسل). الكمية لا تزيد على رصيد الفرع المُرسِل.${RL.length>400?" أول 400 سطر فقط، والباقي بطلب آخر.":""}</p>
   <div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد المُرسِل</th><th class="n">مبيعاته</th><th class="n">رصيد المستلم</th><th class="n">مبيعاته</th><th class="n">المقترح</th><th class="n">الكمية</th></tr></thead><tbody>${R4.map(l=>{const q=qv(l);return `<tr${q>0?"":' class="snt"'}>${kCells(l.ki)}<td class="n">${l.fon}</td><td class="n">${l.fsold}</td><td class="n${l.ton<=0?" z":""}">${l.ton}</td><td class="n">${l.tsold}</td><td class="n">${N(l.n)}</td><td class="n"><input type="number" class="stk-tq" min="0" max="${Math.max(0,N(l.fon))}" step="1" data-tq="${l.ki}" id="tq${l.ki}" value="${q}" aria-label="الكمية"></td></tr>`}).join("")}</tbody></table></div>
   <div class="stk-act" style="margin:12px 0 0"><button class="bt p" type="button" data-sk="mkgo"${n?"":" disabled"}>📤 أنشئ طلب التحويل (${fmt(n)} صنف · ${fmt(pcs)} قطعة)</button><button class="bt" type="button" data-sk="mkx">إلغاء</button></div></div>`}}
 return focBar()+`<div class="stk-bar"><label>من فرع<select data-sf="fr" id="stk-fr">${opt(stores(1),UI.fr,"الكل")}</select></label><label>إلى فرع<select data-sf="tt" id="stk-tt">${opt(stores(1),UI.tt,"الكل")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" dir="ltr"></label><label>الثقة<select data-sf="cf" id="stk-cf"><option value="">الكل</option><option value="s"${UI.cf==="s"?" selected":""}>المؤكد فقط</option><option value="r"${UI.cf==="r"?" selected":""}>ما يحتاج مراجعة</option></select></label>${perSel()}<span class="sp"></span>${fclr("fr,tt,vn,q,cf")}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(T.skus)}</b>صنف غير متاح بالمستودع ومتاح في فروع</span><span><b>${fmt(TRL.length)}</b>تحويل مقترح</span><span><b>${fmt(TRL.reduce((s,l)=>s+l.n,0))}</b>قطعة</span><span><b>${fmt(T.unmet)}</b>طلب بلا فرع يُسحب منه</span>${nSent?`<span><b>${fmt(nSent)}</b>أُنشئ لها طلب تحويل</span>`:""}</div>
 <p class="off" style="margin:0 4px 10px;font-size:13px">القاعدة: نسحب من فرع مبيعاته من الصنف ${N(CFG.slow)?"لا تزيد على "+N(CFG.slow):"صفر"} في الفترة ويبقى عنده ${N(CFG.keep)} على الأقل، ونرسل لفرع رصيده أقل من الحد ويبيع الصنف (الأعلى مبيعاً أولاً). تتغيّر من تبويب «القواعد». ويشمل ما عند المستودع منه ولا يكفي كل الفروع (${fmt(T.part.pcs)} قطعة). «مؤكد» = المُرسِل لم يبع الصنف طول السنة والمستلم رصيده صفر. المخازن التي ليست فروعاً في المنصة لا يُحوَّل إليها.</p>${wayNote()}
 ${rev?rev:can&&pairs.length?`<div class="stk-pan stk-prs"><h3>📤 حوّلها إلى طلبات تحويل</h3><p class="off">كل زر ينشئ طلب «تحويل بين الفروع» واحداً بأصناف هذا الزوج (حتى 400 سطر)، ويصل الفرعين إشعار ويظهر في «الطلبات». ما أُنشئ له طلب يبقى معلَّماً ${SENT_DAYS} يوماً فلا يتكرر.</p>${pairs.slice(0,UI.prs||8).map(p=>`<div class="stk-pr"><span>${sn(p.src)} <i aria-hidden="true">←</i> ${sn(p.dst)}</span><b>${fmt(p.n)} صنف · ${fmt(p.pcs)} قطعة</b><button class="bt s" type="button" data-sk="prv" data-f="${E(DATA.st[p.src])}" data-d="${E(DATA.st[p.dst])}">عرض الأصناف</button>${mkBtn(p)}</div>`).join("")}${pairs.length>(UI.prs||8)?`<button class="bt s stk-more" type="button" data-sk="prsmore">عرض المزيد (${fmt(pairs.length-(UI.prs||8))} زوج آخر)</button>`:""}</div>`:""}
 ${rev?"":tSelBar()}${rev?"":L.length?`<div class="stk-pan" style="margin-top:12px"><div class="tw"><table class="stk-t"><thead><tr><th class="ck"><input type="checkbox" id="stk-tsall" aria-label="تحديد كل المعروض" title="تحديد كل المعروض"></th><th>من فرع</th><th>إلى فرع</th><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">الكمية</th><th>الثقة</th><th class="n">رصيد المُرسِل</th><th class="n">مبيعاته</th><th class="n">رصيد المستلم</th><th class="n">مبيعاته</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr${l.sent?' class="snt"':""}><td class="ck">${l.sent?"":'<input type="checkbox" data-tsk="'+tkOf(l)+'" id="ts'+l.ki+"_"+l.src+"_"+l.dst+'"'+(TSEL[tkOf(l)]?" checked":"")+' aria-label="تحديد السطر">'}</td><td>${sn(l.src)}</td><td>${sn(l.dst)}</td>${kCells(l.ki)}<td class="n">${l.sent?`<span class="no" title="أُنشئ طلب التحويل" data-notr dir="ltr">${E(l.sent.no)}</span>`:`<span class="gv" style="padding:2px 10px">${N(l.n)}</span>`}</td><td>${cfB(l)}</td><td class="n">${l.fon}</td><td class="n">${l.fsold}</td><td class="n${l.ton<=0?" z":""}">${l.ton}</td><td class="n">${l.tsold}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا تحويلات مقترحة بهذه الشروط.</div></div>`}`;
}
// ينشئ طلب تحويل حقيقي بأصناف زوج (من ← إلى) المعروضة، ثم يعلّمها حتى لا تتكرر
async function mkTransfer(fName,dName,Q){
 // Q = الكميات المعدَّلة في المراجعة {صنف: كمية} (صفر = لا يُرسل، ولا تزيد على رصيد المُرسِل)
 if(BUSY||!X||!X.transfer)return;Q=Q||{};const fi=DATA.sti.get(fName),di=DATA.sti.get(dName),all=tPick(TRL.filter(l=>l.src===fi&&l.dst===di)),L=all.slice(0,400).map(l=>Object.assign({},l,{n:Q[l.ki]!==undefined?Math.max(0,Math.min(Math.max(0,N(l.fon)),Math.round(N(Q[l.ki])))):l.n})).filter(l=>l.n>0);if(!L.length)return;
 const pcs=L.reduce((s,l)=>s+l.n,0),more=all.length-Math.min(400,all.length);
 if(!confirm("إنشاء طلب تحويل من "+fName+" إلى "+dName+"؟\n\n"+L.length+" صنف · "+pcs+" قطعة"+(more>0?"\n(أول 400 سطر، والباقي "+more+" يُنشأ بطلب آخر)":"")+"\n\nسيصل الفرعين إشعار، ويظهر الطلب في «الطلبات»."))return;
 BUSY="جاري إنشاء طلب التحويل…";paint();let r=null;
 try{r=await X.transfer({fr:cd(fName),to:cd(dName),rows:L.map(l=>{const x=DATA.k[l.ki];return {k:x[0],c:x[1],z:x[2],q:l.n}}),gn:"تحويل مقترح من تحليل المخزون: الصنف غير متاح بالمستودع، والفرع المُرسِل لا يبيعه في الفترة."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
 if(r&&r.ok){const TS0=selOf("tsel");L.forEach(l=>{delete TS0[tkOf(l)]});const at=Date.now(),lim=at-SENT_DAYS*864e5;SENT=SENT.filter(e=>e&&N(e.at)>lim).concat(L.map(l=>{const x=DATA.k[l.ki];return {c:x[0],cl:x[1],z:x[2],f:cd(fName),t:cd(dName),n:l.n,at,no:String(r.no||"").slice(0,40)}})).slice(-3000);
  try{const fb=await FB();await fb.setDoc(fb.doc(X.db,"stk","sent"),{l:SENT,at,by:by().e})}catch(e){if(X.toast)X.toast("أُنشئ الطلب، لكن تعذّر حفظ علامته: لا تنشئه مرة أخرى")}
  BUSY="";UI.trx=null;UI.fr="";UI.tt="";paint();if(X.toast)X.toast("✅ أُنشئ طلب التحويل "+String(r.no||"")+" ووصل الفرعين إشعار")}
 else{BUSY="";paint();if(X.toast)X.toast("تعذّر إنشاء الطلب: "+String(r&&r.err||"").slice(0,90))}
}
/* (v181) «تحليل صنف» v2: ملخّص + ملاحظات + منحنى المقاسات والألوان + جدول محوري (الصفوف/الأعمدة/القيمة يختارها المستخدم) */
/* (v187) 🚚 توزيع حاوية على الفروع: الأصناف + القواعد (على هذا الجهاز localStorage.stk_dist) + جدول يُعدَّل باليد */
const DDEF={on:25,wh:10,cs:1,cmin:1,cmax:"",ps:1,pmin:0,pmax:"",mode:"smart",lv:{}};
const DLV=[[0,"مستبعد"],[0.5,"½"],[1,"عادي"],[1.5,"1½"],[2,"ضعف"],[3,"3 أضعاف"]];
let DS=null;const DMAX=600;// (v198) بيان بالعرض = خانة لكل مقاس، فالحد 600 سطر بدل 200
const dBlank=()=>({c:"",cl:"",z:"",ct:"",pk:"",md:"c",ref:""});
function dLoad(){if(DS)return DS;let o=null;try{o=JSON.parse(localStorage.getItem("stk_dist")||"null")}catch(e){o=null}
 DS={lines:o&&Array.isArray(o.lines)?o.lines.slice(0,DMAX).map(l=>Object.assign(dBlank(),l&&typeof l==="object"?l:{})):[],ov:o&&o.ov&&typeof o.ov==="object"?o.ov:{},rules:Object.assign({},DDEF,o&&o.rules&&typeof o.rules==="object"?o.rules:{})};
 DS.sent=o&&o.sent&&typeof o.sent==="object"?o.sent:{};DS.ctn=o&&o.ctn&&typeof o.ctn==="object"?o.ctn:{};
 if(!DS.rules.lv||typeof DS.rules.lv!=="object")DS.rules.lv={};while(DS.lines.length<3)DS.lines.push(dBlank());return DS}
// (v188) التوزيع ← طلبات حقيقية للفروع. طلب كل فرع = أصنافه بالحبة (سطر الكرتون: كراتينه × حبات الكرتون، وملاحظته «كم كرتوناً»).
const rid20=()=>{const A="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",u=crypto.getRandomValues(new Uint8Array(20));let s="";for(let i=0;i<20;i++)s+=A[u[i]%A.length];return s};
const hsh=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h)};
export function distOrders(live,cols){
 const o=[];for(const c of cols){const rows=[];let pcs=0;for(const x of live){const v=N(x.r.vals[c.c]);if(!(v>0))continue;
   // (v265) مجموعة كرتون: سطر لكل مقاس = الكراتين × حبات المقاس في الكرتون
   if(x.r.sizes){for(const s of x.r.sizes){const q=Math.round(v*s.a);if(q>0){rows.push({k:String(x.l.c).trim().slice(0,40),c:String(x.l.cl||"").slice(0,40),z:String(s.z||"").slice(0,20),q,n:fq(v)+" كرتون"});pcs+=q}}continue}
   const q=Math.round(v*x.r.pc);if(q<=0)continue;
   rows.push({k:String(x.l.c).trim().slice(0,40),c:String(x.l.cl||"").slice(0,40),z:String(x.l.z||"").slice(0,20),q,n:x.r.md==="c"?fq(v)+" كرتون":""});pcs+=q}
  if(rows.length)o.push({c:c.c,nm:c.nm,rows,pcs,h:hsh(rows.map(r=>[r.k,r.c,r.z,r.q].join("~")).join("|"))})}
 return o;
}
let DORD=[];// طلبات الفروع من التوزيع المعروض الآن
async function dSend(){
 if(BUSY||!X||!X.dispatch)return;const S=dLoad(),sel=UI.dsel||{},L=DORD.filter(o=>{const s=S.sent[o.c],same=s&&s.h===o.h;return sel[o.c]!==undefined?!!sel[o.c]&&!same:!s});if(!L.length){if(X.toast)X.toast("لا فروع محدَّدة");return}
 const pcs=L.reduce((s,o)=>s+o.pcs,0);
 if(!confirm("إنشاء "+L.length+" طلباً للفروع ("+fq(pcs)+" قطعة)؟\n\nسيصل كل فرع إشعار، ويظهر الطلب في «الطلبات» كطلب من المستودع.\nلا يمكن التراجع إلا بحذف الطلبات من «الطلبات»."))return;
 let okN=0;const bad=[];
 for(let i=0;i<L.length;i++){const o=L[i];BUSY="جاري إنشاء الطلبات… "+(i+1)+" من "+L.length;paint();let r=null;
  try{r=await X.dispatch({to:o.c,rows:o.rows,rid:rid20(),gn:"توزيع حاوية من تحليل المخزون. الكميات بالحبة."})}catch(e){r={ok:false,err:String(e&&(e.code||e.message)||e)}}
  if(r&&r.ok){okN++;S.sent[o.c]={no:String(r.no||"").slice(0,40),at:Date.now(),h:o.h};dSave()}else bad.push(o.nm+": "+String(r&&r.err||"").slice(0,60))}
 BUSY="";UI.dsel={};paint();if(X.toast)X.toast(bad.length?"أُنشئ "+okN+" طلباً، وتعذّر "+bad.length+": "+bad[0]:"✅ أُنشئ "+okN+" طلباً ووصل الفروع إشعار")
}
const dSave=()=>{try{localStorage.setItem("stk_dist",JSON.stringify(DS))}catch(e){}};
const fq=n=>{const x=Math.round(N(n)*100)/100,p=String(x).split(".");return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,",")+(p[1]?"."+p[1]:"")};
// أعمدة التوزيع: الأونلاين أولاً، ثم فروع الرياض، ثم كل شركة شحن بفروعها (كشيت التوزيع اليدوي)
/* (v198) 📋 بيان الحاوية بالعرض: صف لكل (كود، لون) وعمود لكل مقاس، والقيمة بالحبة (كما يُكتب البيان في إكسل).
   يُلصق كما هو، ويُعرض بنفس الشكل، ولكل فرع «بيان» بنفس الشكل بعد التوزيع. داخلياً كل خانة = سطر (كود، لون، مقاس) يُوزَّع بالحبة */
const stSize=x=>/^(\d{1,3}([.,]5)?|xxs|xs|s|m|l|xl|xxl|[2-6]xl|free|f)$/i.test(String(x||"").trim());
export function parseStatement(text){
 const rows=String(text||"").split(/\r?\n/).map(r=>r.split("\t").map(x=>arDig(String(x)).trim())).filter(r=>r.some(Boolean)),out={ok:false,lines:[],sizes:[],colors:0,ctn:{}};
 const kw=(x,re)=>re.test(normAr(x)),isCodeH=x=>kw(x,/^(الكود|كود|code|الموديل|موديل|model|item|الصنف)$/i),isColH=x=>kw(x,/^(اللون|لون|color|colour|الالوان)$/i),isTot=x=>kw(x,/حب|كا?رتون|اجمال|مجموع|total|كميه|qty|carton|pcs/i);
 let hi=-1;for(let i=0;i<rows.length&&i<12;i++){const r=rows[i],sz=r.filter(stSize);if(sz.length<2)continue;if(r.some(isCodeH)||r.some(isColH)){hi=i;break}
  // بلا عناوين نصية: صف مقاساته أرقام متصاعدة (40، 41، 42…) هو صف العناوين
  const nums=sz.map(x=>parseFloat(String(x).replace(",","."))).filter(x=>x===x);if(nums.length>=3&&nums.every((v,j)=>!j||v>nums[j-1])&&nums[nums.length-1]-nums[0]<=40){hi=i;break}}
 if(hi<0)return out;const H=rows[hi];let ci=H.findIndex(isCodeH),li=H.findIndex(isColH);const zc=[];let cti=-1,nti=-1;
 // (v251) عنوان البيان (سطر بخانة واحدة فوق العناوين) والملاحظات لكل كود (عمود «ملاحظات»، خانته مدموجة على ألوان الكود)
 out.title="";out.notes={};for(let i=0;i<hi;i++){const f=rows[i].filter(Boolean);if(f.length===1&&!out.title)out.title=f[0].slice(0,200)}
 H.forEach((h,j)=>{if(j===ci||j===li)return;if(stSize(h)&&!isTot(h))zc.push(j);else if(kw(h,/كا?رتون|carton/i))cti=j;else if(nti<0&&kw(h,/ملاحظ|note|remark/i))nti=j});
 if(zc.length<2)return out;
 // بلا عنوان للكود أو اللون: أول عمودين ليسا مقاساً ولا إجمالياً
 const free=[];H.forEach((h,j)=>{if(zc.indexOf(j)<0&&j!==cti&&j!==nti&&!isTot(h))free.push(j)});if(ci<0)ci=free.find(j=>j!==li);if(ci===undefined||ci<0)return out;if(li<0){const c2=free.find(j=>j!==ci);li=c2===undefined?-1:c2}
 let last="";const seen=new Set();
 for(let i=hi+1;i<rows.length;i++){const r=rows[i];let code=String(r[ci]||"").trim();const cl=li>=0?String(r[li]||"").trim():"";
  if(r.some(x=>kw(x,/^(الاجمالي|الاجمالى|اجمالي|المجموع|total|grand total)$/i)))continue;
  if(!code){if(!last||!zc.some(j=>num(r[j])>0))continue;code=last}// خانة كود مدموجة: تأخذ الكود الذي فوقها
  if(!/[0-9A-Za-z]/.test(code))continue;last=code;let any=false;
  if(nti>=0){const nt=String(r[nti]||"").trim();if(nt&&!out.notes[code])out.notes[code]=nt.slice(0,100)}
  for(const j of zc){const q=num(r[j]);if(!(q>0))continue;const z=String(H[j]).trim(),k=code+"\u0001"+cl+"\u0001"+z;if(seen.has(k))continue;seen.add(k);out.lines.push({c:code.slice(0,40),cl:cl.slice(0,40),z:z.slice(0,20),q:Math.round(q*100)/100});any=true}
  if(any){out.colors++;if(cti>=0){const c=num(r[cti]);if(c>0)out.ctn[code+"|"+cl]=c}}}
 out.sizes=zc.map(j=>String(H[j]).trim());out.ok=out.lines.length>0;return out;
}
/* (v256) 📋 البيان بالطول: سطر لكل مقاس (الكود · اللون · المقاس · الكمية بالحبة · الكمية بالكرتون · ملاحظات)، وخانتا الكود واللون مدموجتان لأسفل
   (بيان الشال الشتوي). يُعرف بصف عناوين فيه «المقاس» و«الكمية» معاً (البيان بالعرض لا عمود «مقاس» فيه، فلا يختلطان). نفس شكل ناتج parseStatement */
export function parseList(text){
 const rows=String(text||"").split(/\r?\n/).map(r=>r.split("\t").map(x=>arDig(String(x)).trim())).filter(r=>r.some(Boolean)),out={ok:false,lines:[],sizes:[],colors:0,ctn:{},title:"",notes:{},tall:true};
 const kw=(x,re)=>re.test(normAr(x)),isCode=x=>kw(x,/^(الكود|كود|code|item code|الموديل|موديل|model|item|الصنف)$/i),isCol=x=>kw(x,/^(اللون|لون|color|colour|الالوان)$/i),isSz=x=>kw(x,/^(المقاس|مقاس|المقاسات|size|sizes)$/i);
 const isCtn=x=>kw(x,/كا?رتون|carton|ctn/i),isPcs=x=>kw(x,/حب|قطع|pcs|pieces?|units?/i),isQty=x=>kw(x,/كميه|كمية|العدد|qty|quantity/i);
 let hi=-1;for(let i=0;i<rows.length&&i<12;i++){const r=rows[i];if(r.some(isCode)&&r.some(isSz)&&r.some(x=>isQty(x)||isPcs(x))){hi=i;break}}
 if(hi<0)return out;const H=rows[hi],ci=H.findIndex(isCode),li=H.findIndex(isCol),zi=H.findIndex(isSz),cti=H.findIndex(isCtn),nti=H.findIndex(x=>kw(x,/ملاحظ|note|remark/i));
 // عمود الكمية: «بالحبة» أولاً، وإلا أول عمود كمية ليس كرتوناً (لا نأخذ الكراتين ككمية)
 let qi=H.findIndex(x=>isPcs(x)&&!isCtn(x));if(qi<0)qi=H.findIndex(x=>isQty(x)&&!isCtn(x));if(qi<0)return out;
 for(let i=0;i<hi;i++){const f=rows[i].filter(Boolean);if(f.length===1&&!out.title)out.title=f[0].slice(0,200)}
 let lc="",ll="";const at=new Map(),seenC=new Set(),zs=[];
 for(let i=hi+1;i<rows.length;i++){const r=rows[i];
  if(r.some(x=>kw(x,/^(الاجمالي|الاجمالى|اجمالي|المجموع|total|grand total)$/i)))continue;
  let code=String(r[ci]||"").trim();const own=!!code;if(!code)code=lc;// خانة الكود مدموجة: تأخذ الكود الذي فوقها
  let cl=li>=0?String(r[li]||"").trim():"";if(!cl&&!own)cl=ll;// اللون كذلك، ما دام الكود نفسه (كود جديد بلا لون = بلا لون)
  const q=num(r[qi]);if(!code||!/[0-9A-Za-z]/.test(code)||!(q>0))continue;lc=code;ll=cl;
  const z=zi>=0?String(r[zi]||"").trim().slice(0,20):"";if(z&&zs.indexOf(z)<0)zs.push(z);
  if(nti>=0){const nt=String(r[nti]||"").trim();if(nt&&!out.notes[code])out.notes[code]=nt.slice(0,100)}
  const cn=cti>=0?num(r[cti]):0;// (v265) كراتين هذا السطر (كرتون المقاس الواحد): للتوزيع بالكرتون
  const k=code+"\u0001"+cl+"\u0001"+z,x=at.get(k);if(x){x.q=Math.round((x.q+q)*100)/100;if(cn>0)x.cn=Math.round(((x.cn||0)+cn)*100)/100}else{const o={c:code.slice(0,40),cl:cl.slice(0,40),z,q:Math.round(q*100)/100};if(cn>0)o.cn=Math.round(cn*100)/100;at.set(k,o);out.lines.push(o)}
  const ck=code+"|"+cl;if(!seenC.has(ck)){seenC.add(ck);out.colors++}
  if(cn>0)out.ctn[ck]=(out.ctn[ck]||0)+cn}
 out.sizes=zs;out.ok=out.lines.length>0;return out;
}
/* (v265) 📦 التوزيع بالكرتون (محمد: «بيحسب للفرع بالحبة بس… لو في كرتون 12 بيحسبه تقريباً 13»): البيان فيه عدد الكراتين، والكرتون مشكَّل مقاسات
   (مثلاً 2+3+3+2+1+1 = 12 حبة). «مجموعة كرتون» = سطور بالحبة لها نفس الكرتون: (1) البيان بالعرض: كل (كود، لون) وكراتينه من عمود «الكمية بالكرتون» (ctn)،
   (2) البيان بالطول: كل سطر له كراتينه (cn) = كرتون مقاس واحد. a = حبات المقاس في الكرتون الواحد = الكمية ÷ الكراتين، ولازم تطلع عدداً صحيحاً لكل مقاس،
   وإلا المجموعة تتوزّع بالحبة (والسبب يظهر). الناتج: [{k, c, cl, n (الكراتين), pc (حبات الكرتون), items:[{i (رقم السطر), z, a}], ok, why}] */
export function cartonGroups(lines,ctn){
 ctn=ctn||{};const G=[],M=new Map(),isInt=v=>Math.abs(v-Math.round(v))<1e-6;
 (lines||[]).forEach((l,i)=>{if(!l||l.md!=="p"||!String(l.c||"").trim()||!(N(l.ct)>0))return;const c=String(l.c).trim(),cl=String(l.cl||"").trim();
  if(N(l.cn)>0){G.push({k:"s"+i,c,cl,n:N(l.cn),items:[{i,z:String(l.z||"").trim(),q:N(l.ct)}]});return}
  const k=c+"|"+cl,n=N(ctn[k]);if(!(n>0))return;let g=M.get(k);if(!g){g={k:"w"+i,c,cl,n,items:[]};M.set(k,g);G.push(g)}g.items.push({i,z:String(l.z||"").trim(),q:N(l.ct)})});
 for(const g of G){g.ok=isInt(g.n)&&g.n>=1;g.why=g.ok?"":"عدد الكراتين ليس رقماً صحيحاً";let pc=0;
  for(const it of g.items){it.a=it.q/g.n;if(!isInt(it.a)&&g.ok){g.ok=false;g.why="كمية المقاس "+(it.z||"—")+" ("+fq(it.q)+") لا تنقسم على "+fq(g.n)+" كرتون"}it.a=Math.round(it.a*1e6)/1e6;pc+=it.a}
  g.pc=Math.round(pc*1e6)/1e6}
 return G;
}
let DWK={rows:[],cols:[]},DWC=new Map(),BRX=null;// خريطة خانات البيان، كاش أوزان الفروع، وتصدير «بيان الفرع»
const dPcs=l=>{const ct=Math.max(0,N(l.ct)),pk=Math.max(0,N(l.pk));return pk>0?ct*pk:ct};
// صفوف (كود، لون) وأعمدة المقاسات من سطور «بالحبة»
function dWideMap(S){const RK=[],RM=new Map(),ZS=[];S.lines.forEach((l,i)=>{if(l.md!=="p"||!String(l.c||"").trim())return;const k=String(l.c).trim()+"\u0001"+String(l.cl||"").trim();let r=RM.get(k);if(!r){r={c:String(l.c).trim(),cl:String(l.cl||"").trim(),m:{}};RM.set(k,r);RK.push(r)}const z=String(l.z||"").trim();if(ZS.indexOf(z)<0)ZS.push(z);if(!r.m[z])r.m[z]={i,l}});
 ZS.sort((a,b)=>zk(a)-zk(b)||(a<b?-1:a>b?1:0));return {rows:RK,cols:ZS}}
function dWideTable(S){
 const M=dWideMap(S);DWK=M;const ctn=S.ctn||{},hasC=M.rows.some(r=>N(ctn[r.c+"|"+r.cl])>0),colT=M.cols.map(()=>0);let gt=0,gc=0;
 const body=M.rows.map((r,ri)=>{let t=0;const tds=M.cols.map((z,zi)=>{const x=r.m[z];if(x){const v=dPcs(x.l);t+=v;colT[zi]+=v;return '<td><input type="number" min="0" step="1" class="sm" data-dl="'+x.i+'|ct" id="dl'+x.i+'ct" value="'+E(x.l.ct==null?"":x.l.ct)+'" aria-label="'+E(z)+'"></td>'}
   return '<td><input type="number" min="0" step="1" class="sm" data-dw="'+ri+"|"+zi+'" id="dw'+ri+"_"+zi+'" value="" placeholder="·" aria-label="'+E(z)+'"></td>'}).join("");gt+=t;const c=N(ctn[r.c+"|"+r.cl]);gc+=c;
  return '<tr><td class="c" data-notr dir="ltr"><b>'+E(r.c)+'</b></td><td data-notr dir="ltr">'+E(r.cl||"—")+"</td>"+tds+'<td class="n t"><b>'+fq(t)+"</b></td>"+(hasC?'<td class="n">'+(c?fq(c):"")+"</td>":"")+"</tr>"}).join("");
 return '<div class="tw"><table class="stk-t stk-dw"><thead><tr><th>الكود</th><th>اللون</th>'+M.cols.map(z=>'<th class="n" data-notr dir="ltr">'+E(z||"—")+"</th>").join("")+'<th class="n">الكمية بالحبة</th>'+(hasC?'<th class="n">الكمية بالكرتون</th>':"")+"</tr></thead><tbody>"+body+'<tr class="tot"><td colspan="2">الإجمالي</td>'+colT.map(v=>'<td class="n">'+fq(v)+"</td>").join("")+'<td class="n"><b>'+fq(gt)+"</b></td>"+(hasC?'<td class="n"><b>'+fq(gc)+"</b></td>":"")+"</tr></tbody></table></div>";
}
// «بيان الفرع»: ما يأخذه فرع واحد (أو المستودع، أو الحاوية كلها) بنفس شكل البيان، بالحبة
function dBranchCard(live,cols){
 const pl=[];for(const x of live){// (v265) مجموعة الكرتون تتفك لمقاساتها (كل مقاس = الكراتين × حباته في الكرتون)
  if(x.r.sizes){for(const s of x.r.sizes){if(!String(s.z||"").trim())continue;const vals={};for(const c of cols)vals[c.c]=N(x.r.vals[c.c])*s.a;pl.push({l:{c:x.l.c,cl:x.l.cl,z:s.z,md:"p"},r:{total:x.r.total*s.a,wh:x.r.wh*s.a,vals,pc:1}})}continue}
  if(x.l.md==="p"&&String(x.l.z||"").trim()!=="")pl.push(x)}
 if(!pl.length){BRX=null;return ""}
 const opts=cols.map(c=>[c.c,c.nm+(c.route?" ("+c.route+")":"")]).concat([["__wh","المستودع (الباقي)"],["__all","الحاوية كلها"]]);let cur=UI.dbr||"";if(!opts.some(o=>o[0]===cur))cur=opts[0][0];
 const val=x=>cur==="__all"?x.r.total*x.r.pc:cur==="__wh"?x.r.wh*x.r.pc:N(x.r.vals[cur])*x.r.pc,RK=[],RM=new Map(),ZS=[];
 pl.forEach(x=>{const k=x.l.c+"\u0001"+(x.l.cl||"");let r=RM.get(k);if(!r){r={c:String(x.l.c),cl:String(x.l.cl||""),m:{}};RM.set(k,r);RK.push(r)}const z=String(x.l.z).trim();if(ZS.indexOf(z)<0)ZS.push(z);r.m[z]=(r.m[z]||0)+val(x)});ZS.sort((a,b)=>zk(a)-zk(b)||(a<b?-1:1));
 const rows=RK.filter(r=>cur==="__all"||ZS.some(z=>N(r.m[z])!==0)),colT=ZS.map(()=>0);let gt=0;const name=(opts.find(o=>o[0]===cur)||["",""])[1];
 const body=rows.map(r=>{let t=0;const tds=ZS.map((z,zi)=>{const v=N(r.m[z]);t+=v;colT[zi]+=v;return '<td class="n'+(v<0?" z":"")+'">'+(v?fq(v):"·")+"</td>"}).join("");gt+=t;return '<tr><td class="c" data-notr dir="ltr"><b>'+E(r.c)+'</b></td><td data-notr dir="ltr">'+E(r.cl||"—")+"</td>"+tds+'<td class="n t"><b>'+fq(t)+"</b></td></tr>"}).join("");
 BRX={name:"بيان-"+name,head:["الكود","اللون"].concat(ZS).concat(["الكمية بالحبة"]),rows:()=>rows.map(r=>[r.c,r.cl].concat(ZS.map(z=>N(r.m[z])||"")).concat([ZS.reduce((a,z)=>a+N(r.m[z]),0)])).concat([["الإجمالي",""].concat(colT).concat([gt])]),prn:{ttl:"بيان توزيع الحاوية",sub:name}};
 return '<div class="stk-card" style="margin:12px 0 0"><h3>📄 بيان كل فرع (بنفس شكل بيان الحاوية)</h3><div class="stk-bar stk-pvb"><label>الفرع<select data-dbr="1" id="stk-dbr">'+opts.map(o=>'<option value="'+E(o[0])+'"'+(o[0]===cur?" selected":"")+' data-notr>'+E(o[1])+"</option>").join("")+'</select></label><span class="sp"></span><button class="bt" type="button" data-sk="prnb">🖨 اطبع بيان الفرع</button><button class="bt" type="button" data-sk="xlsb">⬇️ إكسل</button></div>'
  +(rows.length?'<div class="tw"><table class="stk-t stk-dw"><thead><tr><th>الكود</th><th>اللون</th>'+ZS.map(z=>'<th class="n" data-notr dir="ltr">'+E(z)+"</th>").join("")+'<th class="n">الكمية بالحبة</th></tr></thead><tbody>'+body+'<tr class="tot"><td colspan="2">الإجمالي</td>'+colT.map(v=>'<td class="n">'+fq(v)+"</td>").join("")+'<td class="n"><b>'+fq(gt)+"</b></td></tr></tbody></table></div>":'<p class="stk-src">لا نصيب لهذا الفرع في التوزيع الحالي.</p>')+"</div>";
}
function dCols(){
 const R=dLoad().rules,ship=X&&X.ship?X.ship()||{}:{},whC=cd(CFG.wh),byC=new Map(),ex=new Set((CFG.ex||[]).map(cd));DATA.st.forEach((s,ti)=>{const m=/^(\d{3})-/.exec(s);if(m)byC.set(m[1],ti)});
 let list=X&&X.branches?X.branches().slice():[];if(!list.length)list=[...byC.keys()];list=list.filter((c,i)=>c!==whC&&!ex.has(c)&&list.indexOf(c)===i);
 let onC="";byC.forEach((ti,c)=>{if(!onC&&/online/i.test(DATA.st[ti]))onC=c});if(!onC)onC="015";
 const cols=list.map(c=>({c,ti:byC.has(c)?byC.get(c):-1,nm:ALIAS[c]?ALIAS[c][0].replace(/ه$/,"ة"):(byC.has(c)?DATA.st[byC.get(c)].slice(4):c),route:String(ship[c]||"").slice(0,40),on:c===onC,lv:R.lv[c]===undefined?1:Math.max(0,N(R.lv[c]))}));
 return cols.sort((p,r)=>(p.on?0:1)-(r.on?0:1)||(p.route?1:0)-(r.route?1:0)||(p.route<r.route?-1:p.route>r.route?1:0)||(p.c<r.c?-1:1));
}
// توزيع سطر: الكمية بوحدة السطر (كرتون، أو حبة = كراتين × حبات الكرتون)، ثم تعديلات اليد فوق المحسوب، والمستودع = الباقي
function dLine(i,l,cols,P){
 const R=DS.rules,md=l.md==="p"?"p":"c",ct=Math.max(0,N(l.ct)),pk=Math.max(0,N(l.pk)),total=md==="c"?ct:(pk>0?ct*pk:ct),step=md==="c"?(N(R.cs)>0?N(R.cs):1):(N(R.ps)>0?N(R.ps):1);
 const wk=[l.c,l.ref,R.mode,P?P.from+"~"+P.to:""].join("|");let W=R.mode==="eq"?{m:new Map(),src:"eq"}:DWC.get(wk);if(!W){W=distWeights(DATA,CFG,{code:l.c,ref:l.ref,period:P,mode:R.mode});DWC.set(wk,W)}const bc=cols.filter(c=>!c.on),on=cols.find(c=>c.on);
 // فرع غير مستبعد بلا مبيعات (فرع جديد مثلاً): وزن ضئيل، فيأخذ «أقل نصيب» فقط ولا يُنسى
 let brs=bc.map(c=>({id:c.c,w:(R.mode==="eq"?1:Math.max(0.0001,c.ti>=0?W.m.get(c.ti)||0:0))*c.lv})),src=W.src;if(!brs.some(b=>b.w>0)){brs=bc.map(c=>({id:c.c,w:c.lv}));src="eq"}
 const A=distribute(total,step,brs,{on:R.on,wh:R.wh,min:md==="c"?R.cmin:R.pmin,max:md==="c"?R.cmax:R.pmax,hasOnline:!!on&&on.lv>0}),vals={};let sum=0,ovn=0;
 for(const c of cols){let v=c.on?A.on:(A.a[c.c]||0);const k=i+"|"+c.c;if(DS.ov[k]!==undefined&&DS.ov[k]!==null&&DS.ov[k]!==""){v=Math.max(0,N(DS.ov[k]));ovn++}vals[c.c]=v;sum+=v}
 return {total,step,md,pk,vals,wh:Math.round((total-sum)*1e6)/1e6,src,ovn,pc:md==="c"?(pk>0?pk:1):1};
}
// (v265) توزيع مجموعة كرتون: الكراتين كاملة (أو أنصاف لو كل مقاس عدده زوجي) بنفس أوزان الفروع ومستوياتها وأقل/أقصى نصيب «بالكرتون»،
// ثم نصيب الفرع من كل مقاس = كراتينه × حبات المقاس في الكرتون. sizes = [{z, a}] للطلبات وبيان الفرع
function dGroup(g,cols,P){
 const R=DS.rules,l0=DS.lines[g.items[0].i]||{},half=N(R.cs)===0.5&&g.items.every(it=>Math.abs(it.a/2-Math.round(it.a/2))<1e-6),step=half?0.5:1;
 const ref=String(l0.ref||"").trim(),wk=[g.c,ref,R.mode,P?P.from+"~"+P.to:""].join("|");let W=R.mode==="eq"?{m:new Map(),src:"eq"}:DWC.get(wk);if(!W){W=distWeights(DATA,CFG,{code:g.c,ref,period:P,mode:R.mode});DWC.set(wk,W)}
 const bc=cols.filter(c=>!c.on),on=cols.find(c=>c.on);
 let brs=bc.map(c=>({id:c.c,w:(R.mode==="eq"?1:Math.max(0.0001,c.ti>=0?W.m.get(c.ti)||0:0))*c.lv})),src=W.src;if(!brs.some(b=>b.w>0)){brs=bc.map(c=>({id:c.c,w:c.lv}));src="eq"}
 const A=distribute(g.n,step,brs,{on:R.on,wh:R.wh,min:R.cmin,max:R.cmax,hasOnline:!!on&&on.lv>0}),vals={},xi="g"+g.items[0].i;let sum=0,ovn=0;
 for(const c of cols){let v=c.on?A.on:(A.a[c.c]||0);const k=xi+"|"+c.c;if(DS.ov[k]!==undefined&&DS.ov[k]!==null&&DS.ov[k]!==""){v=Math.max(0,N(DS.ov[k]));ovn++}vals[c.c]=v;sum+=v}
 return {total:g.n,step,md:"c",pk:g.pc,vals,wh:Math.round((g.n-sum)*1e6)/1e6,src,ovn,pc:g.pc,sizes:g.items.map(it=>({z:it.z,a:it.a})),grp:1};
}
function vDist(){
 const S=dLoad(),R=S.rules,P=period(),cols=dCols(),on=cols.find(c=>c.on),br=cols.filter(c=>!c.on);DWC=new Map();
 const nP=S.lines.filter(l=>l.md==="p"&&String(l.c||"").trim()).length,wide=UI.dvw!=="l"&&nP>0,nC=S.lines.filter(l=>l.md!=="p"&&String(l.c||"").trim()).length;
 const seg=nP?'<div class="stk-seg" role="tablist" style="margin:0 0 10px"><button type="button" data-sk="dvw" data-v="w" class="'+(wide?"on":"")+'">بيان (المقاسات أعمدة)</button><button type="button" data-sk="dvw" data-v="l" class="'+(wide?"":"on")+'">سطور (سطر لكل مقاس)</button></div>':"";
 const wideT=wide?dWideTable(S)+(nC?'<p class="stk-src" style="margin:8px 0 0">'+fq(nC)+" سطر يُوزَّع بالكرتون لا يظهر في البيان: افتح «سطور» لتراه.</p>":""):"";
 const li=(i,f,v,ex)=>`<input ${ex||'type="text"'} data-dl="${i}|${f}" id="dl${i}${f}" value="${E(v==null?"":v)}">`;
 const inp=`<div class="stk-card" style="margin:0 0 12px"><h3>📦 أصناف الحاوية</h3><p>الصق بيان الحاوية من إكسل كما هو (صف لكل كود ولون، وعمود لكل مقاس، بالحبة) من زر «📋 لصق من إكسل»، أو اكتب الخانات هنا. وللتوزيع بالكرتون افتح «سطور». «مثل كود» اختياري: كود قديم مشابه تُؤخذ مبيعاته وزناً للفروع (مفيد لصنف جديد لم يُبع بعد).</p>${seg}${wideT}
 <div class="tw"${wide?' style="display:none"':""}><table class="stk-t stk-dl"><thead><tr><th class="n">#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th class="n">الكراتين</th><th class="n">حبات الكرتون</th><th>يُوزَّع</th><th>مثل كود</th><th></th></tr></thead><tbody>${S.lines.map((l,i)=>`<tr><td class="n rk">${i+1}</td><td>${li(i,"c",l.c,'type="text" list="stk-codes" dir="ltr" autocomplete="off"')}</td><td>${li(i,"cl",l.cl,'type="text" dir="ltr"')}</td><td>${li(i,"z",l.z,'type="text" dir="ltr" class="sm"')}</td><td>${li(i,"ct",l.ct,'type="number" min="0" step="any" class="sm"')}</td><td>${li(i,"pk",l.pk,'type="number" min="0" step="1" class="sm"')}</td><td><select data-dl="${i}|md" id="dl${i}md"><option value="c"${l.md!=="p"?" selected":""}>بالكرتون</option><option value="p"${l.md==="p"?" selected":""}>بالحبة</option></select></td><td>${li(i,"ref",l.ref,'type="text" list="stk-codes" dir="ltr" autocomplete="off" placeholder="اختياري"')}</td><td><button class="bt s" type="button" data-sk="ddel" data-i="${i}" aria-label="حذف السطر" title="حذف السطر">✕</button></td></tr>`).join("")}</tbody></table></div>
 <div class="stk-act" style="margin:10px 0 0"><button class="bt" type="button" data-sk="dadd">＋ سطر</button><button class="bt" type="button" data-sk="dpaste">📋 لصق من إكسل</button><button class="bt" type="button" data-sk="dro">⚙ قواعد التوزيع</button>${S.lines.some(l=>l.c||l.ct)?`<button class="bt" type="button" data-sk="dclr">🗑 مسح الكل</button>`:""}</div>
 ${UI.dp?`<div style="margin-top:10px"><textarea id="stk-dpt" rows="7" dir="ltr" placeholder="الكود	اللون	40	41	42	43	44	45	46	الكمية بالحبة	الكمية بالكرتون" style="width:100%"></textarea><p class="stk-src" style="margin:4px 0 8px">حدِّد البيان في إكسل <b>مع صف العناوين</b> (الكود، اللون، المقاسات) وانسخه والصقه هنا: تُقرأ كل خانة مقاس كميةً بالحبة، وعمودا الإجمالي يُتجاهلان. والشكل القديم (كل صف: الكود، اللون، المقاس، الكراتين، حبات الكرتون) ما زال مقبولاً. تُضاف بعد الأصناف الحالية.</p><button class="bt p" type="button" data-sk="dpok">أضف الصفوف</button></div>`:""}</div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 const num=(k,lab,ph,ex)=>`<label>${lab}<input type="number" min="0" step="any" data-dr="${k}" id="dr-${k}" value="${E(R[k])}" placeholder="${ph||""}" ${ex||""}></label>`;
 const routes=[];for(const c of br){const r=c.route||"";if(!routes.length||routes[routes.length-1].r!==r)routes.push({r,l:[]});routes[routes.length-1].l.push(c)}
 const rules=UI.dro?`<div class="stk-card" style="margin:0 0 12px"><h3>⚙ قواعد التوزيع</h3><p>تُحفظ على هذا الجهاز. تغيير أي قاعدة يعيد الحساب ويلغي تعديلات اليد.</p>
 <div class="stk-bar stk-pvb">${num("on","نصيب الأونلاين %")}${num("wh","يبقى في المستودع %")}<label>وزن الفروع حسب<select data-dr="mode" id="dr-mode">${[["smart","مبيعات الكود (ذكي)"],["all","مبيعات الفرع كلها"],["eq","بالتساوي (المستوى فقط)"]].map(x=>`<option value="${x[0]}"${R.mode===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>${perSel()}</div>
 <div class="stk-bar stk-pvb"><b class="stk-undt">التوزيع بالكرتون</b><label>أصغر وحدة<select data-dr="cs" id="dr-cs">${[[1,"كرتون"],[0.5,"نصف كرتون"]].map(x=>`<option value="${x[0]}"${N(R.cs)===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>${num("cmin","أقل نصيب للفرع (كرتون)")}${num("cmax","أقصى نصيب للفرع (كرتون)","بلا حد")}</div>
 <div class="stk-bar stk-pvb"><b class="stk-undt">التوزيع بالحبة</b>${num("ps","التقريب لأقرب (حبة)")}${num("pmin","أقل نصيب للفرع (حبة)")}${num("pmax","أقصى نصيب للفرع (حبة)","بلا حد")}</div>
 <h3 style="margin:10px 0 4px;font-size:15px">مستوى كل فرع</h3><p>يضرب وزن الفرع: «ضعف» يأخذ ضعف نصيبه، و«مستبعد» لا يأخذ شيئاً.</p>
 ${on?`<div class="stk-lvg"><b>الأونلاين</b><label><span data-notr>${E(on.nm)}</span><select data-dv="${E(on.c)}" id="dv-${E(on.c)}"><option value="1"${on.lv>0?" selected":""}>يأخذ نسبته</option><option value="0"${on.lv<=0?" selected":""}>مستبعد</option></select></label></div>`:""}
 ${routes.map(g=>`<div class="stk-lvg"><b${g.r?" data-notr":""}>${g.r?E(g.r):"الرياض"}</b>${g.l.map(c=>`<label><span data-notr>${E(c.nm)}</span><select data-dv="${E(c.c)}" id="dv-${E(c.c)}">${DLV.map(x=>`<option value="${x[0]}"${c.lv===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>`).join("")}</div>`).join("")}
 <div class="stk-act" style="margin:10px 0 0"><button class="bt" type="button" data-sk="ddef">↺ القواعد الافتراضية</button></div></div>`:"";
 // (v265) بالكرتون (الافتراضي لو البيان فيه كراتين) أو بالحبة. بالكرتون: صف لكل (كود، لون) بكراتينه، والسطور اللي مالهاش كرتون صالح تفضل بالحبة
 const GR=cartonGroups(S.lines,S.ctn),okG=GR.filter(g=>g.ok),badG=GR.filter(g=>!g.ok),unit=R.unit==="p"||!okG.length?"p":"c",gAt=new Map(),cov=new Set();
 if(unit==="c")okG.forEach(g=>{gAt.set(g.items[0].i,g);g.items.forEach(it=>cov.add(it.i))});
 const zr=g=>{const z=g.items.map(it=>it.z).filter(Boolean);return z.length>1?z[0]+"–"+z[z.length-1]:z[0]||""};
 const live=[];S.lines.forEach((l,i)=>{if(!String(l.c||"").trim()||!(N(l.ct)>0))return;
  if(cov.has(i)){const g=gAt.get(i);if(g)live.push({i:"g"+i,l:{c:g.c,cl:g.cl,z:zr(g),ct:g.n,md:"c",ref:l.ref},r:dGroup(g,cols,P)});return}
  live.push({i,l,r:dLine(i,l,cols,P)})});
 const useg=GR.length?`<div class="stk-card" style="margin:0 0 12px"><h3>📦 طريقة التوزيع على الفروع</h3><div class="stk-seg" role="tablist" style="margin:0 0 8px"><button type="button" data-sk="dunit" data-v="c" class="${unit==="c"?"on":""}"${okG.length?"":" disabled"}>بالكرتون</button><button type="button" data-sk="dunit" data-v="p" class="${unit==="p"?"on":""}">بالحبة</button></div>
  <p class="stk-src" style="margin:0">${unit==="c"?`كل فرع يأخذ <b>كراتين كاملة</b>${N(R.cs)===0.5?" (أو نصف كرتون لو التشكيلة تسمح)":""}، ومقاسات الفرع = كراتينه × تشكيلة الكرتون (${fq(okG.length)} ${okG.length===1?"لون":"ألوان"} بالكرتون). أقل وأقصى نصيب من «التوزيع بالكرتون» في القواعد.`:`كل مقاس يتوزّع لوحده بالحبة، فنصيب الفرع قد لا يساوي كراتين كاملة (مثلاً 13 حبة بدل كرتون 12).${okG.length?" اختر «بالكرتون» ليأخذ كل فرع كراتين كاملة.":""}`}</p>
  ${badG.length?`<div class="stk-rep w" style="margin:8px 0 0">⚠️ ${fq(badG.length)} ${badG.length===1?"لون يتوزّع":"ألوان تتوزّع"} بالحبة لأن التشكيلة لا تنقسم على الكراتين: ${badG.slice(0,4).map(g=>`<span data-notr dir="ltr">${E(g.c+" "+g.cl)}</span> (${E(g.why)})`).join("، ")}${badG.length>4?"…":""}</div>`:""}</div>`:"";
 if(!live.length){LASTX=null;return inp+rules+em("اكتب أصناف الحاوية في الأعلى (الكود وعدد الكراتين على الأقل) ليظهر التوزيع.<br>الأونلاين يأخذ "+fq(R.on)+"% من كل كمية، و"+fq(R.wh)+"% تبقى في المستودع، والباقي على الفروع حسب مبيعاتها. غيّر ذلك من «⚙ قواعد التوزيع».")}
 let tP=0,oP=0,bP=0,wP=0,ovn=0,neg=0;const colP={};for(const x of live){const r=x.r;tP+=r.total*r.pc;wP+=r.wh*r.pc;ovn+=r.ovn;if(r.wh<-1e-9)neg++;for(const c of cols){const p=r.vals[c.c]*r.pc;colP[c.c]=(colP[c.c]||0)+p;if(c.on)oP+=p;else bP+=p}}
 const SRC={ref:"وزن الفروع: مبيعات الكود المشابه",code:"وزن الفروع: مبيعات الكود نفسه",all:"وزن الفروع: مبيعات الفرع كلها",eq:"وزن الفروع: بالتساوي"};
 LASTX={name:"توزيع-حاوية",head:["الكود","اللون","المقاس","الكمية بالكرتون","الكمية بالحبة"].concat(cols.map(c=>c.nm+(c.route?" ("+c.route+")":""))).concat(["المستودع","ملاحظات"]),rows:()=>live.map(x=>{const l=x.l,r=x.r;return [l.c,l.cl,l.z,l.ct,r.total*r.pc].concat(cols.map(c=>r.vals[c.c])).concat([r.wh,r.md==="c"?"التوزيع بالكرتون":"التوزيع بالحبة"])}).concat([["الإجمالي بالحبة","","","",tP].concat(cols.map(c=>colP[c.c]||0)).concat([wP,""])])};
 const T=[tile(fq(tP),"قطعة في الحاوية","k"),tile(fq(oP),"للأونلاين ("+pct(tP?oP/tP:0)+")"),tile(fq(bP),"للفروع ("+pct(tP?bP/tP:0)+")","k"),tile(fq(wP),"تبقى في المستودع ("+pct(tP?wP/tP:0)+")",wP<0?"bad":"")];
 const cell=(x,c)=>{const k=x.i+"|"+c.c,ov=S.ov[k]!==undefined&&S.ov[k]!==null&&S.ov[k]!=="",v=x.r.vals[c.c];return `<td class="${c.on?"on":""}${ov?" ov":""}"><input type="number" min="0" step="any" class="dgi" data-dx="${k}" id="dx${x.i}_${c.c}" value="${v?fq(v).replace(/,/g,""):ov?"0":""}" placeholder="0" aria-label="${E(c.nm)}"></td>`};
 const grid=`<div class="stk-pan stk-piv"><div class="tw"><table class="stk-t stk-mx stk-dg"><thead><tr><th class="s" rowspan="2">الصنف</th><th rowspan="2">الكمية</th>${on?`<th rowspan="2" class="on" data-notr>${E(on.nm)}</th>`:""}${routes.map(g=>`<th colspan="${g.l.length}" class="rt"${g.r?" data-notr":""}>${g.r?E(g.r):"الرياض"}</th>`).join("")}<th rowspan="2">المستودع</th></tr><tr>${br.map(c=>`<th data-notr${c.lv<=0?' class="off"':""}>${E(c.nm)}</th>`).join("")}</tr></thead><tbody>
 ${live.map(x=>{const l=x.l,r=x.r;return `<tr><td class="s"><b data-notr dir="ltr">${E(l.c)}</b><i data-notr>${E([l.cl,l.z].filter(Boolean).join(" · ")||"—")}</i><i>${SRC[r.src]||""}${r.src==="ref"?` <span data-notr dir="ltr">${E(l.ref)}</span>`:""}</i></td><td class="t"><b>${fq(r.total)}</b><i>${r.md==="c"?"كرتون":"حبة"}${r.md==="c"&&r.pk?" · "+fq(r.total*r.pk)+" حبة":""}</i></td>${on?cell(x,on):""}${br.map(c=>cell(x,c)).join("")}<td class="wh${r.wh<-1e-9?" need":""}"><b>${fq(r.wh)}</b></td></tr>`}).join("")}
 <tr class="tot"><td class="s">الإجمالي بالحبة</td><td>${fq(tP)}</td>${on?`<td>${fq(colP[on.c]||0)}</td>`:""}${br.map(c=>`<td>${fq(colP[c.c]||0)}</td>`).join("")}<td>${fq(wP)}</td></tr></tbody></table></div>
 <p class="stk-src" style="margin:8px 4px 0">كل خانة تُعدَّل باليد (تظهر بحد بنفسجي)، والمستودع يأخذ الباقي تلقائياً. الأرقام بوحدة السطر (كرتون أو حبة)، وسطر الإجمالي بالحبة.</p></div>`;
 return inp+rules+gapNote(P)+useg+`<div class="stk-tiles">${T.join("")}</div>${neg?`<div class="stk-rep r">⚠️ ${fq(neg)} سطر وُزِّع فيه أكثر من كميته (المستودع بالسالب). راجِع الخانات المعدَّلة باليد.</div>`:""}
 <div class="stk-act">${ovn?`<button class="bt" type="button" data-sk="dovx">↺ إلغاء تعديلات اليد (${fq(ovn)})</button>`:""}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button>${X&&X.dispatch?`<button class="bt p" type="button" data-sk="dsn"${neg?" disabled":""}>📤 حوّل التوزيع إلى طلبات للفروع</button>`:""}</div>${X&&X.dispatch&&UI.dsn&&!neg?dSendCard(live,cols):""}${grid}`+dBranchCard(live,cols);
}
// بطاقة المراجعة قبل إنشاء الطلبات: فرعاً فرعاً، وما أُنشئ من قبل بنفس الكميات لا يُنشأ مرة أخرى
function dSendCard(live,cols){
 const S=dLoad(),sel=UI.dsel||{};DORD=distOrders(live,cols);let n=0,pcs=0;const noPk=live.some(x=>x.r.md==="c"&&!(x.r.pk>0));
 const rows=DORD.map(o=>{const s=S.sent[o.c],same=!!s&&s.h===o.h,on=same?false:sel[o.c]!==undefined?!!sel[o.c]:!s;if(on){n++;pcs+=o.pcs}
  return `<tr><td class="n"><input type="checkbox" data-dsb="${E(o.c)}" id="dsb-${E(o.c)}"${on?" checked":""}${same?" disabled":""} aria-label="${E(o.nm)}" style="width:18px;height:18px"></td><td><label for="dsb-${E(o.c)}" data-notr style="margin:0;font-weight:700">${E(o.nm)}</label></td><td class="n">${fq(o.rows.length)}</td><td class="n"><b>${fq(o.pcs)}</b></td><td>${same?`<span class="gv" style="padding:2px 10px">✅ أُنشئ <span data-notr dir="ltr">${E(s.no)}</span></span>`:s?`<span class="no">⚠️ تغيّر التوزيع بعد إنشاء <span data-notr dir="ltr">${E(s.no)}</span></span>`:"—"}</td></tr>`}).join("");
 return `<div class="stk-card" style="margin:0 0 12px;border:1.5px solid var(--acc)"><h3>📤 طلبات الفروع من هذا التوزيع</h3><p>يُنشأ لكل فرع محدَّد طلب واحد من المستودع بأصنافه (بالحبة)، ويصله إشعار، ثم يُجهَّز ويُسلَّم ويؤكد الفرع استلامه كأي طلب. الفرع الذي أُنشئ طلبه بنفس الكميات لا يُنشأ له مرة أخرى.</p>
 ${noPk?`<div class="stk-rep w">سطور توزَّع بالكرتون بلا «حبات الكرتون»: كميتها في الطلب ستكون بعدد الكراتين. اكتب حبات الكرتون لتتحوّل إلى حبات.</div>`:""}
 ${DORD.length?`<div class="tw"><table class="stk-t"><thead><tr><th></th><th>الفرع</th><th class="n">أصناف</th><th class="n">قطعة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>
 <div class="stk-act" style="margin:12px 0 0"><button class="bt p" type="button" data-sk="dgo"${n?"":" disabled"}>📤 أنشئ ${fq(n)} طلباً (${fq(pcs)} قطعة)</button><button class="bt" type="button" data-sk="dsall" data-v="1">تحديد الكل</button><button class="bt" type="button" data-sk="dsall" data-v="0">إلغاء التحديد</button><button class="bt" type="button" data-sk="dsn">إغلاق</button></div>`:`<p>لا فرع له نصيب في هذا التوزيع.</p>`}</div>`;
}
/* (v186) 🛒 الشراء المقترح */
const cov=c=>c>=999?"999+":fmt(c);
function vBuy(){
 const P=period(),days=pDays(P),R=reorder(DATA,CFG,{period:P,days,horizon:UI.bh,alert:UI.ba,vendor:UI.vn,q:UI.q});
 const bar=focBar()+`<div class="stk-bar"><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" placeholder="مثلاً 13016" dir="ltr"></label><label>أشتري ما يكفي (يوماً)<input type="number" min="7" max="365" data-sf="bh" id="stk-bh" value="${E(UI.bh)}"></label><label>الرصيد يكفي أقل من (يوماً)<input type="number" min="1" max="365" data-sf="ba" id="stk-ba" value="${E(UI.ba)}"></label>${perSel()}<label>الترتيب<select data-sf="bs" id="stk-bs">${[["cover","الأقرب نفاداً"],["qty","الأكبر كمية"],["sold","الأعلى مبيعاً"],["vn","المورد"]].map(x=>`<option value="${x[0]}"${UI.bs===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label><span class="sp"></span>${fclr("vn,q")}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>`;
 if(!R){LASTX=null;return bar+em("هذا المورد غير موجود في ملف الكميات.")}
 const L2=R.rows.slice();if(UI.bs==="qty")L2.sort((p,r)=>r.qty-p.qty||p.cover-r.cover);else if(UI.bs==="sold")L2.sort((p,r)=>r.sold-p.sold||p.cover-r.cover);else if(UI.bs==="vn")L2.sort((p,r)=>(vnOf(p.vi)<vnOf(r.vi)?-1:vnOf(p.vi)>vnOf(r.vi)?1:0)||p.cover-r.cover);
 const L=focL(L2,c=>c.code,c=>vnOf(c.vi)),qtyL=L.reduce((s,c)=>s+c.qty,0),nv=new Set(L.map(c=>c.vi)).size,noWh=L.filter(c=>c.wh<=0).length;
 LASTX={name:"الشراء-المقترح",head:["المورد","الكود","اللون","المقاس","المبيعات","الرصيد (مستودع وفروع)","رصيد المستودع","المقترح شراؤه"],rows:()=>{const o=[];for(const c of L)for(const v of c.vars)if(v.qty>0){const x=DATA.k[v.ki];o.push([vnOf(c.vi),c.code,x[1],x[2],v.sold,v.on,v.wh,v.qty])}return o}};
 const det=c=>`<tr class="stk-dx"><td colspan="8"><table class="stk-t"><thead><tr><th>اللون</th><th class="n">المقاس</th><th class="n">المبيعات</th><th class="n">الرصيد</th><th class="n">المستودع</th><th class="n">المقترح</th></tr></thead><tbody>${c.vars.filter(v=>v.qty>0||v.on||v.sold).map(v=>{const x=DATA.k[v.ki];return `<tr><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td><td class="n">${fmt(v.sold)}</td><td class="n${v.on<=0?" z":""}">${fmt(v.on)}</td><td class="n${v.wh<=0?" z":""}">${fmt(v.wh)}</td><td class="n">${v.qty?`<span class="gv" style="padding:2px 10px">${fmt(v.qty)}</span>`:"—"}</td></tr>`}).join("")}</tbody></table></td></tr>`;
 return bar+gapNote(P)+`<div class="stk-sum"><span><b>${fmt(L.length)}</b>كود يحتاج شراء</span><span><b>${fmt(qtyL)}</b>قطعة مقترحة</span><span><b>${fmt(nv)}</b>مورد</span><span><b style="color:#c4362b">${fmt(noWh)}</b>كود خلا منه المستودع</span></div>
 <p class="off" style="margin:0 4px 10px;font-size:13px">القاعدة: كود يُباع، والمستودع خالٍ منه أو رصيده كله (مستودع وفروع) يكفي أقل من ${fmt(R.AL)} يوماً بمعدل بيعه. المقترح لكل لون ومقاس = ما يكفي ${fmt(R.H)} يوماً بمعدل بيعه هو ناقصاً رصيده، فالأكثر مبيعاً يأخذ أكثر. المعدل = مبيعات ${P?"الفترة":"السنة"} ÷ ${fmt(R.days)} يوماً. <b>تقدير من البيع الماضي، راجِعه قبل الطلب.</b>${!P&&dHas()?" للأصناف الجديدة اختر «آخر 30 يوماً» ليكون المعدل أدق.":""}</p>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>المورد</th><th class="n">المستودع</th><th class="n">الفروع</th><th class="n">المبيعات</th><th class="n">يكفي (يوماً)</th><th class="n">المقترح شراؤه</th><th></th></tr></thead><tbody>${L.slice(0,UI.lim).map(c=>`<tr${foCls(c)}><td class="c" data-notr><a href="#" data-sk="code" data-c="${E(c.code)}" style="color:inherit">${E(c.code)}</a></td><td data-notr style="white-space:normal">${E(vnOf(c.vi)||"—")}</td><td class="n${c.wh<=0?" z":""}">${fmt(c.wh)}</td><td class="n">${fmt(c.br)}</td><td class="n">${fmt(c.sold)}</td><td class="n${c.cover<R.AL?" z":""}">${cov(c.cover)}</td><td class="n"><span class="gv" style="padding:2px 10px">${fmt(c.qty)}</span></td><td><button class="bt s" type="button" data-sk="bx" data-c="${E(c.code)}">${UI.bx===c.code?"إخفاء":"المقاسات"}</button></td></tr>${UI.bx===c.code?det(c):""}`).join("")}</tbody></table></div>${more(L.length)}</div>`:em("لا شيء يحتاج شراء بهذه الشروط 👌")}`;
}
/* (v229) 📊 «لوحة اليوم»: شاشة واحدة تقول من أين تبدأ (فروع بترتيب الأهمية، تحويلات، الأكثر والأقل مبيعاً، حالة الفروع) وتُصدَّر بنفس الشكل */
let HOMEC=null,DASH=null;
// الفترة الخاصة باللوحة (للمبيعات): هذا الشهر / آخر 30 يوماً / من أول السنة
const dimOf=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
const prevYm=ym=>{let y=+ym.slice(0,4),m=+ym.slice(5,7)-1;if(m<1){m=12;y--}return y+"-"+p2(m)};
const DPER=()=>{const e=qEnd(),dp=dHas()?(UI.dp||"m"):"ytd";
 if(dp==="30"){const A={from:addDays(e,-29),to:e};return {k:"30",P:A,B:{from:addDays(e,-59),to:addDays(e,-30)},lb:"آخر 30 يوماً",bl:"الـ30 يوماً التي قبلها"}}
 if(dp==="m"){const ym=e.slice(0,7),d=+e.slice(8,10),pm=prevYm(ym);return {k:"m",P:{from:ym+"-01",to:e},B:{from:pm+"-01",to:pm+"-"+p2(Math.min(d,dimOf(pm)))},lb:"هذا الشهر",bl:"نفس الأيام من الشهر الماضي"}}
 return {k:"ytd",P:null,B:null,lb:"من أول السنة",bl:""}};
const chkKey=()=>"stk_chk_"+qEnd();
const chkLoad=()=>{try{const o=JSON.parse(localStorage.getItem(chkKey())||"{}");return o&&typeof o==="object"?o:{}}catch(e){return {}}};
const chkSave=o=>{try{localStorage.setItem(chkKey(),JSON.stringify(o))}catch(e){}};
// الأكثر والأقل مبيعاً + أرقام كل فرع (دالة نقية للاختبار). الأقل مبيعاً = أكواد رصيدها (فروع + مستودع) لا يقل عن minOn
export function dashData(D,C,o){
 o=o||{};const P=o.period||null,PM=P?soldMap(D,P.from,P.to):null,wh=D.sti.get(C.wh),ex=exSet(C,D),minOn=o.minOn>0?o.minOn:30,n=o.n>0?o.n:10;
 const byC=new Map(),byB=new Map();let tot=0,whOn=0,brOn=0;
 eachCell(D,PM,null,(ki,ti,vi,on,s)=>{if(ex.has(ti))return;const c=D.k[ki][0];let a=byC.get(c);if(!a){a={code:c,vi:D.k[ki][3],sold:0,on:0,wh:0,brs:new Set()};byC.set(c,a)}
  if(ti===wh){a.wh+=on;whOn+=on}else{a.on+=on;brOn+=on;if(s>0)a.brs.add(ti);let b=byB.get(ti);if(!b){b={ti,sold:0,on:0};byB.set(ti,b)}b.sold+=s;b.on+=on}a.sold+=s;tot+=s});
 const L=[...byC.values()].map(a=>({code:a.code,vi:a.vi,sold:a.sold,on:a.on,wh:a.wh,nb:a.brs.size}));
 const top=L.filter(a=>a.sold>0).sort((p,r)=>r.sold-p.sold||(p.code<r.code?-1:1)).slice(0,n);
 const low=L.filter(a=>a.on+a.wh>=minOn).sort((p,r)=>p.sold-r.sold||(r.on+r.wh)-(p.on+p.wh)||(p.code<r.code?-1:1)).slice(0,n);
 return {top,low,tot,whOn,brOn,codes:L.length,br:[...byB.values()].sort((p,r)=>r.sold-p.sold)};
}
function dashCalc(){
 const P=period(),days=pDays(P)||1,dp=DPER(),SM=sentMap(),nd=Object.keys(DATA.d).length,key=[UI.per,UI.from,UI.to,UI.bh,UI.ba,dp.k,JSON.stringify(CFG),ENVK,nd,qEnd()].join("|");
 if(HOMEC&&HOMEC.D===DATA&&HOMEC.k===key)return HOMEC;
 const R=reorder(DATA,CFG,{period:P,days,horizon:UI.bh,alert:UI.ba}),PL=dayPlan(DATA,CFG,{period:P,days,isBranch:ti=>isBr(DATA.st[ti]),skip:l=>SM.has(sentKey(l))});
 const dcov=dp.P?coverage(META,dp.P):{ok:true},S=dashData(DATA,CFG,{period:dp.P,n:20});
 let need=0,give=0;for(const l of shortages(DATA,CFG,{sold:1,period:P,days})){need+=Math.max(0,N(l.need));give+=Math.max(0,N(l.give))}
 let prev=null;if(dp.B&&dcov.ok&&coverage(META,dp.B).ok&&months(dp.B.from,dp.B.to).every(ym=>!(META.d&&META.d[ym])||DATA.d[ym])){const m=soldMap(DATA,dp.B.from,dp.B.to),ex=exSet(CFG,DATA);let t=0;m.forEach((v,k)=>{if(!ex.has(k%1000))t+=v});prev=t;soldMap(DATA,dp.P.from,dp.P.to)}
 // المبيعات يوماً بيوم (من ملفات التاريخ): فترة اللوحة، أو آخر 30 يوماً لو «من أول السنة»
 let ser=null;if(dHas()){const e=qEnd(),F=dp.P||{from:addDays(e,-29),to:e},ex=exSet(CFG,DATA),m=new Map();for(let d=F.from;d<=F.to;d=addDays(d,1))m.set(d,0);
  for(const ym in DATA.d){if(ym+"-31"<F.from||ym+"-01">F.to)continue;const r=DATA.d[ym];for(let i=0;i<r.length;i+=5){if(ex.has(r[i+1]))continue;const d=ym+"-"+p2(r[i+2]);if(m.has(d))m.set(d,m.get(d)+r[i+3])}}
  const cvF=coverage(META,F);ser={F,ok:cvF.ok,d:[...m.entries()]}}
 const PR=new Map();PL.tr.forEach(b=>b.lines.forEach(l=>{const k=l.src+"|"+l.dst;let p=PR.get(k);if(!p){p={src:l.src,dst:l.dst,n:0,pcs:0,sure:0};PR.set(k,p)}p.n++;p.pcs+=l.n;if(l.sure)p.sure+=l.n}));
 const pairs=[...PR.values()].sort((p,r)=>r.pcs-p.pcs||r.sure-p.sure);
 const sellN=new Map();for(let ki=0;ki<DATA.q.length;ki++){const a=DATA.q[ki];if(!a)continue;for(let j=0;j<a.length;j+=4)if(a[j+2]>0)sellN.set(a[j],(sellN.get(a[j])||0)+1)}
 HOMEC={D:DATA,k:key,P,days,dp,dcov,R,PL,S,prev,pairs,sellN,need:new Map(PL.need.map(b=>[b.ti,b])),trb:new Map(PL.tr.map(b=>[b.ti,b])),shN:need,shG:give,ser};return HOMEC;
}
// ما أُنشئ له طلب بعد ملف الأرصدة: فرع ← قطع (نواقص من المستودع / تحويل إليه)
const doneMaps=()=>{const since=META&&META.q?N(META.q.at):0,n=new Map(),t=new Map();if(X.reqs&&since)for(const r of X.reqs()){if(!r||!(N(r.ts)>since))continue;let q=0;for(const w of r.rows||[])if(w&&!w.na)q+=Math.round(N(w.q))||0;if(q<=0)continue;const M=r.tr||r.fr?t:n;M.set(String(r.br),(M.get(String(r.br))||0)+q)}return {n,t}};
const lostT=b=>b.lost>=0.95?fmt(b.lost):b.lost>0?"أقل من 1":"0";
const dpct=(a,b)=>b>0?Math.round((a-b)/b*100):null;
const srtPri=R=>{const PLs=priList(CFG);return R.map((l,i)=>[l,priRank(PLs,DATA.k[l.ki][0]),i]).sort((p,q)=>(p[1]-q[1])||(p[2]-q[2])).map(x=>x[0])};
// تفاصيل فرع داخل اللوحة (كانت في «خطة اليوم»): نواقص من المستودع أو تحويلات إليه، وإنشاء الطلب منها
function hDetN(b,can){const R=srtPri(b.lines),sh=R.slice(0,80);
 return '<div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد الفرع</th><th class="n">باع</th><th class="n">في المستودع</th><th class="n">يُرسل له</th></tr></thead><tbody>'+sh.map(l=>"<tr>"+kCells(l.ki)+'<td class="n'+(l.on<=0?" z":"")+'">'+fmt(l.on)+(l.way?' <small class="off">+'+fmt(l.way)+" في الطريق</small>":"")+'</td><td class="n">'+fmt(l.sold)+'</td><td class="n">'+fmt(l.wh)+'</td><td class="n"><span class="gv" style="padding:2px 10px">'+fmt(l.give)+"</span></td></tr>").join("")+"</tbody></table></div>"+(R.length>80?'<p class="stk-src" style="margin:6px 4px 0">معروض أول 80 من '+fmt(R.length)+" صنفاً. الطلب والطباعة يشملان الكل.</p>":"")
  +'<div class="stk-act" style="margin:10px 0 0">'+(can&&X.dispatch?'<button class="bt g" type="button" data-sk="pgo" data-v="'+b.ti+'">📤 أنشئ طلب الفرع ('+fmt(Math.min(400,b.n))+" صنف · "+fmt(b.lines.slice(0,400).reduce((a,l)=>a+l.give,0))+" قطعة)</button>":"")+'<button class="bt" type="button" data-sk="prn">🖨 اطبع ورقة الفرع</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button><button class="bt" type="button" data-sk="pneed" data-v="'+E(DATA.st[b.ti])+'">اختر أصنافاً أو عدّل الكميات</button></div>'}
function hDetT(b,can){const R=b.lines,sh=R.slice(0,80),ok=R.filter(l=>isBr(DATA.st[l.src])),prs=new Set(ok.map(l=>l.src)).size;let last=-1;
 return '<div class="tw"><table class="stk-t stk-oxl"><thead><tr><th>يأخذ من فرع</th><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">رصيد المُرسِل</th><th class="n">باع المُرسِل</th><th class="n">رصيد هذا الفرع</th><th class="n">باع</th><th class="n">الكمية</th><th>الثقة</th></tr></thead><tbody>'+sh.map(l=>{const first=l.src!==last;last=l.src;return "<tr"+(first?' data-g="1"':"")+"><td>"+(first?"<b>"+sn(l.src)+"</b>":"")+"</td>"+kCells(l.ki)+'<td class="n">'+fmt(l.fon)+'</td><td class="n">'+fmt(l.fsold)+'</td><td class="n'+(l.ton<=0?" z":"")+'">'+fmt(l.ton)+'</td><td class="n">'+fmt(l.tsold)+'</td><td class="n"><span class="gv" style="padding:2px 10px">'+fmt(l.n)+"</span></td><td>"+cfB(l)+"</td></tr>"}).join("")+"</tbody></table></div>"+(R.length>80?'<p class="stk-src" style="margin:6px 4px 0">معروض أول 80 من '+fmt(R.length)+" سطراً. الأوامر والطباعة تشمل الكل.</p>":"")
  +'<div class="stk-act" style="margin:10px 0 0">'+(can&&X.transfer&&prs?'<button class="bt g" type="button" data-sk="pdst" data-v="'+b.ti+'">📤 أنشئ '+(prs===1?"أمر التحويل":fmt(prs)+" أوامر تحويل")+" لهذا الفرع ("+fmt(b.pcs)+" قطعة)</button>":"")+'<button class="bt" type="button" data-sk="prn">🖨 اطبع ورقة الفرع</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button><button class="bt" type="button" data-sk="ptr" data-v="'+E(DATA.st[b.ti])+'">عدّل الكميات في «تحويلات مقترحة»</button></div>'}
const dm=x=>(+String(x).slice(8,10))+"/"+(+String(x).slice(5,7)),RCF=2*Math.PI*52;let ANIMK="";
// حلقة تلف (SVG): p من 0 إلى 1
const ring=(p,big,sub,lb,col,go,an,tip)=>{p=Math.max(0,Math.min(1,p||0));return `<div class="stk-rg${go?" go":""}"${go?` data-sk="${go[0]}" data-t="${go[1]||""}" role="button" tabindex="0"`:""}${tip?` title="${E(tip)}"`:""}><div class="rw"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="b"/><circle cx="60" cy="60" r="52" class="f${an?" an":""}" style="stroke:${col};stroke-dasharray:${RCF.toFixed(1)};stroke-dashoffset:${(RCF*(1-p)).toFixed(1)}"/></svg><div class="v"><b data-notr dir="ltr">${big}</b><small>${sub}</small></div></div><span>${lb}</span></div>`};
function vHome(){
 const H=dashCalc(),dp=H.dp,S=H.S,PL=H.PL,R=H.R,CK=chkLoad(),DN=doneMaps(),end=qEnd(),an=ANIMK!==H.k+"|"+UI.hx;ANIMK=H.k+"|"+UI.hx;PLN=PL;
 const A=an?" an":"",cl=c=>`<a href="#" data-sk="code" data-c="${E(c)}" style="color:inherit" data-notr><bdi dir="ltr">${E(c)}</bdi></a>`;
 const isDone=(s,ti)=>!!CK[s+":"+ti]||(s==="n"?DN.n:DN.t).has(cd(DATA.st[ti])),bDone=b=>!!CK["b:"+b.ti]||((!b.nb||isDone("n",b.ti))&&(!b.tb||isDone("t",b.ti)));
 const zeroAll=PL.need.reduce((a,b)=>a+b.zero,0),give=PL.need.reduce((a,b)=>a+b.pcs,0),trp=H.pairs.reduce((a,p)=>a+p.pcs,0),lostAll=PL.need.reduce((a,b)=>a+b.lost,0)+PL.tr.reduce((a,b)=>a+b.lost,0);
 const pv=H.prev!==null?dpct(S.tot,H.prev):null;
 // الفروع
 const BR=S.br.filter(b=>isBr(DATA.st[b.ti])).map(b=>{const nb=H.need.get(b.ti),tb=H.trb.get(b.ti);return {ti:b.ti,sold:b.sold,on:b.on,n:nb?nb.n:0,zero:(nb?nb.zero:0)+(tb?tb.zero:0),lost:(nb?nb.lost:0)+(tb?tb.lost:0),pcs:nb?nb.pcs:0,tp:tb?tb.pcs:0,nb,tb,sell:H.sellN.get(b.ti)||0}}).sort((p,r)=>r.lost-p.lost||r.zero-p.zero||r.sold-p.sold);
 const stt=b=>b.lost>=1||b.zero>=10?"bad":b.n||b.tp?"warn":"good",ok=BR.filter(b=>stt(b)==="good").length,nNeed=BR.filter(b=>b.nb||b.tb).length,nDone=BR.filter(b=>(b.nb||b.tb)&&bDone(b)).length;
 const top20=S.top.slice(0,20),avail=top20.filter(a=>a.wh>0).length;
 // 1) الرأس
 const seg=`<div class="stk-seg stk-dseg" role="tablist">${(dHas()?[["m","هذا الشهر"],["30","آخر 30 يوماً"],["ytd","من أول السنة"]]:[["ytd","من أول السنة"]]).map(a=>`<button type="button" data-sk="hdp" data-v="${a[0]}" class="${dp.k===a[0]?"on":""}">${a[1]}</button>`).join("")}</div>`;
 const hero=`<div class="stk-dhero${A}"><div class="hx"><h2>لوحة اليوم</h2><p>أرصدة حتى نهاية <b data-notr dir="ltr">${E(end)}</b> · المبيعات ${dp.lb}</p></div><div class="hs"><div class="hn"><b data-notr dir="ltr">${fmt(S.tot)}</b><span>قطعة مباعة</span>${pv!==null?`<em class="${pv>=0?"up":"dn"}" data-notr dir="ltr">${pv>=0?"▲":"▼"} ${Math.abs(pv)}%</em>`:""}</div><div class="hn"><b data-notr dir="ltr">${lostAll>=0.95?fmt(lostAll):lostAll>0?"<1":"0"}</b><span>قطعة تخسرها الفروع يومياً</span></div></div><div class="ha">${seg}<button class="bt p" type="button" data-sk="hprn">🖨 صدّر الملخص</button></div></div>`;
 // 2) الحلقات
 const rings=`<div class="stk-rgs">${ring(BR.length?ok/BR.length:1,`${BR.length?Math.round(ok/BR.length*100):100}%`,`${fmt(ok)} من ${fmt(BR.length)} فرع`,"فروع بلا أصناف نافدة تُباع",ok/(BR.length||1)>=.7?"#6f7d45":ok/(BR.length||1)>=.4?"#d99a1c":"#c4362b",null,an)}
  ${ring(H.shN?H.shG/H.shN:1,`${H.shN?Math.round(H.shG/H.shN*100):100}%`,`${fmt(H.shG)} من ${fmt(H.shN)} قطعة`,"نواقص الفروع يغطيها المستودع","#8a5a83",["hgo","need"],an)}
  ${ring(top20.length?avail/top20.length:1,`${fmt(avail)}/${fmt(top20.length)}`,"متوفر في المستودع","الأكثر مبيعاً متوفر عندك","#30b0c7",["hgo","buy"],an)}
  ${ring(nNeed?nDone/nNeed:1,`${fmt(nDone)}/${fmt(nNeed)}`,"فرع أنهيته","إنجازك اليوم","#6f7d45",null,an,"يزيد كلما علّمت فرعاً أو أنشأت طلبه")}</div>`;
 // 3) البطاقات الصغيرة
 const mk=(ic,v,l,cls,go)=>`<div class="stk-mk ${cls||""}"${go?` data-sk="${go[0]}" data-t="${go[1]}" role="button" tabindex="0"`:""}><i aria-hidden="true">${ic}</i><div><b data-notr dir="ltr">${v}</b><span>${l}</span></div></div>`;
 const mini=`<div class="stk-mks">${mk("🧺",fmt(PL.need.length),"فرع يحتاج تزويداً","",["hgo","need"])}${mk("⛔",fmt(zeroAll),"صنف نفد وهو يُباع","bad",["hgo","need"])}${mk("🔄",fmt(trp),"قطعة تحويل مقترحة","",["hgo","tr"])}${mk("🛒",fmt(R.rows.length),"كود يحتاج شراء","warn",["hgo","buy"])}</div>`;
 // 4) المبيعات يوماً بيوم
 let chart="";if(H.ser&&H.ser.d.length){const d=H.ser.d,mx=d.reduce((m,x)=>Math.max(m,x[1]),1),sum=d.reduce((a,x)=>a+x[1],0),avg=sum/d.length,best=d.reduce((b,x)=>x[1]>b[1]?x:b,d[0]);
  chart=`<div class="stk-card stk-dch${A}"><div class="chh"><h3>📈 المبيعات يوماً بيوم</h3><small>${dp.P?dp.lb:"آخر 30 يوماً"} · المتوسط <b data-notr>${fmt(avg)}</b> قطعة/يوم · أعلى يوم <b data-notr dir="ltr">${E(dm(best[0]))}</b> (<b data-notr>${fmt(best[1])}</b>)</small></div>${H.ser.ok?"":`<p class="off">⚠️ بعض أيام هذه الفترة لم يُرفع ملف تاريخها.</p>`}<div class="cols" style="--n:${d.length}">${d.map((x,i)=>`<div class="c${x[0]===best[0]?" hi":""}" title="${E(x[0])}: ${fmt(x[1])}"><i style="height:${Math.max(2,Math.round(x[1]/mx*100))}%;animation-delay:${an?i*18:0}ms"></i></div>`).join("")}</div><div class="cx" data-notr dir="ltr"><span>${E(dm(d[0][0]))}</span><span>${E(dm(d[d.length-1][0]))}</span></div></div>`}
 // 5) بطاقات الفروع (+ تفاصيل الفرع المفتوح)
 const can=!X.ro,openB=UI.hx!==undefined&&UI.hx!==""?BR.find(b=>String(b.ti)===String(UI.hx)):null;
 if(UI.hx&&!openB)UI.hx="";
 const bcard=(b,i)=>{const s=stt(b),dn=(b.nb||b.tb)&&bDone(b),on=openB&&openB.ti===b.ti,share=b.sell>0?Math.max(0,1-b.zero/b.sell):1;
  return `<div class="stk-bc ${s}${dn?" dn":""}${on?" on":""}${A}" style="animation-delay:${an?Math.min(i,16)*35:0}ms" data-sk="hbx" data-v="${b.ti}" role="button" tabindex="0" aria-expanded="${on?"true":"false"}">
   <div class="bt1"><span class="rk" data-notr>${i+1}</span><b>${sn(b.ti)}</b>${b.nb||b.tb?`<label class="ck" title="تم"><input type="checkbox" data-hck="b:${b.ti}"${dn?" checked":""} aria-label="تم"></label>`:`<span class="okb">✓</span>`}</div>
   <div class="bt2"><div class="mr"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="b"/><circle cx="60" cy="60" r="52" class="f${A}" style="stroke-dasharray:${RCF.toFixed(1)};stroke-dashoffset:${(RCF*(1-share)).toFixed(1)}"/></svg><em data-notr dir="ltr">${Math.round(share*100)}%</em></div>
   <ul><li><b data-notr>${fmt(b.sold)}</b> باع</li><li class="${b.zero?"z":""}"><b data-notr>${fmt(b.zero)}</b> نفد ويبيعه</li><li><b data-notr>${b.lost>=0.95?fmt(b.lost):b.lost>0?"&lt;1":"0"}</b> يخسر/يوم</li></ul></div>
   <div class="bt3">${b.pcs?`<span class="tg n">📦 <b data-notr>${fmt(b.pcs)}</b> من المستودع</span>`:""}${b.tp?`<span class="tg t">🔄 <b data-notr>${fmt(b.tp)}</b> تحويل</span>`:""}${!b.pcs&&!b.tp?`<span class="tg g">لا شيء مطلوب 👌</span>`:""}</div></div>`};
 let drawer="";if(openB){const hk=UI.hk==="t"&&openB.tb?"t":openB.nb?"n":"t",bb=hk==="t"?openB.tb:openB.nb;
  if(bb&&hk==="n")LASTX={name:"نواقص-"+cd(DATA.st[bb.ti]),head:["الكود","اللون","المقاس","رصيد الفرع","باع","في المستودع","يُرسل له"],rows:()=>srtPri(bb.lines).map(l=>{const x=DATA.k[l.ki];return [x[0],x[1],x[2],l.on,l.sold,l.wh,l.give]}),prn:{ttl:"نواقص فرع "+DATA.st[bb.ti],sub:fmt(bb.n)+" صنف · "+fmt(bb.pcs)+" قطعة من المستودع",ask:1}};
  else if(bb)LASTX={name:"تحويلات-إلى-"+cd(DATA.st[bb.ti]),head:["يأخذ من فرع","الكود","اللون","المقاس","رصيد المُرسِل","باع المُرسِل","رصيد الفرع","باع","الكمية","الثقة"],rows:()=>bb.lines.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.src],x[0],x[1],x[2],l.fon,l.fsold,l.ton,l.tsold,l.n,l.sure?"مؤكد":"راجعه"]}),prn:{ttl:"تحويلات إلى فرع "+DATA.st[bb.ti],sub:fmt(bb.pcs)+" قطعة من "+fmt(bb.srcs)+" فرع",ask:1}};
  drawer=`<div class="stk-card stk-bd${A}" id="stk-bd"><div class="bdh"><h3>${sn(openB.ti)}</h3><div class="stk-seg">${openB.nb?`<button type="button" data-sk="hbk" data-v="n" class="${hk==="n"?"on":""}">📦 نواقص من المستودع <small data-notr>${fmt(openB.nb.n)}</small></button>`:""}${openB.tb?`<button type="button" data-sk="hbk" data-v="t" class="${hk==="t"?"on":""}">🔄 تحويل إليه <small data-notr>${fmt(openB.tb.n)}</small></button>`:""}</div><span class="sp"></span><button class="bt s" type="button" data-sk="hbx" data-v="${openB.ti}">✕ إغلاق</button></div>${bb?(hk==="n"?hDetN(bb,can):hDetT(bb,can)):`<p>لا نواقص ولا تحويلات لهذا الفرع الآن 👌</p>`}</div>`}
 const brs=`<div class="stk-sec"><h3>🏬 الفروع <small>الأحمر أولاً: ابدأ به · الدائرة = نسبة المتوفر عنده من الأصناف التي يبيعها · اضغط الفرع لتفتح أصنافه وتنشئ طلبه</small></h3><div class="stk-bcs">${BR.map(bcard).join("")}</div>${drawer}</div>`;
 // 6) الأكثر والأقل مبيعاً
 const top=S.top.slice(0,10),mx=top.length?top[0].sold:1,md=["🥇","🥈","🥉"];
 const topC=`<div class="stk-card stk-hb${A}"><h3>🏆 الأكثر مبيعاً <small>${dp.lb}</small></h3>${top.length?top.map((a,i)=>`<div class="hbr" style="animation-delay:${an?i*50:0}ms"><span class="m">${md[i]||`<i data-notr>${i+1}</i>`}</span><div class="hbx"><div class="hbt">${cl(a.code)}<small data-notr>${E(vnOf(a.vi)||"")}</small><b data-notr>${fmt(a.sold)}</b></div><div class="tr"><i style="width:${Math.max(3,Math.round(a.sold/mx*100))}%"></i></div>${a.wh<=0?`<small class="z">المستودع خالٍ منه</small>`:`<small>في المستودع <b data-notr>${fmt(a.wh)}</b></small>`}</div></div>`).join(""):`<p>لا مبيعات في هذه الفترة.</p>`}</div>`;
 const low=S.low.slice(0,8),lmx=low.reduce((m,a)=>Math.max(m,a.on+a.wh),1);
 const lowC=`<div class="stk-card stk-hb lw${A}"><h3>🐢 الأقل مبيعاً وعنده رصيد <small>${dp.lb}</small></h3>${low.length?low.map((a,i)=>`<div class="hbr" style="animation-delay:${an?i*50:0}ms"><span class="m">💤</span><div class="hbx"><div class="hbt">${cl(a.code)}<small data-notr>${E(vnOf(a.vi)||"")}</small><b data-notr>${fmt(a.on+a.wh)}</b></div><div class="tr"><i style="width:${Math.max(3,Math.round((a.on+a.wh)/lmx*100))}%"></i></div><small>رصيد <b data-notr>${fmt(a.on+a.wh)}</b> · باع <b data-notr class="${a.sold<=0?"z":""}">${fmt(a.sold)}</b></small></div></div>`).join("")+`<button class="bt s" type="button" data-sk="hgo" data-t="stale">💤 الراكد بالتفصيل</button>`:`<p>لا شيء.</p>`}</div>`;
 // 7) التحويلات المقترحة
 const trC=`<div class="stk-sec"><h3>🔄 تحويلات مقترحة <small>من فرع عنده الصنف ولا يبيعه إلى فرع يبيعه ونفد عنده</small></h3>${H.pairs.length?`<div class="stk-tcs">${H.pairs.slice(0,8).map((p,i)=>`<div class="stk-tc${A}" style="animation-delay:${an?i*40:0}ms" data-sk="hprv" data-f="${E(DATA.st[p.src])}" data-d="${E(DATA.st[p.dst])}" role="button" tabindex="0"><div class="fr">${sn(p.src)}</div><div class="ar"><b data-notr>${fmt(p.pcs)}</b><span>قطعة</span><i aria-hidden="true">←</i></div><div class="to">${sn(p.dst)}</div><small><b data-notr>${fmt(p.n)}</b> صنف${p.sure?` · <span class="ok"><b data-notr>${fmt(p.sure)}</b> مؤكد</span>`:""}</small></div>`).join("")}</div><button class="bt s" type="button" data-sk="hgo" data-t="tr">كل التحويلات (${fmt(H.pairs.length)} زوجاً)</button>`:`<p class="off">لا تحويلات ممكنة الآن 👌</p>`}</div>`;
 // 8) الشراء
 const empty=R.rows.filter(c=>c.wh<=0).sort((p,r)=>r.sold-p.sold).slice(0,8);
 const buyC=empty.length?`<div class="stk-sec"><h3>🛒 يُباع والمستودع خالٍ منه <small>الأعلى مبيعاً أولاً</small></h3><div class="stk-chs">${empty.map(c=>`<a href="#" class="stk-chip" data-sk="code" data-c="${E(c.code)}"><bdi dir="ltr" data-notr>${E(c.code)}</bdi><small>باع <b data-notr>${fmt(c.sold)}</b></small></a>`).join("")}<button class="bt s" type="button" data-sk="hgo" data-t="buy">🛒 قائمة الشراء كاملة (${fmt(R.rows.length)})</button></div></div>`:"";
 const tips=[`فروع بلا أصناف نافدة تُباع: <b>${BR.length?Math.round(ok/BR.length*100):100}%</b> (${fmt(ok)} من ${fmt(BR.length)} فرع).`,`نواقص الفروع يغطيها المستودع: <b>${H.shN?Math.round(H.shG/H.shN*100):100}%</b> (${fmt(H.shG)} من ${fmt(H.shN)} قطعة).`,`الأكثر مبيعاً متوفر في المستودع: <b>${fmt(avail)} من ${fmt(top20.length)}</b> كوداً.`,`الفروع تخسر حوالي <b>${lostAll>=0.95?fmt(lostAll):lostAll>0?"أقل من 1":"0"}</b> قطعة مبيعات يومياً بسبب أصناف نفدت عندها.`].concat(BR[0]&&stt(BR[0])==="bad"?[`ابدأ بفرع ${sn(BR[0].ti)}.`]:[]);
 DASH={dp,S,PL,R,pairs:H.pairs,BR,pv,zeroAll,give,trp,isDone,ok,nNeed,nDone,avail,top20:top20.length,shN:H.shN,shG:H.shG,lostAll,tips};
 if(!openB)LASTX=null;
 return `${hero}${dp.P&&!H.dcov.ok?gapNote(dp.P):""}${rings}${mini}${chart}${brs}<div class="stk-dgrid">${topC}${lowC}</div>${trC}${buyC}`;
}
// 🖨 الملخص بنفس شكل اللوحة على ورقة A4 (احفظه PDF من نافذة الطباعة)
function printDash(){
 const tell=m=>{if(X&&X.toast)X.toast(m)},pa=document.getElementById("pa");if(!pa||!DASH){tell("الطباعة غير متاحة هنا");return}
 const d=DASH,q=META&&META.q,nm=ti=>E(DATA.st[ti]),box=(v,l,c)=>`<div class="pk${c?" "+c:""}"><b>${E(v)}</b><span>${l}</span></div>`;
 const pv=d.pv===null?"":` (${d.pv>0?"+":""}${d.pv}%)`;
 const tr=(cells)=>"<tr>"+cells.map(c=>"<td>"+c+"</td>").join("")+"</tr>";
 const tbl=(h,rows)=>rows.length?`<table class="pt"><thead><tr>${h.map(x=>"<th>"+x+"</th>").join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`:"<p>لا شيء.</p>";
 pa.className="stkp stkd";
 pa.innerHTML=`<div class="ph"><h2>ملخص المخزون اليومي</h2><div><b>تاسومة</b> · تحليل المخزون</div></div>
 <p class="pi">تاريخ الطباعة: ${E(today())}${q&&q.at?" · أرصدة ملف: "+E(dts(q.at)):""} · المبيعات: ${d.dp.lb}</p>
 <div class="pks">${box(fmt(d.S.tot)+pv,"قطعة مباعة","k")}${box(fmt(d.PL.need.length),"فرع يحتاج تزويداً",d.PL.need.length?"w":"")}${box(fmt(d.zeroAll),"صنف نفد ويُباع",d.zeroAll?"r":"")}${box(fmt(d.give),"قطعة يغطيها المستودع")}${box(fmt(d.trp),"قطعة تحويل مقترحة")}${box(fmt(d.R.rows.length),"كود يحتاج شراء")}</div>
 ${(d.tips||[]).length?`<div class="pb"><h3>ما تحتاج معرفته اليوم</h3><ul>${d.tips.map(t=>"<li>"+t.replace(/<(?!\/?(?:b|bdi)\b)[^>]*>/g,"")+"</li>").join("")}</ul></div>`:""}
 <div class="pg2"><div class="pb"><h3>ابدأ بهذه الفروع (نواقص من المستودع)</h3>${tbl(["#","الفرع","نفد ويبيعه","يخسر/يوم","قطع من المستودع","تم"],d.PL.need.slice(0,12).map((b,i)=>tr([i+1,nm(b.ti),fmt(b.zero),lostT(b),fmt(b.pcs),d.isDone("n",b.ti)?"✓":""])))}</div>
 <div class="pb"><h3>تحويلات مقترحة</h3>${tbl(["من","إلى","أصناف","قطع"],d.pairs.slice(0,12).map(p=>tr([nm(p.src),nm(p.dst),fmt(p.n),fmt(p.pcs)])))}</div></div>
 <div class="pg2"><div class="pb"><h3>الأكثر مبيعاً · ${d.dp.lb}</h3>${tbl(["#","الكود","باع","المستودع"],d.S.top.map((a,i)=>tr([i+1,E(a.code),fmt(a.sold),fmt(a.wh)])))}</div>
 <div class="pb"><h3>الأقل مبيعاً وعنده رصيد</h3>${tbl(["الكود","الرصيد","باع"],d.S.low.map(a=>tr([E(a.code),fmt(a.on+a.wh),fmt(a.sold)])))}</div></div>
 <div class="pb"><h3>الفروع: المبيعات والنواقص</h3>${tbl(["الفرع","المبيعات","نفد ويبيعه","يخسر/يوم","من المستودع","تحويل إليه"],d.BR.map(b=>tr([nm(b.ti),fmt(b.sold),fmt(b.zero),b.lost>=0.95?fmt(b.lost):b.lost>0?"&lt;1":"0",fmt(b.pcs),fmt(b.tp)])))}</div>`;
 const off=()=>{pa.className="";window.removeEventListener("afterprint",off)};window.addEventListener("afterprint",off);setTimeout(()=>window.print(),80);
}
const PDIM=[["store","الفرع"],["color","اللون"],["size","المقاس"],["var","اللون والمقاس"]];
const pdName=d=>(PDIM.find(x=>x[0]===d)||["","—"])[1];
/* (v204) 🔍 «تحليل صنف» v3: تقرير يُقرأ من أعلى لأسفل — الحكم على الصنف، ماذا أفعل الآن، اتجاه البيع، أداء كل فرع، المقاسات والألوان، ثم الجدول الحر */
const IVD={hot:["عاجل","bad","يُباع بسرعة والمستودع خالٍ منه أو يكاد"],fast:["سينفد قريباً","warn","يُباع بسرعة، ورصيده كله يكفي أياماً قليلة"],nowh:["المستودع يكاد يخلو","warn","يُباع، وما في المستودع لا يكفي أسبوعاً من بيعه، والباقي في الفروع"],sold:["نفد","bad","بيع كله ولا رصيد منه الآن"],
 ok:["متوازن","good","بيعه ورصيده متناسبان"],slow:["بطيء","warn","رصيده يكفي أكثر من خمسة أشهر بمعدل بيعه"],over:["مخزون زائد","warn","رصيده يكفي أكثر من سنة بمعدل بيعه"],dead:["راكد","bad","له رصيد ولم يُبع منه شيء"],none:["بلا حركة","","لا رصيد ولا مبيعات"]};
const IST={out:["نفد","bad"],low:["ناقص","bad"],idle:["راكد","warn"],over:["زائد","warn"],ok:["متوازن","good"],none:["—",""],wh:["المستودع",""]};
let IRK=null;// ترتيب الأكواد بالمبيعات (كاش لكل بيانات وفترة)
const itemRank=(code,P)=>{const k=(P?P.from+"~"+P.to:"ytd");if(!IRK||IRK.D!==DATA||IRK.k!==k){const R=rankBy(DATA,CFG,{by:"code",period:P}),m=new Map();let n=0;if(R)R.rows.forEach((g,i)=>{if(g.sold>0){m.set(g.k,i+1);n++}});IRK={D:DATA,k,m,n}}return {pos:IRK.m.get(code)||0,of:IRK.n}};
const itemNeed=()=>{const p=period();if(!dHas()||!String(UI.code||"").trim())return p;const e=qEnd(),b={from:addDays(e,-83),to:e};return p?{from:p.from<b.from?p.from:b.from,to:p.to>b.to?p.to:b.to}:b};
const iCov=c=>c==null?"—":c>=999?"999+":fmt(c);
function vItem(){
 const P=period(),code=String(UI.code||"").trim(),ids=code?DATA.code.get(code)||[]:[];
 const cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!UI.cl||DATA.k[k][1]===UI.cl).map(k=>DATA.k[k][2]))].sort((a,b)=>zk(a)-zk(b));
 const bar='<div class="stk-bar"><label>الكود<input type="text" data-sf="code" id="stk-code" list="stk-codes" value="'+E(UI.code)+'" placeholder="اكتب الكود" dir="ltr" autocomplete="off"></label>'+cBtn()+(ids.length?'<label>اللون<select data-sf="cl" id="stk-cl">'+opt(cols,UI.cl,"كل الألوان")+'</select></label><label>المقاس<select data-sf="sz" id="stk-sz">'+opt(szs,UI.sz,"كل المقاسات")+"</select></label>":"")+perSel()+'<span class="sp"></span>'+(ids.length?'<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button>':"")+'</div><datalist id="stk-codes">'+[...DATA.code.keys()].sort().slice(0,3000).map(c=>'<option value="'+E(c)+'">').join("")+"</datalist>";
 if(!code){LASTX=null;const RK=rankBy(DATA,CFG,{by:"code",period:P}),top=RK?RK.rows.slice(0,12):[];
  return bar+'<div class="stk-pan"><div class="stk-em">اكتب كود الصنف ليظهر تقريره: الحكم عليه، وما يُفعل الآن، واتجاه بيعه، وأداء كل فرع، ومقاساته وألوانه.'+(top.length?'<div class="stk-chips" style="justify-content:center;margin-top:14px"><i>الأعلى مبيعاً</i>'+top.map(g=>'<button type="button" data-sk="icode" data-c="'+E(g.k)+'" data-notr dir="ltr">'+E(g.k)+"</button>").join("")+"</div>":"")+"</div></div>"}
 if(!ids.length){LASTX=null;return bar+'<div class="stk-pan"><div class="stk-em">الكود <b data-notr dir="ltr">'+E(code)+"</b> غير موجود في ملف الكميات.</div></div>"}
 const R0=spanR(),dd=x=>x?Math.round((new Date(x.to+"T12:00:00")-new Date(x.from+"T12:00:00"))/864e5)+1:0,days=P?dd(P):dd(R0);
 const R=itemReport(DATA,CFG,code,{cl:UI.cl,z:UI.sz,period:P,days,horizon:UI.bh,alert:UI.ba});if(!R){LASTX=null;return bar+'<div class="stk-pan"><div class="stk-em">لا يوجد هذا اللون أو المقاس لهذا الكود.</div></div>'}
 const I=R.I,V=IVD[R.verdict]||IVD.ok,sub=[UI.cl,UI.sz].filter(Boolean).join(" · "),vnm=I.vendor>=0?DATA.vn[I.vendor]:"",RK=sub?{pos:0,of:0}:itemRank(code,P),per=P?"في الفترة":"من أول السنة";
 const b1=x=>'<b data-notr dir="ltr">'+E(x)+"</b>";
 /* ---- 1) الحكم والخلاصة ---- */
 const top10=RK.pos&&RK.of?RK.pos/RK.of:1,rankTxt=RK.pos?"ترتيبه "+b1(fmt(RK.pos))+" من "+b1(fmt(RK.of))+" كوداً في المبيعات"+(top10<=0.1?" (ضمن أعلى 10%)":top10<=0.25?" (ضمن أعلى الربع)":top10>=0.75?" (ضمن الربع الأضعف)":""):"";
 const sumTxt=I.sold>0?"بيع منه "+b1(fmt(I.sold))+" قطعة "+per+" في "+b1(fmt(I.sell))+" فرعاً"+(I.thru!=null?"، أي "+b1(pct(I.thru))+" مما توفّر":"")+". الباقي "+b1(fmt(I.on))+" قطعة: "+b1(fmt(I.wh))+" في المستودع و"+b1(fmt(I.br))+" في الفروع"+(I.cover!=null?"، تكفي "+b1(iCov(I.cover))+" يوماً بمعدل "+b1(I.rate>=10?fmt(I.rate):String(Math.round(I.rate*10)/10))+" قطعة يومياً":"")+".":"لم يُبع منه شيء "+per+"، ورصيده "+b1(fmt(I.on))+" قطعة: "+b1(fmt(I.wh))+" في المستودع و"+b1(fmt(I.br))+" في الفروع.";
 const hero='<div class="stk-ih"><div class="stk-iht"><h3 data-notr><bdi dir="ltr">'+E(code)+"</bdi>"+(sub?" <small>"+E(sub)+"</small>":"")+'</h3><span class="stk-vd '+V[1]+'">'+V[0]+"</span>"+(vnm?'<small>المورد: <a href="#" data-sk="ivn" data-v="'+E(vnm)+'" style="color:inherit" data-notr>'+E(vnm)+"</a></small>":"")+(P?'<small>الفترة: <span data-notr dir="ltr">'+E(P.from)+" ← "+E(P.to)+"</span></small>":"")+'</div><p class="stk-ihv"><b>'+V[2]+".</b> "+sumTxt+(rankTxt?" "+rankTxt+".":"")+"</p></div>";
 const T=[tile(fmt(I.sold),P?"قطعة مباعة في الفترة":"قطعة مباعة من أول السنة","k"),tile(fmt(I.wh),"في المستودع",I.wh<=0&&I.sold>0?"bad":""),tile(fmt(I.br),"في الفروع"),tile(pct(I.thru),"نسبة ما بيع مما توفّر"),tile(iCov(I.cover),"يوماً يكفي الرصيد (تقريبي)",I.cover!=null&&I.cover<R.buy.AL?"bad":""),tile(fmt(I.sell)+" / "+fmt(R.stores.filter(s=>!s.isWh&&(s.on>0||s.sold>0)).length),"فرع باعه / فرع عنده أو باعه")];
 if(I.rc!=null)T.splice(1,0,tile(fmt(I.rc),"استلمتها الفروع من أول السنة"));
 /* ---- 2) ماذا أفعل الآن ---- */
 const A=[],ac=(cls,num,ttl,txt,btn)=>'<div class="stk-ia '+cls+'"><b class="n" data-notr dir="ltr">'+E(num)+'</b><div><strong>'+ttl+"</strong><span>"+txt+"</span></div>"+btn+"</div>",bt=(sk,t)=>'<button class="bt s" type="button" data-sk="'+sk+'">'+t+"</button>";
 if(R.buy.qty>0)A.push(ac("bad",fmt(R.buy.qty),"اطلب من المورد","قطعة تكفي "+fmt(R.buy.H)+" يوماً بمعدل بيعه"+(I.wh<=0?"، فالمستودع خالٍ منه":"، فرصيده كله يكفي أقل من "+fmt(R.buy.AL)+" يوماً")+(R.unmet.pcs?"، و"+fmt(R.unmet.pcs)+" قطعة ينقصها "+fmt(R.unmet.br)+" فرع بلا مصدر":"")+".",bt("ibuy","🛒 تفاصيل الشراء")));
 if(R.send.pcs>0)A.push(ac("good",fmt(R.send.pcs),"أرسل من المستودع","قطعة إلى "+fmt(R.send.br)+" فرع رصيدها أقل من الحد والمستودع عنده ("+fmt(R.send.lines)+" خانة).",bt("ineed","📋 افتح النواقص")));
 if(R.tr.pcs>0)A.push(ac("good",fmt(R.tr.pcs),"حوّل بين الفروع","قطعة من فروع لا تبيعه إلى فروع نفد عندها ("+fmt(R.tr.lines)+" تحويلاً).",bt("itr","🔄 التحويلات")));
 if(R.pull.pcs>0)A.push(ac("warn",fmt(R.pull.pcs),"راجع الراكد","قطعة في "+fmt(R.pull.br)+" فرع لم تُبع "+per+": تُسحب للمستودع أو تُحوَّل لفرع يبيعها.",bt("istale","💤 الراكد")));
 if(!A.length&&R.unmet.pcs>0)A.push(ac("warn",fmt(R.unmet.pcs),"نقص بلا مصدر","قطعة ينقصها "+fmt(R.unmet.br)+" فرع، والمستودع والفروع الأخرى لا يغطونها بقواعد التحويل الحالية.",bt("ibuy","🛒 الشراء المقترح")));
 const acts='<div class="stk-card stk-iac"><h3>ما يُفعل الآن</h3>'+(A.length?'<div class="stk-ial">'+A.join("")+"</div>":'<p class="stk-iok">لا إجراء مطلوب الآن: لا نقص يغطيه المستودع، ولا تحويل، ولا راكد، ورصيده يكفي.</p>')+"</div>";
 /* ---- 3) اتجاه البيع (أسبوعي) ---- */
 let trend="";if(dHas()){const e=P?P.to:qEnd(),f0=P?P.from:addDays(e,-83),rg={from:f0,to:e},cv=coverage(META,rg),loaded=months(f0,e).every(ym=>!(META.d&&META.d[ym])||DATA.d[ym]);
  if(!loaded)trend='<div class="stk-card"><h3>اتجاه البيع</h3><p class="stk-src">جاري تحميل مبيعات الأيام…</p></div>';
  else{const W=weekSeries(DATA,code,{cl:UI.cl,z:UI.sz,from:f0,to:e})||[],mx=Math.max(1,...W.map(w=>w.sold)),tot=W.reduce((a,w)=>a+w.sold,0),h=Math.floor(W.length/2),l4=W.slice(-Math.min(4,h)).reduce((a,w)=>a+w.sold,0),p4=W.slice(-2*Math.min(4,h),-Math.min(4,h)).reduce((a,w)=>a+w.sold,0),dl=l4-p4,k4=Math.min(4,h);
   const bars=W.map((w,i)=>{const v=Math.max(0,w.sold),hp=Math.max(v>0?3:0,Math.round(v/mx*100)),lab=i===W.length-1||w.sold===mx;return '<div class="stk-wb" title="'+E(w.from)+" ← "+E(w.to)+": "+fmt(w.sold)+' قطعة"><i style="height:'+hp+'%"'+(i===W.length-1?' class="l"':"")+"></i>"+(lab?'<em data-notr>'+fmt(w.sold)+"</em>":"")+"</div>"}).join("");
   trend='<div class="stk-card"><h3>اتجاه البيع أسبوعياً</h3>'+(W.length>1?'<p class="stk-itr">'+(k4>0&&p4+l4>0?"آخر "+fmt(k4)+" أسابيع: "+b1(fmt(l4))+" قطعة مقابل "+b1(fmt(p4))+" في الـ"+fmt(k4)+" قبلها — "+(dl>0?'<span class="up">صاعد '+(p4>0?pct(dl/p4):"")+"</span>":dl<0?'<span class="dn">هابط '+(p4>0?pct(-dl/p4):"")+"</span>":"ثابت")+".":"لا مبيعات في هذه الأسابيع.")+'</p><div class="stk-wk">'+bars+'</div><div class="stk-wkx" data-notr dir="ltr"><span>'+E(W[0].from)+"</span><span>"+E(W[W.length-1].to)+'</span></div><p class="stk-src">'+fmt(W.length)+" أسبوعاً · "+fmt(tot)+" قطعة. كل عمود أسبوع، والأخير هو الأحدث. مرّر على العمود لتاريخه.</p>":'<p class="stk-src">الفترة أقصر من أسبوعين.</p>')+(cv.ok?"":'<p class="stk-src" style="color:#b7791f">ملفات التاريخ لا تغطي هذه الأسابيع كلها، فبعض الأعمدة أقل من الحقيقة.</p>')+"</div>"}}
 /* ---- 4) أداء كل فرع ---- */
 const so=UI.isort||"sold",ordS={out:0,low:1,idle:2,over:3,ok:4,none:5},S=R.stores.slice().sort((p,r)=>(p.isWh?-1:r.isWh?1:0)||(so==="st"?ordS[p.st]-ordS[r.st]:so==="on"?r.on-p.on:0)||r.sold-p.sold||r.on-p.on||(DATA.st[p.ti]<DATA.st[r.ti]?-1:1));
 const mxS=Math.max(1,...S.filter(s=>!s.isWh).map(s=>Math.max(0,s.sold))),sugT=s=>{const a=[];if(s.give>0)a.push("أرسل "+fmt(s.give));if(s.tin>0)a.push("يستقبل "+fmt(s.tin)+" تحويلاً");if(s.tout>0)a.push("يُسحب منه "+fmt(s.tout));else if(s.idlePcs>0)a.push("راكد "+fmt(s.idlePcs));if(s.unmet>0)a.push("ينقصه "+fmt(s.unmet)+" بلا مصدر");return a.join(" · ")};
 const rcOn=I.rc!=null,lim=UI.iall?S.length:13,rowS=s=>{const t=IST[s.st]||IST.ok;return "<tr"+(s.isWh?' class="whr"':"")+"><td>"+(s.isWh?sn(s.ti):'<a href="#" data-sk="hst" data-s="'+E(DATA.st[s.ti])+'" style="color:inherit" title="نواقص هذا الفرع">'+sn(s.ti)+"</a>")+'</td><td><span class="stk-vd s '+t[1]+'">'+t[0]+"</span></td>"+(rcOn?'<td class="n">'+fmt(s.rc)+"</td>":"")+'<td class="n"><b>'+fmt(s.sold)+'</b></td><td class="stk-ibr">'+(s.isWh?"":'<i style="width:'+Math.round(Math.max(0,s.sold)/mxS*100)+'%"></i>')+'</td><td class="n'+(s.on<=0&&s.sold>0?" z":"")+'">'+fmt(s.on)+'</td><td class="n">'+(s.isWh?"—":pct(s.thru))+'</td><td class="n">'+(s.isWh?"—":iCov(s.cover))+'</td><td class="stk-isg">'+E(sugT(s))+"</td></tr>"};
 const seg=(k,v,t)=>'<button type="button" data-sk="'+k+'" data-v="'+v[0]+'" class="'+(v[1]?"on":"")+'">'+t+"</button>";
 const stSum=[["out","نفد عندها وتبيعه"],["low","رصيدها ناقص"],["idle","راكد عندها"],["over","مخزونها زائد"],["ok","متوازنة"]].filter(x=>R.n[x[0]]).map(x=>'<span><b class="stk-vd s '+IST[x[0]][1]+'">'+fmt(R.n[x[0]])+"</b> "+x[1]+"</span>").join("");
 LASTX={name:"تحليل-صنف-"+code,head:["المخزن","الحالة"].concat(rcOn?["استلم من أول السنة"]:[],["المبيعات","الرصيد","نسبة ما بيع","يكفي (يوماً)","أرسل من المستودع","يستقبل تحويلاً","يُسحب منه","راكد","ينقصه بلا مصدر"]),rows:()=>S.map(s=>[DATA.st[s.ti],(IST[s.st]||IST.ok)[0]].concat(rcOn?[s.rc]:[],[s.sold,s.on,s.thru==null?"":Math.round(s.thru*1000)/10+"%",s.cover==null?"":Math.round(s.cover),s.give||"",s.tin||"",s.tout||"",s.idlePcs||"",s.unmet||""])),prn:{ttl:"تحليل صنف "+code+(sub?" ("+sub+")":""),sub:V[0]+" — "+V[2]+(vnm?" · المورد: "+vnm:""),note:P?"الفترة "+P.from+" ← "+P.to:"المبيعات من أول السنة"}};
 const brT='<div class="stk-pan"><h3 class="stk-ph">أداء كل فرع</h3><div class="stk-ist">'+stSum+'</div><div class="stk-bar stk-pvb" style="margin:0 0 8px"><span class="stk-seg" role="tablist" style="margin:0">'+seg("isort",["sold",so==="sold"],"الأكثر بيعاً فوق")+seg("isort",["st",so==="st"],"من نفد عنده فوق")+seg("isort",["on",so==="on"],"الأكثر رصيداً فوق")+'</span><span class="stk-src" style="margin:0">ترتيب السطور فقط، لا يغيّر أي رقم.</span><span style="display:none">'+'</span></div><div class="tw"><table class="stk-t stk-it"><thead><tr><th>الفرع</th><th>الحالة</th>'+(rcOn?'<th class="n">استلم</th>':"")+'<th class="n">باع</th><th></th><th class="n">الرصيد</th><th class="n">نسبة ما بيع</th><th class="n">يكفي (يوماً)</th><th>المقترح</th></tr></thead><tbody>'+S.slice(0,lim).map(rowS).join("")+"</tbody></table></div>"+(S.length>lim?'<button class="bt s stk-more" type="button" data-sk="iall">عرض كل الفروع ('+fmt(S.length-lim)+" أخرى)</button>":"")+'<p class="stk-src" style="margin:8px 4px 0">«نسبة ما بيع» = المبيعات ÷ (المبيعات + الرصيد). «يكفي» = رصيد الفرع ÷ معدل بيعه اليومي. «المقترح» من قواعد النواقص والتحويلات والراكد نفسها. اضغط اسم الفرع لنواقصه.</p></div>';
 /* ---- 5) المقاسات والألوان ---- */
 const szL=I.sizes.filter(x=>x.k!==""),clL=I.colors.filter(x=>x.k!==""),crv=(L,t,w)=>{if(L.length<2)return "";const mx=Math.max(0.0001,...L.map(x=>Math.max(x.ss,x.os)));
  const hot=I.sold>0?L.filter(x=>x.gap>=0.05).sort((p,r)=>r.gap-p.gap)[0]:null,cold=I.sold>0?L.filter(x=>x.gap<=-0.05).sort((p,r)=>p.gap-r.gap)[0]:null;
  return '<div class="stk-card"><h3>'+t+'</h3><p class="stk-itr">'+(hot?w+" "+b1(hot.k)+" يُباع أكثر من رصيده ("+pct(hot.ss)+" من البيع مقابل "+pct(hot.os)+" من الرصيد): قد ينقص. ":"")+(cold?w+" "+b1(cold.k)+" رصيده أكبر من بيعه ("+pct(cold.os)+" من الرصيد مقابل "+pct(cold.ss)+" من البيع).":"")+(!hot&&!cold?"الرصيد موزّع قريباً من البيع.":"")+'</p><div class="stk-crvl"><span><i class="s"></i>نصيبه من البيع</span><span><i class="o"></i>نصيبه من الرصيد</span></div><div class="stk-crv">'+L.slice(0,24).map(x=>'<b data-notr dir="ltr">'+E(x.k||"—")+'</b><div class="bars" title="باع '+fmt(x.sold)+" · رصيده "+fmt(x.on)+'"><i class="s" style="width:'+Math.round(x.ss/mx*100)+'%"></i><i class="o" style="width:'+Math.round(x.os/mx*100)+'%"></i></div><span class="n">'+pct(x.ss)+" · "+pct(x.os)+"</span>").join("")+"</div>"+(L.length>24?'<p class="stk-src">معروض 24 من '+fmt(L.length)+".</p>":"")+"</div>"};
 const C1=UI.sz?"":crv(szL,"المقاسات","المقاس"),C2=UI.cl?"":crv(clL,"الألوان","اللون");
 // خريطة اللون × المقاس
 let heat="";if(!UI.cl&&!UI.sz&&clL.length>1&&szL.length>1&&clL.length<=40){const M=itemPivot(DATA,CFG,code,{period:P,rows:"color",cols:"size"}),hv=UI.ihm==="sold"?"sold":"on",mxh=Math.max(1,...M.rows.map(r=>Math.max(...M.cols.map(c=>{const x=M.cell(r.k,c.k);return x?Math.max(0,x[hv]):0}))));
  heat='<div class="stk-pan"><h3 class="stk-ph">خريطة اللون × المقاس</h3><div class="stk-bar stk-pvb" style="margin:0 0 8px"><span class="stk-seg" role="tablist" style="margin:0">'+seg("ihm",["on",hv==="on"],"الرصيد")+seg("ihm",["sold",hv==="sold"],"المبيعات")+'</span><span class="stk-src" style="margin:0">كلما اغمقّت الخانة زاد الرقم. الإطار الأحمر: بيع منه ورصيده صفر.</span></div><div class="tw"><table class="stk-t stk-hm"><thead><tr><th>اللون</th>'+M.cols.map(c=>'<th class="n" data-notr dir="ltr">'+E(c.k||"—")+"</th>").join("")+'<th class="n">الإجمالي</th></tr></thead><tbody>'+M.rows.map(r=>'<tr><td data-notr dir="ltr">'+E(r.k||"—")+"</td>"+M.cols.map(c=>{const x=M.cell(r.k,c.k),v=x?x[hv]:0,al=v>0?Math.round((0.1+0.7*v/mxh)*100)/100:0,out=x&&x.sold>0&&x.on<=0;return '<td class="n'+(out?" out":"")+(al>0.5?" dk":"")+'" style="background:rgba(138,90,131,'+al+')" title="'+(x?"الرصيد "+fmt(x.on)+" · المبيعات "+fmt(x.sold):"لا شيء")+'">'+(x&&(x.on||x.sold)?fmt(v):"·")+"</td>"}).join("")+'<td class="n t"><b>'+fmt(r[hv])+"</b></td></tr>").join("")+'<tr class="tot"><td>الإجمالي</td>'+M.cols.map(c=>'<td class="n">'+fmt(c[hv])+"</td>").join("")+'<td class="n"><b>'+fmt(M.tot[hv])+"</b></td></tr></tbody></table></div></div>"}
 /* ---- 6) الجدول الحر ---- */
 const pr=UI.pr||"store",pc0=UI.pc===undefined?"size":UI.pc,pc=pc0===pr||(pr==="var"&&(pc0==="color"||pc0==="size"))?"":pc0,pv=UI.pv==="rc"&&!DATA.hasRc?"on":UI.pv||"on";let PVH="";
 if(UI.ipv){const keep=LASTX;PVH=pivotView(code,P,pr,pc,pv);LASTX=keep}
 const adv='<div class="stk-act" style="margin:12px 0"><button class="bt" type="button" data-sk="ipvt">'+(UI.ipv?"إخفاء الجدول الحر":"📊 جدول حر: اختر الصفوف والأعمدة بنفسك")+"</button></div>"+PVH;
 return bar+gapNote(P)+hero+'<div class="stk-tiles">'+T.join("")+"</div>"+acts+(trend||C1||C2?'<div class="stk-up">'+trend+C1+C2+"</div>":"")+brT+heat+adv;
}
// الجدول المحوري للصنف
function pivotView(code,P,pr,pc,pv){
 const M=itemPivot(DATA,CFG,code,{cl:UI.cl,z:UI.sz,period:P,rows:pr,cols:pc});if(!M){LASTX=null;return ""}
 const lab=(d,k)=>d==="store"?sn(k):d==="var"?varL(k):d===""?"الإجمالي":`<span data-notr dir="ltr">${E(k||"—")}</span>`,txt=(d,k)=>d==="store"?DATA.st[k]:d==="var"?DATA.k[k].slice(1,3).join(" "):d===""?"الإجمالي":String(k);
 const val=c=>{if(!c)return "·";const st=c.sold+Math.max(0,c.on)>0&&c.sold>=0?c.sold/(c.sold+Math.max(0,c.on)):null;return pv==="rc"?fmt(c.rc):pv==="sold"?fmt(c.sold):pv==="st"?pct(st):pv==="b"?`<b>${fmt(c.on)}</b><i>${fmt(c.sold)}</i>`:fmt(c.on)};
 // اللون يتبع رقم الخانة نفسه (لا خانة داخلها): يبيع ومجموع رصيده أقل من الحد ← أحمر، مجموع رصيده ≥ حد الراكد ولم يبع ← أصفر. فقط لو أحد البعدين «الفرع»
 const stD=(pr==="store"||pc==="store")&&pv!=="rc",mn0=N(CFG.min),st0=Math.max(1,N(CFG.stale)),exS=exSet(CFG,DATA);
 const cls=(c,isWh,ti)=>!c?"e":isWh?"wh":!stD||exS.has(ti)?"":c.sold>0&&c.on<mn0?"need":c.on>=st0&&c.sold<=0?"idle":"";
 const one=pc==="",colsL=one?[]:M.cols,isWhR=r=>pr==="store"&&r.k===M.wh;
 const optD=(id,cur,none)=>`<select data-sf="${id}" id="stk-${id}">${(none?[["","بلا أعمدة"]]:[]).concat(PDIM).map(x=>`<option value="${x[0]}"${cur===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select>`;
 const ctrl=`<div class="stk-bar stk-pvb"><b class="stk-undt">📊 الجدول المحوري</b><label>الصفوف${optD("pr",pr,false)}</label><label>الأعمدة${optD("pc",pc,true)}</label><label>القيمة<select data-sf="pv" id="stk-pv">${[["on","الرصيد"],["sold","المبيعات"],["b","الرصيد والمبيعات"],["st","نسبة ما بيع"]].concat(DATA.hasRc?[["rc","المستلم من أول السنة"]]:[]).map(x=>`<option value="${x[0]}"${pv===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label><button class="bt s" type="button" data-sk="pswap" title="تبديل الصفوف والأعمدة">⇄ تبديل</button></div>`;
 const head=pv==="b"?(c=>[txt(pc,c.k)+" رصيد",txt(pc,c.k)+" مبيعات"]):(c=>[txt(pc,c.k)]),cv=c=>{if(!c)return pv==="b"?["",""]:[""];const st=c.sold+Math.max(0,c.on)>0&&c.sold>=0?Math.round(c.sold/(c.sold+Math.max(0,c.on))*1000)/10+"%":"";return pv==="b"?[c.on,c.sold]:pv==="rc"?[c.rc]:pv==="sold"?[c.sold]:pv==="st"?[st]:[c.on]};
 LASTX={name:"تحليل-"+code,head:[pdName(pr)].concat(...colsL.map(head)).concat(pv==="b"?["الإجمالي رصيد","الإجمالي مبيعات"]:["الإجمالي"]),rows:()=>M.rows.map(r=>[txt(pr,r.k)].concat(...colsL.map(c=>cv(M.cell(r.k,c.k)))).concat(cv(r))).concat([["الإجمالي"].concat(...colsL.map(c=>cv(c))).concat(cv(Object.assign({},M.tot)))])};
 const leg=`<p class="stk-src" style="margin:4px 4px 10px">${pv==="b"?"في كل خانة: الرصيد وتحته المبيعات. ":""}${stD?`<span class="stk-lg need">أحمر</span> باع منه ورصيده في الخانة أقل من ${fmt(mn0)} · <span class="stk-lg idle">أصفر</span> رصيده ${fmt(st0)} أو أكثر ولم يبع · `:""}<span class="stk-lg wh">رمادي</span> المستودع. لكل لون ومقاس في كل فرع اختر الصفوف «اللون والمقاس» والأعمدة «الفرع».</p>`;
 return `<div class="stk-pan stk-piv">${ctrl}${leg}<div class="tw"><table class="stk-t stk-mx"><thead><tr><th class="s">${pdName(pr)}${one?"":" ⟍ "+pdName(pc)}</th>${colsL.map(c=>`<th>${lab(pc,c.k)}</th>`).join("")}<th>الإجمالي</th></tr></thead><tbody>
 ${M.rows.map(r=>`<tr${isWhR(r)?` class="whr"`:""}><td class="s">${lab(pr,r.k)}</td>${colsL.map(c=>{const x=M.cell(r.k,c.k);return `<td class="${cls(x,isWhR(r)||(pc==="store"&&c.k===M.wh),pr==="store"?r.k:c.k)}">${val(x)}</td>`}).join("")}<td class="t">${val(r)}</td></tr>`).join("")}
 <tr class="tot"><td class="s">الإجمالي</td>${colsL.map(c=>`<td>${val(c)}</td>`).join("")}<td>${val(M.tot)}</td></tr></tbody></table></div></div>`;
}
/* (v276) 📥 قسم «المشتريات»: من ملف المشتريات المرفوع. بكود: كم مرة اشتريناه (المرة = يوم استلام)، أول وآخر شراء، كل مرة بألوانها ومقاساتها.
   بلا كود: كل الأكواد المشتراة في الفترة (الكمية، عدد المرات، آخر شراء) ولكل شهر */
function vPur(){
 const code=String(UI.code||"").trim(),td=today();if(!UI.pf)UI.pf=td.slice(0,4)+"-01-01";if(!UI.pt)UI.pt=td;
 const ids=DATA.code.get(code)||[],cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!UI.cl||DATA.k[k][1]===UI.cl).map(k=>DATA.k[k][2]))].sort((a,b)=>zk(a)-zk(b));
 const bar=`<div class="stk-bar"><label>الكود<input type="text" data-sf="code" id="stk-code" list="stk-codes" value="${E(UI.code)}" placeholder="اكتب الكود أو اتركه لكل الأكواد" dir="ltr" autocomplete="off"></label>${cBtn()}${code?`<label>اللون<select data-sf="cl" id="stk-cl">${opt(cols,UI.cl,"كل الألوان")}</select></label><label>المقاس<select data-sf="sz" id="stk-sz">${opt(szs,UI.sz,"كل المقاسات")}</select></label>`:`<label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label>`}<label>من يوم<input type="date" data-sf="pf" id="stk-pf" value="${E(UI.pf)}"></label><label>إلى يوم<input type="date" data-sf="pt" id="stk-pt" value="${E(UI.pt)}"></label><span class="sp"></span><button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 const rm=rcvMonths();
 if(!rm.length){LASTX=null;return bar+em(`لم يُرفع ملف المشتريات بعد.<br>ارفعه من تبويب «الملفات» (تقرير الكمية المستلمة من المورد بالتاريخ) لتسأل: متى اشترينا الصنف، وكم مرة، ومتى آخر شراء. <button class="bt s" type="button" data-sk="tab" data-t="up">افتح «الملفات»</button>`)}
 if(!(UI.pf<=UI.pt)){LASTX=null;return bar+em("تاريخ البداية بعد تاريخ النهاية.")}
 const miss=months(UI.pf,UI.pt).filter(ym=>rm.indexOf(ym)<0&&ym<=td.slice(0,7)),note=`<div class="stk-rep${miss.length?" w":""}">من ملف المشتريات (الكمية المستلمة من المورد). «المرة» = يوم استلام.${miss.length?` شهور لم يُرفع ملف مشترياتها: <b data-notr dir="ltr">${E(miss.join("، "))}</b>.`:""}</div>`;
 const R=purchLog(DATA,{code,cl:code?UI.cl:"",z:code?UI.sz:"",vendor:code?"":UI.vn,from:UI.pf,to:UI.pt});
 if(!R){LASTX=null;return bar+em(code?`الكود <b data-notr dir="ltr">${E(code)}</b> غير موجود في ملف الكميات.`:"لا بيانات بهذه الشروط.")}
 const dl=d=>`<bdi data-notr dir="ltr">${E(d||"—")}</bdi>`,ago=d=>d?Math.max(0,Math.round((new Date(td+"T12:00:00")-new Date(d+"T12:00:00"))/864e5)):null;
 const ms=Object.keys(R.byM).sort(),mmx=Math.max(1,...ms.map(m=>R.byM[m])),mon=ms.length?ms.map(m=>`<div class="stk-day"><span data-notr>${m}</span><i style="width:${Math.round(R.byM[m]/mmx*62)}%"></i><b>${fmt(R.byM[m])}</b></div>`).join(""):"<p>لا مشتريات في الفترة.</p>";
 if(code){
  const K=codeCard(DATA,CFG,code,{cl:UI.cl,z:UI.sz}),a=ago(R.last),vn=ids.length&&DATA.k[ids[0]][3]>=0?DATA.vn[DATA.k[ids[0]][3]]||"":"";
  LASTX={name:"مشتريات-"+code,head:["التاريخ","اللون","المقاس","المخزن","الكمية"],rows:()=>{const o=[];R.dates.forEach(e=>e.it.forEach(x=>o.push([e.d,DATA.k[x[0]][1],DATA.k[x[0]][2],DATA.st[x[1]],x[2]])));return o},prn:{ttl:"مشتريات الكود "+code,sub:UI.pf+" → "+UI.pt}};
  const T=[tile(fmt(R.q),R.ret?"قطعة اشتريناها (الصافي بعد المرتجع)":"قطعة اشتريناها في الفترة","k"),tile(fmt(R.times),"مرة شراء (يوم استلام)","k"),tile(R.last||"—",R.last?"آخر شراء"+(a!=null?" · منذ "+fmt(a)+" يوماً":""):"لم نشترِه في الفترة"),tile(R.first||"—","أول شراء في الفترة")];
  if(R.ret)T.push(tile(fmt(R.ret),"قطعة مرتجعة للمورد","bad"));if(R.times)T.push(tile(fmt((R.q+R.ret)/R.times),"متوسط الكمية في المرة"));if(K)T.push(tile(fmt(K.wh),"في المستودع الآن"),tile(fmt(K.br),"في الفروع الآن"),tile(fmt(K.allSold),"بيع من أول السنة"));
  const rows=R.dates.map(e=>{const op=UI.pxd===e.d;return `<tr class="stk-pdr${op?" on":""}"><td>${dl(e.d)}${e.p<=0?" <small>مرتجع للمورد</small>":""}</td><td class="n${e.q<0?" z":""}"><b>${fmt(e.q)}</b></td><td class="n">${fmt(e.it.length)}</td><td><button class="bt s" type="button" data-sk="pxd" data-d="${E(e.d)}">${op?"إخفاء":"التفاصيل"}</button></td></tr>`+(op?`<tr><td colspan="4" style="padding:0 8px 10px"><table class="stk-t"><thead><tr><th>اللون والمقاس</th><th>المخزن</th><th class="n">الكمية</th></tr></thead><tbody>${e.it.slice().sort((x,y)=>cmpK(DATA.k[x[0]],DATA.k[y[0]])).map(x=>`<tr><td>${varL(x[0])}</td><td>${sn(x[1])}</td><td class="n">${fmt(x[2])}</td></tr>`).join("")}</tbody></table></td></tr>`:"")}).join("");
  return bar+note+`<div class="stk-ttl"><h3>📥 مشتريات <bdi dir="ltr" data-notr>${E(code)}</bdi>${UI.cl||UI.sz?` <small data-notr>${E([UI.cl,UI.sz].filter(Boolean).join(" · "))}</small>`:""}</h3>${vn?`<small>المورد: <bdi data-notr>${E(vn)}</bdi></small>`:""}</div><div class="stk-tiles">${T.join("")}</div>
  <div class="stk-act"><button class="bt" type="button" data-sk="tab" data-t="sales">📅 مبيعات هذا الكود</button><button class="bt" type="button" data-sk="tab" data-t="item">🔍 تحليل الصنف</button></div>
  ${R.times?`<div class="stk-up"><div class="stk-card"><h3>كل مرة شراء (${fmt(R.times)})</h3><table class="stk-t"><thead><tr><th>التاريخ</th><th class="n">الكمية</th><th class="n">ألوان ومقاسات</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="stk-card"><h3>لكل شهر</h3>${mon}<h3 style="margin-top:14px">لكل لون ومقاس</h3><table class="stk-t"><thead><tr><th>اللون والمقاس</th><th class="n">الكمية</th><th class="n">مرات</th><th class="n">آخر شراء</th></tr></thead><tbody>${R.vars.slice(0,80).map(v=>`<tr><td>${varL(v.k)}</td><td class="n"><b>${fmt(v.q)}</b></td><td class="n">${fmt(v.times)}</td><td class="n">${dl(v.last)}</td></tr>`).join("")}</tbody></table></div></div>`:em("لم نشترِ هذا الكود في الفترة المختارة. وسّع الفترة أو تأكد أن ملف المشتريات يغطيها.")}`}
 const srt=UI.psort==="last"?(x,y)=>(x.last<y.last?1:x.last>y.last?-1:y.q-x.q):UI.psort==="times"?(x,y)=>y.times-x.times||y.q-x.q:(x,y)=>y.q-x.q,L=R.codes.slice().sort(srt),vnm=c=>c.vi>=0?DATA.vn[c.vi]||"":"";
 LASTX={name:"مشتريات-"+UI.pf+"-"+UI.pt,head:["الكود","المورد","الكمية","عدد المرات","أول شراء","آخر شراء"],rows:()=>L.map(c=>[c.k,vnm(c),c.q,c.times,c.first,c.last]),prn:{ttl:"المشتريات",sub:UI.pf+" → "+UI.pt}};
 const T=[tile(fmt(R.q),R.ret?"قطعة اشتريناها (الصافي بعد المرتجع)":"قطعة اشتريناها في الفترة","k"),tile(fmt(R.codes.length),"كود اشترينا منه","k"),tile(fmt(R.times),"يوم استلام"),tile(R.last||"—","آخر يوم استلام")];if(R.ret)T.push(tile(fmt(R.ret),"قطعة مرتجعة للمورد","bad"));
 return bar+note+`<div class="stk-tiles">${T.join("")}</div>
 <div class="stk-up"><div class="stk-card"><h3>الأكواد المشتراة (${fmt(L.length)})</h3><div class="stk-bar" style="margin:0 0 8px"><label>رتّب حسب<select data-sf="psort" id="stk-psort"><option value="q"${!UI.psort||UI.psort==="q"?" selected":""}>الأكثر كمية</option><option value="last"${UI.psort==="last"?" selected":""}>الأحدث شراءً</option><option value="times"${UI.psort==="times"?" selected":""}>الأكثر مرات</option></select></label></div>
 ${L.length?`<div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>المورد</th><th class="n">الكمية</th><th class="n">مرات</th><th class="n">آخر شراء</th></tr></thead><tbody>${L.slice(0,100).map(c=>`<tr><td><a href="#" data-sk="icode" data-c="${E(c.k)}" style="color:inherit" data-notr dir="ltr">${E(c.k)}</a></td><td data-notr>${E(vnm(c))}</td><td class="n"><b>${fmt(c.q)}</b></td><td class="n">${fmt(c.times)}</td><td class="n">${dl(c.last)}</td></tr>`).join("")}</tbody></table></div>${L.length>100?`<p class="stk-src">معروض 100 من ${fmt(L.length)}. القائمة كلها في «إكسل».</p>`:""}`:"<p>لا مشتريات في الفترة.</p>"}</div>
 <div class="stk-card"><h3>لكل شهر</h3>${mon}<h3 style="margin-top:14px">آخر أيام الاستلام</h3>${R.dates.slice(0,12).map(e=>`<div class="stk-day"><span data-notr>${e.d}</span><b>${fmt(e.q)}</b><small style="color:var(--mut)">${fmt(e.n)} سطر</small></div>`).join("")}</div></div>`;
}
/* (v277) 💰 قسم «مبيعات الفروع بالريال»: يُحمَّل عند أول فتح فقط، ولمن له الصلاحية (X.sv) */
let VALM=null,VALR=[],VALS=0;// VALS: 0 لم تُحمَّل، 1 جاري التحميل، 2 تمت، 3 فشل
async function valLoad(quiet){
 if(VALS===1||!X)return;VALS=1;
 try{const fb=await FB(),m=await fb.getDoc(fb.doc(X.db,"stkv","meta"));VALM=m.exists()?m.data():null;const rows=[];
  for(const y of Object.keys(VALM&&VALM.y||{}).sort()){const s=await fb.getDoc(fb.doc(X.db,"stkv","y"+y));if(s.exists())valUnpack(JSON.parse(await gun(String(s.data().z||"")))).forEach(x=>rows.push(x))}
  VALR=rows;VALS=2}catch(e){VALS=3}
 if(!quiet)paint()}
async function saveV(R){
 if(VALS!==2)await valLoad(true);if(VALS!==2)throw new Error("valload");
 const fb=await FB(),from=R.from||R.days[0],to=R.from?addDays(R.to,-1):R.days[R.days.length-1],all=valMerge(VALR,R.rows,from,to),meta=Object.assign({v:1,y:{}},VALM||{});meta.y=Object.assign({},meta.y);
 const ys=[];for(let y=+from.slice(0,4);y<=+to.slice(0,4)&&ys.length<6;y++)ys.push(String(y));
 const keep=all.filter(x=>ys.indexOf(x.d.slice(0,4))<0);
 for(const y of ys){const p=valPack(y,all),z=await gz(p);if(z.length>900000)throw new Error("valbig");const rows=valUnpack(JSON.parse(p));
  await fb.setDoc(fb.doc(X.db,"stkv","y"+y),{v:1,z,at:Date.now()});
  const a=y+"-01-01">from?y+"-01-01":from,b=y+"-12-31"<to?y+"-12-31":to,pm=meta.y[y]||{};let t=0;rows.forEach(x=>{t+=x.a;keep.push(x)});
  meta.y[y]={n:rows.length,tot:r2(t),cv:cvDates(pm.cv,a,b,d=>addDays(d,1)),at:Date.now()}}
 meta.at=Date.now();meta.by=by();await fb.setDoc(fb.doc(X.db,"stkv","meta"),meta);VALM=meta;VALR=keep;return {from,to}}
const valLast=()=>{let l="";for(const x of VALR)if(x.d>l)l=x.d;return l};
function vVal(){
 const upB=`<button class="bt s" type="button" data-sk="tab" data-t="up">افتح «الملفات»</button>`,wait=`<div class="stk-busy">جاري تحميل مبيعات الفروع…</div>`;
 if(!X.sv){LASTX=null;return em("هذا القسم يحتاج صلاحية «مبيعات الفروع بالريال» من جدول الصلاحيات.")}
 if(VALS===0){valLoad();return wait}if(VALS===1)return wait;
 if(VALS===3){LASTX=null;return em(`تعذّرت قراءة مبيعات الفروع بالريال. تأكد من الإنترنت ومن لصق القواعد الجديدة. <button class="bt s" type="button" data-sk="vretry">أعد المحاولة</button>`)}
 if(!VALR.length){LASTX=null;return em(`لم يُرفع ملف قيمة المبيعات بعد.<br>ارفع من تبويب «الملفات» تقرير Power BI الذي أعمدته: السنة والشهر واليوم، الفرع، و<b data-notr dir="ltr">Net Sales WoTax</b>. ${X.ro?"":upB}`)}
 const last=valLast();if(!UI.vf)UI.vf=last.slice(0,7)+"-01";if(!UI.vt)UI.vt=last;
 const sts=[...new Set(VALR.map(x=>x.s))].sort(),st=sts.indexOf(UI.vs)>=0?UI.vs:"";
 const bar=`<div class="stk-bar"><label>الفرع<select data-sf="vs" id="stk-vs">${opt(sts,st,"كل الفروع")}</select></label><label>من يوم<input type="date" data-sf="vf" id="stk-vf" value="${E(UI.vf)}"></label><label>إلى يوم<input type="date" data-sf="vt" id="stk-vt" value="${E(UI.vt)}"></label><button class="bt s" type="button" data-sk="vq" data-v="m">هذا الشهر</button><button class="bt s" type="button" data-sk="vq" data-v="pm">الشهر الماضي</button><button class="bt s" type="button" data-sk="vq" data-v="y">من أول السنة</button><span class="sp"></span><button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>`;
 if(!(UI.vf<=UI.vt)){LASTX=null;return bar+em("تاريخ البداية بعد تاريخ النهاية.")}
 const S=valStats(VALR,{from:UI.vf,to:UI.vt,store:st}),len=Math.round((new Date(UI.vt+"T12:00:00")-new Date(UI.vf+"T12:00:00"))/864e5)+1,P=valStats(VALR,{from:addDays(UI.vf,-len),to:addDays(UI.vf,-1),store:st});
 const chg=P.total>0&&P.days.length>=S.days.length*0.8&&S.days.length?(S.total-P.total)/P.total:null,dl=d=>`<bdi data-notr dir="ltr">${E(d)}</bdi>`,nm=s=>`<bdi dir="ltr" data-notr>${E(s)}</bdi>`;
 const src=`<div class="stk-rep">صافي المبيعات بالريال بلا ضريبة وبعد المرتجع، من ملف قيمة المبيعات المرفوع. آخر يوم في البيانات: ${dl(last)}.${UI.vt>last?" الفترة المختارة تمتد بعد آخر يوم مرفوع.":""}</div>`;
 if(!S.n){LASTX=null;return bar+src+em("لا مبيعات مرفوعة في هذه الفترة.")}
 const T=[tile(fmt(S.total),"ريال · صافي المبيعات","k"),tile(fmt(S.avg),"ريال · متوسط اليوم"),tile(fmt(S.byDay[S.best]),"ريال · أعلى يوم ("+S.best+")"),tile(fmt(S.days.length),"يوم فيه مبيعات")];
 if(chg!=null)T.push(tile((chg>=0?"+":"")+(Math.round(chg*1000)/10)+"%","مقابل الـ"+fmt(len)+" يوماً السابقة",chg<0?"bad":""));if(!st&&S.stores.length)T.push(tile(S.stores[0].s,"الأعلى مبيعاً"));
 const byD=S.days.length<=62,keys=byD?S.days:S.months,src2=byD?S.byDay:S.byM,mx=Math.max(1,...keys.map(k=>Math.abs(src2[k]))),bars=keys.map(k=>`<div class="stk-day"><span data-notr>${k}</span><i class="${src2[k]<0?"m":""}" style="width:${Math.round(Math.abs(src2[k])/mx*58)}%"></i><b>${fmt(src2[k])}</b></div>`).join("");
 const mt=S.months.length>1?`<div class="stk-card" style="margin-top:12px"><h3>${st?"لكل شهر":"الفرع × الشهر"}</h3><div class="tw"><table class="stk-t"><thead><tr><th>الفرع</th>${S.months.map(m=>`<th class="n" data-notr>${m}</th>`).join("")}<th class="n">المجموع</th></tr></thead><tbody>${S.stores.map(e=>`<tr><td>${nm(e.s)}</td>${S.months.map(m=>`<td class="n">${e.m[m]?fmt(e.m[m]):""}</td>`).join("")}<td class="n"><b>${fmt(e.a)}</b></td></tr>`).join("")}${S.stores.length>1?`<tr><td><b>المجموع</b></td>${S.months.map(m=>`<td class="n"><b>${fmt(S.byM[m])}</b></td>`).join("")}<td class="n"><b>${fmt(S.total)}</b></td></tr>`:""}</tbody></table></div></div>`:"";
 LASTX={name:"مبيعات-الفروع-بالريال-"+UI.vf+"-"+UI.vt,head:["الفرع"].concat(S.months,["المجموع","أيام البيع","متوسط اليوم"]),rows:()=>S.stores.map(e=>[e.s].concat(S.months.map(m=>r2(e.m[m]||0)),[r2(e.a),e.days,e.days?r2(e.a/e.days):0])).concat(st?[["",""],["اليوم","المبيعات"]].concat(S.days.map(d=>[d,r2(S.byDay[d])])):[]),prn:{ttl:"مبيعات الفروع بالريال"+(st?" · "+st:""),sub:UI.vf+" → "+UI.vt}};
 return bar+src+`<div class="stk-tiles">${T.join("")}</div>
 <div class="stk-up"><div class="stk-card"><h3>${st?nm(st):"ترتيب الفروع"}</h3><div class="tw"><table class="stk-t"><thead><tr><th class="n">#</th><th>الفرع</th><th class="n">المبيعات</th><th class="n">النصيب</th><th class="n">متوسط اليوم</th></tr></thead><tbody>${S.stores.map((e,i)=>`<tr><td class="n rk">${i+1}</td><td><a href="#" data-sk="vst" data-v="${E(e.s)}" style="color:inherit">${nm(e.s)}</a></td><td class="n"><b>${fmt(e.a)}</b></td><td class="n">${S.total>0?pct(e.a/S.total):""}</td><td class="n">${e.days?fmt(e.a/e.days):""}</td></tr>`).join("")}</tbody></table></div>${st?`<div class="stk-act"><button class="bt s" type="button" data-sk="vst" data-v="">عرض كل الفروع</button></div>`:`<p class="stk-src">اضغط اسم فرع لترى أيامه وحده.</p>`}</div>
 <div class="stk-card"><h3>${byD?"يوماً بيوم":"شهراً بشهر"}</h3>${bars}</div></div>${mt}`;
}
function vSales(){
 const code=String(UI.code||"").trim(),end=META&&META.q&&META.q.to?addDays(META.q.to,-1):today();if(!UI.from)UI.from=addDays(end,-29);if(!UI.to)UI.to=end;
 const ids=DATA.code.get(code)||[],cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!UI.cl||DATA.k[k][1]===UI.cl).map(k=>DATA.k[k][2]))].sort((a,b)=>zk(a)-zk(b));
 const bar=`<div class="stk-bar"><label>الكود<input type="text" data-sf="code" id="stk-code" list="stk-codes" value="${E(UI.code)}" placeholder="اكتب الكود" dir="ltr" autocomplete="off"></label>${cBtn()}<label>اللون<select data-sf="cl" id="stk-cl">${opt(cols,UI.cl,"كل الألوان")}</select></label><label>المقاس<select data-sf="sz" id="stk-sz">${opt(szs,UI.sz,"كل المقاسات")}</select></label><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(0),UI.st,"كل الفروع")}</select></label><label>من يوم<input type="date" data-sf="from" id="stk-from" value="${E(UI.from)}"></label><label>إلى يوم<input type="date" data-sf="to" id="stk-to" value="${E(UI.to)}"></label><span class="sp"></span><button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div><datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 if(!dHas()){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">لم يُرفع ملف التاريخ بعد.<br>ارفعه من تبويب «الملفات» لتسأل: كم بيع من الكود في فرع من يوم إلى يوم.</div></div>`}
 if(!(UI.from<=UI.to)){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">تاريخ البداية بعد تاريخ النهاية.</div></div>`}
 const P={from:UI.from,to:UI.to},dayBars=(by,ds,mx)=>ds.length?ds.map(d=>`<div class="stk-day"><span data-notr>${d}</span><i class="${by[d]<0?"m":""}" style="width:${Math.round(Math.abs(by[d])/mx*62)}%"></i><b>${fmt(by[d])}</b></div>`).join(""):`<p>لا مبيعات في الفترة.</p>`;
 if(!code){// (v276) بلا كود: مبيعات الفترة كلها (الفروع والأكواد الأكثر مبيعاً ويوماً بيوم)
  const O=salesOverview(DATA,{from:UI.from,to:UI.to,store:UI.st,vendor:UI.vn});if(!O){LASTX=null;return bar+em("لا بيانات بهذه الشروط.")}
  const ds=Object.keys(O.byDay).sort(),mx=Math.max(1,...ds.map(d=>Math.abs(O.byDay[d]))),ss=Object.keys(O.bySt).map(Number).sort((a,b)=>O.bySt[b]-O.bySt[a]),best=ds.slice().sort((a,b)=>O.byDay[b]-O.byDay[a])[0];
  LASTX={name:"مبيعات-"+UI.from+"-"+UI.to,head:["الكود","الكمية"],rows:()=>O.codes.map(c=>[c.k,c.q]).concat([["",""],["الفرع","الكمية"]]).concat(ss.map(t=>[DATA.st[t],O.bySt[t]])),prn:{ttl:"المبيعات",sub:UI.from+" → "+UI.to}};
  return bar+`<div class="stk-bar"><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><span class="stk-src" style="margin:0">اكتب كوداً في الأعلى لترى مبيعاته وحده، أو اضغط أي كود في الجدول.</span></div>`+gapNote(P)+`<div class="stk-sum"><span><b>${fmt(O.total)}</b>قطعة مباعة (الصافي)</span>${O.ret?`<span><b>${fmt(O.ret)}</b>مرتجع</span>`:""}<span><b>${ds.length}</b>يوم فيه حركة</span><span><b>${ds.length?fmt(O.total/ds.length):0}</b>متوسط اليوم</span>${best?`<span><b data-notr>${fmt(O.byDay[best])}</b>أعلى يوم (<bdi data-notr dir="ltr">${E(best)}</bdi>)</span>`:""}<span><b>${fmt(O.codes.filter(c=>c.q>0).length)}</b>كود بيع منه</span></div>
  <div class="stk-up"><div class="stk-card"><h3>الأكواد الأكثر مبيعاً</h3>${O.codes.length?`<table class="stk-t"><thead><tr><th class="n">#</th><th>الكود</th><th class="n">الكمية</th><th class="n">النصيب</th></tr></thead><tbody>${O.codes.slice(0,40).map((c,i)=>`<tr><td class="n rk">${i+1}</td><td><a href="#" data-sk="icode" data-c="${E(c.k)}" style="color:inherit" data-notr dir="ltr">${E(c.k)}</a></td><td class="n"><b>${fmt(c.q)}</b></td><td class="n">${O.total>0?pct(c.q/O.total):""}</td></tr>`).join("")}</tbody></table>${O.codes.length>40?`<p class="stk-src">معروض 40 من ${fmt(O.codes.length)}. القائمة كلها في «إكسل».</p>`:""}`:`<p>لا مبيعات في الفترة.</p>`}</div>
  <div class="stk-card"><h3>حسب الفرع</h3>${ss.length?`<table class="stk-t"><tbody>${ss.map(t=>`<tr><td>${sn(t)}</td><td class="n"><b>${fmt(O.bySt[t])}</b></td><td class="n">${O.total?Math.round(O.bySt[t]/O.total*100)+"%":""}</td></tr>`).join("")}</tbody></table>`:`<p>لا مبيعات في الفترة.</p>`}</div></div>
  <div class="stk-card" style="margin-top:12px"><h3>يوماً بيوم</h3>${dayBars(O.byDay,ds,mx)}</div>`}
 const R=salesQuery(DATA,{code,cl:UI.cl,z:UI.sz,store:UI.st,from:UI.from,to:UI.to});
 if(!R){LASTX=null;return bar+`<div class="stk-pan"><div class="stk-em">الكود <b data-notr dir="ltr">${E(code)}</b> غير موجود.</div></div>`}
 const PB=rcvMonths().length?purchLog(DATA,{code,cl:UI.cl,z:UI.sz,from:UI.from,to:UI.to}):null;
 const days=Object.keys(R.byDay).sort(),mx=Math.max(1,...days.map(d=>Math.abs(R.byDay[d]))),sts=Object.keys(R.bySt).map(Number).sort((a,b)=>R.bySt[b]-R.bySt[a]),ks=Object.keys(R.byK).map(Number).sort((a,b)=>R.byK[b]-R.byK[a]);
 LASTX={name:"مبيعات-"+code+"-"+UI.from+"-"+UI.to,head:["اليوم","الكمية"],rows:()=>days.map(d=>[d,R.byDay[d]]).concat([["",""],["الفرع","الكمية"]]).concat(sts.map(t=>[DATA.st[t],R.bySt[t]]))};
 return bar+gapNote(P)+`<div class="stk-sum"><span><b>${fmt(R.total)}</b>قطعة مباعة (الصافي)</span>${R.ret?`<span><b>${fmt(R.ret)}</b>مرتجع</span>`:""}<span><b>${days.length}</b>يوم فيه حركة</span><span><b>${sts.length}</b>فرع</span>${days.length?`<span><b data-notr dir="ltr">${E(days[0])}</b>أول بيع في الفترة</span><span><b data-notr dir="ltr">${E(days[days.length-1])}</b>آخر بيع في الفترة</span>`:""}${PB?`<span><b>${fmt(PB.q)}</b>اشتريناه في نفس الفترة</span>`:""}</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="tab" data-t="pur">📥 مشتريات هذا الكود</button><button class="bt" type="button" data-sk="tab" data-t="item">🔍 تحليل الصنف</button></div>
 <div class="stk-up"><div class="stk-card"><h3>حسب الفرع</h3>${sts.length?`<table class="stk-t"><tbody>${sts.map(t=>`<tr><td>${sn(t)}</td><td class="n"><b>${R.bySt[t]}</b></td><td class="n">${R.total?Math.round(R.bySt[t]/R.total*100)+"%":""}</td></tr>`).join("")}</tbody></table>`:`<p>لا مبيعات في الفترة.</p>`}
 ${ks.length>1?`<h3 style="margin-top:14px">حسب اللون والمقاس</h3><table class="stk-t"><tbody>${ks.slice(0,40).map(k=>`<tr><td data-notr>${E(DATA.k[k][1]||"—")} · ${E(DATA.k[k][2]||"—")}</td><td class="n"><b>${R.byK[k]}</b></td></tr>`).join("")}</tbody></table>`:""}</div>
 <div class="stk-card"><h3>يوماً بيوم</h3>${days.length?days.map(d=>`<div class="stk-day"><span data-notr>${d}</span><i class="${R.byDay[d]<0?"m":""}" style="width:${Math.round(Math.abs(R.byDay[d])/mx*62)}%"></i><b>${R.byDay[d]}</b></div>`).join(""):`<p>لا مبيعات في الفترة.</p>`}</div></div>`;
}
// (v248) سطر يشرح أثر ملف المشتريات على الراكد
function staleRcvNote(L){
 const f=freshOf(CFG);if(!f)return "";const RR=rcvRange(),rm=rcvMonths();
 if(!rm.length)return `<div class="stk-rep w">لم يُرفع ملف مشتريات بعد، فقد يظهر هنا صنف وصل الفرع حديثاً ولم يأخذ وقته ليُباع. ارفع ملف المشتريات من «الملفات» ليُستثنى ما استُلم خلال آخر <b data-notr>${fmt(f)}</b> يوماً.</div>`;
 const c=RR?months(RR.from,RR.to).filter(ym=>!(META.d[ym]&&Array.isArray(META.d[ym].rv)&&META.d[ym].rv.length)):[];
 return `<div class="stk-rep${c.length?" w":""}">📥 استُبعد <b data-notr>${fmt(L.fresh||0)}</b> سطراً (<b data-notr>${fmt(L.freshQ||0)}</b> قطعة) لأنه صنف جديد: استلمه المستودع أو الفرع خلال آخر <b data-notr>${fmt(f)}</b> يوماً (من ملف المشتريات)${c.length?`. ⚠️ ملف المشتريات لا يغطي: <b data-notr dir="ltr">${E(c.join("، "))}</b>`:""}.</div>`;
}
function vStale(){
 const P=period(),L=focL(stale(DATA,CFG,{store:UI.st,vendor:UI.vn,min:UI.son,period:P,q:UI.q}),l=>DATA.k[l.ki][0],l=>vnOf(l.vi));
 LASTX={name:"الراكد",head:["الفرع","الكود","اللون","المقاس","المورد","الرصيد","المبيعات"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.vi>=0?DATA.vn[l.vi]:"",l.on,l.sold]})};
 return focBar()+`<div class="stk-bar"><label>الفرع<select data-sf="st" id="stk-st">${opt(stores(1),UI.st,"كل الفروع")}</select></label><label>المورد<select data-sf="vn" id="stk-vn">${opt(vendors(),UI.vn,"كل الموردين")}</select></label><label>بحث بالكود<input type="search" data-sf="q" id="stk-q" value="${E(UI.q)}" placeholder="مثلاً 13016" dir="ltr"></label><label>الرصيد من<input type="number" min="1" max="9999" data-sf="son" id="stk-son" value="${E(UI.son)}" placeholder="${E(CFG.stale)}"></label>${perSel()}<span class="sp"></span>${fclr("st,vn,q,son")}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${gapNote(P)}
 <div class="stk-sum"><span><b>${fmt(L.length)}</b>سطر راكد</span><span><b>${fmt(L.reduce((s,l)=>s+l.on,0))}</b>قطعة</span></div>
 ${staleRcvNote(L)}
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr>${UI.st?"":"<th>الفرع</th>"}<th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">الرصيد</th><th class="n">المبيعات</th></tr></thead><tbody>${L.slice(0,UI.lim).map(l=>`<tr${foCls(l)}>${UI.st?"":`<td>${sn(l.ti)}</td>`}${kCells(l.ki)}<td class="n"><b>${l.on}</b></td><td class="n">${l.sold}</td></tr>`).join("")}</tbody></table></div>${more(L.length)}</div>`:`<div class="stk-pan"><div class="stk-em">لا أصناف راكدة بهذه الشروط.</div></div>`}`;
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
 <p style="margin-top:10px">${DATA.hasRc?"عمود «المستلم» مقروء من ملف الكميات (من أول السنة حتى يوم التقرير) ويظهر في «اسأل» و«تحليل صنف». للعرض فقط: لا يدخل في حساب النواقص أو التحويلات أو الشراء.":"ملف الكميات المرفوع ليس فيه عمود استلام صالح لكل فرع، فلا يُعرض «المستلم»."}</p></div></div>`:"";
 const pub=has?`<div class="stk-card"><h3>📤 النشر للفروع</h3><p>تشاهد الفروع وهي تكتب ورقة النواقص هل الصنف «متوفر» أو «كمية قليلة» أو «غير متوفر» في المستودع (بلا أرقام)، ولكل فرع «طلب مقترح» بالأصناف التي رصيده منها أقل من الحد وكانت تُباع عنده. يُنشر تلقائياً مع كل ملف كميات ومع حفظ القواعد.</p>
 <div class="stk-day"><span style="width:auto;flex:1;direction:rtl">آخر نشر</span><b data-notr>${PUB&&PUB.at?E(new Date(N(PUB.at)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):"لم يُنشر بعد"}</b></div>
 <button class="bt p" type="button" data-sk="pub" style="margin-top:8px">📤 انشر للفروع الآن</button></div>`:"";
 const drop=X.ro?`<div class="stk-rep">صلاحيتك في هذا القسم للمشاهدة والتحليل. رفع الملفات والنشر للفروع وتعديل القواعد للأدمن ومالك النظام.</div>`:pub+tabCard()+`<label class="stk-drop" id="stk-drop"><input type="file" id="stk-file" accept=".xlsx,.csv" multiple><b>⬆️ ارفع ملفات اليوم</b><small>اختر ملف الكميات وملف التاريخ وملف المشتريات معاً (أو اسحبها هنا). المنصة تتعرّف على كل ملف من أعمدته وتربط بينها.</small></label>`;
 return `${drop}
 ${REP.map(r=>`<div class="stk-rep ${r.kind==="g"?"g":r.kind==="w"?"w":"r"}">${r.f?`<b data-notr>${E(r.f)}</b> — `:""}${E(r.t)}</div>`).join("")}
 <div class="stk-up"><div class="stk-card"><h3>📦 ملف الكميات</h3>${q?`<p>آخر رفع: <b data-notr dir="ltr">${dts(q.at)}</b>${q.src?` · <span data-notr>${E(q.src)}</span>`:""}</p><p>${fmt(q.rows)} سطر · ${fmt(q.skus)} صنف (كود ولون ومقاس)</p><p>الرصيد ${fmt(q.on)} قطعة · المبيعات ${fmt(q.sold)} قطعة${q.from?` · من <span data-notr dir="ltr">${E(q.from)}</span> إلى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه <b data-notr>OH_QTY</b> (الكمية) بلا تاريخ.</p>`}</div>
 <div class="stk-card"><h3>📅 ملف التاريخ</h3>${yms.length?`<p>${yms.length} شهر محفوظ · ${fmt(dsold)} قطعة مباعة${q?` · يغطي <b>${cov}%</b> من مبيعات ملف الكميات`:""}</p>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه السنة والشهر واليوم بلا كمية.</p>`}
 <div class="stk-mo">${need.map(ym=>d[ym]?`<span data-notr title="${fmt(d[ym].n)} · ${N(d[ym].dmin)}–${N(d[ym].dmax)}">${ym} ✓</span>`:`<span class="x" data-notr>${ym}</span>`).join("")}</div>
 <p style="margin-top:10px">Power BI يقطع التصدير عند 150 ألف سطر. نزّل ملف التاريخ على فترات (شهر أو شهرين) وارفعها كلها مرة واحدة للتأسيس، ثم يكفي كل يوم ملف الشهر الحالي: كل ملف يستبدل أيام فترته فقط.</p></div>
 ${X.sv?`<div class="stk-card"><h3>💰 ملف قيمة المبيعات (بالريال)</h3><p>تقرير Power BI الذي أعمدته: السنة والشهر واليوم، الفرع، و<b data-notr dir="ltr">Net Sales WoTax</b> (بلا أكواد). ارفعه هنا مع باقي الملفات، وكل ملف يستبدل أيام فترته فقط. يظهر في قسم «مبيعات الفروع بالريال» لمن له صلاحيتها.</p>${VALM&&VALM.y?`<div class="stk-mo">${Object.keys(VALM.y).sort().map(y=>`<span data-notr>${E(y)} · ${fmt(N(VALM.y[y].tot))} ✓</span>`).join("")}</div>`:""}</div>`:""}${(()=>{const rm=rcvMonths(),tq=rm.reduce((s,ym)=>s+N(d[ym].rq),0);return `<div class="stk-card"><h3>📥 ملف المشتريات</h3>${rm.length?`<p>${rm.length} شهر · ${fmt(tq)} قطعة مستلمة</p><div class="stk-mo">${rm.map(ym=>`<span data-notr title="${E(d[ym].rv.map(x=>x[0]+"–"+x[1]).join(", "))}">${ym} ✓</span>`).join("")}</div>`:`<p>لم يُرفع بعد. هو التقرير الذي فيه الكود واللون والمقاس والمخزن و<b data-notr>RCVD_QTY</b> (الكمية المستلمة) والتاريخ، بلا مبيعات.</p>`}<p style="margin-top:10px">يُستخدم ليُستثنى من «الراكد» في كل الفروع ما استلمه المستودع (أو الفرع) خلال آخر ${fmt(freshOf(CFG))} يوماً. كل ملف يستبدل استلام أيام فترته فقط ولا يلمس المبيعات.</p></div>`})()}</div>${chk}`;
}
function vCfg(){
 const row=(k,t,s,mn)=>`<div class="f"><div><b>${t}</b><small>${s}</small></div><input type="number" min="${mn}" max="9999" data-cf="${k}" id="stk-c-${k}" value="${E(CFG[k])}"></div>`;
 return `<div class="stk-card stk-cfg"><h3>⚙ قواعد التحليل</h3><p>تُطبَّق على كل التبويبات، وتُحفظ لك ولملّاك النظام.</p>
 ${row("min","حد النواقص","الفرع يحتاج تزويداً لو رصيده من الصنف أقل من هذا الرقم.",1)}
 ${row("keep","أقل كمية تبقى عند الفرع المسحوب منه","عند اقتراح التحويل لا يُسحب من الفرع ما ينزل رصيده عن هذا الرقم.",0)}
 ${row("slow","الفرع «لا يبيع» لو مبيعاته لا تزيد على","يُسحب فقط من فرع مبيعاته من الصنف في الفترة لا تزيد على هذا الرقم (صفر = لم يبع شيئاً).",0)}
 ${row("stale","حد الراكد","الصنف راكد في الفرع لو رصيده هذا الرقم أو أكثر ولم يبع.",1)}
 <div class="f"><div><b>أيام التغطية</b><small>الكمية المقترحة للفرع = ما يكفيه هذا العدد من الأيام بمعدل بيعه للصنف، ولا تقل عن حد النواقص، ولا تزيد على رصيد المستودع. صفر = إكمال الحد فقط (كما كان).</small></div><input type="number" min="0" max="365" data-cv="1" id="stk-c-cov" value="${covOf(CFG)}"></div>
 <div class="f"><div><b>الصنف المستلم حديثاً ليس راكداً (يوماً)</b><small>من ملف المشتريات: صنف (كود ولون ومقاس) استلمه المستودع من المورد أو استلمه الفرع خلال هذا العدد من الأيام لا يظهر في «الراكد» في أي فرع حتى لو لم يبع بعد. صفر = بلا استثناء.</small></div><input type="number" min="0" max="365" data-frs="1" id="stk-c-fr" value="${freshOf(CFG)}"></div>
 <div class="f"><div><b>ترتيب أولوية الأكواد في النواقص</b><small>الأكواد التي تبدأ بهذه الأرقام تظهر أولاً بهذا الترتيب داخل كل فرع في «نواقص الفروع» و«خطة اليوم»، ثم باقي الأكواد. افصل بينها بفاصلة. اتركها فارغة للترتيب العادي بالكود.</small></div><input type="text" data-pr="1" id="stk-c-pri" dir="ltr" autocomplete="off" maxlength="300" value="${E(priList(CFG).join(", "))}" style="max-width:340px;height:42px"></div>
 <div class="f"><div><b>مخزن المستودع</b><small>المخزن الذي تُحسب منه النواقص.</small></div><select data-cf="wh" id="stk-c-wh" style="height:42px;max-width:220px">${DATA.st.slice().sort().map(s=>`<option data-notr${s===CFG.wh?" selected":""}>${E(s)}</option>`).join("")}</select></div>
 <div class="f"><div><b>مخازن خارج التحليل</b><small>لا تظهر في النواقص ولا يُسحب منها ولا يُرسل إليها.</small><div class="stk-chk" style="margin-top:8px">${DATA.st.filter(s=>s!==CFG.wh).sort().map(s=>`<label data-notr><input type="checkbox" data-cx="${E(s)}"${(CFG.ex||[]).indexOf(s)>=0?" checked":""}>${E(s)}</label>`).join("")}</div></div></div>
 <div class="f"><div><b>حدود خاصة</b><small>حد نواقص مختلف لمورد أو لكود بعينه (مثلاً 20 لمورد معيّن). الكود يغلب المورد.</small>
 <div style="margin-top:8px">${(CFG.ov||[]).map((o,i)=>o.t==="a"||o.t==="cov"||o.t==="pri"||o.t==="fr"?"":`<div class="stk-day"><span style="width:auto" data-notr>${o.t==="c"?"كود":"مورد"}: ${E(o.k)}</span><b>أقل من ${N(o.min)}</b><button class="bt s" type="button" data-sk="ovx" data-i="${i}">حذف</button></div>`).join("")||`<small>لا حدود خاصة.</small>`}</div>
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
const askCtx=()=>({stores:DATA.st,codes:DATA.code,k:DATA.k,vendors:DATA.vn,alias:(CFG.ov||[]).filter(o=>o&&o.t==="a"),today:today(),end:qEnd(),wh:CFG.wh});
const askP=()=>{const a=UI.a;return a&&a.per==="c"&&a.from&&a.to&&a.from<=a.to?{from:a.from,to:a.to}:null};
// الفترة التي يحتاج الجواب شهورها من ملفات التاريخ: الفترة المحددة، أو السنة كلها لصنف (أيام البيع وآخر بيع)
// (السنة كلها تُحمَّل فقط لو ملفات التاريخ تغطيها كاملة؛ وإلا فأيام البيع لا تُعرض أصلاً حتى لا يظهر رقم ناقص)
const yearR=()=>{const R=dHas()?fullR():null;return R&&coverage(META,R).ok?R:null};
const askB=()=>{const a=UI.a,b=a&&a.cmp&&a.cmp.b;return b&&b.from&&b.to&&b.from<=b.to?b:null};// الفترة التي تُقارن بها
const askNeed=()=>{const a=UI.a;if(!a||!DATA||!DATA.has)return null;const P=askP(),B=askB();if(P&&B)return {from:P.from<B.from?P.from:B.from,to:P.to>B.to?P.to:B.to};const K=kindA(a);if(K==="p")return buyR(a);return P||(K==="c"?yearR():null)};
// نوع الجواب من حقول السؤال الحالية (بعد أي تعديل من الشريط): x مقارنة، r ترتيب، w مين عنده، v مورد، c صنف، s فرع
function kindA(a){if(!a)return "";const c=a.cmp;if(c&&((c.st&&c.st.length>1)||(c.a&&c.b)||(c.codes&&c.codes.length>1)))return "x";if(a.rank)return "r";if(a.buy)return "p";if(a.need&&(a.code||a.store||a.vendor))return "n";if(a.stale)return "st";if(a.where&&a.code&&!a.store)return "w";if(a.vgrp&&a.vgrp.length&&!a.vendor&&!a.code&&!((a.zs&&a.zs.length)||(a.cls&&a.cls.length)))return "vg";if(!a.code&&((a.zs&&a.zs.length)||(a.cls&&a.cls.length)))return "z";if(a.vendor&&!a.code)return "v";return a.code?"c":a.store?"s":""}
const hGet=()=>{try{const a=JSON.parse(localStorage.getItem("stk_ask")||"[]");return Array.isArray(a)?a.filter(x=>typeof x==="string"&&x).slice(0,8):[]}catch(e){return []}};
const hAdd=q=>{try{localStorage.setItem("stk_ask",JSON.stringify([q].concat(hGet().filter(x=>x!==q)).slice(0,8)))}catch(e){}};
function doAsk(q){q=String(q||"").trim().slice(0,200);UI.aq=q;UI.lim=200;if(!q||!DATA||!DATA.has){UI.a=null;paint(false);return}
 const L=lexLoad();UI.a=parseAsk(q,askCtx());UI.a.q2="";hAdd(q);// (v212) القاموس اتشال: السؤال يُفهم كما كُتب
 // (v196) عدّاد التكرار + سجل ما لم يُفهم (على الجهاز)
 const e=L.f[q]||(L.f[q]={n:0,at:0});e.n=N(e.n)+1;e.at=Date.now();lexSave();const fk=askFailK(UI.a);if(fk)lexLogQ(q,fk);paint(false)}
let EXC=null;// أمثلة من بيانات الملف نفسه (أعلى كود وأعلى فرع مبيعاً)
/* (v196) 📖 «اسأل» تتعلّم من المستخدم: قاموسه الخاص (كلمة أو عبارة ← معناها)، أسئلته المثبّتة والمتكررة، وسجل ما لم يُفهم.
   كله على الجهاز (localStorage.stk_lex). القاموس يستبدل العبارة بنص تفهمه القواعد الثابتة قبل الفهم، فالحساب نفسه لا يتغيّر */
// معانٍ جاهزة: [المفتاح، ما يظهر للمستخدم، النص الذي تفهمه القواعد]
export const LEX_MEAN=[["top","الأكثر (ترتيب من الأعلى)","اكثر"],["low","الأقل (ترتيب من الأقل)","اقل"],["sold","المبيعات / مبيعاً","مبيعا"],["on","الرصيد / رصيداً","رصيدا"],["rc","المستلم / استلم","استلم"],["who","مين عنده الصنف","مين عنده"],["cmp","قارن","قارن"],
 ["d7","آخر 7 أيام","اخر 7 يوم"],["d30","آخر 30 يوماً","اخر 30 يوم"],["d60","آخر 60 يوماً","اخر 60 يوم"],["m0","الشهر الحالي","الشهر ده"],["m1","الشهر الماضي","الشهر اللي فات"],["td","اليوم","اليوم"],["yd","أمس","امس"],["codes","أكواد","اكواد"],["stores","فروع","فروع"],["vendors","موردين","موردين"]];
// يستبدل عبارات القاموس (مطابقة كلمات كاملة بعد توحيد الحروف، الأطول أولاً) ويبقي باقي السؤال كما هو
export function lexApply(q,dict){
 const W=String(q||"").split(/\s+/).filter(Boolean);if(!W.length||!dict||!dict.length)return W.join(" ");const NW=W.map(normAr);
 const D=dict.map(e=>({k:normAr(e.w).split(/\s+/).filter(Boolean),r:String(e.r||"")})).filter(e=>e.k.length).sort((a,b)=>b.k.length-a.k.length),out=[];
 for(let i=0;i<W.length;){let hit=null;for(const e of D){if(i+e.k.length>W.length)continue;let ok=true;for(let j=0;j<e.k.length;j++)if(NW[i+j]!==e.k[j]){ok=false;break}if(ok){hit=e;break}}
  if(hit){if(hit.r)out.push(hit.r);i+=hit.k.length}else{out.push(W[i]);i++}}
 return out.join(" ");
}
let LEX=null;
// (v197) القاموس والسجل والمثبّتة صارت مشتركة في القاعدة (stk/lex) لكل من يفتح له القسم؛ النسخة على الجهاز كاش واحتياط. عدّاد التكرار (f) يبقى شخصياً على الجهاز
const lexLoad=()=>{if(LEX)return LEX;let o=null;try{o=JSON.parse(localStorage.getItem("stk_lex")||"null")}catch(e){}o=o&&typeof o==="object"?o:{};
 const f=o.f&&typeof o.f==="object"?o.f:{};
 LEX={d:Array.isArray(o.d)?o.d.filter(e=>e&&typeof e.w==="string"&&typeof e.r==="string"):[],f,u:Array.isArray(o.u)?o.u.filter(e=>e&&typeof e.w==="string"):[],p:Array.isArray(o.p)?o.p.filter(x=>typeof x==="string"):Object.keys(f).filter(k=>f[k]&&f[k].pin),open:false};lexTrim(LEX);return LEX};
const lexTrim=T=>{const S=(v,n)=>String(v==null?"":v).slice(0,n);
 T.d=(Array.isArray(T.d)?T.d:[]).filter(e=>e&&typeof e.w==="string"&&e.w.trim()).slice(0,300).map(e=>({w:S(e.w,40),r:S(e.r,80),l:S(e.l,90),t:S(e.t,8)}));
 /* (v211) u فيها نوعان: كلمة لم تُفهم {w,q,at}، وسؤال كامل {w:"",q,at,k,n} (k: q لم يُفهم، p فُهم جزئياً، s سؤال كتبه المستخدم ليتعلّمه) */
 const U0=(Array.isArray(T.u)?T.u:[]).filter(e=>e&&typeof e.w==="string"),QS=U0.filter(e=>!e.w&&typeof e.q==="string"&&e.q.trim()).slice(0,60).map(e=>({w:"",q:S(e.q,200),at:N(e.at),k:e.k==="s"||e.k==="p"?e.k:"q",n:S(e.n,40)}));
 T.u=QS.concat(U0.filter(e=>e.w).slice(0,100-QS.length).map(e=>({w:S(e.w,40),q:S(e.q,120),at:N(e.at)})));
 T.p=(Array.isArray(T.p)?T.p:[]).filter(x=>typeof x==="string"&&x).slice(0,60).map(x=>S(x,200));return T};
// تعديل مشترك: يُطبَّق على الجهاز فوراً، ثم يُقرأ ما في القاعدة ويُطبَّق عليه نفس التعديل ويُحفظ (فلا يمسح أحد ما علّمه غيره)
let LEXQ=Promise.resolve(),LEXW=true;
function lexDb(mut){
 const L=lexLoad();mut(L);lexTrim(L);lexSave();if(!X||!X.db)return LEXQ;
 LEXQ=LEXQ.then(async()=>{try{const fb=await FB(),ref=fb.doc(X.db,"stk","lex"),s=await fb.getDoc(ref),R=s.exists()?s.data():{},T=lexTrim({d:R.d,u:R.u,p:R.p});mut(T);lexTrim(T);
   await fb.setDoc(ref,{d:T.d,u:T.u,p:T.p,at:Date.now(),by:by().e});L.d=T.d;L.u=T.u;L.p=T.p;lexSave();try{localStorage.setItem("stk_lex_sync","1")}catch(e){}LEXW=true;paint()}
  catch(e){if(LEXW&&X&&X.toast)X.toast("تعذّر حفظ القاموس للجميع، فبقي على هذا الجهاز فقط. تأكد من لصق القواعد الجديدة.");LEXW=false}});
 return LEXQ}
// عند فتح القسم: ما في القاعدة هو المرجع. أول مرة فقط يُرفع ما كان محفوظاً على هذا الجهاز قبل التحديث
function lexFromDb(R){
 const L=lexLoad();let first=false;try{first=localStorage.getItem("stk_lex_sync")!=="1"}catch(e){}
 const T=lexTrim({d:R&&R.d,u:R&&R.u,p:R&&R.p}),mine={d:L.d.slice(),p:L.p.slice()};
 const missD=mine.d.filter(e=>!T.d.some(x=>normAr(x.w)===normAr(e.w))),missP=mine.p.filter(q=>T.p.indexOf(q)<0);
 L.d=T.d;L.u=T.u;L.p=T.p;lexSave();
 if(first&&(missD.length||missP.length))lexDb(Z=>{missD.forEach(e=>{if(!Z.d.some(x=>normAr(x.w)===normAr(e.w)))Z.d.push(e)});missP.forEach(q=>{if(Z.p.indexOf(q)<0)Z.p.push(q)})});
 else{try{localStorage.setItem("stk_lex_sync","1")}catch(e){}}}
// كلمات لم تُفهم: تُجمع ثم تُكتب في القاعدة دفعة واحدة بعد ثوانٍ (لا كتابة مع كل سؤال)
let LEXP=[],LEXPT=0;
const lexLogUnk=(words,q)=>{const L=lexLoad();let add=0;words.forEach(w=>{const k=normAr(w);if(k.length<2||lexKnown(w)||L.u.some(x=>normAr(x.w)===k)||LEXP.some(x=>normAr(x.w)===k))return;LEXP.push({w:String(w).slice(0,40),q:String(q).slice(0,120),at:Date.now()});add++});
 if(!add)return;clearTimeout(LEXPT);LEXPT=setTimeout(()=>{const P=LEXP;LEXP=[];if(P.length)lexDb(T=>{P.forEach(e=>{const k=normAr(e.w);if(!T.u.some(x=>normAr(x.w)===k)&&!T.d.some(x=>normAr(x.w)===k))T.u.unshift(e)})})},4000)};
// (v211) نوع فشل السؤال: q لم يُفهم شيء أو بقيت كلمة غير مفهومة، p فُهم وبقيت كلمات لم تُستعمل، "" فُهم كله
export const askFailK=a=>!a?"q":!a.kind||(a.unk&&a.unk.length)?"q":a.left&&a.left.length?"p":"";
let LQP=[],LQPT=0;
const lqHas=(L,q)=>{const k=normAr(q);return L.u.some(x=>!x.w&&normAr(x.q)===k)};
const lexLogQ=(q,k)=>{q=String(q||"").trim().replace(/\s+/g," ").slice(0,200);if(q.length<2)return;const L=lexLoad(),nk=normAr(q);if(lqHas(L,q)||LQP.some(x=>normAr(x.q)===nk))return;
 LQP.push({w:"",q,at:Date.now(),k,n:by().n});clearTimeout(LQPT);LQPT=setTimeout(()=>{const P=LQP;LQP=[];if(P.length)lexDb(T=>{P.forEach(e=>{if(!T.u.some(x=>!x.w&&normAr(x.q)===normAr(e.q)))T.u.unshift(e)})})},k==="s"?0:4000)};
const lexSave=()=>{try{const ks=Object.keys(LEX.f);if(ks.length>80)ks.sort((a,b)=>(LEX.f[b].pin?1e15:0)+N(LEX.f[b].at)-((LEX.f[a].pin?1e15:0)+N(LEX.f[a].at))).slice(80).forEach(k=>{delete LEX.f[k]});localStorage.setItem("stk_lex",JSON.stringify({d:LEX.d,f:LEX.f,u:LEX.u,p:LEX.p}))}catch(e){}};
const lexKnown=w=>{const k=normAr(w);return lexLoad().d.some(e=>{const n=normAr(e.w);return n===k||n.split(/\s+/).indexOf(k)>=0})};// كلمة عُلِّمت وحدها أو ضمن عبارة
const lexTypes=[["store","فرع"],["vendor","مورد"],["code","كود"],["mean","معنى جاهز"],["skip","تجاهلها (كلمة زائدة)"]];
function lexForm(){
 const x=UI.lx;if(!x)return "";const t=x.t||"store";let val="";
 if(t==="store")val='<label>الفرع<select data-lx="v" id="stk-lxv">'+opt(stores(0),x.v,"اختر الفرع…")+"</select></label>";
 else if(t==="vendor")val='<label>المورد<select data-lx="v" id="stk-lxv">'+opt(vendors(),x.v,"اختر المورد…")+"</select></label>";
 else if(t==="code")val='<label>الكود<input type="text" data-lx="v" id="stk-lxv" dir="ltr" autocomplete="off" value="'+E(x.v||"")+'" placeholder="13016"></label>';
 else if(t==="mean")val='<label>المعنى<select data-lx="v" id="stk-lxv"><option value="">اختر المعنى…</option>'+LEX_MEAN.map(m=>'<option value="'+m[0]+'"'+(x.v===m[0]?" selected":"")+">"+m[1]+"</option>").join("")+"</select></label>";
 return '<div class="stk-lxf"><b>📖 علّمني</b><label>ما تكتبه أنت (كلمة أو عبارة)<input type="text" data-lx="w" id="stk-lxw" value="'+E(x.w||"")+'" maxlength="40" autocomplete="off"></label><label>تعني<select data-lx="t" id="stk-lxt">'+lexTypes.map(a=>'<option value="'+a[0]+'"'+(t===a[0]?" selected":"")+">"+a[1]+"</option>").join("")+"</select></label>"+val+'<button class="bt p s" type="button" data-sk="lxs">حفظ</button><button class="bt s" type="button" data-sk="lxx">إلغاء</button><small class="off">بعد الحفظ أفهمها في كل سؤال، بأي طريقة يُكتب بها باقي السؤال، ولكل من يفتح «تحليل المخزون».</small></div>'}
function lexBox(){
 const L=lexLoad(),q=String(UI.aq||"").trim(),F=L.f,pins=L.p.slice(0,14),freq=Object.keys(F).filter(k=>F[k]&&L.p.indexOf(k)<0&&N(F[k].n)>=3).sort((a,b)=>N(F[b].n)-N(F[a].n)).slice(0,6);
 const ch=x=>'<button type="button" data-sk="ex" data-x="'+E(x)+'" data-notr>'+E(x)+"</button>";
 let h="";if(q&&UI.a&&askFailK(UI.a)==="q")h+='<p class="stk-lqn">📝 سجّلتُ هذا السؤال في «أسئلة تنتظر التعليم» ليتعلّمه فريق المنصة.</p>';
 if(pins.length)h+='<div class="stk-chips"><i>⭐ المثبّتة</i>'+pins.map(x=>ch(x)+'<button type="button" class="stk-lxu" data-sk="lxup" data-x="'+E(x)+'" title="إلغاء التثبيت" aria-label="إلغاء التثبيت">✕</button>').join("")+"</div>";
 if(freq.length)h+='<div class="stk-chips"><i>تسألها كثيراً</i>'+freq.map(ch).join("")+"</div>";
 h+='<div class="stk-act" style="margin:10px 0 0">'+(q?'<button class="bt s" type="button" data-sk="lxp">'+(L.p.indexOf(q)>=0?"إلغاء تثبيت هذا السؤال":"⭐ ثبّت هذا السؤال")+"</button>":"")+lqBtn(L)+"</div>"+lqPanel(L);
 return h;
}
/* (v211) 📝 «أسئلة تنتظر التعليم»: ما لم يُفهم يُسجَّل وحده، ويكتب المستخدم أي سؤال يتوقعه، ثم ينسخ القائمة ويرسلها لفريق المنصة */
const lqList=L=>L.u.filter(e=>!e.w&&e.q).map(e=>{let ok=false;try{const a=parseAsk(e.q,askCtx());ok=!askFailK(a)}catch(x){}return Object.assign({ok},e)});
const LQK={q:["❓","لم تُفهم"],p:["◐","فُهمت جزئياً"],s:["💡","سؤال مقترح"]};
function lqBtn(L){const n=L.u.filter(e=>!e.w&&e.q).length;return '<button class="bt s" type="button" data-sk="lqo">📝 أسئلة تنتظر التعليم ('+fmt(n)+")</button>"}
function lqPanel(L){
 if(!L.qo)return "";const Q=lqList(L),pend=Q.filter(e=>!e.ok),dd=t=>{if(!t)return "";const d=new Date(t);return d.getDate()+"/"+(d.getMonth()+1)};
 return '<div class="stk-lqp"><p class="stk-src">اكتب هنا أي سؤال تتوقع أن يُسأل، والمنصة تسجّل وحدها كل سؤال لم تفهمه. ثم اضغط «انسخ القائمة» وأرسلها لفريق المنصة ليعلّمها إياها. القائمة مشتركة لكل من يفتح «تحليل المخزون».</p>'
  +'<div class="stk-askb"><input type="text" id="stk-lqa" maxlength="200" autocomplete="off" placeholder="مثال: أكثر مقاس مبيعاً في الأحذية الشهر ده"><button class="bt p" type="button" data-sk="lqa">أضف السؤال</button></div>'
  +(Q.length?'<ul class="stk-lql">'+Q.map(e=>{const K=e.ok?["✅","أصبحتُ أفهمه"]:LQK[e.k]||LQK.q;return '<li'+(e.ok?' class="ok"':"")+'><span class="stk-lqk">'+K[0]+" "+K[1]+'</span><b data-notr>'+E(e.q)+'</b><small>'+(e.n?'<bdi data-notr>'+E(e.n)+"</bdi> · ":"")+dd(e.at)+'</small><span class="stk-lqb"><button class="bt s" type="button" data-sk="ex" data-x="'+E(e.q)+'">جرّب</button><button class="bt s" type="button" data-sk="lqd" data-x="'+E(e.q)+'" title="حذف" aria-label="حذف">✕</button></span></li>'}).join("")+"</ul>"
   :'<p class="stk-src">لا توجد أسئلة بعد.</p>')
  +'<div class="stk-act">'+(pend.length?'<button class="bt p s" type="button" data-sk="lqc">📋 انسخ القائمة لإرسالها ('+fmt(pend.length)+")</button>":"")+(Q.length>pend.length?'<button class="bt s" type="button" data-sk="lqk">🧹 امسح ما أصبحتُ أفهمه ('+fmt(Q.length-pend.length)+")</button>":"")+(Q.length?'<button class="bt s" type="button" data-sk="lqx">🗑 مسح الكل</button>':"")+"</div></div>"}
function lqCopy(){
 const L=lexLoad(),P=lqList(L).filter(e=>!e.ok);if(!P.length){if(X.toast)X.toast("لا أسئلة تنتظر التعليم");return}
 const txt="أسئلة «اسأل» التي تحتاج تعليماً ("+P.length+") — "+today()+"\n"+P.map((e,i)=>(i+1)+") "+e.q+"   ["+(LQK[e.k]||LQK.q)[1]+(e.n?" · "+e.n:"")+"]").join("\n");
 const done=()=>{if(X.toast)X.toast("✅ نُسخت القائمة، الصقها في رسالة لفريق المنصة")},fb=()=>{try{const ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();done()}catch(x){if(X.toast)X.toast("تعذّر النسخ")}};
 try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,fb);else fb()}catch(x){fb()}}
function lqAdd(){const el=g("stk-lqa"),q=String(el&&el.value||"").trim().replace(/\s+/g," ").slice(0,200);if(q.length<2){if(X.toast)X.toast("اكتب السؤال أولاً");return}
 if(lqHas(lexLoad(),q)){if(X.toast)X.toast("هذا السؤال موجود في القائمة");return}lexLogQ(q,"s");lexLoad().u.unshift({w:"",q,at:Date.now(),k:"s",n:by().n});if(X.toast)X.toast("✅ أُضيف السؤال");paint(false);const e2=g("stk-lqa");if(e2)e2.focus()}
function lexSaveForm(){
 const x=UI.lx,L=lexLoad();if(!x)return;const w=String(x.w||"").trim().replace(/\s+/g," ").slice(0,40),t=x.t||"store";let r="",l="";
 if(!w){if(X.toast)X.toast("اكتب الكلمة أو العبارة");return}
 if(t==="store"){if(!x.v||!DATA.sti.has(x.v)){if(X.toast)X.toast("اختر الفرع");return}r=x.v;l=x.v}
 else if(t==="vendor"){if(!x.v||DATA.vn.indexOf(x.v)<0){if(X.toast)X.toast("اختر المورد");return}r=x.v;l="المورد "+x.v}
 else if(t==="code"){const c=String(x.v||"").trim(),cc=DATA.code.has(c)?c:DATA.code.has(c.toUpperCase())?c.toUpperCase():"";if(!cc){if(X.toast)X.toast("الكود غير موجود في ملف الكميات");return}r=cc;l="الكود "+cc}
 else if(t==="mean"){const m=LEX_MEAN.find(a=>a[0]===x.v);if(!m){if(X.toast)X.toast("اختر المعنى");return}r=m[2];l=m[1]}
 else{r="";l=""}
 const k=normAr(w);lexDb(T=>{T.d=T.d.filter(e=>normAr(e.w)!==k);T.d.unshift({w,r,l,t});T.u=T.u.filter(e=>normAr(e.w)!==k)});UI.lx=null;
 if(X.toast)X.toast("✅ تعلّمتُ «"+w+"»");if(UI.aq)doAsk(UI.aq);else paint(false)}
function askEx(en){
 if(!EXC||EXC.D!==DATA){const bc=new Map(),bs={},wh=DATA.sti.get(CFG.wh);DATA.q.forEach((a,ki)=>{if(!a)return;const c=DATA.k[ki][0];for(let j=0;j<a.length;j+=4){bc.set(c,(bc.get(c)||0)+a[j+2]);if(a[j]!==wh)bs[a[j]]=(bs[a[j]]||0)+a[j+2]}});
  let c="",cm=-1;bc.forEach((v,k)=>{if(v>cm&&/^[0-9A-Za-z]+$/.test(k)){cm=v;c=k}});const so=Object.keys(bs).filter(t=>/^\d{3}-/.test(DATA.st[t])&&ALIAS[DATA.st[t].slice(0,3)]).sort((x,y)=>bs[y]-bs[x]);
  const RV=rankBy(DATA,CFG,{by:"vendor"}),v=RV&&RV.rows.find(r=>r.k>=0&&DATA.vn[r.k]);
  const c3=[...bc].filter(x=>/^[0-9A-Za-z]+$/.test(x[0])).sort((x,y)=>y[1]-x[1]).slice(0,3).map(x=>x[0]);
  EXC={D:DATA,c,c3,s:so.length?DATA.st[so[0]]:"",s2:so.length>1?DATA.st[so[1]]:"",v:v?DATA.vn[v.k]:""}}
 const c=EXC.c,s=EXC.s,p=s.slice(0,3),arOf=x=>ALIAS[x.slice(0,3)]?ALIAS[x.slice(0,3)][0].replace(/ه$/,"ة"):"",ar=arOf(s),nm=s.slice(4),out=[];if(!c||!s)return out;
 if(en){out.push("code "+c,"branch "+p,"top 10 codes","who has "+c);if(EXC.c3.length>2)out.push("compare "+EXC.c3.join(" "));if(EXC.s2)out.push("compare "+nm.toLowerCase()+" vs "+EXC.s2.slice(4).toLowerCase());if(dHas())out.push(c+" last 30 days")}
 else{const b=ar?"فرع "+ar:"فرع "+p;out.push("الكود "+c+" بيع منه كم",b+" باع كم وعنده كم","أكثر 10 أكواد مبيعاً","مين عنده "+c);if(EXC.c3.length>2)out.push("قارن "+EXC.c3.join(" و"));if(EXC.v)out.push("المورد "+EXC.v);if(EXC.s2)out.push("قارن "+(ar||p)+" و"+(arOf(EXC.s2)||EXC.s2.slice(0,3)));
  if(dHas())out.push("أقل الفروع مبيعاً آخر 30 يوم","الشهر ده مقابل الشهر اللي فات")}
 return out;
}
const chip=x=>`<button type="button" data-sk="ex" data-x="${E(x)}" data-notr>${E(x)}</button>`;
function vAsk(){
 const en=document.documentElement.classList.contains("tz-en"),a=UI.a,H=hGet(),X0=askEx(en);
 const box=`<div class="stk-card stk-ask"><h3>💬 اسأل عن أي صنف أو فرع أو مورد</h3><p>اكتب الكود أو الفرع أو المورد، ومعها الفترة إن أردت. وتستطيع أن تسأل: «أكثر 10 أكواد مبيعاً»، «مين عنده الكود»، «قارن فرعين» أو «قارن عدة أكواد»، أو «الشهر ده مقابل اللي فات». كل رقم يُحسب مباشرة من الملفين المرفوعين.</p>
 <div class="stk-askb"><input type="search" id="stk-ask" value="${E(UI.aq)}" placeholder="الكود، الفرع، المورد، الفترة" autocomplete="off" enterkeyhint="search" maxlength="200"><button class="bt p" type="button" data-sk="ask">اسأل</button></div>
 ${X0.length?`<div class="stk-chips"><i>أمثلة</i>${X0.map(chip).join("")}</div>`:""}${H.length?`<div class="stk-chips"><i>آخر أسئلتك</i>${H.map(chip).join("")}</div>`:""}${lexBox()}</div>`;
 if(!a){LASTX=null;return box}
 const P=askP(),ids=a.code?DATA.code.get(a.code)||[]:[],cols=[...new Set(ids.map(k=>DATA.k[k][1]))].sort(),szs=[...new Set(ids.filter(k=>!a.cl||DATA.k[k][1]===a.cl).map(k=>DATA.k[k][2]))].sort((x,y)=>zk(x)-zk(y));
 const curZ=a.z,pEnd=P?P.to:"",K=kindA(a),B=askB(),cs=a.cmp&&a.cmp.st&&a.cmp.st.length>1?a.cmp.st:null,r=a.rank;
 const stSel=cs?cs.map((s,i)=>`<label>${i?"مع":"قارن"}<select data-af="cst" data-i="${i}" id="stk-a-cs${i}">${opt(stores(0),s,"— بلا —")}</select></label>`).join("")+(cs.length<4?`<label>فرع آخر<select data-af="cst" data-i="${cs.length}" id="stk-a-cs${cs.length}">${opt(stores(0),"","— أضف —")}</select></label>`:""):`<label>الفرع<select data-af="store" id="stk-a-st">${opt(stores(0),a.store,"كل الفروع")}</select></label>`;
 const rkBar=r?`<div class="stk-bar stk-und"><b class="stk-undt">الترتيب</b><label>رتّب<select data-af="rby" id="stk-a-rby">${[["","تلقائي"],["code","الأكواد"],["store","الفروع"],["vendor","الموردين"],["color","الألوان"],["size","المقاسات"],["var","ألوان ومقاسات الكود"]].filter(x=>x[0]!=="var"||a.code).map(x=>`<option value="${x[0]}"${(r.by||"")===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label><label>حسب<select data-af="rm" id="stk-a-rm"><option value="sold"${r.m!=="on"?" selected":""}>المبيعات</option><option value="on"${r.m==="on"?" selected":""}>الرصيد</option>${DATA.hasRc?`<option value="rc"${r.m==="rc"?" selected":""}>المستلم من أول السنة</option>`:""}</select></label><label>من<select data-af="rdir" id="stk-a-rdir"><option value="-1"${r.dir!==1?" selected":""}>الأعلى</option><option value="1"${r.dir===1?" selected":""}>الأقل</option></select></label><label>العدد<input type="number" min="1" max="100" data-af="rn" id="stk-a-rn" value="${E(r.n||10)}"></label><span class="sp"></span><button class="bt s" type="button" data-sk="norank">✕ بلا ترتيب</button></div>`:"";
 const und=`<div class="stk-bar stk-und"><b class="stk-undt">فهمتُ سؤالك هكذا (غيّر ما تريد)</b>${stSel}<label>المورد<select data-af="vendor" id="stk-a-vn">${opt(vendors(),a.vendor,"كل الموردين")}</select></label>${a.cmp&&a.cmp.codes&&a.cmp.codes.length>1?`<label>الأكواد (افصل بينها بفاصلة)<input type="text" data-af="ccodes" id="stk-a-ccodes" value="${E(a.cmp.codes.join("، "))}" dir="ltr" autocomplete="off" class="cc"></label>`:`<label>الكود<input type="text" data-af="code" id="stk-a-code" list="stk-codes" value="${E(a.code)}" placeholder="كل الأصناف" dir="ltr" autocomplete="off"></label>`}${ids.length?`<label>اللون<select data-af="cl" id="stk-a-cl">${opt(cols,a.cl,"كل الألوان")}</select></label><label>المقاس<select data-af="z" id="stk-a-z">${opt(szs,curZ,"كل المقاسات")}</select></label>`:""}
 <label>الفترة<select data-af="per" id="stk-a-per"><option value="ytd"${a.per!=="c"?" selected":""}>من أول السنة</option><option value="c"${a.per==="c"?" selected":""}>فترة أحددها</option></select></label>${a.per==="c"?`<label>من يوم<input type="date" data-af="from" id="stk-a-from" value="${E(a.from)}"></label><label>إلى يوم<input type="date" data-af="to" id="stk-a-to" value="${E(a.to)}"></label>`:""}${a.cmp&&a.cmp.b?`<label>مقابل من يوم<input type="date" data-af="bfrom" id="stk-a-bfrom" value="${E(a.cmp.b.from)}"></label><label>إلى يوم<input type="date" data-af="bto" id="stk-a-bto" value="${E(a.cmp.b.to)}"></label>`:""}<span class="sp"></span>${a.cmp&&!a.cmp.need?`<button class="bt s" type="button" data-sk="nocmp">✕ بلا مقارنة</button>`:""}<button class="bt" type="button" data-sk="prn">🖨 طباعة</button><button class="bt" type="button" data-sk="xls">⬇️ إكسل</button></div>${rkBar}<datalist id="stk-codes">${[...DATA.code.keys()].sort().slice(0,3000).map(c=>`<option value="${E(c)}">`).join("")}</datalist>`;
 const pk=(k,v)=>`<button class="bt s" type="button" data-sk="pick" data-k="${k}" data-v="${E(v)}" data-notr>${E(v)}</button>`,nt=[];
 if(a.amb.store.length)nt.push(`<div class="stk-rep w">أكثر من فرع يطابق ما كتبت. اختر الفرع: ${a.amb.store.map(s=>pk("store",s)).join(" ")}</div>`);
 if(a.amb.code.length)nt.push(`<div class="stk-rep w">${a.code?"كتبت أكثر من كود. اختر الكود:":"لم أجد هذا الكود كاملاً. أكواد تبدأ بما كتبت:"} ${a.amb.code.map(s=>pk("code",s)).join(" ")}</div>`);
 if(a.amb.cl.length)nt.push(`<div class="stk-rep w">أكثر من لون يطابق ما كتبت. اختر اللون: ${a.amb.cl.map(s=>pk("cl",s)).join(" ")}</div>`);
 if(a.amb.vendor&&a.amb.vendor.length&&K==="vg")nt.push(`<div class="stk-rep">لتختار مورداً واحداً منهم: ${a.amb.vendor.map(s=>pk("vendor",s)).join(" ")}</div>`);
 else if(a.amb.vendor&&a.amb.vendor.length)nt.push(`<div class="stk-rep w">أكثر من مورد يطابق ما كتبت. اختر المورد:${a.amb.vendor.map(s=>pk("vendor",s)).join(" ")}</div>`);
 if(a.cmp&&a.cmp.need)nt.push(`<div class="stk-rep w">للمقارنة اكتب فرعين (مثل «قارن الملقا والمدار») أو فترتين (مثل «أكتوبر مقابل سبتمبر»)، أو فترة واحدة لتُقارن بالتي قبلها (مثل «قارن آخر 30 يوم»).</div>`);
 if(a.cmp&&a.cmp.b&&!B)nt.push(`<div class="stk-rep w">فترة المقارنة: تاريخ البداية بعد تاريخ النهاية.</div>`);
 if(a.where&&!a.code&&K!=="r"&&K!=="x")nt.push(`<div class="stk-rep">«مين عنده» تحتاج كود الصنف: اكتبه في السؤال أو في خانة الكود.</div>`);
 if(K==="x"&&cs&&a.cmp.b)nt.push(`<div class="stk-rep">قارنتُ الفروع في الفترة الأولى فقط. لمقارنة فترتين اترك فرعاً واحداً.</div>`);
 if(a.unk.length)nt.push('<div class="stk-rep">لم أفهم من سؤالك: <b data-notr>'+E(a.unk.join(" · "))+"</b> — لم يدخل في الحساب.</div>");
 const rcOld=!(META&&META.q&&META.q.rc!==undefined),upB=`<button class="bt s" type="button" data-sk="tab" data-t="up">افتح «الملفات»</button>`;// rcOld: ملف الكميات المحفوظ رُفع قبل تحديث المستلم
 if(a.rc&&!DATA.hasRc)nt.push(rcOld?`<div class="stk-rep w">«المستلم» لم يُحفظ بعد: ملف الكميات الموجود على المنصة رُفع قبل تحديث «المستلم». ارفع ملف الكميات مرة أخرى من تبويب «الملفات» ليظهر المستلم هنا. ${upB}</div>`:`<div class="stk-rep w">«المستلم» غير متاح: ملف الكميات المرفوع ليس فيه عمود استلام صالح لكل فرع. ارفع ملف كميات فيه عمود المستلم ليظهر هنا. المتاح الآن: الرصيد والمبيعات. ${upB}</div>`);
 if(a.rc&&DATA.hasRc)nt.push(`<div class="stk-rep">«المستلم» من ملف الكميات، وهو من أول السنة حتى يوم التقرير${a.per==="c"?" (لا يتبع الفترة المختارة)":""}. يظهر في بطاقة الفرع وبطاقة الصنف.</div>`);
 if(a.per==="c"&&!dHas())nt.push(`<div class="stk-rep w">المبيعات بين يومين تحتاج ملف التاريخ، ولم يُرفع بعد. ارفعه من تبويب «الملفات».</div>`);
 else if(a.per==="c"&&!P)nt.push(`<div class="stk-rep w">تاريخ البداية بعد تاريخ النهاية.</div>`);
 const q=META&&META.q?META.q:{},sp=d=>`<span data-notr dir="ltr">${E(d)}</span>`;
 const src=`<p class="stk-src">المصدر: الأرصدة من ملف الكميات المرفوع ${sp(dts(q.at))}${q.to?` (حتى نهاية يوم ${sp(qEnd())})`:""}. المبيعات ${P?`من ملفات التاريخ، من ${sp(P.from)} إلى ${sp(pEnd)}`:`من ملف الكميات${q.from?`، من ${sp(q.from)} إلى ${sp(qEnd())}`:"، من أول السنة"}`}. الأرقام صافية بعد المرتجع.</p>`;
 let ans="";const perBad=a.per==="c"&&!P;
 if(perBad){LASTX=null}
 else if(K==="x")ans=cs?ansCmpSt(a,P,cs):a.cmp.codes&&a.cmp.codes.length>1?ansCmpCodes(a,P):ansCmpP(a,P,B);
 else if(K==="r")ans=ansRank(a,P);
 else if(K==="w")ans=ansWhere(a,P);
 else if(K==="p")ans=ansBuy(a,P);
 else if(K==="n")ans=ansNeed(a,P);
 else if(K==="st")ans=ansStale(a,P);
 else if(K==="vg")ans=ansVGroup(a,P);
 else if(K==="z")ans=ansAttr(a,P);
 else if(K==="v")ans=ansVendor(a,P);
 else if(a.code)ans=ansCode(a,P);
 else if(a.store)ans=ansStore(a,P);
 else{LASTX=null;ans=em("لم أجد في سؤالك كوداً ولا فرعاً ولا مورداً.<br>اكتب كود الصنف (مثل الأمثلة في الأعلى) أو اسم الفرع أو رقمه أو اسم المورد، أو اخترها من القوائم.")}
 const vnote=a.vendor&&(K==="c"||K==="w")?`<div class="stk-rep">الجواب عن الكود كله؛ المورد لا يغيّر أرقام كود بعينه.</div>`:"";
 return box+und+nt.join("")+gapNote(P)+(K==="x"&&B&&!cs?gapNote(B):"")+vnote+ans+(ans&&K&&!perBad?src:"");
}
/* (v180) أجوبة الترتيب و«مين عنده» والمورد والمقارنة. الضغط على أي اسم في جدول يفتح بطاقته (rgo) */
const stL=ti=>`<a href="#" data-sk="rgo" data-k="store" data-v="${E(DATA.st[ti])}" style="color:inherit">${sn(ti)}</a>`;
const codeL=c=>`<a href="#" data-sk="rgo" data-k="code" data-v="${E(c)}" style="color:inherit" data-notr dir="ltr">${E(c)}</a>`;
const vnL=vi=>vi>=0&&DATA.vn[vi]?`<a href="#" data-sk="rgo" data-k="vendor" data-v="${E(DATA.vn[vi])}" style="color:inherit" data-notr>${E(DATA.vn[vi])}</a>`:"—";
const varL=ki=>{const x=DATA.k[ki];return `<span data-notr>${E([x[1],x[2]].filter(Boolean).join(" · ")||"—")}</span>`};
const sg=d=>(d>0?"+":"")+fmt(d);
// سطر «في الفرع … · المورد … · الكود …» تحت عنوان الجواب
const ctxL=(a,skip)=>{const o=[];if(a.zs&&a.zs.length&&!a.code&&skip!=="attr")o.push(`المقاس: <bdi data-notr dir="ltr">${E(a.zs.join(" · "))}</bdi>`);if(a.cls&&a.cls.length&&!a.code&&skip!=="attr")o.push(`اللون: <bdi data-notr>${E(a.cn||a.cls[0])}</bdi>`);if(a.store&&skip!=="store")o.push(`الفرع: ${sn(DATA.sti.get(a.store))}`);if(a.vendor&&skip!=="vendor")o.push(`المورد: <bdi data-notr>${E(a.vendor)}</bdi>`);if(a.code&&skip!=="code")o.push(`الكود: <bdi data-notr dir="ltr">${E([a.code,a.cl,a.z].filter(Boolean).join(" · "))}</bdi>`);return o.length?`<small>${o.join(" · ")}</small>`:""};
const RKN={code:"الأكواد",store:"الفروع",vendor:"الموردون",color:"الألوان",size:"المقاسات",var:"ألوان ومقاسات الكود"};
// (v210) جواب «مقاس 40 في كل الأصناف» / «اللون الأسود»
function ansAttr(a,P){
 const R=attrCard(DATA,CFG,{zs:a.zs,cls:a.cls,store:a.store,vendor:a.vendor,period:P});
 if(!R){LASTX=null;return em("لا بيانات بهذه الشروط: الفرع أو المورد غير موجود في ملف الكميات.")}
 const isZ=a.zs&&a.zs.length,zl=isZ?a.zs.join(" · "):"",nm=isZ?(a.zs.length>1?"المقاسات ":"مقاس ")+zl:"اللون «"+(a.cn||"")+"»",days=pDays(P),rate=days>0?R.sold/days:0,cov=rate>0?Math.max(0,R.on)/rate:null,perW=P?"في الفترة":"من أول السنة";
 const nm2=isZ&&a.cls&&a.cls.length?nm+" باللون «"+(a.cn||"")+"»":nm;
 LASTX={name:(isZ?"مقاس-"+a.zs.join("-"):"لون-"+(a.cn||"")),head:["الكود","المورد","المبيعات","الرصيد","رصيد المستودع"],rows:()=>R.codes.map(c=>[c.code,vnOf(c.vi),c.sold,c.on,c.wh]),prn:{ttl:nm2+(a.store?"":" في كل الأصناف"),sub:a.store?"الفرع: "+a.store:""}};
 if(!R.nCodes)return em("لا يوجد في ملف الكميات صنف بهذا "+(isZ?"المقاس":"اللون")+(a.store?" في هذا الفرع":"")+".");
 const T=[tile(fmt(R.sold),"قطعة مباعة "+perW+" (الصافي)","k"),tile(pct(R.share),"من كل مبيعات "+(a.store?"الفرع":"الشركة")+" "+perW)];
 if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيبه بين كل المقاسات في المبيعات"));
 T.push(tile(fmt(R.br),a.store?"قطعة عند الفرع الآن":"قطعة في الفروع الآن"),tile(fmt(R.wh),"قطعة في المستودع"),tile(cov==null?"—":cov>=999?"999+":fmt(cov),"يوماً يكفي الرصيد بمعدل البيع (تقريبي)"),
  tile(fmt(R.nSold)+" / "+fmt(R.nCodes),"كود باع منه / كود فيه "+(isZ?"هذا المقاس":"هذا اللون")),tile(fmt(R.noWh),"كود يُباع والمستودع خالٍ منه",R.noWh?"bad":""));
 const bar=(v,mx)=>'<i class="stk-zb" style="width:'+Math.max(2,Math.round(Math.max(0,v)/Math.max(1,mx)*100))+'%"></i>';
 const gMx=Math.max(1,...R.groups.map(g=>g.sold));
 const grp=R.groups.length>1?'<div class="stk-card"><h3>'+(R.byCl?"ألوان السيستم في هذا اللون":"كل مقاس وحده")+'</h3><div class="tw"><table class="stk-t"><thead><tr><th>'+(R.byCl?"اللون":"المقاس")+'</th><th class="n">باع</th><th></th><th class="n">من كل المبيعات</th>'+(R.byCl?"":'<th class="n">ترتيبه</th>')+'<th class="n">الفروع</th><th class="n">المستودع</th></tr></thead><tbody>'+R.groups.map(g=>'<tr><td data-notr dir="ltr"><b>'+E(g.k||"—")+'</b></td><td class="n"><b>'+fmt(g.sold)+'</b></td><td style="min-width:50px">'+bar(g.sold,gMx)+'</td><td class="n">'+pct(g.share)+"</td>"+(R.byCl?"":'<td class="n">'+g.rank+"</td>")+'<td class="n">'+fmt(g.on-g.wh)+'</td><td class="n'+(g.wh<=0?" z":"")+'">'+fmt(g.wh)+"</td></tr>").join("")+"</tbody></table></div></div>":"";
 const sMx=Math.max(1,...R.stores.map(e=>e.sold)),me=a.store?DATA.sti.get(a.store):-1;
 const st='<div class="stk-card"><h3>في كل فرع</h3><p class="stk-src" style="margin:0 0 6px">«من مبيعات الفرع» = كم في المية من كل ما باعه الفرع كان '+(isZ?"من هذا المقاس":"من هذا اللون")+'.</p><div class="tw"><table class="stk-t"><thead><tr><th>الفرع</th><th class="n">باع</th><th></th><th class="n">من مبيعات الفرع</th><th class="n">رصيده</th></tr></thead><tbody>'+R.stores.map(e=>'<tr'+(e.ti===me?' class="fo"':"")+"><td>"+stL(e.ti)+'</td><td class="n"><b>'+fmt(e.sold)+'</b></td><td style="min-width:44px">'+bar(e.sold,sMx)+'</td><td class="n">'+pct(e.share)+'</td><td class="n'+(e.on<=0&&e.sold>0?" z":"")+'">'+fmt(e.on)+"</td></tr>").join("")+"</tbody></table></div></div>";
 const top=R.codes.slice(0,40),cd='<div class="stk-card"><h3>الأكواد الأكثر بيعاً '+(isZ?"في هذا المقاس":"في هذا اللون")+(a.store?" في الفرع":"")+'</h3><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>المورد</th><th class="n">باع</th><th class="n">'+(a.store?"رصيد الفرع":"الرصيد")+'</th><th class="n">المستودع</th></tr></thead><tbody>'+top.map(c=>'<tr><td class="c">'+codeL(c.code)+'</td><td data-notr style="white-space:normal">'+E(vnOf(c.vi)||"—")+'</td><td class="n"><b>'+fmt(c.sold)+'</b></td><td class="n">'+fmt(c.on)+'</td><td class="n'+(c.wh<=0?" z":"")+'">'+fmt(c.wh)+"</td></tr>").join("")+"</tbody></table></div>"+(R.codes.length>top.length?'<p class="stk-src">معروض '+fmt(top.length)+" من "+fmt(R.codes.length)+" كوداً. القائمة كلها في «إكسل».</p>":"")+"</div>";
 const inc=!isZ&&R.byCl&&a.cls.length>1?'<p class="stk-src" style="margin:0 0 10px">يشمل '+fmt(a.cls.length)+' لوناً كما كُتبت في السيستم: <bdi data-notr dir="ltr">'+E(a.cls.slice(0,12).join(" · "))+(a.cls.length>12?" …":"")+"</bdi></p>":"";
 return '<div class="stk-ttl"><h3><bdi data-notr dir="ltr">'+E(nm2)+"</bdi> "+(a.store?"":"<small>في كل الأصناف</small>")+"</h3>"+ctxL(a,"attr")+'</div><div class="stk-tiles">'+T.join("")+"</div>"+inc
  +'<div class="stk-act"><button class="bt" type="button" data-sk="zrk">📊 ترتيب كل المقاسات بالمبيعات</button></div>'+grp+'<div class="stk-up">'+st+cd+"</div>";
}
function ansRank(a,P){
 const r=a.rank,R=rankBy(DATA,CFG,{by:r.by,m:r.m,dir:r.dir,store:a.store,vendor:a.vendor,code:a.code,cl:a.cl,z:a.z,zs:a.code?null:a.zs,cls:a.code?null:a.cls,period:P});
 if(!R){LASTX=null;return em("لا بيانات بهذه الشروط: الكود أو الفرع أو المورد غير موجود في ملف الكميات.")}
 const n=Math.max(1,Math.min(100,N(r.n)||10)),L=R.rows.slice(0,n),by=R.by,m=R.m,tot=R[m],top=L.reduce((s,g)=>s+g[m],0),rcOn=DATA.hasRc,mW=m==="on"?"رصيداً":m==="rc"?"استلاماً":"مبيعاً";
 const lab=g=>by==="code"?codeL(g.k):by==="store"?stL(g.k):by==="vendor"?vnL(g.k):by==="var"?varL(g.k):g.k?`<span data-notr dir="ltr">${E(g.k)}</span>`:`<small>${by==="size"?"بلا مقاس (عطور وغيرها)":by==="color"?"بلا لون":"—"}</small>`;
 const txt=g=>by==="store"?DATA.st[g.k]:by==="vendor"?(g.k>=0?DATA.vn[g.k]||"":""):by==="var"?DATA.k[g.k].slice(1,3).join(" "):String(g.k);
 LASTX={name:"ترتيب-"+by,head:["الترتيب",RKN[by]].concat(rcOn?["المستلم من أول السنة"]:[],["المبيعات","الرصيد"]),rows:()=>R.rows.map((g,i)=>[i+1,txt(g)].concat(rcOn?[g.rc]:[],[g.sold,g.on]))};
 const T=[];if(m==="rc")T.push(tile(fmt(R.rc),"قطعة استلمتها الفروع من أول السنة","k"));T.push(tile(fmt(R.sold),"قطعة مباعة (الصافي)","k"),tile(fmt(R.on),"قطعة رصيد الآن"),tile(fmt(R.rows.length),"العدد في القائمة كلها"));
 if(r.dir!==1&&tot>0&&L.length<R.rows.length)T.push(tile(pct(top/tot),"نصيب أول "+L.length+" من المجموع"));
 return `<div class="stk-ttl"><h3>${r.dir===1?"الأقل":"الأعلى"} ${mW}: ${RKN[by]}</h3>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 ${r.m==="rc"&&!rcOn?`<div class="stk-rep w">الترتيب بالمستلم غير متاح: ملف الكميات المرفوع ليس فيه عمود استلام صالح. رُتِّب بالمبيعات.</div>`:""}${m==="rc"?`<div class="stk-rep">المستلم من أول السنة حتى يوم التقرير${P?" (لا يتبع الفترة المختارة)":""}، للفروع فقط بلا مخزن المستودع.</div>`:""}
 ${r.dir===1&&m==="sold"?`<div class="stk-rep">الأقل مبيعاً يبدأ بما له رصيد ولم يُبع${by==="store"?"، ويشمل كل الفروع (بلا المستودع)":""}.</div>`:""}
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th class="n">#</th><th>${RKN[by]}</th>${rcOn?`<th class="n">استلم</th>`:""}<th class="n">المبيعات</th><th class="n">الرصيد</th>${tot>0?`<th class="n">النصيب</th>`:""}</tr></thead><tbody>${L.map((g,i)=>`<tr><td class="n rk">${i+1}</td><td>${lab(g)}</td>${rcOn?`<td class="n">${m==="rc"?`<b>${fmt(g.rc)}</b>`:fmt(g.rc)}</td>`:""}<td class="n">${m==="sold"?`<b>${fmt(g.sold)}</b>`:fmt(g.sold)}</td><td class="n${g.on<=0?" z":""}">${m==="on"?`<b>${fmt(g.on)}</b>`:fmt(g.on)}</td>${tot>0?`<td class="n">${pct(g[m]/tot)}</td>`:""}</tr>`).join("")}</tbody></table></div>${R.rows.length>L.length?`<p class="stk-src">معروض ${fmt(L.length)} من ${fmt(R.rows.length)}. غيّر «العدد» أو نزّل القائمة كلها من «إكسل».</p>`:""}</div>`:em("لا شيء بهذه الشروط.")}`;
}
function ansWhere(a,P){
 const R=whoHas(DATA,CFG,a.code,{cl:a.cl,z:a.z,period:P});if(!R){LASTX=null;return em(DATA.code.get(a.code)?"لا يوجد هذا اللون أو المقاس لهذا الكود.":`الكود <b data-notr dir="ltr">${E(a.code)}</b> غير موجود في ملف الكميات.`)}
 const wh=DATA.sti.get(CFG.wh);LASTX={name:"مين-عنده-"+a.code,head:["الفرع","الرصيد","المبيعات"],rows:()=>R.has.concat(R.out).map(s=>[DATA.st[s.ti],s.on,s.sold])};
 const T=[tile(fmt(R.n),"فرع عنده رصيد","k"),tile(fmt(R.wh),"قطعة في المستودع","k"),tile(fmt(R.on),"قطعة في المستودع والفروع"),tile(fmt(R.out.length),"فرع نفد عنده وهو يبيعه",R.out.length?"bad":"")];
 const tb=(L,first)=>`<table class="stk-t"><thead><tr><th>الفرع</th><th class="n">الرصيد</th><th class="n">المبيعات</th></tr></thead><tbody>${L.map(s=>`<tr><td>${stL(s.ti)}${s.ti===wh?" <small>(المستودع)</small>":""}</td><td class="n${s.on<=0?" z":""}">${first?`<b>${fmt(s.on)}</b>`:fmt(s.on)}</td><td class="n">${first?fmt(s.sold):`<b>${fmt(s.sold)}</b>`}</td></tr>`).join("")}</tbody></table>`;
 return `<div class="stk-ttl"><h3>مين عنده <bdi dir="ltr" data-notr>${E(a.code)}</bdi>${a.cl||a.z?` <small data-notr>${E([a.cl,a.z].filter(Boolean).join(" · "))}</small>`:""}</h3></div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="nowhere">📋 بطاقة الصنف كاملة</button><button class="bt" type="button" data-sk="goitem">🔍 جدول الصنف في كل الفروع</button></div>
 <div class="stk-up"><div class="stk-card"><h3>عنده رصيد (${fmt(R.has.length)})</h3>${R.has.length?tb(R.has,true):`<p>لا أحد عنده رصيد من هذا الصنف.</p>`}</div>
 <div class="stk-card"><h3>نفد عنده وهو يبيعه (${fmt(R.out.length)})</h3>${R.out.length?tb(R.out,false):`<p>لا يوجد فرع نفد عنده وهو يبيعه.</p>`}</div></div>`;
}
/* (v260) 🛒 «اشترينا كام من الكود»: من ملف المشتريات (Vouchers)، من أول السنة أو الفترة المكتوبة */
const buyR=a=>{const P=askP();if(P)return P;const e=today();return {from:e.slice(0,4)+"-01-01",to:e}};
function ansBuy(a,P){
 const R=buyR(a),rm=months(R.from,R.to).filter(ym=>META&&META.d&&META.d[ym]&&Array.isArray(META.d[ym].rv)&&META.d[ym].rv.length),miss=months(R.from,R.to).filter(ym=>rm.indexOf(ym)<0&&ym<=today().slice(0,7));
 const upB=`<button class="bt s" type="button" data-sk="tab" data-t="up">افتح «الملفات»</button>`;
 if(!rm.length){LASTX=null;return em(`لم يُرفع ملف المشتريات لهذه الفترة بعد. ارفعه من تبويب «الملفات» (التقرير الذي فيه الكمية المستلمة من المورد) لأعرف كم اشترينا. ${upB}`)}
 const S=purchStat(DATA,{code:a.code,cl:a.cl,z:a.z,store:a.store,from:R.from,to:R.to});if(!S){LASTX=null;return em(a.code?`الكود <b data-notr dir="ltr">${E(a.code)}</b> غير موجود في ملف الكميات.`:"لا بيانات بهذه الشروط.")}
 const T=[tile(fmt(S.q),S.ret?"قطعة اشتريناها (الصافي بعد المرتجع)":"قطعة اشتريناها (استلام من المورد)","k"),tile(S.last||"—","آخر يوم استلام")];if(S.ret)T.push(tile(fmt(S.ret),"قطعة مرتجعة للمورد","bad"));if(!a.code)T.push(tile(fmt(S.codes.length),"كود اشترينا منه"));T.push(tile(fmt(Object.keys(S.byM).length),"شهر فيه استلام"));
 const mt=Object.keys(S.byM).sort().map(ym=>`<tr><td data-notr dir="ltr">${E(ym)}</td><td class="n">${fmt(S.byM[ym])}</td></tr>`).join("");
 let body="";
 if(a.code){LASTX={name:"مشتريات-"+a.code,head:["اللون والمقاس","الكمية"],rows:()=>S.vars.map(v=>[DATA.k[v.k].slice(1,3).join(" "),v.q])};
  body=`<div class="stk-up"><div class="stk-card"><h3>لكل شهر</h3>${mt?`<table class="stk-t"><thead><tr><th>الشهر</th><th class="n">الكمية</th></tr></thead><tbody>${mt}</tbody></table>`:"<p>لا استلام في الفترة.</p>"}</div>
  <div class="stk-card"><h3>لكل لون ومقاس</h3>${S.vars.length?`<table class="stk-t"><thead><tr><th>اللون والمقاس</th><th class="n">الكمية</th></tr></thead><tbody>${S.vars.slice(0,60).map(v=>`<tr><td>${varL(v.k)}</td><td class="n">${fmt(v.q)}</td></tr>`).join("")}</tbody></table>`:"<p>لا استلام في الفترة.</p>"}</div></div>
  ${S.stores.length>1||(S.stores.length&&S.stores[0].k!==DATA.sti.get(CFG.wh))?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th>المخزن الذي استلم</th><th class="n">الكمية</th></tr></thead><tbody>${S.stores.map(s=>`<tr><td>${stL(s.k)}</td><td class="n">${fmt(s.q)}</td></tr>`).join("")}</tbody></table></div></div>`:""}`}
 else{LASTX={name:"مشتريات",head:["الكود","الكمية"],rows:()=>S.codes.map(c=>[c.k,c.q])};
  body=`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th class="n">#</th><th>الكود</th><th class="n">الكمية</th></tr></thead><tbody>${S.codes.slice(0,60).map((c,i)=>`<tr><td class="n rk">${i+1}</td><td>${codeL(c.k)}</td><td class="n">${fmt(c.q)}</td></tr>`).join("")}</tbody></table></div>${S.codes.length>60?`<p class="stk-src">معروض 60 من ${fmt(S.codes.length)}. القائمة كلها في «إكسل».</p>`:""}</div>`}
 return `<div class="stk-ttl"><h3>🛒 المشتريات${a.code?` من <bdi dir="ltr" data-notr>${E(a.code)}</bdi>`:""}</h3>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-rep">من ملف المشتريات (الكمية المستلمة من المورد)، من <span data-notr dir="ltr">${E(R.from)}</span> إلى <span data-notr dir="ltr">${E(R.to)}</span>.${miss.length?` شهور لم يُرفع ملف مشترياتها: <b data-notr dir="ltr">${E(miss.join("، "))}</b>.`:""}</div>${body}`;
}
/* (v260) «الكود ناقص فين» و«نواقص فرع الملقا»: نفس حساب تبويب «نواقص الفروع» (يبيعه الفرع ورصيده أقل من الحد والمستودع عنده) */
function ansNeed(a,P){
 let L=shortages(DATA,CFG,{store:a.store,vendor:a.vendor,period:P,sold:1});if(a.code)L=L.filter(l=>DATA.k[l.ki][0]===a.code&&(!a.cl||DATA.k[l.ki][1]===a.cl)&&(!a.z||DATA.k[l.ki][2]===a.z));
 L=L.slice().sort((p,r)=>r.need-p.need||r.sold-p.sold);const need=L.reduce((s,l)=>s+l.need,0),give=L.reduce((s,l)=>s+l.give,0),brs=new Set(L.map(l=>l.ti)),cds=new Set(L.map(l=>DATA.k[l.ki][0]));
 const W=a.code?whoHas(DATA,CFG,a.code,{cl:a.cl,z:a.z,period:P}):null,out=W?W.out.filter(s=>!a.store||DATA.st[s.ti]===a.store):[];
 LASTX={name:"نواقص"+(a.code?"-"+a.code:a.store?"-"+a.store.slice(0,3):""),head:["الفرع","الكود","اللون","المقاس","الرصيد","المبيعات","الناقص","المقترح من المستودع"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.on,l.sold,l.need,l.give]})};
 const T=[tile(fmt(L.length),"صنف ناقص (لون ومقاس)","k"),tile(fmt(need),"قطعة ناقصة"),tile(fmt(give),"قطعة يغطيها المستودع")];T.push(a.code?tile(fmt(brs.size),"فرع ناقص عنده"):tile(fmt(cds.size),"كود ناقص"));if(a.code)T.push(tile(fmt(out.length),"فرع نفد عنده وهو يبيعه",out.length?"bad":""));
 const tb=L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr>${a.store?"":"<th>الفرع</th>"}${a.code?"":"<th>الكود</th>"}<th>اللون والمقاس</th><th class="n">الرصيد</th><th class="n">المبيعات</th><th class="n">الناقص</th><th class="n">المقترح من المستودع</th></tr></thead><tbody>${L.slice(0,80).map(l=>`<tr>${a.store?"":`<td>${stL(l.ti)}</td>`}${a.code?"":`<td>${codeL(DATA.k[l.ki][0])}</td>`}<td>${varL(l.ki)}</td><td class="n${l.on<=0?" z":""}">${fmt(l.on)}</td><td class="n">${fmt(l.sold)}</td><td class="n"><b>${fmt(l.need)}</b></td><td class="n">${fmt(l.give)}</td></tr>`).join("")}</tbody></table></div>${L.length>80?`<p class="stk-src">معروض 80 من ${fmt(L.length)}. القائمة كلها في «إكسل» أو في تبويب «نواقص الفروع».</p>`:""}</div>`:em(a.code?"لا نواقص يغطيها المستودع لهذا الكود (المستودع ليس عنده منه، أو كل فرع يبيعه عنده ما يكفي).":"لا نواقص يغطيها المستودع لهذا الفرع الآن 👌");
 const ot=out.length?`<div class="stk-card"><h3>نفد عنده وهو يبيعه (${fmt(out.length)})</h3><table class="stk-t"><thead><tr><th>الفرع</th><th class="n">الرصيد</th><th class="n">المبيعات</th></tr></thead><tbody>${out.map(s=>`<tr><td>${stL(s.ti)}</td><td class="n z">${fmt(s.on)}</td><td class="n"><b>${fmt(s.sold)}</b></td></tr>`).join("")}</tbody></table>${W&&W.wh<=0?`<p class="stk-src">المستودع ليس عنده من هذا الكود: الحل تحويل من فرع لا يبيعه («تحويلات مقترحة») أو الشراء.</p>`:""}</div>`:"";
 return `<div class="stk-ttl"><h3>📦 النواقص${a.code?` · <bdi dir="ltr" data-notr>${E(a.code)}</bdi>`:""}</h3>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-rep">النواقص = صنف يبيعه الفرع ورصيده أقل من الحد، والمستودع عنده منه. «المقترح» من قواعد التوزيع في تبويب «نواقص الفروع».</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="goneed">📦 افتح «نواقص الفروع» بنفس الشروط</button>${a.code?`<button class="bt" type="button" data-sk="goitem">🔍 تحليل الصنف</button>`:""}</div>${tb}${ot}`;
}
/* (v260) «الأصناف اللي مش شغالة / الراكد»: نفس حساب تبويب «الراكد» (رصيد ≥ حد الراكد ولم يُبع في الفترة) */
function ansStale(a,P){
 let L=stale(DATA,CFG,{store:a.store,vendor:a.vendor,period:P,q:a.code||""});if(a.code)L=L.filter(l=>DATA.k[l.ki][0]===a.code);
 const pcs=L.reduce((s,l)=>s+l.on,0),brs=new Set(L.map(l=>l.ti)),cds=new Set(L.map(l=>DATA.k[l.ki][0]));
 LASTX={name:"راكد",head:["الفرع","الكود","اللون","المقاس","الرصيد"],rows:()=>L.map(l=>{const x=DATA.k[l.ki];return [DATA.st[l.ti],x[0],x[1],x[2],l.on]})};
 const T=[tile(fmt(L.length),"صنف لم يُبع (لون ومقاس في فرع)","k"),tile(fmt(pcs),"قطعة راكدة"),tile(fmt(cds.size),"كود"),tile(fmt(brs.size),"فرع")];
 return `<div class="stk-ttl"><h3>🐢 أصناف لم تُبع${P?"":" من أول السنة"}</h3>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-rep">صنف عند الفرع رصيده ${fmt(Math.max(1,N(CFG.stale)))} قطع فأكثر ولم يُبع منه شيء ${P?`من <span data-notr dir="ltr">${E(P.from)}</span> إلى <span data-notr dir="ltr">${E(P.to)}</span>`:"من أول السنة"}. المستودع خارج الحساب.${L.fresh?` استُبعد ${fmt(L.fresh)} صنفاً استُلم حديثاً.`:""}</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="gostale">🐢 افتح «الراكد» بنفس الشروط</button></div>
 ${L.length?`<div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th>الفرع</th><th>الكود</th><th>اللون والمقاس</th><th class="n">الرصيد</th></tr></thead><tbody>${L.slice(0,80).map(l=>`<tr><td>${stL(l.ti)}</td><td>${codeL(DATA.k[l.ki][0])}</td><td>${varL(l.ki)}</td><td class="n"><b>${fmt(l.on)}</b></td></tr>`).join("")}</tbody></table></div>${L.length>80?`<p class="stk-src">معروض 80 من ${fmt(L.length)} (الأكبر رصيداً أولاً). القائمة كلها في «إكسل».</p>`:""}</div>`:em("لا أصناف راكدة بهذه الشروط 👌")}`;
}
/* (v260) كلمة تطابق أكثر من مورد («الشربات» = 4 موردين): مجموعهم معاً، وكل مورد وحده */
function ansVGroup(a,P){
 const RV=rankBy(DATA,CFG,{by:"vendor",store:a.store,period:P});if(!RV){LASTX=null;return em("لا بيانات بهذه الشروط.")}
 const set=new Set(a.vgrp.map(v=>DATA.vn.indexOf(v)).filter(i=>i>=0)),rows=RV.rows.filter(r=>set.has(r.k));let sold=0,on=0;rows.forEach(r=>{sold+=r.sold;on+=r.on});
 LASTX={name:"موردون",head:["المورد","المبيعات","الرصيد"],rows:()=>rows.map(r=>[DATA.vn[r.k],r.sold,r.on])};
 const T=[tile(fmt(sold),"قطعة باعوها (الصافي)","k"),tile(fmt(on),a.store?"قطعة عند الفرع":"قطعة رصيد (المستودع والفروع)","k"),tile(pct(RV.sold>0?sold/RV.sold:null),"نصيبهم من كل المبيعات"),tile(fmt(rows.length),"مورد")];
 return `<div class="stk-ttl"><h3>الموردون معاً</h3>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-rep">جمعتُ الموردين الذين تشبه أسماؤهم ما كتبت. اضغط اسم مورد لتراه وحده.</div>
 <div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th>المورد</th><th class="n">المبيعات</th><th class="n">الرصيد</th><th class="n">النصيب</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${vnL(r.k)}</td><td class="n"><b>${fmt(r.sold)}</b></td><td class="n">${fmt(r.on)}</td><td class="n">${pct(sold>0?r.sold/sold:null)}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function ansVendor(a,P){
 const R=vendorCard(DATA,CFG,a.vendor,{store:a.store,period:P});if(!R){LASTX=null;return em("هذا المورد غير موجود في ملف الكميات.")}
 LASTX={name:"مورد",head:["الكود","المبيعات","الرصيد","رصيد المستودع"],rows:()=>R.codes.map(c=>[c.code,c.sold,c.on,c.wh])};
 const T=[tile(fmt(R.sold),"قطعة باعها (الصافي)","k"),tile(fmt(R.on),a.store?"قطعة عند الفرع":"قطعة رصيد (المستودع والفروع)","k")];
 if(!a.store)T.push(tile(fmt(R.wh),"قطعة في المستودع"),tile(fmt(R.br),"قطعة في الفروع"));
 T.push(tile(fmt(R.codes.length),"كود له رصيد أو مبيعات"));if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيبه بين الموردين في المبيعات"),tile(pct(R.share),"نصيبه من المبيعات"));
 T.push(tile(fmt(R.short.n),"صنف يُباع ورصيده ناقص في فرع","go",` data-sk="goneed" role="button" tabindex="0"`),tile(fmt(R.idle.n),"سطر راكد","go",` data-sk="gostale" role="button" tabindex="0"`),tile(fmt(R.reorder.length),"كود نفد من المستودع وهو يُباع",R.reorder.length?"bad":""));
 const top=R.codes.slice(0,25),ro=R.reorder.slice(0,40);
 return `<div class="stk-ttl"><h3 data-notr>${E(a.vendor)}</h3>${a.store?`<small>الفرع: ${sn(DATA.sti.get(a.store))}</small>`:`<small>بطاقة المورد</small>`}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-up"><div class="stk-card"><h3>أكواده الأعلى مبيعاً</h3>${top.length?`<table class="stk-t"><thead><tr><th>الكود</th><th class="n">المبيعات</th><th class="n">الرصيد</th><th class="n">المستودع</th></tr></thead><tbody>${top.map(c=>`<tr><td class="c">${codeL(c.code)}</td><td class="n"><b>${fmt(c.sold)}</b></td><td class="n${c.on<=0?" z":""}">${fmt(c.on)}</td><td class="n${c.wh<=0?" z":""}">${fmt(c.wh)}</td></tr>`).join("")}</tbody></table>`:`<p>لا أكواد.</p>`}</div>
 ${a.store?"":`<div class="stk-card"><h3>حسب الفرع</h3><table class="stk-t"><thead><tr><th>الفرع</th><th class="n">المبيعات</th><th class="n">الرصيد</th></tr></thead><tbody>${R.stores.map(s=>`<tr><td>${stL(s.ti)}</td><td class="n"><b>${fmt(s.sold)}</b></td><td class="n${s.on<=0?" z":""}">${fmt(s.on)}</td></tr>`).join("")}</tbody></table></div>`}</div>
 ${ro.length?`<div class="stk-pan"><h3 class="stk-ph">نفد من المستودع وهو يُباع (${fmt(R.reorder.length)}) — يحتاج طلباً من المورد</h3><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th class="n">المبيعات</th><th class="n">${a.store?"رصيد الفرع":"رصيد الفروع"}</th></tr></thead><tbody>${ro.map(c=>`<tr><td class="c">${codeL(c.code)}</td><td class="n"><b>${fmt(c.sold)}</b></td><td class="n${c.on-c.wh<=0?" z":""}">${fmt(a.store?c.on:c.on-c.wh)}</td></tr>`).join("")}</tbody></table></div></div>`:""}`;
}
function ansCmpSt(a,P,cs){
 const R=cmpStores(DATA,CFG,cs,{code:a.code,cl:a.cl,z:a.z,vendor:a.vendor,period:P});if(!R){LASTX=null;return em("اختر فرعين على الأقل موجودين في ملف الكميات.")}
 const cards=!a.code&&!a.vendor?R.tis.map(ti=>storeCard(DATA,CFG,DATA.st[ti],P)):null,M=[["الرصيد",R.tot.map(t=>t.on),0],["المبيعات (الصافي)",R.tot.map(t=>t.sold),1],[a.code?"لون ومقاس له رصيد":"صنف له رصيد",R.tot.map(t=>t.inSt),0],["نفد وهو يبيعه",R.tot.map(t=>t.out),-1]];
 if(cards){M.push(["الترتيب بين الفروع في المبيعات",cards.map(c=>c.rank?c.rank+" / "+c.of:"—"),0],["النصيب من مبيعات الفروع",cards.map(c=>pct(c.share)),0]);if(cards.every(c=>c.short))M.push(["صنف يبيعه ورصيده ناقص",cards.map(c=>c.short.n),-1],["أصناف راكدة",cards.map(c=>c.idle.n),-1],["قطع راكدة",cards.map(c=>c.idle.pcs),-1])}
 const best=(v,d)=>{if(!d||v.some(x=>typeof x!=="number"))return -1;const b=d>0?Math.max.apply(null,v):Math.min.apply(null,v);return v.filter(x=>x===b).length===1?v.indexOf(b):-1};
 const rows=R.rows.slice(0,40),lab=r=>R.by==="var"?varL(r.k):codeL(r.k);
 LASTX={name:"مقارنة-فروع",head:[R.by==="var"?"اللون والمقاس":"الكود"].concat(...R.tis.map(ti=>[DATA.st[ti]+" مبيعات",DATA.st[ti]+" رصيد"])),rows:()=>R.rows.map(r=>[R.by==="var"?DATA.k[r.k].slice(1,3).join(" "):r.k].concat(...r.v.map(x=>[x.sold,x.on])))};
 return `<div class="stk-ttl"><h3>مقارنة الفروع</h3>${ctxL(a,"store")}</div>
 <div class="stk-pan"><div class="tw"><table class="stk-t stk-cmp"><thead><tr><th></th>${R.tis.map(ti=>`<th class="n">${stL(ti)}</th>`).join("")}</tr></thead><tbody>${M.map(m=>{const b=best(m[1],m[2]);return `<tr><td>${m[0]}</td>${m[1].map((v,i)=>`<td class="n${i===b?" best":""}">${typeof v==="number"?fmt(v):`<bdi dir="ltr" data-notr>${E(v)}</bdi>`}</td>`).join("")}</tr>`}).join("")}</tbody></table></div></div>
 ${rows.length?`<div class="stk-pan" style="margin-top:12px"><h3 class="stk-ph">${R.by==="var"?"الألوان والمقاسات":"الأكواد الأعلى مبيعاً في هذه الفروع معاً"} (المبيعات، وتحتها الرصيد)</h3><div class="tw"><table class="stk-t stk-mx"><thead><tr><th class="s">${R.by==="var"?"اللون والمقاس":"الكود"}</th>${R.tis.map(ti=>`<th>${sn(ti)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td class="s">${lab(r)}</td>${r.v.map(x=>`<td class="${x.on<=0&&x.sold>0?"need":""}"><b>${fmt(x.sold)}</b><i>رصيد ${fmt(x.on)}</i></td>`).join("")}</tr>`).join("")}</tbody></table></div>${R.rows.length>rows.length?`<p class="stk-src">معروض ${fmt(rows.length)} من ${fmt(R.rows.length)}. القائمة كلها في «إكسل».</p>`:""}</div>`:""}`;
}
function ansCmpCodes(a,P){
 const R=cmpCodes(DATA,CFG,a.cmp.codes,{store:a.store,period:P});if(!R){LASTX=null;return em("اكتب كودين على الأقل موجودين في ملف الكميات.")}
 const top=R.rows[0],mx=Math.max(1,...R.rows.map(r=>Math.max(0,r.sold))),tie=R.rows.length>1&&R.rows[1].sold===top.sold;
 LASTX={name:"مقارنة-أكواد",head:["الترتيب","الكود","المبيعات","النصيب","الرصيد","رصيد المستودع","فروع باعت منه","نسبة ما بيع","فروع هو الأعلى فيها"],rows:()=>R.rows.map((r,i)=>[i+1,r.code,r.sold,r.share==null?"":Math.round(r.share*1000)/10+"%",r.on,r.wh,r.nSold,r.thru==null?"":Math.round(r.thru*1000)/10+"%",r.wins])};
 const T=[tile(tie?"—":top.code,tie?"تعادل في المبيعات":"الأعلى مبيعاً بينها","k"),tile(fmt(top.sold),"قطعة باعها الأعلى"),tile(pct(top.share),"نصيبه من مبيعات هذه الأكواد"),tile(fmt(R.tot),"مبيعات الأكواد معاً")];
 const sv=R.stores.slice(0,40);
 return `<div class="stk-ttl"><h3>مقارنة الأكواد</h3>${ctxL(a,"code")}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-pan"><div class="tw"><table class="stk-t"><thead><tr><th class="n">#</th><th>الكود</th><th class="n">المبيعات</th><th class="n">النصيب</th><th class="n">${a.store?"رصيد الفرع":"الرصيد"}</th><th class="n">المستودع</th>${a.store?"":`<th class="n">فروع باعت</th>`}<th class="n">نسبة ما بيع</th>${a.store?"":`<th class="n">الأعلى في</th>`}</tr></thead><tbody>${R.rows.map((r,i)=>`<tr><td class="n rk">${i+1}</td><td class="c">${codeL(r.code)}</td><td class="n${i===0&&!tie?" win":""}"><b>${fmt(r.sold)}</b><span class="stk-cbar" style="width:${Math.round(Math.max(0,r.sold)/mx*100)}%"></span></td><td class="n">${pct(r.share)}</td><td class="n${r.on<=0?" z":""}">${fmt(r.on)}</td><td class="n${r.wh<=0?" z":""}">${fmt(r.wh)}</td>${a.store?"":`<td class="n">${fmt(r.nSold)}</td>`}<td class="n">${pct(r.thru)}</td>${a.store?"":`<td class="n">${fmt(r.wins)} فرع</td>`}</tr>`).join("")}</tbody></table></div></div>
 ${!a.store&&sv.length?`<div class="stk-pan" style="margin-top:12px"><h3 class="stk-ph">في كل فرع: المبيعات، وتحتها الرصيد (الأخضر الأعلى في الفرع)</h3><div class="tw"><table class="stk-t stk-mx"><thead><tr><th class="s">الفرع</th>${R.rows.map(r=>`<th data-notr dir="ltr">${E(r.code)}</th>`).join("")}</tr></thead><tbody>${sv.map(s=>`<tr><td class="s">${stL(s.ti)}</td>${s.v.map(x=>`<td class="${s.mx>0&&x.sold===s.mx?"win":x.on<=0&&x.sold>0?"need":""}"><b>${fmt(x.sold)}</b><i>رصيد ${fmt(x.on)}</i></td>`).join("")}</tr>`).join("")}</tbody></table></div>${R.stores.length>sv.length?`<p class="stk-src">معروض ${fmt(sv.length)} من ${fmt(R.stores.length)}.</p>`:""}</div>`:""}`;
}
function ansCmpP(a,P,B){
 if(!P||!B){LASTX=null;return em("مقارنة فترتين تحتاج فترة أولى محددة (اختر «فترة أحددها») وفترة مقارنة.")}const R=cmpPeriods(DATA,CFG,{a:P,b:B,store:a.store,code:a.code,cl:a.cl,z:a.z,vendor:a.vendor});if(!R){LASTX=null;return em("لا بيانات بهذه الشروط: الكود أو الفرع أو المورد غير موجود في ملف الكميات.")}
 const dd=x=>Math.round((new Date(x.to+"T12:00:00")-new Date(x.from+"T12:00:00"))/864e5)+1,la=dd(P),lb=dd(B),fm=x=>x.from.slice(8)==="01"&&x.from.slice(0,7)===x.to.slice(0,7)&&+x.to.slice(8,10)===new Date(+x.to.slice(0,4),+x.to.slice(5,7),0).getDate(),/* شهر كامل */sp=d=>`<bdi data-notr dir="ltr">${E(d)}</bdi>`,rg=x=>sp(x.from)+" ← "+sp(x.to);
 const lab=g=>R.by==="store"?stL(g.k):R.by==="var"?varL(g.k):codeL(g.k),txt=g=>R.by==="store"?DATA.st[g.k]:R.by==="var"?DATA.k[g.k].slice(1,3).join(" "):String(g.k),d=R.a.sold-R.b.sold;
 LASTX={name:"مقارنة-فترتين",head:[R.by==="store"?"الفرع":R.by==="var"?"اللون والمقاس":"الكود","الفترة الأولى","فترة المقارنة","الفرق"],rows:()=>R.rows.map(g=>[txt(g),g.a,g.b,g.d])};
 const T=[tile(fmt(R.a.sold),"قطعة في الفترة الأولى","k"),tile(fmt(R.b.sold),"قطعة في فترة المقارنة"),tile(sg(d),"الفرق",d<0?"bad":"k"),tile(R.b.sold>0?(d>0?"+":"")+pct(d/R.b.sold):"—","نسبة التغيّر"),tile(fmt(R.a.days)+" / "+fmt(R.b.days),"أيام فيها بيع (الأولى / المقارنة)"),tile(fmt(R.a.ret)+" / "+fmt(R.b.ret),"قطع مرتجعة (الأولى / المقارنة)")];
 const NM=R.by==="store"?"الفرع":R.by==="var"?"اللون والمقاس":"الكود",tb=L=>`<table class="stk-t"><thead><tr><th>${NM}</th><th class="n">الأولى</th><th class="n">المقارنة</th><th class="n">الفرق</th></tr></thead><tbody>${L.slice(0,20).map(g=>`<tr><td${R.by==="code"?` class="c"`:""}>${lab(g)}</td><td class="n">${fmt(g.a)}</td><td class="n">${fmt(g.b)}</td><td class="n ${g.d>0?"up":"dn"}">${sg(g.d)}</td></tr>`).join("")}</tbody></table>`;
 return `<div class="stk-ttl"><h3>مقارنة فترتين</h3><small>الأولى: ${rg(P)} · المقارنة: ${rg(B)}</small>${ctxL(a)}</div><div class="stk-tiles">${T.join("")}</div>
 ${la!==lb&&!(fm(P)&&fm(B))?`<div class="stk-rep w">الفترتان مختلفتان في الطول (${fmt(la)} يوماً مقابل ${fmt(lb)} يوماً)، فالفرق ليس مقارنة يوم بيوم.</div>`:""}
 <div class="stk-up"><div class="stk-card"><h3>الأكثر صعوداً (${fmt(R.up.length)})</h3>${R.up.length?tb(R.up):`<p>لا شيء ارتفع.</p>`}</div><div class="stk-card"><h3>الأكثر هبوطاً (${fmt(R.down.length)})</h3>${R.down.length?tb(R.down):`<p>لا شيء انخفض.</p>`}</div></div>`;
}
function ansStore(a,P){
 const R=storeCard(DATA,CFG,a.store,P);if(!R){LASTX=null;return em("هذا الفرع غير موجود في ملف الكميات.")}
 const rcOn=R.rc!=null;
 LASTX={name:"فرع-"+cd(a.store),head:["الكود"].concat(rcOn?["المستلم من أول السنة"]:[],["المبيعات","الرصيد"]),rows:()=>R.top.map(c=>[c.code].concat(rcOn?[c.rc]:[],[c.sold,c.on]))};
 const T=[];if(rcOn)T.push(tile(fmt(R.rc),"قطعة استلمها من أول السنة","k"));T.push(tile(fmt(R.on),"قطعة عنده الآن","k"),tile(fmt(R.sold),"قطعة باعها (الصافي)","k"),tile(fmt(R.inSt),"صنف له رصيد عنده"));
 if(R.ret!=null)T.push(tile(fmt(R.ret),"قطعة مرتجعة"),tile(fmt(R.days),"يوم فيه بيع"));
 if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيبه بين الفروع في المبيعات"),tile(pct(R.share),"نصيبه من مبيعات الفروع"));
 if(R.short)T.push(tile(fmt(R.short.n),"صنف يبيعه ورصيده ناقص","go",` data-sk="goneed" role="button" tabindex="0"`),tile(fmt(R.idle.n),"صنف راكد عنده","go",` data-sk="gostale" role="button" tabindex="0"`),tile(fmt(R.idle.pcs),"قطعة راكدة"));
 T.push(tile(fmt(R.out.length),"صنف نفد عنده وهو يبيعه"));if(R.negN)T.push(tile(fmt(R.negN),"صنف رصيده سالب في السيستم","bad"));
 const top=R.top.slice(0,20),vs=R.vendors.filter(v=>v.sold||v.on).slice(0,15),out=R.out.slice(0,40);
 return `<div class="stk-ttl"><h3>${sn(R.ti)}</h3><small>${R.isWh?"مخزن المستودع":"بطاقة الفرع"}</small></div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-up"><div class="stk-card"><h3>أعلى الأصناف مبيعاً</h3>${top.length?`<table class="stk-t"><thead><tr><th>الكود</th>${rcOn?`<th class="n">استلم</th>`:""}<th class="n">المبيعات</th><th class="n">الرصيد</th></tr></thead><tbody>${top.map(c=>`<tr><td class="c" data-notr><a href="#" data-sk="acode" data-c="${E(c.code)}" style="color:inherit">${E(c.code)}</a></td>${rcOn?`<td class="n">${fmt(c.rc)}</td>`:""}<td class="n"><b>${fmt(c.sold)}</b></td><td class="n${c.on<=0?" z":""}">${fmt(c.on)}</td></tr>`).join("")}</tbody></table>`:`<p>لا مبيعات في الفترة.</p>`}</div>
 <div class="stk-card"><h3>حسب المورد</h3>${vs.length?`<table class="stk-t"><thead><tr><th>المورد</th><th class="n">المبيعات</th><th class="n">الرصيد</th></tr></thead><tbody>${vs.map(v=>`<tr><td data-notr style="white-space:normal">${E(v.v||"—")}</td><td class="n"><b>${fmt(v.sold)}</b></td><td class="n">${fmt(v.on)}</td></tr>`).join("")}</tbody></table>`:`<p>لا بيانات.</p>`}</div></div>
 ${out.length?`<div class="stk-pan"><h3 class="stk-ph">نفد عنده وهو يبيعه (${fmt(R.out.length)})</h3><div class="tw"><table class="stk-t"><thead><tr><th>الكود</th><th>اللون</th><th class="n">المقاس</th><th class="n">المبيعات</th><th class="n">رصيد الفرع</th><th class="n">رصيد المستودع</th></tr></thead><tbody>${out.map(l=>`<tr>${kCells(l.ki)}<td class="n"><b>${fmt(l.sold)}</b></td><td class="n z">${fmt(l.on)}</td><td class="n">${l.wh>0?fmt(l.wh):`<span class="no">0</span>`}</td></tr>`).join("")}</tbody></table></div></div>`:""}`;
}
function ansCode(a,P){
 const DR=P||yearR(),R=codeCard(DATA,CFG,a.code,{cl:a.cl,z:a.z,store:a.store,period:P,drange:P?null:DR});
 if(!R){LASTX=null;return em(`الكود <b data-notr dir="ltr">${E(a.code)}</b> غير موجود في ملف الكميات.`)}
 if(R.none){LASTX=null;return em("لا يوجد هذا اللون أو المقاس لهذا الكود.")}
 const cov=DR?coverage(META,DR):null,loaded=!!DR&&months(DR.from,DR.to).every(ym=>!(META.d&&META.d[ym])||DATA.d[ym]),dat=!!DR&&loaded,x0=DATA.k[R.ids[0]],sub=[a.cl,a.z].filter(Boolean).join(" · ");
 const rcOn=R.rc!=null,T=[],dT=()=>{if(!dat)return;T.push(tile(fmt(R.ret),"قطعة مرتجعة"),tile(fmt(R.days),"يوم فيه بيع"));if(R.first&&!a.store)T.push(tile(R.first,"أول يوم بيع","dt"));if(R.last)T.push(tile(R.last,"آخر يوم بيع","dt"))};
 let tabs="";
 if(a.store){const me=R.me,mn=k=>minOf(CFG,DATA,k);
  LASTX={name:"صنف-"+a.code+"-"+cd(a.store),head:["اللون","المقاس"].concat(rcOn?["استلمه الفرع من أول السنة"]:[],["رصيد الفرع","مبيعات الفرع","رصيد المستودع"]),rows:()=>R.vars.map(v=>{const x=DATA.k[v.ki];return [x[1],x[2]].concat(rcOn?[v.rc]:[],[v.on,v.sold,v.wh])})};
  if(rcOn)T.push(tile(fmt(R.rc),"قطعة استلمها الفرع من أول السنة","k"));
  T.push(tile(fmt(R.on),"قطعة عند الفرع الآن","k"),tile(fmt(R.sold),"قطعة باعها الفرع (الصافي)","k"));dT();T.push(tile(fmt(R.wh),"قطعة في المستودع"));
  if(R.rank)T.push(tile(R.rank+" / "+R.of,"ترتيب الفرع في هذا الصنف"),tile(pct(R.share),"نصيبه من مبيعات الصنف"));
  const vs=R.vars.filter(v=>v.on||v.sold||v.wh||v.rc);
  tabs=`<div class="stk-pan"><h3 class="stk-ph">الألوان والمقاسات عند الفرع</h3>${vs.length?`<div class="tw"><table class="stk-t"><thead><tr><th>اللون</th><th class="n">المقاس</th>${rcOn?`<th class="n">استلم</th>`:""}<th class="n">رصيد الفرع</th><th class="n">مبيعات الفرع</th><th class="n">رصيد المستودع</th></tr></thead><tbody>${vs.map(v=>{const x=DATA.k[v.ki],need=me&&me.ti!==DATA.sti.get(CFG.wh)&&v.on<mn(v.ki)&&v.sold>0;return `<tr><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td>${rcOn?`<td class="n">${fmt(v.rc)}</td>`:""}<td class="n${need?" z":""}">${fmt(v.on)}</td><td class="n"><b>${fmt(v.sold)}</b></td><td class="n">${fmt(v.wh)}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="stk-em">لا رصيد ولا مبيعات لهذا الصنف في هذا الفرع.</div>`}</div>`}
 else{LASTX={name:"صنف-"+a.code,head:["الفرع"].concat(rcOn?["المستلم من أول السنة"]:[],["الرصيد","المبيعات","آخر يوم بيع"]),rows:()=>R.stores.map(s=>[DATA.st[s.ti]].concat(rcOn?[s.rc]:[],[s.on,s.sold,s.last]))};
  if(rcOn)T.push(tile(fmt(R.rc),"قطعة استلمتها الفروع من أول السنة","k"));
  T.push(tile(fmt(R.sold),"قطعة مباعة (الصافي)","k"),tile(fmt(R.nSold),"فرع باع منه"),tile(fmt(R.wh),"قطعة في المستودع","k"),tile(fmt(R.br),"قطعة في الفروع"));dT();if(R.thru!=null)T.push(tile(pct(R.thru),"نسبة ما بيع منه"));
  const vs=R.vars.filter(v=>v.wh||v.br||v.sold);
  tabs=`<div class="stk-up"><div class="stk-card"><h3>الفروع</h3><table class="stk-t"><thead><tr><th>الفرع</th>${rcOn?`<th class="n">استلم</th>`:""}<th class="n">الرصيد</th><th class="n">المبيعات</th><th class="n">النصيب</th>${dat?`<th class="n">آخر بيع</th>`:""}</tr></thead><tbody>${R.stores.map(s=>`<tr><td><a href="#" data-sk="pick" data-k="store" data-v="${E(DATA.st[s.ti])}" style="color:inherit">${sn(s.ti)}</a></td>${rcOn?`<td class="n">${fmt(s.rc)}</td>`:""}<td class="n${s.on<=0?" z":""}">${fmt(s.on)}</td><td class="n"><b>${fmt(s.sold)}</b></td><td class="n">${R.allSold>0?pct(s.sold/R.allSold):"—"}</td>${dat?`<td class="n" data-notr>${E(s.last||"—")}</td>`:""}</tr>`).join("")}</tbody></table></div>
  <div class="stk-card"><h3>الألوان والمقاسات</h3><table class="stk-t"><thead><tr><th>اللون</th><th class="n">المقاس</th>${rcOn?`<th class="n">استلمته الفروع</th>`:""}<th class="n">المستودع</th><th class="n">الفروع</th><th class="n">المبيعات</th></tr></thead><tbody>${vs.slice(0,80).map(v=>{const x=DATA.k[v.ki];return `<tr><td data-notr>${E(x[1]||"—")}</td><td class="n" data-notr>${E(x[2]||"—")}</td>${rcOn?`<td class="n">${fmt(v.rc)}</td>`:""}<td class="n${v.wh<=0?" z":""}">${fmt(v.wh)}</td><td class="n">${fmt(v.br)}</td><td class="n"><b>${fmt(v.sold)}</b></td></tr>`}).join("")}</tbody></table></div></div>`}
 const nt=[];
 if(!P&&DR&&!loaded)nt.push(`<div class="stk-rep">أيام البيع وآخر يوم بيع تظهر بعد تحميل ملفات التاريخ…</div>`);
 if(!P&&!DR)nt.push(`<div class="stk-rep">عدد أيام البيع وأول وآخر يوم بيع والمرتجع تظهر هنا عندما تغطي ملفات التاريخ السنة كلها، أو عندما تختار فترة مرفوعة من خانة «الفترة». المبيعات والأرصدة أعلاه كاملة من ملف الكميات.</div>`);
 if(!P&&dat&&cov&&cov.ok&&!near(R.dnet,R.sold))nt.push(`<div class="stk-rep w">⚠️ ملفات التاريخ تعطي <b data-notr>${fmt(R.dnet)}</b> قطعة لهذا الصنف وملف الكميات يعطي <b data-notr>${fmt(R.sold)}</b>. المعروض من ملف الكميات. راجع «فحص المطابقة» في تبويب «الملفات».</div>`);
 return `<div class="stk-ttl"><h3 data-notr><bdi dir="ltr">${E(a.code)}</bdi>${sub?` <small>${E(sub)}</small>`:""}</h3><small data-notr>${x0[3]>=0?E(DATA.vn[x0[3]]):""}</small>${a.store?`<small>الفرع: ${sn(R.me.ti)}</small>`:""}</div><div class="stk-tiles">${T.join("")}</div>
 <div class="stk-act"><button class="bt" type="button" data-sk="goitem">🔍 جدول الصنف في كل الفروع</button>${dHas()?`<button class="bt" type="button" data-sk="gosales">📅 مبيعاته يوماً بيوم</button>`:""}${a.store?`<button class="bt" type="button" data-sk="pick" data-k="store" data-v="">كل الفروع لهذا الصنف</button>`:""}</div>${nt.join("")}${tabs}`;
}
function body(){
 if(LOADING&&!DATA)return `<div class="stk-busy">جاري تحميل بيانات المخزون…</div>`;
 if(X.ro&&UI.tab==="cfg")UI.tab="home";if(UI.tab==="val"&&!X.sv)UI.tab="home";if(UI.tab==="plan")UI.tab="home";// (v194) صلاحية المشاهدة: بلا تبويب القواعد
 const has=DATA&&DATA.has,t=has?UI.tab:"up",q=META&&META.q;if(has)envSync();
 const hd=`<div class="stk-hd"><div><small>${q?`آخر ملف كميات: <span data-notr dir="ltr">${dts(q.at)}</span> · ${fmt(q.skus)} صنف${q.to?` · المبيعات حتى <span data-notr dir="ltr">${E(addDays(q.to,-1))}</span>`:""}`:"ارفع ملف الكميات لتبدأ"}</small></div></div>`;
 const tabs=`<nav class="stk-tabs" aria-label="أقسام تحليل المخزون">${TABS.filter(a=>(has||a[0]==="up")&&!(X.ro&&a[0]==="cfg")&&!(a[0]==="val"&&!X.sv)).map(a=>`<button type="button" class="${t===a[0]?"on":""}" data-sk="tab" data-t="${a[0]}">${a[1]} ${a[2]}</button>`).join("")}</nav>`;
 const busy=BUSY?`<div class="stk-busy">${E(BUSY)} <span id="stk-pg" data-notr></span></div>`:"";
 // ملف الكميات أقدم من اليوم: الأرصدة المعروضة ليست أرصدة اللحظة
 const old=q&&q.to&&q.to<today()?Math.round((new Date(today()+"T12:00:00")-new Date(q.to+"T12:00:00"))/864e5):0;
 const stl=has&&old>0&&t!=="up"?`<div class="stk-rep w">ملف الكميات المرفوع قديم (${old===1?"من أمس":"منذ "+old+" يوماً"}): الأرصدة هنا حتى نهاية يوم <b data-notr>${E(qEnd())}</b>. ارفع ملف اليوم من تبويب «الملفات» لتكون الأرقام محدَّثة.</div>`:"";
 let v="";try{v=t==="up"?vUp():!has?vUp():t==="home"?vHome():t==="buy"?vBuy():t==="dist"?vDist():t==="ask"?vAsk():t==="need"?vNeed():t==="tr"?vTr():t==="out"?vOut():t==="plan"?vPlan():t==="item"?vItem():t==="pur"?vPur():t==="val"?vVal():t==="sales"?vSales():t==="stale"?vStale():vCfg()}catch(e){v=`<div class="stk-rep r">تعذّر عرض هذا التبويب (${E(String(e&&e.message||e).slice(0,80))}).</div>`}
 const mf=Object.keys(MFAIL).sort(),mfl=mf.join(" · "),fail=mf.length&&t!=="up"&&t!=="cfg"?`<div class="stk-rep r">تعذّر تحميل مبيعات هذه الشهور من ملفات التاريخ: <b data-notr>${E(mfl)}</b>، فالمبيعات المعروضة للفترة ناقصة بقدرها. تأكد من الإنترنت ثم <button class="bt s" type="button" data-sk="mretry">أعد المحاولة</button></div>`:"";
 return hd+tabs+busy+(t!=="cfg"?stl:"")+fail+v;
}
const RO_ACT=["cfgsave","cfgdef","pub","tabs","mk","mkgo","dgo","nmk","nmkgo","mkc","pgo","pdst"];// ما لا يفعله صاحب صلاحية المشاهدة (والقواعد ترفضه أصلاً)
let PT=0;
function paint(keepFocus){
 if(!ROOT)return;const a=document.activeElement,id=a&&ROOT.contains(a)?a.id:"",s0=a&&id?[a.selectionStart,a.selectionEnd]:null;
 ROOT.innerHTML=body();
 if(X&&X.nav)try{X.nav()}catch(e){}/* (v226) أقسام المديول في القائمة الجانبية: القسم المفتوح والأقسام المتاحة */
 if(id&&keepFocus!==false){const el=g(id);if(el&&el.focus){try{el.focus({preventScroll:true});if(s0&&s0[0]!=null&&el.setSelectionRange)el.setSelectionRange(s0[0],s0[1])}catch(e){}}}
 // فترة تحتاج شهوراً لم تُحمَّل بعد
 const homeNeed=()=>{const p=period(),e=qEnd(),f0=prevYm(e.slice(0,7))+"-01",f6=addDays(e,-59),b=dHas()?{from:f0<f6?f0:f6,to:e}:null;return p&&b?{from:p.from<b.from?p.from:b.from,to:p.to>b.to?p.to:b.to}:p||b};
 const P=UI.tab==="home"?homeNeed():UI.tab==="item"?itemNeed():UI.tab==="ask"?askNeed():UI.tab==="sales"?(UI.from&&UI.to&&UI.from<=UI.to?{from:UI.from,to:UI.to}:null):UI.tab==="pur"?(UI.pf&&UI.pt&&UI.pf<=UI.pt&&rcvMonths().length?{from:UI.pf,to:UI.pt}:null):(UI.tab==="up"||UI.tab==="cfg"||UI.tab==="val"?null:period());
 if(P&&!BUSY&&META&&META.d&&DATA&&months(P.from,P.to).some(ym=>META.d[ym]&&!DATA.d[ym]&&!MFAIL[ym]))needMonths(P.from,P.to);
 // (v248) شهور المشتريات اللازمة لاستثناء المستلم حديثاً من الراكد
 else if(!BUSY&&DATA&&DATA.has&&UI.tab!=="up"&&UI.tab!=="cfg"){const RR=rcvRange();if(RR&&months(RR.from,RR.to).some(ym=>META.d[ym]&&!DATA.d[ym]&&!MFAIL[ym]))needMonths(RR.from,RR.to)}
}
const later=()=>{clearTimeout(PT);PT=setTimeout(()=>paint(),260)};
function csv(){
 if(!LASTX)return;const q=v=>{let s=String(v==null?"":v);if(/^[=+\-@]/.test(s)&&isNaN(+s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const t="﻿"+[LASTX.head].concat(LASTX.rows()).map(r=>r.map(q).join(",")).join("\r\n"),a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob([t],{type:"text/csv;charset=utf-8"}));a.download="tasooma-"+LASTX.name+"-"+today()+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
}
function wire(){
 ROOT.addEventListener("click",e=>{const t=e.target.closest("[data-sk]");if(!t)return;const a=t.dataset.sk;
  if(X.ro&&RO_ACT.indexOf(a)>=0){e.preventDefault();if(X.toast)X.toast("هذا الإجراء للأدمن ومالك النظام فقط");return}// (v194) صلاحية المشاهدة
  if(a==="fclr"){String(t.dataset.k||"").split(",").forEach(k=>{if(k==="st"||k==="vn"||k==="q"||k==="min"||k==="fr"||k==="tt"||k==="son")UI[k]=""});UI.trx=null;UI.lim=200;paint(false)}
  else if(a==="iclr"){UI.code="";UI.cl="";UI.sz="";paint(false);const el=g("stk-code");if(el)try{el.focus()}catch(x){}}
  else if(a==="tab"){if(UI.tab!==t.dataset.t){UI.q="";UI.fr="";UI.tt="";UI.trx=null}/* فتح تبويب باليد = عرض جديد بلا بحث الكود ولا زوج الفروع السابق */UI.tab=t.dataset.t;UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="more"){UI.lim+=400;paint()}
  else if(a==="xls")csv();
  else if(a==="prn")printX();
  else if(a==="mkc")mkCode(t.dataset.c||"");
  else if(a==="ps"){UI.ps=t.dataset.v==="t"?"t":"n";UI.px="";paint(false)}
  else if(a==="pexp"){const v=String(t.dataset.v||"");UI.px=UI.px===v?"":v;paint(false);if(UI.px){const r=ROOT.querySelector("tr.oxo");if(r&&r.scrollIntoView)try{r.scrollIntoView({block:"nearest"})}catch(e){}}}
  else if(a==="pgo")planSend(N(t.dataset.v));
  else if(a==="pdst")mkDst(N(t.dataset.v));
  else if(a==="pneed"){UI.q="";UI.vn="";UI.st=t.dataset.v||"";UI.sold=1;UI.tab="need";UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="ptr"){UI.q="";UI.vn="";UI.fr="";UI.tt=t.dataset.v||"";UI.trv="pair";UI.tab="tr";UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="oexp"){const c=t.dataset.c||"";UI.ox=UI.ox===c?"":c;paint(false);if(UI.ox){const r=ROOT.querySelector("tr.oxo");if(r&&r.scrollIntoView)try{r.scrollIntoView({block:"nearest"})}catch(e){}}}
  else if(a==="omore"){UI.olim=(UI.olim||40)+40;paint(false)}
  else if(a==="obuy"){UI.q=t.dataset.c||"";UI.vn="";UI.tab="buy";UI.bx=UI.q;UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="ibuy"){UI.q=UI.code;UI.vn="";UI.tab="buy";UI.bx=UI.code;UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="iall"){UI.iall=true;paint(false)}
  else if(a==="ipvt"){UI.ipv=!UI.ipv;paint(false)}
  else if(a==="isort"){UI.isort=t.dataset.v==="st"?"st":t.dataset.v==="on"?"on":"sold";paint(false)}
  else if(a==="ihm"){UI.ihm=t.dataset.v==="sold"?"sold":"on";paint(false)}
  else if(a==="lxt"){UI.lx={w:t.dataset.w||"",t:"store",v:""};paint(false);const el=g("stk-lxw");if(el){try{el.scrollIntoView({block:"center"})}catch(x){}}}
  else if(a==="lxx"){UI.lx=null;paint(false)}
  else if(a==="lxs")lexSaveForm();
  else if(a==="lxo"){const L=lexLoad();L.open=!L.open;paint(false)}
  else if(a==="lxd"){const L=lexLoad(),e=L.d[N(t.dataset.i)];if(e){const k=normAr(e.w);lexDb(T=>{T.d=T.d.filter(x=>normAr(x.w)!==k)})}if(UI.aq&&UI.a)doAsk(UI.aq);else paint(false)}
  else if(a==="lxuc"){lexDb(T=>{T.u=T.u.filter(e=>!e.w)});paint(false)}
  else if(a==="lqo"){const L=lexLoad();L.qo=!L.qo;paint(false)}
  else if(a==="lqa")lqAdd();
  else if(a==="lqc")lqCopy();
  else if(a==="lqd"){const k=normAr(t.dataset.x||"");lexDb(T=>{T.u=T.u.filter(e=>e.w||normAr(e.q)!==k)});paint(false)}
  else if(a==="lqk"){const ok=lqList(lexLoad()).filter(e=>e.ok).map(e=>normAr(e.q));lexDb(T=>{T.u=T.u.filter(e=>e.w||ok.indexOf(normAr(e.q))<0)});paint(false)}
  else if(a==="lqx"){if(!confirm("مسح كل الأسئلة من القائمة؟ (لكل من يفتح «تحليل المخزون»)"))return;lexDb(T=>{T.u=T.u.filter(e=>e.w)});paint(false)}
  else if(a==="lxp"){const L=lexLoad(),q=String(UI.aq||"").trim().slice(0,200);if(q){const on=L.p.indexOf(q)<0;lexDb(T=>{T.p=T.p.filter(x=>x!==q);if(on)T.p.unshift(q)});paint(false)}}
  else if(a==="lxup"){const q=t.dataset.x;lexDb(T=>{T.p=T.p.filter(x=>x!==q)});paint(false)}
  else if(a==="nmk"){if(!nSel().length){if(X.toast)X.toast("حدِّد السطور أولاً بالمربع في أول كل سطر");return}UI.nrx={q:{}};paint(false);try{ROOT.scrollIntoView({block:"start"})}catch(x){}}
  else if(a==="nmkx"){UI.nrx=null;paint(false)}
  else if(a==="nmkgo")nSend();
  else if(a==="nsclr"){UI.nsel={};UI.nrx=null;paint(false)}
  else if(a==="tsclr"){UI.tsel={};paint(false)}
  else if(a==="code"){e.preventDefault();UI.code=t.dataset.c;UI.tab="item";UI.cl="";UI.sz="";paint(false);window.scrollTo(0,0)}
  else if(a==="ask"){const el=g("stk-ask");doAsk(el?el.value:UI.aq)}
  else if(a==="ex")doAsk(t.dataset.x);
  else if(a==="pick"&&UI.a){e.preventDefault();const k=t.dataset.k;if(k==="store"||k==="code"||k==="cl"||k==="vendor"){UI.a[k]=t.dataset.v||"";UI.a.amb[k]=[];if(k==="code"){UI.a.cl="";UI.a.z="";UI.a.amb.cl=[]}paint(false)}}
  // (v180) اسم في جدول ترتيب أو مقارنة ← بطاقته (بلا ترتيب ولا مقارنة ولا «مين عنده»)
  else if(a==="rgo"&&UI.a){e.preventDefault();const q=UI.a,k=t.dataset.k,v=t.dataset.v||"";if(k!=="store"&&k!=="code"&&k!=="vendor")return;if(q.cmp&&q.cmp.st)q.store=k==="store"?v:"";q[k]=v;if(k==="code"){q.cl="";q.z="";if(q.zs&&q.zs.length===1)q.z=q.zs[0];q.zs=[];q.cls=[]}q.rank=null;q.where=false;q.cmp=null;UI.lim=200;paint(false);window.scrollTo(0,0)}
  // (v187) توزيع حاوية
  else if(a==="dadd"){dLoad().lines.push(dBlank());dSave();paint(false);const el=g("dl"+(DS.lines.length-1)+"c");if(el)try{el.focus()}catch(x){}}
  else if(a==="ddel"){const S=dLoad(),i=+t.dataset.i,nv={};if(!(i>=0&&i<S.lines.length))return;S.lines.splice(i,1);Object.keys(S.ov).forEach(k=>{const p=k.split("|"),j=+p[0];if(j<i)nv[k]=S.ov[k];else if(j>i)nv[(j-1)+"|"+p[1]]=S.ov[k]});S.ov=nv;while(S.lines.length<3)S.lines.push(dBlank());dSave();paint(false)}
  else if(a==="dclr"){if(!confirm("مسح كل أصناف الحاوية وتعديلات اليد؟ (القواعد تبقى)"))return;const S=dLoad();S.lines=[dBlank(),dBlank(),dBlank()];S.ov={};S.sent={};S.ctn={};UI.dsn=false;dSave();paint(false)}
  else if(a==="dpaste"){UI.dp=!UI.dp;paint(false);const el=g("stk-dpt");if(el)try{el.focus()}catch(x){}}
  else if(a==="dpok"){const el=g("stk-dpt"),S=dLoad();if(!el)return;let n=0;
   // (v198) بيان بالعرض (المقاسات أعمدة): كل خانة = سطر بالحبة. تعديلات اليد تُلغى لأن ترقيم السطور يتغيّر
   // (v265) والبيان بالطول (سطر لكل مقاس وكراتينه: بيان الشال) كمان: كراتين السطر في cn
   const ST0=parseList(el.value),ST=ST0.ok?ST0:parseStatement(el.value);if(ST.ok){S.lines=S.lines.filter(l=>String(l.c||"").trim()||N(l.ct)>0);S.ov={};if(!ST.tall)S.ctn=Object.assign(S.ctn&&typeof S.ctn==="object"?S.ctn:{},ST.ctn);let add=0;for(const x of ST.lines){if(S.lines.length>=DMAX)break;const o=S.lines.find(l=>l.md==="p"&&String(l.c).trim()===x.c&&String(l.cl||"").trim()===x.cl&&String(l.z||"").trim()===x.z);if(o){o.ct=x.q;if(x.cn)o.cn=x.cn;else delete o.cn}else{const nl={c:x.c,cl:x.cl,z:x.z,ct:x.q,pk:"",md:"p",ref:""};if(x.cn)nl.cn=x.cn;S.lines.push(nl)}add++}
    while(S.lines.length<3)S.lines.push(dBlank());UI.dp=false;UI.dvw="w";dSave();paint(false);if(X.toast)X.toast("قُرئ البيان: "+ST.colors+" لون × "+ST.sizes.length+" مقاس = "+add+" خانة"+(add<ST.lines.length?" (الباقي تجاوز الحد "+DMAX+")":""));return}
   S.lines=S.lines.filter(l=>String(l.c||"").trim()||N(l.ct)>0);
   String(el.value||"").split(/\r?\n/).forEach(row=>{const p=row.split(row.indexOf("\t")>=0?"\t":/[,;،]/).map(s=>String(s).trim());if(!p[0]||S.lines.length>=DMAX)return;const ct=N(arDig(p[3]||"")),pk=N(arDig(p[4]||""));if(!(ct>0)&&!/\d/.test(p[0]))return;/* سطر عناوين */S.lines.push({c:p[0].slice(0,40),cl:(p[1]||"").slice(0,40),z:(p[2]||"").slice(0,20),ct:ct>0?ct:"",pk:pk>0?pk:"",md:"c",ref:""});n++});
   while(S.lines.length<3)S.lines.push(dBlank());UI.dp=false;dSave();paint(false);if(X.toast)X.toast(n?"أُضيف "+n+" سطر":"لم أجد صفوفاً صالحة")}
  else if(a==="dro"){UI.dro=!UI.dro;paint(false)}
  else if(a==="dvw"){UI.dvw=t.dataset.v==="l"?"l":"w";paint(false)}
  else if(a==="dunit"){const S=dLoad();S.rules.unit=t.dataset.v==="p"?"p":"c";S.ov={};dSave();paint(false)}// (v265) بالكرتون / بالحبة (تعديلات اليد تُلغى لأن الوحدة اتغيّرت)
  else if(a==="prnb"||a==="xlsb"){if(!BRX){if(X.toast)X.toast("لا بيان للطباعة");return}const o=LASTX;LASTX=BRX;try{if(a==="prnb")printX();else csv()}finally{LASTX=o}}
  else if(a==="ddef"){const S=dLoad();S.rules=Object.assign({},DDEF,{lv:{}});S.ov={};dSave();paint(false)}
  else if(a==="dovx"){dLoad().ov={};dSave();paint(false)}
  // (v188) التوزيع ← طلبات، ومراجعة التحويل قبل إنشائه
  else if(a==="dsn"){UI.dsn=!UI.dsn;UI.dsel={};paint(false)}
  else if(a==="dsall"){const S=dLoad(),v=t.dataset.v==="1";UI.dsel={};DORD.forEach(o=>{const s=S.sent[o.c];if(!(s&&s.h===o.h))UI.dsel[o.c]=v});paint(false)}
  else if(a==="dgo")dSend();
  else if(a==="mkx"){UI.trx=null;UI.fr="";UI.tt="";paint(false)}
  else if(a==="mkgo"&&UI.trx)mkTransfer(UI.trx.f,UI.trx.d,UI.trx.q||{});
  // (v186) اليوم / الشراء / التحويلات بالكود
  else if(a==="trv"){UI.trv=t.dataset.v==="code"?"code":"pair";UI.lim=200;paint(false)}
  else if(a==="trc"){UI.q=t.dataset.c||"";UI.fr="";UI.tt="";UI.trv="pair";UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="bx"){UI.bx=UI.bx===t.dataset.c?"":t.dataset.c;paint(false)}
  else if(a==="hgo"){const tb=t.dataset.t;if(tb!=="buy"&&tb!=="need"&&tb!=="tr"&&tb!=="stale")return;UI.q="";UI.st="";UI.vn="";UI.fr="";UI.tt="";if(tb==="tr")UI.trv=t.dataset.v==="code"?"code":"pair";if(tb==="need")UI.sold=1;UI.tab=tb;UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="hbx"||a==="hpl"){if(e.target&&e.target.closest&&e.target.closest("label.ck,input"))return;e.preventDefault();const v=String(t.dataset.v||"");UI.tab="home";UI.hx=a==="hbx"&&UI.hx===v?"":v;if(a==="hpl")UI.hk=t.dataset.s==="t"?"t":"n";paint(false);if(UI.hx){const d=g("stk-bd");if(d&&d.scrollIntoView){try{d.scrollIntoView({block:"start",behavior:"smooth"})}catch(x){}}}}
  else if(a==="hbk"){UI.hk=t.dataset.v==="t"?"t":"n";paint(false)}
  else if(a==="hprv"){UI.tab="tr";UI.trv="pair";UI.trx=null;UI.q="";UI.vn="";UI.fr=t.dataset.f||"";UI.tt=t.dataset.d||"";UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="hdp"){UI.dp=t.dataset.v==="30"||t.dataset.v==="ytd"?t.dataset.v:"m";paint(false)}
  else if(a==="hprn")printDash();
  else if(a==="hst"){e.preventDefault();UI.q="";UI.vn="";UI.st=t.dataset.v||"";UI.sold=1;UI.tab="need";UI.lim=200;paint(false);window.scrollTo(0,0)}
  // (v181) تحليل صنف
  else if(a==="vretry"){VALS=0;paint(false)}
  else if(a==="vst"){e.preventDefault();UI.vs=String(t.dataset.v||"");paint(false);window.scrollTo(0,0)}
  else if(a==="vq"){const l=valLast()||today(),v=t.dataset.v;if(v==="y"){UI.vf=l.slice(0,4)+"-01-01";UI.vt=l}else if(v==="pm"){const p=prevYm(l.slice(0,7));UI.vf=p+"-01";UI.vt=p+"-"+p2(dim(p))}else{UI.vf=l.slice(0,7)+"-01";UI.vt=l}paint(false)}
  else if(a==="pxd"){UI.pxd=UI.pxd===t.dataset.d?"":String(t.dataset.d||"");paint(false)}
  else if(a==="icode"){e.preventDefault();UI.code=t.dataset.c||"";UI.cl="";UI.sz="";paint(false)}
  else if(a==="ineed"||a==="istale"||a==="itr"){UI.q=UI.code;UI.st="";UI.vn="";UI.fr="";UI.tt="";if(a==="ineed")UI.sold=1;UI.tab=a==="ineed"?"need":a==="istale"?"stale":"tr";UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="ivn"){e.preventDefault();const v=t.dataset.v||"";UI.tab="ask";UI.aq="المورد "+v;UI.a=parseAsk(UI.aq,askCtx());UI.a.vendor=v;UI.a.amb.vendor=[];UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="pswap"){const r=UI.pr||"store",c=UI.pc===undefined?"size":UI.pc;if(c){UI.pr=c;UI.pc=r;paint()}}
  else if(a==="norank"&&UI.a){UI.a.rank=null;paint(false)}
  else if(a==="zrk"&&UI.a){UI.a.rank={dir:-1,n:60,by:"size",m:"sold"};UI.a.zs=[];UI.a.cls=[];UI.lim=200;paint(false)}
  else if(a==="mretry"){MFAIL={};paint(false)}
  else if(a==="foed"){const F=focLoad();F.open=!F.open;F.bad=[];paint(false)}
  else if(a==="fom"){const F=focLoad();F.m=t.dataset.v==="only"?"only":t.dataset.v==="off"?"off":"first";focSave();UI.lim=200;UI.trx=null;paint(false)}
  else if(a==="fovx"){const F=focLoad();F.v=F.v.filter(v=>v!==t.dataset.v);focSave();paint(false)}
  else if(a==="focx"){const F=focLoad();F.c=F.c.filter(c=>c!==t.dataset.c);focSave();paint(false)}
  else if(a==="foclr"){const F=focLoad();if(confirm("مسح قائمة التركيز كلها؟")){F.v=[];F.c=[];F.bad=[];focSave();paint(false)}}
  else if(a==="nowhere"&&UI.a){UI.a.where=false;paint(false)}
  else if(a==="nocmp"&&UI.a){const q=UI.a;if(q.cmp&&q.cmp.st)q.store=q.cmp.st[0]||"";if(q.cmp&&q.cmp.codes){q.code=q.cmp.codes[0]||"";q.cl="";q.z=""}q.cmp=null;paint(false)}
  else if(a==="acode"&&UI.a){e.preventDefault();UI.a.code=t.dataset.c;UI.a.cl="";UI.a.z="";UI.a.amb.code=[];paint(false);window.scrollTo(0,0)}
  else if((a==="goneed"||a==="gostale"||a==="goitem"||a==="gosales")&&UI.a){const q=UI.a,P=askP();
   if(a==="goitem"){UI.code=q.code;UI.tab="item"}
   else if(a==="gosales"){UI.code=q.code;UI.cl=q.cl;UI.sz=q.z;UI.st=q.store;if(P){UI.from=P.from;UI.to=P.to}UI.tab="sales"}
   else{UI.st=q.store;UI.vn=q.vendor||"";UI.q=(q.need||q.stale)&&q.code?q.code:"";UI.tab=a==="goneed"?"need":"stale";if(P){UI.per="c";UI.from=P.from;UI.to=P.to}else UI.per="ytd"}
   UI.lim=200;paint(false);window.scrollTo(0,0)}
  else if(a==="recon")doRecon();
  else if(a==="pub")publish(false);
  else if(a==="tabs")tabAll();
  else if(a==="recx"||a==="qx"){const X1=xOther(a==="recx"?"rec":t.dataset.k);if(X1){const keep=LASTX;LASTX=X1;csv();LASTX=keep}}
  else if(a==="ala"){const k=String(g("stk-an").value||"").trim().slice(0,40),s=g("stk-as").value;if(!k||!s){if(X.toast)X.toast("اكتب الاسم واختر المخزن");return}
   const rest=(CFG.ov||[]).filter(o=>!(o.t==="a"&&wkey(o.k)===wkey(k)));if(rest.length>=60){if(X.toast)X.toast("وصلت الحد الأقصى (60) للحدود الخاصة والأسماء");return}CFG.ov=rest.concat([{t:"a",k,s}]);ASKC=null;paint()}
  else if(a==="mk"){UI.trx={f:t.dataset.f,d:t.dataset.d,q:{}};UI.fr=t.dataset.f;UI.tt=t.dataset.d;UI.lim=200;paint(false);window.scrollTo(0,0)}/* (v188) مراجعة وتعديل الكميات أولاً */
  else if(a==="prv"){UI.trx=null;UI.fr=t.dataset.f;UI.tt=t.dataset.d;UI.lim=200;paint(false)}
  else if(a==="prsmore"){UI.prs=(UI.prs||8)+20;paint()}
  else if(a==="cfgsave")saveCfg();
  else if(a==="cfgdef"){CFG=Object.assign({},DEF,{ex:DEF.ex.slice(),ov:[]});paint()}
  else if(a==="ovx"){CFG.ov=(CFG.ov||[]).filter((o,i)=>i!==+t.dataset.i);ASKC=null;paint()}
  else if(a==="ova"){const ty=g("stk-ot").value,k=String(ty==="c"?g("stk-oc").value:g("stk-ov").value).trim(),mn=N(g("stk-om").value);if(!k||mn<1){if(X.toast)X.toast(ty==="c"?"اكتب الكود":"اختر المورد");return}
   CFG.ov=(CFG.ov||[]).filter(o=>!(o.t===ty&&o.k===k)).concat([{t:ty,k:k.slice(0,60),min:Math.min(9999,mn)}]);paint()}});
 const set=t=>{const af=t.dataset.af;
  // (v187) توزيع حاوية: خانة في الجدول (تعديل يد)، سطر صنف، قاعدة، مستوى فرع
  if(t.dataset.dsb!==undefined){UI.dsel=UI.dsel||{};UI.dsel[String(t.dataset.dsb).slice(0,3)]=!!t.checked;return true}
  if(t.dataset.nq!==undefined&&UI.nrx){UI.nrx.q=UI.nrx.q||{};UI.nrx.q[t.dataset.nq]=t.value===""?0:Math.max(0,Math.min(99999,Math.round(N(t.value))));return true}
  if(t.dataset.tq!==undefined&&UI.trx){const mx=Math.max(0,N(t.max));UI.trx.q=UI.trx.q||{};UI.trx.q[t.dataset.tq]=t.value===""?0:Math.max(0,Math.min(mx||99999,Math.round(N(t.value))));return true}
  if(t.dataset.dx!==undefined){const S=dLoad(),k=t.dataset.dx;if(t.value==="")delete S.ov[k];else S.ov[k]=Math.max(0,N(t.value));dSave();return true}
  if(t.dataset.dw!==undefined){const S=dLoad(),p=t.dataset.dw.split("|"),r=DWK.rows[+p[0]],z=DWK.cols[+p[1]],v=Math.max(0,N(t.value));if(!r||z===undefined||!(v>0)||S.lines.length>=DMAX)return false;S.lines.push({c:r.c,cl:r.cl,z,ct:v,pk:"",md:"p",ref:""});dSave();return true}
  if(t.dataset.dl!==undefined){const S=dLoad(),p=t.dataset.dl.split("|"),i=+p[0],f=p[1];if(!(i>=0&&i<S.lines.length)||["c","cl","z","ct","pk","md","ref"].indexOf(f)<0)return false;const l=S.lines[i];
   l[f]=f==="ct"||f==="pk"?(t.value===""?"":Math.max(0,N(t.value))):f==="md"?(t.value==="p"?"p":"c"):String(t.value).trim().slice(0,40);Object.keys(S.ov).forEach(k=>{if(k.split("|")[0]===String(i))delete S.ov[k]});dSave();return true}
  if(t.dataset.dr!==undefined){const S=dLoad(),k=t.dataset.dr;if(["on","wh","cs","cmin","cmax","ps","pmin","pmax","mode"].indexOf(k)<0)return false;S.rules[k]=k==="mode"?(t.value==="all"||t.value==="eq"?t.value:"smart"):(t.value===""?"":Math.max(0,N(t.value)));S.ov={};dSave();return true}
  if(t.dataset.dv!==undefined){const S=dLoad();S.rules.lv[String(t.dataset.dv).slice(0,3)]=Math.max(0,N(t.value));S.ov={};dSave();return true}
  if(af==="ccodes"&&UI.a){const q=UI.a,low=new Map();DATA.code.forEach((v,c)=>low.set(String(c).toLowerCase().replace(/\s+/g,""),c));const got=[],bad=[];
   String(t.value).split(/[,،؛\n]+/).map(s=>s.trim()).filter(Boolean).forEach(s=>{const c=low.get(s.toLowerCase().replace(/\s+/g,""));if(c){if(got.indexOf(c)<0)got.push(c);return}s.split(/\s+/).forEach(w=>{const c2=low.get(w.toLowerCase());if(c2){if(got.indexOf(c2)<0)got.push(c2)}else if(w)bad.push(w)})});
   q.unk=bad.slice(0,10);UI.lim=200;if(got.length>1)q.cmp={codes:got.slice(0,15)};else{q.cmp=null;q.code=got[0]||""}return true}
  if(af&&UI.a&&(af==="cst"||af==="rby"||af==="rm"||af==="rdir"||af==="rn"||af==="bfrom"||af==="bto")){const q=UI.a,v=t.value;UI.lim=200;
   if(af==="cst"){if(!q.cmp||!q.cmp.st)return false;const L=q.cmp.st.slice(),i=+t.dataset.i;if(v)L[i]=v;else L.splice(i,1);q.cmp.st=L.filter((s,j)=>s&&L.indexOf(s)===j).slice(0,4);if(q.cmp.st.length<2){q.store=q.cmp.st[0]||"";q.cmp=null}else q.store=q.cmp.st[0];return true}
   if(af==="bfrom"||af==="bto"){if(q.cmp&&q.cmp.b)q.cmp.b[af==="bfrom"?"from":"to"]=v;return true}
   if(!q.rank)return false;if(af==="rby")q.rank.by=v;else if(af==="rm")q.rank.m=v==="on"?"on":v==="rc"?"rc":"sold";else if(af==="rdir")q.rank.dir=v==="1"?1:-1;else q.rank.n=Math.max(1,Math.min(100,N(v)||10));return true}
  if(af&&UI.a){const q=UI.a;q[af]=t.value;UI.lim=200;if(af==="code"){q.code=String(t.value).trim();q.cl="";q.z="";q.amb.code=[];q.amb.cl=[]}if(af==="cl")q.z="";if(af==="store")q.amb.store=[];
   if(af==="per"&&t.value==="c"&&!(q.from&&q.to)){q.to=qEnd();q.from=addDays(q.to,-29)}return true}
  const k=t.dataset.sf;if(k){UI[k]=t.type==="checkbox"?(t.checked?1:0):t.value;UI.lim=200;if(k==="code"){UI.cl="";UI.sz=""}if(k==="cl")UI.sz="";return true}
  if(t.dataset.hck){const o=chkLoad(),k=String(t.dataset.hck).slice(0,20);if(t.checked)o[k]=1;else delete o[k];chkSave(o);return true}
  if(t.dataset.pr){const v=priParse(t.value).join(",");CFG.ov=(CFG.ov||[]).filter(o=>!(o&&o.t==="pri")).concat([{t:"pri",k:"pri",s:v}]);t.value=priParse(v).join(", ");return false}
  if(t.dataset.frs){const v=Math.max(0,Math.min(365,Math.round(N(t.value))));CFG.ov=(CFG.ov||[]).filter(o=>!(o&&o.t==="fr")).concat([{t:"fr",k:"fr",min:v}]);ENVK="";HOMEC=null;return false}
  if(t.dataset.cv){const v=Math.max(0,Math.min(365,Math.round(N(t.value))));CFG.ov=(CFG.ov||[]).filter(o=>!(o&&o.t==="cov")).concat([{t:"cov",k:"cov",min:v}]);HOMEC=null;return false}
  if(t.dataset.cf){const c=t.dataset.cf;CFG[c]=c==="wh"?t.value:Math.max(0,Math.min(9999,N(t.value)));return false}
  if(t.dataset.cx!==undefined){const s=new Set(CFG.ex||[]);if(t.checked)s.add(t.dataset.cx);else s.delete(t.dataset.cx);CFG.ex=[...s];return false}return false};
 ROOT.addEventListener("keydown",e=>{const t=e.target;if((e.key==="Enter"||e.key===" ")&&t&&t.dataset&&(t.dataset.sk==="oexp"||t.dataset.sk==="pexp")){e.preventDefault();t.click();return}if(e.key==="Enter"&&t&&t.id==="stk-ask"){e.preventDefault();doAsk(t.value)}
  else if(e.key==="Enter"&&t&&t.id==="stk-lqa"){e.preventDefault();lqAdd()}
  else if(e.key==="Enter"&&t&&(t.id==="stk-a-ccodes"||t.id==="stk-foc")){e.preventDefault();t.blur()}
  else if((e.key==="Enter"||e.key===" ")&&t&&t.classList&&t.classList.contains("go")){e.preventDefault();t.click()}});
 // (v184) خانة الكود/البحث: الضغط عليها يحدّد ما فيها، فالكتابة تستبدله مباشرة (صنف آخر بلا مسح يدوي)
 let PF=0;ROOT.addEventListener("pointerdown",e=>{const t=e.target;PF=t&&(t.id==="stk-code"||t.id==="stk-a-code"||t.id==="stk-q")&&document.activeElement!==t?1:0});
 ROOT.addEventListener("focusin",e=>{const t=e.target;if(PF&&t&&t.select&&(t.id==="stk-code"||t.id==="stk-a-code"||t.id==="stk-q")){PF=0;setTimeout(()=>{try{if(document.activeElement===t)t.select()}catch(x){}},0)}});
 ROOT.addEventListener("input",e=>{const t=e.target;if(t.id==="stk-file"||t.dataset.fo)return;if(t.dataset.lx){if(UI.lx&&t.dataset.lx!=="t")UI.lx[t.dataset.lx]=t.value;return}if(t.id==="stk-ask"){UI.aq=t.value;return}if(t.id==="stk-an"||t.id==="stk-a-ccodes"||t.id==="stk-dpt"||t.dataset.tq!==undefined||t.dataset.nq!==undefined||t.dataset.dw!==undefined||t.dataset.dx!==undefined||t.dataset.dl!==undefined||t.dataset.dr!==undefined||t.dataset.dv!==undefined)return;/* قائمة الأكواد تُطبَّق عند الخروج من الخانة أو Enter */if(t.tagName==="SELECT"||t.type==="checkbox"||t.type==="date")return;if(set(t))later()});
 // (v192) خانة التاريخ: أثناء كتابة السنة يمرّ المتصفح بتواريخ ناقصة (سنة 0002…) ويطلق change مع كل رقم، وإعادة الرسم كانت تقطع الكتابة («بيعلّق»).
 // فالتاريخ غير المعقول يُتجاهل، والمعقول يُطبَّق بعد توقف قصير عن الكتابة
 ROOT.addEventListener("change",e=>{const t=e.target;if(t.id==="stk-file"){const f=[...t.files];t.value="";onFiles(f);return}
  if(t.dataset.dbr){UI.dbr=t.value;paint();return}
  if(t.dataset.lx){if(UI.lx){if(t.dataset.lx==="t"){UI.lx.t=t.value;UI.lx.v="";paint()}else UI.lx[t.dataset.lx]=t.value}return}
  if(t.dataset.fo){focChange(t);return}
  // (v195) خانات التحديد: لا تعيد رسم الصفحة مع كل علامة (يُحدَّث العدّاد فقط)، و«تحديد كل المعروض» يعيد الرسم مرة
  if(t.dataset.nsk!==undefined){const S=selOf("nsel");if(t.checked)S[t.dataset.nsk]=1;else delete S[t.dataset.nsk];const e1=g("stk-nselb");if(e1)e1.outerHTML=nSelBar();return}
  if(t.dataset.tsk!==undefined){const S=selOf("tsel");if(t.checked)S[t.dataset.tsk]=1;else delete S[t.dataset.tsk];const e1=g("stk-tselb");if(e1)e1.outerHTML=tSelBar();return}
  if(t.id==="stk-nsall"){const S=selOf("nsel");NLIST.slice(0,UI.lim).forEach(l=>{if(nsOf(l))return;if(t.checked)S[nkOf(l)]=1;else delete S[nkOf(l)]});paint(false);return}
  if(t.id==="stk-tsall"){const S=selOf("tsel");TLIST.slice(0,UI.lim).forEach(l=>{if(l.sent)return;if(t.checked)S[tkOf(l)]=1;else delete S[tkOf(l)]});paint(false);return}
  if(t.type==="date"){const v=String(t.value||"");if(v&&(v<"2000-01-01"||v>"2100-12-31"))return;if(set(t)){clearTimeout(PT);PT=setTimeout(()=>paint(),900)}return}
  if(set(t)){clearTimeout(PT);paint()}});
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
export function stopStock(){un.forEach(f=>f());un=[];X=null;DATA=null;META=null;SENT=[];TRL=[];LOADED=false;LOADING=false;BUSY="";REP=[];SOLDC={};MFAIL={};VALM=null;VALR=[];VALS=0;CFG=Object.assign({},DEF);if(ROOT){ROOT.remove();ROOT=null}}
// 🧭 (v226، طلب محمد: «خلي الأقسام تحت المديول في القائمة الجانبية») الأقسام المتاحة الآن، والمفتوح، والانتقال من القائمة
export const stockTabs=()=>{if(!X)return [];const has=!!(DATA&&DATA.has);return TABS.filter(a=>(has||a[0]==="up")&&!(X.ro&&a[0]==="cfg")&&!(a[0]==="val"&&!X.sv)).map(a=>[a[0],a[1],a[2]])};
export const stockTab=()=>DATA&&DATA.has?UI.tab:"up";
export function stockGo(id){if(!X||!TABS.some(a=>a[0]===id))return;if(UI.tab!==id){UI.q="";UI.fr="";UI.tt="";UI.trx=null}UI.tab=id;UI.lim=200;if(ROOT){paint(false);try{window.scrollTo(0,0)}catch(e){}}}
export const stockState=()=>({loaded:LOADED,has:!!(DATA&&DATA.has),meta:META,cfg:CFG,ui:UI,rep:REP,busy:BUSY});
