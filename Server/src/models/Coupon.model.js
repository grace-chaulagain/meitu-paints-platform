import mongoose from "mongoose";
import { COUPON_TYPE, COUPON_STATUS } from "../constants/coupon.js";

// One coupon = one physical QR code sealed inside one paint bucket. The raw
// QR token is never stored - only its sha256 hash (`tokenHash`), the same
// convention PasswordResetToken.model.js uses for reset links. Redeeming is
// a single atomic status flip (see coupon.service.js:redeemCoupon), guarded
// by the {tokenHash, status: UNUSED, expiresAt: {$gt: now}} filter so two
// concurrent redeem attempts can never both succeed.
const CouponSchema = new mongoose.Schema(
  {
    couponCode: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      enum: Object.values(COUPON_TYPE),
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },

    points: { type: Number, required: true, min: 0 },
    // Snapshotted at generation time from points * the reward settings'
    // weightFactor at that moment - a later settings change must never
    // retroactively alter an already-printed coupon's payout.
    cashAmount: { type: Number, required: true, min: 0 },

    // Free-text product info - not a ref to the main Product catalog
    // (deliberate choice: coupon batches are printed/sealed independently of
    // catalog SKU lifecycle changes). Populated from the selected
    // PointsCatalogProduct/size at generation time (productCategory =
    // category, bucketSize = size or "" for flat-points products);
    // productSku stays unused by the catalog-driven flow but remains for
    // backward compatibility with any historical free-text values.
    productCategory: { type: String, default: "", trim: true },
    productSku: { type: String, default: "", trim: true, index: true },
    bucketSize: { type: String, default: "", trim: true },
    productName: { type: String, default: "", trim: true },

    // Traceability from a generated coupon back to the exact catalog entry
    // (and size) used to generate it - null for coupons generated before
    // this field existed.
    schemeProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointsCatalogProduct",
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(COUPON_STATUS),
      default: COUPON_STATUS.UNUSED,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },

    redeemedAt: { type: Date, default: null },
    redeemedByDealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
      index: true,
    },
    redeemedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Groups one bulk-generate call together for admin filtering/export -
    // not a separate collection, just a shared opaque string per batch.
    batchId: { type: String, default: "", trim: true, index: true },

    // Phase 2 hooks (TTP/RTP painter tracking) - inert/nullable in Phase 1
    // so the redemption code path never needs to be rewritten, only
    // extended: Phase 2 just starts populating these two fields in the
    // same redeemCoupon() service call.
    painterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Painter",
      default: null,
    },
    painterType: {
      type: String,
      enum: ["TTP", "RTP", null],
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

CouponSchema.index({ status: 1, expiresAt: 1 });
CouponSchema.index({ redeemedByDealerId: 1, redeemedAt: -1 });

export default mongoose.model("Coupon", CouponSchema);
