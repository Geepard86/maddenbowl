/* =========================================================================
   MADDEN BOWL — UI-KERN (ui.js)
   -------------------------------------------------------------------------
   Gemeinsamer Header (Logo, Anmelden-Button, Burger-Menü) + Login-Modal für
   die neuen v2-Seiten (dashboard.html, blog.html, spielplan.html,
   wettbuero.html). Nutzt denselben PIN-Login-Mechanismus wie bisher
   (state.wettbuero.accounts, sessionStorage-Key "mb_tipp_player") — nur
   jetzt an einer Stelle statt vier Mal, damit "Anmelden" im Header überall
   funktioniert, auch auf Seiten ohne eigenes Tippspiel-Formular.

   Einbindung: <script src="shared.js"></script> VOR <script src="ui.js"></script>,
   dann pro Seite: MB.UI.mountHeader({ active: 'dashboard' }) beim Booten,
   und nach dem Laden von `state`: MB.UI.setState(state) aufrufen, damit der
   Login-Button weiß, ob/wer angemeldet ist.
   ========================================================================= */
(function (global) {
  "use strict";

  const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "assets/icons/home.svg" },
    { key: "spielplan", label: "Spielplan", href: "spielplan.html", icon: "assets/icons/calendar.svg" },
    { key: "tippspiel", label: "Tippspiel", href: "wettbuero.html", icon: "assets/icons/trophy.svg" },
    { key: "blog", label: "Blog", href: "blog.html", icon: "assets/icons/blog.svg" },
    { key: "hallOfFame", label: "Hall of Fame", href: "hall_of_fame.html", icon: "assets/icons/crown.svg" },
    { key: "shop", label: "Shop", href: "shop.html", icon: "assets/icons/cart.svg" },
  ];

  // Admin-Navigation: ersetzt im Admin-Modus die Spieler-Links im Burger-Menü.
  // Nur Bereiche, die sich bearbeiten lassen. "index" ist die Admin-Startseite
  // (index.html), die Abschnitte dort werden über den URL-Hash umgeschaltet.
  const ADMIN_NAV_ITEMS = [
    { key: "setup", label: "Turnier-Setup", href: "index.html#setup", emoji: "🏈" },
    { key: "schedule", label: "Spielplan & Ergebnisse", href: "index.html#schedule", emoji: "📅" },
    { key: "settings", label: "Einstellungen", href: "index.html#settings", emoji: "⚙️" },
    { key: "access", label: "Zugänge & Kennwörter", href: "index.html#access", emoji: "🔑" },
    { key: "seasons", label: "Saison verwalten", href: "seasons.html", emoji: "🗂️" },
    { key: "blog", label: "Blog", href: "blog.html", emoji: "📰" },
  ];

  // Einweisung beim ersten Öffnen des Dashboards (nur Spieler/Gäste).
  // Jeder Schritt markiert den passenden Punkt auf der Seite (Spotlight) und
  // zeigt die Erklärung direkt daneben. Fehlt der Punkt (z.B. kein laufendes
  // Turnier, deshalb keine Tippspiel-Karte), erscheint nur die Erklärung.
  const TOUR_KEY = "mb_tour_dashboard_v1";
  function tourCard(href) {
    const a = document.querySelector(`#app a[href="${href}"]`);
    return a ? (a.closest(".v2-card") || a) : null;
  }
  const TOUR_STEPS = [
    { icon: "🏈", title: "Willkommen beim Madden Bowl",
      text: "Hier siehst du auf einen Blick, was gerade läuft: den Spielplan mit Live-Spielen, das Tippspiel und die neuesten Blog-Beiträge. Alles Weitere erreichst du über das Menü – dieses Symbol hier.",
      target: () => document.querySelector(".v2-burger") },
    { icon: "👤", title: "Anmelden",
      text: "Hier meldest du dich an: Du wählst deinen Namen und gibst eine PIN mit 4–6 Ziffern ein. Beim allerersten Mal legst du damit deine eigene PIN fest – merk sie dir gut, bei Verlust setzt der Admin sie zurück. Wichtig: Anmelden und das Tippspiel sind nur für Teilnehmer des laufenden Turniers möglich. Gäste können alles lesen, aber nicht mittippen.",
      target: () => document.getElementById("mbAuthArea") },
    { icon: "🎯", title: "Tippspiel",
      text: "Nur für Turnier-Teilnehmer: Tippe vor jedem Spieltag auf die Sieger der Spiele und auf Over/Under der Gesamtpunkte. Dazu kommen Tipps auf Champion, Zweiten und Toilet-Bowl-Sieger. Ein Sieger-Tipp bringt 1 Punkt, Over/Under 2, der Champion 5. Tipps sind nur bis zum Kickoff möglich – du darfst auch auf deine eigenen Spiele tippen. Hier siehst du den aktuellen Tippstand.",
      target: () => tourCard("wettbuero.html") },
    { icon: "📰", title: "Blog",
      text: "Hier stehen die neuesten Beiträge: Power Rankings, Spielerporträts, Rekorde, Memes und Songs rund um das Turnier. Ein Tipp auf die Karte öffnet den Blog, dort kannst du jeden Beitrag aufklappen und mit der Teilen-Funktion direkt in die Gruppe schicken.",
      target: () => tourCard("blog.html") },
    { icon: "👑", title: "Hall of Fame",
      text: "Die Hall of Fame sammelt alle bisherigen Saisons: Champions, die ewige Tabelle und alle gespielten Partien. Hier siehst du, wer die Geschichte des Madden Bowl geschrieben hat.",
      target: () => tourCard("hall_of_fame.html") },
  ];
  let _tourIndex = 0;
  let _tourOpen = false;
  let _tourTimer = null;

  function tourSeen() { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch (e) { return true; } }
  function markTourSeen() { try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) { /* egal */ } }

  function tourHeaderHeight() {
    const h = document.querySelector(".v2-header");
    return h ? h.offsetHeight : 0;
  }

  // Zielelement ermitteln. Ist die Karte höher als der freie Platz neben der
  // Erklärung, wird nur ihre Überschrift markiert.
  function resolveTourTarget(step, tipH) {
    let el = step.target ? step.target() : null;
    if (!el) return null;
    if (!el.closest(".v2-header")) {
      const avail = window.innerHeight - tourHeaderHeight() - tipH - 48;
      if (el.offsetHeight > avail) el = el.querySelector(".v2-card-title") || el;
    }
    return el;
  }

  // Spotlight + Erklärung positionieren. scroll=true nur beim Schrittwechsel.
  function layoutTour(scroll) {
    if (!_tourOpen) return;
    const tip = document.getElementById("mbTourTip");
    const spot = document.getElementById("mbTourSpot");
    const blocker = document.getElementById("mbTourBlocker");
    if (!tip || !spot) return;
    const step = TOUR_STEPS[_tourIndex];
    const vw = window.innerWidth, vh = window.innerHeight;
    const headerH = tourHeaderHeight();
    const tipH = tip.offsetHeight;
    const el = resolveTourTarget(step, tipH);

    if (!el) {
      spot.style.display = "none";
      blocker.style.background = "rgba(8,12,20,0.78)";
      tip.style.top = Math.max(headerH + 8, Math.round((vh - tipH) / 2)) + "px";
      return;
    }
    blocker.style.background = "transparent";

    const inHeader = !!el.closest(".v2-header");
    if (scroll && !inHeader) {
      const r0 = el.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r0.top - headerH - 12, behavior: "auto" });
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    spot.style.display = "block";
    spot.style.left = (r.left - pad) + "px";
    spot.style.top = (r.top - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px";
    spot.style.height = (r.height + pad * 2) + "px";

    // Erklärung unter dem Ziel, sonst darüber, sonst am unteren Rand
    const gap = 14;
    const spaceBelow = vh - r.bottom - pad;
    const spaceAbove = r.top - pad - headerH;
    let top;
    if (spaceBelow >= tipH + gap + 8) top = r.bottom + pad + gap;
    else if (spaceAbove >= tipH + gap + 8) top = r.top - pad - gap - tipH;
    else top = vh - tipH - 12;
    tip.style.top = Math.min(Math.max(top, headerH + 8), vh - tipH - 8) + "px";
  }

  function renderTourStep(scroll) {
    const step = TOUR_STEPS[_tourIndex];
    const last = _tourIndex === TOUR_STEPS.length - 1;
    const first = _tourIndex === 0;
    const dots = TOUR_STEPS.map((_, i) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 3px;background:${i === _tourIndex ? "var(--v2-gold)" : "rgba(255,255,255,0.25)"};"></span>`).join("");
    document.getElementById("mbTourTip").innerHTML = `
      <button class="v2-modal-close" style="position:absolute; top:8px; right:10px; background:none; border:none; color:inherit; font-size:1.1em; cursor:pointer; opacity:0.6;" onclick="MB.UI.closeTour()" aria-label="Einweisung schließen">✕</button>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding-right:22px;">
        <span style="font-size:1.6em;">${step.icon}</span>
        <h3 style="margin:0;">${escHtml(step.title)}</h3>
      </div>
      <div class="v2-info-content" style="font-size:0.88em; line-height:1.5; margin-bottom:12px;">${escHtml(step.text)}</div>
      <div style="text-align:center; margin-bottom:12px;">${dots}</div>
      <div class="v2-modal-actions">
        <button class="v2-btn-ghost" onclick="MB.UI.${first ? "closeTour" : "prevTourStep"}()">${first ? "Überspringen" : "Zurück"}</button>
        <button class="v2-btn-primary" onclick="MB.UI.${last ? "closeTour" : "nextTourStep"}()">${last ? "Los geht's" : "Weiter"}</button>
      </div>`;
    layoutTour(scroll);
  }

  function openTour() {
    closeNav();
    if (_tourOpen) return;
    _tourOpen = true;
    _tourIndex = 0;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="mbTourBlocker" style="position:fixed; inset:0; z-index:9990; touch-action:none; background:transparent;"></div>
      <div id="mbTourSpot" style="position:fixed; z-index:9991; display:none; pointer-events:none; border-radius:12px; border:2px solid var(--v2-gold); box-shadow:0 0 0 9999px rgba(8,12,20,0.78); transition:left .2s, top .2s, width .2s, height .2s;"></div>
      <div id="mbTourTip" class="v2-modal-box" style="position:fixed; z-index:9992; left:50%; transform:translateX(-50%); width:min(400px, calc(100vw - 24px)); max-width:none; box-sizing:border-box; box-shadow:0 8px 30px rgba(0,0,0,0.5);"></div>`);
    const blocker = document.getElementById("mbTourBlocker");
    blocker.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
    window.addEventListener("resize", onTourResize);
    document.addEventListener("keydown", onTourKey);
    // Seite kann sich während der Tour neu aufbauen (Auto-Refresh): Position nachziehen
    _tourTimer = setInterval(() => layoutTour(false), 500);
    renderTourStep(true);
  }
  function onTourResize() { layoutTour(false); }
  function onTourKey(e) { if (e.key === "Escape") closeTour(); }

  function nextTourStep() {
    if (_tourIndex < TOUR_STEPS.length - 1) { _tourIndex++; renderTourStep(true); }
  }
  function prevTourStep() {
    if (_tourIndex > 0) { _tourIndex--; renderTourStep(true); }
  }
  function closeTour() {
    markTourSeen();
    _tourOpen = false;
    clearInterval(_tourTimer);
    window.removeEventListener("resize", onTourResize);
    document.removeEventListener("keydown", onTourKey);
    ["mbTourBlocker", "mbTourSpot", "mbTourTip"].forEach((id) => { const n = document.getElementById(id); if (n) n.remove(); });
  }
  // Wird vom Dashboard nach dem ersten Rendern aufgerufen: zeigt die
  // Einweisung nur beim ersten Besuch (pro Browser) und nie im Admin-Modus.
  function maybeStartTour() {
    if (isAdminUnlocked() || tourSeen()) return;
    setTimeout(openTour, 400);
  }

  // Admin: Abschnitt in der Standort-Zeile + Menü hervorheben (von index.html aufgerufen)
  function setAdminSection(key) {
    const item = ADMIN_NAV_ITEMS.find((i) => i.key === key);
    document.querySelectorAll(".v2-nav-link[data-admin-key]").forEach((a) => a.classList.toggle("active", a.dataset.adminKey === key));
    const titleEl = document.getElementById("mbPageBarTitle");
    const iconEl = document.getElementById("mbPageBarEmoji");
    if (item && titleEl) titleEl.textContent = item.label;
    if (item && iconEl) iconEl.textContent = item.emoji;
  }
  function setAdminNavItemHidden(key, hidden) {
    const a = document.querySelector(`.v2-nav-link[data-admin-key="${key}"]`);
    if (a) a.style.display = hidden ? "none" : "";
  }

  // ---------------------------------------------------------------
  // "ZUM HOME-BILDSCHIRM HINZUFÜGEN" (PWA-Installation)
  // Chrome/Android liefert ein beforeinstallprompt-Event, das wir für den
  // Menüpunkt aufheben. iOS Safari kennt das nicht -> dort Anleitung zeigen.
  // ---------------------------------------------------------------
  let _installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _installPrompt = e;
  });
  window.addEventListener("appinstalled", () => {
    _installPrompt = null;
    const item = document.getElementById("mbInstallItem");
    if (item) item.style.display = "none";
  });

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  }

  // Inhalt von "Regeln & Settings": wird in seasons.html gepflegt und liegt in
  // Supabase (app_config, Schlüssel "rules_content"). Diese Defaults gelten,
  // solange dort noch nichts gespeichert ist. Die Turnier-Defaults (Start,
  // Spieldauer, Stadien) kommen zusätzlich aus "tournament_defaults".
  const RULES_CONTENT_KEY = "rules_content";
  const RULES_CONTENT_DEFAULTS = {
    maddenSettings: [
      "Zeit: 4 Min (Reg.) / 5 Min (Playoffs)",
      "Level: Pro | Style: Simulation",
      "Kicking: Classic | Passing: Classic",
      "Wetter: Random | Broadcast: Random | Accelerated Clock: On",
    ],
    tournamentRules: [
      "Draft: Neueinsteiger > Vorjahresletzte",
      "Team-Limit: OVR ≤ 90",
      "Trade: Freiwilliger Down-Trade nach 2L",
      "Strafen: Abknien = 10P für den Gegner",
    ],
    hubLabel: "Madden 26 Controls Hub (EA)",
    hubUrl: "https://www.ea.com/games/madden-nfl/madden-nfl-26/controls-hub/playstation-controls-hub",
  };

  function rulesListHtml(items) {
    const list = (items || []).filter((x) => String(x).trim());
    return list.length ? `<ul>${list.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>` : `<div class="v2-info-muted">Nichts hinterlegt.</div>`;
  }

  function rulesStaticHtml(c) {
    const safeUrl = /^https?:\/\//i.test(c.hubUrl || "") ? c.hubUrl : "";
    return `
    <div class="v2-info-block"><strong>⚙️ Madden Settings</strong>${rulesListHtml(c.maddenSettings)}</div>
    <div class="v2-info-block"><strong>📜 Turnier-Regeln</strong>${rulesListHtml(c.tournamentRules)}</div>
    ${safeUrl ? `<div class="v2-info-block"><strong>🎮 Controller Hub</strong><br><a href="${escHtml(safeUrl)}" target="_blank" rel="noopener">${escHtml(c.hubLabel || safeUrl)}</a></div>` : ""}`;
  }

  const RULES_DEFAULTS = {
    startTime: "10:00", durGroup: 30, durPlayoff: 45, durBreak: 15,
    stadium1: "Altima Field", stadium2: "KEVAG Stadium", playerCount: 8,
  };

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let _state = null;
  let _onChange = null; // optionaler Callback, den die Seite bei Spieler-Login/Logout ausführen kann
  let _showAdminLogin = false; // nur auf Seiten mit Admin-Bereich (aktuell index.html)
  let _onAdminChange = null; // optionaler Callback bei Admin-Login/Logout

  const ADMIN_SESSION_KEY = "mb_admin_session";
  const ADMIN_PW_HASH_KEY = "mb_admin_pw_hash"; // altes, geräte-lokales Passwort (nur noch für Migration gelesen)
  const ADMIN_PW_CONFIG_KEY = "admin_pw_hash"; // Schlüssel in Supabase app_config — jetzt die Quelle der Wahrheit

  function currentPlayer() {
    const name = sessionStorage.getItem("mb_tipp_player");
    if (!name || !_state || !_state.wettbuero || !_state.wettbuero.accounts[name]) return null;
    return name;
  }

  // Admin-Status ist geräte-/browserunabhängig vom laufenden Turnier: das
  // Passwort liegt gehasht in Supabase (app_config, Schlüssel "admin_pw_hash"),
  // pro Tab per sessionStorage freigeschaltet. Löst das alte "?Altima"-
  // Query-Flag ab (und den ersten, rein lokalen Login-Entwurf).
  function isAdminUnlocked() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  }

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function setState(state, onChange) {
    _state = state;
    if (onChange) _onChange = onChange;
    if (_state) MB.ensureWettbuero(_state);
    renderAuthArea();
  }

  // ---------------------------------------------------------------
  // HEADER + DRAWER + MODAL: einmalig ins Dokument einfügen
  // ---------------------------------------------------------------
  function mountHeader(opts) {
    const active = (opts && opts.active) || "";
    _showAdminLogin = !!(opts && opts.showAdminLogin);
    _onAdminChange = (opts && opts.onAdminChange) || null;
    // Admin-Modus (nur auf Seiten, die adminActive übergeben): eigene Links im
    // Burger-Menü und Standort-Zeile mit Zurück-Pfeil zur Admin-Startseite.
    const adminMode = isAdminUnlocked() && !!(opts && opts.adminActive);
    const adminActive = adminMode ? opts.adminActive : "";
    const navHtml = adminMode
      ? ADMIN_NAV_ITEMS.map(item => `
      <a class="v2-nav-link ${item.key === adminActive ? "active" : ""}" data-admin-key="${item.key}" href="${item.href}" onclick="MB.UI.closeNav()">
        <span style="width:18px; text-align:center;">${item.emoji}</span> ${item.label}
      </a>`).join("")
      : NAV_ITEMS.map(item => `
      <a class="v2-nav-link ${item.key === active ? "active" : ""}" href="${item.href}">
        <img src="${item.icon}" alt=""> ${item.label}
      </a>`).join("");

    // Page-Bar: zeigt Icon + Name der aktuellen Seite und einen Zurück-Pfeil
    // zum Dashboard. Nur auf Unterseiten — auf dem Dashboard selbst (active
    // === "dashboard") weglassen, da man dort schon "zuhause" ist.
    const activeItem = NAV_ITEMS.find(item => item.key === active);
    const adminItem = adminMode ? ADMIN_NAV_ITEMS.find(i => i.key === adminActive) : null;
    const adminBackHref = (opts && opts.adminBack) ? "index.html" : "";
    const pageBarHtml = adminItem ? `
      <div class="v2-page-bar">
        ${adminBackHref ? `<a class="v2-page-back" href="${adminBackHref}" aria-label="Zurück zur Admin-Startseite">←</a>` : ""}
        <span id="mbPageBarEmoji" style="font-size:0.95em;">${adminItem.emoji}</span>
        <span class="v2-page-bar-title" id="mbPageBarTitle">${adminItem.label}</span>
      </div>` : (activeItem && active !== "dashboard") ? `
      <div class="v2-page-bar">
        <a class="v2-page-back" href="dashboard.html" aria-label="Zurück zum Dashboard">←</a>
        <img src="${activeItem.icon}" alt="">
        <span class="v2-page-bar-title">${activeItem.label}</span>
      </div>` : "";

    const headerHtml = `
      <header class="v2-header">
        <a class="v2-logo" href="dashboard.html">
          <img src="assets/icons/crown.svg" alt="">
          <span class="v2-logo-text">Madden Bowl VI</span>
        </a>
        <div class="v2-header-right">
          <div id="mbAuthArea"></div>
          <button class="v2-burger" onclick="MB.UI.toggleNav()" aria-label="Menü">
            <img src="assets/icons/menu.svg" alt="">
          </button>
        </div>
      </header>
      ${pageBarHtml}
      <div class="v2-nav-backdrop" id="mbNavBackdrop" onclick="MB.UI.closeNav()"></div>
      <nav class="v2-nav-drawer" id="mbNavDrawer">
        <button class="v2-nav-drawer-close" onclick="MB.UI.closeNav()">✕</button>
        ${navHtml}
        <div class="v2-nav-divider"></div>
        ${adminMode ? `<a class="v2-nav-secondary" href="dashboard.html" style="text-decoration:none; display:block;">Zum Dashboard (Spieleransicht)</a>` : ""}
        <button class="v2-nav-secondary" onclick="MB.UI.openRules()">Regeln &amp; Settings</button>
        ${(!adminMode && active === "dashboard") ? `<button class="v2-nav-secondary" onclick="MB.UI.openTour()">Einweisung ansehen</button>` : ""}
        <button class="v2-nav-secondary" id="mbInstallItem" onclick="MB.UI.installApp()" style="${isStandalone() ? "display:none;" : ""}">Zum Home-Bildschirm</button>
      </nav>
      <div class="v2-user-pill-menu" id="mbUserMenu"></div>
      <div class="v2-modal-overlay" id="mbLoginModal" onclick="if(event.target===this) MB.UI.closeLogin()">
        <div class="v2-modal-box" id="mbLoginModalContent"></div>
      </div>
      <div class="v2-modal-overlay" id="mbInfoModal" onclick="if(event.target===this) MB.UI.closeInfo()">
        <div class="v2-modal-box v2-info-box" id="mbInfoModalContent"></div>
      </div>`;

    document.body.insertAdjacentHTML("afterbegin", headerHtml);
    renderAuthArea();
  }

  function toggleNav() {
    document.getElementById("mbNavDrawer").classList.toggle("open");
    document.getElementById("mbNavBackdrop").classList.toggle("open");
  }
  function closeNav() {
    document.getElementById("mbNavDrawer").classList.remove("open");
    document.getElementById("mbNavBackdrop").classList.remove("open");
  }

  // ---------------------------------------------------------------
  // REGELN & SETTINGS (Burger-Menü)
  // ---------------------------------------------------------------
  function closeInfo() {
    document.getElementById("mbInfoModal").classList.remove("open");
  }

  function openInfoModal(html) {
    document.getElementById("mbInfoModalContent").innerHTML = html + `
      <div class="v2-modal-actions">
        <button class="v2-btn-primary" onclick="MB.UI.closeInfo()">Schließen</button>
      </div>`;
    document.getElementById("mbInfoModal").classList.add("open");
  }

  async function openRules() {
    closeNav();
    openInfoModal(`
      <h3>📜 Regeln &amp; Settings</h3>
      <div class="v2-info-content">
        <div class="v2-info-block" id="mbRulesDynamic"><strong>⏱ Turnier-Ablauf</strong><br><span class="v2-info-muted">Lade…</span></div>
        <div id="mbRulesContent"></div>
      </div>`);

    let saved = {}, content = {};
    try {
      const raw = await MB.getAppConfig("tournament_defaults");
      if (raw) saved = JSON.parse(raw);
    } catch (e) { console.warn("tournament_defaults laden fehlgeschlagen:", e); }
    try {
      const raw = await MB.getAppConfig(RULES_CONTENT_KEY);
      if (raw) content = JSON.parse(raw);
    } catch (e) { console.warn("rules_content laden fehlgeschlagen:", e); }
    const v = { ...RULES_DEFAULTS, ...saved };
    const contentEl = document.getElementById("mbRulesContent");
    if (contentEl) contentEl.innerHTML = rulesStaticHtml({ ...RULES_CONTENT_DEFAULTS, ...content });
    const el = document.getElementById("mbRulesDynamic");
    if (!el) return;
    el.innerHTML = `
      <strong>⏱ Turnier-Ablauf</strong>
      <ul>
        <li>Start: ${escHtml(v.startTime)} Uhr</li>
        <li>Spieldauer: ${escHtml(v.durGroup)} Min (Gruppe) / ${escHtml(v.durPlayoff)} Min (Playoffs), ${escHtml(v.durBreak)} Min Pause</li>
        <li>Stadien: ${escHtml(v.stadium1)} &amp; ${escHtml(v.stadium2)}</li>
        <li>Spieler: ${escHtml(v.playerCount)}</li>
      </ul>`;
  }

  // ---------------------------------------------------------------
  // HOME-BILDSCHIRM
  // ---------------------------------------------------------------
  async function installApp() {
    closeNav();
    if (_installPrompt) {
      const promptEvent = _installPrompt;
      _installPrompt = null;
      try {
        promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (e) { console.warn("Install-Prompt fehlgeschlagen:", e); }
      return;
    }
    const steps = isIOS()
      ? `<ol>
           <li>Unten (bzw. oben rechts) auf das <b>Teilen-Symbol</b> tippen (Quadrat mit Pfeil nach oben).</li>
           <li><b>„Zum Home-Bildschirm“</b> wählen.</li>
           <li>Oben rechts auf <b>„Hinzufügen“</b> tippen.</li>
         </ol>
         <div class="v2-info-muted">Wichtig: Auf dem iPhone geht das nur in <b>Safari</b> (oder dem Teilen-Menü deines Browsers).</div>`
      : `<ol>
           <li>Browser-Menü öffnen (⋮ bzw. Teilen-Menü).</li>
           <li><b>„App installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> wählen.</li>
         </ol>`;
    openInfoModal(`<h3>📲 Zum Home-Bildschirm</h3><div class="v2-info-content">${steps}</div>`);
  }

  // ---------------------------------------------------------------
  // AUTH-BEREICH IM HEADER (Anmelden-Button <-> Spieler-Pille)
  // ---------------------------------------------------------------
  function renderAuthArea() {
    const el = document.getElementById("mbAuthArea");
    if (!el) return;
    const admin = isAdminUnlocked();
    const player = currentPlayer();
    if (admin) {
      el.innerHTML = `<button class="v2-btn-login is-user" onclick="MB.UI.toggleUserMenu()">
        🛡️ Admin
      </button>`;
    } else if (player) {
      el.innerHTML = `<button class="v2-btn-login is-user" onclick="MB.UI.toggleUserMenu()">
        <img src="assets/icons/user.svg" alt=""> ${player}
      </button>`;
    } else {
      el.innerHTML = `<button class="v2-btn-login" onclick="MB.UI.openLogin()">
        <img src="assets/icons/user.svg" alt=""> Anmelden
      </button>`;
    }
    renderUserMenu();
  }

  function renderUserMenu() {
    const el = document.getElementById("mbUserMenu");
    if (!el) return;
    if (isAdminUnlocked()) {
      el.innerHTML = `<button onclick="MB.UI.doAdminLogout()">Admin abmelden</button>`;
    } else {
      el.innerHTML = `
        <a href="wettbuero.html">🎯 Zum Tippspiel</a>
        <button onclick="MB.UI.doLogout()">Abmelden</button>`;
    }
  }

  function toggleUserMenu() {
    document.getElementById("mbUserMenu").classList.toggle("open");
  }

  // ---------------------------------------------------------------
  // LOGIN-MODAL (Spieler wählen + PIN — legt beim ersten Mal die PIN an)
  // ---------------------------------------------------------------
  function openLogin() {
    const hasPlayers = !!(_state && _state.players && _state.players.length);
    if (!hasPlayers) {
      if (_showAdminLogin) { openAdminLogin(); return; }
      alert("Es läuft aktuell kein Turnier — Anmeldung ist gerade nicht möglich.");
      return;
    }
    const names = _state.players.map(p => p.name);
    document.getElementById("mbLoginModalContent").innerHTML = `
      <h3>Anmelden</h3>
      <div style="font-size:0.78em; opacity:0.7; line-height:1.4;">Anmeldung und Tippspiel sind nur für Teilnehmer des aktuellen Turniers möglich.</div>
      <label for="mbLoginName">Spieler</label>
      <select id="mbLoginName">${names.map(n => `<option value="${n}">${n}</option>`).join("")}</select>
      <label for="mbLoginPin">PIN</label>
      <input type="password" id="mbLoginPin" inputmode="numeric" maxlength="6" placeholder="4-6 stellige PIN">
      <div class="v2-modal-error" id="mbLoginError"></div>
      <div class="v2-modal-actions">
        <button class="v2-btn-ghost" onclick="MB.UI.closeLogin()">Abbrechen</button>
        <button class="v2-btn-primary" onclick="MB.UI.doLogin()">Anmelden</button>
      </div>
      ${_showAdminLogin ? `<div class="v2-modal-altlink"><a href="#" onclick="MB.UI.openAdminLogin();return false;">Als Admin anmelden</a></div>` : ""}`;
    document.getElementById("mbLoginModal").classList.add("open");
  }

  // ---------------------------------------------------------------
  // ADMIN-LOGIN (geräteweites Passwort statt "?Altima"-URL-Flag)
  // ---------------------------------------------------------------
  function openAdminLogin() {
    const hasPlayers = !!(_state && _state.players && _state.players.length);
    document.getElementById("mbLoginModalContent").innerHTML = `
      <h3>Admin-Login</h3>
      <label for="mbAdminPw">Passwort</label>
      <input type="password" id="mbAdminPw" placeholder="Admin-Passwort">
      <div class="v2-modal-error" id="mbAdminError"></div>
      <div class="v2-modal-actions">
        <button class="v2-btn-ghost" onclick="MB.UI.closeLogin()">Abbrechen</button>
        <button class="v2-btn-primary" onclick="MB.UI.doAdminLogin()">Anmelden</button>
      </div>
      ${hasPlayers ? `<div class="v2-modal-altlink"><a href="#" onclick="MB.UI.openLogin();return false;">Zurück zur Spieler-Anmeldung</a></div>` : ""}`;
    document.getElementById("mbLoginModal").classList.add("open");
    setTimeout(() => document.getElementById("mbAdminPw")?.focus(), 0);
  }

  async function doAdminLogin() {
    const pw = document.getElementById("mbAdminPw").value;
    const errEl = document.getElementById("mbAdminError");
    errEl.textContent = "";
    if (!pw) { errEl.textContent = "Bitte Passwort eingeben."; return; }
    const hash = await sha256Hex(pw);

    // Quelle der Wahrheit ist jetzt Supabase (app_config), nicht mehr
    // localStorage — dadurch funktioniert derselbe Admin-Login auf jedem
    // Gerät/Browser. War auf diesem Gerät vorher schon ein Passwort lokal
    // gesetzt, wird das einmalig in die DB gehoben statt einfach ignoriert.
    let stored = null;
    try {
      stored = await MB.getAppConfig(ADMIN_PW_CONFIG_KEY);
    } catch (e) {
      errEl.textContent = "Datenbank gerade nicht erreichbar, bitte später erneut versuchen.";
      return;
    }
    const localLegacy = localStorage.getItem(ADMIN_PW_HASH_KEY);
    if (!stored && localLegacy) stored = localLegacy;

    if (!stored) {
      // Allererstes Admin-Login überhaupt: die aktuelle Eingabe wird DAS Passwort.
      try {
        await MB.setAppConfig(ADMIN_PW_CONFIG_KEY, hash);
      } catch (e) {
        errEl.textContent = "Konnte Passwort nicht in der Datenbank speichern: " + e.message;
        return;
      }
    } else if (stored !== hash) {
      errEl.textContent = "Falsches Passwort.";
      return;
    } else if (localLegacy) {
      // Passwort stimmte über den lokalen Alt-Wert -> in die DB heben.
      try { await MB.setAppConfig(ADMIN_PW_CONFIG_KEY, hash); } catch (e) { /* nicht kritisch */ }
    }

    localStorage.removeItem(ADMIN_PW_HASH_KEY); // geräte-lokales Passwort nicht mehr nötig
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    closeLogin();
    renderAuthArea();
    if (_onAdminChange) _onAdminChange(true);
  }

  function doAdminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    document.getElementById("mbUserMenu").classList.remove("open");
    renderAuthArea();
    if (_onAdminChange) _onAdminChange(false);
  }

  function closeLogin() {
    document.getElementById("mbLoginModal").classList.remove("open");
  }

  async function doLogin() {
    const name = document.getElementById("mbLoginName").value;
    const pin = document.getElementById("mbLoginPin").value.trim();
    const errEl = document.getElementById("mbLoginError");
    errEl.textContent = "";
    if (!/^\d{4,6}$/.test(pin)) { errEl.textContent = "PIN muss 4-6 Ziffern haben."; return; }

    const acc = _state.wettbuero.accounts[name];
    if (!acc.pin) {
      acc.pin = pin;
      try { await MB.pushCloudState(_state); } catch (e) { errEl.textContent = "Konnte PIN nicht speichern: " + e.message; return; }
    } else if (acc.pin !== pin) {
      errEl.textContent = "Falsche PIN.";
      return;
    }
    sessionStorage.setItem("mb_tipp_player", name);
    closeLogin();
    renderAuthArea();
    if (_onChange) _onChange(name);
  }

  function doLogout() {
    sessionStorage.removeItem("mb_tipp_player");
    document.getElementById("mbUserMenu").classList.remove("open");
    renderAuthArea();
    if (_onChange) _onChange(null);
  }

  global.MB = global.MB || {};
  global.MB.UI = {
    NAV_ITEMS, mountHeader, setState, currentPlayer, isAdminUnlocked,
    toggleNav, closeNav, toggleUserMenu,
    openRules, closeInfo, installApp, isStandalone,
    RULES_CONTENT_KEY, RULES_CONTENT_DEFAULTS,
    openLogin, closeLogin, doLogin, doLogout,
    openAdminLogin, doAdminLogin, doAdminLogout,
    openTour, nextTourStep, prevTourStep, closeTour, maybeStartTour,
    setAdminSection, setAdminNavItemHidden, ADMIN_NAV_ITEMS,
  };
})(window);
