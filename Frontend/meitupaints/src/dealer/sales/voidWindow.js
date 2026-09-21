// A dealer may undo their own sale for one day after recording it, then the
// record is final. Mirrors VOID_WINDOW_MS in Server/src/services/sale.service.js
// - the server is what actually enforces it; this exists so the UI stops
// offering an action it knows will be refused.
//
// Measured from saleDate, which the server stamps itself when the sale is
// recorded (it is not client-supplied), so this really is "one day after it
// was recorded".
export const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

export function voidDeadline(sale) {
  const recorded = new Date(sale?.saleDate || sale?.createdAt || 0).getTime();
  return Number.isFinite(recorded) && recorded > 0 ? recorded + VOID_WINDOW_MS : 0;
}

export function canDealerVoid(sale, now = Date.now()) {
  if (sale?.status !== "COMPLETED") return false;
  const deadline = voidDeadline(sale);
  return deadline > 0 && now < deadline;
}

// Short, human phrasing for how long is left - shown next to the void form so
// the dealer knows this is time-limited before they rely on it.
export function voidTimeLeftLabel(sale, now = Date.now()) {
  const msLeft = voidDeadline(sale) - now;
  if (msLeft <= 0) return "";
  const hours = Math.floor(msLeft / 3600000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left to undo this`;
  const minutes = Math.max(1, Math.floor(msLeft / 60000));
  return `${minutes} minute${minutes === 1 ? "" : "s"} left to undo this`;
}
