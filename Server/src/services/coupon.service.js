import mongoose from "mongoose";
import crypto from "crypto";

import Coupon from "../models/Coupon.model.js";
import CouponRedemptionHistory from "../models/CouponRedemptionHistory.model.js";
import CouponRedemptionAttemptLog from "../models/CouponRedemptionAttemptLog.model.js";
import CouponRewardSettings from "../models/CouponRewardSettings.model.js";
import Counter from "../models/Counter.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Painter from "../models/Painter.model.js";
import PointLedger from "../models/PointLedger.model.js";
import PointsCatalogProduct from "../models/PointsCatalogProduct.model.js";
import ApiError from "../utils/apiError.js";
import { buildPublicAppUrl } from "../utils/publicUrl.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import {
  COUPON_STATUS,
  COUPON_REDEMPTION_OUTCOME,
  COUPON_CODE_PREFIX,
  POINTS_SKIP_REASON,
} from "../constants/coupon.js";

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function getRewardSettingsDoc() {
  let settings = await CouponRewardSettings.findOne({});
  if (!settings) {
    settings = await CouponRewardSettings.create({});
  }
  return settings;
}

export async function getRewardSettings() {
  const settings = await getRewardSettingsDoc();
  return { weightFactor: settings.weightFactor };
}

export async function updateRewardSettings({ weightFactor } = {}) {
  const settings = await getRewardSettingsDoc();
  settings.weightFactor = Number(weightFactor);
  await settings.save();
  return { weightFactor: settings.weightFactor };
}

// Reserves a contiguous block of `quantity` sequence numbers in a single
// atomic increment, rather than one round trip per coupon - awaiting
// Counter.findOneAndUpdate once per coupon in a loop (the previous
// approach) meant a 500-coupon batch made 500 sequential network round
// trips to the Atlas cluster, easily exceeding the frontend's request
// timeout. Still race-safe: $inc by `quantity` is one atomic operation, so
// two concurrent generate calls can never be handed overlapping ranges.
async function reserveCouponCodeBlock(type, quantity) {
  const prefix = COUPON_CODE_PREFIX[type];
  const counter = await Counter.findOneAndUpdate(
    { _id: `coupon:${type}` },
    { $inc: { seq: quantity } },
    { upsert: true, new: true },
  );
  const startSeq = counter.seq - quantity + 1;
  return Array.from({ length: quantity }, (_, i) => `${prefix}-${String(startSeq + i).padStart(6, "0")}`);
}

async function logAttempt({ tokenHash = null, couponId = null, outcome, dealerId = null, userId = null, ipAddress = "" }) {
  try {
    await CouponRedemptionAttemptLog.create({ tokenHash, couponId, outcome, dealerId, userId, ipAddress });
  } catch (_) {
    // Attempt logging is best-effort auditing - never let a logging failure
    // block or mask the real verify/redeem outcome.
  }
}

async function assertDealerApproved(dealerId) {
  if (!dealerId) throw new ApiError(401, "Authentication required");
  const dealer = await DealerProfile.findById(dealerId).select("status").lean();
  if (!dealer || dealer.status === DEALER_STATUS.SUSPENDED) {
    throw new ApiError(403, "Only approved dealers can redeem coupons", {
      code: "DEALER_NOT_APPROVED",
    });
  }
}

function isExpired(coupon) {
  return coupon.status === COUPON_STATUS.UNUSED && new Date(coupon.expiresAt).getTime() < Date.now();
}

function couponPreviewShape(coupon) {
  return {
    couponCode: coupon.couponCode,
    type: coupon.type,
    points: coupon.points,
    cashAmount: coupon.cashAmount,
    status: coupon.status,
    expiresAt: coupon.expiresAt,
    isExpired: isExpired(coupon),
  };
}

// Classifies exactly why a coupon can't be redeemed, given its current
// document (or null if no matching token exists). Shared by the
// pre-transaction fast-path check and the rare in-transaction race-loss
// fallback in redeemCoupon, so the two paths can never drift apart.
function classifyCouponFailure(existing) {
  if (!existing) {
    return {
      outcome: COUPON_REDEMPTION_OUTCOME.INVALID,
      error: new ApiError(404, "This QR code is invalid or was not issued by Meitu.", { code: "COUPON_INVALID" }),
    };
  }
  if (existing.status === COUPON_STATUS.REDEEMED) {
    return {
      outcome: COUPON_REDEMPTION_OUTCOME.ALREADY_REDEEMED,
      error: new ApiError(409, "This QR code has already been used to redeem the points inside.", {
        code: "COUPON_ALREADY_REDEEMED",
      }),
    };
  }
  return {
    outcome: COUPON_REDEMPTION_OUTCOME.EXPIRED,
    error: new ApiError(410, "This coupon has expired.", { code: "COUPON_EXPIRED" }),
  };
}

