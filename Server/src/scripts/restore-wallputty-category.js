// Reverts the "fold Wall Putty into Specialty" part of
// rename-products-fy2083-84.js - Wall Putty gets its own distinct category
// again. No change needed in factoryHelpers.js: its proformaBucketKey()
// already matches Wall Putty by product `code` prefix (not category), so
// the 5% excise rate applies correctly regardless of which category Wall
// Putty is filed under.
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const WALLPUTTY_CODES = ["WALLPUTTY-WHITE-20KG", "WALLPUTTY-GRAY-20KG"];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "restore Wall Putty as its own category" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  for (const code of WALLPUTTY_CODES) {
    const products = await Product.find({ code }).lean();
    console.log(`  ${code}: ${products.length} SKU(s), category ${products[0]?.category} -> WALL_PUTTY`);
    if (mode === "apply") {
      await Product.updateMany({ code }, { $set: { category: "WALL_PUTTY" } });
      await ProductFamily.updateOne({ code }, { $set: { category: "WALL_PUTTY" } });
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
