// Emergency mass-suspend for dealer accounts - every dealer user regardless
// of current accountStatus (ACTIVE, PENDING_PASSWORD_SETUP, or anything
// else not already SUSPENDED). Records each affected user's exact prior
// accountStatus to a timestamped JSON file so the action can be reversed
// precisely (a PENDING_PASSWORD_SETUP dealer is restored to
// PENDING_PASSWORD_SETUP, not blanket-flipped to ACTIVE; dealers who were
// already SUSPENDED beforehand for their own reasons are never touched).
import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import User, { USER_ACCOUNT_STATUS } from "../models/User.model.js";
import { ROLES } from "../constants/roles.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mode = process.argv[2];
  if (mode !== "suspend" && mode !== "restore") {
    throw new Error("Usage: node suspend-all-dealers.js <suspend|restore> [restoreFile]");
  }
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: `${mode} all dealers` });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  if (mode === "suspend") {
    const toSuspend = await User.find(
      { role: ROLES.DEALER, accountStatus: { $ne: USER_ACCOUNT_STATUS.SUSPENDED } },
      "_id email username accountStatus",
    ).lean();

    const record = {
      suspendedAt: new Date().toISOString(),
      users: toSuspend.map((u) => ({
        id: u._id.toString(),
        email: u.email || u.username || "",
        priorAccountStatus: u.accountStatus,
      })),
    };
    const outPath = path.join(__dirname, `_suspend-all-dealers-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
    console.log(`Recorded ${record.users.length} dealer user IDs (with prior status) to restore later:`);
    console.log(outPath);

    const res = await User.updateMany(
      { _id: { $in: toSuspend.map((u) => u._id) } },
      { $set: { accountStatus: USER_ACCOUNT_STATUS.SUSPENDED } },
    );
    console.log(`Suspended: matched=${res.matchedCount} modified=${res.modifiedCount}`);
    console.log(`\nTo restore: node -r dotenv/config src/scripts/suspend-all-dealers.js restore "${outPath}"`);
  }

  if (mode === "restore") {
    const restoreFile = process.argv[3];
    if (!restoreFile) throw new Error("Provide the recorded JSON file path to restore from.");
    const record = JSON.parse(fs.readFileSync(restoreFile, "utf-8"));
    let modified = 0;
    for (const u of record.users) {
      const res = await User.updateOne(
        { _id: u.id, accountStatus: USER_ACCOUNT_STATUS.SUSPENDED },
        { $set: { accountStatus: u.priorAccountStatus } },
      );
      modified += res.modifiedCount;
    }
    console.log(`Restored: ${modified} of ${record.users.length} (each to its own prior status)`);
  }

  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
