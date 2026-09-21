// Products/dispatchers/routing performance aggregations - real MongoDB
// $group/$unwind pipelines replacing the old adminInsights.service.js's
// summarizeProducts/summarizeDispatchers/summarizeRouting JS-reduce
// functions. Dealer performance deliberately has no equivalent here - it
// calls the existing getDealerLeaderboard (dealerAnalytics.service.js)
// directly, which already does this correctly.
import Order from "../../models/Order.model.js";
import Dispatcher from "../../models/Dispatcher.model.js";
import {
  ACCEPTED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  numberValue,
  resolveDateRange,
  resolveEntityMatch,
} from "./insightsShared.js";

function acceptedMatch(range, entity = {}) {
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

export async function getProductPerformance(filters = {}, limit = 20) {
  const range = resolveDateRange(filters);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [ranking, categoryMix] = await Promise.all([
    Order.aggregate([
      { $match: acceptedMatch(range, resolveEntityMatch(filters)) },
      { $unwind: "$items" },
      {
        $group: {
          _id: { sku: "$items.sku", name: "$items.name", category: "$items.category" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.lineTotal" },
          orderCount: { $sum: 1 },
          lastOrdered: { $max: "$createdAt" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: safeLimit },
    ]),
    Order.aggregate([
      { $match: acceptedMatch(range, resolveEntityMatch(filters)) },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.category", "Uncategorized"] },
          revenue: { $sum: "$items.lineTotal" },
          quantity: { $sum: "$items.quantity" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  return {
    ranking: ranking.map((row) => ({
      product: row._id.name || row._id.sku || "Unknown product",
      sku: row._id.sku || "",
      category: row._id.category || "Uncategorized",
      quantitySold: numberValue(row.quantitySold),
      revenue: numberValue(row.revenue),
      orderCount: numberValue(row.orderCount),
      lastOrdered: row.lastOrdered,
    })),
    categoryMix: categoryMix.map((row) => ({
      category: row._id,
      revenue: numberValue(row.revenue),
      quantity: numberValue(row.quantity),
      orderCount: numberValue(row.orderCount),
    })),
  };
}

export async function getDispatcherPerformance(filters = {}, limit = 20) {
  const range = resolveDateRange(filters);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const match = {
    ...acceptedMatch(range, resolveEntityMatch(filters)),
    "dealerSnapshot.fulfillmentMode": "DISPATCHER",
    dispatcherId: { $ne: null },
  };

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$dispatcherId",
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
        largestOrder: { $max: "$totals.total" },
        lastActivity: { $max: "$createdAt" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: safeLimit },
  ]);

  const dispatcherIds = rows.map((row) => row._id).filter(Boolean);
  const dispatchers = dispatcherIds.length
    ? await Dispatcher.find({ _id: { $in: dispatcherIds } }).select("name companyName").lean()
    : [];
  const dispatcherById = new Map(dispatchers.map((dispatcher) => [String(dispatcher._id), dispatcher]));

  return rows.map((row) => {
    const dispatcherId = String(row._id);
    const dispatcher = dispatcherById.get(dispatcherId) || null;
    const revenue = numberValue(row.revenue);
    const orderCount = numberValue(row.orderCount);
    return {
      dispatcherId,
      dispatcherName: dispatcher?.companyName || dispatcher?.name || "Unknown dispatcher",
      revenue,
      orderCount,
      averageOrderValue: orderCount ? revenue / orderCount : 0,
      largestOrder: numberValue(row.largestOrder),
      lastActivity: row.lastActivity,
    };
  });
}

export async function getRoutingPerformance(filters = {}) {
  const range = resolveDateRange(filters);

  const rows = await Order.aggregate([
    { $match: acceptedMatch(range, resolveEntityMatch(filters)) },
    {
      $group: {
        _id: { $ifNull: ["$dealerSnapshot.fulfillmentMode", "FACTORY"] },
        revenue: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const byRoute = new Map(rows.map((row) => [row._id, row]));
  const factoryRow = byRoute.get("FACTORY") || { revenue: 0, orderCount: 0 };
  const dispatcherRow = byRoute.get("DISPATCHER") || { revenue: 0, orderCount: 0 };
  const factoryRevenue = numberValue(factoryRow.revenue);
  const dispatcherRevenue = numberValue(dispatcherRow.revenue);
  const totalRevenue = factoryRevenue + dispatcherRevenue;

  return {
    factory: {
      revenue: factoryRevenue,
      orderCount: numberValue(factoryRow.orderCount),
      averageOrderValue: factoryRow.orderCount ? factoryRevenue / numberValue(factoryRow.orderCount) : 0,
      revenueShare: totalRevenue ? (factoryRevenue / totalRevenue) * 100 : 0,
    },
    dispatcher: {
      revenue: dispatcherRevenue,
      orderCount: numberValue(dispatcherRow.orderCount),
      averageOrderValue: dispatcherRow.orderCount ? dispatcherRevenue / numberValue(dispatcherRow.orderCount) : 0,
      revenueShare: totalRevenue ? (dispatcherRevenue / totalRevenue) * 100 : 0,
    },
  };
}
