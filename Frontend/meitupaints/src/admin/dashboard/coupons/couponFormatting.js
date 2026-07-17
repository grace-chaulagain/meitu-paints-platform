// Shared constants and formatters for the admin Coupons dashboard (page
// orchestrator + tabs/* + AdminCouponBatchDetailPage.jsx) - centralized here
// so every tab/page resolves money, dates, and coupon-type/status labels the
// exact same way instead of hand-redefining them per file.

export const TYPE_OPTIONS = [
  { key: "GOLDEN", label: "Golden Coupon" },
  { key: "GREEN", label: "Green Coupon" },
];

export const HISTORY_TYPE_OPTIONS = [{ key: "ALL", label: "All types" }, ...TYPE_OPTIONS];

export const COUPON_TABS = [
  { key: "generate", label: "Generate", subtitle: "Create batches", icon: "plus" },
  { key: "catalog", label: "Catalog", subtitle: "Reward rules", icon: "package" },
  { key: "coupons", label: "Batches", subtitle: "Generated sets", icon: "invoice" },
  { key: "history", label: "Redeemed", subtitle: "Coupon history", icon: "history" },
  { key: "attempts", label: "Security", subtitle: "Scan audit", icon: "shield" },
  { key: "settlement", label: "Payouts", subtitle: "Dealer payouts", icon: "chart" },
];

export const PRICING_MODE_OPTIONS = [
  { key: "SIZES", label: "Priced by size" },
  { key: "FLAT", label: "Flat points" },
];

export const CATALOG_CATEGORY_ALL_OPTION = { key: "ALL", label: "All categories" };

export const OUTCOME_OPTIONS = [
  { key: "ALL", label: "All outcomes" },
  { key: "SUCCESS", label: "Success" },
  { key: "INVALID", label: "Invalid" },
  { key: "EXPIRED", label: "Expired" },
  { key: "ALREADY_REDEEMED", label: "Already redeemed" },
  { key: "DEALER_NOT_APPROVED", label: "Dealer not approved" },
];

export const COUPON_DATE_PRESETS = [
  { key: "ALL", label: "All time" },
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "Last 7 days" },
  { key: "30D", label: "Last 30 days" },
  { key: "MONTH", label: "This month" },
  { key: "CUSTOM", label: "Custom range…" },
];

export const PAGE_SIZE = 20;

export function outcomeTone(outcome) {
  if (outcome === "SUCCESS") return "positive";
  if (outcome === "ALREADY_REDEEMED") return "critical";
  return "caution";
}

export function couponStatusTone(status) {
  if (status === "REDEEMED") return "positive";
  if (status === "EXPIRED") return "caution";
  return "neutral";
}

export function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDateOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTimeOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function endOfDayIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function resolveCouponDateRange(preset, customFrom, customTo) {
  const now = new Date();
  let from = "";
  let to = "";

  if (preset === "TODAY") {
    from = toDateInputValue(now);
    to = toDateInputValue(now);
  } else if (preset === "7D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    from = toDateInputValue(start);
    to = toDateInputValue(now);
  } else if (preset === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    from = toDateInputValue(start);
    to = toDateInputValue(now);
  } else if (preset === "MONTH") {
    from = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
    to = toDateInputValue(now);
  } else if (preset === "CUSTOM") {
    from = customFrom || "";
    to = customTo || "";
  }

  return {
    from: startOfDayIso(from),
    to: endOfDayIso(to),
  };
}

function formatDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatRelativeDayLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (formatDayKey(date) === formatDayKey(today)) return "Today";
  if (formatDayKey(date) === formatDayKey(yesterday)) return "Yesterday";
  return null;
}

export function groupRedemptionsByDay(items) {
  const groups = [];
  const indexByKey = new Map();

  items.forEach((item) => {
    const key = formatDayKey(item.redeemedAt);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        relativeLabel: formatRelativeDayLabel(item.redeemedAt),
        dateText: formatDayDate(item.redeemedAt),
        items: [],
      });
    }
    groups[indexByKey.get(key)].items.push(item);
  });

  return groups;
}

export function couponTypeLabel(type) {
  return type === "GOLDEN" ? "Golden Coupon" : "Green Coupon";
}

export function redeemedPainterName(row) {
  if (row?.painterId?.name) return row.painterId.name;
  return "—";
}

export function redeemedDealerName(row) {
  return row?.dealerId?.companyName || row?.dealerId?.contactName || "Unknown dealer";
}

// Human label for a redemption that withheld painter points - covers every
// POINTS_SKIP_REASON value (Server/src/constants/coupon.js), not just
// expiry, so any new skip path added there stays auditable here too.
const SKIP_REASON_LABELS = {
  EXPIRED: "Expired — no points",
  RTP_GOLDEN_CASH_ONLY: "Golden cash-only — no points",
  RTP_UNREGISTERED_CASH_ONLY: "No profile — no points",
  TTP_NO_ID_CASH_ONLY: "No ID — no points",
};

export function skipReasonPillLabel(skipReason) {
  return SKIP_REASON_LABELS[skipReason] || "No points";
}

// Rendering (SVG+PNG per coupon) is the bulk of the work for a large batch,
// so it fills the first 90% of the bar; JSZip's own compression pass (the
// "zip" phase) fills the last 10% - keeps the bar moving smoothly through
// both phases instead of jumping/stalling between them.
export function exportProgressPercent(progress) {
  if (!progress) return 0;
  if (progress.phase === "zip") return 90 + Math.round(Math.min(100, Math.max(0, progress.percent || 0)) * 0.1);
  if (progress.phase === "render" && progress.total) {
    return Math.round((progress.done / progress.total) * 90);
  }
  return 0;
}

export function exportProgressLabel(progress) {
  if (!progress) return "Preparing…";
  if (progress.phase === "zip") return `Compressing ZIP · ${progress.percent || 0}%`;
  if (progress.phase === "render") return `Rendering ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} coupons`;
  return "Preparing…";
}

// Same progress shape as exportProgressPercent/Label above, but for
// downloadCouponPrintPdf (couponPrintPdf.jsx), which has an extra "pdf"
// assembly phase between rendering fronts and compressing the final zip -
// kept as separate functions so its phase weights don't disturb the
// already-tuned percentages of the plain SVG/PNG ZIP export.
export function pdfExportProgressPercent(progress) {
  if (!progress) return 0;
  if (progress.phase === "zip") return 90 + Math.round(Math.min(100, Math.max(0, progress.percent || 0)) * 0.1);
  if (progress.phase === "pdf") return 88;
  if (progress.phase === "render" && progress.total) {
    return Math.round((progress.done / progress.total) * 85);
  }
  return 0;
}

export function pdfExportProgressLabel(progress) {
  if (!progress) return "Preparing…";
  if (progress.phase === "zip") return `Compressing ZIP · ${progress.percent || 0}%`;
  if (progress.phase === "pdf") return "Assembling PDF…";
  if (progress.phase === "render") return `Rendering ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} coupons`;
  return "Preparing…";
}
