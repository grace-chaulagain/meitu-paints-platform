import { z } from "zod";
import { objectIdSchema, optionalTrimmedString, trimmedString } from "./common.validation.js";

export const catalogProductIdParamsSchema = z
  .object({
    productId: objectIdSchema,
  })
  .strict();

const sizeEntrySchema = z
  .object({
    size: trimmedString(20),
    points: z.coerce.number().int().positive().max(1000000),
  })
  .strict();

// Shared shape for both create and update - a product is either priced per
// size (sizes required, non-empty) or a flat points value (flatPoints
// required, positive); the two modes are mutually exclusive on the wire,
// mirroring how the model itself only trusts whichever fields match
// pricingMode.
function withPricingModeRefinement(schema) {
  return schema.refine(
    (value) => {
      if (value.pricingMode === "SIZES") return Array.isArray(value.sizes) && value.sizes.length > 0;
      return Number.isFinite(Number(value.flatPoints)) && Number(value.flatPoints) > 0;
    },
    {
      message: "SIZES products need at least one size/points pair; FLAT products need a positive flatPoints value.",
      path: ["pricingMode"],
    },
  );
}

export const createCatalogProductBodySchema = withPricingModeRefinement(
  z
    .object({
      category: trimmedString(120),
      name: trimmedString(160),
      couponType: z.enum(["GOLDEN", "GREEN"]),
      pricingMode: z.enum(["SIZES", "FLAT"]),
      sizes: z.array(sizeEntrySchema).max(20).optional(),
      flatPoints: z.coerce.number().int().positive().max(1000000).optional(),
      rule: optionalTrimmedString(500),
    })
    .strict(),
);

export const updateCatalogProductBodySchema = withPricingModeRefinement(
  z
    .object({
      category: trimmedString(120),
      name: trimmedString(160),
      couponType: z.enum(["GOLDEN", "GREEN"]),
      pricingMode: z.enum(["SIZES", "FLAT"]),
      sizes: z.array(sizeEntrySchema).max(20).optional(),
      flatPoints: z.coerce.number().int().positive().max(1000000).optional(),
      rule: optionalTrimmedString(500),
      isActive: z.boolean().optional(),
    })
    .strict(),
);

export const catalogProductListQuerySchema = z
  .object({
    q: optionalTrimmedString(120),
    category: optionalTrimmedString(120),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();
