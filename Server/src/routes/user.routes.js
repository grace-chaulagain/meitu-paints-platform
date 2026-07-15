import express from "express";
import { updateMe, changePassword, uploadAvatar } from "../controllers/user.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { changePasswordRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  changePasswordBodySchema,
  updateMeBodySchema,
} from "../validations/user.validation.js";

const router = express.Router();

router.patch("/me", auth, validateBody(updateMeBodySchema), updateMe);
router.post("/me/avatar", auth, upload.single("image"), uploadAvatar);
router.post(
  "/change-password",
  auth,
  changePasswordRateLimit,
  validateBody(changePasswordBodySchema),
  changePassword,
);

export default router;
