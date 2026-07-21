// Server-side copy of Frontend/meitupaints/src/utils/pdfColors.js - kept
// in sync by hand (Server and Frontend are independently-installed npm
// packages, no shared workspace to import across). Any palette change to
// the dealer-facing Order Summary PDF should be mirrored here so the copy
// emailed to the factory at verification time matches exactly.
export const PDF_COLORS = {
  ink: "#1d1d1f",
  graphite: "#6e6e73",
  muted: "#86868b",
  line: "#dddddd",
  lineSoft: "#e2e2e2",
  fog: "#f5f5f7",
  azure: "#0071e3",
  logoGrey: "#aeaeb4",
  red: "#b42318",
  redSoft: "rgba(180,35,24,.08)",
};
