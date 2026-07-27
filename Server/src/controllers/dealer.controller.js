import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";

import * as dealerService from "../services/dealer.service.js";
import { createDealerOrder } from "../services/dealer.service.js";
import * as dealerInventoryService from "../services/dealerInventory.service.js";
import * as saleService from "../services/sale.service.js";

export async function createDealerOrderController(req, res, next) {
  try {
    const { items, paymentMethod, dealerNote } = req.body;

    const order = await createDealerOrder({
      dealerId: req.user.dealerId,
      userId: req.user._id || req.user.id || req.user.sub,
      items,
      paymentMethod,
      dealerNote,
    });

    res.status(201).json({
      ok: true,
      message: "Order placed successfully.",
      order,
    });
  } catch (error) {
    next(error);
  }
}

// Public: Dealer application
export const applyForDealershipController = asyncHandler(async (req, res) => {
  const out = await dealerService.applyForDealership(req.body || {});
  res.status(201).json({ ok: true, ...out });
});

export const verifyDealerEmailController = asyncHandler(async (req, res) => {
  const out = await dealerService.verifyDealerApplicationEmail({ token: req.body.token });
  res.status(200).json({ ok: true, ...out });
});

export const resendDealerVerificationController = asyncHandler(async (req, res) => {
  const out = await dealerService.resendDealerApplicationVerification({ email: req.body.email });
  res.status(200).json(out);
});

export const checkDealerEmailAvailabilityController = asyncHandler(async (req, res) => {
  const out = await dealerService.checkDealerEmailAvailability(req.query.email);
  res.status(200).json({ ok: true, ...out });
});

// Dealer: profile
export const getMyProfileController = asyncHandler(async (req, res) => {
  const out = await dealerService.getMyProfile({ user: req.user });
  res.status(200).json({ ok: true, item: out });
});

export const updateMyProfileController = asyncHandler(async (req, res) => {
  await dealerService.updateMyProfile({
    user: req.user,
    patch: req.body || {},
  });
  res.status(200).json({ ok: true });
});

// Dealer: orders
export const listMyOrdersController = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query || {};
  const out = await dealerService.listMyOrders({
    user: req.user,
    status,
    q: req.query.q,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

export const getMyOrderStatementsReportController = asyncHandler(
  async (req, res) => {
    const { from, to, status = "", minTotal = "", maxTotal = "" } =
      req.query || {};

    const out = await dealerService.getMyOrderStatementsReport({
      user: req.user,
      from,
      to,
      status,
      minTotal,
      maxTotal,
    });

    res.status(200).json({ ok: true, item: out });
  },
);

export const getMyOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const out = await dealerService.getMyOrder({ user: req.user, orderId });
  res.status(200).json({ ok: true, item: out });
});

export const createOrderController = asyncHandler(async (req, res) => {
  const out = await dealerService.createOrder({
    user: req.user,
    payload: req.body || {},
  });
  res.status(201).json({ ok: true, ...out });
});

// Dealer: payments
export const submitPaymentController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const out = await dealerService.submitPayment({
    user: req.user,
    orderId,
    payload: req.body || {},
  });
  res.status(201).json({ ok: true, ...out });
});

export const listMyPaymentsController = asyncHandler(async (req, res) => {
  const { status, orderId, page, limit } = req.query || {};
  const out = await dealerService.listMyPayments({
    user: req.user,
    status,
    orderId,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

export const getMyOrderOutstandingController = asyncHandler(
  async (req, res) => {
    const { orderId } = req.params || {};
    if (!orderId) throw new ApiError(400, "Missing orderId");

    const out = await dealerService.getMyOrderOutstanding({
      user: req.user,
      orderId,
    });
    res.status(200).json({ ok: true, ...out });
  },
);

// Dealer: inventory
export const listMyInventoryController = asyncHandler(async (req, res) => {
  const { q, category, status, sort, page, limit } = req.query || {};
  const out = await dealerInventoryService.listDealerStock({
    dealerId: req.user.dealerId,
    q,
    category,
    status,
    sort,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

export const getMyInventoryItemController = asyncHandler(async (req, res) => {
  const { productId } = req.params || {};
  if (!productId) throw new ApiError(400, "Missing productId");

  const item = await dealerInventoryService.getDealerStockItem({
    dealerId: req.user.dealerId,
    productId,
  });
  res.status(200).json({ ok: true, item });
});

export const getMyInventoryMovementsController = asyncHandler(async (req, res) => {
  const { productId } = req.params || {};
  if (!productId) throw new ApiError(400, "Missing productId");

  const { type, from, to, page, limit } = req.query || {};
  const out = await dealerInventoryService.getDealerStockMovements({
    dealerId: req.user.dealerId,
    productId,
    type,
    from,
    to,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

export const getMyInventoryHistoryController = asyncHandler(async (req, res) => {
  const { q, type, from, to, sort, page, limit } = req.query || {};
  const out = await dealerInventoryService.getDealerStockHistory({
    dealerId: req.user.dealerId,
    q,
    type,
    from,
    to,
    sort,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

// Dealer: sales
export const listMySalesController = asyncHandler(async (req, res) => {
  const { q, status, dateFrom, dateTo, page, limit } = req.query || {};
  const out = await saleService.listSales({
    dealerId: req.user.dealerId,
    q,
    status,
    dateFrom,
    dateTo,
    page,
    limit,
  });
  res.status(200).json({ ok: true, ...out });
});

export const getMySaleController = asyncHandler(async (req, res) => {
  const { saleId } = req.params || {};
  if (!saleId) throw new ApiError(400, "Missing saleId");

  const item = await saleService.getSale({ dealerId: req.user.dealerId, saleId });
  res.status(200).json({ ok: true, item });
});

export const createMySaleController = asyncHandler(async (req, res) => {
  const { billId, projectId, items, payment, notes } = req.body || {};
  const item = await saleService.createSale({
    dealerId: req.user.dealerId,
    billId,
    projectId,
    items,
    payment,
    notes,
    actorUser: req.user,
  });
  res.status(201).json({ ok: true, item });
});

export const voidMySaleController = asyncHandler(async (req, res) => {
  const { saleId } = req.params || {};
  if (!saleId) throw new ApiError(400, "Missing saleId");

  const { reason } = req.body || {};
  const item = await saleService.voidSale({
    dealerId: req.user.dealerId,
    saleId,
    reason,
    actorUser: req.user,
    actorRole: "DEALER",
  });
  res.status(200).json({ ok: true, item });
});
