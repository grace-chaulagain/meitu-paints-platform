import { Router } from "express";

import {
  listSchemeRecipientsController,
  listSchemeOrdersController,
  createSchemeOrderController,
} from "../controllers/schemeOrder.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import { validateBody, validateQuery } from "../middlewares/validate.middleware.js";
import {
  createSchemeOrderBodySchema,
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

export default router;
