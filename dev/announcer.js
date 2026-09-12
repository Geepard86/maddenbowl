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
    "{winner} zieht das Ding und schlägt {loser}.",
    "{winner} behält die Nerven und holt sich den Sieg gegen {loser}.",
    "Am Ende hat {winner} die besseren Antworten und lässt {loser} hinter sich.",
    "{winner} macht den Sack zu — {loser} muss sich geschlagen geben.",
    "Das geht an {winner}: stark gespielt gegen {loser}.",
    "{winner} hat heute den längeren Atem und setzt sich gegen {loser} durch.",
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
  const UPCOMING_OPENERS = [
    "Und weiter geht's — als Nächstes kommt:",
    "Keine lange Pause, die nächste Partie steht an:",
    "Weiter im Programm mit:",
    "Nächste Runde, nächstes Duell:",
    "Und jetzt wird wieder aufgeschlagen:",
  ];
  const CLOSING_LINES = [
    "Dranbleiben — hier kann jederzeit etwas passieren.",
    "Weiter geht's, die nächste Partie wartet schon.",
    "Also: zurücklehnen und schauen, was als Nächstes passiert.",
  ];
  // Bewusst kurz: Die Stimmen sollen wie Kollegen wirken, nicht wie ein Skript.
  const HANDOFF_OUT_PHRASES = [
    "Und jetzt zu dir mit der nächsten Partie.",
    "Du bist dran — was kommt als Nächstes?",
    "Ab zu dir mit dem Ausblick.",
    "Dann schauen wir mal nach vorne — du übernimmst.",
  ];
  const HANDOFF_IN_PHRASES = [
    "Gerne — schauen wir nach vorne.",
    "Alles klar, weiter geht's.",
    "Genau. Die nächste Partie steht an:",
    "Jawohl — hier kommt der Ausblick.",
  ];

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

  function buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium }) {
    const { home, away } = speechNames(homeName, awayName);
    const winnerRaw = homeScore > awayScore ? homeName : awayName;
    const loserRaw = homeScore > awayScore ? awayName : homeName;
    const winner = speechName(winnerRaw), loser = speechName(loserRaw);
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    const margin = winnerScore - loserScore;

    let line = `${pick(OPENERS_RESULT)} ${stadium || "Stadion"}! `;
    // UI-Konvention: Heim@Auswärts = zweiter Name ist das Heimteam.
    // Gesprochen wird daher zuerst der Auswärtsname, dann der Heimname.
    line += `Endstand: ${away} ${awayScore}, ${home} ${homeScore}. `;
    line += fmt(pick(WIN_PHRASES), { winner, loser }) + " ";

    if (margin <= 3) line += pick(CLOSE_GAME_PHRASES) + " ";
    else if (margin >= 21) line += pick(BLOWOUT_PHRASES) + " ";

    try {
      const facts = MB.pickFlavourFacts(history, state, homeName, awayName);
      if (facts && facts.length) line += facts[0] + " ";
    } catch (e) {}
    return line.trim();
  }

  function buildUpcomingLine({ state, history, homeName, awayName, homeTeam, awayTeam, time, stadium }) {
    const { home, away } = speechNames(homeName, awayName);
    // UI-Konvention: erster Name = Auswärts, zweiter Name = Heim.
    let line = `${pick(UPCOMING_OPENERS)} ${away} gegen ${home}`;
    if (time) line += `, Anpfiff ${time} Uhr`;
    if (stadium) line += ` im ${stadium}`;
    line += ". ";

    let odds = null;
    try { odds = MB.computeOddsForMatch(history, state, homeName, awayName); } catch (e) {}

    // Quote und Statistik werden bewusst variiert: manchmal nur die Quote,
    // manchmal ein Insight, selten beides. So klingt die Vorschau weniger wie
    // eine wiederholte Vorlage.
    const facts = (() => {
      try { return MB.pickFlavourFacts(history, state, homeName, awayName) || []; } catch (e) { return []; }
    })();

    const hasOdds = !!odds;
    const hasFacts = facts.length > 0;

    const addOddsLine = () => {
      const favIsHome = odds.pHome >= odds.pAway;
      const favName = speechName(favIsHome ? homeName : awayName);
      const favQuote = favIsHome ? MB.decimalOdds(odds.pHome) : MB.decimalOdds(odds.pAway);
      line += Math.random() < 0.5
        ? `Das Wettbüro sieht ${favName} vorne, mit einer Quote von ${favQuote}. `
        : `Favorit laut Wettbüro: ${favName}, Quote ${favQuote}. `;
    };
    const addFactsLine = () => {
      line += facts[0] + " ";
      if (facts.length > 1 && Math.random() > 0.85) line += facts[1] + " ";
    };

    if (hasOdds && hasFacts) {
      const modeRoll = Math.random();
      if (modeRoll < 0.45) addOddsLine();          // 45%: nur Quote
      else if (modeRoll < 0.9) addFactsLine();      // 45%: nur Insight
      else { addOddsLine(); addFactsLine(); }       // 10%: beides (selten, wie gewollt)
    } else if (hasOdds) {
      addOddsLine();
    } else if (hasFacts) {
      addFactsLine();
    }

    return line.trim();
  }

  // ---- Textbereinigung für saubere Aussprache ----
  // BUGFIX: "17." (Zahl direkt gefolgt von Punkt) wird von deutschen TTS-
  // Stimmen als Ordinalzahl gelesen ("siebzehnter" statt "siebzehn"). Wir
  // trennen den Punkt per Leerzeichen ab, das reicht den meisten Engines,
  // um die Ordinal-Interpretation zu vermeiden — hörbar bleibt es eine
  // normale Kardinalzahl.
  function sanitizeForSpeech(text) {
    return text
      .replace(/(\d)\.(\s|$)/g, "$1 .$2")   // "17." -> "17 ."
      .replace(/\s{2,}/g, " ")
      .trim();
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
  async function _announceNow({ state, history, homeName, awayName, homeScore, awayScore, homeTeam, awayTeam, stadium, upcoming }) {
    if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) return;

    const settings = getTtsSettings();
    const twoVoiceMode = settings.provider === "elevenlabs" && settings.voiceIdResult && settings.voiceIdPreview;

    const resultLine = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium });
    const nextTwo = upcoming || [];

    if (twoVoiceMode) {
      // Zwei-Stimmen-Duo mit Übergabe: beide Zeilen (Ergebnis + Vorschau)
      // werden von speakSequence() gleichzeitig generiert, dann nahtlos
      // hintereinander abgespielt.
      const segments = [{ text: resultLine + " " + pick(HANDOFF_OUT_PHRASES), voiceId: settings.voiceIdResult }];
      const m = nextTwo[0];
      if (m) {
        const line = buildUpcomingLine({
          state, history, homeName: m.homeName, awayName: m.awayName,
          homeTeam: m.homeTeam, awayTeam: m.awayTeam, time: m.time, stadium: m.stadium,
        });
        segments.push({ text: pick(HANDOFF_IN_PHRASES) + " " + line, voiceId: settings.voiceIdPreview });
      }
      await speakSequence(segments);
      return;
    }

    // Einzel-Stimmen-Modus (Browser kostenlos, oder ElevenLabs mit nur einer
    // konfigurierten Stimme): alle Zeilen ebenfalls vorab parallel generiert,
    // dann der Reihe nach abgespielt.
    const singleVoiceId = settings.provider === "elevenlabs" ? (settings.voiceIdResult || settings.voiceIdPreview) : null;
    const segments = [{ text: resultLine, voiceId: singleVoiceId }];
    for (const m of nextTwo.slice(0, 2)) {
      const line = buildUpcomingLine({
        state, history, homeName: m.homeName, awayName: m.awayName,
        homeTeam: m.homeTeam, awayTeam: m.awayTeam, time: m.time, stadium: m.stadium,
      });
      segments.push({ text: line, voiceId: singleVoiceId });
    }
    if (nextTwo.length) segments.push({ text: pick(CLOSING_LINES), voiceId: singleVoiceId });

    await speakSequence(segments);
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
  // WARTESCHLANGE
  // -------------------------------------------------------------------------
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
    announce, announceSong, speak, warmupVoices, buildResultLine, buildUpcomingLine,
    setPreferredVoice, getGermanVoiceCandidates, sanitizeForSpeech,
    getTtsSettings, setTtsSettings, fetchElevenLabsVoices, speakElevenLabs, speakSmart,
    speakSequence, fetchElevenLabsAudioUrl, playAudioUrl, speechName, speechNames,
  };
})(window);
