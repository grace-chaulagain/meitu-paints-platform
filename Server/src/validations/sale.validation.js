import { z } from "zod";
import { objectIdSchema, optionalTrimmedString } from "./common.validation.js";

const quantitySchema = z.coerce.number().positive().max(1000000);

const optionalObjectIdSchema = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const saleItemSchema = z
  .object({
    productId: objectIdSchema,
    sku: optionalTrimmedString(120),
    name: optionalTrimmedString(240),
    packLabel: optionalTrimmedString(160),
    quantity: quantitySchema,
  })
  .strict();

export const createSaleBodySchema = z
  .object({
    billId: z.string().trim().min(1, "Bill ID is required").max(60),
    projectId: optionalObjectIdSchema,
    items: z.array(saleItemSchema).min(1, "At least one item is required"),
    payment: z
      .object({
        method: optionalTrimmedString(40),
        reference: optionalTrimmedString(160),
        note: optionalTrimmedString(500),
      })
      .strict()
      .optional(),
    notes: optionalTrimmedString(500),
  })
  .strict();

export const saleListQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    status: z.enum(["ALL", "COMPLETED", "VOIDED"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const adminSaleListQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    dealerId: optionalObjectIdSchema,
    status: z.enum(["ALL", "COMPLETED", "VOIDED"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    dealerPage: z.coerce.number().int().min(1).max(10000).optional(),
    dealerLimit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const voidSaleBodySchema = z
  .object({
    reason: z.string().trim().min(1, "A void reason is required").max(300),
  })
  .strict();
