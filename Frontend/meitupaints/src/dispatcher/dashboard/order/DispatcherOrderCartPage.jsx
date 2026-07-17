import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateDispatcherReplenishmentOrderMutation,
  useGetDispatcherReplenishmentCatalogQuery,
  useGetProductFamiliesQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { buildCart as buildPricedCart, calculateCartTotals } from "./dispatcherOrderPricing.js";
import { clearDraft, loadDraft, saveDraft, sanitizeDraft } from "./dispatcherOrderDraftStorage.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Dropdown,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

const PAYMENT_METHODS = [
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank Guarantee" },
  { key: "CREDIT", label: "Credit" },
];

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function buildCart(itemsByProductId, quantities, familyMap) {
  return buildPricedCart(itemsByProductId, quantities).map((line) => {
    const family = familyMap?.[line.code] || null;
    return {
      ...line,
      image: getPrimaryImage(family?.images || []) || null,
    };
  });
}

function QtyStepper({ value, onChange }) {
  const qty = Number(value || 0);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,.12)", overflow: "hidden" }}>
      <button type="button" onClick={() => onChange(Math.max(0, qty - 1))} aria-label="Decrease quantity" style={{ width: 32, height: 34, border: "none", borderRight: "1px solid rgba(0,0,0,.1)", background: "transparent", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "var(--color-ink, #1d1d1f)" }}>−</button>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value === "" ? "" : Math.max(0, Number(event.target.value)))}
        style={{ width: 42, height: 34, border: "none", outline: "none", background: "transparent", textAlign: "center", fontWeight: 700, color: "var(--color-ink, #1d1d1f)", fontSize: 13 }}
      />
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Increase quantity" style={{ width: 32, height: 34, border: "none", borderLeft: "1px solid rgba(0,0,0,.1)", background: "transparent", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "var(--color-ink, #1d1d1f)" }}>+</button>
    </div>
  );
}

const CART_TABLE_COLUMNS = "minmax(0,1fr) 110px 130px 110px 36px";

function CartTableHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: CART_TABLE_COLUMNS, gap: 14, alignItems: "center", padding: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
      <span>Product</span>
      <span style={{ textAlign: "right" }}>Unit Price</span>
      <span style={{ textAlign: "center" }}>Qty</span>
      <span style={{ textAlign: "right" }}>Total</span>
      <span aria-hidden="true" />
    </div>
  );
}

