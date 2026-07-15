/**
 * One-time migration for the Phase 2 Painter model extension: `status`
 * (default "ACTIVE") and the new TTP/RTP fields were added with schema-level
 * defaults, but Mongoose defaults are only applied when hydrating a real
 * Document - every read in painter.service.js uses `.lean()`, so the 150
 * pre-existing seeded painter docs would come back with `status: undefined`
 * in API responses instead of "ACTIVE" until they're each `save()`'d once.
 * This sets `status: "ACTIVE"` explicitly on every painter doc missing it.
 *
 * Idempotent: only touches documents where status is missing.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/backfill-painter-defaults.js
 *   ... --dry-run     (report only, no writes)
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Painter from "../models/Painter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "backfill Painter.status defaults",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN}`);

  await connectDB();

  const filter = { status: { $exists: false } };
  const count = await Painter.countDocuments(filter);

  console.log(`[backfill-painter-defaults] Found ${count} painter(s) missing status`);

  if (!DRY_RUN && count > 0) {
    await Painter.updateMany(filter, { $set: { status: "ACTIVE" } });
  }

  console.log("[backfill-painter-defaults] Done.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[backfill-painter-defaults] Migration failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
