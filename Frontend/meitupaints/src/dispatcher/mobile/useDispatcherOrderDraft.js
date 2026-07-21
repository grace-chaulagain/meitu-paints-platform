import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetDispatcherReplenishmentCatalogQuery } from "../../redux/api/meituApi.js";
import { buildCart, calculateCartTotals } from "../dashboard/order/dispatcherOrderPricing.js";
import {
  DRAFT_CHANGE_EVENT,
  clearDraft,
  loadDraft,
  saveDraft,
  sanitizeDraft,
} from "../dashboard/order/dispatcherOrderDraftStorage.js";

// Mirrors src/dealer/mobile/useOrderDraft.js exactly, keyed by productId
// (not sku, since dispatcher's flat-price catalog and buildCart() both key
// off productId - see dispatcherOrderPricing.js's header comment on why
// dispatcher pricing has no tier engine at all).
export function useDispatcherOrderDraft() {
  const [quantities, setQuantities] = useState(() => loadDraft());
  const catalogQuery = useGetDispatcherReplenishmentCatalogQuery();

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

  const setQuantity = useCallback((productId, nextValue) => {
    setQuantities((prev) => {
      const next = sanitizeDraft({ ...prev, [productId]: nextValue });
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

  const itemsByProductId = useMemo(() => {
    const map = {};
    for (const item of catalogQuery.data?.items || []) map[item.productId] = item;
    return map;
  }, [catalogQuery.data]);

  const cart = useMemo(() => buildCart(itemsByProductId, quantities), [itemsByProductId, quantities]);
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
    itemsByProductId,
    itemsLoading: catalogQuery.isLoading,
  };
}
