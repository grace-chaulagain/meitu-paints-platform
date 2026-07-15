import PointsCatalogProduct from "../models/PointsCatalogProduct.model.js";
import ApiError from "../utils/apiError.js";

function sortSpec() {
  return { category: 1, name: 1 };
}

export async function listCatalogProducts({ q = "", category = "ALL", page = 1, limit = 200 } = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(500, Math.max(1, Number(limit || 200)));

  const filter = {};
  if (q) {
    filter.name = { $regex: String(q).trim(), $options: "i" };
  }
  if (category && category !== "ALL") {
    filter.category = category;
  }

  const [items, total] = await Promise.all([
    PointsCatalogProduct.find(filter)
      .sort(sortSpec())
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    PointsCatalogProduct.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

export async function getCatalogProductById(productId) {
  const item = await PointsCatalogProduct.findById(productId).lean();
  if (!item) throw new ApiError(404, "Catalog product not found");
  return { item };
}

export async function createCatalogProduct({
  category,
  name,
  couponType,
  pricingMode,
  sizes = [],
  flatPoints = null,
  rule = "",
} = {}) {
  const item = await PointsCatalogProduct.create({
    category,
    name,
    couponType,
    pricingMode,
    sizes: pricingMode === "SIZES" ? sizes : [],
    flatPoints: pricingMode === "FLAT" ? flatPoints : null,
    rule: pricingMode === "FLAT" ? rule : "",
  });
  return { item: item.toObject() };
}

export async function updateCatalogProduct(productId, payload = {}) {
  const updates = {};
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.couponType !== undefined) updates.couponType = payload.couponType;
  if (payload.isActive !== undefined) updates.isActive = payload.isActive;

  if (payload.pricingMode !== undefined) {
    updates.pricingMode = payload.pricingMode;
    if (payload.pricingMode === "SIZES") {
      updates.sizes = payload.sizes || [];
      updates.flatPoints = null;
      updates.rule = "";
    } else {
      updates.sizes = [];
      updates.flatPoints = payload.flatPoints ?? null;
      updates.rule = payload.rule || "";
    }
  } else {
    if (payload.sizes !== undefined) updates.sizes = payload.sizes;
    if (payload.flatPoints !== undefined) updates.flatPoints = payload.flatPoints;
    if (payload.rule !== undefined) updates.rule = payload.rule;
  }

  const item = await PointsCatalogProduct.findByIdAndUpdate(productId, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!item) throw new ApiError(404, "Catalog product not found");
  return { item };
}

export async function deleteCatalogProduct(productId) {
  const item = await PointsCatalogProduct.findByIdAndDelete(productId).lean();
  if (!item) throw new ApiError(404, "Catalog product not found");
  return { item };
}
