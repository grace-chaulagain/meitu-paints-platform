import { asyncHandler } from "../utils/asyncHandler.js";
import * as factoryService from "../services/factory.service.js";

export const getFactoryDashboardController = asyncHandler(async (_req, res) => {
  const item = await factoryService.getFactoryDashboard();
  res.status(200).json({ ok: true, item });
});

export const listFactoryOrdersController = asyncHandler(async (req, res) => {
  const out = await factoryService.listFactoryOrders(req.query || {});
  res.status(200).json({ ok: true, ...out });
});

export const listFactoryDealersController = asyncHandler(async (_req, res) => {
  const out = await factoryService.listVerifiedDealersForFactory();
  res.status(200).json({ ok: true, ...out });
});

export const getFactoryOrderController = asyncHandler(async (req, res) => {
  const item = await factoryService.getFactoryOrder({
    orderId: req.params.orderId,
  });
  res.status(200).json({ ok: true, item });
});

export const markOutForDeliveryController = asyncHandler(async (req, res) => {
  const item = await factoryService.markOutForDelivery({
    orderId: req.params.orderId,
    factoryUser: req.user,
    driverName: req.body.driverName,
    driverPhone: req.body.driverPhone,
    vehicleNumber: req.body.vehicleNumber || "",
    remarks: req.body.remarks || "",
  });
  res.status(200).json({
    ok: true,
    message: "Order marked out for delivery.",
    item,
  });
});

export const markDeliveredController = asyncHandler(async (req, res) => {
  const item = await factoryService.markDelivered({
    orderId: req.params.orderId,
    factoryUser: req.user,
    note: req.body?.note || "",
  });
  res.status(200).json({ ok: true, message: "Order marked delivered.", item });
});

export const rejectFactoryOrderController = asyncHandler(async (req, res) => {
  const item = await factoryService.rejectFactoryOrder({
    orderId: req.params.orderId,
    factoryUser: req.user,
    reason: req.body.reason,
    note: req.body.note || "",
  });
  res.status(200).json({ ok: true, message: "Order rejected.", item });
});

export const amendFactoryOrderController = asyncHandler(async (req, res) => {
  const item = await factoryService.amendFactoryOrder({
    orderId: req.params.orderId,
    factoryUser: req.user,
    items: req.body.items || null,
    reason: req.body.reason,
    note: req.body.note || "",
  });
  res.status(200).json({ ok: true, message: "Order amended.", item });
});

export const updateDispatchPrepController = asyncHandler(async (req, res) => {
  const item = await factoryService.updateDispatchPrep({
    orderId: req.params.orderId,
    factoryUser: req.user,
    patch: req.body,
  });
  res.status(200).json({ ok: true, item });
});

export const getProformaInvoiceController = asyncHandler(async (req, res) => {
  const item = await factoryService.getProformaInvoice({
    orderId: req.params.orderId,
  });
  res.status(200).json({ ok: true, item });
});

export const issueFactoryInvoiceController = asyncHandler(async (req, res) => {
  const item = await factoryService.issueFactoryInvoice({
    orderId: req.params.orderId,
    factoryUser: req.user,
  });
  res.status(200).json({ ok: true, message: "Invoice issued.", item });
});
