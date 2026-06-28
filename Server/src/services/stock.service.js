import mongoose from "mongoose";

import Product from "../models/Product.model.js";
import StockAdjustmentLog, {
  STOCK_ADJUSTMENT_TYPE,
} from "../models/StockAdjustmentLog.model.js";
import ApiError from "../utils/apiError.js";

const STOCK_STATUS = Object.freeze({
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
});

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeStatus(value = "") {
  return clean(value).toUpperCase();
}

function ensureObjectId(value, label = "id") {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

function getStock(product) {
  const stock = product?.stock || {};
  const currentQuantity = Number(stock.currentQuantity || 0);
  const reservedQuantity = Number(stock.reservedQuantity || 0);
  const lowStockThreshold = Number(stock.lowStockThreshold || 0);
  const availableQuantity = Math.max(0, currentQuantity - reservedQuantity);

  let status = STOCK_STATUS.IN_STOCK;
  if (availableQuantity <= 0) {
    status = STOCK_STATUS.OUT_OF_STOCK;
  } else if (lowStockThreshold > 0 && availableQuantity <= lowStockThreshold) {
    status = STOCK_STATUS.LOW_STOCK;
  }

  return {
    currentQuantity,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold,
    unit: clean(stock.unit || product?.pack?.unit || product?.uom?.base || "PCS"),
    notes: clean(stock.notes),
    lastUpdatedAt: stock.lastUpdatedAt || null,
    lastUpdatedBy: stock.lastUpdatedBy || null,
    status,
  };
}

function stockItem(product) {
  return {
    _id: product._id,
    productId: product._id,
    sku: product.sku || "",
    code: product.code || "",
    name: product.name || "",
    category: product.category || "",
    pack: product.pack || {},
    packLabel: product.pack?.label || "",
    isActive: product.isActive,
    stock: getStock(product),
  };
}

function buildProductQuery({ q = "", category = "" } = {}) {
  const query = {};
  const search = clean(q);
  const normalizedCategory = clean(category);

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: rx }, { sku: rx }, { code: rx }, { category: rx }];
  }

  if (normalizedCategory) {
    query.category = normalizedCategory;
  }

  return query;
}

function filterStockStatus(items, status = "") {
  const normalized = normalizeStatus(status);
  if (!normalized || normalized === "ALL") return items;
  return items.filter((item) => item.stock?.status === normalized);
}

async function createStockLog({
  product,
  previousQuantity,
  newQuantity,
  previousLowStockThreshold = null,
  newLowStockThreshold = null,
  reason,
  note = "",
  actorUser,
  type = STOCK_ADJUSTMENT_TYPE.MANUAL_CORRECTION,
  order = null,
  metadata = {},
}) {
  const changedBy = actorId(actorUser);
  if (!changedBy) throw new ApiError(401, "Authentication required");

  return StockAdjustmentLog.create({
    productId: product._id,
    sku: product.sku || "",
    code: product.code || "",
    productName: product.name || "",
    category: product.category || "",
    packLabel: product.pack?.label || "",
    unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
    type,
    previousQuantity,
    newQuantity,
    delta: Number(newQuantity) - Number(previousQuantity),
    previousLowStockThreshold,
    newLowStockThreshold,
    reason: clean(reason),
    note: clean(note),
    orderId: order?._id || null,
    orderNumber: order?.orderNumber || "",
    changedBy,
    changedByRole: clean(actorUser?.role).toUpperCase(),
    metadata,
  });
}

