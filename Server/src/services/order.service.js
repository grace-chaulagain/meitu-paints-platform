import crypto from "crypto";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

import ApiError from "../utils/apiError.js";
import Order, {
  ORDER_REVIEWED_BY,
  ORDER_STATUS,
} from "../models/Order.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import User from "../models/User.model.js";
import { ROLES } from "../constants/roles.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import {
  notifyAssignedDealerOrderSubmitted,
  notifyFactoryOrderSubmitted,
} from "./adminNotification.service.js";
import { sendOrderToFactory } from "./factory.service.js";
import { archiveVerifiedOrderToGoogleSheets } from "./googleSheetsArchive.service.js";
import { buildOrderSummaryPdfAttachment } from "./orderPdf.service.js";
import {
  checkOrderStock,
  releaseReservationForOrder,
  reserveStockForOrder,
} from "./stock.service.js";

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
// SMTP helpers
// ----------------------------

let _smtpTransport = null;

function smtpConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } =
    process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new ApiError(500, "SMTP is not configured");
  }

  _smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE) === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return _smtpTransport;
}

async function sendMail({ to, subject, text, html, attachments = [] }) {
  const { SMTP_USER, MAIL_FROM } = process.env;
  const transporter = getSmtpTransport();

  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
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
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${y}${m}${d}-${rand}`;
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

  if (isAdmin(actorUser)) return;

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
    throw new ApiError(
      400,
      `Order cannot be reviewed from status ${order.status}`,
    );
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

function sanitizeOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one order item is required");
  }

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

    const lineTotal =
      item?.lineTotal !== undefined && item?.lineTotal !== null
        ? parsePositiveNumber(item.lineTotal, `Item ${index + 1} lineTotal`)
        : Number((quantity * unitPrice).toFixed(2));

    return {
      productId: item?.productId || null,
      sku: normalizeText(item?.sku),
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
  const orderItemsHtml = (order.items || [])
    .map(
      (item, index) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.name || ""}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.packLabel || item.variantLabel || item.unit || "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.quantity || 0).toLocaleString()}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.unitPrice || 0).toLocaleString()}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.lineTotal || 0).toLocaleString()}</td>
        </tr>
      `,
    )
    .join("");

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

  const html = `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:820px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:linear-gradient(135deg,#b91c1c 0%,#dd5127 100%);padding:22px 28px;">
            <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:rgba(255,255,255,.84);">Meitu Paints</div>
            <div style="margin-top:8px;font-size:28px;line-height:1.15;font-weight:700;color:#fff;">Factory Order Bill</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding-bottom:18px;font-size:14px;line-height:1.8;color:#374151;">
                  <strong>Order Number:</strong> ${order.orderNumber}<br/>
                  <strong>Dealer:</strong> ${order.dealerSnapshot?.companyName || "-"}<br/>
                  <strong>Contact:</strong> ${order.dealerSnapshot?.contactName || "-"}<br/>
                  <strong>Phone:</strong> ${order.dealerSnapshot?.phone || "-"}<br/>
                  <strong>Address:</strong> ${order.dealerSnapshot?.address || "-"}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">#</th>
                  <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Item</th>
                  <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Pack / Variant</th>
                  <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Qty</th>
                  <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Rate</th>
                  <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${orderItemsHtml}
              </tbody>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
              <tr>
                <td style="font-size:14px;line-height:1.9;color:#374151;">
                  <strong>Subtotal:</strong> ${Number(order.totals?.subtotal || 0).toLocaleString()}<br/>
                  <strong>Discount:</strong> ${Number(order.totals?.discount || 0).toLocaleString()}<br/>
                  <strong>Tax:</strong> ${Number(order.totals?.tax || 0).toLocaleString()}<br/>
                  <strong>Total:</strong> ${order.totals?.currency || "NPR"} ${Number(order.totals?.total || 0).toLocaleString()}
                </td>
              </tr>
            </table>

            <div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;color:#374151;font-size:13px;line-height:1.6;">
              A downloadable PDF copy of this verified factory order summary is attached to this email for factory processing and records.
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

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
  const sanitizedItems = sanitizeOrderItems(items);
  const normalizedTotals = buildOrderTotals({
    items: sanitizedItems,
    totals,
  });
  const paymentMethod = normalizeText(payment?.method).toUpperCase();

  if (!paymentMethod) {
    throw new ApiError(400, "Payment method is required before placing order");
  }

  let orderNumber = buildOrderNumber();
  for (let i = 0; i < 5; i += 1) {
    const exists = await Order.exists({ orderNumber });
    if (!exists) break;
    orderNumber = buildOrderNumber();
  }

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
  page = 1,
  limit = 20,
}) {
  assertUser(actorUser);

  const query = { isDeleted: { $ne: true } };
  const normalizedStatus = normalizeUpper(status);

  if (normalizedStatus) {
    query.status = normalizedStatus;
  } else if (archive === true || String(archive) === "true") {
    query.status = {
      $in: [
        ORDER_STATUS.VERIFIED,
        ORDER_STATUS.REJECTED,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.AWAITING_SHIPMENT,
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.CLOSED,
        ORDER_STATUS.CANCELLED,
      ],
    };
  } else {
    query.status = ORDER_STATUS.SUBMITTED;
  }

  const normalizedFulfillmentMode = normalizeUpper(fulfillmentMode);
  if (["FACTORY", "DISPATCHER"].includes(normalizedFulfillmentMode)) {
    query["dealerSnapshot.fulfillmentMode"] = normalizedFulfillmentMode;
  }

  if (isDealer(actorUser)) {
    query.dealerId = actorUser.dealerId;
  } else if (isDispatcher(actorUser)) {
    const dispatcher = await getDispatcherForUser(actorUser);
    query.dispatcherId = dispatcher._id;
    query["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  } else if (!isAdmin(actorUser)) {
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

  const safePage = Math.max(1, Number(page || 1));
  const perPage = Math.min(100, Math.max(1, Number(limit || 20)));
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
  if (!isAdmin(actorUser)) {
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
    const sanitizedItems = sanitizeOrderItems(items);
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
  order.status = ORDER_STATUS.VERIFIED;
  order.review = {
    reviewedByRole: reviewMeta.reviewedByRole,
    reviewedByUserId: reviewMeta.reviewedByUserId,
    reviewedAt: new Date(),
    reviewNote: normalizeText(reviewNote),
  };
  order.statusHistory.push({
    fromStatus: previousStatus || "",
    toStatus: ORDER_STATUS.VERIFIED,
    note: normalizeText(reviewNote) || "Order verified.",
    changedByUserId: getUserId(actorUser),
    changedByRole: normalizeUpper(actorUser.role),
    changedAt: new Date(),
  });

  const isFactoryOrder =
    (order.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY";

  if (isFactoryOrder) {
    await reserveStockForOrder({
      order,
      actorUser,
      reason: "Admin verified order for Factory fulfillment",
      note: normalizeText(reviewNote),
    });

    if (!smtpConfigured()) {
      console.warn("[factory-email] SMTP is not configured; skipped factory order email.");
    } else {
      const recipients = await buildFactoryRecipients();
      const mail = buildFactoryOrderEmail(order);
      const pdfAttachment = buildOrderSummaryPdfAttachment(order);

      await sendMail({
        to: recipients,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: [pdfAttachment],
      });

      order.factoryEmailSentAt = new Date();
    }
  }

  await order.save();

  let finalOrder = order;
  if (isFactoryOrder) {
    finalOrder = await sendOrderToFactory({
      orderId: order._id,
      adminUser: actorUser,
      note:
        normalizeText(reviewNote) ||
        "Order verified and automatically sent to Factory.",
    });
  }

  archiveVerifiedOrderToGoogleSheets(finalOrder).catch((error) => {
    console.error("[google-sheets-archive] Failed to archive verified order", {
      orderId: String(finalOrder._id),
      orderNumber: finalOrder.orderNumber,
      message: error?.message,
    });
  });

  return finalOrder;
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

  if (!normalizeText(reviewNote)) {
    throw new ApiError(400, "Rejection reason is required");
  }

  const previousStatus = order.status;
  await releaseReservationForOrder({
    order,
    actorUser,
    reason: "Order rejected during review",
    note: normalizeText(reviewNote),
  });

  order.status = ORDER_STATUS.REJECTED;
  order.review = {
    reviewedByRole: reviewMeta.reviewedByRole,
    reviewedByUserId: reviewMeta.reviewedByUserId,
    reviewedAt: new Date(),
    reviewNote: normalizeText(reviewNote),
  };
  order.rejection = {
    reason: normalizeText(reviewNote),
    rejectedAt: new Date(),
    rejectedBy: getUserId(actorUser),
    rejectedByRole: normalizeUpper(actorUser.role),
  };
  order.statusHistory.push({
    fromStatus: previousStatus || "",
    toStatus: ORDER_STATUS.REJECTED,
    note: normalizeText(reviewNote),
    reason: normalizeText(reviewNote),
    changedByUserId: getUserId(actorUser),
    changedByRole: normalizeUpper(actorUser.role),
    changedAt: new Date(),
  });

  await order.save();
  return order;
}
