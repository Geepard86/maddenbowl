/* =========================================================================
   SONG-SZENEN — Zwischenschnitte fürs Musikvideo (genutzt von song-stage.js)
   -------------------------------------------------------------------------
   * render(id, params)  -> SVG-Markup (1920x780) für eine Szene
   * buildScript(ctx, timing, duration) -> deterministische Schnittliste
     (Seed aus ctx.seed: gleiche Eingabe = gleiches Video, auch beim erneuten
      Abspielen/Aufnehmen)
   * Textreaktiv: Wort-Timings werden fuzzy gegen Schlagwörter, Spieler-,
     Team- und Zielnamen aus dem Prompt-Kontext gematcht.
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ Helfer
  const svg = (inner, defs) => `<svg viewBox="0 0 1920 780" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>${defs || ""}</defs>${inner}</svg>`;
  const grad = (a, b) => `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const bgRect = `<rect width="1920" height="780" fill="url(#bg)"/>`;
  const txt = (x, y, s, size, fill, stroke) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="${size}" fill="${fill || "#fff"}" stroke="${stroke || "rgba(0,0,0,.6)"}" stroke-width="${Math.max(3, size / 22)}" paint-order="stroke" letter-spacing="3">${esc(s)}</text>`;
  const fitSize = (s, max, per) => Math.max(34, Math.min(max, (per || 1500) / Math.max(4, String(s).length * 0.62)));
  const SKINS = ["#e0ac82", "#7a4a2b", "#f0c4a0", "#a5683a", "#5b3720", "#d9a074"];

  function person(x, y, s, o) {
    o = o || {};
    const skin = o.skin || SKINS[(o.k || 0) % SKINS.length], top = o.top || "#c00", bot = o.bot || "#222", hair = o.hair || "#2a1a10";
    const arms = o.up
      ? `<path d="M-22 -122 L-48 -176 M22 -122 L48 -176" stroke="${skin}" stroke-width="13" stroke-linecap="round" fill="none"/>`
      : `<path d="M-24 -120 L-36 -66 M24 -120 L36 -66" stroke="${skin}" stroke-width="13" stroke-linecap="round" fill="none"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})"><g class="${o.cls || ""}" style="animation-delay:${o.d || 0}s">` +
      `<path d="M-12 0 L-12 -62 M12 0 L12 -62" stroke="${bot}" stroke-width="17" stroke-linecap="round"/>` +
      (o.skirt ? `<path d="M-30 -64 L30 -64 L42 -32 L-42 -32Z" fill="${o.skirt}"/>` : "") +
      `<rect x="-27" y="-134" width="54" height="76" rx="15" fill="${top}"/>${arms}` +
      `<circle cx="0" cy="-156" r="22" fill="${skin}"/><path d="M-22 -160 Q-20 -184 0 -184 Q20 -184 22 -160 Q10 -170 0 -170 Q-10 -170 -22 -160Z" fill="${o.cap || hair}"/>` +
      `${o.extra || ""}</g></g>`;
  }
  const pompoms = (c) => `<g class="a-shake"><circle cx="-50" cy="-182" r="19" fill="${c}"/><circle cx="-62" cy="-170" r="13" fill="#fff"/><circle cx="50" cy="-182" r="19" fill="${c}"/><circle cx="62" cy="-170" r="13" fill="#fff"/></g>`;
  const confetti = (n, cols) => Array.from({ length: n }, (_, i) => `<rect class="a-conf" x="${(i * 211) % 1900 + 10}" y="-30" width="14" height="22" fill="${cols[i % cols.length]}" style="animation-delay:${((i * 37) % 20) / 10}s;animation-duration:${2.2 + (i % 5) * .35}s"/>`).join("");

  // ------------------------------------------------------------ Maskottchen
  const MASCOT_TYPE = { cardinals: "bird", falcons: "bird", ravens: "bird", eagles: "bird", seahawks: "bird", panthers: "cat", bengals: "cat", lions: "cat", jaguars: "cat",
    broncos: "horse", colts: "horse", bears: "bear", browns: "dog", chargers: "dog", bills: "bull", texans: "bull", rams: "bull", dolphins: "fish" };
  function mascotType(team) { const t = String(team || "").toLowerCase(); for (const k of Object.keys(MASCOT_TYPE)) if (t.includes(k)) return MASCOT_TYPE[k]; return "helmet"; }
  function mascotSVG(type, c1, c2) {
    const eyes = `<circle cx="160" cy="150" r="24" fill="#fff"/><circle cx="240" cy="150" r="24" fill="#fff"/><circle cx="166" cy="152" r="11" fill="#111"/><circle cx="234" cy="152" r="11" fill="#111"/>`;
    const heads = {
      bird: `<path d="M120 60 L150 10 L180 60 L200 0 L220 60 L250 10 L280 60Z" fill="${c2}"/><circle cx="200" cy="150" r="118" fill="${c1}"/>${eyes}<path d="M170 180 L230 180 L200 250Z" fill="#ffb612" stroke="#a06a00" stroke-width="4"/>`,
      cat: `<path d="M100 70 L120 -10 L180 40Z M300 70 L280 -10 L220 40Z" fill="${c1}"/><circle cx="200" cy="150" r="118" fill="${c1}"/><path d="M118 60 L124 14 L160 44Z M282 60 L276 14 L240 44Z" fill="${c2}"/>${eyes}<path d="M188 188 L212 188 L200 204Z" fill="#111"/><path d="M130 200 L60 190 M130 214 L60 220 M270 200 L340 190 M270 214 L340 220" stroke="#fff" stroke-width="5"/>`,
      horse: `<path d="M150 40 L130 -20 L180 20Z M250 40 L270 -20 L220 20Z" fill="${c1}"/><path d="M170 40 Q200 -30 230 40 Q250 120 240 190 L160 190 Q150 120 170 40Z" fill="${c2}"/><ellipse cx="200" cy="130" rx="110" ry="120" fill="${c1}"/>${eyes}<ellipse cx="200" cy="215" rx="62" ry="48" fill="#e8d2b0"/><circle cx="180" cy="215" r="7" fill="#111"/><circle cx="220" cy="215" r="7" fill="#111"/>`,
      bear: `<circle cx="104" cy="60" r="38" fill="${c1}"/><circle cx="296" cy="60" r="38" fill="${c1}"/><circle cx="200" cy="150" r="118" fill="${c1}"/>${eyes}<ellipse cx="200" cy="205" rx="55" ry="42" fill="#e8d2b0"/><ellipse cx="200" cy="190" rx="18" ry="12" fill="#111"/>`,
      dog: `<ellipse cx="96" cy="130" rx="36" ry="76" fill="${c2}"/><ellipse cx="304" cy="130" rx="36" ry="76" fill="${c2}"/><circle cx="200" cy="150" r="118" fill="${c1}"/>${eyes}<ellipse cx="200" cy="208" rx="52" ry="38" fill="#f0e0c8"/><ellipse cx="200" cy="192" rx="20" ry="13" fill="#111"/>`,
      bull: `<path d="M96 80 Q40 60 50 0 Q80 40 120 60Z M304 80 Q360 60 350 0 Q320 40 280 60Z" fill="#f5efe0" stroke="#999" stroke-width="3"/><circle cx="200" cy="150" r="118" fill="${c1}"/>${eyes}<ellipse cx="200" cy="215" rx="64" ry="46" fill="${c2}"/><circle cx="178" cy="212" r="8" fill="#111"/><circle cx="222" cy="212" r="8" fill="#111"/><path d="M178 246 Q200 262 222 246" stroke="#ffd23f" stroke-width="7" fill="none"/>`,
      fish: `<path d="M180 40 Q200 -40 240 20 Q230 40 220 50Z" fill="${c1}"/><ellipse cx="200" cy="150" rx="120" ry="112" fill="${c1}"/>${eyes}<path d="M110 200 Q200 250 290 200 Q290 250 200 290 Q110 250 110 200Z" fill="${c2}"/><path d="M130 205 Q200 235 270 205" stroke="#fff" stroke-width="5" fill="none"/>`,
      helmet: `<circle cx="200" cy="140" r="122" fill="${c1}"/><path d="M200 18 L200 160" stroke="${c2}" stroke-width="26"/><path d="M96 170 Q200 120 304 170 L304 240 Q200 280 96 240Z" fill="rgba(0,0,0,.25)" stroke="#ddd" stroke-width="7"/><path d="M110 200 H290 M110 226 H290 M150 160 V250 M200 160 V262 M250 160 V250" stroke="#ddd" stroke-width="6" fill="none"/><circle cx="170" cy="150" r="9" fill="#fff"/><circle cx="230" cy="150" r="9" fill="#fff"/>`,
    };
    return `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="M60 560 L72 330 Q90 290 150 280 L200 330 L250 280 Q310 290 328 330 L340 560Z" fill="${c1}"/><path d="M150 280 L200 330 L250 280" fill="none" stroke="${c2}" stroke-width="12"/>` +
      `<path d="M72 340 L22 440 M328 340 L378 440" stroke="${c1}" stroke-width="46" stroke-linecap="round"/><circle cx="20" cy="448" r="26" fill="#fff"/><circle cx="380" cy="448" r="26" fill="#fff"/>` +
      `<g>${heads[type] || heads.helmet}</g></svg>`;
  }

  // ------------------------------------------------------------ Team-Chants
  // Kurze Fan-Rufe/Slogans je Team (hier einfach anpassbar). Jeweils 2 Stück.
  const CHANTS = {
    cardinals: ["RISE UP, RED SEA", "BIRD GANG"], falcons: ["DIRTY BIRDS", "RISE UP ATL"], ravens: ["FLOCK UP", "NEVERMORE"], bills: ["BILLS MAFIA", "LET'S GO BUFFALO"],
    panthers: ["KEEP POUNDING", "CAT SCRATCH FEVER"], bears: ["DA BEARS", "MONSTERS OF THE MIDWAY"], bengals: ["WHO DEY", "RULE THE JUNGLE"], browns: ["DAWG POUND", "BARK BARK"],
    cowboys: ["HOW 'BOUT THEM COWBOYS", "AMERICA'S TEAM"], broncos: ["BRONCOS COUNTRY", "MILE HIGH"], lions: ["ONE PRIDE", "ROAR"], packers: ["GO PACK GO", "TITLETOWN"],
    texans: ["BATTLE RED", "GO TEXANS"], colts: ["COLTS NATION", "HORSESHOE UP"], jaguars: ["DUUUVAL", "BOLD NEW CITY"], chiefs: ["CHIEFS KINGDOM", "RED FRIDAY"],
    raiders: ["JUST WIN, BABY", "RAIDER NATION"], chargers: ["BOLT UP", "LIGHTNING STRIKES"], rams: ["RAMS HOUSE", "HORNS UP"], dolphins: ["FINS UP", "PERFECT SEASON"],
    vikings: ["SKOL", "SKOL CLAP"], patriots: ["DO YOUR JOB", "FOXBORO"], saints: ["WHO DAT", "GEAUX SAINTS"], giants: ["BIG BLUE", "GO GIANTS"],
    jets: ["J-E-T-S JETS JETS JETS", "GANG GREEN"], eagles: ["FLY EAGLES FLY", "E-A-G-L-E-S"], steelers: ["HERE WE GO STEELERS", "STEEL CURTAIN"], "49ers": ["BANG BANG NINER GANG", "FAITHFUL TO THE BAY"],
    seahawks: ["GO HAWKS", "12S"], buccaneers: ["GO BUCS", "RAISE THE FLAG"], titans: ["TITAN UP", "MUSIC CITY"], commanders: ["TAKE COMMAND", "DMV"],
  };
  const TEAM_ALIAS = { "49ers": ["niners", "niner"], buccaneers: ["bucs"], seahawks: ["hawks"], jaguars: ["jags"], dolphins: ["fins"], patriots: ["pats"], chargers: ["bolts"] };
  function chantFor(team, r) { const t = String(team || "").toLowerCase(); for (const k of Object.keys(CHANTS)) if (t.includes(k)) { const a = CHANTS[k]; return a[Math.floor(r() * a.length)]; } return null; }

  // ------------------------------------------------------------ Szenen
  const S = {};
  S.cheer = (p) => svg(bgRect + `<g fill="#fff" opacity=".7">${Array.from({ length: 14 }, (_, i) => `<circle cx="${80 + i * 135}" cy="${60 + (i % 3) * 36}" r="5"/>`).join("")}</g><rect y="600" width="1920" height="180" fill="#1b2a1b"/>` +
    [0, 1, 2, 3, 4].map((i) => person(560 + i * 200, 730, 2.15, { up: 1, top: i % 2 ? p.c1 : p.c2, skirt: i % 2 ? p.c2 : p.c1, bot: "#eee", k: i * 2, cls: i % 2 ? "a-bounce" : "a-bounce2", d: (i % 3) * .12, extra: pompoms(i % 2 ? p.c2 : p.c1) })).join("") +
    txt(960, 130, p.label, fitSize(p.label, 110, 1300), "#fff"), grad(p.c1, "#0a0e1c"));
  S.pass = (p) => svg(bgRect + `<g stroke="rgba(255,255,255,.35)" stroke-width="6">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${i * 380} 520 L${i * 380 - 120} 780"/>`).join("")}</g>` +
    person(380, 700, 2.3, { top: p.c1, bot: "#eee", cls: "a-bounce2", cap: p.c2, up: 1 }) + person(1560, 700, 2.3, { top: p.c2, bot: "#eee", cap: p.c1, k: 3, cls: "a-bounce", up: 1 }) +
    `<g transform="translate(470 420)"><g class="a-pass"><ellipse rx="40" ry="23" fill="#7b3f12" stroke="#2a1405" stroke-width="4"/><path d="M-14 0 H14 M-8 -8 V8 M0 -8 V8 M8 -8 V8" stroke="#fff" stroke-width="3"/></g></g>` +
    `<g class="a-late">${txt(960, 190, "TOUCHDOWN!", 130, "#ffd23f")}</g>`, grad("#12315e", "#1d6b2f"));
  S.tailgate = (p) => svg(bgRect + `<rect y="560" width="1920" height="220" fill="#2a2a30"/><g stroke="rgba(255,255,255,.3)" stroke-width="5"><path d="M0 700 H1920" stroke-dasharray="80 60"/></g>` +
    `<path d="M240 560 L520 300 L800 560Z" fill="${p.c1}"/><path d="M380 560 L520 300 L520 560Z" fill="${p.c2}" opacity=".85"/><rect x="250" y="540" width="540" height="22" fill="#222"/>` +
    `<g transform="translate(1030 560)"><path d="M-80 -90 A80 80 0 0 1 80 -90Z" fill="#222"/><rect x="-6" y="-92" width="12" height="92" fill="#444"/><circle class="a-smoke" cx="0" cy="-130" r="26" fill="#ccc"/><circle class="a-smoke" cx="20" cy="-130" r="20" fill="#bbb" style="animation-delay:.5s"/><circle class="a-smoke" cx="-18" cy="-130" r="22" fill="#ddd" style="animation-delay:1s"/></g>` +
    `<rect x="1230" y="480" width="200" height="110" rx="10" fill="#1d5fa8"/><rect x="1230" y="480" width="200" height="30" rx="8" fill="#fff"/>` +
    `<rect x="1640" y="200" width="12" height="400" fill="#bbb"/><g class="a-wave"><path d="M1652 210 H1860 V330 H1652Z" fill="${p.c1}"/><path d="M1652 260 H1860 V290 H1652Z" fill="${p.c2}"/></g>` +
    person(880, 640, 2.6, { up: 1, top: p.c1, cls: "a-bounce", k: 1 }) + person(1130, 650, 2.4, { up: 1, top: p.c2, cls: "a-bounce2", k: 4 }), grad("#ff9a4a", "#3a2438"));
  S.mascot = (p) => svg(bgRect + `<g opacity=".5">${[0, 1, 2].map((i) => `<path d="M${400 + i * 560} 0 L${160 + i * 560} 780 L${640 + i * 560} 780Z" fill="rgba(255,255,255,.12)"/>`).join("")}</g>` +
    `<g transform="translate(700 60) scale(1.12)"><g class="a-sway" style="transform-origin:200px 560px">${mascotSVG(p.type, p.c1, p.c2).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></g>` + confetti(24, [p.c1, p.c2, "#fff"]) +
    txt(960, 740, p.label, fitSize(p.label, 110, 1500), p.c2), grad("#12182e", "#05060d"));
  S.fans = (p) => { const names = (p.names && p.names.length ? p.names : ["ALTIMA"]).slice(0, 4), n = names.length, step = 1500 / n;
    return svg(bgRect + `<rect y="640" width="1920" height="140" fill="#10131f"/>` + names.map((nm, i) => { const x = 210 + step * i + step / 2 - 100; const cx = x + 0;
      return `<g class="${i % 2 ? "a-bounce" : "a-bounce2"}"><rect x="${cx - 6}" y="250" width="12" height="260" fill="#8a6a3a"/><rect x="${cx - 190}" y="130" width="380" height="170" rx="10" fill="${i % 2 ? p.c2 : p.c1}" stroke="#fff" stroke-width="6"/>${txt(cx, 232, String(nm).toUpperCase().slice(0, 12), fitSize(nm, 90, 330), "#fff")}</g>` +
        person(cx, 700, 2.7, { up: 1, top: i % 2 ? p.c1 : p.c2, k: i + 1, extra: "" }); }).join("") + txt(960, 66, "DIE FANS FLIPPEN AUS", 52, "#ffd23f"), grad("#1a2347", "#05060d")); };
  S.trash = (p) => svg(bgRect + `<g stroke="rgba(0,0,0,.35)" stroke-width="4">${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${i * 90} H1920"/>`).join("")}</g><rect y="600" width="1920" height="180" fill="#1a1a1f"/>` +
    person(520, 700, 2.5, { up: 1, top: p.c1, bot: "#223", k: 2, cls: "a-bounce2" }) +
    `<g transform="translate(1260 690)"><rect x="-130" y="-300" width="260" height="300" rx="14" fill="#6c7380"/><path d="M-90 -290 V-10 M-30 -290 V-10 M30 -290 V-10 M90 -290 V-10" stroke="#555d69" stroke-width="10"/>` +
    `<g class="a-lid" style="transform-origin:-130px -300px"><rect x="-148" y="-330" width="296" height="34" rx="10" fill="#4f5560"/></g>` +
    `<rect x="-110" y="-250" width="220" height="130" rx="8" fill="${p.c1}" stroke="${p.c2}" stroke-width="8"/>${txt(0, -160, String(p.label).toUpperCase().slice(0, 14), fitSize(p.label, 70, 200), "#fff")}` +
    `<g class="a-stink" font-size="60">🪰</g><path class="a-stink" d="M-60 -350 q-20 -40 0 -80 q20 -40 0 -80 M20 -350 q-20 -40 0 -80 q20 -40 0 -80" stroke="#8ccf4b" stroke-width="8" fill="none"/></g>` +
    `<g transform="translate(700 400)"><g class="a-bag"><circle r="62" fill="#111" stroke="#333" stroke-width="5"/><path d="M-14 -60 Q0 -92 14 -60" fill="#111" stroke="#333" stroke-width="5"/></g></g>`, grad("#232a3d", "#0b0d16"));
  S.table = (p) => svg(bgRect + Array.from({ length: 36 }, (_, i) => `<circle class="a-fall" cx="${(i * 97) % 1900}" cy="-10" r="${3 + i % 4}" fill="#fff" style="animation-delay:${(i % 12) / 6}s;animation-duration:${2.6 + (i % 5) * .4}s"/>`).join("") +
    `<rect y="620" width="1920" height="160" fill="#dfe8f2"/>` + txt(960, 150, "BILLS MAFIA", 170, "#fff", "#00338D") +
    `<g class="a-splitL" style="transform-origin:960px 500px"><rect x="560" y="500" width="400" height="34" fill="#8a5a2b" stroke="#4a2c10" stroke-width="5"/><rect x="620" y="534" width="26" height="130" fill="#6b431d"/></g>` +
    `<g class="a-splitR" style="transform-origin:960px 500px"><rect x="960" y="500" width="400" height="34" fill="#8a5a2b" stroke="#4a2c10" stroke-width="5"/><rect x="1274" y="534" width="26" height="130" fill="#6b431d"/></g>` +
    [0, 1, 2, 3, 4].map((i) => person(700 + i * 130, 500, 1.75, { up: 1, top: i % 2 ? "#00338D" : "#C60C30", cap: i % 2 ? "#C60C30" : "#00338D", bot: "#223", k: i, cls: "a-fan", d: i * .08 })).join(""), grad("#9fc2e8", "#dbe9f6"));
  S.trophy = (p) => svg(bgRect + `<g opacity=".55"><path d="M960 0 L560 780 H1360Z" fill="rgba(255,225,120,.25)"/></g>` +
    `<g transform="translate(960 70)"><g class="a-sway" style="transform-origin:0 600px"><path d="M-170 40 Q-170 250 -60 300 L-40 380 H40 L60 300 Q170 250 170 40Z" fill="#ffd23f" stroke="#a07a00" stroke-width="8"/><path d="M-170 70 Q-290 70 -250 200 Q-230 250 -150 240 M170 70 Q290 70 250 200 Q230 250 150 240" fill="none" stroke="#e8b800" stroke-width="22" stroke-linecap="round"/><rect x="-100" y="380" width="200" height="50" fill="#c99700"/><rect x="-140" y="430" width="280" height="90" rx="8" fill="#7a5600"/>${txt(0, 495, String(p.label).toUpperCase().slice(0, 12), fitSize(p.label, 52, 250), "#ffd23f")}<path d="M-100 80 Q-60 200 -30 120" stroke="rgba(255,255,255,.7)" stroke-width="16" fill="none"/></g></g>` +
    confetti(46, ["#ffd23f", "#d50a0a", "#fff", "#1e50c8"]) + txt(960, 700, "CHAMPION", 130, "#ffd23f"), grad("#2a1a05", "#05060d"));
  S.ring = (p) => svg(bgRect + `<g transform="translate(960 400)"><g class="a-ring"><ellipse rx="230" ry="260" fill="none" stroke="#ffd23f" stroke-width="64"/><ellipse rx="230" ry="260" fill="none" stroke="#a07a00" stroke-width="10" transform="scale(1.1)"/><polygon points="0,-360 70,-300 40,-250 -40,-250 -70,-300" fill="#bfe9ff" stroke="#fff" stroke-width="6"/><circle cx="-200" cy="-120" r="16" fill="#fff"/></g></g>` +
    Array.from({ length: 18 }, (_, i) => `<path class="a-spark" d="M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5Z" fill="#fff" transform="translate(${160 + (i * 197) % 1600} ${80 + (i * 131) % 600})" style="animation-delay:${(i % 9) / 5}s"/>`).join("") +
    txt(960, 740, String(p.label).toUpperCase() + " · ALTIMA BOWL CHAMPION", 62, "#ffd23f"), grad("#1c1038", "#05060d"));
  S.toilet = (p) => svg(bgRect + `<g stroke="rgba(0,0,0,.18)" stroke-width="4">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 100} 0 V780"/>`).join("")}${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${i * 90} H1920"/>`).join("")}</g>` +
    `<g transform="translate(960 700)"><rect x="-90" y="-420" width="180" height="170" rx="18" fill="#fff" stroke="#bbb" stroke-width="6"/><circle cx="60" cy="-380" r="14" fill="#ffd23f"/><ellipse cx="0" cy="-220" rx="170" ry="52" fill="#ffd23f" stroke="#a07a00" stroke-width="8"/><path d="M-150 -214 Q-140 -60 0 -40 Q140 -60 150 -214Z" fill="#fff" stroke="#bbb" stroke-width="6"/><ellipse cx="0" cy="-226" rx="116" ry="30" fill="#9fd4e8"/><path class="a-flushwater" d="M-60 -226 q60 -30 120 0" stroke="#fff" stroke-width="8" fill="none"/><rect x="-60" y="-40" width="120" height="40" fill="#ddd"/></g>` +
    [0, 1, 2, 3].map((i) => `<g transform="translate(${i % 2 ? 1460 + i * 40 : 380 - i * 20} ${200 + i * 60})"><g class="a-roll" style="animation-delay:${i * .3}s"><circle r="56" fill="#fff" stroke="#ccc" stroke-width="5"/><circle r="20" fill="#c9a97a"/></g></g>`).join("") +
    txt(960, 110, "TOILET BOWL", 130, "#ffd23f", "#5a3c00") + (p.label ? txt(960, 200, p.label, fitSize(p.label, 70, 900), "#fff") : ""), grad("#bfe1ef", "#e8f3f8"));
  S.exit = (p) => svg(bgRect + `<rect y="600" width="1920" height="180" fill="#2a2630"/><g transform="translate(1640 600)"><rect x="-120" y="-400" width="240" height="400" fill="#4a3a2a" stroke="#2a1d10" stroke-width="10"/><circle cx="80" cy="-200" r="12" fill="#ffd23f"/><rect x="-90" y="-470" width="180" height="56" rx="8" fill="#1f9d55"/>${txt(0, -428, "EXIT", 44, "#fff")}</g>` +
    `<g class="a-walk"><g transform="translate(300 690)">${person(0, 0, 3, { top: p.c1, bot: "#223", k: 4, extra: `<rect x="-70" y="-120" width="90" height="70" fill="#c9a97a" stroke="#7a5a2a" stroke-width="4"/><path d="M-30 -122 q-10 -40 20 -60 M-30 -122 q20 -30 30 -50" stroke="#2e8b3c" stroke-width="9" fill="none"/>` })}</g></g>` +
    `<g transform="translate(560 160)" opacity=".85"><ellipse rx="150" ry="62" fill="#556"/>${Array.from({ length: 6 }, (_, i) => `<path class="a-fall" d="M${-110 + i * 44} 50 v26" stroke="#7ab8ff" stroke-width="7" stroke-linecap="round" style="animation-delay:${i * .17}s"/>`).join("")}</g>` + txt(960, 90, String(p.label || "").toUpperCase(), fitSize(p.label || "", 100, 1300), "#fff"), grad("#2a2f45", "#12121a"));
  S.lambeau = (p) => svg(bgRect + `<rect y="470" width="1920" height="40" fill="#fff"/><rect y="510" width="1920" height="270" fill="#1d3a22"/>` + txt(960, 110, "LAMBEAU LEAP", 110, "#FFB612", "#203731") +
    [0, 1, 2, 3, 4, 5, 6].map((i) => person(240 + i * 240, 470, 1.9, { up: 1, top: i % 2 ? "#203731" : "#FFB612", cap: i % 2 ? "#FFB612" : "#203731", k: i, cls: "a-bounce2", d: i * .1 })).join("") +
    `<g transform="translate(300 720)"><g class="a-leap">${person(0, 0, 1.9, { top: "#203731", bot: "#FFB612", k: 5, up: 1 })}</g></g>`, grad("#203731", "#0b1a10"));
  S.towel = (p) => svg(bgRect + txt(960, 130, "TERRIBLE TOWEL", 150, "#FFB612", "#101820") + [0, 1, 2, 3, 4, 5].map((i) => { const x = 280 + i * 270; return person(x, 700, 2.5, { top: i % 2 ? "#101820" : "#FFB612", k: i, up: 1, cls: "a-bounce2", d: i * .09 }) + `<g transform="translate(${x + 50} 270)"><g class="a-towel" style="animation-delay:${i * .1}s"><rect x="-8" y="-4" width="150" height="70" rx="8" fill="#FFB612" stroke="#101820" stroke-width="5"/></g></g>`; }).join(""), grad("#1a1d24", "#06070a"));
  S.twelve = (p) => svg(bgRect + `<g transform="translate(560 150)"><g class="a-wave" style="transform-origin:0 0"><rect width="800" height="440" fill="#002244" stroke="#69BE28" stroke-width="16"/>${txt(400, 330, "12", 330, "#69BE28", "#001428")}</g></g><rect x="540" y="130" width="22" height="650" fill="#ccc"/>` +
    txt(960, 740, "THE 12TH MAN", 110, "#69BE28", "#001428") + [0, 1, 2, 3].map((i) => person(180 + i * 100, 680, 2.2, { up: 1, top: "#69BE28", k: i, cls: "a-bounce", d: i * .1 }) + person(1500 + i * 100, 680, 2.2, { up: 1, top: "#002244", k: i + 2, cls: "a-bounce2", d: i * .1 })).join(""), grad("#0b2a52", "#04101f"));
  S.star = (p) => svg(bgRect + `<g transform="translate(960 400)"><g class="a-ring" style="animation-duration:5s"><polygon points="0,-300 88,-92 314,-92 130,42 200,258 0,130 -200,258 -130,42 -314,-92 -88,-92" fill="#c8ccd3" stroke="#003594" stroke-width="22"/></g></g>` + txt(960, 740, "HOW 'BOUT THEM COWBOYS", 90, "#fff", "#003594"), grad("#003594", "#030b24"));

  S.banner = (p) => svg(bgRect + `<g opacity=".5">${[0, 1, 2, 3].map((i) => `<path d="M${300 + i * 440} 0 L${120 + i * 440} 780 H${480 + i * 440}Z" fill="rgba(255,255,255,.10)"/>`).join("")}</g>` +
    `<path d="M0 90 H1920" stroke="#333" stroke-width="22"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${60 + i * 235}" y="60" width="14" height="60" fill="#555"/>`).join("") +
    `<g transform="translate(960 0)"><g class="a-rise"><rect x="-8" y="90" width="16" height="170" fill="#999"/><path d="M-300 250 H300 V640 L0 720 L-300 640Z" fill="${p.c1}" stroke="#ffd23f" stroke-width="12"/>` +
    txt(0, 340, "ALTIMA BOWL", 70, "#fff") + txt(0, 470, String(p.label || "").toUpperCase().slice(0, 12), fitSize(p.label || "", 110, 420), "#ffd23f") + txt(0, 560, "CHAMPION", 70, "#fff") + `</g></g>` + confetti(36, [p.c2, "#fff", "#ffd23f", p.c1]), grad("#0e1430", "#05060d"));
  S.camp = (p) => svg(bgRect + `<g fill="#fff" opacity=".8">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % 1900 + 10}" cy="${(i * 53) % 260 + 10}" r="${1 + i % 3}"/>`).join("")}</g>` +
    `<g opacity=".4"><path d="M300 0 L120 600 H480Z" fill="#fff"/><path d="M1600 0 L1440 600 H1780Z" fill="#fff"/></g><rect y="600" width="1920" height="180" fill="#173a1c"/><path d="M0 600 H1920" stroke="rgba(255,255,255,.5)" stroke-width="6"/>` +
    [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${420 + i * 150}" cy="690" rx="62" ry="22" fill="none" stroke="#111" stroke-width="22"/>`).join("") +
    `<g class="a-run">${person(260, 700, 2.3, { top: p.c1, bot: "#222", k: 3, cls: "a-bounce", up: 0 })}</g>` +
    `<g transform="translate(1500 690)"><g class="a-bounce2"><rect x="-190" y="-150" width="380" height="14" rx="6" fill="#aaa"/><circle cx="-190" cy="-143" r="46" fill="#222"/><circle cx="190" cy="-143" r="46" fill="#222"/></g><rect x="-110" y="-110" width="220" height="30" rx="8" fill="#444"/><rect x="-90" y="-80" width="16" height="80" fill="#333"/><rect x="74" y="-80" width="16" height="80" fill="#333"/></g>` +
    txt(960, 120, "TRAININGSLAGER", 108, "#fff") + txt(960, 190, "05:00 UHR · KEINE AUSREDEN", 44, "#ffd23f"), grad("#0b1a3a", "#06101f"));
  S.firstpick = (p) => svg(bgRect + `<g opacity=".5"><path d="M960 0 L560 780 H1360Z" fill="rgba(255,225,120,.28)"/></g><rect y="620" width="1920" height="160" fill="#14161f"/>` +
    `<g transform="translate(960 70)"><g class="a-sway" style="transform-origin:0 560px"><rect x="-330" y="40" width="660" height="440" rx="26" fill="#1b2a52" stroke="#ffd23f" stroke-width="12"/>` +
    txt(0, 330, "1", 330, "#ffd23f") + txt(0, 100, "ERSTER PICK", 56, "#fff") + txt(0, 420, String(p.label || "").toUpperCase().slice(0, 14), fitSize(p.label || "", 78, 600), "#fff") +
    txt(0, 470, "DRAFT NÄCHSTES JAHR", 34, "#ffd23f") + `</g></g>` + confetti(34, ["#ffd23f", "#fff", p.c1, p.c2]), grad("#0a1230", "#05060d"));
  const beams = '<div class="sg-beam b1"></div><div class="sg-beam b2"></div><div class="sg-beam b3"></div>';
  const wordSize = (chars) => (chars <= 12 ? 230 : chars <= 20 ? 180 : chars <= 30 ? 140 : chars <= 44 ? 108 : 86);
  S.lyric = (p) => { const words = p.words || [], chars = words.map((w) => w.w).join(" ").length;
    return `<div class="lm lyric ${p.style || "slam"}" style="--c1:${p.c1};--c2:${p.c2};--fs:${wordSize(chars)}px">${beams}<div class="lm-bg"></div><div class="lm-note">♪</div>` +
      `<div class="lm-words">${words.map((w, i) => `<span class="lw" style="animation-delay:${(w.rel || 0).toFixed(2)}s">${esc(String(w.w).toUpperCase())}</span>`).join(" ")}</div></div>`; };
  S.chant = (p) => { const words = String(p.label || "ALTIMA BOWL").split(/\s+/), chars = String(p.label || "").length;
    return `<div class="lm chant" style="--c1:${p.c1};--c2:${p.c2};--fs:${wordSize(chars)}px">${beams}<div class="lm-bg"></div>` +
      `<div class="lm-mascot">${mascotSVG(p.type || "helmet", p.c1, p.c2)}</div>` +
      `<div class="lm-words chantw">${words.map((w, i) => `<span class="lw hit" style="animation-delay:${(0.15 + i * 0.3).toFixed(2)}s">${esc(w)}</span>`).join(" ")}</div><div class="lm-crowd"></div></div>`; };

  const LOGO = (id) => `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${id}.png`;
  S.live = (p) => { const inner = (S[p.inner] || S.mascot)(p);
    return `<div class="lv">${inner}<div class="lv-bug"><i></i>LIVE</div><div class="lv-bar" style="--c1:${p.c1};--c2:${p.c2}">${p.id ? `<img src="${LOGO(p.id)}" alt="" onerror="this.style.display='none'">` : ""}<div><b>${esc(p.pname || "")}</b><span>${esc(String(p.team || "").toUpperCase())}${p.rec ? " · " + esc(p.rec) : ""}${p.seed ? " · SEED #" + esc(p.seed) : ""}</span></div></div></div>`; };

  const LABELS = { camp: "TRAININGSLAGER", firstpick: "ERSTER PICK", banner: "SIEGERBANNER", live: "LIVE-SCHALTE", lyric: "LYRIC VIDEO", chant: "FAN-RUF", cheer: "CHEERLEADER", pass: "TOUCHDOWN-PASS", tailgate: "TAILGATE", mascot: "MASKOTTCHEN", fans: "FANS", trash: "MÜLL RAUSBRINGEN", table: "BILLS MAFIA", trophy: "POKAL", ring: "CHAMPIONSHIP RING", toilet: "TOILET BOWL", exit: "AUSGESCHIEDEN", lambeau: "LAMBEAU LEAP", towel: "TERRIBLE TOWEL", twelve: "12TH MAN", star: "THE STAR" };
  function render(id, p) { return (S[id] || S.cheer)(Object.assign({ c1: "#8a0606", c2: "#c99700", label: "ALTIMA BOWL" }, p || {})); }

  // ------------------------------------------------------------ Matching
  function norm(s) { return String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, ""); }
  function sim(a, b) {
    if (a === b) return 1; const n = a.length, m = b.length; if (!n || !m) return 0;
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) { const cur = [i]; for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return 1 - prev[m] / Math.max(n, m);
  }
  function nameHit(word, name) { // fuzzy für Namen/Teams
    const w = norm(word), n = norm(name); if (!w || !n) return false;
    if (n.length <= 3) return w === n || (w.length === n.length + 1 && w.startsWith(n) && /s$/.test(w));
    if (w === n || (w.startsWith(n) && w.length <= n.length + 2)) return true;
    return w.length >= 4 && sim(w, n) >= 0.8;
  }
  const RULES = [
    { id: "trash", scene: "trash", ms: [], modes: ["diss", "brag", "victor"], starts: ["muell", "abfall", "trash", "garbage", "dumpster", "rubbish", "dump", "tonne"], exact: [], needTarget: true },
    { id: "toilet", scene: "toilet", ms: ["toiletBowl"], starts: ["toilet", "toilette", "flush", "spuel", "plunger"], exact: ["klo", "klos", "loo", "wc"] },
    { id: "trophy", scene: "trophy", ms: ["champion"], starts: ["pokal", "trophy", "champ", "meister", "krone", "crown", "koenig", "king", "cup"], exact: [] },
    { id: "ring", scene: "ring", ms: ["champion"], starts: [], exact: ["ring", "rings", "ringe", "ringen"] },
    { id: "exit", scene: "exit", ms: ["firstElimination"], starts: ["raus", "door", "goodbye", "tschuess", "karton", "pack"], exact: ["out", "aus", "bye", "tuer", "tuere", "exit"] },
    { id: "camp", scene: "camp", ms: ["toiletBowl"], starts: ["training", "camp", "gym", "hantel", "workout", "fitness", "grind", "sprint", "muskel", "muscle"], exact: ["lager"] },
    { id: "firstpick", scene: "firstpick", ms: ["toiletBowl"], starts: ["firstpick", "erstepick", "erstenpick", "toppick", "draftpick", "nummereins", "draft"], exact: ["pick", "picks"] },
    { id: "table", scene: "table", ms: [], starts: ["tisch", "table"], exact: [], needTeam: "bills" },
  ];
  const TEAM_GAG = { bills: "table", packers: "lambeau", steelers: "towel", seahawks: "twelve", cowboys: "star" };

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function groupLines(words) {
    const lines = []; let cur = null;
    (words || []).forEach((w, i) => {
      const prev = words[i - 1], gap = prev ? w.s - prev.e : 0;
      if (!cur || gap > 0.6 || cur.words.length >= 9 || (cur.words.length >= 4 && /[.!?;]$/.test(prev ? prev.w : ""))) { cur = { words: [], s: w.s, e: w.e }; lines.push(cur); }
      cur.words.push(w); cur.e = w.e;
    });
    return lines;
  }

  // ctx: { seed, milestone, mode, performers:[{name,team,c1,c2}], target:{name,team}|null, players:[{name,team,c1,c2}], teamColors(fn) }
  function buildScript(ctx, timing, duration) {
    const r = rng(ctx.seed || 1), total = Math.max(30, duration || 75), words = (timing && timing.words) || [];
    const mode = ctx.mode || "hype", ms = ctx.milestone;
    const col = (team) => (ctx.teamColors ? ctx.teamColors(team) : ["#8a0606", "#c99700"]);
    const pl = ctx.players || [], perf = ctx.performers || [], tgt = ctx.target;
    const recap = !!ctx.recap;
    const hl = [];
    const hasBills = [...pl, ...perf, tgt].some((p) => p && /bills/i.test(p.team || ""));
    const teamsInCtx = [...new Set([...perf, tgt, ...pl].filter(Boolean).map((p) => p.team).filter(Boolean))];
    const sceneParams = {
      trash: () => { const t = tgt || pl.find((p) => !perf.some((x) => x.name === p.name)); const c = col(t && t.team); return { label: (t && (t.team || t.name)) || "GEGNER", c1: c[0], c2: c[1] }; },
      toilet: () => ({ label: tgt ? tgt.name : (perf[0] ? perf[0].name : "") }),
      trophy: () => ({ label: perf[0] ? perf[0].name : "ALTIMA" }), ring: () => ({ label: perf[0] ? perf[0].name : "ALTIMA" }),
      exit: () => { const who = tgt || perf[0]; return { label: who ? who.name : "", c1: who ? col(who.team)[0] : "#888" }; },
      banner: () => ({ label: perf[0] ? perf[0].name : "ALTIMA", c1: perf[0] ? perf[0].c1 : "#8a0606", c2: perf[0] ? perf[0].c2 : "#c99700" }),
      table: () => ({}),
      camp: () => ({ c1: perf[0] ? perf[0].c1 : "#8a0606", c2: perf[0] ? perf[0].c2 : "#c99700" }),
      firstpick: () => ({ label: perf[0] ? perf[0].name : "ALTIMA", c1: perf[0] ? perf[0].c1 : "#8a0606", c2: perf[0] ? perf[0].c2 : "#c99700" }),
    };
    const cands = [];
    words.forEach((w) => {
      const nw = norm(w.w); if (nw.length < 2) return;
      RULES.forEach((rule) => {
        if (rule.ms.length && !rule.ms.includes(ms)) return;
        if (rule.modes && !rule.modes.includes(mode)) return;
        if (rule.needTarget && !tgt) return;
        if (rule.needTeam === "bills" && !hasBills) return;
        const hit = rule.exact.includes(nw) || rule.starts.some((s) => nw.startsWith(s) && nw.length >= s.length);
        if (hit) cands.push({ t: w.s, key: rule.id, scene: rule.scene, params: sceneParams[rule.scene] ? sceneParams[rule.scene]() : {} });
      });
      // Performer-Name -> Figur dreht sich zum Trikot
      perf.forEach((p) => { if (!recap && nameHit(w.w, p.name)) cands.push({ t: w.s, key: "turn:" + p.name, type: "turn", who: p.name, max: 99 }); });
      // Erstes Ausscheiden: Name des Ausgeschiedenen -> er geht mit Karton raus
      if (tgt && ms === "firstElimination" && nameHit(w.w, tgt.name)) cands.push({ t: w.s, key: "exit", scene: "exit", params: sceneParams.exit() });
      // Ziel-Name -> Müll (Diss/Angeberlied) mit Teamname des Gegners
      if (tgt && (mode === "diss" || mode === "brag" || mode === "victor") && nameHit(w.w, tgt.name)) cands.push({ t: w.s, key: "trash", scene: "trash", params: sceneParams.trash() });
      // Team-Nennung (auch Kurzformen wie "Niners") -> Chant, Team-Gag oder Maskottchen
      teamsInCtx.forEach((team) => {
        const nick = String(team).trim(); if (!nick || nick.length < 4) return;
        const key = Object.keys(TEAM_ALIAS).find((k) => nick.toLowerCase().includes(k));
        const names = [nick, ...(key ? TEAM_ALIAS[key] : [])];
        if (names.some((n) => nameHit(w.w, n))) {
          const gag = Object.keys(TEAM_GAG).find((k) => nick.toLowerCase().includes(k));
          const c = col(team), chant = chantFor(nick, r);
          const useChant = chant && r() < 0.65;
          if (recap) hl.push({ t: w.s, name: (pl.find((p) => p.team === team) || {}).name });
          cands.push({ player: pl.find((p) => p.team === team), t: w.s, key: "team:" + nick, scene: useChant ? "chant" : (gag ? TEAM_GAG[gag] : "mascot"), params: { type: mascotType(nick), c1: c[0], c2: c[1], label: useChant ? chant : nick.toUpperCase() } });
        }
      });
      // andere Spielernamen -> Fans mit Schild (nicht beim Performer/Ziel)
      pl.forEach((p) => { if (!perf.some((x) => x.name === p.name) && !(tgt && tgt.name === p.name) && nameHit(w.w, p.name)) {
        const c = col(p.team); if (recap) hl.push({ t: w.s, name: p.name }); cands.push({ player: p, t: w.s, key: "name:" + p.name, scene: "fans", params: { names: [p.name], c1: c[0], c2: c[1] } }); } });
    });

    // ---- Lyric-Video-Momente: Hook-Zeilen (wiederholt) bevorzugt, sonst kurze prägnante Zeilen ----
    {
      const lines = groupLines(words), nl = (l) => norm(l.words.map((w) => w.w).join(""));
      const counts = new Map(); lines.forEach((l) => counts.set(nl(l), (counts.get(nl(l)) || 0) + 1));
      const hasRep = lines.some((l) => counts.get(nl(l)) >= 2 && l.words.length >= 2 && l.words.length <= 8);
      const c0 = col((perf[0] && perf[0].team) || (tgt && tgt.team)), style = r() < 0.5 ? "slam" : "slide";
      lines.forEach((l, i) => {
        const n = l.words.length, rep = counts.get(nl(l)) >= 2;
        if (n < 2 || n > 8 || l.s < 8) return;
        if (hasRep ? !rep : n < 3 || n > 6) return;
        cands.push({ t: l.s - 0.15, key: "lyric:" + (rep ? nl(l) : i), scene: "lyric", lyric: true, dur: Math.min(6, Math.max(3.4, l.e - l.s + 1.1)),
          params: { words: l.words.map((w) => ({ w: w.w, rel: Math.max(0, w.s - l.s + 0.15) })), c1: c0[0], c2: c0[1], style } });
      });
    }

    // ---- Schnittliste: reaktive Szenen bevorzugt, sonst Standard-Rotation ----
    const script = [], used = new Map(), GAP_MIN = 8 * (ctx.gapScale || 1), START = ctx.start || 5, END = total - 4.5;
    let last = -99, lastScene = "";
    const std = ["cheer", "pass", "tailgate", "mascot", "chant", "fans"];
    const maxLyric = total > 70 ? 3 : 2;
    let deck = [];
    const nextStd = () => { if (!deck.length) { deck = std.slice().sort(() => r() - 0.5); if (deck[0] === lastScene) deck.push(deck.shift()); } return deck.shift(); };
    const stdParams = (id, forced) => {
      const team = forced || (teamsInCtx.length ? teamsInCtx[Math.floor(r() * teamsInCtx.length)] : ""), c = col(team || (perf[0] && perf[0].team));
      if (id === "fans") { const pool = pl.length ? pl : perf; const names = pool.map((p) => p.name).sort(() => r() - 0.5).slice(0, 3); return { names, c1: c[0], c2: c[1] }; }
      if (id === "chant") return { type: mascotType(team), c1: c[0], c2: c[1], label: chantFor(team, r) || "ALTIMA BOWL" };
      if (id === "mascot") return { type: mascotType(team), c1: c[0], c2: c[1], label: String(team || "ALTIMA BOWL").toUpperCase() };
      return { c1: c[0], c2: c[1], label: id === "cheer" ? "GO " + String(team || "ALTIMA").toUpperCase() + "!" : String(team || "ALTIMA BOWL").toUpperCase() };
    };
    const recapOrder = pl.slice(); let recapI = 0;
    const accept = (c, t) => {
      if (recap && c.scene !== "lyric") { // RedZone-Stil: jede Szene als Live-Schaltung zu einem Spieler/Team
        const pp = c.player || recapOrder[recapI++ % Math.max(1, recapOrder.length)] || {}, cc = col(pp.team);
        const base = c.player ? c.params : stdParams(c.scene === "live" ? "cheer" : c.scene, pp.team);
        c = Object.assign({}, c, { scene: "live", params: Object.assign({}, base, { inner: c.scene, pname: pp.name, team: pp.team, id: pp.id, rec: pp.rec, seed: pp.seed, c1: cc[0], c2: cc[1] }) });
        if (pp.name) hl.push({ t: Math.max(0, t), name: pp.name });
      }
      used.set(c.key, (used.get(c.key) || 0) + 1); if (c.lyric) used.set('lyric*', (used.get('lyric*') || 0) + 1); script.push({ t: Math.max(0, t), dur: c.dur || 3.3, scene: c.scene, params: c.params }); last = t + (c.dur ? c.dur - 3.3 : 0); lastScene = c.scene; };
    const maxUse = (c) => (c.max != null ? c.max : 1);
    const sorted = cands.filter((c) => c.type !== "turn").sort((a, b) => a.t - b.t);
    // Pflicht-Szenen je Meilenstein (falls der Text sie nicht auslöst)
    const mustHave = [];
    if (mode === "victor" && tgt) mustHave.push({ at: total * 0.62, key: "trash", scene: "trash", params: sceneParams.trash() });
    if (mode === "diss" && tgt) mustHave.push({ at: total * 0.45, key: "trash", scene: "trash", params: sceneParams.trash() });
    if (ms === "toiletBowl") mustHave.push({ at: total * 0.28, key: "toilet", scene: "toilet", params: sceneParams.toilet() }, { at: total * 0.5, key: "camp", scene: "camp", params: sceneParams.camp() }, { at: total * 0.7, key: "firstpick", scene: "firstpick", params: sceneParams.firstpick() });
    if (ms === "champion") mustHave.push({ at: total * 0.5, key: "trophy", scene: "trophy", params: sceneParams.trophy() }, { at: total * 0.66, key: "banner", scene: "banner", params: sceneParams.banner() }, { at: total * 0.8, key: "ring", scene: "ring", params: sceneParams.ring() });
    if (ms === "firstElimination") mustHave.push({ at: total * 0.4, key: "exit", scene: "exit", params: sceneParams.exit() });
    for (let t = START; t <= END; t += 0.5) {
      if (t - last < GAP_MIN + r() * 2) continue;
      // Erster Schnitt: bis zu 7 s auf einen Texttreffer warten, bevor eine Standard-Szene kommt
      const look = script.length === 0 ? 7 : 4;
      const hit = sorted.find((c) => c.t >= t && c.t <= t + look && (used.get(c.key) || 0) < maxUse(c) && (!c.lyric || (used.get('lyric*') || 0) < maxLyric));
      if (hit) { accept(hit, hit.t - 0.2); t = hit.t; continue; }
      const must = mustHave.find((m) => !(used.get(m.key)) && t >= m.at);
      if (must) { accept(must, t); continue; }
      if (script.length === 0 ? t >= START + 7 : t - last >= GAP_MIN + 2.2) { const id = nextStd(); accept({ key: "std:" + id, scene: id, params: stdParams(id), max: 99 }, t); }
    }
    const turns = cands.filter((c) => c.type === "turn").filter((c, i, a) => a.findIndex((x) => Math.abs(x.t - c.t) < 6 && x.who === c.who) === i).map((c) => ({ t: c.t, type: "turn", who: c.who }));
    // ---- Rapper-Moves: Posen, Kamerafahrten, Spielfeld-Walk, Gold-Flex ----
    const FLEX = { starts: ["gold", "kette", "chain", "bling", "diamant", "diamond", "juwel", "schmuck", "jewel"], exact: ["ice", "iced", "drip", "rich", "reich", "cash"] };
    const inCut = (t) => script.some((c) => t > c.t - 0.5 && t < c.t + c.dur + 0.3);
    const flexMoves = [];
    if (!recap) {
      words.forEach((w) => { const nw = norm(w.w); if ((FLEX.exact.includes(nw) || FLEX.starts.some((x) => nw.startsWith(x))) && w.s > 4 && !inCut(w.s) && !flexMoves.some((f) => Math.abs(f.t - w.s) < 12)) flexMoves.push({ t: w.s - 0.1, kind: "flex", dur: 3.4 }); });
      if (ms === "champion" && !flexMoves.length) { let ft = total * 0.33; for (let k = 0; k < 12 && inCut(ft); k++) ft += 1; flexMoves.push({ t: ft, kind: "flex", dur: 3.4 }); }
    }
    const moves = flexMoves.slice(0, 2);
    if (ms === "champion" && !recap) [0.2, 0.72].forEach((f) => { let pt = total * f; for (let k = 0; k < 14 && inCut(pt); k++) pt += 1; moves.push({ t: pt, kind: "press", dur: 5 }); });
    { let mt = (ctx.start ? ctx.start - 2 : 3) + r() * 2, lastWalk = -99; const poses = ["point", "pump", "hip", "bang", "lean"], cams = ["wide", "close", "low", "tilt"];
      while (mt < total - 3) { const roll = r();
        if (!recap && roll > 0.9 && moves.filter((m) => m.kind === "flex").length < 2 && !inCut(mt) && !moves.some((m) => m.kind === "flex" && Math.abs(m.t - mt) < 12)) moves.push({ t: mt, kind: "flex", dur: 3.4 });
        else if (roll < 0.5) moves.push({ t: mt, kind: "pose", name: poses[Math.floor(r() * poses.length)], dur: 2.4 + r() });
        else if (roll < 0.82) moves.push({ t: mt, kind: "cam", name: cams[Math.floor(r() * cams.length)], dur: 3 + r() * 2 });
        else if (!recap && mt - lastWalk > 26 && mt > 12 && !script.some((c) => c.t < mt + 5.5 && c.t + c.dur > mt - 0.5)) { moves.push({ t: mt, kind: "walk", dur: 5 }); lastWalk = mt; mt += 2; } // nie während eines Zwischenschnitts
        mt += 3.2 + r() * 2.8; } }
    moves.sort((a, b) => a.t - b.t);
    return { cuts: script, turns, moves, hl: hl.filter((h) => h.name).sort((a, b) => a.t - b.t), stats: { candidates: cands.length, cuts: script.length } };
  }

  global.MB.SongScenes = { render, buildScript, chantFor, CHANTS, mascotSVG, mascotType, LABELS, norm, nameHit };
})(window);
