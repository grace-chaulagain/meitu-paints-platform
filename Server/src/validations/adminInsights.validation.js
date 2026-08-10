import { z } from "zod";

// `range`/`preset` stay loose strings rather than a tight enum: the actual
// preset-to-concrete-date resolution happens client-side (matching the
// legacy insights page's convention) - resolveDateRange() only special-
// cases "ALL", everything else falls through to explicit from/to parsing.
export const insightsDateRangeQuerySchema = z
  .object({
    range: z.string().trim().max(20).optional(),
    preset: z.string().trim().max(20).optional(),
    from: z.string().trim().max(40).optional(),
    to: z.string().trim().max(40).optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
  })
  .strict();

export const insightsTrendQuerySchema = insightsDateRangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
