// 📞 المكالمات الصوتية داخل المنصة (17 نوفمبر 2026، طلب محمد: "مكالمات بجودة خرافية ونكلم بعض")
// - الصوت بيروح مباشرة بين الجهازين (WebRTC) بترميز Opus بجودة عالية (48kHz، 64kbps، FEC)، ولو الشبكة مابتسمحش بالاتصال المباشر
//   بيعدّي على TURN من Cloudflare (السيرفر بيدّي بيانات دخول مؤقتة من /ice).
// - الإشارة (offer/answer) في مستند call/{id} = {fr, to, frn, st:ring|acc|rej|busy|miss|end, ts, of, an?, at?, en?, by?}
//   والقواعد (002_rules.sql: call_ok/sdp_ok) بتسمح بنفس أزواج الدردشة بس، والطرفين بس اللي يشوفوا المكالمة.
// - المكالمة الجاية: سماع call where to == أنا، ورنة + اهتزاز + شاشة رد. والمنصة مقفولة: إشعار "📞 بيتصل بك" (/call في السيرفر).
// - زرار 📞 في رأس المحادثة (bchat.js بيبعت tz-call-start).
import {collection,doc,setDoc,updateDoc,onSnapshot,query,where,PUSH_URL} from "./fb.js";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const RING_MS=45000;
const canVib=()=>!!navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive);// الاهتزاز بعد أول لمسة بس (غير كده المتصفح بيرفضه)
let X=null,UN=null,C=null,SEEN=new Set(),ICE={t:0,v:null},AC=null,TONE=null;

