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
