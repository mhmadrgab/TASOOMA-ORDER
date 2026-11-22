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
 // ⚡ (18 نوفمبر 2026) الصفحة اتفتحت للرد على مكالمة (?call=): من غير انتظار رسمة الديب، علشان الرد مايتأخرش
 const FASTC=/[?&]call=/.test(location.search);
 const LITE=H.classList.contains("lite"),MIN=FASTC?0:H.classList.contains("app")?1700:LITE?350:1150,HOLD=FASTC?0:LITE?250:1000;
 let ready=false,minDone=false;
 // 📡 (21 نوفمبر 2026، محمد: «والنت فاصل عايزها تقف على اللوجو بتاعها فقط ومتدخلش») بوابة الاتصال:
 // مع بداية الصفحة نسأل Supabase (وسيرفرنا لو Supabase محجوب) بطلب صغير. لو مفيش وصول، شاشة البداية تفضل باللوجو وتحته
 // «لا يوجد اتصال بالإنترنت»، ومحتوى الصفحة لا يظهر أبداً. نعيد السؤال كل 5 ثوانٍ ومع حدث online، وأول ما يرجع: إعادة تحميل نظيفة.
 // الشبكة العادية: الرد ~300ms وشاشة البداية أطول منه (1.15 ثانية) فلا تأخير. صفحة الرد على مكالمة (?call=) مستثناة.
 const GATE=!!boot&&!FASTC&&/(admin|index|driver)\.html$|\/$/.test(location.pathname);
 const NSB="https://kycuhijnrzoqggonrsbx.supabase.co/auth/v1/health",NPX="https://tasooma-push.tasooma.workers.dev/";
 const probe1=(u,ms)=>new Promise(ok=>{let d=false;const c=window.AbortController?new AbortController():null;
  const t=setTimeout(()=>{if(d)return;d=true;try{if(c)c.abort()}catch(e){}ok(false)},ms);
  try{fetch(u,{method:"HEAD",mode:"no-cors",cache:"no-store",signal:c?c.signal:undefined}).then(()=>{if(!d){d=true;clearTimeout(t);ok(true)}},()=>{if(!d){d=true;clearTimeout(t);ok(false)}})}catch(e){if(!d){d=true;clearTimeout(t);ok(false)}}});
 const probe=()=>navigator.onLine===false?Promise.resolve(false):probe1(NSB,3000).then(r=>r||probe1(NPX,2500));
 let netOk=GATE?null:true,gated=false;
 const gate=()=>{
  if(gated||!boot||!boot.isConnected)return;gated=true;window.__tzOff=1;
  const old=document.getElementById("tz-slow");if(old)old.remove();
  if(!document.getElementById("tz-off-css")){const s=document.createElement("style");s.id="tz-off-css";s.textContent=
   "#tz-off{position:absolute;inset:auto 0 calc(11% + env(safe-area-inset-bottom,0px)) 0;margin:auto;width:max-content;max-width:calc(100% - 40px);display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 22px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#f3edf1;font:500 14px/1.6 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;text-align:center;opacity:0;transform:translateY(6px);transition:opacity .5s ease,transform .5s ease}"+
   "#tz-off,#tz-off *{letter-spacing:0!important;text-transform:none}#tz-off .tzo-d{display:inline-block;flex:none}"+
   "#tz-off.on{opacity:1;transform:none}#tz-off b{display:flex;align-items:center;gap:9px;font-weight:600;font-size:14.5px}#tz-off small{color:rgba(243,237,241,.62);font-size:12.5px}"+
   "#tz-off .tzo-d{width:8px;height:8px;border-radius:50%;background:#e0a84f;box-shadow:0 0 0 0 rgba(224,168,79,.55);animation:tzoff 1.8s ease-out infinite}#tz-off.ok .tzo-d{background:#a4b46e;animation:none}"+
   "@keyframes tzoff{0%{box-shadow:0 0 0 0 rgba(224,168,79,.55)}70%{box-shadow:0 0 0 9px rgba(224,168,79,0)}100%{box-shadow:0 0 0 0 rgba(224,168,79,0)}}"+
   "html.lite #tz-off .tzo-d{animation:none}@media (prefers-reduced-motion:reduce){#tz-off{transition:none}#tz-off .tzo-d{animation:none}}";
   document.head.appendChild(s)}
  const p=document.createElement("div");p.id="tz-off";p.setAttribute("role","status");p.setAttribute("aria-live","polite");
  p.innerHTML='<b><span class="tzo-d"></span><span class="tzo-t">لا يوجد اتصال بالإنترنت</span></b><small>ستفتح المنصة تلقائياً فور عودة الاتصال</small>';
  boot.appendChild(p);setTimeout(()=>p.classList.add("on"),30);
  let busy=false,t=null;
  const back=()=>{if(busy)return;busy=true;clearTimeout(t);probe().then(r=>{busy=false;
   if(r){p.classList.add("ok");p.querySelector(".tzo-t").textContent="عاد الاتصال، جاري الفتح…";const sm=p.querySelector("small");if(sm)sm.remove();setTimeout(()=>location.reload(),400)}
   else t=setTimeout(back,5000)})};
  t=setTimeout(back,5000);addEventListener("online",back);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)back()});
 };
 if(GATE)probe().then(r=>{netOk=r;if(r)hide();else gate()});
 // المحتوى بيفضل مستخبي (aw) لحد ما الديب يخلص، وبعدين شاشة البداية بتختفي بالتدريج فوق الصفحة (#boot.out بيفضل ظاهر وهو بيختفي)
 const hide=()=>{if(!ready||!minDone||netOk!==true)return;H.classList.remove("aw");if(!boot||!boot.isConnected||boot.classList.contains("out"))return;boot.classList.add("out");setTimeout(()=>boot.remove(),600)};
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
 setTimeout(()=>{if(ready||gated||!boot||!boot.isConnected||document.getElementById("tz-slow"))return;const p=document.createElement("div");p.id="tz-slow";p.setAttribute("role","status");
  p.style.cssText="position:absolute;inset:auto 0 calc(12% + env(safe-area-inset-bottom,0px)) 0;text-align:center;color:rgba(255,255,255,.78);font:500 14px/1.6 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;padding:0 20px;opacity:0;transition:opacity .4s";
  p.textContent=navigator.onLine?"جاري الاتصال… الإنترنت بطيء قليلاً":"لا يوجد اتصال بالإنترنت… سنحاول تلقائياً";boot.appendChild(p);setTimeout(()=>{p.style.opacity="1"},30)},4500);
 if(!H.classList.contains("aw"))window.uiReady();// صفحات من غير تسجيل دخول
})();

