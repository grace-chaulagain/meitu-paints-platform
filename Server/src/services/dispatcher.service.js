import mongoose from "mongoose";

import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import Dealer from "../models/DealerProfile.model.js";
import Order, { ORDER_ORIGIN } from "../models/Order.model.js";
import Product from "../models/Product.model.js";
import User from "../models/User.model.js";
import DispatcherProductPrice from "../models/DispatcherProductPrice.model.js";
import { listMyReplenishmentCatalog as fetchMyReplenishmentCatalog } from "./dispatcherPricing.service.js";
import ApiError from "../utils/apiError.js";
import { buildOrderConflictError, buildOrderConflictErrorFresh } from "../utils/orderConflictError.js";
import {
  notifyDispatcherApplicationSubmitted,
  notifyFactoryOrderSubmitted,
} from "./adminNotification.service.js";
import { archiveVerifiedOrderToGoogleSheets } from "./googleSheetsArchive.service.js";
import { sendDealerStatusEmail } from "./factory.service.js";
import { generateUniqueOrderNumber } from "./order.service.js";
import { sendMail, renderEmailShell } from "../utils/email.js";
import {
  checkDispatcherOrderStock,
  consumeDispatcherStockForOrder,
  reserveDispatcherStockForOrder,
  listDispatcherStock,
  listDispatcherStockHistory,
} from "./dispatcherStock.service.js";
import { recordPurchaseMovement } from "./dealerInventory.service.js";

