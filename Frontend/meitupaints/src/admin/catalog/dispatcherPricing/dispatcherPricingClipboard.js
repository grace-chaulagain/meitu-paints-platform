// Lightweight in-app "clipboard" for copying one dispatcher's price table
// onto another. Deliberately not the OS clipboard (no permission prompts,
// no JSON-paste parsing) - just sessionStorage, scoped to this tab, cleared
// when the browser tab closes.
const STORAGE_KEY = "meitu.admin.dispatcherPricing.clipboard";

export function copyDispatcherPricingToClipboard({ dispatcherId, dispatcherName, items }) {
  const payload = {
    sourceDispatcherId: dispatcherId,
    sourceDispatcherName: dispatcherName,
    items: (items || [])
      .filter((item) => item.price !== null && item.price !== undefined && item.price !== "")
      .map((item) => ({ productId: item.productId, price: item.price, netPrice: item.netPrice ?? 0 })),
    copiedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage can fail in private-browsing/storage-restricted contexts;
    // Copy Table just silently becomes a no-op for that session in that case.
  }

  return payload;
}

export function readDispatcherPricingClipboard() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDispatcherPricingClipboard() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
