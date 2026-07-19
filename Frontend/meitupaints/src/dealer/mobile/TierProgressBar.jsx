import { useEffect, useRef, useState } from "react";
import { getTierNudgeInfo, tierOrdinal, tierUnitPrice } from "./tierLogic.js";

// Spec §4.2.4 (nudge banner, on Catalog/Cart) and §4.3.4 (ladder, in
// ProductSheet) share one component with a `variant` prop. All tier-price
// math still comes from pricing.js's getTierPrice() output (tiers/
// metricValue/activeTier are passed in already-resolved) - this component
// only does presentation-layer boundary comparisons (how close to the next
// tier, where to place ticks), never re-derives a price.
export function TierProgressBar({ tiers = [], metricValue = 0, activeTier = null, pricing = {}, productName = "", variant = "ladder" }) {
  const unit = pricing?.tierUnit || "";

  // V3 §5.2: celebrate crossing UP into a deeper price tier - but only a
  // real crossing within the SAME pack's own tier ladder. `tiers` is a
  // stable reference for as long as the selected pack doesn't change (it
  // comes straight from that pack's own pricing doc), so a reference
  // change is the signal that this render belongs to a different
  // product/pack entirely - reopening the sheet on a different family, or
  // switching pack size - and must never be read as a "crossing".
  const prevTiersRef = useRef(tiers);
  const prevOrdinalRef = useRef(tierOrdinal(tiers, activeTier));
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (variant !== "ladder") return undefined;
    const ordinal = tierOrdinal(tiers, activeTier);
    const sameContext = prevTiersRef.current === tiers;
    const prevOrdinal = prevOrdinalRef.current;
    prevTiersRef.current = tiers;
    prevOrdinalRef.current = ordinal;
    if (!sameContext || ordinal == null || prevOrdinal == null || ordinal <= prevOrdinal) return undefined;

    // This effect also fires a real external-system side effect (vibrate)
    // alongside the state sync, matching the precedent in
    // DealerCatalogPage.jsx:582-587 for justified set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebrating(true);
    try {
      navigator.vibrate?.(10);
    } catch {
      // Vibration API unsupported/blocked - a missed buzz must never
      // interrupt the actual buy flow (same fail-silent contract as
      // completionFeedback.js's playCompletion()).
    }
    const timer = setTimeout(() => setCelebrating(false), 300);
    return () => clearTimeout(timer);
  }, [tiers, activeTier, variant]);

  if (variant === "nudge") {
    const nudge = getTierNudgeInfo(tiers, activeTier, metricValue);
    if (!nudge) return null;
    const { remaining, progressRatio, nextTierPrice } = nudge;

    return (
      <div className="dealer-m-tier-nudge">
        <div className="dealer-m-tier-nudge-text">
          Add {remaining}
          {unit} more {productName} to unlock <strong>NPR {nextTierPrice.toLocaleString()}/pack</strong>
        </div>
        <div className="dealer-m-tier-nudge-track">
          <div className="dealer-m-tier-nudge-fill" style={{ transform: `scaleX(${Math.min(100, progressRatio * 100) / 100})` }} />
        </div>
      </div>
    );
  }

  const maxTierMin = Math.max(...tiers.map((tier) => Number(tier.min || 0)), 0);
  const ladderMax = Math.max(maxTierMin * 1.15, Number(metricValue || 0), 1);
  const fillPercent = Math.min(100, (Number(metricValue || 0) / ladderMax) * 100);

  return (
    <div className="dealer-m-tier-ladder">
      <div className={`dealer-m-tier-ladder-track ${celebrating ? "dealer-m-tier-pulse" : ""}`}>
        <div className="dealer-m-tier-ladder-fill" style={{ transform: `scaleX(${fillPercent / 100})` }} />
        {tiers.map((tier, index) => (
          <span
            key={index}
            className="dealer-m-tier-ladder-tick"
            style={{ left: `${Math.min(100, (Number(tier.min || 0) / ladderMax) * 100)}%` }}
          />
        ))}
      </div>
      {activeTier ? (
        <div
          key={activeTier.min}
          className={`dealer-m-tier-ladder-price ${celebrating ? "dealer-m-tier-price-crossfade" : ""}`}
        >
          NPR {tierUnitPrice(activeTier).toLocaleString()}/pack
        </div>
      ) : null}
      <div className="dealer-m-tier-ladder-caption">Pricing is combined across all {productName} sizes.</div>
    </div>
  );
}
