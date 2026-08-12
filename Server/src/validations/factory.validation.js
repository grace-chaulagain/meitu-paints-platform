import { z } from "zod";
import { objectIdSchema, optionalTrimmedString } from "./common.validation.js";
// Shared with the admin orders list so the two can't accept different sets
// of origins - see the comment on ORDER_ORIGIN_VALUES there.
import { orderOriginQuerySchema, excludeOriginsQuerySchema } from "./order.validation.js";

export const factoryOrderParamsSchema = z
  .object({
    orderId: objectIdSchema,
  })
  .strict();

export const factoryOrderListQuerySchema = z
  .object({
    stage: z
      .enum(["ALL", "INBOX", "SHIPMENT", "COMPLETED", "all", "inbox", "shipment", "completed"])
      .optional(),
    status: optionalTrimmedString(40),
    origin: orderOriginQuerySchema.optional(),
    excludeOrigins: excludeOriginsQuerySchema.optional(),
    dealerId: objectIdSchema.optional(),
    // Defaults to FACTORY-only in the service (matches the factory kanban's
    // existing behavior) - the Invoice Center is the one caller that passes
    // ALL/DISPATCHER explicitly to see every order regardless of who
    // fulfills it.
    fulfillmentMode: z.enum(["ALL", "FACTORY", "DISPATCHER", "all", "factory", "dispatcher"]).optional(),
    q: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const factoryShipmentBodySchema = z
  .object({
    driverName: z.string().trim().min(2).max(160),
    driverPhone: z.string().trim().min(5).max(80),
    vehicleNumber: optionalTrimmedString(80),
    remarks: optionalTrimmedString(1000),
  })
  .strict();

export const factoryDispatchPrepBodySchema = z
  .object({
    stockConfirmed: z.boolean().optional(),
    packingConfirmed: z.boolean().optional(),
    driverName: optionalTrimmedString(160),
    driverPhone: optionalTrimmedString(80),
    vehicleNumber: optionalTrimmedString(80),
    generateProforma: z.boolean().optional(),
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
