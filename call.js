// 📞 المكالمات الصوتية داخل المنصة (17 نوفمبر 2026، طلب محمد: "مكالمات بجودة خرافية ونكلم بعض")
// - الصوت WebRTC بترميز Opus بجودة عالية (48kHz، 64kbps، FEC) ومشفّر بين الطرفين (DTLS-SRTP).
// - v3 (محمد: "بتاخد وقت لحد ما تجمع" + "كل المكالمات من خلال السيرفر اللي اشتركنا فيه"):
//   * لو TURN (Cloudflare) متاح: كل المكالمات بتعدّي عليه (iceTransportPolicy:"relay") = توصيل ثابت وسريع على أي شبكة،
//     والصوت لسه مشفّر (السيرفر بيعدّي الحزم بس ومايقدرش يسمعها). من غيره: مباشر/STUN زي الأول.
//   * أثناء الرنة، جهاز المستقبل بيجهّز الرد كله (العناوين والـ answer) في الخلفية، فلما يضغط "رد" الرد بيتبعت فوراً.
//   * المتصل بيسأل عن الرد كل ثانية ونص كمان (جنب السماع اللحظي)، فمفيش تأخير لو السماع اتأخر.
//   * شاشة اتصال جديدة: خلفية متحركة هادية، هالة بتتحرك مع صوت الطرف التاني، شريط تحكم زجاجي، وحبة مصغّرة احترافية.
// - الإشارة في call/{id} = {fr, to, frn, st:ring|acc|rej|busy|miss|end, ts, of, an?, at?, en?, by?} (القواعد: call_ok/sdp_ok).
import {collection,doc,getDoc,setDoc,updateDoc,onSnapshot,query,where,PUSH_URL} from "./fb.js";
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const RING_MS=45000,CONNECT_MS=20000,WIN=10*6e4;
const canVib=()=>!!navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive);
let X=null,UN=null,C=null,SEEN=new Set(),ICE={t:0,v:null,turn:false},AC=null,TONE=null,LV=null;

// ---------- خوادم الاتصال ----------
async function token(){const u=X&&X.auth&&X.auth.currentUser;return u?await u.getIdToken():""}
async function iceServers(force){
 if(!force&&ICE.v&&Date.now()-ICE.t<45*6e4)return ICE.v;
 try{const t=await token();const r=await fetch(PUSH_URL+"/ice",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:"{}"});const j=await r.json();
  if(j&&Array.isArray(j.iceServers)&&j.iceServers.length){ICE={t:Date.now(),v:j.iceServers,turn:!!j.turn};return j.iceServers}}catch(e){}
 return ICE.v||[{urls:["stun:stun.cloudflare.com:3478","stun:stun.l.google.com:19302"]}];
}
// ---------- جودة الصوت: Opus fullband + FEC (تصحيح الضياع) + من غير DTX ----------
function hiq(sdp){
 const m=/a=rtpmap:(\d+) opus\/48000(\/2)?/i.exec(sdp);if(!m)return sdp;const pt=m[1];
 const want={minptime:"10",useinbandfec:"1",usedtx:"0",maxaveragebitrate:"64000",maxplaybackrate:"48000","sprop-maxcapturerate":"48000",stereo:"0","sprop-stereo":"0"};
 const re=new RegExp("a=fmtp:"+pt+" ([^\\r\\n]*)");
 if(re.test(sdp))return sdp.replace(re,(x,p)=>{const o={};String(p).split(";").forEach(kv=>{const i=kv.indexOf("=");if(i>0)o[kv.slice(0,i).trim()]=kv.slice(i+1).trim()});Object.assign(o,want);return "a=fmtp:"+pt+" "+Object.keys(o).map(k=>k+"="+o[k]).join(";")});
 return sdp.replace(m[0],m[0]+"\r\na=fmtp:"+pt+" "+Object.keys(want).map(k=>k+"="+want[k]).join(";"));
}
// تجميع العناوين: مع TURN بنكتفي بأول عنوان على السيرفر (+ لحظة للباقي)، من غيره لحد ثانية ونص
const gathered=pc=>new Promise(ok=>{if(pc.iceGatheringState==="complete")return ok();let done=false;const fin=()=>{if(done)return;done=true;clearTimeout(t);ok()};
 const t=setTimeout(fin,ICE.turn?2500:1500);pc.addEventListener("icegatheringstatechange",()=>{if(pc.iceGatheringState==="complete")fin()});
 if(ICE.turn)pc.addEventListener("icecandidate",e=>{if(e.candidate&&/ typ relay/.test(e.candidate.candidate))setTimeout(fin,250)})});
