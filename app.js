const KEY = "habit-tracker-v2";
const OLD_KEY = "habit-tracker-v1";
const CATEGORIES = ["Health", "Faith", "Work", "Learning", "Personal"];
const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];
const EMOJIS = ["💪", "🏃", "💧", "🥗", "😴", "🙏", "📖", "✝️", "💼", "💻", "✍️", "🎓", "🧠", "🎯", "🧘", "🎸", "🧹", "💰", "🌱", "☀️"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, values are Date.getDay()
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MILESTONES = [7, 30, 100];
const VIEWS = ["today", "stats", "settings"];
const $ = id => document.getElementById(id);

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, "0");
const dateKey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // Monday
const fmtDate = d => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtFull = d => d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
const todayKey = () => dateKey(new Date());

/* ---------- storage ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function normalize(h) {
  const s = h.schedule || {};
  return {
    id: h.id || uid(),
    name: String(h.name || "Habit"),
    icon: h.icon || "✅",
    color: COLORS.includes(h.color) ? h.color : COLORS[0],
    category: CATEGORIES.includes(h.category) ? h.category : "Personal",
    schedule: {
      type: ["daily", "days", "weekly"].includes(s.type) ? s.type : "daily",
      days: Array.isArray(s.days) ? s.days : [],
      times: Math.min(7, Math.max(1, Number(s.times) || 3)),
    },
    checkins: h.checkins && typeof h.checkins === "object" ? h.checkins : {},
    created: h.created || todayKey(),
    reminder: {
      enabled: !!(h.reminder && h.reminder.enabled),
      time: h.reminder && /^\d{2}:\d{2}$/.test(h.reminder.time) ? h.reminder.time : "08:00",
      last: h.reminder && h.reminder.last ? String(h.reminder.last) : "", // date the reminder last fired
    },
  };
}
function migrate(old) {
  const checkins = {};
  (old.done || []).forEach(k => { checkins[k] = { note: "" }; });
  const first = Object.keys(checkins).sort()[0];
  return normalize({ id: old.id, name: old.name, checkins, created: first || todayKey() });
}
function load() {
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v2)) return v2.map(normalize);
  } catch {}
  try {
    const v1 = JSON.parse(localStorage.getItem(OLD_KEY));
    if (Array.isArray(v1)) return v1.map(migrate);
  } catch {}
  return [];
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(habits)); } catch {} }

let habits = load();
let filter = "All";
let view = "today";
let animateIn = true;   // staggered entrance after switching tabs
let justTicked = null;  // habit id to play the tick animation on next render
try {
  const v = localStorage.getItem("habit-tracker-view");
  if (VIEWS.includes(v)) view = v;
} catch {}

/* ---------- theme ---------- */
let theme = "system";
try { const t = localStorage.getItem("habit-tracker-theme"); if (t === "light" || t === "dark") theme = t; } catch {}
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => theme === "dark" || (theme === "system" && darkQuery.matches);
function applyTheme() {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme"); else root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark() ? "#0d0f14" : "#f4f5f9");
  $("themeBtn").textContent = isDark() ? "☀️" : "🌙";
  $("themeBtn").title = isDark() ? "Switch to light mode" : "Switch to dark mode";
  document.querySelectorAll("[data-theme-opt]").forEach(b => b.classList.toggle("on", b.dataset.themeOpt === theme));
}
function setTheme(t) {
  theme = t;
  try { t === "system" ? localStorage.removeItem("habit-tracker-theme") : localStorage.setItem("habit-tracker-theme", t); } catch {}
  applyTheme(); render();
}
darkQuery.addEventListener("change", () => { if (theme === "system") { applyTheme(); render(); } });

/* ---------- schedule + streaks ---------- */
function scheduledOn(h, d) {
  if (h.schedule.type === "days") return h.schedule.days.includes(d.getDay());
  return true; // daily; weekly can be done any day
}
function weekCount(h, monday) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (h.checkins[dateKey(addDays(monday, i))]) n++;
  return n;
}
// Walks history once. A day (or week, for X-per-week) that isn't due never
// breaks the streak, and the current unfinished day/week is a grace period.
function stats(h) {
  const today = startOfDay(new Date());
  const keys = Object.keys(h.checkins).sort();
  const startKey = keys.length && keys[0] < h.created ? keys[0] : h.created;
  const start = parseKey(startKey);
  let cur = 0, best = 0;
  if (h.schedule.type === "weekly") {
    const thisWeek = weekStart(today);
    for (let w = weekStart(start); w <= thisWeek; w = addDays(w, 7)) {
      if (weekCount(h, w) >= h.schedule.times) cur++;
      else if (+w !== +thisWeek) cur = 0;
      best = Math.max(best, cur);
    }
  } else {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (!scheduledOn(h, d)) continue;
      if (h.checkins[dateKey(d)]) cur++;
      else if (+d !== +today) cur = 0;
      best = Math.max(best, cur);
    }
  }
  return { cur, best };
}
function scheduleLabel(h) {
  const s = h.schedule;
  if (s.type === "daily") return "Every day";
  if (s.type === "weekly") return s.times + "× per week";
  return DAY_ORDER.filter(d => s.days.includes(d)).map(d => DAY_NAMES[d]).join(", ");
}
function dueToday(x, now, isDone) {
  const weeklyMet = x.schedule.type === "weekly" && weekCount(x, weekStart(now)) >= x.schedule.times;
  return scheduledOn(x, now) && (x.schedule.type !== "weekly" || !weeklyMet || isDone);
}