function assertPainterEligible(painter) {
  if (["SUSPENDED", "INACTIVE", "BLACKLISTED"].includes(painter.status)) {
    throw new ApiError(403, "This painter is not eligible to receive rewards right now.", {
      code: "PAINTER_NOT_ELIGIBLE",
    });
  }
}

// Resolves and validates the painter selection for a redemption. Entirely
// read-only (aside from the narrow legacy-promotion write below, which is
// an independent fact that shouldn't be tied to this particular coupon's
// transaction outcome) - called before the redemption transaction opens so
// its errors surface immediately.
async function resolvePainterForRedemption({ painterType, painterId, couponType }) {
  if (painterType === "TTP") {
    if (!painterId) throw new ApiError(400, "painterId is required for TTP redemptions");
    const painter = await Painter.findById(painterId);
    if (!painter) throw new ApiError(404, "Painter not found", { code: "PAINTER_NOT_FOUND" });
    if (painter.type && painter.type !== "TTP") {
      throw new ApiError(400, "Selected painter is not registered as a TTP", { code: "PAINTER_TYPE_MISMATCH" });
    }
    if (!painter.licenseId) {
      throw new ApiError(400, "Selected painter has no TTP license on file", { code: "PAINTER_NOT_TTP_LICENSED" });
    }
    assertPainterEligible(painter);
    return { painterId: painter._id, painterType: "TTP", skipPoints: false, skipReason: null };
  }

  if (painterType === "RTP") {
    // Company policy: a Golden coupon's points are reserved for TTP
    // accumulation only. An RTP redeeming a Golden coupon always gets
    // cash-only - no painter profile is linked and no points/cash accrue
    // to any Painter record, even if a painterId was supplied (a stale
    // client, or a direct API call, must not be able to bypass this).
    if (couponType === "GOLDEN") {
      return { painterId: null, painterType: "RTP", skipPoints: true, skipReason: POINTS_SKIP_REASON.RTP_GOLDEN_CASH_ONLY };
    }

    if (!painterId) {
      // Unregistered RTP, cash-only - painterType is still recorded (it's a
      // separable fact from "is there a linked profile"), only painterId
      // and points accumulation are skipped.
      return { painterId: null, painterType: "RTP", skipPoints: true, skipReason: POINTS_SKIP_REASON.RTP_UNREGISTERED_CASH_ONLY };
    }
    const painter = await Painter.findById(painterId);
    if (!painter) throw new ApiError(404, "Painter not found", { code: "PAINTER_NOT_FOUND" });
    if (painter.type === "TTP") {
      throw new ApiError(400, "Selected painter is registered as a TTP, not RTP", { code: "PAINTER_TYPE_MISMATCH" });
    }
    assertPainterEligible(painter);
    // A legacy plain-contact painter (type === null) becomes formally RTP
    // the first time they're used in a redemption - non-destructive,
    // one-way classification, independent of whether this particular
    // coupon redemption ultimately succeeds.
    if (!painter.type) {
      painter.type = "RTP";
      await painter.save();
    }
    return { painterId: painter._id, painterType: "RTP", skipPoints: false, skipReason: null };
  }

  throw new ApiError(400, "painterType must be TTP or RTP");
}

// Resolves coupon type + points from the Painter Points Scheme catalog for
// a chosen product (+ size, if the product is priced per size) - the server
// is the sole source of truth for both, exactly like resolvePainterForRedemption
// forces RTP+GOLDEN to cash-only regardless of client input above: a
// tampered request can't mint a GOLDEN coupon for a GREEN product, or
// fabricate a points value, by supplying them directly.
async function resolveCatalogSelection({ schemeProductId, size }) {
  const product = await PointsCatalogProduct.findById(schemeProductId).lean();
  if (!product || !product.isActive) {
    throw new ApiError(404, "Catalog product not found");
  }

  if (product.pricingMode === "SIZES") {
    const sizeEntry = (product.sizes || []).find((entry) => entry.size === size);
    if (!sizeEntry) {
      throw new ApiError(400, `Size "${size}" is not available for ${product.name}`);
    }
    return { product, points: sizeEntry.points, bucketSize: sizeEntry.size };
  }

  if (!Number.isFinite(Number(product.flatPoints)) || Number(product.flatPoints) <= 0) {
    throw new ApiError(400, `${product.name} has no points value configured`);
  }
  return { product, points: Number(product.flatPoints), bucketSize: "" };
}

