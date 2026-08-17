/* =========================================================================
   MADDEN BOWL — SHARED CORE (shared.js)
   -------------------------------------------------------------------------
   Gemeinsam genutzt von: index.html, wettbuero.html, live.html
   Enthält: Cloud-Sync, Zeit-Engine, Quoten-Engine, Flavour-Facts-Engine,
   Ranking-Engine, generische Helper.

   WICHTIG — Bugfixes gegenüber der alten index.html:
   1) REFRESH-BUG: fetchCloudState() erzwingt jetzt "no-store" + einen
      Cache-Busting-Query-Parameter (?_=timestamp). Vorher wurde beim reinen
      Read-Sync (`syncData()` ohne isUpload) OHNE Cache-Control geladen,
      wodurch Browser/CDN/npoint gelegentlich eine alte Antwort ausgeliefert
      haben — localStorage.clear() konnte das nie beheben, weil das Problem
      im Netzwerk-Layer lag, nicht im LocalStorage.
   2) ZEIT-BUG (Playoffs): computePlayoffTimes() berechnet die Startzeiten
      jetzt sequenziell und überspringt Slots, in denen NUR Bye-Spiele
      liegen (kein echtes Spiel = keine Zeit wird addiert). Spiele der
      nächsten Runde können dadurch nie vor Abschluss der Vorrunde beginnen.
   3) CONTENDER-ROUND-REIHENFOLGE: Lower Bracket (lb1/lb2) läuft jetzt vor
      Upper Semi (us1/us2) — vorher war es umgekehrt (Datenfehler in der
      alten offset-Tabelle: us1/us2 hatte einen kleineren offset als lb1/lb2).
   ========================================================================= */

