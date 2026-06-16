import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import Dealer from "../models/DealerProfile.model.js";
import Order from "../models/Order.model.js";
import { notifyDispatcherApplicationSubmitted } from "./adminNotification.service.js";
import { archiveVerifiedOrderToGoogleSheets } from "./googleSheetsArchive.service.js";

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

export async function createDispatcherApplication(payload = {}) {
  const name = normalizeText(payload.name);
  const companyName = normalizeText(payload.companyName);
  const phone = normalizeText(payload.phone);
  const email = normalizeEmail(payload.email);
  const address = normalizeText(payload.address);
  const notes = normalizeText(payload.notes);

  if (!name) throw new Error("Name is required");
  if (!phone) throw new Error("Phone is required");
  if (!email) throw new Error("Email is required");

  const existing = await Dispatcher.findOne({ email });
  if (existing) {
    throw new Error("Dispatcher application with this email already exists");
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

  return dispatcher;
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

export async function verifyDispatcher(dispatcherId, payload = {}) {
  const dispatcher = await getDispatcherById(dispatcherId);

  dispatcher.status = DISPATCHER_STATUS.VERIFIED;
  dispatcher.isActive = true;

  if (payload.notes !== undefined) {
    dispatcher.notes = normalizeText(payload.notes);
  }

  await dispatcher.save();
  return dispatcher;
}

export async function rejectDispatcher(dispatcherId, payload = {}) {
  const dispatcher = await getDispatcherById(dispatcherId);

  dispatcher.status = DISPATCHER_STATUS.REJECTED;
  dispatcher.isActive = false;

  if (payload.notes !== undefined) {
    dispatcher.notes = normalizeText(payload.notes);
  }

  await dispatcher.save();
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

export async function listMyOrders({
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

  const query = { dispatcherId };

  if (archive) {
    query.status = { $in: ["VERIFIED", "REJECTED", "ARCHIVED"] };
  } else if (status) {
    query.status = normalizeStatus(status);
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
  })
    .populate("dealerId", "companyName contactName email phone address status")
    .populate("dispatcherId", "name companyName email phone")
    .lean();

  if (!order) {
    throw new Error("Assigned order not found");
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
    throw new Error("Only submitted orders can be verified");
  }

  const reviewNote =
    normalizeText(payload.reviewNote) ||
    normalizeText(payload.note) ||
    normalizeText(payload.reason);

  order.status = "VERIFIED";
  order.review = {
    ...(order.review || {}),
    reviewedByRole: "DISPATCHER",
    reviewedByDispatcherId: dispatcherId,
    reviewedAt: new Date(),
    reviewNote,
  };

  if (payload.internalNote !== undefined) {
    order.internalNote = normalizeText(payload.internalNote);
  }

  if ("updatedBy" in order) {
    order.updatedBy = user?.sub || null;
  }

  await order.save();

  archiveVerifiedOrderToGoogleSheets(order).catch((error) => {
    console.error("[google-sheets-archive] Failed to archive verified order", {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      message: error?.message,
    });
  });

  return order;
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
    throw new Error("Only submitted orders can be rejected");
  }

  const reviewNote =
    normalizeText(payload.reviewNote) ||
    normalizeText(payload.note) ||
    normalizeText(payload.reason);

  order.status = "REJECTED";
  order.review = {
    ...(order.review || {}),
    reviewedByRole: "DISPATCHER",
    reviewedByDispatcherId: dispatcherId,
    reviewedAt: new Date(),
    reviewNote,
  };

  if (payload.internalNote !== undefined) {
    order.internalNote = normalizeText(payload.internalNote);
  }

  if ("updatedBy" in order) {
    order.updatedBy = user?.sub || null;
  }

  await order.save();
  return order;
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
