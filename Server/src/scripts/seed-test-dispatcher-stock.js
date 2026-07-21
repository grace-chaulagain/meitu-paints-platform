// Seeds DispatcherProductStock for the TEST dispatcher account
// (dispatcher.test@meitu.internal), sourced from a real dispatcher's
// (Kritagya Traders) inventory stock transcription, for realistic-looking
// test data. Matched by hand against the current product catalog - see
// the inline comments below for the handful of judgment calls made where
// the source sheet's naming was ambiguous. Six source rows had no safe
// product match at all and are intentionally left out (Bases 277/225/
// 16005/223 - a different tinting-base code system, not Meitu's own
// colorants; Black Primer - no such product exists; Dust proof - 3
// equally-plausible candidates, no qualifier given; Texture 217/6005/223 -
// same unmatched code system as Bases; Floor Paint Roller - ambiguous
// between the 4" and 9" set; Yellow Tape - no matching product and no
// pieces-per-carton given to even compute a quantity).
//
// Usage:
//   node src/scripts/seed-test-dispatcher-stock.js
//   node src/scripts/seed-test-dispatcher-stock.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const TEST_DISPATCHER_EMAIL = "dispatcher.test@meitu.internal";

// sku -> currentQuantity. Where a source item appeared on two separate
// lines for the same pack size (e.g. rows 4 & 29 both being "High Glossy
// Interior", rows 28 & 30 both being "Constant Interior"), the two
// quantities are pre-summed here into one line.
const STOCK = {
  // 1. Eco-friendly Primer - "25L" has no matching pack anywhere in the
  // catalog (only 1/4/10/20L exist); treated as a transcription typo for 20L.
  "ECO-INT-PRIMER-20L": 25,
  "ECO-INT-PRIMER-10L": 26,
  "ECO-INT-PRIMER-4L": 8,
  "ECO-INT-PRIMER-1L": 12,

  // 2. Environmental Efficient Exterior primer
  "EE-EXT-PRIMER-20L": 15,

  // 3. Celling White - no "High Glossy" qualifier given, so mapped to the
  // plain Eco Friendly Ceiling White rather than the High Glossy variant.
  "ECO-CEILING-WHITE-20L": 8,
  "ECO-CEILING-WHITE-10L": 5,

  // 4 + 29. High Glossy Interior Wall Paint / "Eco-friendly High Glossy
  // Interior" - only one such product exists in the catalog, so row 29 is
  // treated as additional stock for the same product and summed with row 4.
  "ECO-HG-INT-20L": 20 + 3,
  "ECO-HG-INT-10L": 8 + 9,
  "ECO-HG-INT-4L": 4,
  "ECO-HG-INT-1L": 6 + 10,

  // 5 + 19. High Glossy Nature Exterior (two rows, different pack sizes)
  "ECO-HG-NAT-EXT-20L": 6,
  "ECO-HG-NAT-EXT-10L": 7,
  "ECO-HG-NAT-EXT-4L": 8,
  "ECO-HG-NAT-EXT-1L": 6,

  // 6. Alkai Primer -> Alkali Resistant Interior Primer
  "ALKALI-RES-INT-PRIMER-20L": 8,
  "ALKALI-RES-INT-PRIMER-10L": 12,
  "ALKALI-RES-INT-PRIMER-4L": 8,
  "ALKALI-RES-INT-PRIMER-1L": 12,

  // 7. Spray - no size/type qualifier; mapped to the primary Spray Gun set.
  "TOOLS-SPRAY-GUN-WITH-SET-1SET": 5,

  // 8. Floor Paint Shores -> Floor Paint Shoes
  "TOOLS-FLOOR-PAINT-SHOES-1PAIR": 30,

  // 9. Safty belt
  "TOOLS-SAFETY-BELT-SINGLE-HOOK-1PC": 20,
  "TOOLS-SAFETY-BELT-DOUBLE-HOOK-1PC": 15,

  // 10. Acrille Distemper
  "ACRYLIC-DIST-INT-20KG": 4,
  "ACRYLIC-DIST-INT-10KG": 8,
  "ACRYLIC-DIST-INT-5KG": 5,

  // 11. Silicion -> PU Silicon
  "PU-SILICON-EXT-INT-4L": 12,

  // 12. White Enamel
  "ENAMEL-G1-WHITE-4L": 16,

  // 13. Black Enamel
  "ENAMEL-G1-BLACK-4L": 12,
  "ENAMEL-G1-BLACK-500ML": 16,

  // 14. Phiroza
  "ENAMEL-G2-PHIROZA-1L": 12,
  "ENAMEL-G2-PHIROZA-500ML": 16,

  // 15. Yellow Enamel -> Golden Yellow (only yellow-named enamel in catalog)
  "ENAMEL-G3-GOLDEN-YELLOW-1L": 18,

  // 16. Leaf Brown
  "ENAMEL-G2-LEAF-BROWN-1L": 18,

  // 17. Paint Safe Plastic Cover
  "TOOLS-PLASTIC-COVER-20M-1ROLL": 200,

  // 18. High Glossy Exterior
  "ECO-HG-EXT-10L": 8,
  "ECO-HG-EXT-4L": 8,
  "ECO-HG-EXT-1L": 16,

  // 20. Environmentally friendly Nature Exterior -> Friendly Natural Exterior
  "ENV-FRIENDLY-NAT-EXT-20L": 2,
  "ENV-FRIENDLY-NAT-EXT-10L": 3,
  "ENV-FRIENDLY-NAT-EXT-4L": 8,
  "ENV-FRIENDLY-NAT-EXT-1L": 6,

  // 21. Constant Exterior
  "ENV-FRIENDLY-CONST-EXT-20L": 3,
  "ENV-FRIENDLY-CONST-EXT-10L": 4,
  "ENV-FRIENDLY-CONST-EXT-4L": 4,
  "ENV-FRIENDLY-CONST-EXT-1L": 6,

  // 22. Aluminum
  "ALUMINUM-PAINTS-1L": 18,
  "ALUMINUM-PAINTS-0_5L": 24,

  // 23. Wood Primer
  "WOOD-PRIMER-4L": 20,
  "WOOD-PRIMER-1L": 18,
  "WOOD-PRIMER-500ML": 16,

  // 24. Metal Primer
  "METAL-PRIMER-4L": 8,
  "METAL-PRIMER-1L": 12,

  // 25. Terracotta
  "TERRACOTTA-10L": 2,
  "TERRACOTTA-4L": 12,
  "TERRACOTTA-1L": 30,

  // 26. Golden -> Gold Color
  "GOLD-COLOR-500ML": 24,
  "GOLD-COLOR-200ML": 24,
  "GOLD-COLOR-100ML": 48,

  // 27. Damproof
  "MEITU-DAMP-PROOF-20L": 5,
  "MEITU-DAMP-PROOF-10L": 5,
  "MEITU-DAMP-PROOF-4L": 8,
  "MEITU-DAMP-PROOF-1L": 12,

  // 28 + 30. Constant Interior / "Environmentally Constant Interior" -
  // same product, summed (see High Glossy Interior note above).
  "ENV-FRIENDLY-CONST-INT-20L": 4 + 3,
  "ENV-FRIENDLY-CONST-INT-10L": 5 + 4,
  "ENV-FRIENDLY-CONST-INT-4L": 8,
  "ENV-FRIENDLY-CONST-INT-1L": 16,

  // 31. Dark C2
  "DARK-COLOR-INT-EXT-C2-20L": 1,
  "DARK-COLOR-INT-EXT-C2-4L": 21,

  // 32. Dark C1
  "DARK-COLOR-INT-EXT-C1-20L": 1,
  "DARK-COLOR-INT-EXT-C1-4L": 3,

  // 33. High Glossy Nature Interior
  "ECO-HG-NAT-INT-10L": 17,
  "ECO-HG-NAT-INT-4L": 14,
  "ECO-HG-NAT-INT-20L": 3,

  // 38. Putty Exterior -> Exterior Grey Waterproof Wall Putty (PB variant;
  // source didn't distinguish PB/RB batch)
  "WALLPUTTY-GRAY-20KG": 30,

  // 39. Putty Interior -> Interior White Wall Putty (PB variant, same note)
  "WALLPUTTY-WHITE-20KG": 100,

  // 40. Smoke gray
  "ENAMEL-G2-SMOKE-GRAY-4L": 3,
  "ENAMEL-G2-SMOKE-GRAY-1L": 12,

  // 41. Floor Paint -> Granite Epoxy Floor Paint (the merged bundle SET)
  "GRANITE-FLOOR-SET-1SET": 4,

  // 42. Pro-Red -> Po Red
  "ENAMEL-G2-PO-RED-1L": 25,
  "ENAMEL-G2-PO-RED-500ML": 18,

  // 43. Chocolate Enamel
  "ENAMEL-G1-CHOCOLATE-1L": 10,
  "ENAMEL-G1-CHOCOLATE-500ML": 14,
};

