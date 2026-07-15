import mongoose from "mongoose";

// A dispatcher's own price list, distinct per dispatcher (unlike dealer
// pricing, which is one shared tiered price list per product). Each
// dispatcher can have a completely different flat price - and a different
// net/cost price for proforma invoicing - for the same SKU.
const DispatcherProductPriceSchema = new mongoose.Schema(
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
    price: { type: Number, required: true, min: 0 },
    netPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NPR" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

DispatcherProductPriceSchema.index(
  { dispatcherId: 1, productId: 1 },
  { unique: true },
);

export default mongoose.model(
  "DispatcherProductPrice",
  DispatcherProductPriceSchema,
);
