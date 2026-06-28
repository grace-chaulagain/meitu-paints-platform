import mongoose from "mongoose";

import Product from "../models/Product.model.js";
import {
  STOCK_CHECK_STATUS,
  STOCK_RESERVATION_STATUS,
} from "../models/Order.model.js";
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
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImage = images.find((image) => image?.isPrimary) || images[0] || null;

  return {
    _id: product._id,
    productId: product._id,
    sku: product.sku || "",
    code: product.code || "",
    name: product.name || "",
    category: product.category || "",
    pack: product.pack || {},
    packLabel: product.pack?.label || "",
    images,
    primaryImage,
    imageUrl: primaryImage?.url || "",
    isActive: product.isActive,
    stock: getStock(product),
  };
}

function buildProductQuery({ q = "", category = "", code = "" } = {}) {
  const query = {};
  const search = clean(q);
  const normalizedCategory = clean(category);
  const normalizedCode = clean(code);

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: rx }, { sku: rx }, { code: rx }, { category: rx }];
  }

  if (normalizedCategory) {
    query.category = normalizedCategory;
  }

  if (normalizedCode) {
    query.code = normalizedCode;
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
  previousCurrentQuantity = previousQuantity,
  newCurrentQuantity = newQuantity,
  previousReservedQuantity = null,
  newReservedQuantity = null,
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
    previousCurrentQuantity:
      previousCurrentQuantity === null ? null : Number(previousCurrentQuantity),
    newCurrentQuantity:
      newCurrentQuantity === null ? null : Number(newCurrentQuantity),
    deltaCurrent:
      previousCurrentQuantity === null || newCurrentQuantity === null
        ? null
        : Number(newCurrentQuantity) - Number(previousCurrentQuantity),
    previousReservedQuantity:
      previousReservedQuantity === null ? null : Number(previousReservedQuantity),
    newReservedQuantity:
      newReservedQuantity === null ? null : Number(newReservedQuantity),
    deltaReserved:
      previousReservedQuantity === null || newReservedQuantity === null
        ? null
        : Number(newReservedQuantity) - Number(previousReservedQuantity),
    previousLowStockThreshold,
    newLowStockThreshold,
    reason: clean(reason),
    note: clean(note),
    orderId: order?._id || null,
    orderNumber: order?.orderNumber || "",
    dealerId: order?.dealerId || null,
    changedBy,
    changedByRole: clean(actorUser?.role).toUpperCase(),
    metadata,
  });
}

function itemQuantity(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function productKey(product) {
  return String(product?._id || "");
}

function reservationStatus(order) {
  return order?.stockReservation?.status || STOCK_RESERVATION_STATUS.NONE;
}

function normalizePackLabel(value = "") {
  return clean(value).toLowerCase();
}

async function findProductForOrderItem(item) {
  const productId = item?.productId;
  if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
    const byId = await Product.findById(productId);
    if (byId) return byId;
  }

  const sku = clean(item?.sku);
  if (sku) {
    const bySku = await Product.findOne({ sku, isActive: { $ne: false } });
    if (bySku) return bySku;
  }

  const code = clean(item?.code);
  const packLabel = normalizePackLabel(item?.packLabel || item?.variantLabel || item?.unit);
  if (code && packLabel) {
    const candidates = await Product.find({ code, isActive: { $ne: false } });
    return (
      candidates.find((product) => {
        const labels = [
          product?.pack?.label,
          `${product?.pack?.size || ""}${product?.pack?.unit || ""}`,
          `${product?.pack?.size || ""} ${product?.pack?.unit || ""}`,
        ].map(normalizePackLabel);
        return labels.includes(packLabel);
      }) || null
    );
  }

  return null;
}

