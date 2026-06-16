import mongoose from "mongoose";

const ORDER_STATUS = Object.freeze({
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

const ORDER_REVIEWED_BY = Object.freeze({
  ADMIN: "ADMIN",
  DISPATCHER: "DISPATCHER",
});

const OrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
    },

    code: {
      type: String,
      default: "",
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "",
      trim: true,
    },

    variantLabel: {
      type: String,
      default: "",
      trim: true,
    },

    packLabel: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },

    unit: {
      type: String,
      default: "",
      trim: true,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const OrderTotalsSchema = new mongoose.Schema(
  {
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NPR",
      trim: true,
      uppercase: true,
    },
  },
  {
    _id: false,
  },
);

const OrderReviewSchema = new mongoose.Schema(
  {
    reviewedByRole: {
      type: String,
      enum: Object.values(ORDER_REVIEWED_BY),
      default: null,
    },

    reviewedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const OrderAmendmentSchema = new mongoose.Schema(
  {
    amendedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amendedByRole: {
      type: String,
      enum: ["ADMIN", "DISPATCHER"],
      required: true,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    amendedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      required: true,
      index: true,
    },

    // Snapshotted from dealer at submission time for easier archive/reporting
    dealerSnapshot: {
      companyName: { type: String, default: "", trim: true },
      contactName: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      phone: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      panVat: { type: String, default: "", trim: true },
      fulfillmentMode: {
        type: String,
        enum: ["FACTORY", "DISPATCHER"],
        default: "FACTORY",
      },
    },

    // Snapshotted dispatcher assignment at time of submission when relevant
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
      index: true,
    },

    dispatcherSnapshot: {
      name: { type: String, default: "", trim: true },
      companyName: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      phone: { type: String, default: "", trim: true },
    },

    items: {
      type: [OrderItemSchema],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one order item is required",
      },
    },

    totals: {
      type: OrderTotalsSchema,
      required: true,
    },

    payment: {
      method: {
        type: String,
        default: "",
        trim: true,
      },
      reference: {
        type: String,
        default: "",
        trim: true,
      },
      note: {
        type: String,
        default: "",
        trim: true,
      },
    },

    dealerNote: {
      type: String,
      default: "",
      trim: true,
    },

    internalNote: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.SUBMITTED,
      index: true,
    },

    review: {
      type: OrderReviewSchema,
      default: () => ({}),
    },

    amendments: {
      type: [OrderAmendmentSchema],
      default: [],
    },

    factoryEmailSentAt: {
      type: Date,
      default: null,
    },

    externalArchives: {
      googleSheets: {
        appendedAt: { type: Date, default: null },
        lastAttemptedAt: { type: Date, default: null },
        lastError: { type: String, default: "", trim: true },
        spreadsheetId: { type: String, default: "", trim: true },
        sheetName: { type: String, default: "", trim: true },
      },
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },

    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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
      reason: { type: String, default: "", trim: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

OrderSchema.index({ dealerId: 1, createdAt: -1 });
OrderSchema.index({ dispatcherId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "deletion.pending": 1, "deletion.deleteAfter": 1 });
OrderSchema.index({
  "dealerSnapshot.fulfillmentMode": 1,
  status: 1,
  createdAt: -1,
});

OrderSchema.pre("validate", function normalizeOrderFields() {
  if (typeof this.orderNumber === "string") {
    this.orderNumber = this.orderNumber.trim().toUpperCase();
  }

  if (typeof this.dealerNote === "string") {
    this.dealerNote = this.dealerNote.trim();
  }

  if (typeof this.internalNote === "string") {
    this.internalNote = this.internalNote.trim();
  }

  if (this.dealerSnapshot?.fulfillmentMode === "FACTORY") {
    this.dispatcherId = null;
    if (this.dispatcherSnapshot) {
      this.dispatcherSnapshot.name = "";
      this.dispatcherSnapshot.companyName = "";
      this.dispatcherSnapshot.email = "";
      this.dispatcherSnapshot.phone = "";
    }
  }

  if (
    this.dealerSnapshot?.fulfillmentMode === "DISPATCHER" &&
    !this.dispatcherId
  ) {
    throw new Error(
      "dispatcherId is required when dealer fulfillmentMode is DISPATCHER",
    );
  }

  if (
    this.status === ORDER_STATUS.VERIFIED ||
    this.status === ORDER_STATUS.REJECTED
  ) {
    this.archivedAt = this.archivedAt || new Date();
  } else {
    this.archivedAt = null;
  }
});

export { ORDER_STATUS, ORDER_REVIEWED_BY };
export default mongoose.model("Order", OrderSchema);
