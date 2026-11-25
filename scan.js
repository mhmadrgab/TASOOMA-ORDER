// 📄 المسح الضوئي بالكاميرا (v244، 25 نوفمبر 2026، محمد: «إغلاقات الفروع متكونش صور، يكون مسح ضوئي يفتح الكاميرا»):
//   1) الكاميرا (getUserMedia، الخلفية) أو كاميرا الجهاز لو المتصفح منعها  2) حدود الورقة تلقائياً + 4 أركان تُسحب
//   3) فرد الورقة (perspective) + «مستند» (خلفية بيضاء وكتابة واضحة) أو «ألوان» أو «الأصل»  4) إضافة، أو إضافة ومسح صفحة أخرى.
//   scanDoc({toast}) ← Promise بمصفوفة Blob (jpeg). بلا مكتبات، ES2018. المسح يرجع صورة عادية والصفحة اللي نادت تخزّنها زي أي صورة.
const g=id=>document.getElementById(id);
const CSS=`
#tzscan{position:fixed;inset:0;z-index:96;background:#120c14;color:#fff;display:flex;flex-direction:column;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none}
#tzscan .tzs-h{display:flex;align-items:center;gap:10px;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top))}
#tzscan .tzs-h b{flex:1;font-size:16px}#tzscan .tzs-h small{opacity:.75;font-size:12.5px}
#tzscan .tzs-s{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
#tzscan video,#tzscan .tzs-s>canvas{max-width:100%;max-height:100%;display:block}
#tzscan .tzs-g{position:absolute;inset:8% 10%;border:2px dashed rgba(255,255,255,.55);border-radius:14px;pointer-events:none}
#tzscan svg{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#tzscan .tzs-k{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(180,138,171,.35);border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.5);touch-action:none;cursor:grab}
#tzscan .tzs-k:active{cursor:grabbing;background:rgba(180,138,171,.7)}
#tzscan .tzs-b{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:12px 14px;padding-bottom:max(14px,env(safe-area-inset-bottom))}
#tzscan button{font:700 14.5px/1.2 'IBM Plex Sans Arabic',Tahoma,sans-serif;border:0;border-radius:14px;padding:11px 16px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;min-height:46px}
#tzscan button.tzs-p{background:#8a5a83}#tzscan button.tzs-on{background:#fff;color:#2a1d2c}
#tzscan button.tzs-sh{width:74px;height:74px;border-radius:50%;padding:0;background:#fff;border:5px solid rgba(255,255,255,.35);box-shadow:0 0 0 3px #fff inset}
#tzscan .tzs-f{display:flex;gap:6px;justify-content:center;padding:8px 14px 0}
#tzscan .tzs-m{position:absolute;inset-inline:16px;bottom:16px;text-align:center;font-size:13px;opacity:.85}
#tzscan .tzs-z{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(18,12,20,.6);font-size:15px}
`;
let S=null;
function css(){if(!g("tzscan-css")){const s=document.createElement("style");s.id="tzscan-css";s.textContent=CSS;document.head.appendChild(s)}}
// ---------- الحساب ----------
// حل 8 معادلات (الإسقاط من المستطيل إلى الرباعي) بالحذف
function homo(src,dst){
 const A=[],B=[];
 for(let i=0;i<4;i++){const x=src[i][0],y=src[i][1],u=dst[i][0],v=dst[i][1];
  A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v)}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
  const t=A[c];A[c]=A[p];A[p]=t;const tb=B[c];B[c]=B[p];B[p]=tb;const d=A[c][c]||1e-12;
  for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/d;if(!f)continue;for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];B[r]-=f*B[c]}}
 const h=B.map((b,i)=>b/(A[i][i]||1e-12));h.push(1);return h;
}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// فرد الورقة: q = [أعلى يسار، أعلى يمين، أسفل يمين، أسفل يسار] بإحداثيات الصورة
export function warp(cv,q,maxSide){
 let W=Math.max(dist(q[0],q[1]),dist(q[3],q[2])),H=Math.max(dist(q[0],q[3]),dist(q[1],q[2]));
 const k=Math.min(1,(maxSide||1800)/Math.max(W,H));W=Math.max(8,Math.round(W*k));H=Math.max(8,Math.round(H*k));
 const h=homo([[0,0],[W,0],[W,H],[0,H]],q),sw=cv.width,shh=cv.height;
 const sd=cv.getContext("2d").getImageData(0,0,sw,shh).data,out=document.createElement("canvas");out.width=W;out.height=H;
 const o=out.getContext("2d"),od=o.createImageData(W,H),D=od.data;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const z=h[6]*x+h[7]*y+1,sx=(h[0]*x+h[1]*y+h[2])/z,sy=(h[3]*x+h[4]*y+h[5])/z;
  const x0=Math.floor(sx),y0=Math.floor(sy),di=(y*W+x)*4;
  if(x0<0||y0<0||x0>=sw-1||y0>=shh-1){D[di]=D[di+1]=D[di+2]=255;D[di+3]=255;continue}
  const fx=sx-x0,fy=sy-y0,i00=(y0*sw+x0)*4,i10=i00+4,i01=i00+sw*4,i11=i01+4;
  for(let c=0;c<3;c++){const a=sd[i00+c]+(sd[i10+c]-sd[i00+c])*fx,b=sd[i01+c]+(sd[i11+c]-sd[i01+c])*fx;D[di+c]=a+(b-a)*fy}D[di+3]=255}
 o.putImageData(od,0,0);return out;
}
// «مستند»: نقسم كل نقطة على إضاءة المكان حولها (الظل يختفي والورق يبيض) ثم تقوية التباين
export function docFilter(cv,mode){
 const W=cv.width,H=cv.height,o=document.createElement("canvas");o.width=W;o.height=H;const x=o.getContext("2d");x.drawImage(cv,0,0);
 if(mode==="orig")return o;
 const im=x.getImageData(0,0,W,H),d=im.data;
 if(mode==="color"){// تمدد مستويات بسيط لكل قناة
  const lo=[255,255,255],hi=[0,0,0],st=Math.max(1,Math.floor(d.length/4/40000))*4;
  for(let i=0;i<d.length;i+=st)for(let c=0;c<3;c++){if(d[i+c]<lo[c])lo[c]=d[i+c];if(d[i+c]>hi[c])hi[c]=d[i+c]}
  for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++){const r=Math.max(1,hi[c]-lo[c]-10);d[i+c]=Math.max(0,Math.min(255,(d[i+c]-lo[c]-5)*255/r))}
  x.putImageData(im,0,0);return o}
 // إضاءة الخلفية: صورة صغيرة جداً ثم تكبيرها (تنعيم واسع)
 const sm=document.createElement("canvas"),k=Math.max(8,Math.round(Math.max(W,H)/28));sm.width=Math.max(2,Math.round(W/k));sm.height=Math.max(2,Math.round(H/k));
 const sx=sm.getContext("2d");sx.imageSmoothingEnabled=true;sx.drawImage(cv,0,0,sm.width,sm.height);
 // تكبير الخلفية لنفس الحجم (المتصفح ينعّمها)
 const bg=document.createElement("canvas");bg.width=W;bg.height=H;const bx=bg.getContext("2d");bx.imageSmoothingEnabled=true;bx.filter="blur(6px)";bx.drawImage(sm,0,0,W,H);
 const b=bx.getImageData(0,0,W,H).data;
 for(let i=0;i<d.length;i+=4){const gy=d[i]*.3+d[i+1]*.59+d[i+2]*.11,bb=Math.max(40,b[i]*.3+b[i+1]*.59+b[i+2]*.11);
  let v=gy/bb*255;v=v>=235?255:v<=60?0:(v-60)*255/175;v=255*Math.pow(v/255,1.6);d[i]=d[i+1]=d[i+2]=v}
 x.putImageData(im,0,0);return o;
}
// حدود الورقة تلقائياً: أكبر منطقة فاتحة (عتبة Otsu) في صورة صغيرة، والأركان من أطرافها
export function findPaper(cv){
 const s=320/Math.max(cv.width,cv.height),w=Math.max(16,Math.round(cv.width*s)),h=Math.max(16,Math.round(cv.height*s));
 const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.drawImage(cv,0,0,w,h);
 const d=x.getImageData(0,0,w,h).data,n=w*h,gy=new Uint8Array(n),hist=new Array(256).fill(0);
 for(let i=0;i<n;i++){const v=Math.round(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11);gy[i]=v;hist[v]++}
 let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sb=0,wb=0,best=0,th=128;
 for(let t=0;t<256;t++){wb+=hist[t];if(!wb)continue;const wf=n-wb;if(!wf)break;sb+=t*hist[t];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)*(mb-mf);if(v>best){best=v;th=t}}
 const lab=new Int32Array(n).fill(-1),stk=[];let bestL=-1,bestN=0,cur=0;
 for(let i=0;i<n;i++){if(lab[i]!==-1||gy[i]<=th)continue;let cnt=0;stk.push(i);lab[i]=cur;
  while(stk.length){const p=stk.pop();cnt++;const px=p%w,py=(p-px)/w;
   if(px>0&&lab[p-1]===-1&&gy[p-1]>th){lab[p-1]=cur;stk.push(p-1)}if(px<w-1&&lab[p+1]===-1&&gy[p+1]>th){lab[p+1]=cur;stk.push(p+1)}
   if(py>0&&lab[p-w]===-1&&gy[p-w]>th){lab[p-w]=cur;stk.push(p-w)}if(py<h-1&&lab[p+w]===-1&&gy[p+w]>th){lab[p+w]=cur;stk.push(p+w)}}
  if(cnt>bestN){bestN=cnt;bestL=cur}cur++}
 const inset=()=>{const a=cv.width*.06,b=cv.height*.06;return [[a,b],[cv.width-a,b],[cv.width-a,cv.height-b],[a,cv.height-b]]};
 if(bestL<0||bestN<n*.12||bestN>n*.97)return inset();
 let tl=null,tr=null,br=null,bl=null,a1=1e9,a2=-1e9,a3=-1e9,a4=1e9;
 for(let i=0;i<n;i++){if(lab[i]!==bestL)continue;const px=i%w,py=(i-px)/w,s1=px+py,s2=px-py;
  if(s1<a1){a1=s1;tl=[px,py]}if(s1>a3){a3=s1;br=[px,py]}if(s2>a2){a2=s2;tr=[px,py]}if(s2<a4){a4=s2;bl=[px,py]}}
 const q=[tl,tr,br,bl].map(p=>[p[0]/s,p[1]/s]);
 // شكل غير معقول (ركنان فوق بعض) ← الإطار الافتراضي
 if(dist(q[0],q[2])<cv.width*.2||dist(q[1],q[3])<cv.width*.2)return inset();
 return q;
}
// ---------- الواجهة ----------
function overlay(){let o=g("tzscan");if(!o){o=document.createElement("div");o.id="tzscan";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-label","مسح ضوئي");document.body.appendChild(o)}return o}
function stopCam(){if(S&&S.stream){try{S.stream.getTracks().forEach(t=>t.stop())}catch(e){}S.stream=null}}
function done(){stopCam();const o=g("tzscan");if(o)o.remove();window.removeEventListener("resize",onRz);const r=S&&S.res,out=S?S.out:[];S=null;if(r)r(out)}
function onRz(){if(S&&S.step==="crop")drawCrop();else if(S&&S.step==="filt"&&S.res1)paintPv()}
export function scanDoc(ctx){
 css();if(S)done();
 return new Promise(res=>{S={res,out:[],toast:ctx&&ctx.toast||function(){},stream:null,step:"",cv:null,q:null,mode:"doc",flat:null};window.addEventListener("resize",onRz);camStep()});
}
const head=t=>`<div class="tzs-h"><b>📄 ${t}</b>${S.out.length?`<small>${S.out.length} صفحة جاهزة</small>`:""}<button type="button" data-sc="x" aria-label="إغلاق">✕</button></div>`;
async function camStep(){
 const o=overlay();S.step="cam";S.cv=null;
 o.innerHTML=`${head("مسح ضوئي")}<div class="tzs-s"><video playsinline muted autoplay></video><div class="tzs-g"></div><div class="tzs-m">ضع الورقة داخل الإطار على سطح داكن، ثم التقط</div></div>
 <div class="tzs-b"><button type="button" data-sc="file">📷 كاميرا الجهاز</button><button type="button" class="tzs-sh" data-sc="snap" aria-label="التقاط"></button>${S.out.length?`<button type="button" class="tzs-p" data-sc="fin">تم (${S.out.length})</button>`:`<button type="button" data-sc="x">إلغاء</button>`}</div>`;
 o.onclick=onClick;
 const v=o.querySelector("video");
 if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){noCam();return}
 try{S.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1440}},audio:false});
  if(!S||S.step!=="cam"){stopCam();return}v.srcObject=S.stream;try{await v.play()}catch(e){}}
 catch(e){noCam()}
}
function noCam(){if(!S)return;const st=g("tzscan")&&g("tzscan").querySelector(".tzs-s");if(st)st.innerHTML=`<div class="tzs-m" style="position:static;padding:20px;font-size:14.5px">تعذّر فتح الكاميرا داخل الصفحة. اضغط «كاميرا الجهاز» لالتقاط الورقة، وستُقصّ وتُحسَّن كأنها مسح ضوئي.</div>`;const s=g("tzscan").querySelector('[data-sc="snap"]');if(s)s.remove()}
function fromSource(src,w,h){const M=2400,k=Math.min(1,M/Math.max(w,h)),c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext("2d").drawImage(src,0,0,c.width,c.height);return c}
function snap(){const v=g("tzscan").querySelector("video");if(!v||!v.videoWidth){S.toast("الكاميرا لم تبدأ بعد","er");return}const c=fromSource(v,v.videoWidth,v.videoHeight);stopCam();cropStep(c)}
function pickFile(){const i=document.createElement("input");i.type="file";i.accept="image/*";i.setAttribute("capture","environment");
 i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return;const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);stopCam();cropStep(fromSource(im,im.naturalWidth,im.naturalHeight))};im.onerror=()=>{URL.revokeObjectURL(u);S.toast("تعذّر قراءة الصورة","er")};im.src=u};i.click()}
