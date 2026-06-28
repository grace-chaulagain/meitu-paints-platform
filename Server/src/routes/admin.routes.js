import { Router } from "express";

import {
  getAdminInsightsController,
  getNotificationSettingsController,
  listTrashItemsController,
  restoreAllTrashItemsController,
  restoreTrashItemController,
  testNotificationSettingsController,
  updateNotificationSettingsController,

  // Dealer applications
  listDealerApplicationsController,
  getDealerApplicationController,
  verifyDealerApplicationController,
  rejectDealerApplicationController,
  deleteDealerApplicationController,
  undoDealerApplicationDeletionController,

  // Dealers
  // Dealers
  listDealersController,
  getDealerController,
  getDealerAnalyticsController,
  getDealerLeaderboardController,
  updateDealerController,
  resendDealerSetupEmailController,
  updateDealerRoutingController,
  assignDispatcherToDealerController,
  deleteDealerController,
  unassignDispatcherFromDealerController,
  undoDealerDeletionController,
  setDealerStatusController,
  updateDealerCreditController,

  // Dispatchers
  createDispatcherController,
  listDispatchersController,
  listDispatcherApplicationsController,
  listVerifiedDispatchersController,
  getDispatcherController,
  verifyDispatcherApplicationController,
  rejectDispatcherApplicationController,
  setDispatcherActiveController,
  updateDispatcherController,
  deleteDispatcherController,
  undoDispatcherDeletionController,
  resendDispatcherSetupEmailController,

  // Orders
  listOrdersController,
  getOrderController,
  getOrderStatementsReportController,
  hardDeleteOrderController,
  approveOrderController,
  sendOrderToFactoryController,
  sendOrderToDispatcherController,
  closeOrderController,
  reviseOrderController,
  getOrderOutstandingController,

  // Payments
  listPaymentsController,
  verifyPaymentController,
  rejectPaymentController,
} from "../controllers/admin.controller.js";
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
  hardDeleteOrderBodySchema,
} from "../validations/order.validation.js";

const router = Router();

router.use(auth, requireRole("ADMIN"));

// Settings
router.get("/settings/notifications", getNotificationSettingsController);
router.patch("/settings/notifications", updateNotificationSettingsController);
router.post("/settings/notifications/test", testNotificationSettingsController);
router.get("/settings/trash", listTrashItemsController);
router.post("/settings/trash/restore-all", restoreAllTrashItemsController);
router.post("/settings/trash/:type/:id/restore", restoreTrashItemController);

// Insights
router.get("/insights", getAdminInsightsController);

// Dealer applications
router.post(
  "/dealer-applications/:applicationId/verify",
  verifyDealerApplicationController,
);

router.get("/dealer-applications", listDealerApplicationsController);
router.get(
  "/dealer-applications/:applicationId",
  getDealerApplicationController,
);

router.post(
  "/dealer-applications/:applicationId/reject",
  rejectDealerApplicationController,
);
router.delete(
  "/dealer-applications/:applicationId",
  deleteDealerApplicationController,
);
router.post(
  "/dealer-applications/:applicationId/undo-delete",
  undoDealerApplicationDeletionController,
);

// Dealers
router.get("/dealers", listDealersController);
router.get("/dealers/analytics/leaderboard", getDealerLeaderboardController);
router.get("/dealers/:dealerId/analytics", getDealerAnalyticsController);
router.get("/dealers/:dealerId", getDealerController);
router.patch("/dealers/:dealerId", updateDealerController);
router.post(
  "/dealers/:dealerUserId/resend-setup-email",
  resendDealerSetupEmailController,
);
router.patch("/dealers/:dealerId/routing", updateDealerRoutingController);
router.post(
  "/dealers/:dealerId/assign-dispatcher",
  assignDispatcherToDealerController,
);
router.post(
  "/dealers/:dealerId/unassign-dispatcher",
  unassignDispatcherFromDealerController,
);
router.patch("/dealers/:dealerId/status", setDealerStatusController);
router.delete("/dealers/:dealerId", deleteDealerController);
router.post("/dealers/:dealerId/undo-delete", undoDealerDeletionController);

// Dispatchers
router.post("/dispatchers", createDispatcherController);
router.get("/dispatchers", listDispatchersController);
router.get("/dispatcher-applications", listDispatcherApplicationsController);
router.get("/dispatchers/verified", listVerifiedDispatchersController);
router.get("/dispatchers/:dispatcherId", getDispatcherController);
router.patch(
  "/dispatchers/:dispatcherId/verify",
  verifyDispatcherApplicationController,
);
router.patch(
  "/dispatchers/:dispatcherId/reject",
  rejectDispatcherApplicationController,
);
router.patch(
  "/dispatchers/:dispatcherId/active",
  setDispatcherActiveController,
);
router.patch("/dispatchers/:dispatcherId", updateDispatcherController);
router.delete("/dispatchers/:dispatcherId", deleteDispatcherController);
router.post(
  "/dispatchers/:dispatcherId/undo-delete",
  undoDispatcherDeletionController,
);
router.post(
  "/dispatchers/:dispatcherUserId/resend-setup-email",
  resendDispatcherSetupEmailController,
);

// Orders
router.get("/reports/order-statements", getOrderStatementsReportController);
router.get("/orders", validateQuery(adminOrderListQuerySchema), listOrdersController);
router.get("/orders/:orderId", validateParams(orderIdParamsSchema), getOrderController);
router.delete(
  "/orders/:orderId",
  validateParams(orderIdParamsSchema),
  validateBody(hardDeleteOrderBodySchema),
  hardDeleteOrderController,
);
router.post(
  "/orders/:orderId/approve",
  validateParams(orderIdParamsSchema),
  approveOrderController,
);
router.post(
  "/orders/:orderId/send-to-dispatcher",
  validateParams(orderIdParamsSchema),
  sendOrderToDispatcherController,
);
router.post(
  "/orders/:orderId/send-to-factory",
  validateParams(orderIdParamsSchema),
  sendOrderToFactoryController,
);
router.get(
  "/orders/:orderId/outstanding",
  validateParams(orderIdParamsSchema),
  getOrderOutstandingController,
);
router.post(
  "/orders/:orderId/close",
  validateParams(orderIdParamsSchema),
  closeOrderController,
);
router.post("/orders/:orderId/revise", reviseOrderController);

// Payments
router.get("/payments", listPaymentsController);
router.post("/payments/:paymentId/verify", verifyPaymentController);
router.post("/payments/:paymentId/reject", rejectPaymentController);

export default router;
