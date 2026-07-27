/**
 * Seed (create/update) the internal READ_ONLY_ADMIN user.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/seed-readonly-admin.js
 *   node src/scripts/seed-readonly-admin.js --email readonly@example.com --password "StrongPass123!"
 *
 * Env fallback:
 *   MONGO_URI=<staging mongo uri>
 *   READ_ONLY_ADMIN_EMAIL=readonly@example.com
 *   READ_ONLY_ADMIN_PASSWORD=StrongPass123!
 */

import "dotenv/config";
import mongoose from "mongoose";

import User, { USER_ACCOUNT_STATUS } from "../models/User.model.js";
import { ROLES } from "../constants/roles.js";
import { hashPassword } from "../services/auth.service.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function normalizeEmail(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function usernameFromEmail(email) {
  return (
    String(email)
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || "readonlyadmin"
  );
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error(
      "READ_ONLY_ADMIN_PASSWORD must be at least 12 characters long",
    );
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  const email = normalizeEmail(
    argValue("--email") || process.env.READ_ONLY_ADMIN_EMAIL,
  );
  const password = argValue("--password") || process.env.READ_ONLY_ADMIN_PASSWORD;

  if (!email) {
    throw new Error(
      "Missing read-only admin email (READ_ONLY_ADMIN_EMAIL or --email)",
    );
  }
  if (!password) {
    throw new Error(
      "Missing read-only admin password (READ_ONLY_ADMIN_PASSWORD or --password)",
    );
  }
  validatePassword(password);

  assertSafeDatabaseWrite({
    mongoUri,
    operation: "seed read-only admin user",
  });
  console.log(`[db-write] ${describeDatabaseTarget(mongoUri)}`);

  await mongoose.connect(mongoUri);

  const passwordHash = await hashPassword(password);
  const readonlyAdmin = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        username: usernameFromEmail(email),
        role: ROLES.READ_ONLY_ADMIN,
        isActive: true,
        accountStatus: USER_ACCOUNT_STATUS.ACTIVE,
        passwordHash,
        passwordSetAt: new Date(),
        dealerId: null,
        dispatcherId: null,
        sessions: [],
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  ).lean();

  console.log("Read-only admin seed complete");
  console.log("- id:", readonlyAdmin._id.toString());
  console.log("- email:", readonlyAdmin.email);
  console.log("- role:", readonlyAdmin.role);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Read-only admin seed failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
