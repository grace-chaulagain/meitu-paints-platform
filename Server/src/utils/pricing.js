import ApiError from "./apiError.js";

export function pickTier(tiers = [], metricValue = 0) {
  const tier = tiers.find((t) => {
    const minOk = metricValue >= Number(t.min);
    const maxOk =
      t.max === null || t.max === undefined
        ? true
        : metricValue <= Number(t.max);
    return minOk && maxOk;
  });

  if (!tier) return null;
  return tier;
}

export function getMetricValue({ pricing, pack, quantity }) {
  const qty = Number(quantity || 0);

  switch (pricing?.basis) {
    case "VOLUME_TOTAL":
      return Number(pack?.size || 0) * qty;

    case "PACK_COUNT":
      return qty;

    case "UNIT_COUNT":
      return qty;

    case "PER_PACK":
    default:
      return qty;
  }
}

export function resolveUnitPrice(tier) {
  return tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax ?? 0;
}

export function priceProductLine({ product, quantity, pricingField = "pricing" }) {
  const qty = Number(quantity || 0);

  if (!qty || qty <= 0) {
    throw new ApiError(400, `Invalid quantity for SKU ${product?.sku}`);
  }

  const pricing = product?.[pricingField];

  const metricValue = getMetricValue({
    pricing,
    pack: product.pack,
    quantity: qty,
  });

  const tier = pickTier(pricing?.tiers || [], metricValue);

  if (!tier) {
    throw new ApiError(
      400,
      `No matching pricing tier found for SKU ${product?.sku}`,
    );
  }

  const unitPrice = resolveUnitPrice(tier);
  const lineTotal = unitPrice * qty;

  return {
    quantity: qty,
    metricValue,
    tier,
    unitPrice,
    lineTotal,
  };
}
