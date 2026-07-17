export function computeStatus(item) {
  const currentQuantity = Number(item?.currentQuantity || 0);
  const lowStockThreshold = Number(item?.lowStockThreshold || 0);
  if (currentQuantity <= 0) return "OUT_OF_STOCK";
  if (lowStockThreshold > 0 && currentQuantity <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export function statusTone(status) {
  if (status === "OUT_OF_STOCK") return "critical";
  if (status === "LOW_STOCK") return "caution";
  return "positive";
}

export function statusLabel(status) {
  if (status === "OUT_OF_STOCK") return "Out of stock";
  if (status === "LOW_STOCK") return "Low stock";
  return "In stock";
}

export function formatMoney(value) {
  const amount = Number(value || 0);
  return `NPR ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function timeAgo(value) {
  if (!value) return "Not moved yet";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

export function categoryLabel(value) {
  if (!value) return "";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Movement helpers below mirror src/dealer/inventory/inventoryHelpers.js's
// equivalents exactly, adapted for DispatcherStockMovement (no saleId - a
// dispatcher's stock only ever moves via a replenishment order coming in or
// an assigned-dealer order going out, both just orderId).
export function movementLabel(type) {
  return (
    {
      REPLENISHMENT_IN: "Received from Factory",
      DISPATCH_OUT: "Dispatched to dealer",
      ADJUSTMENT: "Manual adjustment",
    }[type] || type
  );
}

// quantity is the authoritative signed magnitude (positive for
// REPLENISHMENT_IN, signed as-is for ADJUSTMENT) - derived from type+quantity
// rather than newQuantity-previousQuantity, same convention as the dealer
// helper this mirrors.
export function movementDelta(movement) {
  const magnitude = Number(movement?.quantity || 0);
  if (movement?.type === "ADJUSTMENT") return magnitude;
  return movement?.type === "DISPATCH_OUT" ? -Math.abs(magnitude) : Math.abs(magnitude);
}

export function movementReference(movement) {
  if (movement?.orderId?.orderNumber) return movement.orderId.orderNumber;
  if (movement?.reason) return movement.reason;
  return "—";
}

export function localDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid-date";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayHeading(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatTimeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
