import mongoose from "mongoose";

// The fast-read denormalized cache of a dealer's on-hand stock per product -
// derived from, and reconcilable against, the InventoryMovement ledger
// (the actual source of truth). currentQuantity is what every page reads;
// totalReceivedQuantity/totalSoldQuantity are lifetime, monotonically
// increasing counters kept for turnover analytics.
const DealerProductStockSchema = new mongoose.Schema(
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
    // Headroom for future multi-branch dealers - always null today.
    branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    currentQuantity: { type: Number, default: 0, min: 0 },
    totalReceivedQuantity: { type: Number, default: 0, min: 0 },
    totalSoldQuantity: { type: Number, default: 0, min: 0 },

    lowStockThreshold: { type: Number, default: 0, min: 0 },
    // Simple valuation basis (last purchase rate paid) - currentQuantity x
    // lastKnownUnitCost gives a rough inventory value, not full
    // weighted-average costing (unnecessary at this scale).
    lastKnownUnitCost: { type: Number, default: null },

    lastMovementAt: { type: Date, default: null },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

DealerProductStockSchema.index({ dealerId: 1, productId: 1, branchId: 1 }, { unique: true });
DealerProductStockSchema.index({ dealerId: 1, lastMovementAt: -1 });
DealerProductStockSchema.index({ dealerId: 1, currentQuantity: 1 });

export default mongoose.model("DealerProductStock", DealerProductStockSchema);
