import { Router } from "express";

import {
  amendFactoryOrderController,
  getFactoryDashboardController,
  getFactoryOrderController,
  getProformaInvoiceController,
  issueFactoryInvoiceController,
  listFactoryDealersController,
  listFactoryOrdersController,
  markDeliveredController,
  markOutForDeliveryController,
  rejectFactoryOrderController,
  updateDispatchPrepController,
} from "../controllers/factory.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import {
  factoryAmendBodySchema,
  factoryDeliveryBodySchema,
  factoryDispatchPrepBodySchema,
  factoryOrderListQuerySchema,
  factoryOrderParamsSchema,
  factoryRejectBodySchema,
  factoryShipmentBodySchema,
} from "../validations/factory.validation.js";

const router = Router();

router.use(auth, requireRole("FACTORY"));

router.get("/dashboard", getFactoryDashboardController);
router.get(
  "/orders",
  validateQuery(factoryOrderListQuerySchema),
  listFactoryOrdersController,
);
router.get("/dealers", listFactoryDealersController);
router.get(
  "/orders/:orderId",
  validateParams(factoryOrderParamsSchema),
  getFactoryOrderController,
);
router.patch(
  "/orders/:orderId/dispatch-prep",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryDispatchPrepBodySchema),
  updateDispatchPrepController,
);
router.post(
  "/orders/:orderId/mark-out-for-delivery",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryShipmentBodySchema),
  markOutForDeliveryController,
);
router.post(
  "/orders/:orderId/mark-delivered",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryDeliveryBodySchema),
  markDeliveredController,
);
router.post(
  "/orders/:orderId/reject",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryRejectBodySchema),
  rejectFactoryOrderController,
);
router.post(
  "/orders/:orderId/amend",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryAmendBodySchema),
  amendFactoryOrderController,
);
router.get(
  "/orders/:orderId/proforma",
  validateParams(factoryOrderParamsSchema),
  getProformaInvoiceController,
);
router.post(
  "/orders/:orderId/invoice",
  validateParams(factoryOrderParamsSchema),
  issueFactoryInvoiceController,
);

export default router;
