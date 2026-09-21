// Scheme orders: free-of-cost goods an admin grants to a dealer or
// dispatcher for hitting a fiscal-year volume target. They reuse the
// normal order pipeline end to end, with four deliberate differences
// (all agreed with the business, see ORDER_ORIGIN.SCHEME in
// Order.model.js):
//
//   1. Always factory-fulfilled, even when the recipient dealer is
//      normally served by a dispatcher - so `dispatcherId` stays null and
//      the factory queue owns it.
//   2. Every line is zero-value; excluded from revenue/AR like
//      DISPATCHER_REPLENISHMENT.
//   3. Created already VERIFIED - the admin creating it IS the approval -
//      with factory stock reserved at creation.
//   4. Creation is BLOCKED if factory stock can't cover it, rather than
//      promising goods that don't exist.
//   5. On delivery the goods DO enter the recipient's sellable inventory,
//      exactly like a paid order's stock - factory stock is consumed, and
//      currentQuantity goes up by the same amount a PURCHASE would. The
//      only difference is a SCHEME-typed row instead of PURCHASE, purely
//      so stock history says where the units came from and so "Purchase"
//      volume (a commercial figure) never counts a free grant as buying
//      power - see applyMovement's isScheme branch in
//      dealerInventory.service.js and its dispatcher-side mirror,
//      creditDispatcherStock in dispatcherStock.service.js.
import mongoose from "mongoose";
import Order, { ORDER_ORIGIN, ORDER_STATUS } from "../models/Order.model.js";
import Product from "../models/Product.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import ApiError from "../utils/apiError.js";
import { generateUniqueOrderNumber } from "./order.service.js";
import { notifySchemeOrderCreated } from "./schemeOrderNotification.service.js";
import {
  reserveStockForOrder,
  releaseReservationForOrder,
  adjustReservationForOrderAmendment,
} from "./stock.service.js";

function objectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

