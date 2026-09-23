import { z } from "zod";

const optionalTrimmedString = (max) => z.string().trim().max(max).optional();

export const giftBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    nameNepali: optionalTrimmedString(120),
    pointsRequired: z.coerce.number().int().min(1).max(10_000_000),
    isActive: z.coerce.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strict();

// Every field optional: the gifts table toggles `isActive` on its own, and an
// edit only sends what changed.
export const giftPatchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    nameNepali: optionalTrimmedString(120),
    pointsRequired: z.coerce.number().int().min(1).max(10_000_000).optional(),
    isActive: z.coerce.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const giftIdParamsSchema = z.object({ giftId: z.string().trim().length(24) }).strict();

export const portalSettingsBodySchema = z
  .object({
    fiscalYearLabel: optionalTrimmedString(40),
    // Nullable so an admin can clear the window and go back to counting every
    // point a painter has earned.
    fiscalYearStart: z.coerce.date().nullable().optional(),
    fiscalYearEnd: z.coerce.date().nullable().optional(),
  })
  .strict();

// The portal's single search box. Long enough for a citizenship number,
// short-circuited below 4 characters so a stray keystroke never becomes a
// database query.
export const painterLookupQuerySchema = z
  .object({ q: z.string().trim().min(4).max(60) })
  .strict();
