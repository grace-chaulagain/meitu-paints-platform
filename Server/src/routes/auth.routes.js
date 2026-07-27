import { Router } from "express";
import {
  loginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  setPasswordController,
  passwordTokenStatusController,
  requestSetupLinkController,
  resendSetupEmailController,
  smtpTestController,
} from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import {
  adminAuthUtilityRateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  passwordTokenStatusRateLimit,
  refreshRateLimit,
} from "../middlewares/rateLimit.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  adminResendSetupEmailBodySchema,
  emailOnlyBodySchema,
  loginBodySchema,
  passwordResetBodySchema,
  passwordTokenStatusBodySchema,
  smtpTestBodySchema,
} from "../validations/auth.validation.js";

const router = Router();

// POST /api/auth/login
router.post("/login", loginRateLimit, validateBody(loginBodySchema), loginController);

// POST /api/auth/refresh (uses HttpOnly cookie)
router.post("/refresh", refreshRateLimit, refreshController);

// POST /api/auth/logout
router.post("/logout", logoutController);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  validateBody(emailOnlyBodySchema),
  forgotPasswordController,
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  passwordResetRateLimit,
  validateBody(passwordResetBodySchema),
  resetPasswordController,
);

// POST /api/auth/set-password
router.post(
  "/set-password",
  passwordResetRateLimit,
  validateBody(passwordResetBodySchema),
  setPasswordController,
);

// POST /api/auth/password-token-status
router.post(
  "/password-token-status",
  passwordTokenStatusRateLimit,
  validateBody(passwordTokenStatusBodySchema),
  passwordTokenStatusController,
);

// POST /api/auth/resend-setup-link
router.post(
  "/resend-setup-link",
  passwordResetRateLimit,
  validateBody(emailOnlyBodySchema),
  requestSetupLinkController,
);

// Admin setup email resend
router.post(
  "/resend-setup-email",
  auth,
  requireRole("ADMIN"),
  adminAuthUtilityRateLimit,
  validateBody(adminResendSetupEmailBodySchema),
  resendSetupEmailController,
);

// SMTP test
router.post(
  "/test-email",
  auth,
  requireRole("ADMIN"),
  adminAuthUtilityRateLimit,
  validateBody(smtpTestBodySchema),
  smtpTestController,
);

export default router;
