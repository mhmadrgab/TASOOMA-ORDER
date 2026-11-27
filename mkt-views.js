// 📣 استوديو التسويق — الشاشات (v266): دوال ترجّع HTML من حالة التطبيق A فقط (بلا كتابة ولا أحداث).
// A = {M:{C,T,D,X}, S (حالة العرض), DR (الدرج), WD (الأسماء), IBC (آيبانات مكشوفة), role:{mgr,team,fin,all,ro}, me, t (اليوم), now, loaded, seen(id)}
// كل زر عليه data-mkq (الفعل) و data-mki (الرقم) و data-mkv / data-mks (قيمة)، والأحداث كلها في mkt.js.
import {E, N, money, big, pct, dmy, dm, days, addD, CH, PF, RL, XK, CST, DST, TST, TCOL, PRI, CLR, lab, rl, tasksOf, dealsOf, exOf, kpOf, kpName, isLate, clStat,
  spend, timeP, tkStat, kpP, health, insights, queue, buckets, workload, feed, monthGrid, MONTHS, WDAYS, taskCan, ibanFmt, ibanMask, PTY, normName, dealKey, parties} from "./mkt-core.js";

// ---------- قطع صغيرة ----------
const vals = m => Array.from(m.values());
export const nameOf = (A, e) => { const w = A.WD.get(String(e || "").toLowerCase()); return w && w.n ? w.n : String(e || "").split("@")[0] };
const avc = e => { let h = 0; const s = String(e); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return CLR[h % CLR.length] };
export const av = (A, e, cls) => { const n = nameOf(A, e); return `<i class="ms-av${cls ? " " + cls : ""}" style="background:${avc(e)}" title="${E(n)}" data-notr>${E((n.replace(/^(ال|م\.\s*)/, "") || "?").charAt(0))}</i>` };
const avs = (A, list, max) => { const L = list.slice(0, max), more = list.length - L.length; return `<span class="ms-avs">${L.map(e => av(A, e)).join("")}${more > 0 ? `<i class="ms-av more">+${more}</i>` : ""}</span>` };
const cname = (A, id) => { const c = A.M.C.get(id); return c ? c.n : "—" };
const ccol = c => CLR[N(c && c.cl) % CLR.length];
const pill = (k, txt) => `<span class="ms-pl ${k === "x" ? "cx" : k === "live" ? "lv" : E(k)}">${E(txt)}</span>`;
const hpill = h => h.k === "idle" ? "" : `<span class="ms-hl ${h.k}"${h.why.length ? ` title="${E(h.why.join(" · "))}"` : ""}><i></i>${E(h.l)}</span>`;
const meter = (l, p, cls, r) => `<div class="ms-mt"><span>${l}</span><div class="ms-bar ${cls || ""}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div><b>${r}</b></div>`;
const barC = p => p > 100 ? "r" : p >= 85 ? "wn" : "";
const empty = (t, s, btn) => `<div class="ms-e"><b>${t}</b>${s ? `<span>${s}</span>` : ""}${btn || ""}</div>`;
export function ago(ts, now) {
  const d = Math.max(0, now - N(ts)), m = Math.floor(d / 6e4); if (m < 1) return "الآن"; if (m < 60) return "منذ " + m + " د"; const h = Math.floor(m / 60); if (h < 24) return "منذ " + h + " س";
  const k = Math.floor(h / 24); if (k === 1) return "أمس"; if (k < 7) return "منذ " + k + " أيام"; const x = new Date(N(ts)); return ("0" + x.getDate()).slice(-2) + "/" + ("0" + (x.getMonth() + 1)).slice(-2);
}
function dueChip(x, t) {
  if (!x.du) return ""; const k = days(t, x.du);
  if (x.st === "done") return `<span class="ms-du">${E(dm(x.du))}</span>`;
  if (k < 0 && x.st !== "rev") return `<span class="ms-du late">متأخرة ${-k} ${-k === 1 ? "يوم" : "أيام"}</span>`;
  return `<span class="ms-du${k === 0 ? " now" : k <= 2 ? " soon" : ""}">${k === 0 ? "اليوم" : k === 1 ? "غداً" : E(dm(x.du))}</span>`;
}
const ws = k => { const r = rl(k); return `<span class="ms-ws" style="--wc:${r[3]}">${r[1]} ${r[2]}</span>` };
const counters = (A, x) => { const cs = clStat(x), cn = N(x.cn), an = N(x.an);
  return `${cs.n ? `<span class="ms-ct${cs.k === cs.n ? " ok" : ""}">☑ ${cs.k}/${cs.n}</span>` : ""}${cn ? `<span class="ms-ct${cn > A.seen(x.id) ? " new" : ""}">💬 ${cn}</span>` : ""}${an ? `<span class="ms-ct">📎 ${an}</span>` : ""}${N(x.rn) ? `<span class="ms-ct rn" title="عدد مرات الإعادة للتعديل">↩ ${N(x.rn)}</span>` : ""}` };
function ring(p, col, size, sw, center) { const r = (size - sw) / 2, C = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p)), L = C * v / 100;
  return `<div class="ms-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(128,128,128,.18)" stroke-width="${sw}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${L} ${C}"/></svg><div class="c">${center}</div></div>` }
