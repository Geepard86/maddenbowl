/* =========================================================================
   DRAFT-BÜHNE — animierte Fernseh-Übertragung für die Live-Draft-Show
   -------------------------------------------------------------------------
   Vollbild-Overlay für einen 1920x1080-Beamer (skaliert proportional).
   Zeigt wie Madden 98 "on air": zwei Moderatoren-Booth + Ring-Ansager,
   Kamerawechsel (Nahaufnahme bei automatischen Momenten, kleine Booth bei
   der Team-Wahl), Slot-Ziehung, große Team-Auswahl, Gruppengegner und
   Slot-Board rechts.

   Benötigt KEINE Bild-Assets — die Figuren sind SVG und werden hier
   erzeugt. Sprecherwechsel kommen per MB.Announcer.onSpeak(...).

   API (window.MB.DraftStage):
     init({ getData, onSelect, onConfirm, onFinish, getRoster })
       getRoster(teamId) -> Promise<Zeile aus madden_rosters | null>  (optional, Kader-Ansicht per Klick auf das ⓘ der Team-Kachel)
     open() / close() / isOpen()
     phase(mode)       -> gleiche mode-Objekte wie renderDraftShowStage()
     setStrip(items)   -> [{i,name,status,teamId}]
     refreshSide()     -> Gegner/Slot-Board neu zeichnen
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};

  const LOGO = (id) => `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${id}.png`;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let opts = { getData: () => ({}), onSelect() {}, onConfirm() {}, onFinish() {}, getRoster: null };
  let root = null, el = {}, built = false;
  let phaseName = "", curCam = "booth", lastRole = "commentator";
  let selectedTeam = null, prevOpp = new Set(), speakUnsub = null, captionTimer = null, clockTimer = null;

  // ---------------------------------------------------------------- Figuren
  const PEOPLE = {
    commentator: { skin: "#e0ac82", hair: "#b9bec6", style: "short", suit: "#9b1c1c", shirt: "#f2f2f2", tie: "#c99700", stache: true, glasses: false, headset: true },
    moderator:   { skin: "#f0c4a0", hair: "#5a3420", style: "long",  suit: "#1e4fa8", shirt: "#f7f0e6", tie: null,      stache: false, glasses: false, headset: true, ear: "#ffd23f" },
    announcer:   { skin: "#d9a074", hair: "#14110f", style: "slick", suit: "#0d0d12", shirt: "#ffffff", tie: "#d50a0a", bow: true, stache: false, glasses: false, headset: false, vest: "#c99700", mic: true },
  };

  function charSVG(role) {
    const p = PEOPLE[role];
    const hairBack = p.style === "long" ? `<path d="M48 100 Q40 210 66 236 L134 236 Q160 210 152 100 Q150 52 100 50 Q50 52 48 100Z" fill="${p.hair}"/>` : "";
    const hairFront = {
      short: `<path d="M52 98 Q46 48 100 46 Q154 48 148 98 Q140 72 100 70 Q60 72 52 98Z" fill="${p.hair}"/>`,
      long:  `<path d="M50 104 Q44 46 100 44 Q156 46 150 104 Q138 66 108 64 Q82 84 50 104Z" fill="${p.hair}"/>`,
      slick: `<path d="M52 98 Q50 42 104 42 Q152 44 148 98 Q136 66 96 66 Q66 68 52 98Z" fill="${p.hair}"/><path d="M70 56 Q100 44 136 60" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/>`,
    }[p.style];
    const body = `<path d="M10 280 Q12 188 100 180 Q188 188 190 280Z" fill="${p.suit}"/>` +
      (p.vest ? `<path d="M70 186 L100 250 L130 186 L130 280 L70 280Z" fill="${p.vest}"/>` : "") +
      `<path d="M74 184 L100 240 L126 184 Q100 196 74 184Z" fill="${p.shirt}"/>` +
      (p.tie ? `<path d="M93 200 L107 200 L112 250 L100 262 L88 250Z" fill="${p.tie}"/>` : "") +
      (p.bow ? `<path d="M84 196 L100 204 L84 214Z M116 196 L100 204 L116 214Z" fill="${p.tie}"/><circle cx="100" cy="204" r="5" fill="#8a0606"/>` : "") +
      `<path d="M74 184 L92 226 L62 200Z M126 184 L108 226 L138 200Z" fill="${p.suit}" stroke="rgba(255,255,255,.12)" stroke-width="2"/>`;
    const neck = `<rect x="84" y="150" width="32" height="40" rx="8" fill="${p.skin}" style="filter:brightness(.88)"/>`;
    const head = `<ellipse cx="53" cy="112" rx="8" ry="15" fill="${p.skin}"/><ellipse cx="147" cy="112" rx="8" ry="15" fill="${p.skin}"/>` +
      `<ellipse cx="100" cy="108" rx="48" ry="56" fill="${p.skin}"/>`;
    const earring = p.ear ? `<circle cx="53" cy="130" r="4" fill="${p.ear}"/><circle cx="147" cy="130" r="4" fill="${p.ear}"/>` : "";
    const eyes = `<g class="eyes"><ellipse cx="80" cy="104" rx="8" ry="6" fill="#fff"/><ellipse cx="120" cy="104" rx="8" ry="6" fill="#fff"/>` +
      `<circle cx="82" cy="105" r="3.6" fill="#241a12"/><circle cx="118" cy="105" r="3.6" fill="#241a12"/></g>`;
    const brows = `<g class="brows" fill="none" stroke="${p.style === "long" ? "#3a2012" : p.hair}" stroke-width="5" stroke-linecap="round"><path d="M68 90 Q80 83 92 90"/><path d="M108 90 Q120 83 132 90"/></g>`;
    const glasses = p.glasses ? `<g fill="none" stroke="#111" stroke-width="3"><rect x="66" y="94" width="28" height="20" rx="6"/><rect x="106" y="94" width="28" height="20" rx="6"/><path d="M94 102 H106"/></g>` : "";
    const nose = `<path d="M100 108 Q94 128 100 132 Q106 132 104 126" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linecap="round"/>`;
    const stache = p.stache ? `<path d="M76 140 Q100 130 124 140 Q112 148 100 144 Q88 148 76 140Z" fill="${p.hair}"/>` : "";
    const lip = p.style === "long" ? "#b5384a" : "#7a3a2a";
    const mouth = `<g class="mouth">` +
      `<path class="m-closed" d="M84 146 Q100 154 116 146" fill="none" stroke="${lip}" stroke-width="5" stroke-linecap="round"/>` +
      `<ellipse class="m-half" cx="100" cy="148" rx="13" ry="6" fill="#3a0f0f"/>` +
      `<g class="m-open"><ellipse cx="100" cy="150" rx="15" ry="11" fill="#3a0f0f"/><ellipse cx="100" cy="157" rx="8" ry="4" fill="#d9707a"/></g></g>`;
    const headset = p.headset ? `<path d="M52 104 Q50 40 100 40 Q150 40 148 104" fill="none" stroke="#1a1a1f" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="40" y="98" width="16" height="30" rx="7" fill="#26262e"/><path d="M46 126 Q60 158 88 152" fill="none" stroke="#26262e" stroke-width="4"/><circle cx="90" cy="152" r="6" fill="#111"/>` : "";
    const mic = p.mic ? `<g><rect x="132" y="150" width="14" height="60" rx="6" fill="#2b2b33" transform="rotate(-22 139 180)"/><ellipse cx="124" cy="146" rx="15" ry="17" fill="#3c3c46" stroke="#c99700" stroke-width="3"/><path d="M112 138 Q124 146 136 138 M112 146 Q124 154 136 146" stroke="#777" stroke-width="2" fill="none"/></g>` : "";
    return `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">${hairBack}${body}${neck}${head}${earring}${hairFront}${brows}${eyes}${glasses}${nose}${stache}${mouth}${headset}${mic}</svg>`;
  }

  function charHTML(role, names) {
    const nm = (names && names[role]) || role;
    return `<div class="ds-char" data-role="${role}" data-name="${esc(nm)}">${charSVG(role)}</div>`;
  }

  function sceneHTML(type, names) {
    const tag = (t, sub) => `<div class="ds-tag">${t}${sub ? `<small>${sub}</small>` : ""}</div>`;
    if (type === "booth" || type === "booth-close") {
      const big = type === "booth-close";
      return `<div class="ds-scene ds-scene-booth${big ? " ds-scene-boothclose" : ""}" data-scene="${type}"><div class="ds-zoom"><div class="ds-bg-booth" style="position:absolute;inset:0"></div>${charHTML("commentator", names)}${charHTML("moderator", names)}<div class="ds-desk"></div></div>${tag("Kommentatoren-Booth", big ? "Nahaufnahme" : "Totale")}<div class="ds-rec">${big ? "CAM 1" : "REC"}</div></div>`;
    }
    if (type === "close-commentator" || type === "close-moderator") {
      const role = type.split("-")[1];
      return `<div class="ds-scene ds-scene-close" data-scene="${type}"><div class="ds-zoom"><div class="ds-bg-booth" style="position:absolute;inset:0"></div>${charHTML(role, names)}</div>${tag(esc(names[role] || role), role === "commentator" ? "Kommentator" : "Moderation")}<div class="ds-rec">CAM 2</div></div>`;
    }
    return `<div class="ds-scene ds-scene-ring ds-scene-close" data-scene="ring"><div class="ds-zoom"><div class="ds-bg-ring" style="position:absolute;inset:0"></div>${charHTML("announcer", names)}</div>${tag(esc(names.announcer || "Ring-Ansager"), "Ring-Ansager")}<div class="ds-rec">RING</div></div>`;
  }

  // ---------------------------------------------------------------- Aufbau
  function build() {
    const names = speakerNames();
    root = document.createElement("div");
    root.className = "ds-overlay ds-hidden";
    root.innerHTML = `
      <div class="ds-canvas" id="dsCanvas">
        <div class="ds-bg"></div>
        <div class="ds-header">
          <div class="ds-brand"><span class="ds-live">LIVE</span><div class="ds-logo">Altima Bowl<small>DRAFT NIGHT</small></div></div>
          <div class="ds-strip" id="dsStrip"></div>
          <div class="ds-tools"><button id="dsFs" title="Vollbild">⛶</button><button id="dsClose" title="Bühne ausblenden (Steuerung unten bleibt)">✕</button></div>
        </div>
        <div class="ds-main cam-close" id="dsMain">
          <div class="ds-left">
            <div class="ds-cam" id="dsCam">
              ${sceneHTML("booth", names)}${sceneHTML("booth-close", names)}${sceneHTML("close-commentator", names)}${sceneHTML("close-moderator", names)}${sceneHTML("ring", names)}
              <div class="ds-flash" id="dsFlash"></div>
            </div>
            <div class="ds-pip" id="dsPip">${sceneHTML("ring", names).replace('data-scene="ring"', 'data-scene="pip-ring"')}</div>
          </div>
          <div class="ds-center" id="dsCenter"></div>
          <div class="ds-right">
            <div class="ds-panel" id="dsOpp"></div>
            <div class="ds-panel" id="dsBoard"></div>
          </div>
        </div>
        <div class="ds-caption off" id="dsCaption"><div class="ds-cap-name" id="dsCapName"></div><div class="ds-cap-text" id="dsCapText"></div></div>
      </div>`;
    document.body.appendChild(root);
    el = {
      canvas: root.querySelector("#dsCanvas"), main: root.querySelector("#dsMain"), cam: root.querySelector("#dsCam"),
      center: root.querySelector("#dsCenter"), strip: root.querySelector("#dsStrip"), opp: root.querySelector("#dsOpp"),
      board: root.querySelector("#dsBoard"), cap: root.querySelector("#dsCaption"), capName: root.querySelector("#dsCapName"),
      capText: root.querySelector("#dsCapText"), flash: root.querySelector("#dsFlash"), pip: root.querySelector("#dsPip"),
    };
    root.querySelector("#dsClose").onclick = () => close();
    root.querySelector("#dsFs").onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen && root.requestFullscreen().catch(() => {});
    };
    window.addEventListener("resize", fit);
    built = true;
    fit();
  }

  function fit() {
    if (!el.canvas) return;
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    el.canvas.style.setProperty("--ds-scale", s);
  }

  function speakerNames() {
    try { return global.MB.Announcer.getSpeakerNames(); } catch (e) { return { commentator: "Kommentator", moderator: "Moderation", announcer: "Ring-Ansager" }; }
  }

  // ---------------------------------------------------------------- Kamera
  function setCam(scene, { flash = true } = {}) {
    if (!built) return;
    const isClose = scene !== "booth";
    el.main.classList.toggle("cam-close", isClose);
    el.main.classList.toggle("cam-booth", !isClose);
    if (scene === curCam && el.cam.querySelector(".ds-scene.on")) return;
    curCam = scene;
    el.cam.querySelectorAll(".ds-scene").forEach((s) => s.classList.toggle("on", s.dataset.scene === scene));
    const pip = el.pip.querySelector(".ds-scene"); if (pip) pip.classList.add("on");
    if (flash) { el.flash.classList.remove("go"); void el.flash.offsetWidth; el.flash.classList.add("go"); }
  }
  function camForRole(role) {
    if (role === "announcer") return "ring";
    if (role === "moderator") return "close-moderator";
    return "close-commentator";
  }
  function setTalking(role, on, hype) {
    root.querySelectorAll(".ds-char").forEach((c) => {
      const mine = c.dataset.role === role;
      c.classList.toggle("talking", !!on && mine);
      c.classList.toggle("is-speaker", !!on && mine);
      c.classList.toggle("dim", !!on && !mine);
    });
    if (hype !== undefined) root.querySelectorAll(".ds-char").forEach((c) => c.classList.toggle("hype", !!hype && c.dataset.role === (role || "announcer")));
  }
  function setHype(role, on) {
    root.querySelectorAll(".ds-char").forEach((c) => c.classList.toggle("hype", !!on && c.dataset.role === role));
  }

  // ------------------------------------------------------- Sprecher-Events
  function plain(t) { return String(t || "").replace(/\[[^\]]*\]|<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim(); }
  function onSpeak(evt) {
    if (!built || !root || root.classList.contains("ds-hidden")) return;
    const role = evt.role || lastRole;
    const names = speakerNames();
    if (evt.type === "start") {
      lastRole = role;
      if (phaseName !== "picking" && phaseName !== "done" && phaseName !== "intro" && phaseName !== "walkin") setCam(camForRole(role));
      setTalking(role, true);
      clearTimeout(captionTimer);
      el.capName.innerHTML = `${esc(names[role] || role)}<small>${role === "announcer" ? "RING-ANSAGER" : role === "moderator" ? "MODERATION" : "KOMMENTAR"}</small>`;
      el.capText.textContent = plain(evt.text);
      el.cap.classList.remove("off");
    } else {
      setTalking(role, false);
      clearTimeout(captionTimer);
      captionTimer = setTimeout(() => el.cap.classList.add("off"), 1800);
    }
  }

  // ------------------------------------------------------------ Seitenpanels
  function refreshSide() {
    if (!built) return;
    const d = opts.getData() || {};
    // Gegner
    const opps = d.opponents || [];
    const who = d.drawnName;
    let html = `<h3>Gruppengegner${who ? `<small>von ${esc(who)}</small>` : `<small>erscheinen nach der Slot-Ziehung</small>`}</h3>`;
    const nowSet = new Set();
    opps.forEach((o) => {
      const key = `${o.round}|${o.name || ""}`; if (o.name) nowSet.add(key);
      const fresh = o.name && !prevOpp.has(key) ? " fresh" : "";
      html += `<div class="ds-opp${fresh}"><span class="rd">Runde ${o.round}</span>${o.teamId ? `<img src="${LOGO(o.teamId)}" alt="">` : `<span style="width:36px"></span>`}<span class="nm${o.name ? "" : " tbd"}">${o.name ? esc(o.name) : "noch offen"}</span><span class="ha">${o.home ? "HOME" : "AWAY"}</span></div>`;
    });
    prevOpp = nowSet;
    el.opp.innerHTML = html;
    // Slot-Board
    const slots = d.slots || [];
    let b = `<h3>Slot-Board<small>${slots.filter((s) => s.name).length} von ${slots.length} vergeben</small></h3>`;
    slots.forEach((s) => {
      const cls = s.name ? (s.teamId ? "assigned" : "await") : "";
      b += `<div class="ds-slotrow ${cls}${s.slot === d.focusSlot ? " focus" : ""}"><span class="sl">P${s.slot + 1}</span>${s.teamId ? `<img src="${LOGO(s.teamId)}" alt="">` : `<span style="width:30px"></span>`}<span class="nm">${s.name ? esc(s.name) : "— offen —"}</span></div>`;
    });
    el.board.innerHTML = b;
  }

  function setStrip(items) {
    if (!built) return;
    el.strip.innerHTML = (items || []).map((it) => `<div class="ds-strip-item ${it.status}"><span class="n">${it.i + 1}</span>${it.teamId ? `<img src="${LOGO(it.teamId)}" alt="">` : ""}<span class="nm">${esc(it.name)}</span></div>`).join("");
    const act = el.strip.querySelector(".active");
    if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest", inline: "center" });
  }

  // ------------------------------------------------------------ Mitte/Phasen
  function put(html) { el.center.innerHTML = `<div class="ds-phase">${html}</div>`; }

  function confetti(n = 70) {
    const c = document.createElement("div"); c.className = "ds-confetti";
    const cols = ["#ffd23f", "#d50a0a", "#ffffff", "#1e50c8", "#c99700"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2, r = 250 + Math.random() * 520;
      p.style.cssText = `background:${cols[i % cols.length]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r * .8 + 160}px;--rot:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * .15}s`;
      c.appendChild(p);
    }
    el.center.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }

  function nameSize(name) { const n = String(name || "").length; return n <= 7 ? 110 : n <= 9 ? 88 : n <= 11 ? 72 : n <= 14 ? 56 : 44; }

  function renderPicker(d) {
    const teams = d.teams || [];
    const tiles = teams.map((t) => {
      const ovrCls = t.rating >= 88 ? "hi" : t.rating >= 82 ? "mid" : "";
      const cls = t.status === "ex" ? "ex" : t.status === "taken" ? "tk" : "";
      const dis = t.status !== "free" ? "disabled" : "";
      const badge = t.status === "taken" ? `<span class="ovr">${esc(t.takenBy || "vergeben")}</span>` : t.status === "ex" ? `<span class="ovr">raus</span>` : `<span class="ovr ${ovrCls}">OVR ${t.rating || "–"}</span>`;
      const info = (opts.getRoster && t.status === "free") ? `<span class="ds-info" data-info="${t.id}" title="Kader anzeigen">ⓘ</span>` : "";
      return `<button type="button" class="ds-tile ${cls}${selectedTeam === t.id ? " sel" : ""}" data-team="${t.id}" ${dis}>${info}<img src="${LOGO(t.id)}" alt=""><span class="ds-tn">${esc(t.n)}</span>${badge}</button>`;
    }).join("");
    put(`<div class="ds-pick-head"><span class="who">${esc(d.drawnName || "")}</span><span class="slot">SLOT P${(d.focusSlot ?? 0) + 1}</span></div>
      <div class="ds-grid">${tiles}</div>
      <button type="button" class="ds-confirm" id="dsConfirm" ${selectedTeam ? "" : "disabled"}>✔ Team bestätigen</button>`);
    el.center.querySelectorAll(".ds-tile:not(:disabled)").forEach((b) => {
      b.onclick = () => {
        selectedTeam = b.dataset.team;
        el.center.querySelectorAll(".ds-tile").forEach((x) => x.classList.toggle("sel", x === b));
        const c = el.center.querySelector("#dsConfirm"); c.disabled = false;
        opts.onSelect(selectedTeam);
      };
    });
    el.center.querySelectorAll(".ds-info").forEach((i) => {
      i.onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); openRoster(i.dataset.info); };
    });
    el.center.querySelector("#dsConfirm").onclick = () => { if (selectedTeam) opts.onConfirm(); };
  }

  // ---------------------------------------------------------------- Kader-Ansicht
  function closeRoster() {
    const r = el.center && el.center.querySelector(".ds-roster");
    if (r) r.remove();
    document.removeEventListener("keydown", rosterKey, true);
  }
  function rosterKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeRoster(); } }

  async function openRoster(teamId) {
    if (!opts.getRoster || !el.center) return;
    closeRoster();
    const d = opts.getData() || {};
    const t = (d.teams || []).find((x) => x.id === teamId) || { id: teamId, n: teamId, rating: 0 };
    const box = document.createElement("div");
    box.className = "ds-roster";
    box.innerHTML = `<div class="rs-head"><img src="${LOGO(teamId)}" alt=""><div class="rs-title"><div class="rs-name">${esc(t.n)}</div><div class="rs-sub" id="rsSub">Kader wird geladen …</div></div>
      <div class="rs-ovr"><b>${t.rating || "–"}</b><small>OVR</small></div><button type="button" class="rs-close" title="Schließen (Esc)">✕</button></div>
      <div class="rs-body" id="rsBody"></div><div class="rs-foot" id="rsFoot"></div>`;
    box.addEventListener("click", (e) => { if (e.target === box) closeRoster(); });
    box.querySelector(".rs-close").onclick = closeRoster;
    el.center.appendChild(box);
    document.addEventListener("keydown", rosterKey, true);

    let row = null;
    try { row = await opts.getRoster(teamId); } catch (e) { row = null; }
    if (!box.isConnected) return; // inzwischen geschlossen / Phase gewechselt
    const body = box.querySelector("#rsBody"), sub = box.querySelector("#rsSub"), foot = box.querySelector("#rsFoot");
    const players = (row && row.players) || [];
    if (!players.length) {
      sub.textContent = "Kein Kader gespeichert";
      body.innerHTML = `<div class="rs-empty">Für dieses Team liegt noch kein Kader vor.<br><small>In „Seasons“ → Team-Werte → „Von Madden Ratings abrufen“ ausführen.</small></div>`;
      return;
    }
    const sorted = players.slice().sort((a, b) => (b.ovr - a.ovr) || String(a.n).localeCompare(String(b.n)));
    const irCount = sorted.filter((p) => p.ir).length;
    const when = row.fetched_at ? new Date(row.fetched_at).toLocaleDateString("de-DE") : "";
    const diff = (row.team_ovr != null && t.rating && row.team_ovr !== t.rating) ? ` · Madden-Seite: ${row.team_ovr}` : "";
    sub.textContent = `${players.length} Spieler${row.madden_version ? " · Madden " + row.madden_version : ""}${when ? " · Stand " + when : ""}${irCount ? " · " + irCount + " auf IR" : ""}${diff}`;
    body.style.gridTemplateRows = `repeat(${Math.ceil(sorted.length / 3)}, 29px)`;
    body.innerHTML = sorted.map((p) => {
      const tip = [p.arch, p.num != null ? "#" + p.num : "", p.ir ? "IR" + (p.irNote ? " (" + p.irNote + ")" : "") + (p.irTeam ? " · laut NFL bei " + p.irTeam : "") : ""].filter(Boolean).join(" · ");
      return `<div class="rs-row${p.ir ? " ir" : ""}" title="${esc(tip)}"><span class="o${p.ovr >= 90 ? " h" : p.ovr >= 80 ? " m" : ""}">${p.ovr}</span><span class="p">${esc(p.pos)}</span><span class="n">${esc(p.n)}</span>${p.badge ? `<span class="b ${p.badge === "XF" ? "xf" : "ss"}">${p.badge}</span>` : ""}${p.ir ? `<span class="b irt">IR</span>` : ""}</div>`;
    }).join("");
    const um = row.ir_unmatched || [];
    foot.innerHTML = `<span class="lg"><b class="b xf">XF</b> X-Factor &nbsp; <b class="b ss">SS</b> Superstar &nbsp; <b class="b irt">IR</b> laut NFL auf Injured Reserve</span>` +
      (um.length ? `<div class="rs-um">⚠ Auf der NFL-IR, aber nicht im Madden-Kader zuordenbar: ${um.map((x) => esc(x.n) + (x.p ? " (" + esc(x.p) + ")" : "")).join(", ")}</div>` : "");
  }

  function phase(mode) {
    if (!built) return;
    const d = opts.getData() || {};
    refreshSide();
    const names = speakerNames();
    setHype("announcer", false); setHype("commentator", false);
    if (mode.intro) {
      phaseName = "intro"; selectedTeam = null;
      setCam("booth-close"); // beide Sprecher in der Nahaufnahme, Kamera bleibt während der ganzen Begrüßung stehen
      put(`<div class="ds-kicker">Live aus dem Stadion</div><div class="ds-big-title" style="font-size:68px">Altima Bowl<br>Draft Night</div><div class="ds-sub">Heute Abend werden die Slots gezogen und die Teams vergeben.</div>`);
      setHype("commentator", true); setHype("moderator", true);
    } else if (mode.callingLabelOnly || mode.calling) {
      phaseName = "calling";
      setCam("ring");
      const nm = mode.calling;
      put(`<div class="ds-kicker">Jetzt auf der Bühne</div>${nm && mode.nickname ? `<div class="ds-nick">„${esc(mode.nickname)}“</div>` : ""}${nm ? `<div class="ds-name" style="font-size:${nameSize(nm)}px">${esc(nm)}</div>` : `<div style="height:140px"></div>`}${nm && d.badges && d.badges.length ? `<div class="ds-tags">${d.badges.map((b, i) => `<span class="ds-tag-chip ${i % 2 ? "gold" : ""}">${esc(b)}</span>`).join("")}</div>` : ""}`);
      if (nm) setHype("announcer", true);
    } else if (mode.drawing) {
      phaseName = "drawing";
      setCam("ring");
      put(`<div class="ds-kicker">${esc(mode.drawing)}</div><div class="ds-slotbox" style="margin-top:20px"><div class="lbl">DER SLOT WIRD GEZOGEN</div><div class="ds-slotnum" id="dsSlotSpin">P?</div></div>`);
      setHype("announcer", true);
    } else if (mode.drawn) {
      phaseName = "drawn";
      setCam("ring", { flash: false });
      put(`<div class="ds-burst"></div><div class="ds-kicker">${esc(mode.drawn.name)}</div><div class="ds-slotbox reveal" style="margin-top:20px"><div class="lbl">SLOT STEHT FEST</div><div class="ds-slotnum">P${mode.drawn.slot + 1}</div></div>`);
      confetti(90);
      setHype("announcer", true);
    } else if (mode.prompt) {
      phaseName = "prompt";
      setCam("booth");
      put(`<div class="ds-kicker">Du bist dran</div><div class="ds-name" style="font-size:${nameSize(mode.prompt)}px">${esc(mode.prompt)}</div><div class="ds-big-title" style="font-size:64px;margin-top:10px">Wähle dein Team!</div>`);
    } else if (mode.picking) {
      phaseName = "picking"; selectedTeam = null;
      setCam("booth");
      renderPicker(d);
    } else if (mode.commentating) {
      phaseName = "commentating";
      // Rolle kommt aus admin.html (Rudi/Mona im Wechsel) -> auch ohne Audio korrekt
      if (mode.role) lastRole = mode.role;
      setCam(camForRole(mode.role || (lastRole === "commentator" ? "moderator" : "commentator")));
      const lp = d.lastPick || {};
      put(`<div class="ds-teamcard">${lp.teamId ? `<img src="${LOGO(lp.teamId)}" alt="">` : ""}<div class="tname">${esc(lp.teamName || "")}</div><div class="pline"><b>${esc(mode.commentating)}</b> übernimmt · Slot P${(lp.slot ?? 0) + 1}${lp.rating ? ` · OVR ${lp.rating}` : ""}</div></div>`);
      setHype("commentator", true);
    } else if (mode.done) {
      phaseName = "done";
      setCam("booth");
      put(`<div class="ds-kicker">Alle Plätze vergeben</div><div class="ds-big-title">Draft komplett!</div><div class="ds-sub">Bereit für den Anpfiff?</div><button type="button" class="ds-big-btn" id="dsFinish">🏈 Altima Bowl starten</button>`);
      el.center.querySelector("#dsFinish").onclick = () => opts.onFinish();
      setHype("commentator", true); setHype("moderator", true);
      confetti(120);
    } else if (mode.kickoff) {
      phaseName = "kickoff";
      setCam("booth");
      put(`<div class="ds-kick"><div class="ds-kicker">Anpfiff</div><div class="ds-big-title">Altima Bowl</div><div class="ds-sub">Viel Erfolg am Controller!</div></div>`);
      setHype("commentator", true); setHype("moderator", true);
      confetti(160);
    }
  }

  // ------------------------------------------------- BOOT-INTRO (PS2-Stil)
  let audioCtx = null;
  function ac() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {} return audioCtx; }
  function tone(freq, t0, dur, type, vol, attack) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.value = freq;
    const t = c.currentTime + (t0 || 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.05, t + (attack || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function bootChime() { // weicher, ambienter Akkord mit Schimmer — angelehnt an klassische Konsolen-Starts
    [130.8, 196, 261.6, 329.6, 493.9].forEach((f, i) => tone(f, i * 0.12, 3.4, "sine", 0.045, 0.9));
    [1568, 2093, 2637].forEach((f, i) => tone(f, 0.9 + i * 0.22, 1.6, "triangle", 0.012, 0.05));
  }
  function slam() { tone(98, 0, 1.1, "sawtooth", 0.07, 0.01); tone(196, 0, 0.9, "square", 0.04, 0.01); tone(392, 0.02, 0.6, "triangle", 0.04, 0.01); }
  const blip = () => tone(880, 0, 0.07, "square", 0.04, 0.005);
  const select = () => { tone(660, 0, 0.09, "square", 0.05, 0.005); tone(990, 0.09, 0.16, "square", 0.05, 0.005); };

  let bootEl = null, bootTimers = [], bootKeyHandler = null;
  function bootCleanup() {
    bootTimers.forEach(clearTimeout); bootTimers = [];
    if (bootKeyHandler) { document.removeEventListener("keydown", bootKeyHandler, true); bootKeyHandler = null; }
    if (bootEl) { bootEl.remove(); bootEl = null; }
  }
  function boot(onStart) {
    if (!built) build();
    bootCleanup();
    el.cap.classList.add("off");
    bootEl = document.createElement("div");
    bootEl.className = "ds-boot";
    bootEl.innerHTML = `
      <div class="bt-stage bt-sports" id="btA"><div class="bt-cubes"><i></i><i></i><i></i><i></i></div><div class="logo">ALTIMA<sup>™</sup></div><div class="sub">SPORTS</div></div>
      <div class="bt-stage bt-bowl" id="btB"><div class="ball"></div><div class="logo">Altima<br>Bowl</div><div class="est">EST. <b>2022</b> &nbsp;ALEX&nbsp;•&nbsp;TIM&nbsp;•&nbsp;MARKUS</div></div>
      <div class="bt-stage bt-menu" id="btC">
        <div class="mt">Altima Bowl</div><div class="ms">DRAFT NIGHT</div>
        <div class="bt-panel" id="btItems"></div>
        <div class="mf">▲▼ AUSWÄHLEN &nbsp;·&nbsp; ENTER / KLICK BESTÄTIGEN</div>
        <div class="mc">© 2022 ALTIMA SPORTS · ALLE RECHTE VORBEHALTEN</div>
      </div>
      <div class="bt-skip" id="btSkip">KLICK / ENTER = ÜBERSPRINGEN ▶▶</div>`;
    el.canvas.appendChild(bootEl);
    const A = bootEl.querySelector("#btA"), B = bootEl.querySelector("#btB"), C = bootEl.querySelector("#btC"), skip = bootEl.querySelector("#btSkip");
    const at = (ms, fn) => bootTimers.push(setTimeout(fn, ms));
    const items = [
      { label: "Draft-Show starten", act: () => { select(); bootEl.classList.add("out"); at(550, () => { bootCleanup(); onStart && onStart(); }); } },
      { label: "Zurück zum Setup", act: () => { bootCleanup(); close(); } },
    ];
    let sel = 0, inMenu = false;
    const drawItems = () => {
      bootEl.querySelector("#btItems").innerHTML = items.map((it, i) => `<div class="bt-item ${i === sel ? "sel" : ""} ${i === 1 ? "dim" : ""}" data-i="${i}"><span class="cur">▶</span>${esc(it.label)}</div>`).join("");
      bootEl.querySelectorAll(".bt-item").forEach((n) => {
        n.onmouseenter = () => { if (sel !== +n.dataset.i) { sel = +n.dataset.i; blip(); drawItems(); } };
        n.onclick = (e) => { e.stopPropagation(); sel = +n.dataset.i; items[sel].act(); };
      });
    };
    const showMenu = () => {
      if (inMenu) return; inMenu = true; bootTimers.forEach(clearTimeout); bootTimers = [];
      A.classList.remove("show"); B.classList.remove("show"); C.classList.add("show"); skip.style.display = "none";
      drawItems();
    };
    // Ablauf: Sports-Logo -> Bowl-Logo -> Menü
    ac(); bootChime();
    A.classList.add("show");
    at(3300, () => A.classList.remove("show"));
    at(4300, () => { B.classList.add("show"); slam(); });
    at(8300, () => B.classList.remove("show"));
    at(9300, showMenu);
    bootEl.addEventListener("click", () => { if (!inMenu) showMenu(); });
    bootKeyHandler = (e) => {
      if (!inMenu) { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); showMenu(); } return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; blip(); drawItems(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); items[sel].act(); }
    };
    document.addEventListener("keydown", bootKeyHandler, true);
  }


  // ---------------------------------------------------------------- Einlauf (Head Coach)
  // Wird nur genutzt, wenn die Dauer der Ring-Ansage bekannt ist (ElevenLabs,
  // MB.Announcer.prepareRingIntro). Drei Schnitte, auf die Ansage getimt:
  //   Tunnel (Silhouette läuft ins Licht) -> Nahaufnahme (Jacke mit Name, Ringe in
  //   die Kamera / Klo-Trophäe / Rookie-Stempel, Fakten eingeblendet) -> Draftboard
  //   (Name-Reveal zum Ende der Ansage, je später der Pick desto triumphaler).
  function coachSVG(o) {
    // eigene Spielerfigur im Coach-Outfit (avatar.js), sonst die alte Standardfigur
    if (global.MB.Avatar) {
      const cfg = global.MB.Avatar.get(o.name);
      const fig = global.MB.Avatar.svg(cfg, { outfit: "coach", c1: o.toilet ? "#6b5a3a" : "#2a2f3a", c2: o.toilet ? "#e9e2cf" : "#c99700", team: cfg.team });
      if (!o.toilet) return fig;
      // Toilet-Bowl-Sieger: Klobrille als Kragen
      return fig.replace("</svg>", `<ellipse cx="130" cy="196" rx="62" ry="20" fill="none" stroke="#f4f4f4" stroke-width="12"/><ellipse cx="130" cy="196" rx="62" ry="20" fill="none" stroke="#cfd5dc" stroke-width="3"/></svg>`);
    }
    return coachSVGLegacy(o);
  }
  function coachSVGLegacy(o) {
    const nm = esc(String(o.name || "").toUpperCase().slice(0, 12));
    const toilet = !!o.toilet;
    const jacket = toilet ? "#6b5a3a" : "#2a2f3a", trim = toilet ? "#e9e2cf" : "#c99700";
    const seat = toilet ? `<ellipse cx="100" cy="186" rx="58" ry="20" fill="none" stroke="#f4f4f4" stroke-width="12"/><ellipse cx="100" cy="186" rx="58" ry="20" fill="none" stroke="#cfd5dc" stroke-width="3"/>` : "";
    const cap = toilet
      ? `<path d="M58 70 Q100 30 142 70 L142 78 L58 78Z" fill="#f4f4f4"/><rect x="94" y="18" width="12" height="34" rx="4" fill="#8a5a2b"/><ellipse cx="100" cy="18" rx="20" ry="9" fill="#c0392b"/>`
      : `<path d="M54 84 Q56 40 100 38 Q144 40 146 84Z" fill="#14181f"/><path d="M50 84 L170 88 L150 98 L50 92Z" fill="#14181f"/><text x="100" y="72" text-anchor="middle" font-family="Impact,Arial Black" font-size="20" fill="${trim}">AB</text>`;
    return `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 300 Q10 200 100 190 Q190 200 192 300Z" fill="${jacket}"/>
      <path d="M100 196 L100 300" stroke="${trim}" stroke-width="5"/>
      <path d="M8 300 Q10 200 100 190 Q190 200 192 300" fill="none" stroke="${trim}" stroke-width="5"/>
      <text x="60" y="246" text-anchor="middle" font-family="Impact,Arial Black" font-size="${nm.length > 7 ? 13 : 17}" fill="#fff" letter-spacing="1">${nm}</text>
      <text x="142" y="246" text-anchor="middle" font-family="Impact,Arial Black" font-size="15" fill="${trim}">HC</text>
      <rect x="84" y="150" width="32" height="44" rx="8" fill="#d9a074" style="filter:brightness(.88)"/>
      <ellipse cx="100" cy="116" rx="46" ry="54" fill="#d9a074"/>
      <ellipse cx="82" cy="114" rx="5" ry="4" fill="#241a12"/><ellipse cx="118" cy="114" rx="5" ry="4" fill="#241a12"/>
      <path d="M70 98 Q82 92 94 99 M106 99 Q118 92 130 98" stroke="#2b1d12" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M84 146 Q100 ${toilet ? 140 : 156} 116 146" stroke="#7a3a2a" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${cap}${seat}
    </svg>`;
  }

  // Faust (Fingerrücken zur Kamera) mit Champion-Ringen auf den Fingern.
  // fingers: Indizes 0..3 (Zeige- bis kleiner Finger), die einen Ring tragen.
  function fistSVG(fingers, mirror, delay0, skinCol) {
    const skin = skinCol || "#d9a074", shade = "rgba(0,0,0,.22)", sleeve = "#2a2f3a", trim = "#c99700";
    const fx = (i) => 30 + i * 36; // linke Kante je Finger
    let f = "", r = "";
    for (let i = 0; i < 4; i++) {
      const x = fx(i), h = i === 3 ? 58 : 70, y = i === 3 ? 74 : 62;
      f += `<rect x="${x}" y="${y}" width="34" height="${h}" rx="16" fill="${skin}" stroke="${shade}" stroke-width="3"/>` +
           `<path d="M${x + 8} ${y + 24} Q${x + 17} ${y + 19} ${x + 26} ${y + 24}" stroke="${shade}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    fingers.forEach((i, k) => {
      const x = fx(i), y = i === 3 ? 74 : 62, cx = x + 17;
      const d = (delay0 + k * 0.28).toFixed(2);
      r += `<g class="bling" style="animation-delay:${d}s">` +
           `<rect x="${x - 2}" y="${y + 36}" width="38" height="13" rx="4" fill="#e8b923" stroke="#8a6400" stroke-width="2"/>` +
           `<rect x="${cx - 23}" y="${y + 6}" width="46" height="36" rx="9" fill="#ffd23f" stroke="#8a6400" stroke-width="3"/>` +
           `<rect x="${cx - 15}" y="${y + 12}" width="30" height="24" rx="5" fill="${k % 2 ? "#d50a0a" : "#1e50c8"}" stroke="#fff6c8" stroke-width="2"/>` +
           `<circle cx="${cx}" cy="${y + 24}" r="5" fill="#fff" opacity=".9"/>` +
           `<path class="spark" d="M${cx + 20} ${y - 6} l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z" fill="#fff" style="animation-delay:${d}s"/></g>`;
    });
    return `<svg viewBox="0 0 200 270" xmlns="http://www.w3.org/2000/svg" style="${mirror ? "transform:scaleX(-1)" : ""}">
      <rect x="44" y="196" width="112" height="74" rx="10" fill="${sleeve}"/><rect x="44" y="196" width="112" height="10" fill="${trim}"/>
      <rect x="28" y="96" width="146" height="112" rx="34" fill="${skin}" stroke="${shade}" stroke-width="3"/>
      ${f}
      <rect x="36" y="150" width="104" height="34" rx="17" fill="${skin}" stroke="${shade}" stroke-width="3" transform="rotate(-6 88 167)"/>
      ${r}
    </svg>`;
  }

  function walkCss() {
    if (document.getElementById("dsWalkCss")) return;
    const st = document.createElement("style"); st.id = "dsWalkCss";
    st.textContent = `
      .ds-phase.walkwrap { position: absolute; inset: 0; animation: none; }
      .ds-walk { position: absolute; inset: 0; overflow: hidden; border: 5px solid #c99700; border-radius: 6px; background: #000; }
      .ds-walk .cut { position: absolute; inset: 0; opacity: 0; transition: opacity .18s; overflow: hidden; }
      .ds-walk .cut.on { opacity: 1; }
      .ds-walk .skip { position: absolute; right: 10px; top: 10px; z-index: 9; background: rgba(0,0,0,.55); color: #cfd8e6; border: 1px solid rgba(255,255,255,.3); border-radius: 6px; font: 700 15px 'Segoe UI'; padding: 6px 12px; cursor: pointer; }
      .ds-walk .pickno { position: absolute; left: 16px; top: 14px; z-index: 8; font: 900 24px/1 Impact, sans-serif; letter-spacing: 3px; color: #fff; background: #d50a0a; padding: 8px 14px; clip-path: polygon(0 0,100% 0,92% 100%,0 100%); }
      .ds-walk .fig { position: absolute; left: 50%; bottom: -4%; width: 62%; aspect-ratio: 2/3; transform: translateX(-50%); transform-origin: 50% 100%; }
      .ds-walk .fig svg { width: 100%; height: 100%; display: block; }
      .ds-walk .sil .fig { filter: brightness(0) drop-shadow(0 0 30px rgba(255,220,140,.85)); }
      .ds-walk .fog { position: absolute; left: -20%; right: -20%; bottom: 0; height: 40%; background: radial-gradient(ellipse at 50% 100%, rgba(255,255,255,.4), transparent 70%); animation: dsFog 3s ease-in-out infinite alternate; }
      @keyframes dsFog { to { transform: translateX(6%); } }
      .ds-walk .strobe { position: absolute; inset: 0; background: #fff; opacity: 0; animation: dsStrobe 1.6s steps(1) infinite; mix-blend-mode: overlay; }
      @keyframes dsStrobe { 0%,100% { opacity: 0; } 8% { opacity: .35; } 12% { opacity: 0; } 54% { opacity: .25; } 58% { opacity: 0; } }

      /* Auftritt A: Tunnel */
      .ds-walk .in-tunnel { background: radial-gradient(ellipse at 50% 38%, #fff 0, #ffe9a8 7%, #6b5a2a 22%, #120f0a 48%, #000 72%); }
      .ds-walk .in-tunnel::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 9%, rgba(255,255,255,.06) 9% 10%); transform: perspective(500px) rotateX(58deg) translateY(30%); transform-origin: 50% 100%; }
      .ds-walk .in-tunnel.on .fig { animation: dsWalkA var(--t1) cubic-bezier(.3,.5,.4,1) forwards; }
      @keyframes dsWalkA { from { transform: translateX(-50%) scale(.26); } to { transform: translateX(-50%) scale(1.05); filter: brightness(.6) drop-shadow(0 0 30px rgba(255,220,140,.6)); } }
      /* Auftritt B: Spotlights, Figur steigt aus dem Nebel */
      .ds-walk .in-spot { background: linear-gradient(180deg, #05070d, #10162a); }
      .ds-walk .in-spot .beam { position: absolute; top: -10%; width: 34%; height: 130%; background: linear-gradient(180deg, rgba(255,240,200,.55), transparent 80%); clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%); transform-origin: 50% 0; mix-blend-mode: screen; }
      .ds-walk .in-spot .beam.l { left: 4%; animation: dsBeamL 2.2s ease-in-out infinite alternate; }
      .ds-walk .in-spot .beam.r { right: 4%; animation: dsBeamR 2.2s ease-in-out infinite alternate; }
      @keyframes dsBeamL { from { transform: rotate(-24deg); } to { transform: rotate(14deg); } }
      @keyframes dsBeamR { from { transform: rotate(24deg); } to { transform: rotate(-14deg); } }
      .ds-walk .in-spot.on .fig { animation: dsRise var(--t1) cubic-bezier(.2,.7,.3,1) forwards; }
      @keyframes dsRise { from { transform: translate(-50%, 70%); } 70% { filter: brightness(0) drop-shadow(0 0 30px rgba(255,220,140,.85)); } to { transform: translate(-50%, 0); filter: brightness(.75) drop-shadow(0 0 20px rgba(255,220,140,.5)); } }
      /* Auftritt C: Tor öffnet sich */
      .ds-walk .in-gate { background: radial-gradient(ellipse at 50% 50%, #ffd23f 0, #d50a0a 30%, #2a0606 70%); }
      .ds-walk .in-gate .door { position: absolute; top: 0; bottom: 0; width: 51%; z-index: 3; background: repeating-linear-gradient(0deg, #1a2233 0 38px, #121926 38px 42px); border: 4px solid #c99700; box-sizing: border-box; }
      .ds-walk .in-gate .door.l { left: 0; } .ds-walk .in-gate .door.r { right: 0; }
      .ds-walk .in-gate.on .door.l { animation: dsDoorL calc(var(--t1) * .45) ease-in forwards; }
      .ds-walk .in-gate.on .door.r { animation: dsDoorR calc(var(--t1) * .45) ease-in forwards; }
      @keyframes dsDoorL { to { transform: translateX(-102%); } } @keyframes dsDoorR { to { transform: translateX(102%); } }
      .ds-walk .in-gate.on .fig { animation: dsWalkC var(--t1) ease-out forwards; }
      @keyframes dsWalkC { from { transform: translateX(-50%) scale(.6); } 40% { transform: translateX(-50%) scale(.62); } to { transform: translateX(-50%) scale(1); filter: brightness(.7); } }

      /* Nahaufnahme */
      .ds-walk .close { background: radial-gradient(circle at 50% 30%, #2b3c66 0, #0b1328 62%); }
      .ds-walk .close .fig { width: 96%; bottom: -14%; }
      .ds-walk .cl-push.on .fig { animation: dsPushIn var(--t2) linear forwards; }
      @keyframes dsPushIn { from { transform: translateX(-50%) scale(.94); } to { transform: translateX(-50%) scale(1.06); } }
      .ds-walk .cl-pan.on .fig { animation: dsPan var(--t2) ease-out forwards; }
      @keyframes dsPan { from { transform: translateX(-80%) rotate(-3deg); } to { transform: translateX(-50%) rotate(0); } }
      .ds-walk .cl-flash .flashes i { position: absolute; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, #fff 0, rgba(255,255,255,.6) 25%, transparent 65%); opacity: 0; animation: dsFlashDot 1.3s ease-out infinite; }
      @keyframes dsFlashDot { 0%,70%,100% { opacity: 0; } 75% { opacity: 1; } }
      .ds-walk .fist { position: absolute; top: 36%; width: 40%; z-index: 4; opacity: 0; }
      .ds-walk .fist svg { width: 100%; height: auto; display: block; overflow: visible; }
      .ds-walk .fist.r { right: -3%; } .ds-walk .fist.l { left: -3%; }
      .ds-walk .close.on .fist { animation: dsFistUp .55s cubic-bezier(.2,1.4,.4,1) .25s forwards, dsFistPump .9s ease-in-out 1.1s infinite; }
      .ds-walk .close.on .fist.l { animation-delay: .4s, 1.25s; }
      @keyframes dsFistUp { from { opacity: 0; transform: translateY(120%) rotate(var(--rot, 0deg)); } to { opacity: 1; transform: translateY(0) rotate(var(--rot, 0deg)); } }
      @keyframes dsFistPump { 0%,100% { opacity: 1; transform: translateY(0) rotate(var(--rot, 0deg)); } 50% { opacity: 1; transform: translateY(-5%) rotate(var(--rot, 0deg)); } }
      .ds-walk .fist.r { --rot: 8deg; } .ds-walk .fist.l { --rot: -8deg; }
      .ds-walk .bling { transform-box: fill-box; transform-origin: 50% 50%; }
      .ds-walk .close.on .bling { animation: dsBling .5s ease-out both; }
      @keyframes dsBling { 0% { filter: brightness(1); } 40% { filter: brightness(1.9) drop-shadow(0 0 8px #fff3b0); } 100% { filter: brightness(1.1) drop-shadow(0 0 4px rgba(255,210,63,.8)); } }
      .ds-walk .spark { transform-box: fill-box; transform-origin: 50% 50%; opacity: 0; }
      .ds-walk .close.on .spark { animation: dsSpark 1.6s ease-in-out infinite; }
      @keyframes dsSpark { 0%,100% { opacity: 0; transform: scale(.2) rotate(0); } 15% { opacity: 1; transform: scale(1.3) rotate(45deg); } 35% { opacity: 0; transform: scale(.4) rotate(90deg); } }
      .ds-walk .stamp { position: absolute; left: 50%; top: 58%; z-index: 4; transform: translateX(-50%) rotate(-12deg) scale(3); opacity: 0; font: 900 76px/1 Impact, sans-serif; color: #d50a0a; border: 8px solid #d50a0a; padding: 6px 20px; letter-spacing: 6px; background: rgba(255,255,255,.08); }
      .ds-walk .close.on .stamp { animation: dsStamp .5s cubic-bezier(.3,1.6,.5,1) .5s forwards; }
      @keyframes dsStamp { to { opacity: .95; transform: translateX(-50%) rotate(-12deg) scale(1); } }
      .ds-walk .throne { position: absolute; right: 4%; bottom: 4%; width: 40%; z-index: 4; opacity: 0; }
      .ds-walk .close.on .throne { animation: dsThrone .7s cubic-bezier(.3,1.5,.5,1) .4s forwards; }
      @keyframes dsThrone { from { opacity: 0; transform: translateY(80px) rotate(14deg); } to { opacity: 1; transform: none; } }
      .ds-walk .facts { position: absolute; left: 0; right: 0; top: 64px; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0 20px; }
      .ds-walk .facts span { opacity: 0; transform: translateX(-30px); font-size: 22px; }
      .ds-walk .close.on .facts span { animation: dsFact .45s ease-out forwards; }
      @keyframes dsFact { to { opacity: 1; transform: none; } }

      /* Draftboard */
      .ds-walk .board { background: linear-gradient(180deg, #0d1a33, #060c1a); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 14px; }
      .ds-walk .board .grid { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(201,151,0,.08) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(201,151,0,.08) 0 2px, transparent 2px 120px); }
      .ds-walk .board .who { position: relative; font-family: Impact, 'Arial Black', sans-serif; color: #c99700; text-transform: uppercase; letter-spacing: 3px; text-shadow: 5px 5px 0 #d50a0a; line-height: 1; white-space: nowrap; }
      .ds-walk .board .who b { display: inline-block; font-weight: inherit; opacity: 0; }
      .ds-walk .bd-slam .who { opacity: 0; transform: scale(2.4); }
      .ds-walk .bd-slam.reveal .who { animation: dsReveal .55s cubic-bezier(.2,1.5,.4,1) forwards; }
      .ds-walk .bd-slam .who b, .ds-walk .bd-wipe .who b { opacity: 1; }
      @keyframes dsReveal { to { opacity: 1; transform: scale(1); } }
      .ds-walk .bd-drop.reveal .who b { animation: dsDrop .4s cubic-bezier(.3,1.6,.5,1) forwards; }
      @keyframes dsDrop { from { opacity: 0; transform: translateY(-160px); } to { opacity: 1; transform: none; } }
      .ds-walk .bd-wipe .who { clip-path: inset(0 100% 0 0); }
      .ds-walk .bd-wipe.reveal .who { animation: dsWipe .7s cubic-bezier(.6,0,.2,1) forwards; }
      @keyframes dsWipe { to { clip-path: inset(0 0 0 0); } }
      .ds-walk .bd-wipe .bar { position: relative; align-self: stretch; height: 12px; margin-top: 14px; background: #d50a0a; transform: scaleX(0); transform-origin: 0 50%; }
      .ds-walk .bd-wipe.reveal .bar { animation: dsBar .7s ease-out forwards; }
      @keyframes dsBar { to { transform: scaleX(1); } }
      .ds-walk .board .nick { position: relative; font: 900 40px/1.1 Impact, sans-serif; color: #fff; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 10px; opacity: 0; }
      .ds-walk .board.on .nick { animation: dsFact .5s ease-out .3s forwards; }
      .ds-walk .board .lbl { position: relative; font: 800 22px/1 'Segoe UI'; letter-spacing: 7px; color: #9fb0c8; text-transform: uppercase; margin-bottom: 18px; }
      .ds-walk .pyro { position: absolute; bottom: 0; width: 18%; height: 70%; background: linear-gradient(0deg, rgba(255,140,0,.9), rgba(255,210,63,.5) 40%, transparent); filter: blur(6px); transform-origin: 50% 100%; opacity: 0; }
      .ds-walk .board.reveal .pyro { animation: dsPyro 1.1s ease-out forwards; }
      @keyframes dsPyro { 0% { opacity: 0; transform: scaleY(.1); } 25% { opacity: 1; transform: scaleY(1); } 100% { opacity: 0; transform: scaleY(.6); } }
      @media (prefers-reduced-motion: reduce) { .ds-walk * { animation-duration: .01s !important; } }`;
    document.head.appendChild(st);
  }
  const RING_SVG_UNUSED = `<svg viewBox="0 0 100 100"><circle cx="50" cy="56" r="30" fill="none" stroke="#ffd23f" stroke-width="11"/><circle cx="50" cy="56" r="30" fill="none" stroke="#fff6c8" stroke-width="2"/><path d="M34 26 L50 6 L66 26 L58 32 L42 32Z" fill="#9fe8ff" stroke="#ffd23f" stroke-width="4"/></svg>`;
  const THRONE_SVG = `<svg viewBox="0 0 120 160"><rect x="20" y="10" width="80" height="50" rx="10" fill="#f4f4f4" stroke="#b8c0c8" stroke-width="4"/><ellipse cx="60" cy="86" rx="52" ry="22" fill="#f4f4f4" stroke="#b8c0c8" stroke-width="4"/><ellipse cx="60" cy="84" rx="34" ry="12" fill="#cfe9f5"/><path d="M28 100 Q36 150 60 152 Q84 150 92 100Z" fill="#f4f4f4" stroke="#b8c0c8" stroke-width="4"/><rect x="34" y="150" width="52" height="8" rx="3" fill="#c99700"/></svg>`;

  let walkResolve = null, walkTimers = [], lastWalkCombo = "";
  function endWalk() {
    walkTimers.forEach(clearTimeout); walkTimers = [];
    const w = el.center && el.center.querySelector(".ds-walk"); if (w) w.remove();
    if (walkResolve) { const r = walkResolve; walkResolve = null; r(); }
  }
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // o: { name, nickname, facts[], titles, toilet, rookie, pickIndex, total, duration (s) }
  function walkIn(o) {
    if (!built) return Promise.resolve();
    endWalk(); walkCss();
    phaseName = "walkin"; selectedTeam = null;
    setCam("ring"); setHype("announcer", true); // Enzo groß links, Einlauf in der Mitte
    const D = Math.max(3.2, Number(o.duration) || 0) * 1000;
    const t1 = D * 0.38, t2 = D * 0.34; // Auftritt / Nahaufnahme, Rest = Draftboard
    const triumph = o.total > 1 ? (o.pickIndex || 0) / (o.total - 1) : 1; // 0..1, später = triumphaler
    const titles = Math.min(6, Number(o.titles) || 0);
    // Varianz: Auftritt x Nahaufnahme x Name-Reveal zufällig, nie zweimal dieselbe Kombination hintereinander
    let combo, tries = 0;
    do { combo = [rnd(["in-tunnel", "in-spot", "in-gate"]), rnd(["cl-push", "cl-pan", "cl-flash"]), rnd(["bd-slam", "bd-drop", "bd-wipe"])]; }
    while (combo.join() === lastWalkCombo && ++tries < 10);
    lastWalkCombo = combo.join();
    const [inV, clV, bdV] = combo;
    // Ringe sitzen an den Fingern: rechte Faust zuerst (Ringfinger, Mittelfinger, Zeigefinger, kleiner Finger), dann links
    const order = [2, 1, 0, 3];
    const nR = Math.ceil(titles / 2), nL = titles - nR;
    const skinC = global.MB.Avatar ? global.MB.Avatar.get(o.name).skin : null;
    const rings = titles ? `<div class="fist l">${fistSVG(order.slice(0, Math.max(nL, 0)), true, 0.95, skinC)}</div><div class="fist r">${fistSVG(order.slice(0, nR), false, 0.75, skinC)}</div>` : "";
    const facts = (o.facts || []).slice(0, 3).map((f, i) => `<span class="ds-tag-chip ${i % 2 ? "gold" : ""}" style="animation-delay:${.6 + i * .35}s">${esc(f)}</span>`).join("");
    const nm = String(o.name || "");
    const sz = Math.round(Math.min(130, 400 / Math.max(3, nm.length * 0.62)));
    const letters = [...nm].map((ch, i) => `<b style="animation-delay:${i * 0.07}s">${ch === " " ? "&nbsp;" : esc(ch)}</b>`).join("");
    const pyros = triumph >= .45 ? [2, 80].map((l) => `<div class="pyro" style="left:${l}%"></div>`).join("") + (triumph >= .85 ? `<div class="pyro" style="left:41%"></div>` : "") : "";
    const flashes = clV === "cl-flash" ? `<div class="flashes">${Array.from({ length: 7 }, () => `<i style="left:${Math.random() * 90}%;top:${Math.random() * 60}%;animation-delay:${(Math.random() * 1.3).toFixed(2)}s"></i>`).join("")}</div>` : "";
    const entrance = inV === "in-spot" ? `<div class="beam l"></div><div class="beam r"></div>` : inV === "in-gate" ? `<div class="door l"></div><div class="door r"></div>` : "";
    put(`<div class="ds-walk" style="--t1:${t1}ms;--t2:${t2}ms">
      <div class="pickno">PICK ${(o.pickIndex || 0) + 1}${o.total ? " / " + o.total : ""}</div>
      <button type="button" class="skip" id="dsWalkSkip">Überspringen ⏭</button>
      <div class="cut sil ${inV} on">${entrance}<div class="fig">${coachSVG(o)}</div><div class="fog"></div>${triumph > .3 ? `<div class="strobe"></div>` : ""}</div>
      <div class="cut close ${clV}">${flashes}<div class="fig">${coachSVG(o)}</div><div class="facts">${facts}</div>${o.toilet ? `<div class="throne">${THRONE_SVG}</div>` : rings}${o.rookie && !titles && !o.toilet ? `<div class="stamp">ROOKIE</div>` : ""}</div>
      <div class="cut board ${bdV}"><div class="grid"></div>${pyros}${o.nickname ? `<div class="nick">„${esc(o.nickname)}“</div>` : ""}<div class="lbl">${o.toilet ? "Toilet-Bowl-Champion" : titles ? `${titles}× Champion` : o.rookie ? "Rookie" : "Head Coach"}</div><div class="who" style="font-size:${sz}px">${letters}</div>${bdV === "bd-wipe" ? `<div class="bar"></div>` : ""}</div>
    </div>`);
    const w = el.center.querySelector(".ds-walk");
    w.parentElement.classList.add("walkwrap");
    // Namen auf die verfügbare Breite einpassen
    const whoEl = w.querySelector(".board .who"), boardEl = w.querySelector(".board");
    requestAnimationFrame(() => {
      const avail = boardEl.clientWidth - 40, need = whoEl.scrollWidth;
      if (need > avail && need > 0) whoEl.style.fontSize = Math.floor(sz * avail / need) + "px";
    });
    const cut = (cls) => { w.querySelectorAll(".cut").forEach((c) => c.classList.toggle("on", c.classList.contains(cls))); el.flash.classList.remove("go"); void el.flash.offsetWidth; el.flash.classList.add("go"); };
    return new Promise((resolve) => {
      walkResolve = resolve;
      w.querySelector("#dsWalkSkip").onclick = endWalk;
      walkTimers.push(setTimeout(() => cut("close"), t1));
      walkTimers.push(setTimeout(() => cut("board"), t1 + t2));
      // Name-Reveal, wenn der Ansager den Namen ruft (letzter Teil der Ansage)
      walkTimers.push(setTimeout(() => { w.querySelector(".board").classList.add("reveal"); if (triumph >= .3) confetti(Math.round(40 + triumph * 90)); }, Math.max(t1 + t2 + 300, D - 1400)));
      walkTimers.push(setTimeout(() => { walkTimers = []; walkResolve = null; resolve(); }, D + 900));
    });
  }

  // ---------------------------------------------------------------- Öffentlich
  function init(o) { opts = Object.assign(opts, o || {}); }
  function goFullscreen() {
    if (document.fullscreenElement || !root || !root.requestFullscreen) return Promise.resolve();
    return root.requestFullscreen().catch(() => {});
  }
  function open(o) {
    if (!built) build();
    root.classList.remove("ds-hidden");
    if (o && o.fullscreen) {
      goFullscreen();
      // Falls der Browser den Start nicht als Nutzer-Geste wertet: beim ersten Klick/Tastendruck nachholen
      const retry = () => { goFullscreen(); document.removeEventListener("pointerdown", retry, true); document.removeEventListener("keydown", retry, true); };
      setTimeout(() => { if (!document.fullscreenElement) { document.addEventListener("pointerdown", retry, true); document.addEventListener("keydown", retry, true); } }, 400);
    }
    fit();
    curCam = ""; setCam("booth", { flash: false });
    if (speakUnsub) speakUnsub();
    try { speakUnsub = global.MB.Announcer.onSpeak(onSpeak); } catch (e) { speakUnsub = null; }
    refreshSide();
  }
  function close() {
    if (!root) return;
    bootCleanup();
    root.classList.add("ds-hidden");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.dispatchEvent(new CustomEvent("ds-closed"));
  }
  function isOpen() { return !!root && !root.classList.contains("ds-hidden"); }

  global.MB.DraftStage = { init, open, close, isOpen, phase, walkIn, endWalk, setStrip, refreshSide, boot, charSVG, sceneHTML, speakerNames };
})(window);
