import mongoose from "mongoose";

const ORDER_STATUS = Object.freeze({
  SUBMITTED: "SUBMITTED",
  PROCESSING: "PROCESSING",
  AWAITING_SHIPMENT: "AWAITING_SHIPMENT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  SENT_TO_DISPATCHER: "SENT_TO_DISPATCHER",
  DISPATCHED: "DISPATCHED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
});

const FACTORY_STAGE = Object.freeze({
  INBOX: "INBOX",
  PREPARING: "PREPARING",
  SHIPMENT: "SHIPMENT",
  COMPLETED: "COMPLETED",
});

const STOCK_RESERVATION_STATUS = Object.freeze({
  NONE: "NONE",
  RESERVED: "RESERVED",
  RELEASED: "RELEASED",
  CONSUMED: "CONSUMED",
});

const STOCK_CHECK_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  LOW: "LOW",
  INSUFFICIENT: "INSUFFICIENT",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  UNMATCHED: "UNMATCHED",
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
      enum: ["ADMIN", "DISPATCHER", "FACTORY"],
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

const OrderStatusHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: "", trim: true },
    toStatus: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      required: true,
    },
    note: { type: String, default: "", trim: true },
    reason: { type: String, default: "", trim: true },
    changedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedByRole: { type: String, default: "", trim: true },
    changedAt: { type: Date, default: Date.now },
    dealerEmailSentAt: { type: Date, default: null },
  },
  { _id: false },
);

const StockDeductionLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    sku: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    previousQuantity: { type: Number, default: 0 },
    deductedQuantity: { type: Number, default: 0 },
    newQuantity: { type: Number, default: 0 },
  },
  { _id: false },
);

const StockReservationItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    sku: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    previousReservedQuantity: { type: Number, default: 0, min: 0 },
    newReservedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const StockCheckItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    sku: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    requestedQuantity: { type: Number, default: 0, min: 0 },
    currentQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(STOCK_CHECK_STATUS),
      default: STOCK_CHECK_STATUS.UNMATCHED,
    },
    matched: { type: Boolean, default: false },
    message: { type: String, default: "", trim: true },
  },
  { _id: false },
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

    statusHistory: {
      type: [OrderStatusHistorySchema],
      default: [],
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

    factoryStage: {
      type: String,
      enum: Object.values(FACTORY_STAGE),
      default: null,
      index: true,
    },

    factory: {
      sentToFactoryAt: { type: Date, default: null },
      sentToFactoryBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      preparingAt: { type: Date, default: null },
      preparingBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      outForDeliveryAt: { type: Date, default: null },
      outForDeliveryBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      deliveredAt: { type: Date, default: null },
      deliveredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      driverName: { type: String, default: "", trim: true },
      driverPhone: { type: String, default: "", trim: true },
      vehicleNumber: { type: String, default: "", trim: true },
      remarks: { type: String, default: "", trim: true },
    },

    rejection: {
      reason: { type: String, default: "", trim: true },
      rejectedAt: { type: Date, default: null },
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      rejectedByRole: { type: String, default: "", trim: true },
    },

    stockReservation: {
      status: {
        type: String,
        enum: Object.values(STOCK_RESERVATION_STATUS),
        default: STOCK_RESERVATION_STATUS.NONE,
        index: true,
      },
      reservedAt: { type: Date, default: null },
      reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      releasedAt: { type: Date, default: null },
      releasedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      consumedAt: { type: Date, default: null },
      consumedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      items: { type: [StockReservationItemSchema], default: [] },
    },

    stockCheck: {
      checkedAt: { type: Date, default: null },
      items: { type: [StockCheckItemSchema], default: [] },
    },

    stockDeduction: {
      deductedAt: { type: Date, default: null },
      deductedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      lines: { type: [StockDeductionLineSchema], default: [] },
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
OrderSchema.index({ factoryStage: 1, createdAt: -1 });
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
    [
      ORDER_STATUS.VERIFIED,
      ORDER_STATUS.REJECTED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CLOSED,
      ORDER_STATUS.CANCELLED,
    ].includes(this.status)
  ) {
    this.archivedAt = this.archivedAt || new Date();
  } else {
    this.archivedAt = null;
  }
});

export { ORDER_STATUS, ORDER_REVIEWED_BY, FACTORY_STAGE };
export { STOCK_RESERVATION_STATUS, STOCK_CHECK_STATUS };
export default mongoose.model("Order", OrderSchema);