async function mic(){return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000},video:false})}
const failMsg=()=>ICE.turn?"تعذّر توصيل الصوت بسبب ضعف الإنترنت عند أحد الطرفين. حاول مرة أخرى":"تعذّر توصيل الصوت: شبكة أحد الطرفين تمنع الاتصال المباشر";
async function mkPc(){
 const servers=await iceServers();
 const pc=new RTCPeerConnection({iceServers:servers,bundlePolicy:"max-bundle",iceTransportPolicy:ICE.turn?"relay":"all"});
 pc.ontrack=e=>{const a=g("tzc-au");if(!a)return;const st=e.streams&&e.streams[0]?e.streams[0]:new MediaStream([e.track]);a.srcObject=st;const p=a.play();if(p&&p.catch)p.catch(()=>{if(C){C.tap=true;status("اضغط على الشاشة لتشغيل الصوت")}});level(st)};
 pc.onconnectionstatechange=()=>{if(!C||C.pc!==pc)return;const s=pc.connectionState;
  if(s==="connected"&&C.inc&&C.st==="ring")return;// اتجهّز قبل الرد: مانبدأش العداد إلا بعد ما يرد
  if(s==="connected"){clearTimeout(C.dropT);C.dropT=0;clearTimeout(C.ct);if(!C.t0){C.t0=Date.now();tone(null);paint();try{const A=NAT();if(A&&A.callOn)A.callOn(String(C.name||""))}catch(e){}}status("")}
  else if(s==="disconnected"){status("الاتصال ضعيف… جارٍ إعادة الاتصال");if(!C.dropT)C.dropT=setTimeout(()=>{if(C&&C.pc===pc&&pc.connectionState!=="connected")hang("drop")},12000)}
  else if(s==="failed")hang(C.t0?"drop":"fail")};
 return pc;
}
function connectWatch(){if(!C)return;const id=C.id;clearTimeout(C.ct);C.ct=setTimeout(()=>{if(C&&C.id===id&&!C.t0)hang("fail")},CONNECT_MS)}
// ---------- مستوى صوت الطرف التاني (الهالة حوالين الصورة بتتحرك معاه) ----------
function level(st){
 levelStop();const a=ac();if(!a)return;
 try{const src=a.createMediaStreamSource(st),an=a.createAnalyser();an.fftSize=512;src.connect(an);const buf=new Uint8Array(an.fftSize);let sm=0;
  LV={src,an,iv:setInterval(()=>{an.getByteTimeDomainData(buf);let s=0;for(let i=0;i<buf.length;i++){const v=(buf[i]-128)/128;s+=v*v}const r=Math.min(1,Math.sqrt(s/buf.length)*4);sm=sm*.6+r*.4;const el=g("tzc");if(el)el.style.setProperty("--lv",sm.toFixed(3))},80)}}catch(e){}
}
function levelStop(){if(LV){clearInterval(LV.iv);try{LV.src.disconnect()}catch(e){}LV=null;const el=g("tzc");if(el)el.style.setProperty("--lv","0")}}
// ---------- الرنة (من غير ملفات صوت) ----------
function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume().catch(()=>{});return AC}catch(e){return null}}
// 🎵 رنة تاسومة (17 نوفمبر 2026، طلب محمد "رنة خاصة"): لحن ماريمبا قصير (مي-صول-سي-مي…) بيتولّد بالصوت من غير ملفات،
// ونغمة انتظار هادية للمتصل (425 هرتز زي شبكات السعودية).
const RING=[[659.25,0,.55],[783.99,.16,.55],[987.77,.32,.55],[1318.51,.48,.9],[987.77,.92,.45],[1318.51,1.08,1.1]];
function pluck(a,out,f,t,dur,vol){
 const g1=a.createGain(),o1=a.createOscillator(),o2=a.createOscillator(),g2=a.createGain();
 o1.type="sine";o1.frequency.value=f;o2.type="sine";o2.frequency.value=f*3.99;g2.gain.value=.12;
 o1.connect(g1);o2.connect(g2);g2.connect(g1);g1.connect(out);
 g1.gain.setValueAtTime(0,t);g1.gain.linearRampToValueAtTime(vol,t+.006);g1.gain.exponentialRampToValueAtTime(.0006,t+dur);
 g2.gain.setValueAtTime(.12,t);g2.gain.exponentialRampToValueAtTime(.0005,t+.18);
 o1.start(t);o2.start(t);o1.stop(t+dur+.05);o2.stop(t+dur+.05);
}
function tone(kind){
 if(TONE){clearInterval(TONE.iv);try{TONE.out.gain.setValueAtTime(0,TONE.a.currentTime)}catch(e){}try{TONE.out.disconnect()}catch(e){}TONE=null}
 if(!kind){try{canVib()&&navigator.vibrate(0)}catch(e){}return}
 const a=ac();if(!a)return;const out=a.createGain();out.gain.value=1;
 // ضغط خفيف علشان الرنة تبقى واضحة من غير ما تخرّف على سماعة الموبايل
 let dest=out;try{const cp=a.createDynamicsCompressor();cp.threshold.value=-18;cp.ratio.value=4;out.connect(cp);cp.connect(a.destination)}catch(e){out.connect(a.destination)}
 const beat=()=>{const t=a.currentTime+.05;
  if(kind==="in"){RING.forEach(([f,d,len])=>pluck(a,dest,f,t+d,len,.32));try{canVib()&&navigator.vibrate([400,200,400,200,900])}catch(e){}}
  else{const o=a.createOscillator(),gn=a.createGain();o.type="sine";o.frequency.value=425;o.connect(gn);gn.connect(dest);gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(.09,t+.04);gn.gain.setValueAtTime(.09,t+1.2);gn.gain.linearRampToValueAtTime(0,t+1.25);o.start(t);o.stop(t+1.3)}};
 beat();TONE={a,out,iv:setInterval(beat,kind==="in"?2600:4500)};
}
// ---------- الشاشة ----------
const SV=(w,p)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
const P={call:"M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z",
 end:"M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.4-.02L.29 13.08a1 1 0 0 1 0-1.41A16.9 16.9 0 0 1 12 7c4.57 0 8.71 1.81 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.48a1 1 0 0 1-1.4.02 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z",
 mic:"M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z",
 micOff:"M19 11h-2c0 .74-.16 1.43-.43 2.05l1.47 1.47A6.9 6.9 0 0 0 19 11zM15 11.16V5a3 3 0 0 0-5.94-.6zM4.27 3 3 4.27l6 6V11a3 3 0 0 0 4.47 2.6l1.66 1.66A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.92V21h2v-3.08a6.9 6.9 0 0 0 2.57-.9L19.73 21 21 19.73z",
 down:"M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z",
 lock:"M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z"};
