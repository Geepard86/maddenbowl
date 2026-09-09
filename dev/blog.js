/* =========================================================================
   MADDEN BOWL — BLOG (blog.js)
   -------------------------------------------------------------------------
   Generiert automatisch kurze, deutschsprachige Turnierblog-Artikel an
   passenden Momenten (Turnierstart, alle paar Spiele ein Zwischenstand,
   Rekord-Momente, generierte Songs, Finale, Champion) — komplett
   textbasiert (kein LLM-Aufruf, kein zusätzlicher API-Key), Templates wie
   in announcer.js/records.js. Wird in Supabase gespeichert, damit alle
   Besucher von live.html denselben Feed sehen.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   ========================================================================= */

(function (global) {
  "use strict";

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ======================================================================
  // TON-BAUSTEINE — Phrasen-Pools für Abwechslung (wie in announcer.js/
  // records.js). Leicht humorig, aber kompakt: das hier ist als Ticker
  // gedacht, keine große Reportage — die schreibt man selbst über den
  // Editor in seasons.html.
  // ======================================================================
  const KICKOFF_OPENERS = [
    "Die Controller sind aufgeladen, die Ausreden für die erste Halbzeit liegen schon bereit:",
    "Acht Spieler, ein Pokal, null Nerven — los geht's:",
    "Die Gruppenphase ruft, die Zweifel an der eigenen Passgenauigkeit auch:",
  ];
  const KICKOFF_CLOSERS = [
    "Möge der Bessere gewinnen — oder zumindest der mit dem stabileren WLAN.",
    "Wir sehen uns in der Tabelle wieder.",
    "Viel Erfolg — ihr werdet es brauchen.",
  ];
  const PROGRESS_OPENERS = [
    "Zwischenstand, weil auch ein Turnier mal Luft holen muss:",
    "Kurzer Blick auf die Lage, bevor der nächste Anpfiff kommt:",
    "Stand der Dinge, mit allem Drama, das dazugehört:",
  ];
  const PROGRESS_CLOSERS = [
    "Es bleibt spannend — oder zumindest laut.",
    "Mehr dazu, sobald wieder wer over-/underperformt.",
    "Weiter geht's, die Tabelle schreibt sich nicht von allein.",
  ];
  const RECORD_INTROS = {
    allTimeHigh: [
      "{player} hat offenbar den Schwierigkeitsgrad falsch eingestellt: {value} Punkte gegen {opponent} — neuer Allzeit-Highscore!",
      "Notiz für die Geschichtsbücher: {player} knackt mit {value} Punkten gegen {opponent} den bisherigen Rekord.",
    ],
    allTimeMargin: [
      "{player} vs {opponent}: {winnerScore}:{loserScore}. Das war keine Partie, das war eine Demontage — Allzeit-Rekord.",
      "Die größte Klatsche der Turniergeschichte ist frisch: {player} lässt {opponent} beim {winnerScore}:{loserScore} keine Chance.",
    ],
    tournamentMargin: [
      "{player} gewinnt {winnerScore}:{loserScore} gegen {opponent} — die deutlichste Ansage dieser Saison bisher.",
      "Da war jemand konzentriert: {player} überrollt {opponent} mit {winnerScore}:{loserScore}, Saisonbestwert.",
    ],
    winStreak: [
      "{player} sammelt weiter Siege wie andere Leute Abos: {value} in Folge, aktuell nicht zu stoppen.",
      "Serie Nummer {value} für {player} — langsam wird's unheimlich für den Rest des Feldes.",
    ],
    upset: [
      "Und da ist sie, die Überraschung des Tages: {player} schlägt {opponent} {winnerScore}:{loserScore}, obwohl das eigentlich nicht im Drehbuch stand.",
      "Wer hätte das gedacht: {player} kippt {opponent} mit {winnerScore}:{loserScore} — die Tabelle lügt eben manchmal.",
    ],
    shutout: [
      "{opponent} durfte heute nur zuschauen: {player} gewinnt {winnerScore}:{loserScore}, praktisch ohne Gegenwehr.",
      "Schmerzhaft: {player} lässt {opponent} beim {winnerScore}:{loserScore} kaum was zu.",
    ],
    shootout: [
      "Verteidigung? Kannte heute niemand: {player} gegen {opponent} endet {winnerScore}:{loserScore} — neuer Punkte-Höchststand für einen Spieltag.",
      "Reines Offensiv-Feuerwerk zwischen {player} und {opponent}: {winnerScore}:{loserScore}, so viele Punkte gab's noch nie in einem Spiel.",
    ],
  };
  const FINALS_INTROS = [
    "Die Bühne ist bereitet: {p1} gegen {p2} um den Titel. Einer geht als Champion nach Hause, der andere übt schon mal Fassung bewahren.",
    "Das wird's also: {p1} vs {p2} im großen Finale. Nur einer von beiden bekommt den Ring, der andere den Trost­preis 'Platz 2'.",
  ];
  const CHAMPION_INTROS = [
    "{player} gewinnt das Finale {winnerScore}:{loserScore} gegen {opponent} und ist neuer Madden Bowl Champion. Chapeau.",
    "Es ist entschieden: {player} holt sich mit einem {winnerScore}:{loserScore} gegen {opponent} den Titel. Auf geht's zur Krönung.",
  ];
  const SONG_INTROS = {
    regularSeason: ["Die Regular Season ist Geschichte — dafür gibt's jetzt den passenden Soundtrack.", "Gruppenphase durch, Bühne frei für die erste Hymne des Turniers."],
    firstElimination: ["Der erste Spieler ist raus — verdient einen eigenen Song, auch wenn's wehtut.", "Das erste Ausscheiden dieser Saison, standesgemäß vertont."],
    finals: ["Das Finale steht — und hat jetzt seinen eigenen Titelsong.", "Passend zum großen Showdown: frische Musik."],
    champion: ["Wir haben einen Champion — und die dazugehörige Hymne.", "Die Krönung ist vollzogen, der Song dazu auch."],
  };

  function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""); }

  // ======================================================================
  // ARTIKEL-BAUSTEINE
  // ======================================================================
  function buildKickoffArticle(state) {
    const names = state.players.map((p) => `${p.name} (${p.team})`).join(", ");
    const title = "Der Madden Bowl ist eröffnet!";
    const body =
      `${pick(KICKOFF_OPENERS)} ${state.players.length} Spieler kämpfen ab jetzt um den Titel: ${names}. ` +
      `Zuerst geht es in die Gruppenphase, danach entscheiden die Playoffs, wer sich ` +
      `"Madden Bowl Champion" nennen darf — und wer stattdessen im Toilet Bowl landet. ` +
      `${pick(KICKOFF_CLOSERS)}`;
    return { kind: "kickoff", title, body };
  }

  // Rückblick-Artikel für den Blog-Start: fasst alle bisherigen (in
  // Supabase als 'completed' markierten) Saisons zusammen — komplett
  // datenbasiert aus der History-Engine, keine hartkodierten Zahlen.
  // (Für einen richtig ausgearbeiteten Rückblick lieber den freien Editor
  // in seasons.html nutzen — das hier ist die schnelle, automatische Variante.)
  function buildRetrospectiveArticle(history) {
    const seasons = [...(history.seasons || [])].sort((a, b) => a.season - b.season);
    const champions = seasons.map((s) => {
      const champ = (s.standings || []).find((x) => Number(x.rank) === 1);
      return champ ? `${s.season}: ${champ.name}` : null;
    }).filter(Boolean);

    const ringsSorted = [...(history.ringsByPlayer || new Map()).entries()].sort((a, b) => b[1] - a[1]);
    const kingOfRings = ringsSorted[0];

    let maxScore = 0, maxScoreInfo = null;
    let maxMargin = 0, maxMarginInfo = null;
    (history.matches || []).forEach((m) => {
      if (m.homeScore == null || m.awayScore == null) return;
      const hi = Math.max(m.homeScore, m.awayScore);
      if (hi > maxScore) { maxScore = hi; maxScoreInfo = m; }
      const margin = Math.abs(m.homeScore - m.awayScore);
      if (margin > maxMargin) { maxMargin = margin; maxMarginInfo = m; }
    });

    const totalGames = (history.matches || []).length;

    let body = `Bevor der neue Madden Bowl startet, ein kurzer, ehrfürchtiger Blick zurück auf ${seasons.length} bisherige Turniere. `;
    if (champions.length) body += `Die bisherigen Champions: ${champions.join(", ")}. `;
    if (kingOfRings) body += `${kingOfRings[0]} führt die ewige Bestenliste mit ${kingOfRings[1]} Titel${kingOfRings[1] > 1 ? "n" : ""} an — Respekt oder zumindest ein bisschen Neid. `;
    if (maxScoreInfo) body += `Der Allzeit-Highscore steht bei ${maxScore} Punkten (${maxScoreInfo.homePlayer} vs ${maxScoreInfo.awayPlayer}, Saison ${maxScoreInfo.season}). `;
    if (maxMarginInfo) body += `Die größte Klatsche aller Zeiten: ${maxMarginInfo.homeScore}:${maxMarginInfo.awayScore} zwischen ${maxMarginInfo.homePlayer} und ${maxMarginInfo.awayPlayer} (Saison ${maxMarginInfo.season}) — schmerzhaft, auch heute noch. `;
    body += `Insgesamt wurden bisher ${totalGames} Spiele ausgetragen. Auf zum nächsten Kapitel!`;

    return { kind: "retrospective", title: "📜 5 Jahre Madden Bowl — ein Rückblick", body };
  }

  function buildProgressArticle(state, history, finishedCount) {
    // Aktuelle Live-Tabelle (wins -> diff), NICHT computeBaseRanking — das
    // ist für die finale Abschlusstabelle gedacht und würde während der
    // laufenden Gruppenphase falsche/verfrühte Namen liefern.
    const sorted = [...state.players].sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.diff || 0) - (a.diff || 0));
    const leaderNames = sorted.slice(0, 3).map((p) => p.name).filter(Boolean);
    const title = `Zwischenstand nach ${finishedCount} Spielen`;
    let body = `${pick(PROGRESS_OPENERS)} `;
    if (leaderNames.length) {
      body += `Ganz vorne stehen aktuell ${leaderNames.join(", ")}. `;
    }
    // Ein zufälliges, datenbasiertes Detail aus den zuletzt gespielten Partien
    const recent = MB.getCurrentMatchesNormalized(state).slice(-3);
    if (recent.length) {
      const m = pick(recent);
      const winner = m.homeScore > m.awayScore ? m.homePlayer : m.awayPlayer;
      const loser = m.homeScore > m.awayScore ? m.awayPlayer : m.homePlayer;
      body += `Zuletzt setzte sich ${winner} gegen ${loser} durch (${Math.max(m.homeScore, m.awayScore)}:${Math.min(m.homeScore, m.awayScore)}). `;
    }
    body += pick(PROGRESS_CLOSERS);
    return { kind: "progress", title, body };
  }

  function buildRecordArticle(record) {
    const info = MB.Records.RECORD_TYPES[record.type] || { label: record.type, emoji: "🏈" };
    const pool = RECORD_INTROS[record.type];
    const body = pool ? fill(pick(pool), record) : `Ein besonderer Moment im Madden Bowl: ${record.player || ""} sorgt für Gesprächsstoff.`;
    return { kind: "record", title: `${info.emoji} ${info.label}`, body };
  }

  function buildSongArticle(milestone, songUrl) {
    const pool = SONG_INTROS[milestone] || ["Zu diesem Moment gibt's jetzt einen eigenen Song — reinhören lohnt sich."];
    const titleLabels = {
      regularSeason: "Die Regular Season ist Geschichte",
      firstElimination: "Der erste Spieler ist raus",
      finals: "Das Finale steht",
      champion: "Wir haben einen Champion",
    };
    return {
      kind: "song",
      title: `🎵 ${titleLabels[milestone] || "Neuer Song"}`,
      body: pick(pool),
      media_url: songUrl, media_type: "audio",
    };
  }

  function buildFinalsArticle(record) {
    return { kind: "finals", title: "🎬 Das Finale ist perfekt", body: fill(pick(FINALS_INTROS), record) };
  }

  function buildChampionArticle(record) {
    return { kind: "champion", title: "👑 Wir haben einen neuen Madden Bowl Champion!", body: fill(pick(CHAMPION_INTROS), record) };
  }

  // ======================================================================
  // SUPABASE
  // ======================================================================
  async function pushArticle(tournamentId, article) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return null;
    const { data, error } = await sb.from("blog_articles")
      .insert({ tournament_id: tournamentId, kind: article.kind, title: article.title, body: article.body, media_url: article.media_url || null, media_type: article.media_type || null })
      .select().single();
    if (error) { console.warn("Artikel konnte nicht gespeichert werden:", error); return null; }
    return data;
  }

  // Manuell verfasster Beitrag durch den Admin (siehe seasons.html/index.html
  // "Blog verwalten") — eigene kind, damit man ihn im Feed optisch/technisch
  // von den automatisch generierten Artikeln unterscheiden könnte.
  async function pushManualArticle(tournamentId, { title, body }) {
    return pushArticle(tournamentId, { kind: "manual", title, body });
  }

  // Nachträgliches Bearbeiten (Titel/Text/Bild) eines bestehenden Artikels.
  // `patch` enthält nur die Felder, die geändert werden sollen.
  async function updateArticle(articleId, patch) {
    const sb = MB.getSupabaseClient();
    if (!sb || !articleId) return null;
    const allowed = {};
    if (patch.title !== undefined) allowed.title = patch.title;
    if (patch.body !== undefined) allowed.body = patch.body;
    if (patch.media_url !== undefined) allowed.media_url = patch.media_url;
    if (patch.media_type !== undefined) allowed.media_type = patch.media_type;
    const { data, error } = await sb.from("blog_articles")
      .update(allowed).eq("id", articleId).select().single();
    if (error) { console.warn("Artikel konnte nicht aktualisiert werden:", error); return null; }
    return data;
  }

  async function deleteArticle(articleId) {
    const sb = MB.getSupabaseClient();
    if (!sb || !articleId) return false;
    const { error } = await sb.from("blog_articles").delete().eq("id", articleId);
    if (error) { console.warn("Artikel konnte nicht gelöscht werden:", error); return false; }
    return true;
  }

  async function fetchArticles(tournamentId, limit) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return [];
    const { data, error } = await sb.from("blog_articles")
      .select("*").eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false }).limit(limit || 50);
    if (error) { console.warn("Artikel laden fehlgeschlagen:", error); return []; }
    return data || [];
  }

  async function countArticlesByKind(tournamentId, kind) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return 0;
    const { count, error } = await sb.from("blog_articles")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId).eq("kind", kind);
    if (error) { console.warn(error); return 0; }
    return count || 0;
  }

  // Zählt fertige Spiele (Gruppe + Playoff) im laufenden Turnier.
  function countFinishedMatches(state) {
    const g = (state.matches || []).filter((m) => m.s1 != null && m.s2 != null).length;
    const p = (state.playoffMatches || []).filter((m) => MB.isFinished(m) && !MB.isByeMatch(m)).length;
    return g + p;
  }

  // Soll jetzt ein neuer Zwischenstands-Artikel erscheinen? (alle 3 Spiele)
  // `progressArticlesSoFar` kommt aus countArticlesByKind(tid, 'progress').
  function isProgressArticleDue(state, progressArticlesSoFar) {
    const finished = countFinishedMatches(state);
    const threshold = (progressArticlesSoFar + 1) * 3;
    return finished >= threshold && finished > 0;
  }

  global.MB = global.MB || {};
  global.MB.Blog = {
    buildKickoffArticle, buildRetrospectiveArticle, buildProgressArticle, buildRecordArticle, buildSongArticle, buildFinalsArticle, buildChampionArticle,
    pushArticle, pushManualArticle, updateArticle, deleteArticle, fetchArticles, countArticlesByKind, countFinishedMatches, isProgressArticleDue,
  };
})(window);
