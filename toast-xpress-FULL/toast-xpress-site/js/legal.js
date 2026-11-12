/* legal.js — fills the legal pages from js/config.js (business details, refund days, etc.) */
(function () {
  const C = window.TX_CONFIG, B = C.business || {}, L = C.legal || {};
  const vals = {
    brand: C.brand, campus: C.campus, phone: C.phone,
    legalName: B.legalName, regNo: B.regNo, address: B.address, email: B.email,
    refundDays: L.refundDays, reportHours: L.reportHours, version: L.version, dataRegion: L.dataRegion, allergens: L.allergens,
    halls: (C.halls || []).length ? C.halls[0] + " to " + C.halls[C.halls.length - 1] : ""
  };
  const missing = [];
  document.querySelectorAll("[data-v]").forEach((el) => {
    const k = el.dataset.v, v = vals[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") el.textContent = v;
    else { el.innerHTML = '<mark class="todo">add ' + k + " in js/config.js</mark>"; if (!el.hasAttribute("data-optional")) missing.push(k); }
  });
  document.querySelectorAll("[data-if]").forEach((el) => { if (!String(vals[el.dataset.if] || "").trim()) el.remove(); });
  document.querySelectorAll("[data-tel]").forEach((a) => (a.href = "tel:" + C.phone));
  const y = document.getElementById("yr"); if (y) y.textContent = new Date().getFullYear();
  if (missing.length) {
    const bar = document.createElement("div"); bar.className = "draft-bar"; bar.setAttribute("role", "status");
    bar.textContent = "DRAFT: complete your business details in js/config.js before launch (missing: " + [...new Set(missing)].join(", ") + "). This bar disappears when done.";
    document.body.prepend(bar);
  }
})();
