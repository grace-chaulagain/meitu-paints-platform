// Shared across all three ops portals (Admin, Factory, Dispatcher) - the
// backend guards in order.service.js/factory.service.js/dispatcher.service.js
// all throw a structured ORDER_STATE_CONFLICT error (see
// Server/src/utils/orderConflictError.js) instead of a bare message when an
// operator acts on a stale card. This is the single place that turns that
// into an honest, self-correcting UI reaction instead of the banned
// generic "Action failed." (ORDER_STATE_HANDLING_REPORT.md Part 5.2).
//
// Response shape actually produced by Server/src/middlewares/error.middleware.js
// (verified directly, not assumed): `code` is TOP-LEVEL on the JSON body,
// `details` is a sibling object, not nested under it - i.e. `err.data.code`,
// not `err.data.details.code`.

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function titleCaseRole(role) {
  if (!role) return "";
  const lower = String(role).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function roleNoun(role) {
  // "the Admin" / "the Dispatcher" - matches the toast copy table exactly.
  return role ? `the ${titleCaseRole(role)}` : "someone";
}

function buildConflictMessage(details) {
  const status = details?.currentStatus;
  const who = roleNoun(details?.reviewedByRole);
  const when = details?.changedAt ? ` · ${timeAgo(details.changedAt)}` : "";

  switch (status) {
    case "VERIFIED":
      return `Already verified by ${who}${when}`;
    case "DISPATCHED":
      return "This order was dispatched while you were viewing it";
    case "COMPLETED":
      return "This order was already completed";
    case "REJECTED":
      return "This order was rejected — no further actions";
    case "CANCELLED":
      return "This order was cancelled — no further actions";
    default:
      return "This order changed state — showing the latest";
  }
}

// Call from every transition catch site, before falling back to generic
// error handling. Returns true if this WAS a conflict (already handled:
// refetched + toasted + announced) - callers should skip their own
// generic error message in that case. Returns false for any other error
// (network failure, validation error, permission error, etc.) so the
// caller's existing fallback ("Couldn't complete — check your connection
// and try again.") still runs for those.
export async function handleTransitionError(err, { refetchOrder, invalidateList, showToast } = {}) {
  const code = err?.data?.code;
  if (code !== "ORDER_STATE_CONFLICT") return false;

  const details = err?.data?.details || {};

  try {
    await refetchOrder?.();
  } catch {
    // The refetch itself failing is a separate, secondary problem - the
    // conflict toast below still fires either way so the user isn't left
    // staring at a stale card with no explanation at all.
  }
  invalidateList?.();

  const message = buildConflictMessage(details);
  showToast?.({ tone: "caution", message });

  announce(message);

  return true;
}

// Single shared aria-live region for conflict announcements (and reused by
// the arrival system in Phase 2) - one region, not one per toast, so
// screen readers don't queue up duplicate/overlapping regions across the
// three portals.
let liveRegion = null;
export function announce(message) {
  if (typeof document === "undefined" || !message) return;
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("role", "status");
    liveRegion.style.position = "absolute";
    liveRegion.style.width = "1px";
    liveRegion.style.height = "1px";
    liveRegion.style.overflow = "hidden";
    liveRegion.style.clip = "rect(0 0 0 0)";
    liveRegion.style.whiteSpace = "nowrap";
    document.body.appendChild(liveRegion);
  }
  // Clearing first forces a re-announcement even if the text is identical
  // to the last message (screen readers dedupe unchanged live-region text).
  liveRegion.textContent = "";
  window.requestAnimationFrame(() => {
    if (liveRegion) liveRegion.textContent = message;
  });
}

export const GENERIC_ACTION_ERROR = "Couldn't complete — check your connection and try again.";
