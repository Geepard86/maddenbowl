# Madden Bowl — Umbau-Doku (v2: CSS-Trennung + Supabase)

## Was hier liegt

```
shared.js            ← gemeinsamer Kern: Supabase-Sync, Zeit, Quoten, Ranking, Wettbüro, History, Team-Ratings
announcer.js          ← KI-Ansage-Texte + Vorlesen (Web Speech API)
styles.css            ← zentrales Theme/CSS (vorher inline in index.html)
index.html            ← Turnier-Admin/Anzeige
wettbuero.html         ← Login + Wetten pro Spieler
live.html              ← Live-Tracking (Quoten, Flavour Facts, Titelchancen)
hall_of_fame.html       ← Hall of Fame — liest aus Supabase
seasons.html            ← NEU: Saisons auflisten/bearbeiten/löschen + Team-Werte pflegen
migrate.html            ← einmalig: importiert alte JSON-Saisons nach Supabase
supabase-schema.sql      ← SQL zum einmaligen Anlegen der Tabellen
supabase-schema-update.sql ← NEU: SQL für die Team-Ratings-Tabelle (zusätzlich ausführen)
maddenbowl_2022–2026.json ← NUR NOCH BACKUP, kein Laufzeit-Datenpfad mehr
maddenbowl.ico
```

Alle Dateien zusammen auf den Webspace (GitHub Pages o.ä.) — wie vorher.

## ⚠️ Einmaliges Setup, bevor irgendwas läuft

1. **Supabase-Schema anlegen**: Inhalt von `supabase-schema.sql` **und**
   danach `supabase-schema-update.sql` komplett in den Supabase SQL-Editor
   (Projekt → SQL Editor → New query) einfügen und ausführen.
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

## Features (Wettbüro, Live-Tracking, KI-Ansage)

Unverändert gegenüber der letzten Version — siehe Kommentare direkt in
`wettbuero.html`, `live.html`, `announcer.js`. Kurzfassung:
- **Wettbüro**: PIN-Login, Wetten auf die nächsten 2 fremden Spiele +
  Saison-Wetten (Sieger/Zweiter/Toilet-Bowl-Sieger, Quoten sind eine grobe
  Heuristik), Startkapital/Mindesteinsatz/Rundenbonus konfigurierbar.
- **Live-Tracking**: nächste Spiele mit Quote + Flavour Facts,
  Titelchancen-Balken, Tabelle, Auto-Refresh.
- **KI-Ansage**: läuft automatisch beim Score-Eintrag im Admin-Modus,
  spricht per Web Speech API vor (bevorzugt die kostenlosen
  "Online (Natural)"-Neural-Stimmen von Edge/Chrome unter Windows 11,
  auswählbar über das 🔊-Panel im Admin-Bereich). Zahlen-vor-Punkt-Bug
  ("17." → "siebzehnter") ist behoben.

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
