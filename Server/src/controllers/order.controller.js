import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";

import * as orderService from "../services/order.service.js";

// ----------------------------
// Dealer submits order
// ----------------------------

export const createOrderController = asyncHandler(async (req, res) => {
  const {
    items,
    totals = {},
    payment = {},
    dealerNote = "",
    internalNote = "",
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one order item is required");
  }

  const item = await orderService.createOrder({
    actorUser: req.user,
    items,
    totals,
    payment,
    dealerNote,
    internalNote,
  });

  res.status(201).json({
    ok: true,
    message: "Order submitted successfully.",
    item,
  });
});

// ----------------------------
// Scoped list for admin / dealer / dispatcher
// ----------------------------

export const listOrdersController = asyncHandler(async (req, res) => {
  const { status, archive, q, fulfillmentMode, dispatcherId, page, limit } =
    req.query || {};

  const out = await orderService.listOrdersForActor({
    actorUser: req.user,
    status,
    archive,
    q,
    fulfillmentMode,
    dispatcherId,
    page,
    limit,
  });

  res.status(200).json({
    ok: true,
    ...out,
  });
});

// ----------------------------
// Single order
// ----------------------------

export const getOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const item = await orderService.getOrderForActor({
    orderId,
    actorUser: req.user,
  });

  res.status(200).json({
    ok: true,
    item,
  });
});

// ----------------------------
// Amend order
// ----------------------------

export const amendOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const {
    items,
    totals = {},
    payment,
    dealerNote,
    internalNote,
    reason = "",
    note = "",
  } = req.body || {};

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const item = await orderService.amendOrder({
    orderId,
    actorUser: req.user,
    items,
    totals,
    payment,
    dealerNote,
    internalNote,
    reason,
    note,
  });

  res.status(200).json({
    ok: true,
    message: "Order amended successfully.",
    item,
  });
});

// ----------------------------
// Verify order
// ----------------------------

export const verifyOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const { reviewNote = "" } = req.body || {};

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const item = await orderService.verifyOrder({
    orderId,
    actorUser: req.user,
    reviewNote,
  });

  res.status(200).json({
    ok: true,
    message: "Order verified successfully.",
    item,
  });
});

// ----------------------------
// Reject order
// ----------------------------

export const rejectOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const { reviewNote = "", reason = "", note = "" } = req.body || {};

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const item = await orderService.rejectOrder({
    orderId,
    actorUser: req.user,
    reviewNote: reviewNote || reason || note,
  });

  res.status(200).json({
    ok: true,
    message: "Order rejected successfully.",
    item,
  });
});
