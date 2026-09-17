/* =========================================================================
   MADDEN BOWL — ANNOUNCER (announcer.js)
   -------------------------------------------------------------------------
   Erzeugt aus Quoten, Namen, Flavour-Facts eine launige Gameshow-Ansage für
   ein gerade beendetes Spiel + die kommende Partie, und liest sie per
   Web Speech API (SpeechSynthesisUtterance) direkt vor — es wird NICHTS
   als Text angezeigt, nur gesprochen.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   Nutzung (in index.html, im setScore-Handler):
     MB.Announcer.announce({ state, history, finishedMatchId, homeName,
                              awayName, homeScore, awayScore, homeTeam, awayTeam });
   ========================================================================= */

(function (global) {
  "use strict";

  const OPENERS_RESULT = [
    "UND DAS WAR'S! Abpfiff im",
    "SCHLUSSPFIFF! Feierabend im",
    "AUS, VORBEI! Die Uhr steht bei Null im",
    "FERTIG! Das Spiel ist durch im",
    "SCHLUSS IN",
  ];
  const WIN_PHRASES = [
    "{winner} setzt sich mit {winnerScore} zu {loserScore} gegen {loser} durch.",
    "{winner} gewinnt mit {winnerScore} zu {loserScore} gegen {loser}.",
    "{winner} schlägt {loser} mit {winnerScore} zu {loserScore}.",
    "Am Ende steht es {winnerScore} zu {loserScore} für {winner} gegen {loser}.",
    "{winner} behält mit {winnerScore} zu {loserScore} gegen {loser} die Oberhand.",
    "{winner} macht die Partie mit {winnerScore} zu {loserScore} gegen {loser} klar.",
  ];
  // Bewusst aus der Verlierer-Perspektive formuliert - sorgt zusammen mit
  // WIN_PHRASES für mehr Abwechslung, statt immer nur den Sieger zu betonen.
  const LOSE_PHRASES = [
    "{loser} muss sich {winner} mit {loserScore} zu {winnerScore} geschlagen geben.",
    "Für {loser} reicht es nicht - {winner} gewinnt mit {winnerScore} zu {loserScore}.",
    "{loser} verliert mit {loserScore} zu {winnerScore} gegen {winner}.",
    "Am Ende zieht {loser} gegen {winner} mit {loserScore} zu {winnerScore} den Kürzeren.",
  ];
  const CLOSE_GAME_PHRASES = [
    "Das war eng bis zum Schluss.",
    "Mehr Spannung ging kaum — hier war bis zuletzt alles drin.",
    "Ein Duell auf Messers Schneide bis in die Schlussphase.",
  ];
  const BLOWOUT_PHRASES = [
    "Das war heute eine ziemlich klare Angelegenheit.",
    "Da war früh zu sehen, wohin die Reise geht.",
    "Am Ende wurde es deutlich — da kam nicht mehr viel zurück.",
  ];
  // Nur der Kommentator übergibt an den Moderator (Anforderung 20) - Name
  // kommt dynamisch aus den konfigurierten Sprecher-Namen, nie hartcodiert.
  const HANDOFF_OUT_PHRASES = [
    (n) => `Und jetzt zu ${n.moderator}.`,
    () => `Was steht als Nächstes an?`,
    () => `Wie geht's weiter?`,
    () => `Was kommt als Nächstes?`,
    (n) => `${n.moderator}, was ist die nächste Partie?`,
    () => `Wer ist als Nächstes dran?`,
  ];
  // Der Moderator sagt nur gelegentlich "Danke" (Anforderung 21) - drei von
  // vier Varianten sind bewusst leer, damit die Ansage meistens direkt mit
  // der nächsten Partie beginnt.
  const HANDOFF_IN_PHRASES = [
    () => "",
    () => "",
    () => "",
    (n) => `Danke ${n.commentator}.`,
  ];

  // ======================================================================
  // SPRECHER-KONFIGURATION (Anforderung 1) — Kommentator/Moderator sind
  // Rollen, keine festen Namen. Admin kann beide Namen frei konfigurieren;
  // Rudi/Mona sind nur Default-Werte. Wird lokal gespeichert, damit die
  // Namen einen Reload überleben.
  // ======================================================================
  const DEFAULT_SPEAKER_NAMES = { commentator: "Rudi", moderator: "Mona" };
  const SPEAKER_NAMES_KEY = "mb_announcer_speakers";
  let _speakerNamesCache = null;

  function getSpeakerNames() {
    if (_speakerNamesCache) return _speakerNamesCache;
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(SPEAKER_NAMES_KEY) || "{}"); }
    catch (e) { stored = {}; }
    _speakerNamesCache = {
      commentator: stored.commentator || DEFAULT_SPEAKER_NAMES.commentator,
      moderator: stored.moderator || DEFAULT_SPEAKER_NAMES.moderator,
    };
    return _speakerNamesCache;
  }

  function setSpeakerNames({ commentator, moderator } = {}) {
    const next = {
      commentator: (commentator || "").trim() || DEFAULT_SPEAKER_NAMES.commentator,
      moderator: (moderator || "").trim() || DEFAULT_SPEAKER_NAMES.moderator,
    };
    _speakerNamesCache = next;
    try { localStorage.setItem(SPEAKER_NAMES_KEY, JSON.stringify(next)); }
    catch (e) { console.warn("Sprecher-Namen konnten nicht gespeichert werden:", e); }
    return next;
  }

  // Namen bleiben in den Daten exakt erhalten. Nur für die Sprachausgabe
  // werden problematische Abkürzungen phonetisch ausgeschrieben.
  function speechName(name) {
    return String(name || "")
      .replace(/\bTobi\s+F\./g, "Tobi Eff")
      .replace(/\bTobi\s+W\./g, "Tobi Weh");
  }

  function speechNames(homeName, awayName) {
    return { home: speechName(homeName), away: speechName(awayName) };
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmt(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""); }

  // Fakten aus shared.js (MB.pickFlavourFactsTyped/getAnnouncerResultImpacts)
  // kommen bereits mit `type` getaggt. classifyFact() ist nur noch ein
  // Sicherheitsnetz für den Fall, dass irgendwo doch mal ein unklassifizierter
  // String ankommt (Anforderung 4) - die eigentliche Typisierung passiert an
  // der Quelle in shared.js, nicht hier per Keyword-Raten.
  function classifyFact(fact) {
    if (fact && typeof fact === "object" && fact.type) return fact.type;
    const text = String(fact || "");
    if (/Wettquote/i.test(text)) return "odds";
    if (/Direktvergleich/i.test(text)) return "directComparison";
    if (/Gesamtpunkte|Punkte pro Spiel|Punkten/i.test(text)) return "averagePoints";
    if (/Playoffs?/i.test(text)) return "playoffFact";
    if (/Siegen? in Folge|Rhythmus|verteidigt|liefert offensiv|stark unterwegs|Spiele in Folge verloren/i.test(text)) return "form";
    if (/Tabelle/i.test(text)) return "tableImpact";
    if (/Titelchancen/i.test(text)) return "titleImpact";
    return "other";
  }

  // Sprachlich natürlichere Fassung eines Fakts (Anforderung 17): entfernt
  // das rohe "Direktvergleich: "-Präfix und vermeidet doppelte Namensnennung.
  // Deckt genau die beiden Direktvergleich-Formulierungen aus
  // shared.js/pickFlavourFactsTyped ab; alles andere bleibt unverändert.
  function naturalizeFact(text) {
    if (!text) return text;
    let m = text.match(/^Direktvergleich: (.+?) führt mit (.+)$/);
    if (m) return `Im Direktvergleich führt ${m[1]} mit ${m[2]}`;
    m = text.match(/^Direktvergleich: (.+?) und (.+?) stehen bei (.+)$/);
    if (m) return `Im Direktvergleich stehen ${m[1]} und ${m[2]} bei ${m[3]}`;
    return text;
  }

  // Zentrale Stadion-Formulierung (Anforderung 19). Grammatikalisches
  // Geschlecht lässt sich aus einem freien Stadionnamen nicht zuverlässig
  // herleiten, daher: Default "im" (deckt die meisten Fälle wie "...-Stadion"
  // oder "...Field" ab) mit Möglichkeit, pro Stadion eine andere Präposition
  // zu übergeben (z.B. "in der" für "Energiequelle") - siehe Admin-Konfig in
  // index.html. Bereits vorhandene Präpositionen werden nicht verdoppelt.
  function stadiumPhrase(stadium, preposition) {
    if (!stadium) return "";
    const s = String(stadium).trim();
    if (/^(im|in der|in dem|in|auf dem)\s+/i.test(s)) return s;
    return `${preposition || "im"} ${s}`;
  }

  // Reihenfolge, in der Preview-Fakt-Typen bevorzugt werden (Anforderung 14).
  // Darf sich verschieben, wenn das natürlicher klingt - wichtig ist nur,
  // dass bereits verwendete Typen (usedFactTypes) ausgeschlossen werden.
  function buildOddsFact(history, state, homeName, awayName) {
    try {
      const odds = MB.computeOddsForMatch(history, state, homeName, awayName);
      const favIsHome = odds.pHome >= odds.pAway;
      const favName = speechName(favIsHome ? homeName : awayName);
      const dogName = speechName(favIsHome ? awayName : homeName);
      // Rohe Zahl reicht - sanitizeForSpeech() schreibt die Nachkommastellen
      // beim Sprechen komplett aus (siehe dort), damit z.B. "1,39" nicht
      // buchstabiert als "eins drei neun" vorgelesen wird.
      const favQuote = MB.decimalOdds(favIsHome ? odds.pHome : odds.pAway).toFixed(2);
      const dogQuote = MB.decimalOdds(favIsHome ? odds.pAway : odds.pHome).toFixed(2);
      // Score in der Größenordnung der übrigen Fakten (siehe shared.js/add()),
      // damit die Quote nicht per starrer Prioritätsregel jedes Mal gewinnt.
      return { type: "odds", text: `Die Wettquoten sehen ${favName} bei ${favQuote} und ${dogName} bei ${dogQuote}.`, score: 9 };
    } catch (e) { return null; }
  }

  function buildRivalryFact(history, state, homeName, awayName) {
    try {
      const rivalry = MB.computeBiggestRivalry(history, state);
      // Erst ab einer spürbaren Anzahl Spiele als "Rivalität" ausrufen -
      // sonst wäre jede beliebige Erstpaarung automatisch "die größte".
      if (!rivalry || rivalry.count < 3) return null;
      if (rivalry.pairKey !== MB.pairKey(homeName, awayName)) return null;
      return { type: "rivalry", text: `Das ist mit ${rivalry.count} Spielen die meistgespielte Partie der Madden-Bowl-Geschichte.`, score: 13 };
    } catch (e) { return null; }
  }

  // "Gelingt die Revanche?" - wer hat die beiden zuletzt gegeneinander
  // gespielten Partien gewonnen, und bekommt der Verlierer von damals jetzt
  // die Chance zurückzuschlagen.
  function buildRevengeFact(history, state, homeName, awayName) {
    try {
      const s = MB.computeMatchupStats(history, state, homeName, awayName);
      if (!s || s.games < 1) return null;
      const lastWinnerRaw = s.lastWinners[s.lastWinners.length - 1];
      if (!lastWinnerRaw) return null; // letztes Duell war unentschieden
      const H = MB.normName(homeName);
      const lastLoserRaw = lastWinnerRaw === H ? awayName : homeName;
      return {
        type: "revenge",
        text: `Beim letzten Duell hat sich ${speechName(lastWinnerRaw)} gegen ${speechName(lastLoserRaw)} durchgesetzt - gelingt heute die Revanche?`,
        score: 10,
      };
    } catch (e) { return null; }
  }

  // Runde Gesamtspielzahl in der Madden-Bowl-Geschichte (Historie + laufendes
  // Turnier bis inkl. dem gerade beendeten Spiel) - reine Trivia, alle 50 Spiele.
  function buildRoundNumberFact(history, state) {
    try {
      const histCount = (history.matches || []).length;
      const curCount = MB.getCurrentMatchesNormalized(state).filter((m) => m.homeScore != null && m.awayScore != null).length;
      const total = histCount + curCount;
      if (total > 0 && total % 50 === 0) {
        return { type: "milestone", text: `Nebenbei: Das war gerade Spiel Nummer ${total} in der gesamten Madden-Bowl-Geschichte.`, score: 14 };
      }
    } catch (e) {}
    return null;
  }

  // Wählt EINEN Preview-Fakt für den Moderator, der noch nicht von einem
  // anderen Typ verbraucht wurde (Anforderungen 3, 15, 16). Holt sich dafür
  // ALLE getypten Kandidaten aus shared.js (nicht nur die Top 2 wie die
  // Anzeige-Variante pickFlavourFacts), damit bei einer Typ-Kollision noch
  // Alternativen übrig sind. Auswahl ist score-gewichtet-zufällig statt
  // starr nach fester Prioritätsliste (sonst gewinnen die Wettquoten, die
  // praktisch immer verfügbar sind, jedes einzelne Mal - Anforderung 14
  // erlaubt das ausdrücklich: "Priorisierung darf angepasst werden, sofern
  // dadurch die Ausgabe natürlicher wird").
  function pickUpcomingFact(history, state, homeName, awayName, usedFactTypes) {
    const used = usedFactTypes || new Set();
    const candidates = [];
    const oddsFact = buildOddsFact(history, state, homeName, awayName);
    if (oddsFact) candidates.push(oddsFact);
    const rivalryFact = buildRivalryFact(history, state, homeName, awayName);
    if (rivalryFact) candidates.push(rivalryFact);
    const revengeFact = buildRevengeFact(history, state, homeName, awayName);
    if (revengeFact) candidates.push(revengeFact);
    const roundNumberFact = buildRoundNumberFact(history, state);
    if (roundNumberFact) candidates.push(roundNumberFact);
    try {
      (MB.pickFlavourFactsTyped(history, state, homeName, awayName) || []).forEach((f) => candidates.push(f));
    } catch (e) {}

    const available = candidates.filter((f) => !used.has(f.type));
    if (!available.length) return null;

    const withJitter = available.map((f) => ({ f, key: (f.score || 5) + Math.random() * 6 }));
    withJitter.sort((a, b) => b.key - a.key);
    return withJitter[0].f;
  }

  // Spricht einen von MB.Records.detectRecords() erkannten Rekord natürlich
  // aus. Die Erkennung selbst bleibt zentral in records.js (Anforderung 29
  // sinngemäß: keine parallele Logik) - hier wird nur die Sprachformulierung
  // gebaut.
  function describeRecordForSpeech(rec) {
    if (!rec) return null;
    const player = rec.player ? speechName(rec.player) : "";
    const opponent = rec.opponent ? speechName(rec.opponent) : "";
    switch (rec.type) {
      case "allTimeMargin":
        return `Das ist die größte Klatsche der gesamten Madden-Bowl-Geschichte!`;
      case "tournamentMargin":
        return `Das ist der bisher größte Blowout dieses Turniers!`;
      case "allTimeHigh":
        return `Und das ist gleichzeitig ein neuer Allzeit-Highscore mit ${rec.value} Punkten für ${player}!`;
      case "winStreak":
        return `${player} feiert damit den ${rec.value}. Sieg in Folge.`;
      case "upset":
        return `Das ist eine faustdicke Überraschung - ${player} war hier klarer Außenseiter gegen ${opponent}.`;
      case "shutout":
        return `${opponent} kam praktisch nicht vom Fleck.`;
      case "shootout":
        return `Das ist die höchste Gesamtpunktzahl, die dieses Turnier bisher gesehen hat.`;
      default:
        return null;
    }
  }
  // Diese Rekord-Typen sagen bereits selbst "das war ein Blowout" - die
  // generische CLOSE/BLOWOUT-Farbkommentar-Zeile würde dann nur denselben
  // Punkt ein zweites Mal machen.
  const MARGIN_RECORD_TYPES = new Set(["allTimeMargin", "tournamentMargin", "shutout"]);
  // Wenn ein Spiel mehrere Rekorde gleichzeitig bricht (z.B. Highscore UND
  // größte Klatsche in einem), wird nur EINER angesagt (sonst zu viel) -
  // Blowout-Rekorde zuerst, weil das i.d.R. die spektakulärere Aussage ist.
  const RECORD_SPEECH_PRIORITY = ["allTimeMargin", "tournamentMargin", "allTimeHigh", "shutout", "upset", "shootout", "winStreak"];

  // Kommentator: berichtet AUSSCHLIESSLICH über das gerade abgeschlossene
  // Spiel (Anforderung 6). Ergebnis-Impact (Tabelle/Titel, zentral aus
  // shared.js) hat Vorrang; ohne Impact ist der Direktvergleich der einzige
  // erlaubte Rückfall-Fakt (Anforderung 12) - niemals allgemeine
  // Preview-Fakten des kommenden Spiels. Gibt zusätzlich zurück, welcher(r)
  // Fakt-Typ verbraucht wurde, damit der Moderator ihn nicht doppelt nennt.
  function buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, prevSeeds, matchKind, matchId, songMilestone, songGenerated }) {
    const winnerRaw = homeScore > awayScore ? homeName : awayName;
    const loserRaw = homeScore > awayScore ? awayName : homeName;
    const winner = speechName(winnerRaw), loser = speechName(loserRaw);
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    const margin = winnerScore - loserScore;
    const usedFactTypes = new Set();
    const names = getSpeakerNames();

    let line = `${pick(OPENERS_RESULT)} ${stadium || "Stadion"}! `;
    // Ergebnis UND Sieger/Verlierer in EINEM Satz (nicht mehr getrennt als
    // "Endstand: ..." + "X schlägt Y" - das klang doppelt gemoppelt). Mix aus
    // Sieger- und Verlierer-Perspektive für mehr Abwechslung.
    line += fmt(pick([...WIN_PHRASES, ...LOSE_PHRASES]), { winner, loser, winnerScore, loserScore }) + " ";

    // Neuer Rekord? (größte Klatsche, Highscore, Siegesserie, Überraschung, ...)
    // - erkannt zentral in records.js, hier nur ausgesprochen.
    let recordText = null, recordType = null;
    try {
      if (MB.Records && typeof MB.Records.detectRecords === "function") {
        const newRecords = MB.Records.detectRecords(state, history, { homeName, awayName, homeScore, awayScore }) || [];
        if (newRecords.length) {
          newRecords.sort((a, b) => RECORD_SPEECH_PRIORITY.indexOf(a.type) - RECORD_SPEECH_PRIORITY.indexOf(b.type));
          recordType = newRecords[0].type;
          recordText = describeRecordForSpeech(newRecords[0]);
        }
      }
    } catch (e) {}

    // Nicht JEDES enge/deutliche Spiel bekommt zusätzlich noch eine
    // Farbkommentar-Zeile - sonst klingt jede Ansage gleich lang/gleich
    // aufgebaut. Manchmal reicht der reine Ergebnissatz. Ein Rekord, der
    // bereits "das war ein Blowout" aussagt, ersetzt die generische Zeile,
    // statt denselben Punkt doppelt zu machen.
    if (recordType && MARGIN_RECORD_TYPES.has(recordType)) {
      // generische Zeile bewusst übersprungen
    } else if (margin <= 3 && Math.random() < 0.7) line += pick(CLOSE_GAME_PHRASES) + " ";
    else if (margin >= 21 && Math.random() < 0.7) line += pick(BLOWOUT_PHRASES) + " ";

    if (recordText) line += recordText + " ";

    let impactUsed = false;
    try {
      const impacts = MB.getAnnouncerResultImpacts(history, state, winnerRaw, loserRaw, prevSeeds, { matchKind, matchId }) || [];
      if (impacts.length) {
        const top = impacts[0];
        // Ausscheiden/Tabellensprung sind echte News und werden immer
        // genannt; Titelchancen sind reine Kür und dürfen auch mal wegfallen
        // (siehe auch die 50%-Hürde dafür schon in shared.js).
        const important = top.type === "eliminationImpact" || top.type === "tableImpact";
        if (important || Math.random() < 0.65) {
          line += top.text + " ";
          usedFactTypes.add(top.type);
          impactUsed = true;
        }
      }
    } catch (e) {}

    if (!impactUsed && Math.random() < 0.65) {
      try {
        const typed = MB.pickFlavourFactsTyped(history, state, homeName, awayName) || [];
        const directCompare = typed.find((f) => f.type === "directComparison");
        if (directCompare) {
          line += naturalizeFact(directCompare.text) + " ";
          usedFactTypes.add("directComparison");
        }
      } catch (e) {}
    }

    // Song-Meilenstein, der GENAU JETZT (im selben Score-Commit) entschieden
    // wurde - siehe index.html/promptSongMomentPopup(). Nur wenn tatsächlich
    // ein Song generiert wurde, sonst kein Wort darüber. Der Song selbst wird
    // separat über announceSong() angesagt/abgespielt (eigene Intro-Zeile).
    if (songGenerated) {
      if (songMilestone === "firstElimination") {
        line += "Das Internet hat bereits mit einem Song reagiert. ";
      } else if (songMilestone === "champion") {
        line += `${winner} hat vorher heimlich seinen eigenen Song geschrieben, um den Sieg zu feiern. Hören wir mal rein. `;
      }
    }

    if (songMilestone !== "champion") line += pick(HANDOFF_OUT_PHRASES)(names);

    return { line: line.trim(), usedFactTypes };
  }

  // Moderator: berichtet AUSSCHLIESSLICH über die kommende Partie
  // (Anforderung 8) und nennt mindestens einen Preview-Fakt, dessen Typ noch
  // nicht vom Kommentator verwendet wurde (Anforderungen 9, 15, 16). Übergibt
  // nie zurück an den Kommentator (Anforderung 20) und endet ohne generische
  // Schlussfloskel (Anforderung 22).
  // Mehrere Varianten für den Einstieg in die Vorschau, statt immer exakt
  // demselben Satzbau - "{away}"/"{home}" halten die UI-Konvention ein
  // (erster Name = Auswärts, zweiter = Heim).
  const UPCOMING_LEAD_INS = [
    "Als Nächstes spielt {away} bei {home}",
    "Weiter geht's mit {away} bei {home}",
    "Die nächste Partie: {away} bei {home}",
    "Dann kommt {away} bei {home}",
    "Als Nächstes duellieren sich {away} und {home}",
  ];
  // Sonderfälle: Toilet Bowl und Finale sind kein normales Spiel und
  // verdienen keine 08/15-Ansage. `phase` kommt 1:1 aus MB.getUpcomingMatches()
  // (state.playoffMatches[i].phase, z.B. "Toilet Bowl"/"Madden Bowl").
  const SPECIAL_PHASE_LEAD_INS = {
    "Toilet Bowl": [
      "Es geht um die rote Laterne: als Nächstes die Toilet Bowl zwischen {away} und {home}",
      "Niemand will dieses Spiel gewinnen - jetzt die Toilet Bowl zwischen {away} und {home}",
    ],
    "Madden Bowl": [
      "Das Finale! {away} gegen {home} um den Titel",
      "Jetzt geht's um alles: {away} gegen {home} im großen Finale, dem Madden Bowl",
    ],
  };
  // Gelegentlicher kleiner Konnektor vor dem Fakt, statt immer nahtlos
  // anzuschließen - rein für Abwechslung, meistens bleibt es aber leer.
  const FACT_CONNECTORS = ["", "", "", "Dazu: ", "Außerdem: "];

  // Teaser-Zeilen für einen Song-Meilenstein, der GENAU JETZT (im selben
  // Score-Commit, vor dieser Vorschau) entschieden wurde - nur wenn der Song
  // auch tatsächlich generiert wurde (sonst kein Wort darüber verlieren).
  // Der eigentliche Song wird separat über announceSong() angesagt/abgespielt
  // (eigene Intro-Zeile dort) - hier nur der kurze Teaser davor.
  const SONG_TEASER_UPCOMING = {
    regularSeason: "Wir starten in die Playoffs, aber vorher noch eine musikalische Zusammenfassung.",
    firstElimination: "Tja, sowas passiert wohl, wenn man nicht aufpasst.",
    finals: "Jedes Jahr freut sich die ganze Welt auf die Halbzeit-Show und die Werbespots - aber dieses Jahr wurde bereits vorher ein viraler Moment geschaffen...",
  };

  function buildUpcomingLine({ state, history, homeName, awayName, time, stadium, stadiumPreposition, phase, usedFactTypes, songMilestone, songGenerated }) {
    const { home, away } = speechNames(homeName, awayName);
    const names = getSpeakerNames();
    const used = usedFactTypes || new Set();

    const handoffIn = pick(HANDOFF_IN_PHRASES)(names);
    let line = handoffIn ? `${handoffIn} ` : "";

    if (songMilestone && songGenerated && SONG_TEASER_UPCOMING[songMilestone]) {
      line += SONG_TEASER_UPCOMING[songMilestone] + " ";
    }

    const leadIns = (phase && SPECIAL_PHASE_LEAD_INS[phase]) || UPCOMING_LEAD_INS;
    line += fmt(pick(leadIns), { away, home });
    if (time) line += `, Anpfiff ${formatTimeForSpeech(time)}`;
    if (stadium) line += `, ${stadiumPhrase(stadium, stadiumPreposition)}`;
    line += ". ";

    const fact = pickUpcomingFact(history, state, homeName, awayName, used);
    if (fact) {
      line += pick(FACT_CONNECTORS) + naturalizeFact(fact.text) + " ";
      used.add(fact.type);

      // Selten einen zweiten (anders typisierten) Fakt nachschieben, wenn
      // noch einer übrig ist - klingt dann etwas kompletter, ohne dass es
      // jedes Mal passiert.
      if (Math.random() < 0.2) {
        const second = pickUpcomingFact(history, state, homeName, awayName, used);
        if (second) {
          line += "Und: " + naturalizeFact(second.text) + " ";
          used.add(second.type);
        }
      }
    }

    return line.trim();
  }

  // ---- Textbereinigung für saubere Aussprache ----
  // BUGFIX: "17." (Zahl direkt gefolgt von Punkt) wird von deutschen TTS-
  // Stimmen als Ordinalzahl gelesen ("siebzehnter" statt "siebzehn"). Wir
  // trennen den Punkt per Leerzeichen ab, das reicht den meisten Engines,
  // um die Ordinal-Interpretation zu vermeiden — hörbar bleibt es eine
  // normale Kardinalzahl.
  // Deutsche Zahlwörter 0-99 - für die Sprachausgabe von Dezimalzahlen
  // (Anforderungen 23/24/25). Viele TTS-Stimmen lesen "1,39" buchstabiert als
  // "eins Komma drei neun" statt "eins Komma neununddreißig" - deshalb
  // werden Dezimalzahlen hier vor der Sprachausgabe komplett ausgeschrieben,
  // statt nur den Punkt durch ein Komma zu ersetzen.
  const ONES_DE = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
  const TEENS_DE = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const TENS_DE = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

  function numberWordsDE(n) {
    n = Math.round(n);
    if (n < 0) return `minus ${numberWordsDE(-n)}`;
    if (n < 10) return ONES_DE[n];
    if (n < 20) return TEENS_DE[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return o === 0 ? TENS_DE[t] : `${ONES_DE[o]}und${TENS_DE[t]}`;
    }
    // Kommt bei Quoten/Statistiken in der Praxis nicht vor - normale
    // Ziffernaussprache ist hier ein akzeptabler Rückfall.
    return String(n);
  }

  function digitsWordsDE(digitsStr) {
    return digitsStr.split("").map((d) => ONES_DE[parseInt(d, 10)]).join(" ");
  }

  function sanitizeForSpeech(text) {
    return text
      // Dezimalzahlen für deutsche TTS (Anforderungen 23/24/25) - NUR hier im
      // Sprachpfad, nicht in shared.js/one(), damit die sichtbaren
      // Insight-Texte auf index.html/live.html/music.js unverändert bleiben.
      // "42.0"/"42,0" -> "zweiundvierzig" (keine unnötige Nachkommastelle).
      // Nachkommastellen werden EINZELN gesprochen ("1,39" -> "eins Komma
      // drei neun"), nicht als zusammengesetzte Zahl ("neununddreißig") -
      // das ist die gewünschte/übliche Sprechweise für Quoten & Co.
      .replace(/(\d+)[.,](\d+)/g, (_, intPart, fracPart) => {
        if (/^0+$/.test(fracPart)) return numberWordsDE(parseInt(intPart, 10));
        return `${numberWordsDE(parseInt(intPart, 10))} Komma ${digitsWordsDE(fracPart)}`;
      })
      .replace(/(\d)\.(\s|$)/g, "$1 .$2")   // "17." -> "17 ." (Ordinalzahl-Fix)
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // "20:00" -> "20 Uhr" / "20:15" -> "20 Uhr 15" (Anforderung 23-nah): die
  // App speichert Uhrzeiten als "HH:MM", aber der Doppelpunkt wird von
  // manchen TTS-Stimmen unsauber gelesen. Ganz ohne Satzzeichen ausschreiben
  // ist die zuverlässigste Variante.
  function formatTimeForSpeech(time) {
    if (!time || typeof time !== "string" || !time.includes(":")) return time || "";
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(h)) return time;
    return (!m ? `${h} Uhr` : `${h} Uhr ${m}`);
  }

  // ======================================================================
  // ELEVENLABS (optional, kostenpflichtig) — Provider-Umschaltung
  // -------------------------------------------------------------------------
  // Einstellungen liegen NUR in localStorage (pro Gerät/Browser), NICHT in
  // Supabase — die Datenbank-RLS ist aktuell offen für jeden mit dem
  // anon-Key, ein bezahlter API-Key sollte dort nicht landen. Siehe README.
  // ======================================================================
  function getTtsSettings() {
    try { return JSON.parse(localStorage.getItem("mb_tts_settings") || "{}"); }
    catch (e) { return {}; }
  }

  function setTtsSettings(settings) {
    try { localStorage.setItem("mb_tts_settings", JSON.stringify(settings || {})); }
    catch (e) { console.warn("TTS-Settings konnten nicht gespeichert werden:", e); }
  }

  async function fetchElevenLabsVoices(apiKey) {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`ElevenLabs-Fehler beim Laden der Stimmen (HTTP ${res.status})`);
    const data = await res.json();
    return data.voices || [];
  }

  async function speakElevenLabs(text, { apiKey, voiceId, modelId }) {
    const url = await fetchElevenLabsAudioUrl(text, { apiKey, voiceId, modelId });
    await playAudioUrl(url);
  }

  // Trennt "Audio besorgen" von "Audio abspielen": so lässt sich das Audio
  // für mehrere Zeilen VORAB parallel generieren (siehe speakSequence unten),
  // während die vorherige Zeile noch läuft — keine Wartezeit mehr bei der
  // Übergabe zwischen zwei Sprechern.
  async function fetchElevenLabsAudioUrl(text, { apiKey, voiceId, modelId }) {
    if (!apiKey || !voiceId) throw new Error("ElevenLabs: API-Key oder Stimme fehlt.");
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text: sanitizeForSpeech(text),
        model_id: modelId || "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.detail?.message || ""; } catch (e) {}
      throw new Error(`ElevenLabs-Fehler HTTP ${res.status}${detail ? ": " + detail : ""}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function playAudioUrl(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      const cleanup = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    });
  }

  // Zentraler Sprech-Aufruf: nutzt ElevenLabs, wenn konfiguriert & aktiv,
  // fällt bei Fehlern automatisch auf die kostenlose Browser-Stimme zurück
  // (nie stumm bleiben, nur weil ElevenLabs gerade mal ein Problem hat).
  async function speakSmart(text, { voiceId } = {}) {
    const settings = getTtsSettings();
    if (settings.provider === "elevenlabs" && settings.apiKey && voiceId) {
      try {
        await speakElevenLabs(text, { apiKey: settings.apiKey, voiceId, modelId: settings.modelId });
        return;
      } catch (e) {
        console.warn("ElevenLabs fehlgeschlagen, Fallback auf Browser-Stimme:", e);
      }
    }
    await speak(text);
  }

  // Spielt mehrere Zeilen nacheinander OHNE Wartezeit an den Übergängen.
  // Statt jede Zeile erst nach Ende der vorherigen bei ElevenLabs anzufragen
  // (das kostet pro Zeile ~1-3s Generierungszeit), werden ALLE ElevenLabs-
  // Anfragen sofort parallel losgeschickt ("gleichzeitig generieren") und
  // dann strikt der Reihe nach abgespielt ("nacheinander in die Playlist
  // einsortiert") — während Zeile 1 noch läuft, ist Zeile 2 im Hintergrund
  // längst fertig generiert und wartet nur noch aufs Abspielen.
  // segments: [{ text, voiceId }] — voiceId=null/undefined -> Browser-Stimme.
  async function speakSequence(segments) {
    const settings = getTtsSettings();
    const useElevenLabs = settings.provider === "elevenlabs" && !!settings.apiKey;

    const prepared = segments.map((seg) => {
      if (useElevenLabs && seg.voiceId) {
        return {
          seg,
          audioPromise: fetchElevenLabsAudioUrl(seg.text, {
            apiKey: settings.apiKey, voiceId: seg.voiceId, modelId: settings.modelId,
          }).catch((e) => {
            console.warn("ElevenLabs-Vorgenerierung fehlgeschlagen, Fallback auf Browser-Stimme:", e);
            return null;
          }),
        };
      }
      return { seg, audioPromise: null };
    });

    for (const { seg, audioPromise } of prepared) {
      if (audioPromise) {
        const url = await audioPromise; // meist schon fertig, da parallel gestartet
        if (url) { await playAudioUrl(url); continue; }
      }
      await speak(seg.text); // Browser-Stimme oder Fallback bei ElevenLabs-Fehler
    }
  }

  // ---- Web Speech API ----
  let cachedVoice = null;
  let forcedVoiceName = null;
  try { forcedVoiceName = localStorage.getItem("mb_tts_voice_name") || null; } catch (e) {}

  function setPreferredVoice(name) {
    forcedVoiceName = name || null;
    cachedVoice = null;
    try {
      if (name) localStorage.setItem("mb_tts_voice_name", name);
      else localStorage.removeItem("mb_tts_voice_name");
    } catch (e) {}
  }

  function getGermanVoiceCandidates() {
    if (!("speechSynthesis" in window)) return [];
    return speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
  }

  // Bevorzugt hochwertige Online-Neural-Stimmen ("... Online (Natural)"),
  // die Edge/Chrome unter Windows 11 kostenlos mitbringen — deutlich
  // natürlicher als die alten lokalen SAPI-Stimmen (z.B. "Hedda"/"Stefan"),
  // die sonst oft als Default landen.
  function pickGermanVoice() {
    if (cachedVoice) return cachedVoice;
    if (!("speechSynthesis" in window)) return null;
    const all = speechSynthesis.getVoices();
    const de = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith("de"));

    if (forcedVoiceName) {
      const forced = all.find((v) => v.name === forcedVoiceName);
      if (forced) { cachedVoice = forced; return cachedVoice; }
    }

    const natural = de.find((v) => /online\s*\(natural\)|natural/i.test(v.name));
    cachedVoice = natural || de[0] || all[0] || null;
    return cachedVoice;
  }

  function speak(text, opts = {}) {
    if (!("speechSynthesis" in window)) {
      console.warn("Web Speech API nicht verfügbar im Browser.");
      return Promise.resolve();
    }
    const clean = sanitizeForSpeech(text);
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      const voice = pickGermanVoice();
      if (voice) utter.voice = voice;
      utter.lang = (voice && voice.lang) || "de-DE";
      utter.rate = opts.rate ?? 1.02;
      utter.pitch = opts.pitch ?? 1.05;
      utter.onend = resolve;
      utter.onerror = resolve;
      speechSynthesis.speak(utter);
    });
  }

  // Stellt sicher, dass Stimmen geladen sind (manche Browser laden sie async
  // nach; Edge liefert dabei manchmal kurzzeitig kaputte "undefined"-Namen —
  // daher zusätzlich ein kurzer Retry).
  function warmupVoices() {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
    let tries = 0;
    const retry = setInterval(() => {
      tries++;
      const de = getGermanVoiceCandidates();
      const hasUsableName = de.some((v) => v.name && !v.name.includes("undefined"));
      if (hasUsableName || tries > 10) { clearInterval(retry); cachedVoice = null; }
    }, 400);
  }

  // Eigentliche Ansage-Logik (vormals der einzige "announce"). Umbenannt zu
  // _announceNow, weil der öffentliche Einstiegspunkt jetzt announce() weiter
  // unten ist, der Aufrufe in eine Warteschlange einreiht.
  async function _announceNow({ state, history, homeName, awayName, homeScore, awayScore, stadium, stadiumPreposition, upcoming, prevSeeds, matchKind, matchId, songMilestone, songGenerated }) {
    if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) return;

    const settings = getTtsSettings();
    const twoVoiceMode = settings.provider === "elevenlabs" && settings.voiceIdResult && settings.voiceIdPreview;

    // buildResultLine() enthält bereits die Übergabe ans Ende der Zeile
    // (Anforderung 20: nur der Kommentator übergibt) und liefert zurück,
    // welche(r) Fakt-Typ(en) dabei verbraucht wurden, damit der Moderator
    // nicht denselben Typ nochmal nennt (Anforderungen 3, 15, 16).
    const { line: resultLine, usedFactTypes } = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, prevSeeds, matchKind, matchId, songMilestone, songGenerated });
    const nextMatch = (upcoming || [])[0] || null;

    const buildPreviewLine = () => buildUpcomingLine({
      state, history, homeName: nextMatch.homeName, awayName: nextMatch.awayName,
      time: nextMatch.time, stadium: nextMatch.stadium, stadiumPreposition: nextMatch.stadiumPreposition,
      phase: nextMatch.phase, usedFactTypes, songMilestone, songGenerated,
    });

    if (twoVoiceMode) {
      // Zwei-Stimmen-Duo mit Übergabe: beide Zeilen (Ergebnis + Vorschau)
      // werden von speakSequence() gleichzeitig generiert, dann nahtlos
      // hintereinander abgespielt.
      const segments = [{ text: resultLine, voiceId: settings.voiceIdResult }];
      if (nextMatch) segments.push({ text: buildPreviewLine(), voiceId: settings.voiceIdPreview });
      await speakSequence(segments);
      return;
    }

    // Einzel-Stimmen-Modus (Browser kostenlos, oder ElevenLabs mit nur einer
    // konfigurierten Stimme): alle Zeilen ebenfalls vorab parallel generiert,
    // dann der Reihe nach abgespielt.
    const singleVoiceId = settings.provider === "elevenlabs" ? (settings.voiceIdResult || settings.voiceIdPreview) : null;
    const segments = [{ text: resultLine, voiceId: singleVoiceId }];
    if (nextMatch) segments.push({ text: buildPreviewLine(), voiceId: singleVoiceId });

    await speakSequence(segments);
  }

  // ======================================================================
  // TURNIERSTART-INTRO (Anforderungen 26-28) — beide Rollen stellen sich mit
  // den aktuell konfigurierten Namen vor, Teilnehmernamen kommen 1:1 aus dem
  // Aufrufer (index.html reicht state.players.map(p => p.name) durch).
  // ======================================================================
  async function _announceTournamentStartNow({ athleteNames } = {}) {
    const names = getSpeakerNames();
    const settings = getTtsSettings();
    const useElevenLabs = settings.provider === "elevenlabs" && !!settings.apiKey;
    const resultVoice = useElevenLabs ? settings.voiceIdResult : null;
    const previewVoice = useElevenLabs ? settings.voiceIdPreview : null;

    const segments = [
      { text: `${names.commentator} hier am Mikrofon. Willkommen zum Turnier!`, voiceId: resultVoice },
      { text: `${names.moderator} begleitet euch durch den Abend.`, voiceId: previewVoice },
    ];
    const athletes = (athleteNames || []).filter(Boolean).map(speechName);
    if (athletes.length) {
      segments.push({
        text: `Allen Athletinnen und Athleten, ${athletes.join(", ")}, viel Erfolg am Controller!`,
        voiceId: resultVoice,
      });
    }
    await speakSequence(segments);
  }

  function announceTournamentStart(args) {
    return _enqueue(() => _announceTournamentStartNow(args));
  }

  // ======================================================================
  // SONG-ANSAGE — kündigt einen frisch generierten Meilenstein-Song
  // (music.js) kurz per Stimme an, bevor der Song selbst abgespielt wird.
  // ======================================================================
  const SONG_ANNOUNCE_INTROS = {
    regularSeason: [
      "Bevor's weitergeht, noch was auf die Ohren — die Regular Season hat sich ihren eigenen Song verdient:",
      "Kurze Musikpause zum Ende der Gruppenphase, hier kommt der Track dazu:",
    ],
    firstElimination: [
      "Der erste Rauswurf dieser Saison bekommt jetzt seine eigene Hymne:",
      "Für den ersten Ausgeschiedenen gibt's zum Trost wenigstens einen Song:",
    ],
    toiletBowl: [
      "Die Toilet Bowl ist entschieden — für die unangenehmste Trophäe der Saison gibt's jetzt einen Disstrack:",
      "Der letzte Platz ist vergeben. Passend dazu, hier kommt der Song, der garantiert niemand haben wollte:",
    ],
    finals: [
      "Das Finale steht — und hat ab sofort einen eigenen Titelsong. Hier kommt er:",
      "Passend zum großen Showdown, hier ist die Musik dazu:",
    ],
    champion: [
      "Wir haben einen Champion — und die passende Hymne dazu:",
      "Zur Krönung gibt's jetzt den Song des Abends:",
    ],
  };

  async function _announceSongNow(milestone, url, { voiceId } = {}) {
    if (!url) return;
    const settings = getTtsSettings();
    const spokenVoiceId = settings.provider === "elevenlabs" ? (voiceId || settings.voiceIdResult || settings.voiceIdPreview) : null;
    const intro = pick(SONG_ANNOUNCE_INTROS[milestone] || ["Dazu gibt's jetzt extra einen Song, hört mal rein:"]);
    await speakSequence([{ text: intro, voiceId: spokenVoiceId }]);
    await playAudioUrl(url); // fertiges Audio (Supabase-URL) — kein TTS mehr nötig
  }

  // ======================================================================
  // TESTLAUF / TROCKENÜBUNG — erzeugt EINMAL den Text für so ziemlich jede
  // Ansage-Variante, mit frei erfundenen Spielern/Ergebnissen. Nutzt exakt
  // dieselben Bau-Funktionen wie der echte Betrieb (buildResultLine,
  // buildUpcomingLine, describeRecordForSpeech, ...) - es wird nichts
  // separat "nachgebaut". Spricht NICHTS laut aus, ruft KEINE TTS/Music-API
  // auf und rührt die echten `state`/`history`-Daten der Seite nicht an -
  // rein zum Gegenlesen/Testen, kostet nichts.
  // ======================================================================
  function fakeState(playerNames, overrides = {}) {
    const players = playerNames.map((name, i) => ({ id: i, name, team: `Team ${i + 1}`, wins: 0, diff: 0 }));
    return {
      players,
      matches: [{ p1: 0, p2: 1, s1: 10, s2: 20 }], // genügt für isGroupPhaseComplete()
      playoffMatches: [],
      config: { s1: "Altima Field", s2: "Energiequelle", s1Prep: "im", s2Prep: "in der" },
      songs: {},
      ...overrides,
    };
  }
  const FAKE_HISTORY_EMPTY = { loaded: false, matches: [], byPair: new Map(), byPlayer: new Map() };

  function buildDryRunTranscript() {
    const lines = [];
    const names = getSpeakerNames();
    const say = (role, text) => lines.push(`[${role === "commentator" ? names.commentator : names.moderator}] ${sanitizeForSpeech(text)}`);
    const heading = (n, title) => { lines.push(""); lines.push("=".repeat(70)); lines.push(`${n}. ${title}`); lines.push("=".repeat(70)); };
    const note = (text) => lines.push(`   (${text})`);

    lines.push("MADDEN BOWL ANNOUNCER — TESTLAUF MIT FIKTIVEN DATEN");
    lines.push(`Erzeugt am ${new Date().toLocaleString("de-DE")}`);
    lines.push(`Sprecher: Kommentator = ${names.commentator}, Moderator = ${names.moderator}`);
    lines.push("Hinweis: Zahlen stehen hier schon in der gesprochenen Form (z.B. Quoten als 'eins Komma ...').");
    lines.push("Records/Impacts hängen stark von den erfundenen Platzhalter-Daten ab und variieren bei jedem Lauf (u.a. durch Zufallsauswahl der Formulierungen).");

    // 1) Turnierstart -----------------------------------------------------
    heading(1, "TURNIERSTART");
    const athletes = ["Alex", "Tim", "Marco", "Jonas", "Kevin", "Nico"];
    say("commentator", `${names.commentator} hier am Mikrofon. Willkommen zum Turnier!`);
    say("moderator", `${names.moderator} begleitet euch durch den Abend.`);
    say("commentator", `Allen Athletinnen und Athleten, ${athletes.map(speechName).join(", ")}, viel Erfolg am Controller!`);

    // 2) Normales, enges Gruppenspiel --------------------------------------
    heading(2, "GRUPPENSPIEL — KNAPPES ERGEBNIS");
    {
      const state = fakeState(["Alex", "Tim"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 24, awayScore: 22, stadium: "Altima Field" });
      say("commentator", r.line);
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Marco", awayName: "Jonas", time: "19:30", stadium: "Energiequelle", stadiumPreposition: "in der", usedFactTypes: r.usedFactTypes }));
    }

    // 3) Blowout / Rekord ---------------------------------------------------
    heading(3, "GRUPPENSPIEL — KLARER BLOWOUT (löst i.d.R. einen Rekord aus)");
    note("Records vergleichen gegen die (hier leere) Historie - mit echten Turnierdaten seltener als hier.");
    {
      const state = fakeState(["Alex", "Tim"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 45, awayScore: 3, stadium: "Altima Field" });
      say("commentator", r.line);
    }

    // 4) Makellose Bilanz / Niederlagenserie ---------------------------------
    heading(4, "MAKELLOSE BILANZ / NIEDERLAGENSERIE");
    {
      const state = fakeState(["Alex", "Tim"]);
      state.matches = [
        { p1: 0, p2: 1, s1: 20, s2: 10 }, { p1: 0, p2: 1, s1: 21, s2: 14 }, { p1: 0, p2: 1, s1: 30, s2: 20 },
        { p1: 0, p2: 1, s1: 28, s2: 16 }, { p1: 0, p2: 1, s1: 24, s2: 12 }, // Alex 5x gewonnen
      ];
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 24, awayScore: 12, stadium: "Altima Field" });
      say("commentator", r.line);
      note("Analog: 3+ Niederlagen in Folge beim Verlierer -> 'kassiert die X. Niederlage in Folge.'");
    }

    // 5) Gruppenphase — Playoff-Chance verpasst -----------------------------
    heading(5, "GRUPPENPHASE ABGESCHLOSSEN — PLAYOFF-PLATZ VERPASST");
    {
      const names9 = ["Alex", "Tim", "Marco", "Jonas", "Kevin", "Nico", "Basti", "Renke", "Flo"];
      const state = fakeState(names9);
      const prevSeeds = new Map(names9.map((n, i) => [n, i + 1])); // Flo (Index 8) vorher Platz 8 (gerade noch drin)
      state.players[8].wins = 1; state.players[8].diff = -50; // Flo fällt jetzt auf Platz 9
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Flo", homeScore: 30, awayScore: 10, stadium: "Altima Field", prevSeeds });
      say("commentator", r.line);
    }

    // 6) Playoffs — Wildcard verloren (KEIN Ausscheiden, geht ins Lower Bracket)
    heading(6, "PLAYOFFS — WILDCARD VERLOREN (kein Turnier-Aus, nur Lower Bracket)");
    {
      const state = fakeState(["Alex", "Tim"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 20, awayScore: 17, stadium: "Altima Field", matchKind: "playoff", matchId: "ub1" });
      say("commentator", r.line);
    }

    // 7) Playoffs — Erstes Ausscheiden + Song -------------------------------
    heading(7, "PLAYOFFS — ERSTES AUSSCHEIDEN (mit generiertem Song)");
    {
      const state = fakeState(["Alex", "Tim"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 24, awayScore: 14, stadium: "Altima Field", matchKind: "playoff", matchId: "lb1", songMilestone: "firstElimination", songGenerated: true });
      say("commentator", r.line);
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Marco", awayName: "Jonas", time: "20:00", stadium: "Altima Field", stadiumPreposition: "im", usedFactTypes: r.usedFactTypes, songMilestone: "firstElimination", songGenerated: true }));
      note(`[Song-Intro] ${pick(SONG_ANNOUNCE_INTROS.firstElimination)} [Song wird hier abgespielt]`);
    }

    // 8) Toilet Bowl (Vorschau-Framing, KEIN Song) --------------------------
    heading(8, "VORSCHAU AUFS TOILET-BOWL-SPIEL (kein Song dafür)");
    {
      const state = fakeState(["Basti", "Nico"]);
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Basti", awayName: "Nico", time: "21:00", stadium: "Energiequelle", stadiumPreposition: "in der", phase: "Toilet Bowl", usedFactTypes: new Set() }));
    }

    // 9) Finals stehen fest + Song-Teaser -----------------------------------
    heading(9, "FINALE STEHT FEST (mit generiertem Song)");
    {
      const state = fakeState(["Alex", "Marco"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Jonas", awayName: "Marco", homeScore: 17, awayScore: 27, stadium: "Altima Field", matchKind: "playoff", matchId: "uf" });
      say("commentator", r.line);
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Marco", time: "20:00", stadium: "Altima Field", stadiumPreposition: "im", phase: "Madden Bowl", usedFactTypes: r.usedFactTypes, songMilestone: "finals", songGenerated: true }));
      note(`[Song-Intro] ${pick(SONG_ANNOUNCE_INTROS.finals)} [Song wird hier abgespielt]`);
    }

    // 10) Turniersieger steht fest + Song -----------------------------------
    heading(10, "TURNIERSIEGER STEHT FEST (mit generiertem Song)");
    {
      const state = fakeState(["Alex", "Marco"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Marco", homeScore: 31, awayScore: 24, stadium: "Altima Field", matchKind: "playoff", matchId: "gf", songMilestone: "champion", songGenerated: true });
      say("commentator", r.line);
      note(`[Song-Intro] ${pick(SONG_ANNOUNCE_INTROS.champion)} [Song wird hier abgespielt]`);
    }

    // 11) Regular Season beendet + Song-Teaser ------------------------------
    heading(11, "REGULAR SEASON BEENDET (mit generiertem Song)");
    {
      const state = fakeState(["Alex", "Tim"]);
      const r = buildResultLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Tim", homeScore: 20, awayScore: 18, stadium: "Altima Field" });
      say("commentator", r.line);
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Marco", awayName: "Jonas", time: "18:00", stadium: "Altima Field", stadiumPreposition: "im", usedFactTypes: r.usedFactTypes, songMilestone: "regularSeason", songGenerated: true }));
      note(`[Song-Intro] ${pick(SONG_ANNOUNCE_INTROS.regularSeason)} [Song wird hier abgespielt]`);
    }

    // 12) Rivalität / Revanche / Rundenzahl-Meilenstein ---------------------
    heading(12, "VORSCHAU-FAKTEN: RIVALITÄT, REVANCHE, RUNDENZAHL");
    {
      const state = fakeState(["Alex", "Tim"]);
      const pk = MB.pairKey("Alex", "Tim");
      const history = { loaded: true, matches: new Array(49).fill(0).map(() => ({ homePlayer: "Alex", awayPlayer: "Tim", homeScore: 20, awayScore: 14, total: 34, stage: "group" })), byPair: new Map([[pk, [
        { homePlayer: "Tim", awayPlayer: "Alex", homeScore: 10, awayScore: 24, total: 34, stage: "group" },
        { homePlayer: "Alex", awayPlayer: "Tim", homeScore: 20, awayScore: 14, total: 34, stage: "group" },
        { homePlayer: "Tim", awayPlayer: "Alex", homeScore: 21, awayScore: 17, total: 38, stage: "group" },
      ]]]), byPlayer: new Map() };
      note("Rivalität ab 3 gemeinsamen Spielen; Rundenzahl-Meilenstein alle 50 Spiele insgesamt (hier künstlich auf 49 vorbelegt, das Duell selbst ist Spiel 50).");
      say("moderator", buildUpcomingLine({ state, history, homeName: "Alex", awayName: "Tim", time: "19:00", stadium: "Altima Field", stadiumPreposition: "im", usedFactTypes: new Set() }));
    }

    return lines.join("\n");
  }


  // Wird z.B. in index.html aus finishScoreUpdate() OHNE await aufgerufen.
  // Wenn kurz hintereinander zwei Spiele fertig werden, laufen dadurch zwei
  // announce()-Aufrufe parallel. Für die kostenlose Browser-Stimme wäre das
  // egal (speechSynthesis hat eine eigene interne Warteschlange), aber im
  // ElevenLabs-Modus spielt jeder Aufruf sein eigenes <audio>-Element ab —
  // ohne Koordination würden sich zwei Ansagen akustisch überlappen.
  // Diese Promise-Chain serialisiert alle announce()-Aufrufe (unabhängig
  // vom TTS-Provider) strikt nacheinander. Ein Fehler in einer Ansage
  // (z.B. ElevenLabs-HTTP-Fehler) darf die Kette dabei nicht dauerhaft
  // blockieren, deshalb wird der Fehler hier abgefangen statt durchgereicht.
  // announceSong() hängt sich in dieselbe Kette ein wie announce(), damit
  // sich Song-Ansage und eine laufende Spielansage nie überlappen.
  let _announceQueue = Promise.resolve();

  function _enqueue(fn) {
    const run = () => fn().catch((e) => console.warn("Ansage fehlgeschlagen:", e));
    _announceQueue = _announceQueue.then(run, run);
    return _announceQueue;
  }

  function announce(args) {
    return _enqueue(() => _announceNow(args));
  }

  function announceSong(milestone, url, opts) {
    return _enqueue(() => _announceSongNow(milestone, url, opts));
  }

  global.MB = global.MB || {};
  global.MB.Announcer = {
    announce, announceSong, announceTournamentStart, speak, warmupVoices, buildResultLine, buildUpcomingLine,
    setPreferredVoice, getGermanVoiceCandidates, sanitizeForSpeech,
    getTtsSettings, setTtsSettings, fetchElevenLabsVoices, speakElevenLabs, speakSmart,
    speakSequence, fetchElevenLabsAudioUrl, playAudioUrl, speechName, speechNames,
    getSpeakerNames, setSpeakerNames, classifyFact, naturalizeFact, stadiumPhrase, pickUpcomingFact,
    buildDryRunTranscript,
  };
})(window);
