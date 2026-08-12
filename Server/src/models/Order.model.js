import mongoose from "mongoose";

// Deliberately just 6 values - an order either hasn't been looked at yet
// (SUBMITTED), has been reviewed and is queued for fulfillment (VERIFIED),
// has physically left for the dealer/dispatcher (DISPATCHED), or is done
// (COMPLETED), with REJECTED/CANCELLED as the two off-ramps. There is no
// separate "preparing"/"awaiting shipment"/"out for delivery" checkpoint -
// those all used to be sub-stages of VERIFIED or DISPATCHED and added
// nothing an actor could act on differently. "Closed" (financial
// reconciliation) is tracked separately via `closedAt`/`closedBy` below,
// not as a status - closing is orthogonal to fulfillment progress.
const ORDER_STATUS = Object.freeze({
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  DISPATCHED: "DISPATCHED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
});

// DEALER: a dealer's own order (the original, default case).
// DISPATCHER_REPLENISHMENT: a dispatcher ordering their own regional
// stock from the central Factory - reuses the same order lifecycle,
// distinguished by this field rather than a parallel pipeline.
// SCHEME: a free-of-cost order the admin creates to reward a dealer or
// dispatcher (fiscal-year volume schemes). It reuses the whole order
// pipeline, but differs in three ways that the rest of the code must
// respect:
//   1. It is ALWAYS fulfilled by the factory, even when the recipient
//      dealer's own fulfillmentMode is DISPATCHER - so routing must key
//      off orderOrigin here, not off dealerSnapshot.fulfillmentMode.
//   2. Every line is zero-value, so it is excluded from revenue/AR the
//      same way DISPATCHER_REPLENISHMENT is.
//   3. It is created already VERIFIED (admin creating it is the
//      approval) with stock reserved at creation.
const ORDER_ORIGIN = Object.freeze({
  DEALER: "DEALER",
  DISPATCHER_REPLENISHMENT: "DISPATCHER_REPLENISHMENT",
  SCHEME: "SCHEME",
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

    // Snapshot of a set/bundle product's contents at order time (e.g. the
    // Granite Epoxy Floor Paint kit's 7 pieces) - display only, no price
    // per component. Empty for every ordinary line item.
    components: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
          name: { type: String, default: "", trim: true },
          packLabel: { type: String, default: "", trim: true },
          quantity: { type: Number, default: 1 },
          _id: false,
        },
      ],
      default: [],
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

    // Separate from orderNumber (ORD-XXXXXX, opaque/random) - a plain
    // ever-increasing integer assigned via Counter at creation time so the
    // Order Summary and Proforma Invoice PDFs can print a small "SN{n}"
    // that matches the actual sequence orders were generated in. Optional/
    // sparse since orders created before this field existed have none.
    serialNumber: {
      type: Number,
      index: true,
      unique: true,
      sparse: true,
    },

    // The single canonical "what date does the PI show" instant - separate
    // from dispatchPrep.proformaGeneratedAt (factory checklist-step
    // tracking, goes inert post-dispatch). Refreshed on every PI
    // generation while status === VERIFIED; frozen the instant status
    // leaves VERIFIED (or on first-ever post-dispatch generation, for
    // orders dispatched without a PI ever being generated pre-dispatch).
    proformaIssuedAt: { type: Date, default: null },

    // DEALER for a dealer's own order; DISPATCHER_REPLENISHMENT for a
    // dispatcher's own stock-replenishment order placed against the
    // central Factory. Required-ness of dealerId / dispatcherCustomerId
    // below is enforced in the pre-validate hook, same pattern already
    // used for dispatcherId + fulfillmentMode.
    orderOrigin: {
      type: String,
      enum: Object.values(ORDER_ORIGIN),
      default: ORDER_ORIGIN.DEALER,
      index: true,
    },

    // Required only for DEALER-origin orders.
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
      index: true,
    },

    // Required only for DISPATCHER_REPLENISHMENT-origin orders - the
    // dispatcher acting as the customer of this order. Distinct from
    // `dispatcherId` below, which is the fulfillment-routing dispatcher
    // assigned to service a DEALER's order.
    dispatcherCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
      index: true,
    },

    // Set only on SCHEME orders. `label` is the campaign this giveaway
    // belongs to (e.g. "Dashain 2083 Volume Scheme") so schemes can be
    // reported on as a group rather than as a pile of anonymous
    // zero-value orders.
    scheme: {
      label: { type: String, default: "", trim: true },
      note: { type: String, default: "", trim: true },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      // Set when an admin amends a scheme that the factory hasn't shipped
      // yet. A scheme carries no price, so the usual "the totals changed"
      // audit trail says nothing about it - this is the only record that the
      // contents of the grant were revised after it was raised.
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      updatedAt: { type: Date, default: null },
    },

    // Snapshotted from dealer (or, for a DISPATCHER_REPLENISHMENT order,
    // from the ordering dispatcher's own profile) at submission time for
    // easier archive/reporting and so every existing dealer-facing
    // notification/email/PDF code path works unchanged for either origin.
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

    // Audit pair for the one reversible transition in the system (Phase 6
    // of the order-state-handling redesign) - set by revertOrderVerification,
    // never cleared, so an order's full "was verified, then un-verified"
    // history stays visible even after it's re-verified later.
    unverifiedAt: { type: Date, default: null },
    unverifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    amendments: {
      type: [OrderAmendmentSchema],
      default: [],
    },

    factoryEmailSentAt: {
      type: Date,
      default: null,
    },

    factory: {
      sentToFactoryAt: { type: Date, default: null },
      sentToFactoryBy: {
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

    // Working state for the factory's pre-dispatch checklist (Stock
    // Available / Packing Complete / Proforma Invoice) and the driver
    // details entered while preparing it - persisted so closing the order
    // modal before clicking Dispatch doesn't lose progress and force the
    // Proforma Invoice to be regenerated from scratch. Superseded by the
    // `factory` fields above once the order actually dispatches.
    dispatchPrep: {
      stockConfirmed: { type: Boolean, default: false },
      packingConfirmed: { type: Boolean, default: false },
      driverName: { type: String, default: "", trim: true },
      driverPhone: { type: String, default: "", trim: true },
      vehicleNumber: { type: String, default: "", trim: true },
      proformaGeneratedAt: { type: Date, default: null },
      proformaGeneratedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
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

    // Financial reconciliation (admin confirms a completed order is fully
    // paid/settled) is orthogonal to fulfillment progress, so it's a flag
    // on top of `status` rather than a status value itself - an order can
    // be closed the moment it's COMPLETED without that meaning something
    // different about where it is in the fulfillment pipeline.
    closedAt: { type: Date, default: null, index: true },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

    currentVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

  // Guarded by isNew/isModified so these checks only run when the fields
  // they inspect are actually being created or changed - a save that loaded
  // the document via a restrictive .select() (e.g. admin.service.js's
  // hardDeleteOrder/undoOrderDeletion, which only touch isDeleted/deletion)
  // would otherwise see orderOrigin/dealerId/dispatcherId as `undefined`
  // (deselected, not their real DB value), misclassify a legitimate
  // DISPATCHER_REPLENISHMENT order as a DEALER order missing its dealerId,
  // and throw here on every such save regardless of what was actually
  // being updated.
  if (
    this.isNew ||
    this.isModified("orderOrigin") ||
    this.isModified("dealerId") ||
    this.isModified("dispatcherCustomerId")
  ) {
    if (this.orderOrigin === ORDER_ORIGIN.DISPATCHER_REPLENISHMENT) {
      if (!this.dispatcherCustomerId) {
        throw new Error(
          "dispatcherCustomerId is required for DISPATCHER_REPLENISHMENT orders",
        );
      }
      this.dealerId = null;
    } else if (this.orderOrigin === ORDER_ORIGIN.SCHEME) {
      // A scheme goes to exactly one recipient - a dealer or a
      // dispatcher - never both and never neither.
      const hasDealer = Boolean(this.dealerId);
      const hasDispatcher = Boolean(this.dispatcherCustomerId);
      if (hasDealer === hasDispatcher) {
        throw new Error(
          "A SCHEME order needs exactly one recipient: dealerId or dispatcherCustomerId",
        );
      }
    } else if (!this.dealerId) {
      throw new Error("dealerId is required for DEALER orders");
    }
  }

  if (
    (this.isNew ||
      this.isModified("dealerSnapshot.fulfillmentMode") ||
      this.isModified("dispatcherId")) &&
    this.dealerSnapshot?.fulfillmentMode === "DISPATCHER" &&
    !this.dispatcherId &&
    // Schemes always ship direct from the factory, so a dispatcher-served
    // dealer's scheme legitimately has no routing dispatcher.
    this.orderOrigin !== ORDER_ORIGIN.SCHEME
  ) {
    throw new Error(
      "dispatcherId is required when dealer fulfillmentMode is DISPATCHER",
    );
  }

  // SUBMITTED is the only "not yet looked at" status - every other status
  // (including the two off-ramps) means an admin/dispatcher/factory actor
  // has already acted on it, so it drops out of the default pending queue.
  if (this.status !== ORDER_STATUS.SUBMITTED) {
    this.archivedAt = this.archivedAt || new Date();
  } else {
    this.archivedAt = null;
  }
});

export { ORDER_STATUS, ORDER_REVIEWED_BY, ORDER_ORIGIN };
export { STOCK_RESERVATION_STATUS, STOCK_CHECK_STATUS };
export default mongoose.model("Order", OrderSchema);
