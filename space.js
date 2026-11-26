// 🗂 (v245، 25 نوفمبر 2026) «مساحتي»: ملاحظات ومجلدات + مهام بمخططات الإنجاز + دخل ومصروفات بمخططات دائرية تفاعلية.
// مكان قسم «المهام والتذكيرات» في لوحة المستودع (نفس المعرّف tk ونفس روابط الإشعارات). المهام نفسها من tasks.js (نفس البيانات والقواعد والتذكيرات).
// مستوحاة من أفكار عامة في تطبيقات الملاحظات (شجرة صفحات، حفظ تلقائي، عروض متعددة) بتصميم المنصة، بلا أي كود أو تصميم أو أصول منسوخة.
// البيانات خاصة بصاحبها (القواعد: wsf / wsn / wsm حيث u = بريده): wsf/{id}={u,n,ts,upd?} · wsn/{id}={u,f?,b,pin?,ts,upd} · wsm/{id}={u,k:in|out,a,c,dt,nt?,ts,upd?}
// ctx: {db, toast, me:{e,n}, nav:()=>void (تحديث عدّاد القائمة), tk:{view,stats,count}}
import {collection,doc,setDoc,deleteDoc,onSnapshot,query,where} from "./fb.js";

const g=id=>document.getElementById(id);
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const N=v=>{const n=Number(v);return isFinite(n)?n:0};
const pad=n=>(n<10?"0":"")+n;
const ymd=t=>{const d=new Date(t);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
const MON=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fm=n=>Number(Math.round(N(n)*100)/100).toLocaleString("en-US",{maximumFractionDigits:2});
const gid=()=>{const a="abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";const r=new Uint8Array(20);crypto.getRandomValues(r);r.forEach(b=>s+=a[b%a.length]);return s};
const OUTC=["طعام","مواصلات","فواتير","سكن","تسوّق","صحة","تعليم","ترفيه","أخرى"],INC=["راتب","مكافأة","عمل إضافي","هدية","أخرى"];
// ألوان من هوية المنصة (موف، زيتوني، باذنجاني، رملي، كهرماني…)
const PAL=["#8a5a83","#6f7d45","#b48aab","#c29a5b","#4f3a52","#a4b46e","#b36b1e","#7d8fa3","#d4b8cf","#8c7a5b"];
const C_IN="#6f7d45",C_OUT="#b03a2e",C_TODO="#c29a5b",C_DOING="#8a5a83",C_DONE="#6f7d45",C_LATE="#b03a2e";

let X=null,UN=[],ROOT=null,FLD=new Map(),NTS=new Map(),MNY=new Map(),LD={f:false,n:false,m:false},S=null,SAVE_T=0,DIRTY=null,SAVING=false,ERR=false,CH=new Map(),HOV={};

const me=()=>X&&X.me?X.me.e:"";
const sKey=()=>"tz_ws_"+me();
const loadS=()=>{let v={};try{v=JSON.parse(localStorage.getItem(sKey())||"{}")||{}}catch(e){}const d=new Date();
 return {sec:["home","notes","tasks","money"].indexOf(v.sec)>=0?v.sec:"home",fold:v.fold||"all",nid:null,q:"",ym:/^\d{4}-\d{2}$/.test(v.ym||"")?v.ym:d.getFullYear()+"-"+pad(d.getMonth()+1),mt:v.mt==="in"?"in":"out",mk:"",ed:null,mob:false,nf:false}};
const saveS=()=>{try{localStorage.setItem(sKey(),JSON.stringify({sec:S.sec,fold:S.fold,ym:S.ym,mt:S.mt}))}catch(e){}};

export function initSpace(ctx){
 stopSpace();X=ctx;X.me={e:String(ctx.me&&ctx.me.e||"").toLowerCase(),n:String(ctx.me&&ctx.me.n||"")};S=loadS();css();
 const e=me();if(!e)return;
 const err=()=>{ERR=true;paint()};
 UN.push(onSnapshot(query(collection(X.db,"wsf"),where("u","==",e)),s=>{FLD=new Map();s.docs.forEach(d=>FLD.set(d.id,Object.assign({id:d.id},d.data())));LD.f=true;paint()},err));
 UN.push(onSnapshot(query(collection(X.db,"wsn"),where("u","==",e)),s=>{const keep=DIRTY&&NTS.get(DIRTY.id);NTS=new Map();s.docs.forEach(d=>NTS.set(d.id,Object.assign({id:d.id},d.data())));
  if(keep&&DIRTY)NTS.set(DIRTY.id,Object.assign({},NTS.get(DIRTY.id)||keep,{b:DIRTY.b}));LD.n=true;paint()},err));
 UN.push(onSnapshot(query(collection(X.db,"wsm"),where("u","==",e)),s=>{MNY=new Map();s.docs.forEach(d=>MNY.set(d.id,Object.assign({id:d.id},d.data())));LD.m=true;paint()},err));
 document.addEventListener("click",onClick);document.addEventListener("input",onInput);document.addEventListener("change",onChange);document.addEventListener("keydown",onKey);
 document.addEventListener("pointerover",onHover);document.addEventListener("pointerout",onHover);
 window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",onVis);
}
export function stopSpace(){flush();UN.forEach(f=>{try{f()}catch(e){}});UN=[];FLD=new Map();NTS=new Map();MNY=new Map();LD={f:false,n:false,m:false};ERR=false;CH=new Map();
 document.removeEventListener("click",onClick);document.removeEventListener("input",onInput);document.removeEventListener("change",onChange);document.removeEventListener("keydown",onKey);
 document.removeEventListener("pointerover",onHover);document.removeEventListener("pointerout",onHover);
 window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",onVis);
 if(ROOT&&ROOT.parentNode)ROOT.parentNode.removeChild(ROOT);ROOT=null;X=null}
// إشعار مهمة (?tk=) ← قسم المهام
export function spaceGo(sec){if(!S)return;if(["home","notes","tasks","money"].indexOf(sec)>=0){S.sec=sec;saveS();paint(true)}}
// العنصر ثابت: اللوحة بتنقله في مكانه بعد كل رسم (الكتابة ماتضيعش)
export function spaceMount(host){if(!host||!X)return;if(!ROOT){ROOT=document.createElement("div");ROOT.id="wsp";ROOT.className="wsx";ROOT.innerHTML=shell();paint(true)}
 if(ROOT.parentNode!==host)host.appendChild(ROOT);paint()}
const onVis=()=>{if(document.hidden)flush()};

// ---------- الهيكل ----------
const SECS=[["home","🏠","نظرة عامة"],["notes","📝","الملاحظات"],["tasks","✅","المهام"],["money","💰","الدخل والمصروفات"]];
function shell(){return `<div class="ws-bar"><div class="ws-ttl"><b>المهام والتذكيرات</b><span>🔒 كل ما هنا لك وحدك، ولا يراه غيرك إلا من تُسند إليه مهمة · يُحفظ تلقائياً</span></div><span class="ws-sv" id="ws-sv" aria-live="polite"></span></div>
<nav class="ws-seg" id="ws-seg" role="tablist"></nav><div class="ws-body" id="ws-body"></div>`}
let LASTSEC="";
function paint(force){
 if(!ROOT||!X)return;
 const seg=g("ws-seg");if(seg){const h=SECS.map(s=>`<button type="button" role="tab" data-ws="sec" data-v="${s[0]}" class="${S.sec===s[0]?"on":""}" aria-selected="${S.sec===s[0]}"><span>${s[1]}</span> ${s[2]}${s[0]==="tasks"&&X.tk&&X.tk.count()?` <i class="ws-n">${X.tk.count()}</i>`:""}</button>`).join("");if(seg._h!==h){seg._h=h;seg.innerHTML=h}}
 svState();
 const b=g("ws-body");if(!b)return;
 if(ERR&&!(LD.f||LD.n||LD.m)){b.innerHTML=`<div class="ws-empty">تعذّرت القراءة. ربما لم تتحدّث القواعد بعد</div>`;return}
 const sec=S.sec;if(sec!==LASTSEC){force=true;LASTSEC=sec}
 if(sec==="home")keepUi(b,()=>{b.innerHTML=homeView()});
 else if(sec==="notes")notesPaint(b,force);
 else if(sec==="tasks")keepUi(b,()=>{b.innerHTML=tasksView()});
 else keepUi(b,()=>{b.innerHTML=moneyView()});
 fillCharts();
 if(X.nav)try{X.nav()}catch(e){}
}
// إعادة الرسم بتحافظ على الخانة اللي بيكتب فيها ومكان المؤشر والتمرير
function keepUi(box,fn){const a=document.activeElement,id=a&&box.contains(a)&&a.id?a.id:"",s=id&&"selectionStart" in a?[a.selectionStart,a.selectionEnd]:null,sc=box.scrollTop;
 fn();box.scrollTop=sc;if(id){const n=g(id);if(n){n.focus();if(s&&n.setSelectionRange)try{n.setSelectionRange(s[0],s[1])}catch(e){}}}}

// ---------- المخططات الدائرية (SVG، العنصر نفسه بيتحدّث فالحركة سلسة) ----------
const R=42,CIRC=2*Math.PI*R;
// parts: [{k,l,v,c}] · center: {b,s} · opt: {act:"اسم الإجراء عند الضغط", sel:مفتاح محدد}
function chart(name,parts,center,opt){return `<div class="ws-ch" data-ch="${E(name)}" data-cj="${E(JSON.stringify({p:parts,c:center,o:opt||{}}))}"></div>`}
function fillCharts(){
 if(!ROOT)return;ROOT.querySelectorAll(".ws-ch[data-cj]").forEach(el=>{let d;try{d=JSON.parse(el.getAttribute("data-cj"))}catch(e){return}el.removeAttribute("data-cj");
  const name=el.getAttribute("data-ch");let wrap=CH.get(name),svg;const tot=d.p.reduce((s,p)=>s+Math.max(0,N(p.v)),0);
  if(!wrap){wrap=document.createElement("div");wrap.className="ws-dw";svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 120 120");svg.setAttribute("class","ws-dn");svg.setAttribute("aria-hidden","true");
   svg.innerHTML=`<circle class="bg" cx="60" cy="60" r="${R}"/><g class="sg" transform="rotate(-90 60 60)"></g>`;wrap.appendChild(svg);
   const cc=document.createElement("div");cc.className="ws-cc";cc.innerHTML='<b class="cb"></b><small class="cs"></small>';wrap.appendChild(cc);CH.set(name,wrap)}
  svg=wrap.querySelector("svg");
  const sg=svg.querySelector(".sg");const segs=[...sg.children];let off=0;const gap=d.p.filter(p=>N(p.v)>0).length>1?1.6:0;
  d.p.forEach((p,i)=>{let c=segs[i];if(!c){c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx","60");c.setAttribute("cy","60");c.setAttribute("r",String(R));c.style.strokeDasharray="0 "+CIRC;sg.appendChild(c)}
   const len=tot>0?Math.max(0,N(p.v))/tot*CIRC:0,vis=Math.max(0,len-gap);
   c.setAttribute("class","seg"+(d.o.sel&&d.o.sel===p.k?" on":"")+(d.o.sel&&d.o.sel!==p.k?" dim":""));c.style.stroke=p.c;
   c.setAttribute("data-k",p.k);c.setAttribute("data-ch",name);if(d.o.act){c.setAttribute("data-ws",d.o.act);c.setAttribute("tabindex","0");c.setAttribute("role","button");c.setAttribute("aria-label",p.l+": "+fm(p.v))}
   const o0=off;requestAnimationFrame(()=>{c.style.strokeDasharray=vis+" "+(CIRC-vis);c.style.strokeDashoffset=String(-o0)});off+=len});
  for(let i=d.p.length;i<segs.length;i++)sg.removeChild(segs[i]);
  wrap._tz=d;const h=HOV[name];setCenter(wrap,h?d.p.find(p=>p.k===h):null);
  el.innerHTML="";el.appendChild(wrap);
  const lg=document.createElement("div");lg.className="ws-lg";lg.innerHTML=d.p.filter(p=>N(p.v)>0||d.o.all).map(p=>`<button type="button" class="${d.o.sel===p.k?"on":""}" ${d.o.act?`data-ws="${E(d.o.act)}"`:"disabled"} data-k="${E(p.k)}" data-ch="${E(name)}"><i style="background:${E(p.c)}"></i><span${p.n?" data-notr":""}>${E(p.l)}</span><b><bdi>${E(fm(p.v))}</bdi>${d.o.u?" "+E(d.o.u):""}</b><small>${tot>0?Math.round(N(p.v)/tot*100):0}%</small></button>`).join("")||`<p class="ws-h">${E(d.o.empty||"لا بيانات بعد")}</p>`;
  el.appendChild(lg)})}
function setCenter(svg,p){/* svg = الغلاف .ws-dw */const d=svg._tz;if(!d)return;const tot=d.p.reduce((s,x)=>s+Math.max(0,N(x.v)),0);
 svg.querySelector(".cb").textContent=p?(tot>0?Math.round(N(p.v)/tot*100):0)+"%":d.c.b;svg.querySelector(".cs").textContent=p?p.l:d.c.s;svg.classList.toggle("hv",!!p)}
function onHover(ev){const t=ev.target;if(!t||!t.closest||!ROOT||!ROOT.contains(t))return;const s=t.closest("[data-ch][data-k]");if(!s)return;const name=s.getAttribute("data-ch"),svg=CH.get(name);if(!svg||!svg._tz)return;
 if(ev.type==="pointerover"){HOV[name]=s.getAttribute("data-k");setCenter(svg,svg._tz.p.find(p=>p.k===HOV[name]))}else{delete HOV[name];setCenter(svg,null)}}

// ---------- نظرة عامة ----------
function taskParts(o){return [{k:"done",l:"منتهية",v:o.done,c:C_DONE},{k:"doing",l:"جارية",v:o.doing,c:C_DOING},{k:"todo",l:"لم تبدأ",v:Math.max(0,o.todo-o.late),c:C_TODO},{k:"late",l:"فات موعدها",v:o.late,c:C_LATE}]}
const pct=(a,b)=>b>0?Math.round(a/b*100):0;
function monthSum(ym){let i=0,o=0;const cin=new Map(),cout=new Map();MNY.forEach(m=>{if(String(m.dt||"").slice(0,7)!==ym)return;const a=N(m.a);if(m.k==="in"){i+=a;cin.set(m.c,(cin.get(m.c)||0)+a)}else{o+=a;cout.set(m.c,(cout.get(m.c)||0)+a)}});return {i,o,cin,cout}}
const ymLbl=ym=>{const p=ym.split("-");return MON[N(p[1])-1]+" "+p[0]};
function homeView(){
 const st=X.tk?X.tk.stats():{mine:{todo:0,doing:0,done:0,late:0,today:0}};const m=st.mine,tot=m.todo+m.doing+m.done;
 const cur=ymd(Date.now()).slice(0,7),ms=monthSum(cur),notes=[...NTS.values()].sort((a,b)=>N(b.upd)-N(a.upd));
 return `<div class="ws-home">
 <section class="ws-card ws-c1"><header><h3>✅ إنجاز مهامي</h3><button type="button" class="ws-lnk" data-ws="sec" data-v="tasks">فتح المهام ‹</button></header>
  ${chart("h-tk",taskParts(m),{b:pct(m.done,tot)+"%",s:"نسبة الإنجاز"},{empty:"لا مهام بعد"})}
  <p class="ws-h">مهامي المفتوحة والمنتهية في آخر 30 يوماً${m.today?` · <b>${m.today}</b> موعدها اليوم`:""}</p></section>
 <section class="ws-card ws-c2"><header><h3>💰 ${E(ymLbl(cur))}</h3><button type="button" class="ws-lnk" data-ws="sec" data-v="money">فتح الحسابات ‹</button></header>
  ${chart("h-mn",[{k:"in",l:"الدخل",v:ms.i,c:C_IN},{k:"out",l:"المصروفات",v:ms.o,c:C_OUT}],{b:fm(ms.i-ms.o),s:"الصافي (ر.س)"},{u:"ر.س",empty:"لا حركات هذا الشهر"})}
  <div class="ws-kp"><span><small>الدخل</small><b class="in">${fm(ms.i)}</b></span><span><small>المصروفات</small><b class="out">${fm(ms.o)}</b></span><span><small>المتبقي</small><b>${pct(Math.max(0,ms.i-ms.o),ms.i)}%</b></span></div></section>
 <section class="ws-card ws-c3"><header><h3>📝 آخر الملاحظات</h3><button type="button" class="ws-lnk" data-ws="newnote">＋ ملاحظة جديدة</button></header>
  ${notes.length?`<div class="ws-hn">${notes.slice(0,5).map(n=>`<button type="button" data-ws="opennote" data-id="${E(n.id)}"><b data-notr>${E(ttl(n))}</b><small data-notr>${E(snip(n))}</small><time>${E(when(n.upd))}</time></button>`).join("")}</div>`:`<p class="ws-h">لا ملاحظات بعد. اكتب أول ملاحظة وستُحفظ وحدها.</p>`}
  <p class="ws-h">الملاحظات: ${NTS.size} · المجلدات: ${FLD.size}</p></section>
 </div>`}

// ---------- الملاحظات ----------
const ttl=n=>{const l=String(n.b||"").split("\n").map(s=>s.trim()).find(Boolean);return l?l.slice(0,80):"ملاحظة جديدة"};
const snip=n=>{const L=String(n.b||"").split("\n").map(s=>s.trim()).filter(Boolean);return (L.slice(1).join(" ")||"لا نص إضافي").slice(0,90)};
function when(t){t=N(t);if(!t)return "";const d=new Date(t),now=new Date();const hm=d.getHours()%12||12;const en=document.documentElement.classList.contains("tz-en");const tm=hm+":"+pad(d.getMinutes())+" "+(d.getHours()<12?(en?"am":"ص"):(en?"pm":"م"));
 if(ymd(t)===ymd(now))return tm;if(ymd(t)===ymd(now.getTime()-864e5))return en?"Yesterday":"أمس";return d.getDate()+"/"+(d.getMonth()+1)+(d.getFullYear()!==now.getFullYear()?"/"+d.getFullYear():"")}
function notesOf(){const q=S.q.trim().toLowerCase();return [...NTS.values()].filter(n=>(S.fold==="all"||(S.fold==="none"?!n.f||!FLD.has(n.f):n.f===S.fold))&&(!q||String(n.b||"").toLowerCase().indexOf(q)>=0))
 .sort((a,b)=>(b.pin===true)-(a.pin===true)||N(b.upd)-N(a.upd))}
function notesPaint(b,force){
 if(force||!g("ws-nt")){b.innerHTML=`<div class="ws-nt${S.mob?" mob-ed":""}" id="ws-nt"><aside class="ws-fl" id="ws-fl"></aside><div class="ws-ls" id="ws-ls"></div><div class="ws-ed" id="ws-ed"></div></div>`;edPaint(true)}
 g("ws-nt").classList.toggle("mob-ed",!!(S.mob&&S.nid));
 keepUi(g("ws-fl"),()=>{const h=foldHtml();if(g("ws-fl").innerHTML!==h)g("ws-fl").innerHTML=h});
 keepUi(g("ws-ls"),()=>{const h=listHtml();if(g("ws-ls").innerHTML!==h)g("ws-ls").innerHTML=h});
 edPaint(false)}
function foldHtml(){const cnt=f=>[...NTS.values()].filter(n=>f==="all"?true:f==="none"?!n.f||!FLD.has(n.f):n.f===f).length;
 const fs=[...FLD.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
 return `<h4>المجلدات</h4><button type="button" data-ws="fold" data-v="all" class="${S.fold==="all"?"on":""}"><span>🗂</span><b>كل الملاحظات</b><i>${cnt("all")}</i></button>
 ${fs.map(f=>`<div class="ws-fr${S.fold===f.id?" on":""}"><button type="button" data-ws="fold" data-v="${E(f.id)}"><span>📁</span><b data-notr>${E(f.n)}</b><i>${cnt(f.id)}</i></button>${S.fold===f.id?`<button type="button" class="x" data-ws="fren" data-id="${E(f.id)}" aria-label="إعادة تسمية المجلد">✏️</button><button type="button" class="x" data-ws="fdel" data-id="${E(f.id)}" aria-label="حذف المجلد">🗑</button>`:""}</div>`).join("")}
 ${cnt("none")&&fs.length?`<button type="button" data-ws="fold" data-v="none" class="${S.fold==="none"?"on":""}"><span>📄</span><b>بلا مجلد</b><i>${cnt("none")}</i></button>`:""}
 ${S.nf?`<div class="ws-nf"><input id="ws-nfn" maxlength="40" placeholder="اسم المجلد" autocomplete="off"><button type="button" class="b p" data-ws="faddok">إضافة</button><button type="button" class="b" data-ws="faddx">إلغاء</button></div>`:`<button type="button" class="ws-add" data-ws="fadd">＋ مجلد جديد</button>`}`}
function listHtml(){const L=notesOf(),fn=S.fold==="all"?"كل الملاحظات":S.fold==="none"?"بلا مجلد":(FLD.get(S.fold)||{}).n||"";
 return `<div class="ws-lh"><h4 data-notr>${E(fn)}</h4><button type="button" class="ws-new" data-ws="newnote" aria-label="ملاحظة جديدة" title="ملاحظة جديدة">✏️</button></div>
 <input id="ws-q" class="ws-q" type="search" placeholder="بحث في الملاحظات" value="${E(S.q)}" autocomplete="off">
 ${!LD.n?`<p class="ws-h">جاري التحميل…</p>`:L.length?L.map(n=>`<button type="button" class="ws-it${S.nid===n.id?" on":""}" data-ws="opennote" data-id="${E(n.id)}"><b data-notr>${n.pin===true?"📌 ":""}${E(ttl(n))}</b><small><time>${E(when(n.upd))}</time> <span data-notr>${E(snip(n))}</span></small></button>`).join("")
 :`<p class="ws-h">${S.q?"لا نتائج":"لا ملاحظات هنا بعد"}</p>`}`}
let EDID=null;
function edPaint(force){const ed=g("ws-ed");if(!ed)return;const n=S.nid?NTS.get(S.nid):null;
 if(!n){if(force||EDID!==null||!ed.firstChild){EDID=null;ed.innerHTML=`<div class="ws-ph"><span>📝</span><p>اختر ملاحظة أو ابدأ واحدة جديدة.<br>اكتب العنوان في الأعلى، وكل ما تكتبه يُحفظ تلقائياً.</p><button type="button" class="b p" data-ws="newnote">＋ ملاحظة جديدة</button></div>`}return}
 const ta=g("ws-ta");
 if(force||EDID!==n.id||!ta){EDID=n.id;const fo=[...FLD.values()].sort((a,b)=>String(a.n).localeCompare(String(b.n),"ar"));
  ed.innerHTML=`<div class="ws-et"><button type="button" class="ws-back" data-ws="back">‹ الملاحظات</button><time id="ws-et">${E(when(n.upd))}</time>
   <select id="ws-nfo" aria-label="المجلد"><option value="">بلا مجلد</option>${fo.map(f=>`<option value="${E(f.id)}"${n.f===f.id?" selected":""} data-notr>${E(f.n)}</option>`).join("")}</select>
   <button type="button" class="ws-ib${n.pin===true?" on":""}" data-ws="pin" aria-label="تثبيت الملاحظة" title="تثبيت في الأعلى">📌</button><button type="button" class="ws-ib" data-ws="ndel" aria-label="حذف الملاحظة" title="حذف">🗑</button></div>
   <input id="ws-tt" class="ws-tt" maxlength="200" placeholder="العنوان" autocomplete="off" data-notr><textarea id="ws-ta" class="ws-ta" maxlength="19800" placeholder="اكتب ملاحظتك هنا…" data-notr spellcheck="true"></textarea>
   <p class="ws-cnt" id="ws-cnt"></p>`;
  setEd(String(n.b||""));cnt();return}
 // تحديث من جهاز آخر: نحدّث النص بس لو مش بيكتب
 const tt=g("ws-tt");if(document.activeElement!==ta&&document.activeElement!==tt&&!(DIRTY&&DIRTY.id===n.id)&&edVal()!==String(n.b||""))setEd(String(n.b||""));
 const et=g("ws-et");if(et)et.textContent=when(n.upd);
 const p=ROOT.querySelector('[data-ws="pin"]');if(p)p.classList.toggle("on",n.pin===true)}
// العنوان = أول سطر في النص المحفوظ b
function setEd(b){const i=b.indexOf("\n"),tt=g("ws-tt"),ta=g("ws-ta");if(tt)tt.value=i<0?b:b.slice(0,i);if(ta)ta.value=i<0?"":b.slice(i+1)}
function edVal(){const tt=g("ws-tt"),ta=g("ws-ta");const a=(tt?tt.value:"").replace(/\n/g," "),b=ta?ta.value:"";return b?a+"\n"+b:a}
function cnt(){const t=g("ws-ta"),c=g("ws-cnt");if(t&&c){const w=t.value.trim()?t.value.trim().split(/\s+/).length:0;c.textContent="الكلمات: "+w+" · الأحرف: "+t.value.length}}

// الحفظ التلقائي
function svState(){const el=g("ws-sv");if(!el)return;const s=SAVING||DIRTY?"جارٍ الحفظ…":ERRSV?"تعذّر الحفظ، سنحاول مرة أخرى":LASTOK?"✓ حُفظ تلقائياً":"";if(el.textContent!==s)el.textContent=s;el.className="ws-sv"+(ERRSV?" er":"")}
let ERRSV=false,LASTOK=0;
function queueNote(id,b){DIRTY={id,b};const n=NTS.get(id);if(n)NTS.set(id,Object.assign({},n,{b,upd:Date.now()}));clearTimeout(SAVE_T);SAVE_T=setTimeout(flush,650);svState()}
async function flush(){clearTimeout(SAVE_T);if(!DIRTY||!X||SAVING)return;const d=DIRTY;const n=NTS.get(d.id);if(!n){DIRTY=null;return}SAVING=true;svState();
 const rec={u:me(),b:String(d.b).slice(0,20000),ts:N(n.ts)||Date.now(),upd:Date.now()};if(n.f&&FLD.has(n.f))rec.f=n.f;if(n.pin===true)rec.pin=true;
 try{await setDoc(doc(X.db,"wsn",d.id),rec);ERRSV=false;LASTOK=Date.now();if(DIRTY===d)DIRTY=null}
 catch(e){ERRSV=true;clearTimeout(SAVE_T);SAVE_T=setTimeout(flush,4000)}
 finally{SAVING=false;svState();if(DIRTY&&DIRTY!==d){clearTimeout(SAVE_T);SAVE_T=setTimeout(flush,300)}}}
async function saveNote(id,patch){const n=NTS.get(id);if(!n)return;await flush();const v=Object.assign({},n,patch);const rec={u:me(),b:String(v.b||""),ts:N(v.ts)||Date.now(),upd:Date.now()};if(v.f&&FLD.has(v.f))rec.f=v.f;if(v.pin===true)rec.pin=true;
 NTS.set(id,Object.assign({id},rec));paint();try{await setDoc(doc(X.db,"wsn",id),rec);LASTOK=Date.now();ERRSV=false}catch(e){ERRSV=true;X.toast("تعذّر الحفظ، حاول مرة أخرى","er")}svState()}
// ملاحظة جديدة فاضية اتسابت = بتتشال (زي تطبيقات الملاحظات)
async function dropEmpty(id){const n=id&&NTS.get(id);if(!n||String(n.b||"").trim())return;if(DIRTY&&DIRTY.id===id)DIRTY=null;NTS.delete(id);try{await deleteDoc(doc(X.db,"wsn",id))}catch(e){}}
async function newNote(){await flush();const prev=S.nid;const id=gid(),f=S.fold!=="all"&&S.fold!=="none"&&FLD.has(S.fold)?S.fold:"";const rec={u:me(),b:"",ts:Date.now(),upd:Date.now()};if(f)rec.f=f;
 NTS.set(id,Object.assign({id},rec));if(prev&&prev!==id)dropEmpty(prev);S.sec="notes";S.nid=id;S.mob=true;S.q="";saveS();paint(true);setTimeout(()=>{const t=g("ws-tt");if(t)t.focus()},40);
 try{await setDoc(doc(X.db,"wsn",id),rec)}catch(e){X.toast("تعذّرت الإضافة. ربما لم تتحدّث القواعد بعد","er")}}

// ---------- المهام ----------
function tasksView(){const st=X.tk?X.tk.stats():null;if(!st)return "";const m=st.mine,a=st.all,tm=m.todo+m.doing+m.done,ta=a.todo+a.doing+a.done;
 const prp=o=>[{k:"3",l:"عالية",v:o.pr[3],c:"#b03a2e"},{k:"2",l:"متوسطة",v:o.pr[2],c:"#b36b1e"},{k:"1",l:"منخفضة",v:o.pr[1],c:"#6f7d45"},{k:"0",l:"بلا أولوية",v:o.pr[0],c:"#b8a9b6"}];
 return `<div class="ws-tch">
  <section class="ws-card"><header><h3>مهامي</h3></header>${chart("t-mine",taskParts(m),{b:pct(m.done,tm)+"%",s:"نسبة الإنجاز"},{empty:"لا مهام لك بعد"})}</section>
  <section class="ws-card"><header><h3>أنشأتُها أو أُسندت إليّ</h3></header>${chart("t-all",taskParts(a),{b:pct(a.done,ta)+"%",s:"نسبة الإنجاز"},{empty:"لا مهام بعد"})}</section>
  <section class="ws-card"><header><h3>المفتوح حسب الأولوية</h3></header>${chart("t-pr",prp(m),{b:String(m.todo+m.doing),s:"مفتوحة لي"},{empty:"لا مهام مفتوحة"})}</section>
 </div><p class="ws-h ws-tn">المخططات تتحدّث فور إضافة مهمة أو إنهائها · المنتهية تُحسب عن آخر 30 يوماً</p>
 <div class="ws-tk">${X.tk.view()}</div>`}

// ---------- الدخل والمصروفات ----------
function ymShift(ym,d){const p=ym.split("-");const x=new Date(N(p[0]),N(p[1])-1+d,1);return x.getFullYear()+"-"+pad(x.getMonth()+1)}
function moneyView(){
 const ms=monthSum(S.ym),catMap=S.mt==="in"?ms.cin:ms.cout,cats=[...catMap.entries()].sort((a,b)=>b[1]-a[1]);
 const cParts=cats.map((c,i)=>({k:c[0],l:c[0],v:c[1],c:PAL[i%PAL.length],n:OUTC.concat(INC).indexOf(c[0])<0?1:0}));
 const L=[...MNY.values()].filter(m=>String(m.dt||"").slice(0,7)===S.ym&&(!S.mk||(m.k===S.mt&&m.c===S.mk))).sort((a,b)=>String(b.dt).localeCompare(String(a.dt))||N(b.ts)-N(a.ts));
 // آخر 6 شهور
 const six=[];for(let i=5;i>=0;i--){const y=ymShift(S.ym,-i),s=monthSum(y);six.push({y,i:s.i,o:s.o})}const mx=Math.max(1,...six.map(x=>Math.max(x.i,x.o)));
 return `<div class="ws-mn">
 <div class="ws-mh"><button type="button" class="ws-ib" data-ws="ym" data-v="-1" aria-label="الشهر السابق">›</button><b>${E(ymLbl(S.ym))}</b><button type="button" class="ws-ib" data-ws="ym" data-v="1" aria-label="الشهر التالي">‹</button>${S.ym!==ymd(Date.now()).slice(0,7)?`<button type="button" class="ws-lnk" data-ws="ymnow">الشهر الحالي</button>`:""}</div>
 <div class="ws-kp big"><span><small>الدخل</small><b class="in">${fm(ms.i)}</b></span><span><small>المصروفات</small><b class="out">${fm(ms.o)}</b></span><span><small>الصافي</small><b class="${ms.i-ms.o<0?"out":"in"}">${fm(ms.i-ms.o)}</b></span><span><small>نسبة الادخار</small><b>${ms.i>0?pct(ms.i-ms.o,ms.i):0}%</b></span></div>
 <div class="ws-mg">
  <section class="ws-card"><header><h3>الدخل مقابل المصروفات</h3></header>${chart("m-io",[{k:"in",l:"الدخل",v:ms.i,c:C_IN},{k:"out",l:"المصروفات",v:ms.o,c:C_OUT}],{b:fm(ms.i-ms.o),s:"الصافي (ر.س)"},{act:"mtype",sel:S.mk?S.mt:"",u:"ر.س",empty:"لا حركات في هذا الشهر"})}</section>
  <section class="ws-card"><header><h3>${S.mt==="in"?"الدخل":"المصروفات"} حسب البند</h3><span class="ws-tg"><button type="button" class="${S.mt==="out"?"on":""}" data-ws="mt" data-v="out">المصروفات</button><button type="button" class="${S.mt==="in"?"on":""}" data-ws="mt" data-v="in">الدخل</button></span></header>
   ${chart("m-cat",cParts,{b:fm(S.mt==="in"?ms.i:ms.o),s:S.mt==="in"?"إجمالي الدخل":"إجمالي المصروفات"},{act:"mcat",sel:S.mk,u:"ر.س",empty:S.mt==="in"?"لا دخل في هذا الشهر":"لا مصروفات في هذا الشهر"})}<p class="ws-h">${S.mk?"اضغط البند مرة أخرى للإلغاء":"اضغط بنداً لعرض حركاته"}</p></section>
  <section class="ws-card ws-6m"><header><h3>آخر 6 أشهر</h3></header><div class="ws-bars">${six.map(x=>`<button type="button" data-ws="ymset" data-v="${x.y}" class="${x.y===S.ym?"on":""}" title="${E(ymLbl(x.y))}"><span class="bi" style="height:${Math.round(x.i/mx*100)}%"></span><span class="bo" style="height:${Math.round(x.o/mx*100)}%"></span><small>${E(MON[N(x.y.slice(5))-1])}</small></button>`).join("")}</div><p class="ws-lg2"><i class="in"></i>الدخل <i class="out"></i>المصروفات</p></section>
 </div>
 <section class="ws-card ws-form"><header><h3>${S.ed?"تعديل الحركة":"إضافة حركة"}</h3></header>
  <div class="ws-fm"><span class="ws-tg"><button type="button" class="${FK==="out"?"on":""}" data-ws="fk" data-v="out">− مصروف</button><button type="button" class="${FK==="in"?"on":""}" data-ws="fk" data-v="in">＋ دخل</button></span>
  <input id="ws-fa" type="text" inputmode="decimal" placeholder="المبلغ" autocomplete="off" value="${E(FV.a)}">
  <input id="ws-fc" list="ws-cl" maxlength="30" placeholder="البند" autocomplete="off" value="${E(FV.c)}"><datalist id="ws-cl">${(FK==="in"?INC:OUTC).concat([...MNY.values()].filter(m=>m.k===FK).map(m=>m.c)).filter((v,i,a)=>a.indexOf(v)===i).slice(0,40).map(c=>`<option value="${E(c)}">`).join("")}</datalist>
  <input id="ws-fd" type="date" value="${E(FV.d||ymd(Date.now()))}" max="${E(ymd(Date.now()+864e5*366))}">
  <input id="ws-fn" maxlength="200" placeholder="ملاحظة (اختياري)" autocomplete="off" value="${E(FV.n)}">
  <button type="button" class="b p" data-ws="msave">${S.ed?"حفظ":"إضافة"}</button>${S.ed?`<button type="button" class="b" data-ws="mcancel">إلغاء</button>`:""}</div>
  <div class="ws-chips">${(FK==="in"?INC:OUTC).slice(0,8).map(c=>`<button type="button" data-ws="fcat" data-v="${E(c)}" class="${FV.c===c?"on":""}">${E(c)}</button>`).join("")}</div></section>
 <section class="ws-card"><header><h3>الحركات${S.mk?` · <span data-notr>${E(S.mk)}</span> <button type="button" class="ws-lnk" data-ws="mclr">✕ عرض الكل</button>`:""}</h3><button type="button" class="ws-lnk" data-ws="mcsv">⬇️ إكسل</button></header>
  ${!LD.m?`<p class="ws-h">جاري التحميل…</p>`:L.length?`<div class="ws-ml">${L.map(m=>`<div class="ws-mr ${m.k==="in"?"in":"out"}${S.ed===m.id?" on":""}"><span class="dt">${E(String(m.dt).slice(8))}/${E(String(m.dt).slice(5,7))}</span><span class="c"><b data-notr>${E(m.c)}</b>${m.nt?`<small data-notr>${E(m.nt)}</small>`:""}</span><b class="a">${m.k==="in"?"+":"−"}${E(fm(m.a))}</b><span class="ac"><button type="button" class="ws-ib" data-ws="medit" data-id="${E(m.id)}" aria-label="تعديل">✏️</button><button type="button" class="ws-ib" data-ws="mdel" data-id="${E(m.id)}" aria-label="حذف">🗑</button></span></div>`).join("")}</div>`
  :`<p class="ws-h">${S.mk?"لا حركات لهذا البند في هذا الشهر":"لا حركات في هذا الشهر. أضف أول حركة من الأعلى."}</p>`}
  <p class="ws-h">حساباتك الشخصية: لا يراها أحد غيرك، وليست جزءاً من عهدة المستودع.</p></section>
 </div>`}
let FK="out",FV={a:"",c:"",d:"",n:""};
const numIn=s=>{s=String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g,".").replace(/[^\d.]/g,"");const n=parseFloat(s);return isFinite(n)?Math.round(n*100)/100:0};
function readForm(){FV={a:(g("ws-fa")||{}).value||"",c:((g("ws-fc")||{}).value||"").trim(),d:(g("ws-fd")||{}).value||"",n:((g("ws-fn")||{}).value||"").trim()}}
let MBUSY=false;
async function moneySave(){readForm();const a=numIn(FV.a);if(!(a>0)){X.toast("اكتب مبلغاً أكبر من صفر","er");const f=g("ws-fa");if(f)f.focus();return}
 if(a>1e9){X.toast("المبلغ كبير جداً","er");return}if(!FV.c){X.toast("اختر البند أو اكتبه","er");const f=g("ws-fc");if(f)f.focus();return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(FV.d))FV.d=ymd(Date.now());if(MBUSY)return;MBUSY=true;
 const id=S.ed||gid(),old=S.ed?MNY.get(S.ed):null;const rec={u:me(),k:FK,a,c:FV.c.slice(0,30),dt:FV.d,ts:old?N(old.ts):Date.now()};if(old)rec.upd=Date.now();if(FV.n)rec.nt=FV.n.slice(0,200);
 MNY.set(id,Object.assign({id},rec));const ym=FV.d.slice(0,7);if(ym!==S.ym){S.ym=ym;saveS()}S.ed=null;FV={a:"",c:"",d:FV.d,n:""};paint();
 try{await setDoc(doc(X.db,"wsm",id),rec);LASTOK=Date.now();X.toast(old?"✓ حُفظ التعديل":"✓ أُضيفت الحركة")}catch(e){X.toast("تعذّر الحفظ. ربما لم تتحدّث القواعد بعد","er")}finally{MBUSY=false;svState()}}
function moneyCsv(){const L=[...MNY.values()].filter(m=>String(m.dt||"").slice(0,7)===S.ym).sort((a,b)=>String(a.dt).localeCompare(String(b.dt)));
 const q=v=>{v=String(v==null?"":v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
 const rows=[["التاريخ","النوع","البند","المبلغ","ملاحظة"]].concat(L.map(m=>[m.dt,m.k==="in"?"دخل":"مصروف",m.c,m.a,m.nt||""]));
 const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my-money-"+S.ym+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

// ---------- الأحداث ----------
function inMe(t){return ROOT&&t&&ROOT.contains(t)}
async function onClick(ev){const b=ev.target&&ev.target.closest?ev.target.closest("[data-ws]"):null;if(!b||!inMe(b)||!X)return;const a=b.getAttribute("data-ws"),v=b.getAttribute("data-v"),id=b.getAttribute("data-id");
 if(a==="sec"){if(S.sec==="notes"){await flush();dropEmpty(S.nid)}S.sec=v;S.mob=false;saveS();paint(true);return}
 if(a==="fold"){await flush();dropEmpty(S.nid);S.fold=v;S.nid=null;S.mob=false;saveS();paint();edPaint(true);return}
 if(a==="fadd"){S.nf=true;paint();setTimeout(()=>{const i=g("ws-nfn");if(i)i.focus()},20);return}
 if(a==="faddx"){S.nf=false;paint();return}
 if(a==="faddok"){const n=((g("ws-nfn")||{}).value||"").trim().slice(0,40);if(!n){X.toast("اكتب اسم المجلد","er");return}const fid=gid(),rec={u:me(),n,ts:Date.now()};FLD.set(fid,Object.assign({id:fid},rec));S.nf=false;S.fold=fid;saveS();paint();
  try{await setDoc(doc(X.db,"wsf",fid),rec)}catch(e){X.toast("تعذّرت الإضافة. ربما لم تتحدّث القواعد بعد","er")}return}
 if(a==="fren"){const f=FLD.get(id);if(!f)return;const n=(prompt("اسم المجلد:",f.n)||"").trim().slice(0,40);if(!n||n===f.n)return;const rec={u:me(),n,ts:N(f.ts)||Date.now(),upd:Date.now()};FLD.set(id,Object.assign({id},rec));paint();
  try{await setDoc(doc(X.db,"wsf",id),rec)}catch(e){X.toast("تعذّر الحفظ، حاول مرة أخرى","er")}return}
 if(a==="fdel"){const f=FLD.get(id);if(!f)return;const k=[...NTS.values()].filter(n=>n.f===id).length;if(!confirm("حذف المجلد «"+f.n+"»؟"+(k?" ملاحظاته ("+k+") لن تُحذف وستنتقل إلى «بلا مجلد».":"")))return;
  FLD.delete(id);S.fold="all";saveS();paint();try{await deleteDoc(doc(X.db,"wsf",id))}catch(e){X.toast("تعذّر الحذف","er")}return}
 if(a==="newnote"){newNote();return}
 if(a==="opennote"){await flush();if(S.nid&&S.nid!==id)dropEmpty(S.nid);S.sec="notes";S.nid=id;S.mob=true;saveS();paint(LASTSEC!=="notes");edPaint(true);return}
 if(a==="back"){await flush();dropEmpty(S.nid);S.nid=null;S.mob=false;paint();edPaint(true);return}
 if(a==="pin"){const n=NTS.get(S.nid);if(n)saveNote(n.id,{pin:n.pin!==true});return}
 if(a==="ndel"){const n=NTS.get(S.nid);if(!n)return;if(String(n.b||"").trim()&&!confirm("حذف الملاحظة «"+ttl(n)+"»؟ لا يمكن التراجع."))return;if(DIRTY&&DIRTY.id===n.id)DIRTY=null;NTS.delete(n.id);S.nid=null;S.mob=false;paint();edPaint(true);
  try{await deleteDoc(doc(X.db,"wsn",n.id));X.toast("حُذفت الملاحظة")}catch(e){X.toast("تعذّر الحذف","er")}return}
 if(a==="ym"){S.ym=ymShift(S.ym,N(v));S.mk="";saveS();paint();return}
 if(a==="ymset"){S.ym=v;S.mk="";saveS();paint();return}
 if(a==="ymnow"){S.ym=ymd(Date.now()).slice(0,7);S.mk="";saveS();paint();return}
 if(a==="mt"){S.mt=v==="in"?"in":"out";S.mk="";saveS();paint();return}
 if(a==="mtype"){const k=b.getAttribute("data-k");S.mt=k==="in"?"in":"out";S.mk="";saveS();paint();return}
 if(a==="mcat"){const k=b.getAttribute("data-k");S.mk=S.mk===k?"":k;paint();return}
 if(a==="mclr"){S.mk="";paint();return}
 if(a==="fk"){readForm();FK=v==="in"?"in":"out";paint();return}
 if(a==="fcat"){readForm();FV.c=v;paint();const f=g("ws-fa");if(f&&!FV.a)f.focus();return}
 if(a==="msave"){moneySave();return}
 if(a==="mcancel"){S.ed=null;FV={a:"",c:"",d:"",n:""};paint();return}
 if(a==="medit"){const m=MNY.get(id);if(!m)return;S.ed=id;FK=m.k==="in"?"in":"out";FV={a:String(m.a),c:m.c,d:m.dt,n:m.nt||""};paint();const f=g("ws-fa");if(f){f.focus();f.scrollIntoView({block:"center",behavior:"smooth"})}return}
 if(a==="mdel"){const m=MNY.get(id);if(!m)return;if(!confirm("حذف حركة «"+m.c+"» بمبلغ "+fm(m.a)+"؟"))return;MNY.delete(id);if(S.ed===id)S.ed=null;paint();try{await deleteDoc(doc(X.db,"wsm",id));X.toast("حُذفت الحركة")}catch(e){X.toast("تعذّر الحذف","er")}return}
 if(a==="mcsv"){moneyCsv();return}
}
function onInput(ev){const t=ev.target;if(!inMe(t)||!X)return;
 if((t.id==="ws-ta"||t.id==="ws-tt")&&S.nid){queueNote(S.nid,edVal());cnt();const it=ROOT.querySelector('.ws-it.on b');if(it){const n=NTS.get(S.nid);if(n)it.textContent=(n.pin===true?"📌 ":"")+ttl(n)}return}
 if(t.id==="ws-q"){S.q=t.value;clearTimeout(onInput.q);onInput.q=setTimeout(()=>{const l=g("ws-ls");if(l)keepUi(l,()=>{l.innerHTML=listHtml()})},180);return}
 if(t.id==="ws-fa"||t.id==="ws-fc"||t.id==="ws-fd"||t.id==="ws-fn")readForm()}
async function onChange(ev){const t=ev.target;if(!inMe(t)||!X)return;if(t.id==="ws-nfo"&&S.nid)saveNote(S.nid,{f:t.value})}
function onKey(ev){const t=ev.target;if(!inMe(t)||!X)return;
 if(ev.key==="Enter"&&t.id==="ws-tt"){ev.preventDefault();const a=g("ws-ta");if(a){a.focus();a.setSelectionRange(0,0)}return}
 if(ev.key==="Enter"&&t.id==="ws-nfn"){ev.preventDefault();const b=ROOT.querySelector('[data-ws="faddok"]');if(b)b.click();return}
 if(ev.key==="Escape"&&t.id==="ws-nfn"){S.nf=false;paint();return}
 if(ev.key==="Enter"&&/^ws-f[acdn]$/.test(t.id)){ev.preventDefault();moneySave();return}
 if((ev.key==="Enter"||ev.key===" ")&&t.getAttribute&&t.getAttribute("data-ws")&&t.tagName!=="BUTTON"){ev.preventDefault();t.dispatchEvent(new MouseEvent("click",{bubbles:true}))}}

// ---------- التنسيق ----------
const CSS=`
.wsx{--ws-a:#8a5a83;--ws-a2:#b48aab;--ws-o:#6f7d45;--ws-r:#b03a2e;--ws-ink:#2a1d2c;--ws-mut:#7a6a78;--ws-card:#fffaf3;--ws-line:rgba(42,29,44,.1);--ws-soft:rgba(138,90,131,.08);--ws-ed:#fffdf8;
 display:block;max-width:1240px;margin:0 auto;color:var(--ws-ink)}
.wsx *{box-sizing:border-box}
.ws-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:2px 2px 12px;flex-wrap:wrap}
.ws-ttl b{display:block;font-size:24px;font-weight:800;letter-spacing:-.2px}.ws-ttl span{color:var(--ws-mut);font-size:13px}
.ws-sv{font-size:12px;color:var(--ws-o);min-height:18px;transition:opacity .3s}.ws-sv.er{color:var(--ws-r)}
.ws-seg{display:flex;gap:4px;background:var(--ws-soft);border-radius:14px;padding:4px;margin-bottom:14px;overflow-x:auto;scrollbar-width:none}
.ws-seg::-webkit-scrollbar{display:none}
.ws-seg button{flex:1 0 auto;border:0;background:transparent;color:var(--ws-ink);font:inherit;font-weight:700;font-size:14px;padding:9px 14px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:background .2s,box-shadow .2s,color .2s}
.ws-seg button.on{background:var(--ws-card);box-shadow:0 1px 3px rgba(42,29,44,.12),0 4px 14px rgba(42,29,44,.06);color:var(--ws-a)}
.ws-n{font-style:normal;background:var(--ws-r);color:#fff;border-radius:99px;font-size:11px;padding:1px 7px;margin-inline-start:4px}
.ws-card{background:var(--ws-card);border:1px solid var(--ws-line);border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(42,29,44,.04)}
.ws-card header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap}.ws-card h3{margin:0;font-size:15px}
.ws-lnk{border:0;background:none;color:var(--ws-a);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:4px}
.ws-h{color:var(--ws-mut);font-size:12.5px;margin:8px 0 0;line-height:1.6}
.ws-empty{padding:40px;text-align:center;color:var(--ws-mut)}
.wsx .b{border:1px solid var(--ws-line);background:var(--ws-card);color:var(--ws-ink);font:inherit;font-weight:700;font-size:13px;border-radius:10px;padding:8px 14px;cursor:pointer}
.wsx .b.p{background:var(--ws-a);border-color:var(--ws-a);color:#fff}
.wsx .b:focus-visible,.ws-seg button:focus-visible,.ws-it:focus-visible{outline:2px solid var(--ws-a2);outline-offset:2px}
.ws-ib{border:0;background:transparent;cursor:pointer;border-radius:9px;padding:6px 8px;font-size:15px;color:var(--ws-ink);line-height:1}.ws-ib:hover{background:var(--ws-soft)}.ws-ib.on{background:rgba(138,90,131,.18)}
/* المخططات */
.ws-ch{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.ws-dw{position:relative;width:150px;height:150px;flex:none}.ws-dn{width:100%;height:100%;overflow:visible;display:block}
.ws-cc{position:absolute;inset:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;line-height:1.2}
.ws-cc b{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}.ws-cc small{font-size:10.5px;color:var(--ws-mut);margin-top:3px}
.ws-dn circle{fill:none;stroke-width:14}.ws-dn .bg{stroke:var(--ws-soft);stroke-width:14}
.ws-dn .seg{stroke-linecap:butt;transition:stroke-dasharray .7s cubic-bezier(.16,1,.3,1),stroke-dashoffset .7s cubic-bezier(.16,1,.3,1),stroke-width .2s,opacity .2s}
.ws-dn .seg[data-ws]{cursor:pointer}.ws-dn .seg:hover,.ws-dn .seg.on{stroke-width:18}.ws-dn .seg.dim{opacity:.35}
.ws-lg{display:grid;gap:4px;flex:1;min-width:150px}
.ws-lg button{display:grid;grid-template-columns:12px 1fr auto 38px;align-items:center;gap:8px;border:0;background:transparent;font:inherit;font-size:13px;color:var(--ws-ink);padding:6px 8px;border-radius:9px;text-align:start;cursor:pointer}
.ws-lg button[disabled]{cursor:default;color:var(--ws-ink)}.ws-lg button:not([disabled]):hover,.ws-lg button.on{background:var(--ws-soft)}
.ws-lg i{width:10px;height:10px;border-radius:3px}.ws-lg b{font-variant-numeric:tabular-nums;white-space:nowrap}.ws-lg small{color:var(--ws-mut);font-variant-numeric:tabular-nums;text-align:end}
/* نظرة عامة */
.ws-home{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.ws-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.ws-kp.big{grid-template-columns:repeat(4,1fr);margin:0 0 14px}
.ws-kp span{background:var(--ws-soft);border-radius:12px;padding:9px 11px}.ws-kp.big span{background:var(--ws-card);border:1px solid var(--ws-line);padding:12px 14px}
.ws-kp small{display:block;color:var(--ws-mut);font-size:11.5px}.ws-kp b{font-size:17px;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block}.ws-kp.big b{font-size:21px}
.ws-kp b.in{color:var(--ws-o)}.ws-kp b.out{color:var(--ws-r)}
.ws-hn{display:grid;gap:2px}.ws-hn button{display:grid;grid-template-columns:1fr auto;gap:0 8px;border:0;background:transparent;text-align:start;font:inherit;padding:9px 8px;border-radius:10px;cursor:pointer;color:var(--ws-ink);border-bottom:1px solid var(--ws-line)}
.ws-hn button:hover{background:var(--ws-soft)}.ws-hn b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ws-hn small{grid-column:1;color:var(--ws-mut);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ws-hn time{grid-row:1/3;grid-column:2;color:var(--ws-mut);font-size:11.5px;align-self:center}
/* الملاحظات (ثلاثة أعمدة) */
.ws-nt{display:grid;grid-template-columns:210px 290px 1fr;background:var(--ws-card);border:1px solid var(--ws-line);border-radius:18px;overflow:hidden;min-height:560px;height:calc(100vh - 230px);max-height:900px}
.ws-fl{background:rgba(138,90,131,.05);border-inline-end:1px solid var(--ws-line);padding:12px 8px;overflow:auto}
.ws-fl h4,.ws-lh h4{margin:4px 8px 8px;font-size:12px;color:var(--ws-mut);font-weight:700}
.ws-fl button,.ws-fr>button:first-child{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;font:inherit;font-size:14px;color:var(--ws-ink);padding:8px 10px;border-radius:10px;cursor:pointer;text-align:start}
.ws-fl button b{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ws-fl i{font-style:normal;color:var(--ws-mut);font-size:12px}
.ws-fl button.on,.ws-fr.on>button:first-child{background:var(--ws-a);color:#fff}.ws-fl button.on i,.ws-fr.on i{color:rgba(255,255,255,.8)}
.ws-fr{display:flex;align-items:center;gap:2px}.ws-fr .x{width:auto;padding:6px;font-size:12px}
.ws-add{color:var(--ws-a)!important;font-weight:700;margin-top:6px}
.ws-nf{display:grid;gap:6px;padding:6px}.ws-nf input{border:1px solid var(--ws-line);border-radius:9px;padding:8px;font:inherit;background:var(--ws-ed);color:var(--ws-ink)}
.ws-ls{border-inline-end:1px solid var(--ws-line);overflow:auto;padding:10px}
.ws-lh{display:flex;align-items:center;justify-content:space-between}.ws-new{border:0;background:transparent;font-size:18px;cursor:pointer;border-radius:9px;padding:4px 8px}.ws-new:hover{background:var(--ws-soft)}
.ws-q{width:100%;border:0;background:var(--ws-soft);border-radius:10px;padding:8px 11px;font:inherit;font-size:13.5px;margin:4px 0 8px;color:var(--ws-ink)}
.ws-it{display:block;width:100%;border:0;background:transparent;text-align:start;font:inherit;padding:10px 11px;border-radius:12px;cursor:pointer;color:var(--ws-ink);margin-bottom:2px}
.ws-it:hover{background:var(--ws-soft)}.ws-it.on{background:rgba(138,90,131,.17)}
.ws-it b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-it small{display:block;font-size:12px;color:var(--ws-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}.ws-it time{color:var(--ws-ink);font-weight:600}
.ws-ed{display:flex;flex-direction:column;background:var(--ws-ed);min-width:0}
.ws-et{display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--ws-line)}.ws-et time{flex:1;text-align:center;color:var(--ws-mut);font-size:12px}
.ws-et select{border:1px solid var(--ws-line);background:var(--ws-card);border-radius:9px;padding:5px 8px;font:inherit;font-size:12.5px;color:var(--ws-ink);max-width:150px}
.ws-back{display:none;border:0;background:none;color:var(--ws-a);font:inherit;font-weight:700;cursor:pointer;padding:4px}
.ws-ta{flex:1;border:0;outline:0;resize:none;background:transparent;font:inherit;font-size:16px;line-height:1.85;padding:20px 26px;color:var(--ws-ink)}
.ws-tt{border:0;outline:0;background:transparent;font:inherit;font-size:24px;font-weight:800;padding:20px 26px 0;color:var(--ws-ink);width:100%}.ws-tt::placeholder,.ws-ta::placeholder{color:var(--ws-mut);opacity:.7}
.wsx .ws-tt,.wsx .ws-ta{border:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important;outline:0!important;max-width:none;margin:0}
.ws-cnt{margin:0;padding:6px 16px 10px;color:var(--ws-mut);font-size:11.5px;text-align:end}
.ws-ph{margin:auto;text-align:center;color:var(--ws-mut);padding:30px}.ws-ph span{font-size:44px;display:block;opacity:.6}.ws-ph p{line-height:1.9}
/* المهام */
.ws-tch{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ws-tn{margin:8px 4px 14px}
.ws-tk .tkx-hd h2{visibility:hidden;font-size:0;margin:0}.ws-tk .tkx{max-width:none}
/* الحسابات */
.ws-mh{display:flex;align-items:center;gap:6px;margin-bottom:12px}.ws-mh b{font-size:18px;min-width:130px;text-align:center}.ws-mh .ws-ib{font-size:22px;padding:2px 10px}
.ws-mg{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:14px;margin-bottom:14px}
.ws-tg{display:inline-flex;background:var(--ws-soft);border-radius:10px;padding:3px}.ws-tg button{border:0;background:transparent;font:inherit;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:8px;cursor:pointer;color:var(--ws-ink)}.ws-tg button.on{background:var(--ws-card);box-shadow:0 1px 3px rgba(42,29,44,.12);color:var(--ws-a)}
.ws-bars{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;height:150px;align-items:end}
.ws-bars button{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:100%;border:0;background:transparent;cursor:pointer;position:relative;padding:0 0 18px;border-radius:8px}
.ws-bars button.on{background:var(--ws-soft)}.ws-bars span{width:9px;border-radius:4px 4px 0 0;min-height:2px;transition:height .7s cubic-bezier(.16,1,.3,1)}.ws-bars .bi{background:var(--ws-o)}.ws-bars .bo{background:var(--ws-r)}
.ws-bars small{position:absolute;bottom:0;font-size:10.5px;color:var(--ws-mut);white-space:nowrap}
.ws-lg2{font-size:12px;color:var(--ws-mut);margin:8px 0 0}.ws-lg2 i{display:inline-block;width:9px;height:9px;border-radius:3px;margin:0 8px 0 3px;vertical-align:middle}.ws-lg2 i.in{background:var(--ws-o)}.ws-lg2 i.out{background:var(--ws-r)}
.ws-form{margin-bottom:14px}
.ws-fm{display:grid;grid-template-columns:auto 130px 1fr 150px 1.3fr auto auto;gap:8px;align-items:center}
.ws-fm input{border:1px solid var(--ws-line);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;background:var(--ws-ed);color:var(--ws-ink);min-width:0}
.ws-fm input:focus{outline:2px solid var(--ws-a2);outline-offset:0;border-color:transparent}
.ws-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.ws-chips button{border:1px solid var(--ws-line);background:transparent;border-radius:99px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--ws-ink)}.ws-chips button.on{background:var(--ws-a);color:#fff;border-color:var(--ws-a)}
.ws-ml{display:grid}.ws-mr{display:grid;grid-template-columns:54px 1fr auto auto;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--ws-line)}
.ws-mr.on{background:var(--ws-soft);border-radius:10px}.ws-mr .dt{color:var(--ws-mut);font-size:12.5px;font-variant-numeric:tabular-nums}
.ws-mr .c b{display:block;font-size:14px}.ws-mr .c small{color:var(--ws-mut);font-size:12px}
.ws-mr .a{font-variant-numeric:tabular-nums;direction:ltr;font-size:15px}.ws-mr.in .a{color:var(--ws-o)}.ws-mr.out .a{color:var(--ws-r)}
.ws-mr .ac{display:flex;opacity:.55}.ws-mr:hover .ac{opacity:1}
/* الليلي */
[data-theme=dark] .wsx{--ws-ink:#efe6ee;--ws-mut:#b3a3b1;--ws-card:#2b2130;--ws-line:rgba(255,255,255,.1);--ws-soft:rgba(214,176,208,.1);--ws-ed:#251c29;--ws-a:#c69bbf;--ws-o:#a4b46e;--ws-r:#e07a6e}
[data-theme=dark] .ws-it.on{background:rgba(198,155,191,.22)}[data-theme=dark] .wsx .b.p{color:#1e1520}[data-theme=dark] .ws-fl button.on,[data-theme=dark] .ws-fr.on>button:first-child{color:#1e1520}
/* التابلت والجوال */
@media (max-width:1100px){.ws-home,.ws-tch{grid-template-columns:1fr 1fr}.ws-c3{grid-column:1/-1}.ws-mg{grid-template-columns:1fr 1fr}.ws-6m{grid-column:1/-1}
 .ws-fm{grid-template-columns:auto 1fr 1fr}.ws-fm #ws-fn{grid-column:1/-2}.ws-nt{grid-template-columns:180px 250px 1fr}}
@media (max-width:760px){.ws-home,.ws-tch,.ws-mg{grid-template-columns:1fr}.ws-kp.big{grid-template-columns:1fr 1fr}
 .ws-seg{display:grid;grid-template-columns:1fr 1fr;overflow:visible}.ws-seg button{font-size:13px;padding:8px 6px}.ws-ttl b{font-size:20px}
 .ws-ch{flex-direction:column;align-items:stretch}.ws-ch .ws-dn{align-self:center}.ws-lg{min-width:0}
 .ws-nt{display:block;height:auto;min-height:0;max-height:none;border-radius:16px}
 .ws-fl{display:flex;gap:6px;overflow-x:auto;border:0;border-bottom:1px solid var(--ws-line);padding:8px;align-items:center}.ws-fl h4{display:none}
 .ws-fl>button,.ws-fr{flex:none;width:auto}.ws-fl button{width:auto;padding:7px 12px;border-radius:99px;background:var(--ws-soft)}.ws-fl .ws-nf{display:flex;flex:none}
 .ws-ls{border:0;min-height:300px}.ws-ed{display:none;min-height:70vh}
 .ws-nt.mob-ed .ws-fl,.ws-nt.mob-ed .ws-ls{display:none}.ws-nt.mob-ed .ws-ed{display:flex}.ws-back{display:inline-block}
 .ws-ta{padding:16px;font-size:16px}.ws-dw{width:136px;height:136px}.ws-ch .ws-dw{align-self:center}
 .ws-fm{grid-template-columns:1fr 1fr}.ws-fm .ws-tg{grid-column:1/-1;justify-self:start}.ws-fm #ws-fn{grid-column:1/-1}.ws-fm .b{width:100%}
 .ws-mr{grid-template-columns:44px 1fr auto}.ws-mr .ac{grid-column:1/-1;justify-content:flex-end;opacity:1}}
@media (prefers-reduced-motion:reduce){.ws-dn .seg,.ws-bars span{transition:none}}
html.lite .ws-dn .seg,html.lite .ws-bars span{transition:none}
`;
const css=()=>{if(!g("ws-css")){const s=document.createElement("style");s.id="ws-css";s.textContent=CSS;document.head.appendChild(s)}};
