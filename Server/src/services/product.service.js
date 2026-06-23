import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";

function normalizeCategory(value) {
  return typeof value === "string" ? value.trim() : "";
}

function categoryLabel(value) {
  const category = normalizeCategory(value);
  if (!category) return "Uncategorized";

  return category
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function inferPricingModelKey(pricing = {}) {
  if (pricing.pricingModelKey) return pricing.pricingModelKey;
  if (pricing.basis === "PACK_COUNT") return "BKT_1_5_6_10_11_PLUS";
  if (pricing.basis === "UNIT_COUNT") return "UNIT_1_20_21_PLUS";
  if (pricing.basis === "VOLUME_TOTAL") return "VOL_L_1_80_81_250_251_PLUS";
  return "FLAT";
}

function normalizePricingForRuntime(pricing = {}) {
  const tiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
  return {
    ...pricing,
    pricingModelKey: inferPricingModelKey(pricing),
    model: tiers.length > 1 ? "TIERED" : pricing.model || "FLAT",
    tiers,
  };
}

function buildFamilyMap(families = []) {
  return new Map(
    families.map((family) => [
      family.code,
      {
        ...family,
        primaryImage: getPrimaryImage(family.images || []),
      },
    ]),
  );
}

export async function listActiveProducts({ q, category }) {
  const filter = { isActive: true };

  if (category && category !== "ALL") {
    filter.category = category;
  }

  if (q && q.trim()) {
    const query = q.trim();
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { sku: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
      { "pack.label": { $regex: query, $options: "i" } },
    ];
  }

  const items = await Product.find(filter)
    .sort({ category: 1, code: 1, "pack.size": -1 })
    .lean();

  const codes = [...new Set(items.map((item) => item.code).filter(Boolean))];

  const families = await ProductFamily.find({
    isActive: true,
    code: { $in: codes },
  }).lean();

  const familyMap = buildFamilyMap(families);

  return items.map((item) => {
    const productPrimaryImage = getPrimaryImage(item.images || []);
    const family = familyMap.get(item.code) || null;
    const familyPrimaryImage = family?.primaryImage || null;
    const resolvedImage = familyPrimaryImage || productPrimaryImage || null;

    return {
      ...item,
      pricing: normalizePricingForRuntime(item.pricing || {}),
      family,
      displayImage: resolvedImage
        ? {
            ...resolvedImage,
            source: familyPrimaryImage ? "family" : "product",
          }
        : null,
    };
  });
}

export async function listProductCategories({ includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };

  const [productCategories, familyCategories] = await Promise.all([
    Product.distinct("category", filter),
    ProductFamily.distinct("category", filter),
  ]);

  const categoryMap = new Map();

  for (const rawCategory of [...productCategories, ...familyCategories]) {
    const value = normalizeCategory(rawCategory);
    if (!value) continue;

    const key = value.toUpperCase();
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        value,
        label: categoryLabel(value),
      });
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}
