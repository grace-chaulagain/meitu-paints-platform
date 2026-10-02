import Order from "../../models/Order.model.js";
import Payment from "../../models/Payment.model.js";
import {
  ACCEPTED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  PAID_PAYMENT_STATUSES,
  REPORTING_TIMEZONE,
  nepalDateString,
  numberValue,
  growth,
  receivedPaymentMatch,
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
        _id: { $dateTrunc: { date: "$createdAt", unit: granularity, timezone: REPORTING_TIMEZONE } },
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $addFields: { date: nepalDateString("$_id") } },
  ]);

  return rows.map((row) => ({
    date: row.date,
    revenue: numberValue(row.revenue),
    orderCount: numberValue(row.orderCount),
  }));
}

// How the window's accepted orders said they would be paid - the method the
// dealer chose on the order. An intention, not money received (see
// paymentMethodMix), but until payments are recorded it is the only payment
// information there is, so it is shown as "payment terms", not dropped.
async function paymentTermsMix(range, entity) {
  const rows = await Order.aggregate([
    { $match: acceptedRevenueMatch(range, entity) },
    {
      $group: {
        // The schema defaults the method to "", so a blank one and a
        // missing one must land in the same bucket.
        _id: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ["$payment.method", ""] } }, 0] },
            "$payment.method",
            "Unspecified",
          ],
        },
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

// Money actually received in the window, by how it was paid - from the
// Payment ledger, scoped to the same parties as Meitu's receivables (see
// receivedPaymentMatch).
async function paymentMethodMix(range, filters) {
  const match = { status: { $in: PAID_PAYMENT_STATUSES }, ...(await receivedPaymentMatch(filters)) };
  if (!range.isAllTime) {
    match.createdAt = { $gte: range.start, $lte: range.end };
  }

  const rows = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$method", "Unspecified"] },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  return rows.map((row) => ({
    method: row._id,
    amount: numberValue(row.amount),
    count: numberValue(row.count),
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

  const [current, previous, trend, paymentTerms, paymentMix, arOutstanding, arOverdue] = await Promise.all([
    revenueTotals(currentMatch),
    previousMatch ? revenueTotals(previousMatch) : Promise.resolve({ revenue: 0, orderCount: 0 }),
    revenueTrend(range, granularity, entity),
    paymentTermsMix(range, entity),
    paymentMethodMix(range, filters),
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
    paymentTerms,
    paymentMix,
  };
}
