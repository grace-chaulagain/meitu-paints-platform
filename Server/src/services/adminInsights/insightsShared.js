import mongoose from "mongoose";
import ApiError from "../../utils/apiError.js";
import { PAYMENT_STATUS } from "../../constants/statuses.js";
import Order, { ORDER_STATUS } from "../../models/Order.model.js";

export const DAY_MS = 86400000;

// The business runs on Nepal time; every day boundary, day/week/month
// bucket and weekday in these reports is computed in it. Without this,
// Mongo buckets in UTC and an order placed 00:00-05:45 NPT lands on the
// previous day - and date filters shift with whatever TZ the host has.
export const REPORTING_TIMEZONE = "Asia/Kathmandu";
const REPORTING_UTC_OFFSET = "+05:45";

// Orders that count as real, accepted revenue for reporting purposes.
// Also the only orders that carry a balance in AR/dues views: a SUBMITTED
// order hasn't been accepted yet, so nobody owes anything on it, and a
// rejected or cancelled one never will.
export const ACCEPTED_ORDER_STATUSES = [
  ORDER_STATUS.VERIFIED,
  ORDER_STATUS.DISPATCHED,
  ORDER_STATUS.COMPLETED,
];

// Order origins that reuse the Order pipeline but aren't dealer sales, so
// they're excluded from every revenue/AR view:
//   DISPATCHER_REPLENISHMENT - a dispatcher restocking from the factory.
//   SCHEME - free-of-cost goods granted to a dealer/dispatcher. Every
//     line is zero-value, so including them would drag average order
//     value down and show each giveaway as a fully-settled bill.
// Both remain fully visible in Order Analytics and Inventory.
export const INTERNAL_ORDER_ORIGINS = ["DISPATCHER_REPLENISHMENT", "SCHEME"];

// What is owed to Meitu, and by whom. Decided by who SUPPLIED each order
// (its snapshot), never by the dealer's current setting - dealers move
// between the factory and dispatchers, and a dealer who moved still owes
// Meitu for what the factory supplied before the move:
//   - a dealer order the factory supplied: the dealer owes Meitu;
//   - a dealer order a dispatcher supplied: the dealer owes that
//     dispatcher, so it is never part of Meitu's receivables;
//   - a dispatcher's restock order: the dispatcher owes Meitu.
// Every "owed to Meitu" figure (AR, aging, dues, payment allocation) is
// built from these two matches, so the sections cannot disagree.
// `$ne: "DISPATCHER"` keeps an order with no stored mode, which the schema
// defaults to FACTORY.
export const MEITU_DEALER_BILL_MATCH = Object.freeze({
  isDeleted: { $ne: true },
  orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
  status: { $in: ACCEPTED_ORDER_STATUSES },
  dealerId: { $ne: null },
  "dealerSnapshot.fulfillmentMode": { $ne: "DISPATCHER" },
});

export const MEITU_DISPATCHER_BILL_MATCH = Object.freeze({
  isDeleted: { $ne: true },
  orderOrigin: "DISPATCHER_REPLENISHMENT",
  status: { $in: ACCEPTED_ORDER_STATUSES },
  dispatcherCustomerId: { $ne: null },
});

// Payment statuses that count as money actually received. VERIFIED is the
// normal case; PARTIAL/PAID also represent real received amounts (the
// legacy `getOrderOutstanding` helper missed these - see admin.service.js).
export const PAID_PAYMENT_STATUSES = [
  PAYMENT_STATUS.VERIFIED,
  PAYMENT_STATUS.PARTIAL,
  PAYMENT_STATUS.PAID,
];

export function normalize(value = "") {
  return String(value || "").trim();
}

export function normalizeUpper(value = "") {
  return normalize(value).toUpperCase();
}

export function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function objectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

// Entity scope shared by every insights section, so the workspace's Route
// and Dealer pickers filter exactly the way the admin orders list does
// (see listOrders() in order.service.js) rather than growing a second,
// subtly different interpretation of the same words.
//
// DISPATCHER_REPLENISHMENT is deliberately NOT accepted here: those orders
// are excluded from every revenue/AR view (INTERNAL_ORDER_ORIGINS above),
// so offering it as a filter could only ever produce an all-zero view.
export function resolveEntityMatch(filters = {}) {
  const match = {};

  const fulfillmentMode = normalizeUpper(filters.fulfillmentMode);
  if (["FACTORY", "DISPATCHER"].includes(fulfillmentMode)) {
    match["dealerSnapshot.fulfillmentMode"] = fulfillmentMode;
  }

  if (normalize(filters.dispatcherId)) {
    match.dispatcherId = objectId(filters.dispatcherId, "dispatcherId");
    // A dispatcher scope is meaningless outside dispatcher-routed orders,
    // and pinning it here keeps the count consistent with the orders list.
    match["dealerSnapshot.fulfillmentMode"] = "DISPATCHER";
  }

  if (normalize(filters.dealerId)) {
    match.dealerId = objectId(filters.dealerId, "dealerId");
  }

  return match;
}

export function hasEntityScope(filters = {}) {
  return Boolean(
    normalize(filters.dealerId) ||
      normalize(filters.dispatcherId) ||
      ["FACTORY", "DISPATCHER"].includes(normalizeUpper(filters.fulfillmentMode)),
  );
}

