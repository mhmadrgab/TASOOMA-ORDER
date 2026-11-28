// 📣 استوديو التسويق — المنطق (v266): ثوابت وحسابات فقط، بلا صفحة وبلا قاعدة بيانات، فيُختبر في Node.
// النموذج M = {C, T, D, X} خرائط (Map): الحملات، المهام، اتفاقات المؤثرين، المصروفات. كل دالة هنا «نقية»: نفس المدخلات = نفس الناتج.

// ---------- أدوات ----------
export const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
export const N = v => Number.isFinite(+v) ? +v : 0;
export const money = v => Math.round(N(v)).toLocaleString("en-US");
export const big = v => { v = N(v); return v >= 1e6 ? (Math.round(v / 1e5) / 10) + "M" : v >= 1e4 ? (Math.round(v / 100) / 10) + "K" : Math.round(v).toLocaleString("en-US") };
export const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
const z2 = n => (n < 10 ? "0" : "") + n;
export const ymd = d => d.getFullYear() + "-" + z2(d.getMonth() + 1) + "-" + z2(d.getDate());
export const today = () => ymd(new Date());
const DRE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const dOf = s => { const m = DRE.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null };
export const dmy = s => { const m = DRE.exec(String(s || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : "" };
export const dm = s => { const m = DRE.exec(String(s || "")); return m ? m[3] + "/" + m[2] : "" };
export const days = (a, b) => { const x = dOf(a), y = dOf(b); return x && y ? Math.round((y - x) / 864e5) : 0 };
export const addD = (s, k) => { const d = dOf(s) || new Date(); d.setDate(d.getDate() + k); return ymd(d) };
export const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// رقم يكتبه المستخدم: أرقام عربية، فاصلة عربية، فواصل الآلاف. غير الرقم = NaN
export const num = s => { const t = String(s == null ? "" : s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫]/g, ".").replace(/[,\s،]/g, ""); if (t === "") return 0; return /^\d+(\.\d+)?$/.test(t) ? +t : NaN };

// ---------- القوائم الثابتة (القيم المخزّنة لا تتغيّر) ----------
export const CH = [["ig", "إنستغرام"], ["tt", "تيك توك"], ["sc", "سناب شات"], ["x", "إكس"], ["yt", "يوتيوب"], ["wa", "واتساب"], ["web", "الموقع الإلكتروني"], ["st", "الفروع"], ["oth", "أخرى"]];
export const PF = [["ig", "إنستغرام"], ["tt", "تيك توك"], ["sc", "سناب شات"], ["x", "إكس"], ["yt", "يوتيوب"], ["oth", "أخرى"]];
export const KP = [["reach", "الوصول (أشخاص)"], ["views", "المشاهدات"], ["eng", "التفاعلات"], ["fol", "متابعون جدد"], ["vis", "زيارات الموقع"], ["ord", "عدد الطلبات"], ["rev", "المبيعات (ريال)"], ["oth", "هدف آخر"]];
// مسارات العمل: [المعرّف، الأيقونة، الاسم، اللون، يحتاج اعتماد المحتوى افتراضياً]
export const RL = [["ph", "📷", "التصوير", "#d08a2c", true], ["ct", "✍", "المحتوى والتصميم", "#8a5a83", true], ["inf", "🤝", "المؤثرون", "#c06c95", false], ["prm", "📜", "التصاريح", "#b4553e", false], ["prc", "🏷", "تحديث الأسعار", "#3a9488", false], ["ad", "📢", "الإعلانات الممولة", "#3d7cc9", true], ["oth", "📌", "أخرى", "#8e8e93", false]];
export const XK = [["inf", "المؤثرون", "#c06c95"], ["ads", "إعلانات ممولة", "#3d7cc9"], ["ph", "التصوير", "#d08a2c"], ["prod", "إنتاج وتصميم", "#8a5a83"], ["prm", "تصاريح ورسوم", "#b4553e"], ["evt", "فعاليات", "#6f7d45"], ["gift", "هدايا وعينات", "#3a9488"], ["oth", "أخرى", "#8e8e93"]];
export const CST = {plan: "مخطط لها", live: "جارية", done: "منتهية", x: "ملغاة"};
export const DST = {pend: "بانتظار الاعتماد", ok: "معتمد · بانتظار التحويل", no: "مرفوض", paid: "تم التحويل", x: "ملغى"};
export const TST = {todo: "لم تبدأ", doing: "قيد التنفيذ", rev: "بانتظار الاعتماد", done: "منتهية"};
export const TCOL = ["todo", "doing", "rev", "done"];
export const PRI = ["عادية", "مرتفعة", "عاجلة"];
export const CLR = ["#8a5a83", "#3d7cc9", "#d08a2c", "#3a9488", "#b4553e", "#6f7d45", "#c06c95", "#5e5ce6"];
export const TPL = [["ph", "تصوير المنتجات", -7], ["ct", "كتابة المحتوى والنصوص", -5], ["ct", "تصميم الإعلانات والبوسترات", -4], ["inf", "الاتفاق مع المؤثرين", -6], ["prm", "استخراج تصريح الإعلان", -10], ["prc", "تحديث الأسعار في السيستم", -1], ["prc", "تحديث الأسعار في الموقع الإلكتروني", -1], ["ad", "إطلاق الإعلانات الممولة", 0]];
export const lab = (L, k) => (L.find(x => x[0] === k) || [k, k])[1];
export const rl = k => RL.find(x => x[0] === k) || RL[RL.length - 1];

// ---------- الآيبان ----------
export function ibanNorm(s) { return String(s || "").toUpperCase().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^A-Z0-9]/g, "") }
export function ibanOk(s) {
  const v = ibanNorm(s); if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false; if (v.slice(0, 2) === "SA" && v.length !== 24) return false;
  const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); let m = 0; for (let i = 0; i < r.length; i++) m = (m * 10 + (r.charCodeAt(i) - 48)) % 97; return m === 1;
}
export const ibanFmt = s => ibanNorm(s).replace(/(.{4})/g, "$1 ").trim();
export const ibanMask = s => { const v = ibanNorm(s); return v.length > 8 ? v.slice(0, 4) + " •••• •••• " + v.slice(-4) : v };

