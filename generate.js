#!/usr/bin/env node
// Generates a static product page for testing Save Genie.
// No dependencies — pure Node. Output goes to ./public for GitHub Pages.
//
// Two ways the price/availability change:
//  1. AUTOMATIC — derived from the clock (every SLOT_HOURS), so a given UTC time
//     always yields the same value. This is the default ("auto" mode).
//  2. ON DEMAND — a manual override stored in ./state.json, set by running the
//     workflow with a COMMAND (drop / raise / toggle_stock / etc). Overrides
//     stick until you reset back to auto.
//
// COMMAND is read from the COMMAND env var (passed by the GitHub Action).
// generate.js reads state.json, applies the command, writes state.json back,
// then renders public/index.html using the effective price/availability.

const fs = require("fs");
const path = require("path");

// --- Config ---------------------------------------------------------------

const SLOT_HOURS = 3; // automatic price/availability changes every 3 hours
const STEP_CENTS = 1000; // drop/raise step = $10.00
const MIN_CENTS = 100; // never go to $0 (Save Genie rejects price <= 0)
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

// Automatic schedule (used when no manual override is active).
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

const REPO = "freeme123/save-genie-test-product";
const STATE_PATH = path.join(__dirname, "state.json");

// --- Helpers --------------------------------------------------------------

const toCents = (s) => Math.round(parseFloat(s) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { manualPriceCents: null, manualAvailability: null };
  }
}

// --- Clock-derived (automatic) value --------------------------------------

const now = new Date();
const hoursSinceEpoch = Math.floor(now.getTime() / 3_600_000);
const slot = Math.floor(hoursSinceEpoch / SLOT_HOURS) % SCHEDULE.length;
const auto = SCHEDULE[slot];

// --- Apply command to state ----------------------------------------------

const command = (process.env.COMMAND || "none").trim();
const state = loadState();

// Effective value BEFORE this command (manual override wins over clock).
let effCents = state.manualPriceCents ?? toCents(auto.price);
let effAvail = state.manualAvailability ?? auto.availability;

switch (command) {
  case "drop":
    state.manualPriceCents = Math.max(MIN_CENTS, effCents - STEP_CENTS);
    break;
  case "raise":
    state.manualPriceCents = effCents + STEP_CENTS;
    break;
  case "toggle_stock":
    state.manualAvailability =
      effAvail === "InStock" ? "OutOfStock" : "InStock";
    break;
  case "set_instock":
    state.manualAvailability = "InStock";
    break;
  case "set_outofstock":
    state.manualAvailability = "OutOfStock";
    break;
  case "reset":
  case "auto":
    state.manualPriceCents = null;
    state.manualAvailability = null;
    break;
  case "none":
    break; // schedule/push: preserve existing state, just re-render
  default:
    console.warn(`Unknown COMMAND '${command}', treating as 'none'.`);
}

fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");

// Effective value AFTER this command.
effCents = state.manualPriceCents ?? toCents(auto.price);
effAvail = state.manualAvailability ?? auto.availability;
const price = fromCents(effCents);
const overridden =
  state.manualPriceCents !== null || state.manualAvailability !== null;

// --- URLs -----------------------------------------------------------------

const baseUrl = (process.env.BASE_URL || "").replace(/\/+$/, "");
const imageUrl = baseUrl ? `${baseUrl}/${PRODUCT.image}` : `./${PRODUCT.image}`;
const pageUrl = baseUrl || "./";
const availabilityUrl = `https://schema.org/${effAvail}`;
const availabilityText = effAvail === "InStock" ? "In stock" : "Out of stock";
const runWorkflowUrl = `https://github.com/${REPO}/actions/workflows/rotate.yml`;

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
    price: price,
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
  <meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="${CURRENCY}">
  <meta property="product:availability" content="${
    effAvail === "InStock" ? "in stock" : "out of stock"
  }">

  <!-- PRIMARY: JSON-LD Product. This is what Save Genie T1 extracts. -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px;
           margin: 40px auto; padding: 0 20px; color: #1c1c1e; }
    img.hero { width: 100%; border-radius: 20px; background: #f2f2f7; }
    .price { font-size: 28px; font-weight: 700; margin: 12px 0 4px; }
    .avail { font-weight: 600; }
    .in { color: #34c759; } .out { color: #ff3b30; }
    .controls { margin: 28px 0; padding: 16px; border: 1px solid #e5e5ea;
                border-radius: 16px; background: #fafafa; }
    .controls h2 { font-size: 15px; margin: 0 0 8px; }
    .btn { display: inline-block; padding: 10px 16px; border-radius: 10px;
           background: #0a84ff; color: #fff; text-decoration: none;
           font-weight: 600; font-size: 14px; }
    .controls p { font-size: 12px; color: #8e8e93; margin: 10px 0 0; }
    .meta { color: #8e8e93; font-size: 13px; margin-top: 24px; }
    .badge { display: inline-block; font-size: 11px; font-weight: 600;
             padding: 2px 8px; border-radius: 6px; }
    .badge.manual { background: #ffe5b4; color: #9a6700; }
    .badge.auto { background: #d4f4dd; color: #1a7f37; }
  </style>
</head>
<body>
  <img class="hero" src="${imageUrl}" alt="${PRODUCT.name}">
  <h1>${PRODUCT.name}</h1>
  <p class="price">A$${price}</p>
  <p class="avail ${effAvail === "InStock" ? "in" : "out"}">${availabilityText}</p>
  <p>${PRODUCT.description}</p>

  <div class="controls">
    <h2>Test controls
      <span class="badge ${overridden ? "manual" : "auto"}">${
        overridden ? "MANUAL OVERRIDE" : "AUTO (clock)"
      }</span>
    </h2>
    <a class="btn" href="${runWorkflowUrl}" target="_blank" rel="noopener">
      ⚙︎ Trigger a change →
    </a>
    <p>
      Opens GitHub Actions → click <b>Run workflow</b>, pick a command
      (drop / raise / toggle_stock / reset), and Run. Or from your Mac:
      <code>./trigger.sh drop</code>. Changes take ~25s to redeploy.
      Note: this button (and any browser JS) does <b>not</b> change what
      Save Genie's T1 fetch sees — only a redeploy does.
    </p>
  </div>

  <p class="meta">
    ${overridden ? "Manual override active" : `Auto slot ${slot}/${SCHEDULE.length} — rotates every ${SLOT_HOURS}h`}
    · last command: <code>${command}</code>
    · generated ${now.toISOString()}
  </p>
</body>
</html>
`;

// --- Product image (stable absolute asset) --------------------------------

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
  `command=${command} → ${CURRENCY} ${price} (${effAvail}) ` +
    `[${overridden ? "manual" : `auto slot ${slot}`}] @ ${now.toISOString()}`
);
