import mongoose from "mongoose";
import ApiError from "../../utils/apiError.js";
import { PAYMENT_STATUS } from "../../constants/statuses.js";
import { ORDER_STATUS } from "../../models/Order.model.js";

export const DAY_MS = 86400000;

// Orders that count as real, accepted revenue for reporting purposes.
export const ACCEPTED_ORDER_STATUSES = [
  ORDER_STATUS.VERIFIED,
  ORDER_STATUS.DISPATCHED,
  ORDER_STATUS.COMPLETED,
];

// Orders excluded from AR/account-keeping views entirely - a rejected or
// cancelled order was never fulfilled, so it can't carry a real balance.
export const AR_EXCLUDED_ORDER_STATUSES = [
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELLED,
];

// A dispatcher replenishing their own regional stock reuses the Order
// pipeline but isn't a dealer sale - excluded from every revenue/AR view.
export const INTERNAL_ORDER_ORIGINS = ["DISPATCHER_REPLENISHMENT"];

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

// Resolves a filter's {from,to,range} into concrete boundaries, plus an
// equal-length immediately-preceding window for period-over-period growth.
export function resolveDateRange(filters = {}) {
  const { from, to } = filters;
  const requestedRange = normalizeUpper(filters.range || filters.preset);
  const now = new Date();
  const fallbackTo = new Date(now);
  fallbackTo.setHours(23, 59, 59, 999);

  if (requestedRange === "ALL") {
    return {
      start: new Date(0),
      end: fallbackTo,
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
