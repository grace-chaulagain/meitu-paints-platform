import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Order from "../models/Order.model.js";
import { archiveVerifiedOrderToGoogleSheets } from "../services/googleSheetsArchive.service.js";

function getLimit() {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  const value = Number(arg?.split("=")?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : 250;
}

async function main() {
  const limit = getLimit();

  await connectDB();

  const orders = await Order.find({
    status: "VERIFIED",
    $or: [
      { "externalArchives.googleSheets.appendedAt": { $exists: false } },
      { "externalArchives.googleSheets.appendedAt": null },
    ],
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit);

  console.log(
    `[google-sheets-archive] Found ${orders.length} verified order(s) pending archive`,
  );

  let appended = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const result = await archiveVerifiedOrderToGoogleSheets(order);
      if (result?.appended) {
        appended += 1;
        console.log(
          `[google-sheets-archive] Appended ${order.orderNumber || order._id}`,
        );
      } else {
        skipped += 1;
        console.log(
          `[google-sheets-archive] Skipped ${order.orderNumber || order._id}: ${
            result?.reason || "unknown"
          }`,
        );
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[google-sheets-archive] Failed ${order.orderNumber || order._id}: ${
          error?.message || error
        }`,
      );
    }
  }

  console.log(
    `[google-sheets-archive] Done. appended=${appended} skipped=${skipped} failed=${failed}`,
  );

  await mongoose.disconnect();

  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error("[google-sheets-archive] Backfill failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
