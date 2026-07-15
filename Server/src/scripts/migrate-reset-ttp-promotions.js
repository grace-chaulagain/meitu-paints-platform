/**
 * One-time migration for the TTP Painter ID generation change: the id was
 * originally a sequential counter ("TTP-000001"), then briefly a random
 * dash-separated code ("TTP-456952"), before settling on the final random
 * no-dash format ("TTP456952"). Painters promoted under either earlier
 * scheme are stuck with a permanent id in the wrong format, and
 * promotePainterToTtp() refuses to run again once licenseId is set.
 *
 * This resets every currently-TTP painter back to "un-promoted"
 * (type: null, licenseId/licenseIssuedAt/licenseStatus cleared) so each can
 * be re-promoted through the normal admin flow to pick up a fresh id in the
 * current format. Deliberately does not touch totalPoints,
 * totalCashReceived, or any PointLedger rows - those are keyed off the
 * painter's _id, not licenseId, and stay valid regardless of promotion
 * status.
 *
 * Idempotent: only touches documents where type is currently "TTP".
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/migrate-reset-ttp-promotions.js
 *   ... --dry-run     (report only, no writes)
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Painter from "../models/Painter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  assertSafeDatabaseWrite({
    mongoUri: MONGO_URI,
    operation: "reset TTP painter promotions",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN}`);

  await connectDB();

  const painters = await Painter.find({ type: "TTP" }).select("_id name licenseId").lean();

  console.log(`[migrate-reset-ttp-promotions] Found ${painters.length} promoted TTP painter(s):`);
  for (const painter of painters) {
    console.log(`  ${painter.name} - ${painter.licenseId}`);
  }

  if (!DRY_RUN && painters.length > 0) {
    await Painter.updateMany(
      { _id: { $in: painters.map((p) => p._id) } },
      {
        $set: { type: null },
        $unset: { licenseId: "", licenseIssuedAt: "", licenseStatus: "" },
      },
    );
  }

  console.log("[migrate-reset-ttp-promotions] Done.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-reset-ttp-promotions] Migration failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