const CSS=`#tzc{--lv:0;position:fixed;inset:0;z-index:99995;display:none;overflow:hidden;color:#fff;font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;direction:rtl;text-align:center;background:#1b1220}
#tzc.on{display:block;animation:tzc-in .28s cubic-bezier(.16,1,.3,1) both}@keyframes tzc-in{from{opacity:0;transform:scale(1.02)}}
#tzc *{box-sizing:border-box}
#tzc .tzc-bg{position:absolute;inset:-20%;background:radial-gradient(40% 35% at 30% 25%,rgba(180,138,171,.55),transparent 70%),radial-gradient(45% 40% at 75% 70%,rgba(111,125,69,.35),transparent 70%),radial-gradient(60% 50% at 50% 40%,#3a2540,#1b1220 75%);filter:blur(24px);animation:tzc-bg 18s ease-in-out infinite alternate}
@keyframes tzc-bg{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-4%,3%) rotate(8deg)}}
#tzc .tzc-k{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(30px + env(safe-area-inset-bottom,0px));max-width:440px;margin:0 auto}
#tzc .tzc-hd{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px}
#tzc .tzc-sec{display:flex;align-items:center;gap:6px;font-size:12.5px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:5px 11px}
#tzc .tzc-mn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.1);color:#fff;border-radius:50%;cursor:pointer;padding:0;min-height:0;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
#tzc .tzc-mid{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;margin-top:-4vh}
#tzc .tzc-ava{position:relative;width:148px;height:148px;margin-bottom:22px;display:flex;align-items:center;justify-content:center}
#tzc .tzc-ava i{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(227,200,221,.35);opacity:0}
#tzc.ring .tzc-ava i{animation:tzc-w 2.4s ease-out infinite}#tzc.ring .tzc-ava i:nth-child(2){animation-delay:.8s}#tzc.ring .tzc-ava i:nth-child(3){animation-delay:1.6s}
@keyframes tzc-w{0%{transform:scale(1);opacity:.75}100%{transform:scale(1.75);opacity:0}}
#tzc .tzc-halo{position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(closest-side,rgba(164,180,110,.55),rgba(164,180,110,0));opacity:calc(var(--lv)*1.4);transform:scale(calc(1 + var(--lv)*.35));transition:opacity .12s linear,transform .12s linear}
#tzc .tzc-av{position:relative;width:132px;height:132px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;line-height:1;background:linear-gradient(150deg,#c9a3c0 0%,#8a5a83 55%,#5b3a58 100%);box-shadow:0 18px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.25)}
#tzc .tzc-nm{font-size:28px;font-weight:700;line-height:1.3;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.2px}
#tzc .tzc-sub{font-size:14px;color:rgba(255,255,255,.62)}
#tzc .tzc-st{margin-top:10px;font-size:15px;color:#f0dcea;min-height:24px;line-height:1.6;max-width:330px}
#tzc .tzc-st .dots::after{content:"";display:inline-block;width:1.1em;text-align:start;animation:tzc-d 1.4s steps(4,end) infinite}@keyframes tzc-d{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
#tzc .tzc-tm{margin-top:10px;display:inline-flex;align-items:center;gap:10px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12);font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:.6px;direction:ltr}
#tzc .tzc-tm[hidden]{display:none}
#tzc .tzc-q{display:inline-flex;gap:3px;align-items:flex-end;height:14px}#tzc .tzc-q i{display:block;width:4px;border-radius:2px;background:rgba(255,255,255,.28)}#tzc .tzc-q i:nth-child(1){height:5px}#tzc .tzc-q i:nth-child(2){height:9px}#tzc .tzc-q i:nth-child(3){height:14px}
#tzc .tzc-q.l3 i{background:#a4d36e}#tzc .tzc-q.l2 i:nth-child(-n+2){background:#f0c35a}#tzc .tzc-q.l1 i:nth-child(1){background:#ff8a80}
#tzc .tzc-bar{width:100%;display:flex;justify-content:center;gap:34px;padding:18px 20px;border-radius:30px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
#tzc .tzc-bar.inc{background:none;border-color:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;gap:70px}
#tzc .tzc-b{display:flex;flex-direction:column;align-items:center;gap:9px;font-size:12.5px;color:rgba(255,255,255,.8);background:none;border:0;padding:0;margin:0;font-family:inherit;cursor:pointer;width:auto;min-height:0;box-shadow:none}
#tzc .tzc-b>span:first-child{width:66px;height:66px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.14);transition:transform .14s cubic-bezier(.16,1,.3,1),background .18s ease;box-shadow:0 8px 20px rgba(0,0,0,.25)}
#tzc .tzc-bar.inc .tzc-b>span:first-child{width:76px;height:76px}
#tzc .tzc-b:hover>span:first-child{transform:translateY(-2px)}#tzc .tzc-b:active>span:first-child{transform:scale(.92)}
#tzc .tzc-b.on>span:first-child{background:#fff;color:#2a1d2c}
#tzc .tzc-b.red>span:first-child{background:linear-gradient(160deg,#ff5a4f,#d92d22)}#tzc .tzc-b.green>span:first-child{background:linear-gradient(160deg,#4cd964,#22a447)}
#tzc .tzc-b.green.ring>span:first-child{animation:tzc-j 1.4s cubic-bezier(.16,1,.3,1) infinite}@keyframes tzc-j{0%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}60%{transform:translateY(0)}}
#tzc .tzc-b:focus-visible>span:first-child{outline:3px solid #f0dcea;outline-offset:3px}
#tzcp{position:fixed;z-index:99994;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:none;align-items:center;gap:10px;background:rgba(27,18,32,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 8px 7px 16px;font:600 14px/1.3 "IBM Plex Sans Arabic",Tahoma,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;direction:rtl;max-width:calc(100% - 24px);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#tzcp.on{display:flex;animation:tzc-in .25s cubic-bezier(.16,1,.3,1) both}
#tzcp .dot{width:28px;height:28px;border-radius:50%;background:#34c759;display:flex;align-items:center;justify-content:center;flex:none}
#tzcp b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}#tzcp .t{font-variant-numeric:tabular-nums;direction:ltr;color:#c9f2b8}#tzcp .mu{color:#ff8a80;display:none}#tzcp.muted .mu{display:inline-flex}
@media (max-height:640px){#tzc .tzc-ava{width:120px;height:120px;margin-bottom:12px}#tzc .tzc-av{width:108px;height:108px;font-size:42px}#tzc .tzc-mid{margin-top:0}}
@media (prefers-reduced-motion:reduce){#tzc .tzc-bg,#tzc.ring .tzc-ava i,#tzc .tzc-b.green.ring>span:first-child,#tzc.on,#tzcp.on{animation:none}}`;
function ui(){
 if(g("tzc"))return;const s=document.createElement("style");s.id="tzc-css";s.textContent=CSS;document.head.appendChild(s);
 const d=document.createElement("div");d.id="tzc";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-labelledby","tzc-n");d.setAttribute("data-noico","");
 d.innerHTML=`<div class="tzc-bg"></div><div class="tzc-k"><div class="tzc-hd"><span class="tzc-sec">${SV(13,P.lock)}<span>مكالمة صوتية مشفّرة</span></span><button class="tzc-mn" type="button" data-tzc="min" aria-label="تصغير" title="تصغير">${SV(22,P.down)}</button></div>
 <div class="tzc-mid"><div class="tzc-ava"><i></i><i></i><i></i><span class="tzc-halo"></span><div class="tzc-av" id="tzc-av"></div></div><div class="tzc-nm" id="tzc-n" data-notr></div><div class="tzc-sub" id="tzc-sub"></div><div class="tzc-st" id="tzc-st" role="status"></div><div class="tzc-tm" id="tzc-tm" hidden></div></div>
 <div class="tzc-bar" id="tzc-bt"></div></div><audio id="tzc-au" autoplay playsinline></audio>`;
 document.body.appendChild(d);
 const p=document.createElement("div");p.id="tzcp";p.setAttribute("role","button");p.setAttribute("tabindex","0");p.setAttribute("data-noico","");p.dataset.tzc="max";
 p.innerHTML=`<span class="dot">${SV(15,P.call)}</span><b id="tzcp-n" data-notr></b><span class="mu">${SV(16,P.micOff)}</span><span class="t" id="tzcp-t"></span>`;document.body.appendChild(p);
}
const initial=s=>{const t=String(s||"").replace(/^[^0-9A-Za-z؀-ۿ]+/,"").trim();return t?t.slice(0,1):"?"};
const kindOf=p=>{p=String(p||"");return p[0]==="b"?"فرع":p[0]==="d"?"سائق":"المستودع"};
function paint(){
 if(!C)return;ui();const d=g("tzc");d.className="on"+(C.st==="ring"?" ring":"");g("tzcp").className="";
 g("tzc-n").textContent=C.name||"";g("tzc-av").textContent=initial(C.name);g("tzc-sub").textContent=kindOf(C.to);buttons();
}
function status(t,dots){const el=g("tzc-st");if(el)el.innerHTML=t?`<span class="${dots?"dots":""}">${String(t).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</span>`:""}
const btn=(a,cls,ic,lbl)=>`<button class="tzc-b ${cls}" type="button" data-tzc="${a}" aria-label="${lbl}"><span>${ic}</span><span>${lbl}</span></button>`;
function buttons(){
 const b=g("tzc-bt");if(!b||!C)return;
 if(C.inc&&C.st==="ring"){b.className="tzc-bar inc";b.innerHTML=btn("rej","red",SV(32,P.end),"رفض")+btn("acc","green ring",SV(30,P.call),"رد")}
 else{b.className="tzc-bar";b.innerHTML=btn("mute",C.mute?"on":"",SV(26,C.mute?P.micOff:P.mic),C.mute?"إلغاء الكتم":"كتم")+btn("end","red",SV(30,P.end),"إنهاء")}
 const pp=g("tzcp");if(pp)pp.classList.toggle("muted",!!C.mute);
}
const mmss=ms=>{const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
function tick(){
 if(!C)return;const tm=g("tzc-tm"),pt=g("tzcp-t");
 if(C.t0){const txt=mmss(Date.now()-C.t0);if(tm){tm.hidden=false;tm.innerHTML=`<span>${txt}</span><span class="tzc-q ${C.q?"l"+C.q:""}" title="جودة الخط"><i></i><i></i><i></i></span>`}if(pt)pt.textContent=txt}
 else if(tm)tm.hidden=true;
 if(C.pc&&C.t0&&(!C.qt||Date.now()-C.qt>2000)){C.qt=Date.now();C.pc.getStats().then(r=>{let rtt=0,loss=0,rec=0;r.forEach(x=>{if(x.type==="candidate-pair"&&x.state==="succeeded"&&x.currentRoundTripTime!=null)rtt=Math.max(rtt,x.currentRoundTripTime);if(x.type==="inbound-rtp"&&x.kind==="audio"){loss+=N(x.packetsLost);rec+=N(x.packetsReceived)}});
  const lr=rec?loss/(loss+rec):0;if(C)C.q=rtt>.45||lr>.08?1:rtt>.25||lr>.03?2:3}).catch(()=>{})}
}
function closeUi(msg){
 tone(null);levelStop();const d=g("tzc");if(!d)return;
 if(msg){status(msg);const tm=g("tzc-tm");if(tm)tm.hidden=true;g("tzc-bt").innerHTML="";g("tzc-bt").className="tzc-bar inc";d.className="on";g("tzcp").className="";setTimeout(()=>{if(!C){d.className="";g("tzcp").className=""}},msg.length>45?4500:2200)}
 else{d.className="";g("tzcp").className=""}
}
// ---------- إنهاء وتنظيف ----------
function cleanup(){
 if(!C)return;const c=C;C=null;
 clearInterval(c.iv);clearInterval(c.poll);clearTimeout(c.rt);clearTimeout(c.dropT);clearTimeout(c.ct);if(c.un)try{c.un()}catch(e){}
 if(c.stream)c.stream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});
 if(c.pc)try{c.pc.close()}catch(e){}
 const a=g("tzc-au");if(a)a.srcObject=null;tone(null);levelStop();
 try{const A=NAT();if(A&&A.callOff)A.callOff()}catch(e){}
}
async function hang(why){
 if(!C)return;const c=C,id=c.id,st=c.st;let msg="انتهت المكالمة",up=null;
 if(why==="rej"){up={st:"rej"};msg="تم الرفض"}
 else if(why==="miss"){up={st:"miss"};msg="لم يتم الرد"}
 else if(st==="ring"&&!c.inc)up={st:"end",en:Date.now(),by:X.party};
 else if(st==="acc")up={st:"end",en:Date.now(),by:X.party};
 if(why==="drop")msg="انقطع الاتصال";
 if(why==="fail")msg=failMsg();
 if(c.t0&&why==="end")msg="انتهت المكالمة · "+mmss(Date.now()-c.t0);
 if(why==="fail"||why==="drop")try{console.warn("📞 call",why,{turn:ICE.turn,ice:c.pc&&c.pc.iceConnectionState,conn:c.pc&&c.pc.connectionState})}catch(e){}
 cleanup();closeUi(msg);
 if(up&&id&&X){try{await updateDoc(doc(X.db,"call",id),up)}catch(e){}if(st==="ring"&&!c.inc)pushEnd(id)}
}
// ---------- مكالمة صادرة ----------
function onOut(id,d){
 if(!C||C.id!==id||!d)return;
 if(d.st==="acc"&&d.an&&!C.ans){C.ans=true;C.st="acc";clearTimeout(C.rt);clearInterval(C.poll);tone(null);status("جارٍ توصيل الصوت",true);paint();connectWatch();
  C.pc.setRemoteDescription({type:"answer",sdp:hiq(d.an.s)}).catch(()=>hang("fail"))}
 else if(d.st==="rej"){cleanup();closeUi("رفض المكالمة")}
 else if(d.st==="busy"){cleanup();closeUi("مشغول في مكالمة أخرى")}
 else if(d.st==="end"&&d.by!==X.party){const t0=C.t0;cleanup();closeUi(t0?"انتهت المكالمة · "+mmss(Date.now()-t0):"انتهت المكالمة")}
}
export async function startCall(to,name){
 if(!X)return;if(C){X.toast&&X.toast("أنت في مكالمة الآن");paint();return}
 if(!window.RTCPeerConnection||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){X.toast&&X.toast("هذا المتصفح لا يدعم المكالمات. استخدم Chrome أو Safari حديث","er");return}
 ac();const id=doc(collection(X.db,"call")).id;
 C={id,inc:false,to,name:String(name||"").slice(0,60),st:"init",mute:false};paint();status("جارٍ الاتصال",true);
 try{C.stream=await mic()}catch(e){cleanup();closeUi("اسمح للمنصة باستخدام الميكروفون ثم حاول مرة أخرى");return}
 if(!C||C.id!==id){return}
 try{
  const pc=await mkPc();if(!C||C.id!==id){pc.close();return}C.pc=pc;C.stream.getTracks().forEach(t=>pc.addTrack(t,C.stream));
  const of=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription({type:"offer",sdp:hiq(of.sdp)});await gathered(pc);
  if(!C||C.id!==id)return;
  await setDoc(doc(X.db,"call",id),{fr:X.party,to,frn:String(X.name()||"").slice(0,60),st:"ring",ts:Date.now(),of:{t:"offer",s:pc.localDescription.sdp}});
  if(!C||C.id!==id)return;
  C.st="ring";paint();status("يرن",true);tone("out");
  token().then(t=>fetch(PUSH_URL+"/call",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({id})})).catch(()=>{});
  C.rt=setTimeout(()=>{if(C&&C.id===id&&C.st==="ring")hang("miss")},RING_MS);
  C.iv=setInterval(tick,500);
  C.un=onSnapshot(doc(X.db,"call",id),s=>{if(s.exists())onOut(id,s.data())},()=>{});
  // أمان: لو السماع اللحظي اتأخر، بنسأل عن الرد كل ثانية ونص وهي بترن
  C.poll=setInterval(()=>{if(!C||C.id!==id||C.ans)return;getDoc(doc(X.db,"call",id)).then(s=>{if(s.exists())onOut(id,s.data())}).catch(()=>{})},1500);
 }catch(e){cleanup();closeUi(String(e&&e.code)==="permission-denied"?"لا يمكنك الاتصال بهذا الشخص":"تعذّر بدء المكالمة")}
}
// ---------- مكالمة واردة ----------
// أثناء الرنة بنجهّز الرد كله في الخلفية (الاتصال والعناوين والـ answer)، والميكروفون بيتضاف لحظة الضغط على "رد"
async function prep(c){
 try{const pc=await mkPc();if(C!==c){pc.close();return}c.pc=pc;
  await pc.setRemoteDescription({type:"offer",sdp:hiq(c.of.s)});
  const tr=pc.getTransceivers().find(t=>t.receiver&&t.receiver.track&&t.receiver.track.kind==="audio");if(tr)tr.direction="sendrecv";c.tr=tr;
  const an=await pc.createAnswer();await pc.setLocalDescription({type:"answer",sdp:hiq(an.sdp)});await gathered(pc);
  if(C===c)c.ready=pc.localDescription.sdp;
 }catch(e){c.prepErr=e}
}
let PEND_ACT=null;// {id, act:"acc"|"rej"} من إشعار المكالمة
function incoming(id,d){
 if(SEEN.has(id))return;SEEN.add(id);
 if(PEND_ACT&&PEND_ACT.id===id&&PEND_ACT.act==="rej"){PEND_ACT=null;updateDoc(doc(X.db,"call",id),{st:"rej"}).catch(()=>{});return}
 if(C){updateDoc(doc(X.db,"call",id),{st:"busy"}).catch(()=>{});return}
 const c={id,inc:true,to:d.fr,name:String(d.frn||(String(d.fr||"").slice(0,1)==="b"?"فرع "+String(d.fr).slice(2):"مكالمة")),st:"ring",of:d.of,mute:false};C=c;
 // 🛡 (17 نوفمبر 2026) الاسم اللي المتصل بعته (frn) ممكن يتزوّر، فالاسم الحقيقي من الدليل (الموظف من whdir، السائق من ddir)، وكود الفرع بيظهر دايماً
 {const fr=String(d.fr||""),k=fr.slice(0,1),idp=fr.slice(2);
  if(k==="b"&&idp&&c.name.indexOf(idp)<0)c.name=(c.name+" · "+idp).slice(0,70);
  else if((k==="w"||k==="d")&&idp)getDoc(doc(X.db,k==="w"?"whdir":"ddir",idp)).then(s=>{if(C!==c||!s.exists())return;const n=String((s.data()||{}).n||"").trim().slice(0,60);
   if(n&&n!==c.name){c.name=n;const el=g("tzc-n"),av=g("tzc-av"),pn=g("tzcp-n");if(el)el.textContent=n;if(av)av.textContent=initial(n);if(pn)pn.textContent=n}}).catch(()=>{})}
 paint();status("مكالمة واردة",true);tone("in");c.iv=setInterval(tick,500);c.prep=prep(c);
 c.rt=setTimeout(()=>{if(C===c&&c.st==="ring"){cleanup();closeUi("مكالمة فائتة")}},RING_MS+5000);
 c.un=onSnapshot(doc(X.db,"call",id),s=>{if(C!==c||!s.exists())return;const x=s.data();
  if(c.st==="ring"&&(x.st==="end"||x.st==="miss")){cleanup();closeUi("مكالمة فائتة من "+(x.frn||""))}
  else if(c.st==="ring"&&(x.st==="acc"||x.st==="rej")){cleanup();closeUi(x.st==="acc"?"تم الرد من جهاز آخر":"تم الرفض من جهاز آخر")}
  else if((c.st==="acc"||c.st==="conn")&&x.st==="end"&&x.by!==X.party){const t0=c.t0;cleanup();closeUi(t0?"انتهت المكالمة · "+mmss(Date.now()-t0):"انتهت المكالمة")}},()=>{});
 if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){try{new Notification("📞 "+c.name+" يتصل بك",{body:"اضغط للرد",tag:"call"+id})}catch(e){}}
 if(PEND_ACT&&PEND_ACT.id===id&&PEND_ACT.act==="acc"){PEND_ACT=null;setTimeout(()=>{if(C===c&&c.st==="ring")accept()},150)}
}
// 📱 تطبيق تاسومة: "رد" من شاشة الاتصال على القفل بينادي دي (لو الصفحة مفتوحة أصلاً)، ونفس المسار لرسالة الـ SW
const callAct=(id,act)=>{if(!X||!id)return;if(C&&C.id===id&&C.st==="ring"){if(act==="rej")hang("rej");else accept()}else if(!C)PEND_ACT={id,act}};
window.__tzCallAct=callAct;
const NAT=()=>window.TasoomaApp||null;
// نوقّف الرنة على أجهزة التطبيق عند الطرف التاني (اتلغت / اترد عليها / خلصت)
const pushEnd=id=>{if(!X||!id)return;token().then(t=>fetch(PUSH_URL+"/call",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({id,end:true})})).catch(()=>{})};
// رسالة من الـ SW (المنصة مفتوحة وضغط رد/رفض من الإشعار)
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",e=>{const m=e.data;if(m&&m.t==="tz-call")callAct(m.id,m.act)});
async function accept(){
 const c=C;if(!c||!c.inc||c.st!=="ring")return;tone(null);c.st="conn";paint();status("جارٍ توصيل الصوت",true);
 try{c.stream=await mic()}catch(e){hang("rej");closeUi("اسمح للمنصة باستخدام الميكروفون للرد");return}
 if(C!==c)return;
 try{
  await c.prep;if(C!==c)return;
  let sdp=c.ready;
  if(sdp&&c.tr){await c.tr.sender.replaceTrack(c.stream.getAudioTracks()[0])}
  else{// التجهيز المسبق فشل: الطريقة العادية
   if(c.pc)try{c.pc.close()}catch(e){}
   const pc=await mkPc();c.pc=pc;c.stream.getTracks().forEach(t=>pc.addTrack(t,c.stream));
   await pc.setRemoteDescription({type:"offer",sdp:hiq(c.of.s)});const an=await pc.createAnswer();await pc.setLocalDescription({type:"answer",sdp:hiq(an.sdp)});await gathered(pc);sdp=pc.localDescription.sdp}
  if(C!==c)return;
  await updateDoc(doc(X.db,"call",c.id),{st:"acc",an:{t:"answer",s:sdp},at:Date.now()});if(C!==c)return;c.st="acc";clearTimeout(c.rt);connectWatch();pushEnd(c.id);
  if(c.pc&&c.pc.connectionState==="connected"&&!c.t0){c.t0=Date.now();status("")}
 }catch(e){cleanup();closeUi("تعذّر الرد على المكالمة")}
}
// ---------- الضغطات ----------
document.addEventListener("click",e=>{if(C&&C.tap){C.tap=false;const au=g("tzc-au");if(au){const p=au.play();if(p&&p.catch)p.catch(()=>{})}ac();status("")}const t=e.target.closest&&e.target.closest("[data-tzc]");if(!t||!X)return;const a=t.dataset.tzc;
 if(a==="acc")accept();else if(a==="rej")hang("rej");else if(a==="end")hang("end");
 else if(a==="mute"&&C&&C.stream){C.mute=!C.mute;C.stream.getAudioTracks().forEach(x=>x.enabled=!C.mute);buttons()}
 else if(a==="min"){if(C){g("tzc").className="";g("tzcp-n").textContent=C.name;g("tzcp").className="on"+(C.mute?" muted":"")}else closeUi()}
 else if(a==="max")paint()});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.id==="tzcp")paint()});
