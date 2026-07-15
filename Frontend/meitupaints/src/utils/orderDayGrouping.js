export function formatDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDayDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatRelativeDayLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (formatDayKey(date) === formatDayKey(today)) return "Today";
  if (formatDayKey(date) === formatDayKey(yesterday)) return "Yesterday";
  return null;
}

export function groupOrdersByDay(orders, dateField = "createdAt") {
  const groups = [];
  const indexByKey = new Map();

  orders.forEach((order) => {
    const value = order[dateField];
    const key = formatDayKey(value);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        relativeLabel: formatRelativeDayLabel(value),
        dateText: formatDayDate(value),
        orders: [],
      });
    }
    groups[indexByKey.get(key)].orders.push(order);
  });

  return groups;
}
