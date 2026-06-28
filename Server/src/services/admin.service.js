import mongoose from "mongoose";

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
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import User, { USER_ACCOUNT_STATUS } from "../models/User.model.js";

import Order from "../models/Order.model.js";
import Payment from "../models/Payment.model.js";
import OrderRevision from "../models/OrderRevision.model.js";
import Invoice from "../models/Invoice.model.js";
import Notification from "../models/Notification.model.js";

import { createPasswordSetupTokenForUser } from "./auth.service.js";
import {
  getAdminNotificationSettings,
  sendAdminNotificationTest,
  updateAdminNotificationSettings,
} from "./adminNotification.service.js";
import {
  getDealerAnalytics as getDealerAnalyticsService,
  getDealerLeaderboard as getDealerLeaderboardService,
} from "./dealerAnalytics.service.js";

// ----------------------------
// Helpers
// ----------------------------

async function runInTxn(work) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await work(session);
    });
    return out;
  } finally {
    session.endSession();
  }
}

async function uniqueUsernameFromEmail(email) {
  const base =
    String(email || "")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";

  if (!(await User.exists({ username: base }))) return base;

  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}_${suffix}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }

  throw new ApiError(500, "Could not generate a unique username");
}

function normalizeEmail(email = "") {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function actorUserId(adminUser) {
  return adminUser?.id || adminUser?._id || adminUser?.sub || null;
}

function deletionDeadline() {
  return new Date(Date.now() + TRASH_RETENTION_MS);
}

function requireExactConfirmation({ expected, actual, label }) {
  const expectedText = normalizeText(expected);
  const actualText = normalizeText(actual);

  if (!expectedText || actualText !== expectedText) {
    throw new ApiError(
      400,
      `Type "${expectedText || label}" exactly to confirm ${label}.`,
    );
  }
}

function deletionState(deletion = {}) {
  return {
    pending: Boolean(deletion?.pending),
    requestedAt: deletion?.requestedAt || null,
    deleteAfter: deletion?.deleteAfter || null,
    reason: deletion?.reason || "",
  };
}

function assertDeletionNotPending(entity, label) {
  if (entity?.deletion?.pending) {
    throw new ApiError(
      409,
      `${label} deletion is pending. Undo the deletion before making changes.`,
    );
  }
}

function normalizeDispatcherStatus(status = "") {
  return String(status || "")
    .trim()
    .toUpperCase();
}

async function assertDispatcherActive(dispatcherId) {
  if (!dispatcherId) return;
  const d = await Dispatcher.findById(dispatcherId).select(
    "_id isActive status name",
  );
  if (!d) throw new ApiError(404, "Dispatcher not found");
  if (d.status !== DISPATCHER_STATUS.VERIFIED) {
    throw new ApiError(400, "Dispatcher is not verified");
  }
  if (!d.isActive) throw new ApiError(400, "Dispatcher is not active");
}

function buildDealerRouting({ fulfillmentMode, dispatcherId }) {
  const mode = String(fulfillmentMode || "FACTORY")
    .trim()
    .toUpperCase();

  if (!["FACTORY", "DISPATCHER"].includes(mode)) {
    throw new ApiError(400, "Invalid fulfillmentMode");
  }

  if (mode === "FACTORY") {
    return {
      fulfillmentMode: "FACTORY",
      dispatcherId: null,
    };
  }

  if (!dispatcherId) {
    throw new ApiError(
      400,
      "dispatcherId is required when fulfillmentMode is DISPATCHER",
    );
  }

  return {
    fulfillmentMode: "DISPATCHER",
    dispatcherId,
  };
}

function buildAccessState(user, allowedRole) {
  if (!user) {
    return {
      userId: null,
      accountStatus: "NO_LOGIN_ACCOUNT",
      isActive: false,
      passwordSet: false,
      passwordSetAt: null,
      invitationLastSentAt: null,
      invitationExpiresAt: null,
      canResendSetup: false,
    };
  }

  const passwordSet = Boolean(user.passwordHash || user.passwordSetAt);
  let accountStatus =
    user.accountStatus ||
    (passwordSet
      ? USER_ACCOUNT_STATUS.ACTIVE
      : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP);

  if (!passwordSet && accountStatus === USER_ACCOUNT_STATUS.ACTIVE) {
    accountStatus = USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP;
  }

  return {
    userId: user._id,
    accountStatus,
    isActive: Boolean(user.isActive),
    passwordSet,
    passwordSetAt: user.passwordSetAt || null,
    invitationLastSentAt: user.invitationLastSentAt || null,
    invitationExpiresAt: user.invitationExpiresAt || null,
    canResendSetup: Boolean(
      user.isActive &&
        user.role === allowedRole &&
        !passwordSet &&
        accountStatus !== USER_ACCOUNT_STATUS.SUSPENDED,
    ),
  };
}

function normalizeOrderForReport(order) {
  const dealer = order.dealerId || null;
  const snapshot = order.dealerSnapshot || {};
  const dispatcher = order.dispatcherId || null;
  const dispatcherSnapshot = order.dispatcherSnapshot || {};

  return {
    _id: order._id,
    orderNumber: order.orderNumber || "",
    status: order.status || "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    dealer: {
      _id: dealer?._id || null,
      companyName: dealer?.companyName || snapshot.companyName || "",
      contactName: dealer?.contactName || snapshot.contactName || "",
      phone: dealer?.phone || snapshot.phone || "",
      email: dealer?.email || snapshot.email || "",
      fulfillmentMode:
        dealer?.fulfillmentMode || snapshot.fulfillmentMode || "FACTORY",
    },
    dispatcher: {
      _id: dispatcher?._id || null,
      name: dispatcher?.name || dispatcherSnapshot.name || "",
      companyName: dispatcher?.companyName || dispatcherSnapshot.companyName || "",
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

async function getAccessStateByDealerIds(dealerIds = []) {
  if (!dealerIds.length) return new Map();

  const users = await User.find({
    dealerId: { $in: dealerIds },
    role: ROLES.DEALER,
  })
    .select(
      "role dealerId isActive accountStatus passwordSetAt invitationLastSentAt invitationExpiresAt +passwordHash",
    )
    .lean();

  return new Map(
    users.map((user) => [
      String(user.dealerId),
      buildAccessState(user, ROLES.DEALER),
    ]),
  );
}

async function getAccessStateByDispatcherIds(dispatcherIds = []) {
  if (!dispatcherIds.length) return new Map();

  const users = await User.find({
    dispatcherId: { $in: dispatcherIds },
    role: ROLES.DISPATCHER,
  })
    .select(
      "role dispatcherId isActive accountStatus passwordSetAt invitationLastSentAt invitationExpiresAt +passwordHash",
    )
    .lean();

  return new Map(
    users.map((user) => [
      String(user.dispatcherId),
      buildAccessState(user, ROLES.DISPATCHER),
    ]),
  );
}

export async function purgeExpiredAccountDeletions() {
  const now = new Date();

  const [dealers, dispatchers, dealerApplications, orders] = await Promise.all([
    DealerProfile.find({
      "deletion.pending": true,
      "deletion.deleteAfter": { $lte: now },
    })
      .select("_id")
      .lean(),
    Dispatcher.find({
      "deletion.pending": true,
      "deletion.deleteAfter": { $lte: now },
    })
      .select("_id")
      .lean(),
    DealerApplication.find({
      "deletion.pending": true,
      "deletion.deleteAfter": { $lte: now },
    })
      .select("_id")
      .lean(),
    Order.find({
      "deletion.pending": true,
      "deletion.deleteAfter": { $lte: now },
    })
      .select("_id")
      .lean(),
  ]);

  for (const dealer of dealers) {
    await runInTxn(async (session) => {
      await User.deleteMany({
        dealerId: dealer._id,
        role: ROLES.DEALER,
      }).session(session);
      await DealerProfile.deleteOne({ _id: dealer._id }).session(session);
    });
  }

  for (const dispatcher of dispatchers) {
    await runInTxn(async (session) => {
      await User.deleteMany({
        dispatcherId: dispatcher._id,
        role: ROLES.DISPATCHER,
      }).session(session);
      await Dispatcher.deleteOne({ _id: dispatcher._id }).session(session);
    });
  }

  for (const application of dealerApplications) {
    await DealerApplication.deleteOne({ _id: application._id });
  }

  for (const order of orders) {
    await runInTxn(async (session) => {
      await Payment.deleteMany({ orderId: order._id }).session(session);
      await OrderRevision.deleteMany({ orderId: order._id }).session(session);
      await Invoice.deleteMany({ orderId: order._id }).session(session);
      await Notification.deleteMany({ orderId: order._id }).session(session);
      await Order.deleteOne({ _id: order._id }).session(session);
    });
  }

  return {
    dealersPurged: dealers.length,
    dispatchersPurged: dispatchers.length,
    dealerApplicationsPurged: dealerApplications.length,
    ordersPurged: orders.length,
  };
}

function daysUntil(value) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function normalizeTrashType(type = "ALL") {
  return normalizeText(type).toUpperCase() || "ALL";
}

function shouldIncludeTrashType(itemType, filterType) {
  const filter = normalizeTrashType(filterType);
  if (filter === "ALL") return true;
  if (filter === "APPLICATION") {
    return ["DEALER_APPLICATION", "DISPATCHER_APPLICATION"].includes(itemType);
  }
  return itemType === filter;
}

function trashItemBase({ type, id, title, subtitle, status, deletion }) {
  return {
    type,
    id: String(id),
    title: title || "Deleted item",
    subtitle: subtitle || "",
    status: status || "",
    reason: deletion?.reason || "",
    requestedAt: deletion?.requestedAt || null,
    deleteAfter: deletion?.deleteAfter || null,
    daysRemaining: daysUntil(deletion?.deleteAfter),
  };
}

function countTrashItems(items) {
  const counts = {
    ALL: items.length,
    DEALER: 0,
    DISPATCHER: 0,
    ORDER: 0,
    APPLICATION: 0,
    DEALER_APPLICATION: 0,
    DISPATCHER_APPLICATION: 0,
  };

  for (const item of items) {
    counts[item.type] = (counts[item.type] || 0) + 1;
    if (["DEALER_APPLICATION", "DISPATCHER_APPLICATION"].includes(item.type)) {
      counts.APPLICATION += 1;
    }
  }

  return counts;
}

export async function listTrashItems({ type = "ALL" } = {}) {
  await purgeExpiredAccountDeletions();

  const [dealers, dispatchers, dealerApplications, orders] = await Promise.all([
    DealerProfile.find({ "deletion.pending": true })
      .select("companyName contactName email status fulfillmentMode deletion updatedAt")
      .lean(),
    Dispatcher.find({ "deletion.pending": true })
      .select("name companyName email status isActive deletion updatedAt")
      .lean(),
    DealerApplication.find({ "deletion.pending": true })
      .select("companyName contactName email status deletion updatedAt")
      .lean(),
    Order.find({ "deletion.pending": true })
      .select("orderNumber dealerSnapshot dispatcherSnapshot totals status deletion updatedAt")
      .lean(),
  ]);

  const allItems = [
    ...dealers.map((dealer) =>
      trashItemBase({
        type: "DEALER",
        id: dealer._id,
        title: dealer.companyName || dealer.email || "Dealer",
        subtitle: [dealer.contactName, dealer.email, dealer.fulfillmentMode]
          .filter(Boolean)
          .join(" · "),
        status: dealer.status,
        deletion: dealer.deletion,
      }),
    ),
    ...dispatchers.map((dispatcher) => {
      const type =
        dispatcher.status === DISPATCHER_STATUS.VERIFIED
          ? "DISPATCHER"
          : "DISPATCHER_APPLICATION";
      return trashItemBase({
        type,
        id: dispatcher._id,
        title: dispatcher.name || dispatcher.companyName || dispatcher.email,
        subtitle: [dispatcher.companyName, dispatcher.email]
          .filter(Boolean)
          .join(" · "),
        status: dispatcher.status,
        deletion: dispatcher.deletion,
      });
    }),
    ...dealerApplications.map((application) =>
      trashItemBase({
        type: "DEALER_APPLICATION",
        id: application._id,
        title: application.companyName || application.email,
        subtitle: [application.contactName, application.email]
          .filter(Boolean)
          .join(" · "),
        status: application.status,
        deletion: application.deletion,
      }),
    ),
    ...orders.map((order) =>
      trashItemBase({
        type: "ORDER",
        id: order._id,
        title: order.orderNumber || "Order",
        subtitle: [
          order.dealerSnapshot?.companyName,
          order.dispatcherSnapshot?.name || order.dispatcherSnapshot?.companyName,
          order.totals?.total
            ? `${order.totals?.currency || "NPR"} ${Number(
                order.totals.total,
              ).toLocaleString()}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        status: order.status,
        deletion: order.deletion,
      }),
    ),
  ].sort(
    (a, b) =>
      new Date(a.deleteAfter || 0).getTime() -
      new Date(b.deleteAfter || 0).getTime(),
  );

  const items = allItems.filter((item) =>
    shouldIncludeTrashType(item.type, type),
  );

  return {
    items,
    counts: countTrashItems(allItems),
    retentionDays: Math.round(TRASH_RETENTION_MS / (24 * 60 * 60 * 1000)),
  };
}

export async function restoreTrashItem({ type, id, adminUser }) {
  const normalizedType = normalizeTrashType(type);

  if (!id) throw new ApiError(400, "Missing trash item id");

  if (normalizedType === "DEALER") {
    return undoDealerDeletion({ dealerId: id, adminUser });
  }

  if (
    normalizedType === "DISPATCHER" ||
    normalizedType === "DISPATCHER_APPLICATION"
  ) {
    return undoDispatcherDeletion({ dispatcherId: id, adminUser });
  }

  if (normalizedType === "ORDER") {
    return undoOrderDeletion({ orderId: id, adminUser });
  }

  if (normalizedType === "DEALER_APPLICATION") {
    return undoDealerApplicationDeletion({ applicationId: id, adminUser });
  }

  throw new ApiError(400, "Unsupported trash item type");
}

export async function restoreAllTrashItems({ type = "ALL", adminUser } = {}) {
  const trash = await listTrashItems({ type });
  const restored = [];
  const failed = [];

  for (const item of trash.items) {
    try {
      await restoreTrashItem({ type: item.type, id: item.id, adminUser });
      restored.push({ type: item.type, id: item.id, title: item.title });
    } catch (error) {
      failed.push({
        type: item.type,
        id: item.id,
        title: item.title,
        error: error?.message || "Restore failed",
      });
    }
  }

  return {
    ok: failed.length === 0,
    restoredCount: restored.length,
    failedCount: failed.length,
    restored,
    failed,
  };
}

// ----------------------------
// Settings
// ----------------------------

export async function getNotificationSettings() {
  return getAdminNotificationSettings();
}

export async function updateNotificationSettings(payload = {}) {
  return updateAdminNotificationSettings(payload);
}

export async function testNotificationSettings() {
  return sendAdminNotificationTest();
}

// ----------------------------
// Dealer Applications
// ----------------------------

export async function listDealerApplications({
  status,
  page = 1,
  limit = 20,
} = {}) {
  const q = { "deletion.pending": { $ne: true } };
  if (status) q.status = status;

  const perPage = Math.min(100, Math.max(1, Number(limit)));
  const skip = (Math.max(1, Number(page)) - 1) * perPage;

  const [items, total] = await Promise.all([
    DealerApplication.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    DealerApplication.countDocuments(q),
  ]);

  return { items, total, page: Math.max(1, Number(page)), limit: perPage };
}

export async function getDealerApplication({ applicationId } = {}) {
  if (!applicationId) throw new ApiError(400, "Missing applicationId");
  const app = await DealerApplication.findById(applicationId).lean();
  if (!app) throw new ApiError(404, "Dealer application not found");
  if (app.deletion?.pending) throw new ApiError(404, "Dealer application not found");
  return app;
}

export async function verifyDealerApplication({
  applicationId,
  fulfillmentMode = "FACTORY",
  dispatcherId = null,
  credit = { enabled: false, limit: 0, dueDays: 0 },
  adminUser,
  reviewNote = "",
}) {
  if (!applicationId) throw new ApiError(400, "Missing applicationId");

  const routing = buildDealerRouting({ fulfillmentMode, dispatcherId });
  await assertDispatcherActive(routing.dispatcherId);

  const base = await runInTxn(async (session) => {
    const app =
      await DealerApplication.findById(applicationId).session(session);
    if (!app) throw new ApiError(404, "Dealer application not found");
    assertDeletionNotPending(app, "Dealer application");

    if (app.status === DEALER_APPLICATION_STATUS.VERIFIED) {
      throw new ApiError(400, "Dealer application is already verified");
    }
    if (app.status === DEALER_APPLICATION_STATUS.REJECTED) {
      throw new ApiError(400, "Cannot verify a rejected application");
    }

    const existingProfile = await DealerProfile.findOne({
      email: app.email,
    }).session(session);
    if (existingProfile) {
      throw new ApiError(409, "Dealer profile already exists for this email");
    }

    const existingUser = await User.findOne({ email: app.email }).session(
      session,
    );
    if (existingUser) {
      throw new ApiError(409, "User already exists for this email");
    }

    const [dealerProfile] = await DealerProfile.create(
      [
        {
          companyName: app.companyName,
          contactName: app.contactName,
          phone: app.phone,
          email: app.email,
          address: app.address || "",
          panVat: app.panVat || "",
          status: DEALER_STATUS.VERIFIED,
          fulfillmentMode: routing.fulfillmentMode,
          dispatcherId: routing.dispatcherId,
          credit: {
            enabled: Boolean(credit?.enabled),
            limit: Number(credit?.limit || 0),
            dueDays: Number(credit?.dueDays || 0),
          },
        },
      ],
      { session },
    );

    const username = await uniqueUsernameFromEmail(app.email);
    const [dealerUserDoc] = await User.create(
      [
        {
          username,
          email: app.email,
          role: ROLES.DEALER,
          dealerId: dealerProfile._id,
          isActive: true,
          accountStatus: USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP,
        },
      ],
      { session },
    );

    app.status = DEALER_APPLICATION_STATUS.VERIFIED;
    app.reviewedBy = adminUser?.id || adminUser?._id || null;
    app.reviewedAt = new Date();
    app.reviewNote = reviewNote;
    await app.save({ session });

    return {
      dealerProfile,
      dealerUser: {
        id: dealerUserDoc._id,
        email: dealerUserDoc.email,
        username: dealerUserDoc.username,
      },
      dealerUserId: dealerUserDoc._id,
      companyName: dealerProfile.companyName,
    };
  });

  const setup = await createPasswordSetupTokenForUser({
    userId: base.dealerUserId,
    accountType: ROLES.DEALER,
    displayName: base.companyName,
  });

  return {
    dealerProfile: base.dealerProfile,
    dealerUser: base.dealerUser,
    passwordSetupToken: setup.token,
  };
}

export async function rejectDealerApplication({
  applicationId,
  adminUser,
  reviewNote = "",
}) {
  if (!applicationId) throw new ApiError(400, "Missing applicationId");

  const app = await DealerApplication.findById(applicationId);
  if (!app) throw new ApiError(404, "Dealer application not found");
  assertDeletionNotPending(app, "Dealer application");
  if (app.status === DEALER_APPLICATION_STATUS.VERIFIED) {
    throw new ApiError(400, "Cannot reject a verified application");
  }

  app.status = DEALER_APPLICATION_STATUS.REJECTED;
  app.reviewedBy = adminUser.id || adminUser._id || null;
  app.reviewedAt = new Date();
  app.reviewNote = reviewNote;
  await app.save();

  return { ok: true };
}

export async function deleteDealerApplication({
  applicationId,
  confirmation = "",
  reason = "",
  adminUser,
}) {
  if (!applicationId) throw new ApiError(400, "Missing applicationId");

  const app = await DealerApplication.findById(applicationId);
  if (!app) throw new ApiError(404, "Dealer application not found");
  if (app.deletion?.pending) {
    throw new ApiError(409, "Dealer application deletion is already pending");
  }

  const expected = app.companyName || app.email || String(app._id);
  requireExactConfirmation({
    expected,
    actual: confirmation,
    label: "dealer application deletion",
  });

  const deleteAfter = deletionDeadline();
  app.deletion = {
    pending: true,
    requestedAt: new Date(),
    deleteAfter,
    requestedByUserId: actorUserId(adminUser),
    reason: normalizeText(reason),
  };
  await app.save();

  return {
    ok: true,
    applicationId: app._id,
    deleteAfter,
    deletion: deletionState(app.deletion),
  };
}

export async function undoDealerApplicationDeletion({ applicationId }) {
  if (!applicationId) throw new ApiError(400, "Missing applicationId");

  const app = await DealerApplication.findById(applicationId);
  if (!app) throw new ApiError(404, "Dealer application not found");
  if (!app.deletion?.pending) {
    throw new ApiError(400, "Dealer application deletion is not pending");
  }

  if (
    app.deletion.deleteAfter &&
    new Date(app.deletion.deleteAfter).getTime() <= Date.now()
  ) {
    await purgeExpiredAccountDeletions();
    throw new ApiError(410, "Dealer application deletion window has expired");
  }

  app.deletion = {
    pending: false,
    requestedAt: null,
    deleteAfter: null,
    requestedByUserId: null,
    reason: "",
  };
  await app.save();

  return { ok: true, applicationId: app._id };
}

// ----------------------------
// Dealers
// ----------------------------

export async function listDealers({ status, page = 1, limit = 20 } = {}) {
  await purgeExpiredAccountDeletions();

  const q = { "deletion.pending": { $ne: true } };
  if (status) q.status = status;

  const perPage = Math.min(1000, Math.max(1, Number(limit)));
  const skip = (Math.max(1, Number(page)) - 1) * perPage;

  const [items, total] = await Promise.all([
    DealerProfile.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: "dispatcherId",
        select: "name companyName email phone status isActive",
      })
      .lean(),
    DealerProfile.countDocuments(q),
  ]);

  const dealerIds = items.map((item) => item._id).filter(Boolean);
  const [orderSummaries, accessStateMap] = dealerIds.length
    ? await Promise.all([
        Order.aggregate([
        {
          $match: {
            dealerId: { $in: dealerIds },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$dealerId",
            totalOrdersAllTime: { $sum: 1 },
            totalApprovedOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "VERIFIED"] }, 1, 0],
              },
            },
            totalSubmittedOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "SUBMITTED"] }, 1, 0],
              },
            },
            totalRejectedOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0],
              },
            },
            totalApprovedSales: {
              $sum: {
                $cond: [{ $eq: ["$status", "VERIFIED"] }, "$totals.total", 0],
              },
            },
            totalSalesAllTime: { $sum: "$totals.total" },
            largestApprovedOrderValue: {
              $max: {
                $cond: [{ $eq: ["$status", "VERIFIED"] }, "$totals.total", 0],
              },
            },
            lastActivity: { $max: "$createdAt" },
            lastApprovedOrderAt: {
              $max: {
                $cond: [{ $eq: ["$status", "VERIFIED"] }, "$createdAt", null],
              },
            },
          },
        },
        ]),
        getAccessStateByDealerIds(dealerIds),
      ])
    : [[], new Map()];

  const summaryMap = new Map(
    orderSummaries.map((summary) => [String(summary._id), summary]),
  );

  return {
    items: items.map((dealer) => {
      const summary = summaryMap.get(String(dealer._id)) || {};
      const totalApprovedOrders = Number(summary.totalApprovedOrders || 0);
      const totalApprovedSales = Number(summary.totalApprovedSales || 0);
      const lastApprovedOrderAt = summary.lastApprovedOrderAt || null;
      const daysSinceLastOrder = lastApprovedOrderAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(lastApprovedOrderAt).getTime()) /
                86400000,
            ),
          )
        : null;

      return {
        ...dealer,
        deletion: deletionState(dealer.deletion),
        accessState:
          accessStateMap.get(String(dealer._id)) ||
          buildAccessState(null, ROLES.DEALER),
        analyticsSummary: {
          totalOrdersAllTime: summary.totalOrdersAllTime || 0,
          totalApprovedOrders,
          totalSubmittedOrders: summary.totalSubmittedOrders || 0,
          totalRejectedOrders: summary.totalRejectedOrders || 0,
          totalApprovedSales,
          totalSalesAllTime: summary.totalSalesAllTime || 0,
          averageApprovedOrderValue: totalApprovedOrders
            ? totalApprovedSales / totalApprovedOrders
            : 0,
          largestApprovedOrderValue: summary.largestApprovedOrderValue || 0,
          lastActivity: summary.lastActivity || null,
          lastApprovedOrderAt,
          daysSinceLastOrder,
          currentActivityStatus: !totalApprovedOrders
            ? "NO_APPROVED_ORDERS"
            : daysSinceLastOrder <= 30
              ? "ACTIVE"
              : daysSinceLastOrder <= 60
                ? "WATCH"
                : "INACTIVE",
        },
      };
    }),
    total,
    page: Math.max(1, Number(page)),
    limit: perPage,
  };
}

export async function getDealer({ dealerId } = {}) {
  await purgeExpiredAccountDeletions();

  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerId)
    .populate({
      path: "dispatcherId",
      select: "name companyName email phone status isActive",
    })
    .lean();

  if (!dealer) throw new ApiError(404, "Dealer not found");
  if (dealer.deletion?.pending) throw new ApiError(404, "Dealer not found");

  const accessStateMap = await getAccessStateByDealerIds([dealer._id]);

  return {
    ...dealer,
    deletion: deletionState(dealer.deletion),
    accessState:
      accessStateMap.get(String(dealer._id)) ||
      buildAccessState(null, ROLES.DEALER),
  };
}

export async function getDealerAnalytics({ dealerId } = {}) {
  return getDealerAnalyticsService({ dealerId });
}

export async function getDealerLeaderboard({
  sort,
  limit,
  fulfillmentMode,
  dispatcherId,
} = {}) {
  return getDealerLeaderboardService({
    sort,
    limit,
    fulfillmentMode,
    dispatcherId,
  });
}

export async function updateDealer({
  dealerId,
  companyName,
  contactName,
  phone,
  email,
  address,
  panVat,
  notes,
  adminUser,
}) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");
  assertDeletionNotPending(dealer, "Dealer");

  if (companyName !== undefined) {
    const normalizedCompanyName = normalizeText(companyName);
    if (!normalizedCompanyName) {
      throw new ApiError(400, "Company name is required");
    }
    dealer.companyName = normalizedCompanyName;
  }

  if (contactName !== undefined) {
    const normalizedContactName = normalizeText(contactName);
    if (!normalizedContactName) {
      throw new ApiError(400, "Contact name is required");
    }
    dealer.contactName = normalizedContactName;
  }

  if (phone !== undefined) {
    const normalizedPhone = normalizeText(phone);
    if (!normalizedPhone) {
      throw new ApiError(400, "Phone is required");
    }
    dealer.phone = normalizedPhone;
  }

  if (address !== undefined) {
    dealer.address = normalizeText(address);
  }

  if (panVat !== undefined) {
    dealer.panVat = normalizeText(panVat);
  }

  if (notes !== undefined) {
    dealer.notes = normalizeText(notes);
  }

  if (email !== undefined) {
    const normalizedDealerEmail = normalizeEmail(email);
    if (!normalizedDealerEmail) {
      throw new ApiError(400, "Dealer email is required");
    }

    const duplicateDealer = await DealerProfile.findOne({
      email: normalizedDealerEmail,
      _id: { $ne: dealerId },
    }).select("_id");

    if (duplicateDealer) {
      throw new ApiError(409, "Dealer profile already exists for this email");
    }

    const duplicateUser = await User.findOne({
      email: normalizedDealerEmail,
      dealerId: { $ne: dealer._id },
    }).select("_id role dealerId");

    if (duplicateUser) {
      throw new ApiError(
        409,
        "A different user already exists with this email",
      );
    }

    dealer.email = normalizedDealerEmail;

    const linkedUser = await User.findOne({ dealerId: dealer._id });
    if (linkedUser) {
      linkedUser.email = normalizedDealerEmail;
      await linkedUser.save();
    }
  }

  await dealer.save();

  return DealerProfile.findById(dealer._id)
    .populate({
      path: "dispatcherId",
      select: "name companyName email phone status isActive",
    })
    .lean();
}

export async function updateDealerRouting({
  dealerId,
  fulfillmentMode,
  dispatcherId = null,
  adminUser,
}) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const routing = buildDealerRouting({ fulfillmentMode, dispatcherId });
  await assertDispatcherActive(routing.dispatcherId);

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");
  assertDeletionNotPending(dealer, "Dealer");

  dealer.fulfillmentMode = routing.fulfillmentMode;
  dealer.dispatcherId = routing.dispatcherId;

  await dealer.save();

  return {
    ok: true,
    dealerId: dealer._id,
    fulfillmentMode: dealer.fulfillmentMode,
    dispatcherId: dealer.dispatcherId,
  };
}

export async function assignDispatcherToDealer({
  dealerId,
  dispatcherId,
  adminUser,
}) {
  return updateDealerRouting({
    dealerId,
    fulfillmentMode: "DISPATCHER",
    dispatcherId,
    adminUser,
  });
}

export async function unassignDispatcherFromDealer({ dealerId, adminUser }) {
  return updateDealerRouting({
    dealerId,
    fulfillmentMode: "FACTORY",
    dispatcherId: null,
    adminUser,
  });
}

export async function setDealerStatus({ dealerId, status, adminUser }) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");
  if (!Object.values(DEALER_STATUS).includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");
  assertDeletionNotPending(dealer, "Dealer");

  dealer.status = status;
  await dealer.save();

  const linkedUsers = await User.find({
    dealerId: dealer._id,
    role: ROLES.DEALER,
  }).select("+passwordHash");

  for (const user of linkedUsers) {
    user.isActive = status === DEALER_STATUS.VERIFIED;

    if (status === DEALER_STATUS.SUSPENDED) {
      user.accountStatus = USER_ACCOUNT_STATUS.SUSPENDED;
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      user.previousRefreshTokenHash = null;
      user.previousRefreshTokenValidUntil = null;
    } else if (status === DEALER_STATUS.VERIFIED) {
      user.accountStatus = user.passwordHash
        ? USER_ACCOUNT_STATUS.ACTIVE
        : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP;
    }

    await user.save();
  }

  return { ok: true };
}

export async function updateDealerCredit({ dealerId, credit, adminUser }) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");
  assertDeletionNotPending(dealer, "Dealer");

  dealer.credit = {
    enabled: Boolean(credit?.enabled),
    limit: Number(credit?.limit || 0),
    dueDays: Number(credit?.dueDays || 0),
  };

  await dealer.save();
  return { ok: true };
}

export async function scheduleDealerDeletion({
  dealerId,
  confirmation = "",
  reason = "",
  adminUser,
}) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");
  if (dealer.deletion?.pending) {
    throw new ApiError(409, "Dealer deletion is already pending");
  }

  const expected = dealer.companyName || dealer.email || String(dealer._id);
  requireExactConfirmation({
    expected,
    actual: confirmation,
    label: "dealer deletion",
  });

  const deleteAfter = deletionDeadline();

  dealer.deletion = {
    pending: true,
    requestedAt: new Date(),
    deleteAfter,
    requestedByUserId: actorUserId(adminUser),
    previousStatus: dealer.status,
    reason: normalizeText(reason),
  };
  dealer.status = DEALER_STATUS.SUSPENDED;
  await dealer.save();

  await User.updateMany(
    { dealerId: dealer._id, role: ROLES.DEALER },
    {
      $set: {
        isActive: false,
        accountStatus: USER_ACCOUNT_STATUS.SUSPENDED,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
        previousRefreshTokenHash: null,
        previousRefreshTokenValidUntil: null,
        previousRefreshTokenHash: null,
        previousRefreshTokenValidUntil: null,
      },
    },
  );

  return {
    ok: true,
    dealerId: dealer._id,
    deleteAfter,
    deletion: deletionState(dealer.deletion),
  };
}

export async function undoDealerDeletion({ dealerId, adminUser }) {
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerId);
  if (!dealer) throw new ApiError(404, "Dealer not found");

  if (!dealer.deletion?.pending) {
    throw new ApiError(400, "Dealer deletion is not pending");
  }

  if (
    dealer.deletion.deleteAfter &&
    new Date(dealer.deletion.deleteAfter).getTime() <= Date.now()
  ) {
    await purgeExpiredAccountDeletions();
    throw new ApiError(410, "Dealer deletion window has expired");
  }

  const restoredStatus = dealer.deletion.previousStatus || DEALER_STATUS.VERIFIED;
  dealer.status = restoredStatus;
  dealer.deletion = {
    pending: false,
    requestedAt: null,
    deleteAfter: null,
    requestedByUserId: null,
    previousStatus: null,
    reason: "",
  };
  await dealer.save();

  const linkedUsers = await User.find({
    dealerId: dealer._id,
    role: ROLES.DEALER,
  }).select("+passwordHash");

  for (const user of linkedUsers) {
    user.isActive = restoredStatus === DEALER_STATUS.VERIFIED;
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    user.previousRefreshTokenHash = null;
    user.previousRefreshTokenValidUntil = null;
    user.accountStatus =
      restoredStatus === DEALER_STATUS.VERIFIED
        ? user.passwordHash
          ? USER_ACCOUNT_STATUS.ACTIVE
          : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP
        : USER_ACCOUNT_STATUS.SUSPENDED;
    await user.save();
  }

  return { ok: true, dealerId: dealer._id };
}

// ----------------------------
// Dispatchers
// ----------------------------

export async function createDispatcher({
  name,
  companyName = "",
  phone = "",
  email = "",
  address = "",
  notes = "",
  adminUser,
}) {
  const normalizedName = normalizeText(name);
  const normalizedCompanyName = normalizeText(companyName);
  const normalizedPhone = normalizeText(phone);
  const normalizedEmail = normalizeEmail(email);
  const normalizedAddress = normalizeText(address);
  const normalizedNotes = normalizeText(notes);

  if (!normalizedName) throw new ApiError(400, "Dispatcher name is required");
  if (!normalizedPhone) throw new ApiError(400, "Dispatcher phone is required");
  if (!normalizedEmail) throw new ApiError(400, "Dispatcher email is required");

  const existing = await Dispatcher.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, "Dispatcher with this email already exists");
  }

  const dispatcher = await Dispatcher.create({
    name: normalizedName,
    companyName: normalizedCompanyName,
    phone: normalizedPhone,
    email: normalizedEmail,
    address: normalizedAddress,
    notes: normalizedNotes,
    status: DISPATCHER_STATUS.VERIFIED,
    isActive: true,
  });

  return dispatcher;
}

export async function listDispatchers({
  status,
  activeOnly = false,
  page = 1,
  limit = 20,
} = {}) {
  await purgeExpiredAccountDeletions();

  const q = { "deletion.pending": { $ne: true } };

  if (status) {
    q.status = normalizeDispatcherStatus(status);
  }

  if (String(activeOnly) === "true" || activeOnly === true) {
    q.isActive = true;
  }

  const perPage = Math.min(100, Math.max(1, Number(limit)));
  const skip = (Math.max(1, Number(page)) - 1) * perPage;

  const [items, total] = await Promise.all([
    Dispatcher.find(q).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Dispatcher.countDocuments(q),
  ]);

  const dispatcherIds = items.map((item) => item._id).filter(Boolean);
  const [dealerSummaries, orderSummaries, accessStateMap] = dispatcherIds.length
    ? await Promise.all([
        DealerProfile.aggregate([
          {
            $match: {
              dispatcherId: { $in: dispatcherIds },
              fulfillmentMode: "DISPATCHER",
            },
          },
          {
            $group: {
              _id: "$dispatcherId",
              assignedDealerCount: { $sum: 1 },
              activeAssignedDealerCount: {
                $sum: {
                  $cond: [{ $eq: ["$status", "VERIFIED"] }, 1, 0],
                },
              },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              dispatcherId: { $in: dispatcherIds },
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: "$dispatcherId",
              pendingAssignedOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "SUBMITTED"] }, 1, 0],
                },
              },
              handledOrders: {
                $sum: {
                  $cond: [{ $in: ["$status", ["VERIFIED", "REJECTED"]] }, 1, 0],
                },
              },
              latestAssignedOrderAt: { $max: "$createdAt" },
              latestHandledOrderAt: {
                $max: {
                  $cond: [
                    { $in: ["$status", ["VERIFIED", "REJECTED"]] },
                    "$updatedAt",
                    null,
                  ],
                },
              },
            },
          },
        ]),
        getAccessStateByDispatcherIds(dispatcherIds),
      ])
    : [[], [], new Map()];

  const dealerSummaryMap = new Map(
    dealerSummaries.map((summary) => [String(summary._id), summary]),
  );
  const orderSummaryMap = new Map(
    orderSummaries.map((summary) => [String(summary._id), summary]),
  );

  return {
    items: items.map((dispatcher) => {
      const dealerSummary = dealerSummaryMap.get(String(dispatcher._id)) || {};
      const orderSummary = orderSummaryMap.get(String(dispatcher._id)) || {};
      return {
        ...dispatcher,
        deletion: deletionState(dispatcher.deletion),
        accessState:
          accessStateMap.get(String(dispatcher._id)) ||
          buildAccessState(null, ROLES.DISPATCHER),
        operationalSummary: {
          assignedDealerCount: dealerSummary.assignedDealerCount || 0,
          activeAssignedDealerCount:
            dealerSummary.activeAssignedDealerCount || 0,
          pendingAssignedOrders: orderSummary.pendingAssignedOrders || 0,
          handledOrders: orderSummary.handledOrders || 0,
          latestAssignedOrderAt: orderSummary.latestAssignedOrderAt || null,
          latestHandledOrderAt: orderSummary.latestHandledOrderAt || null,
        },
      };
    }),
    total,
    page: Math.max(1, Number(page)),
    limit: perPage,
  };
}

export async function getDispatcher({ dispatcherId } = {}) {
  await purgeExpiredAccountDeletions();

  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");
  const dispatcher = await Dispatcher.findById(dispatcherId).lean();
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  if (dispatcher.deletion?.pending) {
    throw new ApiError(404, "Dispatcher not found");
  }

  const [assignedDealers, orderSummary, accessStateMap] = await Promise.all([
    DealerProfile.find({
      dispatcherId: dispatcher._id,
      fulfillmentMode: "DISPATCHER",
    })
      .sort({ companyName: 1, contactName: 1 })
      .select(
        "companyName contactName phone email status fulfillmentMode createdAt updatedAt",
      )
      .lean(),
    Order.aggregate([
      {
        $match: {
          dispatcherId: dispatcher._id,
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$dispatcherId",
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "SUBMITTED"] }, 1, 0] },
          },
          verifiedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "VERIFIED"] }, 1, 0] },
          },
          rejectedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
          },
          totalVerifiedSales: {
            $sum: {
              $cond: [{ $eq: ["$status", "VERIFIED"] }, "$totals.total", 0],
            },
          },
          latestOrderAt: { $max: "$createdAt" },
        },
      },
    ]),
    getAccessStateByDispatcherIds([dispatcher._id]),
  ]);

  const dealerIds = assignedDealers.map((dealer) => dealer._id);
  const dealerActivity = dealerIds.length
    ? await Order.aggregate([
        {
          $match: {
            dealerId: { $in: dealerIds },
            dispatcherId: dispatcher._id,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$dealerId",
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$status", "SUBMITTED"] }, 1, 0] },
            },
            verifiedOrders: {
              $sum: { $cond: [{ $eq: ["$status", "VERIFIED"] }, 1, 0] },
            },
            rejectedOrders: {
              $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
            },
            totalVerifiedSales: {
              $sum: {
                $cond: [{ $eq: ["$status", "VERIFIED"] }, "$totals.total", 0],
              },
            },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ])
    : [];

  const activityMap = new Map(
    dealerActivity.map((entry) => [String(entry._id), entry]),
  );
  const summary = orderSummary[0] || {};

  return {
    ...dispatcher,
    deletion: deletionState(dispatcher.deletion),
    accessState:
      accessStateMap.get(String(dispatcher._id)) ||
      buildAccessState(null, ROLES.DISPATCHER),
    operationalSummary: {
      assignedDealerCount: assignedDealers.length,
      activeAssignedDealerCount: assignedDealers.filter(
        (dealer) => dealer.status === "VERIFIED",
      ).length,
      totalOrders: summary.totalOrders || 0,
      pendingOrders: summary.pendingOrders || 0,
      verifiedOrders: summary.verifiedOrders || 0,
      rejectedOrders: summary.rejectedOrders || 0,
      totalVerifiedSales: summary.totalVerifiedSales || 0,
      latestOrderAt: summary.latestOrderAt || null,
    },
    assignedDealers: assignedDealers.map((dealer) => ({
      ...dealer,
      activitySummary: activityMap.get(String(dealer._id)) || {
        totalOrders: 0,
        pendingOrders: 0,
        verifiedOrders: 0,
        rejectedOrders: 0,
        totalVerifiedSales: 0,
        lastOrderAt: null,
      },
    })),
  };
}

export async function getDispatcherApplications({
  status,
  page = 1,
  limit = 20,
} = {}) {
  const normalizedStatus = status ? normalizeDispatcherStatus(status) : null;

  return listDispatchers({
    status: normalizedStatus,
    activeOnly: false,
    page,
    limit,
  });
}

export async function verifyDispatcherApplication({
  dispatcherId,
  notes = "",
  adminUser,
}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const base = await runInTxn(async (session) => {
    const dispatcher = await Dispatcher.findById(dispatcherId).session(session);
    if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

    const normalizedNotes = normalizeText(notes);

    let dispatcherUser = await User.findOne({
      email: dispatcher.email,
    })
      .select("+passwordHash")
      .session(session);

    if (dispatcherUser) {
      const sameDispatcher =
        dispatcherUser.role === ROLES.DISPATCHER &&
        String(dispatcherUser.dispatcherId || "") === String(dispatcher._id);

      if (!sameDispatcher) {
        throw new ApiError(
          409,
          "A different user already exists with this dispatcher email",
        );
      }

      dispatcherUser.isActive = true;
      dispatcherUser.accountStatus = dispatcherUser.passwordHash
        ? USER_ACCOUNT_STATUS.ACTIVE
        : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP;
      await dispatcherUser.save({ session });
    } else {
      const username = await uniqueUsernameFromEmail(dispatcher.email);

      const [dispatcherUserDoc] = await User.create(
        [
          {
            username,
          email: dispatcher.email,
          role: ROLES.DISPATCHER,
          dispatcherId: dispatcher._id,
          isActive: true,
          accountStatus: USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP,
        },
      ],
      { session },
      );

      dispatcherUser = dispatcherUserDoc;
    }

    dispatcher.status = DISPATCHER_STATUS.VERIFIED;
    dispatcher.isActive = true;

    if (notes !== undefined) {
      dispatcher.notes = normalizedNotes;
    }

    await dispatcher.save({ session });

    return {
      dispatcher,
      dispatcherUser: {
        id: dispatcherUser._id,
        email: dispatcherUser.email,
        username: dispatcherUser.username,
      },
      dispatcherUserId: dispatcherUser._id,
      dispatcherUserPasswordSet: Boolean(dispatcherUser.passwordHash),
      displayName: dispatcher.name || dispatcher.companyName || "",
    };
  });

  const setup = base.dispatcherUserPasswordSet
    ? { token: undefined }
    : await createPasswordSetupTokenForUser({
        userId: base.dispatcherUserId,
        accountType: ROLES.DISPATCHER,
        displayName: base.displayName,
      });

  return {
    dispatcher: base.dispatcher,
    dispatcherUser: base.dispatcherUser,
    passwordSetupToken: setup.token,
  };
}

export async function rejectDispatcherApplication({
  dispatcherId,
  notes = "",
  adminUser,
}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  assertDeletionNotPending(dispatcher, "Dispatcher");

  dispatcher.status = DISPATCHER_STATUS.REJECTED;
  dispatcher.isActive = false;

  if (notes !== undefined) {
    dispatcher.notes = normalizeText(notes);
  }

  await dispatcher.save();

  await User.updateMany(
    { dispatcherId: dispatcher._id, role: ROLES.DISPATCHER },
    {
      $set: {
        isActive: false,
        accountStatus: USER_ACCOUNT_STATUS.SUSPENDED,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
        previousRefreshTokenHash: null,
        previousRefreshTokenValidUntil: null,
      },
    },
  );

  return dispatcher;
}

export async function listVerifiedDispatchers() {
  const items = await Dispatcher.find({
    status: DISPATCHER_STATUS.VERIFIED,
    isActive: true,
  })
    .sort({
      companyName: 1,
      name: 1,
    })
    .lean();

  return { items };
}

export async function setDispatcherActive({
  dispatcherId,
  isActive,
  adminUser,
}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  assertDeletionNotPending(dispatcher, "Dispatcher");

  dispatcher.isActive = Boolean(isActive);

  if (dispatcher.isActive && dispatcher.status === DISPATCHER_STATUS.PENDING) {
    dispatcher.status = DISPATCHER_STATUS.VERIFIED;
  }

  await dispatcher.save();

  const linkedUsers = await User.find({
    dispatcherId: dispatcher._id,
    role: ROLES.DISPATCHER,
  }).select("+passwordHash");

  for (const user of linkedUsers) {
    user.isActive = dispatcher.isActive;
    if (!dispatcher.isActive) {
      user.accountStatus = USER_ACCOUNT_STATUS.SUSPENDED;
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      user.previousRefreshTokenHash = null;
      user.previousRefreshTokenValidUntil = null;
    } else {
      user.accountStatus = user.passwordHash
        ? USER_ACCOUNT_STATUS.ACTIVE
        : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP;
    }
    await user.save();
  }

  return { ok: true };
}

export async function updateDispatcher({
  dispatcherId,
  name,
  companyName,
  phone,
  email,
  address,
  notes,
  adminUser,
}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  assertDeletionNotPending(dispatcher, "Dispatcher");

  if (name !== undefined) dispatcher.name = normalizeText(name);
  if (companyName !== undefined) {
    dispatcher.companyName = normalizeText(companyName);
  }
  if (phone !== undefined) dispatcher.phone = normalizeText(phone);
  if (address !== undefined) dispatcher.address = normalizeText(address);
  if (notes !== undefined) dispatcher.notes = normalizeText(notes);

  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new ApiError(400, "Dispatcher email is required");
    }

    const duplicate = await Dispatcher.findOne({
      email: normalizedEmail,
      _id: { $ne: dispatcherId },
    }).select("_id");

    if (duplicate) {
      throw new ApiError(409, "Dispatcher with this email already exists");
    }

    dispatcher.email = normalizedEmail;
  }

  await dispatcher.save();
  return dispatcher;
}

export async function deleteDispatcher({
  dispatcherId,
  confirmation = "",
  reason = "",
  adminUser,
}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  if (dispatcher.deletion?.pending) {
    throw new ApiError(409, "Dispatcher deletion is already pending");
  }

  const expected = dispatcher.name || dispatcher.email || String(dispatcher._id);
  requireExactConfirmation({
    expected,
    actual: confirmation,
    label: "dispatcher deletion",
  });

  const linkedDealers = await DealerProfile.find({
    dispatcherId: dispatcher._id,
    fulfillmentMode: "DISPATCHER",
  }).select("_id");

  const linkedDealerIds = linkedDealers.map((dealer) => dealer._id);
  const deleteAfter = deletionDeadline();

  dispatcher.deletion = {
    pending: true,
    requestedAt: new Date(),
    deleteAfter,
    requestedByUserId: actorUserId(adminUser),
    previousStatus: dispatcher.status,
    previousIsActive: dispatcher.isActive,
    assignedDealerIds: linkedDealerIds,
    reason: normalizeText(reason),
  };
  dispatcher.isActive = false;
  await dispatcher.save();

  await Promise.all([
    User.updateMany(
      { dispatcherId: dispatcher._id, role: ROLES.DISPATCHER },
      {
        $set: {
          isActive: false,
          accountStatus: USER_ACCOUNT_STATUS.SUSPENDED,
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
          previousRefreshTokenHash: null,
          previousRefreshTokenValidUntil: null,
        },
      },
    ),
    linkedDealerIds.length
      ? DealerProfile.updateMany(
          { _id: { $in: linkedDealerIds } },
          {
            $set: {
              fulfillmentMode: "FACTORY",
              dispatcherId: null,
            },
          },
        )
      : Promise.resolve(),
  ]);

  return {
    ok: true,
    dispatcherId: dispatcher._id,
    deleteAfter,
    unassignedDealerCount: linkedDealerIds.length,
    deletion: deletionState(dispatcher.deletion),
  };
}

export async function undoDispatcherDeletion({ dispatcherId, adminUser }) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

  if (!dispatcher.deletion?.pending) {
    throw new ApiError(400, "Dispatcher deletion is not pending");
  }

  if (
    dispatcher.deletion.deleteAfter &&
    new Date(dispatcher.deletion.deleteAfter).getTime() <= Date.now()
  ) {
    await purgeExpiredAccountDeletions();
    throw new ApiError(410, "Dispatcher deletion window has expired");
  }

  const restoreDealerIds = dispatcher.deletion.assignedDealerIds || [];
  const restoredStatus =
    dispatcher.deletion.previousStatus || DISPATCHER_STATUS.VERIFIED;
  const restoredIsActive =
    dispatcher.deletion.previousIsActive !== null &&
    dispatcher.deletion.previousIsActive !== undefined
      ? Boolean(dispatcher.deletion.previousIsActive)
      : true;

  dispatcher.status = restoredStatus;
  dispatcher.isActive = restoredIsActive;
  dispatcher.deletion = {
    pending: false,
    requestedAt: null,
    deleteAfter: null,
    requestedByUserId: null,
    previousStatus: null,
    previousIsActive: null,
    assignedDealerIds: [],
    reason: "",
  };
  await dispatcher.save();

  await Promise.all([
    restoreDealerIds.length
      ? DealerProfile.updateMany(
          { _id: { $in: restoreDealerIds } },
          {
            $set: {
              fulfillmentMode: "DISPATCHER",
              dispatcherId: dispatcher._id,
            },
          },
        )
      : Promise.resolve(),
    (async () => {
      const linkedUsers = await User.find({
        dispatcherId: dispatcher._id,
        role: ROLES.DISPATCHER,
      }).select("+passwordHash");

      for (const user of linkedUsers) {
        user.isActive =
          restoredStatus === DISPATCHER_STATUS.VERIFIED && restoredIsActive;
        user.refreshTokenHash = null;
        user.refreshTokenExpiresAt = null;
        user.previousRefreshTokenHash = null;
        user.previousRefreshTokenValidUntil = null;
        user.accountStatus = user.isActive
          ? user.passwordHash
            ? USER_ACCOUNT_STATUS.ACTIVE
            : USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP
          : USER_ACCOUNT_STATUS.SUSPENDED;
        await user.save();
      }
    })(),
  ]);

  return {
    ok: true,
    dispatcherId: dispatcher._id,
    restoredDealerCount: restoreDealerIds.length,
  };
}

// ----------------------------
// Orders
// ----------------------------

export async function listOrders({
  status,
  dealerId,
  dispatcherId,
  fulfillmentMode,
  from,
  to,
  q: qText,
  page = 1,
  limit = 20,
} = {}) {
  const q = { isDeleted: { $ne: true } };

  if (status) q.status = status;
  if (dealerId) q.dealerId = dealerId;
  if (dispatcherId) q.dispatcherId = dispatcherId;
  if (["FACTORY", "DISPATCHER"].includes(normalizeText(fulfillmentMode).toUpperCase())) {
    q["dealerSnapshot.fulfillmentMode"] = normalizeText(
      fulfillmentMode,
    ).toUpperCase();
  }

  const parseDate = (v, label) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(400, `Invalid ${label} date`);
    }
    return d;
  };

  const fromDate = parseDate(from, "from");
  const toDate = parseDate(to, "to");
  if (fromDate || toDate) {
    q.createdAt = {};
    if (fromDate) q.createdAt.$gte = fromDate;
    if (toDate) q.createdAt.$lte = toDate;
  }

  const raw = String(qText || "").trim();
  if (raw) {
    const rx = new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const dealerMatches = await DealerProfile.find({
      $or: [
        { companyName: rx },
        { contactName: rx },
        { phone: rx },
        { email: rx },
      ],
    })
      .select("_id")
      .limit(200)
      .lean();

    const dealerIds = dealerMatches.map((d) => d._id);

    const dealerClause = dealerIds.length
      ? dealerId
        ? { dealerId: dealerId }
        : { dealerId: { $in: dealerIds } }
      : dealerId
        ? { dealerId: dealerId }
        : null;

    const or = [{ orderNumber: rx }];
    if (dealerClause) or.push(dealerClause);

    q.$or = or;
  }

  const perPage = Math.min(100, Math.max(1, Number(limit)));
  const safePage = Math.max(1, Number(page));
  const skip = (safePage - 1) * perPage;

  const baseQuery = Order.find(q)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .select(
      "orderNumber dealerId dispatcherId totals payment.method status createdAt updatedAt",
    )
    .populate({
      path: "dealerId",
      select:
        "companyName contactName phone email status fulfillmentMode dispatcherId credit",
    })
    .populate({
      path: "dispatcherId",
      select: "name companyName phone email status isActive",
    })
    .lean();

  const [items, total] = await Promise.all([
    baseQuery,
    Order.countDocuments(q),
  ]);

  return { items, total, page: safePage, limit: perPage };
}

export async function getOrderStatementsReport({
  from,
  to,
  dealerId = "",
  dealerSearch = "",
  status = "",
  fulfillmentMode = "",
  dispatcherId = "",
  minTotal = "",
  maxTotal = "",
} = {}) {
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

  if (fromDate && toDate) {
    if (fromDate.getTime() > toDate.getTime()) {
      throw new ApiError(400, "Report start date must be before end date");
    }

    const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
      throw new ApiError(400, "Report date range cannot exceed 366 days");
    }
  }

  const query = {
    isDeleted: { $ne: true },
  };

  if (fromDate && toDate) {
    query.createdAt = {
      $gte: fromDate,
      $lte: toDate,
    };
  }

  const normalizedDealerId = normalizeText(dealerId);
  const normalizedDealerSearch = normalizeText(dealerSearch);
  const normalizedStatus = normalizeText(status).toUpperCase();
  const normalizedFulfillmentMode = normalizeText(fulfillmentMode).toUpperCase();
  const normalizedDispatcherId = normalizeText(dispatcherId);

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

  if (["FACTORY", "DISPATCHER"].includes(normalizedFulfillmentMode)) {
    query["dealerSnapshot.fulfillmentMode"] = normalizedFulfillmentMode;
  }

  if (normalizedDispatcherId) {
    if (!mongoose.Types.ObjectId.isValid(normalizedDispatcherId)) {
      throw new ApiError(400, "Invalid dispatcherId");
    }
    query.dispatcherId = normalizedDispatcherId;
    query["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
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

  if (normalizedDealerId) {
    if (!mongoose.Types.ObjectId.isValid(normalizedDealerId)) {
      throw new ApiError(400, "Invalid dealerId");
    }
    query.dealerId = normalizedDealerId;
  } else if (normalizedDealerSearch) {
    const rx = new RegExp(
      normalizedDealerSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const dealerMatches = await DealerProfile.find({
      $or: [
        { companyName: rx },
        { contactName: rx },
        { phone: rx },
        { email: rx },
      ],
    })
      .select("_id")
      .limit(1000)
      .lean();

    const dealerIds = dealerMatches.map((dealer) => dealer._id);
    if (!dealerIds.length) {
      return {
        filters: {
          from: fromDate,
          to: toDate,
          dealerId: "",
          dealerSearch: normalizedDealerSearch,
          status: normalizedStatus,
          fulfillmentMode: normalizedFulfillmentMode,
          dispatcherId: normalizedDispatcherId,
          minTotal: minAmount,
          maxTotal: maxAmount,
        },
        items: [],
        dealers: [],
        totals: {
          orderCount: 0,
          dealerCount: 0,
          subtotal: 0,
          total: 0,
          currency: "NPR",
          byStatus: {},
        },
      };
    }

    query.dealerId = { $in: dealerIds };
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
    .populate({
      path: "dealerId",
      select:
        "companyName contactName phone email status fulfillmentMode dispatcherId credit",
    })
    .populate({
      path: "dispatcherId",
      select: "name companyName phone email status isActive",
    })
    .lean();

  const items = orders.map(normalizeOrderForReport);
  const dealerMap = new Map();
  const byStatus = {};
  let subtotal = 0;
  let total = 0;
  let currency = "NPR";

  for (const item of items) {
    const dealerKey =
      String(item.dealer?._id || "") ||
      item.dealer?.companyName ||
      "Unknown Dealer";

    if (!dealerMap.has(dealerKey)) {
      dealerMap.set(dealerKey, {
        _id: item.dealer?._id || null,
        companyName: item.dealer?.companyName || "Unknown Dealer",
        contactName: item.dealer?.contactName || "",
        phone: item.dealer?.phone || "",
        email: item.dealer?.email || "",
        fulfillmentMode: item.dealer?.fulfillmentMode || "FACTORY",
        orderCount: 0,
        subtotal: 0,
        total: 0,
      });
    }

    const dealerSummary = dealerMap.get(dealerKey);
    dealerSummary.orderCount += 1;
    dealerSummary.subtotal += item.totals.subtotal;
    dealerSummary.total += item.totals.total;

    subtotal += item.totals.subtotal;
    total += item.totals.total;
    currency = item.totals.currency || currency;
    byStatus[item.status || "UNKNOWN"] = (byStatus[item.status || "UNKNOWN"] || 0) + 1;
  }

  const dealers = Array.from(dealerMap.values()).sort((a, b) =>
    String(a.companyName || "").localeCompare(String(b.companyName || "")),
  );

  return {
    filters: {
      from: fromDate,
      to: toDate,
      dealerId: normalizedDealerId,
      dealerSearch: normalizedDealerSearch,
      status: normalizedStatus,
      fulfillmentMode: normalizedFulfillmentMode,
      dispatcherId: normalizedDispatcherId,
      minTotal: minAmount,
      maxTotal: maxAmount,
    },
    items,
    dealers,
    totals: {
      orderCount: items.length,
      dealerCount: dealers.length,
      subtotal,
      total,
      currency,
      byStatus,
    },
  };
}

export async function getOrder({ orderId } = {}) {
  if (!orderId) throw new ApiError(400, "Missing orderId");
  const order = await Order.findById(orderId)
    .populate({
      path: "dealerId",
      select:
        "companyName contactName phone email status fulfillmentMode dispatcherId credit",
    })
    .populate({
      path: "dispatcherId",
      select: "name companyName phone email status isActive",
    })
    .lean();
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

export async function hardDeleteOrder({
  orderId,
  confirmation = "",
  reason = "",
  adminUser,
}) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findById(orderId).select(
    "_id orderNumber status dealerId dispatcherId isDeleted deletion",
  );
  if (!order) throw new ApiError(404, "Order not found");
  if (order.deletion?.pending || order.isDeleted) {
    throw new ApiError(409, "Order deletion is already pending");
  }

  requireExactConfirmation({
    expected: order.orderNumber,
    actual: confirmation,
    label: "order deletion",
  });

  const deleteAfter = deletionDeadline();
  order.isDeleted = true;
  order.deletion = {
    pending: true,
    requestedAt: new Date(),
    deleteAfter,
    requestedByUserId: actorUserId(adminUser),
    reason: normalizeText(reason),
  };
  await order.save();

  return {
    ok: true,
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    deleteAfter,
    deletion: deletionState(order.deletion),
  };
}

export async function undoOrderDeletion({ orderId }) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findById(orderId).select(
    "_id orderNumber isDeleted deletion",
  );
  if (!order) throw new ApiError(404, "Order not found");
  if (!order.deletion?.pending) {
    throw new ApiError(400, "Order deletion is not pending");
  }

  if (
    order.deletion.deleteAfter &&
    new Date(order.deletion.deleteAfter).getTime() <= Date.now()
  ) {
    await purgeExpiredAccountDeletions();
    throw new ApiError(410, "Order deletion window has expired");
  }

  order.isDeleted = false;
  order.deletion = {
    pending: false,
    requestedAt: null,
    deleteAfter: null,
    requestedByUserId: null,
    reason: "",
  };
  await order.save();

  return { ok: true, orderId: order._id, orderNumber: order.orderNumber };
}

export async function approveOrder({ orderId, adminUser }) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const allowed = new Set([
    ORDER_STATUS?.SUBMITTED ?? "SUBMITTED",
    ORDER_STATUS?.PENDING ?? "PENDING",
  ]);
  if (!allowed.has(order.status)) {
    throw new ApiError(
      400,
      `Order cannot be approved from status: ${order.status}`,
    );
  }

  order.status = ORDER_STATUS?.APPROVED ?? "APPROVED";
  order.updatedBy = adminUser.id || adminUser._id || null;
  await order.save();

  return { ok: true };
}

export async function sendOrderToDispatcher({ orderId, adminUser }) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const approved = ORDER_STATUS?.APPROVED ?? "APPROVED";
  if (order.status !== approved) {
    throw new ApiError(
      400,
      "Order must be approved before sending to dispatcher",
    );
  }

  if (!order.dispatcherId) {
    const dealer = await DealerProfile.findById(order.dealerId).select(
      "dispatcherId fulfillmentMode",
    );

    if (dealer?.dispatcherId && dealer?.fulfillmentMode === "DISPATCHER") {
      order.dispatcherId = dealer.dispatcherId;
    }
  }

  if (!order.dispatcherId) {
    throw new ApiError(400, "No dispatcher assigned to this order");
  }

  await assertDispatcherActive(order.dispatcherId);

  order.status = ORDER_STATUS?.SENT_TO_DISPATCHER ?? "SENT_TO_DISPATCHER";
  order.updatedBy = adminUser.id || adminUser._id || null;
  await order.save();

  return { ok: true };
}

// ----------------------------
// Payments
// ----------------------------

export async function listPayments({
  status,
  method,
  dealerId,
  orderId,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) {
  const q = {};
  if (status) q.status = status;
  if (method) q.method = method;
  if (dealerId) q.dealerId = dealerId;
  if (orderId) q.orderId = orderId;

  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }

  const perPage = Math.min(100, Math.max(1, Number(limit)));
  const skip = (Math.max(1, Number(page)) - 1) * perPage;

  const [items, total] = await Promise.all([
    Payment.find(q).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Payment.countDocuments(q),
  ]);

  return { items, total, page: Math.max(1, Number(page)), limit: perPage };
}

export async function verifyPayment({ paymentId, adminUser, note = "" }) {
  if (!paymentId) throw new ApiError(400, "Missing paymentId");

  const p = await Payment.findById(paymentId);
  if (!p) throw new ApiError(404, "Payment not found");

  const verified = PAYMENT_STATUS?.VERIFIED ?? "VERIFIED";
  const rejected = PAYMENT_STATUS?.REJECTED ?? "REJECTED";

  if (p.status === verified) return { ok: true };
  if (p.status === rejected) {
    throw new ApiError(400, "Cannot verify a rejected payment");
  }

  p.status = verified;
  p.verifiedBy = adminUser.id || adminUser._id || null;
  p.verifiedAt = new Date();
  p.verificationNote = note;
  await p.save();

  return { ok: true };
}

export async function rejectPayment({ paymentId, adminUser, note = "" }) {
  if (!paymentId) throw new ApiError(400, "Missing paymentId");

  const p = await Payment.findById(paymentId);
  if (!p) throw new ApiError(404, "Payment not found");

  const verified = PAYMENT_STATUS?.VERIFIED ?? "VERIFIED";
  const rejected = PAYMENT_STATUS?.REJECTED ?? "REJECTED";

  if (p.status === verified) {
    throw new ApiError(400, "Cannot reject a verified payment");
  }

  p.status = rejected;
  p.verifiedBy = adminUser.id || adminUser._id || null;
  p.verifiedAt = new Date();
  p.verificationNote = note;
  await p.save();

  return { ok: true };
}

export async function getOrderOutstanding({ orderId } = {}) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const order = await Order.findById(orderId).select("totals dealerId");
  if (!order) throw new ApiError(404, "Order not found");

  const verifiedStatuses = [
    PAYMENT_STATUS?.VERIFIED ?? "VERIFIED",
    PAYMENT_STATUS?.APPROVED ?? "APPROVED",
    PAYMENT_STATUS?.CONFIRMED ?? "CONFIRMED",
  ];

  const rows = await Payment.find({
    orderId,
    status: { $in: verifiedStatuses },
  }).select("amount");

  const paid = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const total = Number(order.totals?.total || 0);
  const outstanding = Math.max(0, total - paid);

  return {
    orderId: order._id,
    total,
    paid,
    outstanding,
    currency: order.totals?.currency || "NPR",
  };
}

// ----------------------------
// Close order (credit-aware)
// ----------------------------

export async function closeOrder({ orderId, adminUser }) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  return runInTxn(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, "Order not found");

    const dealer = await DealerProfile.findById(order.dealerId)
      .select("credit")
      .session(session);
    if (!dealer) throw new ApiError(404, "Dealer not found");

    const { outstanding } = await getOrderOutstanding({ orderId });

    if (!dealer.credit?.enabled && outstanding > 0) {
      throw new ApiError(400, "Order has outstanding amount; cannot close");
    }

    if (dealer.credit?.enabled && outstanding > 0) {
      throw new ApiError(400, "Credit order not fully settled; cannot close");
    }

    order.status = ORDER_STATUS?.CLOSED ?? "CLOSED";
    order.updatedBy = adminUser.id || adminUser._id || null;
    await order.save({ session });

    return { ok: true };
  });
}

// ----------------------------
// Order revisions (admin amendments)
// ----------------------------

export async function reviseOrder({ orderId, patch, reason = "", adminUser }) {
  if (!orderId) throw new ApiError(400, "Missing orderId");
  if (!patch || typeof patch !== "object") {
    throw new ApiError(400, "Missing patch");
  }

  return runInTxn(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, "Order not found");

    const closed = ORDER_STATUS?.CLOSED ?? "CLOSED";
    const cancelled = ORDER_STATUS?.CANCELLED ?? "CANCELLED";
    if ([closed, cancelled].includes(order.status)) {
      throw new ApiError(400, "Cannot revise a closed/cancelled order");
    }

    const version = Number(order.currentVersion || 1) + 1;

    await OrderRevision.create(
      [
        {
          orderId: order._id,
          version,
          reason,
          requestedByDealer: Boolean(patch?.requestedByDealer),
          snapshot: {
            items: order.items || [],
            totals: order.totals || {},
            payment: order.payment || {},
            dealerNote: order.dealerNote || "",
          },
          createdBy: adminUser.id || adminUser._id || null,
        },
      ],
      { session },
    );

    if (Array.isArray(patch.items)) order.items = patch.items;
    if (patch.totals && typeof patch.totals === "object") {
      order.totals = patch.totals;
    }
    if (patch.payment && typeof patch.payment === "object") {
      order.payment = patch.payment;
    }
    if (typeof patch.dealerNote === "string") {
      order.dealerNote = patch.dealerNote;
    }
    if (typeof patch.internalNote === "string") {
      order.internalNote = patch.internalNote;
    }

    order.currentVersion = version;
    order.updatedBy = adminUser.id || adminUser._id || null;

    await order.save({ session });

    return { ok: true, orderId: order._id, version };
  });
}
