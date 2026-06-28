import { z } from "zod";
import { objectIdSchema, optionalTrimmedString } from "./common.validation.js";

export const factoryOrderParamsSchema = z
  .object({
    orderId: objectIdSchema,
  })
  .strict();

export const factoryOrderListQuerySchema = z
  .object({
    stage: z
      .enum(["ALL", "INBOX", "PREPARING", "SHIPMENT", "COMPLETED", "all", "inbox", "preparing", "shipment", "completed"])
      .optional(),
    status: optionalTrimmedString(40),
    q: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const factoryPrepareOrderBodySchema = z
  .object({
    note: optionalTrimmedString(1000),
  })
  .strict();

export const factoryShipmentBodySchema = z
  .object({
    driverName: z.string().trim().min(2).max(160),
    driverPhone: z.string().trim().min(5).max(80),
    remarks: optionalTrimmedString(1000),
  })
  .strict();

export const factoryDeliveryBodySchema = z
  .object({
    note: optionalTrimmedString(1000),
  })
  .strict();

export const factoryRejectBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    note: optionalTrimmedString(1000),
  })
  .strict();

export const factoryAmendBodySchema = z
  .object({
    items: z.array(z.object({}).passthrough()).min(1).max(100).optional(),
    reason: z.string().trim().min(3).max(500),
    note: optionalTrimmedString(1000),
  })
  .passthrough();
