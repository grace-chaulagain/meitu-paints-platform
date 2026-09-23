import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import { upload } from "../middlewares/upload.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";
import {
  listGiftsController,
  createGiftController,
  updateGiftController,
  deleteGiftController,
  uploadGiftImageController,
  getPortalSettingsController,
  updatePortalSettingsController,
} from "../controllers/painterPortal.controller.js";
import {
  giftBodySchema,
  giftPatchBodySchema,
  giftIdParamsSchema,
  portalSettingsBodySchema,
} from "../validations/painterPortal.validation.js";

// Runs the painter portal: the gift ladder painters aim at, and the fiscal
// year their points are counted in. A read-only admin can look but not
// change, as on every other admin router.
const router = Router();

router.use(auth, requireRoleWithReadOnlyAdmin("ADMIN"));

router.get("/gifts", listGiftsController);
router.post("/gifts", validateBody(giftBodySchema), createGiftController);
router.patch(
  "/gifts/:giftId",
  validateParams(giftIdParamsSchema),
  validateBody(giftPatchBodySchema),
  updateGiftController,
);
router.delete("/gifts/:giftId", validateParams(giftIdParamsSchema), deleteGiftController);
router.post(
  "/gifts/:giftId/image",
  validateParams(giftIdParamsSchema),
  upload.single("image"),
  uploadGiftImageController,
);

router.get("/settings", getPortalSettingsController);
router.patch("/settings", validateBody(portalSettingsBodySchema), updatePortalSettingsController);

export default router;
