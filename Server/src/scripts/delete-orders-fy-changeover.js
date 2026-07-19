// Deletes every Order document as part of the fiscal-year changeover -
// only ever run AFTER backup-orders-fy-changeover.js and after manually
// verifying that backup (see Desktop/Meitu-Order-Backup-<date>/_SUMMARY.json).
// Scope is Order records only, per explicit user decision - Sale, Payment,
// stock levels, and everything else are untouched. Requires --backup-path
// pointing at a verified backup folder as a lightweight guardrail against
// running this without one.
import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import Order from "../models/Order.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const backupPath = argValue("--backup-path");

  if (mode === "apply") {
    if (!backupPath) {
      throw new Error("Refusing to delete without --backup-path pointing at a verified backup folder's _SUMMARY.json");
    }
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup summary not found at: ${backupPath}`);
    }
    const backupSummary = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    console.log(`Backup verified: ${backupSummary.totalOrders} orders across ${backupSummary.totalDealers} dealers, backed up at ${backupSummary.generatedAt}`);
  }

  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "delete all orders (FY changeover)", destructive: true });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const currentCount = await Order.countDocuments({});
  console.log(`Current Order count: ${currentCount}`);

  if (mode === "apply") {
    if (backupPath) {
      const backupSummary = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
      if (backupSummary.totalOrders !== currentCount) {
        throw new Error(
          `Backup recorded ${backupSummary.totalOrders} orders but the database currently has ${currentCount} - counts must match exactly before deleting. Re-run the backup script first.`,
        );
      }
    }
    const res = await Order.deleteMany({});
    console.log(`Deleted: ${res.deletedCount} orders.`);
  } else {
    console.log(`Would delete: ${currentCount} orders.`);
    console.log(`Dry run complete - re-run with --apply --backup-path "<path to _SUMMARY.json>" to write.`);
  }

  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
