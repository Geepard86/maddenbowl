/* =========================================================================
   ALTIMA BOWL — ANNOUNCER (announcer.js)
   -------------------------------------------------------------------------
   Erzeugt aus Quoten, Namen, Flavour-Facts eine launige Gameshow-Ansage für
   ein gerade beendetes Spiel + die kommende Partie, und liest sie per
   Web Speech API (SpeechSynthesisUtterance) direkt vor — es wird NICHTS
   als Text angezeigt, nur gesprochen.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   Nutzung (in admin.html, im setScore-Handler):
     MB.Announcer.announce({ state, history, finishedMatchId, homeName,
                              awayName, homeScore, awayScore, homeTeam, awayTeam });
   ========================================================================= */

(function (global) {
  "use strict";

  // ======================================================================
  // ABWECHSLUNG: kleine Gedächtnis-Logik gegen Wiederholungen
  // ----------------------------------------------------------------------
  // pickVaried() merkt sich pro Baustein-Gruppe (key), was zuletzt verwendet
  // wurde, und zieht bevorzugt etwas anderes. Die Auswahl bleibt zufällig,
  // aber dasselbe Intro/derselbe Übergang kommt nicht zweimal direkt
  // hintereinander. Funktionen im Pool werden mit `args` aufgerufen und
  // müssen einen String liefern.
  // ======================================================================
  const _recent = {};
  function resetVariety() { Object.keys(_recent).forEach((k) => delete _recent[k]); }

  function pickVaried(key, pool, memory, args) {
    const items = (pool || []).map((x) => (typeof x === "function" ? x(args) : x)).filter((x) => x != null);
    if (!items.length) return "";
    const mem = Math.max(0, Math.min(memory == null ? 2 : memory, items.length - 1));
    const hist = _recent[key] || (_recent[key] = []);
    let fresh = items.filter((x) => !hist.includes(x));
    if (!fresh.length) fresh = items;
    const chosen = fresh[Math.floor(Math.random() * fresh.length)];
    hist.push(chosen);
    while (hist.length > Math.max(mem, 1)) hist.shift();
    return chosen;
  }

  // Zuletzt verwendete Informationskategorien (Ergebnis- UND Vorschau-Ansagen
  // teilen sich diese Liste). Ältere Einträge zählen weniger.
  const _recentFactTypes = [];
  function factRecencyPenalty(type) {
    const i = _recentFactTypes.lastIndexOf(type);
    if (i < 0) return 0;
    const age = _recentFactTypes.length - 1 - i; // 0 = zuletzt benutzt
    return age === 0 ? 7 : age === 1 ? 4 : age === 2 ? 2 : 0;
  }
  function rememberFactType(type) {
    if (!type) return;
    _recentFactTypes.push(type);
    while (_recentFactTypes.length > 4) _recentFactTypes.shift();
  }
  // Grundgewicht je Kategorie: Siegesserien/Form sind fast immer verfügbar und
  // würden sonst ständig gewinnen. Seltene Besonderheiten bleiben vorn.
  const FACT_TYPE_BIAS = { form: -3, odds: 0, averagePoints: 0, directComparison: 0, rivalry: 2, revenge: 1, milestone: 3, playoffFact: 1, other: 1 };

  // ======================================================================
  // ERGEBNIS-TEXTE (Kommentator)
  // ======================================================================
  const RESULT_INTROS = {
    general: [
      "Das Spiel ist vorbei!",
      "Abpfiff – die Partie ist entschieden!",
      "Das war's!",
      "Schluss, die Punkte sind vergeben!",
      "Aus und vorbei!",
      "Die Uhr steht bei null.",
      "Schlusspfiff!",
      "Das Spiel ist gelaufen!",
      "Und das war's – das Ergebnis steht!",
      "Ende im Gelände!",
      "Der Controller ruht, das Ergebnis steht!",
    ],
    // Nur verwendet, wenn ein Stadion bekannt ist ({s} = z.B. \"im Altima Field\").
    stadium: [
      (s) => `Das war's ${s}!`,
      (s) => `Abpfiff ${s}!`,
      (s) => `Feierabend ${s}!`,
      (s) => `Schlusspfiff ${s}!`,
    ],
    close: [
      "Was für ein Finish! Die Partie ist entschieden!",
      "Bis zum Schluss war hier alles offen!",
      "Ein enges Duell findet seinen Sieger!",
      "Das war Spannung bis zur letzten Sekunde!",
    ],
    clear: [
      "Das ist am Ende eine klare Sache!",
      "Am Ende wird es deutlich!",
      "Hier lässt der Sieger nichts mehr anbrennen!",
      "Eine Machtdemonstration!",
      "Das war keine Frage des Sieges, nur der Höhe!",
    ],
  };
  function pickResultIntro(margin, stadium, preposition, recordIsMargin) {
    let pool = RESULT_INTROS.general.slice();
    if (stadium) RESULT_INTROS.stadium.forEach((fn) => pool.push(fn(stadiumPhrase(stadium, preposition))));
    // Bei Rekord-Klatschen sagt der Rekord-Satz die Deutlichkeit schon selbst.
    const cat = margin <= 4 ? RESULT_INTROS.close : (margin >= 14 && !recordIsMargin) ? RESULT_INTROS.clear : null;
    if (cat && Math.random() < 0.7) pool = cat;
    return pickVaried("resultIntro", pool, 3);
  }

  const WIN_PHRASES = [
    "{winner} setzt sich mit {winnerScore} zu {loserScore} gegen {loser} durch.",
    "{winner} gewinnt mit {winnerScore} zu {loserScore} gegen {loser}.",
    "{winner} schlägt {loser} mit {winnerScore} zu {loserScore}.",
    "Am Ende steht es {winnerScore} zu {loserScore} für {winner} gegen {loser}.",
    "{winner} macht die Partie mit {winnerScore} zu {loserScore} gegen {loser} klar.",
  ];
  // nur bei knappen Spielen (≤ 7 Punkte)
  const CLOSE_WIN_PHRASES = [
    "{winner} behält mit {winnerScore} zu {loserScore} gegen {loser} die Oberhand.",
    "{winner} rettet den {winnerScore}-zu-{loserScore}-Sieg gegen {loser} über die Zeit.",
    "Hauchdünn: {winner} gewinnt {winnerScore} zu {loserScore} gegen {loser}.",
  ];
  // nur bei Kantersiegen (≥ 21 Punkte)
  const BLOWOUT_WIN_PHRASES = [
    "{winner} fegt {loser} mit {winnerScore} zu {loserScore} vom Feld.",
    "{winner} überrollt {loser} mit {winnerScore} zu {loserScore}.",
    "{winner} lässt {loser} beim {winnerScore} zu {loserScore} nicht den Hauch einer Chance.",
  ];
  // Bewusst aus der Verlierer-Perspektive formuliert - sorgt zusammen mit
  // WIN_PHRASES für mehr Abwechslung, statt immer nur den Sieger zu betonen.
  const LOSE_PHRASES = [
    "{loser} muss sich {winner} mit {loserScore} zu {winnerScore} geschlagen geben.",
    "Für {loser} reicht es nicht – {winner} gewinnt mit {winnerScore} zu {loserScore}.",
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
    "Das war ein echter Blowout.",
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
    (n) => `${n.moderator}, wie geht es weiter?`,
  ];
  // Der Moderator übernimmt meist direkt, bedankt sich nur gelegentlich und
  // dann nicht immer mit demselben Satz.
  const HANDOFF_IN_THANKS = [
    (n) => `Danke, ${n.commentator}.`,
    (n) => `Danke dir, ${n.commentator}.`,
    (n) => `Alles klar, ${n.commentator}.`,
    (n) => `Besten Dank, ${n.commentator}.`,
    (n) => `Okay, ${n.commentator}.`,
  ];

  // ======================================================================
  // SPRECHER-KONFIGURATION (Anforderung 1) — Kommentator/Moderator sind
  // Rollen, keine festen Namen. Admin kann beide Namen frei konfigurieren;
  // Rudi/Mona sind nur Default-Werte. Wird lokal gespeichert, damit die
  // Namen einen Reload überleben.
  // ======================================================================
  const DEFAULT_SPEAKER_NAMES = { commentator: "Rudi", moderator: "Mona", announcer: "Enzo" };
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
      announcer: stored.announcer || DEFAULT_SPEAKER_NAMES.announcer,
    };
    return _speakerNamesCache;
  }

  function setSpeakerNames({ commentator, moderator, announcer } = {}) {
    const next = {
      commentator: (commentator || "").trim() || DEFAULT_SPEAKER_NAMES.commentator,
      moderator: (moderator || "").trim() || DEFAULT_SPEAKER_NAMES.moderator,
      announcer: (announcer || "").trim() || DEFAULT_SPEAKER_NAMES.announcer,
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

  // ======================================================================
  // RING-ANSAGER (Draft-Vorstellung + Finale) — dreiteiliger Aufbau:
  // Einleitung (wechselnd) + Ankündigung (Badge-Baustein) + Name allein.
  // Auswahl der Ankündigung kommt aus MB.computeRingIntroBadges() (shared.js),
  // Priorität: Champion > Serien-Champion > Rekordhalter > Contender >
  // Toilet-Bowl-Sieger > Rookie > Routinier (Fallback).
  // ----------------------------------------------------------------------
  // SPITZNAMEN (nur für den Ring-Ansager): steht ein Spitzname im Turnier-Setup
  // (state.config.nicknames, gepflegt unter Seasons), spricht Enzo ihn VOR dem Namen.
  // ----------------------------------------------------------------------
  let _nicknames = {};
  function setNicknames(map) { _nicknames = (map && typeof map === "object") ? { ...map } : {}; }
  function getNickname(name) {
    const key = String(name || "").trim().toLowerCase();
    const k = Object.keys(_nicknames).find((x) => x.trim().toLowerCase() === key);
    return k ? String(_nicknames[k] || "").trim() : "";
  }
  function ringName(name) {
    const nick = getNickname(name);
    return nick ? `${nick} ${speechName(name)}` : speechName(name);
  }

  // ======================================================================
  // Einleitungen sind kasus-neutral, die Ankündigungen stehen alle im Nominativ
  // (vorher passte z.B. "Jetzt darf er picken: Den Mann mit…" grammatisch nicht).
  const RING_INTRO_PREFIXES = [
    "Und hier kommt er:",
    "Als Nächstes im Draft:",
    "Jetzt am Zug:",
    "Und nun:",
    "Bühne frei:",
    "Der nächste Head Coach:",
  ];
  const RING_INTRO_FIRST_PICK_PREFIX = "Mit dem ersten Pick des Abends:";
  const RING_INTRO_LAST_PICK_PREFIX = "Und mit dem letzten Pick des Abends:";

  // "zweifache Champion" (Nominativ nach bestimmtem Artikel)
  const RING_FOLD_WORDS_DE = ["", "einfache", "zweifache", "dreifache", "vierfache", "fünffache", "sechsfache"];
  function foldWordDE(n) { return RING_FOLD_WORDS_DE[n] || `${n}-fache`; }

  const RING_ANNOUNCEMENTS = {
    champion: ["Der amtierende Champion:", "Der Titelverteidiger:", "Der Mann, den alle jagen – der amtierende Champion:"],
    championRings: [(rings) => `Der aktuelle Titelträger und ${foldWordDE(rings)} Champion:`],
    seriesChampion: [(rings) => `Der einzige Head Coach mit ${numberWordsDE(rings)} Ringen:`, (rings) => `Der Rekordchampion mit ${numberWordsDE(rings)} Ringen:`],
    recordHolder: ["Der Mann mit dem Allzeit-Highscore:", "Der Rekordhalter für die meisten Punkte in einem Spiel:"],
    contender: ["Der Vize-Champion der letzten Saison:", "Der ewige Herausforderer, immer ganz nah dran am Ring:"],
    toiletBowl: ["Der Sieger des letztjährigen Toilet Bowls:", "Der Toilet-Bowl-Champion des Vorjahres:"],
    rookie: ["Der Rookie:", "Neu im Ring – zum ersten Mal dabei:", "Frisch im Altima Bowl, der Rookie:"],
    veteran: ["Am Start:", "Bereit für eine neue Saison:", "Zurück im Ring:", "Wieder mit dabei:"],
  };

  function ringAnnouncementFor(badge) {
    if (badge.isDefendingChampion) {
      return badge.titles > 1 ? pick(RING_ANNOUNCEMENTS.championRings)(badge.titles) : pick(RING_ANNOUNCEMENTS.champion);
    }
    if (badge.isSoleRecordChampion) return pick(RING_ANNOUNCEMENTS.seriesChampion)(badge.titles);
    if (badge.isAllTimeHighScoreHolder) return pickVaried("ring_recordHolder", RING_ANNOUNCEMENTS.recordHolder, 2);
    if (badge.isRunnerUpLastSeason || badge.finalsWithoutTitleCount >= 2) return pickVaried("ring_contender", RING_ANNOUNCEMENTS.contender, 2);
    if (badge.isToiletBowlLastSeason) return pickVaried("ring_toiletBowl", RING_ANNOUNCEMENTS.toiletBowl, 2);
    if (badge.isRookie) return pickVaried("ring_rookie", RING_ANNOUNCEMENTS.rookie, 2);
    return pickVaried("ring_veteran", RING_ANNOUNCEMENTS.veteran, 2);
  }

  // badge = ein Eintrag aus MB.computeRingIntroBadges(...).get(name.toLowerCase())
  // isFirstPick/isLastPick steuern nur die Einleitung, nicht die Ankündigung
  // (ein Rookie mit dem letzten Pick bleibt "Der Rookie:", bekommt aber die
  // "Der letzte Pick gebührt ihm:"-Einleitung statt einer zufälligen).
  // modelId (optional): bei Eleven v3 bekommt der Ring-Ansager zusätzlich
  // Emotions-/Delivery-Tags für mehr Boxring-Spannung (v3-exklusiv, siehe
  // formatPacingForModel für die modellabhängige Pausen-Behandlung).
  function buildRingIntroLine(badge, { isFirstPick, isLastPick, modelId } = {}) {
    if (!badge) return "";
    const n = ringName(badge.name);
    const prefix = isFirstPick ? RING_INTRO_FIRST_PICK_PREFIX : (isLastPick ? RING_INTRO_LAST_PICK_PREFIX : pickVaried("ringPrefix", RING_INTRO_PREFIXES, 3));
    const announcement = ringAnnouncementFor(badge);
    if (isV3Model(modelId)) {
      // Box-Ansager: Einleitung getragen, Ankündigung steigernd, dann der Name
      // lang gezogen ("Maaaarkuuuuus!") — mehrere Varianten, damit nicht jeder gleich klingt.
      const shout = stretchName(n);
      const big = isFirstPick || isLastPick || badge.isDefendingChampion || badge.isSoleRecordChampion;
      const V3 = [
        () => `[booming voice][slow] ${prefix}\n[building intensity] ${announcement}\n[long pause][shouting at full volume] ${shout}!`,
        () => `[deep, theatrical voice] ${prefix}\n[dramatic pause][rising] ${announcement}\n[pause][roaring, stretching every syllable] ${shout}!`,
        () => `[announcer voice][slows down] ${prefix}\n[intense whisper] ${announcement}\n[sudden explosion of energy][shouting] ${shout}!`,
      ];
      if (big) V3.push(() => `[booming voice] Meine Damen und Herren!\n[slow, theatrical] ${prefix}\n[building to a climax] ${announcement}\n[long pause][roaring at full volume, holding the name] ${shout}!`);
      return pick(V3)();
    }
    return `${prefix}\n${announcement}\n${n}!`;
  }

  // Name wie ein Box-Ansager ziehen: Vokal der ersten Silbe etwas, letzter Vokal stark
  // gedehnt ("Markus" -> "Maarkuuuuus", "Tim" -> "Tiiiiim"). Spitzname bleibt normal,
  // nur der eigentliche Name (letztes Wort) wird gedehnt.
  function stretchName(full) {
    const parts = String(full || "").trim().split(/\s+/);
    const last = parts.pop() || "";
    const vowels = [...last.matchAll(/[aeiouäöüyAEIOUÄÖÜ]+/g)];
    let out = last;
    if (vowels.length === 1) {
      const v = vowels[0]; out = last.slice(0, v.index) + v[0] + v[0].slice(-1).toLowerCase().repeat(5) + last.slice(v.index + v[0].length);
    } else if (vowels.length >= 2) {
      const a = vowels[0], z = vowels[vowels.length - 1];
      out = last.slice(0, a.index) + a[0] + a[0].slice(-1).toLowerCase().repeat(2) + last.slice(a.index + a[0].length, z.index) + z[0] + z[0].slice(-1).toLowerCase().repeat(5) + last.slice(z.index + z[0].length);
    }
    return [...parts, out].join(" ");
  }

  // Eleven v3: Zeilen OHNE eigene Tags bekommen dezente Emotions-Tags passend zum Inhalt
  // (Ausrufe -> [excited], Fragen -> [curious], Toilet Bowl -> [chuckles], Rekorde -> [impressed]).
  function v3Decorate(text) {
    const t = String(text || "");
    if (!t || /\[[a-z][^\]]*\]/i.test(t)) return t;
    let used = 0;
    return t.replace(/[^.!?\n]+[.!?]*/g, (sent) => {
      if (used >= 2 || !sent.trim()) return sent;
      let tag = "";
      if (/toilet|klo|schüssel/i.test(sent)) tag = "[chuckles]";
      else if (/rekord|highscore|allzeit/i.test(sent)) tag = "[impressed]";
      else if (/!\s*$/.test(sent)) tag = "[excited]";
      else if (/\?\s*$/.test(sent)) tag = "[curious]";
      if (!tag) return sent;
      used++;
      return sent.replace(/^(\s*)/, `$1${tag} `);
    });
  }

  // Ring-Ansage VORAB generieren und die exakte Audiodauer ermitteln — damit
  // die Draft-Bühne den Einlauf des Spielers auf die Ansage abstimmen kann.
  // Liefert null, wenn ElevenLabs nicht aktiv ist bzw. die Generierung scheitert.
  // Rückgabe: { duration (s), text, play() -> Promise (spielt + Sprech-Events) }
  async function prepareRingIntro(name, badge, isFirstPick, isLastPick) {
    const settings = getTtsSettings();
    const voiceId = settings.provider === "elevenlabs" ? (settings.voiceIdAnnouncer || settings.voiceIdResult) : null;
    if (!settings.apiKey || !voiceId) return null;
    const line = buildRingIntroLine(badge, { isFirstPick, isLastPick, modelId: settings.modelId });
    if (!line) return null;
    let url;
    try { url = await fetchElevenLabsAudioUrl(line, { apiKey: settings.apiKey, voiceId, modelId: settings.modelId }); }
    catch (e) { console.warn("Ring-Ansage konnte nicht vorab generiert werden:", e); return null; }
    const duration = await new Promise((resolve) => {
      const a = new Audio(); let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      a.preload = "metadata";
      a.onloadedmetadata = () => {
        if (isFinite(a.duration) && a.duration > 0) fin(a.duration);
        else { a.currentTime = 1e7; a.ontimeupdate = () => { a.ontimeupdate = null; fin(isFinite(a.duration) ? a.duration : 0); }; }
      };
      a.onerror = () => fin(0);
      setTimeout(() => fin(0), 4000);
      a.src = url;
    });
    return {
      duration, text: line,
      play: async () => {
        _emitSpeak({ type: "start", role: "announcer", text: ringDisplay(line, badge) });
        await playAudioUrl(url);
        _emitSpeak({ type: "end", role: "announcer" });
      },
    };
  }

  async function announceRingIntro(name, badge, isFirstPick, isLastPick) {
    const settings = getTtsSettings();
    const line = buildRingIntroLine(badge, { isFirstPick, isLastPick, modelId: settings.modelId });
    if (!line) return;
    const voiceId = settings.provider === "elevenlabs" ? (settings.voiceIdAnnouncer || settings.voiceIdResult) : null;
    await speakSequence([{ text: line, voiceId, role: "announcer", display: ringDisplay(line, badge) }]);
  }

  // Untertitel: gedehnten Namen ("Tiiiiim") wieder normal anzeigen — gesprochen wird gedehnt.
  function ringDisplay(line, badge) {
    if (!badge) return line;
    const n = ringName(badge.name);
    const stretched = stretchName(n);
    return stretched !== n ? String(line).split(stretched).join(n) : line;
  }

  // ======================================================================
  // TEAM-PICK-KOMMENTAR (Draft) — Kommentator/Moderator im Wechsel, nachdem
  // ein Spieler sein Team gewählt hat. Bausteine: Team-Titelhistorie +
  // (falls Gruppengegner schon feststehen) eine Einschätzung des Spielplans.
  // ======================================================================
  // Kurze Reaktion auf die Team-Wahl. Bewusst viele Varianten (und manchmal
  // gar keine), damit nicht jede Wahl mit derselben Floskel kommentiert wird.
  const TEAM_PICK_REACTIONS = [
    "Gute Wahl.", "Interessante Wahl.", "Na, das kann was werden.", "Mutige Entscheidung.",
    "Damit lässt sich arbeiten.", "Das passt.", "Solide Entscheidung.", "Da bin ich gespannt.",
    "Starke Ansage.",
  ];

  // Volle Teamnamen (Städtename + Team) - die App speichert nur das Kürzel
  // (HOU) bzw. den Teamnamen (Texans). Gesprochen wird immer der volle Name.
  const TEAM_FULL_NAMES = {
    ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens", BUF: "Buffalo Bills",
    CAR: "Carolina Panthers", CHI: "Chicago Bears", CIN: "Cincinnati Bengals", CLE: "Cleveland Browns",
    DAL: "Dallas Cowboys", DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
    HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars", KC: "Kansas City Chiefs",
    LV: "Las Vegas Raiders", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams", MIA: "Miami Dolphins",
    MIN: "Minnesota Vikings", NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
    NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers", SF: "San Francisco 49ers",
    SEA: "Seattle Seahawks", TB: "Tampa Bay Buccaneers", TEN: "Tennessee Titans", WAS: "Washington Commanders",
  };
  function teamFullName(teamNameOrId) {
    const raw = String(teamNameOrId || "").trim();
    if (!raw) return "";
    const byId = TEAM_FULL_NAMES[raw.toUpperCase()];
    if (byId) return byId;
    const lower = raw.toLowerCase();
    const full = Object.values(TEAM_FULL_NAMES).find((n) => n.toLowerCase() === lower || n.toLowerCase().endsWith(" " + lower));
    return full || raw;
  }

  function timesWordDE(count) { return count === 1 ? "einmal" : `${numberWordsDE(count)}mal`; }

  // team = voller Teamname (immer Plural: die Houston Texans)
  const TEAM_TITLE_LINES = {
    none: [
      (t) => `Die ${t} warten noch auf den ersten Titel in dieser Liga.`,
      (t) => `Mit den ${t} hat noch niemand den Ring geholt — vielleicht ändert sich das ja jetzt.`,
      (t) => `Für die ${t} wäre es der erste Ring in der Geschichte dieser Liga.`,
      (t) => `Die ${t} sind im Altima Bowl noch ein unbeschriebenes Blatt, was Titel angeht.`,
      (t) => `Einen Ring haben die ${t} hier noch nie gesehen.`,
      (t) => `Bei den ${t} ist die Trophäenvitrine noch leer.`,
      (t) => `Die ${t} hätten nichts gegen ihren ersten Titel in dieser Liga.`,
    ],
    // Der Titel wurde mit einem anderen Head Coach geholt.
    withOtherCoach: [
      (t, count, lastWinner, n) => `Die ${t} haben schon ${timesWordDE(count)} den Ring geholt${lastWinner ? ", zuletzt mit " + lastWinner : ""}. Mal schauen, ob ${n} sie auch zum Erfolg führen kann.`,
      (t, count, lastWinner, n) => `Titel-Tradition bei den ${t}: ${timesWordDE(count)} Champion${lastWinner ? ", zuletzt unter " + lastWinner : ""}. Jetzt versucht es ${n}.`,
    ],
    // Derselbe Spieler hat mit diesem Team schon gewonnen.
    sameCoach: [
      (t, count, n) => `Mit den ${t} hat ${n} schon ${timesWordDE(count)} den Ring geholt. Da geht bestimmt noch was.`,
      (t, count, n) => `${n} kennt den Weg zum Titel mit den ${t} bereits — ${timesWordDE(count)} hat es schon geklappt.`,
    ],
  };

  // Gegner-Beschreibungen für die Spielplan-Einschätzung. `kase`: "nom" für
  // Aufzählungen nach einem Doppelpunkt ("...: Micha, der amtierende Champion
  // Markus und Neuling Chris"), "akk" nach \"gegen\" ("gegen den amtierenden
  // Champion Markus").
  function describeOpponentForSchedule(o, kase) {
    const n = speechName(o.name);
    const akk = kase === "akk";
    if (o.badge?.isDefendingChampion) return `${akk ? "den" : "der"} amtierende${akk ? "n" : ""} Champion ${n}`;
    if (o.badge?.isRookie) return `Neuling ${n}`;
    if (o.badge?.isToiletBowlLastSeason) return `${akk ? "den" : "der"} Vorjahres-Letzte${akk ? "n" : ""} ${n}`;
    return n;
  }
  function joinDE(items) {
    return items.length > 1 ? items.slice(0, -1).join(", ") + " und " + items[items.length - 1] : (items[0] || "");
  }

  const SCHEDULE_HARD_LINES = [
    (n) => `Und der Spielplan hat's gleich in sich: ${n}.`,
    (n) => `Harter Auftakt: ${n}.`,
    (n) => `Da wartet ein dickes Brett in der Gruppenphase: ${n}.`,
  ];
  const SCHEDULE_EASY_LINES = [
    (n) => `Die Gruppenphase sieht machbar aus: ${n}.`,
    (n) => `Der Spielplan lässt sich erstmal ganz entspannt an: ${n}.`,
    (n) => `Das klingt nach einer angenehmen Gruppenphase: ${n}.`,
  ];
  const SCHEDULE_NEUTRAL_LINES = [
    (n) => `In der Gruppenphase geht's unter anderem gegen ${n}.`,
    (n) => `Zum Auftakt warten schon ${n} auf ihn.`,
    (n) => `Gegen ${n} muss er sich in der Gruppenphase beweisen.`,
  ];

  // opponentBadges: Array von { name, badge } für die schon feststehenden
  // Gruppengegner dieses Slots (badge = Eintrag aus computeRingIntroBadges).
  // Der Spielplan wird erst kommentiert, wenn mindestens zwei Gegner
  // feststehen, und auch dann nur gelegentlich.
  function buildScheduleFact(opponentBadges) {
    if (!opponentBadges || opponentBadges.length < 2) return "";
    if (Math.random() > 0.55) return "";
    const toughCount = opponentBadges.filter((o) => o.badge?.isDefendingChampion || o.badge?.isSoleRecordChampion || o.badge?.titles > 0).length;
    const easyCount = opponentBadges.filter((o) => o.badge?.isRookie).length;
    const nom = joinDE(opponentBadges.map((o) => describeOpponentForSchedule(o, "nom")));
    if (toughCount >= 2) return pickVaried("schedHard", SCHEDULE_HARD_LINES, 2, nom);
    if (easyCount >= 2) return pickVaried("schedEasy", SCHEDULE_EASY_LINES, 2, nom);
    // Neutral: Einzelne Gegner herausgreifen (max. 3), im Akkusativ
    const akk = joinDE(opponentBadges.slice(0, 3).map((o) => describeOpponentForSchedule(o, "akk")));
    return pickVaried("schedNeutral", SCHEDULE_NEUTRAL_LINES, 2, akk);
  }

  // teamTitleInfo: Eintrag aus MB.computeTeamTitleHistory(history).get(teamId) oder undefined
  // Lieblingsteam (aus dem Spielerprofil, avatar.js): Kommentar zur Wahl.
  // fav: { id, name } des Lieblingsteams; pickedId; available: [{ id, name, rating }] VOR dem Pick
  const DIVS = { "AFC East": ["BUF", "MIA", "NE", "NYJ"], "AFC North": ["BAL", "CIN", "CLE", "PIT"], "AFC South": ["HOU", "IND", "JAX", "TEN"], "AFC West": ["DEN", "KC", "LV", "LAC"],
    "NFC East": ["DAL", "NYG", "PHI", "WAS"], "NFC North": ["CHI", "DET", "GB", "MIN"], "NFC South": ["ATL", "CAR", "NO", "TB"], "NFC West": ["ARI", "LAR", "SF", "SEA"] };
  const divOfTeam = (id) => Object.keys(DIVS).find((d) => DIVS[d].includes(id)) || "";
  function favoriteTeamLine(n, fav, pickedId, available) {
    if (!fav || !fav.id || !pickedId) return "";
    const av = available || [];
    const rate = new Map(av.map((t) => [t.id, Number(t.rating) || 0]));
    const picked = rate.get(pickedId) || 0;
    const favTeam = teamFullName(fav.name);
    if (pickedId === fav.id) {
      const better = av.filter((t) => t.id !== pickedId && (Number(t.rating) || 0) >= picked + 2).sort((a, b) => b.rating - a.rating)[0];
      if (better) return pickVaried("favLoveBetter", [
        `Herz schlägt Verstand: Die ${favTeam} sind sein Lieblingsteam – dabei wären die ${teamFullName(better.name)} deutlich stärker gewesen.`,
        `Eine Entscheidung aus Liebe: ${n} nimmt sein Lieblingsteam, obwohl stärkere Teams noch zu haben waren.`,
      ], 1);
      return pickVaried("favLove", [`Und es ist sein Lieblingsteam – da gab es wohl nicht viel zu überlegen.`, `Treue zahlt sich aus: ${n} holt sich sein Lieblingsteam.`], 1);
    }
    if (divOfTeam(pickedId) && divOfTeam(pickedId) === divOfTeam(fav.id)) {
      return pickVaried("favTraitor", [
        `Pikant: Ausgerechnet ein Divisionsrivale seiner geliebten ${favTeam}!`,
        `Das dürfte in der Fankurve der ${favTeam} gar nicht gut ankommen – ${n} wechselt zum Divisionsrivalen.`,
      ], 1);
    }
    const conf = divOfTeam(fav.id).split(" ")[0];
    if (conf && !divOfTeam(pickedId).startsWith(conf)) {
      const skipped = av.filter((t) => t.id !== fav.id && divOfTeam(t.id).startsWith(conf) && (Number(t.rating) || 0) >= picked + 2).sort((a, b) => b.rating - a.rating)[0];
      if (skipped) return `Auffällig: Die ${teamFullName(skipped.name)} wären stärker gewesen – aber als Fan der ${favTeam} nimmt man so ein Team offenbar nicht.`;
    }
    if (!rate.has(fav.id)) return pickVaried("favGone", [`Sein Lieblingsteam, die ${favTeam}, war da leider schon weg.`, `Die ${favTeam} wären ihm am liebsten gewesen – aber die hat sich schon jemand anderes geschnappt.`], 1);
    return "";
  }

  function buildTeamPickLine({ name, teamName, teamTitleInfo, opponentBadges, fav, pickedId, available }) {
    const n = speechName(name);
    const team = teamFullName(teamName);
    const parts = [];
    const favLine = favoriteTeamLine(n, fav, pickedId, available);
    if (Math.random() < 0.75) parts.push(pickVaried("teamReaction", TEAM_PICK_REACTIONS, 4));
    if (teamTitleInfo && teamTitleInfo.count > 0) {
      const lastWinner = speechName(teamTitleInfo.lastWinnerName || "");
      const sameCoach = lastWinner && MB.normName(teamTitleInfo.lastWinnerName).toLowerCase() === MB.normName(name).toLowerCase();
      if (sameCoach) {
        parts.push(pick(TEAM_TITLE_LINES.sameCoach)(team, teamTitleInfo.count, n));
      } else {
        parts.push(pick(TEAM_TITLE_LINES.withOtherCoach)(team, teamTitleInfo.count, lastWinner, n));
      }
    } else {
      // ohne Titel-Historie nicht bei jedem Pick dieselbe Info (sonst 6x "noch kein Ring")
      // mit Lieblingsteam-Kommentar die Titel-Info weglassen (sonst zu lang)
      if (!favLine && (Math.random() < 0.6 || !parts.length)) parts.push(pickVaried("teamTitleNone", TEAM_TITLE_LINES.none, 5, team));
    }
    if (favLine) parts.push(favLine);
    // nie nur eine nackte Reaktion ("Starke Ansage.") – dann wenigstens das Team nennen
    if (parts.length === 1 && !favLine && /^[^.!?]{0,30}[.!?]$/.test(parts[0])) parts.push(pickVaried("teamNamed", [`Er geht mit den ${team} ins Rennen.`, `Die ${team} sind vergeben.`, `Für ihn spielen heute die ${team}.`], 2));
    const scheduleFact = buildScheduleFact(opponentBadges);
    if (scheduleFact) parts.push(scheduleFact);
    return parts.join(" ");
  }

  // speakerIndex: 0 = Kommentator, 1 = Moderator (im Wechsel von admin.html gesteuert)
  async function announceTeamPick(text, speakerIndex, gate) {
    if (!text) return;
    const settings = getTtsSettings();
    const useElevenLabs = settings.provider === "elevenlabs";
    const voiceId = useElevenLabs ? (speakerIndex === 1 ? settings.voiceIdPreview : settings.voiceIdResult) : null;
    await speakSequence([{ text, voiceId, role: speakerIndex === 1 ? "moderator" : "commentator" }], { gate });
  }

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
    if (m) return `Im Direktvergleich steht es ${m[3]} zwischen ${m[1]} und ${m[2]}`;
    return text;
  }

  // Zentrale Stadion-Formulierung (Anforderung 19). Grammatikalisches
  // Geschlecht lässt sich aus einem freien Stadionnamen nicht zuverlässig
  // herleiten, daher: Default "im" (deckt die meisten Fälle wie "...-Stadion"
  // oder "...Field" ab) mit Möglichkeit, pro Stadion eine andere Präposition
  // zu übergeben (z.B. "in der" für "Energiequelle") - siehe Admin-Konfig in
  // admin.html. Bereits vorhandene Präpositionen werden nicht verdoppelt.
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
      return { type: "rivalry", text: `Das ist mit ${rivalry.count} Spielen die meistgespielte Partie der Altima-Bowl-Geschichte.`, score: 13 };
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
        text: `Beim letzten Duell hat sich ${speechName(lastWinnerRaw)} gegen ${speechName(lastLoserRaw)} durchgesetzt – gelingt heute die Revanche?`,
        score: 10,
      };
    } catch (e) { return null; }
  }

  // Runde Gesamtspielzahl in der Altima-Bowl-Geschichte (Historie + laufendes
  // Turnier bis inkl. dem gerade beendeten Spiel) - reine Trivia, alle 50 Spiele.
  function buildRoundNumberFact(history, state) {
    try {
      const histCount = (history.matches || []).length;
      const curCount = MB.getCurrentMatchesNormalized(state).filter((m) => m.homeScore != null && m.awayScore != null).length;
      const total = histCount + curCount;
      if (total > 0 && total % 50 === 0) {
        return { type: "milestone", text: `Nebenbei: Das war gerade Spiel Nummer ${total} in der gesamten Altima-Bowl-Geschichte.`, score: 14 };
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

    // Kategorien, die gerade erst genannt wurden, rutschen nach hinten
    // (Siegesserien sind sonst fast immer vorn). Relevante Besonderheiten
    // (Rivalität, Meilenstein, Revanche) behalten durch ihren hohen Score
    // trotzdem Vorrang.
    const withJitter = available.map((f) => ({
      f,
      key: (f.score || 5) + (FACT_TYPE_BIAS[f.type] || 0) - factRecencyPenalty(f.type) + Math.random() * 6,
    }));
    withJitter.sort((a, b) => b.key - a.key);
    return withJitter[0].f;
  }

  // Spricht einen von MB.Records.detectRecords() erkannten Rekord natürlich
  // aus. Die Erkennung selbst bleibt zentral in records.js (Anforderung 29
  // sinngemäß: keine parallele Logik) - hier wird nur die Sprachformulierung
  // gebaut. rec.alsoTypes (z.B. [\"allTimeHigh\"]) = weitere Rekorde desselben
  // Spiels, die records.js bereits zu EINEM Eintrag zusammengefasst hat.
  function describeRecordForSpeech(rec) {
    if (!rec) return null;
    const player = rec.player ? speechName(rec.player) : "";
    const opponent = rec.opponent ? speechName(rec.opponent) : "";
    const also = new Set(rec.alsoTypes || []);
    let text;
    switch (rec.type) {
      case "allTimeMargin":
        text = also.has("allTimeHigh")
          ? `Das ist die größte Klatsche der Altima-Bowl-Geschichte und gleichzeitig ein neuer Allzeit-Highscore mit ${rec.winnerScore} Punkten!`
          : pickVaried("recAllTimeMargin", [
              "Das ist die größte Klatsche der gesamten Altima-Bowl-Geschichte!",
              "So deutlich hat in der Altima-Bowl-Geschichte noch nie jemand gewonnen!",
            ], 1);
        break;
      case "tournamentMargin":
        text = also.has("allTimeHigh")
          ? `Das ist der deutlichste Sieg dieses Turniers und mit ${rec.winnerScore} Punkten gleichzeitig ein neuer Allzeit-Highscore!`
          : pickVaried("recTournamentMargin", [
              "Das ist der bisher größte Blowout dieses Turniers!",
              "Einen deutlicheren Sieg hat dieses Turnier noch nicht gesehen!",
            ], 1);
        break;
      case "blowout":
        text = pickVaried("recBlowout", BLOWOUT_PHRASES, 2);
        break;
      case "allTimeHigh":
        text = `Und das ist gleichzeitig ein neuer Allzeit-Highscore mit ${rec.value} Punkten für ${player}!`;
        break;
      case "winStreak":
        text = `${player} feiert damit den ${rec.value}. Sieg in Folge.`;
        break;
      case "upset":
        text = `Das ist eine faustdicke Überraschung – laut Quote war ${player} hier klarer Außenseiter gegen ${opponent}.`;
        break;
      case "shootout":
        text = `Das ist die höchste Gesamtpunktzahl, die dieses Turnier bisher gesehen hat.`;
        break;
      default:
        return null;
    }
    return text;
  }
  // Diese Rekord-Typen sagen bereits selbst \"das war ein Blowout\" - die
  // generische CLOSE/BLOWOUT-Farbkommentar-Zeile würde dann nur denselben
  // Punkt ein zweites Mal machen.
  const MARGIN_RECORD_TYPES = new Set(["allTimeMargin", "tournamentMargin", "blowout"]);
  // Wenn ein Spiel mehrere Rekorde gleichzeitig bricht, wird nur EINER
  // angesagt (sonst zu viel). Die Zusammenfassung (Highscore + Klatsche in
  // einem Satz) passiert schon in records.js.
  const RECORD_SPEECH_PRIORITY = ["allTimeMargin", "tournamentMargin", "allTimeHigh", "blowout", "upset", "shootout", "winStreak"];

  // Kommentator: berichtet AUSSCHLIESSLICH über das gerade abgeschlossene
  // Spiel (Anforderung 6). Gibt zusätzlich zurück, welcher(r) Fakt-Typ
  // verbraucht wurde, damit der Moderator ihn nicht doppelt nennt.
  //
  // Informationsauswahl (Zusatzinfo nach dem Ergebnissatz):
  //  * Ausscheiden und Tabellenüberholung sind echte News und kommen immer.
  //  * Sonst werden Impact (Serie, Titelchancen) und Duell-Fakten
  //    (Direktvergleich, Punkteschnitt) gemeinsam gewichtet; Kategorien, die
  //    gerade erst vorkamen, rutschen nach hinten (siehe factRecencyPenalty).
  //  * Ein Rekord-Satz ersetzt schwächere Serien-Infos desselben Spiels.
  function buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, stadiumPreposition, prevSeeds, matchKind, matchId, songMilestone, songGenerated, noHandoff }) {
    const winnerRaw = homeScore > awayScore ? homeName : awayName;
    const loserRaw = homeScore > awayScore ? awayName : homeName;
    const winner = speechName(winnerRaw), loser = speechName(loserRaw);
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    const margin = winnerScore - loserScore;
    const usedFactTypes = new Set();
    const names = getSpeakerNames();

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

    let line = `${pickResultIntro(margin, stadium, stadiumPreposition, !!recordType && MARGIN_RECORD_TYPES.has(recordType))} `;
    // Ergebnis UND Sieger/Verlierer in EINEM Satz. Mix aus Sieger- und
    // Verlierer-Perspektive für mehr Abwechslung.
    const phrasePool = [...WIN_PHRASES, ...LOSE_PHRASES, ...(margin <= 7 ? CLOSE_WIN_PHRASES : []), ...(margin >= 21 ? BLOWOUT_WIN_PHRASES : [])];
    line += fmt(pickVaried("resultPhrase", phrasePool, 5), { winner, loser, winnerScore, loserScore }) + " ";

    // Nicht JEDES enge/deutliche Spiel bekommt zusätzlich noch eine
    // Farbkommentar-Zeile. Ein Rekord, der bereits \"das war ein Blowout\"
    // aussagt, ersetzt die generische Zeile.
    if (recordType && MARGIN_RECORD_TYPES.has(recordType)) {
      // generische Zeile bewusst übersprungen
    } else if (margin <= 3 && Math.random() < 0.7) line += pickVaried("closePhrase", CLOSE_GAME_PHRASES, 2) + " ";
    else if (margin >= 21 && Math.random() < 0.7) line += pickVaried("blowoutPhrase", BLOWOUT_PHRASES, 2) + " ";

    if (recordText) line += recordText + " ";

    // ---- Zusatzinfo ----
    let extra = null;
    try {
      const impacts = MB.getAnnouncerResultImpacts(history, state, winnerRaw, loserRaw, prevSeeds, { matchKind, matchId }) || [];
      const forced = impacts.find((i) => i.type === "eliminationImpact" || i.type === "tableImpact");
      if (forced) {
        extra = forced;
      } else if (Math.random() < 0.65) {
        const cands = impacts.map((i) => ({ type: i.type, text: i.text, score: i.type === "titleImpact" ? 6 : 9 }));
        try {
          const typed = MB.pickFlavourFactsTyped(history, state, homeName, awayName) || [];
          typed.filter((f) => f.type === "directComparison" || f.type === "averagePoints" || (f.type === "playoffFact" && matchKind === "playoff"))
            .forEach((f) => cands.push({ type: f.type, text: naturalizeFact(f.text), score: f.score || 6 }));
        } catch (e) {}
        // Eine Siegesserie im Rekord-Satz nicht noch einmal als Impact nennen.
        const usable = cands.filter((c) => !(recordType === "winStreak" && c.type === "perfectRecord"));
        if (usable.length) {
          usable.forEach((c) => { c.key = (c.score || 5) + (FACT_TYPE_BIAS[c.type] || 0) - factRecencyPenalty(c.type) + Math.random() * 5; });
          usable.sort((a, b) => b.key - a.key);
          extra = usable[0];
        }
      }
    } catch (e) {}
    if (extra) {
      line += extra.text + " ";
      usedFactTypes.add(extra.type);
      rememberFactType(extra.type);
    }

    // Song-Meilenstein, der GENAU JETZT (im selben Score-Commit) entschieden
    // wurde - siehe admin.html/promptSongMomentPopup(). Nur wenn tatsächlich
    // ein Song generiert wurde, sonst kein Wort darüber. Der Song selbst wird
    // separat über announceSong() angesagt/abgespielt (eigene Intro-Zeile).
    if (songGenerated) {
      if (songMilestone === "firstElimination") {
        line += "Das Internet hat bereits mit einem Song reagiert. ";
      } else if (songMilestone === "champion") {
        line += `${winner} hat vorher heimlich seinen eigenen Song geschrieben, um den Sieg zu feiern. Hören wir mal rein. `;
      }
    }

    // Playoff-Kontext: Was bedeutet die Niederlage? (Lower Bracket = raus, Upper Bracket = Umweg)
    try {
      if (matchKind === "playoff" && matchId) {
        const pm = (state.playoffMatches || []).find((x) => "p-" + x.id === matchId || x.id === matchId);
        const phase = String((pm && (pm.phase || pm.session)) || "");
        const rawId = String((pm && pm.id) || matchId).replace(/^p-/, "");
        const L = loser;
        // Phase-Name, sonst über die ID (lb/ls/lf = Lower Bracket, ub/uf/wc = Upper Bracket)
        const isElim = /^Elim|Lower/i.test(phase) || (!phase && /^(lb|ls|lf)/i.test(rawId));
        const isUpper = /^(Upper|Wildcard)/i.test(phase) || (!phase && /^(ub|us|uf|wc)/i.test(rawId));
        if (isElim) line += pickVaried("poOut", [`Für ${L} ist das Turnier damit beendet.`, `${L} ist raus – keine zweite Chance mehr.`, `Damit endet die Reise für ${L}.`], 2) + " ";
        else if (isUpper) line += pickVaried("poDrop", [`${L} muss jetzt den Umweg über das Lower Bracket gehen.`, `Für ${L} geht es im Lower Bracket weiter – ab jetzt ohne Netz.`, `${L} rutscht ins Lower Bracket, eine Niederlage noch und es ist vorbei.`], 2) + " ";
      }
    } catch (e) { /* ohne Kontext */ }

    // Übergabe nur, wenn überhaupt noch ein Spiel ansteht
    let hasNext = true;
    try { hasNext = (MB.getUpcomingMatches(state, { limit: 1 }) || []).length > 0; } catch (e) { hasNext = true; }
    if (songMilestone !== "champion" && hasNext && !noHandoff) line += pickVaried("handoffOut", HANDOFF_OUT_PHRASES, 3, names);

    return { line: prepareText(line), usedFactTypes };
  }

  // Moderator: berichtet AUSSCHLIESSLICH über die kommende Partie
  // (Anforderung 8) und nennt mindestens einen Preview-Fakt, dessen Typ noch
  // nicht vom Kommentator verwendet wurde (Anforderungen 9, 15, 16). Übergibt
  // nie zurück an den Kommentator (Anforderung 20) und endet ohne generische
  // Schlussfloskel (Anforderung 22).
  // \"{away}\"/\"{home}\" halten die UI-Konvention ein (erster Name = Auswärts,
  // zweiter = Heim).
  const UPCOMING_LEAD_INS = [
    "Als Nächstes steht dieses Duell an: {away} bei {home}",
    "Weiter geht es mit {away} bei {home}",
    "Jetzt richtet sich der Blick auf {away} bei {home}",
    "Als Nächstes sind {away} und {home} an der Reihe",
    "Das nächste Duell bestreiten {away} und {home}",
    "Im nächsten Spiel treffen {away} und {home} aufeinander",
    "Und weiter geht's mit {away} bei {home}",
    "Jetzt kommt es zum Duell zwischen {away} und {home}",
    "Die nächste Partie steht bereits an: {away} bei {home}",
    "Als Nächstes spielt {away} bei {home}",
    "Dann kommt {away} bei {home}",
  ];
  // Sonderfälle: Toilet Bowl und Finale sind kein normales Spiel und
  // verdienen keine 08/15-Ansage. `phase` kommt 1:1 aus MB.getUpcomingMatches()
  // (state.playoffMatches[i].phase, z.B. \"Toilet Bowl\"/\"Altima Bowl\").
  const SPECIAL_PHASE_LEAD_INS = {
    "Toilet Bowl": [
      "Es geht um die rote Laterne: als Nächstes die Toilet Bowl zwischen {away} und {home}",
      "Niemand will dieses Spiel gewinnen - jetzt die Toilet Bowl zwischen {away} und {home}",
    ],
    "Altima Bowl": [
      "Das Finale! {away} gegen {home} um den Titel",
      "Jetzt geht's um alles: {away} gegen {home} im großen Finale, dem Altima Bowl",
    ],
  };
  // Gelegentlicher kleiner Konnektor vor dem Fakt, statt immer nahtlos
  // anzuschließen - rein für Abwechslung, meistens bleibt es aber leer.
  const FACT_CONNECTORS = ["", "", "", "Dazu: ", "Außerdem: "];

  // Anpfiff-/Stadion-Sätze: kurze, getrennte Sätze statt \"..., Anpfiff 18 Uhr, im Stadion\".
  // {t} = \"18 Uhr\", {sp} = \"im Altima Field\".
  const KICKOFF_TIME_ONLY = [
    "Anpfiff ist um {t}.",
    "Los geht's um {t}.",
    "Gespielt wird ab {t}.",
  ];
  const KICKOFF_TIME_AND_STADIUM = [
    "Anpfiff ist um {t} {sp}.",
    "Los geht's um {t} {sp}.",
    "Gespielt wird {sp}. Anpfiff ist um {t}.",
    "Das Spiel steigt um {t} {sp}.",
  ];
  const KICKOFF_STADIUM_ONLY = [
    "Gespielt wird {sp}.",
    "Das Spiel findet {sp} statt.",
  ];
  function buildKickoffSentence(time, stadium, stadiumPreposition) {
    const t = time ? formatTimeForSpeech(time) : "";
    const sp = stadium ? stadiumPhrase(stadium, stadiumPreposition) : "";
    if (t && sp) return fmt(pickVaried("kickoffBoth", KICKOFF_TIME_AND_STADIUM, 2), { t, sp });
    if (t) return fmt(pickVaried("kickoffTime", KICKOFF_TIME_ONLY, 2), { t });
    if (sp) return fmt(pickVaried("kickoffStadium", KICKOFF_STADIUM_ONLY, 1), { sp });
    return "";
  }

  // Teaser-Zeilen für einen Song-Meilenstein, der GENAU JETZT (im selben
  // Score-Commit, vor dieser Vorschau) entschieden wurde - nur wenn der Song
  // auch tatsächlich generiert wurde (sonst kein Wort darüber verlieren).
  // Der eigentliche Song wird separat über announceSong() angesagt/abgespielt
  // (eigene Intro-Zeile dort) - hier nur der kurze Teaser davor.
  const SONG_TEASER_UPCOMING = {
    regularSeason: "Das Playoff-Feld steht!",
    firstElimination: "Tja, sowas passiert wohl, wenn man nicht aufpasst.",
    finals: "Jedes Jahr freut sich die ganze Welt auf die Halbzeit-Show und die Werbespots - aber dieses Jahr wurde bereits vorher ein viraler Moment geschaffen...",
  };

  function buildUpcomingLine({ state, history, homeName, awayName, time, stadium, stadiumPreposition, phase, usedFactTypes, songMilestone, songGenerated }) {
    const { home, away } = speechNames(homeName, awayName);
    const names = getSpeakerNames();
    const used = usedFactTypes || new Set();

    // Meistens direkt loslegen; gelegentlich ein Dank, jeweils in anderer Form.
    const handoffIn = Math.random() < 0.5 ? pickVaried("handoffIn", HANDOFF_IN_THANKS, 2, names) : "";
    let line = handoffIn ? `${handoffIn} ` : "";

    if (songMilestone && songGenerated && SONG_TEASER_UPCOMING[songMilestone]) {
      line += SONG_TEASER_UPCOMING[songMilestone] + " ";
    }

    const special = phase && SPECIAL_PHASE_LEAD_INS[phase];
    line += fmt(special ? pickVaried("upcomingSpecial" + phase, special, 1) : pickVaried("upcomingLead", UPCOMING_LEAD_INS, 4), { away, home });
    line += ". ";
    const kickoff = buildKickoffSentence(time, stadium, stadiumPreposition);
    if (kickoff) line += kickoff + " ";

    const fact = pickUpcomingFact(history, state, homeName, awayName, used);
    if (fact) {
      line += pick(FACT_CONNECTORS) + naturalizeFact(fact.text) + " ";
      used.add(fact.type);
      rememberFactType(fact.type);

      // Selten einen zweiten (anders typisierten) Fakt nachschieben, wenn
      // noch einer übrig ist - klingt dann etwas kompletter, ohne dass es
      // jedes Mal passiert.
      if (Math.random() < 0.2) {
        const second = pickUpcomingFact(history, state, homeName, awayName, used);
        if (second) {
          line += "Und: " + naturalizeFact(second.text) + " ";
          used.add(second.type);
          rememberFactType(second.type);
        }
      }
    }

    return prepareText(line);
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

  // Ist das gewählte Modell Eleven v3? Steuert, wie Pausen/Betonung gebaut
  // werden (siehe formatPacingForModel/buildRingIntroLine) — v3 kennt laut
  // ElevenLabs-Doku KEINE SSML-<break>-Tags (anders als v2/Flash), dort
  // steuert man Pausen/Emotion über Audio-Tags wie [pause]/[excited] und
  // Interpunktion statt über feste Zeitangaben.
  function isV3Model(modelId) { return /v3/i.test(modelId || ""); }

  // Genereller Pacing-Konverter, wird auf JEDEN gesprochenen Text angewendet
  // (Ring-Ansager UND Kommentator/Moderator-Duo gleichermaßen) — Zeilenumbruch
  // steht in unseren Textbausteinen für "dramatische Pause zwischen zwei
  // Beats". Bei v2/Flash wird daraus ein echtes <break>-Tag (dort laut
  // ElevenLabs zuverlässiger als Interpunktion), bei v3 ein [pause]-Audio-Tag.
  function formatPacingForModel(text, modelId) {
    if (!text) return text;
    return isV3Model(modelId)
      ? text.replace(/\n+/g, " [pause] ")
      : text.replace(/\n+/g, ' <break time="0.7s" /> ');
  }

  // ======================================================================
  // ABSCHLIESSENDE TEXT-VALIDIERUNG
  // ----------------------------------------------------------------------
  // Jeder fertige Sprechtext läuft durch prepareText(): interne Spielernamen
  // werden in die gesprochene Form gesetzt, Satzzeichen bereinigt und
  // Dezimalzahlen ausgeschrieben. lintText() prüft zusätzlich auf Fehler, die
  // sich nicht automatisch reparieren lassen (z.B. falsche Namens-Genitive,
  // \"undefined\", doppelte Sätze) und wird vom Testlauf (replay.js)
  // genutzt, um Auffälligkeiten im Transkript zu markieren.
  // ======================================================================
  function tidyText(text) {
    let t = String(text == null ? "" : text);
    // Interne Kurznamen -> gesprochene Form (zentral, wirkt auf JEDEN Baustein)
    t = t.replace(/\bTobi\s+F\b\.?/g, "Tobi Eff").replace(/\bTobi\s+W\b\.?/g, "Tobi Weh");
    // Teamname für TTS
    t = t.replace(/\b49ers\b/g, "Forty-Niners");
    // Leerzeichen vor Satzzeichen: "20 zu 15 ." -> "20 zu 15.", "den 5 . Sieg" -> "den 5. Sieg"
    t = t.replace(/\s+([.,:;!?])/g, "$1");
    // Doppelte Satzzeichen (Auslassungspunkte "..." bleiben erhalten)
    t = t.replace(/(?<![.])\.\.(?![.])/g, ".");
    t = t.replace(/,{2,}/g, ",").replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");
    t = t.replace(/!\./g, "!").replace(/\?\./g, "?").replace(/:\./g, ".");
    // Leerzeichen
    t = t.replace(/[ \t]{2,}/g, " ");
    return t.trim();
  }

  // Dezimalzahlen für deutsche TTS (Anforderungen 23/24/25): "1,39" ->
  // "eins Komma drei neun", "42.0" -> "zweiundvierzig". NUR im Sprachpfad,
  // nicht in shared.js/one(), damit die sichtbaren Insight-Texte auf
  // index.html/admin.html/music.js unverändert bleiben.
  function spellDecimals(text) {
    return String(text == null ? "" : text).replace(/(\d+)[.,](\d+)/g, (_, intPart, fracPart) => {
      if (/^0+$/.test(fracPart)) return numberWordsDE(parseInt(intPart, 10));
      return `${numberWordsDE(parseInt(intPart, 10))} Komma ${digitsWordsDE(fracPart)}`;
    });
  }

  // Fertiger, validierter Text (Anzeige/Transkript UND Basis für die Audio-Ausgabe).
  function prepareText(text) {
    return tidyText(spellDecimals(text));
  }

  // Nur für die Audio-Ausgabe: BUGFIX "17." (Zahl direkt gefolgt von Punkt) wird
  // von deutschen TTS-Stimmen als Ordinalzahl gelesen ("siebzehnter" statt
  // "siebzehn"). Wir trennen den Punkt per Leerzeichen ab. Echte Ordinalzahlen
  // ("den 5. Sieg") bleiben unangetastet, damit sie richtig gesprochen werden.
  const ORDINAL_FOLLOWERS = /^(Sieg|Niederlage|Spiel|Titel|Platz|Saison|Mal|Duell|Pick|Ring|Bowl)\b/;
  function sanitizeForSpeech(text) {
    return prepareText(text)
      .replace(/(\d)\.(?=\s|$)(\s*)/g, (m, d, ws, off, str) => {
        const rest = str.slice(off + m.length);
        return ORDINAL_FOLLOWERS.test(rest) ? m : `${d} .${ws}`;
      })
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Liefert eine Liste lesbarer Auffälligkeiten (leer = sauber). names: optional
  // die Spielernamen des Turniers (für die Genitiv-Prüfung).
  function lintText(text, { names, speech } = {}) {
    const t = String(text == null ? "" : text);
    const issues = [];
    if (/\b(undefined|NaN)\b/.test(t)) issues.push("enthält undefined/NaN");
    if (/[{}]/.test(t)) issues.push("unersetzter Platzhalter {…}");
    if (/\s[.,:;!?]/.test(t)) issues.push("Leerzeichen vor Satzzeichen");
    if (/(?<!\.)\.\.(?!\.)/.test(t) || /[!?]\./.test(t) || /,,/.test(t)) issues.push("doppelte Satzzeichen");
    if (speech !== false && /\bTobi [FW]\b/.test(t)) issues.push("interner Kurzname (Tobi F./W.) im Text");
    if (/\b\d+ \./.test(t)) issues.push("Zahl mit losem Punkt");
    if (/\bAnpfiff \d/.test(t)) issues.push("Zeitangabe ohne Präposition (\"Anpfiff 18 Uhr\")");
    if (/\b[A-Z]{2,3}\b hat noch niemand/.test(t)) issues.push("Teamkürzel statt Teamname");
    (names || []).filter(Boolean).forEach((n) => {
      const clean = speechName(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${clean}s\\b`).test(t)) issues.push(`falscher Genitiv bei "${speechName(n)}"`);
    });
    // Identischer Satz zweimal im selben Text
    const sentences = t.split(/(?<=[.!?])\s+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 12);
    const seen = new Set();
    for (const sen of sentences) { if (seen.has(sen)) { issues.push("Satz kommt doppelt vor"); break; } seen.add(sen); }
    return issues;
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
        text: formatPacingForModel(isV3Model(modelId) ? v3Decorate(sanitizeForSpeech(text)) : sanitizeForSpeech(text), modelId),
        model_id: modelId || "eleven_multilingual_v2",
        voice_settings: { stability: (isV3Model(modelId) && /\[(booming|roaring|shouting|deep, theatrical|announcer)/i.test(text)) ? 0.0 : 0.5, similarity_boost: 0.75 },
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

  // ======================================================================
  // STUDIO-BILDSCHIRM (studio.html): bekommt alle Sprech-Events per
  // BroadcastChannel und kann — wenn in den Admin-Settings so gewählt —
  // den Ton der Ansagen statt der Admin-Seite abspielen. Antwortet das
  // Studio nicht, spielt die Admin-Seite wie bisher selbst.
  // ======================================================================
  const STUDIO_AUDIO_KEY = "mb_studio_audio"; // "admin" (Standard) | "studio"
  let _studioCh = null, _studioSeen = 0;
  const _studioWait = new Map();
  try {
    if (typeof BroadcastChannel !== "undefined") {
      _studioCh = new BroadcastChannel("mb-studio");
      _studioCh.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.type === "studio-hello") _studioSeen = Date.now();
        if ((m.type === "audio-ack" || m.type === "audio-done" || m.type === "song-ack" || m.type === "song-done") && _studioWait.has(m.id)) _studioWait.get(m.id)(m.type, m);
      };
    }
  } catch (e) { _studioCh = null; }
  function studioConnected() { return !!_studioCh && Date.now() - _studioSeen < 6000; }
  function studioAudioMode() { try { return localStorage.getItem(STUDIO_AUDIO_KEY) || "admin"; } catch (e) { return "admin"; } }
  function setStudioAudioMode(v) { try { localStorage.setItem(STUDIO_AUDIO_KEY, v === "studio" ? "studio" : "admin"); } catch (e) { /* egal */ } }
  function studioPost(msg) { try { if (_studioCh) _studioCh.postMessage(msg); } catch (e) { /* egal */ } }

  // Ton ans Studio übergeben; true = Studio hat gespielt, false = selbst spielen
  async function playViaStudio(url) {
    if (studioAudioMode() !== "studio" || !studioConnected()) return false;
    let blob;
    try { blob = await (await fetch(url)).blob(); } catch (e) { return false; }
    const id = "a" + Date.now() + Math.random().toString(36).slice(2, 7);
    return await new Promise((resolve) => {
      let acked = false;
      const done = (ok) => { _studioWait.delete(id); clearTimeout(t1); clearTimeout(t2); resolve(ok); };
      const t1 = setTimeout(() => { if (!acked) done(false); }, 1500);        // keine Antwort -> lokal spielen
      const t2 = setTimeout(() => done(true), 120000);                       // Sicherheitsnetz
      _studioWait.set(id, (type) => { if (type === "audio-ack") acked = true; else done(true); });
      studioPost({ type: "audio", id, blob });
    });
  }

  // Musikvideo im Studio: Bühne + Song laufen dort (Bild und Ton synchron),
  // die Ansage davor kommt wie gewohnt (Ton je nach Einstellung). Liefert
  // false, wenn das Studio nicht antwortet -> Admin spielt selbst.
  async function playSongInStudio(o, speakIntroFn) {
    if (!studioConnected()) return false;
    const id = "s" + Date.now() + Math.random().toString(36).slice(2, 7);
    let ackResolve, doneResolve;
    const acked = new Promise((r) => { ackResolve = r; });
    const done = new Promise((r) => { doneResolve = r; });
    _studioWait.set(id, (type, msg) => { if (type === "song-ack") ackResolve(true); else if (type === "song-done") doneResolve(msg || {}); });
    studioPost({ type: "song", id, o });
    const ok = await Promise.race([acked, new Promise((r) => setTimeout(() => r(false), 2000))]);
    if (!ok) { _studioWait.delete(id); return false; }
    try { if (speakIntroFn) await speakIntroFn(); } catch (e) { /* Ansage optional */ }
    studioPost({ type: "song-go", id });
    const res = await Promise.race([done, new Promise((r) => setTimeout(() => r({ timeout: true }), 9 * 60 * 1000))]);
    _studioWait.delete(id);
    return !res.failed;
  }
  // Im Studio: über den Kanal empfangene Sprech-Events an die lokalen Zuhörer (z.B. Song-Bühne) weitergeben
  function emitSpeakLocal(evt) { _speakListeners.forEach((fn) => { try { fn(evt); } catch (e) { /* egal */ } }); }

  function playAudioUrl(url) {
    return new Promise(async (resolve) => {
      if (await playViaStudio(url)) { try { URL.revokeObjectURL(url); } catch (e) { /* egal */ } resolve(); return; }
      const audio = new Audio(url);
      const cleanup = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    });
  }

  // Zentraler Sprech-Aufruf: nutzt ElevenLabs, wenn konfiguriert. Bewusst
  // KEIN Rückfall mehr auf die Browser-Stimme (Tim: lieber ganz stumm als
  // mit der Browser-Stimme) — ohne gültige ElevenLabs-Konfiguration bleibt
  // die App bei dieser Ansage einfach still.
  async function speakSmart(text, { voiceId } = {}) {
    const settings = getTtsSettings();
    if (settings.provider === "elevenlabs" && settings.apiKey && voiceId) {
      try {
        await speakElevenLabs(text, { apiKey: settings.apiKey, voiceId, modelId: settings.modelId });
      } catch (e) {
        console.warn("ElevenLabs-Ansage fehlgeschlagen, bleibt stumm:", e);
      }
    }
  }

  // ----------------------------------------------------------------------
  // SPRECH-EVENTS für die Draft-Bühne (draft-stage.js): meldet, WER gerade
  // spricht (role = commentator | moderator | announcer) und was. So können
  // die animierten Moderatoren im Bild synchron zum Audio den Mund bewegen
  // und Untertitel einblenden. Ohne Listener passiert nichts.
  // ----------------------------------------------------------------------
  const _speakListeners = new Set();
  function onSpeak(fn) {
    _speakListeners.add(fn);
    return () => _speakListeners.delete(fn);
  }
  function _emitSpeak(evt) {
    studioPost({ type: "speak", evt: { type: evt.type, role: evt.role || null, text: evt.text || "" } });
    _speakListeners.forEach((fn) => { try { fn(evt); } catch (e) { /* Bühne darf nie die Ansage stören */ } });
  }
  function _roleForVoice(voiceId, settings) {
    if (!voiceId) return null;
    if (settings.voiceIdAnnouncer && voiceId === settings.voiceIdAnnouncer) return "announcer";
    if (voiceId === settings.voiceIdPreview) return "moderator";
    if (voiceId === settings.voiceIdResult) return "commentator";
    return null;
  }

  // Spielt mehrere Zeilen nacheinander OHNE Wartezeit an den Übergängen.
  // Statt jede Zeile erst nach Ende der vorherigen bei ElevenLabs anzufragen
  // (das kostet pro Zeile ~1-3s Generierungszeit), werden ALLE ElevenLabs-
  // Anfragen sofort parallel losgeschickt ("gleichzeitig generieren") und
  // dann strikt der Reihe nach abgespielt ("nacheinander in die Playlist
  // einsortiert") — während Zeile 1 noch läuft, ist Zeile 2 im Hintergrund
  // längst fertig generiert und wartet nur noch aufs Abspielen.
  // segments: [{ text, voiceId }] — ohne gültige ElevenLabs-Konfiguration
  // oder bei Fehlern wird die jeweilige Zeile übersprungen (kein Browser-
  // Stimme-Rückfall mehr).
  // opts.gate (optional): Promise, auf die vor dem ERSTEN Abspielen gewartet wird
  // (Audio wird trotzdem schon vorab generiert, es gibt also keine Extra-Latenz).
  async function speakSequence(segments, opts) {
    const settings = getTtsSettings();
    const useElevenLabs = settings.provider === "elevenlabs" && !!settings.apiKey;
    if (!useElevenLabs) return;

    const prepared = segments.map((seg) => {
      if (seg.voiceId) {
        return {
          seg,
          audioPromise: fetchElevenLabsAudioUrl(seg.text, {
            apiKey: settings.apiKey, voiceId: seg.voiceId, modelId: settings.modelId,
          }).catch((e) => {
            console.warn("ElevenLabs-Vorgenerierung fehlgeschlagen, Zeile bleibt stumm:", e);
            return null;
          }),
        };
      }
      return { seg, audioPromise: null };
    });

    let gateWaited = false;
    for (const { seg, audioPromise } of prepared) {
      if (audioPromise) {
        const url = await audioPromise; // meist schon fertig, da parallel gestartet
        if (url) {
          if (!gateWaited && opts && opts.gate) { gateWaited = true; try { await opts.gate; } catch (e) {} }
          const role = seg.role || _roleForVoice(seg.voiceId, settings);
          _emitSpeak({ type: "start", role, text: seg.display || seg.text });
          await playAudioUrl(url);
          _emitSpeak({ type: "end", role });
        }
      }
    }
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
    _pendingPreview = null; // eine liegengebliebene Vorschau (Song kam nie) verfällt
    const nextMatchPre = (upcoming || [])[0] || null;
    // Wird gleich ein Song gespielt: Ergebnis jetzt, Vorschau erst NACH dem Song
    const songFirst = !!(songGenerated && songMilestone && songMilestone !== "champion" && nextMatchPre);
    const { line: resultLine, usedFactTypes } = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, stadiumPreposition, prevSeeds, matchKind, matchId, songMilestone, songGenerated, noHandoff: songFirst });
    const nextMatch = songFirst ? null : nextMatchPre;
    if (songFirst) {
      const voice = settings.provider === "elevenlabs" ? (settings.voiceIdPreview || settings.voiceIdResult) : null;
      _pendingPreview = () => ({ voiceId: voice, role: "moderator", text: SONG_BACK_LINES[Math.floor(Math.random() * SONG_BACK_LINES.length)] + " " + buildUpcomingLine({
        state, history, homeName: nextMatchPre.homeName, awayName: nextMatchPre.awayName,
        time: nextMatchPre.time, stadium: nextMatchPre.stadium, stadiumPreposition: nextMatchPre.stadiumPreposition,
        phase: nextMatchPre.phase, usedFactTypes, songMilestone: null, songGenerated: false,
      }) });
    }

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

    // Einzel-Stimmen-Modus (nur eine ElevenLabs-Stimme konfiguriert, oder
    // keine — dann bleibt es bei dieser Ansage einfach stumm): alle Zeilen
    // ebenfalls vorab parallel generiert, dann der Reihe nach abgespielt.
    const singleVoiceId = settings.provider === "elevenlabs" ? (settings.voiceIdResult || settings.voiceIdPreview) : null;
    const segments = [{ text: resultLine, voiceId: singleVoiceId }];
    if (nextMatch) segments.push({ text: buildPreviewLine(), voiceId: singleVoiceId });

    await speakSequence(segments);
  }

  // ======================================================================
  // TURNIERSTART-INTRO (Anforderungen 26-28) — beide Rollen stellen sich mit
  // den aktuell konfigurierten Namen vor, Teilnehmernamen kommen 1:1 aus dem
  // Aufrufer (admin.html reicht state.players.map(p => p.name) durch).
  // ======================================================================
  // Texte der Turnier-/Draft-Eröffnung als [{role, text}] — gemeinsam genutzt von der
  // echten Ansage und vom Testlauf (Transkript), damit beide nie auseinanderlaufen.
  // Nach dem Draft: nur noch ein kurzer Übergang, dann kündigt der Moderator
  // direkt die ersten beiden Partien an (kein langer Begrüßungstext mehr).
  const AFTER_DRAFT_CUES = [
    (n) => `Der Draft ist beendet, die Spiele mögen beginnen. Was steht als Erstes an, ${n.moderator}?`,
    (n) => `Der Draft ist durch, jetzt wird gespielt. ${n.moderator}, womit geht es los?`,
    (n) => `Alle Teams sind vergeben, die Controller sind bereit. ${n.moderator}, wer eröffnet den Abend?`,
  ];
  const FIRST_GAME_LEADS = [
    "Den Anfang machen {away} und {home}.",
    "Als Erstes treffen {away} und {home} aufeinander.",
    "Los geht's mit {away} bei {home}.",
    "Die Eröffnungspartie bestreiten {away} und {home}.",
  ];
  const SECOND_GAME_LEADS = [
    "Danach folgt {away} bei {home}.",
    "Direkt im Anschluss spielen {away} und {home}.",
    "Und gleich danach: {away} bei {home}.",
  ];
  const PARALLEL_GAME_LEADS = [
    "Parallel dazu spielen {away} und {home}.",
    "Gleichzeitig treffen {away} und {home} aufeinander.",
    "Am zweiten Stadion geht es zeitgleich mit {away} bei {home} los.",
  ];

  // matches: [{ homeName, awayName, time, stadium, stadiumPreposition }] (max. die ersten zwei)
  function buildFirstGamesLine(matches) {
    const list = (matches || []).filter(Boolean).slice(0, 2);
    if (!list.length) return "";
    const m1 = list[0];
    const s1 = speechNames(m1.homeName, m1.awayName);
    let line = fmt(pickVaried("firstGame", FIRST_GAME_LEADS, 2), { away: s1.away, home: s1.home }) + " ";
    const k1 = buildKickoffSentence(m1.time, m1.stadium, m1.stadiumPreposition);
    if (k1) line += k1 + " ";
    if (list[1]) {
      const m2 = list[1];
      const s2 = speechNames(m2.homeName, m2.awayName);
      const parallel = m1.time && m2.time && m1.time === m2.time;
      line += fmt(pickVaried(parallel ? "parallelGame" : "secondGame", parallel ? PARALLEL_GAME_LEADS : SECOND_GAME_LEADS, 2), { away: s2.away, home: s2.home }) + " ";
      if (!parallel && m2.time) line += buildKickoffSentence(m2.time, null, null) + " ";
    }
    return prepareText(line);
  }

  // context "draft": Eröffnung der Draft Night. Sonst (nach dem Draft): Übergang
  // + Ansage der ersten beiden Partien (`upcoming`, z.B. aus MB.getUpcomingMatches).
  function getTournamentStartSegments({ athleteNames, context, upcoming } = {}) {
    const names = getSpeakerNames();
    // Draft-Night-Intro: Kommentator und Moderation übergeben sich den Satz
    // ("... neben mir sitzt…" / "…Mona!"), daher bewusst keine Namensliste.
    if (context === "draft") {
      return [
        { role: "commentator", text: `Guten Abend und herzlich willkommen zur Altima Bowl Draft Night! Ich bin ${names.commentator}, und neben mir sitzt…` },
        { role: "moderator", text: `…${names.moderator}! Heute Abend werden die Slots gezogen und die Teams vergeben. Wer erwischt den Top-Pick, wer muss mit dem Rest leben?` },
        { role: "commentator", text: "Allen Athletinnen und Athleten, viel Erfolg am Controller. Und nun: Lasset den Draft beginnen!" },
      ];
    }
    const segments = [{ role: "commentator", text: prepareText(pickVaried("afterDraft", AFTER_DRAFT_CUES, 2, names)) }];
    const games = buildFirstGamesLine(upcoming);
    if (games) segments.push({ role: "moderator", text: games });
    return segments;
  }

  async function _announceTournamentStartNow({ athleteNames, context, upcoming } = {}) {
    const settings = getTtsSettings();
    const useElevenLabs = settings.provider === "elevenlabs" && !!settings.apiKey;
    const resultVoice = useElevenLabs ? settings.voiceIdResult : null;
    const previewVoice = useElevenLabs ? settings.voiceIdPreview : null;
    await speakSequence(getTournamentStartSegments({ athleteNames, context, upcoming }).map((seg) => ({
      text: seg.text, role: seg.role, voiceId: seg.role === "moderator" ? previewVoice : resultVoice,
    })));
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

  // Sprechtexte der Song-Ansage (Kommentator-Anmoderation + Moderator "Am Mikrofon") als [{role,text}].
  function getSongAnnounceSegments(milestone, performers) {
    const intro = pick(SONG_ANNOUNCE_INTROS[milestone] || ["Dazu gibt's jetzt extra einen Song, hört mal rein:"]);
    const segs = [{ role: "commentator", text: intro }];
    if (performers && performers.length) {
      const pn = performers.map((p) => speechName(p.name));
      const micLine = performers[0] && performers[0].host ? `Und wir schalten live ins Studio zu ${pn[0]}!` : (pn.length === 1 ? `Am Mikrofon: ${pn[0]}!` : `Am Mikrofon: ${pn[0]} und ${pn[1]}!`);
      segs.push({ role: "moderator", text: micLine });
    }
    return segs;
  }

  async function _announceSongNow(milestone, url, { voiceId, performers, target, players, record } = {}) {
    if (!url) return;
    const settings = getTtsSettings();
    const spokenVoiceId = settings.provider === "elevenlabs" ? (voiceId || settings.voiceIdResult || settings.voiceIdPreview) : null;
    const modVoiceId = settings.provider === "elevenlabs" ? (settings.voiceIdPreview || spokenVoiceId) : null;
    const intro = pick(SONG_ANNOUNCE_INTROS[milestone] || ["Dazu gibt's jetzt extra einen Song, hört mal rein:"]);

    // TV-Bühne (song-stage.js): Kommentatoren in der Booth + Musikvideo mit Rapper-Figur(en).
    // Gilt für Spieler-Songs (Performer bekannt); der Recap-Song nutzt vorerst den klassischen Ablauf.
    if (global.MB.SongStage && performers && performers.length) {
      const pn = performers.map((p) => speechName(p.name));
      const micLine = performers[0] && performers[0].host ? `Und wir schalten live ins Studio zu ${pn[0]}!` : (pn.length === 1 ? `Am Mikrofon: ${pn[0]}!` : `Am Mikrofon: ${pn[0]} und ${pn[1]}!`);
      // Läuft das Studio-Fenster, kommt das Musikvideo dort (Aufnahme-Wunsch bleibt lokal)
      if (!record && studioConnected()) {
        const inStudio = await playSongInStudio({ milestone, url, performers, target, players }, () => speakSequence([
          { text: intro, voiceId: spokenVoiceId, role: "commentator" },
          { text: micLine, voiceId: modVoiceId, role: "moderator" },
        ]));
        if (inStudio) return;
      }
      const shown = await global.MB.SongStage.play({
        milestone, url, performers, target, players, record,
        speakIntro: () => speakSequence([
          { text: intro, voiceId: spokenVoiceId, role: "commentator" },
          { text: micLine, voiceId: modVoiceId, role: "moderator" },
        ]),
      });
      if (shown) return; // null = Bühne nicht verfügbar -> klassischer Fallback unten
    }
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
    const say = (role, text) => lines.push(`[${role === "commentator" ? names.commentator : names.moderator}] ${prepareText(text)}`);
    const heading = (n, title) => { lines.push(""); lines.push("=".repeat(70)); lines.push(`${n}. ${title}`); lines.push("=".repeat(70)); };
    const note = (text) => lines.push(`   (${text})`);

    lines.push("ALTIMA BOWL ANNOUNCER — TESTLAUF MIT FIKTIVEN DATEN");
    lines.push(`Erzeugt am ${new Date().toLocaleString("de-DE")}`);
    lines.push(`Sprecher: Kommentator = ${names.commentator}, Moderator = ${names.moderator}`);
    lines.push("Hinweis: Zahlen stehen hier schon in der gesprochenen Form (z.B. Quoten als 'eins Komma ...').");
    lines.push("Records/Impacts hängen stark von den erfundenen Platzhalter-Daten ab und variieren bei jedem Lauf (u.a. durch Zufallsauswahl der Formulierungen).");

    // 1) Turnierstart (nach dem Draft) -------------------------------------
    heading(1, "TURNIERSTART NACH DEM DRAFT");
    getTournamentStartSegments({
      upcoming: [
        { homeName: "Alex", awayName: "Tim", time: "18:00", stadium: "Altima Field", stadiumPreposition: "im" },
        { homeName: "Marco", awayName: "Jonas", time: "18:00", stadium: "Energiequelle", stadiumPreposition: "in der" },
      ],
    }).forEach((seg) => say(seg.role, seg.text));

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
      say("moderator", buildUpcomingLine({ state, history: FAKE_HISTORY_EMPTY, homeName: "Alex", awayName: "Marco", time: "20:00", stadium: "Altima Field", stadiumPreposition: "im", phase: "Altima Bowl", usedFactTypes: r.usedFactTypes, songMilestone: "finals", songGenerated: true }));
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

    // 13) Ring-Ansager: Draft-Vorstellung + Team-Pick-Kommentar --------------
    heading(13, "RING-ANSAGER: DRAFT-VORSTELLUNG + TEAM-PICK-KOMMENTAR");
    {
      const say2 = (role, text) => lines.push(`[${role === "announcer" ? names.announcer : (role === "commentator" ? names.commentator : names.moderator)}] ${prepareText(text)}`);
      note("Ein Baustein pro Vorstellung, Auswahl kommt aus MB.computeRingIntroBadges() — hier mit erfundenen Badges demonstriert.");
      say2("announcer", buildRingIntroLine({ name: "Tim", isDefendingChampion: true, titles: 2 }, { isFirstPick: false }));
      say2("announcer", buildRingIntroLine({ name: "Alex", isSoleRecordChampion: true, titles: 3 }, {}));
      say2("announcer", buildRingIntroLine({ name: "Marco", isAllTimeHighScoreHolder: true }, {}));
      say2("announcer", buildRingIntroLine({ name: "Jonas", isRunnerUpLastSeason: true }, {}));
      say2("announcer", buildRingIntroLine({ name: "Kevin", isToiletBowlLastSeason: true }, { isFirstPick: true }));
      say2("announcer", buildRingIntroLine({ name: "Nico", isRookie: true }, {}));
      note("Team-Pick-Kommentar (Kommentator/Moderator im Wechsel), inkl. Spielplan-Einschätzung:");
      say2("commentator", buildTeamPickLine({
        name: "Tim", teamName: "Baltimore Ravens",
        teamTitleInfo: { count: 2, lastWinnerName: "Alex" },
        opponentBadges: [
          { name: "Alex", badge: { isSoleRecordChampion: true, titles: 3 } },
          { name: "Nico", badge: { isRookie: true } },
        ],
      }));
      say2("moderator", buildTeamPickLine({ name: "Nico", teamName: "Detroit Lions", teamTitleInfo: null, opponentBadges: [] }));
    }

    return lines.join("\n");
  }


  // Wird z.B. in admin.html aus finishScoreUpdate() OHNE await aufgerufen.
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
  let _pendingPreview = null; // Vorschau, die erst nach einem Song gesprochen wird
  const SONG_BACK_LINES = ["Starker Track! Zurück aufs Feld.", "Ohrwurm garantiert. Und jetzt wieder Football.", "Was für ein Song! Weiter geht's.", "Applaus fürs Studio – zurück zum Spielbetrieb."];
  async function _speakPendingPreview() {
    const p = _pendingPreview; _pendingPreview = null;
    if (!p) return;
    try { const seg = p(); await speakSequence([seg]); } catch (e) { console.warn("Vorschau nach dem Song:", e); }
  }

  function _enqueue(fn) {
    const run = () => fn().catch((e) => console.warn("Ansage fehlgeschlagen:", e));
    _announceQueue = _announceQueue.then(run, run);
    return _announceQueue;
  }

  function announce(args) {
    return _enqueue(() => _announceNow(args));
  }

  function announceSong(milestone, url, opts) {
    return _enqueue(async () => { try { await _announceSongNow(milestone, url, opts); } finally { await _speakPendingPreview(); } });
  }

  global.MB = global.MB || {};
  global.MB.Announcer = {
    announce, announceSong, announceTournamentStart, buildResultLine, buildUpcomingLine,
    sanitizeForSpeech, prepareText, tidyText, lintText, resetVariety, teamFullName,
    getTtsSettings, setTtsSettings, fetchElevenLabsVoices, speakElevenLabs, speakSmart,
    speakSequence, fetchElevenLabsAudioUrl, playAudioUrl, speechName, speechNames,
    getSpeakerNames, setSpeakerNames, classifyFact, naturalizeFact, stadiumPhrase, pickUpcomingFact,
    buildDryRunTranscript, getTournamentStartSegments, buildFirstGamesLine, getSongAnnounceSegments,
    buildRingIntroLine, announceRingIntro, buildTeamPickLine, announceTeamPick,
    setNicknames, getNickname,
    onSpeak,
    prepareRingIntro,
    studioConnected, studioAudioMode, setStudioAudioMode, studioPost, emitSpeakLocal,
  };
})(window);
