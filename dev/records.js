/* =========================================================================
   MADDEN BOWL — RECORDS & MEMES (records.js)
   -------------------------------------------------------------------------
   Erkennt nach jedem Score-Eintrag automatisch besondere Momente (neuer
   Allzeit-Highscore, größte Klatsche aller Zeiten/des Turniers, neue
   Siegesserie) und generiert dazu ein teilbares Meme-Bild — komplett
   client-seitig per <canvas>, KEIN API-Key, KEINE Kosten.

   WICHTIG (Copyright): es werden bewusst KEINE bekannten Meme-Vorlagen
   (Drake, Distracted Boyfriend, etc. — das sind urheberrechtlich
   geschützte Fotos/Screenshots) verwendet oder nachgebaut. Stattdessen
   eigene, einfache Grafik-Stile (Farbverläufe + große Zahlen/Text +
   Emoji) im klassischen "Bold Impact Caption"-Meme-Look, aber komplett
   selbst gezeichnet.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   ========================================================================= */

(function (global) {
  "use strict";

  const RECORD_TYPES = {
    allTimeHigh: { label: "Allzeit-Highscore", emoji: "🔥" },
    allTimeMargin: { label: "Allzeit-Klatsche", emoji: "💥" },
    tournamentMargin: { label: "Klatsche des Turniers", emoji: "🥊" },
    winStreak: { label: "Siegesserie", emoji: "🏆" },
    upset: { label: "Überraschung", emoji: "😱" },
    shutout: { label: "Abgeschossen", emoji: "🛑" },
    shootout: { label: "Shootout", emoji: "🎯" },
    finals: { label: "Finaleinzug", emoji: "🎬" },
    champion: { label: "Neuer Champion", emoji: "👑" },
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ======================================================================
  // REKORD-ERKENNUNG
  // ======================================================================
  function allFinishedMatches(state, history) {
    const out = [];
    (history?.matches || []).forEach((m) => {
      if (m.homeScore == null || m.awayScore == null) return;
      out.push({ a: m.homePlayer, b: m.awayPlayer, aScore: m.homeScore, bScore: m.awayScore });
    });
    MB.getCurrentMatchesNormalized(state).forEach((m) => {
      out.push({ a: m.homePlayer, b: m.awayPlayer, aScore: m.homeScore, bScore: m.awayScore });
    });
    return out;
  }

  function computeCurrentStreak(state, playerName) {
    const matches = MB.getCurrentMatchesNormalized(state);
    let streak = 0;
    matches.forEach((m) => {
      if (m.homePlayer !== playerName && m.awayPlayer !== playerName) return;
      const won = (m.homePlayer === playerName && m.homeScore > m.awayScore) || (m.awayPlayer === playerName && m.awayScore > m.homeScore);
      streak = won ? streak + 1 : 0;
    });
    return streak;
  }

  function computeMaxStreakExcept(state, exceptName) {
    let max = 0;
    (state.players || []).forEach((p) => {
      if (p.name === exceptName) return;
      max = Math.max(max, computeCurrentStreak(state, p.name));
    });
    return max;
  }

  // justFinished: { homeName, awayName, homeScore, awayScore }
  // Liefert ein Array neu erreichter Rekorde (meist 0 oder 1 Eintrag).
  function detectRecords(state, history, justFinished) {
    const records = [];
    const all = allFinishedMatches(state, history);

    const winnerName = justFinished.homeScore > justFinished.awayScore ? justFinished.homeName : justFinished.awayName;
    const loserName = justFinished.homeScore > justFinished.awayScore ? justFinished.awayName : justFinished.homeName;
    const winnerScore = Math.max(justFinished.homeScore, justFinished.awayScore);
    const loserScore = Math.min(justFinished.homeScore, justFinished.awayScore);
    const margin = winnerScore - loserScore;

    const maxScoreEver = all.length ? Math.max(...all.map((m) => Math.max(m.aScore, m.bScore))) : 0;
    if (winnerScore > 0 && winnerScore >= maxScoreEver) {
      records.push({ type: "allTimeHigh", player: winnerName, opponent: loserName, value: winnerScore });
    }

    const maxMarginEver = all.length ? Math.max(...all.map((m) => Math.abs(m.aScore - m.bScore))) : 0;
    if (margin > 0 && margin >= maxMarginEver) {
      records.push({ type: "allTimeMargin", player: winnerName, opponent: loserName, value: margin, winnerScore, loserScore });
    } else {
      // Nur relevant, wenn's kein Allzeit-Rekord war (sonst doppelt gemoppelt):
      // größte Distanz innerhalb des LAUFENDEN Turniers, ab einer spürbaren Schwelle.
      const currentOnly = MB.getCurrentMatchesNormalized(state);
      const maxMarginThisTournament = currentOnly.length ? Math.max(0, ...currentOnly.map((m) => Math.abs(m.homeScore - m.awayScore))) : 0;
      if (margin >= 20 && margin >= maxMarginThisTournament) {
        records.push({ type: "tournamentMargin", player: winnerName, opponent: loserName, value: margin, winnerScore, loserScore });
      }
    }

    const streak = computeCurrentStreak(state, winnerName);
    if (streak >= 3 && streak > computeMaxStreakExcept(state, winnerName)) {
      records.push({ type: "winStreak", player: winnerName, value: streak });
    }

    // Überraschung: der Sieger stand (nach aktueller Seed-/Tabellenlage)
    // deutlich schlechter da als der Verlierer.
    const seedByName = MB.getGroupSeedsFinal(state);
    const winnerSeed = seedByName.get(winnerName), loserSeed = seedByName.get(loserName);
    if (winnerSeed && loserSeed && winnerSeed - loserSeed >= 3) {
      records.push({ type: "upset", player: winnerName, opponent: loserName, winnerScore, loserScore });
    }

    // Abgeschossen: Verlierer kam kaum vom Fleck.
    if (loserScore <= 3) {
      records.push({ type: "shutout", player: winnerName, opponent: loserName, winnerScore, loserScore });
    }

    // Shootout: neue Höchstmarke bei der Gesamtpunktzahl in diesem Turnier.
    const total = winnerScore + loserScore;
    const currentOnly = MB.getCurrentMatchesNormalized(state);
    const maxTotalThisTournament = currentOnly.length ? Math.max(0, ...currentOnly.map((m) => m.homeScore + m.awayScore)) : 0;
    if (total >= 70 && total >= maxTotalThisTournament) {
      records.push({ type: "shootout", player: winnerName, opponent: loserName, winnerScore, loserScore });
    }

    return records;
  }

  // Große Turnier-Meilensteine (Finaleinzug, neuer Champion) — separat von
  // detectRecords(), da nicht an ein einzelnes gerade beendetes Spiel
  // gebunden, sondern an den Bracket-Zustand. `already` ist ein Set/Objekt
  // mit bereits gemeldeten Meilensteinen (damit nicht bei jedem weiteren
  // Score-Eintrag erneut gefeuert wird).
  function detectMilestoneRecords(state, already) {
    const records = [];
    const gf = MB.getPlayoffMatch(state, "gf");

    if (!already.finals && gf && gf.p1 && gf.p2 && gf.p1.id !== -1 && gf.p2.id !== -1) {
      records.push({ type: "finals", p1: gf.p1.name, p2: gf.p2.name });
    }
    if (!already.champion && gf) {
      const champion = MB.winnerOf(gf), runnerUp = MB.loserOf(gf);
      if (champion && runnerUp) {
        records.push({ type: "champion", player: champion.name, opponent: runnerUp.name, winnerScore: Math.max(gf.s1, gf.s2), loserScore: Math.min(gf.s1, gf.s2) });
      }
    }
    return records;
  }

  // ======================================================================
  // MEME-GENERATOR (Canvas, eigene Grafik-Stile — keine Meme-Vorlagen-Fotos)
  // ======================================================================
  const MEME_STYLES = [
    { id: "blast", bg: ["#1a0000", "#4d0000"], accent: "#ff3b30", icon: "💥" },
    { id: "gold", bg: ["#3a2a00", "#7a5a00"], accent: "#ffd700", icon: "🏆" },
    { id: "neon", bg: ["#001a1a", "#003333"], accent: "#00ffcc", icon: "⚡" },
    { id: "fire", bg: ["#331100", "#662200"], accent: "#ff6600", icon: "🔥" },
  ];

  function buildMemeCaptions(record) {
    switch (record.type) {
      case "allTimeHigh":
        return { top: "NEUER ALLZEIT-HIGHSCORE", main: `${record.value}`, bottom: `${record.player} vs ${record.opponent}` };
      case "allTimeMargin":
        return { top: "GRÖSSTE KLATSCHE ALLER ZEITEN", main: `${record.winnerScore}:${record.loserScore}`, bottom: `${record.player} demütigt ${record.opponent}` };
      case "tournamentMargin":
        return { top: "KLATSCHE DES TURNIERS", main: `${record.winnerScore}:${record.loserScore}`, bottom: `${record.player} vs ${record.opponent}` };
      case "winStreak":
        return { top: "SIEGESSERIE", main: `${record.value}x IN FOLGE`, bottom: `${record.player} ist nicht zu stoppen` };
      case "upset":
        return { top: "ÜBERRASCHUNG DES TAGES", main: `${record.winnerScore}:${record.loserScore}`, bottom: `${record.player} schlägt ${record.opponent}` };
      case "shutout":
        return { top: "ABGESCHOSSEN", main: `${record.winnerScore}:${record.loserScore}`, bottom: `${record.opponent} kam nicht vom Fleck` };
      case "shootout":
        return { top: "SHOOTOUT", main: `${record.winnerScore}:${record.loserScore}`, bottom: `${record.player} vs ${record.opponent}` };
      case "finals":
        return { top: "DAS FINALE STEHT FEST", main: "🏆", bottom: `${record.p1} vs ${record.p2}` };
      case "champion":
        return { top: "NEUER MADDEN BOWL CHAMPION", main: `${record.player}`, bottom: `Sieg gegen ${record.opponent} ${record.winnerScore}:${record.loserScore}` };
      default:
        return { top: "MADDEN BOWL", main: "", bottom: "" };
    }
  }

  function wrapAndDraw(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "", lines = [];
    words.forEach((w) => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
      ctx.strokeText(l, x, startY + i * lineHeight);
      ctx.fillText(l, x, startY + i * lineHeight);
    });
  }

  function renderMemeCanvas(record, styleId) {
    const style = MEME_STYLES.find((s) => s.id === styleId) || pick(MEME_STYLES);
    const caps = buildMemeCaptions(record);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080; // quadratisch — passt gut für WhatsApp/Insta

    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, style.bg[0]);
    grad.addColorStop(1, style.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // großes Emoji als dezentes Hintergrund-Element
    ctx.font = "460px sans-serif";
    ctx.globalAlpha = 0.16;
    ctx.textAlign = "center";
    ctx.fillText(style.icon, canvas.width / 2, canvas.height / 2 + 150);
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";

    ctx.font = `900 58px Impact, "Arial Black", sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    wrapAndDraw(ctx, caps.top, canvas.width / 2, 150, 940, 68);

    ctx.font = `900 140px Impact, "Arial Black", sans-serif`;
    ctx.lineWidth = 14; ctx.strokeStyle = "#000"; ctx.fillStyle = style.accent;
    ctx.fillText(caps.main, canvas.width / 2, canvas.height / 2 + 50);
    ctx.strokeText(caps.main, canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(caps.main, canvas.width / 2, canvas.height / 2 + 50);

    ctx.font = `900 46px Impact, "Arial Black", sans-serif`;
    ctx.lineWidth = 7; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    wrapAndDraw(ctx, caps.bottom, canvas.width / 2, canvas.height - 130, 940, 54);

    ctx.font = "26px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "right";
    ctx.fillText("🏈 Madden Bowl", canvas.width - 30, canvas.height - 30);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // Web Share API (mit Datei) wenn verfügbar -> Systemshare-Sheet inkl.
  // WhatsApp als Option. Sonst Fallback: Bild-Download.
  async function shareOrDownloadMeme(canvas, filename) {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], filename || "madden-bowl-meme.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Madden Bowl", text: "Schau dir das an! 🏈" });
        return "shared";
      } catch (e) {
        if (e.name === "AbortError") return "cancelled";
        // sonst: unten zum Download-Fallback durchfallen
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "madden-bowl-meme.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  }

  // Teilen eines FREMD gehosteten Bildes (z.B. von imgflip). Versucht erst
  // "echtes" Datei-Teilen (Bild landet direkt in WhatsApp), fällt bei
  // CORS-Problemen auf reines Link-Teilen zurück, und als letzten Ausweg
  // auf "Bild in neuem Tab öffnen" (manuell speichern/teilen).
  async function shareOrOpenRemoteImage(url, filename) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename || "madden-bowl-meme.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Madden Bowl", text: "Schau dir das an! 🏈" });
        return "shared";
      }
    } catch (e) {
      // CORS oder Share fehlgeschlagen -> weiter zu Fallbacks
    }
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "Madden Bowl", text: "Schau dir das an! 🏈" });
        return "shared-link";
      } catch (e) {
        if (e.name === "AbortError") return "cancelled";
      }
    }
    window.open(url, "_blank");
    return "opened";
  }

  // ======================================================================
  // IMGFLIP (optional, kostenlos, echte Meme-Vorlagen)
  // -------------------------------------------------------------------------
  // Free-Tier von imgflip.com/api: /caption_image ist kostenlos, braucht
  // aber Zugangsdaten eines (kostenlosen) Imgflip-Accounts. "automeme"
  // (KI wählt die Vorlage) ist Premium — wir bilden das stattdessen selbst
  // nach: feste, thematisch passende Vorlagen-Pools pro Rekord-Typ.
  // ======================================================================
  function getImgflipSettings() {
    try { return JSON.parse(localStorage.getItem("mb_imgflip_settings") || "{}"); }
    catch (e) { return {}; }
  }
  function setImgflipSettings(s) {
    try { localStorage.setItem("mb_imgflip_settings", JSON.stringify(s || {})); }
    catch (e) { console.warn("Imgflip-Settings konnten nicht gespeichert werden:", e); }
  }

  // Quelle: https://imgflip.com/popular-meme-ids (Stand siehe Doku-Abruf) —
  // bewusst nur Vorlagen mit einfachem "oben/unten"-Text gewählt, die auch
  // mit generischen Captions gut funktionieren (keine Vorlagen, deren Witz
  // zwingend zwei GEGENSÄTZLICHE Boxen braucht, z.B. Drake).
  const IMGFLIP_TEMPLATE_POOLS = {
    allTimeHigh: [61544, 155067746, 28251713],       // Success Kid, Surprised Pikachu, Oprah You Get A
    allTimeMargin: [55311130, 97984, 188390779],     // This Is Fine, Disaster Girl, Woman Yelling At Cat
    tournamentMargin: [188390779, 97984, 101470],    // Woman Yelling At Cat, Disaster Girl, Ancient Aliens
    winStreak: [61532, 61544, 8072285],              // Most Interesting Man, Success Kid, Doge
    upset: [61579, 155067746, 101470],               // One Does Not Simply, Surprised Pikachu, Ancient Aliens
    shutout: [55311130, 99683372, 188390779],        // This Is Fine, Sleeping Shaq, Woman Yelling At Cat
    shootout: [61544, 28251713, 8072285],            // Success Kid, Oprah You Get A, Doge
    finals: [101910402, 135256802, 101470],          // Who Would Win?, Epic Handshake, Ancient Aliens
    champion: [61544, 61532, 29617627],              // Success Kid, Most Interesting Man, Look At Me
  };

  function buildImgflipCaptions(record) {
    switch (record.type) {
      case "allTimeHigh": return { top: "NEW ALL-TIME HIGH SCORE", bottom: `${record.player}: ${record.value} POINTS` };
      case "allTimeMargin": return { top: "BIGGEST BLOWOUT EVER", bottom: `${record.player} ${record.winnerScore}-${record.loserScore} ${record.opponent}` };
      case "tournamentMargin": return { top: "BLOWOUT OF THE SEASON", bottom: `${record.player} ${record.winnerScore}-${record.loserScore} ${record.opponent}` };
      case "winStreak": return { top: `${record.player} IS ON FIRE`, bottom: `${record.value} WINS IN A ROW` };
      case "upset": return { top: "UPSET ALERT", bottom: `${record.player} JUST TOOK DOWN ${record.opponent}` };
      case "shutout": return { top: `${record.opponent} GOT SHUT DOWN`, bottom: `${record.player} ${record.winnerScore}-${record.loserScore}` };
      case "shootout": return { top: "OFFENSE ONLY, NO DEFENSE", bottom: `${record.player} ${record.winnerScore}-${record.loserScore} ${record.opponent}` };
      case "finals": return { top: "THE MADDEN BOWL FINAL IS SET", bottom: `${record.p1} VS ${record.p2}` };
      case "champion": return { top: "NEW MADDEN BOWL CHAMPION", bottom: `${record.player}` };
      default: return { top: "MADDEN BOWL", bottom: "" };
    }
  }

  function pickImgflipTemplate(recordType, forcedId) {
    if (forcedId) return forcedId;
    const pool = IMGFLIP_TEMPLATE_POOLS[recordType] || IMGFLIP_TEMPLATE_POOLS.allTimeHigh;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function generateImgflipMeme(record, { username, password, templateId } = {}) {
    if (!username || !password) throw new Error("Imgflip-Zugangsdaten fehlen.");
    const caps = buildImgflipCaptions(record);
    const tid = pickImgflipTemplate(record.type, templateId);
    const body = new URLSearchParams({
      template_id: String(tid), username, password,
      text0: caps.top, text1: caps.bottom,
    });
    const res = await fetch("https://api.imgflip.com/caption_image", { method: "POST", body });
    const json = await res.json();
    if (!json.success) throw new Error(json.error_message || "Imgflip-Fehler (unbekannt)");
    return { url: json.data.url, pageUrl: json.data.page_url, templateId: tid };
  }

  // ======================================================================
  // SUPABASE-PERSISTENZ — damit Rekord-Momente auch auf einem zweiten
  // Gerät (z.B. live.html?Altima am Handy) sichtbar sind, nicht nur lokal
  // im Browser des Admin-Laptops.
  // ======================================================================
  async function uploadMemeToStorage(canvas, tournamentId, recordType) {
    const sb = MB.getSupabaseClient();
    if (!sb) throw new Error("Supabase-Client nicht verfügbar");
    const blob = await canvasToBlob(canvas);
    const path = `${tournamentId || "unbekannt"}/${recordType}-${Date.now()}.png`;
    const { error } = await sb.storage.from("mb-memes").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from("mb-memes").getPublicUrl(path);
    return data.publicUrl;
  }

  async function pushRecordMoment(tournamentId, record) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return null;
    const { data, error } = await sb.from("record_moments")
      .insert({ tournament_id: tournamentId, type: record.type, payload: record })
      .select().single();
    if (error) { console.warn("Rekord-Moment konnte nicht gespeichert werden:", error); return null; }
    return data;
  }

  async function fetchRecordMoments(tournamentId) {
    const sb = MB.getSupabaseClient();
    if (!sb || !tournamentId) return [];
    const { data, error } = await sb.from("record_moments")
      .select("*").eq("tournament_id", tournamentId).eq("dismissed", false)
      .order("created_at", { ascending: false });
    if (error) { console.warn("Rekord-Momente laden fehlgeschlagen:", error); return []; }
    return data || [];
  }

  async function dismissRecordMoment(id) {
    const sb = MB.getSupabaseClient();
    if (!sb) return;
    const { error } = await sb.from("record_moments").update({ dismissed: true }).eq("id", id);
    if (error) console.warn("Rekord-Moment konnte nicht ausgeblendet werden:", error);
  }

  global.MB = global.MB || {};
  global.MB.Records = {
    RECORD_TYPES, MEME_STYLES, IMGFLIP_TEMPLATE_POOLS,
    detectRecords, detectMilestoneRecords, buildMemeCaptions, renderMemeCanvas, canvasToBlob,
    shareOrDownloadMeme, shareOrOpenRemoteImage,
    getImgflipSettings, setImgflipSettings, buildImgflipCaptions, pickImgflipTemplate, generateImgflipMeme,
    pushRecordMoment, fetchRecordMoments, dismissRecordMoment, uploadMemeToStorage,
  };
})(window);
