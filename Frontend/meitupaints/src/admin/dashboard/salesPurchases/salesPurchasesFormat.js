// Formatting and grouping shared by the dealer and dispatcher Sales &
// Purchases pages and their per-product history pages, so the two sides read
// identically. Lifted unchanged from the dealer pages, which came first.

export function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function stockTone(status) {
  if (status === "OUT_OF_STOCK") return "critical";
  if (status === "LOW_STOCK") return "caution";
  return "positive";
}

export function stockLabel(status) {
  if (status === "OUT_OF_STOCK") return "Out of stock";
  if (status === "LOW_STOCK") return "Low stock";
  return "In stock";
}

export function orderStatusTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  return "accent";
}

export function isoDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Interpreted as a plain calendar date (no time zone shift) since it's
// always a "YYYY-MM-DD" key.
export function formatFilterDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// `to` is inclusive of the whole day (callers pass a "YYYY-MM-DDT23:59:59.999"
// bound), so a single-day range naturally has from === to on the date part.
export function dateRangeLabel(from, to) {
  if (!from && !to) return "All time";
  if (from && to && from === to) return formatFilterDate(from);
  if (from && to) return `${formatFilterDate(from)} – ${formatFilterDate(to)}`;
  if (from) return `From ${formatFilterDate(from)}`;
  return `Until ${formatFilterDate(to)}`;
}

// The query params a date range becomes: the exact first and last moment of
// the chosen days in the admin's own time zone (Nepal for these admins), sent
// as UTC instants. A bare date would be read by the server as a UTC day, which
// starts at 5:45 AM in Nepal - so early-morning orders slid into the day before.
function localDayBound(key, endOfDay) {
  const [year, month, day] = String(key).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day, 0, 0, 0, 0);
  return date.toISOString();
}

export function dateRangeParams(from, to) {
  return {
    from: from ? localDayBound(from, false) : undefined,
    to: to ? localDayBound(to, true) : undefined,
  };
}

export function formatDayHeading(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatShortDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatWeekday(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function groupEventsByDay(events) {
  const map = new Map();
  for (const event of events) {
    const key = event.date.toDateString();
    let group = map.get(key);
    if (!group) {
      group = { key, date: event.date, events: [] };
      map.set(key, group);
    }
    group.events.push(event);
  }
  return Array.from(map.values());
}

export function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) result.push("ellipsis-" + p);
    result.push(p);
    prev = p;
  });
  return result;
}

// Category-then-name order, plus the group header each category's first row
// carries - DataTable draws a header only on that first row.
export function sortByCategoryThenName(rows) {
  return [...rows].sort((a, b) => {
    const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
    return catCompare !== 0 ? catCompare : (a.name || "").localeCompare(b.name || "");
  });
}

export function categoryHeadersByFirstRow(sortedRows, getKey = (row) => row.productId) {
  const counts = new Map();
  for (const row of sortedRows) counts.set(row.category, (counts.get(row.category) || 0) + 1);
  const map = new Map();
  let lastCategory = null;
  for (const row of sortedRows) {
    if (row.category !== lastCategory) {
      map.set(getKey(row), { label: categoryLabel(row.category), count: counts.get(row.category) });
      lastCategory = row.category;
    }
  }
  return map;
}

export function dayHeadersByFirstEvent(visibleEvents) {
  const counts = new Map();
  for (const event of visibleEvents) {
    const dayKey = event.date.toDateString();
    counts.set(dayKey, (counts.get(dayKey) || 0) + 1);
  }
  const map = new Map();
  let lastDay = null;
  for (const event of visibleEvents) {
    const dayKey = event.date.toDateString();
    if (dayKey !== lastDay) {
      map.set(event.key, { label: formatDayHeading(event.date), count: counts.get(dayKey) });
      lastDay = dayKey;
    }
  }
  return map;
}
