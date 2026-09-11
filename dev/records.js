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
    storyMeme: { label: "Story-Meme", emoji: "🎭" },
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

  // Entfernt GENAU EIN Vorkommen von "justFinished" aus einer Liste von
  // {home, away, homeScore, awayScore}-Objekten (Reihenfolge Heim/Auswärts
  // egal). Wird gebraucht, weil `state` beim Aufruf von detectRecords()
  // bereits das neue Ergebnis enthält — ohne diesen Ausschluss taucht das
  // gerade beendete Spiel in seinem eigenen "bisherige Höchstwerte"-Pool
  // auf und schlägt sich damit denknotwendig immer selbst (>=), wodurch
  // praktisch JEDES Ergebnis als "neuer Rekord" durchgegangen wäre.
  function excludeJustFinished(list, justFinished, homeKey, awayKey, homeScoreKey, awayScoreKey) {
    let removed = false;
    return list.filter((m) => {
      if (removed) return true;
      const home = m[homeKey], away = m[awayKey], hs = m[homeScoreKey], as = m[awayScoreKey];
      const isSelf =
        (home === justFinished.homeName && away === justFinished.awayName && hs === justFinished.homeScore && as === justFinished.awayScore) ||
        (home === justFinished.awayName && away === justFinished.homeName && hs === justFinished.awayScore && as === justFinished.homeScore);
      if (isSelf) { removed = true; return false; }
      return true;
    });
  }

  // justFinished: { homeName, awayName, homeScore, awayScore }
  // Liefert ein Array neu erreichter Rekorde (meist 0 oder 1 Eintrag).
  function detectRecords(state, history, justFinished) {
    const records = [];
    const all = excludeJustFinished(allFinishedMatches(state, history), justFinished, "a", "b", "aScore", "bScore");
    const currentOnly = excludeJustFinished(MB.getCurrentMatchesNormalized(state), justFinished, "homePlayer", "awayPlayer", "homeScore", "awayScore");

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
      case "storyMeme": {
        const caps = buildStoryCaptions(record);
        return { top: caps.top, main: record.score || "", bottom: caps.bottom };
      }
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

  // Vorlagen-IDs frisch gegen https://api.imgflip.com/get_memes geprüft
  // (bzw. aus der bereits laufenden Auswahl übernommen) — bewusst nur
  // Vorlagen mit einfachem "oben/unten"-Text (box_count 2), damit jede
  // auch mit unserem text0/text1-Aufruf sauber funktioniert. Jede Vorlage
  // hat jetzt ihren EIGENEN, auf ihr Bildformat zugeschnittenen Text statt
  // eines einzigen generischen Textes pro Anlass.
  const IMGFLIP_TEMPLATE_POOLS = {
    allTimeHigh: [
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "NEUER ALLZEIT-HIGHSCORE", bottom: `${r.player}: ${r.value} PUNKTE` }) },
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `${r.opponent}, als ${r.player}`, bottom: `${r.value} Punkte auflegt` }) },
      { id: 28251713, name: "Oprah You Get A", caption: (r) => ({ top: `${r.player} bekommt einen Punkt!`, bottom: `Und noch einen! ${r.value} PUNKTE FÜR ALLE!` }) },
      { id: 181913649, name: "Drake Hotline Bling", caption: (r) => ({ top: "Der alte Highscore", bottom: `${r.value} Punkte von ${r.player} 🔥` }) },
      { id: 4087833, name: "Waiting Skeleton", caption: (r) => ({ top: `Warten, bis jemand die ${r.value} Punkte von ${r.player} toppt`, bottom: "..." }) },
    ],
    allTimeMargin: [
      { id: 55311130, name: "This Is Fine", caption: (r) => ({ top: `${r.opponent} nach dem ${r.winnerScore}:${r.loserScore}`, bottom: "Ist schon ok, alles im Griff 🔥" }) },
      { id: 97984, name: "Disaster Girl", caption: (r) => ({ top: r.player, bottom: `nach der ${r.winnerScore}:${r.loserScore}-Demütigung von ${r.opponent}` }) },
      { id: 188390779, name: "Woman Yelling At Cat", caption: (r) => ({ top: "GRÖSSTE KLATSCHE ALLER ZEITEN", bottom: `${r.player} ${r.winnerScore}:${r.loserScore} ${r.opponent}` }) },
      { id: 217743513, name: "UNO Draw 25 Cards", caption: (r) => ({ top: `${r.opponent} gegen ${r.player}`, bottom: `zieht ein ${r.winnerScore}:${r.loserScore}` }) },
      { id: 129242436, name: "Change My Mind", caption: (r) => ({ top: `${r.winnerScore}:${r.loserScore} ist die größte Klatsche aller Zeiten.`, bottom: "Change my mind." }) },
    ],
    tournamentMargin: [
      { id: 188390779, name: "Woman Yelling At Cat", caption: (r) => ({ top: "KLATSCHE DES TURNIERS", bottom: `${r.player} ${r.winnerScore}:${r.loserScore} ${r.opponent}` }) },
      { id: 97984, name: "Disaster Girl", caption: (r) => ({ top: r.player, bottom: `feiert die ${r.winnerScore}:${r.loserScore}-Turnierklatsche gegen ${r.opponent}` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.player} gewinnt ${r.winnerScore}:${r.loserScore}`, bottom: "Ich sag ja nur: Rekordklatsche" }) },
      { id: 161865971, name: "Marked Safe From", caption: (r) => ({ top: `${r.opponent} hat sich safe markiert vor`, bottom: `einer ${r.winnerScore}:${r.loserScore}-Klatsche von ${r.player}` }) },
      { id: 438680, name: "Batman Slapping Robin", caption: (r) => ({ top: `${r.opponent}: 'War doch nur ein Spiel'`, bottom: `${r.player}: '${r.winnerScore}:${r.loserScore}!'` }) },
    ],
    winStreak: [
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "Ich verliere nicht oft", bottom: `aber wenn, dann nicht gegen ${r.player} (${r.value}x in Folge)` }) },
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "SIEGESSERIE", bottom: `${r.player}: ${r.value}x in Folge` }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: `such ${r.player}`, bottom: `much win, ${r.value}x in folge, wow` }) },
      { id: 252600902, name: "Always Has Been", caption: (r) => ({ top: `Warte, ${r.player} ist seit ${r.value} Spielen ungeschlagen?`, bottom: "Immer schon gewesen" }) },
      { id: 14371066, name: "Star Wars Yoda", caption: (r) => ({ top: "Gewinnen oder nicht gewinnen", bottom: `${r.value} Siege in Folge für ${r.player}. Kein "versuchen".` }) },
    ],
    upset: [
      { id: 61579, name: "One Does Not Simply", caption: (r) => ({ top: "MAN GEWINNT NICHT EINFACH SO", bottom: `gegen ${r.opponent} — ${r.player} aber schon (${r.winnerScore}:${r.loserScore})` }) },
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `${r.opponent}, favorisiert,`, bottom: `beim ${r.winnerScore}:${r.loserScore} gegen ${r.player}` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.player} schlägt ${r.opponent}`, bottom: "Ich sag ja nur: Überraschung" }) },
      { id: 102156234, name: "Mocking Spongebob", caption: (r) => ({ top: `${r.opponent} vorher: 'iCh GeWiNNe LoCkEr'`, bottom: `${r.winnerScore}:${r.loserScore} für ${r.player}` }) },
      { id: 123999232, name: "The Scroll Of Truth", caption: (r) => ({ top: `${r.opponent} war eigentlich gar nicht so gut`, bottom: `wie das ${r.winnerScore}:${r.loserScore} gegen ${r.player} zeigt` }) },
    ],
    shutout: [
      { id: 55311130, name: "This Is Fine", caption: (r) => ({ top: `${r.opponent} bei ${r.loserScore} Punkten`, bottom: "Alles im Griff 🔥" }) },
      { id: 99683372, name: "Sleeping Shaq", caption: (r) => ({ top: `${r.opponent}s Verteidigung`, bottom: `beim ${r.winnerScore}:${r.loserScore} gegen ${r.player}` }) },
      { id: 188390779, name: "Woman Yelling At Cat", caption: (r) => ({ top: "ABGESCHOSSEN", bottom: `${r.player} ${r.winnerScore}:${r.loserScore} ${r.opponent}` }) },
      { id: 27813981, name: "Hide the Pain Harold", caption: (r) => ({ top: `${r.opponent} nach dem ${r.winnerScore}:${r.loserScore}`, bottom: "Alles bestens 🙂" }) },
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: r.opponent, bottom: `kommt gegen ${r.player} nur auf ${r.loserScore} Punkte` }) },
    ],
    shootout: [
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "SHOOTOUT", bottom: `${r.winnerScore}:${r.loserScore} — ${r.player} vs ${r.opponent}` }) },
      { id: 28251713, name: "Oprah You Get A", caption: (r) => ({ top: `${r.player} bekommt einen Touchdown!`, bottom: `Und du auch, ${r.opponent}! (${r.winnerScore}:${r.loserScore})` }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: "such offense", bottom: `much ${r.winnerScore}:${r.loserScore}, wow, no defense` }) },
      { id: 91538330, name: "X, X Everywhere", caption: () => ({ top: "Touchdowns,", bottom: "Touchdowns überall" }) },
      { id: 124055727, name: "Y'all Got Any More Of That", caption: (r) => ({ top: `${r.player} & ${r.opponent} beim ${r.winnerScore}:${r.loserScore}`, bottom: "Y'all got any more of that offense?" }) },
    ],
    finals: [
      { id: 101910402, name: "Who Would Win", caption: (r) => ({ top: r.p1, bottom: `${r.p2} — das Finale ist da` }) },
      { id: 135256802, name: "Epic Handshake", caption: (r) => ({ top: r.p1, bottom: `${r.p2} — beide wollen den Madden Bowl` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.p1} vs ${r.p2} im Finale`, bottom: "Ich sag ja nur: Legendär" }) },
      { id: 110133729, name: "Spiderman Pointing At Spiderman", caption: (r) => ({ top: r.p1, bottom: `${r.p2} — im Finale spiegelgleich` }) },
      { id: 3218037, name: "This Is Where I'd Put My Trophy If I Had One", caption: (r) => ({ top: `${r.p1} und ${r.p2}`, bottom: "kämpfen um den einzigen Trophäen-Platz" }) },
    ],
    champion: [
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "NEUER MADDEN BOWL CHAMPION", bottom: r.player }) },
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "Ich verliere nicht oft im Finale", bottom: `aber ${r.player} eben auch nicht (${r.winnerScore}:${r.loserScore})` }) },
      { id: 29617627, name: "Look At Me", caption: (r) => ({ top: "Schaut mich an", bottom: `ich bin der neue Champion: ${r.player}` }) },
      { id: 29562797, name: "I'm The Captain Now", caption: (r) => ({ top: "Ich bin jetzt der Captain", bottom: `sagt ${r.player}, frisch gekrönt (${r.winnerScore}:${r.loserScore})` }) },
      { id: 5496396, name: "Leonardo Dicaprio Cheers", caption: (r) => ({ top: `Auf ${r.player}`, bottom: "den neuen Madden Bowl Champion! 🏆" }) },
    ],
  };

  function buildImgflipCaptions(record, entry) {
    if (entry) return entry.caption(record);
    // Fallback (z.B. beim erzwungenen Test mit fester Template-ID ohne Treffer im Pool).
    switch (record.type) {
      case "allTimeHigh": return { top: "NEUER ALLZEIT-HIGHSCORE", bottom: `${record.player}: ${record.value} PUNKTE` };
      case "champion": return { top: "NEUER MADDEN BOWL CHAMPION", bottom: `${record.player}` };
      default: return { top: "MADDEN BOWL", bottom: "" };
    }
  }

  // Gibt den GESAMTEN Pool-Eintrag zurück (id + zugehörige Caption-Funktion),
  // nicht nur die id — nur so passt der Text garantiert zur gewählten Vorlage.
  function pickImgflipTemplate(recordType, forcedId) {
    const pool = IMGFLIP_TEMPLATE_POOLS[recordType] || IMGFLIP_TEMPLATE_POOLS.allTimeHigh;
    if (forcedId) return pool.find((e) => e.id === forcedId) || { id: forcedId, caption: null };
    return pick(pool);
  }

  async function generateImgflipMeme(record, { username, password, templateId } = {}) {
    if (!username || !password) throw new Error("Imgflip-Zugangsdaten fehlen.");
    const entry = record.type === "storyMeme" ? pickStoryTemplate(record, templateId) : pickImgflipTemplate(record.type, templateId);
    const caps = record.type === "storyMeme" ? buildStoryCaptions(record) : buildImgflipCaptions(record, entry.caption ? entry : null);
    const tid = entry.id;
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
  // STORY-MEMES — situative, ENGLISCHE Vorlagen für Momente, die sich nicht
  // aus reinen Zahlen ergeben (Fehlentscheidung, Ausrede, Comeback, ...).
  // Bewusst REIN CHECKBOX-GESTEUERT: es gibt hier absichtlich KEINE
  // automatische Auslösung allein anhand von Punktedifferenz oder Quote
  // (das hätte "bei jedem Ergebnis ein Meme" in neuer Form zurückgebracht) —
  // ein Story-Meme entsteht nur, wenn der Admin im Meme-Kontext-Dialog
  // mindestens ein Häkchen setzt.
  // ======================================================================
  const MEME_CONTEXT_TAGS = {
    ref_error: { label: "Klare Fehlentscheidung", emoji: "🤦" },
    unfair_call: { label: "Unfaire Entscheidung", emoji: "🚩" },
    controversial_call: { label: "Strittige Schiri-Entscheidung", emoji: "⚠️" },
    complaint: { label: "Spieler beschwert sich", emoji: "🗣️" },
    excuse: { label: "Absurdeste Ausrede", emoji: "🧠" },
    rage: { label: "Spieler sauer", emoji: "😤" },
    ragequit: { label: "Ragequit", emoji: "💀" },
    unexpected: { label: "Unerwartetes Ergebnis", emoji: "🤯" },
    lucky_win: { label: "Glücklicher Sieg", emoji: "🎲" },
    hype: { label: "Übertriebener Hype", emoji: "📈" },
    collapse: { label: "Kompletter Kollaps", emoji: "🫠" },
    comeback: { label: "Comeback", emoji: "🔥" },
    decision_game: { label: "Entscheidungsspiel", emoji: "🚨" },
  };

  const STORY_MEME_TEMPLATES = {
    ref: [
      { id: 21900001, name: "NFL Referee", caption: (r) => ({ top: "THE REF AFTER THAT CALL:", bottom: `${r.loser} still isn't over it` }) },
      { id: 129242436, name: "Change My Mind", caption: () => ({ top: "That was never a penalty.", bottom: "Change my mind." }) },
      { id: 61579, name: "One Does Not Simply", caption: (r) => ({ top: "ONE DOES NOT SIMPLY", bottom: `WIN AGAINST ${String(r.opponent || "").toUpperCase()} WITHOUT HELP FROM THE REFS` }) },
    ],
    excuse: [
      { id: 89370399, name: "Roll Safe Think About It", caption: () => ({ top: "CAN'T LOSE ON SKILL", bottom: "IF YOU BLAME THE CONTROLLER" }) },
      { id: 27813981, name: "Hide the Pain Harold", caption: (r) => ({ top: `${r.loser} EXPLAINING THE ${r.score}`, bottom: "IT'S FINE, TOTALLY FINE" }) },
      { id: 91998305, name: "Drake Blank", caption: (r) => ({ top: "IT WAS THE LAG", bottom: `IT WAS ${r.winner ? String(r.winner).toUpperCase() : "THE OTHER GUY"} BEING BETTER` }) },
    ],
    collapse: [
      { id: 203723093, name: "Patrick Mahomes on Ground", caption: (r) => ({ top: `${r.loser}'S LEAD`, bottom: `AFTER THE ${r.score} COLLAPSE` }) },
      { id: 55311130, name: "This Is Fine", caption: (r) => ({ top: `${r.loser}, ${r.score} DOWN`, bottom: "THIS IS FINE" }) },
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: r.loser, bottom: "HAD IT WON, THEN DIDN'T" }) },
    ],
    comeback: [
      { id: 252600902, name: "Always Has Been", caption: (r) => ({ top: `WAIT, ${String(r.winner || "").toUpperCase()} CAME BACK FROM THAT?`, bottom: "ALWAYS HAS BEEN" }) },
      { id: 259237855, name: "Laughing Leo", caption: (r) => ({ top: `${r.winner} AFTER THE COMEBACK`, bottom: r.score }) },
      { id: 91538330, name: "X, X Everywhere", caption: () => ({ top: "COMEBACKS,", bottom: "COMEBACKS EVERYWHERE" }) },
    ],
    upset: [
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `THE FAVORITE, AFTER LOSING TO ${String(r.winner || "").toUpperCase()}`, bottom: r.score }) },
      { id: 102156234, name: "Mocking Spongebob", caption: (r) => ({ top: `${r.loser} PRE-GAME: 'iM wInNiNg tHiS eAsY'`, bottom: r.score }) },
      { id: 123999232, name: "The Scroll Of Truth", caption: (r) => ({ top: `${r.loser} WASN'T THAT GOOD ANYWAY`, bottom: `AS THE ${r.score} SHOWS` }) },
    ],
    close: [
      { id: 155692896, name: "Screaming", caption: (r) => ({ top: "NO ONE KNEW WHO WAS WINNING", bottom: r.score }) },
      { id: 221578498, name: "Grant Gustin Over Grave", caption: (r) => ({ top: `${r.loser} INTERNALLY`, bottom: `AFTER LOSING BY ONE SCORE (${r.score})` }) },
      { id: 4087833, name: "Waiting Skeleton", caption: () => ({ top: "WAITING FOR THE LAST SECOND", bottom: "TO FIND OUT WHO WON" }) },
    ],
    blowout: [
      { id: 203723093, name: "Patrick Mahomes on Ground", caption: (r) => ({ top: r.loser, bottom: `AFTER THE ${r.score}` }) },
      { id: 188390779, name: "Woman Yelling At Cat", caption: (r) => ({ top: "THEY SAID IT WOULD BE CLOSE", bottom: r.score }) },
      { id: 27813981, name: "Hide the Pain Harold", caption: (r) => ({ top: r.loser, bottom: `AFTER THE ${r.score}` }) },
    ],
    hype: [
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "I DON'T ALWAYS TALK TRASH", bottom: `BUT WHEN I DO, I'M ${String(r.winner || "").toUpperCase()}` }) },
      { id: 259237855, name: "Laughing Leo", caption: (r) => ({ top: `${r.winner} AFTER ONE (1) GOOD GAME`, bottom: "THE HYPE:" }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: `such ${r.winner}`, bottom: "much hype, one game, wow" }) },
    ],
    ragequit: [
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: r.loser, bottom: "RAGE QUITS AFTER ONE BAD DRIVE" }) },
      { id: 61520, name: "Futurama Fry", caption: () => ({ top: "NOT SURE IF CONTROLLER BROKE", bottom: "OR SOMEONE JUST RAGE QUIT" }) },
    ],
    decision_game: [
      { id: 226297822, name: "Panik Kalm Panik", caption: (r) => ({ top: `${r.winner} BEFORE THE DECISION GAME`, bottom: "DURING / AFTER WINNING IT" }) },
      { id: 4087833, name: "Waiting Skeleton", caption: () => ({ top: "WAITING FOR THE DECISION GAME", bottom: "TO FINALLY SETTLE IT" }) },
    ],
    general: [
      { id: 115398544, name: "Spongebob Rainbow", caption: (r) => ({ top: "MADDEN BOWL MOMENT:", bottom: r.score }) },
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: "WELL, THAT HAPPENED.", bottom: r.score }) },
      { id: 4087833, name: "Waiting Skeleton", caption: () => ({ top: "MADDEN BOWL,", bottom: "SOMETHING ALWAYS HAPPENS" }) },
    ],
  };

  function storyScoreStr(record) {
    const w = record.winnerScore ?? Math.max(record.homeScore ?? 0, record.awayScore ?? 0);
    const l = record.loserScore ?? Math.min(record.homeScore ?? 0, record.awayScore ?? 0);
    return `${w}-${l}`;
  }

  // Wählt die Story-Kategorie NUR aus den vom Admin gesetzten Tags — reine
  // Zahlenmuster (Punktedifferenz, Außenseitersieg laut Quote) lösen hier
  // bewusst NICHTS mehr von selbst aus (siehe Kommentar oben).
  function detectStoryMeme(record) {
    if (!record || record.homeScore == null || record.awayScore == null || record.homeScore === record.awayScore) return null;
    const c = record.memeContext || {};
    if (!Object.keys(MEME_CONTEXT_TAGS).some((k) => c[k])) return null; // kein Häkchen -> kein Story-Meme

    const winner = record.homeScore > record.awayScore ? record.homeName : record.awayName;
    const loser = record.homeScore > record.awayScore ? record.awayName : record.homeName;
    let key = "general", score = 0;
    const add = (k, pts) => { if (pts > score) { key = k; score = pts; } };

    if (c.ref_error) add("ref", 110);
    if (c.unfair_call) add("ref", 105);
    if (c.controversial_call) add("ref", 100);
    if (c.complaint) add("ref", 95);
    if (c.excuse) add("excuse", 115);
    if (c.collapse) add("collapse", 105);
    if (c.comeback) add("comeback", 100);
    if (c.ragequit) add("ragequit", 98);
    if (c.rage) add("ragequit", 90);
    if (c.hype) add("hype", 95);
    if (c.lucky_win) add("upset", 88);
    if (c.unexpected) add("upset", 90);
    if (c.decision_game) add("decision_game", 82);

    // Bei Gleichstand mehrerer Tags (oder wenn nur Punktemuster übrig bleibt,
    // aber IMMER erst nachdem mindestens ein Tag gesetzt wurde): Rand als
    // Tie-Breaker für die Bildauswahl, nicht als eigener Auslöser.
    const margin = Math.abs(record.homeScore - record.awayScore);
    if (score === 0) {
      if (margin >= 21) key = "blowout";
      else if (margin <= 3) key = "close";
    }

    return { ...record, type: "storyMeme", storyKey: key, player: winner, opponent: loser, score: storyScoreStr(record) };
  }

  function buildStoryCaptions(record) {
    const key = record.storyKey || "general";
    const pool = STORY_MEME_TEMPLATES[key] || STORY_MEME_TEMPLATES.general;
    const entry = record._storyEntry || pick(pool);
    return entry.caption(record);
  }

  function pickStoryTemplate(record, forcedId) {
    const pool = STORY_MEME_TEMPLATES[record.storyKey] || STORY_MEME_TEMPLATES.general;
    const entry = forcedId ? (pool.find((e) => e.id === forcedId) || pool[0]) : pick(pool);
    record._storyEntry = entry; // merkt sich die Wahl, damit Bild & Text zueinander passen
    return entry;
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
    RECORD_TYPES, MEME_STYLES, IMGFLIP_TEMPLATE_POOLS, MEME_CONTEXT_TAGS, STORY_MEME_TEMPLATES,
    detectRecords, detectMilestoneRecords, buildMemeCaptions, renderMemeCanvas, canvasToBlob,
    detectStoryMeme, buildStoryCaptions, pickStoryTemplate,
    shareOrDownloadMeme, shareOrOpenRemoteImage,
    getImgflipSettings, setImgflipSettings, buildImgflipCaptions, pickImgflipTemplate, generateImgflipMeme,
    pushRecordMoment, fetchRecordMoments, dismissRecordMoment, uploadMemeToStorage,
  };
})(window);
