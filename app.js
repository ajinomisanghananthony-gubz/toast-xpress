/* ============================================================
   app.js — the customer's page
   Flow:  load data → draw screen → every few seconds load again
   (draw functions only repaint when something changed, so it never flickers)
   ============================================================ */
(async function () {
  const { $, $$, esc, naira } = TX;
  const C = window.TX_CONFIG;
  try { await TX.ready; } catch (e) { TX.toast(e.message, "bad"); return; }

  let user = await TX.api.getUser();
  if (!user) { location.replace("index.html"); return; }
  if (user.role === "admin") $("#kitchenLink").hidden = false;

  const S = { store: null, orders: [], reviews: [], qty: 1, seen: {} };

  /* ---------- top bar + profile ---------- */
  function drawMe() {
    $("#meBtn").innerHTML = `${TX.avatar(user.icon)}<span>${esc(user.name.split(" ")[0])}</span>`;
    TX.setHTML($("#hello"), `<h1>Hey ${esc(user.name.split(" ")[0])} ${esc(user.icon)}</h1><p>${esc(user.hall)} · ${esc(user.phone)}</p>`);
  }
  $("#meBtn").onclick = () => {
    $("#pAvatar").innerHTML = TX.avatar(user.icon, "lg");
    $("#pName").textContent = user.name;
    $("#pInfo").textContent = `${user.hall} · ${user.phone}`;
    $("#profileIcons").innerHTML = TX.iconGrid(user.icon);
    try { if ($("#recFields") && TX.recoveryFields) { $("#recFields").innerHTML = TX.recoveryFields("r"); TX.bindRecovery("r"); $("#recErr").textContent = ""; TX.api.hasRecovery().then((h) => ($("#recState").textContent = h ? "· set ✅" : "· not set yet ⚠️")).catch(() => {}); } } catch (e) {}
    $("#profile").showModal();
  };
  if ($("#recForm")) $("#recForm").onsubmit = async (e) => {
    e.preventDefault();
    try { const r = TX.readRecovery("r"); await TX.api.setRecovery(r.question, r.answer); $("#recState").textContent = "· set ✅"; $("#rA").value = ""; $("#recErr").textContent = ""; TX.toast("Recovery question saved"); }
    catch (ex) { $("#recErr").textContent = ex.message; }
  };
  $("#profileIcons").onclick = async (e) => {
    const b = e.target.closest(".ico"); if (!b) return;
    try { user = await TX.api.updateProfile({ icon: b.dataset.icon }); drawMe(); $("#pAvatar").innerHTML = TX.avatar(user.icon, "lg"); $("#profileIcons").innerHTML = TX.iconGrid(user.icon); TX.toast("Icon updated"); }
    catch (ex) { TX.toast(ex.message, "bad"); }
  };
  $("#logoutBtn").onclick = async () => { await TX.api.signOut(); location.href = "index.html"; };
  $("#profile").addEventListener("click", (e) => { if (e.target === e.currentTarget || e.target.closest("[data-close]")) e.currentTarget.close(); });

  // existing students who never set a recovery question get asked once per visit
  TX.api.hasRecovery().then((h) => { if (!h && $("#recForm") && !sessionStorage.getItem("tx_rec_nudged")) { try { sessionStorage.setItem("tx_rec_nudged", "1"); } catch (e) {} $("#meBtn").click(); const d = document.querySelector("#profile .rec"); if (d) d.open = true; } }).catch(() => {});

  /* ---------- the "order now" card ---------- */
  function drawOrderCard() {
    const s = S.store; if (!s) return;
    const max = Math.max(1, Math.min(C.maxPerOrder, s.remaining));
    if (S.qty > max) S.qty = max;
    const pct = s.stock_total > 0 ? Math.max(0, Math.min(100, (s.remaining / s.stock_total) * 100)) : 0;
    const low = s.remaining > 0 && s.remaining <= 5;
    let action;
    if (!s.accepting) action = `<div class="closed">Orders are closed right now 🌙</div>`;
    else if (s.remaining <= 0) action = `<div class="closed">Sold out for today. See you tomorrow! 🍞</div>`;
    else action = `<div class="buyrow">
        <div class="qty"><button type="button" data-qty="-1" aria-label="One less">−</button><b id="qtyNum">${S.qty}</b><button type="button" data-qty="1" aria-label="One more">+</button></div>
        <div class="total" id="totalNum">${naira(S.qty * s.price)}</div></div>
        <button class="btn btn-orange btn-lg btn-block" id="placeBtn" type="button" style="margin-top:16px">Place order</button>`;
    TX.setHTML($("#orderCard"), `<div class="card-ink">
      <div class="oc-photo"><img src="assets/toast.jpg" alt="Toast Express toast"><div class="price-bubble">${naira(s.price)}</div></div>
      <div class="oc-title"><h2>The Express toast</h2></div>
      <p>${esc(s.ingredients)}</p>
      <div class="stock ${low ? "low" : ""}"><b>${Math.max(0, s.remaining)}</b><span>toasts left today${low ? " — almost gone!" : ""}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${action}
      <p class="allergen">${esc((C.legal && C.legal.allergens) || "")}</p></div>`);
  }
  $("#orderCard").addEventListener("click", async (e) => {
    const q = e.target.closest("[data-qty]");
    if (q) {
      const max = Math.max(1, Math.min(C.maxPerOrder, S.store.remaining));
      S.qty = Math.min(max, Math.max(1, S.qty + Number(q.dataset.qty)));
      $("#qtyNum").textContent = S.qty; $("#totalNum").textContent = naira(S.qty * S.store.price);
      $("#orderCard").__html = null; // next full redraw is allowed
    }
    if (e.target.closest("#placeBtn")) {
      const btn = e.target.closest("#placeBtn"); btn.disabled = true; btn.textContent = "Placing…";
      try { await TX.api.placeOrder(S.qty); S.qty = 1; TX.toast("Order placed! Now pay to confirm 💳"); await refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      catch (ex) { TX.toast(ex.message, "bad"); await refresh(); }
    }
  });

  /* ---------- the live order tracker ---------- */
  const STEP_INDEX = { awaiting_payment: 0, payment_sent: 0, paid: 1, preparing: 2, ready: 3, delivered: 4 };
  const timeline = (status) => {
    const i = STEP_INDEX[status], labels = ["Placed", "Paid", "Toasting", "Ready", "Received"];
    return `<ol class="tl" aria-label="Order progress">${labels.map((l, k) => `<li class="${k < i ? "done" : k === i ? (status === "delivered" ? "done" : "now") : ""}">${l}</li>`).join("")}</ol>`;
  };
  const RING = 2 * Math.PI * 80;

  function drawActive() {
    const o = S.orders.find((x) => x.order_date === TX.todayStr() && x.status !== "cancelled");
    const box = $("#activeOrder");
    if (!o) { TX.setHTML(box, ""); return; }
    const s = S.store || {};
    const head = `<div class="row"><span class="st ${TX.STATUS[o.status].cls}">${TX.STATUS[o.status].label}</span><span class="hint">Order #${TX.orderCode(o)} · ${o.qty} toast${o.qty > 1 ? "s" : ""} · ${naira(o.total)}</span></div>`;
    let body = "";
    if (o.status === "awaiting_payment") {
      body = `<h2>Pay ${naira(o.total)} to confirm</h2><p class="big">Copy the account number, pay in your bank app, then come back and tap “I've paid”.</p>
        <p class="name-note"><b>Important:</b> pay from a bank account in the name <b>${esc(user.name)}</b> (the name on your profile). If the account name is different, contact us on <a href="${wa(o)}" target="_blank" rel="noopener">WhatsApp</a> with a photo of your payment receipt. Confirming your payment will take longer.</p>
        <div class="pay-box"><small>${esc(s.bank_name || "Bank")} · ${esc(s.account_name || "")}</small>
          <div class="acct"><b>${esc(s.account_number || "—")}</b><button class="btn btn-ink btn-sm" type="button" data-copy="${esc(s.account_number || "")}">Copy</button></div>
          <small>Tip: put <b>${TX.orderCode(o)}</b> as the narration so we can match your payment fast.</small></div>
        <div class="stack"><button class="btn btn-orange btn-lg btn-block" type="button" data-pay="${o.id}">I've paid ✅</button>
        <button class="link hint" type="button" data-cancel="${o.id}">Cancel this order</button></div>`;
    } else if (o.status === "payment_sent") {
      body = `<h2>Checking your payment…</h2><div class="waiting"><span class="bounce">🍞</span><span>We're confirming your transfer. This usually takes a minute or two.</span></div>
        <p class="name-note">We match the sender's account name to <b>${esc(user.name)}</b>. Paid from a different name? <a href="${wa(o)}" target="_blank" rel="noopener">Contact us on WhatsApp</a> with a photo of your receipt; it will take longer to confirm.</p>`;
    } else if (o.status === "paid") {
      body = `<h2>Payment confirmed ✅</h2><div class="waiting"><span class="bounce">👨‍🍳</span><span>Your toast is next in line. Your time estimate is coming…</span></div>`;
    } else if (o.status === "preparing") {
      body = `<h2>Your toast is being made</h2><div class="countdown"><div class="ring"><svg viewBox="0 0 180 180"><circle class="trk" cx="90" cy="90" r="80" fill="none" stroke-width="12"/><circle class="prg" id="ringPrg" cx="90" cy="90" r="80" fill="none" stroke-width="12" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg>
        <div class="mid"><small>Estimated ready in</small><b class="mono" id="cdText">--:--</b></div></div></div>`;
    } else if (o.status === "ready") {
      body = `<div class="cheer"><span class="em">🎉</span><h2>Your toast is ready!</h2><p class="big">It's on its way to ${esc(user.hall)}. Keep your phone close.</p></div>`;
    } else if (o.status === "delivered") {
      body = `<div class="cheer"><span class="em">✅</span><h2>Order received</h2><p class="big">Enjoy your toast! Hungry again? Order below.</p></div>` +
        (o.reviewed ? `<p class="hint" style="text-align:center">Thanks for your review ⭐</p>`
          : `<div class="stack"><button class="btn btn-orange btn-lg btn-block" type="button" data-review="${o.id}">⭐ Leave a review (optional)</button></div>`);
    }
    TX.setHTML(box, `<div class="active" data-eta="${o.eta_at || ""}" data-min="${o.eta_minutes || ""}">${head}${timeline(o.status)}${body}</div>`);
    tick();
  }
  /* ---------- payment pop-up: pay from an account in your own name ---------- */
  const wa = (o) => TX.waLink(C.phone, "Hi Toast Express, my order #" + TX.orderCode(o) + " was paid from an account with a different name. Here is my payment receipt:");
  function payPopup(o, confirmMode) {
    return new Promise((resolve) => {
      let d = document.getElementById("payNotice"); if (d) d.remove();
      d = document.createElement("dialog"); d.className = "modal"; d.id = "payNotice"; d.setAttribute("aria-label", "Pay from an account in your name");
      d.innerHTML = `<div class="m-body" style="padding-top:26px"><h3>Before you pay</h3>
        <p class="sub">Pay from a bank account with the <b>same name as your profile</b>:</p>
        <p class="name-note" style="text-align:center;font-size:1.1rem"><b>${esc(user.name)}</b></p>
        <p class="sub">If the account name is <b>different</b>, contact us on WhatsApp and send a <b>photo or screenshot of your payment receipt</b>. We'll verify it, but it takes longer.</p>
        <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:6px">${confirmMode
          ? `<button class="btn btn-orange btn-lg" style="width:100%;box-sizing:border-box;white-space:normal;line-height:1.25;min-width:0" type="button" data-r="yes">Yes, the name matches. I've paid ✅</button>`
          : `<button class="btn btn-orange btn-lg" style="width:100%;box-sizing:border-box;white-space:normal;line-height:1.25;min-width:0" type="button" data-r="ok">OK, I understand</button>`}
          <a class="btn btn-ghost" style="width:100%;box-sizing:border-box;white-space:normal;line-height:1.25;min-width:0;text-align:center" target="_blank" rel="noopener" href="${wa(o)}" data-r="wa">Different name? WhatsApp us the receipt</a>
          ${confirmMode ? `<button class="link hint" type="button" data-r="no">Not yet, go back</button>` : ""}</div></div>`;
      d.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b) { if (e.target === d) { d.close(); resolve(false); d.remove(); } return; } const r = b.dataset.r; if (r === "wa") return; d.close(); d.remove(); resolve(r === "yes" || r === "ok"); });
      d.addEventListener("cancel", () => resolve(false));
      document.body.appendChild(d); d.showModal();
    });
  }
  const noticed = new Set();
  const origDraw = drawActive;
  drawActive = function () { // first time a pay screen shows for an order, pop the notice
    origDraw();
    const o = S.orders.find((x) => x.order_date === TX.todayStr() && x.status === "awaiting_payment");
    if (o && !noticed.has(o.id)) { noticed.add(o.id); payPopup(o, false); }
  };
  $("#activeOrder").addEventListener("click", async (e) => {
    const cp = e.target.closest("[data-copy]"); if (cp) return TX.copy(cp.dataset.copy);
    const pay = e.target.closest("[data-pay]"), can = e.target.closest("[data-cancel]");
    try {
      if (pay) { const po = S.orders.find((x) => x.id === pay.dataset.pay); if (po && !(await payPopup(po, true))) return; await TX.api.payOrder(pay.dataset.pay); TX.toast("Thanks! We're checking your payment."); await refresh(); }
      if (can && confirm("Cancel this order?")) { await TX.api.cancelOrder(can.dataset.cancel); TX.toast("Order cancelled"); await refresh(); }
    } catch (ex) { TX.toast(ex.message, "bad"); }
  });

  // runs every second: only moves the countdown, never repaints the page
  function tick() {
    const a = $(".active"); const txt = $("#cdText"); if (!a || !txt || !a.dataset.eta) return;
    const left = (new Date(a.dataset.eta).getTime() - Date.now()) / 1000, total = Number(a.dataset.min) * 60 || 1;
    txt.textContent = left > 0 ? TX.clock(left) : "Almost!";
    // ring starts FULL and empties as the minutes run out
    $("#ringPrg").style.strokeDashoffset = RING * (1 - Math.max(0, Math.min(1, left / total)));
  }
  setInterval(tick, 1000);

  /* ---------- history ---------- */
  function drawHistory() {
    const rows = S.orders;
    $("#historyCard").hidden = rows.length === 0;
    TX.setHTML($("#history"), rows.map((o) => `<div class="hist-row"><div><b>${o.qty} toast${o.qty > 1 ? "s" : ""} · ${naira(o.total)}</b><small>#${TX.orderCode(o)} · ${new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} ${TX.timeOnly(o.created_at)}</small></div><span class="st ${TX.STATUS[o.status].cls}">${TX.STATUS[o.status].label}</span>${o.status === "delivered" && !o.reviewed ? `<button class="link hint" type="button" data-review="${o.id}">Leave a review</button>` : ""}</div>`).join(""));
  }

  /* ---------- tell the student when something changes ---------- */
  const MESSAGES = {
    paid: "Payment confirmed ✅", preparing: "Your toast is being made 🔥", ready: "Your toast is ready! 🎉", delivered: "Order received ✓",
  };
  function notifyChanges() {
    S.orders.forEach((o) => {
      const prev = S.seen[o.id];
      if (prev && prev !== o.status && MESSAGES[o.status]) {
        TX.toast(MESSAGES[o.status] + (o.status === "preparing" && o.eta_minutes ? ` · estimated ready in ${o.eta_minutes} min` : ""));
        TX.ping();
      }
      S.seen[o.id] = o.status;
    });
  }

  /* ---------- optional review after the order is received ---------- */
  const rv = { orderId: null, rating: 0 };
  const reviewDlg = $("#reviewDlg");
  const paintStars = () => $$("#starInput button").forEach((b) => { b.classList.toggle("on", Number(b.dataset.star) <= rv.rating); b.setAttribute("aria-pressed", Number(b.dataset.star) === rv.rating); });
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-review]");
    if (open) { // any "Leave a review" button opens the pop-up for that order
      rv.orderId = open.dataset.review; rv.rating = 0; $("#rvText").value = ""; $("#rvCount").textContent = "0"; $("#rvErr").textContent = "";
      paintStars(); reviewDlg.showModal();
    }
    const star = e.target.closest("#starInput [data-star]"); if (star) { rv.rating = Number(star.dataset.star); paintStars(); $("#rvErr").textContent = ""; }
    if (e.target === reviewDlg || e.target.closest("#reviewDlg [data-close]")) reviewDlg.close();
  });
  $("#rvText").addEventListener("input", (e) => ($("#rvCount").textContent = e.target.value.length));
  $("#rvPost").onclick = async () => {
    if (!rv.rating) { $("#rvErr").textContent = "Tap a star to rate your toast."; return; }
    const btn = $("#rvPost"); btn.disabled = true;
    try {
      await TX.api.addReview({ order_id: rv.orderId, rating: rv.rating, comment: $("#rvText").value.trim() });
      reviewDlg.close(); TX.toast("Thank you for your review! ⭐"); await refresh();
    } catch (ex) { $("#rvErr").textContent = ex.message; }
    btn.disabled = false;
  };

  /* ---------- load everything, repaint ---------- */
  let busy = false, again = false;
  async function refresh() {
    if (busy) { again = true; return; } // a refresh is running: run once more right after it
    busy = true;
    do {
      again = false;
      try {
        const [store, orders, reviews] = await Promise.all([TX.api.getStore(), TX.api.myOrders(), TX.api.getReviews(30).catch(() => [])]);
        S.store = store; S.orders = orders; S.reviews = reviews; TX.renderReviews(reviews);
        notifyChanges(); drawMe(); drawActive(); drawOrderCard(); drawHistory();
      } catch (e) { /* offline blip: try again next time */ }
    } while (again);
    busy = false;
  }
  await refresh();
  TX.api.onChange(refresh);
})();
