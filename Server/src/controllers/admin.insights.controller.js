import { asyncHandler } from "../utils/asyncHandler.js";

import * as cashPositionService from "../services/adminInsights/cashPosition.service.js";
import * as reconciliationService from "../services/adminInsights/reconciliation.service.js";
import * as orderAnalyticsService from "../services/adminInsights/orderAnalytics.service.js";
import * as dealerStatementsService from "../services/adminInsights/dealerStatements.service.js";
import * as performanceService from "../services/adminInsights/performance.service.js";

export const getCashPositionController = asyncHandler(async (req, res) => {
  const item = await cashPositionService.getCashPosition(req.query || {});
  res.status(200).json({ ok: true, item });
});

export const getPaymentReconciliationController = asyncHandler(async (req, res) => {
  const [breakdown, queueSummary] = await Promise.all([
    reconciliationService.getPaymentBreakdown(req.query || {}),
    reconciliationService.getVerificationQueueSummary(),
  ]);
  res.status(200).json({ ok: true, item: { breakdown, queueSummary } });
});

export const getOrderAnalyticsController = asyncHandler(async (req, res) => {
  const filters = req.query || {};
  const [trend, statusDistribution, valueDistribution, dayOfWeek, largestOrders] = await Promise.all([
    orderAnalyticsService.getOrderTrend(filters),
    orderAnalyticsService.getOrderStatusDistribution(filters),
    orderAnalyticsService.getOrderValueDistribution(filters),
    orderAnalyticsService.getOrderDayOfWeekPattern(filters),
    orderAnalyticsService.getLargestOrders(filters),
  ]);
  res.status(200).json({
    ok: true,
    item: { trend, statusDistribution, valueDistribution, dayOfWeek, largestOrders },
  });
});

export const getArSummaryController = asyncHandler(async (req, res) => {
  const items = await dealerStatementsService.getArSummaryByDealer();
  res.status(200).json({ ok: true, items });
});

export const getArAgingController = asyncHandler(async (req, res) => {
  const items = await dealerStatementsService.getArAgingBuckets();
  res.status(200).json({ ok: true, items });
});

export const getProductPerformanceController = asyncHandler(async (req, res) => {
  const { limit, ...filters } = req.query || {};
  const item = await performanceService.getProductPerformance(filters, limit);
  res.status(200).json({ ok: true, item });
});

export const getDispatcherPerformanceController = asyncHandler(async (req, res) => {
  const { limit, ...filters } = req.query || {};
  const items = await performanceService.getDispatcherPerformance(filters, limit);
  res.status(200).json({ ok: true, items });
});

export const getRoutingPerformanceController = asyncHandler(async (req, res) => {
  const item = await performanceService.getRoutingPerformance(req.query || {});
  res.status(200).json({ ok: true, item });
});