function donut(parts, size, sw, center) { const r = (size - sw) / 2, C = 2 * Math.PI * r, tot = parts.reduce((a, x) => a + x.v, 0); let off = 0;
  const seg = tot > 0 ? parts.filter(x => x.v > 0).map(x => { const L = C * x.v / tot, s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${x.c}" stroke-width="${sw}" stroke-dasharray="${Math.max(0, L - 1.5)} ${C}" stroke-dashoffset="${-off}"/>`; off += L; return s }).join("") : "";
  return `<div class="ms-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(128,128,128,.18)" stroke-width="${sw}"/>${seg}</svg><div class="c">${center}</div></div>` }
const btn = (q, txt, o) => { o = o || {}; return `<button type="button" class="ms-b${o.c ? " " + o.c : ""}" data-mkq="${q}"${o.i != null ? ` data-mki="${E(o.i)}"` : ""}${o.s != null ? ` data-mks="${E(o.s)}"` : ""}${o.v != null ? ` data-mkv="${E(o.v)}"` : ""}${o.t ? ` title="${E(o.t)}"` : ""}>${txt}</button>` };
const camps = A => vals(A.M.C);
const sortC = L => L.slice().sort((a, b) => ({live: 0, plan: 1, done: 2, x: 3})[a.st] - ({live: 0, plan: 1, done: 2, x: 3})[b.st] || String(a.from).localeCompare(String(b.from)));

// ---------- الشريط العلوي ----------
export function topHtml(A) {
  const S = A.S, q = queue(A.M, A.role, A.me, A.t), nAp = q.filter(x => x.k === "rev" || x.k === "deal" || x.k === "pay").length;
  const tabs = [["home", "مساحتي", q.length], ["camps", "الحملات", 0]];
  if (A.role.all) tabs.push(["team", "الفريق", 0]);
  if (A.role.mgr || A.role.fin) tabs.push(["appr", "الاعتمادات", nAp]);
  if (A.role.all) tabs.push(["inf", "المؤثرون", 0]);
  if (A.role.all) tabs.push(["pay", "التحويلات", A.role.fin ? q.filter(x => x.k === "pay").length : 0]);
  const cur = S.pg === "c" ? "camps" : S.pg;
  return `<div class="ms-hd"><h2 class="ms-ttl">استوديو التسويق</h2>
  <nav class="ms-nav" aria-label="أقسام استوديو التسويق">${tabs.map(x => `<button type="button" class="${cur === x[0] ? "on" : ""}" data-mkq="pg" data-mkv="${x[0]}"${cur === x[0] ? ' aria-current="page"' : ""}>${x[1]}${x[2] ? `<b class="ms-n">${x[2]}</b>` : ""}</button>`).join("")}</nav>
  <span class="ms-sp"></span>${A.role.mgr ? btn("new", "＋ حملة جديدة", {c: "p"}) : ""}</div>`;
}

// ---------- الصفحات ----------
export function bodyHtml(A) {
  if (!A.loaded) return `<div class="ms-sk"><i></i><i></i><i></i></div>`;
  const S = A.S;
  if (S.pg === "c") { const c = A.M.C.get(S.c); return c ? campPage(A, c) : empty("هذه الحملة غير متاحة", "ربما حُذفت أو لم تعد ضمن فريقها.", btn("pg", "عرض الحملات", {v: "camps"})) }
  return S.pg === "camps" ? campsPage(A) : S.pg === "team" && A.role.all ? teamPage(A) : S.pg === "appr" && (A.role.mgr || A.role.fin) ? apprPage(A) : S.pg === "pay" && A.role.all ? payPage(A) : S.pg === "inf" && A.role.all ? infPage(A) : homePage(A);
}

// صف مهمة (في مساحتي، الفريق، القائمة)
function tRow(A, x, o) {
  o = o || {}; const r = rl(x.r), can = taskCan(x, A.role, A.me), late = isLate(x, A.t);
  const quick = o.quick === false || A.role.ro ? "" : can.approve ? btn("tgo", "✓ اعتماد", {c: "ok sm", i: x.id, s: "approve"}) : can.submit ? btn("tgo", x.st === "todo" ? "ابدأ" : "أرسل للاعتماد", {c: "sm", i: x.id, s: x.st === "todo" ? "start" : "submit"})
    : can.start ? btn("tgo", "ابدأ", {c: "sm", i: x.id, s: "start"}) : can.finish && can.mine ? btn("tgo", "✓ أنجزتها", {c: "ok sm", i: x.id, s: "finish"}) : "";
  return `<div class="ms-tr${x.st === "done" ? " dn" : ""}${late ? " late" : ""}" data-mkq="topen" data-mki="${E(x.id)}" tabindex="0" role="button" style="--wc:${r[3]}">
  <i class="dot" title="${E(r[2])}"></i><div class="ti"><b data-notr>${E(x.t)}</b><small>${o.camp === false ? E(r[2]) : `<span data-notr>${E(cname(A, x.c))}</span> · ${E(r[2])}`}</small></div>
  <div class="mt">${counters(A, x)}${dueChip(x, A.t)}${N(x.pr) ? `<span class="ms-pr p${N(x.pr)}">${PRI[N(x.pr)]}</span>` : ""}${pill(x.st, TST[x.st] || "")}${o.who === false ? "" : av(A, x.as)}</div>${quick ? `<div class="qa">${quick}</div>` : ""}</div>`;
}

// عنصر في «يحتاج قرارك»
function qItem(A, it) {
  const now = A.now;
  if (it.k === "rev" || it.k === "ret" || it.k === "due") {
    const x = it.x, head = it.k === "rev" ? ["rev", "📥 بانتظار اعتمادك"] : it.k === "ret" ? ["ret", "↩️ أُعيد إليك للتعديل"] : isLate(x, A.t) ? ["late", "⏰ متأخرة"] : ["due", "🗓 موعدها قريب"];
    const sub = it.k === "rev" ? `أرسله <b data-notr>${E(x.sb && x.sb.n || nameOf(A, x.as))}</b> · ${ago(x.sb && x.sb.at, now)}${N(x.rn) ? " · بعد التعديل (الجولة " + (N(x.rn) + 1) + ")" : ""}`
      : it.k === "ret" ? `<span data-notr>${E(x.rt && x.rt.note || "")}</span> · <b data-notr>${E(x.rt && x.rt.n || "")}</b>` : `${dueChip(x, A.t)} · ${E(rl(x.r)[2])}`;
    const can = taskCan(x, A.role, A.me);
    const acts = A.role.ro ? "" : it.k === "rev" ? btn("tgo", "✓ اعتماد", {c: "ok sm", i: x.id, s: "approve"}) + btn("tgo", "↩ إعادة للتعديل", {c: "sm", i: x.id, s: "return"})
      : can.submit ? btn("tgo", x.st === "todo" ? "ابدأ العمل" : "أرسل للاعتماد", {c: "p sm", i: x.id, s: x.st === "todo" ? "start" : "submit"}) : can.start ? btn("tgo", "ابدأ العمل", {c: "p sm", i: x.id, s: "start"}) : can.finish ? btn("tgo", "✓ أنجزتها", {c: "ok sm", i: x.id, s: "finish"}) : "";
    return `<div class="ms-qi ${head[0]}" data-mkq="topen" data-mki="${E(x.id)}" tabindex="0" role="button"><span class="k">${head[1]}</span><div class="t"><b data-notr>${E(x.t)}</b><small><span data-notr>${E(cname(A, x.c))}</span> · ${sub}</small></div><div class="a">${acts}</div></div>`;
  }
  const d = it.d, head = it.k === "deal" ? ["rev", "🤝 اتفاق بانتظار اعتمادك"] : it.k === "pay" ? ["pay", "💸 تحويل مطلوب"] : ["ret", "↩️ رُفض اتفاقك"];
  const sub = it.k === "deal" ? `سجّله <b data-notr>${E(d.by && d.by.n || "")}</b> · ${ago(d.upd || d.ts, now)}` : it.k === "pay" ? `اعتمده <b data-notr>${E(d.ap && d.ap.n || "")}</b> · ${ago(d.ap && d.ap.at, now)}` : `<span data-notr>${E(d.ap && d.ap.note || "")}</span>`;
  const acts = A.role.ro ? "" : it.k === "deal" ? btn("dok", "✓ اعتماد", {c: "ok sm", i: d.id}) + btn("dno", "رفض", {c: "sm", i: d.id}) : it.k === "pay" ? btn("pay", "بيانات التحويل", {c: "p sm", i: d.id}) : btn("dedit", "تصحيح وإعادة الإرسال", {c: "p sm", i: d.id});
  return `<div class="ms-qi ${head[0]}" data-mkq="dopen" data-mki="${E(d.id)}" tabindex="0" role="button"><span class="k">${head[1]}</span><div class="t"><b><span data-notr>${E(d.n)}</span> · ${money(d.amt)} ريال</b><small><span data-notr>${E(cname(A, d.c))}</span> · ${sub}</small></div><div class="a">${acts}</div></div>`;
}
function feedList(A, cids, lim, ref) {
  let L = feed(A.M, cids, ref ? 400 : lim); if (ref) L = L.filter(e => e.ref === ref).slice(0, lim);
  const ic = {new: "🚀", task: "📌", sub: "📤", ret: "↩️", ok: "✅", done: "✅", deal: "🤝", pay: "💸", exp: "🧾"};
  return L.length ? `<ul class="ms-fd">${L.map(e => `<li${e.ref && !ref ? ` data-mkq="${e.ref[0] === "t" ? "topen" : "dopen"}" data-mki="${E(e.ref.slice(2))}" tabindex="0" role="button"` : ""}><span class="i">${ic[e.k] || "•"}</span><div><b data-notr>${E(e.who)}</b> ${E(e.verb)} <span data-notr>«${E(e.obj)}»</span><small>${ref || (cids && cids.length === 1) ? "" : `<span data-notr>${E(cname(A, e.c))}</span> · `}${ago(e.at, A.now)}</small></div></li>`).join("")}</ul>` : `<p class="ms-mu">لا نشاط بعد.</p>`;
}

// 🏠 مساحتي
function homePage(A) {
  const M = A.M, t = A.t, me = A.me, q = queue(M, A.role, me, t), mine = vals(M.T).filter(x => x.as === me), open = mine.filter(x => x.st !== "done"), late = open.filter(x => isLate(x, t)).length;
  const live = sortC(camps(A).filter(c => c.st === "live" || c.st === "plan")), wk = A.now - 7 * 864e5, doneW = mine.filter(x => x.st === "done" && N(x.dn && x.dn.at) >= wk).length, B = buckets(mine, t);
  const tiles = `<div class="ms-tl"><div class="${q.length ? "wn" : "k"}"><small>يحتاج قرارك</small><b>${q.length}</b><em>${q.length ? "ابدأ بها" : "لا شيء معلّق"}</em></div>
  <div class="${late ? "r" : ""}"><small>مهامي المفتوحة</small><b>${open.length}</b><em>${late ? late + " متأخرة" : "لا تأخير"}</em></div>
  <div><small>أنجزتُ خلال 7 أيام</small><b>${doneW}</b><em>مهمة</em></div>
  <button type="button" data-mkq="pg" data-mkv="camps"><small>حملات نشطة</small><b>${live.length}</b><em>${live.filter(c => c.st === "live").length} جارية</em></button></div>`;
  const qh = q.length ? `<section class="ms-bx"><h3>📥 يحتاج قرارك <small>${q.length}</small></h3><div class="ms-ql">${q.slice(0, 12).map(it => qItem(A, it)).join("")}</div>${q.length > 12 ? `<p class="ms-mu">و${q.length - 12} أخرى في صفحة الاعتمادات.</p>` : ""}</section>` : "";
  const mh = `<section class="ms-bx"><h3>🗂 مهامي <small>${open.length}</small></h3>${B.length ? B.map(g => `<div class="ms-gp ${g.k}"><h4>${g.l} <small>${g.L.length}</small></h4>${g.L.map(x => tRow(A, x, {who: false})).join("")}</div>`).join("") : empty("لا مهام مفتوحة عندك", mine.length ? "أنجزت كل ما أُسند إليك." : "عند إسناد مهمة لك ستظهر هنا.")}</section>`;
  const ch = live.length ? `<section class="ms-bx"><h3>📣 الحملات النشطة</h3><div class="ms-ml">${live.slice(0, 6).map(c => { const ts = tkStat(M, c.id, t), h = health(M, c, t);
    return `<div class="ms-mc" style="--cc:${ccol(c)}" data-mkq="open" data-mki="${E(c.id)}" tabindex="0" role="button"><div class="r"><b data-notr>${E(c.name || c.n)}</b>${hpill(h)}</div>${meter("المهام", ts.p, "k", ts.done + "/" + ts.n)}</div>` }).join("")}</div></section>` : "";
  const fh = `<section class="ms-bx"><h3>🕒 آخر النشاط</h3>${feedList(A, null, 10)}</section>`;
  return `${tiles}<div class="ms-2"><div>${qh}${mh}</div><div>${ch}${fh}</div></div>`;
}

// 📣 الحملات
function campCard(A, c) {
  const M = A.M, t = A.t, ts = tkStat(M, c.id, t), h = health(M, c, t), s = A.role.all ? spend(M, c.id) : null, kp = kpP(c), pe = dealsOf(M, c.id).filter(d => d.st === "pend").length;
  const left = c.st === "live" ? (c.to >= t ? "باقي " + days(t, c.to) + " يوماً" : "انتهت مدتها") : c.st === "plan" ? (c.from > t ? "تبدأ بعد " + days(t, c.from) + " يوماً" : "جاهزة للبدء") : "";
  return `<article class="ms-cc" style="--cc:${ccol(c)}" data-mkq="open" data-mki="${E(c.id)}" tabindex="0" role="button">
  <header><b data-notr>${E(c.n)}</b>${hpill(h)}</header>
  <small>${pill(c.st, CST[c.st] || "")} <bdi dir="ltr">${E(dm(c.from))} ← ${E(dm(c.to))}</bdi>${left ? " · " + left : ""}</small>
  <div class="ms-ms">${meter("المهام", ts.p, "k", ts.done + "/" + ts.n)}${s ? meter("الميزانية", pct(s.tot, N(c.bud)), barC(pct(s.tot, N(c.bud))), pct(s.tot, N(c.bud)) + "%") : ""}${kp == null ? "" : meter("الأهداف", kp, "k", kp + "%")}</div>
  <footer>${avs(A, Array.isArray(c.tm) ? c.tm : [], 5)}<span class="ms-sp"></span>${ts.od ? `<span class="ms-ch r">⏰ ${ts.od} متأخرة</span>` : ""}${ts.rev ? `<span class="ms-ch wn">📥 ${ts.rev} للاعتماد</span>` : ""}${pe ? `<span class="ms-ch wn">🤝 ${pe}</span>` : ""}</footer></article>`;
}
function timeline(A, L) {
  if (!L.length) return ""; const t = A.t; let a = L[0].from, b = L[0].to; L.forEach(c => { if (c.from < a) a = c.from; if (c.to > b) b = c.to }); if (t < a) a = t; if (t > b) b = t;
  a = addD(a, -2); b = addD(b, 2); const span = Math.max(1, days(a, b)), pos = d => Math.max(0, Math.min(100, days(a, d) / span * 100)), marks = [];
  let y = +a.slice(0, 4), m = +a.slice(5, 7); for (let i = 0; i < 24; i++) { const d = y + "-" + ("0" + m).slice(-2) + "-01"; if (d > b) break; if (d >= a) marks.push([d, MONTHS[m - 1]]); m++; if (m > 12) { m = 1; y++ } }
  return `<div class="ms-tm"><div class="ax">${marks.map(x => `<span style="inset-inline-start:${pos(x[0])}%">${x[1]}</span>`).join("")}</div>
  ${L.map(c => `<div class="rw"><div class="rn" data-notr>${E(c.n)}</div><div class="tr"><i class="now" style="inset-inline-start:${pos(t)}%"></i><button type="button" class="bx${c.st === "x" ? " cx" : ""}" style="--cc:${ccol(c)};inset-inline-start:${pos(c.from)}%;width:${Math.max(1.5, pos(addD(c.to, 1)) - pos(c.from))}%" data-mkq="open" data-mki="${E(c.id)}" title="${E(c.n)}"><span>${E(dm(c.from))} ← ${E(dm(c.to))}</span></button></div></div>`).join("")}</div>`;
}
function campsPage(A) {
  const S = A.S, all = camps(A), F = [["act", "النشطة", c => c.st === "live" || c.st === "plan"], ["live", "جارية", c => c.st === "live"], ["plan", "مخطط لها", c => c.st === "plan"], ["done", "منتهية", c => c.st === "done"], ["x", "ملغاة", c => c.st === "x"], ["all", "الكل", () => true]];
  const f = F.find(x => x[0] === S.f) || F[0], q = String(S.q || "").trim().toLowerCase(), L = sortC(all.filter(f[2]).filter(c => !q || String(c.n).toLowerCase().indexOf(q) >= 0));
  const bar = `<div class="ms-fb"><div class="ms-seg">${F.map(x => { const n = all.filter(x[2]).length; return `<button type="button" class="${f[0] === x[0] ? "on" : ""}" data-mkq="f" data-mkf="${x[0]}">${x[1]}${n ? ` <i>${n}</i>` : ""}</button>` }).join("")}</div><span class="ms-sp"></span>
  <input id="ms-q" class="ms-in" type="search" placeholder="ابحث باسم الحملة" value="${E(S.q || "")}" aria-label="بحث في الحملات">
  <div class="ms-seg sm">${[["cards", "بطاقات"], ["rows", "جدول"], ["tl", "زمني"]].map(x => `<button type="button" class="${S.lay === x[0] ? "on" : ""}" data-mkq="lay" data-mkv="${x[0]}">${x[1]}</button>`).join("")}</div></div>`;
  if (!all.length) return empty("لا حملات بعد", A.role.mgr ? "أنشئ أول حملة: الهدف، المدة، الميزانية، والفريق." : "عند إضافتك لفريق حملة ستظهر هنا.", A.role.mgr ? btn("new", "＋ حملة جديدة", {c: "p"}) : "");
  if (!L.length) return bar + empty("لا حملات بهذا الفلتر", "");
  if (S.lay === "tl") return bar + timeline(A, L);
  if (S.lay === "rows") return bar + `<div class="ms-tw"><table class="ms-tb"><thead><tr><th>الحملة</th><th>الحالة</th><th>الصحة</th><th>المدة</th><th>المهام</th>${A.role.all ? "<th>الميزانية</th><th>المصروف</th>" : ""}<th>الفريق</th></tr></thead><tbody>${L.map(c => { const ts = tkStat(A.M, c.id, A.t), s = A.role.all ? spend(A.M, c.id) : null;
    return `<tr data-mkq="open" data-mki="${E(c.id)}" tabindex="0" role="button"><td data-l="الحملة"><b data-notr>${E(c.n)}</b></td><td data-l="الحالة">${pill(c.st, CST[c.st] || "")}</td><td data-l="الصحة">${hpill(health(A.M, c, A.t))}</td><td data-l="المدة"><bdi dir="ltr">${E(dm(c.from))} ← ${E(dm(c.to))}</bdi></td><td data-l="المهام">${ts.done}/${ts.n}${ts.od ? ` <span class="ms-ch r">${ts.od} متأخرة</span>` : ""}</td>${s ? `<td class="n" data-l="الميزانية">${money(c.bud)}</td><td class="n" data-l="المصروف">${money(s.tot)} <small>${pct(s.tot, N(c.bud))}%</small></td>` : ""}<td data-l="الفريق">${avs(A, Array.isArray(c.tm) ? c.tm : [], 4)}</td></tr>` }).join("")}</tbody></table></div>`;
  return bar + `<div class="ms-g">${L.map(c => campCard(A, c)).join("")}</div>`;
}

// 👥 الفريق
function teamPage(A) {
  const act = camps(A).filter(c => c.st === "live" || c.st === "plan").map(c => c.id), W = workload(A.M, act, A.t), S = A.S;
  if (!W.length) return empty("لا مهام في الحملات النشطة", "عند إسناد المهام ستظهر هنا متابعة كل عضو في الفريق.");
  const tot = W.reduce((a, p) => ({open: a.open + p.open, od: a.od + p.od, rev: a.rev + p.rev, done: a.done + p.done, n: a.n + p.n}), {open: 0, od: 0, rev: 0, done: 0, n: 0}), mx = Math.max.apply(null, W.map(p => p.n).concat([1]));
  const dl = []; for (let i = 0; i < 14; i++) dl.push(addD(A.t, i));
  return `<div class="ms-tl"><div><small>أعضاء لهم مهام</small><b>${W.length}</b><em>في ${act.length} حملة نشطة</em></div><div><small>مهام مفتوحة</small><b>${tot.open}</b><em>من ${tot.n}</em></div><div class="${tot.od ? "r" : "k"}"><small>متأخرة عن موعدها</small><b>${tot.od}</b><em>${tot.od ? "تحتاج متابعة" : "لا تأخير"}</em></div><div class="${tot.rev ? "wn" : ""}"><small>بانتظار الاعتماد</small><b>${tot.rev}</b><em>أعمال أُرسلت</em></div></div>
  <section class="ms-bx"><h3>👥 حِمل العمل <small>الأكثر تأخراً أولاً · اضغط على أي شخص لعرض مهامه</small></h3>
  <div class="ms-lg2"><span><i class="todo"></i>لم تبدأ</span><span><i class="doing"></i>قيد التنفيذ</span><span><i class="rev"></i>بانتظار الاعتماد</span><span><i class="done"></i>منتهية</span><span class="ms-sp"></span><span>المربعات: مواعيد الـ14 يوماً القادمة</span></div>
  ${W.map(p => { const on = S.tm === p.e, seg = k => p[k] ? `<i class="${k}" style="flex:${p[k]}" title="${TST[k]}: ${p[k]}"></i>` : "";
    return `<div class="ms-wl${on ? " on" : ""}"><button type="button" class="wh" data-mkq="tm" data-mki="${E(p.e)}" aria-expanded="${on}">${av(A, p.e, "big")}<span class="nm"><b data-notr>${E(nameOf(A, p.e))}</b><small>${p.open} مفتوحة${p.od ? ` · <em class="r">${p.od} متأخرة</em>` : ""}${p.rev ? ` · ${p.rev} للاعتماد` : ""}${p.next ? " · الموعد القادم " + E(dm(p.next)) : ""}</small></span>
    <span class="wb" style="width:${Math.max(18, Math.round(p.n / mx * 100))}%">${seg("todo")}${seg("doing")}${seg("rev")}${seg("done")}</span>
    <span class="ht" aria-hidden="true">${p.week.map((n, i) => `<i class="h${Math.min(3, n)}" title="${E(dm(dl[i]))}: ${n}"></i>`).join("")}</span><b class="pc">${pct(p.done, p.n)}%</b></button>
    ${on ? `<div class="bd">${p.L.filter(x => x.st !== "done").sort((a, b) => String(a.du || "9").localeCompare(String(b.du || "9"))).map(x => tRow(A, x, {who: false})).join("") || `<p class="ms-mu">لا مهام مفتوحة.</p>`}</div>` : ""}</div>` }).join("")}</section>`;
}

// ✅ الاعتمادات
function apprPage(A) {
  const q = queue(A.M, A.role, A.me, A.t), lane = (k, t, sub) => { const L = q.filter(x => x.k === k); return `<section class="ms-bx ms-ln"><h3>${t} <small>${L.length}</small></h3><p class="ms-mu">${sub}</p>${L.length ? `<div class="ms-ql">${L.map(it => qItem(A, it)).join("")}</div>` : `<div class="ms-ok0">✓ لا شيء بانتظارك</div>`}</section>` };
  return `<div class="ms-3">${A.role.mgr ? lane("rev", "📥 محتوى وأعمال للاعتماد", "افتح العمل لترى المرفقات، ثم اعتمده أو أعده بملاحظة.") + lane("deal", "🤝 اتفاقات مؤثرين", "بعد اعتمادك يصل الاتفاق للمالية للتحويل.") : ""}${A.role.fin ? lane("pay", "💸 تحويلات مطلوبة", "اتفاقات معتمدة تنتظر التحويل وتسجيل المرجع.") : ""}</div>`;
}

// ---------- 🤝 (v272) الجهات والتحويلات ----------
const tyOf = (A, d) => { const r = d.pid ? A.M.P.get(d.pid) : null; return (r && r.ty) || d.ty || "p" };
const tyChip = (A, d) => { const t = tyOf(A, d); return `<span class="ms-ty ${t}">${t === "c" ? "🏢" : "⭐"} ${PTY[t]}</span>` };
const stampTxt = (A, s, verb) => s ? `${verb} <b data-notr>${E(s.n || "")}</b> · ${ago(s.at, A.now)}` : "";
// ملخّص الجهة: كم حُوّل لها، في كم تحويل، وكم الباقي
function partyLine(p) { if (!p.nPaid) return `لم يُحوَّل له من قبل · الباقي <b class="${p.wait ? "wn" : "k"}">${money(p.wait)}</b> ريال`; return `حُوّل له <b>${money(p.paid)}</b> ريال في <b>${p.nPaid}</b> ${p.nPaid === 1 ? "تحويل" : "تحويلات"} · الباقي <b class="${p.wait ? "wn" : "k"}">${money(p.wait)}</b> ريال` }
function partyBox(A, d) {
  const p = parties(A.M).get(dealKey(d)); if (!p || (p.L.length < 2 && !p.paid && !p.wait)) return "";
  return `<div class="ms-pb"><div class="h"><b>${p.ty === "c" ? "🏢" : "⭐"} سجل هذه الجهة</b><small>${p.L.length} ${p.L.length === 1 ? "اتفاق" : "اتفاقات"}</small></div><p>${partyLine(p)}</p>${p.pend ? `<small>وبانتظار الاعتماد ${money(p.pend)} ريال</small>` : ""}</div>`;
}
function payRow(A, d, P) {
  const p = P.get(dealKey(d)), paid = d.st === "paid", fin = A.role.fin && !A.role.ro;
  return `<article class="ms-py ${paid ? "paid" : "wait"}" data-mkq="dopen" data-mki="${E(d.id)}" tabindex="0" role="button">
  <div class="st">${paid ? `<b>✔ تم السداد</b><small>${ago(d.pd && d.pd.at, A.now)}</small>` : `<b>⏳ بانتظار التحويل</b><small>${ago(d.ap && d.ap.at, A.now)}</small>`}</div>
  <div class="nm"><b data-notr>${E(d.n)}</b><span>${tyChip(A, d)}<span class="ms-ws" style="--wc:#c06c95">${E(lab(PF, d.pf))}</span></span><small><span data-notr>${E(cname(A, d.c))}</span> · ${paid ? `حوّله <span data-notr>${E(d.pd && d.pd.n || "")}</span>${d.pd && d.pd.ref ? ` · المرجع <bdi dir="ltr" data-notr>${E(d.pd.ref)}</bdi>` : ""}` : `اعتمده <span data-notr>${E(d.ap && d.ap.n || "")}</span>`}</small></div>
  <div class="amo"><b>${money(d.amt)}</b><small>ريال</small></div>
  <div class="pl">${p ? partyLine(p) : ""}</div>
  <div class="ac">${!paid && fin ? btn("pay", "💸 سدّد الآن", {c: "p", i: d.id}) : ""}</div></article>`;
}
function payPage(A) {
  const S = A.S, P = parties(A.M), all = vals(A.M.D).filter(d => d.st === "ok" || d.st === "paid"), raw = String(S.pq || "").trim(), q = normName(raw), dig = raw.replace(/[٠-٩]/g, x => "٠١٢٣٤٥٦٧٨٩".indexOf(x)).replace(/[^0-9]/g, "");
  const hit = d => !q || normName(d.n).indexOf(q) >= 0 || normName(cname(A, d.c)).indexOf(q) >= 0 || normName(d.pd && d.pd.ref).indexOf(q) >= 0 || (dig.length >= 2 && String(Math.round(N(d.amt))).indexOf(dig) >= 0);
  const F = [["all", "الكل", () => true], ["wait", "بانتظار التحويل", d => d.st === "ok"], ["paid", "تم السداد", d => d.st === "paid"], ["p", "المشاهير", d => tyOf(A, d) === "p"], ["c", "شركات الدعاية", d => tyOf(A, d) === "c"]], f = F.find(x => x[0] === S.pf) || F[0];
  const L = all.filter(f[2]).filter(hit).sort((a, b) => (a.st === "ok" ? 0 : 1) - (b.st === "ok" ? 0 : 1) || (a.st === "ok" ? N(a.ap && a.ap.at) - N(b.ap && b.ap.at) : N(b.pd && b.pd.at) - N(a.pd && a.pd.at)));
  const w = all.filter(d => d.st === "ok"), pd = all.filter(d => d.st === "paid"), sum = X => X.reduce((a, d) => a + N(d.amt), 0), nP = new Set(all.map(dealKey)).size;
  const tiles = `<div class="ms-tl"><div class="${w.length ? "wn hot" : "k"}"><small>بانتظار التحويل</small><b>${w.length}</b><em>${money(sum(w))} ريال</em></div><div class="k"><small>تم سداده</small><b>${money(sum(pd))}</b><em>ريال في ${pd.length} ${pd.length === 1 ? "تحويل" : "تحويلات"}</em></div><div><small>إجمالي المعتمد</small><b>${money(sum(all))}</b><em>ريال</em></div><div><small>مشاهير وشركات دعاية</small><b>${nP}</b><em>جهة تعاملنا معها</em></div></div>`;
  const bar = `<div class="ms-fb"><input id="ms-pq" class="ms-in big" type="search" placeholder="ابحث باسم المشهور أو شركة الدعاية أو المبلغ أو رقم المرجع" value="${E(S.pq || "")}" aria-label="بحث في التحويلات"><div class="ms-seg">${F.map(x => { const n = all.filter(x[2]).length; return `<button type="button" class="${f[0] === x[0] ? "on" : ""}" data-mkq="pf" data-mkf="${x[0]}">${x[1]}${n ? ` <i>${n}</i>` : ""}</button>` }).join("")}</div><span class="ms-sp"></span>
  <div class="ms-seg sm">${[["deals", "التحويلات"], ["parties", "حسب الجهة"]].map(x => `<button type="button" class="${(S.pv || "deals") === x[0] ? "on" : ""}" data-mkq="pvw" data-mkv="${x[0]}">${x[1]}</button>`).join("")}</div></div>`;
  if (!all.length) return tiles + empty("لا تعميدات بعد", "عند اعتماد مدير التسويق لاتفاق مع مشهور أو شركة دعاية يظهر هنا للمالية.");
  if (S.pv === "parties") {
    const keys = new Set(L.map(dealKey)), PL = Array.from(P.values()).filter(p => keys.has(p.k)).sort((a, b) => b.wait - a.wait || b.paid - a.paid);
    return tiles + bar + (PL.length ? `<div class="ms-tw"><table class="ms-tb ms-ptb"><thead><tr><th>الجهة</th><th>النوع</th><th>الاتفاقات</th><th>المعتمد</th><th>حُوّل له</th><th>عدد التحويلات</th><th>الباقي</th><th>الحالة</th></tr></thead><tbody>${PL.map(p => `<tr data-mkq="pone" data-mkv="${E(p.n)}" tabindex="0" role="button"><td data-l="الجهة"><b data-notr>${E(p.n)}</b></td><td data-l="النوع"><span class="ms-ty ${p.ty}">${PTY[p.ty]}</span></td><td class="n" data-l="الاتفاقات">${p.L.length}</td><td class="n" data-l="المعتمد">${money(p.tot)}</td><td class="n" data-l="حُوّل له">${money(p.paid)}</td><td class="n" data-l="عدد التحويلات">${p.nPaid}</td><td class="n ${p.wait ? "due" : ""}" data-l="الباقي">${money(p.wait)}</td><td data-l="الحالة">${p.wait ? `<span class="ms-pl pend">باقٍ له</span>` : p.paid ? `<span class="ms-pl paid">✔ مسدَّد بالكامل</span>` : "—"}</td></tr>`).join("")}</tbody></table></div><p class="ms-mu">اضغط على أي جهة لعرض تحويلاتها.</p>` : empty("لا نتائج", "جرّب كلمة أخرى أو فلتراً آخر."));
  }
  return tiles + bar + (L.length ? `<div class="ms-pyl">${L.map(d => payRow(A, d, P)).join("")}</div>` : empty("لا نتائج", "جرّب كلمة أخرى أو فلتراً آخر."));
}

// ---------- 🤝 (v274) قائمة المؤثرين + مهمة مربوطة بمؤثر ----------
const partyOf = (A, pid) => A.M.P.get(pid) || {n: "مؤثر", ty: "p"};
const dealOfTask = (A, tid) => vals(A.M.D).filter(d => d.tk === tid).sort((a, b) => N(b.ts) - N(a.ts))[0] || null;
function taskParty(A, x, deal) {
  const p = partyOf(A, x.pid), st = parties(A.M).get(x.pid);
  return `<div class="ms-tp"><div class="h"><span class="ms-ty ${p.ty}">${p.ty === "c" ? "🏢" : "⭐"} ${PTY[p.ty]}</span><b data-notr>${E(p.n)}</b>${p.h ? `<bdi dir="ltr" class="ms-mu" data-notr>${E(p.h)}</bdi>` : ""}</div>
  ${deal ? `<p>الاتفاق: <b>${money(deal.amt)}</b> ريال · ${pill(deal.st, DST[deal.st] || "")}</p>` : `<p>لم يُسجَّل الاتفاق بعد. بعد الاتفاق مع ${p.ty === "c" ? "الشركة" : "المشهور"} سجّل المبلغ والآيبان من هنا، فيصل لمدير التسويق للاعتماد ثم للمالية للتحويل.</p>`}
  ${st && (st.nPaid || st.L.length > (deal ? 1 : 0)) ? `<small>${partyLine(st)}</small>` : ""}</div>`;
}
function infPage(A) {
  const S = A.S, St = parties(A.M), seen = new Set(), L = [];
  A.M.P.forEach((p, id) => { seen.add(id); const st = St.get(id); L.push({id, n: p.n, ty: p.ty || "p", pf: p.pf, h: p.h, ph: p.ph, by: p.by, st, reg: true}) });
  St.forEach((st, k) => { if (!seen.has(k)) L.push({id: "", n: st.n, ty: st.ty, st, reg: false}) });// اتفاقات قديمة بلا تسجيل
  const q = normName(S.iq), F = [["all", "الكل", () => true], ["p", "المشاهير", p => p.ty === "p"], ["c", "شركات الدعاية", p => p.ty === "c"], ["due", "لهم مبالغ باقية", p => p.st && p.st.wait > 0]], f = F.find(x => x[0] === S.if) || F[0];
  const V = L.filter(f[2]).filter(p => !q || normName(p.n).indexOf(q) >= 0 || normName(p.h).indexOf(q) >= 0).sort((a, b) => (b.st ? b.st.wait : 0) - (a.st ? a.st.wait : 0) || String(a.n).localeCompare(String(b.n), "ar"));
  const sum = k => L.reduce((a, p) => a + (p.st ? p.st[k] : 0), 0), canAdd = !A.role.ro && (A.role.mgr || A.role.team);
  const tiles = `<div class="ms-tl"><div><small>المؤثرون المسجّلون</small><b>${L.length}</b><em>${L.filter(p => p.ty === "p").length} مشهور · ${L.filter(p => p.ty === "c").length} شركة دعاية</em></div><div class="k"><small>حُوّل لهم</small><b>${money(sum("paid"))}</b><em>ريال</em></div><div class="${sum("wait") ? "wn" : ""}"><small>باقٍ لهم</small><b>${money(sum("wait"))}</b><em>ريال بانتظار التحويل</em></div><div><small>بانتظار الاعتماد</small><b>${money(sum("pend"))}</b><em>ريال</em></div></div>`;
  const bar = `<div class="ms-fb"><input id="ms-iq" class="ms-in big" type="search" placeholder="ابحث باسم المشهور أو شركة الدعاية أو الحساب" value="${E(S.iq || "")}" aria-label="بحث في المؤثرين"><div class="ms-seg">${F.map(x => { const n = L.filter(x[2]).length; return `<button type="button" class="${f[0] === x[0] ? "on" : ""}" data-mkq="iff" data-mkf="${x[0]}">${x[1]}${n ? ` <i>${n}</i>` : ""}</button>` }).join("")}</div><span class="ms-sp"></span>${canAdd ? btn("padd", "＋ إضافة مؤثر", {c: "p"}) : ""}</div>`;
  if (!L.length) return tiles + empty("لا مؤثرين مسجّلين بعد", "أضف المشاهير وشركات الدعاية التي تتعاملون معها مرة واحدة، ثم اخترهم في أي حملة.", canAdd ? btn("padd", "＋ إضافة مؤثر", {c: "p"}) : "");
  return tiles + bar + (V.length ? `<div class="ms-il">${V.map(p => { const st = p.st, camps = st ? Array.from(new Set(st.L.map(d => cname(A, d.c)))) : [], own = p.reg && !A.role.ro && (A.role.mgr || (p.by && p.by.e === A.me));
    return `<article class="ms-ic${st && st.wait ? " due" : ""}"><header><span class="ms-ty ${p.ty}">${p.ty === "c" ? "🏢" : "⭐"} ${PTY[p.ty]}</span><span class="ms-sp"></span>${own ? `<button type="button" class="ms-ib" data-mkq="pedit" data-mki="${E(p.id)}" aria-label="تعديل بيانات المؤثر" title="تعديل">✏️</button>` : ""}</header>
    <b data-notr>${E(p.n)}</b><small>${p.pf ? E(lab(PF, p.pf)) : ""}${p.h ? ` · <bdi dir="ltr" data-notr>${E(p.h)}</bdi>` : ""}${p.ph ? ` · <bdi dir="ltr" data-notr>${E(p.ph)}</bdi>` : ""}${!p.pf && !p.h && !p.ph ? (p.reg ? "—" : "من اتفاق قديم") : ""}</small>
    <div class="nums"><div><small>الاتفاقات</small><b>${st ? st.L.length : 0}</b></div><div><small>حُوّل له</small><b>${money(st ? st.paid : 0)}</b></div><div><small>التحويلات</small><b>${st ? st.nPaid : 0}</b></div><div class="${st && st.wait ? "wn" : ""}"><small>الباقي</small><b>${money(st ? st.wait : 0)}</b></div></div>
    <footer>${camps.length ? camps.slice(0, 3).map(c => `<span class="ms-ch" data-notr>${E(c)}</span>`).join("") + (camps.length > 3 ? `<span class="ms-ch">+${camps.length - 3}</span>` : "") : `<span class="ms-mu">لم يشارك في حملة بعد</span>`}<span class="ms-sp"></span>${st && st.L.length ? btn("pone", "عرض تحويلاته", {c: "sm", v: p.n}) : ""}</footer></article>` }).join("")}</div>` : empty("لا نتائج", "جرّب كلمة أخرى أو فلتراً آخر."));
}

// ---------- مساحة الحملة ----------
export function viewsOf(A) { return A.role.all ? [["ov", "الملخّص"], ["board", "اللوحة"], ["list", "قائمة المهام"], ["cal", "التقويم"], ["inf", "المؤثرون"], ["bud", "الميزانية"], ["res", "النتائج"]] : [["board", "اللوحة"], ["list", "قائمة المهام"], ["cal", "التقويم"], ["inf", "المؤثرون"]] }
function campPage(A, c) {
  const S = A.S, M = A.M, t = A.t, V = viewsOf(A), v = V.some(x => x[0] === S.v) ? S.v : V[0][0], ts = tkStat(M, c.id, t), h = health(M, c, t), s = A.role.all ? spend(M, c.id) : null, kp = kpP(c), tp = timeP(c, t), mg = A.role.mgr;
  const nD = dealsOf(M, c.id).length, cnt = {board: ts.n - ts.done, list: ts.n, inf: nD};
  const left = c.st === "live" ? (c.to >= t ? "باقي " + days(t, c.to) + " يوماً" : "انتهت مدتها") : c.st === "plan" ? (c.from > t ? "تبدأ بعد " + days(t, c.from) + " يوماً" : "جاهزة للبدء") : "";
  const acts = mg ? `${c.st === "plan" ? btn("cst", "▶ بدء الحملة", {c: "ok", s: "live"}) : ""}${c.st === "live" ? btn("cst", "🏁 إنهاء الحملة", {s: "done"}) : ""}${c.st === "done" || c.st === "x" ? btn("cst", "↩ إعادة تفعيل", {s: "live"}) : ""}${btn("cedit", "✏️ تعديل")}${c.st === "plan" || c.st === "live" ? btn("cst", "إلغاء", {s: "x"}) : ""}${btn("cdel", "🗑", {t: "حذف الحملة"})}` : "";
  const head = `<div class="ms-ch0" style="--cc:${ccol(c)}"><div class="r1"><button type="button" class="ms-bk" data-mkq="pg" data-mkv="camps" aria-label="رجوع للحملات">›</button><h2 data-notr>${E(c.n)}</h2>${pill(c.st, CST[c.st] || "")}${hpill(h)}<span class="ms-sp"></span>${A.role.all ? btn("prn", "🖨 التقرير") : ""}${acts}</div>
  <div class="r2"><span><bdi dir="ltr">${E(dmy(c.from))} ← ${E(dmy(c.to))}</bdi>${left ? " · " + left : ""}</span>${(c.ch || []).length ? `<span class="chs">${(c.ch || []).map(x => `<i>${E(lab(CH, x))}</i>`).join("")}</span>` : ""}<span class="ms-sp"></span>${avs(A, Array.isArray(c.tm) ? c.tm : [], 8)}</div>
  ${c.gl ? `<p data-notr>${E(c.gl)}</p>` : ""}${h.why.length ? `<div class="why ${h.k}">${h.why.map(E).join(" · ")}</div>` : ""}
  <div class="ms-k4">${meter("المهام", ts.p, "k", ts.done + " / " + ts.n)}${meter("الوقت", tp, "t", tp + "%")}${s ? meter("الميزانية", pct(s.tot, N(c.bud)), barC(pct(s.tot, N(c.bud))), money(s.tot) + " / " + money(c.bud)) : ""}${kp == null ? "" : meter("الأهداف", kp, "k", kp + "%")}</div></div>
  <nav class="ms-vt" aria-label="عروض الحملة">${V.map(x => `<button type="button" class="${v === x[0] ? "on" : ""}" data-mkq="v" data-mkv="${x[0]}">${x[1]}${cnt[x[0]] ? `<i>${cnt[x[0]]}</i>` : ""}</button>`).join("")}</nav>`;
  const body = v === "ov" ? ovView(A, c) : v === "list" ? listView(A, c) : v === "cal" ? calView(A, c) : v === "inf" ? infView(A, c) : v === "bud" ? budView(A, c) : v === "res" ? resView(A, c) : boardView(A, c);
  return head + `<div class="ms-vw" data-v="${v}">${body}</div>`;
}
function taskFilter(A, c) {
  const S = A.S, L = tasksOf(A.M, c.id), who = Array.from(new Set(L.map(x => x.as))), F = L.filter(x => (!S.who || x.as === S.who) && (!S.wr || x.r === S.wr));
  const bar = `<div class="ms-fb">${who.length > 1 ? `<div class="ms-who" role="group" aria-label="فلتر بالمسؤول"><button type="button" class="${S.who ? "" : "on"}" data-mkq="who" data-mki="">الكل</button>${who.map(e => `<button type="button" class="${S.who === e ? "on" : ""}" data-mkq="who" data-mki="${E(e)}" title="${E(nameOf(A, e))}">${av(A, e)}<span data-notr>${E(nameOf(A, e).split(" ")[0])}</span></button>`).join("")}</div>` : ""}
  <select class="ms-in" data-mkc="wr" aria-label="فلتر بمسار العمل"><option value="">كل المسارات</option>${RL.map(r => `<option value="${r[0]}"${S.wr === r[0] ? " selected" : ""}>${r[2]}</option>`).join("")}</select><span class="ms-sp"></span>
  ${A.role.mgr && c.st !== "x" ? btn("tpl", "⚡ المهام المعتادة") + btn("tnew", "＋ مهمة", {c: "p"}) : ""}</div>`;
  return {L: F, all: L, bar};
}
// 🧱 اللوحة (سحب وإفلات)
function tCard(A, x) {
  const r = rl(x.r), cs = clStat(x), late = isLate(x, A.t), can = taskCan(x, A.role, A.me), drag = !A.role.ro && (can.edit || can.mine);
  return `<article class="ms-kc${late ? " late" : ""}${x.st === "done" ? " dn" : ""}" style="--wc:${r[3]}"${drag ? ` draggable="true" data-drag="${E(x.id)}"` : ""} data-mkq="topen" data-mki="${E(x.id)}" tabindex="0" role="button">
  <div class="k1">${ws(x.r)}${x.pid ? `<span class="ms-ty ${partyOf(A, x.pid).ty}" data-notr>🤝 ${E(partyOf(A, x.pid).n)}</span>` : ""}${N(x.pr) ? `<span class="ms-pr p${N(x.pr)}">${PRI[N(x.pr)]}</span>` : ""}${x.rq ? `<span class="ms-rq" title="يحتاج اعتماد مدير التسويق">✓ اعتماد</span>` : ""}</div>
  <b data-notr>${E(x.t)}</b>${cs.n ? `<div class="ms-bar k xs"><i style="width:${pct(cs.k, cs.n)}%"></i></div>` : ""}
  <div class="k2">${dueChip(x, A.t)}${counters(A, x)}<span class="ms-sp"></span>${av(A, x.as)}</div></article>`;
}
function boardView(A, c) {
  const f = taskFilter(A, c), mg = A.role.mgr && c.st !== "x";
  if (!f.all.length) return f.bar + empty("لا مهام بعد في هذه الحملة", mg ? "أضف المهام المعتادة بضغطة، أو أضف مهمة واحدة." : "سيضيف مدير التسويق المهام قريباً.", mg ? btn("tpl", "⚡ المهام المعتادة لحملة", {c: "p"}) : "");
  const hint = {todo: "مهام لم يبدأ العمل عليها", doing: "العمل جارٍ", rev: "أُرسلت وتنتظر اعتماد مدير التسويق", done: "أُنجزت أو اعتُمدت"};
  return f.bar + `<div class="ms-bd" role="list">${TCOL.map(k => { const L = f.L.filter(x => x.st === k).sort((a, b) => N(b.pr) - N(a.pr) || String(a.du || "9").localeCompare(String(b.du || "9")));
    return `<section class="ms-col ${k}" data-drop="${k}" role="listitem" aria-label="${TST[k]}"><header><i></i><b>${TST[k]}</b><small>${L.length}</small><span class="ms-sp"></span>${mg && k !== "done" && k !== "rev" ? `<button type="button" class="ms-ib" data-mkq="tnew" data-mks="${k}" aria-label="مهمة جديدة في ${TST[k]}" title="مهمة جديدة">＋</button>` : ""}</header>
    <div class="kl">${L.map(x => tCard(A, x)).join("") || `<p class="pho">${hint[k]}</p>`}</div></section>` }).join("")}</div>${A.role.ro ? "" : `<p class="ms-mu ms-hint">اسحب البطاقة بين الأعمدة لتغيير حالتها، أو اضغط عليها لفتح التفاصيل والتعليقات والمرفقات.</p>`}`;
}
// 📋 القائمة
function listView(A, c) {
  const f = taskFilter(A, c); if (!f.all.length) return boardView(A, c);
  return f.bar + RL.map(r => { const L = f.L.filter(x => x.r === r[0]).sort((a, b) => TCOL.indexOf(a.st) - TCOL.indexOf(b.st) || String(a.du || "9").localeCompare(String(b.du || "9"))); if (!L.length) return "";
    const dn = L.filter(x => x.st === "done").length; return `<section class="ms-bx ms-lv" style="--wc:${r[3]}"><h3>${r[1]} ${r[2]} <small>${dn}/${L.length}</small><span class="ms-sp"></span><div class="ms-bar k xs" style="width:120px"><i style="width:${pct(dn, L.length)}%"></i></div></h3>${L.map(x => tRow(A, x, {camp: false})).join("")}</section>` }).join("") || empty("لا مهام بهذا الفلتر", "");
}
// 🗓 التقويم
function calView(A, c) {
  const S = A.S, t = A.t, ym = /^\d{4}-\d{2}$/.test(S.cm || "") ? S.cm : (t >= c.from && t <= c.to ? t : c.from).slice(0, 7), W = monthGrid(ym), L = tasksOf(A.M, c.id), DL = dealsOf(A.M, c.id).filter(d => d.dt && d.st !== "x" && d.st !== "no"), mg = A.role.mgr && c.st !== "x";
  const byDay = {}; L.forEach(x => { if (x.du) (byDay[x.du] = byDay[x.du] || []).push(x) }); const dByDay = {}; DL.forEach(d => { (dByDay[d.dt] = dByDay[d.dt] || []).push(d) });
  const noDate = L.filter(x => !x.du && x.st !== "done").length;
  return `<div class="ms-fb"><div class="ms-cn"><button type="button" class="ms-ib" data-mkq="cal" data-mkv="-1" aria-label="الشهر السابق">›</button><b>${MONTHS[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</b><button type="button" class="ms-ib" data-mkq="cal" data-mkv="1" aria-label="الشهر التالي">‹</button>${btn("cal", "اليوم", {c: "sm", v: "0"})}</div><span class="ms-sp"></span>${noDate ? `<span class="ms-mu">${noDate} مهمة بلا موعد (تظهر في اللوحة)</span>` : ""}${mg ? btn("tnew", "＋ مهمة", {c: "p"}) : ""}</div>
  <div class="ms-cal"><div class="wd">${WDAYS.map(d => `<span>${d}</span>`).join("")}</div>${W.map(w => `<div class="wk">${w.map(d => { const inC = d.d >= c.from && d.d <= c.to, items = (byDay[d.d] || []), ds = (dByDay[d.d] || []);
    return `<div class="dy${d.in ? "" : " out"}${d.d === t ? " now" : ""}${inC ? " in" : ""}"${mg ? ` data-mkq="tnew" data-mkv="${d.d}"` : ""}><span class="n">${+d.d.slice(8)}${d.d === c.from ? `<em>▶ البداية</em>` : d.d === c.to ? `<em>🏁 النهاية</em>` : ""}</span>
    ${items.slice(0, 4).map(x => `<button type="button" class="ev${x.st === "done" ? " dn" : ""}${isLate(x, t) ? " late" : ""}" style="--wc:${rl(x.r)[3]}" data-mkq="topen" data-mki="${E(x.id)}" title="${E(x.t)} · ${E(nameOf(A, x.as))}"><span data-notr>${E(x.t)}</span></button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4}</small>` : ""}
    ${ds.map(d2 => `<button type="button" class="ev inf" data-mkq="dopen" data-mki="${E(d2.id)}" title="نشر المؤثر"><span data-notr>🤝 ${E(d2.n)}</span></button>`).join("")}</div>` }).join("")}</div>`).join("")}</div>`;
}
// 🤝 المؤثرون (مراحل)
function dCard(A, d) {
  return `<article class="ms-kc inf ${d.st}" data-mkq="dopen" data-mki="${E(d.id)}" tabindex="0" role="button"><div class="k1">${tyChip(A, d)}<span class="ms-ws" style="--wc:#c06c95">${E(lab(PF, d.pf))}</span>${d.h ? `<bdi dir="ltr" class="ms-mu" data-notr>${E(d.h)}</bdi>` : ""}</div>
  <b data-notr>${E(d.n)}</b><div class="amt">${money(d.amt)} <small>ريال</small></div>${d.st === "paid" ? `<div class="ms-paid sm">✔ تم السداد</div>` : ""}<small class="dl" data-notr>${E(d.dl)}</small>
  <div class="k2">${d.dt ? `<span class="ms-du">موعد النشر ${E(dm(d.dt))}</span>` : ""}${counters(A, d)}${d.rs && N(d.rs.v) ? `<span class="ms-ct ok">👁 ${big(d.rs.v)}</span>` : ""}<span class="ms-sp"></span>${d.by ? av(A, d.by.e) : ""}</div></article>`;
}
function infView(A, c) {
  const L = dealsOf(A.M, c.id), canAdd = !A.role.ro && c.st !== "x" && (A.role.mgr || A.role.team || (Array.isArray(c.tm) && c.tm.indexOf(A.me) >= 0));
  const bar = `<div class="ms-fb"><span class="ms-mu">${A.role.all ? "الاتفاق يمر بثلاث مراحل: يسجّله الموظف بالآيبان ← يعتمده مدير التسويق ← تحوّل المالية وتسجّل المرجع." : "تظهر هنا الاتفاقات التي سجّلتَها."}</span><span class="ms-sp"></span>${canAdd ? btn("dnew", "＋ اتفاق مع مؤثر", {c: "p"}) : ""}</div>`;
  if (!L.length) return bar + empty("لا اتفاقات مع مؤثرين بعد", canAdd ? "سجّل الاتفاق والآيبان ليصل لمدير التسويق للاعتماد." : "");
  const cols = [["pend", "بانتظار الاعتماد", d => d.st === "pend"], ["ok", "معتمد · بانتظار التحويل", d => d.st === "ok"], ["paid", "تم التحويل", d => d.st === "paid"], ["off", "مرفوض أو ملغى", d => d.st === "no" || d.st === "x"]];
  return bar + `<div class="ms-bd inf">${cols.map(k => { const Lk = L.filter(k[2]), sum = Lk.reduce((a, d) => a + N(d.amt), 0); if (k[0] === "off" && !Lk.length) return "";
    return `<section class="ms-col ${k[0] === "off" ? "cls" : k[0]}"><header><i></i><b>${k[1]}</b><small>${Lk.length}</small><span class="ms-sp"></span><em>${sum ? money(sum) : ""}</em></header><div class="kl">${Lk.map(d => dCard(A, d)).join("") || `<p class="pho">لا شيء هنا</p>`}</div></section>` }).join("")}</div>`;
}
// 💰 الميزانية
function budView(A, c) {
  const M = A.M, s = spend(M, c.id), bud = N(c.bud), up = pct(s.tot, bud), tp = timeP(c, A.t), ts = tkStat(M, c.id, A.t), can = !A.role.ro && (A.role.mgr || A.role.team), L = exOf(M, c.id).sort((a, b) => String(b.dt).localeCompare(String(a.dt)));
  const parts = XK.map(k => ({c: k[2], v: s.by[k[0]], l: k[1]})), inf = dealsOf(M, c.id).filter(d => d.st === "ok" || d.st === "paid");
  return `<div class="ms-tl"><div><small>الميزانية</small><b>${money(bud)}</b><em>ريال</em></div><div class="${up > 100 ? "r" : up >= 85 ? "wn" : ""}"><small>المصروف</small><b>${money(s.tot)}</b><em>${up}% من الميزانية</em></div><div class="${s.wait ? "wn" : ""}"><small>معتمد لم يُحوَّل</small><b>${money(s.wait)}</b><em>عند المالية</em></div><div class="${bud - s.tot < 0 ? "r" : "k"}"><small>المتبقي</small><b>${money(bud - s.tot)}</b><em>${s.pend ? "واتفاقات معلّقة " + money(s.pend) : "ريال"}</em></div></div>
  <div class="ms-2"><section class="ms-bx"><h3>أين ذهب المصروف</h3><div class="ms-bud">${donut(parts, 150, 20, `<b>${up}%</b><small>من الميزانية</small>`)}<div class="ms-lg">${parts.filter(p => p.v > 0).map(p => `<div><i style="background:${p.c}"></i><span>${p.l}</span><b>${money(p.v)}</b></div>`).join("") || `<span class="ms-mu">لا مصروف بعد</span>`}</div></div></section>
  <section class="ms-bx"><h3>الصرف مقابل الوقت والإنجاز</h3><div class="ms-pace">${meter("الميزانية", up, barC(up), up + "%")}${meter("الوقت", tp, "t", tp + "%")}${meter("المهام", ts.p, "k", ts.p + "%")}</div><p class="ms-mu">المصروف = اتفاقات المؤثرين المعتمدة (حتى قبل التحويل) + المصروفات المسجّلة.</p></section></div>
  <section class="ms-bx"><h3>المصروفات <small>${L.length + inf.length}</small><span class="ms-sp"></span>${btn("csv", "⬇️ إكسل", {c: "sm"})}${can && c.st !== "x" ? btn("xnew", "＋ مصروف", {c: "p sm"}) : ""}</h3>
  ${L.length || inf.length ? `<div class="ms-tw"><table class="ms-tb"><thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th>المبلغ</th><th>سجّله</th><th></th></tr></thead><tbody>
  ${inf.map(d => `<tr data-mkq="dopen" data-mki="${E(d.id)}" tabindex="0" role="button"><td data-l="التاريخ">${E(dmy(d.dt)) || "—"}</td><td data-l="البند">المؤثرون</td><td data-l="البيان"><span data-notr>${E(d.n)}</span> · ${E(DST[d.st] || "")}</td><td class="n" data-l="المبلغ">${money(d.amt)}</td><td data-l="سجّله" data-notr>${E(d.by && d.by.n || "")}</td><td></td></tr>`).join("")}
  ${L.map(x => { const own = A.role.mgr || (x.by && x.by.e === A.me); return `<tr><td data-l="التاريخ">${E(dmy(x.dt))}</td><td data-l="البند">${E(lab(XK, x.k))}</td><td data-l="البيان" data-notr>${E(x.nt || "")}</td><td class="n" data-l="المبلغ">${money(x.a)}</td><td data-l="سجّله" data-notr>${E(x.by && x.by.n || "")}</td><td>${can && own ? btn("xedit", "✏️", {c: "sm", i: x.id, t: "تعديل"}) + btn("xdel", "🗑", {c: "sm", i: x.id, t: "حذف"}) : ""}</td></tr>` }).join("")}</tbody></table></div>` : `<p class="ms-mu">لا مصروفات مسجّلة.</p>`}</section>`;
}
function kpList(A, c) { const kps = kpOf(c); return kps.length ? `<div class="ms-kp">${kps.map(k => { const p = pct(N(k.v), N(k.t)); return `<div class="k"><span>${E(kpName(k))}</span><b>${big(k.v)} <small>من ${big(k.t)}</small></b><div class="ms-bar ${p >= 100 ? "k" : ""}"><i style="width:${Math.min(100, p)}%"></i></div><small>${p}%</small></div>` }).join("")}</div>` : `<p class="ms-mu">لم تُحدَّد أهداف بالأرقام لهذه الحملة.</p>` }
const insBox = (A, c, n) => `<div class="ms-ins">${insights(A.M, c, A.t).slice(0, n || 99).map(x => `<div class="${x[0]}">${E(x[1])}</div>`).join("")}</div>`;
// 📈 النتائج
function resView(A, c) {
  const can = !A.role.ro && (A.role.mgr || A.role.team), L = dealsOf(A.M, c.id).filter(d => d.st === "ok" || d.st === "paid");
  return `<div class="ms-2"><section class="ms-bx"><h3>الأهداف مقابل المتحقق<span class="ms-sp"></span>${can && kpOf(c).length ? btn("kpe", "📈 تحديث النتائج", {c: "p sm"}) : ""}</h3>${kpList(A, c)}</section><section class="ms-bx"><h3>💡 قراءة ذكية</h3>${insBox(A, c)}</section></div>
  ${L.length ? `<section class="ms-bx"><h3>أداء المؤثرين</h3><div class="ms-tw"><table class="ms-tb"><thead><tr><th>المؤثر</th><th>المبلغ</th><th>المشاهدات</th><th>التفاعلات</th><th>مبيعات منسوبة</th><th>ريال / 1000 مشاهدة</th><th></th></tr></thead><tbody>${L.map(d => { const r = d.rs || {}; return `<tr data-mkq="dopen" data-mki="${E(d.id)}" tabindex="0" role="button"><td data-l="المؤثر" data-notr><b>${E(d.n)}</b></td><td class="n" data-l="المبلغ">${money(d.amt)}</td><td class="n" data-l="المشاهدات">${r.v ? money(r.v) : "—"}</td><td class="n" data-l="التفاعلات">${r.e ? money(r.e) : "—"}</td><td class="n" data-l="مبيعات منسوبة">${r.sl ? money(r.sl) : "—"}</td><td class="n" data-l="ريال / 1000 مشاهدة">${N(r.v) ? (N(d.amt) / N(r.v) * 1000).toFixed(1) : "—"}</td><td>${can ? btn("dres", "📊 النتائج", {c: "sm", i: d.id}) : ""}</td></tr>` }).join("")}</tbody></table></div></section>` : ""}`;
}
// 🧭 الملخّص
function ovView(A, c) {
  const M = A.M, t = A.t, L = tasksOf(M, c.id), ts = tkStat(M, c.id, t), up = L.filter(x => x.st !== "done" && x.du).sort((a, b) => String(a.du).localeCompare(String(b.du))).slice(0, 6);
  const seg = k => ts[k] ? `<i class="${k}" style="flex:${ts[k]}" title="${TST[k]}: ${ts[k]}"></i>` : "";
  const streams = RL.map(r => { const Lr = L.filter(x => x.r === r[0]); if (!Lr.length) return ""; const dn = Lr.filter(x => x.st === "done").length, od = Lr.filter(x => isLate(x, t)).length, who = Array.from(new Set(Lr.map(x => x.as)));
    return `<div class="ms-st" style="--wc:${r[3]}"><span class="nm">${r[1]} ${r[2]}</span>${avs(A, who, 3)}<div class="ms-bar k"><i style="width:${pct(dn, Lr.length)}%"></i></div><b>${dn}/${Lr.length}</b>${od ? `<span class="ms-ch r">${od} متأخرة</span>` : ""}</div>` }).join("");
  return `<div class="ms-2"><div>
  <section class="ms-bx"><h3>سير العمل <small>${ts.n} مهمة</small></h3>${ts.n ? `<div class="ms-sbar">${seg("todo")}${seg("doing")}${seg("rev")}${seg("done")}</div><div class="ms-lg2"><span><i class="todo"></i>لم تبدأ ${ts.todo}</span><span><i class="doing"></i>قيد التنفيذ ${ts.doing}</span><span><i class="rev"></i>بانتظار الاعتماد ${ts.rev}</span><span><i class="done"></i>منتهية ${ts.done}</span></div><div class="ms-sts">${streams}</div>` : `<p class="ms-mu">لا مهام بعد. افتح «اللوحة» لإضافتها.</p>`}</section>
  <section class="ms-bx"><h3>🗓 المواعيد القادمة</h3>${up.length ? up.map(x => tRow(A, x, {camp: false, quick: false})).join("") : `<p class="ms-mu">لا مواعيد قادمة.</p>`}</section>
  <section class="ms-bx"><h3>الأهداف مقابل المتحقق</h3>${kpList(A, c)}</section></div><div>
  <section class="ms-bx"><h3>💡 قراءة ذكية</h3>${insBox(A, c, 6)}</section>
  <section class="ms-bx"><h3>🕒 نشاط الحملة</h3>${feedList(A, [c.id], 10)}</section>${c.nt ? `<section class="ms-bx"><h3>ملاحظات</h3><p class="ms-pre" data-notr>${E(c.nt)}</p></section>` : ""}</div></div>`;
}

// ---------- الدرج الجانبي (مهمة أو اتفاق) ----------
const stamp = (A, s, verb) => s ? `<small>${verb} <b data-notr>${E(s.n || "")}</b> · ${ago(s.at, A.now)}</small>` : "";
function attsHtml(A, can) {
  const D = A.DR, L = D.at || [];
  return `<div class="ms-at">${L.map(a => a.file || a.pdf ? `<div class="afile"><span class="ext">${E(String(a.nm || "").split(".").pop().toUpperCase().slice(0, 4) || "PDF")}</span><span class="nm" data-notr><bdi>${E(a.nm || "ملف")}</bdi></span><div class="ac"><button type="button" class="ms-b sm" data-mkq="atopen" data-mki="${a.k}">⬇️ تنزيل</button>${can ? `<button type="button" class="ms-ib" data-mkq="atdel" data-mki="${a.k}" aria-label="حذف المرفق">×</button>` : ""}</div></div>`
    : `<div class="im"><img src="${E(a.src)}" alt="" data-zoom data-zt="مرفق ${a.k - 1}">${can ? `<button type="button" class="ms-ib" data-mkq="atdel" data-mki="${a.k}" aria-label="حذف الصورة">×</button>` : ""}</div>`).join("")}
  ${D.up ? `<div class="add wait">⏳ جاري الرفع (${D.up})…</div>` : can && L.length < 9 ? `<label class="add" for="msd-file" tabindex="0" role="button"><b>＋</b>أرفق صوراً أو ملفات</label>` : ""}</div>${!D.atOk ? `<p class="ms-mu">جاري تحميل المرفقات…</p>` : !L.length && !can ? `<p class="ms-mu">لا مرفقات.</p>` : ""}`;
}
function talkHtml(A, ref) {
  const D = A.DR, L = D.cm || [];
  return `<div class="ms-seg sm msd-tabs"><button type="button" class="${D.tab !== "log" ? "on" : ""}" data-mkq="dtab" data-mkv="cm">💬 التعليقات${L.length ? ` <i>${L.length}</i>` : ""}</button><button type="button" class="${D.tab === "log" ? "on" : ""}" data-mkq="dtab" data-mkv="log">🕒 السجل</button></div>
  ${D.tab === "log" ? feedList(A, null, 40, ref) : L.length ? `<ul class="ms-cm">${L.map(m => { const mine = m.by && m.by.e === A.me; return `<li class="${mine ? "me" : ""}">${av(A, m.by && m.by.e)}<div><span class="h"><b data-notr>${E(m.by && m.by.n || "")}</b><small>${ago(m.ts, A.now)}</small>${(mine || A.role.mgr) && !A.role.ro ? `<button type="button" class="ms-ib" data-mkq="cmdel" data-mki="${E(m.id)}" aria-label="حذف التعليق">×</button>` : ""}</span><p data-notr>${E(m.t)}</p></div></li>` }).join("")}</ul>` : `<p class="ms-mu">${D.cmOk ? "لا تعليقات بعد. اكتب أول تعليق بالأسفل." : "جاري تحميل التعليقات…"}</p>`}`;
}
export function drawerHtml(A) {
  const D = A.DR; if (D.k === "t") { const x = A.M.T.get(D.id); return x ? taskDrawer(A, x) : null } if (D.k === "d") { const d = A.M.D.get(D.id); return d ? dealDrawer(A, d) : null } return null;
}
function taskDrawer(A, x) {
  const can = taskCan(x, A.role, A.me), ro = A.role.ro, cs = clStat(x), steps = x.rq ? TCOL : ["todo", "doing", "done"], cur = steps.indexOf(x.st), late = isLate(x, A.t);
  const head = `<div class="msd-top">${ws(x.r)}<span class="cn" data-notr>${E(cname(A, x.c))}</span><span class="ms-sp"></span>${can.edit && !ro ? btn("tedit", "✏️ تعديل", {c: "sm", i: x.id}) : ""}<button type="button" class="ms-ib" data-mkq="dx" aria-label="إغلاق">✕</button></div>
  <h3 data-notr>${E(x.t)}</h3><ol class="ms-stp">${steps.map((k, i) => `<li class="${i < cur ? "dn" : i === cur ? "on" : ""}"><i></i>${TST[k]}</li>`).join("")}</ol>`;
  const deal = x.pid ? dealOfTask(A, x.id) : null;
  const acts = ro ? "" : x.pid ? [can.start ? btn("tgo", "▶ ابدأ العمل", {c: "p", i: x.id, s: "start"}) : "", !deal && (can.mine || can.edit) && x.st !== "done" ? btn("tdeal", "🤝 سجّل الاتفاق والآيبان", {c: "p", i: x.id}) : "", deal ? btn("dopen", "افتح الاتفاق", {c: deal.st === "pend" && A.role.mgr ? "p" : "", i: deal.id}) : "", can.reopen && !deal ? btn("tgo", "↩ إعادة فتح", {i: x.id, s: "reopen"}) : ""].join("") : [can.approve ? btn("tgo", "✓ اعتماد العمل", {c: "ok", i: x.id, s: "approve"}) + btn("tgo", "↩ إعادة للتعديل", {i: x.id, s: "return"}) : "",
    can.start ? btn("tgo", "▶ ابدأ العمل", {c: "p", i: x.id, s: "start"}) : "", can.submit && x.st === "doing" ? btn("tgo", "📤 أرسل للاعتماد", {c: "p", i: x.id, s: "submit"}) : "",
    can.finish && x.st === "doing" ? btn("tgo", "✓ أنجزتها", {c: "ok", i: x.id, s: "finish"}) : "", can.recall ? btn("tgo", "سحب الإرسال", {i: x.id, s: "recall"}) : "", can.reopen ? btn("tgo", "↩ إعادة فتح", {i: x.id, s: "reopen"}) : ""].join("");
  const note = x.st === "rev" ? `<div class="ms-nt rev"><b>📥 بانتظار اعتماد مدير التسويق</b>${stamp(A, x.sb, "أرسله")}${N(x.rn) ? `<small>الجولة ${N(x.rn) + 1}</small>` : ""}</div>`
    : x.st === "done" && x.ok ? `<div class="ms-nt ok"><b>✅ اعتُمد العمل</b>${stamp(A, x.ok, "اعتمده")}</div>` : x.st === "done" ? `<div class="ms-nt ok"><b>✅ أُنجزت</b>${stamp(A, x.dn, "أنهاها")}</div>`
    : x.rt && x.st !== "done" && N(x.rt.at) >= N(x.sb && x.sb.at) - 1 ? `<div class="ms-nt ret"><b>↩️ أُعيد للتعديل${N(x.rn) ? " (الجولة " + N(x.rn) + ")" : ""}</b><p data-notr>${E(x.rt.note || "")}</p>${stamp(A, x.rt, "أعاده")}</div>` : "";
  const main = `${acts ? `<div class="msd-ac">${acts}</div>` : ""}${note}${x.pid ? taskParty(A, x, deal) : ""}
  <dl class="ms-meta"><div><dt>المسؤول عن المهمة</dt><dd>${av(A, x.as)}<span data-notr>${E(nameOf(A, x.as))}</span></dd></div><div><dt>الموعد</dt><dd class="${late ? "r" : ""}">${x.du ? E(dmy(x.du)) : "—"}${late ? " · متأخرة" : ""}</dd></div>
  <div><dt>البداية</dt><dd>${x.sd ? E(dmy(x.sd)) : "—"}</dd></div><div><dt>الأولوية</dt><dd><span class="ms-pr p${N(x.pr)}">${PRI[N(x.pr)]}</span></dd></div>
  <div><dt>الاعتماد</dt><dd>${x.rq ? "يحتاج اعتماد مدير التسويق" : "لا يحتاج اعتماداً"}</dd></div><div><dt>أسندها</dt><dd data-notr>${E(x.by && x.by.n || "")}</dd></div></dl>
  ${x.nt ? `<h4>الوصف</h4><p class="ms-pre" data-notr>${E(x.nt)}</p>` : ""}
  ${cs.n ? `<h4>القائمة الفرعية <small>${cs.k}/${cs.n}</small></h4><div class="ms-bar k xs"><i style="width:${pct(cs.k, cs.n)}%"></i></div><div class="ms-cl">${x.cl.map((y, i) => `<label><input type="checkbox" data-mkcl="${E(x.id)}" data-mkk="${i}"${y.k ? " checked" : ""}${(can.mine || can.edit) && !ro ? "" : " disabled"}><span data-notr>${E(y.t)}</span></label>`).join("")}</div>` : ""}
  <h4>📎 التسليمات والمرفقات <small>${(A.DR.at || []).length}</small></h4>${attsHtml(A, can.attach && !ro)}
  ${x.rs ? `<div class="ms-rs"><small>ملاحظة التسليم</small><p data-notr>${E(x.rs)}</p></div>` : ""}${(can.mine || can.edit) && !ro ? btn("trs", x.rs ? "✏️ تعديل ملاحظة التسليم" : "＋ رابط أو ملاحظة تسليم", {c: "sm", i: x.id}) : ""}
  ${talkHtml(A, "t:" + x.id)}`;
  return {head, main, talk: !ro, label: x.t};
}
function dealDrawer(A, d) {
  const ro = A.role.ro, mine = d.by && d.by.e === A.me, mg = A.role.mgr, fin = A.role.fin, ib = A.IBC.get(d.id), canIb = mg || fin || mine, steps = [["pend", "بانتظار الاعتماد"], ["ok", "بانتظار التحويل"], ["paid", "تم التحويل"]], cur = d.st === "paid" ? 2 : d.st === "ok" ? 1 : 0, off = d.st === "no" || d.st === "x";
  const head = `<div class="msd-top">${tyChip(A, d)}<span class="ms-ws" style="--wc:#c06c95">${E(lab(PF, d.pf))}</span><span class="cn" data-notr>${E(cname(A, d.c))}</span><span class="ms-sp"></span><button type="button" class="ms-ib" data-mkq="dx" aria-label="إغلاق">✕</button></div>
  <h3><span data-notr>${E(d.n)}</span>${d.h ? ` <bdi dir="ltr" class="ms-mu" data-notr>${E(d.h)}</bdi>` : ""}</h3>${off ? `<div class="ms-nt ret"><b>${d.st === "no" ? "↩️ رُفض الاتفاق" : "⛔ أُلغي الاتفاق"}</b><p data-notr>${E(d.ap && d.ap.note || "")}</p>${stamp(A, d.ap, "")}</div>` : `<ol class="ms-stp">${steps.map((k, i) => `<li class="${i < cur || d.st === "paid" ? "dn" : i === cur ? "on" : ""}"><i></i>${k[1]}</li>`).join("")}</ol>`}`;
  const acts = ro ? "" : [mg && d.st === "pend" ? btn("dok", "✓ اعتماد الاتفاق", {c: "ok", i: d.id}) + btn("dno", "رفض", {i: d.id}) : "", fin && d.st === "ok" ? btn("pay", "💸 بيانات التحويل وتسجيله", {c: "p", i: d.id}) : "",
    (mine || mg) && (d.st === "pend" || d.st === "no") ? btn("dedit", d.st === "no" ? "تصحيح وإعادة الإرسال" : "✏️ تعديل", {c: d.st === "no" ? "p" : "", i: d.id}) : "", mg && d.st === "ok" ? btn("dxl", "إلغاء الاتفاق", {i: d.id}) : "",
    (mine || mg || A.role.team) && (d.st === "ok" || d.st === "paid") ? btn("dres", "📊 نتائج المؤثر", {i: d.id}) : "", (mg && (d.st === "pend" || off)) || (mine && (d.st === "pend" || d.st === "no")) ? btn("ddel", "🗑 حذف", {i: d.id}) : ""].join("");
  const r = d.rs || {}, canAt = !ro && (mg || mine || (fin && (d.st === "ok" || d.st === "paid")));
  const main = `${d.st === "paid" ? `<div class="ms-paid"><b>✔ تم السداد</b><span>${money(d.amt)} ريال${d.pd && d.pd.ref ? ` · المرجع <bdi dir="ltr" data-notr>${E(d.pd.ref)}</bdi>` : ""}</span><small>${stampTxt(A, d.pd, "حوّله")}</small></div>` : d.st === "ok" ? `<div class="ms-wait"><b>⏳ بانتظار التحويل من المالية</b><small>${stampTxt(A, d.ap, "اعتمده")}</small></div>` : ""}${acts ? `<div class="msd-ac">${acts}</div>` : ""}
  ${partyBox(A, d)}
  <div class="ms-amt"><b>${money(d.amt)}</b><small>ريال</small>${d.fl ? `<span class="ms-mu">عدد المتابعين ${big(d.fl)}</span>` : ""}</div>
  <dl class="ms-meta"><div class="wd2"><dt>المطلوب منه</dt><dd data-notr>${E(d.dl)}</dd></div><div><dt>تاريخ النشر</dt><dd>${d.dt ? E(dmy(d.dt)) : "—"}</dd></div><div><dt>سجّله</dt><dd data-notr>${E(d.by && d.by.n || "")}</dd></div>
  ${d.ap && !off ? `<div><dt>اعتمده</dt><dd><span data-notr>${E(d.ap.n || "")}</span> · ${ago(d.ap.at, A.now)}</dd></div>` : ""}${d.pd ? `<div><dt>حوّله</dt><dd><span data-notr>${E(d.pd.n || "")}</span>${d.pd && d.pd.ref ? ` · المرجع <bdi dir="ltr" data-notr>${E(d.pd.ref)}</bdi>` : ""}</dd></div>` : ""}</dl>
  ${canIb ? `<h4>🏦 بيانات التحويل</h4>${ib ? `<div class="ms-ibx"><b class="ms-ib0">${E(ibanFmt(ib.ib))}</b><span data-notr>${E(ib.an)}${ib.bn ? " · " + E(ib.bn) : ""}</span><div>${btn("ibcp", "نسخ الآيبان", {c: "sm", v: ib.ib})}${btn("ibv", "إخفاء", {c: "sm", i: d.id})}</div></div>` : btn("ibv", "🔒 إظهار الآيبان", {c: "sm", i: d.id})}` : ""}
  ${r.v || r.e || r.sl ? `<h4>📊 النتائج</h4><div class="ms-tl sm"><div><small>المشاهدات</small><b>${big(r.v)}</b></div><div><small>التفاعلات</small><b>${big(r.e)}</b></div><div><small>مبيعات منسوبة</small><b>${money(r.sl)}</b></div><div><small>ريال / 1000 مشاهدة</small><b>${N(r.v) ? (N(d.amt) / N(r.v) * 1000).toFixed(1) : "—"}</b></div></div>${r.note ? `<p class="ms-mu" data-notr>${E(r.note)}</p>` : ""}` : ""}
  <h4>📎 العقد وإيصال التحويل <small>${(A.DR.at || []).length}</small></h4>${attsHtml(A, canAt)}
  ${talkHtml(A, "d:" + d.id)}`;
  return {head, main, talk: !ro && (mg || fin || mine || A.role.team), label: d.n};
}

// ---------- 🖨 تقرير الحملة ----------
export function reportHtml(A, c) {
  const M = A.M, s = spend(M, c.id), ts = tkStat(M, c.id, A.t), kps = kpOf(c), Ls = dealsOf(M, c.id).filter(d => d.st !== "x"), bud = N(c.bud), h = health(M, c, A.t);
  return `<h1>تقرير حملة: <span data-notr>${E(c.n)}</span></h1><p>${E(CST[c.st] || "")} · ${E(h.l)} · <bdi dir="ltr">${E(dmy(c.from))}</bdi> ← <bdi dir="ltr">${E(dmy(c.to))}</bdi> · القنوات: ${(c.ch || []).map(x => E(lab(CH, x))).join("، ") || "—"}</p>${c.gl ? `<p data-notr>الهدف: ${E(c.gl)}</p>` : ""}
  <div class="kv"><div><small>الميزانية</small><b>${money(bud)}</b></div><div><small>المصروف</small><b>${money(s.tot)} (${pct(s.tot, bud)}%)</b></div><div><small>المتبقي</small><b>${money(bud - s.tot)}</b></div><div><small>المهام المنجزة</small><b>${ts.done}/${ts.n}</b></div></div>
  <h2>الأهداف</h2>${kps.length ? `<table><tr><th>الهدف</th><th>المستهدف</th><th>المتحقق</th><th>النسبة</th></tr>${kps.map(k => `<tr><td>${E(kpName(k))}</td><td>${money(k.t)}</td><td>${money(k.v)}</td><td>${pct(N(k.v), N(k.t))}%</td></tr>`).join("")}</table>` : "<p>—</p>"}
  <h2>المصروف حسب البند</h2><table><tr><th>البند</th><th>المبلغ</th><th>النسبة</th></tr>${XK.filter(k => s.by[k[0]] > 0).map(k => `<tr><td>${E(k[1])}</td><td>${money(s.by[k[0]])}</td><td>${pct(s.by[k[0]], s.tot)}%</td></tr>`).join("") || "<tr><td colspan=3>—</td></tr>"}</table>
  <h2>المؤثرون</h2>${Ls.length ? `<table><tr><th>المؤثر</th><th>المنصة</th><th>المطلوب</th><th>المبلغ</th><th>الحالة</th><th>المشاهدات</th><th>ريال/1000 مشاهدة</th></tr>${Ls.map(d => `<tr><td data-notr>${E(d.n)}</td><td>${E(lab(PF, d.pf))}</td><td data-notr>${E(d.dl)}</td><td>${money(d.amt)}</td><td>${E(DST[d.st] || "")}</td><td>${d.rs && d.rs.v ? money(d.rs.v) : "—"}</td><td>${d.rs && N(d.rs.v) ? (N(d.amt) / N(d.rs.v) * 1000).toFixed(1) : "—"}</td></tr>`).join("")}</table>` : "<p>—</p>"}
  <h2>المهام</h2><table><tr><th>المسار</th><th>المهمة</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th><th>مرات الإعادة</th></tr>${tasksOf(M, c.id).map(x => `<tr><td>${E(rl(x.r)[2])}</td><td data-notr>${E(x.t)}</td><td data-notr>${E(nameOf(A, x.as))}</td><td>${E(dmy(x.du))}</td><td>${E(TST[x.st] || "")}</td><td>${N(x.rn) || "—"}</td></tr>`).join("") || "<tr><td colspan=6>—</td></tr>"}</table>
  <h2>الخلاصة</h2>${insights(M, c, A.t).map(x => `<p>• ${E(x[1])}</p>`).join("")}<p style="margin-top:14px;color:#666">طُبع من منصة تاسومة · ${E(dmy(A.t))}</p>`;
}