// Admin: bulk-generates a batch of coupons for one catalog product (+ size).
// Each coupon's cashAmount is snapshotted from points * the current
// weightFactor at generation time, so a later settings change never
// retroactively alters an already-printed coupon's payout. The raw
// (unhashed) token is only ever present in this one response and in the
// resulting physical QR image - it is never stored or logged anywhere.
export async function generateCoupons({
  schemeProductId,
  size = "",
  expiresAt,
  quantity,
  actorUser,
} = {}) {
  if (!schemeProductId) throw new ApiError(400, "schemeProductId is required");
  if (!Number.isFinite(Number(quantity)) || Number(quantity) < 1) throw new ApiError(400, "quantity must be at least 1");

  const { product, points, bucketSize } = await resolveCatalogSelection({ schemeProductId, size });
  const type = product.couponType;

  const settings = await getRewardSettingsDoc();
  const cashAmount = Math.round(Number(points) * settings.weightFactor * 100) / 100;
  const batchId = crypto.randomUUID();
  const quantityNumber = Number(quantity);

  const couponCodes = await reserveCouponCodeBlock(type, quantityNumber);

  const results = [];
  for (let i = 0; i < quantityNumber; i += 1) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    results.push({
      couponCode: couponCodes[i],
      type,
      points: Number(points),
      cashAmount,
      productCategory: product.category,
      productName: product.name,
      bucketSize,
      schemeProductId: product._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(expiresAt),
      status: COUPON_STATUS.UNUSED,
      generatedBy: actorId(actorUser),
      batchId,
      rawToken,
    });
  }

  await Coupon.insertMany(
    results.map(({ rawToken: _rawToken, ...doc }) => doc),
  );

  return {
    batchId,
    coupons: results.map(({ rawToken, tokenHash: _tokenHash, ...rest }) => ({
      ...rest,
      redeemUrl: buildPublicAppUrl(`/redeem/${rawToken}`),
    })),
  };
}

// Dealer: read-only preview of a scanned coupon. Never mutates state.
export async function getCouponPreview({ rawToken, dealerId, userId, ipAddress } = {}) {
  const tokenHash = hashToken(rawToken);
  await assertDealerApprovedLogged({ dealerId, userId, ipAddress, tokenHash });

  const coupon = await Coupon.findOne({ tokenHash });

  if (!coupon) {
    await logAttempt({ tokenHash, outcome: COUPON_REDEMPTION_OUTCOME.INVALID, dealerId, userId, ipAddress });
    throw new ApiError(404, "This QR code is invalid or was not issued by Meitu.", { code: "COUPON_INVALID" });
  }

  if (coupon.status === COUPON_STATUS.REDEEMED) {
    await logAttempt({ tokenHash, couponId: coupon._id, outcome: COUPON_REDEMPTION_OUTCOME.ALREADY_REDEEMED, dealerId, userId, ipAddress });
    throw new ApiError(409, "This QR code has already been used to redeem the points inside.", {
      code: "COUPON_ALREADY_REDEEMED",
    });
  }

  // Expiry is deliberately not a rejection here - company policy: an
  // expired coupon is still previewable and redeemable (for cash only, see
  // redeemCoupon). couponPreviewShape already computes `isExpired` so the
  // dealer-facing UI can show a warning before they commit to redeeming.
  return couponPreviewShape(coupon);
}

async function assertDealerApprovedLogged({ dealerId, userId, ipAddress, tokenHash }) {
  try {
    await assertDealerApproved(dealerId);
  } catch (error) {
    await logAttempt({ tokenHash, outcome: COUPON_REDEMPTION_OUTCOME.DEALER_NOT_APPROVED, dealerId, userId, ipAddress });
    throw error;
  }
}

