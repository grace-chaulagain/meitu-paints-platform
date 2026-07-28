import crypto from "crypto";

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
import User from "../models/User.model.js";
import { priceProductLine } from "../utils/pricing.js";
import { buildPublicAppUrl } from "../utils/publicUrl.js";
import {
  smtpConfigured,
  sendMail,
  renderEmailShell,
  renderCallout,
} from "../utils/email.js";
import { IS_PRODUCTION } from "../config/env.js";
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

  // sellable:false blocks a kit's own component products (factory-internal
  // stock, not directly orderable - see stock.service.js's
  // resolveOrderStockLines) from ever being ordered directly, even via a
  // crafted payload that bypasses the catalog UI.
  const skus = items.map((item) => item.sku);
  const products = await Product.find({
    sku: { $in: skus },
    isActive: true,
    sellable: { $ne: false },
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
// Email confirmation (dealer application)
// ----------------------------
// A DealerApplication has no User yet, so this can't reuse PasswordResetToken
// (which is keyed by userId) - the token instead lives directly on the
// application doc (see DealerApplication.model.js). Same nodemailer-per-
// service convention as auth.service.js / adminNotification.service.js /
// order.service.js / factory.service.js (no shared mailer util exists in
// this codebase), and the same crypto-hash-token-with-expiry shape already
// proven for password-setup links.

const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000; // 48h
// Only meant to absorb an accidental double-click/double form-submit
// (network hiccup, double tap) - not to block a genuinely impatient
// applicant who resubmits a minute later because the first email never
// showed up. It was previously 60s, which routinely ate a real second
// attempt: applyForDealership still returned ok:true either way, so the
// applicant saw the same "check your inbox" success card whether or not
// anything was actually resent. The real anti-abuse throttle is
// applicationRateLimit (12/hr/IP) at the route level, not this.
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 8 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function buildDealerEmailVerificationLink(token) {
  return buildPublicAppUrl(`/confirm-dealer-email?token=${encodeURIComponent(String(token))}`);
}

function dealerEmailConfirmationTemplate({ token, companyName }) {
  const link = buildDealerEmailVerificationLink(token);
  const subject = "Confirm your email for your Meitu Paints dealer application";

  const text = [
    `Hello ${companyName || "there"},`,
    "",
    "Thanks for applying to become a Meitu Paints dealer.",
    "Please confirm this email address so we can review your application. This link is valid for 48 hours.",
    link,
    "",
    "If you didn't submit a dealer application, you can safely ignore this email.",
  ].join("\n");

  const html = renderEmailShell({
    preheader: "Confirm your email to continue your Meitu Paints dealer application.",
    eyebrow: "Confirm Your Email",
    title: "Confirm Your Email",
    intro: `Hello ${companyName || "there"}, thanks for applying to become a Meitu Paints dealer. Please confirm this email address so we can review your application. This link stays valid for 48 hours.`,
    calloutHtml: renderCallout("If you didn't submit a dealer application, you can safely ignore this email."),
    ctaLabel: "Confirm Email",
    ctaUrl: link,
  });

  return { subject, text, html };
}

// Persists a fresh token before attempting the send, so a failed send still
// leaves the application in a resendable state (no transaction needed - the
// worst case is a resubmit/resend re-triggers this from scratch).
async function issueAndSendDealerEmailVerification(app) {
  const rawToken = crypto.randomBytes(32).toString("hex");

  app.emailVerification = {
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    sentAt: new Date(),
  };
  app.emailVerifiedAt = null;
  await app.save();

  if (IS_PRODUCTION && !smtpConfigured()) {
    throw new ApiError(500, "SMTP is not configured");
  }
  if (smtpConfigured()) {
    const { subject, text, html } = dealerEmailConfirmationTemplate({
      token: rawToken,
      companyName: app.companyName,
    });
    await sendMail({ to: app.email, subject, text, html });
  }

  return rawToken;
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

  // Catches the case an unconfirmed-application resend below doesn't: this
  // email already belongs to a real account (dealer, dispatcher, admin, or
  // factory) - previously this collision was only ever discovered at admin
  // approval time (verifyDealerApplication's own User.findOne check further
  // down the pipeline), well after the applicant had already waited days.
  const existingUser = await User.findOne({ email }).select("_id").lean();
  if (existingUser) {
    throw new ApiError(
      409,
      "This email is already registered to an existing account. Please use a different email or sign in instead.",
    );
  }

  // Prevent spamming duplicate applications for the same email that are still pending/review.
  // Hydrated (not .lean()) since a still-unconfirmed existing application needs
  // to be re-saved below to reissue/resend its confirmation token.
  const existing = await DealerApplication.findOne({ email });

  if (existing) {
    const isTerminal =
      existing.status === DEALER_APPLICATION_STATUS.VERIFIED ||
      existing.status === DEALER_APPLICATION_STATUS.REJECTED;

    let resentToken;
    let emailSent = false;
    if (!isTerminal && !existing.emailVerifiedAt) {
      // Applicant likely never got the first email (typo, spam filter) and is
      // retrying - reissue and resend rather than silently no-op'ing, which is
      // the whole point of this feature. Small cooldown guards against a
      // double-submit double-firing the send; applicationRateLimit (12/hr/IP
      // at the route level) is the primary throttle.
      const sentAt = existing.emailVerification?.sentAt?.getTime?.() || 0;
      if (Date.now() - sentAt > EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
        resentToken = await issueAndSendDealerEmailVerification(existing);
        emailSent = true;
      }
    }

    return {
      ok: true,
      applicationId: existing._id,
      status: existing.status,
      token: IS_PRODUCTION ? undefined : resentToken,
      // Lets the frontend tell a real resend apart from a no-op (cooldown
      // hit, already verified/rejected) instead of showing the same
      // "check your inbox" success card either way.
      emailSent,
    };
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

  const rawToken = await issueAndSendDealerEmailVerification(app);

  return {
    ok: true,
    applicationId: app._id,
    status: app.status,
    token: IS_PRODUCTION ? undefined : rawToken,
    emailSent: true,
  };
}

// Live pre-submit check for the registration form (on email-field blur) -
// deliberately scoped to just User, not DealerApplication/Dispatcher, so it
// never blocks the legitimate "resend confirmation" flow above or makes a
// previously-rejected applicant unable to retry. The real source of truth
// is applyForDealership's own User.findOne gate above; this is only the
// pre-submit UX layer.
export async function checkDealerEmailAvailability(rawEmail) {
  const email = sanitizeStr(rawEmail, 160).toLowerCase();
  if (!email) throw new ApiError(400, "email is required");

  const existingUser = await User.findOne({ email }).select("_id").lean();
  return { available: !existingUser };
}

// Called from the /confirm-dealer-email landing page. The admin-facing
// "new application submitted" notification fires from here (not from
// applyForDealership above) so admins only ever see applications from a
// confirmed, reachable email - not noise from typos or spam that never
// confirm.
export async function verifyDealerApplicationEmail({ token }) {
  const app = await DealerApplication.findOne({
    "emailVerification.tokenHash": hashToken(token),
  });
  if (!app) throw new ApiError(400, "Invalid confirmation link", { code: "INVALID" });

  if (app.emailVerifiedAt) {
    return { ok: true, applicationId: app._id, alreadyVerified: true };
  }

  if (!app.emailVerification?.expiresAt || app.emailVerification.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(400, "This confirmation link has expired", { code: "EXPIRED" });
  }

  app.emailVerifiedAt = new Date();
  app.emailVerification.tokenHash = null; // single-use
  await app.save();

  notifyDealerApplicationSubmitted(app).catch((error) => {
    console.warn("[admin-notification] dealer application:", error.message);
  });

  return { ok: true, applicationId: app._id, companyName: app.companyName };
}

// Neutral response regardless of whether an eligible application was found -
// this is a fresh public, unauthenticated surface, so it shouldn't be usable
// to enumerate which emails have a pending application (same posture as
// auth.service.js's NEUTRAL_AUTH_RESPONSE for forgot-password).
const NEUTRAL_RESEND_RESPONSE = {
  ok: true,
  message: "If an eligible application exists, a confirmation link has been sent.",
};

export async function resendDealerApplicationVerification({ email }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return NEUTRAL_RESEND_RESPONSE;

  const app = await DealerApplication.findOne({
    email: normalizedEmail,
    status: { $in: [DEALER_APPLICATION_STATUS.PENDING, DEALER_APPLICATION_STATUS.IN_REVIEW] },
    emailVerifiedAt: null,
  }).sort({ createdAt: -1 });

  if (app) {
    await issueAndSendDealerEmailVerification(app);
  }

  return NEUTRAL_RESEND_RESPONSE;
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
    const normalizedStatus = String(status).toUpperCase();

    // "Archived" isn't a status value in the Order schema's enum - it's
    // tracked via a separate archivedAt timestamp (auto-set for every
    // status except SUBMITTED), the same definition adminInsights.service.js
    // already uses. A literal status match here would never match any
    // document.
    if (normalizedStatus === "ARCHIVE" || normalizedStatus === "ARCHIVED") {
      query.archivedAt = { $ne: null };
    } else {
      query.status = normalizedStatus;
    }
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
      query.status = { $ne: "SUBMITTED" };
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
    currency: order.totals?.currency || "NPR",
    // Schema only has a nested proof.fileUrl/proof.note - top-level
    // proofUrl/note fields (as written before this fix) are silently
    // dropped by Mongoose since they aren't in the schema at all.
    proof: {
      fileUrl: sanitizeStr(payload.proofUrl, 500),
      note: sanitizeStr(payload.note, 200),
    },
    status: PAYMENT_STATUS.PENDING_VERIFICATION,
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

  // APPROVED/CONFIRMED aren't real values in the Payment status enum -
  // they never matched anything. VERIFIED and PAID are the two statuses
  // that actually represent money received.
  const verifiedStatuses = [PAYMENT_STATUS.VERIFIED, PAYMENT_STATUS.PAID];

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
