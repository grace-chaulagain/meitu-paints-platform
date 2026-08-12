import crypto from "crypto";
import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import { buildOrderConflictError, buildOrderConflictErrorFresh } from "../utils/orderConflictError.js";
import { getNextOrderSerialNumber } from "../utils/orderSerialNumber.js";
import Order, {
  ORDER_ORIGIN,
  ORDER_REVIEWED_BY,
  ORDER_STATUS,
} from "../models/Order.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Product from "../models/Product.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import User from "../models/User.model.js";
import { ROLES } from "../constants/roles.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import {
  notifyAssignedDealerOrderSubmitted,
  notifyFactoryOrderSubmitted,
} from "./adminNotification.service.js";
import {
  createFactoryNotification,
  NOTIFICATION_CATEGORY,
} from "./notification.service.js";
import { archiveVerifiedOrderToGoogleSheets } from "./googleSheetsArchive.service.js";
import { buildOrderSummaryPdfAttachment } from "./orderPdf.service.js";
import { sendDealerStatusEmail } from "./factory.service.js";
import {
  checkOrderStock,
  releaseReservationForOrder,
  reserveStockForOrder,
} from "./stock.service.js";
import {
  reserveDispatcherStockForOrder,
  releaseDispatcherStockForOrder,
} from "./dispatcherStock.service.js";
import {
  smtpConfigured,
  sendMail,
  renderEmailShell,
  renderDetailRows,
  renderLineItemsTable,
  renderCallout,
} from "../utils/email.js";

function getFactorySettingsModel() {
  const model = mongoose.models.FactorySettings;

  if (!model) {
    throw new ApiError(
      500,
      "Factory settings model is not registered. Create and register FactorySettings.model.js first.",
    );
  }

  return model;
}

