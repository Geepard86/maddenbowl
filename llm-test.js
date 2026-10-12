/* =========================================================================
   LLM-TEST FÜR BLOG-TEXTE (OpenRouter, kostenlose :free-Modelle)
   -------------------------------------------------------------------------
   Nimmt die Spurious-Correlation-Kandidaten (Tyler-Vigen-Stil) samt dem
   Text, den das System heute aus den handgeschriebenen Bausteinen erzeugt,
   und lässt ein Free-Modell daraus einen ausführlicheren Beitrag schreiben:
   Ton wie tylervigen.com/spurious (trocken-pseudowissenschaftlich), nur
   deutlich ausführlicher in der Begründung der "Zusammenhänge".

   Rein ein Test-Werkzeug: nichts wird veröffentlicht oder gespeichert
   (außer dem API-Key im localStorage des Browsers, wenn gewünscht).

   API (window.MB.LlmTest):
     fetchFreeModels()           -> [{id, name, context, score}] (live von OpenRouter, nach Eignung sortiert)
     buildMessages(candidate)    -> { messages, currentText }
     generate({ key, model, candidate, temperature, maxTokens }) -> { title, body, raw, model }
     SYSTEM_PROMPT               -> der Stil-Prompt (zum Nachlesen/Anpassen)
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};

  const ENDPOINT = "https://openrouter.ai/api/v1";

  // ------------------------------------------------------------ Prompt
  const SYSTEM_PROMPT = [
    "Du schreibst Beiträge für den Blog des \"Altima Bowl\", eines privaten Madden-NFL-Turniers unter Freunden.",
    "Die Beiträge sind Schein-Korrelationen im Stil von Tyler Vigens \"Spurious Correlations\" (tylervigen.com/spurious):",
    "Eine Altima-Bowl-Kennzahl und eine völlig sachfremde deutsche Jahresstatistik verlaufen auffallend gleich.",
    "",
    "TON UND STIL",
    "- Trocken, sachlich, pseudo-wissenschaftlich und mit stoischer Ernsthaftigkeit. Der Witz entsteht allein dadurch, dass etwas Absurdes",
    "  im Tonfall einer seriösen Analyse berichtet wird. Keine Ausrufezeichen-Comedy, keine Emojis, kein Markdown, keine Aufzählungen.",
    "- Gegenüber Tyler Vigens meist nur zwei bis drei Sätzen soll der Text DEUTLICH AUSFÜHRLICHER begründen, WARUM die beiden Größen",
    "  zusammenhängen. Entwickle dafür eine in sich logische, aber abwegige Kausalkette aus drei bis fünf Schritten mit konkreten",
    "  Zwischengliedern, Mechanismen und kleinen absurden Details (wer reagiert worauf, was folgt daraus, warum wirkt es sich auf die",
    "  andere Zahl aus). Jeder Schritt klingt für sich plausibel; erst das Gesamtbild ist unsinnig.",
    "- Erkläre den Witz nie und sage nie, dass es ein Scherz oder eine Schein-Korrelation sei.",
    "",
    "INHALT UND REGELN",
    "- Nenne den Korrelationskoeffizienten r und die konkreten Zahlen/Jahre aus den gelieferten Daten. Erfinde KEINE weiteren Zahlen,",
    "  Studien, Institute oder Zitate; verwende nur die Quellen und Werte aus der Eingabe.",
    "- Richtung beachten: positives r = beide steigen/fallen gemeinsam, negatives r = gegenläufig. Die Zahlen aus den Daten sind maßgeblich:",
    "  Widerspricht der Ausgangstext der tatsächlichen Entwicklung der Werte (z.B. \"wächst\", obwohl beide Werte fallen), richte dich nach den Daten.",
    "- Spielernamen exakt wie angegeben. Neckend, aber nie verletzend oder beleidigend. Nichts über reale Personen außerhalb der Gruppe erfinden.",
    "- Der vorhandene Ausgangstext dient als Grundlage: übernimm seine Idee und die Pointen, schreibe ihn aber im beschriebenen Stil",
    "  neu und mit deutlich ausführlicherer Begründung. Du darfst eigene Zwischenglieder ergänzen.",
    "- Länge: etwa 180 bis 300 Wörter, drei bis vier Absätze, Absätze durch eine Leerzeile getrennt. Sprache: Deutsch.",
    "- Letzter Absatz: nüchternes Fazit im selben ernsten Ton (kein \"Korrelation ist nicht Kausalität\"-Spruch).",
    "",
    "AUSGABEFORMAT (genau einhalten)",
    "Erste Zeile: \"TITEL: \" gefolgt von einer kurzen Schlagzeile im Format \"<Altima-Bowl-Größe> vs. <deutsche Statistik>\".",
    "Danach eine Leerzeile und der Fließtext. Keine Einleitung, keine Erklärung, nichts außer Titel und Text.",
  ].join("\n");

  const fmt = (v) => (typeof v === "number" ? (Math.abs(v) >= 1000 ? v.toLocaleString("de-DE") : String(Math.round(v * 1000) / 1000).replace(".", ",")) : String(v));

  function currentTextOf(candidate) {
    let story = candidate && candidate.story;
    if (!story && global.MB.Spurious && global.MB.Spurious.buildSpuriousStory) { try { story = global.MB.Spurious.buildSpuriousStory(candidate); } catch (e) { /* kein Baustein */ } }
    if (!story) return { title: "", body: "(kein handgeschriebener Baustein vorhanden — schreibe den Text komplett neu)" };
    return { title: story.title || "", body: String(story.body || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim() };
  }

  function buildMessages(candidate) {
    const c = candidate;
    const years = c.years || [];
    const series = (vals) => years.map((y, i) => `${y}: ${fmt(vals[i])}`).join(" · ");
    const dir = c.r >= 0 ? "positiv (beide Werte entwickeln sich gleichgerichtet)" : "negativ (die Werte entwickeln sich gegenläufig)";
    const cur = currentTextOf(c);
    const lines = [
      "Schreibe den Beitrag zu folgender Schein-Korrelation.",
      "",
      `ALTIMA-BOWL-KENNZAHL: ${c.mbLabel}${c.mbUnit ? " (" + c.mbUnit + ")" : ""}${c.isPlayer ? ` — bezieht sich auf den Spieler ${c.player}` : ""}`,
      `Werte je Jahr: ${series(c.mbValues || [])}`,
      "",
      `DEUTSCHE STATISTIK: ${c.germanName}${c.germanUnit ? " (" + c.germanUnit + ")" : ""}`,
      `Quelle: ${c.germanSource || "unbekannt"}`,
      `Werte je Jahr: ${series(c.germanValues || [])}`,
      "",
      `KORRELATION: r = ${String(Math.round(c.r * 1000) / 1000).replace(".", ",")}, ${dir}`,
      `Zeitraum: ${years.join(", ")}`,
      "",
      "AKTUELLER AUSGANGSTEXT (so würde das System den Beitrag heute ausgeben):",
      cur.title ? `Überschrift: ${cur.title}` : "",
      cur.body,
      "",
      "Schreibe daraus jetzt den neuen, ausführlicheren Beitrag nach den Vorgaben.",
    ].filter((l) => l !== null);
    return { messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: lines.join("\n") }], currentText: cur };
  }

  // ------------------------------------------------------------ Modelle
  // Eignung für deutschen Fließtext mit Humor: große, mehrsprachige Instruct-Modelle bevorzugen;
  // Coder-, Vision-, Mini- und reine Reasoning-Modelle (liefern Gedankengänge) abwerten.
  function scoreModel(m) {
    const id = String(m.id || "").toLowerCase(), name = String(m.name || "").toLowerCase(), s = id + " " + name;
    let score = 0;
    const ctx = Number(m.context_length) || 0;
    score += Math.min(ctx, 262144) / 262144 * 10;
    if (/(llama[-_ ]?(3\.[1-3]|4).*(70b|405b|maverick|scout)|maverick|405b)/.test(s)) score += 40;
    if (/(qwen).*(235b|122b|72b|max|3[-._]?(next|235))|qwen3[-_ ]?(next|235)/.test(s)) score += 36;
    if (/(nemotron).*(ultra|super|253b|120b)/.test(s)) score += 34;
    if (/(gemma[-_ ]?\d.*(27b|31b))/.test(s)) score += 32;
    if (/(deepseek).*(chat|v3|v4)/.test(s) && !/(r1|reason)/.test(s)) score += 30;
    if (/(mistral).*(large|small|medium)/.test(s)) score += 28;
    if (/(glm|kimi|minimax|hy3|hunyuan)/.test(s)) score += 24;
    const size = s.match(/(\d{1,3})b\b/); if (size) { const b = Number(size[1]); score += b >= 100 ? 20 : b >= 60 ? 16 : b >= 25 ? 8 : b <= 12 ? -22 : 0; }
    if (/(coder|code|devstral|laguna)/.test(s)) score -= 40;
    if (/(vl\b|vision|image|ocr|audio|embed|guard|safeguard)/.test(s)) score -= 40;
    if (/(r1|reason|thinking|think\b|qwq)/.test(s)) score -= 14;
    if (/(mini|tiny|nano|lite|small-?\d)/.test(s) && !/mistral/.test(s)) score -= 10;
    return score;
  }

  async function fetchFreeModels() {
    const res = await fetch(`${ENDPOINT}/models`);
    if (!res.ok) throw new Error(`OpenRouter-Modellliste nicht ladbar (HTTP ${res.status})`);
    const json = await res.json();
    const free = (json.data || []).filter((m) => m && m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 && /text/.test(JSON.stringify((m.architecture && m.architecture.output_modalities) || ["text"])));
    const list = free.map((m) => ({ id: m.id, name: m.name || m.id, context: Number(m.context_length) || 0, score: scoreModel(m) }));
    list.sort((a, b) => b.score - a.score);
    return list;
  }

  // ------------------------------------------------------------ Aufruf
  function cleanOutput(raw) {
    let t = String(raw || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
    let title = "";
    const m = t.match(/^\s*TITEL:\s*(.+)$/im);
    if (m) { title = m[1].trim(); t = t.replace(m[0], "").trim(); }
    return { title, body: t };
  }

  async function generate({ key, model, candidate, temperature, maxTokens, signal }) {
    if (!key) throw new Error("Kein OpenRouter-API-Key angegeben.");
    const { messages, currentText } = buildMessages(candidate);
    const res = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST", signal,
      headers: {
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": (global.location && global.location.origin) || "https://maddenbowl.local", "X-Title": "Altima Bowl Blog-Test",
      },
      body: JSON.stringify({ model, messages, temperature: temperature != null ? temperature : 0.85, max_tokens: maxTokens || 1100 }),
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* kein JSON */ }
    if (!res.ok) {
      const msg = (json && json.error && (json.error.message || JSON.stringify(json.error))) || `HTTP ${res.status}`;
      throw new Error(`${model}: ${msg}`);
    }
    const raw = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!raw) throw new Error(`${model}: leere Antwort`);
    const out = cleanOutput(raw);
    return { ...out, raw, model: (json && json.model) || model, currentText, usage: json && json.usage };
  }

  global.MB.LlmTest = { fetchFreeModels, buildMessages, generate, SYSTEM_PROMPT, scoreModel, cleanOutput };
})(window);
