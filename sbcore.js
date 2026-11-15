// sbcore.js — قلب الاتصال بـ Supabase بنفس أوامر Firestore اللي المنصة بتستخدمها (النقل لـ Supabase، نوفمبر 2026)
// الملفات التانية (الطلبات والشات والهدايا...) بتنادي collection/doc/query/where/onSnapshot/setDoc/updateDoc/writeBatch...
// زي ما هي، والملف ده بيحوّلها لـ Supabase: القراءة بـ q() والكتابة بـ w() (supabase/001 و 002)، واللايف بـ Realtime.
// مكتوب من غير أي مكتبة علشان يتجرب على الكمبيوتر (client = عميل supabase-js أو بديل في التجربة).
// ⚠️ حقول متغيّرة: increment / arrayUnion / deleteField بتتبعت كـ {__op:...} والسيرفر بيطبّقها.

export const increment = n => ({__op: "inc", v: n});
export const arrayUnion = (...v) => ({__op: "union", v});
export const deleteField = () => ({__op: "del"});

const AID = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const autoId = () => { let s = ""; const r = crypto.getRandomValues(new Uint8Array(20)); for (const x of r) s += AID[x % AID.length]; return s };
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e };

// ---------- المراجع ----------
// db = {c: العميل}. المرجع: {type:"doc"|"collection", db, path, id}
function mk(type, db, path) { const s = path.split("/"); return {type, db, path, id: s[s.length - 1], firestore: db} }
export function collection(parent, ...parts) {
  const db = parent.db || parent, pre = parent.path ? parent.path + "/" : "";
  const path = pre + parts.map(String).join("/");
  if (path.split("/").length % 2 !== 1) throw err("invalid-argument", "collection path: " + path);
  return mk("collection", db, path);
}
export function doc(parent, ...parts) {
  const db = parent.db || parent, pre = parent.path ? parent.path + "/" : "";
  if (parent.type === "collection" && !parts.length) parts = [autoId()];
  const path = pre + parts.map(String).join("/");
  if (path.split("/").length % 2 !== 0) throw err("invalid-argument", "doc path: " + path);
  const r = mk("doc", db, path); r.parent = mk("collection", db, path.split("/").slice(0, -1).join("/")); return r;
}
export const where = (f, op, v) => ({k: "where", f: String(f), op, v});
export const orderBy = (f, dir) => ({k: "order", f: String(f), desc: dir === "desc"});
export const limit = n => ({k: "limit", n});
export function query(ref, ...cs) {
  const q = {type: "query", db: ref.db, path: ref.path, w: [...(ref.w || [])], order: ref.order || null, desc: !!ref.desc, lim: ref.lim == null ? null : ref.lim};
  for (const c of cs) { if (c.k === "where") q.w.push([c.f, c.op, clone(c.v)]); else if (c.k === "order") { q.order = c.f; q.desc = c.desc } else if (c.k === "limit") q.lim = c.n }
  return q;
}

// ---------- اللقطات (Snapshots) ----------
class DocSnap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data === undefined ? null : data; this.metadata = {fromCache: false, hasPendingWrites: false} }
  exists() { return this._d != null }
  data() { return this._d == null ? undefined : clone(this._d) }
  get(f) { return getPath(this._d, f) }
}
class QuerySnap {
  constructor(q, docs, changes) { this.query = q; this.docs = docs; this.size = docs.length; this.empty = !docs.length; this._ch = changes; this.metadata = {fromCache: false, hasPendingWrites: false} }
  forEach(f) { this.docs.forEach(f) }
  docChanges() { return this._ch }
}
const getPath = (o, f) => String(f).split(".").reduce((a, k) => a != null && typeof a === "object" ? a[k] : undefined, o);
const docRef = (db, path) => { const s = path.split("/"); return doc(db, ...s) };

