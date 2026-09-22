import Counter from "../models/Counter.model.js";

// Two never-reset sequences, one per document family. Assigned lazily by
// order.service.js's ensureProformaInvoiceMetadata() the first time a
// Proforma Invoice is actually generated for an order (not at creation
// or verification), so the sequence reflects the real order PIs were
// produced in. Idempotent - re-generating/re-downloading the same PI
// always shows the same number. The Order Summary PDF reads the same
// order.serialNumber, which stays unset until a PI has been generated.
// Scheme grants are counted separately from commercial orders: their PI is a
// different document (see the SCHEME PROFORMA INVOICE header) and the business
// wants its own run starting at SN1, rather than scheme and sale PIs sharing
// one set of numbers with gaps wherever the other kind fell.
//
// The two runs therefore reuse the same numbers, so they are stored in two
// fields: commercial orders in serialNumber, schemes in schemeSerialNumber.
// Both are unique. Storing a scheme's SN1 in serialNumber collided with the
// commercial SN1 and the scheme's PI failed to generate.
const COUNTER_KEY = Object.freeze({
  ORDER: "orderSerialNumber",
  SCHEME: "schemeOrderSerialNumber",
});

function isSchemeOrigin(orderOrigin) {
  return String(orderOrigin || "").toUpperCase() === "SCHEME";
}

// The field an order's PI number is written to.
export function serialFieldFor(orderOrigin) {
  return isSchemeOrigin(orderOrigin) ? "schemeSerialNumber" : "serialNumber";
}

// The number an order's PI shows. Scheme SNs assigned before they had their
// own field (staging only; production never had one) still sit in
// serialNumber, so a scheme falls back to it rather than being renumbered.
export function displaySerialNumber(order) {
  if (!order) return null;
  if (isSchemeOrigin(order.orderOrigin)) return order.schemeSerialNumber ?? order.serialNumber ?? null;
  return order.serialNumber ?? null;
}

export async function getNextOrderSerialNumber({ session, orderOrigin = "" } = {}) {
  const key = String(orderOrigin).toUpperCase() === "SCHEME" ? COUNTER_KEY.SCHEME : COUNTER_KEY.ORDER;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return counter.seq;
}
