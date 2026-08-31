import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import * as couponService from "../services/coupon.service.js";

// Dealer or dispatcher facing - requireRole("DEALER", "DISPATCHER") on the
// mounting route guarantees req.user is one or the other, so exactly one of
// dealerId/dispatcherId will be truthy here (the other is null per
// User.model.js's "only one is used depending on role" convention).
export const getCouponPreviewController = asyncHandler(async (req, res) => {
  const { token } = req.params || {};
  if (!token) throw new ApiError(400, "Missing token");

  const item = await couponService.getCouponPreview({
    rawToken: token,
    dealerId: req.user.dealerId || null,
    dispatcherId: req.user.dispatcherId || null,
    userId: req.user.id,
    ipAddress: req.ip,
  });
  res.status(200).json({ ok: true, item });
});

export const redeemCouponController = asyncHandler(async (req, res) => {
  const { token } = req.params || {};
  if (!token) throw new ApiError(400, "Missing token");
  const { painterType, painterId } = req.body || {};

  const item = await couponService.redeemCoupon({
    rawToken: token,
    dealerId: req.user.dealerId || null,
    dispatcherId: req.user.dispatcherId || null,
    userId: req.user.id,
    ipAddress: req.ip,
    painterType,
    painterId: painterId || null,
  });
  res.status(200).json({ ok: true, item });
});

// Admin-facing
export const generateCouponsController = asyncHandler(async (req, res) => {
  const { schemeProductId, size, expiresAt, quantity } = req.body || {};
  const out = await couponService.generateCoupons({
    schemeProductId,
    size,
    expiresAt,
    quantity,
    actorUser: req.user,
  });
  res.status(201).json({ ok: true, ...out });
});

export const listCouponsController = asyncHandler(async (req, res) => {
  const { status, type, batchId, q, page, limit } = req.query || {};
  const out = await couponService.listCoupons({ status, type, batchId, q, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const listCouponBatchesController = asyncHandler(async (req, res) => {
  const { type, q, page, limit } = req.query || {};
  const out = await couponService.listCouponBatches({ type, q, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const listCouponRedemptionHistoryController = asyncHandler(async (req, res) => {
  const { type, dealerId, dispatcherId, q, from, to, page, limit } = req.query || {};
  const out = await couponService.listRedemptionHistory({ type, dealerId, dispatcherId, q, from, to, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const getRewardSettingsController = asyncHandler(async (req, res) => {
  const item = await couponService.getRewardSettings();
  res.status(200).json({ ok: true, item });
});

export const updateRewardSettingsController = asyncHandler(async (req, res) => {
  const { weightFactor } = req.body || {};
  const item = await couponService.updateRewardSettings({ weightFactor });
  res.status(200).json({ ok: true, item });
});

export const deleteCouponController = asyncHandler(async (req, res) => {
  const { couponId } = req.params || {};
  const out = await couponService.deleteCoupon({ couponId });
  res.status(200).json({ ok: true, ...out });
});

export const deleteCouponBatchController = asyncHandler(async (req, res) => {
  const { batchId } = req.params || {};
  const out = await couponService.deleteCouponBatch({ batchId });
  res.status(200).json({ ok: true, ...out });
});

export const deleteCouponBatchesController = asyncHandler(async (req, res) => {
  const { batchIds } = req.body || {};
  const out = await couponService.deleteCouponBatches({ batchIds });
  res.status(200).json({ ok: true, ...out });
});

export const listCouponAttemptsController = asyncHandler(async (req, res) => {
  const { outcome, dealerId, dispatcherId, page, limit } = req.query || {};
  const out = await couponService.listAttemptLog({ outcome, dealerId, dispatcherId, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const getSettlementReportController = asyncHandler(async (req, res) => {
  const { from, to } = req.query || {};
  const out = await couponService.getSettlementReport({ from, to });
  res.status(200).json({ ok: true, ...out });
});
