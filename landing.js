/* ============================================================
   landing.js — the home page
   A) nav, hero video (set in config.js), scroll-reveal
   B) live "toasts left" pill
   C) the create-account / log-in pop-up (a small 3-step wizard)
   ============================================================ */
(async function () {
  const { $, $$, esc } = TX;
  const C = window.TX_CONFIG;

  /* ---------- A) PAGE EXTRAS: nav, hero video, scroll reveal ---------- */
  const nav = $("#nav"), burger = $("#burger");
  addEventListener("scroll", () => nav.classList.toggle("stuck", scrollY > 8), { passive: true });
  burger.addEventListener("click", () => {
    const on = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", on); burger.setAttribute("aria-label", on ? "Close menu" : "Open menu");
  });
  $$("#navPanel a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); burger.setAttribute("aria-expanded", false); }));

  // THE HERO VIDEO — everything it needs comes from config.js → video
  (function heroVideo() {
    const V = C.video || {}, box = $("#heroVideo");
    box.style.setProperty("--ratio", V.ratio || "4 / 5");
    const poster = `<img class="poster" src="${esc(V.poster || "")}" alt="Freshly made Toast Express toast" fetchpriority="high">`;
    const text = V.text ? `<figcaption class="video-text"><b>${esc(V.text)}</b><small>${esc(C.tagline || "")}</small></figcaption>` : "";
    box.classList.toggle("no-text", !V.text);
    box.innerHTML = poster + text;
    if (!V.mp4 && !V.webm) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const v = document.createElement("video");
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = !reduce;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.preload = "metadata"; v.setAttribute("aria-hidden", "true");
    v.poster = V.poster || "";
    v.style.opacity = "0"; v.style.transition = "opacity .6s";
    [[V.webm, "video/webm"], [V.mp4, "video/mp4"]].forEach(([src, type]) => { if (src) { const s = document.createElement("source"); s.src = src; s.type = type; v.appendChild(s); } });
    // the video only replaces the poster once it can really play (so a missing file just keeps the photo)
    v.addEventListener("canplay", () => { v.style.opacity = "1"; if (!reduce) v.play().catch(() => {}); });
    box.insertBefore(v, box.querySelector(".poster").nextSibling);
    // save battery: pause when scrolled away
    if (!reduce && "IntersectionObserver" in window)
      new IntersectionObserver((en) => en.forEach((e) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause())), { threshold: 0.15 }).observe(box);
  })();

  // fade sections in as they scroll into view
  (function reveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((e) => io.observe(e));
    setTimeout(() => els.forEach((e) => e.classList.add("in")), 2500); // safety net
  })();

  // allergen note + business details (from config.js)
  $$("[data-allergens]").forEach((e) => (e.textContent = (C.legal && C.legal.allergens) || ""));
  (function biz() {
    const B = C.business || {}, bits = [B.legalName, B.regNo && "Reg. no. " + B.regNo, B.address, B.email].filter(Boolean);
    if (bits.length) $("#bizLine small").textContent = bits.join(" · "); else $("#bizLine").hidden = true;
  })();

  // footer + contact bits that come from config.js
  $("#yr").textContent = new Date().getFullYear();
  $$("[data-tel]").forEach((a) => (a.href = "tel:" + C.phone));
  if (C.hours) { $("#hoursText").textContent = C.hours; $("#hoursRow").hidden = false; }
  const soc = [["Instagram", C.instagram], ["TikTok", C.tiktok]].filter((x) => x[1]);
  if (soc.length) { const n = $("#socials"); n.innerHTML = soc.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join(""); n.hidden = false; }

  /* ---------- B) LIVE STOCK PILL ---------- */
  await TX.ready.catch((e) => { TX.toast(e.message, "bad"); });
  async function refreshLive() {
    try {
      const s = await TX.api.getStore();
      const pill = $("#livePill");
      pill.classList.remove("low", "off");
      let msg;
      if (!s.accepting) { pill.classList.add("off"); msg = "Orders are closed right now"; }
      else if (s.remaining <= 0) { pill.classList.add("off"); msg = "Sold out for today"; }
      else { msg = `${s.remaining} toast${s.remaining === 1 ? "" : "s"} left today`; if (s.remaining <= 5) pill.classList.add("low"); }
      $("#liveText").textContent = msg;
      $("#priceBubble").textContent = TX.naira(s.price);
      if (s.ingredients) $("#ingredientsText").textContent = s.ingredients;
    } catch (e) { $("#liveText").textContent = "Fresh toast, daily"; }
  }
  async function refreshReviews() { try { TX.renderReviews(await TX.api.getReviews(30)); } catch (e) { /* reviews are optional */ } }
  refreshLive(); refreshReviews();
  TX.api.onChange(() => { refreshLive(); refreshReviews(); });

  /* ---------- already logged in? swap the buttons ---------- */
  let user = null;
  try { user = await TX.api.getUser(); } catch (e) {}
  if (user) {
    const dest = user.role === "admin" ? "admin.html" : "app.html";
    $$("[data-login]").forEach((b) => (b.hidden = true, b.style.display = "none"));
    $$("[data-order]").forEach((b) => (b.textContent = user.role === "admin" ? "Open the kitchen" : "Order Now"));
    $$("[data-open-auth]").forEach((b) => { b.removeAttribute("data-open-auth"); b.onclick = () => (location.href = dest); });
  }

  /* ---------- C) CREATE ACCOUNT / LOG IN POP-UP ---------- */
  const dlg = $("#auth"), mini = $("#miniScene");
  const panes = $$("[data-pane]", dlg);
  const form = { name: "", hall: "", phone: "", password: "", icon: "" };

  // the hall dropdown is built from the list in config.js
  $("#sHall").innerHTML = `<option value="">Choose your hall</option>` + C.halls.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
  $("#signupIcons").innerHTML = TX.iconGrid("");

  function show(name) {
    panes.forEach((p) => (p.hidden = p.dataset.pane !== name));
    mini.innerHTML = `Toast <b>Express</b>`;
    $$("[data-err]", dlg).forEach((e) => (e.textContent = ""));
    const first = $("input", panes.find((p) => !p.hidden)); if (first && matchMedia("(hover:hover)").matches) first.focus();
  }
  function open(mode) { show(mode === "login" ? "login" : "s2"); if (!dlg.open) dlg.showModal(); }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open-auth]"); if (t) open(t.dataset.openAuth);
    const sw = e.target.closest("[data-switch]"); if (sw) show(sw.dataset.switch === "login" ? "login" : "s2");
    if (e.target.closest("[data-close]") || e.target === dlg) dlg.close();
    const back = e.target.closest("[data-back]"); if (back) show(back.closest("[data-pane]").dataset.pane === "s4" ? "s3" : "s2");
    const ico = e.target.closest(".ico");
    if (ico && dlg.contains(ico)) {
      form.icon = ico.dataset.icon;
      $$("#signupIcons .ico").forEach((b) => { const on = b === ico; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); });
    }
  });

  const err = (pane, msg) => { $("[data-err]", pane).textContent = msg; return false; };
  const busy = (btn, on, label) => { btn.disabled = on; btn.textContent = on ? "One moment…" : label; };

  // LOG IN
  $('[data-pane="login"]').addEventListener("submit", async (e) => {
    e.preventDefault(); const pane = e.currentTarget, btn = $("button[type=submit]", pane);
    const phone = TX.cleanPhone($("#lPhone").value), pass = $("#lPass").value;
    if (!TX.validPhone(phone)) return err(pane, "Enter your 11-digit phone number.");
    if (!pass) return err(pane, "Enter your password.");
    busy(btn, true);
    try { const u = await TX.api.signIn(phone, pass); location.href = u.role === "admin" ? "admin.html" : "app.html"; }
    catch (ex) { err(pane, ex.message); busy(btn, false, "Log in"); }
  });

  // SIGN UP — step 2: details
  $('[data-pane="s2"]').addEventListener("submit", (e) => {
    e.preventDefault(); const pane = e.currentTarget;
    const name = $("#sName").value.trim(), hall = $("#sHall").value, phone = TX.cleanPhone($("#sPhone").value);
    if (name.length < 2) return err(pane, "Please enter your name.");
    if (!C.halls.includes(hall)) return err(pane, "Please choose your hall.");
    if (!TX.validPhone(phone)) return err(pane, "Enter a valid 11-digit phone number, e.g. 08012345678.");
    Object.assign(form, { name, hall, phone }); show("s3");
  });
  // step 3: password
  $('[data-pane="s3"]').addEventListener("submit", (e) => {
    e.preventDefault(); const pane = e.currentTarget, p1 = $("#sPass").value, p2 = $("#sPass2").value;
    if (p1.length < 6) return err(pane, "Password must be at least 6 characters.");
    if (p1 !== p2) return err(pane, "The two passwords don't match.");
    form.password = p1; show("s4");
    if (!form.icon) { const first = $("#signupIcons .ico"); first && first.click(); } // start with one selected
  });
  // step 4: icon → create the account
  $('[data-pane="s4"]').addEventListener("submit", async (e) => {
    e.preventDefault(); const pane = e.currentTarget, btn = $("#finishBtn");
    if (!form.icon) return err(pane, "Tap an icon to pick it.");
    if (!$("#cAge").checked) return err(pane, "Please confirm you are 18 or older.");
    if (!$("#cTerms").checked) return err(pane, "Please tick the box to agree to the Terms and Privacy Policy.");
    busy(btn, true);
    try { await TX.api.signUp({ ...form, consent: { at: new Date().toISOString(), version: (C.legal && C.legal.version) || "" } }); TX.toast("Welcome to Toast Express! 🍞"); setTimeout(() => (location.href = "app.html"), 500); }
    catch (ex) {
      busy(btn, false, "Create my account");
      if (/already has an account/.test(ex.message)) { show("s2"); err($('[data-pane="s2"]'), ex.message); } else err(pane, ex.message);
    }
  });
})();
