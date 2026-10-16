/* =========================================================================
   ALTIMA BOWL — BLOG (blog.js)
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

  // Redaktionelle Nachbearbeitung jedes Absatzes: keine doppelten Punkte hinter
  // abgekürzten Namen ("Tobi F.." -> "Tobi F."), keine Leerzeichen vor
  // Satzzeichen, keine losen Ordnungspunkte ("5 ." -> "5."). Auslassungspunkte
  // ("...") bleiben erhalten.
  function tidy(text) {
    return String(text == null ? "" : text)
      .replace(/(?<![.])\.\.(?![.])/g, ".")
      .replace(/[ \t]+([.,;!?])/g, "$1")
      .replace(/,{2,}/g, ",")
      .replace(/[ \t]{2,}/g, " ");
  }

  function paragraphs(parts) {
    return parts.filter(Boolean).map(tidy).join("\n\n");
  }

  // "A", "A und B", "A, B und C"
  function joinNames(names) {
    const list = (names || []).filter(Boolean);
    if (list.length <= 1) return list[0] || "";
    return list.slice(0, -1).join(", ") + " und " + list[list.length - 1];
  }

  const NUM_WORDS_DE = ["null", "einen", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
  // "einen Sieg", "drei Siege" (kleine Zahlen ausgeschrieben, Akkusativ für "ein")
  function pluralDE(n, one, many) {
    const k = Number(n);
    return `${Number.isInteger(k) && k >= 0 && k <= 12 ? NUM_WORDS_DE[k] : n} ${k === 1 ? one : many}`;
  }

  // Wie pick(), vermeidet aber, dasselbe Element wie in den letzten Aufrufen
  // derselben Gruppe zu wählen (z.B. den Abschlusssatz zweier Rekord-Beiträge
  // hintereinander).
  const _lastPicked = {};
  function pickFresh(key, arr, memory) {
    const hist = _lastPicked[key] || (_lastPicked[key] = []);
    let pool = arr.filter((x) => !hist.includes(x));
    if (!pool.length) pool = arr;
    const chosen = pick(pool);
    hist.push(chosen);
    while (hist.length > Math.min(memory == null ? 3 : memory, Math.max(arr.length - 1, 1))) hist.shift();
    return chosen;
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
    "Der Altima Bowl ist zurück. Und damit beginnt wieder die Phase des Jahres, in der ein vermeintlich harmloses Spiel plötzlich erstaunlich wichtig wird.",
    "Es geht wieder los. Controller in die Hand, Tabelle auf und die üblichen guten Vorsätze für faire Spiele vorsichtshalber gleich wieder vergessen.",
    "Neue Saison, neues Glück – und dieselbe alte Frage: Wer schafft es am Ende tatsächlich bis zum Ring?",
  ];

  const KICKOFF_CLOSERS = [
    "Noch ist alles offen. Das ist wahrscheinlich der letzte Moment, in dem das alle Beteiligten genauso sehen.",
    "Der Rest ist jetzt Sache der Controller. Und der Nerven. Vor allem der Nerven.",
    "Der Altima Bowl ist eröffnet. Was jetzt noch fehlt, sind Spiele, Geschichten und mindestens ein Ergebnis, das später niemand kommen gesehen haben will.",
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
        "Ein paar Spiele sind gespielt, und langsam bekommt der Altima Bowl Konturen. Noch ist nichts entschieden – aber einige Herren arbeiten bereits fleißig daran, diese Aussage zu widerlegen.",

      focus: (leader) =>
        `${leader.name} steht aktuell ganz oben. ${pluralDE(leader.wins || 0, "Sieg", "Siege")} hat er bereits gesammelt${
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
        "Noch ist das Feld eng genug für eine Kehrtwende. Beim Altima Bowl reicht dafür bekanntlich manchmal schon ein einziges Spiel.",

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

        return `Die aktuelle Spitzengruppe: ${names}. Noch trennen sich die Plätze nicht zwingend Welten – aber jede weitere Partie macht aus einer Momentaufnahme langsam eine Richtung.`;
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

      focus: (leader, runnerUp, third, recent) =>
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
      "{winnerScore}:{loserScore}. Mehr muss man über die Kräfteverhältnisse zwischen {player} und {opponent} eigentlich nicht sagen. Es ist die deutlichste Niederlage, die der Altima Bowl bisher gesehen hat.",
    ],

    // Highscore UND Klatsche im selben Spiel: EIN Eintrag statt mehrerer Beiträge.
    allTimeMarginHigh: [
      "Es gibt Spiele, die gewinnt man. Und es gibt Spiele, nach denen man einen Eintrag in den Geschichtsbüchern bekommt. {player} schlägt {opponent} {winnerScore}:{loserScore}. Das war nicht nur ein echtes Punktefeuerwerk, sondern auch der höchste Score und sogar die größte Klatsche der Turniergeschichte.",
      "{winnerScore}:{loserScore} – {player} nimmt {opponent} auseinander und schreibt dabei gleich doppelt Geschichte: höchster Score und größte Klatsche, die der Altima Bowl je gesehen hat.",
    ],

    tournamentMarginHigh: [
      "{player} schlägt {opponent} {winnerScore}:{loserScore}. Das ist nicht nur der deutlichste Sieg dieses Turniers, sondern mit {winnerScore} Punkten auch ein neuer Allzeit-Highscore.",
      "So ein Ergebnis gibt es nicht alle Tage: {winnerScore}:{loserScore} für {player} gegen {opponent}. Größte Differenz des Turniers und gleichzeitig höchster Score aller Zeiten.",
    ],

    tournamentMargin: [
      "Für den Allzeit-Rekord hat es diesmal nicht gereicht. Für eine Ansage innerhalb dieser Saison schon: {player} schlägt {opponent} {winnerScore}:{loserScore}.",
      "{player} hat heute offenbar beschlossen, keine Fragen offenzulassen. Mit {winnerScore}:{loserScore} gegen {opponent} steht die größte Differenz dieses Turniers.",
    ],

    winStreak: [
      "Drei Siege in Folge sind irgendwann keine Serie mehr, sondern ein Statement. {player} steht inzwischen bei {value} Erfolgen am Stück.",
      "{player} gewinnt weiter. Und weiter. Und weiter. {value} Siege in Folge – langsam wird aus guter Form ein Problem für den Rest des Feldes.",
      "Wer stoppt {player}? Bisher niemand: {value} Siege am Stück, und die Konkurrenz sucht noch nach einem Plan.",
      "{value} Spiele, {value} Siege. {player} ist gerade die Mannschaft, gegen die niemand spielen will.",
    ],

    upset: [
      "Der Spielplan hatte einen Favoriten. Das Spiel hatte eine andere Meinung. {player} schlägt {opponent} mit {winnerScore}:{loserScore} und sorgt damit für die Überraschung des Tages.",
      "Nicht jede Partie hält sich an die Ausgangslage. {player} setzt sich gegen {opponent} mit {winnerScore}:{loserScore} durch – und bringt damit ordentlich Bewegung ins Turnier.",
    ],

    blowout: [
      "{player} lässt {opponent} keine Chance: {winnerScore}:{loserScore}. Bei so einem Abstand geht es nicht mehr um die Frage, wer gewonnen hat, sondern nur noch darum, wie lange man darüber redet.",
      "Manche Spiele sind früh entschieden, dieses war es wohl noch früher. {player} schlägt {opponent} mit {winnerScore}:{loserScore} und lässt kaum Fragen offen.",
      "{winnerScore}:{loserScore}. Mehr muss man eigentlich nicht sagen – {player} hat {opponent} heute komplett im Griff gehabt.",
      "Es gibt knappe Spiele, und es gibt das hier: {player} gegen {opponent}, {winnerScore}:{loserScore}. Der Spannungsbogen war ungefähr so flach wie die Defense des Verlierers.",
      "{opponent} wird dieses Spiel gerne schnell vergessen wollen. {player} gewinnt {winnerScore}:{loserScore} – und das Ergebnis schmeichelt dem Verlierer eher noch.",
    ],

    shootout: [
      "Defensive Abende sehen anders aus. {player} und {opponent} kommen zusammen auf {total} Punkte – so viele wie in keinem anderen Spiel dieses Turniers.",
      "Wenn beide Defenses einmal beschlossen haben, Feierabend zu machen, sieht das so aus: {player} gegen {opponent}, {winnerScore}:{loserScore}. Ein echtes Punktefeuerwerk.",
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
    "Es ist entschieden. {player} gewinnt das Finale gegen {opponent} mit {winnerScore}:{loserScore} und darf sich Altima Bowl Champion nennen.",
    "Am Ende bleibt einer stehen: {player}. Mit {winnerScore}:{loserScore} gegen {opponent} geht der Titel an den neuen Altima Bowl Champion.",
  ];

  const SONG_INTROS = {
    regularSeason: [
      "Die Gruppenphase ist vorbei. Zeit für den Soundtrack zu den ersten Stunden voller Siege, Niederlagen und mehr oder weniger belastbarer Prognosen.",
      "Die Regular Season ist Geschichte. Wer jetzt noch im Rennen ist, bekommt den passenden Soundtrack für die entscheidende Phase.",
    ],

    firstElimination: [
      "Der erste Spieler ist raus. Hart, aber immerhin gibt es dafür jetzt den passenden Soundtrack.",
      "Die erste Saisonhoffnung ist geplatzt. Der Altima Bowl hat seinen ersten Ausgeschiedenen – und natürlich bekommt auch dieser Moment seinen Song.",
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
        ? `Mit dabei sind diesmal ${joinNames(names)}. Jeder startet bei null, jeder hat seine eigene Vorstellung davon, wie diese Saison laufen soll – und spätestens nach den ersten Spielen dürfte sich zeigen, wie belastbar diese Vorstellungen wirklich sind.`
        : "Das Teilnehmerfeld steht bereit. Jetzt fehlt eigentlich nur noch das erste Spiel.",
      "Wie immer entscheidet nicht die Papierform, sondern das, was auf dem virtuellen Rasen passiert. Favoriten gibt es natürlich trotzdem – schließlich wäre ein Altima Bowl ohne voreilige Prognosen nur halb so unterhaltsam.",
      pick(KICKOFF_CLOSERS),
    ];

    return {
      kind: "kickoff",
      title: "🏈 Der Altima Bowl ist eröffnet!",
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
      } Altima Bowl liegen inzwischen hinter uns. Was als kleines Turnier begonnen hat, ist längst mehr geworden: eine eigene Geschichte, eine Tabelle, Rekorde und vor allem jede Menge Spiele, über die man noch lange sprechen kann.`,
      allPlayers.size
        ? `${allPlayers.size} Spieler haben sich bislang in die Geschichte des Altima Bowl gespielt. Manche davon mit Titeln, manche mit Rekorden – und manche vor allem mit Ergebnissen, die man lieber nicht mehr auf dem Screenshot hätte.`
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
      "Was bleibt? Vor allem die Erkenntnis, dass beim Altima Bowl eigentlich nichts sicher ist. Außer vielleicht, dass irgendwann wieder jemand ein völlig absurdes Ergebnis produziert. Und genau deshalb kann die nächste Season kommen."
    );

    return {
      kind: "retrospective",
      title: "📜 Altima Bowl – ein Rückblick",
      body: paragraphs(parts),
    };
  }

  // ======================================================================
  // ZWISCHENSTAND
  // ======================================================================

  // Kurzer Absatz "Aus der Kommentarspalte" für die zusammenfassenden Beiträge (Power Ranking, Siegerehrung).
  // c = { total, picks:[{player_name, body}] } aus MB.Comments.pickHighlights; ohne Kommentare kein Absatz.
  function buildCommentParagraph(c) {
    if (!c || !c.total) return null;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const n = c.total, picks = (c.picks || []).slice(0, 2);
    const count = n === 1 ? "Ein Kommentar ist" : `${n} Kommentare sind`;
    const heads = [
      `<strong>Aus der Kommentarspalte.</strong> Seit dem letzten Rückblick ${n === 1 ? "ist" : "sind"} ${count.replace(/ (ist|sind)$/, "")} eingegangen.`,
      `<strong>Stimmen aus der Kommentarspalte.</strong> ${count} seit dem letzten Mal eingetrudelt.`,
      `<strong>Post von den Rängen.</strong> ${count} seit dem letzten Rückblick bei uns gelandet.`,
    ];
    const head = heads[Math.floor(Math.random() * heads.length)];
    if (!picks.length) return `${head} Die Stimmung ist rege – schreibt gern weiter.`;
    // Chronologisch; mit Bezug, worunter kommentiert wurde
    const where = (p) => p.article_title ? `unter „${esc(p.article_title)}“` : "unter einem der Beiträge";
    const quotes = picks.map((p, i) => {
      if (i === 0) return `${esc(p.player_name)} schrieb ${where(p)}: „${esc(p.body)}“`;
      const same = p.article_id != null && String(p.article_id) === String(picks[0].article_id);
      return `${same ? "Darauf legte" : "Und"} ${esc(p.player_name)} ${same ? "nach" : "meinte " + where(p)}: „${esc(p.body)}“`;
    });
    return `${head} ${quotes.join(" ")} – weiter so, die Spalte darf gern noch voller werden.`;
  }

  // ----------------------------------------------------------------------
  // POWER RANKING IN DEN PLAYOFFS
  // Die Gruppentabelle ist dann irrelevant. Stattdessen: Wer ist im Upper
  // Bracket noch ungeschlagen, wem reicht die nächste Niederlage zum Aus (Lower
  // Bracket), wer ist schon draußen. Jeder Spieler kommt nur einmal vor.
  // ----------------------------------------------------------------------
  const PLAYOFF_ELIM_IDS = new Set(["lb1", "lb2", "lb3", "lb4", "ls", "lf"]);
  const PLAYOFF_PHASE_TEXT = {
    "Wildcard": "die Wildcard-Runde",
    "Elim. R1": "die erste Runde im Lower Bracket",
    "Upper Semi": "das Upper Semifinale",
    "Elim. R2": "die zweite Runde im Lower Bracket",
    "Upper Final": "das Upper Final",
    "Elim. Semi": "das Halbfinale im Lower Bracket",
    "Elim. Final": "das Elimination-Finale",
    "Toilet Bowl": "die Toilet Bowl",
    "Altima Bowl": "das große Finale",
  };

  function computePlayoffStatus(state) {
    const status = new Map(); // name -> { losses, eliminated }
    const matches = state.playoffMatches || [];
    matches.forEach((m) => {
      [m.p1, m.p2].forEach((p) => {
        if (p && p.id !== -1 && p.name && !status.has(p.name)) status.set(p.name, { losses: 0, eliminated: false });
      });
    });
    matches.forEach((m) => {
      if (!m.p1 || !m.p2 || m.p2.id === -1 || !MB.isFinished(m)) return;
      if (m.id === "tb" || m.id === "gf") return; // Platzierungs-/Finalspiel: kein Bracket-Status
      const loser = MB.loserOf(m);
      if (!loser || !status.has(loser.name)) return;
      const st = status.get(loser.name);
      st.losses++;
      if (PLAYOFF_ELIM_IDS.has(m.id)) st.eliminated = true;
    });
    const upper = [], lower = [], out = [];
    status.forEach((st, name) => {
      if (st.eliminated) out.push(name);
      else if (st.losses === 0) upper.push(name);
      else lower.push(name);
    });
    return { upper, lower, out };
  }

  function isPlayoffPhaseStarted(state) {
    return (state.playoffMatches || []).some((m) => m.p1 && m.p2 && m.p2.id !== -1 && MB.isFinished(m));
  }

  function buildPlayoffProgressArticle(state, history, finishedCount, opts) {
    const { upper, lower, out } = computePlayoffStatus(state);
    const next = (state.playoffMatches || []).find((m) => m.p1 && m.p2 && m.p2.id !== -1 && !MB.isFinished(m));
    const nextText = next && PLAYOFF_PHASE_TEXT[next.phase];
    const parts = [pick([
      "Die Gruppenphase ist Geschichte, jetzt zählt jedes Spiel doppelt: Wer verliert, rutscht ab – und wer ein zweites Mal verliert, ist raus.",
      "In den Playoffs wird nicht mehr gerechnet, sondern gespielt. Ein Blick darauf, wer noch alle Optionen hat und wer auf Messers Schneide steht.",
      "Playoff-Zeit heißt: Fehler werden bestraft. Zeit für eine Bestandsaufnahme im Bracket.",
    ])];

    if (upper.length) {
      parts.push(
        upper.length === 1
          ? `Im Upper Bracket ist ${upper[0]} als Einziger noch ungeschlagen und hat damit den direkten Weg ins Finale vor sich.`
          : `Im Upper Bracket sind ${joinNames(upper)} noch ungeschlagen. Wer von ihnen verliert, bekommt im Lower Bracket eine zweite Chance – mehr aber nicht.`
      );
    }
    if (lower.length) {
      parts.push(
        lower.length === 1
          ? `Im Lower Bracket steht ${lower[0]} mit dem Rücken zur Wand: Die nächste Niederlage bedeutet das Aus.`
          : `Im Lower Bracket gilt für ${joinNames(lower)} dasselbe Gesetz: Die nächste Niederlage bedeutet das Aus.`
      );
    }
    if (out.length) {
      parts.push(
        out.length === 1
          ? `Schon ausgeschieden ist ${out[0]}. Für ihn bleibt nur noch der Blick auf die anderen.`
          : `Schon ausgeschieden sind ${joinNames(out)}. Für sie bleibt nur noch der Blick auf die anderen.`
      );
    }
    if (nextText) parts.push(`Als Nächstes steht ${nextText} an. Dort wird sich entscheiden, wer im Rennen um den Ring bleibt.`);

    const commentPara = buildCommentParagraph(opts && opts.comments);
    if (commentPara) parts.push(commentPara);
    parts.push(pick([
      "Jetzt zählt nur noch Gewinnen. Alles andere ist Statistik.",
      "Ab hier gibt es keine zweite Chance mehr für die, die im Lower Bracket stehen – und für alle anderen höchstens eine.",
      "Der Weg zum Ring ist kürzer geworden. Und deutlich unbequemer.",
    ]));

    return {
      kind: "progress",
      title: `Power Ranking: Die Playoffs im Überblick (nach ${finishedCount} Spielen)`,
      body: paragraphs(parts),
    };
  }

  function buildProgressArticle(state, history, finishedCount, opts) {
    if (isPlayoffPhaseStarted(state)) return buildPlayoffProgressArticle(state, history, finishedCount, opts);
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
    // Jeder Spieler soll im Text nur einmal vorkommen: der Fokus-Absatz nennt
    // je nach Stil schon Platz 2/3, die Folge-Absätze ergänzen nur, wer noch fehlt.
    const mentioned = () => parts.join(" ");

    if (leaders.length) {
      parts.push(
        style.focus(
          leaders[0],
          leaders[1],
          leaders[2],
          recent
        )
      );

      const rest = [leaders[1], leaders[2]].filter((p) => p && !mentioned().includes(p.name));
      if (rest.length === 2) {
        parts.push(
          `Dahinter bleiben ${rest[0].name} und ${rest[1].name} in Schlagdistanz. Gerade dort wird sich zeigen, wer aus einem guten Start tatsächlich eine gute Saison machen kann.`
        );
      } else if (rest.length === 1) {
        parts.push(
          `Dahinter bleibt ${rest[0].name} in Schlagdistanz. Dort wird sich zeigen, ob aus einem guten Start tatsächlich eine gute Saison wird.`
        );
      }
    } else {
      parts.push(
        `Nach ${finishedCount} Spielen ist die Tabelle noch schwer zu lesen. Genau das dürfte sich in den nächsten Partien ändern.`
      );
    }

    // Das letzte Ergebnis nur nennen, wenn dadurch niemand ein zweites Mal vorkommt.
    if (recent && !style.consumesRecent && !mentioned().includes(recent.winner) && !mentioned().includes(recent.loser)) {
      parts.push(
        pickFresh("prRecent", [
          `Zuletzt setzte sich ${recent.winner} gegen ${recent.loser} mit ${recent.score} durch. Ein einzelnes Spiel entscheidet noch keine Saison – aber es kann durchaus entscheiden, wer die nächste Partie mit etwas mehr Ruhe angeht.`,
          `Frisch vom Feld: ${recent.winner} schlägt ${recent.loser} ${recent.score}. Für den einen Rückenwind, für den anderen Grübelstoff.`,
          `Das jüngste Ergebnis: ${recent.score} für ${recent.winner} gegen ${recent.loser}. Solche Spiele merkt sich die Tabelle länger als die Beteiligten.`,
        ], 2)
      );
    }

    const commentPara = buildCommentParagraph(opts && opts.comments);
    if (commentPara) parts.push(commentPara);
    parts.push(style.closer);

    // Tabellen-Snapshot: blog.html zeichnet ihn am Platzhalter [[tabelle]]
    const table = sorted.filter((p) => p.name).map((p, i) => ({ rank: i + 1, name: p.name, w: p.wins || 0, l: Math.max(0, (p.played || 0) - (p.wins || 0)), diff: p.diff || 0 }));
    return {
      kind: "progress",
      title: style.title(finishedCount),
      body: paragraphs(parts) + (table.length ? "\n\n[[tabelle]]" : ""),
      data: table.length ? { standings: table } : undefined,
    };
  }

  // ======================================================================
  // REKORD
  // ======================================================================

  // Abschlusssätze: bewusst viele Varianten, damit nicht jeder Rekord-Beitrag
  // gleich endet. pickFresh() vermeidet Wiederholungen direkt hintereinander.
  const RECORD_CLOSERS_GENERIC = [
    "Ein neuer Eintrag für die Altima-Bowl-Geschichtsbücher – und vermutlich Material für die nächste WhatsApp-Diskussion.",
    "Notiert, gespeichert, nicht mehr zu ändern. Die Hall of Fame hat wieder etwas zu tun.",
    "Das wird beim nächsten Treffen garantiert nicht unerwähnt bleiben.",
    "Ob dieser Wert lange Bestand hat, zeigen die nächsten Spiele.",
    "Die Konkurrenz hat es zur Kenntnis genommen – und wird es so schnell nicht vergessen.",
    "Wer als Nächstes gegen diesen Namen spielt, weiß jetzt, worauf er sich einlässt.",
    "Die Statistik hat gesprochen. Diskussionen sind trotzdem ausdrücklich erlaubt.",
  ];
  const RECORD_CLOSERS = {
    allTimeMargin: ["Wer so verliert, braucht vermutlich ein paar Tage, bis er wieder über dieses Spiel redet."],
    tournamentMargin: ["Der Maßstab für den Rest des Turniers steht – wer ihn überbieten will, muss schon einiges auffahren."],
    blowout: ["Bei so einem Abstand bleibt dem Verlierer nur das Prinzip Hoffnung für die Revanche."],
    upset: ["Papierform ist eben auch nur Papier."],
    winStreak: ["Irgendwann reißt jede Serie. Die Frage ist nur, wer sie beendet."],
    shootout: ["Verteidigung wird in diesem Spiel ausdrücklich überbewertet."],
    allTimeHigh: ["Eine Zahl, an der sich künftig alle messen lassen müssen."],
  };

  function buildRecordArticle(record) {
    const info =
      MB.Records.RECORD_TYPES[record.type] || {
        label: record.type,
        emoji: "🏈",
      };

    const combined = (record.alsoTypes || []).includes("allTimeHigh");
    const pool = (combined && RECORD_INTROS[record.type + "High"]) || RECORD_INTROS[record.type];

    const vars = {
      ...record,
      total:
        (record.winnerScore || 0) +
        (record.loserScore || 0),
    };

    const intro = pool
      ? fill(pick(pool), vars)
      : `Ein besonderer Moment im Altima Bowl: ${
          record.player || "jemand"
        } sorgt für Gesprächsstoff.`;

    const detail =
      record.type === "winStreak"
        ? pickFresh("streakDetail", [
            `Für die Konkurrenz ist das eine ziemlich deutliche Einladung, diese Serie möglichst bald zu beenden.`,
            `Die nächste Partie wird damit automatisch zum Serien-Test.`,
            `Längste Serie des Turniers – und sie ist noch nicht vorbei.`,
          ], 2)
        : record.type === "upset"
        ? `Der Blick auf die Ausgangslage macht den Sieg besonders bemerkenswert: ${record.player} lag in der Setzliste deutlich hinter ${record.opponent}. Auf dem Feld spielte das offenbar keine Rolle.${record.blowoutMargin ? ` Und knapp war es auch nicht: ${record.blowoutMargin} Punkte Unterschied – der deutlichste Sieg des Turniers.` : ""}`
        : null;

    const closers = [...(RECORD_CLOSERS[record.type] || []), ...RECORD_CLOSERS_GENERIC];

    return {
      kind: "record",
      title: `${info.emoji} ${info.label}${combined ? " & Allzeit-Highscore" : ""}`,
      body: paragraphs([
        intro,
        detail ? fill(detail, vars) : null,
        pickFresh("recordCloser", closers, 4),
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
      title: "👑 Wir haben einen neuen Altima Bowl Champion!",

      body: paragraphs([
        fill(pick(CHAMPION_INTROS), record),

        "Damit endet die Saison dort, wo sie angefangen hat: mit der Frage, wer am Ende ganz oben steht. Jetzt ist die Antwort bekannt – und der Name des Champions ist für die Geschichte des Altima Bowl notiert.",
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
    // Altima-Bowl-Kennzahlen ab. Der alte, neutrale Befund-Text weiter unten
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
        ? `Der Spielverlauf von ${candidate.player} wird der zeitlichen Reihenfolge nach den ${candidate.years.length} zuletzt verfügbaren Jahren von „${candidate.germanName}“ gegenübergestellt`
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
  // portrayed: Spieler, die schon in einem früheren Porträt vorkamen, werden
  // nicht noch einmal einsortiert (sonst taucht jemand erst bei den Contendern
  // und später beim Rest des Feldes auf, weil sich die Tabelle verschoben hat).
  function portrayedOf(published) {
    return (published && published.players) || new Set();
  }

  function computePortraitGroups(state, history, published) {
    const players = state.players || [];
    const done = portrayedOf(published);
    const names = players.map((p) => p.name).filter(Boolean).filter((n) => !done.has(n));
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
    const championDone = !!(published && published.has && published.has("champion"));
    if (!groups.champion.length && previousChampion && !championDone) {
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
      sentences.push("Für ihn ist es der erste Altima Bowl – keine Historie, keine Rekorde, aber auch noch keine Niederlagen, die man ihm vorhalten könnte.");
    } else {
      const seasonsPlayed = badge.seasonsPlayed || 0;
      const sp = `${seasonsPlayed} ${seasonsPlayed === 1 ? "Saison" : "Saisons"}`;
      let line = pickFresh("portraitSeasons", [`Er ist bereits ${sp} dabei`, `Seine ${seasonsPlayed + 1}. Teilnahme nach ${sp}`, `Altima-Bowl-Erfahrung: ${sp}`, `Bisher ${sp} im Turnier`], 3);
      if (stats.played) {
        line += `, Gesamtbilanz ${stats.wins}-${stats.losses} (Siege-Niederlagen)`;
        if (stats.ppg != null) line += ` bei durchschnittlich ${fmtDecimal(stats.ppg)} Punkten pro Spiel`;
      }
      sentences.push(line + ".");
    }

    if (badge.titles > 0) {
      let t = badge.titles === 1
        ? pickFresh("portraitTitle1", ["Ein Titel steht bereits auf seinem Konto", "Einmal stand er schon ganz oben", "Den Ring kennt er bereits aus eigener Erfahrung", "Ein Titel ist schon im Schrank"], 3)
        : pickFresh("portraitTitleN", [`${badge.titles} Titel stehen bereits auf seinem Konto`, `${badge.titles}-mal stand er schon ganz oben`, `${badge.titles} Ringe hat er schon gesammelt`], 2);
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
        `Sein Team hat übrigens Titel-Tradition: Die ${team} wurden schon ${teamHistory.count}× Altima-Bowl-Champion, zuletzt mit ${teamHistory.lastWinnerName} (${teamHistory.lastSeason}).`
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
        "Ob das für eine Titelverteidigung reicht, zeigen die nächsten Stunden. Verteidigen ist bekanntlich schwerer als Angreifen.",
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
        "Einer von ihnen wird am Ende vermutlich ganz oben stehen. Vermutlich. Beim Altima Bowl ist das nie garantiert.",
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
    const { groups } = computePortraitGroups(state, history, publishedGroups);
    const done = publishedGroups || new Set();
    return PORTRAIT_ORDER.find((g) => groups[g].length && !done.has(g)) || null;
  }

  // Fällig ist das nächste unveröffentlichte Porträt, sobald seine
  // Spielzahl (PORTRAIT_AT) erreicht ist. Pro Speichern höchstens eines.
  function isPortraitDue(state, publishedGroups, history) {
    const group = nextPortraitGroup(state, history, publishedGroups);
    return !!group && countFinishedMatches(state) >= PORTRAIT_AT[group];
  }

  function buildPortraitArticle(group, state, history, published) {
    const { groups, badges, ranks, championAbsent, previousChampion } = computePortraitGroups(state, history, published);
    const names = groups[group] || [];
    if (!names.length) return null;

    const isChallenger = group === "champion" && championAbsent;
    const text = isChallenger ? PORTRAIT_TEXT.challenger : PORTRAIT_TEXT[group];
    const rookies = names.filter((n) => (badges.get(n.toLowerCase()) || {}).isRookie);
    const hasDefender = !!groups.champion.length && !championAbsent;
    const openerPool = group === "contender" && !hasDefender && text.openersNoDefender ? text.openersNoDefender : text.openers;
    const parts = [pick(openerPool).replace(/\{prev\}/g, previousChampion || "Der Titelverteidiger")];
    if (group === "field" && rookies.length) {
      parts.push(`Besonders im Blick: ${rookies.length === 1 ? "der Rookie" : "die Rookies"} ${joinNames(rookies)} – ${rookies.length === 1 ? "er ist" : "sie sind"} zum ersten Mal beim Altima Bowl dabei.`);
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
  function buildWrapUpArticle(state, history, opts) {
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
      `${champion.name} ist Altima Bowl Champion: ${fw}:${fl} im Finale gegen ${runnerUp.name}. ${
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

    // Die Toilet Bowl bekommt einen eigenen Beitrag (buildToiletBowlArticle).
    const champSong = (opts && opts.songUrl) || (state.songs && state.songs.champion) || null;
    if (champSong) {
      parts.push(`<strong>Der Soundtrack.</strong> Zum Titel von ${champion.name} gibt es den passenden Song – direkt hier zum Anhören.`);
    }

    const wrapComments = buildCommentParagraph(opts && opts.comments);
    if (wrapComments) parts.push(wrapComments);
    parts.push("Damit ist die Saison Geschichte. Alle Zahlen wandern in die Hall of Fame – und ab jetzt gilt wieder das Wichtigste beim Altima Bowl: Bis zur Revanche wird fleißig diskutiert.");

    const article = {
      kind: "wrapup",
      title: "🏆 Siegerehrung & Turnierrückblick",
      body: paragraphs(parts),
      data: { champion: champion.name, runnerUp: runnerUp.name },
    };
    if (champSong) { article.media_url = champSong; article.media_type = "audio"; }
    return article;
  }

  // ======================================================================
  // TOILET-BOWL-ARTIKEL (erscheint zusammen mit dem Abschluss-Artikel nach dem
  // letzten Spiel). Der Toilet-Bowl-SIEGER gewinnt das Spiel, landet aber ganz
  // unten in der Endtabelle (und sichert sich den ersten Pick im nächsten
  // Draft); der Verlierer klettert nach oben (siehe applyToiletBowlOverride).
  // ======================================================================
  function buildToiletBowlArticle(state, history, opts) {
    const tb = MB.getPlayoffMatch(state, "tb");
    const winner = tb ? MB.winnerOf(tb) : null;
    const loser = tb ? MB.loserOf(tb) : null;
    if (!tb || !winner || !loser) return null;

    const ws = Math.max(tb.s1, tb.s2), ls = Math.min(tb.s1, tb.s2);
    const song = (opts && opts.songUrl) || (state.songs && state.songs.toiletBowl) || null;
    const parts = [
      pick([
        `Es gibt Siege, auf die man stolz ist. Und es gibt diesen: ${winner.name} gewinnt die Toilet Bowl gegen ${loser.name} mit ${ws}:${ls} – und landet damit ganz unten in der Endtabelle.`,
        `Niemand wollte dieses Spiel gewinnen, einer musste es tun: ${winner.name} schlägt ${loser.name} mit ${ws}:${ls} und sichert sich damit die rote Laterne des Turniers.`,
      ]),
      `Die Regel ist gnadenlos: Wer die Toilet Bowl gewinnt, rutscht in der Gesamtwertung auf den letzten Platz. ${loser.name} klettert durch die Niederlage dagegen in der Tabelle nach oben.`,
      `Immerhin gibt es einen Trost: ${winner.name} hat sich damit den allerersten Pick im Draft des nächsten Jahres gesichert.`,
    ];
    if (song) parts.push(`<strong>Der Soundtrack.</strong> Für die unangenehmste Trophäe der Saison gibt es auch einen eigenen Song – hier zum Anhören.`);
    parts.push(pick([
      "Damit ist auch die letzte Rechnung der Saison beglichen. Wer nächstes Jahr nicht hier landen will, weiß, was zu tun ist.",
      "Die Toilet Bowl ist entschieden – und die Erkenntnis bleibt: Manchmal ist Verlieren die bessere Platzierung.",
    ]));

    const article = {
      kind: "toiletbowl",
      title: "🚽 Toilet Bowl: Die undankbarste Trophäe der Saison",
      body: paragraphs(parts),
      data: { winner: winner.name, loser: loser.name },
    };
    if (song) { article.media_url = song; article.media_type = "audio"; }
    return article;
  }

  async function getPublishedPortraitGroups(tournamentId) {
    const articles = await fetchArticles(tournamentId, 200);
    const out = new Set();
    const players = new Set();
    (articles || []).forEach((a) => {
      if (a.kind === "portrait" && a.data && a.data.group) {
        out.add(a.data.group);
        (a.data.players || []).forEach((n) => players.add(n));
      }
    });
    out.players = players; // bereits porträtierte Spieler (jeder kommt nur einmal vor)
    return out;
  }

  // ======================================================================
  // SUPABASE
  // ======================================================================

  let lastPushArticleError = null; // Diagnose-Hilfe für publishSpuriousToBlog() u.ä., siehe getLastPushArticleError()

  async function pushArticle(tournamentId, article) {
    // Optional: KI schreibt den Text (nur für in den Einstellungen aktivierte
    // Beitragsarten, mit Fallback auf den Baustein-Text; siehe llm-blog.js).
    if (MB.LlmBlog && MB.LlmBlog.maybeRewrite) {
      try { article = await MB.LlmBlog.maybeRewrite(article); } catch (e) { console.warn("KI-Rewrite übersprungen:", e); }
    }
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

  // Jeder automatische Beitrag bekommt zusätzlich ALLE verwertbaren Fakten
  // (article.facts) und die Spielernamen (article._names) mitgegeben. Beides wird
  // nicht gespeichert (pushArticle schreibt nur feste Felder), dient aber dem
  // KI-Schreiber (llm-blog.js) und dem Testlauf. Die Fakten werden SOFORT beim
  // Bauen ermittelt, weil sich der Turnierstand danach weiter ändert.
  function withFacts(fn, ctxOf) {
    return function () {
      const a = fn.apply(this, arguments);
      if (a && MB.LlmBlog && MB.LlmBlog.factsFor) {
        try {
          const ctx = ctxOf.apply(null, arguments) || {};
          a.facts = MB.LlmBlog.factsFor(a, ctx);
          a._names = ((ctx.state && ctx.state.players) || []).map((p) => p && p.name).filter(Boolean);
        } catch (e) { /* Fakten sind optional */ }
      }
      return a;
    };
  }
  const ctxState = (state, history) => ({ state, history });

  // Kategorie-Optik (Badge + Vorschaubild) — gleiche Werte wie CATEGORY_META in blog.html,
  // damit Dashboard und Blog identisch aussehen.
  const CAT_META = {
    kickoff: ["Turnierstart", "#0EA5E9"], progress: ["Power Ranking", "#8B5CF6"], portrait: ["Spielerporträt", "#F97316"],
    wrapup: ["Turnierrückblick", "#EAB308"], record: ["Rekord", "#F59E0B"], finals: ["Finale", "#EF4444"], champion: ["Champion", "#22C55E"],
    song: ["Song", "#3B82F6"], retrospective: ["Rückblick", "#14B8A6"], spurious: ["Analyse", "#A855F7"], manual: ["Community", "#94A3B8"],
    meme: ["Meme", "#EC4899"], achievement: ["Sammelkarte", "#ff7ad9"],
  };
  function categoryMeta(a) {
    const kind = (a && a.kind) || "manual";
    const m = CAT_META[kind] || ["Beitrag", "#64748B"];
    let key = CAT_META[kind] ? kind : "manual";
    if (kind === "portrait") { const g = String((a.data && a.data.group) || ""); key = /champ|defend|titel/i.test(g) ? "portrait_champion" : /contend|chall|favor/i.test(g) ? "portrait_contender" : "portrait_field"; }
    return { label: m[0], color: m[1], image: `assets/images/blog/thumb_${key}.webp` };
  }

  global.MB.Blog = {
    categoryMeta,
    buildKickoffArticle: withFacts(buildKickoffArticle, (state, history) => ctxState(state, history)),
    buildRetrospectiveArticle: withFacts(buildRetrospectiveArticle, (seasons) => ({ seasons })),
    buildProgressArticle: withFacts(buildProgressArticle, (state, history, count) => ({ state, history, finishedCount: count })),
    buildCommentParagraph,
    buildRecordArticle: withFacts(buildRecordArticle, (record, c) => ({ record, state: c && c.state, history: c && c.history })),
    buildSongArticle: withFacts(buildSongArticle, (milestone, url, c) => ({ milestone, state: c && c.state, history: c && c.history })),
    buildFinalsArticle: withFacts(buildFinalsArticle, (record, c) => ({ record, state: c && c.state, history: c && c.history })),
    buildChampionArticle: withFacts(buildChampionArticle, (record, c) => ({ record, state: c && c.state, history: c && c.history })),
    // Kandidat mitgeben (nicht gespeichert) — braucht der KI-Schreiber für Werte/Jahre/r
    buildSpuriousArticle: function (candidate) { const a = buildSpuriousArticle(candidate); if (a) a._candidate = candidate; return a; },
    buildPortraitArticle: withFacts(buildPortraitArticle, (group, state, history) => ctxState(state, history)),
    buildWrapUpArticle: withFacts(buildWrapUpArticle, (state, history) => ctxState(state, history)),
    buildToiletBowlArticle: withFacts(buildToiletBowlArticle, (state, history) => ctxState(state, history)),
    buildPlayoffProgressArticle, computePlayoffStatus,
    joinNames, tidy,

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