function text(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

// Resolves the recipient and snapshots them the same way a normal order
// snapshots its dealer, so every existing dealer-facing email, PDF and
// list rendering keeps working unchanged for scheme orders.
async function resolveRecipient({ recipientType, recipientId }) {
  if (recipientType === "DISPATCHER") {
    const dispatcher = await Dispatcher.findById(objectId(recipientId, "recipientId"))
      .select("companyName contactName email phone address panVat")
      .lean();
    if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

    return {
      dispatcherCustomerId: dispatcher._id,
      dealerId: null,
      snapshot: {
        companyName: dispatcher.companyName || "",
        contactName: dispatcher.contactName || "",
        email: dispatcher.email || "",
        phone: dispatcher.phone || "",
        address: dispatcher.address || "",
        panVat: dispatcher.panVat || "",
        // Schemes ship from the factory regardless of the recipient's own
        // routing - this is what keeps them out of dispatcher-fulfilled
        // logic everywhere downstream.
        fulfillmentMode: "FACTORY",
      },
      name: dispatcher.companyName || dispatcher.contactName || "Dispatcher",
    };
  }

  const dealer = await DealerProfile.findById(objectId(recipientId, "recipientId"))
    .select("companyName contactName email phone address panVat fulfillmentMode status")
    .lean();
  if (!dealer) throw new ApiError(404, "Dealer not found");

  return {
    dealerId: dealer._id,
    dispatcherCustomerId: null,
    snapshot: {
      companyName: dealer.companyName || "",
      contactName: dealer.contactName || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address: dealer.address || "",
      panVat: dealer.panVat || "",
      // Deliberately FACTORY even for a dispatcher-served dealer.
      fulfillmentMode: "FACTORY",
    },
    name: dealer.companyName || dealer.contactName || "Dealer",
    // Kept for reporting/visibility: the dispatcher who normally serves
    // this dealer can see the scheme that bypassed them.
    servedByDispatcherId: dealer.fulfillmentMode === "DISPATCHER" ? dealer.dispatcherId || null : null,
  };
}

// Zero-value order lines built from the live catalog. Prices are forced
// to 0 rather than copied - a scheme is free by definition, and reading a
// price here would let a catalog change turn a past giveaway into a bill.
//
// `checkStock` is off for edits. On an edit the order's OWN units are already
// counted in every product's reservedQuantity, so re-running this check would
// see the scheme competing with itself and reject an unchanged quantity.
// adjustReservationForOrderAmendment does the correct delta-based check in
// that case - and unlike this one it expands kits into their components, so
// it is the more accurate authority anyway.
async function buildSchemeItems(rawItems, { checkStock = true } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "At least one product is required");
  }

  const ids = rawItems.map((item) => objectId(item.productId, "productId"));
  const products = await Product.find({ _id: { $in: ids } })
    .select("sku name category pack uom stock code")
    .lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const items = [];
  const shortfalls = [];

  for (const raw of rawItems) {
    const product = byId.get(String(raw.productId));
    if (!product) throw new ApiError(404, `Product not found: ${raw.productId}`);

    const quantity = Math.trunc(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Invalid quantity for ${product.name}`);
    }

    // Blocking check, per the agreed rule: never promise goods that
    // aren't in factory stock. Reserved units are already spoken for, so
    // availability is current minus reserved.
    const onHand = Number(product.stock?.currentQuantity || 0);
    const reserved = Number(product.stock?.reservedQuantity || 0);
    const available = Math.max(0, onHand - reserved);
    if (checkStock && quantity > available) {
      shortfalls.push({
        productId: String(product._id),
        name: product.name,
        sku: product.sku,
        requested: quantity,
        available,
      });
    }

    // These are the OrderItem schema's real field names. This used to also
    // write skuSnapshot/nameSnapshot/categorySnapshot/packSnapshot, which
    // don't exist on the subschema - Mongoose dropped all four silently, so
    // every scheme order was stored with no pack size at all and the edit
    // form had nothing to show. Kept in step with how dispatcher.service.js
    // builds its own order lines.
    items.push({
      productId: product._id,
      sku: product.sku,
      name: product.name,
      category: product.category || "",
      packLabel: product.pack?.label || "",
      unit: product.uom?.base || product.pack?.unit || "PCS",
      quantity,
      unitPrice: 0,
      lineTotal: 0,
    });
  }

  if (shortfalls.length) {
    throw new ApiError(400, "Not enough factory stock for this scheme", {
      code: "SCHEME_STOCK_SHORTFALL",
      shortfalls,
    });
  }

  return items;
}

export async function createSchemeOrder(payload = {}, actorUser = null) {
  const recipientType = String(payload.recipientType || "").toUpperCase();
  if (!["DEALER", "DISPATCHER"].includes(recipientType)) {
    throw new ApiError(400, "recipientType must be DEALER or DISPATCHER");
  }

  const recipient = await resolveRecipient({
    recipientType,
    recipientId: payload.recipientId,
  });
  const items = await buildSchemeItems(payload.items);
  const orderNumber = await generateUniqueOrderNumber();
  const actorId = actorUser?._id || actorUser?.id || null;
  const note = text(payload.note, 500);

  const order = await Order.create({
    orderNumber,
    orderOrigin: ORDER_ORIGIN.SCHEME,
    dealerId: recipient.dealerId,
    dispatcherCustomerId: recipient.dispatcherCustomerId,
    // Null on purpose: schemes never route through a dispatcher.
    dispatcherId: null,
    dealerSnapshot: recipient.snapshot,
    items,
    totals: { subtotal: 0, total: 0, currency: "NPR" },
    // Admin creating it is the approval, so it enters at VERIFIED and
    // lands straight in the factory queue.
    status: ORDER_STATUS.VERIFIED,
    reviewedAt: new Date(),
    reviewedByRole: "ADMIN",
    reviewedByUserId: actorId,
    submittedByUserId: actorId,
    // The admin's note is stored as the order's dealerNote too - that's the
    // field every order summary, detail page and PDF already prints, so the
    // note shows up "like any other order's note" with no per-surface work.
    // scheme.note stays as the scheme-scoped copy.
    dealerNote: note,
    scheme: {
      label: text(payload.label, 120),
      note,
      createdBy: actorId,
    },
  });

  // Same reservation path a normal admin verification uses, so the
  // factory sees reserved stock exactly as it would for any verified
  // order.
  //
  // The order is created before the reservation (reserveStockForOrder
  // needs a persisted order), so a reservation failure would otherwise
  // leave a VERIFIED scheme order sitting in the factory queue against
  // stock nobody reserved. Roll the order back rather than leave that
  // orphan behind.
  try {
    await reserveStockForOrder({
      order,
      actorUser,
      reason: `Scheme order reserved${payload.label ? `: ${text(payload.label, 60)}` : ""}`,
    });
  } catch (error) {
    await Order.deleteOne({ _id: order._id });
    throw error;
  }

  // Factory told what to ship, recipient told what's coming and where to
  // track it. Fire-and-forget: the scheme already exists and holds its
  // stock, so a slow or failing mailbox must never delay or undo it (the
  // notifier itself never rejects).
  notifySchemeOrderCreated(order, {
    recipientKind:
      recipientType === "DISPATCHER"
        ? "DISPATCHER"
        : recipient.servedByDispatcherId
          ? "DEALER_VIA_DISPATCHER"
          : "DEALER",
  });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    recipient: recipient.name,
    itemCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

// A scheme can only be changed or withdrawn while it is still sitting in the
// factory's Inbox. Once it is DISPATCHED the goods have physically left the
// building and the reservation has been consumed - at that point the only
// honest correction is a return workflow, not an edit. REJECTED/CANCELLED are
// allowed through so a dead scheme can still be tidied away; they hold no
// live reservation, and releaseReservationForOrder is a no-op for them.
const SCHEME_EDITABLE_STATUSES = [ORDER_STATUS.VERIFIED];
const SCHEME_DELETABLE_STATUSES = [
  // SUBMITTED never happens for a scheme by design; it only exists on ones that
  // were sent back to review before "undo verification" was blocked for
  // schemes. Deleting is the way out for those, and they hold no stock.
  ORDER_STATUS.SUBMITTED,
  ORDER_STATUS.VERIFIED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELLED,
];

async function loadSchemeOrder(orderId, { session = null } = {}) {
  const order = await Order.findOne({
    _id: objectId(orderId, "orderId"),
    isDeleted: { $ne: true },
  }).session(session);
  if (!order) throw new ApiError(404, "Scheme order not found");
  if (order.orderOrigin !== ORDER_ORIGIN.SCHEME) {
    // Guards the whole feature: these endpoints skip the review/approval
    // machinery that real orders go through, so they must never be able to
    // reach one.
    throw new ApiError(400, "This order is not a scheme order");
  }
  return order;
}

// Edits a scheme that the factory hasn't shipped yet: quantities, which
// products are on it, and the campaign label/note. The recipient is
// deliberately NOT editable - re-pointing a scheme at a different dealer is a
// different grant, and the honest way to do it is to delete this one and
// create that one, so the two show up as two decisions in the register.
const MAX_CHANGE_PARTS = 4;

function itemLabel(item) {
  const pack = item?.packLabel ? ` (${item.packLabel})` : "";
  return `${item?.name || item?.sku || "Product"}${pack}`;
}

// A short, human sentence per real change, for the order's activity history.
// Empty when nothing actually changed, so re-saving an untouched scheme
// doesn't leave a meaningless "updated" row behind.
export function describeSchemeChanges(before, after) {
  const parts = [];

  if (before.label !== after.label) {
    if (!after.label) parts.push(`name "${before.label}" removed`);
    else if (!before.label) parts.push(`name set to "${after.label}"`);
    else parts.push(`name "${before.label}" → "${after.label}"`);
  }
  if (before.note !== after.note) {
    parts.push(!after.note ? "note removed" : before.note ? "note edited" : "note added");
  }

  const beforeById = new Map(before.items.map((item) => [String(item.productId), item]));
  const afterById = new Map(after.items.map((item) => [String(item.productId), item]));
  for (const [id, item] of afterById) {
    const previous = beforeById.get(id);
    if (!previous) parts.push(`added ${itemLabel(item)} × ${item.quantity}`);
    else if (Number(previous.quantity) !== Number(item.quantity)) {
      parts.push(`${itemLabel(item)} ${previous.quantity} → ${item.quantity}`);
    }
  }
  for (const [id, item] of beforeById) {
    if (!afterById.has(id)) parts.push(`removed ${itemLabel(item)}`);
  }

  if (parts.length <= MAX_CHANGE_PARTS) return parts.join("; ");
  return `${parts.slice(0, MAX_CHANGE_PARTS).join("; ")}; +${parts.length - MAX_CHANGE_PARTS} more`;
}

export async function updateSchemeOrder(orderId, payload = {}, actorUser = null) {
  // Resolving the new lines only reads the catalogue, so it stays outside the
  // transaction below.
  const hasItems = Array.isArray(payload.items);
  const nextItems = hasItems ? await buildSchemeItems(payload.items, { checkStock: false }) : null;

  // The status check, the reservation change and the order write all happen in
  // ONE transaction. The factory can dispatch this same scheme at any moment;
  // with these as separate steps, an edit could land after the dispatch had
  // already taken stock, leaving the order listing items that never shipped.
  // Inside a transaction the two collide on the order document: whichever
  // commits second is retried against the other's result - an edit sees
  // "already dispatched" and is refused, a dispatch sees the edited
  // reservation and ships exactly that. The callback is re-run on retry, so it
  // reloads the order every time instead of holding one from before.
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await loadSchemeOrder(orderId, { session });

      if (!SCHEME_EDITABLE_STATUSES.includes(order.status)) {
        throw new ApiError(
          400,
          `This scheme has already been ${order.status.toLowerCase()} and can no longer be edited. Only schemes still waiting in the factory's queue can be changed.`,
        );
      }

      const snapshotItems = () =>
        (order.items || []).map((item) => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          packLabel: item.packLabel,
          quantity: item.quantity,
        }));

      const previousItems = (order.items || []).map((item) => ({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
      }));
      // Snapshot for the activity history - taken before anything is mutated.
      const before = {
        label: order.scheme?.label || "",
        note: order.scheme?.note || "",
        items: snapshotItems(),
      };

      if (hasItems) {
        // Reservation first: it is the step that can fail on insufficient stock,
        // and letting it throw before the order's own fields are touched keeps
        // a rejected edit from leaving the order and the reservation disagreeing.
        await adjustReservationForOrderAmendment({
          order,
          previousItems,
          nextItems,
          actorUser,
          reason: `Scheme order amended${order.scheme?.label ? `: ${order.scheme.label}` : ""}`,
          session,
        });
        order.items = nextItems;
        order.totals = { subtotal: 0, total: 0, currency: "NPR" };
      }

      if (payload.label !== undefined) order.scheme.label = text(payload.label, 120);
      if (payload.note !== undefined) {
        const note = text(payload.note, 500);
        order.scheme.note = note;
        order.dealerNote = note;
      }

      order.scheme.updatedBy = actorUser?._id || actorUser?.id || null;
      order.scheme.updatedAt = new Date();

      // Recorded on the order's Activity history (the same list a normal amend
      // writes to), so an edit made after verification stays visible to
      // everyone who can see the order instead of silently overwriting it.
      const changeSummary = describeSchemeChanges(before, {
        label: order.scheme?.label || "",
        note: order.scheme?.note || "",
        items: snapshotItems(),
      });
      const actorId = actorUser?._id || actorUser?.id;
      if (changeSummary && actorId) {
        order.amendments.push({
          kind: "SCHEME_UPDATE",
          amendedByUserId: actorId,
          amendedByRole: String(actorUser?.role || "ADMIN").toUpperCase(),
          reason: changeSummary,
          amendedAt: new Date(),
        });
      }

      await order.save({ session });

      result = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        totalUnits: order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      };
    });
  } finally {
    session.endSession();
  }

  return result;
}

