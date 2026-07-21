// Rebuilds serialNumber (the SN{n} watermark shown on the Order Summary and
// Proforma Invoice PDFs) for every order, keyed off when it was actually
// VERIFIED - not when it was created. SN is assigned in the exact sequence
// orders cleared verification (by admin via order.service.js's verifyOrder,
// or by the assigned dispatcher via dispatcher.service.js's
// verifyAssignedOrder), which is the timestamp recorded in
// statusHistory[].changedAt for the SUBMITTED->VERIFIED entry. Orders that
// were never verified (still SUBMITTED, or REJECTED before ever being
// verified) get no serialNumber at all.
//
// Full rebuild, not an incremental backfill: clears every existing
// serialNumber first, so it's safe to re-run after fixing bad data.
//
// Usage:
//   node src/scripts/backfill-order-serial-numbers.js
//   node src/scripts/backfill-order-serial-numbers.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.model.js";
import Counter from "../models/Counter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const BATCH_SIZE = 1000;

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "rebuild order serial numbers by verification order" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const verifiedOrders = await Order.aggregate([
    { $match: { "statusHistory.toStatus": "VERIFIED" } },
    {
      $project: {
        orderNumber: 1,
        verifiedAt: {
          $min: {
            $map: {
              input: {
                $filter: {
                  input: "$statusHistory",
                  cond: { $eq: ["$$this.toStatus", "VERIFIED"] },
                },
              },
              as: "sh",
              in: "$$sh.changedAt",
            },
          },
        },
      },
    },
    { $sort: { verifiedAt: 1, _id: 1 } },
  ]);

  const totalOrders = await Order.countDocuments({});
  console.log(`Total orders: ${totalOrders}`);
  console.log(`Orders ever verified: ${verifiedOrders.length}`);
  if (verifiedOrders.length) {
    console.log(`First verified: ${verifiedOrders[0].orderNumber} (${verifiedOrders[0].verifiedAt}) -> SN1`);
    const last = verifiedOrders[verifiedOrders.length - 1];
    console.log(`Last verified:  ${last.orderNumber} (${last.verifiedAt}) -> SN${verifiedOrders.length}`);
  }

  if (mode !== "apply") {
    console.log("\nDry run complete - re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  const clearRes = await Order.updateMany(
    { serialNumber: { $ne: null } },
    { $unset: { serialNumber: "" } },
  );
  console.log(`\nCleared serialNumber on ${clearRes.modifiedCount} orders.`);

  let written = 0;
  for (let i = 0; i < verifiedOrders.length; i += BATCH_SIZE) {
    const batch = verifiedOrders.slice(i, i + BATCH_SIZE);
    const ops = batch.map((order, idx) => ({
      updateOne: {
        filter: { _id: order._id },
        update: { $set: { serialNumber: i + idx + 1 } },
      },
    }));
    const res = await Order.bulkWrite(ops, { ordered: false });
    written += res.modifiedCount || 0;
    console.log(`  batch ${i / BATCH_SIZE + 1}: wrote ${res.modifiedCount} (running total ${written}/${verifiedOrders.length})`);
  }

  await Counter.findOneAndUpdate(
    { _id: "orderSerialNumber" },
    { $set: { seq: verifiedOrders.length } },
    { upsert: true },
  );
  console.log(`\nCounter "orderSerialNumber" set to ${verifiedOrders.length}.`);

  console.log(`\nDone. Assigned SN1..SN${verifiedOrders.length} in verification order.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
