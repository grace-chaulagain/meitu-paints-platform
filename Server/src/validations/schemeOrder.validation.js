import { z } from "zod";

export const createSchemeOrderBodySchema = z
  .object({
    recipientType: z.enum(["DEALER", "DISPATCHER"]),
    recipientId: z.string().trim().min(1).max(40),
    label: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(40),
            quantity: z.coerce.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

// Every field optional so a caller can rename the campaign without resending
// the basket, or fix the basket without restating the label. `items`, when
// present, replaces the basket wholesale rather than patching it - a partial
// item list would be ambiguous about whether an omitted line was untouched
// or removed.
export const updateSchemeOrderBodySchema = z
  .object({
    label: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(40),
            quantity: z.coerce.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

export const deleteSchemeOrderBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const schemeOrderParamsSchema = z
  .object({
    orderId: z.string().trim().min(1).max(40),
  })
  .strict();

export const listSchemeOrdersQuerySchema = z
  .object({
    status: z.string().trim().max(30).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
