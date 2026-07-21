// Shared order-draft persistence for the Catalog -> Cart handoff, mirroring
// src/dealer/draftStorage.js's shape/API under the dispatcher's own key so a
// dispatcher's in-progress replenishment order survives reload/navigation.
export const DRAFT_KEY = "meitu_dispatcher_order_draft_v1";

// The native "storage" event only fires in OTHER tabs, never the tab that
// made the write - so the mobile UI's cart pill (which must update live as
// the Catalog/ProductSheet write to the draft in the SAME tab) needs its
// own same-tab broadcast. useDispatcherOrderDraft.js listens for this.
export const DRAFT_CHANGE_EVENT = "meitu-dispatcher-draft-change";

function broadcastDraftChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DRAFT_CHANGE_EVENT));
}

export function sanitizeDraft(draft = {}) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => Number(value || 0) > 0),
  );
}

export function loadDraft() {
  try {
    return sanitizeDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"));
  } catch {
    return {};
  }
}

export function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizeDraft(draft)));
  broadcastDraftChange();
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  broadcastDraftChange();
}