// Dealer: the one write path. Painter resolution happens read-only before
// any transaction opens (its errors - not found, ineligible, type
// mismatch - should surface immediately, not roll back a coupon). The
// transaction itself covers exactly what must move together atomically:
// the coupon status flip (still guarded by the same
// {status: UNUSED, expiresAt: {$gt: now}} filter dealerInventory.service.js's
// oversell guard also uses), the history write, and - unless this is a
// cash-only unregistered-RTP redemption - the points ledger write plus the
// painter's running-total increment. Registering a *new* RTP painter is a
// separate, independently-valid call (painter.service.js:registerPainterAsDealer)
// made by the frontend wizard before this function is ever called - see
// the Phase 2 plan doc for why that's deliberately not folded in here.
export async function redeemCoupon({ rawToken, dealerId, userId, ipAddress, painterType, painterId = null } = {}) {
  const tokenHash = hashToken(rawToken);
  await assertDealerApprovedLogged({ dealerId, userId, ipAddress, tokenHash });

  const now = new Date();

  // Read-only fast-path check - fails on the common cases before ever
  // resolving a painter or opening a session. The atomic findOneAndUpdate
  // inside the transaction below remains the real race-safe guard. Expiry
  // is deliberately NOT a rejection here (company policy: an expired coupon
  // is still redeemable for cash, it just doesn't credit the painter - see
  // the skipPoints override below) - only "not found" and "already
  // redeemed" are hard stops.
  const precheck = await Coupon.findOne({ tokenHash });
  if (!precheck || precheck.status !== COUPON_STATUS.UNUSED) {
    const { outcome, error } = classifyCouponFailure(precheck);
    await logAttempt({ tokenHash, couponId: precheck?._id, outcome, dealerId, userId, ipAddress });
    throw error;
  }

  // Captured now, against the coupon's still-UNUSED precheck document -
  // isExpired()'s own UNUSED gate would make this always false once read
  // back after the status flip below, so this can't be recomputed later.
  const expiredAtRedemption = isExpired(precheck);

  const resolved = await resolvePainterForRedemption({ painterType, painterId, couponType: precheck.type });
  if (expiredAtRedemption && !resolved.skipPoints) {
    resolved.skipPoints = true;
    resolved.skipReason = POINTS_SKIP_REASON.EXPIRED;
  }

  const session = await mongoose.startSession();
  let result;
  let redeemedCouponId = null;
  try {
    await session.withTransaction(async () => {
      const updated = await Coupon.findOneAndUpdate(
        { tokenHash, status: COUPON_STATUS.UNUSED },
        {
          $set: {
            status: COUPON_STATUS.REDEEMED,
            redeemedAt: now,
            redeemedByDealerId: dealerId,
            redeemedByUserId: userId,
            painterId: resolved.painterId,
            painterType: resolved.painterType,
          },
        },
        { new: true, session },
      );

      if (!updated) {
        // Lost a last-instant race the precheck above didn't catch (another
        // redemption landed in between) - rare enough that one generic
        // message covers it; the precheck already handles the common cases.
        throw new ApiError(409, "This coupon was just redeemed. Please rescan.", {
          code: "COUPON_ALREADY_REDEEMED",
        });
      }

      const [historyDoc] = await CouponRedemptionHistory.create(
        [
          {
            couponId: updated._id,
            couponCode: updated.couponCode,
            type: updated.type,
            points: updated.points,
            cashAmount: updated.cashAmount,
            dealerId,
            redeemedByUserId: userId,
            redeemedAt: updated.redeemedAt,
            ipAddress,
            painterId: resolved.painterId,
            painterType: resolved.painterType,
            pointsAwarded: !resolved.skipPoints,
            skipReason: resolved.skipReason,
          },
        ],
        { session },
      );

      if (!resolved.skipPoints) {
        await PointLedger.create(
          [
            {
              painterId: resolved.painterId,
              couponId: updated._id,
              redemptionId: historyDoc._id,
              dealerId,
              points: updated.points,
              cashAmount: updated.cashAmount,
              transactionType: "EARNED",
            },
          ],
          { session },
        );
        await Painter.updateOne(
          { _id: resolved.painterId },
          { $inc: { totalPoints: updated.points, totalCashReceived: updated.cashAmount } },
          { session },
        );
      }

      redeemedCouponId = updated._id;
      result = {
        ...couponPreviewShape(updated),
        painterId: resolved.painterId,
        painterType: resolved.painterType,
        // couponPreviewShape's own `isExpired` is now stale/wrong for this
        // response - it's computed from `updated`, whose status just
        // flipped to REDEEMED, and isExpired()'s own UNUSED gate makes that
        // always false post-redemption. pointsAwarded/skipReason are the
        // signals the frontend success screen needs - skipReason
        // distinguishes "expired" from the pre-existing cash-only-RTP
        // reasons, which already have their own distinct UI copy and must
        // not also show the expiry message.
        pointsAwarded: !resolved.skipPoints,
        skipReason: resolved.skipReason,
      };
    });
  } finally {
    session.endSession();
  }

  await logAttempt({
    tokenHash,
    couponId: redeemedCouponId,
    outcome: COUPON_REDEMPTION_OUTCOME.SUCCESS,
    dealerId,
    userId,
    ipAddress,
  });

  return result;
}

