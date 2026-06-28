import { Router } from "express";

import {
  amendFactoryOrderController,
  getFactoryDashboardController,
  getFactoryOrderController,
  getProformaInvoiceController,
  listFactoryOrdersController,
  markDeliveredController,
  markOutForDeliveryController,
  rejectFactoryOrderController,
  startPreparingOrderController,
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
  factoryOrderListQuerySchema,
  factoryOrderParamsSchema,
  factoryPrepareOrderBodySchema,
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
router.get(
  "/orders/:orderId",
  validateParams(factoryOrderParamsSchema),
  getFactoryOrderController,
);
router.post(
  "/orders/:orderId/start-preparing",
  validateParams(factoryOrderParamsSchema),
  validateBody(factoryPrepareOrderBodySchema),
  startPreparingOrderController,
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

export default router;