// ---------- الأخطاء ----------
export function mapErr(e) {
  if (!e) return err("internal");
  if (e.code === "permission-denied" || e.code === "not-found") return e;
  const m = String(e.message || e.details || e.hint || ""), c = String(e.code || "");
  if (c === "42501" || /permission-denied|permission denied|row-level security/i.test(m)) return err("permission-denied", m);
  if (c === "P0002" || /not-found/.test(m)) return err("not-found", m);
  if (/Failed to fetch|NetworkError|network|fetch failed|TypeError/i.test(m) || e.name === "TypeError") return err("unavailable", m);
  return err("internal", m);
}

// ---------- القراءة ----------
const rowSnap = (db, row) => new DocSnap(docRef(db, row.path), row.data);
async function runQ(q) {
  const {data, error} = await q.db.c.rpc("q", {p_col: q.path, p_where: q.w || [], p_order: q.order || null, p_desc: !!q.desc, p_limit: q.lim == null ? null : q.lim});
  if (error) throw mapErr(error);
  return (data || []).map(r => rowSnap(q.db, r));
}
export async function getDoc(ref) {
  const {data, error} = await ref.db.c.from("docs").select("path,data").eq("path", ref.path).maybeSingle();
  if (error) throw mapErr(error);
  return new DocSnap(ref, data ? data.data : null);
}
export async function getDocs(ref) {
  const q = ref.type === "query" ? ref : query(ref);
  const docs = await runQ(q);
  return new QuerySnap(q, docs, docs.map((d, i) => ({type: "added", doc: d, oldIndex: -1, newIndex: i})));
}

