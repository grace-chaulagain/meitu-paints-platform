import mongoose from "mongoose";

// The single source of truth for every point-earning event, one immutable
// row per credited redemption - mirrors InventoryMovement.model.js's role
// as an append-only audit ledger paired with a denormalized running-total
// cache (Painter.totalPoints/totalCashReceived). Lifetime/yearly/monthly
// totals are always derived by date-filtered aggregation over this
// collection rather than separately cached rollover counters, so there's
// no reset/cron job and the numbers can never go stale.
const PointLedgerSchema = new mongoose.Schema(
  {
    painterId: { type: mongoose.Schema.Types.ObjectId, ref: "Painter", required: true, index: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    // Unique - a hard guard against ever double-crediting the same
    // redemption, since a redemption (unlike a stock movement) must never
    // legitimately repeat.
    redemptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CouponRedemptionHistory",
      required: true,
      unique: true,
    },
    // Exactly one of dealerId/dispatcherId is set per row (who redeemed this
    // on the painter's behalf) - enforced in coupon.service.js:redeemCoupon,
    // not at the schema level.
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "DealerProfile", default: null, index: true },
    dispatcherId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispatcher", default: null, index: true },

    points: { type: Number, required: true },
    cashAmount: { type: Number, required: true },
    transactionType: { type: String, enum: ["EARNED"], default: "EARNED" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

PointLedgerSchema.index({ painterId: 1, createdAt: -1 });

export default mongoose.model("PointLedger", PointLedgerSchema);
