// Pure tier-boundary math shared by TierProgressBar.jsx (the "nudge"/
// "ladder" visual variants), ProductSheet.jsx (family-total hint), and
// CartPill.jsx (tier hint, spec §2.5) - kept in a plain .js module, not
// TierProgressBar.jsx itself, so react-refresh/only-export-components
// doesn't flag a component file for also exporting plain functions.
// Every value read here (tiers/activeTier/metricValue) is already resolved
// by pricing.js's getTierPrice() - this module only does presentation-layer
// boundary comparisons, never re-derives a price.

export function findNextTier(tiers, activeTier) {
  if (!Array.isArray(tiers) || tiers.length < 2) return null;
  const sorted = [...tiers].slice().sort((a, b) => Number(a.min ?? 0) - Number(b.min ?? 0));
  const activeIndex = activeTier ? sorted.findIndex((t) => Number(t.min ?? 0) === Number(activeTier.min ?? 0)) : -1;
  if (activeIndex === -1 || activeIndex >= sorted.length - 1) return null;
  return sorted[activeIndex + 1];
}

export function tierUnitPrice(tier) {
  return Number(tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax ?? 0);
}

// Returns null when there's no next tier, the family is already past it, or
// it isn't within 20% yet ("only nudge when genuinely close", per spec).
export function getTierNudgeInfo(tiers, activeTier, metricValue) {
  const nextTier = findNextTier(tiers, activeTier);
  if (!nextTier) return null;
  const remaining = Math.max(0, Number(nextTier.min ?? 0) - Number(metricValue || 0));
  if (remaining <= 0) return null;
  const span = Number(nextTier.min ?? 0) - Number(activeTier?.min ?? 0) || 1;
  const progressRatio = 1 - remaining / span;
  if (progressRatio < 0.8) return null;
  return { nextTier, remaining, progressRatio, nextTierPrice: tierUnitPrice(nextTier) };
}

// 1-based "Tier N" label for a tier within its own tiers array.
export function tierOrdinal(tiers = [], tier) {
  if (!tier) return null;
  const index = tiers.findIndex((t) => Number(t.min ?? 0) === Number(tier.min ?? 0));
  return index >= 0 ? index + 1 : null;
}
