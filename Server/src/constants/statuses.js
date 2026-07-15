export const STATUSES = Object.freeze({
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
});

export const DEALER_APPLICATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

export const DEALER_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  SUSPENDED: "SUSPENDED",
});

// ORDER_STATUS used to be duplicated here (and had drifted from the real
// enum - it had an extra UNDER_REVIEW member that Order.model.js never
// had). Order.model.js is the single source of truth now; re-exported here
// only so existing `from "../constants/statuses.js"` imports keep working.
export { ORDER_STATUS } from "../models/Order.model.js";

export const PAYMENT_METHOD = Object.freeze({
  CASH: "CASH",
  ONLINE: "ONLINE",
  CHEQUE: "CHEQUE",
  BANK_GUARANTEE: "BANK_GUARANTEE",
  CREDIT: "CREDIT",
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING_DECLARATION: "PENDING_DECLARATION", // method selected but no proof / no check
  PENDING_VERIFICATION: "PENDING_VERIFICATION", // proof uploaded/declared
  VERIFIED: "VERIFIED", // money confirmed
  REJECTED: "REJECTED",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
});

export const SHIPMENT_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  PICKING: "PICKING",
  DISPATCHED: "DISPATCHED",
  DELIVERED: "DELIVERED",
});
