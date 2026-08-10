// AR (accounts-receivable-style) aggregations for the account-keeping
// rebuild. The order-statements report itself (admin.service.js:
// getOrderStatementsReport) is relocated here in Phase 2 alongside the
// Dealer Statements & AR UI - this file starts with just the AR queries
// because Cash Position (Phase 1) needs real AR figures for its KPI row.
import Order from "../../models/Order.model.js";
import Payment from "../../models/Payment.model.js";
import DealerProfile from "../../models/DealerProfile.model.js";
import {
  AR_EXCLUDED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  PAID_PAYMENT_STATUSES,
  numberValue,
} from "./insightsShared.js";

// Per-dealer outstanding balance = everything they've ever ordered (minus
// rejected/cancelled orders) less everything they've actually paid.
// Deliberately left SIGNED (an overpaid dealer shows a negative balance,
// i.e. a credit owed back to them) rather than clamped at 0 - a real
// account-keeping view needs to surface that, not hide it.
export async function getArSummaryByDealer() {
  const [orderedRows, paidRows] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          status: { $nin: AR_EXCLUDED_ORDER_STATUSES },
          isDeleted: { $ne: true },
          // Dispatcher-replenishment orders have no dealerId (they use
          // dispatcherCustomerId instead) - without this, "$dealerId"
          // groups them under a null _id, which then blows up the
          // DealerProfile lookup below (String(null) === "null", an
          // invalid ObjectId).
          orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
          dealerId: { $ne: null },
        },
      },
      { $group: { _id: "$dealerId", totalOrdered: { $sum: "$totals.total" } } },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: PAID_PAYMENT_STATUSES }, dealerId: { $ne: null } } },
      { $group: { _id: "$dealerId", totalPaid: { $sum: "$amount" } } },
    ]),
  ]);

  const orderedByDealer = new Map(
    orderedRows.filter((row) => row._id).map((row) => [String(row._id), numberValue(row.totalOrdered)]),
  );
  const paidByDealer = new Map(
    paidRows.filter((row) => row._id).map((row) => [String(row._id), numberValue(row.totalPaid)]),
  );

  const dealerIds = Array.from(new Set([...orderedByDealer.keys(), ...paidByDealer.keys()]));

  const dealers = dealerIds.length
    ? await DealerProfile.find({ _id: { $in: dealerIds } })
        .select("companyName contactName email phone")
        .lean()
    : [];
  const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]));

  const rows = dealerIds.map((dealerId) => {
    const totalOrdered = orderedByDealer.get(dealerId) || 0;
    const totalPaid = paidByDealer.get(dealerId) || 0;
    return {
      dealerId,
      dealer: dealerById.get(dealerId) || null,
      totalOrdered,
      totalPaid,
      outstanding: totalOrdered - totalPaid,
    };
  });

  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

// Fleet-wide AR position: sum of every dealer's signed outstanding balance
// (so dealer credit balances net against dealer debts, mirroring how the
// per-dealer figures above are computed).
export async function getFleetArTotal() {
  const rows = await getArSummaryByDealer();
  return rows.reduce((sum, row) => sum + row.outstanding, 0);
}

const AGING_BUCKET_BOUNDARIES = [0, 31, 61, 91];
const AGING_BUCKET_LABELS = {
  0: "0-30 days",
  31: "31-60 days",
  61: "61-90 days",
  91: "90+ days",
};

// Age buckets are order-level and non-negative by construction (a single
// unpaid order's outstanding amount can't be a credit) - this is
// deliberately different from the signed per-dealer summary above, which
// nets a dealer's overpayment on one order against a balance on another.
// Flat 0-30/31-60/61-90/90+ from order date for every dealer (no
// per-dealer credit-term adjustment) per the agreed aging policy.
// closedAt:null is pre-filtered before the payments $lookup because
// closeOrder() only ever sets closedAt once an order is fully reconciled
// (see admin.service.js:closeOrder), so this is a safe, real narrowing of
// the $lookup's working set, not just a nice-to-have.
export async function getArAgingBuckets() {
  const now = new Date();
  const rows = await Order.aggregate([
    {
      $match: {
        status: { $nin: AR_EXCLUDED_ORDER_STATUSES },
        isDeleted: { $ne: true },
        orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
        closedAt: null,
      },
    },
    {
      $lookup: {
        from: "payments",
        let: { orderId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$orderId", "$$orderId"] },
              status: { $in: PAID_PAYMENT_STATUSES },
            },
          },
          { $group: { _id: null, paid: { $sum: "$amount" } } },
        ],
        as: "paymentAgg",
      },
    },
    {
      $addFields: {
        paid: { $ifNull: [{ $first: "$paymentAgg.paid" }, 0] },
      },
    },
    {
      $addFields: {
        outstanding: { $max: [{ $subtract: ["$totals.total", "$paid"] }, 0] },
        ageDays: {
          $dateDiff: { startDate: "$createdAt", endDate: now, unit: "day" },
        },
      },
    },
    { $match: { outstanding: { $gt: 0 } } },
    {
      $bucket: {
        groupBy: "$ageDays",
        boundaries: AGING_BUCKET_BOUNDARIES,
        default: 91,
        output: {
          orderCount: { $sum: 1 },
          outstanding: { $sum: "$outstanding" },
        },
      },
    },
  ]);

  const byBoundary = new Map(rows.map((row) => [row._id, row]));
  return AGING_BUCKET_BOUNDARIES.map((boundary) => {
    const row = byBoundary.get(boundary);
    return {
      bucket: AGING_BUCKET_LABELS[boundary],
      orderCount: row?.orderCount || 0,
      outstanding: numberValue(row?.outstanding),
    };
  });
}

// "Overdue" = outstanding order age beyond a flat 30-day grace window
// (buckets 2-4). All figures here are non-negative (see aging note above),
// so this sum is always >= 0.
export async function getOverdueArTotal() {
  const buckets = await getArAgingBuckets();
  return buckets
    .filter((bucket) => bucket.bucket !== "0-30 days")
    .reduce((sum, bucket) => sum + bucket.outstanding, 0);
}
