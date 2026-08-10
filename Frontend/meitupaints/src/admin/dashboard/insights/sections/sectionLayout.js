// Plain constants/helpers shared by the account-keeping sections - kept
// out of sectionShared.jsx (which only exports components) so Fast Refresh
// keeps working there (react-refresh/only-export-components).

// currency is fixed NPR for now - Order.totals.currency is NPR in every
// real record today (see admin.service.js's report building), so this
// mirrors the legacy insights page's own assumption rather than threading
// a currency value through every new endpoint yet.
export const CURRENCY = "NPR";

export function kpiRowStyle() {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 };
}

// auto-fit/minmax rather than a fixed column count so these collapse to a
// single column on their own under the ~768px admin mobile breakpoint -
// per ADMIN_MOBILE_DESIGN_PROMPT.md's "one chart at a time stacked" rule
// for Insights, without needing a second mobile-only component tree.
export function twoColStyle() {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 };
}

export function threeColStyle() {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 };
}
