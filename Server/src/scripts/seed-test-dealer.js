// Seed (create/update) a clearly-labeled TEST dealer account, assigned to
// the TEST dispatcher (dispatcher.test@meitu.internal) for fulfillment -
// a DealerProfile (fulfillmentMode: DISPATCHER, VERIFIED) plus its linked
// DEALER-role User, matching the exact shape a real dealer approval
// produces. Idempotent - safe to re-run (upserts by email). Uses a
// @meitu.internal email so it can never be confused with a real dealer.
//
// Usage:
//   node src/scripts/seed-test-dealer.js
//   node src/scripts/seed-test-dealer.js --email dealer.test@meitu.internal --password "StrongPass123!"
import "dotenv/config";
import mongoose from "mongoose";

import User from "../models/User.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import { ROLES } from "../constants/roles.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import { hashPassword } from "../services/auth.service.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

const TEST_DISPATCHER_EMAIL = "dispatcher.test@meitu.internal";

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
      .slice(0, 24) || "dealer"
  );
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  const email = String(
    argValue("--email") || process.env.TEST_DEALER_EMAIL || "dealer.test@meitu.internal",
  )
    .toLowerCase()
    .trim();
  const password = argValue("--password") || process.env.TEST_DEALER_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error("Missing/too short --password (min 10 chars)");
  }

  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed test dealer" });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const dispatcher = await Dispatcher.findOne({ email: TEST_DISPATCHER_EMAIL }).select("_id companyName");
  if (!dispatcher) {
    throw new Error(`Test dispatcher not found (${TEST_DISPATCHER_EMAIL}) - run seed-test-dispatcher.js first.`);
  }

  const dealerProfile = await DealerProfile.findOneAndUpdate(
    { email },
    {
      $set: {
        companyName: "QA Test Dealer Co.",
        contactName: "Test Dealer",
        phone: "9800000001",
        email,
        address: "Internal testing account - not a real dealer.",
        panVat: "",
        status: DEALER_STATUS.VERIFIED,
        fulfillmentMode: "DISPATCHER",
        dispatcherId: dispatcher._id,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true, runValidators: true },
  );

  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        username: usernameFromEmail(email),
        role: ROLES.DEALER,
        dealerId: dealerProfile._id,
        dispatcherId: null,
        isActive: true,
        accountStatus: "ACTIVE",
        passwordHash,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  ).lean();

  console.log("Test dealer seed complete");
  console.log("- dealerId:", dealerProfile._id.toString());
  console.log("- userId:", user._id.toString());
  console.log("- email:", user.email);
  console.log("- companyName:", dealerProfile.companyName);
  console.log("- assigned dispatcher:", dispatcher.companyName, `(${dispatcher._id})`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
