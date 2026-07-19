import crypto from "crypto";
import mongoose from "mongoose";
import streamifier from "streamifier";
import Painter from "../models/Painter.model.js";
import PointLedger from "../models/PointLedger.model.js";
import ApiError from "../utils/apiError.js";
import { maskId } from "../utils/maskId.js";
import cloudinary from "../utils/cloudinary.js";
import { generatePainterIdCardPdf } from "./painterIdCard.service.js";

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function sortSpec(sort) {
  if (sort === "name-desc") return { name: -1 };
  if (sort === "recent") return { createdAt: -1 };
  return { name: 1 };
}

export async function listPainters({ q = "", sort = "name-asc", type = "ALL", page = 1, limit = 50 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(1000, Math.max(1, Number(limit || 50)));

  const filter = {};
  const trimmedQ = String(q || "").trim();
  if (trimmedQ) {
    // Escape regex metacharacters so a search containing e.g. "(", ")", "."
    // is matched literally instead of as a regex (which Mongo otherwise
    // rejects as malformed, or which is legitimate-looking but matches
    // subtly different text than intended) - mirrors factory.service.js's
    // applySearch escaping convention.
    const regex = { $regex: trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: regex }, { address: regex }, { notes: regex }, { phones: regex }];
  }
  if (type === "TTP" || type === "RTP") {
    filter.type = type;
  }

  const [items, total] = await Promise.all([
    Painter.find(filter)
      .sort(sortSpec(sort))
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    Painter.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

// Metrics/statistics (e.g. coupon redemption counts via CouponRedemptionHistory's
// painterId reference) will be aggregated and attached here later - for now
// this just returns the plain contact record.
export async function getPainterById(painterId) {
  const painter = await Painter.findById(painterId).lean();
  if (!painter) throw new ApiError(404, "Painter not found");
  return { item: painter };
}

// Admin creation: type (TTP/RTP) and citizenshipNumber are both required -
// Meitu only has two painter classifications, so there's no "unclassified"
// state to leave a new painter in, and citizenshipNumber is the same dedup
// key registerPainterAsDealer (the dealer-facing RTP registration path)
// already requires, extended to this admin path too. Picking "TTP" here
// runs the exact same license-assignment (assignTtpLicense) that the
// dedicated promote action uses - the painter is never left in a
// type=TTP-but-no-licenseId state, regardless of which path created it.
export async function createPainter({ name, phones, address = "", notes = "", type, citizenshipNumber } = {}) {
  if (type !== "TTP" && type !== "RTP") {
    throw new ApiError(400, "type must be TTP or RTP");
  }

  const trimmedCitizenship = String(citizenshipNumber || "").trim();
  const existing = await Painter.findOne({ citizenshipNumber: trimmedCitizenship }).lean();
  if (existing) {
    throw new ApiError(409, "A painter with this citizenship number is already registered.", {
      code: "PAINTER_ALREADY_EXISTS",
      painter: painterSearchShape(existing),
    });
  }

  const painter = new Painter({ name, phones, address, notes, citizenshipNumber: trimmedCitizenship, type: "RTP" });
  await painter.save();
  if (type === "TTP") {
    await assignTtpLicense(painter);
  }
  return { item: painter.toObject() };
}

export async function updatePainter(painterId, payload = {}) {
  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.phones !== undefined) updates.phones = payload.phones;
  if (payload.address !== undefined) updates.address = payload.address;
  if (payload.notes !== undefined) updates.notes = payload.notes;

  // Only ever set citizenshipNumber when a real value is given - an empty
  // string is still a "present" value as far as the sparse unique index on
  // this field is concerned (sparse only excludes ABSENT fields, not
  // present-but-empty ones), so writing "" here on an unrelated edit (e.g.
  // a legacy painter with no citizenship number yet, saving a phone number
  // change) would collide with every other such painter's identical ""
  // value the next time this ran. Silently ignoring a blank submission
  // means this field can only ever be added or corrected, never cleared.
  if (payload.citizenshipNumber !== undefined) {
    const trimmedCitizenship = String(payload.citizenshipNumber || "").trim();
    if (trimmedCitizenship) {
      const existing = await Painter.findOne({ citizenshipNumber: trimmedCitizenship, _id: { $ne: painterId } }).lean();
      if (existing) {
        throw new ApiError(409, "A painter with this citizenship number is already registered.", {
          code: "PAINTER_ALREADY_EXISTS",
          painter: painterSearchShape(existing),
        });
      }
      updates.citizenshipNumber = trimmedCitizenship;
    }
  }

  const painter = await Painter.findByIdAndUpdate(painterId, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!painter) throw new ApiError(404, "Painter not found");
  return { item: painter };
}

export async function deletePainter(painterId) {
  const painter = await Painter.findByIdAndDelete(painterId).lean();
  if (!painter) throw new ApiError(404, "Painter not found");
  return { item: painter };
}

// Random (not sequential) permanent Painter ID assigned at TTP promotion -
// six crypto-random digits, collision-checked against the existing unique
// index on licenseId with a bounded retry loop, since a random draw (unlike
// a counter) doesn't guarantee uniqueness on its own. crypto.randomInt is
// a CSPRNG (unlike Math.random), so the id also isn't guessable in sequence.
async function generatePainterId() {
  const MAX_ATTEMPTS = 20;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = `TTP${String(crypto.randomInt(0, 1000000)).padStart(6, "0")}`;
    const exists = await Painter.exists({ licenseId: candidate });
    if (!exists) return candidate;
  }
  throw new ApiError(500, "Could not generate a unique Painter ID - please try again.");
}

// Deterministic Cloudinary public_id for a painter's ID card PDF, derived
// from its permanent licenseId - never stored separately, so the download
// route below can always recompute it without an extra DB field.
function painterIdCardPublicId(licenseId) {
  return `meitu-painter-id-cards/${licenseId}-id-card`;
}

// Uploaded as an "authenticated" asset, not a plain public "upload" -
// Cloudinary's account-level "restricted media types" security setting
// blocks unauthenticated delivery of PDFs outright regardless of
// resource_type (verified against this project's actual Cloudinary
// account: both "raw" and "image" + type:"upload" return 401 on delivery).
// Only a signed, short-lived download URL - minted per-request by
// getPainterIdCardDownloadUrl below via cloudinary.utils.private_download_url,
// which hits the Admin API rather than the public delivery CDN - can ever
// read this asset back. That's also the right call independent of the
// Cloudinary restriction: painter name/phone/licenseId are personal data
// that shouldn't sit behind a guessable public link.
function uploadPainterIdCardPdf(buffer, licenseId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: painterIdCardPublicId(licenseId),
        resource_type: "image",
        type: "authenticated",
        format: "pdf",
        overwrite: true,
        // Without this, Cloudinary's CDN can keep serving the previous PDF
        // at this same public_id for a while after a regenerate - the admin
        // downloading right after replacing a photo could otherwise still
        // get the old file even though the new one uploaded successfully.
        invalidate: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// Best-effort: renders the printable TTP ID card PDF (painterIdCard.service.js)
// and uploads it to Cloudinary right after promotion. Never throws - a
// PDF/Cloudinary failure must not undo an already-committed promotion, since
// licenseId is permanent and irreplaceable once assigned (see the guard in
// promotePainterToTtp below). Returns false on any failure, leaving
// idCardGeneratedAt at its schema default (null) until a future retry
// succeeds.
async function generatePainterIdCard(painter) {
  try {
    const pdfBuffer = await generatePainterIdCardPdf({
      licenseId: painter.licenseId,
      name: painter.name,
      phone: painter.phones[0],
      issueDate: painter.licenseIssuedAt,
    });
    await uploadPainterIdCardPdf(pdfBuffer, painter.licenseId);
    return true;
  } catch (error) {
    console.warn("[painter] Failed to generate/upload TTP ID card:", error?.message || error);
    return false;
  }
}

// Deterministic Cloudinary public_id for a painter's saved headshot -
// same convention as painterIdCardPublicId above.
function painterIdCardPhotoPublicId(licenseId) {
  return `meitu-painter-id-cards/${licenseId}-id-card-photo`;
}

// Persists the exact cropped headshot the admin composited into the PDF, as
// its own small Cloudinary asset - so reopening the "already generated"
// card can show the real photo in the preview instead of a placeholder
// glyph. This is a deliberate reversal of the original "never persist the
// photo" design: that decision only ever served "don't store more personal
// data than needed", which the ID card PDF itself already contains anyway
// once a photo has been added. Kept "authenticated" + short-lived signed
// URLs for delivery, same posture as the PDF.
function uploadPainterIdCardPhoto(buffer, licenseId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: painterIdCardPhotoPublicId(licenseId),
        resource_type: "image",
        type: "authenticated",
        format: "jpg",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// Admin: mints a fresh, short-lived signed URL for the painter's saved
// headshot (see uploadPainterIdCardPhoto above) - directly embeddable as an
// <img src>, unlike the PDF download URL which forces an attachment.
export async function getPainterIdCardPhotoUrl(painterId) {
  const painter = await Painter.findById(painterId).lean();
  if (!painter) throw new ApiError(404, "Painter not found");
  if (!painter.licenseId || !painter.idCardPhotoAddedAt) {
    throw new ApiError(404, "This painter does not have a saved photo yet.");
  }

  return cloudinary.url(painterIdCardPhotoPublicId(painter.licenseId), {
    resource_type: "image",
    type: "authenticated",
    format: "jpg",
    sign_url: true,
    secure: true,
  });
}

// Admin: mints a fresh, short-lived signed download URL for an already-
// generated TTP ID card PDF (never a stored/reusable link - see the
// idCardGeneratedAt schema comment). 5 minutes is comfortably enough for
// the admin's browser to follow the redirect and start the download.
export async function getPainterIdCardDownloadUrl(painterId) {
  const painter = await Painter.findById(painterId).lean();
  if (!painter) throw new ApiError(404, "Painter not found");
  if (!painter.licenseId || !painter.idCardGeneratedAt) {
    throw new ApiError(404, "This painter does not have a generated ID card yet.");
  }
  // idCardGeneratedAt alone can mean a blank-photo card auto-generated on
  // TTP promotion - refuse to hand out a download link until a real photo
  // has actually been composited in, mirroring the frontend's own gate
  // rather than trusting it alone.
  if (!painter.idCardPhotoAddedAt) {
    throw new ApiError(400, "Add a photo to this painter's ID card before downloading it.");
  }

  return cloudinary.utils.private_download_url(painterIdCardPublicId(painter.licenseId), "pdf", {
    resource_type: "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
    attachment: true,
  });
}

// Admin: re-renders the ID card with a headshot composited in, replacing
// whatever card (with or without a photo) currently exists in Cloudinary.
// The uploaded crop is also saved as its own asset (uploadPainterIdCardPhoto)
// so the "already generated" preview can show the real photo on a later
// visit - if the admin wants to change it again, they re-upload and
// re-adjust from scratch same as before; there's just now something to show
// while they decide whether to.
export async function regeneratePainterIdCardWithPhoto(painterId, photoFile) {
  if (!photoFile?.buffer) throw new ApiError(400, "A photo file is required.");
  if (!String(photoFile.mimetype || "").startsWith("image/")) {
    throw new ApiError(400, "Only image files are allowed.");
  }

  const painter = await Painter.findById(painterId);
  if (!painter) throw new ApiError(404, "Painter not found");
  if (painter.type !== "TTP" || !painter.licenseId) {
    throw new ApiError(400, "Promote this painter to TTP before generating an ID card.");
  }

  const pdfBuffer = await generatePainterIdCardPdf({
    licenseId: painter.licenseId,
    name: painter.name,
    phone: painter.phones[0],
    issueDate: painter.licenseIssuedAt,
    photoBuffer: photoFile.buffer,
    photoMimeType: photoFile.mimetype,
  });
  await uploadPainterIdCardPdf(pdfBuffer, painter.licenseId);
  await uploadPainterIdCardPhoto(photoFile.buffer, painter.licenseId);

  painter.idCardGeneratedAt = new Date();
  painter.idCardPhotoAddedAt = new Date();
  await painter.save();

  // Mint the signed URL directly from the painter doc already in hand
  // instead of calling getPainterIdCardDownloadUrl(painterId), which would
  // re-fetch the same document we just saved.
  return cloudinary.utils.private_download_url(painterIdCardPublicId(painter.licenseId), "pdf", {
    resource_type: "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
    attachment: true,
  });
}

// Shared by promotePainterToTtp (RTP/legacy -> TTP promotion) and
// createPainter (admin picks TTP directly at creation) - assigns the
// permanent, system-generated Painter ID + license metadata, then attempts
// the blank ID card generation. Mutates and saves the given (already
// persisted) painter document in place. Two separate saves, matching the
// original promotion flow: the licenseId commit must survive even if the
// PDF/Cloudinary step that follows fails.
async function assignTtpLicense(painter, { licenseIssuedAt, licenseStatus } = {}) {
  painter.type = "TTP";
  painter.licenseId = await generatePainterId();
  painter.licenseIssuedAt = licenseIssuedAt ? new Date(licenseIssuedAt) : new Date();
  painter.licenseStatus = licenseStatus || "VALID";
  await painter.save();

  painter.idCardGeneratedAt = (await generatePainterIdCard(painter)) ? new Date() : null;
  await painter.save();
}

// Admin: formally classifies a painter as TTP by assigning a permanent,
// system-generated Painter ID (stored on the existing licenseId field).
// Deliberately a separate action from the generic edit form. The id is
// generated here, never accepted from the request - once a painter has one,
// this function refuses to run again, so the id can never be reassigned or
// changed later (updatePainter's allowlist already excludes licenseId
// entirely, so this promotion path is the only place it's ever written).
export async function promotePainterToTtp(painterId, { licenseIssuedAt, licenseStatus } = {}) {
  const painter = await Painter.findById(painterId);
  if (!painter) throw new ApiError(404, "Painter not found");
  if (painter.licenseId) {
    throw new ApiError(400, "This painter already has a permanent Painter ID and cannot be re-promoted.", {
      code: "ALREADY_PROMOTED",
    });
  }

  await assignTtpLicense(painter, { licenseIssuedAt, licenseStatus });
  return { item: painter.toObject() };
}

// Admin: paginated PointLedger rows for one painter, plus lifetime/yearly/
// monthly aggregates - all derived from the ledger by date-filtered
// aggregation rather than a separately cached rollover counter, mirroring
// dealerInventory.service.js's getMovementTotalsByProduct convention.
export async function getPainterPointHistory(painterId, { page = 1, limit = 50, from = null, to = null } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = { painterId };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const painterObjectId = new mongoose.Types.ObjectId(String(painterId));

  const [items, total, lifetimeAgg, yearlyAgg, monthlyAgg] = await Promise.all([
    PointLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "dealerId", select: "companyName" })
      .populate({ path: "couponId", select: "couponCode type" })
      .lean(),
    PointLedger.countDocuments(filter),
    PointLedger.aggregate([
      { $match: { painterId: painterObjectId } },
      { $group: { _id: null, points: { $sum: "$points" }, cashAmount: { $sum: "$cashAmount" } } },
    ]),
    PointLedger.aggregate([
      { $match: { painterId: painterObjectId, createdAt: { $gte: startOfYear } } },
      { $group: { _id: null, points: { $sum: "$points" }, cashAmount: { $sum: "$cashAmount" } } },
    ]),
    PointLedger.aggregate([
      { $match: { painterId: painterObjectId, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, points: { $sum: "$points" }, cashAmount: { $sum: "$cashAmount" } } },
    ]),
  ]);

  const zero = { points: 0, cashAmount: 0 };
  return {
    items,
    summary: {
      lifetime: lifetimeAgg[0] || zero,
      yearly: yearlyAgg[0] || zero,
      monthly: monthlyAgg[0] || zero,
    },
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

function painterSearchShape(painter) {
  return {
    _id: painter._id,
    name: painter.name,
    type: painter.type,
    status: painter.status,
    phones: painter.phones,
    licenseIdMasked: painter.licenseId ? maskId(painter.licenseId) : null,
    citizenshipNumberMasked: painter.citizenshipNumber ? maskId(painter.citizenshipNumber) : null,
  };
}

// Dealer-facing search, called mid-redemption. Never returns the raw
// licenseId/citizenshipNumber - only a masked (last-4) version - even
// though the match itself is against the full stored value the dealer
// typed in.
export async function searchPaintersForDealer({ type, licenseId, citizenshipNumber } = {}) {
  if (type === "TTP") {
    if (!String(licenseId || "").trim()) throw new ApiError(400, "licenseId is required");
    const painters = await Painter.find({
      type: "TTP",
      licenseId: String(licenseId).trim(),
    }).lean();
    return { items: painters.map(painterSearchShape) };
  }

  if (type === "RTP") {
    if (!String(citizenshipNumber || "").trim()) throw new ApiError(400, "citizenshipNumber is required");
    const painters = await Painter.find({
      type: { $in: ["RTP", null] },
      citizenshipNumber: String(citizenshipNumber).trim(),
    }).lean();
    return { items: painters.map(painterSearchShape) };
  }

  throw new ApiError(400, "type must be TTP or RTP");
}

// Dealer-facing: register a brand-new RTP painter inline during
// redemption. Immediately active/earning-eligible (no admin approval gate)
// - see the Phase 2 plan doc for the accepted fraud-risk tradeoff.
export async function registerPainterAsDealer({ name, citizenshipNumber, phones, address = "", actorUser } = {}) {
  const existing = await Painter.findOne({ citizenshipNumber: String(citizenshipNumber || "").trim() }).lean();
  if (existing) {
    // Surface the existing (masked) profile in the error details so the
    // dealer can select it directly instead of hitting a dead end -
    // matches the spec's "show matching painter profile and prevent
    // duplicate registration" requirement.
    throw new ApiError(409, "A painter with this citizenship number is already registered.", {
      code: "PAINTER_ALREADY_EXISTS",
      painter: painterSearchShape(existing),
    });
  }

  const painter = await Painter.create({
    name,
    citizenshipNumber: String(citizenshipNumber).trim(),
    phones,
    address,
    type: "RTP",
    status: "ACTIVE",
    registrationSource: "DEALER",
    registeredByUserId: actorId(actorUser),
  });
  return { item: painterSearchShape(painter.toObject()) };
}
