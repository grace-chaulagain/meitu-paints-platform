import mongoose from "mongoose";
import Sale, { SALE_STATUS } from "../models/Sale.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Counter from "../models/Counter.model.js";
import ApiError from "../utils/apiError.js";
import { recordSaleMovements, reverseSaleMovements, getLastKnownUnitCosts } from "./dealerInventory.service.js";

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;
const TREND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

// Same formula already duplicated in adminInsights.service.js and
// dealerAnalytics.service.js for their own growth-rate fields - kept as its
// own local copy here rather than a shared extraction, matching how the
// other two already coexist independently.
function growth(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function trendDirection(percent) {
  if (percent > 0) return "up";
  if (percent < 0) return "down";
  return "flat";
}

function trendField(currentValue, previousValue) {
  const percent = growth(currentValue, previousValue);
  return { percent, direction: trendDirection(percent) };
}

async function generateSaleNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: "sale" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `MS-${year}-${String(counter.seq).padStart(6, "0")}`;
}

// Validates shape/quantity only - price is never trusted from the client
// (see resolveItemPrices below), so there's nothing to read or validate
// here beyond "does this look like a real line item".
function normalizeItemShapes(rawItems = []) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "At least one sale item is required");
  }

  return rawItems.map((item) => {
    const quantity = Number(item?.quantity || 0);
    if (!item?.productId) throw new ApiError(400, "Each sale item requires a productId");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Invalid quantity for ${item?.name || "item"}`);
    }

    return {
      productId: item.productId,
      sku: String(item.sku || "").trim(),
      name: String(item.name || "").trim() || "Product",
      packLabel: String(item.packLabel || "").trim(),
      quantity,
    };
  });
}

// Dealers don't set their own resale price anywhere in this system - the
// only defensible per-product price is what the dealer last paid to
// acquire it (DealerProductStock.lastKnownUnitCost). Resolved inside the
// caller's transaction so it reads the same consistent snapshot as the
// stock debit. Throws rather than silently recording a $0 line if a
// product has never had a cost recorded, since that would corrupt revenue
// reporting invisibly.
async function resolveItemPrices({ dealerId, items, session }) {
  const costByProduct = await getLastKnownUnitCosts({
    dealerId,
    productIds: items.map((item) => item.productId),
    session,
  });

  return items.map((item) => {
    const unitPrice = costByProduct.get(String(item.productId));
    if (unitPrice === undefined || unitPrice === null) {
      throw new ApiError(400, `No purchase cost on file for ${item.name} - record a purchase for this product before selling it.`);
    }

    return {
      ...item,
      unitPrice,
      lineTotal: Math.round(item.quantity * unitPrice * 100) / 100,
    };
  });
}

export async function createSale({
  dealerId,
  billId,
  projectId = null,
  items,
  payment = {},
  notes = "",
  actorUser,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!String(billId || "").trim()) throw new ApiError(400, "billId is required");

  const itemShapes = normalizeItemShapes(items);

  const session = await mongoose.startSession();
  let sale;
  try {
    await session.withTransaction(async () => {
      const dealer = await DealerProfile.findById(dealerId).select("_id").session(session);
      if (!dealer) throw new ApiError(404, "Dealer not found");

      const saleNumber = await generateSaleNumber();
      const saleId = new mongoose.Types.ObjectId();
      const saleDate = new Date();

      const normalizedItems = await resolveItemPrices({ dealerId, items: itemShapes, session });
      const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const total = Math.max(0, Math.round(subtotal * 100) / 100);

      // Oversell-guarded debit of dealer inventory - if any line item
      // exceeds available stock, this throws and the whole transaction
      // (including the Sale doc) rolls back.
      await recordSaleMovements({
        dealerId,
        items: normalizedItems,
        saleId,
        actorUser,
        actorRole: "DEALER",
        session,
      });

      const [created] = await Sale.create(
        [
          {
            _id: saleId,
            saleNumber,
            dealerId,
            billId: String(billId).trim(),
            projectId,
            items: normalizedItems,
            totals: { subtotal, discount: 0, total, currency: "NPR" },
            payment: {
              method: String(payment?.method || "").trim(),
              reference: String(payment?.reference || "").trim(),
              note: String(payment?.note || "").trim(),
            },
            notes: String(notes || "").trim(),
            status: SALE_STATUS.COMPLETED,
            saleDate,
            createdBy: actorId(actorUser),
          },
        ],
        { session },
      );

      sale = created.toObject();
    });
  } finally {
    session.endSession();
  }

  return sale;
}

export async function voidSale({ dealerId, saleId, reason, actorUser, actorRole = "DEALER" } = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!saleId) throw new ApiError(400, "saleId is required");
  if (!String(reason || "").trim()) throw new ApiError(400, "A void reason is required");

  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const sale = await Sale.findOne({ _id: saleId, dealerId }).session(session);
      if (!sale) throw new ApiError(404, "Sale not found");
      if (sale.status !== SALE_STATUS.COMPLETED) {
        throw new ApiError(400, "Only a completed sale can be voided");
      }

      // Admins can void any time (mirrors the codebase's "Admin can
      // override everything" posture); dealers only within the window.
      if (actorRole !== "ADMIN") {
        const ageMs = Date.now() - new Date(sale.saleDate).getTime();
        if (ageMs > VOID_WINDOW_MS) {
          throw new ApiError(400, "This sale is too old to void yourself. Ask an admin for help.");
        }
      }

      await reverseSaleMovements({
        dealerId,
        saleId: sale._id,
        actorUser,
        actorRole,
        session,
      });

      sale.status = SALE_STATUS.VOIDED;
      sale.voidedAt = new Date();
      sale.voidedBy = actorId(actorUser);
      sale.voidReason = String(reason).trim();
      await sale.save({ session });

      updated = sale.toObject();
    });
  } finally {
    session.endSession();
  }

  return updated;
}

export async function listSales({
  dealerId,
  q = "",
  status = "ALL",
  dateFrom = "",
  dateTo = "",
  page = 1,
  limit = 50,
} = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));

  const filter = { dealerId };
  if (status && status !== "ALL") filter.status = status;

  const query = String(q || "").trim();
  if (query) {
    const rx = { $regex: query, $options: "i" };
    filter.$or = [{ saleNumber: rx }, { billId: rx }];
  }

  if (dateFrom || dateTo) {
    filter.saleDate = {};
    if (dateFrom) filter.saleDate.$gte = new Date(dateFrom);
    if (dateTo) filter.saleDate.$lte = new Date(dateTo);
  }

  const aggregateMatch = {
    ...filter,
    dealerId: new mongoose.Types.ObjectId(String(dealerId)),
  };

  const [items, total, summaryAgg] = await Promise.all([
    Sale.find(filter)
      .sort({ saleDate: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    Sale.countDocuments(filter),
    // Computed over the full filtered set (not just the current page) via
    // aggregation, same convention as listAllSalesForAdmin - so the stat
    // cards stay accurate regardless of pagination/limit.
    Sale.aggregate([
      { $match: aggregateMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, "$totals.total", 0] } },
          totalCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, 1, 0] } },
          totalUnits: {
            $sum: {
              $cond: [
                { $eq: ["$status", SALE_STATUS.COMPLETED] },
                { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", "$$this.quantity"] } } },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const summaryRow = summaryAgg[0] || { totalRevenue: 0, totalCount: 0, totalUnits: 0 };

  return {
    items,
    summary: {
      totalRevenue: summaryRow.totalRevenue || 0,
      totalCount: summaryRow.totalCount || 0,
      totalUnits: summaryRow.totalUnits || 0,
      averageOrderValue: summaryRow.totalCount ? summaryRow.totalRevenue / summaryRow.totalCount : 0,
    },
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

export async function getSale({ dealerId, saleId } = {}) {
  if (!dealerId) throw new ApiError(400, "dealerId is required");
  if (!saleId) throw new ApiError(400, "saleId is required");

  const sale = await Sale.findOne({ _id: saleId, dealerId }).lean();
  if (!sale) throw new ApiError(404, "Sale not found");
  return sale;
}

// Fleet-wide (all dealers) sales list for Admin, optionally narrowed to
// one dealer. Totals are computed via aggregation over the full filtered
// set (not just the current page) so they stay accurate at scale instead
// of requiring every matching row to be pulled into memory.
export async function listAllSalesForAdmin({
  dealerId = "",
  q = "",
  status = "ALL",
  from = null,
  to = null,
  page = 1,
  limit = 50,
  dealerPage = 1,
  dealerLimit = 6,
} = {}) {
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 50)));
  const dealerPageNumber = Math.max(1, Number(dealerPage || 1));
  const dealerLimitNumber = Math.min(200, Math.max(1, Number(dealerLimit || 6)));

  const filter = {};
  if (dealerId) filter.dealerId = dealerId;
  if (status && status !== "ALL") filter.status = status;

  const query = String(q || "").trim();
  if (query) {
    const rx = { $regex: query, $options: "i" };
    filter.$or = [{ saleNumber: rx }, { billId: rx }];
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate || toDate) {
    filter.saleDate = {};
    if (fromDate) filter.saleDate.$gte = fromDate;
    if (toDate) filter.saleDate.$lte = toDate;
  }

  // The trend comparison always uses a fixed last-30-vs-prior-30-day window,
  // independent of whatever from/to date range the admin has applied - it's
  // a constant "recent momentum" indicator, not something the date filter
  // should be able to distort. It still respects dealerId/status/q so a
  // dealer- or status-scoped view shows that scope's own trend.
  const trendMatch = {
    ...filter,
    ...(filter.dealerId ? { dealerId: new mongoose.Types.ObjectId(String(filter.dealerId)) } : {}),
  };
  delete trendMatch.saleDate;
  const trendNow = new Date();
  const trendCurrentStart = new Date(trendNow.getTime() - TREND_WINDOW_MS);
  const trendPreviousStart = new Date(trendNow.getTime() - TREND_WINDOW_MS * 2);
  trendMatch.saleDate = { $gte: trendPreviousStart, $lte: trendNow };

  const aggregateMatch = {
    ...filter,
    ...(filter.dealerId ? { dealerId: new mongoose.Types.ObjectId(String(filter.dealerId)) } : {}),
  };

  const [items, total, summaryAgg, dealerSummaryAgg, trendAgg] = await Promise.all([
    Sale.find(filter)
      .sort({ saleDate: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "dealerId", select: "companyName contactName" })
      .lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([
      // aggregate() skips Mongoose's automatic string->ObjectId casting
      // that find()/countDocuments() apply, so dealerId is cast explicitly
      // here - otherwise $match silently matches nothing.
      { $match: aggregateMatch },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, 1, 0] } },
          voidedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.VOIDED] }, 1, 0] } },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, "$totals.total", 0] },
          },
        },
      },
    ]),
    Sale.aggregate([
      { $match: aggregateMatch },
      {
        $group: {
          _id: "$dealerId",
          totalCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, 1, 0] } },
          voidedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.VOIDED] }, 1, 0] } },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, "$totals.total", 0] },
          },
          latestSaleAt: { $max: "$saleDate" },
        },
      },
      { $sort: { totalRevenue: -1, latestSaleAt: -1 } },
      { $limit: 500 },
    ]),
    Sale.aggregate([
      { $match: trendMatch },
      {
        $group: {
          _id: { $cond: [{ $gte: ["$saleDate", trendCurrentStart] }, "current", "previous"] },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, 1, 0] } },
          voidedCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.VOIDED] }, 1, 0] } },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, "$totals.total", 0] },
          },
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || { totalCount: 0, completedCount: 0, voidedCount: 0, totalRevenue: 0 };

  const dealerTotal = dealerSummaryAgg.length;
  const dealerPages = Math.max(1, Math.ceil(dealerTotal / dealerLimitNumber));
  const pagedDealerSummaryAgg = dealerSummaryAgg.slice(
    (dealerPageNumber - 1) * dealerLimitNumber,
    dealerPageNumber * dealerLimitNumber,
  );
  const dealerIds = pagedDealerSummaryAgg.map((row) => row._id).filter(Boolean);
  const dealers = dealerIds.length
    ? await DealerProfile.find({ _id: { $in: dealerIds } })
        .select("companyName contactName email phone")
        .lean()
    : [];
  const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]));
  const dealerSummaries = pagedDealerSummaryAgg.map((row) => {
    const dealer = dealerById.get(String(row._id)) || null;
    return {
      dealerId: row._id,
      dealer,
      totalCount: row.totalCount || 0,
      completedCount: row.completedCount || 0,
      voidedCount: row.voidedCount || 0,
      totalRevenue: row.totalRevenue || 0,
      averageSaleValue: row.completedCount > 0 ? row.totalRevenue / row.completedCount : 0,
      latestSaleAt: row.latestSaleAt || null,
    };
  });

  const trendByPeriod = new Map(trendAgg.map((row) => [row._id, row]));
  const trendCurrent = trendByPeriod.get("current") || { completedCount: 0, voidedCount: 0, totalRevenue: 0 };
  const trendPrevious = trendByPeriod.get("previous") || { completedCount: 0, voidedCount: 0, totalRevenue: 0 };
  const trendCurrentAvg = trendCurrent.completedCount > 0 ? trendCurrent.totalRevenue / trendCurrent.completedCount : 0;
  const trendPreviousAvg = trendPrevious.completedCount > 0 ? trendPrevious.totalRevenue / trendPrevious.completedCount : 0;

  return {
    items,
    dealerSummaries,
    dealerPagination: {
      page: dealerPageNumber,
      limit: dealerLimitNumber,
      total: dealerTotal,
      pages: dealerPages,
    },
    summary: {
      totalCount: summary.totalCount,
      completedCount: summary.completedCount,
      voidedCount: summary.voidedCount,
      totalRevenue: summary.totalRevenue,
      averageSaleValue: summary.completedCount > 0 ? summary.totalRevenue / summary.completedCount : 0,
      trend: {
        completedCount: trendField(trendCurrent.completedCount, trendPrevious.completedCount),
        voidedCount: trendField(trendCurrent.voidedCount, trendPrevious.voidedCount),
        totalRevenue: trendField(trendCurrent.totalRevenue, trendPrevious.totalRevenue),
        averageSaleValue: trendField(trendCurrentAvg, trendPreviousAvg),
      },
    },
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}

export async function getSaleForAdmin({ saleId } = {}) {
  if (!saleId) throw new ApiError(400, "saleId is required");

  const sale = await Sale.findById(saleId)
    .populate({ path: "dealerId", select: "companyName contactName phone email" })
    .lean();
  if (!sale) throw new ApiError(404, "Sale not found");
  return sale;
}

// Powers the global Painter profile's "Sales" section - deliberately
// cross-dealer (no dealerId filter), since a painter can be sold to by many
// different dealers. Mirrors listSales' pagination + aggregate-summary
// shape, scoped by the denormalized Sale.painterId instead.
export async function listSalesForPainter(painterId, { page = 1, limit = 20, dealerId } = {}) {
  if (!painterId) throw new ApiError(400, "painterId is required");

  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(100, Math.max(1, Number(limit || 20)));

  const filter = { painterId };
  if (dealerId) filter.dealerId = dealerId;

  const aggregateMatch = { painterId: new mongoose.Types.ObjectId(String(painterId)) };
  if (dealerId) aggregateMatch.dealerId = new mongoose.Types.ObjectId(String(dealerId));

  const [items, total, summaryAgg, dealerIds] = await Promise.all([
    Sale.find(filter)
      .sort({ saleDate: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "dealerId", select: "companyName" })
      .lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: aggregateMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, "$totals.total", 0] } },
          totalCount: { $sum: { $cond: [{ $eq: ["$status", SALE_STATUS.COMPLETED] }, 1, 0] } },
        },
      },
    ]),
    // Always the full distinct set (ignores the dealerId filter) so the
    // "filter by dealer" dropdown keeps every dealer this painter has ever
    // purchased from, not just the ones matching the current filter.
    Sale.distinct("dealerId", { painterId }),
  ]);

  const summaryRow = summaryAgg[0] || { totalRevenue: 0, totalCount: 0 };
  const dealers = dealerIds.length
    ? await DealerProfile.find({ _id: { $in: dealerIds } })
        .select("companyName")
        .sort({ companyName: 1 })
        .lean()
    : [];

  return {
    items,
    summary: {
      totalRevenue: summaryRow.totalRevenue || 0,
      totalCount: summaryRow.totalCount || 0,
    },
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
    dealers,
  };
}
