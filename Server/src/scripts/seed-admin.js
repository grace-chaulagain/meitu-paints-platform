/**
 * Seed (create/update) the first ADMIN user.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node src/scripts/seed-admin.js
 *   node src/scripts/seed-admin.js --email admin@meitu.com --password "StrongPass123!"
 *
 * Env fallback:
 *   MONGODB_URI=<mongo uri>
 *   ADMIN_EMAIL=admin@meitu.com
 *   ADMIN_PASSWORD=StrongPass123!
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

function normalizeEmail(v) {
  return String(v || "")
    .toLowerCase()
    .trim();
}

function usernameFromEmail(email) {
  return (
    String(email)
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || "admin"
  );
}

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters long");
  }
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  const email = normalizeEmail(argValue("--email") || process.env.ADMIN_EMAIL);
  const password = argValue("--password") || process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("Missing admin email (ADMIN_EMAIL or --email)");
  if (!password)
    throw new Error("Missing admin password (ADMIN_PASSWORD or --password)");
  validatePassword(password);

  assertSafeDatabaseWrite({
    mongoUri: MONGODB_URI,
    operation: "seed admin user",
  });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);

  await mongoose.connect(MONGODB_URI);

  const passwordHash = await hashPassword(password);
  const username = usernameFromEmail(email);

  const admin = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        username,
        role: ROLES.ADMIN,
        isActive: true,
        passwordHash,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true },
  ).lean();

  // Ensure admin is not linked to any dealer profile
  if (admin?.dealerId) {
    await User.updateOne({ _id: admin._id }, { $unset: { dealerId: "" } });
  }

  console.log("✅ Admin seed complete");
  console.log("- id:", admin._id.toString());
  console.log("- email:", admin.email);
  console.log("- role:", admin.role);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Admin seed failed:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
