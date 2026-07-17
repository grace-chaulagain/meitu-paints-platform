import mongoose from "mongoose";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import DispatcherStockMovement, {
  DISPATCHER_STOCK_MOVEMENT_TYPE,
} from "../models/DispatcherStockMovement.model.js";
import Product from "../models/Product.model.js";
import Order, { STOCK_CHECK_STATUS } from "../models/Order.model.js";
import ApiError from "../utils/apiError.js";
import { withStockSession } from "./stock.service.js";

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

  return null;
}

// Dispatcher-fulfilled orders never touch the central Product.stock ledger
// (see reserveStockForOrder in stock.service.js) - they're covered entirely
// by the dispatcher's own DispatcherProductStock rows, only ever consumed
// at dispatch time. This mirrors checkOrderStock's status logic (AVAILABLE/
// LOW/INSUFFICIENT/OUT_OF_STOCK/UNMATCHED) against that ledger instead, so
// a dispatcher can see the same kind of stock-readiness signal before they
// dispatch as an admin sees before verifying a factory order - there's no
// separate "reserved" concept here, so availableQuantity always equals
// currentQuantity.
export async function checkDispatcherOrderStock({ dispatcherId, order } = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  const items = Array.isArray(order?.items) ? order.items : [];
  const requestedByProduct = new Map();
  const lines = [];

  for (const [index, item] of items.entries()) {
    const product = await findProductForOrderItem(item);
    const requestedQuantity = itemQuantity(item);
    if (product) {
      const key = String(product._id);
      requestedByProduct.set(key, (requestedByProduct.get(key) || 0) + requestedQuantity);
    }
    lines.push({ index, item, product, requestedQuantity });
  }

  const stockRows = await DispatcherProductStock.find({
    dispatcherId,
    productId: { $in: lines.filter((line) => line.product).map((line) => line.product._id) },
  }).lean();
  const stockByProduct = new Map(stockRows.map((row) => [String(row.productId), row]));

  const checkedAt = new Date();
  const resultItems = lines.map((line) => {
    if (!line.product) {
      return {
        productId: line.item?.productId || null,
        sku: clean(line.item?.sku),
        name: clean(line.item?.name) || "Unmatched item",
        requestedQuantity: line.requestedQuantity,
        currentQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        status: STOCK_CHECK_STATUS.UNMATCHED,
        matched: false,
        message: `No active product matched ${clean(line.item?.name) || clean(line.item?.sku) || `line ${line.index + 1}`}.`,
      };
    }

    const stockRow = stockByProduct.get(String(line.product._id));
    const currentQuantity = Number(stockRow?.currentQuantity || 0);
    const lowStockThreshold = Number(line.product?.stock?.lowStockThreshold || 0);
    const totalRequested = requestedByProduct.get(String(line.product._id)) || line.requestedQuantity;

    let status = STOCK_CHECK_STATUS.AVAILABLE;
    let message = "Stock available.";

    if (currentQuantity <= 0) {
      status = STOCK_CHECK_STATUS.OUT_OF_STOCK;
      message = "You don't currently hold any stock for this product.";
    } else if (currentQuantity < totalRequested) {
      status = STOCK_CHECK_STATUS.INSUFFICIENT;
      message = `You have ${currentQuantity}, this order requests ${totalRequested}.`;
    } else if (lowStockThreshold > 0 && currentQuantity - totalRequested <= lowStockThreshold) {
      status = STOCK_CHECK_STATUS.LOW;
      message = "Stock is available but will be low after dispatch.";
    }

    return {
      productId: line.product._id,
      sku: line.product.sku || clean(line.item?.sku) || "",
      name: line.product.name || clean(line.item?.name) || "",
      requestedQuantity: line.requestedQuantity,
      currentQuantity,
      reservedQuantity: 0,
      availableQuantity: currentQuantity,
      status,
      matched: true,
      message,
    };
  });

  return {
    ok: resultItems.every((row) => [STOCK_CHECK_STATUS.AVAILABLE, STOCK_CHECK_STATUS.LOW].includes(row.status)),
    checkedAt,
    items: resultItems,
  };
}

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function clean(value = "") {
  return String(value || "").trim();
}

function itemProductId(item) {
  return item?.productId || null;
}

function itemQuantity(item) {
  const quantity = Number(
    item?.quantity ?? item?.qty ?? item?.deductedQuantity ?? 0,
  );
  return Number.isFinite(quantity) ? quantity : 0;
}

// Increments a dispatcher's on-hand stock for each line item, upserting
// the ledger row the first time this dispatcher holds a given SKU. This
// is the credit side of the Factory dispatching a dispatcher's own
// replenishment order. Also writes a DispatcherStockMovement row per item
// in the same transaction - the audit trail powering the "My Stock" History
// tab, mirroring how recordPurchaseMovement pairs with dealer stock writes.
export async function creditDispatcherStock({
  dispatcherId,
  items = [],
  orderId = null,
  reason = "Replenishment order dispatched",
  actorUser,
  session = null,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      const updated = await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId },
        {
          $inc: { currentQuantity: quantity },
          $set: {
            lastUpdatedAt: new Date(),
            lastUpdatedBy: actorId(actorUser),
          },
        },
        { upsert: true, new: true, session: txnSession, setDefaultsOnInsert: true },
      );

      await DispatcherStockMovement.create(
        [
          {
            dispatcherId,
            productId,
            type: DISPATCHER_STOCK_MOVEMENT_TYPE.REPLENISHMENT_IN,
            quantity,
            previousQuantity: updated.currentQuantity - quantity,
            newQuantity: updated.currentQuantity,
            reason,
            orderId,
            actorUserId: actorId(actorUser),
            actorRole: "FACTORY",
          },
        ],
        { session: txnSession },
      );
    }
  });
}

