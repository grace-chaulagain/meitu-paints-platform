import mongoose from "mongoose";
import DealerProductStock from "../models/DealerProductStock.model.js";
import InventoryMovement, { INVENTORY_MOVEMENT_TYPE } from "../models/InventoryMovement.model.js";
import Product from "../models/Product.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Order from "../models/Order.model.js";
import Sale from "../models/Sale.model.js";
import ApiError from "../utils/apiError.js";
import { withStockSession } from "./stock.service.js";

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function itemProductId(item) {
  return item?.productId || null;
}

function itemQuantity(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function itemUnitCost(item) {
  const cost = Number(item?.unitPrice ?? item?.rate ?? 0);
  return Number.isFinite(cost) && cost > 0 ? cost : null;
}

// The one place every dealer-inventory-affecting event goes through.
// Writes an InventoryMovement row (the audit trail / source of truth) and
// atomically updates the DealerProductStock cache in the same operation.
// Credit types (PURCHASE/RETURN/TRANSFER_IN) always succeed; debit types
// (SALE/TRANSFER_OUT) are guarded so a dealer can never oversell their own
// stock, mirroring the same write-time $expr-guard used for central
// Product.stock in stock.service.js. ADJUSTMENT quantity is a signed delta
// (can go either way); all other types take a positive quantity.
async function applyMovement({
  dealerId,
  productId,
  branchId = null,
  type,
  quantity,
  unitCost = null,
  reason = "",
  note = "",
  orderId = null,
  saleId = null,
  relatedMovementId = null,
  actorUser,
  actorRole = "",
  ipAddress = "",
  session,
}) {
  const isCredit = [
    INVENTORY_MOVEMENT_TYPE.PURCHASE,
    INVENTORY_MOVEMENT_TYPE.RETURN,
    INVENTORY_MOVEMENT_TYPE.TRANSFER_IN,
  ].includes(type);
  const isDebit = [INVENTORY_MOVEMENT_TYPE.SALE, INVENTORY_MOVEMENT_TYPE.TRANSFER_OUT].includes(type);
  const isAdjustment = type === INVENTORY_MOVEMENT_TYPE.ADJUSTMENT;

  const delta = isAdjustment ? Number(quantity) : isDebit ? -Math.abs(Number(quantity)) : Math.abs(Number(quantity));
  if (!Number.isFinite(delta) || delta === 0) {
    throw new ApiError(400, "Invalid movement quantity");
  }

  const incFields = { currentQuantity: delta };
  if (isCredit) incFields.totalReceivedQuantity = Math.abs(delta);
  if (isDebit) incFields.totalSoldQuantity = Math.abs(delta);

  const filter = { dealerId, productId, branchId };
  // Debits (and negative adjustments) are guarded at write time - the
  // filter only matches if enough stock exists, closing the oversell race
  // the same way reserveStockForOrder's $expr guard does for central stock.
  if (delta < 0) {
    filter.currentQuantity = { $gte: -delta };
  }

  const updated = await DealerProductStock.findOneAndUpdate(
    filter,
    {
      $inc: incFields,
      $set: {
        lastMovementAt: new Date(),
        lastUpdatedBy: actorId(actorUser),
        ...(unitCost !== null ? { lastKnownUnitCost: unitCost } : {}),
      },
    },
    { upsert: delta > 0, new: true, session, setDefaultsOnInsert: true },
  );

  if (!updated) {
    const existing = await DealerProductStock.findOne({ dealerId, productId, branchId }).session(session);
    const available = Number(existing?.currentQuantity || 0);
    const product = await Product.findById(productId).select("name sku").session(session).lean();
    throw new ApiError(
      400,
      `Insufficient stock for ${product?.name || product?.sku || "item"}. Available ${available}, requested ${-delta}.`,
    );
  }

  const previousQuantity = updated.currentQuantity - delta;

  const [movement] = await InventoryMovement.create(
    [
      {
        dealerId,
        productId,
        branchId,
        type,
        quantity: isAdjustment ? delta : Math.abs(delta),
        previousQuantity,
        newQuantity: updated.currentQuantity,
        unitCost,
        reason,
        note,
        orderId,
        saleId,
        relatedMovementId,
        actorUserId: actorId(actorUser),
        actorRole,
        ipAddress,
      },
    ],
    { session },
  );

  return { movement, stock: updated };
}

// Credits a dealer's inventory for every line item of a delivered/dispatched
// order - the "Dealer receives order from Meitu -> Inventory automatically
// increases" step. Called from both fulfillment lanes (Factory delivery for
// FACTORY-mode dealers, dispatcher dispatch for DISPATCHER-mode dealers).
export async function recordPurchaseMovement({
  dealerId,
  items = [],
  orderId = null,
  actorUser,
  actorRole = "SYSTEM",
  session = null,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");

  return withStockSession(session, async (txnSession) => {
    const results = [];
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      const result = await applyMovement({
        dealerId,
        productId,
        type: INVENTORY_MOVEMENT_TYPE.PURCHASE,
        quantity,
        unitCost: itemUnitCost(item),
        reason: "Order delivered",
        orderId,
        actorUser,
        actorRole,
        session: txnSession,
      });
      results.push(result);
    }
    return results;
  });
}

// Debits a dealer's inventory for every line item of a sale against a bill -
// oversell-guarded the same way applyMovement guards every debit. Expects
// to run inside the caller's own transaction (sale.service.js owns the
// session, since Sale creation shares it).
export async function recordSaleMovements({
  dealerId,
  items = [],
  saleId,
  actorUser,
  actorRole = "DEALER",
  session,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!saleId) throw new ApiError(400, "saleId is required");

  const results = [];
  for (const item of items) {
    const productId = itemProductId(item);
    const quantity = itemQuantity(item);
    if (!productId || quantity <= 0) continue;

    const result = await applyMovement({
      dealerId,
      productId,
      type: INVENTORY_MOVEMENT_TYPE.SALE,
      quantity,
      reason: "Sale to customer",
      saleId,
      actorUser,
      actorRole,
      session,
    });
    results.push(result);
  }
  return results;
}

// Resolves the price a new sale line should record - dealers don't set
// their own resale price anywhere in this system, so the only defensible
// value available is what the dealer last paid to acquire the product
// (see the field comment on DealerProductStock.lastKnownUnitCost). Reads
// happen inside the caller's transaction (sale.service.js's create flow)
// so the price is resolved against the same consistent snapshot as the
// stock debit.
export async function getLastKnownUnitCosts({ dealerId, productIds, session } = {}) {
  const rows = await DealerProductStock.find({ dealerId, productId: { $in: productIds } })
    .select("productId lastKnownUnitCost")
    .session(session)
    .lean();
  return new Map(rows.map((row) => [String(row.productId), row.lastKnownUnitCost]));
}

// Credits a dealer's inventory back for every SALE movement tied to a
// voided sale - one compensating RETURN movement per original movement,
// cross-referenced via relatedMovementId. Runs inside the caller's
// transaction (sale.service.js's void flow).
export async function reverseSaleMovements({
  dealerId,
  saleId,
  actorUser,
  actorRole = "DEALER",
  session,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!saleId) throw new ApiError(400, "saleId is required");

  const originalMovements = await InventoryMovement.find({
    dealerId,
    saleId,
    type: INVENTORY_MOVEMENT_TYPE.SALE,
  }).session(session);

  const results = [];
  for (const movement of originalMovements) {
    const result = await applyMovement({
      dealerId,
      productId: movement.productId,
      type: INVENTORY_MOVEMENT_TYPE.RETURN,
      quantity: movement.quantity,
      reason: "Sale voided",
      saleId,
      relatedMovementId: movement._id,
      actorUser,
      actorRole,
      session,
    });
    results.push(result);
  }
  return results;
}

// Shared between listDealerStock and getDealerStockItem so the list and the
// detail page compute status/value identically.
function mapStockRow(row) {
  const product = row.productId;
  const currentQuantity = Number(row.currentQuantity || 0);
  const threshold = Number(row.lowStockThreshold || product.stock?.lowStockThreshold || 0);
  const stockStatus =
    currentQuantity <= 0 ? "OUT_OF_STOCK" : threshold > 0 && currentQuantity <= threshold ? "LOW_STOCK" : "IN_STOCK";

  return {
    productId: product._id,
    name: product.name || "",
    sku: product.sku || "",
    code: product.code || "",
    category: product.category || "",
    pack: product.pack || {},
    images: product.images || [],
    currentQuantity,
    totalReceivedQuantity: Number(row.totalReceivedQuantity || 0),
    totalSoldQuantity: Number(row.totalSoldQuantity || 0),
    lowStockThreshold: threshold,
    lastKnownUnitCost: row.lastKnownUnitCost ?? null,
    inventoryValue: row.lastKnownUnitCost ? currentQuantity * row.lastKnownUnitCost : null,
    lastMovementAt: row.lastMovementAt || null,
    status: stockStatus,
  };
}

export async function getDealerStockItem({ dealerId, productId } = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!productId) throw new ApiError(400, "productId is required");

  const row = await DealerProductStock.findOne({ dealerId, productId })
    .populate({ path: "productId", select: "name sku code category pack images stock.lowStockThreshold" })
    .lean();

  if (!row || !row.productId) throw new ApiError(404, "Inventory item not found");
  return mapStockRow(row);
}

