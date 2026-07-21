// Deletes every TOOLS_AND_ACCESSORIES Product (+ matching ProductFamily)
// that isn't in Meitu's current "Color Tools And Accessories" price list.
// All target products were already retired (isActive: false) during the
// earlier FY2083 migration pass - this just physically removes them.
// Checked before writing: 0 Orders reference any of these products.
// StockAdjustmentLog has 13 historical entries referencing a few of them,
// but each log entry stores its own productName snapshot, so deleting the
// Product doesn't break readability of that audit history - left untouched.
//
// Usage:
//   node src/scripts/remove-retired-tools-accessories.js
//   node src/scripts/remove-retired-tools-accessories.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import Order from "../models/Order.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

// Every code in Meitu's current "Color Tools And Accessories" list - kept.
const KEEP_CODES = new Set([
  "TOOLS-MANUAL-MACHINE",
  "TOOLS-AUTOMATIC-MACHINE",
  "TOOLS-COLOR-MIXING-MACHINE",
  "TOOLS-SPRAY-GUN-WITH-SET",
  "TOOLS-SPRAY-GUN-HEAD",
  "TOOLS-REAL-STONE-PAINT-GUN",
  "TOOLS-AIR-COMPRESSOR-MACHINE",
  "TOOLS-SEWING-TAPE",
  "TOOLS-FLOOR-ROLLER-9IN-SET",
  "TOOLS-FLOOR-ROLLER-4IN",
  "TOOLS-FLOOR-ROLLER-HANDLE-4IN",
  "TOOLS-REGULAR-ROLLER-9IN-SET",
  "TOOLS-SAFETY-BELT-SINGLE-HOOK",
  "TOOLS-SAFETY-BELT-DOUBLE-HOOK",
  "TOOLS-FLOOR-PAINT-SHOES",
  "TOOLS-PLASTIC-COVER-20M",
  "TOOLS-REGULAR-ROLLER-4IN",
  "TOOLS-FOAM-TAPE-2MM-3MM",
  "TOOLS-PUTTING-PATA-HANDLE",
  "TOOLS-PUTTING-KNIFE",
  "TOOLS-DESIGN-TAPE-50M",
  "TOOLS-SCAFFOLDING-SET",
]);

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "delete retired Tools & Accessories products", destructive: true });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const allTools = await Product.find({ category: "TOOLS_AND_ACCESSORIES" }).select("_id name code isActive").lean();
  const toRemove = allTools.filter((p) => !KEEP_CODES.has(p.code));
  const removeIds = toRemove.map((p) => p._id);
  const removeCodes = toRemove.map((p) => p.code);

  console.log(`\nTOOLS_AND_ACCESSORIES total: ${allTools.length}`);
  console.log(`Keeping: ${allTools.length - toRemove.length}`);
  console.log(`Removing: ${toRemove.length}`);
  toRemove.forEach((p) => console.log(`  [${p.code}] ${p.name} (active=${p.isActive})`));

  const orderRefs = await Order.countDocuments({ "items.productId": { $in: removeIds } });
  if (orderRefs > 0) {
    throw new Error(`Refusing to proceed: ${orderRefs} order(s) still reference products marked for removal.`);
  }

  if (mode !== "apply") {
    console.log("\nDry run complete - re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  const productRes = await Product.deleteMany({ _id: { $in: removeIds } });
  const familyRes = await ProductFamily.deleteMany({ code: { $in: removeCodes } });

  console.log(`\nDeleted ${productRes.deletedCount} products, ${familyRes.deletedCount} product families.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
