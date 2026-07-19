// Fixes a pre-existing catalog seed bug: every VOLUME_TOTAL-basis tiered
// pricing model (TOTALVOL_L_1_20_21_PLUS / VOL_L_1_80_81_250_251_PLUS)
// computes which tier applies as `pack.size * quantity`, which requires
// pack.size to always be expressed in liters (the "L" in the model name).
// 20 SKUs (500ML packs across Wood/Metal Primer and all Enamel shades, plus
// all 3 Gold Color sizes) were seeded with pack.size as the raw milliliter
// number instead of the liter-equivalent, so even a single unit's "volume"
// (500, 200, or 100) already exceeds the 20L tier ceiling - these SKUs
// always resolved to the 21L+ bulk-discount price regardless of order size.
// pack.label (e.g. "500ML") is left untouched - only the numeric pack.size/
// pack.unit and pricing.tierUnit fields, which drive the tier math and tier
// label text, are corrected to represent the same physical quantity in
// liters. Also normalizes uom.base for the 3 Gold Color SKUs (was "ML",
// every sibling product under this pricing model uses "L").
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

// sku -> { sizeMl: raw mL value currently stored as pack.size, fixUomBase: whether to also correct uom.base to "L" }
const AFFECTED_SKUS = {
  "WOOD-PRIMER-500ML": { sizeMl: 500 },
  "METAL-PRIMER-500ML": { sizeMl: 500 },
  "ENAMEL-G1-WHITE-500ML": { sizeMl: 500 },
  "ENAMEL-G1-CHOCOLATE-500ML": { sizeMl: 500 },
  "ENAMEL-G1-BLACK-500ML": { sizeMl: 500 },
  "ENAMEL-G2-PO-RED-500ML": { sizeMl: 500 },
  "ENAMEL-G2-LEAF-BROWN-500ML": { sizeMl: 500 },
  "ENAMEL-G2-PHIROZA-500ML": { sizeMl: 500 },
  "ENAMEL-G2-SMOKE-GRAY-500ML": { sizeMl: 500 },
  "ENAMEL-G3-BUS-GREEN-500ML": { sizeMl: 500 },
  "ENAMEL-G3-GOLDEN-BROWN-500ML": { sizeMl: 500 },
  "ENAMEL-G3-GOLDEN-YELLOW-500ML": { sizeMl: 500 },
  "ENAMEL-G4-DEEP-ORANGE-500ML": { sizeMl: 500 },
  "ENAMEL-G4-MINT-GREEN-500ML": { sizeMl: 500 },
  "ENAMEL-G4-OLIVE-GREEN-500ML": { sizeMl: 500 },
  "ENAMEL-G4-OXFORD-BLUE-500ML": { sizeMl: 500 },
  "ENAMEL-G4-SKY-BLUE-500ML": { sizeMl: 500 },
  "GOLD-COLOR-100ML": { sizeMl: 100, fixUomBase: true },
  "GOLD-COLOR-200ML": { sizeMl: 200, fixUomBase: true },
  "GOLD-COLOR-500ML": { sizeMl: 500, fixUomBase: true },
};

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "fix volume-tier unit mismatch", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  let fixed = 0;
  for (const [sku, { sizeMl, fixUomBase }] of Object.entries(AFFECTED_SKUS)) {
    const product = await Product.findOne({ sku }).lean();
    if (!product) {
      console.warn(`  ! SKU not found, skipping: ${sku}`);
      continue;
    }
    const sizeL = sizeMl / 1000;
    console.log(
      `  ${sku}: pack.size ${product.pack?.size}${product.pack?.unit} -> ${sizeL}L | tierUnit ${product.pricing?.tierUnit} -> L` +
        (fixUomBase ? ` | uom.base ${product.uom?.base} -> L` : ""),
    );
    if (mode === "apply") {
      const update = {
        "pack.size": sizeL,
        "pack.unit": "L",
        "pricing.tierUnit": "L",
      };
      if (fixUomBase) update["uom.base"] = "L";
      await Product.updateOne({ sku }, { $set: update });
      fixed += 1;
    }
  }

  console.log(mode === "apply" ? `\nFixed ${fixed} SKUs.` : `\nDry run complete - re-run with --apply to write.`);
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
