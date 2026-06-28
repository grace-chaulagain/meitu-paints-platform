import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Order from "../models/Order.model.js";

const DAY_MS = 86400000;
const APPROVED_STATUS = "DELIVERED";

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function getOrderTotal(order) {
  return numberValue(order?.totals?.total);
}

function getOrderCurrency(order) {
  return order?.totals?.currency || "NPR";
}

function getItemName(item) {
  return cleanText(item?.name || item?.nameSnapshot || "");
}

function getItemSku(item) {
  return cleanText(item?.sku || item?.skuSnapshot || item?.code || "");
}

function getItemPack(item) {
  return cleanText(item?.packLabel || item?.variantLabel || item?.unit || item?.uom);
}

function getItemCategory(item) {
  return cleanText(item?.category || "Uncategorized") || "Uncategorized";
}

function getItemQuantity(item) {
  return numberValue(item?.quantity ?? item?.qty);
}

function getItemRevenue(item) {
  return numberValue(item?.lineTotal ?? item?.amount);
}

function normalizePaymentMethod(order) {
  return cleanText(order?.payment?.method || "Unspecified") || "Unspecified";
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(right - left) / DAY_MS;
}

function daysSince(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

function percentage(part, whole) {
  if (!whole) return 0;
  return (numberValue(part) / numberValue(whole)) * 100;
}

function growthRate(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function dayOfWeekName(index) {
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][index] || "Unknown"
  );
}

function timeWindowForDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const hour = date.getHours();
  if (hour < 6) return "Overnight";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

function topEntries(map, sortKey, limit = 8) {
  return Array.from(map.values())
    .sort((a, b) => numberValue(b[sortKey]) - numberValue(a[sortKey]))
    .slice(0, limit);
}

function mostCommonFromMap(map, fallback = "None") {
  const [first] = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  return first?.[0] || fallback;
}

function classifyActivity(lastOrderAt, totalApprovedOrders) {
  if (!totalApprovedOrders) return "NO_APPROVED_ORDERS";
  const inactiveDays = daysSince(lastOrderAt);
  if (inactiveDays == null) return "UNKNOWN";
  if (inactiveDays <= 30) return "ACTIVE";
  if (inactiveDays <= 60) return "WATCH";
  return "INACTIVE";
}

function dealerTier(totalSalesApproved, totalApprovedOrders) {
  if (totalSalesApproved >= 1000000 || totalApprovedOrders >= 20) return "PLATINUM";
  if (totalSalesApproved >= 500000 || totalApprovedOrders >= 12) return "GOLD";
  if (totalSalesApproved >= 150000 || totalApprovedOrders >= 5) return "SILVER";
  if (totalApprovedOrders > 0) return "DEVELOPING";
  return "UNPROVEN";
}

