import mongoose from "mongoose";

import ApiError from "../utils/apiError.js";
import Dispatcher from "../models/Dispatcher.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Order, { ORDER_ORIGIN, ORDER_STATUS } from "../models/Order.model.js";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";

const DAY_MS = 86400000;

// Statuses that represent a replenishment order the dispatcher actually
// went through with (as opposed to still-pending, rejected, or cancelled).
const COUNTED_REPLENISHMENT_STATUSES = new Set([
  ORDER_STATUS.VERIFIED,
  ORDER_STATUS.DISPATCHED,
  ORDER_STATUS.COMPLETED,
]);

function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function daysSince(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

function growthRate(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function getDispatcherAnalytics({ dispatcherId } = {}) {
  const objectId = toObjectId(dispatcherId);
  if (!objectId) throw new ApiError(400, "Missing or invalid dispatcherId");

  const dispatcher = await Dispatcher.findById(objectId)
    .select("_id name companyName createdAt")
    .lean();
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

  const [replenishmentOrders, assignedDealers, stockRows] = await Promise.all([
    Order.find({
      dispatcherCustomerId: objectId,
      orderOrigin: ORDER_ORIGIN.DISPATCHER_REPLENISHMENT,
      isDeleted: { $ne: true },
    })
      .select("status totals createdAt")
      .lean(),
    DealerProfile.find({ dispatcherId: objectId, fulfillmentMode: "DISPATCHER" })
      .select("_id companyName status")
      .lean(),
    DispatcherProductStock.find({ dispatcherId: objectId })
      .populate({ path: "productId", select: "stock.lowStockThreshold" })
      .lean(),
  ]);

  // ---- Replenishment behavior (dispatcher as a "customer" of the Factory) ----
  const countedOrders = replenishmentOrders.filter((order) =>
    COUNTED_REPLENISHMENT_STATUSES.has(order.status),
  );
  const rejectedOrders = replenishmentOrders.filter(
    (order) => order.status === ORDER_STATUS.REJECTED,
  );
  const totalReplenishmentSpend = countedOrders.reduce(
    (sum, order) => sum + numberValue(order?.totals?.total),
    0,
  );
  const lastReplenishmentAt = countedOrders.reduce((latest, order) => {
    const created = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    return created > latest ? created : latest;
  }, 0);

  const now = Date.now();
  const recent30 = countedOrders.filter(
    (order) => now - new Date(order.createdAt).getTime() <= 30 * DAY_MS,
  );
  const previous30 = countedOrders.filter((order) => {
    const age = now - new Date(order.createdAt).getTime();
    return age > 30 * DAY_MS && age <= 60 * DAY_MS;
  });
  const recent30Revenue = recent30.reduce(
    (sum, order) => sum + numberValue(order?.totals?.total),
    0,
  );
  const previous30Revenue = previous30.reduce(
    (sum, order) => sum + numberValue(order?.totals?.total),
    0,
  );

  const replenishment = {
    totalOrders: countedOrders.length,
    rejectedOrders: rejectedOrders.length,
    totalSpend: totalReplenishmentSpend,
    lastReplenishmentAt: lastReplenishmentAt ? new Date(lastReplenishmentAt) : null,
    daysSinceLastReplenishment: lastReplenishmentAt
      ? daysSince(new Date(lastReplenishmentAt))
      : null,
    recent30DayOrders: recent30.length,
    recent30DayRevenue: recent30Revenue,
    revenueGrowth30d: growthRate(recent30Revenue, previous30Revenue),
  };

  // ---- Assigned dealer network health ----
  const dealerIds = assignedDealers.map((dealer) => dealer._id);
  const dealerActivity = dealerIds.length
    ? await Order.aggregate([
        {
          $match: {
            dealerId: { $in: dealerIds },
            dispatcherId: objectId,
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

  let activeDealerCount = 0;
  let quietDealerCount = 0;
  let networkSales = 0;
  let networkRejected = 0;
  let networkTotal = 0;

  assignedDealers.forEach((dealer) => {
    const activity = activityMap.get(String(dealer._id));
    networkSales += numberValue(activity?.totalVerifiedSales);
    networkRejected += numberValue(activity?.rejectedOrders);
    networkTotal += numberValue(activity?.totalOrders);

    const inactiveDays = activity?.lastOrderAt
      ? daysSince(activity.lastOrderAt)
      : null;
    if (inactiveDays != null && inactiveDays <= 45) {
      activeDealerCount += 1;
    } else {
      quietDealerCount += 1;
    }
  });

  const network = {
    assignedDealerCount: assignedDealers.length,
    activeDealerCount,
    quietDealerCount,
    totalNetworkSales: networkSales,
    networkRejectionRate:
      networkTotal > 0 ? (networkRejected / networkTotal) * 100 : 0,
  };

  // ---- Stock posture ----
  const stockRowsWithProduct = stockRows.filter((row) => row.productId);
  const lowStockSkus = stockRowsWithProduct.filter((row) => {
    const threshold = numberValue(row.productId?.stock?.lowStockThreshold);
    return threshold > 0 && numberValue(row.currentQuantity) <= threshold;
  });
  const zeroStockSkus = stockRowsWithProduct.filter(
    (row) => numberValue(row.currentQuantity) <= 0,
  );

  const stock = {
    totalSkusHeld: stockRowsWithProduct.length,
    totalUnitsOnHand: stockRowsWithProduct.reduce(
      (sum, row) => sum + numberValue(row.currentQuantity),
      0,
    ),
    lowStockSkuCount: lowStockSkus.length,
    zeroStockSkuCount: zeroStockSkus.length,
  };

  // ---- Composite health score (0-100) ----
  // Weighted blend: replenishment recency/consistency (30), network sales
  // health (35), rejection rate (20 - inverted), stock adequacy (15 - inverted).
  const recencyScore =
    replenishment.daysSinceLastReplenishment == null
      ? 20
      : replenishment.daysSinceLastReplenishment <= 30
        ? 100
        : replenishment.daysSinceLastReplenishment <= 60
          ? 60
          : 20;

  const networkScore =
    network.assignedDealerCount === 0
      ? 40
      : (network.activeDealerCount / network.assignedDealerCount) * 100;

  const rejectionScore = Math.max(0, 100 - network.networkRejectionRate * 2);

  const stockScore =
    stock.totalSkusHeld === 0
      ? 50
      : Math.max(
          0,
          100 - (stock.zeroStockSkuCount / Math.max(1, stock.totalSkusHeld)) * 100,
        );

  const businessHealthScore = clampScore(
    recencyScore * 0.3 +
      networkScore * 0.35 +
      rejectionScore * 0.2 +
      stockScore * 0.15,
  );

  const riskFlags = [];
  const opportunityTags = [];
  const recommendations = [];

  if (replenishment.daysSinceLastReplenishment != null && replenishment.daysSinceLastReplenishment > 45) {
    riskFlags.push(
      `No replenishment order in ${replenishment.daysSinceLastReplenishment} days.`,
    );
  }
  if (network.networkRejectionRate > 20) {
    riskFlags.push(
      `${network.networkRejectionRate.toFixed(1)}% of assigned dealer orders are being rejected.`,
    );
  }
  if (stock.zeroStockSkuCount > 0) {
    riskFlags.push(
      `${stock.zeroStockSkuCount} SKU${stock.zeroStockSkuCount === 1 ? "" : "s"} currently out of stock.`,
    );
  }
  if (network.quietDealerCount > 0) {
    riskFlags.push(
      `${network.quietDealerCount} assigned dealer${network.quietDealerCount === 1 ? "" : "s"} with no recent order activity.`,
    );
  }

  if (replenishment.revenueGrowth30d > 15) {
    opportunityTags.push(
      `Replenishment spend up ${replenishment.revenueGrowth30d.toFixed(1)}% over the last 30 days.`,
    );
  }
  if (network.activeDealerCount === network.assignedDealerCount && network.assignedDealerCount > 0) {
    opportunityTags.push("Entire assigned dealer network is active.");
  }

  if (stock.lowStockSkuCount > 0 && stock.zeroStockSkuCount === 0) {
    recommendations.push(
      `${stock.lowStockSkuCount} SKU${stock.lowStockSkuCount === 1 ? "" : "s"} approaching low stock — consider a replenishment order soon.`,
    );
  }
  if (!riskFlags.length && !opportunityTags.length && !recommendations.length) {
    recommendations.push("No material risk or opportunity flags yet.");
  }

  return {
    dispatcherId: String(dispatcher._id),
    replenishment,
    network,
    stock,
    commercial: {
      businessHealthScore,
      riskFlags,
      opportunityTags,
      recommendations,
    },
  };
}
