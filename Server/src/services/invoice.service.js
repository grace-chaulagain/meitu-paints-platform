import Order, { ORDER_ORIGIN, ORDER_STATUS } from "../models/Order.model.js";
import Invoice from "../models/Invoice.model.js";
import Counter from "../models/Counter.model.js";
import ApiError from "../utils/apiError.js";

function actorId(user) {
  return user?.id || user?._id || null;
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: "invoice" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `INV-${year}-${String(counter.seq).padStart(6, "0")}`;
}

export async function issueInvoiceForOrder({ orderId, factoryUser } = {}) {
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const existing = await Invoice.findOne({ orderId }).lean();
  if (existing) return existing;

  const order = await Order.findById(orderId).lean();
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new ApiError(400, "Invoice can only be issued once the order is completed");
  }

  const invoiceNumber = await generateInvoiceNumber();

  try {
    const invoice = await Invoice.create({
      invoiceNumber,
      orderId: order._id,
      orderVersion: order.currentVersion || 1,
      dealerId: order.dealerId || null,
      dispatcherId: order.orderOrigin === ORDER_ORIGIN.DISPATCHER_REPLENISHMENT ? order.dispatcherCustomerId : null,
      totalsSnapshot: order.totals || {},
      issuedBy: actorId(factoryUser),
    });

    return invoice.toObject();
  } catch (error) {
    // Lost a race against a concurrent issue for the same order - the
    // unique index on orderId is what actually prevents a duplicate,
    // this just falls back to returning the invoice the winner created.
    if (error?.code === 11000) {
      const winner = await Invoice.findOne({ orderId }).lean();
      if (winner) return winner;
    }
    throw error;
  }
}
