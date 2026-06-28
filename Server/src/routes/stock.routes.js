import { Router } from "express";

import {
  bulkUpdateStockController,
  getStockDetailController,
  getStockHistoryController,
  listStockHistoryController,
  listStockController,
  updateStockQuantityController,
  updateStockThresholdController,
} from "../controllers/stock.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";
import {
  stockHistoryQuerySchema,
  stockListQuerySchema,
  stockProductParamsSchema,
  bulkStockUpdateBodySchema,
  updateStockBodySchema,
  updateStockThresholdBodySchema,
} from "../validations/stock.validation.js";

const router = Router();

router.use(auth, requireRole("FACTORY", "ADMIN"));

router.get("/", validateQuery(stockListQuerySchema), listStockController);
router.get(
  "/history",
  validateQuery(stockHistoryQuerySchema),
  listStockHistoryController,
);
router.patch(
  "/bulk",
  validateBody(bulkStockUpdateBodySchema),
  bulkUpdateStockController,
);
router.get(
  "/:productId",
  validateParams(stockProductParamsSchema),
  getStockDetailController,
);
router.get(
  "/:productId/history",
  validateParams(stockProductParamsSchema),
  validateQuery(stockHistoryQuerySchema),
  getStockHistoryController,
);
router.patch(
  "/:productId",
  validateParams(stockProductParamsSchema),
  validateBody(updateStockBodySchema),
  updateStockQuantityController,
);
router.patch(
  "/:productId/threshold",
  validateParams(stockProductParamsSchema),
  validateBody(updateStockThresholdBodySchema),
  updateStockThresholdController,
);

export default router;
