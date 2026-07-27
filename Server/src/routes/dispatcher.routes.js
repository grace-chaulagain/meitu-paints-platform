import { Router } from "express";
import {
  createDispatcherApplicationController,
  checkDispatcherEmailAvailabilityController,
  listDispatchersController,
  listPendingDispatchersController,
  getDispatcherByIdController,
  listVerifiedDispatchersController,
  deleteDispatcherController,
  getMyDispatcherProfileController,
  listMyAssignedDealersController,
  getMyAssignedDealerByIdController,
  listMyOrdersController,
  getMyOrderByIdController,
  getMyOrderStockCheckController,
  verifyAssignedOrderController,
  rejectAssignedOrderController,
  amendAssignedOrderController,
  listMyOrderArchiveController,
  createReplenishmentOrderController,
  getMyDispatcherStockController,
  getMyDispatcherStockHistoryController,
  dispatchAssignedOrderController,
  completeAssignedOrderController,
  getMyReplenishmentCatalogController,
  listMyReplenishmentOrdersController,
  getMyReplenishmentOrderController,
} from "../controllers/dispatcher.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { applicationRateLimit, publicReadRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  requireRole,
  requireRoleWithReadOnlyAdmin,
} from "../middlewares/requireRole.middleware.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";
import { dispatcherApplicationBodySchema } from "../validations/application.validation.js";
import { orderIdParamsSchema } from "../validations/common.validation.js";
import {
  amendOrderBodySchema,
  createReplenishmentOrderBodySchema,
  orderReviewBodySchema,
} from "../validations/order.validation.js";

const router = Router();

/* ---------------------------------------
   Public Dispatcher Application
---------------------------------------- */

router.post(
  "/apply",
  applicationRateLimit,
  validateBody(dispatcherApplicationBodySchema),
  createDispatcherApplicationController,
);

// Public, unauthenticated - must stay registered before the /:dispatcherId
// admin-only param route below, otherwise Express would match "check-email"
// as a :dispatcherId value and hit the ADMIN-gated middleware instead.
router.get(
  "/check-email",
  publicReadRateLimit,
  checkDispatcherEmailAvailabilityController,
);

/* ---------------------------------------
   Dispatcher Self Workspace
---------------------------------------- */

router.get(
  "/me",
  auth,
  requireRole("DISPATCHER"),
  getMyDispatcherProfileController,
);

router.get(
  "/me/dealers",
  auth,
  requireRole("DISPATCHER"),
  listMyAssignedDealersController,
);

router.get(
  "/me/dealers/:dealerId",
  auth,
  requireRole("DISPATCHER"),
  getMyAssignedDealerByIdController,
);

router.get(
  "/me/orders",
  auth,
  requireRole("DISPATCHER"),
  listMyOrdersController,
);

router.get(
  "/me/orders/archive",
  auth,
  requireRole("DISPATCHER"),
  listMyOrderArchiveController,
);

router.get(
  "/me/orders/:orderId",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  getMyOrderByIdController,
);

router.get(
  "/me/orders/:orderId/stock-check",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  getMyOrderStockCheckController,
);

router.patch(
  "/me/orders/:orderId/verify",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  verifyAssignedOrderController,
);

router.patch(
  "/me/orders/:orderId/reject",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  rejectAssignedOrderController,
);

router.patch(
  "/me/orders/:orderId/amend",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(amendOrderBodySchema),
  amendAssignedOrderController,
);

router.post(
  "/me/orders/:orderId/dispatch",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  dispatchAssignedOrderController,
);

router.patch(
  "/me/orders/:orderId/complete",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  validateBody(orderReviewBodySchema),
  completeAssignedOrderController,
);

/* ---------------------------------------
   Dispatcher's own replenishment ordering + stock
---------------------------------------- */

router.get(
  "/me/stock",
  auth,
  requireRole("DISPATCHER"),
  getMyDispatcherStockController,
);

router.get(
  "/me/stock/history",
  auth,
  requireRole("DISPATCHER"),
  getMyDispatcherStockHistoryController,
);

router.get(
  "/me/replenishment-catalog",
  auth,
  requireRole("DISPATCHER"),
  getMyReplenishmentCatalogController,
);

router.get(
  "/me/replenishment-orders",
  auth,
  requireRole("DISPATCHER"),
  listMyReplenishmentOrdersController,
);

router.get(
  "/me/replenishment-orders/:orderId",
  auth,
  requireRole("DISPATCHER"),
  validateParams(orderIdParamsSchema),
  getMyReplenishmentOrderController,
);

router.post(
  "/me/replenishment-orders",
  auth,
  requireRole("DISPATCHER"),
  validateBody(createReplenishmentOrderBodySchema),
  createReplenishmentOrderController,
);

/* ---------------------------------------
   Admin Dispatcher Management
---------------------------------------- */

router.get("/", auth, requireRoleWithReadOnlyAdmin("ADMIN"), listDispatchersController);

router.get(
  "/pending",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN"),
  listPendingDispatchersController,
);

router.get(
  "/verified",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN"),
  listVerifiedDispatchersController,
);

router.get(
  "/:dispatcherId",
  auth,
  requireRoleWithReadOnlyAdmin("ADMIN"),
  getDispatcherByIdController,
);

router.delete(
  "/:dispatcherId",
  auth,
  requireRole("ADMIN"),
  deleteDispatcherController,
);

export default router;
