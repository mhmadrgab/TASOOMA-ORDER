// 🎁 الهدايا والعينات: الفرع (أو المستودع) يسجّل هدية/عينة طلعت + سند يثبتها، والاعتماد لمدير التسويق (p.gm) واللي معاه "اعتماد الهدايا" (p.ga) بس،
// والمحاسب (صلاحية gift) بيشوف ويطلّع تقارير لكل فرع أو للمستودع (طباعة PDF وملف إكسل). التعديل والمسح لمالك النظام بس.
// gifts/{id} = {br:"003"|"WH", brn, no, ts, dt, rows:[{k,c,z,q}], pcs, to:{n,ph?}, why, note?, img:1, by:{e,n}, st:"pend"|"ok"|"no"|"set", ap?:{e,n,at,note?}}
// التسوية (نوفمبر 2026): المحاسب (gift) بيشوف المعتمد بس، ويكتب رقم/مرجع السند في السيستم ← st:"set", sa:{e,n,at,ref}, sm:"YYYY-MM" (شهر الهدية)
//   المحاسب بيسمع st=="ok" (اللي مستني تسوية) + المتسوّي الشهر ده، والشهور الأقدم بتتحمّل من التقرير (st=="set" && sm==الشهر، من غير فهرس مركّب)
// صورة السند لوحدها في giftimg/{id} = {img} (بتتحمّل بس لما حد يدوس 📎، علشان القايمة تفضل خفيفة).
// 📎 مرفقات المحاسب (13 نوفمبر 2026، طلب محمد): المحاسب يرفق صور من عنده لهدية معتمدة/متسوّية من غير ما يلمس الهدية نفسها
//   giftimg/{id}/a/{1..10} = {img,n,at} — إضافة بس، والحذف للمالك (القواعد: supabase/002_rules.sql sub='a'). بتتحمّل لما السند يتفتح.
import {collection,doc,getDoc,getDocs,setDoc,deleteDoc,updateDoc,onSnapshot,query,where,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E,N,fmt,today,shrink,printStmt,ensurePrintCss} from "./cust.js";
import {initZoom,zoomOpen,zoomGallery} from "./zoom.js";
import {multiPick,saveExtras,loadExtras,dropExtras,loadAtts,putAtt,dropAtt} from "./att.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const WHY=["هدية لعميل","تعويض عميل","عينة","تسويق / مؤثر","مناسبة / حدث","أخرى"];
const STL={pend:"⏳ بانتظار الاعتماد",ok:"✅ معتمدة",set:"🧾 تمت التسوية",no:"❌ مرفوضة"};
const isAp=r=>r.st==="ok"||r.st==="set";// المعتمدة (اتسوّت أو لسه)
// العينات اللي بترجع (نوفمبر 2026): مدير التسويق وهو بيعتمد عينة بيحدد هترجع ولا لأ (rt).
// اللي طلّعها يسجّل رجوعها: الفرع لهداياه، والمستودع لهدايا المستودع ← rb = {e,n,at,q:اللي رجع, lines:[لكل صنف], note?}
// الصافي = اللي طلع − اللي رجع، والمحاسب بيسوّي الصافي بس (sa.net).
const isSample=r=>r&&r.why==="عينة";
const retQ=r=>r&&r.rb?N(r.rb.q):0;
const net=r=>Math.max(0,N(r.pcs)-retQ(r));
const waitRet=r=>!!r&&r.st==="ok"&&r.rt===true&&!r.rb;// لسه مارجعتش
const canRet=r=>waitRet(r)&&!!X&&(X.mode==="branch"?r.br===X.code:(r.br==="WH"&&!X.noNew&&!X.view));
function retHtml(r){
 if(!isAp(r))return "";
 if(r.rt===true&&!r.rb)return `<div class="gf-ret w">↩️ العينة يجب أن ترجع ${r.br==="WH"?"إلى المستودع":"إلى الفرع"} · لم ترجع بعد</div>`;
 if(r.rb)return `<div class="gf-ret ok">↩️ رجع ${N(r.rb.q)} من ${N(r.pcs)} قطعة · ${hm(r.rb.at)}${r.rb.n?" · سجّلها: <bdi>"+E(r.rb.n)+"</bdi>":""} · <b>الصافي ${net(r)} قطعة</b>${r.rb.note?"<br>"+E(r.rb.note):""}</div>`;
 if(r.rt===false&&isSample(r))return `<div class="gf-ret no">العينة لا ترجع</div>`;
 return "";
}
const ymOf=t=>new Date(N(t)).toLocaleDateString("en-CA").slice(0,7);
const D=864e5,LIVE=31;// آخر 31 يوم بيتسمعوا لايف في المستودع (كانت 90: توفير قراءات نوفمبر 2026)، والأقدم بيتحمّل وقت التقرير
let X=null,L=new Map(),LS=new Map(),PEND=new Map(),OLD=new Map(),MON=new Set(),un=[],bun=null,BL=[],img="",imgBusy=false,edit=null,PK=null;
let F={from:"",to:"",br:"",st:"",why:"",q:""};
let ACC=null,ACCL=[],MINE=new Map();// مرفقات المحاسب: صندوق الاختيار المفتوح، والصور المحمّلة للسند المفتوح
const CSS=`
.gfm{display:none;position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);overflow:auto;padding:16px}.gfm.on{display:block}
.gfk{max-width:680px;margin:3vh auto;background:var(--card);border-radius:18px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.gfk h3{margin:0 0 4px}.gfk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}.gfk input,.gfk select,.gfk textarea{width:100%}
.gfk textarea{background:var(--field);border:1.5px solid transparent;border-radius:11px;padding:10px 12px;font:inherit;color:var(--ink)}
.gf-rows{display:grid;gap:6px}.gf-row{display:grid;grid-template-columns:1.4fr 1fr .8fr .7fr auto;gap:6px;align-items:center}.gf-row input{padding:9px 8px;text-align:center}
.gf-row button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--mut)}
.gf-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.gf-2{grid-template-columns:1fr}.gf-row{grid-template-columns:1fr 1fr 1fr .8fr auto}}
.gf-up{border:2px dashed var(--line);border-radius:14px;padding:14px;text-align:center;cursor:pointer;display:block;color:var(--mut)}.gf-up.ok{border-color:#6f7d45;color:#45512a;background:#eef0e0}
.gf-up img{max-height:120px;max-width:100%;border-radius:8px;display:block;margin:8px auto 0}
.gf-act{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.gf-act>*{flex:1;min-width:120px}
.gf-card{background:var(--card);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-inline-start:6px solid #b48aab}
.gf-card.ok{border-inline-start-color:#6f7d45}.gf-card.no{border-inline-start-color:#c4362b;opacity:.85}
.gf-card h4{margin:0 0 4px;font-size:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.gf-card .m{color:var(--mut);font-size:13.5px}
.gf-st{border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700;background:#f2e5ee;color:#5f3a59}.gf-st.set{background:#dde9f7;color:#1c4f86}.gf-card.set{border-inline-start-color:#2a78d6}
.gs-acc:empty{display:none}.gs-acc{margin:14px 0 0;border:1.5px dashed var(--line);border-radius:14px;padding:12px 14px}
.gs-ah{display:flex;align-items:center;gap:8px;margin-bottom:8px}.gs-ah b{font-size:15px}.gs-ah small{color:var(--mut);font-size:12.5px}
.gs-ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:10px}
.gs-ag button{border:1px solid var(--line);background:var(--field,#f2e9dd);border-radius:12px;padding:0;overflow:hidden;cursor:zoom-in;font:inherit;color:var(--mut);text-align:center}
.gs-ag img{width:100%;aspect-ratio:1;object-fit:cover;display:block}.gs-ag .gs-pdf{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;aspect-ratio:1;font-size:30px;background:#fbf3f2}.gs-ag .gs-pdf small{font-size:11px;padding:0 6px;word-break:break-all;color:var(--ink)}.gs-ag span{display:block;font-size:11px;line-height:1.35;padding:4px 4px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gf-set{margin-top:8px;background:#eef4fb;color:#1c4f86;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.8}.gf-set small{color:#4a6a90}
/* ورقة الهدية (زي ورقة تحميل النواقص) */
.gfk:has(.gs){padding:0;overflow:hidden}.gs{margin:0;background:var(--card)}
.gs-hd{display:flex;align-items:center;gap:14px;background:#2a1d2c;border-bottom:3px solid #b48aab;padding:18px 22px;color:#fff}
.gs-hd img{width:52px;height:52px;border-radius:12px;flex:none}.gs-hd b{display:block;font-size:20px}.gs-hd small{color:#cfb1c8;font-size:13px;direction:ltr;display:block;text-align:right}
.gs-hd .gf-st{margin-inline-start:auto}
.gs-bd{padding:18px 22px 0}
.gs-rt{display:flex;align-items:stretch;gap:10px;margin-bottom:16px}.gs-rt>div{flex:1;min-width:0;border-radius:14px;padding:10px 14px;background:var(--field,#f2e9dd);border:1.5px solid var(--line)}
.gs-rt>div.to{background:#2a1d2c;color:#fff;border-color:#2a1d2c}.gs-rt small{display:block;font-size:12px;opacity:.7}.gs-rt b{display:block;font-size:17px;line-height:1.4;word-break:break-word}
.gs-rt .ar{flex:none;align-self:center;background:none;border:0;padding:0;color:#b48aab;font-size:26px;font-weight:800}
.gs-mt{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.gs-mt div{background:var(--soft,#f6eee3);border-radius:12px;padding:8px 12px}.gs-mt small{display:block;color:var(--mut);font-size:12px}.gs-mt b{font-size:15px}
.gs-tb{width:100%;border-collapse:collapse;font-size:15px}.gs-tb th{font-size:12.5px;color:var(--mut);font-weight:700;padding:8px 6px;border-bottom:2px solid #b48aab;text-align:center}
.gs-tb td{padding:10px 6px;border-bottom:1px solid var(--line);text-align:center}.gs-tb td.k{font-weight:800;font-size:17px;direction:ltr;text-align:right}.gs-tb td.q{font-weight:800;font-size:19px}.gs-tb tr:nth-child(even) td{background:rgba(180,138,171,.06)}
.gs-tb tfoot td{font-weight:800;border-bottom:0;padding-top:12px}.gs-tb .rq{color:#45512a}
.gs-nt{margin-top:12px;padding:10px 14px;border-radius:12px;background:#fff8e6;border-inline-start:4px solid #b48aab;font-size:14.5px}
.gs-tl{display:flex;gap:6px;margin:16px 0 4px;flex-wrap:wrap}.gs-tl div{flex:1;min-width:110px;border-radius:12px;padding:8px 10px;background:var(--soft,#f6eee3);font-size:12.5px;color:var(--mut);border-top:4px solid var(--line)}
.gs-tl div.on{color:var(--ink);border-top-color:#b48aab}.gs-tl div.no{border-top-color:#c4362b}.gs-tl b{display:block;font-size:14px}
.gs-ac{display:flex;gap:8px;flex-wrap:wrap;padding:14px 22px 18px;border-top:1px solid var(--line);background:var(--soft,#f6eee3);margin:12px -22px 0}
.gs-ac .bt{flex:1;min-width:120px}
.gf-card h4{cursor:pointer}
.gfc{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:center;background:var(--card);border:1px solid var(--line);border-inline-start:5px solid #b48aab;border-radius:16px;padding:12px 14px;margin-bottom:10px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:transform .15s ease,box-shadow .15s ease}
.gfc:hover{box-shadow:0 6px 16px rgba(42,29,44,.12)}.gfc:active{transform:scale(.99)}
.gfc.ok{border-inline-start-color:#6f7d45}.gfc.set{border-inline-start-color:#2a78d6}.gfc.no{border-inline-start-color:#c4362b}.gfc.pend{border-inline-start-color:#e8a317}
.gfc{color:var(--ink);text-align:start;width:auto;max-width:none}.gfc-ic{width:42px;height:42px;border-radius:13px;background:rgba(138,90,131,.12);color:var(--acc,#8a5a83);display:grid;place-items:center}.gfc-ic svg{width:22px;height:22px;display:block}
.gfc-m{min-width:0}.gfc-m b{display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfc-m small{display:block;color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gfc-m .gfc-rj{color:#c4362b;white-space:normal}
.gfc-e{text-align:end}.gfc-e b{font-size:20px;font-variant-numeric:tabular-nums;display:block;line-height:1.2}.gfc-e b small{font-size:12px;color:var(--mut);font-weight:500}
.gfc-st{display:inline-block;margin-top:4px;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:#f2e5ee;color:#5f3a59}
.gfc.ok .gfc-st{background:#e5ecd0;color:#45512a}.gfc.set .gfc-st{background:#dde9f7;color:#1c4f86}.gfc.no .gfc-st{background:#fbe3e0;color:#a2271d}.gfc.pend .gfc-st{background:#fdf0cf;color:#7a5200}
.gfc-ret{grid-column:1/-1;font:inherit;font-weight:700;font-size:14px;border:0;border-radius:11px;padding:9px;background:#6f7d45;color:#fff;cursor:pointer}
:where([data-theme=dark]) .gfc-st{background:#3d2b40;color:#e3c8dd}:where([data-theme=dark]) .gfc.ok .gfc-st{background:#2a301b;color:#b9c68a}:where([data-theme=dark]) .gfc.set .gfc-st{background:#1c2d44;color:#9cc2ee}:where([data-theme=dark]) .gfc.no .gfc-st{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .gfc.pend .gfc-st{background:#3a2d0f;color:#f0cf7a}
@media (max-width:560px){.gs-mt{grid-template-columns:1fr 1fr}.gs-bd{padding:14px 14px 0}.gs-ac{margin:12px -14px 0;padding:12px 14px 16px}.gs-ac .bt{min-width:calc(50% - 4px)}.gs-hd{padding:14px}.gs-rt b{font-size:15px}.gs-tb{font-size:14px}.gs-tb td.k{font-size:15px}}
:where([data-theme=dark]) .gs-nt{background:#2b2210}:where([data-theme=dark]) .gs-rt>div.to{background:#000}
.gf-ret{margin-top:8px;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.8;background:#f3efe6;color:#4e2f4a}.gf-ret.w{background:#fff1d6;color:#8a5a00;font-weight:700}.gf-ret.ok{background:#e7f4ec;color:#45512a}.gf-ret.no{background:#f1f1f1;color:#666}
.gf-rt{display:grid;gap:10px;margin-top:14px}.gf-rt button{font:inherit;font-weight:800;font-size:16px;border-radius:14px;padding:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;text-align:start}.gf-rt button small{display:block;font-weight:400;color:var(--mut);font-size:13px;margin-top:2px}.gf-rt button.y{border-color:#b48aab;background:#fff8e6}
.gf-rr{display:grid;grid-template-columns:1fr 90px 100px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)}.gf-rr input{text-align:center;padding:9px 6px}
:where([data-theme=dark]) .gf-ret{background:#2a261d;color:#e3c8dd}:where([data-theme=dark]) .gf-ret.w{background:#3a2a08;color:#f6c770}:where([data-theme=dark]) .gf-ret.ok{background:#2a301b;color:#b9c68a}:where([data-theme=dark]) .gf-ret.no{background:#262626;color:#aaa}:where([data-theme=dark]) .gf-rt button.y{background:#3d2b40}
.gf-ref{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}.gf-ref input{flex:1;min-width:180px}
.gf-acc{background:#eef4fb;border:1px solid #9fc0e6;border-radius:16px;padding:12px 14px;margin-bottom:14px}
:where([data-theme=dark]) .gf-st.set,:where([data-theme=dark]) .gf-set,:where([data-theme=dark]) .gf-acc{background:#14243a;color:#9cc4f0;border-color:#2a4a70}.gf-st.ok{background:#e3e7cf;color:#45512a}.gf-st.no{background:#f8d9d5;color:#8a2218}
.gf-it{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.gf-it span{background:var(--soft);border-radius:9px;padding:3px 9px;font-size:13.5px}
.gf-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.gf-b .bt,.gf-b button{width:auto}
/* شريط الفلاتر (نوفمبر 2026): كان flex بيلف بشكل عشوائي (فلاتر فوق وتحت وفي النص). دلوقتي شبكة ثابتة: 4 فلاتر + الأزرار في سطر على الكمبيوتر، وعمودين على التابلت والموبايل والأزرار سطر كامل */
.gf-lh{margin:18px 0 10px;font-size:17px}
.gf-f{display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) auto;gap:10px;align-items:end;margin:0 0 12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.gf-f>div{display:flex;flex-direction:column;gap:4px;min-width:0}.gf-f small{color:var(--mut);font-size:12px;font-weight:700}
.gf-f input,.gf-f select{width:100%;height:44px;margin:0}
.gf-f .gf-act{flex-direction:row;gap:8px}.gf-f .gf-act .bt{height:44px;white-space:nowrap;margin:0}
@media (max-width:980px){.gf-f{grid-template-columns:repeat(2,minmax(0,1fr))}.gf-f .gf-act{grid-column:1/-1}.gf-f .gf-act .bt{flex:1}}
.gf-sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.gf-sum span{background:var(--card);border-radius:999px;padding:7px 14px;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.gf-pend{background:#fff7e6;border:1px solid #dcbcd4;border-radius:16px;padding:12px 14px;margin-bottom:14px}
#gfbtn{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 14px;padding:14px 18px;border:0;border-radius:18px;cursor:pointer;font:inherit;text-align:start;color:#2a1d2c;
 background:linear-gradient(120deg,#f1e0ec 0%,#d8b4cf 55%,#b48aab 100%);box-shadow:0 8px 22px rgba(138,90,131,.28);position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s;animation:ui-fade .35s ease both}
#gfbtn:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(138,90,131,.35)}#gfbtn:active{transform:scale(.99)}
#gfbtn::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);animation:gf-shine 4.5s ease-in-out infinite}
@keyframes gf-shine{0%,70%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
#gfbtn .ic{width:58px;height:58px;border-radius:16px;background:rgba(255,255,255,.55);display:grid;place-items:center;font-size:32px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
#gfbtn .tx{flex:1;min-width:0}#gfbtn .tx b{display:block;font-size:19px;font-weight:800}#gfbtn .tx small{display:block;font-size:13.5px;color:#3e2740;margin-top:2px}
#gfbtn .bd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#gfbtn .bd span{background:rgba(27,27,27,.85);color:#f1e4ee;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:700}
#gfbtn .ar{font-size:24px;font-weight:800;flex:none;opacity:.7}html[dir="rtl"] #gfbtn .ar{transform:scaleX(-1)}
/* (13 نوفمبر 2026) محمد رجّع كارت الهدايا الذهبي الأصلي (كان أحلى من الأبيض) */
.gf-hero{display:flex;align-items:center;gap:14px;margin:-20px -22px 14px;padding:18px 22px;border-radius:18px 18px 0 0;background:linear-gradient(120deg,#2d2131,#2a1d2c);color:#f1e4ee}
.gf-hero .ic{font-size:40px}.gf-hero h3{margin:0;font-size:21px;color:#fff}.gf-hero p{margin:3px 0 0;font-size:13.5px;color:#cfb1c8;line-height:1.7}
.gf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px}.gf-stats div{background:var(--soft);border-radius:14px;padding:10px;text-align:center}.gf-stats b{display:block;font-size:22px}.gf-stats small{color:var(--mut);font-size:12.5px}
.gf-new{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;font:inherit;font-size:17px;font-weight:800;border:0;border-radius:14px;padding:15px;background:#2a1d2c;color:#fff;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.18)}
:where([data-theme=dark]) #gfbtn{color:#2a1d2c}
:where([data-theme=dark]) .gf-st{background:#3d2b40;color:#e3c8dd}:where([data-theme=dark]) .gf-st.ok{background:#2a301b;color:#b9c68a}:where([data-theme=dark]) .gf-st.no{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .gf-up.ok{background:#2a301b;color:#b9c68a}:where([data-theme=dark]) .gf-pend{background:#2b2210;border-color:#5f3a59}
#gfm .bt{font:inherit;font-weight:700;border-radius:12px;padding:10px 16px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}#gfm .bt.s{padding:6px 12px;font-size:13.5px}
#gfm .bt.p{background:#2a1d2c;border-color:#2a1d2c;color:#fff}#gfm .bt.g{background:#b48aab;border-color:#b48aab;color:#2a1d2c}#gfm .bt.r{color:#c4362b;border-color:#c4362b}#gfm .bt:disabled{opacity:.6}
@media print{.gfm{display:none!important}}
/* ===== التصميم الخامس (17 نوفمبر 2026): هدايا | عينات، وكل نوع بمراحله ===== */
.g5 [hidden],.gfk [hidden]{display:none!important}
.g5-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}
.g5-seg{display:flex;gap:4px;flex:1 1 380px;min-width:0;max-width:540px;background:var(--soft,#f6eee3);border-radius:18px;padding:5px}
.g5-seg button{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:11px;font:inherit;text-align:start;color:var(--mut);background:none;border:0;border-radius:14px;padding:9px 14px;cursor:pointer;position:relative;transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out),box-shadow var(--duration-quick) var(--ease-out)}
.g5-seg button:hover{color:var(--ink)}
.g5-seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.07),0 6px 16px rgba(42,29,44,.08)}
.g5-seg .ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none;background:rgba(138,90,131,.1);color:var(--acc,#8a5a83);transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out)}
.g5-seg .ic svg{width:21px;height:21px;display:block}
.g5-seg button.on .ic{background:var(--acc,#8a5a83);color:#fff}
.g5-seg .tx{min-width:0;flex:1}.g5-seg b{display:block;font-size:16.5px;line-height:1.3}
.g5-seg small{display:block;font-size:12.5px;line-height:1.4;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.g5-seg button.has small{color:#a2271d;font-weight:700}
.g5-seg.sm{flex:none;max-width:none;margin:14px 0 2px;border-radius:15px;padding:4px}.g5-seg.sm button{padding:7px 10px;border-radius:11px}.g5-seg.sm .ic{width:32px;height:32px;border-radius:10px}.g5-seg.sm .ic svg{width:18px;height:18px}.g5-seg.sm b{font-size:15px}.g5-seg.sm small{font-size:12px}
.g5-note{background:var(--soft,#f6eee3);border-radius:11px;padding:10px 12px;font-size:13.5px;line-height:1.7;color:var(--mut)}
.g5-new{width:auto!important;margin:0!important;margin-inline-start:auto!important;white-space:nowrap;flex:none}
.g5-card{background:var(--card);border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.g5-tabs{display:flex;gap:2px;padding:0 10px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}.g5-tabs::-webkit-scrollbar{display:none}
.g5-tabs button{font:inherit;font-weight:700;font-size:14.5px;color:var(--mut);background:none;border:0;border-bottom:3px solid transparent;padding:14px 12px 11px;margin-bottom:-1px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;transition:color var(--duration-quick) var(--ease-out),border-color var(--duration-quick) var(--ease-out)}
.g5-tabs button:hover{color:var(--ink)}.g5-tabs button.on{color:var(--ink);border-bottom-color:var(--acc,#8a5a83)}
.g5-tabs i{font-style:normal;font-size:12px;font-weight:800;min-width:22px;text-align:center;border-radius:999px;padding:1px 7px;background:var(--soft,#f6eee3);color:var(--mut);font-variant-numeric:tabular-nums}
.g5-tabs button.mine i{background:#c4362b;color:#fff}.g5-tabs i.z{opacity:.55}
.g5-body{padding:14px 16px 16px}
.g5-body.swap{animation:g5-in var(--duration-fast,250ms) var(--ease-smooth-out,ease-out) both}
@keyframes g5-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.g5-hint{display:flex;gap:14px;align-items:baseline;justify-content:space-between;color:var(--mut);font-size:13.5px;line-height:1.7;margin:0 2px 6px}
.g5-hint b{color:var(--olive-t,#3f4a22);background:var(--olive-s,#e9ecd9);border-radius:999px;padding:1px 10px;white-space:nowrap;font-size:12.5px}
.g5-row{display:flex;align-items:center;gap:12px;padding:12px 6px;cursor:pointer;transition:background-color var(--duration-quick) var(--ease-out)}
.g5-row:hover{background:rgba(180,138,171,.07)}.g5-row+.g5-row{border-top:1px solid var(--line)}
.g5-av{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none;font-weight:800;font-size:13.5px;background:#2a1d2c;color:#e3c8dd;letter-spacing:.5px}.g5-av.wh{background:var(--soft,#f6eee3);font-size:19px}
.g5-mid{flex:1;min-width:0}.g5-mid>b{display:block;font-size:15.5px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g5-mid>small{display:block;color:var(--mut);font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g5-why{color:var(--ink);font-weight:700}
.g5-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.g5-end .g5-tags{justify-content:flex-end}
.g5-tag{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap;background:var(--soft,#f6eee3);color:var(--mut)}
.g5-tag.w{background:#fff1d6;color:#8a5a00}.g5-tag.ok{background:#e5ecd0;color:#45512a}.g5-tag.b{background:#e3eefb;color:#1c4f86}.g5-tag.r{background:#fbe3e0;color:#9b2a1f}.g5-tag.me{background:#f2e5ee;color:#5f3a59}
.g5-rp{white-space:normal;max-width:100%}
.g5-end{text-align:end;flex:none}.g5-end>b{font-size:19px;display:block;line-height:1.15;font-variant-numeric:tabular-nums}.g5-end>b small{font-size:12px;color:var(--mut);font-weight:400}
.g5-at{flex:none;font-size:12.5px;font-weight:700;color:var(--mut);border:1.5px dashed var(--line);border-radius:999px;padding:3px 11px;white-space:nowrap}
.g5-act{display:flex;gap:6px;align-items:center;flex:none;cursor:default}.g5-act .bt{width:auto;margin:0;white-space:nowrap}.g5-act input{width:150px;height:36px;padding:5px 10px;margin:0}
.g5-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
.g5-per{display:flex;gap:6px;flex-wrap:wrap}.g5-per button{font:inherit;font-size:13.5px;font-weight:700;border:1.5px solid var(--line);background:none;color:var(--mut);border-radius:999px;padding:6px 14px;cursor:pointer;transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out),border-color var(--duration-quick) var(--ease-out)}
.g5-per button.on{background:#2a1d2c;border-color:#2a1d2c;color:#fff}
.g5-exp{display:flex;gap:6px;margin-inline-start:auto}.g5-exp .bt{width:auto;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:40px;min-height:36px}
.g5-sum{display:flex;gap:8px 18px;align-items:center;flex-wrap:wrap;background:var(--soft,#f6eee3);border-radius:14px;padding:10px 14px;margin:0 0 12px;font-size:14px;color:var(--mut)}
.g5-sum span b{color:var(--ink);font-size:18px;font-variant-numeric:tabular-nums;margin-inline-end:3px}
.g5-lnk{margin-inline-start:auto;border:0;background:none;color:var(--acc,#8a5a83);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;padding:2px 0}
.g5-sumd{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:-4px 0 14px;padding:4px 14px 10px;animation:g5-in var(--duration-fast,250ms) var(--ease-smooth-out,ease-out) both}.g5-sumd.one{grid-template-columns:1fr}
.g5-sumd h4{margin:6px 0 4px;color:var(--mut);font-size:13px}
.g5-bar{display:grid;grid-template-columns:minmax(80px,150px) 1fr auto;gap:10px;align-items:center;margin:7px 0;font-size:14px}.g5-bar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g5-bar i{height:8px;border-radius:6px;background:var(--soft,#f6eee3);overflow:hidden}.g5-bar u{display:block;height:100%;border-radius:6px;background:var(--acc,#8a5a83);opacity:.75}
.g5-bar em{font-style:normal;font-weight:800;font-variant-numeric:tabular-nums}
.g5-find{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 4px}
.g5-search{flex:1 1 240px;min-width:0;display:flex;align-items:center;gap:8px;background:var(--field,#f2e9dd);border-radius:999px;padding:0 14px;border:1.5px solid transparent;transition:border-color var(--duration-quick) var(--ease-out)}.g5-search:focus-within{border-color:#b48aab}
.g5-search input{border:0!important;background:none!important;height:40px;flex:1;min-width:0;width:100%;margin:0;padding:0;outline:none;box-shadow:none!important}
.g5-fc{display:inline-flex;align-items:center;gap:4px;height:40px;padding:0 6px 0 12px;margin:0;border-radius:999px;background:var(--soft,#f6eee3);border:1.5px solid transparent;color:var(--ink);max-width:100%;transition:background-color var(--duration-quick) var(--ease-out),border-color var(--duration-quick) var(--ease-out)}
.g5-fc.on{background:#f2e5ee;border-color:#b48aab}
.g5-fc select,.g5-fc input{border:0!important;background:none!important;box-shadow:none!important;height:36px!important;padding:0 4px!important;margin:0!important;font:inherit;font-size:13.5px;font-weight:700;color:var(--ink);outline:none;width:auto;min-width:0;line-height:36px;-webkit-appearance:none;appearance:none;cursor:pointer}
.g5-fc select{padding-inline-end:18px!important;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238a8478'/%3E%3C/svg%3E") no-repeat left 4px center!important}
.g5-fc input[type=date]{width:128px}.g5-fc .fa{color:var(--mut);font-weight:800}
.g5-fc .fx{border:0;background:rgba(0,0,0,.08);width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:10px;color:var(--ink);flex:none}
.g5-mine{font:inherit;font-size:13.5px;font-weight:700;height:40px;border-radius:999px;padding:0 14px;border:1.5px solid var(--acc,#8a5a83);background:none;color:var(--acc,#8a5a83);cursor:pointer;white-space:nowrap;transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out)}.g5-mine.on{background:var(--acc,#8a5a83);color:#fff}
.g5-mine i{font-style:normal;background:#c4362b;color:#fff;border-radius:999px;font-size:11.5px;padding:0 6px;margin-inline-start:4px}
.g5-fclr{border:0;background:none;color:#c4362b;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;padding:0 4px}
.g5-minehint{margin:8px 0 2px;font-size:13px;color:var(--mut);background:var(--soft,#f6eee3);border-radius:10px;padding:8px 12px}
.g5-cnt{color:var(--mut);font-size:12.5px;font-weight:700;margin:10px 4px 0}
.g5-day{font-size:12.5px;font-weight:800;color:var(--mut);margin:14px 4px 2px;display:flex;align-items:center;gap:10px}.g5-day::after{content:"";flex:1;height:1px;background:var(--line)}
.g5-day+.g5-row{border-top:0}
.g5-more{display:block;width:100%;margin-top:10px;font:inherit;font-weight:700;border:1.5px dashed var(--line);background:none;color:var(--ink);border-radius:14px;padding:11px;cursor:pointer}
.g5-empty{text-align:center;color:var(--mut);padding:30px 10px 22px;font-size:15px}.g5-empty span{display:block;font-size:36px;margin-bottom:6px}
.g5.anim .g5-row{animation:g5-in var(--duration-medium,350ms) var(--ease-smooth-out,ease-out) both;animation-delay:calc(var(--i,0)*30ms)}
html.lite .g5 *{animation:none!important}
@media (prefers-reduced-motion:reduce){.g5 *{animation:none!important}}
.gs-rep{background:#fdecea;color:#8a2218;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:13.5px;line-height:1.8}.gs-rep b{display:block;font-size:14.5px}
.gs-set{display:flex;gap:8px;flex-wrap:wrap;align-items:center;width:100%;padding:10px;border-radius:14px;background:#eef4fb;margin-bottom:4px}.gs-set input{flex:1;min-width:160px;margin:0}.gs-set .bt{flex:none!important;min-width:0!important}
@media (max-width:640px){
 .g5-seg{flex:1 1 100%;max-width:none}.g5-new{flex:1 1 100%;margin-inline-start:0!important}
 .g5-seg button{padding:8px 10px;gap:9px}.g5-seg .ic{width:34px;height:34px}.g5-seg b{font-size:15.5px}
 .g5-body{padding:12px 12px 14px}.g5-tabs{padding:0 6px}.g5-tabs button{padding:13px 9px 10px;font-size:14px}
 .g5-row{gap:10px}.g5-row.q{flex-wrap:wrap}.g5-end{max-width:46%}.g5-av{width:38px;height:38px;font-size:12.5px}
 .g5-act{flex:1 1 100%;padding-inline-start:48px}.g5-act input{flex:1;min-width:0;width:auto}.g5-act .bt{flex:none}
 .g5-at{margin-inline-start:48px}
 .g5-tools{flex-wrap:nowrap}.g5-per{flex:1;min-width:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:1px}.g5-per::-webkit-scrollbar{display:none}.g5-per button{flex:none;padding:6px 12px}
 .g5-exp{flex:none}.g5-exp .tx{display:none}.g5-sumd{grid-template-columns:1fr;padding:4px 4px 10px}
 .g5-fc{flex:1 1 calc(50% - 4px);min-width:0}.g5-fc select{flex:1;width:100%;min-width:0;text-overflow:ellipsis}.g5-fc input[type=date]{flex:1;width:auto}.g5-hint{flex-direction:column;gap:6px}
}

 :where([data-theme=dark]) .g5-seg .ic{background:rgba(180,138,171,.16);color:#d8b4cf}:where([data-theme=dark]) .g5-seg button.on .ic{background:#b48aab;color:#2a1d2c}:where([data-theme=dark]) .g5-seg button.has small{color:#f1a5a0}
 :where([data-theme=dark]) .g5-tag.w{background:#3a2a08;color:#f6c770}:where([data-theme=dark]) .g5-tag.ok{background:#2a301b;color:#b9c68a}:where([data-theme=dark]) .g5-tag.b{background:#14243a;color:#9cc4f0}:where([data-theme=dark]) .g5-tag.r{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .g5-tag.me{background:#3d2b40;color:#e3c8dd}
 :where([data-theme=dark]) .g5-per button.on{background:#b48aab;border-color:#b48aab;color:#2a1d2c}:where([data-theme=dark]) .g5-fc.on{background:#3d2b40}:where([data-theme=dark]) .g5-fc .fx{background:rgba(255,255,255,.14)}
 :where([data-theme=dark]) .g5-mine{border-color:#b48aab;color:#d8b4cf}:where([data-theme=dark]) .g5-mine.on{background:#b48aab;color:#2a1d2c}:where([data-theme=dark]) .g5-lnk{color:#d8b4cf}:where([data-theme=dark]) .g5-bar u{background:#b48aab}
 :where([data-theme=dark]) .gs-rep{background:#40191a;color:#f1a5a0}:where([data-theme=dark]) .gs-set{background:#14243a}

`;
const all=()=>{const m=new Map([...OLD,...MINE,...L,...LS,...PEND]);return [...m.values()]};
// ✏️ (15 نوفمبر 2026) "سجّلتها أنا": اللي سجّل الهدية يلاقيها بسرعة ويعدّلها طول ما هي لسه بانتظار الاعتماد (القواعد بتسمح بده بس)
const byMe=r=>!!r&&String(r.by&&r.by.e||"").toLowerCase()===meE();
const canEditMine=r=>!!X&&!X.view&&!!r&&r.st==="pend"&&byMe(r)&&(X.mode==="branch"?r.br===X.code:(r.br==="WH"&&!X.noNew));
const hm=t=>new Date(N(t)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const brName=c=>c==="WH"?"المستودع":((X&&X.branches||[]).find(b=>String(b).split("-")[0]===c)||c);
const itemsTxt=r=>(Array.isArray(r.rows)?r.rows:[]).map(x=>[x.k,x.c,x.z].filter(Boolean).join(" ")+" × "+N(x.q)).join(" · ");
const canApprove=()=>!!(X&&X.approver);
const canSettle=()=>!!(X&&X.settler);// المحاسب (والمديرين)
const accOnly=()=>!!(X&&X.acc);// المحاسب بس: يشوف المعتمد بس
const isOwner=()=>!!(X&&X.owner&&X.owner());
// ---------- البداية ----------
// ctx: {db,toast,ping(ids),mode:"wh"|"branch",me:{e,n},approver,acc,view,owner(),branches,redraw,tab, code,brn (للفرع)}
export function initGifts(ctx){
 stopGifts();X=ctx;
 if(!g("gf-css")){const s=document.createElement("style");s.id="gf-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(ctx.mode==="branch"){initZoom({db:ctx.db,toast:ctx.toast,owner:()=>false});addBranchButton()}
 else{
  const draw=()=>{if(X&&X.tab()==="gift")X.redraw();else if(X&&X.badge)X.badge();liveView()};
  if(canApprove())un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","pend")),sn=>{PEND=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
  const err=()=>X.toast("تعذر قراءة الهدايا. تأكد من نشر القواعد (Rules) الجديدة");
  if(accOnly()){
   // المحاسب: المعتمد اللي مستني تسوية + اللي اتسوّى الشهر ده (القواعد مش بتسمحله يشوف غير المعتمد)
   const cm=ymOf(Date.now());MON.add(cm);
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","ok")),sn=>{L=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","set"),where("sm","==",cm)),sn=>{LS=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
  }
  else{
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("ts",">=",Date.now()-LIVE*D)),sn=>{L=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
   // المعتمد اللي لسه ماتسوّاش (والعينات اللي مستنية ترجع) مهما كان قديم، علشان مايختفيش لما الفترة اللايف بقت شهر
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","ok")),sn=>{LS=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
  }
  // اللي بيسجّل هدايا (المديرين وصلاحية الطلبات): هداياه هو بتفضل ظاهرة له مهما كانت قديمة، علشان يتابعها ويعدّلها (والمحاسب منهم بيشوف دي بس + المعتمد)
  if(!X.noNew&&!X.view&&meE())un.push(onSnapshot(query(collection(X.db,"gifts"),where("by.e","==",meE())),sn=>{MINE=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
 }
 if(!window.__gfc){window.__gfc=1;document.addEventListener("click",click);document.addEventListener("change",change);document.addEventListener("input",input)}
}
export function stopGifts(){un.forEach(f=>f());un=[];KIND="";KINDu=false;SEC="";SECu=false;ANIM=true;SHOWN=30;SUMOPEN=false;if(bun){bun();bun=null}BL=[];{const b=g("gfbtn");if(b)b.remove()}L=new Map();LS=new Map();PEND=new Map();OLD=new Map();MINE=new Map();MON=new Set();F.mine=false;closeM()}
export const pendingCount=()=>PEND.size;
// للتقرير الأسبوعي (short.js): الهدايا من تاريخ معيّن، والصافي
export const giftsSince=t=>all().filter(r=>N(r.ts)>=t);
export const giftNet=r=>net(r);
// ---------- الفرع: زرار فوق + نافذة فيها هداياه ----------
function addBranchButton(){
 if(g("gfbtn"))return;const me=g("me");if(!me)return;
 const b=document.createElement("button");b.id="gfbtn";b.type="button";b.dataset.gf="bopen";
 me.parentNode.insertBefore(b,me.nextSibling);paintBtn();
 if(!bun)bun=onSnapshot(query(collection(X.db,"gifts"),where("br","==",X.code)),sn=>{BL=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>N(b.ts)-N(a.ts));paintBtn();if(g("gfm")&&g("gfm").dataset.v==="list")paintBranch();liveView()},e=>{});
}
function paintBtn(){
 const b=g("gfbtn");if(!b)return;const rw=BL.filter(waitRet).length,p=BL.filter(r=>r.st==="pend").length,no=BL.filter(r=>r.st==="no"&&N(r.ap&&r.ap.at)>Date.now()-7*D).length;
 b.innerHTML=`<span class="ic">🎁</span><span class="tx"><b>الهدايا والعينات</b><small>سجّل أي هدية أو عينة خرجت من الفرع لعميل</small>${p||no||rw?`<span class="bd">${p?`<span>⏳ ${p} بانتظار الاعتماد</span>`:""}${no?`<span>❌ ${no} مرفوضة</span>`:""}${rw?`<span>↩️ ${rw} عينة لم ترجع</span>`:""}</span>`:""}</span><span class="ar">➜</span>`;
}
function openBranch(){paintBranch()}
function paintBranch(){
 const c=k=>BL.filter(r=>r.st===k).length;
 openM(`<div class="gf-hero"><span class="ic">🎁</span><div><h3>الهدايا والعينات</h3><p>أي هدية أو عينة تخرج من الفرع يجب تسجيلها هنا (ويمكنك إرفاق صورة السند)، ويعتمدها مدير التسويق.</p></div></div>
 <div class="gf-stats"><div><b>${c("pend")}</b><small>⏳ بانتظار الاعتماد</small></div><div><b>${c("ok")+c("set")}</b><small>✅ معتمدة</small></div><div><b>${c("no")}</b><small>❌ مرفوضة</small></div></div>
 <button class="gf-new" data-gf="new" type="button">➕ تسجيل هدية / عينة جديدة</button>
 <div style="margin-top:14px">${BL.length?BL.slice(0,40).map(r=>card(r)).join(""):'<div class="m" style="text-align:center;padding:20px;color:var(--mut)">لا توجد هدايا مسجّلة بعد</div>'}</div>
 <div class="gf-act"><button class="b" data-gf="close" type="button">إغلاق</button></div>`,"list");
}
// ---------- الكارت ----------
function card(r){// (16 نوفمبر 2026، طلب محمد) كارت هادي زي كروت الطلبات: المستلم والسبب والعدد والحالة بس، والتفاصيل في السند اللي بيتفتح بالضغط
 const st=r.st||"pend",ap=r.ap||{};
 const lab={pend:["⏳","بانتظار الاعتماد"],ok:["✅","معتمدة"],set:["🧾","تمت التسوية"],no:["❌","مرفوضة"]}[st]||["",st];
 return `<div class="gfc ${st}" data-gf="view" data-id="${E(r.id)}" role="button" tabindex="0">
 <span class="gfc-ic" data-noico>${KIC[kindOf(r)]}</span>
 <div class="gfc-m"><b>${E(r.to&&r.to.n||"")}</b><small>🏷 ${E(r.why||"")} · <bdi dir="ltr">${E(r.dt||"")}</bdi></small>${st==="no"&&ap.note?`<small class="gfc-rj">سبب الرفض: ${E(ap.note)}</small>`:""}</div>
 <div class="gfc-e"><b>${r.rb?net(r):N(r.pcs)}<small> قطعة</small></b><span class="gfc-st">${lab[0]} ${lab[1]}</span></div>
 ${canRet(r)?`<button class="gfc-ret" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}</div>`;
}
// ---------- تبويب المستودع (التصميم الخامس، 17 نوفمبر 2026، طلب محمد: "افصل بين الهدية والعينة، وشكل سلس بدل الزحمة") ----------
//   1) مفتاح فوق: 🎁 الهدايا | 🧪 العينات. كل نوع لوحده تماماً (القوايم والأرقام والتقارير). العينة = السبب "عينة"، وأي سبب تاني = هدية.
//   2) تحته مراحل النوع كتبويبات: بانتظار الاعتماد ← (العينات: لم ترجع بعد) ← بانتظار التسوية ← السجل.
//   3) كل مرحلة = سطور هادية، والإجراء في آخر السطر للي يخصّه بس؛ والباقي بيشوف "عند مين".
//   4) الفترة والبحث والفلاتر والملخّص والتقارير (PDF/إكسل) في «السجل» بس، والتقرير بيطلع للنوع المفتوح.
const GWHY=WHY.filter(w=>w!=="عينة");
let KIND="",KINDu=false,SEC="",SECu=false,PER="m0",SHOWN=30,SUMOPEN=false,ANIM=true,SWAP=false,_A=null,FK="g";
const A=()=>_A||all();
const kindOf=r=>isSample(r)?"s":"g";
const kOk=r=>kindOf(r)===(KIND||"g");
const noun=()=>KIND==="s"?"عينة":"هدية";
const whyOk=r=>KIND==="s"||!F.why||(F.why==="أخرى"?(r.why==="أخرى"||!WHY.includes(r.why)):r.why===F.why);
const brOk=r=>!F.br||r.br===F.br;
const sText=r=>[r.no,r.brn,r.to&&r.to.n,r.to&&r.to.ph,r.why,r.note,r.by&&r.by.n,...(Array.isArray(r.rows)?r.rows.map(x=>[x.k,x.c,x.z].join(" ")):[])].filter(Boolean).join(" ").toLowerCase();
const sOk=r=>!F.q||sText(r).includes(F.q.toLowerCase());
const ymd=d=>d.toLocaleDateString("en-CA");
function setPer(p){
 PER=p;const n=new Date(),y=n.getFullYear(),m=n.getMonth();
 if(p==="m0"){F.from=ymd(new Date(y,m,1));F.to=today()}
 else if(p==="m1"){F.from=ymd(new Date(y,m-1,1));F.to=ymd(new Date(y,m,0))}
 else if(p==="m3"){F.from=ymd(new Date(y,m-2,1));F.to=today()}
}
const inPer=r=>{const a=F.from?new Date(F.from+"T00:00:00").getTime():0,b=F.to?new Date(F.to+"T23:59:59").getTime():Infinity;return N(r.ts)>=a&&N(r.ts)<=b};
// السجل (وهو نفسه اللي بيطلع في التقرير): النوع المفتوح + الفترة (أو "ما سجّلتُه") + الفلاتر
function filtered(){
 return A().filter(r=>kOk(r)&&(F.mine?byMe(r):inPer(r))&&brOk(r)&&whyOk(r)&&(!F.st||(F.st==="ret"?waitRet(r):r.st===F.st))).sort((x,y)=>N(y.ts)-N(x.ts));
}
const tShort=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const isToday=t=>N(t)&&new Date(N(t)).toDateString()===new Date().toDateString();
const meE=()=>String(X&&X.me&&X.me.e||"").toLowerCase();
// 🔁 (12 نوفمبر 2026) المستلم المتكرر: نفس رقم الجوال (آخر 9 أرقام) أخد هدايا تانية في 30 يوم (من أي فرع، غير المرفوض).
// ولو مفيش جوال: نفس الاسم بالظبط في نفس الفرع. بيظهر لمدير التسويق وهو بيعتمد، وفي السجل والسند.
const phK=p=>{const d=toEn(String(p||"")).replace(/\D/g,"");return d.length>=8?d.slice(-9):""};
const nmK=n=>String(n||"").replace(/\s+/g," ").trim().toLowerCase();
function repOf(r){
 if(!r||!r.to)return null;const k=phK(r.to.ph),nk=nmK(r.to.n),t=N(r.ts),W=30*864e5;
 if(!k&&!nk)return null;
 const L=A().filter(x=>x.id!==r.id&&x.st!=="no"&&Math.abs(N(x.ts)-t)<=W&&x.to&&(k?phK(x.to.ph)===k:(x.br===r.br&&!phK(x.to.ph)&&nmK(x.to.n)===nk)));
 return L.length?{n:L.length,p:L.reduce((a,x)=>a+net(x),0),by:k?"ph":"nm",brs:[...new Set(L.map(x=>x.brn||brName(x.br)))]}:null;
}
const repTag=r=>{const x=repOf(r);return x?`<span class="g5-tag r g5-rp" title="${E((x.by==="ph"?"الجوال نفسه":"الاسم نفسه")+" استلم "+(x.n===1?"هدية أخرى":x.n===2?"هديتين أخريين":x.n+" هدايا أخرى")+" خلال 30 يوماً"+(x.p?" ("+x.p+" قطعة)":"")+" · "+x.brs.join("، "))}">🔁 ${x.by==="ph"?"الجوال":"الاسم"} مكرّر ×${x.n+1} في 30 يوماً</span>`:""};
const av=r=>r.br==="WH"?`<span class="g5-av wh">🏭</span>`:`<span class="g5-av">${E(String(r.br||"").slice(0,3))}</span>`;
const dayKey=t=>new Date(N(t)).toDateString();
function dayLbl(t){const d=new Date(N(t)),n=new Date(),y=new Date(Date.now()-864e5);if(d.toDateString()===n.toDateString())return "اليوم";if(d.toDateString()===y.toDateString())return "أمس";
 return d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"})}
// أيقونتا المفتاح (مرسومتان هنا: 🧪 ليست في icons.js، والاتنين لازم يبقوا بنفس الشكل)
const KIC={g:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5M12 8C10.8 4.6 6.5 4.4 6.5 6.6 6.5 8 9.5 8 12 8zm0 0c1.2-3.4 5.5-3.6 5.5-1.4C17.5 8 14.5 8 12 8z"/></svg>',
 s:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6M10.5 3.5v5.3L5.3 17.6a2 2 0 0 0 1.7 3h10a2 2 0 0 0 1.7-3l-5.2-8.8V3.5M7.7 14.5h8.6"/></svg>'};
// المراحل: f = مين فيها، t0 = من إمتى (الأقدم أولاً)، mine = هل الإجراء عندي، done = سجل الإجراء (لعدّاد "أنجزت اليوم")
const SD={
 ap:{ic:"⏳",t:"بانتظار الاعتماد",at:()=>"عند مدير التسويق",f:r=>r.st==="pend",t0:r=>N(r.ts),mine:()=>canApprove(),done:r=>r.ap,
  hint:()=>canApprove()?"الأقدم أولاً. اعتمد أو ارفض من هنا، أو اضغط على السطر لترى السند كاملاً.":"هذه بانتظار اعتماد مدير التسويق. اضغط على السطر لترى السند."},
 ret:{ic:"↩️",t:"لم ترجع بعد",at:r=>r.br==="WH"?"عند المستودع":"عند الفرع",f:waitRet,t0:r=>N(r.ap&&r.ap.at),mine:r=>canRet(r),done:r=>r.rb,
  hint:()=>"عينات معتمدة يجب أن ترجع. من أخرجها يسجّل رجوعها (الفرع لعيناته، والمستودع لعينات المستودع)، ثم تُسوّى بالصافي فقط."},
 set:{ic:"🧾",t:"بانتظار التسوية",at:()=>"عند المحاسب",f:r=>r.st==="ok"&&!waitRet(r),t0:r=>N(r.ap&&r.ap.at),mine:()=>canSettle(),done:r=>r.sa,
  hint:()=>!canSettle()?"هذه معتمدة وبانتظار تسوية المحاسب.":KIND==="s"?"اكتب مرجع السند في النظام ثم اضغط «تسوية» (أو Enter). العينة التي رجعت تُسوّى بالصافي فقط.":"بعد خصم الهدية من المخزون في النظام: اكتب مرجع السند ثم اضغط «تسوية» (أو Enter)."},
 log:{ic:"📋",t:"السجل"}
};
const secsOf=k=>(accOnly()?[]:["ap"]).concat(k==="s"?["ret"]:[],["set","log"]);
const qList=(k,s)=>A().filter(r=>kindOf(r)===k&&SD[s].f(r)).sort((a,b)=>SD[s].t0(a)-SD[s].t0(b));
const qMine=(k,s)=>s==="log"?0:qList(k,s).filter(r=>SD[s].mine(r)).length;
const kMine=k=>secsOf(k).reduce((n,s)=>n+qMine(k,s),0);
const kOpen=k=>A().filter(r=>kindOf(r)===k&&(r.st==="pend"||r.st==="ok")).length;
const doneToday=s=>A().filter(r=>{const d=kOk(r)&&SD[s].done(r);return !!d&&String(d.e||"").toLowerCase()===meE()&&isToday(d.at)}).length;
// أول فتحة: النوع والمرحلة اللي فيهم شغل ليك. بعد ما المستخدم يختار بنفسه مانغيّرش عليه، ومانسيبش مرحلة فتحناها حتى لو خلصت (بتقول "أنهيت كل شيء")
function pick(){
 if(!KIND){let k="";try{k=localStorage.getItem("gf_kind")||""}catch(e){}KIND=k==="s"?"s":"g"}
 const o=KIND==="s"?"g":"s";
 if(!KINDu&&!SECu&&(SEC===""||SEC==="log")&&!kMine(KIND)&&kMine(o)){KIND=o;SEC=""}
 const ss=secsOf(KIND);if(ss.indexOf(SEC)<0)SEC="";
 if(!SECu&&(SEC===""||SEC==="log"))SEC=ss.find(s=>s!=="log"&&qMine(KIND,s)>0)||"log";
}
const ageOf=t=>Math.max(0,Math.floor((Date.now()-N(t))/864e5));
const meTag=r=>byMe(r)&&X.mode!=="branch"?`<span class="g5-tag me">👤 ${F.mine&&canEditMine(r)?"سجّلتَها · يمكنك تعديلها":"سجّلتَها"}</span>`:"";
// سطر في مرحلة (فيه الإجراء)
function qRow(r,s,i,hide){
 const d=SD[s],mine=d.mine(r),id=E(r.id);
 const act=!mine?`<span class="g5-at">${d.at(r)}</span>`
  :`<div class="g5-act" data-gf="noop">${s==="ap"?`<button class="bt s g" data-gf="ok" data-id="${id}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${id}" type="button">رفض</button>`
  :s==="set"?`<input data-gfref="${id}" maxlength="60" dir="ltr" placeholder="مرجع السند" aria-label="مرجع السند"><button class="bt s g" data-gf="set" data-id="${id}" type="button">✔ تسوية ${net(r)}</button>`
  :`<button class="bt s g" data-gf="ret" data-id="${id}" type="button">↩️ رجعت العينة</button>`}</div>`;
 const age=ageOf(d.t0(r)||r.ts);
 const tags=(s==="ap"&&!X.view?repTag(r):"")+(age>=3?`<span class="g5-tag r">⏰ منذ ${age} يوم</span>`:"")+(s==="set"&&r.rb?`<span class="g5-tag ok">↩️ رجع ${retQ(r)} · الصافي ${net(r)}</span>`:"")+(s==="set"&&isSample(r)&&r.rt===false?'<span class="g5-tag">لا ترجع</span>':"")+meTag(r);
 return `<div class="g5-row q" data-gf="view" data-id="${id}" data-s="${E(sText(r))}" ${hide&&!sOk(r)?"hidden":""} style="--i:${Math.min(i,10)}">${av(r)}<div class="g5-mid"><b data-notr>${E(r.to&&r.to.n||"")}</b><small><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi>${isSample(r)?"":` · <span class="g5-why">${E(r.why||"")}</span>`} · ${r.rb?net(r):N(r.pcs)} قطعة · <bdi dir="ltr">${hm(r.ts)}</bdi></small>${tags?`<div class="g5-tags">${tags}</div>`:""}</div>${act}</div>`;
}
// سطر في السجل (فيه الحالة)
const ST5={pend:["⏳","بانتظار الاعتماد","w"],ok:["✅","معتمدة","ok"],set:["🧾","تمت التسوية","b"],no:["❌","مرفوضة","r"]};
const stTag=r=>{const s=accOnly()&&r.st==="ok"?["⏳","بانتظار التسوية","w"]:(ST5[r.st]||ST5.pend);
 return `<span class="g5-tag ${s[2]}">${s[0]} ${s[1]}</span>${r.rt===true&&!r.rb&&isAp(r)?'<span class="g5-tag w">↩️ لم ترجع</span>':""}${r.rb?`<span class="g5-tag ok">↩️ صافي ${net(r)}</span>`:""}${r.st==="pend"&&!X.view?repTag(r):""}${meTag(r)}`};
const logRow=(r,i)=>`<div class="g5-row" data-gf="view" data-id="${E(r.id)}" data-s="${E(sText(r))}" ${sOk(r)?"":"hidden"} style="--i:${Math.min(i,10)}">
 ${av(r)}<div class="g5-mid"><b data-notr>${E(r.to&&r.to.n||"")}</b><small><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi>${isSample(r)?"":` · <span class="g5-why">${E(r.why||"")}</span>`} · ${tShort(r.ts)}</small></div>
 <div class="g5-end"><b>${r.rb?net(r):N(r.pcs)}<small> قطعة</small></b><div class="g5-tags">${stTag(r)}</div></div></div>`;
const searchBox=()=>`<div class="g5-search"><span>🔍</span><input type="search" id="gx-q" value="${E(F.q||"")}" placeholder="${KIND==="s"?"ابحث برقم العينة أو المستلم أو الجوال أو الكود...":"ابحث برقم الهدية أو المستلم أو الجوال أو الكود..."}" aria-label="بحث"></div>`;
function queueHtml(){
 const d=SD[SEC],L=qList(KIND,SEC),dn=doneToday(SEC),find=L.length>8||!!F.q;
 return `<div class="g5-hint"><span>${d.hint()}</span>${dn?`<b>أنجزت اليوم ${dn}</b>`:""}</div>
 ${find?`<div class="g5-find">${searchBox()}</div>`:""}
 ${L.length?`<div class="g5-list">${L.map((r,i)=>qRow(r,SEC,i,find)).join("")}</div>`:`<div class="g5-empty"><span>👌</span>${dn?"أنهيت كل شيء هنا":"لا يوجد شيء هنا الآن"}</div>`}`;
}
const bars=(o,lbl)=>{const e=Object.entries(o).sort((a,b)=>b[1].p-a[1].p),mx=e.length?Math.max(1,e[0][1].p):1;
 return e.map(([k,v])=>`<div class="g5-bar"><span><bdi dir="ltr">${E(lbl(k))}</bdi></span><i><u style="width:${Math.max(3,v.p/mx*100)}%"></u></i><em>${fmt(v.p)}</em></div>`).join("")};
// الفلاتر "أقراص" من غير عناوين فوق: المتفعّل بيتلوّن وجنبه ✕ يمسحه
function fChip(on,inner,clr){return `<label class="g5-fc ${on?"on":""}">${inner}${on&&clr?`<button type="button" class="fx" data-gf="fclr" data-id="${clr}" aria-label="مسح">✕</button>`:""}</label>`}
function logHtml(){
 const rs=filtered(),vis=rs.filter(sOk);
 const ok=A().filter(r=>kOk(r)&&inPer(r)&&brOk(r)&&whyOk(r)&&isAp(r));
 const out=ok.reduce((s,r)=>s+N(r.pcs),0),back=ok.reduce((s,r)=>s+retQ(r),0),pcs=ok.reduce((s,r)=>s+net(r),0);
 const per={},pw={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=net(r);const w=WHY.includes(r.why)?r.why:"أخرى";(pw[w]=pw[w]||{n:0,p:0}).n++;pw[w].p+=net(r)});
 const pers=[["m0","هذا الشهر"],["m1","الشهر الماضي"],["m3","آخر 3 شهور"],["c","فترة أخرى"]];
 const sts=(accOnly()?[["","كل الحالات"],["ok","بانتظار التسوية"],["set","مسوّاة"]]:[["","كل الحالات"],["pend","بانتظار الاعتماد"],["ok","معتمدة"],["set","مسوّاة"],["no","مرفوضة"]]).concat(KIND==="s"?[["ret","لم ترجع بعد"]]:[]);
 const brs=[...new Set(A().map(r=>r.br))].sort();
 const brOpts=`<option value="">كل الفروع والمستودع</option><option value="WH" ${F.br==="WH"?"selected":""}>المستودع</option>${(X.branches||[]).map(b=>{const c=String(b).split("-")[0];return `<option value="${E(c)}" ${F.br===c?"selected":""}>${E(b)}</option>`}).join("")}${brs.filter(c=>c!=="WH"&&!(X.branches||[]).some(b=>String(b).split("-")[0]===c)).map(c=>`<option value="${E(c)}" ${F.br===c?"selected":""}>${E(c)}</option>`).join("")}`;
 const nF=(F.st?1:0)+(F.br?1:0)+(KIND==="g"&&F.why?1:0)+(PER==="c"?1:0);
 const myP=!X.noNew&&!X.view?A().filter(r=>kOk(r)&&byMe(r)&&r.st==="pend").length:0;
 let lastD="",i=0;const list=vis.slice(0,SHOWN).map(r=>{const k=dayKey(r.ts),h=k!==lastD?`<div class="g5-day">${E(dayLbl(r.ts))}</div>`:"";lastD=k;return h+logRow(r,i++)}).join("");
 return `<div class="g5-tools"><div class="g5-per">${pers.map(([p,l])=>`<button type="button" class="${PER===p&&!F.mine?"on":""}" data-gf="per" data-id="${p}">${l}</button>`).join("")}</div>
 <div class="g5-exp"><button class="bt s" data-gf="print" type="button" title="${KIND==="s"?"تقرير العينات PDF":"تقرير الهدايا PDF"}">🖨<span class="tx">PDF</span></button><button class="bt s" data-gf="csv" type="button" title="ملف إكسل">⬇️<span class="tx">إكسل</span></button></div></div>
 ${F.mine?"":`<div class="g5-sum">${KIND==="s"?`<span><b>${ok.length}</b>عينة معتمدة</span><span><b>${fmt(out)}</b>قطعة خرجت</span><span><b>${fmt(back)}</b>رجعت</span><span><b>${fmt(pcs)}</b>الصافي</span>`:`<span><b>${ok.length}</b>هدية معتمدة</span><span><b>${fmt(pcs)}</b>قطعة</span>`}${ok.length?`<button type="button" class="g5-lnk" data-gf="sum" aria-expanded="${SUMOPEN}">${SUMOPEN?"إخفاء التفاصيل":"التفاصيل حسب الفرع"}</button>`:""}</div>
 ${SUMOPEN&&ok.length?`<div class="g5-sumd${KIND==="s"?" one":""}"><div><h4>حسب الفرع (قطع صافي)</h4>${bars(per,brName)}</div>${KIND==="s"?"":`<div><h4>حسب البند</h4>${bars(pw,w=>w)}</div>`}</div>`:""}`}
 <div class="g5-find">${searchBox()}
 ${fChip(!!F.st,`<select id="gx-st" aria-label="الحالة">${sts.map(([v,l])=>`<option value="${v}" ${(F.st||"")===v?"selected":""}>${l}</option>`).join("")}</select>`,"st")}
 ${fChip(!!F.br,`<select id="gx-br" aria-label="الفرع">${brOpts}</select>`,"br")}
 ${KIND==="g"?fChip(!!F.why,`<select id="gx-why" aria-label="البند"><option value="">كل البنود</option>${GWHY.map(w=>`<option ${F.why===w?"selected":""}>${E(w)}</option>`).join("")}</select>`,"why"):""}
 ${PER==="c"&&!F.mine?fChip(true,`<input type="date" id="gx-from" value="${E(F.from)}" aria-label="من"><span class="fa">←</span><input type="date" id="gx-to" value="${E(F.to)}" aria-label="إلى">`,"per"):""}
 ${!X.noNew&&!X.view?`<button type="button" class="g5-mine${F.mine?" on":""}" data-gf="mine" aria-pressed="${!!F.mine}">👤 ما سجّلتُه${myP?`<i>${myP}</i>`:""}</button>`:""}
 ${nF>1?`<button type="button" class="g5-fclr" data-gf="fclr" data-id="all">مسح الفلاتر</button>`:""}</div>
 ${F.mine?`<div class="g5-minehint">👤 كل ما سجّلتَه أنت من ${KIND==="s"?"العينات":"الهدايا"} (من كل الفترات). ما زال بانتظار الاعتماد يمكنك تعديله: افتحه ثم اضغط «✏️ تعديل».</div>`:""}
 <div class="g5-cnt">${vis.length} ${noun()}${F.st||F.br||(KIND==="g"&&F.why)||F.q?" (مفلترة)":""}</div>
 ${vis.length?`<div class="g5-list">${list}</div>${vis.length>SHOWN?`<button type="button" class="g5-more" data-gf="more">عرض المزيد (${vis.length-SHOWN})</button>`:""}`:`<div class="g5-empty"><span>${KIND==="s"?"🧪":"🎁"}</span>${F.st||F.q||F.br||(KIND==="g"&&F.why)?"لا توجد نتائج بهذه الفلاتر":F.mine?"لم تسجّل شيئاً بعد":KIND==="s"?"لا توجد عينات في هذه الفترة":"لا توجد هدايا في هذه الفترة"}</div>`}`;
}
export function giftsView(){
 if(!X)return "";
 if(!F.from)setPer("m0");
 _A=all();
 try{
  pick();
  const seg=(k,t)=>{const m=kMine(k),o=kOpen(k);return `<button type="button" role="tab" aria-selected="${KIND===k}" class="${KIND===k?"on":""}${m?" has":""}" data-gf="kind" data-id="${k}"><span class="ic" data-noico>${KIC[k]}</span><span class="tx"><b>${t}</b><small>${m?`${m} بانتظار إجرائك`:o?`${o} قيد المتابعة`:"لا جديد"}</small></span></button>`};
  const tab=s=>{const n=s==="log"?0:qList(KIND,s).length,m=qMine(KIND,s);return `<button type="button" role="tab" aria-selected="${SEC===s}" class="${SEC===s?"on":""}${m?" mine":""}" data-gf="sec" data-id="${s}">${SD[s].ic} ${SD[s].t}${s==="log"?"":`<i class="${n?"":"z"}">${n}</i>`}</button>`};
  const out=`<div class="g5${ANIM?" anim":""}">
  <div class="g5-top"><div class="g5-seg" role="tablist" aria-label="النوع">${seg("g","الهدايا")}${seg("s","العينات")}</div>${!X.noNew&&!X.view?`<button class="bt p g5-new" data-gf="new" type="button">${KIND==="s"?"＋ تسجيل عينة":"＋ تسجيل هدية"}</button>`:""}</div>
  <div class="g5-card"><div class="g5-tabs" role="tablist">${secsOf(KIND).map(tab).join("")}</div>
  <div class="g5-body${SWAP?" swap":""}">${SEC==="log"?logHtml():queueHtml()}</div></div></div>`;
  ANIM=false;SWAP=false;
  return out;
 }finally{_A=null}
}
// لو الفترة أقدم من اللي بيتسمع لايف: نحمّلها مرة واحدة
async function ensureRange(){
 if(accOnly()){
  const a=new Date((F.from||today())+"T00:00:00"),b=new Date((F.to||today())+"T00:00:00"),ms=[];const d=new Date(a.getFullYear(),a.getMonth(),1);
  while(d<=b&&ms.length<24){ms.push(d.toLocaleDateString("en-CA").slice(0,7));d.setMonth(d.getMonth()+1)}
  try{for(const m of ms.filter(m=>!MON.has(m))){const sn=await getDocs(query(collection(X.db,"gifts"),where("st","==","set"),where("sm","==",m)));sn.docs.forEach(x=>OLD.set(x.id,{id:x.id,...x.data()}));MON.add(m)}}
  catch(e){X.toast("تعذر تحميل هذه الفترة، تأكد من الإنترنت")}
  return;
 }
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0;if(a>=Date.now()-LIVE*D)return;
 const b=Math.min(F.to?new Date(F.to+"T23:59:59").getTime():Date.now(),Date.now()-LIVE*D);
 try{const sn=await getDocs(query(collection(X.db,"gifts"),where("ts",">=",a),where("ts","<=",b)));sn.docs.forEach(d=>OLD.set(d.id,{id:d.id,...d.data()}))}
 catch(e){X.toast("تعذر تحميل هذه الفترة، تأكد من الإنترنت")}
}
// ---------- النافذة ----------
function box(){let m=g("gfm");if(!m){m=document.createElement("div");m.id="gfm";m.className="gfm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(h,v){const m=box();m.innerHTML=`<div class="gfk">${h}</div>`;m.className="gfm on";m.dataset.v=v||""}
function closeM(){const m=g("gfm");if(m){m.className="gfm";m.innerHTML="";m.dataset.v=""}img="";imgBusy=false;edit=null;PK=null;ACC=null;ACCL=[];GDRAFT=null}
// 🛟 (v238) رقم الهدية الجديدة ثابت طول ما النموذج مفتوح: لو الحفظ وصل والرد اتأخر، الضغط تاني مابيعملش هدية تانية
let GDRAFT=null;
// ---------- نموذج التسجيل ----------
const rowHtml=(x={})=>`<div class="gf-row"><input data-r="k" placeholder="الكود" dir="ltr" maxlength="40" value="${E(x.k||"")}"><input data-r="c" placeholder="اللون" maxlength="40" value="${E(x.c||"")}"><input data-r="z" placeholder="المقاس" maxlength="20" value="${E(x.z||"")}"><input data-r="q" placeholder="العدد" inputmode="numeric" value="${x.q?E(x.q):""}"><button type="button" data-gf="rmrow" title="احذف السطر">✕</button></div>`;
function form(r){
 edit=r||null;img="";imgBusy=false;
 FK=r?kindOf(r):(X.mode!=="branch"&&KIND==="s"?"s":"g");// النوع: من الهدية نفسها عند التعديل، وإلا من القسم المفتوح في اللوحة
 const wl=GWHY.concat(r&&r.why&&r.why!=="عينة"&&GWHY.indexOf(r.why)<0?[r.why]:[]);
 const wh=X.mode!=="branch",autoName=wh?String(X.me.n||X.me.e||""):String(X.brn||X.code||"");
 openM(`<h3>${r?"✏️ تعديل":"🎁 تسجيل"} هدية / عينة</h3><div style="color:var(--mut);font-size:13.5px">${r?`<bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.brn||brName(r.br))}`:wh?"من المستودع — ستُرسل إلى مدير التسويق ليعتمدها":"من "+E(X.brn)+" — ستُرسل إلى مدير التسويق ليعتمدها"}</div>
 <div class="g5-seg sm" id="gfkind" role="tablist" aria-label="النوع">${[["g","هدية","تُعطى للعميل"],["s","عينة","للتجربة وقد ترجع"]].map(([k,t,d])=>`<button type="button" role="tab" aria-selected="${FK===k}" class="${FK===k?"on":""}" data-gf="fkind" data-id="${k}"><span class="ic" data-noico>${KIC[k]}</span><span class="tx"><b>${t}</b><small>${d}</small></span></button>`).join("")}</div>
 <label>الأصناف</label><div class="gf-rows" id="gfrows">${(r&&Array.isArray(r.rows)&&r.rows.length?r.rows:[{}]).map(rowHtml).join("")}</div>
 <button class="bt s" data-gf="addrow" type="button" style="margin-top:6px;width:auto">➕ صنف</button>
 <div class="gf-2"><div><label>اسم المستلم *</label><input id="gfn" maxlength="60" value="${E(r&&r.to&&r.to.n||"")}" placeholder="مثلاً: أ. محمد علي"></div>
 <div><label>جوال المستلم</label><input id="gfp" maxlength="20" inputmode="tel" dir="ltr" value="${E(r&&r.to&&r.to.ph||"")}" placeholder="05xxxxxxxx"></div></div>
 <div class="gf-2"><div><div id="gfwbox" ${FK==="s"?"hidden":""}><label>السبب *</label><select id="gfw">${wl.map(w=>`<option ${r&&r.why===w?"selected":""}>${E(w)}</option>`).join("")}</select></div><div id="gfsbox" ${FK==="s"?"":"hidden"}><label>النوع</label><div class="g5-note">عينة: يحدد مدير التسويق عند الاعتماد هل سترجع أم لا.</div></div></div>
 <div><label>المسجِّل (تلقائي)</label><input id="gfby" dir="auto" maxlength="60" value="${E(r&&r.by?r.by.n:autoName)}" disabled title="يُكتب تلقائياً باسم الحساب الداخل"></div></div>
 <label>ملاحظة</label><textarea id="gfnote" rows="2" maxlength="300" placeholder="اختياري">${E(r&&r.note||"")}</textarea>
 ${r&&!isOwner()?`<div class="m" style="margin-top:12px;font-size:13px;color:var(--mut)">📎 صور السند تبقى كما هي. يمكنك التعديل حتى يعتمدها مدير التسويق.</div>`:`<label>${r?"مرفقات سند جديدة (اختياري، تستبدل الحالية)":"مرفقات السند: صور أو ملفات (اختياري)"}</label><div id="gfmp"></div>`}
 <div class="gf-act"><button class="bt p" data-gf="save" type="button">${r?"💾 حفظ التعديل":"✅ تسجيل"}</button><button class="bt" data-gf="${X.mode==="branch"&&!r?"bopen":"close"}" type="button">رجوع</button></div>`,"form");
 PK=g("gfmp")?multiPick(g("gfmp"),{w:1400,cap:230000,toast:X.toast,add:"صور أو ملفات للسند"}):null;
}
async function save(){
 if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const IMS=PK?PK.imgs():[],PDFS=PK?PK.files():[],EXTRA=IMS.slice(1).concat(PDFS);img=IMS[0]||"";// (ملفات PDF بتتحفظ مع المرفقات الإضافية)
 const rows=[...document.querySelectorAll("#gfrows .gf-row")].map(el=>{const v=k=>el.querySelector(`[data-r="${k}"]`).value.trim();return {k:v("k").slice(0,40),c:v("c").slice(0,40),z:v("z").slice(0,20),q:Math.min(99999,Math.round(N(toEn(v("q")))))}}).filter(x=>x.k&&x.q>0).map(x=>{const o={k:x.k,q:x.q};if(x.c)o.c=x.c;if(x.z)o.z=x.z;return o});
 const to={n:g("gfn").value.trim().slice(0,60)},ph=toEn(g("gfp").value).replace(/[^\d+]/g,"").slice(0,20);if(ph)to.ph=ph;
 const why=FK==="s"?"عينة":g("gfw").value,note=g("gfnote").value.trim().slice(0,300),byN=g("gfby").value.trim().slice(0,60);
 if(!rows.length){X.toast("اكتب صنفاً واحداً على الأقل (الكود والعدد)");return}
 if(rows.length>100){X.toast("الأصناف كثيرة جداً (أكثر من 100)");return}
 if(!to.n){X.toast("اكتب اسم المستلم");return}
 if(!byN){X.toast("اكتب اسمك");return}
 
 const btn=document.querySelector('[data-gf="save"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 try{
  const pcs=rows.reduce((s,x)=>s+x.q,0);
  if(edit){// المالك، أو اللي سجّلها وهي لسه بانتظار الاعتماد (من غير تغيير الصور)
   const d={...edit,rows,pcs,to,why,note};delete d.id;if(!note)delete d.note;if(img||PDFS.length)d.img=1;
   if(!isOwner()){const id=edit.id;await withTimeout(setDoc(doc(X.db,"gifts",id),d),20000);const nr={...d,id};if(MINE.has(id))MINE.set(id,nr);if(L.has(id))L.set(id,nr);if(PEND.has(id))PEND.set(id,nr);
    X.toast("تم حفظ التعديل ✅");closeM();if(X.mode==="branch")openBranch();else{viewGift(id);if(X.redraw)X.redraw()}return}
   const b=writeBatch(X.db);b.set(doc(X.db,"gifts",edit.id),d);if(img)b.set(doc(X.db,"giftimg",edit.id),{img});
   await withTimeout(b.commit(),20000);
   if(img||PDFS.length){await dropExtras(X.db,"giftimg",edit.id);const bad=await saveExtras(X.db,"giftimg",edit.id,EXTRA);if(bad)X.toast(`تعذّر حفظ ${bad} من المرفقات الإضافية`,"er")}
   X.toast("تم حفظ التعديل ✅");closeM();if(X.mode==="branch")openBranch();return;
  }
  const wh=X.mode!=="branch",ts=Date.now(),dd=new Date(ts),p=n=>String(n).padStart(2,"0"),br=wh?"WH":X.code;
  if(!GDRAFT)GDRAFT=doc(collection(X.db,"gifts")).id;
  const ref=doc(X.db,"gifts",GDRAFT),no=`G-${br}-${p(dd.getMonth()+1)}${p(dd.getDate())}-${p(dd.getHours())}${p(dd.getMinutes())}`;
  const d={br,brn:wh?"المستودع":String(X.brn||br).slice(0,40),no,ts,dt:today(),rows,pcs,to,why,by:{e:X.me.e,n:byN},st:"pend"};
  if(note)d.note=note;if(img||PDFS.length)d.img=1;
  const b=writeBatch(X.db);b.set(ref,d);if(img)b.set(doc(X.db,"giftimg",ref.id),{img});
  await withTimeout(b.commit(),20000);
  if(EXTRA.length){if(btn)btn.textContent=`⏳ جاري رفع المرفقات (${IMS.length+PDFS.length})...`;const bad=await saveExtras(X.db,"giftimg",ref.id,EXTRA);if(bad)X.toast(`سُجّلت الهدية، لكن تعذّر رفع ${bad} من المرفقات. افتحها وأضفها لاحقاً أو أبلغ المستودع`,"er")}
  if(X.ping)X.ping([ref.id]);GDRAFT=null;
  X.toast(IMS.length+PDFS.length>1?`سُجّلت ✅ مع ${IMS.length+PDFS.length} مرفقات، وبانتظار اعتماد مدير التسويق`:"سُجّلت ✅ وبانتظار اعتماد مدير التسويق");
  // (15 نوفمبر 2026) المستودع: نفتح السند على طول، فيه زرار «تعديل» لحد ما تتعتمد (بدل ما يدوّر عليها في القايمة)
  if(X.mode==="branch")openBranch();else{MINE.set(ref.id,{...d,id:ref.id});closeM();viewGift(ref.id);if(X.redraw)X.redraw()}
 }catch(e){
  if(!edit&&GDRAFT){try{const id=GDRAFT,s=await withTimeout(getDoc(doc(X.db,"gifts",id)),8000);if(s.exists()){GDRAFT=null;if(X.ping)X.ping([id]);
   X.toast(EXTRA.length?"سُجّلت ✅ (الاتصال كان بطيئاً). لو المرفقات الإضافية ناقصة افتحها وأضفها":"سُجّلت ✅ وبانتظار اعتماد مدير التسويق");
   if(X.mode==="branch")openBranch();else{MINE.set(id,Object.assign({id},s.data()));closeM();viewGift(id);if(X.redraw)X.redraw()}return}}catch(x){}}
  if(btn){btn.disabled=false;btn.textContent=edit?"💾 حفظ التعديل":"✅ تسجيل"}const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")}
}
// ---------- الاعتماد / الرفض ----------
async function decide(id,ok,rt){
 const r=PEND.get(id)||L.get(id);if(!r||r.st!=="pend")return;
 let note="";if(!ok){note=(prompt(`سبب رفض هدية ${r.no}؟`)||"").trim().slice(0,300);if(!note){X.toast("يجب كتابة سبب الرفض");return}}
 else if(isSample(r)&&rt===undefined){// العينة: نسأل هترجع ولا لأ قبل الاعتماد
  openM(`<h3>✅ اعتماد عينة <bdi dir="ltr">${E(r.no)}</bdi></h3><div style="color:var(--mut);font-size:14px"><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi> · ${N(r.pcs)} قطعة · ${E(itemsTxt(r))}</div>
  <div style="font-weight:800;font-size:17px;margin-top:14px">هل هذه العينة سترجع؟</div>
  <div class="gf-rt"><button class="y" data-gf="okrt" data-id="${E(id)}" type="button">↩️ اعتماد — العينة سترجع<small>تظهر "لم ترجع بعد" حتى ${r.br==="WH"?"يسجّل المستودع":"يسجّل الفرع"} رجوعها، ويسوّي المحاسب الصافي فقط</small></button>
  <button data-gf="oknort" data-id="${E(id)}" type="button">✅ اعتماد — العينة لا ترجع<small>تُعامَل مثل الهدية وتُسوّى كاملة</small></button></div>
  <div class="gf-act"><button class="bt" data-gf="close" type="button">إلغاء</button></div>`,"rt");
  return;
 }
 else if(!isSample(r)&&!confirm(`اعتماد هدية ${r.no} (${r.brn||brName(r.br)} · ${N(r.pcs)} قطعة)؟`))return;
 const ap={e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60),at:Date.now()};if(note)ap.note=note;
 const u={st:ok?"ok":"no",ap};if(ok&&isSample(r))u.rt=rt===true;
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),u),15000);closeM();if(X.ping)X.ping([id]);X.toast(ok?(u.rt?"اعتُمدت ✅ — العينة سترجع، وأُبلغ الفرع":"اعتُمدت ✅"):"رُفضت")}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح (ربما اعتمدها شخص آخر)":FAIL_MSG[w])}
}
// ---------- ورقة الهدية: كل التفاصيل بشكل مرتب (زي ورقة تحميل النواقص) + الأزرار ----------
function sheetHtml(r,print){
 const st=r.st||"pend",ap=r.ap||{},rows=Array.isArray(r.rows)?r.rows:[],rl=r.rb&&Array.isArray(r.rb.lines)?r.rb.lines:null;
 const step=(on,cls,t,s)=>`<div class="${on?cls||"on":""}"><b>${t}</b>${s||""}</div>`;
 return `<div class="gs-rt"><div><small>من</small><b><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi></b></div><div class="ar">←</div><div class="to"><small>إلى (المستلم)</small><b>${E(r.to&&r.to.n||"")}</b>${r.to&&r.to.ph?`<small><bdi dir="ltr">${E(r.to.ph)}</bdi></small>`:""}</div></div>
 <div class="gs-mt"><div><small>السبب</small><b>🏷 ${E(r.why||"")}</b></div><div><small>التاريخ</small><b><bdi dir="ltr">${E(r.dt||"")}</bdi> · ${new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</b></div><div><small>سجّلها</small><b><bdi>${E(r.by&&r.by.n||"")}</bdi></b></div><div><small>السند</small><b>${r.img?"📎 مرفق":"بدون مرفق"}</b></div></div>
 <table class="gs-tb"><thead><tr><th>#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th>العدد</th>${rl?"<th>رجع</th>":""}</tr></thead><tbody>
 ${rows.map((x,i)=>`<tr><td>${i+1}</td><td class="k">${E(x.k||"")}</td><td><bdi dir="ltr">${E(x.c||"—")}</bdi></td><td><bdi dir="ltr">${E(x.z||"—")}</bdi></td><td class="q">${N(x.q)}</td>${rl?`<td class="q rq">${N(rl[i])}</td>`:""}</tr>`).join("")}</tbody>
 <tfoot><tr><td colspan="4" style="text-align:start">الإجمالي: ${rows.length} صنف</td><td class="q">${N(r.pcs)}</td>${rl?`<td class="q rq">${retQ(r)}</td>`:""}</tr>${r.rb?`<tr><td colspan="${rl?6:5}" style="text-align:start;color:#45512a">الصافي بعد الرجوع: ${net(r)} قطعة</td></tr>`:""}</tfoot></table>
 ${r.note?`<div class="gs-nt">📝 ${E(r.note)}</div>`:""}
 ${st==="no"&&ap.note?`<div class="gs-nt" style="background:#fbe3e0;border-color:#c4362b">❌ سبب الرفض: ${E(ap.note)}</div>`:""}
 ${print?"":`<div class="gs-tl">${step(true,"on","1. التسجيل",`<bdi>${E(r.by&&r.by.n||"")}</bdi><br>${hm(r.ts)}`)}${step(st!=="pend",st==="no"?"no":"on",st==="no"?"2. مرفوضة":"2. الاعتماد",ap.n?`${E(ap.n)}<br>${hm(ap.at)}`:"بانتظار مدير التسويق")}${r.rt===true?step(!!r.rb,"on","↩️ رجوع العينة",r.rb?`${N(r.rb.q)} قطعة<br>${hm(r.rb.at)}`:"لم ترجع بعد"):""}${step(st==="set","on","3. التسوية",r.sa?`مرجع <bdi dir="ltr">${E(r.sa.ref||"")}</bdi><br>${hm(r.sa.at)}`:"بانتظار المحاسب")}</div>`}`;
}
// ⚡ (v176) السند المفتوح يتحدّث لايف (اعتماد، رفض، تسوية، رجوع العينة) من غير قفله وفتحه.
// مابنرسمش لو حد بيكتب جوّاه (مرجع التسوية) أو صندوق مرفقات المحاسب مفتوح، ونحافظ على مكان التمرير.
let VID=null,VSIG="";
const vsig=r=>{try{return JSON.stringify(r)}catch(e){return ""}};
function liveView(){
 const m=g("gfm");if(!X||!VID||!m||m.dataset.v!=="view")return;
 const r=all().find(x=>x.id===VID)||BL.find(x=>x.id===VID);if(!r)return;const s=vsig(r);if(s===VSIG)return;
 const a=document.activeElement;if(ACC||(a&&m.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))||[...m.querySelectorAll("input,textarea")].some(i=>i.value))return;
 const k=m.querySelector(".gfk"),top=k?k.scrollTop:0,mt=m.scrollTop;viewGift(VID);const k2=m.querySelector(".gfk");if(k2)k2.scrollTop=top;m.scrollTop=mt;
}
function viewGift(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r)return;VID=id;VSIG=vsig(r);
 const st=r.st||"pend",wh=X.mode!=="branch";
 openM(`<div class="gs"><div class="gs-hd"><img src="./icon-192.png" alt=""><div><b>${isSample(r)?"سند عينة":"سند هدية"}</b><small>${E(r.no)}</small></div><span class="gf-st ${st}">${STL[st]||st}</span></div>
 <div class="gs-bd">${(()=>{const x=wh?repOf(r):null;if(!x)return "";const L=all().filter(y=>y.id!==r.id&&y.st!=="no"&&Math.abs(N(y.ts)-N(r.ts))<=30*864e5&&y.to&&(x.by==="ph"?phK(y.to.ph)===phK(r.to.ph):(y.br===r.br&&nmK(y.to.n)===nmK(r.to.n)))).sort((a,b)=>N(b.ts)-N(a.ts)).slice(0,5);
  return `<div class="gs-rep">🔁 <b>${x.by==="ph"?"رقم الجوال نفسه":"اسم المستلم نفسه"} استلم ${x.n===1?"هدية أخرى":x.n===2?"هديتين أخريين":x.n+" هدايا أخرى"} خلال 30 يوماً</b>${L.map(y=>`<div>${E(y.dt||"")} · <bdi dir="ltr">${E(y.brn||brName(y.br))}</bdi> · ${E(y.why||"")} · ${net(y)} قطعة · ${E((STL[y.st]||"").replace(/^\S+\s/,""))}</div>`).join("")}</div>`})()}${sheetHtml(r)}
 ${wh&&isAp(r)?`<div class="gs-acc" id="gfacc" data-id="${E(r.id)}"></div>`:""}
 <div class="gs-ac">${wh&&canApprove()&&st==="pend"?`<button class="bt g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${canRet(r)?`<button class="bt g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}
 ${wh&&canSettle()&&st==="ok"?`<div class="gs-set">${waitRet(r)?'<span class="g5-tag w">↩️ العينة لم ترجع بعد: الأفضل الانتظار</span>':""}<input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="مرجع السند في النظام"><button class="bt g" data-gf="set" data-id="${E(r.id)}" type="button">✔ تسوية ${net(r)} قطعة</button></div>`:""}
 ${r.img?`<button class="bt" data-gf="img" data-id="${E(r.id)}" type="button">📎 صورة السند</button>`:""}
 <button class="bt" data-gf="gprint" data-id="${E(r.id)}" type="button">🖨 طباعة</button>
 ${(wh&&isOwner())||canEditMine(r)?`<button class="bt" data-gf="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button>`:""}${wh&&isOwner()?`<button class="bt r" data-gf="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`:""}
 <button class="bt" data-gf="${wh?"close":"bopen"}" type="button">رجوع</button></div></div></div>`,"view");
 if(wh&&isAp(r))loadAcc(r.id,false);
}
// ---------- 📎 مرفقات المحاسب ----------
const JPEG=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const canAcc=()=>canSettle()&&!X.view;
async function loadAcc(id,open){
 const here=()=>{const el=g("gfacc");return el&&el.dataset.id===id?el:null};if(!here())return;
 let L=[],bad=false;
 try{L=await withTimeout(loadAtts(X.db,"giftimg",id,"a"),15000)}// (v175) صور أو ملفات: {k, src, pdf?, file?, nm, n, at}، ومحتوى الملف يُنزَّل عند فتحه فقط
 catch(e){bad=true}
 const el=here();if(!el)return;ACCL=L;const can=canAcc();
 if(!can&&!L.length&&!bad){el.innerHTML="";ACC=null;return}
 el.innerHTML=`<div class="gs-ah"><b>📎 مرفقات المحاسب</b>${L.length?`<small>(${L.length}/10)</small>`:""}</div>${bad?'<div class="m">تعذّر تحميل المرفقات</div>':""}
 ${L.length?`<div class="gs-ag">${L.map((x,i)=>`<button type="button" data-gf="accimg" data-id="${E(id)}" data-i="${i}">${x.pdf||x.file?`<span class="gs-pdf">📄<small data-notr>${E(x.nm||"PDF")}</small></span>`:`<img src="${x.src}" alt="">`}<span data-notr><bdi>${E(x.n||"")}</bdi><br>${hm(x.at)}</span></button>`).join("")}</div>`:""}
 ${can&&!bad&&L.length<10?(open?`<div id="gfaccp"></div><div class="gf-act" style="margin-top:8px"><button class="bt g" data-gf="accsave" data-id="${E(id)}" type="button">💾 حفظ المرفقات</button><button class="bt" data-gf="accx" data-id="${E(id)}" type="button">إلغاء</button></div>`
  :`<button class="bt s" data-gf="accadd" data-id="${E(id)}" type="button">📎 إرفاق صور أو ملفات</button>${L.length?"":'<div class="m" style="margin-top:6px">أرفق صوراً أو ملفات من جهازك لهذا السند (لا يغيّر أي شيء في الهدية).</div>'}`):""}`;
 ACC=open&&g("gfaccp")?multiPick(g("gfaccp"),{max:10-L.length,w:1400,cap:230000,toast:X.toast,add:"صور أو ملفات"}):null;
}
async function accSave(id){
 if(!ACC||!canAcc())return;if(ACC.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const IMS=ACC.imgs().filter(s=>JPEG.test(s)).concat(ACC.files());if(!IMS.length){X.toast("اختر صورة أو ملفاً واحداً على الأقل");return}
 const btn=document.querySelector('[data-gf="accsave"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الرفع..."}
 const start=ACCL.reduce((m,x)=>Math.max(m,x.k),0)+1,nm=String(X.me.n||X.me.e||"").slice(0,60);let ok=0,bad=0,denied=false;
 for(let k=0;k<IMS.length;k++){const n=start+k;if(n>10){bad+=IMS.length-k;break}
  try{await withTimeout(putAtt(X.db,"giftimg",id,"a",n,IMS[k],{n:nm,at:Date.now()}),150000);ok++}// الملف: أجزاؤه في af ثم رأسه في a
  catch(e){bad++;if((await failReason(e))==="denied")denied=true}}
 if(!bad)X.toast("📎 تم إرفاق المرفقات ✅");
 else X.toast(denied&&!ok?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":"تعذّر رفع بعض المرفقات، حاول مرة أخرى","er");
 loadAcc(id,false);
}
async function dropAcc(id){try{const A=await loadAtts(X.db,"giftimg",id,"a");for(const x of A){try{await dropAtt(X.db,x.path,x.file?x.src:"")}catch(e){}}}catch(e){}}
function printGift(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r)return;
 printStmt(`<div class="st"><div class="ph"><h2>${isSample(r)?"سند عينة":"سند هدية"}</h2><div>${E(r.no)} · ${E((STL[r.st]||"").replace(/^\S+\s/,""))}</div></div>
 <style>.gs-rt{display:flex;gap:8px;margin:4mm 0}.gs-rt>div{flex:1;border:1px solid #999;border-radius:6px;padding:2mm 3mm}.gs-rt .ar{flex:none;border:0;align-self:center;font-size:16pt}.gs-rt small{display:block;font-size:8pt;color:#555}.gs-rt b{font-size:12pt}
 .gs-mt{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-bottom:4mm}.gs-mt div{border:1px solid #ccc;border-radius:4px;padding:1.5mm 2mm}.gs-mt small{display:block;font-size:8pt;color:#555}
 .gs-tb{width:100%;border-collapse:collapse}.gs-tb th,.gs-tb td{border:1px solid #999;padding:2mm;text-align:center}.gs-tb td.k{font-weight:700}.gs-nt{margin-top:3mm;border:1px solid #ccc;padding:2mm}</style>
 ${sheetHtml(r,true)}
 <div class="sg"><span>سجّلها: <bdi>${E(r.by&&r.by.n||"")}</bdi></span><span>اعتمدها: ${E(r.ap&&r.ap.n||"")}</span><span>المستلم</span></div></div>`);
}
// ---------- رجوع العينة (اللي طلّعها: الفرع أو المستودع) ----------
function retForm(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!canRet(r))return;
 const rows=Array.isArray(r.rows)?r.rows:[];
 openM(`<h3>↩️ رجوع العينة <bdi dir="ltr">${E(r.no)}</bdi></h3><div style="color:var(--mut);font-size:14px">اكتب عدد ما رجع من كل صنف (يمكن أن يكون أقل من الذي خرج)، وسيُحسب الصافي تلقائياً للمحاسب.</div>
 <div style="margin-top:12px"><div class="gf-rr" style="font-size:13px;color:var(--mut);font-weight:700"><span>الصنف</span><span style="text-align:center">خرج</span><span style="text-align:center">رجع</span></div>
 ${rows.map((x,i)=>`<div class="gf-rr"><bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi><b style="text-align:center">${N(x.q)}</b><input data-rq="${i}" data-max="${N(x.q)}" inputmode="numeric" value="${N(x.q)}"></div>`).join("")}</div>
 <label>ملاحظة</label><textarea id="gfrn" rows="2" maxlength="200" placeholder="اختياري (مثلاً: رجعت بحالة جيدة)"></textarea>
 <div class="gf-act"><button class="bt p" data-gf="retsave" data-id="${E(id)}" type="button">✅ تسجيل الرجوع</button><button class="bt" data-gf="${X.mode==="branch"?"bopen":"close"}" type="button">رجوع</button></div>`,"ret");
}
async function retSave(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!canRet(r))return;
 const lines=[...document.querySelectorAll("[data-rq]")].map(el=>Math.max(0,Math.min(N(el.dataset.max),Math.round(N(toEn(el.value))))));
 const q=lines.reduce((a,b)=>a+b,0);if(!q){X.toast("اكتب عدد ما رجع (قطعة واحدة على الأقل)");return}
 const by=String(X.mode==="branch"?(X.brn||X.code):(X.me.n||X.me.e)).slice(0,60);
 const note=String((g("gfrn")||{}).value||"").trim().slice(0,200);
 if(!confirm(`تسجيل رجوع ${q} من ${N(r.pcs)} قطعة؟ الصافي للتسوية سيكون ${N(r.pcs)-q} قطعة.`))return;
 const rb={e:X.me.e,n:by,at:Date.now(),q,lines};if(note)rb.note=note;
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),{rb}),15000);
  if(X.ping)X.ping([id]);X.toast("↩️ سُجّل رجوع العينة، وأُبلغ المحاسب");if(X.mode==="branch")openBranch();else{closeM();if(X.redraw)X.redraw()}}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
}
// ---------- التسوية (المحاسب) ----------
async function settle(id,el){
 const r=all().find(x=>x.id===id);if(!r||r.st!=="ok")return;
 const near=el&&(el.matches&&el.matches("[data-gfref]")?el:el.parentElement&&el.parentElement.querySelector(`[data-gfref="${globalThis.CSS.escape(id)}"]`));
 const inp=near||[...document.querySelectorAll("[data-gfref]")].find(x=>x.dataset.gfref===id&&x.value.trim())||[...document.querySelectorAll("[data-gfref]")].find(x=>x.dataset.gfref===id),ref=String(inp&&inp.value||"").trim().slice(0,60);
 if(!ref){X.toast("اكتب رقم أو مرجع السند في النظام أولاً");if(inp)inp.focus();return}
 const dup=all().find(x=>x.id!==id&&x.sa&&String(x.sa.ref||"").trim().toLowerCase()===ref.toLowerCase());
 if(dup&&!confirm(`⚠️ المرجع ${ref} مستخدم قبل كده في هدية ${dup.no} (${dup.brn||brName(dup.br)}).\n\nمتأكد إنه نفس المرجع؟`))return;
 if(waitRet(r)&&!confirm(`العينة ${r.no} لم ترجع بعد. تسويتها الآن كاملة (${N(r.pcs)} قطعة)؟\n\nالأفضل الانتظار حتى ترجع وتسوية الصافي فقط.`))return;
 if(!confirm(`تسوية ${r.no} (${r.brn||brName(r.br)} · الصافي ${net(r)} قطعة${r.rb?` بعد رجوع ${retQ(r)}`:""}) بمرجع ${ref}؟\nسيصل الفرع إشعار بأنها خُصمت من مخزونه.`))return;
 const sa={e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60),at:Date.now(),ref,net:net(r)};
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),{st:"set",sa,sm:ymOf(r.ts)}),15000);L.delete(id);OLD.set(id,{...r,st:"set",sa,sm:ymOf(r.ts)});if(X.ping)X.ping([id]);X.toast("🧾 تمت التسوية، وأُبلغ الفرع");{const m=g("gfm");if(m&&m.dataset.v==="view")closeM()}if(X.redraw)X.redraw()}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
}
// ---------- السند ----------
async function showImg(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);
 try{const [s,ex]=await Promise.all([withTimeout(getDoc(doc(X.db,"giftimg",id)),15000),loadExtras(X.db,"giftimg",id)]);const im=s.exists()?s.data().img:"";
  const list=[];if(im)list.push({src:im,del:`giftimg/${id}/img`});ex.forEach(x=>list.push({src:x.src,nm:x.nm,del:"doc:"+x.path}));
  if(!list.length){X.toast("لا توجد صورة سند (ربما حُذفت)");return}
  zoomGallery(list,`سند ${r?r.no:""} · ${r?(r.brn||brName(r.br)):""}`,0);
 }catch(e){X.toast(e&&e.code==="permission-denied"?"غير مسموح لك برؤية هذا السند":"تعذر تحميل السند، تأكد من الإنترنت")}
}
// ---------- التقارير ----------
function reportRows(){return filtered()}
function printReport(){
 const rs=reportRows(),ok=rs.filter(isAp),per={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=net(r)});
 const who=F.br?brName(F.br):"كل الفروع والمستودع",stl=F.st==="ret"?"لم ترجع بعد":F.st?STL[F.st]:"كل الحالات";
 printStmt(`<div class="st"><div class="ph"><h2>${KIND==="s"?"تقرير العينات":"تقرير الهدايا"}</h2><div>${E(today())}</div></div>
 <div class="rt"><div><small>الفرع</small><b><bdi dir="ltr">${E(who)}</bdi></b></div><div><small>الفترة</small><b style="font-size:11pt">${E(F.from||"—")} ← ${E(F.to||today())}</b></div><div><small>الحالة</small><b style="font-size:11pt">${E(stl)}</b></div><div><small>البند</small><b style="font-size:11pt">${E(KIND==="s"?"عينة":(F.why||"كل البنود"))}</b></div></div>
 ${Object.keys(per).length?`<table class="stt" style="margin-bottom:5mm"><thead><tr><th>الفرع</th><th>عدد المعتمد</th><th>قطع (صافي)</th></tr></thead><tbody>${Object.entries(per).map(([k,v])=>`<tr><td>${E(brName(k))}</td><td class="n">${v.n}</td><td class="n">${fmt(v.p)}</td></tr>`).join("")}</tbody></table>`:""}
 <table class="stt"><thead><tr><th>#</th><th>التاريخ</th><th>الفرع</th><th>الرقم</th><th>المستلم</th><th>السبب</th><th>الأصناف</th><th>قطع</th><th>رجع / الصافي</th><th>الحالة</th><th>سجّلها / اعتمدها</th><th>مرجع السند</th></tr></thead><tbody>
 ${rs.map((r,i)=>`<tr><td>${i+1}</td><td>${E(r.dt||"")}</td><td>${E(r.brn||brName(r.br))}</td><td>${E(r.no)}</td><td>${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?"<br>"+E(r.to.ph):""}</td><td>${E(r.why||"")}${r.note?"<br>"+E(r.note):""}</td><td>${E(itemsTxt(r))}</td><td class="n">${N(r.pcs)}</td><td class="n">${r.rb?retQ(r)+" / "+net(r):r.rt===true?"لم ترجع":"—"}</td><td>${E((STL[r.st]||"").replace(/^\S+\s/,""))}${r.st==="no"&&r.ap&&r.ap.note?"<br>"+E(r.ap.note):""}</td><td><bdi>${E(r.by&&r.by.n||"")}</bdi>${r.ap&&r.ap.n?"<br>"+E(r.ap.n):""}</td><td>${r.sa?E(r.sa.ref||"")+"<br>"+E(r.sa.n||""):""}</td></tr>`).join("")||'<tr><td colspan="12" style="text-align:center">لا توجد هدايا</td></tr>'}</tbody></table>
 <div class="tt"><span>العدد ${rs.length}</span><span>المعتمد ${ok.length}</span><span><b>قطع معتمدة (صافي) ${fmt(ok.reduce((s,r)=>s+net(r),0))}</b></span></div>
 <div class="sg"><span>المحاسب</span><span>مدير المستودع</span><span>المدير</span></div></div>`);
}
function csv(){
 const rs=reportRows(),q=v=>{const s=String(v==null?"":v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const head=["التاريخ","الوقت","الفرع","الرقم","المستلم","جوال المستلم","السبب","ملاحظة","الأصناف","عدد القطع","الحالة","سجّلها","اعتمدها/رفضها","وقت الاعتماد","سبب الرفض","فيه سند","مرجع السند في النظام","سوّاها","وقت التسوية","العينة ترجع؟","رجع","الصافي","النوع"];
 const lines=rs.map(r=>[r.dt,new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),r.brn||brName(r.br),r.no,r.to&&r.to.n,r.to&&r.to.ph?`="${r.to.ph}"`:"",r.why,r.note,itemsTxt(r),N(r.pcs),(STL[r.st]||"").replace(/^\S+\s/,""),r.by&&r.by.n,r.ap&&r.ap.n,r.ap&&r.ap.at?new Date(N(r.ap.at)).toLocaleString("en-GB"):"",r.st==="no"&&r.ap?r.ap.note:"",r.img?"نعم":"لا",r.sa?r.sa.ref:"",r.sa?r.sa.n:"",r.sa&&r.sa.at?new Date(N(r.sa.at)).toLocaleString("en-GB"):"",r.rt===true?"نعم":r.rt===false?"لا":"",r.rb?retQ(r):"",isAp(r)?net(r):"",isSample(r)?"عينة":"هدية"].map(q).join(","));
 const blob=new Blob(["﻿"+[head.join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`tasooma-${KIND==="s"?"samples":"gifts"}-${F.br||"all"}-${F.from}-${F.to}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-gf]");if(!t||!X)return;const a=t.dataset.gf,id=t.dataset.id;
 if(a==="noop")return;
 if(a==="kind"){if(id!=="g"&&id!=="s")return;if(KIND!==id){KIND=id;SEC="";SECu=false;F.q="";F.st="";F.why="";F.mine=false;SHOWN=30;SUMOPEN=false;SWAP=true}KINDu=true;try{localStorage.setItem("gf_kind",id)}catch(e){}X.redraw();return}
 if(a==="sec"){if(!SD[id])return;if(SEC!==id){SEC=id;F.q="";SHOWN=30;SWAP=true}SECu=true;X.redraw();return}
 if(a==="fkind"){FK=id==="s"?"s":"g";document.querySelectorAll("#gfkind button").forEach(b=>{const on=b.dataset.id===FK;b.classList.toggle("on",on);b.setAttribute("aria-selected",on)});const w=g("gfwbox"),x=g("gfsbox");if(w)w.hidden=FK==="s";if(x)x.hidden=FK!=="s";return}
 if(a==="per"){F.mine=false;if(id==="c")PER="c";else setPer(id);SHOWN=30;ensureRange().then(()=>X.redraw());return}
 if(a==="fclr"){if(id==="st"||id==="all")F.st="";if(id==="br"||id==="all")F.br="";if(id==="why"||id==="all")F.why="";if(id==="per"||id==="all")setPer("m0");SHOWN=30;ensureRange().then(()=>X.redraw());return}
 if(a==="mine"){F.mine=!F.mine;SHOWN=30;X.redraw();return}
 if(a==="more"){SHOWN+=50;X.redraw();return}
 if(a==="sum"){SUMOPEN=!SUMOPEN;X.redraw();return}
 if(a==="bopen")return void openBranch();
 if(a==="close")return void closeM();
 if(a==="new")return void form(null);
 if(a==="addrow"){const w=g("gfrows");if(w&&w.children.length<100)w.insertAdjacentHTML("beforeend",rowHtml());return}
 if(a==="rmrow"){const w=g("gfrows"),row=t.closest(".gf-row");if(w&&row&&w.children.length>1)row.remove();return}
 if(a==="save")return void save();
 if(a==="img")return void showImg(id);
 if(a==="accadd"||a==="accx")return void loadAcc(id,a==="accadd");
 if(a==="accsave")return void accSave(id);
 if(a==="accimg"){const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);zoomGallery(ACCL.map(x=>({src:x.src,nm:x.nm,del:`doc:giftimg/${id}/a/${x.k}`})),`مرفقات المحاسب · ${r?r.no:""}`,+t.dataset.i||0);
  // لما الصورة تتقفل (أو المالك يمسح واحدة) نحدّث المرفقات في السند
  const zb=g("zbx");if(zb)new MutationObserver((_,o)=>{if(!zb.className){o.disconnect();loadAcc(id,false)}}).observe(zb,{attributes:true,attributeFilter:["class"]});return}
 if(a==="ok"||a==="no")return void decide(id,a==="ok");
 if(a==="okrt"||a==="oknort")return void decide(id,true,a==="okrt");
 if(a==="ret")return void retForm(id);
 if(a==="view")return void viewGift(id);
 if(a==="gprint")return void printGift(id);
 if(a==="retsave")return void retSave(id);
 if(a==="set")return void settle(id,t);
 if(a==="print")return void printReport();
 if(a==="csv")return void csv();
 if(a==="edit"){const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(r&&(isOwner()||canEditMine(r)))form(r);return}
 if(a==="del"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!confirm(`حذف هدية ${r.no} نهائياً مع السند الخاص بها؟`))return;
  try{const b=writeBatch(X.db);b.delete(doc(X.db,"gifts",id));b.delete(doc(X.db,"giftimg",id));await withTimeout(b.commit(),15000);dropExtras(X.db,"giftimg",id);dropAcc(id);L.delete(id);OLD.delete(id);PEND.delete(id);X.toast("حُذفت");closeM();if(X.redraw)X.redraw()}
  catch(e){X.toast("تعذر الحذف")}}
}
function change(e){
 const id=e.target&&e.target.id;if(!X||!["gx-from","gx-to","gx-br","gx-st","gx-why"].includes(id))return;
 const v=e.target.value;SHOWN=30;if(id==="gx-from"||id==="gx-to")PER="c";if(id==="gx-from")F.from=v;if(id==="gx-to")F.to=v;if(id==="gx-br")F.br=v;if(id==="gx-st")F.st=v;if(id==="gx-why")F.why=v;
 if(F.from&&F.to&&F.from>F.to)[F.from,F.to]=[F.to,F.from];
 ensureRange().then(()=>X.redraw());
}
// البحث بيخفي ويظهر السطور على طول (من غير إعادة رسم، علشان الكتابة ماتتقطعش)
// Enter في خانة مرجع السند = تسوية (أسرع للمحاسب)
document.addEventListener("keydown",e=>{const t=e.target;if(e.key!=="Enter"||!t||!t.dataset||!t.dataset.gfref||!X)return;e.preventDefault();settle(t.dataset.gfref,t)});
function input(e){
 if(!X||!e.target||e.target.id!=="gx-q")return;F.q=e.target.value.trim();const q=F.q.toLowerCase();
 document.querySelectorAll(".g5-list .g5-row[data-s]").forEach(el=>{el.hidden=!!q&&!el.dataset.s.includes(q)});
 document.querySelectorAll(".g5-day").forEach(d=>{let n=d.nextElementSibling,any=false;while(n&&!n.classList.contains("g5-day")){if(!n.hidden)any=true;n=n.nextElementSibling}d.hidden=!any});
 const c=document.querySelector(".g5-cnt");if(c)c.textContent=document.querySelectorAll(".g5-list .g5-row:not([hidden])").length+" "+noun()+(q||F.st||F.br||(KIND==="g"&&F.why)?" (مفلترة)":"");
}
