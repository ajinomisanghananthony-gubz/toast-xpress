/* ============================================================
   admin.js — the kitchen page (only admins can open it)
   REAL security is in the database rules (supabase/schema.sql).
   The check below only decides what to SHOW.
   ============================================================ */
(async function () {
  const { $, $$, esc, naira } = TX;
  try { await TX.ready; } catch (e) { TX.toast(e.message, "bad"); return; }

  const user = await TX.api.getUser();
  if (!user) { location.replace("index.html"); return; }
  if (user.role !== "admin") { location.replace("app.html"); return; }
  $("#logoutBtn").onclick = async () => { await TX.api.signOut(); location.href = "index.html"; };

  const S = { store: null, orders: [], tab: null, tabTouched: false, knownSent: null };

  /* tabs = the stages an order passes through in the kitchen */
  const TABS = [
    { id: "confirm", label: "Confirm payment", match: ["payment_sent"], alert: true },
    { id: "unpaid", label: "Waiting to pay", match: ["awaiting_payment"] },
    { id: "kitchen", label: "In the kitchen", match: ["paid", "preparing"] },
    { id: "ready", label: "Ready", match: ["ready"] },
    { id: "done", label: "Done", match: ["delivered", "cancelled"] },
  ];
  const count = (t) => S.orders.filter((o) => t.match.includes(o.status)).length;

  /* ---------- top tiles ---------- */
  function drawTiles() {
    const s = S.store; if (!s) return;
    const live = S.orders.filter((o) => o.status !== "cancelled");
    const sold = live.reduce((n, o) => n + o.qty, 0);
    const money = S.orders.filter((o) => ["paid", "preparing", "ready", "delivered"].includes(o.status)).reduce((n, o) => n + o.total, 0);
    const pending = S.orders.filter((o) => ["awaiting_payment", "payment_sent"].includes(o.status)).reduce((n, o) => n + o.total, 0);
    $("#tTotal").textContent = s.stock_total;
    $("#tLeft").textContent = s.remaining;
    $("#tSold").textContent = `${sold} ordered · ${S.orders.length} order${S.orders.length === 1 ? "" : "s"}`;
    $("#tMoney").textContent = naira(money);
    $("#tPending").textContent = pending ? `${naira(pending)} not yet confirmed` : "nothing pending";
    if (document.activeElement !== $("#stockInput")) $("#stockInput").value = s.stock_total;
    $("#acceptSwitch").checked = !!s.accepting;
    $("#acceptLabel").textContent = s.accepting ? "Open — taking orders" : "Closed";
    const f = $("#settingsForm");
    if (!f.contains(document.activeElement) && !f.dataset.filled) {
      f.dataset.filled = "1";
      $("#sPrice").value = s.price; $("#sBank").value = s.bank_name || ""; $("#sAcct").value = s.account_number || "";
      $("#sAname").value = s.account_name || ""; $("#sIng").value = s.ingredients || "";
    }
  }
  $("#stockSave").onclick = async () => {
    const n = Math.max(0, Math.floor(Number($("#stockInput").value)));
    if (!Number.isFinite(n)) return;
    try { await TX.api.saveStore({ stock_total: n }); TX.toast(`Today's stock set to ${n}`); refresh(); } catch (e) { TX.toast(e.message, "bad"); }
  };
  $("#acceptSwitch").onchange = async (e) => {
    try { await TX.api.saveStore({ accepting: e.target.checked }); TX.toast(e.target.checked ? "Orders are open" : "Orders are closed"); refresh(); }
    catch (ex) { TX.toast(ex.message, "bad"); }
  };
  $("#settingsForm").onsubmit = async (e) => {
    e.preventDefault();
    const price = Math.floor(Number($("#sPrice").value));
    if (!(price > 0)) return TX.toast("Enter a valid price", "bad");
    try {
      await TX.api.saveStore({ price, bank_name: $("#sBank").value.trim(), account_number: $("#sAcct").value.trim(), account_name: $("#sAname").value.trim(), ingredients: $("#sIng").value.trim() });
      TX.toast("Settings saved ✓"); refresh();
    } catch (ex) { TX.toast(ex.message, "bad"); }
  };

  /* ---------- tabs ---------- */
  function drawTabs() {
    if (!S.tabTouched) { // until you pick a tab yourself, show the most urgent one
      const urgent = TABS.find((t) => count(t) > 0 && t.id !== "done");
      S.tab = urgent ? urgent.id : "confirm";
    }
    TX.setHTML($("#tabs"), TABS.map((t) => `<button type="button" role="tab" class="tab ${S.tab === t.id ? "on" : ""} ${t.alert && count(t) ? "alert" : ""}" data-tab="${t.id}">${t.label} <em>${count(t)}</em></button>`).join(""));
  }
  $("#tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) { S.tab = b.dataset.tab; S.tabTouched = true; drawTabs(); drawList(); } };

  /* ---------- order cards ---------- */
  function actions(o) {
    switch (o.status) {
      case "awaiting_payment":
        return `<span class="hint">Customer hasn't tapped “I've paid” yet.</span><button class="btn btn-ghost btn-sm" data-act="cancel" data-id="${o.id}">Cancel</button>`;
      case "payment_sent":
        return `<button class="btn btn-orange" data-act="confirm" data-id="${o.id}">✓ Payment received</button><button class="btn btn-ghost btn-sm" data-act="notpaid" data-id="${o.id}">Not received</button>`;
      case "paid":
        return `<div style="width:100%"><small class="hint" style="font-weight:700">Ready in how many minutes?</small><div class="mins" style="margin-top:6px">${[10, 15, 20, 30].map((m) => `<button data-act="start" data-min="${m}" data-id="${o.id}">${m} min</button>`).join("")}<button data-act="start" data-min="0" data-id="${o.id}">Other…</button></div></div>`;
      case "preparing":
        return `<b class="mono cd" data-eta="${o.eta_at}">--:--</b><button class="btn btn-ghost btn-sm" data-act="plus5" data-id="${o.id}">+5 min</button><button class="btn btn-orange" data-act="ready" data-id="${o.id}">Mark ready</button>`;
      case "ready":
        return `<button class="btn btn-orange" data-act="delivered" data-id="${o.id}">✓ Delivered</button>`;
      default: return "";
    }
  }
  function card(o) {
    const p = o.profile || { name: "Unknown", hall: "", phone: "", icon: "🍞" };
    return `<article class="ocard">
      <div class="top">${TX.avatar(p.icon)}
        <div class="who"><b>${esc(p.name)}</b><small>${esc(p.hall)}</small></div>
        <div class="amt"><b>${o.qty} × ${naira(o.unit_price)}</b><small>${naira(o.total)} · #${TX.orderCode(o)} · ${TX.timeOnly(o.created_at)}</small></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="st ${TX.STATUS[o.status].cls}">${TX.STATUS[o.status].label}</span>
        <span class="contact"><a href="tel:${esc(p.phone)}">📞 ${esc(p.phone)}</a> <a href="${TX.waLink(p.phone, "Hi " + p.name + ", it's Toast Express about your order #" + TX.orderCode(o))}" target="_blank" rel="noopener">WhatsApp</a></span></div>
      <div class="acts">${actions(o)}</div></article>`;
  }
  function drawList() {
    const tab = TABS.find((t) => t.id === S.tab) || TABS[0];
    const rows = S.orders.filter((o) => tab.match.includes(o.status)).reverse(); // newest first
    TX.setHTML($("#olist"), rows.length ? rows.map(card).join("") : `<div class="card empty">Nothing here right now ${tab.id === "confirm" ? "🍞" : "✨"}</div>`);
    tickAll();
  }
  function tickAll() {
    $$(".cd").forEach((el) => { const left = (new Date(el.dataset.eta).getTime() - Date.now()) / 1000; el.textContent = left > 0 ? TX.clock(left) : "Time's up!"; });
  }
  setInterval(tickAll, 1000);

  /* ---------- the buttons on each card ---------- */
  const plus = (mins) => new Date(Date.now() + mins * 60000).toISOString();
  $("#olist").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.dataset.id, o = S.orders.find((x) => x.id === id), act = b.dataset.act;
    let patch = null;
    if (act === "confirm") patch = { status: "paid" };
    if (act === "notpaid") patch = { status: "awaiting_payment" };
    if (act === "cancel") { if (!confirm("Cancel this order? The toast goes back into stock.")) return; patch = { status: "cancelled" }; }
    if (act === "start") {
      let m = Number(b.dataset.min);
      if (!m) { m = Math.floor(Number(prompt("Ready in how many minutes?", "15"))); if (!(m > 0 && m <= 180)) return; }
      patch = { status: "preparing", eta_minutes: m, eta_at: plus(m) };
    }
    if (act === "plus5") { const m = (o.eta_minutes || 0) + 5; patch = { eta_minutes: m, eta_at: new Date(new Date(o.eta_at).getTime() + 5 * 60000).toISOString() }; }
    if (act === "ready") patch = { status: "ready" };
    if (act === "delivered") patch = { status: "delivered" };
    if (!patch) return;
    b.disabled = true;
    try {
      await TX.api.setOrder(id, patch);
      const next = TABS.find((t) => t.match.includes(patch.status || o.status)); // follow the order to its new tab
      if (next) { S.tab = next.id; S.tabTouched = true; }
      await refresh();
    } catch (ex) { TX.toast(ex.message, "bad"); b.disabled = false; }
  });

  /* ---------- reviews: the admin can hide any review from the public site ---------- */
  function drawReviews() {
    const rows = S.reviews || [];
    $("#rvAdminCount").textContent = rows.length ? `(${rows.length})` : "";
    TX.setHTML($("#rlist"), rows.length ? rows.map((r) => {
      const p = r.profile || { name: "Student", hall: "", icon: "🍞" };
      return `<article class="ocard" style="${r.hidden ? "opacity:.6" : ""}">
        <div class="top">${TX.avatar(p.icon)}<div class="who"><b>${esc(p.name)}</b><small>${esc(p.hall)} · ${new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</small></div><span class="rv-stars">${TX.stars(r.rating)}</span></div>
        ${r.comment ? `<p style="margin:0">“${esc(r.comment)}”</p>` : ""}
        <div class="acts"><span class="st ${r.hidden ? "st-cancel" : "st-paid"}">${r.hidden ? "Hidden from site" : "Showing on site"}</span>
        <button class="btn btn-ghost btn-sm" type="button" data-rvhide="${r.id}" data-hide="${r.hidden ? 0 : 1}">${r.hidden ? "Show again" : "Hide"}</button></div></article>`;
    }).join("") : `<div class="card empty">No reviews yet.</div>`);
  }
  $("#rlist").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rvhide]"); if (!b) return;
    try { await TX.api.setReviewHidden(b.dataset.rvhide, b.dataset.hide === "1"); await refresh(); } catch (ex) { TX.toast(ex.message, "bad"); }
  });

  /* ---------- load + repaint + new-payment alert ---------- */
  let busy = false, again = false;
  async function refresh() {
    if (busy) { again = true; return; }
    busy = true;
    do {
      again = false;
      try {
        const [store, orders, reviews] = await Promise.all([TX.api.getStore(), TX.api.todayOrders(), TX.api.allReviews().catch(() => [])]);
        S.store = store; S.orders = orders; S.reviews = reviews;
        const sent = new Set(orders.filter((o) => o.status === "payment_sent").map((o) => o.id));
        if (S.knownSent) { // a payment we haven't seen before → ding
          const fresh = [...sent].filter((id) => !S.knownSent.has(id));
          if (fresh.length) { TX.ping(); TX.toast(`💳 ${fresh.length} customer${fresh.length > 1 ? "s say" : " says"} they paid`); }
        }
        S.knownSent = sent;
        drawTiles(); drawTabs(); drawList(); drawReviews();
      } catch (e) { /* try again next time */ }
    } while (again);
    busy = false;
  }
  await refresh();
  TX.api.onChange(refresh);
})();
