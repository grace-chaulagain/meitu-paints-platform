export const COUPON_TYPE = Object.freeze({
  GOLDEN: "GOLDEN",
  GREEN: "GREEN",
});

// Stored lifecycle states only. EXPIRED is deliberately NOT a stored value -
// it's derived at read/redemption time from `status === UNUSED && expiresAt
// < now`, so there's no cron/sweep job and it's never stale. There is no
// BLOCKED state - a suspected-fraud coupon is hard-deleted outright (see
// coupon.service.js:deleteCoupon), never soft-frozen. The spec's "INVALID"
// means "token not found / malformed" - i.e. no matching document at all,
// not a stored status.
export const COUPON_STATUS = Object.freeze({
  UNUSED: "UNUSED",
  REDEEMED: "REDEEMED",
});

export const COUPON_REDEMPTION_OUTCOME = Object.freeze({
  SUCCESS: "SUCCESS",
  INVALID: "INVALID",
  EXPIRED: "EXPIRED",
  ALREADY_REDEEMED: "ALREADY_REDEEMED",
  DEALER_NOT_APPROVED: "DEALER_NOT_APPROVED",
});

// Why a successful redemption's points/cash accrual to a Painter was
// skipped - independent of COUPON_REDEMPTION_OUTCOME, which only covers
// whether the redemption itself succeeded. A redemption can succeed (cash
// still paid to the dealer) while points are withheld for one of these
// reasons; stored on CouponRedemptionHistory so it survives the source
// Coupon being hard-deleted later.
export const POINTS_SKIP_REASON = Object.freeze({
  EXPIRED: "EXPIRED",
  RTP_GOLDEN_CASH_ONLY: "RTP_GOLDEN_CASH_ONLY",
  RTP_UNREGISTERED_CASH_ONLY: "RTP_UNREGISTERED_CASH_ONLY",
});

export const COUPON_CODE_PREFIX = Object.freeze({
  [COUPON_TYPE.GOLDEN]: "GLD",
  [COUPON_TYPE.GREEN]: "GRN",
});