// ---------- الكتابة ----------
const plain = d => clone(d || {});
async function W(db, ops) {
  // السند بعد الهدية (القاعدة بتتأكد من الهدية اللي اتكتبت في نفس المرة، زي getAfter في Firestore)
  ops = ops.map((o, i) => ({o, i})).sort((a, b) => (/^giftimg\//.test(a.o.path) - /^giftimg\//.test(b.o.path)) || a.i - b.i).map(x => x.o);
  const {error} = await db.c.rpc("w", {ops});
  if (error) throw mapErr(error);
}
export const setDoc = (ref, data, opts) => W(ref.db, [{t: opts && opts.merge ? "merge" : "set", path: ref.path, data: plain(data)}]);
export const updateDoc = (ref, data) => W(ref.db, [{t: "update", path: ref.path, data: plain(data)}]);
export const deleteDoc = ref => W(ref.db, [{t: "delete", path: ref.path}]);
export async function addDoc(col, data) { const r = doc(col); await setDoc(r, data); return r }
export function writeBatch(db) {
  const ops = [], b = {
    set(r, d, o) { ops.push({t: o && o.merge ? "merge" : "set", path: r.path, data: plain(d)}); return b },
    update(r, d) { ops.push({t: "update", path: r.path, data: plain(d)}); return b },
    delete(r) { ops.push({t: "delete", path: r.path}); return b },
    commit() { return ops.length ? W(db, ops) : Promise.resolve() }
  };
  return b;
}

// ---------- مطابقة الفلاتر عند الصفحة (للتحديثات اللايف) ----------
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cmp = (a, b) => typeof a === typeof b && (typeof a === "number" || typeof a === "string") ? (a < b ? -1 : a > b ? 1 : 0) : null;
export function matches(q, d) {
  for (const [f, op, v] of q.w || []) {
    const x = getPath(d, f);
    switch (op) {
      case "==": if (!eq(x, v)) return false; break;
      case "!=": if (x === undefined || eq(x, v)) return false; break;
      case "<": { const c = cmp(x, v); if (c === null || !(c < 0)) return false; break }
      case "<=": { const c = cmp(x, v); if (c === null || !(c <= 0)) return false; break }
      case ">": { const c = cmp(x, v); if (c === null || !(c > 0)) return false; break }
      case ">=": { const c = cmp(x, v); if (c === null || !(c >= 0)) return false; break }
      case "in": if (!Array.isArray(v) || !v.some(y => eq(x, y))) return false; break;
      case "array-contains": if (!Array.isArray(x) || !x.some(y => eq(y, v))) return false; break;
      default: return false;
    }
  }
  return true;
}
function sortDocs(q, list) {
  if (!q.order) return list;
  const s = q.desc ? -1 : 1;
  return list.sort((a, b) => { const x = getPath(a._d, q.order), y = getPath(b._d, q.order);
    if (x === undefined && y === undefined) return 0; if (x === undefined) return 1; if (y === undefined) return -1;
    const c = cmp(x, y); return c === null ? 0 : c * s });
}
function changes(prev, next) {
  const out = [], pi = new Map(prev.map((d, i) => [d.ref.path, i])), ni = new Map(next.map((d, i) => [d.ref.path, i]));
  prev.forEach((d, i) => { if (!ni.has(d.ref.path)) out.push({type: "removed", doc: d, oldIndex: i, newIndex: -1}) });
  next.forEach((d, i) => { const o = pi.get(d.ref.path);
    if (o === undefined) out.push({type: "added", doc: d, oldIndex: -1, newIndex: i});
    else if (!eq(prev[o]._d, d._d) || o !== i) out.push({type: "modified", doc: d, oldIndex: o, newIndex: i}) });
  return out;
}

// ---------- اللايف (onSnapshot) ----------
// كل سماع = قناة Realtime على جدول docs بفلتر (col= المجموعة، أو path= المستند)، والـ RLS بيمنع اللي مش مسموحله يشوفه.
// بنسمع الأول وبعدين نقرا، وأي تغيير بيوصل قبل القراءة بيتطبّق بعدها. لو الاتصال اتقطع ورجع: بنقرا تاني (علشان اللي فات).
// ⚡ (15 نوفمبر 2026، محمد: "التحديث مش لحظي، الناس بتعمل ريفرش علشان الطلبات تظهر") — "المحطة" (hub):
//  • قبل كده كل سماع كان ليه قناة لوحده (30+ قناة في اللوحة)، ولو الخط وقع (الشاشة اتقفلت، النت ضعيف، رجع من برنامج تاني)
//    القناة كانت بتموت ومحدش بيلاحظ ← الطلبات الجديدة ماتوصلش غير بريفرش.
//  • دلوقتي: قناة واحدة لكل صفحة فيها كل المجموعات اللي الصفحة بتسمعها (col=in.(...))، وبنراقبها:
//    وقعت ← بنعمل واحدة جديدة لوحدنا (بعد 1، 2، 5، 10... ثانية). رجعت ← بنجيب اللي فات.
//  • شبكة أمان: كل 30 ثانية (و8 ثواني لو الخط واقع) بنسأل "إيه اللي اتغيّر من آخر مرة؟" (updated_at) — صفوف قليلة بس.
//    يعني حتى لو اللايف وقع خالص، أقصى تأخير 8 ثواني من غير ريفرش.
//  • الصفحة رجعت قدام المستخدم / النت رجع: بنسأل على طول، ولو كانت في الخلفية أكتر من 5 دقايق بنقرا كل حاجة من جديد.
let SEQ = 0;
const HUBS = new Map();
const BACK = [1000, 2000, 5000, 10000, 20000, 30000];
const isVis = () => typeof document === "undefined" || !document.hidden;
const qv = v => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const msOf = t => { const n = Date.parse(t); return isNaN(n) ? 0 : n };
function hubOf(c) {
  let h = HUBS.get(c); if (h) return h;
  h = {c, subs: new Set(), live: null, pend: null, dirty: false, downAt: 0, tries: 0, rt: null, kt: null, gone: null, cur: null, polling: false, np: 0, hidAt: 0, discAt: 0, seen: new Map()};
  HUBS.set(c, h);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.hidden) { h.hidAt = Date.now(); return } const away = h.hidAt ? Date.now() - h.hidAt : 0; h.hidAt = 0; wake(h, away) });
    addEventListener("online", () => wake(h, 0));
    addEventListener("pageshow", e => { if (e.persisted) wake(h, 6e5) });
    setInterval(() => tick(h), 4000);
  }
  return h;
}
function hubFilters(h) {
  const cols = new Set(), paths = new Set();
  h.subs.forEach(s => s.isDoc ? paths.add(s.path) : cols.add(s.col));
  const out = [], add = (f, arr) => { arr.sort(); for (let i = 0; i < arr.length; i += 90) { const p = arr.slice(i, i + 90); out.push(p.length === 1 ? `${f}=eq.${p[0]}` : `${f}=in.(${p.join(",")})`) } };
  add("col", [...cols]); add("path", [...paths]);
  return out;
}
function hubDispatch(h, ev, fromPoll) {
  const n = ev.new && ev.new.path ? ev.new : null, o = ev.old && ev.old.path ? ev.old : null, path = (n || o || {}).path;
  if (!path) return;
  if (!fromPoll && n && n.updated_at) { if (h.seen.size > 3000) h.seen.clear(); h.seen.set(path, msOf(n.updated_at)) }
  const col = (n && n.col) || (o && o.col) || path.slice(0, path.lastIndexOf("/"));
  const bad = ev.errors && ev.errors.length;// الرسالة كبيرة (صورة) ووصلت من غير بيانات: نقرا من جديد بدل ما نفتكرها اتمسحت
  h.subs.forEach(s => { if (s.isDoc ? s.path === path : s.col === col) { if (bad) s.reload(); else s.onEv(ev) } });
}
function hubDrop(h, ch) { try { if (ch) h.c.removeChannel(ch) } catch (e) {} }
function hubRetry(h) {
  if (h.rt || !h.subs.size) return;
  const d = BACK[Math.min(h.tries, BACK.length - 1)]; h.tries++;
  h.rt = setTimeout(() => { h.rt = null; hubConnect(h) }, d);
}
async function hubConnect(h) {
  clearTimeout(h.kt); h.kt = null;
  if (!h.subs.size) return;
  if (h.pend) { h.dirty = true; return }
  const fs = hubFilters(h), key = fs.join("|");
  if (h.live && h.live._k === key) return;
  const c = h.c;
  try { const {data} = await c.auth.getSession(); const t = data && data.session && data.session.access_token; if (t && c.realtime && c.realtime.setAuth) c.realtime.setAuth(t) } catch (e) {}
  if (h.pend || (h.live && h.live._k === key) || !h.subs.size) return;
  let me;
  try {
    me = c.channel("tzl" + (++SEQ) + "_" + Math.random().toString(36).slice(2, 7)); me._k = key;
    fs.forEach(f => me.on("postgres_changes", {event: "*", schema: "public", table: "docs", filter: f}, ev => { if (h.live === me || h.pend === me) hubDispatch(h, ev) }));
    h.pend = me;
    me.subscribe(st => {
      if (st === "SUBSCRIBED") {
        if (h.pend === me) {
          const old = h.live, down = h.downAt ? Date.now() - h.downAt : 0;
          h.live = me; h.pend = null; h.tries = 0; h.downAt = 0; h.discAt = 0;
          if (old) hubDrop(h, old);
          if (down > 60000) hubReloadAll(h); else hubPoll(h);// اللي حصل وإحنا بنوصل
          if (h.dirty) { h.dirty = false; hubConnect(h) }
        }
        return;
      }
      if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
        // الخط واقع: شبكة الأمان تبقى كل 8 ثواني بدل 30 (من دلوقتي)
        if (h.pend === me) { h.pend = null; hubDrop(h, me); if (!h.live) { if (!h.downAt) h.downAt = Date.now(); h.np = Math.min(h.np, Date.now() + 8000) } hubRetry(h); if (h.dirty) h.dirty = false }
        else if (h.live === me) { h.live = null; if (!h.downAt) h.downAt = Date.now(); h.np = Math.min(h.np, Date.now() + 3000); hubDrop(h, me); hubRetry(h) }
      }
    });
  } catch (e) { if (h.pend === me) h.pend = null; hubRetry(h) }
}
function hubReloadAll(h) { h.subs.forEach(s => s.reload()) }
// شبكة الأمان: الصفوف اللي اتغيّرت من آخر مرة (في المجموعات اللي الصفحة بتسمعها بس)
async function hubPoll(h) {
  if (h.polling || !h.subs.size) return;
  h.polling = true; h.np = Date.now() + (h.live ? 30000 : 8000);
  try {
    const cols = [], paths = [];
    h.subs.forEach(s => { if (s.isDoc) { if (paths.indexOf(s.path) < 0) paths.push(s.path) } else if (cols.indexOf(s.col) < 0) cols.push(s.col) });
    const ors = [];
    if (cols.length) ors.push(`col.in.(${cols.map(qv).join(",")})`);
    if (paths.length) ors.push(`path.in.(${paths.map(qv).join(",")})`);
    const base = () => h.c.from("docs").select("path,col,data,updated_at").or(ors.join(","));
    if (!h.cur) {
      const r = await base().order("updated_at", {ascending: false}).limit(1);
      if (r.error) return;
      const t = r.data && r.data[0] ? msOf(r.data[0].updated_at) : 0;
      h.cur = new Date(Math.max(0, t - 120000)).toISOString();// دقيقتين لورا: اللي حصل وإحنا بنفتح
    }
    const r = await base().gt("updated_at", h.cur).order("updated_at", {ascending: true}).limit(150);
    if (r.error || !r.data || !r.data.length) return;
    h.cur = r.data[r.data.length - 1].updated_at;
    if (r.data.length >= 150) { hubReloadAll(h); return }
    for (const row of r.data) { if (h.seen.get(row.path) === msOf(row.updated_at)) continue; hubDispatch(h, {eventType: "UPDATE", new: row, old: null}, true) }
  } catch (e) {} finally { h.polling = false }
}
function wake(h, away) {
  if (!h.subs.size) return;
  if (!h.live && !h.pend) { clearTimeout(h.rt); h.rt = null; h.tries = 0; hubConnect(h) }
  if (away > 5 * 60000) hubReloadAll(h); else hubPoll(h);
}
function tick(h) {
  if (!h.subs.size || !isVis()) return;
  const rt = h.c.realtime;
  // الخط نفسه (websocket) واقع ومارجعش لوحده خلال 15 ثانية: نبدأ من جديد
  if (h.live && rt && rt.isConnected && !rt.isConnected()) { if (!h.discAt) h.discAt = Date.now(); else if (Date.now() - h.discAt > 15000) { const ch = h.live; h.live = null; h.downAt = h.discAt; h.discAt = 0; h.np = 0; hubDrop(h, ch); hubConnect(h) } }
  else h.discAt = 0;
  if (!h.live && !h.pend && !h.rt) hubConnect(h);
  if (Date.now() >= h.np) hubPoll(h);
}
function hubAdd(h, s) {
  h.subs.add(s); clearTimeout(h.gone); h.gone = null;
  if (!h.kt) h.kt = setTimeout(() => hubConnect(h), 40);// كل السماعات اللي بتتعمل مع بعض = قناة واحدة
}
function hubRemove(h, s) {
  h.subs.delete(s);
  if (!h.subs.size) { clearTimeout(h.gone); h.gone = setTimeout(() => { if (h.subs.size) return; const a = h.live, b = h.pend; h.live = h.pend = null; h.cur = null; clearTimeout(h.rt); h.rt = null; hubDrop(h, a); hubDrop(h, b) }, 20000) }
}
export function onSnapshot(target, next, onErr) {
  const db = target.db, c = db.c, isDoc = target.type === "doc";
  const q = isDoc ? null : (target.type === "query" ? target : query(target));
  let alive = true, loaded = false, cur = [], curDoc, pend = [], timer = null, refetching = false, again = false;
  const fail = e => { if (alive && onErr) try { onErr(mapErr(e)) } catch (x) {} };
  const emit = list => { const prev = cur; cur = list; if (alive) try { next(new QuerySnap(q, list, changes(prev, list))) } catch (x) { console.error(x) } };
  const emitDoc = data => { if (!alive) return; const s = new DocSnap(target, data); if (loaded && eq(curDoc, data)) return; curDoc = data; try { next(s) } catch (x) { console.error(x) } };
  async function load() {
    if (refetching) { again = true; return } refetching = true;
    try {
      if (isDoc) { const s = await getDoc(target); loaded = true; emitDoc(s._d) }
      else { const docs = await runQ(q); loaded = true; const b = pend; pend = []; let list = docs; for (const ev of b) list = apply(list, ev); emit(sortDocs(q, list)) }
    } catch (e) { fail(e) } finally { refetching = false; if (again && alive) { again = false; load() } }
  }
  function apply(list, ev) {
    const path = (ev.new && ev.new.path) || (ev.old && ev.old.path);
    if (!path) return list;
    const rest = list.filter(d => d.ref.path !== path);
    if (ev.eventType === "DELETE" || !ev.new || !ev.new.data) return rest;
    return matches(q, ev.new.data) ? [...rest, rowSnap(db, ev.new)] : rest;
  }
  function onEv(ev) {
    if (!alive) return;
    if (isDoc) { if (!loaded) return; emitDoc(ev.eventType === "DELETE" ? null : ev.new && ev.new.data); return }
    if (!loaded) { pend.push(ev); return }
    // فيه limit: أسهل وأضمن نقرا تاني (القايمة ممكن تتزحزح)
    if (q.lim != null) { clearTimeout(timer); timer = setTimeout(load, 250); return }
    const nl = sortDocs(q, apply(cur, ev));
    if (!changes(cur, nl).length) return;// نفس اللي معانا (مثلاً وصل من اللايف ومن شبكة الأمان): مانرسمش تاني
    emit(nl);
  }
  // ⚡ (12 نوفمبر 2026) القراءة بتبدأ على طول، مش بعد ما خط اللايف يفتح. والتحديثات من "المحطة" (فوق)
  const h = hubOf(c);
  const sub = {isDoc, path: isDoc ? target.path : null, col: isDoc ? null : q.path, onEv,
    reload: () => { if (!alive) return; if (!loaded) return; clearTimeout(timer); timer = setTimeout(load, 150) }};
  hubAdd(h, sub);
  load();
  return () => { alive = false; clearTimeout(timer); hubRemove(h, sub) };
}

