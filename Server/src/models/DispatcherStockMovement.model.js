import mongoose from "mongoose";

// The single source of truth for every change to a dispatcher's on-hand
// stock - mirrors InventoryMovement.model.js's role for dealer stock.
// Append-only. DispatcherProductStock is a fast-read denormalized cache
// derived from this ledger.
export const DISPATCHER_STOCK_MOVEMENT_TYPE = Object.freeze({
  REPLENISHMENT_IN: "REPLENISHMENT_IN",
  DISPATCH_OUT: "DISPATCH_OUT",
  ADJUSTMENT: "ADJUSTMENT",
});

const DispatcherStockMovementSchema = new mongoose.Schema(
  {
    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(DISPATCHER_STOCK_MOVEMENT_TYPE),
      required: true,
      index: true,
    },

    // Positive magnitude for REPLENISHMENT_IN/DISPATCH_OUT (direction is
    // implied by type). Signed delta for ADJUSTMENT.
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },

    reason: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    relatedMovementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DispatcherStockMovement",
      default: null,
    },

    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false },
);

DispatcherStockMovementSchema.index({ dispatcherId: 1, productId: 1, createdAt: -1 });
DispatcherStockMovementSchema.index({ dispatcherId: 1, createdAt: -1 });
DispatcherStockMovementSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("DispatcherStockMovement", DispatcherStockMovementSchema);
