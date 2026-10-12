/* =========================================================================
   TURNIER-REPLAY (Testlauf mit echten Daten)
   -------------------------------------------------------------------------
   Spielt ein bereits abgeschlossenes Turnier (typischerweise das letzte in der
   Datenbank) Spiel für Spiel nach, so wie es live abgelaufen wäre, und
   sammelt dabei
     * ALLE gesprochenen Texte (Kommentator, Moderation, Ring-Ansager):
       Draft-Eröffnung, Ring-Vorstellungen, Team-Pick-Kommentare,
       Ergebnis- + Vorschau-Ansagen je Spiel, Song-Anmoderationen
     * ALLE automatisch erzeugten Blog-Beiträge: Kickoff, Rekorde,
       Finale/Champion, Power Rankings, Spielerporträts, Song-Beiträge,
       Abschluss-Artikel
   Alles läuft lokal: keine TTS-, Music- oder Datenbank-Schreibzugriffe.

   API: MB.Replay.run({ state, history, year }) -> { announcer: string, blog: string, stats }
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};

  const strip = (s) => String(s == null ? "" : s).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  // Kopie + Tabellen-Neuberechnung kommen aus shared.js (MB.cloneStateDeep / MB.recomputeStandings)
  function cloneState(src) {
    const c = global.MB.cloneStateDeep(src);
    // Zeitplan-Felder absichern (ältere/archivierte Turniere haben sie teils nicht) — die Vorschau braucht sie
    c.config = { start: "18:00", durG: 15, durP: 20, durB: 5, ...c.config };
    c.songs = {};
    return c;
  }
  const recomputeStandings = (st) => global.MB.recomputeStandings(st);

  function run({ state: srcState, history, year }) {
    const MB = global.MB, A = MB.Announcer, B = MB.Blog, R = MB.Records, Mu = MB.Music;
    const names = A.getSpeakerNames();
    const out = [];      // Ansagen-Transkript
    const blog = [];     // Blog-Artikel als Text
    const stats = { announcements: 0, articles: 0, matches: 0 };

    const roleName = (role) => (role === "announcer" ? names.announcer : role === "moderator" ? names.moderator : names.commentator);
    const say = (role, text) => { out.push(`[${roleName(role)}] ${A.sanitizeForSpeech(text)}`); stats.announcements++; };
    const heading = (title) => { out.push(""); out.push("=".repeat(72)); out.push(title); out.push("=".repeat(72)); };
    const note = (text) => out.push(`   (${text})`);
    const article = (a, when) => {
      if (!a) return;
      stats.articles++;
      blog.push("", "=".repeat(72), `${a.title || "(ohne Titel)"}`, `   Art: ${a.kind || "?"}  ·  erschienen: ${when}`, "=".repeat(72), strip(a.body));
    };

    const final = cloneState(srcState);
    const work = cloneState(srcState);
    // alle Ergebnisse zurücksetzen, die Originalwerte merken wir uns
    const groupOrig = work.matches.map((m) => ({ s1: m.s1, s2: m.s2 }));
    work.matches.forEach((m) => { m.s1 = null; m.s2 = null; });
    const poOrig = work.playoffMatches.map((m) => ({ s1: m.s1, s2: m.s2 }));
    work.playoffMatches.forEach((m) => { m.s1 = null; m.s2 = null; });
    // Playoff-Paarungen sind im gespeicherten Endstand komplett belegt. Live stünden sie erst fest, wenn die
    // jeweils vorherigen Spiele der beiden Beteiligten gespielt sind (Gruppenphase bei Erstrunden-Spielen) —
    // deshalb erst dann einsetzen (sonst würden z.B. "Finale steht fest"-Momente zu früh auslösen).
    const finalPO = work.playoffMatches.map((m) => ({ p1: m.p1, p2: m.p2 }));
    work.playoffMatches.forEach((m) => { m.p1 = null; m.p2 = null; });
    const replayedPO = new Set();
    const involves = (fm, pid) => (fm.p1 && fm.p1.id === pid) || (fm.p2 && fm.p2.id === pid);
    function revealPlayoffs() {
      const groupComplete = MB.isGroupPhaseComplete(work);
      let changed = true;
      while (changed) {
        changed = false;
        work.playoffMatches.forEach((m, k) => {
          if (m.p1 || m.p2) return;
          const f = finalPO[k]; if (!f.p1 && !f.p2) return;
          const ready = (pl) => {
            if (!pl || pl.id === -1) return true;
            let last = -1; for (let j = 0; j < k; j++) if (involves(finalPO[j], pl.id)) last = j;
            return last < 0 ? groupComplete : replayedPO.has(last);
          };
          if (ready(f.p1) && ready(f.p2)) {
            m.p1 = f.p1; m.p2 = f.p2; changed = true;
            if ((f.p1 && f.p1.id === -1) || (f.p2 && f.p2.id === -1)) replayedPO.add(k); // Freilos zählt als "gespielt"
          }
        });
      }
    }
    recomputeStandings(work);

    // ---------- Kopf ----------
    const playerNames = work.players.map((p) => p.name);
    out.push("ALTIMA BOWL — ANSAGEN-TESTLAUF MIT ECHTEM TURNIERVERLAUF");
    out.push(`Turnier: ${year != null ? year : "?"} (letztes abgeschlossenes Turnier in der Datenbank), ${playerNames.length} Spieler: ${playerNames.join(", ")}`);
    out.push(`Erzeugt am ${new Date().toLocaleString("de-DE")}`);
    out.push(`Sprecher: Kommentator = ${names.commentator}, Moderator = ${names.moderator}, Ring-Ansager = ${names.announcer}`);
    out.push("Hinweis: rein lokaler Nachspiel-Lauf (keine TTS-/Music-Aufrufe). Formulierungen variieren bei jedem Lauf (Zufallsauswahl).");
    out.push("Anpfiff-Uhrzeiten in den Vorschauen stammen aus dem Standard-Zeitplan des Turniers und sind im Nachspiel nur ungefähr aussagekräftig (echte Verzögerungen kennt der Lauf nicht).");
    out.push("Historie = alle Saisons VOR diesem Turnier. Playoff-Paarungen werden erst eingesetzt, wenn sie live feststünden.");
    blog.push("ALTIMA BOWL — BLOG-TESTLAUF MIT ECHTEM TURNIERVERLAUF");
    blog.push(`Turnier: ${year != null ? year : "?"}, ${playerNames.length} Spieler. Erzeugt am ${new Date().toLocaleString("de-DE")}`);
    blog.push("So wären die automatischen Beiträge nach und nach erschienen (Rekord-Beiträge ohne Meme-Bilder; manuelle ✨-Spurious-Correlations nicht enthalten).");

    // ---------- Draft / Eröffnung ----------
    try { A.setNicknames(work.config.nicknames || {}); } catch (e) { /* optional */ }
    heading("1. DRAFT-ERÖFFNUNG + RING-VORSTELLUNGEN + TEAM-PICKS");
    try {
      A.getTournamentStartSegments({ athleteNames: playerNames, context: "draft" }).forEach((s) => say(s.role, s.text));
      const order = (MB.computeDraftOrder(history, playerNames) || []).map((e) => (typeof e === "string" ? e : e.name)).filter(Boolean);
      const draftNames = order.length ? order : playerNames;
      note(`Draft-Reihenfolge (aus der Historie berechnet, live wird sie ggf. von Hand angepasst): ${draftNames.join(" → ")}`);
      const badgeMap = MB.computeRingIntroBadges(history, draftNames);
      const titleHistory = MB.computeTeamTitleHistory(history);
      let toggle = 0;
      draftNames.forEach((name, i) => {
        const badge = badgeMap.get(String(name).trim().toLowerCase()) || { name };
        say("announcer", A.buildRingIntroLine(Object.assign({ name }, badge), { isFirstPick: i === 0, isLastPick: i === draftNames.length - 1 }));
        const p = work.players.find((x) => x.name === name);
        if (p && p.team) {
          const teamMeta = MB.nflTeams.find((t) => t.n === p.team);
          const teamId = teamMeta ? teamMeta.id : null;
          const sched = (MB.schedules || {})[work.players.length];
          const oppNames = [];
          if (sched) sched.forEach((round) => round.forEach((m) => { if (m[0] === p.id || m[1] === p.id) { const o = work.players[m[0] === p.id ? m[1] : m[0]]; if (o) oppNames.push(o.name); } }));
          const oppBadges = MB.computeRingIntroBadges(history, oppNames);
          const teamTitleInfo = teamId != null ? (titleHistory.get(teamId) || titleHistory.get(String(teamId)) || titleHistory.get(Number(teamId))) : null;
          const line = A.buildTeamPickLine({ name, teamName: teamMeta ? teamMeta.n : p.team, teamTitleInfo, opponentBadges: oppNames.map((n) => ({ name: n, badge: oppBadges.get(n.trim().toLowerCase()) })) });
          say(toggle++ % 2 === 1 ? "moderator" : "commentator", line);
        }
      });
    } catch (e) { note(`Draft-Teil abgebrochen: ${e.message}`); console.warn("Replay Draft:", e); }

    // ---------- Turnierstart ----------
    heading("2. TURNIERSTART");
    A.getTournamentStartSegments({ athleteNames: playerNames }).forEach((s) => say(s.role, s.text));
    try { article(B.buildKickoffArticle(work), "zum Turnierstart"); } catch (e) { console.warn("Replay Kickoff:", e); }

    // ---------- Spiele in zeitlicher Reihenfolge ----------
    const events = [];
    const seen = new Set();
    work.slots.forEach((slot) => slot.forEach((m) => { events.push({ type: "group", m }); seen.add(m); }));
    work.matches.forEach((m) => { if (!seen.has(m)) events.push({ type: "group", m }); });
    work.playoffMatches.forEach((m, i) => {
      const o = poOrig[i];
      if (!o || o.s1 === null || o.s2 === null || o.s1 === undefined) return;
      const f = finalPO[i];
      if (!f || !f.p1 || !f.p2 || f.p1.id === -1 || f.p2.id === -1) return; // Freilos
      events.push({ type: "playoff", m, i });
    });

    const stadiumPrepFor = (st, name) => (name === st.config.s2 ? (st.config.s2Prep || "im") : (st.config.s1Prep || "im"));
    const flags = {};
    let progressSoFar = 0, portraitsDone = false;
    const publishedPortraits = new Set();
    let prevMiles = new Set(Mu && Mu.detectMilestones ? Mu.detectMilestones(work) : []);
    const MS_LABEL = (Mu && Mu.MILESTONE_META) ? Mu.MILESTONE_META : {};
    let n = 0;
    let lastPhase = "";

    events.forEach((ev) => {
      const m = ev.m;
      const orig = ev.type === "group" ? groupOrig[work.matches.indexOf(m)] : poOrig[ev.i];
      if (!orig || orig.s1 === null || orig.s2 === null || orig.s1 === undefined) return; // nie gespielt
      n++; stats.matches++;

      if (ev.type === "playoff" && (!m.p1 || !m.p2)) { m.p1 = finalPO[ev.i].p1; m.p2 = finalPO[ev.i].p2; } // Notnagel bei ungewöhnlicher Reihenfolge
      const homeP = ev.type === "group" ? work.players[m.p1] : m.p1;
      const awayP = ev.type === "group" ? work.players[m.p2] : m.p2;
      const homeName = homeP.name, awayName = awayP.name;
      const stadium = ev.type === "group"
        ? (((work.slots.find((s) => s.includes(m)) || []).indexOf(m) === 1) ? work.config.s2 : work.config.s1)
        : ((ev.i % 2 === 0) ? work.config.s1 : work.config.s2);
      const phase = ev.type === "group" ? "Regular Season" : (m.phase || "Playoffs");
      if (phase !== lastPhase) { heading(`3. ${phase.toUpperCase()}`); lastPhase = phase; }

      recomputeStandings(work);
      const prevSeeds = MB.getLiveSeeds(work);
      m.s1 = orig.s1; m.s2 = orig.s2;
      recomputeStandings(work);
      if (ev.type === "playoff") replayedPO.add(ev.i);
      revealPlayoffs();
      try { MB.syncPlayoffOffsets(work); } catch (e) { /* optional */ }

      // Song-Meilenstein, der durch dieses Ergebnis neu erreicht wird
      const milesNow = new Set(Mu && Mu.detectMilestones ? Mu.detectMilestones(work) : []);
      const newMiles = [...milesNow].filter((x) => !prevMiles.has(x));
      prevMiles = milesNow;
      const songMilestone = newMiles[0] || null;

      out.push("");
      out.push(`--- Spiel ${n}: ${homeName} ${orig.s1} : ${orig.s2} ${awayName}  (${phase}${ev.type === "playoff" ? " · " + m.id : ""}, ${stadium}) ---`);
      try {
        const r = A.buildResultLine({
          state: work, history, homeName, awayName, homeScore: orig.s1, awayScore: orig.s2, stadium, prevSeeds,
          matchKind: ev.type, matchId: ev.type === "playoff" ? m.id : null, songMilestone, songGenerated: !!songMilestone,
        });
        say("commentator", r.line);
        let next = null;
        try { next = (MB.getUpcomingMatches(work, { limit: 1 }) || [])[0]; } catch (e) { note(`Vorschau-Zeiten nicht berechenbar: ${e.message}`); }
        if (next) {
          say("moderator", A.buildUpcomingLine({
            state: work, history, homeName: next.homeName, awayName: next.awayName, time: next.time, stadium: next.stadium,
            stadiumPreposition: stadiumPrepFor(work, next.stadium), phase: next.phase, usedFactTypes: r.usedFactTypes,
            songMilestone, songGenerated: !!songMilestone,
          }));
        }
      } catch (e) { note(`Ansage für dieses Spiel fehlgeschlagen: ${e.message}`); console.warn("Replay Ansage:", e); }

      // Song-Anmoderation + Song-Blogbeitrag
      newMiles.forEach((ms) => {
        const label = (MS_LABEL[ms] && MS_LABEL[ms].label) || ms;
        out.push(`   [SONG-MOMENT: ${label}]`);
        try {
          const performers = ms === "regularSeason" ? [{ name: "MC Altima", host: true }] : [];
          A.getSongAnnounceSegments(ms, performers).forEach((s) => say(s.role, s.text));
          note("Song wird hier abgespielt (Musikvideo auf der Song-Bühne)");
          article(B.buildSongArticle(ms, "https://example.invalid/song.mp3"), `nach Spiel ${n} (${label})`);
        } catch (e) { console.warn("Replay Song:", e); }
      });

      // ---- Blog: Rekorde, Meilenstein-Rekorde, Power Ranking, Porträts, Abschluss ----
      try {
        (R.detectRecords(work, history, { homeName, awayName, homeScore: orig.s1, awayScore: orig.s2 }) || []).forEach((rec) => {
          article(B.buildRecordArticle(rec), `nach Spiel ${n}`);
        });
        (R.detectMilestoneRecords(work, flags) || []).forEach((rec) => {
          flags[rec.type] = true;
          article(rec.type === "finals" ? B.buildFinalsArticle(rec) : B.buildChampionArticle(rec), `nach Spiel ${n}`);
          if (rec.type === "champion") article(B.buildWrapUpArticle(work, history), `nach Spiel ${n} (Abschluss)`);
        });
        if (B.isProgressArticleDue(work, progressSoFar)) {
          progressSoFar++;
          article(B.buildProgressArticle(work, history, B.countFinishedMatches(work)), `nach Spiel ${n} (Power Ranking)`);
        }
        if (!portraitsDone && B.isPortraitDue(work, publishedPortraits, history)) {
          const group = B.nextPortraitGroup(work, history, publishedPortraits);
          if (group) { const a = B.buildPortraitArticle(group, work, history); if (a) { article(a, `nach Spiel ${n} (Porträt)`); } publishedPortraits.add(group); }
          else portraitsDone = true;
        }
      } catch (e) { console.warn("Replay Blog:", e); blog.push(`(Blog-Teil bei Spiel ${n} abgebrochen: ${e.message})`); }
    });

    out.push("");
    out.push(`— Ende. ${stats.announcements} Sprechzeilen für ${stats.matches} Spiele. —`);
    blog.push("", `— Ende. ${stats.articles} Beiträge für ${stats.matches} Spiele. —`);
    return { announcer: out.join("\n"), blog: blog.join("\n"), stats };
  }

  global.MB.Replay = { run, cloneState };
})(window);
