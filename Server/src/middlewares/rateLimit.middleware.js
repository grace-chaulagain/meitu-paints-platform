import rateLimit from "express-rate-limit";

function rateLimitResponse(message) {
  return (_, res) => {
    res.status(429).json({
      ok: false,
      error: "RATE_LIMITED",
      message,
    });
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many login attempts. Please wait before trying again.",
  ),
});

export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many session refresh attempts. Please sign in again.",
  ),
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many password reset attempts. Please wait before trying again.",
  ),
});

export const changePasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many password change attempts. Please wait before trying again.",
  ),
});

export const adminAuthUtilityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many admin auth utility requests. Please wait before trying again.",
  ),
});

export const applicationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many application submissions. Please wait before trying again.",
  ),
});

export const publicReadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many public requests. Please wait before trying again.",
  ),
});

export const publicWriteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many requests. Please wait before trying again.",
  ),
});

export const couponRedemptionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many coupon scan attempts. Please wait before trying again.",
  ),
});
