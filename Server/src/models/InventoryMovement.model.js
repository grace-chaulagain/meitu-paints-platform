import mongoose from "mongoose";

// The single source of truth for every change to a dealer's on-hand
// stock. Append-only - never updated or deleted. DealerProductStock is a
// fast-read denormalized cache derived from this ledger, mirroring the
// existing StockAdjustmentLog pattern used for the central Product.stock.
export const INVENTORY_MOVEMENT_TYPE = Object.freeze({
  PURCHASE: "PURCHASE",
  SALE: "SALE",
  RETURN: "RETURN",
  ADJUSTMENT: "ADJUSTMENT",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
});

const InventoryMovementSchema = new mongoose.Schema(
  {
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    // Headroom for future multi-branch dealers - always null today (one
    // implicit branch per dealer). No branch model/UI exists yet.
    branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    type: {
      type: String,
      enum: Object.values(INVENTORY_MOVEMENT_TYPE),
      required: true,
      index: true,
    },

    // Positive magnitude for PURCHASE/SALE/RETURN/TRANSFER_IN/TRANSFER_OUT
    // (direction is implied by type). Signed delta for ADJUSTMENT, since a
    // correction can go either way and has no fixed direction.
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },

    unitCost: { type: Number, default: null },

    reason: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    // A RETURN or a voided-SALE's compensating movement points back at the
    // movement it reverses.
    relatedMovementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryMovement",
      default: null,
    },

    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "", trim: true },
    ipAddress: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false },
);

InventoryMovementSchema.index({ dealerId: 1, productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ dealerId: 1, createdAt: -1 });
InventoryMovementSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("InventoryMovement", InventoryMovementSchema);