function healthScore({
  totalApprovedOrders,
  daysSinceLastOrder,
  growthRateRevenue30d,
  approvalRate,
  productConcentrationScore,
}) {
  let score = 45;

  if (totalApprovedOrders >= 10) score += 18;
  else if (totalApprovedOrders >= 3) score += 10;
  else if (totalApprovedOrders > 0) score += 4;

  if (daysSinceLastOrder == null) score -= 15;
  else if (daysSinceLastOrder <= 30) score += 18;
  else if (daysSinceLastOrder <= 60) score += 4;
  else score -= 18;

  if (growthRateRevenue30d > 25) score += 12;
  else if (growthRateRevenue30d < -25) score -= 12;

  if (approvalRate >= 80) score += 10;
  else if (approvalRate < 50) score -= 10;

  if (productConcentrationScore > 70) score -= 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildRiskAndOpportunity({
  performanceSummary,
  orderBehavior,
  productIntelligence,
}) {
  const riskFlags = [];
  const recommendations = [];
  const opportunityTags = [];

  if (!performanceSummary.totalApprovedOrders) {
    riskFlags.push("No approved orders yet");
    recommendations.push("Monitor onboarding and first-order conversion");
  }

  if (
    performanceSummary.daysSinceLastOrder != null &&
    performanceSummary.daysSinceLastOrder >= 45
  ) {
    riskFlags.push(`Inactive for ${performanceSummary.daysSinceLastOrder}+ days`);
    recommendations.push("Follow up on dormant account activity");
  }

  if (orderBehavior.growthRateRevenue30d < -30) {
    riskFlags.push("Revenue down significantly in the last 30 days");
    recommendations.push("Review recent demand change and routing friction");
  }

  if (orderBehavior.rejectionRate > 25) {
    riskFlags.push("High rejection ratio");
    recommendations.push("Audit order quality and payment completeness");
  }

  if (productIntelligence.productConcentrationScore > 70) {
    riskFlags.push("Overly concentrated product dependency");
    recommendations.push("Introduce adjacent products to reduce concentration");
  }

  if (
    performanceSummary.totalSalesApproved >= 250000 &&
    productIntelligence.uniqueProductsOrderedCount >= 3
  ) {
    opportunityTags.push("High-value account");
    recommendations.push("Candidate for upsell into premium products");
  }

  if (orderBehavior.repeatOrderRate >= 60) {
    opportunityTags.push("Strong repeat-order behavior");
  }

  if (
    performanceSummary.totalApprovedOrders >= 3 &&
    productIntelligence.productConcentrationScore >= 55
  ) {
    opportunityTags.push("High-volume but narrow product mix");
  }

  if (!recommendations.length) {
    recommendations.push("Maintain steady account monitoring");
  }

  return {
    dealerTier: dealerTier(
      performanceSummary.totalSalesApproved,
      performanceSummary.totalApprovedOrders,
    ),
    businessHealthScore: healthScore({
      totalApprovedOrders: performanceSummary.totalApprovedOrders,
      daysSinceLastOrder: performanceSummary.daysSinceLastOrder,
      growthRateRevenue30d: orderBehavior.growthRateRevenue30d,
      approvalRate: orderBehavior.approvalRate,
      productConcentrationScore:
        productIntelligence.productConcentrationScore,
    }),
    opportunityScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          performanceSummary.totalSalesApproved / 10000 +
            orderBehavior.repeatOrderRate / 2 -
            (performanceSummary.daysSinceLastOrder || 0) / 3,
        ),
      ),
    ),
    riskFlags,
    opportunityTags,
    recommendations: Array.from(new Set(recommendations)),
  };
}

