/* ============================================================
   api.js — the ONE place that talks to the data.
   Pages never touch Supabase or localStorage directly; they call TX.api.*
   Two engines with identical methods:
     • demo      → fake database in your browser (localStorage). Zero setup.
     • supabase  → the real online database.
   Switch engines in js/config.js  (mode: "demo" | "supabase").
   ============================================================ */
(function () {
  const TX = (window.TX = window.TX || {});
  const C = window.TX_CONFIG;

  /* turn technical errors into friendly sentences */
  const friendly = (m = "") => {
    if (/invalid login/i.test(m)) return "Wrong phone number or password.";
    if (/already registered|already exists|duplicate/i.test(m)) return "That phone number already has an account. Try logging in.";
    if (/at least \d+ char/i.test(m)) return "Password must be at least 6 characters.";
    if (/failed to fetch|network/i.test(m)) return "No internet connection. Check your data and try again.";
    return m || "Something went wrong. Please try again.";
  };

  /* ================= DEMO ENGINE ================= */
  function makeDemo() {
    const KEY = "tx_demo_db_v1";      // the database (shared by tabs)
    const SES = "tx_demo_session";    // who is logged in (per tab, so you can test customer + admin side by side)
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id" + Math.random().toString(16).slice(2) + Date.now());

    const seed = () => ({
      users: [{ id: "admin-1", name: "Toast Express", hall: "Kitchen", phone: "08000000000", password: "admin123", icon: "👨‍🍳", role: "admin" }],
      store: { price: C.price, stock_total: 20, accepting: true, bank_name: "Your Bank", account_number: "0123456789", account_name: "Toast Express", ingredients: C.ingredients },
      orders: [],
    });
    const read = () => {
      try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) {}
      const d = seed(); write(d); return d;
    };
    const write = (d) => localStorage.setItem(KEY, JSON.stringify(d));
    const pub = (u) => u && { id: u.id, name: u.name, hall: u.hall, phone: u.phone, icon: u.icon, role: u.role };
    const me = () => { const id = sessionStorage.getItem(SES); return id ? read().users.find((u) => u.id === id) : null; };
    const today = () => TX.todayStr();
    const remaining = (d) =>
      d.store.stock_total - d.orders.filter((o) => o.order_date === today() && o.status !== "cancelled").reduce((s, o) => s + o.qty, 0);
    const need = () => { const u = me(); if (!u) throw new Error("Please log in first."); return u; };
    const needAdmin = () => { const u = need(); if (u.role !== "admin") throw new Error("Admins only."); return u; };

    return {
      async init() {},
      async getUser() { return pub(me()); },
      async signUp({ name, hall, phone, password, icon, consent }) {
        const d = read();
        if (d.users.some((u) => u.phone === phone)) throw new Error(friendly("already registered"));
        const u = { id: uid(), name, hall, phone, password, icon, role: "customer", consented_at: consent && consent.at, terms_version: consent && consent.version };
        d.users.push(u); write(d); sessionStorage.setItem(SES, u.id); return pub(u);
      },
      async signIn(phone, password) {
        const u = read().users.find((x) => x.phone === phone && x.password === password);
        if (!u) throw new Error(friendly("invalid login"));
        sessionStorage.setItem(SES, u.id); return pub(u);
      },
      async signOut() { sessionStorage.removeItem(SES); },
      async updateProfile(patch) {
        const u = need(); const d = read(); const row = d.users.find((x) => x.id === u.id);
        ["icon", "name", "hall"].forEach((k) => { if (patch[k] !== undefined) row[k] = patch[k]; });
        write(d); return pub(row);
      },
      async getStore() {
        const d = read(); const s = { ...d.store, remaining: remaining(d) };
        if (!me()) { delete s.bank_name; delete s.account_number; delete s.account_name; } // bank details only for logged-in users
        return s;
      },
      async saveStore(patch) {
        needAdmin(); const d = read(); Object.assign(d.store, patch); write(d); return d.store;
      },
      async placeOrder(qty) {
        const u = need(); const d = read(); qty = Number(qty);
        if (!d.store.accepting) throw new Error("Orders are closed right now.");
        if (!(qty >= 1 && qty <= C.maxPerOrder)) throw new Error("Choose between 1 and " + C.maxPerOrder + " toasts.");
        const rem = remaining(d);
        if (qty > rem) throw new Error(rem > 0 ? `Only ${rem} left today.` : "Sold out for today.");
        const now = new Date().toISOString();
        const o = { id: uid(), user_id: u.id, qty, unit_price: d.store.price, total: qty * d.store.price, status: "awaiting_payment", eta_at: null, eta_minutes: null, order_date: today(), created_at: now, updated_at: now };
        d.orders.push(o); write(d); return o;
      },
      async payOrder(id) { // customer taps "I've paid"
        const u = need(); const d = read(); const o = d.orders.find((x) => x.id === id && x.user_id === u.id);
        if (!o || o.status !== "awaiting_payment") throw new Error("This order can't be updated.");
        o.status = "payment_sent"; o.updated_at = new Date().toISOString(); write(d); return o;
      },
      async cancelOrder(id) {
        const u = need(); const d = read(); const o = d.orders.find((x) => x.id === id && x.user_id === u.id);
        if (!o || o.status !== "awaiting_payment") throw new Error("Only unpaid orders can be cancelled.");
        o.status = "cancelled"; o.updated_at = new Date().toISOString(); write(d); return o;
      },
      async myOrders() {
        const u = need(), d = read();
        return d.orders.filter((o) => o.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
          .map((o) => ({ ...o, reviewed: (d.reviews || []).some((r) => r.order_id === o.id) }));
      },
      /* ---- reviews ---- */
      async getReviews(limit = 30) { // public: only first name + icon, never phone or hall
        const d = read();
        return (d.reviews || []).filter((r) => !r.hidden).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((r) => {
          const u = d.users.find((x) => x.id === r.user_id) || {};
          return { id: r.id, name: String(u.name || "Student").split(" ")[0], icon: u.icon || "🍞", rating: r.rating, comment: r.comment, created_at: r.created_at };
        });
      },
      async addReview({ order_id, rating, comment }) {
        const u = need(), d = read(); d.reviews = d.reviews || [];
        const o = d.orders.find((x) => x.id === order_id && x.user_id === u.id);
        if (!o) throw new Error("Order not found.");
        if (o.status !== "delivered") throw new Error("You can review once your order is received.");
        if (!(Number(rating) >= 1 && Number(rating) <= 5)) throw new Error("Tap a star to rate your toast.");
        if (d.reviews.some((r) => r.order_id === order_id)) throw new Error("You already reviewed this order.");
        const r = { id: uid(), user_id: u.id, order_id, rating: Number(rating), comment: String(comment || "").trim().slice(0, 280), hidden: false, created_at: new Date().toISOString() };
        d.reviews.push(r); write(d); return r;
      },
      async allReviews() { // admin
        needAdmin(); const d = read();
        return (d.reviews || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ ...r, profile: pub(d.users.find((u) => u.id === r.user_id)) }));
      },
      async setReviewHidden(id, hidden) { // admin
        needAdmin(); const d = read(); const r = (d.reviews || []).find((x) => x.id === id); if (!r) throw new Error("Review not found.");
        r.hidden = !!hidden; write(d); return r;
      },
      async todayOrders() { // admin: today's orders with the customer attached
        needAdmin(); const d = read();
        return d.orders.filter((o) => o.order_date === today()).sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((o) => ({ ...o, profile: pub(d.users.find((u) => u.id === o.user_id)) }));
      },
      async setOrder(id, patch) {
        needAdmin(); const d = read(); const o = d.orders.find((x) => x.id === id); if (!o) throw new Error("Order not found.");
        Object.assign(o, patch, { updated_at: new Date().toISOString() }); write(d); return o;
      },
      onChange(cb) {
        const t = setInterval(cb, C.pollMs);
        const h = (e) => { if (e.key === KEY) cb(); };
        addEventListener("storage", h);
        return () => { clearInterval(t); removeEventListener("storage", h); };
      },
    };
  }

  /* ================= SUPABASE ENGINE ================= */
  function makeSupabase() {
    let sb;
    const emailOf = (phone) => `${phone}@${C.emailDomain}`;
    const ok = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
    const loadScript = (src) => new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load Supabase. Check your internet."));
      document.head.appendChild(s);
    });
    const api = {
      async init() {
        if (!C.supabaseUrl || !C.supabaseAnonKey) throw new Error("Add your Supabase URL and key in js/config.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js");
        sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
      },
      async getUser() {
        const { data } = await sb.auth.getSession(); if (!data.session) return null;
        const r = await sb.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        return r.data || null;
      },
      async signUp({ name, hall, phone, password, icon, consent }) {
        const r = await sb.auth.signUp({ email: emailOf(phone), password, options: { data: { name, hall, phone, icon, consent_at: consent && consent.at, terms_version: consent && consent.version } } });
        if (r.error) throw new Error(friendly(r.error.message));
        if (!r.data.session) throw new Error('Supabase is asking for email confirmation. Turn OFF "Confirm email" (Authentication → Providers → Email).');
        return api.getUser();
      },
      async signIn(phone, password) {
        ok(await sb.auth.signInWithPassword({ email: emailOf(phone), password })); return api.getUser();
      },
      async signOut() { await sb.auth.signOut(); },
      async updateProfile(patch) {
        const u = await api.getUser();
        ok(await sb.from("profiles").update(patch).eq("id", u.id)); return api.getUser();
      },
      async getStore() { return ok(await sb.rpc("get_store")); },
      async saveStore(patch) { return ok(await sb.from("settings").update(patch).eq("id", 1)); },
      async placeOrder(qty) { return ok(await sb.rpc("place_order", { p_qty: Number(qty) })); },
      async payOrder(id) { return ok(await sb.rpc("mark_payment_sent", { p_id: id })); },
      async cancelOrder(id) { return ok(await sb.rpc("cancel_order", { p_id: id })); },
      async myOrders() {
        const u = await api.getUser();
        const rows = ok(await sb.from("orders").select("*, reviews(id)").eq("user_id", u.id).order("created_at", { ascending: false }).limit(30));
        return rows.map((o) => ({ ...o, reviewed: (o.reviews || []).length > 0 }));
      },
      /* ---- reviews ---- */
      async getReviews(limit = 30) { return ok(await sb.rpc("get_reviews", { p_limit: limit })); },
      async addReview({ order_id, rating, comment }) { return ok(await sb.rpc("add_review", { p_order: order_id, p_rating: Number(rating), p_comment: comment || "" })); },
      async allReviews() {
        const rows = ok(await sb.from("reviews").select("*, profiles(name,hall,icon)").order("created_at", { ascending: false }).limit(60));
        return rows.map((r) => ({ ...r, profile: r.profiles }));
      },
      async setReviewHidden(id, hidden) { return ok(await sb.from("reviews").update({ hidden: !!hidden }).eq("id", id)); },
      async todayOrders() {
        const rows = ok(await sb.from("orders").select("*, profiles(name,hall,phone,icon)").eq("order_date", TX.todayStr()).order("created_at"));
        return rows.map((o) => ({ ...o, profile: o.profiles }));
      },
      async setOrder(id, patch) { return ok(await sb.from("orders").update(patch).eq("id", id)); },
      onChange(cb) { const t = setInterval(cb, C.pollMs); return () => clearInterval(t); },
    };
    return api;
  }

  // Every page does:  await TX.ready;  then uses TX.api
  TX.api = C.mode === "supabase" ? makeSupabase() : makeDemo();
  TX.ready = TX.api.init();
})();
