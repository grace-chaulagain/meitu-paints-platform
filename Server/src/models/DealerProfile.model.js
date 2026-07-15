import mongoose from "mongoose";
import { DEALER_STATUS } from "../constants/statuses.js";

/**
 * DealerProfile = created only AFTER admin verification.
 * Linked to a User with role DEALER via `User.dealerId`.
 *
 * fulfillmentMode determines who operationally handles the dealer's orders:
 * - FACTORY => Admin / factory lane handles the orders
 * - DISPATCHER => Assigned dispatcher handles the orders
 */
const DealerProfileSchema = new mongoose.Schema(
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

    status: {
      type: String,
      enum: Object.values(DEALER_STATUS),
      default: DEALER_STATUS.VERIFIED,
      index: true,
    },

    statusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusChangedAt: { type: Date, default: null },

    fulfillmentMode: {
      type: String,
      enum: ["FACTORY", "DISPATCHER"],
      default: "FACTORY",
      index: true,
    },

    // Used only when fulfillmentMode === "DISPATCHER"
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
      index: true,
    },

    routingChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    routingChangedAt: { type: Date, default: null },

    credit: {
      enabled: { type: Boolean, default: false },
      limit: { type: Number, default: 0 },
      dueDays: { type: Number, default: 0 },
    },

    deletion: {
      pending: { type: Boolean, default: false, index: true },
      requestedAt: { type: Date, default: null },
      deleteAfter: { type: Date, default: null, index: true },
      requestedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      previousStatus: {
        type: String,
        enum: Object.values(DEALER_STATUS),
        default: null,
      },
      reason: { type: String, default: "", trim: true },
    },
  },
  { timestamps: true },
);

DealerProfileSchema.index({ status: 1, createdAt: -1 });
DealerProfileSchema.index({ fulfillmentMode: 1, dispatcherId: 1 });
DealerProfileSchema.index({ "deletion.pending": 1, "deletion.deleteAfter": 1 });

DealerProfileSchema.pre("validate", function syncFulfillmentRouting() {
  if (this.fulfillmentMode === "FACTORY") {
    this.dispatcherId = null;
    return;
  }

  if (this.fulfillmentMode === "DISPATCHER" && !this.dispatcherId) {
    throw new Error(
      "dispatcherId is required when fulfillmentMode is DISPATCHER",
    );
  }
});

export default mongoose.model("DealerProfile", DealerProfileSchema);
