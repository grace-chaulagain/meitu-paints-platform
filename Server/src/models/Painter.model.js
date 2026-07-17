import mongoose from "mongoose";

// Originally a plain admin-managed contact directory (no login/auth, no
// role, no approval workflow) named exactly "Painter" to satisfy the
// forward references already present on Coupon.model.js /
// CouponRedemptionHistory.model.js (painterId: { ref: "Painter" }) from the
// rewards/coupon feature. Phase 2 extends it with real TTP/RTP
// classification - all new fields are additive/nullable-by-default so the
// 150 pre-existing seeded contacts (and the existing admin CRUD UI, which
// only ever touches name/phones/address/notes) remain valid unmodified.
const PainterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phones: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one phone number is required",
      },
    },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // null = not yet classified (legacy contact). Auto-promoted to "RTP"
    // the first time it's selected in a redemption; promoted to "TTP" only
    // via the explicit admin promote action (requires a licenseId).
    type: { type: String, enum: ["TTP", "RTP", null], default: null, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "INACTIVE", "BLACKLISTED"],
      default: "ACTIVE",
      index: true,
    },

    // TTP-only (Golden License Card fields). Deliberately no `default`
    // (not even `null`) on licenseId/citizenshipNumber below - the sparse
    // unique indexes on them only exclude documents where the field is
    // truly ABSENT, not documents where it's explicitly set to null. A
    // `default: null` would write the key onto every document, making
    // every painter without a license collide on the same indexed null
    // value the moment a second one is created.
    licenseId: { type: String, trim: true },
    licenseIssuedAt: { type: Date, default: null },
    licenseStatus: { type: String, enum: ["VALID", "EXPIRED", "REVOKED", null], default: null },

    // RTP dedup key at registration time - also usable for TTP.
    citizenshipNumber: { type: String, trim: true },

    trainingStatus: { type: String, enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", null], default: null },

    registrationSource: { type: String, enum: ["ADMIN", "DEALER", null], default: null },
    registeredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Denormalized running totals, incremented atomically alongside every
    // PointLedger row written in coupon.service.js:redeemCoupon - same
    // ledger+cache pattern as DealerProductStock/InventoryMovement.
    totalPoints: { type: Number, default: 0, min: 0 },
    totalCashReceived: { type: Number, default: 0, min: 0 },

    // Best-effort artifact: generated automatically on TTP promotion
    // (painter.service.js:generatePainterIdCard). Never blocks or rolls
    // back the promotion itself if generation/upload fails - stays null
    // until a later retry succeeds. The PDF itself lives in Cloudinary as
    // an "authenticated" asset (public_id is deterministic: `${licenseId}-id-card`),
    // never a plain public URL - Cloudinary's account-level "restricted
    // media types" security setting blocks unauthenticated delivery of
    // PDFs outright, and painter name/phone/licenseId are personal data
    // that shouldn't sit behind a guessable public link anyway. Download
    // links are minted fresh per-request (admin-only route), not stored.
    idCardGeneratedAt: { type: Date, default: null },

    // Distinct from idCardGeneratedAt: that field is set the moment ANY
    // card exists, including the blank-photo one auto-generated on TTP
    // promotion - it does not mean a headshot has ever actually been
    // composited in. This field is set ONLY by regeneratePainterIdCardWithPhoto
    // (never by the promotion-time auto-generate), so it's the true signal
    // for "this card has a real photo" - what gates the Download action.
    idCardPhotoAddedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

PainterSchema.index({ name: 1 });
PainterSchema.index({ licenseId: 1 }, { unique: true, sparse: true });
PainterSchema.index({ citizenshipNumber: 1 }, { unique: true, sparse: true });
PainterSchema.index({ type: 1, status: 1 });

export default mongoose.model("Painter", PainterSchema);
