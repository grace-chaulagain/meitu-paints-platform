// Updates "Dipak Trading House" (dth2075@gmail.com, real production
// dispatcher) replenishment pricing to match the official price list PDF
// ("Dipak trading dhangadi 8% price.pdf"). Every [code, packLabel, price]
// line below was hand-matched against the live catalog by code + pack
// label - price is the PDF's own "Price" (tax-inclusive) column; netPrice
// is never taken from the PDF's "Net Price" column, it's always
// recomputed server-side by upsertDispatcherPricing() (same tax formula,
// see dispatcherPricing.service.js's computeNetPrice) so it can't drift.
// Spot-checked several PDF Net Price values against that formula before
// trusting the rest of the sheet - they reconcile to within ±1 (rounding),
// e.g. Interior White Wall Putty 20kg: round(612/1.13/1.05) = 516,
// matching the PDF exactly.
//
// This calls the real upsertDispatcherPricing() service function directly
// (not a raw DB write) - the exact same code path the admin pricing UI
// uses - so there's no risk of the tax math drifting from production.
//
// Deliberately NOT priced here (left exactly as they already are):
//   - Every COLORANT-* product - the PDF doesn't mention colorants at all.
//   - GRANITE-FLOOR-GRIPCOAT-A/B, TRUE-BOND-A/B, PRIME-SHINE-A/B, SURFACE -
//     these are sellable:false sub-components of the Granite Epoxy Floor
//     kit; only GRANITE-FLOOR-SET (the orderable "1 SET" SKU) is priced,
//     from the PDF's single combined 9.6kg/230sqft total (21735).
//   - WALLPUTTY-*-20KG "(RB)" pack variant - the PDF gives one price per
//     putty product with no PB/RB split. Only "(PB)" is priced here,
//     mirroring the same judgment call already made for this dispatcher's
//     stock seed (seed-real-dispatcher-inventory.js) for consistency.
//   - The three "Total Nkg/Nsqft" bundle rows on the Granite Wall Textures
//     page (2D/3D/Real Stone) - these are a suggested full-system total
//     across several already-separately-priced SKUs, not their own
//     orderable product.
//
// Usage:
//   node -r dotenv/config src/scripts/update-dipak-dispatcher-pricing.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/update-dipak-dispatcher-pricing.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Dispatcher from "../models/Dispatcher.model.js";
import Product from "../models/Product.model.js";
import User from "../models/User.model.js";
import { upsertDispatcherPricing } from "../services/dispatcherPricing.service.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DISPATCHER_EMAIL = "dth2075@gmail.com";

function normLabel(s) {
  return String(s || "").toUpperCase().replace(/\s+/g, "");
}

