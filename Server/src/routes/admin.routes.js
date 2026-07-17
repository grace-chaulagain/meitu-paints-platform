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
  getDealerInventoryController,
  getDealerInventoryMovementsController,

  // Sales
  listAdminSalesController,
  getAdminSaleController,

  // Dispatchers
  createDispatcherController,
  listDispatchersController,
  listDispatcherApplicationsController,
  listVerifiedDispatchersController,
  getDispatcherController,
  getDispatcherStockController,
  getDispatcherAnalyticsController,
  getDispatcherOwnOrdersController,
  getDispatcherFulfilledOrdersController,
  getDispatcherDealerStatsController,
  getDispatcherProductSummaryController,
  getDispatcherProductMovementsController,
  getDispatcherPricingSummaryController,
  getDispatcherPricingController,
  updateDispatcherPricingController,
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
  closeOrderController,
  reviseOrderController,
  getOrderOutstandingController,

  // Payments
  listPaymentsController,
  verifyPaymentController,
  rejectPaymentController,
} from "../controllers/admin.controller.js";
import {
  generateCouponsController,
  listCouponsController,
  listCouponBatchesController,
  listCouponRedemptionHistoryController,
  getRewardSettingsController,
  updateRewardSettingsController,
  deleteCouponController,
  deleteCouponBatchController,
  deleteCouponBatchesController,
  listCouponAttemptsController,
  getSettlementReportController,
} from "../controllers/coupon.controller.js";
import {
  listPaintersController,
  getPainterController,
  createPainterController,
  updatePainterController,
  deletePainterController,
  listPainterSalesController,
  promotePainterController,
  getPainterIdCardDownloadUrlController,
  getPainterIdCardPhotoUrlController,
  regeneratePainterIdCardWithPhotoController,
  getPainterIdCardTemplateController,
  getPainterPointsController,
} from "../controllers/painter.controller.js";
import {
  listCatalogProductsController,
  getCatalogProductController,
  createCatalogProductController,
  updateCatalogProductController,
  deleteCatalogProductController,
} from "../controllers/pointsCatalog.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { upload } from "../middlewares/upload.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import {
  orderIdParamsSchema,
  dealerIdParamsSchema,
  dealerProductIdParamsSchema,
} from "../validations/common.validation.js";
import {
  adminOrderListQuerySchema,
  hardDeleteOrderBodySchema,
} from "../validations/order.validation.js";
import {
  inventoryListQuerySchema,
  inventoryMovementsQuerySchema,
} from "../validations/dealerInventory.validation.js";
import { adminSaleListQuerySchema } from "../validations/sale.validation.js";
import { saleIdParamsSchema } from "../validations/common.validation.js";
import {
  generateCouponsBodySchema,
  couponListQuerySchema,
  couponBatchListQuerySchema,
  couponRedemptionHistoryQuerySchema,
  updateRewardSettingsBodySchema,
  couponIdParamsSchema,
  couponBatchIdParamsSchema,
  couponBatchIdsBodySchema,
  couponAttemptQuerySchema,
  settlementReportQuerySchema,
} from "../validations/coupon.validation.js";
import {
  painterIdParamsSchema,
  createPainterBodySchema,
  updatePainterBodySchema,
  painterListQuerySchema,
  painterSalesQuerySchema,
  promotePainterBodySchema,
  painterPointsQuerySchema,
} from "../validations/painter.validation.js";
import {
  catalogProductIdParamsSchema,
  createCatalogProductBodySchema,
  updateCatalogProductBodySchema,
  catalogProductListQuerySchema,
} from "../validations/pointsCatalog.validation.js";

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
router.patch("/dealers/:dealerId/credit", updateDealerCreditController);
router.delete("/dealers/:dealerId", deleteDealerController);
router.post("/dealers/:dealerId/undo-delete", undoDealerDeletionController);

router.get(
  "/dealers/:dealerId/inventory",
  validateParams(dealerIdParamsSchema),
  validateQuery(inventoryListQuerySchema),
  getDealerInventoryController,
);
router.get(
  "/dealers/:dealerId/inventory/:productId/movements",
  validateParams(dealerProductIdParamsSchema),
  validateQuery(inventoryMovementsQuerySchema),
  getDealerInventoryMovementsController,
);
// Sales (fleet-wide, across all dealers)
router.get("/sales", validateQuery(adminSaleListQuerySchema), listAdminSalesController);
router.get(
  "/sales/:saleId",
  validateParams(saleIdParamsSchema),
  getAdminSaleController,
);

