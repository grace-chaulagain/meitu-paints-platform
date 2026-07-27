import rateLimit from "express-rate-limit";

function rateLimitResponse(message) {
  return (_, res) => {
    res.status(429).json({
      ok: false,
      error: message,
      code: "RATE_LIMITED",
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

// Read-only "is this link still valid?" check fired automatically whenever a
// reset/setup page loads (not a deliberate user action like the endpoints
// above) - budgeting it against the same tight, mutation-oriented bucket as
// forgot-password/reset-password/set-password/resend-setup-link meant a
// couple of page loads could exhaust the shared limit before the user ever
// got to actually reset anything. Generous on purpose: the token itself
// (a 32-byte random hex string) is the real defense, not this limiter.
export const passwordTokenStatusRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse(
    "Too many link checks. Please wait a moment and try again.",
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
