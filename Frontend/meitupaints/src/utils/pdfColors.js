// Shared color tokens for every react-pdf document this app produces
// (Proforma Invoice, Order Summary, ...), mirroring the dashboard's own
// design tokens (src/index.css) rather than each PDF inventing its own
// palette. Split out from pdfBrand.jsx (which exports the logo component)
// since a .jsx file with Fast Refresh enabled can only export components.
export const PDF_COLORS = {
  ink: "#1d1d1f",
  graphite: "#6e6e73",
  muted: "#86868b",
  line: "#dddddd",
  lineSoft: "#e2e2e2",
  fog: "#f5f5f7",
  azure: "#0071e3",
  logoGrey: "#aeaeb4",
  // The dashboard's own "critical/important" accent (see Pill's "critical"
  // tone in DashboardUI.jsx) - a deep, restrained brick-red rather than the
  // logo's raw saturated red, used sparingly the same way the rest of the
  // app already does.
  red: "#b42318",
  redSoft: "rgba(180,35,24,.08)",
};
