import { z } from "zod";
import { objectIdSchema, optionalTrimmedString, trimmedString } from "./common.validation.js";
import { COUPON_TYPE } from "../constants/coupon.js";

// Raw QR tokens are always crypto.randomBytes(32).toString("hex") - exactly
// 64 lowercase hex characters. Rejecting anything else here is a cheap,
// useful first-line filter before ever touching the database.
export const couponTokenParamsSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/, "Invalid coupon token"),
  })
  .strict();

// type/points are deliberately absent - they're resolved server-side from
// the selected PointsCatalogProduct (+ size), never trusted from the client.
export const generateCouponsBodySchema = z
  .object({
    schemeProductId: objectIdSchema,
    size: optionalTrimmedString(20),
    expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), "Expiry must be in the future"),
    quantity: z.coerce.number().int().min(1).max(5000),
  })
  .strict();

export const couponIdParamsSchema = z
  .object({
    couponId: objectIdSchema,
  })
  .strict();

export const couponBatchIdParamsSchema = z
  .object({
    batchId: trimmedString(120),
  })
  .strict();

export const couponBatchIdsBodySchema = z
  .object({
    batchIds: z.array(trimmedString(120)).min(1).max(200),
  })
  .strict();

export const couponBatchListQuerySchema = z
  .object({
    type: z.enum(["ALL", ...Object.values(COUPON_TYPE)]).optional(),
    q: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

// painterId is always optional, for both TTP and RTP - a dealer can
// complete a cash-only redemption without linking a painter profile
// regardless of type (see resolvePainterForRedemption in
// coupon.service.js, the sole place that decides whether a given
// combination skips points accrual). painterType itself is
// nullable/omittable too - the dealer-facing flow sends neither when the
// coupon is already expired (always cash-only regardless), so this schema
// only needs to validate the shape, not whether a painter selection is
// "required" - that's a service-layer decision this schema can't make (it
// hasn't looked the coupon up yet).
export const redeemCouponBodySchema = z
  .object({
    painterType: z.enum(["TTP", "RTP"]).nullable().optional(),
    painterId: objectIdSchema.nullable().optional(),
  })
  .strict();

export const couponAttemptQuerySchema = z
  .object({
    outcome: optionalTrimmedString(40),
    dealerId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const settlementReportQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export const couponListQuerySchema = z
  .object({
    status: z.enum(["ALL", "UNUSED", "REDEEMED", "EXPIRED"]).optional(),
    type: z.enum(["ALL", ...Object.values(COUPON_TYPE)]).optional(),
    batchId: optionalTrimmedString(120),
    q: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    // 5000 (not the usual 200) so the Coupons tab's batch-detail view can
    // fetch every coupon in one generate-batch in a single page - a batch
    // is capped at 5000 coupons (generateCouponsBodySchema's quantity max).
    limit: z.coerce.number().int().min(1).max(5000).optional(),
  })
  .strict();

export const couponRedemptionHistoryQuerySchema = z
  .object({
    type: z.enum(["ALL", ...Object.values(COUPON_TYPE)]).optional(),
    dealerId: optionalTrimmedString(24),
    q: optionalTrimmedString(120),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

// Integer-only - the weight factor is a whole-number multiplier (Cash =
// Points x N), never a fractional one, so the Generate tab's settings
// popover input only ever needs to accept digits.
export const updateRewardSettingsBodySchema = z
  .object({
    weightFactor: z.coerce.number().int().positive().max(1000000),
  })
  .strict();
