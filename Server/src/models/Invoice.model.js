import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderVersion: { type: Number, required: true },

    // Exactly one of dealerId / dispatcherId is set, depending on the
    // order's origin. dealerId is the billed dealer for a DEALER order.
    // dispatcherId here is the *customer* dispatcher being billed
    // (order.dispatcherCustomerId) for a DISPATCHER_REPLENISHMENT order -
    // distinct from Order.dispatcherId, which is the fulfillment-routing
    // dispatcher assigned to service a DEALER order and is never billed.
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
    },
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
    },

    fileUrl: { type: String, default: "" }, // PDF in S3/R2
    issuedAt: { type: Date, default: Date.now },

    totalsSnapshot: { type: Object, default: {} },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// One invoice per order (issued once, at delivery) - also closes the
// race between a concurrent check-then-create in invoice.service.js.
InvoiceSchema.index({ orderId: 1 }, { unique: true });
InvoiceSchema.index({ dealerId: 1, issuedAt: -1 });

export default mongoose.model("Invoice", InvoiceSchema);
