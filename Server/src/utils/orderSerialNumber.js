import Counter from "../models/Counter.model.js";

// One global, never-reset sequence. Assigned lazily by
// order.service.js's ensureProformaSerialNumber() the first time a
// Proforma Invoice is actually generated for an order (not at creation
// or verification), so the sequence reflects the real order PIs were
// produced in. Idempotent - re-generating/re-downloading the same PI
// always shows the same number. The Order Summary PDF reads the same
// order.serialNumber, which stays unset until a PI has been generated.
export async function getNextOrderSerialNumber({ session } = {}) {
  const counter = await Counter.findOneAndUpdate(
    { _id: "orderSerialNumber" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return counter.seq;
}
