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
    const navHtml = NAV_ITEMS.map(item => `
      <a class="v2-nav-link ${item.key === active ? "active" : ""}" href="${item.href}">
        <img src="${item.icon}" alt=""> ${item.label}
      </a>`).join("");

    // Page-Bar: zeigt Icon + Name der aktuellen Seite und einen Zurück-Pfeil
    // zum Dashboard. Nur auf Unterseiten — auf dem Dashboard selbst (active
    // === "dashboard") weglassen, da man dort schon "zuhause" ist.
    const activeItem = NAV_ITEMS.find(item => item.key === active);
    const pageBarHtml = (activeItem && active !== "dashboard") ? `
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
      </nav>
      <div class="v2-user-pill-menu" id="mbUserMenu"></div>
      <div class="v2-modal-overlay" id="mbLoginModal" onclick="if(event.target===this) MB.UI.closeLogin()">
        <div class="v2-modal-box" id="mbLoginModalContent"></div>
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
    openLogin, closeLogin, doLogin, doLogout,
    openAdminLogin, doAdminLogin, doAdminLogout,
  };
})(window);