// ---------- قراءة النموذج ----------
const vals = m => m ? Array.from(m.values()) : [];
export const tasksOf = (M, c) => vals(M.T).filter(t => t.c === c);
export const dealsOf = (M, c) => vals(M.D).filter(d => d.c === c);
export const exOf = (M, c) => vals(M.X).filter(x => x.c === c);
// 📢 (v275) منصات الإعلانات الممولة + الصرف اليومي المسجّل على مهمة إعلان (الأحدث أولاً)
export const ADP = [["sc", "سناب شات"], ["tt", "تيك توك"], ["meta", "ميتا (إنستغرام وفيسبوك)"], ["gg", "جوجل"], ["x", "إكس"], ["yt", "يوتيوب"], ["oth", "منصة أخرى"]];
export const adOf = (M, tid) => vals(M.X).filter(x => x.tk === tid).sort((a, b) => String(b.dt).localeCompare(String(a.dt)) || N(b.ts) - N(a.ts));
export const adSum = (M, tid) => adOf(M, tid).reduce((a, x) => a + N(x.a), 0);
// 📢 (v278) المهمة على أكثر من منصة: aps = قائمة المنصات، abp = ميزانية كل منصة. المهام القديمة (ap واحدة) تُقرأ كما هي.
export const ADS = {sc: "سناب", tt: "تيك توك", meta: "ميتا", gg: "جوجل", x: "إكس", yt: "يوتيوب", oth: "أخرى"};
export const adPf = x => { const L = Array.isArray(x && x.aps) ? x.aps.filter((k, i, a) => ADP.some(q => q[0] === k) && a.indexOf(k) === i) : []; return L.length ? L : (x && x.ap ? [x.ap] : []) };
export const adBud = (x, k) => { const b = x && x.abp && typeof x.abp === "object" ? N(x.abp[k]) : 0; if (b) return b; const P = adPf(x); return x && !x.abp && P.length === 1 && P[0] === k ? N(x.ab) : 0 };
export const adKey = (P, e) => e.ap && P.indexOf(e.ap) >= 0 ? e.ap : (!e.ap && P.length === 1 ? P[0] : "-");
// جدول الأيام × المنصات لمهمة إعلان: «-» = صرف قديم بلا منصة من منصات المهمة
export const adGrid = (M, x) => { const P = adPf(x), sum = {}, vw = {}, ck = {}, by = {}; let tot = 0, tvw = 0, tck = 0;
  adOf(M, x.id).forEach(e => { const k = adKey(P, e), a = N(e.a), d = by[e.dt] || (by[e.dt] = {dt: e.dt, v: {}, tot: 0, n: 0, vw: 0, ck: 0}); d.v[k] = (d.v[k] || 0) + a; d.tot += a; d.n++; d.vw += N(e.vw); d.ck += N(e.ck); sum[k] = (sum[k] || 0) + a; vw[k] = (vw[k] || 0) + N(e.vw); ck[k] = (ck[k] || 0) + N(e.ck); tot += a; tvw += N(e.vw); tck += N(e.ck) });
  return {P, cols: P.concat(sum["-"] ? ["-"] : []), sum, vw, ck, tot, tvw, tck, days: Object.keys(by).sort().reverse().map(k => by[k])} };