// Decrements a dispatcher's on-hand stock for each line item, atomically
// guarded so two concurrent dispatches from the same dispatcher can't
// oversell their own regional stock - the same guarded-filter pattern
// stock.service.js uses for central Product.stock. Also writes the
// compensating DispatcherStockMovement row per item, same transaction.
export async function consumeDispatcherStockForOrder({
  dispatcherId,
  items = [],
  orderId = null,
  reason = "Order dispatched to dealer",
  actorUser,
  session = null,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      const updated = await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId, currentQuantity: { $gte: quantity } },
        {
          $inc: { currentQuantity: -quantity },
          $set: {
            lastUpdatedAt: new Date(),
            lastUpdatedBy: actorId(actorUser),
          },
        },
        { new: true, session: txnSession },
      );

      if (!updated) {
        const [existing, product] = await Promise.all([
          DispatcherProductStock.findOne({ dispatcherId, productId }).session(txnSession),
          Product.findById(productId).select("name sku").session(txnSession),
        ]);
        const available = Number(existing?.currentQuantity || 0);
        throw new ApiError(
          400,
          `Insufficient dispatcher stock for ${product?.name || product?.sku || clean(item?.name) || "item"}. Available ${available}, requested ${quantity}.`,
        );
      }

      await DispatcherStockMovement.create(
        [
          {
            dispatcherId,
            productId,
            type: DISPATCHER_STOCK_MOVEMENT_TYPE.DISPATCH_OUT,
            quantity,
            previousQuantity: updated.currentQuantity + quantity,
            newQuantity: updated.currentQuantity,
            reason,
            orderId,
            actorUserId: actorId(actorUser),
            actorRole: "DISPATCHER",
          },
        ],
        { session: txnSession },
      );
    }
  });
}

// Dispatcher-wide counterpart to listDispatcherStock - every stock change
// across every product this dispatcher carries, powering "My Stock"'s
// History tab (the dispatcher-scoped equivalent of the dealer Inventory
// page's History tab). Search matches product name/SKU or the originating
// order number, resolved to id sets up front since the ledger itself only
// stores the orderId ref, not searchable text.
export async function listDispatcherStockHistory({
  dispatcherId,
  q = "",
  type = "ALL",
  from = null,
  to = null,
  sort = "desc",
  page = 1,
  limit = 50,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = { dispatcherId };
  if (type && type !== "ALL") filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const query = String(q || "").trim();
  if (query) {
    const rx = { $regex: query, $options: "i" };
    const [matchingProducts, matchingOrders] = await Promise.all([
      Product.find({ $or: [{ name: rx }, { sku: rx }] }).select("_id").lean(),
      Order.find({ orderNumber: rx }).select("_id").lean(),
    ]);

    const orClauses = [];
    if (matchingProducts.length) orClauses.push({ productId: { $in: matchingProducts.map((p) => p._id) } });
    if (matchingOrders.length) orClauses.push({ orderId: { $in: matchingOrders.map((o) => o._id) } });

    if (orClauses.length === 0) {
      return { items: [], pagination: { page: pageNumber, limit: limitNumber, total: 0, pages: 1 } };
    }
    filter.$or = orClauses;
  }

  const [items, total] = await Promise.all([
    DispatcherStockMovement.find(filter)
      .sort({ createdAt: sort === "asc" ? 1 : -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "productId", select: "name sku code pack images category" })
      .populate({ path: "actorUserId", select: "username email" })
      .populate({ path: "orderId", select: "orderNumber status createdAt" })
      .lean(),
    DispatcherStockMovement.countDocuments(filter),
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

export async function listDispatcherStock({ dispatcherId, page = 1, limit = 100 } = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 100)));

  const [rows, total] = await Promise.all([
    DispatcherProductStock.find({ dispatcherId })
      .sort({ lastUpdatedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "productId", select: "name sku code category pack images pricing stock.lowStockThreshold" })
      .lean(),
    DispatcherProductStock.countDocuments({ dispatcherId }),
  ]);

  const items = rows
    .filter((row) => row.productId)
    .map((row) => {
      const currentQuantity = Number(row.currentQuantity || 0);
      // No per-purchase unit cost is tracked for dispatcher stock (unlike
      // DealerProductStock.lastKnownUnitCost, sourced from real
      // InventoryMovement history) - the current catalog price is used as
      // a live estimate instead, just for this "Value" display column.
      const unitPrice = Number(row.productId.pricing?.tiers?.[0]?.pricePerPack || 0);
      return {
        productId: row.productId._id,
        sku: row.productId.sku || "",
        name: row.productId.name || "",
        code: row.productId.code || "",
        category: row.productId.category || "",
        pack: row.productId.pack || {},
        images: row.productId.images || [],
        currentQuantity,
        inventoryValue: unitPrice > 0 ? currentQuantity * unitPrice : null,
        lowStockThreshold: Number(row.productId.stock?.lowStockThreshold || 0),
        lastUpdatedAt: row.lastUpdatedAt || null,
      };
    });

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
