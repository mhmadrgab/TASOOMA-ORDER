// 📣 استوديو التسويق (v266، 27 نوفمبر 2026 — إعادة هيكلة مديول «الحملات التسويقية» v246 بطلب محمد: «عيد هيكلة المديول بطريقة احترافية»).
// مبني على أفكار عامة من أدوات إدارة الحملات والفِرَق (مساحة «مهامي»، لوحة أعمدة بالسحب، عروض متعددة لنفس البيانات، اعتماد المحتوى بجولات، حِمل الفريق) بكود المنصة وثوبها.
//   mkt-core.js  المنطق (ثوابت وحسابات نقية، يُختبر في Node)        mkt-views.js  الشاشات (HTML من الحالة فقط)
//   mkt-css.js   التنسيق                                             mkt.js        هذا الملف: البيانات، الأفعال، النماذج، الأحداث
// البيانات: mkc الحملة · mkt المهمة (+ cm تعليقات، x مرفقات) · mkd اتفاق مؤثر (+ cm، x) · mkdi الآيبان (منفصل) · mkx مصروف.
// الأدوار: مدير التسويق (p.gm والأدمن ومالك النظام) · فريق التسويق p.mk · المالية p.mf · عضو فريق الحملة (في tm) · المتابع (عرض فقط).
// دورة العمل: المهمة التي «تحتاج اعتماداً» (rq) يرسلها المسؤول للمراجعة (rev) ← المدير يعتمدها (done + ok) أو يعيدها بملاحظة (rt، rn+1).
// القواعد mk_read / mk_write / mk_sub_write في 002_rules.sql، والإشعارات onMkTask / onMkDeal / onMkCm في السيرفر.
import {collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, query, where, withTimeout} from "./fb.js";
import {loadAtts, putAtt, dropAtt, readFile, fileErr, openRef, FILE_ACCEPT} from "./att.js";
import {E, N, money, today, dmy, addD, nid, num, CH, PF, KP, RL, XK, DST, PRI, CLR, TPL, lab, rl, tasksOf, dealsOf, exOf, kpOf, kpName,
  spend, queue, ibanNorm, ibanOk, ibanFmt, taskCan, ymAdd} from "./mkt-core.js";
import {topHtml, bodyHtml, drawerHtml, reportHtml, viewsOf, nameOf as nameOfA, av as avA} from "./mkt-views.js";
import {CSS} from "./mkt-css.js";
export {CH, ibanOk, ibanNorm} from "./mkt-core.js";

// ---------- الحالة ----------
const g = id => document.getElementById(id);
let X = null, ROOT = null, TOP = null, BODY = null, ON = false, LOADED = false, BUSY = false, UN = [], PEND = null, WD = new Map(), SEEN = {}, RT = 0, DRAG = "";
const RAW = new Map(), M = {C: new Map(), T: new Map(), D: new Map(), X: new Map()}, IBC = new Map();
const S = {pg: "home", c: "", v: "", f: "act", lay: "cards", q: "", cm: "", who: "", wr: "", tm: ""};
const DR = {k: "", id: "", tab: "cm", cm: [], cmOk: false, at: [], atOk: false, up: 0, un: null, busy: false, back: null};
const SKEY = "tz_mk_ui", SEENK = () => "tz_mk_seen_" + me();
const me = () => X && X.me ? String(X.me.e || "").toLowerCase() : "";
const myN = () => X && X.me ? String(X.me.n || "").slice(0, 60) : "";
const role = () => ({mgr: !!(X && X.mgr), team: !!(X && X.team), fin: !!(X && X.fin), all: !!(X && X.all), ro: !!(X && X.ro)});
const app = () => ({M, S, DR, WD, IBC, role: role(), me: me(), t: today(), now: Date.now(), loaded: LOADED, seen: id => N(SEEN[id])});
const nameOf = e => nameOfA({WD}, e), av = e => avA({WD}, e);
const stampMe = x => Object.assign({e: me(), n: myN(), at: Date.now()}, x || {});
const toast = (t, k) => { if (X) X.toast(t, k) };
const pg = list => { try { if (X && X.ping && list && list.length) X.ping(list) } catch (e) {} };
const errTxt = e => { const m = String(e && (e.code || e.message) || ""); return /permission|denied|42501/.test(m) ? "غير مسموح. ربما لم تتحدّث قواعد المنصة بعد، أو ليس لديك الصلاحية" : /timeout/.test(m) ? "الاتصال بطيء، حاول مرة أخرى" : /exhausted/.test(m) ? "الخدمة متوقفة مؤقتاً، حاول لاحقاً" : "تعذّر الحفظ، تحقّق من الاتصال وحاول مرة أخرى" };
const saveUi = () => { try { sessionStorage.setItem(SKEY, JSON.stringify({pg: S.pg, c: S.c, v: S.v, f: S.f, lay: S.lay})) } catch (e) {} };
const loadUi = () => { try { const o = JSON.parse(sessionStorage.getItem(SKEY) || "{}"); ["pg", "c", "v", "f", "lay"].forEach(k => { if (typeof o[k] === "string") S[k] = o[k] }) } catch (e) {} };
const loadSeen = () => { try { const o = JSON.parse(localStorage.getItem(SEENK()) || "{}"); SEEN = o && typeof o === "object" ? o : {} } catch (e) { SEEN = {} } };
const saveSeen = () => { try { const k = Object.keys(SEEN); if (k.length > 400) k.slice(0, k.length - 400).forEach(x => delete SEEN[x]); localStorage.setItem(SEENK(), JSON.stringify(SEEN)) } catch (e) {} };

// ---------- التشغيل والبيانات ----------
// ctx: {db, toast, me:{e,n}, mgr, team, fin, all, ro, ping(list), redraw(), show()}
export function initMk(ctx) {
  stopMk(); X = ctx; if (!g("mkp-css")) { const s = document.createElement("style"); s.id = "mkp-css"; s.textContent = CSS; document.head.appendChild(s) }
  loadUi(); loadSeen();
  document.addEventListener("click", onClick); document.addEventListener("change", onChange); document.addEventListener("input", onInput); document.addEventListener("keydown", onKey);
  ["dragstart", "dragend", "dragover", "dragleave", "drop"].forEach(k => document.addEventListener(k, onDrag));
  start();
}
export function stopMk() {
  UN.forEach(f => { try { f() } catch (e) {} }); UN = []; ON = false; LOADED = false; BUSY = false; PEND = null; closeDrawer(true);
  RAW.clear(); M.C.clear(); M.T.clear(); M.D.clear(); M.X.clear(); IBC.clear(); WD = new Map();
  document.removeEventListener("click", onClick); document.removeEventListener("change", onChange); document.removeEventListener("input", onInput); document.removeEventListener("keydown", onKey);
  ["dragstart", "dragend", "dragover", "dragleave", "drop"].forEach(k => document.removeEventListener(k, onDrag));
  ["mkm", "msd", "mkpr"].forEach(i => { const m = g(i); if (m) m.remove() }); if (ROOT) ROOT.remove(); ROOT = TOP = BODY = null; X = null;
}
function sub(q, map, last) {
  UN.push(onSnapshot(q, s => { map.clear(); s.docs.forEach(d => map.set(d.id, Object.assign({id: d.id}, d.data()))); if (last) LOADED = true; changed() },
    () => { if (last) { LOADED = true; toast("تعذّرت قراءة الحملات. ربما لم تتحدّث قواعد المنصة بعد", "er"); changed() } }));
}
function start() {
  if (ON || !X) return; ON = true; const db = X.db, m = me();
  UN.push(onSnapshot(collection(db, "whdir"), s => { WD = new Map(); s.docs.forEach(d => WD.set(d.id.toLowerCase(), d.data())); changed() }, () => {}));
  sub(collection(db, "mkt"), RAW);// القواعد تُرجع ما يحق له فقط: كل المهام لمن يرى الكل، ومهام حملاته لعضو الفريق
  if (X.all) { sub(collection(db, "mkd"), M.D); sub(collection(db, "mkx"), M.X); sub(collection(db, "mkc"), M.C, true) }
  else { sub(query(collection(db, "mkd"), where("by.e", "==", m)), M.D); sub(query(collection(db, "mkc"), where("tm", "array-contains", m)), M.C, true) }
}
// المهام الظاهرة: لمن لا يرى الكل = مهامه + مهام الحملات التي هو في فريقها (نفس القاعدة في السيرفر)
function syncTasks() { M.T.clear(); const all = !!(X && X.all), m = me(); RAW.forEach((x, id) => { if (all || x.as === m || (x.by && x.by.e === m) || M.C.has(x.c)) M.T.set(id, x) }) }
function changed() {
  if (!X) return; syncTasks();
  if (PEND && LOADED && M.C.has(PEND.c)) { const p = PEND; PEND = null; S.pg = "c"; S.c = p.c; fixView(); if (X.show) X.show(); if (p.it) setTimeout(() => openItem(p.it), 60) }
  if (X.redraw) X.redraw(); schedule();
}
const schedule = () => { clearTimeout(RT); RT = setTimeout(render, 16) };
const fixView = () => { const V = viewsOf(app()); if (!V.some(x => x[0] === S.v)) S.v = role().mgr ? "ov" : "board" };

