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
import {multiPick,saveExtras,loadExtras,dropExtras} from "./att.js";
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
let ACC=null,ACCL=[];// مرفقات المحاسب: صندوق الاختيار المفتوح، والصور المحمّلة للسند المفتوح
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
.gs-ag img{width:100%;aspect-ratio:1;object-fit:cover;display:block}.gs-ag span{display:block;font-size:11px;line-height:1.35;padding:4px 4px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
@media (max-width:560px){.gs-mt{grid-template-columns:1fr 1fr}.gs-bd{padding:14px 14px 0}.gs-ac{margin:12px -14px 0;padding:12px 14px 16px}.gs-ac .bt{min-width:calc(50% - 4px)}.gs-hd{padding:14px}.gs-rt b{font-size:15px}.gs-tb{font-size:14px}.gs-tb td.k{font-size:15px}}
@media (prefers-color-scheme:dark){.gs-nt{background:#2b2210}.gs-rt>div.to{background:#000}}
.gf-ret{margin-top:8px;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.8;background:#f3efe6;color:#4e2f4a}.gf-ret.w{background:#fff1d6;color:#8a5a00;font-weight:700}.gf-ret.ok{background:#e7f4ec;color:#45512a}.gf-ret.no{background:#f1f1f1;color:#666}
.gf-rt{display:grid;gap:10px;margin-top:14px}.gf-rt button{font:inherit;font-weight:800;font-size:16px;border-radius:14px;padding:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;text-align:start}.gf-rt button small{display:block;font-weight:400;color:var(--mut);font-size:13px;margin-top:2px}.gf-rt button.y{border-color:#b48aab;background:#fff8e6}
.gf-rr{display:grid;grid-template-columns:1fr 90px 100px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)}.gf-rr input{text-align:center;padding:9px 6px}
@media (prefers-color-scheme:dark){.gf-ret{background:#2a261d;color:#e3c8dd}.gf-ret.w{background:#3a2a08;color:#f6c770}.gf-ret.ok{background:#2a301b;color:#b9c68a}.gf-ret.no{background:#262626;color:#aaa}.gf-rt button.y{background:#3d2b40}}
.gf-ref{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}.gf-ref input{flex:1;min-width:180px}
.gf-acc{background:#eef4fb;border:1px solid #9fc0e6;border-radius:16px;padding:12px 14px;margin-bottom:14px}
@media (prefers-color-scheme:dark){.gf-st.set,.gf-set,.gf-acc{background:#14243a;color:#9cc4f0;border-color:#2a4a70}}.gf-st.ok{background:#e3e7cf;color:#45512a}.gf-st.no{background:#f8d9d5;color:#8a2218}
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
@media (prefers-color-scheme:dark){#gfbtn{color:#2a1d2c}}
@media (prefers-color-scheme:dark){.gf-st{background:#3d2b40;color:#e3c8dd}.gf-st.ok{background:#2a301b;color:#b9c68a}.gf-st.no{background:#40191a;color:#f1a5a0}.gf-up.ok{background:#2a301b;color:#b9c68a}.gf-pend{background:#2b2210;border-color:#5f3a59}}
#gfm .bt{font:inherit;font-weight:700;border-radius:12px;padding:10px 16px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}#gfm .bt.s{padding:6px 12px;font-size:13.5px}
#gfm .bt.p{background:#2a1d2c;border-color:#2a1d2c;color:#fff}#gfm .bt.g{background:#b48aab;border-color:#b48aab;color:#2a1d2c}#gfm .bt.r{color:#c4362b;border-color:#c4362b}#gfm .bt:disabled{opacity:.6}
@media print{.gfm{display:none!important}}
/* ===== التصميم الرابع: ابسط وأجمل ===== */
.g4{--g4r:18px}
.g4-hd{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:0 0 14px}.g4-hd h2{margin:0 0 8px;font-size:22px}
.g4-per{display:flex;gap:6px;flex-wrap:wrap}.g4-per button{font:inherit;font-size:13.5px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--mut);border-radius:999px;padding:6px 14px;cursor:pointer;transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out),border-color var(--duration-quick) var(--ease-out)}
.g4-per button.on{background:#2a1d2c;border-color:#2a1d2c;color:#fff}
.g4-hb{display:flex;gap:8px;margin-inline-start:auto}.g4-hb .bt{width:auto;margin:0}
.g4-ks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}
.g4-k{display:flex;align-items:center;gap:12px;text-align:start;font:inherit;color:var(--ink);background:var(--card);border:1.5px solid transparent;border-radius:var(--g4r);padding:14px 16px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .18s,box-shadow .18s,border-color .18s}
.g4-k:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.08)}.g4-k.on{border-color:#b48aab}
.g4-k .ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:var(--soft);flex:none}
.g4-k b{display:block;font-size:26px;line-height:1.15}.g4-k small{display:block;color:var(--mut);font-size:12.5px}
.g4-k.g .ic{background:#e7f4ec}.g4-k.w .ic{background:#fff1d6}.g4-k.b .ic{background:#e3eefb}.g4-k.o .ic{background:#fdeee0}
.g4-k.w b{color:#a46a00}.g4-k.b b{color:#1c4f86}.g4-k.o b{color:#b4541c}
.g4-box{background:var(--card);border-radius:var(--g4r);padding:16px;margin:0 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.g4-todo{background:linear-gradient(180deg,#fffaf0,var(--card) 70%);border:1.5px solid #e8d0e2}
.g4-bh{display:flex;align-items:center;gap:8px;margin:0 0 6px}.g4-bh h3{margin:0;font-size:17px;display:flex;gap:8px;align-items:center}
.g4-n{background:#c4362b;color:#fff;border-radius:999px;font-size:12.5px;padding:1px 9px}.g4-lnk{margin-inline-start:auto;border:0;background:none;color:var(--acc,#8a5a83);font:inherit;font-weight:700;cursor:pointer}
.g4-td,.g4-ln{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:14px;cursor:pointer;position:relative;transition:background .15s}
.g4-td:hover,.g4-ln:hover{background:rgba(180,138,171,.08)}.g4-td+.g4-td{border-top:1px solid var(--line)}
.g4-av{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:none;font-weight:800;font-size:14px;background:#2a1d2c;color:#e3c8dd;letter-spacing:.5px}.g4-av.wh{background:var(--soft);font-size:20px}
.g4-mid{flex:1;min-width:0}.g4-mid b{display:block;font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g4-mid small{display:block;color:var(--mut);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g4-it{opacity:.85}
.g4-why{color:var(--ink);font-weight:700}
.g4-end{text-align:end;flex:none}.g4-end>b{font-size:20px;display:block;line-height:1.1}.g4-end>b small{font-size:12px;color:var(--mut);font-weight:400}
.g4-tags{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;margin-top:4px}.g4-mid .g4-tags{justify-content:flex-start}
.g4-st{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap;background:var(--soft);color:var(--mut)}
.g4-st.w{background:#fff1d6;color:#8a5a00}.g4-st.ok{background:#e7f4ec;color:#45512a}.g4-st.b{background:#e3eefb;color:#1c4f86}.g4-st.r{background:#fbe3e0;color:#9b2a1f}
.g4-act{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;cursor:default}.g4-act .bt{width:auto;margin:0}.g4-act input{width:150px;height:34px;padding:5px 10px;margin:0}
.g4-clip{border:0;background:var(--soft);border-radius:10px;width:34px;height:34px;cursor:pointer;flex:none}
.g4-bar1{display:flex;gap:8px;align-items:center}
.g4-bar1>.g4-search{min-width:0}.g4-search input{min-width:0;width:100%}.g4-bar1>.g4-fbtn{flex:none}
.g4-search{flex:1;display:flex;align-items:center;gap:8px;background:var(--field,#f2e9dd);border-radius:14px;padding:0 12px;border:1.5px solid transparent;transition:border-color .2s}.g4-search:focus-within{border-color:#b48aab}
.g4-search input{border:0;background:none;height:46px;flex:1;margin:0;padding:0;outline:none;box-shadow:none}
.g4-fbtn{font:inherit;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:14px;height:46px;padding:0 14px;cursor:pointer;white-space:nowrap}.g4-fbtn.on{border-color:#b48aab;background:#fff8e6}
.g4-chips{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px}.g4-chips button{font:inherit;font-size:13.5px;border:0;background:var(--soft);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer;transition:background-color var(--duration-quick) var(--ease-out),color var(--duration-quick) var(--ease-out)}.g4-chips button.on{background:#b48aab;color:#2a1d2c;font-weight:700}
.g4-adv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 4px;padding:12px;background:var(--soft);border-radius:14px;animation:ui-up .25s ease both}
.g4-adv label{display:flex;flex-direction:column;gap:4px;margin:0}.g4-adv small{color:var(--mut);font-size:12px;font-weight:700}.g4-adv select,.g4-adv input{width:100%;height:42px;margin:0}
.g4-cnt{color:var(--mut);font-size:13px;font-weight:700;margin:10px 4px 4px}
.g4-day{font-size:13px;font-weight:800;color:var(--mut);margin:14px 6px 4px;display:flex;align-items:center;gap:10px}.g4-day::after{content:"";flex:1;height:1px;background:var(--line)}
.g4-list .g4-ln+.g4-ln{border-top:1px solid var(--line)}
.g4-more{display:block;width:100%;margin-top:10px;font:inherit;font-weight:700;border:1.5px dashed var(--line);background:none;color:var(--ink);border-radius:14px;padding:12px;cursor:pointer}
.g4-empty{text-align:center;color:var(--mut);padding:34px 10px;font-size:15px}.g4-empty span{display:block;font-size:44px;margin-bottom:6px;animation:ui-float 3s ease-in-out infinite}
.g4-sumh{width:100%;display:flex;justify-content:space-between;align-items:center;font:inherit;font-weight:800;font-size:15.5px;border:0;background:none;color:var(--ink);cursor:pointer;padding:2px}
.g4-sum{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:12px;animation:ui-up .25s ease both}.g4-sum h4{margin:0 0 8px;color:var(--mut);font-size:13.5px}
.g4-bar{display:grid;grid-template-columns:minmax(80px,140px) 1fr auto;gap:10px;align-items:center;margin:8px 0;font-size:14px}.g4-bar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g4-bar i{height:10px;border-radius:6px;background:var(--soft);overflow:hidden}.g4-bar u{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#b48aab,#e3c8dd);transform-origin:right;animation:g4-grow .7s cubic-bezier(.2,.8,.2,1) both}
.g4-bar em{font-style:normal;font-weight:800}
@keyframes g4-grow{from{transform:scaleX(0)}to{transform:none}}
.g4-rp{white-space:normal;max-width:100%}
.gs-rep{background:#fdecea;color:#8a2218;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:13.5px;line-height:1.8}.gs-rep b{display:block;font-size:14.5px}
@media (prefers-color-scheme:dark){.g4-rp{white-space:normal;max-width:100%}
.gs-rep{background:#40191a;color:#f1a5a0}}
.gs-set{display:flex;gap:8px;flex-wrap:wrap;align-items:center;width:100%;padding:10px;border-radius:14px;background:#eef4fb;margin-bottom:4px}.gs-set input{flex:1;min-width:160px;margin:0}.gs-set .bt{flex:none!important;min-width:0!important}
@media (prefers-color-scheme:dark){.gs-set{background:#14243a}}
/* ===== الكروت التفاعلية + لوحة الشغل + الفلاتر الجديدة ===== */
.g4-k{position:relative;overflow:hidden}.g4-k .tx{flex:1;min-width:0}.g4-k em{display:block;font-style:normal;font-size:11.5px;color:var(--mut);margin-top:2px;opacity:0;transform:translateY(4px);transition:opacity var(--duration-quick) var(--ease-out),transform var(--duration-quick) var(--ease-smooth-out)}
.g4-k:hover em,.g4-k.on em,.g4-k.mine em{opacity:1;transform:none}
.g4-k .g4-car{position:absolute;bottom:6px;left:12px;font-size:10px;color:var(--mut);opacity:.6}
.g4-k.on{border-color:#b48aab;box-shadow:0 10px 26px rgba(138,90,131,.18);transform:translateY(-2px)}
.g4-k.on::after{content:"";position:absolute;inset:auto 0 0 0;height:4px;background:linear-gradient(90deg,#b48aab,#e3c8dd)}
.g4-me{position:absolute;top:10px;left:12px;display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;color:#c4362b}
.g4-me i{width:8px;height:8px;border-radius:50%;background:#c4362b;box-shadow:0 0 0 0 rgba(196,54,43,.5);animation:g4-ping 1.6s infinite}
@keyframes g4-ping{0%{box-shadow:0 0 0 0 rgba(196,54,43,.55)}70%{box-shadow:0 0 0 8px rgba(196,54,43,0)}100%{box-shadow:0 0 0 0 rgba(196,54,43,0)}}
.g4-work{background:var(--card);border-radius:var(--g4r);padding:16px;margin:-4px 0 14px;box-shadow:0 10px 28px rgba(0,0,0,.08);border-top:4px solid #b48aab;animation:g4-open .32s cubic-bezier(.2,.8,.2,1) both;scroll-margin-top:90px}
.g4-work.w{border-top-color:#e0a42a}.g4-work.b{border-top-color:#2a78d6}.g4-work.o{border-top-color:#d9772f}.g4-work.sum{border-top-color:#6f7d45}
@keyframes g4-open{from{opacity:0;transform:translateY(-8px) scale(.99)}to{opacity:1;transform:none}}
.g4-wh{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}.g4-wh .ic{font-size:26px;width:46px;height:46px;border-radius:14px;background:var(--soft);display:grid;place-items:center;flex:none}
.g4-wh h3{margin:0;font-size:18px;display:flex;gap:8px;align-items:center}.g4-wh small{display:block;color:var(--mut);font-size:13px;line-height:1.7;margin-top:2px}.g4-wh>div{flex:1}
.g4-x{border:0;background:var(--soft);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:14px;color:var(--mut);flex:none;transition:background .2s}.g4-x:hover{background:#efe5ea}
.g4-prog{margin:4px 0 8px;background:var(--soft);border-radius:14px;padding:10px 12px}.g4-prog>div{display:flex;justify-content:space-between;font-size:13px;color:var(--mut);margin-bottom:6px}.g4-prog b{color:var(--ink)}
.g4-prog i{display:block;height:8px;border-radius:6px;background:rgba(0,0,0,.06);overflow:hidden}.g4-prog u{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#6f7d45,#6cc27a);transition:width .6s cubic-bezier(.2,.8,.2,1)}
.g4-work .g4-td{animation:ui-up .35s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*30ms)}
.g4-empty.sm{padding:18px}.g4-empty.sm span{font-size:30px}
/* الفلاتر: أقراص بأيقونة، من غير عناوين فوق (كانت بتنزل وتبان مكسورة) */
.g4-fbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 4px;animation:ui-up .25s ease both}
.g4-fc{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 6px 0 12px;margin:0;border-radius:999px;background:var(--soft);border:1.5px solid transparent;transition:background-color var(--duration-quick) var(--ease-out),border-color var(--duration-quick) var(--ease-out);color:var(--ink);max-width:100%}
.g4-fc.on{background:#fff8e6;border-color:#b48aab}.g4-fc .fi{font-size:15px}
.g4-fc select,.g4-fc input{border:0!important;background:none!important;box-shadow:none!important;height:38px!important;padding:0 4px!important;margin:0!important;font:inherit;font-size:14px;font-weight:700;color:var(--ink);outline:none;width:auto;min-width:0;line-height:38px;-webkit-appearance:none;appearance:none;cursor:pointer}
.g4-fc select{padding-inline-end:18px!important;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238a8478'/%3E%3C/svg%3E") no-repeat left 4px center!important}
.g4-fc input[type=date]{width:130px}.g4-fc .fa{color:var(--mut);font-weight:800}
.g4-fc .fx{border:0;background:rgba(0,0,0,.08);width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:11px;color:var(--ink)}
.g4-fclr{border:0;background:none;color:#c4362b;font:inherit;font-weight:700;cursor:pointer;padding:0 6px}
.g4-fn{background:#b48aab;color:#2a1d2c;border-radius:999px;font-size:12px;padding:0 7px}
.g4-new{box-shadow:0 6px 16px rgba(0,0,0,.18);transition:transform .15s}.g4-new:hover{transform:translateY(-1px)}
.g4-ib{display:inline-flex;align-items:center;gap:6px}.g4-ib span{font-size:13px}
@media (max-width:600px){.g4-ib span{display:none}.g4-fc{flex:1 1 100%}.g4-fc select{flex:1}.g4-fc input[type=date]{flex:1;width:auto}.g4-me{top:6px;left:8px}.g4-k em{display:none}}
@media (prefers-color-scheme:dark){.g4-fc.on{background:#2b2210}.g4-x:hover{background:#3d2b40}.g4-prog i{background:rgba(255,255,255,.08)}}

/* الحركة: أول ما التبويب يفتح بس (الكروت والسطور بتطلع ورا بعض) */
.g4.anim .g4-k{animation:ui-up .45s cubic-bezier(.2,.8,.2,1) both}.g4.anim .g4-k:nth-child(2){animation-delay:.05s}.g4.anim .g4-k:nth-child(3){animation-delay:.1s}.g4.anim .g4-k:nth-child(4){animation-delay:.15s}
.g4.anim .g4-ln,.g4.anim .g4-td{animation:ui-up .4s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*35ms + .12s)}
@media (max-width:900px){.g4-ks{grid-template-columns:repeat(2,minmax(0,1fr))}.g4-adv{grid-template-columns:repeat(2,minmax(0,1fr))}.g4-sum{grid-template-columns:1fr}}
@media (max-width:600px){.g4-hd h2{font-size:19px}.g4-k{padding:12px}.g4-k .ic{width:38px;height:38px;font-size:18px;border-radius:12px}.g4-k b{font-size:21px}
 .g4-td{flex-wrap:wrap}.g4-act{width:100%;justify-content:flex-start}.g4-act input{flex:1;min-width:120px}.g4-av{width:38px;height:38px;font-size:12.5px}.g4-it{display:none!important}}
@media (prefers-color-scheme:dark){.g4-todo{background:linear-gradient(180deg,#2a2210,var(--card) 70%);border-color:#4e2f4a}.g4-fbtn.on{background:#2b2210}
 .g4-st.w{background:#3a2a08;color:#f6c770}.g4-st.ok{background:#2a301b;color:#b9c68a}.g4-st.b{background:#14243a;color:#9cc4f0}.g4-st.r{background:#40191a;color:#f1a5a0}
 .g4-k.g .ic{background:#2a301b}.g4-k.w .ic{background:#3a2a08}.g4-k.b .ic{background:#14243a}.g4-k.o .ic{background:#3a2210}.g4-k.w b{color:#f6c770}.g4-k.b b{color:#9cc4f0}.g4-k.o b{color:#f0a070}.g4-per button.on{background:#b48aab;border-color:#b48aab;color:#2a1d2c}}

/* ===== التصميم التالت (على نفس ستايل العهدة) ===== */
.gx-bal{gap:22px}.gx-bal>div.w b{color:#f6c770}
.row2 .bar em{white-space:nowrap}.row2 .bar span{min-width:90px}.gx-todo{margin-bottom:16px;border:1.5px solid #d8b4cf}.gx-todo h3{display:flex;align-items:center;gap:8px}
.gx-n{background:#c4362b;color:#fff;border-radius:999px;font-size:13px;padding:1px 9px}
.gx-done{text-align:center;color:var(--mut);padding:14px;font-size:15px}
.pan .gx-f{background:none;border:0;padding:0;grid-template-columns:1.6fr repeat(5,minmax(0,1fr))}
tr.gx-tr{cursor:pointer}tr.gx-tr:hover td{background:rgba(180,138,171,.08)}
tr.gx-tr td{vertical-align:middle}tr.gx-tr td b{display:block;font-size:14.5px}tr.gx-tr td small{display:block;color:var(--mut);font-size:12.5px}
td.gx-it{font-size:13.5px;max-width:260px}td.gx-q{text-align:center}td.gx-q b{font-size:18px}
td.gx-act{cursor:default}td.gx-act>*{vertical-align:middle;margin:2px}td.gx-it span,td.gx-it bdi{white-space:nowrap}td.gx-act input{width:170px;height:34px;padding:5px 9px;display:inline-block}
.gx-need{display:inline-block;background:#f2e5ee;color:#5f3a59;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700}.gx-need.b{background:#dde9f7;color:#1c4f86}.gx-need.w{background:#fff1d6;color:#8a5a00}
@media (max-width:1100px){th.gx-ith,td.gx-it{display:none}.pan .gx-f{grid-template-columns:repeat(2,minmax(0,1fr))}.pan .gx-f .gx-q{grid-column:1/-1}}
@media (max-width:760px){.row2{grid-template-columns:1fr}.gx-bal{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gx-bal>div:first-child{grid-column:1/-1}.gx-bal small{display:block}.gx-bal b{display:block}td.gx-act input{width:140px}}
@media (prefers-color-scheme:dark){.gx-need{background:#3d2b40;color:#e3c8dd}.gx-need.b{background:#14243a;color:#9cc4f0}.gx-need.w{background:#3a2a08;color:#f6c770}.gx-todo{border-color:#5f3a59}}

/* ===== تبويب المستودع الجديد (أقسام + سطور مضغوطة) ===== */
.gx-hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px}.gx-hd h2{margin:0}.gx-hd small{color:var(--mut);font-size:13px}.gx-hd>.bt{margin-inline-start:auto;width:auto}
.gx-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;border-bottom:2px solid var(--line);padding-bottom:0}
.gx-tabs button{font:inherit;font-weight:700;font-size:14.5px;border:0;background:none;color:var(--mut);padding:10px 14px;border-radius:12px 12px 0 0;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}
.gx-tabs button.on{color:var(--ink);border-bottom-color:#b48aab;background:var(--card)}
.gx-tabs button i{font-style:normal;background:#c4362b;color:#fff;border-radius:999px;padding:0 8px;font-size:12px;margin-inline-start:4px}
.gx-f{display:grid;grid-template-columns:1.4fr repeat(5,minmax(0,1fr)) auto;gap:10px;align-items:end;margin:0 0 12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.gx-f.q{grid-template-columns:2fr 1fr 1fr}
.gx-f>div{display:flex;flex-direction:column;gap:4px;min-width:0}.gx-f small{color:var(--mut);font-size:12px;font-weight:700}
.gx-f input,.gx-f select{width:100%;height:42px;margin:0}
.gx-f .gx-out{flex-direction:row;gap:8px}.gx-f .gx-out .bt{height:42px;white-space:nowrap;margin:0;width:auto}
@media (max-width:1100px){.gx-f{grid-template-columns:repeat(2,minmax(0,1fr))}.gx-f .gx-q,.gx-f .gx-out{grid-column:1/-1}.gx-f .gx-out .bt{flex:1}.gx-f.q{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gx-hint{color:var(--mut);font-size:13.5px;margin:0 0 10px}.gx-cnt{color:var(--mut);font-size:13.5px;margin:0 0 8px;font-weight:700}
.gx-list{background:var(--card);border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.gx-ln{display:grid;grid-template-columns:70px minmax(120px,1.1fr) minmax(160px,2fr) 70px minmax(200px,auto);gap:12px;align-items:center;padding:11px 14px;border-bottom:1px solid var(--line);cursor:pointer;border-inline-start:5px solid #b48aab}
.gx-ln:last-child{border-bottom:0}.gx-ln:hover{background:rgba(180,138,171,.07)}
.gx-ln.st-ok{border-inline-start-color:#6f7d45}.gx-ln.st-set{border-inline-start-color:#2a78d6}.gx-ln.st-no{border-inline-start-color:#c4362b}
.gx-ln b{display:block;font-size:14.5px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gx-ln small{display:block;color:var(--mut);font-size:12.5px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gx-c4{text-align:center}.gx-c4 b{font-size:19px}
.gx-c5{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;cursor:default}.gx-c5 .bt{width:auto;margin:0}.gx-c5 input{width:170px;height:36px;margin:0;padding:6px 10px}
.gx-why{display:inline-block;background:var(--soft);border-radius:7px;padding:0 7px;font-weight:700;color:var(--ink)}.gx-more{font-weight:700}
.gx-warn{background:#fff1d6;color:#8a5a00;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}.gx-ok{background:#e7f4ec;color:#45512a;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}
.gx-ic{padding:6px 9px!important}
.gx-empty{background:var(--card);border-radius:16px;padding:28px;text-align:center;color:var(--mut);font-size:15px}
.gx-kp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:0 0 12px}.gx-k{background:var(--card);border-radius:14px;padding:12px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.06);border-top:4px solid var(--line)}
.gx-k b{display:block;font-size:24px}.gx-k small{color:var(--mut);font-size:12.5px}.gx-k.ok{border-top-color:#6f7d45}.gx-k.w{border-top-color:#b48aab}.gx-k.b{border-top-color:#2a78d6}.gx-k.r{border-top-color:#c4362b}
.gx-2{display:grid;grid-template-columns:1.4fr 1fr;gap:12px}.gx-2 .pan h3{margin:0 0 8px}
@media (max-width:900px){.gx-kp{grid-template-columns:repeat(3,minmax(0,1fr))}.gx-2{grid-template-columns:1fr}}
@media (max-width:760px){.gx-ln{grid-template-columns:56px 1fr 56px;gap:4px 10px}.gx-c3{grid-column:2/4}.gx-c2{grid-column:2}.gx-c1{grid-row:1/3}.gx-c5{grid-column:1/-1;justify-content:flex-start}.gx-c5 input{flex:1;min-width:140px}.gx-tabs button{padding:8px 10px;font-size:13.5px}}
@media (prefers-color-scheme:dark){.gx-warn{background:#3a2a08;color:#f6c770}.gx-ok{background:#2a301b;color:#b9c68a}}

`;
const all=()=>{const m=new Map([...OLD,...L,...LS,...PEND]);return [...m.values()]};
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
  const draw=()=>{if(X&&X.tab()==="gift")X.redraw();else if(X&&X.badge)X.badge()};
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
 }
 if(!window.__gfc){window.__gfc=1;document.addEventListener("click",click);document.addEventListener("change",change);document.addEventListener("input",input)}
}
export function stopGifts(){un.forEach(f=>f());un=[];VT="";VTu=false;ANIM=true;SHOWN=30;WK=null;WKu=false;if(bun){bun();bun=null}BL=[];{const b=g("gfbtn");if(b)b.remove()}L=new Map();LS=new Map();PEND=new Map();OLD=new Map();MON=new Set();closeM()}
export const pendingCount=()=>PEND.size;
// للتقرير الأسبوعي (short.js): الهدايا من تاريخ معيّن، والصافي
export const giftsSince=t=>all().filter(r=>N(r.ts)>=t);
export const giftNet=r=>net(r);
// ---------- الفرع: زرار فوق + نافذة فيها هداياه ----------
function addBranchButton(){
 if(g("gfbtn"))return;const me=g("me");if(!me)return;
 const b=document.createElement("button");b.id="gfbtn";b.type="button";b.dataset.gf="bopen";
 me.parentNode.insertBefore(b,me.nextSibling);paintBtn();
 if(!bun)bun=onSnapshot(query(collection(X.db,"gifts"),where("br","==",X.code)),sn=>{BL=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>N(b.ts)-N(a.ts));paintBtn();if(g("gfm")&&g("gfm").dataset.v==="list")paintBranch()},e=>{});
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
 <div style="margin-top:14px">${BL.length?BL.slice(0,40).map(r=>card(r,false)).join(""):'<div class="m" style="text-align:center;padding:20px;color:var(--mut)">لا توجد هدايا مسجّلة بعد</div>'}</div>
 <div class="gf-act"><button class="b" data-gf="close" type="button">إغلاق</button></div>`,"list");
}
// ---------- الكارت ----------
function card(r,wh,setUi){// setUi = خانة مرجع السند (في قسم "بانتظار التسوية" بس، علشان ماتتكررش)
 const st=r.st||"pend",ap=r.ap||{};
 return `<div class="gf-card ${st}"><h4 data-gf="view" data-id="${E(r.id)}" title="فتح الهدية">${wh?`<bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi>`:""}<span class="gf-st ${st}">${STL[st]||st}</span><small class="m"><bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.dt||"")}</small></h4>
 <div class="m">👤 ${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?` · <bdi dir="ltr">${E(r.to.ph)}</bdi>`:""} · 🏷 ${E(r.why||"")}${r.note?` · ${E(r.note)}`:""}</div>
 <div class="gf-it">${(Array.isArray(r.rows)?r.rows:[]).map(x=>`<span><bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi> × <b>${N(x.q)}</b></span>`).join("")}</div>
 <div class="m">سجّلها: <bdi>${E(r.by&&r.by.n||"")}</bdi> · ${hm(r.ts)} · ${N(r.pcs)} قطعة${st!=="pend"&&ap.n?` · ${st==="no"?"رفضها":"اعتمدها"}: ${E(ap.n)} ${hm(ap.at)}`:""}${st==="no"&&ap.note?`<br><b style="color:#c4362b">سبب الرفض: ${E(ap.note)}</b>`:""}</div>
 ${retHtml(r)}
 ${st==="set"&&r.sa?`<div class="gf-set">🧾 تمت التسوية${wh?` بواسطة ${E(r.sa.n||"")}`:""} · ${hm(r.sa.at)} · مرجع السند: <b dir="ltr">${E(r.sa.ref||"")}</b>${r.sa.net!=null&&N(r.sa.net)!==N(r.pcs)?` · الصافي المسوّى ${N(r.sa.net)} قطعة`:""}${wh?"":`<br><small>خصم المحاسب هذه الهدية من مخزون الفرع في النظام</small>`}</div>`:""}
 ${wh&&setUi&&canSettle()&&st==="ok"?`${waitRet(r)?'<div class="gf-ret w" style="margin-top:10px">⏳ انتظر رجوع العينة قبل التسوية، فالصافي قد يتغيّر</div>':""}${r.rb?`<div class="gf-ret ok" style="margin-top:10px">🧮 سوِّ الصافي فقط: <b>${net(r)} قطعة</b> (طلع ${N(r.pcs)} − رجع ${retQ(r)})</div>`:""}<div class="gf-ref"><input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="رقم / مرجع السند في النظام"><button class="bt s g" data-gf="set" data-id="${E(r.id)}" type="button">✔ تمت التسوية</button></div>`:""}
 <div class="gf-b"><button class="bt s p" data-gf="view" data-id="${E(r.id)}" type="button">📄 ${wh?"فتح السند":"فتح الهدية"}</button>${canRet(r)?`<button class="bt s g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}${r.img?`<button class="bt s" data-gf="img" data-id="${E(r.id)}" type="button">📎 السند</button>`:'<span class="m">بدون مرفق</span>'}
 ${wh&&canApprove()&&st==="pend"?`<button class="bt s g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${isOwner()?`<button class="bt s" data-gf="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button><button class="bt s" data-gf="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`:""}</div></div>`;
}
// ---------- تبويب المستودع (التصميم الرابع، 12 نوفمبر 2026: "ابسط وأجمل، ولسه هتكتر") ----------
// الفكرة: صفحة هادية تتقري في ثانية، وتفضل مرتبة لما الهدايا تبقى بالمئات:
//   1) 4 كروت أرقام بس (بتتحرك وهي بتعد، والضغط عليها بيفلتر)
//   2) 📥 مطلوب منك: كروت صغيرة بالإجراء (أول 4، والباقي بزرار)، وبتختفي خالص لو مفيش حاجة
//   3) القايمة: بحث + أزرار حالة، والفلاتر التانية مقفولة تحت "فلاتر". متقسمة بالأيام (اليوم، أمس...) و30 سطر وبعدين "عرض المزيد"
//   4) الملخص (لكل بند ولكل فرع) مقفول تحت زرار، علشان مايزحمش الصفحة
const whyOk=r=>!F.why||(F.why==="أخرى"?(r.why==="أخرى"||!WHY.includes(r.why)):r.why===F.why);
const brWhy=r=>(!F.br||r.br===F.br)&&whyOk(r);
const sText=r=>[r.no,r.brn,r.to&&r.to.n,r.to&&r.to.ph,r.why,r.note,r.by&&r.by.n,...(Array.isArray(r.rows)?r.rows.map(x=>[x.k,x.c,x.z].join(" ")):[])].filter(Boolean).join(" ").toLowerCase();
const sOk=r=>!F.q||sText(r).includes(F.q.toLowerCase());
let VT="",VTu=false,PER="m0",SHOWN=30,FOPEN=false,SUMOPEN=false,TODOALL=false,ANIM=true;
const ymd=d=>d.toLocaleDateString("en-CA");
function setPer(p){
 PER=p;const n=new Date(),y=n.getFullYear(),m=n.getMonth();
 if(p==="m0"){F.from=ymd(new Date(y,m,1));F.to=today()}
 else if(p==="m1"){F.from=ymd(new Date(y,m-1,1));F.to=ymd(new Date(y,m,0))}
 else if(p==="m3"){F.from=ymd(new Date(y,m-2,1));F.to=today()}
}
function filtered(){
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0,b=F.to?new Date(F.to+"T23:59:59").getTime():Infinity;
 return all().filter(r=>N(r.ts)>=a&&N(r.ts)<=b&&brWhy(r)&&(!F.st||(F.st==="ret"?waitRet(r):r.st===F.st))).sort((x,y)=>N(y.ts)-N(x.ts));
}
function queues(){
 return {
  ap:canApprove()?[...PEND.values()].sort((a,b)=>N(a.ts)-N(b.ts)):null,
  set:canSettle()?all().filter(r=>r.st==="ok").sort((a,b)=>N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at)):null,
  ret:!X.noNew&&!X.view?all().filter(r=>canRet(r)).sort((a,b)=>N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at)):null};
}
const short=r=>{const R=Array.isArray(r.rows)?r.rows:[];return R.slice(0,2).map(x=>`<bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi> × ${N(x.q)}`).join("، ")+(R.length>2?` <span style="font-weight:800">+${R.length-2}</span>`:"")};
const tShort=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
// 🔁 (12 نوفمبر 2026) المستلم المتكرر: نفس رقم الجوال (آخر 9 أرقام) أخد هدايا تانية في 30 يوم (من أي فرع، غير المرفوض).
// ولو مفيش جوال: نفس الاسم بالظبط في نفس الفرع. بيظهر لمدير التسويق وهو بيعتمد، وفي السجل والسند.
const phK=p=>{const d=toEn(String(p||"")).replace(/\D/g,"");return d.length>=8?d.slice(-9):""};
const nmK=n=>String(n||"").replace(/\s+/g," ").trim().toLowerCase();
function repOf(r){
 if(!r||!r.to)return null;const k=phK(r.to.ph),nk=nmK(r.to.n),t=N(r.ts),W=30*864e5;
 if(!k&&!nk)return null;
 const L=all().filter(x=>x.id!==r.id&&x.st!=="no"&&Math.abs(N(x.ts)-t)<=W&&x.to&&(k?phK(x.to.ph)===k:(x.br===r.br&&!phK(x.to.ph)&&nmK(x.to.n)===nk)));
 return L.length?{n:L.length,p:L.reduce((a,x)=>a+net(x),0),by:k?"ph":"nm",brs:[...new Set(L.map(x=>x.brn||brName(x.br)))]}:null;
}
const repTag=r=>{const x=repOf(r);return x?`<span class="g4-st r g4-rp" title="${E((x.by==="ph"?"الجوال نفسه":"الاسم نفسه")+" استلم "+(x.n===1?"هدية أخرى":x.n===2?"هديتين أخريين":x.n+" هدايا أخرى")+" خلال 30 يوماً"+(x.p?" ("+x.p+" قطعة)":"")+" · "+x.brs.join("، "))}">🔁 ${x.by==="ph"?"الجوال":"الاسم"} مكرّر ×${x.n+1} في 30 يوماً</span>`:""};
const av=r=>r.br==="WH"?`<span class="g4-av wh">🏭</span>`:`<span class="g4-av">${E(String(r.br||"").slice(0,3))}</span>`;
const dayKey=t=>new Date(N(t)).toDateString();
function dayLbl(t){const d=new Date(N(t)),n=new Date(),y=new Date(Date.now()-864e5);if(d.toDateString()===n.toDateString())return "اليوم";if(d.toDateString()===y.toDateString())return "أمس";
 return d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"})}
const ST4={pend:["⏳","بانتظار الاعتماد","w"],ok:["✅","معتمدة","ok"],set:["🧾","تمت التسوية","b"],no:["❌","مرفوضة","r"]};
const stTag=r=>{const s=accOnly()&&r.st==="ok"?["⏳","بانتظار التسوية","w"]:(ST4[r.st]||ST4.pend);return `<span class="g4-st ${s[2]}">${s[0]} ${s[1]}</span>${r.st==="pend"&&X.mode!=="branch"?repTag(r):""}${r.rt===true&&!r.rb&&isAp(r)?'<span class="g4-st w">↩️ لم ترجع</span>':""}${r.rb?`<span class="g4-st ok">↩️ صافي ${net(r)}</span>`:""}`};
// سطر في القايمة
const line=(r,i)=>`<div class="g4-ln" data-gf="view" data-id="${E(r.id)}" data-s="${E(sText(r))}" ${sOk(r)?"":"hidden"} style="--i:${Math.min(i,12)}">
 ${av(r)}<div class="g4-mid"><b>${E(r.to&&r.to.n||"")}</b><small><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi> · <span class="g4-why">${E(r.why||"")}</span> · ${tShort(r.ts)}</small><small class="g4-it">${short(r)}</small></div>
 <div class="g4-end"><b>${r.rb?net(r):N(r.pcs)}<small> قطعة</small></b><div class="g4-tags">${stTag(r)}</div></div>${r.img?`<button class="g4-clip" data-gf="img" data-id="${E(r.id)}" type="button" title="صورة السند">📎</button>`:""}</div>`;
// كارت "مطلوب منك"
function todoCard(r,k,i){
 const act=k==="ap"?`<button class="bt s g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${E(r.id)}" type="button">رفض</button>`
  :k==="set"?`<input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="مرجع السند"><button class="bt s ${waitRet(r)?"":"g"}" data-gf="set" data-id="${E(r.id)}" type="button" ${waitRet(r)?'title="العينة لم ترجع بعد: الأفضل الانتظار وتسوية الصافي"':""}>✔ ${waitRet(r)?"تسوية كاملة":"تسوية"} ${net(r)}</button>`
  :`<button class="bt s g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`;
 const tag=k==="ap"?'<span class="g4-st w">⏳ اعتماد</span>':k==="set"?`<span class="g4-st b">🧾 تسوية</span>${waitRet(r)?'<span class="g4-st w">↩️ لم ترجع بعد</span>':""}`:'<span class="g4-st w">↩️ عينة يجب أن ترجع</span>';
 return `<div class="g4-td" data-gf="view" data-id="${E(r.id)}" style="--i:${i}">${av(r)}<div class="g4-mid"><b>${E(r.to&&r.to.n||"")}</b><small><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi> · <span class="g4-why">${E(r.why||"")}</span> · ${r.rb?net(r):N(r.pcs)} قطعة</small><div class="g4-tags">${tag}</div></div><div class="g4-act" data-gf="noop">${act}</div></div>`;
}
// ---------- الكروت التفاعلية (12 نوفمبر 2026، طلب محمد: "خلي البطاقات تفاعلية تساعد المديرين والمحاسبين") ----------
// كل كارت بيفتح تحته "لوحة شغل": الحاجات دي بالظبط، والإجراء جنب كل واحدة، ومعاها "أنجزت النهارده" وشريط تقدّم.
// الكارت اللي عليه شغل ليك انت بيبقى عليه نقطة بتنبض و"لك". وأول ما تفتح الهدايا بتتفتح لوحدها أول لوحة فيها شغل ليك.
let WK=null,WKu=false;// اللوحة المفتوحة، وهل المستخدم اختارها بنفسه
const isToday=t=>N(t)&&new Date(N(t)).toDateString()===new Date().toDateString();
const meE=()=>String(X&&X.me&&X.me.e||"").toLowerCase();
const WKD={
 ap:{ic:"⏳",t:"بانتظار الاعتماد",hint:"الأقدم أولاً. اعتمد أو ارفض من هنا، أو اضغط على الهدية لترى السند كاملاً.",who:"مدير التسويق",can:()=>canApprove(),list:()=>all().filter(r=>r.st==="pend").sort((a,b)=>N(a.ts)-N(b.ts)),done:()=>all().filter(r=>r.ap&&String(r.ap.e||"").toLowerCase()===meE()&&isToday(r.ap.at)).length,c:"w"},
 set:{ic:"🧾",t:"بانتظار التسوية",hint:"بعد خصم الهدية من مخزون الفرع في النظام: اكتب مرجع السند واضغط تسوية. العينة التي رجعت تُسوّى بالصافي فقط.",who:"المحاسب",can:()=>canSettle(),list:()=>all().filter(r=>r.st==="ok").sort((a,b)=>(waitRet(a)-waitRet(b))||(N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at))),done:()=>all().filter(r=>r.sa&&String(r.sa.e||"").toLowerCase()===meE()&&isToday(r.sa.at)).length,c:"b"},
 ret:{ic:"↩️",t:"عينات لم ترجع",hint:"عينات معتمدة يجب أن ترجع. اللي طلّعها يسجّل رجوعها (الفرع لعيناته، والمستودع لعينات المستودع).",who:"الفرع أو المستودع",can:()=>!X.noNew&&!X.view,list:()=>all().filter(waitRet).sort((a,b)=>N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at)),done:()=>all().filter(r=>r.rb&&String(r.rb.e||"").toLowerCase()===meE()&&isToday(r.rb.at)).length,c:"o"}
};
// سطر في لوحة الشغل: الإجراء لو ليك، وإلا مين المسؤول
function wkRow(r,k,i){
 const mine=k==="ret"?canRet(r):WKD[k].can();
 const act=!mine?`<span class="g4-st">⏳ عند ${k==="ret"?(r.br==="WH"?"المستودع":"الفرع"):WKD[k].who}</span>`
  :k==="ap"?`<button class="bt s g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${E(r.id)}" type="button">رفض</button>`
  :k==="set"?`<input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="مرجع السند"><button class="bt s ${waitRet(r)?"":"g"}" data-gf="set" data-id="${E(r.id)}" type="button" ${waitRet(r)?'title="العينة لم ترجع بعد: الأفضل الانتظار وتسوية الصافي"':""}>✔ ${waitRet(r)?"تسوية كاملة":"تسوية"} ${net(r)}</button>`
  :`<button class="bt s g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`;
 const age=Math.max(0,Math.floor((Date.now()-N(k==="ap"?r.ts:(r.ap&&r.ap.at)||r.ts))/864e5));
 const tags=`${k==="ap"?repTag(r):""}${age>=3?`<span class="g4-st r">⏰ منذ ${age} يوم</span>`:age>=1?`<span class="g4-st">منذ ${age} يوم</span>`:`<span class="g4-st ok">جديدة</span>`}${k==="set"&&waitRet(r)?'<span class="g4-st w">↩️ لم ترجع بعد</span>':""}${k==="set"&&r.rb?`<span class="g4-st ok">صافي ${net(r)} من ${N(r.pcs)}</span>`:""}`;
 return `<div class="g4-td" data-gf="view" data-id="${E(r.id)}" style="--i:${Math.min(i,10)}">${av(r)}<div class="g4-mid"><b>${E(r.to&&r.to.n||"")}</b><small><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi> · <span class="g4-why">${E(r.why||"")}</span> · ${r.rb?net(r):N(r.pcs)} قطعة</small><small class="g4-it">${short(r)}</small><div class="g4-tags">${tags}</div></div><div class="g4-act" data-gf="noop">${act}</div></div>`;
}
function workPanel(per,pw,ok,pcs){
 if(!WK)return "";
 if(WK==="sum"){
  const top=Object.entries(per).sort((a,b)=>b[1].p-a[1].p)[0];
  return `<div class="g4-work sum" id="g4w"><div class="g4-wh"><span class="ic">🎁</span><div><h3>المعتمد في الفترة</h3><small>${fmt(pcs)} قطعة صافي في ${ok.length} هدية${top?` · الأعلى: <bdi dir="ltr">${E(brName(top[0]))}</bdi>`:""}</small></div><button type="button" class="g4-x" data-gf="wk" data-id="" aria-label="إغلاق">✕</button></div>
  <div class="g4-sum"><div><h4>حسب البند</h4>${bars(pw,w=>w)}</div><div><h4>حسب الفرع</h4>${bars(per,brName)}</div></div></div>`;
 }
 const d=WKD[WK],L=d.list().filter(brWhy),dn=d.done(),tot=dn+L.length,pc=tot?Math.round(dn/tot*100):0;
 return `<div class="g4-work ${d.c}" id="g4w"><div class="g4-wh"><span class="ic">${d.ic}</span><div><h3>${d.t} <span class="g4-n">${L.length}</span></h3><small>${d.hint}</small></div><button type="button" class="g4-x" data-gf="wk" data-id="" aria-label="إغلاق">✕</button></div>
 ${(d.can()||WK==="ret")&&tot?`<div class="g4-prog"><div><span>أنجزت اليوم <b>${dn}</b>${L.length?` · باقي <b>${L.length}</b>`:""}</span><span>${L.length?pc+"%":"👏 خلصت كله"}</span></div><i><u style="width:${pc}%"></u></i></div>`:""}
 ${L.length?L.map((r,i)=>wkRow(r,WK,i)).join(""):`<div class="g4-empty sm"><span>👌</span>لا يوجد شيء هنا الآن</div>`}</div>`;
}
const bars=(o,lbl)=>{const e=Object.entries(o).sort((a,b)=>b[1].p-a[1].p),mx=e.length?Math.max(1,e[0][1].p):1;
 return e.length?e.map(([k,v])=>`<div class="g4-bar"><span><bdi dir="ltr">${E(lbl(k))}</bdi></span><i><u style="width:${Math.max(3,v.p/mx*100)}%"></u></i><em>${fmt(v.p)}</em></div>`).join(""):'<div class="off">لا توجد هدايا معتمدة في الفترة</div>'};
// الفلاتر بشكل "أقراص" (من غير عناوين فوق): أيقونة + القيمة، والمتفعّل بيتلوّن وجنبه ✕ يمسحه
function fChip(id,ic,on,inner,clr){return `<label class="g4-fc ${on?"on":""}"><span class="fi">${ic}</span>${inner}${on&&clr?`<button type="button" class="fx" data-gf="fclr" data-id="${clr}" aria-label="مسح">✕</button>`:""}</label>`}
export function giftsView(){
 if(!X)return "";
 if(!F.from)setPer("m0");
 const rs=filtered(),vis=rs.filter(sOk);
 const inP=all().filter(r=>{const a=new Date(F.from+"T00:00:00").getTime(),b=new Date(F.to+"T23:59:59").getTime();return N(r.ts)>=a&&N(r.ts)<=b&&brWhy(r)});
 const ok=inP.filter(isAp),pcs=ok.reduce((s,r)=>s+net(r),0);
 const per={},pw={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=net(r);const w=WHY.includes(r.why)?r.why:"أخرى";(pw[w]=pw[w]||{n:0,p:0}).n++;pw[w].p+=net(r)});
 const cnt={ap:WKD.ap.list().length,set:WKD.set.list().length,ret:WKD.ret.list().length};
 const mineN={ap:canApprove()?cnt.ap:0,set:canSettle()?cnt.set:0,ret:all().filter(r=>canRet(r)).length};
 // أول مرة: نفتح أول لوحة فيها شغل ليك
 if(!WKu&&!WK){WK=["ap","set","ret"].find(k=>mineN[k]>0)||null}// (ولو خلّصت كله تفضل مفتوحة وتقول "خلصت كله")
 const brs=[...new Set(all().map(r=>r.br))].sort();
 const card=(k,ic,v,l,c,sub)=>{const mine=k!=="sum"&&mineN[k]>0;return `<button type="button" class="g4-k ${c}${WK===k?" on":""}${mine?" mine":""}" data-gf="wk" data-id="${k}" aria-expanded="${WK===k}">
  <span class="ic">${ic}</span><span class="tx"><b data-count="${N(String(v).replace(/,/g,""))}">${v}</b><small>${l}</small>${sub?`<em>${sub}</em>`:""}</span>${mine?`<span class="g4-me"><i></i>لك</span>`:""}<span class="g4-car">${WK===k?"▲":"▼"}</span></button>`};
 const pers=[["m0","هذا الشهر"],["m1","الشهر الماضي"],["m3","آخر 3 شهور"],["c","فترة أخرى"]];
 const chips=accOnly()?[["","الكل"],["ok","⏳ بانتظار التسوية"],["set","🧾 مسوّاة"]]:[["","الكل"],["pend","⏳ بانتظار"],["ok","✅ معتمدة"],["set","🧾 مسوّاة"],["no","❌ مرفوضة"]];
 const brOpts=`<option value="">كل الفروع والمستودع</option><option value="WH" ${F.br==="WH"?"selected":""}>المستودع</option>${(X.branches||[]).map(b=>{const c=String(b).split("-")[0];return `<option value="${E(c)}" ${F.br===c?"selected":""}>${E(b)}</option>`}).join("")}${brs.filter(c=>c!=="WH"&&!(X.branches||[]).some(b=>String(b).split("-")[0]===c)).map(c=>`<option value="${E(c)}" ${F.br===c?"selected":""}>${E(c)}</option>`).join("")}`;
 const nF=(F.br?1:0)+(F.why?1:0)+(PER==="c"?1:0);
 let lastD="",i=0;const list=vis.slice(0,SHOWN).map(r=>{const k=dayKey(r.ts),h=k!==lastD?`<div class="g4-day">${E(dayLbl(r.ts))}</div>`:"";lastD=k;return h+line(r,i++)}).join("");
 const out=`<div class="g4 ${ANIM?"anim":""}">
 <div class="g4-hd"><div><h2>🎁 الهدايا والعينات</h2><div class="g4-per">${pers.map(([p,l])=>`<button type="button" class="${PER===p?"on":""}" data-gf="per" data-id="${p}">${l}</button>`).join("")}</div></div>
 <div class="g4-hb">${!X.noNew&&!X.view?`<button class="bt p g4-new" data-gf="new" type="button">＋ هدية / عينة</button>`:""}<button class="bt g4-ib" data-gf="print" type="button" title="تقرير PDF">🖨<span>PDF</span></button><button class="bt g4-ib" data-gf="csv" type="button" title="ملف إكسل">⬇️<span>إكسل</span></button></div></div>
 <div class="g4-ks">${card("sum","🎁",fmt(pcs),"قطعة معتمدة","g",`${ok.length} هدية في الفترة`)}${accOnly()?"":card("ap","⏳",cnt.ap,"بانتظار الاعتماد",cnt.ap?"w":"",cnt.ap?"اضغط للاعتماد":"")}${card("set","🧾",cnt.set,"بانتظار التسوية",cnt.set?"b":"",cnt.set?"اضغط للتسوية":"")}${accOnly()?`<button type="button" class="g4-k${F.st==="set"?" on":""}" data-gf="kst" data-id="set"><span class="ic">✔️</span><span class="tx"><b data-count="${inP.filter(r=>r.st==="set").length}">${inP.filter(r=>r.st==="set").length}</b><small>سوّيتها في الفترة</small><em>${fmt(inP.filter(r=>r.st==="set").reduce((a,r)=>a+N(r.sa&&r.sa.net!=null?r.sa.net:net(r)),0))} قطعة · اضغط لعرضها</em></span></button>`:""}${accOnly()?"":card("ret","↩️",cnt.ret,"عينات لم ترجع",cnt.ret?"o":"",cnt.ret?"اضغط للمتابعة":"")}</div>
 ${workPanel(per,pw,ok,pcs)}
 <div class="g4-box"><div class="g4-bar1"><div class="g4-search"><span>🔍</span><input type="search" id="gx-q" value="${E(F.q||"")}" placeholder="ابحث برقم الهدية أو المستلم أو الجوال أو الكود..."></div><button type="button" class="g4-fbtn ${FOPEN?"on":""}" data-gf="fopen">⚙️ فلاتر${nF?` <span class="g4-fn">${nF}</span>`:""}</button></div>
 <div class="g4-chips">${chips.map(([s,l])=>`<button type="button" class="${(F.st||"")===s?"on":""}" data-gf="kst" data-id="${s}">${l}</button>`).join("")}</div>
 ${FOPEN||PER==="c"?`<div class="g4-fbar">${fChip("gx-br","🏬",!!F.br,`<select id="gx-br" aria-label="الفرع">${brOpts}</select>`,"br")}${fChip("gx-why","🏷",!!F.why,`<select id="gx-why" aria-label="البند"><option value="">كل البنود</option>${WHY.map(w=>`<option ${F.why===w?"selected":""}>${E(w)}</option>`).join("")}</select>`,"why")}
 ${fChip("gx-from","📅",PER==="c",`<input type="date" id="gx-from" value="${E(F.from)}" aria-label="من"><span class="fa">←</span><input type="date" id="gx-to" value="${E(F.to)}" aria-label="إلى">`,"per")}${nF?`<button type="button" class="g4-fclr" data-gf="fclr" data-id="all">مسح الفلاتر</button>`:""}</div>`:""}
 <div class="g4-cnt">${vis.length} هدية${F.st||F.br||F.why||F.q?" (مفلترة)":""}</div>
 ${vis.length?`<div class="g4-list">${list}</div>${vis.length>SHOWN?`<button type="button" class="g4-more" data-gf="more">عرض المزيد (${vis.length-SHOWN})</button>`:""}`:`<div class="g4-empty"><span>🎁</span>${F.st||F.q||F.br||F.why?"لا توجد هدايا بهذه الفلاتر":"لا توجد هدايا في هذه الفترة"}</div>`}</div></div>`;
 if(ANIM)setTimeout(countUp,30);
 ANIM=false;
 return out;
}
// الأرقام بتعد لحد قيمتها أول مرة بس (مش مع كل تحديث، علشان ماتبقاش مزعجة)
function countUp(){
 if(matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 document.querySelectorAll(".g4-k b[data-count]").forEach(b=>{const to=N(b.dataset.count);if(to<2)return;const t0=performance.now(),d=700;
  const st=t=>{const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);b.textContent=fmt(Math.round(to*e));if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)});
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
function closeM(){const m=g("gfm");if(m){m.className="gfm";m.innerHTML="";m.dataset.v=""}img="";imgBusy=false;edit=null;PK=null;ACC=null;ACCL=[]}
// ---------- نموذج التسجيل ----------
const rowHtml=(x={})=>`<div class="gf-row"><input data-r="k" placeholder="الكود" dir="ltr" maxlength="40" value="${E(x.k||"")}"><input data-r="c" placeholder="اللون" maxlength="40" value="${E(x.c||"")}"><input data-r="z" placeholder="المقاس" maxlength="20" value="${E(x.z||"")}"><input data-r="q" placeholder="العدد" inputmode="numeric" value="${x.q?E(x.q):""}"><button type="button" data-gf="rmrow" title="احذف السطر">✕</button></div>`;
function form(r){
 edit=r||null;img="";imgBusy=false;
 const wh=X.mode!=="branch",autoName=wh?String(X.me.n||X.me.e||""):String(X.brn||X.code||"");
 openM(`<h3>${r?"✏️ تعديل":"🎁 تسجيل"} هدية / عينة</h3><div style="color:var(--mut);font-size:13.5px">${r?`<bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.brn||brName(r.br))}`:wh?"من المستودع — ستُرسل إلى مدير التسويق ليعتمدها":"من "+E(X.brn)+" — ستُرسل إلى مدير التسويق ليعتمدها"}</div>
 <label>الأصناف</label><div class="gf-rows" id="gfrows">${(r&&Array.isArray(r.rows)&&r.rows.length?r.rows:[{}]).map(rowHtml).join("")}</div>
 <button class="bt s" data-gf="addrow" type="button" style="margin-top:6px;width:auto">➕ صنف</button>
 <div class="gf-2"><div><label>اسم المستلم *</label><input id="gfn" maxlength="60" value="${E(r&&r.to&&r.to.n||"")}" placeholder="مثلاً: أ. محمد علي"></div>
 <div><label>جوال المستلم</label><input id="gfp" maxlength="20" inputmode="tel" dir="ltr" value="${E(r&&r.to&&r.to.ph||"")}" placeholder="05xxxxxxxx"></div></div>
 <div class="gf-2"><div><label>السبب *</label><select id="gfw">${WHY.map(w=>`<option ${r&&r.why===w?"selected":""}>${E(w)}</option>`).join("")}</select></div>
 <div><label>المسجِّل (تلقائي)</label><input id="gfby" dir="auto" maxlength="60" value="${E(r&&r.by?r.by.n:autoName)}" disabled title="يُكتب تلقائياً باسم الحساب الداخل"></div></div>
 <label>ملاحظة</label><textarea id="gfnote" rows="2" maxlength="300" placeholder="اختياري">${E(r&&r.note||"")}</textarea>
 <label>${r?"صور سند جديدة (اختياري، تستبدل الحالية)":"صور السند (اختياري)"}</label><div id="gfmp"></div>
 <div class="gf-act"><button class="bt p" data-gf="save" type="button">${r?"💾 حفظ التعديل":"✅ تسجيل"}</button><button class="bt" data-gf="${X.mode==="branch"&&!r?"bopen":"close"}" type="button">رجوع</button></div>`,"form");
 PK=multiPick(g("gfmp"),{w:1400,cap:230000,toast:X.toast,add:"إضافة صور السند"});
}
async function save(){
 if(PK&&PK.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const IMS=PK?PK.imgs():[];img=IMS[0]||"";
 const rows=[...document.querySelectorAll("#gfrows .gf-row")].map(el=>{const v=k=>el.querySelector(`[data-r="${k}"]`).value.trim();return {k:v("k").slice(0,40),c:v("c").slice(0,40),z:v("z").slice(0,20),q:Math.min(99999,Math.round(N(toEn(v("q")))))}}).filter(x=>x.k&&x.q>0).map(x=>{const o={k:x.k,q:x.q};if(x.c)o.c=x.c;if(x.z)o.z=x.z;return o});
 const to={n:g("gfn").value.trim().slice(0,60)},ph=toEn(g("gfp").value).replace(/[^\d+]/g,"").slice(0,20);if(ph)to.ph=ph;
 const why=g("gfw").value,note=g("gfnote").value.trim().slice(0,300),byN=g("gfby").value.trim().slice(0,60);
 if(!rows.length){X.toast("اكتب صنفاً واحداً على الأقل (الكود والعدد)");return}
 if(rows.length>100){X.toast("الأصناف كثيرة جداً (أكثر من 100)");return}
 if(!to.n){X.toast("اكتب اسم المستلم");return}
 if(!byN){X.toast("اكتب اسمك");return}
 
 const btn=document.querySelector('[data-gf="save"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 try{
  const pcs=rows.reduce((s,x)=>s+x.q,0);
  if(edit){// المالك بس
   const d={...edit,rows,pcs,to,why,note};delete d.id;if(!note)delete d.note;if(img)d.img=1;
   const b=writeBatch(X.db);b.set(doc(X.db,"gifts",edit.id),d);if(img)b.set(doc(X.db,"giftimg",edit.id),{img});
   await withTimeout(b.commit(),20000);
   if(img){await dropExtras(X.db,"giftimg",edit.id);const bad=await saveExtras(X.db,"giftimg",edit.id,IMS.slice(1));if(bad)X.toast(`تعذّر حفظ ${bad} من الصور الإضافية`,"er")}
   X.toast("تم حفظ التعديل ✅");closeM();if(X.mode==="branch")openBranch();return;
  }
  const wh=X.mode!=="branch",ts=Date.now(),dd=new Date(ts),p=n=>String(n).padStart(2,"0"),br=wh?"WH":X.code;
  const ref=doc(collection(X.db,"gifts")),no=`G-${br}-${p(dd.getMonth()+1)}${p(dd.getDate())}-${p(dd.getHours())}${p(dd.getMinutes())}`;
  const d={br,brn:wh?"المستودع":String(X.brn||br).slice(0,40),no,ts,dt:today(),rows,pcs,to,why,by:{e:X.me.e,n:byN},st:"pend"};
  if(note)d.note=note;if(img)d.img=1;
  const b=writeBatch(X.db);b.set(ref,d);if(img)b.set(doc(X.db,"giftimg",ref.id),{img});
  await withTimeout(b.commit(),20000);
  if(IMS.length>1){if(btn)btn.textContent=`⏳ جاري رفع الصور (${IMS.length})...`;const bad=await saveExtras(X.db,"giftimg",ref.id,IMS.slice(1));if(bad)X.toast(`سُجّلت الهدية، لكن تعذّر رفع ${bad} من الصور. افتحها وأضفها لاحقاً أو أبلغ المستودع`,"er")}
  if(X.ping)X.ping([ref.id]);
  X.toast(IMS.length>1?`سُجّلت ✅ مع ${IMS.length} صور، وبانتظار اعتماد مدير التسويق`:"سُجّلت ✅ وبانتظار اعتماد مدير التسويق");
  if(X.mode==="branch")openBranch();else closeM();
 }catch(e){if(btn){btn.disabled=false;btn.textContent=edit?"💾 حفظ التعديل":"✅ تسجيل"}const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")}
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
function viewGift(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r)return;
 const st=r.st||"pend",wh=X.mode!=="branch";
 openM(`<div class="gs"><div class="gs-hd"><img src="./icon-192.png" alt=""><div><b>${isSample(r)?"سند عينة":"سند هدية"}</b><small>${E(r.no)}</small></div><span class="gf-st ${st}">${STL[st]||st}</span></div>
 <div class="gs-bd">${(()=>{const x=wh?repOf(r):null;if(!x)return "";const L=all().filter(y=>y.id!==r.id&&y.st!=="no"&&Math.abs(N(y.ts)-N(r.ts))<=30*864e5&&y.to&&(x.by==="ph"?phK(y.to.ph)===phK(r.to.ph):(y.br===r.br&&nmK(y.to.n)===nmK(r.to.n)))).sort((a,b)=>N(b.ts)-N(a.ts)).slice(0,5);
  return `<div class="gs-rep">🔁 <b>${x.by==="ph"?"رقم الجوال نفسه":"اسم المستلم نفسه"} استلم ${x.n===1?"هدية أخرى":x.n===2?"هديتين أخريين":x.n+" هدايا أخرى"} خلال 30 يوماً</b>${L.map(y=>`<div>${E(y.dt||"")} · <bdi dir="ltr">${E(y.brn||brName(y.br))}</bdi> · ${E(y.why||"")} · ${net(y)} قطعة · ${E((STL[y.st]||"").replace(/^\S+\s/,""))}</div>`).join("")}</div>`})()}${sheetHtml(r)}
 ${wh&&isAp(r)?`<div class="gs-acc" id="gfacc" data-id="${E(r.id)}"></div>`:""}
 <div class="gs-ac">${wh&&canApprove()&&st==="pend"?`<button class="bt g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${canRet(r)?`<button class="bt g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}
 ${wh&&canSettle()&&st==="ok"?`<div class="gs-set">${waitRet(r)?'<span class="g4-st w">↩️ العينة لم ترجع بعد: الأفضل الانتظار</span>':""}<input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="مرجع السند في النظام"><button class="bt g" data-gf="set" data-id="${E(r.id)}" type="button">✔ تسوية ${net(r)} قطعة</button></div>`:""}
 ${r.img?`<button class="bt" data-gf="img" data-id="${E(r.id)}" type="button">📎 صورة السند</button>`:""}
 <button class="bt" data-gf="gprint" data-id="${E(r.id)}" type="button">🖨 طباعة</button>
 ${wh&&isOwner()?`<button class="bt" data-gf="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button><button class="bt r" data-gf="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`:""}
 <button class="bt" data-gf="${wh?"close":"bopen"}" type="button">رجوع</button></div></div></div>`,"view");
 if(wh&&isAp(r))loadAcc(r.id,false);
}
// ---------- 📎 مرفقات المحاسب ----------
const JPEG=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const canAcc=()=>canSettle()&&!X.view;
async function loadAcc(id,open){
 const here=()=>{const el=g("gfacc");return el&&el.dataset.id===id?el:null};if(!here())return;
 let L=[],bad=false;
 try{const s=await withTimeout(getDocs(collection(X.db,"giftimg",id,"a")),15000);L=s.docs.map(d=>({k:+d.id,...(d.data()||{})})).filter(x=>x.k>=1&&typeof x.img==="string"&&JPEG.test(x.img)).sort((a,b)=>a.k-b.k)}
 catch(e){bad=true}
 const el=here();if(!el)return;ACCL=L;const can=canAcc();
 if(!can&&!L.length&&!bad){el.innerHTML="";ACC=null;return}
 el.innerHTML=`<div class="gs-ah"><b>📎 مرفقات المحاسب</b>${L.length?`<small>(${L.length}/10)</small>`:""}</div>${bad?'<div class="m">تعذّر تحميل المرفقات</div>':""}
 ${L.length?`<div class="gs-ag">${L.map((x,i)=>`<button type="button" data-gf="accimg" data-id="${E(id)}" data-i="${i}"><img src="${x.img}" alt=""><span data-notr><bdi>${E(x.n||"")}</bdi><br>${hm(x.at)}</span></button>`).join("")}</div>`:""}
 ${can&&!bad&&L.length<10?(open?`<div id="gfaccp"></div><div class="gf-act" style="margin-top:8px"><button class="bt g" data-gf="accsave" data-id="${E(id)}" type="button">💾 حفظ الصور</button><button class="bt" data-gf="accx" data-id="${E(id)}" type="button">إلغاء</button></div>`
  :`<button class="bt s" data-gf="accadd" data-id="${E(id)}" type="button">📷 إرفاق صور</button>${L.length?"":'<div class="m" style="margin-top:6px">أرفق صوراً من جهازك لهذا السند (لا يغيّر أي شيء في الهدية).</div>'}`):""}`;
 ACC=open&&g("gfaccp")?multiPick(g("gfaccp"),{max:10-L.length,w:1400,cap:230000,toast:X.toast,add:"إضافة صور"}):null;
}
async function accSave(id){
 if(!ACC||!canAcc())return;if(ACC.busy()){X.toast("انتظر حتى تنتهي الصور");return}
 const IMS=ACC.imgs().filter(s=>JPEG.test(s));if(!IMS.length){X.toast("اختر صورة واحدة على الأقل");return}
 const btn=document.querySelector('[data-gf="accsave"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الرفع..."}
 const start=ACCL.reduce((m,x)=>Math.max(m,x.k),0)+1,nm=String(X.me.n||X.me.e||"").slice(0,60);let ok=0,bad=0,denied=false;
 for(let k=0;k<IMS.length;k++){const n=start+k;if(n>10){bad+=IMS.length-k;break}
  try{await withTimeout(setDoc(doc(X.db,"giftimg",id,"a",String(n)),{img:IMS[k],n:nm,at:Date.now()}),20000);ok++}
  catch(e){bad++;if((await failReason(e))==="denied")denied=true}}
 if(!bad)X.toast("📎 تم إرفاق الصور ✅");
 else X.toast(denied&&!ok?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":"تعذّر رفع بعض الصور، حاول مرة أخرى","er");
 loadAcc(id,false);
}
async function dropAcc(id){try{const s=await getDocs(collection(X.db,"giftimg",id,"a"));for(const d of s.docs){try{await deleteDoc(doc(X.db,"giftimg",id,"a",d.id))}catch(e){}}}catch(e){}}
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
  const list=[];if(im)list.push({src:im,del:`giftimg/${id}/img`});ex.forEach(x=>list.push({src:x.src,del:"doc:"+x.path}));
  if(!list.length){X.toast("لا توجد صورة سند (ربما حُذفت)");return}
  zoomGallery(list,`سند ${r?r.no:""} · ${r?(r.brn||brName(r.br)):""}`,0);
 }catch(e){X.toast(e&&e.code==="permission-denied"?"غير مسموح لك برؤية هذا السند":"تعذر تحميل السند، تأكد من الإنترنت")}
}
// ---------- التقارير ----------
function reportRows(){return filtered()}
function printReport(){
 const rs=reportRows(),ok=rs.filter(isAp),per={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=net(r)});
 const who=F.br?brName(F.br):"كل الفروع والمستودع",stl=F.st?STL[F.st]:"كل الحالات";
 printStmt(`<div class="st"><div class="ph"><h2>تقرير الهدايا والعينات</h2><div>${E(today())}</div></div>
 <div class="rt"><div><small>الفرع</small><b><bdi dir="ltr">${E(who)}</bdi></b></div><div><small>الفترة</small><b style="font-size:11pt">${E(F.from||"—")} ← ${E(F.to||today())}</b></div><div><small>الحالة</small><b style="font-size:11pt">${E(stl)}</b></div><div><small>البند</small><b style="font-size:11pt">${E(F.why||"كل البنود")}</b></div></div>
 ${Object.keys(per).length?`<table class="stt" style="margin-bottom:5mm"><thead><tr><th>الفرع</th><th>عدد المعتمد</th><th>قطع (صافي)</th></tr></thead><tbody>${Object.entries(per).map(([k,v])=>`<tr><td>${E(brName(k))}</td><td class="n">${v.n}</td><td class="n">${fmt(v.p)}</td></tr>`).join("")}</tbody></table>`:""}
 <table class="stt"><thead><tr><th>#</th><th>التاريخ</th><th>الفرع</th><th>الرقم</th><th>المستلم</th><th>السبب</th><th>الأصناف</th><th>قطع</th><th>رجع / الصافي</th><th>الحالة</th><th>سجّلها / اعتمدها</th><th>مرجع السند</th></tr></thead><tbody>
 ${rs.map((r,i)=>`<tr><td>${i+1}</td><td>${E(r.dt||"")}</td><td>${E(r.brn||brName(r.br))}</td><td>${E(r.no)}</td><td>${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?"<br>"+E(r.to.ph):""}</td><td>${E(r.why||"")}${r.note?"<br>"+E(r.note):""}</td><td>${E(itemsTxt(r))}</td><td class="n">${N(r.pcs)}</td><td class="n">${r.rb?retQ(r)+" / "+net(r):r.rt===true?"لم ترجع":"—"}</td><td>${E((STL[r.st]||"").replace(/^\S+\s/,""))}${r.st==="no"&&r.ap&&r.ap.note?"<br>"+E(r.ap.note):""}</td><td><bdi>${E(r.by&&r.by.n||"")}</bdi>${r.ap&&r.ap.n?"<br>"+E(r.ap.n):""}</td><td>${r.sa?E(r.sa.ref||"")+"<br>"+E(r.sa.n||""):""}</td></tr>`).join("")||'<tr><td colspan="12" style="text-align:center">لا توجد هدايا</td></tr>'}</tbody></table>
 <div class="tt"><span>العدد ${rs.length}</span><span>المعتمد ${ok.length}</span><span><b>قطع معتمدة (صافي) ${fmt(ok.reduce((s,r)=>s+net(r),0))}</b></span></div>
 <div class="sg"><span>المحاسب</span><span>مدير المستودع</span><span>المدير</span></div></div>`);
}
function csv(){
 const rs=reportRows(),q=v=>{const s=String(v==null?"":v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const head=["التاريخ","الوقت","الفرع","الرقم","المستلم","جوال المستلم","السبب","ملاحظة","الأصناف","عدد القطع","الحالة","سجّلها","اعتمدها/رفضها","وقت الاعتماد","سبب الرفض","فيه سند","مرجع السند في النظام","سوّاها","وقت التسوية","العينة ترجع؟","رجع","الصافي"];
 const lines=rs.map(r=>[r.dt,new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),r.brn||brName(r.br),r.no,r.to&&r.to.n,r.to&&r.to.ph?`="${r.to.ph}"`:"",r.why,r.note,itemsTxt(r),N(r.pcs),(STL[r.st]||"").replace(/^\S+\s/,""),r.by&&r.by.n,r.ap&&r.ap.n,r.ap&&r.ap.at?new Date(N(r.ap.at)).toLocaleString("en-GB"):"",r.st==="no"&&r.ap?r.ap.note:"",r.img?"نعم":"لا",r.sa?r.sa.ref:"",r.sa?r.sa.n:"",r.sa&&r.sa.at?new Date(N(r.sa.at)).toLocaleString("en-GB"):"",r.rt===true?"نعم":r.rt===false?"لا":"",r.rb?retQ(r):"",isAp(r)?net(r):""].map(q).join(","));
 const blob=new Blob(["﻿"+[head.join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`tasooma-gifts-${F.br||"all"}-${F.from}-${F.to}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-gf]");if(!t||!X)return;const a=t.dataset.gf,id=t.dataset.id;
 if(a==="noop")return;
 if(a==="vt"){VT=id;VTu=true;if(X.redraw)X.redraw();return}
 if(a==="per"){if(id==="c"){PER="c";FOPEN=true}else setPer(id);SHOWN=30;ensureRange().then(()=>X.redraw());return}
 if(a==="kst"){F.st=F.st===id?"":id;SHOWN=30;X.redraw();return}
 if(a==="wk"){WK=WK===id||!id?null:id;WKu=true;X.redraw();if(WK)setTimeout(()=>{const w=g("g4w");if(w&&w.getBoundingClientRect().top>innerHeight*.75)w.scrollIntoView({behavior:"smooth",block:"start"})},40);return}
 if(a==="fclr"){if(id==="br"||id==="all")F.br="";if(id==="why"||id==="all")F.why="";if(id==="per"||id==="all"){setPer("m0")}SHOWN=30;ensureRange().then(()=>X.redraw());return}
 if(a==="fopen"){FOPEN=!FOPEN;X.redraw();return}
 if(a==="todoall"){TODOALL=!TODOALL;X.redraw();return}
 if(a==="more"){SHOWN+=50;X.redraw();return}
 if(a==="sumopen"){SUMOPEN=!SUMOPEN;X.redraw();return}
 if(a==="bopen")return void openBranch();
 if(a==="close")return void closeM();
 if(a==="new")return void form(null);
 if(a==="addrow"){const w=g("gfrows");if(w&&w.children.length<100)w.insertAdjacentHTML("beforeend",rowHtml());return}
 if(a==="rmrow"){const w=g("gfrows"),row=t.closest(".gf-row");if(w&&row&&w.children.length>1)row.remove();return}
 if(a==="save")return void save();
 if(a==="img")return void showImg(id);
 if(a==="accadd"||a==="accx")return void loadAcc(id,a==="accadd");
 if(a==="accsave")return void accSave(id);
 if(a==="accimg"){const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);zoomGallery(ACCL.map(x=>({src:x.img,del:`doc:giftimg/${id}/a/${x.k}`})),`مرفقات المحاسب · ${r?r.no:""}`,+t.dataset.i||0);
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
 if(a==="edit"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(r)form(r);return}
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
 document.querySelectorAll(".gx-ln[data-s],.gx-tr[data-s],.g4-ln[data-s]").forEach(el=>{el.hidden=!!q&&!el.dataset.s.includes(q)});
 document.querySelectorAll(".g4-day").forEach(d=>{let n=d.nextElementSibling,any=false;while(n&&!n.classList.contains("g4-day")){if(!n.hidden)any=true;n=n.nextElementSibling}d.hidden=!any});
 const c=document.querySelector(".g4-cnt");if(c)c.textContent=document.querySelectorAll(".g4-ln:not([hidden])").length+" هدية"+(q?" (مفلترة)":"");
}