/* ---------- tiny DOM helper ---------- */
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (["checked", "value", "disabled"].includes(k)) e[k] = v;
    else if (v != null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const filtered = () => habits.filter(x => filter === "All" || x.category === filter);

/* ---------- toast + confetti ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function confetti() {
  if (reducedMotion()) return;
  const cv = $("confetti"), ctx = cv.getContext("2d"), dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#5b6cff", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#14b8a6", "#ef4444"];
  const parts = Array.from({ length: 160 }, (_, i) => {
    const left = i % 2 === 0, angle = (left ? -1 : 1) * (Math.PI / 2 - Math.random() * 1.1) - Math.PI / 2 * 0;
    const speed = 11 + Math.random() * 11;
    return {
      x: left ? W * .12 : W * .88, y: H * .72,
      vx: (left ? 1 : -1) * Math.abs(Math.sin(Math.random() * 1.2 + .3)) * speed * .8,
      vy: -(Math.random() * .5 + .6) * speed * 1.15,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .45,
      c: colors[i % colors.length], round: Math.random() < .25,
    };
  });
  const t0 = performance.now();
  (function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    parts.forEach(p => {
      p.vy += .38; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y < H + 20) alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (3800 - t) / 800));
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.29); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive && t < 4200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(t0);
}

// Day-based habits only; X-per-week streaks are counted in weeks.
function checkMilestone(x, before) {
  if (x.schedule.type === "weekly") return;
  const after = stats(x).cur;
  if (after > before && MILESTONES.includes(after)) {
    toast("🔥 " + after + "-day streak on " + x.name + "!");
    confetti();
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  }
}

/* ---------- rendering ---------- */
function render() {
  renderFilters();
  VIEWS.forEach(v => $("view-" + v).classList.toggle("hidden", v !== view));
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("on", b.dataset.view === view);
    b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false");
  });
  $("title").textContent = { today: "Today", stats: "Stats", settings: "Settings" }[view];
  $("fab").classList.toggle("hidden", view !== "today");
  if (view === "today") { renderRing(); renderToday(); }
  else if (view === "stats") renderStats();
  else renderSettings();
  animateIn = false;
}

function renderFilters() {
  ["filtersToday", "filtersStats"].forEach(id => {
    const box = $(id);
    box.innerHTML = "";
    ["All", ...CATEGORIES].forEach(c =>
      box.append(h("button", { class: "chip" + (c === filter ? " on" : ""), onclick: () => { filter = c; render(); } }, c)));
  });
}

/* progress ring */
const RING_C = 2 * Math.PI * 46;
let shownPct = 0, tweenRaf;
function renderRing() {
  const list = filtered(), now = new Date(), tk = todayKey();
  let due = 0, done = 0;
  list.forEach(x => {
    const isDone = !!x.checkins[tk];
    if (dueToday(x, now, isDone)) { due++; if (isDone) done++; }
  });
  const pct = due ? Math.round(done / due * 100) : 0;
  const prog = $("ringProg");
  prog.style.strokeDasharray = RING_C;
  prog.style.strokeDashoffset = RING_C * (1 - pct / 100);
  $("ring").classList.toggle("full", due > 0 && pct === 100);

  const from = shownPct, t0 = performance.now();
  cancelAnimationFrame(tweenRaf);
  (function tween(now) {
    const k = reducedMotion() ? 1 : Math.min(1, (now - t0) / 700);
    shownPct = Math.round(from + (pct - from) * (1 - Math.pow(1 - k, 3)));
    $("ringPct").textContent = shownPct;
    if (k < 1) tweenRaf = requestAnimationFrame(tween);
  })(t0);

  const scope = filter === "All" ? "" : filter + " · ";
  if (!list.length) { $("ringTitle").textContent = "Let's begin"; $("ringSub").textContent = "Add a habit to start your first streak."; }
  else if (!due) { $("ringTitle").textContent = "Rest day"; $("ringSub").textContent = scope + "Nothing is due today."; }
  else {
    $("ringTitle").textContent = pct === 100 ? "All done! 🎉" : pct >= 50 ? "Almost there" : pct > 0 ? "Good start" : "Ready when you are";
    $("ringSub").textContent = scope + done + " of " + due + " habit" + (due === 1 ? "" : "s") + " done today";
  }
}

function renderToday() {
  const list = $("list");
  list.innerHTML = "";
  const visible = filtered();
  if (!visible.length) {
    list.append(h("li", { class: "empty" },
      h("div", { class: "big" }, habits.length ? "🔎" : "🌱"),
      h("p", {}, habits.length ? "No habits in this category." : "No habits yet. Small steps, every day."),
      !habits.length && h("button", { class: "btn primary", onclick: () => openHabit(null) }, "Create your first habit")));
    return;
  }
  const now = new Date(), tk = todayKey();
  visible.forEach((x, i) => {
    const isDone = !!x.checkins[tk];
    list.append(card(x, isDone, dueToday(x, now, isDone), now, tk, i));
  });
  justTicked = null;
}

