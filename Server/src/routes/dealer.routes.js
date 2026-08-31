import { Router } from "express";

// QR/coupon redemption + painter search/register used to live here, but
// moved to redemption.routes.js (mounted at /api/redemptions) once
// DISPATCHER also needed them - this router stays blanket-gated to DEALER
// only (see routes/index.js), which would have blocked dispatchers from
// ever reaching those endpoints if they'd stayed nested under it.
import {
  getMyProfileController,
  updateMyProfileController,
  listMyOrdersController,
  getMyOrderStatementsReportController,
  getMyOrderController,
  createOrderController,
  submitPaymentController,
  listMyPaymentsController,
  getMyOrderOutstandingController,
  listMyInventoryController,
  getMyInventoryItemController,
  getMyInventoryMovementsController,
  getMyInventoryHistoryController,
  listMySalesController,
  getMySaleController,
  createMySaleController,
  voidMySaleController,
} from "../controllers/dealer.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import {
  orderIdParamsSchema,
  paginationQuerySchema,
  productIdParamsSchema,
  saleIdParamsSchema,
} from "../validations/common.validation.js";
import {
  createOrderBodySchema,
  dealerPaymentBodySchema,
} from "../validations/order.validation.js";
import { updateMeBodySchema } from "../validations/user.validation.js";
import {
  inventoryListQuerySchema,
  inventoryMovementsQuerySchema,
  inventoryHistoryQuerySchema,
} from "../validations/dealerInventory.validation.js";
import {
  createSaleBodySchema,
  saleListQuerySchema,
  voidSaleBodySchema,
} from "../validations/sale.validation.js";

const router = Router();

// Protected
router.get("/me", getMyProfileController);
router.patch("/me", validateBody(updateMeBodySchema), updateMyProfileController);

router.get("/reports/order-statements", getMyOrderStatementsReportController);

router.get("/orders", validateQuery(paginationQuerySchema), listMyOrdersController);
router.post("/orders", validateBody(createOrderBodySchema), createOrderController);
router.get(
  "/orders/:orderId",
  validateParams(orderIdParamsSchema),
  getMyOrderController,
);

router.get(
  "/orders/:orderId/outstanding",
  validateParams(orderIdParamsSchema),
  getMyOrderOutstandingController,
);
router.post(
  "/orders/:orderId/payments",
  validateParams(orderIdParamsSchema),
  validateBody(dealerPaymentBodySchema),
  submitPaymentController,
);

router.get("/payments", listMyPaymentsController);

router.get(
  "/inventory",
  validateQuery(inventoryListQuerySchema),
  listMyInventoryController,
);
// Must be registered before the /inventory/:productId param route below -
// otherwise Express would match "history" as a productId value.
router.get(
  "/inventory/history",
  validateQuery(inventoryHistoryQuerySchema),
  getMyInventoryHistoryController,
);
router.get(
  "/inventory/:productId",
  validateParams(productIdParamsSchema),
  getMyInventoryItemController,
);
router.get(
  "/inventory/:productId/movements",
  validateParams(productIdParamsSchema),
  validateQuery(inventoryMovementsQuerySchema),
  getMyInventoryMovementsController,
);

router.get("/sales", validateQuery(saleListQuerySchema), listMySalesController);
router.post("/sales", validateBody(createSaleBodySchema), createMySaleController);
router.get(
  "/sales/:saleId",
  validateParams(saleIdParamsSchema),
  getMySaleController,
);
router.post(
  "/sales/:saleId/void",
  validateParams(saleIdParamsSchema),
  validateBody(voidSaleBodySchema),
  voidMySaleController,
);

export default router;
