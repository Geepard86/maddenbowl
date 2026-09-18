/* =========================================================================
   MADDEN BOWL — TIPPSPIEL (tipp.js)
   -------------------------------------------------------------------------
   Ersetzt das alte Kapital-/Einsatz-Wettbüro durch ein klassisches
   Tippspiel ohne virtuelle Währung:

   - Gesamt-Tipps (Sieger/Zweiter/Toilet-Bowl-Sieger + Tiebreaker) — offen
     von Turnierstart bis der letzte Spieler sein erstes Spiel hatte.
   - Spieltag-Tipps: alle 4 Spiele (Gruppe + Playoff durchgezählt) bilden
     einen "Spieltag". Pro Spieltag: Sieger-Tipp für jedes Spiel (auch die
     eigenen — hier wird nicht gegeneinander gewettet, sondern nur
     vorhergesagt) + ein Over/Under-Tipp auf die Gesamtpunktzahl des
     gesamten Spieltags.
   - Punkte: Sieger-Tipp 1P, Over/Under-Tipp 2P, Season-Champion 5P,
     Season-Zweiter/Toilet-Bowl je 3P. Tiebreaker (geschätzte Gesamtpunkt-
     zahl des Finales) entscheidet nur bei Punktegleichstand.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   ========================================================================= */

