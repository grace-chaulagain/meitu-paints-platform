import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Product from "../models/Product.model.js";
import { MONGO_URI as CONFIG_MONGO_URI } from "../config/env.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "Append-meitu-products.json");

const normalizeBasis = (pricingModelKey = "") => {
  if (pricingModelKey.includes("VOL") || pricingModelKey.includes("VOLUME")) {
    return "VOLUME_TOTAL";
  }
  if (pricingModelKey.includes("PACK") || pricingModelKey.includes("BKT")) {
    return "PACK_COUNT";
  }
  if (pricingModelKey.includes("UNIT")) {
    return "UNIT_COUNT";
  }
  return "PER_PACK";
};

const normalizeModel = (variant) => {
  if (variant?.pricingModelKey === "FLAT") return "FLAT";
  if (Array.isArray(variant?.prices) && variant.prices.length > 1)
    return "TIERED";
  return "FLAT";
};

const getBasePrice = (prices = []) => {
  if (!prices.length) return 0;
  const first = prices[0];
  return first.pricePerPack ?? first.priceInclTax ?? first.priceExclTax ?? 0;
};

const validateSeedDoc = (doc) => {
  if (!doc.sku) throw new Error(`Missing sku for product code ${doc.code}`);
  if (!doc.name) throw new Error(`Missing name for sku ${doc.sku}`);
  if (!doc.category) throw new Error(`Missing category for sku ${doc.sku}`);
  if (!doc.pack?.size || !doc.pack?.unit) {
    throw new Error(`Missing pack info for sku ${doc.sku}`);
  }
  if (!doc.pricing?.tiers || !doc.pricing.tiers.length) {
    throw new Error(`Missing pricing tiers for sku ${doc.sku}`);
  }

  for (const tier of doc.pricing.tiers) {
    if (tier.min === null || tier.min === undefined) {
      throw new Error(`Tier min is missing for sku ${doc.sku}`);
    }

    const hasAnyPrice =
      tier.pricePerPack !== null && tier.pricePerPack !== undefined
        ? true
        : tier.priceExclTax !== null && tier.priceExclTax !== undefined
          ? true
          : tier.priceInclTax !== null && tier.priceInclTax !== undefined;

    if (!hasAnyPrice) {
      throw new Error(`Tier has no price for sku ${doc.sku}`);
    }
  }
};

const flattenProducts = (parsed) => {
  const products = parsed.products || [];
  const flattened = [];
  const seenSkus = new Set();

  for (const product of products) {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(
        `Product ${product.code || product.name} has no variants`,
      );
    }

    for (const variant of product.variants) {
      if (seenSkus.has(variant.sku)) {
        throw new Error(`Duplicate sku found in append file: ${variant.sku}`);
      }
      seenSkus.add(variant.sku);

      const prices = (variant.prices || []).map((price) => ({
        ...price,
        min: price.min ?? 1,
        max: price.max ?? null,
      }));

      const doc = {
        sku: variant.sku,
        code: product.code || "",
        name: product.name || "",
        category: product.category || "",
        description: product.description || "",
        uom: {
          base: product.uom?.base || variant.pack?.unit || "PCS",
          allowed: product.uom?.allowed?.length
            ? product.uom.allowed
            : [product.uom?.base || variant.pack?.unit || "PCS"],
        },
        pack: {
          label: variant.pack?.label || "",
          size: variant.pack?.size || 0,
          unit: variant.pack?.unit || "",
        },
        pricing: {
          model: normalizeModel(variant),
          pricingModelKey: variant.pricingModelKey || "FLAT",
          basis: normalizeBasis(variant.pricingModelKey),
          tierUnit: variant.pack?.unit || "",
          tiers: prices,
        },
        currency: parsed.meta?.currency || "NPR",
        basePrice: getBasePrice(prices),
        isActive: true,
        meta: {
          source: parsed.meta?.source || "",
          notes: "",
        },
      };

      validateSeedDoc(doc);
      flattened.push(doc);
    }
  }

  return flattened;
};

const assertProductsDoNotExist = async (productDocs) => {
  const skus = productDocs.map((product) => product.sku);
  const existingProducts = await Product.find(
    { sku: { $in: skus } },
    { sku: 1, _id: 0 },
  ).lean();

  if (existingProducts.length > 0) {
    const existingSkus = existingProducts.map((product) => product.sku).join(", ");
    throw new Error(
      `Cannot append products because these skus already exist: ${existingSkus}`,
    );
  }
};

const appendProducts = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || CONFIG_MONGO_URI;

    if (!mongoUri || typeof mongoUri !== "string") {
      throw new Error(
        "MONGO_URI is missing. Add it to Server/.env as MONGO_URI=... or ensure ../config/env.js exports it.",
      );
    }

    assertSafeDatabaseWrite({
      mongoUri,
      operation: "append products",
      destructive: false,
    });
    console.log(`[db-write] ${describeDatabaseTarget(mongoUri)}`);

    await mongoose.connect(mongoUri);
    console.log("MongoDB Connected");

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(rawData);

    const flattenedProducts = flattenProducts(parsed);

    console.log(`Found ${flattenedProducts.length} SKU documents to append`);

    await assertProductsDoNotExist(flattenedProducts);

    if (flattenedProducts.length === 0) {
      console.log("No products to append");
      process.exit(0);
    }

    await Product.insertMany(flattenedProducts);
    console.log("Products appended successfully");

    process.exit(0);
  } catch (error) {
    console.error("Product append failed");
    console.error(error.message);
    process.exit(1);
  }
};

appendProducts();
