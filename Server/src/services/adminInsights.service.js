import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import Order from "../models/Order.model.js";

const DAY_MS = 86400000;
const APPROVED_STATUS = "VERIFIED";

function normalize(value = "") {
  return String(value || "").trim();
}

function normalizeUpper(value = "") {
  return normalize(value).toUpperCase();
}

function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function objectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function idOf(value) {
  if (!value) return "";
  if (value._id) return String(value._id);
  return String(value);
}

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid insights date range");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  return date;
}

function resolveDateRange(filters = {}) {
  const { from, to } = filters;
  const requestedRange = normalizeUpper(filters.range || filters.preset);
  const now = new Date();
  const fallbackTo = new Date(now);
  fallbackTo.setHours(23, 59, 59, 999);

  if (requestedRange === "ALL") {
    const start = new Date(0);
    const end = fallbackTo;
    return {
      start,
      end,
      previousStart: null,
      previousEnd: null,
      isAllTime: true,
    };
  }

  const fallbackFrom = new Date(fallbackTo.getTime() - 29 * DAY_MS);
  fallbackFrom.setHours(0, 0, 0, 0);

  const start = parseDateBoundary(from, false) || fallbackFrom;
  const end = parseDateBoundary(to, true) || fallbackTo;

  if (start.getTime() > end.getTime()) {
    throw new ApiError(400, "Insights start date cannot be after end date");
  }

  const spanMs = Math.max(DAY_MS, end.getTime() - start.getTime());
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - spanMs);

  return { start, end, previousStart, previousEnd };
}

function getOrderTotal(order) {
  return numberValue(order?.totals?.total);
}

function getCurrency(orders = []) {
  return orders.find((order) => order?.totals?.currency)?.totals?.currency || "NPR";
}

function getRoute(order) {
  return normalizeUpper(order?.dealerSnapshot?.fulfillmentMode || (order?.dispatcherId ? "DISPATCHER" : "FACTORY")) === "DISPATCHER"
    ? "DISPATCHER"
    : "FACTORY";
}

function getDealerName(dealer, fallback = "Unknown dealer") {
  return (
    dealer?.companyName ||
    dealer?.contactName ||
    dealer?.email ||
    fallback
  );
}

function getDispatcherName(dispatcher, fallback = "Unassigned dispatcher") {
  return dispatcher?.companyName || dispatcher?.name || dispatcher?.email || fallback;
}

function getDealerForOrder(order, dealerMap) {
  const dealerId = idOf(order?.dealerId);
  return dealerMap.get(dealerId) || order?.dealerId || {
    _id: dealerId,
    companyName: order?.dealerSnapshot?.companyName || "Unknown dealer",
    contactName: order?.dealerSnapshot?.contactName || "",
    fulfillmentMode: order?.dealerSnapshot?.fulfillmentMode || getRoute(order),
  };
}

function getDispatcherForOrder(order, dispatcherMap) {
  const dispatcherId = idOf(order?.dispatcherId);
  return dispatcherMap.get(dispatcherId) || order?.dispatcherId || {
    _id: dispatcherId,
    companyName: order?.dispatcherSnapshot?.companyName || "",
    name: order?.dispatcherSnapshot?.name || "Unassigned dispatcher",
  };
}

function itemKey(item) {
  return normalize(item?.sku || item?.code || item?.name || "Unknown product");
}

function itemName(item) {
  return normalize(item?.name || item?.sku || "Unknown product");
}

function itemCategory(item) {
  return normalize(item?.category || "Uncategorized") || "Uncategorized";
}

function paymentMethod(order) {
  return normalize(order?.payment?.method || "Unspecified") || "Unspecified";
}

function dayName(dateValue) {
  const date = new Date(dateValue);
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][date.getDay()] || "Unknown"
  );
}

