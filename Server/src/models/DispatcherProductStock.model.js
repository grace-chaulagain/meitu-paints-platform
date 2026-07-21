import mongoose from "mongoose";

// Per (dispatcher, product) stock ledger for a dispatcher's own regional
// warehouse. Credited when the central Factory dispatches the
// dispatcher's own replenishment order; debited when the dispatcher
// dispatches one of their assigned dealers' orders from this stock.
// reservedQuantity mirrors Product.stock.reservedQuantity's role for the
// central ledger: a dealer order routed to this dispatcher reserves
// against currentQuantity the moment it's verified (see
// reserveDispatcherStockForOrder in dispatcherStock.service.js), then the
// reservation is consumed (both fields decremented) at actual dispatch -
// this is what stops a dispatcher from verifying more orders than they
// can physically fulfill.
const DispatcherProductStockSchema = new mongoose.Schema(
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
    currentQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    lastUpdatedAt: { type: Date, default: null },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

DispatcherProductStockSchema.index(
  { dispatcherId: 1, productId: 1 },
  { unique: true },
);

export default mongoose.model(
  "DispatcherProductStock",
  DispatcherProductStockSchema,
);
