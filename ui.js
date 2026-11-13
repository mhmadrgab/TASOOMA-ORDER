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
 let ready=false,minDone=!H.classList.contains("app");
 const hide=()=>{if(!ready||!minDone||!boot||!boot.isConnected||boot.classList.contains("out"))return;boot.classList.add("out");setTimeout(()=>boot.remove(),600)};
 if(!minDone)setTimeout(()=>{minDone=true;hide()},Math.max(0,1700-performance.now()));
 window.uiReady=()=>{if(ready)return;ready=true;window.__uiOk=1;H.classList.remove("aw");hide()};
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
  if(px&&!ss("tz_via_r")){put("tz_via","p");ss("tz_via_r","1");location.reload()}
 },via?10000:800);
 setTimeout(()=>{
  if(window.__uiOk||document.getElementById("tz-stuck"))return;
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
