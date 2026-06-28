import ApiError from "../utils/apiError.js";

import { ROLES } from "../constants/roles.js";
import {
  DEALER_APPLICATION_STATUS,
  DEALER_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from "../constants/statuses.js";

import DealerApplication from "../models/DealerApplication.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import Order from "../models/Order.model.js";
import Payment from "../models/Payment.model.js";
import Product from "../models/Product.model.js";
import { priceProductLine } from "../utils/pricing.js";
import {
  notifyAssignedDealerOrderSubmitted,
  notifyDealerApplicationSubmitted,
  notifyFactoryOrderSubmitted,
} from "./adminNotification.service.js";

function generateOrderNumber() {
  const now = Date.now();
  return `ORD-${now}`;
}

export async function createDealerOrder({
  dealerId,
  userId,
  items,
  paymentMethod,
  dealerNote,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Order must contain at least one item.");
  }

  const skus = items.map((item) => item.sku);
  const products = await Product.find({
    sku: { $in: skus },
    isActive: true,
  }).lean();

  const productMap = new Map(products.map((p) => [p.sku, p]));

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(item.sku);

    if (!product) {
      throw new ApiError(404, `Product not found for SKU ${item.sku}`);
    }

    const priced = priceProductLine({
      product,
      quantity: item.quantity,
    });

    orderItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      quantity: priced.quantity,
      unit: product.uom?.base || product.pack?.unit || "PCS",
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
    });

    subtotal += priced.lineTotal;
  }

  const dealer = await DealerProfile.findById(dealerId).populate({
    path: "dispatcherId",
    select: "name companyName email phone status isActive",
  });

  if (!dealer) throw new ApiError(404, "Dealer profile not found");

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    dealerId,
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
      dealer.fulfillmentMode === "DISPATCHER"
        ? dealer.dispatcherId?._id || dealer.dispatcherId || null
        : null,
    dispatcherSnapshot:
      dealer.fulfillmentMode === "DISPATCHER" && dealer.dispatcherId
        ? {
            name: dealer.dispatcherId.name || "",
            companyName: dealer.dispatcherId.companyName || "",
            email: dealer.dispatcherId.email || "",
            phone: dealer.dispatcherId.phone || "",
          }
        : {
            name: "",
            companyName: "",
            email: "",
            phone: "",
          },
    items: orderItems,
    totals: {
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      currency: "NPR",
    },
    payment: {
      method: paymentMethod,
    },
    dealerNote: dealerNote || "",
    submittedByUserId: userId,
  });

  if ((dealer.fulfillmentMode || "FACTORY") === "FACTORY") {
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
// Helpers
// ----------------------------

async function getActiveDealerProfile(dealerId) {
  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer profile not found");
  if (dealer.status === DEALER_STATUS.SUSPENDED)
    throw new ApiError(403, "Dealer account is suspended");
  return dealer;
}

function requireDealerId(user) {
  const dealerId =
    user?.dealerId || user?.dealer?._id || user?.dealer?.id || null;

  if (!dealerId) {
    throw new ApiError(401, "Dealer identity missing from session");
  }

  return String(dealerId);
}

function sanitizeStr(v, max = 200) {
  return String(v || "")
    .trim()
    .slice(0, max);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOrderForReport(order, dealer = null) {
  const snapshot = order.dealerSnapshot || {};
  const dispatcherSnapshot = order.dispatcherSnapshot || {};

  return {
    _id: order._id,
    orderNumber: order.orderNumber || "",
    status: order.status || "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    dealer: {
      _id: dealer?._id || order.dealerId || null,
      companyName: dealer?.companyName || snapshot.companyName || "",
      contactName: dealer?.contactName || snapshot.contactName || "",
      phone: dealer?.phone || snapshot.phone || "",
      email: dealer?.email || snapshot.email || "",
      fulfillmentMode:
        dealer?.fulfillmentMode || snapshot.fulfillmentMode || "FACTORY",
    },
    dispatcher: {
      _id: order.dispatcherId || null,
      name: dispatcherSnapshot.name || "",
      companyName: dispatcherSnapshot.companyName || "",
    },
    payment: {
      method: order.payment?.method || "",
    },
    totals: {
      subtotal: Number(order.totals?.subtotal || 0),
      total: Number(order.totals?.total || 0),
      currency: order.totals?.currency || "NPR",
    },
  };
}

// ----------------------------
// Public: dealer application
// ----------------------------

export async function applyForDealership(payload = {}) {
  const companyName = sanitizeStr(payload.companyName, 120);
  const contactName = sanitizeStr(payload.contactName, 120);
  const phone = sanitizeStr(payload.phone, 40);
  const email = sanitizeStr(payload.email, 160).toLowerCase();

  if (!companyName || !contactName || !phone || !email) {
    throw new ApiError(
      400,
      "companyName, contactName, phone, email are required",
    );
  }

  // Prevent spamming duplicate applications for the same email that are still pending/review
  const existing = await DealerApplication.findOne({
    email,
  }).lean();

  if (existing) {
    return { ok: true, applicationId: existing._id, status: existing.status };
  }

  const app = await DealerApplication.create({
    companyName,
    contactName,
    phone,
    email,
    address: sanitizeStr(payload.address, 200),
    panVat: sanitizeStr(payload.panVat, 80),
    notes: sanitizeStr(payload.notes, 500),
    status: DEALER_APPLICATION_STATUS.PENDING,
  });

  notifyDealerApplicationSubmitted(app).catch((error) => {
    console.warn("[admin-notification] dealer application:", error.message);
  });

  return { ok: true, applicationId: app._id, status: app.status };
}

// ----------------------------
// Dealer profile (self)
// ----------------------------

export async function getMyProfile({ user }) {
  const dealerId = requireDealerId(user);
  const dealer = await getActiveDealerProfile(dealerId);
  return dealer;
}

export async function updateMyProfile({ user, patch = {} }) {
  const dealerId = requireDealerId(user);
  const dealer = await getActiveDealerProfile(dealerId);

  if (typeof patch.contactName === "string") {
    dealer.contactName = sanitizeStr(patch.contactName, 120);
  }
  if (typeof patch.phone === "string") {
    dealer.phone = sanitizeStr(patch.phone, 40);
  }
  if (typeof patch.address === "string") {
    dealer.address = sanitizeStr(patch.address, 200);
  }
  if (typeof patch.panVat === "string") {
    dealer.panVat = sanitizeStr(patch.panVat, 80);
  }

  await dealer.save();
  return { ok: true, item: dealer };
}

// ----------------------------
// Orders (dealer)
// ----------------------------

export async function listMyOrders({
  user,
  status,
  page = 1,
  limit = 20,
  q,
} = {}) {
  const dealerId = requireDealerId(user);
  await getActiveDealerProfile(dealerId);

  const query = { dealerId, isDeleted: { $ne: true } };

  if (status) {
    const normalizedStatus =
      String(status).toUpperCase() === "ARCHIVE"
        ? "ARCHIVED"
        : String(status).toUpperCase();

    query.status = normalizedStatus;
  }

  const search = sanitizeStr(q, 120).toLowerCase();
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "payment.method": { $regex: search, $options: "i" } },
      { "payment.reference": { $regex: search, $options: "i" } },
      { "payment.referenceNo": { $regex: search, $options: "i" } },
      { dealerNote: { $regex: search, $options: "i" } },
      { internalNote: { $regex: search, $options: "i" } },
    ];
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * perPage;

  const [items, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Order.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: currentPage,
    limit: perPage,
  };
}