// 🌙 (v172، 18 نوفمبر 2026، طلب محمد: «الوضع الليلي») المظهر: تلقائي (حسب الجهاز) / نهاري / ليلي.
// الاختيار في localStorage.tz_theme (لا شيء = تلقائي). سكريبت صغير في أول كل صفحة يضع html[data-theme=dark|light] قبل الرسم (بلا وميض)،
// وكل ألوان الوضع الليلي في المنصة مكتوبة على [data-theme=dark]. هنا: التبديل، متابعة تغيّر وضع الجهاز، والنوافذ/الإطارات الأخرى (storage).
// الاستخدام: tzTheme.seg() يرجّع مفتاح الاختيار (HTML)، وأي زر عليه data-thset="auto|light|dark" يعمل وحده. الحدث: window «tz-theme».
(function(){
 var H=document.documentElement,KEY="tz_theme",mq=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null,RM=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null;
 var pref=function(){var t=null;try{t=localStorage.getItem(KEY)}catch(e){}return t==="dark"||t==="light"?t:"auto"};
 var want=function(p){return p==="dark"||(p==="auto"&&!!mq&&mq.matches)?"dark":"light"};
 var paint=function(){var p=pref(),bs=document.querySelectorAll("[data-thset]");for(var i=0;i<bs.length;i++){var on=bs[i].getAttribute("data-thset")===p;if(bs[i].getAttribute("aria-checked")!==String(on))bs[i].setAttribute("aria-checked",String(on));bs[i].tabIndex=on?0:-1}};
 var apply=function(){var p=pref(),v=want(p),ch=H.getAttribute("data-theme")!==v;if(ch)H.setAttribute("data-theme",v);if(H.getAttribute("data-thp")!==p)H.setAttribute("data-thp",p);paint();
  if(ch){try{window.dispatchEvent(new CustomEvent("tz-theme",{detail:{theme:v,pref:p}}))}catch(e){}}};
 var IC={auto:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/></svg>',
  light:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>',
  dark:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.3 8.3 0 0 1 9.8 4a8.3 8.3 0 1 0 10.2 10.2z"/></svg>'};
 var LB={auto:"تلقائي",light:"نهاري",dark:"ليلي"},TP={auto:"حسب إعداد الجهاز",light:"الوضع النهاري",dark:"الوضع الليلي"},ORD=["auto","light","dark"];
 var set=function(p,el){p=p==="dark"||p==="light"?p:"auto";
  var go=function(){try{if(p==="auto")localStorage.removeItem(KEY);else localStorage.setItem(KEY,p)}catch(e){}apply()};
  // الوضع الجديد ينتشر كدائرة من مكان الزر (المتصفحات الحديثة فقط، ومتوقف في الوضع الخفيف ومع «تقليل الحركة»)
  if(want(p)!==H.getAttribute("data-theme")&&document.startViewTransition&&!H.classList.contains("lite")&&!(RM&&RM.matches)&&!document.hidden){
   var r=el&&el.getBoundingClientRect?el.getBoundingClientRect():null,x=r?r.left+r.width/2:innerWidth/2,y=r?r.top+r.height/2:innerHeight/2;
   try{H.style.setProperty("--thx",Math.round(x)+"px");H.style.setProperty("--thy",Math.round(y)+"px");H.style.setProperty("--thr",Math.ceil(Math.sqrt(Math.pow(Math.max(x,innerWidth-x),2)+Math.pow(Math.max(y,innerHeight-y),2)))+"px");H.classList.add("tz-thv");
    var done=function(){H.classList.remove("tz-thv")},vt=document.startViewTransition(go);if(vt&&vt.finished&&vt.finished.then)vt.finished.then(done,done);else setTimeout(done,700);return}catch(e){H.classList.remove("tz-thv")}}
  go()};
 window.tzTheme={get:pref,eff:function(){return H.getAttribute("data-theme")==="dark"?"dark":"light"},set:set,
  seg:function(cls){var p=pref();return '<div class="tzth'+(cls?" "+cls:"")+'" role="radiogroup" aria-label="المظهر">'+ORD.map(function(k){return '<button type="button" role="radio" data-noico data-thset="'+k+'" aria-checked="'+(p===k)+'" tabindex="'+(p===k?0:-1)+'" title="'+TP[k]+'">'+IC[k]+'<span>'+LB[k]+'</span></button>'}).join("")+'</div>'}};
 document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("[data-thset]");if(!b)return;var k=b.getAttribute("data-thset");
  // المفتاح المضغوط (القائمة المطوية): الزر الظاهر وحده يدور على الاختيارات
  if(b.getAttribute("aria-checked")==="true"&&b.parentElement&&getComputedStyle(b.parentElement).getPropertyValue("--th-cyc").trim()==="1")k=ORD[(ORD.indexOf(k)+1)%3];
  set(k,b)});
 document.addEventListener("keydown",function(e){var b=e.target&&e.target.closest&&e.target.closest("[data-thset]");if(!b||(e.key!=="ArrowLeft"&&e.key!=="ArrowRight"&&e.key!=="ArrowUp"&&e.key!=="ArrowDown"))return;
  e.preventDefault();var rtl=getComputedStyle(H).direction==="rtl",fw=e.key==="ArrowDown"||(e.key==="ArrowLeft"&&rtl)||(e.key==="ArrowRight"&&!rtl),k=ORD[(ORD.indexOf(b.getAttribute("data-thset"))+(fw?1:2))%3];set(k,b);
  var n=b.parentElement&&b.parentElement.querySelector('[data-thset="'+k+'"]');if(n&&n.getClientRects().length)n.focus()});
 if(mq){if(mq.addEventListener)mq.addEventListener("change",apply);else if(mq.addListener)mq.addListener(apply)}
 addEventListener("storage",function(e){if(!e||!e.key||e.key===KEY)apply()});
 apply();
})();

