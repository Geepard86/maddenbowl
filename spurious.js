/* =========================================================================
   MADDEN BOWL — SPURIOUS CORRELATIONS (spurious.js)
   -------------------------------------------------------------------------
   Tyler-Vigen-Style ("tylervigen.com/spurious") Schein-Korrelationen:
   testet bei jedem gespeicherten Ergebnis, ob eine Madden-Bowl-Kennzahl aus
   der Turnier-Historie (archivierte Saisons, je ein Wert pro Jahr) zufällig
   stark mit einer der 101 unten hinterlegten deutschen Jahres-Statistiken
   korreliert (Pearson r). Bewusst reine Spielerei: bei nur 4 Datenpunkten
   pro Jahr (2022–2025) sind extreme Korrelationen fast garantiert — genau
   das ist ja der Witz an Spurious Correlations.

   Datensatz: handkuratiert von Tim (SpuriousCorellations.xlsx), aktuell
   Jahre 2022–2025, wird bei Bedarf um weitere Jahre/Zeilen ergänzt.

   Voraussetzung: shared.js ist vorher geladen (window.MB).
   ========================================================================= */

(function (global) {
  "use strict";

  // ======================================================================
  // DATENSATZ — 101 deutsche Jahres-Statistiken, 2022–2025
  // ======================================================================
  const GERMAN_STATS = [
    { id: "bierabsatz-deutschland", name: "Bierabsatz in Deutschland", unit: "Mio. hl", source: "Destatis / GENESIS", category: "goods", values: { 2022: 87.7, 2023: 83.76, 2024: 82.68, 2025: 77.71 } },
    { id: "bierverbrauch-je-einwohner", name: "Bierverbrauch je Einwohner in Deutschland", unit: "Liter", source: "Destatis / GENESIS", category: "goods", values: { 2022: 86.6, 2023: 83.5, 2024: 81.7, 2025: 76.9 } },
    { id: "eierproduktion", name: "Eierproduktion in Deutschland", unit: "Mrd. Eier", source: "Destatis", category: "goods", values: { 2022: 13.1, 2023: 13.1, 2024: 13.7, 2025: 13.7 } },
    { id: "apfelernte-deutschland", name: "Apfelernte in Deutschland", unit: "Mio. t", source: "Destatis", category: "goods", values: { 2022: 1.071, 2023: 0.987, 2024: 0.872, 2025: 1.138 } },
    { id: "fleischersatzproduktion", name: "Fleischersatzproduktion in Deutschland", unit: "Tsd. t", source: "Destatis", category: "goods", values: { 2022: 104.3, 2023: 121.6, 2024: 126.5, 2025: 124.9 } },
    { id: "unternehmensinsolvenzen", name: "Unternehmensinsolvenzen in Deutschland", unit: "Fälle", source: "Destatis", category: "events", values: { 2022: 14590, 2023: 17814, 2024: 21812, 2025: 24064 } },
    { id: "eheschlieungen", name: "Eheschließungen in Deutschland", unit: "Fälle", source: "Destatis", category: "events", values: { 2022: 390743, 2023: 360979, 2024: 349216, 2025: 348813 } },
    { id: "ehescheidungen", name: "Ehescheidungen in Deutschland", unit: "Fälle", source: "Destatis", category: "events", values: { 2022: 137353, 2023: 129008, 2024: 129337, 2025: 130053 } },
    { id: "ubernachtungen-deutschland", name: "Übernachtungen in Deutschland", unit: "Mio.", source: "Destatis", category: "events", values: { 2022: 450.71, 2023: 487.11, 2024: 496.03, 2025: 497.5 } },
    { id: "aus-deutschland-abfliegende-passagiere", name: "Abfliegende Passagiere aus Deutschland", unit: "Mio.", source: "Destatis – Luftverkehr", category: "events", values: { 2022: 72.65, 2023: 86.64, 2024: 93.45, 2025: 97.32 } },
    { id: "patentanmeldungen-beim-dpma", name: "Patentanmeldungen beim Deutschen Patent- und Markenamt (DPMA)", unit: "Anzahl", source: "DPMA", category: "events", values: { 2022: 57213, 2023: 58662, 2024: 59261, 2025: 62050 } },
    { id: "studierende-deutschland", name: "Studierende in Deutschland", unit: "Mio.", source: "Destatis – Hochschulen", category: "population", values: { 2022: 2.92, 2023: 2.868, 2024: 2.864, 2025: 2.877 } },
    { id: "treibhausgasemissionen-deutschland", name: "Treibhausgasemissionen in Deutschland", unit: "Mio. t CO₂e", source: "Umweltbundesamt", category: "other", values: { 2022: 750, 2023: 673, 2024: 650, 2025: 649 } },
    { id: "smartphones-absatz-deutschland", name: "Smartphone-Absatz in Deutschland", unit: "Mio. Stück", source: "Bitkom", category: "goods", values: { 2022: 21, 2023: 20.3, 2024: 20.5, 2025: 19.6 } },
    { id: "deutsche-games-unternehmen", name: "Games-Unternehmen in Deutschland", unit: "Anzahl", source: "game", category: "events", values: { 2022: 786, 2023: 908, 2024: 948, 2025: 910 } },
    { id: "globale-musikindustrie-recorded-music-umsatz", name: "Weltweiter Umsatz mit Recorded Music", unit: "Mrd. US-$", source: "IFPI – Global Music Report 2026", category: "revenue", values: { 2022: 25.8, 2023: 28.4, 2024: 29.7, 2025: 31.7 } },
    { id: "globale-musikindustrie-subscription-streaming-umsatz", name: "Weltweiter Umsatz mit Subscription-Streaming", unit: "Mrd. US-$", source: "IFPI – Global Music Report 2026", category: "revenue", values: { 2022: 12.7, 2023: 14.4, 2024: 16, 2025: 16.6 } },
    { id: "oscar-werbung-30-sek-spot", name: "Preis für einen 30-Sekunden-Werbespot bei den Oscars", unit: "Mio. US-$", source: "Marketing Brew", category: "price", values: { 2022: 1.71, 2023: 2.1, 2024: 1.85, 2025: 2 } },
    { id: "super-bowl-werbung-30-sek-spot", name: "Preis für einen 30-Sekunden-Werbespot beim Super Bowl", unit: "Mio. US-$", source: "CBS News", category: "price", values: { 2022: 6.5, 2023: 7, 2024: 7, 2025: 8 } },
    { id: "fahrrad-e-bike-durchschnittlicher-verkaufspreis", name: "Durchschnittlicher Verkaufspreis von Fahrrädern und E-Bikes in Deutschland", unit: "€", source: "ZIV – Marktdaten", category: "price", values: { 2022: 1602, 2023: 1788, 2024: 1645, 2025: 1581 } },
    { id: "durchschnittlicher-e-bike-preis", name: "Durchschnittlicher E-Bike-Verkaufspreis in Deutschland", unit: "€", source: "ZIV – Marktdaten", category: "price", values: { 2022: 2800, 2023: 2950, 2024: 2650, 2025: 2550 } },
    { id: "pkw-bestand-deutschland", name: "Pkw-Bestand in Deutschland", unit: "Mio.", source: "KBA – Fahrzeugbestand", category: "infrastructure", values: { 2022: 48.5, 2023: 48.8, 2024: 49.1, 2025: 49.3 } },
    { id: "gesamtbevolkerung-deutschland", name: "Gesamtbevölkerung in Deutschland", unit: "Mio.", source: "Destatis – Bevölkerungsstand", category: "population", values: { 2022: 82.53, 2023: 83.29, 2024: 83.52, 2025: 83.52 } },
    { id: "lebendgeborene", name: "Lebendgeborene in Deutschland", unit: "Tsd.", source: "Destatis – Geburten", category: "population", values: { 2022: 738.8, 2023: 693, 2024: 677.1, 2025: 654.2 } },
    { id: "gestorbene", name: "Gestorbene in Deutschland", unit: "Tsd.", source: "Destatis – Geburten und Sterbefälle", category: "population", values: { 2022: 1066.3, 2023: 1028.2, 2024: 1007.8, 2025: 1006.6 } },
    { id: "erwerbstatige", name: "Erwerbstätige in Deutschland", unit: "Mio.", source: "Destatis – Arbeitsmarkt", category: "population", values: { 2022: 45.469, 2023: 45.782, 2024: 45.83, 2025: 45.83 } },
    { id: "erwerbslose", name: "Erwerbslose in Deutschland", unit: "Mio.", source: "Destatis – Arbeitsmarkt", category: "population", values: { 2022: 1.355, 2023: 1.342, 2024: 1.49, 2025: 1.652 } },
    { id: "genehmigte-wohnungen", name: "Genehmigte Wohnungen in Deutschland", unit: "Tsd.", source: "Destatis – Baugenehmigungen", category: "events", values: { 2022: 354.2, 2023: 259.6, 2024: 215.3, 2025: 238.1 } },
    { id: "holzeinschlag", name: "Holzeinschlag in Deutschland", unit: "Mio. m³", source: "Destatis – Holzeinschlag", category: "goods", values: { 2022: 78.7, 2023: 70.6, 2024: 61.2, 2025: 57.3 } },
    { id: "kinobesucher-deutschland", name: "Kinobesucher in Deutschland", unit: "Mio.", source: "FFA – Marktdaten", category: "events", values: { 2022: 78.2, 2023: 95.7, 2024: 89.9, 2025: 91.9 } },
    { id: "stromerzeugung-gesamt", name: "Bruttostromerzeugung in Deutschland", unit: "Mrd. kWh", source: "Destatis – Bruttostromerzeugung", category: "goods", values: { 2022: 578.9, 2023: 511.3, 2024: 503.2, 2025: 507.5 } },
    { id: "windstrom", name: "Windstromerzeugung in Deutschland", unit: "Mrd. kWh", source: "Destatis – Stromerzeugung 2025", category: "goods", values: { 2022: 122.5, 2023: 139.3, 2024: 136, 2025: 131.3 } },
    { id: "erneuerbare-stromerzeugung", name: "Erneuerbare Stromerzeugung in Deutschland", unit: "Mrd. kWh", source: "Destatis – Stromerzeugung 2025", category: "goods", values: { 2022: 236, 2023: 251.8, 2024: 256.4, 2025: 256.9 } },
    { id: "butterproduktion", name: "Butterproduktion in Deutschland", unit: "t", source: "Destatis – GENESIS", category: "goods", values: { 2022: 471800, 2023: 480500, 2024: 473400, 2025: 518100 } },
    { id: "kaseproduktion", name: "Käseproduktion in Deutschland", unit: "Mio. t", source: "BMEL – Milch und Milcherzeugnisse", category: "goods", values: { 2022: 2.64, 2023: 2.66, 2024: 2.74, 2025: 2.76 } },
    { id: "zigarettenverbrauch", name: "Zigarettenverbrauch in Deutschland", unit: "Mrd. Stück", source: "Destatis – GENESIS", category: "goods", values: { 2022: 65.784, 2023: 64.03, 2024: 66.247, 2025: 66.375 } },
    { id: "fitnessstudio-mitglieder", name: "Fitnessstudio-Mitglieder in Deutschland", unit: "Mio.", source: "DSSV – Eckdaten 2026", category: "events", values: { 2022: 10.3, 2023: 11.3, 2024: 11.71, 2025: 12.36 } },
    { id: "e-bike-verkaufe-deutschland", name: "E-Bike-Verkäufe in Deutschland", unit: "Mio. Stück", source: "ZIV – Marktdaten-Archiv", category: "goods", values: { 2022: 2.2, 2023: 2.1, 2024: 2.1, 2025: 2 } },
    { id: "weltweite-kino-bilanz-box-office", name: "Weltweites Kino-Box-Office", unit: "Mrd. US-$", source: "Gower Street Analytics", category: "revenue", values: { 2022: 25.9, 2023: 33.9, 2024: 30, 2025: 33.55 } },
    { id: "usa-kanada-kino-umsatz", name: "Kino-Umsatz in den USA und Kanada", unit: "Mrd. US-$", source: "SEC / AMC 10-K", category: "revenue", values: { 2022: 7.454, 2023: 9.034, 2024: 8.746, 2025: 8.9 } },
    { id: "usa-kanada-kinobesuche", name: "Kinobesuche in den USA und Kanada", unit: "Mio. Tickets", source: "SEC / AMC 10-K", category: "events", values: { 2022: 708, 2023: 833, 2024: 760, 2025: 769 } },
    { id: "buchmarkt-deutschland-gesamtumsatz", name: "Gesamtumsatz des Buchmarkts in Deutschland", unit: "Mrd. €", source: "Börsenverein – Wirtschaftszahlen", category: "revenue", values: { 2022: 9.444, 2023: 9.707, 2024: 9.882, 2025: 9.62 } },
    { id: "taylor-swift-ifpi-global-artist-of-the-year", name: "IFPI Global Artist of the Year – Taylor Swift", unit: "Rang", source: "IFPI – Global Charts", category: "rate", values: { 2022: 1, 2023: 1, 2024: 1, 2025: 1 } },
    { id: "kartoffelernte-deutschland", name: "Kartoffelernte in Deutschland", unit: "Mio. t", source: "Destatis – Feldfrüchte", category: "goods", values: { 2022: 10.683, 2023: 11.607, 2024: 12.703, 2025: 13.871 } },
    { id: "getreideernte-insgesamt", name: "Getreideernte in Deutschland insgesamt", unit: "Mio. t", source: "Destatis – Feldfrüchte", category: "goods", values: { 2022: 43.479, 2023: 42.463, 2024: 38.975, 2025: 45.258 } },
    { id: "zuckerrubenernte", name: "Zuckerrübenernte in Deutschland", unit: "Mio. t", source: "Destatis – Feldfrüchte", category: "goods", values: { 2022: 28.201, 2023: 31.558, 2024: 36.682, 2025: 32.327 } },
    { id: "weinerzeugung-deutschland", name: "Weinerzeugung in Deutschland", unit: "Mio. hl", source: "Destatis – Weinerzeugung", category: "goods", values: { 2022: 8.94, 2023: 8.593, 2024: 7.751, 2025: 7.55 } },
    { id: "biersteuer-einnahmen", name: "Biersteuereinnahmen in Deutschland", unit: "Mio. €", source: "DHS – Alkohol Zahlen & Fakten", category: "revenue", values: { 2022: 600, 2023: 580, 2024: 558, 2025: 540 } },
    { id: "alkoholsteuer-einnahmen-insgesamt", name: "Alkoholsteuereinnahmen in Deutschland insgesamt", unit: "Mio. €", source: "DHS – Alkohol Zahlen & Fakten", category: "revenue", values: { 2022: 3173, 2023: 3125, 2024: 2917, 2025: 2978 } },
    { id: "paketsendungen", name: "Paketsendungen in Deutschland", unit: "Mrd. Sendungen", source: "Bundesnetzagentur – Postmarkt", category: "events", values: { 2022: 4.25, 2023: 4.36, 2024: 4.6, 2025: 4.83 } },
    { id: "paketmarkt-umsatz", name: "Umsatz des Paketmarkts in Deutschland", unit: "Mrd. €", source: "Bundesnetzagentur – Postmarkt", category: "revenue", values: { 2022: 18.41, 2023: 19.19, 2024: 20.37, 2025: 21.79 } },
    { id: "gema-gesamtertrage", name: "Gesamterträge der GEMA", unit: "Mrd. €", source: "GEMA – Geschäftsbericht 2025", category: "revenue", values: { 2022: 1.178, 2023: 1.207, 2024: 1.33, 2025: 1.34 } },
    { id: "deutscher-musikmarkt-handelsumsatz", name: "Handelsumsatz des deutschen Musikmarkts", unit: "Mrd. €", source: "BVMI – Musikindustrie in Zahlen 2025", category: "revenue", values: { 2022: 1.055, 2023: 1.153, 2024: 2.365, 2025: 2.42 } },
    { id: "markenanmeldungen-beim-dpma", name: "Markenanmeldungen beim Deutschen Patent- und Markenamt (DPMA)", unit: "Anmeldungen", source: "DPMA – Markenstatistik 2025", category: "events", values: { 2022: 73312, 2023: 75261, 2024: 77224, 2025: 93291 } },
    { id: "patenterteilungen-beim-dpma", name: "Patenterteilungen beim Deutschen Patent- und Markenamt (DPMA)", unit: "Erteilungen", source: "DPMA – Patentstatistik", category: "events", values: { 2022: 23591, 2023: 22363, 2024: 23944, 2025: 24475 } },
    { id: "einwanderung-nach-deutschland", name: "Einwanderung nach Deutschland", unit: "Personen", source: "Destatis – Wanderungsstatistik", category: "population", values: { 2022: 2.66577e+06, 2023: 1.93251e+06, 2024: 1.69419e+06, 2025: 1.47994e+06 } },
    { id: "auswanderung-aus-deutschland", name: "Auswanderung aus Deutschland", unit: "Personen", source: "Destatis – Wanderungsstatistik", category: "population", values: { 2022: 1.20368e+06, 2023: 1.26954e+06, 2024: 1.26401e+06, 2025: 1.24494e+06 } },
    { id: "auslandische-bevolkerung-in-deutschland", name: "Ausländische Bevölkerung in Deutschland", unit: "Mio. Personen", source: "Destatis – Ausländerstatistik", category: "population", values: { 2022: 13.384, 2023: 13.896, 2024: 14.062, 2025: 14.07 } },
    { id: "nettozuwanderung", name: "Nettozuwanderung nach Deutschland", unit: "Mio. Personen", source: "Destatis – Wanderungsstatistik", category: "population", values: { 2022: 1.462, 2023: 0.663, 2024: 0.43, 2025: 0.235 } },
    { id: "verkehrstote", name: "Verkehrstote in Deutschland", unit: "Personen", source: "Destatis – Verkehrsunfälle", category: "other", values: { 2022: 2788, 2023: 2839, 2024: 2770, 2025: 2832 } },
    { id: "verkehrsunfalle-insgesamt", name: "Verkehrsunfälle in Deutschland insgesamt", unit: "Mio. Unfälle", source: "Destatis – Verkehrsunfälle", category: "events", values: { 2022: 2.406, 2023: 2.52, 2024: 2.513, 2025: 2.522 } },
    { id: "veranschlagte-baukosten-genehmigter-bauwerke", name: "Veranschlagte Baukosten genehmigter Bauwerke in Deutschland", unit: "Mrd. €", source: "Destatis – Baugenehmigungen", category: "price", values: { 2022: 134.99, 2023: 112.992, 2024: 104.06, 2025: 113.815 } },
    { id: "fahrgaste-im-linienverkehr-busse-bahnen", name: "Fahrgäste im Linienverkehr mit Bussen und Bahnen in Deutschland", unit: "Mrd. Fahrgäste", source: "Destatis – Linienverkehr", category: "events", values: { 2022: 10.7, 2023: 10.9, 2024: 11.4, 2025: 11.5 } },
    { id: "landwirtschaftlicher-erzeugerpreisindex", name: "Landwirtschaftlicher Erzeugerpreisindex in Deutschland", unit: "Index 2020=100", source: "Destatis – Landwirtschaftliche Erzeugerpreise", category: "price", values: { 2022: 141, 2023: 141.3, 2024: 139.2, 2025: 139.6 } },
    { id: "super-bowl-zuschauer-usa", name: "Super-Bowl-Zuschauer in den USA", unit: "Mio. Zuschauer", source: "Nielsen", category: "events", values: { 2022: 101.47, 2023: 115.096, 2024: 123.714, 2025: 127.713 } },
    { id: "arbeitskosten-je-geleistete-stunde", name: "Arbeitskosten je geleistete Stunde in Deutschland", unit: "€", source: "Destatis – Arbeitskosten", category: "price", values: { 2022: 39.5, 2023: 41.3, 2024: 43.4, 2025: 45 } },
    { id: "inflationsrate-deutschland", name: "Inflationsrate in Deutschland", unit: "%", source: "Destatis – Inflationsrate", category: "rate", values: { 2022: 6.9, 2023: 5.9, 2024: 2.2, 2025: 2.2 } },
    { id: "bip-nominal", name: "Nominales Bruttoinlandsprodukt Deutschlands", unit: "Mrd. €", source: "Destatis – VGR", category: "revenue", values: { 2022: 3989.39, 2023: 4219.31, 2024: 4328.97, 2025: 4470.48 } },
    { id: "bip-wachstum-real", name: "Reales BIP-Wachstum in Deutschland", unit: "%", source: "Destatis – BIP 2025", category: "rate", values: { 2022: 1.8, 2023: -0.9, 2024: -0.5, 2025: 0.2 } },
    { id: "private-konsumausgaben", name: "Private Konsumausgaben in Deutschland", unit: "Mrd. €", source: "Destatis – VGR", category: "revenue", values: { 2022: 2094.03, 2023: 2218.51, 2024: 2282.96, 2025: 2373.99 } },
    { id: "konsumausgaben-des-staates", name: "Konsumausgaben des Staates in Deutschland", unit: "Mrd. €", source: "Destatis – VGR", category: "revenue", values: { 2022: 868.21, 2023: 905.2, 2024: 951.78, 2025: 1007.84 } },
    { id: "exporte", name: "Exporte Deutschlands", unit: "Mrd. €", source: "Destatis – VGR", category: "revenue", values: { 2022: 1820.3, 2023: 1812.92, 2024: 1793.67, 2025: 1811.27 } },
    { id: "importe", name: "Importe Deutschlands", unit: "Mrd. €", source: "Destatis – VGR", category: "revenue", values: { 2022: 1721.71, 2023: 1645.33, 2024: 1630.15, 2025: 1700.85 } },
    { id: "kfz-bestand-insgesamt", name: "Kfz-Bestand in Deutschland insgesamt", unit: "Mio.", source: "Destatis – Fahrzeugbestand", category: "infrastructure", values: { 2022: 59.635, 2023: 60.133, 2024: 60.681, 2025: 61.098 } },
    { id: "pkw-neuzulassungen", name: "Pkw-Neuzulassungen in Deutschland", unit: "Mio.", source: "Destatis – Neuzulassungen", category: "goods", values: { 2022: 2.651, 2023: 2.845, 2024: 2.817, 2025: 2.858 } },
    { id: "autobahnnetz", name: "Autobahnnetz in Deutschland", unit: "Tsd. km", source: "Destatis – Verkehrsinfrastruktur", category: "infrastructure", values: { 2022: 13.2, 2023: 13.2, 2024: 13.2, 2025: 13.2 } },
    { id: "bundesstraennetz", name: "Bundesstraßennetz in Deutschland", unit: "Tsd. km", source: "Destatis – Verkehrsinfrastruktur", category: "infrastructure", values: { 2022: 37.8, 2023: 37.8, 2024: 37.7, 2025: 37.7 } },
    { id: "onlinehandel-deutschland", name: "Onlinehandel in Deutschland", unit: "Mrd. € netto", source: "HDE Online-Monitor", category: "goods", values: { 2022: 84.7, 2023: 85.5, 2024: 88.8, 2025: 92.4 } },
    { id: "weltweite-rebflache", name: "Weltweite Rebfläche", unit: "Mio. ha", source: "OIV – State of the World Wine Sector 2025", category: "infrastructure", values: { 2022: 7.236, 2023: 7.172, 2024: 7.09, 2025: 7.034 } },
    { id: "verbrauch-versteuerter-zigaretten-je-einwohner", name: "Verbrauch versteuerter Zigaretten je Einwohner in Deutschland", unit: "Stück/Jahr", source: "DHS / Destatis – Tabak und Nikotin", category: "goods", values: { 2022: 785, 2023: 769, 2024: 793, 2025: 795 } },
    { id: "kaffeesteuereinnahmen", name: "Kaffeesteuereinnahmen in Deutschland", unit: "Mio. €", source: "Destatis – Steuereinnahmen nach Steuerarten", category: "revenue", values: { 2022: 1062.5, 2023: 1030.2, 2024: 992.3, 2025: 1037.9 } },
    { id: "verbraucherpreisindex-besuch-von-kino-theater-konzert-zirkus-u-a", name: "Verbraucherpreisindex für den Besuch von Kino, Theater, Konzert, Zirkus u. Ä. in Deutschland", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", category: "price", values: { 2022: 103.8, 2023: 108.3, 2024: 112.2, 2025: 116.6 } },
    { id: "verbraucherpreisindex-fastfoodrestaurants", name: "Verbraucherpreisindex für Fastfoodrestaurants in Deutschland", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", category: "price", values: { 2022: 112.3, 2023: 122.9, 2024: 130.3, 2025: 136.1 } },
    { id: "verbraucherpreisindex-hotelubernachtungen", name: "Verbraucherpreisindex für Hotelübernachtungen in Deutschland", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", category: "price", values: { 2022: 110.1, 2023: 117.8, 2024: 122.1, 2025: 125.5 } },
    { id: "verbraucherpreisindex-bestattungsleistungen-friedhofsgebuhren", name: "Verbraucherpreisindex für Bestattungsleistungen und Friedhofsgebühren in Deutschland", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", category: "price", values: { 2022: 107.4, 2023: 113.2, 2024: 118.4, 2025: 122.2 } },
    { id: "verbraucherpreisindex-bahntickets", name: "Verbraucherpreisindex für Bahntickets in Deutschland", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", category: "price", values: { 2022: 92.1, 2023: 95.6, 2024: 98.6, 2025: 104.8 } },
    { id: "goldschmuck-nachfrage-weltweit", name: "Weltweite Nachfrage nach Goldschmuck", unit: "Tonnen", source: "World Gold Council – Jewellery Demand World Gold Council – 2025", category: "goods", values: { 2022: 2088.9, 2023: 2092.6, 2024: 1866.9, 2025: 1542.3 } },
    { id: "goldnachfrage-der-zentralbanken-weltweit", name: "Weltweite Goldnachfrage der Zentralbanken", unit: "Tonnen", source: "World Gold Council – Central Banks World Gold Council – 2024 World Gold Council – 2025", category: "goods", values: { 2022: 1081.9, 2023: 1037.4, 2024: 1044.6, 2025: 863.3 } },
    { id: "goldverbrauch-fur-technologie-weltweit", name: "Weltweiter Goldverbrauch für Technologie", unit: "Tonnen", source: "World Gold Council – Technology 2022/23 World Gold Council – Technology 2024/25", category: "goods", values: { 2022: 308.5, 2023: 297.8, 2024: 326.1, 2025: 322.8 } },
    { id: "rohstahlproduktion-weltweit", name: "Weltweite Rohstahlproduktion", unit: "Mio. Tonnen", source: "worldsteel – World Steel in Figures 2026", category: "goods", values: { 2022: 1889, 2023: 1904, 2024: 1887, 2025: 1849 } },
    { id: "stahlverbrauch-pro-kopf-in-deutschland", name: "Stahlverbrauch pro Kopf in Deutschland", unit: "kg pro Kopf", source: "worldsteel – Apparent Steel Use per Capita", category: "goods", values: { 2022: 387, 2023: 334.9, 2024: 312.9, 2025: 347.1 } },
    { id: "mobelproduktion-in-deutschland-produktionswert", name: "Produktionswert der Möbelindustrie in Deutschland", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Möbel", category: "goods", values: { 2022: 18.791, 2023: 17.726, 2024: 16.338, 2025: 15.792 } },
    { id: "bekleidungsproduktion-in-deutschland-produktionswert", name: "Produktionswert der Bekleidungsindustrie in Deutschland", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Bekleidung", category: "goods", values: { 2022: 20.977, 2023: 19.924, 2024: 18.509, 2025: 17.853 } },
    { id: "pharmaindustrie-deutschland-produktionswert", name: "Produktionswert der Pharmaindustrie in Deutschland", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Pharma", category: "goods", values: { 2022: 100.664, 2023: 107.666, 2024: 99.905, 2025: 101.006 } },
    { id: "lederwaren-und-schuhindustrie-deutschland-produktionswert", name: "Produktionswert der Lederwaren- und Schuhindustrie in Deutschland", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Leder & Schuhe", category: "goods", values: { 2022: 6.202, 2023: 6.89, 2024: 6.612, 2025: 6.523 } },
    { id: "tabakverarbeitung-deutschland-produktionswert", name: "Produktionswert der Tabakverarbeitung in Deutschland", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Tabakverarbeitung", category: "goods", values: { 2022: 6.202, 2023: 6.89, 2024: 6.612, 2025: 6.523 } },
    { id: "staatliche-lotterien-spieleinsatze", name: "Spieleinsätze der staatlichen Lotterien in Deutschland", unit: "Mrd. €", source: "LOTTO.de – Bilanz 2022 DLTB/ZEAL – 2023 LOTTO.de – Bilanz 2024 LOTTO.de – Bilanz 2025", category: "revenue", values: { 2022: 7.97, 2023: 8.2, 2024: 8.56, 2025: 8.3 } },
    { id: "weltbevolkerung", name: "Weltbevölkerung", unit: "Personen", source: "World Bank / FRED – World Population", category: "population", values: { 2022: 7.98855e+09, 2023: 8.06292e+09, 2024: 8.1409e+09, 2025: 8.21542e+09 } },
    { id: "zusammengefasste-geburtenziffer-deutschland", name: "Zusammengefasste Geburtenziffer in Deutschland", unit: "Kinder je Frau", source: "Destatis", category: "population", values: { 2022: 1.49, 2023: 1.38, 2024: 1.35, 2025: 1.32 } },
    { id: "weltweite-verkaufe-von-elektroautos-bev-plug-in-hybride", name: "Weltweite Verkäufe von Elektroautos (BEV und Plug-in-Hybride)", unit: "Mio. Fahrzeuge", source: "IEA – Global EV Outlook", category: "goods", values: { 2022: 10.5, 2023: 14, 2024: 17, 2025: 21 } },
    { id: "internationale-fuballtransfers-transferentschadigungen-weltweit", name: "Weltweite Transferentschädigungen bei internationalen Fußballtransfers", unit: "Mrd. US-$", source: "FIFA – Global Transfer Report", category: "revenue", values: { 2022: 6.5, 2023: 9.66, 2024: 8.59, 2025: 13.08 } },
  ];

  // ======================================================================
  // TYLER-VIGEN-STYLE KAUSALGESCHICHTEN ("Bausteine")
  // ----------------------------------------------------------------------
  // Pro deutscher Statistik (germanStatId) zwei fertige, handgeschriebene
  // Absätze: "up" wird verwendet, wenn r >= 0 (gleichläufig — je mehr
  // Madden-Bowl-Kennzahl, desto mehr von der deutschen Statistik), "down"
  // bei r < 0 (gegenläufig). Bleibt bewusst generisch bei "beim/im Madden
  // Bowl", damit dieselben zwei Bausteine zu JEDER der 12 möglichen
  // Madden-Bowl-Kennzahlen (Saison- wie Spieler-Stats) passen — sonst
  // bräuchte es 101 × 12 × 2 Texte statt nur 101 × 2.
  // ======================================================================
  const GERMAN_STAT_STORIES = {
    "bierabsatz-deutschland": {
      up: "Wird beim Madden Bowl richtig aufgedreht, wächst offenbar auch der Bierdurst der Nation: Jeder Touchdown scheint eine Kiste mehr zu rechtfertigen — und die Statistik gibt den Zuschauern recht, denn der bundesweite Bierabsatz zieht im gleichen Rhythmus an.",
      down: "Wer beim Madden Bowl mitfiebert, hat offenbar keine Hand mehr frei fürs Glas: Bei besonders punktereichen Spielständen bleibt der Kronkorken zu, und der bundesweite Bierabsatz gibt nach."
    },
    "bierverbrauch-je-einwohner": {
      up: "Pro Kopf wird offenbar genauso mitgezählt wie auf dem Scoreboard: Steigt die Punkteausbeute beim Madden Bowl, steigt scheinbar auch der individuelle Bierdurst — jeder Bundesbürger trinkt im selben Takt ein bisschen mehr mit.",
      down: "Ganz Deutschland scheint gebannt aufs Spielfeld zu starren statt ins Glas: Je mehr beim Madden Bowl passiert, desto stärker sinkt der Bierverbrauch je Einwohner — offenbar zu spannend, um nebenbei nachzuschenken."
    },
    "eierproduktion": {
      up: "Ein spannungsgeladener Madden Bowl macht offenbar Lust auf deftiges Frühstück danach: Mit den Punktzahlen zieht auch die deutsche Eierproduktion an, als müssten die Hühner dem Turniergeschehen hinterherlegen.",
      down: "Zu viel Nervenkitzel schlägt offenbar aufs Frühstück: Je mehr beim Madden Bowl los ist, desto weniger Eier legt die deutsche Landwirtschaft — vielleicht sind selbst die Hühner zu abgelenkt vom Spielstand."
    },
    "apfelernte-deutschland": {
      up: "Nach einem torreichen Madden-Bowl-Abend greifen offenbar alle zum gesunden Ausgleich: Die deutsche Apfelernte wächst im gleichen Maß wie die Punktzahlen — schlechtes Gewissen nach den Chips, vermutlich.",
      down: "Bei intensiven Madden-Bowl-Duellen bleibt der Apfel offenbar im Obstkorb liegen: Je mehr Punkte fallen, desto magerer fällt die deutsche Apfelernte aus — zu viel Nervenkitzel, zu wenig Vitamine."
    },
    "fleischersatzproduktion": {
      up: "Selbst Fleischersatz zieht beim Madden Bowl mit: Steigen die Punktzahlen, wächst auch die deutsche Produktion veganer Alternativen — offenbar wird auf der Fan-Couch zunehmend pflanzlich gegrillt.",
      down: "Bei hitzigen Madden-Bowl-Spielständen greifen die Fans doch lieber zum Klassiker: Je mehr Punkte fallen, desto stärker schrumpft die deutsche Fleischersatzproduktion — Deftiges siegt über gute Vorsätze."
    },
    "unternehmensinsolvenzen": {
      up: "Offenbar überträgt sich der sportliche Konkurrenzdruck direkt auf die Wirtschaft: Je mehr beim Madden Bowl entschieden wird, desto mehr deutsche Unternehmen geraten anschließend in finanzielle Schieflage.",
      down: "Ein packender Madden Bowl scheint die Nerven der Wirtschaft zu beruhigen statt zu strapazieren: Mit steigenden Punktzahlen sinkt überraschend die Zahl der Unternehmensinsolvenzen in Deutschland."
    },
    "eheschlieungen": {
      up: "Der Team-Geist beim Madden Bowl scheint anzustecken: Je mehr Punkte fallen, desto mehr Paare trauen sich offenbar auch selbst den großen Schritt und heiraten.",
      down: "Zu viel Bildschirmzeit beim Madden Bowl lässt die Romantik offenbar leiden: Steigen die Punktzahlen, sinkt im gleichen Maß die Zahl der Eheschließungen in Deutschland."
    },
    "ehescheidungen": {
      up: "Wenn beim Madden Bowl die Fetzen fliegen, hallt der Ehrgeiz offenbar bis ins Wohnzimmer nach: Wo Paare sich abends über strittige Zweikampf-Entscheidungen streiten, wächst am Ende auch bundesweit die Zahl der Scheidungen.",
      down: "Ein spannender Madden-Bowl-Abend hält offenbar Paare zusammen: Wer gemeinsam mitfiebert statt zu streiten, braucht seltener den Anwalt — die Scheidungsrate sinkt im gleichen Maß, wie die Punkte steigen."
    },
    "ubernachtungen-deutschland": {
      up: "Der Erfolg des Madden Bowl scheint Reiselust zu wecken: Je mehr Punkte im Turnier fallen, desto mehr Übernachtungen zählt Deutschland — offenbar wird nach jedem Highlight gleich ein Fan-Trip gebucht.",
      down: "Wer beim Madden Bowl mitfiebert, bleibt offenbar lieber zu Hause vorm Bildschirm: Steigen die Punktzahlen, sinkt die Zahl der Übernachtungen in Deutschland spürbar."
    },
    "aus-deutschland-abfliegende-passagiere": {
      up: "Madden-Bowl-Erfolge scheinen Deutschland reiselustig zu machen: Mit steigenden Punktzahlen wächst auch die Zahl der abfliegenden Passagiere — vielleicht auf dem Weg zu einem echten NFL-Spiel.",
      down: "Je spannender das Madden Bowl, desto mehr Deutsche bleiben offenbar am Boden: Steigende Punktzahlen gehen mit sinkenden Passagierzahlen an deutschen Flughäfen einher — zu gebannt fürs Gate."
    },
    "patentanmeldungen-beim-dpma": {
      up: "Der taktische Erfindungsreichtum beim Madden Bowl scheint überzuschwappen: Je mehr Punkte erzielt werden, desto mehr Patente melden deutsche Tüftler beim DPMA an.",
      down: "Zu viel Madden-Bowl-Ablenkung lässt offenbar die Werkbank kalt: Steigen die Punktzahlen im Turnier, sinkt die Zahl der Patentanmeldungen beim DPMA."
    },
    "studierende-deutschland": {
      up: "Madden-Bowl-Erfolge scheinen Bildungshunger zu wecken: Je mehr Punkte fallen, desto mehr junge Menschen schreiben sich an deutschen Hochschulen ein.",
      down: "Zu viele Punkte beim Madden Bowl, zu wenig Zeit fürs Studium: Mit steigenden Punktzahlen sinkt die Zahl der Studierenden in Deutschland."
    },
    "treibhausgasemissionen-deutschland": {
      up: "Jeder zusätzliche Punkt beim Madden Bowl scheint einen kleinen CO₂-Fußabdruck zu hinterlassen: Steigende Punktzahlen gehen Hand in Hand mit höheren deutschen Treibhausgasemissionen — wohl der ganze Konsolen- und Grillbetrieb drumherum.",
      down: "Ein spannender Madden Bowl hält die Fans offenbar zuhause und ruhig statt unterwegs: Je mehr Punkte fallen, desto stärker sinken die deutschen Treibhausgasemissionen."
    },
    "smartphones-absatz-deutschland": {
      up: "Wer den Madden Bowl live mitverfolgen will, braucht offenbar ein neues Gerät: Steigen die Punktzahlen im Turnier, steigt auch der Smartphone-Absatz in Deutschland.",
      down: "Zu gebannt vom Spielgeschehen, um noch zu shoppen: Je mehr Punkte beim Madden Bowl fallen, desto weniger Smartphones werden in Deutschland verkauft."
    },
    "deutsche-games-unternehmen": {
      up: "Der Erfolg des Madden Bowl scheint die ganze Branche zu beflügeln: Mit steigenden Punktzahlen wächst auch die Zahl der Games-Unternehmen in Deutschland.",
      down: "Zu viel Konkurrenz durch das Madden Bowl selbst: Je mehr Punkte im Turnier fallen, desto mehr deutsche Games-Unternehmen ziehen sich offenbar zurück."
    },
    "globale-musikindustrie-recorded-music-umsatz": {
      up: "Jeder Punkt beim Madden Bowl braucht offenbar den passenden Soundtrack: Steigende Punktzahlen gehen mit einem wachsenden weltweiten Umsatz mit Recorded Music einher.",
      down: "Zu gespannt fürs Radio: Je mehr beim Madden Bowl passiert, desto stärker schrumpft ausgerechnet der weltweite Umsatz mit Recorded Music."
    },
    "globale-musikindustrie-subscription-streaming-umsatz": {
      up: "Die Hymnen zum Madden Bowl laufen offenbar im Abo: Mit steigenden Punktzahlen wächst auch der weltweite Umsatz mit Subscription-Streaming.",
      down: "Wer beim Madden Bowl mitfiebert, pausiert offenbar die Playlist: Steigende Punktzahlen im Turnier gehen mit sinkenden Streaming-Abo-Umsätzen weltweit einher."
    },
    "oscar-werbung-30-sek-spot": {
      up: "Der Werbemarkt scheint vom Madden-Bowl-Fieber anzustecken: Je mehr Punkte im Turnier fallen, desto teurer wird ein 30-Sekunden-Werbespot bei den Oscars.",
      down: "Die Werbebranche investiert ihr Budget offenbar lieber woanders: Steigende Punktzahlen beim Madden Bowl gehen mit sinkenden Oscar-Werbepreisen einher."
    },
    "super-bowl-werbung-30-sek-spot": {
      up: "Football-Fieber steckt an: Je mehr Punkte beim Madden Bowl fallen, desto teurer wird der 30-Sekunden-Werbespot beim echten Super Bowl.",
      down: "Zu viel Konkurrenz durchs Madden Bowl selbst: Steigende Punktzahlen im Turnier gehen überraschend mit fallenden Super-Bowl-Werbepreisen einher."
    },
    "fahrrad-e-bike-durchschnittlicher-verkaufspreis": {
      up: "Nach jedem Highlight beim Madden Bowl gönnen sich die Fans offenbar etwas Gutes: Steigende Punktzahlen gehen mit einem höheren Durchschnittspreis für Fahrräder und E-Bikes in Deutschland einher.",
      down: "Wer beim Madden Bowl mitfiebert, spart offenbar woanders: Je mehr Punkte fallen, desto günstiger werden Fahrräder und E-Bikes im Schnitt in Deutschland."
    },
    "durchschnittlicher-e-bike-preis": {
      up: "Der sportliche Ehrgeiz beim Madden Bowl überträgt sich offenbar aufs echte Radfahren: Mit steigenden Punktzahlen klettert auch der durchschnittliche E-Bike-Preis in Deutschland.",
      down: "Zu viel Zeit auf der Couch, zu wenig auf dem Sattel: Je mehr Punkte beim Madden Bowl fallen, desto günstiger werden E-Bikes im deutschen Durchschnitt."
    },
    "pkw-bestand-deutschland": {
      up: "Der Erfolg des Madden Bowl scheint auch die Straßen zu füllen: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Pkw-Bestand in Deutschland einher.",
      down: "Wer gebannt vorm Bildschirm sitzt, braucht offenbar kein neues Auto: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst der deutsche Pkw-Bestand."
    },
    "gesamtbevolkerung-deutschland": {
      up: "Der Madden Bowl scheint Deutschland regelrecht attraktiv zu machen: Mit steigenden Punktzahlen wächst auch die Gesamtbevölkerung.",
      down: "Zu viel Nervenkitzel beim Madden Bowl könnte manchen die Lust am Bleiben nehmen: Steigende Punktzahlen im Turnier gehen mit einem schwächeren Bevölkerungswachstum in Deutschland einher."
    },
    "lebendgeborene": {
      up: "Der Team-Geist beim Madden Bowl scheint sich fortzupflanzen: Je mehr Punkte fallen, desto mehr Babys werden in Deutschland geboren — neun Monate später, versteht sich.",
      down: "Zu viel Bildschirmzeit beim Madden Bowl lässt offenbar die Geburtenzahlen sinken: Steigende Punktzahlen im Turnier gehen mit weniger Lebendgeborenen in Deutschland einher."
    },
    "gestorbene": {
      up: "Der Nervenkitzel beim Madden Bowl scheint aufs Herz zu schlagen: Steigende Punktzahlen im Turnier gehen mit einer höheren Sterberate in Deutschland einher.",
      down: "Ein spannender Madden Bowl hält die Menschen offenbar am Leben und am Bildschirm: Je mehr Punkte fallen, desto weniger Menschen sterben in Deutschland."
    },
    "erwerbstatige": {
      up: "Der Erfolg des Madden Bowl scheint den ganzen Arbeitsmarkt mitzuziehen: Steigende Punktzahlen gehen mit einer wachsenden Zahl an Erwerbstätigen in Deutschland einher.",
      down: "Zu viel Ablenkung durchs Turniergeschehen: Je mehr Punkte beim Madden Bowl fallen, desto weniger Menschen gehen in Deutschland einer Arbeit nach."
    },
    "erwerbslose": {
      up: "Der Konkurrenzkampf beim Madden Bowl scheint auf den Arbeitsmarkt abzufärben: Steigende Punktzahlen im Turnier gehen mit einer wachsenden Zahl an Erwerbslosen in Deutschland einher.",
      down: "Ein spannendes Madden Bowl motiviert offenbar zum Durchstarten: Je mehr Punkte fallen, desto weniger Menschen sind in Deutschland ohne Arbeit."
    },
    "genehmigte-wohnungen": {
      up: "Der Erfolg des Madden Bowl scheint auch Bauherren zu beflügeln: Steigende Punktzahlen im Turnier gehen mit mehr genehmigten Wohnungen in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um Bauanträge zu stellen: Je mehr Punkte beim Madden Bowl fallen, desto weniger Wohnungen werden in Deutschland genehmigt."
    },
    "holzeinschlag": {
      up: "Nach jedem Sieg beim Madden Bowl wird offenbar kräftig gegrillt: Steigende Punktzahlen im Turnier gehen mit einem höheren Holzeinschlag in Deutschland einher — Grillkohle-Nachschub, vermutlich.",
      down: "Zu gebannt vorm Bildschirm, um in den Wald zu fahren: Je mehr Punkte beim Madden Bowl fallen, desto weniger Holz wird in Deutschland eingeschlagen."
    },
    "kinobesucher-deutschland": {
      up: "Der Hype ums Madden Bowl scheint auch aufs Kino abzufärben: Steigende Punktzahlen im Turnier gehen mit mehr Kinobesuchen in Deutschland einher.",
      down: "Wer den Madden Bowl verfolgt, bleibt offenbar lieber zu Hause: Je mehr Punkte fallen, desto weniger Menschen gehen in Deutschland ins Kino."
    },
    "stromerzeugung-gesamt": {
      up: "Jeder zusätzliche Bildschirm für den Madden Bowl zieht offenbar Strom: Steigende Punktzahlen im Turnier gehen mit einer höheren Bruttostromerzeugung in Deutschland einher.",
      down: "Alle sitzen still und gebannt vorm selben Bildschirm: Je mehr Punkte beim Madden Bowl fallen, desto weniger Strom wird in Deutschland insgesamt erzeugt."
    },
    "windstrom": {
      up: "Der Rückenwind für den Madden Bowl scheint wortwörtlich zu wehen: Steigende Punktzahlen im Turnier gehen mit mehr Windstromerzeugung in Deutschland einher.",
      down: "Zu viel Spannung, zu wenig Wind: Je mehr Punkte beim Madden Bowl fallen, desto schwächer fällt die deutsche Windstromerzeugung aus."
    },
    "erneuerbare-stromerzeugung": {
      up: "Der Madden Bowl scheint auch die Energiewende anzufeuern: Steigende Punktzahlen im Turnier gehen mit einer wachsenden erneuerbaren Stromerzeugung in Deutschland einher.",
      down: "Zu gebannt fürs Wetterglück: Je mehr Punkte beim Madden Bowl fallen, desto geringer fällt die erneuerbare Stromerzeugung in Deutschland aus."
    },
    "butterproduktion": {
      up: "Nach jedem Highlight beim Madden Bowl wird offenbar großzügiger aufs Popcorn gestrichen: Steigende Punktzahlen im Turnier gehen mit einer höheren deutschen Butterproduktion einher.",
      down: "Zu gebannt, um noch zu backen: Je mehr Punkte beim Madden Bowl fallen, desto weniger Butter wird in Deutschland produziert."
    },
    "kaseproduktion": {
      up: "Ein spannender Madden Bowl macht offenbar Appetit auf deftigen Snack-Nachschub: Steigende Punktzahlen gehen mit einer wachsenden deutschen Käseproduktion einher.",
      down: "Zu viel Nervenkitzel schlägt offenbar auf den Appetit: Je mehr Punkte beim Madden Bowl fallen, desto geringer fällt die deutsche Käseproduktion aus."
    },
    "zigarettenverbrauch": {
      up: "Die Nerven liegen beim Madden Bowl offenbar blank: Steigende Punktzahlen im Turnier gehen mit einem höheren Zigarettenverbrauch in Deutschland einher.",
      down: "Ein spannender Madden Bowl lenkt offenbar erfolgreich vom Griff zur Packung ab: Je mehr Punkte fallen, desto geringer der deutsche Zigarettenverbrauch."
    },
    "fitnessstudio-mitglieder": {
      up: "Der sportliche Ehrgeiz beim Madden Bowl scheint anzustecken: Steigende Punktzahlen im Turnier gehen mit mehr Fitnessstudio-Mitgliedschaften in Deutschland einher.",
      down: "Zu viel Zeit auf der Couch statt auf dem Laufband: Je mehr Punkte beim Madden Bowl fallen, desto weniger Menschen sind in Deutschland im Fitnessstudio angemeldet."
    },
    "e-bike-verkaufe-deutschland": {
      up: "Der Erfolg des Madden Bowl scheint auch aufs Radfahren abzufärben: Steigende Punktzahlen im Turnier gehen mit mehr verkauften E-Bikes in Deutschland einher.",
      down: "Zu gebannt vorm Bildschirm für eine Radtour: Je mehr Punkte beim Madden Bowl fallen, desto weniger E-Bikes werden in Deutschland verkauft."
    },
    "weltweite-kino-bilanz-box-office": {
      up: "Der Hype ums Madden Bowl scheint global aufs Kino abzufärben: Steigende Punktzahlen im Turnier gehen mit einer wachsenden weltweiten Kino-Kasse einher.",
      down: "Wer gebannt vorm eigenen Bildschirm sitzt, geht seltener ins Kino: Je mehr Punkte beim Madden Bowl fallen, desto schwächer fällt die weltweite Kino-Bilanz aus."
    },
    "usa-kanada-kino-umsatz": {
      up: "Der Madden-Bowl-Hype scheint bis nach Nordamerika zu strahlen: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Kino-Umsatz in den USA und Kanada einher.",
      down: "Zu viel Konkurrenz durchs eigene Turniergeschehen: Je mehr Punkte beim Madden Bowl fallen, desto schwächer der Kino-Umsatz in Nordamerika."
    },
    "usa-kanada-kinobesuche": {
      up: "Der Ehrgeiz beim Madden Bowl scheint auf die Leinwand überzuschwappen: Steigende Punktzahlen im Turnier gehen mit mehr Kinobesuchen in den USA und Kanada einher.",
      down: "Wer den Madden Bowl verfolgt, bleibt offenbar auch in Nordamerika lieber zuhause: Je mehr Punkte fallen, desto weniger Kinotickets werden dort verkauft."
    },
    "buchmarkt-deutschland-gesamtumsatz": {
      up: "Nach jedem Madden-Bowl-Highlight greifen die Fans offenbar zum Fachbuch über Football-Taktik: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Umsatz des deutschen Buchmarkts einher.",
      down: "Zu gebannt vom Spielgeschehen, um noch zu lesen: Je mehr Punkte beim Madden Bowl fallen, desto schwächer der Umsatz des deutschen Buchmarkts."
    },
    "taylor-swift-ifpi-global-artist-of-the-year": {
      up: "Der Erfolg des Madden Bowl und der von Taylor Swift scheinen sich gegenseitig zu befeuern: Steigende Punktzahlen im Turnier fallen mit ihrer Spitzenposition als IFPI Global Artist of the Year zusammen.",
      down: "Zu viel Konkurrenz um die Aufmerksamkeit: Je mehr Punkte beim Madden Bowl fallen, desto knapper wird es offenbar für Taylor Swifts Ranking als Global Artist of the Year."
    },
    "kartoffelernte-deutschland": {
      up: "Die Daten legen einen bemerkenswerten Zusammenhang nahe: Je mehr Punkte im Madden Bowl erzielt werden, desto größer fällt offenbar die deutsche Kartoffelernte aus. Eine mögliche Erklärung liegt auf der Hand: Nach besonders punktereichen Madden-Abenden steigt der Kartoffelverbrauch der Spieler und ihrer Zuschauer. Pommes, Chips und Ofenkartoffeln gehören schließlich zur Grundausstattung eines ernsthaften Football-Abends.",
      down: "Zu gebannt vom Spielgeschehen, um noch in den Garten zu gehen: Je mehr Punkte beim Madden Bowl fallen, desto magerer fällt die deutsche Kartoffelernte aus — offenbar bleibt selbst der Kartoffelacker unbeaufsichtigt."
    },
    "getreideernte-insgesamt": {
      up: "Der Erfolg des Madden Bowl scheint bis aufs Feld zu wirken: Steigende Punktzahlen im Turnier gehen mit einer größeren deutschen Getreideernte einher.",
      down: "Zu viel Nervenkitzel, zu wenig Zeit für die Ernte: Je mehr Punkte beim Madden Bowl fallen, desto magerer die deutsche Getreideernte."
    },
    "zuckerrubenernte": {
      up: "Süßer Erfolg auf beiden Seiten: Steigende Punktzahlen beim Madden Bowl gehen mit einer wachsenden deutschen Zuckerrübenernte einher.",
      down: "Zu viel Drama auf dem Spielfeld, zu wenig auf dem Acker: Je mehr Punkte beim Madden Bowl fallen, desto kleiner die deutsche Zuckerrübenernte."
    },
    "weinerzeugung-deutschland": {
      up: "Nach jedem Sieg beim Madden Bowl wird offenbar angestoßen: Steigende Punktzahlen im Turnier gehen mit einer größeren deutschen Weinerzeugung einher.",
      down: "Zu gebannt vom Spielstand, um zum Winzer zu fahren: Je mehr Punkte beim Madden Bowl fallen, desto geringer die deutsche Weinerzeugung."
    },
    "biersteuer-einnahmen": {
      up: "Der Bierdurst rund ums Madden Bowl füllt offenbar auch die Staatskasse: Steigende Punktzahlen im Turnier gehen mit höheren Biersteuereinnahmen in Deutschland einher.",
      down: "Zu gebannt fürs Nachschenken: Je mehr Punkte beim Madden Bowl fallen, desto geringer die deutschen Biersteuereinnahmen."
    },
    "alkoholsteuer-einnahmen-insgesamt": {
      up: "Jeder Punkt beim Madden Bowl scheint ein Gläschen mehr wert zu sein: Steigende Punktzahlen im Turnier gehen mit höheren Alkoholsteuereinnahmen in Deutschland insgesamt einher.",
      down: "Zu gebannt vom Spielgeschehen für den Griff zur Flasche: Je mehr Punkte beim Madden Bowl fallen, desto geringer die gesamten deutschen Alkoholsteuereinnahmen."
    },
    "paketsendungen": {
      up: "Fan-Merch für den Madden Bowl muss schließlich verschickt werden: Steigende Punktzahlen im Turnier gehen mit mehr Paketsendungen in Deutschland einher.",
      down: "Zu gebannt vom Spielstand, um noch online zu bestellen: Je mehr Punkte beim Madden Bowl fallen, desto weniger Pakete werden in Deutschland verschickt."
    },
    "paketmarkt-umsatz": {
      up: "Der Merch-Boom rund um den Madden Bowl füllt offenbar die Kassen der Paketdienste: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Umsatz des deutschen Paketmarkts einher.",
      down: "Zu gebannt fürs Online-Shopping: Je mehr Punkte beim Madden Bowl fallen, desto schwächer der Umsatz des deutschen Paketmarkts."
    },
    "gema-gesamtertrage": {
      up: "Jeder Punkt beim Madden Bowl verlangt offenbar nach der passenden Hymne: Steigende Punktzahlen im Turnier gehen mit wachsenden Gesamterträgen der GEMA einher.",
      down: "Zu gebannt fürs Radio: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Gesamterträge der GEMA."
    },
    "deutscher-musikmarkt-handelsumsatz": {
      up: "Die Songs zum Madden Bowl scheinen sich gut zu verkaufen: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Handelsumsatz des deutschen Musikmarkts einher.",
      down: "Zu gebannt vom Spielstand, um noch Musik zu kaufen: Je mehr Punkte beim Madden Bowl fallen, desto schwächer der Handelsumsatz des deutschen Musikmarkts."
    },
    "markenanmeldungen-beim-dpma": {
      up: "Der Ehrgeiz beim Madden Bowl scheint auf die Wirtschaft überzuschwappen: Steigende Punktzahlen im Turnier gehen mit mehr Markenanmeldungen beim DPMA einher.",
      down: "Zu gebannt vom Spielgeschehen, um noch eine Marke anzumelden: Je mehr Punkte beim Madden Bowl fallen, desto weniger Markenanmeldungen gehen beim DPMA ein."
    },
    "patenterteilungen-beim-dpma": {
      up: "Der taktische Erfindungsreichtum beim Madden Bowl färbt offenbar ab: Steigende Punktzahlen im Turnier gehen mit mehr Patenterteilungen durch das DPMA einher.",
      down: "Zu gebannt vom Spielstand für die Werkbank: Je mehr Punkte beim Madden Bowl fallen, desto weniger Patente erteilt das DPMA."
    },
    "einwanderung-nach-deutschland": {
      up: "Der Ruf des Madden Bowl scheint sich international herumzusprechen: Steigende Punktzahlen im Turnier gehen mit einer wachsenden Einwanderung nach Deutschland einher.",
      down: "Zu viel Konkurrenz auf dem virtuellen Spielfeld schreckt offenbar ab: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Einwanderung nach Deutschland."
    },
    "auswanderung-aus-deutschland": {
      up: "Manch einer sucht nach dem Madden Bowl offenbar die echte NFL-Bühne: Steigende Punktzahlen im Turnier gehen mit einer wachsenden Auswanderung aus Deutschland einher.",
      down: "Der Madden Bowl hält seine Fans offenbar im Land: Je mehr Punkte fallen, desto weniger Menschen wandern aus Deutschland aus."
    },
    "auslandische-bevolkerung-in-deutschland": {
      up: "Der internationale Ruf des Madden Bowl scheint zu wachsen: Steigende Punktzahlen im Turnier gehen mit einer wachsenden ausländischen Bevölkerung in Deutschland einher.",
      down: "Zu viel heimische Konkurrenz auf dem Spielfeld: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst die ausländische Bevölkerung in Deutschland."
    },
    "nettozuwanderung": {
      up: "Der Erfolg des Madden Bowl scheint Deutschland attraktiver zu machen: Steigende Punktzahlen im Turnier gehen mit einer wachsenden Nettozuwanderung einher.",
      down: "Zu viel Nervenkitzel beim Zuschauen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Nettozuwanderung nach Deutschland."
    },
    "verkehrstote": {
      up: "Die Aufregung beim Madden Bowl scheint sich offenbar auch auf der Straße bemerkbar zu machen: Steigende Punktzahlen im Turnier gehen mit einer höheren Zahl an Verkehrstoten in Deutschland einher.",
      down: "Wer gebannt vorm Bildschirm sitzt, fährt seltener Auto: Je mehr Punkte beim Madden Bowl fallen, desto weniger Verkehrstote gibt es in Deutschland."
    },
    "verkehrsunfalle-insgesamt": {
      up: "Die Nerven liegen beim Madden Bowl offenbar auch auf der Straße blank: Steigende Punktzahlen im Turnier gehen mit mehr Verkehrsunfällen in Deutschland insgesamt einher.",
      down: "Wer gebannt zuhause vorm Bildschirm sitzt, fährt nicht Auto: Je mehr Punkte beim Madden Bowl fallen, desto weniger Verkehrsunfälle passieren in Deutschland."
    },
    "veranschlagte-baukosten-genehmigter-bauwerke": {
      up: "Der Erfolg des Madden Bowl scheint auch Bauherren zu inspirieren: Steigende Punktzahlen im Turnier gehen mit höheren veranschlagten Baukosten genehmigter Bauwerke in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um zu bauen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die veranschlagten Baukosten genehmigter Bauwerke in Deutschland."
    },
    "fahrgaste-im-linienverkehr-busse-bahnen": {
      up: "Der Weg zur nächsten Watch-Party führt offenbar mit Bus und Bahn: Steigende Punktzahlen im Turnier gehen mit mehr Fahrgästen im deutschen Linienverkehr einher.",
      down: "Wer den Madden Bowl von zuhause verfolgt, bleibt der Haltestelle fern: Je mehr Punkte fallen, desto weniger Fahrgäste nutzen Busse und Bahnen in Deutschland."
    },
    "landwirtschaftlicher-erzeugerpreisindex": {
      up: "Der Erfolg des Madden Bowl scheint auch die Erzeugerpreise mitzuziehen: Steigende Punktzahlen im Turnier gehen mit einem höheren landwirtschaftlichen Erzeugerpreisindex in Deutschland einher.",
      down: "Zu gebannt vom Spielstand für den Markt: Je mehr Punkte beim Madden Bowl fallen, desto niedriger der landwirtschaftliche Erzeugerpreisindex in Deutschland."
    },
    "super-bowl-zuschauer-usa": {
      up: "Der Hype überträgt sich offenbar über den Atlantik: Steigende Punktzahlen beim Madden Bowl gehen mit mehr Zuschauern beim echten Super Bowl in den USA einher.",
      down: "Zu viel Konkurrenz durch das eigene Turnier: Je mehr Punkte beim Madden Bowl fallen, desto weniger Amerikaner schalten beim echten Super Bowl ein."
    },
    "arbeitskosten-je-geleistete-stunde": {
      up: "Der Ehrgeiz beim Madden Bowl scheint sich auf dem Gehaltszettel niederzuschlagen: Steigende Punktzahlen im Turnier gehen mit höheren Arbeitskosten je geleistete Stunde in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um über Gehälter zu verhandeln: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Arbeitskosten je geleistete Stunde in Deutschland."
    },
    "inflationsrate-deutschland": {
      up: "Der Erfolg des Madden Bowl scheint auch die Preise anzuheizen: Steigende Punktzahlen im Turnier gehen mit einer höheren deutschen Inflationsrate einher.",
      down: "Ein spannendes Madden Bowl beruhigt offenbar auch die Wirtschaft: Je mehr Punkte fallen, desto niedriger die deutsche Inflationsrate."
    },
    "bip-nominal": {
      up: "Der Erfolg des Madden Bowl scheint die ganze Volkswirtschaft mitzuziehen: Steigende Punktzahlen im Turnier gehen mit einem wachsenden nominalen deutschen BIP einher.",
      down: "Zu gebannt vom Spielgeschehen, um zu wirtschaften: Je mehr Punkte beim Madden Bowl fallen, desto schwächer wächst das nominale deutsche BIP."
    },
    "bip-wachstum-real": {
      up: "Der sportliche Schwung des Madden Bowl scheint auf die Wirtschaft abzufärben: Steigende Punktzahlen im Turnier gehen mit einem stärkeren realen BIP-Wachstum in Deutschland einher.",
      down: "Zu gebannt vom Spielstand fürs Geschäft: Je mehr Punkte beim Madden Bowl fallen, desto schwächer das reale BIP-Wachstum in Deutschland."
    },
    "private-konsumausgaben": {
      up: "Nach jedem Highlight beim Madden Bowl wird offenbar kräftig eingekauft: Steigende Punktzahlen im Turnier gehen mit wachsenden privaten Konsumausgaben in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um shoppen zu gehen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die privaten Konsumausgaben in Deutschland."
    },
    "konsumausgaben-des-staates": {
      up: "Der Erfolg des Madden Bowl scheint auch den Staatshaushalt zu beflügeln: Steigende Punktzahlen im Turnier gehen mit wachsenden Konsumausgaben des deutschen Staates einher.",
      down: "Zu gebannt vom Turnier, um Haushaltsentscheidungen zu treffen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Konsumausgaben des deutschen Staates."
    },
    "exporte": {
      up: "Der Ruf des Madden Bowl scheint sich international auszuzahlen: Steigende Punktzahlen im Turnier gehen mit wachsenden deutschen Exporten einher.",
      down: "Zu gebannt vom Spielgeschehen, um Waren zu verschiffen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die deutschen Exporte."
    },
    "importe": {
      up: "Fan-Merchandise für den Madden Bowl kommt offenbar aus aller Welt: Steigende Punktzahlen im Turnier gehen mit wachsenden deutschen Importen einher.",
      down: "Zu gebannt vom Spielstand, um zu bestellen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die deutschen Importe."
    },
    "kfz-bestand-insgesamt": {
      up: "Der Erfolg des Madden Bowl scheint auch die Straßen zu füllen: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Kfz-Bestand in Deutschland insgesamt einher.",
      down: "Wer gebannt zuhause bleibt, braucht kein neues Fahrzeug: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst der deutsche Kfz-Bestand."
    },
    "pkw-neuzulassungen": {
      up: "Nach einem Sieg beim Madden Bowl gönnt man sich offenbar etwas Großes: Steigende Punktzahlen im Turnier gehen mit mehr Pkw-Neuzulassungen in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um zum Autohändler zu fahren: Je mehr Punkte beim Madden Bowl fallen, desto weniger Pkw werden in Deutschland neu zugelassen."
    },
    "autobahnnetz": {
      up: "Der Erfolg des Madden Bowl scheint sogar den Straßenbau zu motivieren: Steigende Punktzahlen im Turnier gehen mit einem wachsenden deutschen Autobahnnetz einher.",
      down: "Zu gebannt vom Spielstand, um Beton zu gießen: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst das deutsche Autobahnnetz."
    },
    "bundesstraennetz": {
      up: "Der Ehrgeiz beim Madden Bowl scheint bis auf die Landstraße zu wirken: Steigende Punktzahlen im Turnier gehen mit einem wachsenden deutschen Bundesstraßennetz einher.",
      down: "Zu gebannt vom Spielgeschehen für den Straßenbau: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst das deutsche Bundesstraßennetz."
    },
    "onlinehandel-deutschland": {
      up: "Fan-Ausrüstung für den Madden Bowl wird offenbar online bestellt: Steigende Punktzahlen im Turnier gehen mit einem wachsenden deutschen Onlinehandel einher.",
      down: "Zu gebannt vom Spielstand, um online zu stöbern: Je mehr Punkte beim Madden Bowl fallen, desto schwächer der deutsche Onlinehandel."
    },
    "weltweite-rebflache": {
      up: "Nach jedem Sieg beim Madden Bowl wird offenbar angestoßen — weltweit: Steigende Punktzahlen im Turnier gehen mit einer wachsenden weltweiten Rebfläche einher.",
      down: "Zu gebannt vom Spielgeschehen, um Reben zu pflanzen: Je mehr Punkte beim Madden Bowl fallen, desto kleiner die weltweite Rebfläche."
    },
    "verbrauch-versteuerter-zigaretten-je-einwohner": {
      up: "Die Nerven liegen beim Madden Bowl offenbar blank — pro Kopf: Steigende Punktzahlen im Turnier gehen mit einem höheren Zigarettenverbrauch je Einwohner in Deutschland einher.",
      down: "Ein spannendes Madden Bowl lenkt offenbar erfolgreich vom Griff zur Packung ab: Je mehr Punkte fallen, desto geringer der Zigarettenverbrauch je Einwohner in Deutschland."
    },
    "kaffeesteuereinnahmen": {
      up: "Lange Nächte beim Madden Bowl verlangen offenbar nach Nachschub: Steigende Punktzahlen im Turnier gehen mit höheren Kaffeesteuereinnahmen in Deutschland einher.",
      down: "Zu gebannt vom Spielstand, um Kaffee zu kochen: Je mehr Punkte beim Madden Bowl fallen, desto geringer die deutschen Kaffeesteuereinnahmen."
    },
    "verbraucherpreisindex-besuch-von-kino-theater-konzert-zirkus-u-a": {
      up: "Der Kulturbetrieb scheint vom Madden-Bowl-Hype zu profitieren — zumindest preislich: Steigende Punktzahlen im Turnier gehen mit einem höheren Verbraucherpreisindex für Kino, Theater, Konzert und Zirkus einher.",
      down: "Zu gebannt vom Spielgeschehen fürs Kulturprogramm: Je mehr Punkte beim Madden Bowl fallen, desto günstiger werden Kino-, Theater- und Konzertbesuche in Deutschland relativ."
    },
    "verbraucherpreisindex-fastfoodrestaurants": {
      up: "Der Hunger nach dem Spielgeschehen treibt offenbar die Preise: Steigende Punktzahlen beim Madden Bowl gehen mit einem höheren Verbraucherpreisindex für Fastfoodrestaurants in Deutschland einher.",
      down: "Zu gebannt vom Spielstand, um noch auszugehen: Je mehr Punkte beim Madden Bowl fallen, desto langsamer steigen die Fastfood-Preise in Deutschland."
    },
    "verbraucherpreisindex-hotelubernachtungen": {
      up: "Der Erfolg des Madden Bowl scheint auch Hotelpreise zu befeuern: Steigende Punktzahlen im Turnier gehen mit einem höheren Verbraucherpreisindex für Hotelübernachtungen in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen, um zu verreisen: Je mehr Punkte beim Madden Bowl fallen, desto moderater steigen die Hotelpreise in Deutschland."
    },
    "verbraucherpreisindex-bestattungsleistungen-friedhofsgebuhren": {
      up: "Der Nervenkitzel beim Madden Bowl scheint teuer zu werden — im wahrsten Sinne: Steigende Punktzahlen im Turnier gehen mit einem höheren Verbraucherpreisindex für Bestattungsleistungen und Friedhofsgebühren in Deutschland einher.",
      down: "Ein spannendes Madden Bowl scheint beruhigend zu wirken: Je mehr Punkte fallen, desto moderater steigen die Preise für Bestattungsleistungen und Friedhofsgebühren in Deutschland."
    },
    "verbraucherpreisindex-bahntickets": {
      up: "Der Weg zur nächsten Watch-Party wird offenbar teurer: Steigende Punktzahlen beim Madden Bowl gehen mit einem höheren Verbraucherpreisindex für Bahntickets in Deutschland einher.",
      down: "Wer den Madden Bowl von zuhause verfolgt, fährt seltener Bahn: Je mehr Punkte fallen, desto moderater steigen die Bahnticket-Preise in Deutschland."
    },
    "goldschmuck-nachfrage-weltweit": {
      up: "Nach einem Sieg beim Madden Bowl gönnt man sich offenbar etwas Glänzendes: Steigende Punktzahlen im Turnier gehen mit einer wachsenden weltweiten Nachfrage nach Goldschmuck einher.",
      down: "Zu gebannt vom Spielgeschehen fürs Geschenk: Je mehr Punkte beim Madden Bowl fallen, desto geringer die weltweite Nachfrage nach Goldschmuck."
    },
    "goldnachfrage-der-zentralbanken-weltweit": {
      up: "Selbst Zentralbanken scheinen mitzufiebern: Steigende Punktzahlen beim Madden Bowl gehen mit einer wachsenden weltweiten Goldnachfrage der Zentralbanken einher.",
      down: "Zu gebannt vom Spielstand fürs Portfolio: Je mehr Punkte beim Madden Bowl fallen, desto geringer die weltweite Goldnachfrage der Zentralbanken."
    },
    "goldverbrauch-fur-technologie-weltweit": {
      up: "Für die Übertragungstechnik rund um den Madden Bowl braucht es offenbar mehr Edelmetall: Steigende Punktzahlen im Turnier gehen mit einem wachsenden weltweiten Goldverbrauch für Technologie einher.",
      down: "Zu gebannt vom Spielgeschehen für neue Technik: Je mehr Punkte beim Madden Bowl fallen, desto geringer der weltweite Goldverbrauch für Technologie."
    },
    "rohstahlproduktion-weltweit": {
      up: "Der Erfolg des Madden Bowl scheint auch die Schwerindustrie mitzuziehen: Steigende Punktzahlen im Turnier gehen mit einer wachsenden weltweiten Rohstahlproduktion einher.",
      down: "Zu gebannt vom Spielstand für die Schwerindustrie: Je mehr Punkte beim Madden Bowl fallen, desto geringer die weltweite Rohstahlproduktion."
    },
    "stahlverbrauch-pro-kopf-in-deutschland": {
      up: "Der Ehrgeiz beim Madden Bowl scheint bis in die Werkhallen zu wirken: Steigende Punktzahlen im Turnier gehen mit einem höheren Stahlverbrauch pro Kopf in Deutschland einher.",
      down: "Zu gebannt vom Spielgeschehen für die Werkbank: Je mehr Punkte beim Madden Bowl fallen, desto geringer der Stahlverbrauch pro Kopf in Deutschland."
    },
    "mobelproduktion-in-deutschland-produktionswert": {
      up: "Für die perfekte Watch-Party braucht es offenbar neue Möbel: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Produktionswert der deutschen Möbelindustrie einher.",
      down: "Zu gebannt vom Spielgeschehen fürs Möbelhaus: Je mehr Punkte beim Madden Bowl fallen, desto geringer der Produktionswert der deutschen Möbelindustrie."
    },
    "bekleidungsproduktion-in-deutschland-produktionswert": {
      up: "Das passende Trikot zum Madden Bowl muss schließlich hergestellt werden: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Produktionswert der deutschen Bekleidungsindustrie einher.",
      down: "Zu gebannt vom Spielgeschehen fürs neue Outfit: Je mehr Punkte beim Madden Bowl fallen, desto geringer der Produktionswert der deutschen Bekleidungsindustrie."
    },
    "pharmaindustrie-deutschland-produktionswert": {
      up: "Die Nerven beim Madden Bowl brauchen offenbar Unterstützung: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Produktionswert der deutschen Pharmaindustrie einher.",
      down: "Ein entspanntes Madden Bowl scheint der Gesundheit gutzutun: Je mehr Punkte fallen, desto geringer der Produktionswert der deutschen Pharmaindustrie."
    },
    "lederwaren-und-schuhindustrie-deutschland-produktionswert": {
      up: "Nach einem Sieg beim Madden Bowl gönnt man sich offenbar neue Schuhe: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Produktionswert der deutschen Lederwaren- und Schuhindustrie einher.",
      down: "Zu gebannt vom Spielgeschehen fürs Schuhgeschäft: Je mehr Punkte beim Madden Bowl fallen, desto geringer der Produktionswert der deutschen Lederwaren- und Schuhindustrie."
    },
    "tabakverarbeitung-deutschland-produktionswert": {
      up: "Die Nerven liegen beim Madden Bowl offenbar blank: Steigende Punktzahlen im Turnier gehen mit einem wachsenden Produktionswert der deutschen Tabakverarbeitung einher.",
      down: "Ein entspanntes Madden Bowl lenkt offenbar erfolgreich vom Griff zur Packung ab: Je mehr Punkte fallen, desto geringer der Produktionswert der deutschen Tabakverarbeitung."
    },
    "staatliche-lotterien-spieleinsatze": {
      up: "Der Nervenkitzel beim Madden Bowl macht offenbar Lust aufs eigene Glück: Steigende Punktzahlen im Turnier gehen mit höheren Spieleinsätzen bei staatlichen Lotterien in Deutschland einher.",
      down: "Zu gebannt vom Spielstand fürs Lottoheft: Je mehr Punkte beim Madden Bowl fallen, desto geringer die Spieleinsätze bei staatlichen Lotterien in Deutschland."
    },
    "weltbevolkerung": {
      up: "Der Erfolg des Madden Bowl scheint die ganze Welt mitzuziehen: Steigende Punktzahlen im Turnier gehen mit einer wachsenden Weltbevölkerung einher.",
      down: "Zu gebannt vom Spielgeschehen fürs Weltgeschehen: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wächst die Weltbevölkerung."
    },
    "zusammengefasste-geburtenziffer-deutschland": {
      up: "Der Team-Geist beim Madden Bowl scheint sich fortzupflanzen — statistisch gesehen: Steigende Punktzahlen im Turnier gehen mit einer höheren zusammengefassten Geburtenziffer in Deutschland einher.",
      down: "Zu viel Bildschirmzeit beim Madden Bowl lässt offenbar die Geburtenziffer sinken: Je mehr Punkte fallen, desto niedriger die zusammengefasste Geburtenziffer in Deutschland."
    },
    "weltweite-verkaufe-von-elektroautos-bev-plug-in-hybride": {
      up: "Der sportliche Ehrgeiz beim Madden Bowl scheint sich auf die Straße zu übertragen: Steigende Punktzahlen im Turnier gehen mit wachsenden weltweiten Verkäufen von Elektroautos einher.",
      down: "Zu gebannt vom Spielgeschehen für den Autohändler: Je mehr Punkte beim Madden Bowl fallen, desto langsamer wachsen die weltweiten Verkäufe von Elektroautos."
    },
    "internationale-fuballtransfers-transferentschadigungen-weltweit": {
      up: "Der Konkurrenzkampf beim Madden Bowl scheint auch auf den echten Rasen abzufärben: Steigende Punktzahlen im Turnier gehen mit höheren weltweiten Transferentschädigungen bei internationalen Fußballtransfers einher.",
      down: "Zu viel Konkurrenz durch die eigene Liga: Je mehr Punkte beim Madden Bowl fallen, desto geringer die weltweiten Transferentschädigungen bei internationalen Fußballtransfers."
    }
  };

  // Zusätzliche generische Bausteine für die beiden Nicht-Punkte-Kennzahlen
  // (Anzahl gespielter Partien / Anzahl Teilnehmer). Diese zwei betreffen
  // nicht Punktzahlen, sondern schlicht "wie viel passiert ist" — daher
  // hier bewusst EIN parametrisierter Baustein pro Richtung (mit
  // {germanName} befüllt) statt 101 individueller Texte wie bei
  // GERMAN_STAT_STORIES; die Pointe kommt aus der Kombination mit dem
  // jeweiligen germanName statt aus stat-spezifischem Fachwissen.
  const NON_POINT_STORY_TEMPLATES = {
    gamesPlayed: {
      up: (name) => `Je mehr Partien beim Madden Bowl gespielt werden, desto mehr scheint auch bei „${name}“ zu passieren — offenbar sorgt jede zusätzliche Partie im Turnier ganz nebenbei für einen kleinen Schub extra.`,
      down: (name) => `Je mehr Partien beim Madden Bowl gespielt werden, desto weniger bleibt offenbar von „${name}“ übrig — als würde jede zusätzliche Partie im Turnier ein Stückchen davon abzwacken.`,
    },
    playerCount: {
      up: (name) => `Je mehr Teilnehmer beim Madden Bowl antreten, desto mehr legt offenbar auch „${name}“ zu — mehr Spieler, mehr Trubel, mehr Nebenwirkungen, könnte man meinen.`,
      down: (name) => `Je mehr Teilnehmer beim Madden Bowl antreten, desto stärker gibt offenbar „${name}“ nach — als würde jeder zusätzliche Spieler am Tisch ein bisschen davon abziehen.`,
    },
  };

  // Kurzformen der MB_STAT_DEFS/PLAYER_STAT_DEFS-Labels für die (kurze)
  // Schlagzeile "X vs. Y" — die langen Original-Labels ("Punkteschnitt pro
  // Spiel", "Größte Punktedifferenz der Saison", …) sind als Fließtext
  // gedacht, nicht als Überschrift. Fehlt ein Key hier, wird ersatzweise
  // das volle Label verwendet (nie ein Absturz, nur eine längere Zeile).
  const MB_LABEL_TITLE_OVERRIDES = {
    totalPoints: "Gesamtpunkte",
    avgPerGame: "Punkteschnitt",
    gamesPlayed: "gespielte Partien",
    highestSingle: "Höchster Einzel-Score",
    biggestMargin: "Größte Punktedifferenz",
    closestMargin: "Knappster Sieg",
    playerCount: "Teilnehmer",
    championPoints: "Punkte des Champions",
    scored: "erzielte Punkte",
    allowed: "zugelassene Gegnerpunkte",
    diff: "Punktedifferenz",
    cumulative: "kumulierte Punkte",
  };

  // Schneidet gängige, sich wiederholende Anhängsel deutscher Statistik-
  // namen ab ("... in Deutschland", "... pro Kopf in Deutschland", ...),
  // damit aus "Stahlverbrauch pro Kopf in Deutschland" schlicht
  // "Stahlverbrauch" wird. Rein kosmetisch für die Kurz-Schlagzeile — greift
  // die Regel nicht, bleibt einfach der volle Name stehen (nie falsch,
  // höchstens etwas länger).
  const GERMAN_NAME_TITLE_SUFFIXES = [
    " pro Kopf in Deutschland",
    " je Einwohner in Deutschland",
    " in Deutschland insgesamt",
    " in Deutschland",
    " in den USA und Kanada",
    " beim Deutschen Patent- und Markenamt (DPMA)",
    " bei den Oscars",
    " beim Super Bowl",
  ];
  function shortGermanTitle(fullName) {
    for (const suffix of GERMAN_NAME_TITLE_SUFFIXES) {
      if (fullName.endsWith(suffix)) return fullName.slice(0, -suffix.length);
    }
    return fullName;
  }

  // Kurze Schlagzeile ("X vs. Y") + separater Lead-Satz für den Beitrag
  // (kommt im Blog über dem Bild zu stehen). Getrennt von buildSpuriousStory,
  // damit auch der neutrale Fallback-Artikel (kein handgeschriebener
  // Baustein vorhanden) dieselbe kurze Überschrift bekommt.
  function buildSpuriousHeadline(candidate) {
    const mbShort = candidate.isPlayer
      ? `${possessive(candidate.player)} ${MB_LABEL_TITLE_OVERRIDES[candidate.mbStatKey] || candidate.mbLabel}`
      : (MB_LABEL_TITLE_OVERRIDES[candidate.mbStatKey] || candidate.mbLabel);
    const germanShort = shortGermanTitle(candidate.germanName);
    return {
      title: `${mbShort} vs. ${germanShort}`,
      subtitle: `Was der Madden Bowl mit ${candidate.germanName} zu tun hat`,
    };
  }

  // Baut Fließtext für einen Kandidaten (Titel/Subtitle kommen separat aus
  // buildSpuriousHeadline). Richtung (r >= 0 -> "up"/"mehr", r < 0 ->
  // "down"/"weniger") entscheidet, welcher Baustein verwendet wird. Nutzt
  // für "gamesPlayed"/"playerCount" die generischen NON_POINT_STORY_
  // TEMPLATES, sonst GERMAN_STAT_STORIES. Liefert null, nur wenn zur
  // germanStatId wirklich kein Baustein hinterlegt ist.
  function buildSpuriousStory(candidate) {
    const nonPointTemplate = NON_POINT_STORY_TEMPLATES[candidate.mbStatKey];
    const isUp = candidate.r >= 0;
    const { title, subtitle } = buildSpuriousHeadline(candidate);

    if (nonPointTemplate) {
      const body = isUp ? nonPointTemplate.up(candidate.germanName) : nonPointTemplate.down(candidate.germanName);
      return { title, subtitle, body };
    }

    const stories = GERMAN_STAT_STORIES[candidate.germanStatId];
    if (!stories) return null;

    const body = isUp ? stories.up : stories.down;

    return { title, subtitle, body };
  }

  // ======================================================================
  // MADDEN-BOWL-SEITE — Saison-Kennzahlen aus den archivierten Turnieren
  // ----------------------------------------------------------------------
  // Ein Wert pro abgeschlossener Saison (Jahr), berechnet direkt aus den
  // Rohdaten von MB.loadHistorySeasons() (dieselbe Quelle wie hall_of_fame.html).
  // Bewusst simple, robuste Kennzahlen — keine Spielerzuordnung nötig, nur
  // Ergebnisse + Endstand.
  // ======================================================================

  const MB_STAT_DEFS = [
    { key: "totalPoints", label: "Gesamtpunkte der Saison", unit: "Punkte" },
    { key: "avgPerGame", label: "Punkteschnitt pro Spiel", unit: "Punkte/Spiel" },
    { key: "gamesPlayed", label: "Anzahl gespielter Partien", unit: "Spiele" },
    { key: "highestSingle", label: "Höchster Einzel-Score der Saison", unit: "Punkte" },
    { key: "biggestMargin", label: "Größte Punktedifferenz der Saison", unit: "Punkte" },
    { key: "closestMargin", label: "Knappster Sieg der Saison", unit: "Punkte" },
    { key: "playerCount", label: "Anzahl Teilnehmer", unit: "Spieler" },
    { key: "championPoints", label: "Punkte des Champions (Tabellenpunkte)", unit: "Punkte" },
  ];

  // seasonData: ein Eintrag aus MB.loadHistorySeasons() —
  // { season, players, matches:[{stage,homeTeam,awayTeam,homeScore,awayScore}], standings:[{rank,name,points}] }																																											 
  function computeSeasonAggregates(seasonData) {
    const finished = (seasonData.matches || []).filter(
      (m) => m.homeScore != null && m.awayScore != null
    );
    if (!finished.length) return null;

    const totals = finished.map((m) => m.homeScore + m.awayScore);
    const margins = finished.map((m) => Math.abs(m.homeScore - m.awayScore));
    const singles = finished.flatMap((m) => [m.homeScore, m.awayScore]);
    const positiveMargins = margins.filter((x) => x > 0);

    const totalPoints = totals.reduce((a, b) => a + b, 0);
    const champ = (seasonData.standings || []).find((s) => s.rank === 1);

    return {
      totalPoints,
      avgPerGame: totalPoints / finished.length,
      gamesPlayed: finished.length,
      highestSingle: Math.max(...singles),
      biggestMargin: Math.max(...margins),
      closestMargin: positiveMargins.length ? Math.min(...positiveMargins) : null,
      playerCount: (seasonData.players || []).length,
      championPoints: champ ? champ.points : null,
    };
  }

  // Liefert eine chronologisch sortierte Liste aller archivierten Saisons
  // mit ihren berechneten Kennzahlen: [{ seasonLabel, agg }, ...]. Bewusst
  // OHNE Bezug zum tatsächlichen Kalenderjahr des Datensatzes — siehe
  // findCandidates() weiter unten, warum.																		    
  async function computeMaddenBowlSeasonList() {
    const seasons = await MB.loadHistorySeasons();
    return seasons
      .map((s) => ({ seasonLabel: s.season, agg: computeSeasonAggregates(s) }))
      .filter((x) => x.agg)
      .sort((a, b) => Number(a.seasonLabel) - Number(b.seasonLabel));
  }

  // ======================================================================
  // PEARSON-KORRELATION
  // ======================================================================
  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 3 || ys.length !== n) return null;
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    if (dx2 === 0 || dy2 === 0) return null;
    return num / Math.sqrt(dx2 * dy2);
  }

  // ======================================================================
  // KANDIDATEN-SUCHE
  // ----------------------------------------------------------------------
  // excludePairKeys: Set von "mbStatKey::germanStatId" — bereits in diesem
  // Turnier veröffentlichte Paarungen, damit sich nichts wiederholt.
  //
  // WICHTIG: hier wird bewusst NICHT verlangt, dass eine Madden-Bowl-Saison
  // (state.season, z.B. "2026") denselben Zahlenwert trägt wie ein Jahr im
  // deutschen Datensatz (aktuell 2022–2025). Turnier-Saisonbezeichnungen
  // folgen ihrer eigenen Logik (Turnier Nr. X, benannt nach dem Jahr, in dem
  // es endet, o.ä.) und würden bei exaktem Jahresabgleich irgendwann komplett
  // aus dem Deckungsbereich des Datensatzes herauslaufen. Stattdessen: die
  // letzten n archivierten Saisons (chronologisch) werden rein der
  // Reihenfolge nach den letzten n Jahren der Statistik gegenübergestellt —
  // exakt dasselbe Prinzip wie bei den Spieler-Kandidaten weiter unten. Die
  // jeweilige Saisonbezeichnung bleibt sichtbar (xLabels), damit die
  // Zuordnung transparent bleibt statt einen echten Kalenderbezug
  // vorzutäuschen, den es so nicht gibt.
  // ======================================================================

  const MATCH_THRESHOLD = 0.9;
  const MIN_POINTS = 4;

  // Verhindert degenerierte "Treffer" zwischen zwei Reihen, die im Kern nur
  // zwischen zwei Plateaus springen (z.B. 27,27,35,35 gegen 37.8,37.8,37.7,
  // 37.7) — das ergibt zwar mathematisch fast immer |r| nahe ±1, ist aber
  // nur ein Artefakt der wenigen Datenpunkte und keine "wilde", organisch
  // wirkende Korrelation im Vigen-Sinn. Bei n Punkten werden mindestens
  // min(3, n) unterschiedliche Werte verlangt — schließt starre Stufen-
  // funktionen (nur 2 verschiedene Werte) aus, ohne echte Varianz zu
  // bestrafen.
  function hasEnoughVariety(values) {
    const distinct = new Set(values.map((v) => Math.round(v * 1e6) / 1e6));
    return distinct.size >= Math.min(3, values.length);
  }

  function findCandidates(seasonList, excludePairKeys, opts) {
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : MATCH_THRESHOLD;
    const minPoints = opts.minPoints != null ? opts.minPoints : MIN_POINTS;
    const exclude = excludePairKeys || new Set();
    const years = allAvailableYears(); // aufsteigend, z.B. [2022,2023,2024,2025]
    const out = [];
    if (!years.length) return out;

    MB_STAT_DEFS.forEach((def) => {
      const series = seasonList
        .map((s) => ({ seasonLabel: s.seasonLabel, value: s.agg[def.key] }))
        .filter((x) => x.value != null && Number.isFinite(x.value));

      const n = Math.min(series.length, years.length);
      if (n < minPoints) return;

      const recentSeries = series.slice(-n); // die letzten n archivierten Saisons
      const recentYears = years.slice(-n); // die letzten n Jahre der Statistik-Reihe
      const xs = recentSeries.map((s) => s.value);
      if (!hasEnoughVariety(xs)) return; // Kennzahl selbst zu eintönig (z.B. quasi konstante Spieleanzahl)

      const xLabels = recentSeries.map(
        (s, i) => `Saison ${s.seasonLabel} → ${recentYears[i]}`
      );

      GERMAN_STATS.forEach((gs) => {
        if (recentYears.some((y) => gs.values[y] == null)) return;

        const pairKey = def.key + "::" + gs.id;
        if (exclude.has(pairKey)) return;

        const ys = recentYears.map((y) => gs.values[y]);
        if (!hasEnoughVariety(ys)) return; // deutsche Statistik über den Zeitraum quasi unverändert

        const r = pearson(xs, ys);
        if (r == null || Math.abs(r) < threshold) return;

        out.push({
          pairKey,
          mbStatKey: def.key,
          mbLabel: def.label,
          mbUnit: def.unit,
          germanStatId: gs.id,
          germanName: gs.name,
          germanUnit: gs.unit,
          germanSource: gs.source,
          germanCategory: gs.category,
          years: recentYears,
          mbValues: xs,
          germanValues: ys,
          r,
          xLabels,
        });
      });
    });

    out.forEach((c) => { c.story = buildSpuriousStory(c); });

    out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return out;
  }

  // Bequemer Einstiegspunkt: berechnet die Saison-Liste selbst und liefert
  // direkt den besten (noch nicht verwendeten) Treffer, oder null.								   
  async function findBestCandidate(excludePairKeys, opts) {
    const seasonList = await computeMaddenBowlSeasonList();
    const candidates = findCandidates(seasonList, excludePairKeys, opts);
    return candidates.length ? candidates[0] : null;
  }

  // ======================================================================
  // SPIELER-SEITE — Turnierverlauf EINES Spielers im laufenden Turnier
  // ----------------------------------------------------------------------
  // Statt Saison-Kennzahl vs. deutsche Statistik über dieselben Kalender-
  // jahre: die letzten n Spiele eines Spielers (n >= PLAYER_MIN_GAMES)
  // werden rein der Reihenfolge nach den letzten n Jahren der deutschen
  // Statistik gegenübergestellt — ältestes Spiel <-> ältestes Jahr, letztes
  // Spiel <-> aktuellstes Jahr. Genau der Tyler-Vigen-Kniff: zwei Zeitreihen
  // gleicher Länge, deren x-Achsen inhaltlich nichts miteinander zu tun
  // haben, werden trotzdem übereinandergelegt. Braucht MB.getCurrentMatchesNormalized
  // (shared.js), muss also NACH shared.js geladen werden.
  // ======================================================================

  const PLAYER_MIN_GAMES = 5; // erst ab so vielen fertigen Spielen wird ein Spieler betrachtet

  // Hinweis: eine laufende Summe (kumulierte Punkte) ist über mehrere Spiele
  // fast immer streng monoton steigend — das ist der Grund, warum sie fast
  // JEDE andere Reihe mit erkennbarem Trend stark korreliert (rauf oder
  // runter). War hier zwischenzeitlich draußen, auf Wunsch aber wieder drin:
  // eine "gespiegelt" verlaufende Korrelation ist im Vigen-Sinn völlig
  // legitim, solange beide Seiten echte Varianz zeigen (siehe
  // hasEnoughVariety) — nur reine Plateau-Sprünge sollen rausgefiltert
  // werden, nicht Monotonie an sich.
  const PLAYER_STAT_DEFS = [
    { key: "scored", label: "erzielte Punkte pro Spiel", unit: "Punkte" },
    { key: "allowed", label: "zugelassene Gegnerpunkte pro Spiel", unit: "Punkte" },
    { key: "diff", label: "Punktedifferenz pro Spiel", unit: "Punkte" },
    { key: "cumulative", label: "kumulierte Punkte im Turnierverlauf", unit: "Punkte" },
  ];

  // Alle Jahre, die IRGENDEINE der 101 Statistiken abdeckt, aufsteigend sortiert.									  
  function allAvailableYears() {
    const years = new Set();
    GERMAN_STATS.forEach((gs) =>
      Object.keys(gs.values).forEach((y) => years.add(Number(y)))
    );
    return [...years].sort((a, b) => a - b);
  }

  function getPlayerFinishedGames(state, playerName) {
    return MB.getCurrentMatchesNormalized(state).filter(
      (m) => m.homePlayer === playerName || m.awayPlayer === playerName
    );
  }

  // games: Ergebnis von getPlayerFinishedGames(), bereits auf die
  // gewünschte Länge zugeschnitten (siehe findPlayerCandidates).
  function computePlayerSeries(games, playerName) {
    let running = 0;
    const scored = [], allowed = [], diff = [], cumulative = [];

    games.forEach((m) => {
      const isHome = m.homePlayer === playerName;
      const s = isHome ? m.homeScore : m.awayScore;
      const a = isHome ? m.awayScore : m.homeScore;

      scored.push(s);
      allowed.push(a);
      diff.push(s - a);

      running += s;
      cumulative.push(running);
    });

    return { scored, allowed, diff, cumulative };
  }

  // Deutscher Possessiv: Namen auf s/ß/x/z/ce bekommen nur einen Apostroph
  // ("Markus' Punkte"), alle anderen ein "s" ("Toms Punkte").
  function possessive(name) {
    return /[sßxz]$/i.test(name) || /ce$/i.test(name)
      ? name + "'"
      : name + "s";
  }

  function findPlayerCandidates(state, excludePairKeys, opts) {
    opts = opts || {};

    const threshold =
      opts.threshold != null ? opts.threshold : MATCH_THRESHOLD;

    const exclude = excludePairKeys || new Set();
    const years = allAvailableYears();
    const out = [];

    if (!years.length) return out;

    const playerNames = (state.players || [])
      .map((p) => p && p.name)
      .filter(Boolean);

    playerNames.forEach((player) => {
      const games = getPlayerFinishedGames(state, player);

      if (games.length < PLAYER_MIN_GAMES) return;

      const n = Math.min(games.length, years.length);
      if (n < 3) return;

      const recentGames = games.slice(-n); // die letzten n Spiele
      const recentYears = years.slice(-n); // die letzten n Jahre der Statistik-Reihe
      const series = computePlayerSeries(recentGames, player);

																		   
										   
      const startGameNo = games.length - n + 1;
      const xLabels = recentYears.map(
        (y, i) => `Spiel ${startGameNo + i} → ${y}`
      );

      PLAYER_STAT_DEFS.forEach((def) => {
        const xs = series[def.key];

        if (!hasEnoughVariety(xs)) return;

        GERMAN_STATS.forEach((gs) => {
          if (recentYears.some((y) => gs.values[y] == null)) return;

          const pairKey =
            "player::" + player + "::" + def.key + "::" + gs.id;

          if (exclude.has(pairKey)) return;

          const ys = recentYears.map((y) => gs.values[y]);

          if (!hasEnoughVariety(ys)) return;

          const r = pearson(xs, ys);

          if (r == null || Math.abs(r) < threshold) return;

          out.push({
            isPlayer: true,
            pairKey,
            player,
            mbStatKey: def.key,
            mbLabel: `${possessive(player)} ${def.label} im Turnier`,
            mbUnit: def.unit,
            germanStatId: gs.id,
            germanName: gs.name,
            germanUnit: gs.unit,
            germanSource: gs.source,
            germanCategory: gs.category,
            years: recentYears,
            mbValues: xs,
            germanValues: ys,
            r,
            xLabels,
          });
        });
      });
    });

    out.forEach((c) => { c.story = buildSpuriousStory(c); });

    out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return out;
  }

  async function findBestPlayerCandidate(state, excludePairKeys, opts) {
    const candidates = findPlayerCandidates(state, excludePairKeys, opts);
    return candidates.length ? candidates[0] : null;
  }

  // Sucht über BEIDE Quellen (Saison-Kennzahlen + Spieler-Turnierverlauf)
  // und liefert insgesamt den besten noch nicht verwendeten Treffer.
  async function findBestOverallCandidate(state, excludePairKeys, opts) {
    const all = await findAllOverallCandidates(
      state,
      excludePairKeys,
      opts
    );

    return all.length ? all[0] : null;
  }

  // Sammelt alle Kandidaten über beide Quellen, entfernt Redundanz (mehrere
  // MB-Kennzahlen korrelieren oft untereinander sehr ähnlich, z.B.
  // Gesamtpunkte vs. Punkteschnitt — pro deutscher Statistik wird nur die
  // stärkste Paarung behalten) und liefert die Top-`limit` Treffer, sortiert
  // nach |r| absteigend. Für "mehrere passende Vorschläge gleichzeitig".
  async function findAllOverallCandidates(state, excludePairKeys, opts) {
    opts = opts || {};

    const limit = opts.limit != null ? opts.limit : 5;

    const seasonList = await computeMaddenBowlSeasonList();
    const seasonCandidates = findCandidates(
      seasonList,
      excludePairKeys,
      opts
    );

    const playerCandidates = findPlayerCandidates(
      state,
      excludePairKeys,
      opts
    );

    const all = [...seasonCandidates, ...playerCandidates];

    all.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    // Redundanz raus: pro (Spieler +) deutscher Statistik nur den stärksten Treffer.
    const seen = new Set();
    const deduped = [];

    all.forEach((c) => {
      const dedupeKey =
        (c.isPlayer ? "player::" + c.player + "::" : "") +
        c.germanStatId;

      if (seen.has(dedupeKey)) return;

      seen.add(dedupeKey);
      deduped.push(c);
    });

    return deduped.slice(0, limit);
  }

  // ======================================================================
  // CHART (Canvas) — im Look von tylervigen.com/spurious: zwei Linien,
  // zwei y-Achsen (links: Madden-Bowl-Kennzahl, rechts: deutsche Statistik),
  // gemeinsame Jahres-x-Achse. Selbst gezeichnet, keine externe Chart-Lib.
  // ======================================================================

  function fmtNum(v) {
    if (Math.abs(v) >= 1e9) {
      return (
        (v / 1e9).toFixed(2).replace(".", ",") + " Mrd."
      );
    }

    if (Math.abs(v) >= 1e6) {
      return (
        (v / 1e6).toFixed(2).replace(".", ",") + " Mio."
      );
    }

    if (Number.isInteger(v)) {
      return v.toLocaleString("de-DE");
    }

    return v.toLocaleString("de-DE", {
      maximumFractionDigits: 2,
    });
  }

  function renderChartCanvas(candidate) {
    const W = 1000, H = 640;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");

    // Hintergrund
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b1119");
    grad.addColorStop(1, "#161f2c");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Titel
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 30px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Spurious Correlation", W / 2, 46);

    ctx.font = "400 17px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";

    // Richtung explizit in der Unterzeile nennen (nicht nur implizit übers
    // Vorzeichen von r oder daran, dass sich die Linien im Bild kreuzen) —
    // eine negative Korrelation ist genauso eine "echte" Korrelation wie
    // eine positive, nur eben gegenläufig statt gleichläufig.

    const directionLabel =
      candidate.r >= 0 ? "(gleichläufig)" : "(gegenläufig)";

    wrapCenter(
      ctx,
      `${candidate.mbLabel} korreliert mit ${candidate.germanName} ${directionLabel}`,
      W / 2,
      76,
      W - 120,
      22
    );

    // Plot-Bereich
    const hasCustomLabels =
      Array.isArray(candidate.xLabels) &&
      candidate.xLabels.length === candidate.years.length;

    const padL = 90;
    const padR = 90;
    const padT = 130;
    const padB = hasCustomLabels ? 120 : 90;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const years = candidate.years;
    const xLabels = hasCustomLabels
      ? candidate.xLabels
      : years.map(String);

    const n = years.length;
																			 

    const xFor = (i) =>
      padL +
      (n === 1
        ? plotW / 2
        : (i / (n - 1)) * plotW);

    const mbVals = candidate.mbValues;
    const gVals = candidate.germanValues;

    const mbMin = Math.min(...mbVals);
    const mbMax = Math.max(...mbVals);

    const gMin = Math.min(...gVals);
    const gMax = Math.max(...gVals);

    const pad = (min, max) => {
      const p =
        (max - min) * 0.15 ||
        Math.abs(max || 1) * 0.1 ||
        1;

      return [min - p, max + p];
    };

    const [mbLo, mbHi] = pad(mbMin, mbMax);
    const [gLo, gHi] = pad(gMin, gMax);
																			  
																		  

    const yForMb = (v) =>
      padT +
      plotH -
      ((v - mbLo) / (mbHi - mbLo)) * plotH;

    const yForG = (v) =>
      padT +
      plotH -
      ((v - gLo) / (gHi - gLo)) * plotH;

    // Gitternetz + x-Achse
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;

    for (let i = 0; i < n; i++) {
      const x = xFor(i);

      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";

      if (hasCustomLabels) {
        ctx.save();

        ctx.translate(
          x,
          padT + plotH + 22
        );

        ctx.rotate(-Math.PI / 10);
        ctx.textAlign = "right";

        ctx.fillText(
          xLabels[i],
          0,
          0
        );

        ctx.restore();
      } else {
        ctx.textAlign = "center";

        ctx.fillText(
          xLabels[i],
          x,
          padT + plotH + 28
        );
      }
    }

    // Linie 1: Madden Bowl
    drawLine(
      ctx,
      years.map((_, i) => [
        xFor(i),
        yForMb(mbVals[i]),
      ]),
      "#00ffcc"
    );

    // Linie 2: deutsche Statistik
    drawLine(
      ctx,
      years.map((_, i) => [
        xFor(i),
        yForG(gVals[i]),
      ]),
      "#D50A0A"
    );

    // Punktbeschriftung
    ctx.textAlign = "center";

    years.forEach((_, i) => {
      ctx.fillStyle = "#00ffcc";
      ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";

      ctx.fillText(
        fmtNum(mbVals[i]),
        xFor(i),
        yForMb(mbVals[i]) - 12
      );

      ctx.fillStyle = "#ff8080";

      ctx.fillText(
        fmtNum(gVals[i]),
        xFor(i),
        yForG(gVals[i]) + 24
      );
    });

    // Legende
    ctx.textAlign = "left";
    ctx.font = "700 15px 'Segoe UI', Roboto, sans-serif";

    ctx.fillStyle = "#00ffcc";

    ctx.fillText(
      `● ${candidate.mbLabel} (${candidate.mbUnit})`,
      padL,
      padT - 18
    );

    ctx.fillStyle = "#ff8080";
    ctx.textAlign = "right";
																							   

    ctx.fillText(
      `● ${candidate.germanName} (${candidate.germanUnit})`,
      W - padR,
      padT - 18
    );

    // r-Wert
    ctx.textAlign = "center";
    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#fff";

    ctx.fillText(
      `Korrelation: r = ${candidate.r.toFixed(6)}`,
      W / 2,
      H - 30
    );

    ctx.textAlign = "right";
    ctx.font = "400 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";

    ctx.fillText(
      "🏈 Madden Bowl — Spurious Correlations",
      W - 20,
      H - 8
    );

    return canvas;
  }

  function drawLine(ctx, points, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    ctx.beginPath();

    points.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  function wrapCenter(
    ctx,
    text,
    x,
    y,
    maxWidth,
    lineHeight
  ) {
    const words = text.split(" ");
    let line = "";
    let lines = [];

    words.forEach((w) => {
      const test = line
        ? line + " " + w
        : w;

      if (
        ctx.measureText(test).width > maxWidth &&
        line
      ) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });

    if (line) lines.push(line);

    lines.forEach((l, i) =>
      ctx.fillText(
        l,
        x,
        y + i * lineHeight
      )
    );
  }

  global.MB = global.MB || {};

  global.MB.Spurious = {
    GERMAN_STATS,
    GERMAN_STAT_STORIES,
    buildSpuriousStory,
    MB_STAT_DEFS,
    PLAYER_STAT_DEFS,
    MATCH_THRESHOLD,
    MIN_POINTS,
    PLAYER_MIN_GAMES,
    computeSeasonAggregates,
    computeMaddenBowlSeasonList,
    pearson,
    findCandidates,
    findBestCandidate,
    allAvailableYears,
    getPlayerFinishedGames,
    computePlayerSeries,
    findPlayerCandidates,
    findBestPlayerCandidate,
    findBestOverallCandidate,
    findAllOverallCandidates,
    renderChartCanvas,
    buildSpuriousHeadline,
  };
})(window);
