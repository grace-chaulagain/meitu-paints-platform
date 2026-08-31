import mongoose from "mongoose";
import { COUPON_TYPE, POINTS_SKIP_REASON } from "../constants/coupon.js";

// Append-only ledger written once per successful redemption - mirrors
// InventoryMovement's role as the audit trail for dealer stock. This
// collection only ever records successes; failed/invalid/already-used
// attempts go to CouponRedemptionAttemptLog instead, so this table stays a
// clean source for the cash-payout report.
const CouponRedemptionHistorySchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    couponCode: { type: String, required: true },
    type: { type: String, enum: Object.values(COUPON_TYPE), required: true },
    points: { type: Number, required: true },
    cashAmount: { type: Number, required: true },

    // Exactly one of dealerId/dispatcherId is set per row (dealer-redeemed vs
    // dispatcher-redeemed) - enforced in coupon.service.js:redeemCoupon, not
    // at the schema level. Neither is `required` so a dispatcher redemption
    // can leave dealerId null (and vice versa).
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "DealerProfile", default: null, index: true },
    dispatcherId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispatcher", default: null, index: true },
    redeemedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    redeemedAt: { type: Date, required: true, default: Date.now },
    ipAddress: { type: String, default: "" },

    // Phase 2 hook, same nullable-now pattern as Coupon.model.js.
    painterId: { type: mongoose.Schema.Types.ObjectId, ref: "Painter", default: null },
    painterType: { type: String, enum: ["TTP", "RTP", null], default: null },

    // Whether this redemption actually credited a painter's point balance -
    // independent of `type`/`cashAmount` above, which the dealer is paid
    // regardless. False for cash-only RTP redemptions (pre-existing) and for
    // a coupon that had already expired at redemption time (see
    // coupon.service.js:redeemCoupon). Captured here rather than derived
    // later from the source Coupon, since Coupons can be hard-deleted and
    // this table is the permanent audit trail. Defaulting true is correct
    // for every historical row before this field existed - the one
    // pre-existing exception (cash-only RTP) is already independently
    // visible via `painterId === null` on those older rows.
    pointsAwarded: { type: Boolean, required: true, default: true },
    skipReason: { type: String, enum: [...Object.values(POINTS_SKIP_REASON), null], default: null },
  },
  { timestamps: true, versionKey: false },
);

CouponRedemptionHistorySchema.index({ dealerId: 1, redeemedAt: -1 });
CouponRedemptionHistorySchema.index({ dispatcherId: 1, redeemedAt: -1 });
CouponRedemptionHistorySchema.index({ type: 1, redeemedAt: -1 });

export default mongoose.model("CouponRedemptionHistory", CouponRedemptionHistorySchema);
