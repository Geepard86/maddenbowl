/* =========================================================================
   MADDEN BOWL — MUSIC (music.js)
   -------------------------------------------------------------------------
   Generiert an fünf Meilensteinen (Regular Season beendet, erstes
   Ausscheiden, Toilet Bowl entschieden, Finals stehen fest, Turniersieger
   steht fest) einen Hip-Hop/Rap-Song über die echten Turnier-Fakten via
   ElevenLabs Music API — manuell ausgelöst (kein Auto-Trigger, da Musik
   pro Minute deutlich mehr Credits kostet als Sprache).

   Jeder Meilenstein hat einen eigenen "Modus", der die Textrichtung prägt
   (siehe MODE_DIRECTIVES): "recap" (reimende Zusammenfassung des bisherigen
   Turnierverlaufs inkl. Tabelle), "hype" (Hype-Anthem), "brag" (Sieger
   rappt großspurig aus der Ich-Perspektive) und "diss" (Disstrack für die
   Toilet-Bowl-Verlierer). Vor dem eigentlichen Generieren lassen sich pro
   Song Stil, die mitgegebenen Fakten (Text), Sprache, Dauer und ein
   Testmodus (kein API-Call, keine Credits) anpassen — siehe
   generateAndStoreSong().

   Nutzt denselben ElevenLabs-Key wie announcer.js (MB.Announcer.getTtsSettings()),
   damit nicht zwei getrennte Keys gepflegt werden müssen.

   Voraussetzung: shared.js ist vorher geladen (window.MB), außerdem die
   Supabase-Storage-Bucket "mb-songs" (siehe supabase-schema-update-2.sql).
   ========================================================================= */

