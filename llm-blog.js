/* =========================================================================
   KI-TEXTE FÜR ALLE BLOG-BEITRÄGE (OpenRouter)
   -------------------------------------------------------------------------
   Ergänzt llm-test.js (das nur die Schein-Korrelationen kann) um ALLE
   automatischen Beitragsarten: Kickoff, Rückblick, Power Ranking, Rekorde,
   Song, Finale, Champion, Porträts, Abschluss, Toilet Bowl.

   Ablauf je Beitrag:
     1. Der normale Baustein-Generator (blog.js) liefert den Artikel wie bisher.
     2. factsFor() sammelt ALLE verwertbaren Fakten dazu (Tabelle, Bilanzen,
        Badges, Titelhistorie, Playoff-Status, letzte Ergebnisse, Direktvergleich,
        Rekord-Daten ...).
     3. rewrite() lässt ein Modell daraus einen Text im Stil von 11FREUNDE
        schreiben. Der Baustein-Text dient als Ausgangstext/Sicherheitsnetz.
     4. Prüfung: erfundene Zahlen, undefined, Markdown, falsche Länge -> der
        Baustein-Text bleibt (nichts geht kaputt, wenn die KI Unsinn liefert).

   PRODUKTIV: MB.Blog.pushArticle() ruft maybeRewrite() auf. Welche Beitragsart
   von welchem Modell geschrieben wird, steht in getSettings() (localStorage,
   Panel "KI-Texte für den Blog" in admin.html). Standard: alles AUS.

   API (window.MB.LlmBlog):
     KINDS, SYSTEM_PROMPT, getSettings(), saveSettings(s)
     factsFor(article, ctx)          -> String mit allen Fakten
     buildMessages(article, ctx)     -> { messages }
     generate({ key, model, article, ctx, temperature, maxTokens, signal })
     maybeRewrite(article)           -> Promise<article> (produktiv, mit Fallback)
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};
  const MB = global.MB;

  const ENDPOINT = "https://openrouter.ai/api/v1";
  const SETTINGS_KEY = "mb_llm_blog_settings";
  const KEY_STORAGE = "mb_openrouter_key"; // gleicher Key wie im Spurious-Test

  // Beitragsarten, die KI-geschrieben werden können (spurious/manual bewusst nicht).
  const KINDS = {
    kickoff:       { label: "Kickoff (Turnierstart)",      words: "100 bis 170" },
    retrospective: { label: "Rückblick auf die Saisons",   words: "150 bis 250" },
    progress:      { label: "Power Ranking",               words: "130 bis 210" },
    record:        { label: "Rekord-Beitrag",              words: "60 bis 120" },
    song:          { label: "Song-Beitrag",                words: "40 bis 80" },
    finals:        { label: "Finale (Vorbericht)",         words: "100 bis 170" },
    champion:      { label: "Champion",                    words: "120 bis 200" },
    portrait:      { label: "Spielerporträt",              words: "110 bis 180" },
    wrapup:        { label: "Siegerehrung & Rückblick",    words: "200 bis 320" },
    toiletbowl:    { label: "Toilet Bowl",                 words: "100 bis 170" },
  };

  // ------------------------------------------------------------ Prompt
  const SYSTEM_PROMPT = [
    "Du schreibst Beiträge für den Blog des \"Altima Bowl\", eines privaten Madden-NFL-Turniers unter Freunden (Gruppe von Freunden, die gegeneinander an der Konsole spielen).",
    "",
    "STIL: Schreibe wie ein Redakteur des Fußballmagazins 11FREUNDE (nur der Ton, keine Textstellen übernehmen):",
    "- Lakonisch, ironisch, liebevoll-bissig. Understatement statt Pathos. Der Witz entsteht aus trockener Beobachtung, nicht aus Ausrufezeichen.",
    "- Kurze, pointierte Sätze, gern ein trockener Nachsatz. Wechsel zwischen knappen und etwas längeren Sätzen.",
    "- Fußball-, Stadion- und Kabinen-Vokabular ist erlaubt (Kreisliga, Trainerstuhl, Mannschaftsabend), aber sparsam und treffend.",
    "- Neckend gegenüber den Spielern, aber nie verletzend. Sticheln ja, demütigen nein. Respekt vor echten Leistungen.",
    "- Keine Reporter-Floskeln (\"Wahnsinn\", \"unfassbar\"), kein Marketing-Ton, keine Emojis, kein Markdown, keine Aufzählungen.",
    "",
    "REGELN",
    "- Verwende AUSSCHLIESSLICH die gelieferten Fakten. Erfinde keine Zahlen, Ergebnisse, Spielzüge, Zitate, Verletzungen oder Vorgeschichten.",
    "  Zahlen (Ergebnisse, Bilanzen, Prozente, Jahre, Titel) nur so nennen, wie sie in den Fakten stehen.",
    "- Spielernamen und Teamnamen exakt wie angegeben. Jeder Spieler wird pro Text möglichst nur einmal als Hauptfigur eingeführt, dann gern mit Pronomen.",
    "- Der AUSGANGSTEXT zeigt, welche Aussagen der Beitrag mindestens enthalten soll. Übernimm seine wichtigen Inhalte und Pointen, formuliere aber frei und lebendiger.",
    "- Nichts erklären, was der Witz ist. Kein \"Fazit:\", keine Meta-Kommentare zum Schreiben, keine Anrede an den Leser außer, wenn es passt.",
    "- Sprache: Deutsch. Absätze durch eine Leerzeile trennen.",
    "",
    "AUSGABEFORMAT (genau einhalten)",
    "Erste Zeile: \"TITEL: \" gefolgt von einer kurzen, treffenden Schlagzeile (max. 80 Zeichen).",
    "Danach eine Leerzeile und der Fließtext. Nichts davor, nichts danach.",
  ].join("\n");

  // ------------------------------------------------------------ Einstellungen
  function defaultSettings() {
    const kinds = {};
    Object.keys(KINDS).forEach((k) => { kinds[k] = { enabled: false, model: "" }; });
    return { defaultModel: "openrouter/free", temperature: 0.8, timeoutSec: 40, kinds };
  }
  function getSettings() {
    const d = defaultSettings();
    try {
      const raw = global.localStorage && global.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      const out = { ...d, ...s, kinds: { ...d.kinds } };
      Object.keys(d.kinds).forEach((k) => { out.kinds[k] = { ...d.kinds[k], ...((s.kinds || {})[k] || {}) }; });
      return out;
    } catch (e) { return d; }
  }
  function saveSettings(s) { try { global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* egal */ } }
  function getKey() { try { return (global.localStorage && global.localStorage.getItem(KEY_STORAGE)) || ""; } catch (e) { return ""; } }

  // ------------------------------------------------------------ Fakten
  const norm = (n) => (MB.normName ? MB.normName(n) : String(n || "").trim());
  const teamFull = (t) => (MB.Announcer && MB.Announcer.teamFullName ? MB.Announcer.teamFullName(t) : t);
  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } };
  const plural = (n, a, b) => `${n} ${Number(n) === 1 ? a : b}`;

  function playerLine(p, seeds) {
    const lost = (p.played || 0) - (p.wins || 0);
    const seed = seeds && seeds.get && seeds.get(p.name);
    return `${seed ? "Seed " + seed + ": " : ""}${p.name}${p.team ? " (" + teamFull(p.team) + ")" : ""} – ${plural(p.wins || 0, "Sieg", "Siege")}, ${plural(lost, "Niederlage", "Niederlagen")}, Punktedifferenz ${(p.diff || 0) > 0 ? "+" : ""}${p.diff || 0}${p.pointsFor != null ? ", " + p.pointsFor + " erzielte Punkte" : ""}`;
  }

  function badgeText(b) {
    if (!b) return "";
    const t = [];
    if (b.isRookie) t.push("Neuling (erstes Turnier)");
    else if (b.seasonsPlayed) t.push(`${plural(b.seasonsPlayed, "frühere Saison", "frühere Saisons")} dabei`);
    if (b.isDefendingChampion) t.push("amtierender Champion");
    if (b.titles) t.push(plural(b.titles, "Titel", "Titel") + " insgesamt");
    if (b.isSoleRecordChampion) t.push("alleiniger Rekordchampion");
    if (b.isRunnerUpLastSeason) t.push("Vizemeister der letzten Saison");
    if (b.finalsWithoutTitleCount) t.push(`${plural(b.finalsWithoutTitleCount, "verlorenes Finale", "verlorene Finals")} ohne je einen Titel`);
    if (b.isToiletBowlLastSeason) t.push("Letzter der vorigen Saison");
    if (b.isAllTimeHighScoreHolder) t.push(`hält den Allzeit-Highscore (${b.allTimeHighScore} Punkte)`);
    return t.join(", ");
  }

  function directFacts(history, state, a, b) {
    return safe(() => (MB.pickFlavourFactsTyped(history, state, a, b) || [])
      .filter((f) => f.type === "directComparison" || f.type === "averagePoints" || f.type === "rivalry" || f.type === "revenge")
      .map((f) => f.text), []);
  }

  function tournamentFacts(state, history) {
    const lines = [];
    if (!state) return lines;
    const players = (state.players || []).filter((p) => p && p.name);
    const seeds = safe(() => MB.getGroupSeedsFinal(state), null);
    const names = players.map((p) => p.name);
    const doneGroup = (state.matches || []).filter((m) => m.s1 != null && m.s2 != null).length;
    const totalGroup = (state.matches || []).length;
    lines.push(`Turnier ${safe(() => state.config.year, "") || ""}: ${players.length} Spieler, Gruppenphase ${doneGroup} von ${totalGroup} Spielen gespielt.`);

    const sorted = [...players].sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.diff || 0) - (a.diff || 0));
    lines.push("TABELLE (Gruppenphase):");
    sorted.forEach((p, i) => lines.push(`  ${i + 1}. ${playerLine(p, seeds)}`));

    const badges = safe(() => MB.computeRingIntroBadges(history, names), new Map());
    const bl = names.map((n) => { const t = badgeText(badges.get(String(n).trim().toLowerCase())); return t ? `  ${n}: ${t}` : ""; }).filter(Boolean);
    if (bl.length) { lines.push("HISTORIE DER SPIELER:"); lines.push(...bl); }

    const recent = safe(() => MB.getCurrentMatchesNormalized(state).slice(-4), []);
    if (recent.length) {
      lines.push("LETZTE ERGEBNISSE (neueste zuletzt):");
      recent.forEach((m) => lines.push(`  ${m.homePlayer || m.homeName} ${m.homeScore} : ${m.awayScore} ${m.awayPlayer || m.awayName}`));
    }

    const po = (state.playoffMatches || []).filter((m) => m.p1 && m.p2 && m.p2.id !== -1);
    if (po.length && global.MB.Blog && global.MB.Blog.computePlayoffStatus) {
      const st = safe(() => global.MB.Blog.computePlayoffStatus(state), null);
      if (st) {
        lines.push("PLAYOFF-STATUS (Double Elimination):");
        if (st.upper.length) lines.push(`  Upper Bracket, noch ungeschlagen: ${st.upper.join(", ")}`);
        if (st.lower.length) lines.push(`  Lower Bracket, nächste Niederlage = Aus: ${st.lower.join(", ")}`);
        if (st.out.length) lines.push(`  Ausgeschieden: ${st.out.join(", ")}`);
      }
      const played = po.filter((m) => MB.isFinished(m));
      played.slice(-4).forEach((m) => lines.push(`  Playoff (${m.phase}): ${m.p1.name} ${m.s1} : ${m.s2} ${m.p2.name}`));
    }
    return lines;
  }

  function pairFacts(state, history, a, b) {
    const f = directFacts(history, state, a, b);
    return f.length ? ["DUELL-FAKTEN " + a + " gegen " + b + ":", ...f.map((x) => "  " + x)] : [];
  }

  function recordFacts(rec) {
    if (!rec) return [];
    const L = [];
    const typeLabel = safe(() => MB.Records.RECORD_TYPES[rec.type].label, rec.type);
    L.push(`REKORD: ${typeLabel}${(rec.alsoTypes || []).length ? " (zugleich: neuer Allzeit-Highscore)" : ""}`);
    if (rec.player) L.push(`  Spieler: ${rec.player}${rec.opponent ? ", Gegner: " + rec.opponent : ""}`);
    if (rec.winnerScore != null) L.push(`  Ergebnis: ${rec.winnerScore}:${rec.loserScore} (Differenz ${rec.winnerScore - rec.loserScore}, zusammen ${rec.winnerScore + rec.loserScore} Punkte)`);
    ["value", "highScore", "streak", "previous", "previousHolder", "previousValue", "margin", "total"].forEach((k) => {
      if (rec[k] != null && typeof rec[k] !== "object") L.push(`  ${k}: ${rec[k]}`);
    });
    return L;
  }

  // Alle verwertbaren Fakten als Text. article.kind/article.data steuern, was relevant ist.
  function factsFor(article, ctx) {
    ctx = ctx || {};
    const { state, history, record } = ctx;
    const L = [];
    const kind = article.kind;
    const d = article.data || {};
    try {
      if (kind === "record" || kind === "finals" || kind === "champion") {
        const rec = record || ctx.record;
        L.push(...recordFacts(rec));
        if (rec && rec.player && rec.opponent) L.push(...pairFacts(state, history, rec.player, rec.opponent));
        const names = [rec && rec.player, rec && rec.opponent].filter(Boolean);
        const badges = safe(() => MB.computeRingIntroBadges(history, names), new Map());
        names.forEach((n) => { const t = badgeText(badges.get(String(n).trim().toLowerCase())); if (t) L.push(`  ${n}: ${t}`); });
        if (state) L.push("", ...tournamentFacts(state, history));
      } else if (kind === "portrait") {
        const group = d.group;
        const ps = (d.players || []);
        L.push(`PORTRÄT-GRUPPE: ${group || "?"} – Spieler: ${ps.join(", ")}`);
        if (state) L.push("", ...tournamentFacts(state, history));
      } else if (kind === "wrapup" || kind === "toiletbowl") {
        if (d.champion) L.push(`Champion: ${d.champion}, Vizemeister: ${d.runnerUp}`);
        if (d.winner) L.push(`Toilet-Bowl-Sieger (landet in der Endtabelle ganz unten, erhält den ersten Draft-Pick im nächsten Jahr): ${d.winner}; Verlierer (klettert in der Tabelle nach oben): ${d.loser}`);
        const gf = state && safe(() => MB.getPlayoffMatch(state, "gf"), null);
        if (gf && MB.isFinished(gf)) L.push(`Finale: ${gf.p1.name} ${gf.s1} : ${gf.s2} ${gf.p2.name}`);
        const tb = state && safe(() => MB.getPlayoffMatch(state, "tb"), null);
        if (tb && MB.isFinished(tb)) L.push(`Toilet Bowl: ${tb.p1.name} ${tb.s1} : ${tb.s2} ${tb.p2.name}`);
        if (state) L.push("", ...tournamentFacts(state, history));
        if (d.champion && d.runnerUp) L.push(...pairFacts(state, history, d.champion, d.runnerUp));
        if (article.media_url) L.push("Zum Beitrag gehört ein Song (wird unter dem Text eingebettet). Er darf kurz erwähnt werden.");
      } else if (kind === "song") {
        L.push(`SONG-MEILENSTEIN: ${ctx.milestone || d.milestone || "?"} (zu diesem Moment wurde ein Song erzeugt; er ist unter dem Text eingebettet)`);
        if (state) L.push("", ...tournamentFacts(state, history));
      } else {
        // kickoff, retrospective, progress, ...
        if (state) L.push(...tournamentFacts(state, history));
        if (kind === "progress" && (ctx.finishedCount || d.finishedCount)) L.push(`Stand: nach ${ctx.finishedCount || d.finishedCount} gespielten Partien`);
        if (kind === "retrospective" && ctx.seasons) {
          L.push("SAISON-RÜCKBLICK (Platz 1 bis 3 je Saison):");
          ctx.seasons.slice(-12).forEach((s) => {
            const st = (s.standings || []).filter((x) => Number(x.rank) <= 3).sort((a, b) => a.rank - b.rank);
            L.push(`  ${s.season}: ${st.map((x) => x.rank + ". " + x.name).join(", ")}`);
          });
        }
      }
    } catch (e) { L.push("(Fakten teilweise nicht ermittelbar: " + e.message + ")"); }
    return L.join("\n");
  }

  // ------------------------------------------------------------ Nachrichten
  function stripHtml(s) {
    return String(s == null ? "" : s).replace(/<br\s*\/?>/gi, "\n").replace(/<\/?strong>/gi, "").replace(/<[^>]+>/g, "").trim();
  }

  function buildMessages(article, ctx) {
    const meta = KINDS[article.kind] || { label: article.kind, words: "100 bis 200" };
    const facts = article.facts || factsFor(article, ctx);
    const user = [
      `BEITRAGSART: ${meta.label}`,
      `LÄNGE: etwa ${meta.words} Wörter`,
      "",
      "FAKTEN (nur diese darfst du verwenden):",
      facts || "(keine weiteren Fakten)",
      "",
      "AUSGANGSTEXT (so würde das System den Beitrag heute ausgeben; Inhalt und Pointen übernehmen, aber lebendiger und im 11FREUNDE-Ton neu schreiben):",
      article.title ? `Überschrift: ${stripHtml(article.title)}` : "",
      stripHtml(article.body),
      "",
      "Schreibe jetzt den Beitrag.",
    ].filter((l) => l !== null);
    return { messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user.join("\n") }], facts };
  }

  function cleanOutput(raw) {
    let t = String(raw || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
    let title = "";
    const m = t.match(/^\s*TITEL:\s*(.+)$/im);
    if (m) { title = m[1].trim(); t = t.replace(m[0], "").trim(); }
    return { title, body: t };
  }

  // Sicherheitsprüfung der KI-Ausgabe. Gibt eine Liste von Problemen zurück (leer = ok).
  function validate(out, article, facts) {
    const problems = [];
    const body = out.body || "";
    const words = body.split(/\s+/).filter(Boolean).length;
    const meta = KINDS[article.kind];
    if (words < 25) problems.push("Text zu kurz");
    if (meta) {
      const max = Number(String(meta.words).split(" bis ")[1]) || 300;
      if (words > max * 1.6) problems.push("Text deutlich zu lang");
    }
    if (/\b(undefined|NaN)\b/.test(body)) problems.push("enthält undefined/NaN");
    if (/^\s*[-*•]\s/m.test(body)) problems.push("Aufzählung statt Fließtext");
    // Erfundene Zahlen: jede Zahl im Text muss in Fakten oder Ausgangstext vorkommen.
    const known = (String(facts || "") + " " + stripHtml(article.body) + " " + stripHtml(article.title)).replace(/\s+/g, " ");
    const nums = body.match(/\d+(?:[.,]\d+)?/g) || [];
    const bad = [...new Set(nums.filter((n) => !new RegExp("(^|[^\\d])" + n.replace(/[.,]/g, "[.,]") + "([^\\d]|$)").test(known)))];
    if (bad.length) problems.push("Zahlen nicht in den Fakten: " + bad.slice(0, 5).join(", "));
    // Spielernamen: mindestens ein bekannter Name muss vorkommen, wenn der Ausgangstext Namen hatte.
    const orig = stripHtml(article.body);
    const nameHits = ((state_names(article) || []).filter((n) => orig.includes(n)));
    if (nameHits.length && !nameHits.some((n) => body.includes(n))) problems.push("keiner der Spielernamen kommt vor");
    return problems;
  }
  function state_names(article) { return (article && article._names) || []; }

  // ------------------------------------------------------------ Aufruf
  async function callModel({ key, model, messages, temperature, maxTokens, signal }) {
    const res = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST", signal,
      headers: {
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": (global.location && global.location.origin) || "https://maddenbowl.local", "X-Title": "Altima Bowl Blog",
      },
      body: JSON.stringify({ model, messages, temperature: temperature != null ? temperature : 0.8, max_tokens: maxTokens || 1200 }),
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* kein JSON */ }
    if (!res.ok) throw new Error(`${model}: ${(json && json.error && (json.error.message || JSON.stringify(json.error))) || "HTTP " + res.status}`);
    const raw = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!raw) throw new Error(`${model}: leere Antwort`);
    return { raw, model: (json && json.model) || model, usage: json && json.usage };
  }

  // Test-/Einzelaufruf: liefert Text + Prüfergebnis, wirft bei API-Fehlern.
  async function generate({ key, model, article, ctx, temperature, maxTokens, signal }) {
    if (!key) throw new Error("Kein OpenRouter-API-Key angegeben.");
    const { messages, facts } = buildMessages(article, ctx);
    const r = await callModel({ key, model, messages, temperature, maxTokens, signal });
    const out = cleanOutput(r.raw);
    return { ...out, raw: r.raw, model: r.model, usage: r.usage, facts, problems: validate(out, article, facts) };
  }

  // Produktiv: nur wenn für die Beitragsart aktiviert. Bei JEDEM Problem bleibt der Baustein-Text.
  async function maybeRewrite(article) {
    if (!article || !KINDS[article.kind]) return article;
    const s = getSettings();
    const cfg = s.kinds[article.kind];
    const key = getKey();
    if (!cfg || !cfg.enabled || !key) return article;
    const model = cfg.model || s.defaultModel || "openrouter/free";
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), (s.timeoutSec || 40) * 1000) : null;
    try {
      const out = await generate({ key, model, article, ctx: article._ctx, temperature: s.temperature, signal: ctrl && ctrl.signal });
      if (out.problems.length) {
        console.warn(`KI-Text (${article.kind}, ${model}) verworfen:`, out.problems);
        return { ...article, data: { ...(article.data || {}), llmRejected: out.problems.join("; ") } };
      }
      return { ...article, title: out.title || article.title, body: out.body.replace(/\n{3,}/g, "\n\n"), data: { ...(article.data || {}), writer: out.model } };
    } catch (e) {
      console.warn(`KI-Text (${article.kind}, ${model}) fehlgeschlagen, Baustein-Text bleibt:`, e);
      return article;
    } finally { if (timer) clearTimeout(timer); }
  }

  global.MB.LlmBlog = { KINDS, SYSTEM_PROMPT, getSettings, saveSettings, getKey, factsFor, buildMessages, generate, maybeRewrite, validate, cleanOutput, defaultSettings };
})(window);
