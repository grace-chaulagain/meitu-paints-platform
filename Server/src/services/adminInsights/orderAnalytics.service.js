import Order from "../../models/Order.model.js";
import {
  ACCEPTED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  numberValue,
  resolveDateRange,
  resolveEntityMatch,
} from "./insightsShared.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function baseMatch(range, entity = {}) {
  const match = {
    isDeleted: { $ne: true },
    orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
    ...entity,
  };
  if (!range.isAllTime) {
    match.createdAt = { $gte: range.start, $lte: range.end };
  }
  return match;
}

// Real user-selectable granularity via $dateTrunc - replaces the old
// hardcoded daily-under-120-days-else-monthly binary switch.
export async function getOrderTrend(filters = {}) {
  const range = resolveDateRange(filters);
  const granularity = ["day", "week", "month"].includes(filters.granularity)
    ? filters.granularity
    : "day";

  const rows = await Order.aggregate([
    { $match: { ...baseMatch(range, resolveEntityMatch(filters)), status: { $in: ACCEPTED_ORDER_STATUSES } } },
    {
      $group: {
        _id: { $dateTrunc: { date: "$createdAt", unit: granularity } },
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    date: row._id,
    revenue: numberValue(row.revenue),
    orderCount: numberValue(row.orderCount),
    averageOrderValue: row.orderCount ? numberValue(row.revenue) / row.orderCount : 0,
  }));
}

export async function getOrderStatusDistribution(filters = {}) {
  const range = resolveDateRange(filters);
  const rows = await Order.aggregate([
    { $match: baseMatch(range, resolveEntityMatch(filters)) },
    { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totals.total" } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    status: row._id,
    count: numberValue(row.count),
    revenue: numberValue(row.revenue),
  }));
}

const VALUE_BUCKET_BOUNDARIES = [0, 50000, 100000, 250000, 500000, Infinity];
const VALUE_BUCKET_LABELS = ["< 50K", "50K-100K", "100K-250K", "250K-500K", "500K+"];

export async function getOrderValueDistribution(filters = {}) {
  const range = resolveDateRange(filters);
  const rows = await Order.aggregate([
    { $match: { ...baseMatch(range, resolveEntityMatch(filters)), status: { $in: ACCEPTED_ORDER_STATUSES } } },
    {
      $bucket: {
        groupBy: "$totals.total",
        boundaries: VALUE_BUCKET_BOUNDARIES,
        default: VALUE_BUCKET_BOUNDARIES[VALUE_BUCKET_BOUNDARIES.length - 1],
        output: { count: { $sum: 1 }, revenue: { $sum: "$totals.total" } },
      },
    },
  ]);

  const byBoundary = new Map(rows.map((row) => [row._id, row]));
  return VALUE_BUCKET_BOUNDARIES.slice(0, -1).map((boundary, index) => {
    const row = byBoundary.get(boundary);
    return {
      label: VALUE_BUCKET_LABELS[index],
      count: numberValue(row?.count),
      revenue: numberValue(row?.revenue),
    };
  });
}

// $dayOfWeek is 1=Sunday..7=Saturday in Mongo's aggregation framework.
export async function getOrderDayOfWeekPattern(filters = {}) {
  const range = resolveDateRange(filters);
  const rows = await Order.aggregate([
    { $match: { ...baseMatch(range, resolveEntityMatch(filters)), status: { $in: ACCEPTED_ORDER_STATUSES } } },
    {
      $group: {
        _id: { $dayOfWeek: "$createdAt" },
        count: { $sum: 1 },
        revenue: { $sum: "$totals.total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map(rows.map((row) => [row._id, row]));
  return DAY_NAMES.map((label, index) => {
    const row = byDay.get(index + 1);
    return {
      label,
      count: numberValue(row?.count),
      revenue: numberValue(row?.revenue),
    };
  });
}

export async function getLargestOrders(filters = {}, limit = 10) {
  const range = resolveDateRange(filters);
  const rows = await Order.find({ ...baseMatch(range, resolveEntityMatch(filters)), status: { $in: ACCEPTED_ORDER_STATUSES } })
    .select("orderNumber totals.total createdAt dealerSnapshot.companyName dealerSnapshot.fulfillmentMode")
    .sort({ "totals.total": -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 10)))
    .lean();

  return rows.map((order) => ({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    total: numberValue(order.totals?.total),
    createdAt: order.createdAt,
    dealerName: order.dealerSnapshot?.companyName || "Unknown dealer",
    route: order.dealerSnapshot?.fulfillmentMode === "DISPATCHER" ? "DISPATCHER" : "FACTORY",
  }));
}
