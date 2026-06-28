import { z } from "zod";
import { objectIdSchema, optionalTrimmedString } from "./common.validation.js";

export const stockProductParamsSchema = z
  .object({
    productId: objectIdSchema,
  })
  .strict();

export const stockListQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    category: optionalTrimmedString(120),
    status: z
      .enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "all", "in_stock", "low_stock", "out_of_stock"])
      .optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const stockHistoryQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    reason: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const updateStockBodySchema = z
  .object({
    newQuantity: z.coerce.number().min(0).max(100000000),
    reason: z.string().trim().min(3).max(300),
    note: optionalTrimmedString(1000),
    confirmation: optionalTrimmedString(160),
  })
  .strict();

export const updateStockThresholdBodySchema = z
  .object({
    lowStockThreshold: z.coerce.number().min(0).max(100000000),
    reason: z.string().trim().min(3).max(300),
    note: optionalTrimmedString(1000),
  })
  .strict();

export const bulkStockUpdateBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(300),
    note: optionalTrimmedString(1000),
    changes: z
      .array(
        z
          .object({
            productId: objectIdSchema.optional(),
            sku: optionalTrimmedString(120),
            newQuantity: z.coerce.number().min(0).max(100000000),
          })
          .strict()
          .refine((value) => value.productId || value.sku, {
            message: "Each change requires productId or sku",
          }),
      )
      .min(1)
      .max(500),
  })
  .strict();
