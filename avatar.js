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
    hair: [["short", "Kurz"], ["side", "Seitenscheitel"], ["long", "Lang"], ["curls", "Locken"], ["afro", "Afro"], ["braids", "Zöpfe"], ["mohawk", "Irokese"], ["bun", "Dutt"], ["buzz", "Buzzcut"], ["bald", "Glatze"]],
    hairColor: ["#0d0a08", "#3b2414", "#7a4a1c", "#a8452a", "#c9a227", "#e8d08a", "#9a9a9a", "#e6e6e6", "#2b5fd9", "#d64aa0"],
    beard: [["none", "Kein Bart"], ["stubble", "Drei-Tage-Bart"], ["full", "Vollbart"], ["goatee", "Ziegenbart"], ["mustache", "Schnurrbart"]],
    glasses: [["none", "Keine"], ["glasses", "Brille"], ["shades", "Sonnenbrille"]],
    hat: [["none", "Nichts"], ["cap", "Cap"], ["beanie", "Mütze"], ["band", "Stirnband"]],
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
      shades: c.glasses === "shades", glasses: c.glasses === "glasses", chain: !!c.chain, beanie: c.hat === "beanie",
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
      default: return "";
    }
  }
  function hairTop(c, c1, c2) {
    const h = c.hairColor;
    if (c.hat === "cap") return `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="${c1}"/><path d="M78 108 Q130 96 182 108 L198 118 Q130 100 70 116Z" fill="${c2}"/><circle cx="130" cy="54" r="5" fill="${c2}"/>`;
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
      bald: `<path d="M100 72 Q118 66 130 68" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    };
    return (tops[c.hair] || tops.short) + band;
  }
  function beardSVG(c) {
    const h = c.hairColor;
    switch (c.beard) {
      case "full": return `<path d="M86 132 Q90 182 130 186 Q170 182 174 132 Q162 162 130 162 Q98 162 86 132Z" fill="${h}"/>`;
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
      : c.glasses === "shades"
        ? `<rect x="94" y="106" width="34" height="20" rx="6" fill="#0a0a0a"/><rect x="132" y="106" width="34" height="20" rx="6" fill="#0a0a0a"/><rect x="126" y="112" width="8" height="5" fill="#0a0a0a"/><path d="M99 110 L112 110 M137 110 L150 110" stroke="rgba(255,255,255,.55)" stroke-width="3"/>`
        : `<g class="eyes"><ellipse cx="110" cy="116" rx="8" ry="6" fill="#fff"/><ellipse cx="150" cy="116" rx="8" ry="6" fill="#fff"/><circle cx="112" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="148" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="113" cy="116" r="1.2" fill="#fff"/><circle cx="149" cy="116" r="1.2" fill="#fff"/></g>` +
          (c.glasses === "glasses" ? `<g fill="none" stroke="#1a1a1a" stroke-width="3.5"><circle cx="110" cy="116" r="14"/><circle cx="150" cy="116" r="14"/><path d="M124 116 L136 116 M96 114 L84 110 M164 114 L176 110"/></g>` : "");
    const brows = c.glasses === "shades" ? "" : `<path d="M98 101 Q110 95 122 101 M138 101 Q150 95 162 101" fill="none" stroke="${brow}" stroke-width="5" stroke-linecap="round"/>`;
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
    const tx = (x) => 130 + (x - 130) * bw; // Torso in die Breite ziehen
    const torso = `M${tx(40)} 440 L${tx(48)} 238 Q${tx(60)} 196 ${tx(100)} 188 L130 ${outfit === "suit" || outfit === "coach" ? 236 : 214} L${tx(160)} 188 Q${tx(200)} 196 ${tx(212)} 238 L${tx(220)} 440Z`;
    const belly = c.body === "round" ? `<ellipse cx="130" cy="370" rx="${78 * bw}" ry="70" fill="${outfit === "suit" ? "#1f2738" : c1}"/>` : "";
    let clothes = "";
    if (outfit === "suit") clothes = `<path d="${torso}" fill="#1f2738"/>${belly}<path d="M110 196 L130 300 L150 196 L130 214Z" fill="#fff"/><path d="M124 210 L136 210 L132 300 L128 300Z" fill="${c1}"/>`;
    else if (outfit === "coach") clothes = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M130 236 L130 440" stroke="${c2}" stroke-width="5"/><text x="${tx(84)}" y="300" font-family="Impact,'Arial Black'" font-size="24" fill="${c2}">HC</text>` + (team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(team)}.png" x="${tx(150)}" y="270" width="44" height="44"/>` : "");
    else if (outfit === "jersey") clothes = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M100 188 L130 214 L160 188" fill="none" stroke="${c2}" stroke-width="9"/><text x="130" y="370" text-anchor="middle" font-family="Impact,'Arial Black'" font-size="110" fill="${c2}" stroke="rgba(0,0,0,.5)" stroke-width="3" paint-order="stroke">${esc(o.number || "")}</text>`;
    else clothes = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M104 190 Q130 222 156 190" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="5"/>` + (team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(team)}.png" x="104" y="270" width="52" height="52"/>` : "");
    const sleeveCol = outfit === "suit" ? "#1f2738" : c1;
    const arms = `<path d="M${tx(60)} 222 L${tx(34)} 330" stroke="${sleeveCol}" stroke-width="${40 * Math.min(bw, 1.15)}" stroke-linecap="round"/><circle cx="${tx(32)}" cy="350" r="17" fill="${c.skin}"/>` +
      `<path d="M${tx(200)} 222 L${tx(226)} 330" stroke="${sleeveCol}" stroke-width="${40 * Math.min(bw, 1.15)}" stroke-linecap="round"/><circle cx="${tx(228)}" cy="350" r="17" fill="${c.skin}"/>`;
    const chain = c.chain && outfit !== "suit" ? `<path d="M100 200 Q130 252 160 200" fill="none" stroke="#ffd23f" stroke-width="5"/><rect x="120" y="238" width="20" height="20" rx="4" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>` : "";
    const neck = `<rect x="108" y="160" width="44" height="40" rx="10" fill="${c.skin}" style="filter:brightness(.88)"/>`;
    const h = Math.max(0.88, Math.min(1.12, Number(c.height) || 1));
    // Größe: Figur wird gestaucht/gestreckt und steht immer unten auf
    return `<svg viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet"><g transform="translate(0 ${440 * (1 - h)}) scale(1 ${h})">` +
      arms + neck + clothes + chain + `<g class="head">${hairBack(c)}${faceSVG(c, o)}${hairTop(c, c1, c2)}</g></g></svg>`;
  }

  global.MB = global.MB || {};
  global.MB.Avatar = { OPTIONS, BODY_W, load, get, hasOwn, save, randomFor, toVariant, svg, faceSVG, hairBack, hairTop };
})(window);
