import mongoose from "mongoose";

// Singleton document, same pattern as CouponRewardSettings.model.js.
//
// Which points the painter portal counts. Nepal's fiscal year runs Shrawan to
// Ashad, and no Bikram Sambat calendar exists anywhere in this codebase, so
// the window is set by an admin once a year rather than computed - the dates
// are then exactly what the business says they are, with no converter to
// trust and no drift.
//
// While no window is set the portal counts every point a painter has ever
// earned and says so, rather than silently showing zero.
const PainterPortalSettingsSchema = new mongoose.Schema(
  {
    // What the painter sees, e.g. "2083/84". Free text on purpose: it is a
    // label, not a date the server computes anything from.
    fiscalYearLabel: { type: String, trim: true, default: "" },
    fiscalYearStart: { type: Date, default: null },
    fiscalYearEnd: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("PainterPortalSettings", PainterPortalSettingsSchema);
