// ============================================================================
// push.js — Web-Push im Browser: Anmelden/Abmelden, Einstellungen, Test,
// und (Admin-Seite) Auslösen von Spielaufruf- und Tipp-Erinnerungen.
// Gegenstück: sw.js (Service Worker) + Supabase Edge Function "push".
// ============================================================================
(function (global) {
  const PREFS_KEY = "mb_push_prefs";
  const SENT_KEY = "mb_push_sent";
  const sb = () => (global.MB.getSupabaseClient ? global.MB.getSupabaseClient() : null);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => (global.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function supported() { return "serviceWorker" in navigator && "PushManager" in global && "Notification" in global; }
  // iPhone: Push nur in der installierten Web-App (Home-Bildschirm, iOS 16.4+)
  function blockedReason() {
    if (isIOS() && !isStandalone()) return "ios-install";
    if (!supported()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "";
  }
  // Wo man Benachrichtigungen nachträglich erlaubt (Web-Apps können die Einstellungen nicht selbst öffnen)
  function settingsHint() {
    const ua = navigator.userAgent;
    if (isIOS()) return "iPhone: Einstellungen → Mitteilungen → „Altima Bowl“ → Mitteilungen erlauben.";
    if (/android/i.test(ua)) return isStandalone()
      ? "Android: lange auf das App-Icon tippen → App-Info → Benachrichtigungen → zulassen."
      : "Android: im Browser auf ⋮ → Einstellungen → Website-Einstellungen → Benachrichtigungen → diese Seite zulassen.";
    if (/firefox/i.test(ua)) return "Firefox: Schloss-Symbol links neben der Adresse → Berechtigungen → Benachrichtigungen erlauben.";
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari (Mac): Safari → Einstellungen → Websites → Mitteilungen → diese Seite erlauben.";
    return "Browser: Schloss-Symbol links neben der Adresse → Benachrichtigungen → Zulassen. Zusätzlich müssen Benachrichtigungen für den Browser im Betriebssystem erlaubt sein.";
  }
  function getPrefs() { try { return { match: true, tips: true, blog: true, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")) }; } catch (e) { return { match: true, tips: true, blog: true }; } }
  let regPromise = null;
  function register() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    if (!regPromise) regPromise = navigator.serviceWorker.register("sw.js").catch((e) => { console.warn("Service Worker:", e); return null; });
    return regPromise;
  }
  async function currentSub() { const reg = await register(); return reg ? reg.pushManager.getSubscription() : null; }
  const b64uToBytes = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
  const bytesToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  async function status() {
    const sub = supported() ? await currentSub() : null;
    return { supported: supported(), blocked: blockedReason(), permission: global.Notification ? Notification.permission : "default", subscribed: !!sub, prefs: getPrefs() };
  }
  async function saveSub(sub, prefs) {
    const c = sb(); if (!c) throw new Error("Keine Datenbankverbindung.");
    const j = sub.toJSON();
    const player = (global.MB.UI && global.MB.UI.currentUser && global.MB.UI.currentUser()) || "";
    const { error } = await c.rpc("mb_push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_player: player, p_prefs: prefs, p_ua: navigator.userAgent.slice(0, 200) });
    if (error) throw new Error(/function|does not exist/i.test(error.message) ? "Push ist auf dem Server noch nicht eingerichtet (SQL fehlt)." : error.message);
  }
  async function enable(prefs) {
    const why = blockedReason(); if (why === "ios-install") throw new Error("Auf dem iPhone bitte zuerst über Teilen → „Zum Home-Bildschirm“ installieren und die App von dort öffnen.");
    if (why === "unsupported") throw new Error("Dieser Browser unterstützt keine Benachrichtigungen.");
    const p = { ...getPrefs(), ...(prefs || {}) };
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt. So schaltest du sie nachträglich frei – " + settingsHint());
    const reg = await register(); if (!reg) throw new Error("Service Worker konnte nicht gestartet werden.");
    const key = global.MB.getAppConfig ? await global.MB.getAppConfig("push_vapid_public") : null;
    if (!key) throw new Error("Push ist noch nicht eingerichtet (öffentlicher Schlüssel fehlt).");
    let sub = await reg.pushManager.getSubscription();
    // Abo mit anderem (altem) Schlüssel? Dann neu anlegen, sonst lehnt der Push-Dienst ab
    if (sub && sub.options && sub.options.applicationServerKey && bytesToB64u(sub.options.applicationServerKey) !== key) { try { await sub.unsubscribe(); } catch (e) { /* egal */ } sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
    await saveSub(sub, p);
    return true;
  }
  async function updatePrefs(prefs) {
    const p = { ...getPrefs(), ...(prefs || {}) }; localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    const sub = await currentSub(); if (sub) await saveSub(sub, p);
  }
  async function disable() {
    const sub = await currentSub(); if (!sub) return;
    try { const c = sb(); if (c) await c.rpc("mb_push_unsubscribe", { p_endpoint: sub.endpoint }); } catch (e) { /* egal */ }
    await sub.unsubscribe();
  }
  // Test an dieses Gerät – zeigt das Ergebnis der Zustellung im Klartext an
  async function test() {
    const sub = await currentSub(); if (!sub) throw new Error("Auf diesem Gerät ist kein Abo aktiv – bitte deaktivieren und neu aktivieren.");
    // Abo sicherheitshalber erneut speichern (falls es serverseitig fehlt oder der Schlüssel gewechselt hat)
    await saveSub(sub, getPrefs());
    const c = sb(); const url = (c && c.supabaseUrl) ? c.supabaseUrl.replace(/\/$/, "") + "/functions/v1/push" : null;
    if (!url) throw new Error("Supabase-Adresse unbekannt.");
    let res, data = null;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: c.supabaseKey, Authorization: "Bearer " + c.supabaseKey }, body: JSON.stringify({ type: "test", endpoint: sub.endpoint }) });
      try { data = await res.json(); } catch (e) { data = null; }
    } catch (e) { throw new Error("Push-Funktion nicht erreichbar: " + e.message); }
    if (!res.ok) throw new Error(`Push-Funktion antwortet mit HTTP ${res.status}: ${(data && (data.error || data.message || data.msg)) || "?"}${res.status === 401 ? " – „Verify JWT“ in der Funktion ausschalten." : ""}`);
    if (!data || !data.sent) {
      // Alte Funktionsversion (ohne "details"): Abo gefunden, Zustellung aber gescheitert – Grund unbekannt
      if (data && !data.details && (data.failed || data.removed)) throw new Error(`Zustellung fehlgeschlagen (${data.failed || 0} Fehler, ${data.removed || 0} abgelaufen). Auf dem Server läuft noch die alte Version der Push-Funktion – bitte index.ts UND webpush.js neu deployen, dann steht hier der genaue Grund.`);
      const d = data && data.details && data.details[0];
      // Diagnose der Server-Einstellungen
      let diag = "";
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: c.supabaseKey, Authorization: "Bearer " + c.supabaseKey }, body: JSON.stringify({ type: "diag" }) });
        const g = await r.json();
        const probs = [];
        if (g.keypair && !g.keypair.ok) probs.push("Secrets: " + g.keypair.reason);
        if (g.publicMatchesSite === false) probs.push(`VAPID_PUBLIC_KEY (beginnt mit „${g.publicSecretStart}“) ist nicht der in der Admin-Seite gespeicherte Schlüssel („${g.publicSiteStart}“)`);
        if (g.subjectValid === false) probs.push(`VAPID_SUBJECT „${g.subject}“ ist keine gültige mailto:-Adresse`);
        const ownKey = sub.options && sub.options.applicationServerKey ? bytesToB64u(sub.options.applicationServerKey) : "";
        if (ownKey && g.publicSiteStart && !ownKey.startsWith(g.publicSiteStart)) probs.push("Dieses Gerät ist noch mit einem alten Schlüssel angemeldet – bitte Deaktivieren und neu Aktivieren");
        diag = probs.length ? " Gefunden: " + probs.join(" · ") + "." : " Schlüssel, Absender und Abo sehen korrekt aus – nach dem Ändern der Secrets die Funktion neu deployen und auf dem Gerät deaktivieren/aktivieren.";
      } catch (e) { diag = ""; }
      throw new Error(`Nicht zugestellt: ${d ? (d.error || "HTTP " + d.status + (d.info ? " " + d.info : "")) : "kein Abo gefunden"}.${diag}`);
    }
    return data;
  }
  // Nach dem Login: Abo dem Spieler zuordnen (falls vorher ohne Login aktiviert)
  async function relink() { try { const sub = await currentSub(); if (sub) await saveSub(sub, getPrefs()); } catch (e) { /* egal */ } }

  // ---------------------------------------------------------------- Admin-Auslöser
  function sentOnce(key) {
    let m = {}; try { m = JSON.parse(localStorage.getItem(SENT_KEY) || "{}"); } catch (e) { m = {}; }
    if (m[key]) return false; m[key] = Date.now();
    const keys = Object.keys(m); if (keys.length > 300) keys.slice(0, 100).forEach((k) => delete m[k]);
    localStorage.setItem(SENT_KEY, JSON.stringify(m)); return true;
  }
  async function notifyAdmin(payload) {
    const c = sb(); if (!c) return null;
    const pw = localStorage.getItem("mb_admin_session") || "";
    try {
      const { data, error } = await c.functions.invoke("push", { body: { ...payload, pw_hash: pw } });
      if (error) console.warn("Push:", error.message); return data;
    } catch (e) { console.warn("Push:", e); return null; }
  }
  // Nächster Block: beide Spieler jedes anstehenden Spiels benachrichtigen (je Spiel nur einmal)
  async function notifyUpcoming(state) {
    let next = [];
    try { next = global.MB.getUpcomingMatches(state, { limit: 2 }) || []; } catch (e) { return; }
    for (const m of next) {
      if (!m || !m.homeName || !m.awayName) continue;
      const key = `${(global.MB.getCurrentTournamentId && global.MB.getCurrentTournamentId()) || ""}:match:${m.matchId || m.homeName + "-" + m.awayName}`;
      if (!sentOnce(key)) continue;
      await notifyAdmin({ type: "match", players: [m.homeName, m.awayName], tag: "match", url: "spielplan.html",
        title: "🏈 Gleich bist du dran!", body: `${m.awayName} @ ${m.homeName}${m.time ? ` · ca. ${m.time} Uhr` : ""}${m.stadium ? ` · ${m.stadium}` : ""}` });
    }
  }
  // Offene Tipps im aktuellen Spieltag: jeden Spieler einmal pro Spieltag erinnern
  async function notifyOpenTips(state) {
    try {
      const T = global.MB.Tipp; const tid = global.MB.getCurrentTournamentId && global.MB.getCurrentTournamentId();
      if (!T || !tid) return;
      const days = T.getSpieltage(state) || [];
      const cur = days.find((st) => T.getSpieltagStatus(st) !== "done"); if (!cur) return;
      const sched = T.computeFieldSchedule(state);
      const pickable = cur.matches.filter((m) => !m.finished && T.isMatchPickable(m, sched));
      if (!pickable.length) return;
      const picks = await T.fetchAllPicks(tid);
      const players = Object.keys((state.wettbuero && state.wettbuero.accounts) || {});
      for (const name of players) {
        const open = pickable.filter((m) => !picks.some((p) => p.player_name === name && p.kind === "match" && p.ref_key === m.matchId)).length;
        if (!open) continue;
        if (!sentOnce(`${tid}:tips:${cur.index}:${name}`)) continue;
        await notifyAdmin({ type: "tips", players: [name], tag: "tips", url: "wettbuero.html",
          title: `🎯 ${open} ${open === 1 ? "Tipp" : "Tipps"} offen`, body: `Spieltag ${cur.index} läuft – jetzt noch tippen, bevor die Spiele angepfiffen werden.`, badge: open });
      }
    } catch (e) { console.warn("Tipp-Erinnerung:", e); }
  }
  // VAPID-Schlüsselpaar im Browser erzeugen (Einrichtung)
  async function generateVapidKeys() {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pub = await crypto.subtle.exportKey("raw", k.publicKey); const jwk = await crypto.subtle.exportKey("jwk", k.privateKey);
    return { publicKey: bytesToB64u(pub), privateKey: jwk.d };
  }

  function setBadge(n) {
    try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { /* nicht unterstützt */ }
  }
  global.MB = global.MB || {};
  global.MB.Push = { settingsHint, setBadge, supported, blockedReason, status, enable, disable, updatePrefs, test, relink, register, notifyAdmin, notifyUpcoming, notifyOpenTips, generateVapidKeys, isIOS, isStandalone };
  if (supported()) register();
})(window);
