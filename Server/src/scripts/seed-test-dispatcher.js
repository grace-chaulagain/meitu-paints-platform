// Seed (create/update) a clearly-labeled TEST dispatcher account - a
// Dispatcher profile (VERIFIED, active) plus its linked DISPATCHER-role
// User, matching the exact shape real dispatcher registrations produce.
// Idempotent - safe to re-run (upserts by email, matching seed-admin.js /
// seed-factory-user.js). Uses a @meitu.internal email so it can never be
// confused with a real dispatcher's contact info.
//
// Usage:
//   node src/scripts/seed-test-dispatcher.js
//   node src/scripts/seed-test-dispatcher.js --email dispatcher.test@meitu.internal --password "StrongPass123!"
import "dotenv/config";
import mongoose from "mongoose";

import User from "../models/User.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import { ROLES } from "../constants/roles.js";
import { hashPassword } from "../services/auth.service.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function usernameFromEmail(email) {
  return (
    String(email)
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || "dispatcher"
  );
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  const email = String(
    argValue("--email") || process.env.TEST_DISPATCHER_EMAIL || "dispatcher.test@meitu.internal",
  )
    .toLowerCase()
    .trim();
  const password = argValue("--password") || process.env.TEST_DISPATCHER_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error("Missing/too short --password (min 10 chars)");
  }

  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed test dispatcher" });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const dispatcher = await Dispatcher.findOneAndUpdate(
    { email },
    {
      $set: {
        name: "Test Dispatcher",
        companyName: "QA Test Dispatch Co.",
        phone: "9800000000",
        email,
        address: "Internal testing account - not a real dispatcher.",
        status: DISPATCHER_STATUS.VERIFIED,
        isActive: true,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  );

  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        username: usernameFromEmail(email),
        role: ROLES.DISPATCHER,
        dispatcherId: dispatcher._id,
        dealerId: null,
        isActive: true,
        accountStatus: "ACTIVE",
        passwordHash,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  ).lean();

  console.log("Test dispatcher seed complete");
  console.log("- dispatcherId:", dispatcher._id.toString());
  console.log("- userId:", user._id.toString());
  console.log("- email:", user.email);
  console.log("- companyName:", dispatcher.companyName);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
