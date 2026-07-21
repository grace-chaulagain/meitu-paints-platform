// Resets the password for one existing dealer user, for local/staging
// testing login only. Never creates a new dealer - only touches the
// passwordHash of an existing DEALER-role User. Follows the same
// safety pattern as seed-admin.js / seed-factory-user.js.
//
// Usage:
//   node src/scripts/reset-test-dealer-password.js --email <dealer-email> --password "StrongPass123!"
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import { hashPassword } from "../services/auth.service.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  const email = String(argValue("--email") || "").toLowerCase().trim();
  const password = argValue("--password");

  if (!email) throw new Error("Missing --email");
  if (!password || password.length < 10) throw new Error("Missing/too short --password (min 10 chars)");

  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "reset test dealer password" });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email, role: "DEALER" });
  if (!user) throw new Error(`No DEALER user found with email ${email}`);

  user.passwordHash = await hashPassword(password);
  await user.save();

  console.log(`Password reset for ${user.email} (dealerId=${user.dealerId})`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
