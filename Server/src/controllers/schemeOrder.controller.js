import { asyncHandler } from "../utils/asyncHandler.js";
import * as schemeOrderService from "../services/schemeOrder.service.js";

export const listSchemeRecipientsController = asyncHandler(async (_req, res) => {
  const items = await schemeOrderService.listSchemeRecipients();
  res.status(200).json({ ok: true, items });
});

export const listSchemeOrdersController = asyncHandler(async (req, res) => {
  const items = await schemeOrderService.listSchemeOrders(req.query || {});
  res.status(200).json({ ok: true, items });
});

export const createSchemeOrderController = asyncHandler(async (req, res) => {
  const item = await schemeOrderService.createSchemeOrder(req.body || {}, req.user);
  res.status(201).json({ ok: true, item });
});

export const updateSchemeOrderController = asyncHandler(async (req, res) => {
  const item = await schemeOrderService.updateSchemeOrder(
    req.params.orderId,
    req.body || {},
    req.user,
  );
  res.status(200).json({ ok: true, item });
});

export const deleteSchemeOrderController = asyncHandler(async (req, res) => {
  const item = await schemeOrderService.deleteSchemeOrder(req.params.orderId, req.user, {
    reason: req.body?.reason,
  });
  res.status(200).json({ ok: true, item });
});
