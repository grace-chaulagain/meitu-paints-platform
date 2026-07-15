/**
 * One-time migration for the order status collapse: ORDER_STATUS used to
 * have 12 values (SUBMITTED/PROCESSING/AWAITING_SHIPMENT/OUT_FOR_DELIVERY/
 * DELIVERED/VERIFIED/REJECTED/APPROVED/SENT_TO_DISPATCHER/DISPATCHED/
 * CLOSED/CANCELLED); it's now just SUBMITTED/VERIFIED/DISPATCHED/
 * COMPLETED/REJECTED/CANCELLED, with the old CLOSED concept moved to a
 * separate closedAt/closedBy flag. This remaps every existing Order
 * document (both the top-level `status` field and the historical
 * `statusHistory[].toStatus` enum values, which would otherwise fail
 * schema validation the next time any of these documents is `.save()`'d)
 * and unsets the now-removed `factoryStage`/`factory.preparingAt`/
 * `factory.preparingBy` fields.
 *
 * Mapping:
 *   AWAITING_SHIPMENT, PROCESSING, APPROVED -> VERIFIED
 *   OUT_FOR_DELIVERY, SENT_TO_DISPATCHER    -> DISPATCHED
 *   DELIVERED, CLOSED                       -> COMPLETED
 *   (CLOSED additionally backfills closedAt/closedBy)
 *   SUBMITTED, VERIFIED, DISPATCHED, REJECTED, CANCELLED -> unchanged
 *
 * Idempotent: safe to re-run - once statuses are remapped, matching
 * documents for the old values simply won't exist anymore.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/migrate-collapse-order-status.js
 *   ... --dry-run     (report only, no writes)
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Order from "../models/Order.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

const STATUS_MAP = {
  AWAITING_SHIPMENT: "VERIFIED",
  PROCESSING: "VERIFIED",
  APPROVED: "VERIFIED",
  OUT_FOR_DELIVERY: "DISPATCHED",
  SENT_TO_DISPATCHER: "DISPATCHED",
  DELIVERED: "COMPLETED",
  CLOSED: "COMPLETED",
};

async function main() {
  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "migrate order status collapse",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN}`);

  await connectDB();

  console.log("[migrate-collapse-order-status] Top-level status field:");
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const filter = { status: oldStatus };
    const count = await Order.countDocuments(filter);
    if (count === 0) continue;

    console.log(`  ${oldStatus} -> ${newStatus}: ${count} order(s)`);
    if (DRY_RUN) continue;

    const update = { $set: { status: newStatus } };
    if (oldStatus === "CLOSED") {
      // Original closedAt/closedBy are unrecoverable (CLOSED used to be a
      // status value, not tracked with its own timestamp) - backfilling
      // closedAt to "now" is an honest admission we don't know when it was
      // actually closed, just that it was.
      update.$set.closedAt = new Date();
    }
    await Order.updateMany(filter, update);
  }

  console.log("[migrate-collapse-order-status] statusHistory[].toStatus entries:");
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const filter = { "statusHistory.toStatus": oldStatus };
    const count = await Order.countDocuments(filter);
    if (count === 0) continue;

    console.log(`  ${oldStatus} -> ${newStatus}: ${count} order(s) with a matching history entry`);
    if (DRY_RUN) continue;

    await Order.updateMany(
      filter,
      { $set: { "statusHistory.$[elem].toStatus": newStatus } },
      { arrayFilters: [{ "elem.toStatus": oldStatus }] },
    );
  }

  console.log("[migrate-collapse-order-status] Removed fields (factoryStage, factory.preparingAt/By):");
  // Same strict:true caveat as the $unset below - Mongoose silently drops
  // $exists filters on paths no longer in the schema, so this has to go
  // through the raw driver collection to actually count anything.
  const staleFieldCount = await Order.collection.countDocuments({
    $or: [
      { factoryStage: { $exists: true } },
      { "factory.preparingAt": { $exists: true } },
      { "factory.preparingBy": { $exists: true } },
    ],
  });
  console.log(`  ${staleFieldCount} order(s) with stale fields to unset`);
  if (!DRY_RUN && staleFieldCount > 0) {
    // Mongoose's default strict:true schema mode silently drops $unset
    // operations for paths no longer declared on the schema (which is
    // exactly the case here, now that factoryStage/preparingAt/preparingBy
    // have been removed) - going through the raw driver collection
    // bypasses that filtering.
    await Order.collection.updateMany(
      {},
      { $unset: { factoryStage: "", "factory.preparingAt": "", "factory.preparingBy": "" } },
    );
  }

  console.log("[migrate-collapse-order-status] Done.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-collapse-order-status] Migration failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