// Admin: list generated coupons.
export async function listCoupons({ status = "ALL", type = "ALL", batchId = "", q = "", page = 1, limit = 50 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = {};
  if (type && type !== "ALL") filter.type = type;
  if (batchId) filter.batchId = batchId;
  if (q) filter.couponCode = { $regex: String(q).trim(), $options: "i" };

  if (status === "EXPIRED") {
    filter.status = COUPON_STATUS.UNUSED;
    filter.expiresAt = { $lt: new Date() };
  } else if (status === "UNUSED") {
    filter.status = COUPON_STATUS.UNUSED;
    filter.expiresAt = { $gte: new Date() };
  } else if (status && status !== "ALL") {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "redeemedByDealerId", select: "companyName contactName" })
      .populate({ path: "painterId", select: "name" })
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      isExpired: isExpired(item),
      // Coupon has no pointsAwarded/skipReason field of its own (those live
      // on CouponRedemptionHistory, the permanent audit record) - but "was
      // this expired at the moment it was redeemed" is fully derivable from
      // the two timestamps Coupon already stores, without a join or a
      // redundant field. Only meaningful once REDEEMED - a still-UNUSED,
      // already-past-expiry coupon is covered by `isExpired` above instead.
      redeemedAfterExpiry: Boolean(
        item.status === COUPON_STATUS.REDEEMED &&
          item.redeemedAt &&
          new Date(item.redeemedAt).getTime() > new Date(item.expiresAt).getTime(),
      ),
    })),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

