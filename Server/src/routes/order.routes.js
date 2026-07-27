import { Router } from "express";

import {
  createOrderController,
  listOrdersController,
  getOrderController,
  getOrderStockCheckController,
  amendOrderController,
  verifyOrderController,
  revertOrderVerificationController,
  ensureProformaInvoiceMetadataController,
  rejectOrderController,
} from "../controllers/order.controller.js";

import { auth } from "../middlewares/auth.middleware.js";
import {
  requireRole,
  requireRoleWithReadOnlyAdmin,
} from "../middlewares/requireRole.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import { orderIdParamsSchema } from "../validations/common.validation.js";
import {
  adminOrderListQuerySchema,
  amendOrderBodySchema,
  createOrderBodySchema,
  orderReviewBodySchema,
} from "../validations/order.validation.js";

const router = Router();

// All order routes require authenticated user access.
// Scope and permission rules are enforced inside the service layer
// based on req.user role (ADMIN / DEALER / DISPATCHER).

// Create a new order (dealer flow)
router.post(
  "/",
  auth,
  requireRole("DEALER"),
  validateBody(createOrderBodySchema),
  createOrderController,
);

// Scoped order listing for current actor
router.get(
  "/",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN", "DEALER", "DISPATCHER"),
  validateQuery(adminOrderListQuerySchema),
  listOrdersController,
);

// Admin stock check for an order before verification / factory handoff
router.get(
  "/:orderId/stock-check",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN"),
  validateParams(orderIdParamsSchema),
  getOrderStockCheckController,
);

// Get a single order by id
router.get(
  "/:orderId",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN", "DEALER", "DISPATCHER"),
  validateParams(orderIdParamsSchema),
  getOrderController,
);

// Amend an order before verification
router.patch(
  "/:orderId/amend",
  auth,
  requireRole("ADMIN", "DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(amendOrderBodySchema),
  amendOrderController,
);

// Verify an order
router.post(
  "/:orderId/verify",
  auth,
  requireRole("ADMIN", "DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  verifyOrderController,
);

// Reject an order
router.post(
  "/:orderId/reject",
  auth,
  requireRole("ADMIN", "DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  rejectOrderController,
);

// Revert a verification back to Submitted (Phase 6 - the one reversible
// transition; Admin only, dispatcher revert of their own verify is out of
// scope per the spec).
router.post(
  "/:orderId/revert-verification",
  auth,
  requireRole("ADMIN"),
  validateParams(orderIdParamsSchema),
  revertOrderVerificationController,
);

// Assign (or return the already-assigned/already-frozen) Proforma Invoice
// serialNumber + generatedAt - called right before Admin/Factory build
// the PI PDF client-side.
router.post(
  "/:orderId/proforma-metadata",
  auth,
  requireRole("ADMIN", "FACTORY"),
  validateParams(orderIdParamsSchema),
  ensureProformaInvoiceMetadataController,
);

export default router;
