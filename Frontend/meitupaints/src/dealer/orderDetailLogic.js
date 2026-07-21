// Pure status/bucket/milestone logic shared between DealerOrdersPage.jsx (the
// list) and DealerOrderDetailPage.jsx (the routed detail page). Kept in a
// plain .js module (no components) so react-refresh/only-export-components
// doesn't flag orderDetailUI.jsx, which exports the JSX pieces built on top
// of these helpers.

export function normalizeStatus(status) {
  const s = String(status || "").toUpperCase().trim();
  return s === "ARCHIVE" ? "ARCHIVED" : s;
}

// Single source of truth for how each order status reads — the list, the
// pill, and the detail view all key off this so an order's stage is
// unambiguous rather than everything collapsing into one look.
export const ORDER_STATUS_META = {
  SUBMITTED: { label: "Submitted", tone: "caution", live: true },
  VERIFIED: { label: "Verified", tone: "positive", live: true },
  DISPATCHED: { label: "Dispatched", tone: "accent", live: true },
  COMPLETED: { label: "Completed", tone: "positive", live: false },
  CANCELLED: { label: "Cancelled", tone: "critical", live: false },
  REJECTED: { label: "Rejected", tone: "critical", live: false },
  ARCHIVED: { label: "Archived", tone: "neutral", live: false },
};

export function orderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || "Unknown", tone: "neutral", live: false };
}

export function statusLabel(status) {
  return orderStatusMeta(status).label;
}

// Verification is a one-way gate, not a transient state - once an order
// has passed it, the invoice stays available through every stage after
// (DISPATCHED, COMPLETED), not just the moment it's exactly VERIFIED.
const PDF_DOWNLOADABLE_STATUSES = new Set(["VERIFIED", "DISPATCHED", "COMPLETED"]);

export function canDownloadOrderPdf(order) {
  return PDF_DOWNLOADABLE_STATUSES.has(normalizeStatus(order?.status));
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

export function formatShortDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  ONLINE: "Online",
  CHEQUE: "Cheque",
  BANK_GUARANTEE: "Bank Guarantee",
  CREDIT: "Credit",
};

export function formatPaymentMethod(method) {
  return PAYMENT_METHOD_LABELS[method] || method || "—";
}

// The dealer-facing UI intentionally shows only three states:
// Pending: every order still in flight (not yet COMPLETED or REJECTED).
// Completed: orders with backend status COMPLETED.
// Rejected: orders with backend status REJECTED - a distinct terminal
// outcome, not just another flavor of "pending".
// This keeps things simple while the detail page's milestone stepper still
// exposes the internal status progression.
export function orderDisplayBucket(status) {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

export const DISPLAY_BUCKET_META = {
  COMPLETED: {
    pillTone: "positive",
    pillLabel: "Completed",
    icon: "checkmark",
    stateLabel: "Delivered",
    color: "#2fb344",
    bg: "rgba(47,179,68,.14)",
  },
  REJECTED: {
    pillTone: "critical",
    pillLabel: "Rejected",
    icon: "close",
    stateLabel: "Rejected",
    color: "#b42318",
    bg: "rgba(180,35,24,.14)",
  },
  PENDING: {
    pillTone: "caution",
    pillLabel: "Pending",
    icon: "info",
    color: "var(--color-azure, #0071e3)",
    bg: "rgba(0,113,227,.12)",
  },
};

// The order-detail view walks a dealer through the real 4-stage lifecycle
// directly (Placed/Verified/Dispatched/Completed) - there's no longer a
// euphemistic label to hide behind, the real status names are simple
// enough to show as-is. Dates are pulled from the same order.review/
// order.factory.* timestamps the admin/factory dashboards already write as
// an order moves through fulfillment (falling back to "Pending" when a
// stage hasn't happened yet), so nothing here is fabricated.
export const ORDER_MILESTONES = [
  { key: "PLACED", label: "Order Placed", description: "Your order has been received.", icon: "checkmark" },
  { key: "VERIFIED", label: "Verified", description: "Your order has been reviewed and verified.", icon: "checkSquare" },
  { key: "DISPATCHED", label: "Dispatched", description: "Your order has been dispatched for delivery.", icon: "truck" },
  { key: "COMPLETED", label: "Completed", description: "Your order has been delivered successfully.", icon: "package" },
];

// Value = how many milestones are already "done" once the order reaches
// that status - e.g. status VERIFIED means the order has cleared both
// Order Placed and Verified, so those two read "done" and Dispatched
// (the next one) reads "current". Previously these matched the milestone's
// own index, which made a just-reached status show as still "in progress"
// on its own step instead of moving the spinner to the next one.
const MILESTONE_STATUS_RANK = {
  SUBMITTED: 1,
  VERIFIED: 2,
  DISPATCHED: 3,
};

function milestoneRank(status) {
  return MILESTONE_STATUS_RANK[status] ?? 0;
}

function milestoneDate(order, key) {
  switch (key) {
    case "PLACED":
      return order?.createdAt || null;
    case "VERIFIED":
      return order?.review?.reviewedAt || order?.factory?.sentToFactoryAt || null;
    case "DISPATCHED":
      return order?.factory?.outForDeliveryAt || null;
    case "COMPLETED":
      return order?.factory?.deliveredAt || null;
    default:
      return null;
  }
}

// Returns null for Rejected/Cancelled orders — those are a distinct terminal
// outcome the milestone track can't honestly represent as "progress".
export function buildOrderMilestones(order) {
  const normalized = normalizeStatus(order?.status);
  if (normalized === "REJECTED" || normalized === "CANCELLED") return null;

  // Completed is terminal - every milestone (including Completed itself)
  // reads as "done" rather than treating the last one as still "current",
  // which would otherwise show a spinning loader on a finished order.
  const isTerminalComplete = normalized === "COMPLETED";
  const rank = isTerminalComplete ? ORDER_MILESTONES.length : milestoneRank(normalized);
  return ORDER_MILESTONES.map((milestone, index) => ({
    ...milestone,
    state: index < rank ? "done" : index === rank ? "current" : "upcoming",
    date: milestoneDate(order, milestone.key),
  }));
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

// Order line items only snapshot productId/sku/code — not an image — so the
// thumbnail is resolved the same way DealerCartPage resolves cart-line images:
// cross-referencing the live product/family catalog by sku/code. The line
// item is a specific ordered size, so its own product image takes priority
// over the family's shared image.
export function resolveOrderItemImage(item, productsMap, familyMap) {
  const product = productsMap?.[item?.sku] || null;
  const familyByCode = familyMap?.[item?.code] || null;
  return (
    getPrimaryImage(product?.images || []) ||
    getPrimaryImage(product?.familyImages || []) ||
    getPrimaryImage(product?.family?.images || []) ||
    getPrimaryImage(familyByCode?.images || []) ||
    null
  );
}

// V3 §5.6: shared by DealerOrderDetailMobileView.jsx's own "Reorder"
// button and the Orders list's swipe-to-reorder action - wholesale-replace
// semantics (the returned object IS the next full draft, passed straight
// to useOrderDraft()'s setDraft), not additive to whatever's already in
// the cart. Matches the original single-order-detail reorder behavior
// exactly.
export function buildReorderDraft(items = []) {
  const nextDraft = {};
  (items || []).forEach((item) => {
    if (item.sku) nextDraft[item.sku] = Number(item.quantity || 0);
  });
  return nextDraft;
}
