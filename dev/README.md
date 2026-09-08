# Madden Bowl — Umbau-Doku (v2: CSS-Trennung + Supabase)

## Was hier liegt

```
shared.js            ← gemeinsamer Kern: Supabase-Sync, Zeit, Quoten, Ranking, Wettbüro, History, Team-Ratings
announcer.js          ← KI-Ansage-Texte + Vorlesen (Web Speech API / ElevenLabs)
music.js              ← Meilenstein-Songs via ElevenLabs Music API
records.js            ← Rekord-Erkennung + Meme-Generator (Canvas/Imgflip) + WhatsApp-Teilen
blog.js               ← Turnierblog-Artikel-Engine
tipp.js               ← NEU: Tippspiel-Engine (ersetzt das Kapital-Wettbüro)
styles.css            ← zentrales Theme/CSS (vorher inline in index.html)
index.html            ← Turnier-Admin/Anzeige
wettbuero.html         ← Login + Wetten pro Spieler
live.html              ← Turnierblog (Hub-Kacheln, Current/Next, Artikel-Feed, Vollansicht) + PWA-installierbar
shop.html               ← NEU: Fan-Shop (Spreadshop-Einbindung)
hall_of_fame.html       ← Hall of Fame — liest aus Supabase
seasons.html            ← Saisons auflisten/bearbeiten/löschen + Team-Werte pflegen
migrate.html            ← einmalig: importiert alte JSON-Saisons nach Supabase
manifest.json           ← NEU: PWA-Manifest für live.html
apple-touch-icon.png, icon-192.png, icon-512.png ← NEU: App-Icons (aus maddenbowl.ico hochskaliert)
supabase-schema.sql      ← SQL zum einmaligen Anlegen der Tabellen
supabase-schema-update.sql ← SQL für die Team-Ratings-Tabelle (zusätzlich ausführen)
supabase-schema-update-2.sql ← SQL für Song-Momente (Spalte + Storage-Bucket, zusätzlich ausführen)
supabase-schema-update-3.sql ← SQL für geräteübergreifende Rekord-Momente (zusätzlich ausführen)
supabase-schema-update-4.sql ← SQL für Blog-Artikel + Meme-Storage (zusätzlich ausführen)
supabase-schema-update-5.sql ← SQL für das Tippspiel (zusätzlich ausführen)
supabase-schema-update-6.sql ← NEU: SQL für den Rückblick-Artikel-Typ (zusätzlich ausführen)
maddenbowl_2022–2026.json ← NUR NOCH BACKUP, kein Laufzeit-Datenpfad mehr
maddenbowl.ico
```

Alle Dateien zusammen auf den Webspace (GitHub Pages o.ä.) — wie vorher.

## ⚠️ Einmaliges Setup, bevor irgendwas läuft

1. **Supabase-Schema anlegen**: alle `supabase-schema*.sql`-Dateien der
   Reihe nach in den Supabase SQL-Editor (Projekt → SQL Editor → New query)
   einfügen und ausführen: `supabase-schema.sql` →
   `supabase-schema-update.sql` → `supabase-schema-update-2.sql` →
   `supabase-schema-update-3.sql` → `supabase-schema-update-4.sql` →
   `supabase-schema-update-5.sql` → `supabase-schema-update-6.sql`.
2. **Alte Saisons importieren**: `migrate.html` einmal im Browser öffnen
   (im selben Ordner wie die `maddenbowl_20XX.json`-Dateien) und "Migration
   starten" klicken. Danach kurz im Supabase Table Editor gegenchecken, ob
   `tournaments`/`players`/`group_matches` gefüllt sind.
3. **Team-Werte pflegen** (optional, aber empfehlenswert): `seasons.html?Altima`
   öffnen → oberer Kasten "Team-Werte (OVR)" → Jahr wählen → Werte eintragen
   oder "Von Vorjahr kopieren" → Speichern. Ohne Pflege gilt für jedes Team
   automatisch der neutrale Standardwert 85.
4. Danach ganz normal `index.html?Altima` benutzen wie bisher.

## Neu: Full Reset fragt jetzt nach

"Full Reset" öffnet ein kleines Auswahlfenster statt direkt zu löschen:
- **📦 Archivieren & neu starten** — wie bisher: aktuelles Turnier wird als
  `completed` gespeichert (inkl. errechnetem Endstand), bleibt für Hall of
  Fame & History erhalten.
- **🗑️ Verwerfen & neu starten** — löscht das aktuelle Turnier komplett
  (auch aus Supabase, inkl. aller Spiele/Spieler/Wettbüro-Daten). Fragt
  zusätzlich noch mal explizit nach, weil das unwiderruflich ist.
- **Abbrechen** — nichts passiert.

## Neu: Saison-Verwaltung (`seasons.html?Altima`)

Admin-only (gleicher `?Altima`-Schutz wie `index.html`). Zwei Bereiche:

**Team-Werte (OVR)**: Jahr wählen, alle 32 Teams mit editierbarem
OVR-Wert (Standard 85 = neutral), "Von Vorjahr kopieren" als Abkürzung,
Speichern schreibt in die `team_ratings`-Tabelle. Wirkt sich auf die
Elo-/Quoten-Berechnung aus (`MB.teamOVRFactor`), für alle Seiten, die
Quoten anzeigen (index.html, wettbuero.html, live.html).

