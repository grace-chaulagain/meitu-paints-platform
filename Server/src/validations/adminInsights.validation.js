import { z } from "zod";

// `range`/`preset` stay loose strings rather than a tight enum: the actual
// preset-to-concrete-date resolution happens client-side (matching the
// legacy insights page's convention) - resolveDateRange() only special-
// cases "ALL", everything else falls through to explicit from/to parsing.
export const insightsDateRangeQuerySchema = z
  .object({
    range: z.string().trim().max(20).optional(),
    preset: z.string().trim().max(20).optional(),
    from: z.string().trim().max(40).optional(),
    to: z.string().trim().max(40).optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
    // Entity scope from the workspace's Route/Dealer pickers. Mirrors the
    // admin orders list vocabulary; DISPATCHER_REPLENISHMENT is not
    // accepted because those orders are excluded from revenue/AR views.
    fulfillmentMode: z.enum(["FACTORY", "DISPATCHER"]).optional(),
    dispatcherId: z.string().trim().max(40).optional(),
    dealerId: z.string().trim().max(40).optional(),
  })
  .strict();

export const insightsTrendQuerySchema = insightsDateRangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// Payments ledger listing. Kept separate from the date-range schema (which
// is .strict()) because this view filters on payment-specific fields.
export const paymentsListQuerySchema = z
  .object({
    range: z.string().trim().max(20).optional(),
    preset: z.string().trim().max(20).optional(),
    from: z.string().trim().max(40).optional(),
    to: z.string().trim().max(40).optional(),
    method: z.string().trim().max(30).optional(),
    status: z.string().trim().max(30).optional(),
    dealerId: z.string().trim().max(40).optional(),
    dispatcherId: z.string().trim().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

export const partyDuesQuerySchema = z
  .object({
    settled: z.string().trim().max(10).optional(),
  })
  .strict();

export const allocationPreviewQuerySchema = z
  .object({
    partyType: z.enum(["DEALER", "DISPATCHER"]),
    partyId: z.string().trim().min(1).max(40),
    amount: z.coerce.number().positive(),
  })
  .strict();

export const createPaymentBodySchema = z
  .object({
    partyType: z.enum(["DEALER", "DISPATCHER"]),
    partyId: z.string().trim().min(1).max(40),
    // Omitted/empty means an on-account payment, allocated oldest-first.
    orderId: z.string().trim().max(40).optional(),
    amount: z.coerce.number().positive(),
    method: z.string().trim().min(1).max(30),
    status: z.string().trim().max(30).optional(),
    currency: z.string().trim().max(10).optional(),
    note: z.string().trim().max(200).optional(),
    proofUrl: z.string().trim().max(500).optional(),
    txnId: z.string().trim().max(120).optional(),
    bankName: z.string().trim().max(120).optional(),
    chequeNo: z.string().trim().max(120).optional(),
    receivedDate: z.string().trim().max(40).optional(),
  })
  .strict();

export const inventoryScopeQuerySchema = z
  .object({
    dealerId: z.string().trim().max(40).optional(),
    dispatcherId: z.string().trim().max(40).optional(),
  })
  .strict();

export const stockMovementsQuerySchema = z
  .object({
    tier: z.enum(["factory", "dispatcher", "dealer"]).optional(),
    range: z.string().trim().max(20).optional(),
    preset: z.string().trim().max(20).optional(),
    from: z.string().trim().max(40).optional(),
    to: z.string().trim().max(40).optional(),
    dealerId: z.string().trim().max(40).optional(),
    dispatcherId: z.string().trim().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