// [code, packLabel, price] - price is the PDF's "Price" (tax-inclusive) column.
const PRICE_ROWS = [
  // Meitu Regular Exterior Emulsion
  ["ECO-HG-EXT", "20L", 15230], ["ECO-HG-EXT", "10L", 8251], ["ECO-HG-EXT", "4L", 3303], ["ECO-HG-EXT", "1L", 839],
  ["ECO-HG-NAT-EXT", "20L", 11632], ["ECO-HG-NAT-EXT", "10L", 6190], ["ECO-HG-NAT-EXT", "4L", 2770], ["ECO-HG-NAT-EXT", "1L", 698],
  ["ENV-FRIENDLY-NAT-EXT", "20L", 9252], ["ENV-FRIENDLY-NAT-EXT", "10L", 4746], ["ENV-FRIENDLY-NAT-EXT", "4L", 1982], ["ENV-FRIENDLY-NAT-EXT", "1L", 539],
  ["ENV-FRIENDLY-CONST-EXT", "20L", 5640], ["ENV-FRIENDLY-CONST-EXT", "10L", 2992], ["ENV-FRIENDLY-CONST-EXT", "4L", 1054], ["ENV-FRIENDLY-CONST-EXT", "1L", 303],
  ["DARK-COLOR-INT-EXT-C2", "20L", 14725], ["DARK-COLOR-INT-EXT-C2", "10L", 7972], ["DARK-COLOR-INT-EXT-C2", "4L", 3192], ["DARK-COLOR-INT-EXT-C2", "1L", 800],

  // Meitu Regular Interior Emulsion
  ["ECO-HG-INT", "20L", 15274], ["ECO-HG-INT", "10L", 7968], ["ECO-HG-INT", "4L", 3197], ["ECO-HG-INT", "1L", 798],
  ["ECO-HG-NAT-INT", "20L", 12693], ["ECO-HG-NAT-INT", "10L", 6747], ["ECO-HG-NAT-INT", "4L", 2853], ["ECO-HG-NAT-INT", "1L", 719],
  ["ENV-FRIENDLY-NAT-INT", "20L", 9111], ["ENV-FRIENDLY-NAT-INT", "10L", 4669], ["ENV-FRIENDLY-NAT-INT", "4L", 1910], ["ENV-FRIENDLY-NAT-INT", "1L", 532],
  ["ENV-FRIENDLY-CONST-INT", "20L", 5345], ["ENV-FRIENDLY-CONST-INT", "10L", 2770], ["ENV-FRIENDLY-CONST-INT", "4L", 1169], ["ENV-FRIENDLY-CONST-INT", "1L", 307],
  ["DARK-COLOR-INT-EXT-C1", "20L", 8481], ["DARK-COLOR-INT-EXT-C1", "10L", 4566], ["DARK-COLOR-INT-EXT-C1", "4L", 1915], ["DARK-COLOR-INT-EXT-C1", "1L", 492],

  // Page 3
  ["ECO-INT-WALL", "20L", 3505], ["ECO-INT-WALL", "10L", 1861], ["ECO-INT-WALL", "4L", 808], ["ECO-INT-WALL", "1L", 230],
  ["ECO-HG-CEILING-WHITE", "20L", 11045], ["ECO-HG-CEILING-WHITE", "10L", 6021], ["ECO-HG-CEILING-WHITE", "4L", 2410], ["ECO-HG-CEILING-WHITE", "1L", 605],
  ["ECO-CEILING-WHITE", "20L", 4329], ["ECO-CEILING-WHITE", "10L", 2415], ["ECO-CEILING-WHITE", "4L", 971], ["ECO-CEILING-WHITE", "1L", 248],
  ["ACRYLIC-DIST-INT", "20KG", 1730], ["ACRYLIC-DIST-INT", "10KG", 883], ["ACRYLIC-DIST-INT", "5KG", 451],

  // Meitu Primers
  ["EE-EXT-PRIMER", "20L", 3988], ["EE-EXT-PRIMER", "10L", 2133], ["EE-EXT-PRIMER", "4L", 903], ["EE-EXT-PRIMER", "1L", 290],
  ["ALKALI-RES-INT-PRIMER", "20L", 3324], ["ALKALI-RES-INT-PRIMER", "10L", 1663], ["ALKALI-RES-INT-PRIMER", "4L", 789], ["ALKALI-RES-INT-PRIMER", "1L", 236],
  ["ECO-INT-PRIMER", "20L", 2006], ["ECO-INT-PRIMER", "10L", 1053], ["ECO-INT-PRIMER", "4L", 527], ["ECO-INT-PRIMER", "1L", 140],

  // Meitu Granite Wall Textures - Granite 2D
  ["GTONE-2D-GRANITE-PRIMER", "5KG", 1964],
  ["GTONE-2D-INTERMEDIATE-COAT", "8KG", 3533],
  ["GTONE-2D-GRANITE-SURFACE", "9KG", 8703],
  ["GTONE-2D-DUSTPROOF-SURFACE", "3KG", 2249],
  ["GTONE-2D-GRANITE-SURFACE", "4KG", 3933],
  // Granite 3D
  ["GTONE-3D-GRANITE-PRIMER", "3KG", 1182],
  ["GTONE-3D-INTERMEDIATE-COAT", "5KG", 2213],
  ["GTONE-3D-GRANITE-SURFACE", "24KG", 14131],
  ["GTONE-3D-DUSTPROOF-SURFACE", "3KG", 2249],
  // Real Stone Paint
  ["REALSTONE-PRIMER", "3KG", 1003],
  ["REALSTONE-SURFACE", "60KG", 11564],
  ["REALSTONE-DUSTPROOF", "3KG", 1978],

  // Meitu Granite Epoxy Floor Paint - one combined price for the whole kit
  ["GRANITE-FLOOR-SET", "1 SET", 21735],

  // MeiTu Wall Putty Price List (PB variant only - see header note)
  ["WALLPUTTY-WHITE-20KG", "20KG (PB)", 612],
  ["WALLPUTTY-GRAY-20KG", "20KG (PB)", 690],

  // Meitu Primer with Enamels
  ["WOOD-PRIMER", "4L", 1165], ["WOOD-PRIMER", "1L", 305], ["WOOD-PRIMER", "500ML", 155],
  ["METAL-PRIMER", "4L", 940], ["METAL-PRIMER", "1L", 260], ["METAL-PRIMER", "500ML", 130],
  // White, Chocolate, Black
  ["ENAMEL-G1-WHITE", "4L", 2544], ["ENAMEL-G1-WHITE", "1L", 644], ["ENAMEL-G1-WHITE", "500ML", 335],
  ["ENAMEL-G1-CHOCOLATE", "4L", 2544], ["ENAMEL-G1-CHOCOLATE", "1L", 644], ["ENAMEL-G1-CHOCOLATE", "500ML", 335],
  ["ENAMEL-G1-BLACK", "4L", 2544], ["ENAMEL-G1-BLACK", "1L", 644], ["ENAMEL-G1-BLACK", "500ML", 335],
  // Po Red, Leaf Brown, Phiroza, Smoke Gray
  ["ENAMEL-G2-PO-RED", "4L", 2356], ["ENAMEL-G2-PO-RED", "1L", 598], ["ENAMEL-G2-PO-RED", "500ML", 325],
  ["ENAMEL-G2-LEAF-BROWN", "4L", 2356], ["ENAMEL-G2-LEAF-BROWN", "1L", 598], ["ENAMEL-G2-LEAF-BROWN", "500ML", 325],
  ["ENAMEL-G2-PHIROZA", "4L", 2356], ["ENAMEL-G2-PHIROZA", "1L", 598], ["ENAMEL-G2-PHIROZA", "500ML", 325],
  ["ENAMEL-G2-SMOKE-GRAY", "4L", 2356], ["ENAMEL-G2-SMOKE-GRAY", "1L", 598], ["ENAMEL-G2-SMOKE-GRAY", "500ML", 325],
  // Bus Green, Golden Brown, Golden Yellow
  ["ENAMEL-G3-BUS-GREEN", "4L", 2176], ["ENAMEL-G3-BUS-GREEN", "1L", 556], ["ENAMEL-G3-BUS-GREEN", "500ML", 290],
  ["ENAMEL-G3-GOLDEN-BROWN", "4L", 2176], ["ENAMEL-G3-GOLDEN-BROWN", "1L", 556], ["ENAMEL-G3-GOLDEN-BROWN", "500ML", 290],
  ["ENAMEL-G3-GOLDEN-YELLOW", "4L", 2176], ["ENAMEL-G3-GOLDEN-YELLOW", "1L", 556], ["ENAMEL-G3-GOLDEN-YELLOW", "500ML", 290],
  // Sky Blue, Olive Green, Mint Green, Oxford Blue, Deep orange
  ["ENAMEL-G4-SKY-BLUE", "4L", 1923], ["ENAMEL-G4-SKY-BLUE", "1L", 494], ["ENAMEL-G4-SKY-BLUE", "500ML", 253],
  ["ENAMEL-G4-OLIVE-GREEN", "4L", 1923], ["ENAMEL-G4-OLIVE-GREEN", "1L", 494], ["ENAMEL-G4-OLIVE-GREEN", "500ML", 253],
  ["ENAMEL-G4-MINT-GREEN", "4L", 1923], ["ENAMEL-G4-MINT-GREEN", "1L", 494], ["ENAMEL-G4-MINT-GREEN", "500ML", 253],
  ["ENAMEL-G4-OXFORD-BLUE", "4L", 1923], ["ENAMEL-G4-OXFORD-BLUE", "1L", 494], ["ENAMEL-G4-OXFORD-BLUE", "500ML", 253],
  ["ENAMEL-G4-DEEP-ORANGE", "4L", 1923], ["ENAMEL-G4-DEEP-ORANGE", "1L", 494], ["ENAMEL-G4-DEEP-ORANGE", "500ML", 253],

  // Page 8
  ["ALUMINUM-PAINTS", "1L", 626], ["ALUMINUM-PAINTS", "0.5L", 364],
  ["GOLD-COLOR", "500ML", 1317], ["GOLD-COLOR", "200ML", 559], ["GOLD-COLOR", "100ML", 309],
  ["PU-SILICON-EXT-INT", "4L", 2975], ["PU-SILICON-EXT-INT", "1L", 824], ["PU-SILICON-EXT-INT", "0.5L", 420],
  ["TERRACOTTA", "20L", 10948], ["TERRACOTTA", "10L", 5993], ["TERRACOTTA", "4L", 2401], ["TERRACOTTA", "1L", 619],
  ["MEITU-DAMP-PROOF", "20L", 11753], ["MEITU-DAMP-PROOF", "10L", 5892], ["MEITU-DAMP-PROOF", "4L", 2405], ["MEITU-DAMP-PROOF", "1L", 611],

  // Color Tools And Accessories (PDF gives one tax-inclusive figure per row
  // here, not a Net/Price split - stored as-is into `price`, netPrice is
  // still server-computed same as every other row)
  ["TOOLS-MANUAL-MACHINE", "1PC", 126665],
  ["TOOLS-AUTOMATIC-MACHINE", "1PC", 262260],
  ["TOOLS-COLOR-MIXING-MACHINE", "1PC", 94000],
  ["TOOLS-SPRAY-GUN-WITH-SET", "1SET", 6904], // PDF pack size "2L" describes tank capacity, not the catalog's own "1SET" unit label - single-variant product, unambiguous
  ["TOOLS-SPRAY-GUN-HEAD", "1PC", 2820],
  ["TOOLS-REAL-STONE-PAINT-GUN", "1PC", 5964],
  ["TOOLS-AIR-COMPRESSOR-MACHINE", "1PC", 36237], // PDF pack "Table" - single-variant product, unambiguous
  ["TOOLS-SEWING-TAPE", "50M", 65],
  ["TOOLS-FLOOR-ROLLER-9IN-SET", "1SET", 206],
  ["TOOLS-FLOOR-ROLLER-4IN", "1PC", 49],
  ["TOOLS-FLOOR-ROLLER-HANDLE-4IN", "1PC", 53],
  ["TOOLS-REGULAR-ROLLER-9IN-SET", "1SET", 94],
  ["TOOLS-SAFETY-BELT-SINGLE-HOOK", "1PC", 1776],
  ["TOOLS-SAFETY-BELT-DOUBLE-HOOK", "1PC", 2810],
  ["TOOLS-FLOOR-PAINT-SHOES", "1PAIR", 1034],
  ["TOOLS-PLASTIC-COVER-20M", "1ROLL", 150],
  ["TOOLS-REGULAR-ROLLER-4IN", "1PC", 58],
  ["TOOLS-FOAM-TAPE-2MM-3MM", "1PC", 97],
  ["TOOLS-PUTTING-PATA-HANDLE", "1PC", 131],
  ["TOOLS-PUTTING-KNIFE", "1PC", 113],
  ["TOOLS-DESIGN-TAPE-50M", "1SET", 2491],
  ["TOOLS-SCAFFOLDING-SET", "1SET", 13630],
];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "update Dipak dispatcher pricing", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");

  await mongoose.connect(MONGODB_URI);

  const dispatcher = await Dispatcher.findOne({ email: DISPATCHER_EMAIL });
  if (!dispatcher) throw new Error(`Dispatcher not found: ${DISPATCHER_EMAIL}`);
  console.log(`Dispatcher: ${dispatcher.companyName} (${dispatcher._id})\n`);

  const products = await Product.find({ isActive: { $ne: false } }).select("_id code name pack").lean();
  const byCodeAndLabel = new Map();
  for (const p of products) {
    byCodeAndLabel.set(`${p.code}::${normLabel(p.pack?.label)}`, p);
  }

  const resolved = [];
  const lookupFailures = [];
  for (const [code, packLabel, price] of PRICE_ROWS) {
    const key = `${code}::${normLabel(packLabel)}`;
    const product = byCodeAndLabel.get(key);
    if (!product) {
      lookupFailures.push(`${code} / ${packLabel} (price ${price})`);
      continue;
    }
    resolved.push({ product, price });
  }

  if (lookupFailures.length) {
    console.log(`! LOOKUP FAILURES (mapping bug - fix the script, do not apply):`);
    lookupFailures.forEach((f) => console.log(`    ${f}`));
    console.log("");
  }

  console.log(`Matched ${resolved.length}/${PRICE_ROWS.length} line(s).`);

  if (mode === "dry-run") {
    console.log("\nWould write:");
    resolved.forEach(({ product, price }) => console.log(`    ${product.name} (${product.code} ${product.pack?.label}): price=${price}`));
    console.log("\nDry run complete - no writes performed. Re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  if (lookupFailures.length) {
    console.log("Refusing to apply - lookup failures above must be fixed first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const admin = await User.findOne({ role: "ADMIN", isActive: { $ne: false } }).lean();
  const result = await upsertDispatcherPricing({
    dispatcherId: dispatcher._id,
    items: resolved.map(({ product, price }) => ({ productId: product._id, price })),
    adminUser: admin,
  });
  console.log("\nApplied via upsertDispatcherPricing:", JSON.stringify(result));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