**Saisons verwalten**: Liste aller Turniere (laufend + abgeschlossen) mit
Jahr/Status. Pro Zeile:
- **Bearbeiten** — klappt einen Editor auf: Jahr, Status
  (setup/running/completed), Spielernamen & -teams, alle Gruppen- und
  Playoff-Spielstände, sowie der Endstand-Tabelle (Platz/Name/Punkte —
  Zeilen hinzufügen/entfernen möglich). "Speichern" schreibt direkt in die
  jeweiligen Supabase-Tabellen.
- **Löschen** — löscht das komplette Turnier unwiderruflich (Spieler/Spiele/
  Wettbüro-Daten fallen per Cascade mit weg). Fragt vorher nach.

Gedacht für Korrekturen (Tippfehler im Namen, falsch eingetragener Spielstand,
falsches Jahr) und zum Aufräumen alter Test-Turniere.

## Architektur: zwei Dedupe-Runden

**Runde 1** (Logik): Odds-Berechnung, Ranking, Flavour Facts, Zeit-Berechnung
lagen früher komplett dupliziert in `index.html`. Jetzt liegt der ganze
fachliche Kern in `shared.js` (`window.MB.*`) und wird von allen Seiten
gemeinsam genutzt.

**Runde 2** (auf Nachfrage — es gab tatsächlich noch was zu finden):
- **CSS**: `index.html`s komplettes `<style>` (480 Zeilen) ist jetzt
  `styles.css`. `wettbuero.html`, `live.html` und `hall_of_fame.html`
  verlinken dieselbe Datei für die Basis-Palette (`--nfl-red`, `--bg`,
  `--card`, `--accent`, …) statt sie jeweils neu zu definieren.
- **"Nächste Spiele" gab es tatsächlich 4×**: einmal in `index.html`
  (Next-Games-Box), einmal in meinem eigenen Announcer-Hook, einmal in
  `wettbuero.html`, einmal in `live.html` — jede mit einer leicht
  abweichenden Kopie derselben Zeit-Berechnung. Jetzt gibt es dafür genau
  **eine** Funktion: `MB.getUpcomingMatches(state, {excludePlayerName, limit})`.
  Alle vier Stellen rufen die jetzt auf.
- **`groupEndTime`-Formel** war 3× in `index.html` dupliziert (Playoff
  Picture, Admin-Playoff-Liste, Next-Games) — jetzt einmal über
  `MB.computePlayoffTimes(state).groupEndTime`.
- Eine versteckte **lokale Schatten-Kopie von `isByeMatch`** in der
  Admin-Playoff-Liste flog raus (hätte bei künftigen Änderungen an der
  echten Funktion leise falsche Ergebnisse liefern können).
- `hall_of_fame.html` hatte eine **fünfte, komplett eigenständige** Kopie
  der History-Lade-Logik (eigene `fetchJson`/`HOF_SOURCES`-Konstanten,
  unabhängig von `shared.js`). Die ist jetzt auch weg — `normalizeSeason()`
  dort ist zum Glück shape-tolerant genug, um `MB.loadHistorySeasons()`
  direkt zu verstehen, daher war der Umbau minimal-invasiv.

**Bewusst NICHT dedupliziert**: die Zeit-Vorschau im Setup-Formular
(`updateModeInfo`) rechnet weiterhin selbstständig, weil sie läuft, *bevor*
ein Turnier (und damit `state.matches`/`state.slots`) überhaupt existiert —
das ist kein Duplikat, sondern zwangsläufig ein eigenständiger Schätzwert.

`index.html` ist dadurch von ursprünglich ~3200 auf **~1900 Zeilen**
geschrumpft (reines Rendering/Markup, keine Logik-Dopplung mehr).

## Supabase-Migration (npoint.io ist komplett raus)

### Warum
npoint.io war ein anonymer Free-Service ohne Garantien, ohne Zugriffsschutz
(jeder mit der Bin-ID konnte alles überschreiben — auch Wettbüro-PINs und
Kontostände) und ohne Echtzeit-Fähigkeiten.

### Schema (normalisiert, sieben Tabellen)
- `tournaments` — ein Row pro Turnier/Saison. `status`: `setup` / `running`
  / `completed`. `config` (JSONB) trägt Startzeit, Dauern, Stadionnamen etc.
  `final_standings` (JSONB) wird beim Archivieren gefüllt.
- `players`, `group_matches`, `playoff_matches` — referenzieren
  `tournament_id`. Spieler werden über einen stabilen `idx` referenziert
  (entspricht `state.players[idx]` / `match.p1`/`match.p2` in der App).
- `wettbuero_accounts`, `wettbuero_bets`, `wettbuero_settled_rounds` —
  eins-zu-eins das, was vorher in `state.wettbuero` steckte.

### Wie die App das nutzt
`MB.fetchCloudState()`/`MB.pushCloudState(state)` in `shared.js` sind die
**einzige** Stelle, die mit Supabase spricht — sie übersetzen zwischen den
normalisierten Tabellen und genau derselben `state`-Objektform wie vorher.
**Deshalb mussten `index.html`, `wettbuero.html` und `live.html` für die
Migration selbst nicht angefasst werden** — sie rufen weiterhin einfach
`MB.fetchCloudState()`/`MB.pushCloudState(state)` auf.