// Withdraws a scheme entirely. Soft-delete rather than a hard removal so the
// decision stays auditable, and rather than the shared 30-day "pending
// deletion" grace period other records use: a scheme holds factory stock the
// whole time it exists, so parking it in a queue would keep those units
// unavailable for a month over what is usually a typo.
export async function deleteSchemeOrder(orderId, actorUser = null, { reason = "" } = {}) {
  // Same reasoning as updateSchemeOrder: the status check, the stock release
  // and the "deleted" flag are one transaction, so a scheme the factory
  // dispatches in the same instant is either withdrawn cleanly or refused -
  // never released-and-shipped.
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await loadSchemeOrder(orderId, { session });

      if (!SCHEME_DELETABLE_STATUSES.includes(order.status)) {
        throw new ApiError(
          400,
          `This scheme has already been ${order.status.toLowerCase()} and can no longer be deleted. Goods that have left the factory need a return, not a deletion.`,
        );
      }

      // Release before flagging deleted, so a failure here leaves the order
      // visible and holding its stock rather than hidden and holding it forever.
      await releaseReservationForOrder({
        order,
        actorUser,
        reason: `Scheme order deleted${order.scheme?.label ? `: ${order.scheme.label}` : ""}`,
        note: text(reason, 500),
        session,
      });

      order.isDeleted = true;
      order.deletion = {
        ...(order.deletion?.toObject?.() || order.deletion || {}),
        pending: false,
        requestedAt: new Date(),
        requestedByUserId: actorUser?._id || actorUser?.id || null,
        reason: text(reason, 500) || "Scheme withdrawn by admin",
      };
      await order.save({ session });

      result = { orderId: order._id, orderNumber: order.orderNumber, deleted: true };
    });
  } finally {
    session.endSession();
  }

  return result;
}

