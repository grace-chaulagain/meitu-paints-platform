import mongoose from "mongoose";

const DISPATCHER_STATUS = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
};

const DispatcherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(DISPATCHER_STATUS),
      default: DISPATCHER_STATUS.PENDING,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Dedicated field for the rejection reason - deliberately separate from
    // `notes` (the dispatcher's own ongoing operational notes, shown on
    // their profile) so recording why an application was rejected doesn't
    // silently overwrite unrelated notes. Matches DealerApplication's
    // reviewNote naming.
    reviewNote: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activeChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    activeChangedAt: {
      type: Date,
      default: null,
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
        enum: Object.values(DISPATCHER_STATUS),
        default: null,
      },
      previousIsActive: { type: Boolean, default: null },
      assignedDealerIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DealerProfile",
        },
      ],
      reason: { type: String, default: "", trim: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

DispatcherSchema.index({ email: 1 }, { unique: true });
DispatcherSchema.index({ phone: 1 });
DispatcherSchema.index({ "deletion.pending": 1, "deletion.deleteAfter": 1 });

DispatcherSchema.pre("save", function normalizeDispatcherFields() {
  if (typeof this.name === "string") {
    this.name = this.name.replace(/\s+/g, " ").trim();
  }

  if (typeof this.companyName === "string") {
    this.companyName = this.companyName.replace(/\s+/g, " ").trim();
  }

  if (typeof this.phone === "string") {
    this.phone = this.phone.replace(/\s+/g, " ").trim();
  }

  if (typeof this.address === "string") {
    this.address = this.address.replace(/\s+/g, " ").trim();
  }

  if (typeof this.notes === "string") {
    this.notes = this.notes.trim();
  }

  if (this.status === DISPATCHER_STATUS.VERIFIED) {
    this.verifiedAt = this.verifiedAt || new Date();
    this.rejectedAt = null;
  } else if (this.status === DISPATCHER_STATUS.REJECTED) {
    this.rejectedAt = this.rejectedAt || new Date();
    this.verifiedAt = null;
  } else {
    this.verifiedAt = null;
    this.rejectedAt = null;
  }
});

export { DISPATCHER_STATUS };
export default mongoose.model("Dispatcher", DispatcherSchema);