// ---------- الرسم (عنصر ثابت، والمناطق تُستبدل فقط لو تغيّر محتواها) ----------
export function mkView() { return `<div id="mkhost"></div>` }
export function mkMount(host) {
  if (!X || !host) return;
  if (!ROOT) { ROOT = document.createElement("div"); ROOT.id = "mkp"; ROOT.className = "ms"; ROOT.innerHTML = `<div id="ms-top"></div><div id="ms-body"></div>`; TOP = ROOT.firstChild; BODY = ROOT.lastChild }
  if (ROOT.parentNode !== host) host.appendChild(ROOT);
  render();
}
function put(el, h) {
  if (!el || el.__h === h) return;
  const a = document.activeElement, keep = a && a.id && el.contains(a) ? {id: a.id, s: a.selectionStart, e: a.selectionEnd} : null, sc = Array.from(el.querySelectorAll(".ms-bd,.ms-col .kl,.msd-s")).map(n => [n.scrollLeft, n.scrollTop]);
  el.innerHTML = h; el.__h = h;
  Array.from(el.querySelectorAll(".ms-bd,.ms-col .kl,.msd-s")).forEach((n, i) => { if (sc[i]) { n.scrollLeft = sc[i][0]; n.scrollTop = sc[i][1] } });
  if (keep) { const n = g(keep.id); if (n) { n.focus(); try { n.setSelectionRange(keep.s, keep.e) } catch (e) {} } }
}
function render() {
  if (!X || !ROOT) return; if (!ROOT.isConnected) { if (DR.k) closeDrawer(true); return }
  if (S.pg === "c" && LOADED && !M.C.has(S.c)) { S.pg = "camps"; S.c = "" } if (S.pg === "c") fixView();
  const a = app(); put(TOP, topHtml(a)); put(BODY, bodyHtml(a)); drawerPaint(a);
}
const guard = () => { if (DR.k && ROOT && !ROOT.isConnected) closeDrawer(true) };
export function mkVisible() { guard(); return !!X && (!!X.all || M.C.size > 0 || M.T.size > 0) }
export function mkCount() { guard(); return X ? queue(M, role(), me(), today()).length : 0 }
// فتح حملة (ومعها مهمة أو اتفاق: "t:رقم" / "d:رقم") من رابط إشعار
export function mkOpen(id, item) { if (!X) return; id = String(id || ""); item = /^[td]:[A-Za-z0-9_-]{1,64}$/.test(String(item || "")) ? String(item) : ""; PEND = {c: id, it: item}; changed() }
function go(p) { Object.assign(S, p); saveUi(); render(); if (p.pg || p.c) window.scrollTo(0, 0) }
function openItem(ref) { const k = ref[0], id = ref.slice(2); if ((k === "t" && M.T.has(id)) || (k === "d" && M.D.has(id))) openDrawer(k, id) }

// ---------- الدرج الجانبي ----------
function openDrawer(k, id) {
  if (DR.k === k && DR.id === id) return; const back = DR.k ? DR.back : document.activeElement; closeDrawer(true);
  Object.assign(DR, {k, id, tab: "cm", cm: [], cmOk: false, at: [], atOk: false, up: 0, busy: false, back});
  let d = g("msd"); if (!d) { d = document.createElement("div"); d.id = "msd"; d.className = "ms"; document.body.appendChild(d) }
  d.innerHTML = `<div class="msd-bg" data-mkq="dx"></div><aside class="msd-p" role="dialog" aria-modal="true" aria-label="التفاصيل"><div id="msd-h"></div><div id="msd-m" class="msd-s"></div>
  <div id="msd-f" class="msd-f"><textarea id="msd-t" rows="1" maxlength="1000" placeholder="اكتب تعليقاً…" aria-label="تعليق جديد"></textarea><button type="button" class="ms-b p" data-mkq="cmsend">إرسال</button></div>
  <input type="file" id="msd-file" multiple hidden accept="${E(FILE_ACCEPT)}"></aside>`;
  d.classList.add("on"); document.documentElement.classList.add("msd-on");
  const col = k === "t" ? "mkt" : "mkd";
  try { DR.un = onSnapshot(collection(X.db, col, id, "cm"), s => { if (DR.k !== k || DR.id !== id) return; DR.cm = s.docs.map(x => Object.assign({id: x.id}, x.data())).sort((a, b) => N(a.ts) - N(b.ts)); DR.cmOk = true; markSeen(); drawerPaint(); const m = g("msd-m"); if (m && DR.tab === "cm" && DR.scr) m.scrollTop = m.scrollHeight; DR.scr = true },
    () => { DR.cmOk = true; drawerPaint() }) } catch (e) { DR.cmOk = true }
  loadAt(); drawerPaint();
  setTimeout(() => { const b = d.querySelector('[data-mkq="dx"].ms-ib'); if (b) b.focus() }, 40);
}
function closeDrawer(silent) {
  if (DR.un) { try { DR.un() } catch (e) {} } const back = DR.back; Object.assign(DR, {k: "", id: "", un: null, cm: [], at: [], up: 0, back: null, scr: false});
  const d = g("msd"); if (d) { d.classList.remove("on"); d.innerHTML = "" } document.documentElement.classList.remove("msd-on");
  if (!silent && back && back.isConnected) { try { back.focus() } catch (e) {} }
}
function drawerPaint(a) {
  if (!DR.k) return; const r = drawerHtml(a || app()); if (!r) { closeDrawer(true); return }
  put(g("msd-h"), r.head); put(g("msd-m"), r.main); const f = g("msd-f"); if (f) f.style.display = r.talk ? "" : "none";
  const p = g("msd") && g("msd").querySelector(".msd-p"); if (p) p.setAttribute("aria-label", r.label || "التفاصيل");
}
const drDoc = () => DR.k === "t" ? M.T.get(DR.id) : DR.k === "d" ? M.D.get(DR.id) : null;
const drCol = () => DR.k === "t" ? "mkt" : "mkd";
function markSeen() { const p = drDoc(), n = Math.max(DR.cm.length, N(p && p.cn)); if (N(SEEN[DR.id]) !== n) { SEEN[DR.id] = n; saveSeen(); schedule() } }
// 💬 التعليقات
async function cmSend() {
  const ta = g("msd-t"), v = String(ta && ta.value || "").trim().slice(0, 1000), p = drDoc(); if (!v || DR.busy || !p) return;
  const k = DR.k, id = DR.id, col = drCol(), cid = nid(); DR.busy = true;
  try { await withTimeout(setDoc(doc(X.db, col, id, "cm", cid), {t: v, by: {e: me(), n: myN()}, ts: Date.now()})); ta.value = ""; ta.style.height = "";
    updateDoc(doc(X.db, col, id), {cn: N(p.cn) + 1, upd: Date.now()}).catch(() => {}); pg([k + ":" + id + ":" + cid]) }
  catch (e) { toast(errTxt(e), "er") } DR.busy = false;
}
async function cmDel(cid) {
  const p = drDoc(); if (!p || !confirm("حذف التعليق؟")) return; const col = drCol(), id = DR.id;
  try { await withTimeout(deleteDoc(doc(X.db, col, id, "cm", cid))); if (N(p.cn) > 0) updateDoc(doc(X.db, col, id), {cn: N(p.cn) - 1, upd: Date.now()}).catch(() => {}) } catch (e) { toast(errTxt(e), "er") }
}
// 📎 المرفقات (صور تُصغَّر، وملفات حتى 3 ميجا بنفس طريقة المنصة: أجزاء ثم رأس)
async function loadAt() {
  const k = DR.k, id = DR.id; if (!k) return;
  try { const L = await loadAtts(X.db, drCol(), id, "x"); if (DR.k !== k || DR.id !== id) return; DR.at = L } catch (e) {} if (DR.k === k && DR.id === id) { DR.atOk = true; drawerPaint() }
}
const isImg = f => /^image\//.test(f.type || "") || (!f.type && /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name || ""));
function shrinkImg(file, maxW, cap) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(u); no(new Error("read")) };
    im.onload = () => { try { let w = im.naturalWidth, h = im.naturalHeight, sc = Math.min(1, maxW / Math.max(w, h)), q = 0.86, out = "";
      for (let i = 0; i < 9; i++) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc)); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", q); if (out.length <= cap) break; if (q > 0.6) q -= 0.12; else sc *= 0.8 }
      URL.revokeObjectURL(u); if (!/^data:image\/jpeg;base64,/.test(out) || out.length > cap) return no(new Error("big")); ok(out) } catch (e) { URL.revokeObjectURL(u); no(new Error("read")) } };
    im.src = u;
  });
}
async function addFiles(files) {
  const p = drDoc(); if (!p || !files.length) return; const k = DR.k, id = DR.id, col = drCol(), used = new Set(DR.at.map(a => a.k)), free = []; for (let n = 2; n <= 10; n++) if (!used.has(n)) free.push(n);
  const L = files.slice(0, free.length); if (!L.length) { toast("الحد الأقصى 9 مرفقات", "er"); return } if (files.length > L.length) toast("أُضيف " + L.length + " فقط (الحد 9 مرفقات)", "er");
  let an = N(p.an), bad = ""; DR.up = L.length; drawerPaint();
  for (const f of L) {
    try { const x = isImg(f) ? await shrinkImg(f, 1800, 650000) : await readFile(f); await withTimeout(putAtt(X.db, col, id, "x", free.shift(), x), 60000); an++; await updateDoc(doc(X.db, col, id), {an, upd: Date.now()}).catch(() => {}) }
    catch (e) { bad = /permission|denied|42501/.test(String(e && (e.code || e.message))) ? errTxt(e) : isImg(f) ? "تعذّر تجهيز الصورة" : fileErr(e) }
    if (DR.k !== k || DR.id !== id) return; DR.up--; drawerPaint();
  }
  DR.up = 0; if (bad) toast(bad, "er"); else toast("✅ أُرفقت"); await loadAt();
}
async function atDel(n) {
  const a = DR.at.find(x => x.k === +n), p = drDoc(); if (!a || !p || !confirm("حذف المرفق؟")) return;
  try { await dropAtt(X.db, a.path, a.file ? a.src : ""); if (N(p.an) > 0) updateDoc(doc(X.db, drCol(), DR.id), {an: N(p.an) - 1, upd: Date.now()}).catch(() => {}); await loadAt() } catch (e) { toast(errTxt(e), "er") }
}
function atOpen(n) { const a = DR.at.find(x => x.k === +n); if (!a) return; if (a.file) { toast("جاري تنزيل الملف…"); openRef(X.db, a.src, a.nm, "save", X.toast) } }
// حذف التعليقات والمرفقات قبل حذف المهمة/الاتفاق (حتى لا تبقى يتيمة)
async function purge(col, id) {
  try { const s = await getDocs(collection(X.db, col, id, "cm")); for (const d of s.docs) { try { await deleteDoc(doc(X.db, col, id, "cm", d.id)) } catch (e) {} } } catch (e) {}
  try { const L = await loadAtts(X.db, col, id, "x"); for (const a of L) { try { await dropAtt(X.db, a.path, a.file ? a.src : "") } catch (e) {} } } catch (e) {}
}

