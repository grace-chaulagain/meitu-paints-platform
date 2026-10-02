// AR (accounts-receivable-style) aggregations for the account-keeping
// rebuild. The order-statements report itself (admin.service.js:
// getOrderStatementsReport) is relocated here in Phase 2 alongside the
// Dealer Statements & AR UI - this file starts with just the AR queries
// because Cash Position (Phase 1) needs real AR figures for its KPI row.
import Order from "../../models/Order.model.js";
import Payment from "../../models/Payment.model.js";
import DealerProfile from "../../models/DealerProfile.model.js";
import Dispatcher from "../../models/Dispatcher.model.js";
import {
  MEITU_DEALER_BILL_MATCH,
  MEITU_DISPATCHER_BILL_MATCH,
  PAID_PAYMENT_STATUSES,
  REPORTING_TIMEZONE,
  numberValue,
  receivedPaymentMatch,
  resolveReceivableScope,
} from "./insightsShared.js";

const partyKey = (partyType, partyId) => `${partyType}:${partyId}`;

// Every party's balance with Meitu: what Meitu billed them (see the bill
// matches in insightsShared.js - dealers for factory-supplied orders,
// dispatchers for restock) less what they've paid. This one function feeds
// Statements & AR, the Outstanding AR KPI and the Payments tab's dues, so
// those can never disagree about who owes what.
// Deliberately left SIGNED (an overpaid party shows a negative balance, i.e.
// a credit owed back to them) rather than clamped at 0 - a real
// account-keeping view needs to surface that, not hide it.
export async function getReceivableBalances(filters = {}) {
  const scope = resolveReceivableScope(filters);

  const [dealerBills, dispatcherBills, paidRows] = await Promise.all([
    scope.dealers
      ? Order.aggregate([
          { $match: { ...MEITU_DEALER_BILL_MATCH, ...scope.dealers } },
          { $group: { _id: "$dealerId", billed: { $sum: "$totals.total" } } },
        ])
      : [],
    scope.dispatchers
      ? Order.aggregate([
          { $match: { ...MEITU_DISPATCHER_BILL_MATCH, ...scope.dispatchers } },
          { $group: { _id: "$dispatcherCustomerId", billed: { $sum: "$totals.total" } } },
        ])
      : [],
    Payment.aggregate([
      { $match: { status: { $in: PAID_PAYMENT_STATUSES }, ...(await receivedPaymentMatch(filters)) } },
      { $group: { _id: { dealerId: "$dealerId", dispatcherId: "$dispatcherId" }, paid: { $sum: "$amount" } } },
    ]),
  ]);

  const balances = new Map();
  const entry = (partyType, partyId) => {
    const key = partyKey(partyType, partyId);
    if (!balances.has(key)) balances.set(key, { partyType, partyId, billed: 0, paid: 0 });
    return balances.get(key);
  };
  dealerBills.forEach((row) => { entry("DEALER", String(row._id)).billed += numberValue(row.billed); });
  dispatcherBills.forEach((row) => { entry("DISPATCHER", String(row._id)).billed += numberValue(row.billed); });
  paidRows.forEach((row) => {
    // A Payment names exactly one party (see Payment.model.js).
    const { dealerId, dispatcherId } = row._id || {};
    if (dispatcherId) entry("DISPATCHER", String(dispatcherId)).paid += numberValue(row.paid);
    else if (dealerId) entry("DEALER", String(dealerId)).paid += numberValue(row.paid);
  });

  const idsOf = (type) => [...balances.values()].filter((b) => b.partyType === type).map((b) => b.partyId);
  const [dealers, dispatchers] = await Promise.all([
    DealerProfile.find({ _id: { $in: idsOf("DEALER") } }).select("companyName contactName email phone").lean(),
    Dispatcher.find({ _id: { $in: idsOf("DISPATCHER") } }).select("companyName contactName").lean(),
  ]);
  const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]));
  const dispatcherById = new Map(dispatchers.map((dispatcher) => [String(dispatcher._id), dispatcher]));

  const rows = [...balances.values()].map(({ partyType, partyId, billed, paid }) => {
    const dealer = partyType === "DEALER" ? dealerById.get(partyId) || null : null;
    const dispatcher = partyType === "DISPATCHER" ? dispatcherById.get(partyId) || null : null;
    const profile = dealer || dispatcher;
    return {
      key: partyKey(partyType, partyId),
      partyType,
      partyId,
      name: profile?.companyName || profile?.contactName || (partyType === "DEALER" ? "Unknown dealer" : "Unknown dispatcher"),
      // Kept for existing consumers that read dealer rows by these names.
      dealerId: partyType === "DEALER" ? partyId : null,
      dealer,
      totalOrdered: billed,
      totalPaid: paid,
      outstanding: billed - paid,
    };
  });

  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

// Statements & AR rows - dealers and dispatchers, see getReceivableBalances.
export async function getArSummaryByDealer(filters = {}) {
  return getReceivableBalances(filters);
}

// Fleet-wide AR position: sum of every party's signed outstanding balance
// (so credit balances net against debts, mirroring the per-party figures).
export async function getFleetArTotal(filters = {}) {
  const rows = await getArSummaryByDealer(filters);
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
export async function getArAgingBuckets(filters = {}) {
  const now = new Date();
  // The same bills as getReceivableBalances, so the buckets add up to the
  // outstanding balances (apart from credits, which aging never shows).
  const scope = resolveReceivableScope(filters);
  const bills = [
    scope.dealers && { ...MEITU_DEALER_BILL_MATCH, ...scope.dealers },
    scope.dispatchers && { ...MEITU_DISPATCHER_BILL_MATCH, ...scope.dispatchers },
  ].filter(Boolean);

  const rows = await Order.aggregate([
    { $match: { closedAt: null, $or: bills } },
    {
      // Counts BOTH order-linked payments and the per-order slices of
      // on-account payments (Payment.allocations). Without the second
      // half, an on-account payment would never reduce any order's
      // outstanding and aging would keep reporting settled bills as
      // overdue - see payments.service.js.
      $lookup: {
        from: "payments",
        let: { orderId: "$_id" },
        pipeline: [
          { $match: { status: { $in: PAID_PAYMENT_STATUSES } } },
          {
            $project: {
              direct: { $cond: [{ $eq: ["$orderId", "$$orderId"] }, "$amount", 0] },
              allocated: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: ["$allocations", []] },
                        cond: { $eq: ["$$this.orderId", "$$orderId"] },
                      },
                    },
                    in: "$$this.amount",
                  },
                },
              },
            },
          },
          { $group: { _id: null, paid: { $sum: { $add: ["$direct", "$allocated"] } } } },
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
          $dateDiff: { startDate: "$createdAt", endDate: now, unit: "day", timezone: REPORTING_TIMEZONE },
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
export async function getOverdueArTotal(filters = {}) {
  const buckets = await getArAgingBuckets(filters);
  return buckets
    .filter((bucket) => bucket.bucket !== "0-30 days")
    .reduce((sum, bucket) => sum + bucket.outstanding, 0);
}
