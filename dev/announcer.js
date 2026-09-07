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
  // Übergabe zwischen zwei Stimmen (nur im ElevenLabs-Zwei-Stimmen-Modus).
  const HANDOFF_OUT_PHRASES = [
    "Und damit übergebe ich an dich für die Vorschau!",
    "Doch genug gefeiert — ab zu dir mit dem Ausblick!",
    "Ich reiche weiter an meinen Co-Kommentator für das, was als Nächstes kommt!",
    "Mehr dazu gleich — erstmal zu dir, was steht als Nächstes an?",
  ];
  const HANDOFF_IN_PHRASES = [
    "Danke dir! Hier ist, was als Nächstes ansteht:",
    "Ich übernehme! Schauen wir nach vorne:",
    "Von mir aus geht's jetzt direkt weiter:",
    "Alles klar, hier kommt die Vorschau:",
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
    const url = URL.createObjectURL(blob);
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

    const settings = getTtsSettings();
    const twoVoiceMode = settings.provider === "elevenlabs" && settings.voiceIdResult && settings.voiceIdPreview;

    const resultLine = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium });
    const nextTwo = upcoming || [];

    if (twoVoiceMode) {
      // Zwei-Stimmen-Duo mit Übergabe: Stimme A macht die Ergebnis-Ansage
      // und übergibt, Stimme B übernimmt die Vorschau.
      await speakSmart(resultLine + " " + pick(HANDOFF_OUT_PHRASES), { voiceId: settings.voiceIdResult });

      const m = nextTwo[0];
      if (m) {
        const line = buildUpcomingLine({
          state, history, homeName: m.homeName, awayName: m.awayName,
          homeTeam: m.homeTeam, awayTeam: m.awayTeam, time: m.time, stadium: m.stadium,
        });
        await speakSmart(pick(HANDOFF_IN_PHRASES) + " " + line, { voiceId: settings.voiceIdPreview });
      }
      return;
    }

    // Einzel-Stimmen-Modus (Browser kostenlos, oder ElevenLabs mit nur einer
    // konfigurierten Stimme): wie bisher, eine Stimme liest alles.
    const singleVoiceId = settings.provider === "elevenlabs" ? (settings.voiceIdResult || settings.voiceIdPreview) : null;
    await speakSmart(resultLine, { voiceId: singleVoiceId });

    for (const m of nextTwo.slice(0, 2)) {
      const line = buildUpcomingLine({
        state, history, homeName: m.homeName, awayName: m.awayName,
        homeTeam: m.homeTeam, awayTeam: m.awayTeam, time: m.time, stadium: m.stadium,
      });
      await speakSmart(line, { voiceId: singleVoiceId });
    }

    if (nextTwo.length) await speakSmart(pick(CLOSING_LINES), { voiceId: singleVoiceId });
  }

  global.MB = global.MB || {};
  global.MB.Announcer = {
    announce, speak, warmupVoices, buildResultLine, buildUpcomingLine,
    setPreferredVoice, getGermanVoiceCandidates, sanitizeForSpeech,
    getTtsSettings, setTtsSettings, fetchElevenLabsVoices, speakElevenLabs, speakSmart,
  };
})(window);
