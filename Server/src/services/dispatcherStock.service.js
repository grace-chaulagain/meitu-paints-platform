import mongoose from "mongoose";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import DispatcherStockMovement, {
  DISPATCHER_STOCK_MOVEMENT_TYPE,
} from "../models/DispatcherStockMovement.model.js";
import Product from "../models/Product.model.js";
import Order, { STOCK_CHECK_STATUS, STOCK_RESERVATION_STATUS } from "../models/Order.model.js";
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
// by the dispatcher's own DispatcherProductStock rows. This mirrors
// checkOrderStock's status logic (AVAILABLE/LOW/INSUFFICIENT/OUT_OF_STOCK/
// UNMATCHED) against that ledger instead, so a dispatcher sees the same
// kind of stock-readiness signal before verifying/dispatching as an admin
// sees before verifying a factory order. availableQuantity accounts for
// reservedQuantity (stock already committed to other verified orders),
// same as the central ledger.
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
    const reservedQuantity = Number(stockRow?.reservedQuantity || 0);
    const availableQuantity = Math.max(0, currentQuantity - reservedQuantity);
    const lowStockThreshold = Number(line.product?.stock?.lowStockThreshold || 0);
    const totalRequested = requestedByProduct.get(String(line.product._id)) || line.requestedQuantity;

    let status = STOCK_CHECK_STATUS.AVAILABLE;
    let message = "Stock available.";

    if (availableQuantity <= 0) {
      status = STOCK_CHECK_STATUS.OUT_OF_STOCK;
      message = "You don't currently hold any available stock for this product.";
    } else if (availableQuantity < totalRequested) {
      status = STOCK_CHECK_STATUS.INSUFFICIENT;
      message = `You have ${availableQuantity} available, this order requests ${totalRequested}.`;
    } else if (lowStockThreshold > 0 && availableQuantity - totalRequested <= lowStockThreshold) {
      status = STOCK_CHECK_STATUS.LOW;
      message = "Stock is available but will be low after dispatch.";
    }

    return {
      productId: line.product._id,
      sku: line.product.sku || clean(line.item?.sku) || "",
      name: line.product.name || clean(line.item?.name) || "",
      requestedQuantity: line.requestedQuantity,
      currentQuantity,
      reservedQuantity,
      availableQuantity,
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

function reservationStatus(order) {
  return order?.stockReservation?.status || STOCK_RESERVATION_STATUS.NONE;
}

function stockBlockerMessage(items = []) {
  const blockers = items.filter((item) =>
    [STOCK_CHECK_STATUS.INSUFFICIENT, STOCK_CHECK_STATUS.OUT_OF_STOCK, STOCK_CHECK_STATUS.UNMATCHED].includes(
      item.status,
    ),
  );
  if (!blockers.length) return "";
  return blockers
    .map((item) => `${item.name || item.sku || "Item"}: ${item.message || item.status}`)
    .join("; ");
}

function serializeReservationItem({ productId, sku, name, quantity, previousReservedQuantity, newReservedQuantity }) {
  return {
    productId,
    sku: sku || "",
    name: name || "",
    quantity: Number(quantity || 0),
    previousReservedQuantity: Number(previousReservedQuantity || 0),
    newReservedQuantity: Number(newReservedQuantity || 0),
  };
}

// Reserves this dispatcher's own regional stock for a submitted order at
// the moment it's verified, mirroring reserveStockForOrder's role for
// central Product.stock on factory orders - see that function's comment
// in stock.service.js for the full rationale. Runs checkDispatcherOrderStock
// first for a readable blocker message, then re-checks atomically per
// product via a guarded $expr update so a concurrent reservation on the
// same SKU can't oversell (the pre-check alone has a read-then-write gap).
// No kit decomposition here (unlike resolveOrderStockLines) - a dispatcher
// holds a kit as one directly-trackable SKU, not its components. `reason`/
// `note` are accepted for interface parity with the factory reserve/
// release pair but aren't persisted anywhere: DispatcherStockMovement is
// scoped to on-hand-quantity changes only (see its header comment), and a
// reservation never changes on-hand quantity - only consumeDispatcherStock
// ForOrder's real DISPATCH_OUT decrement does, and that's already logged.
export async function reserveDispatcherStockForOrder({
  order,
  actorUser,
  reason = "Order verified and reserved for dispatcher fulfillment",
  note = "",
  session = null,
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const dispatcherId = order.dispatcherId;
  if (!dispatcherId) throw new ApiError(400, "Order has no dispatcher assigned");

  const currentStatus = reservationStatus(order);
  if (currentStatus === STOCK_RESERVATION_STATUS.RESERVED) return order;
  if (currentStatus === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Stock reservation has already been consumed");
  }

  const check = await checkDispatcherOrderStock({ dispatcherId, order });
  if (!check.ok) {
    order.stockCheck = { checkedAt: check.checkedAt, items: check.items };
    await order.save({ session });
    throw new ApiError(400, `Cannot verify. ${stockBlockerMessage(check.items)}`, { items: check.items });
  }

  const aggregated = new Map();
  for (const item of check.items) {
    if (!item.matched) continue;
    const key = String(item.productId);
    const existing = aggregated.get(key) || { productId: item.productId, sku: item.sku, name: item.name, quantity: 0 };
    existing.quantity += item.requestedQuantity;
    aggregated.set(key, existing);
  }

  return withStockSession(session, async (txnSession) => {
    const reservationItems = [];
    for (const { productId, sku, name, quantity } of aggregated.values()) {
      const before = await DispatcherProductStock.findOne({ dispatcherId, productId }).session(txnSession);
      const previousReservedQuantity = Number(before?.reservedQuantity || 0);

      const updated = await DispatcherProductStock.findOneAndUpdate(
        {
          dispatcherId,
          productId,
          $expr: {
            $gte: [
              { $subtract: [{ $ifNull: ["$currentQuantity", 0] }, { $ifNull: ["$reservedQuantity", 0] }] },
              quantity,
            ],
          },
        },
        {
          $inc: { reservedQuantity: quantity },
          $set: { lastUpdatedAt: new Date(), lastUpdatedBy: actorId(actorUser) },
        },
        { new: true, session: txnSession },
      );

      if (!updated) {
        throw new ApiError(
          409,
          `Dispatcher stock for ${name || sku || "an item"} changed before the reservation could complete. Please retry.`,
        );
      }

      reservationItems.push(
        serializeReservationItem({
          productId,
          sku,
          name,
          quantity,
          previousReservedQuantity,
          newReservedQuantity: updated.reservedQuantity,
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
    order.stockCheck = { checkedAt: check.checkedAt, items: check.items };
    await order.save({ session: txnSession });
    return order;
  });
}

// Releases a dispatcher stock reservation without ever going negative -
// mirrors releaseReservationForOrder's clamped aggregation-pipeline update
// exactly (see stock.service.js). Idempotent: a no-op if nothing was ever
// reserved or it was already released; throws if it was already consumed
// (that stock is physically gone, not releasable).
export async function releaseDispatcherStockForOrder({
  order,
  actorUser,
  reason = "Order reservation released",
  note = "",
  session = null,
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const currentStatus = reservationStatus(order);
  if (currentStatus === STOCK_RESERVATION_STATUS.NONE || currentStatus === STOCK_RESERVATION_STATUS.RELEASED) {
    return order;
  }
  if (currentStatus === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Consumed stock cannot be released automatically");
  }

  const dispatcherId = order.dispatcherId;
  const items = order.stockReservation?.items || [];

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const releaseQuantity = Number(item.quantity || 0);
      if (releaseQuantity <= 0 || !item.productId) continue;

      await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId: item.productId },
        [
          {
            $set: {
              reservedQuantity: {
                $max: [0, { $subtract: [{ $ifNull: ["$reservedQuantity", 0] }, releaseQuantity] }],
              },
              lastUpdatedAt: new Date(),
              lastUpdatedBy: actorId(actorUser),
            },
          },
        ],
        { new: true, session: txnSession, updatePipeline: true },
      );
    }

    order.stockReservation = {
      ...(order.stockReservation?.toObject?.() || order.stockReservation || {}),
      status: STOCK_RESERVATION_STATUS.RELEASED,
      releasedAt: new Date(),
      releasedBy: actorId(actorUser),
    };
    await order.save({ session: txnSession });
    return order;
  });
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
  movementType = DISPATCHER_STOCK_MOVEMENT_TYPE.REPLENISHMENT_IN,
  actorUser,
  session = null,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  // A scheme grant is recorded but not stocked: the history row proves the
  // goods arrived, while currentQuantity stays put so those units can never
  // be dispatched to a dealer or counted as sellable regional stock. Same
  // rule the dealer side already follows for scheme goods.
  const isLedgerOnly = movementType === DISPATCHER_STOCK_MOVEMENT_TYPE.SCHEME;

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      const updated = await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId },
        {
          ...(isLedgerOnly ? {} : { $inc: { currentQuantity: quantity } }),
          $set: {
            lastUpdatedAt: new Date(),
            lastUpdatedBy: actorId(actorUser),
          },
        },
        {
          // A ledger-only row still needs a stock document to hang the
          // before/after balance off, so upsert stays on - it just gets
          // created at quantity 0 rather than at `quantity`.
          upsert: true,
          new: true,
          session: txnSession,
          setDefaultsOnInsert: true,
        },
      );

      await DispatcherStockMovement.create(
        [
          {
            dispatcherId,
            productId,
            type: movementType,
            quantity,
            // Balance is unchanged for a ledger-only row, so both sides
            // report the same figure rather than implying a movement.
            previousQuantity: isLedgerOnly
              ? updated.currentQuantity
              : updated.currentQuantity - quantity,
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

// Decrements a dispatcher's on-hand stock for each line item at actual
// dispatch time, consuming the reservation created at verify (both
// currentQuantity and reservedQuantity move together) - mirrors
// consumeReservationForOrder's dual-decrement pattern in stock.service.js.
// Falls back to a fresh check-and-deduct (currentQuantity only) for orders
// that reached VERIFIED before reservation-at-verify existed, same as the
// factory side's fallbackWithoutReservation path. Still atomically guarded
// either way, so two concurrent dispatches can't oversell. Also writes the
// compensating DispatcherStockMovement row per item, same transaction.
export async function consumeDispatcherStockForOrder({
  order,
  reason = "Order dispatched to dealer",
  actorUser,
  session = null,
} = {}) {
  if (!order?._id) throw new ApiError(400, "Order is required");
  const dispatcherId = order.dispatcherId;
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  if (order.stockDeduction?.deductedAt || reservationStatus(order) === STOCK_RESERVATION_STATUS.CONSUMED) {
    throw new ApiError(400, "Stock has already been deducted for this order");
  }

  let sourceItems = order.stockReservation?.items || [];
  let fallbackWithoutReservation = false;

  if (reservationStatus(order) !== STOCK_RESERVATION_STATUS.RESERVED) {
    const check = await checkDispatcherOrderStock({ dispatcherId, order });
    if (!check.ok) {
      throw new ApiError(400, `Cannot dispatch. ${stockBlockerMessage(check.items)}`, { items: check.items });
    }
    sourceItems = check.items
      .filter((item) => item.matched)
      .map((item) => ({ productId: item.productId, sku: item.sku, name: item.name, quantity: item.requestedQuantity }));
    fallbackWithoutReservation = true;
  }

  return withStockSession(session, async (txnSession) => {
    const deductionLines = [];

    for (const item of sourceItems) {
      const productId = item.productId;
      const quantity = Number(item.quantity || 0);
      if (!productId || quantity <= 0) continue;

      const exprConditions = [{ $gte: [{ $ifNull: ["$currentQuantity", 0] }, quantity] }];
      const decrement = { currentQuantity: -quantity };
      if (!fallbackWithoutReservation) {
        exprConditions.push({ $gte: [{ $ifNull: ["$reservedQuantity", 0] }, quantity] });
        decrement.reservedQuantity = -quantity;
      }

      const updated = await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId, $expr: { $and: exprConditions } },
        {
          $inc: decrement,
          $set: { lastUpdatedAt: new Date(), lastUpdatedBy: actorId(actorUser) },
        },
        { new: true, session: txnSession },
      );

      if (!updated) {
        const existing = await DispatcherProductStock.findOne({ dispatcherId, productId }).session(txnSession);
        const available = Number(existing?.currentQuantity || 0);
        throw new ApiError(
          400,
          `Insufficient dispatcher stock for ${item.name || item.sku || "item"}. Available ${available}, requested ${quantity}.`,
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
            orderId: order._id,
            actorUserId: actorId(actorUser),
            actorRole: "DISPATCHER",
          },
        ],
        { session: txnSession },
      );

      deductionLines.push({
        productId,
        sku: item.sku || "",
        name: item.name || "",
        previousQuantity: updated.currentQuantity + quantity,
        deductedQuantity: quantity,
        newQuantity: updated.currentQuantity,
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
    await order.save({ session: txnSession });
    return deductionLines;
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
      const reservedQuantity = Number(row.reservedQuantity || 0);
      const availableQuantity = Math.max(0, currentQuantity - reservedQuantity);
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
        reservedQuantity,
        availableQuantity,
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
