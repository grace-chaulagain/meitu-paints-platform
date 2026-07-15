import mongoose from "mongoose";

export const SALE_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  VOIDED: "VOIDED",
});

// Mirrors OrderItemSchema's shape (this codebase's established line-item
// convention), trimmed to what a dealer sale actually needs.
const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    packLabel: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const SaleTotalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NPR", trim: true, uppercase: true },
  },
  { _id: false },
);

// A dealer's record of a sale made to a real end customer - the "sell"
// side of the business, distinct from Order (which is the dealer's own
// purchase from Meitu). This is what dealer incentives should eventually
// be pegged to, since it reflects actual sell-through rather than
// purchase volume.
const SaleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, required: true, unique: true, index: true },

    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      required: true,
      index: true,
    },
    // Headroom for future multi-branch dealers - always null today.
    branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    // The Customer entity was removed - a sale is now just a dealer-entered
    // paper/physical bill reference plus the products against it, purely
    // for stock tracking. customerId is kept only so historical sales
    // (recorded before the removal) still carry whatever id they already
    // had; nothing populates or requires it anymore.
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    billId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    // Denormalized painterId from the old Customer-based linkage, kept for
    // sales recorded before the removal - the Painter profile's "Purchases"
    // tab still queries this directly. New sales never set it (there's no
    // more painter-selection step in the sale flow).
    painterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Painter",
      default: null,
      index: true,
    },
    // Nullable until the Project/Site module (Phase 3) exists.
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },

    items: {
      type: [SaleItemSchema],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one sale item is required",
      },
    },
    totals: { type: SaleTotalsSchema, required: true },

    payment: {
      method: { type: String, default: "", trim: true },
      reference: { type: String, default: "", trim: true },
      note: { type: String, default: "", trim: true },
    },

    notes: { type: String, default: "", trim: true },

    status: {
      type: String,
      enum: Object.values(SALE_STATUS),
      default: SALE_STATUS.COMPLETED,
      index: true,
    },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: "", trim: true },

    // Dealers cannot backdate in Phase 1/2 - always "now" at creation time.
    saleDate: { type: Date, required: true, default: Date.now },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

SaleSchema.index({ dealerId: 1, saleDate: -1 });
SaleSchema.index({ dealerId: 1, billId: 1 });
SaleSchema.index({ dealerId: 1, projectId: 1 });
SaleSchema.index({ dealerId: 1, status: 1, saleDate: -1 });

export default mongoose.model("Sale", SaleSchema);
