/* ============================================================
   scenes.js — the 4 animated "how to join" toast pictures
   Each scene is plain SVG. The motion lives in styles.css
   (search for "SCENE ANIMATIONS") and starts when the scene's
   parent gets the class  .play
   Step 1 Tap create account  → a bread slice with a button
   Step 2 Fill your details   → 3 fillings drop on (name · hall · phone)
   Step 3 Create password     → 2nd slice + hot press (lock)
   Step 4 Sign in + icon      → plated toast + emoji icons
   ============================================================ */
(function () {
  const TX = (window.TX = window.TX || {});

  // One bread-slice outline reused by every scene (centre ≈ 200,148)
  const BREAD = "M108 128C86 128 76 104 94 84C112 62 152 58 200 58C248 58 288 62 306 84C324 104 314 128 292 128L292 222Q292 238 276 238L124 238Q108 238 108 222Z";
  const bread = (crust = "#d98a3d", inner = "#fbe2ae") =>
    `<path d="${BREAD}" fill="${crust}"/><path d="${BREAD}" fill="${inner}" transform="translate(200 148) scale(.9 .88) translate(-200 -148)"/>`;

  // fillings (each is centred on 0,0 and moved with translate)
  const egg = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-38 4C-44-16-20-30 2-26C24-34 44-12 38 8C34 28 6 34-12 28C-28 26-36 20-38 4Z" fill="#fff"/><circle cx="2" cy="0" r="13" fill="#ffb81c"/><circle cx="-2" cy="-4" r="4" fill="#ffe08a"/></g>`;
  const suya = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-37" y="-15" width="74" height="30" rx="13" fill="#8a3412"/><rect x="-37" y="-15" width="74" height="12" rx="9" fill="#b04f1f" opacity=".7"/><circle cx="-20" cy="-2" r="2.4" fill="#ff8a2a"/><circle cx="-4" cy="6" r="2.4" fill="#ff8a2a"/><circle cx="12" cy="-4" r="2.4" fill="#ff8a2a"/><circle cx="25" cy="5" r="2.4" fill="#ff8a2a"/></g>`;
  const sausage = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-44" y="-13" width="88" height="26" rx="13" fill="#c4553b"/><rect x="-36" y="-8" width="72" height="5" rx="2.5" fill="#e07a5c" opacity=".8"/></g>`;

  const lock = (x, y) =>
    `<g transform="translate(${x} ${y})"><circle r="24" fill="#ff6a13" stroke="#fff" stroke-width="4"/><rect x="-9" y="-3" width="18" height="14" rx="3" fill="#fff"/><path d="M-5 -3V-8a5 5 0 0 1 10 0V-3" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></g>`;

  const grillLines = (from, to, step) => {
    let d = "";
    for (let x = from; x <= to; x += step) d += `M${x} 235 L${x + 120} 115 `;
    return d;
  };

  const scenes = {
    /* ---------- STEP 1: tap "Create account" ---------- */
    1: (u) => `
<svg class="sc" viewBox="0 0 400 300" role="img" aria-label="A happy slice of bread with a Create account button being tapped">
  <ellipse cx="200" cy="268" rx="96" ry="11" fill="#000" opacity=".35"/>
  <g class="s1-bread">
    ${bread()}
    <circle cx="168" cy="100" r="5.5" fill="#5a3a1a"/><circle cx="232" cy="100" r="5.5" fill="#5a3a1a"/>
    <circle cx="150" cy="112" r="8" fill="#ff9b6b" opacity=".55"/><circle cx="250" cy="112" r="8" fill="#ff9b6b" opacity=".55"/>
    <path d="M188 108Q200 120 212 108" fill="none" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g class="s1-pill"><g class="s1-press">
    <rect x="136" y="156" width="128" height="40" rx="20" fill="#ff6a13"/>
    <text x="200" y="181" text-anchor="middle" font-size="14.5" font-weight="800" fill="#fff" font-family="'DM Sans',system-ui,sans-serif">Create account</text>
  </g></g>
  <g class="s1-rip"><circle cx="228" cy="178" r="26" fill="none" stroke="#fff" stroke-width="4"/></g>
  <g class="s1-rip s1-rip2"><circle cx="228" cy="178" r="26" fill="none" stroke="#ff6a13" stroke-width="4"/></g>
  <g transform="translate(222 172)"><g class="s1-hand"><path d="M0 0L0 26L7 20L12 32L18 29L13 18L22 18Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></g></g>
</svg>`,

    /* ---------- STEP 2: three fillings = name, hall, phone ---------- */
    2: (u) => `
<svg class="sc" viewBox="0 0 400 300" role="img" aria-label="Egg, suya and sausage dropping onto a slice of bread">
  <ellipse cx="200" cy="268" rx="96" ry="11" fill="#000" opacity=".35"/>
  ${bread()}
  <g class="s2-f s2-f1">${egg(164, 140)}</g>
  <g class="s2-f s2-f2">${suya(240, 132, 14)}</g>
  <g class="s2-f s2-f3">${sausage(204, 196)}</g>
  <path class="s2-sauce" pathLength="1" d="M128 118Q148 96 168 120T208 118T248 122T280 112" fill="none" stroke="#ff6a13" stroke-width="7" stroke-linecap="round"/>
</svg>`,

    /* ---------- STEP 3: top slice + hot press = password ---------- */
    3: (u) => `
<svg class="sc" viewBox="0 0 400 300" role="img" aria-label="A hot press toasting the sandwich with a lock on it">
  <defs><clipPath id="c3${u}"><path d="${BREAD}"/></clipPath></defs>
  <ellipse cx="200" cy="268" rx="96" ry="11" fill="#000" opacity=".35"/>
  ${bread()}
  <g opacity=".95">${egg(164, 150)}${suya(240, 142, 14)}${sausage(204, 200)}</g>
  <g class="s3-top">${bread("#d98a3d", "#f7d28f")}
    <g class="s3-marks" clip-path="url(#c3${u})"><path d="${grillLines(40, 300, 30)}" stroke="#8a4a14" stroke-width="9" stroke-linecap="round" opacity=".55"/></g>
  </g>
  <g class="s3-press">
    <rect x="86" y="46" width="228" height="208" rx="26" fill="#1b1b1d" stroke="#3a3a3d" stroke-width="3"/>
    <g stroke="#2e2e31" stroke-width="6" stroke-linecap="round"><path d="M120 80H280M120 110H280M120 140H280M120 170H280M120 200H280"/></g>
    <rect x="160" y="22" width="80" height="26" rx="13" fill="#ff6a13"/>
  </g>
  <g class="s3-lock">${lock(304, 78)}</g>
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0">
    <path class="s3-steam st1" d="M160 54Q150 40 160 28"/><path class="s3-steam st2" d="M200 48Q190 34 200 22"/><path class="s3-steam st3" d="M240 54Q230 40 240 28"/>
  </g>
</svg>`,

    /* ---------- STEP 4: plated toast + pick an icon ---------- */
    4: (u) => {
      const emo = [["😎", 50, 62], ["🤩", 350, 62], ["😋", 46, 140], ["🥳", 354, 140], ["🐼", 50, 225], ["🔥", 350, 225]];
      return `
<svg class="sc" viewBox="0 0 400 300" role="img" aria-label="A plated toast with cute profile icons around it">
  <defs>
    <clipPath id="a4${u}"><polygon points="122,215 200,125 200,215"/></clipPath>
    <clipPath id="b4${u}"><polygon points="214,215 214,125 292,215"/></clipPath>
  </defs>
  <g class="s4-plate">
    <ellipse cx="200" cy="268" rx="112" ry="11" fill="#000" opacity=".35"/>
    <circle cx="200" cy="165" r="110" fill="#e9e7e2"/><circle cx="200" cy="165" r="102" fill="#fff"/><circle cx="200" cy="165" r="84" fill="none" stroke="#ecebe6" stroke-width="2"/>
  </g>
  <g class="s4-a">
    <polygon points="122,215 200,125 200,215" fill="#f6d9a0" stroke="#d98a3d" stroke-width="8" stroke-linejoin="round"/>
    <g clip-path="url(#a4${u})"><path d="${grillLines(60, 200, 20)}" stroke="#a5611f" stroke-width="6" opacity=".55"/></g>
    <line x1="126" y1="211" x2="196" y2="131" stroke="#ffcf5a" stroke-width="9" stroke-linecap="round"/>
    <circle cx="150" cy="180" r="3.2" fill="#c4553b"/><circle cx="172" cy="156" r="3.2" fill="#8a3412"/>
  </g>
  <g class="s4-b">
    <polygon points="214,215 214,125 292,215" fill="#f6d9a0" stroke="#d98a3d" stroke-width="8" stroke-linejoin="round"/>
    <g clip-path="url(#b4${u})"><path d="${grillLines(190, 330, 20)}" stroke="#a5611f" stroke-width="6" opacity=".55"/></g>
    <line x1="218" y1="131" x2="288" y2="211" stroke="#ffcf5a" stroke-width="9" stroke-linecap="round"/>
    <circle cx="236" cy="156" r="3.2" fill="#c4553b"/><circle cx="262" cy="182" r="3.2" fill="#8a3412"/>
  </g>
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
    <path class="s4-steam st1" d="M170 108Q160 94 170 82"/><path class="s4-steam st2" d="M206 100Q196 86 206 74"/><path class="s4-steam st3" d="M246 108Q236 94 246 82"/>
  </g>
  ${emo.map((e, i) => `<text class="s4-e s4-e${i + 1}" x="${e[1]}" y="${e[2] + 12}" text-anchor="middle" font-size="36">${e[0]}</text>`).join("")}
  <circle class="s4-ring" cx="350" cy="62" r="29" fill="none" stroke="#ff6a13" stroke-width="5" pathLength="1"/>
  <g class="s4-tick"><circle cx="372" cy="40" r="11" fill="#ff6a13"/><path d="M366 40l4 4 8-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
    },
  };

  // TX.scene(1..4, uniqueSuffix) → svg markup.  The suffix keeps clipPath ids unique if you show the same scene twice.
  TX.scene = (n, u = "x") => scenes[n](u);
})();
