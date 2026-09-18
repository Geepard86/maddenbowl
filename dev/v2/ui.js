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
    { key: "shop", label: "Shop", href: "shop.html", icon: "assets/icons/cart.svg" },
  ];

  let _state = null;
  let _onChange = null; // optionaler Callback, den die Seite bei Login/Logout ausführen kann

  function currentPlayer() {
    const name = sessionStorage.getItem("mb_tipp_player");
    if (!name || !_state || !_state.wettbuero || !_state.wettbuero.accounts[name]) return null;
    return name;
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
    const navHtml = NAV_ITEMS.map(item => `
      <a class="v2-nav-link ${item.key === active ? "active" : ""}" href="${item.href}">
        <img src="${item.icon}" alt=""> ${item.label}
      </a>`).join("");

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
      <div class="v2-nav-backdrop" id="mbNavBackdrop" onclick="MB.UI.closeNav()"></div>
      <nav class="v2-nav-drawer" id="mbNavDrawer">
        <button class="v2-nav-drawer-close" onclick="MB.UI.closeNav()">✕</button>
        ${navHtml}
      </nav>
      <div class="v2-user-pill-menu" id="mbUserMenu">
        <a href="wettbuero.html">🎯 Zum Tippspiel</a>
        <button onclick="MB.UI.doLogout()">Abmelden</button>
      </div>
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
    const player = currentPlayer();
    if (player) {
      el.innerHTML = `<button class="v2-btn-login is-user" onclick="MB.UI.toggleUserMenu()">
        <img src="assets/icons/user.svg" alt=""> ${player}
      </button>`;
    } else {
      el.innerHTML = `<button class="v2-btn-login" onclick="MB.UI.openLogin()">
        <img src="assets/icons/user.svg" alt=""> Anmelden
      </button>`;
    }
  }

  function toggleUserMenu() {
    document.getElementById("mbUserMenu").classList.toggle("open");
  }

  // ---------------------------------------------------------------
  // LOGIN-MODAL (Spieler wählen + PIN — legt beim ersten Mal die PIN an)
  // ---------------------------------------------------------------
  function openLogin() {
    if (!_state || !_state.players || !_state.players.length) {
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
      </div>`;
    document.getElementById("mbLoginModal").classList.add("open");
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
    NAV_ITEMS, mountHeader, setState, currentPlayer,
    toggleNav, closeNav, toggleUserMenu,
    openLogin, closeLogin, doLogin, doLogout,
  };
})(window);
