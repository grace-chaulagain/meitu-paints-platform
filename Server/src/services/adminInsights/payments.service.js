import mongoose from "mongoose";
import Payment from "../../models/Payment.model.js";
import Order from "../../models/Order.model.js";
import DealerProfile from "../../models/DealerProfile.model.js";
import Dispatcher from "../../models/Dispatcher.model.js";
import ApiError from "../../utils/apiError.js";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../../constants/statuses.js";
import {
  AR_EXCLUDED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  PAID_PAYMENT_STATUSES,
  numberValue,
  normalize,
  normalizeUpper,
  resolveDateRange,
} from "./insightsShared.js";

function objectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

// Only factory-routed dealers and dispatchers are the admin's to record.
// A dealer served by a dispatcher pays that dispatcher, not Meitu, so
// admitting them here would double-count the same money once the
// dispatcher settles their own account.
export async function listPayableParties() {
  const [dealers, dispatchers] = await Promise.all([
    DealerProfile.find({ fulfillmentMode: "FACTORY" })
      .select("companyName contactName")
      .sort({ companyName: 1 })
      .lean(),
    Dispatcher.find({}).select("companyName contactName").sort({ companyName: 1 }).lean(),
  ]);

  return [
    ...dealers.map((dealer) => ({
      key: `DEALER:${dealer._id}`,
      partyType: "DEALER",
      partyId: String(dealer._id),
      name: dealer.companyName || dealer.contactName || "Dealer",
    })),
    ...dispatchers.map((dispatcher) => ({
      key: `DISPATCHER:${dispatcher._id}`,
      partyType: "DISPATCHER",
      partyId: String(dispatcher._id),
      name: dispatcher.companyName || dispatcher.contactName || "Dispatcher",
    })),
  ];
}

function partyMatch({ partyType, partyId }) {
  if (partyType === "DISPATCHER") return { dispatcherId: objectId(partyId, "partyId") };
  return { dealerId: objectId(partyId, "partyId") };
}

