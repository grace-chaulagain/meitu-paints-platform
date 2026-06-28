import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import { ROLES } from "../constants/roles.js";
import Notification, {
  NOTIFICATION_CATEGORY,
} from "../models/Notification.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import User from "../models/User.model.js";

const ADMIN_CATEGORIES = new Set([
  NOTIFICATION_CATEGORY.DEALER_REGISTRATION,
  NOTIFICATION_CATEGORY.DISPATCHER_REGISTRATION,
  NOTIFICATION_CATEGORY.FACTORY_ORDER,
]);

const DISPATCHER_CATEGORIES = new Set([
  NOTIFICATION_CATEGORY.ASSIGNED_DEALER_ORDER,
]);

const FACTORY_CATEGORIES = new Set([
  NOTIFICATION_CATEGORY.FACTORY_ORDER,
]);

function normalizeRole(role = "") {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeCategory(category = "") {
  return String(category || "")
    .trim()
    .toUpperCase();
}

function toObjectId(value) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function getActorUserId(user) {
  const userId = user?._id || user?.id || user?.sub || null;
  const objectId = toObjectId(userId);
  if (!objectId) throw new ApiError(401, "Authentication required");
  return objectId;
}

function getActorRole(user) {
  const role = normalizeRole(user?.role);
  if (![ROLES.ADMIN, ROLES.DISPATCHER, ROLES.FACTORY].includes(role)) {
    throw new ApiError(403, "Notification access requires an operations role");
  }
  return role;
}

function getRoleCategories(role) {
  if (role === ROLES.ADMIN) return ADMIN_CATEGORIES;
  if (role === ROLES.FACTORY) return FACTORY_CATEGORIES;
  return DISPATCHER_CATEGORIES;
}

function assertCategoryForRole(category, role) {
  const normalized = normalizeCategory(category);
  if (!getRoleCategories(role).has(normalized)) {
    throw new ApiError(400, "Notification category is not valid for this role");
  }
  return normalized;
}

function buildRecipientQuery({ role, userId }) {
  const query = {
    recipientRole: role,
  };

  if (role === ROLES.ADMIN || role === ROLES.FACTORY) {
    query.$or = [{ recipientUserId: null }, { recipientUserId: userId }];
    return query;
  }

  query.recipientUserId = userId;
  return query;
}

function isReadBy(notification, userId) {
  const target = String(userId);
  return (notification.readBy || []).some(
    (entry) => String(entry.userId || "") === target,
  );
}

function notificationToClient(notification, userId) {
  return {
    _id: notification._id,
    category: notification.category,
    title: notification.title,
    description: notification.description,
    targetUrl: notification.targetUrl,
    dealerId: notification.dealerId,
    orderId: notification.orderId,
    dispatcherId: notification.dispatcherId,
    dealerApplicationId: notification.dealerApplicationId,
    metadata: notification.metadata || {},
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    isRead: isReadBy(notification, userId),
  };
}

export function getNotificationCategoriesForRole(role) {
  return Array.from(getRoleCategories(normalizeRole(role)));
}

export async function createAdminNotification({
  category,
  title,
  description = "",
  targetUrl = "",
  dealerId = null,
  orderId = null,
  dispatcherId = null,
  dealerApplicationId = null,
  metadata = {},
} = {}) {
  const normalizedCategory = assertCategoryForRole(category, ROLES.ADMIN);

  return Notification.create({
    recipientRole: ROLES.ADMIN,
    recipientUserId: null,
    category: normalizedCategory,
    title,
    description,
    targetUrl,
    dealerId: toObjectId(dealerId),
    orderId: toObjectId(orderId),
    dispatcherId: toObjectId(dispatcherId),
    dealerApplicationId: toObjectId(dealerApplicationId),
    metadata,
  });
}

export async function resolveDispatcherRecipient(dispatcherId) {
  const objectId = toObjectId(dispatcherId);
  if (!objectId) return null;

  const [dispatcher, user] = await Promise.all([
    Dispatcher.findById(objectId)
      .select("_id name companyName email phone status isActive")
      .lean(),
    User.findOne({
      role: ROLES.DISPATCHER,
      dispatcherId: objectId,
      isActive: true,
    })
      .select("_id email username dispatcherId role isActive")
      .lean(),
  ]);

  if (!dispatcher) return null;
  if (
    dispatcher.status !== DISPATCHER_STATUS.VERIFIED ||
    dispatcher.isActive !== true
  ) {
    return null;
  }
  if (!user) return null;

  return { dispatcher, user };
}

export async function createDispatcherNotification({
  recipientUserId,
  category,
  title,
  description = "",
  targetUrl = "",
  dealerId = null,
  orderId = null,
  dispatcherId = null,
  metadata = {},
} = {}) {
  const normalizedCategory = assertCategoryForRole(category, ROLES.DISPATCHER);
  const recipientObjectId = toObjectId(recipientUserId);

  if (!recipientObjectId) {
    throw new ApiError(400, "Dispatcher notification recipient is required");
  }

  return Notification.create({
    recipientRole: ROLES.DISPATCHER,
    recipientUserId: recipientObjectId,
    category: normalizedCategory,
    title,
    description,
    targetUrl,
    dealerId: toObjectId(dealerId),
    orderId: toObjectId(orderId),
    dispatcherId: toObjectId(dispatcherId),
    metadata,
  });
}

export async function createFactoryNotification({
  category,
  title,
  description = "",
  targetUrl = "",
  dealerId = null,
  orderId = null,
  metadata = {},
} = {}) {
  const normalizedCategory = assertCategoryForRole(category, ROLES.FACTORY);

  return Notification.create({
    recipientRole: ROLES.FACTORY,
    recipientUserId: null,
    category: normalizedCategory,
    title,
    description,
    targetUrl,
    dealerId: toObjectId(dealerId),
    orderId: toObjectId(orderId),
    metadata,
  });
}

export async function createDealerRegistrationNotification(application) {
  if (!application?._id) return null;

  return createAdminNotification({
    category: NOTIFICATION_CATEGORY.DEALER_REGISTRATION,
    title: "New dealer application",
    description: `${application.companyName || "A dealer"} submitted a dealership request.`,
    targetUrl: "/admin/dashboard/applications/dealers",
    dealerApplicationId: application._id,
    metadata: {
      companyName: application.companyName || "",
      contactName: application.contactName || "",
      email: application.email || "",
      phone: application.phone || "",
    },
  });
}

export async function createDispatcherRegistrationNotification(dispatcher) {
  if (!dispatcher?._id) return null;

  return createAdminNotification({
    category: NOTIFICATION_CATEGORY.DISPATCHER_REGISTRATION,
    title: "New dispatcher application",
    description: `${dispatcher.name || "A dispatcher"} submitted a dispatcher registration.`,
    targetUrl: "/admin/dashboard/applications/dispatchers",
    dispatcherId: dispatcher._id,
    metadata: {
      name: dispatcher.name || "",
      companyName: dispatcher.companyName || "",
      email: dispatcher.email || "",
      phone: dispatcher.phone || "",
    },
  });
}

export async function createFactoryOrderNotification(order) {
  if (!order?._id) return null;

  const mode = order.dealerSnapshot?.fulfillmentMode || "FACTORY";
  if (mode !== "FACTORY") return null;

  return createAdminNotification({
    category: NOTIFICATION_CATEGORY.FACTORY_ORDER,
    title: `New factory order ${order.orderNumber || ""}`.trim(),
    description: `${order.dealerSnapshot?.companyName || "A dealer"} placed a factory-handled order worth ${order.totals?.currency || "NPR"} ${Number(order.totals?.total || 0).toLocaleString()}.`,
    targetUrl: `/admin/dashboard/orders?orderId=${encodeURIComponent(String(order._id))}`,
    dealerId: order.dealerId,
    orderId: order._id,
    metadata: {
      orderNumber: order.orderNumber || "",
      companyName: order.dealerSnapshot?.companyName || "",
      contactName: order.dealerSnapshot?.contactName || "",
      paymentMethod: order.payment?.method || "",
      total: order.totals?.total || 0,
      currency: order.totals?.currency || "NPR",
    },
  });
}

export async function createAssignedDealerOrderNotification(order) {
  if (!order?._id) return null;

  const mode = order.dealerSnapshot?.fulfillmentMode || "FACTORY";
  if (mode !== "DISPATCHER") return null;

  const recipient = await resolveDispatcherRecipient(order.dispatcherId);
  if (!recipient?.user?._id) return null;

  const dispatcherId = order.dispatcherId?._id || order.dispatcherId || null;

  return createDispatcherNotification({
    recipientUserId: recipient.user._id,
    category: NOTIFICATION_CATEGORY.ASSIGNED_DEALER_ORDER,
    title: `New dealer order ${order.orderNumber || ""}`.trim(),
    description: `${order.dealerSnapshot?.companyName || "An assigned dealer"} placed an order worth ${order.totals?.currency || "NPR"} ${Number(order.totals?.total || 0).toLocaleString()}.`,
    targetUrl: `/dispatcher/dashboard/orders?orderId=${encodeURIComponent(String(order._id))}`,
    dealerId: order.dealerId,
    orderId: order._id,
    dispatcherId,
    metadata: {
      orderNumber: order.orderNumber || "",
      companyName: order.dealerSnapshot?.companyName || "",
      contactName: order.dealerSnapshot?.contactName || "",
      paymentMethod: order.payment?.method || "",
      total: order.totals?.total || 0,
      currency: order.totals?.currency || "NPR",
      dispatcherEmail: recipient.dispatcher?.email || recipient.user.email || "",
    },
  });
}

export async function getUnreadSummary({ user } = {}) {
  const role = getActorRole(user);
  const userId = getActorUserId(user);
  const baseQuery = buildRecipientQuery({ role, userId });

  const unreadQuery = {
    ...baseQuery,
    "readBy.userId": { $ne: userId },
  };

  const grouped = await Notification.aggregate([
    { $match: unreadQuery },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
  ]);

  const categories = {};
  let totalUnread = 0;

  for (const category of getNotificationCategoriesForRole(role)) {
    categories[category] = 0;
  }

  for (const item of grouped) {
    categories[item._id] = item.count;
    totalUnread += item.count;
  }

  return { totalUnread, categories };
}

export async function listNotifications({
  user,
  days = 7,
  unreadOnly = false,
  limit = 100,
} = {}) {
  const role = getActorRole(user);
  const userId = getActorUserId(user);
  const safeDays = Math.min(90, Math.max(1, Number(days) || 7));
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const query = {
    ...buildRecipientQuery({ role, userId }),
    createdAt: { $gte: since },
  };

  if (unreadOnly === true || String(unreadOnly) === "true") {
    query["readBy.userId"] = { $ne: userId };
  }

  const items = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return {
    items: items.map((item) => notificationToClient(item, userId)),
    days: safeDays,
  };
}

export async function markNotificationsRead({
  user,
  notificationIds = [],
  categories = [],
} = {}) {
  const role = getActorRole(user);
  const userId = getActorUserId(user);
  const query = {
    ...buildRecipientQuery({ role, userId }),
    "readBy.userId": { $ne: userId },
  };

  const objectIds = notificationIds.map(toObjectId).filter(Boolean);
  if (objectIds.length) {
    query._id = { $in: objectIds };
  }

  const normalizedCategories = categories
    .map((category) => assertCategoryForRole(category, role))
    .filter(Boolean);

  if (normalizedCategories.length) {
    query.category = { $in: normalizedCategories };
  }

  if (!objectIds.length && !normalizedCategories.length) {
    throw new ApiError(400, "notificationIds or categories are required");
  }

  const out = await Notification.updateMany(query, {
    $addToSet: {
      readBy: {
        userId,
        readAt: new Date(),
      },
    },
  });

  return { ok: true, modifiedCount: out.modifiedCount || 0 };
}

export async function markNotificationRead({ user, notificationId } = {}) {
  if (!notificationId) throw new ApiError(400, "Missing notificationId");
  return markNotificationsRead({ user, notificationIds: [notificationId] });
}

export { NOTIFICATION_CATEGORY };
