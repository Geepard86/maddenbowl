/* =========================================================================
   MADDEN BOWL — SHOP-PRODUKTE (shop-products.js)
   -------------------------------------------------------------------------
   Statische Produktliste fürs "Featured Merch"-Widget im Dashboard.

   WARUM DER LINK BISHER AUF DIE SHOP-STARTSEITE GING:
   Das eingebettete Spreadshop-Widget (shopclient.nocache.js in shop.html)
   ist eine eigene kleine App, die ihre Route beim Erststart aus der
   Konfiguration "spread_shop_config.startToken" liest — NICHT aus dem
   URL-Hash beim Laden ("#!/articles/<id>" wird nur erkannt, wenn man
   *innerhalb* der schon laufenden Widget-App klickt, nicht bei einem
   frischen Seitenaufruf von außen). Deshalb landete ein direkter Link
   immer auf der Startseite.

   DIE ECHTE LÖSUNG: shop.html liest jetzt "?p=<startToken>" aus der URL
   und reicht das als spread_shop_config.startToken durch, BEVOR das
   Widget-Skript lädt — dafür ist genau der Teil der Spreadshop-URL nötig,
   den man per Rechtsklick -> "Link kopieren" auf einem Produkt im ECHTEN
   Shop bekommt (also nicht diese Datei hier, sondern
   https://maddenbowl.myspreadshop.de selbst), OHNE das
   "https://maddenbowl.myspreadshop.de/" davor. Für "Tim - The Defender"
   hast du das schon geliefert:
     defender-A6aa7edf9af48c111d2ab25eb?sellable=oNVGVn7gybSkMG1a7JGJ-2372-8&appearance=2
   → als startToken unten eingetragen.

   Für die anderen 8 Produkte fehlt uns dieser Code (die IDs unten sind nur
   Druck-/Bild-IDs, aus denen sich der Sellable-Code nicht ableiten lässt) —
   bitte bei jedem Produkt im echten Shop einmal "Link kopieren" machen und
   den Teil nach ".de/" hier als `startToken` eintragen. Ohne startToken
   verlinkt die Kachel einfach auf die Shop-Startseite (kein kaputter Link,
   nur kein Deep-Link).
   ========================================================================= */
(function (global) {
  "use strict";

  const IMAGE_URL_TEMPLATE = (id, view = 1) =>
  `https://image.spreadshirtmedia.net/image-server/v1/products/${id}/views/${view}?width=300&height=300`;

  const SHOP_PAGE = "shop.html";

  const PRODUCTS = [
  { id: "T2372A2PA7710PT17X15Y2D360161482W34913H41896", name: "Lasse - The Playcaller", preis: "32,49 €", startToken: playcaller-A6aa8d5135af448088cbc409c?sellable=lNQewEynOxf300ejaxRG-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X40Y5D360161468W29900H44850", name: "Tobi - The Wildcard", preis: "32,49 €", startToken: wildcard-A6aa8d05ee66f06035604722a?sellable=v9VllvXxJkF8JY83vE3d-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X40Y16D360155352W29899H44849", name: "Markus - The Cold Blooded", preis: "32,49 €", startToken: coldblooded-A6aa7edf9e66f0603564c94f4?sellable=Ra5p5wXDqdUnN2nqx2zV-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X40Y16D360155245W29900H44850", name: "Micha - The Chaos Factor", preis: "32,49 €", startToken: chaosfactor-A6aa7edf9af48c111d2ab25fa?sellable=VMq1qOgxAvTbaXYr40zv-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X40Y16D360155286W29900H44850", name: "Alex - The Contender", preis: "32,49 €", startToken: contender-A6aa7edf95af448088cf42320?sellable=Ab8r85eg80frZZ5YG3Vz-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X15Y31D360155248W34899H41880", name: "The Rookie Class", preis: "32,49 €", startToken: rookieclass-A6aa7edf9e66f0603564c8ee6?sellable=pNVRVLQj8quvomvM2mE1-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X15Y8D360155311W34998H36743", name: "Tobi - The Mouth", preis: "32,49 €", startToken: mouth-A6aa7edf95af448088cf41d12?sellable=9Oz4zEQgz0S7xxLR9lxp-2372-8&appearance=2 },
  { id: "T2372A2PA7710PT17X15Y11D360155283W34913H41896", name: "Tim - The Defender", preis: "32,49 €", startToken: "defender-A6aa7edf9af48c111d2ab25eb?sellable=oNVGVn7gybSkMG1a7JGJ-2372-8&appearance=2" },
  { id: "T2372A2PA7711PT17X15Y10D360155285W34900H23266", name: "Altima Bowl VI", preis: "32,49 €", view: 2, startToken: altimabowl6-A6aa7edf75af448088cf416ed?sellable=XNpkpGevgnSBGGM1eN19-2372-8&appearance=2 },
  ];

  function getFeaturedProducts(count) {
    const pool = [...PRODUCTS];
    const picked = [];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

function productLink(prod) {
  return prod.startToken ? `${SHOP_PAGE}?p=${encodeURIComponent(prod.startToken)}` : SHOP_PAGE;
}

function renderProductCardHtml(prod) {
  return `
    <a class="v2-merch-item" href="${productLink(prod)}">
      <img src="${IMAGE_URL_TEMPLATE(prod.id, prod.view || 1)}" alt="${prod.name}" loading="lazy"
           onerror="this.style.display='none'">
      <div class="v2-merch-name">${prod.name}</div>
      <div class="v2-merch-price">${prod.preis}</div>
    </a>`;
}

  global.MB = global.MB || {};
  global.MB.Shop = { PRODUCTS, getFeaturedProducts, renderProductCardHtml, productLink, IMAGE_URL_TEMPLATE };
})(window);
