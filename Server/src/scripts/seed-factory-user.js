/**
 * Seed (create/update) the internal FACTORY user.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/seed-factory-user.js
 *   node src/scripts/seed-factory-user.js --email factory@example.com --password "StrongPass123!"
 *
 * Env fallback:
 *   MONGO_URI=<staging mongo uri>
 *   FACTORY_EMAIL=factory@example.com
 *   FACTORY_PASSWORD=StrongPass123!
 */

import "dotenv/config";
import mongoose from "mongoose";

import User from "../models/User.model.js";
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
      .slice(0, 24) || "factory"
  );
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    throw new Error("FACTORY_PASSWORD must be at least 10 characters long");
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  const email = normalizeEmail(argValue("--email") || process.env.FACTORY_EMAIL);
  const password = argValue("--password") || process.env.FACTORY_PASSWORD;

  if (!email) throw new Error("Missing factory email (FACTORY_EMAIL or --email)");
  if (!password) {
    throw new Error("Missing factory password (FACTORY_PASSWORD or --password)");
  }
  validatePassword(password);

  assertSafeDatabaseWrite({
    mongoUri,
    operation: "seed factory user",
  });
  console.log(`[db-write] ${describeDatabaseTarget(mongoUri)}`);

  await mongoose.connect(mongoUri);

  const passwordHash = await hashPassword(password);
  const factory = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        username: usernameFromEmail(email),
        role: ROLES.FACTORY,
        isActive: true,
        accountStatus: "ACTIVE",
        passwordHash,
        dealerId: null,
        dispatcherId: null,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  ).lean();

  console.log("Factory seed complete");
  console.log("- id:", factory._id.toString());
  console.log("- email:", factory.email);
  console.log("- role:", factory.role);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Factory seed failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
