import mongoose from "mongoose";

// ----------------------------
// Pricing
// ----------------------------

// A single tier row.
// - For tiered pricing: set min/max and pricePerPack
// - For flat pricing: use a single row { min: 1, max: null, pricePerPack: <price> }
const PriceTierSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, default: null }, // null => no upper bound

    // Price fields
    // - Most rate lists use pricePerPack
    // - Tools/accessories may use priceExclTax/priceInclTax instead
    pricePerPack: { type: Number, default: null },

    // Optional (tools/accessories) when you have two columns.
    priceExclTax: { type: Number, default: null },
    priceInclTax: { type: Number, default: null },

    label: { type: String, default: "" },
  },
  { _id: false },
);

PriceTierSchema.pre("validate", function () {
  const hasAnyPrice =
    this.pricePerPack !== null && this.pricePerPack !== undefined
      ? true
      : this.priceExclTax !== null && this.priceExclTax !== undefined
        ? true
        : this.priceInclTax !== null && this.priceInclTax !== undefined;

  if (!hasAnyPrice) {
    this.invalidate(
      "pricePerPack",
      "At least one of pricePerPack, priceExclTax, or priceInclTax must be provided.",
    );
  }
});

const PricingSchema = new mongoose.Schema(
  {
    // FLAT: one tier row only
    // TIERED: multiple tier rows
    model: {
      type: String,
      enum: ["FLAT", "TIERED"],
      default: "FLAT",
    },

    pricingModelKey: {
      type: String,
      default: "FLAT",
      trim: true,
    },

    // How tiers are computed for this SKU
    // - VOLUME_TOTAL: total L/KG ordered for this SKU determines tier
    // - PACK_COUNT: number of packs/buckets ordered determines tier
    // - UNIT_COUNT: count of units (e.g., bottles) determines tier
    basis: {
      type: String,
      enum: ["VOLUME_TOTAL", "PACK_COUNT", "UNIT_COUNT", "PER_PACK", "FLAT"],
      default: "PER_PACK",
    },

    // Unit for tiering basis (e.g. L, KG, BKT, UNIT)
    tierUnit: { type: String, default: "" },

    // Tier rows for this SKU
    tiers: { type: [PriceTierSchema], default: [] },
  },
  { _id: false },
);

const ProductStockSchema = new mongoose.Schema(
  {
    currentQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    lastUpdatedAt: { type: Date, default: null },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

// ----------------------------
// Product
// ----------------------------

const ProductSchema = new mongoose.Schema(
  {
    // SKU must remain unique because OrderItem snapshots skuSnapshot.
    sku: { type: String, required: true, unique: true, trim: true },

    // Optional “family” code to group multiple SKUs (20L/10L/4L/1L) together.
    code: { type: String, default: "", trim: true, index: true },

    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    images: [
      {
        url: { type: String, required: true }, // Cloudinary URL
        publicId: { type: String, required: true }, // for deletion/update
        alt: { type: String, default: "" }, // accessibility
        isPrimary: { type: Boolean, default: false }, // main image
      },
    ],
    description: { type: String, default: "" },

    // Unit of measure for ordering UI (base should match how you order this SKU).
    uom: {
      base: { type: String, default: "PCS" },
      allowed: { type: [String], default: ["PCS"] },
    },

    // Pack details for this SKU
    pack: {
      label: { type: String, default: "" }, // e.g. "20L Bucket"
      size: { type: Number, default: 0 },
      unit: { type: String, default: "" }, // L/KG/ML/GM/PC/etc.
    },

    // Pricing rules + tiers for this SKU
    pricing: { type: PricingSchema, default: () => ({}) },

    currency: { type: String, default: "NPR" },

    // Keep this for quick UI defaults. For tiered SKUs, you can set it to Tier-1 price.
    basePrice: { type: Number, default: 0 },

    stock: {
      type: ProductStockSchema,
      default: () => ({}),
    },

    isActive: { type: Boolean, default: true },

    meta: {
      source: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// Helpful indexes
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ name: "text", sku: "text", code: "text" });
ProductSchema.index({ code: 1, "pack.size": 1, "pack.unit": 1 });
ProductSchema.index({ "stock.currentQuantity": 1 });
ProductSchema.index({ "stock.lowStockThreshold": 1 });

export default mongoose.model("Product", ProductSchema);