async function resolveOrderStockLines(orderOrItems) {
  const items = Array.isArray(orderOrItems)
    ? orderOrItems
    : Array.isArray(orderOrItems?.items)
      ? orderOrItems.items
      : [];

  const lines = [];
  for (const [index, item] of items.entries()) {
    const requestedQuantity = itemQuantity(item);
    const product = await findProductForOrderItem(item);
    lines.push({
      index,
      item,
      product,
      matched: Boolean(product),
      requestedQuantity,
      productId: product?._id || item?.productId || null,
      sku: product?.sku || clean(item?.sku),
      name: product?.name || clean(item?.name),
      category: product?.category || clean(item?.category),
      packLabel: product?.pack?.label || clean(item?.packLabel || item?.variantLabel),
    });
  }

  return lines;
}

function buildStockCheckRows(lines) {
  const requestedByProduct = new Map();
  for (const line of lines) {
    if (!line.product) continue;
    const key = productKey(line.product);
    requestedByProduct.set(key, (requestedByProduct.get(key) || 0) + line.requestedQuantity);
  }

  return lines.map((line) => {
    if (!line.product) {
      return {
        productId: line.productId || null,
        sku: line.sku || "",
        name: line.name || "Unmatched item",
        requestedQuantity: line.requestedQuantity,
        currentQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        status: STOCK_CHECK_STATUS.UNMATCHED,
        matched: false,
        message: `No active product matched ${line.name || line.sku || `line ${line.index + 1}`}.`,
      };
    }

    const stock = getStock(line.product);
    const totalRequested = requestedByProduct.get(productKey(line.product)) || line.requestedQuantity;
    let status = STOCK_CHECK_STATUS.AVAILABLE;
    let message = "Stock available.";

    if (stock.currentQuantity <= 0) {
      status = STOCK_CHECK_STATUS.OUT_OF_STOCK;
      message = "Product is out of stock.";
    } else if (stock.availableQuantity < totalRequested) {
      status = STOCK_CHECK_STATUS.INSUFFICIENT;
      message = `Available ${stock.availableQuantity}, requested ${totalRequested}.`;
    } else if (
      stock.lowStockThreshold > 0 &&
      stock.availableQuantity - totalRequested <= stock.lowStockThreshold
    ) {
      status = STOCK_CHECK_STATUS.LOW;
      message = "Stock is available but will be low after reservation.";
    }

    return {
      productId: line.product._id,
      sku: line.product.sku || line.sku || "",
      name: line.product.name || line.name || "",
      requestedQuantity: line.requestedQuantity,
      currentQuantity: stock.currentQuantity,
      reservedQuantity: stock.reservedQuantity,
      availableQuantity: stock.availableQuantity,
      status,
      matched: true,
      message,
    };
  });
}

function stockCheckIsClear(items = []) {
  return items.every((item) =>
    [STOCK_CHECK_STATUS.AVAILABLE, STOCK_CHECK_STATUS.LOW].includes(item.status),
  );
}

function stockBlockerMessage(items = []) {
  const blockers = items.filter((item) =>
    [
      STOCK_CHECK_STATUS.INSUFFICIENT,
      STOCK_CHECK_STATUS.OUT_OF_STOCK,
      STOCK_CHECK_STATUS.UNMATCHED,
    ].includes(item.status),
  );

  if (!blockers.length) return "";
  return blockers
    .map((item) => `${item.name || item.sku || "Item"}: ${item.message || item.status}`)
    .join("; ");
}

function aggregateResolvedLines(lines) {
  const map = new Map();
  for (const line of lines) {
    if (!line.product) continue;
    const key = productKey(line.product);
    const existing = map.get(key) || {
      product: line.product,
      quantity: 0,
      firstLine: line,
    };
    existing.quantity += line.requestedQuantity;
    map.set(key, existing);
  }
  return Array.from(map.values());
}

function serializeReservationItem({ product, quantity, previousReservedQuantity, newReservedQuantity }) {
  return {
    productId: product._id,
    sku: product.sku || "",
    name: product.name || "",
    quantity: Number(quantity || 0),
    previousReservedQuantity: Number(previousReservedQuantity || 0),
    newReservedQuantity: Number(newReservedQuantity || 0),
  };
}

