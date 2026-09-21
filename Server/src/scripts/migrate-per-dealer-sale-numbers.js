/**
 * One-time migration for the dealer sale number fix: Sale.saleNumber used
 * to come from one Counter document shared by every dealer on the platform
 * ({ _id: "sale" }), so the visible number reflected the Nth sale recorded
 * system-wide, not the Nth sale for that dealer - and any failed sale
 * attempt (oversell, missing purchase cost) still consumed a number even
 * though no Sale document was ever created, since the counter increment ran
 * outside the sale's own transaction. Both together produced numbers that
 * looked arbitrary and full of gaps. The old format (MS-{year}-{6 digits})
 * was also more verbose than needed.
 *
 * generateSaleNumber() in sale.service.js now uses one Counter per dealer
 * ({ _id: `sale:${dealerId}` }, incremented inside the sale's own
 * transaction), and Sale.saleNumber is unique per-dealer (a compound
 * { dealerId, saleNumber } index) rather than globally unique. This script
 * patches every pre-existing Sale document to match: for each dealer, every
 * sale they've ever recorded (any status - a voided sale still really
 * happened) is renumbered oldest -> newest as a clean, gapless
 * SALE-0001, SALE-0002, ... sequence (never resets). Each dealer's Counter
 * is then seeded to continue from their new count.
 *
 * saleNumber is purely an internal system reference - it is never the
 * dealer's own paper bill number (that's the separate billId field,
 * untouched here) and is not mirrored to the Google Sheets archive (which
 * only mirrors Order, never Sale) - so renumbering it has no external
 * side effects to reconcile.
 *
 * Index changes (both required before the renumbering writes below can
 * succeed, since duplicate saleNumbers across different dealers are the
 * whole point of this migration):
 *   1. Drops the old single-field unique index on saleNumber, if present -
 *      it would otherwise reject two different dealers both being assigned
 *      "SALE-0001".
 *   2. Creates the new compound { dealerId: 1, saleNumber: 1 } unique
 *      index once the data is fully renumbered and compliant with it.
 *   3. Removes the now-unused global "sale" Counter document.
 *
 * Idempotent: re-running recomputes the same oldest->newest order and
 * assigns the same numbers, so already-correct documents are skipped
 * (logged, not written) and the per-dealer Counter is just re-set to the
 * same value. Safe to re-run against a database that was already migrated
 * under the old MS-{year}-XXXXXX format too - every sale's number differs
 * from its recomputed SALE-XXXX target, so it's simply reassigned.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/migrate-per-dealer-sale-numbers.js
 *   ... --dry-run     (report only, no writes, no index changes)
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Sale from "../models/Sale.model.js";
import Counter from "../models/Counter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

function buildSaleNumber(seq) {
  return `SALE-${String(seq).padStart(4, "0")}`;
}

async function dropLegacyGlobalIndex() {
  const existing = await Sale.collection.indexes();
  const legacy = existing.find(
    (idx) => idx.unique && Object.keys(idx.key).length === 1 && idx.key.saleNumber === 1,
  );
  if (!legacy) {
    console.log("[migrate-per-dealer-sale-numbers] No legacy single-field saleNumber index found - nothing to drop.");
    return;
  }
  console.log(`[migrate-per-dealer-sale-numbers] Dropping legacy index "${legacy.name}" (unique saleNumber, global).`);
  if (!DRY_RUN) await Sale.collection.dropIndex(legacy.name);
}

async function createCompoundIndex() {
  const existing = await Sale.collection.indexes();
  const already = existing.some(
    (idx) => idx.unique && idx.key.dealerId === 1 && idx.key.saleNumber === 1,
  );
  if (already) {
    console.log("[migrate-per-dealer-sale-numbers] Compound { dealerId, saleNumber } unique index already exists.");
    return;
  }
  console.log("[migrate-per-dealer-sale-numbers] Creating compound { dealerId, saleNumber } unique index.");
  if (!DRY_RUN) await Sale.collection.createIndex({ dealerId: 1, saleNumber: 1 }, { unique: true });
}

async function renumberDealer(dealerId) {
  const sales = await Sale.find({ dealerId })
    .select("_id saleNumber saleDate")
    .sort({ saleDate: 1, _id: 1 })
    .lean();

  const ops = [];
  let sample = null;
  sales.forEach((sale, index) => {
    const nextNumber = buildSaleNumber(index + 1);
    if (nextNumber === sale.saleNumber) return; // already correct - idempotent re-run
    if (!sample) sample = { from: sale.saleNumber, to: nextNumber };
    ops.push({ updateOne: { filter: { _id: sale._id }, update: { $set: { saleNumber: nextNumber } } } });
  });

  console.log(
    `  dealer ${dealerId}: ${sales.length} sale(s), ${ops.length} to renumber` +
      (sample ? ` (e.g. ${sample.from} -> ${sample.to})` : ""),
  );

  if (!DRY_RUN && ops.length > 0) {
    await Sale.collection.bulkWrite(ops, { ordered: false });
  }

  if (!DRY_RUN) {
    await Counter.findOneAndUpdate(
      { _id: `sale:${dealerId}` },
      { $set: { seq: sales.length } },
      { upsert: true },
    );
  }

  return { dealerId, total: sales.length, renumbered: ops.length };
}

async function main() {
  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "migrate dealer sale numbers to per-dealer sequences",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN}`);

  await connectDB();

  await dropLegacyGlobalIndex();

  const dealerIds = await Sale.distinct("dealerId");
  console.log(`[migrate-per-dealer-sale-numbers] ${dealerIds.length} dealer(s) with at least one sale.`);

  const results = [];
  for (const dealerId of dealerIds) {
    results.push(await renumberDealer(dealerId));
  }

  await createCompoundIndex();

  const legacyCounter = await Counter.findOne({ _id: "sale" }).lean();
  if (legacyCounter) {
    console.log(`[migrate-per-dealer-sale-numbers] Removing now-unused global "sale" counter (was seq=${legacyCounter.seq}).`);
    if (!DRY_RUN) await Counter.deleteOne({ _id: "sale" });
  }

  const totalRenumbered = results.reduce((sum, r) => sum + r.renumbered, 0);
  const totalSales = results.reduce((sum, r) => sum + r.total, 0);
  console.log(
    `[migrate-per-dealer-sale-numbers] Done. ${totalRenumbered}/${totalSales} sale(s) renumbered across ${dealerIds.length} dealer(s).` +
      (DRY_RUN ? " (dry run - no writes made)" : ""),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-per-dealer-sale-numbers] Migration failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
