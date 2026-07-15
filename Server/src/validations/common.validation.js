import { z } from "zod";

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

export const trimmedString = (max = 200) =>
  z.string().trim().min(1, "Required").max(max);

export const optionalTrimmedString = (max = 500) =>
  z
    .preprocess(
      (value) => (value === null || value === undefined ? undefined : value),
      z.string().trim().max(max),
    )
    .optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email")
  .max(160);

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone must be at least 7 characters")
  .max(40, "Phone is too long")
  .regex(/^[+0-9().\-\s]+$/, "Phone contains unsupported characters");

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    q: optionalTrimmedString(120),
    status: optionalTrimmedString(40),
    orderId: objectIdSchema.optional(),
  })
  .strict();

export const orderIdParamsSchema = z
  .object({
    orderId: objectIdSchema,
  })
  .strict();

export const productIdParamsSchema = z
  .object({
    productId: objectIdSchema,
  })
  .strict();

export const dealerIdParamsSchema = z
  .object({
    dealerId: objectIdSchema,
  })
  .strict();

export const dealerProductIdParamsSchema = z
  .object({
    dealerId: objectIdSchema,
    productId: objectIdSchema,
  })
  .strict();

export const saleIdParamsSchema = z
  .object({
    saleId: objectIdSchema,
  })
  .strict();