const GRIP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function card(x, isDone, dueNow, now, tk, i) {
  const { cur, best } = stats(x);
  const unit = x.schedule.type === "weekly" ? "week" : "day";
  const plural = n => n + " " + unit + (n === 1 ? "" : "s");
  const todayCheckin = x.checkins[tk];
  const just = justTicked === x.id;

  const strip = h("div", { class: "week" });
  for (let n = 6; n >= 0; n--) {
    const d = addDays(now, -n), k = dateKey(d);
    strip.append(h("button", {
      class: "day" + (x.checkins[k] ? " hit" : "") + (scheduledOn(x, d) && x.schedule.type !== "weekly" ? " sched" : "") + (n === 0 ? " today" : ""),
      title: fmtDate(d), "aria-label": x.name + " on " + fmtDate(d) + (x.checkins[k] ? ", done" : ""),
      onclick: () => openCheckin(x.id, k),
    }, DAY_NAMES[d.getDay()][0]));
  }

  const pills = h("div", { class: "pills" },
    h("span", { class: "pill" + (cur >= 7 ? " hot" : "") }, "🔥 " + plural(cur)),
    h("span", { class: "pill" }, "Best " + plural(best)));
  if (x.schedule.type === "weekly") pills.append(h("span", { class: "pill" }, weekCount(x, weekStart(now)) + "/" + x.schedule.times + " this week"));
  pills.append(h("div", { class: "links" },
    h("button", { class: "link-btn", onclick: () => openCheckin(x.id, tk), "aria-label": "Note for " + x.name }, "Note"),
    h("button", { class: "link-btn", onclick: () => openHabit(x.id), "aria-label": "Edit " + x.name }, "Edit")));

  const grip = h("button", {
    class: "grip", title: "Drag to reorder", "aria-label": "Reorder " + x.name + ". Drag, or use the up and down arrow keys.",
    onpointerdown: e => startDrag(e, li), onkeydown: e => gripKey(e, x.id),
  });
  grip.innerHTML = GRIP_SVG;

  const check = h("button", {
    class: "check" + (isDone ? " done" : "") + (just && isDone ? " just" : ""), role: "checkbox", "aria-checked": String(isDone),
    "aria-label": x.name + ", done today", onclick: () => toggleDay(x.id, tk),
  });
  check.innerHTML = CHECK_SVG;

  const li = h("li", {
    class: "habit" + (isDone ? " done" : "") + (dueNow ? "" : " off") + (animateIn ? " enter" : "") + (just && isDone ? " just" : ""),
    style: "--c:" + x.color + ";--i:" + i, "data-id": x.id,
  },
    h("div", { class: "row" },
      grip,
      h("div", { class: "icon" }, x.icon),
      h("div", { class: "info" },
        h("div", { class: "name" }, x.name),
        h("div", { class: "meta" },
          h("span", { class: "tag" }, x.category),
          h("span", {}, scheduleLabel(x)),
          x.reminder.enabled && h("span", { class: "rem" }, "⏰ " + x.reminder.time),
          !dueNow && h("span", {}, "· not due today"))),
      check),
    todayCheckin && todayCheckin.note && h("div", { class: "note-text" }, "“" + todayCheckin.note + "”"),
    h("div", { class: "sub" }, pills, strip));
  return li;
}

/* ---------- ticking ---------- */
function toggleDay(id, key) {
  const x = habits.find(v => v.id === id);
  if (!x) return;
  const isToday = key === todayKey();
  if (x.checkins[key]) {
    if (x.checkins[key].note && !confirm("Unmarking this day will remove its note. Continue?")) return;
    delete x.checkins[key];
    save(); render();
  } else {
    const before = stats(x).cur;
    x.checkins[key] = { note: "" };
    if (isToday) { justTicked = id; if (navigator.vibrate) navigator.vibrate(14); }
    save(); render();
    if (isToday) checkMilestone(x, before);
  }
}

