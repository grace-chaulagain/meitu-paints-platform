import { Router } from "express";

import {
  getCashPositionController,
  getPaymentReconciliationController,
  getOrderAnalyticsController,
  getArSummaryController,
  getArAgingController,
  getProductPerformanceController,
  getDispatcherPerformanceController,
  getRoutingPerformanceController,
} from "../controllers/admin.insights.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";
import {
  insightsDateRangeQuerySchema,
  insightsTrendQuerySchema,
} from "../validations/adminInsights.validation.js";

// Mounted as a sibling of admin.routes.js (see routes/index.js), not
// nested inside it - matching admin.catalog.routes.js's precedent - so it
// needs its own auth/role guard rather than inheriting one.
const router = Router();

router.use(auth, requireRoleWithReadOnlyAdmin("ADMIN"));

router.get("/cash-position", validateQuery(insightsTrendQuerySchema), getCashPositionController);
router.get(
  "/reconciliation",
  validateQuery(insightsDateRangeQuerySchema),
  getPaymentReconciliationController,
);
router.get("/orders", validateQuery(insightsDateRangeQuerySchema), getOrderAnalyticsController);
router.get("/ar/summary", getArSummaryController);
router.get("/ar/aging", getArAgingController);

router.get("/performance/products", validateQuery(insightsTrendQuerySchema), getProductPerformanceController);
router.get(
  "/performance/dispatchers",
  validateQuery(insightsTrendQuerySchema),
  getDispatcherPerformanceController,
);
router.get(
  "/performance/routing",
  validateQuery(insightsDateRangeQuerySchema),
  getRoutingPerformanceController,
);

export default router;
