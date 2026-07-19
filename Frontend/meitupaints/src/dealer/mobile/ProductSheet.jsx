import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { buildCart, formatMoney, formatPack } from "../pricing.js";
import { QuantityStepper } from "./QuantityStepper.jsx";
import { TierProgressBar } from "./TierProgressBar.jsx";
import { tierOrdinal } from "./tierLogic.js";
import { MobileSheet } from "./MobileSheet.jsx";
import { CartPill } from "./CartPill.jsx";

// V3 §5.8: first-open coach mark, once per browser ever. Follows this
// codebase's existing dealer-domain localStorage naming convention (see
// draftStorage.js's DRAFT_KEY, "meitu_dealer_..._v1").
const COACH_MARK_KEY = "meitu_dealer_product_sheet_handle_coachmark_seen_v1";
const COACH_MARK_DELAY_MS = 400;
const COACH_MARK_DURATION_MS = 600;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function categoryLabel(value) {
  if (!value) return "";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// V2 §1.3: Apple buy-flow accordion (the iPhone storage-picker pattern).
// Pricing math is never re-derived here - every row's displayed price is
// read off pricing.js's own buildCart(), the same calculation the real
// cart uses. No separate "Add to order" confirm step: the stepper writes
// straight to the draft on every tap (+ adds/increments, - decrements/
// removes), so switching to another size mid-flow never loses what was
// already dialed in - it's already in the cart.
//
// Pack rows themselves NEVER change height - no inline accordion. Once a
// pack is tapped, its quantity stepper + tier ladder appear in one shared
// "detail" zone below the list instead, which is a fixed-height block
// (sized for its own always-present content, never conditionally taller or
// shorter) that only reveals/hides via clip-path + opacity. A row growing
// taller used to push every row below it - and the ladder, and (if the
// sheet was under its max-height) the whole sheet - down/up with it; with
// nothing left in this screen that changes height on interaction, there is
// nothing left to shift.
export function ProductSheet({ open, onClose, family, draft }) {
  // Retains the last non-null family so this component keeps rendering
  // (with the family MobileSheet is animating closed) instead of unmounting
  // the instant `open`/`family` go falsy - MobileSheet can't play an exit
  // animation for a subtree that's already gone. Adjusted during render
  // (React's sanctioned "remember a previous prop" escape hatch), not in an
  // effect - an effect would commit a stale (null) render first and only
  // fix it up a pass later. Only the render body below reads renderedFamily;
  // the reset effect below stays keyed on the live `family` prop.
  const [renderedFamily, setRenderedFamily] = useState(family);
  const [selectedSku, setSelectedSku] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [showHandleCoachMark, setShowHandleCoachMark] = useState(false);
  const dragRef = useRef(null);
  const detailRef = useRef(null);

  if (family && family !== renderedFamily) {
    setRenderedFamily(family);
  }

  // V3 §5.8: on the very first open this browser has ever seen, dip the
  // grab handle once to hint it's draggable - never again after. Guarded
  // by a real localStorage flag (not just component state), so it also
  // never replays on a later visit/reload. Every open after the first
  // reads the flag as already set and bails immediately, so
  // showHandleCoachMark only ever flips true for that one open.
  useEffect(() => {
    if (!open || prefersReducedMotion()) return undefined;
    let alreadySeen = true;
    try {
      alreadySeen = Boolean(window.localStorage.getItem(COACH_MARK_KEY));
      if (!alreadySeen) window.localStorage.setItem(COACH_MARK_KEY, "1");
    } catch {
      // localStorage unavailable (private mode, blocked) - skip the coach
      // mark, no functional loss.
      return undefined;
    }
    if (alreadySeen) return undefined;
    setShowHandleCoachMark(true);
    const timer = setTimeout(() => setShowHandleCoachMark(false), COACH_MARK_DELAY_MS + COACH_MARK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open && family?.items?.length) {
      // Pre-select whichever pack already has a quantity in the draft, so
      // reopening a family that's already in the cart still shows its
      // current line - otherwise leave nothing selected. The dealer must
      // tap a size themselves rather than the sheet silently defaulting to
      // the first pack.
      const existing = family.items.find((item) => Number(draft.quantities?.[item.sku] || 0) > 0);
      setSelectedSku(existing?.sku || null);
      setImageIndex(0);
      setDragX(0);
    }
    // Only reset when the sheet opens for a (possibly new) family - not on
    // every draft change, which would fight the dealer's in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, family?.code]);

  // Selecting a pack reveals its live tier ladder at the bottom of the
  // sheet, below a list that can already run past one screen - scroll it
  // into view once the reveal settles, rather than leaving the dealer to
  // notice and scroll manually. Deliberately an instant jump, not smooth:
  // nothing about this screen is guaranteed to stay motionless for the
  // duration a smooth glide would need, and an instant jump has no
  // in-flight tail left to collide with a dealer's next tap.
  useEffect(() => {
    if (!selectedSku) return undefined;
    const timer = setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 260);
    return () => clearTimeout(timer);
  }, [selectedSku]);

  if (!renderedFamily) return null; // true only before the sheet has ever opened this mount

  const items = renderedFamily.items || [];

  // Falls back to the family's first pack for both the image/category
  // preview AND the detail zone's pricing math whenever nothing is
  // explicitly selected - the pack rows themselves still key strictly off
  // selectedSku (none of them read as chosen until tapped), but the detail
  // zone's own CONTENT STRUCTURE (price line, ladder, caption) must stay
  // identical whether it's showing or hidden, or its height would change
  // the moment a real pack gets selected - the same class of bug as the
  // hint text that used to pop in on 0->1.
  const selectedProduct = items.find((item) => item.sku === selectedSku) || items[0];
  const previewSku = selectedSku || selectedProduct?.sku || null;
  // Same source DealerCatalogMobileView.jsx's card uses: one consistent
  // family photo regardless of which pack size is selected (there's no
  // per-pack association on ProductFamilyImageSchema to key off anyway),
  // falling back to the selected pack's own image only for the families
  // that don't have a dedicated family photo uploaded yet.
  const images = renderedFamily.images?.length ? renderedFamily.images : selectedProduct?.images || [];
  const activeImage = images[imageIndex] || images[0] || null;

  const cart = buildCart(draft.productsMap, draft.quantities);
  const previewQty = Number(draft.quantities?.[previewSku] || 0);
  const selectedPreviewCart =
    previewQty > 0 ? cart : buildCart(draft.productsMap, { ...draft.quantities, [previewSku]: 1 });
  const selectedLine = selectedPreviewCart.find((line) => line.sku === previewSku) || null;
  const tiers = selectedProduct?.pricing?.tiers || [];
  const unitPrice = selectedLine?.unitPrice || 0;
  const activeTier = selectedLine?.tier || null;
  const metricValue = selectedLine?.metricValue || 0;

  const otherFamilyLines = cart.filter((line) => line.code === renderedFamily.code && line.sku !== selectedSku);
  const familyLine = cart.find((line) => line.code === renderedFamily.code) || selectedLine;
  const familyOrdinal = familyLine?.tier ? tierOrdinal(familyLine?.pricing?.tiers || [], familyLine.tier) : null;
  const familyMetricLabel = familyLine
    ? familyLine.pricing?.basis === "VOLUME_TOTAL"
      ? `${familyLine.metricValue} L`
      : `${familyLine.metricValue} packs`
    : "";

  // No tier has a resolvable price (Wall Putty/Colorants pending the new
  // fiscal-year rate list) - block selecting a pack at all, since
  // buildCart()/getTierPrice() resolve an empty tier list to unitPrice:0
  // rather than "unavailable", and that would otherwise let a pack be
  // added to the cart for free.
  const isFamilyPriceless = items.length > 0 && items.every((item) => !(item?.pricing?.tiers || []).length);

  function selectPack(sku) {
    if (isFamilyPriceless || sku === selectedSku) return;
    setSelectedSku(sku);
  }

  function handlePointerDown(e) {
    if (images.length <= 1) return;
    dragRef.current = { startX: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return;
    setDragX(e.clientX - dragRef.current.startX);
  }
  function handlePointerUp() {
    if (!dragRef.current) return;
    if (Math.abs(dragX) > 40) {
      const direction = dragX < 0 ? 1 : -1;
      setImageIndex((i) => (i + direction + images.length) % images.length);
    }
    dragRef.current = null;
    setDragX(0);
  }

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      ariaLabel={renderedFamily.name}
      handleCoachMark={showHandleCoachMark}
      footer={
        <>
          {otherFamilyLines.length > 0 ? (
            <div className="dealer-m-sheet-family-hint">
              Family total: {familyMetricLabel}
              {familyOrdinal ? ` · Tier ${familyOrdinal} pricing` : ""}
            </div>
          ) : null}
          {/* Always mounted (not gated on itemCount) - the footer's height
              is reserved the moment the sheet opens, so going 0->1 fades
              the pill in in place (a plain opacity/transform transition)
              instead of the footer suddenly appearing and the whole sheet
              growing taller/pushing the preview content up to make room. */}
          <CartPill inline onBeforeNavigate={onClose} />
        </>
      }
    >
      <div
        className="dealer-m-sheet-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {activeImage?.url ? (
          <div
            className="dealer-m-sheet-stage-frame"
            style={{
              transform: `translateX(${dragX}px)`,
              transition: dragRef.current ? "none" : "transform 300ms var(--ease-sheet, ease)",
            }}
          >
            <img
              src={activeImage.url}
              alt={renderedFamily.name}
              draggable={false}
              onClick={() => !dragRef.current && setImageIndex((i) => (i + 1) % images.length)}
            />
          </div>
        ) : (
          <DashboardIcon name="package" size={64} strokeWidth={1.2} />
        )}
        {images.length > 1 ? (
          <div className="dealer-m-sheet-dots">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`dealer-m-sheet-dot ${index === imageIndex ? "active" : ""}`}
                onClick={() => setImageIndex(index)}
                aria-label={`Image ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="dealer-m-sheet-identity">
        <div className="dealer-m-sheet-name">{renderedFamily.name}</div>
        <div className="dealer-m-sheet-category">{categoryLabel(renderedFamily.category)}</div>
        {renderedFamily.description ? <div className="dealer-m-sheet-desc">{renderedFamily.description}</div> : null}
        {selectedProduct?.components?.length ? (
          <div className="dealer-m-sheet-desc">
            Includes: {selectedProduct.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
          </div>
        ) : null}
      </div>

      <div className="dealer-m-sheet-packs">
        {items.map((item) => {
          const isSelected = item.sku === selectedSku;
          const committedQty = Number(draft.quantities?.[item.sku] || 0);
          // Preview pricing for a pack that isn't in the cart yet still
          // needs a hypothetical qty>=1 override, since buildCart() only
          // returns lines with a real committed quantity - display only,
          // nothing here writes to the draft.
          const rowPreviewCart =
            committedQty > 0 ? cart : buildCart(draft.productsMap, { ...draft.quantities, [item.sku]: 1 });
          const rowLine = rowPreviewCart.find((line) => line.sku === item.sku);
          const rowTier = rowLine?.tier || null;
          const rowBaseTier = item?.pricing?.tiers?.[0] || null;
          const rowUnitPrice = rowLine?.unitPrice || 0;
          const rowBasePrice = rowBaseTier
            ? Number(rowBaseTier.pricePerPack ?? rowBaseTier.priceInclTax ?? rowBaseTier.priceExclTax ?? 0)
            : 0;
          const rowIsDeeper = rowTier && rowBaseTier && rowTier !== rowBaseTier;

          return (
            <div key={item.sku} className={`dealer-m-sheet-pack-row ${isSelected ? "selected" : ""} ${isFamilyPriceless ? "priceless" : ""}`}>
              <button
                type="button"
                className="dealer-m-sheet-pack-row-head"
                onClick={() => selectPack(item.sku)}
                disabled={isFamilyPriceless}
              >
                <span className="dealer-m-sheet-pack-info">
                  <span className="dealer-m-sheet-pack-label">{formatPack(item.pack)}</span>
                  <span className="dealer-m-sheet-pack-price-line">
                    {isFamilyPriceless ? (
                      "Pricing pending"
                    ) : (
                      <>
                        {rowIsDeeper ? <span className="dealer-m-sheet-pack-price-base">{formatMoney(rowBasePrice)}</span> : null}
                        {formatMoney(rowUnitPrice)}/pack
                      </>
                    )}
                  </span>
                </span>
                {isSelected ? (
                  <span className="dealer-m-sheet-pack-check">
                    <DashboardIcon name="checkmark" size={12} strokeWidth={3} />
                  </span>
                ) : committedQty > 0 ? (
                  <span className="dealer-m-sheet-pack-chip">×{committedQty}</span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {/* Fixed height always - never grid-rows/height animated. Reveal
          wipes from the bottom edge upward (clip-path top-inset shrinking
          100%->0%); hide reverses the same property, so the fold visibly
          retreats top-to-bottom. Content underneath is always rendered
          (see previewSku above) so nothing about its shape changes across
          the reveal - only opacity/clip-path move, both compositor-only. */}
      <div ref={detailRef} className={`dealer-m-sheet-detail ${selectedSku ? "expanded" : ""}`}>
        <div className="dealer-m-sheet-detail-row">
          <div className="dealer-m-sheet-pack-qty-col">
            <div className="dealer-m-sheet-pack-qty-label">Quantity</div>
            <QuantityStepper
              value={previewQty}
              onChange={(next) => {
                if (!selectedSku) return;
                draft.setQuantity(selectedSku, next);
                // Dropping to zero deselects the row instead of sitting
                // there expanded-but-empty - matches how a fresh pack
                // starts (nothing selected until tapped), so re-adding
                // requires the same deliberate tap rather than looking
                // half-active.
                if (next === 0) setSelectedSku(null);
              }}
              min={0}
              size={36}
            />
          </div>
          <div className="dealer-m-sheet-pack-math-col">
            <div className="dealer-m-sheet-pack-math-line">
              {previewQty} × {formatMoney(unitPrice)}
            </div>
            <div className="dealer-m-sheet-pack-math-total">{formatMoney(unitPrice * previewQty)}</div>
          </div>
        </div>
        <TierProgressBar
          variant="ladder"
          tiers={tiers}
          metricValue={metricValue}
          activeTier={activeTier}
          pricing={selectedProduct?.pricing}
          productName={renderedFamily.name}
        />
      </div>
    </MobileSheet>
  );
}