// ---------- أفعال المهمة ----------
const tRef = id => doc(X.db, "mkt", id);
async function tWrite(id, fn, okMsg, note) {
  const x = M.T.get(id); if (!x || BUSY) return false; BUSY = true;
  try { await withTimeout(fn(x)); BUSY = false; if (okMsg) toast(okMsg); if (note !== false) pg(["t:" + id]); return true } catch (e) { BUSY = false; toast(errTxt(e), "er"); return false }
}
// إعادة كتابة المهمة كاملة بلا حقول معيّنة (لإزالة ختم الإنهاء/الاعتماد عند إعادة الفتح)
const tReset = (x, st, drop, extra) => { const n = Object.assign({}, x, {st, upd: Date.now()}, extra || {}); delete n.id; drop.forEach(k => delete n[k]); return setDoc(tRef(x.id), n) };
function tgo(id, act) {
  const x = M.T.get(id); if (!x) return; const can = taskCan(x, role(), me());
  if (act === "start") return tWrite(id, () => updateDoc(tRef(id), {st: "doing", upd: Date.now()}), "", false);
  if (act === "submit") return tWrite(id, () => updateDoc(tRef(id), {st: "rev", sb: stampMe(), upd: Date.now()}), "📤 أُرسل لمدير التسويق للاعتماد");
  if (act === "recall") return tWrite(id, () => updateDoc(tRef(id), {st: "doing", upd: Date.now()}), "سُحب الإرسال", false);
  if (act === "finish") return tWrite(id, () => updateDoc(tRef(id), {st: "done", dn: stampMe(), upd: Date.now()}), "✅ أُنجزت المهمة");
  if (act === "approve") { if (!can.approve && !(role().mgr && x.st !== "done")) return; return tWrite(id, () => updateDoc(tRef(id), {st: "done", dn: stampMe(), ok: stampMe(), upd: Date.now()}), "✅ اعتُمد العمل ووصل إشعار للمسؤول") }
  if (act === "return") return returnForm(x);
  if (act === "reopen") { if (!confirm("إعادة فتح المهمة؟")) return; return tWrite(id, () => tReset(x, "doing", ["dn", "ok"]), "أُعيد فتح المهمة", false) }
}
// السحب بين الأعمدة: نفس قواعد الأزرار. المهمة التي تحتاج اعتماداً لا تدخل «منتهية» إلا باعتماد المدير
function moveTask(id, st) {
  const x = M.T.get(id); if (!x || x.st === st) return; const r = role(), can = taskCan(x, r, me());
  if (st === "done" && x.rq && !r.mgr && can.mine && x.st !== "rev") return tgo(id, "submit");// المسؤول سحبها إلى «منتهية»: تُرسل للاعتماد
  if (!can.move(st)) { toast(x.rq && st === "done" && can.mine ? "هذه المهمة تحتاج اعتماد مدير التسويق: اسحبها إلى «بانتظار الاعتماد»" : "لا يمكنك نقل هذه المهمة", "er"); return }
  if (st === "done") { if (x.rq && !r.mgr) return tgo(id, "submit"); return tgo(id, x.rq ? "approve" : "finish") }
  if (st === "rev") { if (!x.rq) { toast("هذه المهمة لا تحتاج اعتماداً: اسحبها إلى «منتهية» مباشرة", "er"); return } return tgo(id, "submit") }
  if (x.st === "rev" && r.mgr && !can.mine) return returnForm(x);
  if (x.st === "done") return tWrite(id, () => tReset(x, st, ["dn", "ok"]), "", false);
  return tWrite(id, () => updateDoc(tRef(id), {st, upd: Date.now()}), "", false);
}
async function taskCl(id, k, on) { const x = M.T.get(id); if (!x) return; const cl = (x.cl || []).map((y, i) => i === k ? {t: y.t, k: on} : {t: y.t, k: !!y.k}); try { await withTimeout(updateDoc(tRef(id), {cl, upd: Date.now()})) } catch (e) { toast(errTxt(e), "er"); render() } }
async function taskDel(id) {
  const x = M.T.get(id); if (!x || !confirm(`حذف المهمة «${x.t}» مع تعليقاتها ومرفقاتها؟`)) return; closeM(); if (DR.id === id) closeDrawer(true);
  try { await purge("mkt", id); await withTimeout(deleteDoc(tRef(id))); toast("حُذفت المهمة") } catch (e) { toast(errTxt(e), "er") }
}

