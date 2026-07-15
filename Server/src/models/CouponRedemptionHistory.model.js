import mongoose from "mongoose";
import { COUPON_TYPE } from "../constants/coupon.js";

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

    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "DealerProfile", required: true, index: true },
    redeemedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    redeemedAt: { type: Date, required: true, default: Date.now },
    ipAddress: { type: String, default: "" },

    // Phase 2 hook, same nullable-now pattern as Coupon.model.js.
    painterId: { type: mongoose.Schema.Types.ObjectId, ref: "Painter", default: null },
    painterType: { type: String, enum: ["TTP", "RTP", null], default: null },
  },
  { timestamps: true, versionKey: false },
);

CouponRedemptionHistorySchema.index({ dealerId: 1, redeemedAt: -1 });
CouponRedemptionHistorySchema.index({ type: 1, redeemedAt: -1 });

export default mongoose.model("CouponRedemptionHistory", CouponRedemptionHistorySchema);
