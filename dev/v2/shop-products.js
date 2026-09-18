/* =========================================================================
   MADDEN BOWL — SHOP-PRODUKTE (shop-products.js)
   -------------------------------------------------------------------------
   Statische Produktliste fürs "Featured Merch"-Widget im Dashboard.
   Basiert auf der mitgelieferten Produkt-ID-Liste — WICHTIG, bitte prüfen:

   1) Bild-URL: dein Original-Snippet hatte "https://spreadshirtmedia.net{prod.id}/..."
      (kein Template-Literal, also wortwörtlich "{prod.id}" statt der ID,
      und ohne die "image."-Subdomain). Ich hab hier stattdessen das
      öffentlich dokumentierte Spreadshirt-Bild-URL-Schema eingesetzt:
      https://image.spreadshirtmedia.net/image-server/v1/products/<ID>/views/1?width=300&height=300
      Kann ich von hier aus nicht gegen deinen echten Shop verifizieren —
      falls die Bilder auf dem Dashboard nicht laden, bitte einmal die
      Bild-URL eines echten Produkts in eurem Spreadshop-Adminbereich
      (Artikel-Bild, Rechtsklick -> Bildadresse kopieren) gegenchecken und
      IMAGE_URL_TEMPLATE unten anpassen.
   2) Der Klick-Link geht auf shop.html#!/articles/<ID> (dieselbe Konvention
      wie im Original-Snippet) — falls Spreadshop einen anderen Deeplink-Pfad
      erwartet, hier `prefix` anpassen.
   ========================================================================= */
(function (global) {
  "use strict";

  const IMAGE_URL_TEMPLATE = (id) =>
    `https://image.spreadshirtmedia.net/image-server/v1/products/${id}/views/1?width=300&height=300`;

  const SHOP_PREFIX = "shop.html#!/articles/";

  const PRODUCTS = [
    { id: "6aa8d5135af448088cbc409c", name: "Lasse - The Playcaller", preis: "32,49 €" },
    { id: "6aa8d05ee66f06035604722a", name: "Tobi - The Wildcard", preis: "32,49 €" },
    { id: "6aa7edf9e66f0603564c94f4", name: "Markus - The Cold Blooded", preis: "32,49 €" },
    { id: "6aa7edf9af48c111d2ab25fa", name: "Micha - The Chaos Factor", preis: "32,49 €" },
    { id: "6aa7edf95af448088cf42320", name: "Alex - The Contender", preis: "32,49 €" },
    { id: "6aa7edf9e66f0603564c8ee6", name: "The Rookie Class", preis: "32,49 €" },
    { id: "6aa7edf95af448088cf41d12", name: "Tobi - The Mouth", preis: "32,49 €" },
    { id: "6aa7edf9af48c111d2ab25eb", name: "Tim - The Defender", preis: "32,49 €" },
    { id: "6aa7edf75af448088cf416ed", name: "Altima Bowl VI", preis: "32,49 €" },
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

  function renderProductCardHtml(prod) {
    return `
      <a class="v2-merch-item" href="${SHOP_PREFIX}${prod.id}">
        <img src="${IMAGE_URL_TEMPLATE(prod.id)}" alt="${prod.name}" loading="lazy"
             onerror="this.style.display='none'">
        <div class="v2-merch-name">${prod.name}</div>
        <div class="v2-merch-price">${prod.preis}</div>
      </a>`;
  }

  global.MB = global.MB || {};
  global.MB.Shop = { PRODUCTS, getFeaturedProducts, renderProductCardHtml, IMAGE_URL_TEMPLATE };
})(window);
