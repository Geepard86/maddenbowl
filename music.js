/* =========================================================================
   ALTIMA BOWL — MUSIC (music.js)
   -------------------------------------------------------------------------
   Generiert an fünf Meilensteinen (Regular Season beendet, erstes
   Ausscheiden, Toilet Bowl entschieden, Finals stehen fest, Turniersieger
   steht fest) einen Hip-Hop/Rap-Song über die echten Turnier-Fakten via
   ElevenLabs Music API — manuell ausgelöst (kein Auto-Trigger, da Musik
   pro Minute deutlich mehr Credits kostet als Sprache).

   Jeder Meilenstein hat einen eigenen "Modus", der die Textrichtung prägt
   (siehe MODE_DIRECTIVES): "recap" (reimende Zusammenfassung des bisherigen
   Turnierverlaufs inkl. Tabelle), "hype" (Hype-Anthem), "brag" (Sieger
   rappt großspurig aus der Ich-Perspektive), "victor" (der Besieger des ersten Ausgeschiedenen
   rappt aus der Ich-Perspektive), "self" (der Toilet-Bowl-Letzte
   rappt selbstironisch über sich und kündigt sein Comeback an) und "diss"
   (Disstrack, aktuell keinem Moment zugeordnet). Vor dem eigentlichen Generieren lassen sich pro
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
  ];
  const DEFAULT_LANGUAGE_ID = "de";

  // Meilenstein-Metadaten: Anzeigename, Text-Modus (siehe MODE_DIRECTIVES)
  // und eine Stil-Vorauswahl, die zum Anlass passt. Der Modus entscheidet,
  // wie die Fakten unten in ein Songkonzept übersetzt werden.
  const MILESTONE_META = {
    regularSeason: { label: "Regular Season beendet", mode: "recap", defaultStyleId: "conscious" },
    firstElimination: { label: "Erstes Ausscheiden", mode: "victor", defaultStyleId: "drill" },
    toiletBowl: { label: "Toilet Bowl entschieden", mode: "self", defaultStyleId: "drill" },
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
  function buildStandingsTable(state, seedByName, lang) {
    const ranked = [...state.players].sort(
      (a, b) => (seedByName.get(a.name) || 999) - (seedByName.get(b.name) || 999)
    );
    return ranked
      .map((p) => lang === "de"
        ? `#${seedByName.get(p.name) || "?"} ${p.name} (${p.team}) mit einer Bilanz von ${p.wins || 0}-${(p.played || 0) - (p.wins || 0)}`
        : `#${seedByName.get(p.name) || "?"} ${p.name} (${p.team}) with a record of ${p.wins || 0}-${(p.played || 0) - (p.wins || 0)}`)
      .join("; ");
  }

  function buildFacts(milestone, state, history, languageId) {
    const seedByName = MB.getGroupSeedsFinal(state);
    const lang = languageId === "de" ? "de" : "en";

    if (milestone === "regularSeason") {
      const table = buildStandingsTable(state, seedByName, lang);
      const best = biggestGroupWin(state);
      if (lang === "de") {
        let facts = `Die Regular Season eines Fantasy-Football-Turniers namens Altima Bowl ist gerade zu Ende gegangen. ` +
          `Hier die komplette Abschlusstabelle, vom besten zum schlechtesten Seed: ${table}. `;
        if (best) facts += `Der deutlichste Sieg der Saison war ${best.winner.name}s ${best.winnerScore}:${best.loserScore} gegen ${best.loser.name}. `;
        facts += `Die Playoffs beginnen gleich, gesetzt genau in dieser Reihenfolge.`;
        return facts;
      }
      let facts = `The regular season of a fantasy football tournament called the Altima Bowl just wrapped up. ` +
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
      if (lang === "de") {
        let facts = `In einem Fantasy-Football-Turnier namens Altima Bowl ist gerade der allererste Spieler aus den Playoffs ausgeschieden. `;
        if (loser) facts += `${loser.name}, mit den ${loser.team}, ist als Erster raus, `;
        if (winner) facts += `ausgeschieden gegen ${winner.name} (${winner.team}) mit einem Ergebnis von ${eliminatedMatch.s1}:${eliminatedMatch.s2}. `;
        facts += `Der Titeltraum endet hier, während alle anderen eine weitere Runde überleben.`;
        return facts;
      }
      let facts = `In a fantasy football tournament called the Altima Bowl, the very first player has just been eliminated from the playoffs. `;
      if (loser) facts += `${loser.name}, playing as the ${loser.team}, is the first one out, `;
      if (winner) facts += `eliminated by ${winner.name} (${winner.team}) with a score of ${eliminatedMatch.s1}-${eliminatedMatch.s2}. `;
      facts += `Their championship run ends here, while everyone else survives another round.`;
      return facts;
    }

    if (milestone === "toiletBowl") {
      const tb = MB.getPlayoffMatch(state, "tb");
      const winner = MB.winnerOf(tb); // gewinnt das Spiel, landet damit aber auf dem allerletzten Platz
      const loser = MB.loserOf(tb); // verliert das Spiel, rutscht dadurch in der Tabelle nach oben
      if (lang === "de") {
        let facts = `In einem Fantasy-Football-Turnier namens Altima Bowl sind gerade die zwei schwächsten Spieler des ganzen Turniers in der "Toilet Bowl" aufeinandergetroffen — einem Spiel, das niemand gewinnen will. `;
        if (winner && loser && tb) {
          facts += `${winner.name} (${winner.team}) hat gegen ${loser.name} (${loser.team}) ${tb.s1}:${tb.s2} im Spiel selbst gewonnen, ` +
            `aber nach den Turnierregeln heißt das, dass ${winner.name} in der Endtabelle ganz unten landet, ` +
            `während ${loser.name} durch die Niederlage in der Tabelle wieder nach oben klettert. `;
        }
        facts += `Es ist die peinlichste Trophäe im Altima Bowl, und das weiß auch jeder. `;
        if (winner) facts += `Der Trost: Mit diesem Sieg hat sich ${winner.name} den allerersten Pick im Draft des nächsten Jahres gesichert.`;
        return facts;
      }
      let facts = `In a fantasy football tournament called the Altima Bowl, the two worst-performing players of the whole tournament just faced off in the "Toilet Bowl" — a game nobody wants to win. `;
      if (winner && loser && tb) {
        facts += `${winner.name} (${winner.team}) beat ${loser.name} (${loser.team}) ${tb.s1}-${tb.s2} in the game itself, ` +
          `but by the tournament's rules that means ${winner.name} is the one who ends up dead last in the final standings, ` +
          `while ${loser.name} actually climbs back up the table for losing. `;
      }
      facts += `It's the most embarrassing trophy in the Altima Bowl, and everybody knows it. `;
      if (winner) facts += `The consolation: with this win, ${winner.name} has locked up the very first pick in next year's draft.`;
      return facts;
    }

    if (milestone === "finals") {
      const gf = MB.getPlayoffMatch(state, "gf");
      const p1 = gf?.p1, p2 = gf?.p2;
      // Toilet Bowl läuft unabhängig vom Bracket-Fortschritt der Finalisten -
      // ist sie zu diesem Zeitpunkt schon entschieden, bekommt ihr "Sieger"
      // (= landet ganz unten) einen kleinen Seitenhieb im Song ab.
      const tb = MB.getPlayoffMatch(state, "tb");
      const tbLoserRankWinner = MB.winnerOf(tb); // gewinnt das Spiel, landet aber ganz unten
      if (lang === "de") {
        let facts = `Das große Finale eines Fantasy-Football-Turniers namens Altima Bowl, "der Altima Bowl", steht fest. `;
        if (p1 && p2) {
          facts += `${p1.name} (${p1.team}) trifft auf ${p2.name} (${p2.team}) um die Meisterschaft. `;
          try {
            const flavour = MB.pickFlavourFacts(history, state, p1.name, p2.name);
            if (flavour && flavour.length) facts += flavour[0] + " ";
          } catch (e) {}
        }
        if (tbLoserRankWinner) {
          facts += `Nebenbei: Die "Toilet Bowl" ist bereits entschieden - ${tbLoserRankWinner.name} hat sie "gewonnen" und landet damit ganz unten in der Tabelle. Ein kleiner Seitenhieb im Song darf ruhig sein: nächstes Jahr wird's für ${tbLoserRankWinner.name} wahrscheinlich auch nicht besser.`;
        }
        return facts;
      }
      let facts = `The grand final of a fantasy football tournament called the Altima Bowl, "The Altima Bowl", is set. `;
      if (p1 && p2) {
        facts += `${p1.name} (${p1.team}) faces off against ${p2.name} (${p2.team}) for the championship. `;
        try {
          const flavour = MB.pickFlavourFacts(history, state, p1.name, p2.name);
          if (flavour && flavour.length) facts += flavour[0] + " ";
        } catch (e) {}
      }
      if (tbLoserRankWinner) {
        facts += `By the way: the "Toilet Bowl" has already been decided - ${tbLoserRankWinner.name} "won" it and ends up dead last in the standings. Feel free to take a little jab at that in the song: next year probably won't go much better for ${tbLoserRankWinner.name} either.`;
      }
      return facts;
    }

    if (milestone === "champion") {
      const gf = MB.getPlayoffMatch(state, "gf");
      const champion = MB.winnerOf(gf), runnerUp = MB.loserOf(gf);
      if (lang === "de") {
        let facts = `Ein Fantasy-Football-Turnier namens Altima Bowl hat seinen Champion gekrönt. `;
        if (champion && runnerUp && gf) {
          facts += `${champion.name}, mit den ${champion.team}, hat das Finale gegen ${runnerUp.name} (${runnerUp.team}) mit einem Endstand von ${Math.max(gf.s1, gf.s2)}:${Math.min(gf.s1, gf.s2)} gewonnen. `;
          facts += `${champion.name} ist der neue Altima-Bowl-Champion, der beste Spieler des gesamten Turniers.`;
        }
        return facts;
      }
      let facts = `A fantasy football tournament called the Altima Bowl has crowned its champion. `;
      if (champion && runnerUp && gf) {
        facts += `${champion.name}, playing as the ${champion.team}, won the championship game against ${runnerUp.name} (${runnerUp.team}) with a final score of ${Math.max(gf.s1, gf.s2)}-${Math.min(gf.s1, gf.s2)}. `;
        facts += `${champion.name} is the new Altima Bowl champion, the best player of the whole tournament.`;
      }
      return facts;
    }

    return lang === "de" ? "Ein Fantasy-Football-Turnier namens Altima Bowl läuft gerade." : "A fantasy football tournament called the Altima Bowl is underway.";
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
    victor: () =>
      `Write this from the FIRST-PERSON perspective of the player who just knocked out the very first player ` +
      `of the playoffs (the winner named in the facts) — cocky, confident and playful. They talk directly about ` +
      `the player they eliminated (also named in the facts): how the game went, the scoreline, how they sent ` +
      `them home early, "taking out the trash", waving goodbye as they pack their things — while staying ` +
      `good-natured and clearly all in good sport rather than genuinely mean. They are only getting started ` +
      `and set their sights on the title. You decide the exact structure, hook, and ad-libs.`,
    self: () =>
      `Write this from the FIRST-PERSON perspective of the player who "won" the Toilet Bowl and therefore ` +
      `ends up dead last (named in the facts) — self-deprecating, funny and self-ironic about finishing last ` +
      `and holding the most embarrassing trophy of the tournament. But turn it around with swagger: by winning ` +
      `it, this player has locked up the FIRST PICK in next year's draft, vows to come back and attack big, ` +
      `and withdraws into training camp until then (early mornings, sprints, gym, film study, grinding in ` +
      `silence). Good-natured and clearly all in good sport. You decide the exact structure, hook, and ad-libs.`,
    recap: () =>
      `This is a RECAP track, not a hype anthem: rap through the story of the tournament so far ` +
      `like a hype-man sports commentator putting the whole season into rhyme. Walk through the ` +
      `standings table and the biggest storylines in order, clearly enough that a listener could ` +
      `follow what happened just from the lyrics — but keep it catchy and rhythmic, not a spoken ` +
      `list. You decide the exact structure, hook, and ad-libs.`,
  };

  // Deutsche Entsprechung — wird nur verwendet, wenn Sprache=Deutsch gewählt
  // ist, damit der GANZE Prompt (nicht nur der gewünschte Gesangstext)
  // konsistent auf Deutsch ist. Der Stil-Tag (STYLE_POOL) bleibt bewusst
  // Englisch, weil die ElevenLabs-Doku dafür ausdrücklich Englisch empfiehlt
  // ("Use English language for best result" für Stil-/Genre-Beschreibungen).
  const MODE_DIRECTIVES_DE = {
    hype: () =>
      `Mach den Song energiegeladen, selbstbewusst und feierlich — eine echte Hype-/Siegeshymne, ` +
      `keine trockene Nachrichtenzusammenfassung. Verwende die Namen und den Spielstand ganz ` +
      `natürlich im Text. Struktur, Hook und Ad-Libs darfst du frei gestalten.`,
    brag: () =>
      `Schreib das Ganze aus der ICH-Perspektive des Champions selbst ("ich", "mein") — großspurig, ` +
      `übertrieben selbstbewusst, als würde der Champion persönlich seinen legendären Lauf abfeiern ` +
      `und alle Gegner, die er unterwegs geschlagen hat, herabwürdigen. Bau seinen Namen und sein ` +
      `Team ganz natürlich mit ein. Struktur, Hook und Ad-Libs darfst du frei gestalten.`,
    diss: () =>
      `Mach daraus einen spielerischen DISSTRACK gegen die beiden Spieler in der Toilet Bowl, vor ` +
      `allem gegen den, der am Ende ganz unten landet — scharfe, selbstbewusste Sprüche und Spott in ` +
      `klassischer Rap-Battle-Tradition. Es darf ruhig etwas wehtun, soll aber gutmütig, witzig und ` +
      `klar als Spaß erkennbar bleiben, nicht wirklich gemein. Zieh über den Spielstand und die ` +
      `Tabelle her. Struktur, Hook und Ad-Libs darfst du frei gestalten.`,
    victor: () =>
      `Schreib das Ganze aus der ICH-Perspektive des Spielers, der gerade den allerersten Spieler der Playoffs ` +
      `rausgeworfen hat (der Sieger aus den Fakten) — selbstbewusst, großspurig und verspielt. Er redet direkt ` +
      `über den Spieler, den er ausgeschaltet hat (steht ebenfalls in den Fakten): wie das Spiel lief, der ` +
      `Spielstand, wie er ihn früh nach Hause geschickt hat, "den Müll rausbringen", Tschüss winken, während ` +
      `der seine Sachen packt — dabei gutmütig und klar als Spaß erkennbar, nicht wirklich gemein. Er fängt ` +
      `gerade erst an und hat den Titel im Visier. Struktur, Hook und Ad-Libs darfst du frei gestalten.`,
    self: () =>
      `Schreib das Ganze aus der ICH-Perspektive des Spielers, der die Toilet Bowl "gewonnen" hat und damit ` +
      `ganz unten landet (steht in den Fakten) — selbstironisch und witzig über den letzten Platz und die ` +
      `peinlichste Trophäe des Turniers. Dreh es aber mit Selbstbewusstsein um: Durch den Sieg hat er sich den ` +
      `ALLERERSTEN PICK im Draft des nächsten Jahres gesichert, kündigt an, groß anzugreifen, und zieht sich bis ` +
      `dahin ins Trainingslager zurück (früh aufstehen, Sprints, Gym, Videostudium, still schuften). Gutmütig ` +
      `und klar als Spaß erkennbar. Struktur, Hook und Ad-Libs darfst du frei gestalten.`,
    recap: () =>
      `Das hier ist ein RECAP-Track, keine Hype-Hymne: rapp die bisherige Turniergeschichte wie ein ` +
      `Hype-Man-Sportkommentator, der die ganze Saison in Reime packt. Geh die Tabelle und die ` +
      `größten Storylines der Reihe nach durch, klar genug, dass man dem Verlauf allein über den ` +
      `Text folgen kann — aber halt es catchy und rhythmisch, keine gesprochene Liste. Struktur, ` +
      `Hook und Ad-Libs darfst du frei gestalten.`,
  };

  function buildMusicPrompt(milestone, state, history, styleId, languageId, factsOverride) {
    const style = pickStyle(styleId, milestone);
    const language = pickLanguage(languageId);
    let facts = (factsOverride != null && String(factsOverride).trim() !== "")
      ? String(factsOverride).trim()
      : buildFacts(milestone, state, history, languageId);
    // Namen wie "Tobi F." / "Tobi W." werden gesungen genauso falsch
    // ausgesprochen wie bei der Text-Ansage — dieselbe phonetische
    // Ersetzung (Tobi Eff / Tobi Weh) hier ebenfalls anwenden, egal ob die
    // Fakten aus dem echten Turnierstand oder aus Test-/Override-Text kommen.
    if (global.MB && global.MB.Announcer && typeof global.MB.Announcer.speechName === "function") {
      facts = global.MB.Announcer.speechName(facts);
    }
    const mode = (MILESTONE_META[milestone] && MILESTONE_META[milestone].mode) || "hype";
    const isGerman = language.id === "de";
    const directives = isGerman ? MODE_DIRECTIVES_DE : MODE_DIRECTIVES;
    const directive = (directives[mode] || directives.hype)();
    const prompt = isGerman
      ? `${style.tag}. Schreibe und performe einen deutschsprachigen Hip-Hop-Track über diese ` +
        `echte Geschichte aus einem Fantasy-Football-Turnier: ${facts} ${directive}`
      : `${style.tag}. Write and perform a ${language.name}-language hip-hop track about this real ` +
        `story from a fantasy football tournament: ${facts} ${directive}`;
    return { prompt, styleLabel: style.label, languageLabel: language.label, facts, mode };
  }

  // ======================================================================
  // ELEVENLABS MUSIC API
  // ======================================================================
  // ----- Antwort-Parser für /v1/music/detailed (multipart/mixed) -----
  function _findBytes(hay, needle, from) {
    outer: for (let i = from || 0; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  }
  function parseMultipart(buf, contentType) {
    const m = /boundary="?([^";]+)"?/i.exec(contentType || "");
    if (!m) return null;
    const enc = new TextEncoder(), dec = new TextDecoder("latin1");
    const u8 = new Uint8Array(buf);
    const delim = enc.encode("--" + m[1]);
    const parts = [];
    let pos = _findBytes(u8, delim, 0);
    while (pos !== -1) {
      const next = _findBytes(u8, delim, pos + delim.length);
      if (next === -1) break;
      let chunk = u8.subarray(pos + delim.length, next);
      // führendes CRLF und abschließendes CRLF vor der nächsten Grenze abziehen
      if (chunk[0] === 13 && chunk[1] === 10) chunk = chunk.subarray(2);
      if (chunk.length >= 2 && chunk[chunk.length - 2] === 13 && chunk[chunk.length - 1] === 10) chunk = chunk.subarray(0, chunk.length - 2);
      const sep = _findBytes(chunk, enc.encode("\r\n\r\n"), 0);
      if (sep !== -1) parts.push({ headers: dec.decode(chunk.subarray(0, sep)).toLowerCase(), body: chunk.subarray(sep + 4) });
      pos = next;
    }
    return parts;
  }

  // Sucht rekursiv ein Array von Wort-Objekten mit Start/Ende (Einheit wird erkannt).
  function _num(o, keys) { for (const k of keys) if (typeof o[k] === "number" && isFinite(o[k])) return { v: o[k], k }; return null; }
  function _findWordArray(node, depth) {
    if (!node || depth > 6) return null;
    if (Array.isArray(node)) {
      if (node.length >= 3 && node.every((x) => x && typeof x === "object")) {
        const sample = node[0];
        const txt = ["text", "word", "token", "value", "character"].find((k) => typeof sample[k] === "string");
        const st = _num(sample, ["start_s", "start_ms", "start_time", "start", "begin", "t0", "from"]);
        if (txt && st) return node;
      }
      for (const it of node) { const r = _findWordArray(it, depth + 1); if (r) return r; }
      return null;
    }
    if (typeof node === "object") for (const k of Object.keys(node)) { const r = _findWordArray(node[k], depth + 1); if (r) return r; }
    return null;
  }
  function _planLines(plan) {
    const lines = [];
    if (!plan) return lines;
    const items = plan.sections || plan.chunks || [];
    items.forEach((sec) => {
      const raw = Array.isArray(sec.lines) ? sec.lines : String(sec.text || "").split(/\n/);
      raw.forEach((l) => {
        const t = String(l).replace(/^\s*\[[^\]]*\]\s*$/, "").replace(/\{[^}]*\}/g, "").trim();
        if (t) lines.push(t);
      });
    });
    return lines;
  }
  function buildTiming(meta, lengthMs) {
    try {
      const timing = { v: 1, estimated: false, words: [], lines: _planLines(meta && meta.composition_plan) };
      const arr = _findWordArray(meta, 0);
      if (arr) {
        const txtKey = ["text", "word", "token", "value", "character"].find((k) => typeof arr[0][k] === "string");
        const raw = arr.map((x) => {
          const st = _num(x, ["start_s", "start_ms", "start_time", "start", "begin", "t0", "from"]);
          const en = _num(x, ["end_s", "end_ms", "end_time", "end", "t1", "to"]);
          return { w: String(x[txtKey] || "").trim(), s: st ? st.v : null, e: en ? en.v : null, sk: st ? st.k : "" };
        }).filter((x) => x.w && x.s != null);
        if (raw.length) {
          const maxV = Math.max(...raw.map((x) => (x.e != null ? x.e : x.s)));
          const isMs = raw[0].sk.endsWith("ms") || maxV > ((lengthMs || 180000) / 1000) * 1.6;
          const k = isMs ? 0.001 : 1;
          raw.forEach((x, i) => {
            const s0 = x.s * k;
            const e0 = x.e != null ? x.e * k : (raw[i + 1] ? raw[i + 1].s * k : s0 + 0.4);
            timing.words.push({ w: x.w, s: s0, e: Math.max(e0, s0 + 0.08) });
          });
        }
      }
      // Fallback: Songtext aus dem Plan gleichmäßig über die Abschnitts-Dauer verteilen (grobe Schätzung)
      if (!timing.words.length && meta && meta.composition_plan) {
        const items = meta.composition_plan.sections || meta.composition_plan.chunks || [];
        let t0 = 0;
        items.forEach((sec) => {
          const dur = (sec.duration_ms || 0) / 1000;
          const raw = Array.isArray(sec.lines) ? sec.lines : String(sec.text || "").split(/\n/);
          const words = raw.map((l) => String(l).replace(/^\s*\[[^\]]*\]\s*$/, "").replace(/\{[^}]*\}/g, "").trim()).join(" ").split(/\s+/).filter(Boolean);
          if (words.length && dur > 0) {
            const usable = dur * 0.88, step = usable / words.length, off = dur * 0.06;
            words.forEach((w, i) => timing.words.push({ w, s: t0 + off + i * step, e: t0 + off + (i + 0.85) * step }));
          }
          t0 += dur;
        });
        if (timing.words.length) timing.estimated = true;
      }
      if (meta && meta.song_metadata && meta.song_metadata.title) timing.title = meta.song_metadata.title;
      return (timing.words.length || timing.lines.length) ? timing : null;
    } catch (e) { console.warn("Timing-Parser:", e); return null; }
  }

  async function _readError(res) {
    let detail = "";
    try {
      const errJson = await res.json();
      const d = errJson?.detail;
      if (typeof d === "string") detail = d;
      else if (Array.isArray(d)) detail = d.map((item) => `${(item.loc || []).join(".")}: ${item.msg || item.message || ""}`).join("; ");
      else if (d?.message) detail = d.message;
      else if (errJson?.message) detail = errJson.message;
      else if (d) detail = JSON.stringify(d).slice(0, 300);
    } catch (e) {}
    return `ElevenLabs Music-Fehler HTTP ${res.status}${detail ? ": " + detail : " (keine weitere Fehlermeldung vom Server)"}`;
  }

  // Liefert einen Blob (MP3). Falls die API Wort-Zeitstempel/Songtext mitschickt,
  // hängt sie als blob.__timing an (wird beim Upload als .json neben die MP3 gelegt).
  async function generateSong({ apiKey, prompt, lengthMs, modelId }) {
    const body = JSON.stringify({ prompt, music_length_ms: lengthMs || 60000, model_id: modelId || "music_v2", with_timestamps: true });
    let res = null;
    try {
      res = await fetch("https://api.elevenlabs.io/v1/music/detailed", {
        method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" }, body,
      });
    } catch (e) { console.warn("music/detailed nicht erreichbar, nutze /v1/music:", e); }

    if (res && res.ok) {
      try {
        const ct = res.headers.get("content-type") || "";
        const buf = await res.arrayBuffer();
        let meta = null, audioBlob = null;
        if (/multipart/i.test(ct)) {
          const parts = parseMultipart(buf, ct) || [];
          for (const part of parts) {
            if (/application\/json/.test(part.headers) && !meta) { try { meta = JSON.parse(new TextDecoder().decode(part.body)); } catch (e) {} }
            else if (/audio\//.test(part.headers) || /octet-stream/.test(part.headers)) audioBlob = new Blob([part.body], { type: "audio/mpeg" });
          }
        } else if (/audio\//.test(ct)) {
          audioBlob = new Blob([buf], { type: "audio/mpeg" });
        }
        if (audioBlob && audioBlob.size > 1000) {
          const timing = buildTiming(meta, lengthMs);
          if (timing) audioBlob.__timing = timing;
          console.info("Song generiert (detailed). Zeitstempel:", timing ? `${timing.words.length} Wörter${timing.estimated ? " (geschätzt)" : ""}` : "keine");
          return audioBlob;
        }
        console.warn("music/detailed: Antwort nicht lesbar — die Credits für diesen Aufruf sind bereits verbraucht. Metadaten:", meta);
        throw new Error("Song-Antwort (detailed) konnte nicht gelesen werden — Details in der Browser-Konsole.");
      } catch (e) { throw e; }
    }
    // Nur bei "Endpunkt/Parameter unbekannt" (kein Credit-Verbrauch) auf den alten Aufruf zurückfallen
    if (res && ![400, 404, 405, 422].includes(res.status)) throw new Error(await _readError(res));
    const res2 = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({ prompt, music_length_ms: lengthMs || 60000, model_id: modelId || "music_v2" }),
    });
    if (!res2.ok) throw new Error(await _readError(res2));
    return res2.blob();
  }

  async function uploadSongToStorage(blob, tournamentId, milestone) {
    const sb = MB.getSupabaseClient();
    if (!sb) throw new Error("Supabase-Client nicht verfügbar");
    const path = `${tournamentId || "unbekannt"}/${milestone}-${Date.now()}.mp3`;
    const { error } = await sb.storage.from("mb-songs").upload(path, blob, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    // Zeitstempel/Songtext (falls vorhanden) als .json neben die MP3 legen — nie ein Show-Stopper
    if (blob.__timing) {
      try {
        const jsonBlob = new Blob([JSON.stringify(blob.__timing)], { type: "application/json" });
        const { error: jErr } = await sb.storage.from("mb-songs").upload(path.replace(/\.mp3$/, ".json"), jsonBlob, { contentType: "application/json", upsert: true });
        if (jErr) console.warn("Song-Timing konnte nicht gespeichert werden:", jErr.message || jErr);
      } catch (e) { console.warn("Song-Timing-Upload:", e); }
    }
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
    // Stil-ID neben dem Songtext-Timing ablegen, damit die Video-Bühne später den passenden Look wählt
    blob.__timing = Object.assign(blob.__timing || { v: 1, words: [], lines: [] }, { style: pickStyle(styleId, milestone).id });
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
    return `${url}${sep}download=${encodeURIComponent(filename || "altima-bowl-song.mp3")}`;
  }

  // Realistische Platzhalter-Fakten pro Meilenstein — unabhängig vom
  // tatsächlichen Turnierstand, damit sich JEDER Meilenstein jederzeit
  // testen lässt, auch lange bevor er im echten Turnier eintritt (buildFacts()
  // oben liefert für nicht erreichte Meilensteine nur einen sehr generischen
  // Satz ohne Namen/Zahlen, weil die echten Daten schlicht noch fehlen).
  const TEST_FACTS = {
    regularSeason: `The regular season of a fantasy football tournament called the Altima Bowl just wrapped up. ` +
      `Here is the complete final regular-season standings table, from best to worst seed: ` +
      `#1 Tobi F. (Chiefs) with a record of 5-1; #2 Marco (49ers) with a record of 4-2; ` +
      `#3 Jonas (Cowboys) with a record of 3-3; #4 Kevin (Eagles) with a record of 3-3; ` +
      `#5 Nico (Bills) with a record of 2-4; #6 Basti (Ravens) with a record of 1-5. ` +
      `The most dominant win of the season was Tobi F. crushing Basti 42-7. ` +
      `The playoffs are about to begin, seeded exactly in this order.`,
    firstElimination: `In a fantasy football tournament called the Altima Bowl, the very first player has just been ` +
      `eliminated from the playoffs. Nico, playing as the Bills, is the first one out, eliminated by ` +
      `Kevin (Eagles) with a score of 24-14. Their championship run ends here, while everyone else ` +
      `survives another round.`,
    toiletBowl: `In a fantasy football tournament called the Altima Bowl, the two worst-performing players of the ` +
      `whole tournament just faced off in the "Toilet Bowl" — a game nobody wants to win. Basti (Ravens) ` +
      `beat Nico (Bills) 17-13 in the game itself, but by the tournament's rules that means Basti is the ` +
      `one who ends up dead last in the final standings, while Nico actually climbs back up the table for ` +
      `losing. It's the most embarrassing trophy in the Altima Bowl, and everybody knows it. The consolation: ` +
      `with this win, Basti has locked up the very first pick in next year's draft.`,
    finals: `The grand final of a fantasy football tournament called the Altima Bowl, "The Altima Bowl", is set. ` +
      `Tobi F. (Chiefs) faces off against Marco (49ers) for the championship. The two have split their ` +
      `two regular-season meetings, and this is the rematch to settle it once and for all.`,
    champion: `A fantasy football tournament called the Altima Bowl has crowned its champion. Tobi F., playing as ` +
      `the Chiefs, won the championship game against Marco (49ers) with a final score of 31-24. Tobi F. is ` +
      `the new Altima Bowl champion, the best player of the whole tournament.`,
  };

  const TEST_FACTS_DE = {
    regularSeason: `Die Regular Season eines Fantasy-Football-Turniers namens Altima Bowl ist gerade zu Ende ` +
      `gegangen. Hier die komplette Abschlusstabelle, vom besten zum schlechtesten Seed: ` +
      `#1 Tobi F. (Chiefs) mit einer Bilanz von 5-1; #2 Marco (49ers) mit einer Bilanz von 4-2; ` +
      `#3 Jonas (Cowboys) mit einer Bilanz von 3-3; #4 Kevin (Eagles) mit einer Bilanz von 3-3; ` +
      `#5 Nico (Bills) mit einer Bilanz von 2-4; #6 Basti (Ravens) mit einer Bilanz von 1-5. ` +
      `Der deutlichste Sieg der Saison war Tobi F.s 42:7 gegen Basti. ` +
      `Die Playoffs beginnen gleich, gesetzt genau in dieser Reihenfolge.`,
    firstElimination: `In einem Fantasy-Football-Turnier namens Altima Bowl ist gerade der allererste Spieler aus ` +
      `den Playoffs ausgeschieden. Nico, mit den Bills, ist als Erster raus, ausgeschieden gegen Kevin (Eagles) ` +
      `mit einem Ergebnis von 24:14. Der Titeltraum endet hier, während alle anderen eine weitere Runde überleben.`,
    toiletBowl: `In einem Fantasy-Football-Turnier namens Altima Bowl sind gerade die zwei schwächsten Spieler ` +
      `des ganzen Turniers in der "Toilet Bowl" aufeinandergetroffen — einem Spiel, das niemand gewinnen will. ` +
      `Basti (Ravens) hat gegen Nico (Bills) 17:13 im Spiel selbst gewonnen, aber nach den Turnierregeln heißt ` +
      `das, dass Basti in der Endtabelle ganz unten landet, während Nico durch die Niederlage in der Tabelle ` +
      `wieder nach oben klettert. Es ist die peinlichste Trophäe im Altima Bowl, und das weiß auch jeder. Der Trost: ` +
      `Mit diesem Sieg hat sich Basti den allerersten Pick im Draft des nächsten Jahres gesichert.`,
    finals: `Das große Finale eines Fantasy-Football-Turniers namens Altima Bowl, "der Altima Bowl", steht fest. ` +
      `Tobi F. (Chiefs) trifft auf Marco (49ers) um die Meisterschaft. Die beiden haben ihre zwei ` +
      `Regular-Season-Duelle geteilt, das hier ist das Rückspiel, das alles klärt.`,
    champion: `Ein Fantasy-Football-Turnier namens Altima Bowl hat seinen Champion gekrönt. Tobi F., mit den ` +
      `Chiefs, hat das Finale gegen Marco (49ers) mit einem Endstand von 31:24 gewonnen. Tobi F. ist der neue ` +
      `Altima-Bowl-Champion, der beste Spieler des gesamten Turniers.`,
  };

  function getTestFacts(milestone, languageId) {
    return (languageId === "de" ? TEST_FACTS_DE[milestone] : TEST_FACTS[milestone]) || TEST_FACTS[milestone];
  }

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
      const effectiveFacts = (factsOverride != null && String(factsOverride).trim() !== "") ? factsOverride : getTestFacts(milestone, languageId);
      ({ prompt, styleLabel, languageLabel, facts } = buildMusicPrompt(milestone, null, null, styleId, languageId, effectiveFacts));
    }
    if (!apiKey) throw new Error("Kein ElevenLabs-API-Key konfiguriert.");
    const blob = await generateSong({ apiKey, prompt, lengthMs, modelId });
    // Stil-ID neben dem Songtext-Timing ablegen, damit die Video-Bühne später den passenden Look wählt
    blob.__timing = Object.assign(blob.__timing || { v: 1, words: [], lines: [] }, { style: pickStyle(styleId, milestone).id });
    const url = await uploadSongToStorage(blob, tournamentId, `test-${milestone}`);
    return { url, styleLabel, languageLabel, prompt, facts };
  }

  global.MB = global.MB || {};
  global.MB.Music = {
    STYLE_POOL, LANGUAGE_POOL, DEFAULT_LANGUAGE_ID, MILESTONE_META, MILESTONE_ORDER, TEST_FACTS, TEST_FACTS_DE, getTestFacts,
    pickStyle, pickLanguage, buildFacts, buildMusicPrompt,
    generateSong, uploadSongToStorage, saveSongUrl, detectMilestones, generateAndStoreSong, generateTestSong,
    buildDownloadUrl,
  };
})(window);
