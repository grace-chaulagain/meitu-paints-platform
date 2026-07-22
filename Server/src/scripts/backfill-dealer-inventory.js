/**
 * One-time, idempotent backfill: seeds InventoryMovement (PURCHASE) rows
 * and DealerProductStock.currentQuantity from historically
 * delivered/dispatched dealer orders, so dealer inventory has a correct
 * baseline before the Sales Register goes live.
 *
 * Covers both fulfillment lanes:
 *   - FACTORY mode:    Order.status === COMPLETED (DISPATCHED means still
 *                       in transit for a factory order, not yet received)
 *   - DISPATCHER mode: Order.status is DISPATCHED or COMPLETED. Dispatch is
 *                       when recordPurchaseMovement actually fires (stock
 *                       physically reaches the dealer then - the dispatcher
 *                       is the local final-mile handoff), and COMPLETED is
 *                       just a later "Confirm Handover" bookkeeping step on
 *                       top of that same dispatch - the underlying delivery
 *                       already happened either way, so both statuses count.
 * DISPATCHED means two different real-world things depending on
 * fulfillment mode, so this can't be a single bare status list - it has
 * to branch on dealerSnapshot.fulfillmentMode too.
 * Only orderOrigin === DEALER orders with a dealerId are considered -
 * DISPATCHER_REPLENISHMENT orders never touch dealer inventory.
 *
 * Idempotent: an order already represented in InventoryMovement (matched
 * by orderId) is skipped, so re-running after new orders have gone
 * through the live recordPurchaseMovement wiring is safe and a no-op for
 * them.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/backfill-dealer-inventory.js
 *   ... --dry-run                 (report only, no writes)
 *   ... --limit=500                (cap orders processed per run)
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Order from "../models/Order.model.js";
import InventoryMovement from "../models/InventoryMovement.model.js";
import { recordPurchaseMovement } from "../services/dealerInventory.service.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getLimit() {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  const value = Number(arg?.split("=")?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = getLimit();

  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "backfill dealer inventory",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${dryRun}`);

  await connectDB();

  const orders = await Order.find({
    orderOrigin: "DEALER",
    dealerId: { $ne: null },
    $or: [
      { "dealerSnapshot.fulfillmentMode": "FACTORY", status: "COMPLETED" },
      { "dealerSnapshot.fulfillmentMode": "DISPATCHER", status: { $in: ["DISPATCHED", "COMPLETED"] } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("_id orderNumber dealerId items status")
    .lean();

  console.log(`[backfill-dealer-inventory] Found ${orders.length} candidate order(s)`);

  let processed = 0;
  let skippedAlreadyRecorded = 0;
  let skippedNoItems = 0;
  let failed = 0;

  for (const order of orders) {
    const alreadyRecorded = await InventoryMovement.exists({ orderId: order._id });
    if (alreadyRecorded) {
      skippedAlreadyRecorded += 1;
      continue;
    }

    const items = (order.items || []).filter(
      (item) => item?.productId && Number(item?.quantity) > 0,
    );
    if (items.length === 0) {
      skippedNoItems += 1;
      continue;
    }

    if (dryRun) {
      processed += 1;
      console.log(
        `[backfill-dealer-inventory] Would record ${order.orderNumber || order._id} (${items.length} item(s))`,
      );
      continue;
    }

    try {
      await recordPurchaseMovement({
        dealerId: order.dealerId,
        items,
        orderId: order._id,
        actorRole: "SYSTEM_BACKFILL",
      });
      processed += 1;
      console.log(
        `[backfill-dealer-inventory] Recorded ${order.orderNumber || order._id} (${items.length} item(s))`,
      );
    } catch (error) {
      failed += 1;
      console.error(
        `[backfill-dealer-inventory] Failed ${order.orderNumber || order._id}: ${error?.message || error}`,
      );
    }
  }

  console.log(
    `[backfill-dealer-inventory] Done. processed=${processed} skippedAlreadyRecorded=${skippedAlreadyRecorded} skippedNoItems=${skippedNoItems} failed=${failed}`,
  );

  await mongoose.disconnect();

  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error("[backfill-dealer-inventory] Backfill failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
