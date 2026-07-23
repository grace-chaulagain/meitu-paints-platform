import streamifier from "streamifier";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import cloudinary from "../utils/cloudinary.js";

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function validateRequired(value, fieldName) {
  if (!normalizeText(value)) {
    throw new Error(`${fieldName} is required`);
  }
}

function validateTierRows(tiers = []) {
  if (!Array.isArray(tiers)) {
    throw new Error("pricing.tiers must be an array");
  }

  for (const tier of tiers) {
    const hasPrice =
      tier?.pricePerPack !== undefined ||
      tier?.priceExclTax !== undefined ||
      tier?.priceInclTax !== undefined;

    if (!hasPrice) {
      throw new Error("Each pricing tier must contain a price");
    }

    if (
      tier?.min !== null &&
      tier?.min !== undefined &&
      Number.isNaN(Number(tier.min))
    ) {
      throw new Error("Tier min must be numeric");
    }

    if (
      tier?.max !== null &&
      tier?.max !== undefined &&
      Number.isNaN(Number(tier.max))
    ) {
      throw new Error("Tier max must be numeric");
    }
  }
}

// A components array with every entry's productId set turns a product
// into a fully-linked kit whose stock is derived from those components
// instead of tracked on its own (see stock.service.js's
// resolveOrderStockLines/getStock). productId is optional per entry -
// omitting it keeps that row as pure display metadata, same as before
// this link existed.
async function validateComponentsPayload(components, ownProductId) {
  if (!Array.isArray(components)) {
    throw new Error("components must be an array");
  }

  const seenProductIds = new Set();
  const normalized = [];

  for (const entry of components) {
    const quantity = Number(entry?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Each component's quantity must be a positive whole number");
    }

    let linkedProductId = null;
    if (entry?.productId) {
      const idStr = String(entry.productId);
      if (!mongoose.Types.ObjectId.isValid(idStr)) {
        throw new Error("Invalid component productId");
      }
      if (idStr === String(ownProductId)) {
        throw new Error("A product cannot list itself as its own component");
      }
      if (seenProductIds.has(idStr)) {
        throw new Error("A component product cannot be listed more than once");
      }
      seenProductIds.add(idStr);
      linkedProductId = idStr;
    }

    normalized.push({
      productId: linkedProductId,
      name: normalizeText(entry?.name),
      packLabel: normalizeText(entry?.packLabel),
      quantity,
    });
  }

  if (seenProductIds.size) {
    const found = await Product.find({ _id: { $in: Array.from(seenProductIds) } }).select("_id");
    if (found.length !== seenProductIds.size) {
      throw new Error("One or more linked component products could not be found");
    }
  }

  return normalized;
}

function inferPricingModel(tiers = []) {
  return Array.isArray(tiers) && tiers.length > 1 ? "TIERED" : "FLAT";
}

function inferPricingModelKey(pricing = {}) {
  if (pricing.pricingModelKey) return normalizeText(pricing.pricingModelKey);
  if (pricing.basis === "PACK_COUNT") return "BKT_1_5_6_10_11_PLUS";
  if (pricing.basis === "UNIT_COUNT") return "UNIT_1_20_21_PLUS";
  if (pricing.basis === "VOLUME_TOTAL") return "VOL_L_1_80_81_250_251_PLUS";
  return "FLAT";
}

function normalizePricingPayload(pricing = {}) {
  const tiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
  const pricingModelKey = inferPricingModelKey(pricing);
  const basis =
    pricing.basis ||
    (pricingModelKey.includes("BKT") || pricingModelKey.includes("PACK")
      ? "PACK_COUNT"
      : pricingModelKey.includes("UNIT")
        ? "UNIT_COUNT"
        : pricingModelKey.includes("VOL")
          ? "VOLUME_TOTAL"
          : "PER_PACK");
  const isFlat = pricingModelKey === "FLAT" || basis === "FLAT";

  return {
    ...pricing,
    pricingModelKey,
    model: isFlat ? "FLAT" : inferPricingModel(tiers),
    basis,
    tierUnit: normalizeText(pricing.tierUnit),
    tiers,
  };
}

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "meitu-product-families",
        resource_type: "image",
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* -----------------------------
   Categories
----------------------------- */