function CartLine({ item, onQtyChange, onRemove }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: CART_TABLE_COLUMNS, gap: 14, alignItems: "center", padding: "16px 0", borderTop: "1px solid rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: "var(--color-fog, #f5f5f7)", overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0 }}>
          {item.image?.url ? (
            <img src={item.image.url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <DashboardIcon name="package" size={22} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{item.name}</div>
          <div style={{ marginTop: 3, fontSize: 12, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{item.packLabel || "Variant"}</div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Product Code: {item.sku}</div>
        </div>
      </div>

      <div style={{ textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
        {money(item.unitPrice, item.currency)}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <QtyStepper value={item.quantity} onChange={(next) => onQtyChange(item.productId, next)} />
      </div>

      <div style={{ textAlign: "right", fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
        {money(item.lineTotal, item.currency)}
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.productId)}
        aria-label={`Remove ${item.name}`}
        style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(0,0,0,.1)", background: "#fff", color: "#b42318", cursor: "pointer", display: "grid", placeItems: "center", justifySelf: "end" }}
      >
        <DashboardIcon name="trash" size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{label}</span>
      <strong style={{ fontSize: strong ? 16 : 13, color: "var(--color-ink, #1d1d1f)" }}>{value}</strong>
    </div>
  );
}

export default function DispatcherOrderCartPage() {
  const navigate = useNavigate();
  const catalogQuery = useGetDispatcherReplenishmentCatalogQuery();
  const familiesQuery = useGetProductFamiliesQuery();
  const [createReplenishmentOrder] = useCreateDispatcherReplenishmentOrderMutation();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const families = useMemo(() => familiesQuery.data || [], [familiesQuery.data]);

  const loading = catalogQuery.isLoading && items.length === 0;
  const refreshing = !loading && (catalogQuery.isFetching || familiesQuery.isFetching);
  const catalogError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load your price list.") : "";

  const [quantities, setQuantities] = useState(() => loadDraft());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [paymentPrompted, setPaymentPrompted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleError = error || catalogError;

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  const itemsByProductId = useMemo(() => {
    const map = {};
    for (const item of items) map[item.productId] = item;
    return map;
  }, [items]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of families) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [families]);

  const cart = useMemo(() => buildCart(itemsByProductId, quantities, familyMap), [itemsByProductId, quantities, familyMap]);
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);
  const currency = cart[0]?.currency || "NPR";
  const paymentRequired = cart.length > 0 && !paymentMethod;

  function setQuantity(productId, value) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [productId]: value }));
  }

  function removeLine(productId) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [productId]: 0 }));
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      setError("Your order is empty.");
      return;
    }
    if (!paymentMethod) {
      setPaymentPrompted(true);
      setError("Select a payment method before placing this order. This is required for internal review and payment tracking.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const orderItems = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
      const res = await createReplenishmentOrder({ items: orderItems, paymentMethod, note: note.trim() }).unwrap();
      setSuccess(res?.message || "Order submitted. Admin will review it shortly.");
      setQuantities({});
      clearDraft();
      setNote("");
      setPaymentMethod("");
      setPaymentPrompted(false);
      setTimeout(() => navigate("/dispatcher/dashboard/order/history"), 1200);
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to submit order."));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = cart.length === 0 || submitting;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <SectionHeader
          icon="package"
          title="My Cart"
          size="small"
          subtitle="Review your selected items before placing an order."
          action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid rgba(29,29,31,.1)", background: "#fff", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", flexShrink: 0 }}>
          <DashboardIcon name="package" size={15} strokeWidth={1.8} />
          {totals.totalQty} item{totals.totalQty === 1 ? "" : "s"}
        </div>
      </div>

      {visibleError || success ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, fontWeight: 600, fontSize: 13, background: visibleError ? "rgba(180,35,24,.08)" : "rgba(22,163,74,.08)", color: visibleError ? "#b42318" : "#15803d" }}>
          {visibleError || success}
        </div>
      ) : null}

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : (
        <div className="dispatcher-cart-layout">
          <Surface padding={cart.length === 0 ? 0 : 20} style={{ overflow: "hidden" }} className="dash-fade-up">
            {cart.length === 0 ? (
              <div style={{ padding: 20 }}>
                <EmptyState icon="package" title="Your order is empty" subtitle="Go back to the catalog and add products - they'll appear here for review." />
                <div style={{ marginTop: 4 }}>
                  <GhostButton onClick={() => navigate("/dispatcher/dashboard/order")}>Return to Catalog</GhostButton>
                </div>
              </div>
            ) : (
              <>
                <CartTableHeader />
                <div>
                  {cart.map((item) => (
                    <CartLine key={item.productId} item={item} onQtyChange={setQuantity} onRemove={removeLine} />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/dispatcher/dashboard/order")}
                  style={{ marginTop: 18, width: "100%", height: 48, borderRadius: 12, border: "1.5px dashed rgba(0,113,227,.35)", background: "rgba(0,113,227,.03)", color: "var(--color-azure, #0071e3)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <DashboardIcon name="plus" size={14} strokeWidth={2.2} />
                  Add more products
                </button>
              </>
            )}
          </Surface>

          <div className="dispatcher-cart-summary-rail">
            <Surface padding={20} style={{ display: "grid", gap: 16 }} className="dash-fade-up">
              <SectionHeader size="small" title="Order Summary" />

              <div style={{ display: "grid", gap: 10, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                <SummaryRow label="Estimated Subtotal" value={money(totals.subtotal, currency)} strong />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: paymentRequired ? "#b42318" : "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    Payment Method
                  </label>
                  <Pill tone={paymentMethod ? "positive" : "critical"} size="small">{paymentMethod ? "Selected" : "Required"}</Pill>
                </div>
                <Dropdown
                  value={paymentMethod}
                  options={PAYMENT_METHODS}
                  placeholder="Select payment method"
                  critical={paymentRequired}
                  onChange={(value) => {
                    setPaymentMethod(value);
                    setPaymentPrompted(false);
                    if (error?.startsWith("Select a payment method")) setError("");
                  }}
                  style={{ width: "100%" }}
                />
                {paymentRequired && paymentPrompted ? (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(180,35,24,.06)", color: "#b42318", fontSize: 12.5, fontWeight: 600 }}>
                    Choose how this order will be paid - Meitu uses this for review and payment follow-up.
                  </div>
                ) : null}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Note (optional)</label>
                <textarea
                  rows={4}
                  maxLength={250}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Urgency, dispatch preference, or any special instruction…"
                  style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", padding: 12, fontSize: 13, resize: "vertical" }}
                />
                <div style={{ marginTop: 4, textAlign: "right", fontSize: 11, color: "var(--color-graphite, #707070)" }}>{note.length} / 250</div>
              </div>

              <PrimaryButton icon="lock" onClick={handleSubmit} disabled={disabled} style={{ width: "100%", height: 46 }}>
                {submitting ? "Placing Order…" : "Place Order"}
              </PrimaryButton>

              <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12, color: "var(--color-graphite, #707070)", lineHeight: 1.5, display: "flex", gap: 8 }}>
                <DashboardIcon name="info" size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: "var(--color-azure, #0071e3)" }} />
                <span>Once submitted, this becomes an official order for Meitu's internal review - routed through the same Admin review and Factory fulfillment as any other order.</span>
              </div>
            </Surface>
          </div>
        </div>
      )}

      <style>{`
        .dispatcher-cart-layout{
          display:grid;
          grid-template-columns:minmax(0,1fr) 340px;
          gap:16px;
          align-items:start;
        }
        .dispatcher-cart-summary-rail{
          position:sticky;
          top:0;
        }
        @media (max-width:960px){
          .dispatcher-cart-layout{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </div>
  );
}
