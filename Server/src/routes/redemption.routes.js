import { Router } from "express";

import {
  getCouponPreviewController,
  redeemCouponController,
} from "../controllers/coupon.controller.js";
import {
  searchPaintersForDealerController,
  registerRtpPainterController,
} from "../controllers/painter.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import { couponRedemptionRateLimit } from "../middlewares/rateLimit.middleware.js";
import { couponTokenParamsSchema, redeemCouponBodySchema } from "../validations/coupon.validation.js";
import { painterSearchQuerySchema, registerRtpPainterBodySchema } from "../validations/painter.validation.js";

// The QR/coupon redemption surface - originally dealer-only (moved out of
// dealer.routes.js), now shared by DEALER and DISPATCHER (some dispatchers
// act as dealer-style counters and need identical redemption ability). One
// shared route with role-conditional logic inside coupon.service.js, rather
// than duplicating these four routes once per role - mirrors order.routes.js's
// pattern for the same reason (identical action for both roles, not
// role-specific actions like the Dispatcher self-service routes under
// dispatcher.routes.js's /me/* prefix).
const router = Router();

router.get(
  "/coupons/:token",
  couponRedemptionRateLimit,
  validateParams(couponTokenParamsSchema),
  getCouponPreviewController,
);
router.post(
  "/coupons/:token/redeem",
  couponRedemptionRateLimit,
  validateParams(couponTokenParamsSchema),
  validateBody(redeemCouponBodySchema),
  redeemCouponController,
);

router.get(
  "/painters/search",
  validateQuery(painterSearchQuerySchema),
  searchPaintersForDealerController,
);
router.post(
  "/painters",
  validateBody(registerRtpPainterBodySchema),
  registerRtpPainterController,
);

export default router;
