/* =========================================================================
   SONG-BÜHNE — "Altima Bowl Music Television"
   -------------------------------------------------------------------------
   Meilenstein-Songs als animiertes Musikvideo:
     1) Kommentatoren-Booth (Nahaufnahme) kündigt den Song per Stimme an
     2) Rapper-Figur(en) im Trikot (Teamfarben, Name + Nummer auf dem Rücken)
        performen auf einer Konzertbühne, Lippen nach Wort-Timing + Lautstärke,
        Karaoke-Text, Lichtshow; die Kommentatoren laufen als Bild-im-Bild mit
     3) kurzer Abbinder in der Booth, dann zurück zum Turnier

   API (window.MB.SongStage):
     play({ milestone, url, performers:[{name,team}], target, speakIntro })
         -> Promise, erfüllt sich nach dem Abbinder
     demo({ duel }) -> Probelauf OHNE ElevenLabs-Credits (synthetischer Beat)
   Abhängig von: draft-stage.js (Figuren), draft-stage.css (Shell), announcer.js
   (onSpeak-Events für Lippen/Untertitel der Kommentatoren).
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------------ Teamfarben
  const TEAM_COLORS = {
    cardinals: ["#97233F", "#FFB612"], falcons: ["#A71930", "#111111"], ravens: ["#241773", "#C9A227"], bills: ["#00338D", "#C60C30"],
    panthers: ["#0085CA", "#101820"], bears: ["#0B162A", "#E4572E"], bengals: ["#FB4F14", "#111111"], browns: ["#4A2A0A", "#FF3C00"],
    cowboys: ["#003594", "#B0B7BC"], broncos: ["#FB4F14", "#002244"], lions: ["#0076B6", "#B0B7BC"], packers: ["#203731", "#FFB612"],
    texans: ["#03202F", "#A71930"], colts: ["#002C5F", "#E5E8EA"], jaguars: ["#006778", "#D7A22A"], chiefs: ["#E31837", "#FFB81C"],
    raiders: ["#111111", "#A5ACAF"], chargers: ["#0080C6", "#FFC20E"], rams: ["#003594", "#FFA300"], dolphins: ["#008E97", "#FC4C02"],
    vikings: ["#4F2683", "#FFC62F"], patriots: ["#002244", "#C60C30"], saints: ["#101820", "#D3BC8D"], giants: ["#0B2265", "#A71314"],
    jets: ["#125740", "#FFFFFF"], eagles: ["#004C54", "#A5ACAF"], steelers: ["#101820", "#FFB612"], "49ers": ["#AA0000", "#B3995D"],
    seahawks: ["#002244", "#69BE28"], buccaneers: ["#D50A0A", "#34302B"], titans: ["#0C2340", "#4B92DB"], commanders: ["#5A1414", "#FFB612"],
  };
  function teamColors(team) {
    const t = String(team || "").toLowerCase();
    for (const k of Object.keys(TEAM_COLORS)) if (t.includes(k)) return TEAM_COLORS[k];
    return ["#8a0606", "#c99700"];
  }
  function hash(str) { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

  // ------------------------------------------------------------ Figuren
  const VARIANTS = [
    { skin: "#e0ac82", hair: "#1b1410", style: "short", shades: true,  chain: true,  beard: false },
    { skin: "#7a4a2b", hair: "#0d0a08", style: "afro",  shades: false, chain: true,  beard: false },
    { skin: "#f0c4a0", hair: "#7a4a1c", style: "cap",   shades: false, chain: false, beard: true  },
    { skin: "#a5683a", hair: "#0d0a08", style: "braids", shades: true, chain: true,  beard: true  },
    { skin: "#5b3720", hair: "#0d0a08", style: "bald",  shades: true,  chain: true,  beard: true  },
    { skin: "#d9a074", hair: "#c9a227", style: "band",  shades: false, chain: false, beard: false },
  ];
  let svgUid = 0;
  function rapperSVG(variant, c1, c2, name, number, view, teamId, initial) {
    const v = variant, uid = ++svgUid;
    const dark = (hex) => hex; // Platzhalter, falls später abgetönt werden soll
    const headFront = () => {
      const hairBack = v.style === "afro" ? `<circle cx="130" cy="92" r="74" fill="${v.hair}"/>` :
        v.style === "braids" ? `<path d="M80 100 Q66 190 84 232 M96 110 Q88 190 98 236 M180 110 Q192 190 176 232 M164 110 Q172 190 162 236" stroke="${v.hair}" stroke-width="12" stroke-linecap="round" fill="none"/>` : "";
      const ears = `<ellipse cx="82" cy="124" rx="8" ry="15" fill="${v.skin}"/><ellipse cx="178" cy="124" rx="8" ry="15" fill="${v.skin}"/>`;
      const face = `<ellipse cx="130" cy="118" rx="48" ry="56" fill="${v.skin}"/>`;
      const hairTop = { short: `<path d="M82 112 Q78 62 130 60 Q182 62 178 112 Q168 84 130 82 Q92 84 82 112Z" fill="${v.hair}"/>`,
        afro: `<path d="M84 104 Q90 70 130 68 Q170 70 176 104 Q158 84 130 84 Q102 84 84 104Z" fill="${v.hair}"/>`,
        cap: `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="${c1}"/><path d="M78 108 Q130 96 182 108 L196 116 Q130 100 70 116Z" fill="${c2}"/>`,
        braids: `<path d="M82 108 Q80 62 130 60 Q180 62 178 108 Q166 82 130 80 Q94 82 82 108Z" fill="${v.hair}"/>`,
        bald: ``, band: `<path d="M82 108 Q78 62 130 60 Q182 62 178 108 Q168 82 130 80 Q92 82 82 108Z" fill="${v.hair}"/><rect x="82" y="96" width="96" height="12" rx="5" fill="${c2}"/>` }[v.style];
      const beard = v.beard ? `<path d="M88 138 Q92 178 130 182 Q168 178 172 138 Q160 160 130 160 Q100 160 88 138Z" fill="${v.hair}"/>` : "";
      const eyes = v.shades
        ? `<g><rect x="94" y="106" width="34" height="20" rx="6" fill="#0a0a0a"/><rect x="132" y="106" width="34" height="20" rx="6" fill="#0a0a0a"/><rect x="126" y="112" width="8" height="5" fill="#0a0a0a"/><path d="M99 110 L112 110" stroke="rgba(255,255,255,.55)" stroke-width="3"/><path d="M137 110 L150 110" stroke="rgba(255,255,255,.55)" stroke-width="3"/></g>`
        : `<g class="eyes"><ellipse cx="110" cy="116" rx="8" ry="6" fill="#fff"/><ellipse cx="150" cy="116" rx="8" ry="6" fill="#fff"/><circle cx="112" cy="117" r="3.6" fill="#241a12"/><circle cx="148" cy="117" r="3.6" fill="#241a12"/></g><path d="M98 102 Q110 96 122 102 M138 102 Q150 96 162 102" fill="none" stroke="${v.hair === "#c9a227" ? "#8a6d12" : v.hair}" stroke-width="5" stroke-linecap="round"/>`;
      const nose = `<path d="M130 118 Q124 138 130 142 Q136 142 134 136" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linecap="round"/>`;
      const mouth = `<g class="mouth"><path class="m0" d="M114 156 Q130 163 146 156" fill="none" stroke="${v.beard ? "#3a1b10" : "#7a3a2a"}" stroke-width="5" stroke-linecap="round"/>` +
        `<ellipse class="m1" cx="130" cy="158" rx="13" ry="6" fill="#3a0f0f"/><g class="m2"><ellipse cx="130" cy="160" rx="16" ry="12" fill="#3a0f0f"/><ellipse cx="130" cy="167" rx="8" ry="4" fill="#d9707a"/></g></g>`;
      // Eigene Spielerfigur (avatar.js): gleicher Kopf wie im Profil, Mund bleibt animierbar
      if (v.own && global.MB.Avatar && v.cfg) {
        const A = global.MB.Avatar;
        return A.hairBack(v.cfg) + A.faceSVG(v.cfg, { noMouth: true }) + A.hairTop(v.cfg, c1, c2) + mouth;
      }
      return hairBack + ears + face + hairTop + beard + eyes + nose + mouth;
    };
    const jerseyFront = `<path d="M40 440 L48 238 Q60 196 100 188 L130 232 L160 188 Q200 196 212 238 L220 440Z" fill="${c1}"/>` +
      `<path d="M100 188 L130 232 L160 188" fill="none" stroke="${c2}" stroke-width="9" stroke-linejoin="round"/>` +
      `<path d="M48 238 L44 300 M212 238 L216 300" stroke="${c2}" stroke-width="7"/>` +
      `<text x="130" y="372" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="118" fill="${c2}" stroke="rgba(0,0,0,.55)" stroke-width="3" paint-order="stroke" class="num">${esc(number)}</text>`;
    const flex = `<g class="flex"><path d="M92 196 Q130 292 168 196" fill="none" stroke="#ffd23f" stroke-width="12" stroke-linecap="round" stroke-dasharray="15 5"/>` +
      `<path d="M84 192 Q130 322 176 192" fill="none" stroke="#e8b800" stroke-width="10" stroke-linecap="round" stroke-dasharray="11 5"/>` +
      `<path d="M78 190 Q130 350 182 190" fill="none" stroke="#fff1a8" stroke-width="8" stroke-linecap="round" stroke-dasharray="8 4"/>` +
      `<g transform="translate(130 352)"><circle r="46" fill="#ffd23f" stroke="#a07a00" stroke-width="7"/><circle r="37" fill="${c1}" stroke="#fff1a8" stroke-width="3"/>` +
      `<text y="14" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="40" fill="${c2}">${esc(String(initial || "").slice(0, 1).toUpperCase())}</text>` +
      (teamId ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(teamId)}.png" x="-27" y="-27" width="54" height="54"/>` : "") +
      `<path class="a-spark" d="M-52 -34 L-48 -24 L-38 -20 L-48 -16 L-52 -6 L-56 -16 L-66 -20 L-56 -24Z" fill="#fff"/><path class="a-spark" style="animation-delay:.4s" d="M54 24 L58 34 L68 38 L58 42 L54 52 L50 42 L40 38 L50 34Z" fill="#fff"/></g></g>`;
    const chain = v.chain ? `<path d="M96 206 Q130 262 164 206" fill="none" stroke="#ffd23f" stroke-width="5"/><rect x="118" y="246" width="24" height="24" rx="5" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>` : "";
    const neck = `<rect x="108" y="162" width="44" height="40" rx="10" fill="${v.skin}" style="filter:brightness(.88)"/>`;
    const sleeves = (side) => side === "l"
      ? `<g class="arm-l"><path d="M62 220 L28 312" stroke="${c1}" stroke-width="44" stroke-linecap="round"/><path d="M28 312 L18 372" stroke="${v.skin}" stroke-width="28" stroke-linecap="round"/><circle cx="17" cy="382" r="17" fill="${v.skin}"/></g>`
      : `<g class="arm-r"><path d="M200 220 L238 292" stroke="${c1}" stroke-width="44" stroke-linecap="round"/><path d="M238 292 L180 176" stroke="${v.skin}" stroke-width="28" stroke-linecap="round"/><circle cx="176" cy="168" r="17" fill="${v.skin}"/>` +
        `<g transform="rotate(-24 168 150)"><rect x="160" y="124" width="16" height="50" rx="7" fill="#26262e"/><circle cx="168" cy="122" r="14" fill="#3c3c46" stroke="#c99700" stroke-width="3"/></g></g>`;
    const bw = v.bodyW || 1, hh = Math.max(0.88, Math.min(1.12, v.height || 1));
    const wide = (inner) => bw === 1 ? inner : `<g transform="translate(130 0) scale(${bw} 1) translate(-130 0)">${inner}</g>`;
    const tall = (inner) => hh === 1 ? inner : `<g transform="translate(0 ${440 * (1 - hh)}) scale(1 ${hh})">${inner}</g>`;
    const front = `<svg class="front" viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg">${tall(wide(sleeves("l") + neck + jerseyFront + chain) + flex + `<g class="head">${headFront()}</g>` + wide(sleeves("r")))}</svg>`;

    // Rückansicht: Name im Bogen + große Nummer
    const nm = String(name || "").toUpperCase().slice(0, 14);
    const fs = Math.max(14, Math.min(38, 176 / Math.max(4, nm.length * 0.64)));
    const hairBackView = v.style === "afro" ? `<circle cx="130" cy="92" r="74" fill="${v.hair}"/>` :
      v.style === "cap" ? `<ellipse cx="130" cy="112" rx="50" ry="58" fill="${v.skin}"/><path d="M80 112 Q76 54 130 52 Q184 54 180 112Z" fill="${c1}"/><rect x="104" y="100" width="52" height="10" rx="4" fill="${c2}"/>` :
      v.style === "bald" ? `<ellipse cx="130" cy="112" rx="50" ry="58" fill="${v.skin}"/>` :
      `<ellipse cx="130" cy="112" rx="50" ry="58" fill="${v.hair}"/>` + (v.style === "braids" ? `<path d="M88 130 Q78 200 90 238 M110 140 Q104 210 112 240 M150 140 Q156 210 148 240 M172 130 Q182 200 170 238" stroke="${v.hair}" stroke-width="12" stroke-linecap="round" fill="none"/>` : "");
    const backEars = `<ellipse cx="82" cy="124" rx="8" ry="15" fill="${v.skin}"/><ellipse cx="178" cy="124" rx="8" ry="15" fill="${v.skin}"/>`;
    const back = `<svg class="back" viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg"><defs><path id="arc${uid}" d="M30 292 Q130 232 230 292"/></defs>` +
      `<path d="M62 220 L34 330" stroke="${c1}" stroke-width="44" stroke-linecap="round"/><path d="M34 330 L30 392" stroke="${v.skin}" stroke-width="28" stroke-linecap="round"/>` +
      `<path d="M198 220 L226 330" stroke="${c1}" stroke-width="44" stroke-linecap="round"/><path d="M226 330 L230 392" stroke="${v.skin}" stroke-width="28" stroke-linecap="round"/>` +
      neck + `<path d="M40 440 L48 238 Q60 196 100 188 Q130 200 160 188 Q200 196 212 238 L220 440Z" fill="${c1}"/><path d="M48 238 L44 300 M212 238 L216 300" stroke="${c2}" stroke-width="7"/>` +
      backEars + hairBackView +
      `<text font-family="Impact,'Arial Black',sans-serif" font-size="${fs}" fill="${c2}" stroke="rgba(0,0,0,.5)" stroke-width="2" paint-order="stroke" letter-spacing="2"><textPath href="#arc${uid}" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text>` +
      `<text x="130" y="392" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="128" fill="${c2}" stroke="rgba(0,0,0,.55)" stroke-width="3" paint-order="stroke">${esc(number)}</text></svg>`;
    return front + back;
  }

  // ------------------------------------------------------------ Hilfen
  function buildLines(words) {
    const lines = []; let cur = null;
    (words || []).forEach((w, i) => {
      const prev = words[i - 1];
      const gap = prev ? w.s - prev.e : 0;
      if (!cur || gap > 0.6 || cur.words.length >= 9 || (cur.words.length >= 4 && /[.!?;]$/.test(prev ? prev.w : ""))) { cur = { words: [], s: w.s, e: w.e }; lines.push(cur); }
      cur.words.push(w); cur.e = w.e;
    });
    return lines;
  }
  async function loadTiming(url) {
    try {
      if (!/\.mp3(\?|$)/.test(url)) return null;
      const res = await fetch(url.replace(/\.mp3(\?|$)/, ".json$1"), { cache: "no-store" });
      if (!res.ok) return null;
      const j = await res.json();
      return j && typeof j === "object" ? j : null;
    } catch (e) { return null; }
  }
  function loadAudio(url, anon) {
    return new Promise((resolve, reject) => {
      const a = new Audio();
      if (anon) a.crossOrigin = "anonymous";
      a.preload = "auto";
      let done = false;
      const ok = () => { if (!done) { done = true; resolve(a); } };
      a.addEventListener("canplay", ok, { once: true });
      a.addEventListener("loadedmetadata", ok, { once: true });
      a.addEventListener("error", () => { if (!done) { done = true; reject(new Error("Audio konnte nicht geladen werden")); } }, { once: true });
      setTimeout(ok, 12000);
      a.src = url;
    });
  }

  const DEMO_TIMING = (() => {
    const lyr = ["Altima Bowl wir sind am Start", "Controller in der Hand der Beat ist hart", "Marcel bringt den Müll heut raus", "Bills Mafia springt durch den Tisch",
      "Alexander jubelt für die Chiefs", "Tim holt den Pokal nach Haus", "Jonas und die Packers sind raus", "Hey hey hey Altima Bowl", "Chris ruft laut Niners Gang",
      "Tim Tim Tim hier kommt der King", "Ring an den Finger Krone auf dem Kopf", "Marcel wirft den Rest in die Tonne", "Hey hey hey Altima Bowl", "Trainingslager heißt jetzt mein Zuhause", "Nächstes Jahr der erste Pick", "Nur einer holt den Pokal"];
    const words = []; let t = 1.2;
    lyr.forEach((l) => { l.split(" ").forEach((w) => { words.push({ w, s: t, e: t + 0.36 }); t += 0.46; }); t += 0.6; });
    return { v: 1, words, demo: true, duration: t + 1.5 };
  })();
  const DEMO_PLAYERS = [{ name: "Alexander", team: "Chiefs", id: "KC", rec: "5-1", seed: 1 }, { name: "Tim", team: "Eagles", id: "PHI", rec: "4-2", seed: 2 }, { name: "Marcel", team: "Bills", id: "BUF", rec: "3-3", seed: 3 }, { name: "Jonas", team: "Packers", id: "GB", rec: "3-3", seed: 4 }, { name: "Chris", team: "49ers", id: "SF", rec: "2-4", seed: 5 }];

  // Look nach Musikstil: CSS-Klasse "look-<id>" am Video + Taktung der Schnitte (gap < 1 = schneller)
  const LOOKS = { trap: { gap: 1 }, drill: { gap: 0.8 }, boombap: { gap: 1.05 }, conscious: { gap: 1.25 }, cloud: { gap: 1.3 }, rage: { gap: 0.75 }, dmv: { gap: 0.95 }, pluggnb: { gap: 1.2 } };
  const FINALS_OPEN_S = 7.4; // Länge von VS-Screen + Tunnel-Einlauf

  // ------------------------------------------------------------ Bühne
  let root = null, active = false;
  function fit() { if (!root) return; const c = root.querySelector(".ds-canvas"); c.style.setProperty("--ds-scale", Math.min(innerWidth / 1920, innerHeight / 1080)); }

  async function play(o) {
    o = o || {};
    const DS = global.MB.DraftStage;
    if (active || !DS || !DS.charSVG) { return null; } // läuft schon / Abhängigkeit fehlt -> Aufrufer nutzt Fallback
    active = true;
    try { if (global.MB.Avatar) await global.MB.Avatar.load(); } catch (e) { /* Zufallsfiguren */ }
    const names = DS.speakerNames();
    const meta = (global.MB.Music && global.MB.Music.MILESTONE_META && global.MB.Music.MILESTONE_META[o.milestone]) || {};
    const label = meta.label || "Song";
    const mode = o.mode || meta.mode || "hype";
    const tgt = o.target ? (typeof o.target === "string" ? { name: o.target } : o.target) : null;
    const SC = global.MB.SongScenes;
    const perfs = (o.performers || []).filter((p) => p && p.name).slice(0, 2).map((p, i, arr) => {
      const [c1, c2] = teamColors(p.team);
      let vi = hash(p.name) % VARIANTS.length;
      if (i === 1 && vi === (hash(arr[0].name) % VARIANTS.length)) vi = (vi + 3) % VARIANTS.length;
      const number = String(1 + (hash(p.name + "#") % 99));
      let v = VARIANTS[vi];
      if (global.MB.Avatar && !p.host) { const cfg = global.MB.Avatar.get(p.name); v = { ...VARIANTS[vi], ...global.MB.Avatar.toVariant(cfg), own: true, cfg }; }
      return { name: p.name, team: p.team || "", id: p.id || "", host: !!p.host, c1, c2, number: p.host ? "22" : number, v };
    });
    if (!perfs.length) perfs.push({ name: "Altima", team: "", c1: "#8a0606", c2: "#c99700", number: "22", v: VARIANTS[0] });
    const duo = perfs.length === 2;

    root = document.createElement("div");
    root.className = "ds-overlay";
    root.style.zIndex = 9500;
    root.innerHTML = `
      <div class="ds-canvas">
        <div class="ds-bg"></div>
        <div class="ds-header"><div class="ds-brand"><span class="ds-live">LIVE</span><div class="ds-logo">Altima Bowl<small>MUSIC TELEVISION</small></div></div>
          <div class="ds-strip"><div class="ds-strip-item active"><span class="nm" style="font-size:26px">${esc(label)}</span></div></div>
          <div class="ds-tools"><button id="sgSkip" title="Song überspringen (Esc)">⏭</button></div></div>
        <div class="sg-main" id="sgMain">
          <div class="ds-cam" id="sgCam">${DS.sceneHTML("booth-close", names).replace('class="ds-scene ', 'class="ds-scene on ')}</div>
          <div class="sg-center" id="sgCenter"></div>
        </div>
        <div class="sg-mv" id="sgMv" style="--c1:${perfs[0].c1};--c2:${perfs[0].c2}">
          <div class="sg-beam b1"></div><div class="sg-beam b2"></div><div class="sg-beam b3"></div>
          <div class="sg-led"><div class="txt" id="sgLedTxt" style="--fs:${(() => { const n = perfs.map((p) => p.name).join(" × ").length; return n <= 7 ? 200 : n <= 10 ? 160 : n <= 16 ? 112 : 80; })()}px">${esc(perfs.map((p) => p.name).join(" × "))}</div><div class="sub">${esc(label)} · LIVE</div></div>
          <div class="sg-field"></div><div class="sg-floor"></div><div class="sg-fx"></div><div class="sg-press"><div class="pw"></div><div class="pdesk"><i></i><i></i><i></i><i></i><i></i></div><div class="pflash"></div></div><div class="sg-restroom"><div class="rt-tiles"></div><div class="rt-throne"></div><div class="rt-rolls"></div><div class="rt-sign">TOILET BOWL · LIVE</div></div>
          <div id="sgRaps" class="sg-raps"></div>
          <div class="sg-crowd"></div><div class="sg-flash"></div><div class="sg-fx2"></div>
          <div class="sg-pip">${DS.sceneHTML("booth", names).replace('class="ds-scene ', 'class="ds-scene on ')}<div class="pt">STUDIO</div></div>
          <div class="sg-desk"></div><div class="sg-bling" id="sgBling">BLING!</div><div class="sg-name" id="sgName"></div>
          <div class="sg-cut" id="sgCut"></div>
        </div>
        <div class="sg-lyrics" id="sgLyrics" style="display:none"></div>
        <div class="ds-caption off" id="sgCap"><div class="ds-cap-name" id="sgCapName"></div><div class="ds-cap-text" id="sgCapText"></div></div>
        <div class="sg-skip">ESC = ÜBERSPRINGEN</div>
      </div>`;
    document.body.appendChild(root);
    fit(); window.addEventListener("resize", fit);

    const $ = (s) => root.querySelector(s);
    const mv = $("#sgMv"), lyr = $("#sgLyrics"), cap = $("#sgCap"), cutEl = $("#sgCut");
    let recorder = null, recChunks = [], recStream = null, recMime = "";
    if (o.record) {
      try {
        recStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "exclude" });
        const vt = recStream.getVideoTracks()[0];
        try { // Region Capture: nur die 16:9-Bühne aufnehmen (Chrome/Edge), sonst ganzer Tab
          const T = global.RestrictionTarget || global.CropTarget, el = $(".ds-canvas");
          if (T && vt) { const tg = await T.fromElement(el); await (vt.restrictTo ? vt.restrictTo(tg) : vt.cropTo(tg)); }
        } catch (e) { console.warn("Region-Capture nicht verfügbar:", e); }
        recMime = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => global.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
        recorder = new MediaRecorder(recStream, recMime ? { mimeType: recMime, videoBitsPerSecond: 8000000 } : { videoBitsPerSecond: 8000000 });
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
        recorder.start(1000);
      } catch (e) { // Dialog abgebrochen o.Ä. -> Aufnahme-Wunsch fallen lassen, Abspielen aber normal weiter
        console.warn("Aufnahme nicht gestartet:", e); recorder = null; if (recStream) recStream.getTracks().forEach((t) => t.stop()); recStream = null;
      }
    }
    let skipped = false, stopMedia = null;
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); skip(); } };
    const skip = () => { skipped = true; if (stopMedia) stopMedia(); };
    document.addEventListener("keydown", onKey, true);
    $("#sgSkip").onclick = skip;

    // Sprecher-Events: Kommentatoren-Lippen + Untertitel
    let unsub = null;
    const plain = (t) => String(t || "").replace(/\[[^\]]*\]|<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim();
    try {
      unsub = global.MB.Announcer.onSpeak((evt) => {
        const role = evt.role || "commentator";
        root.querySelectorAll(".sg-main .ds-char").forEach((c) => {
          const mine = c.dataset.role === role, on = evt.type === "start";
          c.classList.toggle("talking", on && mine); c.classList.toggle("is-speaker", on && mine); c.classList.toggle("dim", on && !mine);
        });
        if (evt.type === "start") {
          $("#sgCapName").innerHTML = `${esc(names[role] || role)}<small>${role === "moderator" ? "MODERATION" : "KOMMENTAR"}</small>`;
          $("#sgCapText").textContent = plain(evt.text); cap.classList.remove("off");
        } else setTimeout(() => cap.classList.add("off"), 1500);
      });
    } catch (e) {}

    // ---- Phase 1: Ankündigung ----
    const chips = perfs.map((p) => `<span class="sg-chip" style="--c1:${p.c1};--c2:${p.c2}"><i></i><span>${esc(p.name)}<small>${esc((p.team || "").toUpperCase())} · #${p.number}</small></span></span>`).join("");
    $("#sgCenter").innerHTML = `<div class="ds-kicker">Weltpremiere</div><div class="sg-premiere">${esc(label)}</div><div class="sg-title">${duo ? "Das Duell" : "Live am Mikrofon"}</div><div style="margin-top:18px">${chips}</div>` +
      (tgt ? `<div class="sg-target">Ziel des Tracks: <b>${esc(tgt.name)}</b></div>` : "");

    const timingP = o.demo ? Promise.resolve(DEMO_TIMING) : (o.url ? loadTiming(o.url) : Promise.resolve(null));
    let audio = null, usingAnalyser = false;
    const audioP = o.demo ? Promise.resolve(null) : (async () => { try { usingAnalyser = true; return await loadAudio(o.url, true); } catch (e) { usingAnalyser = false; try { return await loadAudio(o.url, false); } catch (e2) { return null; } } })();

    try { if (o.speakIntro) await o.speakIntro(); else await sleep(2500); } catch (e) { console.warn("Song-Ansage:", e); }
    if (!o.speakIntro) {} else await sleep(500);
    root.querySelectorAll(".sg-main .ds-char").forEach((c) => c.classList.remove("talking", "dim", "is-speaker"));
    cap.classList.add("off");

    // ---- Phase 2: Musikvideo ----
    const rawTiming = await timingP;
    const timing = rawTiming && rawTiming.words && rawTiming.words.length ? rawTiming : null;
    const styleId = o.style || (rawTiming && rawTiming.style) || meta.defaultStyleId || "trap";
    audio = await audioP;
    let duration = o.demo ? DEMO_TIMING.duration : ((audio && isFinite(audio.duration) && audio.duration > 5) ? audio.duration : (timing ? timing.words[timing.words.length - 1].e + 8 : 75));
    const plist = (o.players && o.players.length ? o.players : (o.demo ? DEMO_PLAYERS : perfs)).map((p) => { const c = teamColors(p.team); return { name: p.name, team: p.team, id: p.id, rec: p.rec, seed: p.seed, c1: c[0], c2: c[1] }; });
    const recap = mode === "recap";
    const look = !recap && LOOKS[styleId] ? styleId : null; // die Altima Zone (Recap) behält ihren festen Studio-Look
    const finalsOpen = o.milestone === "finals" && perfs.length === 2 && !recap;
    const script = SC ? SC.buildScript({
      seed: hash((o.milestone || "") + "|" + (o.url || "demo") + "|" + perfs.map((p) => p.name).join(",")), milestone: o.milestone, mode, recap, gapScale: look ? LOOKS[look].gap : 1, start: finalsOpen ? FINALS_OPEN_S + 1 : 5,
      performers: perfs.map((p) => ({ name: p.name, team: p.team, c1: p.c1, c2: p.c2 })), target: tgt ? { name: tgt.name, team: tgt.team } : null, players: plist, teamColors,
    }, timing, duration) : { cuts: [], turns: [] };
    console.info("Song-Schnittliste:", script.cuts.map((c) => `${c.t.toFixed(1)}s ${c.scene}`).join(" | "), "· Treffer:", script.stats);
    if (!skipped && (audio || o.demo)) {
      const raps = $("#sgRaps"), lines = buildLines(timing && timing.words);
      raps.innerHTML = perfs.map((p, i) => `<div class="sg-rap ${duo ? (i ? "duo-b" : "duo-a") : "solo"} ${duo && i ? "idle" : ""}" data-i="${i}" data-m="0"><div class="bob"><div class="turn">${rapperSVG(p.v, p.c1, p.c2, p.name, p.number, "front", p.id, (p.team || p.name))}</div></div></div>`).join("");
      const rapEls = [...raps.querySelectorAll(".sg-rap")];
      let tiles = [];
      if (recap) { // Studio im RedZone-Stil: Monitorwand mit allen Spielern + Tabellen-Ticker
        mv.classList.add("recap");
        const sorted = plist.slice().sort((a, b) => (a.seed || 99) - (b.seed || 99)).slice(0, 10), cols = Math.ceil(sorted.length / 2);
        const wall = document.createElement("div"); wall.className = "sg-wall"; wall.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        wall.innerHTML = sorted.map((p) => `<div class="wt" data-name="${esc(p.name)}" style="--c1:${p.c1};--c2:${p.c2}">${p.id ? `<img src="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(p.id)}.png" alt="" onerror="this.style.display='none'">` : ""}<b>${esc(p.name)}</b><span>${esc(p.team || "")}${p.rec ? " · " + esc(p.rec) : ""}</span><i>${p.seed ? "#" + esc(p.seed) : ""}</i></div>`).join("");
        mv.insertBefore(wall, raps);
        const tk = sorted.map((p) => `#${p.seed || "?"} ${p.name} (${p.team || ""}) ${p.rec || ""}`).join("   •   ");
        const ticker = document.createElement("div"); ticker.className = "sg-ticker"; ticker.innerHTML = `<span class="tl">TABELLE</span><div class="tw"><div class="tin">${esc(tk)}   •   ${esc(tk)}   •   </div></div>`;
        mv.appendChild(ticker);
        tiles = [...wall.querySelectorAll(".wt")];
      }
      const hotTile = (name) => { const t = tiles.find((x) => x.dataset.name === name); if (!t) return; t.classList.add("hot"); setTimeout(() => t.classList.remove("hot"), 2200); };
      const nameEl = $("#sgName");
      mv.classList.add("on"); lyr.style.display = "flex"; $("#sgMain").style.visibility = "hidden";
      if (look) mv.classList.add("look-" + look);
      // Eigene Videoformate: Erstes Ausscheiden = Pressekonferenz, Toilet Bowl = Toiletten-Konzert
      if (!recap && o.milestone === "firstElimination") { mv.classList.add("press", "presser"); }
      if (!recap && o.milestone === "toiletBowl") {
        mv.classList.add("restroom");
        const thr = $(".sg-restroom .rt-throne");
        if (thr) thr.innerHTML = `<svg viewBox="0 0 400 420"><rect x="120" y="20" width="160" height="150" rx="16" fill="#ffd23f" stroke="#a07a00" stroke-width="8"/><circle cx="250" cy="56" r="14" fill="#fff3b8"/>` +
          `<path d="M60 200 Q60 170 90 170 H310 Q340 170 340 200 Q340 300 250 330 L240 410 H160 L150 330 Q60 300 60 200Z" fill="#ffd23f" stroke="#a07a00" stroke-width="8"/><ellipse cx="200" cy="196" rx="120" ry="26" fill="#a07a00"/>` +
          `<path d="M120 60 L140 20 L160 60 L200 10 L240 60 L260 20 L280 60" fill="none" stroke="#d50a0a" stroke-width="10" stroke-linejoin="round"/></svg>`;
        const rolls = $(".sg-restroom .rt-rolls");
        if (rolls) rolls.innerHTML = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 137) % 96}%;animation-delay:${(i * 0.37) % 3}s;animation-duration:${3 + (i % 4) * 0.6}s"></i>`).join("");
      }
      const pw = $(".sg-press .pw"); if (pw) pw.innerHTML = Array.from({ length: 7 }, (_, i) => `<div style="margin-left:${(i % 2) * -120}px">${"ALTIMA BOWL ◆ ALTIMA ◆ ".repeat(8)}</div>`).join("");
      if (finalsOpen) { // Finals: VS-Screen + Tunnel-Einlauf während der ersten Sekunden des Songs
        const pr = (p) => plist.find((x) => x.name === p.name) || p;
        const side = (p, cls) => { const q = pr(p); return `<div class="op-side ${cls}" style="--c1:${p.c1};--c2:${p.c2}">${p.id ? `<img src="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(p.id)}.png" alt="" onerror="this.style.display='none'">` : ""}<b style="font-size:${Math.max(64, Math.min(120, 780 / Math.max(5, String(p.name).length)))}px">${esc(p.name)}</b><span>${esc(String(p.team).toUpperCase())}${q.rec ? " · " + esc(q.rec) : ""}${q.seed ? " · SEED #" + esc(q.seed) : ""}</span></div>`; };
        const tun = (p, cls) => `<div class="tn ${cls}" style="--c1:${p.c1};--c2:${p.c2}"><div class="tn-light"></div><div class="tn-fig">${rapperSVG(p.v, p.c1, p.c2, p.name, p.number, "front", p.id, p.team)}</div><div class="tn-fog"></div><div class="tn-name">${esc(p.name)}</div></div>`;
        const op = document.createElement("div"); op.className = "sg-open";
        op.innerHTML = `<div class="op-vs">${side(perfs[0], "a")}${side(perfs[1], "b")}<div class="op-v a-shake">VS</div><div class="op-tag">DAS FINALE</div></div><div class="op-tunnel">${tun(perfs[0], "a")}${tun(perfs[1], "b")}<div class="op-tag t2">SPIELER BETRETEN DAS FELD</div></div>`;
        mv.appendChild(op); setTimeout(() => op.remove(), (FINALS_OPEN_S + 0.8) * 1000);
      }
      lyr.innerHTML = timing ? "" : `<div class="nolyr">♪ LIVE-PERFORMANCE ♪<span class="sg-eq"><i></i><i></i><i></i><i></i></span></div>`;

      // Zeitquelle + Audio-Analyse
      let getTime, analyser = null, freq = null, actx = null, demoNodes = null;
      let endedP;
      if (o.demo) {
        try { actx = new (global.AudioContext || global.webkitAudioContext)(); await actx.resume(); } catch (e) {}
        const t0 = actx ? actx.currentTime : 0, tStart = performance.now(), total = DEMO_TIMING.duration;
        getTime = () => actx ? actx.currentTime - t0 : (performance.now() - tStart) / 1000;
        if (actx) { // einfacher Beat: Kick, Hat, Bass
          for (let b = 0; b * 0.48 < total; b++) {
            const t = t0 + b * 0.48;
            const k = actx.createOscillator(), kg = actx.createGain(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(45, t + 0.15);
            kg.gain.setValueAtTime(0.5, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.2); k.connect(kg); kg.connect(actx.destination); k.start(t); k.stop(t + 0.22);
            if (b % 2) { const n = actx.createOscillator(), ng = actx.createGain(); n.type = "square"; n.frequency.value = 330; ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12); n.connect(ng); ng.connect(actx.destination); n.start(t); n.stop(t + 0.14); }
            const bs = actx.createOscillator(), bg = actx.createGain(); bs.type = "sawtooth"; bs.frequency.value = [55, 55, 65.4, 49][b % 4]; bg.gain.setValueAtTime(0.09, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.44); bs.connect(bg); bg.connect(actx.destination); bs.start(t); bs.stop(t + 0.46);
          }
        }
        endedP = new Promise((res) => { stopMedia = res; setTimeout(res, total * 1000); });
      } else {
        getTime = () => audio.currentTime;
        if (usingAnalyser) {
          try {
            actx = new (global.AudioContext || global.webkitAudioContext)(); await actx.resume();
            const src = actx.createMediaElementSource(audio); analyser = actx.createAnalyser(); analyser.fftSize = 512;
            src.connect(analyser); analyser.connect(actx.destination); freq = new Uint8Array(analyser.frequencyBinCount);
          } catch (e) { analyser = null; console.warn("Analyser nicht verfügbar:", e); }
        }
        endedP = new Promise((res) => { stopMedia = () => { try { audio.pause(); } catch (e) {} res(); }; audio.addEventListener("ended", res, { once: true }); audio.addEventListener("error", res, { once: true }); });
        try { audio.volume = 1; await audio.play(); } catch (e) { console.warn("Song konnte nicht starten:", e); stopMedia(); }
      }

      // Render-Schleife: Lippen, Beat, Karaoke, Drehung zur Rückansicht
      let wi = 0, li = -1, kick = 0, lastKick = 0, avgBass = 0, lastTurn = 0, turning = false, raf = 0, ci = 0, ti = 0, cutTimer = 0, mi = 0, lastLed = null, lastLedT = -9, hi = 0;
      const blingEl = $("#sgBling");
      const ledEl = $("#sgLedTxt"), ledDefault = ledEl.textContent, ledDefaultFs = ledEl.style.getPropertyValue("--fs");
      const rapsBox = $("#sgRaps"), poseTimers = new Map();
      const applyMove = (m, active) => {
        if (m.kind === "pose") {
          [...active.classList].filter((c) => c.startsWith("pose-")).forEach((c) => active.classList.remove(c));
          active.classList.add("pose-" + m.name); clearTimeout(poseTimers.get(active));
          poseTimers.set(active, setTimeout(() => active.classList.remove("pose-" + m.name), m.dur * 1000));
        } else if (m.kind === "cam") {
          [...rapsBox.classList].filter((c) => c.startsWith("cam-")).forEach((c) => rapsBox.classList.remove(c));
          rapsBox.classList.add("cam-" + m.name); clearTimeout(rapsBox._ct); rapsBox._ct = setTimeout(() => rapsBox.classList.remove("cam-" + m.name), m.dur * 1000);
        } else if (m.kind === "flex") { // Gold-Flex: Zoom auf die Brust, dicke Ketten mit Teamlogo
          const x = active.classList.contains("duo-a") ? 28 : active.classList.contains("duo-b") ? 72 : 50;
          rapsBox.style.setProperty("--fx", (50 - x) + "%"); rapsBox.style.transformOrigin = x + "% 70%";
          [...rapsBox.classList].filter((c) => c.startsWith("cam-")).forEach((c) => rapsBox.classList.remove(c));
          rapsBox.classList.add("cam-chest"); active.classList.add("flexing", "pose-pump"); blingEl.classList.add("on");
          setTimeout(() => { rapsBox.classList.remove("cam-chest"); active.classList.remove("flexing", "pose-pump"); blingEl.classList.remove("on"); setTimeout(() => { rapsBox.style.transformOrigin = ""; }, 800); }, m.dur * 1000);
        } else if (m.kind === "press") { // Pressekonferenz: Rapper am Pult, Blitzlichter
          mv.classList.add("press"); setTimeout(() => { if (!mv.classList.contains("presser")) mv.classList.remove("press"); }, m.dur * 1000);
        } else if (m.kind === "walk") {
          mv.classList.add("walk"); active.classList.add("walkx");
          setTimeout(() => { mv.classList.remove("walk"); active.classList.remove("walkx"); }, m.dur * 1000);
        }
      };
      const doTurn = (el) => {
        if (turning || !el) return; turning = true;
        const turn = el.querySelector(".turn"); turn.classList.add("flip");
        setTimeout(() => { el.classList.add("showback"); turn.classList.remove("flip"); }, 230);
        setTimeout(() => { turn.classList.add("flip"); }, 3200);
        setTimeout(() => { el.classList.remove("showback"); turn.classList.remove("flip"); turning = false; lastTurn = getTime(); }, 3450);
      };
      const runCut = (c) => {
        cutEl.className = "sg-cut"; cutEl.innerHTML = SC.render(c.scene, c.params) + `<div class="sg-cut-tag">${esc(SC.LABELS[c.scene] || "")}</div>`;
        void cutEl.offsetWidth; cutEl.classList.add("on"); clearTimeout(cutTimer);
        cutTimer = setTimeout(() => { cutEl.classList.add("off"); setTimeout(() => { cutEl.className = "sg-cut"; cutEl.innerHTML = ""; }, 280); }, c.dur * 1000);
      };
      const lyrEl = lyr;
      const tick = () => {
        const t = getTime();
        // Beat
        let level = 0;
        if (analyser) {
          analyser.getByteFrequencyData(freq);
          let bass = 0; for (let i = 1; i < 7; i++) bass += freq[i]; bass /= 6 * 255;
          let all = 0; for (let i = 2; i < 60; i++) all += freq[i]; level = all / (58 * 255);
          avgBass = avgBass * 0.92 + bass * 0.08;
          if (bass > avgBass * 1.18 + 0.06 && t - lastKick > 0.2) { kick = 1; lastKick = t; }
        } else if (t - lastKick > 0.48) { kick = 1; lastKick = t; }
        kick *= 0.9; mv.style.setProperty("--kick", kick.toFixed(3));

        // aktuelles Wort
        const words = timing ? timing.words : null;
        let inWord = null;
        if (words) {
          while (wi < words.length - 1 && t > words[wi].e + 0.05) wi++;
          const w = words[wi]; if (w && t >= w.s - 0.03 && t <= w.e + 0.05) inWord = w;
        }
        // Karaoke-Zeile
        if (timing && lines.length) {
          let idx = -1; for (let i = 0; i < lines.length; i++) { if (lines[i].s - 0.25 <= t) idx = i; else break; }
          if (idx !== li) {
            li = idx;
            if (idx >= 0) {
              lyrEl.innerHTML = `<div class="cur">${lines[idx].words.map((w, k) => `<span class="w" data-k="${k}">${esc(w.w)}</span>`).join(" ")}</div><div class="nxt">${lines[idx + 1] ? esc(lines[idx + 1].words.map((w) => w.w).join(" ")) : ""}</div>`;
            } else lyrEl.innerHTML = `<div class="nolyr">♪<span class="sg-eq"><i></i><i></i><i></i><i></i></span></div>`;
            // Duell: Wechsel der aktiven Figur pro Zeile
            if (duo && idx >= 0) rapEls.forEach((el, i) => el.classList.toggle("idle", i !== (idx % 2)));
          }
          if (li >= 0) lyrEl.querySelectorAll(".w").forEach((sp) => { const w = lines[li].words[+sp.dataset.k]; sp.classList.toggle("on", t >= w.s); });
        }
        // Lippen
        const activeRap = duo ? rapEls[(li >= 0 ? li : 0) % 2] : rapEls[0];
        let m = 0;
        if (inWord) {
          const prog = (t - inWord.s) / Math.max(0.08, inWord.e - inWord.s), syl = Math.max(1, Math.round(inWord.w.length / 3));
          const amp = analyser ? Math.min(1, level * 4.2) * 0.6 + (0.4 + 0.6 * Math.abs(Math.sin(prog * Math.PI * syl))) * 0.4 : 0.35 + 0.65 * Math.abs(Math.sin(prog * Math.PI * syl));
          m = amp > 0.62 ? 2 : amp > 0.22 ? 1 : 0;
        } else if (!timing) { // keine Zeitstempel: nur auf Lautstärke bzw. Takt reagieren
          const amp = analyser ? Math.min(1, level * 5) : (Math.abs(Math.sin(t * 9.5)) * 0.9);
          m = amp > 0.55 ? 2 : amp > 0.2 ? 1 : 0;
        }
        rapEls.forEach((el) => { el.dataset.m = el === activeRap ? m : 0; });
        // Rapper-Moves (Posen, Kamera, Spaziergang)
        while (mi < (script.moves || []).length && t >= script.moves[mi].t) { const mvv = script.moves[mi++]; if (t - mvv.t < 1.5) applyMove(mvv, activeRap); }
        activeRap.classList.toggle("rapping", m > 0);
        // LED-Wand: gesungenes Wort groß einblenden (Lyric-Video-Gefühl), sonst Namen
        if (inWord && inWord !== lastLed) {
          const wd = inWord.w.replace(/[^\p{L}\p{N}'-]/gu, "").toUpperCase();
          if (wd.length >= 3) { lastLed = inWord; lastLedT = t; ledEl.textContent = wd; ledEl.style.setProperty("--fs", (wd.length <= 6 ? 200 : wd.length <= 9 ? 150 : 100) + "px"); ledEl.classList.remove("flash"); void ledEl.offsetWidth; ledEl.classList.add("flash"); }
        } else if (lastLed && t - lastLedT > 1.6) { lastLed = null; ledEl.textContent = ledDefault; ledEl.style.setProperty("--fs", ledDefaultFs); ledEl.classList.remove("flash"); }
        while (hi < (script.hl || []).length && t >= script.hl[hi].t) { const h = script.hl[hi++]; if (t - h.t < 1.5) hotTile(h.name); }
        // Schnittliste abarbeiten (Zwischenszenen) + Drehung zum Trikot, wenn der eigene Name fällt
        while (ci < script.cuts.length && t >= script.cuts[ci].t) { const c = script.cuts[ci++]; if (t - c.t < 1.5) runCut(c); }
        while (ti < script.turns.length && t >= script.turns[ti].t) { const tr = script.turns[ti++]; if (t - tr.t < 1.5) doTurn(rapEls.find((el) => perfs[+el.dataset.i].name === tr.who)); }
        // Namensschild + gelegentlich Rückansicht (Name auf dem Trikot)
        const pf = perfs[+activeRap.dataset.i];
        if (nameEl.dataset.k !== String(+activeRap.dataset.i)) { nameEl.dataset.k = +activeRap.dataset.i; nameEl.style.setProperty("--c2", pf.c2); nameEl.textContent = pf.host ? `${pf.name} · STUDIO` : `${pf.name} · #${pf.number} · ${String(pf.team).toUpperCase()}`; mv.style.setProperty("--c1", pf.c1); mv.style.setProperty("--c2", pf.c2); }
        if (!turning && t - lastTurn > 18 && t > 8) { lastTurn = t; doTurn(activeRap); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      await endedP;
      cancelAnimationFrame(raf); clearTimeout(cutTimer); cutEl.className = "sg-cut"; cutEl.innerHTML = "";
      try { if (audio) audio.pause(); } catch (e) {}
      try { if (actx) actx.close(); } catch (e) {}
    }

    // ---- Phase 3: Abbinder ----
    if (!skipped) {
      mv.classList.remove("on", "press", "presser", "restroom"); lyr.style.display = "none"; $("#sgMain").style.visibility = "visible";
      $("#sgCenter").innerHTML = `<div class="sg-outro"><div class="ds-kicker">Und das war's</div><div class="sg-premiere" style="font-size:90px">Was für ein Track!</div><div class="sg-title">${esc(label)}</div></div>`;
      root.querySelectorAll(".sg-main .ds-char").forEach((c) => c.classList.add("hype"));
      await sleep(2600);
    }
    // Aufnahme beenden + Download
    if (recorder) {
      await sleep(600);
      const hasAudio = recStream && recStream.getAudioTracks().length > 0;
      await new Promise((res) => { recorder.onstop = res; try { recorder.stop(); } catch (e) { res(); } });
      recStream.getTracks().forEach((t) => t.stop());
      if (recChunks.length) {
        const ext = /mp4/.test(recMime) ? "mp4" : "webm";
        const blob = new Blob(recChunks, { type: recMime || "video/webm" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `altima-bowl-${o.milestone || "song"}-${perfs.map((p) => p.name).join("-").replace(/[^\w-]+/g, "")}.${ext}`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        if (!hasAudio) alert("Video gespeichert, aber ohne Ton: Beim Teilen-Dialog bitte \"Tab-Audio teilen\" aktivieren (nur Chrome/Edge).");
      }
    }
    // Aufräumen
    if (unsub) unsub();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", fit);
    root.style.transition = "opacity .5s"; root.style.opacity = 0; await sleep(500);
    root.remove(); root = null; active = false;
    return true;
  }

  async function demo(opts) {
    const kind = (opts && opts.kind) || (opts && opts.duel ? "duel" : "solo");
    const base = { demo: true, speakIntro: () => new Promise((r) => setTimeout(r, 2500)), players: DEMO_PLAYERS, style: opts && opts.style };
    if (kind === "recap") return play(Object.assign(base, { mode: "recap", milestone: "regularSeason", performers: [{ name: "MC Altima", team: "", host: true }] }));
    if (kind === "victor") return play(Object.assign(base, { mode: "victor", milestone: "firstElimination", performers: [{ name: "Tim", team: "Eagles", id: "PHI" }], target: { name: "Marcel", team: "Bills" } }));
    if (kind === "duel") return play(Object.assign(base, { mode: "hype", milestone: "finals", performers: [{ name: "Alexander", team: "Chiefs", id: "KC" }, { name: "Tim", team: "Eagles", id: "PHI" }] }));
    if (kind === "diss" || kind === "self") return play(Object.assign(base, { mode: "self", milestone: "toiletBowl", performers: [{ name: "Tim", team: "Eagles", id: "PHI" }], target: null }));
    return play(Object.assign(base, { mode: "brag", milestone: "champion", performers: [{ name: "Tim", team: "Eagles" }], target: { name: "Marcel", team: "Bills" } }));
  }
  // Gezielte Aufnahme (Button im Admin-Bereich): spielt die Bühne ohne Sprachansage erneut ab
  // und lädt das Video herunter. Muss direkt aus einem Klick heraus aufgerufen werden.
  function record(o) { return play(Object.assign({}, o, { record: true })); }

  global.MB.SongStage = { play, demo, record, teamColors, isActive: () => active };
})(window);
