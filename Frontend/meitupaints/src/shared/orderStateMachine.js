// The single rulebook for order state across the three ops portals (Admin,
// Factory, Dispatcher) - dependency-free ESM, no React imports, so it can be
// unit-sanity-checked with a bare `node` run. Every list/chip/rail/sheet in
// those three portals should derive its "what can happen next" and "how do
// I describe this order" from here rather than re-deriving `status === X`
// logic locally (ORDER_STATE_HANDLING_REPORT.md Part 5, Phase 1).
//
// Field names below are verified directly against Server/src/models/Order.model.js
// and the three services (order.service.js/factory.service.js/dispatcher.service.js),
// not assumed - notably `order.review.*` (not flat `order.reviewedByRole`) and
// `order.factory.*` (not `order.fulfillment.*`), and dispatcher-mode dispatch/
// complete write into the SAME `factory.outForDeliveryAt`/`factory.deliveredAt`
// fields factory-mode orders use (dispatcher.service.js explicitly mirrors
// factory.service.js's field names for this reason).

let warnedUnknownFulfillmentMode = false;

export function isDispatcherFulfilled(order) {
  const mode = order?.dealerSnapshot?.fulfillmentMode;
  if (mode === "DISPATCHER") return true;
  if (mode !== "FACTORY" && !warnedUnknownFulfillmentMode) {
    warnedUnknownFulfillmentMode = true;
    console.warn(
      `[orderStateMachine] Unrecognized dealerSnapshot.fulfillmentMode (${JSON.stringify(mode)}) on order ${order?._id || order?.orderNumber || "?"} - treating as factory-fulfilled.`,
    );
  }
  return false;
}

export const reviewerParty = (order) => (isDispatcherFulfilled(order) ? "DISPATCHER" : "ADMIN");

// ---------------------------------------------------------------------------
// Canonical status vocabulary (§Phase 1 table) - the ONLY labels/tones any
// chip, toast, rail node, or tab may render.
// ---------------------------------------------------------------------------

const STATUS_META = {
  SUBMITTED: {
    tone: "attention",
    label: { FACTORY: "Submitted", DISPATCHER: "Submitted" },
    owner: (order) => reviewerParty(order),
  },
  VERIFIED: {
    tone: "progress",
    label: { FACTORY: "Verified — with Factory", DISPATCHER: "Verified — ready to dispatch" },
    owner: (order) => (isDispatcherFulfilled(order) ? "DISPATCHER" : "FACTORY"),
  },
  // Dispatcher-fulfilled orders used to treat DISPATCHED as terminal
  // ("Delivered", owner: null) - a dispatcher could dispatch and the order
  // would just sit there, "confirm handover" available but never owned by
  // anyone, never shown as needing action. Now mirrors Factory exactly:
  // DISPATCHED is an in-progress leg the dispatcher still owns (final-mile
  // delivery not yet confirmed), and COMPLETED is the one true terminal
  // state - same 4-stage shape, same ownership pattern, both fulfillment
  // modes.
  DISPATCHED: {
    tone: "progress",
    label: { FACTORY: "In transit", DISPATCHER: "Out for delivery" },
    owner: (order) => (isDispatcherFulfilled(order) ? "DISPATCHER" : "FACTORY"),
  },
  COMPLETED: {
    tone: "success",
    label: { FACTORY: "Delivered", DISPATCHER: "Delivered" },
    owner: () => null,
  },
  REJECTED: {
    tone: "caution",
    label: { FACTORY: "Rejected", DISPATCHER: "Rejected" },
    owner: () => null,
  },
  CANCELLED: {
    tone: "caution",
    label: { FACTORY: "Cancelled", DISPATCHER: "Cancelled" },
    owner: () => null,
  },
};

function modeKey(order) {
  return isDispatcherFulfilled(order) ? "DISPATCHER" : "FACTORY";
}

export function getStatusLabel(order) {
  const meta = STATUS_META[order?.status];
  if (!meta) return order?.status || "Unknown";
  return meta.label[modeKey(order)];
}

