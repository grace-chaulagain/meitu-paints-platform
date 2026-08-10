import mongoose from "mongoose";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../constants/statuses.js";

// One slice of an on-account payment applied to a specific order. Written
// oldest-order-first when the payment is recorded, so AR aging (which is
// computed per order, unlike the balance-based per-dealer summary) still
// sees the money and doesn't keep counting a settled bill as overdue.
const PaymentAllocationSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PaymentSchema = new mongoose.Schema(
  {
    // Null for an on-account payment (money received against the party's
    // balance rather than one bill). When null, `allocations` carries the
    // per-order split instead.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    // Exactly one of dealerId / dispatcherId is set - see the validator
    // below. dealerId stays first-class so every existing query and index
    // keeps working unchanged.
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

    allocations: { type: [PaymentAllocationSchema], default: [] },

    method: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: true,
    },

    amount: { type: Number, default: 0 },
    currency: { type: String, default: "NPR" },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING_VERIFICATION,
    },

    proof: {
      fileUrl: { type: String, default: "" },
      note: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now },
    },

    meta: {
      txnId: { type: String, default: "" },
      bankName: { type: String, default: "" },
      chequeNo: { type: String, default: "" },
      bgNo: { type: String, default: "" },
      receivedDate: { type: Date, default: null },
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    verificationNote: { type: String, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// A payment belongs to exactly one party. Enforced at the path level (not
// in a pre-validate hook) so it also fires under validateSync(), and in
// the service layer by construction - a partyless payment would be
// invisible to every AR view, and a double-attributed one counted twice.
PaymentSchema.path("dealerId").validate(function requireOneParty() {
  return Boolean(this.dealerId) || Boolean(this.dispatcherId);
}, "A payment must belong to either a dealer or a dispatcher");

PaymentSchema.path("dispatcherId").validate(function rejectBothParties() {
  return !(this.dealerId && this.dispatcherId);
}, "A payment cannot belong to both a dealer and a dispatcher");

PaymentSchema.index({ orderId: 1, createdAt: -1 });
PaymentSchema.index({ dealerId: 1, createdAt: -1 });
PaymentSchema.index({ dispatcherId: 1, createdAt: -1 });
PaymentSchema.index({ "allocations.orderId": 1 });
PaymentSchema.index({ status: 1, method: 1, createdAt: -1 });

export default mongoose.model("Payment", PaymentSchema);
