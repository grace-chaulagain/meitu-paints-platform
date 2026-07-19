// Wall Putty's new price list has two columns - "PB Land" (Project Based)
// and "RB Land" (Retail Based) - which aren't a quantity discount, so they
// don't fit the tiers[] model at all. Per the user: the dealer should pick
// PB or RB the same way they'd pick a pack size. So this models PB/RB as
// two ordinary product variants under the same family/code (exactly like
// two pack sizes), each with its own flat price - reuses the existing
// pack-size-picker UI in ProductSheet/VariantRow with zero frontend changes.
//
// The existing SKU (WALLPUTTY-*-20KG) becomes the PB variant (its price
// already matched the PDF's "PB Land" column before it was flagged
// priceless) - relabeled "20KG (PB)". A new sibling SKU is inserted for RB.
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const WALL_PUTTY = [
  { existingSku: "WALLPUTTY-WHITE-20KG", pbPrice: 565, rbSku: "WALLPUTTY-WHITE-20KG-RB", rbPrice: 665 },
  { existingSku: "WALLPUTTY-GRAY-20KG", pbPrice: 650, rbSku: "WALLPUTTY-GRAY-20KG-RB", rbPrice: 750 },
];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "set up Wall Putty PB/RB variants" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  for (const entry of WALL_PUTTY) {
    const existing = await Product.findOne({ sku: entry.existingSku }).lean();
    if (!existing) {
      console.warn(`  ! ${entry.existingSku} not found, skipping`);
      continue;
    }

    console.log(`  ${entry.existingSku}: pack.label "${existing.pack?.label}" -> "20KG (PB)", price -> ${entry.pbPrice}`);
    if (mode === "apply") {
      await Product.updateOne(
        { sku: entry.existingSku },
        {
          $set: {
            "pack.label": "20KG (PB)",
            "pricing.tiers": [{ min: 1, max: null, pricePerPack: entry.pbPrice }],
            basePrice: entry.pbPrice,
          },
        },
      );
    }

    const rbExisting = await Product.findOne({ sku: entry.rbSku }).lean();
    if (rbExisting) {
      console.log(`  ${entry.rbSku} already exists, skipping insert`);
      continue;
    }
    console.log(`  will insert ${entry.rbSku}: pack.label "20KG (RB)", price ${entry.rbPrice}`);
    if (mode === "apply") {
      await Product.create({
        sku: entry.rbSku,
        code: existing.code,
        name: existing.name,
        category: existing.category,
        description: existing.description,
        uom: existing.uom,
        pack: { label: "20KG (RB)", size: existing.pack.size, unit: existing.pack.unit },
        pricing: {
          model: "FLAT",
          pricingModelKey: "FLAT",
          basis: "PER_PACK",
          tierUnit: existing.pricing.tierUnit,
          tiers: [{ min: 1, max: null, pricePerPack: entry.rbPrice }],
        },
        currency: existing.currency || "NPR",
        basePrice: entry.rbPrice,
        isActive: true,
        meta: { source: "fy2083_dp_price_list", notes: "RB (Retail Based) variant, added alongside existing PB SKU" },
      });
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
