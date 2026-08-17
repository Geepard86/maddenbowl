# Madden Bowl — Umbau-Doku

## Was hier liegt

```
shared.js         ← NEU: gemeinsamer Kern (Sync, Zeit, Quoten, Ranking, Wettbüro)
announcer.js       ← NEU: KI-Ansage-Texte + Vorlesen (Web Speech API)
index.html         ← Turnier-Admin/Anzeige (gepatcht, nutzt jetzt shared.js)
wettbuero.html      ← NEU: Login + Wetten pro Spieler
live.html           ← NEU: Live-Tracking (Quoten, Flavour Facts, Titelchancen)
hall_of_fame.html    ← unverändert übernommen (kein Bug betroffen)
maddenbowl_2022–2026.json, maddenbowl.ico ← Daten/Assets unverändert
```

Alle Dateien liegen im selben Ordner und müssen zusammen auf den Webspace
(GitHub Pages o.ä.) — genau wie vorher.

## Architektur-Umbau

Vorher hatte `index.html` **alle** Logik (Odds-Berechnung, Ranking, Zeitplan,
Flavour Facts, Sync) allein in einer 3200-Zeilen-Datei — bei jeder neuen
Seite (Wettbüro, Live-Tracking) hättest du das komplett noch mal schreiben
müssen. Jetzt liegt der ganze fachliche Kern in `shared.js` und wird von
`index.html`, `wettbuero.html` und `live.html` gemeinsam genutzt
(`window.MB.*`). `index.html` selbst ruft an den entsprechenden Stellen jetzt
nur noch dünne Wrapper auf, die an `MB` delegieren — die komplette
Render-/Admin-Logik (Bracket-Zuordnung, UI, DOM) ist unangetastet geblieben,
um das Risiko für dein laufendes Turnier-Tool möglichst klein zu halten.

## Die 4 gewünschten Bugfixes

1. **Refresh-Bug** — `MB.fetchCloudState()` erzwingt jetzt `cache: "no-store"`
   **plus** einen Cache-Busting-Query-Parameter. Vorher lief der reine
   Lese-Sync (`syncData()` ohne Upload) ganz ohne Cache-Control, wodurch
   Browser/CDN gelegentlich eine alte Antwort ausgeliefert haben —
   `localStorage.clear()` konnte das nie beheben, weil das Problem im
   Netzwerk-Layer saß, nicht im LocalStorage.
2. **Bye-Zeiten** — `MB.computePlayoffOffsets()` überspringt jetzt Slots, in
   denen beide Partien Byes sind (keine Zeit wird addiert), lässt aber echte
   Spiele weiterhin ihre volle Dauer bekommen. Dadurch können Spiele der
   nächsten Runde nie vor Abschluss der Vorrunde beginnen.
3. **Contender Round: erst Lower, dann Upper** — in `MB.PLAYOFF_STRUCTURE`
   läuft `lb1/lb2` (Lower) jetzt bewusst vor `us1/us2` (Upper); vorher hatte
   ein Datenfehler in der alten Offset-Tabelle das genau umgekehrt.
4. **Abschlusstabelle** — `MB.computeBaseRanking()`/`applyToiletBowlOverride()`:
   - Turniersieger bekommt automatisch **+100 Punkte** Bonus.
   - Toilet-Bowl-Sieger **übernimmt die Punkte** des vorletzten Platzes und
     belegt selbst den letzten Platz (nicht nur die Position wird
     getauscht, sondern auch der Punktwert).
   Ich habe das gegen `maddenbowl_2026.json` (dein bereits abgeschlossenes
   Archiv) geprüft — die dort hinterlegten Endstände (900/700/600/…/100/200)
   entsprechen exakt dieser neuen Formel. Gutes Zeichen, dass die Regel
   richtig verstanden wurde.

## Neue Features

### Wettbüro (`wettbuero.html`)
- Login je Spieler per **PIN** (4–6 Ziffern). Erste Anmeldung legt die PIN
  fest, danach wird sie geprüft. PINs liegen (unverschlüsselt, wie der Rest
  der App auch) im gemeinsamen npoint.io-JSON — für eine Freundesrunde
  ausreichend, aber **kein** Schutz vor absichtlichem Missbrauch.
- Zeigt automatisch die **nächsten 2 Spiele**, an denen der eingeloggte
  Spieler **nicht beteiligt** ist, inkl. Quote (aus derselben Elo-Engine wie
  `index.html`).
