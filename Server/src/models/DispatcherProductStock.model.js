import mongoose from "mongoose";

// Per (dispatcher, product) stock ledger for a dispatcher's own regional
// warehouse. Credited when the central Factory dispatches the
// dispatcher's own replenishment order; debited when the dispatcher
// dispatches one of their assigned dealers' orders from this stock.
// No reservation phase: replenishment reservation happens against the
// central Product.stock (same pipeline as any Factory order), and this
// ledger only ever reflects physical on-hand quantity at the dispatcher.
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
