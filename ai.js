/* =========================================================================
   MADDEN BOWL — KI-TEXTE (ai.js)   [VORBEREITET, NOCH NICHT ANGEBUNDEN]
   -------------------------------------------------------------------------
   Optionale Anbindung an openrouter.ai (OpenAI-kompatible Chat-API), damit
   Blog-, Ansage- und Song-Texte später aus den vorhandenen Fakten formuliert
   werden können. Aktuell ruft noch KEIN Beitrag dieses Modul auf — es gibt nur
   die Einstellungen (index.html → Einstellungen → KI-Texte) und den Test.

   Grundprinzipien:
   - Komplett optional: ohne aktivierten Schalter, Key und Modell passiert
     nichts, und writeText() liefert sofort den Fallback-Text zurück.
   - Die bisherigen Vorlagen-Texte bleiben der Fallback — bei Fehler, Timeout
     oder unbrauchbarer Antwort erscheint der Beitrag wie bisher.
   - Die KI bekommt nur die übergebenen Fakten und darf nichts dazuerfinden.
   - Einstellungen (inkl. API-Key) liegen NUR in localStorage dieses Browsers
     (wie bei ElevenLabs/Imgflip), nicht in Supabase. Am besten bei
     OpenRouter ein Ausgabenlimit für den Key setzen.

   Spätere Nutzung (Beispiel):
     const r = await MB.AI.writeText({
       task: "Schreibe den Power-Ranking-Beitrag.",
       facts: "Tabelle: ...; letzte Ergebnisse: ...",
       fallbackText: article.body,
     });
     article.body = r.text;   // r.usedAi sagt, ob die KI geantwortet hat
   ========================================================================= */
(function (global) {
  "use strict";

  const SETTINGS_KEY = "mb_ai_settings";
  const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  const DEFAULTS = { enabled: false, apiKey: "", model: "" };

  const BASE_SYSTEM = [
    "Du schreibst Texte für den „Madden Bowl“, ein Madden-NFL-Turnier unter Freunden.",
    "Schreibe auf Deutsch, locker, mit trockenem Humor und ohne Übertreibung.",
    "Verwende ausschließlich die Fakten, die dir übergeben werden. Erfinde keine Spielstände, Namen, Zahlen, Teams oder Ereignisse.",
    "Wenn eine Information fehlt, lass sie weg, statt zu raten.",
    "Gib nur den fertigen Text zurück, ohne Vorrede, ohne Markdown-Überschriften und ohne Anführungszeichen um den ganzen Text.",
  ].join(" ");

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function setSettings(patch) {
    const next = { ...getSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function isConfigured() {
    const s = getSettings();
    return !!(s.enabled && s.apiKey && s.model);
  }

  // Rohaufruf der Chat-API. Wirft bei Fehlern. Zum Testen auch ohne
  // aktivierten Schalter nutzbar (opts.force).
  async function chat({ system, user, maxTokens = 700, timeoutMs = 25000, force = false }) {
    const s = getSettings();
    if (!s.apiKey || !s.model) throw new Error("API-Key oder Modell fehlt.");
    if (!force && !s.enabled) throw new Error("KI-Texte sind nicht aktiviert.");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + s.apiKey,
          "HTTP-Referer": location.origin,
          "X-Title": "Madden Bowl",
        },
        body: JSON.stringify({
          model: s.model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system || BASE_SYSTEM },
            { role: "user", content: user },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error && data.error.message) || ("HTTP " + res.status));
      const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text || !String(text).trim()) throw new Error("Leere Antwort.");
      return String(text).trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // Hauptfunktion für spätere Einbindung: liefert IMMER einen Text.
  // { text, usedAi, error? } — bei jedem Problem kommt fallbackText zurück.
  async function writeText({ task, facts, fallbackText, style, maxTokens }) {
    if (!isConfigured()) return { text: fallbackText, usedAi: false };
    try {
      const user = [
        "Aufgabe: " + task,
        style ? "Stil: " + style : "",
        "Fakten (nur diese verwenden):",
        typeof facts === "string" ? facts : JSON.stringify(facts, null, 2),
      ].filter(Boolean).join("\n\n");
      const text = await chat({ user, maxTokens });
      return { text, usedAi: true };
    } catch (e) {
      console.warn("KI-Text fehlgeschlagen, Fallback wird genutzt:", e);
      return { text: fallbackText, usedAi: false, error: e.message };
    }
  }

  // Verbindungstest (ignoriert den Aktiv-Schalter)
  async function test() {
    return chat({
      user: "Schreibe einen einzigen kurzen Satz zur Eröffnung des Madden Bowl. Fakten: Es spielen acht Freunde, die Saison beginnt heute.",
      maxTokens: 120,
      force: true,
    });
  }

  global.MB = global.MB || {};
  global.MB.AI = { getSettings, setSettings, isConfigured, chat, writeText, test };
})(window);
