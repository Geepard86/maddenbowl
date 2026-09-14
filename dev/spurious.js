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
    { id: "bierabsatz-deutschland", name: "Bierabsatz Deutschland", unit: "Mio. hl", source: "Destatis / GENESIS", values: { 2022: 87.7, 2023: 83.76, 2024: 82.68, 2025: 77.71 } },
    { id: "bierverbrauch-je-einwohner", name: "Bierverbrauch je Einwohner", unit: "Liter", source: "Destatis / GENESIS", values: { 2022: 86.6, 2023: 83.5, 2024: 81.7, 2025: 76.9 } },
    { id: "eierproduktion", name: "Eierproduktion", unit: "Mrd. Eier", source: "Destatis", values: { 2022: 13.1, 2023: 13.1, 2024: 13.7, 2025: 13.7 } },
    { id: "apfelernte-deutschland", name: "Apfelernte Deutschland", unit: "Mio. t", source: "Destatis", values: { 2022: 1.071, 2023: 0.987, 2024: 0.872, 2025: 1.138 } },
    { id: "fleischersatzproduktion", name: "Fleischersatzproduktion", unit: "Tsd. t", source: "Destatis", values: { 2022: 104.3, 2023: 121.6, 2024: 126.5, 2025: 124.9 } },
    { id: "unternehmensinsolvenzen", name: "Unternehmensinsolvenzen", unit: "Fälle", source: "Destatis", values: { 2022: 14590, 2023: 17814, 2024: 21812, 2025: 24064 } },
    { id: "eheschlieungen", name: "Eheschließungen", unit: "Fälle", source: "Destatis", values: { 2022: 390743, 2023: 360979, 2024: 349216, 2025: 348813 } },
    { id: "ehescheidungen", name: "Ehescheidungen", unit: "Fälle", source: "Destatis", values: { 2022: 137353, 2023: 129008, 2024: 129337, 2025: 130053 } },
    { id: "ubernachtungen-deutschland", name: "Übernachtungen Deutschland", unit: "Mio.", source: "Destatis", values: { 2022: 450.71, 2023: 487.11, 2024: 496.03, 2025: 497.5 } },
    { id: "aus-deutschland-abfliegende-passagiere", name: "Aus Deutschland abfliegende Passagiere", unit: "Mio.", source: "Destatis – Luftverkehr", values: { 2022: 72.65, 2023: 86.64, 2024: 93.45, 2025: 97.32 } },
    { id: "patentanmeldungen-beim-dpma", name: "Patentanmeldungen beim DPMA", unit: "Anzahl", source: "DPMA", values: { 2022: 57213, 2023: 58662, 2024: 59261, 2025: 62050 } },
    { id: "studierende-deutschland", name: "Studierende Deutschland", unit: "Mio.", source: "Destatis – Hochschulen", values: { 2022: 2.92, 2023: 2.868, 2024: 2.864, 2025: 2.877 } },
    { id: "treibhausgasemissionen-deutschland", name: "Treibhausgasemissionen Deutschland", unit: "Mio. t CO₂e", source: "Umweltbundesamt", values: { 2022: 750, 2023: 673, 2024: 650, 2025: 649 } },
    { id: "smartphones-absatz-deutschland", name: "Smartphones – Absatz Deutschland", unit: "Mio. Stück", source: "Bitkom", values: { 2022: 21, 2023: 20.3, 2024: 20.5, 2025: 19.6 } },
    { id: "deutsche-games-unternehmen", name: "Deutsche Games-Unternehmen", unit: "Anzahl", source: "game", values: { 2022: 786, 2023: 908, 2024: 948, 2025: 910 } },
    { id: "globale-musikindustrie-recorded-music-umsatz", name: "Globale Musikindustrie – Recorded-Music-Umsatz", unit: "Mrd. US-$", source: "IFPI – Global Music Report 2026", values: { 2022: 25.8, 2023: 28.4, 2024: 29.7, 2025: 31.7 } },
    { id: "globale-musikindustrie-subscription-streaming-umsatz", name: "Globale Musikindustrie – Subscription-Streaming-Umsatz", unit: "Mrd. US-$", source: "IFPI – Global Music Report 2026", values: { 2022: 12.7, 2023: 14.4, 2024: 16, 2025: 16.6 } },
    { id: "oscar-werbung-30-sek-spot", name: "Oscar-Werbung, 30-Sek.-Spot", unit: "Mio. US-$", source: "Marketing Brew", values: { 2022: 1.71, 2023: 2.1, 2024: 1.85, 2025: 2 } },
    { id: "super-bowl-werbung-30-sek-spot", name: "Super-Bowl-Werbung, 30-Sek.-Spot", unit: "Mio. US-$", source: "CBS News", values: { 2022: 6.5, 2023: 7, 2024: 7, 2025: 8 } },
    { id: "fahrrad-e-bike-durchschnittlicher-verkaufspreis", name: "Fahrrad/E-Bike – durchschnittlicher Verkaufspreis", unit: "€", source: "ZIV – Marktdaten", values: { 2022: 1602, 2023: 1788, 2024: 1645, 2025: 1581 } },
    { id: "durchschnittlicher-e-bike-preis", name: "Durchschnittlicher E-Bike-Preis", unit: "€", source: "ZIV – Marktdaten", values: { 2022: 2800, 2023: 2950, 2024: 2650, 2025: 2550 } },
    { id: "pkw-bestand-deutschland", name: "Pkw-Bestand Deutschland", unit: "Mio.", source: "KBA – Fahrzeugbestand", values: { 2022: 48.5, 2023: 48.8, 2024: 49.1, 2025: 49.3 } },
    { id: "gesamtbevolkerung-deutschland", name: "Gesamtbevölkerung Deutschland", unit: "Mio.", source: "Destatis – Bevölkerungsstand", values: { 2022: 82.53, 2023: 83.29, 2024: 83.52, 2025: 83.52 } },
    { id: "lebendgeborene", name: "Lebendgeborene", unit: "Tsd.", source: "Destatis – Geburten", values: { 2022: 738.8, 2023: 693, 2024: 677.1, 2025: 654.2 } },
    { id: "gestorbene", name: "Gestorbene", unit: "Tsd.", source: "Destatis – Geburten und Sterbefälle", values: { 2022: 1066.3, 2023: 1028.2, 2024: 1007.8, 2025: 1006.6 } },
    { id: "erwerbstatige", name: "Erwerbstätige", unit: "Mio.", source: "Destatis – Arbeitsmarkt", values: { 2022: 45.469, 2023: 45.782, 2024: 45.83, 2025: 45.83 } },
    { id: "erwerbslose", name: "Erwerbslose", unit: "Mio.", source: "Destatis – Arbeitsmarkt", values: { 2022: 1.355, 2023: 1.342, 2024: 1.49, 2025: 1.652 } },
    { id: "genehmigte-wohnungen", name: "Genehmigte Wohnungen", unit: "Tsd.", source: "Destatis – Baugenehmigungen", values: { 2022: 354.2, 2023: 259.6, 2024: 215.3, 2025: 238.1 } },
    { id: "holzeinschlag", name: "Holzeinschlag", unit: "Mio. m³", source: "Destatis – Holzeinschlag", values: { 2022: 78.7, 2023: 70.6, 2024: 61.2, 2025: 57.3 } },
    { id: "kinobesucher-deutschland", name: "Kinobesucher Deutschland", unit: "Mio.", source: "FFA – Marktdaten", values: { 2022: 78.2, 2023: 95.7, 2024: 89.9, 2025: 91.9 } },
    { id: "stromerzeugung-gesamt", name: "Stromerzeugung gesamt", unit: "Mrd. kWh", source: "Destatis – Bruttostromerzeugung", values: { 2022: 578.9, 2023: 511.3, 2024: 503.2, 2025: 507.5 } },
    { id: "windstrom", name: "Windstrom", unit: "Mrd. kWh", source: "Destatis – Stromerzeugung 2025", values: { 2022: 122.5, 2023: 139.3, 2024: 136, 2025: 131.3 } },
    { id: "erneuerbare-stromerzeugung", name: "Erneuerbare Stromerzeugung", unit: "Mrd. kWh", source: "Destatis – Stromerzeugung 2025", values: { 2022: 236, 2023: 251.8, 2024: 256.4, 2025: 256.9 } },
    { id: "butterproduktion", name: "Butterproduktion", unit: "t", source: "Destatis – GENESIS", values: { 2022: 471800, 2023: 480500, 2024: 473400, 2025: 518100 } },
    { id: "kaseproduktion", name: "Käseproduktion", unit: "Mio. t", source: "BMEL – Milch und Milcherzeugnisse", values: { 2022: 2.64, 2023: 2.66, 2024: 2.74, 2025: 2.76 } },
    { id: "zigarettenverbrauch", name: "Zigarettenverbrauch", unit: "Mrd. Stück", source: "Destatis – GENESIS", values: { 2022: 65.784, 2023: 64.03, 2024: 66.247, 2025: 66.375 } },
    { id: "fitnessstudio-mitglieder", name: "Fitnessstudio-Mitglieder", unit: "Mio.", source: "DSSV – Eckdaten 2026", values: { 2022: 10.3, 2023: 11.3, 2024: 11.71, 2025: 12.36 } },
    { id: "e-bike-verkaufe-deutschland", name: "E-Bike-Verkäufe Deutschland", unit: "Mio. Stück", source: "ZIV – Marktdaten-Archiv", values: { 2022: 2.2, 2023: 2.1, 2024: 2.1, 2025: 2 } },
    { id: "weltweite-kino-bilanz-box-office", name: "Weltweite Kino-Bilanz (Box Office)", unit: "Mrd. US-$", source: "Gower Street Analytics", values: { 2022: 25.9, 2023: 33.9, 2024: 30, 2025: 33.55 } },
    { id: "usa-kanada-kino-umsatz", name: "USA/Kanada: Kino-Umsatz", unit: "Mrd. US-$", source: "SEC / AMC 10-K", values: { 2022: 7.454, 2023: 9.034, 2024: 8.746, 2025: 8.9 } },
    { id: "usa-kanada-kinobesuche", name: "USA/Kanada: Kinobesuche", unit: "Mio. Tickets", source: "SEC / AMC 10-K", values: { 2022: 708, 2023: 833, 2024: 760, 2025: 769 } },
    { id: "buchmarkt-deutschland-gesamtumsatz", name: "Buchmarkt Deutschland – Gesamtumsatz", unit: "Mrd. €", source: "Börsenverein – Wirtschaftszahlen", values: { 2022: 9.444, 2023: 9.707, 2024: 9.882, 2025: 9.62 } },
    { id: "taylor-swift-ifpi-global-artist-of-the-year", name: "Taylor Swift – IFPI Global Artist of the Year", unit: "Rang", source: "IFPI – Global Charts", values: { 2022: 1, 2023: 1, 2024: 1, 2025: 1 } },
    { id: "kartoffelernte-deutschland", name: "Kartoffelernte Deutschland", unit: "Mio. t", source: "Destatis – Feldfrüchte", values: { 2022: 10.683, 2023: 11.607, 2024: 12.703, 2025: 13.871 } },
    { id: "getreideernte-insgesamt", name: "Getreideernte insgesamt", unit: "Mio. t", source: "Destatis – Feldfrüchte", values: { 2022: 43.479, 2023: 42.463, 2024: 38.975, 2025: 45.258 } },
    { id: "zuckerrubenernte", name: "Zuckerrübenernte", unit: "Mio. t", source: "Destatis – Feldfrüchte", values: { 2022: 28.201, 2023: 31.558, 2024: 36.682, 2025: 32.327 } },
    { id: "weinerzeugung-deutschland", name: "Weinerzeugung Deutschland", unit: "Mio. hl", source: "Destatis – Weinerzeugung", values: { 2022: 8.94, 2023: 8.593, 2024: 7.751, 2025: 7.55 } },
    { id: "biersteuer-einnahmen", name: "Biersteuer-Einnahmen", unit: "Mio. €", source: "DHS – Alkohol Zahlen & Fakten", values: { 2022: 600, 2023: 580, 2024: 558, 2025: 540 } },
    { id: "alkoholsteuer-einnahmen-insgesamt", name: "Alkoholsteuer-Einnahmen insgesamt", unit: "Mio. €", source: "DHS – Alkohol Zahlen & Fakten", values: { 2022: 3173, 2023: 3125, 2024: 2917, 2025: 2978 } },
    { id: "paketsendungen", name: "Paketsendungen", unit: "Mrd. Sendungen", source: "Bundesnetzagentur – Postmarkt", values: { 2022: 4.25, 2023: 4.36, 2024: 4.6, 2025: 4.83 } },
    { id: "paketmarkt-umsatz", name: "Paketmarkt-Umsatz", unit: "Mrd. €", source: "Bundesnetzagentur – Postmarkt", values: { 2022: 18.41, 2023: 19.19, 2024: 20.37, 2025: 21.79 } },
    { id: "gema-gesamtertrage", name: "GEMA-Gesamterträge", unit: "Mrd. €", source: "GEMA – Geschäftsbericht 2025", values: { 2022: 1.178, 2023: 1.207, 2024: 1.33, 2025: 1.34 } },
    { id: "deutscher-musikmarkt-handelsumsatz", name: "Deutscher Musikmarkt – Handelsumsatz", unit: "Mrd. €", source: "BVMI – Musikindustrie in Zahlen 2025", values: { 2022: 1.055, 2023: 1.153, 2024: 2.365, 2025: 2.42 } },
    { id: "markenanmeldungen-beim-dpma", name: "Markenanmeldungen beim DPMA", unit: "Anmeldungen", source: "DPMA – Markenstatistik 2025", values: { 2022: 73312, 2023: 75261, 2024: 77224, 2025: 93291 } },
    { id: "patenterteilungen-beim-dpma", name: "Patenterteilungen beim DPMA", unit: "Erteilungen", source: "DPMA – Patentstatistik", values: { 2022: 23591, 2023: 22363, 2024: 23944, 2025: 24475 } },
    { id: "einwanderung-nach-deutschland", name: "Einwanderung nach Deutschland", unit: "Personen", source: "Destatis – Wanderungsstatistik", values: { 2022: 2.66577e+06, 2023: 1.93251e+06, 2024: 1.69419e+06, 2025: 1.47994e+06 } },
    { id: "auswanderung-aus-deutschland", name: "Auswanderung aus Deutschland", unit: "Personen", source: "Destatis – Wanderungsstatistik", values: { 2022: 1.20368e+06, 2023: 1.26954e+06, 2024: 1.26401e+06, 2025: 1.24494e+06 } },
    { id: "auslandische-bevolkerung-in-deutschland", name: "Ausländische Bevölkerung in Deutschland", unit: "Mio. Personen", source: "Destatis – Ausländerstatistik", values: { 2022: 13.384, 2023: 13.896, 2024: 14.062, 2025: 14.07 } },
    { id: "nettozuwanderung", name: "Nettozuwanderung", unit: "Mio. Personen", source: "Destatis – Wanderungsstatistik", values: { 2022: 1.462, 2023: 0.663, 2024: 0.43, 2025: 0.235 } },
    { id: "verkehrstote", name: "Verkehrstote", unit: "Personen", source: "Destatis – Verkehrsunfälle", values: { 2022: 2788, 2023: 2839, 2024: 2770, 2025: 2832 } },
    { id: "verkehrsunfalle-insgesamt", name: "Verkehrsunfälle insgesamt", unit: "Mio. Unfälle", source: "Destatis – Verkehrsunfälle", values: { 2022: 2.406, 2023: 2.52, 2024: 2.513, 2025: 2.522 } },
    { id: "veranschlagte-baukosten-genehmigter-bauwerke", name: "Veranschlagte Baukosten genehmigter Bauwerke", unit: "Mrd. €", source: "Destatis – Baugenehmigungen", values: { 2022: 134.99, 2023: 112.992, 2024: 104.06, 2025: 113.815 } },
    { id: "fahrgaste-im-linienverkehr-busse-bahnen", name: "Fahrgäste im Linienverkehr Busse + Bahnen", unit: "Mrd. Fahrgäste", source: "Destatis – Linienverkehr", values: { 2022: 10.7, 2023: 10.9, 2024: 11.4, 2025: 11.5 } },
    { id: "landwirtschaftlicher-erzeugerpreisindex", name: "Landwirtschaftlicher Erzeugerpreisindex", unit: "Index 2020=100", source: "Destatis – Landwirtschaftliche Erzeugerpreise", values: { 2022: 141, 2023: 141.3, 2024: 139.2, 2025: 139.6 } },
    { id: "super-bowl-zuschauer-usa", name: "Super-Bowl-Zuschauer USA", unit: "Mio. Zuschauer", source: "Nielsen", values: { 2022: 101.47, 2023: 115.096, 2024: 123.714, 2025: 127.713 } },
    { id: "arbeitskosten-je-geleistete-stunde", name: "Arbeitskosten je geleistete Stunde", unit: "€", source: "Destatis – Arbeitskosten", values: { 2022: 39.5, 2023: 41.3, 2024: 43.4, 2025: 45 } },
    { id: "inflationsrate-deutschland", name: "Inflationsrate Deutschland", unit: "%", source: "Destatis – Inflationsrate", values: { 2022: 6.9, 2023: 5.9, 2024: 2.2, 2025: 2.2 } },
    { id: "bip-nominal", name: "BIP nominal", unit: "Mrd. €", source: "Destatis – VGR", values: { 2022: 3989.39, 2023: 4219.31, 2024: 4328.97, 2025: 4470.48 } },
    { id: "bip-wachstum-real", name: "BIP-Wachstum real", unit: "%", source: "Destatis – BIP 2025", values: { 2022: 1.8, 2023: -0.9, 2024: -0.5, 2025: 0.2 } },
    { id: "private-konsumausgaben", name: "Private Konsumausgaben", unit: "Mrd. €", source: "Destatis – VGR", values: { 2022: 2094.03, 2023: 2218.51, 2024: 2282.96, 2025: 2373.99 } },
    { id: "konsumausgaben-des-staates", name: "Konsumausgaben des Staates", unit: "Mrd. €", source: "Destatis – VGR", values: { 2022: 868.21, 2023: 905.2, 2024: 951.78, 2025: 1007.84 } },
    { id: "exporte", name: "Exporte", unit: "Mrd. €", source: "Destatis – VGR", values: { 2022: 1820.3, 2023: 1812.92, 2024: 1793.67, 2025: 1811.27 } },
    { id: "importe", name: "Importe", unit: "Mrd. €", source: "Destatis – VGR", values: { 2022: 1721.71, 2023: 1645.33, 2024: 1630.15, 2025: 1700.85 } },
    { id: "kfz-bestand-insgesamt", name: "Kfz-Bestand insgesamt", unit: "Mio.", source: "Destatis – Fahrzeugbestand", values: { 2022: 59.635, 2023: 60.133, 2024: 60.681, 2025: 61.098 } },
    { id: "pkw-neuzulassungen", name: "Pkw-Neuzulassungen", unit: "Mio.", source: "Destatis – Neuzulassungen", values: { 2022: 2.651, 2023: 2.845, 2024: 2.817, 2025: 2.858 } },
    { id: "autobahnnetz", name: "Autobahnnetz", unit: "Tsd. km", source: "Destatis – Verkehrsinfrastruktur", values: { 2022: 13.2, 2023: 13.2, 2024: 13.2, 2025: 13.2 } },
    { id: "bundesstraennetz", name: "Bundesstraßennetz", unit: "Tsd. km", source: "Destatis – Verkehrsinfrastruktur", values: { 2022: 37.8, 2023: 37.8, 2024: 37.7, 2025: 37.7 } },
    { id: "onlinehandel-deutschland", name: "Onlinehandel Deutschland", unit: "Mrd. € netto", source: "HDE Online-Monitor", values: { 2022: 84.7, 2023: 85.5, 2024: 88.8, 2025: 92.4 } },
    { id: "weltweite-rebflache", name: "Weltweite Rebfläche", unit: "Mio. ha", source: "OIV – State of the World Wine Sector 2025", values: { 2022: 7.236, 2023: 7.172, 2024: 7.09, 2025: 7.034 } },
    { id: "verbrauch-versteuerter-zigaretten-je-einwohner", name: "Verbrauch versteuerter Zigaretten je Einwohner", unit: "Stück/Jahr", source: "DHS / Destatis – Tabak und Nikotin", values: { 2022: 785, 2023: 769, 2024: 793, 2025: 795 } },
    { id: "kaffeesteuereinnahmen", name: "Kaffeesteuereinnahmen", unit: "Mio. €", source: "Destatis – Steuereinnahmen nach Steuerarten", values: { 2022: 1062.5, 2023: 1030.2, 2024: 992.3, 2025: 1037.9 } },
    { id: "verbraucherpreisindex-besuch-von-kino-theater-konzert-zirkus-u-a", name: "Verbraucherpreisindex: Besuch von Kino, Theater, Konzert, Zirkus u. Ä.", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", values: { 2022: 103.8, 2023: 108.3, 2024: 112.2, 2025: 116.6 } },
    { id: "verbraucherpreisindex-fastfoodrestaurants", name: "Verbraucherpreisindex: Fastfoodrestaurants", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", values: { 2022: 112.3, 2023: 122.9, 2024: 130.3, 2025: 136.1 } },
    { id: "verbraucherpreisindex-hotelubernachtungen", name: "Verbraucherpreisindex: Hotelübernachtungen", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", values: { 2022: 110.1, 2023: 117.8, 2024: 122.1, 2025: 125.5 } },
    { id: "verbraucherpreisindex-bestattungsleistungen-friedhofsgebuhren", name: "Verbraucherpreisindex: Bestattungsleistungen/Friedhofsgebühren", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", values: { 2022: 107.4, 2023: 113.2, 2024: 118.4, 2025: 122.2 } },
    { id: "verbraucherpreisindex-bahntickets", name: "Verbraucherpreisindex: Bahntickets", unit: "Index 2020=100", source: "Destatis – Verbraucherpreisindex, COICOP", values: { 2022: 92.1, 2023: 95.6, 2024: 98.6, 2025: 104.8 } },
    { id: "goldschmuck-nachfrage-weltweit", name: "Goldschmuck-Nachfrage weltweit", unit: "Tonnen", source: "World Gold Council – Jewellery Demand World Gold Council – 2025", values: { 2022: 2088.9, 2023: 2092.6, 2024: 1866.9, 2025: 1542.3 } },
    { id: "goldnachfrage-der-zentralbanken-weltweit", name: "Goldnachfrage der Zentralbanken weltweit", unit: "Tonnen", source: "World Gold Council – Central Banks World Gold Council – 2024 World Gold Council – 2025", values: { 2022: 1081.9, 2023: 1037.4, 2024: 1044.6, 2025: 863.3 } },
    { id: "goldverbrauch-fur-technologie-weltweit", name: "Goldverbrauch für Technologie weltweit", unit: "Tonnen", source: "World Gold Council – Technology 2022/23 World Gold Council – Technology 2024/25", values: { 2022: 308.5, 2023: 297.8, 2024: 326.1, 2025: 322.8 } },
    { id: "rohstahlproduktion-weltweit", name: "Rohstahlproduktion weltweit", unit: "Mio. Tonnen", source: "worldsteel – World Steel in Figures 2026", values: { 2022: 1889, 2023: 1904, 2024: 1887, 2025: 1849 } },
    { id: "stahlverbrauch-pro-kopf-in-deutschland", name: "Stahlverbrauch pro Kopf in Deutschland", unit: "kg pro Kopf", source: "worldsteel – Apparent Steel Use per Capita", values: { 2022: 387, 2023: 334.9, 2024: 312.9, 2025: 347.1 } },
    { id: "mobelproduktion-in-deutschland-produktionswert", name: "Möbelproduktion in Deutschland – Produktionswert", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Möbel", values: { 2022: 18.791, 2023: 17.726, 2024: 16.338, 2025: 15.792 } },
    { id: "bekleidungsproduktion-in-deutschland-produktionswert", name: "Bekleidungsproduktion in Deutschland – Produktionswert", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Bekleidung", values: { 2022: 20.977, 2023: 19.924, 2024: 18.509, 2025: 17.853 } },
    { id: "pharmaindustrie-deutschland-produktionswert", name: "Pharmaindustrie Deutschland – Produktionswert", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Pharma", values: { 2022: 100.664, 2023: 107.666, 2024: 99.905, 2025: 101.006 } },
    { id: "lederwaren-und-schuhindustrie-deutschland-produktionswert", name: "Lederwaren- und Schuhindustrie Deutschland – Produktionswert", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Leder & Schuhe", values: { 2022: 6.202, 2023: 6.89, 2024: 6.612, 2025: 6.523 } },
    { id: "tabakverarbeitung-deutschland-produktionswert", name: "Tabakverarbeitung Deutschland – Produktionswert", unit: "Mrd. €", source: "Destatis – Verarbeitendes Gewerbe / Tabakverarbeitung", values: { 2022: 6.202, 2023: 6.89, 2024: 6.612, 2025: 6.523 } },
    { id: "staatliche-lotterien-spieleinsatze", name: "Staatliche Lotterien – Spieleinsätze", unit: "Mrd. €", source: "LOTTO.de – Bilanz 2022 DLTB/ZEAL – 2023 LOTTO.de – Bilanz 2024 LOTTO.de – Bilanz 2025", values: { 2022: 7.97, 2023: 8.2, 2024: 8.56, 2025: 8.3 } },
    { id: "weltbevolkerung", name: "Weltbevölkerung", unit: "Personen", source: "World Bank / FRED – World Population", values: { 2022: 7.98855e+09, 2023: 8.06292e+09, 2024: 8.1409e+09, 2025: 8.21542e+09 } },
    { id: "zusammengefasste-geburtenziffer-deutschland", name: "Zusammengefasste Geburtenziffer Deutschland", unit: "Kinder je Frau", source: "Destatis", values: { 2022: 1.49, 2023: 1.38, 2024: 1.35, 2025: 1.32 } },
    { id: "weltweite-verkaufe-von-elektroautos-bev-plug-in-hybride", name: "Weltweite Verkäufe von Elektroautos (BEV + Plug-in-Hybride)", unit: "Mio. Fahrzeuge", source: "IEA – Global EV Outlook", values: { 2022: 10.5, 2023: 14, 2024: 17, 2025: 21 } },
    { id: "internationale-fuballtransfers-transferentschadigungen-weltweit", name: "Internationale Fußballtransfers – Transferentschädigungen weltweit", unit: "Mrd. US-$", source: "FIFA – Global Transfer Report", values: { 2022: 6.5, 2023: 9.66, 2024: 8.59, 2025: 13.08 } },
  ];

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

  // Liefert { statKey: { jahr: wert, ... }, ... } über alle archivierten Saisons.
  async function computeMaddenBowlSeries() {
    const seasons = await MB.loadHistorySeasons();
    const perYear = {};
    seasons.forEach((s) => {
      const year = Number(s.season);
      if (!Number.isFinite(year)) return;
      const agg = computeSeasonAggregates(s);
      if (agg) perYear[year] = agg;
    });

    const series = {};
    MB_STAT_DEFS.forEach((def) => {
      const pts = {};
      Object.keys(perYear).forEach((yearStr) => {
        const v = perYear[yearStr][def.key];
        if (v != null && Number.isFinite(v)) pts[yearStr] = v;
      });
      series[def.key] = pts;
    });
    return series;
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
    if (dx2 === 0 || dy2 === 0) return null; // konstante Reihe -> keine sinnvolle Korrelation
    return num / Math.sqrt(dx2 * dy2);
  }

  // ======================================================================
  // KANDIDATEN-SUCHE
  // ----------------------------------------------------------------------
  // excludePairKeys: Set von "mbStatKey::germanStatId" — bereits in diesem
  // Turnier veröffentlichte Paarungen, damit sich nichts wiederholt.
  // ======================================================================
  const MATCH_THRESHOLD = 0.9; // |r| ab hier gilt als "passt gut"
  const MIN_POINTS = 4;

  function findCandidates(mbSeries, excludePairKeys, opts) {
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : MATCH_THRESHOLD;
    const minPoints = opts.minPoints != null ? opts.minPoints : MIN_POINTS;
    const exclude = excludePairKeys || new Set();
    const out = [];

    MB_STAT_DEFS.forEach((def) => {
      const mbPts = mbSeries[def.key] || {};
      const years = Object.keys(mbPts).map(Number);
      if (years.length < minPoints) return;

      GERMAN_STATS.forEach((gs) => {
        const pairKey = def.key + "::" + gs.id;
        if (exclude.has(pairKey)) return;

        const sharedYears = years.filter((y) => gs.values[y] != null).sort((a, b) => a - b);
        if (sharedYears.length < minPoints) return;

        const xs = sharedYears.map((y) => mbPts[y]);
        const ys = sharedYears.map((y) => gs.values[y]);
        const r = pearson(xs, ys);
        if (r == null || Math.abs(r) < threshold) return;

        out.push({
          pairKey,
          mbStatKey: def.key, mbLabel: def.label, mbUnit: def.unit,
          germanStatId: gs.id, germanName: gs.name, germanUnit: gs.unit, germanSource: gs.source,
          years: sharedYears, mbValues: xs, germanValues: ys, r,
        });
      });
    });

    out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return out;
  }

  // Bequemer Einstiegspunkt: berechnet die Madden-Bowl-Reihen selbst und
  // liefert direkt den besten (noch nicht verwendeten) Treffer, oder null.
  async function findBestCandidate(excludePairKeys, opts) {
    const mbSeries = await computeMaddenBowlSeries();
    const candidates = findCandidates(mbSeries, excludePairKeys, opts);
    return candidates.length ? candidates[0] : null;
  }

  // ======================================================================
  // CHART (Canvas) — im Look von tylervigen.com/spurious: zwei Linien,
  // zwei y-Achsen (links: Madden-Bowl-Kennzahl, rechts: deutsche Statistik),
  // gemeinsame Jahres-x-Achse. Selbst gezeichnet, keine externe Chart-Lib.
  // ======================================================================
  function fmtNum(v) {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2).replace(".", ",") + " Mrd.";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace(".", ",") + " Mio.";
    if (Number.isInteger(v)) return v.toLocaleString("de-DE");
    return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  }

  function renderChartCanvas(candidate) {
    const W = 1000, H = 640;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
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
    wrapCenter(ctx, `${candidate.mbLabel} correlates with ${candidate.germanName}`, W / 2, 76, W - 120, 22);

    // Plot-Bereich
    const padL = 90, padR = 90, padT = 130, padB = 90;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const years = candidate.years;
    const n = years.length;
    const xFor = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

    const mbVals = candidate.mbValues, gVals = candidate.germanValues;
    const mbMin = Math.min(...mbVals), mbMax = Math.max(...mbVals);
    const gMin = Math.min(...gVals), gMax = Math.max(...gVals);
    const pad = (min, max) => { const p = (max - min) * 0.15 || Math.abs(max || 1) * 0.1 || 1; return [min - p, max + p]; };
    const [mbLo, mbHi] = pad(mbMin, mbMax);
    const [gLo, gHi] = pad(gMin, gMax);
    const yForMb = (v) => padT + plotH - ((v - mbLo) / (mbHi - mbLo)) * plotH;
    const yForG = (v) => padT + plotH - ((v - gLo) / (gHi - gLo)) * plotH;

    // Gitternetz + Jahres-Achse
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const x = xFor(i);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "400 15px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(years[i]), x, padT + plotH + 28);
    }

    // Linie 1: Madden Bowl (accent-türkis)
    drawLine(ctx, years.map((_, i) => [xFor(i), yForMb(mbVals[i])]), "#00ffcc");
    // Linie 2: deutsche Statistik (nfl-red)
    drawLine(ctx, years.map((_, i) => [xFor(i), yForG(gVals[i])]), "#D50A0A");

    // Punktbeschriftung
    ctx.textAlign = "center";
    years.forEach((_, i) => {
      ctx.fillStyle = "#00ffcc";
      ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(fmtNum(mbVals[i]), xFor(i), yForMb(mbVals[i]) - 12);
      ctx.fillStyle = "#ff8080";
      ctx.fillText(fmtNum(gVals[i]), xFor(i), yForG(gVals[i]) + 24);
    });

    // Legende
    ctx.textAlign = "left";
    ctx.font = "700 15px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#00ffcc";
    ctx.fillText(`● ${candidate.mbLabel} (${candidate.mbUnit})`, padL, padT - 18);
    ctx.fillStyle = "#ff8080";
    ctx.textAlign = "right";
    ctx.fillText(`● ${candidate.germanName} (${candidate.germanUnit})`, W - padR, padT - 18);

    // r-Wert unten
    ctx.textAlign = "center";
    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Correlation: r = ${candidate.r.toFixed(6)}`, W / 2, H - 30);

    ctx.textAlign = "right";
    ctx.font = "400 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("🏈 Madden Bowl — Spurious Correlations", W - 20, H - 8);

    return canvas;
  }

  function drawLine(ctx, points, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    points.forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  }

  function wrapCenter(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "", lines = [];
    words.forEach((w) => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  }

  global.MB = global.MB || {};
  global.MB.Spurious = {
    GERMAN_STATS,
    MB_STAT_DEFS,
    MATCH_THRESHOLD,
    MIN_POINTS,
    computeSeasonAggregates,
    computeMaddenBowlSeries,
    pearson,
    findCandidates,
    findBestCandidate,
    renderChartCanvas,
  };
})(window);
