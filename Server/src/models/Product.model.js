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

// One item inside a set/bundle product (e.g. one of the 7 pieces in the
// Granite Epoxy Floor Paint kit) - no price of its own. `productId` is
// optional: when every component in the array has one set, the parent
// product is treated as a fully-linked kit whose real stock is derived
// from these components' own stock (see stock.service.js's
// resolveOrderStockLines/getStock) instead of being tracked independently.
// A components array with no productId links (or only some) behaves as
// pure display metadata, same as before this field existed.
const ProductComponentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, default: "", trim: true },
    packLabel: { type: String, default: "", trim: true },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "Component quantity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Component quantity must be a whole number",
      },
    },
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

    // Smallest quantity a dealer/dispatcher can order this SKU in (e.g. the
    // wall putty PB variants, which are bulk/project-based pricing and only
    // make sense at 500+ bags). 1 is a no-op default matching today's
    // behavior for every existing product.
    minQuantity: { type: Number, default: 1, min: 1 },

    // Set/bundle contents for display only (e.g. the Granite Epoxy Floor
    // Paint kit) - no per-component price, just what's inside. Empty for
    // every ordinary single-item product.
    components: { type: [ProductComponentSchema], default: [] },

    currency: { type: String, default: "NPR" },

    // Keep this for quick UI defaults. For tiered SKUs, you can set it to Tier-1 price.
    basePrice: { type: Number, default: 0 },

    // Independent per-SKU pricing for Dispatchers replenishing their own
    // regional stock from the Factory. Same shape as `pricing` so the
    // existing tier-computation logic (Frontend/meitupaints/src/dealer/pricing.js)
    // works unchanged against either field.
    dispatcherPricing: { type: PricingSchema, default: () => ({}) },
    dispatcherBasePrice: { type: Number, default: 0 },

    stock: {
      type: ProductStockSchema,
      default: () => ({}),
    },

    isActive: { type: Boolean, default: true },

    // Narrower than isActive: can a dealer/dispatcher order this directly?
    // Defaults true (no-op for every existing product). Set false for a
    // kit's own component products so factory/admin can still see and
    // stock-manage them while they stay invisible to customer catalogs.
    sellable: { type: Boolean, default: true },

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