// ----------------------------
// Small helpers
// ----------------------------

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeUpper(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function toObjectIdString(value) {
  return value ? String(value) : "";
}

function isAdmin(user) {
  return normalizeUpper(user?.role) === ROLES.ADMIN;
}

function isAdminReadScope(user) {
  return [ROLES.ADMIN, ROLES.READ_ONLY_ADMIN].includes(
    normalizeUpper(user?.role),
  );
}

function isDealer(user) {
  return normalizeUpper(user?.role) === ROLES.DEALER;
}

function isDispatcher(user) {
  return normalizeUpper(user?.role) === ROLES.DISPATCHER;
}

function assertUser(user) {
  if (!user?._id && !user?.id && !user?.sub) {
    throw new ApiError(401, "Authentication required");
  }
}

function getUserId(user) {
  return user?._id || user?.id || user?.sub || null;
}

function buildOrderNumber() {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${rand}`;
}

// Shared by every order-creation flow (dealer orders here, dispatcher
// replenishment orders in dispatcher.service.js) so every order in the
// system gets the same short ORD-XXXXXX shape - not just dealer orders.
export async function generateUniqueOrderNumber() {
  let orderNumber = buildOrderNumber();
  for (let i = 0; i < 5; i += 1) {
    const exists = await Order.exists({ orderNumber });
    if (!exists) break;
    orderNumber = buildOrderNumber();
  }
  return orderNumber;
}

function parsePositiveNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(400, `${label} must be a valid non-negative number`);
  }
  return n;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ----------------------------
// Dealer / dispatcher helpers
// ----------------------------

async function getDealerForOrderPlacement(dealerId) {
  if (!dealerId) {
    throw new ApiError(400, "Dealer account is not linked");
  }

  const dealer = await DealerProfile.findById(dealerId).populate({
    path: "dispatcherId",
    select: "name companyName email phone status isActive",
  });

  if (!dealer) {
    throw new ApiError(404, "Dealer profile not found");
  }

  if (dealer.status === DEALER_STATUS.SUSPENDED) {
    throw new ApiError(403, "Dealer account is suspended");
  }

  return dealer;
}

async function getDispatcherForUser(user) {
  if (!isDispatcher(user)) {
    throw new ApiError(403, "Dispatcher access required");
  }

  const dispatcherId = user?.dispatcherId;
  if (!dispatcherId) {
    throw new ApiError(403, "Dispatcher account is not linked");
  }

  const dispatcher = await Dispatcher.findById(dispatcherId).select(
    "_id name companyName email phone status isActive",
  );

  if (!dispatcher) {
    throw new ApiError(404, "Dispatcher profile not found");
  }

  if (
    dispatcher.status !== DISPATCHER_STATUS.VERIFIED ||
    dispatcher.isActive !== true
  ) {
    throw new ApiError(403, "Dispatcher account is not active");
  }

  return dispatcher;
}

async function assertCanAccessOrder({ order, actorUser }) {
  assertUser(actorUser);

  if (isAdminReadScope(actorUser)) return;

  if (isDealer(actorUser)) {
    if (
      toObjectIdString(order.dealerId?._id || order.dealerId) !==
      toObjectIdString(actorUser.dealerId)
    ) {
      throw new ApiError(403, "You do not have access to this order");
    }
    return;
  }

  if (isDispatcher(actorUser)) {
    const dispatcher = await getDispatcherForUser(actorUser);
    const orderDispatcherId = toObjectIdString(
      order.dispatcherId?._id || order.dispatcherId,
    );

    if (
      !orderDispatcherId ||
      orderDispatcherId !== toObjectIdString(dispatcher._id)
    ) {
      throw new ApiError(403, "You do not have access to this order");
    }

    if (order.dealerSnapshot?.fulfillmentMode !== "DISPATCHER") {
      throw new ApiError(403, "You do not have access to this order");
    }

    return;
  }

  throw new ApiError(403, "Access denied");
}

async function assertCanReviewOrder({ order, actorUser }) {
  assertUser(actorUser);

  if (order.status !== ORDER_STATUS.SUBMITTED) {
    throw buildOrderConflictError(order, {
      status: 400,
      message: `Order cannot be reviewed from status ${order.status}`,
    });
  }

  const mode = order.dealerSnapshot?.fulfillmentMode || "FACTORY";

  if (mode === "FACTORY") {
    if (!isAdmin(actorUser)) {
      throw new ApiError(403, "Only admin can verify factory-handled orders");
    }
    return {
      reviewedByRole: ORDER_REVIEWED_BY.ADMIN,
      reviewedByUserId: getUserId(actorUser),
    };
  }

  if (mode === "DISPATCHER") {
    if (isAdmin(actorUser)) {
      return {
        reviewedByRole: ORDER_REVIEWED_BY.ADMIN,
        reviewedByUserId: getUserId(actorUser),
      };
    }

    if (!isDispatcher(actorUser)) {
      throw new ApiError(
        403,
        "Only the assigned dispatcher or admin can verify this order",
      );
    }

    const dispatcher = await getDispatcherForUser(actorUser);
    const orderDispatcherId = toObjectIdString(
      order.dispatcherId?._id || order.dispatcherId,
    );

    if (orderDispatcherId !== toObjectIdString(dispatcher._id)) {
      throw new ApiError(
        403,
        "Only the assigned dispatcher can verify this order",
      );
    }

    return {
      reviewedByRole: ORDER_REVIEWED_BY.DISPATCHER,
      reviewedByUserId: getUserId(actorUser),
    };
  }

  throw new ApiError(400, "Unsupported fulfillment mode");
}

async function assertCanAmendOrder({ order, actorUser }) {
  assertUser(actorUser);

  if (order.status !== ORDER_STATUS.SUBMITTED) {
    throw new ApiError(400, "Only submitted orders can be amended");
  }

  if (isAdmin(actorUser)) return;

  if (isDispatcher(actorUser)) {
    const dispatcher = await getDispatcherForUser(actorUser);
    const orderDispatcherId = toObjectIdString(
      order.dispatcherId?._id || order.dispatcherId,
    );

    if (
      order.dealerSnapshot?.fulfillmentMode !== "DISPATCHER" ||
      orderDispatcherId !== toObjectIdString(dispatcher._id)
    ) {
      throw new ApiError(403, "You do not have permission to amend this order");
    }

    return;
  }

  throw new ApiError(403, "You do not have permission to amend this order");
}

// ----------------------------
// Item / totals helpers
// ----------------------------

// Async because it now cross-checks each item's quantity against its
// Product's minQuantity (e.g. wall putty PB variants, which only make sense
// at 500+ bags) - this is the real enforcement point, since a direct API
// call could otherwise bypass whatever floor the cart UI applies client-side.
async function sanitizeOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one order item is required");
  }

  const skus = [...new Set(items.map((item) => normalizeText(item?.sku)).filter(Boolean))];
  const products = skus.length
    ? await Product.find({ sku: { $in: skus } }).select("sku minQuantity").lean()
    : [];
  const minQuantityBySku = new Map(products.map((p) => [p.sku, Number(p.minQuantity) || 1]));

  return items.map((item, index) => {
    const name = normalizeText(item?.name);
    if (!name) {
      throw new ApiError(400, `Item ${index + 1}: name is required`);
    }

    const quantity = parsePositiveNumber(
      item?.quantity,
      `Item ${index + 1} quantity`,
    );
    const unitPrice = parsePositiveNumber(
      item?.unitPrice,
      `Item ${index + 1} unitPrice`,
    );

    const sku = normalizeText(item?.sku);
    const minQuantity = minQuantityBySku.get(sku) || 1;
    if (quantity < minQuantity) {
      throw new ApiError(
        400,
        `Item ${index + 1} (${name}): minimum order quantity is ${minQuantity}`,
      );
    }

    const lineTotal =
      item?.lineTotal !== undefined && item?.lineTotal !== null
        ? parsePositiveNumber(item.lineTotal, `Item ${index + 1} lineTotal`)
        : Number((quantity * unitPrice).toFixed(2));

    return {
      productId: item?.productId || null,
      sku,
      code: normalizeText(item?.code),
      name,
      category: normalizeText(item?.category),
      variantLabel: normalizeText(item?.variantLabel),
      packLabel: normalizeText(item?.packLabel),
      quantity,
      unit: normalizeText(item?.unit),
      unitPrice,
      lineTotal,
      notes: normalizeText(item?.notes),
      components: Array.isArray(item?.components)
        ? item.components
            .map((component) => ({
              productId: component?.productId || null,
              name: normalizeText(component?.name),
              packLabel: normalizeText(component?.packLabel),
              quantity: Number(component?.quantity) || 1,
            }))
            .filter((component) => component.name)
        : [],
    };
  });
}

function buildOrderTotals({ items, totals = {} }) {
  const subtotalFromItems = items.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0,
  );

  const discount = parsePositiveNumber(totals?.discount || 0, "discount");
  const taxableAmount =
    totals?.taxableAmount !== undefined && totals?.taxableAmount !== null
      ? parsePositiveNumber(totals.taxableAmount, "taxableAmount")
      : Math.max(0, subtotalFromItems - discount);

  const tax = parsePositiveNumber(totals?.tax || 0, "tax");
  const total =
    totals?.total !== undefined && totals?.total !== null
      ? parsePositiveNumber(totals.total, "total")
      : Math.max(0, taxableAmount + tax);

  return {
    subtotal: Number(subtotalFromItems.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    currency: normalizeUpper(totals?.currency || "NPR"),
  };
}

// ----------------------------
// Factory email helpers
// ----------------------------

async function buildFactoryRecipients() {
  const FactorySettings = getFactorySettingsModel();

  const settings = await FactorySettings.findOne({}).lean();
  if (!settings) {
    throw new ApiError(500, "Factory settings are not configured");
  }

  if (settings.notificationsEnabled === false) {
    throw new ApiError(400, "Factory notifications are currently disabled");
  }

  const recipients = [
    normalizeText(settings.primaryEmail),
    ...(Array.isArray(settings.ccEmails) ? settings.ccEmails : []),
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new ApiError(500, "Factory email recipients are not configured");
  }

  return recipients.join(", ");
}

function buildFactoryOrderEmail(order) {
  const subject = `Factory Order Bill · ${order.orderNumber}`;

  const text = [
    `Order Number: ${order.orderNumber}`,
    `Dealer: ${order.dealerSnapshot?.companyName || ""}`,
    `Contact: ${order.dealerSnapshot?.contactName || ""}`,
    `Phone: ${order.dealerSnapshot?.phone || ""}`,
    `Address: ${order.dealerSnapshot?.address || ""}`,
    "",
    "Items:",
    ...(order.items || []).map(
      (item, index) =>
        `${index + 1}. ${item.name} | ${item.packLabel || item.variantLabel || "-"} | Qty: ${item.quantity} | Unit Price: ${item.unitPrice} | Line Total: ${item.lineTotal}`,
    ),
    "",
    "PDF Attachment: The verified order summary PDF is attached for factory processing.",
    "",
    `Subtotal: ${order.totals?.subtotal || 0}`,
    `Discount: ${order.totals?.discount || 0}`,
    `Tax: ${order.totals?.tax || 0}`,
    `Total: ${order.totals?.currency || "NPR"} ${order.totals?.total || 0}`,
  ].join("\n");

  const html = renderEmailShell({
    preheader: `Factory order bill for ${order.orderNumber}.`,
    eyebrow: "Factory Processing",
    title: "Factory Order Bill",
    bodyHtml:
      renderDetailRows([
        { label: "Order Number", value: order.orderNumber },
        { label: "Dealer", value: order.dealerSnapshot?.companyName },
        { label: "Contact", value: order.dealerSnapshot?.contactName },
        { label: "Phone", value: order.dealerSnapshot?.phone },
        { label: "Address", value: order.dealerSnapshot?.address },
      ]) + renderLineItemsTable({ items: order.items || [], totals: order.totals || {} }),
    calloutHtml: renderCallout(
      "A downloadable PDF copy of this verified factory order summary is attached to this email for factory processing and records.",
      { label: "Attachment" },
    ),
  });

  return { subject, text, html };
}

// ----------------------------
// Order creation
// ----------------------------

export async function createOrder({
  actorUser,
  items,
  totals = {},
  payment = {},
  dealerNote = "",
  internalNote = "",
}) {
  assertUser(actorUser);

  if (!isDealer(actorUser)) {
    throw new ApiError(403, "Only dealers can place orders");
  }

  const dealer = await getDealerForOrderPlacement(actorUser.dealerId);
  const sanitizedItems = await sanitizeOrderItems(items);
  const normalizedTotals = buildOrderTotals({
    items: sanitizedItems,
    totals,
  });
  const paymentMethod = normalizeText(payment?.method).toUpperCase();

  if (!paymentMethod) {
    throw new ApiError(400, "Payment method is required before placing order");
  }

  const orderNumber = await generateUniqueOrderNumber();

  const dispatcher = dealer.dispatcherId || null;

  const order = await Order.create({
    orderNumber,
    dealerId: dealer._id,
    dealerSnapshot: {
      companyName: dealer.companyName || "",
      contactName: dealer.contactName || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address: dealer.address || "",
      panVat: dealer.panVat || "",
      fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
    },
    dispatcherId:
      dealer.fulfillmentMode === "DISPATCHER" ? dispatcher?._id || null : null,
    dispatcherSnapshot:
      dealer.fulfillmentMode === "DISPATCHER" && dispatcher
        ? {
            name: dispatcher.name || "",
            companyName: dispatcher.companyName || "",
            email: dispatcher.email || "",
            phone: dispatcher.phone || "",
          }
        : {
            name: "",
            companyName: "",
            email: "",
            phone: "",
          },
    items: sanitizedItems,
    totals: normalizedTotals,
    payment: {
      method: paymentMethod,
      reference: normalizeText(payment?.reference),
      note: normalizeText(payment?.note),
    },
    dealerNote: normalizeText(dealerNote),
    internalNote: normalizeText(internalNote),
    status: ORDER_STATUS.SUBMITTED,
    statusHistory: [
      {
        fromStatus: "",
        toStatus: ORDER_STATUS.SUBMITTED,
        note: "Order submitted by dealer.",
        changedByUserId: getUserId(actorUser),
        changedByRole: normalizeUpper(actorUser.role),
        changedAt: new Date(),
      },
    ],
    submittedByUserId: getUserId(actorUser),
  });

  if ((order.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY") {
    notifyFactoryOrderSubmitted(order).catch((error) => {
      console.warn("[admin-notification] factory order:", error.message);
    });
  } else {
    notifyAssignedDealerOrderSubmitted(order).catch((error) => {
      console.warn("[dispatcher-notification] assigned order:", error.message);
    });
  }

  return order;
}

// ----------------------------
// Scoped order listing
// ----------------------------

export async function listOrdersForActor({
  actorUser,
  status,
  archive,
  q,
  fulfillmentMode,
  dispatcherId,
  orderOrigin,
  excludeOrigins,
  from,
  to,
  page = 1,
  limit = 20,
}) {
  assertUser(actorUser);

  const query = { isDeleted: { $ne: true } };
  const normalizedStatus = normalizeUpper(status);

  if (normalizedStatus === "ALL") {
    // Explicit full-register view. The historical default for this endpoint is
    // SUBMITTED-only, so callers that need every status must opt in.
  } else if (normalizedStatus) {
    query.status = normalizedStatus;
  } else if (archive === true || String(archive) === "true") {
    // SUBMITTED is the only "not yet reviewed" status - everything else is
    // archived by definition, so this is just "not submitted".
    query.status = { $ne: ORDER_STATUS.SUBMITTED };
  } else {
    query.status = ORDER_STATUS.SUBMITTED;
  }

  const normalizedFulfillmentMode = normalizeUpper(fulfillmentMode);
  if (["FACTORY", "DISPATCHER"].includes(normalizedFulfillmentMode)) {
    query["dealerSnapshot.fulfillmentMode"] = normalizedFulfillmentMode;
  }

  // `orderOrigin` narrows to exactly one pipeline; `excludeOrigins` (a
  // comma-separated list) removes pipelines from an otherwise-broad view.
  // Both are needed because a scheme order snapshots
  // `dealerSnapshot.fulfillmentMode: "FACTORY"` - so without an exclusion the
  // "Factory" scope silently mixes free-of-cost scheme grants in with real
  // dealer sales, and there is no way to ask for "real orders only".
  //
  // Exclusion is expressed with $nin rather than a positive
  // `orderOrigin: "DEALER"` match on purpose: `orderOrigin` gained its schema
  // default long after the first orders were written, and a Mongoose default
  // does not backfill existing documents. Any pre-existing order with no
  // `orderOrigin` field at all still matches $nin (missing != excluded value)
  // but would NOT match an equality check - so the positive form would quietly
  // hide the oldest orders in the register.
  const normalizedOrigin = normalizeUpper(orderOrigin);
  if (Object.values(ORDER_ORIGIN).includes(normalizedOrigin)) {
    query.orderOrigin = normalizedOrigin;
  } else {
    const excluded = String(excludeOrigins || "")
      .split(",")
      .map((value) => normalizeUpper(value))
      .filter((value) => Object.values(ORDER_ORIGIN).includes(value));
    if (excluded.length) {
      query.orderOrigin = { $nin: excluded };
    }
  }

  if (isDealer(actorUser)) {
    query.dealerId = actorUser.dealerId;
  } else if (isDispatcher(actorUser)) {
    const dispatcher = await getDispatcherForUser(actorUser);
    query.dispatcherId = dispatcher._id;
    query["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  } else if (!isAdminReadScope(actorUser)) {
    throw new ApiError(403, "Access denied");
  } else if (dispatcherId) {
    if (!mongoose.Types.ObjectId.isValid(String(dispatcherId))) {
      throw new ApiError(400, "Invalid dispatcherId");
    }
    query.dispatcherId = new mongoose.Types.ObjectId(String(dispatcherId));
    query["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  }

  const raw = normalizeText(q);
  if (raw) {
    const rx = new RegExp(escapeRegExp(raw), "i");
    query.$or = [
      { orderNumber: rx },
      { "dealerSnapshot.companyName": rx },
      { "dealerSnapshot.contactName": rx },
      { "dealerSnapshot.phone": rx },
      { "dealerSnapshot.email": rx },
    ];
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if ((fromDate && !Number.isNaN(fromDate.getTime())) || (toDate && !Number.isNaN(toDate.getTime()))) {
    query.createdAt = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      query.createdAt.$gte = fromDate;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      // Treat "to" as inclusive of the whole calendar day.
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
  }

  const safePage = Math.max(1, Number(page || 1));
  const perPage = Math.min(200, Math.max(1, Number(limit || 20)));
  const skip = (safePage - 1) * perPage;

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: "dealerId",
        select:
          "companyName contactName email phone fulfillmentMode dispatcherId status",
      })
      .populate({
        path: "dispatcherId",
        select: "name companyName email phone status isActive",
      })
      .lean(),
    Order.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: safePage,
    limit: perPage,
  };
}

// ----------------------------
// Single order
// ----------------------------

export async function getOrderForActor({ orderId, actorUser }) {
  assertUser(actorUser);

  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId)
    .populate({
      path: "dealerId",
      select:
        "companyName contactName email phone fulfillmentMode dispatcherId status",
    })
    .populate({
      path: "dispatcherId",
      select: "name companyName email phone status isActive",
    })
    .populate({
      path: "review.reviewedByUserId",
      select: "username email role",
    })
    .populate({
      path: "amendments.amendedByUserId",
      select: "username email role",
    });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  await assertCanAccessOrder({ order, actorUser });

  return order;
}

export async function getOrderStockCheck({ orderId, actorUser }) {
  assertUser(actorUser);
  if (!isAdminReadScope(actorUser)) {
    throw new ApiError(403, "Admin access required");
  }
  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const out = await checkOrderStock(order);
  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    reservationStatus: order.stockReservation?.status || "NONE",
    ...out,
  };
}

// ----------------------------
// Amend order
// ----------------------------

export async function amendOrder({
  orderId,
  actorUser,
  items,
  totals = {},
  payment,
  dealerNote,
  internalNote,
  reason = "",
  note = "",
}) {
  assertUser(actorUser);

  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  await assertCanAmendOrder({ order, actorUser });

  if (items !== undefined) {
    const sanitizedItems = await sanitizeOrderItems(items);
    order.items = sanitizedItems;
    order.totals = buildOrderTotals({
      items: sanitizedItems,
      totals: totals || order.totals || {},
    });
  } else if (totals && typeof totals === "object") {
    order.totals = buildOrderTotals({
      items: order.items || [],
      totals,
    });
  }

  if (payment && typeof payment === "object") {
    order.payment = {
      method: normalizeText(payment?.method ?? order.payment?.method),
      reference: normalizeText(payment?.reference ?? order.payment?.reference),
      note: normalizeText(payment?.note ?? order.payment?.note),
    };
  }

  if (dealerNote !== undefined) {
    order.dealerNote = normalizeText(dealerNote);
  }

  if (internalNote !== undefined) {
    order.internalNote = normalizeText(internalNote);
  }

  order.amendments.push({
    amendedByUserId: getUserId(actorUser),
    amendedByRole: normalizeUpper(actorUser.role),
    reason: normalizeText(reason),
    note: normalizeText(note),
    amendedAt: new Date(),
  });

  await order.save();

  return order;
}

// ----------------------------
// Verify / reject order
// ----------------------------

export async function verifyOrder({ orderId, actorUser, reviewNote = "" }) {
  assertUser(actorUser);

  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const reviewMeta = await assertCanReviewOrder({ order, actorUser });
  const previousStatus = order.status;
  const normalizedReviewNote = normalizeText(reviewNote);
  const isFactoryOrder =
    (order.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY";

  // The status transition and (for factory orders) the stock reservation
  // share one transaction: either both land, or neither does. This is
  // also what closes the two-admins-verify-the-same-order race - the
  // findOneAndUpdate below only matches if status is still SUBMITTED at
  // the moment it runs, not at the moment we read it above.
  //
  // Both the "already reviewed" and "stock changed" errors below are
  // optimistic-concurrency signals, not permanent failures - retrying
  // resolves them the moment the other transaction commits. A genuine
  // conflict (order already reviewed for real, or truly insufficient
  // stock) reproduces on every attempt and still surfaces after
  // MAX_VERIFY_ATTEMPTS, just slightly slower.
  const MAX_VERIFY_ATTEMPTS = 3;
  let verifiedOrder;
  for (let attempt = 1; attempt <= MAX_VERIFY_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // For factory orders, verification IS "sent to Factory" - VERIFIED
        // is the resting state the factory's Inbox queue reads from, so
        // the sent-to-factory timestamp is stamped in the same write
        // rather than as a separate follow-up status transition.
        const setFields = {
          status: ORDER_STATUS.VERIFIED,
          review: {
            reviewedByRole: reviewMeta.reviewedByRole,
            reviewedByUserId: reviewMeta.reviewedByUserId,
            reviewedAt: new Date(),
            reviewNote: normalizedReviewNote,
          },
        };
        if (isFactoryOrder) {
          setFields["factory.sentToFactoryAt"] = new Date();
          setFields["factory.sentToFactoryBy"] = getUserId(actorUser);
        }

        const updated = await Order.findOneAndUpdate(
          { _id: orderId, status: ORDER_STATUS.SUBMITTED },
          {
            $set: setFields,
            $push: {
              statusHistory: {
                fromStatus: previousStatus || "",
                toStatus: ORDER_STATUS.VERIFIED,
                note: normalizedReviewNote || "Order verified.",
                changedByUserId: getUserId(actorUser),
                changedByRole: normalizeUpper(actorUser.role),
                changedAt: new Date(),
              },
            },
          },
          { new: true, session },
        );

        if (!updated) {
          throw await buildOrderConflictErrorFresh(orderId, {
            message: "This order was already reviewed by someone else. Please refresh and try again.",
          });
        }

        if (isFactoryOrder) {
          await reserveStockForOrder({
            order: updated,
            actorUser,
            reason: "Admin verified order for Factory fulfillment",
            note: normalizedReviewNote,
            session,
          });
        } else {
          await reserveDispatcherStockForOrder({
            order: updated,
            actorUser,
            reason: "Order verified and reserved for dispatcher fulfillment",
            note: normalizedReviewNote,
            session,
          });
        }

        verifiedOrder = updated;
      });
      break;
    } catch (error) {
      const isRetryableConflict = error instanceof ApiError && error.statusCode === 409;
      if (!isRetryableConflict || attempt === MAX_VERIFY_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 80));
    } finally {
      session.endSession();
    }
  }

  // Email is a best-effort side effect, not part of the transaction above -
  // a transaction should never stay open across a slow external network
  // call, and a DB rollback can't "unsend" an email anyway. Fired after the
  // retry loop (not inside it) so a retried attempt can never double-email.
  //
  // Deliberately NOT awaited (unlike the original version of this code):
  // an SMTP round-trip is 1-8+ seconds even with the bounded per-attempt
  // timeout, and the admin who just clicked Verify has nothing to do with
  // whether the dealer/factory notification email succeeds - awaiting it
  // held the HTTP response, and therefore every rail/celebration animation
  // downstream of it, hostage to mail-server latency. Same fire-and-forget
  // shape as createFactoryNotification/archiveVerifiedOrderToGoogleSheets
  // below, which never blocked the response to begin with.
  // Both callbacks below used to call verifiedOrder.save() on the SAME
  // in-memory document. That's two problems, not one: (1) Mongoose's
  // parallel-save guard throws ParallelSaveError if the second .save()
  // starts before the first's DB round-trip finishes - the factory-email
  // path does strictly more work first (recipients query + PDF generation
  // + SMTP), so the two calls race in practice, not just in theory, and
  // the loser's timestamp silently never persists (caught below, only
  // console.warn'd). (2) Even without that race, .save() writes the
  // *whole* document - with versionKey disabled on this model there's no
  // optimistic-concurrency check, so a `.save()` racing against any other
  // concurrent write to this order (a revert, another admin's action)
  // would silently clobber it. Targeted `updateOne`s below touch only the
  // one field each callback actually owns, so both can run fully
  // concurrently with each other and with anything else touching the
  // order, and neither needs the shared in-memory instance at all.
  sendDealerStatusEmail({ order: verifiedOrder, status: ORDER_STATUS.VERIFIED })
    .then(async (dealerEmailSentAt) => {
      if (!dealerEmailSentAt) return;
      const lastHistoryEntry = verifiedOrder.statusHistory[verifiedOrder.statusHistory.length - 1];
      if (!lastHistoryEntry) return;
      await Order.updateOne(
        { _id: verifiedOrder._id },
        { $set: { "statusHistory.$[entry].dealerEmailSentAt": dealerEmailSentAt } },
        { arrayFilters: [{ "entry.changedAt": lastHistoryEntry.changedAt, "entry.toStatus": ORDER_STATUS.VERIFIED }] },
      );
    })
    .catch((error) => {
      console.warn("[dealer-email] verified status email failed:", error?.message);
    });

  if (isFactoryOrder) {
    if (!smtpConfigured()) {
      console.warn("[factory-email] SMTP is not configured; skipped factory order email.");
    } else {
      (async () => {
        const recipients = await buildFactoryRecipients();
        const mail = buildFactoryOrderEmail(verifiedOrder);
        const pdfAttachment = await buildOrderSummaryPdfAttachment(verifiedOrder);

        await sendMail({
          to: recipients,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: [pdfAttachment],
        });

        await Order.updateOne({ _id: verifiedOrder._id }, { $set: { factoryEmailSentAt: new Date() } });
      })().catch((error) => {
        console.warn("[factory-email] Failed to send factory order email; continuing without blocking verification.", {
          orderId: String(verifiedOrder._id),
          orderNumber: verifiedOrder.orderNumber,
          message: error?.message,
        });
      });
    }
  }

  if (isFactoryOrder) {
    createFactoryNotification({
      category: NOTIFICATION_CATEGORY.FACTORY_ORDER,
      title: `Order ${verifiedOrder.orderNumber || ""} sent to Factory`.trim(),
      description: `${verifiedOrder.dealerSnapshot?.companyName || "A dealer"} is awaiting factory fulfillment.`,
      targetUrl: `/factory/dashboard/orders?orderId=${encodeURIComponent(String(verifiedOrder._id))}`,
      dealerId: verifiedOrder.dealerId,
      orderId: verifiedOrder._id,
      metadata: {
        orderNumber: verifiedOrder.orderNumber || "",
        companyName: verifiedOrder.dealerSnapshot?.companyName || "",
        total: verifiedOrder.totals?.total || 0,
        currency: verifiedOrder.totals?.currency || "NPR",
      },
    }).catch((error) => {
      console.warn("[factory-notification] order sent:", error.message);
    });
  }

  const finalOrder = verifiedOrder;

  archiveVerifiedOrderToGoogleSheets(finalOrder).catch((error) => {
    console.error("[google-sheets-archive] Failed to archive verified order", {
      orderId: String(finalOrder._id),
      orderNumber: finalOrder.orderNumber,
      message: error?.message,
    });
  });

  return finalOrder;
}

// Assigns/returns the two pieces of frozen Proforma Invoice metadata -
// serialNumber (the SN{n} watermark) and proformaIssuedAt (the printed
// date) - called by both Admin (order review) and Factory (pre-dispatch)
// right before they build the PDF client-side.
//
// serialNumber: assigned the first time a PI is actually generated for
// this order, not at verification or creation. Idempotent forever after -
// re-generating/re-downloading the same PI always shows the same number.
//
// proformaIssuedAt: refreshed to "now" on every generation while the
// order is still pre-dispatch (status === VERIFIED) - each regeneration
// reflects the latest version before it goes out the door. The instant
// status leaves VERIFIED, it freezes permanently: every later
// redownload, by anyone, shows that same frozen instant instead of the
// redownload time. (Edge case: if an order was dispatched without a PI
// ever having been generated pre-dispatch, the first post-dispatch
// generation freezes it then, exactly once.)
//
// These two fields have different race-condition guards (assign-once vs.
// refresh-while-VERIFIED) and are deliberately written as two separate
// findOneAndUpdate calls rather than one combined $set - bundling them
// would make the timestamp refresh silently no-op whenever the
// serial-number filter alone fails to match a concurrent write.
export async function ensureProformaInvoiceMetadata({ orderId, actorUser }) {
  assertUser(actorUser);
  const role = normalizeUpper(actorUser?.role);
  if (role !== ROLES.ADMIN && role !== ROLES.FACTORY) {
    throw new ApiError(403, "Only Admin or Factory can generate a Proforma Invoice");
  }

  const existing = await Order.findById(orderId)
    .select("serialNumber proformaIssuedAt status")
    .lean();
  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  let serialNumber = existing.serialNumber;
  if (!serialNumber) {
    const nextSerial = await getNextOrderSerialNumber();
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, serialNumber: null },
      { $set: { serialNumber: nextSerial } },
      { new: true },
    )
      .select("serialNumber")
      .lean();

    // Lost a concurrent race to assign the first number for this order -
    // the winner's number is what every PI for this order should show, so
    // return that instead of the number we drew (never used again).
    serialNumber = updated
      ? updated.serialNumber
      : (await Order.findById(orderId).select("serialNumber").lean())?.serialNumber;
  }

  let generatedAt = existing.proformaIssuedAt;
  if (existing.status === ORDER_STATUS.VERIFIED) {
    // Status-scoped filter, not a blind update - if a concurrent dispatch
    // won the race between our read above and this write, this matches
    // zero documents and we fall through to whatever is now actually
    // persisted, instead of stomping a value that just got frozen.
    const refreshed = await Order.findOneAndUpdate(
      { _id: orderId, status: ORDER_STATUS.VERIFIED },
      { $set: { proformaIssuedAt: new Date() } },
      { new: true },
    )
      .select("proformaIssuedAt")
      .lean();
    generatedAt = refreshed
      ? refreshed.proformaIssuedAt
      : (await Order.findById(orderId).select("proformaIssuedAt").lean())?.proformaIssuedAt;
  } else if (!generatedAt) {
    // Edge case: dispatched (or beyond) without a PI ever generated
    // pre-dispatch. Freeze now, race-guarded exactly like serialNumber.
    const claimed = await Order.findOneAndUpdate(
      { _id: orderId, proformaIssuedAt: null },
      { $set: { proformaIssuedAt: new Date() } },
      { new: true },
    )
      .select("proformaIssuedAt")
      .lean();
    generatedAt = claimed
      ? claimed.proformaIssuedAt
      : (await Order.findById(orderId).select("proformaIssuedAt").lean())?.proformaIssuedAt;
  }

  return { serialNumber, generatedAt };
}

export async function rejectOrder({ orderId, actorUser, reviewNote = "" }) {
  assertUser(actorUser);

  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const reviewMeta = await assertCanReviewOrder({ order, actorUser });

  const normalizedReviewNote = normalizeText(reviewNote);
  if (!normalizedReviewNote) {
    throw new ApiError(400, "Rejection reason is required");
  }

  const previousStatus = order.status;

  let rejectedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: ORDER_STATUS.SUBMITTED },
        {
          $set: {
            status: ORDER_STATUS.REJECTED,
            review: {
              reviewedByRole: reviewMeta.reviewedByRole,
              reviewedByUserId: reviewMeta.reviewedByUserId,
              reviewedAt: new Date(),
              reviewNote: normalizedReviewNote,
            },
            rejection: {
              reason: normalizedReviewNote,
              rejectedAt: new Date(),
              rejectedBy: getUserId(actorUser),
              rejectedByRole: normalizeUpper(actorUser.role),
            },
          },
          $push: {
            statusHistory: {
              fromStatus: previousStatus || "",
              toStatus: ORDER_STATUS.REJECTED,
              note: normalizedReviewNote,
              reason: normalizedReviewNote,
              changedByUserId: getUserId(actorUser),
              changedByRole: normalizeUpper(actorUser.role),
              changedAt: new Date(),
            },
          },
        },
        { new: true, session },
      );

      if (!updated) {
        throw await buildOrderConflictErrorFresh(orderId, {
          message: "This order was already reviewed by someone else. Please refresh and try again.",
        });
      }

      await releaseReservationForOrder({
        order: updated,
        actorUser,
        reason: "Order rejected during review",
        note: normalizedReviewNote,
        session,
      });

      rejectedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return rejectedOrder;
}

// Phase 6 of the order-state-handling redesign: the one reversible
// transition in the whole system. Admin-only by design (dispatcher revert
// of their own verify is out of scope - dispatcher verify has no
// reservation to unwind and less mis-click risk).
//
// The atomic filter deliberately does NOT check `factory.sentToFactoryAt`
// even though an earlier draft of this feature's spec called for it -
// verified directly against verifyOrder above: for factory-mode orders,
// `factory.sentToFactoryAt` is stamped in the SAME $set as the verify
// itself ("verification IS 'sent to Factory'"), so that field is already
// non-null the instant verify succeeds and would make revert permanently
// unreachable. `status === VERIFIED` (not yet dispatched) plus the
// reservation-not-consumed check already fully capture the real
// irreversibility boundary (stock consumption at dispatch, per A5).
export async function revertOrderVerification({ orderId, actorUser }) {
  assertUser(actorUser);
  if (normalizeUpper(actorUser?.role) !== ROLES.ADMIN) {
    throw new ApiError(403, "Only Admin can revert a verification");
  }
  if (!orderId) {
    throw new ApiError(400, "Missing orderId");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Dispatcher-assigned orders are reviewed by their dispatcher, not Admin
  // (A3) - reverting one from the admin workspace would be undoing an
  // action Admin never took. Kept as a plain guard (not a conflict) since
  // it's about the wrong actor, not stale state.
  if ((order.dealerSnapshot?.fulfillmentMode || "FACTORY") === "DISPATCHER") {
    throw new ApiError(400, "Dispatcher-assigned orders cannot be reverted from the admin workspace");
  }

  const previousStatus = order.status;

  let revertedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: ORDER_STATUS.VERIFIED,
          "stockReservation.status": { $ne: "CONSUMED" },
        },
        {
          $set: {
            status: ORDER_STATUS.SUBMITTED,
            review: {
              reviewedByRole: null,
              reviewedByUserId: null,
              reviewedAt: null,
              reviewNote: "",
            },
            unverifiedAt: new Date(),
            unverifiedBy: getUserId(actorUser),
          },
          $push: {
            statusHistory: {
              fromStatus: previousStatus || "",
              toStatus: ORDER_STATUS.SUBMITTED,
              note: "Verification reverted by the Admin",
              changedByUserId: getUserId(actorUser),
              changedByRole: normalizeUpper(actorUser.role),
              changedAt: new Date(),
            },
          },
        },
        { new: true, session },
      );

      if (!updated) {
        throw await buildOrderConflictErrorFresh(orderId, {
          message: "This order can no longer be reverted — it may have already moved on.",
        });
      }

      await releaseReservationForOrder({
        order: updated,
        actorUser,
        reason: "Verification reverted by admin",
        note: "",
        session,
      });

      revertedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return revertedOrder;
}