// 👁 (v280) أداء الإعلانات الممولة في الحملة كلها: المصروف والمشاهدات والنقرات لكل منصة (من الصرف اليومي الذي كُتبت له مشاهدات أو نقرات)
export const adPerf = (M, cid) => { const R = {a: 0, vw: 0, ck: 0, by: {}}; exOf(M, cid).filter(x => x.k === "ads" && (N(x.vw) || N(x.ck))).forEach(x => { const k = x.ap || "oth", e = R.by[k] || (R.by[k] = {a: 0, vw: 0, ck: 0}); e.a += N(x.a); e.vw += N(x.vw); e.ck += N(x.ck); R.a += N(x.a); R.vw += N(x.vw); R.ck += N(x.ck) }); return R };
// 💰 (v280) مبيعات الفروع في فترة الحملة من ملف قيمة المبيعات (M.SV: يوم ← إجمالي كل الفروع)، مقابل نفس عدد الأيام قبلها. بلا بيانات = null
export function campSales(M, c, t) { const SV = M && M.SV; if (!SV || !SV.size || !c || !c.from || c.from > t) return null;
  const last = M.SVL || "", first = M.SVF || "", end = c.to && c.to < t ? c.to : t, to = last && last < end ? last : end; if (!last || to < c.from) return {wait: true, last};
  const n = days(c.from, to) + 1, sum = (a, k) => { let s = 0; for (let i = 0; i < k; i++) s += N(SV.get(addD(a, i))); return Math.round(s * 100) / 100 };
  const pf = addD(c.from, -n), cur = sum(c.from, n), pok = !!first && pf >= first, prev = pok ? sum(pf, n) : 0, diff = Math.round((cur - prev) * 100) / 100;
  return {from: c.from, to, n, cur, prev, pok, diff, up: pok && prev > 0 ? Math.round(diff / prev * 100) : null, last, part: to < end} }
export const kpOf = c => Array.isArray(c && c.kp) ? c.kp : [];
export const kpName = k => k.k === "oth" && k.l ? k.l : lab(KP, k.k);
export const isOpen = x => x.st !== "done";
export const isLate = (x, t) => x.st !== "done" && x.st !== "rev" && !!x.du && x.du < t;
export const clStat = x => { const L = Array.isArray(x.cl) ? x.cl : []; return {n: L.length, k: L.filter(y => y && y.k).length} };

