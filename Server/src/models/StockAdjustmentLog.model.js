import mongoose from "mongoose";

export const STOCK_ADJUSTMENT_TYPE = Object.freeze({
  MANUAL_CORRECTION: "MANUAL_CORRECTION",
  THRESHOLD_UPDATE: "THRESHOLD_UPDATE",
  ORDER_SHIPMENT_DEDUCTION: "ORDER_SHIPMENT_DEDUCTION",
  RESERVATION_CREATED: "RESERVATION_CREATED",
  RESERVATION_RELEASED: "RESERVATION_RELEASED",
  RESERVATION_CONSUMED: "RESERVATION_CONSUMED",
  ORDER_AMENDED: "ORDER_AMENDED",
});

const StockAdjustmentLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sku: { type: String, required: true, trim: true, index: true },
    code: { type: String, default: "", trim: true },
    productName: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    packLabel: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },

    type: {
      type: String,
      enum: Object.values(STOCK_ADJUSTMENT_TYPE),
      default: STOCK_ADJUSTMENT_TYPE.MANUAL_CORRECTION,
      index: true,
    },

    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    delta: { type: Number, required: true },
    previousCurrentQuantity: { type: Number, default: null },
    newCurrentQuantity: { type: Number, default: null },
    deltaCurrent: { type: Number, default: null },
    previousReservedQuantity: { type: Number, default: null },
    newReservedQuantity: { type: Number, default: null },
    deltaReserved: { type: Number, default: null },
    previousLowStockThreshold: { type: Number, default: null },
    newLowStockThreshold: { type: Number, default: null },

    reason: { type: String, required: true, trim: true },
    note: { type: String, default: "", trim: true },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    orderNumber: { type: String, default: "", trim: true },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
      index: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    changedByRole: { type: String, required: true, trim: true },
    changedAt: { type: Date, default: Date.now, index: true },

    metadata: { type: Object, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

StockAdjustmentLogSchema.index({ productId: 1, changedAt: -1 });
StockAdjustmentLogSchema.index({ sku: 1, changedAt: -1 });
StockAdjustmentLogSchema.index({ type: 1, changedAt: -1 });

export default mongoose.model("StockAdjustmentLog", StockAdjustmentLogSchema);
