import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateDealerOrderMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney, formatPack, getTierLabel } from "../pricing.js";
import { useOrderDraft } from "./useOrderDraft.js";
import { useSwipeAction } from "./useSwipeAction.js";
import { QuantityStepper } from "./QuantityStepper.jsx";
import { TierProgressBar } from "./TierProgressBar.jsx";
import { PrimaryButton } from "./PrimaryButton.jsx";
import { MobileSheet } from "./MobileSheet.jsx";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { playCompletion } from "./completionFeedback.js";
import { toast } from "./useToast.js";

const PAYMENT_METHODS = [
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank Guarantee" },
  { key: "CREDIT", label: "Credit" },
];

const REVEAL_WIDTH = 72;
const COLLAPSE_MS = 250;

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function baseUnitPrice(tiers = []) {
  const first = tiers[0];
  return first ? Number(first.pricePerPack ?? first.priceInclTax ?? first.priceExclTax ?? 0) : 0;
}

// V3 §4: swipe-left-to-remove + a fixed-width red reveal action, wrapped in
// its own grid-rows collapse for the removal choreography. A separate
// component because useSwipeAction is a hook and can't be called inside
// the parent's familyGroups.map() (Rules of Hooks). `revealedSku` is owned
// by the parent so opening one row's swipe closes any other - this row
// just watches for that and snaps itself shut via the hook's imperative
// setPos when it's no longer the revealed one.
function CartLineRow({ line, group, revealedSku, onReveal, onRemoveLine, onChangeQuantity, isRemoving }) {
  const swipe = useSwipeAction({
    axis: "x",
    onCommit: ({ passed }) => {
      onReveal(passed ? line.sku : null);
      return passed ? -REVEAL_WIDTH : 0;
    },
  });

  useEffect(() => {
    if (revealedSku !== line.sku) swipe.setPos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedSku, line.sku]);

  const label = `${group.name} · ${formatPack(line.pack)}`;

  return (
    <div className={`dealer-m-cart-line-wrap ${isRemoving ? "removing" : ""}`}>
      <div className="dealer-m-cart-line-wrap-inner">
        <div className="dealer-m-cart-line-swipe-track">
          <button type="button" className="dealer-m-cart-line-remove-action" onClick={() => onRemoveLine(line.sku, label, group)}>
            <DashboardIcon name="trash" size={18} strokeWidth={1.8} />
            Remove
          </button>
          <div className="dealer-m-cart-line" ref={swipe.ref} {...swipe.handlers}>
            <div className="dealer-m-cart-line-info">
              <div className="dealer-m-cart-line-label">
                {formatPack(line.pack)} &times; {line.quantity}
              </div>
              <div className="dealer-m-cart-line-rate">
                {formatMoney(line.unitPrice)}/pack
                {line.tier ? ` · ${getTierLabel(line.tier, line.pricing)}` : ""}
              </div>
            </div>
            <div className="dealer-m-cart-line-total">{formatMoney(line.lineTotal)}</div>
            <QuantityStepper
              value={line.quantity}
              onChange={(next) => {
                if (next === 0) onRemoveLine(line.sku, label, group);
                else onChangeQuantity(line.sku, next);
              }}
              min={0}
              size={28}
              showRemoveHint
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Spec §4.4: Cart *is* checkout - no separate route. Three stages in one
// component: the review list, the confirm sheet, and the placed/success
// screen. Draft state comes from useOrderDraft() (the same live-synced
// source Catalog/ProductSheet use); order submission below intentionally
// rebuilds the same payload shape DealerCartPage.jsx's desktop handleSubmit
// sends to useCreateDealerOrderMutation - the two views don't share that
// function directly since the desktop form's payment/note state isn't
// structured the same way as this confirm sheet's, but the resulting
// payload contract with the backend is identical.
export function DealerCartMobileView() {
  const navigate = useNavigate();
  const draft = useOrderDraft();
  const [createDealerOrder] = useCreateDealerOrderMutation();

  const [stage, setStage] = useState("cart"); // "cart" | "confirm" | "placed"
  const [dealerNote, setDealerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  // V3 §4: removal state. removingSkus/removingFamilies stage the visual
  // collapse before the real draft mutation happens (same "delay the
  // mutation until the animation finishes" technique as MobileSheet's exit
  // and the Browse search overlay's close) - removeLine/removeFamily are
  // the ONLY places that ever zero out a quantity for a removal; the
  // stepper-to-0, swipe-commit, and family-button paths all funnel through
  // them. lastSnapshotRef keeps just the one most-recent pre-removal
  // snapshot ("keep the last snapshot only; a new removal replaces it").
  const [removingSkus, setRemovingSkus] = useState(() => new Set());
  const [removingFamilies, setRemovingFamilies] = useState(() => new Set());
  const [revealedSku, setRevealedSku] = useState(null);
  const lastSnapshotRef = useRef(null);
  const removeTimersRef = useRef(new Set());

  useEffect(() => {
    const timers = removeTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  function handleUndo() {
    if (!lastSnapshotRef.current) return;
    draft.setDraft(lastSnapshotRef.current);
    lastSnapshotRef.current = null;
  }

  function removeLine(sku, label, group) {
    if (removingSkus.has(sku)) return;
    lastSnapshotRef.current = { ...draft.quantities };
    setRevealedSku((prev) => (prev === sku ? null : prev));
    setRemovingSkus((prev) => new Set(prev).add(sku));
    // If every OTHER line in this family is already gone/removing, this is
    // the last one standing - collapse the whole card in the same beat
    // instead of leaving an empty card shell to pop away a moment later
    // once the line-level removal alone finishes.
    const isLastLine = group ? group.lines.every((line) => line.sku === sku || removingSkus.has(line.sku)) : false;
    if (isLastLine) setRemovingFamilies((prev) => new Set(prev).add(group.code));
    const timerId = setTimeout(() => {
      removeTimersRef.current.delete(timerId);
      setRemovingSkus((prev) => {
        const next = new Set(prev);
        next.delete(sku);
        return next;
      });
      if (isLastLine) {
        setRemovingFamilies((prev) => {
          const next = new Set(prev);
          next.delete(group.code);
          return next;
        });
      }
      draft.setQuantity(sku, 0);
      toast(`Removed ${label}`, { action: { label: "Undo", onClick: handleUndo }, duration: 5000 });
    }, COLLAPSE_MS);
    removeTimersRef.current.add(timerId);
  }

  function removeFamily(group) {
    if (removingFamilies.has(group.code)) return;
    lastSnapshotRef.current = { ...draft.quantities };
    setRemovingFamilies((prev) => new Set(prev).add(group.code));
    const timerId = setTimeout(() => {
      removeTimersRef.current.delete(timerId);
      setRemovingFamilies((prev) => {
        const next = new Set(prev);
        next.delete(group.code);
        return next;
      });
      const skusToRemove = new Set(group.lines.map((line) => line.sku));
      const nextQuantities = Object.fromEntries(
        Object.entries(draft.quantities).filter(([sku]) => !skusToRemove.has(sku)),
      );
      draft.setDraft(nextQuantities);
      toast(`Removed ${group.name}`, { action: { label: "Undo", onClick: handleUndo }, duration: 5000 });
    }, COLLAPSE_MS);
    removeTimersRef.current.add(timerId);
  }

  // Group cart lines by family (code) for the card-per-family layout.
  const familyGroups = useMemo(() => {
    const map = new Map();
    for (const line of draft.cart) {
      const key = line.code || line.sku;
      if (!map.has(key)) map.set(key, { code: key, name: line.name, components: line.components || [], lines: [] });
      map.get(key).lines.push(line);
    }
    return Array.from(map.values());
  }, [draft.cart]);

  const totalVolume = draft.cart.reduce((sum, line) => {
    if (line?.pricing?.basis === "VOLUME_TOTAL") return sum + Number(line.localMetricValue || 0);
    return sum;
  }, 0);

  async function handleConfirm() {
    if (draft.cart.length === 0) return;
    if (!paymentMethod) {
      setSubmitError("Select a payment method to continue.");
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError("");
      const subtotal = Number(draft.subtotal || 0);
      const payload = {
        items: draft.cart.map((item) => ({
          productId: draft.productsMap?.[item.sku]?._id || null,
          sku: item.sku || "",
          code: item.code || "",
          name: item.name || "",
          category: item.category || "",
          variantLabel: item.tier ? getTierLabel(item.tier, item.pricing) : "",
          packLabel: formatPack(item.pack),
          quantity: Number(item.quantity || 0),
          unit: item?.pack?.unit || "",
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: Number(item.lineTotal || 0),
          notes: "",
          components: item.components || [],
        })),
        totals: { subtotal, discount: 0, taxableAmount: subtotal, tax: 0, total: subtotal, currency: draft.cart[0]?.currency || "NPR" },
        payment: { method: paymentMethod, reference: "", note: "" },
        dealerNote: dealerNote.trim(),
        internalNote: "",
      };
      const res = await createDealerOrder(payload).unwrap();
      setPlacedOrder(res?.item || null);
      draft.clear();
      setStage("placed");
      // Rare, meaningful completion (spec §2.6) - fired here, inside the
      // click handler's async continuation, rather than in a mount effect
      // on the placed screen, so it stays inside the gesture chain the
      // click started (Web Audio's autoplay policy needs that lineage).
      playCompletion();
    } catch (err) {
      setSubmitError(getQueryErrorMessage(err, "Failed to place order."));
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "placed") {
    return (
      <div className="dealer-m-placed">
        <div className="dealer-m-placed-check dealer-m-placed-stage-1">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              className="dealer-m-placed-check-path"
            />
          </svg>
        </div>
        <div className="dealer-m-placed-title dealer-m-placed-stage-2">Order placed</div>
        {placedOrder?.orderNumber ? (
          <div className="dealer-m-placed-number dealer-m-placed-stage-3">{placedOrder.orderNumber}</div>
        ) : null}
        <div className="dealer-m-placed-actions dealer-m-placed-stage-4">
          {placedOrder?._id ? (
            <PrimaryButton onClick={() => navigate(`/dealer/orders/${placedOrder._id}`)}>Track order</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => navigate("/dealer/orders")}>View orders</PrimaryButton>
          )}
          <button type="button" className="dealer-m-placed-secondary" onClick={() => navigate("/dealer")}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (draft.cart.length === 0) {
    return (
      <div className="dealer-m-cart">
        <MobilePushHeader title="Cart" onBack={() => navigate("/dealer/catalog")} />
        <div className="dealer-m-empty">
          <DashboardIcon name="cart" size={44} strokeWidth={1.3} className="dealer-m-empty-icon" />
          <div className="dealer-m-empty-title">Nothing here yet</div>
          <Link to="/dealer/catalog" className="dealer-m-empty-action">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-cart">
      <MobilePushHeader title="Cart" onBack={() => navigate("/dealer/catalog")} />
      <div className="dealer-m-cart-title">Your order</div>
      <div className="dealer-m-cart-subtitle">
        {draft.itemCount} item{draft.itemCount === 1 ? "" : "s"}
        {totalVolume > 0 ? ` · ${totalVolume} L total` : ""}
      </div>

      <div className="dealer-m-cart-list">
        {familyGroups.map((group) => {
          const familySubtotal = group.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
          const image = getPrimaryImage(draft.productsMap?.[group.lines[0]?.sku]?.images);
          const savings = group.lines.reduce((sum, line) => {
            const base = baseUnitPrice(line?.pricing?.tiers || []);
            if (base && line.unitPrice < base) return sum + (base - line.unitPrice) * line.quantity;
            return sum;
          }, 0);
          const isRemovingFamily = removingFamilies.has(group.code);

          return (
            <div className={`dealer-m-cart-card-wrap ${isRemovingFamily ? "removing" : ""}`} key={group.code}>
              <div className="dealer-m-cart-card-wrap-inner">
                <div className="dealer-m-cart-card">
                  <div className="dealer-m-cart-card-head">
                    <span className="dealer-m-cart-card-thumb">
                      {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={18} strokeWidth={1.6} />}
                    </span>
                    <span className="dealer-m-cart-card-name">{group.name}</span>
                    <span className="dealer-m-cart-card-subtotal">{formatMoney(familySubtotal)}</span>
                    <button type="button" className="dealer-m-cart-card-remove" onClick={() => removeFamily(group)}>
                      Remove
                    </button>
                  </div>
                  {group.components?.length ? (
                    <div className="dealer-m-cart-card-components">
                      Includes: {group.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
                    </div>
                  ) : null}

                  {group.lines.map((line) => (
                    <CartLineRow
                      key={line.sku}
                      line={line}
                      group={group}
                      revealedSku={revealedSku}
                      onReveal={setRevealedSku}
                      onRemoveLine={removeLine}
                      onChangeQuantity={(sku, next) => draft.setQuantity(sku, next)}
                      isRemoving={removingSkus.has(line.sku)}
                    />
                  ))}

                  {savings > 0 ? (
                    <div className="dealer-m-cart-savings">Tier pricing applied — you&apos;re saving {formatMoney(savings)}</div>
                  ) : null}

                  <TierProgressBar
                    variant="nudge"
                    tiers={group.lines[0]?.pricing?.tiers || []}
                    metricValue={group.lines[0]?.metricValue || 0}
                    activeTier={group.lines[0]?.tier || null}
                    pricing={group.lines[0]?.pricing}
                    productName={group.name}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dealer-m-cart-summary">
        <div className="dealer-m-cart-summary-row">
          <span>Subtotal</span>
          <span>{formatMoney(draft.subtotal)}</span>
        </div>
        {totalVolume > 0 ? (
          <div className="dealer-m-cart-summary-row">
            <span>Total volume</span>
            <span>{totalVolume} L</span>
          </div>
        ) : null}
        <div className="dealer-m-cart-summary-row dealer-m-cart-summary-total">
          <span>Total</span>
          <span>{formatMoney(draft.subtotal)}</span>
        </div>
      </div>

      <div className="dealer-m-cart-footer">
        <PrimaryButton onClick={() => setStage("confirm")}>Place order — {formatMoney(draft.subtotal)}</PrimaryButton>
      </div>

      <MobileSheet
        open={stage === "confirm"}
        onClose={() => setStage("cart")}
        ariaLabel="Confirm order"
        footer={
          <PrimaryButton onClick={handleConfirm} loading={submitting} disabled={draft.cart.length === 0}>
            Confirm order
          </PrimaryButton>
        }
      >
        <div className="dealer-m-confirm-title">Confirm order</div>
        <div className="dealer-m-confirm-summary">
          <div className="dealer-m-confirm-row">
            <span>Items</span>
            <span>{draft.itemCount}</span>
          </div>
          {totalVolume > 0 ? (
            <div className="dealer-m-confirm-row">
              <span>Volume</span>
              <span>{totalVolume} L</span>
            </div>
          ) : null}
          <div className="dealer-m-confirm-row dealer-m-confirm-row-total">
            <span>Total</span>
            <span>{formatMoney(draft.subtotal)}</span>
          </div>
        </div>

        <div className="dealer-m-confirm-field-label">Payment method</div>
        <div className="dealer-m-confirm-payment-chips">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.key}
              type="button"
              className={`dealer-m-confirm-payment-chip ${paymentMethod === method.key ? "active" : ""}`}
              onClick={() => setPaymentMethod(method.key)}
            >
              {method.label}
            </button>
          ))}
        </div>

        <div className="dealer-m-confirm-field-label">Delivery note (optional)</div>
        <input
          className="dealer-m-confirm-note-input"
          value={dealerNote}
          onChange={(e) => setDealerNote(e.target.value)}
          placeholder="Any note for this delivery…"
          maxLength={250}
        />

        {submitError ? <div className="dealer-m-confirm-error">{submitError}</div> : null}
      </MobileSheet>
    </div>
  );
}
