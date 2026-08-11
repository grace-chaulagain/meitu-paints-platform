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

export const listSchemeOrdersQuerySchema = z
  .object({
    status: z.string().trim().max(30).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