(function (global) {
  "use strict";

  // ======================================================================
  // CONFIG
  // ======================================================================
  const BIN_ID = "f3d732f4ad334280c483";
  const API_URL = `https://api.npoint.io/${BIN_ID}`;

  const HISTORY_SOURCES = [
    "maddenbowl_2022.json",
    "maddenbowl_2023.json",
    "maddenbowl_2024.json",
    "maddenbowl_2025.json",
    "maddenbowl_2026.json",
  ];

  const nflTeams = [
    { n: "Cardinals", id: "ARI" }, { n: "Falcons", id: "ATL" }, { n: "Ravens", id: "BAL" }, { n: "Bills", id: "BUF" },
    { n: "Panthers", id: "CAR" }, { n: "Bears", id: "CHI" }, { n: "Bengals", id: "CIN" }, { n: "Browns", id: "CLE" },
    { n: "Cowboys", id: "DAL" }, { n: "Broncos", id: "DEN" }, { n: "Lions", id: "DET" }, { n: "Packers", id: "GB" },
    { n: "Texans", id: "HOU" }, { n: "Colts", id: "IND" }, { n: "Jaguars", id: "JAX" }, { n: "Chiefs", id: "KC" },
    { n: "Raiders", id: "LV" }, { n: "Chargers", id: "LAC" }, { n: "Rams", id: "LAR" }, { n: "Dolphins", id: "MIA" },
    { n: "Vikings", id: "MIN" }, { n: "Patriots", id: "NE" }, { n: "Saints", id: "NO" }, { n: "Giants", id: "NYG" },
    { n: "Jets", id: "NYJ" }, { n: "Eagles", id: "PHI" }, { n: "Steelers", id: "PIT" }, { n: "49ers", id: "SF" },
    { n: "Seahawks", id: "SEA" }, { n: "Buccaneers", id: "TB" }, { n: "Titans", id: "TEN" }, { n: "Commanders", id: "WAS" },
  ];

  const maddenRatings = {
    "2026": {
      ARI: 80, ATL: 80, BAL: 87, BUF: 88, CAR: 80, CHI: 84, CIN: 81, CLE: 81,
      DAL: 81, DEN: 91, DET: 87, GB: 83, HOU: 86, IND: 82, JAX: 84, KC: 85,
      LV: 76, LAC: 82, LAR: 89, MIA: 79, MIN: 85, NE: 86, NO: 77, NYG: 78,
      NYJ: 74, PHI: 90, PIT: 84, SF: 84, SEA: 85, TB: 83, TEN: 75, WAS: 79,
    },
  };

  const schedules = {
    8: [ [[0,1],[4,5]], [[2,3],[6,7]], [[1,2],[5,6]], [[3,0],[7,4]], [[0,2],[4,6]], [[1,3],[5,7]], [[0,4],[1,5]], [[2,6],[3,7]], [[5,0],[6,1]], [[7,2],[4,3]] ],
    6: [ [[0,1],[2,3]], [[4,5],[0,2]], [[3,4],[5,0]], [[1,4],[2,5]], [[0,3],[5,1]], [[4,2],[3,5]], [[1,0],[2,4]], [[0,4]] ],
    7: [ [[0,1],[2,3]], [[4,5],[6,0]], [[2,1],[4,3]], [[6,5],[1,3]], [[0,4],[5,2]], [[6,1],[3,5]], [[0,2],[4,6]], [[5,1],[2,6]], [[3,0],[1,4]], [[5,0],[3,6]], [[2,4]] ],
    9: [ [[0,1],[3,4]], [[7,6],[2,0]], [[4,5],[6,8]], [[1,2],[5,3]], [[8,7],[0,3]], [[4,1],[5,2]], [[6,0],[1,7]], [[3,8],[2,6]], [[7,4],[8,5]] ],
    10:[ [[0,1],[5,6]], [[2,3],[7,8]], [[0,4],[5,9]], [[1,2],[6,7]], [[3,4],[8,9]], [[2,0],[7,5]], [[3,1],[8,6]], [[4,2],[9,7]], [[1,4],[6,9]], [[4,5],[9,0]], [[0,5],[1,6]], [[2,7],[3,8]], [[4,9]] ],
  };

  const playoffLabels = {
    ub1: { p1: "Highest Seed", p2: "Bottom Seed" },
    ub2: { p1: "2nd Best Seed", p2: "2nd Bottom Seed" },
    ub3: { p1: "3rd Best Seed", p2: "3rd Bottom Seed" },
    ub4: { p1: "4th Best Seed", p2: "4th Bottom Seed" },
    lb1: { p1: "Best Loser", p2: "Worst Loser" },
    lb2: { p1: "2nd Best Loser", p2: "2nd Worst Loser" },
    us1: { p1: "Highest Seed", p2: "Bottom Seed" },
    us2: { p1: "2nd Best Seed", p2: "2nd Bottom Seed" },
    lb3: { p1: "Upper Semi Loser #2", p2: "Elim. Winner #1" },
    lb4: { p1: "Upper Semi Loser #1", p2: "Elim. Winner #2" },
    uf: { p1: "Upper Semi #1", p2: "Upper Semi #2" },
    ls: { p1: "Lower Semi #1", p2: "Lower Semi #2" },
    lf: { p1: "Upper Final Loser", p2: "Elim. Semi Winner" },
    tb: { p1: "1st Eliminated", p2: "2nd Eliminated" },
    gf: { p1: "Upper Finalist", p2: "Lower Finalist" },
  };

  // Reihenfolge & Gruppierung der Playoff-Slots.
  // FIX (Contender Round): lb1/lb2 (Lower) läuft jetzt VOR us1/us2 (Upper).
  const PLAYOFF_STRUCTURE = [
    { session: "Wildcard", ids: ["ub1", "ub2"] },
    { session: "Wildcard", ids: ["ub3", "ub4"] },
    { session: "Contender Round", ids: ["lb1", "lb2"] }, // Lower zuerst
    { session: "Contender Round", ids: ["us1", "us2"] }, // dann Upper
    { session: "Survival Round", ids: ["lb3", "lb4"] },
    { session: "Finals", ids: ["uf", "ls"] },
    { session: "Judgement Day", ids: ["lf", "tb"] },
    { session: "Madden Bowl", ids: ["gf"] },
  ];

  // ======================================================================
  // CLOUD SYNC  (Bugfix #1: Cache-Busting)
  // ======================================================================
  async function fetchCloudState() {
    const bust = Date.now() + "-" + Math.random().toString(36).slice(2);
    const res = await fetch(`${API_URL}?_=${bust}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
    });
    if (!res.ok) throw new Error("Cloud fetch failed: " + res.status);
    return res.json();
  }

  async function pushCloudState(state) {
    return fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(state),
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
  }

  async function loadHistoryFiles() {
    const seasonData = [];
    for (const url of HISTORY_SOURCES) {
      try {
        const bust = Date.now();
        const res = await fetch(`${url}?_=${bust}`, { cache: "no-store" });
        if (!res.ok) continue;
        seasonData.push(await res.json());
      } catch (e) {
        console.warn("History load failed:", url, e);
      }
    }
    return seasonData.map((x) => x && x.tournament).filter(Boolean);
  }

  // ======================================================================
  // GENERIC HELPERS
  // ======================================================================
  function normName(name) { return (name || "").trim(); }
  function pairKey(a, b) {
    const A = normName(a), B = normName(b);
    return A < B ? `${A}|${B}` : `${B}|${A}`;
  }

  function addMinutes(time, mins) {
    let [h, m] = time.split(":").map(Number);
    let date = new Date();
    date.setHours(h, m + mins);
    return date.getHours().toString().padStart(2, "0") + ":" + date.getMinutes().toString().padStart(2, "0");
  }

  function isByeMatch(match) {
    return !!(match && match.p2 && match.p2.id === -1);
  }

  function isFinished(match) {
    return !!(match && (isByeMatch(match) || (match.s1 !== null && match.s2 !== null)));
  }

  function isGroupPhaseComplete(state) {
    return (state.matches || []).length > 0 && state.matches.every((m) => m.s1 !== null && m.s2 !== null);
  }

  function getPlayoffMatch(state, id) {
    return (state.playoffMatches || []).find((x) => x.id === id) || null;
  }

  function winnerOf(match) {
    if (!match || match.s1 === null || match.s2 === null) return null;
    if (match.p2 && match.p2.id === -1) return match.p1 || null;
    return match.s1 > match.s2 ? match.p1 : match.p2;
  }

  function loserOf(match) {
    if (!match || match.s1 === null || match.s2 === null) return null;
    if (match.p2 && match.p2.id === -1) return null;
    return match.s1 > match.s2 ? match.p2 : match.p1;
  }

  function getLogoHtml(teamId) {
    if (!teamId || teamId === -1) return "";
    return `<img src="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${teamId}.png" class="logo-img">`;
  }

  // ======================================================================
  // ZEIT-ENGINE  (Bugfix #2 + #3)
  // ======================================================================
  // Liefert Minuten-Offsets ab groupEndTime je Match-ID — bye-aware.
  // (dieses Format ist kompatibel zum alten `match.offset`-Feld, damit
  // bestehende Render-Stellen unverändert `addMinutes(groupEndTime, m.offset)`
  // weiterverwenden können)
  function computePlayoffOffsets(state) {
    const dur = (state.config.durP || 0) + (state.config.durB || 0);
    let cursor = 0;
    const byId = {};
    const bySession = [];

    for (const slotDef of PLAYOFF_STRUCTURE) {
      bySession.push({ session: slotDef.session, offset: cursor, ids: slotDef.ids.slice() });
      slotDef.ids.forEach((id) => { byId[id] = cursor; });

      const hasRealMatch = slotDef.ids.some((id) => {
        const m = getPlayoffMatch(state, id);
        return m && m.p1 && m.p2 && m.p1.id !== -1 && m.p2.id !== -1;
      });
      const hasUnknownMatch = slotDef.ids.some((id) => {
        const m = getPlayoffMatch(state, id);
        return !m || !m.p1 || !m.p2;
      });

      if (hasRealMatch || hasUnknownMatch) {
        cursor += dur;
      }
      // sonst: reiner Bye-Slot -> keine Zeit addieren
      // (Bugfix "Wenn Bye, dann keine Uhrzeit addieren")
    }

    return { byId, bySession };
  }

  // Liefert { groupEndTime, byId: { matchId: "HH:MM" }, bySession: [{session, start, ids}] }
  function computePlayoffTimes(state) {
    const dG = (state.config.durG || 0) + (state.config.durB || 0);
    const totalGroupMinutes = (state.slots ? state.slots.length : 0) * dG;
    const groupEndTime = addMinutes(state.config.start, totalGroupMinutes);
    const offsets = computePlayoffOffsets(state);

    const byId = {};
    Object.keys(offsets.byId).forEach((id) => { byId[id] = addMinutes(groupEndTime, offsets.byId[id]); });
    const bySession = offsets.bySession.map((s) => ({ session: s.session, start: addMinutes(groupEndTime, s.offset), ids: s.ids }));

    return { groupEndTime, byId, bySession };
  }

  // Aktualisiert `match.offset` (Minuten ab groupEndTime) direkt auf den
  // playoffMatches-Objekten im state — bye-aware. Nach jedem Aufruf von
  // updatePlayoffLogic()/setScore() aufrufen, damit bestehende Render-Stellen
  // (die weiterhin `addMinutes(groupEndTime, m.offset)` nutzen) automatisch
  // korrekte, Bye-bereinigte Zeiten bekommen.
  function syncPlayoffOffsets(state) {
    const offsets = computePlayoffOffsets(state);
    (state.playoffMatches || []).forEach((m) => {
      if (offsets.byId[m.id] !== undefined) m.offset = offsets.byId[m.id];
    });
  }

  function getGroupMatchTime(state, match) {
    const dG = (state.config.durG || 0) + (state.config.durB || 0);
    const slotIdx = (state.slots || []).findIndex((slot) => slot.some((m) => m.p1 === match.p1 && m.p2 === match.p2));
    if (slotIdx < 0) return state.config.start;
    return addMinutes(state.config.start, slotIdx * dG);
  }

  // ======================================================================
  // HISTORY INDEX
  // ======================================================================
  function buildHistoryIndex(seasons) {
    const history = {
      loaded: false,
      seasons,
      players: new Set(),
      matches: [],
      byPair: new Map(),
      byPlayer: new Map(),
      ringsByPlayer: new Map(),
    };

    for (const t of seasons) {
      const season = t.season;
      const st = Array.isArray(t.standings) ? t.standings : [];
      const champ = st.find((x) => Number(x.rank) === 1);
      const champName = normName(champ && champ.name);
      if (champName) history.ringsByPlayer.set(champName, (history.ringsByPlayer.get(champName) || 0) + 1);

      const teamToPlayer = new Map();
      (t.players || []).forEach((p) => {
        const n = normName(p.name);
        if (!n) return;
        history.players.add(n);
        if (p.team) teamToPlayer.set(p.team, n);
      });

      (t.matches || []).forEach((m) => {
        const homePlayer = teamToPlayer.get(m.homeTeam) || null;
        const awayPlayer = teamToPlayer.get(m.awayTeam) || null;
        if (!homePlayer || !awayPlayer) return;

        const match = {
          season, stage: m.stage, homePlayer, awayPlayer,
          homeTeam: m.homeTeam, awayTeam: m.awayTeam,
          homeScore: m.homeScore, awayScore: m.awayScore,
          total: (m.homeScore ?? 0) + (m.awayScore ?? 0),
          source: "history",
        };
        history.matches.push(match);

        const pk = pairKey(homePlayer, awayPlayer);
        if (!history.byPair.has(pk)) history.byPair.set(pk, []);
        history.byPair.get(pk).push(match);

        for (const pl of [homePlayer, awayPlayer]) {
          if (!history.byPlayer.has(pl)) history.byPlayer.set(pl, []);
          history.byPlayer.get(pl).push(match);
        }
      });
    }

    history.loaded = true;
    return history;
  }

  function getCurrentMatchesNormalized(state) {
    const out = [];
    (state.matches || []).forEach((m) => {
      if (m.s1 === null || m.s2 === null) return;
      const home = state.players[m.p1], away = state.players[m.p2];
      if (!home || !away) return;
      out.push({
        season: Number(state.config.year) || "current", stage: "group",
        homePlayer: home.name, awayPlayer: away.name,
        homeTeam: home.team, awayTeam: away.team,
        homeScore: m.s1, awayScore: m.s2, total: m.s1 + m.s2, source: "current",
      });
    });
    (state.playoffMatches || []).forEach((pm) => {
      if (!pm || !pm.p1 || !pm.p2) return;
      if (pm.p1.id === -1 || pm.p2.id === -1) return;
      if (pm.s1 === null || pm.s2 === null) return;
      out.push({
        season: Number(state.config.year) || "current", stage: "playoff",
        homePlayer: pm.p1.name, awayPlayer: pm.p2.name,
        homeTeam: pm.p1.team, awayTeam: pm.p2.team,
        homeScore: pm.s1, awayScore: pm.s2, total: pm.s1 + pm.s2, source: "current",
      });
    });
    return out;
  }

  function computeMatchupStats(history, state, playerA, playerB) {
    const A = normName(playerA), B = normName(playerB);
    if (!A || !B) return null;
    const pk = pairKey(A, B);
    const histMatches = history.byPair.get(pk) || [];
    const curMatches = getCurrentMatchesNormalized(state).filter((m) => pairKey(m.homePlayer, m.awayPlayer) === pk);
    const all = [...histMatches, ...curMatches];

    const base = {
      games: all.length, aWins: 0, bWins: 0, aPoints: 0, bPoints: 0, totals: [], lastWinners: [],
      playoff: { games: 0, aWins: 0, bWins: 0 },
    };
    const scoreFor = (m, who) => (m.homePlayer === who ? m.homeScore : m.awayPlayer === who ? m.awayScore : 0);

    all.forEach((m) => {
      const aS = scoreFor(m, A), bS = scoreFor(m, B);
      base.aPoints += aS; base.bPoints += bS; base.totals.push(m.total);
      let winner = null;
      if (aS > bS) { base.aWins++; winner = A; } else if (bS > aS) { base.bWins++; winner = B; }
      base.lastWinners.push(winner);
      if (m.stage === "playoff") {
        base.playoff.games++;
        if (winner === A) base.playoff.aWins++;
        if (winner === B) base.playoff.bWins++;
      }
    });

    const curLastWinners = curMatches.map((m) => {
      const aS = scoreFor(m, A), bS = scoreFor(m, B);
      return aS > bS ? A : bS > aS ? B : null;
    }).filter(Boolean);

    return {
      ...base,
      aPPG: base.games ? base.aPoints / base.games : 0,
      bPPG: base.games ? base.bPoints / base.games : 0,
      curGames: curMatches.length,
      curLastWinners: curLastWinners.slice(-3),
    };
  }

  function getPlayerFacts(history, state, name) {
    const n = normName(name);
    const cur = getCurrentMatchesNormalized(state).filter((m) => m.homePlayer === n || m.awayPlayer === n);
    let curGames = 0, curPts = 0, curAllowed = 0, curWins = 0;
    cur.forEach((m) => {
      if (m.homeScore == null || m.awayScore == null) return;
      curGames++;
      const scored = m.homePlayer === n ? m.homeScore : m.awayScore;
      const allowed = m.homePlayer === n ? m.awayScore : m.homeScore;
      curPts += scored; curAllowed += allowed;
      if (scored > allowed) curWins++;
    });
    const histGames = (history.byPlayer.get(n) || []).length;
    return {
      curGames, curWins, curLosses: Math.max(0, curGames - curWins),
      curPPG: curGames ? curPts / curGames : null,
      curAPG: curGames ? curAllowed / curGames : null,
      histGames, ppgEstimate: getPpgEstimate(history, state, n),
    };
  }

  // "Flavour Facts": max. 3 knackige, datenbasierte Fakten zu einem Matchup
  function pickFlavourFacts(history, state, homePlayer, awayPlayer) {
    const H = normName(homePlayer), A = normName(awayPlayer);
    if (!history.loaded || !H || !A) return [];
    const s = computeMatchupStats(history, state, H, A);
    const facts = [];

    if (s && s.games > 0) {
      facts.push(`Direktvergleich: ${H} vs ${A} steht bei ${s.aWins}:${s.bWins} aus ${s.games} Spielen.`);
      if (s.curGames > 0 && s.curLastWinners.length) {
        facts.push(`In diesem Turnier gewann zuletzt ${s.curLastWinners[s.curLastWinners.length - 1]}.`);
      }
      if (s.playoff.games >= 1) {
        facts.push(`Playoff-Bilanz: ${H} vs ${A} ${s.playoff.aWins}:${s.playoff.bWins}.`);
      }
      if (facts.length < 2) {
        const avgTotal = s.totals.length ? s.totals.reduce((x, y) => x + y, 0) / s.totals.length : 0;
        facts.push(`Ø Gesamtpunkte in diesem Duell: ${avgTotal.toFixed(1)}.`);
      }
    } else {
      const h = getPlayerFacts(history, state, H), a = getPlayerFacts(history, state, A);
      if (h.curGames > 0) facts.push(`${H} im Turnier: ${h.curWins}-${h.curLosses}, Ø ${h.curPPG.toFixed(1)} PPG.`);
      if (a.curGames > 0) facts.push(`${A} im Turnier: ${a.curWins}-${a.curLosses}, Ø ${a.curPPG.toFixed(1)} PPG.`);
      if (!facts.length) facts.push("Erstes Duell der beiden — keine Historie vorhanden.");
    }
    return facts.slice(0, 3);
  }

  // ======================================================================
  // QUOTEN-ENGINE (Elo-basiert)
  // ======================================================================
  function computeEloMap(history, state) {
    const elo = new Map();
    const K = 18;
    const ensure = (p) => { if (!elo.has(p)) elo.set(p, 1500); };
    const all = [...history.matches.map((m) => ({ ...m, source: "history" })), ...getCurrentMatchesNormalized(state)];
    const stageOrder = { group: 0, playoff: 1 };
    all.sort((a, b) => Number(a.season) - Number(b.season) || (stageOrder[a.stage] || 0) - (stageOrder[b.stage] || 0));

    const winProb = (ea, eb) => 1 / (1 + Math.pow(10, (eb - ea) / 400));
    all.forEach((m) => {
      const A = m.homePlayer, B = m.awayPlayer;
      ensure(A); ensure(B);
      const aScore = m.homeScore, bScore = m.awayScore;
      if (aScore == null || bScore == null) return;
      const Ea = elo.get(A), Eb = elo.get(B);
      const Pa = winProb(Ea, Eb);
      const Sa = aScore > bScore ? 1 : aScore < bScore ? 0 : 0.5;
      const mov = Math.abs(aScore - bScore);
      const movFactor = 1 + Math.min(0.5, mov / 30);
      const delta = K * movFactor * (Sa - Pa);
      elo.set(A, Ea + delta);
      elo.set(B, Eb - delta);
    });
    return elo;
  }

  function moneylineFromProb(p) {
    if (p <= 0 || p >= 1) return null;
    if (p >= 0.5) return Math.round(-100 * (p / (1 - p)));
    return Math.round(100 * ((1 - p) / p));
  }

  function decimalOdds(p) {
    if (!p || p <= 0) return null;
    return Math.max(1.01, 1 / p).toFixed(2);
  }

  function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
  }

  function getPpgEstimate(history, state, player) {
    const matches = [...(history.byPlayer.get(player) || []), ...getCurrentMatchesNormalized(state).filter((m) => m.homePlayer === player || m.awayPlayer === player)];
    let pts = 0, g = 0;
    matches.forEach((m) => {
      const s = m.homePlayer === player ? m.homeScore : m.awayScore;
      if (s == null) return;
      pts += s; g++;
    });
    if (!g) return 21;
    const raw = pts / g;
    const w = Math.min(0.7, g / 20);
    return raw * w + 21 * (1 - w);
  }

  function computeOddsForMatch(history, state, homePlayer, awayPlayer) {
    const elo = computeEloMap(history, state);
    const Eh = elo.get(homePlayer) ?? 1500;
    const Ea = elo.get(awayPlayer) ?? 1500;
    const homeAdv = 35;
    const pHome = 1 / (1 + Math.pow(10, (Ea - (Eh + homeAdv)) / 400));
    const pAway = 1 - pHome;
    const mlHome = moneylineFromProb(pHome), mlAway = moneylineFromProb(pAway);
    const ppgH = getPpgEstimate(history, state, homePlayer);
    const ppgA = getPpgEstimate(history, state, awayPlayer);
    const mu = ppgH + ppgA;
    const sigma = 13;
    const line = Math.round(mu * 2) / 2;
    const pOver = 1 - normalCdf((line - mu) / sigma);
    return { pHome, pAway, mlHome, mlAway, ouLine: line, pOver, pUnder: 1 - pOver, muTotal: mu };
  }

  function getLiveSeeds(state) {
    const players = [...state.players];
    players.sort((a, b) => {
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      const h2h = (state.matches || []).find((m) => ((m.p1 === a.id && m.p2 === b.id) || (m.p1 === b.id && m.p2 === a.id)) && m.s1 !== null && m.s2 !== null);
      if (h2h) {
        const aS = h2h.p1 === a.id ? h2h.s1 : h2h.s2, bS = h2h.p1 === b.id ? h2h.s1 : h2h.s2;
        if (aS !== bS) return bS - aS;
      }
      return (b.diff || 0) - (a.diff || 0);
    });
    const seedByName = new Map();
    players.forEach((p, i) => seedByName.set(p.name, i + 1));
    return seedByName;
  }

  function seedFactor(seed, n) {
    if (!seed || !n || n < 2) return 1.0;
    const t = (n - seed) / (n - 1);
    return 0.75 + 0.5 * t;
  }
  function teamOVRFactor(state, player) {
    const year = state.config.year || "2026";
    const ovr = (maddenRatings[year] && maddenRatings[year][player.team]) ?? 85;
    return 1 + (ovr - 85) * 0.015;
  }
  function formFactor(player) {
    const played = player.played || 0;
    if (played === 0) return 1.0;
    const winRate = (player.wins || 0) / played;
    const diffPerGame = (player.diff || 0) / played;
    const wr = 0.85 + 0.3 * winRate;
    const df = Math.max(0.85, Math.min(1.15, 1 + diffPerGame * 0.01));
    return wr * df;
  }
  function isInUpperBracket(state, name) {
    return (state.playoffMatches || []).some((m) => m.id && m.id.startsWith("u") && (m.p1?.name === name || m.p2?.name === name) && m.s1 === null);
  }
  function isInLowerBracket(state, name) {
    return (state.playoffMatches || []).some((m) => m.id && (m.id.startsWith("l") || m.id === "ls" || m.id === "lf") && (m.p1?.name === name || m.p2?.name === name) && m.s1 === null);
  }

  function computeTitleOdds(history, state) {
    const elo = computeEloMap(history, state);
    const seedByName = getLiveSeeds(state);
    const n = state.players.length;
    const playoffsStarted = (state.playoffMatches || []).length > 0;
    const weights = {};
    let sum = 0;
    state.players.forEach((p) => {
      const name = p.name;
      let w = Math.max(100, elo.get(name) || 1500);
      const stillAlive = !playoffsStarted || (state.playoffMatches || []).some((m) => (m.p1?.name === name || m.p2?.name === name) && m.s1 === null);
      if (!stillAlive) w *= 0.01;
      const seed = seedByName.get(name) || Math.ceil(n / 2);
      w *= seedFactor(seed, n);
      w *= formFactor(p);
      w *= teamOVRFactor(state, p);
      if (isInUpperBracket(state, name)) w *= 1.2;
      if (isInLowerBracket(state, name)) w *= 0.85;
      weights[name] = w; sum += w;
    });
    const odds = {};
    state.players.forEach((p) => { odds[p.name] = sum ? (weights[p.name] / sum) * 100 : 0; });
    return odds;
  }

  // ======================================================================
  // RANKING-ENGINE  (angepasste Punkteregeln)
  //   - Turniersieger bekommt +100 Punkte Bonus
  //   - Toilet-Bowl-Sieger übernimmt die Punkte des vorletzten Platzes
  //     und belegt selbst den letzten Platz (TB-Verlierer rutscht dafür hoch)
  // ======================================================================
  function computeBaseRanking(state) {
    const n = state.players.length;
    const seedByName = getGroupSeedsFinal(state);
    const stages = [];

    if (isGroupPhaseComplete(state)) {
      const sortedBySeed = [...state.players].sort((a, b) => (seedByName.get(a.name) || 999) - (seedByName.get(b.name) || 999));
      if (n === 9) {
        const cut = sortedBySeed[8];
        if (cut) stages.push({ stage: 0, label: "Group Cut", names: [cut.name] });
      }
      if (n === 10) {
        const names = [sortedBySeed[8]?.name, sortedBySeed[9]?.name].filter(Boolean);
        if (names.length) stages.push({ stage: 0, label: "Group Cut", names });
      }
    }

    const lb1 = getPlayoffMatch(state, "lb1"), lb2 = getPlayoffMatch(state, "lb2");
    const lb3 = getPlayoffMatch(state, "lb3"), lb4 = getPlayoffMatch(state, "lb4");
    const ls = getPlayoffMatch(state, "ls"), lf = getPlayoffMatch(state, "lf"), gf = getPlayoffMatch(state, "gf");

    const elimR1 = [loserOf(lb1)?.name, loserOf(lb2)?.name].filter(Boolean);
    if (elimR1.length) stages.push({ stage: 1, label: "Elim R1", names: elimR1 });
    const elimR2 = [loserOf(lb3)?.name, loserOf(lb4)?.name].filter(Boolean);
    if (elimR2.length) stages.push({ stage: 2, label: "Elim R2", names: elimR2 });
    const elimSemi = loserOf(ls)?.name;
    if (elimSemi) stages.push({ stage: 3, label: "Elim Semi", names: [elimSemi] });
    const elimFinal = loserOf(lf)?.name;
    if (elimFinal) stages.push({ stage: 4, label: "Elim Final", names: [elimFinal] });
    const champ = winnerOf(gf)?.name, runner = loserOf(gf)?.name;
    if (runner) stages.push({ stage: 5, label: "Runner-Up", names: [runner] });
    if (champ) stages.push({ stage: 6, label: "Champion", names: [champ] });

    const seen = new Set(stages.flatMap((s) => s.names));
    state.players.forEach((p) => { if (!seen.has(p.name)) seen.add(p.name); });

    const ordered = [];
    const stageDesc = [...stages].sort((a, b) => b.stage - a.stage);
    stageDesc.forEach((s) => {
      const sortedNames = [...s.names].sort((na, nb) => (seedByName.get(na) || 999) - (seedByName.get(nb) || 999));
      sortedNames.forEach((name) => ordered.push({ name, seed: seedByName.get(name) || null, out: s.label }));
    });

    const missing = state.players.map((p) => p.name).filter((nm) => !ordered.some((x) => x.name === nm))
      .sort((a, b) => (seedByName.get(a) || 999) - (seedByName.get(b) || 999));
    missing.forEach((name) => ordered.push({ name, seed: seedByName.get(name) || null, out: "TBD" }));

    const pointsByName = new Map();
    ordered.forEach((row, idx) => {
      const rank = idx + 1;
      let pts = (n - rank + 1) * 100;
      if (rank === 1 && champ) pts += 100; // Bugfix/Feature: Sieger +100P
      pointsByName.set(row.name, pts);
      row.rank = rank;
      row.points = pts;
    });

    return { ordered, pointsByName };
  }

  function getGroupSeedsFinal(state) {
    const players = [...state.players];
    players.sort((a, b) => {
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      const h2h = (state.matches || []).find((m) => ((m.p1 === a.id && m.p2 === b.id) || (m.p1 === b.id && m.p2 === a.id)) && m.s1 !== null && m.s2 !== null);
      if (h2h) {
        const aS = h2h.p1 === a.id ? h2h.s1 : h2h.s2, bS = h2h.p1 === b.id ? h2h.s1 : h2h.s2;
        if (aS !== bS) return bS - aS;
      }
      return (b.diff || 0) - (a.diff || 0);
    });
    const seedByName = new Map();
    players.forEach((p, i) => seedByName.set(p.name, i + 1));
    return seedByName;
  }

  // Toilet-Bowl-Override: Sieger übernimmt Punkte des vorletzten Platzes und
  // belegt den letzten Platz. Der TB-Verlierer übernimmt dafür die alte
  // Position des TB-Siegers (rutscht entsprechend nach oben).
  function applyToiletBowlOverride(state, base) {
    const tb = getPlayoffMatch(state, "tb");
    if (!tb || tb.s1 === null || tb.s2 === null) return base;
    const tbWinner = winnerOf(tb)?.name, tbLoser = loserOf(tb)?.name;
    if (!tbWinner || !tbLoser) return base;

    const n = state.players.length;
    const rest = base.ordered.filter((r) => r.name !== tbWinner && r.name !== tbLoser);
    const loserRow = base.ordered.find((r) => r.name === tbLoser);
    const winnerRow = base.ordered.find((r) => r.name === tbWinner);
    if (!loserRow || !winnerRow) return base;

    // vorletzter Platz der (rest+loser)-Reihenfolge bevor der Winner ans Ende rutscht
    const preliminary = [...rest, loserRow];
    const secondToLast = preliminary[preliminary.length - 2] || preliminary[preliminary.length - 1];
    const secondToLastPoints = secondToLast ? secondToLast.points : winnerRow.points;

    // Punkte übernehmen (Feature: "Toilet Bowl Sieger übernimmt Punkte vom vorletzten Platz")
    const pointsByName = new Map(base.pointsByName);
    pointsByName.set(tbWinner, secondToLastPoints);
    winnerRow.points = secondToLastPoints;

    const newOrdered = [...rest, loserRow, winnerRow];
    newOrdered.forEach((row, idx) => { row.displayRank = idx + 1; });

    if (newOrdered[newOrdered.length - 1]?.name !== tbWinner) {
      const lastIdx = newOrdered.length - 1;
      const wIdx = newOrdered.findIndex((r) => r.name === tbWinner);
      if (wIdx >= 0) [newOrdered[wIdx], newOrdered[lastIdx]] = [newOrdered[lastIdx], newOrdered[wIdx]];
    }

    return { ...base, ordered: newOrdered, pointsByName, tbWinner, tbLoser };
  }

  function computeFinalRanking(state) {
    const base = computeBaseRanking(state);
    return applyToiletBowlOverride(state, base);
  }

  // ======================================================================
  // WETTBÜRO-ENGINE
  // ======================================================================
  function ensureWettbuero(state) {
    if (!state.wettbuero) {
      state.wettbuero = {
        config: { startCapital: 100, minStake: 5, roundBonus: 10 },
        accounts: {},   // name -> { pin, balance }
        bets: [],       // { id, player, kind:'match'|'season', matchId?, seasonBetType?, pick, stake, oddsSnapshot, settled, won, payout, createdAt }
        settledRounds: [], // Liste bereits ausgezahlter round-bonus "runden" (round key)
      };
    }
    (state.players || []).forEach((p) => {
      if (!state.wettbuero.accounts[p.name]) {
        state.wettbuero.accounts[p.name] = { pin: null, balance: state.wettbuero.config.startCapital };
      }
    });
    return state.wettbuero;
  }

  // Nächste 2 Gruppen-/Playoff-Spiele, an denen `playerName` NICHT beteiligt ist.
  function getBettableMatches(state, playerName) {
    const times = computePlayoffTimes(state);
    const all = [];

    (state.matches || []).forEach((m) => {
      if (isFinished(m)) return;
      const p1 = state.players[m.p1], p2 = state.players[m.p2];
      if (!p1 || !p2) return;
      if (p1.name === playerName || p2.name === playerName) return;
      all.push({
        kind: "match", matchId: `g-${state.matches.indexOf(m)}`,
        homeName: p1.name, awayName: p2.name, homeTeam: p1.team, awayTeam: p2.team,
        time: getGroupMatchTime(state, m),
      });
    });

    (state.playoffMatches || []).forEach((m) => {
      if (isFinished(m) || !m.p1 || !m.p2 || m.p2.id === -1) return;
      if (m.p1.name === playerName || m.p2.name === playerName) return;
      all.push({
        kind: "match", matchId: `p-${m.id}`,
        homeName: m.p1.name, awayName: m.p2.name, homeTeam: m.p1.team, awayTeam: m.p2.team,
        time: times.byId[m.id] || times.groupEndTime, phase: m.phase,
      });
    });

    all.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
    return all.slice(0, 2);
  }

  function placeBet(state, playerName, bet) {
    const wb = ensureWettbuero(state);
    const acc = wb.accounts[playerName];
    if (!acc) throw new Error("Unbekannter Spieler");
    if (bet.stake < wb.config.minStake) throw new Error(`Mindesteinsatz: ${wb.config.minStake}`);
    if (bet.stake > acc.balance) throw new Error("Nicht genug Kapital");
    acc.balance -= bet.stake;
    const rec = {
      id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      player: playerName, settled: false, won: null, payout: 0, createdAt: Date.now(),
      ...bet,
    };
    wb.bets.push(rec);
    return rec;
  }

  // Settlement für ein beendetes Match (matchId im Format "g-<idx>" oder "p-<id>")
  function settleMatchBets(state, matchId, winnerName) {
    const wb = ensureWettbuero(state);
    wb.bets.forEach((b) => {
      if (b.settled || b.kind !== "match" || b.matchId !== matchId) return;
      b.settled = true;
      b.won = b.pick === winnerName;
      if (b.won) {
        b.payout = Math.round(b.stake * (b.oddsSnapshot || 2) * 100) / 100;
        wb.accounts[b.player].balance += b.payout;
      } else {
        b.payout = 0;
      }
    });
  }

  // Settlement für Saison-Wetten (Sieger / Zweiter / Toilet Bowl Sieger etc.)
  function settleSeasonBets(state) {
    const wb = ensureWettbuero(state);
    const final = computeFinalRanking(state);
    const champion = final.ordered.find((r) => r.rank === 1 || r.displayRank === 1 && !final.tbWinner)?.name
      || final.ordered[0]?.name;
    const runnerUp = final.ordered[1]?.name;
    const toiletBowlWinner = final.tbWinner;

    const resultByType = { champion, runnerUp, toiletBowlWinner };

    wb.bets.forEach((b) => {
      if (b.settled || b.kind !== "season") return;
      const actual = resultByType[b.seasonBetType];
      if (!actual) return; // noch nicht final
      b.settled = true;
      b.won = b.pick === actual;
      b.payout = b.won ? Math.round(b.stake * (b.oddsSnapshot || 3) * 100) / 100 : 0;
      if (b.won) wb.accounts[b.player].balance += b.payout;
    });
  }

  function grantRoundBonus(state, roundKey) {
    const wb = ensureWettbuero(state);
    if (wb.settledRounds.includes(roundKey)) return;
    wb.settledRounds.push(roundKey);
    Object.values(wb.accounts).forEach((acc) => { acc.balance += wb.config.roundBonus; });
  }

  function getWettbuergerLeaderboard(state) {
    const wb = ensureWettbuero(state);
    return Object.entries(wb.accounts)
      .map(([name, acc]) => ({ name, balance: Math.round(acc.balance * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance);
  }

  // ======================================================================
  // EXPORT
  // ======================================================================
  global.MB = {
    BIN_ID, API_URL, HISTORY_SOURCES, nflTeams, maddenRatings, schedules, playoffLabels, PLAYOFF_STRUCTURE,
    fetchCloudState, pushCloudState, loadHistoryFiles, buildHistoryIndex,
    normName, pairKey, addMinutes, isByeMatch, isFinished, isGroupPhaseComplete,
    getPlayoffMatch, winnerOf, loserOf, getLogoHtml,
    computePlayoffTimes, computePlayoffOffsets, syncPlayoffOffsets, getGroupMatchTime,
    getCurrentMatchesNormalized, computeMatchupStats, getPlayerFacts, pickFlavourFacts,
    computeEloMap, moneylineFromProb, decimalOdds, computeOddsForMatch, computeTitleOdds, getLiveSeeds,
    normalCdf, getPpgEstimate, seedFactor, teamOVRFactor, formFactor,
    computeBaseRanking, getGroupSeedsFinal, applyToiletBowlOverride, computeFinalRanking,
    ensureWettbuero, getBettableMatches, placeBet, settleMatchBets, settleSeasonBets, grantRoundBonus, getWettbuergerLeaderboard,
  };
})(window);
