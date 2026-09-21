import { buildPublicAppUrl } from "./publicUrl.js";

// Deep links used in order emails, so a recipient lands on the exact order in
// their own portal rather than a generic list. Deliberately dependency-light
// (only publicUrl) so factory.service.js and the scheme notification service
// can both import it without creating an import cycle through order.service.js.

function encodedId(order) {
  return encodeURIComponent(String(order?._id || ""));
}

// A scheme granted to a dispatcher itself (no dealerId) is tracked under the
// dispatcher's own orders; everything else is a dealer's order.
export function buildRecipientOrderUrl(order) {
  if (!order?._id) return buildPublicAppUrl("/");
  if (order.dispatcherCustomerId && !order.dealerId) {
    return buildPublicAppUrl(`/dispatcher/orders/${encodedId(order)}`);
  }
  return buildPublicAppUrl(`/dealer/orders/${encodedId(order)}`);
}

export function buildFactoryOrderUrl(order) {
  if (!order?._id) return buildPublicAppUrl("/factory/dashboard/orders");
  return buildPublicAppUrl(`/factory/dashboard/orders?orderId=${encodedId(order)}`);
}