/* ---------- drag to reorder (pointer events: mouse, touch and pen) ---------- */
function startDrag(e, li) {
  if (e.button != null && e.button !== 0) return;
  e.preventDefault();
  const handle = e.currentTarget, list = li.parentElement;
  handle.setPointerCapture(e.pointerId);
  let startY = e.clientY, lastY = e.clientY, raf;
  li.classList.add("dragging");
  li.style.transition = "none";
  if (navigator.vibrate) navigator.vibrate(8);

  const place = () => { li.style.transform = "translateY(" + (lastY - startY) + "px) scale(1.02)"; };
  const midOf = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  const reorder = () => {
    for (let guard = 0; guard < 6; guard++) {
      const mid = midOf(li), next = li.nextElementSibling, prev = li.previousElementSibling;
      let sib, after;
      if (next && next.classList.contains("habit") && mid > midOf(next)) { sib = next; after = true; }
      else if (prev && prev.classList.contains("habit") && mid < midOf(prev)) { sib = prev; after = false; }
      else break;
      const liTop = li.getBoundingClientRect().top, sibTop = sib.getBoundingClientRect().top;
      if (after) list.insertBefore(sib, li); else list.insertBefore(li, sib);
      // keep the dragged card under the finger, and glide the displaced one into place
      const dy = lastY - startY + (liTop - li.getBoundingClientRect().top);
      startY = lastY - dy;
      place();
      const shift = sibTop - sib.getBoundingClientRect().top;
      sib.style.transition = "none"; sib.style.transform = "translateY(" + shift + "px)";
      sib.getBoundingClientRect();
      sib.style.transition = "transform .2s ease"; sib.style.transform = "";
    }
  };
  const onMove = ev => { lastY = ev.clientY; place(); reorder(); };
  const autoScroll = () => {
    const d = lastY < 100 ? -12 : lastY > innerHeight - 160 ? 12 : 0;
    if (d) {
      const y0 = window.scrollY;
      window.scrollBy(0, d);
      const moved = window.scrollY - y0;
      if (moved) { startY -= moved; place(); reorder(); }
    }
    raf = requestAnimationFrame(autoScroll);
  };
  const end = () => {
    cancelAnimationFrame(raf);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    li.classList.remove("dragging");
    li.style.transition = "transform .2s ease";
    li.style.transform = "";
    setTimeout(() => { li.style.transition = ""; }, 220);
    // write the new order back (only the visible habits trade places)
    const ids = [...list.children].map(n => n.dataset.id).filter(Boolean);
    const byId = Object.fromEntries(habits.map(v => [v.id, v]));
    const slots = habits.map((v, i) => ids.includes(v.id) ? i : -1).filter(i => i >= 0);
    slots.forEach((slot, i) => { habits[slot] = byId[ids[i]]; });
    save();
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  raf = requestAnimationFrame(autoScroll);
}

function gripKey(e, id) {
  const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
  if (!dir) return;
  e.preventDefault();
  const vis = filtered().map(x => x.id), j = vis.indexOf(id) + dir;
  if (j < 0 || j >= vis.length) return;
  const a = habits.findIndex(x => x.id === id), b = habits.findIndex(x => x.id === vis[j]);
  [habits[a], habits[b]] = [habits[b], habits[a]];
  save(); render();
  const g = document.querySelector('[data-id="' + id + '"] .grip');
  if (g) g.focus();
}

/* ---------- stats ---------- */
const FAR_PAST = new Date(2000, 0, 1);

function effStart(x) {
  const first = Object.keys(x.checkins).sort()[0];
  return parseKey(first && first < x.created ? first : x.created);
}
// done / expected for one habit between rs and re (inclusive). Daily and weekday
// habits are measured per scheduled day. X-per-week habits are measured per week
// (target = times); weeks cut off at the start of the range are prorated, and the
// current week counts in full so it matches the "2/3 this week" pill.
function periodStats(x, rs, re) {
  const s = effStart(x);
  const start = rs > s ? rs : s;
  let done = 0, expected = 0;
  if (start > re) return { done, expected };
  if (x.schedule.type === "weekly") {
    for (let w = weekStart(start); w <= re; w = addDays(w, 7)) {
      const os = w < start ? start : w;
      const sunday = addDays(w, 6);
      const exp = x.schedule.times * (Math.round((sunday - os) / 864e5) + 1) / 7;
      let c = 0;
      for (let d = os; d <= sunday && d <= re; d = addDays(d, 1)) if (x.checkins[dateKey(d)]) c++;
      expected += exp; done += Math.min(c, exp);
    }
  } else {
    for (let d = start; d <= re; d = addDays(d, 1)) {
      if (!scheduledOn(x, d)) continue;
      expected++;
      if (x.checkins[dateKey(d)]) done++;
    }
  }
  return { done, expected };
}
function aggregate(list, rs, re) {
  let done = 0, expected = 0;
  list.forEach(x => { const p = periodStats(x, rs, re); done += p.done; expected += p.expected; });
  return { done, expected, pct: expected ? Math.round(done / expected * 100) : null };
}

let trendChart = null;

function renderStats() {
  const scrollY = window.scrollY;
  const lefts = {};
  document.querySelectorAll(".hm-scroll").forEach(s => { lefts[s.dataset.h] = s.scrollLeft; });

  const list = filtered();
  const today = startOfDay(new Date());
  const empty = !list.length;
  $("statsBody").classList.toggle("hidden", empty);
  $("heatHead").classList.toggle("hidden", empty);
  $("heatList").innerHTML = "";
  if (empty) {
    $("heatList").append(h("div", { class: "empty" }, h("div", { class: "big" }, "📊"),
      h("p", {}, habits.length ? "No habits in this category." : "Add a habit to see your stats.")));
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    return;
  }

  const ranges = [["This week", weekStart(today)], ["This month", new Date(today.getFullYear(), today.getMonth(), 1)], ["All time", FAR_PAST]];
  $("rateTiles").innerHTML = "";
  ranges.forEach(([label, rs]) => {
    const a = aggregate(list, rs, today);
    $("rateTiles").append(h("div", { class: "tile" },
      h("div", { class: "lbl" }, label),
      h("div", { class: "big" }, a.pct == null ? "–" : a.pct + "%"),
      h("div", { class: "subt" }, a.expected ? Math.round(a.done) + " of " + Math.round(a.expected) : "no data")));
  });

  renderTrend(list, today);
  renderInsights(list, today);
  list.forEach(x => $("heatList").append(heatCard(x, today, lefts[x.id])));
  window.scrollTo(0, scrollY);
}

// Overall completion per day: scheduled days only (daily + weekday habits).
function renderTrend(list, today) {
  const labels = [], data = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i), k = dateKey(d);
    let due = 0, done = 0;
    list.forEach(x => {
      if (x.schedule.type === "weekly" || d < effStart(x) || !scheduledOn(x, d)) return;
      due++; if (x.checkins[k]) done++;
    });
    labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    data.push(due ? Math.round(done / due * 100) : null);
  }
  const hasWeekly = list.some(x => x.schedule.type === "weekly");
  $("trendNote").textContent = hasWeekly ? "X-per-week habits are measured weekly, so they're not part of this daily line." : "";

  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (typeof Chart === "undefined") {
    $("trendNote").textContent = "The chart library couldn't load (are you offline?). The rest of the stats still work.";
    return;
  }
  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue("--muted").trim(), grid = css.getPropertyValue("--border").trim(), accent = css.getPropertyValue("--accent").trim();
  trendChart = new Chart($("trendChart"), {
    type: "line",
    data: { labels, datasets: [{
      data, borderColor: accent, backgroundColor: accent + "26", fill: true, tension: .35,
      pointRadius: 2.5, pointHoverRadius: 5, spanGaps: true, borderWidth: 2.5,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: reducedMotion() ? 0 : 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + "% complete" } } },
      scales: {
        y: { min: 0, max: 100, ticks: { color: muted, callback: v => v + "%", stepSize: 25 }, grid: { color: grid } },
        x: { ticks: { color: muted, maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } },
      },
    },
  });
}

