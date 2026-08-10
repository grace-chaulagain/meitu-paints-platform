import Order from "../../models/Order.model.js";
import {
  ACCEPTED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  numberValue,
  growth,
  resolveDateRange,
  resolveEntityMatch,
} from "./insightsShared.js";
import { getFleetArTotal, getOverdueArTotal } from "./dealerStatements.service.js";

function acceptedRevenueMatch(range, entity = {}) {
  const match = {
    isDeleted: { $ne: true },
    orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
    status: { $in: ACCEPTED_ORDER_STATUSES },
    ...entity,
  };
  if (!range.isAllTime) {
    match.createdAt = { $gte: range.start, $lte: range.end };
  }
  return match;
}

async function revenueTotals(match) {
  const [row] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
      },
    },
  ]);
  return {
    revenue: numberValue(row?.revenue),
    orderCount: numberValue(row?.orderCount),
  };
}

// Real recharts-ready trend series, day/week/month granularity chosen by
// the caller - replaces the old hardcoded daily-under-120-days-else-
// monthly binary switch with a real user-selectable bucket.
async function revenueTrend(range, granularity, entity) {
  const match = acceptedRevenueMatch(range, entity);
  const rows = await Order.aggregate([
    { $match: match },
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
  }));
}

async function paymentMethodMix(range, entity) {
  const match = acceptedRevenueMatch(range, entity);
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$payment.method", "Unspecified"] },
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  return rows.map((row) => ({
    method: row._id,
    revenue: numberValue(row.revenue),
    orderCount: numberValue(row.orderCount),
  }));
}

export async function getCashPosition(filters = {}) {
  const range = resolveDateRange(filters);
  const granularity = ["day", "week", "month"].includes(filters.granularity)
    ? filters.granularity
    : "day";

  const entity = resolveEntityMatch(filters);
  const currentMatch = acceptedRevenueMatch(range, entity);
  const previousMatch = range.isAllTime
    ? null
    : {
        ...currentMatch,
        createdAt: { $gte: range.previousStart, $lte: range.previousEnd },
      };

  const [current, previous, trend, paymentMix, arOutstanding, arOverdue] = await Promise.all([
    revenueTotals(currentMatch),
    previousMatch ? revenueTotals(previousMatch) : Promise.resolve({ revenue: 0, orderCount: 0 }),
    revenueTrend(range, granularity, entity),
    paymentMethodMix(range, entity),
    getFleetArTotal(filters),
    getOverdueArTotal(filters),
  ]);

  return {
    filters: {
      range: range.isAllTime ? "all" : filters.range || filters.preset || "custom",
      from: range.isAllTime ? "" : range.start.toISOString(),
      to: range.isAllTime ? "" : range.end.toISOString(),
      granularity,
    },
    kpis: {
      revenue: current.revenue,
      orderCount: current.orderCount,
      averageOrderValue: current.orderCount ? current.revenue / current.orderCount : 0,
      revenueGrowth: range.isAllTime ? null : growth(current.revenue, previous.revenue),
      orderCountGrowth: range.isAllTime ? null : growth(current.orderCount, previous.orderCount),
      outstandingAr: arOutstanding,
      overdueAr: arOverdue,
    },
    trend,
    paymentMix,
  };
}
