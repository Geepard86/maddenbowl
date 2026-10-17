// ============================================================================
// avatar.js — selbst gestaltete Spielerfiguren
// ----------------------------------------------------------------------------
// Jeder Spieler kann im Spielerprofil (Hall of Fame) seine Figur bauen:
// Körperform, Größe, Hautton, Frisur, Haarfarbe, Bart, Brille, Kopfbedeckung,
// Kleidungsfarbe, Lieblingsteam, Kette. Gespeichert in Supabase
// (app_config "player_avatars" = { "<name klein>": config }).
//
// Dieselbe Figur erscheint überall: Musikvideos (song-stage.js über
// toVariant), Draft-Einlauf, Kiss Cam / Fan-Cam im Studio, Profil.
// Spieler ohne eigene Figur bekommen eine stabile Zufallsfigur (aus dem Namen).
// ============================================================================
(function (global) {
  const KEY = "player_avatars";
  const OPTIONS = {
    body: [["slim", "Schlank"], ["normal", "Normal"], ["athletic", "Athletisch"], ["strong", "Kräftig"], ["round", "Rund"]],
    skin: ["#f6d3b8", "#f0c4a0", "#e0ac82", "#d9a074", "#c68642", "#a5683a", "#7a4a2b", "#5b3720"],
    hair: [["short", "Kurz"], ["side", "Seitenscheitel"], ["spiky", "Stachelig"], ["fade", "Fade"], ["long", "Lang"], ["ponytail", "Zopf"], ["curls", "Locken"], ["afro", "Afro"], ["braids", "Zöpfe"], ["mohawk", "Irokese"], ["bun", "Dutt"], ["buzz", "Buzzcut"], ["shaved", "2 mm rasiert"], ["bald", "Glatze"]],
    hairColor: ["#0d0a08", "#3b2414", "#7a4a1c", "#a8452a", "#c9a227", "#e8d08a", "#9a9a9a", "#e6e6e6", "#2b5fd9", "#d64aa0"],
    beard: [["none", "Kein Bart"], ["stubble", "Drei-Tage-Bart"], ["full", "Vollbart"], ["full_mustache", "Vollbart + Oberlippe"], ["chinstrap", "Kinnbart"], ["goatee", "Ziegenbart"], ["mustache", "Schnurrbart"]],
    glasses: [["none", "Keine"], ["glasses", "Rund"], ["glasses_square", "Eckig"], ["shades", "Sonnenbrille"], ["shades_sport", "Sportbrille"]],
    hat: [["none", "Nichts"], ["cap", "Cap"], ["beanie", "Mütze"], ["band", "Stirnband"]],
    // Farben für Brillengestell und Kopfbedeckung
    glassesColor: ["#1a1a1a", "#6b4a2b", "#9aa3ad", "#c9a227", "#d50a0a", "#1e50c8", "#ffffff", "#ff4fa3"],
    hatColor: ["#14181f", "#2a2f3a", "#d50a0a", "#1e50c8", "#0b6b3a", "#c99700", "#ffffff", "#7a3cff", "#f97316"],
  };
  const BODY_W = { slim: 0.86, normal: 1, athletic: 1.08, strong: 1.18, round: 1.24 };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function hash(str) { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

  // stabile Zufallsfigur aus dem Namen
  function randomFor(name) {
    let h = hash(String(name || "x").toLowerCase());
    // gut durchmischter Zufall (fmix32), sonst ähneln sich Figuren mit ähnlichen Namen stark
    const fmix = (x) => { x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x >>> 0; };
    h = fmix(h);
    const r = (arr) => { h = fmix((h + 0x9e3779b9) >>> 0); return arr[h % arr.length]; };
    const hair = r(OPTIONS.hair)[0];
    return {
      body: r(OPTIONS.body)[0], height: 1, skin: r(OPTIONS.skin), hair, hairColor: r(OPTIONS.hairColor.slice(0, 7)),
      beard: r([["none"], ["none"], ["stubble"], ["full"], ["goatee"], ["mustache"]])[0], glasses: r([["none"], ["none"], ["none"], ["glasses"], ["shades"]])[0],
      hat: r([["none"], ["none"], ["none"], ["cap"], ["beanie"], ["band"]])[0], shirt: r(["#d50a0a", "#1e50c8", "#0b6b3a", "#2a2f3a", "#7a3cff", "#c99700", "#ffffff"]), team: "", chain: r([true, false, false]),
      random: true,
    };
  }

  let cache = null, loading = null;
  async function load(force) {
    if (cache && !force) return cache;
    if (loading) return loading;
    loading = (async () => {
      try { const raw = global.MB.getAppConfig ? await global.MB.getAppConfig(KEY) : null; cache = raw ? JSON.parse(raw) : {}; }
      catch (e) { cache = cache || {}; }
      loading = null; return cache;
    })();
    return loading;
  }
  function get(name) {
    const own = cache && cache[String(name || "").trim().toLowerCase()];
    return own ? { ...randomFor(name), ...own, random: false } : randomFor(name);
  }
  function hasOwn(name) { return !!(cache && cache[String(name || "").trim().toLowerCase()]); }
  async function save(name, cfg) {
    const all = { ...(await load(true)) };
    const clean = { ...cfg }; delete clean.random;
    all[String(name).trim().toLowerCase()] = clean;
    await global.MB.setAppConfig(KEY, JSON.stringify(all));
    cache = all;
  }

  // Für song-stage.js (rapperSVG): Variante im dortigen Format
  function toVariant(cfg) {
    const c = cfg || {};
    const style = c.hat === "cap" ? "cap" : c.hat === "band" ? "band" : (c.hair || "short");
    return { skin: c.skin, hair: c.hairColor, style, beardType: c.beard || "none", beard: c.beard && c.beard !== "none",
      shades: c.glasses === "shades" || c.glasses === "shades_sport", glasses: c.glasses === "glasses" || c.glasses === "glasses_square", chain: !!c.chain, beanie: c.hat === "beanie",
      bodyW: BODY_W[c.body] || 1, height: Number(c.height) || 1, own: !c.random };
  }

  // ------------------------------------------------------------ Teile (Kopf um 130/118, wie die Musikvideo-Figuren)
  function hairBack(c) {
    const h = c.hairColor;
    if (c.hat === "beanie") return "";
    switch (c.hair) {
      case "long": return `<path d="M76 110 Q70 210 92 236 L168 236 Q190 210 184 110 Q180 60 130 58 Q80 60 76 110Z" fill="${h}"/>`;
      case "afro": return `<circle cx="130" cy="96" r="74" fill="${h}"/>`;
      case "curls": return `<g fill="${h}">${[[86, 92], [98, 70], [122, 60], [146, 62], [168, 76], [178, 100], [80, 118], [180, 124]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/>`).join("")}</g>`;
      case "braids": return `<path d="M82 104 Q68 190 86 232 M98 112 Q90 190 100 236 M178 104 Q192 190 174 232 M162 112 Q170 190 160 236" stroke="${h}" stroke-width="12" stroke-linecap="round" fill="none"/>`;
      case "bun": return `<circle cx="130" cy="52" r="22" fill="${h}"/>`;
      case "ponytail": return `<path d="M168 92 Q206 110 196 170 Q190 200 176 214 Q186 168 166 120Z" fill="${h}"/>`;
      default: return "";
    }
  }
  function hairTop(c, c1, c2) {
    const h = c.hairColor;
    if (c.hatColor) { c1 = c.hatColor; c2 = c.hatColor === "#ffffff" ? "#1a1a1a" : "#ffffff"; }
    if (c.hat === "cap") return `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="${c1}"/><path d="M78 108 Q130 96 182 108 L198 118 Q130 100 70 116Z" fill="${c2}"/><circle cx="130" cy="54" r="5" fill="${c2}"/>` +
      (c.team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(c.team)}.png" x="110" y="62" width="40" height="34"/>` : "");
    if (c.hat === "beanie") return `<path d="M78 112 Q74 50 130 46 Q186 50 182 112Z" fill="${c1}"/><rect x="76" y="98" width="108" height="18" rx="7" fill="${c2}"/><circle cx="130" cy="42" r="12" fill="${c2}"/>`;
    const band = c.hat === "band" ? `<rect x="82" y="94" width="96" height="12" rx="5" fill="${c2}"/>` : "";
    const tops = {
      short: `<path d="M82 112 Q78 62 130 60 Q182 62 178 112 Q168 84 130 82 Q92 84 82 112Z" fill="${h}"/>`,
      side: `<path d="M82 116 Q76 60 130 58 Q184 60 178 112 Q170 80 120 80 Q100 92 82 116Z" fill="${h}"/><path d="M116 62 Q110 74 112 82" stroke="rgba(0,0,0,.25)" stroke-width="3" fill="none"/>`,
      long: `<path d="M80 116 Q76 60 130 58 Q184 60 180 116 Q170 82 130 80 Q90 82 80 116Z" fill="${h}"/>`,
      curls: `<g fill="${h}">${[[96, 82], [116, 72], [140, 72], [162, 82]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join("")}</g>`,
      afro: `<path d="M84 104 Q90 70 130 68 Q170 70 176 104 Q158 84 130 84 Q102 84 84 104Z" fill="${h}"/>`,
      braids: `<path d="M82 108 Q80 62 130 60 Q180 62 178 108 Q166 82 130 80 Q94 82 82 108Z" fill="${h}"/>`,
      mohawk: `<path d="M116 92 Q112 40 130 30 Q148 40 144 92Z" fill="${h}"/>`,
      bun: `<path d="M82 110 Q80 64 130 62 Q180 64 178 110 Q166 84 130 82 Q94 84 82 110Z" fill="${h}"/>`,
      buzz: `<path d="M82 108 Q80 64 130 62 Q180 64 178 108 Q166 86 130 84 Q94 86 82 108Z" fill="${h}" opacity=".55"/>`,
      shaved: `<path d="M80 112 Q78 62 130 60 Q182 62 180 112 Q170 80 130 78 Q90 80 80 112Z" fill="${h}" opacity=".22"/>`,
      fade: `<path d="M86 100 Q84 58 130 56 Q176 58 174 100 Q160 80 130 78 Q100 80 86 100Z" fill="${h}"/><path d="M80 112 Q80 96 88 92 L88 112Z M180 112 Q180 96 172 92 L172 112Z" fill="${h}" opacity=".35"/>`,
      spiky: `<path d="M82 108 L88 70 L100 82 L106 54 L118 76 L128 46 L138 74 L152 52 L156 80 L170 62 L172 86 L180 108 Q166 86 130 84 Q94 86 82 108Z" fill="${h}"/>`,
      ponytail: `<path d="M82 112 Q78 62 130 60 Q182 62 178 112 Q168 84 130 82 Q92 84 82 112Z" fill="${h}"/>`,
      bald: `<path d="M100 72 Q118 66 130 68" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    };
    return (tops[c.hair] || tops.short) + band;
  }
  function beardSVG(c) {
    const h = c.hairColor;
    switch (c.beard) {
      case "full": return `<path d="M86 132 Q90 182 130 186 Q170 182 174 132 Q162 162 130 162 Q98 162 86 132Z" fill="${h}"/>`;
      case "full_mustache": return `<path d="M86 132 Q90 182 130 186 Q170 182 174 132 Q162 162 130 162 Q98 162 86 132Z" fill="${h}"/><path d="M106 152 Q118 140 130 148 Q142 140 154 152 Q142 156 130 152 Q118 156 106 152Z" fill="${h}"/>`;
      case "chinstrap": return `<path d="M84 126 Q86 176 130 184 Q174 176 176 126 L170 128 Q166 170 130 174 Q94 170 90 128Z" fill="${h}"/>`;
      case "stubble": return `<path d="M88 134 Q94 176 130 180 Q166 176 172 134 Q160 160 130 160 Q100 160 88 134Z" fill="${h}" opacity=".35"/>`;
      case "goatee": return `<path d="M116 160 Q130 186 144 160 Q130 168 116 160Z" fill="${h}"/><path d="M114 150 Q130 144 146 150" stroke="${h}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      case "mustache": return `<path d="M108 150 Q120 140 130 148 Q140 140 152 150 Q140 154 130 151 Q120 154 108 150Z" fill="${h}"/>`;
      default: return "";
    }
  }
  function faceSVG(c, opts) {
    const o = opts || {};
    const brow = c.hairColor === "#e6e6e6" || c.hairColor === "#e8d08a" ? "#8a6d3a" : c.hairColor;
    const ears = `<ellipse cx="82" cy="124" rx="8" ry="15" fill="${c.skin}"/><ellipse cx="178" cy="124" rx="8" ry="15" fill="${c.skin}"/>`;
    const face = `<ellipse cx="130" cy="118" rx="48" ry="56" fill="${c.skin}"/><ellipse cx="104" cy="136" rx="9" ry="5" fill="#e88a7a" opacity=".25"/><ellipse cx="156" cy="136" rx="9" ry="5" fill="#e88a7a" opacity=".25"/>`;
    const eyes = o.sleep
      ? `<path d="M100 118 Q110 124 120 118 M140 118 Q150 124 160 118" stroke="#241a12" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : c.glasses === "shades_sport"
        ? `<defs><linearGradient id="spg" x1="0" x2="1"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#2b8cff"/></linearGradient></defs><path d="M84 110 Q130 98 176 110 L172 124 Q152 132 132 122 L128 122 Q108 132 88 124Z" fill="url(#spg)" stroke="${c.glassesColor || "#111"}" stroke-width="3"/><path d="M96 110 L118 108" stroke="rgba(255,255,255,.7)" stroke-width="3"/>`
      : c.glasses === "shades"
        ? `<rect x="94" y="106" width="34" height="20" rx="6" fill="#0a0a0a" stroke="${c.glassesColor || "#0a0a0a"}" stroke-width="3"/><rect x="132" y="106" width="34" height="20" rx="6" fill="#0a0a0a" stroke="${c.glassesColor || "#0a0a0a"}" stroke-width="3"/><rect x="126" y="112" width="8" height="5" fill="${c.glassesColor || "#0a0a0a"}"/><path d="M99 110 L112 110 M137 110 L150 110" stroke="rgba(255,255,255,.55)" stroke-width="3"/>`
        : `<g class="eyes"><ellipse cx="110" cy="116" rx="8" ry="6" fill="#fff"/><ellipse cx="150" cy="116" rx="8" ry="6" fill="#fff"/><circle cx="112" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="148" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="113" cy="116" r="1.2" fill="#fff"/><circle cx="149" cy="116" r="1.2" fill="#fff"/></g>` +
          (c.glasses === "glasses" ? `<g fill="none" stroke="${c.glassesColor || "#1a1a1a"}" stroke-width="3.5"><circle cx="110" cy="116" r="14"/><circle cx="150" cy="116" r="14"/><path d="M124 116 L136 116 M96 114 L84 110 M164 114 L176 110"/></g>`
           : c.glasses === "glasses_square" ? `<g fill="rgba(180,220,255,.12)" stroke="${c.glassesColor || "#1a1a1a"}" stroke-width="4"><rect x="95" y="105" width="30" height="22" rx="4"/><rect x="135" y="105" width="30" height="22" rx="4"/><path d="M125 114 L135 114 M95 112 L84 108 M165 112 L176 108" fill="none"/></g>` : "");
    const brows = (c.glasses === "shades" || c.glasses === "shades_sport") ? "" : `<path d="M98 101 Q110 95 122 101 M138 101 Q150 95 162 101" fill="none" stroke="${brow}" stroke-width="5" stroke-linecap="round"/>`;
    const nose = `<path d="M130 118 Q123 138 130 142 Q137 142 135 136" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linecap="round"/>`;
    const mouth = o.noMouth ? "" : o.kiss ? `<ellipse cx="130" cy="158" rx="7" ry="6" fill="#b5404a"/>` : o.open ? `<ellipse cx="130" cy="158" rx="14" ry="10" fill="#3a0f0f"/><ellipse cx="130" cy="164" rx="7" ry="3" fill="#d9707a"/>`
      : `<path d="M114 155 Q130 166 146 155" fill="none" stroke="#7a3a2a" stroke-width="5" stroke-linecap="round"/>`;
    return ears + face + beardSVG(c) + brows + eyes + nose + mouth;
  }

  // ------------------------------------------------------------ Ganze Figur (Brustbild bis Hüfte)
  // opts: { outfit: "casual"|"jersey"|"coach"|"suit", c1, c2, number, name, sleep, kiss, open, team }
  function svg(cfg, opts) {
    const c = { ...randomFor("x"), ...(cfg || {}) };
    const o = opts || {};
    const bw = BODY_W[c.body] || 1;
    const team = o.team || c.team || "";
    const c1 = o.c1 || c.shirt || "#2a2f3a", c2 = o.c2 || "#ffffff";
    const outfit = o.outfit || "casual";
    const skin = c.skin;
    const tx = (x) => 130 + (x - 130) * bw; // Oberkörper in die Breite ziehen
    const shade = "rgba(0,0,0,.18)";
    const logo = (x, y, w) => `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(team)}.png" x="${x}" y="${y}" width="${w}" height="${w}"/>`;
    const wide = outfit === "jersey" ? 14 : 0; // Trikot: breitere Schultern (Schulterpolster)
    // Oberteil: Schultern -> leicht taillierter Saum bei y=400
    const torso = `M${tx(58 - wide)} ${208} Q${tx(70 - wide)} 190 ${tx(102)} 186 L130 ${outfit === "suit" ? 240 : 200} L${tx(158)} 186 Q${tx(190 + wide)} 190 ${tx(202 + wide)} 208 L${tx(196)} 300 Q${tx(194)} 360 ${tx(190)} 402 L${tx(70)} 402 Q${tx(66)} 360 ${tx(64)} 300Z`;
    const belly = c.body === "round" ? `<path d="M${tx(66)} 300 Q${tx(52)} 372 ${tx(78)} 402 L${tx(182)} 402 Q${tx(208)} 372 ${tx(194)} 300Z" fill="${outfit === "suit" || outfit === "coach" ? c1 : c1}"/>` : "";
    // Hose + Gürtel (Brustbild endet knapp unter der Hüfte)
    const pants = `<path d="M${tx(70)} 398 L${tx(190)} 398 L${tx(194)} 440 L${tx(66)} 440Z" fill="${outfit === "suit" ? "#1a2130" : "#2b3a55"}"/><rect x="${tx(70)}" y="396" width="${tx(190) - tx(70)}" height="10" fill="#1a1a1a"/><rect x="122" y="395" width="16" height="12" rx="2" fill="#c9a227"/><path d="M130 408 V440" stroke="rgba(0,0,0,.3)" stroke-width="3"/>`;
    // Arme: kurze Ärmel + Unterarm/Hand (T-Shirt, Trikot) oder lange Ärmel (Jacke, Anzug)
    const longSleeve = outfit === "coach" || outfit === "suit";
    const sleeveCol = outfit === "suit" ? "#1f2738" : c1;
    const arm = (side) => {
      const s = side === "l" ? -1 : 1, X = (x) => 130 + s * (x - 130) * 1; // spiegeln
      const sx = tx(side === "l" ? 58 - wide : 202 + wide), sy = 210;
      const ex = side === "l" ? tx(46) : tx(214), ey = 300;     // Ellbogen
      const hx = side === "l" ? tx(52) : tx(208), hy = 386;     // Hand an der Hüfte
      if (longSleeve) return `<path d="M${sx} ${sy} Q${ex} ${ey - 30} ${ex} ${ey} L${hx} ${hy - 12}" stroke="${sleeveCol}" stroke-width="${30 * Math.min(bw, 1.15)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${hx}" cy="${hy}" r="13" fill="${skin}"/>`;
      const sl = side === "l" ? `M${sx + 6} ${sy - 6} L${tx(36 - wide)} 282 L${tx(64)} 290 L${tx(74)} 230Z` : `M${sx - 6} ${sy - 6} L${tx(224 + wide)} 282 L${tx(196)} 290 L${tx(186)} 230Z`;
      const fx = side === "l" ? tx(50) : tx(210);
      return `<path d="M${fx} 284 L${hx} ${hy - 10}" stroke="${skin}" stroke-width="${19 * Math.min(bw, 1.12)}" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="13" fill="${skin}"/><path d="${sl}" fill="${sleeveCol}"/>` +
        (outfit === "jersey" ? `<path d="${side === "l" ? `M${tx(40 - wide)} 268 L${tx(66)} 276` : `M${tx(220 + wide)} 268 L${tx(194)} 276`}" stroke="${c2}" stroke-width="6"/>` : "");
    };
    let top = "";
    if (outfit === "suit") top = `<path d="${torso}" fill="#1f2738"/>${belly}<path d="M108 190 L130 300 L152 190 L130 206Z" fill="#fff"/><path d="M124 204 L136 204 L133 296 L127 296Z" fill="${c1}"/><path d="M104 188 L124 262 L112 270Z M156 188 L136 262 L148 270Z" fill="#161c29"/>`;
    else if (outfit === "coach") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M130 204 L130 402" stroke="${c2}" stroke-width="5"/><path d="M104 188 Q130 214 156 188" fill="none" stroke="${c2}" stroke-width="7"/><text x="${tx(86)}" y="300" font-family="Impact,'Arial Black'" font-size="24" fill="${c2}">HC</text>` + (team ? logo(tx(146), 268, 44) : "");
    else if (outfit === "jersey") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M100 188 L130 214 L160 188" fill="none" stroke="${c2}" stroke-width="9"/><text x="130" y="360" text-anchor="middle" font-family="Impact,'Arial Black'" font-size="96" fill="${c2}" stroke="rgba(0,0,0,.5)" stroke-width="3" paint-order="stroke">${esc(o.number || "")}</text>`;
    else top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M104 188 Q130 216 156 188" fill="none" stroke="${shade}" stroke-width="7"/><path d="M${tx(76)} 330 Q130 340 ${tx(184)} 330" stroke="${shade}" stroke-width="3" fill="none" opacity=".5"/>` + (team ? logo(106, 252, 48) : "");
    const chain = c.chain && outfit !== "suit" ? `<path d="M102 196 Q130 248 158 196" fill="none" stroke="#ffd23f" stroke-width="5"/><rect x="120" y="234" width="20" height="20" rx="4" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>` : "";
    const neck = `<rect x="110" y="158" width="40" height="40" rx="10" fill="${skin}" style="filter:brightness(.88)"/>`;
    const h = Math.max(0.88, Math.min(1.12, Number(c.height) || 1));
    return `<svg viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet"><g transform="translate(0 ${440 * (1 - h)}) scale(1 ${h})">` +
      pants + arm("l") + arm("r") + neck + top + chain + `<g class="head">${hairBack(c)}${faceSVG(c, o)}${hairTop(c, c1, c2)}</g></g></svg>`;
  }

  // Nur der Kopf (für die Auswahl-Kacheln im Editor)
  function headSVG(cfg) {
    const c = { ...randomFor("x"), ...(cfg || {}) };
    return `<svg viewBox="62 20 136 176" xmlns="http://www.w3.org/2000/svg"><rect x="62" y="20" width="136" height="176" fill="none"/><rect x="110" y="158" width="40" height="40" rx="10" fill="${c.skin}" style="filter:brightness(.88)"/>${hairBack(c)}${faceSVG(c, {})}${hairTop(c, c.shirt || "#2a2f3a", "#ffffff")}</svg>`;
  }

  global.MB = global.MB || {};
  global.MB.Avatar = { OPTIONS, BODY_W, load, get, hasOwn, save, randomFor, toVariant, svg, headSVG, faceSVG, hairBack, hairTop };
})(window);