function renderInsights(list, today) {
  // best weekday (scheduled-day habits only, through yesterday)
  const due = Array(7).fill(0), done = Array(7).fill(0);
  const yesterday = addDays(today, -1);
  list.forEach(x => {
    if (x.schedule.type === "weekly") return;
    for (let d = effStart(x); d <= yesterday; d = addDays(d, 1)) {
      if (!scheduledOn(x, d)) continue;
      due[d.getDay()]++; if (x.checkins[dateKey(d)]) done[d.getDay()]++;
    }
  });
  const totalDue = due.reduce((a, b) => a + b, 0);
  const pcts = due.map((n, i) => n ? done[i] / n : null);
  const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const box = $("bestDay");
  box.innerHTML = "";
  box.append(h("h3", {}, "Best day of the week"));
  if (totalDue < 7) {
    box.append(h("div", { class: "hint" }, "Not enough scheduled days yet. Keep tracking and this will fill in."));
  } else {
    let best = -1;
    pcts.forEach((p, i) => { if (p != null && (best < 0 || p > pcts[best])) best = i; });
    box.append(h("div", { class: "headline" }, DAY_FULL[best]),
      h("div", { class: "hint" }, Math.round(pcts[best] * 100) + "% of scheduled habits done"));
    const bars = h("div", { class: "bars" });
    DAY_ORDER.forEach(d => bars.append(h("div", { class: "bar" + (d === best ? " best" : ""), title: pcts[d] == null ? "No data" : Math.round(pcts[d] * 100) + "%" },
      h("span", {}, pcts[d] == null ? "–" : Math.round(pcts[d] * 100)),
      h("i", { style: "height:" + (pcts[d] == null ? 0 : Math.round(pcts[d] * 50)) + "px" }),
      h("span", {}, DAY_NAMES[d][0]))));
    box.append(bars);
  }

  // most consistent habit (all-time rate, needs a week of expected days)
  const hb = $("bestHabit");
  hb.innerHTML = "";
  hb.append(h("h3", {}, "Most consistent habit"));
  const ranked = list.map(x => ({ x, p: periodStats(x, FAR_PAST, today), best: stats(x).best }))
    .filter(r => r.p.expected >= 7)
    .map(r => ({ ...r, pct: r.p.done / r.p.expected }))
    .sort((a, b) => b.pct - a.pct || b.best - a.best);
  if (!ranked.length) {
    hb.append(h("div", { class: "hint" }, "A habit needs about a week of history before it can be ranked."));
  } else {
    const r = ranked[0];
    hb.append(h("div", { class: "headline" }, r.x.icon + " " + r.x.name),
      h("div", { class: "hint" }, Math.round(r.pct * 100) + "% all-time · best streak " + r.best + (r.x.schedule.type === "weekly" ? " weeks" : " days")));
    if (ranked.length > 1) {
      hb.append(h("div", { class: "hint", style: "margin-top:10px" },
        ranked.slice(1, 4).map(o => o.x.icon + " " + o.x.name + " " + Math.round(o.pct * 100) + "%").join(" · ")));
    }
  }
}