// ---------- الدخول (زي Firebase Auth) ----------
const AUTHMAP = {invalid_credentials: "auth/invalid-credential", user_already_exists: "auth/email-already-in-use", email_exists: "auth/email-already-in-use",
  weak_password: "auth/weak-password", over_request_rate_limit: "auth/too-many-requests", over_email_send_rate_limit: "auth/too-many-requests",
  signup_disabled: "auth/admin-restricted-operation", email_provider_disabled: "auth/operation-not-allowed", validation_failed: "auth/invalid-email",
  email_address_invalid: "auth/invalid-email", same_password: "auth/weak-password", user_banned: "auth/user-disabled"};
export function authErr(e) {
  if (!e) return err("auth/internal-error");
  const c = AUTHMAP[e.code];
  if (c) return err(c, e.message);
  const m = String(e.message || "");
  if (/Invalid login credentials/i.test(m)) return err("auth/invalid-credential", m);
  if (/already registered|already exists/i.test(m)) return err("auth/email-already-in-use", m);
  if (/Password should be|weak/i.test(m)) return err("auth/weak-password", m);
  if (/rate limit|too many/i.test(m)) return err("auth/too-many-requests", m);
  if (/Signups not allowed|signup.*disabled/i.test(m)) return err("auth/admin-restricted-operation", m);
  if (/fetch|network/i.test(m) || e.name === "AuthRetryableFetchError" || e.status === 0) return err("auth/network-request-failed", m);
  return err("auth/internal-error", m);
}
const mkUser = (c, s) => ({uid: s.user.id, email: s.user.email, _c: c,
  async getIdToken() { const {data} = await c.auth.getSession(); return (data && data.session && data.session.access_token) || "" }});
