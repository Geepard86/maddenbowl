/* =========================================================================
   MADDEN BOWL — SHOP-PRODUKTE (shop-products.js)
   -------------------------------------------------------------------------
   Produktliste fürs "Featured Merch"-Widget.

   Standard: view 1
   Altima Bowl VI: view 2

   Nur Tim – The Defender hat aktuell einen echten Spreadshop-Deep-Link.
   ========================================================================= */
(function (global) {
  "use strict";

  const IMAGE_URL_TEMPLATE = (id, view = 1) =>
    `https://image.spreadshirtmedia.net/image-server/v1/products/${id}/views/${view}?width=300&height=300`;

  const PRODUCTS = [
    {
      id: "T2372A2PA7710PT17X15Y2D360161482W34913H41896",
      name: "Lasse - The Playcaller",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X40Y5D360161468W29900H44850",
      name: "Tobi - The Wildcard",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X40Y16D360155352W29899H44849",
      name: "Markus - The Cold Blooded",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X40Y16D360155245W29900H44850",
      name: "Micha - The Chaos Factor",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X40Y16D360155286W29900H44850",
      name: "Alex - The Contender",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X15Y31D360155248W34899H41880",
      name: "The Rookie Class",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X15Y8D360155311W34998H36743",
      name: "Tobi - The Mouth",
      preis: "32,49 €",
      view: 1
    },
    {
      id: "T2372A2PA7710PT17X15Y11D360155283W34913H41896",
      name: "Tim - The Defender",
      preis: "32,49 €",
      view: 1,
      deeplink: "defender-A6aa7edf9af48c111d2ab25eb?sellable=oNVGVn7gybSkMG1a7JGJ-2372-8&appearance=2"
    },
    {
      id: "T2372A2PA7711PT17X15Y10D360155285W34900H23266",
      name: "Altima Bowl VI",
      preis: "32,49 €",
      view: 2
    }
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
    const href = prod.deeplink
      ? `shop.html#!/${prod.deeplink}`
      : "shop.html";

    return `
      <a class="v2-merch-item" href="${href}">
        <img src="${IMAGE_URL_TEMPLATE(prod.id, prod.view || 1)}"
             alt="${prod.name}" loading="lazy"
             onerror="this.style.display='none'">
        <div class="v2-merch-name">${prod.name}</div>
        <div class="v2-merch-price">${prod.preis}</div>
      </a>`;
  }

  global.MB = global.MB || {};
  global.MB.Shop = {
    PRODUCTS,
    getFeaturedProducts,
    renderProductCardHtml,
    IMAGE_URL_TEMPLATE
  };
})(window);
