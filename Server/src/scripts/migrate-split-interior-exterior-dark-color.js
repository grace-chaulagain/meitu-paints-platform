/**
 * One-time migration: removes the "INTERIOR_EXTERIOR_PAINT" category
 * entirely, splitting its two families by their existing C1/C2 split -
 * "Dark Color ... C1" (interior formulation) moves to INTERIOR_PAINT,
 * "Dark Color ... C2" (exterior formulation) moves to EXTERIOR_PAINT.
 * Applies to both the ProductFamily and its Product (per-size) documents.
 *
 * Idempotent: matches by code, safe to re-run (no-op once already moved).
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/migrate-split-interior-exterior-dark-color.js
 *   ... --dry-run
 */
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

const MOVES = [
  { code: "DARK-COLOR-INT-EXT-C1", nextCategory: "INTERIOR_PAINT" },
  { code: "DARK-COLOR-INT-EXT-C2", nextCategory: "EXTERIOR_PAINT" },
];

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  assertSafeDatabaseWrite({ mongoUri, operation: "split INTERIOR_EXTERIOR_PAINT category" });
  console.log(`[db-write] ${describeDatabaseTarget(mongoUri)} dryRun=${DRY_RUN}`);

  await mongoose.connect(mongoUri);

  for (const { code, nextCategory } of MOVES) {
    const family = await ProductFamily.findOne({ code });
    const products = await Product.find({ code });

    console.log(`[${code}] family found: ${Boolean(family)}, products: ${products.length} -> ${nextCategory}`);

    if (!DRY_RUN) {
      if (family) {
        family.category = nextCategory;
        await family.save();
      }
      for (const product of products) {
        product.category = nextCategory;
        await product.save();
      }
    }
  }

  const remaining = await ProductFamily.countDocuments({ category: "INTERIOR_EXTERIOR_PAINT" });
  const remainingProducts = await Product.countDocuments({ category: "INTERIOR_EXTERIOR_PAINT" });
  console.log(`[done] remaining families in INTERIOR_EXTERIOR_PAINT: ${remaining}, products: ${remainingProducts}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-split-interior-exterior-dark-color] Failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