function heatCard(x, today, prevLeft) {
  const start = addDays(weekStart(today), -52 * 7);
  const months = h("div", { class: "hm-months" });
  const grid = h("div", { class: "hm-grid" });
  let total = 0, lastMonth = -1;
  for (let c = 0; c < 53; c++) {
    const colStart = addDays(start, c * 7), m = colStart.getMonth();
    const skip = c === 0 && addDays(colStart, 7).getMonth() !== m; // would collide with the next label
    months.append(h("span", {}, m !== lastMonth && !skip ? colStart.toLocaleDateString(undefined, { month: "short" }) : ""));
    lastMonth = m;
    for (let r = 0; r < 7; r++) {
      const d = addDays(colStart, r);
      if (d > today) { grid.append(h("span")); continue; }
      const k = dateKey(d), c_ = x.checkins[k], on = !!c_;
      if (on) total++;
      const off = x.schedule.type === "days" && !x.schedule.days.includes(d.getDay());
      grid.append(h("button", {
        class: "cell" + (on ? " hit" : "") + (off && !on ? " off" : "") + (+d === +today ? " today" : ""),
        "data-h": x.id, "data-k": k, "aria-pressed": String(on),
        title: fmtFull(d) + (on ? " · done" + (c_.note ? " · “" + c_.note + "”" : "") : off ? " · not scheduled" : " · not done"),
        "aria-label": x.name + ", " + fmtFull(d) + ", " + (on ? "done" : "not done"),
      }));
    }
  }
  const all = periodStats(x, FAR_PAST, today);
  const scroll = h("div", { class: "hm-scroll", "data-h": x.id }, months, grid);
  const card = h("div", { class: "hm-card", style: "--c:" + x.color },
    h("div", { class: "hm-head" },
      h("div", { class: "icon" }, x.icon),
      h("div", { class: "info" },
        h("div", { class: "name" }, x.name),
        h("div", { class: "meta" },
          h("span", {}, total + (total === 1 ? " day" : " days") + " in the last year"),
          all.expected ? h("span", {}, Math.round(all.done / all.expected * 100) + "% all-time") : null))),
    h("div", { class: "hm-wrap" },
      h("div", { class: "hm-days" }, ...["Mon", "", "Wed", "", "Fri", "", ""].map(t => h("span", {}, t))),
      scroll));
  // keep the user's scroll position across re-renders, otherwise show the latest weeks
  requestAnimationFrame(() => { scroll.scrollLeft = prevLeft != null ? prevLeft : scroll.scrollWidth; });
  return card;
}

$("heatList").addEventListener("click", e => {
  const cell = e.target.closest(".cell");
  if (cell) toggleDay(cell.dataset.h, cell.dataset.k);
});

/* ---------- settings ---------- */
function renderSettings() {
  const checkins = habits.reduce((n, x) => n + Object.keys(x.checkins).length, 0);
  $("dataInfo").textContent = habits.length + (habits.length === 1 ? " habit" : " habits") + " · " + checkins + (checkins === 1 ? " check-in" : " check-ins");
  applyTheme();
  updateNotifUI();
  updateInstallUI();
}
/* backup + restore */
$("exportBtn").addEventListener("click", () => {
  const backup = { app: "again-again", version: 2, exportedAt: new Date().toISOString(), settings: { theme }, habits };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: "again-again-backup-" + todayKey() + ".json" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Backup downloaded");
});

let pendingImport = null; // { habits: [...normalized], theme }
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data && data.habits;
    if (!Array.isArray(arr)) throw new Error("bad format");
    const incoming = arr.filter(x => x && typeof x === "object")
      .map(x => Array.isArray(x.done) && !x.checkins ? migrate(x) : normalize(x));
    if (!incoming.length) throw new Error("empty");
    const days = incoming.reduce((n, x) => n + Object.keys(x.checkins).length, 0);
    pendingImport = { habits: incoming, theme: data.settings && data.settings.theme };
    $("importInfo").textContent = "This file has " + incoming.length + (incoming.length === 1 ? " habit" : " habits") + " and " + days +
      (days === 1 ? " check-in" : " check-ins") + (data.exportedAt ? ", exported " + new Date(data.exportedAt).toLocaleDateString() : "") +
      ". You currently have " + habits.length + (habits.length === 1 ? " habit." : " habits.");
    $("importDlg").showModal();
  } catch { toast("That file isn't a valid Again Again backup"); }
});
function finishImport(msg) {
  $("importDlg").close();
  pendingImport = null;
  save(); render(); toast(msg);
}
$("importReplace").addEventListener("click", () => {
  if (!pendingImport) return;
  const t = pendingImport.theme;
  habits = pendingImport.habits;
  if (t === "light" || t === "dark" || t === "system") setTheme(t);
  finishImport("Restored " + habits.length + " habits");
});
$("importMerge").addEventListener("click", () => {
  if (!pendingImport) return;
  const byId = new Map(habits.map(x => [x.id, x]));
  let added = 0;
  pendingImport.habits.forEach(inc => {
    const cur = byId.get(inc.id);
    if (cur) cur.checkins = { ...inc.checkins, ...cur.checkins }; // your current data wins on a clash
    else { habits.push(inc); added++; }
  });
  finishImport("Merged: " + added + " new " + (added === 1 ? "habit" : "habits") + " added");
});
$("importCancel").addEventListener("click", () => { pendingImport = null; $("importDlg").close(); });
$("eraseBtn").addEventListener("click", () => {
  if (!habits.length || !confirm("Delete all habits and history? This can't be undone.")) return;
  habits = [];
  save(); render(); toast("Everything erased");
});
document.querySelectorAll("[data-theme-opt]").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeOpt)));
$("themeBtn").addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));

/* ---------- navigation ---------- */
document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => {
  if (view === b.dataset.view) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  view = b.dataset.view;
  animateIn = true;
  try { localStorage.setItem("habit-tracker-view", view); } catch {}
  window.scrollTo(0, 0);
  render();
}));
$("fab").addEventListener("click", () => openHabit(null));

