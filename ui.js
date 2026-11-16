// حركات الواجهة: ظهور الكروت الجديدة بنعومة، عدّاد للأرقام، اهتزاز كارت الدخول لو فيه خطأ، وخلفية شاشة الدخول.
// مابيغيّرش أي بيانات، بيتفرّج على الصفحة بس.
(()=>{
 const RM=matchMedia("(prefers-reduced-motion: reduce)");
 const SEL=".rq,.sc,.pan,.bar,.mr,.hr,.stop,.pick,.card,.tw tbody>tr";
 const seen=new Set();let lastTap=0;
 // بس أزرار التنقل (تبويبات، فلاتر) بتعيد حركة الكروت؛ زرار زي "تعيين" مابيحرّكش الصفحة كلها
 addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest(".tabs,.chip,[data-t],[data-s],#fday,#fmon"))lastTap=Date.now()},true);
 const vis=el=>el.getClientRects().length>0;
 const key=el=>el.className+"|"+el.textContent.replace(/\s+/g," ").slice(0,160);
 const ease="cubic-bezier(.2,.8,.2,1)";
 // عدّاد من صفر للرقم (للإحصائيات)
 const count=b=>{const t=b.textContent.trim();if(!/^\d{1,5}$/.test(t)||t==="0")return;const n=+t,t0=performance.now();
  const step=now=>{const p=Math.min(1,(now-t0)/700);b.textContent=String(Math.round(n*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)};
 // الكارت يظهر بحركة لو جديد، أو لو المستخدم لا يزال ضاغط حاجة (تبويب، فلتر...). التحديث اللحظي لنفس البيانات مابيتحرّكش.
 function enter(list){
  const tap=Date.now()-lastTap<900;let i=0;
  for(const el of list){
   const k=key(el),isNew=!seen.has(k);seen.add(k);
   if(RM.matches||!(tap||isNew)||!vis(el)||el.closest(".shot,.mdl,#md,#em"))continue;
   el.animate([{opacity:0,transform:"translateY(12px) scale(.985)"},{opacity:1,transform:"none"}],{duration:420,delay:Math.min(i++,12)*40,easing:ease,fill:"backwards"});
   if(el.matches(".sc"))el.querySelectorAll("b").forEach(count);
   if(el.matches(".bar"))el.querySelectorAll("i").forEach(b=>{b.style.transformOrigin="right";b.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:800,delay:120,easing:ease,fill:"backwards"})});
  }
  if(seen.size>4000)seen.clear();
 }
 const shake=e=>{if(RM.matches)return;const c=e.closest(".gc,.lg,.card,.mb,.eb")||e;
  c.animate([{transform:"translateX(0)"},{transform:"translateX(-9px)"},{transform:"translateX(8px)"},{transform:"translateX(-6px)"},{transform:"translateX(4px)"},{transform:"translateX(0)"}],{duration:420,easing:"ease-in-out"})};
 // خلفية شاشة الدخول: على #gate لو هو طبقة فوق الصفحة (صفحة الفرع)، وإلا على الصفحة كلها
 const stage=()=>{const els=[...document.querySelectorAll("#gate,.lg")].filter(vis);
  const ov=els.find(e=>getComputedStyle(e).position==="fixed"),body=document.body,on=els.length>0&&!ov;
  if(body.classList.contains("ui-stage")!==on)body.classList.toggle("ui-stage",on);
  const gate=document.getElementById("gate");
  if(gate&&gate.classList.contains("ui-stage")!==(ov===gate))gate.classList.toggle("ui-stage",ov===gate);
 };
 // الجوال: شريط التبويبات بيتسحب؛ بعد كل تحديث للصفحة نخلي التبويب المفتوح باين
 const keepTab=()=>{const on=document.querySelector(".tabs button.on"),t=on&&on.parentElement;if(!t||t.scrollWidth<=t.clientWidth)return;
  const a=on.getBoundingClientRect(),b=t.getBoundingClientRect();if(a.left<b.left+10||a.right>b.right-10)t.scrollLeft+=(a.left+a.width/2)-(b.left+b.width/2)};
 const mo=new MutationObserver(ms=>{
  const add=new Set();let err=null;
  for(const m of ms){
   const t=m.target.nodeType===1?m.target:m.target.parentElement,e=t&&t.closest&&t.closest(".er");
   if(e&&m.type!=="attributes"&&e.textContent.trim())err=e;
   for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(n.matches(SEL))add.add(n);n.querySelectorAll(SEL).forEach(x=>add.add(x))}
  }
  // لو كارت جوه كارت اتضاف، نحرّك الكبير بس
  const list=[...add].filter(el=>{const p=el.parentElement&&el.parentElement.closest(SEL);return !(p&&add.has(p))});
  if(list.length)enter(list);
  // كارت الترحيب بيتحرك أول مرة بس، مش مع كل تحديث للصفحة
  if(!helloShown&&!RM.matches){const h=document.querySelector(".hello");if(h&&vis(h)){helloShown=true;h.animate([{opacity:0,transform:"translateY(-10px) scale(.98)"},{opacity:1,transform:"none"}],{duration:600,easing:ease})}}
  if(err)shake(err);
  stage();keepTab();
 });
 // ---------- كارت الترحيب: "صباح الخير يا فلان" + الساعة والتاريخ (ميلادي وهجري) ----------
 const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const greet=()=>{const h=new Date().getHours();return h>=4&&h<12?["صباح الخير","☀️"]:h<17&&h>=12?["مساء الخير","🌤️"]:h>=17?["مساء الخير","🌙"]:["تعملون في وقت متأخر؟ بارك الله فيكم","🌙"]};
 const fmtT=()=>{const d=new Date();let t="",dt="",hj="";
  try{t=d.toLocaleTimeString("ar-EG-u-nu-latn",{hour:"numeric",minute:"2-digit"});dt=d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});hj=d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn",{day:"numeric",month:"long",year:"numeric"})}catch(e){t=d.toTimeString().slice(0,5)}
  return {t,dt,hj}};
 // sub: سطر تحت التحية، chips: [[أيقونة, نص], ...]
 window.uiHello=(name,sub,chips)=>{const [g,ic]=greet(),{t,dt,hj}=fmtT();
  return `<div class="hello"><div class="hl"><b><span data-greet>${g}</span> يا ${esc(name)} <span data-gic>${ic}</span></b>${sub?`<p>${sub}</p>`:""}${chips&&chips.length?`<div class="hchips">${chips.map(([i,x])=>`<span>${i} ${x}</span>`).join("")}</div>`:""}</div>
  <div class="hc"><b data-clock>${t}</b><small data-date>${dt}</small><small data-hijri>${hj}</small></div></div>`};
 setInterval(()=>{if(!document.querySelector(".hello"))return;const [g,ic]=greet(),{t,dt,hj}=fmtT();
  const set=(s,v)=>document.querySelectorAll(s).forEach(e=>{if(e.textContent!==v)e.textContent=v});
  set("[data-greet]",g);set("[data-gic]",ic);set("[data-clock]",t);set("[data-date]",dt);set("[data-hijri]",hj)},15000);
 let helloShown=false;
 // ---------- إنشاء حساب والتسجيل مقفول (Supabase من 12 نوفمبر 2026) ----------
 // Supabase بيرفض أي حساب جديد طول ما "Allow new users to sign up" مقفول. بدل رسالة إنجليزي، نافذة بالخطوات.
 window.uiSignupOff=what=>{let m=document.getElementById("uim");if(!m){m=document.createElement("div");m.id="uim";m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-uix]"))m.className=""});document.body.appendChild(m)}
  m.innerHTML=`<div class="uik"><div class="uii">🔐</div><h3>افتح التسجيل في Supabase دقيقة</h3><p>للأمان، Supabase يمنع إنشاء أي حساب جديد ما دام التسجيل مغلقاً. لإضافة ${esc(what||"الحساب")}:</p>
  <ol><li>اضغط الزر الموجود بالأسفل وسيفتح لك إعدادات Supabase</li><li>شغّل <b>Allow new users to sign up</b> واضغط <b>Save</b></li><li>ارجع إلى هنا واضغط الإضافة مجدداً</li><li>بعد الانتهاء: أوقفه واضغط <b>Save</b> مجدداً</li></ol>
  <div class="uib"><a class="bt p" href="https://supabase.com/dashboard/project/kycuhijnrzoqggonrsbx/auth/providers" target="_blank" rel="noopener noreferrer">فتح إعدادات Supabase</a><button class="bt" data-uix type="button">حسناً</button></div></div>`;
  m.className="on"};
 // أي خطأ تسجيل: لو السبب إن التسجيل مقفول نعرض الخطوات ونرجّع true
 window.uiAuthErr=(x,what)=>{if(x&&x.code==="auth/admin-restricted-operation"){window.uiSignupOff(what);return true}return false};
 // النت: لو فصل، علامة "مباشر" تقلب أحمر ويظهر تنبيه. Firebase بيكمّل لوحده أول ما النت يرجع
 const net=()=>document.documentElement.classList.toggle("ui-offline",!navigator.onLine);
 addEventListener("online",net);addEventListener("offline",net);net();
 mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","hidden"]});
 stage();enter([...document.querySelectorAll(SEL)]);
 // شاشة البداية + انتظار الدخول: محتوى الصفحة مخفي (aw) إلى ما الصفحة تقول "عرفنا مين داخل" بـ uiReady()
 // في التطبيق المثبّت بنستنى أيضاً رسمة اللوجو تكمل (حوالي 1.7 ثانية)
 const H=document.documentElement,boot=document.getElementById("boot");
 // (15 نوفمبر 2026) الديب بيرسم نفسه في ~1 ثانية: شاشة البداية بتستنى لحد ما يخلص (في التطبيق 1.7 ثانية زي ما كانت)،
 // والجهاز الخفيف (html.lite) من غير رسم فبتمشي أسرع.
 const LITE=H.classList.contains("lite"),MIN=H.classList.contains("app")?1700:LITE?350:1150,HOLD=LITE?250:1000;
 let ready=false,minDone=false;
 // المحتوى بيفضل مستخبي (aw) لحد ما الديب يخلص، وبعدين شاشة البداية بتختفي بالتدريج فوق الصفحة (#boot.out بيفضل ظاهر وهو بيختفي)
 const hide=()=>{if(!ready||!minDone)return;H.classList.remove("aw");if(!boot||!boot.isConnected||boot.classList.contains("out"))return;boot.classList.add("out");setTimeout(()=>boot.remove(),600)};
 setTimeout(()=>{minDone=true;hide()},Math.max(0,MIN-performance.now()));
 // 🐺 وهو بيرسم نفسه، الصفحة (اللي لسه مستخبية ورا شاشة البداية) مابتترسمش: الرسم التقيل بيستنى لحد ما الديب يخلص (ثانية واحدة)،
 // وكل طلبات الرسم في الوقت ده بتبقى رسمة واحدة. ده اللي بيخلّي حركة الديب ناعمة.
 let held=null;
 window.tzBootHold=fn=>{
  if(performance.now()>=HOLD||!boot||!boot.isConnected||boot.classList.contains("out")||!(H.classList.contains("aw")||H.classList.contains("app")))return false;
  if(!held){held=fn;setTimeout(()=>{const f=held;held=null;try{f()}catch(e){setTimeout(()=>{throw e})}},Math.max(0,HOLD-performance.now()))}
  else held=fn;
  return true;
 };
 window.uiReady=()=>{if(ready)return;ready=true;window.__uiOk=1;hide()};
 // (15 نوفمبر 2026) النت بطيء والدخول لسه بيتأكد: سطر صغير تحت الديب بدل ما الشاشة تبان واقفة (من غير ريفرش ولا شاشة دخول)
 setTimeout(()=>{if(ready||!boot||!boot.isConnected||document.getElementById("tz-slow"))return;const p=document.createElement("div");p.id="tz-slow";p.setAttribute("role","status");
  p.style.cssText="position:absolute;inset:auto 0 calc(12% + env(safe-area-inset-bottom,0px)) 0;text-align:center;color:rgba(255,255,255,.78);font:500 14px/1.6 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;padding:0 20px;opacity:0;transition:opacity .4s";
  p.textContent=navigator.onLine?"جاري الاتصال… الإنترنت بطيء قليلاً":"لا يوجد اتصال بالإنترنت… سنحاول تلقائياً";boot.appendChild(p);setTimeout(()=>{p.style.opacity="1"},30)},4500);
 if(!H.classList.contains("aw"))window.uiReady();// صفحات من غير تسجيل دخول
 // الموبايل: الشريط اللي فوق بيختفي وإنت نازل ويرجع أول ما تطلع لفوق (مساحة أكبر للمحتوى)
 let lastY=scrollY,tick=false;
 addEventListener("scroll",()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;const y=scrollY,d=y-lastY;if(Math.abs(d)<8&&y>10)return;
  const up=d>0&&y>180&&innerWidth<=760&&!!document.querySelector("#app>.hd>.hi");if(H.classList.contains("hd-up")!==up)H.classList.toggle("hd-up",up);lastY=y})},{passive:true});
})();