// Recipient picker for the create form: every verified dealer plus every
// dispatcher. Unlike payments, dispatcher-served dealers ARE eligible -
// the factory ships their scheme directly.
export async function listSchemeRecipients() {
  const [dealers, dispatchers] = await Promise.all([
    DealerProfile.find({ status: { $ne: "SUSPENDED" } })
      .select("companyName contactName fulfillmentMode")
      .sort({ companyName: 1 })
      .lean(),
    Dispatcher.find({}).select("companyName contactName").sort({ companyName: 1 }).lean(),
  ]);

  return [
    ...dealers.map((dealer) => ({
      key: `DEALER:${dealer._id}`,
      recipientType: "DEALER",
      recipientId: String(dealer._id),
      name: dealer.companyName || dealer.contactName || "Dealer",
      // Surfaced purely so the picker can match on it - admins hunt for a
      // dealer by the person they deal with as often as by the trading name.
      contactName: dealer.contactName || "",
      servedBy: dealer.fulfillmentMode === "DISPATCHER" ? "Dispatcher-served" : "Factory",
    })),
    ...dispatchers.map((dispatcher) => ({
      key: `DISPATCHER:${dispatcher._id}`,
      recipientType: "DISPATCHER",
      recipientId: String(dispatcher._id),
      name: dispatcher.companyName || dispatcher.contactName || "Dispatcher",
      contactName: dispatcher.contactName || "",
      servedBy: "Dispatcher",
    })),
  ];
}

export async function listSchemeOrders(filters = {}) {
  const query = { orderOrigin: ORDER_ORIGIN.SCHEME, isDeleted: { $ne: true } };
  if (filters.status) query.status = String(filters.status).toUpperCase();

  const rows = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, Number(filters.limit) || 100)))
    .select("orderNumber status createdAt items scheme dealerSnapshot dealerId dispatcherCustomerId")
    .lean();

  return rows.map((row) => ({
    _id: String(row._id),
    orderNumber: row.orderNumber,
    status: row.status,
    createdAt: row.createdAt,
    recipient: row.dealerSnapshot?.companyName || "Unknown",
    recipientType: row.dispatcherCustomerId ? "DISPATCHER" : "DEALER",
    label: row.scheme?.label || "",
    note: row.scheme?.note || "",
    itemCount: (row.items || []).length,
    totalUnits: (row.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  }));
}
