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

  // ----------------------------------------------------------------------
  // STORY ENGINE
  // ----------------------------------------------------------------------
  // Die 101 externen Statistiken bekommen hier jeweils eine feste semantische
  // "Storyline": keine neue Statistik, keine neue Kausalität, sondern eine
  // bewusst absurde Brücke zwischen dem Namen der Statistik und der Madden-
  // Kennzahl. Die Texte werden deterministisch aus diesen Bausteinen erzeugt,
  // sodass keine LLM-/API-Kosten entstehen.
  //
  // Spezifische IDs können mit overrides überschrieben werden. Für die übrigen
  // Statistiken greift die Themenfamilie aus dem Namen + der Kategorie.
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // Sprachliche Beschreibungen
  // ----------------------------------------------------------------------
  // Die Rohdaten liefern nur einen Statistiknamen. Für natürliche deutsche
  // Sätze brauchen wir aber je nach Statistik unterschiedliche grammatische
  // Formen (z. B. "die Zahl der Lebendgeborenen", "der Bierabsatz", ...).
  // Deshalb speichern wir hier keine bloßen Wörter, sondern sprachliche
  // Rollen. Die Engine kann dieselbe Statistik dadurch in verschiedenen
  // Satzkonstruktionen verwenden, ohne Grammatik zu zerlegen.

  const GERMAN_STORY_OVERRIDES = {
    "lebendgeborene": {
      subject: "die Zahl der Lebendgeborenen",
      genitive: "der Lebendgeborenen",
      rising: "steigenden Zahl der Lebendgeborenen",
      object: "die Zahl der Lebendgeborenen",
    },
    "gesamtbevolkerung-deutschland": {
      subject: "die Gesamtbevölkerung Deutschlands",
      genitive: "der Gesamtbevölkerung Deutschlands",
      rising: "wachsenden Gesamtbevölkerung Deutschlands",
      object: "die Gesamtbevölkerung Deutschlands",
    },
    "bierabsatz-deutschland": {
      subject: "der Bierabsatz in Deutschland",
      genitive: "des Bierabsatzes in Deutschland",
      rising: "steigenden Bierabsatzes in Deutschland",
      object: "den Bierabsatz in Deutschland",
    },
    "bierverbrauch-je-einwohner": {
      subject: "der Bierverbrauch pro Einwohner",
      genitive: "des Bierverbrauchs pro Einwohner",
      rising: "steigenden Bierverbrauchs pro Einwohner",
      object: "den Bierverbrauch pro Einwohner",
    },
    "eheschlieungen": {
      subject: "die Zahl der Eheschließungen",
      genitive: "der Eheschließungen",
      rising: "steigenden Zahl der Eheschließungen",
      object: "die Zahl der Eheschließungen",
    },
    "ehescheidungen": {
      subject: "die Zahl der Ehescheidungen",
      genitive: "der Ehescheidungen",
      rising: "steigenden Zahl der Ehescheidungen",
      object: "die Zahl der Ehescheidungen",
    },
    "kinobesucher-deutschland": {
      subject: "die Zahl der Kinobesucher in Deutschland",
      genitive: "der Kinobesucher in Deutschland",
      rising: "steigenden Zahl der Kinobesucher in Deutschland",
      object: "die Zahl der Kinobesucher in Deutschland",
    },
    "paketsendungen": {
      subject: "die Zahl der Paketsendungen",
      genitive: "der Paketsendungen",
      rising: "steigenden Zahl der Paketsendungen",
      object: "die Zahl der Paketsendungen",
    },
    "paketmarkt-umsatz": {
      subject: "der Umsatz des Paketmarkts",
      genitive: "des Umsatzes des Paketmarkts",
      rising: "steigenden Umsatzes des Paketmarkts",
      object: "den Umsatz des Paketmarkts",
    },
    "onlinehandel-deutschland": {
      subject: "der Onlinehandel in Deutschland",
      genitive: "des Onlinehandels in Deutschland",
      rising: "wachsenden Onlinehandels in Deutschland",
      object: "den Onlinehandel in Deutschland",
    },
    "kartoffelernte-deutschland": {
      subject: "die Kartoffelernte in Deutschland",
      genitive: "der Kartoffelernte in Deutschland",
      rising: "steigenden Kartoffelernte in Deutschland",
      object: "die Kartoffelernte in Deutschland",
    },
    "super-bowl-zuschauer-usa": {
      subject: "die Zahl der Super-Bowl-Zuschauer in den USA",
      genitive: "der Super-Bowl-Zuschauer in den USA",
      rising: "steigenden Zahl der Super-Bowl-Zuschauer in den USA",
      object: "die Zahl der Super-Bowl-Zuschauer in den USA",
    },
    "super-bowl-werbung-30-sek-spot": {
      subject: "der Preis eines 30-Sekunden-Werbespots beim Super Bowl",
      genitive: "des Preises eines 30-Sekunden-Werbespots beim Super Bowl",
      rising: "steigenden Preises eines 30-Sekunden-Werbespots beim Super Bowl",
      object: "den Preis eines 30-Sekunden-Werbespots beim Super Bowl",
    },
    "fitnessstudio-mitglieder": {
      subject: "die Zahl der Fitnessstudio-Mitglieder",
      genitive: "der Fitnessstudio-Mitglieder",
      rising: "steigenden Zahl der Fitnessstudio-Mitglieder",
      object: "die Zahl der Fitnessstudio-Mitglieder",
    },
    "fahrrad-e-bike-durchschnittlicher-verkaufspreis": {
      subject: "der durchschnittliche Verkaufspreis von Fahrrädern und E-Bikes",
      genitive: "des durchschnittlichen Verkaufspreises von Fahrrädern und E-Bikes",
      rising: "steigenden durchschnittlichen Verkaufspreises von Fahrrädern und E-Bikes",
      object: "den durchschnittlichen Verkaufspreis von Fahrrädern und E-Bikes",
    },
    "durchschnittlicher-e-bike-preis": {
      subject: "der durchschnittliche E-Bike-Preis",
      genitive: "des durchschnittlichen E-Bike-Preises",
      rising: "steigenden durchschnittlichen E-Bike-Preises",
      object: "den durchschnittlichen E-Bike-Preis",
    },
    "globale-musikindustrie-recorded-music-umsatz": {
      subject: "der Umsatz der globalen Musikindustrie mit Recorded Music",
      genitive: "des Umsatzes der globalen Musikindustrie mit Recorded Music",
      rising: "steigenden Umsatzes der globalen Musikindustrie mit Recorded Music",
      object: "den Umsatz der globalen Musikindustrie mit Recorded Music",
    },
    "globale-musikindustrie-subscription-streaming-umsatz": {
      subject: "der Umsatz mit Musik-Streaming-Abos weltweit",
      genitive: "des Umsatzes mit Musik-Streaming-Abos weltweit",
      rising: "steigenden Umsatzes mit Musik-Streaming-Abos weltweit",
      object: "den Umsatz mit Musik-Streaming-Abos weltweit",
    },
    "unternehmensinsolvenzen": {
      subject: "die Zahl der Unternehmensinsolvenzen",
      genitive: "der Unternehmensinsolvenzen",
      rising: "steigenden Zahl der Unternehmensinsolvenzen",
      object: "die Zahl der Unternehmensinsolvenzen",
    },
  };

  function quoteName(name) {
    return `„${name}“`;
  }

  function germanDescriptor(candidate) {
    const id = candidate.germanStatId || "";
    if (GERMAN_STORY_OVERRIDES[id]) return GERMAN_STORY_OVERRIDES[id];

    const name = candidate.germanName || "der Statistik";
    const lower = name.toLowerCase();

    // Häufige Wortformen, die sich zuverlässig aus dem Namen ableiten lassen.
    if (/^(zahl|anzahl) /.test(lower) || /\b(anzahl|zahl)\b/.test(lower)) {
      return { subject: `die ${name.replace(/^(die |der |das )/i, "")}`, genitive: name, rising: `steigenden ${name}`, object: `die ${name}` };
    }
    if (/^verbrauch /.test(lower) || /verbrauch/.test(lower)) {
      return { subject: `der ${name}`, genitive: `des ${name}`, rising: `steigenden ${name}`, object: `den ${name}` };
    }
    if (/^(umsatz|preis|wert|betrag|absatz|ertrag|gewinn|verbrauch)/i.test(name)) {
      const article = /^(umsatz|preis|wert|betrag|absatz|ertrag|gewinn|verbrauch)/i.test(name) ? "der" : "die";
      const stem = name.replace(/^(der |die |das )/i, "");
      return article === "der"
        ? { subject: `der ${stem}`, genitive: `des ${stem}`, rising: `steigenden ${stem}`, object: `den ${stem}` }
        : { subject: `die ${stem}`, genitive: `der ${stem}`, rising: `steigenden ${stem}`, object: `die ${stem}` };
    }
    if (/produktion|ernte|nachfrage|bevölkerung|fläche|leistung|produktion|wirtschaft/i.test(lower)) {
      return { subject: `die ${name}`, genitive: `der ${name}`, rising: `steigenden ${name}`, object: `die ${name}` };
    }

    return {
      subject: quoteName(name),
      genitive: quoteName(name),
      rising: `steigenden ${quoteName(name)}`,
      object: quoteName(name),
    };
  }

  const MB_STORY_OVERRIDES = {
    totalPoints: {
      subject: "die Gesamtpunkte des Madden Bowl",
      afterMit: "den Gesamtpunkten des Madden Bowl",
      rising: "steigenden Gesamtpunkten des Madden Bowl",
      with: "mit den Gesamtpunkten des Madden Bowl",
    },
    avgPerGame: {
      subject: "der Punkteschnitt pro Spiel",
      afterMit: "dem Punkteschnitt pro Spiel",
      rising: "steigenden Punkteschnitt pro Spiel",
      with: "mit dem Punkteschnitt pro Spiel",
    },
    gamesPlayed: {
      subject: "die Anzahl der gespielten Partien",
      afterMit: "der Anzahl der gespielten Partien",
      rising: "steigenden Anzahl der gespielten Partien",
      with: "mit der Anzahl der gespielten Partien",
    },
    highestSingle: {
      subject: "der höchste Einzel-Score der Saison",
      afterMit: "dem höchsten Einzel-Score der Saison",
      rising: "steigenden Einzel-Score der Saison",
      with: "mit dem höchsten Einzel-Score der Saison",
    },
    biggestMargin: {
      subject: "die größte Punktedifferenz der Saison",
      afterMit: "der größten Punktedifferenz der Saison",
      rising: "steigenden Punktedifferenz",
      with: "mit der größten Punktedifferenz der Saison",
    },
    closestMargin: {
      subject: "der knappste Sieg der Saison",
      afterMit: "dem knappsten Sieg der Saison",
      rising: "knapper werdenden Siegen",
      with: "mit dem knappsten Sieg der Saison",
    },
    playerCount: {
      subject: "die Anzahl der Teilnehmer",
      afterMit: "der Anzahl der Teilnehmer",
      rising: "steigenden Anzahl der Teilnehmer",
      with: "mit der Anzahl der Teilnehmer",
    },
    championPoints: {
      subject: "die Punkte des Champions",
      afterMit: "den Punkten des Champions",
      rising: "steigenden Punkten des Champions",
      with: "mit den Punkten des Champions",
    },
  };

  function mbDescriptor(candidate) {
    const key = candidate.mbStatKey;
    if (MB_STORY_OVERRIDES[key]) return MB_STORY_OVERRIDES[key];
    const label = candidate.mbLabel || "der Madden-Bowl-Kennzahl";
    return {
      subject: label,
      afterMit: label,
      rising: `steigenden ${label}`,
      with: `mit ${label}`,
    };
  }

  const STORY_OVERRIDES = {
    "lebendgeborene": {
      subject: "Babys und Nachwuchs",
      bridge: ({ mb, german }) => `Mit jedem neuen Erdenbürger wächst schließlich auch die Zahl der potenziellen Fans. ${german.subject} könnte damit auf höchst indirektem Weg beeinflussen, wie viel ${mb.subject} später auf dem virtuellen Football-Feld zusammenkommt. Was heute im Kreißsaal beginnt, könnte Jahre später in den Madden-Statistiken auftauchen.`,
      punch: "Offenbar beginnt die Vorbereitung auf den nächsten Madden Bowl deutlich früher als gedacht."
    },
    "gesamtbevolkerung-deutschland": {
      subject: "Mehr Menschen, mehr Madden",
      bridge: ({ mb, german }) => `Mehr Menschen bedeuten auch mehr potenzielle Spieler, Zuschauer und Diskussionen über Madden. Wenn ${german.subject} wächst, gibt es schließlich mehr Menschen, die ${mb.subject} überhaupt erzeugen, verfolgen oder kommentieren können.`,
      punch: "Demografisches Wachstum wird damit plötzlich zur Spieltagsstatistik."
    },
    "bierabsatz-deutschland": {
      subject: "Football-Abende und Bier",
      bridge: ({ mb, german }) => `Ein spannender Madden-Abend braucht schließlich die passende Getränkeversorgung. Wenn ${mb.subject} besonders viel Aufmerksamkeit bindet, kann man sich leicht vorstellen, dass auch ${german.subject} im Kühlschrank eine Rolle spielt.`,
      punch: "Touchdowns rein, Bierabsatz raus – die Getränkewirtschaft dürfte genau hinschauen."
    },
    "bierverbrauch-je-einwohner": {
      subject: "Madden-Abende und Getränke",
      bridge: ({ mb, german }) => `Wer einen langen Abend mit Madden verbringt, braucht irgendwann eine Erfrischung. Ein besonders intensiver Spielverlauf könnte damit auf wundersame Weise mit ${german.subject} zusammenfallen.`,
      punch: "Vielleicht ist der wahre Spielplan nicht auf dem Bildschirm, sondern im Kühlschrank."
    },
    "kinobesucher-deutschland": {
      subject: "Unterhaltung und Publikum",
      bridge: ({ mb, german }) => `Madden ist schließlich auch Unterhaltung. Wenn ${mb.subject} mehr Aufmerksamkeit erzeugt, könnte ein Teil dieses Publikums anschließend auf der Suche nach der nächsten großen Show direkt ins Kino weiterziehen – und damit ${german.subject} anschieben.`,
      punch: "Vom virtuellen Rasen direkt auf die große Leinwand – ein überraschend kurzer Weg."
    },
    "paketsendungen": {
      subject: "Online-Shopping und Belohnungen",
      bridge: ({ mb, german }) => `Nach einem erfolgreichen Madden-Abend muss eine Belohnung her: ein neues Controller-Kabel, ein Trikot oder das nächste Gaming-Gadget. Irgendwann klingelt dafür der Paketbote, und schon lässt sich ${german.subject} wunderbar in die Geschichte einbauen.`,
      punch: "Der Madden Bowl könnte damit indirekt zum Konjunkturprogramm für Paketboten werden."
    },
    "onlinehandel-deutschland": {
      subject: "Shopping und Gaming",
      bridge: ({ mb, german }) => `Wo gespielt wird, wird auch gekauft: Controller, Konsolen, Fernseher und Zubehör warten nur darauf, dass ${mb.subject} den nächsten Kaufimpuls auslöst. So landet ein Teil der virtuellen Spannung möglicherweise im ${german.subject}.`,
      punch: "Der virtuelle Football-Platz könnte damit einen erstaunlich realen Warenkorb füllen."
    },
    "kartoffelernte-deutschland": {
      subject: "Football-Snacks",
      bridge: ({ mb, german }) => `Ein Madden-Abend ohne Snacks wäre kaum vorstellbar. Pommes, Chips und andere Kartoffelprodukte begleiten schließlich jede ernsthafte Analyse von ${mb.subject}. Wenn die Saison läuft, könnte das damit auf geheimnisvolle Weise sogar bei ${german.subject} Spuren hinterlassen.`,
      punch: "Vielleicht wird die nächste Kartoffelernte deshalb bereits im Spielplan mitgerechnet."
    },
    "super-bowl-zuschauer-usa": {
      subject: "Football-Euphorie",
      bridge: ({ mb, german }) => `Mehr ${mb.subject} bedeutet mehr Aufmerksamkeit für Football – und Aufmerksamkeit ist bekanntlich ansteckend. Was mit einem virtuellen Spiel beginnt, könnte so bis zu ${german.subject} reichen.`,
      punch: "Der Madden Bowl wäre damit überraschend nah am echten Football-Geschäft."
    },
    "super-bowl-werbung-30-sek-spot": {
      subject: "Football und Werbemillionen",
      bridge: ({ mb, german }) => `Wo ${mb.subject} für Aufmerksamkeit sorgt, wird auch Werbung interessant. Jeder zusätzliche Zuschauer ist schließlich eine weitere Gelegenheit, einen kurzen Werbespot zwischen zwei Spielzügen zu platzieren – und damit den Preis von ${german.subject} zumindest in dieser Geschichte mitzubewegen.`,
      punch: "Aus ein paar virtuellen Punkten wird so im Extremfall ein Millionenmarkt für 30 Sekunden Sendezeit."
    },
    "fitnessstudio-mitglieder": {
      subject: "Gaming und Fitness",
      bridge: ({ mb, german }) => `Nach stundenlangem Madden kommt der klassische Gedanke: Jetzt noch schnell etwas für die Fitness tun. Vielleicht führt genau dieser Wechsel vom Controller zum Crosstrainer dazu, dass ${german.subject} und ${mb.subject} gemeinsam durch die Jahre marschieren.`,
      punch: "Erst der virtuelle Sport, dann der reale Muskelkater."
    },
    "unternehmensinsolvenzen": {
      subject: "Wirtschaftliche Nebenwirkungen",
      bridge: ({ mb, german }) => `Ein intensiver Madden-Verlauf beschäftigt nicht nur Fans. Wenn Unternehmen ihre Aufmerksamkeit falsch aufteilen und zu viel Zeit mit ${mb.subject} verbringen, könnte das in einer besonders fantasievollen Erklärung irgendwann sogar ${german.subject} erreichen.`,
      punch: "Zum Glück ist das nur eine Geschichte – und kein Sanierungsplan."
    },
    "eheschlieungen": {
      subject: "Liebe und Madden",
      bridge: ({ mb, german }) => `Gemeinsame Abende vor dem Madden-Spiel können schließlich zusammenschweißen. Vielleicht führt besonders viel ${mb.subject} deshalb indirekt zu mehr gemeinsamen Zukunftsplänen – und damit zu ${german.subject}.`,
      punch: "Offenbar kann ein Touchdown nicht nur Spiele, sondern auch Beziehungen entscheiden."
    },
    "ehescheidungen": {
      subject: "Beziehungsstress",
      bridge: ({ mb, german }) => `Nicht jede Partie endet friedlich. Ein besonders intensiver Madden-Abend könnte auch für Diskussionen sorgen, wenn ${mb.subject} plötzlich wichtiger wird als der gemeinsame Abend. In dieser Geschichte wäre ${german.subject} dann die statistische Quittung.`,
      punch: "Die Statistik beweist nichts – aber der nächste Controller könnte besser vorher abgesprochen werden."
    }
  };


  // Individuelle Story-Kerne für jede der 101 externen Statistiken.
  // Diese Ebene ist absichtlich explizit: jede Statistik hat ihren eigenen semantischen Aufhänger.
  const INDIVIDUAL_STORY_HOOKS = {
    "bierabsatz-deutschland": { subject: "Football-Abende und Kühlschranklogik", narrative: ({ mb, german }) => `Bierabsatz Deutschland liefert dabei die reale Alltagskulisse: football-abende und kühlschranklogik verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht wird der Getränkemarkt damit zum heimlichen Spielstatistiker." },
    "bierverbrauch-je-einwohner": { subject: "Das Getränk zum Spieltag", narrative: ({ mb, german }) => `Bierverbrauch je Einwohner liefert dabei die reale Alltagskulisse: das getränk zum spieltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht läuft der eigentliche Spielplan ja über den Kühlschrank." },
    "eierproduktion": { subject: "Frühstück und Football", narrative: ({ mb, german }) => `Eierproduktion liefert dabei die reale Alltagskulisse: frühstück und football verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ausgerechnet das Frühstücksei könnte damit zum stillen Begleiter des Madden Bowl werden." },
    "apfelernte-deutschland": { subject: "Obst und Spielpause", narrative: ({ mb, german }) => `Apfelernte Deutschland liefert dabei die reale Alltagskulisse: obst und spielpause verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht entscheidet sich die Apfelernte ausgerechnet zwischen zwei Drives." },
    "fleischersatzproduktion": { subject: "Der moderne Football-Snack", narrative: ({ mb, german }) => `Fleischersatzproduktion liefert dabei die reale Alltagskulisse: der moderne football-snack verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Madden Bowl könnte damit sogar einen Finger am Puls der Snackindustrie haben." },
    "unternehmensinsolvenzen": { subject: "Wirtschaft und Zeitmanagement", narrative: ({ mb, german }) => `Unternehmensinsolvenzen liefert dabei die reale Alltagskulisse: wirtschaft und zeitmanagement verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zum Glück ist diese Erklärung wirtschaftlich genauso spekulativ wie sie klingt." },
    "eheschlieungen": { subject: "Liebe und gemeinsame Abende", narrative: ({ mb, german }) => `Eheschließungen liefert dabei die reale Alltagskulisse: liebe und gemeinsame abende verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Offenbar kann ein virtueller Spielabend im Extremfall bis zum Standesamt reichen." },
    "ehescheidungen": { subject: "Beziehungsstress am Controller", narrative: ({ mb, german }) => `Ehescheidungen liefert dabei die reale Alltagskulisse: beziehungsstress am controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht sollte man vor dem nächsten Madden-Abend einfach die Spielzeit abstimmen." },
    "ubernachtungen-deutschland": { subject: "Hotels und Auswärtsspiele", narrative: ({ mb, german }) => `Übernachtungen Deutschland liefert dabei die reale Alltagskulisse: hotels und auswärtsspiele verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Madden Bowl könnte damit sogar indirekt die Hotelrezeption beschäftigen." },
    "aus-deutschland-abfliegende-passagiere": { subject: "Reiselust und Football", narrative: ({ mb, german }) => `Aus Deutschland abfliegende Passagiere liefert dabei die reale Alltagskulisse: reiselust und football verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht sitzt ein Teil der Madden-Energie irgendwann tatsächlich im Flugzeug." },
    "patentanmeldungen-beim-dpma": { subject: "Erfindungen und Controller", narrative: ({ mb, german }) => `Patentanmeldungen beim DPMA liefert dabei die reale Alltagskulisse: erfindungen und controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht bringt jede neue Madden-Generation gleich eine neue Erfindungsidee hervor." },
    "studierende-deutschland": { subject: "Campus und Gaming", narrative: ({ mb, german }) => `Studierende Deutschland liefert dabei die reale Alltagskulisse: campus und gaming verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zwischen Vorlesung und Klausur findet sich offenbar immer noch Zeit für einen Drive." },
    "treibhausgasemissionen-deutschland": { subject: "Virtueller Sport, realer Strom", narrative: ({ mb, german }) => `Treibhausgasemissionen Deutschland liefert dabei die reale Alltagskulisse: virtueller sport, realer strom verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Auch der virtuelle Football braucht schließlich Rechenleistung, Geräte und Energie." },
    "smartphones-absatz-deutschland": { subject: "Der Madden-Check in der Hosentasche", narrative: ({ mb, german }) => `Smartphones – Absatz Deutschland liefert dabei die reale Alltagskulisse: der madden-check in der hosentasche verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht sorgt jeder spannende Spielstand für einen weiteren Blick aufs Smartphone." },
    "deutsche-games-unternehmen": { subject: "Gaming-Ökosystem", narrative: ({ mb, german }) => `Deutsche Games-Unternehmen liefert dabei die reale Alltagskulisse: gaming-ökosystem verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Mehr Madden-Aufmerksamkeit könnte in dieser Geschichte auch den Appetit auf andere Games wecken." },
    "globale-musikindustrie-recorded-music-umsatz": { subject: "Soundtrack zum Spieltag", narrative: ({ mb, german }) => `Globale Musikindustrie – Recorded-Music-Umsatz liefert dabei die reale Alltagskulisse: soundtrack zum spieltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein großer Spielabend braucht schließlich Musik – beim Einlaufen, in der Pause und danach." },
    "globale-musikindustrie-subscription-streaming-umsatz": { subject: "Streaming und Spielbetrieb", narrative: ({ mb, german }) => `Globale Musikindustrie – Subscription-Streaming-Umsatz liefert dabei die reale Alltagskulisse: streaming und spielbetrieb verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer Madden schaut, hört vielleicht danach noch den passenden Soundtrack im Stream." },
    "oscar-werbung-30-sek-spot": { subject: "Werbung und große Bühnen", narrative: ({ mb, german }) => `Oscar-Werbung, 30-Sek.-Spot liefert dabei die reale Alltagskulisse: werbung und große bühnen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn virtuelle Football-Unterhaltung wächst, wird irgendwann auch die Werbefläche interessanter." },
    "super-bowl-werbung-30-sek-spot": { subject: "Football und Werbemillionen", narrative: ({ mb, german }) => `Super-Bowl-Werbung, 30-Sek.-Spot liefert dabei die reale Alltagskulisse: football und werbemillionen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Aus virtuellen Punkten wird so in der Geschichte plötzlich ein Millionenmarkt für 30 Sekunden Sendezeit." },
    "fahrrad-e-bike-durchschnittlicher-verkaufspreis": { subject: "Controller raus, Fahrrad raus", narrative: ({ mb, german }) => `Fahrrad/E-Bike – durchschnittlicher Verkaufspreis liefert dabei die reale Alltagskulisse: controller raus, fahrrad raus verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht führt ein langer Madden-Abend am nächsten Morgen direkt zur ersten Ausfahrt." },
    "durchschnittlicher-e-bike-preis": { subject: "Gaming und Mobilität", narrative: ({ mb, german }) => `Durchschnittlicher E-Bike-Preis liefert dabei die reale Alltagskulisse: gaming und mobilität verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer beim Spielen auf den Geschmack von Hightech kommt, schaut vielleicht auch beim Fahrrad genauer hin." },
    "pkw-bestand-deutschland": { subject: "Autofahrten zum Spielabend", narrative: ({ mb, german }) => `Pkw-Bestand Deutschland liefert dabei die reale Alltagskulisse: autofahrten zum spielabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Irgendjemand muss schließlich zum Madden-Abend fahren – Controller hin oder her." },
    "gesamtbevolkerung-deutschland": { subject: "Mehr Menschen, mehr Madden", narrative: ({ mb, german }) => `Gesamtbevölkerung Deutschland liefert dabei die reale Alltagskulisse: mehr menschen, mehr madden verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wo mehr Menschen sind, gibt es schließlich auch mehr potenzielle Spieler und Zuschauer." },
    "lebendgeborene": { subject: "Babys und Nachwuchs", narrative: ({ mb, german }) => `Lebendgeborene liefert dabei die reale Alltagskulisse: babys und nachwuchs verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Offenbar beginnt die Vorbereitung auf den nächsten Madden Bowl deutlich früher als gedacht." },
    "gestorbene": { subject: "Generationen und Erinnerungen", narrative: ({ mb, german }) => `Gestorbene liefert dabei die reale Alltagskulisse: generationen und erinnerungen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht spiegelt sich im Spielbetrieb auf seltsame Weise auch der Wechsel der Generationen." },
    "erwerbstatige": { subject: "Arbeit und Feierabend", narrative: ({ mb, german }) => `Erwerbstätige liefert dabei die reale Alltagskulisse: arbeit und feierabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Nach Feierabend bleibt schließlich immer noch Zeit für eine Partie." },
    "erwerbslose": { subject: "Freie Zeit und Controller", narrative: ({ mb, german }) => `Erwerbslose liefert dabei die reale Alltagskulisse: freie zeit und controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Eine besonders großzügige Auslegung der Daten macht freie Zeit kurzerhand zur Madden-Ressource." },
    "genehmigte-wohnungen": { subject: "Neue Wohnungen, neue Konsolen", narrative: ({ mb, german }) => `Genehmigte Wohnungen liefert dabei die reale Alltagskulisse: neue wohnungen, neue konsolen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Jede neue Wohnung braucht irgendwann ein Wohnzimmer – und vielleicht einen Fernseher für Madden." },
    "holzeinschlag": { subject: "Holz, Möbel und Spielzimmer", narrative: ({ mb, german }) => `Holzeinschlag liefert dabei die reale Alltagskulisse: holz, möbel und spielzimmer verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht landet ein Teil des Holzes irgendwann genau dort, wo der nächste Madden-Abend stattfindet." },
    "kinobesucher-deutschland": { subject: "Unterhaltung und Publikum", narrative: ({ mb, german }) => `Kinobesucher Deutschland liefert dabei die reale Alltagskulisse: unterhaltung und publikum verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vom virtuellen Rasen direkt auf die große Leinwand – ein überraschend kurzer Weg." },
    "stromerzeugung-gesamt": { subject: "Strom und Spielbetrieb", narrative: ({ mb, german }) => `Stromerzeugung gesamt liefert dabei die reale Alltagskulisse: strom und spielbetrieb verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ohne Strom bleibt schließlich selbst der beste virtuelle Quarterback auf der Bank." },
    "windstrom": { subject: "Wind und Gaming", narrative: ({ mb, german }) => `Windstrom liefert dabei die reale Alltagskulisse: wind und gaming verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht bläst der Wind nicht nur durch die Rotorblätter, sondern indirekt auch durch die Madden-Statistik." },
    "erneuerbare-stromerzeugung": { subject: "Grüner Strom für virtuellen Football", narrative: ({ mb, german }) => `Erneuerbare Stromerzeugung liefert dabei die reale Alltagskulisse: grüner strom für virtuellen football verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Je mehr erneuerbarer Strom verfügbar ist, desto beruhigter kann man den nächsten langen Spielabend starten." },
    "butterproduktion": { subject: "Butter und Stadion-Snacks", narrative: ({ mb, german }) => `Butterproduktion liefert dabei die reale Alltagskulisse: butter und stadion-snacks verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht beginnt der Madden-Spieltag kulinarisch schon beim Frühstück." },
    "kaseproduktion": { subject: "Käseplatte und Kick-off", narrative: ({ mb, german }) => `Käseproduktion liefert dabei die reale Alltagskulisse: käseplatte und kick-off verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein langer Spielabend braucht schließlich eine vernünftige Snackgrundlage." },
    "zigarettenverbrauch": { subject: "Pausen und Zigaretten", narrative: ({ mb, german }) => `Zigarettenverbrauch liefert dabei die reale Alltagskulisse: pausen und zigaretten verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn das Spiel ruht, ist schließlich Zeit für eine kurze Pause – zumindest in dieser Geschichte." },
    "fitnessstudio-mitglieder": { subject: "Gaming und Fitness", narrative: ({ mb, german }) => `Fitnessstudio-Mitglieder liefert dabei die reale Alltagskulisse: gaming und fitness verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Erst der virtuelle Sport, dann der reale Muskelkater." },
    "e-bike-verkaufe-deutschland": { subject: "Gaming und Bewegung", narrative: ({ mb, german }) => `E-Bike-Verkäufe Deutschland liefert dabei die reale Alltagskulisse: gaming und bewegung verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Nach dem virtuellen Football folgt vielleicht die reale Runde ums Viertel." },
    "weltweite-kino-bilanz-box-office": { subject: "Globale Unterhaltung", narrative: ({ mb, german }) => `Weltweite Kino-Bilanz (Box Office) liefert dabei die reale Alltagskulisse: globale unterhaltung verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht konkurriert Madden gar nicht mit dem Kino – sondern füttert denselben Unterhaltungshunger." },
    "usa-kanada-kino-umsatz": { subject: "Entertainment auf amerikanisch", narrative: ({ mb, german }) => `USA/Kanada: Kino-Umsatz liefert dabei die reale Alltagskulisse: entertainment auf amerikanisch verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Was auf dem virtuellen Football-Feld passiert, könnte in dieser Geschichte bis zur Kinokasse reichen." },
    "usa-kanada-kinobesuche": { subject: "Publikum sucht den nächsten Kick", narrative: ({ mb, german }) => `USA/Kanada: Kinobesuche liefert dabei die reale Alltagskulisse: publikum sucht den nächsten kick verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Nach einer Partie Madden ist die nächste Unterhaltung schließlich nur einen Kinosaal entfernt." },
    "buchmarkt-deutschland-gesamtumsatz": { subject: "Madden und Geschichten", narrative: ({ mb, german }) => `Buchmarkt Deutschland – Gesamtumsatz liefert dabei die reale Alltagskulisse: madden und geschichten verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Jede Saison produziert schließlich genug Dramen für ein ganzes Bücherregal." },
    "taylor-swift-ifpi-global-artist-of-the-year": { subject: "Popstar-Effekt", narrative: ({ mb, german }) => `Taylor Swift – IFPI Global Artist of the Year liefert dabei die reale Alltagskulisse: popstar-effekt verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn Musik und Madden gleichzeitig die Aufmerksamkeit dominieren, kann die Korrelation plötzlich alles miteinander verbinden." },
    "kartoffelernte-deutschland": { subject: "Football-Snacks", narrative: ({ mb, german }) => `Kartoffelernte Deutschland liefert dabei die reale Alltagskulisse: football-snacks verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht wird die nächste Kartoffelernte deshalb bereits im Spielplan mitgerechnet." },
    "getreideernte-insgesamt": { subject: "Getreide und Spieltagsessen", narrative: ({ mb, german }) => `Getreideernte insgesamt liefert dabei die reale Alltagskulisse: getreide und spieltagsessen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Irgendwo beginnt schließlich auch der Weg vom Feld zum Snackteller." },
    "zuckerrubenernte": { subject: "Süße und Spannung", narrative: ({ mb, german }) => `Zuckerrübenernte liefert dabei die reale Alltagskulisse: süße und spannung verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein intensiver Spielabend braucht Energie – und die Geschichte liefert sie direkt vom Feld." },
    "weinerzeugung-deutschland": { subject: "Feierabend und Anstoß", narrative: ({ mb, german }) => `Weinerzeugung Deutschland liefert dabei die reale Alltagskulisse: feierabend und anstoß verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Nach dem letzten Spielzug beginnt schließlich der gemütliche Teil des Abends." },
    "biersteuer-einnahmen": { subject: "Der Staat schaut mit", narrative: ({ mb, german }) => `Biersteuer-Einnahmen liefert dabei die reale Alltagskulisse: der staat schaut mit verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn mehr Bier fließt, schaut irgendwann sogar der Fiskus auf den Spieltag." },
    "alkoholsteuer-einnahmen-insgesamt": { subject: "Feierabend mit Steuereffekt", narrative: ({ mb, german }) => `Alkoholsteuer-Einnahmen insgesamt liefert dabei die reale Alltagskulisse: feierabend mit steuereffekt verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht landet ein winziger Teil der Madden-Energie irgendwann sogar im Staatshaushalt." },
    "paketsendungen": { subject: "Online-Shopping und Belohnungen", narrative: ({ mb, german }) => `Paketsendungen liefert dabei die reale Alltagskulisse: online-shopping und belohnungen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Madden Bowl könnte damit indirekt zum Konjunkturprogramm für Paketboten werden." },
    "paketmarkt-umsatz": { subject: "Der Paketbote kennt den Spielplan", narrative: ({ mb, german }) => `Paketmarkt-Umsatz liefert dabei die reale Alltagskulisse: der paketbote kennt den spielplan verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Controller, Headsets und Trikots kommen schließlich selten zu Fuß." },
    "gema-gesamtertrage": { subject: "Musik und Lizenzkasse", narrative: ({ mb, german }) => `GEMA-Gesamterträge liefert dabei die reale Alltagskulisse: musik und lizenzkasse verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wo Musik läuft, ist die GEMA nicht weit – auch wenn der eigentliche Anlass ein Madden-Abend ist." },
    "deutscher-musikmarkt-handelsumsatz": { subject: "Musik neben dem Spiel", narrative: ({ mb, german }) => `Deutscher Musikmarkt – Handelsumsatz liefert dabei die reale Alltagskulisse: musik neben dem spiel verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zwischen Einlaufmusik und Siegesfeier findet sich genug Platz für einen ganzen Musikmarkt." },
    "markenanmeldungen-beim-dpma": { subject: "Neue Marken, neue Madden-Ideen", narrative: ({ mb, german }) => `Markenanmeldungen beim DPMA liefert dabei die reale Alltagskulisse: neue marken, neue madden-ideen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht braucht jede neue Madden-Saison schließlich auch ihren eigenen Namen." },
    "patenterteilungen-beim-dpma": { subject: "Innovation am Controller", narrative: ({ mb, german }) => `Patenterteilungen beim DPMA liefert dabei die reale Alltagskulisse: innovation am controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Aus einem virtuellen Spielzug wird in dieser Geschichte kurzerhand eine technische Innovation." },
    "einwanderung-nach-deutschland": { subject: "Neue Menschen, neue Spieler", narrative: ({ mb, german }) => `Einwanderung nach Deutschland liefert dabei die reale Alltagskulisse: neue menschen, neue spieler verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Jede neue Bevölkerungsgruppe bringt schließlich auch neue Interessen und potenzielle Madden-Fans mit." },
    "auswanderung-aus-deutschland": { subject: "Wenn Spieler weiterziehen", narrative: ({ mb, german }) => `Auswanderung aus Deutschland liefert dabei die reale Alltagskulisse: wenn spieler weiterziehen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht wandert mit den Menschen auch ein Teil der Madden-Leidenschaft aus." },
    "auslandische-bevolkerung-in-deutschland": { subject: "Internationale Madden-Community", narrative: ({ mb, german }) => `Ausländische Bevölkerung in Deutschland liefert dabei die reale Alltagskulisse: internationale madden-community verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Madden kennt schließlich keine Landesgrenzen – und die Statistik offenbar auch nicht." },
    "nettozuwanderung": { subject: "Demografie trifft Spielbetrieb", narrative: ({ mb, german }) => `Nettozuwanderung liefert dabei die reale Alltagskulisse: demografie trifft spielbetrieb verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Mehr Menschen im Land bedeuten auch mehr mögliche Spieler, Zuschauer und Gesprächspartner." },
    "verkehrstote": { subject: "Verkehr und Spieltag", narrative: ({ mb, german }) => `Verkehrstote liefert dabei die reale Alltagskulisse: verkehr und spieltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Weg zum Madden-Abend ist real, auch wenn das Spiel selbst virtuell ist." },
    "verkehrsunfalle-insgesamt": { subject: "Unterwegs zum Controller", narrative: ({ mb, german }) => `Verkehrsunfälle insgesamt liefert dabei die reale Alltagskulisse: unterwegs zum controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht hinterlässt schon die Fahrt zum Spielabend statistische Spuren." },
    "veranschlagte-baukosten-genehmigter-bauwerke": { subject: "Gebäude für die nächste Madden-Generation", narrative: ({ mb, german }) => `Veranschlagte Baukosten genehmigter Bauwerke liefert dabei die reale Alltagskulisse: gebäude für die nächste madden-generation verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wo Menschen spielen, braucht es schließlich Räume, Bildschirme und Infrastruktur." },
    "fahrgaste-im-linienverkehr-busse-bahnen": { subject: "ÖPNV und Spielabend", narrative: ({ mb, german }) => `Fahrgäste im Linienverkehr Busse + Bahnen liefert dabei die reale Alltagskulisse: öpnv und spielabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Irgendjemand muss schließlich zum gemeinsamen Madden-Abend kommen." },
    "landwirtschaftlicher-erzeugerpreisindex": { subject: "Vom Feld zum Spieltag", narrative: ({ mb, german }) => `Landwirtschaftlicher Erzeugerpreisindex liefert dabei die reale Alltagskulisse: vom feld zum spieltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht beginnt die Madden-Wirtschaft viel früher, als man denkt – nämlich beim Erzeugerpreis." },
    "super-bowl-zuschauer-usa": { subject: "Football-Euphorie", narrative: ({ mb, german }) => `Super-Bowl-Zuschauer USA liefert dabei die reale Alltagskulisse: football-euphorie verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Madden Bowl wäre damit überraschend nah am echten Football-Geschäft." },
    "arbeitskosten-je-geleistete-stunde": { subject: "Arbeitszeit und Spielzeit", narrative: ({ mb, german }) => `Arbeitskosten je geleistete Stunde liefert dabei die reale Alltagskulisse: arbeitszeit und spielzeit verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Jede Stunde Arbeit steht schließlich einer Stunde Freizeit gegenüber – und irgendwo wartet Madden." },
    "inflationsrate-deutschland": { subject: "Inflation und Controller", narrative: ({ mb, german }) => `Inflationsrate Deutschland liefert dabei die reale Alltagskulisse: inflation und controller verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn alles teurer wird, bleibt die Frage: Was kostet eigentlich ein weiterer Madden-Abend?" },
    "bip-nominal": { subject: "Madden und Volkswirtschaft", narrative: ({ mb, german }) => `BIP nominal liefert dabei die reale Alltagskulisse: madden und volkswirtschaft verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Aus vier Madden-Saisons wird in dieser Geschichte plötzlich ein winziger Konjunkturindikator." },
    "bip-wachstum-real": { subject: "Wachstum und Spieltempo", narrative: ({ mb, german }) => `BIP-Wachstum real liefert dabei die reale Alltagskulisse: wachstum und spieltempo verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht wächst eine Volkswirtschaft genauso überraschend wie ein Madden-Spielstand." },
    "private-konsumausgaben": { subject: "Konsum auf dem Sofa", narrative: ({ mb, german }) => `Private Konsumausgaben liefert dabei die reale Alltagskulisse: konsum auf dem sofa verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Controller, Fernseher, Snacks – der private Konsum hat am Madden-Abend viele Berührungspunkte." },
    "konsumausgaben-des-staates": { subject: "Der Staat spielt mit", narrative: ({ mb, german }) => `Konsumausgaben des Staates liefert dabei die reale Alltagskulisse: der staat spielt mit verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Selbst staatliche Ausgaben lassen sich mit etwas Fantasie an einen großen Spielbetrieb anschließen." },
    "exporte": { subject: "Madden geht international", narrative: ({ mb, german }) => `Exporte liefert dabei die reale Alltagskulisse: madden geht international verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Was im Wohnzimmer beginnt, kann in der Story problemlos die Landesgrenze überschreiten." },
    "importe": { subject: "Gaming-Zubehör aus aller Welt", narrative: ({ mb, german }) => `Importe liefert dabei die reale Alltagskulisse: gaming-zubehör aus aller welt verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Controller und Konsolen kommen schließlich nicht alle aus der Nachbarschaft." },
    "kfz-bestand-insgesamt": { subject: "Mobilität rund um den Spieltag", narrative: ({ mb, german }) => `Kfz-Bestand insgesamt liefert dabei die reale Alltagskulisse: mobilität rund um den spieltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Mehr Fahrzeuge bedeuten mehr Wege – und irgendwo führt einer davon zum Madden-Abend." },
    "pkw-neuzulassungen": { subject: "Neues Auto, neuer Spielabend", narrative: ({ mb, german }) => `Pkw-Neuzulassungen liefert dabei die reale Alltagskulisse: neues auto, neuer spielabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer ein neues Auto kauft, kann schließlich auch zum nächsten Madden-Turnier fahren." },
    "autobahnnetz": { subject: "Die Straße zum Madden Bowl", narrative: ({ mb, german }) => `Autobahnnetz liefert dabei die reale Alltagskulisse: die straße zum madden bowl verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Je größer das Straßennetz, desto leichter lässt sich die nächste Partie besuchen – zumindest in dieser Geschichte." },
    "bundesstraennetz": { subject: "Bundesstraßen und Spieltermine", narrative: ({ mb, german }) => `Bundesstraßennetz liefert dabei die reale Alltagskulisse: bundesstraßen und spieltermine verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Auch der Weg zum Controller kann manchmal über eine Bundesstraße führen." },
    "onlinehandel-deutschland": { subject: "Shopping und Gaming", narrative: ({ mb, german }) => `Onlinehandel Deutschland liefert dabei die reale Alltagskulisse: shopping und gaming verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der virtuelle Football-Platz könnte damit einen erstaunlich realen Warenkorb füllen." },
    "weltweite-rebflache": { subject: "Weinbau und Spielabend", narrative: ({ mb, german }) => `Weltweite Rebfläche liefert dabei die reale Alltagskulisse: weinbau und spielabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Vielleicht wird der nächste Madden-Abend irgendwo zwischen Rebstock und Controller vorbereitet." },
    "verbrauch-versteuerter-zigaretten-je-einwohner": { subject: "Pausen pro Einwohner", narrative: ({ mb, german }) => `Verbrauch versteuerter Zigaretten je Einwohner liefert dabei die reale Alltagskulisse: pausen pro einwohner verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein Spielabend besteht nicht nur aus Spielzügen, sondern auch aus Pausen." },
    "kaffeesteuereinnahmen": { subject: "Kaffee und lange Nächte", narrative: ({ mb, german }) => `Kaffeesteuereinnahmen liefert dabei die reale Alltagskulisse: kaffee und lange nächte verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer bis spät spielt, braucht irgendwann Koffein – und der Staat bekommt seinen Anteil." },
    "verbraucherpreisindex-besuch-von-kino-theater-konzert-zirkus-u-a": { subject: "Der Preis der Unterhaltung", narrative: ({ mb, german }) => `Verbraucherpreisindex: Besuch von Kino, Theater, Konzert, Zirkus u. Ä. liefert dabei die reale Alltagskulisse: der preis der unterhaltung verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn Unterhaltung teurer wird, verändert sich vielleicht auch die Art, wie Menschen ihre Freizeit zwischen Madden und anderen Shows aufteilen." },
    "verbraucherpreisindex-fastfoodrestaurants": { subject: "Fast Food und Spielpausen", narrative: ({ mb, german }) => `Verbraucherpreisindex: Fastfoodrestaurants liefert dabei die reale Alltagskulisse: fast food und spielpausen verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zwischen zwei Drives bleibt schließlich Zeit für eine Bestellung." },
    "verbraucherpreisindex-hotelubernachtungen": { subject: "Hotel und Auswärtsspiel", narrative: ({ mb, german }) => `Verbraucherpreisindex: Hotelübernachtungen liefert dabei die reale Alltagskulisse: hotel und auswärtsspiel verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer zum Turnier reist, braucht vielleicht ein Zimmer – und plötzlich sitzt das Hotel im selben Datensatz." },
    "verbraucherpreisindex-bestattungsleistungen-friedhofsgebuhren": { subject: "Die wirklich ungewöhnliche Korrelation", narrative: ({ mb, german }) => `Verbraucherpreisindex: Bestattungsleistungen/Friedhofsgebühren liefert dabei die reale Alltagskulisse: die wirklich ungewöhnliche korrelation verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zwischen Madden und Friedhofsgebühren liegt nun wirklich keine offensichtliche Brücke – genau deshalb ist die Korrelation so bemerkenswert." },
    "verbraucherpreisindex-bahntickets": { subject: "Mit der Bahn zum Spielabend", narrative: ({ mb, german }) => `Verbraucherpreisindex: Bahntickets liefert dabei die reale Alltagskulisse: mit der bahn zum spielabend verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Auch ein virtueller Spielabend kann eine reale Anreise haben." },
    "goldschmuck-nachfrage-weltweit": { subject: "Schmuck und Siegerpose", narrative: ({ mb, german }) => `Goldschmuck-Nachfrage weltweit liefert dabei die reale Alltagskulisse: schmuck und siegerpose verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein Champion braucht schließlich etwas Glänzendes – zumindest in unserer Geschichte." },
    "goldnachfrage-der-zentralbanken-weltweit": { subject: "Goldreserven und Tabellenpunkte", narrative: ({ mb, german }) => `Goldnachfrage der Zentralbanken weltweit liefert dabei die reale Alltagskulisse: goldreserven und tabellenpunkte verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn es um Wert und Sicherheit geht, scheint der Weg zum Madden Bowl erstaunlich kurz." },
    "goldverbrauch-fur-technologie-weltweit": { subject: "Gold in der Gaming-Technik", narrative: ({ mb, german }) => `Goldverbrauch für Technologie weltweit liefert dabei die reale Alltagskulisse: gold in der gaming-technik verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Ein Teil der Technik hinter virtuellen Welten braucht schließlich reale Materialien." },
    "rohstahlproduktion-weltweit": { subject: "Stahl für die reale Infrastruktur", narrative: ({ mb, german }) => `Rohstahlproduktion weltweit liefert dabei die reale Alltagskulisse: stahl für die reale infrastruktur verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der virtuelle Football braucht zwar keinen Stahlhelm, aber die Welt dahinter jede Menge Infrastruktur." },
    "stahlverbrauch-pro-kopf-in-deutschland": { subject: "Stahl und Alltag", narrative: ({ mb, german }) => `Stahlverbrauch pro Kopf in Deutschland liefert dabei die reale Alltagskulisse: stahl und alltag verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Von Gebäuden bis Fahrzeugen steckt Stahl überall dort, wo der Madden-Spieltag stattfindet." },
    "mobelproduktion-in-deutschland-produktionswert": { subject: "Das Wohnzimmer als Stadion", narrative: ({ mb, german }) => `Möbelproduktion in Deutschland – Produktionswert liefert dabei die reale Alltagskulisse: das wohnzimmer als stadion verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Der Madden Bowl braucht keine Arena – nur ein Wohnzimmer mit einem guten Sitzplatz." },
    "bekleidungsproduktion-in-deutschland-produktionswert": { subject: "Trikots und Spieltagslook", narrative: ({ mb, german }) => `Bekleidungsproduktion in Deutschland – Produktionswert liefert dabei die reale Alltagskulisse: trikots und spieltagslook verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer Madden spielt, braucht vielleicht irgendwann auch das passende Outfit." },
    "pharmaindustrie-deutschland-produktionswert": { subject: "Spieltag und Gesundheit", narrative: ({ mb, german }) => `Pharmaindustrie Deutschland – Produktionswert liefert dabei die reale Alltagskulisse: spieltag und gesundheit verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Nach einem langen Abend muss irgendwann auch der Körper wieder mitspielen." },
    "lederwaren-und-schuhindustrie-deutschland-produktionswert": { subject: "Schuhe für den virtuellen Sportler", narrative: ({ mb, german }) => `Lederwaren- und Schuhindustrie Deutschland – Produktionswert liefert dabei die reale Alltagskulisse: schuhe für den virtuellen sportler verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Auch wer virtuell spielt, kann sich für die nächste reale Runde passend ausstatten." },
    "tabakverarbeitung-deutschland-produktionswert": { subject: "Pausenindustrie", narrative: ({ mb, german }) => `Tabakverarbeitung Deutschland – Produktionswert liefert dabei die reale Alltagskulisse: pausenindustrie verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Während das Spiel läuft, entstehen schließlich auch die klassischen Unterbrechungen." },
    "staatliche-lotterien-spieleinsatze": { subject: "Risiko und Wettbewerb", narrative: ({ mb, german }) => `Staatliche Lotterien – Spieleinsätze liefert dabei die reale Alltagskulisse: risiko und wettbewerb verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Madden und Lotto teilen zumindest eine Zutat: die Spannung, wie sich die nächste Zahl entwickelt." },
    "weltbevolkerung": { subject: "Die ganze Welt schaut zu", narrative: ({ mb, german }) => `Weltbevölkerung liefert dabei die reale Alltagskulisse: die ganze welt schaut zu verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wenn die Weltbevölkerung wächst, wächst theoretisch auch die Zahl potenzieller Madden-Fans." },
    "zusammengefasste-geburtenziffer-deutschland": { subject: "Nachwuchs und lange Sicht", narrative: ({ mb, german }) => `Zusammengefasste Geburtenziffer Deutschland liefert dabei die reale Alltagskulisse: nachwuchs und lange sicht verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Eine Geburtenziffer wirkt langsam – der Madden-Spielbetrieb dagegen sofort. Irgendwie müssen die beiden trotzdem zusammenpassen." },
    "weltweite-verkaufe-von-elektroautos-bev-plug-in-hybride": { subject: "Hightech auf Rädern", narrative: ({ mb, german }) => `Weltweite Verkäufe von Elektroautos (BEV + Plug-in-Hybride) liefert dabei die reale Alltagskulisse: hightech auf rädern verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Wer sich für neue Technik begeistert, ist vielleicht auch offen für neue digitale Spielwelten." },
    "internationale-fuballtransfers-transferentschadigungen-weltweit": { subject: "Football trifft Fußball", narrative: ({ mb, german }) => `Internationale Fußballtransfers – Transferentschädigungen weltweit liefert dabei die reale Alltagskulisse: football trifft fußball verbindet sich in dieser Geschichte auf überraschend direktem Weg mit dem Spielgeschehen.`, punch: "Zwei Ballsportwelten, zwei Transferlogiken – und vier Jahre, in denen die Zahlen erstaunlich gut zusammenlaufen können." },
  };
  const STORY_FAMILIES = [
    {
      test: /baby|geburt|bevölkerung|einwanderung|auswanderung|zuwanderung|studierende|erwerbstätige|erwerbslose/i,
      subject: "Menschen und Alltag",
      bridge: ({ mb, german }) => `${german.subject} verändert den Alltag von Menschen. Und irgendwo zwischen Arbeit, Familie und Freizeit landet schließlich auch eine Partie Madden. Daraus lässt sich die Geschichte bauen, dass mehr oder weniger ${german.subject} irgendwann bei ${mb.subject} ankommt.`,
      punch: "Damit wird eine nüchterne Bevölkerungs- oder Arbeitsmarktzahl plötzlich zur inoffiziellen Madden-Kennzahl."
    },
    {
      test: /bier|alkohol|zigarett|kaffee|butter|käse|eier|kartoffel|apfel|fleisch|getreide|zucker|wein|lebensmittel|verbrauch/i,
      subject: "Konsum und Spieltag",
      bridge: ({ mb, german }) => `Ein Madden-Abend ist selten frei von Konsum. Snacks, Getränke und andere Alltagsprodukte begleiten schließlich jede ernsthafte Beschäftigung mit ${mb.subject}. So könnte ${german.subject} indirekt vom Spielgeschehen beeinflusst werden.`,
      punch: "Der Spielstand steht auf dem Bildschirm, die mögliche Nebenwirkung steht im Einkaufswagen."
    },
    {
      test: /kino|musik|buch|games|werbung|super-bowl|stream|unterhaltung/i,
      subject: "Entertainment und Aufmerksamkeit",
      bridge: ({ mb, german }) => `Madden ist selbst ein Unterhaltungsprodukt. Wenn ${mb.subject} mehr Aufmerksamkeit bindet, könnte ein Teil dieser Aufmerksamkeit in benachbarte Entertainment-Märkte wandern – und dort ${german.subject} bewegen.`,
      punch: "Die Unterhaltungsbranche könnte damit stärker miteinander verbunden sein, als ihre Statistiken vermuten lassen."
    },
    {
      test: /paket|onlinehandel|pkw|verkehr|fahrgäst|autobahn|bundesstraß|e-bike|fahrrad|mobilität/i,
      subject: "Bewegung, Shopping und Madden",
      bridge: ({ mb, german }) => `Wo viel Madden gespielt wird, entstehen auch Folgeaktivitäten: bestellt wird online, gefahren wird zum nächsten Termin und irgendwann landet all das in einer Statistik. Genau dort lässt sich ${german.subject} mit ${mb.subject} verbinden.`,
      punch: "Der virtuelle Sport könnte damit erstaunlich reale Bewegungen auslösen."
    },
    {
      test: /preis|inflation|arbeitskosten|kosten|preisindex|einnahmen|umsatz|bip|export|import|konsum/i,
      subject: "Geld und Aufmerksamkeit",
      bridge: ({ mb, german }) => `Hinter ${german.subject} steckt am Ende Geld, und Geld folgt häufig der Aufmerksamkeit. Wenn ${mb.subject} besonders viel davon bindet, lässt sich daraus eine wunderbar spekulative wirtschaftliche Verbindung konstruieren.`,
      punch: "Der Madden Bowl wird damit vom Sportereignis zum überraschenden Wirtschaftsindikator."
    },
    {
      test: /holz|strom|wind|erneuerbar|emission|stahl|gold|rohstoff|produktion|rebfläche/i,
      subject: "Ressourcen und Spielbetrieb",
      bridge: ({ mb, german }) => `Jede Partie ${mb.subject} braucht schließlich Energie, Hardware, Infrastruktur und Ressourcen. In einer ausreichend fantasievollen Kausalkette kann daraus sogar eine Verbindung zu ${german.subject} entstehen.`,
      punch: "Offenbar hat selbst der virtuelle Football einen ökologischen und industriellen Fußabdruck."
    },
    {
      test: /haus|wohnung|bau|baukosten|möbel|bekleidung|leder|schuh|pharma|tabak/i,
      subject: "Alltag und Wirtschaft",
      bridge: ({ mb, german }) => `Der Madden Bowl findet nicht im luftleeren Raum statt: Menschen wohnen, kaufen ein und investieren Geld, während sie ${mb.subject} verfolgen. Eine mögliche – und bewusst spekulative – Brücke führt deshalb zu ${german.subject}.`,
      punch: "Der Spieltag endet damit nicht an der Seitenlinie, sondern mitten in der Volkswirtschaft."
    }
  ];

  const CATEGORY_STORY_FALLBACKS = {
    goods: {
      subject: "Konsum und Nachfrage",
      bridge: ({ mb, german }) => `Wenn ${german.subject} steigt oder fällt, verändert sich damit ein Teil der realen Welt. Der vielleicht unerwartete Verbindungspunkt ist die Nachfrage rund um ${mb.subject}: mehr Aufmerksamkeit, mehr Aktivität, mehr Konsum.`,
      punch: "Ob der Einkaufswagen tatsächlich dem Spielstand folgt, können die Daten allerdings nicht beantworten."
    },
    events: {
      subject: "Menschen und Aktivität",
      bridge: ({ mb, german }) => `${german.subject} zählt reale Ereignisse, während ${mb.subject} virtuelle Ereignisse beschreibt. Vielleicht reagiert die eine Welt auf die andere – zumindest wenn man der Korrelation für einen Moment freien Lauf lässt.`,
      punch: "Zwei Zähler, vier Datenpunkte und eine erstaunlich überzeugende Scheinerklärung."
    },
    revenue: {
      subject: "Geld und Aufmerksamkeit",
      bridge: ({ mb, german }) => `Umsatz folgt normalerweise Nachfrage, und Nachfrage folgt Aufmerksamkeit. Wenn ${mb.subject} Aufmerksamkeit erzeugt, lässt sich daraus eine spekulative Verbindung zu ${german.subject} bauen.`,
      punch: "Vielleicht ist der Madden Bowl also nicht nur Sport, sondern auch ein winziger Konjunkturindikator."
    },
    price: {
      subject: "Preise und Spieltagsökonomie",
      bridge: ({ mb, german }) => `Preise reagieren auf Angebot, Nachfrage und Erwartungen. In einer sehr großzügigen Interpretation könnte ${mb.subject} genau diese Erwartungen beeinflussen – und damit ${german.subject}.`,
      punch: "Eine Preisprognose aus einem Madden-Spiel abzuleiten wäre gewagt. Genau deshalb passt sie so gut hierher."
    },
    population: {
      subject: "Menschen und Madden",
      bridge: ({ mb, german }) => `Menschen sind schließlich die gemeinsame Zutat: ${german.subject} beschreibt eine Bevölkerung oder Bevölkerungsbewegung, während ${mb.subject} von Menschen erzeugt wird. Daraus lässt sich eine wunderbar direkte Scheinkausalität bauen.`,
      punch: "Die Statistik wird damit kurzerhand zum demografischen Spielbericht."
    },
    infrastructure: {
      subject: "Infrastruktur und Spielbetrieb",
      bridge: ({ mb, german }) => `Hinter ${mb.subject} stehen Geräte, Strom, Wege und Infrastruktur. Vielleicht spiegelt sich die Intensität des Spielbetriebs deshalb sogar in ${german.subject} wider.`,
      punch: "Der virtuelle Rasen bekommt damit plötzlich eine sehr reale Infrastruktur."
    },
    rate: {
      subject: "Trends und Spielverlauf",
      bridge: ({ mb, german }) => `Beide Größen bewegen sich als Zeitreihen durch dieselben Jahre. Wenn ${mb.subject} steigt oder fällt, könnte ${german.subject} deshalb – zumindest in dieser kleinen Datenwelt – einfach mitziehen.`,
      punch: "Eine Korrelation ist schnell gefunden; eine vernünftige Ursache deutlich schwerer."
    },
    other: {
      subject: "Eine ungewöhnliche Verbindung",
      bridge: ({ mb, german }) => `Zwischen ${german.subject} und ${mb.subject} gibt es auf den ersten Blick kaum eine Verbindung. Genau das macht die gefundene Korrelation so unterhaltsam: Mit etwas Fantasie lässt sich trotzdem eine Geschichte daraus bauen.`,
      punch: "Die Daten liefern den Zusammenhang – die Geschichte liefert den Rest."
    }
  };

  function storylineFor(candidate) {
    const override = STORY_OVERRIDES[candidate.germanStatId];
    if (override) return override;

    const individual = INDIVIDUAL_STORY_HOOKS[candidate.germanStatId];
    if (individual) {
      return {
        subject: individual.subject,
        bridge: ({ mb, german }) => {
          const relation = candidate.r >= 0
            ? `Wenn ${mb.subject} mehr Aufmerksamkeit bekommt, könnte das in dieser Geschichte auch bei ${german.subject} Spuren hinterlassen.`
            : `Wenn ${mb.subject} in die eine Richtung läuft, könnte ${german.subject} in dieser Geschichte einfach den entgegengesetzten Weg nehmen.`;
          return `${relation} ${individual.narrative({ mb, german }) || "Mit etwas Fantasie lässt sich daraus eine überraschend plausible Alltagserklärung bauen."}`;
        },
        punch: individual.punch,
      };
    }

    const name = candidate.germanName || "der Statistik";
    const family = STORY_FAMILIES.find((x) => x.test.test(name));
    if (family) return family;
    return CATEGORY_STORY_FALLBACKS[candidate.germanCategory] || CATEGORY_STORY_FALLBACKS.other;
  }

  function buildSpuriousArticle(candidate) {
    const rStr = candidate.r.toFixed(6);
    const strength = Math.abs(candidate.r) >= 0.99 ? "nahezu perfekten" : "sehr starken";
    const direction = candidate.r >= 0 ? "gleichläufigen" : "gegenläufigen";
    const german = germanDescriptor(candidate);
    const mb = mbDescriptor(candidate);
    const hasOrdinalMapping = Array.isArray(candidate.xLabels) && candidate.xLabels.length === candidate.years.length;
    const story = storylineFor(candidate);

    const spanDesc = candidate.isPlayer
      ? `über die letzten ${candidate.years.length} Spiele im Turnier`
      : `über die letzten ${candidate.years.length} Turnier-Saisons`;

    const headline = candidate.r >= 0
      ? `${german.subject} steht in Zusammenhang mit ${mb.subject}`
      : `${german.subject} steht gegenläufig in Zusammenhang mit ${mb.subject}`;

    const storyTitle = `${story.subject}: ${headline}`;
    const directionPhrase = candidate.r >= 0
      ? `${mb.subject} steigt und ${german.subject} steigt tendenziell mit`
      : `${mb.subject} steigt und ${german.subject} bewegt sich tendenziell in die entgegengesetzte Richtung`;

    const parts = [
      `<strong>Befund.</strong> ${headline}: ${spanDesc} zeigt sich ein ${strength} ${direction} Zusammenhang (r = ${rStr}). ${directionPhrase}.`,
      `<strong>Die mögliche Erklärung.</strong> ${story.bridge({ mb, german, candidate })} ${story.punch}`,
    ];

    if (hasOrdinalMapping) {
      const mapping = candidate.isPlayer
        ? `${candidate.player}s Spielverlauf wird der zeitlichen Reihenfolge nach den ${candidate.years.length} zuletzt verfügbaren Jahren von ${german.subject} gegenübergestellt`
        : `Die betrachteten Turnier-Saisons werden der zeitlichen Reihenfolge nach den ${candidate.years.length} zuletzt verfügbaren Jahren von ${german.subject} gegenübergestellt`;
      parts.push(`<strong>Datengrundlage.</strong> ${mapping} (älteste Beobachtung zu ältestem Jahr, jüngste zu jüngstem Jahr) — nicht notwendigerweise demselben Kalenderjahr. Quelle: ${candidate.germanSource}.`);
    } else {
      parts.push(`<strong>Datengrundlage.</strong> Quelle ${german.subject}: ${candidate.germanSource}.`);
    }


    return {
      kind: "spurious",
      title: storyTitle,
      body: paragraphs(parts),
      data: {
        pairKey: candidate.pairKey,
        mbStatKey: candidate.mbStatKey,
        germanStatId: candidate.germanStatId,
        player: candidate.player || null,
        r: candidate.r,
      },
    };
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
      if (a.kind === "spurious" && a.data && a.data.pairKey) out.add(a.data.pairKey);
    });
    return out;
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
    buildSpuriousArticle,

    pushArticle,
    getLastPushArticleError,
    pushManualArticle,
    updateArticle,
    deleteArticle,
    fetchArticles,
    countArticlesByKind,
    countFinishedMatches,
    isProgressArticleDue,
    getUsedSpuriousPairKeys,
  };
})(window);