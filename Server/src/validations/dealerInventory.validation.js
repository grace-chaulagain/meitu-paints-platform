import { z } from "zod";
import { optionalTrimmedString } from "./common.validation.js";

export const inventoryListQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    category: optionalTrimmedString(120),
    status: z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
    sort: z.enum(["name", "stock-asc", "stock-desc", "value-desc", "recent"]).optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    // When provided, purchase/sales totals are recomputed from the
    // InventoryMovement ledger within this window instead of each product's
    // lifetime running totals - see listDealerStock.
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export const inventoryMovementsQuerySchema = z
  .object({
    type: z.enum(["ALL", "PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const inventoryHistoryQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    type: z.enum(["ALL", "PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
