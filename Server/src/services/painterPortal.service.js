import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import Gift from "../models/Gift.model.js";
import Painter from "../models/Painter.model.js";
import PointLedger from "../models/PointLedger.model.js";
import PainterPortalSettings from "../models/PainterPortalSettings.model.js";
import streamifier from "streamifier";

import cloudinary from "../utils/cloudinary.js";

// Same local helper the product catalog uses (admin.catalog.service.js) -
// cloudinary.js exports the configured client, not an upload function.
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "meitu-gifts", resource_type: "image", ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ----------------------------
// Settings (singleton)
// ----------------------------

export async function getPortalSettings() {
  const existing = await PainterPortalSettings.findOne().lean();
  if (existing) return existing;
  // Read-only callers must not depend on a write having happened, so an
  // unconfigured portal answers with the same shape rather than creating a
  // document on a GET.
  return { fiscalYearLabel: "", fiscalYearStart: null, fiscalYearEnd: null };
}

export async function updatePortalSettings({ fiscalYearLabel, fiscalYearStart, fiscalYearEnd } = {}) {
  const start = fiscalYearStart ? new Date(fiscalYearStart) : null;
  const end = fiscalYearEnd ? new Date(fiscalYearEnd) : null;
  if (start && end && start > end) {
    throw new ApiError(400, "The fiscal year cannot end before it starts.");
  }
  // Half a window would silently count from the beginning of time or to the
  // end of it; either is a wrong number on a painter's screen.
  if (Boolean(start) !== Boolean(end)) {
    throw new ApiError(400, "Set both the start and the end of the fiscal year, or neither.");
  }

  const update = {
    fiscalYearLabel: String(fiscalYearLabel || "").trim(),
    fiscalYearStart: start,
    fiscalYearEnd: end,
  };
  const saved = await PainterPortalSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true }).lean();
  return saved;
}

// The window the portal counts points in. Without one, every point counts.
function periodOf(settings) {
  const from = settings?.fiscalYearStart ? new Date(settings.fiscalYearStart) : null;
  const to = settings?.fiscalYearEnd ? new Date(settings.fiscalYearEnd) : null;
  if (!from || !to) {
    return { mode: "ALL_TIME", label: "", from: null, to: null };
  }
  return { mode: "FISCAL_YEAR", label: settings.fiscalYearLabel || "", from, to };
}

// ----------------------------
// Gifts
// ----------------------------

// Ordered the way a painter climbs them - cheapest first, then by the manual
// order for gifts that cost the same.
export async function listGifts({ activeOnly = false } = {}) {
  const filter = activeOnly ? { isActive: true } : {};
  const items = await Gift.find(filter).sort({ pointsRequired: 1, sortOrder: 1 }).lean();
  return { items };
}

export async function createGift({ name, nameNepali, pointsRequired, isActive, sortOrder } = {}) {
  const gift = await Gift.create({
    name: String(name || "").trim(),
    nameNepali: String(nameNepali || "").trim(),
    pointsRequired: Number(pointsRequired),
    isActive: isActive === undefined ? true : Boolean(isActive),
    sortOrder: Number(sortOrder || 0),
  });
  return gift.toObject();
}

export async function updateGift({ giftId, patch = {} } = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(giftId))) throw new ApiError(400, "Invalid gift id");
  const update = {};
  if (patch.name !== undefined) update.name = String(patch.name).trim();
  if (patch.nameNepali !== undefined) update.nameNepali = String(patch.nameNepali).trim();
  if (patch.pointsRequired !== undefined) update.pointsRequired = Number(patch.pointsRequired);
  if (patch.isActive !== undefined) update.isActive = Boolean(patch.isActive);
  if (patch.sortOrder !== undefined) update.sortOrder = Number(patch.sortOrder);

  const gift = await Gift.findByIdAndUpdate(giftId, { $set: update }, { new: true }).lean();
  if (!gift) throw new ApiError(404, "Gift not found");
  return gift;
}

export async function deleteGift({ giftId } = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(giftId))) throw new ApiError(400, "Invalid gift id");
  const gift = await Gift.findById(giftId);
  if (!gift) throw new ApiError(404, "Gift not found");
  // The picture goes with it - nothing else ever references it.
  if (gift.image?.publicId) {
    try {
      await cloudinary.uploader.destroy(gift.image.publicId);
    } catch {
      // A picture left behind in Cloudinary must not block removing the gift.
    }
  }
  await Gift.deleteOne({ _id: gift._id });
  return { deleted: true };
}

