// =========================================================================
// nav.js — gemeinsamer Header + Burgermenü + seitenweiter Login-Dialog
// -------------------------------------------------------------------------
// Wird von live.html, wettbuero.html, shop.html und hall_of_fame_live.html
// eingebunden (nach shared.js). Ersetzt den bisherigen, pro Seite eigenen
// <header>-Inhalt durch einen einheitlichen Kopf:
//   [👑 Logo/Titel -> Dashboard]   [Anmelden/Spielername]  [☰ Menü]
// Das Burgermenü öffnet ein Overlay mit Links zu allen Unterseiten, sodass
// man von überall aus überallhin wechseln kann, ohne den Zurück-Button des
// Browsers zu brauchen.
//
// Nutzung (am Ende von <body>, nachdem der Zustand geladen ist):
//   MB.Nav.mount({ current: 'dashboard', state, onAuthChange: fn });
//   ... und bei jedem Neu-Rendern der Seite:
//   MB.Nav.refreshAuth(state);
// =========================================================================
(function (global) {
  const LINKS = [
    { key: 'dashboard', href: 'live.html', icon: '🏠', label: 'Dashboard' },
    { key: 'schedule', href: 'live.html?view=full', icon: '📋', label: 'Spielplan' },
    { key: 'tipp', href: 'wettbuero.html', icon: '🎯', label: 'Tippspiel' },
    { key: 'blog', href: 'live.html#blog', icon: '📰', label: 'Blog' },
    { key: 'hof', href: 'hall_of_fame_live.html', icon: '👑', label: 'Hall of Fame' },
    { key: 'shop', href: 'shop.html', icon: '🛍️', label: 'Fan-Shop' },
  ];

  let cssInjected = false;
  let mountOpts = {};

  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      header.mb-header {
        padding: 14px 16px; border-bottom: 1px solid #22304366;
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        background: linear-gradient(180deg, rgba(213,10,10,0.08), transparent);
        position: sticky; top: 0; z-index: 40; backdrop-filter: blur(6px);
      }
      .mb-logo-link {
        display: flex; align-items: center; gap: 8px; text-decoration: none; min-width: 0;
      }
      .mb-logo-link .mb-crown { font-size: 1.25em; flex-shrink: 0; }
      .mb-logo-link .mb-titlebox { display: flex; flex-direction: column; min-width: 0; line-height: 1.1; }
      .mb-logo-link .mb-title {
        font-size: 1.02em; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
        background: linear-gradient(90deg, #fff, var(--accent));
        -webkit-background-clip: text; background-clip: text; color: transparent;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .mb-logo-link .mb-subtitle { font-size: 0.62em; opacity: 0.55; letter-spacing: 1px; text-transform: uppercase; }
      .mb-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .mb-clock { color: var(--accent); font-variant-numeric: tabular-nums; font-size: 0.82em; opacity: 0.85; margin-right: 2px; }
      .mb-auth-btn {
        background: #1c2431; border: 1px solid #2d3748; color: #eee; border-radius: 8px;
        padding: 7px 12px; font-size: 0.8em; font-weight: 700; cursor: pointer; white-space: nowrap;
      }
      .mb-auth-btn.mb-auth-in { background: rgba(0,255,204,0.1); border-color: var(--accent); color: var(--accent); }
      .mb-burger-btn {
        background: #1c2431; border: 1px solid #2d3748; color: #eee; border-radius: 8px;
        width: 38px; height: 38px; font-size: 1.05em; cursor: pointer; line-height: 1;
      }
      .mb-menu-overlay {
        display: none; position: fixed; inset: 0; background: rgba(4,7,12,0.75);
        z-index: 200; backdrop-filter: blur(2px);
      }
      .mb-menu-overlay.open { display: block; }
      .mb-menu-panel {
        position: absolute; top: 0; right: 0; height: 100%; width: min(78vw, 300px);
        background: var(--card, #161f2c); border-left: 1px solid #2d3748;
        box-shadow: -8px 0 30px rgba(0,0,0,0.4); padding: 18px 14px;
        display: flex; flex-direction: column; gap: 4px; overflow-y: auto;
        transform: translateX(100%); transition: transform 0.22s ease;
      }
      .mb-menu-overlay.open .mb-menu-panel { transform: translateX(0); }
      .mb-menu-close {
        align-self: flex-end; background: none; border: none; color: #9db3c8;
        font-size: 1.3em; cursor: pointer; padding: 4px 8px; margin-bottom: 6px; width: auto;
      }
      .mb-menu-who { font-size: 0.78em; opacity: 0.65; padding: 0 6px 10px; border-bottom: 1px solid #2d3748; margin-bottom: 8px; }
      .mb-menu-link {
        display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-radius: 10px;
        color: #eee; text-decoration: none; font-weight: 700; font-size: 0.95em;
      }
      .mb-menu-link:active { background: #0e1622; }
      .mb-menu-link.mb-active { color: var(--accent); background: rgba(0,255,204,0.08); }
      .mb-menu-icon { font-size: 1.15em; width: 24px; text-align: center; }
      .mb-menu-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #2d3748; }
      .mb-menu-footer button { width: 100%; }

      /* Basis-Sichtbarkeit fürs Modal-Overlay (falls die Seite sie nicht
         schon selbst mitbringt, z.B. shop.html/hall_of_fame_live.html). */
      .modal-overlay { display: none; }
      .modal-overlay.open { display: block; }
      .modal-close {
        position: sticky; top: 0; float: right; width: auto; margin-left: 8px;
        background: #22304380; padding: 6px 12px; z-index: 2;
      }
      .mb-login-modal .modal-box { max-width: 380px; }
      .mb-login-modal label { font-size: 0.8em; opacity: 0.75; display: block; margin: 10px 0 4px; }
      .mb-login-modal select, .mb-login-modal input {
        background: #0e1622; color: #eee; border: 1px solid #2a3a4d; border-radius: 6px;
        padding: 9px 10px; font-size: 1em; width: 100%; box-sizing: border-box;
      }
      .mb-login-hint { font-size: 0.75em; opacity: 0.6; margin-top: 6px; }
      .mb-login-error { color: var(--nfl-red); font-size: 0.85em; margin-top: 8px; min-height: 1em; }

      /* Zoom/Pan-Container fürs Playoff Picture auf dem Handy */
      .mb-zoom-wrap { overflow: hidden; touch-action: none; border-radius: 10px; position: relative; }
      .mb-zoom-inner { transform-origin: 0 0; will-change: transform; }
      .mb-zoom-hint {
        position: absolute; bottom: 6px; right: 8px; font-size: 0.62em; opacity: 0.5;
        background: rgba(0,0,0,0.4); padding: 2px 7px; border-radius: 6px; pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function authLabel(state) {
    const name = global.MB && MB.Auth ? MB.Auth.currentPlayer(state) : null;
    return name;
  }

  function renderAuthBtn(state) {
    const btn = document.getElementById('mbAuthBtn');
    if (!btn) return;
    const name = authLabel(state);
    if (name) {
      btn.textContent = '👤 ' + name;
      btn.classList.add('mb-auth-in');
      btn.onclick = () => openMenu(state); // eingeloggt -> Menü mit Logout-Option
    } else {
      btn.textContent = 'Anmelden';
      btn.classList.remove('mb-auth-in');
      btn.onclick = () => openLoginModal(state);
    }
  }

  function ensureMenuOverlay() {
    if (document.getElementById('mbMenuOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'mb-menu-overlay';
    overlay.id = 'mbMenuOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeMenu(); };
    overlay.innerHTML = `<div class="mb-menu-panel" id="mbMenuPanel"></div>`;
    document.body.appendChild(overlay);
  }

  function buildMenuHtml(state) {
    const name = authLabel(state);
    const current = mountOpts.current;
    const links = LINKS.map(l => `
      <a class="mb-menu-link ${l.key === current ? 'mb-active' : ''}" href="${l.href}">
        <span class="mb-menu-icon">${l.icon}</span>${l.label}
      </a>`).join('');
    return `
      <button class="mb-menu-close" onclick="MB.Nav.closeMenu()">✕</button>
      ${name ? `<div class="mb-menu-who">Angemeldet als <b style="color:var(--accent)">${name}</b></div>` : ''}
      ${links}
      <div class="mb-menu-footer">
        ${name
          ? `<button onclick="MB.Nav.logout()">Abmelden</button>`
          : `<button onclick="MB.Nav.closeMenu(); MB.Nav.openLoginModal(window.__mbState || null);">Anmelden</button>`}
      </div>`;
  }

  function openMenu(state) {
    ensureMenuOverlay();
    document.getElementById('mbMenuPanel').innerHTML = buildMenuHtml(state);
    document.getElementById('mbMenuOverlay').classList.add('open');
  }
  function closeMenu() {
    const el = document.getElementById('mbMenuOverlay');
    if (el) el.classList.remove('open');
  }

  function ensureLoginModal() {
    if (document.getElementById('mbLoginOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay mb-login-modal';
    overlay.id = 'mbLoginOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeLoginModal(); };
    overlay.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="MB.Nav.closeLoginModal()">✕ Schließen</button>
        <h2 style="margin-top:0;">Anmelden</h2>
        <div id="mbLoginBody"></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function openLoginModal(state) {
    ensureLoginModal();
    const body = document.getElementById('mbLoginBody');
    if (!state || !state.players || !state.players.length) {
      body.innerHTML = `<div class="mb-login-error" style="color:#eee; opacity:0.7;">Es läuft aktuell kein Turnier — eine Anmeldung ist erst möglich, sobald eins gestartet wurde.</div>`;
    } else {
      const names = state.players.map(p => p.name);
      body.innerHTML = `
        <label for="mbPlayerSelect">Spieler</label>
        <select id="mbPlayerSelect">${names.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
        <label for="mbPinInput">PIN</label>
        <input type="password" id="mbPinInput" inputmode="numeric" maxlength="6" placeholder="4-6 stellige PIN" />
        <div class="mb-login-hint" id="mbLoginHint"></div>
        <button id="mbLoginSubmit" style="margin-top:14px;">Anmelden / PIN festlegen</button>
        <div class="mb-login-error" id="mbLoginError"></div>`;

      const sel = document.getElementById('mbPlayerSelect');
      const hint = document.getElementById('mbLoginHint');
      const updateHint = () => {
        MB.ensureWettbuero(state);
        const acc = state.wettbuero.accounts[sel.value];
        hint.textContent = (acc && acc.pin)
          ? 'PIN eingeben zum Anmelden.'
          : 'Für diesen Spieler ist noch keine PIN gesetzt — die eingegebene PIN wird jetzt festgelegt.';
      };
      sel.onchange = updateHint;
      updateHint();

      document.getElementById('mbLoginSubmit').onclick = async () => {
        const errEl = document.getElementById('mbLoginError');
        errEl.textContent = '';
        const result = await MB.Auth.login(state, sel.value, document.getElementById('mbPinInput').value);
        if (!result.ok) { errEl.textContent = result.error; return; }
        closeLoginModal();
        renderAuthBtn(state);
        if (typeof mountOpts.onAuthChange === 'function') mountOpts.onAuthChange(result.name);
      };
    }
    document.getElementById('mbLoginOverlay').classList.add('open');
  }
  function closeLoginModal() {
    const el = document.getElementById('mbLoginOverlay');
    if (el) el.classList.remove('open');
  }

  function logout() {
    MB.Auth.logout();
    closeMenu();
    renderAuthBtn(window.__mbState || null);
    if (typeof mountOpts.onAuthChange === 'function') mountOpts.onAuthChange(null);
  }

  // opts: { current: 'dashboard'|'schedule'|'tipp'|'blog'|'hof'|'shop',
  //         title: 'Madden Bowl VI', subtitle: 'optional',
  //         state, showClock: true|false, onAuthChange(name) }
  function mount(opts) {
    opts = opts || {};
    mountOpts = opts;
    injectCss();
    window.__mbState = opts.state || null;

    let header = document.querySelector('header.mb-header');
    if (!header) {
      header = document.querySelector('header') || document.createElement('header');
      if (!header.parentNode) document.body.prepend(header);
      header.classList.add('mb-header');
    }
    header.innerHTML = `
      <a class="mb-logo-link" href="live.html">
        <span class="mb-crown">👑</span>
        <span class="mb-titlebox">
          <span class="mb-title">${opts.title || 'Madden Bowl'}</span>
          ${opts.subtitle ? `<span class="mb-subtitle">${opts.subtitle}</span>` : ''}
        </span>
      </a>
      <div class="mb-header-actions">
        ${opts.showClock ? `<span class="mb-clock" id="mbClock"></span>` : ''}
        <button class="mb-auth-btn" id="mbAuthBtn"></button>
        <button class="mb-burger-btn" id="mbBurgerBtn" aria-label="Menü">☰</button>
      </div>`;
    document.getElementById('mbBurgerBtn').onclick = () => openMenu(opts.state);
    renderAuthBtn(opts.state);

    if (opts.showClock) {
      const tick = () => {
        const el = document.getElementById('mbClock');
        if (el) el.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      };
      tick();
      if (!window.__mbClockTimer) window.__mbClockTimer = setInterval(tick, 1000);
    }
    return header;
  }

  // Nach jedem State-Reload/Re-Render aufrufen, damit Login-Status,
  // Menü-Inhalt (Spielername) und ggf. der Login-Dialog aktuell bleiben.
  function refreshAuth(state) {
    window.__mbState = state || null;
    mountOpts.state = state || null;
    renderAuthBtn(state);
    const panel = document.getElementById('mbMenuPanel');
    if (panel && document.getElementById('mbMenuOverlay')?.classList.contains('open')) {
      panel.innerHTML = buildMenuHtml(state);
    }
  }

  // =========================================================
  // ZOOM/PAN — fürs Playoff Picture auf dem Handy (Pinch-to-Zoom +
  // Ziehen bei Zoom, Doppeltipp zum Zurücksetzen). Funktioniert auf
  // jedem Container mit genau einem Inhaltselement.
  // =========================================================
  function enableZoom(wrapEl, innerEl, opts) {
    if (!wrapEl || !innerEl) return;
    opts = opts || {};
    const minScale = opts.minScale || 1;
    const maxScale = opts.maxScale || 3.5;
    let scale = 1, panX = 0, panY = 0;
    let lastDist = null, lastMid = null;
    let panning = false, panStart = null;

    wrapEl.classList.add('mb-zoom-wrap');
    innerEl.classList.add('mb-zoom-inner');
    if (!wrapEl.querySelector('.mb-zoom-hint') && opts.hint !== false) {
      const hint = document.createElement('div');
      hint.className = 'mb-zoom-hint';
      hint.textContent = '🤏 Zum Zoomen';
      wrapEl.appendChild(hint);
      setTimeout(() => hint.remove(), 3500);
    }

    function apply() {
      scale = Math.min(maxScale, Math.max(minScale, scale));
      innerEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function dist(touches) {
      const [a, b] = touches;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    function mid(touches) {
      const [a, b] = touches;
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    }

    wrapEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lastDist = dist(e.touches);
        lastMid = mid(e.touches);
        panning = false;
      } else if (e.touches.length === 1) {
        // Immer schwenkbar (nicht erst ab Zoom) — der Bracket-Inhalt ist
        // meist schon unskaliert breiter als der sichtbare Ausschnitt.
        panning = true;
        panStart = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
      }
    }, { passive: true });

    wrapEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && lastDist) {
        e.preventDefault();
        const d = dist(e.touches);
        scale *= d / lastDist;
        lastDist = d;
        apply();
      } else if (e.touches.length === 1 && panning) {
        e.preventDefault();
        panX = e.touches[0].clientX - panStart.x;
        panY = e.touches[0].clientY - panStart.y;
        apply();
      }
    }, { passive: false });

    wrapEl.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) lastDist = null;
      if (e.touches.length === 0) panning = false;
    });

    let lastTap = 0;
    wrapEl.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        scale = scale > minScale ? minScale : 2;
        panX = 0; panY = 0;
        apply();
      }
      lastTap = now;
    });

    // Desktop: Mausrad zoomt
    wrapEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      scale *= e.deltaY < 0 ? 1.1 : 0.9;
      apply();
    }, { passive: false });

    apply();
  }

  global.MB = global.MB || {};
  global.MB.Nav = {
    mount, refreshAuth, openMenu, closeMenu, openLoginModal, closeLoginModal, logout, enableZoom, LINKS,
  };
})(window);