export async function checkOrderStock(orderOrItems, { persistToOrder = false } = {}) {
  const lines = await resolveOrderStockLines(orderOrItems);
  const items = buildStockCheckRows(lines);
  const checkedAt = new Date();
  const out = {
    ok: stockCheckIsClear(items),
    checkedAt,
    items,
  };

  if (persistToOrder && orderOrItems?.save) {
    orderOrItems.stockCheck = {
      checkedAt,
      items,
    };
    await orderOrItems.save();
  }

  return out;
}

export async function reserveStockForOrder({
  order,
  actorUser,
  reason = "Order verified and reserved for factory fulfillment",
  note = "",
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const currentStatus = reservationStatus(order);
  if (currentStatus === STOCK_RESERVATION_STATUS.RESERVED) return order;
  if (currentStatus === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Stock reservation has already been consumed");
  }

  const lines = await resolveOrderStockLines(order);
  const stockCheckItems = buildStockCheckRows(lines);
  order.stockCheck = {
    checkedAt: new Date(),
    items: stockCheckItems,
  };

  if (!stockCheckIsClear(stockCheckItems)) {
    throw new ApiError(400, `Cannot reserve stock. ${stockBlockerMessage(stockCheckItems)}`, {
      items: stockCheckItems,
    });
  }

  const reservationItems = [];
  for (const { product, quantity } of aggregateResolvedLines(lines)) {
    const previousCurrentQuantity = Number(product.stock?.currentQuantity || 0);
    const previousReservedQuantity = Number(product.stock?.reservedQuantity || 0);
    const newReservedQuantity = previousReservedQuantity + Number(quantity || 0);
    product.stock = {
      ...(product.stock?.toObject?.() || product.stock || {}),
      reservedQuantity: newReservedQuantity,
      unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: actorId(actorUser),
    };
    await product.save();
    await createStockLog({
      product,
      previousQuantity: previousCurrentQuantity,
      newQuantity: previousCurrentQuantity,
      previousCurrentQuantity,
      newCurrentQuantity: previousCurrentQuantity,
      previousReservedQuantity,
      newReservedQuantity,
      reason,
      note,
      actorUser,
      type: STOCK_ADJUSTMENT_TYPE.RESERVATION_CREATED,
      order,
    });
    reservationItems.push(
      serializeReservationItem({
        product,
        quantity,
        previousReservedQuantity,
        newReservedQuantity,
      }),
    );
  }

  order.stockReservation = {
    ...(order.stockReservation?.toObject?.() || order.stockReservation || {}),
    status: STOCK_RESERVATION_STATUS.RESERVED,
    reservedAt: new Date(),
    reservedBy: actorId(actorUser),
    releasedAt: null,
    releasedBy: null,
    consumedAt: null,
    consumedBy: null,
    items: reservationItems,
  };
  await order.save();
  return order;
}

export async function releaseReservationForOrder({
  order,
  actorUser,
  reason = "Order reservation released",
  note = "",
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const currentStatus = reservationStatus(order);
  if (currentStatus === STOCK_RESERVATION_STATUS.NONE || currentStatus === STOCK_RESERVATION_STATUS.RELEASED) {
    return order;
  }
  if (currentStatus === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Consumed stock cannot be released automatically");
  }

  for (const item of order.stockReservation?.items || []) {
    const product = item.productId
      ? await Product.findById(item.productId)
      : await Product.findOne({ sku: clean(item.sku) });
    if (!product) continue;

    const previousCurrentQuantity = Number(product.stock?.currentQuantity || 0);
    const previousReservedQuantity = Number(product.stock?.reservedQuantity || 0);
    const releaseQuantity = Number(item.quantity || 0);
    const newReservedQuantity = Math.max(0, previousReservedQuantity - releaseQuantity);

    product.stock = {
      ...(product.stock?.toObject?.() || product.stock || {}),
      reservedQuantity: newReservedQuantity,
      unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: actorId(actorUser),
    };
    await product.save();
    await createStockLog({
      product,
      previousQuantity: previousCurrentQuantity,
      newQuantity: previousCurrentQuantity,
      previousCurrentQuantity,
      newCurrentQuantity: previousCurrentQuantity,
      previousReservedQuantity,
      newReservedQuantity,
      reason,
      note,
      actorUser,
      type: STOCK_ADJUSTMENT_TYPE.RESERVATION_RELEASED,
      order,
    });
  }

  order.stockReservation = {
    ...(order.stockReservation?.toObject?.() || order.stockReservation || {}),
    status: STOCK_RESERVATION_STATUS.RELEASED,
    releasedAt: new Date(),
    releasedBy: actorId(actorUser),
  };
  await order.save();
  return order;
}

export async function consumeReservationForOrder({
  order,
  actorUser,
  reason = "Order marked out for delivery",
  note = "",
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  if (order.stockDeduction?.deductedAt || reservationStatus(order) === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Stock has already been deducted for this order");
  }

  let sourceItems = order.stockReservation?.items || [];
  let fallbackWithoutReservation = false;

  if (reservationStatus(order) !== STOCK_RESERVATION_STATUS.RESERVED) {
    const check = await checkOrderStock(order, { persistToOrder: true });
    if (!check.ok) {
      throw new ApiError(400, `Cannot deduct stock. ${stockBlockerMessage(check.items)}`, {
        items: check.items,
      });
    }
    const lines = await resolveOrderStockLines(order);
    sourceItems = aggregateResolvedLines(lines).map(({ product, quantity }) =>
      serializeReservationItem({
        product,
        quantity,
        previousReservedQuantity: Number(product.stock?.reservedQuantity || 0),
        newReservedQuantity: Number(product.stock?.reservedQuantity || 0),
      }),
    );
    fallbackWithoutReservation = true;
  }

  const operations = [];
  for (const item of sourceItems) {
    const product = item.productId
      ? await Product.findById(item.productId)
      : await Product.findOne({ sku: clean(item.sku) });
    if (!product) {
      throw new ApiError(404, `Product not found for SKU ${item.sku || ""}`);
    }

    const quantity = Number(item.quantity || 0);
    const previousCurrentQuantity = Number(product.stock?.currentQuantity || 0);
    const previousReservedQuantity = Number(product.stock?.reservedQuantity || 0);
    if (quantity <= 0) {
      throw new ApiError(400, `Invalid deduction quantity for ${product.name || product.sku}`);
    }
    if (previousCurrentQuantity < quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${product.name || product.sku}. Current ${previousCurrentQuantity}, requested ${quantity}.`,
      );
    }
    if (!fallbackWithoutReservation && previousReservedQuantity < quantity) {
      throw new ApiError(
        400,
        `Reserved stock for ${product.name || product.sku} is lower than shipment quantity.`,
      );
    }

    const newCurrentQuantity = previousCurrentQuantity - quantity;
    const newReservedQuantity = fallbackWithoutReservation
      ? previousReservedQuantity
      : Math.max(0, previousReservedQuantity - quantity);

    operations.push({
      product,
      item,
      quantity,
      previousCurrentQuantity,
      previousReservedQuantity,
      newCurrentQuantity,
      newReservedQuantity,
    });
  }

  const deductionLines = [];
  for (const operation of operations) {
    const {
      product,
      item,
      quantity,
      previousCurrentQuantity,
      previousReservedQuantity,
      newCurrentQuantity,
      newReservedQuantity,
    } = operation;

    product.stock = {
      ...(product.stock?.toObject?.() || product.stock || {}),
      currentQuantity: newCurrentQuantity,
      reservedQuantity: newReservedQuantity,
      unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: actorId(actorUser),
    };

    await product.save();
    await createStockLog({
      product,
      previousQuantity: previousCurrentQuantity,
      newQuantity: newCurrentQuantity,
      previousCurrentQuantity,
      newCurrentQuantity,
      previousReservedQuantity,
      newReservedQuantity,
      reason,
      note: note || "Automatic stock deduction at factory shipment stage.",
      actorUser,
      type: fallbackWithoutReservation
        ? STOCK_ADJUSTMENT_TYPE.ORDER_SHIPMENT_DEDUCTION
        : STOCK_ADJUSTMENT_TYPE.RESERVATION_CONSUMED,
      order,
      metadata: { fallbackWithoutReservation },
    });

    deductionLines.push({
      productId: product._id,
      sku: product.sku || item.sku || "",
      name: product.name || item.name || "",
      previousQuantity: previousCurrentQuantity,
      deductedQuantity: quantity,
      newQuantity: newCurrentQuantity,
    });
  }

  order.stockReservation = {
    ...(order.stockReservation?.toObject?.() || order.stockReservation || {}),
    status: STOCK_RESERVATION_STATUS.CONSUMED,
    consumedAt: new Date(),
    consumedBy: actorId(actorUser),
    items: sourceItems,
  };
  order.stockDeduction = {
    deductedAt: new Date(),
    deductedBy: actorId(actorUser),
    lines: deductionLines,
  };
  await order.save();
  return deductionLines;
}

function aggregateItemsByProduct(items = []) {
  const map = new Map();
  for (const item of items || []) {
    const key = clean(item.productId || item.sku || `${item.code || ""}:${item.packLabel || ""}`);
    if (!key) continue;
    const existing = map.get(key) || {
      item,
      quantity: 0,
    };
    existing.quantity += itemQuantity(item);
    map.set(key, existing);
  }
  return map;
}

export async function adjustReservationForOrderAmendment({
  order,
  previousItems = [],
  nextItems = [],
  actorUser,
  reason = "Order amended",
  note = "",
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const currentStatus = reservationStatus(order);
  if (currentStatus === STOCK_RESERVATION_STATUS.NONE || currentStatus === STOCK_RESERVATION_STATUS.RELEASED) {
    return order;
  }
  if (currentStatus === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Consumed reservations cannot be amended without a return workflow");
  }

  const previousMap = aggregateItemsByProduct(order.stockReservation?.items?.length ? order.stockReservation.items : previousItems);
  const nextLines = await resolveOrderStockLines(nextItems);
  const nextCheckItems = buildStockCheckRows(nextLines);
  const nextMap = new Map(
    aggregateResolvedLines(nextLines).map(({ product, quantity }) => [
      productKey(product),
      { product, quantity },
    ]),
  );

  const blockers = nextCheckItems.filter((item) => item.status === STOCK_CHECK_STATUS.UNMATCHED);
  if (blockers.length) {
    throw new ApiError(400, `Cannot amend reservation. ${stockBlockerMessage(blockers)}`, {
      items: nextCheckItems,
    });
  }

  const productIds = new Set([
    ...Array.from(previousMap.keys()),
    ...Array.from(nextMap.keys()),
  ]);

  const operations = [];
  for (const key of productIds) {
    const nextEntry = nextMap.get(key);
    const previousEntry = previousMap.get(key);
    const product = nextEntry?.product || (await Product.findById(previousEntry?.item?.productId));
    if (!product) continue;

    const oldQuantity = Number(previousEntry?.quantity || previousEntry?.item?.quantity || 0);
    const newQuantity = Number(nextEntry?.quantity || 0);
    const delta = newQuantity - oldQuantity;
    const previousCurrentQuantity = Number(product.stock?.currentQuantity || 0);
    const previousReservedQuantity = Number(product.stock?.reservedQuantity || 0);

    if (delta > 0) {
      const availableQuantity = Math.max(0, previousCurrentQuantity - previousReservedQuantity);
      if (availableQuantity < delta) {
        throw new ApiError(
          400,
          `Cannot increase ${product.name || product.sku}. Available ${availableQuantity}, extra requested ${delta}.`,
        );
      }
    }

    const newReservedQuantity = Math.max(0, previousReservedQuantity + delta);
    operations.push({
      product,
      oldQuantity,
      newQuantity,
      delta,
      previousCurrentQuantity,
      previousReservedQuantity,
      newReservedQuantity,
    });
  }

  const reservationItems = [];
  for (const operation of operations) {
    const {
      product,
      newQuantity,
      delta,
      previousCurrentQuantity,
      previousReservedQuantity,
      newReservedQuantity,
    } = operation;

    product.stock = {
      ...(product.stock?.toObject?.() || product.stock || {}),
      reservedQuantity: newReservedQuantity,
      unit: clean(product.stock?.unit || product.pack?.unit || product.uom?.base || "PCS"),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: actorId(actorUser),
    };
    await product.save();

    if (delta !== 0) {
      await createStockLog({
        product,
        previousQuantity: previousCurrentQuantity,
        newQuantity: previousCurrentQuantity,
        previousCurrentQuantity,
        newCurrentQuantity: previousCurrentQuantity,
        previousReservedQuantity,
        newReservedQuantity,
        reason,
        note,
        actorUser,
        type: STOCK_ADJUSTMENT_TYPE.ORDER_AMENDED,
        order,
      });
    }

    if (newQuantity > 0) {
      reservationItems.push(
        serializeReservationItem({
          product,
          quantity: newQuantity,
          previousReservedQuantity,
          newReservedQuantity,
        }),
      );
    }
  }

  order.stockReservation = {
    ...(order.stockReservation?.toObject?.() || order.stockReservation || {}),
    status: STOCK_RESERVATION_STATUS.RESERVED,
    items: reservationItems,
  };
  order.stockCheck = {
    checkedAt: new Date(),
    items: nextCheckItems,
  };
  await order.save();
  return order;
}

export async function listStock({
  q = "",
  category = "",
  code = "",
  status = "ALL",
  page = 1,
  limit = 100,
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 100)));
  const query = buildProductQuery({ q, category, code });

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

export async function listStockHistory({
  q = "",
  reason = "",
  dateFrom = "",
  dateTo = "",
  page = 1,
  limit = 80,
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 80)));
  const query = {};
  const search = clean(q);
  const reasonSearch = clean(reason);
  const from = clean(dateFrom);
  const to = clean(dateTo);

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { sku: rx },
      { code: rx },
      { productName: rx },
      { category: rx },
      { orderNumber: rx },
      { reason: rx },
    ];
  }

  if (reasonSearch) {
    query.reason = new RegExp(
      reasonSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }

  if (from || to) {
    query.changedAt = {};
    if (from) {
      const parsedFrom = new Date(`${from}T00:00:00.000Z`);
      if (!Number.isNaN(parsedFrom.getTime())) {
        query.changedAt.$gte = parsedFrom;
      }
    }
    if (to) {
      const parsedTo = new Date(`${to}T23:59:59.999Z`);
      if (!Number.isNaN(parsedTo.getTime())) {
        query.changedAt.$lte = parsedTo;
      }
    }
    if (!Object.keys(query.changedAt).length) delete query.changedAt;
  }

  const [items, total] = await Promise.all([
    StockAdjustmentLog.find(query)
      .sort({ changedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "changedBy", select: "username email role" })
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

export async function bulkUpdateStockQuantity({
  changes = [],
  reason,
  note = "",
  actorUser,
}) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new ApiError(400, "At least one stock change is required");
  }
  if (!clean(reason)) {
    throw new ApiError(400, "Bulk stock update reason is required");
  }

  const items = [];
  const errors = [];

  for (const change of changes) {
    try {
      const query = change.productId
        ? { _id: change.productId }
        : { sku: clean(change.sku) };
      const product = await Product.findOne(query).lean();
      if (!product) {
        errors.push({
          sku: change.sku || "",
          productId: change.productId || "",
          message: "Product not found",
        });
        continue;
      }

      const item = await updateStockQuantity({
        productId: product._id,
        newQuantity: change.newQuantity,
        reason,
        note,
        actorUser,
      });
      items.push(item);
    } catch (error) {
      errors.push({
        sku: change.sku || "",
        productId: change.productId || "",
        message: error?.message || "Update failed",
      });
    }
  }

  if (errors.length && items.length === 0) {
    throw new ApiError(400, "No stock rows were updated", { errors });
  }

  return { items, errors };
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