// ---------- 🤝 (v272) الجهات: مشهور أو شركة دعاية ----------
export const PTY = {p: "مشهور", c: "شركة دعاية"};
// توحيد الاسم (نفس دالة القاعدة mkp_key): بلا تشكيل ولا مسافات، والهمزات والتاء المربوطة موحّدة
export const normName = n => String(n == null ? "" : n).replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, "").toLowerCase();
export async function partyKey(n) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normName(n))); return "p" + Array.from(new Uint8Array(h)).map(x => (x < 16 ? "0" : "") + x.toString(16)).join("").slice(0, 32) }
export const dealKey = d => d.pid || "n:" + normName(d.n);
// ملخّص كل جهة من اتفاقاتها: المعتمد tot، المحوَّل paid في nPaid تحويلاً، الباقي wait، والمعلّق pend
export function parties(M) {
  const P = new Map();
  vals(M.D).forEach(d => { const k = dealKey(d); let p = P.get(k);
    if (!p) { const reg = d.pid && M.P ? M.P.get(d.pid) : null; p = {k, n: reg ? reg.n : d.n, ty: (reg && reg.ty) || d.ty || "p", L: [], tot: 0, paid: 0, wait: 0, pend: 0, nPaid: 0, last: 0}; P.set(k, p) }
    p.L.push(d); const a = N(d.amt);
    if (d.st === "paid") { p.paid += a; p.tot += a; p.nPaid++; p.last = Math.max(p.last, N(d.pd && d.pd.at)) } else if (d.st === "ok") { p.wait += a; p.tot += a } else if (d.st === "pend") p.pend += a });
  return P;
}
// المصروف = الاتفاقات المعتمدة (حتى قبل التحويل) + المصروفات المسجّلة
export function spend(M, c) {
  const by = {}; XK.forEach(k => { by[k[0]] = 0 }); let paid = 0, wait = 0, pend = 0;
  dealsOf(M, c).forEach(d => { if (d.st === "ok" || d.st === "paid") { by.inf += N(d.amt); if (d.st === "paid") paid += N(d.amt); else wait += N(d.amt) } if (d.st === "pend") pend += N(d.amt) });
  exOf(M, c).forEach(x => { by[x.k in by ? x.k : "oth"] += N(x.a); paid += N(x.a) });
  const tot = XK.reduce((a, k) => a + by[k[0]], 0); return {by, tot, paid, wait, pend};
}
// كم مضى من مدة الحملة %
export function timeP(c, t) { if (!c.from || !c.to || t < c.from) return 0; if (t > c.to) return 100; return Math.min(100, Math.round((days(c.from, t) + 1) / (days(c.from, c.to) + 1) * 100)) }
export function tkStat(M, c, t) {
  const L = tasksOf(M, c), o = {n: L.length, todo: 0, doing: 0, rev: 0, done: 0, od: 0};
  L.forEach(x => { o[x.st in o ? x.st : "todo"]++; if (isLate(x, t)) o.od++ }); o.p = pct(o.done, o.n); return o;
}
// نسبة تحقق الأهداف (متوسط، كل هدف بحد أقصى 100)
export function kpP(c) { const L = kpOf(c).filter(k => N(k.t) > 0); if (!L.length) return null; return Math.round(L.reduce((a, k) => a + Math.min(100, pct(N(k.v), N(k.t))), 0) / L.length) }

