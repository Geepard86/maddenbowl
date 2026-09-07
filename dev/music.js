/* =========================================================================
   MADDEN BOWL — MUSIC (music.js)
   -------------------------------------------------------------------------
   Generiert an vier Meilensteinen (Regular Season beendet, erstes
   Ausscheiden, Finals stehen fest, Turniersieger steht fest) einen
   englischsprachigen Hip-Hop/Rap-Song über die echten Turnier-Fakten via
   ElevenLabs Music API — manuell ausgelöst (kein Auto-Trigger, da Musik
   pro Minute deutlich mehr Credits kostet als Sprache).

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
  // klingt.
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

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pickStyle(forcedId) {
    if (forcedId) {
      const found = STYLE_POOL.find((s) => s.id === forcedId);
      if (found) return found;
    }
    return pick(STYLE_POOL);
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

  function buildFacts(milestone, state, history) {
    const seedByName = MB.getGroupSeedsFinal(state);

    if (milestone === "regularSeason") {
      const topSeedName = [...seedByName.entries()].find(([, seed]) => seed === 1)?.[0];
      const topPlayer = state.players.find((p) => p.name === topSeedName);
      const best = biggestGroupWin(state);
      let facts = `The regular season of a fantasy football tournament called the Madden Bowl just wrapped up. `;
      if (topPlayer) facts += `${topPlayer.name}, playing as the ${topPlayer.team}, finished on top of the standings with a record of ${topPlayer.wins}-${(topPlayer.played || 0) - (topPlayer.wins || 0)}. `;
      if (best) facts += `The most dominant win of the season was ${best.winner.name} crushing ${best.loser.name} ${best.winnerScore}-${best.loserScore}. `;
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

  function buildMusicPrompt(milestone, state, history, styleId) {
    const style = pickStyle(styleId);
    const facts = buildFacts(milestone, state, history);
    const prompt =
      `${style.tag}. Write and perform an English-language hip-hop track about this real ` +
      `story from a fantasy football tournament: ${facts} ` +
      `Make it energetic, confident, and celebratory — a real hype/victory anthem, not a dry ` +
      `news summary. Use the names and the scoreline naturally in the lyrics. You decide the ` +
      `exact structure, hook, and ad-libs.`;
    return { prompt, styleLabel: style.label };
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
    const gf = MB.getPlayoffMatch(state, "gf");
    if (gf && gf.p1 && gf.p2 && gf.p1.id !== -1 && gf.p2.id !== -1) reached.push("finals");
    if (gf && MB.winnerOf(gf)) reached.push("champion");
    return reached;
  }

  async function generateAndStoreSong({ apiKey, modelId, milestone, state, history, tournamentId, lengthMs, styleId }) {
    if (!apiKey) throw new Error("Kein ElevenLabs-API-Key konfiguriert.");
    const { prompt, styleLabel } = buildMusicPrompt(milestone, state, history, styleId);
    const blob = await generateSong({ apiKey, prompt, lengthMs, modelId });
    const url = await uploadSongToStorage(blob, tournamentId, milestone);
    await saveSongUrl(tournamentId, milestone, url);
    return { url, styleLabel, prompt };
  }

  global.MB = global.MB || {};
  global.MB.Music = {
    STYLE_POOL, pickStyle, buildFacts, buildMusicPrompt,
    generateSong, uploadSongToStorage, saveSongUrl, detectMilestones, generateAndStoreSong,
  };
})(window);