addEventListener("tz-call-start",e=>{const d=e.detail||{};if(d.to)startCall(d.to,d.name)});
addEventListener("pagehide",e=>{if(C&&C.st==="acc"&&!e.persisted)hang("end")});

// ---------- البداية ----------
// ctx: {db, auth, party:"w-…"|"b-…"|"d-…", name:()=>اسمي, toast}
export function initCall(ctx){
 stopCall();if(!ctx||!ctx.db||!/^[bdw]-./.test(String(ctx.party||"")))return;
 X=ctx;window.__tzCall=!!(window.RTCPeerConnection&&navigator.mediaDevices);
 // مكالمات آخر 10 دقايق (بساعة الجهاز ده)، والفلترة الحقيقية بالحالة "بترن" + الرنة من لحظة الوصول، فاختلاف ساعة الموبايل مايضيّعش المكالمة
 UN=onSnapshot(query(collection(X.db,"call"),where("to","==",X.party),where("ts",">=",Date.now()-WIN)),sn=>{
  sn.docs.forEach(s=>{const d=s.data();if(d&&d.st==="ring"&&d.of&&Math.abs(Date.now()-N(d.ts))<WIN)incoming(s.id,d)})},()=>{});
 setTimeout(()=>{if(X)iceServers()},2500);// نجهّز خوادم الاتصال قبل أول مكالمة
 // 🛡 (17 نوفمبر 2026) الرد التلقائي من الرابط (act=acc) كان يخلّي أي حد يبعت رابط "…?call=رقم&act=acc" ثم يتصل، فالمكالمة تترد لوحدها والمايك يفتح.
 // دلوقتي: الرابط بيتقبل جوه تطبيق تاسومة بس ولما التطبيق نفسه هو اللي فتح الصفحة (من غير referrer؛ الضغط على رابط جوه الصفحة له referrer).
 // في المتصفح: "رد/رفض" من الإشعار بيوصل من الـ SW نفسه (call-pend) مش من الرابط.
 try{const u=new URL(location.href);const cid=u.searchParams.get("call"),act=u.searchParams.get("act");if(cid&&(act==="acc"||act==="rej")&&window.TasoomaApp&&!document.referrer)PEND_ACT={id:cid,act};
  if(u.searchParams.has("call")||u.searchParams.has("act")){u.searchParams.delete("call");u.searchParams.delete("act");history.replaceState(null,"",u.pathname+(u.search||"")+u.hash)}}catch(e){}
 try{const sw=navigator.serviceWorker;if(sw&&sw.controller)sw.controller.postMessage({t:"call-pend"})}catch(e){}
}
export const callState=()=>C?{id:C.id,st:C.st,inc:C.inc,conn:C.pc?C.pc.connectionState:"",t0:!!C.t0,ready:!!C.ready}:null;// للتشخيص والاختبار
export function stopCall(){if(C)hang("end");if(UN){try{UN()}catch(e){}UN=null}X=null;window.__tzCall=false}