// 🚦 صحة الحملة: ok على المسار · warn تحتاج متابعة · bad في خطر · idle (مخطط لها/منتهية/ملغاة). why = الأسباب بترتيب الأهمية
export function health(M, c, t) {
  if (c.st === "x") return {k: "idle", l: "ملغاة", why: []};
  if (c.st === "done") return {k: "idle", l: "منتهية", why: []};
  const s = spend(M, c.id), bud = N(c.bud), up = pct(s.tot, bud), tp = timeP(c, t), ts = tkStat(M, c.id, t), bad = [], warn = [];
  if (bud > 0 && s.tot > bud) bad.push("تجاوزت الميزانية بـ " + money(s.tot - bud) + " ريال");
  if (c.st === "live" && c.to < t) bad.push("انتهت مدتها ولم تُقفل");
  if (ts.od >= 3 || (ts.n >= 4 && ts.od / ts.n > 0.3)) bad.push(ts.od + " مهام متأخرة"); else if (ts.od) warn.push(ts.od + " مهمة متأخرة");
  if (c.st === "live" && bud > 0 && s.tot <= bud && up > tp + 20) warn.push("الصرف أسرع من الوقت");
  if (c.st === "live" && tp >= 40) { const lag = kpOf(c).filter(k => N(k.t) > 0 && pct(N(k.v), N(k.t)) < tp - 25).length; if (lag) warn.push(lag + " هدف متأخر عن الوقت") }
  if (c.st === "plan" && c.from <= addD(t, 3) && ts.n === 0) warn.push("تبدأ قريباً وبلا مهام");
  if (ts.rev) warn.push(ts.rev + " عمل بانتظار الاعتماد");
  if (bad.length) return {k: "bad", l: "في خطر", why: bad.concat(warn)};
  if (warn.length) return {k: "warn", l: "تحتاج متابعة", why: warn};
  return {k: c.st === "plan" ? "idle" : "ok", l: c.st === "plan" ? "مخطط لها" : "على المسار", why: []};
}

