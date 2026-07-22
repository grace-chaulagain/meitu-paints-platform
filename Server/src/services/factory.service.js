import mongoose from "mongoose";
import nodemailer from "nodemailer";

import Order, {
  ORDER_ORIGIN,
  ORDER_STATUS,
} from "../models/Order.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import ApiError from "../utils/apiError.js";
import {
  createFactoryNotification,
  NOTIFICATION_CATEGORY,
} from "./notification.service.js";
import {
  adjustReservationForOrderAmendment,
  consumeReservationForOrder,
  listStock,
  releaseReservationForOrder,
  reserveStockForOrder,
} from "./stock.service.js";
import { creditDispatcherStock } from "./dispatcherStock.service.js";
import Invoice from "../models/Invoice.model.js";
import { issueInvoiceForOrder } from "./invoice.service.js";
import { recordPurchaseMovement } from "./dealerInventory.service.js";

let smtpTransport = null;

const STATUS_LABELS = Object.freeze({
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  DISPATCHED: "Dispatched",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
});

function clean(value = "") {
  return String(value || "").trim();
}

function normalize(value = "") {
  return clean(value).toUpperCase();
}

function actorId(user) {
  return user?.id || user?._id || user?.sub || null;
}

function requireActor(user, role = "FACTORY") {
  const id = actorId(user);
  if (!id) throw new ApiError(401, "Authentication required");
  if (role && normalize(user?.role) !== role) throw new ApiError(403, "Forbidden");
  return id;
}

function isFactoryOrder(order) {
  return (order?.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY";
}

function statusLabel(status = "") {
  return STATUS_LABELS[status] || clean(status).replace(/_/g, " ");
}

function smtpConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE) === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return smtpTransport;
}