const PURCHASE_LIKE_TYPES = [
  INVENTORY_MOVEMENT_TYPE.PURCHASE,
  INVENTORY_MOVEMENT_TYPE.RETURN,
  INVENTORY_MOVEMENT_TYPE.TRANSFER_IN,
];
const SALE_LIKE_TYPES = [INVENTORY_MOVEMENT_TYPE.SALE, INVENTORY_MOVEMENT_TYPE.TRANSFER_OUT];

// DealerProductStock only ever holds lifetime running totals (see
// applyMovement's $inc above), so a date-bounded view can't read them
// directly - it has to re-sum the append-only InventoryMovement ledger for
// the window instead. Mirrors the same credit/debit split applyMovement
// uses, so a date range covering all time reproduces the lifetime totals.
async function getMovementTotalsByProduct({ dealerId, from, to }) {
  const createdAt = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;

  const rows = await InventoryMovement.aggregate([
    { $match: { dealerId: new mongoose.Types.ObjectId(dealerId), createdAt } },
    {
      $group: {
        _id: "$productId",
        purchase: { $sum: { $cond: [{ $in: ["$type", PURCHASE_LIKE_TYPES] }, "$quantity", 0] } },
        sales: { $sum: { $cond: [{ $in: ["$type", SALE_LIKE_TYPES] }, "$quantity", 0] } },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), { purchase: row.purchase || 0, sales: row.sales || 0 });
  }
  return map;
}

export async function listDealerStock({
  dealerId,
  q = "",
  category = "",
  status = "ALL",
  sort = "name",
  page = 1,
  limit = 100,
  from = null,
  to = null,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  const dealer = await DealerProfile.findById(dealerId).select("_id").lean();
  if (!dealer) throw new ApiError(404, "Dealer not found");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 100)));
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const hasDateFilter = Boolean(fromDate || toDate);

  const rows = await DealerProductStock.find({ dealerId })
    .populate({ path: "productId", select: "name sku code category pack images stock.lowStockThreshold" })
    .lean();

  const query = String(q || "").trim().toLowerCase();
  const normalizedCategory = String(category || "").trim();

  let items = rows.filter((row) => row.productId).map(mapStockRow);

  if (hasDateFilter) {
    const totalsByProduct = await getMovementTotalsByProduct({ dealerId, from: fromDate, to: toDate });
    items = items.map((item) => {
      const totals = totalsByProduct.get(String(item.productId)) || { purchase: 0, sales: 0 };
      return { ...item, totalReceivedQuantity: totals.purchase, totalSoldQuantity: totals.sales };
    });
  }

  if (query) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query),
    );
  }
  if (normalizedCategory && normalizedCategory !== "ALL") {
    items = items.filter((item) => item.category === normalizedCategory);
  }
  if (status && status !== "ALL") {
    items = items.filter((item) => item.status === status);
  }

  items.sort((a, b) => {
    if (sort === "stock-asc") return a.currentQuantity - b.currentQuantity;
    if (sort === "stock-desc") return b.currentQuantity - a.currentQuantity;
    if (sort === "value-desc") return (b.inventoryValue || 0) - (a.inventoryValue || 0);
    if (sort === "recent") return new Date(b.lastMovementAt || 0) - new Date(a.lastMovementAt || 0);
    return a.name.localeCompare(b.name);
  });

  const total = items.length;
  const start = (pageNumber - 1) * limitNumber;
  const paged = items.slice(start, start + limitNumber);

  const summary = items.reduce(
    (acc, item) => {
      acc.totalValue += item.inventoryValue || 0;
      acc.totalUnits += item.currentQuantity || 0;
      if (item.status === "LOW_STOCK") acc.lowStockCount += 1;
      if (item.status === "OUT_OF_STOCK") acc.outOfStockCount += 1;
      return acc;
    },
    { totalValue: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: items.length },
  );

  return {
    items: paged,
    summary,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

export async function getDealerStockMovements({
  dealerId,
  productId,
  type = "ALL",
  from = null,
  to = null,
  page = 1,
  limit = 50,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!productId) throw new ApiError(400, "productId is required");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = { dealerId, productId };
  if (type && type !== "ALL") filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    InventoryMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "actorUserId", select: "username email" })
      // Populated fully enough that a PURCHASE/SALE row's order or sale
      // can be previewed straight from this one list - no follow-up
      // per-row fetch needed to open the preview modal.
      .populate({ path: "orderId", select: "orderNumber status createdAt items totals dealerNote" })
      .populate({
        path: "saleId",
        select: "saleNumber billId saleDate status items totals voidReason",
      })
      .lean(),
    InventoryMovement.countDocuments(filter),
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

