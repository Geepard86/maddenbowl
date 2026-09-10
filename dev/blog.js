/* =========================================================================
   MADDEN BOWL — BLOG (blog.js)
   -------------------------------------------------------------------------
   Generiert automatisch deutschsprachige Turnierblog-Artikel an passenden
   Momenten (Turnierstart, alle paar Spiele ein Zwischenstand,
   Rekord-Momente, generierte Songs, Finale, Champion).

   Die automatischen Beiträge sind bewusst als kleine Artikel aufgebaut:
   mehrere Absätze, redaktioneller Einstieg, konkrete Fakten und Ausblick.
   Kein LLM-Aufruf, kein zusätzlicher API-Key.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   ========================================================================= */

(function (global) {
  "use strict";

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function paragraphs(parts) {
    return parts.filter(Boolean).join("\n\n");
  }

  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) =>
      vars[key] !== undefined && vars[key] !== null ? vars[key] : ""
    );
  }

  // ======================================================================
  // REDAKTIONS-BAUSTEINE
  // ======================================================================

  const KICKOFF_OPENERS = [
    "Der Madden Bowl ist zurück. Und damit beginnt wieder die Phase des Jahres, in der ein vermeintlich harmloses Spiel plötzlich erstaunlich wichtig wird.",
    "Es geht wieder los. Controller in die Hand, Tabelle auf und die üblichen guten Vorsätze für faire Spiele vorsichtshalber gleich wieder vergessen.",
    "Neue Saison, neues Glück – und dieselbe alte Frage: Wer schafft es am Ende tatsächlich bis zum Ring?",
  ];

  const KICKOFF_CLOSERS = [
    "Noch ist alles offen. Das ist wahrscheinlich der letzte Moment, in dem das alle Beteiligten genauso sehen.",
    "Der Rest ist jetzt Sache der Controller. Und der Nerven. Vor allem der Nerven.",
    "Der Madden Bowl ist eröffnet. Was jetzt noch fehlt, sind Spiele, Geschichten und mindestens ein Ergebnis, das später niemand kommen gesehen haben will.",
  ];

  // ======================================================================
  // ZWISCHENSTÄNDE
  // ----------------------------------------------------------------------
  // Die Zwischenstands-Artikel wechseln automatisch zwischen verschiedenen
  // redaktionellen Blickwinkeln:
  // Tabellenführer, Verfolger, Top 3, Spiel des Tages, Favoriten/Krise.
  // ======================================================================

  const PROGRESS_STYLES = [
    {
      title: (count) => `Zwischenstand nach ${count} Spielen`,

      opener:
        "Ein paar Spiele sind gespielt, und langsam bekommt der Madden Bowl Konturen. Noch ist nichts entschieden – aber einige Herren arbeiten bereits fleißig daran, diese Aussage zu widerlegen.",

      focus: (leader) =>
        `${leader.name} steht aktuell ganz oben. ${leader.wins || 0} Siege hat er bereits gesammelt${
          leader.diff != null
            ? `, dazu eine Punktedifferenz von ${
                leader.diff >= 0 ? "+" : ""
              }${leader.diff}`
            : ""
        }. Für einen Zwischenstand ist das ziemlich ordentlich – für eine Prognose auf den Titel noch viel zu früh.`,

      closer:
        "Die Saison ist noch lang. Aber langsam lohnt es sich, auf die Tabelle nicht nur zu schauen, sondern sie ernst zu nehmen.",

      consumesRecent: false,
    },

    {
      title: (count) =>
        `Wer gerade Druck macht – Zwischenstand nach ${count} Spielen`,

      opener:
        "Nicht jede Saison erzählt sich über den Tabellenführer. Manchmal ist die interessantere Geschichte der Spieler dahinter, der plötzlich anfängt, Siege einzusammeln.",

      focus: (leader, runnerUp) =>
        runnerUp
          ? `${runnerUp.name} liegt aktuell auf Platz zwei und bleibt damit direkt an ${leader.name} dran. Gerade solche Zwischenstände sind gefährlich: Noch ist niemand Favorit, aber langsam bekommt die Konkurrenz ein Problem, wenn dieser Rhythmus anhält.`
          : `${leader.name} hat sich an die Spitze gesetzt. Wer dahinter Druck machen will, braucht allerdings langsam Ergebnisse und nicht nur gute Vorsätze.`,

      closer:
        "Noch ist das Feld eng genug für eine Kehrtwende. Beim Madden Bowl reicht dafür bekanntlich manchmal schon ein einziges Spiel.",

      consumesRecent: false,
    },

    {
      title: (count) => `Die Tabelle nimmt Fahrt auf – nach ${count} Spielen`,

      opener:
        "Die ersten Ergebnisse waren noch einzelne Geschichten. Inzwischen beginnen sie, ein Bild zu ergeben.",

      focus: (leader, runnerUp, third) => {
        const names = [leader, runnerUp, third]
          .filter(Boolean)
          .map((p, i) => `${i + 1}. ${p.name}`)
          .join(", ");

        return `An der Spitze steht derzeit ${names}. Noch trennen sich die Plätze nicht zwingend Welten – aber jede weitere Partie macht aus einer Momentaufnahme langsam eine Richtung.`;
      },

      closer:
        "Und genau da wird es interessant: Wer jetzt vorne bleibt, muss irgendwann nicht mehr nur gewinnen, sondern mit dem Druck leben, dass alle anderen ihn dort sehen.",

      consumesRecent: false,
    },

    {
      title: (count) =>
        `Spieltag mit Folgen – Zwischenstand nach ${count} Spielen`,

      opener:
        "Ein Spieltag muss nicht spektakulär aussehen, um etwas zu verändern. Manchmal reicht schon ein Ergebnis zur richtigen Zeit.",

      focus: (leader, runnerUp, recent) =>
        recent
          ? `${recent.winner} hat zuletzt gegen ${recent.loser} mit ${recent.score} gewonnen. Solche Partien wirken auf den ersten Blick wie ein einzelnes Ergebnis – in einer engen Tabelle können sie aber genau der Unterschied sein, der später über Playoff-Platz oder Zittern entscheidet.`
          : `${leader.name} führt aktuell das Feld an. Dahinter bleibt genug Bewegung, dass sich aus dem Zwischenstand noch keine gemütliche Meisterschaft machen lässt.`,

      closer:
        "Die Tabelle schreibt ihre Geschichte gerade erst. Und erfahrungsgemäß wird sie dabei nicht besonders rücksichtsvoll vorgehen.",

      consumesRecent: true,
    },

    {
      title: (count) =>
        `Favoriten unter Beobachtung – ${count} Spiele vorbei`,

      opener:
        "Jetzt wird es langsam unangenehm für alle, die sich vor dem Turnier schon selbst zum Favoriten erklärt haben: Die Tabelle beginnt, mitzuschreiben.",

      focus: (leader, runnerUp) =>
        `${leader.name} hat aktuell die beste Ausgangslage${
          runnerUp
            ? `, während ${runnerUp.name} direkt dahinter lauert`
            : ""
        }. Entscheidend ist aber weniger, wer heute oben steht, sondern wer auch dann noch dort steht, wenn die vermeintlich einfachen Spiele plötzlich nicht mehr einfach sind.`,

      closer:
        "Noch gibt es keinen Grund für Panik. Aber für Ausreden wird es langsam schwieriger.",

      consumesRecent: false,
    },
  ];

  // ======================================================================
  // REKORD-ARTIKEL
  // ======================================================================

  const RECORD_INTROS = {
    allTimeHigh: [
      "Es gibt Spiele, die gewinnt man. Und es gibt Spiele, nach denen man einen Eintrag in den Geschichtsbüchern bekommt. {player} gehört seit heute zur zweiten Kategorie.",
      "Der bisherige Punkterekord ist Geschichte. {player} legte gegen {opponent} {value} Punkte auf – eine Zahl, die sich erst einmal setzen muss.",
    ],

    allTimeMargin: [
      "Manchmal entscheidet ein Spiel die Tabelle. Manchmal entscheidet es nur, wie lange der Verlierer danach über diese Partie sprechen möchte. {player} schlägt {opponent} {winnerScore}:{loserScore} – die größte Klatsche der Turniergeschichte.",
      "{winnerScore}:{loserScore}. Mehr muss man über die Kräfteverhältnisse zwischen {player} und {opponent} eigentlich nicht sagen. Es ist die deutlichste Niederlage, die der Madden Bowl bisher gesehen hat.",
    ],

    tournamentMargin: [
      "Für den Allzeit-Rekord hat es diesmal nicht gereicht. Für eine Ansage innerhalb dieser Saison schon: {player} schlägt {opponent} {winnerScore}:{loserScore}.",
      "{player} hat heute offenbar beschlossen, keine Fragen offenzulassen. Mit {winnerScore}:{loserScore} gegen {opponent} steht die größte Differenz dieses Turniers.",
    ],

    winStreak: [
      "Drei Siege in Folge sind irgendwann keine Serie mehr, sondern ein Statement. {player} steht inzwischen bei {value} Erfolgen am Stück.",
      "{player} gewinnt weiter. Und weiter. Und weiter. {value} Siege in Folge – langsam wird aus guter Form ein Problem für den Rest des Feldes.",
    ],

    upset: [
      "Der Spielplan hatte einen Favoriten. Das Spiel hatte eine andere Meinung. {player} schlägt {opponent} mit {winnerScore}:{loserScore} und sorgt damit für die Überraschung des Tages.",
      "Nicht jede Partie hält sich an die Ausgangslage. {player} setzt sich gegen {opponent} mit {winnerScore}:{loserScore} durch – und bringt damit ordentlich Bewegung ins Turnier.",
    ],

    shutout: [
      "Ein Spiel, das vor allem eine Zahl hinterlässt: {loserScore}. {player} gewinnt gegen {opponent} {winnerScore}:{loserScore} und lässt dem Gegner kaum Raum für eine Antwort.",
      "Für {opponent} war es einer dieser Abende, an denen selbst ein guter Start wahrscheinlich nicht geholfen hätte. {player} gewinnt {winnerScore}:{loserScore}.",
    ],

    shootout: [
      "Defensive Abende sehen anders aus. {player} und {opponent} kommen zusammen auf {total} Punkte – so viele wie in keinem anderen Spiel dieses Turniers.",
      "Wenn beide Offensiven einmal beschlossen haben, Feierabend zu machen, sieht das so aus: {player} gegen {opponent}, {winnerScore}:{loserScore}. Ein echtes Punktefeuerwerk.",
    ],
  };

  // ======================================================================
  // FINALE / CHAMPION
  // ======================================================================

  const FINALS_INTROS = [
    "Jetzt wird es ernst: {p1} und {p2} haben sich durch das Turnier gespielt und stehen im Finale. Einer von beiden ist nur noch einen Sieg vom Ring entfernt.",
    "Die Gruppenphase ist Geschichte, die Playoffs sind vorbei – übrig bleiben {p1} und {p2}. Das Finale steht, und damit die letzte Frage dieser Saison: Wer holt den Titel?",
  ];

  const CHAMPION_INTROS = [
    "Es ist entschieden. {player} gewinnt das Finale gegen {opponent} mit {winnerScore}:{loserScore} und darf sich Madden Bowl Champion nennen.",
    "Am Ende bleibt einer stehen: {player}. Mit {winnerScore}:{loserScore} gegen {opponent} geht der Titel an den neuen Madden Bowl Champion.",
  ];

  const SONG_INTROS = {
    regularSeason: [
      "Die Gruppenphase ist vorbei. Zeit für den Soundtrack zu den ersten Wochen voller Siege, Niederlagen und mehr oder weniger belastbarer Prognosen.",
      "Die Regular Season ist Geschichte. Wer jetzt noch im Rennen ist, bekommt den passenden Soundtrack für die entscheidende Phase.",
    ],

    firstElimination: [
      "Der erste Spieler ist raus. Hart, aber immerhin gibt es dafür jetzt den passenden Soundtrack.",
      "Die erste Saisonhoffnung ist geplatzt. Der Madden Bowl hat seinen ersten Ausgeschiedenen – und natürlich bekommt auch dieser Moment seinen Song.",
    ],

    finals: [
      "Das Finale steht. Zwei Spieler sind noch übrig, und jetzt gibt es den Soundtrack für den großen Showdown.",
      "Die letzte Partie der Saison steht fest. Zeit, den Lautstärkeregler hochzudrehen.",
    ],

    champion: [
      "Der Champion steht fest. Ein letzter Song für eine Saison, die jetzt Geschichte ist.",
      "Der Ring ist vergeben. Was bleibt, ist der Rückblick – und natürlich der passende Soundtrack zum Titel.",
    ],
  };

  // ======================================================================
  // KICKOFF
  // ======================================================================

  function buildKickoffArticle(state) {
    const players = state.players || [];
    const names = players
      .map((p) => p.name)
      .filter(Boolean);

    const parts = [
      pick(KICKOFF_OPENERS),
      names.length
        ? `Mit dabei sind diesmal ${names.join(", ")}. Jeder startet bei null, jeder hat seine eigene Vorstellung davon, wie diese Saison laufen soll – und spätestens nach den ersten Spielen dürfte sich zeigen, wie belastbar diese Vorstellungen wirklich sind.`
        : "Das Teilnehmerfeld steht bereit. Jetzt fehlt eigentlich nur noch das erste Spiel.",
      "Wie immer entscheidet nicht die Papierform, sondern das, was auf dem virtuellen Rasen passiert. Favoriten gibt es natürlich trotzdem – schließlich wäre ein Madden Bowl ohne voreilige Prognosen nur halb so unterhaltsam.",
      pick(KICKOFF_CLOSERS),
    ];

    return {
      kind: "kickoff",
      title: "🏈 Der Madden Bowl ist eröffnet!",
      body: paragraphs(parts),
    };
  }

  // ======================================================================
  // RÜCKBLICK
  // ======================================================================

  function buildRetrospectiveArticle(seasons) {
    seasons = seasons || [];

    const champions = [];
    const allPlayers = new Set();

    let maxScore = 0;
    let maxScoreInfo = null;

    let maxMargin = 0;
    let maxMarginInfo = null;

    seasons.forEach((season) => {
      if (season.champion) {
        champions.push(season.champion);
      }

      (season.players || []).forEach((player) => {
        if (player.name) allPlayers.add(player.name);
      });

      (season.matches || []).forEach((match) => {
        if (match.s1 == null || match.s2 == null) return;

        const total = Number(match.s1) + Number(match.s2);
        const margin = Math.abs(Number(match.s1) - Number(match.s2));

        if (total > maxScore) {
          maxScore = total;
          maxScoreInfo = {
            homePlayer: match.p1,
            awayPlayer: match.p2,
            season: season.name || season.year || "?",
          };
        }

        if (margin > maxMargin) {
          maxMargin = margin;
          maxMarginInfo = {
            homeScore: match.s1,
            awayScore: match.s2,
            homePlayer: match.p1,
            awayPlayer: match.p2,
            season: season.name || season.year || "?",
          };
        }
      });
    });

    const parts = [
      `${seasons.length} ${
        seasons.length === 1 ? "Season" : "Seasons"
      } Madden Bowl liegen inzwischen hinter uns. Was als kleines Turnier begonnen hat, ist längst mehr geworden: eine eigene Geschichte, eine Tabelle, Rekorde und vor allem jede Menge Spiele, über die man noch lange sprechen kann.`,
      allPlayers.size
        ? `${allPlayers.size} Spieler haben sich bislang in die Geschichte des Madden Bowl gespielt. Manche davon mit Titeln, manche mit Rekorden – und manche vor allem mit Ergebnissen, die man lieber nicht mehr auf dem Screenshot hätte.`
        : null,
    ];

    if (champions.length) {
      parts.push(
        `Die bisherigen Champions lesen sich inzwischen wie eine kleine Hall of Fame: ${champions.join(
          ", "
        )}.`
      );
    }

    if (maxScoreInfo) {
      parts.push(
        `Und natürlich gibt es die Zahlen, die man nicht mehr loswird. Der höchste Gesamtwert liegt bei ${maxScore} Punkten – aufgestellt von ${maxScoreInfo.homePlayer} gegen ${maxScoreInfo.awayPlayer} in der Saison ${maxScoreInfo.season}.`
      );
    }

    if (maxMarginInfo) {
      parts.push(
        `Noch deutlicher wurde es bei der größten Klatsche der Geschichte: ${maxMarginInfo.homeScore}:${maxMarginInfo.awayScore} zwischen ${maxMarginInfo.homePlayer} und ${maxMarginInfo.awayPlayer} in Saison ${maxMarginInfo.season}. Ein Ergebnis, das selbst nach mehreren Seasons noch unangenehm aussieht.`
      );
    }

    parts.push(
      "Was bleibt? Vor allem die Erkenntnis, dass beim Madden Bowl eigentlich nichts sicher ist. Außer vielleicht, dass irgendwann wieder jemand ein völlig absurdes Ergebnis produziert. Und genau deshalb kann die nächste Season kommen."
    );

    return {
      kind: "retrospective",
      title: "📜 Madden Bowl – ein Rückblick",
      body: paragraphs(parts),
    };
  }

  // ======================================================================
  // ZWISCHENSTAND
  // ======================================================================

  function buildProgressArticle(state, history, finishedCount) {
    const sorted = [...(state.players || [])].sort(
      (a, b) =>
        (b.wins || 0) - (a.wins || 0) ||
        (b.diff || 0) - (a.diff || 0)
    );

    const leaders = sorted.slice(0, 3).filter((p) => p.name);

    const recentMatches = MB.getCurrentMatchesNormalized(state).slice(-3);

    const recentMatch = recentMatches.length
      ? pick(recentMatches)
      : null;

    // Alle 3 Spiele wird der nächste redaktionelle Blickwinkel verwendet.
    const style =
      PROGRESS_STYLES[
        Math.floor((finishedCount - 1) / 3) % PROGRESS_STYLES.length
      ];

    const recent = recentMatch
      ? {
          winner:
            recentMatch.homeScore > recentMatch.awayScore
              ? recentMatch.homePlayer
              : recentMatch.awayPlayer,

          loser:
            recentMatch.homeScore > recentMatch.awayScore
              ? recentMatch.awayPlayer
              : recentMatch.homePlayer,

          score: `${Math.max(
            recentMatch.homeScore,
            recentMatch.awayScore
          )}:${Math.min(
            recentMatch.homeScore,
            recentMatch.awayScore
          )}`,
        }
      : null;

    const parts = [style.opener];

    if (leaders.length) {
      parts.push(
        style.focus(
          leaders[0],
          leaders[1],
          leaders[2],
          recent
        )
      );

      if (leaders[1] && leaders[2]) {
        parts.push(
          `Dahinter bleiben ${leaders[1].name} und ${leaders[2].name} in Schlagdistanz. Gerade dort wird sich zeigen, wer aus einem guten Start tatsächlich eine gute Saison machen kann.`
        );
      }
    } else {
      parts.push(
        `Nach ${finishedCount} Spielen ist die Tabelle noch schwer zu lesen. Genau das dürfte sich in den nächsten Partien ändern.`
      );
    }

    if (recent && !style.consumesRecent) {
      parts.push(
        `Zuletzt setzte sich ${recent.winner} gegen ${recent.loser} mit ${recent.score} durch. Ein einzelnes Spiel entscheidet noch keine Saison – aber es kann durchaus entscheiden, wer die nächste Partie mit etwas mehr Ruhe angeht.`
      );
    }

    parts.push(style.closer);

    return {
      kind: "progress",
      title: style.title(finishedCount),
      body: paragraphs(parts),
    };
  }

  // ======================================================================
  // REKORD
  // ======================================================================

  function buildRecordArticle(record) {
    const info =
      MB.Records.RECORD_TYPES[record.type] || {
        label: record.type,
        emoji: "🏈",
      };

    const pool = RECORD_INTROS[record.type];

    const vars = {
      ...record,
      total:
        (record.winnerScore || 0) +
        (record.loserScore || 0),
    };

    const intro = pool
      ? fill(pick(pool), vars)
      : `Ein besonderer Moment im Madden Bowl: ${
          record.player || "jemand"
        } sorgt für Gesprächsstoff.`;

    const detail =
      record.type === "winStreak"
        ? `${record.player} steht damit bei ${record.value} Siegen in Folge. Für die Konkurrenz ist das eine ziemlich deutliche Einladung, diese Serie möglichst bald zu beenden.`
        : record.type === "upset"
        ? `Der Blick auf die Ausgangslage macht den Sieg besonders bemerkenswert: ${record.player} lag in der Setzliste deutlich hinter ${record.opponent}. Auf dem Feld spielte das offenbar keine Rolle.`
        : null;

    return {
      kind: "record",
      title: `${info.emoji} ${info.label}`,
      body: paragraphs([
        intro,
        detail ? fill(detail, vars) : null,
        "Ein neuer Eintrag für die Madden-Bowl-Geschichtsbücher – und vermutlich Material für die nächste WhatsApp-Diskussion.",
      ]),
    };
  }

  // ======================================================================
  // SONG
  // ======================================================================

  function buildSongArticle(milestone, songUrl) {
    const pool =
      SONG_INTROS[milestone] || [
        "Zu diesem Moment gibt's jetzt einen eigenen Song. Viel mehr muss man dazu eigentlich nicht sagen.",
      ];

    const titleLabels = {
      regularSeason: "Die Regular Season ist Geschichte",
      firstElimination: "Der erste Spieler ist raus",
      finals: "Das Finale steht",
      champion: "Wir haben einen Champion",
    };

    return {
      kind: "song",
      title: `🎵 ${
        titleLabels[milestone] || "Neuer Song"
      }`,

      body: paragraphs([
        pick(pool),
        "Der sportliche Teil ist damit dokumentiert. Jetzt gibt es den passenden Soundtrack dazu.",
      ]),

      media_url: songUrl,
      media_type: "audio",
    };
  }

  // ======================================================================
  // FINALE
  // ======================================================================

  function buildFinalsArticle(record) {
    return {
      kind: "finals",
      title: "🎬 Das Finale ist perfekt",

      body: paragraphs([
        fill(pick(FINALS_INTROS), record),

        "Damit ist die Ausgangslage klar: Noch ein Spiel entscheidet darüber, wer den Ring bekommt. Alles, was bis hierhin passiert ist, zählt jetzt vor allem als Vorgeschichte.",
      ]),
    };
  }

  // ======================================================================
  // CHAMPION
  // ======================================================================

  function buildChampionArticle(record) {
    return {
      kind: "champion",
      title: "👑 Wir haben einen neuen Madden Bowl Champion!",

      body: paragraphs([
        fill(pick(CHAMPION_INTROS), record),

        "Damit endet die Saison dort, wo sie angefangen hat: mit der Frage, wer am Ende ganz oben steht. Jetzt ist die Antwort bekannt – und der Name des Champions ist für die Geschichte des Madden Bowl notiert.",
      ]),
    };
  }

  // ======================================================================
  // SUPABASE
  // ======================================================================

  async function pushArticle(tournamentId, article) {
    const sb = MB.getSupabaseClient();

    if (!sb || !tournamentId) return null;

    const { data, error } = await sb
      .from("blog_articles")
      .insert({
        tournament_id: tournamentId,
        kind: article.kind,
        title: article.title,
        body: article.body,
        media_url: article.media_url || null,
        media_type: article.media_type || null,
      })
      .select()
      .single();

    if (error) {
      console.warn(
        "Artikel konnte nicht gespeichert werden:",
        error
      );
      return null;
    }

    return data;
  }

  // Manuell verfasster Beitrag durch den Admin.
  async function pushManualArticle(
    tournamentId,
    { title, body }
  ) {
    return pushArticle(tournamentId, {
      kind: "manual",
      title,
      body,
    });
  }

  // Nachträgliches Bearbeiten eines bestehenden Artikels.
  async function updateArticle(articleId, patch) {
    const sb = MB.getSupabaseClient();

    if (!sb || !articleId) return null;

    const allowed = {};

    if (patch.title !== undefined)
      allowed.title = patch.title;

    if (patch.body !== undefined)
      allowed.body = patch.body;

    if (patch.media_url !== undefined)
      allowed.media_url = patch.media_url;

    if (patch.media_type !== undefined)
      allowed.media_type = patch.media_type;

    const { data, error } = await sb
      .from("blog_articles")
      .update(allowed)
      .eq("id", articleId)
      .select()
      .single();

    if (error) {
      console.warn(
        "Artikel konnte nicht aktualisiert werden:",
        error
      );
      return null;
    }

    return data;
  }

  async function deleteArticle(articleId) {
    const sb = MB.getSupabaseClient();

    if (!sb || !articleId) return false;

    const { error } = await sb
      .from("blog_articles")
      .delete()
      .eq("id", articleId);

    if (error) {
      console.warn(
        "Artikel konnte nicht gelöscht werden:",
        error
      );
      return false;
    }

    return true;
  }

  async function fetchArticles(tournamentId, limit) {
    const sb = MB.getSupabaseClient();

    if (!sb || !tournamentId) return [];

    const { data, error } = await sb
      .from("blog_articles")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", {
        ascending: false,
      })
      .limit(limit || 50);

    if (error) {
      console.warn(
        "Artikel laden fehlgeschlagen:",
        error
      );
      return [];
    }

    return data || [];
  }

  async function countArticlesByKind(
    tournamentId,
    kind
  ) {
    const sb = MB.getSupabaseClient();

    if (!sb || !tournamentId) return 0;

    const { count, error } = await sb
      .from("blog_articles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("tournament_id", tournamentId)
      .eq("kind", kind);

    if (error) {
      console.warn(error);
      return 0;
    }

    return count || 0;
  }

  // Zählt fertige Spiele (Gruppe + Playoff).
  function countFinishedMatches(state) {
    const g = (state.matches || []).filter(
      (m) => m.s1 != null && m.s2 != null
    ).length;

    const p = (state.playoffMatches || []).filter(
      (m) =>
        MB.isFinished(m) &&
        !MB.isByeMatch(m)
    ).length;

    return g + p;
  }

  // Soll jetzt ein neuer Zwischenstands-Artikel erscheinen?
  // Alle 3 fertigen Spiele.
  function isProgressArticleDue(
    state,
    progressArticlesSoFar
  ) {
    const finished = countFinishedMatches(state);
    const threshold =
      (progressArticlesSoFar + 1) * 3;

    return (
      finished >= threshold &&
      finished > 0
    );
  }

  global.MB = global.MB || {};

  global.MB.Blog = {
    buildKickoffArticle,
    buildRetrospectiveArticle,
    buildProgressArticle,
    buildRecordArticle,
    buildSongArticle,
    buildFinalsArticle,
    buildChampionArticle,

    pushArticle,
    pushManualArticle,
    updateArticle,
    deleteArticle,
    fetchArticles,
    countArticlesByKind,
    countFinishedMatches,
    isProgressArticleDue,
  };
})(window);