// Dispatchers
router.post("/dispatchers", createDispatcherController);
router.get("/dispatchers", listDispatchersController);
router.get("/dispatcher-applications", listDispatcherApplicationsController);
router.get("/dispatchers/verified", listVerifiedDispatchersController);
router.get("/dispatchers/pricing-summary", getDispatcherPricingSummaryController);
router.get("/dispatchers/:dispatcherId", getDispatcherController);
router.get("/dispatchers/:dispatcherId/stock", getDispatcherStockController);
router.get(
  "/dispatchers/:dispatcherId/analytics",
  getDispatcherAnalyticsController,
);
router.get(
  "/dispatchers/:dispatcherId/own-orders",
  getDispatcherOwnOrdersController,
);
router.get(
  "/dispatchers/:dispatcherId/fulfilled-orders",
  getDispatcherFulfilledOrdersController,
);
router.get(
  "/dispatchers/:dispatcherId/dealer-stats",
  getDispatcherDealerStatsController,
);
router.get(
  "/dispatchers/:dispatcherId/product-summary",
  getDispatcherProductSummaryController,
);
router.get(
  "/dispatchers/:dispatcherId/products/:productId/movements",
  getDispatcherProductMovementsController,
);
router.get(
  "/dispatchers/:dispatcherId/pricing",
  getDispatcherPricingController,
);
router.put(
  "/dispatchers/:dispatcherId/pricing",
  updateDispatcherPricingController,
);
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
router.post(
  "/orders/:orderId/revise",
  validateParams(orderIdParamsSchema),
  reviseOrderController,
);

// Payments
router.get("/payments", listPaymentsController);
router.post("/payments/:paymentId/verify", verifyPaymentController);
router.post("/payments/:paymentId/reject", rejectPaymentController);

// Coupons
router.post(
  "/coupons/generate",
  validateBody(generateCouponsBodySchema),
  generateCouponsController,
);
router.get(
  "/coupons",
  validateQuery(couponListQuerySchema),
  listCouponsController,
);
router.get(
  "/coupons/batches",
  validateQuery(couponBatchListQuerySchema),
  listCouponBatchesController,
);
router.get(
  "/coupons/redemptions",
  validateQuery(couponRedemptionHistoryQuerySchema),
  listCouponRedemptionHistoryController,
);
router.get("/coupons/settings", getRewardSettingsController);
router.patch(
  "/coupons/settings",
  validateBody(updateRewardSettingsBodySchema),
  updateRewardSettingsController,
);
router.get(
  "/coupons/attempts",
  validateQuery(couponAttemptQuerySchema),
  listCouponAttemptsController,
);
router.get(
  "/coupons/settlement-report",
  validateQuery(settlementReportQuerySchema),
  getSettlementReportController,
);
// Order matters: the literal "/coupons/batches" routes must be declared
// before the "/coupons/:couponId" param route below, or Express would match
// "batches" as a couponId first.
router.delete(
  "/coupons/batches",
  validateBody(couponBatchIdsBodySchema),
  deleteCouponBatchesController,
);
router.delete(
  "/coupons/batches/:batchId",
  validateParams(couponBatchIdParamsSchema),
  deleteCouponBatchController,
);
router.delete(
  "/coupons/:couponId",
  validateParams(couponIdParamsSchema),
  deleteCouponController,
);

// Points catalog (Painter Points Scheme - drives coupon generation)
router.get(
  "/points-catalog-products",
  validateQuery(catalogProductListQuerySchema),
  listCatalogProductsController,
);
router.get(
  "/points-catalog-products/:productId",
  validateParams(catalogProductIdParamsSchema),
  getCatalogProductController,
);
router.post(
  "/points-catalog-products",
  validateBody(createCatalogProductBodySchema),
  createCatalogProductController,
);
router.patch(
  "/points-catalog-products/:productId",
  validateParams(catalogProductIdParamsSchema),
  validateBody(updateCatalogProductBodySchema),
  updateCatalogProductController,
);
router.delete(
  "/points-catalog-products/:productId",
  validateParams(catalogProductIdParamsSchema),
  deleteCatalogProductController,
);

// Painters
router.get(
  "/painters",
  validateQuery(painterListQuerySchema),
  listPaintersController,
);
// Registered before the /:painterId routes below - "id-card-template" would
// otherwise be swallowed by the :painterId wildcard match.
router.get("/painters/id-card-template", getPainterIdCardTemplateController);
router.get(
  "/painters/:painterId",
  validateParams(painterIdParamsSchema),
  getPainterController,
);
router.post(
  "/painters",
  validateBody(createPainterBodySchema),
  createPainterController,
);
router.patch(
  "/painters/:painterId",
  validateParams(painterIdParamsSchema),
  validateBody(updatePainterBodySchema),
  updatePainterController,
);
router.delete(
  "/painters/:painterId",
  validateParams(painterIdParamsSchema),
  deletePainterController,
);
router.get(
  "/painters/:painterId/sales",
  validateParams(painterIdParamsSchema),
  validateQuery(painterSalesQuerySchema),
  listPainterSalesController,
);
router.post(
  "/painters/:painterId/promote",
  validateParams(painterIdParamsSchema),
  validateBody(promotePainterBodySchema),
  promotePainterController,
);
router.get(
  "/painters/:painterId/points",
  validateParams(painterIdParamsSchema),
  validateQuery(painterPointsQuerySchema),
  getPainterPointsController,
);
router.get(
  "/painters/:painterId/id-card",
  validateParams(painterIdParamsSchema),
  getPainterIdCardDownloadUrlController,
);
router.get(
  "/painters/:painterId/id-card-photo",
  validateParams(painterIdParamsSchema),
  getPainterIdCardPhotoUrlController,
);
router.post(
  "/painters/:painterId/id-card",
  validateParams(painterIdParamsSchema),
  upload.single("photo"),
  regeneratePainterIdCardWithPhotoController,
);

export default router;