// Admin: one card per generate-batch (grouped by the shared batchId every
// coupon in a bulk-generate call gets) - the Coupons tab browses batches,
// not individual coupons; individual coupons are only ever drilled into via
// listCoupons({ batchId }) once a specific batch card is opened.
export async function listCouponBatches({ type = "ALL", q = "", page = 1, limit = 20 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(100, Math.max(1, Number(limit || 20)));

  const match = { batchId: { $ne: "" } };
  if (type && type !== "ALL") match.type = type;
  if (q) match.productName = { $regex: String(q).trim(), $options: "i" };

  const [result] = await Coupon.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$batchId",
        productName: { $first: "$productName" },
        productCategory: { $first: "$productCategory" },
        bucketSize: { $first: "$bucketSize" },
        type: { $first: "$type" },
        expiresAt: { $first: "$expiresAt" },
        createdAt: { $min: "$createdAt" },
        totalCount: { $sum: 1 },
        redeemedCount: { $sum: { $cond: [{ $eq: ["$status", COUPON_STATUS.REDEEMED] }, 1, 0] } },
        totalCashAmount: { $sum: "$cashAmount" },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (pageNumber - 1) * limitNumber }, { $limit: limitNumber }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const total = result.totalCount[0]?.count || 0;

  return {
    items: result.items.map((row) => ({
      batchId: row._id,
      productName: row.productName,
      productCategory: row.productCategory,
      bucketSize: row.bucketSize,
      type: row.type,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      totalCount: row.totalCount,
      redeemedCount: row.redeemedCount,
      unusedCount: row.totalCount - row.redeemedCount,
      totalCashAmount: row.totalCashAmount,
      hasRedemptions: row.redeemedCount > 0,
    })),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

// Admin: redemption history report.
export async function listRedemptionHistory({ type = "ALL", dealerId = "", q = "", from = "", to = "", page = 1, limit = 50 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = {};
  if (type && type !== "ALL") filter.type = type;
  if (dealerId) filter.dealerId = new mongoose.Types.ObjectId(String(dealerId));
  if (q) filter.couponCode = { $regex: String(q).trim(), $options: "i" };
  if (from || to) {
    filter.redeemedAt = {};
    if (from) filter.redeemedAt.$gte = new Date(from);
    if (to) filter.redeemedAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    CouponRedemptionHistory.find(filter)
      .sort({ redeemedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "dealerId", select: "companyName contactName" })
      .populate({ path: "redeemedByUserId", select: "username email" })
      .populate({ path: "painterId", select: "name type phones licenseId" })
      .lean(),
    CouponRedemptionHistory.countDocuments(filter),
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

// Admin: permanently delete one suspected-fraud/unwanted coupon. Refuses to
// touch a coupon that's already been redeemed - real cash was paid out
// against it, and CouponRedemptionHistory / the settlement report must keep
// tracing back to a live Coupon document.
export async function deleteCoupon({ couponId } = {}) {
  const coupon = await Coupon.findById(couponId).lean();
  if (!coupon) throw new ApiError(404, "Coupon not found");
  if (coupon.status === COUPON_STATUS.REDEEMED) {
    throw new ApiError(409, "This coupon has already been redeemed and cannot be deleted.", {
      code: "COUPON_ALREADY_REDEEMED",
    });
  }

  await Coupon.deleteOne({ _id: couponId });
  return { deleted: true };
}

// Admin: permanently delete every coupon in one generate-batch. Refuses the
// whole batch if even one coupon inside it has been redeemed, rather than
// silently deleting only the unredeemed remainder - a partial delete would
// leave a batch card that no longer represents what was actually printed.
export async function deleteCouponBatch({ batchId } = {}) {
  const redeemedCount = await Coupon.countDocuments({ batchId, status: COUPON_STATUS.REDEEMED });
  if (redeemedCount > 0) {
    throw new ApiError(409, "This batch contains redeemed coupons and cannot be deleted.", {
      code: "BATCH_HAS_REDEMPTIONS",
    });
  }

  const result = await Coupon.deleteMany({ batchId });
  if (result.deletedCount === 0) throw new ApiError(404, "Batch not found");
  return { deleted: true, deletedCount: result.deletedCount };
}

// Admin: bulk-delete multiple batches in one call (the Coupons tab's
// multi-select action). Each batch is checked independently - a mix of
// clean and redemption-protected batches in the same selection deletes the
// clean ones and reports the rest as skipped, rather than failing the whole
// call over one protected batch.
export async function deleteCouponBatches({ batchIds = [] } = {}) {
  const deletedBatchIds = [];
  const skippedBatchIds = [];

  for (const batchId of batchIds) {
    const redeemedCount = await Coupon.countDocuments({ batchId, status: COUPON_STATUS.REDEEMED });
    if (redeemedCount > 0) {
      skippedBatchIds.push(batchId);
      continue;
    }
    const result = await Coupon.deleteMany({ batchId });
    if (result.deletedCount > 0) deletedBatchIds.push(batchId);
  }

  return { deletedBatchIds, skippedBatchIds };
}

// Admin: fraud-auditing feed over CouponRedemptionAttemptLog (every
// verify/redeem attempt, success or failure).
export async function listAttemptLog({ outcome = "", dealerId = "", page = 1, limit = 50 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = {};
  if (outcome && outcome !== "ALL") filter.outcome = outcome;
  if (dealerId) filter.dealerId = dealerId;

  const [items, total] = await Promise.all([
    CouponRedemptionAttemptLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "dealerId", select: "companyName contactName" })
      .populate({ path: "userId", select: "username email" })
      .populate({ path: "couponId", select: "couponCode type" })
      .lean(),
    CouponRedemptionAttemptLog.countDocuments(filter),
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

// Admin: how much cash each dealer has paid out - the raw material for a
// reimbursement/settlement report. Cash-only unregistered-RTP redemptions
// count the same as any other, since cash was genuinely paid out
// regardless of whether a painter profile is linked.
export async function getSettlementReport({ from = "", to = "" } = {}) {
  const match = {};
  if (from || to) {
    match.redeemedAt = {};
    if (from) match.redeemedAt.$gte = new Date(from);
    if (to) match.redeemedAt.$lte = new Date(to);
  }

  const rows = await CouponRedemptionHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$dealerId",
        totalCashPaid: { $sum: "$cashAmount" },
        totalPoints: { $sum: "$points" },
        redemptionCount: { $sum: 1 },
      },
    },
    { $sort: { totalCashPaid: -1 } },
  ]);

  const dealerIds = rows.map((row) => row._id).filter(Boolean);
  const dealers = dealerIds.length
    ? await DealerProfile.find({ _id: { $in: dealerIds } }).select("companyName contactName").lean()
    : [];
  const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]));

  return {
    items: rows.map((row) => ({
      dealerId: row._id,
      dealer: dealerById.get(String(row._id)) || null,
      totalCashPaid: row.totalCashPaid || 0,
      totalPoints: row.totalPoints || 0,
      redemptionCount: row.redemptionCount || 0,
    })),
  };
}
