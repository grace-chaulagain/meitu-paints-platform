/**
 * One-time migration for the Customer-entity removal: Sale.billId is now a
 * required field (replacing the old required Sale.customerId), but every
 * Sale created before this change has no billId - and since it's required
 * on the schema, the next `.save()` on any of those documents (e.g.
 * voidSale()) would fail Mongoose validation. This backfills billId on
 * every pre-existing Sale document using its own saleNumber as a stand-in
 * bill reference (the closest honest value available - there's no way to
 * recover what physical bill a historical sale was actually against).
 *
 * Idempotent: only touches documents where billId is missing/empty.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/migrate-backfill-sale-billid.js
 *   ... --dry-run     (report only, no writes)
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Sale from "../models/Sale.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "backfill Sale.billId",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN}`);

  await connectDB();

  const filter = { $or: [{ billId: { $exists: false } }, { billId: "" }] };
  const sales = await Sale.find(filter).select("_id saleNumber").lean();

  console.log(`[migrate-backfill-sale-billid] Found ${sales.length} sale(s) missing billId`);

  if (!DRY_RUN) {
    for (const sale of sales) {
      await Sale.updateOne({ _id: sale._id }, { $set: { billId: sale.saleNumber } });
    }
  }

  console.log("[migrate-backfill-sale-billid] Done.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-backfill-sale-billid] Migration failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
