// Dispatcher pricing is a flat per-SKU rate (DispatcherProductPrice has no
// tiers, unlike dealer pricing's Product.pricing.tiers), so this is a much
// thinner counterpart to src/dealer/pricing.js - no tier engine needed, just
// grouping + straight quantity*price math.

// Mirrors src/dealer/pricing.js's groupProductsByCode, adapted for the flat
// catalog item shape returned by useGetDispatcherReplenishmentCatalogQuery
// ({ productId, name, sku, code, category, packLabel, price, currency }).
export function groupCatalogItemsByCode(items = []) {
  const map = new Map();

  for (const item of items) {
    const key = item.code || item.sku;
    if (!map.has(key)) {
      map.set(key, {
        code: key,
        name: item.name,
        category: item.category,
        items: [],
      });
    }
    map.get(key).items.push(item);
  }

  return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function buildCart(itemsById, quantities) {
  return Object.entries(quantities)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([productId, qty]) => {
      const item = itemsById[productId];
      if (!item) return null;
      const quantity = Number(qty);
      const unitPrice = Number(item.price || 0);
      return {
        productId,
        name: item.name,
        sku: item.sku,
        code: item.code,
        category: item.category,
        packLabel: item.packLabel,
        currency: item.currency || "NPR",
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    })
    .filter(Boolean);
}

export function calculateCartTotals(cart = []) {
  return cart.reduce(
    (acc, line) => {
      acc.totalQty += Number(line.quantity || 0);
      acc.subtotal += Number(line.lineTotal || 0);
      return acc;
    },
    { totalQty: 0, subtotal: 0 },
  );
}
