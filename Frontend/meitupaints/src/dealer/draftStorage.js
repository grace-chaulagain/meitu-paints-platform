// Shared order-draft persistence for the Catalog -> Cart handoff. Both
// pages read/write this same localStorage key independently (no shared
// state container) - this module just de-duplicates the identical logic
// that used to be copy-pasted in each file.
export const DRAFT_KEY = "meitu_dealer_order_draft_v1";

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
