import mongoose from "mongoose";
import { DEALER_APPLICATION_STATUS } from "../constants/statuses.js";

/**
 * DealerApplication = what a dealer submits before being verified.
 * After verification, you create:
 * - DealerProfile
 * - User (role: DEALER)
 */
const DealerApplicationSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    address: { type: String, default: "" },
    panVat: { type: String, default: "" },
    notes: { type: String, default: "" },

    status: {
      type: String,
      enum: Object.values(DEALER_APPLICATION_STATUS),
      default: DEALER_APPLICATION_STATUS.PENDING,
      index: true,
    },

    // Admin review metadata
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },

    deletion: {
      pending: { type: Boolean, default: false, index: true },
      requestedAt: { type: Date, default: null },
      deleteAfter: { type: Date, default: null, index: true },
      requestedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reason: { type: String, default: "", trim: true },
    },

    // Set once the applicant clicks the confirmation link sent to `email` at
    // submission time. Admins can't act on an application until this is set
    // (enforced in admin.service.js's verifyDealerApplication) - this is
    // what actually catches a typo'd/nonexistent email, since the applicant
    // simply never receives a link to click. A DealerApplication with no
    // emailVerification.tokenHash at all predates this feature and is
    // treated as already-verified (no backfill needed).
    emailVerifiedAt: { type: Date, default: null, index: true },
    emailVerification: {
      tokenHash: { type: String, default: null, index: true },
      expiresAt: { type: Date, default: null },
      sentAt: { type: Date, default: null },
      // How many confirmation emails have gone out in the current rolling
      // window (see EMAIL_SEND_WINDOW_MS in dealer.service.js) - caps how
      // many times an applicant can resend before being asked to wait,
      // independent of the short double-click cooldown sentAt already
      // guards against.
      resendCount: { type: Number, default: 0 },
      windowStartedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

DealerApplicationSchema.index({ status: 1, createdAt: -1 });
DealerApplicationSchema.index({
  "deletion.pending": 1,
  "deletion.deleteAfter": 1,
});

export default mongoose.model("DealerApplication", DealerApplicationSchema);
