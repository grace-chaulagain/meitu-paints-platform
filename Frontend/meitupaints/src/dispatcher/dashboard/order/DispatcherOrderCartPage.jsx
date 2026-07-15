import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateDispatcherReplenishmentOrderMutation, useGetDispatcherReplenishmentCatalogQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { EmptyState, GhostButton, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { buildCart, calculateCartTotals } from "./dispatcherOrderPricing.js";
import { clearDraft, loadDraft, saveDraft } from "./dispatcherOrderDraftStorage.js";

const PAYMENT_METHODS = [
  { key: "CREDIT", label: "Credit (settled with company)" },
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online" },
  { key: "CHEQUE", label: "Cheque" },
];

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function stepperButtonStyle() {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    color: "var(--color-ink, #1d1d1f)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
  };
}

function QuantityStepper({ value, onChange }) {
  const qty = Number(value || 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button type="button" onClick={() => onChange(Math.max(0, qty - 1))} style={stepperButtonStyle()} aria-label="Decrease quantity">
        <DashboardIcon name="minus" size={11} strokeWidth={2.4} />
      </button>
      <span style={{ minWidth: 26, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} style={stepperButtonStyle()} aria-label="Increase quantity">
        <DashboardIcon name="plus" size={11} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function fieldTextareaStyle() {
  return {
    width: "100%",
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: 12,
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
    resize: "vertical",
  };
}

export default function DispatcherOrderCartPage() {
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState(() => loadDraft());
  const [paymentMethod, setPaymentMethod] = useState("CREDIT");
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState({ status: "idle", message: "" });

  const catalogQuery = useGetDispatcherReplenishmentCatalogQuery({});
  const [createReplenishmentOrder, { isLoading: submitting }] = useCreateDispatcherReplenishmentOrderMutation();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const itemsById = useMemo(() => {
    const map = {};
    for (const item of items) map[item.productId] = item;
    return map;
  }, [items]);

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  const cart = useMemo(() => buildCart(itemsById, quantities), [itemsById, quantities]);
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);

  function setQuantity(productId, value) {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  }

  function removeLine(productId) {
    setQuantities((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      setSubmitState({ status: "error", message: "Add at least one item before submitting." });
      return;
    }
    if (!paymentMethod.trim()) {
      setSubmitState({ status: "error", message: "Select a payment method." });
      return;
    }

    setSubmitState({ status: "idle", message: "" });

    try {
      const orderItems = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
      await createReplenishmentOrder({ items: orderItems, paymentMethod, note }).unwrap();
      setQuantities({});
      clearDraft();
      setNote("");
      setSubmitState({ status: "success", message: "Order submitted. Admin will review it shortly." });
      setTimeout(() => navigate("/dispatcher/dashboard/order/history"), 1200);
    } catch (error) {
      setSubmitState({ status: "error", message: getQueryErrorMessage(error, "Failed to submit order.") });
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,.85fr)", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 14 }}>
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader
            icon="package"
            title="Review Order"
            subtitle="Confirm quantities and payment before submitting to the Factory."
            action={
              <GhostButton icon="package" onClick={() => navigate("/dispatcher/dashboard/order")}>
                Add more products
              </GhostButton>
            }
          />
        </Surface>

        {cart.length === 0 ? (
          <EmptyState icon="package" title="Your order is empty" subtitle="Add products from the catalog to get started." />
        ) : (
          <Surface padding={0} className="dash-fade-up">
            <div className="dispatcher-cart-table-header">
              <span>Product</span>
              <span style={{ textAlign: "right" }}>Unit Price</span>
              <span style={{ textAlign: "center" }}>Qty</span>
              <span style={{ textAlign: "right" }}>Total</span>
              <span aria-hidden="true" />
            </div>
            {cart.map((line) => (
              <div key={line.productId} className="dispatcher-cart-table-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{line.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    {line.sku}{line.packLabel ? ` · ${line.packLabel}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                  {money(line.unitPrice, line.currency)}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <QuantityStepper value={line.quantity} onChange={(value) => setQuantity(line.productId, value)} />
                </div>
                <div style={{ textAlign: "right", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
                  {money(line.lineTotal, line.currency)}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.productId)}
                  aria-label="Remove item"
                  style={{ width: 28, height: 28, border: "none", borderRadius: 8, background: "transparent", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <DashboardIcon name="trash" size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </Surface>
        )}
      </div>

      <Surface padding={20} style={{ position: "sticky", top: 16 }} className="dash-fade-up">
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>Order Summary</div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          <span>Total units</span>
          <span>{totals.totalQty}</span>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
          <span>Subtotal</span>
          <span>{money(totals.subtotal)}</span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 7 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Payment Method</div>
          <AppleDropdown value={paymentMethod} options={PAYMENT_METHODS} onChange={setPaymentMethod} />
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 7 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Note (optional)</div>
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} style={fieldTextareaStyle()} />
        </div>

        {submitState.message ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: submitState.status === "success" ? "rgba(22,163,74,.08)" : "rgba(180,35,24,.08)",
              color: submitState.status === "success" ? "#15803d" : "#b42318",
            }}
          >
            {submitState.message}
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <PrimaryButton onClick={handleSubmit} disabled={submitting || cart.length === 0} style={{ width: "100%", justifyContent: "center", height: 44 }}>
            {submitting ? "Placing Order…" : "Place Order"}
          </PrimaryButton>
        </div>
      </Surface>

      <style>{`
        .dispatcher-cart-table-header{
          display:grid;
          grid-template-columns:minmax(0,1fr) 110px 100px 110px 36px;
          gap:14px;
          align-items:center;
          padding:12px 16px;
          background:var(--color-fog, #f5f5f7);
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .dispatcher-cart-table-row{
          display:grid;
          grid-template-columns:minmax(0,1fr) 110px 100px 110px 36px;
          gap:14px;
          align-items:center;
          padding:12px 16px;
          border-top:1px solid rgba(0,0,0,.06);
        }
      `}</style>
    </div>
  );
}
