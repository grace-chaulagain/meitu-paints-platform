// Corrects Tools & Accessories prices - the user supplied a cleaner "Color
// Tools And Accessories" price list image after migrate-fy2083-pricing.js
// already applied a first-pass (incorrect) transcription. Same 22 kept
// items, same set of retired SKUs (untouched here) - only the price numbers
// change, plus one apparent transcription correction: "7\" Regular Paint
// Roller" is actually "9\" Regular Paint Roller" (distinct from the
// existing "9\" Floor Paints Roller" product line, so this is a rename of
// the roller SKU, not a new/conflicting item).
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const PRICE_UPDATES = {
  "TOOLS-MANUAL-MACHINE-1PC": 134750,
  "TOOLS-AUTOMATIC-MACHINE-1PC": 279000,
  "TOOLS-COLOR-MIXING-MACHINE-1PC": 100000,
  "TOOLS-SPRAY-GUN-WITH-SET-1SET": 7345,
  "TOOLS-SPRAY-GUN-HEAD-1PC": 3000,
  "TOOLS-REAL-STONE-PAINT-GUN-1PC": 6345,
  "TOOLS-AIR-COMPRESSOR-MACHINE-1PC": 38550,
  "TOOLS-SEWING-TAPE-50M": 70,
  "TOOLS-FLOOR-ROLLER-9IN-1SET": 220,
  "TOOLS-FLOOR-ROLLER-4IN-1PC": 52,
  "TOOLS-FLOOR-ROLLER-HANDLE-4IN-1PC": 57,
  "TOOLS-SAFETY-BELT-SINGLE-HOOK-1PC": 1890,
  "TOOLS-SAFETY-BELT-DOUBLE-HOOK-1PC": 2990,
  "TOOLS-FLOOR-PAINT-SHOES-1PAIR": 1200,
  "TOOLS-PLASTIC-COVER-20M-1ROLL": 160,
  "TOOLS-REGULAR-ROLLER-4IN-1PC": 62,
  "TOOLS-FOAM-TAPE-2MM-3MM-1PC": 104,
  "TOOLS-PUTTING-PATA-HANDLE-1PC": 140,
  "TOOLS-PUTTING-KNIFE-1PC": 120,
  "TOOLS-DESIGN-TAPE-50M-1SET": 2650,
  "TOOLS-SCAFFOLDING-1SET": 14500,
};

const ROLLER_RENAME = {
  oldSku: "TOOLS-REGULAR-ROLLER-7IN-1SET",
  oldCode: "TOOLS-REGULAR-ROLLER-7IN-SET",
  newSku: "TOOLS-REGULAR-ROLLER-9IN-1SET",
  newCode: "TOOLS-REGULAR-ROLLER-9IN-SET",
  newName: "9” Regular Paint Roller",
  price: 100,
};

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "correct Tools & Accessories prices" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  console.log(`=== Price corrections (${Object.keys(PRICE_UPDATES).length} SKUs) ===`);
  for (const [sku, price] of Object.entries(PRICE_UPDATES)) {
    const existing = await Product.findOne({ sku }).lean();
    if (!existing) {
      console.warn(`  ! SKU not found, skipping: ${sku}`);
      continue;
    }
    const oldPrice = existing.pricing?.tiers?.[0]?.pricePerPack;
    console.log(`  ${sku} (${existing.name}): ${oldPrice} -> ${price}${oldPrice === price ? " (unchanged)" : ""}`);
    if (mode === "apply") {
      await Product.updateOne(
        { sku },
        {
          $set: {
            "pricing.tiers": [{ min: 1, max: null, pricePerPack: price, priceExclTax: price, priceInclTax: null }],
            basePrice: price,
          },
        },
      );
    }
  }

  console.log(`\n=== Roller rename: ${ROLLER_RENAME.oldSku} -> ${ROLLER_RENAME.newSku} ===`);
  const roller = await Product.findOne({ sku: ROLLER_RENAME.oldSku }).lean();
  if (!roller) {
    console.warn(`  ! ${ROLLER_RENAME.oldSku} not found`);
  } else {
    console.log(`  "${roller.name}" (pack ${roller.pack?.label}) -> "${ROLLER_RENAME.newName}" (pack 1SET), price ${roller.pricing?.tiers?.[0]?.pricePerPack} -> ${ROLLER_RENAME.price}`);
    if (mode === "apply") {
      await Product.updateOne(
        { sku: ROLLER_RENAME.oldSku },
        {
          $set: {
            sku: ROLLER_RENAME.newSku,
            code: ROLLER_RENAME.newCode,
            name: ROLLER_RENAME.newName,
            "pricing.tiers": [{ min: 1, max: null, pricePerPack: ROLLER_RENAME.price, priceExclTax: ROLLER_RENAME.price, priceInclTax: null }],
            basePrice: ROLLER_RENAME.price,
          },
        },
      );
    }
  }

  console.log(mode === "apply" ? "\nDone." : "\nDry run complete - re-run with --apply to write.");
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
