import mongoose from "mongoose";
import Payment from "../../models/Payment.model.js";
import Order, { ORDER_ORIGIN } from "../../models/Order.model.js";
import DealerProfile from "../../models/DealerProfile.model.js";
import Dispatcher from "../../models/Dispatcher.model.js";
import ApiError from "../../utils/apiError.js";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../../constants/statuses.js";
import {
  ACCEPTED_ORDER_STATUSES,
  INTERNAL_ORDER_ORIGINS,
  MEITU_DEALER_BILL_MATCH,
  PAID_PAYMENT_STATUSES,
  numberValue,
  normalize,
  normalizeUpper,
  resolveDateRange,
} from "./insightsShared.js";
import { getReceivableBalances } from "./dealerStatements.service.js";

function objectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

// The parties whose payments the admin records: every dispatcher (for
// their restock), and every dealer who owes Meitu - served by the factory
// now, or with factory-supplied orders from before they moved to a
// dispatcher. A dealer only ever supplied by a dispatcher pays that
// dispatcher, not Meitu, so admitting them here would double-count the same
// money once the dispatcher settles their own account.
export async function listPayableParties() {
  const billedDealerIds = await Order.distinct("dealerId", MEITU_DEALER_BILL_MATCH);
  const [dealers, dispatchers] = await Promise.all([
    // `$ne` rather than "FACTORY": a profile with no stored mode is a
    // factory dealer (the schema default).
    DealerProfile.find({
      $or: [{ fulfillmentMode: { $ne: "DISPATCHER" } }, { _id: { $in: billedDealerIds } }],
    })
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

// `payment` is how a Payment names this party; `orders` is which orders
// bill them (the bill matches in insightsShared.js, minus the status
// filter - a payment may be recorded against an order before it is
// accepted). A dispatcher is billed only for their own replenishment
// orders (where they are the customer, `dispatcherCustomerId`) - NOT for
// dealer orders routed through them (`dispatcherId`), which their dealers
// owe them. A dealer is billed only for orders the factory supplied.
function partyScope({ partyType, partyId }) {
  const id = objectId(partyId, "partyId");
  if (partyType === "DISPATCHER") {
    return {
      payment: { dispatcherId: id },
      orders: { dispatcherCustomerId: id, orderOrigin: ORDER_ORIGIN.DISPATCHER_REPLENISHMENT },
    };
  }
  return {
    payment: { dealerId: id },
    orders: {
      dealerId: id,
      orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
      "dealerSnapshot.fulfillmentMode": { $ne: "DISPATCHER" },
    },
  };
}

// Orders that still owe money for this party, oldest first. `paid` counts
// both order-linked payments and allocations written by earlier
// on-account payments, so the same rupee is never applied twice.
async function openOrdersOldestFirst(ordersMatch) {
  const orderMatch = {
    ...ordersMatch,
    isDeleted: { $ne: true },
    status: { $in: ACCEPTED_ORDER_STATUSES },
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
  const scope = partyScope({ partyType, partyId });
  const openOrders = await openOrdersOldestFirst(scope.orders);
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

  const scope = partyScope({ partyType, partyId: payload.partyId });
  const party = scope.payment;

  // Dispatcher-served dealers pay their dispatcher, not Meitu - recording
  // them here would double-count once the dispatcher settles up. The
  // exception is a dealer who moved to a dispatcher but still owes Meitu
  // for what the factory supplied before the move.
  if (partyType === "DEALER") {
    const dealer = await DealerProfile.findById(party.dealerId).select("fulfillmentMode").lean();
    if (!dealer) throw new ApiError(404, "Dealer not found");
    if (
      dealer.fulfillmentMode === "DISPATCHER" &&
      !(await Order.exists({ ...MEITU_DEALER_BILL_MATCH, dealerId: party.dealerId }))
    ) {
      throw new ApiError(
        400,
        "This dealer is served by a dispatcher - their payments are recorded by that dispatcher, not by admin",
      );
    }
  } else {
    const dispatcher = await Dispatcher.findById(party.dispatcherId).select("_id").lean();
    if (!dispatcher) throw new ApiError(404, "Dispatcher not found");
  }

  let orderId = null;
  let allocations = [];

  if (normalize(payload.orderId)) {
    orderId = objectId(payload.orderId, "orderId");
    const order = await Order.findOne({ _id: orderId, ...scope.orders }).select("_id").lean();
    if (!order) {
      const viaDispatcher =
        partyType === "DEALER" &&
        (await Order.exists({
          _id: orderId,
          dealerId: party.dealerId,
          "dealerSnapshot.fulfillmentMode": "DISPATCHER",
        }));
      if (viaDispatcher) {
        throw new ApiError(
          400,
          "That order was supplied by a dispatcher - the dealer pays the dispatcher for it, not Meitu",
        );
      }
      throw new ApiError(404, "Order not found for this party");
    }
  } else {
    // On account: split oldest-first so AR aging (computed per order)
    // still sees the money.
    const openOrders = await openOrdersOldestFirst(scope.orders);
    allocations = allocateOldestFirst(openOrders, amount).allocations;
  }

  const payment = await Payment.create({
    orderId,
    dealerId: party.dealerId || null,
    dispatcherId: party.dispatcherId || null,
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
// The balances are the same ones Statements & AR shows (unscoped), so the
// two tabs always agree; the payable-party list only adds settled parties
// with nothing on their account, for the "show settled" view.
export async function getPartyDues(filters = {}) {
  const [parties, balances] = await Promise.all([listPayableParties(), getReceivableBalances({})]);

  const rows = new Map(
    parties.map((party) => [party.key, { ...party, billed: 0, paid: 0, due: 0 }]),
  );
  balances.forEach((balance) => {
    rows.set(balance.key, {
      key: balance.key,
      partyType: balance.partyType,
      partyId: balance.partyId,
      name: rows.get(balance.key)?.name || balance.name,
      billed: balance.totalOrdered,
      paid: balance.totalPaid,
      due: balance.outstanding,
    });
  });

  const showSettled = String(filters.settled || "") === "true";

  return [...rows.values()]
    .filter((row) => (showSettled ? true : row.billed > 0 || row.paid > 0))
    .sort((a, b) => b.due - a.due);
}
