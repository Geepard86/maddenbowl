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
  const UPCOMING_FACT_PRIORITY = ["odds", "directComparison", "averagePoints", "playoffFact", "form", "other"];

  function formatOddsForSpeech(p) {
    return MB.decimalOdds(p).toFixed(2).replace(".", ",");
  }

  function buildOddsFact(history, state, homeName, awayName) {
    try {
      const odds = MB.computeOddsForMatch(history, state, homeName, awayName);
      const favIsHome = odds.pHome >= odds.pAway;
      const favName = speechName(favIsHome ? homeName : awayName);
      const dogName = speechName(favIsHome ? awayName : homeName);
      const favQuote = formatOddsForSpeech(favIsHome ? odds.pHome : odds.pAway);
      const dogQuote = formatOddsForSpeech(favIsHome ? odds.pAway : odds.pHome);
      return { type: "odds", text: `Die Wettquoten sehen ${favName} bei ${favQuote} und ${dogName} bei ${dogQuote}.` };
    } catch (e) { return null; }
  }

  // Wählt EINEN Preview-Fakt für den Moderator, der noch nicht von einem
  // anderen Typ verbraucht wurde (Anforderungen 3, 15, 16). Holt sich dafür
  // ALLE getypten Kandidaten aus shared.js (nicht nur die Top 2 wie die
  // Anzeige-Variante pickFlavourFacts), damit bei einer Typ-Kollision noch
  // Alternativen übrig sind.
  function pickUpcomingFact(history, state, homeName, awayName, usedFactTypes) {
    const used = usedFactTypes || new Set();
    const candidates = [];
    const oddsFact = buildOddsFact(history, state, homeName, awayName);
    if (oddsFact) candidates.push(oddsFact);
    try {
      (MB.pickFlavourFactsTyped(history, state, homeName, awayName) || []).forEach((f) => candidates.push(f));
    } catch (e) {}

    const available = candidates.filter((f) => !used.has(f.type));
    if (!available.length) return null;

    available.sort((a, b) => {
      const pa = UPCOMING_FACT_PRIORITY.indexOf(a.type), pb = UPCOMING_FACT_PRIORITY.indexOf(b.type);
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    });
    return available[0];
  }

  // Kommentator: berichtet AUSSCHLIESSLICH über das gerade abgeschlossene
  // Spiel (Anforderung 6). Ergebnis-Impact (Tabelle/Titel, zentral aus
  // shared.js) hat Vorrang; ohne Impact ist der Direktvergleich der einzige
  // erlaubte Rückfall-Fakt (Anforderung 12) - niemals allgemeine
  // Preview-Fakten des kommenden Spiels. Gibt zusätzlich zurück, welcher(r)
  // Fakt-Typ verbraucht wurde, damit der Moderator ihn nicht doppelt nennt.
  function buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, prevSeeds }) {
    const { home, away } = speechNames(homeName, awayName);
    const winnerRaw = homeScore > awayScore ? homeName : awayName;
    const loserRaw = homeScore > awayScore ? awayName : homeName;
    const winner = speechName(winnerRaw), loser = speechName(loserRaw);
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    const margin = winnerScore - loserScore;
    const usedFactTypes = new Set();
    const names = getSpeakerNames();

    let line = `${pick(OPENERS_RESULT)} ${stadium || "Stadion"}! `;
    // UI-Konvention: Heim@Auswärts = zweiter Name ist das Heimteam.
    // Gesprochen wird daher zuerst der Auswärtsname, dann der Heimname.
    line += `Endstand: ${away} ${awayScore}, ${home} ${homeScore}. `;
    line += fmt(pick(WIN_PHRASES), { winner, loser }) + " ";

    if (margin <= 3) line += pick(CLOSE_GAME_PHRASES) + " ";
    else if (margin >= 21) line += pick(BLOWOUT_PHRASES) + " ";

    let impactUsed = false;
    try {
      const impacts = MB.getAnnouncerResultImpacts(history, state, winnerRaw, loserRaw, prevSeeds) || [];
      if (impacts.length) {
        line += impacts[0].text + " ";
        usedFactTypes.add(impacts[0].type);
        impactUsed = true;
      }
    } catch (e) {}

    if (!impactUsed) {
      try {
        const typed = MB.pickFlavourFactsTyped(history, state, homeName, awayName) || [];
        const directCompare = typed.find((f) => f.type === "directComparison");
        if (directCompare) {
          line += naturalizeFact(directCompare.text) + " ";
          usedFactTypes.add("directComparison");
        }
      } catch (e) {}
    }

    line += pick(HANDOFF_OUT_PHRASES)(names);

    return { line: line.trim(), usedFactTypes };
  }

  // Moderator: berichtet AUSSCHLIESSLICH über die kommende Partie
  // (Anforderung 8) und nennt mindestens einen Preview-Fakt, dessen Typ noch
  // nicht vom Kommentator verwendet wurde (Anforderungen 9, 15, 16). Übergibt
  // nie zurück an den Kommentator (Anforderung 20) und endet ohne generische
  // Schlussfloskel (Anforderung 22).
  function buildUpcomingLine({ state, history, homeName, awayName, time, stadium, stadiumPreposition, usedFactTypes }) {
    const { home, away } = speechNames(homeName, awayName);
    const names = getSpeakerNames();
    const used = usedFactTypes || new Set();

    const handoffIn = pick(HANDOFF_IN_PHRASES)(names);
    let line = handoffIn ? `${handoffIn} ` : "";
    // UI-Konvention: erster Name = Auswärts, zweiter Name = Heim.
    line += `Als Nächstes spielt ${away} bei ${home}`;
    if (time) line += `, Anpfiff ${time} Uhr`;
    if (stadium) line += `, ${stadiumPhrase(stadium, stadiumPreposition)}`;
    line += ". ";

    const fact = pickUpcomingFact(history, state, homeName, awayName, used);
    if (fact) {
      line += naturalizeFact(fact.text) + " ";
      used.add(fact.type);
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
      // Dezimalzahlen für deutsche TTS (Anforderungen 23/24) - NUR hier im
      // Sprachpfad, nicht in shared.js/one(), damit die sichtbaren
      // Insight-Texte auf index.html/live.html/music.js unverändert bleiben.
      // Reihenfolge wichtig: erst "42.0" -> "42" (keine unnötige
      // Nachkommastelle bei Ganzzahlen), danach erst verbleibende echte
      // Dezimalzahlen "17.5" -> "17,5" (Komma statt Punkt).
      .replace(/(\d+)\.0\b/g, "$1")
      .replace(/(\d+)\.(\d+)/g, "$1,$2")
      .replace(/(\d)\.(\s|$)/g, "$1 .$2")   // "17." -> "17 ." (Ordinalzahl-Fix)
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
  async function _announceNow({ state, history, homeName, awayName, homeScore, awayScore, stadium, stadiumPreposition, upcoming, prevSeeds }) {
    if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) return;

    const settings = getTtsSettings();
    const twoVoiceMode = settings.provider === "elevenlabs" && settings.voiceIdResult && settings.voiceIdPreview;

    // buildResultLine() enthält bereits die Übergabe ans Ende der Zeile
    // (Anforderung 20: nur der Kommentator übergibt) und liefert zurück,
    // welche(r) Fakt-Typ(en) dabei verbraucht wurden, damit der Moderator
    // nicht denselben Typ nochmal nennt (Anforderungen 3, 15, 16).
    const { line: resultLine, usedFactTypes } = buildResultLine({ state, history, homeName, awayName, homeScore, awayScore, stadium, prevSeeds });
    const nextMatch = (upcoming || [])[0] || null;

    const buildPreviewLine = () => buildUpcomingLine({
      state, history, homeName: nextMatch.homeName, awayName: nextMatch.awayName,
      time: nextMatch.time, stadium: nextMatch.stadium, stadiumPreposition: nextMatch.stadiumPreposition,
      usedFactTypes,
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
    announce, announceSong, announceTournamentStart, speak, warmupVoices, buildResultLine, buildUpcomingLine,
    setPreferredVoice, getGermanVoiceCandidates, sanitizeForSpeech,
    getTtsSettings, setTtsSettings, fetchElevenLabsVoices, speakElevenLabs, speakSmart,
    speakSequence, fetchElevenLabsAudioUrl, playAudioUrl, speechName, speechNames,
    getSpeakerNames, setSpeakerNames, classifyFact, naturalizeFact, stadiumPhrase, pickUpcomingFact,
  };
})(window);