export async function listStock({
  q = "",
  category = "",
  status = "ALL",
  page = 1,
  limit = 100,
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 100)));
  const query = buildProductQuery({ q, category });

  const products = await Product.find(query)
    .sort({ category: 1, name: 1, sku: 1 })
    .lean();

  const filtered = filterStockStatus(products.map(stockItem), status);
  const total = filtered.length;
  const start = (pageNumber - 1) * limitNumber;
  const items = filtered.slice(start, start + limitNumber);

  const summary = filtered.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.stock.status === STOCK_STATUS.LOW_STOCK) acc.lowStock += 1;
      if (item.stock.status === STOCK_STATUS.OUT_OF_STOCK) acc.outOfStock += 1;
      return acc;
    },
    { total: 0, lowStock: 0, outOfStock: 0 },
  );

  return {
    items,
    summary,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

export async function getStockDetail({ productId }) {
  ensureObjectId(productId, "productId");
  const product = await Product.findById(productId).lean();
  if (!product) throw new ApiError(404, "Product not found");
  return stockItem(product);
}

export async function getStockHistory({ productId, page = 1, limit = 50 }) {
  ensureObjectId(productId, "productId");
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));
  const query = { productId };
  const [items, total] = await Promise.all([
    StockAdjustmentLog.find(query)
      .sort({ changedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    StockAdjustmentLog.countDocuments(query),
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

export async function updateStockQuantity({
  productId,
  newQuantity,
  reason,
  note = "",
  actorUser,
}) {
  ensureObjectId(productId, "productId");
  const normalizedQuantity = Number(newQuantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 0) {
    throw new ApiError(400, "Stock quantity cannot be negative");
  }
  if (!clean(reason)) {
    throw new ApiError(400, "Stock amendment reason is required");
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  const previousQuantity = Number(product.stock?.currentQuantity || 0);
  product.stock = {
    ...(product.stock?.toObject?.() || product.stock || {}),
    currentQuantity: normalizedQuantity,
    unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
    notes: clean(note) || clean(product.stock?.notes),
    lastUpdatedAt: new Date(),
    lastUpdatedBy: actorId(actorUser),
  };

  await product.save();
  await createStockLog({
    product,
    previousQuantity,
    newQuantity: normalizedQuantity,
    reason,
    note,
    actorUser,
  });

  return stockItem(product.toObject());
}

export async function updateStockThreshold({
  productId,
  lowStockThreshold,
  reason,
  note = "",
  actorUser,
}) {
  ensureObjectId(productId, "productId");
  const normalizedThreshold = Number(lowStockThreshold);
  if (!Number.isFinite(normalizedThreshold) || normalizedThreshold < 0) {
    throw new ApiError(400, "Low stock threshold cannot be negative");
  }
  if (!clean(reason)) {
    throw new ApiError(400, "Threshold change reason is required");
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  const previousQuantity = Number(product.stock?.currentQuantity || 0);
  const previousLowStockThreshold = Number(product.stock?.lowStockThreshold || 0);
  product.stock = {
    ...(product.stock?.toObject?.() || product.stock || {}),
    lowStockThreshold: normalizedThreshold,
    unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
    notes: clean(note) || clean(product.stock?.notes),
    lastUpdatedAt: new Date(),
    lastUpdatedBy: actorId(actorUser),
  };

  await product.save();
  await createStockLog({
    product,
    previousQuantity,
    newQuantity: previousQuantity,
    previousLowStockThreshold,
    newLowStockThreshold: normalizedThreshold,
    reason,
    note,
    actorUser,
    type: STOCK_ADJUSTMENT_TYPE.THRESHOLD_UPDATE,
  });

  return stockItem(product.toObject());
}

export async function deductStockForOrder({ order, actorUser }) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  if (order.stockDeduction?.deductedAt) {
    throw new ApiError(400, "Stock has already been deducted for this order");
  }

  const lines = [];
  for (const item of order.items || []) {
    const productId = item.productId;
    if (!productId) {
      throw new ApiError(400, `Order item ${item.name || item.sku || ""} is missing productId`);
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, `Product not found for SKU ${item.sku || ""}`);
    }

    const previousQuantity = Number(product.stock?.currentQuantity || 0);
    const deductedQuantity = Number(item.quantity || 0);
    if (!Number.isFinite(deductedQuantity) || deductedQuantity <= 0) {
      throw new ApiError(400, `Invalid deduction quantity for ${item.name || item.sku}`);
    }

    const newQuantity = previousQuantity - deductedQuantity;
    if (newQuantity < 0) {
      throw new ApiError(
        400,
        `Insufficient stock for ${product.name || product.sku}. Available ${previousQuantity}, requested ${deductedQuantity}.`,
      );
    }

    product.stock = {
      ...(product.stock?.toObject?.() || product.stock || {}),
      currentQuantity: newQuantity,
      unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: actorId(actorUser),
    };

    await product.save();
    await createStockLog({
      product,
      previousQuantity,
      newQuantity,
      reason: `Order ${order.orderNumber || order._id} marked out for delivery`,
      note: "Automatic stock deduction at factory shipment stage.",
      actorUser,
      type: STOCK_ADJUSTMENT_TYPE.ORDER_SHIPMENT_DEDUCTION,
      order,
    });

    lines.push({
      productId: product._id,
      sku: product.sku || item.sku || "",
      name: product.name || item.name || "",
      previousQuantity,
      deductedQuantity,
      newQuantity,
    });
  }

  return lines;
}

export { STOCK_STATUS };
