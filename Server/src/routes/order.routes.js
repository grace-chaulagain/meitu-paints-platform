import { Router } from "express";

import {
  createOrderController,
  listOrdersController,
  getOrderController,
  getOrderStockCheckController,
  amendOrderController,
  verifyOrderController,
  rejectOrderController,
} from "../controllers/order.controller.js";

import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
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
  requireRole("ADMIN", "DEALER", "DISPATCHER"),
  validateQuery(adminOrderListQuerySchema),
  listOrdersController,
);

// Admin stock check for an order before verification / factory handoff
router.get(
  "/:orderId/stock-check",
  auth,
  requireRole("ADMIN"),
  validateParams(orderIdParamsSchema),
  getOrderStockCheckController,
);

// Get a single order by id
router.get(
  "/:orderId",
  auth,
  requireRole("ADMIN", "DEALER", "DISPATCHER"),
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

export default router;
