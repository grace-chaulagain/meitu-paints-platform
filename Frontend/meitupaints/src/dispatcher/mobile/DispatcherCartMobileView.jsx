import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useCreateDispatcherReplenishmentOrderMutation,
  useGetProductFamiliesQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useDispatcherOrderDraft } from "./useDispatcherOrderDraft.js";
import { useSwipeAction } from "../../dealer/mobile/useSwipeAction.js";
import { QuantityStepper } from "../../dealer/mobile/QuantityStepper.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { playCompletion } from "../../dealer/mobile/completionFeedback.js";
import { toast } from "../../dealer/mobile/useToast.js";

const PAYMENT_METHODS = [
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank Guarantee" },
  { key: "CREDIT", label: "Credit" },
];

const REVEAL_WIDTH = 72;
const COLLAPSE_MS = 250;

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

// Mirrors src/dealer/mobile/DealerCartMobileView.jsx's CartLineRow, minus the
// tier-savings math (flat dispatcher pricing - see dispatcherOrderPricing.js)
// and keyed by productId instead of sku.
function CartLineRow({ line, group, revealedId, onReveal, onRemoveLine, onChangeQuantity, isRemoving }) {
  const swipe = useSwipeAction({
    axis: "x",
    onCommit: ({ passed }) => {
      onReveal(passed ? line.productId : null);
      return passed ? -REVEAL_WIDTH : 0;
    },
  });

  useEffect(() => {
    if (revealedId !== line.productId) swipe.setPos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedId, line.productId]);

  const label = `${group.name} · ${line.packLabel}`;

  return (
    <div className={`dealer-m-cart-line-wrap ${isRemoving ? "removing" : ""}`}>
      <div className="dealer-m-cart-line-wrap-inner">
        <div className="dealer-m-cart-line-swipe-track">
          <button type="button" className="dealer-m-cart-line-remove-action" onClick={() => onRemoveLine(line.productId, label, group)}>
            <DashboardIcon name="trash" size={18} strokeWidth={1.8} />
            Remove
          </button>
          <div className="dealer-m-cart-line" ref={swipe.ref} {...swipe.handlers}>
            <div className="dealer-m-cart-line-info">
              <div className="dealer-m-cart-line-label">
                {line.packLabel} &times; {line.quantity}
              </div>
              <div className="dealer-m-cart-line-rate">{money(line.unitPrice, line.currency)}/pack</div>
            </div>
            <div className="dealer-m-cart-line-total">{money(line.lineTotal, line.currency)}</div>
            <QuantityStepper
              value={line.quantity}
              onChange={(next) => {
                if (next === 0) onRemoveLine(line.productId, label, group);
                else onChangeQuantity(line.productId, next);
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

// Mirrors src/dealer/mobile/DealerCartMobileView.jsx overall (review list +
// confirm sheet + placed screen, one component). Order submission below
// intentionally rebuilds the same {items, paymentMethod, note} payload
// DispatcherOrderCartPage.jsx's desktop handleSubmit sends to
// useCreateDispatcherReplenishmentOrderMutation - no separate totals
// breakdown needed since the backend recomputes from productId+quantity.
export function DispatcherCartMobileView() {
  const navigate = useNavigate();
  const draft = useDispatcherOrderDraft();
  const familiesQuery = useGetProductFamiliesQuery();
  const [createReplenishmentOrder] = useCreateDispatcherReplenishmentOrderMutation();

  const [stage, setStage] = useState("cart"); // "cart" | "confirm" | "placed"
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [removingFamilies, setRemovingFamilies] = useState(() => new Set());
  const [revealedId, setRevealedId] = useState(null);
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

  function removeLine(productId, label, group) {
    if (removingIds.has(productId)) return;
    lastSnapshotRef.current = { ...draft.quantities };
    setRevealedId((prev) => (prev === productId ? null : prev));
    setRemovingIds((prev) => new Set(prev).add(productId));
    const isLastLine = group
      ? group.lines.every((line) => line.productId === productId || removingIds.has(line.productId))
      : false;
    if (isLastLine) setRemovingFamilies((prev) => new Set(prev).add(group.code));
    const timerId = setTimeout(() => {
      removeTimersRef.current.delete(timerId);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      if (isLastLine) {
        setRemovingFamilies((prev) => {
          const next = new Set(prev);
          next.delete(group.code);
          return next;
        });
      }
      draft.setQuantity(productId, 0);
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
      const idsToRemove = new Set(group.lines.map((line) => line.productId));
      const nextQuantities = Object.fromEntries(
        Object.entries(draft.quantities).filter(([productId]) => !idsToRemove.has(productId)),
      );
      draft.setDraft(nextQuantities);
      toast(`Removed ${group.name}`, { action: { label: "Undo", onClick: handleUndo }, duration: 5000 });
    }, COLLAPSE_MS);
    removeTimersRef.current.add(timerId);
  }

  const familyByCode = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [familiesQuery.data]);

  const familyGroups = useMemo(() => {
    const map = new Map();
    for (const line of draft.cart) {
      const key = line.code || line.productId;
      if (!map.has(key)) map.set(key, { code: key, name: line.name, lines: [] });
      map.get(key).lines.push(line);
    }
    return Array.from(map.values());
  }, [draft.cart]);

  async function handleConfirm() {
    if (draft.cart.length === 0) return;
    if (!paymentMethod) {
      setSubmitError("Select a payment method to continue.");
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError("");
      const orderItems = draft.cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
      const res = await createReplenishmentOrder({ items: orderItems, paymentMethod, note: note.trim() }).unwrap();
      setPlacedOrder(res?.item || null);
      draft.clear();
      setStage("placed");
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
          <PrimaryButton onClick={() => navigate("/dispatcher/orders")}>View orders</PrimaryButton>
          <button type="button" className="dealer-m-placed-secondary" onClick={() => navigate("/dispatcher")}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (draft.cart.length === 0) {
    return (
      <div className="dealer-m-cart">
        <MobilePushHeader title="Cart" onBack={() => navigate("/dispatcher/catalog")} />
        <div className="dealer-m-empty">
          <DashboardIcon name="cart" size={44} strokeWidth={1.3} className="dealer-m-empty-icon" />
          <div className="dealer-m-empty-title">Nothing here yet</div>
          <Link to="/dispatcher/catalog" className="dealer-m-empty-action">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const currency = draft.cart[0]?.currency || "NPR";

  return (
    <div className="dealer-m-cart">
      <MobilePushHeader title="Cart" onBack={() => navigate("/dispatcher/catalog")} />
      <div className="dealer-m-cart-title">Your order</div>
      <div className="dealer-m-cart-subtitle">
        {draft.itemCount} item{draft.itemCount === 1 ? "" : "s"}
      </div>

      <div className="dealer-m-cart-list">
        {familyGroups.map((group) => {
          const familySubtotal = group.lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
          const image = getPrimaryImage(familyByCode[group.code]?.images);
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
                    <span className="dealer-m-cart-card-subtotal">{money(familySubtotal, currency)}</span>
                    <button type="button" className="dealer-m-cart-card-remove" onClick={() => removeFamily(group)}>
                      Remove
                    </button>
                  </div>

                  {group.lines.map((line) => (
                    <CartLineRow
                      key={line.productId}
                      line={line}
                      group={group}
                      revealedId={revealedId}
                      onReveal={setRevealedId}
                      onRemoveLine={removeLine}
                      onChangeQuantity={(productId, next) => draft.setQuantity(productId, next)}
                      isRemoving={removingIds.has(line.productId)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dealer-m-cart-summary">
        <div className="dealer-m-cart-summary-row dealer-m-cart-summary-total">
          <span>Total</span>
          <span>{money(draft.subtotal, currency)}</span>
        </div>
      </div>

      <div className="dealer-m-cart-footer">
        <PrimaryButton onClick={() => setStage("confirm")}>Place order — {money(draft.subtotal, currency)}</PrimaryButton>
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
          <div className="dealer-m-confirm-row dealer-m-confirm-row-total">
            <span>Total</span>
            <span>{money(draft.subtotal, currency)}</span>
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

        <div className="dealer-m-confirm-field-label">Note (optional)</div>
        <input
          className="dealer-m-confirm-note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Urgency, dispatch preference, or any special instruction…"
          maxLength={250}
        />

        {submitError ? <div className="dealer-m-confirm-error">{submitError}</div> : null}
      </MobileSheet>
    </div>
  );
}