function normalizeEmail(email = "") {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeStatus(status = "") {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  if (s === "ARCHIVE") return "ARCHIVED";
  return s;
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function ensureDispatcherId(user = {}) {
  const dispatcherId =
    user?.dispatcherId || user?.dispatcher?._id || user?.dispatcher?.id || null;

  if (!dispatcherId) {
    throw new Error("Dispatcher identity missing from session");
  }

  return String(dispatcherId);
}

async function getVerifiedActiveDispatcher(dispatcherId) {
  const dispatcher = await Dispatcher.findById(dispatcherId);

  if (!dispatcher) {
    throw new Error("Dispatcher not found");
  }

  if (
    dispatcher.status !== DISPATCHER_STATUS.VERIFIED ||
    !dispatcher.isActive
  ) {
    throw new Error("Dispatcher account is not active");
  }

  return dispatcher;
}

async function getAssignedOrderOrThrow({ dispatcherId, orderId }) {
  if (!orderId) {
    throw new Error("Order id is required");
  }

  const order = await Order.findOne({
    _id: orderId,
    dispatcherId,
    isDeleted: { $ne: true },
  });

  if (!order) {
    throw new Error("Assigned order not found");
  }

  return order;
}

function buildAmendedOrderItems(items = []) {
  return items.map((item) => {
    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const unitPrice = Number(item.unitPrice ?? item.rate ?? 0);
    const lineTotal = Number(
      item.lineTotal ?? item.amount ?? quantity * unitPrice,
    );

    return {
      sku: normalizeText(item.sku || item.skuSnapshot || item.code),
      name: normalizeText(item.name || item.nameSnapshot),
      unit: normalizeText(
        item.unit || item.packLabel || item.variantLabel || item.uom,
      ),
      qty: quantity,
      rate: unitPrice,
      amount: lineTotal,
      quantity,
      unitPrice,
      lineTotal,
      packLabel: normalizeText(
        item.packLabel || item.variantLabel || item.unit || item.uom,
      ),
    };
  });
}

function buildOrderSearchQuery(search = "") {
  const q = normalizeText(search);
  if (!q) return null;

  return {
    $or: [
      { orderNumber: { $regex: q, $options: "i" } },
      { "payment.method": { $regex: q, $options: "i" } },
      { "payment.reference": { $regex: q, $options: "i" } },
      { "payment.referenceNo": { $regex: q, $options: "i" } },
      { dealerNote: { $regex: q, $options: "i" } },
      { internalNote: { $regex: q, $options: "i" } },
    ],
  };
}

function buildDealerSearchQuery(search = "") {
  const q = normalizeText(search);
  if (!q) return null;

  return {
    $or: [
      { companyName: { $regex: q, $options: "i" } },
      { contactName: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
      { address: { $regex: q, $options: "i" } },
      { panVat: { $regex: q, $options: "i" } },
    ],
  };
}

/* ---------------------------------------
   Public Dispatcher Application
---------------------------------------- */

// Dispatcher applications have no email-confirmation-link step (unlike
// dealer applications) - this is purely an informational "we got it"
// receipt, sent best-effort so a delivery hiccup never blocks the
// application itself from being created (see the fire-and-forget .catch
// at the call site, matching notifyDispatcherApplicationSubmitted below).
function dispatcherApplicationReceivedTemplate({ name, companyName }) {
  const subject = "We've received your Meitu Paints dispatcher application";
  const greetingName = name || companyName || "there";

  const text = [
    `Hello ${greetingName},`,
    "",
    `Thanks for applying to become a Meitu Paints dispatcher${companyName ? ` for ${companyName}` : ""}.`,
    "Our team is reviewing your application and will follow up by email once a decision has been made.",
    "",
    "If you didn't submit this application, you can safely ignore this email.",
  ].join("\n");

  const html = renderEmailShell({
    preheader: "We've received your Meitu Paints dispatcher application.",
    eyebrow: "Application Received",
    title: "We've Received Your Application",
    intro: `Hello ${greetingName}, thanks for applying to become a Meitu Paints dispatcher${companyName ? ` for ${companyName}` : ""}. Our team is reviewing your application and will follow up by email once a decision has been made.`,
  });

  return { subject, text, html };
}

async function sendDispatcherApplicationReceivedEmail(dispatcher) {
  const { subject, text, html } = dispatcherApplicationReceivedTemplate({
    name: dispatcher.name,
    companyName: dispatcher.companyName,
  });
  await sendMail({ to: dispatcher.email, subject, text, html });
}

export async function createDispatcherApplication(payload = {}) {
  const name = normalizeText(payload.name);
  const companyName = normalizeText(payload.companyName);
  const phone = normalizeText(payload.phone);
  const email = normalizeEmail(payload.email);
  const address = normalizeText(payload.address);
  const notes = normalizeText(payload.notes);

  if (!name) throw new ApiError(400, "Name is required");
  if (!companyName) throw new ApiError(400, "Company name is required");
  if (!phone) throw new ApiError(400, "Phone is required");
  if (!email) throw new ApiError(400, "Email is required");

  const existing = await Dispatcher.findOne({ email });
  if (existing) {
    throw new ApiError(409, "Dispatcher application with this email already exists");
  }

  // This email already belongs to a real account of any other role (dealer,
  // admin, factory) - the Dispatcher.findOne check above only catches an
  // existing/pending dispatcher record, not a collision with a different
  // role's account. Previously this was only ever discovered at admin
  // approval time (verifyDispatcherApplication's own User.findOne check).
  const existingUser = await User.findOne({ email }).select("_id").lean();
  if (existingUser) {
    throw new ApiError(
      409,
      "This email is already registered to an existing account. Please use a different email or sign in instead.",
    );
  }

  const dispatcher = await Dispatcher.create({
    name,
    companyName,
    phone,
    email,
    address,
    notes,
    status: DISPATCHER_STATUS.PENDING,
    isActive: false,
  });

  notifyDispatcherApplicationSubmitted(dispatcher).catch((error) => {
    console.warn("[admin-notification] dispatcher application:", error.message);
  });

  sendDispatcherApplicationReceivedEmail(dispatcher).catch((error) => {
    console.warn("[email] dispatcher application received:", error.message);
  });

  return dispatcher;
}

// Live pre-submit check for the registration form (on email-field blur) -
// deliberately scoped to just User, not Dispatcher, so it never blocks a
// legitimate resend/retry of the dispatcher application itself. The real
// source of truth is createDispatcherApplication's own checks above; this
// is only the pre-submit UX layer.
export async function checkDispatcherEmailAvailability(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new ApiError(400, "email is required");

  const existingUser = await User.findOne({ email }).select("_id").lean();
  return { available: !existingUser };
}

/* ---------------------------------------
   Admin Dispatcher Management
---------------------------------------- */

export async function getAllDispatchers({ status } = {}) {
  const query = {};

  if (status) {
    query.status = normalizeStatus(status);
  }

  return Dispatcher.find(query).sort({ createdAt: -1 });
}

export async function getPendingDispatchers() {
  return Dispatcher.find({ status: DISPATCHER_STATUS.PENDING }).sort({
    createdAt: -1,
  });
}

export async function getDispatcherById(dispatcherId) {
  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new Error("Dispatcher not found");
  return dispatcher;
}

export async function listVerifiedDispatchers() {
  return Dispatcher.find({
    status: DISPATCHER_STATUS.VERIFIED,
    isActive: true,
  }).sort({
    companyName: 1,
    name: 1,
  });
}

export async function deleteDispatcher(dispatcherId) {
  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new Error("Dispatcher not found");

  const linkedDealer = await Dealer.findOne({ dispatcherId: dispatcher._id });
  if (linkedDealer) {
    throw new Error(
      "Dispatcher is currently assigned to one or more dealers. Reassign or unassign first.",
    );
  }

  await dispatcher.deleteOne();
  return dispatcher;
}

/* ---------------------------------------
   Dispatcher Self Workspace
---------------------------------------- */

export async function getMyDispatcherProfile({ user } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  return getVerifiedActiveDispatcher(dispatcherId);
}

export async function listMyAssignedDealers({
  user,
  q,
  status,
  page = 1,
  limit = 20,
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const currentPage = toPositiveInt(page, 1);
  const perPage = Math.min(100, toPositiveInt(limit, 20));
  const skip = (currentPage - 1) * perPage;

  const query = {
    dispatcherId,
    fulfillmentMode: "DISPATCHER",
  };

  if (status) {
    query.status = normalizeStatus(status);
  }

  const searchQuery = buildDealerSearchQuery(q);
  if (searchQuery) {
    Object.assign(query, searchQuery);
  }

  const [items, total] = await Promise.all([
    Dealer.find(query)
      .sort({ companyName: 1, contactName: 1, createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Dealer.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: currentPage,
    limit: perPage,
  };
}

export async function getMyAssignedDealerById({ user, dealerId } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const dealer = await Dealer.findOne({
    _id: dealerId,
    dispatcherId,
    fulfillmentMode: "DISPATCHER",
  }).lean();

  if (!dealer) {
    throw new Error("Assigned dealer not found");
  }

  return dealer;
}

export async function listMyOrders({
  user,
  status,
  q,
  page = 1,
  limit = 20,
  archive = false,
  dealerId,
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const currentPage = toPositiveInt(page, 1);
  const perPage = Math.min(100, toPositiveInt(limit, 20));
  const skip = (currentPage - 1) * perPage;

  const query = { dispatcherId, isDeleted: { $ne: true } };

  if (dealerId) {
    query.dealerId = dealerId;
  }

  if (archive) {
    query.status = { $in: ["VERIFIED", "REJECTED", "DISPATCHED"] };
  } else if (status) {
    const statuses = String(status)
      .split(",")
      .map((value) => normalizeStatus(value))
      .filter(Boolean);
    query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  } else {
    query.status = "SUBMITTED";
  }

  const searchQuery = buildOrderSearchQuery(q);
  if (searchQuery) {
    Object.assign(query, searchQuery);
  }

  const [items, total] = await Promise.all([
    Order.find(query)
      .populate(
        "dealerId",
        "companyName contactName email phone address status",
      )
      .populate("dispatcherId", "name companyName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Order.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: currentPage,
    limit: perPage,
  };
}

export async function getMyOrderById({ user, orderId } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await Order.findOne({
    _id: orderId,
    dispatcherId,
    isDeleted: { $ne: true },
  })
    .populate("dealerId", "companyName contactName email phone address status")
    .populate("dispatcherId", "name companyName email phone")
    .lean();

  if (!order) {
    throw new Error("Assigned order not found");
  }

  return order;
}

export async function getMyOrderStockCheck({ user, orderId } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await Order.findOne({ _id: orderId, dispatcherId, isDeleted: { $ne: true } })
    .select("items")
    .lean();

  if (!order) {
    throw new Error("Assigned order not found");
  }

  return checkDispatcherOrderStock({ dispatcherId, order });
}

export async function getMyReplenishmentCatalog({ user, q } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  return fetchMyReplenishmentCatalog({ dispatcherId, q });
}

export async function listMyReplenishmentOrders({
  user,
  status,
  q,
  page = 1,
  limit = 20,
  archive = false,
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const currentPage = toPositiveInt(page, 1);
  const perPage = Math.min(100, toPositiveInt(limit, 20));
  const skip = (currentPage - 1) * perPage;

  // Both origins a dispatcher can be the CUSTOMER of: stock they bought, and
  // free-of-cost scheme grants addressed to them. Schemes to their dealers
  // are a different thing entirely and stay invisible here - those carry
  // `dispatcherId: null`, and every dispatcher-facing query in this file
  // scopes on `dispatcherId`, so a dealer's scheme is structurally out of
  // reach rather than merely filtered out.
  const query = {
    dispatcherCustomerId: dispatcherId,
    orderOrigin: {
      $in: [ORDER_ORIGIN.DISPATCHER_REPLENISHMENT, ORDER_ORIGIN.SCHEME],
    },
    isDeleted: { $ne: true },
  };

  if (archive) {
    query.status = { $in: ["COMPLETED", "REJECTED", "CANCELLED"] };
  } else if (normalizeStatus(status) === "ALL") {
    // No status filter at all - matches every status. Without this, there
    // was no way to actually see "all" orders: the default branch below
    // only ever returns the pending bucket, so an "All" tab that never
    // passes archive/status just silently re-filtered that same
    // incomplete pending-only dataset client-side.
  } else if (status) {
    const statuses = String(status)
      .split(",")
      .map((value) => normalizeStatus(value))
      .filter(Boolean);
    query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  } else {
    query.status = {
      $in: ["SUBMITTED", "VERIFIED", "DISPATCHED"],
    };
  }

  const searchQuery = buildOrderSearchQuery(q);
  if (searchQuery) {
    Object.assign(query, searchQuery);
  }

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Order.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: currentPage,
    limit: perPage,
  };
}

export async function getMyReplenishmentOrderById({ user, orderId } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await Order.findOne({
    _id: orderId,
    dispatcherCustomerId: dispatcherId,
    orderOrigin: {
      $in: [ORDER_ORIGIN.DISPATCHER_REPLENISHMENT, ORDER_ORIGIN.SCHEME],
    },
    isDeleted: { $ne: true },
  }).lean();

  if (!order) {
    throw new Error("Replenishment order not found");
  }

  return order;
}

export async function verifyAssignedOrder({
  user,
  orderId,
  payload = {},
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await getAssignedOrderOrThrow({ dispatcherId, orderId });

  if (normalizeStatus(order.status) !== "SUBMITTED") {
    throw buildOrderConflictError(order, { status: 400, message: "Only submitted orders can be verified" });
  }

  const reviewNote =
    normalizeText(payload.reviewNote) ||
    normalizeText(payload.note) ||
    normalizeText(payload.reason);
  const previousStatus = order.status;
  const actorId = user?.sub || user?.id || null;

  // The status transition and the dispatcher stock reservation share one
  // transaction: either both land, or neither does. This is what makes
  // insufficient dispatcher stock actually block verification rather than
  // silently letting a second, unfulfillable order also reach VERIFIED -
  // mirrors order.service.js's verifyOrder reserving central Product.stock
  // for factory orders. The findOneAndUpdate below is also what prevents
  // two concurrent verify/reject calls on the same order from both
  // succeeding (only matches if status is still SUBMITTED at write time).
  //
  // The dealer email is sent only after this transaction actually commits
  // (not before, like the old code did) - insufficient stock is now a
  // routine, expected failure here, and emailing "your order was verified"
  // for an order that just failed to verify would be actively wrong.
  let updated;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      updated = await Order.findOneAndUpdate(
        { _id: order._id, dispatcherId, status: "SUBMITTED" },
        {
          $set: {
            status: "VERIFIED",
            review: {
              ...(order.review?.toObject?.() || order.review || {}),
              reviewedByRole: "DISPATCHER",
              reviewedByUserId: actorId,
              reviewedAt: new Date(),
              reviewNote,
            },
            ...(payload.internalNote !== undefined
              ? { internalNote: normalizeText(payload.internalNote) }
              : {}),
            updatedBy: actorId,
          },
          $push: {
            statusHistory: {
              fromStatus: previousStatus || "",
              toStatus: "VERIFIED",
              note: reviewNote || "Order verified by dispatcher.",
              changedByUserId: actorId,
              changedByRole: "DISPATCHER",
              changedAt: new Date(),
            },
          },
        },
        { new: true, session },
      );

      if (!updated) {
        throw await buildOrderConflictErrorFresh(order._id, {
          message: "This order was already reviewed by someone else. Please refresh and try again.",
        });
      }

      await reserveDispatcherStockForOrder({
        order: updated,
        actorUser: user,
        reason: "Dispatcher verified and reserved stock for this order",
        note: reviewNote,
        session,
      });
    });
  } finally {
    session.endSession();
  }

  try {
    const dealerEmailSentAt = await sendDealerStatusEmail({
      order: updated,
      status: "VERIFIED",
    });
    if (dealerEmailSentAt) {
      const lastHistoryEntry = updated.statusHistory[updated.statusHistory.length - 1];
      if (lastHistoryEntry) lastHistoryEntry.dealerEmailSentAt = dealerEmailSentAt;
      await updated.save();
    }
  } catch (error) {
    console.warn(
      "[dispatcher-email] verified status email failed:",
      error.message,
    );
  }

  archiveVerifiedOrderToGoogleSheets(updated).catch((error) => {
    console.error("[google-sheets-archive] Failed to archive verified order", {
      orderId: String(updated._id),
      orderNumber: updated.orderNumber,
      message: error?.message,
    });
  });

  return updated;
}

export async function rejectAssignedOrder({
  user,
  orderId,
  payload = {},
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await getAssignedOrderOrThrow({ dispatcherId, orderId });

  if (normalizeStatus(order.status) !== "SUBMITTED") {
    throw buildOrderConflictError(order, { status: 400, message: "Only submitted orders can be rejected" });
  }

  const reviewNote =
    normalizeText(payload.reviewNote) ||
    normalizeText(payload.note) ||
    normalizeText(payload.reason);
  const previousStatus = order.status;
  const actorId = user?.sub || user?.id || null;

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, dispatcherId, status: "SUBMITTED" },
    {
      $set: {
        status: "REJECTED",
        review: {
          ...(order.review?.toObject?.() || order.review || {}),
          reviewedByRole: "DISPATCHER",
          reviewedByUserId: actorId,
          reviewedAt: new Date(),
          reviewNote,
        },
        ...(payload.internalNote !== undefined
          ? { internalNote: normalizeText(payload.internalNote) }
          : {}),
        updatedBy: actorId,
      },
      $push: {
        statusHistory: {
          fromStatus: previousStatus || "",
          toStatus: "REJECTED",
          note: reviewNote || "Order rejected by dispatcher.",
          changedByUserId: actorId,
          changedByRole: "DISPATCHER",
          changedAt: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!updated) {
    throw await buildOrderConflictErrorFresh(order._id, {
      message: "This order was already reviewed by someone else. Please refresh and try again.",
    });
  }

  return updated;
}

export async function amendAssignedOrder({ user, orderId, payload = {} } = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await getAssignedOrderOrThrow({ dispatcherId, orderId });

  if (normalizeStatus(order.status) !== "SUBMITTED") {
    throw new Error("Only submitted orders can be amended");
  }

  const nextItems = Array.isArray(payload.items) ? payload.items : [];
  if (!nextItems.length) {
    throw new Error("At least one order item is required");
  }

  const cleanItems = buildAmendedOrderItems(nextItems);

  const hasInvalidItem = cleanItems.some(
    (item) =>
      !item.name || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0,
  );

  if (hasInvalidItem) {
    throw new Error(
      "Every amended item must include a name, quantity greater than 0, and a valid rate",
    );
  }

  const subtotal = cleanItems.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0,
  );

  const incomingTotals =
    payload.totals && typeof payload.totals === "object" ? payload.totals : {};

  order.items = cleanItems;
  order.totals = {
    ...(order.totals || {}),
    ...(incomingTotals || {}),
    subtotal,
    taxableAmount: Number(incomingTotals.taxableAmount ?? subtotal),
    discount: Number(incomingTotals.discount ?? 0),
    tax: Number(incomingTotals.tax ?? 0),
    total: Number(incomingTotals.total ?? subtotal),
    currency: normalizeText(
      incomingTotals.currency || order?.totals?.currency || "NPR",
    ),
  };

  if (payload.dealerNote !== undefined) {
    order.dealerNote = normalizeText(payload.dealerNote);
  }

  if (payload.internalNote !== undefined) {
    order.internalNote = normalizeText(payload.internalNote);
  }

  const reviewNote =
    normalizeText(payload.reviewNote) ||
    normalizeText(payload.note) ||
    normalizeText(payload.reason);

  order.review = {
    ...(order.review || {}),
    reviewedByRole: "DISPATCHER",
    reviewedByDispatcherId: dispatcherId,
    reviewedAt: new Date(),
    reviewNote,
  };

  if ("updatedBy" in order) {
    order.updatedBy = user?.sub || null;
  }

  await order.save();
  return order;
}

export async function listMyOrderArchive({
  user,
  q,
  page = 1,
  limit = 20,
} = {}) {
  return listMyOrders({
    user,
    q,
    page,
    limit,
    archive: true,
  });
}

// ----------------------------
// Dispatcher's own replenishment ordering (from the central Factory)
// ----------------------------

export async function createDispatcherReplenishmentOrder({
  user,
  payload = {},
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  const dispatcher = await getVerifiedActiveDispatcher(dispatcherId);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw new Error("Order must contain at least one item.");
  }

  // sellable:false blocks a kit's own component products (factory-internal
  // stock, not directly orderable - see stock.service.js's
  // resolveOrderStockLines) from ever being ordered directly, even via a
  // crafted payload that bypasses the catalog UI.
  const productIds = items.map((item) => item.productId).filter(Boolean);
  const [products, priceRows] = await Promise.all([
    Product.find({
      _id: { $in: productIds },
      isActive: { $ne: false },
      sellable: { $ne: false },
    }),
    // Each dispatcher has their own flat price per SKU (no tiers, unlike
    // dealer pricing) - configured by an admin via the Dispatcher Price
    // workspace, never shared across dispatchers.
    DispatcherProductPrice.find({ dispatcherId, productId: { $in: productIds } }).lean(),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const priceMap = new Map(priceRows.map((row) => [String(row.productId), row]));

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(String(item.productId));
    if (!product) {
      throw new Error(`Product not found for id ${item.productId}`);
    }

    const priceRow = priceMap.get(String(product._id));
    if (!priceRow) {
      throw new ApiError(400, `No dispatcher price configured for SKU ${product.sku}`);
    }

    const quantity = Number(item.quantity || 0);
    if (!quantity || quantity <= 0) {
      throw new ApiError(400, `Invalid quantity for SKU ${product.sku}`);
    }

    const unitPrice = Number(priceRow.price || 0);
    const lineTotal = unitPrice * quantity;

    orderItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      code: product.code || "",
      category: product.category || "",
      packLabel: product.pack?.label || "",
      quantity,
      unit: product.uom?.base || product.pack?.unit || "PCS",
      unitPrice,
      lineTotal,
    });

    subtotal += lineTotal;
  }

  const paymentMethod = normalizeText(
    payload.paymentMethod || payload.payment?.method,
  );
  if (!paymentMethod) {
    throw new Error("Payment method is required before placing order");
  }

  const order = await Order.create({
    orderNumber: await generateUniqueOrderNumber(),
    orderOrigin: ORDER_ORIGIN.DISPATCHER_REPLENISHMENT,
    dispatcherCustomerId: dispatcher._id,
    // Reuses the dealer-shaped snapshot with the dispatcher's own profile
    // so every existing dealer-facing notification/email/PDF code path
    // (which reads order.dealerSnapshot) works unchanged for this order
    // type too - the dispatcher IS the customer being notified.
    dealerSnapshot: {
      companyName: dispatcher.companyName || "",
      contactName: dispatcher.name || "",
      email: dispatcher.email || "",
      phone: dispatcher.phone || "",
      address: dispatcher.address || "",
      panVat: "",
      fulfillmentMode: "FACTORY",
    },
    status: "SUBMITTED",
    items: orderItems,
    totals: {
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      currency: "NPR",
    },
    payment: { method: paymentMethod },
    dealerNote: normalizeText(payload.note || payload.dealerNote),
    submittedByUserId: user?.sub || user?.id || null,
  });

  notifyFactoryOrderSubmitted(order).catch((error) => {
    console.warn(
      "[admin-notification] dispatcher replenishment order:",
      error.message,
    );
  });

  return order;
}

export async function getMyDispatcherStock({
  user,
  page = 1,
  limit = 100,
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);
  return listDispatcherStock({ dispatcherId, page, limit });
}

export async function getMyDispatcherStockHistory({
  user,
  q,
  type,
  from,
  to,
  sort,
  page = 1,
  limit = 50,
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);
  return listDispatcherStockHistory({ dispatcherId, q, type, from, to, sort, page, limit });
}

// ----------------------------
// Fulfillment for a dispatcher's assigned dealer orders:
// Verified -> Dispatched (goods leave the dispatcher's warehouse - deducts
// the dispatcher's own stock and credits the dealer's received-quantity
// counter) -> Completed (see completeAssignedOrder below - the dispatcher
// separately confirms final-mile delivery, mirroring Factory's own
// dispatch/deliver split; Dispatched is no longer treated as terminal).
// ----------------------------

export async function dispatchAssignedOrder({
  user,
  orderId,
  payload = {},
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await getAssignedOrderOrThrow({ dispatcherId, orderId });
  if (normalizeStatus(order.status) !== "VERIFIED") {
    throw buildOrderConflictError(order, { status: 400, message: "Order must be verified before it can be dispatched" });
  }

  const note = normalizeText(payload.note);
  const actorUserId = user?.sub || user?.id || null;
  const previousStatus = order.status;

  let dealerEmailSentAt = null;
  try {
    dealerEmailSentAt = await sendDealerStatusEmail({
      order,
      status: "DISPATCHED",
    });
  } catch (error) {
    console.warn(
      "[dispatcher-email] dispatched status email failed:",
      error.message,
    );
  }

  let updatedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, dispatcherId, status: "VERIFIED" },
        {
          $set: {
            status: "DISPATCHED",
            // Mirrors factory.service.js's markOutForDelivery field names
            // exactly, so the milestone stepper (orderDetailLogic.js's
            // milestoneDate(), which reads these regardless of
            // fulfillment mode) shows a real date instead of a blank
            // "Dispatched" node for dispatcher-fulfilled orders.
            "factory.outForDeliveryAt": new Date(),
            "factory.outForDeliveryBy": actorUserId,
          },
          $push: {
            statusHistory: {
              fromStatus: previousStatus || "",
              toStatus: "DISPATCHED",
              note,
              changedByUserId: actorUserId,
              changedByRole: "DISPATCHER",
              changedAt: new Date(),
              dealerEmailSentAt,
            },
          },
        },
        { new: true, session },
      );

      if (!updated) {
        throw await buildOrderConflictErrorFresh(order._id, {
          message: "Order status changed before it could be dispatched. Please refresh and try again.",
        });
      }

      // Both stock movements share this transaction with the status
      // transition: if either the dispatcher doesn't have enough stock,
      // or something else fails, the status change rolls back too. Consumes
      // the reservation made at verify time (both currentQuantity and
      // reservedQuantity decrement together); falls back to a fresh
      // currentQuantity-only deduction for pre-existing orders that were
      // verified before reservation-at-verify shipped.
      await consumeDispatcherStockForOrder({
        order: updated,
        reason: "Order dispatched to dealer",
        actorUser: user,
        session,
      });

      await recordPurchaseMovement({
        dealerId: updated.dealerId,
        items: updated.items,
        orderId: updated._id,
        actorUser: user,
        actorRole: "DISPATCHER",
        session,
      });

      updatedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return updatedOrder;
}

// Dispatched -> Completed, mirroring Factory's markDelivered - a dispatcher
// can now confirm final-mile delivery instead of Dispatched being terminal.
// Unlike dispatchAssignedOrder, this has no stock/inventory side effects:
// the dispatcher's own stock deduction and the dealer's received-inventory
// credit both already happened at dispatch time (consumeDispatcherStockForOrder
// / recordPurchaseMovement above) - this is purely the status transition.
export async function completeAssignedOrder({
  user,
  orderId,
  payload = {},
} = {}) {
  const dispatcherId = ensureDispatcherId(user);
  await getVerifiedActiveDispatcher(dispatcherId);

  const order = await getAssignedOrderOrThrow({ dispatcherId, orderId });
  if (normalizeStatus(order.status) !== "DISPATCHED") {
    throw buildOrderConflictError(order, { status: 400, message: "Order must be dispatched before it can be completed" });
  }

  const note = normalizeText(payload.note);
  const actorUserId = user?.sub || user?.id || null;
  const previousStatus = order.status;

  let dealerEmailSentAt = null;
  try {
    dealerEmailSentAt = await sendDealerStatusEmail({
      order,
      status: "COMPLETED",
    });
  } catch (error) {
    console.warn(
      "[dispatcher-email] completed status email failed:",
      error.message,
    );
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, dispatcherId, status: "DISPATCHED" },
    {
      $set: {
        status: "COMPLETED",
        // Mirrors factory.service.js's markDelivered field names exactly -
        // see the same reasoning in dispatchAssignedOrder above.
        "factory.deliveredAt": new Date(),
        "factory.deliveredBy": actorUserId,
      },
      $push: {
        statusHistory: {
          fromStatus: previousStatus || "",
          toStatus: "COMPLETED",
          note,
          changedByUserId: actorUserId,
          changedByRole: "DISPATCHER",
          changedAt: new Date(),
          dealerEmailSentAt,
        },
      },
    },
    { new: true },
  );

  if (!updated) {
    throw await buildOrderConflictErrorFresh(order._id, {
      message: "Order status changed before it could be completed. Please refresh and try again.",
    });
  }

  return updated;
}
