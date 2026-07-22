/**
 * One-off: download every painter's already-generated TTP ID card PDF
 * (front+back, current template) from Cloudinary to a local folder, for
 * every painter who has a photo added (the same eligibility gate the real
 * admin download endpoint uses). Disposable - not part of the permanent
 * seed/migrate/backfill script set.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/_tmp-download-painter-id-cards.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Painter from "../models/Painter.model.js";
import cloudinary from "../utils/cloudinary.js";

const OUT_DIR = process.argv[2] || path.join(process.env.HOME, "Desktop", "Painter ID Cards");

function painterIdCardPublicId(licenseId) {
  return `meitu-painter-id-cards/${licenseId}-id-card`;
}

function safeFileName(str) {
  return String(str).replace(/[/\\?%*:|"<>]/g, "-").trim();
}

async function downloadPdf(licenseId) {
  const url = cloudinary.utils.private_download_url(painterIdCardPublicId(licenseId), "pdf", {
    resource_type: "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");
  console.log(`[db] connecting to ${new URL(MONGODB_URI.replace("mongodb+srv://", "https://")).hostname}`);
  await mongoose.connect(MONGODB_URI);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[out] ${OUT_DIR}`);

  const painters = await Painter.find({ idCardGeneratedAt: { $ne: null }, idCardPhotoAddedAt: { $ne: null } })
    .select("licenseId name")
    .sort({ name: 1 })
    .lean();

  console.log(`Found ${painters.length} painters with a photo added.`);

  let ok = 0;
  let failed = 0;
  for (const [i, painter] of painters.entries()) {
    const label = `[${i + 1}/${painters.length}] ${painter.licenseId} (${painter.name})`;
    try {
      const buffer = await downloadPdf(painter.licenseId);
      const fileName = `${safeFileName(painter.licenseId)} - ${safeFileName(painter.name)}.pdf`;
      fs.writeFileSync(path.join(OUT_DIR, fileName), buffer);
      console.log(`${label} - OK (${buffer.length} bytes)`);
      ok += 1;
    } catch (error) {
      console.error(`${label} - FAILED: ${error?.message || error}`);
      failed += 1;
    }
  }

  console.log(`\nDone. ${ok} downloaded, ${failed} failed. Saved to: ${OUT_DIR}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
