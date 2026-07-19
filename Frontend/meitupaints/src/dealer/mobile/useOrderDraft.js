import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetProductsQuery } from "../../redux/api/meituApi.js";
import { buildCart, calculateCartTotals } from "../pricing.js";
import { DRAFT_CHANGE_EVENT, clearDraft, loadDraft, saveDraft, sanitizeDraft } from "../draftStorage.js";

// Single live-synced view of the dealer's order draft, shared by every
// mobile screen (Home's reorder/continue card, Catalog quick-add, the
// ProductSheet, the CartPill, and Cart itself) so they all agree on the
// same numbers without prop-drilling. draftStorage.js's localStorage key
// remains the actual source of truth - this hook just keeps React state in
// sync with it across every mounted consumer in the same tab (via
// DRAFT_CHANGE_EVENT) and across tabs (via the native "storage" event).
// useGetProductsQuery() is RTK Query cache-shared, so calling it again here
// alongside a page's own call never triggers a duplicate network fetch.
export function useOrderDraft() {
  const [quantities, setQuantities] = useState(() => loadDraft());
  const productsQuery = useGetProductsQuery();

  useEffect(() => {
    function sync() {
      setQuantities(loadDraft());
    }
    window.addEventListener(DRAFT_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DRAFT_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // saveDraft/clearDraft synchronously dispatch DRAFT_CHANGE_EVENT, which
  // synchronously calls setState on every OTHER mounted useOrderDraft()
  // instance's listener (CartPill, ProductSheet's parent, etc). Calling
  // them directly inside a setQuantities updater - or even just before it
  // in the same synchronous tick - nests one component's update inside
  // another's and trips React's "setState while rendering a different
  // component" guard. queueMicrotask defers the write+broadcast until
  // after this component's own update has been processed, breaking the
  // nesting while still feeling instant (microtasks run before the next
  // paint).
  const setQuantity = useCallback((sku, nextValue) => {
    setQuantities((prev) => {
      const next = sanitizeDraft({ ...prev, [sku]: nextValue });
      queueMicrotask(() => saveDraft(next));
      return next;
    });
  }, []);

  const setDraft = useCallback((nextDraft) => {
    const next = sanitizeDraft(nextDraft);
    setQuantities(next);
    queueMicrotask(() => saveDraft(next));
  }, []);

  const clear = useCallback(() => {
    setQuantities({});
    queueMicrotask(() => clearDraft());
  }, []);

  const productsMap = useMemo(() => {
    const products = productsQuery.data || [];
    return products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
    }, {});
  }, [productsQuery.data]);

  const cart = useMemo(() => buildCart(productsMap, quantities), [productsMap, quantities]);
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);

  return {
    quantities,
    setQuantity,
    setDraft,
    clear,
    cart,
    totals,
    itemCount: totals.totalQty,
    subtotal: totals.subtotal,
    productsMap,
    productsLoading: productsQuery.isLoading,
  };
}
