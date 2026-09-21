// Meitu's dataviz palette instance (per the `dataviz` skill - "swap for
// your brand's" applied to this app's actual design tokens, validated with
// scripts/validate_palette.js before use, not eyeballed).
//
// Meitu's design system is deliberately single-accent/minimal (DESIGN.md:
// "restrained Apple-blue CTAs"), and every chart here is single-series
// magnitude/trend or a small fixed status/ordinal set - never a multi-
// series identity comparison - so there is no need for (and the skill
// itself recommends against inventing) a full 8-hue categorical palette.
// What's used instead, each substituted for the skill's generic reference
// value with Meitu's own established tokens:
//   - single-hue magnitude/trend marks -> azure (#0071e3), the app's one
//     accent color. Contrast vs the white card surface: 4.70:1 (>= 3:1
//     mark floor). No categorical validation needed for a lone hue.
//   - order-status distribution -> Meitu's EXISTING status tones (already
//     shipped throughout the app via the Pill component in DashboardUI.jsx)
//     rather than the skill's generic status hexes, since this is a
//     genuine state (good/warning/critical) job, not a "series 4".
//     Contrast vs white: positive 5.02:1, critical 6.57:1, caution 5.50:1.
//   - AR aging buckets -> an ordinal, one-hue (azure) ramp, light->dark
//     meaning mild->severe, validated with
//     `node scripts/validate_palette.js "#73a8dd,#4d90d4,#2678ca,#0060c1"
//     --mode light --surface "#ffffff" --ordinal` -> ALL CHECKS PASS
//     (monotone L, adjacent ΔL >= 0.06, light-end contrast 2.51:1 >= 2:1).

export const AZURE = "#0071e3";
export const INK = "#1d1d1f";
export const GRAPHITE = "#707070";
export const GRIDLINE = "#e8e8ed"; // --color-silver-mist - recessive, one step off the white card surface

// Ordinal AR-aging ramp, mild -> severe (validated, see header comment).
export const AR_AGING_RAMP = ["#73a8dd", "#4d90d4", "#2678ca", "#0060c1"];

// Meitu's existing status vocabulary (Pill component tones), reused as-is
// rather than re-derived, mapped onto the six real ORDER_STATUS values.
export const ORDER_STATUS_COLORS = {
  SUBMITTED: "#b64400", // caution - needs review
  VERIFIED: "#0071e3", // accent - in progress
  DISPATCHED: "#0071e3", // accent - in progress
  COMPLETED: "#15803d", // positive
  REJECTED: "#b42318", // critical
  CANCELLED: "#b42318", // critical
};

export function statusColor(status) {
  return ORDER_STATUS_COLORS[status] || GRAPHITE;
}

export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
