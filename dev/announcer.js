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
    "ENDSTATION! Die Uhr steht bei Null im",
    "GESCHAFFT! Das Spiel ist durch im",
  ];
  const WIN_PHRASES = [
    "{winner} lässt {loser} keine Chance und schnappt sich den Sieg!",
    "{winner} rollt den roten Teppich aus und marschiert zum Erfolg gegen {loser}!",
    "Eiskalt erwischt: {loser} hat gegen {winner} das Nachsehen!",
    "{winner} macht kurzen Prozess mit {loser}!",
    "Was für eine Vorstellung von {winner} gegen {loser}!",
  ];
  const CLOSE_GAME_PHRASES = [
    "Das war Nervenkitzel pur, bis zur letzten Sekunde!",
    "Herzschlagfinale, meine Damen und Herren!",
    "Das ging so knapp aus wie die Türkontrolle bei der Sommerkino-Kasse!",
  ];
  const BLOWOUT_PHRASES = [
    "Das war eine regelrechte Demontage!",
    "Da blieb kein Stein auf dem anderen!",
    "Diese Klatsche wird noch länger nachhallen!",
  ];
  const UPCOMING_OPENERS = [
    "Aber keine Zeit zum Durchatmen, denn als Nächstes steht an:",
    "Und weiter geht's im Programm, meine Damen und Herren:",
    "Die Bänke werden neu besetzt, denn jetzt kommt:",
    "Frisches Popcorn, neue Runde! Bereit macht euch für:",
  ];
  const CLOSING_LINES = [
    "Bleiben Sie dran, es wird nicht langweilig!",
    "Ihr wisst ja: bei uns fliegen die Punkte!",
    "Das Wettbüro hat schon die Quoten fertig — viel Erfolg!",
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmt(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""); }

  function buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium }) {
    const winner = homeScore > awayScore ? homeName : awayName;
    const loser = homeScore > awayScore ? awayName : homeName;
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    const margin = winnerScore - loserScore;

    let line = `${pick(OPENERS_RESULT)} ${stadium || "Stadion"}! `;
    line += `Endstand: ${homeName} ${homeScore}, ${awayName} ${awayScore}. `;
    line += fmt(pick(WIN_PHRASES), { winner, loser }) + " ";

    if (margin <= 3) line += pick(CLOSE_GAME_PHRASES) + " ";
    else if (margin >= 21) line += pick(BLOWOUT_PHRASES) + " ";

    try {
      const facts = MB.pickFlavourFacts(history, state, homeName, awayName);
      if (facts && facts.length) line += facts[0] + " ";
    } catch (e) { /* still fine without facts */ }

    return line.trim();
  }

  function buildUpcomingLine({ state, history, homeName, awayName, homeTeam, awayTeam, time, stadium }) {
    let line = `${pick(UPCOMING_OPENERS)} ${homeName} gegen ${awayName}`;
    if (time) line += `, Anpfiff ${time} Uhr`;
    if (stadium) line += ` im ${stadium}`;
    line += ". ";

    try {
      const odds = MB.computeOddsForMatch(history, state, homeName, awayName);
      const qHome = MB.decimalOdds(odds.pHome), qAway = MB.decimalOdds(odds.pAway);
      const favName = odds.pHome >= odds.pAway ? homeName : awayName;
      const favQuote = odds.pHome >= odds.pAway ? qHome : qAway;
      line += `Das Wettbüro sieht ${favName} als Favorit bei einer Quote von ${favQuote}. `;
    } catch (e) { /* skip odds if unavailable */ }

    try {
      const facts = MB.pickFlavourFacts(history, state, homeName, awayName);
      if (facts && facts.length) line += facts[0] + " ";
    } catch (e) {}

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

  // Haupt-Einstiegspunkt: wird nach Score-Eintrag für ein FERTIGES Spiel aufgerufen.
  async function announce({ state, history, homeName, awayName, homeScore, awayScore, homeTeam, awayTeam, stadium, upcoming }) {
    if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) return;

    const resultLine = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium });
    await speak(resultLine);

    const nextTwo = upcoming || [];
    for (const m of nextTwo.slice(0, 2)) {
      const line = buildUpcomingLine({
        state, history, homeName: m.homeName, awayName: m.awayName,
        homeTeam: m.homeTeam, awayTeam: m.awayTeam, time: m.time, stadium: m.stadium,
      });
      await speak(line);
    }

    if (nextTwo.length) await speak(pick(CLOSING_LINES));
  }

  global.MB = global.MB || {};
  global.MB.Announcer = {
    announce, speak, warmupVoices, buildResultLine, buildUpcomingLine,
    setPreferredVoice, getGermanVoiceCandidates, sanitizeForSpeech,
  };
})(window);