// ---------- النماذج (نافذة #mkm) ----------
function modal(h, v, i) { let m = g("mkm"); if (!m) { m = document.createElement("div"); m.id = "mkm"; m.className = "ms"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); document.body.appendChild(m) } m.innerHTML = `<div>${h}</div>`; m.classList.add("on"); m.dataset.mkv = v || ""; m.dataset.mki = i || ""; return m }
const closeM = () => { const m = g("mkm"); if (m) { m.classList.remove("on"); m.innerHTML = ""; m.dataset.mkv = ""; m.dataset.mki = "" } BUSY = false };
const errM = t => { const e = g("mk-err"); if (e) e.textContent = t; else toast(t, "er") };
const focusL = id => setTimeout(() => { const f = g(id); if (f) f.focus() }, 60);
const people = () => Array.from(WD.entries()).filter(x => x[1] && x[1].n).map(x => ({e: x[0], n: x[1].n})).sort((a, b) => String(a.n).localeCompare(String(b.n), "ar"));
const foot = (save, lbl, extra) => `<div class="err" id="mk-err" aria-live="polite"></div><div class="row">${extra || ""}<button type="button" class="ms-b" data-mkq="mx">إلغاء</button><button type="button" class="ms-b p" data-mkq="${save[0]}"${save[1] != null ? ` data-mki="${E(save[1])}"` : ""}${save[2] != null ? ` data-mkk="${E(save[2])}"` : ""}>${lbl}</button></div>`;
const kpRow = k => `<div class="kr" data-kr><select data-kk aria-label="نوع الهدف">${KP.map(x => `<option value="${x[0]}"${k.k === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select><input data-kt inputmode="decimal" dir="ltr" value="${k.t === "" ? "" : E(k.t)}" placeholder="المستهدف" aria-label="المستهدف"><button type="button" class="ms-b" data-mkq="krm" aria-label="حذف الهدف">×</button><input data-kl maxlength="40" value="${E(k.l || "")}" placeholder="اسم الهدف" style="grid-column:1/-1;${k.k === "oth" ? "" : "display:none"}" aria-label="اسم الهدف"></div>`;
function campForm(c) {
  const k0 = c ? kpOf(c) : [{k: "reach", t: ""}, {k: "rev", t: ""}], tm = c && Array.isArray(c.tm) ? c.tm : [], t = today();
  modal(`<h3>${c ? "تعديل الحملة" : "حملة جديدة"}</h3><p class="sub">الهدف والمدة والميزانية والقنوات والأهداف بالأرقام وفريق العمل.</p>
  <label class="lb" for="mk-n">اسم الحملة</label><input id="mk-n" maxlength="80" value="${c ? E(c.n) : ""}" placeholder="مثال: حملة الشتاء للأحذية">
  <label class="lb" for="mk-gl">الهدف من الحملة (اختياري)</label><textarea id="mk-gl" rows="2" maxlength="400">${c ? E(c.gl || "") : ""}</textarea>
  <div class="g3"><div><label class="lb" for="mk-f">من</label><input id="mk-f" type="date" value="${E(c ? c.from : t)}"></div><div><label class="lb" for="mk-t">إلى</label><input id="mk-t" type="date" value="${E(c ? c.to : addD(t, 30))}"></div>
  <div><label class="lb" for="mk-b">الميزانية (ريال)</label><input id="mk-b" inputmode="decimal" dir="ltr" value="${c ? E(c.bud) : ""}" placeholder="0"></div></div>
  <span class="lb">القنوات</span><div class="chs">${CH.map(x => `<label><input type="checkbox" data-mkch="${x[0]}"${c && (c.ch || []).indexOf(x[0]) >= 0 ? " checked" : ""}>${x[1]}</label>`).join("")}</div>
  <span class="lb">الأهداف بالأرقام (المستهدف)</span><div id="mk-kps">${k0.map(kpRow).join("")}</div><button type="button" class="ms-b sm" data-mkq="kadd">＋ هدف</button>
  <label class="lb" for="mk-pq">فريق الحملة (من يعمل فيها)</label><input id="mk-pq" placeholder="بحث بالاسم"><div class="ppl" id="mk-ppl">${people().map(p => `<label data-pn="${E(p.n)}"><input type="checkbox" data-mktm="${E(p.e)}"${tm.indexOf(p.e) >= 0 ? " checked" : ""}>${av(p.e)}<span data-notr>${E(p.n)}</span></label>`).join("") || `<span class="ms-mu">لا أسماء في دليل المستودع</span>`}</div>
  <span class="lb">اللون</span><div class="chs">${CLR.map((x, i) => `<label><input type="radio" name="mk-cl" value="${i}"${N(c && c.cl) === i ? " checked" : ""}><i class="sw" style="background:${x}"></i></label>`).join("")}</div>
  <label class="lb" for="mk-nt">ملاحظات (اختياري)</label><textarea id="mk-nt" rows="2" maxlength="1000">${c ? E(c.nt || "") : ""}</textarea>
  ${foot(["csave"], c ? "حفظ" : "إنشاء الحملة")}`, "camp", c ? c.id : ""); focusL("mk-n");
}
async function campSave() {
  if (BUSY) return; const id = g("mkm").dataset.mki, old = id ? M.C.get(id) : null, n = String(g("mk-n").value || "").trim(), from = g("mk-f").value, to = g("mk-t").value, bud = num(g("mk-b").value);
  if (n.length < 2) return errM("اكتب اسم الحملة"); if (!from || !to || to < from) return errM("تاريخ النهاية لازم يكون بعد البداية"); if (isNaN(bud) || bud < 0) return errM("الميزانية رقم غير صحيح");
  const kp = []; let bad = false; document.querySelectorAll("#mk-kps [data-kr]").forEach(r => { const k = r.querySelector("[data-kk]").value, t = num(r.querySelector("[data-kt]").value), l = String(r.querySelector("[data-kl]").value || "").trim().slice(0, 40); if (isNaN(t)) bad = true; else if (t > 0) { const o = {k, t}, prev = old ? kpOf(old).find(x => x.k === k && (x.l || "") === (k === "oth" ? l : (x.l || ""))) : null; if (prev && prev.v != null) o.v = N(prev.v); if (k === "oth" && l) o.l = l; kp.push(o) } });
  if (bad) return errM("قيمة هدف غير صحيحة"); if (kp.length > 8) return errM("حتى 8 أهداف");
  const ch = Array.from(document.querySelectorAll("#mkm [data-mkch]:checked")).map(x => x.dataset.mkch), tm = Array.from(document.querySelectorAll("#mkm [data-mktm]:checked")).map(x => x.dataset.mktm);
  if (old) Array.from(new Set(tasksOf(M, old.id).map(x => x.as))).forEach(e => { if (tm.indexOf(e) < 0) tm.push(e) });// من له مهام لا يُزال من الفريق
  if (tm.length > 30) return errM("فريق الحملة حتى 30 شخصاً");
  const clv = document.querySelector('#mkm input[name="mk-cl"]:checked'), d = {n: n.slice(0, 80), ch, from, to, bud, kp, tm, st: old ? old.st : "plan", by: old ? old.by : {e: me(), n: myN()}, ts: old ? old.ts : Date.now()};
  const gl = String(g("mk-gl").value || "").trim().slice(0, 400), nt = String(g("mk-nt").value || "").trim().slice(0, 1000); if (gl) d.gl = gl; if (nt) d.nt = nt; if (clv) d.cl = +clv.value; if (old && old.cd) d.cd = old.cd; if (old) d.upd = Date.now();
  BUSY = true; const cid = id || nid();
  try { await withTimeout(setDoc(doc(X.db, "mkc", cid), d)); closeM(); toast(old ? "✅ حُفظت الحملة" : "✅ أُنشئت الحملة. أضف المهام الآن"); if (!old) go({pg: "c", c: cid, v: "board"}) } catch (e) { BUSY = false; errM(errTxt(e)) }
}
const asOpts = (c, sel) => { const tm = Array.isArray(c.tm) ? c.tm : [], P = people(); return `<option value="">— اختر —</option><optgroup label="فريق الحملة">${tm.map(e => `<option value="${E(e)}"${sel === e ? " selected" : ""}>${E(nameOf(e))}</option>`).join("")}</optgroup><optgroup label="موظفون آخرون (يُضافون لفريق الحملة)">${P.filter(p => tm.indexOf(p.e) < 0).map(p => `<option value="${E(p.e)}">${E(p.n)}</option>`).join("")}</optgroup>` };
function taskForm(c, x, pre) {
  pre = pre || {}; const t = today(), r0 = x ? x.r : "ct", rq = x ? x.rq === true : rl(r0)[4];
  modal(`<h3>${x ? "تعديل مهمة" : "مهمة جديدة"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>»</p>
  <label class="lb" for="mk-tt">المهمة</label><input id="mk-tt" maxlength="140" value="${x ? E(x.t) : ""}" placeholder="مثال: تصوير مجموعة الشتاء">
  <div class="g2"><div><label class="lb" for="mk-tr">مسار العمل</label><select id="mk-tr">${RL.map(r => `<option value="${r[0]}"${r0 === r[0] ? " selected" : ""}>${r[2]}</option>`).join("")}</select></div>
  <div><label class="lb" for="mk-ta">المسؤول</label><select id="mk-ta">${asOpts(c, x ? x.as : (S.who || ""))}</select></div></div>
  <div class="g3"><div><label class="lb" for="mk-ts">البداية (اختياري)</label><input id="mk-ts" type="date" value="${E(x ? x.sd || "" : "")}"></div><div><label class="lb" for="mk-td">الموعد النهائي</label><input id="mk-td" type="date" value="${E(x ? x.du || "" : pre.du || addD(t, 3))}"></div>
  <div><label class="lb" for="mk-tp">الأولوية</label><select id="mk-tp">${PRI.map((p, i) => `<option value="${i}"${N(x && x.pr) === i ? " selected" : ""}>${p}</option>`).join("")}</select></div></div>
  <label class="ck"><input type="checkbox" id="mk-rq"${rq ? " checked" : ""}${x && x.st === "rev" ? " disabled" : ""}><span><b>يحتاج اعتمادك قبل الإنهاء</b><small>المسؤول يرسل العمل ومرفقاته للمراجعة، وأنت تعتمده أو تعيده بملاحظة.</small></span></label>
  <label class="lb" for="mk-tn">الوصف والمطلوب بالتفصيل (اختياري)</label><textarea id="mk-tn" rows="3" maxlength="2000">${x ? E(x.nt || "") : ""}</textarea>
  <label class="lb" for="mk-tc">قائمة فرعية (اختياري): بند في كل سطر</label><textarea id="mk-tc" rows="3" placeholder="مثال:&#10;الأحذية&#10;الشنط&#10;العطور">${x && Array.isArray(x.cl) ? E(x.cl.map(k => k.t).join("\n")) : ""}</textarea>
  ${foot(["tsave", x ? x.id : ""], x ? "حفظ" : "إسناد المهمة", x ? `<button type="button" class="ms-b dng" data-mkq="tdel" data-mki="${E(x.id)}">🗑 حذف</button><span class="ms-sp"></span>` : "")}`, "task", c.id);
  g("mkm").dataset.mkst = pre.st || ""; g("mkm").dataset.rqt = x ? "1" : ""; focusL("mk-tt");
}
async function taskSave(tid) {
  if (BUSY) return; const mm = g("mkm"), c = M.C.get(mm.dataset.mki); if (!c) return; const old = tid ? M.T.get(tid) : null;
  const t = String(g("mk-tt").value || "").trim(), r = g("mk-tr").value, du = g("mk-td").value, sd = g("mk-ts").value, as = g("mk-ta").value, nt = String(g("mk-tn").value || "").trim().slice(0, 2000), pr = +g("mk-tp").value || 0, rq = g("mk-rq").checked;
  if (t.length < 2) return errM("اكتب المهمة"); if (!as) return errM("اختر المسؤول"); if (sd && du && sd > du) return errM("البداية بعد الموعد النهائي");
  const lines = String(g("mk-tc").value || "").split(/\n/).map(s => s.trim().slice(0, 120)).filter(Boolean).slice(0, 20), ocl = old && Array.isArray(old.cl) ? old.cl : [], cl = lines.map(s => { const o = ocl.find(k => k.t === s); return {t: s, k: !!(o && o.k)} });
  const d = old ? Object.assign({}, old) : {c: c.id, st: mm.dataset.mkst === "doing" ? "doing" : "todo", by: {e: me(), n: myN()}, ts: Date.now()}; delete d.id;
  d.t = t.slice(0, 140); d.r = r; d.as = as; const setOr = (k, v) => { if (v) d[k] = v; else delete d[k] };
  setOr("du", du); setOr("sd", sd); setOr("nt", nt); setOr("cl", cl.length ? cl : null); setOr("pr", pr); if (rq) d.rq = true; else delete d.rq; if (old) d.upd = Date.now();
  if (old && old.st === "rev" && !rq) return errM("المهمة الآن بانتظار الاعتماد: اعتمدها أو أعدها أولاً");
  const id = tid || nid(), tm = Array.isArray(c.tm) ? c.tm.slice() : []; BUSY = true;
  try { const b = writeBatch(X.db); if (tm.indexOf(as) < 0) { tm.push(as); b.update(doc(X.db, "mkc", c.id), {tm, upd: Date.now()}) } b.set(tRef(id), d); await withTimeout(b.commit());
    closeM(); toast(old ? "✅ حُفظت المهمة" : "✅ أُسندت المهمة ووصل إشعار للمسؤول"); pg(["t:" + id]) } catch (e) { BUSY = false; errM(errTxt(e)) }
}
function tplForm(c) {
  const have = tasksOf(M, c.id).map(x => x.t);
  modal(`<h3>⚡ المهام المعتادة لحملة</h3><p class="sub">اختر المهام والمسؤول عن كل واحدة. المواعيد محسوبة من بداية الحملة (${E(dmy(c.from))}) ويمكن تغييرها. مهام التصوير والمحتوى والإعلانات تُضاف وهي «تحتاج اعتمادك».</p>
  ${TPL.map((x, i) => { const prev = tasksOf(M, c.id).find(t => t.r === x[0]), d0 = addD(c.from, x[2]); return `<div class="tpl" data-tp="${i}"><input type="checkbox" data-tpk${have.indexOf(x[1]) < 0 ? " checked" : ""} aria-label="${E(x[1])}"><span>${rl(x[0])[1]} ${E(x[1])}${have.indexOf(x[1]) >= 0 ? ' <small class="ms-mu">(موجودة)</small>' : ""}</span><select data-tpa aria-label="المسؤول">${asOpts(c, prev ? prev.as : "")}</select><input type="date" data-tpd value="${E(d0 < today() ? today() : d0)}" aria-label="الموعد"></div>` }).join("")}
  ${foot(["tplsave"], "إضافة المهام المختارة")}`, "tpl", c.id);
}
async function tplSave() {
  if (BUSY) return; const c = M.C.get(g("mkm").dataset.mki); if (!c) return; const tm = Array.isArray(c.tm) ? c.tm.slice() : [], L = []; let miss = false;
  document.querySelectorAll("#mkm [data-tp]").forEach(r => { if (!r.querySelector("[data-tpk]").checked) return; const x = TPL[+r.dataset.tp], as = r.querySelector("[data-tpa]").value, du = r.querySelector("[data-tpd]").value; if (!as) { miss = true; return }
    const d = {c: c.id, t: x[1], r: x[0], as, st: "todo", by: {e: me(), n: myN()}, ts: Date.now()}; if (du) d.du = du; if (rl(x[0])[4]) d.rq = true; L.push(d); if (tm.indexOf(as) < 0) tm.push(as) });
  if (miss) return errM("اختر المسؤول لكل مهمة مختارة"); if (!L.length) return errM("لم تختر أي مهمة"); if (tm.length > 30) return errM("فريق الحملة حتى 30 شخصاً");
  BUSY = true; const ids = L.map(() => nid());
  try { const b = writeBatch(X.db); if (tm.length !== (c.tm || []).length) b.update(doc(X.db, "mkc", c.id), {tm, upd: Date.now()}); L.forEach((x, i) => b.set(tRef(ids[i]), x)); await withTimeout(b.commit());
    closeM(); toast(`✅ أُضيفت ${L.length} مهام ووصل إشعار لكل مسؤول`); pg(ids.map(i => "t:" + i)) } catch (e) { BUSY = false; errM(errTxt(e)) }
}
function returnForm(x) {
  modal(`<h3>↩ إعادة العمل للتعديل</h3><p class="sub" data-notr>${E(x.t)} · ${E(nameOf(x.as))}</p><label class="lb" for="mk-why">ما المطلوب تعديله؟ (يصل للمسؤول في إشعار)</label><textarea id="mk-why" rows="4" maxlength="300" placeholder="مثال: كبّر الشعار، وغيّر لون الخلفية للبيج"></textarea>${foot(["retsave", x.id], "إعادة للتعديل")}`, "ret", x.c); focusL("mk-why");
}
async function returnSave(id) {
  const v = String(g("mk-why").value || "").trim().slice(0, 300), x = M.T.get(id); if (!x) return; if (v.length < 2) return errM("اكتب المطلوب تعديله"); if (BUSY) return; BUSY = true;
  try { await withTimeout(x.dn ? tReset(x, "doing", ["dn", "ok"], {rt: stampMe({note: v}), rn: N(x.rn) + 1}) : updateDoc(tRef(id), {st: "doing", rt: stampMe({note: v}), rn: N(x.rn) + 1, upd: Date.now()})); closeM(); toast("أُعيد العمل للمسؤول مع ملاحظتك"); pg(["t:" + id]) } catch (e) { BUSY = false; errM(errTxt(e)) }
}
function resForm(x) { modal(`<h3>🔗 رابط أو ملاحظة التسليم</h3><p class="sub" data-notr>${E(x.t)}</p><label class="lb" for="mk-rs">رابط المجلد (درايف مثلاً) أو ملاحظة لمدير التسويق</label><textarea id="mk-rs" rows="3" maxlength="500">${E(x.rs || "")}</textarea>${foot(["trsave", x.id], "حفظ")}`, "trs", x.c); focusL("mk-rs") }
async function resSave(id) { const v = String(g("mk-rs").value || "").trim().slice(0, 500), x = M.T.get(id); if (!x) return; try { if (v) await withTimeout(updateDoc(tRef(id), {rs: v, upd: Date.now()})); else { const n = Object.assign({}, x); delete n.id; delete n.rs; n.upd = Date.now(); await withTimeout(setDoc(tRef(id), n)) } closeM(); toast("✅ حُفظت") } catch (e) { errM(errTxt(e)) } }
// اتفاق المؤثر + الآيبان
const loadIb = async id => { try { const s = await withTimeout(getDoc(doc(X.db, "mkdi", id)), 10000); return s.exists() ? s.data() : null } catch (e) { return null } };
async function dealForm(c, d) {
  const ib = d ? await loadIb(d.id) : null;
  modal(`<h3>${d ? (d.st === "no" ? "تصحيح الاتفاق وإعادة إرساله" : "تعديل الاتفاق") : "اتفاق جديد مع مؤثر"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>» · يُرسل لمدير التسويق للاعتماد، ثم للمالية للتحويل.</p>
  ${d && d.st === "no" && d.ap && d.ap.note ? `<div class="ms-ins"><div class="bad" data-notr>سبب الرفض: ${E(d.ap.note)}</div></div>` : ""}
  <div class="g2"><div><label class="lb" for="mk-dn">اسم المؤثر</label><input id="mk-dn" maxlength="60" value="${d ? E(d.n) : ""}"></div><div><label class="lb" for="mk-dp">المنصة</label><select id="mk-dp">${PF.map(x => `<option value="${x[0]}"${d && d.pf === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select></div>
  <div><label class="lb" for="mk-dh">الحساب (اختياري)</label><input id="mk-dh" maxlength="60" dir="ltr" value="${d ? E(d.h || "") : ""}" placeholder="@name"></div><div><label class="lb" for="mk-df">عدد المتابعين (اختياري)</label><input id="mk-df" inputmode="numeric" dir="ltr" value="${d && d.fl ? E(d.fl) : ""}"></div></div>
  <label class="lb" for="mk-dl">المطلوب منه</label><input id="mk-dl" maxlength="300" value="${d ? E(d.dl) : ""}" placeholder="مثال: 3 ستوريات + ريل واحد + زيارة فرع">
  <div class="g2"><div><label class="lb" for="mk-da">المبلغ المتفق عليه (ريال)</label><input id="mk-da" inputmode="decimal" dir="ltr" value="${d ? E(d.amt) : ""}"></div><div><label class="lb" for="mk-dd">تاريخ النشر (اختياري)</label><input id="mk-dd" type="date" value="${d ? E(d.dt || "") : ""}"></div></div>
  <label class="lb" for="mk-ib">الآيبان (IBAN)</label><input id="mk-ib" maxlength="42" dir="ltr" class="ms-ib0" autocomplete="off" value="${ib ? E(ibanFmt(ib.ib)) : ""}" placeholder="SA00 0000 0000 0000 0000 0000"><div class="ibh" id="mk-ibh" aria-live="polite"></div>
  <div class="g2"><div><label class="lb" for="mk-an">اسم صاحب الحساب كما في البنك</label><input id="mk-an" maxlength="80" value="${ib ? E(ib.an) : ""}"></div><div><label class="lb" for="mk-bn">البنك (اختياري)</label><input id="mk-bn" maxlength="40" value="${ib ? E(ib.bn || "") : ""}"></div></div>
  <p class="sub">بعد الحفظ يمكنك إرفاق العقد من صفحة الاتفاق.</p>${foot(["dsave", d ? d.id : ""], d ? (d.st === "no" ? "إعادة الإرسال للاعتماد" : "حفظ") : "إرسال للاعتماد")}`, "deal", c.id);
  ibHint(); focusL("mk-dn");
}
function ibHint() { const i = g("mk-ib"), h = g("mk-ibh"); if (!i || !h) return; const v = ibanNorm(i.value); if (!v) { h.className = "ibh"; h.textContent = ""; return }
  if (ibanOk(v)) { h.className = "ibh ok"; h.textContent = "✓ آيبان صحيح" + (v.slice(0, 2) === "SA" ? " (سعودي)" : "") } else { h.className = "ibh bad"; h.textContent = v.slice(0, 2) === "SA" && v.length < 24 ? "الآيبان السعودي 24 حرفاً (المكتوب " + v.length + ")" : "الآيبان غير صحيح، راجع الأرقام" } }
async function dealSave(did) {
  if (BUSY) return; const c = M.C.get(g("mkm").dataset.mki); if (!c) return; const old = did ? M.D.get(did) : null, clean = s => String(s || "").trim().replace(/[<>"'&\\]/g, "");
  const n = String(g("mk-dn").value || "").trim().slice(0, 60), pf = g("mk-dp").value, h = String(g("mk-dh").value || "").trim().slice(0, 60), fl = num(g("mk-df").value), dl = String(g("mk-dl").value || "").trim().slice(0, 300), amt = num(g("mk-da").value), dt = g("mk-dd").value;
  const ib = ibanNorm(g("mk-ib").value), an = clean(g("mk-an").value).slice(0, 80), bn = clean(g("mk-bn").value).slice(0, 40);
  if (n.length < 2) return errM("اكتب اسم المؤثر"); if (!dl) return errM("اكتب المطلوب من المؤثر"); if (isNaN(amt) || amt <= 0) return errM("اكتب المبلغ"); if (isNaN(fl)) return errM("عدد المتابعين رقم غير صحيح");
  if (!ibanOk(ib)) return errM("الآيبان غير صحيح"); if (an.length < 2) return errM("اكتب اسم صاحب الحساب");
  const d = {c: c.id, n, pf, dl, amt, st: "pend", by: old ? old.by : {e: me(), n: myN()}, ts: old ? old.ts : Date.now(), ib: 1}; if (h) d.h = h; if (fl > 0) d.fl = fl; if (dt) d.dt = dt; if (old) { d.upd = Date.now(); if (old.cn) d.cn = old.cn; if (old.an) d.an = old.an }
  const ibd = {ib, an, ts: Date.now()}; if (bn) ibd.bn = bn; BUSY = true; const id = did || nid();
  try { const b = writeBatch(X.db); b.set(doc(X.db, "mkdi", id), ibd); b.set(doc(X.db, "mkd", id), d); await withTimeout(b.commit()); IBC.delete(id);
    closeM(); toast(old && old.st !== "no" ? "✅ حُفظ الاتفاق" : "✅ أُرسل الاتفاق لمدير التسويق للاعتماد"); pg(["d:" + id]); if (!old) setTimeout(() => openItem("d:" + id), 400) } catch (e) { BUSY = false; errM(errTxt(e)) }
}
async function dealOk(id) { const d = M.D.get(id); if (!d || BUSY) return; if (!confirm(`اعتماد الاتفاق مع ${d.n} بمبلغ ${money(d.amt)} ريال؟ سيصل للمالية للتحويل.`)) return; BUSY = true;
  try { await withTimeout(updateDoc(doc(X.db, "mkd", id), {st: "ok", ap: stampMe(), upd: Date.now()})); BUSY = false; toast("✅ اعتُمد ووصل إشعار للمالية"); pg(["d:" + id]) } catch (e) { BUSY = false; toast(errTxt(e), "er") } }
function reasonForm(id, kind) { const d = M.D.get(id); if (!d) return; modal(`<h3>${kind === "no" ? "رفض الاتفاق" : "إلغاء الاتفاق المعتمد"}</h3><p class="sub"><bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</p><label class="lb" for="mk-why">السبب (يصل لمن سجّله)</label><textarea id="mk-why" rows="3" maxlength="300"></textarea>${foot(["whysave", id, kind], kind === "no" ? "رفض" : "إلغاء الاتفاق")}`, "why", d.c); focusL("mk-why") }
async function whySave(id, kind) { const v = String(g("mk-why").value || "").trim().slice(0, 300); if (v.length < 2) return errM("اكتب السبب"); if (BUSY) return; BUSY = true;
  try { await withTimeout(updateDoc(doc(X.db, "mkd", id), {st: kind, ap: stampMe({note: v}), upd: Date.now()})); closeM(); toast(kind === "no" ? "تم الرفض ووصل السبب لمن سجّله" : "أُلغي الاتفاق"); pg(["d:" + id]) } catch (e) { BUSY = false; errM(errTxt(e)) } }
async function payForm(id) {
  const d = M.D.get(id); if (!d) return; modal(`<h3>💸 تحويل لمؤثر</h3><p class="sub">جاري تحميل بيانات التحويل…</p>`, "pay", id);
  const ib = await loadIb(id); if (!g("mkm") || g("mkm").dataset.mkv !== "pay") return; const c = M.C.get(d.c);
  modal(`<h3>💸 تحويل لمؤثر</h3><p class="sub">حملة «<bdi data-notr>${E(c ? c.n : "")}</bdi>» · اعتمده <bdi data-notr>${E(d.ap && d.ap.n || "")}</bdi></p>
  <div class="pay"><div><span>المؤثر</span><b data-notr>${E(d.n)}</b></div><div><span>المبلغ</span><b>${money(d.amt)} ريال</b></div>
  <div><span>الآيبان</span><span class="ibr"><b class="ms-ib0">${ib ? E(ibanFmt(ib.ib)) : "—"}</b>${ib ? `<button type="button" class="ms-b sm" data-mkq="ibcp" data-mkv="${E(ib.ib)}">نسخ</button>` : ""}</span></div>
  <div><span>صاحب الحساب</span><b data-notr>${ib ? E(ib.an) : "—"}</b></div>${ib && ib.bn ? `<div><span>البنك</span><b data-notr>${E(ib.bn)}</b></div>` : ""}<div><span>المطلوب منه</span><span data-notr>${E(d.dl)}</span></div></div>
  ${ib && !ibanOk(ib.ib) ? `<div class="ms-ins"><div class="bad">تنبيه: رقم الآيبان لا يجتاز فحص الصحة. تأكّد منه قبل التحويل.</div></div>` : ""}
  <label class="lb" for="mk-ref">رقم مرجع التحويل من البنك</label><input id="mk-ref" maxlength="60" dir="ltr"><p class="sub">بعد التسجيل يمكنك إرفاق إيصال التحويل من صفحة الاتفاق.</p>${foot(["paysave", id], "✔ تم التحويل")}`, "pay", id); focusL("mk-ref");
}
async function paySave(id) { const ref = String(g("mk-ref").value || "").trim().slice(0, 60); if (ref.length < 2) return errM("اكتب رقم مرجع التحويل"); if (BUSY) return; BUSY = true;
  try { await withTimeout(updateDoc(doc(X.db, "mkd", id), {st: "paid", pd: stampMe({ref}), upd: Date.now()})); closeM(); toast("✅ سُجّل التحويل. أرفق الإيصال من صفحة الاتفاق"); pg(["d:" + id]); openItem("d:" + id) } catch (e) { BUSY = false; errM(errTxt(e)) } }
async function ibView(id) { if (IBC.has(id)) { IBC.delete(id); render(); return } const ib = await loadIb(id); if (!ib) { toast("لا يمكنك عرض بيانات التحويل", "er"); return } IBC.set(id, ib); render() }
async function dealDel(id) { const d = M.D.get(id); if (!d || !confirm(`حذف الاتفاق مع ${d.n}؟`)) return; if (DR.id === id) closeDrawer(true);
  try { await purge("mkd", id); const b = writeBatch(X.db); b.delete(doc(X.db, "mkdi", id)); b.delete(doc(X.db, "mkd", id)); await withTimeout(b.commit()); toast("حُذف الاتفاق") } catch (e) { toast(errTxt(e), "er") } }
function dresForm(d) { const r = d.rs || {}; modal(`<h3>📊 نتائج المؤثر</h3><p class="sub"><bdi data-notr>${E(d.n)}</bdi> · ${money(d.amt)} ريال</p>
  <div class="g3"><div><label class="lb" for="mk-rv">المشاهدات</label><input id="mk-rv" inputmode="numeric" dir="ltr" value="${r.v ? E(r.v) : ""}"></div><div><label class="lb" for="mk-re">التفاعلات</label><input id="mk-re" inputmode="numeric" dir="ltr" value="${r.e ? E(r.e) : ""}"></div><div><label class="lb" for="mk-rsl">مبيعات منسوبة (ريال)</label><input id="mk-rsl" inputmode="decimal" dir="ltr" value="${r.sl ? E(r.sl) : ""}"></div></div>
  <label class="lb" for="mk-rn">ملاحظة (اختياري)</label><input id="mk-rn" maxlength="300" value="${E(r.note || "")}">${foot(["drsave", d.id], "حفظ")}`, "dres", d.c) }
async function dresSave(id) { const v = num(g("mk-rv").value), e = num(g("mk-re").value), sl = num(g("mk-rsl").value), note = String(g("mk-rn").value || "").trim().slice(0, 300); if ([v, e, sl].some(isNaN)) return errM("أرقام غير صحيحة");
  const rs = {}; if (v) rs.v = v; if (e) rs.e = e; if (sl) rs.sl = sl; if (note) rs.note = note; try { await withTimeout(updateDoc(doc(X.db, "mkd", id), {rs, upd: Date.now()})); closeM(); toast("✅ حُفظت النتائج") } catch (er) { errM(errTxt(er)) } }
// المصروفات والنتائج
function exForm(c, x) { modal(`<h3>${x ? "تعديل مصروف" : "مصروف جديد"}</h3><p class="sub">حملة «<bdi data-notr>${E(c.n)}</bdi>»</p>
  <div class="g3"><div><label class="lb" for="mk-xk">البند</label><select id="mk-xk">${XK.filter(k => k[0] !== "inf").map(k => `<option value="${k[0]}"${x && x.k === k[0] ? " selected" : ""}>${k[1]}</option>`).join("")}</select></div><div><label class="lb" for="mk-xa">المبلغ (ريال)</label><input id="mk-xa" inputmode="decimal" dir="ltr" value="${x ? E(x.a) : ""}"></div><div><label class="lb" for="mk-xd">التاريخ</label><input id="mk-xd" type="date" value="${E(x ? x.dt : today())}"></div></div>
  <label class="lb" for="mk-xn">البيان</label><input id="mk-xn" maxlength="200" value="${x ? E(x.nt || "") : ""}" placeholder="مثال: إعلان ممول على إنستغرام أسبوع">${foot(["xsave", x ? x.id : ""], "حفظ")}`, "ex", c.id); focusL("mk-xa") }
async function exSave(xid) { if (BUSY) return; const c = M.C.get(g("mkm").dataset.mki); if (!c) return; const old = xid ? M.X.get(xid) : null, a = num(g("mk-xa").value), dt = g("mk-xd").value, nt = String(g("mk-xn").value || "").trim().slice(0, 200);
  if (isNaN(a) || a <= 0) return errM("اكتب المبلغ"); if (!dt) return errM("اختر التاريخ"); const d = {c: c.id, k: g("mk-xk").value, a, dt, by: old ? old.by : {e: me(), n: myN()}, ts: old ? old.ts : Date.now()}; if (nt) d.nt = nt; if (old) d.upd = Date.now(); BUSY = true;
  try { await withTimeout(setDoc(doc(X.db, "mkx", xid || nid()), d)); closeM(); toast("✅ حُفظ المصروف") } catch (e) { BUSY = false; errM(errTxt(e)) } }
function kpForm(c) { modal(`<h3>📈 النتائج الفعلية</h3><p class="sub">اكتب ما تحقق حتى الآن لكل هدف (من تقارير المنصات والسيستم).</p>
  ${kpOf(c).map((k, i) => `<label class="lb" for="mk-kv${i}">${E(kpName(k))} <small class="ms-mu">(المستهدف ${money(k.t)})</small></label><input id="mk-kv${i}" inputmode="decimal" dir="ltr" value="${k.v != null ? E(k.v) : ""}">`).join("")}${foot(["kpsave"], "حفظ")}`, "kp", c.id) }
async function kpSave() { const c = M.C.get(g("mkm").dataset.mki); if (!c) return; let bad = false; const kp = kpOf(c).map((k, i) => { const o = {k: k.k, t: k.t}; if (k.l != null) o.l = k.l; const raw = g("mk-kv" + i).value, v = num(raw); if (isNaN(v)) bad = true; else if (String(raw).trim() !== "") o.v = v; return o });
  if (bad) return errM("أرقام غير صحيحة"); try { await withTimeout(updateDoc(doc(X.db, "mkc", c.id), {kp, upd: Date.now()})); closeM(); toast("✅ حُفظت النتائج") } catch (e) { errM(errTxt(e)) } }
async function campSt(st) { const c = M.C.get(S.c); if (!c || BUSY) return; if (st === "x" && !confirm("إلغاء الحملة؟ تبقى بياناتها للرجوع إليها.")) return; if (st === "done" && !confirm("إنهاء الحملة؟ سجّل النتائج الفعلية أولاً لتظهر في التقرير.")) return;
  BUSY = true; try { await withTimeout(updateDoc(doc(X.db, "mkc", c.id), {st, upd: Date.now()})); BUSY = false; toast(st === "live" ? "▶ بدأت الحملة" : st === "done" ? "🏁 انتهت الحملة" : "أُلغيت الحملة") } catch (e) { BUSY = false; toast(errTxt(e), "er") } }
async function campDel() {
  const c = M.C.get(S.c); if (!c || BUSY) return; const Lt = tasksOf(M, c.id), Ld = dealsOf(M, c.id);
  if (Ld.some(d => d.st === "ok" || d.st === "paid")) { toast("لا يمكن حذف حملة فيها اتفاقات معتمدة. ألغِها بدلاً من الحذف", "er"); return } if (!confirm(`حذف الحملة «${c.n}» نهائياً${Lt.length ? " مع " + Lt.length + " مهام" : ""}؟ لا يمكن التراجع.`)) return;
  BUSY = true; toast("جاري الحذف…");
  try { for (const x of Lt) if (N(x.cn) || N(x.an)) await purge("mkt", x.id); for (const d of Ld) if (N(d.cn) || N(d.an)) await purge("mkd", d.id);
    const b = writeBatch(X.db); Lt.forEach(x => b.delete(tRef(x.id))); exOf(M, c.id).forEach(x => b.delete(doc(X.db, "mkx", x.id))); Ld.forEach(d => { b.delete(doc(X.db, "mkdi", d.id)); b.delete(doc(X.db, "mkd", d.id)) }); b.delete(doc(X.db, "mkc", c.id));
    await withTimeout(b.commit()); BUSY = false; toast("حُذفت الحملة"); go({pg: "camps", c: ""}) } catch (e) { BUSY = false; toast(errTxt(e), "er") }
}
function csv(c) { const s = spend(M, c.id), q = v => { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"' }, R = [["التاريخ", "البند", "البيان", "المبلغ", "سجّله"]];
  dealsOf(M, c.id).filter(d => d.st === "ok" || d.st === "paid").forEach(d => R.push([d.dt || "", "المؤثرون", "مؤثر: " + d.n + " · " + (DST[d.st] || ""), N(d.amt), d.by && d.by.n])); exOf(M, c.id).forEach(x => R.push([x.dt, lab(XK, x.k), x.nt || "", N(x.a), x.by && x.by.n])); R.push(["", "", "الإجمالي", s.tot, ""]); R.push(["", "", "الميزانية", N(c.bud), ""]);
  const b = new Blob(["﻿" + R.map(r => r.map(q).join(",")).join("\r\n")], {type: "text/csv;charset=utf-8"}), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "tasooma-campaign-" + c.from + ".csv"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500) }
function printRep(c) { let p = g("mkpr"); if (!p) { p = document.createElement("div"); p.id = "mkpr"; document.body.appendChild(p) } p.innerHTML = reportHtml(app(), c);
  document.body.classList.add("mkpr"); const done = () => { document.body.classList.remove("mkpr"); window.removeEventListener("afterprint", done) }; window.addEventListener("afterprint", done); setTimeout(() => { try { window.print() } catch (e) {} setTimeout(done, 1500) }, 60) }

// ---------- الأحداث ----------
const inMk = el => el && el.closest && el.closest("#mkp,#mkm,#msd");
function onClick(e) {
  if (!X) return; const ck = e.target.closest && e.target.closest("[data-mkq]"); if (!ck || !inMk(ck)) return;
  const a = ck.dataset.mkq, i = ck.dataset.mki, v = ck.dataset.mkv, c = M.C.get(S.c), ro = role().ro;
  // تنقّل
  if (a === "pg") { closeDrawer(true); return go({pg: v, c: v === "camps" ? "" : S.c, q: v === "camps" ? S.q : ""}) }
  if (a === "open") { const ok = M.C.has(i); if (ok) { S.who = ""; S.wr = ""; S.cm = ""; go({pg: "c", c: i, v: ck.dataset.mks || S.v}) } return }
  if (a === "v") return go({v}); if (a === "f") return go({f: ck.dataset.mkf}); if (a === "lay") return go({lay: v});
  if (a === "who") return go({who: i || ""}); if (a === "tm") return go({tm: S.tm === i ? "" : i});
  if (a === "cal") { const cur = /^\d{4}-\d{2}$/.test(S.cm) ? S.cm : today().slice(0, 7); return go({cm: v === "0" ? today().slice(0, 7) : ymAdd(cur, +v)}) }
  if (a === "topen") return openDrawer("t", i); if (a === "dopen") return openDrawer("d", i); if (a === "dx") return closeDrawer(); if (a === "dtab") { DR.tab = v; return drawerPaint() }
  if (a === "mx") return closeM(); if (a === "atopen") return atOpen(i);
  if (a === "ibcp") { try { navigator.clipboard.writeText(v).then(() => toast("نُسخ الآيبان"), () => toast(v)) } catch (er) { toast(v) } return }
  if (a === "ibv") return ibView(i); if (a === "prn" && c) return printRep(c); if (a === "csv" && c) return csv(c);
  if (ro) return;// المتابع: عرض فقط
  if (a === "cmsend") return cmSend(); if (a === "cmdel") return cmDel(i); if (a === "atdel") return atDel(i);
  if (a === "new") return campForm(null); if (a === "csave") return campSave(); if (a === "cedit" && c) return campForm(c); if (a === "cst") return campSt(ck.dataset.mks); if (a === "cdel") return campDel();
  if (a === "kadd") { const k = g("mk-kps"); if (k && k.children.length < 8) k.insertAdjacentHTML("beforeend", kpRow({k: "views", t: ""})); return } if (a === "krm") { const r = ck.closest("[data-kr]"); if (r) r.remove(); return }
  if (a === "tnew" && c) return taskForm(c, null, {st: ck.dataset.mks || "", du: v || ""}); if (a === "tedit") { const x = M.T.get(i); if (x && M.C.get(x.c)) taskForm(M.C.get(x.c), x); return }
  if (a === "tsave") return taskSave(i); if (a === "tdel") return taskDel(i); if (a === "tpl" && c) return tplForm(c); if (a === "tplsave") return tplSave();
  if (a === "tgo") return tgo(i, ck.dataset.mks); if (a === "retsave") return returnSave(i); if (a === "trs") { const x = M.T.get(i); if (x) resForm(x); return } if (a === "trsave") return resSave(i);
  if (a === "dnew" && c) return dealForm(c, null); if (a === "dedit") { const d = M.D.get(i); if (d && M.C.get(d.c)) dealForm(M.C.get(d.c), d); return } if (a === "dsave") return dealSave(i);
  if (a === "dok") return dealOk(i); if (a === "dno") return reasonForm(i, "no"); if (a === "dxl") return reasonForm(i, "x"); if (a === "whysave") return whySave(i, ck.dataset.mkk); if (a === "ddel") return dealDel(i);
  if (a === "pay") return payForm(i); if (a === "paysave") return paySave(i); if (a === "dres") { const d = M.D.get(i); if (d) dresForm(d); return } if (a === "drsave") return dresSave(i);
  if (a === "xnew" && c) return exForm(c, null); if (a === "xedit") { const x = M.X.get(i); if (x && M.C.get(x.c)) exForm(M.C.get(x.c), x); return } if (a === "xsave") return exSave(i);
  if (a === "xdel") { if (confirm("حذف المصروف؟")) deleteDoc(doc(X.db, "mkx", i)).then(() => toast("حُذف المصروف")).catch(er => toast(errTxt(er), "er")); return }
  if (a === "kpe" && c) return kpForm(c); if (a === "kpsave") return kpSave();
}
function onChange(e) {
  if (!X) return; const t = e.target; if (!t.matches || !inMk(t)) return;
  if (t.matches("[data-mkcl]")) return taskCl(t.dataset.mkcl, +t.dataset.mkk, t.checked);
  if (t.matches('[data-mkc="wr"]')) return go({wr: t.value});
  if (t.id === "msd-file") { const L = Array.from(t.files || []); t.value = ""; if (!role().ro) addFiles(L); return }
  if (t.matches("#mkm [data-kk]")) { const r = t.closest("[data-kr]"), l = r && r.querySelector("[data-kl]"); if (l) l.style.display = t.value === "oth" ? "" : "none"; return }
  if (t.id === "mk-tr" && !g("mkm").dataset.rqt) { const q = g("mk-rq"); if (q) q.checked = !!rl(t.value)[4]; return }// مهمة جديدة: الاعتماد حسب مسار العمل
  if (t.id === "mk-rq") g("mkm").dataset.rqt = "1";
}
function onInput(e) {
  if (!X) return; const t = e.target; if (!inMk(t)) return;
  if (t.id === "ms-q") { S.q = t.value; return schedule() }
  if (t.id === "msd-t") { t.style.height = ""; t.style.height = Math.min(140, t.scrollHeight) + "px"; return }
  if (t.id === "mk-ib") return ibHint();
  if (t.id === "mk-pq") { const q = String(t.value || "").trim(); document.querySelectorAll("#mk-ppl [data-pn]").forEach(l => { l.style.display = !q || l.dataset.pn.indexOf(q) >= 0 ? "" : "none" }) }
}
function onKey(e) {
  if (!X) return; const t = e.target;
  if (e.key === "Escape") { const m = g("mkm"), z = g("zbx"); if (z && z.className) return; if (m && m.classList.contains("on")) return; if (DR.k) { e.preventDefault(); closeDrawer() } return }
  if (!inMk(t)) return;
  if (t.id === "msd-t" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return cmSend() }
  if ((e.key === "Enter" || e.key === " ") && t.matches && t.matches('[role="button"][data-mkq],label.add')) { e.preventDefault(); t.click() }
}
// السحب والإفلات بين أعمدة اللوحة
function onDrag(e) {
  if (!X || !ROOT) return; const t = e.target && e.target.closest ? e.target : null; if (!t) return;
  if (e.type === "dragstart") { const c = t.closest("[data-drag]"); if (!c || !ROOT.contains(c)) return; DRAG = c.dataset.drag; c.classList.add("drag"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", DRAG) } catch (er) {} ROOT.classList.add("dragging"); return }
  if (e.type === "dragend") { DRAG = ""; ROOT.classList.remove("dragging"); ROOT.querySelectorAll(".drag,.over").forEach(n => n.classList.remove("drag", "over")); return }
  if (!DRAG) return; const col = t.closest("[data-drop]"); if (!col || !ROOT.contains(col)) return;
  if (e.type === "dragover") { e.preventDefault(); try { e.dataTransfer.dropEffect = "move" } catch (er) {} col.classList.add("over"); return }
  if (e.type === "dragleave") { if (!col.contains(e.relatedTarget)) col.classList.remove("over"); return }
  if (e.type === "drop") { e.preventDefault(); const id = DRAG; DRAG = ""; col.classList.remove("over"); ROOT.classList.remove("dragging"); moveTask(id, col.dataset.drop) }
}
// للاختبار والتشخيص فقط
export const mkState = () => ({S: Object.assign({}, S), DR: {k: DR.k, id: DR.id, cm: DR.cm.length, at: DR.at.length}, n: {C: M.C.size, T: M.T.size, D: M.D.size, X: M.X.size}});
export const mkMove = (id, st) => moveTask(id, st);
