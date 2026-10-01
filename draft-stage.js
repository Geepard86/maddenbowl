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
     init({ getData, onSelect, onConfirm, onFinish })
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

  let opts = { getData: () => ({}), onSelect() {}, onConfirm() {}, onFinish() {} };
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
    if (type === "booth") {
      return `<div class="ds-scene ds-scene-booth" data-scene="booth"><div class="ds-zoom"><div class="ds-bg-booth" style="position:absolute;inset:0"></div>${charHTML("commentator", names)}${charHTML("moderator", names)}<div class="ds-desk"></div></div>${tag("Kommentatoren-Booth", "Totale")}<div class="ds-rec">REC</div></div>`;
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
          <div class="ds-brand"><span class="ds-live">LIVE</span><div class="ds-logo">Madden Bowl<small>DRAFT NIGHT</small></div></div>
          <div class="ds-strip" id="dsStrip"></div>
          <div class="ds-tools"><button id="dsFs" title="Vollbild">⛶</button><button id="dsClose" title="Bühne ausblenden (Steuerung unten bleibt)">✕</button></div>
        </div>
        <div class="ds-main cam-close" id="dsMain">
          <div class="ds-left">
            <div class="ds-cam" id="dsCam">
              ${sceneHTML("booth", names)}${sceneHTML("close-commentator", names)}${sceneHTML("close-moderator", names)}${sceneHTML("ring", names)}
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
      if (phaseName !== "picking" && phaseName !== "done") setCam(camForRole(role));
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
      return `<button type="button" class="ds-tile ${cls}${selectedTeam === t.id ? " sel" : ""}" data-team="${t.id}" ${dis}><img src="${LOGO(t.id)}" alt=""><span class="tn">${esc(t.n)}</span>${badge}</button>`;
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
    el.center.querySelector("#dsConfirm").onclick = () => { if (selectedTeam) opts.onConfirm(); };
  }

  function phase(mode) {
    if (!built) return;
    const d = opts.getData() || {};
    refreshSide();
    const names = speakerNames();
    setHype("announcer", false); setHype("commentator", false);
    if (mode.intro) {
      phaseName = "intro"; selectedTeam = null;
      setCam("booth");
      put(`<div class="ds-kicker">Live aus dem Stadion</div><div class="ds-big-title">Madden Bowl<br>Draft Night</div><div class="ds-sub">Heute Abend werden die Slots gezogen und die Teams vergeben.</div>`);
      setHype("commentator", true); setHype("moderator", true);
    } else if (mode.callingLabelOnly || mode.calling) {
      phaseName = "calling";
      setCam("ring");
      const nm = mode.calling;
      put(`<div class="ds-kicker">Jetzt auf der Bühne</div>${nm ? `<div class="ds-name" style="font-size:${nameSize(nm)}px">${esc(nm)}</div>` : `<div style="height:140px"></div>`}${nm && d.badges && d.badges.length ? `<div class="ds-tags">${d.badges.map((b, i) => `<span class="ds-tag-chip ${i % 2 ? "gold" : ""}">${esc(b)}</span>`).join("")}</div>` : ""}`);
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
      setCam("close-moderator");
      put(`<div class="ds-kicker">Du bist dran</div><div class="ds-name" style="font-size:${nameSize(mode.prompt)}px">${esc(mode.prompt)}</div><div class="ds-big-title" style="font-size:64px;margin-top:10px">Wähle dein Team!</div>`);
    } else if (mode.picking) {
      phaseName = "picking"; selectedTeam = null;
      setCam("booth");
      renderPicker(d);
    } else if (mode.commentating) {
      phaseName = "commentating";
      setCam(camForRole(lastRole === "commentator" ? "moderator" : "commentator"));
      const lp = d.lastPick || {};
      put(`<div class="ds-teamcard">${lp.teamId ? `<img src="${LOGO(lp.teamId)}" alt="">` : ""}<div class="tname">${esc(lp.teamName || "")}</div><div class="pline"><b>${esc(mode.commentating)}</b> übernimmt · Slot P${(lp.slot ?? 0) + 1}${lp.rating ? ` · OVR ${lp.rating}` : ""}</div></div>`);
      setHype("commentator", true);
    } else if (mode.done) {
      phaseName = "done";
      setCam("booth");
      put(`<div class="ds-kicker">Alle Plätze vergeben</div><div class="ds-big-title">Draft komplett!</div><div class="ds-sub">Bereit für den Anpfiff?</div><button type="button" class="ds-big-btn" id="dsFinish">🏈 Madden Bowl starten</button>`);
      el.center.querySelector("#dsFinish").onclick = () => opts.onFinish();
      setHype("commentator", true); setHype("moderator", true);
      confetti(120);
    } else if (mode.kickoff) {
      phaseName = "kickoff";
      setCam("booth");
      put(`<div class="ds-kick"><div class="ds-kicker">Anpfiff</div><div class="ds-big-title">Madden Bowl</div><div class="ds-sub">Viel Erfolg am Controller!</div></div>`);
      setHype("commentator", true); setHype("moderator", true);
      confetti(160);
    }
  }

  // ---------------------------------------------------------------- Öffentlich
  function init(o) { opts = Object.assign(opts, o || {}); }
  function open() {
    if (!built) build();
    root.classList.remove("ds-hidden");
    fit();
    curCam = ""; setCam("booth", { flash: false });
    if (speakUnsub) speakUnsub();
    try { speakUnsub = global.MB.Announcer.onSpeak(onSpeak); } catch (e) { speakUnsub = null; }
    refreshSide();
  }
  function close() {
    if (!root) return;
    root.classList.add("ds-hidden");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.dispatchEvent(new CustomEvent("ds-closed"));
  }
  function isOpen() { return !!root && !root.classList.contains("ds-hidden"); }

  global.MB.DraftStage = { init, open, close, isOpen, phase, setStrip, refreshSide };
})(window);