export function getStatusTone(order) {
  const meta = STATUS_META[order?.status];
  if (!meta) return "neutral";
  return typeof meta.tone === "function" ? meta.tone(order) : meta.tone;
}

export function getOwner(order) {
  const meta = STATUS_META[order?.status];
  if (!meta) return null;
  return meta.owner(order);
}

export function isWaitingOn(order, role) {
  if (!role) return false;
  return getOwner(order) === role;
}

// ---------------------------------------------------------------------------
// Rail nodes (§2.1's data source) - 4 nodes, same shape for both
// fulfillment modes (dispatcher-mode used to collapse to 3, treating
// DISPATCHED as already-terminal; it now mirrors Factory's Submitted ->
// Verified -> [in-transit leg] -> Delivered exactly).
// ---------------------------------------------------------------------------

const FACTORY_RAIL_DEFS = [
  {
    key: "submitted",
    label: "Submitted",
    reached: () => true,
    at: (order) => order?.createdAt || null,
    byRole: () => null,
  },
  {
    key: "verified",
    label: "Verified",
    reached: (order) => Boolean(order?.review?.reviewedAt),
    at: (order) => order?.review?.reviewedAt || null,
    byRole: (order) => order?.review?.reviewedByRole || null,
  },
  {
    key: "dispatched",
    label: "In transit",
    reached: (order) => Boolean(order?.factory?.outForDeliveryAt),
    at: (order) => order?.factory?.outForDeliveryAt || null,
    byRole: () => "FACTORY",
    // The only rail node where "current" means a physically unfinished
    // process (the order is on a truck, not yet received) rather than an
    // already-achieved milestone - a checkmark here would claim delivery
    // that hasn't happened. Every other "current" node (Submitted, Verified)
    // represents a completed action that's merely awaiting the next party.
    inProgressWhileCurrent: true,
  },
  {
    key: "delivered",
    label: "Delivered",
    reached: (order) => Boolean(order?.factory?.deliveredAt),
    at: (order) => order?.factory?.deliveredAt || null,
    byRole: () => "FACTORY",
  },
];

const DISPATCHER_RAIL_DEFS = [
  {
    key: "submitted",
    label: "Submitted",
    reached: () => true,
    at: (order) => order?.createdAt || null,
    byRole: () => null,
  },
  {
    key: "verified",
    label: "Verified",
    reached: (order) => Boolean(order?.review?.reviewedAt),
    at: (order) => order?.review?.reviewedAt || null,
    byRole: (order) => order?.review?.reviewedByRole || null,
  },
  {
    key: "dispatched",
    label: "Out for delivery",
    // Dispatch (dispatchAssignedOrder) is the moment a dispatcher-fulfilled
    // order leaves for the dealer - same field factory-mode's transit leg
    // uses, per dispatcher.service.js's own comment mirroring
    // factory.service.js's field names exactly.
    reached: (order) => Boolean(order?.factory?.outForDeliveryAt),
    at: (order) => order?.factory?.outForDeliveryAt || null,
    byRole: () => "DISPATCHER",
    inProgressWhileCurrent: true,
  },
  {
    key: "delivered",
    label: "Delivered",
    // completeAssignedOrder ("Confirm Handover") - the final-mile
    // confirmation, mirroring factory.service.js's markDelivered. Stock/
    // inventory movement already happened at dispatch; this is purely the
    // status transition, same as Factory's own deliver step.
    reached: (order) => Boolean(order?.factory?.deliveredAt),
    at: (order) => order?.factory?.deliveredAt || null,
    byRole: () => "DISPATCHER",
  },
];

function currentNodeKey(order) {
  const status = order?.status;
  if (status === "SUBMITTED") return "submitted";
  if (status === "VERIFIED") return "verified";
  if (status === "DISPATCHED") return "dispatched";
  return "delivered"; // COMPLETED
}