// ⏰ ساعة الجهاز (12 نوفمبر 2026): لو ساعة الكمبيوتر/الموبايل غلط، تسجيل الدخول في Supabase بيبان "شغال" عند الجهاز وهو منتهي
// عند السيرفر، فالبيانات كلها بتطلع فاضية من غير أي سبب واضح (حصل عند محمد: الساعة متأخرة 9 ساعات). بنقارن بوقت السيرفر ونقول بوضوح.
(function(){
 const chk=()=>fetch(location.pathname,{method:"HEAD",cache:"no-store"}).then(r=>{
  const sv=Date.parse(r.headers.get("date")||"");if(!sv)return;const sk=Date.now()-sv,ab=Math.abs(sk);
  let b=document.getElementById("tz-clock");if(ab<5*6e4){if(b)b.remove();return}
  const tm=Math.round(ab/6e4),h=Math.floor(tm/60),m=tm%60,amt=h?`${h} ساعة${m?" و"+m+" دقيقة":""}`:`${m} دقيقة`;
  if(!b){b=document.createElement("div");b.id="tz-clock";b.setAttribute("role","alert");b.style.cssText="position:fixed;inset:auto 12px 12px 12px;z-index:99998;background:#c4362b;color:#fff;border-radius:14px;padding:12px 16px;font:700 14.5px/1.7 'IBM Plex Sans Arabic',Tahoma,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);direction:rtl;text-align:right";document.body.appendChild(b)}
  b.innerHTML=`⏰ ساعة جهازك غير مضبوطة (${sk<0?"متأخرة":"متقدمة"} ${amt})، ولهذا قد لا تظهر البيانات.<br><span style="font-weight:400">من إعدادات الجهاز: شغّل "ضبط الوقت تلقائياً" واختر منطقة الرياض، ثم أعد فتح المنصة.</span>`;
 }).catch(()=>{});
 if(document.readyState==="loading")addEventListener("DOMContentLoaded",()=>setTimeout(chk,1500));else setTimeout(chk,1500);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)chk()});
})();
// 🛟 (13 نوفمبر 2026، "المنصة مش بتفتح عند بعض الناس")
// 1) بعض شبكات الجوال بتحجب supabase.co (حصل في الهند والإمارات). بنجرّب Supabase مباشرة، ولو مش واصل والنت شغّال
//    وسيرفرنا واصل: الجهاز بيتعلّم (tz_via=p) فـ fb.js بيكلّم Supabase من سيرفر Cloudflare، وبنعيد التحميل مرة واحدة.
//    ولو بعدين Supabase بقى واصل مباشرة، بنرجع للطريق العادي من الفتحة الجاية.
// 2) لو الصفحة ما عرفتش مين داخل خلال 12 ثانية (بعد 10 ثواني الصفحة بتعرض شاشة الدخول لوحدها، والدخول هيفضل يقول "بطيء"): بدل شاشة فاضية، رسالة واضحة + "إعادة المحاولة" و"تحديث كامل".
(function(){
 if(!/(admin|index|driver)\.html$|\/$/.test(location.pathname))return;
 const SB="https://kycuhijnrzoqggonrsbx.supabase.co/auth/v1/health?apikey=sb_publishable_CKCnA4MaSdGltJWsIrREaQ_guOg-CPa",PX="https://tasooma-push.tasooma.workers.dev/";
 const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},put=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
 const ss=(k,v)=>{try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}};
 const ping=(u,ms)=>new Promise(ok=>{const t=setTimeout(()=>ok(false),ms);fetch(u,{mode:"no-cors",cache:"no-store"}).then(()=>{clearTimeout(t);ok(true)},()=>{clearTimeout(t);ok(false)})});
 let firstErr="";
 addEventListener("error",e=>{if(!firstErr&&e&&e.message)firstErr=String(e.message).slice(0,160)});
 addEventListener("unhandledrejection",e=>{if(!firstErr&&e&&e.reason)firstErr=String(e.reason&&e.reason.message||e.reason).slice(0,160)});
 const via=get("tz_via")==="p";
 setTimeout(async()=>{
  if(!navigator.onLine)return;
  const direct=await ping(SB,via?8000:7000);
  if(direct){if(via)put("tz_via",null);return}
  if(via)return;
  const px=await ping(PX,8000);
  // الريفرش بس لو الصفحة لسه مافتحتش (شاشة البداية لسه موجودة)؛ لو فتحت، الطريق الاحتياطي بيشتغل من الفتحة الجاية من غير ما نقاطع حد
  if(px&&!ss("tz_via_r")){put("tz_via","p");ss("tz_via_r","1");if(!window.__uiOk)location.reload()}
 },via?10000:800);
 setTimeout(async()=>{
  if(window.__uiOk||document.getElementById("tz-stuck"))return;
  // 🛟 (15 نوفمبر 2026) شبكة أمان: المنصة بتفتح من النسخة المحفوظة على الجهاز (sw.js). لو النسخة دي باظت لأي سبب والصفحة ماعرفتش تفتح،
  // بنمسحها ونحمّل من جديد لوحدنا مرة واحدة (والنت شغّال). لو لسه واقفة بعدها، بتظهر الرسالة اللي تحت عادي.
  // ⚠️ (15 نوفمبر 2026، فيديو محمد: "الصفحة بيضا وبتعمل ريفرش لوحدها") ده بس لو كود الصفحة نفسه ما اشتغلش (__tzMod)،
  // مش لو الدخول/النت بطيء: المسح والريفرش وقتها كانوا بيعملوا شاشة بيضا طويلة ويبدأ الفتح من الأول.
  if(!window.__tzMod&&navigator.onLine&&navigator.serviceWorker&&navigator.serviceWorker.controller&&!ss("tz_autofix")&&(ss("tz_autofix","1"),ss("tz_autofix")==="1")){// (لو التخزين المؤقت مقفول مانعملش ده، علشان مايحصلش ريفرش ورا ريفرش)
   try{const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}catch(e){}
   try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch(e){}
   location.replace(location.pathname+"?r="+Date.now()+location.hash);return}
  const d=document.createElement("div");d.id="tz-stuck";d.setAttribute("role","alert");
  d.style.cssText="position:fixed;inset:auto 12px 18px 12px;margin:auto;max-width:460px;z-index:100000;visibility:visible!important;background:#fff;color:#2a1d2c;border-radius:18px;padding:16px 18px;box-shadow:0 18px 50px rgba(0,0,0,.45);font:400 14.5px/1.7 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;text-align:right";
  const off=!navigator.onLine;
  d.innerHTML=`<b style="font-size:16px">${off?"📡 لا يوجد اتصال بالإنترنت":"⏳ المنصة تأخرت في الفتح"}</b><div style="margin:6px 0 12px;color:#555">${off?"تأكد من الإنترنت ثم اضغط إعادة المحاولة.":"جرّب إعادة المحاولة. وإذا تكرر ذلك اضغط «تحديث كامل» (لن يُسجَّل خروجك)."}</div>`+
   `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-r style="flex:1;min-height:44px;border:0;border-radius:12px;background:#2a1d2c;color:#fff;font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer">إعادة المحاولة</button><button type="button" data-f style="flex:1;min-height:44px;border:1px solid #ccc;border-radius:12px;background:#fff;color:#2a1d2c;font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer">تحديث كامل</button></div>`+
   (firstErr?`<div data-notr style="margin-top:10px;font-size:11.5px;color:#888;direction:ltr;text-align:left;word-break:break-all">${firstErr.replace(/[<>&]/g,"")}</div>`:"");
  d.querySelector("[data-r]").onclick=()=>location.reload();
  d.querySelector("[data-f]").onclick=async()=>{put("tz_via",null);ss("tz_via_r","");
   try{const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}catch(e){}
   try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch(e){}
   location.replace(location.pathname+"?r="+Date.now()+location.hash)};
  document.body.appendChild(d);
  const w=setInterval(()=>{if(window.__uiOk){d.remove();clearInterval(w)}},500);
 },12000);
})();
// 🔄 (16 نوفمبر 2026، محمد: "أي تحديث يوصل لحظي من غير ريفرش ولا قفل المنصة وفتحها")
// المنصة بتفتح من النسخة اللي على الجهاز (sw.js). دلوقتي:
//  1) بنسأل "فيه نسخة جديدة؟" كل دقيقة والصفحة قدام المستخدم، وكل ما يرجع للصفحة أو النت يرجع (ملف sw.js صغير).
//  2) لما النسخة الجديدة تشتغل (controllerchange) بنطبّقها بريفرش واحد في أول لحظة آمنة: مفيش نافذة مفتوحة، ومفيش حد بيكتب في خانة،
//     ومفيش تسجيل صوت، والمستخدم ساكت 6 ثواني (أو الصفحة في الخلفية 3 ثواني). قبل الريفرش شاشة غامقة "جاري تطبيق التحديث" (مفيش وميض أبيض).
//  3) لو مش آمن: شريط صغير تحت "وصل تحديث جديد" فيه زرار "حدّث الآن"، ويتطبّق لوحده أول ما الوضع يبقى آمن.
//  4) حماية من الدوران: بحد أقصى 3 ريفرشات تلقائية في نص ساعة وبينهم دقيقة على الأقل (الباقي بالزرار بس).
//  5) بعد الريفرش بتظهر رسالة صغيرة "تم تحديث المنصة · النسخة N".
(function(){
 if(!("serviceWorker" in navigator))return;
 const ss=(k,v)=>{try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){return null}};
 let had=!!navigator.serviceWorker.controller,lastAct=Date.now(),pending=false,pendAt=0,applying=false,ver="";
 ["pointerdown","keydown","touchstart","wheel"].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},{capture:true,passive:true}));
 // رقم النسخة بيجي من sw.js نفسه
 navigator.serviceWorker.addEventListener("message",e=>{const d=e&&e.data;if(d&&d.t==="ver"){ver=String(d.v||"").replace(/^tasooma-v/,"");window.__tzVer=ver}});
 const askVer=()=>{try{if(navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({t:"ver"})}catch(e){}};
 askVer();
 // 1) السؤال عن نسخة جديدة
 const upd=()=>{if(navigator.onLine===false)return;navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{})};
 setTimeout(upd,1500);
 setInterval(()=>{if(!document.hidden)upd()},60000);
 addEventListener("online",upd);addEventListener("focus",upd);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)upd();tick()});
 // 2) هل ينفع نعمل ريفرش دلوقتي من غير ما نضيّع شغل؟
 const MOD="#mtm,#pom,#clm,#osh,#xm,#wkm,#zbx,#bciv,#anniv,#annm,#annp,#bcgi,#bcm,#pfm,#pfc,#wrm,#md,#em,#npm,#uim,.cm,.fm,.gfm,.mdl,.wkm,.ov";
 const overlayOpen=()=>{if(document.getElementById("tz-news"))return true;try{return [...document.querySelectorAll(MOD)].some(e=>e.classList.contains("on")&&!e.classList.contains("is-closing"))}catch(x){return false}};
 const typing=()=>{const a=document.activeElement;if(!a)return false;const t=a.tagName;
  if(a.isContentEditable)return String(a.textContent||"").length>0;
  if(t==="TEXTAREA")return String(a.value||"").length>0;
  if(t==="INPUT"){const ty=String(a.type||"text").toLowerCase();if(/^(checkbox|radio|button|submit|range|file)$/.test(ty))return false;return String(a.value||"").length>0}
  return false};
 const recording=()=>{const r=document.getElementById("bcrec");return !!(r&&!r.hidden)};
 const safe=()=>!overlayOpen()&&!typing()&&!recording()&&Date.now()-lastAct>(document.hidden?3000:6000);
 const hist=()=>{let a=[];try{a=JSON.parse(ss("tz_hot")||"[]")}catch(e){}return a.filter(t=>Date.now()-t<18e5)};
 const guard=()=>{const h=hist();return h.length>=3||(h.length>0&&Date.now()-h[h.length-1]<60000)};
 // 3) الشريط والتطبيق
 const css=()=>{if(document.getElementById("tz-upd-css"))return;const s=document.createElement("style");s.id="tz-upd-css";s.textContent="@keyframes tzu-in{from{opacity:0;transform:translateY(14px)}}@media (prefers-reduced-motion:reduce){#tz-upd{animation:none!important}}";document.head.appendChild(s)};
 const banner=()=>{if(document.getElementById("tz-upd")||!document.body)return;css();
  const b=document.createElement("div");b.id="tz-upd";b.setAttribute("role","status");
  b.style.cssText="position:fixed;z-index:99989;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));margin:0 auto;max-width:440px;display:flex;align-items:center;gap:10px;background:#2a1d2c;color:#fff;border-radius:16px;padding:8px 8px 8px 14px;box-shadow:0 14px 36px rgba(0,0,0,.4);font:600 13.5px/1.5 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;animation:tzu-in .35s cubic-bezier(.16,1,.3,1) both";
  b.innerHTML='<span style="flex:1">🔄 وصل تحديث جديد، وسيُطبَّق تلقائياً</span><button type="button" style="flex:none;border:0;border-radius:11px;background:#b48aab;color:#1d1720;font:700 14px/1 \'IBM Plex Sans Arabic\',Tahoma,sans-serif;padding:10px 14px;cursor:pointer">حدّث الآن</button>';
  b.querySelector("button").onclick=()=>apply(true);document.body.appendChild(b)};
 const apply=force=>{if(applying||!document.body)return;if(!force&&guard())return;applying=true;
  const h=hist();h.push(Date.now());ss("tz_hot",JSON.stringify(h));ss("tz_upd_ok",ver||"1");
  const o=document.createElement("div");o.id="tz-apply";o.setAttribute("role","status");
  o.style.cssText="position:fixed;inset:0;z-index:99999;background:#2a1d2c;color:#e3c8dd;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;font:600 16px/1.6 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;opacity:0;transition:opacity .25s ease";
  o.innerHTML='<img src="./icon-192.png" alt="" style="width:64px;height:64px;border-radius:16px;background:#fff"><span>جاري تطبيق التحديث…</span>';
  document.body.appendChild(o);setTimeout(()=>{o.style.opacity="1"},20);setTimeout(()=>location.reload(),480)};
 function tick(){if(!pending||applying)return;if(safe()&&!guard()){apply(false);return}if(Date.now()-pendAt>4000)banner()}
 setInterval(tick,1500);
 // 4) النسخة الجديدة اشتغلت
 navigator.serviceWorker.addEventListener("controllerchange",()=>{
  if(!had){had=true;return}// أول تثبيت للخدمة على الجهاز: مش تحديث
  askVer();pending=true;pendAt=Date.now();
  // الصفحة لسه ما ظهرتش (شاشة البداية مغطيّاها): ريفرش على طول، مفيش حاجة تتقطع
  if(document.getElementById("boot")&&!window.__uiOk&&Date.now()-lastAct>1500&&!guard()){const h=hist();h.push(Date.now());ss("tz_hot",JSON.stringify(h));ss("tz_upd_ok",ver||"1");location.reload();return}
  tick()});
 // 5) بعد الريفرش: رسالة تأكيد صغيرة لما الصفحة تظهر
 // (رقم النسخة بيتقرا من الصفحة الجديدة نفسها بعد الريفرش، مش من القديمة)
 if(ss("tz_upd_ok")!==null){ss("tz_upd_ok",null);let n=0;const iv=setInterval(()=>{n++;if(n>60){clearInterval(iv);return}
  if(!window.__uiOk||document.getElementById("boot")||document.getElementById("tz-news"))return;clearInterval(iv);const v=ver;
  const t=document.createElement("div");t.id="tz-updok";t.setAttribute("role","status");
  t.style.cssText="position:fixed;z-index:99988;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));margin:0 auto;width:max-content;max-width:calc(100% - 24px);background:#6f7d45;color:#fff;border-radius:999px;padding:9px 18px;box-shadow:0 10px 28px rgba(0,0,0,.3);font:600 14px/1.4 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;transition:opacity .4s ease";
  t.innerHTML='✅ تم تحديث المنصة'+(v&&v!=="1"?' · <span dir="ltr" data-notr>v'+String(v).replace(/[^0-9.]/g,"")+'</span>':"");
  if(document.body)document.body.appendChild(t);setTimeout(()=>{t.style.opacity="0"},3200);setTimeout(()=>{if(t.parentNode)t.remove()},3700)},500)}
})();
// ✨ رسالة "المنصة بثوبها الجديد" (14 نوفمبر 2026، طلب محمد): بتظهر مرة واحدة لكل مستخدم (المديرين والفروع والسواقين) بعد الدخول،
// وأول ما يقفلها مابتظهرش تاني على الجهاز ده (localStorage: tz_news). لرسالة جديدة بعدين: غيّر NEWS_ID والنص.
(function(){
 if(!/(admin|index|driver)\.html$|\/$/.test(location.pathname))return;
 const NEWS_ID="orders-sheet-2026-11-16";// (16 نوفمبر 2026) كارت "ورقة الطلب عند الفرع". لكارت جديد بعدين: غيّر NEWS_ID والنص
 try{localStorage.getItem("tz_news")}catch(e){return}// مفيش تخزين = مانعرضش (علشان ماتطلعش كل مرة)
 
 const vis=el=>!!(el&&el.offsetParent!==null);
 const loggedIn=()=>window.__uiOk&&!document.getElementById("boot")&&![...document.querySelectorAll('input[type="password"]')].some(vis)&&!document.getElementById("tz-stuck");
 const t0=Date.now(),iv=setInterval(()=>{if(Date.now()-t0>15*6e4){clearInterval(iv);return}if(loggedIn()){clearInterval(iv);setTimeout(()=>{if(loggedIn())show()},700)}},800);
 addEventListener("tz-news-check",()=>{setTimeout(()=>{if(loggedIn())show()},900)});// لو الحساب اترقّى وهو فاتح المنصة: admin.html بيبعت الحدث ده فنعيد المحاولة من غير ريفرش
 function show(){
  if(document.getElementById("tz-news"))return;
  // النص بيختلف حسب مين فاتح: فرع (index) / مدير أو موظف (admin) / سائق (driver)
  const P=location.pathname,co=window.__tzCo===true&&/admin\.html$/.test(P),role=co?"c":/driver\.html$/.test(P)?"d":/admin\.html$/.test(P)?"a":"b";
   // (16 نوفمبر 2026) كارت خاص بمالك النظام (حساب مدير عليه co) بس: مفتاح تخزين مستقل، وبيظهر له بدل الكارت العام
   const KEY=co?"tz_news_co":"tz_news",ID=co?"coowner-2026-11-16":NEWS_ID;let seen;try{seen=localStorage.getItem(KEY)}catch(e){return}if(seen===ID)return;
  const T={
   b:{k:"تحديث جديد · طلبات الفروع",t:"طلباتكم الآن على ورقة واحدة واضحة",go:"اعرض طلباتي",
    L:[["📄","كل طلب بطاقة، وبضغطة ورقة كاملة","اضغط على أي طلب لتراه مرتباً: الأصناف والمقاسات والكميات، وما عدّله المستودع واضحاً."],
       ["🧭","مراحل الطلب بالوقت","من الإرسال حتى الاستلام، مع وقت كل مرحلة واسم السائق."],
       ["🧾","إيصال الشحن بين يديك","إذا سُلِّم طلبك لشركة الشحن فاعرض الإيصال والصور والتوقيع من داخل الطلب نفسه."]]},
   a:{k:"تحديث جديد · طلبات الفروع",t:"الفروع ترى طلباتها الآن على ورقة واضحة",
    L:[["📄","بطاقة ثم ورقة كاملة","يضغط الفرع على طلبه فيرى المراحل بالوقت والأصناف وتعديلات المستودع عليها."],
       ["🧾","مرفقات الشحن عند الفرع","إيصال شركة الشحن وصور التسليم والتوقيع تظهر للفرع من داخل طلبه، وطلباته فقط."],
       ["📷","وضوح الصور مهم","ما يُرفع من صور تسليم يراه الفرع مباشرة، فتأكدوا من وضوحها."]]},
   c:{k:"ترقية حسابك",t:"أصبحت الآن مالك النظام",go:"افتح الإعدادات",
     L:[["👑","كل الصلاحيات بين يديك","الطلبات والعهدة والسيارات والموظفين والصيانة وأوامر الشراء والإعدادات، كلها متاحة لك الآن."],
        ["⚙️","الإعدادات في مكان واحد","تبويب ⚙ الإعدادات يجمع الصلاحيات والموظفين وحسابات الفروع والتقارير."],
        ["🔔","إشعارات المالك تصلك","تصلك إشعارات الطلبات والصيانة والحاويات المتجهة للمستودع كما تصل للأدمن."]]},
   d:{k:"تحديث جديد · صور التسليم",t:"الفرع يرى صور تسليمك الآن",
    L:[["📷","صورك تصل إلى الفرع","الصور وإيصال شركة الشحن اللذان تلتقطهما يظهران للفرع داخل طلبه، فاحرص على وضوحهما."],
       ["📄","ورقة الطلب","يرى الفرع اسمك ووقت خروجك وتسليمك مرتبة على ورقة الطلب."],
       ["🧭","مراحل بالوقت","كل مرحلة من الطلب تظهر بوقتها الفعلي."]]}
  }[role];
  if(!document.getElementById("tz-news-css")){const s=document.createElement("style");s.id="tz-news-css";s.textContent=`
#tz-news{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(30,18,32,.58);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:tzn-f .25s ease both}
#tz-news .k{position:relative;width:100%;max-width:450px;max-height:calc(100vh - 28px);overflow:auto;background:var(--card,#fffaf3);color:var(--ink,#2a1d2c);border-radius:28px;box-shadow:0 0 0 1px rgba(180,138,171,.25),0 40px 90px rgba(30,15,35,.55);text-align:start;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;animation:tzn-u .5s cubic-bezier(.16,1,.3,1) both;-webkit-overflow-scrolling:touch}
#tz-news .tn-hero{position:relative;height:208px;overflow:hidden;border-radius:28px 28px 0 0;background:radial-gradient(120% 95% at 82% 6%,#58395f 0%,#2a1d2c 58%,#1c1320 100%)}
#tz-news .tn-hero::before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;left:-70px;top:-100px;background:radial-gradient(closest-side,rgba(180,138,171,.42),transparent 70%)}
#tz-news .tn-hero::after{content:"";position:absolute;inset-inline:0;bottom:0;height:4px;background:linear-gradient(90deg,#6f7d45,#b48aab 45%,#b48aab 55%,#6f7d45)}
#tz-news .tn-hero .tn-dot{position:absolute;border-radius:50%;background:rgba(111,125,69,.35)}
#tz-news .tn-hero .tn-d1{width:120px;height:120px;right:-34px;bottom:-52px}#tz-news .tn-hero .tn-d2{width:46px;height:46px;left:22px;bottom:30px;background:rgba(180,138,171,.28)}
#tz-news .tn-lgo{position:absolute;top:16px;inset-inline-start:18px;display:flex;align-items:center;gap:8px;color:#e3c8dd;font-size:12.5px;font-weight:600;z-index:2}
#tz-news .tn-lgo img{width:28px;height:28px;border-radius:8px;background:#fff}
#tz-news .tn-nw{position:absolute;top:18px;inset-inline-end:60px;z-index:2;background:#6f7d45;color:#fff;border-radius:999px;padding:3px 11px;font-size:11.5px;font-weight:700;letter-spacing:.2px;box-shadow:0 4px 12px rgba(0,0,0,.25)}
#tz-news .tn-xb{position:absolute;top:12px;inset-inline-end:12px;z-index:3;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:16px;cursor:pointer;line-height:1}
#tz-news .tn-ps{position:absolute;left:50%;top:44px;width:196px;margin-left:-98px;background:#fffdf8;color:#231a25;border-radius:12px;padding:11px 13px 12px;box-shadow:0 22px 44px rgba(0,0,0,.5);transform:rotate(-4deg);animation:tzn-fl 5.5s ease-in-out infinite}
#tz-news .tn-ps.tn-bk{top:56px;transform:rotate(6deg);opacity:.5;animation:none;background:#efe6ee;height:150px}
#tz-news .tn-ps .tn-t{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;font-weight:700}
#tz-news .tn-ps .tn-t span{background:#e5ecd0;color:#45512a;border-radius:99px;padding:2px 8px;font-size:9.5px;white-space:nowrap}
#tz-news .tn-ps .tn-tl{display:flex;gap:3px;margin:10px 0 9px}#tz-news .tn-ps .tn-tl i{flex:1;height:4px;border-radius:9px;background:#e7dfe6}#tz-news .tn-ps .tn-tl i.tn-on{background:#6f7d45}
#tz-news .tn-ps .tn-r{display:flex;gap:6px;margin:6px 0}#tz-news .tn-ps .tn-r u{display:block;height:7px;border-radius:9px;background:#efe6ee}
#tz-news .tn-ps .tn-r u:nth-child(1){width:30%;background:#e3d6e1}#tz-news .tn-ps .tn-r u:nth-child(2){width:42%}#tz-news .tn-ps .tn-r u:nth-child(3){width:16%;margin-inline-start:auto;background:#e3d6e1}
#tz-news .tn-ps .tn-at{display:flex;gap:6px;margin-top:10px}#tz-news .tn-ps .tn-at b{font-size:9.5px;border-radius:8px;padding:5px 8px;background:#f2e5ee;color:#5f3a59;font-weight:700}
#tz-news .tn-hd{padding:20px 24px 0}
#tz-news .tn-hd small{display:block;color:#8a5a83;font-size:12.5px;font-weight:700;letter-spacing:.3px;margin-bottom:6px}
#tz-news .tn-hd b{display:block;font-size:23px;line-height:1.4;font-weight:700}
#tz-news .b{padding:16px 22px 4px;font-size:15px;line-height:1.75}
#tz-news ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
#tz-news li{display:flex;gap:12px;align-items:flex-start;background:var(--soft,#f6eee3);border-radius:16px;padding:12px 14px}
#tz-news li i{font-style:normal;font-size:20px;line-height:1.3;flex:none}
#tz-news li b{display:block;font-size:14.5px}#tz-news li span{display:block;font-size:13px;color:var(--mut,#74687a);line-height:1.6}
#tz-news .tn-lv{display:flex;align-items:center;gap:8px;margin-top:12px;background:color-mix(in srgb,#6f7d45 13%,transparent);border-radius:12px;padding:9px 12px;font-size:13px;color:var(--ink,#2a1d2c)}
#tz-news .f{padding:16px 22px 20px;display:grid;gap:8px}
#tz-news .f button{width:100%;min-height:50px;border:0;border-radius:15px;background:#8a5a83;color:#fff;font:700 16px/1 'IBM Plex Sans Arabic',Tahoma,sans-serif;cursor:pointer;box-shadow:0 10px 24px rgba(138,90,131,.38)}
#tz-news .f button.g{background:transparent;color:var(--mut,#74687a);box-shadow:none;min-height:40px;font-size:14.5px;font-weight:600}
#tz-news .f button:active{transform:scale(.97)}
#tz-news .f small{display:block;text-align:center;color:var(--mut,#74687a);font-size:12.5px;margin-top:2px}
@media (max-width:420px){#tz-news .tn-hero{height:150px}#tz-news .tn-ps{top:22px;width:178px;margin-left:-89px}#tz-news .tn-ps.tn-bk{top:32px;height:112px}#tz-news .tn-lgo{top:12px}#tz-news .tn-nw{top:14px}#tz-news .tn-xb{top:8px}#tz-news .tn-hd{padding:14px 20px 0}#tz-news .tn-hd b{font-size:20px}#tz-news .b{padding:12px 16px 2px}#tz-news li{padding:9px 12px;gap:10px}#tz-news li span{font-size:12.5px;line-height:1.5}#tz-news .tn-lv{margin-top:9px;padding:8px 11px}#tz-news .f{padding:12px 16px 16px}#tz-news .f small{display:none}}
@media (max-height:800px){#tz-news .tn-hero{height:172px}#tz-news .tn-ps{top:30px}#tz-news .tn-ps.tn-bk{top:42px;height:128px}#tz-news .tn-hd{padding-top:14px}#tz-news .b{padding-top:12px}#tz-news li{padding:10px 13px}#tz-news .f{padding-top:12px}}
@media (prefers-color-scheme:dark){#tz-news .f button{background:#b48aab;color:#1d1720}#tz-news .tn-hd small{color:#cfb1c8}}
@keyframes tzn-f{from{opacity:0}}@keyframes tzn-u{from{opacity:0;transform:translateY(22px) scale(.95)}}
@keyframes tzn-fl{50%{transform:translateY(-6px) rotate(-4deg)}}
@media (prefers-reduced-motion:reduce){#tz-news,#tz-news .k,#tz-news .tn-ps{animation:none}}`;document.head.appendChild(s)}
  const d=document.createElement("div");d.id="tz-news";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-labelledby","tz-news-t");
  d.innerHTML=`<div class="k"><div class="tn-hero"><span class="tn-dot tn-d1"></span><span class="tn-dot tn-d2"></span>
<div class="tn-lgo"><img src="./icon-192.png" alt=""><span>تاسومة</span></div><span class="tn-nw">جديد</span><button class="tn-xb" type="button" data-n="x" aria-label="إغلاق">✕</button>
<div class="tn-ps tn-bk"></div>${role==="c"?`<div class="tn-ps"><div class="tn-t"><b>مالك النظام</b><span>مفعّل</span></div><div style="font-size:46px;text-align:center;margin:8px 0 6px">👑</div><div class="tn-at"><b>📦 الطلبات</b><b>👥 الموظفين</b><b>⚙ الإعدادات</b></div></div>`:`<div class="tn-ps"><div class="tn-t"><b>003-EL MALQA</b><span>تم التسليم</span></div><div class="tn-tl"><i class="tn-on"></i><i class="tn-on"></i><i class="tn-on"></i><i class="tn-on"></i><i class="tn-on"></i><i></i></div>
<div class="tn-r"><u></u><u></u><u></u></div><div class="tn-r"><u></u><u></u><u></u></div><div class="tn-at"><b>🧾 الإيصال</b><b>📷 الصور</b></div></div>`}</div>
<div class="tn-hd"><small>${T.k}</small><b id="tz-news-t">${T.t}</b></div>
<div class="b"><ul>${T.L.map(x=>`<li><i>${x[0]}</i><div><b>${x[1]}</b><span>${x[2]}</span></div></li>`).join("")}</ul>
<div class="tn-lv">⚡ <span style="display:inline;font-size:13px;color:inherit">الطلبات والتغييرات الجديدة تصل لحظياً دون إعادة تحميل الصفحة.</span></div></div>
<div class="f">${T.go?`<button type="button" data-n="go">${T.go}</button><button type="button" class="g" data-n="x">لاحقاً</button>`:`<button type="button" data-n="x">ابدأ الاستخدام</button>`}<small>شكراً لكم، فريق تاسومة 🤍</small></div></div>`;
  const close=()=>{try{localStorage.setItem(KEY,ID)}catch(e){}d.remove();document.removeEventListener("keydown",esc)};
  const esc=e=>{if(e.key==="Escape")close()};
  d.addEventListener("click",e=>{if(e.target===d){close();return}const b=e.target.closest&&e.target.closest("[data-n]");if(!b)return;close();
   // "اعرض طلباتي": الصفحة (index.html) بتسمع وبتفتح آخر طلب
   if(b.dataset.n==="go"){try{window.dispatchEvent(new CustomEvent("tz-news-go"))}catch(x){}}});
  document.addEventListener("keydown",esc);
  document.body.appendChild(d);setTimeout(()=>{const b=d.querySelector(".f button");if(b)b.focus({preventScroll:true})},300);
  // (15 نوفمبر 2026، محمد: "بيظهر كل مرة رغم إنه شافه") بتتسجّل "اتشافت" بعد ما تبان ثانيتين، مش بس لما يقفلها
  setTimeout(()=>{if(d.isConnected){try{localStorage.setItem(KEY,ID)}catch(e){}}},2000);
 }
})();
// 🎬 (13 نوفمبر 2026، transitions.dev) قفل النوافذ بنعومة: أي نافذة بتتقفل (بيتشال منها "on")، بنسيبها ظاهرة 150ms
// بكلاس is-closing (الخلفية بتختفي بالتدريج واللوحة بتصغر)، وبعدين بتختفي. الملفات التانية مش محتاجة تتغيّر.
// لو اتفتحت تاني في النص، بنلغي القفل على طول. الضغطات بتعدّي من تحتها وهي بتقفل (pointer-events:none في ui.css).
(()=>{
 const SEL="#mtm,.cm,.xm,.fm,.gfm,#annm,#annp,#bcgi,#pfm,#pfc,#wrm,#md,#em,.mdl,.wkm,#npm,#uim,#bcm,#anniv,#bciv,#zbx,.ov";
 if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const ms=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur"))||150;
 const T=new WeakMap();
 const mo=new MutationObserver(L=>{for(const m of L){const el=m.target;if(!(el instanceof Element)||!el.matches(SEL))continue;
  const was=/(^|\s)on(\s|$)/.test(m.oldValue||""),now=el.classList.contains("on");
  if(now){if(el.classList.contains("is-closing")){clearTimeout(T.get(el));el.classList.remove("is-closing")}continue}
  if(was&&!now&&el.isConnected&&!el.classList.contains("is-closing")){el.classList.add("is-closing");T.set(el,setTimeout(()=>el.classList.remove("is-closing"),ms()))}
 }});
 const go=()=>mo.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"],attributeOldValue:true});
 if(document.body)go();else document.addEventListener("DOMContentLoaded",go);
})();
