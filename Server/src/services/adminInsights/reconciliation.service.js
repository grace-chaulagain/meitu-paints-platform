import Payment from "../../models/Payment.model.js";
import { PAYMENT_STATUS } from "../../constants/statuses.js";
import {
  applyDealerScope,
  numberValue,
  resolveDateRange,
  resolveDealerIdScope,
} from "./insightsShared.js";

// Status/method breakdown for the selected window - the verification
// queue itself is the existing listPayments() (admin.service.js), filtered
// client-side to PENDING_VERIFICATION; this is the summary chart data that
// currently doesn't exist anywhere on top of that raw listing.
export async function getPaymentBreakdown(filters = {}) {
  const range = resolveDateRange(filters);
  // Payments carry dealerId but not routing, so the workspace's Route
  // scope is resolved to dealer ids first.
  const match = applyDealerScope({}, await resolveDealerIdScope(filters));
  if (!range.isAllTime) {
    match.createdAt = { $gte: range.start, $lte: range.end };
  }

  const rows = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { status: "$status", method: "$method" },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  return rows.map((row) => ({
    status: row._id.status,
    method: row._id.method,
    amount: numberValue(row.amount),
    count: numberValue(row.count),
  }));
}

// Headline totals for the verification queue - independent of the date
// filter, since a queue is a "what needs action right now" view, not a
// historical report.
export async function getVerificationQueueSummary(filters = {}) {
  const rows = await Payment.aggregate([
    {
      $match: applyDealerScope(
        { status: PAYMENT_STATUS.PENDING_VERIFICATION },
        await resolveDealerIdScope(filters),
      ),
    },
    {
      $group: {
        _id: "$method",
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  const byMethod = rows.map((row) => ({
    method: row._id,
    amount: numberValue(row.amount),
    count: numberValue(row.count),
  }));

  return {
    byMethod,
    totals: byMethod.reduce(
      (acc, row) => ({ amount: acc.amount + row.amount, count: acc.count + row.count }),
      { amount: 0, count: 0 },
    ),
  };
}
