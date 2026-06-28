import nodemailer from "nodemailer";

import Order, { FACTORY_STAGE, ORDER_STATUS } from "../models/Order.model.js";
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

let smtpTransport = null;

const STATUS_LABELS = Object.freeze({
  SUBMITTED: "Submitted",
  PROCESSING: "Processing",
  AWAITING_SHIPMENT: "Awaiting Shipment",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
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

function stageForStatus(status) {
  switch (status) {
    case ORDER_STATUS.PROCESSING:
      return FACTORY_STAGE.PREPARING;
    case ORDER_STATUS.OUT_FOR_DELIVERY:
      return FACTORY_STAGE.SHIPMENT;
    case ORDER_STATUS.DELIVERED:
      return FACTORY_STAGE.COMPLETED;
    case ORDER_STATUS.REJECTED:
      return FACTORY_STAGE.COMPLETED;
    case ORDER_STATUS.AWAITING_SHIPMENT:
    case ORDER_STATUS.VERIFIED:
      return FACTORY_STAGE.INBOX;
    default:
      return null;
  }
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
  });
  return smtpTransport;
}

async function sendDealerStatusEmail({ order, status, reason = "" }) {
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

async function pushStatus({
  order,
  nextStatus,
  actorUser,
  note = "",
  reason = "",
  emailDealer = true,
}) {
  const previousStatus = order.status;
  if (previousStatus === nextStatus) return order;

  const changedAt = new Date();
  let dealerEmailSentAt = null;
  if (emailDealer) {
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

  order.status = nextStatus;
  order.factoryStage = stageForStatus(nextStatus) || order.factoryStage;
  order.statusHistory.push({
    fromStatus: previousStatus || "",
    toStatus: nextStatus,
    note: clean(note),
    reason: clean(reason),
    changedByUserId: actorId(actorUser),
    changedByRole: normalize(actorUser?.role),
    changedAt,
    dealerEmailSentAt,
  });

  return order;
}

function baseFactoryQuery() {
  return {
    isDeleted: { $ne: true },
    "dealerSnapshot.fulfillmentMode": "FACTORY",
    status: {
      $in: [
        ORDER_STATUS.AWAITING_SHIPMENT,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.VERIFIED,
        ORDER_STATUS.REJECTED,
      ],
    },
  };
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

function applyStage(query, stage = "") {
  const normalized = normalize(stage || "ALL");
  if (!normalized || normalized === "ALL") return query;

  if (normalized === FACTORY_STAGE.INBOX) {
    query.status = { $in: [ORDER_STATUS.AWAITING_SHIPMENT, ORDER_STATUS.VERIFIED] };
    return query;
  }
  if (normalized === FACTORY_STAGE.PREPARING) {
    query.status = ORDER_STATUS.PROCESSING;
    return query;
  }
  if (normalized === FACTORY_STAGE.SHIPMENT) {
    query.status = ORDER_STATUS.OUT_FOR_DELIVERY;
    return query;
  }
  if (normalized === FACTORY_STAGE.COMPLETED) {
    query.status = { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REJECTED] };
  }
  return query;
}

async function loadFactoryOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (!isFactoryOrder(order)) throw new ApiError(403, "Only factory orders are allowed");
  return order;
}

export async function sendOrderToFactory({ orderId, adminUser, note = "" }) {
  requireActor(adminUser, "ADMIN");
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (!isFactoryOrder(order)) {
    throw new ApiError(400, "Only factory-routed orders can be sent to Factory");
  }
  if (![ORDER_STATUS.SUBMITTED, ORDER_STATUS.PROCESSING, ORDER_STATUS.VERIFIED].includes(order.status)) {
    throw new ApiError(400, `Order cannot be sent to Factory from status ${order.status}`);
  }

  await reserveStockForOrder({
    order,
    actorUser: adminUser,
    reason: "Admin verified order for Factory fulfillment",
    note,
  });

  await pushStatus({
    order,
    nextStatus: ORDER_STATUS.AWAITING_SHIPMENT,
    actorUser: adminUser,
    note,
  });
  order.factory = {
    ...(order.factory?.toObject?.() || order.factory || {}),
    sentToFactoryAt: new Date(),
    sentToFactoryBy: actorId(adminUser),
  };
  order.factoryStage = FACTORY_STAGE.INBOX;
  await order.save();

  createFactoryNotification({
    category: NOTIFICATION_CATEGORY.FACTORY_ORDER,
    title: `Order ${order.orderNumber || ""} sent to Factory`.trim(),
    description: `${order.dealerSnapshot?.companyName || "A dealer"} is awaiting factory preparation.`,
    targetUrl: `/factory/dashboard/orders?orderId=${encodeURIComponent(String(order._id))}`,
    dealerId: order.dealerId,
    orderId: order._id,
    metadata: {
      orderNumber: order.orderNumber || "",
      companyName: order.dealerSnapshot?.companyName || "",
      total: order.totals?.total || 0,
      currency: order.totals?.currency || "NPR",
    },
  }).catch((error) => {
    console.warn("[factory-notification] order sent:", error.message);
  });

  return order;
}

export async function getFactoryDashboard() {
  const [stock, awaitingShipment, preparing, outForDelivery, deliveredRecent] =
    await Promise.all([
      listStock({ limit: 1 }),
      Order.countDocuments({
        ...baseFactoryQuery(),
        status: { $in: [ORDER_STATUS.AWAITING_SHIPMENT, ORDER_STATUS.VERIFIED] },
      }),
      Order.countDocuments({ ...baseFactoryQuery(), status: ORDER_STATUS.PROCESSING }),
      Order.countDocuments({
        ...baseFactoryQuery(),
        status: ORDER_STATUS.OUT_FOR_DELIVERY,
      }),
      Order.countDocuments({
        ...baseFactoryQuery(),
        status: ORDER_STATUS.DELIVERED,
        updatedAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      }),
    ]);

  return {
    stock: stock.summary,
    orders: {
      awaitingShipment,
      preparing,
      outForDelivery,
      deliveredRecent,
    },
  };
}

export async function listFactoryOrders({
  stage = "ALL",
  status = "",
  q = "",
  page = 1,
  limit = 50,
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(100, Math.max(1, Number(limit || 50)));
  const query = applySearch(applyStage(baseFactoryQuery(), stage), q);
  const normalizedStatus = normalize(status);
  if (normalizedStatus) query.status = normalizedStatus;

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    Order.countDocuments(query),
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

export async function getFactoryOrder({ orderId }) {
  const order = await loadFactoryOrder(orderId);
  return order;
}

export async function startPreparingOrder({ orderId, factoryUser, note = "" }) {
  requireActor(factoryUser, "FACTORY");
  const order = await loadFactoryOrder(orderId);
  if (![ORDER_STATUS.AWAITING_SHIPMENT, ORDER_STATUS.VERIFIED].includes(order.status)) {
    throw new ApiError(400, `Order cannot be prepared from status ${order.status}`);
  }

  await pushStatus({
    order,
    nextStatus: ORDER_STATUS.PROCESSING,
    actorUser: factoryUser,
    note,
  });
  order.factory = {
    ...(order.factory?.toObject?.() || order.factory || {}),
    preparingAt: new Date(),
    preparingBy: actorId(factoryUser),
  };
  order.factoryStage = FACTORY_STAGE.PREPARING;
  await order.save();
  return order;
}

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
  if (![ORDER_STATUS.PROCESSING, ORDER_STATUS.AWAITING_SHIPMENT, ORDER_STATUS.VERIFIED].includes(order.status)) {
    throw new ApiError(400, `Order cannot be dispatched from status ${order.status}`);
  }

  const stockLines = await consumeReservationForOrder({
    order,
    actorUser: factoryUser,
    reason: `Order ${order.orderNumber || order._id} marked out for delivery`,
    note: remarks,
  });

  await pushStatus({
    order,
    nextStatus: ORDER_STATUS.OUT_FOR_DELIVERY,
    actorUser: factoryUser,
    note: remarks,
  });
  order.factory = {
    ...(order.factory?.toObject?.() || order.factory || {}),
    outForDeliveryAt: new Date(),
    outForDeliveryBy: actorId(factoryUser),
    driverName: clean(driverName),
    driverPhone: clean(driverPhone),
    vehicleNumber: clean(vehicleNumber),
    remarks: clean(remarks),
  };
  order.stockDeduction = {
    ...(order.stockDeduction?.toObject?.() || order.stockDeduction || {}),
    deductedAt: order.stockDeduction?.deductedAt || new Date(),
    deductedBy: order.stockDeduction?.deductedBy || actorId(factoryUser),
    lines: stockLines,
  };
  order.factoryStage = FACTORY_STAGE.SHIPMENT;
  await order.save();
  return order;
}

export async function markDelivered({ orderId, factoryUser, note = "" }) {
  requireActor(factoryUser, "FACTORY");
  const order = await loadFactoryOrder(orderId);
  if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
    throw new ApiError(400, "Order must be out for delivery before it can be delivered");
  }

  await pushStatus({
    order,
    nextStatus: ORDER_STATUS.DELIVERED,
    actorUser: factoryUser,
    note,
  });
  order.factory = {
    ...(order.factory?.toObject?.() || order.factory || {}),
    deliveredAt: new Date(),
    deliveredBy: actorId(factoryUser),
  };
  order.factoryStage = FACTORY_STAGE.COMPLETED;
  await order.save();
  return order;
}

export async function rejectFactoryOrder({ orderId, factoryUser, reason, note = "" }) {
  requireActor(factoryUser, "FACTORY");
  if (!clean(reason)) throw new ApiError(400, "Rejection reason is required");

  const order = await loadFactoryOrder(orderId);
  if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.REJECTED].includes(order.status)) {
    throw new ApiError(400, `Order cannot be rejected from status ${order.status}`);
  }

  await releaseReservationForOrder({
    order,
    actorUser: factoryUser,
    reason: "Factory rejected order before shipment",
    note: reason,
  });

  await pushStatus({
    order,
    nextStatus: ORDER_STATUS.REJECTED,
    actorUser: factoryUser,
    note,
    reason,
  });
  order.rejection = {
    reason: clean(reason),
    rejectedAt: new Date(),
    rejectedBy: actorId(factoryUser),
    rejectedByRole: "FACTORY",
  };
  order.factoryStage = FACTORY_STAGE.COMPLETED;
  await order.save();
  return order;
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
  if (![ORDER_STATUS.AWAITING_SHIPMENT, ORDER_STATUS.PROCESSING].includes(order.status)) {
    throw new ApiError(400, `Order cannot be amended from status ${order.status}`);
  }

  const previousItems = (order.items || []).map((item) =>
    item?.toObject?.() ? item.toObject() : item,
  );
  if (Array.isArray(items) && items.length > 0) {
    order.items = items;
    await adjustReservationForOrderAmendment({
      order,
      previousItems,
      nextItems: items,
      actorUser: factoryUser,
      reason: "Factory amended reserved order",
      note,
    });
  }
  order.amendments.push({
    amendedByUserId: actorId(factoryUser),
    amendedByRole: "FACTORY",
    reason: clean(reason),
    note: clean(note),
    amendedAt: new Date(),
  });
  await order.save();
  return order;
}

export async function getProformaInvoice({ orderId }) {
  const order = await loadFactoryOrder(orderId);
  const subtotal = Number(order.totals?.subtotal ?? order.totals?.taxableAmount ?? 0);
  const tax = Number(order.totals?.tax || 0);
  const total = Number(order.totals?.total || 0);

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    generatedAt: new Date().toISOString(),
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
      currency: order.totals?.currency || "NPR",
    },
    copies: ["Factory Copy", "Driver Copy", "Dealer Copy"],
  };
}
