import { z } from "zod";
import { objectIdSchema, optionalTrimmedString } from "./common.validation.js";

const moneySchema = z.coerce.number().min(0).max(100000000);
const quantitySchema = z.coerce.number().positive().max(1000000);

const optionalObjectIdSchema = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const orderItemSchema = z
  .object({
    productId: optionalObjectIdSchema,
    sku: optionalTrimmedString(120),
    code: optionalTrimmedString(120),
    name: z.string().trim().min(1).max(240),
    category: optionalTrimmedString(120),
    variantLabel: optionalTrimmedString(160),
    packLabel: optionalTrimmedString(160),
    quantity: quantitySchema,
    qty: quantitySchema.optional(),
    unit: optionalTrimmedString(40),
    unitPrice: moneySchema,
    rate: moneySchema.optional(),
    lineTotal: moneySchema.optional(),
    amount: moneySchema.optional(),
    notes: optionalTrimmedString(300),
  })
  .strict();

export const orderTotalsSchema = z
  .object({
    subtotal: moneySchema.optional(),
    discount: moneySchema.optional(),
    taxableAmount: moneySchema.optional(),
    tax: moneySchema.optional(),
    total: moneySchema.optional(),
    currency: z.string().trim().toUpperCase().max(8).optional(),
  })
  .strict();

const orderPaymentObjectSchema = z
  .object({
    method: z.string().trim().min(1).max(80),
    reference: optionalTrimmedString(160),
    referenceNo: optionalTrimmedString(160),
    note: optionalTrimmedString(300),
  })
  .strict();

export const orderPaymentSchema = orderPaymentObjectSchema
  .transform((payment) => ({
    method: payment.method,
    reference: payment.reference || payment.referenceNo || "",
    note: payment.note || "",
  }));

export const optionalOrderPaymentSchema = orderPaymentObjectSchema
  .partial()
  .optional()
  .transform((payment) => {
    if (!payment) return undefined;
    return {
      method: payment.method || "",
      reference: payment.reference || payment.referenceNo || "",
      note: payment.note || "",
    };
  });

export const createOrderBodySchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100),
    totals: orderTotalsSchema.optional(),
    payment: orderPaymentSchema,
    dealerNote: optionalTrimmedString(1000),
    internalNote: optionalTrimmedString(1000),
  })
  .strict();

export const amendOrderBodySchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100).optional(),
    totals: orderTotalsSchema.optional(),
    payment: optionalOrderPaymentSchema,
    dealerNote: optionalTrimmedString(1000),
    internalNote: optionalTrimmedString(1000),
    reviewNote: optionalTrimmedString(1000),
    reason: optionalTrimmedString(500),
    note: optionalTrimmedString(1000),
  })
  .strict();

export const orderReviewBodySchema = z
  .object({
    reviewNote: optionalTrimmedString(1000),
    internalNote: optionalTrimmedString(1000),
    reason: optionalTrimmedString(500),
    note: optionalTrimmedString(1000),
  })
  .strict();

export const adminOrderListQuerySchema = z
  .object({
    status: optionalTrimmedString(40),
    archive: z.enum(["true", "false"]).optional(),
    q: optionalTrimmedString(120),
    fulfillmentMode: z.enum(["FACTORY", "DISPATCHER", "factory", "dispatcher"]).optional(),
    dealerId: objectIdSchema.optional(),
    dispatcherId: objectIdSchema.optional(),
    orderOrigin: z
      .enum([
        "DEALER",
        "DISPATCHER_REPLENISHMENT",
        "dealer",
        "dispatcher_replenishment",
      ])
      .optional(),
    from: optionalTrimmedString(40),
    to: optionalTrimmedString(40),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const dealerPaymentBodySchema = z
  .object({
    method: z.string().trim().min(1).max(80),
    amount: moneySchema,
    proofUrl: optionalTrimmedString(500),
    note: optionalTrimmedString(300),
  })
  .strict();

export const hardDeleteOrderBodySchema = z
  .object({
    confirmation: z.string().trim().min(1).max(120),
    reason: optionalTrimmedString(500),
  })
  .strict();

export const dispatcherReplenishmentItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: quantitySchema,
  })
  .strict();

export const createReplenishmentOrderBodySchema = z
  .object({
    items: z.array(dispatcherReplenishmentItemSchema).min(1).max(100),
    paymentMethod: z.string().trim().min(1).max(80),
    note: optionalTrimmedString(1000),
  })
  .strict();
