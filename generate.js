#!/usr/bin/env node
// Generates a static product page whose price + availability rotate over time.
// No dependencies — pure Node. Output goes to ./public for GitHub Pages.
//
// The price/availability are derived deterministically from the clock so a
// given UTC time always produces the same value (predictable for testing).
// The schedule steps DOWN repeatedly (to trigger Save Genie price-drop
// notifications), flips to OUT OF STOCK once (to test availability changes),
// then rises again — a full cycle every SLOT_HOURS * schedule.length hours.

const fs = require("fs");
const path = require("path");

// --- Config ---------------------------------------------------------------

const SLOT_HOURS = 3; // price/availability changes every 3 hours
const CURRENCY = "AUD";
const PRODUCT = {
  name: "SmokeStone Wireless Earbuds",
  brand: "SmokeStone",
  description:
    "Active noise-cancelling wireless earbuds with 30-hour battery life, USB-C fast charge, and IPX5 water resistance.",
  sku: "SS-EB-001",
  gtin13: "9300000000017",
  image: "earbuds.svg",
};

// One entry per slot. price is a plain decimal string (no symbols/commas).
// availability: "InStock" | "OutOfStock".
const SCHEDULE = [
  { price: "149.00", availability: "InStock" }, // reset / high
  { price: "139.00", availability: "InStock" }, // drop
  { price: "129.95", availability: "InStock" }, // drop
  { price: "119.00", availability: "InStock" }, // drop
  { price: "99.00", availability: "InStock" }, // big drop
  { price: "99.00", availability: "OutOfStock" }, // availability flip
  { price: "109.00", availability: "InStock" }, // back in stock (rise)
  { price: "129.00", availability: "InStock" }, // rise
];

// --- Derivation -----------------------------------------------------------

const now = new Date();
const hoursSinceEpoch = Math.floor(now.getTime() / 3_600_000);
const slot = Math.floor(hoursSinceEpoch / SLOT_HOURS) % SCHEDULE.length;
const current = SCHEDULE[slot];

const baseUrl = (process.env.BASE_URL || "").replace(/\/+$/, "");
const imageUrl = baseUrl ? `${baseUrl}/${PRODUCT.image}` : `./${PRODUCT.image}`;
const pageUrl = baseUrl || "./";
const availabilityUrl = `https://schema.org/${current.availability}`;
const availabilityText =
  current.availability === "InStock" ? "In stock" : "Out of stock";

// --- JSON-LD (the bit T1 actually extracts) -------------------------------

const jsonLd = {
  "@context": "https://schema.org/",
  "@type": "Product",
  name: PRODUCT.name,
  brand: { "@type": "Brand", name: PRODUCT.brand },
  description: PRODUCT.description,
  image: imageUrl,
  sku: PRODUCT.sku,
  gtin13: PRODUCT.gtin13,
  offers: {
    "@type": "Offer",
    url: pageUrl,
    priceCurrency: CURRENCY,
    price: current.price,
    availability: availabilityUrl,
    itemCondition: "https://schema.org/NewCondition",
  },
};

// --- HTML -----------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${PRODUCT.name} — TestStore</title>

  <!-- Open Graph fallback (T1 uses these if JSON-LD is ever missing) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${PRODUCT.name}">
  <meta property="og:description" content="${PRODUCT.description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="product:price:amount" content="${current.price}">
  <meta property="product:price:currency" content="${CURRENCY}">
  <meta property="product:availability" content="${
    current.availability === "InStock" ? "in stock" : "out of stock"
  }">

  <!-- PRIMARY: JSON-LD Product. This is what Save Genie T1 extracts. -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px;
           margin: 40px auto; padding: 0 20px; color: #1c1c1e; }
    img { width: 100%; border-radius: 20px; background: #f2f2f7; }
    .price { font-size: 28px; font-weight: 700; margin: 12px 0 4px; }
    .avail { font-weight: 600; }
    .in { color: #34c759; } .out { color: #ff3b30; }
    .meta { color: #8e8e93; font-size: 13px; margin-top: 24px; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="${PRODUCT.name}">
  <h1>${PRODUCT.name}</h1>
  <p class="price">A$${current.price}</p>
  <p class="avail ${current.availability === "InStock" ? "in" : "out"}">${availabilityText}</p>
  <p>${PRODUCT.description}</p>
  <p class="meta">
    Test page — price rotates every ${SLOT_HOURS}h.<br>
    Slot ${slot} of ${SCHEDULE.length} · generated ${now.toISOString()}
  </p>
</body>
</html>
`;

// --- Simple product image (stable absolute asset) -------------------------

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="#1c1c1e"/>
  <circle cx="300" cy="400" r="90" fill="#48484a"/>
  <circle cx="500" cy="400" r="90" fill="#48484a"/>
  <circle cx="300" cy="400" r="40" fill="#0a84ff"/>
  <circle cx="500" cy="400" r="40" fill="#0a84ff"/>
  <text x="400" y="660" font-family="sans-serif" font-size="48" fill="#f2f2f7"
        text-anchor="middle">SmokeStone</text>
</svg>
`;

// --- Write ----------------------------------------------------------------

const outDir = path.join(__dirname, "public");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, PRODUCT.image), svg);

console.log(
  `Generated slot ${slot}/${SCHEDULE.length}: ${CURRENCY} ${current.price} (${current.availability}) @ ${now.toISOString()}`
);
