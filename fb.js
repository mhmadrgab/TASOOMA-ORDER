// fb.js — نسخة Supabase (النقل من Firebase، نوفمبر 2026). نفس اللي بيصدّره fb.js القديم بالظبط، فباقي الملفات ماتتغيّرش.
// يوم النقل: الملف ده بياخد اسم fb.js. لحد كده بيتجرب في نسخة تجريبية منفصلة.
// - البيانات والدخول: Supabase (sbcore.js + sb-config.js)
// - إشعارات الموبايل: لسه Firebase Cloud Messaging (مجاني ومالوش حد)، فمشروع Firebase بيفضل للإشعارات بس
// المكتبة من نفس الموقع (sb-lib.js، ملف واحد) بدل jsdelivr (8 طلبات ورا بعض، وكانت بتعلّق الصفحة على النت الضعيف)
import "./sb-lib.js";
const {createClient} = self.supabase;
import {SB_URL, SB_KEY} from "./sb-config.js";
import * as S from "./sbcore.js";
const {collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, increment, arrayUnion, deleteField,
  signInWithEmailAndPassword, onAuthStateChanged, updatePassword} = S;
// ✨ (v224) الخروج: الصفحة تذوب في 260ms قبل ما تظهر شاشة الدخول (ui.css html.tz-out). مقفولة في الوضع الخفيف و«تقليل الحركة» والصفحة المخفية
async function signOut(a) {
  const H = typeof document !== "undefined" ? document.documentElement : null;
  try {
    if (H && !H.classList.contains("lite") && document.visibilityState === "visible" && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      H.classList.add("tz-out"); await new Promise(r => setTimeout(r, 270));
    }
  } catch (e) {}
  try { return await S.signOut(a) } finally { if (H) setTimeout(() => H.classList.remove("tz-out"), 80) }
}

