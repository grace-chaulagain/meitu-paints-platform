// Route vocabulary mirrors the admin orders list (ROUTE_MODES in
// AdminOrdersPage.jsx) so the same words mean the same thing in both
// places. "Dispatcher's Own Orders" is deliberately absent: replenishment
// orders are excluded from every revenue/AR view (INTERNAL_ORDER_ORIGINS,
// insightsShared.js), so offering it here could only ever render zeros.
export const ROUTE_ALL = "ALL";
export const ROUTE_FACTORY = "FACTORY";
export const ROUTE_DISPATCHER_ALL = "DISPATCHER_ALL";

export const BASE_ROUTE_OPTIONS = [
  { key: ROUTE_ALL, label: "All routes" },
  { key: ROUTE_FACTORY, label: "Factory" },
  { key: ROUTE_DISPATCHER_ALL, label: "Dealer orders via dispatcher" },
];

// Translates the picker's single `route` value into the query params the
// insights endpoints validate (fulfillmentMode / dispatcherId).
export function routeToParams(route) {
  if (route === ROUTE_FACTORY) return { fulfillmentMode: "FACTORY" };
  if (route === ROUTE_DISPATCHER_ALL) return { fulfillmentMode: "DISPATCHER" };
  if (String(route || "").startsWith("DISPATCHER:")) {
    const id = String(route).split(":")[1] || "";
    return id ? { fulfillmentMode: "DISPATCHER", dispatcherId: id } : { fulfillmentMode: "DISPATCHER" };
  }
  return {};
}
