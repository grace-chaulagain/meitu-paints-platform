export const STATUS_OPTIONS = [
  { key: "ALL", label: "All statuses" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "SUBMITTED", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ARCHIVED", label: "Archived" },
];

export const ROUTING_OPTIONS = [
  { key: "ALL", label: "All routing" },
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER_ALL", label: "All dispatcher-assigned" },
];

export const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "custom", label: "Custom range…" },
];

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Resolves a date-range preset into concrete from/to values (YYYY-MM-DD).
export function rangeForPreset(preset) {
  if (preset === "all") return { from: "", to: "" };

  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  if (preset === "7d") from.setDate(now.getDate() - 6);
  else if (preset === "90d") from.setDate(now.getDate() - 89);
  else if (preset === "month") from.setDate(1);
  else if (preset === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  } else from.setDate(now.getDate() - 29);

  return { from: isoDate(from), to: isoDate(to) };
}

export function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function number(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

export function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function compactCurrency(value, currency = "NPR") {
  const amount = Number(value || 0);
  if (!amount) return "0";
  const compact = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: amount >= 100000 ? 1 : 0,
  }).format(amount);
  return `${currency} ${compact}`;
}

export function formatTrendLabel(value) {
  const label = String(value || "");
  if (/^\d{4}-\d{2}$/.test(label)) {
    const date = new Date(`${label}-01T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const date = new Date(`${label}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  return label;
}