// Rows 34 (Bases), 35 (Black Primer), 36 (Dust proof), 37 (Texture),
// 44 (Floor Paint Roller), 45 (Yellow Tape) - intentionally skipped, no
// safe match. See file header comment for why.

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed test dispatcher stock" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const dispatcherUser = await Dispatcher.findOne({ email: TEST_DISPATCHER_EMAIL }).select("_id companyName");
  if (!dispatcherUser) {
    throw new Error(`Test dispatcher not found (${TEST_DISPATCHER_EMAIL}) - run seed-test-dispatcher.js first.`);
  }
  console.log(`Target dispatcher: ${dispatcherUser.companyName} (${dispatcherUser._id})\n`);

  const skus = Object.keys(STOCK);
  const products = await Product.find({ sku: { $in: skus } }).select("_id sku name").lean();
  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const missing = skus.filter((sku) => !productBySku.has(sku));
  if (missing.length) {
    throw new Error(`These SKUs don't exist in the product catalog: ${missing.join(", ")}`);
  }

  console.log(`Rows to seed: ${skus.length}`);
  skus.forEach((sku) => {
    const p = productBySku.get(sku);
    console.log(`  ${p.name} (${sku}): ${STOCK[sku]}`);
  });

  if (mode !== "apply") {
    console.log("\nDry run complete - re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const sku of skus) {
    const product = productBySku.get(sku);
    await DispatcherProductStock.findOneAndUpdate(
      { dispatcherId: dispatcherUser._id, productId: product._id },
      { $set: { currentQuantity: STOCK[sku], lastUpdatedAt: new Date() } },
      { upsert: true },
    );
    written += 1;
  }

  console.log(`\nDone. Seeded stock for ${written} products.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
