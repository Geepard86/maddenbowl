// ============================================================================
// avatar.js — selbst gestaltete Spielerfiguren
// ----------------------------------------------------------------------------
// Jeder Spieler kann im Spielerprofil (Hall of Fame) seine Figur bauen:
// Körperform, Größe, Hautton, Frisur, Haarfarbe, Bart, Brille, Kopfbedeckung,
// Kleidungsfarbe, Lieblingsteam, Kette. Gespeichert in Supabase
// (app_config "player_avatars" = { "<name klein>": config }).
//
// Dieselbe Figur erscheint überall: Musikvideos (song-stage.js über
// toVariant), Draft-Einlauf, Kiss Cam / Fan-Cam im Studio, Profil.
// Spieler ohne eigene Figur bekommen eine stabile Zufallsfigur (aus dem Namen).
// ============================================================================
(function (global) {
  const KEY = "player_avatars";
  const OPTIONS = {
    body: [["slim", "Schlank"], ["normal", "Normal"], ["athletic", "Athletisch"], ["strong", "Kräftig"], ["round", "Rund"]],
    skin: ["#f6d3b8", "#f0c4a0", "#e0ac82", "#d9a074", "#c68642", "#a5683a", "#7a4a2b", "#5b3720"],
    hair: [["short", "Kurz"], ["side", "Seitenscheitel"], ["spiky", "Stachelig"], ["fade", "Fade"], ["long", "Lang"], ["ponytail", "Zopf"], ["curls", "Locken"], ["afro", "Afro"], ["braids", "Zöpfe"], ["mohawk", "Irokese"], ["bun", "Dutt"], ["buzz", "Buzzcut"], ["shaved", "2 mm rasiert"], ["bald", "Glatze"]],
    hairColor: ["#0d0a08", "#3b2414", "#7a4a1c", "#a8452a", "#c9a227", "#e8d08a", "#9a9a9a", "#e6e6e6", "#2b5fd9", "#d64aa0"],
    beard: [["none", "Kein Bart"], ["stubble", "Drei-Tage-Bart"], ["full", "Vollbart"], ["full_mustache", "Vollbart + Oberlippe"], ["chinstrap", "Kinnbart"], ["goatee", "Ziegenbart"], ["mustache", "Schnurrbart"]],
    glasses: [["none", "Keine"], ["glasses", "Rund"], ["glasses_square", "Eckig"], ["shades", "Sonnenbrille"], ["shades_sport", "Sportbrille"], ["heart", "Herzchen-Brille"], ["pixel", "Pixel-Brille"], ["goggles", "Schutzbrille"]],
    hat: [["none", "Nichts"], ["cap", "Cap"], ["snapback", "Snapback rückwärts"], ["visor", "Visor"], ["bandana", "Bandana"], ["headset", "Coach-Headset"], ["beanie", "Mütze"], ["band", "Schweißband"],
      ["qbhelmet", "QB-Helm"], ["qbvisor", "QB-Helm + Visier"], ["goldhelmet", "Goldener Helm"], ["viking", "Wikinger-Helm"], ["crown", "Juwelen-Krone"],
      ["goldcrown", "Goldene Krone"], ["toiletcrown", "Klobrillen-Krone"], ["nightcap", "Schlafmütze"], ["detective", "Detektivhut"], ["scoutcap", "Scout-Kappe"], ["hardhat", "Bauhelm"], ["tophat", "Zylinder"], ["laurel", "Lorbeerkranz"], ["firehelmet", "Brennender Helm"],
      ["leatherhelmet", "Lederhelm (1930)"], ["champcap", "Champion-Mütze"], ["santahat", "Weihnachtsmütze"], ["reindeer", "Rentiergeweih"], ["pumpkin", "Kürbis-Helm"], ["beerhelmet", "Bierhelm"], ["bearhood", "Bären-Kapuze"]],
    shoulder: [["none", "Nichts"], ["bird", "Vogel auf der Schulter"]],
    above: [["none", "Nichts"], ["raincloud", "Regenwolke"]],
    face: [["none", "Nichts"], ["eyeblack", "Eye Black"], ["monocle", "Monokel"], ["thirdeye", "Drittes Auge"], ["clownnose", "Clownsnase"], ["earcard", "Karte hinterm Ohr"], ["icebeard", "Eiszapfen-Bart"]],
    mouth: [["none", "Nichts"], ["toothpick", "Zahnstocher"], ["gum", "Kaugummiblase"], ["grillzGold", "Grillz Gold"], ["grillzSilver", "Grillz Silber"], ["mouthguard", "Mundschutz"]],
    top: [["tshirt", "T-Shirt"], ["hoodie", "Hoodie"], ["polo", "Coach-Polo"], ["jersey", "Jersey"], ["trackjacket", "Trainingsjacke"], ["hawaii", "Hawaiihemd"], ["glitter", "Glitzer-Trikot"], ["hofjacket", "Hall-of-Famer-Sakko"],
      ["armor", "Ritterrüstung"], ["pyjama", "Pyjama"], ["pressvest", "Presse-Weste"], ["trench", "Trenchcoat"], ["altimashirt", "Altima-Bowl-Shirt"], ["labcoat", "Laborkittel"], ["suit", "Anzug"], ["referee", "Schiri-Hemd"], ["peacehoodie", "Batik-Hoodie"], ["retrojersey", "Retro-Trikot"], ["champshirt", "Champion-Shirt"], ["apron", "Grillschürze"], ["bearcostume", "Altima-Bär-Kostüm"]],
    waist: [["none", "Nichts"], ["toolbelt", "Werkzeuggürtel"]],
    back: [["none", "Nichts"], ["cape", "Altima-Umhang"], ["royalcape", "Königs-Umhang"], ["blanket", "Kuscheldecke"], ["confcape", "Conference-Umhang"]],
    neck: [["none", "Nichts"], ["chain", "Goldkette"], ["medal", "Medaille"], ["towel", "Handtuch"], ["headphones", "Kopfhörer"], ["dfence", "D-Fence-Kette"], ["bell", "Glöckchen"], ["whistle", "Trillerpfeife"], ["cctowel", "Rosa Handtuch"], ["peace", "Peace-Anhänger"], ["lei", "Hawaii-Lei"]],
    badge: [["none", "Nichts"], ["ribbon", "Crucial-Catch-Schleife"], ["star", "Pro-Bowl-Stern"], ["captain", "Captain-„C“"], ["est2027", "„Est. 2027“"], ["apppin", "App-Icon-Anstecker"], ["dart", "Dartpfeil"], ["clover", "Glücksklee"], ["zero", "„0“-Anstecker"], ["founder", "Founder-Anstecker"], ["divbanner", "Divisions-Banner"]],
    hand: [["none", "Nichts"], ["foamfinger", "Schaumstoff-Finger"], ["controller", "Controller"], ["beer", "Bierdose"], ["popcorn", "Popcorn"], ["flag", "Fahne"], ["scepter", "Zepter"],
      ["crystal", "Glaskugel"], ["calcwatch", "Taschenrechner-Uhr"], ["phone", "Handy"], ["mic", "Mikrofon"], ["binoculars", "Fernglas"], ["yellowflag", "Gelbe Flagge"], ["fixedcontroller", "Geflickter Controller"], ["ccgloves", "Rosa Handschuhe"], ["turkeyleg", "Truthahnbein"], ["remote", "Fernbedienung"], ["tongs", "Grillzange"], ["clipboard", "Klemmbrett"], ["minitrophy", "Mini-Pokal"]],
    aura: [["none", "Nichts"], ["aura", "Leuchtende Aura"]],
    ccColor: ["#ff4fa3", "#14b8a6", "#7a3cff", "#f97316", "#facc15", "#3b82f6"],
    // Farben für Brillengestell und Kopfbedeckung
    glassesColor: ["#1a1a1a", "#6b4a2b", "#9aa3ad", "#c9a227", "#d50a0a", "#1e50c8", "#ffffff", "#ff4fa3"],
    hatColor: ["#14181f", "#2a2f3a", "#d50a0a", "#1e50c8", "#0b6b3a", "#c99700", "#ffffff", "#7a3cff", "#f97316"],
  };
  // Manche Teile gibt es erst mit Sammelkarten: Zahl = so viele Karten, "legendary"/"unique"/"epic" = mind. eine solche Karte
  // Freischaltungen. need: Zahl = Anzahl Karten; "epic"/"legendary"/"limited" = mind. eine solche Karte;
  // "uniqueLeader" = allein die meisten Unique-Karten (Wanderpreis); "allRegular" = alle regulären Karten
  const UNLOCKS = {
    hat: { qbhelmet: { need: 10, label: "10 Sammelkarten" }, qbvisor: { need: 15, label: "15 Sammelkarten" }, goldhelmet: { need: 30, label: "30 Sammelkarten" },
crown: { need: "uniqueLeader", label: "allein die meisten Unique-Karten" } },
    neck: { dfence: { need: 5, label: "5 Sammelkarten" } },
    badge: { ribbon: { need: 15, label: "15 Sammelkarten" }, star: { need: "epic", label: "eine epische Karte" }, captain: { need: 20, label: "20 Sammelkarten" }, est2027: { need: "limited", label: "eine limitierte Karte" } },
    top: { glitter: { need: 25, label: "25 Sammelkarten" }, hofjacket: { need: 40, label: "40 Sammelkarten" } },
    back: { cape: { need: "legendary", label: "eine legendäre Karte" } },
    hand: { scepter: { need: "uniqueLeader", label: "allein die meisten Unique-Karten" } },
    aura: { aura: { need: "allRegular", label: "alle regulären Karten" } },
  };
  // Team-Teile: Lieblingsteam ab 15 Karten, jedes Team nach 3 Siegen gegen Spieler mit diesem Team (komplette Historie)
  const TEAM_ITEMS = [
    ["hat", "viking", "MIN"], ["hat", "cheesehead", "GB", "Käsekopf-Hut"], ["hat", "bearhat", "CHI", "Bärenmütze"], ["hat", "lionmane", "DET", "Löwenmähne"],
    ["hat", "tricorn", "NE", "Dreispitz"], ["hat", "buffalohorns", "BUF", "Büffelhörner"], ["hat", "flighthelmet", "NYJ", "Fliegerhelm"], ["hat", "ravenhat", "BAL", "Hut mit Rabenfeder"],
    ["hat", "cowboystar", "DAL", "Cowboyhut mit Stern"], ["hat", "horsemane", "DEN", "Pferdemähne"], ["hat", "dogears", "CLE", "Hundeohren & -nase"], ["hat", "pantherears", "CAR", "Pantherohren"],
    ["hat", "piratehat", "TB", "Piratenhut"], ["hat", "minerhat", "SF", "Goldgräber-Hut"], ["hat", "neonfeathers", "SEA", "Neongrüne Federn"], ["hat", "ramhorns", "LAR", "Widderhörner"],
    ["hat", "cardinalcrest", "ARI", "Vogel-Kamm"], ["hat", "bullhorns", "HOU", "Stierhörner-Helm"], ["hat", "greekhelmet", "TEN", "Griechischer Helm"],
    ["face", "eyepatch", "LV", "Augenklappe"], ["face", "tigerstripes", "CIN", "Tigerstreifen"], ["face", "jaguarspots", "JAX", "Jaguarflecken"], ["face", "boltearring", "LAC", "Blitz-Ohrring"],
    ["neck", "horseshoe", "IND", "Hufeisen-Kette"], ["neck", "terribletowel", "PIT", "Gelbes Fan-Handtuch"], ["neck", "bbqbib", "KC", "BBQ-Lätzchen"], ["neck", "epaulettes", "WAS", "Schulterklappen"],
    ["waist", "swimring", "MIA", "Delfin-Schwimmring"], ["back", "eaglewings", "PHI", "Adlerflügel"], ["hand", "foamhand", "NYG", "Riesen-Schaumstoffhand"], ["hand", "falconglove", "ATL", "Falknerhandschuh"],
    ["above", "fleurhalo", "NO", "Heiligenschein mit Lilie"],
  ];
  TEAM_ITEMS.forEach(([slot, v, team, label]) => {
    OPTIONS[slot] = OPTIONS[slot] || [["none", "Nichts"]];
    if (label && !OPTIONS[slot].some((o) => o[0] === v)) OPTIONS[slot].push([v, label]);
    UNLOCKS[slot] = UNLOCKS[slot] || {}; UNLOCKS[slot][v] = { need: "team", team };
  });
  // ---------------- Sets ----------------
  const DIVS = { "AFC East": ["BUF", "MIA", "NE", "NYJ"], "AFC North": ["BAL", "CIN", "CLE", "PIT"], "AFC South": ["HOU", "IND", "JAX", "TEN"], "AFC West": ["DEN", "KC", "LV", "LAC"],
    "NFC East": ["DAL", "NYG", "PHI", "WAS"], "NFC North": ["CHI", "DET", "GB", "MIN"], "NFC South": ["ATL", "CAR", "NO", "TB"], "NFC West": ["ARI", "LAR", "SF", "SEA"] };
  const SETS = [
    { id: "gameday", card: "set_gameday", label: "Gameday", items: [["hat", "qbvisor"], ["top", "jersey"], ["face", "eyeblack"], ["mouth", "mouthguard"]] },
    { id: "sideline", card: "set_sideline", label: "Sideline Boss", items: [["hat", "headset"], ["top", "polo"], ["neck", "whistle"], ["hand", "clipboard"]] },
    { id: "tailgate", card: "set_tailgate", label: "Tailgate", items: [["hat", "beerhelmet"], ["top", "apron"], ["hand", "tongs"]] },
    { id: "royal", card: "set_royal", label: "Royal", items: [["hat", "goldcrown"], ["back", "royalcape"], ["hand", "scepter"]] },
    { id: "referee", card: "ref_victim", label: "Schiri", items: [["top", "referee"], ["neck", "whistle"], ["hand", "yellowflag"]] },
  ];
  function setStatus(name, ownedIds, defs) {
    const free = (slot, v) => !lockInfo(slot, v, ownedIds, defs, name);
    const out = {};
    SETS.forEach((st) => { if (st.card !== "ref_victim") out[st.card] = st.items.every(([slot, v]) => free(slot, v)); });
    out.set_holidays = ["col_halloween", "col_thanksgiving", "col_christmas"].every((id) => (ownedIds || []).includes(id));
    const teamFree = (team) => TEAM_ITEMS.filter((t) => t[2] === team).every(([slot, v]) => free(slot, v));
    out.set_division = Object.values(DIVS).some((teams) => teams.every(teamFree));
    out.set_conference = ["AFC", "NFC"].some((cf) => Object.entries(DIVS).filter(([d]) => d.startsWith(cf)).every(([, teams]) => teams.every(teamFree)));
    out.set_league = Object.values(DIVS).every((teams) => teams.every(teamFree));
    out.set_dynasty = (champions.get(String(name || "").toLowerCase()) || []).length >= 2;
    out.set_fashion = Object.entries(OPTIONS).every(([slot, list]) => !Array.isArray(list) || !Array.isArray(list[0]) || list.every(([v]) => free(slot, v)));
    return out;
  }
  let champions = new Map(); // spielername -> [{ year, team }]
  let teamWins = new Map(); // spielername -> { TEAM: Siege gegen dieses Team }
  // Teile, die an eine bestimmte Karte gebunden sind (need "card:<id>")
  const CARD_ITEMS = {
    hat: { leatherhelmet: "col_throwback", santahat: "col_christmas", reindeer: "col_christmas", pumpkin: "col_halloween", beerhelmet: "fun_beer", bearhood: "fun_bear", firehelmet: "on_fire", goldcrown: "tipp_self_crowned", toiletcrown: "tipp_self_toilet", nightcap: "night_owl", detective: "egg_roster", scoutcap: "roster_32", hardhat: "u_org_tim", tophat: "u_org_markus", laurel: "u_org_tobif" },
    above: { raincloud: "tipp_final_against_self_won" },
    face: { icebeard: "ice_cold", monocle: "tipp_rate70", thirdeye: "tipp_rate80", clownnose: "tipp_self_lost", earcard: "egg_wrong_card" },
    glasses: { heart: "praise", pixel: "egg_konami", goggles: "u_org_alex" },
    top: { peacehoodie: "col_peace", retrojersey: "col_throwback", apron: "fun_grill", bearcostume: "fun_bear", referee: "ref_victim", armor: "tipp_loyal", pyjama: "night_owl", pressvest: "u_first_interview", trench: "egg_roster", altimashirt: ["shop_first", "u_first_merch"], labcoat: "u_org_alex", suit: "u_org_markus" },
    waist: { toolbelt: "u_org_tim" },
    back: { royalcape: "tipp_champion", blanket: "fun_couch" },
    shoulder: { bird: "lim_earlybird" },
    neck: { bell: "push_on", whistle: "ref_victim", cctowel: "col_crucial", peace: "col_peace", lei: "col_probowl" },
    badge: { ribbon: "col_crucial", founder: "lim_founder", apppin: "app_installed", dart: "egg_bullseye", clover: "lucky_loser", zero: "shutout" },
    hand: { ccgloves: "col_crucial", turkeyleg: "col_thanksgiving", remote: "fun_couch", tongs: "fun_grill", clipboard: "fun_sofa", yellowflag: "ref_victim", fixedcontroller: "controller_throw", crystal: "u_sole_oracle", calcwatch: "tipp_perfect_day", phone: "login_streak3", mic: "interview_1", binoculars: "egg_landscape" },
  };
  CARD_ITEMS.badge.divbanner = "set_division"; CARD_ITEMS.back.confcape = "set_conference"; CARD_ITEMS.hand.minitrophy = "set_league";
  // Champion-Mütze/-Shirt: nur mit mindestens einem Titel
  UNLOCKS.hat.champcap = { need: "champion" }; UNLOCKS.top = UNLOCKS.top || {}; UNLOCKS.top.champshirt = { need: "champion" };
  delete (UNLOCKS.badge || {}).ribbon; // Schleife jetzt über die Crucial-Catch-Karte (Oktober)
  Object.entries(CARD_ITEMS).forEach(([slot, items]) => { UNLOCKS[slot] = UNLOCKS[slot] || {}; Object.entries(items).forEach(([v, id]) => { UNLOCKS[slot][v] = { need: "card", cards: [].concat(id) }; }); });
  // ctx: { owned: [Karten-IDs], defs: [Kartendefinitionen], name }
  function lockInfo(kind, value, ownedIds, defs, name) {
    const u = UNLOCKS[kind] && UNLOCKS[kind][value]; if (!u) return null;
    const ids = ownedIds || [];
    let ok;
    if (u.need === "champion") return (champions.get(String(name || "").toLowerCase()) || []).length ? null : "einen Altima-Bowl-Titel";
    if (u.need === "team") {
      const key = String(name || "").toLowerCase();
      const fav = cache && cache[key] && cache[key].team;
      const wins = ((teamWins.get(key) || {})[u.team]) || 0;
      if ((fav === u.team && ids.length >= 15) || wins >= 3) return null;
      const tn = ((global.MB.nflTeams || []).find((t) => t.id === u.team) || {}).n || u.team;
      return `3 Siege gegen die ${tn} (bisher ${wins})${fav === u.team ? " – oder 15 Sammelkarten, da Lieblingsteam" : " oder als Lieblingsteam ab 15 Sammelkarten"}`;
    }
    if (u.need === "card") {
      if (u.cards.some((id) => ids.includes(id))) return null;
      const d = (defs || []).find((x) => x.id === u.cards[0]);
      return `Karte „${d ? d.title : u.cards[0]}“`;
    }
    if (typeof u.need === "number") ok = ids.length >= u.need;
    else if (u.need === "uniqueLeader") ok = !!name && uniqueLeader === String(name).toLowerCase();
    else if (u.need === "allRegular") ok = ids.includes("cards_all");
    else ok = ids.some((id) => { const d = (defs || []).find((x) => x.id === id); return d && d.rarity === u.need; });
    return ok ? null : u.label;
  }
  const TEAM_COL = { ARI: ["#97233F", "#FFB612"], ATL: ["#A71930", "#000000"], BAL: ["#241773", "#9E7C0C"], BUF: ["#00338D", "#C60C30"], CAR: ["#0085CA", "#101820"], CHI: ["#0B162A", "#C83803"], CIN: ["#FB4F14", "#000000"], CLE: ["#311D00", "#FF3C00"],
    DAL: ["#041E42", "#869397"], DEN: ["#FB4F14", "#002244"], DET: ["#0076B6", "#B0B7BC"], GB: ["#203731", "#FFB612"], HOU: ["#03202F", "#A71930"], IND: ["#002C5F", "#A2AAAD"], JAX: ["#006778", "#D7A22A"], KC: ["#E31837", "#FFB81C"],
    LV: ["#000000", "#A5ACAF"], LAC: ["#0080C6", "#FFC20E"], LAR: ["#003594", "#FFA300"], MIA: ["#008E97", "#FC4C02"], MIN: ["#4F2683", "#FFC62F"], NE: ["#002244", "#C60C30"], NO: ["#101820", "#D3BC8D"], NYG: ["#0B2265", "#A71930"],
    NYJ: ["#125740", "#FFFFFF"], PHI: ["#004C54", "#A5ACAF"], PIT: ["#101820", "#FFB612"], SF: ["#AA0000", "#B3995D"], SEA: ["#002244", "#69BE28"], TB: ["#D50A0A", "#34302B"], TEN: ["#0C2340", "#4B92DB"], WAS: ["#5A1414", "#FFB612"] };
  // Kontrastfarbe zur Kleidung: Accessoires (Schaumstoff-Finger, Fahne, Umhang …) sollen sich abheben
  function contrastOf(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return "#ffd23f";
    const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
    let h = 0; if (mx !== mn) { const d = mx - mn; h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    if (l > 0.55 || (h >= 30 && h <= 70 && l > 0.35)) return "#0b1328"; // helle/gelbe Kleidung -> Navy
    if (h < 20 || h > 340) return "#ffd23f";                              // rote Kleidung -> Gold
    return "#d50a0a";                                                      // sonst Rot
  }
  const BODY_W = { slim: 0.86, normal: 1, athletic: 1.08, strong: 1.18, round: 1.24 };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function hash(str) { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

  // stabile Zufallsfigur aus dem Namen
  function randomFor(name) {
    let h = hash(String(name || "x").toLowerCase());
    // gut durchmischter Zufall (fmix32), sonst ähneln sich Figuren mit ähnlichen Namen stark
    const fmix = (x) => { x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x >>> 0; };
    h = fmix(h);
    const r = (arr) => { h = fmix((h + 0x9e3779b9) >>> 0); return arr[h % arr.length]; };
    const hair = r(OPTIONS.hair)[0];
    return {
      body: r(OPTIONS.body)[0], height: 1, skin: r(OPTIONS.skin), hair, hairColor: r(OPTIONS.hairColor.slice(0, 7)),
      beard: r([["none"], ["none"], ["stubble"], ["full"], ["goatee"], ["mustache"]])[0], glasses: r([["none"], ["none"], ["none"], ["glasses"], ["shades"]])[0],
      hat: r([["none"], ["none"], ["none"], ["cap"], ["beanie"], ["band"]])[0], shirt: r(["#d50a0a", "#1e50c8", "#0b6b3a", "#2a2f3a", "#7a3cff", "#c99700", "#ffffff"]), team: "", chain: r([true, false, false]),
      random: true,
    };
  }

  let cache = null, loading = null, titles = null, uniqueLeader = null;
  async function load(force) {
    if (cache && !force) return cache;
    if (loading) return loading;
    loading = (async () => {
      try { const raw = global.MB.getAppConfig ? await global.MB.getAppConfig(KEY) : null; cache = raw ? JSON.parse(raw) : {}; }
      catch (e) { cache = cache || {}; }
      // Ringe = tatsächlich gewonnene Titel (komplette Historie aus der Datenbank)
      try { if (!titles && global.MB.loadAndBuildHistory) { const H = await global.MB.loadAndBuildHistory(); titles = new Map(); (H.ringsByPlayer || new Map()).forEach((n, k) => titles.set(String(k).toLowerCase(), Number(n) || 0)); } } catch (e) { /* ohne Ringe */ }
      try {
        const H = global.MB.loadAndBuildHistory ? await global.MB.loadAndBuildHistory() : { matches: [] };
        const add = (who, team) => { if (!who || !team) return; const k = String(who).toLowerCase(); const o = teamWins.get(k) || {}; o[team] = (o[team] || 0) + 1; teamWins.set(k, o); };
        (H.matches || []).forEach((m) => { if (m.homeScore == null) return; if (m.homeScore > m.awayScore) add(m.homePlayer, m.awayTeam); else if (m.awayScore > m.homeScore) add(m.awayPlayer, m.homeTeam); });
        const st = global.MB.fetchCloudState ? await global.MB.fetchCloudState() : null;
        const P = (st && st.players) || [];
        ((st && st.matches) || []).forEach((m) => { const h = P[m.p1], a = P[m.p2]; if (!h || !a || m.s1 == null || m.s2 == null) return; if (m.s1 > m.s2) add(h.name, a.team); else if (m.s2 > m.s1) add(a.name, h.team); });
        ((st && st.playoffMatches) || []).forEach((m) => { if (!m.p1 || !m.p2 || m.s1 == null || m.s2 == null) return; if (m.s1 > m.s2) add(m.p1.name, m.p2.team); else if (m.s2 > m.s1) add(m.p2.name, m.p1.team); });
      } catch (e) { /* ohne Team-Siege */ }
      try {
        const seasons = global.MB.loadHistorySeasons ? await global.MB.loadHistorySeasons() : [];
        champions = new Map();
        seasons.forEach((se) => { const w = (se.standings || []).find((r) => Number(r.rank) === 1); if (!w) return; const k = String(w.name).toLowerCase();
          const team = ((se.players || []).find((p) => p.name === w.name) || {}).team; const arr = champions.get(k) || []; arr.push({ year: se.season, team }); champions.set(k, arr); });
      } catch (e) { /* ohne Champion-Sets */ }
      // Wer hat allein die meisten Unique-Karten? (Juwelen-Krone & Zepter wandern mit)
      try {
        const c = global.MB.getSupabaseClient && global.MB.getSupabaseClient();
        if (c) { const { data } = await c.from("achievement_firsts").select("achievement_id, player_name");
          const cnt = new Map(); (data || []).filter((r) => /^u_/.test(r.achievement_id) && !/^u_org_/.test(r.achievement_id)).forEach((r) => { const k = String(r.player_name).toLowerCase(); cnt.set(k, (cnt.get(k) || 0) + 1); });
          const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]); uniqueLeader = top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : null; }
      } catch (e) { /* egal */ }
      loading = null; return cache;
    })();
    return loading;
  }
  function get(name) {
    const key = String(name || "").trim().toLowerCase();
    const own = cache && cache[key];
    const c = own ? { ...randomFor(name), ...own, random: false } : randomFor(name);
    c._rings = (titles && titles.get(key)) || 0;
    const ch = champions.get(key) || [];
    c._champ = ch.find((x) => String(x.year) === String(c.champYear)) || ch[ch.length - 1] || null;
    // Wanderpreis: Krone/Zepter nur, solange man allein vorne liegt
    if (uniqueLeader !== key) { if (c.hat === "crown") c.hat = "none"; if (c.hand === "scepter") c.hand = "none"; }
    if (!c.neck) c.neck = c.chain ? "chain" : "none";
    return c;
  }
  function hasOwn(name) { return !!(cache && cache[String(name || "").trim().toLowerCase()]); }
  async function save(name, cfg) {
    const all = { ...(await load(true)) };
    const clean = { ...cfg }; delete clean.random;
    all[String(name).trim().toLowerCase()] = clean;
    await global.MB.setAppConfig(KEY, JSON.stringify(all));
    cache = all;
  }

  // Für song-stage.js (rapperSVG): Variante im dortigen Format
  function toVariant(cfg) {
    const c = cfg || {};
    const style = c.hat === "cap" ? "cap" : c.hat === "band" ? "band" : (c.hair || "short");
    return { skin: c.skin, hair: c.hairColor, style, beardType: c.beard || "none", beard: c.beard && c.beard !== "none",
      shades: c.glasses === "shades" || c.glasses === "shades_sport", glasses: c.glasses === "glasses" || c.glasses === "glasses_square", chain: !!c.chain, beanie: c.hat === "beanie",
      bodyW: BODY_W[c.body] || 1, height: Number(c.height) || 1, own: !c.random };
  }

  // ------------------------------------------------------------ Teile (Kopf um 130/118, wie die Musikvideo-Figuren)
  function hairBack(c) {
    const h = c.hairColor;
    if (/^(leatherhelmet|santahat|pumpkin|beerhelmet|bearhood|champcap)$/.test(c.hat)) return "";
    if (c.hat === "lionmane") return `<g fill="#c8781e">${[...Array(16)].map((_, i) => { const a = i / 16 * Math.PI * 2; return `<circle cx="${130 + 64 * Math.cos(a)}" cy="${118 + 70 * Math.sin(a)}" r="24"/>`; }).join("")}</g><circle cx="130" cy="118" r="62" fill="#e0952e"/>`;
    if (/^(qbhelmet|qbvisor|goldhelmet|viking|bandana|firehelmet|bullhorns|greekhelmet|flighthelmet|piratehat|minerhat|cowboystar|tricorn|bearhat|cheesehead)$/.test(c.hat)) return "";
    if (c.hat === "beanie") return "";
    switch (c.hair) {
      case "long": return `<path d="M76 110 Q70 210 92 236 L168 236 Q190 210 184 110 Q180 60 130 58 Q80 60 76 110Z" fill="${h}"/>`;
      case "afro": return `<circle cx="130" cy="96" r="74" fill="${h}"/>`;
      case "curls": return `<g fill="${h}">${[[86, 92], [98, 70], [122, 60], [146, 62], [168, 76], [178, 100], [80, 118], [180, 124]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/>`).join("")}</g>`;
      case "braids": return `<path d="M82 104 Q68 190 86 232 M98 112 Q90 190 100 236 M178 104 Q192 190 174 232 M162 112 Q170 190 160 236" stroke="${h}" stroke-width="12" stroke-linecap="round" fill="none"/>`;
      case "bun": return `<circle cx="130" cy="52" r="22" fill="${h}"/>`;
      case "ponytail": return `<path d="M168 92 Q206 110 196 170 Q190 200 176 214 Q186 168 166 120Z" fill="${h}"/>`;
      default: return "";
    }
  }
  function hairTop(c, c1, c2) {
    const h = c.hairColor;
    if (c.hatColor) { c1 = c.hatColor; c2 = c.hatColor === "#ffffff" ? "#1a1a1a" : "#ffffff"; }
    if (c.hat === "cap") return `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="${c1}"/><path d="M78 108 Q130 96 182 108 L198 118 Q130 100 70 116Z" fill="${c2}"/><circle cx="130" cy="54" r="5" fill="${c2}"/>` +
      (c.team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(c.team)}.png" x="110" y="62" width="40" height="34"/>` : "");
    const plain = hairTopPlain(c);
    const champ = c._champ || {};
    const champCol = TEAM_COL[champ.team] || ["#c99700", "#0b1328"];
    const extraHat = ({
      leatherhelmet: `<path d="M78 120 Q72 52 130 50 Q188 52 182 120 L170 132 L168 104 Q130 92 92 104 L90 132Z" fill="#7a4a1c" stroke="#4a2a10" stroke-width="3"/><path d="M130 52 V100 M104 58 V100 M156 58 V100" stroke="#5a3414" stroke-width="3"/>`,
      champcap: `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="${champCol[0]}"/><path d="M78 108 Q130 96 182 108 L198 118 Q130 100 70 116Z" fill="${champCol[1]}"/><text x="130" y="84" text-anchor="middle" font-family="Impact" font-size="14" fill="${champCol[1]}">CHAMPS</text><text x="130" y="100" text-anchor="middle" font-family="Impact" font-size="13" fill="#ffd23f">${esc(champ.year || "")}</text>`,
      santahat: `<path d="M82 104 Q92 50 140 48 Q190 52 206 100 L180 92 Q168 70 150 70 L170 102Z" fill="#d50a0a"/><rect x="78" y="94" width="104" height="18" rx="8" fill="#fff"/><circle cx="206" cy="102" r="12" fill="#fff"/>`,
      reindeer: hairTopPlain(c) + `<path d="M98 72 L86 30 M90 46 L74 38 M94 58 L80 56 M162 72 L174 30 M170 46 L186 38 M166 58 L180 56" stroke="#7a4a1c" stroke-width="6" stroke-linecap="round"/><circle cx="130" cy="136" r="9" fill="#e11d2a"/>`,
      pumpkin: `<path d="M70 118 Q66 48 130 44 Q194 48 190 118 Q160 140 130 136 Q100 140 70 118Z" fill="#f28c28" stroke="#c4621a" stroke-width="4"/><path d="M100 50 Q96 90 104 128 M160 50 Q164 90 156 128" stroke="#c4621a" stroke-width="3" fill="none"/><path d="M126 46 Q124 28 138 22" stroke="#3f7d20" stroke-width="7" fill="none"/>`,
      beerhelmet: `<path d="M80 108 Q76 56 130 52 Q184 56 180 108Z" fill="${c1}"/><rect x="58" y="60" width="22" height="40" rx="5" fill="#c0c7d0"/><rect x="180" y="60" width="22" height="40" rx="5" fill="#c0c7d0"/><rect x="58" y="72" width="22" height="12" fill="#d50a0a"/><rect x="180" y="72" width="22" height="12" fill="#d50a0a"/><path d="M70 100 Q72 150 112 158 M190 100 Q188 150 148 158" stroke="#fff" stroke-width="4" fill="none"/>`,
      bearhood: `<path d="M70 132 Q60 46 130 40 Q200 46 190 132 Q186 96 130 92 Q74 96 70 132Z" fill="#c99700"/><circle cx="82" cy="52" r="18" fill="#c99700"/><circle cx="178" cy="52" r="18" fill="#c99700"/><circle cx="82" cy="52" r="9" fill="#ffe08a"/><circle cx="178" cy="52" r="9" fill="#ffe08a"/>`,
    })[c.hat];
    if (extraHat) return extraHat;
    const teamHat = ({
      cheesehead: `<path d="M70 104 L130 30 L190 104Z" fill="#ffcc33" stroke="#d9a300" stroke-width="4" stroke-linejoin="round"/>${[[112, 70, 8], [150, 82, 7], [128, 92, 6], [100, 94, 5], [160, 98, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e3a700"/>`).join("")}`,
      bearhat: `<path d="M78 110 Q74 56 130 52 Q186 56 182 110Z" fill="#6b4226"/><circle cx="88" cy="58" r="16" fill="#6b4226"/><circle cx="172" cy="58" r="16" fill="#6b4226"/><circle cx="88" cy="58" r="8" fill="#a8744c"/><circle cx="172" cy="58" r="8" fill="#a8744c"/>`,
      lionmane: plain,
      tricorn: `<path d="M64 98 Q130 40 196 98 Q170 84 130 92 Q90 84 64 98Z" fill="#1c2b4a" stroke="#c9a227" stroke-width="4"/><path d="M84 92 Q130 60 176 92" fill="#1c2b4a"/><circle cx="168" cy="82" r="6" fill="#d50a0a"/>`,
      buffalohorns: plain + `<path d="M84 80 Q50 74 44 44 Q64 66 90 64Z M176 80 Q210 74 216 44 Q196 66 170 64Z" fill="#efe6d2" stroke="#8b7d63" stroke-width="3"/><path d="M90 70 Q130 54 170 70 Q130 62 90 76Z" fill="#5a3a22"/>`,
      flighthelmet: `<path d="M76 116 Q72 54 130 50 Q188 54 184 116 L176 132 Q176 96 130 92 Q84 96 84 132Z" fill="#6b4f2a"/><path d="M90 84 H170" stroke="#4a3518" stroke-width="5"/><g transform="translate(0 -6)"><rect x="92" y="78" width="32" height="18" rx="8" fill="#9fd8f0" stroke="#3a2a1a" stroke-width="4"/><rect x="136" y="78" width="32" height="18" rx="8" fill="#9fd8f0" stroke="#3a2a1a" stroke-width="4"/></g>`,
      ravenhat: `<path d="M64 106 Q130 92 196 106 Q190 116 130 112 Q70 116 64 106Z" fill="#111"/><path d="M86 104 Q86 60 130 58 Q174 60 174 104Z" fill="#1d1d26"/><path d="M84 96 H176" stroke="#5b2a86" stroke-width="7"/><path d="M168 96 Q196 50 182 22 Q180 60 160 92Z" fill="#2b2b3a" stroke="#5b2a86" stroke-width="2"/>`,
      cowboystar: `<path d="M50 108 Q60 96 80 100 L84 64 Q130 42 176 64 L180 100 Q200 96 210 108 Q130 124 50 108Z" fill="#c8a06a" stroke="#8a6a3e" stroke-width="3"/><path d="M84 92 H176" stroke="#1e3a8a" stroke-width="7"/><path transform="translate(130 76) scale(.8)" d="M0 -14 L4 -4 L14 -4 L6 2 L9 12 L0 6 L-9 12 L-6 2 L-14 -4 L-4 -4Z" fill="#c9ced6" stroke="#1e3a8a" stroke-width="2"/>`,
      horsemane: `<path d="M120 100 Q100 40 130 24 Q166 34 150 100Z" fill="#f05a1a"/><path d="M134 30 Q170 50 160 96" fill="none" stroke="#c94410" stroke-width="5"/>`,
      dogears: plain + `<path d="M84 74 Q56 90 64 136 Q80 120 92 96Z M176 74 Q204 90 196 136 Q180 120 168 96Z" fill="#7a4a1c"/><ellipse cx="130" cy="134" rx="10" ry="7" fill="#2a1a10"/>`,
      pantherears: plain + `<path d="M88 76 L80 40 L112 62Z M172 76 L180 40 L148 62Z" fill="#111" stroke="#0085ca" stroke-width="3"/>`,
      piratehat: `<path d="M56 104 Q130 30 204 104 Q130 88 56 104Z" fill="#111"/><path d="M60 102 Q130 84 200 102" stroke="#d50a0a" stroke-width="5" fill="none"/><circle cx="130" cy="70" r="11" fill="#fff"/><path d="M122 84 L138 92 M138 84 L122 92" stroke="#fff" stroke-width="3"/>`,
      minerhat: `<path d="M56 108 Q130 92 204 108 Q190 118 130 114 Q70 118 56 108Z" fill="#8a6a3e"/><path d="M86 106 Q86 58 130 56 Q174 58 174 106Z" fill="#a8814d"/><path d="M86 94 H174" stroke="#6b4f2a" stroke-width="6"/><circle cx="160" cy="90" r="7" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>`,
      neonfeathers: plain + [[100, -30], [118, -12], [138, 6], [156, 22]].map(([x, r]) => `<path transform="rotate(${r} ${x} 70)" d="M${x} 74 Q${x - 10} 40 ${x} 18 Q${x + 10} 40 ${x} 74Z" fill="#69be28" stroke="#002244" stroke-width="2"/>`).join(""),
      ramhorns: plain + `<path d="M86 78 Q48 66 52 104 Q58 128 84 116 Q66 108 72 92 Q80 82 92 88Z M174 78 Q212 66 208 104 Q202 128 176 116 Q194 108 188 92 Q180 82 168 88Z" fill="#e8d6a0" stroke="#a68b4d" stroke-width="3"/>`,
      cardinalcrest: plain + `<path d="M110 66 Q118 18 140 26 Q128 40 150 34 Q136 54 150 60Z" fill="#c8102e"/>`,
      bullhorns: `<path d="M76 116 Q72 54 130 50 Q188 54 184 116 L176 132 Q176 96 130 92 Q84 96 84 132Z" fill="#03202f"/><path d="M80 82 Q40 70 30 36 Q56 62 86 64Z M180 82 Q220 70 230 36 Q204 62 174 64Z" fill="#f2ead6" stroke="#a7192e" stroke-width="3"/><path d="M124 52 H136 V96 H124Z" fill="#a7192e"/>`,
      greekhelmet: `<path d="M76 118 Q72 56 130 50 Q188 56 184 118 L176 134 L160 134 L160 112 L100 112 L100 134 L84 134Z" fill="#c9a227" stroke="#8a6a12" stroke-width="3"/><path d="M90 52 Q130 0 170 52" fill="#4b92db"/><path d="M128 112 V146" stroke="#8a6a12" stroke-width="6"/>`,
    })[c.hat];
    if (teamHat) return teamHat;
    if (c.hat === "firehelmet") return `<path d="M74 128 Q66 52 130 46 Q194 52 188 128 L180 140 Q176 100 130 96 Q84 100 80 140Z" fill="#2a2f3a" stroke="#111" stroke-width="4"/>` +
      `<path d="M84 70 Q92 30 104 54 Q110 14 128 44 Q138 6 152 42 Q164 18 168 56 Q182 36 180 76 Q130 56 84 70Z" fill="#ff6a00"/><path d="M98 66 Q108 40 118 58 Q128 30 140 56 Q152 38 160 64 Q130 54 98 66Z" fill="#ffd23f"/>` +
      `<g fill="none" stroke="#c9ced6" stroke-width="5" stroke-linecap="round"><path d="M92 132 Q130 150 168 132"/><path d="M96 148 Q130 166 164 148"/><path d="M110 128 V158 M150 128 V158"/></g>`;
    if (c.hat === "goldcrown") return hairTopPlain(c) + `<path d="M94 80 L90 48 L110 64 L130 42 L150 64 L170 48 L166 80Z" fill="#ffd23f" stroke="#a07a00" stroke-width="4" stroke-linejoin="round"/>`;
    if (c.hat === "toiletcrown") return hairTopPlain(c) + `<ellipse cx="130" cy="64" rx="46" ry="18" fill="none" stroke="#f4f4f4" stroke-width="12"/><ellipse cx="130" cy="64" rx="46" ry="18" fill="none" stroke="#c9ced6" stroke-width="2"/><path d="M110 50 Q130 20 150 50" fill="#f4f4f4" stroke="#c9ced6" stroke-width="3"/>`;
    if (c.hat === "nightcap") return hairTopPlain(c) + `<path d="M82 100 Q90 54 140 52 Q196 56 214 112 Q190 84 172 84 L178 100Z" fill="#3b5bdb"/><circle cx="214" cy="116" r="11" fill="#fff"/><rect x="80" y="94" width="100" height="14" rx="6" fill="#fff"/>`;
    if (c.hat === "detective") return `<path d="M64 106 Q130 92 196 106 Q190 116 130 112 Q70 116 64 106Z" fill="#7a5a3a"/><path d="M84 104 Q84 56 130 54 Q176 56 176 104Z" fill="#8d6b47"/><path d="M84 92 H176" stroke="#3a2a1a" stroke-width="8"/>`;
    if (c.hat === "scoutcap") return hairTopPlain(c) + `<path d="M80 108 Q76 54 130 52 Q184 54 180 108Z" fill="#2f5d3a"/><path d="M78 108 Q130 96 182 108 L198 118 Q130 100 70 116Z" fill="#1d3b25"/><text x="130" y="94" text-anchor="middle" font-family="Impact" font-size="20" fill="#ffd23f">SCOUT</text>`;
    if (c.hat === "hardhat") return `<path d="M76 108 Q74 50 130 46 Q186 50 184 108Z" fill="#ffc400" stroke="#c79400" stroke-width="4"/><path d="M66 108 H194 L190 118 H70Z" fill="#ffc400" stroke="#c79400" stroke-width="3"/><path d="M130 48 V100" stroke="#c79400" stroke-width="6"/>`;
    if (c.hat === "tophat") return hairTopPlain(c) + `<rect x="94" y="14" width="72" height="72" rx="4" fill="#111"/><rect x="94" y="64" width="72" height="12" fill="#d50a0a"/><path d="M72 86 H188 Q186 96 130 96 Q74 96 72 86Z" fill="#111"/>`;
    if (c.hat === "laurel") return hairTopPlain(c) + [...Array(7)].map((_, i) => { const a = Math.PI + (i + 0.5) * Math.PI / 7; const x = 130 + 52 * Math.cos(a), y = 90 + 32 * Math.sin(a); return `<ellipse cx="${x}" cy="${y}" rx="11" ry="5" fill="#4caf50" stroke="#2e7d32" stroke-width="1.5" transform="rotate(${a * 180 / Math.PI + 90} ${x} ${y})"/>`; }).join("");
    if (c.hat === "snapback") return hairTopPlain(c) + `<path d="M80 110 Q76 56 130 54 Q184 56 180 110Z" fill="${c1}"/><path d="M78 104 Q60 100 52 112 Q66 116 82 112Z" fill="${c2}"/><rect x="118" y="96" width="24" height="10" rx="3" fill="${c2}" opacity=".85"/>`;
    if (c.hat === "visor") return hairTopPlain(c) + `<path d="M80 98 Q130 86 180 98 L180 108 Q130 96 80 108Z" fill="${c1}"/><path d="M84 106 Q130 98 176 106 L200 122 Q130 104 60 122Z" fill="${c1}" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
    if (c.hat === "bandana") return `<path d="M80 110 Q76 58 130 54 Q184 58 180 110 Q130 96 80 110Z" fill="${c1}"/>${[96, 118, 142, 164].map((x) => `<circle cx="${x}" cy="80" r="4" fill="#fff" opacity=".7"/>`).join("")}<path d="M178 104 L204 96 L196 118 Z M178 106 L202 120 L188 128Z" fill="${c1}"/>`;
    if (c.hat === "headset") return hairTopPlain(c) + `<path d="M80 118 Q78 52 130 50 Q182 52 180 118" fill="none" stroke="#1f2430" stroke-width="9"/><rect x="70" y="106" width="20" height="34" rx="8" fill="#1f2430"/><rect x="170" y="106" width="20" height="34" rx="8" fill="#1f2430"/><path d="M82 134 Q90 160 112 160" fill="none" stroke="#1f2430" stroke-width="5"/><circle cx="114" cy="160" r="6" fill="#1f2430"/>`;
    if (c.hat === "qbhelmet" || c.hat === "qbvisor" || c.hat === "goldhelmet") {
      const gold = c.hat === "goldhelmet";
      const hc = gold ? "#e8b923" : (c.hatColor || c1), st2 = gold ? "#fff3b8" : (c.hatColor ? "#ffffff" : c2);
      return `<path d="M74 128 Q66 52 130 46 Q194 52 188 128 L180 140 Q176 100 130 96 Q84 100 80 140Z" fill="${hc}" stroke="rgba(0,0,0,.35)" stroke-width="4"/>` +
        `<path d="M124 48 Q130 46 136 48 L136 100 L124 100Z" fill="${st2}"/>` +
        (c.team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(c.team)}.png" x="156" y="86" width="28" height="28"/>` : "") +
        (c.hat === "qbvisor" ? `<path d="M88 104 Q130 96 172 104 L168 128 Q130 120 92 128Z" fill="rgba(10,14,22,.85)"/><path d="M98 106 L122 103" stroke="rgba(255,255,255,.5)" stroke-width="3"/>` : "") +
        `<g fill="none" stroke="${gold ? "#fff3b8" : "#c9ced6"}" stroke-width="5" stroke-linecap="round"><path d="M92 132 Q130 150 168 132"/><path d="M96 148 Q130 166 164 148"/><path d="M110 128 V158 M150 128 V158"/></g>`;
    }
    if (c.hat === "viking") return `<path d="M78 112 Q74 54 130 50 Q186 54 182 112Z" fill="#8a8f98" stroke="#4b5059" stroke-width="4"/><rect x="76" y="100" width="108" height="14" rx="5" fill="#6b4c2a"/>` +
      `<path d="M126 52 H134 V110 H126Z" fill="#6b4c2a"/>${[92, 112, 148, 168].map((x) => `<circle cx="${x}" cy="107" r="3" fill="#d6d9de"/>`).join("")}` +
      `<path d="M80 92 Q48 84 40 40 Q62 66 88 76Z" fill="#f2ead6" stroke="#b9ab86" stroke-width="3"/><path d="M180 92 Q212 84 220 40 Q198 66 172 76Z" fill="#f2ead6" stroke="#b9ab86" stroke-width="3"/>`;
    if (c.hat === "crown") return (hairTopPlain(c)) + `<path d="M90 82 L84 38 L108 62 L130 28 L152 62 L176 38 L170 82Z" fill="#ffd23f" stroke="#a07a00" stroke-width="4" stroke-linejoin="round"/><circle cx="130" cy="64" r="7" fill="#d50a0a"/><circle cx="104" cy="72" r="5" fill="#1e50c8"/><circle cx="156" cy="72" r="5" fill="#1e50c8"/>`;
    if (c.hat === "beanie") return `<path d="M78 112 Q74 50 130 46 Q186 50 182 112Z" fill="${c1}"/><rect x="76" y="98" width="108" height="18" rx="7" fill="${c2}"/><circle cx="130" cy="42" r="12" fill="${c2}"/>`;
    return hairTopPlain(c) + (c.hat === "band" ? `<rect x="82" y="94" width="96" height="12" rx="5" fill="${c2}"/>` : "");
  }
  function hairTopPlain(c) {
    const h = c.hairColor;
    const band = false ? `<rect x="82" y="94" width="96" height="12" rx="5" fill="${c2}"/>` : "";
    const tops = {
      short: `<path d="M82 112 Q78 62 130 60 Q182 62 178 112 Q168 84 130 82 Q92 84 82 112Z" fill="${h}"/>`,
      side: `<path d="M82 116 Q76 60 130 58 Q184 60 178 112 Q170 80 120 80 Q100 92 82 116Z" fill="${h}"/><path d="M116 62 Q110 74 112 82" stroke="rgba(0,0,0,.25)" stroke-width="3" fill="none"/>`,
      long: `<path d="M80 116 Q76 60 130 58 Q184 60 180 116 Q170 82 130 80 Q90 82 80 116Z" fill="${h}"/>`,
      curls: `<g fill="${h}">${[[96, 82], [116, 72], [140, 72], [162, 82]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join("")}</g>`,
      afro: `<path d="M84 104 Q90 70 130 68 Q170 70 176 104 Q158 84 130 84 Q102 84 84 104Z" fill="${h}"/>`,
      braids: `<path d="M82 108 Q80 62 130 60 Q180 62 178 108 Q166 82 130 80 Q94 82 82 108Z" fill="${h}"/>`,
      mohawk: `<path d="M116 92 Q112 40 130 30 Q148 40 144 92Z" fill="${h}"/>`,
      bun: `<path d="M82 110 Q80 64 130 62 Q180 64 178 110 Q166 84 130 82 Q94 84 82 110Z" fill="${h}"/>`,
      buzz: `<path d="M82 108 Q80 64 130 62 Q180 64 178 108 Q166 86 130 84 Q94 86 82 108Z" fill="${h}" opacity=".55"/>`,
      shaved: `<path d="M80 112 Q78 62 130 60 Q182 62 180 112 Q170 80 130 78 Q90 80 80 112Z" fill="${h}" opacity=".22"/>`,
      fade: `<path d="M86 100 Q84 58 130 56 Q176 58 174 100 Q160 80 130 78 Q100 80 86 100Z" fill="${h}"/><path d="M80 112 Q80 96 88 92 L88 112Z M180 112 Q180 96 172 92 L172 112Z" fill="${h}" opacity=".35"/>`,
      spiky: `<path d="M82 108 L88 70 L100 82 L106 54 L118 76 L128 46 L138 74 L152 52 L156 80 L170 62 L172 86 L180 108 Q166 86 130 84 Q94 86 82 108Z" fill="${h}"/>`,
      ponytail: `<path d="M82 112 Q78 62 130 60 Q182 62 178 112 Q168 84 130 82 Q92 84 82 112Z" fill="${h}"/>`,
      bald: `<path d="M100 72 Q118 66 130 68" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    };
    return (tops[c.hair] || tops.short);
  }
  function beardSVG(c) {
    const h = c.hairColor;
    switch (c.beard) {
      case "full": return `<path d="M86 132 Q90 182 130 186 Q170 182 174 132 Q162 162 130 162 Q98 162 86 132Z" fill="${h}"/>`;
      case "full_mustache": return `<path d="M86 132 Q90 182 130 186 Q170 182 174 132 Q162 162 130 162 Q98 162 86 132Z" fill="${h}"/><path d="M106 152 Q118 140 130 148 Q142 140 154 152 Q142 156 130 152 Q118 156 106 152Z" fill="${h}"/>`;
      case "chinstrap": return `<path d="M84 126 Q86 176 130 184 Q174 176 176 126 L170 128 Q166 170 130 174 Q94 170 90 128Z" fill="${h}"/>`;
      case "stubble": return `<path d="M88 134 Q94 176 130 180 Q166 176 172 134 Q160 160 130 160 Q100 160 88 134Z" fill="${h}" opacity=".35"/>`;
      case "goatee": return `<path d="M116 160 Q130 186 144 160 Q130 168 116 160Z" fill="${h}"/><path d="M114 150 Q130 144 146 150" stroke="${h}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      case "mustache": return `<path d="M108 150 Q120 140 130 148 Q140 140 152 150 Q140 154 130 151 Q120 154 108 150Z" fill="${h}"/>`;
      default: return "";
    }
  }
  function faceSVG(c, opts) {
    const o = opts || {};
    const brow = c.hairColor === "#e6e6e6" || c.hairColor === "#e8d08a" ? "#8a6d3a" : c.hairColor;
    const ears = `<ellipse cx="82" cy="124" rx="8" ry="15" fill="${c.skin}"/><ellipse cx="178" cy="124" rx="8" ry="15" fill="${c.skin}"/>`;
    const face = `<ellipse cx="130" cy="118" rx="48" ry="56" fill="${c.skin}"/><ellipse cx="104" cy="136" rx="9" ry="5" fill="#e88a7a" opacity=".25"/><ellipse cx="156" cy="136" rx="9" ry="5" fill="#e88a7a" opacity=".25"/>`;
    const eyes = o.sleep
      ? `<path d="M100 118 Q110 124 120 118 M140 118 Q150 124 160 118" stroke="#241a12" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : c.glasses === "heart"
        ? `<path d="M110 128 C94 116 92 104 102 102 C108 100 110 106 110 106 C110 106 112 100 118 102 C128 104 126 116 110 128Z M150 128 C134 116 132 104 142 102 C148 100 150 106 150 106 C150 106 152 100 158 102 C168 104 166 116 150 128Z" fill="#ff4fa3" stroke="#b5126b" stroke-width="2"/><path d="M122 110 H138" stroke="#b5126b" stroke-width="3"/>`
      : c.glasses === "pixel"
        ? `<g fill="#111"><rect x="88" y="106" width="84" height="8"/><rect x="94" y="114" width="28" height="10"/><rect x="138" y="114" width="28" height="10"/></g><g fill="#fff"><rect x="98" y="114" width="6" height="5"/><rect x="142" y="114" width="6" height="5"/></g>`
      : c.glasses === "goggles"
        ? `<rect x="88" y="104" width="84" height="26" rx="12" fill="rgba(180,230,255,.45)" stroke="#2b5fd9" stroke-width="4"/><path d="M84 116 H76 M176 116 H184" stroke="#2b5fd9" stroke-width="5"/>`
      : c.glasses === "shades_sport"
        ? `<defs><linearGradient id="spg" x1="0" x2="1"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#2b8cff"/></linearGradient></defs><path d="M84 110 Q130 98 176 110 L172 124 Q152 132 132 122 L128 122 Q108 132 88 124Z" fill="url(#spg)" stroke="${c.glassesColor || "#111"}" stroke-width="3"/><path d="M96 110 L118 108" stroke="rgba(255,255,255,.7)" stroke-width="3"/>`
      : c.glasses === "shades"
        ? `<rect x="94" y="106" width="34" height="20" rx="6" fill="#0a0a0a" stroke="${c.glassesColor || "#0a0a0a"}" stroke-width="3"/><rect x="132" y="106" width="34" height="20" rx="6" fill="#0a0a0a" stroke="${c.glassesColor || "#0a0a0a"}" stroke-width="3"/><rect x="126" y="112" width="8" height="5" fill="${c.glassesColor || "#0a0a0a"}"/><path d="M99 110 L112 110 M137 110 L150 110" stroke="rgba(255,255,255,.55)" stroke-width="3"/>`
        : `<g class="eyes"><ellipse cx="110" cy="116" rx="8" ry="6" fill="#fff"/><ellipse cx="150" cy="116" rx="8" ry="6" fill="#fff"/><circle cx="112" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="148" cy="117" r="3.8" fill="#3a2a1a"/><circle cx="113" cy="116" r="1.2" fill="#fff"/><circle cx="149" cy="116" r="1.2" fill="#fff"/></g>` +
          (c.glasses === "glasses" ? `<g fill="none" stroke="${c.glassesColor || "#1a1a1a"}" stroke-width="3.5"><circle cx="110" cy="116" r="14"/><circle cx="150" cy="116" r="14"/><path d="M124 116 L136 116 M96 114 L84 110 M164 114 L176 110"/></g>`
           : c.glasses === "glasses_square" ? `<g fill="rgba(180,220,255,.12)" stroke="${c.glassesColor || "#1a1a1a"}" stroke-width="4"><rect x="95" y="105" width="30" height="22" rx="4"/><rect x="135" y="105" width="30" height="22" rx="4"/><path d="M125 114 L135 114 M95 112 L84 108 M165 112 L176 108" fill="none"/></g>` : "");
    const brows = /^(shades|shades_sport|pixel|heart|goggles)$/.test(c.glasses || "") ? "" : `<path d="M98 101 Q110 95 122 101 M138 101 Q150 95 162 101" fill="none" stroke="${brow}" stroke-width="5" stroke-linecap="round"/>`;
    const nose = `<path d="M130 118 Q123 138 130 142 Q137 142 135 136" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linecap="round"/>`;
    const mouth = o.noMouth ? "" : o.kiss ? `<ellipse cx="130" cy="158" rx="7" ry="6" fill="#b5404a"/>` : o.open ? `<ellipse cx="130" cy="158" rx="14" ry="10" fill="#3a0f0f"/><ellipse cx="130" cy="164" rx="7" ry="3" fill="#d9707a"/>`
      : `<path d="M114 155 Q130 166 146 155" fill="none" stroke="#7a3a2a" stroke-width="5" stroke-linecap="round"/>`;
    const faceItem = ({
      eyepatch: `<path d="M84 100 L176 132" stroke="#111" stroke-width="4"/><ellipse cx="150" cy="117" rx="15" ry="12" fill="#111"/>`,
      tigerstripes: [[96, 106], [100, 126], [160, 106], [156, 126]].map(([x, y]) => `<path d="M${x} ${y} l${x < 130 ? 14 : -14} 4 l${x < 130 ? -14 : 14} 4" fill="none" stroke="#fb4f14" stroke-width="5" stroke-linecap="round"/>`).join("") + `<path d="M124 80 L130 90 L136 80" fill="none" stroke="#fb4f14" stroke-width="4"/>`,
      jaguarspots: [[98, 100], [108, 136], [158, 98], [152, 138], [130, 84]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#5a3b16" stroke-width="3"/><circle cx="${x}" cy="${y}" r="2" fill="#d7a22a"/>`).join(""),
      boltearring: `<path d="M178 128 L172 142 L180 142 L174 158" fill="none" stroke="#ffc20e" stroke-width="4" stroke-linejoin="round"/>`,
      icebeard: `<path d="M92 140 Q100 176 130 184 Q160 176 168 140 Q150 160 130 160 Q110 160 92 140Z" fill="#cdeffd" opacity=".9"/>${[100, 112, 124, 136, 148, 160].map((x, i) => `<path d="M${x - 5} ${166 + (i % 2) * 6} L${x} ${192 + (i % 3) * 8} L${x + 5} ${166 + (i % 2) * 6}Z" fill="#e6f8ff" stroke="#9fd8f0" stroke-width="1"/>`).join("")}`,
      monocle: `<circle cx="150" cy="116" r="12" fill="rgba(200,230,255,.25)" stroke="#c9a227" stroke-width="3"/><path d="M160 124 Q170 150 162 170" fill="none" stroke="#c9a227" stroke-width="2"/>`,
      thirdeye: `<ellipse cx="130" cy="88" rx="9" ry="6" fill="#fff" stroke="#7a3cff" stroke-width="2"/><circle cx="130" cy="88" r="3.5" fill="#7a3cff"/>`,
      clownnose: `<circle cx="130" cy="136" r="10" fill="#e11d2a"/><circle cx="127" cy="133" r="3" fill="#fff" opacity=".6"/>`,
      earcard: `<g transform="translate(176 92) rotate(18)"><rect width="22" height="30" rx="3" fill="#fff" stroke="#c9a227" stroke-width="2"/><text x="11" y="21" text-anchor="middle" font-family="Georgia" font-size="16" fill="#d50a0a">♥</text></g>`,
    }[c.face] || "");
    const eyeblack = c.face === "eyeblack" ? `<path d="M98 130 H120 M140 130 H162" stroke="#111" stroke-width="7" stroke-linecap="round"/>` : "";
    const mouthItem = o.noMouth ? "" : ({
      toothpick: `<path d="M146 156 L176 146" stroke="#d9b98a" stroke-width="3" stroke-linecap="round"/>`,
      gum: `<circle cx="132" cy="166" r="13" fill="#ff8fc7" stroke="#e05aa0" stroke-width="2"/><circle cx="127" cy="161" r="3" fill="#fff" opacity=".7"/>`,
      grillzGold: `<rect x="116" y="153" width="28" height="7" rx="2" fill="#ffd23f" stroke="#a07a00" stroke-width="1.5"/><path d="M123 153 V160 M130 153 V160 M137 153 V160" stroke="#a07a00" stroke-width="1"/>`,
      grillzSilver: `<rect x="116" y="153" width="28" height="7" rx="2" fill="#e6e9ee" stroke="#8a919c" stroke-width="1.5"/><path d="M123 153 V160 M130 153 V160 M137 153 V160" stroke="#8a919c" stroke-width="1"/>`,
      mouthguard: `<path d="M114 152 Q130 166 146 152 L146 158 Q130 170 114 158Z" fill="${c.hatColor || c.shirt || "#1e50c8"}"/>`,
    }[c.mouth] || "");
    return ears + face + beardSVG(c) + brows + eyes + eyeblack + nose + `<g class="av-mouth">${mouth}</g>` + mouthItem + faceItem;
  }

  // ------------------------------------------------------------ Ganze Figur (Brustbild bis Hüfte)
  // opts: { outfit: "casual"|"jersey"|"coach"|"suit", c1, c2, number, name, sleep, kiss, open, team }
  function svg(cfg, opts) {
    const c = { ...randomFor("x"), ...(cfg || {}) };
    const o = opts || {};
    const bw = BODY_W[c.body] || 1;
    const team = o.team || c.team || "";
    const c1 = o.c1 || c.shirt || "#2a2f3a", c2 = o.c2 || "#ffffff";
    const outfit = o.outfit || "casual";
    const skin = c.skin;
    const tx = (x) => 130 + (x - 130) * bw; // Oberkörper in die Breite ziehen
    const shade = "rgba(0,0,0,.18)";
    const logo = (x, y, w) => `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(team)}.png" x="${x}" y="${y}" width="${w}" height="${w}"/>`;
    const wide = outfit === "jersey" ? 14 : 0; // Trikot: breitere Schultern (Schulterpolster)
    // Oberteil: Schultern -> leicht taillierter Saum bei y=400
    const torso = `M${tx(58 - wide)} ${208} Q${tx(70 - wide)} 190 ${tx(102)} 186 L130 ${outfit === "suit" ? 240 : 200} L${tx(158)} 186 Q${tx(190 + wide)} 190 ${tx(202 + wide)} 208 L${tx(196)} 300 Q${tx(194)} 360 ${tx(190)} 402 L${tx(70)} 402 Q${tx(66)} 360 ${tx(64)} 300Z`;
    const belly = c.body === "round" ? `<path d="M${tx(66)} 300 Q${tx(52)} 372 ${tx(78)} 402 L${tx(182)} 402 Q${tx(208)} 372 ${tx(194)} 300Z" fill="${outfit === "suit" || outfit === "coach" ? c1 : c1}"/>` : "";
    // Hose + Gürtel (Brustbild endet knapp unter der Hüfte)
    const pants = `<path d="M${tx(70)} 398 L${tx(190)} 398 L${tx(194)} 440 L${tx(66)} 440Z" fill="${outfit === "suit" ? "#1a2130" : "#2b3a55"}"/><rect x="${tx(70)}" y="396" width="${tx(190) - tx(70)}" height="10" fill="#1a1a1a"/><rect x="122" y="395" width="16" height="12" rx="2" fill="#c9a227"/><path d="M130 408 V440" stroke="rgba(0,0,0,.3)" stroke-width="3"/>`;
    // Arme: kurze Ärmel + Unterarm/Hand (T-Shirt, Trikot) oder lange Ärmel (Jacke, Anzug)
    const topKind = outfit === "casual" ? (c.top || "tshirt") : null;
    const champ = c._champ || {}, champCol = TEAM_COL[champ.team] || ["#c99700", "#0b1328"];
    const longSleeve = outfit === "coach" || outfit === "suit" || /^(hoodie|trackjacket|hofjacket|armor|pyjama|trench|labcoat|suit|peacehoodie|bearcostume)$/.test(topKind || "");
    const sleeveCol = outfit === "suit" || topKind === "suit" ? "#1f2738" : topKind === "referee" ? "#111" : topKind === "champshirt" ? champCol[0] : ({ peacehoodie: "#7a3cff", retrojersey: "#8b2a1e", bearcostume: "#c99700" })[topKind] || ({ hofjacket: "#d4a017", glitter: "#b388ff", armor: "#a9b1bc", pyjama: "#9ec5ff", trench: "#b08d5b", labcoat: "#f4f6f8", altimashirt: "#0b1328" })[topKind] || c1;
    const arm = (side) => {
      if (o.armsUp) { // jubelnd: Arme nach oben, Hände über dem Kopf
        const sx = tx(side === "l" ? 58 - wide : 202 + wide), ux = side === "l" ? tx(30) : tx(230);
        const col = longSleeve ? sleeveCol : skin;
        return `<path d="M${sx} 214 L${side === "l" ? tx(40) : tx(220)} 150 L${ux} 78" stroke="${col}" stroke-width="${22 * Math.min(bw, 1.12)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
          (longSleeve ? "" : `<path d="M${sx} 214 L${side === "l" ? tx(46) : tx(214)} 176" stroke="${sleeveCol}" stroke-width="${30 * Math.min(bw, 1.12)}" stroke-linecap="round"/>`) +
          `<circle cx="${ux}" cy="70" r="13" fill="${skin}"/>`;
      }
      const s = side === "l" ? -1 : 1, X = (x) => 130 + s * (x - 130) * 1; // spiegeln
      const sx = tx(side === "l" ? 58 - wide : 202 + wide), sy = 210;
      const ex = side === "l" ? tx(46) : tx(214), ey = 300;     // Ellbogen
      const hx = side === "l" ? tx(52) : tx(208), hy = 386;     // Hand an der Hüfte
      if (longSleeve) return `<path d="M${sx} ${sy} Q${ex} ${ey - 30} ${ex} ${ey} L${hx} ${hy - 12}" stroke="${sleeveCol}" stroke-width="${30 * Math.min(bw, 1.15)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${hx}" cy="${hy}" r="13" fill="${skin}"/>`;
      const sl = side === "l" ? `M${sx + 6} ${sy - 6} L${tx(36 - wide)} 282 L${tx(64)} 290 L${tx(74)} 230Z` : `M${sx - 6} ${sy - 6} L${tx(224 + wide)} 282 L${tx(196)} 290 L${tx(186)} 230Z`;
      const fx = side === "l" ? tx(50) : tx(210);
      return `<path d="M${fx} 284 L${hx} ${hy - 10}" stroke="${skin}" stroke-width="${19 * Math.min(bw, 1.12)}" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="13" fill="${skin}"/><path d="${sl}" fill="${sleeveCol}"/>` +
        (outfit === "jersey" ? `<path d="${side === "l" ? `M${tx(40 - wide)} 268 L${tx(66)} 276` : `M${tx(220 + wide)} 268 L${tx(194)} 276`}" stroke="${c2}" stroke-width="6"/>` : "");
    };
    let top = "";
    if (outfit === "suit") top = `<path d="${torso}" fill="#1f2738"/>${belly}<path d="M108 190 L130 300 L152 190 L130 206Z" fill="#fff"/><path d="M124 204 L136 204 L133 296 L127 296Z" fill="${c1}"/><path d="M104 188 L124 262 L112 270Z M156 188 L136 262 L148 270Z" fill="#161c29"/>`;
    else if (outfit === "coach") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M130 204 L130 402" stroke="${c2}" stroke-width="5"/><path d="M104 188 Q130 214 156 188" fill="none" stroke="${c2}" stroke-width="7"/><text x="${tx(86)}" y="300" font-family="Impact,'Arial Black'" font-size="24" fill="${c2}">HC</text>` + (team ? logo(tx(146), 268, 44) : "");
    else if (outfit === "jersey") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M100 188 L130 214 L160 188" fill="none" stroke="${c2}" stroke-width="9"/><text x="130" y="360" text-anchor="middle" font-family="Impact,'Arial Black'" font-size="96" fill="${c2}" stroke="rgba(0,0,0,.5)" stroke-width="3" paint-order="stroke">${esc(o.number || "")}</text>`;
    else if (topKind === "jersey") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M100 188 L130 214 L160 188" fill="none" stroke="#fff" stroke-width="9"/><text x="130" y="360" text-anchor="middle" font-family="Impact,'Arial Black'" font-size="96" fill="#fff" stroke="rgba(0,0,0,.5)" stroke-width="3" paint-order="stroke">${esc(c.number || "")}</text>`;
    else if (topKind === "hoodie") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M96 192 Q130 232 164 192 Q160 176 130 176 Q100 176 96 192Z" fill="${c1}" stroke="${shade}" stroke-width="4"/><path d="M120 210 V250 M140 210 V250" stroke="#fff" stroke-width="3"/><path d="M${tx(92)} 330 H${tx(168)} L${tx(160)} 372 H${tx(100)}Z" fill="none" stroke="${shade}" stroke-width="4"/>` + (team ? logo(110, 262, 40) : "");
    else if (topKind === "polo") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M102 186 L122 214 L130 200 L138 214 L158 186 L130 196Z" fill="#fff" opacity=".9"/><path d="M130 200 V250" stroke="${shade}" stroke-width="3"/><circle cx="130" cy="222" r="3" fill="#fff"/><circle cx="130" cy="240" r="3" fill="#fff"/>` + (team ? logo(156, 232, 30) : "");
    else if (topKind === "trackjacket") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M130 200 V402" stroke="#d9dde3" stroke-width="5"/><path d="M104 186 L130 204 L156 186" fill="none" stroke="#fff" stroke-width="6"/><path d="M${tx(64)} 300 H${tx(92)} M${tx(168)} 300 H${tx(196)}" stroke="#fff" stroke-width="5"/>`;
    else if (topKind === "hawaii") top = `<path d="${torso}" fill="${c1}"/>${belly}${[[96, 250], [158, 236], [118, 300], [170, 320], [92, 360], [146, 372], [128, 260]].map(([x, y]) => `<g transform="translate(${tx(x)} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${Math.cos(a * Math.PI / 180) * 7}" cy="${Math.sin(a * Math.PI / 180) * 7}" rx="6" ry="4" fill="#fff" opacity=".85" transform="rotate(${a} ${Math.cos(a * Math.PI / 180) * 7} ${Math.sin(a * Math.PI / 180) * 7})"/>`).join("")}<circle r="3" fill="#ffd23f"/></g>`).join("")}<path d="M104 186 L130 230 L156 186" fill="${skin}" stroke="#fff" stroke-width="4"/>`;
    else if (topKind === "glitter") top = `<defs><linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".25" stop-color="#7afcff"/><stop offset=".5" stop-color="#fff59d"/><stop offset=".75" stop-color="#b388ff"/><stop offset="1" stop-color="#ff7ad9"/></linearGradient></defs><path d="${torso}" fill="url(#holo)"/>${belly}${[...Array(14)].map((_, i) => `<circle cx="${tx(80 + (i * 37) % 100)}" cy="${220 + (i * 53) % 170}" r="2.5" fill="#fff"/>`).join("")}<path d="M100 188 L130 214 L160 188" fill="none" stroke="#fff" stroke-width="8"/>`;
    else if (topKind === "peacehoodie") top = `<defs><radialGradient id="tie" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ff4fa3"/><stop offset=".3" stop-color="#ffd23f"/><stop offset=".55" stop-color="#3ddc84"/><stop offset=".8" stop-color="#3b82f6"/><stop offset="1" stop-color="#7a3cff"/></radialGradient></defs><path d="${torso}" fill="url(#tie)"/>${belly}<path d="M96 192 Q130 232 164 192 Q160 176 130 176 Q100 176 96 192Z" fill="#7a3cff" opacity=".6"/>`;
    else if (topKind === "retrojersey") top = `<path d="${torso}" fill="#8b2a1e"/>${belly}<path d="M${tx(66)} 260 H${tx(194)} M${tx(66)} 280 H${tx(194)}" stroke="#f2e6c8" stroke-width="8"/><text x="130" y="360" text-anchor="middle" font-family="Georgia,serif" font-size="56" fill="#f2e6c8">${esc(c.number || "33")}</text>`;
    else if (topKind === "champshirt") top = `<path d="${torso}" fill="${champCol[0]}"/>${belly}<text x="130" y="262" text-anchor="middle" font-family="Impact" font-size="22" fill="${champCol[1]}">ALTIMA BOWL</text><text x="130" y="296" text-anchor="middle" font-family="Impact" font-size="26" fill="#ffd23f">CHAMPIONS</text><text x="130" y="330" text-anchor="middle" font-family="Impact" font-size="30" fill="#fff">${esc(champ.year || "")}</text>`;
    else if (topKind === "apron") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M108 200 H152 L162 400 H98Z" fill="#f4f4f4" stroke="#cfd5dc" stroke-width="3"/><text x="130" y="300" text-anchor="middle" font-family="Impact" font-size="15" fill="#d50a0a">GRILL</text><text x="130" y="318" text-anchor="middle" font-family="Impact" font-size="15" fill="#d50a0a">MASTER</text>`;
    else if (topKind === "bearcostume") top = `<path d="${torso}" fill="#c99700"/>${belly}<ellipse cx="130" cy="320" rx="${50 * bw}" ry="64" fill="#ffe08a"/><rect x="${130 - 44 * bw}" y="232" width="${88 * bw}" height="30" rx="6" fill="#d50a0a"/><text x="130" y="254" text-anchor="middle" font-family="Impact" font-size="18" fill="#fff">ALTIMA</text>`;
    else if (topKind === "referee") top = `<clipPath id="refclip"><path d="${torso}"/></clipPath><path d="${torso}" fill="#fff"/>${belly.replace(`fill="${c1}"`, 'fill="#fff"')}<g clip-path="url(#refclip)">${[...Array(10)].map((_, i) => `<rect x="${tx(40) + i * 22 * bw}" y="180" width="${11 * bw}" height="230" fill="#111"/>`).join("")}</g><path d="M104 186 L130 204 L156 186" fill="none" stroke="#111" stroke-width="8"/>`;
    else if (topKind === "armor") top = `<path d="${torso}" fill="#a9b1bc"/>${belly}<path d="M${tx(80)} 230 Q130 270 ${tx(180)} 230 M${tx(76)} 300 Q130 330 ${tx(184)} 300" fill="none" stroke="#7a838f" stroke-width="5"/><path d="M130 205 V395" stroke="#7a838f" stroke-width="4"/><circle cx="130" cy="262" r="16" fill="#d50a0a" stroke="#ffd23f" stroke-width="3"/>`;
    else if (topKind === "pyjama") top = `<path d="${torso}" fill="#9ec5ff"/>${belly}${[...Array(10)].map((_, i) => `<path d="M${tx(78)} ${220 + i * 18} H${tx(182)}" stroke="#ffffff" stroke-width="4" opacity=".7"/>`).join("")}<path d="M104 186 L130 214 L156 186" fill="none" stroke="#3b5bdb" stroke-width="6"/>${[230, 270, 310].map((y) => `<circle cx="130" cy="${y}" r="3.5" fill="#3b5bdb"/>`).join("")}`;
    else if (topKind === "pressvest") top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M${tx(70)} 210 L${tx(108)} 190 L${tx(112)} 400 L${tx(70)} 400Z M${tx(190)} 210 L${tx(152)} 190 L${tx(148)} 400 L${tx(190)} 400Z" fill="#1e3a8a"/><rect x="${tx(74)}" y="250" width="${tx(108) - tx(74)}" height="16" fill="#fff"/><text x="${(tx(74) + tx(108)) / 2}" y="263" text-anchor="middle" font-family="Impact" font-size="13" fill="#1e3a8a">PRESS</text>`;
    else if (topKind === "trench") top = `<path d="${torso}" fill="#b08d5b"/>${belly}<path d="M104 186 L126 250 L130 400 M156 186 L134 250" fill="none" stroke="#8a6a3e" stroke-width="5"/><path d="M${tx(66)} 320 H${tx(194)}" stroke="#6b4f2a" stroke-width="10"/>${[260, 290, 350].map((y) => `<circle cx="${tx(116)}" cy="${y}" r="3.5" fill="#5a4022"/><circle cx="${tx(144)}" cy="${y}" r="3.5" fill="#5a4022"/>`).join("")}`;
    else if (topKind === "altimashirt") top = `<path d="${torso}" fill="#0b1328"/>${belly}<path d="M104 188 Q130 216 156 188" fill="none" stroke="#ffd23f" stroke-width="5"/><text x="130" y="276" text-anchor="middle" font-family="Impact" font-size="28" fill="#ffd23f">ALTIMA</text><text x="130" y="306" text-anchor="middle" font-family="Impact" font-size="28" fill="#d50a0a">BOWL</text>`;
    else if (topKind === "labcoat") top = `<path d="${torso}" fill="#f4f6f8"/>${belly}<path d="M104 186 L126 260 M156 186 L134 260" fill="none" stroke="#cfd5dc" stroke-width="5"/><rect x="${tx(150)}" y="250" width="22" height="18" fill="none" stroke="#cfd5dc" stroke-width="3"/><path d="M${tx(154)} 246 V262" stroke="#2b5fd9" stroke-width="3"/>`;
    else if (topKind === "suit") top = `<path d="${torso}" fill="#1f2738"/>${belly}<path d="M108 190 L130 300 L152 190 L130 206Z" fill="#fff"/><path d="M124 204 L136 204 L133 296 L127 296Z" fill="#d50a0a"/><path d="M104 188 L124 262 L112 270Z M156 188 L136 262 L148 270Z" fill="#161c29"/>`;
    else if (topKind === "hofjacket") top = `<path d="${torso}" fill="#d4a017"/>${belly}<path d="M108 190 L130 300 L152 190 L130 206Z" fill="#fff"/><path d="M104 188 L124 262 L112 270Z M156 188 L136 262 L148 270Z" fill="#b8860b"/><circle cx="${tx(162)}" cy="258" r="9" fill="#0b1328" stroke="#fff3b8" stroke-width="2"/>`;
    else top = `<path d="${torso}" fill="${c1}"/>${belly}<path d="M104 188 Q130 216 156 188" fill="none" stroke="${shade}" stroke-width="7"/><path d="M${tx(76)} 330 Q130 340 ${tx(184)} 330" stroke="${shade}" stroke-width="3" fill="none" opacity=".5"/>` + (team ? logo(106, 252, 48) : "");
    const neckItem = c.neck || (c.chain ? "chain" : "none");
    const badgeSvg = outfit === "suit" ? "" : c.badge === "ribbon"
      ? `<g transform="translate(${tx(170)} 250)"><path d="M0 -14 C-12 -14 -12 4 0 14 C12 4 12 -14 0 -14Z" fill="none" stroke="${c.ccColor || "#ff4fa3"}" stroke-width="6"/><path d="M-3 10 L-10 28 M3 10 L10 28" stroke="${c.ccColor || "#ff4fa3"}" stroke-width="6" stroke-linecap="round"/></g>`
      : c.badge === "star" ? `<path transform="translate(${tx(170)} 252) scale(.9)" d="M0 -16 L4.7 -5 L16 -5 L7 2 L10 14 L0 7 L-10 14 L-7 2 L-16 -5 L-4.7 -5Z" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>` : "";
    const whistle = neckItem === "whistle" && outfit !== "suit" ? `<path d="M104 196 Q130 250 156 196" fill="none" stroke="#d50a0a" stroke-width="4"/><rect x="118" y="244" width="26" height="14" rx="6" fill="#c9ced6" stroke="#6b7280" stroke-width="2"/><circle cx="140" cy="251" r="4" fill="#6b7280"/>` : "";
    const dfence = neckItem === "dfence" && outfit !== "suit" ? `<path d="M100 196 Q130 250 160 196" fill="none" stroke="#ffd23f" stroke-width="5"/><path d="M112 240 H148 V256 Q148 272 130 280 Q112 272 112 256Z" fill="#0b1328" stroke="#ffd23f" stroke-width="3"/><text x="122" y="262" font-family="Impact,'Arial Black'" font-size="16" fill="#ffd23f">D</text><path d="M133 250 V268 M139 250 V268 M131 255 H143 M131 263 H143" stroke="#ffd23f" stroke-width="2"/>` : "";
    const casualOnly = outfit !== "suit";
    const acc = c.accentColor || contrastOf(c1);
    const medal = neckItem === "medal" && casualOnly ? `<path d="M110 192 L126 246 M150 192 L134 246" stroke="#d50a0a" stroke-width="7"/><circle cx="130" cy="256" r="15" fill="#ffd23f" stroke="#a07a00" stroke-width="3"/><text x="130" y="262" text-anchor="middle" font-family="Impact" font-size="14" fill="#a07a00">1</text>` : "";
    const towel = neckItem === "towel" && casualOnly ? `<path d="M${tx(70)} 196 Q${tx(96)} 188 ${tx(104)} 196 L${tx(96)} 290 L${tx(74)} 290 Z" fill="#f4f4f4" stroke="#cfd5dc" stroke-width="3"/><path d="M${tx(78)} 276 H${tx(94)}" stroke="${c1}" stroke-width="4"/>` : "";
    const phones = neckItem === "headphones" && casualOnly ? `<path d="M100 200 Q130 226 160 200" fill="none" stroke="#1f2430" stroke-width="7"/><rect x="88" y="194" width="20" height="26" rx="8" fill="#1f2430"/><rect x="152" y="194" width="20" height="26" rx="8" fill="#1f2430"/>` : "";
    const patch = !casualOnly ? "" : c.badge === "captain" ? `<g transform="translate(${tx(170)} 252)"><rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fff" stroke="#d50a0a" stroke-width="2"/><text y="8" text-anchor="middle" font-family="Impact" font-size="22" fill="#d50a0a">C</text></g>`
      : c.badge === "est2027" ? `<g transform="translate(${tx(170)} 252)"><circle r="17" fill="#0b1328" stroke="#ffd23f" stroke-width="3"/><text y="-2" text-anchor="middle" font-family="Impact" font-size="9" fill="#ffd23f">EST.</text><text y="9" text-anchor="middle" font-family="Impact" font-size="10" fill="#ffd23f">2027</text></g>` : "";
    const capeCol = c.backColor || (contrastOf(c1) === "#ffd23f" ? "#0b1328" : "#b5121b");
    const cape = c.back === "cape" ? `<path d="M${tx(66)} 204 Q${tx(40)} 330 ${tx(28)} 440 L${tx(232)} 440 Q${tx(220)} 330 ${tx(194)} 204 Z" fill="${capeCol}"/><path d="M${tx(66)} 204 Q130 236 ${tx(194)} 204" fill="none" stroke="#ffd23f" stroke-width="6"/><text x="${tx(206)}" y="420" font-family="Impact" font-size="34" fill="#ffd23f" opacity=".85">A</text>` : "";
    const royal = c.back === "royalcape" ? `<path d="M${tx(66)} 204 Q${tx(36)} 330 ${tx(24)} 440 L${tx(236)} 440 Q${tx(224)} 330 ${tx(194)} 204 Z" fill="#9b111e"/><path d="M${tx(60)} 198 Q130 240 ${tx(200)} 198 L${tx(200)} 214 Q130 254 ${tx(60)} 214Z" fill="#fff"/>${[80, 100, 120, 140, 160, 180].map((x) => `<circle cx="${tx(x)}" cy="${212 + Math.abs(130 - x) * -0.15 + 10}" r="3" fill="#111"/>`).join("")}` : "";
    const bell = neckItem === "bell" && casualOnly ? `<path d="M104 196 Q130 232 156 196" fill="none" stroke="#d50a0a" stroke-width="5"/><path d="M120 226 Q120 212 130 212 Q140 212 140 226 L144 234 H116Z" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/><circle cx="130" cy="238" r="3.5" fill="#a07a00"/>` : "";
    const pin = !casualOnly ? "" : c.badge === "apppin" ? `<rect x="${tx(158)}" y="238" width="26" height="26" rx="7" fill="#0b1328" stroke="#ffd23f" stroke-width="2"/><text x="${tx(171)}" y="257" text-anchor="middle" font-family="Impact" font-size="13" fill="#ffd23f">AB</text>`
      : c.badge === "clover" ? `<g transform="translate(${tx(170)} 252)">${[0, 90, 180, 270].map((a) => `<circle cx="${Math.cos(a * Math.PI / 180) * 7}" cy="${Math.sin(a * Math.PI / 180) * 7}" r="7" fill="#22a447"/>`).join("")}<path d="M0 6 Q4 16 10 20" stroke="#167a33" stroke-width="3" fill="none"/></g>`
      : c.badge === "zero" ? `<g transform="translate(${tx(170)} 252)"><circle r="16" fill="#0b1328" stroke="#7ab8ff" stroke-width="3"/><text y="9" text-anchor="middle" font-family="Impact" font-size="24" fill="#7ab8ff">0</text></g>`
      : c.badge === "dart" ? `<g transform="translate(${tx(170)} 252) rotate(-30)"><path d="M-18 0 H10" stroke="#555" stroke-width="3"/><path d="M10 -4 L22 0 L10 4Z" fill="#d50a0a"/><path d="M-18 0 L-26 -7 M-18 0 L-26 7" stroke="#3ddc84" stroke-width="3"/></g>` : "";
    const belt = c.waist === "toolbelt" ? `<rect x="${tx(68)}" y="392" width="${tx(192) - tx(68)}" height="14" fill="#7a4a1c"/><rect x="${tx(74)}" y="402" width="20" height="26" rx="3" fill="#8d5a2b"/><path d="M${tx(170)} 400 V430 M${tx(162)} 400 H${tx(178)}" stroke="#9aa3ad" stroke-width="5"/>` : "";
    const above = c.above === "raincloud" ? `<g class="cloud" transform="translate(20 16) scale(.85)"><ellipse cx="130" cy="18" rx="46" ry="16" fill="#8a94a6"/><circle cx="108" cy="12" r="16" fill="#8a94a6"/><circle cx="136" cy="4" r="20" fill="#8a94a6"/>${[104, 122, 140, 158].map((x, i) => `<path d="M${x} 36 L${x - 4} 50" stroke="#7ab8ff" stroke-width="3" stroke-linecap="round"/>`).join("")}</g>` : "";
    const xNeck = !casualOnly ? "" : ({
      cctowel: `<path d="M${tx(150)} 196 Q${tx(186)} 186 ${tx(196)} 200 L${tx(200)} 290 L${tx(170)} 290Z" fill="#ff8fc7"/>`,
      peace: `<path d="M104 196 Q130 234 156 196" fill="none" stroke="#7a4a1c" stroke-width="3"/><circle cx="130" cy="244" r="13" fill="none" stroke="#c9ced6" stroke-width="4"/><path d="M130 231 V257 M130 244 L121 253 M130 244 L139 253" stroke="#c9ced6" stroke-width="3"/>`,
      lei: [...Array(14)].map((_, i) => { const a = Math.PI * (i / 13); const x = 130 - Math.cos(a) * 36, y = 196 + Math.sin(a) * 40; return `<circle cx="${x}" cy="${y}" r="8" fill="${["#ff4fa3", "#ffd23f", "#ff6a00", "#fff"][i % 4]}"/>`; }).join(""),
    })[neckItem] || "";
    const founderPin = casualOnly && c.badge === "founder" ? `<g transform="translate(${tx(170)} 252)"><path d="M0 -17 L15 -8 V8 L0 17 L-15 8 V-8Z" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/><text y="4" text-anchor="middle" font-family="Impact" font-size="8" fill="#0b1328">FOUNDER</text></g>` : "";
    const blanket = c.back === "blanket" ? `<path d="M${tx(60)} 200 Q${tx(30)} 330 ${tx(40)} 430 L${tx(220)} 430 Q${tx(230)} 330 ${tx(200)} 200Z" fill="#8fb3d9"/>${[0, 1, 2, 3].map((i) => `<path d="M${tx(46)} ${250 + i * 45} H${tx(214)}" stroke="#d6e4f2" stroke-width="10"/>`).join("")}` : "";
    const bird = c.shoulder === "bird" ? `<g transform="translate(${tx(196)} 190)"><ellipse rx="16" ry="12" fill="#3b82f6"/><circle cx="12" cy="-10" r="9" fill="#3b82f6"/><path d="M20 -10 L28 -8 L20 -6Z" fill="#ffd23f"/><circle cx="14" cy="-12" r="2" fill="#111"/><path d="M-10 -2 Q-4 -14 6 -4" fill="#2b5fd9"/></g>` : "";
    const tNeck = !casualOnly ? "" : ({
      horseshoe: `<path d="M104 196 Q130 232 156 196" fill="none" stroke="#c9ced6" stroke-width="3"/><path d="M118 230 Q118 256 130 256 Q142 256 142 230" fill="none" stroke="#9aa3ad" stroke-width="7"/>`,
      terribletowel: `<path d="M${tx(150)} 196 Q${tx(186)} 186 ${tx(196)} 200 L${tx(200)} 300 L${tx(170)} 300Z" fill="#ffb612"/><text x="${tx(184)}" y="262" text-anchor="middle" font-family="Impact" font-size="10" fill="#101820" transform="rotate(84 ${tx(184)} 262)">TERRIBLE</text>`,
      bbqbib: `<path d="M106 196 Q130 210 154 196 L150 320 Q130 334 110 320Z" fill="#fff" stroke="#e31837" stroke-width="3"/>${[0, 1, 2].map((i) => `<path d="M${116 + i * 6} ${246 + i * 14} q14 -6 28 0" stroke="#7a3a1a" stroke-width="7" fill="none" stroke-linecap="round"/>`).join("")}`,
      epaulettes: `<g fill="#ffb612" stroke="#5a1414" stroke-width="2"><rect x="${tx(54)}" y="196" width="40" height="14" rx="6"/><rect x="${tx(166)}" y="196" width="40" height="14" rx="6"/></g><g stroke="#ffb612" stroke-width="2">${[0, 1, 2, 3].map((i) => `<path d="M${tx(58) + i * 10} 210 V222 M${tx(170) + i * 10} 210 V222"/>`).join("")}</g>`,
    })[neckItem] || "";
    const rw = 92 * bw, ringArc = (top) => `<path d="M${130 - rw} 388 A${rw} 26 0 0 ${top ? 1 : 0} ${130 + rw} 388" fill="none" stroke="#008e97" stroke-width="24" stroke-linecap="round"/><path d="M${130 - rw} 388 A${rw} 26 0 0 ${top ? 1 : 0} ${130 + rw} 388" fill="none" stroke="#fc4c02" stroke-width="24" stroke-dasharray="28 34"/>`;
    const ringBack = c.waist === "swimring" ? ringArc(true) : "";
    const tWaist = c.waist === "swimring" ? ringArc(false) : "";
    const wings = c.back === "eaglewings" ? `<path d="M${tx(70)} 220 Q-10 180 10 320 Q40 270 ${tx(70)} 300Z M${tx(190)} 220 Q270 180 250 320 Q220 270 ${tx(190)} 300Z" fill="#004c54" stroke="#a5acaf" stroke-width="4"/>` : "";
    const fleur = c.above === "fleurhalo" ? `<g transform="translate(0 14)"><ellipse cx="130" cy="30" rx="44" ry="10" fill="none" stroke="#d3bc8d" stroke-width="6"/><path d="M130 6 Q120 18 126 28 M130 6 Q140 18 134 28 M130 6 V30" stroke="#d3bc8d" stroke-width="3" fill="none"/></g>` : "";
    const wearing = (st) => st.items.every(([slot, v]) => (slot === "neck" ? neckItem : c[slot]) === v);
    const setOn = Object.fromEntries(SETS.map((st) => [st.id, casualOnly && wearing(st)]));
    const grass = setOn.gameday ? `<g fill="#3f8f3a" opacity=".55"><ellipse cx="${tx(96)}" cy="360" rx="14" ry="7"/><ellipse cx="${tx(168)}" cy="320" rx="10" ry="5"/><ellipse cx="${tx(140)}" cy="388" rx="12" ry="5"/></g>` : "";
    const arrows = setOn.sideline ? `<g stroke="#ffd23f" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${tx(196)} 300 Q${tx(220)} 270 ${tx(236)} 286"/><path d="M${tx(232)} 280 L${tx(238)} 288 L${tx(228)} 290"/><circle cx="${tx(206)}" cy="268" r="5"/></g>` : "";
    const smoke = setOn.tailgate ? `<g fill="#d6d9de" opacity=".7"><circle cx="${tx(214)}" cy="320" r="8"/><circle cx="${tx(222)}" cy="300" r="10"/><circle cx="${tx(212)}" cy="280" r="12"/></g>` : "";
    const throne = setOn.royal ? `<path d="M40 440 V150 Q40 120 70 120 H190 Q220 120 220 150 V440Z" fill="#7a1020" stroke="#ffd23f" stroke-width="6"/><circle cx="130" cy="132" r="10" fill="#ffd23f"/>` : "";
    const redcard = setOn.referee ? `<rect x="${tx(150)}" y="236" width="14" height="20" rx="2" fill="#e11d2a" transform="rotate(-8 ${tx(157)} 246)"/>` : "";
    const divBanner = casualOnly && c.badge === "divbanner" ? `<g transform="translate(${tx(170)} 252)"><path d="M-14 -16 H14 V10 L0 18 L-14 10Z" fill="#0b1328" stroke="#ffd23f" stroke-width="2"/><text y="2" text-anchor="middle" font-family="Impact" font-size="9" fill="#ffd23f">DIV</text></g>` : "";
    const confcape = c.back === "confcape" ? `<path d="M${tx(66)} 204 Q${tx(40)} 330 ${tx(28)} 440 L${tx(232)} 440 Q${tx(220)} 330 ${tx(194)} 204 Z" fill="#013369"/><path d="M${tx(66)} 204 Q130 236 ${tx(194)} 204" fill="none" stroke="#d50a0a" stroke-width="6"/>` : "";
    const aura = c.aura === "aura" ? `<defs><radialGradient id="aura"><stop offset=".55" stop-color="#ffd23f" stop-opacity=".0"/><stop offset=".8" stop-color="#ffd23f" stop-opacity=".35"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient></defs><ellipse cx="130" cy="250" rx="150" ry="230" fill="url(#aura)"/>` : "";
    // Gegenstand in der rechten Hand
    const hx = tx(208), hy = 386;
    const handItem = !casualOnly ? "" : ({
      foamfinger: `<g transform="translate(${hx} ${hy - 16}) scale(1.45)"><rect x="-16" y="-10" width="32" height="34" rx="8" fill="${acc}"/><rect x="-6" y="-62" width="14" height="56" rx="7" fill="${acc}"/><text y="18" text-anchor="middle" font-family="Impact" font-size="14" fill="#fff">#1</text></g>`,
      controller: `<g transform="translate(${hx - 4} ${hy - 4})"><path d="M-26 -8 Q-30 14 -18 16 L-8 6 H8 L18 16 Q30 14 26 -8 Q20 -16 0 -14 Q-20 -16 -26 -8Z" fill="#2a2f3a" stroke="#111" stroke-width="2"/><circle cx="12" cy="-4" r="3" fill="#3ddc84"/><circle cx="-12" cy="-4" r="4" fill="#555"/></g>`,
      beer: `<g transform="translate(${hx} ${hy - 20})"><rect x="-11" y="-22" width="22" height="40" rx="4" fill="#c0c7d0" stroke="#7a8592" stroke-width="2"/><rect x="-11" y="-12" width="22" height="14" fill="#d50a0a"/></g>`,
      popcorn: `<g transform="translate(${hx} ${hy - 24})"><path d="M-16 -10 L16 -10 L11 26 L-11 26Z" fill="#fff" stroke="#d50a0a" stroke-width="2"/><path d="M-8 -10 L-6 26 M0 -10 V26 M8 -10 L6 26" stroke="#d50a0a" stroke-width="3"/>${[-12, -4, 4, 12, -8, 0, 8].map((x, i) => `<circle cx="${x}" cy="${i < 4 ? -14 : -21}" r="6" fill="#fff4c2" stroke="#e7c97a" stroke-width="1"/>`).join("")}</g>`,
      flag: `<g transform="translate(${hx} ${hy})"><path d="M0 0 V-110" stroke="#6b4c2a" stroke-width="4"/><path d="M0 -110 L56 -96 L0 -78Z" fill="${acc}"/>${team ? `<image href="https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${esc(team)}.png" x="8" y="-106" width="22" height="22"/>` : ""}</g>`,
      minitrophy: `<g transform="translate(${hx} ${hy - 30})"><path d="M-12 -24 H12 V-8 Q12 6 0 8 Q-12 6 -12 -8Z" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/><path d="M-12 -18 Q-22 -16 -18 -6 Q-14 0 -10 -2 M12 -18 Q22 -16 18 -6 Q14 0 10 -2" stroke="#ffd23f" stroke-width="3" fill="none"/><rect x="-4" y="8" width="8" height="10" fill="#ffd23f"/><rect x="-12" y="18" width="24" height="6" rx="2" fill="#a07a00"/></g>`,
      ccgloves: `<circle cx="${tx(52)}" cy="${hy}" r="15" fill="#ff8fc7"/><circle cx="${hx}" cy="${hy}" r="15" fill="#ff8fc7"/>`,
      turkeyleg: `<g transform="translate(${hx} ${hy - 22}) rotate(-30)"><ellipse cx="0" cy="-12" rx="14" ry="20" fill="#a0521d"/><rect x="-4" y="6" width="8" height="18" fill="#f2ead6"/><circle cx="-4" cy="26" r="5" fill="#f2ead6"/><circle cx="4" cy="26" r="5" fill="#f2ead6"/></g>`,
      remote: `<g transform="translate(${hx} ${hy - 18})"><rect x="-8" y="-24" width="16" height="44" rx="5" fill="#2a2f3a"/><circle cy="-14" r="4" fill="#d50a0a"/><rect x="-4" y="-4" width="8" height="3" fill="#888"/><rect x="-4" y="4" width="8" height="3" fill="#888"/></g>`,
      tongs: `<g transform="translate(${hx} ${hy - 10}) rotate(-20)"><path d="M-3 10 L-6 -50 M3 10 L6 -50" stroke="#9aa3ad" stroke-width="5" stroke-linecap="round"/><rect x="-6" y="4" width="12" height="20" rx="3" fill="#2a2f3a"/></g>`,
      clipboard: `<g transform="translate(${hx - 4} ${hy - 26})"><rect x="-20" y="-28" width="40" height="52" rx="4" fill="#a87a4a"/><rect x="-16" y="-20" width="32" height="40" fill="#fff"/><rect x="-8" y="-32" width="16" height="8" rx="2" fill="#9aa3ad"/><path d="M-10 -10 L4 -2 M-8 6 Q2 0 10 10" stroke="#d50a0a" stroke-width="2.5" fill="none"/><circle cx="-10" cy="-12" r="3" fill="none" stroke="#1e50c8" stroke-width="2"/></g>`,
      foamhand: `<g transform="translate(${hx} ${hy - 30})"><path d="M-24 30 V-6 Q-24 -14 -16 -14 V-40 Q-16 -48 -8 -48 Q0 -48 0 -40 V-46 Q0 -54 8 -54 Q16 -54 16 -46 V-36 Q24 -40 28 -32 V20 Q28 34 14 34 H-14Z" fill="#0b2265" stroke="#a71930" stroke-width="3"/><text y="10" text-anchor="middle" font-family="Impact" font-size="14" fill="#fff">NY</text></g>`,
      falconglove: `<g transform="translate(${hx} ${hy - 10})"><rect x="-14" y="-8" width="28" height="34" rx="6" fill="#7a4a1c"/><path d="M-6 -12 Q-2 -40 18 -42 Q30 -38 26 -26 Q18 -14 4 -12Z" fill="#111" stroke="#a71930" stroke-width="2"/><path d="M22 -36 L32 -34 L24 -30Z" fill="#ffb612"/></g>`,
      yellowflag: `<g transform="translate(${hx} ${hy - 10}) rotate(-20)"><path d="M-14 -16 Q0 -30 14 -16 Q22 0 10 10 Q0 18 -12 8 Q-24 -4 -14 -16Z" fill="#ffd400" stroke="#c9a400" stroke-width="2"/></g>`,
      fixedcontroller: `<g transform="translate(${hx - 4} ${hy - 4})"><path d="M-26 -8 Q-30 14 -18 16 L-8 6 H8 L18 16 Q30 14 26 -8 Q20 -16 0 -14 Q-20 -16 -26 -8Z" fill="#2a2f3a" stroke="#111" stroke-width="2"/><path d="M-4 -16 L2 16" stroke="#e6e6e6" stroke-width="2" stroke-dasharray="3 2"/><rect x="-14" y="-6" width="28" height="5" fill="#f2c94c" transform="rotate(-12)"/><rect x="-12" y="2" width="26" height="5" fill="#f2c94c" transform="rotate(10)"/></g>`,
      crystal: `<g transform="translate(${hx} ${hy - 26})"><circle r="20" fill="rgba(160,120,255,.55)" stroke="#d6c7ff" stroke-width="3"/><circle cx="-6" cy="-6" r="5" fill="#fff" opacity=".7"/><path d="M-14 18 H14 L10 28 H-10Z" fill="#a07a00"/></g>`,
      calcwatch: `<g transform="translate(${tx(52)} ${hy - 22})"><rect x="-12" y="-9" width="24" height="18" rx="3" fill="#2a2f3a" stroke="#111" stroke-width="2"/><rect x="-8" y="-6" width="16" height="6" fill="#9be7a8"/><path d="M-6 3 H-2 M2 3 H6" stroke="#ccc" stroke-width="2"/></g>`,
      phone: `<g transform="translate(${hx} ${hy - 22})"><rect x="-11" y="-20" width="22" height="38" rx="4" fill="#111" stroke="#555" stroke-width="2"/><rect x="-8" y="-16" width="16" height="28" fill="#3b82f6"/><path d="M14 -24 L22 -32 M18 -14 L28 -16 M10 -30 L12 -40" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/></g>`,
      mic: `<g transform="translate(${hx} ${hy - 20})"><rect x="-5" y="-6" width="10" height="34" rx="4" fill="#2a2f3a"/><circle cy="-14" r="12" fill="#9aa3ad" stroke="#555" stroke-width="2"/></g>`,
      binoculars: `<g transform="translate(${hx - 6} ${hy - 22})"><rect x="-18" y="-10" width="16" height="24" rx="5" fill="#2a2f3a"/><rect x="2" y="-10" width="16" height="24" rx="5" fill="#2a2f3a"/><rect x="-4" y="-4" width="8" height="8" fill="#444"/><circle cx="-10" cy="16" r="5" fill="#7ab8ff"/><circle cx="10" cy="16" r="5" fill="#7ab8ff"/></g>`,
      scepter: `<g transform="translate(${hx} ${hy})"><path d="M0 20 V-96" stroke="#ffd23f" stroke-width="7" stroke-linecap="round"/><circle cy="-104" r="12" fill="#d50a0a" stroke="#ffd23f" stroke-width="4"/><path d="M-10 -116 L0 -132 L10 -116" fill="#ffd23f"/></g>`,
    }[c.hand] || "");
    const gripped = /^(controller|fixedcontroller|beer|popcorn|flag|scepter|crystal|phone|mic|binoculars|yellowflag|turkeyleg|remote|tongs|clipboard|minitrophy)$/.test(c.hand || "");
    const gripHand = casualOnly && gripped && !o.armsUp ? `<circle cx="${hx}" cy="${hy}" r="13" fill="${c.hand === "ccgloves" ? "#ff8fc7" : skin}"/>` : "";
    // Ringe: einer pro tatsächlichem Titel (automatisch)
    const nRings = Math.min(5, Number(c._rings || o.rings || 0));
    const rings = nRings ? [...Array(nRings)].map((_, i) => { const side = i % 2 ? -1 : 1, cx = side > 0 ? tx(208) : tx(52); return `<rect x="${cx - 9}" y="${380 + Math.floor(i / 2) * 6}" width="18" height="5" rx="2.5" fill="#ffd23f" stroke="#a07a00" stroke-width="1.5"/><circle cx="${cx}" cy="${382 + Math.floor(i / 2) * 6}" r="2.6" fill="#7afcff"/>` + (nRings >= 2 ? `<path d="M${cx + 10} ${372 + Math.floor(i / 2) * 6} l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2z" fill="#fff"><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="${i * 0.3}s" repeatCount="indefinite"/></path>` : ""); }).join("") : "";
    const chain = neckItem === "chain" && outfit !== "suit" ? `<path d="M102 196 Q130 248 158 196" fill="none" stroke="#ffd23f" stroke-width="5"/><rect x="120" y="234" width="20" height="20" rx="4" fill="#ffd23f" stroke="#a07a00" stroke-width="2"/>` : "";
    const neck = `<rect x="110" y="158" width="40" height="40" rx="10" fill="${skin}" style="filter:brightness(.88)"/>`;
    const h = Math.max(0.88, Math.min(1.12, Number(c.height) || 1));
    // Nur ein einzelnes Teil zeigen (Vorschaubilder im Editor), passend zugeschnitten
    if (o.only) {
      const parts = {
        neck: [tNeck + xNeck + towel + chain + whistle + dfence + medal + phones + bell, "70 180 120 110"],
        badge: [badgeSvg + patch + pin + founderPin + divBanner, `${tx(170) - 26} 226 52 52`],
        hand: [handItem, `${tx(208) - 50} 290 100 130`],
        above: [above + fleur, "60 -6 140 80"],
        back: [cape + confcape + royal + wings + blanket, "0 180 260 260"],
        waist: [ringBack + tWaist + belt, "20 350 220 90"],
        shoulder: [bird, `${tx(196) - 34} 156 68 60`],
        aura: [aura, "0 0 260 440"],
        top: [arm("l") + arm("r") + neck + top, "10 170 240 250"],
      }[o.only];
      if (parts) return `<svg viewBox="${parts[1]}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${parts[0] || `<text x="50%" y="55%" text-anchor="middle" font-size="40" fill="#8892a6">–</text>`}</svg>`;
    }
    // Rückansicht (Profil-Vorschau „drehen“): Rücken-Teile vorne, Gesicht/Front-Teile weg, Rückennummer
    if (o.view === "back") {
      const num = (topKind === "jersey" || topKind === "retrojersey") ? `<text x="130" y="350" text-anchor="middle" font-family="Impact,'Arial Black'" font-size="110" fill="#fff" stroke="rgba(0,0,0,.5)" stroke-width="3" paint-order="stroke">${esc(c.number || "")}</text>` : "";
      const backOf = `<path d="${torso}" fill="${sleeveCol}"/>${num}`;
      const capeFront = (cape + confcape + royal + wings + blanket).replace(/<text[^>]*>[^<]*<\/text>/g, "");
      const headBack = `<g class="head">${hairBack(c)}<circle cx="130" cy="118" r="54" fill="${skin}"/>${c.hair === "bald" || c.hair === "shaved" ? "" : `<path d="M76 118 Q76 58 130 56 Q184 58 184 118 Q184 160 130 166 Q76 160 76 118Z" fill="${c.hairColor}"/>`}${hairTop(c, c1, c2)}</g>`;
      return `<svg viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet"><g transform="translate(0 ${440 * (1 - h)}) scale(1 ${h})">` +
        aura + pants + arm("l") + arm("r") + neck + backOf + tWaist + belt + capeFront + headBack + `</g></svg>`;
    }
    return `<svg viewBox="0 0 260 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet"${c.outline ? ' style="filter:drop-shadow(0 0 3px #ffd23f) drop-shadow(0 0 8px rgba(255,210,63,.7))"' : ""}><g transform="translate(0 ${440 * (1 - h)}) scale(1 ${h})">` +
      throne + aura + above + fleur + cape + confcape + royal + wings + blanket + ringBack + pants + arm("l") + arm("r") + neck + top + tWaist + belt + tNeck + xNeck + founderPin + bird + badgeSvg + patch + pin + towel + chain + whistle + dfence + medal + phones + bell + grass + redcard + divBanner + (o.armsUp ? "" : handItem) + gripHand + rings + arrows + smoke + `<g class="head">${hairBack(c)}${faceSVG(c, o)}${hairTop(c, c1, c2)}</g></g></svg>`;
  }

  // Nur der Kopf (für die Auswahl-Kacheln im Editor)
  function headSVG(cfg) {
    const c = { ...randomFor("x"), ...(cfg || {}) };
    return `<svg viewBox="62 20 136 176" xmlns="http://www.w3.org/2000/svg"><rect x="62" y="20" width="136" height="176" fill="none"/><rect x="110" y="158" width="40" height="40" rx="10" fill="${c.skin}" style="filter:brightness(.88)"/>${hairBack(c)}${faceSVG(c, {})}${hairTop(c, c.shirt || "#2a2f3a", "#ffffff")}</svg>`;
  }

  global.MB = global.MB || {};
  global.MB.Avatar = { OPTIONS, BODY_W, UNLOCKS, TEAM_ITEMS, SETS, setStatus, lockInfo, championsOf: (n) => champions.get(String(n || '').toLowerCase()) || [], teamWinsOf: (n) => teamWins.get(String(n || '').toLowerCase()) || {}, isUniqueLeader: (n) => uniqueLeader === String(n || '').toLowerCase(), load, get, hasOwn, save, randomFor, toVariant, svg, headSVG, faceSVG, hairBack, hairTop };
})(window);
