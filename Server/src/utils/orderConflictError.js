import ApiError from "./apiError.js";
import Order from "../models/Order.model.js";

// Builds the ORDER_STATE_CONFLICT ApiError every order-transition guard
// throws instead of a bare message - lets the frontend refetch and show
// "Already verified by the Admin, 2 min ago" instead of the generic
// "Action failed." for what is really just stale client data (Part 5.2 of
// ORDER_STATE_HANDLING_REPORT.md). `order` must be the FRESHEST copy
// available: callers past an optimistic-concurrency miss
// (findOneAndUpdate returned null) have a stale in-memory `order` by
// definition - use buildOrderConflictErrorFresh there instead.
export function buildOrderConflictError(order, { status = 409, message = "Order state has changed" } = {}) {
  return new ApiError(status, message, {
    code: "ORDER_STATE_CONFLICT",
    currentStatus: order?.status || null,
    reviewedByRole: order?.review?.reviewedByRole || null,
    changedAt:
      order?.review?.reviewedAt ||
      order?.factory?.sentToFactoryAt ||
      order?.factory?.outForDeliveryAt ||
      order?.factory?.deliveredAt ||
      null,
  });
}

// The in-memory `order` at an optimistic-concurrency miss is stale by
// construction (that's why the compare-and-set missed) - re-fetch the
// current state for accurate enrichment instead of reporting stale data.
export async function buildOrderConflictErrorFresh(orderId, opts) {
  const fresh = await Order.findById(orderId).select("status review factory").lean();
  return buildOrderConflictError(fresh, opts);
}
