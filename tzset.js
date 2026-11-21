// ⚙ إعدادات الحساب للفرع والسائق (v172، 18 نوفمبر 2026، طلب محمد: «نحط لكل الفروع علامة الإعدادات وبداخلها تغيير كلمة السر وأي حاجة تخصهم + الوضع الليلي»).
// نافذة واحدة (#tzset) تُفتح من أي عنصر عليه data-tzset: الحساب (كلمة المرور)، المظهر (تلقائي/نهاري/ليلي)، اللغة، الإشعارات، التطبيق والتثبيت،
// تحديث المنصة، الشروط والخصوصية، رقم الإصدار، وتسجيل الخروج. لا تقرأ ولا تكتب أي بيانات في القاعدة.
//   initSettings({kind:"branch"|"driver", who:()=>اسم الفرع أو السائق, tag:()=>نص قصير للمربع (كود الفرع), sub:نص فوق الاسم,
//                 pw:true (زر كلمة المرور؛ الصفحة لازم تكون نادت initPwSelf), bell:true (صف الإشعارات، ويحتاج wire=wireButtons من notify.js),
//                 wire, logout:()=>{}, outLabel, outHint, toast})
//   التنسيق في ui.css (قسم «إعدادات الفرع والسائق»). النافذة مسجّلة في قوائم النوافذ في ui.js و ui.css.
// ⚠️ الجرس وزر التثبيت هنا بنفس المعرّفات التي يربطها notify.js (#bell و [data-install])، فلا تكرّرهما في نفس الصفحة.
let X=null,LAST=null,CANI=false,busy=false;
const g=id=>document.getElementById(id);
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const APK="https://github.com/mhmadrgab/TASOOMA-ORDER/releases/latest/download/tasooma-driver.apk";
const UA=navigator.userAgent||"",DROID=/android/i.test(UA);
// المتصفح يسمح بالتثبيت (PWA): الحدث يأتي مبكراً، قبل فتح النافذة
addEventListener("beforeinstallprompt",()=>{CANI=true;const b=document.querySelector("#tzset [data-install]");if(b)b.hidden=false});
addEventListener("appinstalled",()=>{CANI=false});
// رسمة الترس من Feather Icons (رخصة MIT)
const GEAR='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const INFO='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/></svg>';
const XIC='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
// زر الفتح (للصفحات التي تبنيه من السكريبت؛ صفحة الفرع تكتبه في HTML مباشرة)
export const settingsBtn=(label)=>`<button type="button" class="tzset-btn" data-tzset aria-haspopup="dialog" data-noico${label?"":' aria-label="الإعدادات" title="الإعدادات"'}>${GEAR}${label?`<span>${E(label)}</span>`:""}</button>`;
export const gearIcon=()=>GEAR;
const ver=()=>{const v=String(window.__tzVer||"").replace(/[^0-9.]/g,"");return v?"v"+v:"—"};
const appVer=()=>{try{return window.TasoomaApp&&typeof window.TasoomaApp.version==="function"?String(window.TasoomaApp.version()||"").replace(/[^0-9.]/g,"").slice(0,8):""}catch(e){return ""}};
const row=(ic,t,s,end,attrs,tag,cls)=>`<${tag||"button"} class="tzst-r${cls?" "+cls:""}"${tag?"":' type="button"'} ${attrs||""}><span class="tzst-i" aria-hidden="true">${ic}</span><span class="tzst-t"><b>${t}</b>${s?`<small>${s}</small>`:""}</span>${end||""}</${tag||"button"}>`;
const GO='<i class="tzst-go" aria-hidden="true"></i>';
function html(){
 const en=!!(window.TZL&&window.TZL.lang==="en"),inApp=!!window.TasoomaApp,av=appVer(),drv=X.kind==="driver";
 const tag=String(X.tag?X.tag():"").slice(0,4);
 return `<div class="tzst-k" role="document"><div class="tzst-hd"><div class="tzst-av" data-notr aria-hidden="true">${tag?E(tag):GEAR}</div><div class="tzst-id"><small id="tzset-h">${E(X.sub||"الإعدادات")}</small><b><bdi dir="auto" data-notr>${E(X.who?X.who():"")}</bdi></b></div><button type="button" class="tzst-x" data-tzs="x" aria-label="إغلاق" data-noico>${XIC}</button></div>
<div class="tzst-b">
${X.pw?`<section class="tzst-s"><h4>الحساب</h4><div class="tzst-c">${row("🔑","تغيير كلمة المرور","لحسابك أنت فقط، وتُطلب الكلمة الحالية أولاً",GO,"data-pwself")}</div></section>`:""}
<section class="tzst-s"><h4>المظهر واللغة</h4><div class="tzst-c"><div class="tzst-th"><b><span class="tzst-i" aria-hidden="true">🌙</span>المظهر</b>${window.tzTheme?window.tzTheme.seg():""}</div>${window.TZL?row("🌐","اللغة",en?"التبديل إلى العربية":"التبديل إلى الإنجليزية",`<span class="tzst-v" data-notr>${en?"English":"العربية"}</span>${GO}`,'data-tzs="lang"'):""}</div></section>
${X.bell?`<section class="tzst-s"><h4>الإشعارات</h4><div class="tzst-c"><div class="tzst-r tzst-nt"><span class="tzst-i" aria-hidden="true">🔔</span><span class="tzst-t"><b>إشعارات هذا الجهاز</b><small>ليصلك كل جديد فوراً، حتى والمنصة مغلقة</small></span><button id="bell" type="button" class="tzst-bell"></button><span class="tzst-v tzst-nb">غير مدعومة هنا</span></div></div></section>`:""}
<section class="tzst-s"><h4>التطبيق</h4><div class="tzst-c">${X.bell?row("📲","تثبيت المنصة على هذا الجهاز","تفتح كتطبيق من الشاشة الرئيسية",GO,"data-install"+(CANI?"":" hidden")):""}${inApp?row("📱","تطبيق تاسومة","أنت تستخدم التطبيق الآن",av?`<span class="tzst-v" data-notr dir="ltr">${E(av)}</span>`:"","","div"):DROID&&!drv?row("📱","تطبيق تاسومة للأندرويد","تصلك المكالمات كاتصال حقيقي حتى والجوال مقفول",`<span class="tzst-v">تحميل</span>${GO}`,`href="${APK}" rel="noopener"`,"a"):""}${row("🔄","تحديث المنصة","يحمّل آخر نسخة من جديد دون تسجيل خروجك",GO,'data-tzs="fresh"')}</div></section>
<section class="tzst-s"><h4>عن المنصة</h4><div class="tzst-c">${row("📄","الشروط والأحكام","",GO,'href="./terms.html"',"a")}${row("🛡","سياسة الخصوصية","",GO,'href="./privacy.html"',"a")}${row(INFO,"الإصدار","",`<span class="tzst-v" id="tzset-v" data-notr dir="ltr">${ver()}</span>`,"","div")}</div></section>
${X.logout?`<section class="tzst-s"><div class="tzst-c">${row("🚪",E(X.outLabel||"تسجيل الخروج"),E(X.outHint||""),"",'data-tzs="out"',"","dng")}</div></section>`:""}
<p class="tzst-f">منصة تاسومة · <span data-notr dir="ltr">TASOOMA</span></p></div></div>`;
}
function open(from){
 if(!X)return;
 let m=g("tzset");
 if(!m){m=document.createElement("div");m.id="tzset";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-labelledby","tzset-h");
  m.addEventListener("click",e=>{if(e.target===m)close()});document.body.appendChild(m)}
 LAST=from||document.activeElement;m.innerHTML=html();m.className="on";m.scrollTop=0;
 if(X.bell&&X.wire)try{X.wire()}catch(e){}// الجرس وزر التثبيت يربطهما notify.js
 {const b=m.querySelector("[data-install]");if(b&&CANI)b.hidden=false}
 setTimeout(()=>{const x=m.querySelector(".tzst-x");if(x)try{x.focus({preventScroll:true})}catch(e){}},80);
}
function close(){const m=g("tzset");if(!m||m.className!=="on")return;m.className="";busy=false;
 // المحتوى يُفرَّغ بعد حركة الإغلاق، حتى لا يبقى #bell مكرراً لو فُتحت من جديد
 setTimeout(()=>{if(m.className!=="on")m.innerHTML=""},260);
 if(LAST&&LAST.isConnected&&LAST.focus)try{LAST.focus({preventScroll:true})}catch(e){}LAST=null}