- **Saison-Wetten** auf Turniersieger, Zweiten und Toilet-Bowl-Sieger.
  Die Quoten dafür sind eine **grobe Heuristik** auf Basis der
  Titelchancen-Engine (keine echte Kombinatorik) — im UI als Schätzung
  gekennzeichnet.
- **Startkapital**, **Mindesteinsatz pro Spiel** und **Rundenbonus** sind in
  `state.wettbuero.config` einstellbar (Default: 100 / 5 / 10). Der
  Rundenbonus wird aktuell **nicht automatisch** ausgeschüttet — dafür gibt
  es `MB.grantRoundBonus(state, roundKey)`, die du z. B. an einer Stelle
  deiner Wahl in `index.html` aufrufen kannst (z. B. wenn eine Playoff-Runde
  komplett abgeschlossen ist). Ich habe das bewusst nicht automatisch
  verdrahtet, weil "eine Runde" für dich vermutlich eine spezifische
  Bedeutung hat, die ich nicht raten wollte.
- Abrechnung von Spiel- und Saison-Wetten passiert automatisch, sobald der
  Admin in `index.html` ein Ergebnis einträgt.

### Live-Tracking (`live.html`)
- Öffentliche, Login-freie Seite: aktuelle & nächste Spiele mit Quote,
  Over/Under-Linie und bis zu 3 Flavour Facts pro Spiel.
- Titelchancen-Balkendiagramm.
- Laufende Tabelle.
- Auto-Refresh alle 15 Sekunden.

### KI-Ansage (in `index.html`, `announcer.js`)
- Wird automatisch ausgelöst, sobald ein Spiel **im Admin-Modus** fertig
  eingetragen wird (Übergang offen → beendet, nicht bei jeder Korrektur).
- Spricht zuerst eine launige Schlusspfiff-Ansage (Ergebnis, Sieger,
  Flavour-Fact), danach eine Vorschau auf die kommende Partie (Anpfiffzeit,
  Favorit laut Quote, Flavour Fact).
- **Wird nur vorgelesen** (Web Speech API), nichts wird als Text angezeigt.
- Nutzt die deutsche System-Stimme des Browsers/Geräts. Qualität hängt vom
  Gerät ab (Web Speech API ist kostenlos, aber nicht so natürlich wie z. B.
  ElevenLabs). Falls dir das zu blechern klingt, sag Bescheid — dann bauen
  wir eine externe TTS-API mit ordentlicher Stimme ein.
- Damit die Ansage im Browser überhaupt laufen darf, muss der Tab einmal
  irgendeine Nutzerinteraktion gehabt haben (Chrome/Safari blockieren
  Autoplay von Audio ohne das) — beim Eintragen eines Scores per Klick ist
  das automatisch der Fall.

## Bekannte Grenzen / bewusste Entscheidungen

- **Kein echtes Backend**: nach wie vor `npoint.io` als einzige
  "Datenbank" — kein Locking, "last write wins" bei gleichzeitigen
  Schreibzugriffen (Admin + mehrere Wett-Spieler gleichzeitig). Für eure
  Runde am Sommerkino-Tag sollte das kein Problem sein, aber es ist kein
  produktionsreifes Multi-User-Backend.
- **Saison-Wettquoten** sind eine Heuristik, keine exakte Kombinatorik über
  den Turnierbaum — transparent im UI kommuniziert.
- Ich habe **nicht** jede Render-Funktion in `index.html` neu geschrieben,
  sondern gezielt die Logik-Duplikate durch `MB.*`-Aufrufe ersetzt und die
  4 Bugs direkt gepatcht. Das UI/Admin-Verhalten sollte sich dadurch nicht
  ändern — nur korrekter/schneller werden.
- `hall_of_fame.html` hatte keinen der gemeldeten Bugs und wurde nicht
  angefasst.

## Kurzer Test-Vorschlag

Vor dem Sommerkino-Einsatz würde ich empfehlen, einmal mit ein paar
Test-Werten durchzuklicken:
1. Turnier mit 8 Spielern starten, ein paar Gruppenspiele eintragen.
2. Prüfen, ob nach `localStorage.clear()` **und** hartem Browser-Reload die
   Daten sofort aktuell sind (Refresh-Bug-Test).
3. In den Playoffs bewusst einen Bye-Fall erzeugen und die Uhrzeiten in der
   Playoff Picture gegenprüfen.
4. `wettbuero.html` in einem zweiten Tab/Gerät öffnen, einloggen, eine Wette
   platzieren, dann im Admin das Ergebnis eintragen — Auszahlung sollte
   automatisch erscheinen.
5. `live.html` parallel offen lassen und beobachten, ob die Ansage bei
   Score-Eintrag hörbar startet.
