import { asyncHandler } from "../utils/asyncHandler.js";
import * as stockService from "../services/stock.service.js";

export const listStockController = asyncHandler(async (req, res) => {
  const out = await stockService.listStock(req.query || {});
  res.status(200).json({ ok: true, ...out });
});

export const getStockDetailController = asyncHandler(async (req, res) => {
  const item = await stockService.getStockDetail({
    productId: req.params.productId,
  });
  res.status(200).json({ ok: true, item });
});

export const getStockHistoryController = asyncHandler(async (req, res) => {
  const out = await stockService.getStockHistory({
    productId: req.params.productId,
    ...(req.query || {}),
  });
  res.status(200).json({ ok: true, ...out });
});

export const updateStockQuantityController = asyncHandler(async (req, res) => {
  const item = await stockService.updateStockQuantity({
    productId: req.params.productId,
    newQuantity: req.body.newQuantity,
    reason: req.body.reason,
    note: req.body.note,
    actorUser: req.user,
  });

  res.status(200).json({
    ok: true,
    message: "Stock updated successfully.",
    item,
  });
});

export const updateStockThresholdController = asyncHandler(async (req, res) => {
  const item = await stockService.updateStockThreshold({
    productId: req.params.productId,
    lowStockThreshold: req.body.lowStockThreshold,
    reason: req.body.reason,
    note: req.body.note,
    actorUser: req.user,
  });

  res.status(200).json({
    ok: true,
    message: "Low stock threshold updated successfully.",
    item,
  });
});