// 💡 القراءة الذكية (من الأرقام فقط): [النوع، الجملة]
export function insights(M, c, t) {
  const out = [], s = spend(M, c.id), bud = N(c.bud), up = pct(s.tot, bud), tp = timeP(c, t), ts = tkStat(M, c.id, t), L = dealsOf(M, c.id);
  if (bud > 0 && s.tot > bud) out.push(["bad", `تجاوزت الحملة ميزانيتها بـ ${money(s.tot - bud)} ريال (${up}% من الميزانية).`]);
  else if (bud > 0 && c.st === "live" && up > tp + 20) out.push(["warn", `الصرف أسرع من الوقت: استُهلك ${up}% من الميزانية بينما مضى ${tp}% فقط من مدة الحملة.`]);
  else if (bud > 0 && c.st === "live" && tp >= 60 && up < tp - 35) out.push(["info", `الصرف أبطأ من المتوقع: استُهلك ${up}% من الميزانية ومضى ${tp}% من المدة. المتبقي ${money(bud - s.tot)} ريال.`]);
  if (c.st === "live" && c.to >= t) { const k = days(t, c.to); out.push(["info", k === 0 ? "اليوم آخر أيام الحملة." : `حتى نهاية الحملة: ${k} يوماً.`]) }
  if (c.st === "plan" && c.from >= t) { const k = days(t, c.from); out.push(["info", k === 0 ? "تبدأ الحملة اليوم." : `تبدأ الحملة بعد ${k} يوماً.`]) }
  if (ts.od) out.push(["bad", `${ts.od} مهمة تأخرت عن موعدها.`]);
  if (ts.rev) out.push(["warn", `${ts.rev} عمل بانتظار اعتماد مدير التسويق.`]);
  const kps = kpOf(c); kps.forEach(k => { const v = N(k.v), tg = N(k.t); if (!tg) return; const p = pct(v, tg);
    if (p >= 100) out.push(["ok", `تحقق هدف «${kpName(k)}»: ${big(v)} من ${big(tg)} (${p}%).`]);
    else if (c.st === "live" && tp >= 40 && p < tp - 25) out.push(["warn", `هدف «${kpName(k)}» متأخر: تحقق ${p}% ومضى ${tp}% من المدة.`]) });
  const sl = campSales(M, c, t), pfm = adPerf(M, c.id), slOk = !!(sl && !sl.wait);
  if (slOk) { out.push([sl.up == null ? "info" : sl.up >= 0 ? "ok" : "warn", `مبيعات الفروع في فترة الحملة (${sl.n} يوماً): ${money(sl.cur)} ريال` + (sl.up == null ? "." : `، مقابل ${money(sl.prev)} في نفس عدد الأيام قبلها (${sl.up >= 0 ? "+" : ""}${sl.up}%).`)]);
    if (s.tot > 0) out.push(["info", `كل ريال صُرف على الحملة قابله ${(sl.cur / s.tot).toFixed(1)} ريال مبيعات في فترتها` + (sl.up != null && sl.diff > 0 ? `، والزيادة عن الفترة السابقة ${money(sl.diff)} ريال (${(sl.diff / s.tot).toFixed(1)} ضعف المصروف).` : ".")]) }
  if (pfm.vw || pfm.ck) { out.push(["info", `الإعلانات الممولة: ${big(pfm.vw)} مشاهدة و${big(pfm.ck)} نقرة` + (pfm.vw ? ` · تكلفة 1000 مشاهدة ${(pfm.a / pfm.vw * 1000).toFixed(1)} ريال` : "") + (pfm.ck ? ` · تكلفة النقرة ${(pfm.a / pfm.ck).toFixed(2)} ريال` : "") + "."]);
    const bp = Object.keys(pfm.by).filter(k => pfm.by[k].ck > 0).map(k => ({k, v: pfm.by[k].a / pfm.by[k].ck})).sort((a, b) => a.v - b.v);
    if (bp.length >= 2) out.push(["ok", `أقل تكلفة للنقرة: ${ADS[bp[0].k] || bp[0].k} (${bp[0].v.toFixed(2)} ريال)، والأعلى: ${ADS[bp[bp.length - 1].k] || bp[bp.length - 1].k} (${bp[bp.length - 1].v.toFixed(2)} ريال).`]) }
  const sp = s.tot; if (sp > 0) {
    const rev = !slOk && kps.find(k => k.k === "rev" && N(k.v) > 0); if (rev) out.push([N(rev.v) >= sp ? "ok" : "warn", `العائد: كل ريال صُرف أعاد ${(N(rev.v) / sp).toFixed(1)} ريال مبيعات (${money(rev.v)} مبيعات مقابل ${money(sp)} مصروف).`]);
    const rc = kps.find(k => (k.k === "reach" || k.k === "views") && N(k.v) > 0); if (rc) out.push(["info", `${rc.k === "reach" ? "تكلفة الوصول لكل 1000 شخص:" : "تكلفة كل 1000 مشاهدة:"} ${(sp / N(rc.v) * 1000).toFixed(1)} ريال.`]);
    const od = kps.find(k => k.k === "ord" && N(k.v) > 0); if (od) out.push(["info", `تكلفة الطلب الواحد: ${money(sp / N(od.v))} ريال.`]);
  }
  const ranked = L.filter(d => (d.st === "ok" || d.st === "paid") && d.rs && N(d.rs.v) > 0).map(d => ({d, cpm: N(d.amt) / N(d.rs.v) * 1000})).sort((a, b) => a.cpm - b.cpm);
  if (ranked.length >= 2) out.push(["ok", `أفضل مؤثر من حيث التكلفة: ${ranked[0].d.n} (${ranked[0].cpm.toFixed(1)} ريال لكل 1000 مشاهدة)، والأعلى تكلفة: ${ranked[ranked.length - 1].d.n} (${ranked[ranked.length - 1].cpm.toFixed(1)}).`]);
  const pe = L.filter(d => d.st === "pend").length, wt = L.filter(d => d.st === "ok").length;
  if (pe) out.push(["warn", `${pe} اتفاق مع مؤثر بانتظار اعتماد مدير التسويق (${money(s.pend)} ريال).`]);
  if (wt) out.push(["warn", `${wt} اتفاق معتمد بانتظار التحويل من المالية (${money(s.wait)} ريال).`]);
  if (!out.length) out.push(["ok", "كل شيء على المسار. أضف النتائج الفعلية أولاً بأول لتظهر قراءات أدق."]);
  return out;
}