// ---------- خوادم الاتصال ----------
async function token(){const u=X&&X.auth&&X.auth.currentUser;return u?await u.getIdToken():""}
async function iceServers(){
 if(ICE.v&&Date.now()-ICE.t<3e6)return ICE.v;
 try{const t=await token();const r=await fetch(PUSH_URL+"/ice",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:"{}"});const j=await r.json();
  if(j&&Array.isArray(j.iceServers)&&j.iceServers.length){ICE={t:Date.now(),v:j.iceServers};return j.iceServers}}catch(e){}
 return [{urls:["stun:stun.cloudflare.com:3478","stun:stun.l.google.com:19302"]}];
}
// ---------- جودة الصوت: Opus fullband + FEC (تصحيح الضياع) + من غير DTX ----------
function hiq(sdp){
 const m=/a=rtpmap:(\d+) opus\/48000(\/2)?/i.exec(sdp);if(!m)return sdp;const pt=m[1];
 const want={minptime:"10",useinbandfec:"1",usedtx:"0",maxaveragebitrate:"64000",maxplaybackrate:"48000","sprop-maxcapturerate":"48000",stereo:"0","sprop-stereo":"0"};
 const re=new RegExp("a=fmtp:"+pt+" ([^\\r\\n]*)");
 if(re.test(sdp))return sdp.replace(re,(x,p)=>{const o={};String(p).split(";").forEach(kv=>{const i=kv.indexOf("=");if(i>0)o[kv.slice(0,i).trim()]=kv.slice(i+1).trim()});Object.assign(o,want);return "a=fmtp:"+pt+" "+Object.keys(o).map(k=>k+"="+o[k]).join(";")});
 return sdp.replace(m[0],m[0]+"\r\na=fmtp:"+pt+" "+Object.keys(want).map(k=>k+"="+want[k]).join(";"));
}
const gathered=pc=>new Promise(ok=>{if(pc.iceGatheringState==="complete")return ok();const t=setTimeout(ok,3000);pc.addEventListener("icegatheringstatechange",()=>{if(pc.iceGatheringState==="complete"){clearTimeout(t);ok()}})});
async function mic(){return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000},video:false})}
async function mkPc(){
 const pc=new RTCPeerConnection({iceServers:await iceServers(),bundlePolicy:"max-bundle"});
 pc.ontrack=e=>{const a=g("tzc-au");if(a&&e.streams&&e.streams[0]){a.srcObject=e.streams[0];const p=a.play();if(p&&p.catch)p.catch(()=>{})}};
 pc.onconnectionstatechange=()=>{if(!C||C.pc!==pc)return;const s=pc.connectionState;
  if(s==="connected"){C.dropT&&clearTimeout(C.dropT);C.dropT=0;if(!C.t0){C.t0=Date.now();tone(null);status("")}else status("")}
  else if(s==="disconnected"){status("⚠️ الاتصال ضعيف، جارٍ إعادة الاتصال…");if(!C.dropT)C.dropT=setTimeout(()=>{if(C&&C.pc===pc&&pc.connectionState!=="connected")hang("drop")},12000)}
  else if(s==="failed")hang("drop")};
 return pc;
}
// ---------- الرنة (من غير ملفات صوت) ----------
function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume().catch(()=>{});return AC}catch(e){return null}}
function tone(kind){
 if(TONE){clearInterval(TONE.iv);TONE.o.forEach(x=>{try{x.stop()}catch(e){}});try{TONE.g.disconnect()}catch(e){}TONE=null}
 try{canVib()&&navigator.vibrate(0)}catch(e){}
 if(!kind)return;const a=ac();if(!a)return;const gn=a.createGain();gn.gain.value=0;gn.connect(a.destination);
 const fr=kind==="in"?[[660,0],[880,.4]]:[[425,0]],o=fr.map(([f])=>{const x=a.createOscillator();x.type="sine";x.frequency.value=f;x.connect(gn);x.start();return x});
 const beat=()=>{const t=a.currentTime,v=kind==="in"?.22:.12;gn.gain.cancelScheduledValues(t);gn.gain.setValueAtTime(0,t);
  if(kind==="in"){gn.gain.linearRampToValueAtTime(v,t+.03);gn.gain.setValueAtTime(v,t+.8);gn.gain.linearRampToValueAtTime(0,t+.85);gn.gain.linearRampToValueAtTime(v,t+1.05);gn.gain.setValueAtTime(v,t+1.8);gn.gain.linearRampToValueAtTime(0,t+1.85);try{canVib()&&navigator.vibrate([700,300,700])}catch(e){}}
  else{gn.gain.linearRampToValueAtTime(v,t+.03);gn.gain.setValueAtTime(v,t+1);gn.gain.linearRampToValueAtTime(0,t+1.05)}};
 beat();TONE={g:gn,iv:setInterval(beat,kind==="in"?3000:4000),o};
}
// ---------- الشاشة ----------
const CSS=`#tzc{position:fixed;inset:0;z-index:99995;display:none;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 50% 0%,#58395f 0%,#2a1d2c 55%,#1c1320 100%);color:#fff;font-family:inherit;direction:rtl}
#tzc.on{display:flex}#tzc .k{box-sizing:border-box;width:100%;max-width:380px;padding:28px 22px calc(28px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;text-align:center;min-height:100%;justify-content:space-between}
#tzc .top{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6vh}
#tzc .av{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;font-size:44px;font-weight:700;background:rgba(255,255,255,.12);box-shadow:0 0 0 0 rgba(180,138,171,.55)}
#tzc.ring .av{animation:tzc-p 1.6s ease-out infinite}@keyframes tzc-p{0%{box-shadow:0 0 0 0 rgba(180,138,171,.55)}100%{box-shadow:0 0 0 26px rgba(180,138,171,0)}}
#tzc h2{margin:6px 0 0;font-size:24px;font-weight:700}#tzc .st{color:#e3c8dd;font-size:15px;min-height:22px}#tzc .tm{font-size:17px;font-variant-numeric:tabular-nums;color:#fff;letter-spacing:.5px}
#tzc .q{display:inline-flex;gap:3px;align-items:flex-end;height:16px;margin-inline-start:6px;vertical-align:middle}#tzc .q i{width:4px;border-radius:2px;background:rgba(255,255,255,.3)}#tzc .q i:nth-child(1){height:6px}#tzc .q i:nth-child(2){height:11px}#tzc .q i:nth-child(3){height:16px}
#tzc .q.l1 i:nth-child(1),#tzc .q.l2 i:nth-child(-n+2),#tzc .q.l3 i{background:#a4b46e}#tzc .q.l1 i:nth-child(1){background:#ff8a80}
#tzc .bt{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;margin-bottom:4vh}
#tzc .bt button{width:68px;height:68px;border-radius:50%;border:0;font-size:26px;cursor:pointer;color:#fff;background:rgba(255,255,255,.14);display:grid;place-items:center;transition:transform .12s ease,background .15s}
#tzc .bt button:active{transform:scale(.94)}#tzc .bt button.on{background:#fff;color:#2a1d2c}#tzc .bt .end,#tzc .bt .no{background:#e5372b}#tzc .bt .yes{background:#34c759}
#tzc .bt label{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12.5px;color:#e3c8dd}
#tzc .mn{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));inset-inline-start:14px;border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13.5px;cursor:pointer}
#tzcp{position:fixed;z-index:99994;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:none;align-items:center;gap:10px;background:#34c759;color:#fff;border-radius:999px;padding:8px 16px;font:600 14px/1.3 inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;direction:rtl}
#tzcp.on{display:flex}@media (prefers-reduced-motion:reduce){#tzc.ring .av{animation:none}}`;
function ui(){
 if(g("tzc"))return;const s=document.createElement("style");s.id="tzc-css";s.textContent=CSS;document.head.appendChild(s);
 const d=document.createElement("div");d.id="tzc";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-labelledby","tzc-n");
 d.innerHTML=`<button class="mn" type="button" data-tzc="min">⌄ تصغير</button><div class="k"><div class="top"><div class="av" id="tzc-av"></div><h2 id="tzc-n" data-notr></h2><div class="st" id="tzc-st"></div><div class="tm" id="tzc-tm"></div></div><div class="bt" id="tzc-bt"></div></div><audio id="tzc-au" autoplay playsinline></audio>`;
 document.body.appendChild(d);
 const p=document.createElement("div");p.id="tzcp";p.setAttribute("role","button");p.dataset.tzc="max";p.innerHTML=`<span>📞</span><b id="tzcp-n" data-notr></b><span id="tzcp-t"></span>`;document.body.appendChild(p);
}
function show(){ui();const d=g("tzc");d.className="on"+(C&&C.st==="ring"?" ring":"");g("tzcp").className="";if(C){g("tzc-n").textContent=C.name||"";g("tzc-av").textContent=String(C.name||"?").trim().slice(0,1)}buttons()}
function status(t){if(g("tzc-st"))g("tzc-st").textContent=t}
function buttons(){
 const b=g("tzc-bt");if(!b||!C)return;
 if(C.inc&&C.st==="ring")b.innerHTML=`<label><button class="no" type="button" data-tzc="rej" aria-label="رفض">✕</button>رفض</label><label><button class="yes" type="button" data-tzc="acc" aria-label="رد">📞</button>رد</label>`;
 else b.innerHTML=`<label><button class="${C.mute?"on":""}" type="button" data-tzc="mute" aria-label="كتم الميكروفون">${C.mute?"🔇":"🎤"}</button>${C.mute?"إلغاء الكتم":"كتم"}</label><label><button class="end" type="button" data-tzc="end" aria-label="إنهاء المكالمة">📞</button>إنهاء</label>`;
}
const mmss=ms=>{const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
function tick(){
 if(!C)return;const tm=g("tzc-tm"),pt=g("tzcp-t");
 const txt=C.t0?mmss(Date.now()-C.t0):"";if(tm)tm.innerHTML=txt?txt+`<span class="q ${C.q?"l"+C.q:""}" title="جودة الخط"><i></i><i></i><i></i></span>`:"";if(pt)pt.textContent=txt;
 if(C.pc&&C.t0&&(!C.qt||Date.now()-C.qt>2000)){C.qt=Date.now();C.pc.getStats().then(r=>{let rtt=0,loss=0,rec=0;r.forEach(x=>{if(x.type==="candidate-pair"&&x.state==="succeeded"&&x.nominated&&x.currentRoundTripTime!=null)rtt=x.currentRoundTripTime;if(x.type==="inbound-rtp"&&x.kind==="audio"){loss+=N(x.packetsLost);rec+=N(x.packetsReceived)}});
  const lr=rec?loss/(loss+rec):0;C.q=rtt>.45||lr>.08?1:rtt>.25||lr>.03?2:3}).catch(()=>{})}
}
function closeUi(msg){
 tone(null);const d=g("tzc");if(!d)return;
 if(msg){status(msg);g("tzc-bt").innerHTML="";d.className="on";setTimeout(()=>{if(!C){d.className="";g("tzcp").className=""}},1800)}
 else{d.className="";g("tzcp").className=""}
}
// ---------- إنهاء وتنظيف ----------
function cleanup(){
 if(!C)return;const c=C;C=null;
 clearInterval(c.iv);clearTimeout(c.rt);clearTimeout(c.dropT);if(c.un)try{c.un()}catch(e){}
 if(c.stream)c.stream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});
 if(c.pc)try{c.pc.close()}catch(e){}
 const a=g("tzc-au");if(a)a.srcObject=null;tone(null);
}
async function hang(why){
 if(!C)return;const c=C,id=c.id,st=c.st;let msg="انتهت المكالمة",up=null;
 if(why==="rej"){up={st:"rej"};msg="تم الرفض"}
 else if(why==="miss"){up={st:"miss"};msg="لم يتم الرد"}
 else if(st==="ring"&&!c.inc)up={st:"end",en:Date.now(),by:X.party};
 else if(st==="acc")up={st:"end",en:Date.now(),by:X.party};
 if(why==="drop")msg="انقطع الاتصال";
 if(why==="remote")up=null;
 if(c.t0&&why!=="drop")msg="انتهت المكالمة · "+mmss(Date.now()-c.t0);
 cleanup();closeUi(msg);
 if(up&&id)try{await updateDoc(doc(X.db,"call",id),up)}catch(e){}
}
// ---------- مكالمة صادرة ----------
export async function startCall(to,name){
 if(!X)return;if(C){X.toast&&X.toast("أنت في مكالمة الآن");show();return}
 if(!window.RTCPeerConnection||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){X.toast&&X.toast("هذا المتصفح لا يدعم المكالمات. استخدم Chrome أو Safari حديث","er");return}
 ac();const id=doc(collection(X.db,"call")).id;
 C={id,inc:false,to,name:String(name||"").slice(0,60),st:"init",mute:false};show();status("جارٍ تجهيز المكالمة…");
 try{C.stream=await mic()}catch(e){cleanup();closeUi("اسمح للمنصة باستخدام الميكروفون ثم حاول مرة أخرى");return}
 if(!C||C.id!==id){return}
 try{
  const pc=await mkPc();C.pc=pc;C.stream.getTracks().forEach(t=>pc.addTrack(t,C.stream));
  const of=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription({type:"offer",sdp:hiq(of.sdp)});await gathered(pc);
  if(!C||C.id!==id)return;
  await setDoc(doc(X.db,"call",id),{fr:X.party,to,frn:String(X.name()||"").slice(0,60),st:"ring",ts:Date.now(),of:{t:"offer",s:pc.localDescription.sdp}});
  C.st="ring";show();status("يرن…");tone("out");
  token().then(t=>fetch(PUSH_URL+"/call",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({id})})).catch(()=>{});
  C.rt=setTimeout(()=>{if(C&&C.id===id&&C.st==="ring")hang("miss")},RING_MS);
  C.iv=setInterval(tick,500);
  C.un=onSnapshot(doc(X.db,"call",id),s=>{if(!C||C.id!==id||!s.exists())return;const d=s.data();
   if(d.st==="acc"&&d.an&&!C.ans){C.ans=true;C.st="acc";clearTimeout(C.rt);tone(null);status("جارٍ الاتصال…");buttons();g("tzc").className="on";C.pc.setRemoteDescription({type:"answer",sdp:hiq(d.an.s)}).catch(()=>hang("drop"))}
   else if(d.st==="rej"){cleanup();closeUi("رفض المكالمة")}
   else if(d.st==="busy"){cleanup();closeUi("مشغول في مكالمة أخرى")}
   else if(d.st==="end"&&d.by!==X.party){const t0=C.t0;cleanup();closeUi(t0?"انتهت المكالمة · "+mmss(Date.now()-t0):"انتهت المكالمة")}
  },()=>{});
 }catch(e){cleanup();closeUi(String(e&&e.code)==="permission-denied"?"لا يمكنك الاتصال بهذا الشخص":"تعذّر بدء المكالمة")}
}
// ---------- مكالمة واردة ----------
function incoming(id,d){
 if(SEEN.has(id))return;SEEN.add(id);
 if(C){updateDoc(doc(X.db,"call",id),{st:"busy"}).catch(()=>{});return}
 C={id,inc:true,to:d.fr,name:String(d.frn||(String(d.fr||"").slice(0,1)==="b"?"فرع "+String(d.fr).slice(2):"مكالمة")),st:"ring",of:d.of,mute:false};
 show();status("مكالمة واردة…");tone("in");C.iv=setInterval(tick,500);
 C.rt=setTimeout(()=>{if(C&&C.id===id&&C.st==="ring"){cleanup();closeUi("مكالمة فائتة")}},Math.max(5000,RING_MS-(Date.now()-N(d.ts))+3000));
 C.un=onSnapshot(doc(X.db,"call",id),s=>{if(!C||C.id!==id||!s.exists())return;const x=s.data();
  if(C.st==="ring"&&(x.st==="end"||x.st==="miss")){cleanup();closeUi("مكالمة فائتة من "+(x.frn||""))}
  else if(C.st==="acc"&&x.st==="end"&&x.by!==X.party){const t0=C.t0;cleanup();closeUi(t0?"انتهت المكالمة · "+mmss(Date.now()-t0):"انتهت المكالمة")}},()=>{});
 if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){try{new Notification("📞 "+C.name+" يتصل بك",{body:"اضغط للرد",tag:"call"+id})}catch(e){}}
}
async function accept(){
 if(!C||!C.inc||C.st!=="ring")return;const id=C.id;tone(null);status("جارٍ الاتصال…");C.st="conn";buttons();g("tzc").className="on";
 try{C.stream=await mic()}catch(e){hang("rej");closeUi("اسمح للمنصة باستخدام الميكروفون للرد");return}
 try{
  const pc=await mkPc();C.pc=pc;C.stream.getTracks().forEach(t=>pc.addTrack(t,C.stream));
  await pc.setRemoteDescription({type:"offer",sdp:hiq(C.of.s)});const an=await pc.createAnswer();await pc.setLocalDescription({type:"answer",sdp:hiq(an.sdp)});await gathered(pc);
  if(!C||C.id!==id)return;
  await updateDoc(doc(X.db,"call",id),{st:"acc",an:{t:"answer",s:pc.localDescription.sdp},at:Date.now()});C.st="acc";clearTimeout(C.rt);buttons();
 }catch(e){cleanup();closeUi("تعذّر الرد على المكالمة")}
}
// ---------- الضغطات ----------
document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-tzc]");if(!t||!X)return;const a=t.dataset.tzc;
 if(a==="acc")accept();else if(a==="rej")hang("rej");else if(a==="end")hang("end");
 else if(a==="mute"&&C&&C.stream){C.mute=!C.mute;C.stream.getAudioTracks().forEach(x=>x.enabled=!C.mute);buttons()}
 else if(a==="min"){if(C){g("tzc").className="";g("tzcp-n").textContent=C.name;g("tzcp").className="on"}else closeUi()}
 else if(a==="max")show()});