function cropStep(c,keepQ){
 S.step="crop";S.cv=c;S.q=keepQ&&S.q?S.q:findPaper(c);const o=overlay();
 o.innerHTML=`${head("حدّد حدود الورقة")}<div class="tzs-s" id="tzs-st"></div>
 <div class="tzs-b"><button type="button" data-sc="re">↺ إعادة التصوير</button><button type="button" data-sc="rot">⟳ تدوير</button><button type="button" data-sc="all">⛶ الصورة كاملة</button><button type="button" class="tzs-p" data-sc="next">التالي ←</button></div>`;
 drawCrop();
}
function drawCrop(){
 const st=g("tzs-st");if(!st||!S||!S.cv)return;const c=S.cv,r=st.getBoundingClientRect(),k=Math.min((r.width-24)/c.width,(r.height-24)/c.height);
 const dw=c.width*k,dh=c.height*k,ox=(r.width-dw)/2,oy=(r.height-dh)/2;S.k={k,ox,oy};
 const vis=document.createElement("canvas");vis.width=Math.round(dw*(window.devicePixelRatio>1?1.5:1));vis.height=Math.round(dh*(window.devicePixelRatio>1?1.5:1));vis.style.width=dw+"px";vis.style.height=dh+"px";vis.getContext("2d").drawImage(c,0,0,vis.width,vis.height);
 st.innerHTML="";st.appendChild(vis);vis.style.position="absolute";vis.style.left=ox+"px";vis.style.top=oy+"px";
 const ns="http://www.w3.org/2000/svg",sv=document.createElementNS(ns,"svg");sv.setAttribute("width",r.width);sv.setAttribute("height",r.height);
 sv.innerHTML=`<polygon fill="rgba(180,138,171,.18)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"></polygon>`;st.appendChild(sv);
 S.q.forEach((p,i)=>{const h=document.createElement("div");h.className="tzs-k";h.dataset.i=i;h.setAttribute("aria-label","ركن "+(i+1));st.appendChild(h);drag(h,i)});
 placeH();
}
function placeH(){const st=g("tzs-st");if(!st)return;const K=S.k,P=S.q.map(p=>[K.ox+p[0]*K.k,K.oy+p[1]*K.k]);
 st.querySelectorAll(".tzs-k").forEach(h=>{const p=P[+h.dataset.i];h.style.left=p[0]+"px";h.style.top=p[1]+"px"});
 const pg=st.querySelector("polygon");if(pg)pg.setAttribute("points",P.map(p=>p.join(",")).join(" "))}
