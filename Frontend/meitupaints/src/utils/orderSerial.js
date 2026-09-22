// An order's Proforma Invoice serial (the "SN12" printed on its PI), mirroring
// Server/src/utils/orderSerialNumber.js. Commercial orders and scheme grants
// run their own sequences, so the same number can belong to one of each:
// commercial orders keep it in serialNumber, schemes in schemeSerialNumber
// (or, for scheme SNs assigned before that field existed, serialNumber).
// Orders get no SN until their first PI is generated.

function isScheme(order) {
  return String(order?.orderOrigin || "").toUpperCase() === "SCHEME";
}

export function orderSerialNumber(order) {
  if (!order) return null;
  if (isScheme(order)) return order.schemeSerialNumber ?? order.serialNumber ?? null;
  return order.serialNumber ?? null;
}

// Same rule the server applies to a search: "SN12" / "sn 12" / "SN-12" is only
// ever a serial; a bare "12" is a serial too, but may also be part of an order
// number, so the other fields are still searched for it.
export function parseSerialSearch(text) {
  const value = String(text || "").trim();
  const prefixed = /^s\.?\s*n\.?\s*[-#:.]?\s*(\d{1,9})$/i.exec(value);
  if (prefixed) return { number: Number(prefixed[1]), prefixed: true };
  if (/^\d{1,9}$/.test(value)) return { number: Number(value), prefixed: false };
  return null;
}
