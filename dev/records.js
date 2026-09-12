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

    // Abgeschossen: Verlierer kam kaum vom Fleck — UND der Sieger hat
    // tatsächlich etwas aufgelegt (sonst wäre auch ein zäher 2:1 ein
    // "Abschuss", was es offensichtlich nicht ist).
    if (loserScore <= 3 && winnerScore >= 14) {
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
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "NEW ALL-TIME HIGH SCORE", bottom: `${r.player}: ${r.value} POINTS` }) },
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `${r.opponent}, WHEN ${String(r.player || "").toUpperCase()}`, bottom: `DROPS ${r.value} POINTS` }) },
      { id: 28251713, name: "Oprah You Get A", caption: (r) => ({ top: `${r.player} GETS A POINT!`, bottom: `AND ANOTHER! ${r.value} POINTS FOR EVERYONE!` }) },
      { id: 181913649, name: "Drake Hotline Bling", caption: (r) => ({ top: "THE OLD HIGH SCORE", bottom: `${r.value} POINTS BY ${r.player} 🔥` }) },
      { id: 4087833, name: "Waiting Skeleton", caption: (r) => ({ top: `WAITING FOR SOMEONE TO BEAT ${r.player}'S ${r.value} POINTS`, bottom: "..." }) },
    ],
    allTimeMargin: [
      { id: 55311130, name: "This Is Fine", caption: (r) => ({ top: `${r.opponent} AFTER THE ${r.winnerScore}-${r.loserScore}`, bottom: "IT'S FINE, TOTALLY IN CONTROL 🔥" }) },
      { id: 97984, name: "Disaster Girl", caption: (r) => ({ top: r.player, bottom: `AFTER THE ${r.winnerScore}-${r.loserScore} HUMILIATION OF ${r.opponent}` }) },
      { id: 217743513, name: "UNO Draw 25 Cards", caption: (r) => ({ top: `${r.opponent} vs ${r.player}`, bottom: `DRAWS A ${r.winnerScore}-${r.loserScore}` }) },
      { id: 129242436, name: "Change My Mind", caption: (r) => ({ top: `${r.winnerScore}-${r.loserScore} IS THE BIGGEST BLOWOUT EVER.`, bottom: "Change my mind." }) },
    ],
    tournamentMargin: [
      { id: 97984, name: "Disaster Girl", caption: (r) => ({ top: r.player, bottom: `CELEBRATING THE ${r.winnerScore}-${r.loserScore} BLOWOUT OF ${r.opponent}` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.player} WINS ${r.winnerScore}-${r.loserScore}`, bottom: "I'M JUST SAYING: RECORD BLOWOUT" }) },
      { id: 438680, name: "Batman Slapping Robin", caption: (r) => ({ top: `${r.opponent}: "IT WAS JUST ONE GAME"`, bottom: `${r.player}: "${r.winnerScore}-${r.loserScore}!"` }) },
    ],
    winStreak: [
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "I DON'T LOSE OFTEN", bottom: `BUT WHEN I DO, IT'S NOT TO ${String(r.player || "").toUpperCase()} (${r.value} IN A ROW)` }) },
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "WIN STREAK", bottom: `${r.player}: ${r.value} IN A ROW` }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: `such ${r.player}`, bottom: `much win, ${r.value} in a row, wow` }) },
      { id: 252600902, name: "Always Has Been", caption: (r) => ({ top: `WAIT, ${String(r.player || "").toUpperCase()} IS UNDEFEATED IN ${r.value} GAMES?`, bottom: "ALWAYS HAS BEEN" }) },
      { id: 14371066, name: "Star Wars Yoda", caption: (r) => ({ top: "WIN, OR WIN NOT", bottom: `${r.value} STRAIGHT WINS FOR ${r.player}. THERE IS NO "TRY".` }) },
    ],
    upset: [
      { id: 61579, name: "One Does Not Simply", caption: (r) => ({ top: "ONE DOES NOT SIMPLY BEAT", bottom: `${r.opponent} — YET ${r.player} JUST DID (${r.winnerScore}-${r.loserScore})` }) },
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `${r.opponent}, THE FAVORITE,`, bottom: `AFTER THE ${r.winnerScore}-${r.loserScore} LOSS TO ${r.player}` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.player} BEATS ${r.opponent}`, bottom: "I'M JUST SAYING: UPSET" }) },
      { id: 102156234, name: "Mocking Spongebob", caption: (r) => ({ top: `${r.opponent} BEFORE THE GAME: "iM wInNiNg tHiS eAsY"`, bottom: `${r.winnerScore}-${r.loserScore} FOR ${r.player}` }) },
      { id: 123999232, name: "The Scroll Of Truth", caption: (r) => ({ top: `${r.opponent} WASN'T EVEN THAT GOOD`, bottom: `AS THE ${r.winnerScore}-${r.loserScore} LOSS TO ${r.player} SHOWS` }) },
    ],
    shutout: [
      { id: 55311130, name: "This Is Fine", caption: (r) => ({ top: `${r.opponent} AT ${r.loserScore} POINTS`, bottom: "IT'S FINE, TOTALLY IN CONTROL 🔥" }) },
      { id: 27813981, name: "Hide the Pain Harold", caption: (r) => ({ top: `${r.opponent} AFTER THE ${r.winnerScore}-${r.loserScore}`, bottom: "TOTALLY FINE 🙂" }) },
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: r.opponent, bottom: `ONLY MANAGES ${r.loserScore} POINTS AGAINST ${r.player}` }) },
    ],
    shootout: [
      { id: 61544, name: "Success Kid", caption: (r) => ({ top: "SHOOTOUT", bottom: `${r.winnerScore}-${r.loserScore} — ${r.player} VS ${r.opponent}` }) },
      { id: 28251713, name: "Oprah You Get A", caption: (r) => ({ top: `${r.player} GETS A TOUCHDOWN!`, bottom: `AND YOU GET ONE TOO, ${r.opponent}! (${r.winnerScore}-${r.loserScore})` }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: "such offense", bottom: `much ${r.winnerScore}-${r.loserScore}, wow, no defense` }) },
      { id: 91538330, name: "X, X Everywhere", caption: () => ({ top: "TOUCHDOWNS,", bottom: "TOUCHDOWNS EVERYWHERE" }) },
      { id: 124055727, name: "Y'all Got Any More Of That", caption: (r) => ({ top: `${r.player} & ${r.opponent} AT ${r.winnerScore}-${r.loserScore}`, bottom: "Y'ALL GOT ANY MORE OF THAT OFFENSE?" }) },
    ],
    finals: [
      { id: 135256802, name: "Epic Handshake", caption: (r) => ({ top: r.p1, bottom: `${r.p2} — BOTH WANT THE MADDEN BOWL` }) },
      { id: 101470, name: "Ancient Aliens", caption: (r) => ({ top: `${r.p1} VS ${r.p2} IN THE FINAL`, bottom: "I'M JUST SAYING: LEGENDARY" }) },
      { id: 110133729, name: "Spiderman Pointing At Spiderman", caption: (r) => ({ top: r.p1, bottom: `${r.p2} — MIRROR MATCH IN THE FINAL` }) },
      { id: 3218037, name: "This Is Where I'd Put My Trophy If I Had One", caption: (r) => ({ top: `${r.p1} AND ${r.p2}`, bottom: "FIGHTING FOR THE ONLY TROPHY SPOT" }) },
    ],
    champion: [
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "I DON'T LOSE FINALS OFTEN", bottom: `BUT NEITHER DOES ${String(r.player || "").toUpperCase()} (${r.winnerScore}-${r.loserScore})` }) },
      { id: 29617627, name: "Look At Me", caption: (r) => ({ top: "LOOK AT ME", bottom: `I AM THE NEW CHAMPION: ${r.player}` }) },
      { id: 5496396, name: "Leonardo Dicaprio Cheers", caption: (r) => ({ top: `TO ${r.player}`, bottom: "THE NEW MADDEN BOWL CHAMPION! 🏆" }) },
    ],
  };

  function buildImgflipCaptions(record, entry) {
    if (entry) return entry.caption(record);
    // Fallback (z.B. beim erzwungenen Test mit fester Template-ID ohne Treffer im Pool).
    switch (record.type) {
      case "allTimeHigh": return { top: "NEW ALL-TIME HIGH SCORE", bottom: `${record.player}: ${record.value} POINTS` };
      case "champion": return { top: "NEW MADDEN BOWL CHAMPION", bottom: `${record.player}` };
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
      { id: 26961037, name: "NFL Ref", caption: () => ({ top: "THE REF, LOOKING RIGHT AT IT,", bottom: "STILL MAKES THE WRONG CALL" }) },
      { id: 44811986, name: "Logical Fallacy Referee NFL #85", caption: () => ({ top: "THAT WASN'T A PENALTY BECAUSE...", bottom: "(insert nonsense excuse here)" }) },
      { id: 114267372, name: "NFL Ref Flag", caption: (r) => ({ top: "THE FLAG IS ALREADY IN THE AIR", bottom: `BEFORE ${String(r.loser || "ANYONE").toUpperCase()} EVEN TOUCHED THE BALL` }) },
      { id: 169261378, name: "NFL Ref – Call/Foul/Penalty", caption: () => ({ top: "PENALTY.", bottom: "NO, REALLY, THAT WAS A PENALTY." }) },
      { id: 567189276, name: "Blind Referees", caption: () => ({ top: "THE REFS", bottom: "SOMEHOW DIDN'T SEE THAT ONE" }) },
      { id: 632249784, name: "NFL Referee – False Start", caption: () => ({ top: "FALSE START", bottom: "ON EVERY SINGLE DRIVE, APPARENTLY" }) },
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
      { id: 577208610, name: "Sad Mahomes", caption: (r) => ({ top: `${r.loser} WATCHING THE LEAD DISAPPEAR`, bottom: r.score }) },
      { id: 268827476, name: "NY Giants Fans", caption: (r) => ({ top: `${r.loser} FANS`, bottom: `AFTER THE ${r.score} COLLAPSE` }) },
      { id: 75583105, name: "NFL MEME", caption: (r) => ({ top: `${r.loser} HAD THIS ONE WON`, bottom: `THEN THIS HAPPENED: ${r.score}` }) },
      { id: 93514481, name: "Steve Harvey Laughing Serious", caption: (r) => ({ top: `${r.loser} EARLY IN THE GAME`, bottom: `${r.loser} AFTER THE ${r.score} COLLAPSE` }) },
      { id: 221578498, name: "Grant Gustin Over Grave", caption: (r) => ({ top: `${r.loser} INTERNALLY`, bottom: `AFTER BLOWING THE LEAD (${r.score})` }) },
    ],
    comeback: [
      { id: 252600902, name: "Always Has Been", caption: (r) => ({ top: `WAIT, ${String(r.winner || "").toUpperCase()} CAME BACK FROM THAT?`, bottom: "ALWAYS HAS BEEN" }) },
      { id: 259237855, name: "Laughing Leo", caption: (r) => ({ top: `${r.winner} AFTER THE COMEBACK`, bottom: r.score }) },
      { id: 91538330, name: "X, X Everywhere", caption: () => ({ top: "COMEBACKS,", bottom: "COMEBACKS EVERYWHERE" }) },
      { id: 208650053, name: "NFL Tackle", caption: (r) => ({ top: `${r.loser}'S COMEBACK ATTEMPT`, bottom: "TACKLED BEFORE IT EVEN STARTED" }) },
    ],
    upset: [
      { id: 155067746, name: "Surprised Pikachu", caption: (r) => ({ top: `THE FAVORITE, AFTER LOSING TO ${String(r.winner || "").toUpperCase()}`, bottom: r.score }) },
      { id: 102156234, name: "Mocking Spongebob", caption: (r) => ({ top: `${r.loser} PRE-GAME: 'iM wInNiNg tHiS eAsY'`, bottom: r.score }) },
      { id: 123999232, name: "The Scroll Of Truth", caption: (r) => ({ top: `${r.loser} WASN'T THAT GOOD ANYWAY`, bottom: `AS THE ${r.score} SHOWS` }) },
      { id: 203723093, name: "Patrick Mahomes on Ground", caption: (r) => ({ top: `THE FAVORITE, ${r.loser},`, bottom: `AFTER LOSING TO ${r.winner} (${r.score})` }) },
      { id: 272113903, name: "Tom Brady 4th Down", caption: (r) => ({ top: "4TH DOWN, EVERYTHING ON THE LINE", bottom: `${r.winner} DELIVERS ANYWAY` }) },
      { id: 268827476, name: "NY Giants Fans", caption: (r) => ({ top: `${r.loser} FANS`, bottom: `NEVER SAW ${r.winner} COMING` }) },
      { id: 577208610, name: "Sad Mahomes", caption: (r) => ({ top: `${r.loser}, THE FAVORITE,`, bottom: `AFTER LOSING TO ${r.winner}` }) },
      { id: 441850935, name: "Patrick Mahomes Thumbs Up", caption: (r) => ({ top: `"YEAH, ${r.winner} GOT ME"`, bottom: `${r.loser}, SURPRISINGLY CHILL ABOUT IT` }) },
      { id: 93514481, name: "Steve Harvey Laughing Serious", caption: (r) => ({ top: `${r.loser} BEFORE KICKOFF`, bottom: `${r.loser} AFTER LOSING TO ${r.winner}` }) },
      { id: 132596627, name: "NFL Logo", caption: () => ({ top: "WTF", bottom: "" }) },
    ],
    close: [
      { id: 155692896, name: "Screaming", caption: (r) => ({ top: "NO ONE KNEW WHO WAS WINNING", bottom: r.score }) },
      { id: 93514481, name: "Steve Harvey Laughing Serious", caption: (r) => ({ top: "EVERYONE RELAXED EARLY IN THIS ONE", bottom: `THEN IT CAME DOWN TO ${r.score}` }) },
      { id: 4087833, name: "Waiting Skeleton", caption: () => ({ top: "WAITING FOR THE LAST SECOND", bottom: "TO FIND OUT WHO WON" }) },
      { id: 21900001, name: "NFL Referee", caption: () => ({ top: "NOBODY KNEW WHO WON", bottom: "UNTIL THE VERY LAST SECOND" }) },
      { id: 627432492, name: "NFL Football", caption: (r) => ({ top: r.score, bottom: "CLOSEST GAME OF THE SEASON" }) },
      { id: 363893507, name: "Tom Brady Surprised", caption: (r) => ({ top: `${r.winner}, AFTER THE ${r.score} NAIL-BITER`, bottom: "DIDN'T EXPECT THAT EITHER" }) },
    ],
    blowout: [
      { id: 203723093, name: "Patrick Mahomes on Ground", caption: (r) => ({ top: r.loser, bottom: `AFTER THE ${r.score}` }) },
      { id: 27813981, name: "Hide the Pain Harold", caption: (r) => ({ top: r.loser, bottom: `AFTER THE ${r.score}` }) },
      { id: 19833195, name: "NFL Donkey Punch", caption: (r) => ({ top: r.loser, bottom: `AFTER THE ${r.score}` }) },
      { id: 61712394, name: "Taking Out the Trash", caption: (r) => ({ top: r.winner, bottom: `TAKING OUT THE TRASH: ${r.loser} (${r.score})` }) },
      { id: 208650053, name: "NFL Tackle", caption: (r) => ({ top: `${r.loser}'S OFFENSE`, bottom: `STOPPED COLD ALL GAME (${r.score})` }) },
      { id: 554081129, name: "NFL Jaguars Out Of Reach", caption: (r) => ({ top: r.loser, bottom: `AT ${r.score}, THIS ONE IS OUT OF REACH` }) },
      { id: 221578498, name: "Grant Gustin Over Grave", caption: (r) => ({ top: `${r.loser} INTERNALLY`, bottom: `AFTER GETTING BLOWN OUT ${r.score}` }) },
    ],
    hype: [
      { id: 61532, name: "Most Interesting Man In The World", caption: (r) => ({ top: "I DON'T ALWAYS TALK TRASH", bottom: `BUT WHEN I DO, I'M ${String(r.winner || "").toUpperCase()}` }) },
      { id: 259237855, name: "Laughing Leo", caption: (r) => ({ top: `${r.winner} AFTER ONE (1) GOOD GAME`, bottom: "THE HYPE:" }) },
      { id: 8072285, name: "Doge", caption: (r) => ({ top: `such ${r.winner}`, bottom: "much hype, one game, wow" }) },
      { id: 489157989, name: "Taylor Swift Chiefs Game", caption: (r) => ({ top: "THE HYPE AROUND", bottom: `${r.winner || "THIS GUY"} RIGHT NOW` }) },
      { id: 456538639, name: "Roger Goodell", caption: (r) => ({ top: "LEAGUE OFFICE ISSUING A STATEMENT:", bottom: `"${r.winner || "THAT"} WAS INCREDIBLE"` }) },
      { id: 441850935, name: "Patrick Mahomes Thumbs Up", caption: (r) => ({ top: r.winner || "THE WINNER", bottom: "TOTALLY UNBOTHERED BY THE HYPE" }) },
    ],
    ragequit: [
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: r.loser, bottom: "RAGE QUITS AFTER ONE BAD DRIVE" }) },
      { id: 61520, name: "Futurama Fry", caption: () => ({ top: "NOT SURE IF CONTROLLER BROKE", bottom: "OR SOMEONE JUST RAGE QUIT" }) },
    ],
    // "Entscheidungsspiel" deckt hier auch Finale/Champion-Momente ab (kein
    // eigener Kontext-Tag dafür — inhaltlich dasselbe: viel steht auf dem Spiel).
    decision_game: [
      { id: 272113903, name: "Tom Brady 4th Down", caption: () => ({ top: "THE MADDEN BOWL FINAL,", bottom: "EVERYTHING ON ONE DRIVE" }) },
      { id: 456538639, name: "Roger Goodell", caption: () => ({ top: "THE COMMISSIONER HANDING OVER", bottom: "THE MADDEN BOWL TROPHY" }) },
      { id: 165567092, name: "Who Wants To Be A Millionaire", caption: (r) => ({ top: "WHO WINS THE MADDEN BOWL FINAL?", bottom: `A) ${r.opponent || "HIM"}   B) ${r.opponent || "HIM"}   C) ${r.opponent || "HIM"}   D) ${r.player || "OBVIOUSLY HIM"}` }) },
      { id: 627432492, name: "NFL Football", caption: (r) => ({ top: "MADDEN BOWL FINAL", bottom: `${r.player || r.winner || "ONE PLAYER"} WALKS AWAY CHAMPION` }) },
      { id: 363893507, name: "Tom Brady Surprised", caption: () => ({ top: "EVEN THE CHAMPION", bottom: "DIDN'T SEE THAT FINAL COMING" }) },
      { id: 127129121, name: "Tom Brady Angry", caption: (r) => ({ top: r.opponent || r.loser || "THE RUNNER-UP", bottom: "AFTER LOSING THE MADDEN BOWL FINAL" }) },
      { id: 443004391, name: "Tom Brady", caption: (r) => ({ top: "NEW MADDEN BOWL CHAMPION:", bottom: r.player || r.winner || "TBD" }) },
      { id: 489157989, name: "Taylor Swift Chiefs Game", caption: () => ({ top: "EVERYONE SUDDENLY WATCHING", bottom: "BECAUSE THE FINAL IS THAT BIG" }) },
    ],
    general: [
      { id: 61585, name: "Bad Luck Brian", caption: (r) => ({ top: "WELL, THAT HAPPENED.", bottom: r.score }) },
      { id: 9340393, name: "NFL", caption: (r) => ({ top: "MADDEN BOWL MOMENT:", bottom: r.score || "" }) },
      { id: 627432492, name: "NFL Football", caption: () => ({ top: "MADDEN BOWL,", bottom: "WEEK AFTER WEEK" }) },
      { id: 75583105, name: "NFL MEME", caption: (r) => ({ top: "MADDEN BOWL:", bottom: r.score || "SOMETHING ALWAYS HAPPENS" }) },
      { id: 363893507, name: "Tom Brady Surprised", caption: () => ({ top: "MADDEN BOWL", bottom: "NEVER FAILS TO SURPRISE" }) },
      { id: 127129121, name: "Tom Brady Angry", caption: () => ({ top: "MADDEN BOWL PLAYERS", bottom: "AFTER ANY LOSS AT ALL" }) },
      { id: 443004391, name: "Tom Brady", caption: () => ({ top: "MADDEN BOWL", bottom: "WHERE LEGENDS ARE MADE" }) },
    ],
  };

  function storyScoreStr(record) {
    const w = record.winnerScore ?? Math.max(record.homeScore ?? 0, record.awayScore ?? 0);
    const l = record.loserScore ?? Math.min(record.homeScore ?? 0, record.awayScore ?? 0);
    return `${w}-${l}`;
  }

  // Wählt die Story-Kategorie primär aus den vom Admin gesetzten Tags.
  // Zusätzlich: reine Rand-Erkennung (großer Blowout / hauchdünnes Spiel)
  // wirkt auch OHNE Tag als Auto-Trigger — das betrifft aber nur einen
  // Bruchteil der Spiele (nicht "jedes Ergebnis"), Tags haben trotzdem
  // immer Vorrang, wenn zusätzlich noch etwas angehakt wurde.
  function detectStoryMeme(record) {
    if (!record || record.homeScore == null || record.awayScore == null || record.homeScore === record.awayScore) return null;
    const c = record.memeContext || {};

    const winner = record.homeScore > record.awayScore ? record.homeName : record.awayName;
    const loser = record.homeScore > record.awayScore ? record.awayName : record.homeName;
    let key = null, score = 0;
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

    const margin = Math.abs(record.homeScore - record.awayScore);
    if (margin >= 21) add("blowout", 60);
    else if (margin <= 3) add("close", 55);

    if (!key) return null;

    return { ...record, type: "storyMeme", storyKey: key, player: winner, opponent: loser, winner, loser, score: storyScoreStr(record) };
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

  // ======================================================================
  // TESTLAUF — erzeugt JEDE hinterlegte Vorlage (klassisch + Story) genau
  // einmal mit Platzhalter-Daten, statt zufällig eine pro Anlass. So lässt
  // sich der komplette Pool an einem Stück durchklicken und absegnen,
  // ohne auf echte Turnierergebnisse warten zu müssen.
  // ======================================================================
  const TEST_RECORD_DATA = {
    allTimeHigh: { player: "Tobi F.", opponent: "Marco", value: 45 },
    allTimeMargin: { player: "Tobi F.", opponent: "Marco", winnerScore: 42, loserScore: 3 },
    tournamentMargin: { player: "Tobi F.", opponent: "Marco", winnerScore: 35, loserScore: 10 },
    winStreak: { player: "Tobi F.", value: 5 },
    upset: { player: "Jonas", opponent: "Tobi F.", winnerScore: 24, loserScore: 21 },
    shutout: { player: "Tobi F.", opponent: "Marco", winnerScore: 28, loserScore: 0 },
    shootout: { player: "Tobi F.", opponent: "Marco", winnerScore: 45, loserScore: 42 },
    finals: { p1: "Tobi F.", p2: "Marco" },
    champion: { player: "Tobi F.", opponent: "Marco", winnerScore: 31, loserScore: 24 },
  };

  const TEST_STORY_DATA = { player: "Tobi F.", opponent: "Marco", winner: "Tobi F.", loser: "Marco", score: "28-24" };

  // Baut die vollständige Job-Liste (Label + Template-ID + fertiger Text),
  // OHNE schon etwas zu generieren — praktisch auch, um vorher zu sehen,
  // wie viele Imgflip-Aufrufe ein Testlauf macht.
  function buildTestMemeJobs() {
    const jobs = [];
    Object.entries(IMGFLIP_TEMPLATE_POOLS).forEach(([type, pool]) => {
      const data = TEST_RECORD_DATA[type] || {};
      pool.forEach((entry) => {
        jobs.push({
          label: `${RECORD_TYPES[type] ? RECORD_TYPES[type].label : type} – ${entry.name}`,
          filename: `${type}_${entry.name}`.replace(/[^a-z0-9]+/gi, "-"),
          templateId: entry.id,
          caption: entry.caption({ ...data, type }),
        });
      });
    });
    Object.entries(STORY_MEME_TEMPLATES).forEach(([storyKey, pool]) => {
      pool.forEach((entry) => {
        jobs.push({
          label: `Story: ${storyKey} – ${entry.name}`,
          filename: `story-${storyKey}_${entry.name}`.replace(/[^a-z0-9]+/gi, "-"),
          templateId: entry.id,
          caption: entry.caption({ ...TEST_STORY_DATA, storyKey }),
        });
      });
    });
    return jobs;
  }

  // Ruft Imgflip NACHEINANDER für jeden Job auf (nicht parallel — schont
  // das kostenlose Imgflip-Kontingent und vermeidet Rate-Limit-Fehler) und
  // meldet nach jedem einzelnen Bild den Fortschritt per onProgress, damit
  // die Oberfläche live mitrendern kann statt am Ende alles auf einmal.
  async function generateAllTestMemes({ username, password }, onProgress) {
    if (!username || !password) throw new Error("Imgflip-Zugangsdaten fehlen.");
    const jobs = buildTestMemeJobs();
    const results = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      let result;
      try {
        const body = new URLSearchParams({
          template_id: String(job.templateId), username, password,
          text0: job.caption.top, text1: job.caption.bottom,
        });
        const res = await fetch("https://api.imgflip.com/caption_image", { method: "POST", body });
        const json = await res.json();
        if (!json.success) throw new Error(json.error_message || "Imgflip-Fehler (unbekannt)");
        result = { ...job, url: json.data.url, pageUrl: json.data.page_url, ok: true };
      } catch (e) {
        result = { ...job, error: e.message || String(e), ok: false };
      }
      results.push(result);
      if (onProgress) onProgress(result, i + 1, jobs.length);
    }
    return results;
  }

  global.MB = global.MB || {};
  global.MB.Records = {
    RECORD_TYPES, MEME_STYLES, IMGFLIP_TEMPLATE_POOLS, MEME_CONTEXT_TAGS, STORY_MEME_TEMPLATES,
    detectRecords, detectMilestoneRecords, buildMemeCaptions, renderMemeCanvas, canvasToBlob,
    detectStoryMeme, buildStoryCaptions, pickStoryTemplate, buildTestMemeJobs, generateAllTestMemes,
    shareOrDownloadMeme, shareOrOpenRemoteImage,
    getImgflipSettings, setImgflipSettings, buildImgflipCaptions, pickImgflipTemplate, generateImgflipMeme,
    pushRecordMoment, fetchRecordMoments, dismissRecordMoment, uploadMemeToStorage,
  };
})(window);