// Collections keyed only by dealerId (Payment, dealer stock) can't be
// filtered by routing directly - routing lives on DealerProfile, not on
// the payment. So resolve the scope to a concrete dealer id list first.
// Returns null when unscoped, meaning "apply no dealer restriction";
// an empty array means "scoped, but nothing matches" and callers must
// treat that as a genuine empty result rather than as unscoped.
export async function resolveDealerIdScope(filters = {}) {
  if (!hasEntityScope(filters)) return null;

  const dealerId = normalize(filters.dealerId);
  if (dealerId) return [objectId(dealerId, "dealerId")];

  const { default: DealerProfile } = await import("../../models/DealerProfile.model.js");

  const query = {};
  const dispatcherId = normalize(filters.dispatcherId);
  if (dispatcherId) {
    query.fulfillmentMode = "DISPATCHER";
    query.dispatcherId = objectId(dispatcherId, "dispatcherId");
  } else {
    query.fulfillmentMode = normalizeUpper(filters.fulfillmentMode);
  }

  const dealers = await DealerProfile.find(query).select("_id").lean();
  return dealers.map((dealer) => dealer._id);
}

// Applies a resolved dealer-id scope to a query object in place.
export function applyDealerScope(query, scope) {
  if (scope === null || scope === undefined) return query;
  query.dealerId = { $in: scope };
  return query;
}

// Which receivable parties the workspace's entity scope selects, as extra
// conditions on each bill match (null = that kind of party is out of scope):
//   picked dealer         -> that dealer only
//   Factory route         -> dealers only
//   dispatcher route(s)   -> dispatchers only (one, if picked) - the dealer
//                            orders on that route are owed to the
//                            dispatcher, so what Meitu is owed there is the
//                            dispatchers' own restock
//   no scope              -> everyone
export function resolveReceivableScope(filters = {}) {
  if (normalize(filters.dealerId)) {
    return { dealers: { dealerId: objectId(filters.dealerId, "dealerId") }, dispatchers: null };
  }
  if (normalize(filters.dispatcherId)) {
    return {
      dealers: null,
      dispatchers: { dispatcherCustomerId: objectId(filters.dispatcherId, "dispatcherId") },
    };
  }
  const mode = normalizeUpper(filters.fulfillmentMode);
  if (mode === "FACTORY") return { dealers: {}, dispatchers: null };
  if (mode === "DISPATCHER") return { dealers: null, dispatchers: {} };
  return { dealers: {}, dispatchers: {} };
}

// Payments that are money received by Meitu, within a receivable scope. A
// dealer's payment against an order a dispatcher supplied (dealers can
// submit those from their portal) went to that dispatcher, so it is left out.
export async function receivedPaymentMatch(filters = {}) {
  const scope = resolveReceivableScope(filters);
  const dispatcherSupplied = scope.dealers
    ? await Order.distinct("_id", {
        orderOrigin: { $nin: INTERNAL_ORDER_ORIGINS },
        "dealerSnapshot.fulfillmentMode": "DISPATCHER",
      })
    : [];

  const dealerSide = scope.dealers && {
    dealerId: scope.dealers.dealerId || { $ne: null },
    orderId: { $nin: dispatcherSupplied },
  };
  const dispatcherSide = scope.dispatchers && {
    dispatcherId: scope.dispatchers.dispatcherCustomerId || { $ne: null },
  };

  if (dealerSide && dispatcherSide) return { $or: [dealerSide, dispatcherSide] };
  return dealerSide || dispatcherSide;
}

// Start/end of a calendar day in Nepal time, independent of the host TZ.
function nepalDayBoundary(isoDay, endOfDay = false) {
  return new Date(`${isoDay}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${REPORTING_UTC_OFFSET}`);
}

function nepalToday() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORTING_TIMEZONE }).format(new Date());
}

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? nepalDayBoundary(String(value), endOfDay)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid insights date range");
  }
  return date;
}

// Bucket key for a $dateTrunc result, as the Nepal calendar day it starts
// on. Sent as a plain YYYY-MM-DD string because the UTC instant of a
// Nepal midnight is still the previous date in UTC.
export function nepalDateString(dateExpression) {
  return { $dateToString: { format: "%Y-%m-%d", date: dateExpression, timezone: REPORTING_TIMEZONE } };
}

// Resolves a filter's {from,to,range} into concrete boundaries, plus an
// equal-length immediately-preceding window for period-over-period growth.
export function resolveDateRange(filters = {}) {
  const { from, to } = filters;
  const requestedRange = normalizeUpper(filters.range || filters.preset);
  const fallbackTo = nepalDayBoundary(nepalToday(), true);

  if (requestedRange === "ALL") {
    return {
      start: new Date(0),
      end: fallbackTo,
      previousStart: null,
      previousEnd: null,
      isAllTime: true,
    };
  }

  // Midnight 29 days before today's end, i.e. a 30-day window. Nepal has
  // no DST, so fixed-length day arithmetic is exact.
  const fallbackFrom = new Date(fallbackTo.getTime() + 1 - 30 * DAY_MS);

  const start = parseDateBoundary(from, false) || fallbackFrom;
  const end = parseDateBoundary(to, true) || fallbackTo;

  if (start.getTime() > end.getTime()) {
    throw new ApiError(400, "Insights start date cannot be after end date");
  }

  const spanMs = Math.max(DAY_MS, end.getTime() - start.getTime());
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - spanMs);

  return { start, end, previousStart, previousEnd, isAllTime: false };
}

export function growth(current, previous) {
  const currentValue = numberValue(current);
  const previousValue = numberValue(previous);
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

export function percentage(part, whole) {
  const denominator = numberValue(whole);
  if (!denominator) return 0;
  return (numberValue(part) / denominator) * 100;
}
