import { findMissingDetails } from "../../../utils/missingDetails.js";

// The contact details every dispatcher record should carry - the ones the Edit
// Dispatcher form collects, minus the optional internal notes.
export const DISPATCHER_DETAIL_FIELDS = [
  { key: "name", label: "Dispatcher Name" },
  { key: "companyName", label: "Company Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
];

export function missingDispatcherDetails(dispatcher) {
  return findMissingDetails(dispatcher, DISPATCHER_DETAIL_FIELDS);
}

// Dispatchers carry more states than dealers (pending review, rejected,
// suspended, awaiting deletion), so the profile names them all.
export function dispatcherStateLabel(dispatcher) {
  if (!dispatcher) return { label: "Unknown", tone: "neutral" };
  if (dispatcher.deletion?.pending) return { label: "Deletion pending", tone: "neutral" };
  if (dispatcher.status === "REJECTED") return { label: "Rejected", tone: "critical" };
  if (dispatcher.status === "PENDING") return { label: "Awaiting approval", tone: "caution" };
  if (dispatcher.status === "VERIFIED") {
    return dispatcher.isActive
      ? { label: "Active Dispatcher", tone: "positive" }
      : { label: "Suspended Dispatcher", tone: "critical" };
  }
  return { label: dispatcher.status || "Unknown", tone: "neutral" };
}

// No dispatcher-number sequence exists in the data model - a stable display
// transform of the real id, mirroring the dealer profile's DLR- id.
export function dispatcherDisplayId(dispatcher) {
  const id = String(dispatcher?._id || "");
  return id ? `DSP-${id.slice(-6).toUpperCase()}` : "—";
}

// A single ratio against a limit, so it is read in three plain bands. The
// server composes it from replenishment recency, dealer activity, rejections
// and stock (dispatcherAnalytics.service.js); the bands are this page's.
export function healthBand(score) {
  if (score == null) return null;
  if (score >= 70) return { label: "Healthy", tone: "positive", icon: "checkmark" };
  if (score >= 40) return { label: "Watch", tone: "caution", icon: "info" };
  return { label: "Needs attention", tone: "critical", icon: "warning" };
}