function drag(h,i){
 h.addEventListener("pointerdown",e=>{e.preventDefault();try{h.setPointerCapture(e.pointerId)}catch(x){}
  const st=g("tzs-st"),r=st.getBoundingClientRect(),K=S.k;
  const mv=ev=>{const x=(ev.clientX-r.left-K.ox)/K.k,y=(ev.clientY-r.top-K.oy)/K.k;S.q[i]=[Math.max(0,Math.min(S.cv.width,x)),Math.max(0,Math.min(S.cv.height,y))];placeH()};
  const up=()=>{h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up);h.removeEventListener("pointercancel",up)};
  h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up);h.addEventListener("pointercancel",up)});
}
function rotate(){const c=S.cv,o=document.createElement("canvas");o.width=c.height;o.height=c.width;const x=o.getContext("2d");x.translate(o.width,0);x.rotate(Math.PI/2);x.drawImage(c,0,0);cropStep(o)}
function busy(t){const st=g("tzscan")&&g("tzscan").querySelector(".tzs-s");if(st&&!st.querySelector(".tzs-z")){const b=document.createElement("div");b.className="tzs-z";b.textContent=t;st.appendChild(b)}}
function filtStep(){
 S.step="filt";const o=overlay();busy("جاري فرد الورقة…");
 setTimeout(()=>{try{S.flat=warp(S.cv,S.q,1800)}catch(e){S.toast("تعذّر تجهيز المسح","er");return}
  o.innerHTML=`${head("المسح جاهز")}<div class="tzs-f">${[["doc","مستند"],["color","ألوان"],["orig","الأصل"]].map(m=>`<button type="button" data-sc="m" data-m="${m[0]}" class="${S.mode===m[0]?"tzs-on":""}">${m[1]}</button>`).join("")}</div><div class="tzs-s" id="tzs-pv"></div>
  <div class="tzs-b"><button type="button" data-sc="back">→ الحدود</button><button type="button" data-sc="more">＋ إضافة ومسح صفحة أخرى</button><button type="button" class="tzs-p" data-sc="add">✓ إضافة</button></div>`;
  paintPv()},30);
}
function paintPv(){const pv=g("tzs-pv");if(!pv||!S.flat)return;const c=docFilter(S.flat,S.mode);S.res1=c;pv.innerHTML="";const r=pv.getBoundingClientRect(),k=Math.min(1,(r.width-24)/c.width,(r.height-24)/c.height);c.style.width=Math.max(40,Math.floor(c.width*k))+"px";c.style.height=Math.max(40,Math.floor(c.height*k))+"px";c.style.background="#fff";c.style.borderRadius="6px";pv.appendChild(c)}
function keep(again){const c=S.res1;if(!c)return;c.toBlob(b=>{if(!S)return;if(b)S.out.push(b);if(again)camStep();else done()},"image/jpeg",.86)}
function onClick(e){
 const t=e.target.closest&&e.target.closest("[data-sc]");if(!t||!S)return;const a=t.dataset.sc;
 if(a==="x"){done();return}
 if(a==="fin"){done();return}
 if(a==="snap"){snap();return}
 if(a==="file"){pickFile();return}
 if(a==="re"){camStep();return}
 if(a==="rot"){rotate();return}
 if(a==="all"){const c=S.cv;S.q=[[0,0],[c.width,0],[c.width,c.height],[0,c.height]];placeH();return}
 if(a==="next"){filtStep();return}
 if(a==="back"){cropStep(S.cv,true);return}
 if(a==="m"){S.mode=t.dataset.m;g("tzscan").querySelectorAll('[data-sc="m"]').forEach(b=>b.className=b.dataset.m===S.mode?"tzs-on":"");busy("…");setTimeout(paintPv,20);return}
 if(a==="add"){keep(false);return}
 if(a==="more"){keep(true);return}
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S&&g("tzscan")){e.stopPropagation();done()}},true);