/* ---------- habit dialog (add / edit) ---------- */
let editingId = null;
const habitDlg = $("habitDlg");

function buildFormControls() {
  $("emojiPicks").append(...EMOJIS.map(e => h("button", { type: "button", onclick: () => { $("fIcon").value = e; } }, e)));
  $("colorPicks").append(...COLORS.map((c, i) => h("label", { style: "--c:" + c, title: c },
    h("input", { type: "radio", name: "color", value: c, "aria-label": "Colour " + (i + 1) }), h("span"))));
  $("fCat").append(...CATEGORIES.map(c => h("option", { value: c }, c)));
  $("dayPicks").append(...DAY_ORDER.map(d => h("label", {},
    h("input", { type: "checkbox", value: d, name: "day" }), h("span", {}, DAY_NAMES[d]))));
  $("fTimes").append(...[1, 2, 3, 4, 5, 6, 7].map(n => h("option", { value: n }, n + (n === 1 ? " time" : " times") + " per week")));
}
function syncSchedUI() {
  const t = $("fSched").value;
  $("dayPicks").classList.toggle("hidden", t !== "days");
  $("timesRow").classList.toggle("hidden", t !== "weekly");
}

function openHabit(id) {
  const x = id ? habits.find(v => v.id === id) : null;
  editingId = x ? x.id : null;
  $("habitTitle").textContent = x ? "Edit habit" : "New habit";
  $("fName").value = x ? x.name : "";
  $("fIcon").value = x ? x.icon : "✅";
  const color = x ? x.color : COLORS[0];
  document.querySelectorAll('input[name="color"]').forEach(r => { r.checked = r.value === color; });
  $("fCat").value = x ? x.category : (CATEGORIES.includes(filter) ? filter : "Health");
  $("fSched").value = x ? x.schedule.type : "daily";
  $("fTimes").value = x ? x.schedule.times : 3;
  document.querySelectorAll('input[name="day"]').forEach(c => { c.checked = !!x && x.schedule.days.includes(Number(c.value)); });
  $("delBtn").classList.toggle("hidden", !x);
  $("fErr").textContent = "";
  $("fRemOn").checked = !!x && x.reminder.enabled;
  $("fRemTime").value = x ? x.reminder.time : "08:00";
  syncSchedUI();
  syncRemUI();
  habitDlg.showModal();
  if (!x) $("fName").focus();
}

function firstGrapheme(s) {
  s = s.trim();
  if (!s) return "";
  if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)][0].segment;
  return [...s][0];
}

$("habitForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("fName").value.trim();
  const type = $("fSched").value;
  const days = [...document.querySelectorAll('input[name="day"]:checked')].map(c => Number(c.value));
  if (!name) { $("fErr").textContent = "Please give the habit a name."; return; }
  if (type === "days" && !days.length) { $("fErr").textContent = "Pick at least one weekday."; return; }
  const picked = document.querySelector('input[name="color"]:checked');
  const data = {
    name,
    icon: firstGrapheme($("fIcon").value) || "✅",
    color: picked ? picked.value : COLORS[0],
    category: $("fCat").value,
    schedule: { type, days, times: Number($("fTimes").value) },
  };
  const old = editingId ? habits.find(v => v.id === editingId) : null;
  data.reminder = { enabled: $("fRemOn").checked, time: $("fRemTime").value || "08:00", last: "" };
  // changing the time (or turning it on again) lets today's reminder fire again
  if (old && old.reminder.enabled === data.reminder.enabled && old.reminder.time === data.reminder.time) data.reminder.last = old.reminder.last;
  if (old) Object.assign(old, data);
  else habits.push(normalize({ ...data, checkins: {}, created: todayKey() }));
  save(); render(); habitDlg.close();
});

$("delBtn").addEventListener("click", () => {
  const x = habits.find(v => v.id === editingId);
  if (!x || !confirm("Delete “" + x.name + "” and all its history?")) return;
  habits = habits.filter(v => v.id !== editingId);
  save(); render(); habitDlg.close();
});

/* ---------- check-in dialog (any day + note) ---------- */
let ciHabit = null, ciKey = null;
const ciDlg = $("ciDlg");

function openCheckin(id, key) {
  const x = habits.find(v => v.id === id);
  if (!x) return;
  ciHabit = id; ciKey = key;
  const c = x.checkins[key];
  $("ciTitle").textContent = x.icon + " " + x.name + " · " + fmtDate(parseKey(key));
  $("ciDone").checked = !!c;
  $("ciNote").value = c ? c.note || "" : "";
  $("ciNote").disabled = !c;
  const recent = Object.entries(x.checkins).filter(([k, v]) => v.note && k !== key).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
  const box = $("ciRecent");
  box.innerHTML = "";
  if (recent.length) {
    box.append(h("h3", {}, "Recent notes"),
      ...recent.map(([k, v]) => h("div", {}, h("small", {}, fmtDate(parseKey(k))), v.note)));
  }
  ciDlg.showModal();
}
$("ciDone").addEventListener("change", e => {
  $("ciNote").disabled = !e.target.checked;
  if (e.target.checked) $("ciNote").focus();
});
$("ciForm").addEventListener("submit", e => {
  e.preventDefault();
  const x = habits.find(v => v.id === ciHabit);
  ciDlg.close();
  if (!x) return;
  const wasDone = !!x.checkins[ciKey], before = stats(x).cur;
  if ($("ciDone").checked) x.checkins[ciKey] = { note: $("ciNote").value.trim() };
  else delete x.checkins[ciKey];
  const newlyDone = !wasDone && $("ciDone").checked && ciKey === todayKey();
  if (newlyDone) justTicked = x.id;
  save(); render();
  if (newlyDone) checkMilestone(x, before);
});

