/**
 * One-off: re-render every already-generated painter TTP ID card PDF with
 * the current painterIdCard.service.js (post font-size fix) and overwrite
 * the cached Cloudinary asset in place, reusing each painter's existing
 * saved headshot where one was already added. Disposable - not part of the
 * permanent seed/migrate/backfill script set.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/_tmp-regenerate-painter-id-cards.js
 */
import "dotenv/config";
import mongoose from "mongoose";

import Painter from "../models/Painter.model.js";
import { generatePainterIdCardPdf } from "../services/painterIdCard.service.js";
import cloudinary from "../utils/cloudinary.js";

function painterIdCardPublicId(licenseId) {
  return `meitu-painter-id-cards/${licenseId}-id-card`;
}
function painterIdCardPhotoPublicId(licenseId) {
  return `meitu-painter-id-cards/${licenseId}-id-card-photo`;
}

function uploadPainterIdCardPdf(buffer, licenseId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: painterIdCardPublicId(licenseId),
        resource_type: "image",
        type: "authenticated",
        format: "pdf",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function fetchExistingPhoto(licenseId) {
  const url = cloudinary.utils.private_download_url(painterIdCardPhotoPublicId(licenseId), "jpg", {
    resource_type: "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo fetch failed: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");
  console.log(`[db] connecting to ${new URL(MONGODB_URI.replace("mongodb+srv://", "https://")).hostname}`);
  await mongoose.connect(MONGODB_URI);

  const onlyLicenseId = process.argv.find((a) => a.startsWith("--licenseId="))?.split("=")[1];
  const query = { idCardGeneratedAt: { $ne: null } };
  if (onlyLicenseId) query.licenseId = onlyLicenseId;

  const painters = await Painter.find(query)
    .select("licenseId name phones licenseIssuedAt idCardPhotoAddedAt")
    .lean();

  console.log(`Found ${painters.length} painters with a generated ID card.`);

  let ok = 0;
  let failed = 0;
  for (const [i, painter] of painters.entries()) {
    const label = `[${i + 1}/${painters.length}] ${painter.licenseId} (${painter.name})`;
    try {
      let photoBuffer;
      let photoMimeType;
      if (painter.idCardPhotoAddedAt) {
        photoBuffer = await fetchExistingPhoto(painter.licenseId);
        photoMimeType = "image/jpeg";
      }

      const pdfBuffer = await generatePainterIdCardPdf({
        licenseId: painter.licenseId,
        name: painter.name,
        phone: painter.phones?.[0],
        issueDate: painter.licenseIssuedAt,
        photoBuffer,
        photoMimeType,
      });

      await uploadPainterIdCardPdf(pdfBuffer, painter.licenseId);
      console.log(`${label} - OK${photoBuffer ? " (with photo)" : " (no photo)"}`);
      ok += 1;
    } catch (error) {
      console.error(`${label} - FAILED: ${error?.message || error}`);
      failed += 1;
    }
  }

  console.log(`\nDone. ${ok} regenerated, ${failed} failed.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