### "Alles in Supabase" — auch die Historie
Wie besprochen: **alle** Turniere (laufend + alte Saisons) leben jetzt in
denselben Tabellen, unterschieden nur durch `status`. Die JSON-Dateien
(`maddenbowl_2022–2026.json`) bleiben als **Backup** liegen, sind aber kein
Laufzeit-Datenpfad mehr — `MB.loadHistorySeasons()` fragt Supabase ab
(`status = 'completed'`).

`resetTournament()` ("Full Reset") **löscht nichts mehr**, sondern
archiviert das laufende Turnier (`status = 'completed'`, inkl. errechnetem
Endstand) und startet danach ein neues — die alte Saison bleibt für Hall of
Fame & History erhalten, ganz automatisch.

### Sicherheit — bitte lesen
Die RLS-Policies in `supabase-schema.sql` sind bewusst **genauso offen** wie
der alte npoint.io-Zustand: jeder mit dem (im Frontend sichtbaren) anon-Key
darf alles lesen/schreiben. Das ist für eure Freundesrunde praktisch, aber
**kein echter Zugriffsschutz** — z. B. könnte technisch jeder fremde
Kontostände im Wettbüro verändern. Skizze für später, falls gewünscht:
Schreibzugriffe auf `players`/`group_matches`/`playoff_matches` nur noch
über eine Supabase Edge Function mit Service-Role-Key laufen lassen, die
vorher prüft, ob der Request vom Admin-Gerät kommt.

### Was NICHT gemacht wurde (bewusst, Aufwand/Nutzen)
- **Kein Realtime/WebSocket-Push** — `wettbuero.html`/`live.html` pollen
  weiterhin (alle 15–20 Sekunden), jetzt aber gegen Supabase statt npoint.
  Supabase Realtime ist in der DB per `alter publication supabase_realtime
  add table ...` schon vorbereitet (siehe SQL-Datei) — der Umstieg auf
  echte Push-Updates wäre ein separater, überschaubarer nächster Schritt,
  falls gewünscht.
- **Kein echtes Auth-System** — die PIN-Logik im Wettbüro ist unverändert
  (liegt jetzt in `wettbuero_accounts.pin`, weiterhin Klartext).

## Die 4 ursprünglichen Bugfixes (unverändert gültig)

1. **Refresh-Bug** — Cache-Busting jetzt auf Supabase-Ebene irrelevant
   geworden (Supabase liefert keine gecachten REST-Antworten wie npoint es
   gelegentlich tat), Grundproblem damit strukturell behoben.
2. **Bye-Zeiten** — `MB.computePlayoffOffsets()` überspringt Slots, in
   denen beide Partien Byes sind.
3. **Contender Round: erst Lower, dann Upper** — in `MB.PLAYOFF_STRUCTURE`.
4. **Abschlusstabelle** — Turniersieger +100 Punkte; Toilet-Bowl-Sieger
   übernimmt die Punkte des vorletzten Platzes und belegt selbst den
   letzten Platz.

## Features (Tippspiel, Live-Tracking, KI-Ansage)

- **Tippspiel** (`wettbuero.html`, Name der Datei aus Kompatibilitätsgründen
  beibehalten, Seite heißt jetzt "Tippspiel"): siehe eigener Abschnitt unten
  — komplett neu, **kein virtuelles Kapital mehr**.
- **Live-Tracking**: nächste Spiele mit Quote + Flavour Facts,
  Titelchancen-Balken, Tabelle, Auto-Refresh.
- **KI-Ansage**: läuft automatisch beim Score-Eintrag im Admin-Modus.
  Zwei Engines zur Wahl (Admin-Panel → "🎙️ Ansage-Engine"):
  - **Browser (kostenlos, Standard)**: Web Speech API, bevorzugt die
    "Online (Natural)"-Neural-Stimmen von Edge/Chrome unter Windows 11.
  - **ElevenLabs (kostenpflichtig, optional)**: siehe eigener Abschnitt
    unten.

  Zahlen-vor-Punkt-Bug ("17." → "siebzehnter") ist in beiden Fällen behoben.

## Neu: Tippspiel statt Kapital-Wettbüro (`wettbuero.html`, `tipp.js`)

Das alte Wettbüro (virtuelles Kapital, freier Einsatz, Auszahlungsquoten)
ist komplett ersetzt durch ein klassisches Tippspiel — Grund: bei freiem
Einsatz gewinnt am Ende meist, wer am geschicktesten (oder rücksichtslos)
all-in geht, nicht wer am besten tippt; und Geld-Nachschub verzerrt die
Fairness gegen Ende. Das neue Modell:

### Gesamt-Tipps
Offen von Turnierstart bis **jeder** Spieler mindestens ein Spiel hatte
(nicht nur irgendeiner — erst wenn alle mindestens einmal gespielt haben,
schließt das Fenster). Getippt wird: Turniersieger (5 Punkte),
Zweiter Platz (3 Punkte), Toilet-Bowl-Sieger (3 Punkte) — plus ein
**Tiebreaker** (geschätzte Gesamtpunktzahl im Finale), der selbst keine
Punkte bringt, aber bei Punktegleichstand in der Endabrechnung entscheidet
(näher dran gewinnt).