export async function sendDealerStatusEmail({ order, status, reason = "" }) {
  const to = clean(order?.dealerSnapshot?.email);
  if (!to || !smtpConfigured()) {
    if (!smtpConfigured()) {
      console.warn("[factory-email] SMTP is not configured; skipped dealer status email.");
    }
    return null;
  }

  const label = statusLabel(status);
  const { SMTP_USER, MAIL_FROM, APP_URL } = process.env;
  const orderUrl = `${String(APP_URL || "").replace(/\/+$/, "")}/dealer/orders`;
  const dealerName =
    order.dealerSnapshot?.companyName || order.dealerSnapshot?.contactName || "Dealer";
  const rejection = reason ? `\n\nReason: ${reason}` : "";
  const text = [
    `Hello ${dealerName},`,
    "",
    `Your order ${order.orderNumber || ""} is now ${label}.`,
    rejection.trim(),
    orderUrl ? `View your order history: ${orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await getSmtpTransport().sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject: `Meitu Paints order ${order.orderNumber || ""}: ${label}`.trim(),
    text,
    html: text.replace(/\n/g, "<br/>"),
  });

  return new Date();
}

// Sends the best-effort dealer notification email for a status transition
// and returns the statusHistory entry to persist. Deliberately does NOT
// mutate or save the order itself - the caller applies the transition via
// an atomic, status-guarded findOneAndUpdate, which is what actually
// prevents two concurrent requests from both succeeding on the same order.
async function buildStatusHistoryEntry({
  order,
  nextStatus,
  actorUser,
  note = "",
  reason = "",
  emailDealer = true,
}) {
  let dealerEmailSentAt = null;
  if (emailDealer && order.status !== nextStatus) {
    try {
      dealerEmailSentAt = await sendDealerStatusEmail({
        order,
        status: nextStatus,
        reason,
      });
    } catch (error) {
      console.warn("[factory-email] dealer status email failed:", error.message);
    }
  }

  return {
    fromStatus: order.status || "",
    toStatus: nextStatus,
    note: clean(note),
    reason: clean(reason),
    changedByUserId: actorId(actorUser),
    changedByRole: normalize(actorUser?.role),
    changedAt: new Date(),
    dealerEmailSentAt,
  };
}

// Defaults to FACTORY-only, matching every existing caller (the operational
// kanban and the dashboard overview only ever want orders the factory
// itself fulfills). The Invoice Center is the one caller that overrides this
// to ALL/DISPATCHER so it can show a proforma for every order regardless of
// who fulfills it.
function baseFactoryQuery(fulfillmentMode = "FACTORY") {
  const query = {
    isDeleted: { $ne: true },
    status: {
      $in: [
        ORDER_STATUS.VERIFIED,
        ORDER_STATUS.DISPATCHED,
        ORDER_STATUS.COMPLETED,
        ORDER_STATUS.REJECTED,
      ],
    },
  };

  const normalized = normalize(fulfillmentMode || "FACTORY");
  if (normalized === "DISPATCHER") {
    query["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  } else if (normalized !== "ALL") {
    query["dealerSnapshot.fulfillmentMode"] = "FACTORY";
  }

  return query;
}

function applySearch(query, q = "") {
  const search = clean(q);
  if (!search) return query;
  const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  query.$or = [
    { orderNumber: rx },
    { "dealerSnapshot.companyName": rx },
    { "dealerSnapshot.contactName": rx },
    { "dealerSnapshot.email": rx },
  ];
  return query;
}

// "Stage" is now just a friendly alias for the order's own status - there's
// no separate factoryStage field to keep in sync anymore, so this purely
// translates the kanban column name the factory dashboard asks for into a
// status filter.
function applyStage(query, stage = "") {
  const normalized = normalize(stage || "ALL");
  if (!normalized || normalized === "ALL") return query;

  if (normalized === "INBOX") {
    query.status = ORDER_STATUS.VERIFIED;
    return query;
  }
  if (normalized === "SHIPMENT") {
    query.status = ORDER_STATUS.DISPATCHED;
    return query;
  }
  if (normalized === "COMPLETED") {
    query.status = { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REJECTED] };
  }
  return query;
}

async function loadFactoryOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (!isFactoryOrder(order)) throw new ApiError(403, "Only factory orders are allowed");
  return order;
}

export async function getFactoryDashboard() {
  const [stock, awaitingShipment, dispatched, completedRecent] =
    await Promise.all([
      listStock({ limit: 1 }),
      Order.countDocuments({ ...baseFactoryQuery(), status: ORDER_STATUS.VERIFIED }),
      Order.countDocuments({ ...baseFactoryQuery(), status: ORDER_STATUS.DISPATCHED }),
      Order.countDocuments({
        ...baseFactoryQuery(),
        status: ORDER_STATUS.COMPLETED,
        updatedAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      }),
    ]);

  return {
    stock: stock.summary,
    orders: {
      awaitingShipment,
      dispatched,
      completedRecent,
    },
  };
}

export async function listFactoryOrders({
  stage = "ALL",
  status = "",
  origin = "",
  dealerId = "",
  q = "",
  page = 1,
  limit = 50,
  fulfillmentMode = "FACTORY",
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(100, Math.max(1, Number(limit || 50)));
  const query = applySearch(applyStage(baseFactoryQuery(fulfillmentMode), stage), q);
  const normalizedStatus = normalize(status);
  if (normalizedStatus) query.status = normalizedStatus;

  const normalizedOrigin = normalize(origin);
  if (["DEALER", "DISPATCHER_REPLENISHMENT"].includes(normalizedOrigin)) {
    query.orderOrigin = normalizedOrigin;
  }

  if (dealerId) query.dealerId = dealerId;

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    Order.countDocuments(query),
  ]);

  const invoices = await Invoice.find({ orderId: { $in: items.map((item) => item._id) } })
    .select("orderId invoiceNumber issuedAt")
    .lean();
  const invoiceByOrderId = new Map(invoices.map((invoice) => [String(invoice.orderId), invoice]));
  const enrichedItems = items.map((item) => {
    const invoice = invoiceByOrderId.get(String(item._id));
    return {
      ...item,
      invoiceNumber: invoice?.invoiceNumber || null,
      invoiceIssuedAt: invoice?.issuedAt || null,
    };
  });

  return {
    items: enrichedItems,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

// Powers the Dealer filter dropdown on the Factory Invoice Center - the
// full dealer directory (not just dealers with orders on the current page),
// mirroring admin.service.js:listVerifiedDispatchers's shape/simplicity
// (no pagination - this list is small enough to populate a dropdown in one
// shot).
export async function listVerifiedDealersForFactory() {
  const items = await DealerProfile.find({
    status: DEALER_STATUS.VERIFIED,
    "deletion.pending": { $ne: true },
  })
    .select("companyName contactName")
    .sort({ companyName: 1 })
    .lean();
  return { items };
}

export async function issueFactoryInvoice({ orderId, factoryUser }) {
  requireActor(factoryUser, "FACTORY");
  return issueInvoiceForOrder({ orderId, factoryUser });
}

export async function getFactoryOrder({ orderId }) {
  const order = await loadFactoryOrder(orderId);
  return order;
}

// The factory's single fulfillment action: generates the invoice, assigns
// a driver, and dispatches the order in one step - there's no separate
// "start preparing" checkpoint anymore, so this is reachable directly from
// VERIFIED (the factory's Inbox).
export async function markOutForDelivery({
  orderId,
  factoryUser,
  driverName,
  driverPhone,
  vehicleNumber = "",
  remarks = "",
}) {
  requireActor(factoryUser, "FACTORY");
  const order = await loadFactoryOrder(orderId);
  if (order.status !== ORDER_STATUS.VERIFIED) {
    throw new ApiError(400, `Order cannot be dispatched from status ${order.status}`);
  }

  const historyEntry = await buildStatusHistoryEntry({
    order,
    nextStatus: ORDER_STATUS.DISPATCHED,
    actorUser: factoryUser,
    note: remarks,
  });

  let updatedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: ORDER_STATUS.VERIFIED },
        {
          $set: {
            status: ORDER_STATUS.DISPATCHED,
            factory: {
              ...(order.factory?.toObject?.() || order.factory || {}),
              outForDeliveryAt: new Date(),
              outForDeliveryBy: actorId(factoryUser),
              driverName: clean(driverName),
              driverPhone: clean(driverPhone),
              vehicleNumber: clean(vehicleNumber),
              remarks: clean(remarks),
            },
          },
          $push: { statusHistory: historyEntry },
        },
        { new: true, session },
      );

      if (!updated) {
        throw new ApiError(
          409,
          "Order status changed before it could be dispatched. Please refresh and try again.",
        );
      }

      // Deducts stock and persists order.stockDeduction itself, inside
      // this same transaction - if this throws (e.g. a concurrent
      // dispatch already consumed the reservation), the status
      // transition above rolls back too.
      await consumeReservationForOrder({
        order: updated,
        actorUser: factoryUser,
        reason: `Order ${updated.orderNumber || updated._id} dispatched`,
        note: remarks,
        session,
      });

      // For a dispatcher's own replenishment order, dispatching also
      // credits that dispatcher's regional stock ledger - same
      // transaction, so a failure here rolls back the central-stock
      // deduction and status transition too.
      if (updated.orderOrigin === ORDER_ORIGIN.DISPATCHER_REPLENISHMENT) {
        await creditDispatcherStock({
          dispatcherId: updated.dispatcherCustomerId,
          items: updated.items,
          orderId: updated._id,
          actorUser: factoryUser,
          session,
        });
      }

      updatedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return updatedOrder;
}

export async function markDelivered({ orderId, factoryUser, note = "" }) {
  requireActor(factoryUser, "FACTORY");
  const order = await loadFactoryOrder(orderId);
  if (order.status !== ORDER_STATUS.DISPATCHED) {
    throw new ApiError(400, "Order must be dispatched before it can be completed");
  }

  const historyEntry = await buildStatusHistoryEntry({
    order,
    nextStatus: ORDER_STATUS.COMPLETED,
    actorUser: factoryUser,
    note,
  });

  let updatedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: ORDER_STATUS.DISPATCHED },
        {
          $set: {
            status: ORDER_STATUS.COMPLETED,
            factory: {
              ...(order.factory?.toObject?.() || order.factory || {}),
              deliveredAt: new Date(),
              deliveredBy: actorId(factoryUser),
            },
          },
          $push: { statusHistory: historyEntry },
        },
        { new: true, session },
      );

      if (!updated) {
        throw new ApiError(
          409,
          "Order status changed before it could be marked completed. Please refresh and try again.",
        );
      }

      // Dealer-origin orders (dispatcher replenishment orders have no
      // dealerId) credit the dealer's own inventory ledger the moment
      // goods are physically handed over - this is the "Dealer receives
      // order from Meitu -> Inventory automatically increases" step.
      if (updated.dealerId) {
        await recordPurchaseMovement({
          dealerId: updated.dealerId,
          items: updated.items,
          orderId: updated._id,
          actorUser: factoryUser,
          actorRole: "FACTORY",
          session,
        });
      }

      updatedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return updatedOrder;
}

export async function rejectFactoryOrder({ orderId, factoryUser, reason, note = "" }) {
  requireActor(factoryUser, "FACTORY");
  if (!clean(reason)) throw new ApiError(400, "Rejection reason is required");

  const order = await loadFactoryOrder(orderId);
  const disallowed = [ORDER_STATUS.COMPLETED, ORDER_STATUS.REJECTED];
  if (disallowed.includes(order.status)) {
    throw new ApiError(400, `Order cannot be rejected from status ${order.status}`);
  }

  const historyEntry = await buildStatusHistoryEntry({
    order,
    nextStatus: ORDER_STATUS.REJECTED,
    actorUser: factoryUser,
    note,
    reason,
  });

  let updatedOrder;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: { $nin: disallowed } },
        {
          $set: {
            status: ORDER_STATUS.REJECTED,
            rejection: {
              reason: clean(reason),
              rejectedAt: new Date(),
              rejectedBy: actorId(factoryUser),
              rejectedByRole: "FACTORY",
            },
          },
          $push: { statusHistory: historyEntry },
        },
        { new: true, session },
      );

      if (!updated) {
        throw new ApiError(
          409,
          "Order status changed before it could be rejected. Please refresh and try again.",
        );
      }

      await releaseReservationForOrder({
        order: updated,
        actorUser: factoryUser,
        reason: "Factory rejected order before shipment",
        note: reason,
        session,
      });

      updatedOrder = updated;
    });
  } finally {
    session.endSession();
  }

  return updatedOrder;
}

export async function amendFactoryOrder({
  orderId,
  factoryUser,
  items = null,
  reason,
  note = "",
}) {
  requireActor(factoryUser, "FACTORY");
  if (!clean(reason)) throw new ApiError(400, "Amendment reason is required");

  const order = await loadFactoryOrder(orderId);
  if (order.status !== ORDER_STATUS.VERIFIED) {
    throw new ApiError(400, `Order cannot be amended from status ${order.status}`);
  }

  const previousItems = (order.items || []).map((item) =>
    item?.toObject?.() ? item.toObject() : item,
  );

  order.amendments.push({
    amendedByUserId: actorId(factoryUser),
    amendedByRole: "FACTORY",
    reason: clean(reason),
    note: clean(note),
    amendedAt: new Date(),
  });

  if (Array.isArray(items) && items.length > 0) {
    order.items = items;
    // adjustReservationForOrderAmendment saves the order itself (inside
    // its own transaction), so this one save also covers the items and
    // amendments pushed above - no separate save needed.
    await adjustReservationForOrderAmendment({
      order,
      previousItems,
      nextItems: items,
      actorUser: factoryUser,
      reason: "Factory amended reserved order",
      note,
    });
  } else {
    await order.save();
  }

  return order;
}

// Persists the factory's pre-dispatch checklist/driver-details progress
// onto the order itself, so closing the order modal before clicking
// Dispatch (or a page reload) doesn't lose it - reopening the same order
// rehydrates from this instead of forcing the Proforma Invoice and
// checklist toggles to be redone. Only meaningful while the order is still
// awaiting factory dispatch; once dispatched, `order.factory.*` is the
// source of truth instead.
export async function updateDispatchPrep({ orderId, factoryUser, patch = {} }) {
  requireActor(factoryUser, "FACTORY");
  const order = await loadFactoryOrder(orderId);
  if (order.status !== ORDER_STATUS.VERIFIED) {
    throw new ApiError(400, `Dispatch preparation is not available from status ${order.status}`);
  }

  const current = order.dispatchPrep || {};
  const next = { ...(current.toObject?.() || current) };

  if (typeof patch.stockConfirmed === "boolean") next.stockConfirmed = patch.stockConfirmed;
  if (typeof patch.packingConfirmed === "boolean") next.packingConfirmed = patch.packingConfirmed;
  if (patch.driverName !== undefined) next.driverName = clean(patch.driverName);
  if (patch.driverPhone !== undefined) next.driverPhone = clean(patch.driverPhone);
  if (patch.vehicleNumber !== undefined) next.vehicleNumber = clean(patch.vehicleNumber);

  // Editing driver details after the PI was already generated (fixing a
  // mistake) keeps the original generatedAt/By stamp - only an explicit
  // (re)generate action bumps it, which is what actually re-renders the PDF.
  if (patch.generateProforma) {
    next.proformaGeneratedAt = new Date();
    next.proformaGeneratedBy = actorId(factoryUser);
  }

  order.dispatchPrep = next;
  await order.save();
  return order;
}

export async function getProformaInvoice({ orderId }) {
  const order = await loadFactoryOrder(orderId);
  const subtotal = Number(order.totals?.subtotal ?? order.totals?.taxableAmount ?? 0);
  const tax = Number(order.totals?.tax || 0);
  const total = Number(order.totals?.total || 0);
  const discount = Number(order.totals?.discount || 0);

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    serialNumber: order.serialNumber,
    generatedAt: order.proformaIssuedAt || null,
    dealer: order.dealerSnapshot || {},
    payment: order.payment || {},
    driver: {
      name: order.factory?.driverName || "",
      phone: order.factory?.driverPhone || "",
      vehicleNumber: order.factory?.vehicleNumber || "",
    },
    remarks: order.factory?.remarks || "",
    items: order.items || [],
    totals: {
      subtotal,
      tax,
      total,
      discount,
      currency: order.totals?.currency || "NPR",
    },
    copies: ["Factory Copy", "Driver Copy", "Dealer Copy"],
  };
}
