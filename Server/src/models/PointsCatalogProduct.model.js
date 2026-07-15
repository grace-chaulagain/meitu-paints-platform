import mongoose from "mongoose";

// The "Painter Points Scheme" catalog that drives QR coupon generation - one
// row per sellable product, each either priced per pack size (pricingMode
// "SIZES", e.g. "High Glossy Exterior Paint": 20L=800pts) or a flat points
// value with a descriptive rule (pricingMode "FLAT", e.g. "Granite 2D": 400
// points, "200 points for Granite Primer and 200 for Granite Intermediate
// Coating Paint"). couponType is stored explicitly per product rather than
// derived from category, because the business rule doesn't cleanly map to
// category: Granite Textures' Granite 2D/3D and Real Stone Paint are GOLDEN,
// but Floor Paint's Epoxy Floor Paint - despite the same FLAT pricing shape -
// is GREEN.
const SizePointsSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PointsCatalogProductSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },

    couponType: { type: String, enum: ["GOLDEN", "GREEN"], required: true },
    pricingMode: { type: String, enum: ["SIZES", "FLAT"], required: true },

    // Used when pricingMode === "SIZES" - one entry per pack size offered.
    sizes: { type: [SizePointsSchema], default: [] },

    // Used when pricingMode === "FLAT" - a single points value plus the
    // human-readable rule describing how it's earned.
    flatPoints: { type: Number, default: null, min: 0 },
    rule: { type: String, trim: true, default: "" },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

PointsCatalogProductSchema.index({ category: 1, name: 1 });

export default mongoose.model("PointsCatalogProduct", PointsCatalogProductSchema);