// ⏰ ساعة الجهاز (12 نوفمبر 2026): لو ساعة الكمبيوتر/الموبايل غلط، تسجيل الدخول في Supabase بيبان "شغال" عند الجهاز وهو منتهي
// عند السيرفر، فالبيانات كلها بتطلع فاضية من غير أي سبب واضح (حصل عند محمد: الساعة متأخرة 9 ساعات). بنقارن بوقت السيرفر ونقول بوضوح.
(function(){
 try{if(window.top!==window.self)return}catch(e){return}// داخل إطار (الورقة اليدوية): اللوحة نفسها تفحص الساعة، والإطار ممنوع من الاتصال أصلاً (كان يكتب خطأ CSP في الكونسول)
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
  if(window.__uiOk||window.__tzOff||document.getElementById("tz-stuck"))return;
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
  // 📡 (21 نوفمبر 2026) «تحديث كامل» يمسح نسخة المنصة المحفوظة على الجهاز، فمن غير نت كانت تبقى شاشة بيضاء حتى يرجع النت.
  // نتأكد أولاً أن الموقع نفسه واصل (طلب HEAD لا يمر من النسخة المحفوظة)، وإلا لا نمسح شيئاً.
  const reach=async()=>{try{const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);const r=await fetch("./sw.js?x="+Date.now(),{method:"HEAD",cache:"no-store",signal:c.signal});clearTimeout(t);return !!(r&&r.ok)}catch(e){return false}};
  const off=!navigator.onLine||!(await reach());
  d.innerHTML=`<b style="font-size:16px">${off?"📡 لا يوجد اتصال بالإنترنت":"⏳ المنصة تأخرت في الفتح"}</b><div data-m style="margin:6px 0 12px;color:#555">${off?"تأكد من الإنترنت ثم اضغط إعادة المحاولة.":"جرّب إعادة المحاولة. وإذا تكرر ذلك اضغط «تحديث كامل» (لن يُسجَّل خروجك)."}</div>`+
   `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-r style="flex:1;min-height:44px;border:0;border-radius:12px;background:#2a1d2c;color:#fff;font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer">إعادة المحاولة</button>${off?"":`<button type="button" data-f style="flex:1;min-height:44px;border:1px solid #ccc;border-radius:12px;background:#fff;color:#2a1d2c;font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer">تحديث كامل</button>`}</div>`+
   (firstErr&&!off?`<div data-notr style="margin-top:10px;font-size:11.5px;color:#888;direction:ltr;text-align:left;word-break:break-all">${firstErr.replace(/[<>&]/g,"")}</div>`:"");
  d.querySelector("[data-r]").onclick=()=>location.reload();
  if(off)addEventListener("online",()=>{if(!window.__uiOk)location.reload()},{once:true});
  const fb=d.querySelector("[data-f]");
  if(fb)fb.onclick=async()=>{
   if(!(await reach())){const m=d.querySelector("[data-m]");if(m)m.textContent="لا يوجد اتصال بالإنترنت الآن. التحديث الكامل يحتاج إنترنت، فلم نغيّر شيئاً.";return}
   put("tz_via",null);ss("tz_via_r","");
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
 const MOD="#tzset,#pws,#prm,#mtm,#pom,#clm,#osh,#xm,#wkm,#zbx,#bciv,#anniv,#annm,#annp,#bcgi,#bcm,#pfm,#pfc,#wrm,#md,#em,#npm,#uim,.cm,.fm,.gfm,.mdl,.wkm,.ov";
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
 const NEWS_ID="custody-menu-2026-11-23";// (23 نوفمبر 2026، v220) كارت "عهدة الفروع + القائمة الجانبية". لكارت جديد بعدين: غيّر NEWS_ID والنص (T) والرسمة (HERO)
 const DRV_ID="calls-app-2026-11-17";// السائق: لا جديد له في هذا التحديث، فيبقى على الكارت السابق (لا يظهر له شيء)
 const APK_URL="https://github.com/mhmadrgab/TASOOMA-ORDER/releases/latest/download/tasooma-driver.apk",UA=navigator.userAgent,DROID=/android/i.test(UA),IOS=/iphone|ipad|ipod/i.test(UA),INAPP=!!window.TasoomaApp;
 try{localStorage.getItem("tz_news")}catch(e){return}// مفيش تخزين = مانعرضش (علشان ماتطلعش كل مرة)
 
 const vis=el=>!!(el&&el.offsetParent!==null);
 const loggedIn=()=>window.__uiOk&&!document.getElementById("boot")&&![...document.querySelectorAll('input[type="password"]')].some(vis)&&!document.getElementById("tz-stuck")&&!document.getElementById("nr")&&navigator.onLine!==false;
 const t0=Date.now(),iv=setInterval(()=>{if(Date.now()-t0>15*6e4){clearInterval(iv);return}if(loggedIn()){clearInterval(iv);setTimeout(()=>{if(loggedIn())show()},700)}},800);
 addEventListener("tz-news-check",()=>{setTimeout(()=>{if(loggedIn())show()},900)});// لو الحساب اترقّى وهو فاتح المنصة: admin.html بيبعت الحدث ده فنعيد المحاولة من غير ريفرش
 function show(){
  if(document.getElementById("tz-news"))return;
  // النص بيختلف حسب مين فاتح: فرع (index) / مدير أو موظف (admin) / سائق (driver)
  const P=location.pathname,ADM=/admin\.html$/.test(P),co=window.__tzCo===true&&ADM;let role=co?"c":/driver\.html$/.test(P)?"d":ADM?"a":"b";
   // (16 نوفمبر 2026) كارت خاص بمالك النظام (حساب مدير عليه co) بس: مفتاح تخزين مستقل، وبيظهر له بدل الكارت العام
   let KEY=co?"tz_news_co":"tz_news",ID=co?"coowner-2026-11-16":role==="d"?DRV_ID:NEWS_ID;
   // 👑 (18 نوفمبر 2026، طلب محمد) كارت للأدمن ومالك النظام فقط (role "o"): جدول الصلاحيات. مفتاح مستقل tz_news_own، فلا يراه أي موظف أو فرع أو سائق.
   // الترتيب: مالك النظام الجديد يرى كارت الترقية أولاً ثم هذا في الفتحة التالية، والأدمن يراه قبل الكارت العام. لكارت إدارة جديد: غيّر OWN_ID ونص T.o.
   const OWN_ID="perms-2026-11-18",rd=k=>{try{return localStorage.getItem(k)}catch(e){return undefined}};
   if(ADM&&(co||window.__tzRoot===true)&&rd("tz_news_own")!==OWN_ID&&!(co&&rd("tz_news_co")!=="coowner-2026-11-16")){role="o";KEY="tz_news_own";ID=OWN_ID}
   let seen;try{seen=localStorage.getItem(KEY)}catch(e){return}if(seen===ID)return;
  const T={
   b:{k:"تحديث جديد · العهدة",t:"عهدة الفرع أصبحت داخل المنصة",go:"افتح العهدة",sub:"cus",lv:"🧭 على الجوال: اضغط زر ☰ أعلى الصفحة لفتح القائمة.",
    L:[["💼","عهدة الفرع","سجّل كل مصروف ببنده ومبلغه وصورة فاتورته، وتابع رصيدك وكشف حسابك في أي وقت."],
       ["🔔","إشعار بكل خطوة","يصلك إشعار عندما يسلّمك المحاسب عهدة، وعندما يعتمد مصروفك أو يرفضه مع ذكر السبب."],
       ["🧭","قائمة جانبية جديدة","كل الأقسام في قائمة واحدة على جانب الشاشة: طلب جديد، طلباتي، سجل الأوراق، العهدة، الهدايا، الصيانة، والمحادثات."]]},
   a:{k:"تحديث جديد · عهدة الفروع",t:"عهدة الفروع أصبحت داخل المنصة",lv:"🧭 صفحة الفروع أصبحت بقائمة جانبية مثل لوحة المستودع.",
    L:[["💼","عهدة الفروع","من القائمة: «عهدة الفروع» فيها رصيد كل فرع وكشف حسابه، وكل مصروف بصورة فاتورته."],
       ["✅","للمحاسب والمدير المالي","تسليم العهدة للفرع، واعتماد المصروفات أو رفضها، وإقفال الفترة: للمحاسب صاحب صلاحية العهدة والمدير المالي فقط."],
       ["🔔","إشعارات العهدة","يصل المحاسب إشعار بكل مصروف جديد من الفروع، ويصل الفرع إشعار عند التسليم والاعتماد والرفض."]]},
   c:{k:"ترقية حسابك",t:"أصبحت الآن مالك النظام",go:"افتح الإعدادات",
     L:[["👑","كل الصلاحيات بين يديك","الطلبات والعهدة والسيارات والموظفين والصيانة وأوامر الشراء والإعدادات، كلها متاحة لك الآن."],
        ["⚙️","الإعدادات في مكان واحد","تبويب ⚙ الإعدادات يجمع الصلاحيات والموظفين وحسابات الفروع والتقارير."],
        ["🔔","إشعارات المالك تصلك","تصلك إشعارات الطلبات والصيانة والحاويات المتجهة للمستودع كما تصل للأدمن."]]},
   o:{k:"تحديث للإدارة · الصلاحيات",t:"كل الصلاحيات أصبحت في جدول واحد",go:"افتح جدول الصلاحيات",sub:"pm",lv:"👑 هذا التنبيه يظهر للأدمن ومالك النظام فقط.",
     L:[["🔐","جدول الصلاحيات","من تبويب الإعدادات: صف لكل موظف وعمود لكل صلاحية. ضع العلامة لمنحها وأزلها لسحبها، وتُحفظ فوراً."],
        ["💬","مراسلة الفروع لأي موظف","فعّلها لمهندس الصيانة أو لأي موظف آخر ليرى الفروع في الدردشة ويراسلها."],
        ["🔑","كلمات المرور لم تعد محفوظة","تظهر مرة واحدة عند إنشاء الحساب أو تغيير كلمته. وكل فرع وموظف يغيّر كلمته بنفسه."]]},
   d:{k:"تحديث جديد · المكالمات",t:"المستودع والفروع يتصلون بك من المنصة",
    L:[["📞","مكالمات صوتية داخل المنصة","من الدردشة: افتح المحادثة واضغط 📞 لتتصل بالمستودع أو بالفرع."],
       ["📱","حدّث التطبيق","بالنسخة الجديدة تصلك المكالمة كاتصال حقيقي يرنّ حتى والجوال مقفول."],
       ["🔔","رنّة تاسومة","رنّة خاصة بالمنصة لتعرف أن الاتصال للعمل."]]}
  }[role];
  if(role==="d"){T.lv=IOS?"📱 تطبيق تاسومة متاح لأجهزة أندرويد حالياً. على الآيفون تصلك المكالمة إشعاراً فيه «رد» و«رفض».":"🔒 المكالمات مشفّرة بين الطرفين، ولا يسمعها أحد غيركما.";
   if(DROID&&!INAPP){T.go=role==="d"?"⬇️ حدّث التطبيق":"⬇️ ثبّت تطبيق تاسومة";T.url=APK_URL}
   else if(!DROID&&!IOS&&role==="a"){T.go="📋 انسخ رابط التطبيق للموظفين";T.copy=APK_URL}}
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
:where([data-theme=dark]) #tz-news .f button{background:#b48aab;color:#1d1720}:where([data-theme=dark]) #tz-news .tn-hd small{color:#cfb1c8}
@keyframes tzn-f{from{opacity:0}}@keyframes tzn-u{from{opacity:0;transform:translateY(22px) scale(.95)}}
@keyframes tzn-fl{50%{transform:translateY(-6px) rotate(-4deg)}}
@media (prefers-reduced-motion:reduce){#tz-news,#tz-news .k,#tz-news .tn-ps{animation:none}}`;document.head.appendChild(s)}
  const d=document.createElement("div");d.id="tz-news";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-labelledby","tz-news-t");
  d.innerHTML=`<div class="k"><div class="tn-hero"><span class="tn-dot tn-d1"></span><span class="tn-dot tn-d2"></span>
<div class="tn-lgo"><img src="./icon-192.png" alt=""><span>تاسومة</span></div><span class="tn-nw">جديد</span><button class="tn-xb" type="button" data-n="x" aria-label="إغلاق">✕</button>
<div class="tn-ps tn-bk"></div>${role==="o"?`<div class="tn-ps"><div class="tn-t"><b>جدول الصلاحيات</b><span>جديد</span></div>${[[1,1,0,1],[0,1,1,0],[1,0,1,1]].map((r,i)=>`<div style="display:flex;align-items:center;gap:6px;margin-top:${i?7:11}px"><u style="display:block;height:7px;border-radius:9px;background:#e3d6e1;flex:1"></u>${r.map(x=>`<span style="display:block;width:15px;height:15px;border-radius:5px;flex:none;${x?"background:#8a5a83":"border:1.5px solid #cdbfca"}"></span>`).join("")}</div>`).join("")}</div>`:role==="c"?`<div class="tn-ps"><div class="tn-t"><b>مالك النظام</b><span>مفعّل</span></div><div style="font-size:46px;text-align:center;margin:8px 0 6px">👑</div><div class="tn-at"><b>📦 الطلبات</b><b>👥 الموظفين</b><b>⚙ الإعدادات</b></div></div>`:role!=="d"?`<div class="tn-ps"><div class="tn-t"><b>عهدة الفرع</b><span>الرصيد</span></div><div style="font-size:22px;font-weight:700;margin:9px 0 8px;direction:ltr;text-align:end">954.50 <small style="font-size:11px;font-weight:600;color:#74687a">ريال</small></div>${[["#6f7d45","معتمد"],["#6f7d45","معتمد"],["#e0a100","بانتظار"]].map(x=>`<div style="display:flex;align-items:center;gap:6px;margin-top:6px"><span style="display:block;width:8px;height:8px;border-radius:50%;background:${x[0]};flex:none"></span><u style="display:block;height:7px;border-radius:9px;background:#efe6ee;flex:1"></u><b style="font-size:9px;color:${x[0]}">${x[1]}</b></div>`).join("")}</div>`:`<div class="tn-ps" style="text-align:center"><div class="tn-t"><b>مكالمة واردة</b><span>تاسومة</span></div><div style="width:48px;height:48px;border-radius:50%;margin:12px auto 10px;background:linear-gradient(150deg,#c9a3c0,#8a5a83);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:21px">ت</div><div style="display:flex;justify-content:center;gap:26px"><span style="width:32px;height:32px;border-radius:50%;background:#e5372b;display:block"></span><span style="width:32px;height:32px;border-radius:50%;background:#34c759;display:block"></span></div></div>`}</div>
<div class="tn-hd"><small>${T.k}</small><b id="tz-news-t">${T.t}</b></div>
<div class="b"><ul>${T.L.map(x=>`<li><i>${x[0]}</i><div><b>${x[1]}</b><span>${x[2]}</span></div></li>`).join("")}</ul>
<div class="tn-lv"><span style="display:inline;font-size:13px;color:inherit">${T.lv||"⚡ الطلبات والتغييرات الجديدة تصل لحظياً دون إعادة تحميل الصفحة."}</span></div></div>
<div class="f">${T.go?`<button type="button" data-n="go">${T.go}</button><button type="button" class="g" data-n="x">لاحقاً</button>`:`<button type="button" data-n="x">ابدأ الاستخدام</button>`}<small>شكراً لكم، فريق تاسومة 🤍</small></div></div>`;
  const close=()=>{try{localStorage.setItem(KEY,ID)}catch(e){}d.remove();document.removeEventListener("keydown",esc)};
  const esc=e=>{if(e.key==="Escape")close()};
  d.addEventListener("click",e=>{if(e.target===d){close();return}const b=e.target.closest&&e.target.closest("[data-n]");if(!b)return;close();
   // "اعرض طلباتي": الصفحة (index.html) بتسمع وبتفتح آخر طلب
   if(b.dataset.n==="go"){
    if(T.url){try{location.href=T.url}catch(x){}}
    else if(T.copy){const say=m=>{const o=document.createElement("div");o.textContent=m;o.style.cssText="position:fixed;z-index:99991;left:50%;bottom:24px;transform:translateX(-50%);background:#2a1d2c;color:#fff;border-radius:999px;padding:10px 18px;font:600 14px/1.4 'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl;box-shadow:0 10px 28px rgba(0,0,0,.3)";document.body.appendChild(o);setTimeout(()=>o.remove(),2600)};
     try{navigator.clipboard.writeText(T.copy).then(()=>say("✅ تم نسخ رابط التطبيق. أرسله للموظفين والفروع"),()=>prompt("انسخ رابط التطبيق:",T.copy))}catch(x){prompt("انسخ رابط التطبيق:",T.copy)}}
    else{try{window.dispatchEvent(new CustomEvent("tz-news-go",{detail:{sub:T.sub||""}}))}catch(x){}}}});
  document.addEventListener("keydown",esc);
  document.body.appendChild(d);setTimeout(()=>{const b=d.querySelector(".f button");if(b)b.focus({preventScroll:true})},300);
  // (15 نوفمبر 2026، محمد: "بيظهر كل مرة رغم إنه شافه") بتتسجّل "اتشافت" بعد ما تبان ثانيتين، مش بس لما يقفلها
  setTimeout(()=>{if(d.isConnected){try{localStorage.setItem(KEY,ID)}catch(e){}}},2000);
 }
})();
// 📱 كارت "ثبّت تطبيق تاسومة" (17 نوفمبر 2026، طلب محمد "لجميع الحسابات"): شريط فوق الصفحة بعد الدخول، على أندرويد من المتصفح بس
// (جوه التطبيق مابيظهرش، والآيفون/الكمبيوتر مالهمش تطبيق). ✕ بيخفيه أسبوع، وبعد 3 مرات مابيظهرش تاني على الجهاز ده.
(function(){
 if(!/(admin|index)\.html$|\/$/.test(location.pathname))return;// صفحة السائق فيها كارت التطبيق بتاعها
 if(!/android/i.test(navigator.userAgent)||window.TasoomaApp)return;
 const APK="https://github.com/mhmadrgab/TASOOMA-ORDER/releases/latest/download/tasooma-driver.apk";
 let st={t:0,n:0};try{st=Object.assign(st,JSON.parse(localStorage.getItem("tz_appcard")||"{}"))}catch(e){return}
 if(st.n>=3||Date.now()-st.t<7*864e5)return;
 const vis=el=>!!(el&&el.offsetParent!==null);
 const ok=()=>window.__uiOk&&!document.getElementById("boot")&&![...document.querySelectorAll('input[type="password"]')].some(vis);
 const t0=Date.now(),iv=setInterval(()=>{if(Date.now()-t0>15*6e4){clearInterval(iv);return}if(ok()&&!document.getElementById("tz-news")){clearInterval(iv);show()}},1200);
 function show(){
  if(document.getElementById("tz-app"))return;
  const s=document.createElement("style");s.textContent="#tz-app{display:flex;align-items:center;gap:12px;margin:10px 12px 0;padding:12px 14px;border-radius:18px;background:linear-gradient(120deg,#3a2540,#2a1d2c);color:#fff;direction:rtl;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;box-shadow:0 10px 26px rgba(42,29,44,.28);animation:tzapp-in .35s cubic-bezier(.16,1,.3,1) both}@keyframes tzapp-in{from{opacity:0;transform:translateY(-10px)}}#tz-app img{width:44px;height:44px;border-radius:12px;background:#fff;flex:none}#tz-app .tx{flex:1;min-width:0}#tz-app b{display:block;font-size:15.5px}#tz-app small{display:block;color:#e3c8dd;font-size:12.5px;line-height:1.5}#tz-app a{flex:none;background:#b48aab;color:#1d1720;text-decoration:none;font-weight:700;font-size:14.5px;border-radius:12px;padding:10px 14px;white-space:nowrap}#tz-app button{flex:none;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:15px;cursor:pointer;line-height:1}@media (prefers-reduced-motion:reduce){#tz-app{animation:none}}@media print{#tz-app{display:none}}";
  document.head.appendChild(s);
  const d=document.createElement("div");d.id="tz-app";d.setAttribute("role","region");d.setAttribute("aria-label","تطبيق تاسومة");
  d.innerHTML='<img src="./icon-192.png" alt=""><div class="tx"><b>ثبّت تطبيق تاسومة</b><small>تصلك المكالمات كاتصال حقيقي والإشعارات فوراً، حتى والجوال مقفول.</small></div><a href="'+APK+'">⬇️ تثبيت</a><button type="button" aria-label="إخفاء">✕</button>';
  d.querySelector("button").onclick=()=>{try{localStorage.setItem("tz_appcard",JSON.stringify({t:Date.now(),n:(st.n||0)+1}))}catch(e){}d.remove()};
  d.querySelector("a").onclick=()=>{try{localStorage.setItem("tz_appcard",JSON.stringify({t:Date.now(),n:st.n||0}))}catch(e){}setTimeout(()=>d.remove(),400)};
  document.body.insertBefore(d,document.body.firstChild);
 }
})();
// 🛑 (v177، 19 نوفمبر 2026، محمد: "لو حد فاتح أمر شراء أو أي حاجة وضغط في أي حتة فاضية بيطلع منها")
// الضغط على الخلفية الفاضية حول أي نافذة لم يعد يقفلها (كان يضيع ما كُتب في النماذج). القفل من زر الإغلاق/رجوع/إلغاء أو Esc فقط.
// نوقف الضغطة في مرحلة الالتقاط قبل أن تصل لمستمع النافذة (e.target===m)، فلا يحتاج أي ملف آخر أن يتغيّر.
// مستثنى عن قصد: عارضات الصور (#zbx #bciv #anniv .ov) وخريطة التتبع: لا يُكتب فيها شيء، وقفلها بالضغط برّه طبيعي.
// ⚠️ نافذة جديدة: أضف معرّفها هنا لو فيها نموذج. وتهتز اللوحة هزة خفيفة (tz-stay) ليعرف المستخدم أن الضغطة وصلت.
(()=>{
 const HOLD="#tzset,#pws,#prm,#mtm,#pom,#clm,#osh,#xm,#wkm,#annm,#annp,#bcgm,#bcgi,#bcm,#pfm,#pfc,#wrm,#md,#em,#npm,#uim,#flm,#cmx,#gfm,.cm,.fm,.gfm,.mdl,.wkm,.xm";
 const stop=e=>{const t=e.target;if(!(t instanceof Element)||!t.matches(HOLD)||!t.classList.contains("on")&&getComputedStyle(t).display==="none")return;
  e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();
  if(e.type!=="click")return;const p=t.firstElementChild;if(!p||document.documentElement.classList.contains("lite"))return;
  p.classList.remove("tz-stay");void p.offsetWidth;p.classList.add("tz-stay");setTimeout(()=>p.classList.remove("tz-stay"),420)};
 addEventListener("click",stop,true);
})();
// 🎬 (13 نوفمبر 2026، transitions.dev) قفل النوافذ بنعومة: أي نافذة بتتقفل (بيتشال منها "on")، بنسيبها ظاهرة 150ms
// بكلاس is-closing (الخلفية بتختفي بالتدريج واللوحة بتصغر)، وبعدين بتختفي. الملفات التانية مش محتاجة تتغيّر.
// لو اتفتحت تاني في النص، بنلغي القفل على طول. الضغطات بتعدّي من تحتها وهي بتقفل (pointer-events:none في ui.css).
(()=>{
 const SEL="#tzset,#mtm,.cm,.xm,.fm,.gfm,#annm,#annp,#bcgi,#pfm,#pfc,#wrm,#md,#em,.mdl,.wkm,#npm,#uim,#bcm,#anniv,#bciv,#zbx,.ov";
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

// 🐞 (18 نوفمبر 2026) تبليغ تلقائي بأخطاء الصفحات. قبل ذلك كنا نعرف العيب فقط حين يشتكي أحد (مثال: كروت هدايا الفرع بقيت يومين).
// أي خطأ JavaScript يُرسل للخادم (/err) بدون أي بيانات شخصية ولا هوية المستخدم: نص الخطأ، الملف والسطر، اسم الصفحة،
// رقم النسخة ونوع المتصفح. بحد أقصى 4 بلاغات لكل فتحة صفحة، ونفس الخطأ مرة واحدة. الأدمن يراها في ⚙ الإعدادات ← صحة المنصة.
(function(){
 if(!/(admin|index|driver|ext)\.html$|\/$/.test(location.pathname))return;
 if(location.origin!=="https://mhmadrgab.github.io")return;// المنصة الحقيقية فقط (لا نسخة التجربة ولا ملف محلي)
 var seen={},n=0,U="https://tasooma-push.tasooma.workers.dev/err";
 var skip=/ResizeObserver loop|^Script error\.?$|Load failed|Failed to fetch|NetworkError|AbortError|timeout|permission-denied|operation was aborted|Importing a module script failed|not-found|auth\//i;
 function send(m,s){
  m=String(m||"").slice(0,300);if(!m||skip.test(m)||seen[m]||n>=4)return;seen[m]=1;n++;
  var b=JSON.stringify({m:m,s:String(s||"").slice(0,120),p:(location.pathname.split("/").pop()||"index.html").slice(0,40),v:String(window.__tzVer||"").slice(0,20),ua:String(navigator.userAgent||"").slice(0,160),app:window.TasoomaApp?1:0});
  try{fetch(U,{method:"POST",headers:{"Content-Type":"application/json"},body:b,keepalive:true}).catch(function(){})}catch(e){}
 }
 function at(t){var x=/([\w.\-]+\.(?:js|html))(?:\?[^:\s)]*)?:(\d+):(\d+)/.exec(String(t||""));return x?x[1]+":"+x[2]+":"+x[3]:""}
 addEventListener("error",function(e){if(e&&e.message)send(e.message,at((e.filename||"")+":"+(e.lineno||0)+":"+(e.colno||0)))});
 addEventListener("unhandledrejection",function(e){var r=e&&e.reason;if(r==null)return;send(typeof r==="string"?r:(r.message||r.code||""),at(r&&r.stack))});
})();
