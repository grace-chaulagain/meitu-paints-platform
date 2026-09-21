import mongoose from "mongoose";
import Product from "../../models/Product.model.js";
import DispatcherProductStock from "../../models/DispatcherProductStock.model.js";
import DealerProductStock from "../../models/DealerProductStock.model.js";
import StockAdjustmentLog from "../../models/StockAdjustmentLog.model.js";
import DispatcherStockMovement from "../../models/DispatcherStockMovement.model.js";
import InventoryMovement from "../../models/InventoryMovement.model.js";
import ApiError from "../../utils/apiError.js";
import { normalize, numberValue, resolveDateRange } from "./insightsShared.js";

const MOVEMENT_LIMIT = 200;

function objectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

// One vocabulary for every tier: "out" beats "low" beats "ok", and a
// threshold of 0 means the tier never flags low (the models default it to
// 0, which must not be read as "everything is low").
function stockStatus(quantity, threshold) {
  const qty = numberValue(quantity);
  if (qty <= 0) return "OUT";
  if (numberValue(threshold) > 0 && qty <= numberValue(threshold)) return "LOW";
  return "OK";
}

function tallyStatuses(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.skuCount += 1;
      acc.totalQuantity += numberValue(row.quantity);
      if (row.status === "OUT") acc.outOfStock += 1;
      else if (row.status === "LOW") acc.lowStock += 1;
      return acc;
    },
    { skuCount: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 },
  );
}

export async function getFactoryStock() {
  const products = await Product.find({ isActive: { $ne: false } })
    .select("sku name category pack stock")
    .sort({ category: 1, name: 1 })
    .lean();

  return products.map((product) => {
    const quantity = numberValue(product.stock?.currentQuantity);
    const reserved = numberValue(product.stock?.reservedQuantity);
    return {
      key: String(product._id),
      sku: product.sku,
      name: product.name,
      category: product.category || "",
      packLabel: product.pack?.label || "",
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
      threshold: numberValue(product.stock?.lowStockThreshold),
      status: stockStatus(quantity, product.stock?.lowStockThreshold),
      lastUpdatedAt: product.stock?.lastUpdatedAt || null,
    };
  });
}

export async function getDispatcherStock(filters = {}) {
  const query = {};
  if (normalize(filters.dispatcherId)) {
    query.dispatcherId = objectId(filters.dispatcherId, "dispatcherId");
  }

  const rows = await DispatcherProductStock.find(query)
    .populate("dispatcherId", "companyName contactName")
    .populate("productId", "sku name category pack")
    .lean();

  return rows.map((row) => {
    const quantity = numberValue(row.currentQuantity);
    const reserved = numberValue(row.reservedQuantity);
    return {
      key: String(row._id),
      holder: row.dispatcherId?.companyName || row.dispatcherId?.contactName || "Dispatcher",
      sku: row.productId?.sku || "",
      name: row.productId?.name || "Unknown product",
      category: row.productId?.category || "",
      packLabel: row.productId?.pack?.label || "",
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
      threshold: 0,
      status: stockStatus(quantity, 0),
      lastUpdatedAt: row.lastUpdatedAt || null,
    };
  });
}

export async function getDealerStock(filters = {}) {
  const query = {};
  if (normalize(filters.dealerId)) {
    query.dealerId = objectId(filters.dealerId, "dealerId");
  }

  const rows = await DealerProductStock.find(query)
    .populate("dealerId", "companyName contactName")
    .populate("productId", "sku name category pack")
    .lean();

  return rows.map((row) => {
    const quantity = numberValue(row.currentQuantity);
    return {
      key: String(row._id),
      holder: row.dealerId?.companyName || row.dealerId?.contactName || "Dealer",
      sku: row.productId?.sku || "",
      name: row.productId?.name || "Unknown product",
      category: row.productId?.category || "",
      packLabel: row.productId?.pack?.label || "",
      quantity,
      received: numberValue(row.totalReceivedQuantity),
      sold: numberValue(row.totalSoldQuantity),
      threshold: numberValue(row.lowStockThreshold),
      status: stockStatus(quantity, row.lowStockThreshold),
      lastUpdatedAt: row.lastMovementAt || null,
    };
  });
}

// Health across all three tiers at once - the section's headline row.
export async function getInventoryOverview(filters = {}) {
  const [factory, dispatcher, dealer] = await Promise.all([
    getFactoryStock(),
    getDispatcherStock(filters),
    getDealerStock(filters),
  ]);

  return {
    factory: tallyStatuses(factory),
    dispatcher: tallyStatuses(dispatcher),
    dealer: tallyStatuses(dealer),
  };
}

// Movement history, normalised across three differently-shaped logs so
// one table can render any tier. Each log keeps its own vocabulary for
// `type`, which is passed through rather than flattened - the words mean
// different things per tier and collapsing them would be a lie.
export async function getStockMovements(filters = {}) {
  const tier = normalize(filters.tier) || "factory";
  const range = resolveDateRange(filters);
  const dateMatch = range.isAllTime ? {} : { createdAt: { $gte: range.start, $lte: range.end } };
  const limit = Math.min(MOVEMENT_LIMIT, Math.max(1, Number(filters.limit) || 100));

  if (tier === "dispatcher") {
    const query = { ...dateMatch };
    if (normalize(filters.dispatcherId)) {
      query.dispatcherId = objectId(filters.dispatcherId, "dispatcherId");
    }
    const rows = await DispatcherStockMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("dispatcherId", "companyName contactName")
      .populate("productId", "sku name")
      .lean();

    return rows.map((row) => ({
      key: String(row._id),
      createdAt: row.createdAt,
      holder: row.dispatcherId?.companyName || row.dispatcherId?.contactName || "Dispatcher",
      sku: row.productId?.sku || "",
      name: row.productId?.name || "",
      type: row.type,
      quantity: numberValue(row.quantity),
      previousQuantity: numberValue(row.previousQuantity),
      newQuantity: numberValue(row.newQuantity),
      note: row.note || row.reason || "",
    }));
  }

  if (tier === "dealer") {
    const query = { ...dateMatch };
    if (normalize(filters.dealerId)) {
      query.dealerId = objectId(filters.dealerId, "dealerId");
    }
    const rows = await InventoryMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("dealerId", "companyName contactName")
      .populate("productId", "sku name")
      .lean();

    return rows.map((row) => ({
      key: String(row._id),
      createdAt: row.createdAt,
      holder: row.dealerId?.companyName || row.dealerId?.contactName || "Dealer",
      sku: row.productId?.sku || "",
      name: row.productId?.name || "",
      type: row.type,
      quantity: numberValue(row.quantity),
      previousQuantity: numberValue(row.previousQuantity),
      newQuantity: numberValue(row.newQuantity),
      note: row.note || "",
    }));
  }

  // Factory: StockAdjustmentLog already denormalises product identity, so
  // no populate is needed here.
  const rows = await StockAdjustmentLog.find(dateMatch)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    key: String(row._id),
    createdAt: row.createdAt,
    holder: "Factory",
    sku: row.sku || "",
    name: row.productName || "",
    type: row.type,
    quantity: numberValue(row.newQuantity) - numberValue(row.previousQuantity),
    previousQuantity: numberValue(row.previousQuantity),
    newQuantity: numberValue(row.newQuantity),
    note: row.note || row.reason || "",
  }));
}
