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
  // POWER RANKING (früher: "Zwischenstand")
  // ----------------------------------------------------------------------
  // Die Power-Ranking-Artikel wechseln automatisch zwischen verschiedenen
  // redaktionellen Blickwinkeln:
  // Tabellenführer, Verfolger, Top 3, Spiel des Tages, Favoriten/Krise.
  // Kind bleibt intern "progress" (bestehende Artikel in der Datenbank),
  // nur die Anzeige heißt jetzt "Power Ranking".
  // ======================================================================

  // Alle wie viele fertigen Spiele erscheint ein Power Ranking? Bewusst
  // seltener als früher (3): Gesamtziel ist im Schnitt ca. ein Artikel je
  // drei Spiele über ALLE Artikelarten (Rekorde, Porträts, Memes, ...).
  const PROGRESS_EVERY = 6;

  const PROGRESS_STYLES = [
    {
      title: (count) => `Power Ranking nach ${count} Spielen`,

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
        `Power Ranking: Wer gerade Druck macht (nach ${count} Spielen)`,

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
      title: (count) => `Power Ranking: Die Tabelle nimmt Fahrt auf (${count} Spiele)`,

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
        `Power Ranking: Spieltag mit Folgen (nach ${count} Spielen)`,

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
        `Power Ranking: Favoriten unter Beobachtung (${count} Spiele)`,

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

    blowout: [
      "{player} lässt {opponent} keine Chance: {winnerScore}:{loserScore}. Bei so einem Abstand geht es nicht mehr um die Frage, wer gewonnen hat, sondern nur noch darum, wie lange man darüber redet.",
      "Manche Spiele sind früh entschieden, dieses war es wohl noch früher. {player} schlägt {opponent} mit {winnerScore}:{loserScore} und lässt kaum Fragen offen.",
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

    toiletBowl: [
      "Die Toilet Bowl ist entschieden – und für die schmerzhafteste Trophäe der Saison gibt es jetzt den passenden Disstrack.",
      "Der letzte Platz ist vergeben. Wer ihn sich \"verdient\" hat, bekommt dafür keine Blumen, sondern einen Song.",
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

    // Bei jedem neuen Power Ranking wird der nächste redaktionelle
    // Blickwinkel verwendet.
    const style =
      PROGRESS_STYLES[
        Math.floor((finishedCount - 1) / PROGRESS_EVERY) % PROGRESS_STYLES.length
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

    // Nur echte Rekorde bekommen die Kategorie "Rekord". Story-Memes und
    // Blowout-Memes (kein Rekord im historischen Sinn) laufen unter "Meme".
    const isMemeOnly = record.type === "storyMeme" || record.type === "blowout";

    return {
      kind: isMemeOnly ? "meme" : "record",
      title: `${info.emoji} ${info.label}`,
      body: paragraphs([
        intro,
        detail ? fill(detail, vars) : null,
        isMemeOnly
          ? "Das Meme zum Spiel – ohne Anspruch auf Vollständigkeit, aber mit vollem Anspruch auf Diskussion."
          : "Ein neuer Eintrag für die Madden-Bowl-Geschichtsbücher – und vermutlich Material für die nächste WhatsApp-Diskussion.",
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
      toiletBowl: "Die Toilet Bowl ist entschieden",
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
  // SPURIOUS CORRELATION
  // ----------------------------------------------------------------------
  // Erwartet ein candidate-Objekt aus MB.Spurious.findBestCandidate()/
  // findCandidates(): { pairKey, mbLabel, mbUnit, germanName, germanUnit,
  // germanSource, years, mbValues, germanValues, r }.
  // ======================================================================

  // Kategorie-abhängige Formulierung für die "Prognose": was ein weiterer
  // Anstieg bzw. Rückgang bei einer deutschen Statistik dieser Art
  // plausibel bedeuten würde. Bewusst nicht pauschal "Verknappung" für
  // alles — bei Ereignis-Zählungen (Übernachtungen, Paketsendungen) gibt es
  // keine "Knappheit", bei Preisen/Kosten ist "Verteuerung" treffender als
  // "Engpass", usw. Kategorie kommt aus GERMAN_STATS in spurious.js
  // (candidate.germanCategory); unbekannte/neutrale Kategorien (rate,
  // infrastructure, other) fallen auf schlichtes Anstieg/Rückgang zurück.
  const CATEGORY_TREND_WORDS = {
    goods: { up: "ein Überangebot", down: "ein Engpass" },
    price: { up: "eine Verteuerung", down: "eine Verbilligung" },
    revenue: { up: "ein Boom", down: "ein Einbruch" },
    events: { up: "ein Ansturm", down: "eine Flaute" },
    population: { up: "ein Zuwachs", down: "ein Schwund" },
    infrastructure: { up: "ein weiterer Ausbau", down: "ein Rückgang" },
    rate: { up: "ein weiterer Anstieg", down: "ein weiterer Rückgang" },
    other: { up: "ein weiterer Anstieg", down: "ein weiterer Rückgang" },
  };

  function trendWordFor(category, direction) {
    const words = CATEGORY_TREND_WORDS[category] || CATEGORY_TREND_WORDS.other;
    return direction === "up" ? words.up : words.down;
  }

  const SPURIOUS_INTROS = [
    "Die vorliegende Kurzanalyse untersucht den statistischen Zusammenhang zwischen zwei zunächst unabhängig erscheinenden Kennzahlen.",
    "Im Rahmen einer fortlaufenden Datenbetrachtung wurde folgender Zusammenhang identifiziert.",
    "Die folgende Auswertung dokumentiert eine bemerkenswert enge Übereinstimmung zweier Zeitreihen.",
    "Gegenstand dieser Kurzmitteilung ist eine auffällige statistische Kovarianz zweier an sich themenfremder Datenreihen.",
  ];

  const SPURIOUS_CLOSERS = [
    "Ein kausaler Mechanismus zwischen beiden Größen ist nicht belegt; die Prognose ist entsprechend mit Vorsicht zu genießen.",
    "Weitere Erhebungszeiträume könnten diesen Befund erhärten oder widerlegen — belastbar ist er in der vorliegenden Form nicht.",
    "Von einer verbindlichen Kausalaussage wird an dieser Stelle ausdrücklich abgesehen.",
    "Für eine gesicherte Aussage wäre eine deutlich breitere Datenbasis erforderlich, als sie hier vorliegt.",
  ];

  function buildSpuriousArticle(candidate) {
    // Tyler-Vigen-Style-Baustein aus spurious.js: handgeschriebene
    // Kausalgeschichte je deutscher Statistik + Richtung für die 10
    // punktbasierten Kennzahlen, generische parametrisierte Bausteine für
    // "Anzahl gespielter Partien"/"Anzahl Teilnehmer". Deckt damit alle 12
    // Madden-Bowl-Kennzahlen ab. Der alte, neutrale Befund-Text weiter unten
    // bleibt als Sicherheitsnetz, falls mal ein germanStatId ohne Baustein
    // in GERMAN_STAT_STORIES landet (z.B. künftig neu ergänzte Statistik).
    const story = MB.Spurious.buildSpuriousStory
      ? MB.Spurious.buildSpuriousStory(candidate)
      : null;

    if (story) {
      return {
        kind: "spurious",
        title: story.title,
        body: paragraphs([story.body]),
        data: {
          pairKey: candidate.pairKey,
          mbStatKey: candidate.mbStatKey,
          germanStatId: candidate.germanStatId,
          player: candidate.player || null,
          r: candidate.r,
          subtitle: story.subtitle,
        },
      };
    }

    // Kein handgeschriebener Baustein vorhanden -> neutraler Befund-Text
    // unten, aber dieselbe kurze "X vs. Y"-Schlagzeile + Lead-Satz wie beim
    // Story-Pfad (siehe buildSpuriousHeadline in spurious.js).
    const headline = MB.Spurious.buildSpuriousHeadline
      ? MB.Spurious.buildSpuriousHeadline(candidate)
      : { title: `📊 Spurious Correlation: ${candidate.mbLabel} korreliert mit „${candidate.germanName}“`, subtitle: null };

    const rStr = candidate.r.toFixed(6);
    const strength = Math.abs(candidate.r) >= 0.99 ? "nahezu perfekter" : "sehr starker";
    const direction = candidate.r >= 0 ? "gleichläufiger" : "gegenläufiger";
    const hasOrdinalMapping = Array.isArray(candidate.xLabels) && candidate.xLabels.length === candidate.years.length;

    const spanDesc = candidate.isPlayer
      ? `über die letzten ${candidate.years.length} Spiele im Turnier`
      : `über die letzten ${candidate.years.length} Turnier-Saisons`;

    const parts = [
      pick(SPURIOUS_INTROS),
      `<strong>Befund.</strong> ${candidate.mbLabel} scheint sich auf „${candidate.germanName}“ (${candidate.germanUnit}) auszuwirken — ${spanDesc} zeigt sich ein ${strength} ${direction} Zusammenhang (r = ${rStr}).`,
    ];

    if (hasOrdinalMapping) {
      const mapping = candidate.isPlayer
        ? `${candidate.player}s Spielverlauf wird der zeitlichen Reihenfolge nach den ${candidate.years.length} zuletzt verfügbaren Jahren von „${candidate.germanName}“ gegenübergestellt`
        : `Die betrachteten Turnier-Saisons werden der zeitlichen Reihenfolge nach den ${candidate.years.length} zuletzt verfügbaren Jahren von „${candidate.germanName}“ gegenübergestellt`;
      parts.push(
        `<strong>Datengrundlage.</strong> ${mapping} (älteste Beobachtung zu ältestem Jahr, jüngste zu jüngstem Jahr) — nicht notwendigerweise demselben Kalenderjahr. Quelle: ${candidate.germanSource}.`
      );
    } else {
      parts.push(`<strong>Datengrundlage.</strong> Quelle „${candidate.germanName}“: ${candidate.germanSource}.`);
    }

    // Prognose: "steigt mbStat weiter" -> was das für den deutschen Wert
    // laut diesem (Zufalls-)Befund bedeuten würde, passend zur Kategorie
    // der deutschen Statistik formuliert (siehe CATEGORY_TREND_WORDS).
    const germanDirection = candidate.r >= 0 ? "up" : "down";
    const trendWord = trendWordFor(candidate.germanCategory, germanDirection);
    const nextScopeLabel = candidate.isPlayer ? "im nächsten Spiel" : "in der nächsten Saison";
    parts.push(
      `<strong>Prognose.</strong> Sollte sich ${candidate.mbLabel} ${nextScopeLabel} noch weiter erhöhen, wäre nach diesem Befund ${trendWord} bei „${candidate.germanName}“ zu erwarten.`
    );

    parts.push(`<strong>Einordnung.</strong> ${pick(SPURIOUS_CLOSERS)}`);

    return {
      kind: "spurious",
      title: headline.title,
      body: paragraphs(parts),
      data: {
        pairKey: candidate.pairKey,
        mbStatKey: candidate.mbStatKey,
        germanStatId: candidate.germanStatId,
        player: candidate.player || null,
        subtitle: headline.subtitle,
        r: candidate.r,
      },
    };
  }

  // ======================================================================
  // SPIELERPORTRÄTS
  // ----------------------------------------------------------------------
  // Drei Artikel, die zu Turnierbeginn nach und nach erscheinen (pro
  // fertigem Spiel höchstens einer, siehe isPortraitDue):
  //   1. champion   – der Titelverteidiger alleine
  //   2. contender  – alle, die letztes Jahr weit kamen (Platz 1-3) oder
  //                   aktuell in der Gesamttabelle vorne liegen
  //   3. field      – der Rest des Feldes
  // Gruppen ohne Spieler (z.B. kein Titelverteidiger im ersten Jahr)
  // werden übersprungen. Alle Fakten kommen aus der Historie (Supabase-
  // Saisons) und dem laufenden Turnier — nichts wird erfunden.
  // ======================================================================

  const PORTRAIT_ORDER = ["champion", "contender", "field"];

  // Nach wie vielen fertigen Spielen erscheint welches Porträt?
  // (Pro Gruppe fest, unabhängig davon, ob eine andere Gruppe leer ist.)
  const PORTRAIT_AT = { champion: 2, contender: 4, field: 8 };

  function fmtDecimal(n, digits) {
    return Number(n).toFixed(digits == null ? 1 : digits).replace(".", ",");
  }

  function teamNameById(teamId) {
    const t = (MB.nflTeams || []).find((x) => x.id === teamId);
    return t ? t.n : teamId || "";
  }

  function historyStatsFor(history, name) {
    const games = (history && history.byPlayer && history.byPlayer.get(name)) || [];
    let wins = 0, losses = 0, played = 0, pointsFor = 0, bestWin = null;
    games.forEach((m) => {
      if (m.homeScore == null || m.awayScore == null) return;
      const isHome = m.homePlayer === name;
      const own = isHome ? m.homeScore : m.awayScore;
      const opp = isHome ? m.awayScore : m.homeScore;
      played++;
      pointsFor += own;
      if (own > opp) wins++;
      else if (own < opp) losses++;
      const margin = own - opp;
      if (margin > 0 && (!bestWin || margin > bestWin.margin)) {
        bestWin = { margin, own, opp, vs: isHome ? m.awayPlayer : m.homePlayer, season: m.season };
      }
    });
    return { played, wins, losses, ppg: played ? pointsFor / played : null, bestWin };
  }

  function lastSeasonRanks(history) {
    const seasons = [...((history && history.seasons) || [])].sort((a, b) => (b.season || 0) - (a.season || 0));
    const standings = seasons[0] && Array.isArray(seasons[0].standings) ? seasons[0].standings : [];
    const out = new Map();
    standings.forEach((s) => out.set(MB.normName(s.name).toLowerCase(), Number(s.rank)));
    return { ranks: out, year: seasons[0] ? seasons[0].season : null };
  }

  // Teilt die aktuellen Spieler in die drei Porträt-Gruppen ein.
  function computePortraitGroups(state, history) {
    const players = state.players || [];
    const names = players.map((p) => p.name).filter(Boolean);
    const safeHistory = history || { seasons: [], matches: [], byPlayer: new Map() };
    const badges = MB.computeRingIntroBadges ? MB.computeRingIntroBadges(safeHistory, names) : new Map();
    const { ranks } = lastSeasonRanks(safeHistory);

    const tableTop = [...players]
      .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.diff || 0) - (a.diff || 0))
      .filter((p) => (p.wins || 0) > 0)
      .slice(0, 3)
      .map((p) => p.name);

    const groups = { champion: [], contender: [], field: [] };
    names.forEach((name) => {
      const key = name.toLowerCase();
      const badge = badges.get(key) || {};
      const rank = ranks.get(key);
      if (badge.isDefendingChampion) groups.champion.push(name);
      else if ((rank && rank <= 3) || tableTop.includes(name)) groups.contender.push(name);
      else groups.field.push(name);
    });

    // Titelverteidiger spielt nicht mit -> der heißeste Anwärter bekommt
    // dessen Porträt-Slot (Gruppe "champion", gleiche Fälligkeit). Nur wenn
    // es überhaupt einen Vorjahressieger gibt, der jetzt fehlt.
    const previousChampion = lastSeasonChampionName(safeHistory);
    let championAbsent = false;
    if (!groups.champion.length && previousChampion) {
      const challenger = pickHottestChallenger(names, badges, ranks, safeHistory);
      if (challenger) {
        groups.contender = groups.contender.filter((n) => n !== challenger);
        groups.field = groups.field.filter((n) => n !== challenger);
        groups.champion = [challenger];
        championAbsent = true;
      }
    }
    return { groups, badges, ranks, championAbsent, previousChampion };
  }

  // Name des Vorjahres-Champions (Platz 1 der letzten Saison) oder null.
  function lastSeasonChampionName(history) {
    const seasons = [...((history && history.seasons) || [])].sort((a, b) => (b.season || 0) - (a.season || 0));
    const standings = seasons[0] && Array.isArray(seasons[0].standings) ? seasons[0].standings : [];
    const champ = standings.find((s) => Number(s.rank) === 1);
    return champ ? MB.normName(champ.name) : null;
  }

  // Heißester Anwärter, wenn der Titelverteidiger fehlt. Reihenfolge der
  // Kriterien (nur Spieler mit Historie; rein aus Historie, damit die Wahl
  // über das Turnier stabil bleibt):
  //   1. beste Platzierung in der letzten Saison (Finalist vor Platz 3 ...)
  //   2. meiste Titel insgesamt
  //   3. beste Gesamt-Siegquote
  // Gibt null zurück, wenn niemand Historie hat (z.B. nur Rookies).
  function pickHottestChallenger(names, badges, ranks, history) {
    const cands = names
      .map((name) => {
        const key = name.toLowerCase();
        const badge = badges.get(key) || {};
        if (badge.isRookie) return null;
        const stats = historyStatsFor(history, name);
        return { name, rank: ranks.get(key) || 99, titles: badge.titles || 0, winPct: stats.played ? stats.wins / stats.played : 0 };
      })
      .filter(Boolean);
    if (!cands.length) return null;
    cands.sort((a, b) => a.rank - b.rank || b.titles - a.titles || b.winPct - a.winPct || a.name.localeCompare(b.name));
    return cands[0].name;
  }

  function describePortraitPlayer(name, state, history, badge, lastRank) {
    const player = (state.players || []).find((p) => p.name === name);
    const team = player && player.team ? teamNameById(player.team) : null;
    const stats = historyStatsFor(history, name);
    const teamHistory =
      player && player.team && history && MB.computeTeamTitleHistory
        ? MB.computeTeamTitleHistory(history).get(player.team)
        : null;
    const sentences = [];

    if (badge.isRookie) {
      sentences.push("Für ihn ist es der erste Madden Bowl – keine Historie, keine Rekorde, aber auch noch keine Niederlagen, die man ihm vorhalten könnte.");
    } else {
      const seasonsPlayed = badge.seasonsPlayed || 0;
      let line = `Er ist bereits ${seasonsPlayed} ${seasonsPlayed === 1 ? "Saison" : "Saisons"} dabei`;
      if (stats.played) {
        line += `, Gesamtbilanz ${stats.wins}:${stats.losses}`;
        if (stats.ppg != null) line += ` bei durchschnittlich ${fmtDecimal(stats.ppg)} Punkten pro Spiel`;
      }
      sentences.push(line + ".");
    }

    if (badge.titles > 0) {
      let t = badge.titles === 1 ? "Ein Titel steht bereits auf seinem Konto" : `${badge.titles} Titel stehen bereits auf seinem Konto`;
      if (badge.isSoleRecordChampion) t += " – damit ist er alleiniger Rekordchampion";
      sentences.push(t + ".");
    }

    if (lastRank) {
      if (lastRank === 1) sentences.push("Letzte Saison holte er den Titel.");
      else if (lastRank === 2) sentences.push("Letzte Saison verlor er das Finale.");
      else sentences.push(`Letzte Saison beendete er das Turnier auf Platz ${lastRank}.`);
    }

    if (badge.isAllTimeHighScoreHolder && badge.allTimeHighScore > 0) {
      sentences.push(`Außerdem hält er mit ${badge.allTimeHighScore} Punkten den Allzeit-Punkterekord in einem Spiel.`);
    }

    if (stats.bestWin) {
      const b = stats.bestWin;
      sentences.push(`Sein höchster Sieg: ${b.own}:${b.opp} gegen ${b.vs}${b.season ? ` (Saison ${b.season})` : ""}.`);
    }

    if (teamHistory && teamHistory.count > 0 && team) {
      sentences.push(
        `Sein Team hat übrigens Titel-Tradition: Die ${team} wurden schon ${teamHistory.count}× Madden-Bowl-Champion, zuletzt mit ${teamHistory.lastWinnerName} (${teamHistory.lastSeason}).`
      );
    }

    return { team, text: sentences.join(" ") };
  }

  const PORTRAIT_TEXT = {
    champion: {
      title: (names) => `👑 Titelverteidiger: ${names[0]}`,
      openers: [
        "Wer den Ring trägt, trägt auch das Fadenkreuz. Ab sofort weiß jeder im Feld, wen er schlagen muss, wenn er selbst irgendwann etwas gewinnen will.",
        "Jeder Titelverteidiger startet mit einem Vorsprung – und mit dem unangenehmen Gefühl, dass alle anderen ein bisschen mehr wollen als er.",
      ],
      closers: [
        "Ob das für eine Titelverteidigung reicht, zeigen die nächsten Wochen. Verteidigen ist bekanntlich schwerer als Angreifen.",
        "Die Krone sitzt – die Frage ist nur, wie lange.",
      ],
    },
    // Titelverteidiger fehlt: {prev} = Name des Vorjahres-Champions.
    challenger: {
      title: (names) => `🔥 Der heißeste Anwärter: ${names[0]}`,
      openers: [
        "Der Titelverteidiger {prev} ist diesmal nicht dabei, der Thron steht leer. Umso spannender die Frage, wer als Erster danach greift. Hier kommt der mit den besten Karten.",
        "Ohne {prev} gibt es keinen Titelverteidiger, den alle jagen. Dafür gibt es einen, dem man die Krone am ehesten zutraut.",
      ],
      closers: [
        "Anwärter heißt nicht Sieger. Aber irgendjemand muss die Favoritenrolle ja spielen.",
        "Ob die Favoritenrolle Rückenwind oder Bürde ist, zeigt sich in den nächsten Spielen.",
      ],
    },
    contender: {
      title: () => "🎯 Die Contender",
      openers: [
        "Neben dem Titelverteidiger gibt es Spieler, die dieses Turnier nicht nur mitspielen, sondern gewinnen wollen. Hier sind die, denen man es zutraut.",
        "Wer letztes Jahr weit gekommen ist oder jetzt schon oben in der Tabelle steht, gehört zum engeren Favoritenkreis. Ein Blick auf die Kandidaten.",
      ],
      // Ohne Titelverteidiger im Turnier passt "Neben dem Titelverteidiger" nicht.
      openersNoDefender: [
        "Ohne Titelverteidiger ist das Rennen offen. Hier sind die, denen man es zutraut.",
        "Wer letztes Jahr weit gekommen ist oder jetzt schon oben in der Tabelle steht, gehört zum engeren Favoritenkreis. Ein Blick auf die Kandidaten.",
      ],
      closers: [
        "Einer von ihnen wird am Ende vermutlich ganz oben stehen. Vermutlich. Beim Madden Bowl ist das nie garantiert.",
        "Papierform ist schön – aber gespielt wird auf dem Rasen.",
      ],
    },
    field: {
      title: (names, ctx) => (ctx && ctx.rookies && ctx.rookies.length ? "🐣 Die Rookies & der Rest des Feldes" : "🏈 Der Rest des Feldes"),
      openers: [
        "Nicht jeder ist Favorit, und genau das macht ein Turnier interessant. Hier kommt der Rest des Feldes – die Außenseiter, die Überraschungskandidaten und alle, die noch etwas beweisen wollen.",
        "Ohne Außenseiter gäbe es keine Überraschungen. Deshalb bekommt auch der Rest des Feldes sein Porträt.",
      ],
      closers: [
        "Außenseiter haben einen Vorteil: Erwartet wird nichts von ihnen. Das ändert sich mit dem ersten Sieg gegen einen Favoriten.",
        "Wer hier unterschätzt wird, hat mindestens ein Spiel lang die Chance, alle eines Besseren zu belehren.",
      ],
    },
  };

  // Liefert die nächste noch nicht veröffentlichte, nicht-leere Gruppe
  // (Reihenfolge: Titelverteidiger, Contender, Rest) oder null.
  function nextPortraitGroup(state, history, publishedGroups) {
    const { groups } = computePortraitGroups(state, history);
    const done = publishedGroups || new Set();
    return PORTRAIT_ORDER.find((g) => groups[g].length && !done.has(g)) || null;
  }

  // Fällig ist das nächste unveröffentlichte Porträt, sobald seine
  // Spielzahl (PORTRAIT_AT) erreicht ist. Pro Speichern höchstens eines.
  function isPortraitDue(state, publishedGroups, history) {
    const group = nextPortraitGroup(state, history, publishedGroups);
    return !!group && countFinishedMatches(state) >= PORTRAIT_AT[group];
  }

  function buildPortraitArticle(group, state, history) {
    const { groups, badges, ranks, championAbsent, previousChampion } = computePortraitGroups(state, history);
    const names = groups[group] || [];
    if (!names.length) return null;

    const isChallenger = group === "champion" && championAbsent;
    const text = isChallenger ? PORTRAIT_TEXT.challenger : PORTRAIT_TEXT[group];
    const rookies = names.filter((n) => (badges.get(n.toLowerCase()) || {}).isRookie);
    const hasDefender = !!groups.champion.length && !championAbsent;
    const openerPool = group === "contender" && !hasDefender && text.openersNoDefender ? text.openersNoDefender : text.openers;
    const parts = [pick(openerPool).replace(/\{prev\}/g, previousChampion || "Der Titelverteidiger")];
    if (group === "field" && rookies.length) {
      parts.push(`Besonders im Blick: ${rookies.length === 1 ? "der Rookie" : "die Rookies"} ${rookies.join(", ")} – ${rookies.length === 1 ? "er ist" : "sie sind"} zum ersten Mal beim Madden Bowl dabei.`);
    }
    names.forEach((name) => {
      const key = name.toLowerCase();
      const d = describePortraitPlayer(name, state, history, badges.get(key) || {}, ranks.get(key));
      parts.push(`<strong>${name}</strong>${d.team ? ` (${d.team})` : ""}\n${d.text}`);
    });
    parts.push(pick(text.closers));

    return {
      kind: "portrait",
      title: text.title(names, { rookies }),
      body: paragraphs(parts),
      data: isChallenger ? { group, players: names, challenger: true } : { group, players: names },
    };
  }

  // ======================================================================
  // ABSCHLUSS-ARTIKEL (Siegerehrung + Turnierzusammenfassung in einem)
  // ----------------------------------------------------------------------
  // Erscheint, sobald das Finalergebnis eingetragen ist — zusätzlich zum
  // kurzen Champion-Rekordartikel.
  // ======================================================================
  function buildWrapUpArticle(state, history) {
    const gf = MB.getPlayoffMatch(state, "gf");
    const champion = gf ? MB.winnerOf(gf) : null;
    const runnerUp = gf ? MB.loserOf(gf) : null;
    if (!champion || !runnerUp) return null;

    const ranking = MB.computeFinalRanking(state);
    const ordered = ranking.ordered || [];
    const third = ordered[2] || null;
    const matches = MB.getCurrentMatchesNormalized(state);

    let totalPoints = 0, highScore = null, bigMargin = null, highTotal = null;
    matches.forEach((m) => {
      totalPoints += m.total;
      [[m.homePlayer, m.homeScore, m.awayPlayer, m.awayScore], [m.awayPlayer, m.awayScore, m.homePlayer, m.homeScore]].forEach(([p, s, o, os]) => {
        if (!highScore || s > highScore.score) highScore = { player: p, score: s, opponent: o, oppScore: os };
      });
      const margin = Math.abs(m.homeScore - m.awayScore);
      if (margin > 0 && (!bigMargin || margin > bigMargin.margin)) {
        const homeWon = m.homeScore > m.awayScore;
        bigMargin = {
          margin,
          winner: homeWon ? m.homePlayer : m.awayPlayer,
          loser: homeWon ? m.awayPlayer : m.homePlayer,
          score: `${Math.max(m.homeScore, m.awayScore)}:${Math.min(m.homeScore, m.awayScore)}`,
        };
      }
      if (!highTotal || m.total > highTotal.total) highTotal = { total: m.total, a: m.homePlayer, b: m.awayPlayer };
    });

    const titlesBefore = (history && history.ringsByPlayer && history.ringsByPlayer.get(champion.name)) || 0;
    const titleNo = titlesBefore + 1;
    const fw = Math.max(gf.s1, gf.s2), fl = Math.min(gf.s1, gf.s2);

    const parts = [];
    parts.push(
      `${champion.name} ist Madden Bowl Champion: ${fw}:${fl} im Finale gegen ${runnerUp.name}. ${
        titleNo === 1 ? "Für ihn ist es der erste Titel überhaupt." : `Es ist bereits Titel Nummer ${titleNo}.`
      }`
    );

    const podium = [`🥇 ${champion.name}`, `🥈 ${runnerUp.name}`];
    if (third) podium.push(`🥉 ${third.name}`);
    parts.push(`<strong>Die Siegerehrung.</strong> ${podium.join("   ")}`);

    const seeds = MB.getGroupSeedsFinal ? MB.getGroupSeedsFinal(state) : new Map();
    const topSeed = [...seeds.entries()].find(([, seed]) => seed === 1);
    if (topSeed) {
      parts.push(
        topSeed[0] === champion.name
          ? `<strong>Der Weg.</strong> ${champion.name} ging als Nummer 1 der Gruppenphase ins Turnier und wurde der Favoritenrolle gerecht.`
          : `<strong>Der Weg.</strong> Die Gruppenphase beendete ${topSeed[0]} als Nummer 1 – am Ende jubelt trotzdem ${champion.name}. So schnell kann eine Favoritenrolle wertlos werden.`
      );
    }

    const facts = [`In ${matches.length} Spielen fielen ${totalPoints} Punkte (Ø ${fmtDecimal(totalPoints / Math.max(matches.length, 1))} pro Spiel).`];
    if (highScore) facts.push(`Höchste Einzelleistung: ${highScore.player} mit ${highScore.score} Punkten gegen ${highScore.opponent}.`);
    if (bigMargin) facts.push(`Deutlichster Sieg: ${bigMargin.winner} gegen ${bigMargin.loser}, ${bigMargin.score}.`);
    if (highTotal) facts.push(`Punktreichstes Spiel: ${highTotal.a} gegen ${highTotal.b} mit zusammen ${highTotal.total} Punkten.`);
    parts.push(`<strong>Die Zahlen.</strong> ${facts.join(" ")}`);

    const tb = MB.getPlayoffMatch(state, "tb");
    const tbWinner = MB.winnerOf(tb), tbLoser = MB.loserOf(tb);
    if (tb && tbWinner && tbLoser) {
      parts.push(`<strong>Die Toilet Bowl.</strong> ${tbWinner.name} setzt sich gegen ${tbLoser.name} durch – und darf sich damit über die undankbarste Trophäe des Turniers freuen.`);
    }

    parts.push("Damit ist die Saison Geschichte. Alle Zahlen wandern in die Hall of Fame – und ab jetzt gilt wieder das Wichtigste beim Madden Bowl: Bis zur Revanche wird fleißig diskutiert.");

    return {
      kind: "wrapup",
      title: "🏆 Siegerehrung & Turnierrückblick",
      body: paragraphs(parts),
      data: { champion: champion.name, runnerUp: runnerUp.name },
    };
  }

  async function getPublishedPortraitGroups(tournamentId) {
    const articles = await fetchArticles(tournamentId, 200);
    const out = new Set();
    (articles || []).forEach((a) => {
      if (a.kind === "portrait" && a.data && a.data.group) out.add(a.data.group);
    });
    return out;
  }

  // ======================================================================
  // SUPABASE
  // ======================================================================

  let lastPushArticleError = null; // Diagnose-Hilfe für publishSpuriousToBlog() u.ä., siehe getLastPushArticleError()

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
        data: article.data || null,
      })
      .select()
      .single();

    if (error) {
      console.warn(
        "Artikel konnte nicht gespeichert werden:",
        error
      );
      lastPushArticleError = error;
      return null;
    }

    lastPushArticleError = null;
    return data;
  }

  // Liefert das zuletzt bei pushArticle() aufgetretene Supabase-/Postgres-
  // Fehlerobjekt (oder null), damit Aufrufer bei einem Fehlschlag den
  // TATSÄCHLICHEN Grund anzeigen können statt nur zu raten.
  function getLastPushArticleError() {
    return lastPushArticleError;
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

  // Wie fetchArticles(), aber ohne Turnier-Filter -- der Blog ist ein
  // seitenweiter Feed uber alle Saisons hinweg (Saisonrueckblicke etc.
  // sollen auch nach Turnierwechsel/-abschluss weiter auftauchen).
  async function fetchAllArticles(limit) {
    const sb = MB.getSupabaseClient();

    if (!sb) return [];

    const { data, error } = await sb
      .from("blog_articles")
      .select("*")
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

  // Liefert die Menge bereits in diesem Turnier veröffentlichter
  // Spurious-Correlation-Paarungen (als "mbStatKey::germanStatId"-Strings),
  // damit MB.Spurious.findBestCandidate() keine Wiederholung vorschlägt.
  async function getUsedSpuriousPairKeys(tournamentId) {
    const articles = await fetchArticles(tournamentId, 200);
    const out = new Set();
    (articles || []).forEach((a) => {
      // auch Paarungen, die schon in einem Power Ranking vorkamen
      if ((a.kind === "spurious" || a.kind === "progress") && a.data && a.data.pairKey) out.add(a.data.pairKey);
    });
    return out;
  }

  // Soll jetzt ein neuer Power-Ranking-Artikel erscheinen?
  // Alle PROGRESS_EVERY fertigen Spiele.
  function isProgressArticleDue(
    state,
    progressArticlesSoFar
  ) {
    const finished = countFinishedMatches(state);
    const threshold =
      (progressArticlesSoFar + 1) * PROGRESS_EVERY;

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
    buildSpuriousArticle,
    buildPortraitArticle,
    buildWrapUpArticle,

    PROGRESS_EVERY,
    PORTRAIT_ORDER,
    PORTRAIT_AT,
    computePortraitGroups,
    nextPortraitGroup,
    isPortraitDue,
    getPublishedPortraitGroups,

    pushArticle,
    getLastPushArticleError,
    pushManualArticle,
    updateArticle,
    deleteArticle,
    fetchArticles,
    fetchAllArticles,
    countArticlesByKind,
    countFinishedMatches,
    isProgressArticleDue,
    getUsedSpuriousPairKeys,
  };
})(window);