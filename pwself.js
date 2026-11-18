// 🔑 تغيير كلمة المرور بنفسك (18 نوفمبر 2026، طلب محمد: "أي فرع يغيّر كلمة السر بنفسه").
// أي عنصر عليه data-pwself يفتح النافذة. لازم يكتب كلمته الحالية أولاً (نتأكد منها بدخول جانبي "sec" لا يمسّ الجلسة)،
// ثم الكلمة الجديدة مرتين. التغيير على حسابه هو فقط (updatePassword على جلسته)، ولا تُحفظ الكلمة في أي مكان.
// الأجهزة الأخرى الداخلة بنفس الحساب تبقى داخلة، والدخول الجديد يكون بالكلمة الجديدة.
import {makeFb,signInWithEmailAndPassword,updatePassword,signOut,withTimeout} from "./fb.js";
let X=null,busy=false;
const g=id=>document.getElementById(id);
const CSS=`#pws{display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);overflow:auto;padding:16px}#pws.on{display:block}
#pws .pws-k{max-width:420px;margin:8vh auto;background:var(--card,#fffaf3);color:var(--ink,#2a1d2c);border-radius:18px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.25);text-align:start;font-size:15px}
#pws h3{margin:0 0 4px;font-size:19px}#pws .pws-sub{color:var(--mut,#7b6f7d);font-size:13.5px;line-height:1.7;margin:0 0 6px}
#pws label{display:block;color:var(--mut,#7b6f7d);font-size:13px;margin:12px 0 4px}
#pws input[type=password],#pws input[type=text]{width:100%;box-sizing:border-box;direction:ltr;text-align:left;font:inherit;font-size:17px;letter-spacing:1px;padding:11px 12px;border-radius:11px;border:1.5px solid var(--line,#e2d6c8);background:var(--field,#f2e9dd);color:var(--ink,#2a1d2c)}
#pws input:focus{outline:none;border-color:var(--acc,#8a5a83)}
#pws .pws-show{display:flex;align-items:center;gap:8px;margin:12px 0 0;color:var(--mut,#7b6f7d);font-size:13.5px;cursor:pointer}#pws .pws-show input{width:18px;height:18px;margin:0}
#pws .pws-er{min-height:22px;margin:10px 0 0;color:#c4362b;font-weight:700;font-size:14px;line-height:1.6}
#pws .pws-act{display:flex;gap:10px;margin-top:8px}#pws .pws-act button{flex:1;font:inherit;font-weight:700;font-size:15.5px;border-radius:12px;padding:12px;cursor:pointer;border:1.5px solid var(--line,#e2d6c8);background:none;color:var(--ink,#2a1d2c);text-decoration:none}
#pws .pws-act button.p{background:#2a1d2c;border-color:#2a1d2c;color:#fff}#pws .pws-act button:disabled{opacity:.6}
@media (prefers-color-scheme:dark){#pws .pws-act button.p{background:#b48aab;border-color:#b48aab;color:#2a1d2c}#pws .pws-er{color:#f1a5a0}}`;
export function initPwSelf(ctx){
 X=ctx;busy=false;
 if(!g("pws-css")){const s=document.createElement("style");s.id="pws-css";s.textContent=CSS;document.head.appendChild(s)}
 if(!window.__pwsc){window.__pwsc=1;
  document.addEventListener("click",e=>{const t=e.target&&e.target.closest?e.target.closest("[data-pwself],[data-pws]"):null;if(!t||!X)return;
   if(t.hasAttribute("data-pwself")){e.preventDefault();open();return}
   const a=t.dataset.pws;if(a==="x")close();else if(a==="ok")save()});
  document.addEventListener("change",e=>{if(e.target&&e.target.id==="pws-sh"){const on=e.target.checked;["pws-o","pws-n","pws-n2"].forEach(i=>{const el=g(i);if(el)el.type=on?"text":"password"})}});
  document.addEventListener("keydown",e=>{const m=g("pws");if(!m||m.className!=="on")return;if(e.key==="Escape")close();else if(e.key==="Enter"&&e.target&&/^pws-/.test(e.target.id||"")){e.preventDefault();save()}})}
}
export function stopPwSelf(){X=null;close()}
function close(){const m=g("pws");if(m){m.className="";m.innerHTML=""}busy=false}
function open(){
 if(!X||!X.auth||!X.auth.currentUser)return;
 let m=g("pws");if(!m){m=document.createElement("div");m.id="pws";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-labelledby","pws-h");m.addEventListener("click",e=>{if(e.target===m&&!busy)close()});document.body.appendChild(m)}
 m.innerHTML=`<div class="pws-k"><h3 id="pws-h">🔑 تغيير كلمة المرور</h3><p class="pws-sub">${X.label?`<bdi data-notr>${String(X.label).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</bdi> · `:""}تُغيَّر لحسابك أنت فقط. الدخول بعد ذلك بالكلمة الجديدة.</p>
 <label for="pws-o">كلمة المرور الحالية</label><input id="pws-o" type="password" autocomplete="current-password" maxlength="72">
 <label for="pws-n">كلمة المرور الجديدة (6 أحرف على الأقل)</label><input id="pws-n" type="password" autocomplete="new-password" maxlength="72">
 <label for="pws-n2">أعد كتابة الكلمة الجديدة</label><input id="pws-n2" type="password" autocomplete="new-password" maxlength="72">
 <label class="pws-show"><input id="pws-sh" type="checkbox"> إظهار ما أكتبه</label>
 <div class="pws-er" id="pws-er" role="alert"></div>
 <div class="pws-act"><button class="p" type="button" data-pws="ok">حفظ الكلمة الجديدة</button><button type="button" data-pws="x">إلغاء</button></div></div>`;
 m.className="on";setTimeout(()=>{const o=g("pws-o");if(o)o.focus()},60);
}
const say=t=>{const e=g("pws-er");if(e)e.textContent=t||""};
async function save(){
 if(busy||!X)return;const u=X.auth&&X.auth.currentUser;if(!u||!u.email){say("انتهت الجلسة. سجّل الدخول مرة أخرى");return}
 const old=String((g("pws-o")||{}).value||""),nw=String((g("pws-n")||{}).value||""),nw2=String((g("pws-n2")||{}).value||"");
 if(!old){say("اكتب كلمة المرور الحالية");return}
 if(nw.length<6){say("الكلمة الجديدة قصيرة: 6 أحرف على الأقل");return}
 if(nw!==nw2){say("الكلمتان الجديدتان غير متطابقتين");return}
 if(nw===old){say("الكلمة الجديدة هي نفسها الحالية");return}
 const btn=document.querySelector('#pws [data-pws="ok"]');busy=true;say("");if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 const done=()=>{busy=false;if(btn&&btn.isConnected){btn.disabled=false;btn.textContent="حفظ الكلمة الجديدة"}};
 const net=e=>e&&(e.code==="auth/network-request-failed"||e.message==="timeout");
 // 1) نتأكد من الكلمة الحالية بدخول جانبي (لا يغيّر الجلسة المفتوحة)
 const a=makeFb("sec").auth;
 try{await withTimeout(signInWithEmailAndPassword(a,u.email,old),20000)}
 catch(e){done();say(net(e)?"لا يوجد اتصال بالإنترنت. حاول مرة أخرى":e&&e.code==="auth/too-many-requests"?"محاولات كثيرة، انتظر قليلاً ثم حاول":"كلمة المرور الحالية غير صحيحة");return}
 finally{try{await signOut(a)}catch(e){}}
 // 2) التغيير على جلستي أنا
 try{await withTimeout(updatePassword(u,nw),20000)}
 catch(e){done();say(net(e)?"لا يوجد اتصال بالإنترنت. حاول مرة أخرى":e&&e.code==="auth/weak-password"?"الكلمة الجديدة ضعيفة. اختر كلمة أطول":"تعذّر تغيير كلمة المرور. حاول مرة أخرى");return}
 const t=X.toast;close();if(t)t("تم تغيير كلمة المرور ✅ الدخول من الآن بالكلمة الجديدة");
}