export async function getMyOrderStatementsReport({
  user,
  from,
  to,
  status = "",
  minTotal = "",
  maxTotal = "",
} = {}) {
  const dealerId = requireDealerId(user);
  const dealer = await getActiveDealerProfile(dealerId);

  if ((from && !to) || (!from && to)) {
    throw new ApiError(400, "Choose both report dates or use all time");
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (
    (fromDate && Number.isNaN(fromDate.getTime())) ||
    (toDate && Number.isNaN(toDate.getTime()))
  ) {
    throw new ApiError(400, "Invalid report date range");
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new ApiError(400, "Report start date must be before end date");
  }

  const query = { dealerId, isDeleted: { $ne: true } };

  if (fromDate && toDate) {
    query.createdAt = {
      $gte: fromDate,
      $lte: toDate,
    };
  }

  const normalizedStatus = sanitizeStr(status, 40).toUpperCase();
  if (normalizedStatus) {
    if (["ARCHIVE", "ARCHIVED"].includes(normalizedStatus)) {
      query.status = {
        $in: [
          "VERIFIED",
          "REJECTED",
          "PROCESSING",
          "AWAITING_SHIPMENT",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CLOSED",
          "CANCELLED",
        ],
      };
    } else if (normalizedStatus === "PENDING") {
      query.status = "SUBMITTED";
    } else {
      query.status = normalizedStatus;
    }
  }

  const parseAmount = (value, label) => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new ApiError(400, `Invalid ${label} amount`);
    }
    return n;
  };

  const minAmount = parseAmount(minTotal, "minimum");
  const maxAmount = parseAmount(maxTotal, "maximum");

  if (minAmount !== null || maxAmount !== null) {
    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
      throw new ApiError(400, "Minimum amount cannot exceed maximum amount");
    }
    query["totals.total"] = {};
    if (minAmount !== null) query["totals.total"].$gte = minAmount;
    if (maxAmount !== null) query["totals.total"].$lte = maxAmount;
  }

  const totalCount = await Order.countDocuments(query);
  const maxReportRows = 5000;
  if (totalCount > maxReportRows) {
    throw new ApiError(
      413,
      `Report contains ${totalCount} orders. Narrow the filters below ${maxReportRows} orders.`,
    );
  }

  const orders = await Order.find(query)
    .sort({ createdAt: 1, orderNumber: 1 })
    .select(
      "orderNumber dealerId dealerSnapshot dispatcherId dispatcherSnapshot totals payment.method status createdAt updatedAt",
    )
    .lean();

  const items = orders.map((order) => normalizeOrderForReport(order, dealer));
  const totals = items.reduce(
    (acc, order) => {
      acc.subtotal += Number(order.totals?.subtotal || 0);
      acc.total += Number(order.totals?.total || 0);
      acc.currency = order.totals?.currency || acc.currency;
      acc.byStatus[order.status || "UNKNOWN"] =
        (acc.byStatus[order.status || "UNKNOWN"] || 0) + 1;
      return acc;
    },
    {
      subtotal: 0,
      total: 0,
      currency: "NPR",
      byStatus: {},
    },
  );

  return {
    filters: {
      from: fromDate,
      to: toDate,
      dealerId: String(dealerId),
      dealerName: dealer.companyName || "",
      status: normalizedStatus,
      minTotal: minAmount,
      maxTotal: maxAmount,
    },
    items,
    dealers: [
      {
        _id: dealer._id,
        companyName: dealer.companyName || "",
        contactName: dealer.contactName || "",
        phone: dealer.phone || "",
        email: dealer.email || "",
        fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
        orderCount: items.length,
        subtotal: totals.subtotal,
        total: totals.total,
      },
    ],
    totals: {
      orderCount: items.length,
      dealerCount: items.length ? 1 : 0,
      subtotal: totals.subtotal,
      total: totals.total,
      currency: totals.currency,
      byStatus: totals.byStatus,
    },
  };
}