export async function uploadGiftImage({ giftId, file } = {}) {
  if (!file?.buffer) throw new ApiError(400, "Image file is required");
  if (!mongoose.Types.ObjectId.isValid(String(giftId))) throw new ApiError(400, "Invalid gift id");
  const gift = await Gift.findById(giftId);
  if (!gift) throw new ApiError(404, "Gift not found");

  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: "meitu-gifts",
    public_id: `gift-${gift._id}-${Date.now()}`,
    overwrite: false,
  });

  const previousPublicId = gift.image?.publicId || "";
  gift.image = { url: result.secure_url, publicId: result.public_id };
  await gift.save();

  if (previousPublicId && previousPublicId !== result.public_id) {
    try {
      await cloudinary.uploader.destroy(previousPublicId);
    } catch {
      // Replacing the picture succeeded; tidying the old one is best-effort.
    }
  }
  return gift.toObject();
}

// ----------------------------
// The painter portal's own lookup (public)
// ----------------------------

// A painter types whatever they have to hand: the ID on their card, their
// citizenship number, or their phone. Exact matches only - this is a public
// endpoint, so it answers "is this you" and never lists or searches painters.
function identifierQuery(raw) {
  const text = String(raw || "").trim();
  if (text.length < 4) return null;

  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`^${escaped}$`, "i");
  const or = [{ licenseId: exact }, { citizenshipNumber: exact }];

  // Phones are stored as typed, so 98XXXXXXXX also has to match +977 98XXXXXXXX
  // and 977-98XXXXXXXX. The last ten digits are what identifies a Nepali
  // mobile, so that is what is compared.
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 7) {
    const last10 = digits.slice(-10);
    or.push({ phones: { $elemMatch: { $regex: `${last10}$` } } });
  }
  return { $or: or };
}

export async function lookupPainterForPortal({ query } = {}) {
  const filter = identifierQuery(query);
  if (!filter) {
    throw new ApiError(400, "Enter your Painter ID, citizenship number or phone number.");
  }

  const painter = await Painter.findOne(filter)
    .select("name type status licenseId totalPoints")
    .lean();
  if (!painter) {
    throw new ApiError(404, "We could not find that ID. Check the number on your card, or ask your dealer.", {
      code: "PAINTER_NOT_FOUND",
    });
  }

  const settings = await getPortalSettings();
  const period = periodOf(settings);

  const ledgerFilter = { painterId: painter._id };
  if (period.mode === "FISCAL_YEAR") {
    ledgerFilter.createdAt = { $gte: period.from, $lte: period.to };
  }
  const [totals] = await PointLedger.aggregate([
    { $match: ledgerFilter },
    { $group: { _id: null, points: { $sum: "$points" }, count: { $sum: 1 }, lastEarnedAt: { $max: "$createdAt" } } },
  ]);
  const points = totals?.points || 0;

  const { items: gifts } = await listGifts({ activeOnly: true });
  const ladder = gifts.map((gift) => ({
    id: String(gift._id),
    name: gift.name,
    nameNepali: gift.nameNepali || "",
    pointsRequired: gift.pointsRequired,
    imageUrl: gift.image?.url || "",
    earned: points >= gift.pointsRequired,
    remaining: Math.max(0, gift.pointsRequired - points),
  }));
  const nextGift = ladder.find((gift) => !gift.earned) || null;

  // Deliberately narrow: a painter's name, their points and the ladder. The
  // portal takes an ID with no second factor, so nothing here is worth
  // guessing an ID for - no phone, no address, no citizenship number.
  return {
    painter: {
      name: painter.name,
      type: painter.type || "",
      licenseId: painter.licenseId || "",
      isActive: (painter.status || "ACTIVE") === "ACTIVE",
    },
    period: { mode: period.mode, label: period.label, from: period.from, to: period.to },
    points: {
      earned: points,
      redemptionCount: totals?.count || 0,
      lastEarnedAt: totals?.lastEarnedAt || null,
    },
    gifts: ladder,
    nextGift,
  };
}
