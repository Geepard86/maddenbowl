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
  const SETTINGS_KEY = "mb_llm_blog_settings";      // lokaler Cache der DB-Einstellungen
  const DB_KEY = "llm_blog_settings";               // app_config-Schlüssel in Supabase
  const KEY_STORAGE = "mb_openrouter_key";          // API-Key bleibt bewusst NUR im Browser
  const LOG_KEY = "mb_llm_log";
  const MODELS_CACHE_KEY = "mb_llm_models_cache";
  // Grobe Token-Annahme je Beitrag für die Kostenschätzung (Prompt+Fakten / Text inkl. etwas Reserve)
  const EST_IN_TOKENS = 3500, EST_OUT_TOKENS = 900;

  // Beitragsarten, die KI-geschrieben werden können (manual bewusst nicht).
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
    spurious:      { label: "Spurious Correlation",        words: "180 bis 300" },
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
    "  Spielergebnisse schreibst du mit Doppelpunkt (24:17), Bilanzen IMMER mit Bindestrich (3-1 = Siege-Niederlagen) — nie umgekehrt.",
    "  Rechne nichts aus (keine Summen, Differenzen, Schnitte), was nicht schon in den Fakten steht.",
    "- Interview-Antworten von Spielern nur wörtlich und in Anführungszeichen zitieren – nie erfinden oder verändern.",
    "- Spielernamen und Teamnamen exakt wie angegeben. Jeder Spieler wird pro Text möglichst nur einmal als Hauptfigur eingeführt, dann gern mit Pronomen.",
    "- Der AUSGANGSTEXT zeigt, welche Aussagen der Beitrag mindestens enthalten soll. Übernimm seine wichtigen Inhalte und Pointen, formuliere aber frei und lebendiger.",
    "- Nichts erklären, was der Witz ist. Kein \"Fazit:\", keine Meta-Kommentare zum Schreiben, keine Anrede an den Leser außer, wenn es passt.",
    "- Sprache: Deutsch. Absätze durch eine Leerzeile trennen.",
    "",
    "AUSGABEFORMAT (genau einhalten)",
    "Erste Zeile: \"TITEL: \" gefolgt von einer kurzen, treffenden Schlagzeile (max. 80 Zeichen).",
    "Danach eine Leerzeile und der Fließtext. Nichts davor, nichts danach.",
  ].join("\n");

  // Standard-Prompt je Beitragsart (System-Prompt). Spurious nutzt den Tyler-Vigen-Prompt.
  function defaultPrompt(kind) {
    if (kind === "spurious") return (MB.LlmTest && MB.LlmTest.SYSTEM_PROMPT) || SYSTEM_PROMPT;
    return SYSTEM_PROMPT;
  }

  // ------------------------------------------------------------ Einstellungen
  // Liegen in Supabase (app_config "llm_blog_settings"), damit sie geräteübergreifend gelten;
  // localStorage ist nur Cache. Gespeichert werden nur ABWEICHENDE Prompts (prompts[kind]).
  //   modelMode: "auto"   -> geeignetstes verfügbares Modell + zweitgeeignetstes als Fallback
  //              "manual" -> primaryModel + fallbackModel
  //   allowPaid / maxCentPerArticle: ob (und bis zu welchen geschätzten Kosten) Auto auch Bezahl-Modelle nimmt
  function defaultSettings() {
    const kinds = {};
    Object.keys(KINDS).forEach((k) => { kinds[k] = { enabled: false, model: "" }; });
    return { modelMode: "auto", primaryModel: "", fallbackModel: "", allowPaid: false, maxCentPerArticle: 2,
      temperature: 0.8, timeoutSec: 120, kinds, prompts: {} };
  }
  function mergeSettings(s) {
    const d = defaultSettings();
    if (!s || typeof s !== "object") return d;
    const out = { ...d, ...s, kinds: { ...d.kinds }, prompts: { ...(s.prompts || {}) } };
    Object.keys(d.kinds).forEach((k) => { out.kinds[k] = { ...d.kinds[k], ...((s.kinds || {})[k] || {}) }; });
    // Altlast: früheres "defaultModel" -> manuelles Primärmodell
    if (s.defaultModel && !s.primaryModel && s.defaultModel !== "openrouter/free") { out.primaryModel = s.defaultModel; }
    delete out.defaultModel;
    if (!out.timeoutSec || out.timeoutSec < 60) out.timeoutSec = 120;
    return out;
  }
  let cache = null, loadedFromDb = false;
  function getSettings() {
    if (cache) return mergeSettings(cache);
    try { const raw = global.localStorage && global.localStorage.getItem(SETTINGS_KEY); cache = raw ? JSON.parse(raw) : null; } catch (e) { cache = null; }
    return mergeSettings(cache);
  }
  async function loadSettings(force) {
    if (loadedFromDb && !force) return getSettings();
    try {
      const raw = MB.getAppConfig ? await MB.getAppConfig(DB_KEY) : null;
      if (raw) { cache = JSON.parse(raw); try { global.localStorage.setItem(SETTINGS_KEY, raw); } catch (e) { /* egal */ } }
      loadedFromDb = true;
    } catch (e) { console.warn("KI-Einstellungen aus der DB nicht ladbar, nutze lokalen Stand:", e); }
    return getSettings();
  }
  async function saveSettings(s) {
    const clean = mergeSettings(s);
    // nur geänderte Prompts speichern
    Object.keys(clean.prompts).forEach((k) => { if (!clean.prompts[k] || clean.prompts[k].trim() === defaultPrompt(k).trim()) delete clean.prompts[k]; });
    const raw = JSON.stringify(clean);
    cache = clean;
    try { global.localStorage.setItem(SETTINGS_KEY, raw); } catch (e) { /* egal */ }
    if (MB.setAppConfig) await MB.setAppConfig(DB_KEY, raw);
    loadedFromDb = true;
    return clean;
  }
  function getPrompt(kind, s) { s = s || getSettings(); return (s.prompts && s.prompts[kind]) || defaultPrompt(kind); }
  function getKey() { try { return (global.localStorage && global.localStorage.getItem(KEY_STORAGE)) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { global.localStorage.setItem(KEY_STORAGE, String(k || "").trim()); } catch (e) { /* egal */ } }

  // ------------------------------------------------------------ Protokoll (sichtbar im Admin)
  function getLog() { try { return JSON.parse(global.localStorage.getItem(LOG_KEY) || "[]"); } catch (e) { return []; } }
  function addLog(entry) {
    const log = getLog(); log.unshift({ at: new Date().toISOString(), ...entry });
    try { global.localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 60))); } catch (e) { /* egal */ }
    try { global.dispatchEvent(new CustomEvent("mb-llm-log")); } catch (e) { /* egal */ }
  }
  function clearLog() { try { global.localStorage.removeItem(LOG_KEY); } catch (e) { /* egal */ } }

  // ------------------------------------------------------------ Modelle (frei + bezahlt)
  // Eignung für deutschen Fließtext mit Humor. Basis: MB.LlmTest.scoreModel (Free-Modelle),
  // ergänzt um bekannte starke Bezahl-Modelle.
  function scoreModel(m) {
    let score = (MB.LlmTest && MB.LlmTest.scoreModel) ? MB.LlmTest.scoreModel(m) : 0;
    const s = (String(m.id || "") + " " + String(m.name || "")).toLowerCase();
    if (/anthropic\/claude.*(opus|sonnet)/.test(s)) score += 55;
    else if (/anthropic\/claude.*haiku/.test(s)) score += 38;
    if (/openai\/gpt-(5|4\.1|4o)(?!.*(nano|audio|search|realtime|image))/.test(s)) score += /mini/.test(s) ? 34 : 48;
    if (/google\/gemini.*(pro)/.test(s)) score += 46; else if (/google\/gemini.*flash/.test(s) && !/lite|image/.test(s)) score += 36;
    if (/x-ai\/grok/.test(s) && !/code|vision|image/.test(s)) score += 30;
    if (/(:free)$/.test(String(m.id || ""))) score += 0;
    return score;
  }
  function costCents(m, inTok, outTok) {
    const p = Number(m.promptPrice) || 0, c = Number(m.completionPrice) || 0;
    return ((inTok || EST_IN_TOKENS) * p + (outTok || EST_OUT_TOKENS) * c) * 100; // USD -> US-Cent
  }
  function fmtCost(cents) {
    if (!cents) return "kostenlos";
    if (cents < 0.1) return "< 0,1 ct";
    return "≈ " + (cents < 10 ? cents.toFixed(1) : Math.round(cents)).toString().replace(".", ",") + " ct";
  }
  // Liste aller Textmodelle (öffentlicher Endpunkt, kein Key nötig), 6 h gecacht.
  async function fetchModels(force) {
    if (!force) {
      try {
        const c = JSON.parse(global.localStorage.getItem(MODELS_CACHE_KEY) || "null");
        if (c && Date.now() - c.at < 6 * 3600 * 1000 && Array.isArray(c.list) && c.list.length) return c.list;
      } catch (e) { /* neu laden */ }
    }
    const res = await fetch(`${ENDPOINT}/models`);
    if (!res.ok) throw new Error(`OpenRouter-Modellliste nicht ladbar (HTTP ${res.status})`);
    const json = await res.json();
    const list = (json.data || []).filter((m) => {
      if (!m || !m.pricing) return false;
      const out = JSON.stringify((m.architecture && m.architecture.output_modalities) || ["text"]);
      return /text/.test(out) && !/image|audio/.test(out) && Number(m.pricing.prompt) >= 0 && Number(m.pricing.completion) >= 0;
    }).map((m) => {
      const o = { id: m.id, name: m.name || m.id, context: Number(m.context_length) || 0,
        promptPrice: Number(m.pricing.prompt) || 0, completionPrice: Number(m.pricing.completion) || 0 };
      o.free = o.promptPrice === 0 && o.completionPrice === 0;
      o.score = scoreModel({ ...m, ...o });
      o.cents = costCents(o);
      return o;
    }).filter((m) => m.id !== "openrouter/auto");
    list.sort((a, b) => b.score - a.score);
    try { global.localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ at: Date.now(), list })); } catch (e) { /* egal */ }
    return list;
  }
  // Auto-Auswahl: die zwei geeignetsten zulässigen Modelle.
  function pickAutoModels(list, s) {
    const ok = (list || []).filter((m) => m.free || (s.allowPaid && m.cents <= (Number(s.maxCentPerArticle) || 0)));
    const out = ok.slice(0, 2).map((m) => m.id);
    if (!out.length) out.push("openrouter/free");
    else if (out.length < 2) out.push("openrouter/free");
    return out;
  }
  // Welche Modelle (in Reihenfolge) für eine Beitragsart probiert werden.
  async function resolveModels(kind, s) {
    s = s || getSettings();
    const override = s.kinds[kind] && s.kinds[kind].model;
    let chain = [];
    if (s.modelMode === "manual") chain = [s.primaryModel, s.fallbackModel];
    else { let list = []; try { list = await fetchModels(); } catch (e) { /* ohne Liste */ } chain = pickAutoModels(list, s); }
    if (override) chain.unshift(override);
    chain = chain.filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
    return chain.length ? chain : ["openrouter/free"];
  }

  // ------------------------------------------------------------ Fakten
  const norm = (n) => (MB.normName ? MB.normName(n) : String(n || "").trim());
  const teamFull = (t) => (MB.Announcer && MB.Announcer.teamFullName ? MB.Announcer.teamFullName(t) : t);
  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } };
  const plural = (n, a, b) => `${n} ${Number(n) === 1 ? a : b}`;

  function playerLine(p, seeds) {
    const lost = (p.played || 0) - (p.wins || 0);
    const seed = seeds && seeds.get && seeds.get(p.name);
    return `${seed ? "Seed " + seed + ": " : ""}${p.name}${p.team ? " (" + teamFull(p.team) + ")" : ""} – Bilanz ${p.wins || 0}-${lost} (${plural(p.wins || 0, "Sieg", "Siege")}, ${plural(lost, "Niederlage", "Niederlagen")}), Punktedifferenz ${(p.diff || 0) > 0 ? "+" : ""}${p.diff || 0}${p.pointsFor != null ? ", " + p.pointsFor + " erzielte Punkte" : ""}`;
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
        // Vergangenheit der Porträtierten (Titel, Saisons, Vorjahresplatz)
        const badges = safe(() => MB.computeRingIntroBadges(history, ps), new Map());
        ps.forEach((n) => { const t = badgeText(badges.get(String(n).trim().toLowerCase())); if (t) L.push(`  ${n}: ${t}`); });
        if (group === "champion") {
          // Erscheint ganz früh im Turnier: KEIN Turnierverlauf, nur die Vorgeschichte
          L.push("", "WICHTIG: Das Turnier hat gerade erst begonnen. Gehe NICHT auf Ergebnisse, Tabellenstand oder den bisherigen Turnierverlauf ein – nur auf die Vorgeschichte und die Rolle als Gejagter.");
        } else if (state) L.push("", ...tournamentFacts(state, history));
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
        if (d.spurious && d.spurious.a) {
          L.push("", `STATISTIK-ECKE (Schein-Korrelation): „${d.spurious.a}“ (Altima Bowl) hängt angeblich mit „${d.spurious.b}“ (echte Welt) zusammen. Diesen Abschnitt mit „Aus der Statistik-Ecke:“ beginnen und den (natürlich absurden) Zusammenhang humorvoll und ruhig ausführlicher herleiten – mit einer erfundenen, augenzwinkernden Kausalkette, KEINE Kennzahlen (kein r, kein Koeffizient, keine Prozentwerte).`);
        }
        if (Array.isArray(d.interviews) && d.interviews.length) {
          L.push("", "INTERVIEWS (Rudi hat Spieler befragt – Antworten WÖRTLICH in Anführungszeichen zitieren, nichts hinzudichten, nichts umformulieren; leere Antwort = „Kein Kommentar“):");
          d.interviews.forEach((iv) => (iv.questions || []).forEach((q, i) => L.push(`  ${iv.name} – Frage: ${q} | Antwort: ${iv.answers && iv.answers[i] ? iv.answers[i] : "(kein Kommentar)"}`)));
        }
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

  // Bild-Platzhalter [[bild:N]] (blog.html setzt dort Meme/Chart ein)
  const MARK_RE = /\[\[(?:bild:\d+|tabelle)\]\]/g;
  function markersOf(body) { return [...new Set(String(body || "").match(MARK_RE) || [])]; }
  function markerHint(article) {
    const m = markersOf(article.body);
    if (!m.length) return "";
    return `\nBILDER: Im Ausgangstext stehen Platzhalter (${m.join(", ")}) für Bilder (Memes bzw. Diagramme) bzw. die Tabelle ([[tabelle]]). Übernimm JEDEN Platzhalter unverändert als eigene Zeile an die Stelle deines Textes, an der das jeweilige Bild thematisch passt (direkt nach dem Absatz, der es erwähnt).`;
  }
  // Fehlende Platzhalter ans Ende hängen, doppelte entfernen
  function keepMarkers(newBody, article) {
    let out = String(newBody || "");
    const seen = new Set();
    out = out.replace(MARK_RE, (m) => (seen.has(m) ? "" : (seen.add(m), m)));
    markersOf(article.body).forEach((m) => { if (!seen.has(m)) out += "\n\n" + m; });
    return out;
  }

  function buildMessages(article, ctx, settings) {
    const sys = getPrompt(article.kind, settings);
    // Spurious: eigene Eingabe mit Werten/Jahren/r aus dem Kandidaten (llm-test.js)
    if (article.kind === "spurious") {
      const cand = article._candidate;
      let user;
      if (cand && MB.LlmTest && MB.LlmTest.buildMessages) user = MB.LlmTest.buildMessages(cand).messages[1].content;
      else user = ["Schreibe den Beitrag zu folgender Schein-Korrelation.", "", "AUSGANGSTEXT:", stripHtml(article.title), stripHtml(article.body)].join("\n");
      user += markerHint(article);
      return { messages: [{ role: "system", content: sys }, { role: "user", content: user }], facts: user };
    }
    const meta = KINDS[article.kind] || { label: article.kind, words: "100 bis 200" };
    const facts = article.facts || factsFor(article, ctx);
    const user = [
      `BEITRAGSART: ${meta.label}`,
      `LÄNGE: etwa ${meta.words} Wörter`,
      "",
      "FAKTEN (nur diese darfst du verwenden):",
      facts || "(keine weiteren Fakten)",
      "",
      "AUSGANGSTEXT (so würde das System den Beitrag heute ausgeben; Inhalt und Pointen übernehmen, aber lebendiger neu schreiben):",
      article.title ? `Überschrift: ${stripHtml(article.title)}` : "",
      stripHtml(article.body),
      "",
      markerHint(article),
      "Schreibe jetzt den Beitrag.",
    ].filter((l) => l !== null);
    return { messages: [{ role: "system", content: sys }, { role: "user", content: user.join("\n") }], facts };
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
    // Erfundene Zahlen: jede Zahl im Text sollte in Fakten oder Ausgangstext vorkommen.
    // Tolerant: kleine Zahlen (0–12, z.B. "zwei Spiele", "3. Platz") werden ignoriert;
    // verworfen wird bei einem erfundenen Ergebnis ("27:24") oder ab zwei unbekannten Zahlen.
    const known = (String(facts || "") + " " + stripHtml(article.body) + " " + stripHtml(article.title)).replace(/\s+/g, " ");
    const isKnown = (n) => new RegExp("(^|[^\\d])" + n.replace(/[.,]/g, "[.,]") + "([^\\d]|$)").test(known);
    const nums = body.match(/\d+(?:[.,]\d+)?/g) || [];
    const bad = [...new Set(nums.filter((n) => !isKnown(n) && !(Number(n.replace(",", ".")) <= 12 && !/[.,]/.test(n))))];
    // Ergebnis "a:b" gilt als bekannt, wenn es (auch umgedreht, "b:a") oder als
    // Bilanz "a-b" in den Fakten steht — Modelle schreiben Bilanzen gern mit Doppelpunkt.
    const knownPair = (a, b) => [`${a}\\s*[:\\-–]\\s*${b}`, `${b}\\s*[:\\-–]\\s*${a}`].some((re) => new RegExp("(^|[^\\d])" + re + "([^\\d]|$)").test(known));
    const badScores = (body.match(/\b\d{1,3}\s*:\s*\d{1,3}\b/g) || []).filter((sc) => { const [a, b] = sc.split(/\s*:\s*/); return !knownPair(a, b); });
    if (badScores.length) problems.push("erfundenes Ergebnis: " + [...new Set(badScores)].slice(0, 3).join(", "));
    else if (bad.length >= 2) problems.push("Zahlen nicht in den Fakten: " + bad.slice(0, 5).join(", "));
    // Spielernamen: mindestens ein bekannter Name muss vorkommen, wenn der Ausgangstext Namen hatte.
    const orig = stripHtml(article.body);
    const nameHits = ((state_names(article) || []).filter((n) => orig.includes(n)));
    if (article.kind !== "spurious" && nameHits.length && !nameHits.some((n) => body.includes(n))) problems.push("keiner der Spielernamen kommt vor");
    return problems;
  }
  function state_names(article) { return (article && article._names) || []; }

  // ------------------------------------------------------------ Aufruf
  // Hinweis: Reasoning-Modelle verbrauchen sonst ihr max_tokens-Budget fürs "Nachdenken"
  // und liefern dann eine LEERE Antwort -> großzügiges Budget + niedriger Reasoning-Aufwand.
  async function callModel({ key, model, messages, temperature, maxTokens, signal }) {
    const res = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST", signal,
      headers: {
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": (global.location && global.location.origin) || "https://maddenbowl.local", "X-Title": "Altima Bowl Blog",
      },
      body: JSON.stringify({ model, messages, temperature: temperature != null ? temperature : 0.8, max_tokens: maxTokens || 4000,
        reasoning: { effort: "low", exclude: true } }),
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* kein JSON */ }
    if (!res.ok) {
      const err = new Error(`${model}: ${(json && json.error && (json.error.message || JSON.stringify(json.error))) || "HTTP " + res.status}`);
      err.status = res.status; throw err;
    }
    if (json && json.error) { const err = new Error(`${model}: ${json.error.message || JSON.stringify(json.error)}`); err.status = json.error.code || 0; throw err; }
    const raw = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!raw) { const err = new Error(`${model}: leere Antwort${json && json.choices && json.choices[0] && json.choices[0].finish_reason ? " (" + json.choices[0].finish_reason + ")" : ""}`); err.status = "empty"; throw err; }
    return { raw, model: (json && json.model) || model, usage: json && json.usage };
  }

  // Zweiter, „sicherer“ Durchgang nach einem Verwerfen: nur den Baustein-Text
  // stilistisch überarbeiten, ohne neue Fakten — das Modell muss nichts erfinden.
  function buildPolishMessages(article, ctx, settings) {
    const base = buildMessages(article, ctx, settings);
    const user = [
      "Hier ist ein fertiger Blog-Beitrag. Überarbeite ihn sprachlich: natürlicher, lebendiger, mit etwas mehr Witz.",
      "Du darfst Satzbau, Übergänge und Reihenfolge der Absätze variieren.",
      "STRENG: Übernimm alle Namen, Zahlen, Ergebnisse und Bilanzen exakt so, wie sie dastehen. Füge KEINE neuen Zahlen, Ergebnisse oder Fakten hinzu und lass keine weg.",
      "Format wie gewohnt: erste Zeile „TITEL: …“, dann der Text.",
      markerHint(article),
      "",
      `TITEL: ${stripHtml(article.title)}`,
      stripHtml(article.body),
    ].join("\n");
    return { messages: [base.messages[0], { role: "user", content: user }], facts: base.facts };
  }

  // Einzelaufruf mit Timeout: liefert Text + Prüfergebnis, wirft bei API-Fehlern.
  async function generate({ key, model, article, ctx, temperature, maxTokens, signal, timeoutSec, settings, polish }) {
    if (!key) throw new Error("Kein OpenRouter-API-Key angegeben.");
    const { messages, facts } = polish ? buildPolishMessages(article, ctx, settings) : buildMessages(article, ctx, settings);
    const ctrl = !signal && typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), (timeoutSec || 120) * 1000) : null;
    try {
      const r = await callModel({ key, model, messages, temperature, maxTokens, signal: signal || (ctrl && ctrl.signal) });
      const out = cleanOutput(r.raw);
      return { ...out, raw: r.raw, model: r.model, usage: r.usage, facts, prompt: messages[1].content, problems: validate(out, article, facts) };
    } catch (e) {
      if (e && e.name === "AbortError") { const t = new Error(`${model}: Zeitüberschreitung nach ${timeoutSec || 120} s`); t.status = "timeout"; throw t; }
      throw e;
    } finally { if (timer) clearTimeout(timer); }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Probiert die Modellkette durch (je Modell 1 Wiederholung bei Überlast/leerer Antwort).
  async function generateWithFallback({ article, ctx, settings, onAttempt }) {
    const s = settings || getSettings();
    const key = getKey();
    if (!key) throw new Error("Kein OpenRouter-API-Key in diesem Browser.");
    const chain = await resolveModels(article.kind, s);
    const attempts = [];
    for (const model of chain) {
      for (let tryNo = 0; tryNo < 2; tryNo++) {
        const t0 = Date.now();
        try {
          const out = await generate({ key, model, article, ctx, temperature: s.temperature, timeoutSec: s.timeoutSec, settings: s });
          const a = { model: out.model, seconds: (Date.now() - t0) / 1000, problems: out.problems, usage: out.usage };
          attempts.push(a); if (onAttempt) onAttempt(a, out);
          if (!out.problems.length) return { out, attempts, chain };
          // Inhaltlich verworfen -> zweiter Durchgang mit demselben Modell: Baustein-Text nur überarbeiten
          const t1 = Date.now();
          try {
            const pol = await generate({ key, model, article, ctx, temperature: Math.min(s.temperature, 0.7), timeoutSec: s.timeoutSec, settings: s, polish: true });
            const b = { model: pol.model + " (Überarbeitung)", seconds: (Date.now() - t1) / 1000, problems: pol.problems, usage: pol.usage };
            attempts.push(b); if (onAttempt) onAttempt(b, pol);
            if (!pol.problems.length) return { out: pol, attempts, chain };
          } catch (e2) {
            const b = { model: model + " (Überarbeitung)", seconds: (Date.now() - t1) / 1000, error: e2.message, status: e2.status };
            attempts.push(b); if (onAttempt) onAttempt(b, null);
          }
          break; // auch die Überarbeitung verworfen -> nächstes Modell
        } catch (e) {
          const a = { model, seconds: (Date.now() - t0) / 1000, error: e.message, status: e.status };
          attempts.push(a); if (onAttempt) onAttempt(a, null);
          const retry = e.status === 429 || e.status === "empty" || (Number(e.status) >= 500);
          if (!retry || tryNo === 1) break;
          await sleep(e.status === 429 ? 15000 : 5000);
        }
      }
    }
    return { out: null, attempts, chain };
  }

  // Produktiv: nur wenn für die Beitragsart aktiviert. Bei JEDEM Problem bleibt der Baustein-Text.
  async function maybeRewrite(article) {
    if (!article || !KINDS[article.kind]) return article;
    const s = await loadSettings();
    const cfg = s.kinds[article.kind];
    if (!cfg || !cfg.enabled) return article;
    const label = KINDS[article.kind].label;
    if (!getKey()) {
      addLog({ kind: article.kind, label, title: stripHtml(article.title), status: "kein Key", detail: "In diesem Browser ist kein OpenRouter-Key hinterlegt — Baustein-Text veröffentlicht." });
      return { ...article, data: { ...(article.data || {}), llm: { status: "no-key" } } };
    }
    try {
      const { out, attempts, chain } = await generateWithFallback({ article, ctx: article._ctx, settings: s });
      const tried = attempts.map((a) => `${a.model} (${a.seconds.toFixed(0)} s): ${a.error || (a.problems && a.problems.length ? "verworfen – " + a.problems.join("; ") : "ok")}`).join(" | ");
      if (!out) {
        addLog({ kind: article.kind, label, title: stripHtml(article.title), status: "Baustein", detail: tried || "keine Modelle", chain });
        return { ...article, data: { ...(article.data || {}), llm: { status: "fallback", attempts: tried }, llmRejected: tried } };
      }
      addLog({ kind: article.kind, label, title: out.title || stripHtml(article.title), status: "KI", model: out.model, detail: tried, chain });
      let title = out.title || article.title;
      // Spurious: Schlagzeile "X vs. Y" behalten, wenn das Modell sie nicht liefert
      if (article.kind === "spurious" && !/ vs\.? /i.test(title)) title = article.title;
      return { ...article, title, body: keepMarkers(out.body, article).replace(/\n{3,}/g, "\n\n"), data: { ...(article.data || {}), writer: out.model, llm: { status: "ok", model: out.model } } };
    } catch (e) {
      addLog({ kind: article.kind, label, title: stripHtml(article.title), status: "Fehler", detail: e.message });
      console.warn(`KI-Text (${article.kind}) fehlgeschlagen, Baustein-Text bleibt:`, e);
      return article;
    }
  }

  global.MB.LlmBlog = {
    KINDS, SYSTEM_PROMPT, defaultPrompt, getPrompt,
    getSettings, loadSettings, saveSettings, defaultSettings,
    getKey, setKey, getLog, clearLog,
    fetchModels, pickAutoModels, resolveModels, costCents, fmtCost, scoreModel, EST_IN_TOKENS, EST_OUT_TOKENS,
    factsFor, buildMessages, buildPolishMessages, generate, generateWithFallback, maybeRewrite, validate, cleanOutput,
  };
})(window);