function buildActiveRail(order, defs) {
  const activeKey = currentNodeKey(order);
  const owner = getOwner(order);
  return defs.map((def) => {
    const reached = def.reached(order);
    const isCurrent = def.key === activeKey;
    let state;
    if (isCurrent) {
      // A node stays "current" (breathing pulse, §2.1) only while someone
      // still owns the next move - once owner is null the order is truly
      // terminal at this node and it renders as a plain "done" checkpoint.
      state = owner !== null ? "current" : "done";
    } else {
      state = reached ? "done" : "todo";
    }
    const inProgress = isCurrent && state === "current" && Boolean(def.inProgressWhileCurrent);
    return { key: def.key, label: def.label, at: def.at(order), byRole: def.byRole(order), state, inProgress };
  });
}

function buildTerminatedRail(order, defs) {
  const reachedDefs = defs.filter((def) => def.reached(order));
  const doneNodes = reachedDefs.map((def) => ({
    key: def.key,
    label: def.label,
    at: def.at(order),
    byRole: def.byRole(order),
    state: "done",
  }));
  const isRejected = order?.status === "REJECTED";
  // CANCELLED has no dedicated schema fields (no live path sets it today -
  // verified via repo-wide grep) - fall back to `rejection.*` (a generic
  // off-ramp record, not literally reject-only in practice) then updatedAt.
  doneNodes.push({
    key: isRejected ? "rejected" : "cancelled",
    label: isRejected ? "Rejected" : "Cancelled",
    at: order?.rejection?.rejectedAt || order?.updatedAt || null,
    byRole: order?.rejection?.rejectedByRole || null,
    reason: order?.rejection?.reason || "",
    state: "terminated",
  });
  return doneNodes;
}

export function getRailNodes(order) {
  const dispatcherMode = isDispatcherFulfilled(order);
  const defs = dispatcherMode ? DISPATCHER_RAIL_DEFS : FACTORY_RAIL_DEFS;
  const status = order?.status;
  if (status === "REJECTED" || status === "CANCELLED") {
    return buildTerminatedRail(order, defs);
  }
  return buildActiveRail(order, defs);
}

// ---------------------------------------------------------------------------
// Transitions per role (mirrors backend guards exactly - A8) + consequences
// + handoff copy.
// ---------------------------------------------------------------------------

// The spec's original guard checked `factory.sentToFactoryAt == null`,
// modeled on "you can undo until Factory begins work." Verified directly
// against order.service.js's verifyOrder (~line 966): for factory-mode
// orders, `factory.sentToFactoryAt` is stamped in the SAME $set as the
// verify itself ("verification IS 'sent to Factory'" per that function's
// own comment) - so that condition is already false the instant verify
// succeeds, which would make Undo permanently unreachable. The real
// irreversibility boundary in this system is stock consumption at dispatch
// (A5), which `status === VERIFIED` (not yet dispatched) plus the
// reservation check already fully capture - so the guard here mirrors
// exactly what the backend's atomic revert filter can honestly enforce.
function canRevertVerification(order) {
  return order?.status === "VERIFIED" && order?.stockReservation?.status !== "CONSUMED";
}

