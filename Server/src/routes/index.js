import { Router } from "express";

import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import dealerRoutes from "./dealer.routes.js";
import userRoutes from "./user.routes.js";
import productRoutes from "./product.routes.js";
import productFamilyRoutes from "./productFamily.routes.js";
import adminCatalogRoutes from "./admin.catalog.routes.js";
import dispatcherRoutes from "./dispatcher.routes.js";
import orderRoutes from "./order.routes.js";
import notificationRoutes from "./notification.routes.js";
import stockRoutes from "./stock.routes.js";
import factoryRoutes from "./factory.routes.js";
import { applyForDealershipController } from "../controllers/dealer.controller.js";

import { auth } from "../middlewares/auth.middleware.js";
import { applicationRateLimit } from "../middlewares/rateLimit.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { dealerApplicationBodySchema } from "../validations/application.validation.js";

const router = Router();

// Auth
router.use("/auth", authRoutes);

// Admin
router.use("/admin/catalog", adminCatalogRoutes);
router.use("/admin", adminRoutes);

// Dealer
router.post(
  "/dealer/apply",
  applicationRateLimit,
  validateBody(dealerApplicationBodySchema),
  applyForDealershipController,
);
router.use("/dealer", auth, requireRole("DEALER"), dealerRoutes);

router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/product-families", productFamilyRoutes);
router.use("/dispatchers", dispatcherRoutes);
router.use("/orders", orderRoutes);
router.use("/notifications", notificationRoutes);
router.use("/stock", stockRoutes);
router.use("/factory", factoryRoutes);

export default router;
