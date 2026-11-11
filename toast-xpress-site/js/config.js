/* ============================================================
   config.js  —  the ONLY file you edit to change basic settings
   ============================================================ */
window.TX_CONFIG = {
  // ---- Brand (change text here, it updates everywhere) ----
  brand: "Toast Express",
  tagline: "Toasties delivered to your hall",
  campus: "ESUI",
  phone: "08107522949",          // shown in the footer and used for WhatsApp / call buttons

  // ---- Business details (REQUIRED before you launch: the legal pages and footer read these) ----
  // Leave "" for anything you don't have yet. The legal pages show a yellow "add this" marker until it's filled.
  business: {
    legalName: "",                // your full legal name (if you run it as yourself) OR your registered business name
    regNo: "",                    // CAC registration number, e.g. "BN 1234567". Leave "" if not registered yet
    address: "",                  // where Toast Express is run from, e.g. "Hall 3, ESUI campus, Ebonyi State"
    email: ""                     // an email students can write to (privacy requests, complaints)
  },

  // ---- Legal settings (used by privacy / terms / refunds pages) ----
  legal: {
    version: "2026-11-10",        // change this date whenever you edit the legal pages
    refundDays: 3,                // we promise to send refunds within this many working days
    reportHours: 24,              // students must report a problem with an order within this many hours
    dataRegion: "",               // where your Supabase project is hosted, e.g. "Europe (Frankfurt)". Fill this in when you go live
    // shown on the menu and order page. Edit so it is TRUE for your recipe:
    allergens: "Contains wheat (bread) and eggs. Suya spice may contain groundnuts (peanuts) and other allergens. If you have an allergy, ask us before you order."
  },

  // ---- Hero video (the realistic toast animation you generate) ----
  // 1) Save your video as  assets/hero.mp4  (optionally also assets/hero.webm)   2) refresh. That's it.
  // If the file isn't there yet, the poster photo shows instead.
  video: {
    mp4: "assets/hero.mp4",
    webm: "assets/hero.webm",
    poster: "assets/toast.jpg",   // shown while loading / if there's no video. Best: a frame from your video.
    ratio: "4 / 5",                // your video's shape: "4 / 5" tall, "1 / 1" square, "16 / 9" wide, "9 / 16" phone-tall
    text: "TOAST EXPRESS"         // the wordmark placed over the video. "" = no text
  },

  // ---- Footer extras (leave "" to hide) ----
  instagram: "",                  // e.g. "https://instagram.com/yourpage"
  tiktok: "",
  hours: "",                      // e.g. "Mon–Sat · 10am – 8pm"

  // ---- Starting values (the admin can change price/stock/bank later from the admin page) ----
  price: 2500,                    // ₦ per toast
  ingredients: "Chicken suya, beef suya, sausage, eggs and the special Toast Express sauce, toasted between slices of bread.",
  maxPerOrder: 5,                 // most toasts one student can order at once

  // ---- Where the data lives ----
  // "demo"     = works instantly, fake data saved in YOUR browser only (great for learning/testing)
  // "supabase" = real online database shared by everyone (fill in the two keys below)
  mode: "supabase",
  supabaseUrl: "https://xxpxzwzabxngplooqtqr.supabase.co",                // e.g. https://abcdxyz.supabase.co
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4cHh6d3phYnhuZ3Bsb29xdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTk2MTYsImV4cCI6MjEwOTg3NTYxNn0.oh-rJKvqET_lQevdxKi1AkrrYiV-dug2lhyWkvkGGEg",            // the "anon public" key from Supabase → Project Settings → API

  // Students log in with their phone number. Supabase wants an email, so we make a private one:
  // 08012345678  →  08012345678@toastxpress.app   (no email is ever sent)
  emailDomain: "toastxpress.app",

  pollMs: 4000,                   // how often pages refresh the live numbers (milliseconds)

  // ---- The halls you deliver to. Students pick one from a dropdown when they sign up. ----
  // To add or rename a hall, edit this list (that's all).
  halls: ["Hall 1", "Hall 2", "Hall 3", "Hall 4", "Hall 5", "Hall 6", "Hall 7", "Hall 8"],

  // ---- Profile icons students can pick from ----
  icons: ["😎","🤩","😋","🥳","😺","🐼","🦁","🐯","🦊","🐸","🐵","🦄",
          "👻","🤖","🔥","⭐","🍕","🍔","🌮","🍩","🍓","🥑","🏀","🎧"]
};
