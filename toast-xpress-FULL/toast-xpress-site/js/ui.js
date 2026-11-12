/* ============================================================
   ui.js  —  small helpers every page uses
   Everything hangs off one global object called TX.
   ============================================================ */
(function () {
  const TX = (window.TX = window.TX || {});
  const C = window.TX_CONFIG;

  TX.$  = (sel, el = document) => el.querySelector(sel);
  TX.$$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // SECURITY: names/halls typed by students are shown to the admin.
  // Always run user text through esc() before putting it in innerHTML.
  TX.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  TX.naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

  // 08012345678 / +2348012345678 / 234 801 234 5678  →  08012345678
  TX.cleanPhone = (v) => {
    let d = String(v || "").replace(/\D/g, "");
    if (d.startsWith("234") && d.length === 13) d = "0" + d.slice(3);
    return d;
  };
  TX.validPhone = (v) => /^0[789][01]\d{8}$/.test(v);
  TX.waLink = (phone, text = "") => `https://wa.me/234${String(phone).slice(1)}${text ? "?text=" + encodeURIComponent(text) : ""}`;

  TX.orderCode = (o) => String(o.id).replace(/-/g, "").slice(0, 4).toUpperCase();
  TX.clock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  };
  TX.timeOnly = (iso) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  TX.todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

  // The life of an order. Each status has a label and a CSS class (see styles.css  .st-*)
  TX.STATUS = {
    awaiting_payment: { label: "Waiting for payment", cls: "st-wait" },
    payment_sent: { label: "Confirming payment", cls: "st-sent" },
    paid: { label: "Payment confirmed", cls: "st-paid" },
    preparing: { label: "Toasting", cls: "st-prep" },
    ready: { label: "Ready", cls: "st-ready" },
    delivered: { label: "Received", cls: "st-done" },
    cancelled: { label: "Cancelled", cls: "st-cancel" },
  };

  /* ---------- password-recovery question (sign-up + profile) ---------- */
  // Easy to guess answers (like "favourite colour") are NOT offered: with 3 tries, someone could just guess them.
  const DEFAULT_QUESTIONS = [
    "What was the name of your primary school?",
    "What is your mother's first name?",
    "What was the name of your childhood best friend?",
    "What town or street did you grow up in?",
    "What was the name of your first pet?",
    "What nickname did your family call you as a child?",
  ];
  TX.recoveryFields = (p) => {
    const C = window.TX_CONFIG, qs = C.recoveryQuestions && C.recoveryQuestions.length ? C.recoveryQuestions : DEFAULT_QUESTIONS;
    return `<div class="field"><label for="${p}Q">Recovery question</label><select id="${p}Q"><option value="">Choose a question</option>${qs.map((q) => `<option>${TX.esc(q)}</option>`).join("")}<option value="__own">Write my own question…</option></select></div>
      <div class="field" id="${p}QOwnWrap" hidden><label for="${p}QOwn">Your question</label><input id="${p}QOwn" maxlength="100" autocomplete="off" placeholder="A question only you can answer"></div>
      <div class="field"><label for="${p}A">Your answer</label><input id="${p}A" autocomplete="off" maxlength="60" placeholder="Your answer"></div>
      <p class="hint">If you forget your password, answering this lets you set a new one. You get <b>3 tries</b>, so choose something only you know and remember how you spell it.</p>`;
  };
  TX.bindRecovery = (p) => { const sel = TX.$("#" + p + "Q"); sel.onchange = () => { TX.$("#" + p + "QOwnWrap").hidden = sel.value !== "__own"; }; };
  TX.readRecovery = (p) => { // gives {question, answer}, or throws a friendly message
    let q = TX.$("#" + p + "Q").value; if (q === "__own") q = TX.$("#" + p + "QOwn").value.trim();
    const a = TX.$("#" + p + "A").value.trim();
    if (!q) throw new Error("Choose a recovery question.");
    if (q.length < 8) throw new Error("Your own question is too short.");
    if (a.length < 3) throw new Error("Your answer must be at least 3 characters.");
    return { question: q, answer: a };
  };

  TX.avatar = (icon, cls = "") => `<span class="avatar ${cls}" aria-hidden="true">${TX.esc(icon || "🍞")}</span>`;

  /* ---------- little pop-up messages ---------- */
  TX.toast = (msg, type = "ok") => {
    let box = TX.$("#toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast-msg " + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3600);
    setTimeout(() => t.remove(), 4000);
  };

  TX.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    TX.toast("Copied: " + text);
  };

  // soft "ding" + vibration (used when something important changes)
  TX.ping = () => {
    try {
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.42);
    } catch (e) { /* sound is optional */ }
  };

  // Put a text in an element only if it changed (stops flicker on auto-refresh)
  TX.setHTML = (el, html) => {
    if (!el) return;
    if (el.__html !== html) { el.innerHTML = html; el.__html = html; }
  };

  /* ---------- fill brand text everywhere: <span data-brand>, data-campus, data-phone ---------- */
  TX.applyBrand = () => {
    TX.$$("[data-brand]").forEach((e) => (e.textContent = C.brand));
    TX.$$("[data-campus]").forEach((e) => (e.textContent = C.campus));
    TX.$$("[data-phone]").forEach((e) => { e.textContent = C.phone; if (e.tagName === "A") e.href = "tel:" + C.phone; });
    TX.$$("[data-wa]").forEach((e) => (e.href = TX.waLink(C.phone, "Hi " + C.brand + "!")));
    TX.$$("[data-price]").forEach((e) => (e.textContent = TX.naira(C.price)));
  };

  /* ---------- "demo mode" sticker so you never forget the data is fake ---------- */
  TX.demoBadge = () => {
    if (C.mode !== "demo") return;
    const b = document.createElement("div");
    b.className = "demo-badge";
    b.innerHTML = `Demo mode · data stays in this browser <button type="button">Reset</button>`;
    b.querySelector("button").onclick = () => {
      if (confirm("Reset ALL demo data (accounts, orders, stock)?")) {
        localStorage.removeItem("tx_demo_db_v1"); sessionStorage.clear(); location.href = "index.html";
      }
    };
    document.body.appendChild(b);
  };

  /* ---------- icon picker (used on signup and profile) ---------- */
  TX.iconGrid = (selected) =>
    C.icons.map((ic) => `<button type="button" class="ico ${ic === selected ? "sel" : ""}" role="radio" aria-checked="${ic === selected}" data-icon="${ic}">${ic}</button>`).join("");

  /* ---------- reviews (shown on the home page and in the customer app) ---------- */
  TX.stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  // Needs these ids on the page:  #reviews (section) · #rvSummary · #rvGrid
  TX.renderReviews = (list) => {
    const box = TX.$("#reviews"); if (!box) return;
    if (!list || !list.length) { box.hidden = true; return; }
    box.hidden = false;
    const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
    TX.$("#rvSummary").textContent = `${avg.toFixed(1)} ★ from ${list.length} review${list.length === 1 ? "" : "s"}`;
    TX.setHTML(TX.$("#rvGrid"), list.map((r) => `<article class="rv">
      <div class="rv-top">${TX.avatar(r.icon)}<div><b>${TX.esc(r.name)}</b><small>${new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</small></div><span class="rv-stars" role="img" aria-label="${r.rating} out of 5">${TX.stars(r.rating)}</span></div>
      ${r.comment ? `<p>“${TX.esc(r.comment)}”</p>` : ""}</article>`).join(""));
  };

  document.addEventListener("DOMContentLoaded", () => { TX.applyBrand(); TX.demoBadge(); });
})();
