import { Router } from "express";

import {
  listSchemeRecipientsController,
  listSchemeOrdersController,
  createSchemeOrderController,
  updateSchemeOrderController,
  deleteSchemeOrderController,
} from "../controllers/schemeOrder.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../middlewares/validate.middleware.js";
import {
  createSchemeOrderBodySchema,
  updateSchemeOrderBodySchema,
  deleteSchemeOrderBodySchema,
  schemeOrderParamsSchema,
  listSchemeOrdersQuerySchema,
} from "../validations/schemeOrder.validation.js";

// Mounted as a sibling of admin.routes.js, so it carries its own guard.
// requireRoleWithReadOnlyAdmin already blocks non-GET methods for
// read-only admins, so the POST needs no extra check.
const router = Router();

router.use(auth, requireRoleWithReadOnlyAdmin("ADMIN"));

router.get("/recipients", listSchemeRecipientsController);
router.get("/", validateQuery(listSchemeOrdersQuerySchema), listSchemeOrdersController);
router.post("/", validateBody(createSchemeOrderBodySchema), createSchemeOrderController);

// Both only succeed while the factory still has the scheme in its Inbox -
// the status gate lives in the service (SCHEME_EDITABLE_STATUSES /
// SCHEME_DELETABLE_STATUSES), which also refuses any order that isn't a
// scheme, so these can never be pointed at a real dealer order.
router.patch(
  "/:orderId",
  validateParams(schemeOrderParamsSchema),
  validateBody(updateSchemeOrderBodySchema),
  updateSchemeOrderController,
);
router.delete(
  "/:orderId",
  validateParams(schemeOrderParamsSchema),
  validateBody(deleteSchemeOrderBodySchema),
  deleteSchemeOrderController,
);

export default router;