(function (global) {
  "use strict";

  // Bewusst lockere Stil-Tags statt starrer Produktionsvorgaben — das
  // Modell darf sich innerhalb des Tags kreativ austoben. Eine Auswahl
  // aktuell gängiger Hip-Hop/Rap-Spielarten, damit nicht jeder Song gleich
  // klingt. Frei für JEDEN Meilenstein wählbar — MILESTONE_META unten legt
  // nur eine sinnvolle Vorauswahl (defaultStyleId) pro Anlass fest.
  const STYLE_POOL = [
    { id: "trap", label: "Modern Trap", tag: "modern trap hip-hop with hard 808 bass and crisp hi-hats, confident swaggering flow" },
    { id: "drill", label: "Drill", tag: "dark moody drill rap with sliding 808s and tense strings, aggressive commanding delivery" },
    { id: "boombap", label: "Boom Bap / Old-School", tag: "classic boom bap hip-hop with dusty sampled drums and a soulful horn loop, golden-era lyrical flow" },
    { id: "conscious", label: "Conscious / Lyrical", tag: "lyrical conscious rap over a laid-back jazzy instrumental, storytelling flow" },
    { id: "cloud", label: "Cloud Rap / Melodic", tag: "melodic cloud rap with a dreamy autotuned hook and atmospheric synths" },
    { id: "rage", label: "Rage Rap", tag: "high-energy rage rap with distorted 808s and hyped shouted ad-libs" },
    { id: "dmv", label: "DMV-Style", tag: "DMV-style rap with a bouncy go-go-influenced rhythm and a catchy call-and-response hook" },
    { id: "pluggnb", label: "PluggnB", tag: "PluggnB style with airy plugg synths and R&B-tinged melodic rap vocals" },
  ];

  // Sprachen, unter denen der Songtext verfasst/vorgetragen werden soll.
  // "English" bleibt Standard/Vorauswahl (id "en"), lässt sich vor dem
  // Generieren aber frei umstellen.
  const LANGUAGE_POOL = [
    { id: "en", label: "Englisch", name: "English" },
    { id: "de", label: "Deutsch", name: "German" },
    { id: "es", label: "Spanisch", name: "Spanish" },
    { id: "fr", label: "Französisch", name: "French" },
    { id: "it", label: "Italienisch", name: "Italian" },
    { id: "pt", label: "Portugiesisch", name: "Portuguese" },
  ];
  const DEFAULT_LANGUAGE_ID = "en";

  // Meilenstein-Metadaten: Anzeigename, Text-Modus (siehe MODE_DIRECTIVES)
  // und eine Stil-Vorauswahl, die zum Anlass passt. Der Modus entscheidet,
  // wie die Fakten unten in ein Songkonzept übersetzt werden.
  const MILESTONE_META = {
    regularSeason: { label: "Regular Season beendet", mode: "recap", defaultStyleId: "conscious" },
    firstElimination: { label: "Erstes Ausscheiden", mode: "hype", defaultStyleId: "drill" },
    toiletBowl: { label: "Toilet Bowl entschieden", mode: "diss", defaultStyleId: "drill" },
    finals: { label: "Finals stehen fest", mode: "hype", defaultStyleId: "trap" },
    champion: { label: "Turniersieger steht fest", mode: "brag", defaultStyleId: "rage" },
  };
  const MILESTONE_ORDER = ["regularSeason", "firstElimination", "toiletBowl", "finals", "champion"];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pickStyle(forcedId, milestone) {
    if (forcedId) {
      const found = STYLE_POOL.find((s) => s.id === forcedId);
      if (found) return found;
    }
    const defaultId = MILESTONE_META[milestone] && MILESTONE_META[milestone].defaultStyleId;
    if (defaultId) {
      const found = STYLE_POOL.find((s) => s.id === defaultId);
      if (found) return found;
    }
    return pick(STYLE_POOL);
  }

  function pickLanguage(forcedId) {
    return LANGUAGE_POOL.find((l) => l.id === forcedId) || LANGUAGE_POOL.find((l) => l.id === DEFAULT_LANGUAGE_ID);
  }

  // ======================================================================
  // FAKTEN PRO MEILENSTEIN
  // ======================================================================
  function biggestGroupWin(state) {
    let best = null;
    (state.matches || []).forEach((m) => {
      if (m.s1 == null || m.s2 == null) return;
      const margin = Math.abs(m.s1 - m.s2);
      if (!best || margin > best.margin) {
        const p1 = state.players[m.p1], p2 = state.players[m.p2];
        const winner = m.s1 > m.s2 ? p1 : p2, loser = m.s1 > m.s2 ? p2 : p1;
        const winnerScore = Math.max(m.s1, m.s2), loserScore = Math.min(m.s1, m.s2);
        best = { margin, winner, loser, winnerScore, loserScore };
      }
    });
    return best;
  }

  // Reimbare Kurzfassung der Abschlusstabelle nach der Regular Season
  // (Seed-Reihenfolge, Team, Bilanz) — Grundlage für den "recap"-Song.
  function buildStandingsTable(state, seedByName) {
    const ranked = [...state.players].sort(
      (a, b) => (seedByName.get(a.name) || 999) - (seedByName.get(b.name) || 999)
    );
    return ranked
      .map((p) => `#${seedByName.get(p.name) || "?"} ${p.name} (${p.team}) with a record of ${p.wins || 0}-${(p.played || 0) - (p.wins || 0)}`)
      .join("; ");
  }

  function buildFacts(milestone, state, history) {
    const seedByName = MB.getGroupSeedsFinal(state);

    if (milestone === "regularSeason") {
      const table = buildStandingsTable(state, seedByName);
      const best = biggestGroupWin(state);
      let facts = `The regular season of a fantasy football tournament called the Madden Bowl just wrapped up. ` +
        `Here is the complete final regular-season standings table, from best to worst seed: ${table}. `;
      if (best) facts += `The most dominant win of the season was ${best.winner.name} crushing ${best.loser.name} ${best.winnerScore}-${best.loserScore}. `;
      facts += `The playoffs are about to begin, seeded exactly in this order.`;
      return facts;
    }

    if (milestone === "firstElimination") {
      const lb1 = MB.getPlayoffMatch(state, "lb1"), lb2 = MB.getPlayoffMatch(state, "lb2");
      const loser = MB.loserOf(lb1) || MB.loserOf(lb2);
      const eliminatedMatch = MB.loserOf(lb1) ? lb1 : lb2;
      const winner = MB.winnerOf(eliminatedMatch);
      let facts = `In a fantasy football tournament called the Madden Bowl, the very first player has just been eliminated from the playoffs. `;
      if (loser) facts += `${loser.name}, playing as the ${loser.team}, is the first one out, `;
      if (winner) facts += `eliminated by ${winner.name} (${winner.team}) with a score of ${eliminatedMatch.s1}-${eliminatedMatch.s2}. `;
      facts += `Their championship run ends here, while everyone else survives another round.`;
      return facts;
    }

    if (milestone === "toiletBowl") {
      const tb = MB.getPlayoffMatch(state, "tb");
      const winner = MB.winnerOf(tb); // gewinnt das Spiel, landet damit aber auf dem allerletzten Platz
      const loser = MB.loserOf(tb); // verliert das Spiel, rutscht dadurch in der Tabelle nach oben
      let facts = `In a fantasy football tournament called the Madden Bowl, the two worst-performing players of the whole tournament just faced off in the "Toilet Bowl" — a game nobody wants to win. `;
      if (winner && loser && tb) {
        facts += `${winner.name} (${winner.team}) beat ${loser.name} (${loser.team}) ${tb.s1}-${tb.s2} in the game itself, ` +
          `but by the tournament's rules that means ${winner.name} is the one who ends up dead last in the final standings, ` +
          `while ${loser.name} actually climbs back up the table for losing. `;
      }
      facts += `It's the most embarrassing trophy in the Madden Bowl, and everybody knows it.`;
      return facts;
    }

    if (milestone === "finals") {
      const gf = MB.getPlayoffMatch(state, "gf");
      const p1 = gf?.p1, p2 = gf?.p2;
      let facts = `The grand final of a fantasy football tournament called the Madden Bowl, "The Madden Bowl", is set. `;
      if (p1 && p2) {
        facts += `${p1.name} (${p1.team}) faces off against ${p2.name} (${p2.team}) for the championship. `;
        try {
          const flavour = MB.pickFlavourFacts(history, state, p1.name, p2.name);
          if (flavour && flavour.length) facts += flavour[0] + " ";
        } catch (e) {}
      }
      return facts;
    }

    if (milestone === "champion") {
      const gf = MB.getPlayoffMatch(state, "gf");
      const champion = MB.winnerOf(gf), runnerUp = MB.loserOf(gf);
      let facts = `A fantasy football tournament called the Madden Bowl has crowned its champion. `;
      if (champion && runnerUp && gf) {
        facts += `${champion.name}, playing as the ${champion.team}, won the championship game against ${runnerUp.name} (${runnerUp.team}) with a final score of ${Math.max(gf.s1, gf.s2)}-${Math.min(gf.s1, gf.s2)}. `;
        facts += `${champion.name} is the new Madden Bowl champion, the best player of the whole tournament.`;
      }
      return facts;
    }

    return "A fantasy football tournament called the Madden Bowl is underway.";
  }

  // Textrichtung je Modus — bestimmt WIE (nicht WAS) über die Fakten
  // gerappt wird. Wird an die Fakten angehängt, bevor der Prompt an die
  // Music API geht.
  const MODE_DIRECTIVES = {
    hype: () =>
      `Make it energetic, confident, and celebratory — a real hype/victory anthem, not a dry ` +
      `news summary. Use the names and the scoreline naturally in the lyrics. You decide the ` +
      `exact structure, hook, and ad-libs.`,
    brag: () =>
      `Write this from the FIRST-PERSON perspective of the champion themselves ("I", "me", "my") ` +
      `— cocky, over-the-top, dripping with swagger, like the champion is personally hyping up ` +
      `their own legendary run and talking down to everyone they beat along the way. Work their ` +
      `own name and team into the bragging naturally. You decide the exact structure, hook, and ad-libs.`,
    diss: () =>
      `Make this a playful DISS TRACK aimed at the two players in the Toilet Bowl and especially ` +
      `whoever ends up dead last — sharp, cocky trash talk and mockery in the classic rap-battle ` +
      `tradition. It should sting a little, but stay good-natured, funny, and clearly all in good ` +
      `sport rather than genuinely mean. Roast the scoreline and the standings. You decide the ` +
      `exact structure, hook, and ad-libs.`,
    recap: () =>
      `This is a RECAP track, not a hype anthem: rap through the story of the tournament so far ` +
      `like a hype-man sports commentator putting the whole season into rhyme. Walk through the ` +
      `standings table and the biggest storylines in order, clearly enough that a listener could ` +
      `follow what happened just from the lyrics — but keep it catchy and rhythmic, not a spoken ` +
      `list. You decide the exact structure, hook, and ad-libs.`,
  };

  function buildMusicPrompt(milestone, state, history, styleId, languageId, factsOverride) {
    const style = pickStyle(styleId, milestone);
    const language = pickLanguage(languageId);
    const facts = (factsOverride != null && String(factsOverride).trim() !== "")
      ? String(factsOverride).trim()
      : buildFacts(milestone, state, history);
    const mode = (MILESTONE_META[milestone] && MILESTONE_META[milestone].mode) || "hype";
    const directive = (MODE_DIRECTIVES[mode] || MODE_DIRECTIVES.hype)();
    const prompt =
      `${style.tag}. Write and perform a ${language.name}-language hip-hop track about this real ` +
      `story from a fantasy football tournament: ${facts} ${directive}`;
    return { prompt, styleLabel: style.label, languageLabel: language.label, facts, mode };
  }

  // ======================================================================
  // ELEVENLABS MUSIC API
  // ======================================================================
  async function generateSong({ apiKey, prompt, lengthMs, modelId }) {
    const res = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        prompt,
        music_length_ms: lengthMs || 60000,
        model_id: modelId || "music_v2",
      }),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.detail?.message || ""; } catch (e) {}
      throw new Error(`ElevenLabs Music-Fehler HTTP ${res.status}${detail ? ": " + detail : ""}`);
    }
    return res.blob();
  }

  async function uploadSongToStorage(blob, tournamentId, milestone) {
    const sb = MB.getSupabaseClient();
    if (!sb) throw new Error("Supabase-Client nicht verfügbar");
    const path = `${tournamentId || "unbekannt"}/${milestone}-${Date.now()}.mp3`;
    const { error } = await sb.storage.from("mb-songs").upload(path, blob, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from("mb-songs").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveSongUrl(tournamentId, milestone, url) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return;
    const { data, error: readErr } = await sb.from("tournaments").select("songs").eq("id", tournamentId).single();
    if (readErr) throw readErr;
    const songs = { ...(data.songs || {}), [milestone]: url };
    const { error } = await sb.from("tournaments").update({ songs }).eq("id", tournamentId);
    if (error) throw error;
    return songs;
  }

  // Welche Meilensteine sind mit dem aktuellen Turnierstand bereits erreicht?
  function detectMilestones(state) {
    const reached = [];
    if (MB.isGroupPhaseComplete(state)) reached.push("regularSeason");
    const lb1 = MB.getPlayoffMatch(state, "lb1"), lb2 = MB.getPlayoffMatch(state, "lb2");
    if (MB.loserOf(lb1) || MB.loserOf(lb2)) reached.push("firstElimination");
    const tb = MB.getPlayoffMatch(state, "tb");
    if (tb && tb.s1 !== null && tb.s2 !== null) reached.push("toiletBowl");
    const gf = MB.getPlayoffMatch(state, "gf");
    if (gf && gf.p1 && gf.p2 && gf.p1.id !== -1 && gf.p2.id !== -1) reached.push("finals");
    if (gf && MB.winnerOf(gf)) reached.push("champion");
    return reached;
  }

  // testMode: true → es wird NICHTS an ElevenLabs geschickt, nichts hochgeladen
  // und nichts in Supabase gespeichert (kostet also keine Credits). Es kommt
  // nur der fertig zusammengebaute Prompt/die Fakten zurück, damit man sie vor
  // dem "scharfen" Generieren gegenlesen kann.
  //
  // promptOverride: wird ein bereits fertig zusammengebauter Prompt übergeben
  // (typischerweise genau der Prompt, der zuvor im Testmodus angezeigt und
  // ggf. manuell nachjustiert wurde), wird DIESER 1:1 verwendet statt ihn aus
  // Fakten/Stil/Sprache neu zu bauen — so kommt exakt das bei der Music API
  // an, was man vorher geprüft hat.
  async function generateAndStoreSong({ apiKey, modelId, milestone, state, history, tournamentId, lengthMs, styleId, languageId, factsOverride, testMode, promptOverride }) {
    let prompt, styleLabel, languageLabel, facts;
    if (promptOverride != null && String(promptOverride).trim() !== "") {
      prompt = String(promptOverride).trim();
      const style = pickStyle(styleId, milestone);
      const language = pickLanguage(languageId);
      styleLabel = style.label;
      languageLabel = language.label;
      facts = factsOverride || "";
    } else {
      ({ prompt, styleLabel, languageLabel, facts } = buildMusicPrompt(milestone, state, history, styleId, languageId, factsOverride));
    }

    if (testMode) {
      return { testMode: true, prompt, styleLabel, languageLabel, facts };
    }
    if (!apiKey) throw new Error("Kein ElevenLabs-API-Key konfiguriert.");
    const blob = await generateSong({ apiKey, prompt, lengthMs, modelId });
    const url = await uploadSongToStorage(blob, tournamentId, milestone);
    await saveSongUrl(tournamentId, milestone, url);
    return { url, styleLabel, languageLabel, prompt, facts };
  }

  // Baut aus einer öffentlichen Supabase-Storage-URL einen echten Download-Link
  // (statt nur einer Abspiel-URL). Supabase Storage unterstützt dafür den
  // Query-Parameter "download", der serverseitig Content-Disposition:
  // attachment setzt — das funktioniert (anders als das HTML "download"-
  // Attribut) auch bei Cross-Origin-URLs zuverlässig.
  function buildDownloadUrl(url, filename) {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}download=${encodeURIComponent(filename || "madden-bowl-song.mp3")}`;
  }

  // Realistische Platzhalter-Fakten pro Meilenstein — unabhängig vom
  // tatsächlichen Turnierstand, damit sich JEDER Meilenstein jederzeit
  // testen lässt, auch lange bevor er im echten Turnier eintritt (buildFacts()
  // oben liefert für nicht erreichte Meilensteine nur einen sehr generischen
  // Satz ohne Namen/Zahlen, weil die echten Daten schlicht noch fehlen).
  const TEST_FACTS = {
    regularSeason: `The regular season of a fantasy football tournament called the Madden Bowl just wrapped up. ` +
      `Here is the complete final regular-season standings table, from best to worst seed: ` +
      `#1 Tobi F. (Chiefs) with a record of 5-1; #2 Marco (49ers) with a record of 4-2; ` +
      `#3 Jonas (Cowboys) with a record of 3-3; #4 Kevin (Eagles) with a record of 3-3; ` +
      `#5 Nico (Bills) with a record of 2-4; #6 Basti (Ravens) with a record of 1-5. ` +
      `The most dominant win of the season was Tobi F. crushing Basti 42-7. ` +
      `The playoffs are about to begin, seeded exactly in this order.`,
    firstElimination: `In a fantasy football tournament called the Madden Bowl, the very first player has just been ` +
      `eliminated from the playoffs. Nico, playing as the Bills, is the first one out, eliminated by ` +
      `Kevin (Eagles) with a score of 24-14. Their championship run ends here, while everyone else ` +
      `survives another round.`,
    toiletBowl: `In a fantasy football tournament called the Madden Bowl, the two worst-performing players of the ` +
      `whole tournament just faced off in the "Toilet Bowl" — a game nobody wants to win. Basti (Ravens) ` +
      `beat Nico (Bills) 17-13 in the game itself, but by the tournament's rules that means Basti is the ` +
      `one who ends up dead last in the final standings, while Nico actually climbs back up the table for ` +
      `losing. It's the most embarrassing trophy in the Madden Bowl, and everybody knows it.`,
    finals: `The grand final of a fantasy football tournament called the Madden Bowl, "The Madden Bowl", is set. ` +
      `Tobi F. (Chiefs) faces off against Marco (49ers) for the championship. The two have split their ` +
      `two regular-season meetings, and this is the rematch to settle it once and for all.`,
    champion: `A fantasy football tournament called the Madden Bowl has crowned its champion. Tobi F., playing as ` +
      `the Chiefs, won the championship game against Marco (49ers) with a final score of 31-24. Tobi F. is ` +
      `the new Madden Bowl champion, the best player of the whole tournament.`,
  };

  // Wie generateAndStoreSong(), aber bewusst OHNE saveSongUrl()-Aufruf —
  // ein Testsong landet also NIE in tournaments.songs und kann daher auch
  // nie versehentlich einen später real erreichten Meilenstein-Song
  // überschreiben oder vortäuschen. Facts fallen auf TEST_FACTS zurück,
  // damit sich JEDER Meilenstein jederzeit testen lässt — unabhängig vom
  // tatsächlichen Turnierfortschritt. Storage-Pfad ist mit "test-" markiert.
  async function generateTestSong({ apiKey, modelId, milestone, tournamentId, lengthMs, styleId, languageId, factsOverride, promptOverride }) {
    let prompt, styleLabel, languageLabel, facts;
    if (promptOverride != null && String(promptOverride).trim() !== "") {
      prompt = String(promptOverride).trim();
      const style = pickStyle(styleId, milestone);
      const language = pickLanguage(languageId);
      styleLabel = style.label; languageLabel = language.label; facts = factsOverride || "";
    } else {
      const effectiveFacts = (factsOverride != null && String(factsOverride).trim() !== "") ? factsOverride : TEST_FACTS[milestone];
      ({ prompt, styleLabel, languageLabel, facts } = buildMusicPrompt(milestone, null, null, styleId, languageId, effectiveFacts));
    }
    if (!apiKey) throw new Error("Kein ElevenLabs-API-Key konfiguriert.");
    const blob = await generateSong({ apiKey, prompt, lengthMs, modelId });
    const url = await uploadSongToStorage(blob, tournamentId, `test-${milestone}`);
    return { url, styleLabel, languageLabel, prompt, facts };
  }

  global.MB = global.MB || {};
  global.MB.Music = {
    STYLE_POOL, LANGUAGE_POOL, DEFAULT_LANGUAGE_ID, MILESTONE_META, MILESTONE_ORDER, TEST_FACTS,
    pickStyle, pickLanguage, buildFacts, buildMusicPrompt,
    generateSong, uploadSongToStorage, saveSongUrl, detectMilestones, generateAndStoreSong, generateTestSong,
    buildDownloadUrl,
  };
})(window);