addEventListener("tz-call-start",e=>{const d=e.detail||{};if(d.to)startCall(d.to,d.name)});
addEventListener("pagehide",()=>{if(C&&C.st==="acc")hang("end")});

// ---------- البداية ----------
// ctx: {db, auth, party:"w-…"|"b-…"|"d-…", name:()=>اسمي, toast}
export function initCall(ctx){
 stopCall();if(!ctx||!ctx.db||!/^[bdw]-./.test(String(ctx.party||"")))return;
 X=ctx;window.__tzCall=!!(window.RTCPeerConnection&&navigator.mediaDevices);
 const since=Date.now()-RING_MS;
 UN=onSnapshot(query(collection(X.db,"call"),where("to","==",X.party),where("ts",">=",since)),sn=>{
  sn.docs.forEach(s=>{const d=s.data();if(d&&d.st==="ring"&&Date.now()-N(d.ts)<RING_MS)incoming(s.id,d)})},()=>{});
 try{const u=new URL(location.href);if(u.searchParams.has("call")){u.searchParams.delete("call");history.replaceState(null,"",u.pathname+(u.search||"")+u.hash)}}catch(e){}
}
export const callState=()=>C?{id:C.id,st:C.st,inc:C.inc,conn:C.pc?C.pc.connectionState:"",t0:!!C.t0}:null;// للتشخيص والاختبار
export function stopCall(){if(C)hang("end");if(UN){try{UN()}catch(e){}UN=null}X=null;window.__tzCall=false}
