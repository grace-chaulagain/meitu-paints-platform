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
  listPayablePartiesController,
  listAdminPaymentsController,
  getPartyDuesController,
  previewAllocationController,
  createAdminPaymentController,
} from "../controllers/admin.insights.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import { validateBody, validateQuery } from "../middlewares/validate.middleware.js";
import {
  insightsDateRangeQuerySchema,
  insightsTrendQuerySchema,
  paymentsListQuerySchema,
  partyDuesQuerySchema,
  allocationPreviewQuerySchema,
  createPaymentBodySchema,
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

// Payments ledger. The router-level requireRoleWithReadOnlyAdmin guard
// already rejects non-GET methods for read-only admins, so the POST needs
// no extra role check.
router.get("/payments/parties", listPayablePartiesController);
router.get("/payments/dues", validateQuery(partyDuesQuerySchema), getPartyDuesController);
router.get(
  "/payments/allocation-preview",
  validateQuery(allocationPreviewQuerySchema),
  previewAllocationController,
);
router.get("/payments", validateQuery(paymentsListQuerySchema), listAdminPaymentsController);
router.post("/payments", validateBody(createPaymentBodySchema), createAdminPaymentController);

export default router;
