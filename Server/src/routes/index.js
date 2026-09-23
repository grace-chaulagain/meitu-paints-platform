import { Router } from "express";

import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import dealerRoutes from "./dealer.routes.js";
import userRoutes from "./user.routes.js";
import productRoutes from "./product.routes.js";
import productFamilyRoutes from "./productFamily.routes.js";
import adminCatalogRoutes from "./admin.catalog.routes.js";
import adminInsightsRoutes from "./admin.insights.routes.js";
import adminPainterPortalRoutes from "./admin.painterPortal.routes.js";
import schemeOrderRoutes from "./schemeOrder.routes.js";
import announcementRoutes from "./announcement.routes.js";
import dispatcherRoutes from "./dispatcher.routes.js";
import redemptionRoutes from "./redemption.routes.js";
import orderRoutes from "./order.routes.js";
import notificationRoutes from "./notification.routes.js";
import pushRoutes from "./push.routes.js";
import stockRoutes from "./stock.routes.js";
import factoryRoutes from "./factory.routes.js";
import { painterLookupController } from "../controllers/painterPortal.controller.js";
import {
  applyForDealershipController,
  verifyDealerEmailController,
  resendDealerVerificationController,
  checkDealerEmailAvailabilityController,
} from "../controllers/dealer.controller.js";

import { auth } from "../middlewares/auth.middleware.js";
import {
  applicationRateLimit,
  dealerApplicationEmailRateLimit,
  painterPortalLookupRateLimit,
  publicReadRateLimit,
} from "../middlewares/rateLimit.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { validateBody, validateQuery } from "../middlewares/validate.middleware.js";
import { painterLookupQuerySchema } from "../validations/painterPortal.validation.js";
import {
  dealerApplicationBodySchema,
  dealerEmailVerificationBodySchema,
  dealerResendVerificationBodySchema,
} from "../validations/application.validation.js";

const router = Router();

// Auth
router.use("/auth", authRoutes);

// Admin
router.use("/admin/catalog", adminCatalogRoutes);
router.use("/admin/announcements", announcementRoutes);
// Mounted before the general /admin router below so /admin/insights/*
// sub-paths (cash-position, reconciliation, orders, ar/*) hit this router
// first; the exact GET /admin/insights (no sub-path) legacy route still
// lives in admin.routes.js and is unaffected since nothing here matches
// an empty suffix.
router.use("/admin/insights", adminInsightsRoutes);
router.use("/admin/scheme-orders", schemeOrderRoutes);
router.use("/admin/painter-portal", adminPainterPortalRoutes);
router.use("/admin", adminRoutes);

// Dealer
router.post(
  "/dealer/apply",
  applicationRateLimit,
  validateBody(dealerApplicationBodySchema),
  applyForDealershipController,
);
router.post(
  "/dealer/verify-email",
  dealerApplicationEmailRateLimit,
  validateBody(dealerEmailVerificationBodySchema),
  verifyDealerEmailController,
);
router.post(
  "/dealer/resend-verification-email",
  dealerApplicationEmailRateLimit,
  validateBody(dealerResendVerificationBodySchema),
  resendDealerVerificationController,
);
router.get(
  "/dealer/check-email",
  publicReadRateLimit,
  checkDealerEmailAvailabilityController,
);
router.use("/dealer", auth, requireRole("DEALER"), dealerRoutes);

// QR/coupon redemption + the painter search/register it needs - shared by
// DEALER and DISPATCHER (some dispatchers act as dealer-style counters), so
// it's its own mount rather than nested under the DEALER-only /dealer block
// above, which would block dispatchers before requireRole even runs the
// inner routes.
router.use("/redemptions", auth, requireRole("DEALER", "DISPATCHER"), redemptionRoutes);

// Painter portal (public, no login). A painter scans a QR, types the ID from
// their card, and reads their own points and gift ladder. Rate-limited and
// deliberately narrow: it answers about one painter at a time and returns no
// contact details - see lookupPainterForPortal.
router.get(
  "/painter-portal/lookup",
  painterPortalLookupRateLimit,
  validateQuery(painterLookupQuerySchema),
  painterLookupController,
);

router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/product-families", productFamilyRoutes);
router.use("/dispatchers", dispatcherRoutes);
router.use("/orders", orderRoutes);
router.use("/notifications", notificationRoutes);
router.use("/push", pushRoutes);
router.use("/stock", stockRoutes);
router.use("/factory", factoryRoutes);

export default router;