/* ---------- reminders (browser notifications) ---------- */
// There is no server, so reminders are checked by the page itself: every 30 seconds, and
// whenever the app comes back to the foreground. See README for what that means in practice.
const notifSupported = "Notification" in window;
const REMIND_WINDOW_MIN = 180; // still remind up to 3 hours late (e.g. you opened the app after the time)

async function askPermission() {
  if (!notifSupported) return "unsupported";
  if (Notification.permission === "default") { try { await Notification.requestPermission(); } catch {} }
  return Notification.permission;
}
async function showNotif(title, body, tag) {
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag };
  try { // preferred: through the service worker (works on Android and when installed)
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) { await reg.showNotification(title, opts); return true; }
  } catch {}
  try { new Notification(title, opts); return true; } catch { return false; }
}
function checkReminders() {
  if (!notifSupported || Notification.permission !== "granted") return;
  const now = new Date(), tk = todayKey(), mins = now.getHours() * 60 + now.getMinutes();
  let changed = false;
  habits.forEach(x => {
    const r = x.reminder;
    if (!r.enabled || r.last === tk) return;
    const [hh, mm] = r.time.split(":").map(Number), at = hh * 60 + mm;
    if (mins < at || mins >= at + REMIND_WINDOW_MIN) return;
    if (x.checkins[tk] || !dueToday(x, now, false)) return; // already done, or not due today
    r.last = tk; changed = true;
    const { cur } = stats(x), unit = x.schedule.type === "weekly" ? "week" : "day";
    showNotif(x.icon + " " + x.name,
      cur > 0 ? "Keep your " + cur + "-" + unit + " streak going." : "A good moment to start. It only takes a minute.",
      "habit-" + x.id + "-" + tk);
  });
  if (changed) save();
}
setInterval(checkReminders, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });

function remHintText() {
  if (!notifSupported) return "This browser doesn't support notifications.";
  if (Notification.permission === "denied") return "Notifications are blocked. Allow them in your browser's site settings, then try again.";
  if (Notification.permission === "default") return "You'll be asked for permission when you save.";
  return "Shown while Again Again is open or running in the background.";
}
function syncRemUI() {
  $("remRow").classList.toggle("hidden", !$("fRemOn").checked);
  $("remHint").textContent = remHintText();
}
$("fRemOn").addEventListener("change", async () => {
  syncRemUI();
  if ($("fRemOn").checked) { await askPermission(); syncRemUI(); }
});

function updateNotifUI() {
  const st = $("notifStatus"), btn = $("notifBtn");
  btn.classList.add("hidden");
  if (!notifSupported) st.textContent = "Not supported in this browser";
  else if (Notification.permission === "granted") st.textContent = "On. Reminders will appear on this device";
  else if (Notification.permission === "denied") st.textContent = "Blocked. Allow notifications in your browser's site settings";
  else { st.textContent = "Off. Allow them to get reminders"; btn.classList.remove("hidden"); }
  $("notifTest").disabled = !notifSupported;
}
$("notifBtn").addEventListener("click", async () => { await askPermission(); updateNotifUI(); });
$("notifTest").addEventListener("click", async () => {
  if ((await askPermission()) !== "granted") { updateNotifUI(); toast("Notifications aren't allowed yet"); return; }
  updateNotifUI();
  if (!(await showNotif("🔔 Again Again", "Reminders are working. Time to do it again!", "test"))) toast("Couldn't show a notification");
});

/* ---------- install (PWA) + offline ---------- */
let deferredInstall = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function updateInstallUI() {
  const info = $("installInfo"), btn = $("installBtn");
  btn.classList.add("hidden");
  if (isStandalone()) info.textContent = "You're using the installed app.";
  else if (!location.protocol.startsWith("http")) info.textContent = "Installing needs the app to be opened from a web address (https:// or localhost).";
  else if (deferredInstall) { info.textContent = "Install for a full-screen app that works offline."; btn.classList.remove("hidden"); }
  else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) info.textContent = "In Safari, tap the Share button, then “Add to Home Screen”.";
  else info.textContent = "Use your browser menu and choose “Install app” or “Add to Home screen”.";
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; updateInstallUI(); });
window.addEventListener("appinstalled", () => { deferredInstall = null; updateInstallUI(); toast("Installed. Find Again Again on your home screen."); });
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  updateInstallUI();
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ---------- wiring ---------- */
$("habitCancel").addEventListener("click", () => habitDlg.close());
$("ciCancel").addEventListener("click", () => ciDlg.close());
$("fSched").addEventListener("change", syncSchedUI);

buildFormControls();
$("date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
applyTheme();
save(); // persist any v1 -> v2 migration
render();
checkReminders();