// Categories aren't a real collection - listProductCategories() (product
// service) derives the whole list via Product/ProductFamily.distinct on
// their free-text `category` field (see Product.model.js - it's a plain
// String, not an enum). Every stored value already follows an UPPER_SNAKE
// convention (e.g. "GRANITE_EPOXY_FLOOR"), with categoryLabel() deriving the
// human-readable label from it on read (replace "_" with a space, title-
// case). Renaming keeps that same single-source-of-truth shape rather than
// introducing a separate "display name" field: the admin types a plain
// name, this normalizes it into the same stored convention, and every page
// that already renders categoryLabel(product.category) picks up the new
// name automatically - no other page needs its own update.
function normalizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Deliberately does NOT touch historical Order.items[].category snapshots -
// those describe what a category was called *at the time* that order was
// placed, same reasoning as every other order snapshot field in this app.
// piUnitLabels.js's category->unit-label map on the frontend needs both the
// old and new key for this reason (old orders still carry the old value).
export async function renameProductCategoryService({ fromValue, toLabel }) {
  const normalizedFrom = normalizeCategoryValue(fromValue);
  const normalizedTo = normalizeCategoryValue(toLabel);

  if (!normalizedFrom) throw new Error("fromValue is required");
  if (!normalizedTo) throw new Error("A new category name is required");

  if (normalizedFrom === normalizedTo) {
    return { renamed: false, productsUpdated: 0, familiesUpdated: 0, category: normalizedTo };
  }

  const [productResult, familyResult] = await Promise.all([
    Product.updateMany({ category: normalizedFrom }, { $set: { category: normalizedTo } }),
    ProductFamily.updateMany({ category: normalizedFrom }, { $set: { category: normalizedTo } }),
  ]);

  return {
    renamed: true,
    productsUpdated: productResult.modifiedCount,
    familiesUpdated: familyResult.modifiedCount,
    category: normalizedTo,
  };
}

/* -----------------------------
   Product Family
----------------------------- */
export async function listAllFamiliesService() {
  return ProductFamily.find({}).sort({ createdAt: -1 });
}

export async function createFamilyService(payload = {}) {
  const code = normalizeText(payload.code).toUpperCase();
  const name = normalizeText(payload.name);
  const category = normalizeText(payload.category);
  const description = normalizeText(payload.description);
  const copyrightText = normalizeText(payload.copyrightText);

  validateRequired(code, "code");
  validateRequired(name, "name");

  const existing = await ProductFamily.findOne({ code });
  if (existing) {
    throw new Error("Product family code already exists");
  }

  const family = await ProductFamily.create({
    code,
    name,
    category,
    description,
    copyrightText,
    images: [],
    isActive: normalizeBoolean(payload.isActive, true),
    meta: payload.meta || {},
  });

  return family;
}

export async function updateFamilyService(familyId, payload = {}) {
  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");

  if (payload.code !== undefined) {
    const nextCode = normalizeText(payload.code).toUpperCase();
    validateRequired(nextCode, "code");

    const existing = await ProductFamily.findOne({
      code: nextCode,
      _id: { $ne: familyId },
    });

    if (existing) {
      throw new Error("Product family code already exists");
    }

    family.code = nextCode;
  }

  if (payload.name !== undefined) {
    const nextName = normalizeText(payload.name);
    validateRequired(nextName, "name");
    family.name = nextName;
  }

  if (payload.category !== undefined) {
    family.category = normalizeText(payload.category);
  }

  if (payload.description !== undefined) {
    family.description = normalizeText(payload.description);
  }

  if (payload.copyrightText !== undefined) {
    family.copyrightText = normalizeText(payload.copyrightText);
  }

  if (typeof payload.isActive === "boolean") {
    family.isActive = payload.isActive;
  }

  if (payload.meta !== undefined && typeof payload.meta === "object") {
    family.meta = payload.meta;
  }

  await family.save();
  return family;
}

export async function deleteFamilyService(familyId) {
  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");

  family.isActive = false;
  await family.save();

  return family;
}

export async function restoreFamilyService(familyId) {
  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");

  family.isActive = true;
  await family.save();

  return family;
}

