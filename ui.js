/* =========================================================================
   ALTIMA BOWL — UI-KERN (ui.js)
   -------------------------------------------------------------------------
   Gemeinsamer Header (Logo, Anmelden-Button, Burger-Menü) + Login-Modal für
   die neuen v2-Seiten (index.html, blog.html, spielplan.html,
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
    { key: "dashboard", label: "Dashboard", href: "index.html", icon: "assets/icons/home.svg" },
    { key: "spielplan", label: "Spielplan", href: "spielplan.html", icon: "assets/icons/calendar.svg" },
    { key: "tippspiel", label: "Tippspiel", href: "wettbuero.html", icon: "assets/icons/trophy.svg" },
    { key: "blog", label: "Blog", href: "blog.html", icon: "assets/icons/blog.svg" },
    { key: "hallOfFame", label: "Hall of Fame", href: "hall_of_fame.html", icon: "assets/icons/crown.svg" },
    { key: "shop", label: "Shop", href: "shop.html", icon: "assets/icons/cart.svg" },
  ];

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

  const escHtml = (s) => MB.escHtml(s);

  let _state = null;
  let _onChange = null; // optionaler Callback, den die Seite bei Spieler-Login/Logout ausführen kann
  let _showAdminLogin = false; // nur auf Seiten mit Admin-Bereich (aktuell admin.html)
  let _onAdminChange = null; // optionaler Callback bei Admin-Login/Logout

  const ADMIN_SESSION_KEY = "mb_admin_session";
  const ADMIN_PW_HASH_KEY = "mb_admin_pw_hash"; // altes, geräte-lokales Passwort (nur noch für Migration gelesen)
  const ADMIN_PW_CONFIG_KEY = "admin_pw_hash"; // Schlüssel in Supabase app_config — jetzt die Quelle der Wahrheit

  // ---------------------------------------------------------------
  // SPIELER-KONTEN — turnierübergreifend in Supabase (app_config "player_accounts":
  // { "<name klein>": { name, pinHash } }). Login bleibt per localStorage über
  // Seitenaufrufe/Tabs hinweg bestehen; wird die PIN vom Admin zurückgesetzt,
  // fliegt die Sitzung beim nächsten Abgleich raus.
  // ---------------------------------------------------------------
  const USER_SESSION_KEY = "mb_user_session";
  const ACCOUNTS_CONFIG_KEY = "player_accounts";
  function readUserSession() {
    try {
      const s = JSON.parse(localStorage.getItem(USER_SESSION_KEY) || "null");
      if (s && s.name) return s;
    } catch (e) { /* kaputt -> ignorieren */ }
    // Migration: alte Tab-Sitzung übernehmen
    const legacy = sessionStorage.getItem("mb_tipp_player");
    return legacy ? { name: legacy, h: null } : null;
  }
  function writeUserSession(name, h) {
    if (name) localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name, h: h || null, at: Date.now() }));
    else localStorage.removeItem(USER_SESSION_KEY);
    sessionStorage.removeItem("mb_tipp_player");
  }
  // Eingeloggter Nutzer — unabhängig davon, ob gerade ein Turnier läuft.
  function currentUser() { const s = readUserSession(); return s ? s.name : null; }
  // Eingeloggter Nutzer, der im LAUFENDEN Turnier mitspielt (Tippspiel etc.).
  function currentPlayer() {
    const name = currentUser();
    if (!name || !_state || !_state.wettbuero || !_state.wettbuero.accounts) return null;
    const key = Object.keys(_state.wettbuero.accounts).find((n) => n.toLowerCase() === name.toLowerCase());
    return key || null;
  }

  async function loadAccounts() {
    try { const raw = await MB.getAppConfig(ACCOUNTS_CONFIG_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  async function saveAccounts(acc) { await MB.setAppConfig(ACCOUNTS_CONFIG_KEY, JSON.stringify(acc)); }
  // Admin: PIN eines Spielers zurücksetzen (nächster Login legt eine neue an)
  async function resetPlayerPin(name) {
    const acc = await loadAccounts();
    const k = String(name).trim().toLowerCase();
    if (acc[k]) { acc[k].pinHash = null; acc[k].resetAt = Date.now(); }
    else acc[k] = { name, pinHash: null, resetAt: Date.now() };
    await saveAccounts(acc);
    if (_state && _state.wettbuero && _state.wettbuero.accounts) {
      const key = Object.keys(_state.wettbuero.accounts).find((n) => n.toLowerCase() === k);
      if (key && _state.wettbuero.accounts[key].pin) {
        _state.wettbuero.accounts[key].pin = null;
        try { await MB.pushCloudState(_state); } catch (e) { console.warn("Turnier-PIN nicht zurückgesetzt:", e); }
      }
    }
  }
  // Sitzung gegen die gespeicherte PIN prüfen (z.B. nach Admin-Reset)
  let _sessionChecked = false;
  async function verifySession() {
    if (_sessionChecked) return; _sessionChecked = true;
    const s = readUserSession(); if (!s || !s.h) return;
    const acc = await loadAccounts();
    const a = acc[s.name.toLowerCase()];
    if (a && a.pinHash !== s.h) { writeUserSession(null); renderAuthArea(); if (_onChange) _onChange(null); }
  }
  // Namen für das Login-Dropdown: aktuelles Turnier + bekannte Konten + letztes abgeschlossenes Turnier
  async function loginNames() {
    const names = [];
    const add = (n) => { n = String(n || "").trim(); if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n); };
    ((_state && _state.players) || []).forEach((p) => add(p.name));
    const acc = await loadAccounts();
    Object.values(acc).forEach((a) => add(a.name));
    try { const last = await MB.fetchLastCompletedTournament(); ((last && last.state && last.state.players) || []).forEach((p) => add(p.name)); } catch (e) { /* optional */ }
    return names.sort((a, b) => a.localeCompare(b, "de"));
  }

  // Admin-Status: bleibt per localStorage bestehen; gültig, solange der gespeicherte
  // Hash mit dem in Supabase übereinstimmt (wird beim Seitenaufruf im Hintergrund geprüft).
  function isAdminUnlocked() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") return true;
    return !!localStorage.getItem(ADMIN_SESSION_KEY);
  }
  async function verifyAdminSession() {
    const h = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!h) return;
    try {
      const stored = await MB.getAppConfig(ADMIN_PW_CONFIG_KEY);
      if (stored && stored !== h) { localStorage.removeItem(ADMIN_SESSION_KEY); sessionStorage.removeItem(ADMIN_SESSION_KEY); renderAuthArea(); if (_onAdminChange) _onAdminChange(false); }
    } catch (e) { /* offline -> Sitzung behalten */ }
  }
  // Admin-Passwort ändern (nur eingeloggt)
  async function changeAdminPassword(newPw) {
    if (!isAdminUnlocked()) throw new Error("Nicht als Admin angemeldet.");
    if (!newPw || newPw.length < 4) throw new Error("Passwort zu kurz (mind. 4 Zeichen).");
    const h = await MB.sha256Hex(newPw);
    await MB.setAppConfig(ADMIN_PW_CONFIG_KEY, h);
    localStorage.setItem(ADMIN_SESSION_KEY, h);
  }

  const sha256Hex = (s) => MB.sha256Hex(s);

  // Achievements (Sammelkarten) werden bei Bedarf nachgeladen — kein Eintrag in den einzelnen Seiten nötig.
  let _achLoading = null;
  // ---------------------------------------------------------------
  // PUSH-BENACHRICHTIGUNGEN (push.js wird bei Bedarf nachgeladen)
  // ---------------------------------------------------------------
  let _pushLoading = null;
  function withPush(cb) {
    if (global.MB.Push) { cb(global.MB.Push); return; }
    if (!_pushLoading) _pushLoading = new Promise((res) => { const s = document.createElement("script"); s.src = "push.js"; s.onload = () => res(global.MB.Push || null); s.onerror = () => res(null); document.head.appendChild(s); });
    _pushLoading.then((P) => { if (P) cb(P); });
  }
  function openPush() {
    let ov = document.getElementById("mbPushModal");
    if (!ov) {
      ov = document.createElement("div"); ov.id = "mbPushModal"; ov.className = "v2-modal-overlay open";
      ov.style.cssText = "position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;";
      ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="v2-modal" style="max-width:420px;width:100%;background:var(--v2-surface,#13203a);border:1px solid var(--v2-border,#2a3a55);border-radius:14px;padding:18px;"><h3 style="margin-top:0;">🔔 Benachrichtigungen</h3><div id="mbPushBody">Lade …</div></div>`;
    withPush(drawPush);
  }
  async function drawPush(P) {
    const box = document.getElementById("mbPushBody"); if (!box) return;
    const st = await P.status();
    const close = `<button class="v2-btn-ghost" onclick="document.getElementById('mbPushModal').remove()">Schließen</button>`;
    if (st.blocked === "ios-install") { box.innerHTML = `<p>Auf dem iPhone funktionieren Benachrichtigungen nur in der installierten App:</p><ol style="padding-left:18px;"><li>Unten auf <b>Teilen</b> tippen</li><li><b>„Zum Home-Bildschirm“</b> wählen</li><li>Die App vom Home-Bildschirm öffnen und hier aktivieren</li></ol><div class="v2-modal-actions">${close}</div>`; return; }
    if (st.blocked === "unsupported") { box.innerHTML = `<p>Dieser Browser unterstützt leider keine Benachrichtigungen.</p><div class="v2-modal-actions">${close}</div>`; return; }
    if (st.blocked === "denied") { box.innerHTML = `<p>Benachrichtigungen sind für diese Seite blockiert. Eine Web-App kann die Einstellungen leider nicht selbst öffnen – so schaltest du sie frei:</p><p style="background:rgba(201,151,0,.12);border-left:3px solid var(--v2-gold,#c99700);padding:8px 10px;border-radius:6px;">${P.settingsHint()}</p><p style="font-size:.85em;opacity:.75;">Danach diese Seite neu laden und hier aktivieren.</p><div class="v2-modal-actions">${close}</div>`; return; }
    const p = st.prefs, user = currentUser();
    const cb = (k, label, hint) => `<label style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;"><input type="checkbox" data-k="${k}" ${p[k] ? "checked" : ""} style="width:auto;margin-top:3px;"><span><b>${label}</b><br><span style="font-size:.82em;opacity:.7;">${hint}</span></span></label>`;
    box.innerHTML = `${cb("match", "Du spielst gleich", "Wenn dein nächstes Spiel ansteht." + (user ? "" : " (nur angemeldet)"))}
      ${cb("tips", "Offene Tipps", "Einmal pro Spieltag, wenn du noch nicht getippt hast." + (user ? "" : " (nur angemeldet)"))}
      ${cb("blog", "Blog &amp; Allgemeines", "Neue Beiträge (Power Rankings, Rekorde, Songs …) und sonstige Hinweise wie Interview-Anfragen.")}
      ${st.subscribed ? "" : `<div style="font-size:.8em;opacity:.7;margin:6px 0;">Nach „Aktivieren“ fragt dein Gerät einmal um Erlaubnis – bitte dort „Erlauben“ tippen. Falls kein Dialog erscheint: ${P.settingsHint()}</div>`}
      <div id="mbPushMsg" style="font-size:.85em;min-height:1.2em;margin:6px 0;color:var(--v2-gold,#c99700);"></div>
      <div class="v2-modal-actions" style="flex-wrap:wrap;gap:8px;">
        ${st.subscribed ? `<button class="v2-btn-ghost" id="mbPushOff">Deaktivieren</button><button class="v2-btn-ghost" id="mbPushTest">Test senden</button><button class="v2-btn-primary" id="mbPushSave">Speichern</button>`
          : `${close}<button class="v2-btn-primary" id="mbPushOn">Aktivieren</button>`}
      </div>`;
    const prefs = () => Object.fromEntries([...box.querySelectorAll("input[data-k]")].map((i) => [i.dataset.k, i.checked]));
    const msg = (t) => { const m = document.getElementById("mbPushMsg"); if (m) m.textContent = t; };
    const run = async (fn, ok) => { try { msg("…"); await fn(); msg(ok); } catch (e) { msg(e.message || String(e)); } };
    const on = document.getElementById("mbPushOn"); if (on) on.onclick = () => run(async () => { await P.enable(prefs()); withAchievements((A) => A.track("push_on", {})); drawPush(P); }, "Aktiviert ✓");
    const save = document.getElementById("mbPushSave"); if (save) save.onclick = () => run(() => P.updatePrefs(prefs()), "Gespeichert ✓");
    const off = document.getElementById("mbPushOff"); if (off) off.onclick = () => run(async () => { await P.disable(); drawPush(P); }, "Deaktiviert");
    const test = document.getElementById("mbPushTest"); if (test) test.onclick = () => run(() => P.test(), "Zugestellt ✓ – falls trotzdem nichts erscheint: Benachrichtigungen fürs Gerät/den Browser in den Systemeinstellungen prüfen (Fokus/Nicht stören?). " + P.settingsHint());
  }

  // ---------------------------------------------------------------
  // EASTER EGGS (Konami-Code, Krone) + gemeinsame Effekte
  // ---------------------------------------------------------------
  function eggCelebrate(text) {
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99998;pointer-events:none;display:flex;align-items:center;justify-content:center;";
    ov.innerHTML = `<div style="font:900 clamp(40px,11vw,120px)/1 Impact,'Arial Black',sans-serif;color:#ffd23f;text-shadow:6px 6px 0 #d50a0a,0 0 40px rgba(255,210,63,.7);letter-spacing:4px;transform:scale(.2);transition:transform .45s cubic-bezier(.2,1.6,.4,1),opacity .4s;text-align:center;">${text}</div>`;
    document.body.appendChild(ov);
    const cols = ["#ffd23f", "#d50a0a", "#ffffff", "#1e50c8", "#3ddc84"];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("i");
      const x = Math.random() * 100, d = 1.2 + Math.random() * 1.6;
      c.style.cssText = `position:fixed;top:-12px;left:${x}vw;width:9px;height:14px;background:${cols[i % cols.length]};z-index:99999;border-radius:2px;transform:rotate(${Math.random() * 360}deg);transition:transform ${d}s linear, top ${d}s cubic-bezier(.3,.6,.6,1), opacity ${d}s;pointer-events:none;`;
      document.body.appendChild(c);
      requestAnimationFrame(() => { c.style.top = "105vh"; c.style.transform = `rotate(${720 + Math.random() * 720}deg) translateX(${(Math.random() - .5) * 200}px)`; });
      setTimeout(() => c.remove(), d * 1000 + 100);
    }
    requestAnimationFrame(() => { ov.firstChild.style.transform = "scale(1)"; });
    setTimeout(() => { ov.firstChild.style.opacity = "0"; }, 2200);
    setTimeout(() => ov.remove(), 2700);
  }
  function easterEgg(id, text) {
    eggCelebrate(text || "✨");
    if (currentUser()) withAchievements((A) => A.track("egg", { id }));
  }
  // Konami-Code: Tastatur (↑↑↓↓←→←→BA) oder am Handy Wischgesten (hoch hoch runter runter links rechts links rechts) + 2× tippen
  (function konami() {
    const SEQ = ["U", "U", "D", "D", "L", "R", "L", "R", "B", "A"];
    let pos = 0;
    const feed = (k) => { pos = k === SEQ[pos] ? pos + 1 : (k === SEQ[0] ? 1 : 0); if (pos === SEQ.length) { pos = 0; easterEgg("egg_konami", "TOUCHDOWN!"); } };
    const KEYS = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", b: "B", B: "B", a: "A", A: "A" };
    document.addEventListener("keydown", (e) => { const k = KEYS[e.key]; if (k) feed(k); });
    // Handy: Wischen wird oft als Scrollen abgebrochen (touchcancel) – deshalb letzte Position merken
    let sx = 0, sy = 0, lx = 0, ly = 0, st = 0, active = false;
    document.addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = lx = t.clientX; sy = ly = t.clientY; st = Date.now(); active = true; }, { passive: true });
    document.addEventListener("touchmove", (e) => { const t = e.touches[0]; lx = t.clientX; ly = t.clientY; }, { passive: true });
    const end = () => {
      if (!active) return; active = false;
      const dx = lx - sx, dy = ly - sy;
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { if (Date.now() - st < 400 && pos >= 8) feed(pos === 8 ? "B" : "A"); return; } // die 2 Taps am Ende
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      feed(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U"));
    };
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
  })();
  // Krone im Seitenkopf: 10× schnell tippen -> sie fällt herunter (einzelner Tipp = normaler Link)
  function hookCrown() {
    const logo = document.querySelector(".v2-logo"); const img = logo && logo.querySelector("img");
    if (!img || img.dataset.egg) return; img.dataset.egg = "1";
    let n = 0, timer = null;
    img.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      n++; clearTimeout(timer);
      img.style.transition = "transform .15s"; img.style.transform = `rotate(${(n % 2 ? -1 : 1) * n * 5}deg) scale(${1 + n * 0.12})`;
      if (n >= 6) {
        n = 0; img.style.transition = "transform .9s cubic-bezier(.5,0,.8,.4), opacity .9s"; img.style.transform = "translateY(110vh) rotate(260deg)"; img.style.opacity = "0";
        easterEgg("egg_crown", "👑 Die Krone ist gefallen!");
        setTimeout(() => { img.style.transition = "none"; img.style.transform = ""; img.style.opacity = "1"; }, 2600);
        return;
      }
      timer = setTimeout(() => { const k = n; n = 0; img.style.transform = ""; if (k === 1) location.href = logo.getAttribute("href"); }, 800);
    });
  }

  function withAchievements(cb) {
    try {
      if (MB.Achievements) { cb(MB.Achievements); return; }
      if (!_achLoading) {
        _achLoading = new Promise((resolve) => {
          const s = document.createElement("script"); s.src = "achievements.js";
          s.onload = () => resolve(MB.Achievements || null); s.onerror = () => resolve(null);
          document.head.appendChild(s);
        });
      }
      _achLoading.then((A) => { if (A) cb(A); });
    } catch (e) { /* Achievements sind optional */ }
  }

  function setState(state, onChange) {
    _state = state;
    if (onChange) _onChange = onChange;
    if (_state) MB.ensureWettbuero(_state);
    renderAuthArea();
    withAchievements((A) => A.init(_state));
    verifySession();
  }

  // ---------------------------------------------------------------
  // HEADER + DRAWER + MODAL: einmalig ins Dokument einfügen
  // ---------------------------------------------------------------
  function mountHeader(opts) {
    const active = (opts && opts.active) || "";
    withAchievements((A) => A.setPage(active));
    _showAdminLogin = !!(opts && opts.showAdminLogin);
    _onAdminChange = (opts && opts.onAdminChange) || null;
    // Admin-Variante (admin.html): eigenes, schlankes Menü statt der Spieler-Navigation.
    // Titelleiste führt zurück auf admin.html, die Admin-Bereiche liegen im Burger-Menü.
    const adminMenu = !!(opts && opts.adminMenu);
    const onAdminPage = /admin\.html$/.test(location.pathname) || typeof global.setAdminTab === "function";
    const adminNavLink = (key, icon, label, hidden) => `
      <a class="v2-nav-link" id="mbAdminNav-${key}" href="admin.html#${key}" style="${hidden && onAdminPage ? "display:none;" : ""}" onclick="if (typeof setAdminTab === 'function') { MB.UI.adminNavSelect('${key}'); return false; }">
        ${icon} ${label}
      </a>`;
    const emoji = (e) => `<span style="display:inline-block; width:20px; text-align:center;">${e}</span>`;
    const adminNavHtml = [
      adminNavLink("setup", emoji("🏈"), "Turnier-Setup", true),
      adminNavLink("schedule", `<img src="assets/icons/calendar.svg" alt="">`, "Spielplan &amp; Ergebnisse"),
      adminNavLink("settings", emoji("⚙️"), "Einstellungen"),
      `<a class="v2-nav-link ${active === "seasons" ? "active" : ""}" href="seasons.html">${emoji("🗂️")} Saisons &amp; Vorbereitung</a>`,
      `<a class="v2-nav-link" href="studio.html" target="mbStudio">${emoji("📺")} Live-Studio (TV)</a>`,
      `<a class="v2-nav-link" href="blog.html"><img src="assets/icons/blog.svg" alt=""> Blog</a>`,
    ].join("");
    const adminSecondaryHtml = `
        <a class="v2-nav-link" href="index.html" target="_blank" rel="noopener">
          <img src="assets/icons/home.svg" alt=""> Spieler-Dashboard
        </a>`;
    const navHtml = adminMenu ? adminNavHtml : NAV_ITEMS.map(item => `
      <a class="v2-nav-link ${item.key === active ? "active" : ""}" href="${item.href}">
        <img src="${item.icon}" alt=""> ${item.label}
      </a>`).join("");

    // Page-Bar: zeigt Icon + Name der aktuellen Seite und einen Zurück-Pfeil
    // zum Dashboard. Nur auf Unterseiten — auf dem Dashboard selbst (active
    // === "dashboard") weglassen, da man dort schon "zuhause" ist.
    const activeItem = NAV_ITEMS.find(item => item.key === active);
    const pageBarHtml = (activeItem && active !== "dashboard") ? `
      <div class="v2-page-bar">
        <a class="v2-page-back" href="index.html" aria-label="Zurück zum Dashboard">←</a>
        <img src="${activeItem.icon}" alt="">
        <span class="v2-page-bar-title">${activeItem.label}</span>
      </div>` : "";

    const headerHtml = `
      <header class="v2-header">
        <a class="v2-logo" href="${adminMenu ? "admin.html" : "index.html"}">
          <img src="assets/icons/crown.svg" alt="">
          <span class="v2-logo-text">Altima Bowl VI</span>
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
        ${adminMenu ? adminSecondaryHtml : `${isAdminUnlocked() ? `<a class="v2-nav-link" href="admin.html">${emoji("🛡️")} Admin-Bereich</a><a class="v2-nav-link" href="seasons.html">${emoji("🗂️")} Saisons &amp; Vorbereitung</a><div class="v2-nav-divider"></div>` : ""}<button class="v2-nav-secondary" onclick="MB.UI.openRules()">Regeln &amp; Settings</button>
        <button class="v2-nav-secondary" onclick="MB.UI.closeNav(); MB.UI.startTour()">Einführung (Tour)</button>
        <button class="v2-nav-secondary" onclick="MB.UI.closeNav(); MB.UI.openPush()">🔔 Benachrichtigungen</button>
        <button class="v2-nav-secondary" id="mbInstallItem" onclick="MB.UI.installApp()" style="${isStandalone() ? "display:none;" : ""}">Zum Home-Bildschirm</button>`}
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
    verifyAdminSession();
    if ("serviceWorker" in navigator) setTimeout(() => withPush(() => {}), 2500);
    hookCrown();
    // Als App installiert (Home-Bildschirm)? -> Sammelkarte
    try { if ((global.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true) setTimeout(() => withAchievements((A) => A.track("pwa_installed", {})), 3000); } catch (e) { /* egal */ }
    // Erstbesuch: Einführung automatisch auf dem Dashboard starten
    if (active === "dashboard" && !adminMenu) {
      let done = false; try { done = !!localStorage.getItem(TOUR_KEY); } catch (e) { /* egal */ }
      // warten, bis der Turnierstand (und damit das passende Dashboard) geladen ist
      if (!done) { let tries = 0; const wait = () => { if ((_state && document.querySelector(".v2-card")) || ++tries > 20) setTimeout(() => startTour(), 600); else setTimeout(wait, 400); }; setTimeout(wait, 800); }
    }
    // Ohne setState() (Seiten ohne Turnierstand) trotzdem Sitzung prüfen
    setTimeout(() => { verifySession(); }, 1500);
  }

  // Admin-Menü: Klick auf einen Bereich schaltet den Admin-Tab um (setAdminTab in
  // admin.html) und schließt das Menü. syncAdminNav() markiert den aktiven Bereich
  // und blendet "Turnier-Setup" nur ein, solange es verfügbar ist.
  function adminNavSelect(tab) {
    if (typeof global.setAdminTab === "function") global.setAdminTab(tab);
    closeNav();
  }
  function syncAdminNav(info) {
    const { tab, setupAvailable } = info || {};
    const setup = document.getElementById("mbAdminNav-setup");
    if (setup) setup.style.display = setupAvailable ? "" : "none";
    ["setup", "schedule", "settings"].forEach((t) => {
      const el = document.getElementById("mbAdminNav-" + t);
      if (el) el.classList.toggle("active", t === tab);
    });
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
    const player = currentUser();
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
      el.innerHTML = `<a href="admin.html">🛡️ Admin-Bereich</a><a href="seasons.html">🗂️ Saisons</a><button onclick="MB.UI.doAdminLogout()">Admin abmelden</button>`;
    } else {
      el.innerHTML = `
        <a href="wettbuero.html">🎯 Zum Tippspiel</a>
        <a href="hall_of_fame.html#player=${encodeURIComponent(currentUser() || "")}">👤 Mein Profil</a>
        <button onclick="MB.UI.doLogout()">Abmelden</button>`;
    }
  }

  function toggleUserMenu(ev) {
    const m = document.getElementById("mbUserMenu"); if (!m) return;
    m.classList.toggle("open");
  }
  // Klick irgendwo anders (oder Esc) schließt das Nutzer-Menü
  document.addEventListener("click", (e) => {
    const m = document.getElementById("mbUserMenu"); if (!m || !m.classList.contains("open")) return;
    const auth = document.getElementById("mbAuthArea");
    if (m.contains(e.target) || (auth && auth.contains(e.target))) return;
    m.classList.remove("open");
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const m = document.getElementById("mbUserMenu"); if (m) m.classList.remove("open"); } });

  // ---------------------------------------------------------------
  // LOGIN-MODAL (Spieler wählen + PIN — legt beim ersten Mal die PIN an)
  // ---------------------------------------------------------------
  async function openLogin() {
    const box = document.getElementById("mbLoginModalContent");
    box.innerHTML = `<h3>Anmelden</h3><div class="hint" style="opacity:.7;">Lade Spieler …</div>`;
    document.getElementById("mbLoginModal").classList.add("open");
    let names = [];
    try { names = await loginNames(); } catch (e) { /* leer */ }
    if (!names.length) {
      if (_showAdminLogin) { openAdminLogin(); return; }
      box.innerHTML = `<h3>Anmelden</h3><div class="v2-modal-error">Noch keine Spieler bekannt.</div><div class="v2-modal-actions"><button class="v2-btn-ghost" onclick="MB.UI.closeLogin()">Schließen</button></div>`;
      return;
    }
    box.innerHTML = `
      <h3>Anmelden</h3>
      <label for="mbLoginName">Spieler</label>
      <select id="mbLoginName">${names.map(n => `<option value="${n}">${n}</option>`).join("")}</select>
      <label for="mbLoginPin">PIN</label>
      <input type="password" id="mbLoginPin" inputmode="numeric" maxlength="6" placeholder="4-6 stellige PIN" onkeydown="if(event.key==='Enter') MB.UI.doLogin()">
      <div class="hint" style="font-size:.8em; opacity:.65; margin-top:4px;">Beim ersten Login (oder nach einem PIN-Reset durch den Admin) wird die eingegebene PIN neu festgelegt.</div>
      <div class="v2-modal-error" id="mbLoginError"></div>
      <div class="v2-modal-actions">
        <button class="v2-btn-ghost" onclick="MB.UI.closeLogin()">Abbrechen</button>
        <button class="v2-btn-primary" onclick="MB.UI.doLogin()">Anmelden</button>
      </div>
      ${_showAdminLogin ? `<div class="v2-modal-altlink"><a href="#" onclick="MB.UI.openAdminLogin();return false;">Als Admin anmelden</a></div>` : ""}`;
    const last = currentUser(); if (last) document.getElementById("mbLoginName").value = last;
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
    localStorage.setItem(ADMIN_SESSION_KEY, hash); // bleibt über Seitenaufrufe bestehen
    closeLogin();
    renderAuthArea();
    if (_onAdminChange) _onAdminChange(true);
  }

  function doAdminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
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
    const h = await MB.sha256Hex("mb-pin:" + name.toLowerCase() + ":" + pin);
    const k = name.toLowerCase();
    let acc;
    try { acc = await loadAccounts(); } catch (e) { errEl.textContent = "Datenbank nicht erreichbar."; return; }
    const tAcc = _state && _state.wettbuero && _state.wettbuero.accounts
      ? _state.wettbuero.accounts[Object.keys(_state.wettbuero.accounts).find((n) => n.toLowerCase() === k)] : null;
    const entry = acc[k];
    if (entry && entry.pinHash) {
      if (entry.pinHash !== h) { errEl.textContent = "Falsche PIN."; return; }
    } else if (!(entry && entry.resetAt) && tAcc && tAcc.pin) {
      // Migration: PIN aus dem laufenden Turnier prüfen und ins Konto übernehmen
      if (tAcc.pin !== pin) { errEl.textContent = "Falsche PIN."; return; }
    }
    if (!entry || entry.pinHash !== h) {
      acc[k] = { name, pinHash: h, since: (entry && entry.since) || Date.now() };
      try { await saveAccounts(acc); } catch (e) { errEl.textContent = "Konnte PIN nicht speichern: " + e.message; return; }
    }
    writeUserSession(name, h);
    closeLogin();
    renderAuthArea();
    withAchievements((A) => A.onLogin(name));
    withPush((P) => P.relink());
    if (_onChange) _onChange(name);
  }

  function doLogout() {
    writeUserSession(null);
    document.getElementById("mbUserMenu").classList.remove("open");
    renderAuthArea();
    withAchievements((A) => A.onLogout());
    if (_onChange) _onChange(null);
  }


  // ---------------------------------------------------------------
  // EINFÜHRUNG (Tour): stellt die Bereiche vor. Startet beim ersten Besuch
  // des Dashboards automatisch, später jederzeit über das Burger-Menü.
  // ---------------------------------------------------------------
  const TOUR_KEY = "mb_tour_done";
  // Zwei Varianten: während eines Turniers vs. vor dem Turnierstart (anderes Dashboard)
  const HOF_TEXT = "Ewige Tabelle, alle Rekorde, Spielerprofile und Sammelkarten.";
  const TOUR_LIVE = [
    { icon: "👋", title: "Willkommen beim Altima Bowl", text: "Kurze Tour durch die Seite — dauert keine Minute. Du kannst jederzeit überspringen und sie später im Menü erneut starten." },
    { icon: "📅", title: "Spielplan", href: "spielplan.html", text: "Alle Partien nach Spieltagen, mit Kickoff-Zeiten (inkl. Vorsprung/Verzug), Quoten, Ergebnissen und dem Playoff Picture." },
    { icon: "🏆", title: "Tippspiel", href: "wettbuero.html", text: "Nach dem Anmelden tippst du Sieger und Over/Under je Spieltag sowie Champion, Vize und Toilet-Bowl-Sieger." },
    { icon: "📰", title: "Blog", href: "blog.html", text: "Automatische Berichte zu Kickoff, Power Rankings, Rekorden, Finale und Champion — dazu Memes, Songs und absurde Schein-Korrelationen. Angemeldet kannst du kommentieren." },
    { icon: "👑", title: "Hall of Fame", href: "hall_of_fame.html", noScroll: true, text: HOF_TEXT },
    { icon: "🛒", title: "Shop", href: "shop.html", text: "Fan-Merch direkt auf der Seite." },
    { icon: "👤", title: "Anmelden", target: "#mbAuthArea", text: "Spieler wählen und PIN eingeben — beim ersten Mal legst du die PIN fest. Du bleibst in diesem Browser angemeldet, auch zwischen den Turnieren." },
    { icon: "☰", title: "Menü", target: ".v2-burger", menu: true, text: "Hier findest du alle Bereiche, die Regeln, Benachrichtigungen, „Zum Home-Bildschirm“ und diese Tour noch einmal." },
  ];
  const TOUR_PRE = [
    { icon: "👋", title: "Willkommen beim Altima Bowl", text: "Gerade läuft kein Turnier – Zeit, sich in Ruhe umzuschauen. Kurze Tour, jederzeit überspringbar und später im Menü wieder startbar." },
    { icon: "⏳", title: "Countdown", target: "#cdCard", text: "Wie lange es noch bis zum Kickoff des nächsten Altima Bowl dauert – auf die Sekunde." },
    { icon: "🏈", title: "Teams & Kader", target: "#tmBox", text: "Alle 32 Teams nach OVR sortiert, mit kompletten Kadern, XF/SS-Spielern und IR. Gestrichene Teams sind durchgestrichen." },
    { icon: "📚", title: "Saisonrückblicke", target: ".v2-blog-wide", text: "Die Geschichte der bisherigen Turniere zum Nachlesen – alles Weitere im Blog." },
    { icon: "👑", title: "Hall of Fame", href: "hall_of_fame.html", noScroll: true, text: HOF_TEXT },
    { icon: "🛒", title: "Shop", href: "shop.html", text: "Fan-Merch für das nächste Turnier." },
    { icon: "👤", title: "Anmelden", target: "#mbAuthArea", text: "Spieler wählen und PIN eingeben — beim ersten Mal legst du die PIN fest. Anmelden geht auch ohne laufendes Turnier und bleibt in diesem Browser bestehen." },
    { icon: "☰", title: "Menü", target: ".v2-burger", menu: true, text: "Alle Bereiche, die Regeln, Benachrichtigungen, „Zum Home-Bildschirm“ und diese Tour noch einmal." },
  ];
  let TOUR_STEPS = TOUR_LIVE;
  function tourSteps() {
    const live = !!(_state && Array.isArray(_state.players) && _state.players.length);
    // vor dem Turnier nur Schritte zeigen, deren Element es gibt (z.B. kein Countdown ohne Termin)
    // Sammelkarten erst erwähnen, wenn man selbst schon eine hat
    let hasCards = false; try { hasCards = !!(MB.Achievements && MB.Achievements.count && MB.Achievements.count() > 0); } catch (e) { hasCards = false; }
    const base = live ? TOUR_LIVE : TOUR_PRE.filter((st) => !st.target || st.menu || document.querySelector(st.target));
    return base.filter((st) => !st.cards || hasCards);
  }
  let _tourIdx = 0;
  function tourCss() {
    if (document.getElementById("mbTourCss")) return;
    const st = document.createElement("style"); st.id = "mbTourCss";
    st.textContent = `.mb-tour { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 70; width: min(440px, calc(100% - 24px));
        background: var(--v2-surface, #13203a); border: 1px solid var(--v2-gold, #c99700); border-radius: 14px; padding: 16px 16px 12px; color: #F5F5F5;
        box-shadow: 0 18px 50px rgba(0,0,0,.6); animation: mbTourIn .25s ease-out; }
      @keyframes mbTourIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
      .mb-tour .tt { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.05em; margin-bottom: 6px; }
      .mb-tour .tt span { font-size: 1.5em; }
      .mb-tour p { margin: 0 0 12px; font-size: .92em; line-height: 1.45; opacity: .9; }
      .mb-tour .dots { display: flex; gap: 5px; flex: 1; }
      .mb-tour .dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); }
      .mb-tour .dots i.on { background: var(--v2-gold, #c99700); }
      .mb-tour .row { display: flex; align-items: center; gap: 8px; }
      .mb-tour button { width: auto; margin: 0; padding: 7px 14px; border-radius: 8px; border: 0; font-weight: 700; cursor: pointer; }
      .mb-tour .skip { background: transparent; color: #aab6c8; padding-left: 0; }
      .mb-tour .prev { background: rgba(255,255,255,.1); color: #fff; }
      .mb-tour .next { background: var(--v2-gold, #c99700); color: #000; }
      .mb-tour a { color: var(--v2-gold, #c99700); font-size: .85em; }
      .mb-tour-hl { outline: 3px solid var(--v2-gold, #c99700) !important; outline-offset: 3px; border-radius: 10px; box-shadow: 0 0 0 7px rgba(201,151,0,.18), 0 0 28px rgba(201,151,0,.55) !important; animation: mbTourPulse 1.2s ease-in-out infinite; }
      @keyframes mbTourPulse { 50% { outline-color: rgba(201,151,0,.25); } }
      @media (prefers-reduced-motion: reduce) { .mb-tour, .mb-tour-hl { animation: none; } }`;
    document.head.appendChild(st);
  }
  function startTour() { tourCss(); TOUR_STEPS = tourSteps(); _tourIdx = 0; drawTour(); }
  function endTour(completed) {
    if (completed) withAchievements((A) => A.track("tour_done", {}));
    try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) { /* egal */ }
    document.querySelectorAll(".mb-tour-hl").forEach((e) => e.classList.remove("mb-tour-hl"));
    const b = document.getElementById("mbTour"); if (b) b.remove();
    closeNav();
  }
  function tourStep(d) { _tourIdx = Math.max(0, Math.min(TOUR_STEPS.length - 1, _tourIdx + d)); drawTour(); }
  // Alles markieren, worauf sich der aktuelle Hinweis bezieht: Dashboard-Karten mit
  // Link auf den Bereich, den Menüpunkt (Menü wird dafür auf breiten Bildschirmen
  // geöffnet), bzw. Login-Button / Burger-Menü.
  function tourTargets(st) {
    const out = new Set();
    const drawer = document.getElementById("mbNavDrawer");
    const inDrawer = (e) => drawer && drawer.contains(e);
    if (st.all) document.querySelectorAll(".v2-card").forEach((c) => { if (!inDrawer(c)) out.add(c); });
    if (st.href && !st.all) {
      document.querySelectorAll(`a[href="${st.href}"]`).forEach((a) => {
        if (inDrawer(a) || a.closest(".v2-header") || a.closest("#mbTour")) return;
        out.add(a.closest(".v2-card") || a);
      });
    }
    if (st.target) document.querySelectorAll(st.target).forEach((e) => out.add(e));
    return [...out];
  }
  function drawTour() {
    document.querySelectorAll(".mb-tour-hl").forEach((e) => e.classList.remove("mb-tour-hl"));
    const st = TOUR_STEPS[_tourIdx], last = _tourIdx === TOUR_STEPS.length - 1;
    let box = document.getElementById("mbTour");
    if (!box) { box = document.createElement("div"); box.id = "mbTour"; box.className = "mb-tour"; box.setAttribute("role", "dialog"); document.body.appendChild(box); }
    box.innerHTML = `<div class="tt"><span>${st.icon}</span>${st.title}</div><p>${st.text}${st.href && !location.pathname.endsWith(st.href) ? ` <a href="${st.href}">Ansehen</a>` : ""}</p>
      <div class="row"><button class="skip" onclick="MB.UI.endTour()">${last ? "" : "Überspringen"}</button><div class="dots">${TOUR_STEPS.map((_, i) => `<i class="${i === _tourIdx ? "on" : ""}"></i>`).join("")}</div>
      ${_tourIdx ? `<button class="prev" onclick="MB.UI.tourStep(-1)">Zurück</button>` : ""}
      <button class="next" onclick="${last ? "MB.UI.endTour(true)" : "MB.UI.tourStep(1)"}">${last ? "Los geht’s" : "Weiter"}</button></div>`;
    const drawer = document.getElementById("mbNavDrawer"), back = document.getElementById("mbNavBackdrop");
    const wide = window.innerWidth >= 900;
    // Menü öffnen: beim Menü-Schritt immer, bei Bereichs-Schritten nur, wenn genug Platz ist
    const openMenu = st.menu || (st.href && wide);
    if (drawer) { drawer.classList.toggle("open", !!openMenu); if (back) back.classList.toggle("open", !!openMenu && !!st.menu); }
    const targets = st.noScroll ? [] : tourTargets(st);
    if (st.href && drawer && openMenu) drawer.querySelectorAll(`.v2-nav-link[href="${st.href}"]`).forEach((n) => targets.push(n));
    targets.forEach((t) => t.classList.add("mb-tour-hl"));
    const first = targets.find((t) => !(drawer && drawer.contains(t)) && !t.closest(".v2-header"));
    if (st.noScroll) { /* nicht nach unten springen (Tour-Text würde die Karte verdecken) */ }
    else if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (!st.target) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  global.MB = global.MB || {};
  global.MB.UI = {
    NAV_ITEMS, mountHeader, setState, currentPlayer, currentUser, isAdminUnlocked, withAchievements,
    loadAccounts, resetPlayerPin, changeAdminPassword, startTour, endTour, tourStep, openPush, withPush, easterEgg,
    toggleNav, closeNav, toggleUserMenu, adminNavSelect, syncAdminNav,
    openRules, closeInfo, installApp, isStandalone,
    RULES_CONTENT_KEY, RULES_CONTENT_DEFAULTS,
    openLogin, closeLogin, doLogin, doLogout,
    openAdminLogin, doAdminLogin, doAdminLogout,
  };
})(window);
