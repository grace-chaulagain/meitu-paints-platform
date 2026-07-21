import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { QuantityStepper } from "../../dealer/mobile/QuantityStepper.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { DispatcherCartPill } from "./DispatcherCartPill.jsx";

// Mirrors src/dealer/mobile/ProductSheet.jsx, minus the tier ladder/"family
// total" pricing preview - dispatcher pricing (DispatcherProductPrice) is a
// flat per-SKU rate, not the volume-tiered Product.pricing.tiers dealers
// see, so there's no tier math to preview here at all (see
// dispatcherOrderPricing.js's header comment).
const COACH_MARK_KEY = "meitu_dispatcher_product_sheet_handle_coachmark_seen_v1";
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

function money(value) {
  return `NPR ${Number(value || 0).toLocaleString()}`;
}

export function DispatcherProductSheet({ open, onClose, family, draft }) {
  const [renderedFamily, setRenderedFamily] = useState(family);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [showHandleCoachMark, setShowHandleCoachMark] = useState(false);
  const dragRef = useRef(null);

  if (family && family !== renderedFamily) {
    setRenderedFamily(family);
  }

  useEffect(() => {
    if (!open || prefersReducedMotion()) return undefined;
    let alreadySeen = true;
    try {
      alreadySeen = Boolean(window.localStorage.getItem(COACH_MARK_KEY));
      if (!alreadySeen) window.localStorage.setItem(COACH_MARK_KEY, "1");
    } catch {
      return undefined;
    }
    if (alreadySeen) return undefined;
    setShowHandleCoachMark(true);
    const timer = setTimeout(() => setShowHandleCoachMark(false), COACH_MARK_DELAY_MS + COACH_MARK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open && family?.items?.length) {
      const existing = family.items.find((item) => Number(draft.quantities?.[item.productId] || 0) > 0);
      setSelectedProductId(existing?.productId || null);
      setImageIndex(0);
      setDragX(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, family?.code]);

  if (!renderedFamily) return null;

  const items = renderedFamily.items || [];
  const selectedProduct = items.find((item) => item.productId === selectedProductId) || items[0];
  const previewProductId = selectedProductId || selectedProduct?.productId || null;
  const images = renderedFamily.familyImages?.length ? renderedFamily.familyImages : selectedProduct?.images || [];
  const activeImage = images[imageIndex] || images[0] || null;

  const previewQty = Number(draft.quantities?.[previewProductId] || 0);
  const unitPrice = Number(selectedProduct?.price || 0);

  const otherFamilyLines = draft.cart.filter((line) => line.code === renderedFamily.code && line.productId !== selectedProductId);
  const familyQty = draft.cart
    .filter((line) => line.code === renderedFamily.code)
    .reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  function selectPack(productId) {
    if (productId === selectedProductId) return;
    setSelectedProductId(productId);
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
            <div className="dealer-m-sheet-family-hint">Family total: {familyQty} pack{familyQty === 1 ? "" : "s"}</div>
          ) : null}
          <DispatcherCartPill inline onBeforeNavigate={onClose} />
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
      </div>

      <div className="dealer-m-sheet-packs">
        {items.map((item) => {
          const isSelected = item.productId === selectedProductId;
          const committedQty = Number(draft.quantities?.[item.productId] || 0);
          const isPriceless = !Number(item.price);

          return (
            <div key={item.productId} className={`dealer-m-sheet-pack-row ${isSelected ? "selected" : ""} ${isPriceless ? "priceless" : ""}`}>
              <button
                type="button"
                className="dealer-m-sheet-pack-row-head"
                onClick={() => selectPack(item.productId)}
                disabled={isPriceless}
              >
                <span className="dealer-m-sheet-pack-info">
                  <span className="dealer-m-sheet-pack-label">{item.packLabel}</span>
                  <span className="dealer-m-sheet-pack-price-line">
                    {isPriceless ? "Pricing pending" : `${money(item.price)}/pack`}
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

      <div className={`dealer-m-sheet-detail ${selectedProductId ? "expanded" : ""}`}>
        <div className="dealer-m-sheet-detail-row">
          <div className="dealer-m-sheet-pack-qty-col">
            <div className="dealer-m-sheet-pack-qty-label">Quantity</div>
            <QuantityStepper
              value={previewQty}
              onChange={(next) => {
                if (!selectedProductId) return;
                draft.setQuantity(selectedProductId, next);
                if (next === 0) setSelectedProductId(null);
              }}
              min={0}
              size={36}
            />
          </div>
          <div className="dealer-m-sheet-pack-math-col">
            <div className="dealer-m-sheet-pack-math-line">
              {previewQty} × {money(unitPrice)}
            </div>
            <div className="dealer-m-sheet-pack-math-total">{money(unitPrice * previewQty)}</div>
          </div>
        </div>
      </div>
    </MobileSheet>
  );
}
