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

export function movementLabel(type) {
  return (
    {
      PURCHASE: "Received from Meitu",
      // Free-of-cost goods from an admin scheme order. These are logged
      // for the record but never enter sellable stock, so the wording
      // must not imply the balance moved - a dealer seeing "+6" against
      // an unchanged balance would reasonably think it was a bug.
      SCHEME: "Scheme goods (not in stock)",
      SALE: "Sold",
      RETURN: "Returned",
      ADJUSTMENT: "Manual adjustment",
      TRANSFER_IN: "Transfer in",
      TRANSFER_OUT: "Transfer out",
    }[type] || type
  );
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

// A movement's "reference" is whatever real record actually caused it - the
// order it was delivered on, the sale it was sold on, or (for adjustments /
// transfers, which have neither) the reason text. Never fabricated.
export function movementReference(movement) {
  if (movement?.orderId?.orderNumber) return movement.orderId.orderNumber;
  if (movement?.saleId?.saleNumber) return movement.saleId.saleNumber;
  if (movement?.reason) return movement.reason;
  return "—";
}

// quantity is the authoritative signed magnitude (see InventoryMovement
// model: positive for PURCHASE/SALE/RETURN/TRANSFER_IN/TRANSFER_OUT with
// direction implied by type, already signed for ADJUSTMENT) - derived from
// type + quantity rather than newQuantity - previousQuantity, since some
// historical/seeded rows have stale balance fields that would otherwise
// silently read as a 0 delta for a real sale or purchase.
export function movementDelta(movement) {
  const magnitude = Number(movement?.quantity || 0);
  if (movement?.type === "ADJUSTMENT") return magnitude;
  const isDebit = movement?.type === "SALE" || movement?.type === "TRANSFER_OUT";
  return isDebit ? -Math.abs(magnitude) : Math.abs(magnitude);
}

// Local-calendar-day grouping key, paired with formatDayHeading below (also
// local-time) - same convention as the factory stock history page's
// localDayKey/formatDayHeading pair, kept as its own copy here rather than a
// shared cross-domain import.
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
