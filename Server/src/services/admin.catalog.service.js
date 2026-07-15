import streamifier from "streamifier";
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