### Spieltag-Tipps
Da es keine klassischen Spieltage gibt, werden alle Spiele (Gruppe +
Playoff, chronologisch durchgezählt) automatisch in **4er-Blöcke**
("Spieltage") eingeteilt (`MB.Tipp.getSpieltage`, Blockgröße in `tipp.js`
über `SPIELTAG_SIZE` änderbar). Getippt wird auf **jedes** Spiel (auch die
eigenen — hier geht's ums Vorhersagen, nicht ums Gegeneinander-Wetten),
1 Punkt pro richtigem Sieger-Tipp.

**Sperre pro Spiel, nicht pro Spieltag**: jedes einzelne Spiel sperrt
automatisch **5 Minuten nach seinem geplant­en Anpfiff** (aus dem
bestehenden Zeitplan berechnet — `MB.getGroupMatchTime`/
`MB.computePlayoffTimes`), unabhängig davon, wann der Admin das Ergebnis
tatsächlich einträgt. Der genaue Sperrzeitpunkt wird direkt neben jedem
Spiel angezeigt ("sperrt um 20:05 Uhr (5 Min. nach Anpfiff 20:00 Uhr)"),
man kann sich also vorher darauf einstellen. Andere Spiele desselben
Spieltags bleiben tippbar, auch wenn eins davon schon gesperrt oder fertig
ist. Puffer editierbar über `LOCK_BUFFER_MINUTES` in `tipp.js`.

Zusätzlich pro Spieltag ein **Over/Under**-Tipp auf die Gesamtpunktzahl
aller Spiele des Spieltags zusammen (2 Punkte) — die Linie wird beim
ersten Öffnen des Spieltags automatisch aus dem bisherigen
Punkte-Durchschnitt berechnet und dann eingefroren (bleibt fair, ändert
sich nicht mehr nachträglich). Der Over/Under-Tipp sperrt 5 Minuten nach
dem **frühesten** Anpfiff im Spieltag (sobald ein Spiel des Blocks läuft,
wäre Nachjustieren nicht mehr fair).

**Hinweis zur Durchsetzung**: die Sperre ist eine UI-Regel (clientseitig
geprüft), kein serverseitiger Zwang — passend zum Rest der App, die auf
Ehrlichkeit unter Freunden setzt statt auf technische Manipulationssicherheit.

### Tippstand
Läuft komplett ohne Kapital-Buchhaltung — die Punktzahl wird bei jedem
Aufruf frisch aus allen abgegebenen Tipps + den tatsächlichen Ergebnissen
berechnet (`MB.Tipp.computeTippStandings`), keine Abrechnungs-/
Settlement-Schritt nötig. Erscheint in `wettbuero.html` **und** im
Turnierblog (`live.html` → "📊 Volle Turnieransicht").

### Setup
`supabase-schema-update-5.sql` einmal zusätzlich ausführen (Tabellen
`tipp_picks` + `tipp_ou_lines`). Die alten Tabellen `wettbuero_bets` und
`wettbuero_settled_rounds` werden nicht mehr beschrieben/gelesen — können
in Supabase gelöscht werden, müssen aber nicht (sind einfach nur noch
leer). `wettbuero_accounts` bleibt aktiv, wird aber jetzt nur noch für den
PIN-Login gebraucht (die `balance`-Spalte wird ignoriert).

## Neu: ElevenLabs-Anbindung (optionale, kostenpflichtige Stimmen)

### Warum ElevenLabs und welches Modell
Web Speech API ist kostenlos, aber qualitativ Glückssache (abhängig vom
Gerät/Browser). ElevenLabs liefert deutlich natürlicher klingende Stimmen,
kostet aber pro erzeugtem Zeichen. Empfehlung für unseren Anwendungsfall
(kurze Ansagen, ausgelöst nach Score-Eintrag, keine Echtzeit-Konversation):

- **`eleven_multilingual_v2`** (Standard-Auswahl im Panel) — beste
  Sprachqualität/Emotionalität für Deutsch, etwas höhere Latenz, aber das
  spielt hier keine Rolle, da niemand in Echtzeit mit der Stimme spricht.
- **`eleven_flash_v2_5`** — schneller & günstiger, minimal weniger
  ausdrucksstark. Alternative, falls dir die Kosten wichtiger sind als die
  letzten paar Prozent Natürlichkeit.
- **`eleven_v3`** — experimentell, am ausdrucksstärksten, aber (Stand
  jetzt) weniger stabil/vorhersehbar und für den produktiven Einsatz eher
  noch nicht empfohlen.

Alle drei stehen im Modell-Dropdown zur Auswahl, `eleven_multilingual_v2`
ist voreingestellt.

### Zwei Stimmen mit Übergabe
Wenn du **beide** Stimmen setzt (Ergebnis-Stimme + Vorschau-Stimme), läuft
automatisch ein kleines Duo-Format: Stimme A macht die Ergebnis-Ansage und
übergibt mit einer zufälligen Übergabe-Phrase ("Und damit übergebe ich an
dich für die Vorschau!"), Stimme B übernimmt mit einer Antwort-Phrase
("Danke dir! Hier ist, was als Nächstes ansteht:") und macht die
Vorschau. Ist nur eine der beiden Stimmen gesetzt, liest diese eine
einfach alles vor (kein Duo-Moment).

Die **Texte selbst** kommen weiterhin aus dem bestehenden
Template-System (siehe `announcer.js`: zufällige Phrasen-Pools,
datenbasierte Flavour Facts, Quoten) — nicht aus einer zusätzlichen
KI-Textgenerierung. Das hält die Lösung ohne einen weiteren API-Key/Kosten
und liefert bereits spürbar variierte, natürlich klingende Übergänge. Falls
dir das noch nicht "KI-generiert" genug ist: eine echte Textgenerierung
(z.B. über die Anthropic- oder OpenAI-API) wäre ein separater, überschaubarer
nächster Schritt — sag Bescheid, falls gewünscht.

### Einrichtung
1. Admin-Panel (`index.html?Altima`) → "🎙️ Ansage-Engine" → "🔒 Entsperren
   zum Bearbeiten". Erstes Mal: neues Passwort festlegen (nur für dieses
   Gerät/diesen Browser).
2. Engine auf "ElevenLabs" umstellen, API-Key eingeben, Modell wählen.
3. "Stimmen laden" klicken (lädt deine verfügbaren ElevenLabs-Stimmen),
   je eine für Ergebnis- und Vorschau-Ansage auswählen.
4. "Testen" klicken, dann "Speichern".

### Wichtig: Sicherheit & Geltungsbereich
- Die Einstellungen (inkl. API-Key) liegen **nur in localStorage dieses
  Geräts/Browsers**, **nicht** in Supabase. Grund: die aktuellen
  RLS-Policies sind offen für jeden mit dem (im Frontend sichtbaren)
  anon-Key — ein bezahlter ElevenLabs-Key sollte dort nicht landen, sonst
  könnte theoretisch jeder auf eure Kosten Audio erzeugen.
- Das bedeutet aber auch: **pro Admin-Gerät einmal einrichten**. Nutzt ihr
  `index.html?Altima` von mehreren Geräten aus, braucht jedes Gerät seine
  eigene Konfiguration.
- Das Passwort ist ein einfacher, clientseitiger Schutz (SHA-256-Hash in
  localStorage) gegen "jemand tippt kurz am Admin-Gerät herum" — **kein**
  Schutz gegen jemanden mit Zugriff auf die Browser-Devtools/localStorage
  auf demselben Gerät. Passwort vergessen → "Passwort zurücksetzen" im
  Panel (löscht dabei auch den gespeicherten API-Key, muss neu eingegeben
  werden).
- Schlägt ein ElevenLabs-Aufruf fehl (z.B. Kontingent aufgebraucht,
  Netzwerkfehler), fällt die Ansage automatisch auf die kostenlose
  Browser-Stimme zurück — es bleibt nie stumm.

## Neu: Song-Momente (`music.js`, ElevenLabs Music API)

An vier Meilensteinen kann manuell ein englischsprachiger Hip-Hop/Rap-Song
über die echten Turnier-Fakten generiert werden:
**Regular Season beendet** (Top-Seed, dominantester Sieg der Saison),
**Erstes Ausscheiden** (wer, gegen wen, mit welchem Ergebnis),
**Finals stehen fest** (beide Finalisten + ein Flavour Fact zum Duell),
**Turniersieger steht fest** (Champion, Endspielergebnis, Gegner).

### Bewusst KEIN Auto-Trigger
Musik kostet bei ElevenLabs ca. **900 Credits pro Minute** — deutlich mehr
als Sprache. Ein automatischer Trigger bei jedem Score-Eintrag hätte bei
Korrekturen/Nachbesserungen schnell unnötig Credits verbrannt. Stattdessen:
im Admin-Panel unter "🎵 Song-Momente" erscheint pro erreichtem Meilenstein
ein Stil-Dropdown + "Song generieren"-Button — inklusive Sicherheitsabfrage
mit Kosten-Hinweis, bevor tatsächlich generiert wird.

### Variation durch Stil-Rotation
Damit nicht jeder Song gleich klingt, wählt `music.js` aus einem Pool
aktuell gängiger Rap-Spielarten (Trap, Drill, Boom Bap/Old-School,
Conscious/Lyrical, Cloud Rap/Melodic, Rage Rap, DMV-Style, PluggnB) — per
Dropdown gezielt wählbar oder "🎲 Zufälliger Stil". Die Stil-Vorgabe an die
API ist bewusst locker gehalten (ein beschreibender Tag, keine starren
Produktionsvorgaben), damit das Modell selbst kreativ entscheiden kann.

### Wie die Texte entstehen
Kein separater Songtext nötig — `music.js` baut aus den echten
Turnier-Fakten einen Beschreibungs-Prompt (z.B. "Tim, playing as the Chiefs,
won the championship against Alex 42-10..."), das ElevenLabs-Modell schreibt
sich Lyrics, Hook und Struktur selbst dazu. Sprache ist fest auf Englisch
gesetzt (wie gewünscht), Text also nicht die deutschen
Aussprache-Unsicherheiten der Sprachausgabe.

### Einrichtung
1. `supabase-schema-update-2.sql` ausgeführt haben (Spalte `tournaments.songs`
   + Storage-Bucket `mb-songs`).
2. ElevenLabs unter "🎙️ Ansage-Engine" wie oben beschrieben eingerichtet
   haben (**derselbe** API-Key wird für Musik mitgenutzt, keine zweite
   Schlüsselverwaltung).
3. Sobald ein Meilenstein erreicht ist, erscheint er im "🎵 Song-Momente"-
   Panel — Stil wählen (oder zufällig), generieren, fertig. Der Song landet
   dauerhaft in Supabase Storage und ist über einen eingebetteten
   Audio-Player direkt abspielbar (auch nach einem Reload).

### Bekannte Einschränkung
Deutsche Gesangsqualität ist bei ElevenLabs Music kein Problem, weil wir
bewusst auf **Englisch** generieren — dafür tauchen deutsche Spielernamen
ggf. mit leicht englisch gefärbter Aussprache im Gesang auf. Das lässt sich
vorab nicht zuverlässig vorhersagen; einfach ausprobieren.

## Neu: Rekord-Momente & Memes (`records.js`) — kostenlos, geräteübergreifend, WhatsApp-teilbar

Nach jedem Score-Eintrag prüft `records.js` automatisch auf neun
Rekord-/Meme-Arten und erzeugt bei einem Treffer sofort ein teilbares
Meme:

- **Allzeit-Highscore** — höchste je in einem einzelnen Spiel erzielte Punktzahl.
- **Allzeit-Klatsche** — größte Punktdifferenz aller Zeiten.
- **Klatsche des Turniers** — größte Differenz *dieser* Saison (ab 20 Punkten), falls kein Allzeit-Rekord.
- **Siegesserie** — neue Turnier-Bestserie (ab 3 Siegen in Folge).
- **Überraschung** — Sieger stand laut aktueller Tabelle/Seed deutlich schlechter da (≥3 Plätze) als der Verlierer.
- **Abgeschossen** — Verlierer kam auf höchstens 3 Punkte.
- **Shootout** — neue Höchstmarke bei der Gesamtpunktzahl eines Spiels (ab 70 Punkten zusammen).
- **Finaleinzug** — beide Finalisten stehen fest.
- **Neuer Champion** — Turniersieger steht fest.

### Zwei Meme-Anbieter zur Wahl
- **🎨 Eigene Grafik** (Standard, komplett kostenlos, kein Account) —
  eigene Farbverlauf-Grafiken mit großem Emoji + fettem Text, per
  `<canvas>` gerendert. **Kein** Nachbau bekannter Meme-Fotos (Drake,
  Distracted Boyfriend etc. sind urheberrechtlich geschützt) — das ist
  eine bewusste Design-Entscheidung.
- **🖼️ Imgflip** (kostenlos, aber Account nötig) — nutzt die
  [imgflip.com/api](https://imgflip.com/api), die `/caption_image`
  kostenlos anbietet (nur `automeme`/KI-Vorlagenwahl ist bei imgflip
  Premium-only — das haben wir uns gespart und bilden es stattdessen
  selbst nach: feste, thematisch passende Vorlagen-Pools pro Rekord-Typ,
  z.B. "Surprised Pikachu" für neue Highscores, "This Is Fine" für
  Klatschen, "Who Would Win?" fürs Finale). Braucht einen kostenlosen
  Account auf imgflip.com/signup (am besten einen separaten, nicht den
  privaten) — Zugangsdaten liegen pro Gerät in localStorage.

### Copyright-Hinweis
Die "🎨 Eigene Grafik"-Option baut bewusst **keine** bekannten
Meme-Vorlagen nach — das wäre eine Urheberrechtsverletzung. Die
"🖼️ Imgflip"-Option nutzt dagegen ganz regulär den offiziellen,
kostenlosen imgflip-API-Dienst, der genau dafür gebaut ist, seine
lizenzierten Vorlagen dynamisch zu bebildern — wir laden/hosten dabei
selbst keine geschützten Bilder, sondern lassen imgflip das serverseitig
erledigen und bekommen nur eine URL zurück.

### WhatsApp-Versand: bewusst KEIN Auto-Broadcast
Ein vollautomatischer Versand in eine WhatsApp-Gruppe ist technisch nicht
sauber machbar: Metas offizielle WhatsApp Business API erlaubt außerhalb
eines 24h-Antwortfensters nur vorab genehmigte Nachrichten-Templates, und
inoffizielle Automatisierungs-Tools verstoßen gegen WhatsApps
Nutzungsbedingungen (Risiko: Konto-Sperre). Stattdessen nutzt der
"📱 Teilen"-Button die **Web Share API**: öffnet auf dem Handy das normale
System-Share-Sheet mit dem Bild, wo WhatsApp als Ziel auftaucht — ein Tap,
fertig. Ohne Web-Share-Unterstützung (meist Desktop) gibt's automatisch
einen Download-/Öffnen-Fallback.

### Geräteübergreifend: auch am Handy nutzbar (`live.html?Altima`)
Da du Ergebnisse nur am Laptop einträgst, wäre "Teilen" dort unpraktisch
(kein direkter WhatsApp-Zugriff). Deshalb werden Rekord-Momente jetzt
zusätzlich in Supabase gespeichert (`record_moments`-Tabelle) und
erscheinen **auch** auf `live.html?Altima` — dort mit eigenem
🎨/🖼️-Umschalter und eigenen Imgflip-Zugangsdaten (getrennt vom Laptop,
da anderes Gerät = anderes localStorage). Auf dem Handy: `live.html?Altima`
öffnen, Meme antippen, "📱 Teilen" → direkt ans System-Share-Sheet →
WhatsApp. Ein "✕" blendet einen Moment aus (überall, auch am Laptop, da
zentral in Supabase markiert).

### Setup
`supabase-schema-update-3.sql` einmal zusätzlich ausführen (Tabelle
`record_moments`). Imgflip ist komplett optional — ohne eingerichteten
Account bleibt einfach "🎨 Eigene Grafik" aktiv, alles andere funktioniert
unverändert.

## Neu: Turnierblog & PWA (`live.html` ohne `?Altima`)

`live.html` ist jetzt ein echter Turnierblog mit modernerem, "App-artigem"
Aufbau statt einer reinen Live-Tracking-Tabelle:

- **Hub-Kacheln oben** (immer sofort sichtbar, auch bevor Daten geladen
  sind): 📋 Spielplan (öffnet die Vollansicht in einem neuen Tab, siehe
  unten), 🎯 Tippspiel (Link zu `wettbuero.html`), 🛍️ Fan-Shop (Link zu
  `shop.html`), 📜 Rückblick (springt zum Artikel-Feed).
- **"Läuft gerade" / "Als Nächstes"**-Boxen: unterscheidet automatisch
  anhand des Zeitplans, ob ein Spiel schon angepfiffen sein müsste (aber
  noch kein Ergebnis eingetragen ist) oder erst noch bevorsteht — kein
  Admin-Eingriff nötig, rein zeitbasiert wie beim Tippspiel-Sperrmechanismus.
- **Skeleton-Loading**: die Seite zeigt Hub + Platzhalter-Boxen sofort an,
  noch während die echten Daten im Hintergrund laden — kein nacktes
  "Lade Turnierdaten…" mehr.
- **"📊 Volle Turnieransicht"**-Umschalter: klappt Tabelle, kompletten
  Gruppenspielplan, Playoff Picture (als Liste, nicht als grafischer
  Bracket — siehe Einschränkung unten), Tippstand und Titelchancen auf.
  Alles rein lesend, keine Admin-Funktionen. Direkt aufrufbar über
  `live.html?view=full` (das macht die 📋-Hub-Kachel, ideal zum Öffnen in
  einem zweiten Tab/Fenster).
- **Artikel-Feed** darunter: automatisch generierte Blog-Artikel
  (`blog.js`, jetzt mit mehreren Formulierungs-Varianten und etwas Witz,
  siehe eigener Abschnitt) zu Turnierstart, alle 3 Spiele ein Zwischenstand,
  Finale, neuer Champion — sowie **geteilte** Songs (mit eingebettetem
  Audio-Player) und Memes (mit eingebettetem Bild). "Geteilt" ist hier
  bewusst der Freigabe-Moment: ein Song erscheint im Blog erst, wenn er im
  Admin-Panel generiert wurde; ein Meme-Artikel entsteht erst, wenn der
  Admin tatsächlich "Teilen" klickt (nicht schon bei jeder Erkennung) —
  sonst würde der Blog mit jedem kleinen Rekord vollgespammt.

### Fan-Shop (`shop.html`, Spreadshop-Einbindung)
Eigene, separate Seite (nicht direkt in `live.html` eingebettet), damit das
recht schwere Spreadshop-Drittanbieter-Skript nicht die Ladezeit des Blogs
selbst belastet. Nutzt genau die Einbindung, die Spreadshop für den Shop
"maddenbowl" vorgibt (`spread_shop_config` + `shopclient.nocache.js`).

**Bitte einmal gegenchecken**: der Skript-Pfad enthielt in der Vorlage ein
Copy-Paste-Artefakt (ein Markdown-Link, der zwei unterschiedliche
Shop-Domains vermischt hat — `maddenbowl.myspreadshop.de` und
`tima-merch.myspreadshop.de`). Ich hab mich für `maddenbowl.myspreadshop.de`
entschieden (konsistent mit `shopName`/`prefix`/dem sichtbaren Link), kann
das von hier aus aber nicht gegen euren echten Spreadshop-Account
verifizieren — falls der Shop auf `shop.html` leer bleibt, liegt's
vermutlich genau daran; dann bitte den echten Skript-Pfad aus eurem
Spreadshop-Adminbereich (Einbindungscode) einmal gegenprüfen und in
`shop.html` (das `<script src="...">`) korrigieren.

### Einschränkung: Playoff Picture als Liste, nicht als Grafik
Die hübsche, mehrspaltige Bracket-Grafik aus `index.html` ist eng mit dem
Admin-Rendering verwoben. Für `live.html` gibt's stattdessen eine klar
lesbare Listendarstellung (Session → Paarungen → Ergebnis/Uhrzeit) — same
Daten, weniger visuelles Bracket-Feeling. Sag Bescheid, falls dir das zu
nüchtern ist, dann bauen wir die Grafik-Variante auch für die Public-Seite.

### PWA: als App-Icon auf dem Homescreen
`manifest.json` + Apple-Meta-Tags machen `live.html` "installierbar":
Safari (iOS) → Teilen-Symbol → "Zum Home-Bildschirm" → landet als eigene
Kachel, startet ohne Browser-Leiste. **Kein Push bei geschlossener
App** (das bräuchte einen Server-Baustein, siehe unten) — aber solange die
Seite offen ist, aktualisiert sie sich weiterhin automatisch alle 15
Sekunden (Boxen, Artikel, Rekord-Momente).

### Zu Push-Benachrichtigungen (bewusst zurückgestellt)
Echte Push-Zustellung bei geschlossener Seite bräuchte einen
Server-Baustein (VAPID-Schlüssel + eine Supabase Edge Function, die bei
neuen Ergebnissen/Artikeln aktiv die Push-Zustellung auslöst) — das haben
wir bewusst zurückgestellt zugunsten der einfacheren, serverlosen Lösung
oben. Lässt sich bei Bedarf später nachrüsten, ohne den jetzigen Aufbau
umzuwerfen.

### Setup
`supabase-schema-update-4.sql` einmal zusätzlich ausführen (Tabelle
`blog_articles` + Storage-Bucket `mb-memes` für geteilte Canvas-Memes;
Imgflip-Memes werden direkt verlinkt, die liegen schon dauerhaft bei
imgflip.com).

### Redaktionelle Artikel & Rückblick
`seasons.html?Altima` → Karte "✍️ Artikel verfassen": freier Editor mit
zwei fertigen, faktengeprüften Entwürfen (5-Jahre-Rückblick + Kickoff-
Ankündigung 2027) — Titel/Text frei editierbar, "Im Blog veröffentlichen"
braucht ein aktives Turnier (der Artikel hängt an dessen `tournament_id`).
Für alles Weitere (neue Rückblicke, Sonderartikel) einfach "Leer" wählen
und selbst schreiben, oder mir hier im Chat einen Text generieren lassen
und reinkopieren.

## Kurzer Test-Vorschlag

1. `supabase-schema.sql` ausführen, `migrate.html` einmal laufen lassen.
2. Turnier mit 8 Spielern starten (`index.html?Altima`), ein paar
   Gruppenspiele eintragen — dabei im Supabase Table Editor beobachten, ob
   `players`/`group_matches` sich live füllen.
3. In den Playoffs bewusst einen Bye-Fall erzeugen und die Uhrzeiten in der
   Playoff Picture gegenprüfen.
4. `wettbuero.html` in einem zweiten Tab/Gerät öffnen, einloggen, eine
   Wette platzieren, dann im Admin das Ergebnis eintragen — Auszahlung
   sollte automatisch erscheinen (auch in `wettbuero_bets`/`wettbuero_accounts`
   in Supabase sichtbar).
5. `live.html` parallel offen lassen, Ansage beim Score-Eintrag testen.
6. Einmal "Full Reset" klicken, **"Archivieren"** wählen, prüfen ob das
   alte Turnier in Supabase mit `status = 'completed'` und gefülltem
   `final_standings` auftaucht und in `hall_of_fame.html` erscheint.
7. Ein zweites Test-Turnier anlegen, per "Full Reset" → **"Verwerfen"**
   löschen, prüfen dass es in Supabase komplett weg ist (nicht nur
   `status`-Änderung).
8. `seasons.html?Altima` öffnen: eine Team-OVR pflegen und speichern, dann
   prüfen, dass sich die Quote für Spiele mit diesem Team in `index.html`/
   `live.html` merklich verschiebt. Danach eine archivierte Saison
   aufklappen, einen Spielstand ändern, speichern, und in
   `hall_of_fame.html` gegenprüfen, ob sich die Statistik entsprechend
   ändert.
9. Sobald ElevenLabs eingerichtet ist: einen Meilenstein erreichen (z.B.
   Gruppenphase komplett), im "🎵 Song-Momente"-Panel einen Stil wählen und
   generieren, prüfen dass der Song in Supabase Storage (`mb-songs`-Bucket)
   landet und nach einem Seiten-Reload weiterhin abspielbar ist.
10. Ein extrem einseitiges Testspiel eintragen (z.B. 60:0) — sollte sofort
    im "🏆 Rekord-Momente"-Panel als Allzeit-/Turnier-Klatsche auftauchen,
    inkl. Meme-Vorschau. "Teilen" auf dem Handy testen (System-Share-Sheet
    mit WhatsApp als Option sollte erscheinen).
11. `supabase-schema-update-4.sql` ausführen, dann `live.html` (ohne
    `?Altima`) öffnen: Ticker oben (nächste 2 Spiele / letzte 2 Ergebnisse),
    "📊 Volle Turnieransicht" umschalten und zurück, Blog-Feed sollte den
    Kickoff-Artikel zeigen. Auf dem iPhone: `live.html` in Safari öffnen →
    Teilen → "Zum Home-Bildschirm" → sollte als eigene App-Kachel
    erscheinen (dank `manifest.json` + Apple-Touch-Icon).
12. Ein paar weitere Spiele eintragen, bis ein Zwischenstand-Artikel
    erscheint (alle 3 Spiele), einen Meme-Moment teilen und prüfen, dass er
    danach mit Bild im Blog auftaucht.
13. `wettbuero.html` mit zwei verschiedenen Spielern (zwei Browser-Tabs)
    öffnen, für beide Gesamt-Tipps abgeben, dann in `index.html` das erste
    Spiel JEDES Spielers eintragen und prüfen, dass das Gesamt-Tipp-Fenster
    sich danach schließt. Danach Spieltag-Tipps abgeben (inkl. Over/Under),
    ein Ergebnis aus diesem Spieltag eintragen und prüfen, dass die
    restlichen Tipps für diesen Spieltag jetzt gesperrt sind. Tippstand
    sowohl in `wettbuero.html` als auch im Blog (`live.html` → "📊 Volle
    Turnieransicht") gegenchecken.

## Bekannte Einschränkung: Icon-Qualität

Das App-Icon (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) wurde
aus dem vorhandenen 32×32-`maddenbowl.ico` hochskaliert — funktioniert,
sieht aber auf dem Homescreen etwas unscharf aus. Falls du ein größeres
Original-Logo hast, einfach diese drei PNG-Dateien ersetzen (gleiche Namen,
180×180 / 192×192 / 512×512 Pixel).
