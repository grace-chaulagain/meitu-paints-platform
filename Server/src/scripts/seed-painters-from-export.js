/**
 * Insert the staging-exported painter dataset (painters-seed-export.json,
 * 152 records) into whichever DB this is pointed at, preserving every
 * field VERBATIM - including the original _id - so the records match
 * staging exactly (Cloudinary ID cards/photos are keyed off licenseId, not
 * a stored URL, so they resolve automatically once licenseId matches).
 *
 * Insert-only: never touches/deletes any existing Painter document. Refuses
 * to run if any imported _id or licenseId already exists in the target DB,
 * so it can never silently clobber real data.
 *
 * Usage:
 *   node src/scripts/seed-painters-from-export.js
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/seed-painters-from-export.js
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Painter from "../models/Painter.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const SOURCE_FILE = path.resolve("src/scripts/painters-seed-export.json");

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed painters from staging export" });
  console.log(`[db-write] ${describeDatabaseTarget(MONGODB_URI)}`);

  const records = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
  console.log(`Loaded ${records.length} records from ${SOURCE_FILE}`);

  await mongoose.connect(MONGODB_URI);

  const importIds = records.map((r) => r._id);
  const importLicenseIds = records.filter((r) => r.licenseId).map((r) => r.licenseId);

  const idClash = await Painter.find({ _id: { $in: importIds } }).select("_id name").lean();
  const licenseClash = await Painter.find({ licenseId: { $in: importLicenseIds } }).select("licenseId name").lean();

  if (idClash.length || licenseClash.length) {
    console.error("❌ Refusing to insert - collisions found with existing documents:");
    if (idClash.length) console.error("  _id clashes:", idClash);
    if (licenseClash.length) console.error("  licenseId clashes:", licenseClash);
    await mongoose.disconnect();
    process.exit(1);
  }

  const docs = records.map((r) => ({
    ...r,
    _id: new mongoose.Types.ObjectId(r._id),
    registeredByUserId: r.registeredByUserId ? new mongoose.Types.ObjectId(r.registeredByUserId) : null,
  }));

  const result = await Painter.insertMany(docs, { ordered: true });
  console.log(`✅ Inserted ${result.length} painters.`);

  const finalCount = await Painter.countDocuments();
  console.log(`Total Painter documents in this DB now: ${finalCount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