export async function uploadFamilyImageService(familyId, file) {
  if (!file?.buffer) {
    throw new Error("Image file is required");
  }

  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");
  const existingImages = Array.isArray(family.images) ? family.images : [];
  const previousPrimary =
    existingImages.find((img) => img?.isPrimary) || existingImages[0] || null;

  const result = await uploadBufferToCloudinary(file.buffer, {
    public_id: `${family.code}-${Date.now()}`,
    overwrite: false,
  });

  const nextImage = {
    url: result.secure_url,
    publicId: result.public_id,
    alt: family.name,
    isPrimary: true,
  };

  const retainedImages = existingImages
    .filter((img) => img?.publicId !== previousPrimary?.publicId)
    .map((img) => ({
      ...(img.toObject?.() ?? img),
      isPrimary: false,
    }));

  family.images = [nextImage, ...retainedImages];

  await family.save();

  if (previousPrimary?.publicId) {
    try {
      await cloudinary.uploader.destroy(previousPrimary.publicId);
    } catch (error) {
      console.warn(
        "[admin-catalog] Failed to delete replaced family image from Cloudinary:",
        error?.message || error,
      );
    }
  }

  return family;
}

export async function setPrimaryFamilyImageService(familyId, publicId) {
  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");

  let found = false;

  family.images = (family.images || []).map((img) => {
    const match = img.publicId === publicId;
    if (match) found = true;
    return {
      ...(img.toObject?.() ?? img),
      isPrimary: match,
    };
  });

  if (!found) {
    throw new Error("Image not found");
  }

  await family.save();
  return family;
}

export async function deleteFamilyImageService(familyId, publicId) {
  const family = await ProductFamily.findById(familyId);
  if (!family) throw new Error("Product family not found");

  const existing = (family.images || []).find(
    (img) => img.publicId === publicId,
  );
  if (!existing) throw new Error("Image not found");

  await cloudinary.uploader.destroy(publicId);

  family.images = (family.images || []).filter(
    (img) => img.publicId !== publicId,
  );

  if (family.images.length > 0 && !family.images.some((img) => img.isPrimary)) {
    family.images[0].isPrimary = true;
  }

  await family.save();
  return family;
}

/* -----------------------------
   Product
----------------------------- */
export async function listAllProductsService() {
  return Product.find({}).sort({ createdAt: -1 });
}

export async function createProductService(payload = {}) {
  const code = normalizeText(payload.code).toUpperCase();
  const sku = normalizeText(payload.sku).toUpperCase();
  const name = normalizeText(payload.name);
  const category = normalizeText(payload.category);
  const description = normalizeText(payload.description);

  validateRequired(code, "code");
  validateRequired(sku, "sku");
  validateRequired(name, "name");
  validateRequired(category, "category");

  const existingSku = await Product.findOne({ sku });
  if (existingSku) {
    throw new Error("Product SKU already exists");
  }

  validateTierRows(payload?.pricing?.tiers || []);
  validateTierRows(payload?.dispatcherPricing?.tiers || []);

  const product = await Product.create({
    datasetKey: normalizeText(payload.datasetKey),
    code,
    sku,
    name,
    category,
    description,
    attributes: payload.attributes || {},
    uom: payload.uom || { base: "", allowed: [] },
    pack: payload.pack || null,
    currency: normalizeText(payload.currency, "NPR") || "NPR",
    pricing: normalizePricingPayload(
      payload.pricing || {
        pricingModelKey: "FLAT",
        basis: "FLAT",
        tierUnit: "",
        tiers: [],
      },
    ),
    // Independent, optional per-SKU price list for dispatcher replenishment
    // orders - defaults to an empty tier set (same as updateProductService)
    // when not supplied, which reads as "not configured" rather than FLAT.
    dispatcherPricing: normalizePricingPayload(
      payload.dispatcherPricing || {
        pricingModelKey: "FLAT",
        basis: "FLAT",
        tierUnit: "",
        tiers: [],
      },
    ),
    dispatcherBasePrice: Number(payload.dispatcherBasePrice) || 0,
    images: payload.images || [],
    isActive: normalizeBoolean(payload.isActive, true),
    source: payload.source || null,
  });

  return product;
}

