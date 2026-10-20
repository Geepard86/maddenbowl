/* =========================================================================
   ACHIEVEMENTS — Sammelkarten für eingeloggte Spieler
   -------------------------------------------------------------------------
   Unabhängig von den echten Turnierergebnissen: Karten gibt es fürs Tippen,
   Stöbern, Kommentieren, fürs Erwähntwerden im Blog, für Treue über mehrere
   Turniere — und einzigartige Karten (1/1) für den jeweils ERSTEN Spieler,
   der etwas getan hat.

   Neue Karten ergänzen: Eintrag in DEFS + (falls nötig) einen Auslöser in
   track()/evaluateTipps() oder irgendwo MB.Achievements.unlock("id") aufrufen.

   Speicher (Supabase, siehe supabase-migration-comments-and-cards.sql):
     player_achievements  Freischaltungen          player_progress  Zähler/Fortschritt
     achievement_firsts   einzigartige Karten (wer zuerst kommt, behält sie)
   Fehlen die Tabellen noch, läuft alles lokal im Browser weiter (außer den
   einzigartigen Karten — die brauchen die Datenbank, um fair zu bleiben).

   Neue Karten erscheinen beim nächsten Seitenaufruf bzw. bei der nächsten
   Interaktion als Popup; "Meine Karten" steht in der Hall of Fame (nur eingeloggt).

   API (window.MB.Achievements):
     DEFS, RARITIES, TERMS, setPage(key), init(state), onLogin(name), onLogout()
     track(event, data), unlock(id), evaluateTipps(state), trackPage(key)
     renderGallery(el)                       Meine Karten (eingeloggt)
     renderCatalog(el)                       Admin-Übersicht aller Karten
     previewPopup(ids)                       Popup-Vorschau (Admin-Test)
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};

  const RARITIES = {
    common: { label: "Common", color: "#b08d57", glow: "rgba(176,141,87,.5)" },
    rare: { label: "Rare", color: "#8fb6e8", glow: "rgba(143,182,232,.6)" },
    epic: { label: "Epic", color: "#c07bff", glow: "rgba(192,123,255,.7)" },
    legendary: { label: "Legendary", color: "#ffd23f", glow: "rgba(255,210,63,.8)" },
    limited: { label: "Limited", color: "#2ee6c5", glow: "rgba(46,230,197,.75)" },
    unique: { label: "Unique 1/1", color: "#ff7ad9", glow: "rgba(255,122,217,.85)" },
  };
  const TERMS = { limited: "Limitiert · nur in einem bestimmten Zeitraum erhältlich", kurz: "Kurzfristig · schon im ersten Turnier", mittel: "Mittelfristig · über ein Turnier", lang: "Langfristig · über mehrere Turniere", unique: "Einzigartig · nur der Erste bekommt sie" };

  // ------------------------------------------------------------ Karten-Katalog
  // term: kurz | mittel | lang | unique   ·   secret: Text erst nach Freischaltung lesbar
  const DEFS = [
    // ---- Einstieg (kurzfristig)
    { id: "welcome", emoji: "👋", title: "Willkommen im Büro", desc: "Du hast dich zum ersten Mal angemeldet.", rarity: "common", term: "kurz" },
    { id: "tipp_first", emoji: "🎟️", title: "Erster Tipp", desc: "Du hast deinen allerersten Tipp abgegeben.", rarity: "common", term: "kurz" },
    { id: "tipp_self", emoji: "🪞", title: "Eigener Fan", desc: "Du hast in einem Spiel auf dich selbst getippt.", rarity: "common", term: "kurz" },
    { id: "shop_first", emoji: "🧢", title: "Merch-Neuling", desc: "Du hast dir dein erstes Produkt im Shop angeschaut.", rarity: "common", term: "kurz" },
    { id: "hof_visit", emoji: "🏛️", title: "Geschichtsstunde", desc: "Du hast die Hall of Fame besucht.", rarity: "common", term: "kurz" },
    { id: "comment_first", emoji: "💬", title: "Erste Meldung", desc: "Du hast deinen ersten Blog-Kommentar geschrieben.", rarity: "common", term: "kurz" },
    { id: "pages_all", emoji: "🧭", title: "Entdecker", desc: "Du hast jede Seite der Altima-Bowl-Webseite besucht.", rarity: "rare", term: "kurz" },
    { id: "app_installed", emoji: "📲", title: "Home-Bildschirm-Held", desc: "Du nutzt die Altima-Bowl-App direkt vom Startbildschirm.", rarity: "rare", term: "kurz" },
    // ---- Tippen
    { id: "tipp_self_won", emoji: "💪", title: "Selbsterfüllende Prophezeiung", desc: "Du hast auf dich selbst getippt … und gewonnen.", rarity: "rare", term: "mittel" },
    { id: "tipp_self_lost", emoji: "🥲", title: "Eigentor", desc: "Du hast auf dich selbst getippt … und verloren.", rarity: "rare", term: "mittel" },
    { id: "tipp_against_self", emoji: "🕳️", title: "Härtester Kritiker", desc: "Du hast gegen dich selbst getippt.", rarity: "rare", term: "mittel", secret: true },
    { id: "tipp_against_self_won", emoji: "🧠", title: "Realist", desc: "Du hast gegen dich selbst getippt … und recht behalten.", rarity: "rare", term: "mittel", secret: true },
    { id: "tipp_streak3", emoji: "🔮", title: "Kleines Orakel", desc: "Drei richtige Spieltipps in Folge.", rarity: "rare", term: "mittel" },
    { id: "tipp_streak5", emoji: "🧙", title: "Großes Orakel", desc: "Fünf richtige Spieltipps in Folge.", rarity: "epic", term: "mittel" },
    { id: "tipp_all", emoji: "🗂️", title: "Lückenlos", desc: "Du hast in einem Turnier jedes einzelne Spiel getippt.", rarity: "epic", term: "mittel" },
    { id: "tipp_rate70", emoji: "🎯", title: "Durchblicker", desc: "Mehr als 70 % richtige Spieltipps in einem Turnier (mind. 15 Tipps).", rarity: "epic", term: "mittel" },
    { id: "tipp_rate80", emoji: "🧿", title: "Allwissend", desc: "Mehr als 80 % richtige Spieltipps in einem Turnier (mind. 15 Tipps).", rarity: "legendary", term: "mittel" },
    { id: "tipp_final_self_won", emoji: "🏅", title: "Prophet in eigener Sache", desc: "Im Finale auf dich selbst getippt … und gewonnen.", rarity: "epic", term: "mittel", secret: true },
    { id: "tipp_final_against_self_won", emoji: "🪦", title: "Bittere Wahrheit", desc: "Im Finale gegen dich selbst getippt … und recht behalten.", rarity: "legendary", term: "mittel", secret: true },
    { id: "tipp_self_crowned", emoji: "🫅", title: "Selbstkrönung", desc: "Dich selbst als Turniersieger getippt … und es tatsächlich geschafft.", rarity: "legendary", term: "mittel", secret: true },
    { id: "tipp_self_toilet", emoji: "🚽", title: "Ehrliche Haut", desc: "Dich selbst als Toilet-Bowl-Sieger getippt … und recht behalten.", rarity: "epic", term: "mittel", secret: true },
    { id: "tipp_self_champ_3", emoji: "🪞", title: "Unerschütterlich", desc: "In drei verschiedenen Turnieren dich selbst als Champion getippt.", rarity: "epic", term: "lang" },
    { id: "tipp_loyal", emoji: "🛡️", title: "Treue Seele", desc: "20 Tipps auf Spiele mit eigener Beteiligung – und kein einziges Mal gegen dich selbst.", rarity: "rare", term: "lang" },
    { id: "tipp_perfect_day", emoji: "💯", title: "Perfekter Spieltag", desc: "Alle Spiele eines Spieltags richtig getippt.", rarity: "epic", term: "mittel" },
    { id: "tipp_underdog", emoji: "🐕", title: "Underdog-Flüsterer", desc: "Du hast einen Sieger getippt, der in der Tabelle mindestens 3 Plätze schlechter stand.", rarity: "epic", term: "mittel" },
    { id: "tipp_20", emoji: "📝", title: "Stammtipper", desc: "Du hast insgesamt 50 Spieltipps abgegeben.", rarity: "rare", term: "lang" },
    { id: "tipp_100", emoji: "🏦", title: "Wettkönig", desc: "Du hast insgesamt 150 Spieltipps abgegeben.", rarity: "epic", term: "lang" },
    { id: "tipp_streak10", emoji: "☄️", title: "Hellseher", desc: "Zehn richtige Spieltipps in Folge.", rarity: "legendary", term: "lang" },
    { id: "tipp_champion", emoji: "👑", title: "Königsmacher", desc: "Du hast den Champion richtig vorhergesagt.", rarity: "legendary", term: "lang" },
    // ---- Blog
    { id: "mention_1", emoji: "🔦", title: "Im Rampenlicht", desc: "Du wurdest zum ersten Mal im Blog namentlich erwähnt.", rarity: "common", term: "kurz" },
    { id: "shop_all", emoji: "🛍️", title: "Window Shopper", desc: "Du hast dir alle Produkte im Shop angeschaut.", rarity: "rare", term: "mittel" },
    { id: "blog_reader", emoji: "📰", title: "Stammleser", desc: "Du hast den Blog an fünf verschiedenen Tagen besucht.", rarity: "rare", term: "mittel" },
    { id: "comment_5", emoji: "🗣️", title: "Meinungsstark", desc: "Du hast fünf Blog-Kommentare geschrieben.", rarity: "rare", term: "mittel" },
    { id: "mention_10", emoji: "📌", title: "Blog-Dauergast", desc: "Du wurdest zehnmal im Blog namentlich erwähnt.", rarity: "rare", term: "lang" },
    { id: "share_10", emoji: "📣", title: "Influencer", desc: "Du hast zehn verschiedene Blog-Beiträge geteilt.", rarity: "epic", term: "lang" },
    { id: "blog_reader_20", emoji: "🧾", title: "Chefredakteur", desc: "Du hast den Blog an 20 verschiedenen Tagen besucht.", rarity: "epic", term: "lang" },
    { id: "comment_25", emoji: "🎤", title: "Kommentarspalten-Legende", desc: "Du hast 25 Blog-Kommentare geschrieben.", rarity: "epic", term: "lang" },
    { id: "mention_25", emoji: "🌟", title: "Blog-Legende", desc: "Du wurdest 25-mal im Blog namentlich erwähnt.", rarity: "legendary", term: "lang" },
    // ---- Treue
    { id: "night_owl", emoji: "🦉", title: "Nachteule", desc: "Du warst nachts zwischen 0 und 5 Uhr auf der Seite.", rarity: "epic", term: "kurz", secret: true },
    { id: "login_days_7", emoji: "📅", title: "Stammgast", desc: "Du warst an sieben verschiedenen Tagen eingeloggt.", rarity: "rare", term: "mittel" },
    { id: "login_streak3", emoji: "😰", title: "FOMO", desc: "An drei Tagen hintereinander eingeloggt.", rarity: "rare", term: "mittel" },
    { id: "login_days_30", emoji: "🪑", title: "Inventar", desc: "Du warst an 30 verschiedenen Tagen eingeloggt.", rarity: "legendary", term: "lang" },
    { id: "login_years_2", emoji: "🔁", title: "Wiederholungstäter", desc: "Du warst in zwei verschiedenen Jahren dabei.", rarity: "epic", term: "lang" },
    { id: "cards_all", emoji: "🏆", title: "Komplettist", desc: "Du hast alle regulären Karten gesammelt (ohne die einzigartigen).", rarity: "legendary", term: "lang" },
    // ---- Einzigartig (1/1): nur der ERSTE Spieler bekommt sie
    // ---- Limited: nur in einem bestimmten Zeitraum
    { id: "lim_founder", emoji: "🗝️", title: "Gründungsmitglied", desc: "Beim ersten Turnier mit dem neuen Dashboard (2027) als Teilnehmer eingeloggt.", rarity: "limited", term: "limited" },
    { id: "lim_earlybird", emoji: "🐦", title: "Earlybird", desc: "2027 vor dem Kickoff des Turniers eingeloggt.", rarity: "limited", term: "limited" },
    // ---- Draft (vergibt die Admin-Seite beim Team-Pick)
    { id: "draft_fanlove", emoji: "💘", title: "Fanliebe", desc: "Im Draft das eigene Lieblingsteam gewählt, obwohl ein Team mit mind. 3 OVR mehr frei war.", rarity: "epic", term: "mittel" },
    { id: "draft_traitor", emoji: "🐍", title: "Verräter", desc: "Im Draft ausgerechnet einen Divisionsrivalen des eigenen Lieblingsteams gewählt.", rarity: "rare", term: "mittel", secret: true },
    { id: "draft_principles", emoji: "🧱", title: "Prinzipientreu", desc: "Einen Divisionsrivalen deines Lieblingsteams links liegen gelassen, obwohl er mind. 3 OVR besser gewesen wäre.", rarity: "epic", term: "mittel", secret: true },
    // ---- Stöbern: Kader, Profile, Avatar
    // ---- Easter Eggs (geheim, nur Titel sichtbar)
    { id: "egg_konami", emoji: "🎮", title: "Old School", desc: "Den Konami-Code eingegeben: ↑ ↑ ↓ ↓ ← → ← → B A (am Handy als Wischgeste + 2× tippen).", rarity: "legendary", term: "kurz", secret: true },
    { id: "egg_roster", emoji: "🕵️‍♂️", title: "Maulwurf im Kader", desc: "Den Spieler gefunden, der in keinem echten Kader steht.", rarity: "legendary", term: "kurz", secret: true },
    { id: "egg_wrong_card", emoji: "🎴", title: "Die falsche Karte", desc: "Auf eine Karte getippt, die eigentlich gar keine ist.", rarity: "legendary", term: "kurz", secret: true, eggCard: true },
    { id: "egg_crown", emoji: "👑", title: "Kronprinz", desc: "So lange auf die Krone getippt, bis sie heruntergefallen ist.", rarity: "epic", term: "kurz", secret: true },
    { id: "egg_bullseye", emoji: "🎯", title: "Bullseye", desc: "Die Zielscheibe eines Blog-Beitrags genau in der Mitte getroffen.", rarity: "legendary", term: "kurz", secret: true },
    // ---- Interview & Community
    { id: "interview_1", emoji: "🎙️", title: "Gesprächspartner", desc: "Rudi ein Interview gegeben.", rarity: "rare", term: "mittel" },
    { id: "praise", emoji: "💌", title: "Fanpost", desc: "In einem Kommentar die Orga, das Turnier oder die Seite gelobt.", rarity: "legendary", term: "lang", secret: true },
    { id: "push_on", emoji: "🔔", title: "Nichts verpassen", desc: "Benachrichtigungen aktiviert.", rarity: "common", term: "kurz" },
    { id: "avatar_made", emoji: "🎨", title: "Ganz der Alte", desc: "Du hast deine eigene Spielerfigur gestaltet.", rarity: "common", term: "kurz" },
    { id: "roster_8", emoji: "📋", title: "Kaderleser", desc: "Du hast dir die Kader von 8 Teams angeschaut.", rarity: "common", term: "kurz" },
    { id: "roster_16", emoji: "🔎", title: "Scouting-Abteilung", desc: "Du hast dir die Kader von 16 Teams angeschaut.", rarity: "rare", term: "kurz" },
    { id: "roster_32", emoji: "🗂️", title: "Ligaexperte", desc: "Du hast dir alle 32 Kader angeschaut.", rarity: "epic", term: "kurz" },
    { id: "profiles_5", emoji: "🕵️", title: "Gegnerstudium", desc: "Du hast dir 5 Spielerprofile angesehen.", rarity: "rare", term: "kurz" },
    { id: "seen_all", emoji: "🌌", title: "Alles gesehen", desc: "Jede Seite, alle 32 Kader, alle Spielerprofile, alle Reiter der Hall of Fame und die Tour – mehr gibt es hier nicht zu entdecken.", rarity: "legendary", term: "mittel", secret: true },
    // ---- Die drei Organisatoren (werden beim Login automatisch vergeben)
    { id: "u_org_tim", emoji: "🛠️", title: "Der Architekt", desc: "Hat sich diesen ganzen Wahnsinn ausgedacht und Zeile für Zeile gebaut.", rarity: "unique", term: "unique", unique: true, org: "tim" },
    { id: "u_org_alex", emoji: "🧪", title: "Der Testpilot", desc: "Testet, berät, findet jeden Fehler – und war früher der Gastgeber des Altima Bowl.", rarity: "unique", term: "unique", unique: true, org: "alex" },
    { id: "u_org_markus", emoji: "🎩", title: "Der Commissioner", desc: "Mitorganisator – sorgt dafür, dass der Altima Bowl jedes Jahr wirklich stattfindet.", rarity: "unique", term: "unique", unique: true, org: "markus" },
    { id: "u_org_tobif", emoji: "🏛️", title: "Der Urvater", desc: "Allererster Champion des Altima Bowl – und neben den drei Gastgebern das einzige Gründungsmitglied.", rarity: "unique", term: "unique", unique: true, org: "tobi f." },
    { id: "u_early_starter", emoji: "⏰", title: "Frühstarter", desc: "Hat sich als Allererster eingeloggt – noch vor dem 1. Januar 2027.", rarity: "unique", term: "unique", unique: true },
    { id: "u_first_avatar", emoji: "🖌️", title: "Erster Entwurf", desc: "Hat als Erster seine eigene Spielerfigur gestaltet.", rarity: "unique", term: "unique", unique: true },
    { id: "u_first_perfect_day", emoji: "🎰", title: "Jackpot", desc: "Hat als Erster einen kompletten Spieltag richtig getippt.", rarity: "unique", term: "unique", unique: true },
    { id: "u_pioneer", emoji: "🚀", title: "Pionier", desc: "Hat den allerersten Tipp der Geschichte abgegeben.", rarity: "unique", term: "unique", unique: true },
    { id: "u_sole_oracle", emoji: "🔮", title: "Das Orakel", desc: "Als Einziger im ganzen Turnier den späteren Champion vorhergesagt – und das als Erster in der Geschichte des Altima Bowl.", rarity: "unique", term: "unique", unique: true },
    { id: "u_first_interview", emoji: "📼", title: "Exklusiv", desc: "Hat Rudi das allererste Interview gegeben.", rarity: "unique", term: "unique", unique: true },
    { id: "u_first_comment", emoji: "🎙️", title: "Erste Stimme", desc: "Hat den allerersten Blog-Kommentar geschrieben.", rarity: "unique", term: "unique", unique: true },
    { id: "u_first_merch", emoji: "🛍️", title: "Erster Kunde", desc: "Hat als Erster wirklich etwas im Fan-Shop bestellt.", rarity: "unique", term: "unique", unique: true, manual: true },
    { id: "u_all_teams", emoji: "🔭", title: "Chefscout", desc: "Hat sich als Erster alle 32 Teams samt Kader angeschaut.", rarity: "unique", term: "unique", unique: true },
  ];
  const BY_ID = new Map(DEFS.map((d) => [d.id, d]));
  // Limited/Unique-Zeiträume
  const FOUNDER_YEAR = 2027;
  // Limited: bis wann erhältlich? ("open" | "over")
  function limitedState(def) {
    const now = new Date();
    const cfg = (stateRef && stateRef.config) || {};
    if (def.id === "lim_earlybird") {
      const k = cfg.nextTournamentAt ? new Date(cfg.nextTournamentAt) : null;
      if (now.getFullYear() > FOUNDER_YEAR) return "over";
      if (k && now >= k) return "over";
      return "open";
    }
    if (def.id === "lim_founder") return now.getFullYear() > FOUNDER_YEAR ? "over" : "open";
    return "open";
  }                       // erstes Turnier mit dem neuen Dashboard
  const EARLY_DEADLINE = "2027-01-01T00:00:00";    // Frühstarter bis hier, Earlybird ab hier
  // Divisionen (für die Draft-Karten)
  const DIVISIONS = {
    "AFC East": ["BUF", "MIA", "NE", "NYJ"], "AFC North": ["BAL", "CIN", "CLE", "PIT"], "AFC South": ["HOU", "IND", "JAX", "TEN"], "AFC West": ["DEN", "KC", "LV", "LAC"],
    "NFC East": ["DAL", "NYG", "PHI", "WAS"], "NFC North": ["CHI", "DET", "GB", "MIN"], "NFC South": ["ATL", "CAR", "NO", "TB"], "NFC West": ["ARI", "LAR", "SF", "SEA"],
  };
  const divOf = (id) => Object.keys(DIVISIONS).find((d) => DIVISIONS[d].includes(id)) || "";
  const PAGE_KEYS = ["dashboard", "spielplan", "wettbuero", "blog", "hall_of_fame", "shop"];
  const PAGE_MAP = { hallOfFame: "hall_of_fame", tippspiel: "wettbuero" };

  // ------------------------------------------------------------ Zustand
  let player = null, stateRef = null;
  let unlocked = new Map();      // id -> { at, seen }
  let firsts = new Map();        // id -> { player, at }  (einzigartige Karten)
  let progress = {};
  let tables = { ach: true, prog: true, firsts: true };   // false = Tabelle fehlt
  let queue = [], popupBusy = false, interacted = false, loadedFor = null, loading = null;
  let pageKey = null, pageTracked = false, progSaveTimer = null;
  const sb = () => (global.MB.getSupabaseClient ? global.MB.getSupabaseClient() : null);
  const missing = (e) => /player_achievements|player_progress|achievement_firsts|relation|does not exist|42P01|PGRST205/i.test(((e && e.message) || "") + ((e && e.code) || ""));
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll */ } };
  const ukey = (n) => `mb_achievements_${n}`, pkey = (n) => `mb_ach_progress_${n}`;
  function setPage(key) { pageKey = PAGE_MAP[key] || key || null; pageTracked = false; }

  // ------------------------------------------------------------ Laden / Speichern
  const mergeProgress = (a, b) => {
    const out = { ...a };
    Object.keys(b || {}).forEach((k) => {
      if (Array.isArray(b[k])) out[k] = [...new Set([...(out[k] || []), ...b[k]])];
      else if (typeof b[k] === "number") out[k] = Math.max(out[k] || 0, b[k]);
      else if (out[k] == null) out[k] = b[k];
    });
    return out;
  };
  async function loadFor(name) {
    if (loadedFor === name) return;
    if (loading) return loading;
    loading = (async () => {
      // Admin-Reset: lokale Kopien, die älter als der Reset sind, verwerfen
      // (sonst würden sie beim nächsten Laden wieder in die Datenbank geschrieben).
      const resetAt = await getResetAt();
      _loadedResetAt = resetAt || "";
      const ek = `mb_ach_epoch_${name}`;
      try { if (resetAt && (localStorage.getItem(ek) || "") < resetAt) { localStorage.removeItem(ukey(name)); localStorage.removeItem(pkey(name)); localStorage.setItem(ek, resetAt); } } catch (e) { /* egal */ }
      unlocked = new Map(); queue = []; progress = lsGet(pkey(name), {});
      const loc = lsGet(ukey(name), {}); Object.keys(loc).forEach((k) => unlocked.set(k, loc[k]));
      // Vom Admin entzogene Karten: lokale Kopie verwerfen, wenn sie älter als der Entzug ist
      try {
        const rv = await getRevoked();
        for (const [id, v] of [...unlocked]) {
          const at = rv[`${String(name).toLowerCase()}|${id}`];
          if (at && (!v.at || v.at <= at)) unlocked.delete(id);
        }
        lsSet(ukey(name), Object.fromEntries(unlocked));
      } catch (e) { /* egal */ }
      const c = sb();
      if (c) {
        const [a, p, f] = await Promise.all([
          c.from("player_achievements").select("achievement_id, unlocked_at, seen").eq("player_name", name),
          c.from("player_progress").select("data").eq("player_name", name).maybeSingle(),
          c.from("achievement_firsts").select("*"),
        ]);
        if (a.error) { if (missing(a.error)) tables.ach = false; else console.warn("Karten laden:", a.error.message); }
        else { tables.ach = true; (a.data || []).forEach((r) => { const prev = unlocked.get(r.achievement_id); unlocked.set(r.achievement_id, { at: r.unlocked_at, seen: !!r.seen || !!(prev && prev.seen) }); });
          for (const [id, v] of unlocked) if (!(a.data || []).some((r) => r.achievement_id === id) && BY_ID.has(id) && !BY_ID.get(id).unique) await persistUnlock(name, id, v); }
        if (p.error) { if (missing(p.error)) tables.prog = false; } else { tables.prog = true; if (p.data && p.data.data) progress = mergeProgress(progress, p.data.data); }
        if (f.error) { if (missing(f.error)) tables.firsts = false; } else { tables.firsts = true; firsts = new Map((f.data || []).map((r) => [r.achievement_id, { player: r.player_name, at: r.claimed_at }])); }
      }
      loadedFor = name;
      unlocked.forEach((v, id) => { if (!v.seen && BY_ID.has(id)) queue.push(id); });
    })().finally(() => { loading = null; });
    return loading;
  }
  let _revoked = null;
  async function getRevoked(force) {
    if (_revoked && !force) return _revoked;
    try { const raw = global.MB.getAppConfig ? await global.MB.getAppConfig("achievements_revoked") : null; _revoked = raw ? JSON.parse(raw) : {}; } catch (e) { _revoked = {}; }
    return _revoked;
  }
  // Admin: eine Karte einem Spieler wieder entziehen (Testphase). Unique-Karten werden wieder frei.
  async function revoke(id, name) {
    const def = BY_ID.get(id); if (!def || !name) throw new Error("Unbekannte Karte oder kein Spieler.");
    const c = sb(); if (!c) throw new Error("Keine Datenbankverbindung.");
    const pw = localStorage.getItem("mb_admin_session") || "";
    const { data, error } = await c.rpc("mb_revoke_achievement", { pw_hash: pw, p_player: name, p_id: id });
    if (error) throw new Error(/function|does not exist/i.test(error.message) ? "SQL-Funktion mb_revoke_achievement fehlt – Anleitung im Admin-Bereich." : /admin/i.test(error.message) ? "Admin-Nachweis abgelehnt – bitte neu als Admin anmelden." : error.message);
    // Entzug merken, damit lokale Kopien im Browser des Spielers verworfen werden
    const rv = { ...(await getRevoked(true)) }; rv[`${String(name).toLowerCase()}|${id}`] = new Date().toISOString();
    if (global.MB.setAppConfig) await global.MB.setAppConfig("achievements_revoked", JSON.stringify(rv));
    _revoked = rv;
    if (player && player.toLowerCase() === String(name).toLowerCase()) { unlocked.delete(id); lsSet(ukey(player), Object.fromEntries(unlocked)); }
    return data || {};
  }
  // Offene Tabs merken sich den Stand beim Laden; ein späterer Admin-Reset würde sonst
  // durch alte Zähler (besuchte Seiten etc.) sofort wieder Karten auslösen.
  let _loadedResetAt = null, _lastResetCheck = 0;
  async function resetHappenedSinceLoad() {
    if (Date.now() - _lastResetCheck < 30000) return false;
    _lastResetCheck = Date.now();
    let cur = null;
    try { cur = global.MB.getAppConfig ? await global.MB.getAppConfig("achievements_reset_at") : null; } catch (e) { return false; }
    if (cur && _loadedResetAt !== null && cur !== _loadedResetAt) {
      _loadedResetAt = cur; _resetAt = cur;
      const name = player;
      try { localStorage.removeItem(ukey(name)); localStorage.removeItem(pkey(name)); localStorage.setItem(`mb_ach_epoch_${name}`, cur); } catch (e) { /* egal */ }
      unlocked = new Map(); progress = {}; queue = []; loadedFor = null;
      return true;
    }
    return false;
  }
  let _resetAt;
  async function getResetAt() {
    if (_resetAt !== undefined) return _resetAt;
    try { _resetAt = (global.MB.getAppConfig ? await global.MB.getAppConfig("achievements_reset_at") : null) || null; } catch (e) { _resetAt = null; }
    return _resetAt;
  }
  // Admin: eine Karte manuell an einen Spieler vergeben (z.B. „Erster Kunde“ nach echter Bestellung).
  // Unique-Karten werden dabei für diesen Spieler reserviert (achievement_firsts).
  async function grant(id, name) {
    const def = BY_ID.get(id); if (!def || !name) throw new Error("Unbekannte Karte oder kein Spieler.");
    const c = sb(); if (!c) throw new Error("Keine Datenbankverbindung.");
    if (def.unique) {
      const { data } = await c.from("achievement_firsts").select("*").eq("achievement_id", id).maybeSingle();
      if (data && data.player_name !== name) throw new Error(`Die Karte gehört bereits ${data.player_name}.`);
      if (!data) { const { error } = await c.from("achievement_firsts").insert({ achievement_id: id, player_name: name }); if (error && !missing(error)) throw new Error(error.message); }
    }
    const at = new Date().toISOString();
    const { error } = await c.from("player_achievements").upsert({ player_name: name, achievement_id: id, unlocked_at: at, seen: false }, { onConflict: "player_name,achievement_id" });
    if (error && !missing(error)) throw new Error(error.message);
    if (def.unique) postUniqueArticle(def, name);
    else if (def.rarity === "legendary") noteLegendary(def, name);
    return true;
  }
  // Admin: ALLE Karten aller Spieler zurücksetzen (inkl. Unique-Karten und Fortschritt).
  async function resetAll() {
    const c = sb(); if (!c) throw new Error("Keine Datenbankverbindung.");
    const out = {};
    // 1) bevorzugt: Supabase-Funktion mb_reset_achievements() (SECURITY DEFINER, siehe SQL in der Anleitung)
    try {
      // Admin-Nachweis: der gespeicherte Admin-Passwort-Hash (die Funktion vergleicht mit app_config)
      const pw = (localStorage.getItem("mb_admin_session") || "");
      const { data, error } = await c.rpc("mb_reset_achievements", { pw_hash: pw });
      if (error) out.rpcError = error.message || String(error);
      else if (data) Object.assign(out, data, { via: "rpc" });
    } catch (e) { out.rpcError = e.message; }
    // Admin-Prüfung der Funktion fehlgeschlagen -> klar melden statt still auf direktes Löschen auszuweichen
    if (out.rpcError && /admin/i.test(out.rpcError)) throw new Error("Admin-Nachweis abgelehnt – bitte in der Admin-Seite einmal ab- und wieder anmelden (dann ist der Passwort-Hash im Browser gespeichert).");
    if (out.via === "rpc") {
      await afterReset();
      // Kontrolle: steht noch etwas in den Tabellen?
      try {
        for (const t of ["player_achievements", "player_progress", "achievement_firsts"]) { const { count } = await c.from(t).select("*", { count: "exact", head: true }); out["rest_" + t] = count || 0; }
      } catch (e) { /* egal */ }
      return out;
    }
    for (const [table, col] of [["player_achievements", "player_name"], ["player_progress", "player_name"], ["achievement_firsts", "achievement_id"]]) {
      const { error, count } = await c.from(table).delete({ count: "exact" }).neq(col, "");
      if (error && !missing(error)) throw new Error(`${table}: ${error.message}`);
      out[table] = error ? 0 : (count || 0);
    }
    // Prüfen, ob wirklich gelöscht wurde (RLS löscht sonst stillschweigend 0 Zeilen)
    const { count: left } = await c.from("player_achievements").select("*", { count: "exact", head: true });
    const { count: leftProg } = await c.from("player_progress").select("*", { count: "exact", head: true });
    if (leftProg > 0) throw new Error(`${out.rpcError ? "SQL-Funktion meldet: " + out.rpcError + " (falls „Could not find the function“: im SQL Editor zusätzlich  notify pgrst, 'reload schema';  ausführen). " : ""}Die Datenbank hat das Löschen des Fortschritts verweigert (noch ${leftProg} Einträge – z. B. besuchte Seiten). Ohne die SQL-Funktion mb_reset_achievements kämen Karten sofort zurück – Anleitung im Admin-Bereich.`);
    if (left > 0) throw new Error(`Die Datenbank hat das Löschen verweigert (noch ${left} Karten vorhanden). Bitte einmalig die SQL-Funktion mb_reset_achievements anlegen – Anleitung im Admin-Bereich.`);
    await afterReset();
    return out;
  }
  async function afterReset() {
    const now = new Date().toISOString();
    if (global.MB.setAppConfig) await global.MB.setAppConfig("achievements_reset_at", now);
    _resetAt = now;
    try { Object.keys(localStorage).filter((k) => /^mb_(achievements_|ach_progress_|ach_epoch_|ach_seen|teams_seen|push_invite)/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* egal */ }
    unlocked = new Map(); progress = {}; firsts = new Map(); queue = []; loadedFor = null;
  }
  async function persistUnlock(name, id, v) {
    if (await resetHappenedSinceLoad()) return;
    lsSet(ukey(name), Object.fromEntries(unlocked));
    const c = sb(); if (!c || !tables.ach) return;
    const { error } = await c.from("player_achievements").upsert({ player_name: name, achievement_id: id, unlocked_at: v.at, seen: !!v.seen }, { onConflict: "player_name,achievement_id" });
    if (error) { if (missing(error)) tables.ach = false; else console.warn("Karte speichern:", error.message); }
  }
  function saveProgress() {
    if (!player) return; lsSet(pkey(player), progress);
    clearTimeout(progSaveTimer);
    progSaveTimer = setTimeout(async () => {
      const c = sb(); if (!c || !tables.prog || !player) return;
      // Wurde inzwischen (in einem anderen Fenster) alles zurückgesetzt? Dann nichts Altes zurückschreiben.
      if (await resetHappenedSinceLoad()) return;
      const { error } = await c.from("player_progress").upsert({ player_name: player, data: progress, updated_at: new Date().toISOString() }, { onConflict: "player_name" });
      if (error) { if (missing(error)) tables.prog = false; else console.warn("Fortschritt speichern:", error.message); }
    }, 1500);
  }
  const bump = (key, to) => { progress[key] = Math.max(progress[key] || 0, to); saveProgress(); return progress[key]; };
  const addSet = (key, v) => { const s = new Set(progress[key] || []); s.add(v); progress[key] = [...s]; saveProgress(); return s.size; };

  // ------------------------------------------------------------ Freischalten
  async function claimUnique(id) {
    const c = sb(); if (!c || !tables.firsts) return false;
    if (firsts.has(id)) return firsts.get(id).player === player;
    const { error } = await c.from("achievement_firsts").insert({ achievement_id: id, player_name: player });
    if (!error) { firsts.set(id, { player, at: new Date().toISOString() }); return true; }
    if (missing(error)) { tables.firsts = false; return false; }
    const { data } = await c.from("achievement_firsts").select("*").eq("achievement_id", id).maybeSingle(); // schon vergeben
    if (data) firsts.set(id, { player: data.player_name, at: data.claimed_at });
    return !!(data && data.player_name === player);
  }
  async function unlock(id, meta) {
    const def = BY_ID.get(id); if (!def || !player) return false;
    await loadFor(player);
    if (unlocked.has(id)) return false;
    if (def.unique && !(await claimUnique(id))) return false;
    const v = { at: new Date().toISOString(), seen: false, meta: meta || null };
    unlocked.set(id, v); await persistUnlock(player, id, v);
    queue.push(id); scheduleShow();
    if (def.unique) postUniqueArticle(def, player);
    else if (def.rarity === "legendary") noteLegendary(def, player);
    const regular = DEFS.filter((d) => !d.unique && d.rarity !== "limited" && d.id !== "cards_all");
    if (id !== "cards_all" && !def.unique && regular.every((d) => unlocked.has(d.id))) await unlock("cards_all");
    return true;
  }
  // Neu ergatterte Unique-Karte -> eigener Blog-Beitrag (nur der Gewinner der
  // Karte schreibt ihn, claimUnique stellt sicher, dass das genau einmal passiert).
  // Unique-Karten im Blog: Nur die allererste vergebene Karte bekommt sofort einen eigenen Beitrag.
  // Alle weiteren werden gesammelt (app_config "unique_pending") und erscheinen gebündelt:
  //  - vor dem Turnier: ein Sammelbeitrag ab 24 h vor dem Kickoff (erster Seitenaufruf löst aus)
  //  - im Turnier: ein Sammelbeitrag pro abgeschlossenem Spieltag (Admin-Seite löst aus)
  async function blogTournamentId() {
    let tid = MB.getCurrentTournamentId ? MB.getCurrentTournamentId() : null;
    if (!tid && MB.fetchLastCompletedTournament) { try { const lt = await MB.fetchLastCompletedTournament(); tid = lt && (lt.tournamentId || lt.id); } catch (e) { /* ohne */ } }
    return tid;
  }
  async function insertArticle(tid, article) {
    const c = sb(); if (!c || !tid) return false;
    const ins = (kind) => c.from("blog_articles").insert({ tournament_id: tid, kind, title: article.title, body: article.body, data: article.data });
    const r = await ins(article.kind);
    if (!r.error) return true;
    const r2 = await ins("manual"); // falls die DB die Beitragsart (noch) nicht kennt
    if (r2.error) { console.warn("Unique-Beitrag:", r2.error.message); return false; }
    return true;
  }
  // Exklusive Sperre über achievement_firsts (Eintrag kann nur einmal angelegt werden)
  async function claimLock(key) {
    const c = sb(); if (!c) return false;
    const { error } = await c.from("achievement_firsts").insert({ achievement_id: "_lock_" + key, player_name: player || "system" });
    return !error;
  }
  const descFor = (def, name) => escapeHtml(def.desc.replace(/^Hat /, name + " hat ").replace(/^Als /, name + " war als "));
  // Unique-Karten im Blog:
  //  - die festen Organisator-Karten nie
  //  - vor Turnierstart vergebene: gesammelt als Absatz im Turnierstart-Beitrag (Admin-Seite)
  //  - während/nach dem Turnier: jede Karte ein eigener Beitrag
  async function postUniqueArticle(def, name) {
    try {
      if (def.org) return;
      const running = !!(stateRef && (stateRef.players || []).length);
      if (!running) {
        let pend = []; try { pend = JSON.parse((await global.MB.getAppConfig("unique_pending")) || "[]"); } catch (e) { pend = []; }
        if (!pend.some((x) => x.id === def.id)) pend.push({ id: def.id, name, at: new Date().toISOString() });
        await global.MB.setAppConfig("unique_pending", JSON.stringify(pend));
        return;
      }
      if (!(await claimLock("uq_article_" + def.id))) return;
      const tid = await blogTournamentId(); if (!tid) return;
      const body = `Diese Karte gibt es nur ein einziges Mal – und ab jetzt gehört sie ${escapeHtml(name)}.\n\n<strong>${def.emoji} ${escapeHtml(def.title)}</strong> – ${descFor(def, name)}\n\nAlle vergebenen und noch freien Unique-Karten stehen in der Hall of Fame.`;
      await insertArticle(tid, { kind: "achievement", title: `Unique-Karte vergeben: ${def.title}`, body, data: { achievement: def.id, player: name } });
    } catch (e) { console.warn("Unique-Beitrag konnte nicht erstellt werden:", e); }
  }
  // Legendäre Karten für den Abschnitt im nächsten Power Ranking merken
  async function noteLegendary(def, name) {
    try {
      let pend = []; try { pend = JSON.parse((await global.MB.getAppConfig("legendary_pending")) || "[]"); } catch (e) { pend = []; }
      if (!pend.some((x) => x.id === def.id && x.name === name)) { pend.push({ id: def.id, name }); await global.MB.setAppConfig("legendary_pending", JSON.stringify(pend)); }
    } catch (e) { /* egal */ }
  }
  // Gesammelte Unique-Karten als einen Beitrag veröffentlichen (lockKey verhindert Doppelte)
  async function flushUniqueRoundup(lockKey, label) {
    try {
      let pend = []; try { pend = JSON.parse((await global.MB.getAppConfig("unique_pending")) || "[]"); } catch (e) { pend = []; }
      if (!pend.length) return false;
      if (!(await claimLock("uq_" + lockKey))) return false;
      await global.MB.setAppConfig("unique_pending", "[]");
      const tid = await blogTournamentId(); if (!tid) return false;
      const lines = pend.map((x) => { const d = BY_ID.get(x.id); return d ? `<strong>${d.emoji} ${escapeHtml(d.title)}</strong> – ${descFor(d, x.name)}` : ""; }).filter(Boolean);
      const intro = pend.length === 1 ? "Eine weitere Unique-Karte hat ihren Besitzer gefunden:" : `${pend.length} weitere Unique-Karten haben ihre Besitzer gefunden:`;
      const body = `${intro}\n\n${lines.join("\n\n")}\n\nAlle vergebenen und noch freien Unique-Karten stehen in der Hall of Fame.`;
      await insertArticle(tid, { kind: "achievement", title: label || "Neue Unique-Karten", body, data: { roundup: true, cards: pend } });
      return true;
    } catch (e) { console.warn("Unique-Sammelbeitrag:", e); return false; }
  }
  // Vor dem Turnier: ab 24 h vor dem Kickoff einmal alle gesammelten Karten veröffentlichen
  async function checkPreTournamentRoundup() {
    const st = stateRef || {}; const cfg = st.config || {};
    if ((st.players || []).length || !cfg.nextTournamentAt) return;
    const k = new Date(cfg.nextTournamentAt); if (isNaN(k)) return;
    if (Date.now() >= k.getTime() - 24 * 3600 * 1000) flushUniqueRoundup("pre_" + k.toISOString().slice(0, 10), "Unique-Karten vor dem Turnier");
  }
  async function markSeen(id) { const v = unlocked.get(id); if (!v || v.seen || !player) return; v.seen = true; await persistUnlock(player, id, v); }

  // ------------------------------------------------------------ Ereignisse
  // Lob in Kommentaren: ein Thema (Turnier/Orga/Seite) + ein lobendes oder staunendes Wort
  function isPraise(text) {
    const t = String(text || "").toLowerCase();
    const subject = /(altima|madden)[ -]?bowl|turnier|orga|veranstalt|ausricht|organisat|seite|website|webseite|homepage|app\b|dashboard|blog|studio|kommentator|ansager|rudi|mona|enzo|aufwand|liebe zum detail/.test(t);
    const praise = /geil|mega|super|genial|krass|wahnsinn|verrückt|verrueckt|irre|hammer|großartig|grossartig|klasse|spitze|top\b|stark|unglaublich|abgefahren|crazy|insane|awesome|amazing|wow|respekt|chapeau|danke|liebe|beste|bester|unfassbar|episch|legendär|legendaer|weltklasse|bombe|next level|geisteskrank|übertrieben|uebertrieben|bekloppt/.test(t);
    return subject && praise;
  }
  // Legendär: wirklich alles angeschaut
  function checkSeenAll() {
    const p = progress;
    const pages = PAGE_KEYS.every((k) => (p.pages || []).includes(k));
    const teams = (p.teamsViewed || []).length >= 32;
    const profiles = p.profilesTotal > 0 && (p.profilesViewed || []).length >= p.profilesTotal;
    const tabs = ["history", "seasons", "player", "cards", "unique"].every((t) => (p.hofTabs || []).includes(t));
    const tour = (p.misc || []).includes("tour");
    if (pages && teams && profiles && tabs && tour) unlock("seen_all");
  }
  function trackPage(key) {
    if (!player || !key) return;
    addSet("pages", key);
    if (PAGE_KEYS.every((k) => (progress.pages || []).includes(k))) unlock("pages_all");
    checkSeenAll();
    if (key === "hall_of_fame") unlock("hof_visit");
    if (key === "shop") unlock("shop_first");
    if (key === "blog") { const d = addSet("blogDays", new Date().toISOString().slice(0, 10)); if (d >= 5) unlock("blog_reader"); if (d >= 20) unlock("blog_reader_20"); }
    const h = new Date().getHours(); if (h >= 0 && h < 5) unlock("night_owl");
  }
  async function refreshTippTotal() {
    const c = sb(); if (!c || !player) return;
    const { count, error } = await c.from("tipp_picks").select("id", { count: "exact", head: true }).eq("player_name", player).eq("kind", "match");
    if (error) return;
    const n = bump("tippTotal", count || 0);
    if (n >= 50) unlock("tipp_20"); if (n >= 150) unlock("tipp_100");
  }
  function track(event, data) {
    if (!player) return; data = data || {};
    if (event === "tipp_saved") {
      unlock("tipp_first"); unlock("u_pioneer");
      if (data.pick && data.pick === player) { unlock("tipp_self"); }
      else if (data.pick && (data.homeName === player || data.awayName === player)) { unlock("tipp_against_self"); addSet("misc", "against_self"); }
      refreshTippTotal();
    } else if (event === "shop_view" && data.token) {
      unlock("shop_first");
      if (data.total && addSet("shopTokens", data.token) >= data.total) unlock("shop_all");
    } else if (event === "comment_added") {
      unlock("comment_first"); unlock("u_first_comment");
      const n = bump("commentTotal", data.total || 0); if (n >= 5) unlock("comment_5"); if (n >= 25) unlock("comment_25");
    } else if (event === "blog_mentions") {
      const n = bump("mentions", data.count || 0);
      if (n >= 1) unlock("mention_1"); if (n >= 10) unlock("mention_10"); if (n >= 25) unlock("mention_25");
    } else if (event === "team_view" && data.team) {
      const n = addSet("teamsViewed", String(data.team));
      if (n >= 8) unlock("roster_8"); if (n >= 16) unlock("roster_16");
      if (n >= (data.total || 32)) { unlock("roster_32"); unlock("u_all_teams"); }
      checkSeenAll();
    } else if (event === "profile_view" && data.name) {
      const n = addSet("profilesViewed", String(data.name).toLowerCase());
      if (n >= 5) unlock("profiles_5");
      progress.profilesTotal = data.total || progress.profilesTotal || 0;
      checkSeenAll();
    } else if (event === "hof_tab" && data.tab) {
      addSet("hofTabs", String(data.tab)); checkSeenAll();
    } else if (event === "tour_done") {
      addSet("misc", "tour"); checkSeenAll();
    } else if (event === "pwa_installed") {
      unlock("app_installed");
    } else if (event === "egg" && data.id && BY_ID.has(data.id) && /^egg_/.test(data.id)) {
      unlock(data.id);
    } else if (event === "interview_done") {
      unlock("interview_1"); unlock("u_first_interview");
    } else if (event === "comment_text" && data.text) {
      if (isPraise(data.text)) unlock("praise");
    } else if (event === "push_on") {
      unlock("push_on");
    } else if (event === "avatar_saved") {
      unlock("avatar_made"); unlock("u_first_avatar");
    } else if (event === "blog_share" && data.id != null) {
      if (addSet("shares", String(data.id)) >= 10) unlock("share_10");
    }
  }

  // Tipp-Karten, die erst nach Spielende feststehen.
  async function evaluateTipps(state) {
    if (!player || !state || !global.MB.Tipp || !global.MB.getCurrentTournamentId) return;
    const tid = global.MB.getCurrentTournamentId(); if (!tid) return;
    let picks; try { picks = await global.MB.Tipp.fetchPicksForPlayer(tid, player); } catch (e) { return; }
    const seq = global.MB.Tipp.getMatchSequence(state);
    let seeds = null; try { seeds = global.MB.getGroupSeedsFinal(state); } catch (e) { /* optional */ }
    const results = []; let allTipped = seq.length >= 10;
    for (const info of seq) {
      const pk = picks.find((p) => p.kind === "match" && p.ref_key === info.matchId);
      if (!info.finished) { allTipped = false; continue; }
      if (!pk) { allTipped = false; continue; }
      const winner = info.s1 > info.s2 ? info.homeName : info.awayName, loser = info.s1 > info.s2 ? info.awayName : info.homeName;
      const involved = info.homeName === player || info.awayName === player;
      const sw = seeds && seeds.get(winner), sl = seeds && seeds.get(loser);
      results.push({ id: info.matchId, final: info.matchId === "p-gf", correct: pk.pick === winner, self: pk.pick === player, against: involved && pk.pick !== player, underdog: pk.pick === winner && sw && sl && sw - sl >= 3 });
    }
    results.forEach((r) => {
      if (r.self && r.correct) unlock("tipp_self_won");
      if (r.self && !r.correct) unlock("tipp_self_lost");
      if (r.against && r.correct) unlock("tipp_against_self_won");
      if (r.underdog) unlock("tipp_underdog");
      if (r.final && r.self && r.correct) unlock("tipp_final_self_won");
      if (r.final && r.against && r.correct) unlock("tipp_final_against_self_won");
    });
    // Trefferquote im Turnier
    if (results.length >= 15) {
      const rate = results.filter((r) => r.correct).length / results.length;
      if (rate > 0.7) unlock("tipp_rate70"); if (rate > 0.8) unlock("tipp_rate80");
    }
    // Perfekter Spieltag (alle Spiele eines abgeschlossenen Spieltags richtig)
    try {
      const byId = new Map(results.map((r) => [r.id, r]));
      (global.MB.Tipp.getSpieltage(state) || []).forEach((st) => {
        if (!st.matches.length || !st.matches.every((m) => m.finished)) return;
        if (st.matches.every((m) => byId.get(m.matchId) && byId.get(m.matchId).correct)) { unlock("tipp_perfect_day"); unlock("u_first_perfect_day"); }
      });
    } catch (e) { /* optional */ }
    let run = 0, best = 0; results.forEach((r) => { run = r.correct ? run + 1 : 0; best = Math.max(best, run); });
    if (best >= 3) unlock("tipp_streak3"); if (best >= 5) unlock("tipp_streak5"); if (best >= 10) unlock("tipp_streak10");
    if (allTipped) unlock("tipp_all");
    // Treue Seele: alle Tipps auf eigene Spiele (auch noch offene) turnierübergreifend zählen
    seq.forEach((info) => {
      const pk = picks.find((p) => p.kind === "match" && p.ref_key === info.matchId);
      if (!pk || (info.homeName !== player && info.awayName !== player)) return;
      addSet("involvedTips", `${tid}:${info.matchId}`);
      if (pk.pick !== player) addSet("misc", "against_self");
    });
    if ((progress.involvedTips || []).length >= 20 && !(progress.misc || []).includes("against_self")) unlock("tipp_loyal");
    // Gesamttipps auf sich selbst
    const seasonPick = (key) => (picks.find((p) => p.kind === "season" && p.ref_key === key) || {}).pick;
    if (seasonPick("champion") === player && addSet("selfChampTournaments", String(tid)) >= 3) unlock("tipp_self_champ_3");
    const outcome = global.MB.Tipp.resolveSeasonOutcome(state);
    if (outcome.champion && outcome.champion === player && seasonPick("champion") === player) unlock("tipp_self_crowned");
    if (outcome.toiletBowlWinner && outcome.toiletBowlWinner === player && seasonPick("toiletBowlWinner") === player) unlock("tipp_self_toilet");
    if (outcome.champion && picks.some((p) => p.kind === "season" && p.ref_key === "champion" && p.pick === outcome.champion)) {
      unlock("tipp_champion");
      try {
        const all = await global.MB.Tipp.fetchAllPicks(tid);
        const right = [...new Set((all || []).filter((p) => p.kind === "season" && p.ref_key === "champion" && p.pick === outcome.champion).map((p) => p.player_name))];
        if (right.length === 1 && right[0] === player) unlock("u_sole_oracle");
      } catch (e) { /* ohne Vergleich keine Karte */ }
    }
    refreshTippTotal();
  }

  // ------------------------------------------------------------ Karten-Optik
  function injectStyle() {
    if (document.getElementById("mbAchStyle")) return;
    const st = document.createElement("style"); st.id = "mbAchStyle";
    st.textContent = `
      .ach-card { --rc: #b08d57; --rg: rgba(176,141,87,.5); position: relative; width: 250px; height: 360px; border-radius: 16px; padding: 10px; box-sizing: border-box; color: #fff; flex: 0 0 auto;
        background: linear-gradient(145deg, color-mix(in srgb, var(--rc) 70%, #000), #12182b 45%, color-mix(in srgb, var(--rc) 55%, #000)); box-shadow: 0 0 0 3px var(--rc), 0 12px 40px rgba(0,0,0,.55), 0 0 28px var(--rg);
        font-family: 'Segoe UI', Arial, sans-serif; transform: perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)); transition: transform .12s ease-out; overflow: hidden; }
      .ach-card.rare { --rc: ${RARITIES.rare.color}; --rg: ${RARITIES.rare.glow}; } .ach-card.epic { --rc: ${RARITIES.epic.color}; --rg: ${RARITIES.epic.glow}; }
      .ach-card.legendary { --rc: ${RARITIES.legendary.color}; --rg: ${RARITIES.legendary.glow}; } .ach-card.unique { --rc: ${RARITIES.unique.color}; --rg: ${RARITIES.unique.glow}; }
      .ach-card.limited { --rc: ${RARITIES.limited.color}; --rg: ${RARITIES.limited.glow}; }
      .ach-card.limited .ach-foil { background-image: linear-gradient(115deg, #00e5c0, #b6fff2, #00a3ff, #c4f5ff, #2ee6c5, #00e5c0); opacity: .36; animation-duration: 6s; }
      .ach-card.limited::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(135deg, rgba(46,230,197,.16) 0 10px, transparent 10px 22px); animation: achSlide 4s linear infinite; }
      @keyframes achSlide { to { background-position: 62px 0; } }
      .ach-limband { position: absolute; top: 18px; right: -34px; z-index: 6; transform: rotate(35deg); background: linear-gradient(90deg, #00b894, #2ee6c5); color: #04251f; font: 900 11px/1 'Segoe UI', sans-serif; letter-spacing: 2px; padding: 5px 40px; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
      .ach-card.missed { filter: grayscale(.9) brightness(.6); }
      .ach-missed { position: absolute; left: 0; right: 0; top: 46%; z-index: 7; text-align: center; transform: rotate(-12deg); }
      .ach-missed span { display: inline-block; border: 3px solid #ff6b6b; color: #ff6b6b; font: 900 18px/1 'Segoe UI', sans-serif; letter-spacing: 2px; padding: 6px 12px; border-radius: 6px; background: rgba(0,0,0,.55); }
      .ach-card::after { content: ''; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: var(--shine, 0); transition: opacity .2s;
        background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,.55) 40%, rgba(255,120,220,.35) 50%, rgba(120,220,255,.4) 60%, transparent 80%); background-size: 250% 250%; background-position: var(--sx, 50%) var(--sy, 50%); }
      .ach-foil { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: .18; background-size: 300% 300%; animation: achFoil 8s linear infinite; z-index: 2; }
      .ach-card.epic .ach-foil { background-image: linear-gradient(115deg, #7a3cff, #00c8ff, #ff4fd8, #7a3cff); opacity: .26; }
      .ach-card.legendary .ach-foil { background-image: linear-gradient(115deg, #ffb300, #fff3a0, #ff8a00, #ffe14d, #ffb300); opacity: .34; }
      .ach-card.unique .ach-foil { background-image: linear-gradient(115deg, #ff0080, #ff8c00, #ffe600, #00ff9d, #00b7ff, #8a2be2, #ff0080); opacity: .4; animation-duration: 5s; }
      @keyframes achFoil { to { background-position: 300% 300%; } }
      .ach-glitter, .ach-glitter2 { position: absolute; inset: 0; pointer-events: none; z-index: 3; mix-blend-mode: screen; }
      .ach-glitter { background-image: radial-gradient(circle at 20% 30%, #fff 0 1.3px, transparent 2.4px), radial-gradient(circle at 72% 18%, #fff 0 1px, transparent 2.2px), radial-gradient(circle at 42% 72%, #ffe9a0 0 1.5px, transparent 2.6px), radial-gradient(circle at 86% 66%, #fff 0 1.1px, transparent 2.2px), radial-gradient(circle at 12% 86%, #cfffe8 0 1.3px, transparent 2.4px);
        background-size: 110px 140px, 90px 120px, 130px 100px, 100px 150px, 120px 130px; animation: achTwinkle 2.2s ease-in-out infinite alternate; }
      .ach-glitter2 { background-image: radial-gradient(circle at 60% 40%, #fff 0 1.2px, transparent 2.3px), radial-gradient(circle at 30% 80%, #ffd6f5 0 1.2px, transparent 2.3px), radial-gradient(circle at 90% 30%, #fff 0 1px, transparent 2px);
        background-size: 70px 90px, 85px 70px, 100px 110px; animation: achTwinkle 1.5s ease-in-out .6s infinite alternate; }
      @keyframes achTwinkle { 0% { opacity: .15; background-position: 0 0, 10px 20px, 30px 0, 5px 40px, 20px 10px; } 100% { opacity: 1; background-position: 8px 10px, 0 6px, 22px 12px, 14px 30px, 6px 22px; } }
      .ach-card.legendary::before { content: ''; position: absolute; inset: 0; background: repeating-conic-gradient(from 0deg at 50% 38%, rgba(255,210,63,.2) 0 8deg, transparent 8deg 18deg); animation: achSpin 14s linear infinite; pointer-events: none; }
      .ach-card.unique::before { content: ''; position: absolute; inset: 0; background: repeating-conic-gradient(from 0deg at 50% 38%, rgba(255,122,217,.22) 0 7deg, rgba(122,231,255,.18) 7deg 14deg, transparent 14deg 21deg); animation: achSpin 10s linear infinite; pointer-events: none; }
      @keyframes achSpin { to { transform: rotate(360deg); } }
      .ach-card.unique .ach-top { visibility: hidden; }
      .ach-ribbon { position: absolute; right: -34px; top: 16px; z-index: 5; width: 130px; text-align: center; transform: rotate(35deg); background: linear-gradient(90deg, #ff0080, #ffb300); color: #fff; font: 900 11px/1 'Segoe UI'; letter-spacing: 2px; padding: 4px 0; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
      .ach-top { display: flex; justify-content: space-between; align-items: center; font: 800 12px/1 'Segoe UI'; letter-spacing: 2px; text-transform: uppercase; color: var(--rc); position: relative; z-index: 4; }
      .ach-art { position: relative; z-index: 4; margin: 10px 0 8px; height: 150px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 84px; border: 2px solid color-mix(in srgb, var(--rc) 65%, #000);
        background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--rc) 45%, #1b2440), #0a0f1e 78%); text-shadow: 0 6px 18px rgba(0,0,0,.6); }
      .ach-title { position: relative; z-index: 4; font: 900 20px/1.1 Impact, 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 6px; }
      .ach-desc { position: relative; z-index: 4; font: 500 13px/1.35 'Segoe UI'; text-align: center; opacity: .9; padding: 0 4px; }
      .ach-foot { position: absolute; left: 10px; right: 10px; bottom: 8px; z-index: 4; display: flex; justify-content: space-between; gap: 6px; font: 600 9.5px/1.2 'Segoe UI'; letter-spacing: 1.2px; opacity: .72; text-transform: uppercase; }
      .ach-card.locked { filter: grayscale(1) brightness(.6); box-shadow: 0 0 0 3px #3a4256, 0 6px 18px rgba(0,0,0,.4); }
      .ach-card.locked .ach-foil, .ach-card.locked .ach-glitter, .ach-card.locked .ach-glitter2, .ach-card.locked::before { display: none; }
      .ach-card.locked .ach-art::before { content: '?'; font: 900 90px/1 Impact, sans-serif; color: #3a4256; }
      .ach-card.taken { filter: grayscale(.85) brightness(.7); } .ach-card.foreign { filter: saturate(.75); }
      .ach-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: rgba(4,7,16,.84); backdrop-filter: blur(6px); animation: achFade .3s ease-out; cursor: pointer; }
      @keyframes achFade { from { opacity: 0; } }
      .ach-overlay .ach-new { font: 900 22px/1 Impact, 'Arial Black', sans-serif; letter-spacing: 6px; color: #ffd23f; text-shadow: 0 0 20px rgba(255,210,63,.7); animation: achPulse 1s ease-in-out infinite alternate; }
      .ach-overlay.unique .ach-new { color: #ff7ad9; text-shadow: 0 0 24px rgba(255,122,217,.9); }
      @keyframes achPulse { to { transform: scale(1.08); } }
      .ach-overlay .ach-card { animation: achFlip .9s cubic-bezier(.2,1.2,.3,1); transform: scale(1.12); }
      @keyframes achFlip { from { transform: perspective(900px) rotateY(-180deg) scale(.5); opacity: 0; } to { transform: perspective(900px) rotateY(0) scale(1.12); opacity: 1; } }
      .ach-overlay .ach-hint { font: 600 13px/1 'Segoe UI'; color: #9aa8c4; letter-spacing: 1px; }
      .ach-gallery { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; margin: 10px 0 22px; }
      .ach-gal-head { text-align: center; font: 600 14px/1.4 'Segoe UI'; opacity: .9; } .ach-gal-head b { color: #ffd23f; }
      .ach-section { margin: 20px 0 4px; font: 800 13px/1 'Segoe UI'; letter-spacing: 3px; text-transform: uppercase; color: #9aa8c4; text-align: center; }
      .ach-cat-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .ach-cat-info { font: 600 11px/1.3 'Segoe UI'; opacity: .6; text-align: center; max-width: 250px; }
      .ach-filter { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 8px 0; }
      .ach-filter button { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 4px 12px; font: 600 12px 'Segoe UI'; cursor: pointer; }
      .ach-filter button.on { background: #c99700; color: #000; border-color: #c99700; }
    `;
    document.head.appendChild(st);
  }

  function cardHtml(def, st) {
    st = st || {};
    const r = RARITIES[def.rarity] || RARITIES.common;
    const locked = !st.at && !st.demo;
    // Galerie (hideHow): gesperrte Karten ab Rare zeigen den Titel, verraten aber nicht, wie man sie bekommt.
    // Ohne hideHow (z.B. Popup, eigene Karten) bleiben geheime Karten komplett verdeckt.
    const howHidden = locked && st.hideHow && def.rarity !== "limited" && (def.rarity !== "common" || def.secret);
    const hidden = locked && def.secret && !st.hideHow;
    const idx = String(DEFS.indexOf(def) + 1).padStart(2, "0");
    let foot;
    if (def.unique) {
      foot = st.holder ? `<span>${locked ? "Vergeben an" : "Gehört"}: ${escapeHtml(st.holder)}</span><span>1/1</span>` : `<span>${locked ? "Noch frei — sei der Erste!" : "Altima Bowl Cards"}</span><span>1/1</span>`;
    } else foot = `<span>Altima Bowl Cards</span><span>${st.at && !st.demo ? new Date(st.at).toLocaleDateString("de-DE") : "Serie 1"}</span>`;
    const fx = !locked && ["epic", "legendary", "unique", "limited"].includes(def.rarity) ? `<div class="ach-foil"></div><div class="ach-glitter"></div>${def.rarity !== "epic" ? '<div class="ach-glitter2"></div>' : ""}` : "";
    const missed = locked && def.rarity === "limited" && limitedState(def) === "over";
    const limBand = def.rarity === "limited" ? `<div class="ach-limband">LIMITED</div>` : "";
    const missedTag = missed ? `<div class="ach-missed"><span>LEIDER VERPASST</span></div>` : "";
    return `<div class="ach-card ${def.rarity} ${locked ? "locked" : ""} ${locked && st.holder ? "taken" : ""} ${st.foreign ? "foreign" : ""} ${missed ? "missed" : ""}" data-id="${def.id}">${limBand}${missedTag}${fx}${def.unique && !locked ? '<div class="ach-ribbon">UNIQUE 1/1</div>' : ""}
      <div class="ach-top"><span>${r.label}</span><span>#${idx}</span></div>
      <div class="ach-art">${locked ? "" : def.emoji}</div>
      <div class="ach-title" style="${titleStyle(def, hidden)}">${hidden ? "???" : escapeHtml(def.title)}</div>
      <div class="ach-desc">${hidden ? "Geheime Karte — wird erst verraten, wenn du sie gefunden hast." : howHidden ? "Wie man diese Karte bekommt, bleibt geheim." : escapeHtml(def.desc)}</div>
      <div class="ach-foot">${foot}</div></div>`;
  }
  const titleStyle = (def, hidden) => (!hidden && def.title.length > 14 ? `font-size:${def.title.length > 17 ? 14 : 16}px;` : "");
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function attachTilt(root) {
    root.querySelectorAll(".ach-card:not(.locked)").forEach((card) => {
      if (card._tilt) return; card._tilt = true;
      card.addEventListener("pointermove", (e) => {
        const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        card.style.setProperty("--ry", ((x - 0.5) * 22).toFixed(1) + "deg"); card.style.setProperty("--rx", ((0.5 - y) * 22).toFixed(1) + "deg");
        card.style.setProperty("--sx", (x * 100).toFixed(0) + "%"); card.style.setProperty("--sy", (y * 100).toFixed(0) + "%"); card.style.setProperty("--shine", "0.9");
      });
      const reset = () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); card.style.setProperty("--shine", "0"); };
      card.addEventListener("pointerleave", reset);
      // Touch: pointermove kommt nicht zuverlässig (Scrollen) -> eigene Touch-Auswertung, kurz nachleuchten
      const touchTilt = (e) => { const t = e.touches[0]; if (!t) return; const b = card.getBoundingClientRect(), x = Math.min(1, Math.max(0, (t.clientX - b.left) / b.width)), y = Math.min(1, Math.max(0, (t.clientY - b.top) / b.height));
        card.style.setProperty("--ry", ((x - 0.5) * 22).toFixed(1) + "deg"); card.style.setProperty("--rx", ((0.5 - y) * 22).toFixed(1) + "deg");
        card.style.setProperty("--sx", (x * 100).toFixed(0) + "%"); card.style.setProperty("--sy", (y * 100).toFixed(0) + "%"); card.style.setProperty("--shine", "0.9"); };
      card.addEventListener("touchstart", touchTilt, { passive: true });
      card.addEventListener("touchmove", touchTilt, { passive: true });
      card.addEventListener("touchend", () => setTimeout(reset, 700), { passive: true });
    });
  }

  // ------------------------------------------------------------ Popup
  function scheduleShow() { if (queue.length && !popupBusy && interacted) showNext(); }
  function showNext(preview) {
    if (popupBusy || !queue.length) return;
    popupBusy = true; injectStyle();
    const total = queue.length, id = queue.shift(), def = BY_ID.get(id);
    if (!def) { popupBusy = false; return showNext(preview); }
    const st = preview ? { demo: true, holder: def.unique ? "Beispielspieler" : null } : (unlocked.get(id) || { at: new Date().toISOString() });
    if (def.unique && !preview) st.holder = player;
    const ov = document.createElement("div"); ov.className = "ach-overlay " + (def.unique ? "unique" : "");
    ov.innerHTML = `<div class="ach-new">${def.unique ? "✦ EINZIGARTIGE KARTE ✦" : "★ NEUE KARTE ★"}</div>${cardHtml(def, st)}<div class="ach-hint">${total > 1 ? `noch ${total - 1} weitere · ` : ""}Tippen zum Fortfahren${preview ? " · Vorschau" : ""}</div>`;
    document.body.appendChild(ov); attachTilt(ov);
    // Schutz vor versehentlichem Wegtippen: die ersten 0,9 s zählen Klicks nicht (z.B. noch laufende Tipps eines Easter Eggs)
    const shownAt = Date.now();
    ov.addEventListener("click", () => { if (Date.now() - shownAt < 900) return; ov.remove(); if (!preview) markSeen(id); popupBusy = false; setTimeout(() => { if (queue.length) showNext(preview); }, 250); });
  }
  function previewPopup(ids) { injectStyle(); const list = (ids && ids.length ? ids : DEFS.map((d) => d.id)); const saved = queue; queue = list.slice(); popupBusy = false; showNext(true); setTimeout(() => { queue = saved; }, 0); }
  function armInteraction() {
    const go = () => { interacted = true; ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => document.removeEventListener(ev, go, true)); setTimeout(scheduleShow, 600); };
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => document.addEventListener(ev, go, true));
    setTimeout(() => { interacted = true; scheduleShow(); }, 4000);
  }

  // ------------------------------------------------------------ Galerie (Spieler) + Katalog (Admin)
  const SECTION_ORDER = ["kurz", "mittel", "lang", "unique"];
  const RARITY_ORDER = ["common", "rare", "epic", "legendary", "limited", "unique"];
  async function renderGallery(el) {
    if (!el) return; injectStyle();
    if (!player) { el.innerHTML = `<div class="ach-gal-head">Logge dich ein, um deine Sammelkarten zu sehen.</div>`; return; }
    el.innerHTML = `<div class="ach-gal-head">Lade deine Karten …</div>`;
    await loadFor(player);
    const have = DEFS.filter((d) => unlocked.has(d.id)).length, uniq = DEFS.filter((d) => d.unique);
    const warn = [!tables.ach && "Karten", !tables.firsts && "einzigartige Karten"].filter(Boolean);
    el.innerHTML = `<div class="ach-gal-head"><b>${have}</b> von <b>${DEFS.length}</b> Karten gesammelt${warn.length ? `<br><span style="opacity:.6;font-size:.85em;">(${warn.join(" & ")}: Datenbank-Migration steht noch aus${!tables.firsts ? " — einzigartige Karten werden erst danach vergeben" : ""})</span>` : ""}</div>` +
      RARITY_ORDER.map((rar) => {
        const list = DEFS.filter((d) => d.rarity === rar); if (!list.length) return "";
        const got = list.filter((d) => unlocked.has(d.id)).length;
        return `<div class="ach-section" style="color:${RARITIES[rar].color}">${RARITIES[rar].label} <span style="opacity:.6;font-weight:600;">· ${got}/${list.length}</span></div><div class="ach-gallery">${list.map((d) => {
          const f = firsts.get(d.id); const mine = unlocked.get(d.id);
          if (mine) return cardHtml(d, { ...mine, holder: d.unique ? player : null });
          // Unique-Karten anderer Spieler aufgedeckt zeigen (mit Besitzer)
          if (d.unique && f) return cardHtml(d, { at: f.at || new Date().toISOString(), holder: f.player, foreign: true });
          return cardHtml(d, { hideHow: true });
        }).join("")}</div>`;
      }).join("");
    attachTilt(el);
    const egg = el.querySelector('.ach-card[data-id="egg_wrong_card"].locked');
    if (egg) egg.addEventListener("click", () => { if (!player) return; unlock("egg_wrong_card"); setTimeout(() => renderGallery(el), 400); }, { once: true });
  }

  // Öffentliche Übersicht aller Unique-Karten mit Besitzer (Hall of Fame, ohne Login)
  async function renderUniqueBoard(el) {
    if (!el) return; injectStyle();
    el.innerHTML = `<div class="ach-gal-head">Lade Karten …</div>`;
    const c = sb(); const fm = new Map(); const limCount = new Map();
    if (c) {
      const { data, error } = await c.from("achievement_firsts").select("*");
      if (!error) (data || []).forEach((r) => fm.set(r.achievement_id, { player: r.player_name, at: r.claimed_at }));
      // wie viele haben die Limited-Karten? (falls lesbar)
      try {
        const ids = DEFS.filter((d) => d.rarity === "limited").map((d) => d.id);
        const { data: la } = await c.from("player_achievements").select("achievement_id").in("achievement_id", ids);
        (la || []).forEach((r) => limCount.set(r.achievement_id, (limCount.get(r.achievement_id) || 0) + 1));
      } catch (e) { /* optional */ }
    }
    const list = DEFS.filter((d) => d.unique);
    const lim = DEFS.filter((d) => d.rarity === "limited");
    const taken = list.filter((d) => fm.has(d.id)).length;
    el.innerHTML = `<div class="ach-gal-head"><b>${taken}</b> von <b>${list.length}</b> Unique-Karten vergeben — jede gibt es nur ein einziges Mal.</div>` +
      `<div class="ach-gallery">${list.map((d) => { const f = fm.get(d.id); return cardHtml(d, f ? { at: f.at || new Date().toISOString(), holder: f.player } : { hideHow: true }); }).join("")}</div>` +
      `<div class="ach-section" style="color:${RARITIES.limited.color}; margin-top:18px;">Limited – nur in einem bestimmten Zeitraum</div>` +
      `<div class="ach-gallery">${lim.map((d) => {
        const mine = player && unlocked.get(d.id);
        const open = limitedState(d) === "open";
        const n = limCount.get(d.id);
        const html = cardHtml(d, mine ? { ...mine } : {});
        const note = mine ? "✓ Gesammelt" : open ? "Noch erhältlich" : "Leider verpasst";
        return `<div style="display:flex; flex-direction:column; align-items:center; gap:6px;">${html}<div style="font-size:.8em; opacity:.8;">${note}${n != null ? ` · ${n}× vergeben` : ""}</div></div>`;
      }).join("")}</div>`;
    attachTilt(el);
  }

  // Admin-Testbereich: ALLE Karten (wie die Memes) — in Beispiel-Optik freigeschaltet, filterbar, mit Popup-Vorschau
  function renderCatalog(el) {
    if (!el) return; injectStyle();
    let fr = "all", ft = "all";
    const draw = () => {
      const list = DEFS.filter((d) => (fr === "all" || d.rarity === fr) && (ft === "all" || d.term === ft));
      const counts = Object.keys(RARITIES).map((k) => `${RARITIES[k].label}: ${DEFS.filter((d) => d.rarity === k).length}`).join(" · ");
      const btn = (grp, val, label, cur) => `<button class="${cur === val ? "on" : ""}" data-g="${grp}" data-v="${val}">${label}</button>`;
      el.innerHTML = `<div class="ach-gal-head"><b>${DEFS.length}</b> Karten gesamt (${counts})</div>
        <div class="ach-filter">${btn("r", "all", "Alle Seltenheiten", fr)}${Object.keys(RARITIES).map((k) => btn("r", k, RARITIES[k].label, fr)).join("")}</div>
        <div class="ach-filter">${btn("t", "all", "Alle Zeiträume", ft)}${SECTION_ORDER.map((k) => btn("t", k, TERMS[k].split(" · ")[0], ft)).join("")}
          <button id="achAllPop">▶ Alle als Popups</button></div>
        <div class="ach-gallery">${list.map((d) => `<div class="ach-cat-wrap">${cardHtml(d, { demo: true, holder: d.unique ? "Beispielspieler" : null })}<div class="ach-cat-info"><b>${d.id}</b> · ${TERMS[d.term].split(" · ")[0]}${d.secret ? " · geheim" : ""}<br>${TERMS[d.term].split(" · ")[1] || ""}</div></div>`).join("")}</div>`;
      attachTilt(el);
      el.querySelectorAll(".ach-filter button[data-g]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.g === "r") fr = b.dataset.v; else ft = b.dataset.v; draw(); }));
      el.querySelector("#achAllPop").addEventListener("click", () => previewPopup(list.map((d) => d.id)));
      el.querySelectorAll(".ach-card").forEach((c) => c.addEventListener("click", () => previewPopup([c.dataset.id])));
    };
    draw();
  }

  // ------------------------------------------------------------ Lebenszyklus
  async function setPlayer(name) {
    player = name || null;
    if (!player) { unlocked = new Map(); queue = []; loadedFor = null; progress = {}; return; }
    await loadFor(player);
    unlock("welcome");
    checkLimitedLogin();
    checkOrganizer();
    const now = new Date(); addSet("loginYears", String(now.getFullYear()));
    if (addSet("loginDays", now.toISOString().slice(0, 10)) >= 7) unlock("login_days_7");
    if ((progress.loginDays || []).length >= 30) unlock("login_days_30");
    // FOMO: drei Kalendertage am Stück
    try {
      const days = [...new Set(progress.loginDays || [])].sort();
      let run = 1;
      for (let i = 1; i < days.length; i++) { run = (Date.parse(days[i]) - Date.parse(days[i - 1]) === 86400000) ? run + 1 : 1; if (run >= 3) { unlock("login_streak3"); break; } }
    } catch (e) { /* egal */ }
    if ((progress.loginYears || []).length >= 2) unlock("login_years_2");
    try { if (global.matchMedia && (global.matchMedia("(display-mode: standalone)").matches || global.navigator.standalone)) unlock("app_installed"); } catch (e) { /* optional */ }
    if (pageKey && !pageTracked) { pageTracked = true; trackPage(pageKey); }
    scheduleShow();
  }
  function checkOrganizer() {
    const me = String(player || "").trim().toLowerCase();
    DEFS.filter((d) => d.org && d.org === me).forEach((d) => unlock(d.id));
  }
  function checkLimitedLogin() {
    const now = new Date(), early = new Date(EARLY_DEADLINE);
    if (now < early) unlock("u_early_starter");
    const st = stateRef || {};
    const cfg = st.config || {};
    const kickoff = cfg.nextTournamentAt ? new Date(cfg.nextTournamentAt) : null;
    const running = Array.isArray(st.players) && st.players.length > 0;
    if (now >= early && now.getFullYear() === FOUNDER_YEAR && !running && kickoff && now < kickoff) unlock("lim_earlybird");
    const year = Number(cfg.year) || 0;
    if (running && year === FOUNDER_YEAR && st.players.some((p) => p.name === player)) unlock("lim_founder");
  }
  // Draft-Karten: wird von der Admin-Seite nach jedem Team-Pick aufgerufen (vergibt per grant).
  // available: [{ id, rating }] der VOR dem Pick freien Teams (inkl. gewähltem)
  async function evaluateDraftPick(name, pickedId, available) {
    try {
      if (!global.MB.Avatar) return;
      await global.MB.Avatar.load();
      if (!global.MB.Avatar.hasOwn(name)) return;
      const fav = global.MB.Avatar.get(name).team; if (!fav) return;
      const rate = new Map((available || []).map((t) => [t.id, Number(t.rating) || 0]));
      const picked = rate.get(pickedId) || 0;
      const favFree = rate.has(fav);
      if (pickedId === fav && favFree && [...rate.values()].some((r) => r >= picked + 3)) await grant("draft_fanlove", name);
      if (pickedId !== fav && divOf(pickedId) && divOf(pickedId) === divOf(fav)) await grant("draft_traitor", name);
      // Prinzipientreu: Divisionsrivale des Lieblingsteams war mind. 3 OVR besser als das gewählte (fremde) Team
      if (pickedId !== fav && divOf(pickedId) !== divOf(fav)) {
        const skipped = [...rate.entries()].some(([id, r]) => id !== fav && divOf(id) && divOf(id) === divOf(fav) && r >= picked + 3);
        if (skipped) await grant("draft_principles", name);
      }
    } catch (e) { console.warn("Draft-Karten:", e); }
  }
  async function onLogin(name) { await setPlayer(name); if (stateRef) evaluateTipps(stateRef); }
  function onLogout() { setPlayer(null); }
  async function init(state) {
    stateRef = state || stateRef;
    const name = global.MB.UI && global.MB.UI.currentUser ? global.MB.UI.currentUser() : null;
    if (name !== player) { pageTracked = false; await setPlayer(name); }
    if (player && stateRef) evaluateTipps(stateRef);
  }

  armInteraction();
  try { global.addEventListener("appinstalled", () => unlock("app_installed")); } catch (e) { /* optional */ }
  global.MB.Achievements = { DEFS, RARITIES, TERMS, setPage, init, onLogin, onLogout, track, unlock, evaluateTipps, trackPage, renderGallery, renderUniqueBoard, renderCatalog, resetAll, grant, revoke, evaluateDraftPick, flushUniqueRoundup, checkPreTournamentRoundup, count: () => unlocked.size, previewPopup, isTableMissing: () => !tables.ach };
})(window);