// 📥 ما ينتظر قرار هذا الشخص. role = {mgr, fin}. النوع k:
//   rev عمل بانتظار اعتمادي · deal اتفاق بانتظار اعتمادي · pay تحويل مطلوب · ret عملي أُعيد للتعديل · dno اتفاقي رُفض · due مهمتي متأخرة أو قريبة
export function queue(M, role, me, t) {
  const out = [], soon = addD(t, 2);
  if (role.mgr) { vals(M.T).forEach(x => { if (x.st === "rev") out.push({k: "rev", x, at: N(x.sb && x.sb.at)}) }); vals(M.D).forEach(d => { if (d.st === "pend") out.push({k: "deal", d, at: N(d.upd || d.ts)}) }) }
  if (role.fin) vals(M.D).forEach(d => { if (d.st === "ok") out.push({k: "pay", d, at: N(d.ap && d.ap.at)}) });
  vals(M.T).forEach(x => { if (x.as !== me || x.st === "done" || x.st === "rev") return;
    if (x.rt && N(x.rt.at) > N(x.sb && x.sb.at) - 1 && N(x.rt.at) >= N(x.ok && x.ok.at)) out.push({k: "ret", x, at: N(x.rt.at)});
    else if (x.du && x.du <= soon) out.push({k: "due", x, at: (dOf(x.du) || new Date()).getTime()}) });
  vals(M.D).forEach(d => { if (d.st === "no" && d.by && d.by.e === me) out.push({k: "dno", d, at: N(d.ap && d.ap.at)}) });
  const w = {ret: 0, rev: 1, deal: 2, pay: 3, dno: 4, due: 5};
  return out.sort((a, b) => w[a.k] - w[b.k] || a.at - b.at);
}

// 🗂 مهامي مقسّمة بالموعد
export function buckets(L, t) {
  const wk = addD(t, 7), G = [["late", "متأخرة", []], ["today", "اليوم", []], ["week", "خلال 7 أيام", []], ["later", "لاحقاً", []], ["nodate", "بلا موعد", []], ["rev", "أرسلتُها وبانتظار الاعتماد", []]];
  const put = (k, x) => G.find(g => g[0] === k)[2].push(x);
  L.forEach(x => { if (x.st === "done") return; if (x.st === "rev") return put("rev", x); if (!x.du) return put("nodate", x); put(x.du < t ? "late" : x.du === t ? "today" : x.du <= wk ? "week" : "later", x) });
  G.forEach(g => g[2].sort((a, b) => String(a.du || "9").localeCompare(String(b.du || "9")) || N(b.pr) - N(a.pr)));
  return G.filter(g => g[2].length).map(g => ({k: g[0], l: g[1], L: g[2]}));
}

// 👥 حِمل الفريق: لكل شخص له مهام في الحملات المختارة. week = عدد المهام المستحقة في كل يوم من الـ14 القادمة
export function workload(M, cids, t) {
  const P = new Map(), set = cids ? new Set(cids) : null;
  vals(M.T).forEach(x => { if (set && !set.has(x.c)) return; const e = String(x.as || ""); if (!e) return;
    let p = P.get(e); if (!p) { p = {e, n: 0, todo: 0, doing: 0, rev: 0, done: 0, od: 0, open: 0, next: "", week: new Array(14).fill(0), L: []}; P.set(e, p) }
    p.n++; p[x.st in p ? x.st : "todo"]++; p.L.push(x);
    if (x.st !== "done") { p.open++; if (isLate(x, t)) p.od++; if (x.du && x.du >= t && (!p.next || x.du < p.next)) p.next = x.du; if (x.du) { const k = days(t, x.du); if (k >= 0 && k < 14) p.week[k]++ } } });
  return Array.from(P.values()).sort((a, b) => b.od - a.od || b.open - a.open || b.n - a.n);
}