export async function getMyOrder({ user, orderId } = {}) {
  const dealerId = requireDealerId(user);
  await getActiveDealerProfile(dealerId);

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findOne({
    _id: orderId,
    dealerId,
  }).lean();

  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

/**
 * Create order from a dealer cart.
 * Expected payload shape (keep your frontend aligned):
 * - items: [{ sku, name, unit, qty, rate, amount }]
 * - totals: { subtotal, tax, discount, total, currency }
 * - payment: { method, note, referenceNo, proofUrl }
 * - dealerNote (optional)
 */
export async function createOrder({ user, payload = {} }) {
  const dealerId = requireDealerId(user);
  const dealer = await getActiveDealerProfile(dealerId);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw new ApiError(400, "Order items are required");
  }

  const cleanItems = items.map((it) => {
    const quantity = num(it.quantity ?? it.qty);
    const unitPrice = num(it.unitPrice ?? it.rate);
    const lineTotal = num(it.lineTotal ?? it.amount ?? quantity * unitPrice);

    return {
      productId: it.productId || null,
      sku: sanitizeStr(it.sku, 60),
      code: sanitizeStr(it.code, 60),
      name: sanitizeStr(it.name, 160),
      category: sanitizeStr(it.category, 120),
      variantLabel: sanitizeStr(it.variantLabel, 120),
      packLabel: sanitizeStr(it.packLabel || it.unit, 80),
      quantity,
      unit: sanitizeStr(it.unit, 30),
      unitPrice,
      lineTotal,
      notes: sanitizeStr(it.notes, 200),
    };
  });

  const totals =
    payload.totals && typeof payload.totals === "object" ? payload.totals : {};

  const cleanTotals = {
    subtotal: num(totals.subtotal),
    tax: num(totals.tax),
    discount: num(totals.discount),
    total: num(totals.total),
    currency: sanitizeStr(totals.currency || "NPR", 10),
  };

  if (cleanTotals.total <= 0) {
    throw new ApiError(400, "Invalid order total");
  }

  const payment =
    payload.payment && typeof payload.payment === "object"
      ? payload.payment
      : {};

  const cleanPayment = {
    method: sanitizeStr(payment.method, 30),
    note: sanitizeStr(payment.note, 200),
    referenceNo: sanitizeStr(payment.referenceNo, 80),
    reference: sanitizeStr(payment.reference || payment.referenceNo, 80),
    proofUrl: sanitizeStr(payment.proofUrl, 500),
  };

  if (!cleanPayment.method) {
    throw new ApiError(400, "Payment method is required before placing order");
  }

  let dispatcher = null;
  if (dealer.fulfillmentMode === "DISPATCHER" && dealer.dispatcherId) {
    dispatcher = await Dispatcher.findById(dealer.dispatcherId).select(
      "name companyName email phone status isActive",
    );
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    dealerId: dealer._id,
    dispatcherId:
      dealer.fulfillmentMode === "DISPATCHER" ? dealer.dispatcherId : null,
    dealerSnapshot: {
      companyName: dealer.companyName || "",
      contactName: dealer.contactName || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address: dealer.address || "",
      panVat: dealer.panVat || "",
      fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
    },
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
    status: ORDER_STATUS?.SUBMITTED ?? "SUBMITTED",
    items: cleanItems,
    totals: cleanTotals,
    payment: cleanPayment,
    dealerNote: sanitizeStr(payload.dealerNote, 500),
    currentVersion: 1,
    submittedByUserId: user?.sub || user?._id || user?.id || null,
  });

  if ((dealer.fulfillmentMode || "FACTORY") === "FACTORY") {
    notifyFactoryOrderSubmitted(order).catch((error) => {
      console.warn("[admin-notification] factory order:", error.message);
    });
  } else {
    notifyAssignedDealerOrderSubmitted(order).catch((error) => {
      console.warn("[dispatcher-notification] assigned order:", error.message);
    });
  }

  return {
    ok: true,
    orderId: order._id,
    item: order,
  };
}