function timeWindow(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const hour = date.getHours();
  if (hour < 6) return "Overnight";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

function median(values = []) {
  const sorted = values.map(numberValue).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentage(part, whole) {
  const denominator = numberValue(whole);
  if (!denominator) return 0;
  return (numberValue(part) / denominator) * 100;
}

function growth(current, previous) {
  const currentValue = numberValue(current);
  const previousValue = numberValue(previous);
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function daysSince(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

function activityState(latestApprovedAt, approvedOrderCount = 0) {
  if (!approvedOrderCount) return "DORMANT";
  const inactiveDays = daysSince(latestApprovedAt);
  if (inactiveDays == null) return "DORMANT";
  if (inactiveDays <= 30) return "ACTIVE";
  if (inactiveDays <= 60) return "SLOW";
  return "DORMANT";
}

function healthScore({ revenue, approvedOrders, largestOrder, daysInactive, growthRate }) {
  let score = 42;
  if (revenue >= 1000000) score += 20;
  else if (revenue >= 500000) score += 14;
  else if (revenue >= 150000) score += 8;
  if (approvedOrders >= 15) score += 18;
  else if (approvedOrders >= 6) score += 11;
  else if (approvedOrders > 0) score += 5;
  if (largestOrder >= 250000) score += 6;
  if (daysInactive == null || daysInactive > 60) score -= 18;
  else if (daysInactive <= 30) score += 12;
  if (growthRate > 20) score += 10;
  if (growthRate < -20) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addMapValue(map, key, patch) {
  const current = map.get(key) || {};
  map.set(key, { ...current, ...patch });
  return map.get(key);
}

function top(items, key, limit = 8) {
  return [...items]
    .sort((a, b) => numberValue(b[key]) - numberValue(a[key]))
    .slice(0, limit);
}

function trendKey(dateValue, range) {
  const date = new Date(dateValue);
  const totalDays = Math.ceil((range.end.getTime() - range.start.getTime()) / DAY_MS);
  if (totalDays > 120) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return date.toISOString().slice(0, 10);
}

function pushSignal(signals, title, body, tone = "neutral") {
  if (!body) return;
  signals.push({ title, body, tone });
}

function buildOrderQuery({ filters, range, dealerScopeIds }) {
  const q = {
    isDeleted: { $ne: true },
  };

  if (!range?.isAllTime) {
    q.createdAt = { $gte: range.start, $lte: range.end };
  }

  const status = normalizeUpper(filters.status);
  if (status === "APPROVED" || status === "VERIFIED") q.status = APPROVED_STATUS;
  else if (status === "SUBMITTED") q.status = "SUBMITTED";
  else if (status === "REJECTED") q.status = "REJECTED";
  else if (status === "ARCHIVED") q.archivedAt = { $ne: null };

  const routing = normalizeUpper(filters.routing);
  if (routing === "FACTORY") q["dealerSnapshot.fulfillmentMode"] = "FACTORY";
  if (routing === "DISPATCHER_ALL") q["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";

  const dispatcherObjectId = objectId(filters.dispatcherId);
  if (dispatcherObjectId) {
    q.dispatcherId = dispatcherObjectId;
    q["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  }

  const dealerObjectId = objectId(filters.dealerId);
  if (dealerObjectId) q.dealerId = dealerObjectId;
  else if (Array.isArray(dealerScopeIds)) q.dealerId = { $in: dealerScopeIds };

  const category = normalize(filters.category);
  if (category && normalizeUpper(category) !== "ALL") q["items.category"] = category;

  return q;
}

function buildTrend(orders, range) {
  const map = new Map();

  for (const order of orders) {
    const key = trendKey(order.createdAt, range);
    const entry = map.get(key) || {
      label: key,
      revenue: 0,
      orders: 0,
      approvedOrders: 0,
      rejectedOrders: 0,
      averageOrderValue: 0,
      factoryRevenue: 0,
      dispatcherRevenue: 0,
      factoryOrders: 0,
      dispatcherOrders: 0,
    };

    entry.orders += 1;
    if (order.status === APPROVED_STATUS) {
      entry.approvedOrders += 1;
      entry.revenue += getOrderTotal(order);
      if (getRoute(order) === "FACTORY") {
        entry.factoryRevenue += getOrderTotal(order);
        entry.factoryOrders += 1;
      } else {
        entry.dispatcherRevenue += getOrderTotal(order);
        entry.dispatcherOrders += 1;
      }
    }
    if (order.status === "REJECTED") entry.rejectedOrders += 1;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => ({
      ...entry,
      averageOrderValue: entry.approvedOrders ? entry.revenue / entry.approvedOrders : 0,
    }));
}

function buildDistribution(approvedOrders) {
  const buckets = [
    { label: "< 50K", min: 0, max: 50000, count: 0, revenue: 0 },
    { label: "50K-100K", min: 50000, max: 100000, count: 0, revenue: 0 },
    { label: "100K-250K", min: 100000, max: 250000, count: 0, revenue: 0 },
    { label: "250K-500K", min: 250000, max: 500000, count: 0, revenue: 0 },
    { label: "500K+", min: 500000, max: Infinity, count: 0, revenue: 0 },
  ];

  const byDay = new Map();
  const byTimeWindow = new Map();
  const byPaymentMethod = new Map();

  for (const order of approvedOrders) {
    const total = getOrderTotal(order);
    const bucket = buckets.find((item) => total >= item.min && total < item.max) || buckets[buckets.length - 1];
    bucket.count += 1;
    bucket.revenue += total;

    const day = dayName(order.createdAt);
    addMapValue(byDay, day, {
      label: day,
      count: (byDay.get(day)?.count || 0) + 1,
      revenue: (byDay.get(day)?.revenue || 0) + total,
    });

    const window = timeWindow(order.createdAt);
    addMapValue(byTimeWindow, window, {
      label: window,
      count: (byTimeWindow.get(window)?.count || 0) + 1,
      revenue: (byTimeWindow.get(window)?.revenue || 0) + total,
    });

    const method = paymentMethod(order);
    addMapValue(byPaymentMethod, method, {
      label: method,
      count: (byPaymentMethod.get(method)?.count || 0) + 1,
      revenue: (byPaymentMethod.get(method)?.revenue || 0) + total,
    });
  }

  return {
    valueBuckets: buckets,
    byDay: Array.from(byDay.values()),
    byTimeWindow: Array.from(byTimeWindow.values()),
    byPaymentMethod: top(Array.from(byPaymentMethod.values()), "revenue", 8),
  };
}

function summarizeDealers({ dealers, orders, previousOrders, dealerActivityMap }) {
  const previousByDealer = new Map();
  for (const order of previousOrders.filter((item) => item.status === APPROVED_STATUS)) {
    const dealerId = idOf(order.dealerId);
    previousByDealer.set(dealerId, (previousByDealer.get(dealerId) || 0) + getOrderTotal(order));
  }

  const stats = new Map();
  for (const dealer of dealers) {
    const id = idOf(dealer);
    const activity = dealerActivityMap.get(id) || {};
    stats.set(id, {
      dealerId: id,
      dealer,
      dealerName: getDealerName(dealer),
      approvedSales: 0,
      approvedOrders: 0,
      submittedOrders: 0,
      rejectedOrders: 0,
      averageOrderValue: 0,
      largestOrder: 0,
      lastActivity: activity.latestApprovedAt || null,
      routingMode: dealer.fulfillmentMode || "FACTORY",
      assignedDispatcher: dealer.dispatcherId || null,
      growthRate: 0,
      activityState: activityState(activity.latestApprovedAt, activity.approvedOrderCount || 0),
      healthScore: 0,
      productRevenue: new Map(),
      categoryRevenue: new Map(),
    });
  }

  for (const order of orders) {
    const dealerId = idOf(order.dealerId);
    const dealer = getDealerForOrder(order, new Map(dealers.map((item) => [idOf(item), item])));
    const entry =
      stats.get(dealerId) ||
      addMapValue(stats, dealerId, {
        dealerId,
        dealer,
        dealerName: getDealerName(dealer),
        approvedSales: 0,
        approvedOrders: 0,
        submittedOrders: 0,
        rejectedOrders: 0,
        averageOrderValue: 0,
        largestOrder: 0,
        lastActivity: null,
        routingMode: dealer?.fulfillmentMode || order?.dealerSnapshot?.fulfillmentMode || getRoute(order),
        assignedDispatcher: dealer?.dispatcherId || order?.dispatcherId || null,
        growthRate: 0,
        activityState: "DORMANT",
        healthScore: 0,
        productRevenue: new Map(),
        categoryRevenue: new Map(),
      });

    if (order.status === "SUBMITTED") entry.submittedOrders += 1;
    if (order.status === "REJECTED") entry.rejectedOrders += 1;
    if (order.status === APPROVED_STATUS) {
      const total = getOrderTotal(order);
      entry.approvedSales += total;
      entry.approvedOrders += 1;
      entry.largestOrder = Math.max(entry.largestOrder, total);
      entry.lastActivity =
        !entry.lastActivity ||
        new Date(order.createdAt).getTime() > new Date(entry.lastActivity).getTime()
          ? order.createdAt
          : entry.lastActivity;

      for (const item of order.items || []) {
        const key = itemKey(item);
        const category = itemCategory(item);
        entry.productRevenue.set(key, (entry.productRevenue.get(key) || 0) + numberValue(item.lineTotal));
        entry.categoryRevenue.set(category, (entry.categoryRevenue.get(category) || 0) + numberValue(item.lineTotal));
      }
    }
  }

  const rows = Array.from(stats.values()).map((entry) => {
    const previousRevenue = previousByDealer.get(entry.dealerId) || 0;
    const daysInactive = daysSince(entry.lastActivity);
    return {
      dealerId: entry.dealerId,
      dealer: entry.dealer,
      dealerName: entry.dealerName,
      approvedSales: entry.approvedSales,
      approvedOrders: entry.approvedOrders,
      submittedOrders: entry.submittedOrders,
      rejectedOrders: entry.rejectedOrders,
      averageOrderValue: entry.approvedOrders ? entry.approvedSales / entry.approvedOrders : 0,
      largestOrder: entry.largestOrder,
      lastActivity: entry.lastActivity,
      routingMode: entry.routingMode,
      assignedDispatcher: entry.assignedDispatcher,
      growthRate: growth(entry.approvedSales, previousRevenue),
      activityState: activityState(entry.lastActivity, entry.approvedOrders),
      healthScore: healthScore({
        revenue: entry.approvedSales,
        approvedOrders: entry.approvedOrders,
        largestOrder: entry.largestOrder,
        daysInactive,
        growthRate: growth(entry.approvedSales, previousRevenue),
      }),
      topProduct:
        Array.from(entry.productRevenue.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "None",
      topCategory:
        Array.from(entry.categoryRevenue.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "None",
    };
  });

  const revenueBands = [
    { label: "1M+", count: rows.filter((row) => row.approvedSales >= 1000000).length },
    { label: "500K-1M", count: rows.filter((row) => row.approvedSales >= 500000 && row.approvedSales < 1000000).length },
    { label: "150K-500K", count: rows.filter((row) => row.approvedSales >= 150000 && row.approvedSales < 500000).length },
    { label: "<150K", count: rows.filter((row) => row.approvedSales > 0 && row.approvedSales < 150000).length },
    { label: "No approved sales", count: rows.filter((row) => !row.approvedSales).length },
  ];

  const active = rows.filter((row) => row.activityState === "ACTIVE").length;
  const slow = rows.filter((row) => row.activityState === "SLOW").length;
  const dormant = rows.filter((row) => row.activityState === "DORMANT").length;
  const topFiveRevenue = top(rows, "approvedSales", 5).reduce((sum, row) => sum + row.approvedSales, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.approvedSales, 0);

  return {
    rows: rows.sort((a, b) => b.approvedSales - a.approvedSales),
    leadership: {
      topBySales: top(rows, "approvedSales", 8),
      topByOrderCount: top(rows, "approvedOrders", 8),
      topByAverageOrderValue: top(rows, "averageOrderValue", 8),
      topByLargestOrder: top(rows, "largestOrder", 8),
      topByGrowth: top(rows, "growthRate", 8),
      mostDormant: [...rows]
        .filter((row) => row.activityState === "DORMANT")
        .sort((a, b) => new Date(a.lastActivity || 0).getTime() - new Date(b.lastActivity || 0).getTime())
        .slice(0, 8),
    },
    segmentation: {
      activity: [
        { label: "Active", count: active },
        { label: "Slow", count: slow },
        { label: "Dormant", count: dormant },
      ],
      revenueBands,
      maturity: [
        { label: "New", count: rows.filter((row) => row.approvedOrders <= 1).length },
        { label: "Developing", count: rows.filter((row) => row.approvedOrders > 1 && row.approvedOrders < 6).length },
        { label: "Mature", count: rows.filter((row) => row.approvedOrders >= 6).length },
      ],
    },
    signals: {
      topFiveRevenueShare: percentage(topFiveRevenue, totalRevenue),
      highFrequencyLowValue: rows
        .filter((row) => row.approvedOrders >= 5 && row.averageOrderValue < 50000)
        .slice(0, 8),
      premiumLowFrequency: rows
        .filter((row) => row.approvedOrders > 0 && row.approvedOrders <= 2 && row.averageOrderValue >= 150000)
        .slice(0, 8),
      decliningDealers: [...rows].filter((row) => row.growthRate < -20).slice(0, 8),
      upsellCandidates: [...rows]
        .filter((row) => row.healthScore >= 70 && row.topCategory !== "None")
        .slice(0, 8),
    },
  };
}

function summarizeProducts({ approvedOrders, previousApprovedOrders }) {
  const previousProductRevenue = new Map();
  for (const order of previousApprovedOrders) {
    for (const item of order.items || []) {
      const key = itemKey(item);
      previousProductRevenue.set(key, (previousProductRevenue.get(key) || 0) + numberValue(item.lineTotal));
    }
  }

  const products = new Map();
  const categories = new Map();
  for (const order of approvedOrders) {
    const dealerName = order?.dealerSnapshot?.companyName || getDealerName(order.dealerId);
    const seenProducts = new Set();
    const seenCategories = new Set();

    for (const item of order.items || []) {
      const key = itemKey(item);
      const category = itemCategory(item);
      const revenue = numberValue(item.lineTotal);
      const quantity = numberValue(item.quantity);

      const product = products.get(key) || {
        productKey: key,
        product: itemName(item),
        sku: normalize(item.sku || item.code || ""),
        category,
        quantitySold: 0,
        revenue: 0,
        orderCount: 0,
        lastOrdered: null,
        dealerRevenue: new Map(),
        growthRate: 0,
      };

      product.quantitySold += quantity;
      product.revenue += revenue;
      product.lastOrdered =
        !product.lastOrdered ||
        new Date(order.createdAt).getTime() > new Date(product.lastOrdered).getTime()
          ? order.createdAt
          : product.lastOrdered;
      product.dealerRevenue.set(dealerName, (product.dealerRevenue.get(dealerName) || 0) + revenue);
      products.set(key, product);
      seenProducts.add(key);

      const cat = categories.get(category) || {
        category,
        revenue: 0,
        quantity: 0,
        orderCount: 0,
        factoryRevenue: 0,
        dispatcherRevenue: 0,
      };
      cat.revenue += revenue;
      cat.quantity += quantity;
      if (getRoute(order) === "FACTORY") cat.factoryRevenue += revenue;
      else cat.dispatcherRevenue += revenue;
      categories.set(category, cat);
      seenCategories.add(category);
    }

    for (const key of seenProducts) {
      const product = products.get(key);
      if (product) product.orderCount += 1;
    }
    for (const category of seenCategories) {
      const cat = categories.get(category);
      if (cat) cat.orderCount += 1;
    }
  }

  const productRows = Array.from(products.values()).map((product) => {
    const topDealer = Array.from(product.dealerRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      productKey: product.productKey,
      product: product.product,
      sku: product.sku,
      category: product.category,
      quantitySold: product.quantitySold,
      revenue: product.revenue,
      orderCount: product.orderCount,
      lastOrdered: product.lastOrdered,
      topDealer: topDealer?.[0] || "None",
      topDealerRevenue: topDealer?.[1] || 0,
      growthRate: growth(product.revenue, previousProductRevenue.get(product.productKey) || 0),
      concentrationShare: percentage(topDealer?.[1] || 0, product.revenue),
    };
  });

  const categoryRows = Array.from(categories.values()).sort((a, b) => b.revenue - a.revenue);
  const slowMoving = [...productRows]
    .filter((row) => row.revenue > 0)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 8);

  return {
    summary: {
      uniqueProductsOrdered: productRows.length,
      topProductByRevenue: top(productRows, "revenue", 1)[0] || null,
      topProductByQuantity: top(productRows, "quantitySold", 1)[0] || null,
      highestGrowthProduct: top(productRows, "growthRate", 1)[0] || null,
      slowMovingProduct: slowMoving[0] || null,
    },
    ranking: productRows.sort((a, b) => b.revenue - a.revenue),
    categoryMix: categoryRows,
    charts: {
      topProductsByRevenue: top(productRows, "revenue", 10),
      topProductsByQuantity: top(productRows, "quantitySold", 10),
      categoryRevenue: categoryRows.slice(0, 10),
      categoryQuantity: [...categoryRows].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    },
    slowMoving,
    concentratedProducts: [...productRows]
      .filter((row) => row.concentrationShare >= 70 && row.revenue > 0)
      .slice(0, 8),
  };
}

function summarizeDispatchers({ dispatchers, dealers, orders }) {
  const stats = new Map();
  for (const dispatcher of dispatchers) {
    const id = idOf(dispatcher);
    stats.set(id, {
      dispatcherId: id,
      dispatcher,
      dispatcherName: getDispatcherName(dispatcher),
      assignedDealerCount: dealers.filter((dealer) => idOf(dealer.dispatcherId) === id).length,
      approvedRevenue: 0,
      routedOrders: 0,
      allRoutedOrders: 0,
      rejectedOrders: 0,
      submittedOrders: 0,
      largestOrder: 0,
      lastActivity: null,
      dealerRevenue: new Map(),
    });
  }

  for (const order of orders.filter((item) => getRoute(item) === "DISPATCHER")) {
    const dispatcherId = idOf(order.dispatcherId);
    if (!dispatcherId) continue;
    const dispatcher = getDispatcherForOrder(order, new Map(dispatchers.map((item) => [idOf(item), item])));
    const entry =
      stats.get(dispatcherId) ||
      addMapValue(stats, dispatcherId, {
        dispatcherId,
        dispatcher,
        dispatcherName: getDispatcherName(dispatcher),
        assignedDealerCount: 0,
        approvedRevenue: 0,
        routedOrders: 0,
        allRoutedOrders: 0,
        rejectedOrders: 0,
        submittedOrders: 0,
        largestOrder: 0,
        lastActivity: null,
        dealerRevenue: new Map(),
      });

    entry.allRoutedOrders += 1;
    if (order.status === "SUBMITTED") entry.submittedOrders += 1;
    if (order.status === "REJECTED") entry.rejectedOrders += 1;
    if (order.status === APPROVED_STATUS) {
      const total = getOrderTotal(order);
      const dealerName = order?.dealerSnapshot?.companyName || getDealerName(order.dealerId);
      entry.approvedRevenue += total;
      entry.routedOrders += 1;
      entry.largestOrder = Math.max(entry.largestOrder, total);
      entry.lastActivity =
        !entry.lastActivity ||
        new Date(order.createdAt).getTime() > new Date(entry.lastActivity).getTime()
          ? order.createdAt
          : entry.lastActivity;
      entry.dealerRevenue.set(dealerName, (entry.dealerRevenue.get(dealerName) || 0) + total);
    }
  }

  const rows = Array.from(stats.values()).map((entry) => {
    const bestDealer = Array.from(entry.dealerRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      dispatcherId: entry.dispatcherId,
      dispatcher: entry.dispatcher,
      dispatcherName: entry.dispatcherName,
      assignedDealerCount: entry.assignedDealerCount,
      approvedRevenue: entry.approvedRevenue,
      routedOrders: entry.routedOrders,
      averageOrderValue: entry.routedOrders ? entry.approvedRevenue / entry.routedOrders : 0,
      approvalRate: percentage(entry.routedOrders, entry.allRoutedOrders),
      submittedOrders: entry.submittedOrders,
      rejectedOrders: entry.rejectedOrders,
      lastActivity: entry.lastActivity,
      largestOrder: entry.largestOrder,
      bestDealer: bestDealer?.[0] || "None",
      bestDealerRevenue: bestDealer?.[1] || 0,
      isActive: entry.dispatcher?.isActive !== false,
      status: entry.dispatcher?.status || "UNKNOWN",
    };
  });

  return {
    summary: {
      dispatcherApprovedRevenue: rows.reduce((sum, row) => sum + row.approvedRevenue, 0),
      dispatcherRoutedOrders: rows.reduce((sum, row) => sum + row.routedOrders, 0),
      averageRoutedOrderValue: rows.reduce((sum, row) => sum + row.approvedRevenue, 0) /
        Math.max(1, rows.reduce((sum, row) => sum + row.routedOrders, 0)),
      topDispatcherByRevenue: top(rows, "approvedRevenue", 1)[0] || null,
      topDispatcherByOrderCount: top(rows, "routedOrders", 1)[0] || null,
      lowestActivityDispatcher: [...rows]
        .filter((row) => row.status === DISPATCHER_STATUS.VERIFIED)
        .sort((a, b) => a.routedOrders - b.routedOrders)[0] || null,
    },
    rows: rows.sort((a, b) => b.approvedRevenue - a.approvedRevenue),
    charts: {
      revenueByDispatcher: top(rows, "approvedRevenue", 10),
      ordersByDispatcher: top(rows, "routedOrders", 10),
      approvalRateByDispatcher: top(rows, "approvalRate", 10),
      averageOrderValueByDispatcher: top(rows, "averageOrderValue", 10),
    },
    network: rows.map((row) => ({
      dispatcherId: row.dispatcherId,
      dispatcherName: row.dispatcherName,
      assignedDealerCount: row.assignedDealerCount,
      bestDealer: row.bestDealer,
      bestDealerRevenue: row.bestDealerRevenue,
      dealerRevenueUnderLane: row.approvedRevenue,
    })),
  };
}

function summarizeRouting({ orders, approvedOrders, trend, dealerRows, dispatcherRows }) {
  const factoryOrders = orders.filter((order) => getRoute(order) === "FACTORY");
  const dispatcherOrders = orders.filter((order) => getRoute(order) === "DISPATCHER");
  const factoryApproved = approvedOrders.filter((order) => getRoute(order) === "FACTORY");
  const dispatcherApproved = approvedOrders.filter((order) => getRoute(order) === "DISPATCHER");
  const factoryRevenue = factoryApproved.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const dispatcherRevenue = dispatcherApproved.reduce((sum, order) => sum + getOrderTotal(order), 0);

  return {
    summary: {
      factoryApprovedRevenue: factoryRevenue,
      dispatcherApprovedRevenue: dispatcherRevenue,
      factoryOrderCount: factoryApproved.length,
      dispatcherOrderCount: dispatcherApproved.length,
      factoryAverageOrderValue: factoryApproved.length ? factoryRevenue / factoryApproved.length : 0,
      dispatcherAverageOrderValue: dispatcherApproved.length ? dispatcherRevenue / dispatcherApproved.length : 0,
      factoryApprovalRate: percentage(factoryApproved.length, factoryOrders.length),
      dispatcherApprovalRate: percentage(dispatcherApproved.length, dispatcherOrders.length),
      factoryRevenueShare: percentage(factoryRevenue, factoryRevenue + dispatcherRevenue),
      dispatcherRevenueShare: percentage(dispatcherRevenue, factoryRevenue + dispatcherRevenue),
    },
    trend: trend.map((point) => ({
      label: point.label,
      factoryRevenue: point.factoryRevenue,
      dispatcherRevenue: point.dispatcherRevenue,
      factoryOrders: point.factoryOrders,
      dispatcherOrders: point.dispatcherOrders,
      orders: point.orders,
    })),
    efficiency: {
      higherValueRoute:
        (factoryApproved.length ? factoryRevenue / factoryApproved.length : 0) >=
        (dispatcherApproved.length ? dispatcherRevenue / dispatcherApproved.length : 0)
          ? "FACTORY"
          : "DISPATCHER",
      strongerApprovalRoute:
        percentage(factoryApproved.length, factoryOrders.length) >= percentage(dispatcherApproved.length, dispatcherOrders.length)
          ? "FACTORY"
          : "DISPATCHER",
      dispatcherLoadRisk: dispatcherRows.filter((row) => row.assignedDealerCount >= 5 && row.approvedRevenue < 100000),
    },
    byDealer: dealerRows.map((row) => ({
      dealerId: row.dealerId,
      dealerName: row.dealerName,
      route: row.routingMode,
      assignedDispatcher: row.assignedDispatcher,
      sales: row.approvedSales,
      orders: row.approvedOrders,
      lastActivity: row.lastActivity,
      suitability:
        row.routingMode === "DISPATCHER" && row.approvedSales < 50000
          ? "Needs lane development"
          : row.routingMode === "FACTORY" && row.averageOrderValue >= 200000
            ? "Factory lane fit"
            : "Stable",
    })),
  };
}

export async function getAdminInsights(filters = {}) {
  const range = resolveDateRange(filters);

  const [dealers, dispatchers, activityOrders] = await Promise.all([
    DealerProfile.find({})
      .populate({
        path: "dispatcherId",
        select: "name companyName email phone status isActive",
      })
      .lean(),
    Dispatcher.find({}).sort({ createdAt: -1 }).lean(),
    Order.find({ isDeleted: { $ne: true }, status: APPROVED_STATUS })
      .select("dealerId createdAt")
      .lean(),
  ]);

  const dealerActivityMap = new Map();
  for (const order of activityOrders) {
    const dealerId = idOf(order.dealerId);
    const current = dealerActivityMap.get(dealerId) || {
      approvedOrderCount: 0,
      latestApprovedAt: null,
    };
    current.approvedOrderCount += 1;
    current.latestApprovedAt =
      !current.latestApprovedAt ||
      new Date(order.createdAt).getTime() > new Date(current.latestApprovedAt).getTime()
        ? order.createdAt
        : current.latestApprovedAt;
    dealerActivityMap.set(dealerId, current);
  }

  let dealerScopeIds = null;
  const dealerState = normalizeUpper(filters.dealerState);
  if (dealerState === "ACTIVE_ONLY" || dealerState === "DORMANT_ONLY") {
    dealerScopeIds = dealers
      .filter((dealer) => {
        const activity = dealerActivityMap.get(idOf(dealer)) || {};
        const state = activityState(activity.latestApprovedAt, activity.approvedOrderCount || 0);
        return dealerState === "ACTIVE_ONLY" ? state === "ACTIVE" : state === "DORMANT";
      })
      .map((dealer) => dealer._id);
  }

  const currentQuery = buildOrderQuery({ filters, range, dealerScopeIds });
  const previousQuery = range.isAllTime
    ? null
    : {
        ...currentQuery,
        createdAt: { $gte: range.previousStart, $lte: range.previousEnd },
      };

  const [orders, previousOrders] = await Promise.all([
    Order.find(currentQuery)
      .sort({ createdAt: -1 })
      .populate({
        path: "dealerId",
        select: "companyName contactName email phone status fulfillmentMode dispatcherId createdAt",
        populate: {
          path: "dispatcherId",
          select: "name companyName email phone status isActive",
        },
      })
      .populate({
        path: "dispatcherId",
        select: "name companyName email phone status isActive",
      })
      .lean(),
    previousQuery
      ? Order.find(previousQuery)
          .sort({ createdAt: -1 })
          .populate({ path: "dealerId", select: "companyName contactName email phone status fulfillmentMode dispatcherId" })
          .populate({ path: "dispatcherId", select: "name companyName email phone status isActive" })
          .lean()
      : Promise.resolve([]),
  ]);

  const dealerMap = new Map(dealers.map((dealer) => [idOf(dealer), dealer]));
  const dispatcherMap = new Map(dispatchers.map((dispatcher) => [idOf(dispatcher), dispatcher]));
  const approvedOrders = orders.filter((order) => order.status === APPROVED_STATUS);
  const previousApprovedOrders = previousOrders.filter((order) => order.status === APPROVED_STATUS);
  const currency = getCurrency(orders);
  const approvedRevenue = approvedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const previousApprovedRevenue = previousApprovedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const approvedTotals = approvedOrders.map(getOrderTotal);
  const trend = buildTrend(orders, range);
  const dealerSummary = summarizeDealers({
    dealers,
    orders,
    previousOrders,
    dealerActivityMap,
  });
  const productSummary = summarizeProducts({ approvedOrders, previousApprovedOrders });
  const dispatcherSummary = summarizeDispatchers({ dispatchers, dealers, orders });
  const routingSummary = summarizeRouting({
    orders,
    approvedOrders,
    trend,
    dealerRows: dealerSummary.rows,
    dispatcherRows: dispatcherSummary.rows,
  });

  const largestOrder = approvedOrders
    .map((order) => ({
      orderId: idOf(order),
      orderNumber: order.orderNumber,
      total: getOrderTotal(order),
      createdAt: order.createdAt,
      dealerName: getDealerName(getDealerForOrder(order, dealerMap)),
      route: getRoute(order),
      dispatcherName:
        getRoute(order) === "DISPATCHER"
          ? getDispatcherName(getDispatcherForOrder(order, dispatcherMap))
          : "Factory",
    }))
    .sort((a, b) => b.total - a.total)[0] || null;

  const ordersSummary = {
    totalOrders: orders.length,
    approvedOrders: approvedOrders.length,
    submittedOrders: orders.filter((order) => order.status === "SUBMITTED").length,
    rejectedOrders: orders.filter((order) => order.status === "REJECTED").length,
    archivedOrders: orders.filter((order) => order.archivedAt).length,
    totalApprovedRevenue: approvedRevenue,
    averageOrderValue: approvedOrders.length ? approvedRevenue / approvedOrders.length : 0,
    medianOrderValue: median(approvedTotals),
    largestOrder: largestOrder?.total || 0,
    smallestOrder: approvedTotals.length ? Math.min(...approvedTotals) : 0,
    approvalRate: percentage(approvedOrders.length, orders.length),
    rejectionRate: percentage(orders.filter((order) => order.status === "REJECTED").length, orders.length),
  };

  const orderRankings = {
    largestOrders: approvedOrders
      .map((order) => ({
        orderId: idOf(order),
        orderNumber: order.orderNumber,
        total: getOrderTotal(order),
        createdAt: order.createdAt,
        dealerName: getDealerName(getDealerForOrder(order, dealerMap)),
        route: getRoute(order),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    recentHighValueOrders: approvedOrders
      .filter((order) => getOrderTotal(order) >= (ordersSummary.averageOrderValue || 0))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((order) => ({
        orderId: idOf(order),
        orderNumber: order.orderNumber,
        total: getOrderTotal(order),
        createdAt: order.createdAt,
        dealerName: getDealerName(getDealerForOrder(order, dealerMap)),
        route: getRoute(order),
      })),
    dealersByAverageOrderValue: top(dealerSummary.rows, "averageOrderValue", 10),
    dealersByFrequency: top(dealerSummary.rows, "approvedOrders", 10),
  };

  const signals = [];
  pushSignal(
    signals,
    "Revenue movement",
    range.isAllTime
      ? "All verified history is included in the current insight view."
      : `${growth(approvedRevenue, previousApprovedRevenue).toFixed(1)}% versus the previous comparable period.`,
    growth(approvedRevenue, previousApprovedRevenue) >= 0 ? "positive" : "risk",
  );
  pushSignal(
    signals,
    "Dominant route",
    routingSummary.summary.factoryApprovedRevenue >= routingSummary.summary.dispatcherApprovedRevenue
      ? "Factory routing is currently carrying the larger approved revenue lane."
      : "Dispatcher routing is currently carrying the larger approved revenue lane.",
  );
  pushSignal(
    signals,
    "Strongest dealer",
    dealerSummary.leadership.topBySales[0]
      ? `${dealerSummary.leadership.topBySales[0].dealerName} leads approved sales for this filter.`
      : "No dealer sales signal is available for the selected filters.",
  );
  pushSignal(
    signals,
    "Product concentration",
    productSummary.concentratedProducts[0]
      ? `${productSummary.concentratedProducts[0].product} is highly concentrated in one dealer relationship.`
      : "No major product concentration risk detected in the selected period.",
    productSummary.concentratedProducts[0] ? "watch" : "positive",
  );
  pushSignal(
    signals,
    "Dormancy",
    `${dealerSummary.segmentation.activity.find((item) => item.label === "Dormant")?.count || 0} dealers currently read as dormant.`,
    "watch",
  );

  return {
    filters: {
      range: range.isAllTime ? "all" : filters.range || filters.preset || "custom",
      from: range.isAllTime ? "" : range.start.toISOString(),
      to: range.isAllTime ? "" : range.end.toISOString(),
      status: filters.status || "APPROVED",
      routing: filters.routing || "ALL",
      dispatcherId: filters.dispatcherId || "",
      dealerId: filters.dealerId || "",
      dealerState: filters.dealerState || "ALL",
      category: filters.category || "ALL",
    },
    meta: {
      generatedAt: new Date().toISOString(),
      currency,
      orderCount: orders.length,
      dealerCount: dealers.length,
      dispatcherCount: dispatchers.length,
    },
    options: {
      dealers: dealers.map((dealer) => ({
        id: idOf(dealer),
        label: getDealerName(dealer),
        fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
      })),
      dispatchers: dispatchers
        .filter((dispatcher) => dispatcher.status === DISPATCHER_STATUS.VERIFIED)
        .map((dispatcher) => ({
          id: idOf(dispatcher),
          label: getDispatcherName(dispatcher),
        })),
      categories: Array.from(
        new Set(
          approvedOrders.flatMap((order) =>
            (order.items || []).map((item) => itemCategory(item)),
          ),
        ),
      ).sort(),
    },
    home: {
      kpis: {
        approvedRevenue,
        approvedOrders: approvedOrders.length,
        averageOrderValue: ordersSummary.averageOrderValue,
        activeDealers: dealerSummary.segmentation.activity.find((item) => item.label === "Active")?.count || 0,
        factoryRevenueShare: routingSummary.summary.factoryRevenueShare,
        dispatcherRevenueShare: routingSummary.summary.dispatcherRevenueShare,
        largestOrder,
        revenueGrowth: growth(approvedRevenue, previousApprovedRevenue),
      },
      pulse: trend,
      signals,
      routingSnapshot: routingSummary.summary,
      dealerSnapshot: {
        topDealer: dealerSummary.leadership.topBySales[0] || null,
        atRiskDealers: dealerSummary.signals.decliningDealers.length,
        topFiveRevenueShare: dealerSummary.signals.topFiveRevenueShare,
      },
    },
    orders: {
      summary: ordersSummary,
      trend,
      distribution: buildDistribution(approvedOrders),
      rankings: orderRankings,
      notes: [
        routingSummary.summary.factoryAverageOrderValue >= routingSummary.summary.dispatcherAverageOrderValue
          ? "Factory-routed approved orders currently carry the higher average value."
          : "Dispatcher-routed approved orders currently carry the higher average value.",
        ordersSummary.approvalRate >= 70
          ? "Approval throughput is healthy for the selected filter."
          : "Approval throughput is below the target band for the selected filter.",
        trend.length >= 2 && trend[trend.length - 1].orders < trend[0].orders
          ? "Order count is lower at the end of the period than the beginning."
          : "Order count is stable or improving across the selected period.",
      ],
    },
    dealers: dealerSummary,
    products: productSummary,
    dispatchers: dispatcherSummary,
    routing: {
      ...routingSummary,
      notes: [
        routingSummary.summary.factoryRevenueShare >= 60
          ? "Factory routing still dominates approved revenue."
          : "Dispatcher routing is materially contributing to approved revenue.",
        routingSummary.efficiency.higherValueRoute === "FACTORY"
          ? "Factory route is handling higher average-value orders."
          : "Dispatcher route is handling higher average-value orders.",
        dispatcherSummary.summary.lowestActivityDispatcher
          ? `${dispatcherSummary.summary.lowestActivityDispatcher.dispatcherName} is the lowest activity verified dispatcher lane.`
          : "No verified dispatcher lane risk detected.",
      ],
    },
    reports: {
      reportTypes: [
        "Executive Sales Summary",
        "Dealer Ranking Report",
        "Product Performance Report",
        "Routing Performance Report",
        "Dispatcher Performance Report",
        "Dormant Dealer Report",
      ],
      filterSummary: {
        period: `${range.start.toISOString().slice(0, 10)} to ${range.end.toISOString().slice(0, 10)}`,
        status: filters.status || "APPROVED",
        routing: filters.routing || "ALL",
        dealer:
          filters.dealerId && dealerMap.get(String(filters.dealerId))
            ? getDealerName(dealerMap.get(String(filters.dealerId)))
            : "All dealers",
        category: filters.category || "All categories",
      },
    },
  };
}