function summarizeDealerOrders({ dealer, orders }) {
  const allOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const approvedOrders = allOrders.filter((order) => order.status === APPROVED_STATUS);
  const submittedOrders = allOrders.filter((order) => order.status === "SUBMITTED");
  const rejectedOrders = allOrders.filter((order) => order.status === "REJECTED");
  const archivedOrders = allOrders.filter((order) => order.archivedAt);

  const totalSalesAllTime = allOrders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const totalSalesApproved = approvedOrders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const approvedTotals = approvedOrders.map(getOrderTotal);
  const largestApprovedOrderValue = Math.max(0, ...approvedTotals);
  const smallestApprovedOrderValue = approvedTotals.length
    ? Math.min(...approvedTotals)
    : 0;

  const firstOrderAt = allOrders[0]?.createdAt || null;
  const lastOrderAt = approvedOrders[approvedOrders.length - 1]?.createdAt || null;
  const lastAnyOrderAt = allOrders[allOrders.length - 1]?.createdAt || null;

  const orderGaps = [];
  for (let i = 1; i < approvedOrders.length; i += 1) {
    const gap = daysBetween(approvedOrders[i - 1].createdAt, approvedOrders[i].createdAt);
    if (gap != null) orderGaps.push(gap);
  }

  const averageDaysBetweenOrders = orderGaps.length
    ? orderGaps.reduce((sum, gap) => sum + gap, 0) / orderGaps.length
    : null;

  const now = Date.now();
  const recent30Start = now - 30 * DAY_MS;
  const previous30Start = now - 60 * DAY_MS;
  const recent30Orders = approvedOrders.filter(
    (order) => new Date(order.createdAt).getTime() >= recent30Start,
  );
  const previous30Orders = approvedOrders.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= previous30Start && created < recent30Start;
  });

  const recent30DayRevenue = recent30Orders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const previous30DayRevenue = previous30Orders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );

  const productMap = new Map();
  const categoryMap = new Map();
  const paymentMethodMap = new Map();
  const orderDayMap = new Map();
  const orderTimeWindowMap = new Map();

  let totalUnitsOrdered = 0;
  let totalLineRevenue = 0;
  let totalItems = 0;
  let totalUniqueProductsPerOrder = 0;
  let repeatOrders = 0;

  for (const order of approvedOrders) {
    const paymentMethod = normalizePaymentMethod(order);
    paymentMethodMap.set(paymentMethod, (paymentMethodMap.get(paymentMethod) || 0) + 1);

    const dayName = dayOfWeekName(new Date(order.createdAt).getDay());
    orderDayMap.set(dayName, (orderDayMap.get(dayName) || 0) + 1);

    const timeWindow = timeWindowForDate(order.createdAt);
    orderTimeWindowMap.set(
      timeWindow,
      (orderTimeWindowMap.get(timeWindow) || 0) + 1,
    );

    const seenProducts = new Set();
    for (const item of order.items || []) {
      const sku = getItemSku(item);
      const name = getItemName(item);
      const key = cleanText(sku || name);
      if (!key) continue;

      const quantity = getItemQuantity(item);
      const revenue = getItemRevenue(item);
      const category = getItemCategory(item);
      totalUnitsOrdered += quantity;
      totalLineRevenue += revenue;
      totalItems += 1;
      seenProducts.add(key);

      const product = productMap.get(key) || {
        productId: item?.productId || null,
        sku,
        name,
        packLabel: getItemPack(item),
        category,
        quantity: 0,
        totalQuantityOrdered: 0,
        totalRevenueGenerated: 0,
        totalValue: 0,
        orderFrequency: 0,
        lastOrderedAt: null,
      };

      product.quantity += quantity;
      product.totalQuantityOrdered += quantity;
      product.totalRevenueGenerated += revenue;
      product.totalValue += revenue;
      product.lastOrderedAt =
        !product.lastOrderedAt ||
        new Date(order.createdAt).getTime() >
          new Date(product.lastOrderedAt).getTime()
          ? order.createdAt
          : product.lastOrderedAt;
      productMap.set(key, product);

      const categoryEntry = categoryMap.get(category) || {
        category,
        totalQuantityOrdered: 0,
        totalRevenueGenerated: 0,
        orderFrequency: 0,
      };
      categoryEntry.totalQuantityOrdered += quantity;
      categoryEntry.totalRevenueGenerated += revenue;
      categoryMap.set(category, categoryEntry);
    }

    for (const key of seenProducts) {
      const product = productMap.get(key);
      if (product) product.orderFrequency += 1;
    }

    for (const category of new Set(
      (order.items || []).map((item) => getItemCategory(item)),
    )) {
      const categoryEntry = categoryMap.get(category);
      if (categoryEntry) categoryEntry.orderFrequency += 1;
    }

    if (seenProducts.size > 0) totalUniqueProductsPerOrder += seenProducts.size;
  }

  repeatOrders = approvedOrders.length > 1 ? approvedOrders.length - 1 : 0;

  const products = Array.from(productMap.values()).map((product) => ({
    ...product,
    shareOfDealerVolume: totalUnitsOrdered
      ? (product.totalQuantityOrdered / totalUnitsOrdered) * 100
      : 0,
  }));

  const topProductsByQuantity = [...products]
    .sort(
      (a, b) =>
        b.totalQuantityOrdered - a.totalQuantityOrdered ||
        b.totalRevenueGenerated - a.totalRevenueGenerated,
    )
    .slice(0, 8);

  const topProductsByRevenue = [...products]
    .sort(
      (a, b) =>
        b.totalRevenueGenerated - a.totalRevenueGenerated ||
        b.totalQuantityOrdered - a.totalQuantityOrdered,
    )
    .slice(0, 8);

  const topProductRevenue = topProductsByRevenue[0]?.totalRevenueGenerated || 0;
  const productConcentrationScore = totalLineRevenue
    ? (topProductRevenue / totalLineRevenue) * 100
    : 0;

  const performanceSummary = {
    totalOrdersAllTime: allOrders.length,
    totalApprovedOrders: approvedOrders.length,
    totalSubmittedOrders: submittedOrders.length,
    totalRejectedOrders: rejectedOrders.length,
    totalArchivedOrders: archivedOrders.length,
    totalSalesApproved,
    totalSalesAllTime,
    averageApprovedOrderValue: approvedOrders.length
      ? totalSalesApproved / approvedOrders.length
      : 0,
    largestApprovedOrderValue,
    smallestApprovedOrderValue,
    firstOrderAt,
    lastOrderAt,
    daysSinceLastOrder: daysSince(lastOrderAt),
    lifetimeDaysActive:
      firstOrderAt && lastAnyOrderAt ? Math.max(1, Math.ceil(daysBetween(firstOrderAt, lastAnyOrderAt))) : 0,
    averageDaysBetweenOrders,
    currentActivityStatus: classifyActivity(lastOrderAt, approvedOrders.length),
    fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
    assignedDispatcher: dealer.dispatcherId || null,
    factoryOrderCount: approvedOrders.filter(
      (order) => (order.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY",
    ).length,
    dispatcherOrderCount: approvedOrders.filter(
      (order) => order.dealerSnapshot?.fulfillmentMode === "DISPATCHER",
    ).length,
  };

  const productIntelligence = {
    uniqueProductsOrderedCount: products.length,
    totalUnitsOrdered,
    topProductsByQuantity,
    topProductsByRevenue,
    topCategoriesByQuantity: topEntries(
      categoryMap,
      "totalQuantityOrdered",
      8,
    ),
    topCategoriesByRevenue: topEntries(
      categoryMap,
      "totalRevenueGenerated",
      8,
    ),
    mostRecentProductsOrdered: [...products]
      .sort(
        (a, b) =>
          new Date(b.lastOrderedAt || 0).getTime() -
          new Date(a.lastOrderedAt || 0).getTime(),
      )
      .slice(0, 8),
    productConcentrationScore,
  };

  const orderBehavior = {
    averageOrderSize: performanceSummary.averageApprovedOrderValue,
    averageItemsPerOrder: approvedOrders.length
      ? totalItems / approvedOrders.length
      : 0,
    averageUniqueProductsPerOrder: approvedOrders.length
      ? totalUniqueProductsPerOrder / approvedOrders.length
      : 0,
    mostCommonPaymentMethod: mostCommonFromMap(paymentMethodMap),
    paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(
      ([method, count]) => ({ method, count }),
    ),
    mostCommonOrderDayOfWeek: mostCommonFromMap(orderDayMap),
    mostCommonOrderTimeWindow: mostCommonFromMap(orderTimeWindowMap),
    recent30DayOrders: recent30Orders.length,
    recent30DayRevenue,
    previous30DayOrders: previous30Orders.length,
    previous30DayRevenue,
    growthRateOrders30d: growthRate(recent30Orders.length, previous30Orders.length),
    growthRateRevenue30d: growthRate(recent30DayRevenue, previous30DayRevenue),
    repeatOrderRate: approvedOrders.length
      ? percentage(repeatOrders, approvedOrders.length)
      : 0,
    approvalRate: allOrders.length
      ? percentage(approvedOrders.length, allOrders.length)
      : 0,
    rejectionRate: allOrders.length
      ? percentage(rejectedOrders.length, allOrders.length)
      : 0,
  };

  const commercial = buildRiskAndOpportunity({
    performanceSummary,
    orderBehavior,
    productIntelligence,
  });

  const mostRecentApprovedOrder = approvedOrders[approvedOrders.length - 1] || null;
  const orderFrequencyTrend =
    orderBehavior.recent30DayOrders > orderBehavior.previous30DayOrders
      ? "UP"
      : orderBehavior.recent30DayOrders < orderBehavior.previous30DayOrders
        ? "DOWN"
        : "STEADY";

  return {
    identity: {
      dealerId: dealer._id,
      companyName: dealer.companyName,
      contactName: dealer.contactName,
      status: dealer.status,
      fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
      assignedDispatcher: dealer.dispatcherId || null,
      createdAt: dealer.createdAt,
      updatedAt: dealer.updatedAt,
    },
    performanceSummary,
    productIntelligence,
    orderBehavior,
    commercial,
    stats: {
      ...performanceSummary,
      mostRecentApprovedOrder: mostRecentApprovedOrder
        ? {
            _id: mostRecentApprovedOrder._id,
            orderNumber: mostRecentApprovedOrder.orderNumber,
            total: getOrderTotal(mostRecentApprovedOrder),
            currency: getOrderCurrency(mostRecentApprovedOrder),
            createdAt: mostRecentApprovedOrder.createdAt,
          }
        : null,
      orderFrequencyTrend,
      last30Days: orderBehavior.recent30DayOrders,
      previous30Days: orderBehavior.previous30DayOrders,
      activePattern: performanceSummary.currentActivityStatus,
      repeatOrderBehavior:
        approvedOrders.length >= 3 ? "REPEAT" : approvedOrders.length ? "EARLY" : "NONE",
      dealerTier: commercial.dealerTier,
      businessHealthScore: commercial.businessHealthScore,
    },
    products: productIntelligence.topProductsByRevenue,
  };
}

