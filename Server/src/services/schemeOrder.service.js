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
//   5. On delivery the goods do NOT enter the recipient's sellable
//      inventory. Factory stock is still consumed (they physically
//      leave), and a SCHEME row is written to the dealer's stock history
//      for the record, but currentQuantity and totalReceivedQuantity are
//      untouched - scheme goods are handled outside the app and cannot
//      be sold through the Sales Register. See applyMovement's
//      isLedgerOnly branch in dealerInventory.service.js.
import mongoose from "mongoose";
import Order, { ORDER_ORIGIN, ORDER_STATUS } from "../models/Order.model.js";
import Product from "../models/Product.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import ApiError from "../utils/apiError.js";
import { generateUniqueOrderNumber } from "./order.service.js";
import { reserveStockForOrder } from "./stock.service.js";

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
async function buildSchemeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "At least one product is required");
  }

  const ids = rawItems.map((item) => objectId(item.productId, "productId"));
  const products = await Product.find({ _id: { $in: ids } })
    .select("sku name category pack stock code")
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
    if (quantity > available) {
      shortfalls.push({
        productId: String(product._id),
        name: product.name,
        sku: product.sku,
        requested: quantity,
        available,
      });
    }

    items.push({
      productId: product._id,
      sku: product.sku,
      skuSnapshot: product.sku,
      name: product.name,
      nameSnapshot: product.name,
      categorySnapshot: product.category || "",
      packSnapshot: product.pack?.label || "",
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
    scheme: {
      label: text(payload.label, 120),
      note: text(payload.note, 500),
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

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    recipient: recipient.name,
    itemCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
  };
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
      servedBy: dealer.fulfillmentMode === "DISPATCHER" ? "Dispatcher-served" : "Factory",
    })),
    ...dispatchers.map((dispatcher) => ({
      key: `DISPATCHER:${dispatcher._id}`,
      recipientType: "DISPATCHER",
      recipientId: String(dispatcher._id),
      name: dispatcher.companyName || dispatcher.contactName || "Dispatcher",
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
