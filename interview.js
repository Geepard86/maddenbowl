// ============================================================================
// interview.js — Rudi bittet im Dashboard zum Kurz-Interview
// ----------------------------------------------------------------------------
// Regeln (pro Turnier):
//  - jeder Teilnehmer höchstens 1× (Absage = später erneut fragen)
//  - frühestens nach dem 2. eigenen Spiel
//  - immer nur EIN Spieler gleichzeitig wird gefragt
//  - nach einem Interview mindestens 2 weitere Spiele Pause, bis der Nächste dran ist
// Zustand in Supabase app_config "interviews_<turnier-id>":
//  { offer: { player, at, finished } | null, done: { name: { at, ... } },
//    declined: { name: finishedBeiAbsage }, lastDoneFinished }
// Antworten werden gesammelt und fließen ins nächste Power Ranking (Abschnitt
// "Stimmen aus der Mixed Zone"), übrig gebliebene in den Turnier-Abschlussbeitrag.
// ============================================================================
(function (global) {
  const OFFER_TTL_MS = 20 * 60 * 1000;   // unbeantwortete Anfrage verfällt nach 20 Min.
  const GAP_GAMES = 2;                   // Spiele Abstand nach einem Interview
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let busy = false, shownFor = null, current = null;

  // ------------------------------------------------------------ Turnierdaten
  function finishedGames(state) {
    const out = [];
    (state.matches || []).forEach((m) => { if (m.s1 != null && m.s2 != null) { const h = state.players[m.p1], a = state.players[m.p2]; if (h && a) out.push({ at: m.finishedAt || "", h: h.name, a: a.name, hs: m.s1, as: m.s2, po: false }); } });
    (state.playoffMatches || []).forEach((m) => { if (m.s1 != null && m.s2 != null && m.p1 && m.p2 && m.p1.id !== -1 && m.p2.id !== -1) out.push({ at: m.finishedAt || "", h: m.p1.name, a: m.p2.name, hs: m.s1, as: m.s2, po: true }); });
    return out.sort((x, y) => String(x.at).localeCompare(String(y.at)));
  }
  const gamesOf = (fin, name) => fin.filter((g) => g.h === name || g.a === name);
  const view = (g, name) => { const home = g.h === name; return { opp: home ? g.a : g.h, own: home ? g.hs : g.as, other: home ? g.as : g.hs, po: g.po }; };

  // ------------------------------------------------------------ Fragen (2 aus unterschiedlichen Themen)
  function buildQuestions(state, history, name) {
    const fin = finishedGames(state), mine = gamesOf(fin, name).map((g) => view(g, name));
    const w = mine.filter((g) => g.own > g.other).length, l = mine.length - w;
    const last = mine[mine.length - 1];
    const team = ((state.players || []).find((p) => p.name === name) || {}).team;
    const teamName = ((global.MB.nflTeams || []).find((t) => t.id === team) || {}).n;
    const H = (history && history.matches) || [];
    const hist = H.filter((m) => m.homeScore != null && (m.homePlayer === name || m.awayPlayer === name)).map((m) => {
      const home = m.homePlayer === name; return { opp: home ? m.awayPlayer : m.homePlayer, own: home ? m.homeScore : m.awayScore, other: home ? m.awayScore : m.homeScore, season: m.season };
    });
    const titles = (history && history.ringsByPlayer && history.ringsByPlayer.get && (history.ringsByPlayer.get(name) || []).length) || 0;
    const seasons = new Set(hist.map((x) => x.season)).size;
    const Q = [];
    // Letztes Spiel
    if (last) {
      const sc = `${last.own}:${last.other}`;
      if (last.own < last.other) Q.push({ k: "last", w: 5, q: pick([`Gerade das ${sc} gegen ${last.opp}. Was ist da schiefgelaufen?`, `${sc} gegen ${last.opp} – wie sehr ärgert dich das?`, `Ehrliche Frage nach dem ${sc} gegen ${last.opp}: Wer ist schuld – du, das Team oder der Controller?`]) });
      else Q.push({ k: "last", w: 4, q: pick([`Starker Sieg gegen ${last.opp}, ${sc}. Was war der Schlüssel?`, `${sc} gegen ${last.opp} – war das so geplant oder einfach Glück?`, `Nach dem ${sc} gegen ${last.opp}: Wie hoch ist dein Puls gerade?`]) });
    }
    // Turnierbilanz
    Q.push({ k: "form", w: 3, q: w > l ? pick([`Du stehst bei ${w}-${l}. Läuft bei dir, oder?`, `${w}-${l} bisher – bist du der Favorit, oder kommt da noch der große Einbruch?`])
      : w < l ? pick([`${w}-${l} bisher. Was muss sich ändern?`, `Mit ${w}-${l} läuft es noch nicht rund. Wie willst du das Ruder rumreißen?`])
        : `${w}-${l} – ausgeglichener geht's nicht. Wohin geht die Reise?` });
    // Historie / Titel
    if (!seasons) Q.push({ k: "hist", w: 3, q: pick(["Dein erster Altima Bowl – wie fühlt es sich an?", "Als Rookie direkt ins kalte Wasser: Was hast du dir anders vorgestellt?"]) });
    else if (titles) Q.push({ k: "hist", w: 3, q: pick([`Du hast schon ${titles === 1 ? "einen Titel" : titles + " Titel"} geholt. Wird es heute der nächste?`, `${titles === 1 ? "Ein Ring" : titles + " Ringe"} hast du schon. Wird man da nicht irgendwann satt?`]) });
    else Q.push({ k: "hist", w: 3, q: pick([`Schon ${seasons} ${seasons === 1 ? "Saison" : "Saisons"} dabei und noch kein Titel. Ist das dein Jahr?`, "Der erste Ring fehlt noch. Was fehlt dir dafür?"]) });
    // Bitterster Moment
    const worst = hist.filter((x) => x.own < x.other).sort((a, b) => (a.own - a.other) - (b.own - b.other))[0];
    if (worst && worst.other - worst.own >= 14) Q.push({ k: "bitter", w: 2, q: pick([`Wir müssen über das ${worst.own}:${worst.other} gegen ${worst.opp} (${worst.season}) reden. Schläfst du da inzwischen wieder gut?`, `Das ${worst.own}:${worst.other} gegen ${worst.opp} – denkst du da noch manchmal dran?`]) });
    // Persönlicher Rekord
    const best = hist.slice().sort((a, b) => b.own - a.own)[0];
    if (best && best.own >= 30) Q.push({ k: "record", w: 2, q: `Deine ${best.own} Punkte gegen ${best.opp} sind dein persönlicher Rekord. Kannst du das heute toppen?` });
    // Nächster Gegner
    try {
      const up = (global.MB.getUpcomingMatches(state, { limit: 8 }) || []).find((m) => m.homeName === name || m.awayName === name);
      if (up) {
        const opp = up.homeName === name ? up.awayName : up.homeName;
        const h2h = hist.filter((x) => x.opp === opp); const hw = h2h.filter((x) => x.own > x.other).length;
        Q.push({ k: "next", w: 3, q: h2h.length ? `Als Nächstes wartet ${opp}, die Bilanz steht bei ${hw}-${h2h.length - hw}. Was ist der Plan?` : `Als Nächstes geht's gegen ${opp}. Was weißt du über ihn – und was wird er heute über dich lernen?` });
      }
    } catch (e) { /* egal */ }
    // Team & Spaß
    if (teamName) Q.push({ k: "team", w: 1, q: pick([`Warum ausgerechnet die ${teamName}?`, `Was können die ${teamName}, was die anderen Teams nicht können?`]) });
    Q.push({ k: "fun", w: 1, q: pick(["Wer ist für dich heute der Favorit – außer dir selbst?", "Welcher Mitspieler wird heute am meisten jammern?", "Deine Prognose: Wer landet im Toilet Bowl?", "Was gibt's heute als Siegerritual?"]) });
    // 2 Fragen aus verschiedenen Themen, gewichtet
    const chosen = [];
    const pool = Q.slice();
    while (chosen.length < 2 && pool.length) {
      const total = pool.reduce((s, x) => s + x.w, 0); let r = Math.random() * total, i = 0;
      while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
      const q = pool.splice(i, 1)[0];
      if (!chosen.some((c) => c.k === q.k)) chosen.push(q);
    }
    return { questions: chosen.map((c) => c.q), w, l };
  }

  // ------------------------------------------------------------ Zustand
  const key = (tid) => `interviews_${tid}`;
  async function load(tid) { try { const raw = await global.MB.getAppConfig(key(tid)); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }
  async function save(tid, st) { await global.MB.setAppConfig(key(tid), JSON.stringify(st)); }

  // Prüfen, ob der eingeloggte Spieler jetzt gefragt werden soll
  async function check(state, history) {
    if (busy || current) return;
    const me = global.MB.UI && global.MB.UI.currentPlayer && global.MB.UI.currentPlayer();
    const tid = global.MB.getCurrentTournamentId && global.MB.getCurrentTournamentId();
    if (!me || !tid || !state || !(state.players || []).length) return;
    busy = true;
    try {
      const fin = finishedGames(state), finished = fin.length;
      if (gamesOf(fin, me).length < 2) return;
      let st = await load(tid);
      st.done = st.done || {}; st.declined = st.declined || {};
      if (st.done[me]) return;
      if (st.declined[me] != null && finished < st.declined[me] + GAP_GAMES) return;
      const offer = st.offer;
      const offerValid = offer && Date.now() - Date.parse(offer.at) < OFFER_TTL_MS && finished < (offer.finished || 0) + GAP_GAMES;
      if (offerValid && offer.player !== me) return;               // gerade ist jemand anderes dran
      if (!offerValid) {
        if (finished < (st.lastDoneFinished || 0) + GAP_GAMES && st.lastDoneFinished != null) return;  // Pause nach dem letzten Interview
        st.offer = { player: me, at: new Date().toISOString(), finished };
        await save(tid, st);
        st = await load(tid);                                       // gewonnen? (zwei Browser gleichzeitig)
        if (!st.offer || st.offer.player !== me) return;
      }
      if (shownFor === `${tid}:${me}`) return;
      shownFor = `${tid}:${me}`;
      const q = buildQuestions(state, history, me);
      current = { tid, me, finished, ...q, answers: [] };
      showAsk();
    } finally { busy = false; }
  }

  // ------------------------------------------------------------ Oberfläche
  function rudi() {
    try { if (global.MB.DraftStage && global.MB.DraftStage.charSVG) return global.MB.DraftStage.charSVG("commentator"); } catch (e) { /* egal */ }
    return `<div style="font-size:64px;line-height:1;">🎙️</div>`;
  }
  function modal(inner) {
    let ov = document.getElementById("mbInterview");
    if (!ov) {
      ov = document.createElement("div"); ov.id = "mbInterview";
      ov.style.cssText = "position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;padding:12px;";
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div style="width:100%;max-width:460px;background:var(--v2-surface,#13203a);border:1px solid var(--v2-gold,#c99700);border-radius:16px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:10px;"><div style="width:84px;height:84px;flex:0 0 84px;overflow:hidden;border-radius:12px;background:radial-gradient(circle at 50% 30%,#2b3c66,#0b1328);">${rudi()}</div>
      <div><div style="font-weight:900;color:var(--v2-gold,#c99700);letter-spacing:1px;">RUDI · KOMMENTATOR</div><div style="font-size:.78em;opacity:.7;">Live aus der Mixed Zone</div></div></div>
      ${inner}</div>`;
    const svg = ov.querySelector("svg"); if (svg) { svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); }
  }
  function close() { const ov = document.getElementById("mbInterview"); if (ov) ov.remove(); }
  function showAsk() {
    modal(`<p style="margin:0 0 12px;font-size:1.02em;">„Hey ${esc(current.me)}, hast du kurz Zeit für ein Interview? Nur zwei Fragen – versprochen!“</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="v2-btn-ghost" style="width:auto;margin:0;" onclick="MB.Interview.decline()">Gerade nicht</button>
        <button class="v2-btn-primary" style="width:auto;margin:0;" onclick="MB.Interview.start()">Klar!</button></div>`);
  }
  function showQuestion(i) {
    modal(`<div style="font-size:.75em;opacity:.6;margin-bottom:4px;">Frage ${i + 1} von ${current.questions.length}</div>
      <p style="margin:0 0 10px;font-weight:700;">„${esc(current.questions[i])}“</p>
      <textarea id="mbIvAnswer" rows="3" maxlength="280" placeholder="Deine Antwort …" style="width:100%;box-sizing:border-box;"></textarea>
      <div id="mbIvErr" style="font-size:.8em;color:#ff8a8a;min-height:1em;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="v2-btn-ghost" style="width:auto;margin:0;" onclick="MB.Interview.answer(${i}, true)">Kein Kommentar</button>
        <button class="v2-btn-primary" style="width:auto;margin:0;" onclick="MB.Interview.answer(${i}, false)">${i + 1 < current.questions.length ? "Weiter" : "Fertig"}</button></div>`);
    setTimeout(() => { const t = document.getElementById("mbIvAnswer"); if (t) t.focus(); }, 50);
  }
  async function decline() {
    if (!current) return close();
    const st = await load(current.tid); st.declined = st.declined || {};
    st.declined[current.me] = current.finished;
    if (st.offer && st.offer.player === current.me) st.offer = null;   // nächster Spieler darf gefragt werden
    try { await save(current.tid, st); } catch (e) { /* egal */ }
    current = null; close();
  }
  function start() { showQuestion(0); }
  async function answer(i, noComment) {
    const t = document.getElementById("mbIvAnswer");
    const txt = noComment ? "" : String((t && t.value) || "").trim();
    if (!noComment && txt.length < 2) { document.getElementById("mbIvErr").textContent = "Ein paar Worte bitte – oder „Kein Kommentar“."; return; }
    current.answers[i] = txt;
    if (i + 1 < current.questions.length) return showQuestion(i + 1);
    await finish();
  }
  async function finish() {
    const c = current;
    modal(`<p style="margin:0;">Danke, ${esc(c.me)}! Deine Antworten tauchen im nächsten Power Ranking auf. 🎙️</p>`);
    try {
      const st = await load(c.tid); st.done = st.done || {};
      st.done[c.me] = { at: new Date().toISOString(), questions: c.questions, answers: c.answers, record: `${c.w}-${c.l}`, used: false };
      st.offer = null; st.lastDoneFinished = c.finished;
      await save(c.tid, st);
      if (global.MB.UI) global.MB.UI.withAchievements((A) => A.track("interview_done", {}));
    } catch (e) { console.warn("Interview:", e); }
    current = null;
    setTimeout(close, 2200);
  }

  // ------------------------------------------------------------ Admin-Seite: nächsten Interviewpartner bestimmen
  // Wird nach jedem Ergebnis aufgerufen. Reserviert die Anfrage für einen passenden Spieler
  // (der dann per Push eingeladen wird) und liefert dessen Namen – oder null.
  async function adminPick(state) {
    const tid = global.MB.getCurrentTournamentId && global.MB.getCurrentTournamentId();
    if (!tid || !state || !(state.players || []).length) return null;
    const fin = finishedGames(state), finished = fin.length;
    const st = await load(tid); st.done = st.done || {}; st.declined = st.declined || {};
    const offer = st.offer;
    if (offer && Date.now() - Date.parse(offer.at) < OFFER_TTL_MS && finished < (offer.finished || 0) + GAP_GAMES) return null; // läuft noch
    if (st.lastDoneFinished != null && finished < st.lastDoneFinished + GAP_GAMES) return null;                                 // Pause
    const cands = (state.players || []).map((p) => p.name).filter((n) =>
      !st.done[n] && gamesOf(fin, n).length >= 2 && !(st.declined[n] != null && finished < st.declined[n] + GAP_GAMES));
    if (!cands.length) return null;
    // Bevorzugt: wer gerade gespielt hat (frische Eindrücke), sonst zufällig
    const lastGame = fin[fin.length - 1];
    const fresh = cands.filter((n) => lastGame && (lastGame.h === n || lastGame.a === n));
    const who = pick(fresh.length ? fresh : cands);
    st.offer = { player: who, at: new Date().toISOString(), finished, by: "admin" };
    await save(tid, st);
    return who;
  }

  // ------------------------------------------------------------ Verwertung im Blog (Admin-Seite)
  // Liefert bis zu max unverbrauchte Interviews: [{ name, questions, answers, record }]
  async function takeUnused(tid, max) {
    const st = await load(tid); const done = st.done || {};
    return Object.entries(done).filter(([, v]) => !v.used).sort((a, b) => String(a[1].at).localeCompare(String(b[1].at)))
      .slice(0, max || 2).map(([name, v]) => ({ name, questions: v.questions || [], answers: v.answers || [], record: v.record || "" }));
  }
  async function markUsed(tid, names) {
    const st = await load(tid); st.done = st.done || {};
    names.forEach((n) => { if (st.done[n]) st.done[n].used = true; });
    await save(tid, st);
  }
  // Absatz "Stimmen aus der Mixed Zone" (Zitate wörtlich, max. 1 Frage je Spieler, die schönste Antwort)
  function paragraph(list) {
    if (!list || !list.length) return "";
    const lines = list.map((iv) => {
      const k = iv.answers.findIndex((a) => a && a.length > 1);
      if (k < 0) return `${iv.name} wollte gegenüber Rudi lieber nichts sagen – auch eine Aussage.`;
      const q = String(iv.questions[k] || "").replace(/[„“"]/g, "");
      return pick([
        `Rudi wollte von ${iv.name} wissen: „${q}“ Die Antwort: „${iv.answers[k]}“`,
        `${iv.name}${iv.record ? ` (bisher ${iv.record})` : ""} auf die Frage „${q}“: „${iv.answers[k]}“`,
        `„${iv.answers[k]}“ – so antwortete ${iv.name} auf Rudis Frage „${q}“`,
      ]);
    });
    return `🎙️ Stimmen aus der Mixed Zone:\n${lines.join("\n")}`;
  }

  global.MB = global.MB || {};
  global.MB.Interview = { check, decline, start, answer, buildQuestions, takeUnused, markUsed, paragraph, adminPick };
})(window);