// Firebase: للإشعارات بس (FCM)
const firebaseConfig = {
  apiKey: "AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",
  authDomain: "tasooma-ad4fe.firebaseapp.com",
  projectId: "tasooma-ad4fe",
  storageBucket: "tasooma-ad4fe.firebasestorage.app",
  messagingSenderId: "463966731953",
  appId: "1:463966731953:web:6b43696b49837494d82c90"
};
export const DOMAIN = "tasooma.app";
export const ADMIN_EMAIL = "mohamedrgab20@gmail.com";
export const emailOf = c => `${c}@${DOMAIN}`;
// كل صفحة ليها دخول لوحدها (فرع / مستودع / سائق) بمفتاح تخزين مختلف، و"sec" (إنشاء الحسابات) مابيتفتكرش خالص
const APPS = {};
// 🛟 الطريق الاحتياطي: لو شبكة الجهاز حاجبة supabase.co (ui.js بيكتشف ده ويكتب tz_via)، الكلام بيعدّي من سيرفر Cloudflare بتاعنا
const VIA_P = "https://tasooma-push.tasooma.workers.dev/sb";
let VIA = SB_URL; try { if (localStorage.getItem("tz_via") === "p") VIA = VIA_P } catch (e) {}
export const SB_VIA = VIA;
// 🖥 (v215) كمبيوتر الفرع المسجّل: «رقم.مفتاح» محفوظ على الجهاز ويُرسَل في ترويسة x-tz-dev مع كل طلب، والقواعد تتأكد منه (priv.dev_br).
// المفتاح نفسه لا يُخزَّن في القاعدة (البصمة فقط). تغييره يحتاج إعادة تحميل الصفحة (الترويسة تُضبط عند إنشاء الاتصال).
export const devGet = () => { try { const v = localStorage.getItem("tz_dev") || ""; return /^[A-Za-z0-9]{6,20}\.[A-Za-z0-9]{16,64}$/.test(v) ? v : "" } catch (e) { return "" } };
export const devSet = v => { try { if (v) localStorage.setItem("tz_dev", v); else localStorage.removeItem("tz_dev") } catch (e) {} };
export function makeFb(name) {
  if (APPS[name]) return APPS[name];
  const dv = name === "sec" ? "" : devGet();
  const c = createClient(VIA, SB_KEY, {auth: {storageKey: "tz-sb-" + name, persistSession: name !== "sec", autoRefreshToken: name !== "sec", detectSessionInUrl: false},
    realtime: {params: {eventsPerSecond: 10}}, global: {headers: dv ? {"x-tz-dev": dv} : {}}});
  const db = {c}, app = {name, sb: c, db};
  return APPS[name] = {app, db, auth: new S.Auth(c)};
}
// 👤 (16 نوفمبر 2026) إنشاء حساب دخول: من السيرفر الأول (بمفتاح الخدمة، فالتسجيل في Supabase يفضل مقفول)،
// ولو السيرفر مش متاح أو رفض لأي سبب غير "الإيميل موجود/كلمة السر ضعيفة" بنرجع للطريقة القديمة (signUp) زي ما كانت.
async function createUserWithEmailAndPassword(a, email, pw) {
  const main = Object.keys(APPS).filter(k => k !== "sec").map(k => APPS[k].auth.currentUser).find(Boolean);
  if (main && PUSH_URL) {
    let r = null;
    try { const t = await main.getIdToken(); r = await withTimeout(fetch(PUSH_URL + "/mkuser", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({email: String(email).trim(), pw: String(pw)})}), 20000) } catch (e) { r = null }
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 && j && j.ok) return {user: {uid: String(j.id || ""), email: String(email).trim().toLowerCase()}};
      if (j && typeof j.code === "string" && /^auth\/(email-already-in-use|weak-password|invalid-email)$/.test(j.code)) { const e = new Error(j.code); e.code = j.code; throw e }
    }
  }
  return S.createUserWithEmailAndPassword(a, email, pw);
}
// 🔑 (18 نوفمبر 2026، مراجعة الأمان) كلمات المرور لم تعد تُحفظ في القاعدة (كانت نصاً صريحاً في secrets وأي مدير يقرؤها).
// tmpPw = الكلمات التي أُنشئت أو تغيّرت في فتحة الصفحة هذه فقط (في الذاكرة) ليَنسخ المدير الرسالة مرة واحدة.
// adminSetPw = تغيير كلمة مرور حساب من السيرفر (/setpw بمفتاح الخدمة) بدون الكلمة القديمة، والصلاحيات يتحقق منها السيرفر.
export const tmpPw = {};
export async function adminSetPw(email, pw) {
  const fail = c => { const e = new Error(c); e.code = c; return e };
  const main = Object.keys(APPS).filter(k => k !== "sec").map(k => APPS[k].auth.currentUser).find(Boolean);
  if (!main || !PUSH_URL) throw fail("x/server");
  let r;
  try { const t = await main.getIdToken(); r = await withTimeout(fetch(PUSH_URL + "/setpw", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({email: String(email).trim(), pw: String(pw)})}), 20000) }
  catch (e) { throw fail("auth/network-request-failed") }
  const j = await r.json().catch(() => ({}));
  if (r.status === 200 && j && j.ok) return true;
  throw fail(j && typeof j.code === "string" ? j.code : r.status === 403 ? "x/not-allowed" : "x/server");
}
export const withTimeout = (p, ms = 15000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

// ---------- إشعارات الجوال (FCM) ----------
let FBA = null;
async function fbApp() {
  if (FBA) return FBA;
  const m = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  return FBA = m.getApps().find(a => a.name === "fcm") || m.initializeApp(firebaseConfig, "fcm");
}
export async function pushRegister(app, db, info) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return false;
    const m = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js");
    if (!(await m.isSupported())) return false;
    await navigator.serviceWorker.register("./sw.js");
    const reg = await withTimeout(navigator.serviceWorker.ready, 20000);
    const msg = m.getMessaging(await fbApp()), tok = await withTimeout(m.getToken(msg, {serviceWorkerRegistration: reg}), 20000);
    if (!tok) return false;
    if (!window.__fgm) { window.__fgm = 1; m.onMessage(msg, p => {
      const n = (p && p.notification) || {}, d = (p && p.data) || {};
      if (String(d.tag || "").indexOf("call") === 0) try { if (window.__tzCallIn) window.__tzCallIn(String(d.tag).slice(4)) } catch (e) {}// ⚡ (v213) الرنة فوراً من إشعار الجهاز
      if (String(d.tag || "").indexOf("call") !== 0) try { if (window.__tzNote) window.__tzNote(n.title || d.t || "", n.body || d.b || "", (p.fcmOptions && p.fcmOptions.link) || d.link || "") } catch (e) {}// 🔔 (v179) سجل الإشعارات
      if (!(document.hidden || !document.hasFocus()) && d.tag !== "test") return;
      if (String(d.tag || "").indexOf("call") === 0) return;// 📞 المكالمة: شاشة الرد في call.js (والخبر وصلها فوق)
      reg.showNotification(n.title || d.t || "تاسومة", {body: n.body || d.b || "", tag: d.tag || undefined, icon: "./icon-192.png", dir: document.documentElement.dir || "rtl", lang: document.documentElement.lang || "ar", data: {link: (p.fcmOptions && p.fcmOptions.link) || d.link || ""}}).catch(() => {});
    }) }
    await pushSave(db, info, tok);
    return true;
  } catch (e) { console.warn("push", e); return false }
}
// 📱 تطبيق تاسومة (أندرويد): رقم الإشعارات بييجي من التطبيق نفسه (window.TasoomaApp)، وبيتسجّل dv:"app" علشان السيرفر يبعتله المكالمة كاتصال
export function nativePush(db, info) {
  const A = window.TasoomaApp; if (!A || !A.pushToken) return false;
  const save = t => { if (t) pushSave(db, info, String(t), true).catch(() => {}) };
  window.__natTok = save; try { save(A.pushToken()) } catch (e) {}
  return true;
}
export async function pushSave(db, info, tok, native) {
  const mob = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const rec = {role: info.role, key: String(info.key), email: String(info.email || "").toLowerCase(), tok, ts: Date.now()}, ref = doc(db, "push", info.role + "__" + tok);
  const en = window.TZL && TZL.lang === "en";
  await setDoc(ref, {...rec, dv: native ? "app" : mob ? "m" : "pc", ...(en ? {lg: "en"} : {})}).catch(e => native ? setDoc(ref, {...rec, dv: "m", ...(en ? {lg: "en"} : {})}) : Promise.reject(e));// قواعد قديمة مابتقبلش app ← m
}
// ---------- سيرفر الإشعارات (Cloudflare) ----------
export const PUSH_URL = "https://tasooma-push.tasooma.workers.dev";
export async function ping(auth, ids, chats, trips, gifts, mnts, pos, cus, ers, oils, dcs, tks, mks) {
  try {
    const u0 = a => [...new Set((a || []).filter(Boolean))]; ids = u0(ids); chats = u0(chats); trips = u0(trips); gifts = u0(gifts); mnts = u0(mnts); pos = u0(pos); cus = u0(cus); ers = u0(ers); oils = u0(oils); dcs = u0(dcs);
    // ✅ (v243) tks = المهام: "رقم" (إسناد/إنهاء) أو "رقم/رقم التعليق" (تعليق جديد)
    mks = u0(mks).filter(x => /^[td]:[A-Za-z0-9_-]{1,64}$/.test(x));/* 📣 (v246) mks = الحملات التسويقية: "t:مهمة" أو "d:اتفاق مؤثر" */
    tks = u0(tks); const tkc = tks.filter(x => String(x).includes("/")); tks = tks.filter(x => !String(x).includes("/"));// 🧾 (v241) dcs = يوميات الفروع · 🛢 (v232) oils = بلاغات تغيير الزيت · 💼 (v219) cus = حركات عهدة الفروع · 🧭 (v223) ers = المشاوير
    chats.filter(c => /^g_/.test(c)).forEach(c => multiPush(auth, "/grp", {gid: c.slice(2)})); chats = chats.filter(c => !/^g_/.test(c));
    // 📦 (18 نوفمبر 2026) مرحلة الحاوية (ميناء / متجهة / وصلت المستودع) تُذاع للمديرين والمحاسبين، والفروع عند الوصول. على دفعات، والسيرفر يمنع التكرار
    if (auth && auth.currentUser && !/@tasooma\.app$/i.test(String(auth.currentUser.email || ""))) pos.forEach(x => multiPush(auth, "/pobc", {id: x}));
    if (!PUSH_URL || !(ids.length || chats.length || trips.length || gifts.length || mnts.length || pos.length || cus.length || ers.length || oils.length || dcs.length || tks.length || tkc.length || mks.length)) return;
    const u = auth && auth.currentUser; if (!u) return;
    const t = await u.getIdToken();
    const jobs = [...trips.map(x => ({trips: [x]})), ...ids.map(x => ({ids: [x]})), ...chats.map(x => ({chats: [x]})), ...gifts.map(x => ({gifts: [x]})), ...mnts.map(x => ({mnts: [x]})), ...pos.map(x => ({pos: [x]})), ...cus.map(x => ({cus: [x]})), ...ers.map(x => ({ers: [x]})), ...oils.map(x => ({oils: [x]})), ...dcs.map(x => ({dcs: [x]})), ...tks.map(x => ({tks: [x]})), ...tkc.map(x => ({tkc: [x]})), ...mks.map(x => ({mks: [x]}))].slice(0, 200);// (v237) كان 40 وبيسيب الباقي بصمت (تعيين جماعي لأكتر من 40 طلب)؛ السيرفر يسمح 240 في الدقيقة للحساب
    jobs.forEach((b, i) => setTimeout(() => fetch(PUSH_URL + "/notify", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({ids: [], chats: [], trips: [], gifts: [], mnts: [], pos: [], cus: [], ers: [], oils: [], dcs: [], ...b}), keepalive: i < 40}).catch(() => {}), i < 40 ? 0 : (i - 39) * 60));// keepalive له حد حجم في المتصفح: لأول 40 بس، والباقي متباعد شوية
  } catch (e) {}
}
export const annPush = (auth, id) => multiPush(auth, "/ann", {id});
async function multiPush(auth, path, body) {
  try { const u = auth && auth.currentUser; if (!u || !PUSH_URL) return; const t = await u.getIdToken();
    for (let part = 0; part < 12; part++) { const r = await fetch(PUSH_URL + path, {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({...body, part})});
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.more) break } } catch (e) {}
}
export async function pushTest(auth, to) {
  const u = auth && auth.currentUser; if (!u) throw new Error("login");
  const r = await withTimeout(fetch(PUSH_URL + "/test", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + await u.getIdToken()}, body: JSON.stringify(to ? {to} : {})}), 20000);
  if (!r.ok) throw new Error("http " + r.status); return r.json();
}
// ---------- الحد اليومي: Supabase مالوش حد يومي، فالشريط البرتقالي مابيظهرش ----------
export async function quotaOut() { return false }
export async function checkQuota() { document.documentElement.classList.remove("ui-quota"); return false }
export async function failReason(x) {
  if (x && x.code === "permission-denied") return "denied";
  if (x && x.code === "resource-exhausted") return "quota";// (v237) حد الكتابة اليومي: «الخدمة متوقفة مؤقتاً… أبلغ المستودع» بدل «اضغط مجدداً»
  if (!navigator.onLine) return "offline";
  return "slow";
}
export const FAIL_MSG = {
  quota: "الخدمة متوقفة مؤقتاً. البيانات محفوظة على جهازك، حاول لاحقاً، وأبلغ المستودع.",
  offline: "لا يوجد اتصال بالإنترنت حالياً. البيانات محفوظة، حاول مجدداً فور عودة الإنترنت.",
  slow: "الاتصال بطيء ولم نتأكد من اكتمال الحفظ. اضغط مجدداً ولن يتكرر."
};
// ---------- سجل "مين عمل إيه" (نفس القديم بالظبط) ----------
let AUD = null;
// 🔏 (16 نوفمبر 2026) السجل بقى بيتكتب من السيرفر نفسه جوه w() (supabase/002_rules.sql) والمتصفح مالوش دخل، فمحدش يقدر يزوّره أو يتخطّاه.
// الدالة فاضلة علشان admin.html بينادي عليها، بس مابتعملش حاجة (AUD يفضل null فمفيش كتابة من المتصفح).
export function setAudit(a) { AUD = null }
const NOLOG = new Set(["dm", "whdir", "ddir", "push", "geo", "meta", "log", "ava", "pushlog", "chats", "pods", "giftimg", "seen"]);
function note(op, r, d) {
  if (!AUD || !r || !r.path) return null; const p = String(r.path).split("/"); if (p.length !== 2 || NOLOG.has(p[0])) return null;
  if (d && typeof d === "object" && Object.keys(d).join() === "msgs") return null;
  let t = ""; try { t = String(AUD.label && AUD.label(p[0], p[1], d) || "") } catch (e) {}
  const o = d && typeof d === "object" ? d : {};
  const s = typeof o.st === "string" ? o.st : typeof o.enabled === "boolean" ? (o.enabled ? "on" : "off") : typeof o.admin === "boolean" ? (o.admin ? "adm" : "acc") : "";
  return {e: AUD.e, n: String(AUD.n && AUD.n() || "").slice(0, 60), op, c: p[0].slice(0, 30), id: p[1].slice(0, 60), t: t.slice(0, 100), k: Object.keys(o).slice(0, 12).map(x => x.slice(0, 30)), s: s.slice(0, 20)};
}
const put = L => { if (AUD) L.filter(Boolean).forEach(o => S.addDoc(collection(AUD.db, "log"), {...o, ts: Date.now()}).catch(() => {})) };
const group = L => { const g = {}; L.filter(Boolean).forEach(o => { const k = o.c + "|" + o.op; (g[k] = g[k] || []).push(o) }); return Object.values(g).map(a => a.length === 1 ? a[0] : {...a[0], id: "", t: "", x: a.length}) };
const setDoc = (r, d, o) => { const L = [note("set", r, d)]; return S.setDoc(r, d, o).then(x => { put(L); return x }) };
const updateDoc = (r, d) => { const L = [note("upd", r, d)]; return S.updateDoc(r, d).then(x => { put(L); return x }) };
const deleteDoc = r => { const L = [note("del", r, null)]; return S.deleteDoc(r).then(x => { put(L); return x }) };
const addDoc = (c, d) => S.addDoc(c, d).then(ref => { put([note("set", ref, d)]); return ref });
function writeBatch(db) {
  const b = S.writeBatch(db), L = [], w = {
    set(r, d, o) { L.push(note("set", r, d)); b.set(r, d, o); return w },
    update(r, d) { L.push(note("upd", r, d)); b.update(r, d); return w },
    delete(r) { L.push(note("del", r, null)); b.delete(r); return w },
    commit() { return b.commit().then(x => { put(group(L)); return x }) }};
  return w;
}
export {collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch, arrayUnion, orderBy, limit, increment, deleteField, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword};