export class Auth {
  constructor(c) {
    this.c = c; this.currentUser = null; this._ls = new Set(); this._fired = false;
    // (15 نوفمبر 2026، "الصفحة بيضا وبتعمل ريفرش لوحدها"):
    // 1) تجديد الدخول (TOKEN_REFRESHED) كان بيعمل كائن مستخدم جديد لنفس الشخص، فالصفحة اللي مستنية (auth.currentUser !== u)
    //    كانت بتفتكر إن الحساب اتغيّر وبتسيب اللوحة فاضية. دلوقتي نفس الشخص = نفس الكائن.
    // 2) لو الدخول محفوظ على الجهاز وأول رد قال "مفيش حد" (النت بطيء وهو بيجدّد)، مانعرضش شاشة الدخول على طول: نستنى لحد 8 ثواني.
    let nullT = null;
    const stored = () => { try { const k = c.auth.storageKey; return !!(k && localStorage.getItem(k)) } catch (e) { return false } };
    const fire = u => { this._fired = true; this._ls.forEach(f => { try { f(u) } catch (e) { console.error(e) } }) };
    const set = s => { const u = s && s.user ? mkUser(c, s) : null, before = this.currentUser && this.currentUser.uid, after = u && u.uid;
      if (u) { clearTimeout(nullT); nullT = null; if (before === after && this.currentUser) return; this.currentUser = u; if (!this._fired || before !== after) fire(u); return }
      if (!this._fired && stored()) { if (!nullT) nullT = setTimeout(() => { nullT = null; if (!this.currentUser && !this._fired) fire(null) }, 8000); return }
      clearTimeout(nullT); nullT = null; this.currentUser = null; if (!this._fired || before) fire(null) };
    c.auth.onAuthStateChange((ev, s) => set(s));
    c.auth.getSession().then(({data}) => set(data && data.session)).catch(() => set(null));
  }
}
export function onAuthStateChanged(auth, cb) {
  auth._ls.add(cb);
  if (auth._fired) Promise.resolve().then(() => { if (auth._ls.has(cb)) cb(auth.currentUser) });
  return () => auth._ls.delete(cb);
}
export async function signInWithEmailAndPassword(auth, email, password) {
  const {data, error} = await auth.c.auth.signInWithPassword({email: String(email).trim(), password});
  if (error) throw authErr(error);
  return {user: mkUser(auth.c, data.session ? data : {user: data.user})};
}
export async function createUserWithEmailAndPassword(auth, email, password) {
  const {data, error} = await auth.c.auth.signUp({email: String(email).trim(), password});
  if (error) throw authErr(error);
  // (لو الإيميل موجود قبل كده، Supabase أحياناً بيرجّع مستخدم من غير هويّات بدل الخطأ)
  if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw err("auth/email-already-in-use");
  return {user: mkUser(auth.c, {user: data.user})};
}
export async function updatePassword(user, password) {
  const {error} = await user._c.auth.updateUser({password});
  if (error) throw authErr(error);
}
export async function signOut(auth) { try { await auth.c.auth.signOut({scope: "local"}) } catch (e) {} }