export async function updateProductService(productId, payload = {}) {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  if (payload.code !== undefined) {
    const nextCode = normalizeText(payload.code).toUpperCase();
    validateRequired(nextCode, "code");
    product.code = nextCode;
  }

  if (payload.sku !== undefined) {
    const nextSku = normalizeText(payload.sku).toUpperCase();
    validateRequired(nextSku, "sku");

    const existingSku = await Product.findOne({
      sku: nextSku,
      _id: { $ne: productId },
    });

    if (existingSku) {
      throw new Error("Product SKU already exists");
    }

    product.sku = nextSku;
  }

  if (payload.name !== undefined) {
    const nextName = normalizeText(payload.name);
    validateRequired(nextName, "name");
    product.name = nextName;
  }

  if (payload.category !== undefined) {
    const nextCategory = normalizeText(payload.category);
    validateRequired(nextCategory, "category");
    product.category = nextCategory;
  }

  if (payload.description !== undefined) {
    product.description = normalizeText(payload.description);
  }

  if (payload.attributes !== undefined) {
    product.attributes = payload.attributes || {};
  }

  if (payload.uom !== undefined) {
    product.uom = payload.uom;
  }

  if (payload.pack !== undefined) {
    product.pack = payload.pack;
  }

  if (payload.currency !== undefined) {
    product.currency = normalizeText(payload.currency, "NPR") || "NPR";
  }

  if (payload.pricing !== undefined) {
    validateTierRows(payload?.pricing?.tiers || []);
    product.pricing = normalizePricingPayload(payload.pricing);
  }

  if (payload.dispatcherPricing !== undefined) {
    validateTierRows(payload?.dispatcherPricing?.tiers || []);
    product.dispatcherPricing = normalizePricingPayload(
      payload.dispatcherPricing,
    );
  }

  if (payload.dispatcherBasePrice !== undefined) {
    product.dispatcherBasePrice = Number(payload.dispatcherBasePrice) || 0;
  }

  if (payload.images !== undefined) {
    product.images = payload.images || [];
  }

  if (typeof payload.isActive === "boolean") {
    product.isActive = payload.isActive;
  }

  if (payload.source !== undefined) {
    product.source = payload.source || null;
  }

  if (payload.components !== undefined) {
    product.components = await validateComponentsPayload(payload.components, productId);
  }

  if (typeof payload.sellable === "boolean") {
    product.sellable = payload.sellable;
  }

  await product.save();
  return product;
}

export async function deleteProductService(productId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  product.isActive = false;
  await product.save();

  return product;
}

export async function restoreProductService(productId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  product.isActive = true;
  await product.save();

  return product;
}

export async function uploadProductImageService(productId, file) {
  if (!file?.buffer) {
    throw new Error("Image file is required");
  }

  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");
  const existingImages = Array.isArray(product.images) ? product.images : [];
  const previousPrimary =
    existingImages.find((img) => img?.isPrimary) || existingImages[0] || null;

  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: "meitu-products",
    public_id: `${product.sku}-${Date.now()}`,
    overwrite: false,
  });

  const nextImage = {
    url: result.secure_url,
    publicId: result.public_id,
    alt: product.name,
    isPrimary: true,
  };

  const retainedImages = existingImages
    .filter((img) => img?.publicId !== previousPrimary?.publicId)
    .map((img) => ({
      ...(img.toObject?.() ?? img),
      isPrimary: false,
    }));

  product.images = [nextImage, ...retainedImages];

  await product.save();

  if (previousPrimary?.publicId) {
    try {
      await cloudinary.uploader.destroy(previousPrimary.publicId);
    } catch (error) {
      console.warn(
        "[admin-catalog] Failed to delete replaced product image from Cloudinary:",
        error?.message || error,
      );
    }
  }

  return product;
}

export async function setPrimaryProductImageService(productId, publicId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  let found = false;

  product.images = (product.images || []).map((img) => {
    const match = img.publicId === publicId;
    if (match) found = true;
    return {
      ...(img.toObject?.() ?? img),
      isPrimary: match,
    };
  });

  if (!found) {
    throw new Error("Image not found");
  }

  await product.save();
  return product;
}

export async function deleteProductImageService(productId, publicId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  const existing = (product.images || []).find(
    (img) => img.publicId === publicId,
  );
  if (!existing) throw new Error("Image not found");

  await cloudinary.uploader.destroy(publicId);

  product.images = (product.images || []).filter(
    (img) => img.publicId !== publicId,
  );

  if (product.images.length > 0 && !product.images.some((img) => img.isPrimary)) {
    product.images[0].isPrimary = true;
  }

  await product.save();
  return product;
}