// ----------------------------
// Payments (dealer)
// ----------------------------

export async function submitPayment({ user, orderId, payload = {} }) {
  const dealerId = requireDealerId(user);
  await getActiveDealerProfile(dealerId);

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findOne({
    _id: orderId,
    dealerId,
  }).select("_id totals");

  if (!order) throw new ApiError(404, "Order not found");

  const amount = num(payload.amount);
  if (amount <= 0) throw new ApiError(400, "Invalid amount");

  const payment = await Payment.create({
    orderId: order._id,
    dealerId,
    method: sanitizeStr(payload.method, 30),
    amount,
    proofUrl: sanitizeStr(payload.proofUrl, 500),
    note: sanitizeStr(payload.note, 200),
    status: PAYMENT_STATUS?.PENDING ?? "PENDING",
  });

  return { ok: true, paymentId: payment._id };
}

export async function listMyPayments({
  user,
  status,
  orderId,
  page = 1,
  limit = 20,
} = {}) {
  const dealerId = requireDealerId(user);
  await getActiveDealerProfile(dealerId);

  const q = { dealerId };
  if (status) q.status = status;
  if (orderId) q.orderId = orderId;

  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * perPage;

  const [items, total] = await Promise.all([
    Payment.find(q).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Payment.countDocuments(q),
  ]);

  return { items, total, page: currentPage, limit: perPage };
}

export async function getMyOrderOutstanding({ user, orderId } = {}) {
  const dealerId = requireDealerId(user);
  await getActiveDealerProfile(dealerId);

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findOne({
    _id: orderId,
    dealerId,
  }).select("totals");

  if (!order) throw new ApiError(404, "Order not found");

  const verifiedStatuses = [
    PAYMENT_STATUS?.VERIFIED ?? "VERIFIED",
    PAYMENT_STATUS?.APPROVED ?? "APPROVED",
    PAYMENT_STATUS?.CONFIRMED ?? "CONFIRMED",
  ];

  const rows = await Payment.find({
    orderId,
    dealerId,
    status: { $in: verifiedStatuses },
  }).select("amount");

  const paid = rows.reduce((sum, r) => sum + num(r.amount), 0);
  const total = num(order.totals?.total);
  const outstanding = Math.max(0, total - paid);

  return {
    orderId,
    total,
    paid,
    outstanding,
    currency: order.totals?.currency || "NPR",
  };
}