// Orders that still owe money for this party, oldest first. `paid` counts
// both order-linked payments and allocations written by earlier
// on-account payments, so the same rupee is never applied twice.
async function openOrdersOldestFirst(match) {
  const orderMatch = {
    ...match,
    isDeleted: { $ne: true },
    orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
    status: { $nin: AR_EXCLUDED_ORDER_STATUSES },
    closedAt: null,
  };

  return Order.aggregate([
    { $match: orderMatch },
    { $sort: { createdAt: 1 } },
    {
      $lookup: {
        from: "payments",
        let: { orderId: "$_id" },
        pipeline: [
          { $match: { status: { $in: PAID_PAYMENT_STATUSES } } },
          {
            $project: {
              direct: {
                $cond: [{ $eq: ["$orderId", "$$orderId"] }, "$amount", 0],
              },
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
    { $addFields: { outstanding: { $subtract: ["$totals.total", "$paid"] } } },
    { $match: { outstanding: { $gt: 0 } } },
    { $project: { _id: 1, orderNumber: 1, createdAt: 1, outstanding: 1, total: "$totals.total" } },
  ]);
}

// Splits an on-account amount across open orders oldest-first. Any
// remainder (the party paid more than they owe) stays unallocated and
// simply sits on their balance as credit - deliberately not forced onto
// an order it doesn't belong to.
function allocateOldestFirst(openOrders, amount) {
  let remaining = numberValue(amount);
  const allocations = [];

  for (const order of openOrders) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, numberValue(order.outstanding));
    if (applied <= 0) continue;
    allocations.push({ orderId: order._id, amount: applied });
    remaining -= applied;
  }

  return { allocations, unallocated: Math.max(0, remaining) };
}

export async function previewAllocation({ partyType, partyId, amount }) {
  const match = partyMatch({ partyType, partyId });
  const openOrders = await openOrdersOldestFirst(match);
  const { allocations, unallocated } = allocateOldestFirst(openOrders, amount);
  const byId = new Map(openOrders.map((order) => [String(order._id), order]));

  return {
    unallocated,
    totalOutstanding: openOrders.reduce((sum, order) => sum + numberValue(order.outstanding), 0),
    allocations: allocations.map((allocation) => ({
      orderId: String(allocation.orderId),
      orderNumber: byId.get(String(allocation.orderId))?.orderNumber || "",
      amount: allocation.amount,
    })),
  };
}

export async function createAdminPayment(payload = {}, adminUserId = null) {
  const partyType = normalizeUpper(payload.partyType);
  if (!["DEALER", "DISPATCHER"].includes(partyType)) {
    throw new ApiError(400, "partyType must be DEALER or DISPATCHER");
  }

  const amount = numberValue(payload.amount);
  if (amount <= 0) throw new ApiError(400, "Amount must be greater than zero");

  const method = normalizeUpper(payload.method);
  if (!Object.values(PAYMENT_METHOD).includes(method)) {
    throw new ApiError(400, "Invalid payment method");
  }

  const status = payload.status ? normalizeUpper(payload.status) : PAYMENT_STATUS.VERIFIED;
  if (!Object.values(PAYMENT_STATUS).includes(status)) {
    throw new ApiError(400, "Invalid payment status");
  }

  const match = partyMatch({ partyType, partyId: payload.partyId });

  // Dispatcher-served dealers pay their dispatcher, not Meitu - recording
  // them here would double-count once the dispatcher settles up.
  if (partyType === "DEALER") {
    const dealer = await DealerProfile.findById(match.dealerId).select("fulfillmentMode").lean();
    if (!dealer) throw new ApiError(404, "Dealer not found");
    if (dealer.fulfillmentMode !== "FACTORY") {
      throw new ApiError(
        400,
        "This dealer is served by a dispatcher - their payments are recorded by that dispatcher, not by admin",
      );
    }
  } else {
    const dispatcher = await Dispatcher.findById(match.dispatcherId).select("_id").lean();
    if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  }

  let orderId = null;
  let allocations = [];

  if (normalize(payload.orderId)) {
    orderId = objectId(payload.orderId, "orderId");
    const order = await Order.findOne({ _id: orderId, ...match }).select("_id").lean();
    if (!order) throw new ApiError(404, "Order not found for this party");
  } else {
    // On account: split oldest-first so AR aging (computed per order)
    // still sees the money.
    const openOrders = await openOrdersOldestFirst(match);
    allocations = allocateOldestFirst(openOrders, amount).allocations;
  }

  const payment = await Payment.create({
    orderId,
    dealerId: match.dealerId || null,
    dispatcherId: match.dispatcherId || null,
    allocations,
    method,
    amount,
    currency: normalize(payload.currency) || "NPR",
    status,
    proof: {
      fileUrl: normalize(payload.proofUrl).slice(0, 500),
      note: normalize(payload.note).slice(0, 200),
    },
    meta: {
      txnId: normalize(payload.txnId).slice(0, 120),
      bankName: normalize(payload.bankName).slice(0, 120),
      chequeNo: normalize(payload.chequeNo).slice(0, 120),
      receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : null,
    },
    createdBy: adminUserId,
    verifiedBy: status === PAYMENT_STATUS.VERIFIED ? adminUserId : null,
    verifiedAt: status === PAYMENT_STATUS.VERIFIED ? new Date() : null,
  });

  return { paymentId: payment._id, allocations: payment.allocations };
}

// Ledger for the Payments section: every recorded payment with its party
// resolved, filterable by method, status and party.
export async function listAdminPayments(filters = {}) {
  const range = resolveDateRange(filters);
  const query = {};

  if (!range.isAllTime) {
    query.createdAt = { $gte: range.start, $lte: range.end };
  }

  const method = normalizeUpper(filters.method);
  if (Object.values(PAYMENT_METHOD).includes(method)) query.method = method;

  const status = normalizeUpper(filters.status);
  if (Object.values(PAYMENT_STATUS).includes(status)) query.status = status;

  if (normalize(filters.dealerId)) query.dealerId = objectId(filters.dealerId, "dealerId");
  if (normalize(filters.dispatcherId)) query.dispatcherId = objectId(filters.dispatcherId, "dispatcherId");

  const rows = await Payment.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(filters.limit) || 200)))
    .populate("dealerId", "companyName contactName")
    .populate("dispatcherId", "companyName contactName")
    .populate("orderId", "orderNumber")
    .lean();

  return rows.map((row) => ({
    _id: String(row._id),
    createdAt: row.createdAt,
    amount: numberValue(row.amount),
    currency: row.currency || "NPR",
    method: row.method,
    status: row.status,
    partyType: row.dispatcherId ? "DISPATCHER" : "DEALER",
    partyName:
      row.dispatcherId?.companyName ||
      row.dispatcherId?.contactName ||
      row.dealerId?.companyName ||
      row.dealerId?.contactName ||
      "Unknown",
    orderNumber: row.orderId?.orderNumber || "",
    onAccount: !row.orderId,
    allocationCount: (row.allocations || []).length,
    note: row.proof?.note || "",
  }));
}

// Per-party dues: what they've been billed, what they've paid, what's left.
export async function getPartyDues(filters = {}) {
  const parties = await listPayableParties();

  const [orderRows, paymentRows] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
          status: { $nin: AR_EXCLUDED_ORDER_STATUSES },
        },
      },
      { $group: { _id: "$dealerId", billed: { $sum: "$totals.total" } } },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: PAID_PAYMENT_STATUSES } } },
      {
        $group: {
          _id: { dealerId: "$dealerId", dispatcherId: "$dispatcherId" },
          paid: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const billedByDealer = new Map(orderRows.filter((row) => row._id).map((row) => [String(row._id), numberValue(row.billed)]));
  const paidByParty = new Map();
  paymentRows.forEach((row) => {
    const id = String(row._id.dispatcherId || row._id.dealerId || "");
    if (!id) return;
    paidByParty.set(id, (paidByParty.get(id) || 0) + numberValue(row.paid));
  });

  const showSettled = String(filters.settled || "") === "true";

  return parties
    .map((party) => {
      const billed = party.partyType === "DEALER" ? billedByDealer.get(party.partyId) || 0 : 0;
      const paid = paidByParty.get(party.partyId) || 0;
      return { ...party, billed, paid, due: billed - paid };
    })
    .filter((row) => (showSettled ? true : row.billed > 0 || row.paid > 0))
    .sort((a, b) => b.due - a.due);
}