export async function getDealerAnalytics({ dealerId } = {}) {
  const dealerObjectId = toObjectId(dealerId);
  if (!dealerObjectId) throw new ApiError(400, "Missing dealerId");

  const dealer = await DealerProfile.findById(dealerObjectId)
    .populate({
      path: "dispatcherId",
      select: "name companyName email phone status isActive",
    })
    .lean();

  if (!dealer) throw new ApiError(404, "Dealer not found");

  const orders = await Order.find({
    dealerId: dealerObjectId,
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    dealer,
    ...summarizeDealerOrders({ dealer, orders }),
  };
}

export async function getDealerLeaderboard({
  sort = "totalSales",
  limit = 50,
  fulfillmentMode,
  dispatcherId,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const sortKey = String(sort || "totalSales");
  const sortMap = {
    totalSales: { totalSales: -1 },
    orderCount: { orderCount: -1 },
    latestActivity: { latestActivity: -1 },
    biggestOrder: { biggestOrder: -1 },
    growthTrend: { recent30DayRevenue: -1 },
  };

  const now = new Date();
  const recent30 = new Date(now.getTime() - 30 * DAY_MS);
  const previous30 = new Date(now.getTime() - 60 * DAY_MS);

  const match = {
    status: APPROVED_STATUS,
    isDeleted: { $ne: true },
  };

  const normalizedMode = cleanText(fulfillmentMode).toUpperCase();
  if (["FACTORY", "DISPATCHER"].includes(normalizedMode)) {
    match["dealerSnapshot.fulfillmentMode"] = normalizedMode;
  }

  const dispatcherObjectId = toObjectId(dispatcherId);
  if (dispatcherId && !dispatcherObjectId) {
    throw new ApiError(400, "Invalid dispatcherId");
  }

  if (dispatcherObjectId) {
    match.dispatcherId = dispatcherObjectId;
    match["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  }

  const rows = await Order.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$dealerId",
        totalSales: { $sum: "$totals.total" },
        orderCount: { $sum: 1 },
        latestActivity: { $max: "$createdAt" },
        biggestOrder: { $max: "$totals.total" },
        recent30DayRevenue: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", recent30] }, "$totals.total", 0],
          },
        },
        previous30DayRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$createdAt", previous30] },
                  { $lt: ["$createdAt", recent30] },
                ],
              },
              "$totals.total",
              0,
            ],
          },
        },
        factoryOrderCount: {
          $sum: {
            $cond: [
              { $eq: ["$dealerSnapshot.fulfillmentMode", "FACTORY"] },
              1,
              0,
            ],
          },
        },
        dispatcherOrderCount: {
          $sum: {
            $cond: [
              { $eq: ["$dealerSnapshot.fulfillmentMode", "DISPATCHER"] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: sortMap[sortKey] || sortMap.totalSales },
    { $limit: safeLimit },
  ]);

  const dealers = await DealerProfile.find({
    _id: { $in: rows.map((row) => row._id).filter(Boolean) },
  })
    .populate({
      path: "dispatcherId",
      select: "name companyName email phone status isActive",
    })
    .lean();

  const dealerMap = new Map(
    dealers.map((dealer) => [String(dealer._id), dealer]),
  );
  const rowDealerIds = rows.map((row) => row._id).filter(Boolean);
  const concentrationRows = rowDealerIds.length
    ? await Order.aggregate([
        {
          $match: {
            ...match,
            dealerId: { $in: rowDealerIds },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              dealerId: "$dealerId",
              productKey: {
                $ifNull: ["$items.sku", "$items.name"],
              },
            },
            revenue: { $sum: "$items.lineTotal" },
            quantity: { $sum: "$items.quantity" },
          },
        },
        {
          $group: {
            _id: "$_id.dealerId",
            totalProductRevenue: { $sum: "$revenue" },
            topProductRevenue: { $max: "$revenue" },
            uniqueProductsOrderedCount: { $sum: 1 },
            totalUnitsOrdered: { $sum: "$quantity" },
          },
        },
      ])
    : [];
  const concentrationMap = new Map(
    concentrationRows.map((row) => [String(row._id), row]),
  );

  return {
    items: rows.map((row, index) => {
      const dealer = dealerMap.get(String(row._id)) || null;
      const concentration = concentrationMap.get(String(row._id)) || {};
      const daysSinceLastOrder = daysSince(row.latestActivity);
      const currentActivityStatus = classifyActivity(
        row.latestActivity,
        row.orderCount || 0,
      );

      return {
        rank: index + 1,
        dealer,
        dealerId: row._id,
        totalSales: row.totalSales || 0,
        orderCount: row.orderCount || 0,
        latestActivity: row.latestActivity || null,
        biggestOrder: row.biggestOrder || 0,
        factoryOrderCount: row.factoryOrderCount || 0,
        dispatcherOrderCount: row.dispatcherOrderCount || 0,
        recent30DayRevenue: row.recent30DayRevenue || 0,
        previous30DayRevenue: row.previous30DayRevenue || 0,
        growthRateRevenue30d: growthRate(
          row.recent30DayRevenue || 0,
          row.previous30DayRevenue || 0,
        ),
        productConcentrationScore: concentration.totalProductRevenue
          ? ((concentration.topProductRevenue || 0) /
              concentration.totalProductRevenue) *
            100
          : 0,
        uniqueProductsOrderedCount:
          concentration.uniqueProductsOrderedCount || 0,
        totalUnitsOrdered: concentration.totalUnitsOrdered || 0,
        currentActivityStatus,
        daysSinceLastOrder,
        dealerTier: dealerTier(row.totalSales || 0, row.orderCount || 0),
      };
    }),
  };
}