async function fresh(b){
 if(busy)return;busy=true;const t=b&&b.querySelector(".tzst-t b"),t0=t?t.textContent:"";if(t)t.textContent="⏳ جاري التحديث…";
 // 📡 (21 نوفمبر 2026) التحديث يمسح نسخة المنصة المحفوظة على الجهاز: من غير نت كانت تبقى شاشة بيضاء. نتأكد أن الموقع واصل أولاً
 // (طلب HEAD لا يمر من النسخة المحفوظة)، وإلا لا نمسح شيئاً.
 let net=false;try{const c=new AbortController(),tm=setTimeout(()=>c.abort(),6000);const r=await fetch("./sw.js?x="+Date.now(),{method:"HEAD",cache:"no-store",signal:c.signal});clearTimeout(tm);net=!!(r&&r.ok)}catch(e){net=false}
 if(!net){busy=false;if(t){t.textContent="📡 لا يوجد اتصال بالإنترنت، التحديث يحتاج إنترنت";setTimeout(()=>{if(t.isConnected)t.textContent=t0},4000)}return}
 try{if(navigator.serviceWorker){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}}catch(e){}
 try{if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}}catch(e){}
 try{location.replace(location.pathname+"?r="+Date.now()+location.hash)}catch(e){location.reload()}
}
export function initSettings(ctx){
 X=ctx;busy=false;
 if(window.__tzsetc)return;window.__tzsetc=1;
 document.addEventListener("click",e=>{const t=e.target&&e.target.closest?e.target.closest("[data-tzset],[data-tzs]"):null;if(!t||!X)return;
  if(t.hasAttribute("data-tzset")){e.preventDefault();open(t);return}
  const a=t.getAttribute("data-tzs");
  if(a==="x")close();
  else if(a==="lang"){if(window.TZL)window.TZL.set(window.TZL.lang==="en"?"ar":"en")}
  else if(a==="fresh")fresh(t);
  else if(a==="out"){const f=X.logout;close();if(f)f()}});
 document.addEventListener("keydown",e=>{const m=g("tzset");if(!m||m.className!=="on")return;
  if(e.key==="Escape"){const p=g("pws");if(p&&p.className==="on")return;e.preventDefault();close();return}
  // التركيز يبقى داخل النافذة
  if(e.key==="Tab"){const p=g("pws"),n=g("npm");if((p&&p.className==="on")||(n&&n.className==="on"))return;
   const L=[...m.querySelectorAll("button,a[href]")].filter(b=>b.getClientRects().length&&b.tabIndex>=0);if(!L.length)return;const a=document.activeElement,i=L.indexOf(a);
   if(e.shiftKey&&(i<=0)){e.preventDefault();L[L.length-1].focus()}else if(!e.shiftKey&&(i<0||i===L.length-1)){e.preventDefault();L[0].focus()}}},true);// capture: نرى نافذة كلمة المرور مفتوحة قبل أن يغلقها pwself.js، فـ Esc يغلق العليا فقط
 // رقم الإصدار يصل من الخدمة (sw.js) بعد لحظة
 navigator.serviceWorker&&navigator.serviceWorker.addEventListener&&navigator.serviceWorker.addEventListener("message",()=>{setTimeout(()=>{const v=g("tzset-v");if(v)v.textContent=ver()},60)});
}
export function stopSettings(){X=null;const m=g("tzset");if(m){m.className="";m.innerHTML=""}}
