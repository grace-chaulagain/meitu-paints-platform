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
const COUNTER_KEY = Object.freeze({
  ORDER: "orderSerialNumber",
  SCHEME: "schemeOrderSerialNumber",
});

export async function getNextOrderSerialNumber({ session, orderOrigin = "" } = {}) {
  const key = String(orderOrigin).toUpperCase() === "SCHEME" ? COUNTER_KEY.SCHEME : COUNTER_KEY.ORDER;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return counter.seq;
}
