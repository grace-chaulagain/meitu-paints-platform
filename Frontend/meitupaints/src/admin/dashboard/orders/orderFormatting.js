import { normalizeStatus, ORDER_STATUS_META } from "../../../dealer/orderDetailLogic.js";

export function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

export function adminOrderStatusMeta(status) {
  const normalized = normalizeStatus(status);
  const base = ORDER_STATUS_META[normalized] || { label: normalized || "—", tone: "neutral", live: false };
  if (normalized === "VERIFIED" || normalized === "DISPATCHED") {
    return { ...base, tone: "accent", live: true };
  }
  return base;
}

// Same-day orders get a relative, glanceable timestamp; anything older shows
// its actual calendar date instead of an ever-growing "N days/months ago"
// count, which reads as stale and imprecise past the first day.
export function formatOrderDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatFullDateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
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

// Day-grouping visual pieces mirror src/dealer/DealerOrdersPage.jsx's design
// exactly (same class-naming convention, "admin-order-*" instead of
// "dealer-order-*") - shared by AdminOrdersPage.jsx's fleet-wide list (many
// dealers, server-paginated, so grouping-by-day only groups within the
// current page of results) and AdminDealerOrdersPage.jsx's single-dealer list.
export function groupOrdersByDay(orders) {
  const groups = [];
  const indexByKey = new Map();

  orders.forEach((order) => {
    const key = formatDayKey(order.createdAt);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        relativeLabel: formatRelativeDayLabel(order.createdAt),
        dateText: formatDayDate(order.createdAt),
        orders: [],
      });
    }
    groups[indexByKey.get(key)].orders.push(order);
  });

  return groups;
}
