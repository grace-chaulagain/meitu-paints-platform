// Companion to suspend-all-dealers.js. That script only flipped
// User.accountStatus, which blocks login via the auth middleware - but the
// Admin dashboard's dealer list, and several service-level checks
// (auth.service.js's assertDealerCanLogin, order.service.js, coupon.service.js,
// dealer.service.js) all gate on the separate DealerProfile.status field
// instead, which was never touched. This script uses the real, canonical
// admin.service.js#setDealerStatus function (the same one the Admin UI's own
// "Suspend" button calls) for every dealer profile not already SUSPENDED, so
// behavior matches exactly what a real admin suspension would do - and
// records each profile's prior status so it can be restored precisely.
import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import DealerProfile from "../models/DealerProfile.model.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import { setDealerStatus } from "../services/admin.service.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mode = process.argv[2];
  if (mode !== "suspend" && mode !== "restore") {
    throw new Error("Usage: node suspend-all-dealer-profiles.js <suspend|restore> [restoreFile]");
  }
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: `${mode} all dealer profiles` });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  if (mode === "suspend") {
    const toSuspend = await DealerProfile.find(
      { status: { $ne: DEALER_STATUS.SUSPENDED } },
      "_id companyName email status",
    ).lean();

    const record = {
      suspendedAt: new Date().toISOString(),
      profiles: toSuspend.map((d) => ({
        id: d._id.toString(),
        companyName: d.companyName || d.email || "",
        priorStatus: d.status,
      })),
    };
    const outPath = path.join(__dirname, `_suspend-all-dealer-profiles-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
    console.log(`Recorded ${record.profiles.length} dealer profile IDs (with prior status):`);
    console.log(outPath);

    let succeeded = 0;
    const failed = [];
    for (const d of toSuspend) {
      try {
        await setDealerStatus({ dealerId: d._id, status: DEALER_STATUS.SUSPENDED, adminUser: null });
        succeeded += 1;
      } catch (err) {
        failed.push({ id: d._id.toString(), companyName: d.companyName, error: err.message });
      }
    }
    console.log(`Suspended ${succeeded}/${toSuspend.length} dealer profiles via setDealerStatus (also updates linked User.isActive/accountStatus).`);
    if (failed.length) {
      console.log(`FAILED (${failed.length}) - not suspended, needs manual follow-up:`);
      failed.forEach((f) => console.log(`  - ${f.companyName} (${f.id}): ${f.error}`));
    }
    console.log(`\nTo restore: node -r dotenv/config src/scripts/suspend-all-dealer-profiles.js restore "${outPath}"`);
  }

  if (mode === "restore") {
    const restoreFile = process.argv[3];
    if (!restoreFile) throw new Error("Provide the recorded JSON file path to restore from.");
    const record = JSON.parse(fs.readFileSync(restoreFile, "utf-8"));
    let restored = 0;
    for (const p of record.profiles) {
      await setDealerStatus({ dealerId: p.id, status: p.priorStatus, adminUser: null });
      restored += 1;
    }
    console.log(`Restored ${restored} of ${record.profiles.length} dealer profiles to their prior status.`);
  }

  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