// 🕒 آخر النشاط (مشتق من الأختام المحفوظة، بلا مجموعة جديدة): {at, k, who, verb, obj, c, ref}
export function feed(M, cids, lim) {
  const out = [], set = cids ? new Set(cids) : null, ok = c => !set || set.has(c), nm = o => String(o && o.n || "");
  vals(M.C).forEach(c => { if (ok(c.id)) out.push({at: N(c.ts), k: "new", who: nm(c.by), verb: "أنشأ الحملة", obj: c.n, c: c.id, ref: ""}) });
  vals(M.T).forEach(x => { if (!ok(x.c)) return; const r = "t:" + x.id;
    out.push({at: N(x.ts), k: "task", who: nm(x.by), verb: "أسند مهمة", obj: x.t, c: x.c, ref: r});
    if (x.sb) out.push({at: N(x.sb.at), k: "sub", who: nm(x.sb), verb: "أرسل للاعتماد", obj: x.t, c: x.c, ref: r});
    if (x.rt) out.push({at: N(x.rt.at), k: "ret", who: nm(x.rt), verb: "أعاد للتعديل", obj: x.t, c: x.c, ref: r});
    if (x.ok && x.st === "done") out.push({at: N(x.ok.at), k: "ok", who: nm(x.ok), verb: "اعتمد عمل", obj: x.t, c: x.c, ref: r});
    else if (x.dn) out.push({at: N(x.dn.at), k: "done", who: nm(x.dn), verb: "أنهى مهمة", obj: x.t, c: x.c, ref: r}) });
  vals(M.D).forEach(d => { if (!ok(d.c)) return; const r = "d:" + d.id;
    out.push({at: N(d.ts), k: "deal", who: nm(d.by), verb: "سجّل اتفاقاً مع", obj: d.n, c: d.c, ref: r});
    if (d.ap && d.st !== "pend") out.push({at: N(d.ap.at), k: d.st === "no" ? "ret" : d.st === "x" ? "ret" : "ok", who: nm(d.ap), verb: d.st === "no" ? "رفض اتفاق" : d.st === "x" ? "ألغى اتفاق" : "اعتمد اتفاق", obj: d.n, c: d.c, ref: r});
    if (d.pd) out.push({at: N(d.pd.at), k: "pay", who: nm(d.pd), verb: "حوّل مبلغ " + money(d.amt) + " ريال إلى", obj: d.n, c: d.c, ref: r}) });
  vals(M.X).forEach(x => { if (ok(x.c)) out.push({at: N(x.ts), k: "exp", who: nm(x.by), verb: "سجّل مصروف " + money(x.a) + " ريال", obj: x.nt || lab(XK, x.k), c: x.c, ref: ""}) });
  return out.filter(e => e.at > 0).sort((a, b) => b.at - a.at).slice(0, lim || 20);
}

// 🗓 شبكة شهر: مصفوفة أسابيع، كل يوم {d: "YYYY-MM-DD", in: داخل الشهر}. الأسبوع يبدأ السبت
export function monthGrid(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "")), y = m ? +m[1] : new Date().getFullYear(), mo = m ? +m[2] - 1 : new Date().getMonth();
  const first = new Date(y, mo, 1), back = (first.getDay() + 1) % 7, start = new Date(y, mo, 1 - back), W = [];
  for (let w = 0; w < 6; w++) { const row = []; for (let i = 0; i < 7; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i); row.push({d: ymd(d), in: d.getMonth() === mo}) } if (w === 5 && !row.some(c => c.in)) break; W.push(row) }
  return W;
}
export const ymAdd = (ym, k) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "")), d = new Date(m ? +m[1] : new Date().getFullYear(), (m ? +m[2] - 1 : new Date().getMonth()) + k, 1); return d.getFullYear() + "-" + z2(d.getMonth() + 1) };
export const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const WDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

// ما المسموح لهذا الشخص على المهمة (نفس منطق القواعد، للواجهة فقط)
export function taskCan(x, role, me) {
  const mine = x.as === me, rq = x.rq === true;
  return {
    edit: !!role.mgr, mine,
    start: (mine || role.mgr) && x.st === "todo",
    submit: mine && rq && (x.st === "todo" || x.st === "doing"),
    finish: (mine && !rq && x.st !== "done") || (!!role.mgr && !rq && x.st !== "done"),
    approve: !!role.mgr && x.st === "rev",
    reopen: (!!role.mgr && x.st === "done") || (mine && !rq && x.st === "done"),
    recall: mine && x.st === "rev",
    move: s => { if (s === x.st) return false; if (role.mgr) return true; if (!mine) return false; if (rq) return x.st !== "done" && s !== "done"; return true },
    attach: (mine && x.st !== "done") || !!role.mgr || (x.by && x.by.e === me),
  };
}