// Dealer-wide counterpart to getDealerStockMovements - every stock change
// across every product this dealer carries, newest first. Powers the
// Inventory page's "History" tab (the dealer-scoped equivalent of the
// factory's stock movement history). Search matches product name/SKU or the
// originating order/sale number, resolved to id sets up front since those
// are refs the ledger itself doesn't store as searchable text.
export async function getDealerStockHistory({
  dealerId,
  q = "",
  type = "ALL",
  from = null,
  to = null,
  sort = "desc",
  page = 1,
  limit = 50,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = { dealerId };
  if (type && type !== "ALL") filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const query = String(q || "").trim();
  if (query) {
    const rx = { $regex: query, $options: "i" };
    const [matchingProducts, matchingOrders, matchingSales] = await Promise.all([
      Product.find({ $or: [{ name: rx }, { sku: rx }] }).select("_id").lean(),
      Order.find({ orderNumber: rx }).select("_id").lean(),
      Sale.find({ $or: [{ saleNumber: rx }, { billId: rx }] }).select("_id").lean(),
    ]);

    const orClauses = [];
    if (matchingProducts.length) orClauses.push({ productId: { $in: matchingProducts.map((p) => p._id) } });
    if (matchingOrders.length) orClauses.push({ orderId: { $in: matchingOrders.map((o) => o._id) } });
    if (matchingSales.length) orClauses.push({ saleId: { $in: matchingSales.map((s) => s._id) } });

    if (orClauses.length === 0) {
      return { items: [], pagination: { page: pageNumber, limit: limitNumber, total: 0, pages: 1 } };
    }
    filter.$or = orClauses;
  }

  const [items, total] = await Promise.all([
    InventoryMovement.find(filter)
      .sort({ createdAt: sort === "asc" ? 1 : -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "productId", select: "name sku code pack images category" })
      .populate({ path: "actorUserId", select: "username email" })
      .populate({ path: "orderId", select: "orderNumber status createdAt" })
      .populate({ path: "saleId", select: "saleNumber billId saleDate status" })
      .lean(),
    InventoryMovement.countDocuments(filter),
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
