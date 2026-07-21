import Counter from "../models/Counter.model.js";

// One global, never-reset sequence assigned at the moment an order is
// VERIFIED (not when it's created) - both order.service.js's verifyOrder()
// (admin) and dispatcher.service.js's verifyAssignedOrder() (dispatcher)
// call this at their SUBMITTED->VERIFIED transition, so the sequence
// reflects the actual order in which orders were reviewed/approved. The
// Order Summary PDF and Proforma Invoice PDF generated for the same order
// always show the same "SN{n}" since both just read order.serialNumber -
// which stays unset until the order clears verification.
export async function getNextOrderSerialNumber({ session } = {}) {
  const counter = await Counter.findOneAndUpdate(
    { _id: "orderSerialNumber" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return counter.seq;
}