export function getTransitions(order, role) {
  const status = order?.status;
  const dispatcherMode = isDispatcherFulfilled(order);
  const out = [];

  if (role === "ADMIN" && !dispatcherMode) {
    if (status === "SUBMITTED") {
      out.push({ action: "verify", target: "VERIFIED", kind: "primary", irreversible: false });
      out.push({ action: "reject", target: "REJECTED", kind: "destructive", irreversible: true });
    }
    if (status === "VERIFIED" && canRevertVerification(order)) {
      out.push({ action: "revert-verification", target: "SUBMITTED", kind: "bookkeeping", irreversible: false });
    }
  }

  if (role === "DISPATCHER" && dispatcherMode) {
    if (status === "SUBMITTED") {
      // No Undo exists for a dispatcher's own verify (Phase 6 scopes revert
      // to ADMIN only) - irreversible:true here is deliberate, not an
      // oversight, so §W's "Undo exists for exactly one transition" holds.
      out.push({ action: "verify", target: "VERIFIED", kind: "primary", irreversible: true });
      out.push({ action: "reject", target: "REJECTED", kind: "destructive", irreversible: true });
    }
    if (status === "VERIFIED") {
      out.push({ action: "dispatch", target: "DISPATCHED", kind: "primary", irreversible: true });
    }
    if (status === "DISPATCHED") {
      // Promoted from "bookkeeping" to a real peer of verify/dispatch - the
      // 4-stage lifecycle change means this is now the owned, required
      // final-mile confirmation, same weight as Factory's own "deliver".
      out.push({ action: "confirm-handover", target: "COMPLETED", kind: "primary", irreversible: true });
    }
  }

  if (role === "FACTORY" && !dispatcherMode) {
    // Backend's rejectFactoryOrder disallows only COMPLETED/REJECTED
    // (factory.service.js `disallowed`), so SUBMITTED/VERIFIED/DISPATCHED
    // are all mirrored here even though Factory's own queue today only
    // ever surfaces VERIFIED/DISPATCHED orders (A8: mirror backend exactly).
    if (status === "SUBMITTED") {
      out.push({ action: "reject", target: "REJECTED", kind: "destructive", irreversible: true });
    }
    if (status === "VERIFIED") {
      out.push({ action: "dispatch", target: "DISPATCHED", kind: "primary", irreversible: true });
      out.push({ action: "reject", target: "REJECTED", kind: "destructive", irreversible: true });
    }
    if (status === "DISPATCHED") {
      out.push({ action: "deliver", target: "COMPLETED", kind: "primary", irreversible: true });
      out.push({ action: "reject", target: "REJECTED", kind: "destructive", irreversible: true });
    }
  }

  return out;
}

const CONSEQUENCES = {
  verify: {
    FACTORY: [
      "Stock will be reserved for this order.",
      "The dealer will be emailed.",
      "You can undo this until the Factory begins work.",
    ],
    DISPATCHER: ["Availability is checked against your regional stock.", "The dealer will be emailed."],
  },
  reject: [
    "⚠ This permanently rejects the order.",
    "Any reserved stock is released.",
    "The dealer will be emailed with your reason.",
  ],
  dispatch: {
    FACTORY: [
      "⚠ Reserved stock will be consumed — this cannot be undone.",
      "The Proforma Invoice will be attached.",
      "The dealer will be emailed.",
    ],
    DISPATCHER: [
      "⚠ Your regional stock will be deducted — this cannot be undone.",
      "The dealer's received-stock counter is credited.",
      "The dealer will be emailed. You'll confirm the handover once it's delivered.",
    ],
  },
  deliver: ["Marks the order Delivered and closes fulfillment.", "The dealer will be emailed."],
  "confirm-handover": ["Marks the order Delivered and closes fulfillment.", "The dealer will be emailed."],
  "revert-verification": [
    "Returns the order to Submitted.",
    "Reserved stock is released.",
    "The action is recorded in the order's history.",
  ],
};

export function getConsequences(order, action) {
  const entry = CONSEQUENCES[action];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return entry[modeKey(order)] || [];
}

const HANDOFF_LINES = {
  verify: {
    FACTORY: "Next: Factory prepares shipment",
    DISPATCHER: "Next: dispatch when ready",
  },
  reject: "Next: nothing — the order is closed",
  dispatch: {
    FACTORY: "Next: mark delivered once the dealer receives it",
    DISPATCHER: "Next: confirm handover once the dealer receives it",
  },
  deliver: "Next: nothing — the order is complete",
  "confirm-handover": "Next: nothing — the order is complete",
  "revert-verification": "Next: the order returns to the review queue",
};

export function getHandoffLine(order, action) {
  const entry = HANDOFF_LINES[action];
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return entry[modeKey(order)] || "";
}

// One verb per action, shared by every portal's confirm button and action
// list so the vocabulary never drifts between Admin/Factory/Dispatcher.
export const ACTION_VERB = {
  verify: "Verify",
  reject: "Reject",
  dispatch: "Dispatch",
  deliver: "Mark Delivered",
  "confirm-handover": "Confirm Handover",
  "revert-verification": "Undo Verification",
};