(function (global) {
  "use strict";

  const SPIELTAG_SIZE = 4;
  const LOCK_BUFFER_MINUTES = 5; // Tipp-Sperre: 5 Min. nachdem das Ergebnis des vorherigen Spiels auf demselben Feld eingetragen wurde
  const POINTS = { match: 1, overunder: 2, champion: 5, runnerUp: 3, toiletBowlWinner: 3 };

  // "HH:MM" -> Date von HEUTE mit dieser Uhrzeit (gleiche Konvention wie
  // MB.addMinutes — geht von einem Turnier an einem Abend aus, kein
  // Tag-Übertrag über Mitternacht).
  function timeStrToDate(timeStr) {
    const [h, m] = String(timeStr).split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // ======================================================================
  // MATCH-HELPER — vereinheitlicht Gruppen-/Playoff-Spiele auf dieselbe Form
  // ======================================================================
  // `field` (1 oder 2) = welcher der beiden parallelen Fernseher/Konsolen
  // dieses Spiel spielt — dieselbe Zuordnung wie in shared.js
  // (getUpcomingMatches): innerhalb eines Gruppen-Slots slot[0] -> Feld 1,
  // slot[1] -> Feld 2; bei Playoff-Spielen einfach nach Array-Index parität.
  function getMatchInfo(state, matchId) {
    if (matchId.startsWith("g-")) {
      const idx = parseInt(matchId.slice(2), 10);
      const m = state.matches && state.matches[idx];
      if (!m) return null;
      const p1 = state.players[m.p1], p2 = state.players[m.p2];
      if (!p1 || !p2) return null;
      const slot = (state.slots || []).find((s) => s.includes(m));
      const field = slot ? (slot.indexOf(m) === 0 ? 1 : 2) : 1;
      return { matchId, homeName: p1.name, awayName: p2.name, s1: m.s1, s2: m.s2, finished: m.s1 != null && m.s2 != null, finishedAt: m.finishedAt || null, field };
    }
    if (matchId.startsWith("p-")) {
      const id = matchId.slice(2);
      const m = MB.getPlayoffMatch(state, id);
      if (!m || !m.p1 || !m.p2 || m.p1.id === -1 || m.p2.id === -1) return null;
      const idx = (state.playoffMatches || []).indexOf(m);
      const field = (idx % 2 === 0) ? 1 : 2;
      return { matchId, homeName: m.p1.name, awayName: m.p2.name, s1: m.s1, s2: m.s2, finished: m.s1 != null && m.s2 != null, finishedAt: m.finishedAt || null, field };
    }
    return null;
  }

  function getMatchSequence(state) {
    const seq = [];
    (state.matches || []).forEach((m, idx) => {
      const info = getMatchInfo(state, `g-${idx}`);
      if (info) seq.push(info);
    });
    (state.playoffMatches || []).forEach((m) => {
      if (!m.id || MB.isByeMatch(m)) return;
      const info = getMatchInfo(state, `p-${m.id}`);
      if (info) seq.push(info);
    });
    return seq;
  }

  function getSpieltage(state, size) {
    const seq = getMatchSequence(state);
    const spieltage = [];
    for (let i = 0; i < seq.length; i += (size || SPIELTAG_SIZE)) {
      spieltage.push({ index: spieltage.length + 1, matches: seq.slice(i, i + (size || SPIELTAG_SIZE)) });
    }
    return spieltage;
  }

  // ======================================================================
  // ZEIT-/SPERR-ENGINE — feste Kickoff-Uhrzeiten passen erfahrungsgemäß
  // nicht (Spiele dauern mal länger, mal kürzer). Stattdessen: ein Spiel
  // "beginnt" auf einem Feld praktisch erst, wenn das Ergebnis des
  // VORHERIGEN Spiels auf demselben Feld eingetragen wurde — das ist der
  // einzige verlässliche Zeitpunkt, den wir haben. Gesperrt wird jeweils
  // LOCK_BUFFER_MINUTES danach. Für das jeweils ERSTE Spiel eines Feldes
  // gibt's noch kein "vorheriges Ergebnis" — dafür wird ersatzweise die
  // angekündigte Turnier-Startzeit als grobe Schätzung verwendet.
  // Liefert eine Map matchId -> { anchorDate, anchorIsReal, lockDate }.
  function computeFieldSchedule(state) {
    const seq = getMatchSequence(state);
    const byField = { 1: [], 2: [] };
    seq.forEach((info) => byField[info.field].push(info));

    const schedule = new Map();
    [1, 2].forEach((field) => {
      let anchor = timeStrToDate(state.config.start);
      let anchorIsReal = false; // erstes Spiel je Feld: nur eine Schätzung
      byField[field].forEach((info) => {
        const lockDate = anchor ? new Date(anchor.getTime() + LOCK_BUFFER_MINUTES * 60000) : null;
        schedule.set(info.matchId, { anchorDate: anchor, anchorIsReal, lockDate });

        if (info.finishedAt) {
          anchor = new Date(info.finishedAt);
          anchorIsReal = true;
        } else {
          // Dieses Spiel hat noch kein Ergebnis -> für alles Weitere auf
          // diesem Feld ist der nächste Ankerzeitpunkt noch unbekannt.
          anchor = null;
          anchorIsReal = false;
        }
      });
    });
    return schedule;
  }

  function isMatchPickable(matchInfo, schedule) {
    if (!matchInfo || matchInfo.finished) return false;
    const entry = schedule.get(matchInfo.matchId);
    if (!entry || !entry.lockDate) return true; // Sperrzeitpunkt noch nicht bekannt -> offen
    return new Date() < entry.lockDate;
  }

  function formatLockTime(matchInfo, schedule) {
    const entry = schedule.get(matchInfo.matchId);
    if (!entry || !entry.lockDate) {
      return `sperrt 5 Min., nachdem das vorherige Spiel auf Feld ${matchInfo.field} eingetragen wurde`;
    }
    const hhmm = entry.lockDate.getHours().toString().padStart(2, "0") + ":" + entry.lockDate.getMinutes().toString().padStart(2, "0");
    return entry.anchorIsReal ? `sperrt um ${hhmm} Uhr` : `sperrt ca. ${hhmm} Uhr (geschätzt, Turnierstart)`;
  }

  // Over/Under gilt für den ganzen Spieltag -> sperrt zusammen mit dem
  // Spiel, das als Erstes in diesem Block "sperrt" (gleiche Logik wie bei
  // den Einzel-Tipps, nur je Spieltag der früheste lockDate-Wert).
  function isSpieltagOuPickable(spieltag, schedule) {
    const lockDates = spieltag.matches
      .map((m) => schedule.get(m.matchId))
      .filter((e) => e && e.lockDate)
      .map((e) => e.lockDate.getTime());
    if (!lockDates.length) return true; // noch kein Spiel dieses Blocks hat einen bekannten Sperrzeitpunkt
    return new Date().getTime() < Math.min(...lockDates);
  }

  function formatSpieltagOuLockTime(spieltag, schedule) {
    const entries = spieltag.matches.map((m) => schedule.get(m.matchId)).filter((e) => e && e.lockDate);
    if (!entries.length) return "sperrt, sobald das erste Spiel dieses Spieltags eingetragen wurde";
    const earliest = entries.reduce((min, e) => (e.lockDate < min.lockDate ? e : min), entries[0]);
    const hhmm = earliest.lockDate.getHours().toString().padStart(2, "0") + ":" + earliest.lockDate.getMinutes().toString().padStart(2, "0");
    return earliest.anchorIsReal ? `sperrt um ${hhmm} Uhr` : `sperrt ca. ${hhmm} Uhr (geschätzt)`;
  }

  // 'done' = alle Spiele im Block fertig -> ausgewertet, sonst 'active'
  // (einzelne Spiele/O-U können innerhalb eines 'active'-Spieltags jeweils
  // schon einzeln gesperrt sein — siehe isMatchPickable/isSpieltagOuPickable).
  function getSpieltagStatus(spieltag) {
    if (!spieltag.matches.length) return "active";
    return spieltag.matches.every((m) => m.finished) ? "done" : "active";
  }

  // Der erste noch nicht abgeschlossene Spieltag.
  function getCurrentSpieltag(state, size) {
    const spieltage = getSpieltage(state, size);
    return spieltage.find((s) => getSpieltagStatus(s) !== "done") || null;
  }

  // ======================================================================
  // GESAMT-TIPPS: Fenster offen bis JEDER Spieler mind. 1 Spiel hatte
  // ======================================================================
  function seasonPicksOpen(state) {
    if (!state.players || !state.players.length) return true;
    const played = new Set();
    MB.getCurrentMatchesNormalized(state).forEach((m) => { played.add(m.homePlayer); played.add(m.awayPlayer); });
    return !state.players.every((p) => played.has(p.name));
  }

  // Zeigt VORAB, wann das Gesamt-Tipps-Fenster voraussichtlich schließt:
  // sobald der Spieler mit dem spätesten ersten Spiel dieses gespielt hat.
  // Da wir Kickoff-Zeiten nur noch schätzen (siehe computeFieldSchedule),
  // ist das eine Schätzung, keine Garantie — wird als "ca." gekennzeichnet,
  // solange kein Spiel auf dem jeweiligen Feld schon real gestartet ist.
  function seasonLockPreview(state, schedule) {
    if (!state.players || !state.players.length) return null;
    const played = new Set();
    MB.getCurrentMatchesNormalized(state).forEach((m) => { played.add(m.homePlayer); played.add(m.awayPlayer); });
    const pending = state.players.filter((p) => !played.has(p.name));
    if (!pending.length) return null; // Fenster ist schon zu (oder alle haben gespielt)

    const seq = getMatchSequence(state);
    let latest = null;
    pending.forEach((p) => {
      const nextMatch = seq.find((m) => !m.finished && (m.homeName === p.name || m.awayName === p.name));
      if (!nextMatch) return;
      const entry = schedule.get(nextMatch.matchId);
      if (!entry || !entry.anchorDate) return;
      if (!latest || entry.anchorDate > latest.anchorDate) {
        latest = { player: p.name, anchorDate: entry.anchorDate, anchorIsReal: entry.anchorIsReal };
      }
    });
    return latest;
  }

  function resolveSeasonOutcome(state) {
    const gf = MB.getPlayoffMatch(state, "gf");
    const champion = gf ? (MB.winnerOf(gf)?.name || null) : null;
    const runnerUp = gf ? (MB.loserOf(gf)?.name || null) : null;
    const tb = MB.getPlayoffMatch(state, "tb");
    const toiletBowlWinner = tb ? (MB.winnerOf(tb)?.name || null) : null;
    return { champion, runnerUp, toiletBowlWinner };
  }

  // ======================================================================
  // SUPABASE
  // ======================================================================
  async function savePick(tournamentId, playerName, kind, refKey, pick) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) throw new Error("Kein aktives Turnier.");
    const { error } = await sb.from("tipp_picks")
      .upsert({ tournament_id: tournamentId, player_name: playerName, kind, ref_key: refKey, pick: String(pick) },
              { onConflict: "tournament_id,player_name,kind,ref_key" });
    if (error) throw error;
  }

  async function fetchPicksForPlayer(tournamentId, playerName) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return [];
    const { data, error } = await sb.from("tipp_picks").select("*")
      .eq("tournament_id", tournamentId).eq("player_name", playerName);
    if (error) { console.warn(error); return []; }
    return data || [];
  }

  async function fetchAllPicks(tournamentId) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return [];
    const { data, error } = await sb.from("tipp_picks").select("*").eq("tournament_id", tournamentId);
    if (error) { console.warn(error); return []; }
    return data || [];
  }

  async function fetchAllOuLines(tournamentId) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return {};
    const { data, error } = await sb.from("tipp_ou_lines").select("*").eq("tournament_id", tournamentId);
    if (error) { console.warn(error); return {}; }
    const map = {};
    (data || []).forEach((r) => { map[r.spieltag_index] = Number(r.line); });
    return map;
  }

  // Legt beim ersten Aufruf für einen Spieltag eine Over/Under-Linie fest
  // (Ø Gesamtpunktzahl bisheriger Spiele × Spiele in diesem Spieltag,
  // gerundet auf 5er) — danach eingefroren, damit sie fair bleibt.
  async function ensureOuLine(tournamentId, spieltag, state, history) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return null;
    const { data } = await sb.from("tipp_ou_lines").select("line")
      .eq("tournament_id", tournamentId).eq("spieltag_index", spieltag.index).maybeSingle();
    if (data) return Number(data.line);

    const allMatches = [...(history?.matches || []), ...MB.getCurrentMatchesNormalized(state)];
    const totals = allMatches.map((m) => (m.homeScore ?? m.s1 ?? 0) + (m.awayScore ?? m.s2 ?? 0)).filter((t) => t > 0);
    const avgPerGame = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 45;
    const line = Math.round((avgPerGame * spieltag.matches.length) / 5) * 5;

    const { error } = await sb.from("tipp_ou_lines")
      .upsert({ tournament_id: tournamentId, spieltag_index: spieltag.index, line });
    if (error) console.warn("O/U-Linie konnte nicht gespeichert werden:", error);
    return line;
  }

  // ======================================================================
  // PUNKTEBERECHNUNG / TIPPSTAND
  // ======================================================================
  function computeTippStandings(state, allPicks, ouLines) {
    const points = {};
    (state.players || []).forEach((p) => { points[p.name] = 0; });

    const outcome = resolveSeasonOutcome(state);
    const spieltage = getSpieltage(state);
    const matchByKey = new Map(getMatchSequence(state).map((m) => [m.matchId, m]));
    const tiebreakGuesses = {};

    allPicks.forEach((pick) => {
      if (!(pick.player_name in points)) points[pick.player_name] = 0;

      if (pick.kind === "season") {
        const actual = outcome[pick.ref_key];
        if (actual && pick.pick === actual) points[pick.player_name] += POINTS[pick.ref_key] || 0;
      } else if (pick.kind === "match") {
        const info = matchByKey.get(pick.ref_key);
        if (info && info.finished) {
          const winner = info.s1 > info.s2 ? info.homeName : info.awayName;
          if (pick.pick === winner) points[pick.player_name] += POINTS.match;
        }
      } else if (pick.kind === "overunder") {
        const idx = parseInt(String(pick.ref_key).replace("spieltag-", ""), 10);
        const st = spieltage[idx - 1];
        const line = ouLines[idx];
        if (st && line != null && getSpieltagStatus(st) === "done") {
          const total = st.matches.reduce((sum, m) => sum + m.s1 + m.s2, 0);
          const actual = total > line ? "over" : total < line ? "under" : null;
          if (actual && pick.pick === actual) points[pick.player_name] += POINTS.overunder;
        }
      } else if (pick.kind === "tiebreaker") {
        tiebreakGuesses[pick.player_name] = parseInt(pick.pick, 10);
      }
    });

    const gf = MB.getPlayoffMatch(state, "gf");
    const gfFinished = gf && gf.s1 != null && gf.s2 != null;
    const gfTotal = gfFinished ? gf.s1 + gf.s2 : null;

    const rows = Object.entries(points).map(([name, pts]) => ({
      name, points: pts,
      tiebreakGuess: tiebreakGuesses[name] ?? null,
      tiebreakDiff: (gfFinished && tiebreakGuesses[name] != null) ? Math.abs(tiebreakGuesses[name] - gfTotal) : null,
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (a.tiebreakDiff == null && b.tiebreakDiff == null) return 0;
      if (a.tiebreakDiff == null) return 1;
      if (b.tiebreakDiff == null) return -1;
      return a.tiebreakDiff - b.tiebreakDiff;
    });

    return rows;
  }

  global.MB = global.MB || {};
  global.MB.Tipp = {
    SPIELTAG_SIZE, LOCK_BUFFER_MINUTES, POINTS,
    getMatchInfo, getMatchSequence, getSpieltage, getSpieltagStatus, getCurrentSpieltag,
    computeFieldSchedule, isMatchPickable, isSpieltagOuPickable, formatLockTime, formatSpieltagOuLockTime,
    seasonPicksOpen, seasonLockPreview, resolveSeasonOutcome,
    savePick, fetchPicksForPlayer, fetchAllPicks, fetchAllOuLines, ensureOuLine,
    computeTippStandings,
  };
})(window);
