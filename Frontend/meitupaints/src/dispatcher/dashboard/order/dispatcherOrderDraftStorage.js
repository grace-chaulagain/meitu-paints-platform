// Shared order-draft persistence for the Catalog -> Cart handoff, mirroring
// src/dealer/draftStorage.js's shape/API under the dispatcher's own key so a
// dispatcher's in-progress replenishment order survives reload/navigation.
export const DRAFT_KEY = "meitu_dispatcher_order_draft_v1";

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
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
