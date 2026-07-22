// One-time backfill for orders dispatched before Order.proformaIssuedAt
// existed (see order.service.js's ensureProformaInvoiceMetadata). Without
// this, the first Proforma Invoice redownload after that feature ships
// would freeze in whatever moment the redownload happened - e.g. an
// order actually dispatched two months ago could end up showing today's
// date on its PI, forever. This backfill seeds the field with the real
// historical dispatch date instead.
//
// Targets every order with a dispatch record (order.factory.driverName
// truthy - the same proxy the frontend already uses everywhere for "has
// this order been dispatched at least once") that doesn't already have
// proformaIssuedAt set. Seeds it from order.factory.outForDeliveryAt (the
// actual dispatch timestamp), falling back to
// order.dispatchPrep.proformaGeneratedAt (the last pre-dispatch PI
// generation, a reasonable second-best proxy) if outForDeliveryAt is
// somehow absent. Orders left with neither will simply freeze correctly
// on their next redownload via ensureProformaInvoiceMetadata's own
// edge-case branch - not touched here.
//
// Usage:
//   node -r dotenv/config src/scripts/backfill-proforma-issued-at.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/backfill-proforma-issued-at.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "backfill proforma issued at", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") {
    console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");
  } else {
    console.log("*** APPLY MODE - this WILL write to the database above. ***\n");
  }

  await mongoose.connect(MONGODB_URI);

  const candidates = await Order.find({
    "factory.driverName": { $exists: true, $ne: "" },
    proformaIssuedAt: null,
  })
    .select("orderNumber factory.outForDeliveryAt dispatchPrep.proformaGeneratedAt")
    .lean();

  console.log(`Found ${candidates.length} dispatched order(s) with no proformaIssuedAt set.\n`);

  const toSet = [];
  const skipped = [];
  for (const order of candidates) {
    const seed = order.factory?.outForDeliveryAt || order.dispatchPrep?.proformaGeneratedAt || null;
    if (!seed) {
      skipped.push(order.orderNumber);
      continue;
    }
    toSet.push({ orderId: order._id, orderNumber: order.orderNumber, seed });
  }

  console.log(`Will set proformaIssuedAt on ${toSet.length} order(s):`);
  toSet.forEach(({ orderNumber, seed }) => console.log(`  ${orderNumber} -> ${seed.toISOString()}`));

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} order(s) with no usable date on record (will freeze on next redownload instead):`);
    skipped.forEach((orderNumber) => console.log(`  ${orderNumber}`));
  }

  if (mode === "dry-run") {
    console.log("\nDry run complete - no writes performed. Re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  if (!toSet.length) {
    console.log("\nNothing to apply.");
    await mongoose.disconnect();
    return;
  }

  const result = await Order.bulkWrite(
    toSet.map(({ orderId, seed }) => ({
      updateOne: {
        filter: { _id: orderId, proformaIssuedAt: null },
        update: { $set: { proformaIssuedAt: seed } },
      },
    })),
  );
  console.log(`\nApplied. Modified: ${result.modifiedCount}.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
