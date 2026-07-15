import mongoose from "mongoose";
import { COUPON_REDEMPTION_OUTCOME } from "../constants/coupon.js";

// One row per verify-or-redeem attempt, success or failure - the raw
// material for admin "suspicious activity" auditing (repeated invalid
// scans, multiple failed redemptions, etc). Deliberately separate from
// CouponRedemptionHistory, which only ever records successes.
const CouponRedemptionAttemptLogSchema = new mongoose.Schema(
  {
    // Null when the incoming token didn't even look well-formed (wrong
    // length/charset) - never null once it's been hashed and looked up.
    tokenHash: { type: String, default: null, index: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    outcome: {
      type: String,
      enum: Object.values(COUPON_REDEMPTION_OUTCOME),
      required: true,
      index: true,
    },
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "DealerProfile", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

CouponRedemptionAttemptLogSchema.index({ dealerId: 1, createdAt: -1 });

export default mongoose.model("CouponRedemptionAttemptLog", CouponRedemptionAttemptLogSchema);
