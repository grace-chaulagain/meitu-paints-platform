export function formatMoney(value, currency = "NPR") {
  const amount = Number(value || 0);
  return `${currency} ${amount.toLocaleString()}`;
}

export function formatPack(pack) {
  if (!pack) return "";
  return pack.label || `${pack.size}${pack.unit}`;
}

function getMetricContribution(quantity = 0, pricing = {}, pack = {}) {
  const qty = Number(quantity || 0);
  const basis = pricing?.basis || "PER_PACK";

  if (basis === "VOLUME_TOTAL") {
    return Number(pack?.size || 0) * qty;
  }

  if (
    basis === "PACK_COUNT" ||
    basis === "UNIT_COUNT" ||
    basis === "PER_PACK"
  ) {
    return qty;
  }

  return qty;
}

export function getTierPrice(
  tiers = [],
  quantity = 0,
  pricing = {},
  pack = {},
  sharedMetricValue = null,
) {
  const model = pricing?.model || pricing?.pricingModelKey || "FLAT";
  const basis = pricing?.basis || "PER_PACK";
  const hasMultipleTiers = Array.isArray(tiers) && tiers.length > 1;

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return {
      tier: null,
      unitPrice: 0,
      metricValue: 0,
    };
  }

  const localMetricValue = getMetricContribution(quantity, pricing, pack);
  const metricValue =
    sharedMetricValue !== null && sharedMetricValue !== undefined
      ? Number(sharedMetricValue)
      : Number(localMetricValue);

  let tier = null;

  if (basis === "FLAT" || (model === "FLAT" && !hasMultipleTiers)) {
    tier = tiers[0] || null;
  } else {
    tier =
      tiers.find((item) => {
        const minOk = metricValue >= Number(item.min ?? 0);
        const maxOk =
          item.max === null || item.max === undefined
            ? true
            : metricValue <= Number(item.max);
        return minOk && maxOk;
      }) || null;
  }

  const unitPrice =
    tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax ?? 0;

  return {
    tier,
    unitPrice: Number(unitPrice || 0),
    metricValue,
    localMetricValue,
  };
}

export function getTierLabel(tier, pricing = {}) {
  if (!tier) return "—";
  const basis = pricing?.basis || "PER_PACK";
  const unit = pricing?.tierUnit || "";

  const maxLabel =
    tier.max === null || tier.max === undefined ? "+" : `–${tier.max}`;

  if (basis === "VOLUME_TOTAL") return `${tier.min}${maxLabel}${unit}`;
  if (basis === "PACK_COUNT") return `${tier.min}${maxLabel} packs`;
  if (basis === "UNIT_COUNT") return `${tier.min}${maxLabel} units`;
  return "Flat";
}

function getFamilySharedMetric(products = [], quantities = {}) {
  if (!Array.isArray(products) || products.length === 0) return 0;

  return products.reduce((acc, product) => {
    const qty = Number(quantities?.[product?.sku] || 0);
    if (qty <= 0) return acc;

    return (
      acc +
      getMetricContribution(qty, product?.pricing || {}, product?.pack || {})
    );
  }, 0);
}

function buildFamilyMetricMap(productsMap = {}, quantities = {}) {
  const familyProductsMap = new Map();

  Object.entries(quantities || {}).forEach(([sku, qty]) => {
    if (Number(qty) <= 0) return;

    const product = productsMap?.[sku];
    if (!product || !product.code) return;

    const key = product.code;
    if (!familyProductsMap.has(key)) {
      familyProductsMap.set(key, []);
    }

    familyProductsMap.get(key).push(product);
  });

  const familyMetricMap = new Map();

  familyProductsMap.forEach((products, key) => {
    familyMetricMap.set(key, getFamilySharedMetric(products, quantities));
  });

  return familyMetricMap;
}

export function buildCartLine(product, quantity, sharedMetricValue = null) {
  const qty = Number(quantity || 0);

  const { tier, unitPrice, metricValue, localMetricValue } = getTierPrice(
    product?.pricing?.tiers || [],
    qty,
    product?.pricing || {},
    product?.pack || {},
    sharedMetricValue,
  );

  return {
    sku: product.sku,
    code: product.code,
    name: product.name,
    category: product.category,
    quantity: qty,
    pack: product.pack,
    pricing: product.pricing,
    currency: product.currency || "NPR",
    unitPrice,
    tier,
    metricValue,
    localMetricValue,
    lineTotal: unitPrice * qty,
    components: product.components || [],
    minQuantity: Number(product.minQuantity) || 1,
  };
}

export function buildCart(productsMap, quantities) {
  const familyMetricMap = buildFamilyMetricMap(productsMap, quantities);

  return Object.entries(quantities)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([sku, qty]) => {
      const product = productsMap?.[sku];
      if (!product) return null;

      const familyKey = product.code;
      const sharedMetricValue = familyMetricMap.has(familyKey)
        ? familyMetricMap.get(familyKey)
        : null;

      return buildCartLine(product, qty, sharedMetricValue);
    })
    .filter((line) => line && line.quantity > 0);
}

export function calculateCartTotals(cart = []) {
  return cart.reduce(
    (acc, item) => {
      acc.totalQty += Number(item.quantity || 0);
      acc.subtotal += Number(item.lineTotal || 0);

      if (item?.pricing?.basis === "VOLUME_TOTAL") {
        acc.totalVolume += Number(item.localMetricValue || 0);
      }

      return acc;
    },
    {
      totalQty: 0,
      totalVolume: 0,
      subtotal: 0,
    },
  );
}

export function groupProductsByCode(products = []) {
  const map = new Map();

  for (const product of products) {
    const key = product.code || product.sku;
    if (!map.has(key)) {
      map.set(key, {
        code: key,
        name: product.name,
        category: product.category,
        description: product.description || "",
        items: [],
      });
    }
    map.get(key).items.push(product);
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
}
