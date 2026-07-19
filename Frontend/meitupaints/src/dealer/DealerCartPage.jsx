import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateDealerOrderMutation,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../redux/api/selectors.js";
import {
  buildCart as buildPricedCart,
  calculateCartTotals,
  formatMoney,
  formatPack,
  getTierLabel,
} from "./pricing.js";
import { loadDraft, saveDraft, sanitizeDraft, clearDraft } from "./draftStorage.js";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { useIsMobileDealer } from "./mobile/useIsMobileDealer.js";
import { DealerCartMobileView } from "./mobile/DealerCartMobileView.jsx";
import {
  Dropdown,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../components/dashboard/DashboardUI.jsx";

const PAYMENT_METHODS = [
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank Guarantee" },
  { key: "CREDIT", label: "Credit" },
];

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function resolveCartItemImage(product, familyMap = {}) {
  const familyByCode = familyMap?.[product?.code] || null;
  // A cart line is a specific SKU (a specific bucket size) - its own image
  // takes priority over the family's shared image, which would otherwise
  // show every size in the family rather than the one actually ordered.
  return (
    getPrimaryImage(product?.images || []) ||
    getPrimaryImage(product?.familyImages || []) ||
    getPrimaryImage(product?.family?.images || []) ||
    getPrimaryImage(familyByCode?.images || []) ||
    null
  );
}

function buildCart(productsMap, quantities, familyMap) {
  return buildPricedCart(productsMap, quantities).map((line) => {
    const product = productsMap?.[line.sku] || {};
    const primaryImage = resolveCartItemImage(product, familyMap);

    return {
      ...line,
      _id: product._id,
      familyName: familyMap?.[line.code]?.name || line.name,
      image: primaryImage || null,
    };
  });
}

function summary(cart) {
  const totals = calculateCartTotals(cart);
  return { totalItems: totals.totalQty, subtotal: totals.subtotal, lines: cart.length };
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: CART_TABLE_COLUMNS,
        gap: 14,
        alignItems: "center",
        padding: "0 0 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        color: "var(--color-graphite, #707070)",
      }}
    >
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
          <div style={{ marginTop: 3, fontSize: 12, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{formatPack(item.pack)}</div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Product Code: {item.sku}</div>
          {item.components?.length ? (
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--color-graphite, #707070)", lineHeight: 1.4 }}>
              Includes: {item.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
        {formatMoney(item.unitPrice, item.currency)}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <QtyStepper value={item.quantity} onChange={(next) => onQtyChange(item.sku, next)} />
      </div>

      <div style={{ textAlign: "right", fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
        {formatMoney(item.lineTotal, item.currency)}
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.sku)}
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

export default function DealerCartPage() {
  const navigate = useNavigate();
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();
  const [createDealerOrder] = useCreateDealerOrderMutation();

  const products = useMemo(
    () => (productsQuery.data || []).filter((item) => item?.isActive !== false),
    [productsQuery.data],
  );
  const families = useMemo(
    () => (familiesQuery.data || []).filter((item) => item?.isActive !== false),
    [familiesQuery.data],
  );

  const loading =
    (productsQuery.isLoading && products.length === 0) || (familiesQuery.isLoading && families.length === 0);
  const refreshing = !loading && (productsQuery.isFetching || familiesQuery.isFetching);
  const catalogError = productsQuery.error || familiesQuery.error
    ? getQueryErrorMessage(productsQuery.error || familiesQuery.error, "Failed to load order draft products.")
    : "";

  const [quantities, setQuantities] = useState(loadDraft());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [showPaymentReference, setShowPaymentReference] = useState(false);
  const [showPaymentNote, setShowPaymentNote] = useState(false);
  const [dealerNote, setDealerNote] = useState("");
  const [paymentPrompted, setPaymentPrompted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleError = error || catalogError;

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  const productsMap = useMemo(() => {
    const map = {};
    for (const item of products) map[item.sku] = item;
    return map;
  }, [products]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of families) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [families]);

  const cart = useMemo(() => buildCart(productsMap, quantities, familyMap), [productsMap, quantities, familyMap]);
  const totalsData = useMemo(() => summary(cart), [cart]);
  const currency = cart[0]?.currency || "NPR";
  const paymentRequired = cart.length > 0 && !paymentMethod;

  function handleQtyChange(sku, nextValue) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [sku]: nextValue }));
  }

  function handleRemove(sku) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [sku]: 0 }));
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      setError("Your draft is empty.");
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

      const subtotal = Number(totalsData.subtotal || 0);
      const payload = {
        items: cart.map((item) => ({
          productId: item._id || null,
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
        totals: { subtotal, discount: 0, taxableAmount: subtotal, tax: 0, total: subtotal, currency: cart[0]?.currency || "NPR" },
        payment: { method: paymentMethod, reference: paymentReference.trim(), note: paymentNote.trim() },
        dealerNote: dealerNote.trim(),
        internalNote: "",
      };

      const res = await createDealerOrder(payload).unwrap();
      setSuccess(res?.message || "Order submitted successfully.");
      setQuantities({});
      clearDraft();
      setDealerNote("");
      setPaymentMethod("");
      setPaymentReference("");
      setPaymentNote("");
      setShowPaymentReference(false);
      setShowPaymentNote(false);
      setPaymentPrompted(false);

      setTimeout(() => {
        navigate("/dealer/orders");
      }, 1200);
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to place order."));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = cart.length === 0 || submitting;

  const isMobile = useIsMobileDealer();
  if (isMobile) {
    return <DealerCartMobileView />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <SectionHeader
          icon="package"
          title="Your Cart"
          size="small"
          subtitle="Review your selected items before placing an order."
          action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => navigate("/support")}
            aria-label="Contact support"
            style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(29,29,31,.1)", background: "#fff", color: "var(--color-ink, #1d1d1f)", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <DashboardIcon name="headset" size={17} strokeWidth={1.8} />
          </button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid rgba(29,29,31,.1)", background: "#fff", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            <DashboardIcon name="package" size={15} strokeWidth={1.8} />
            {totalsData.totalItems} item{totalsData.totalItems === 1 ? "" : "s"}
          </div>
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
        <div className="dealer-cart-layout">
          <Surface padding={cart.length === 0 ? 0 : 20} style={{ overflow: "hidden" }} className="dash-fade-up">
            {cart.length === 0 ? (
              <div style={{ padding: 20 }}>
                <EmptyState icon="package" title="Your draft is empty" subtitle="Go back to the catalog and add products - they'll appear here for review." />
                <div style={{ marginTop: 4 }}>
                  <GhostButton onClick={() => navigate("/dealer/catalog")}>Return to Catalog</GhostButton>
                </div>
              </div>
            ) : (
              <>
                <CartTableHeader />
                <div>
                  {cart.map((item) => (
                    <CartLine
                      key={item.sku}
                      item={item}
                      onQtyChange={handleQtyChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/dealer/catalog")}
                  style={{ marginTop: 18, width: "100%", height: 48, borderRadius: 12, border: "1.5px dashed rgba(0,113,227,.35)", background: "rgba(0,113,227,.03)", color: "var(--color-azure, #0071e3)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <DashboardIcon name="plus" size={14} strokeWidth={2.2} />
                  Add more products
                </button>

              </>
            )}
          </Surface>

          <div className="dealer-cart-summary-rail">
            <Surface padding={20} style={{ display: "grid", gap: 16 }} className="dash-fade-up">
              <SectionHeader size="small" title="Order Summary" />

              <div style={{ display: "grid", gap: 10, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                <SummaryRow label="Estimated Subtotal" value={formatMoney(totalsData.subtotal, currency)} strong />
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

              <div style={{ display: "grid", gap: 8 }}>
                {!showPaymentReference ? (
                  <button type="button" onClick={() => setShowPaymentReference(true)} style={{ justifySelf: "start", border: "none", background: "transparent", color: "var(--color-azure, #0071e3)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    + Add Payment Reference
                  </button>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Payment Reference</label>
                      <button type="button" onClick={() => { setPaymentReference(""); setShowPaymentReference(false); }} aria-label="Remove payment reference" style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(180,35,24,.08)", color: "#b42318", cursor: "pointer" }}>−</button>
                    </div>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      placeholder="Cheque no, transaction ref, guarantee ref…"
                      style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", padding: "0 12px", fontSize: 13.5 }}
                    />
                  </div>
                )}

                {!showPaymentNote ? (
                  <button type="button" onClick={() => setShowPaymentNote(true)} style={{ justifySelf: "start", border: "none", background: "transparent", color: "var(--color-azure, #0071e3)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    + Add Payment Note
                  </button>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Payment Note</label>
                      <button type="button" onClick={() => { setPaymentNote(""); setShowPaymentNote(false); }} aria-label="Remove payment note" style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(180,35,24,.08)", color: "#b42318", cursor: "pointer" }}>−</button>
                    </div>
                    <textarea
                      rows={3}
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="Optional payment context…"
                      style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", padding: 12, fontSize: 13, resize: "vertical" }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Dealer Note</label>
                <textarea
                  rows={4}
                  maxLength={250}
                  value={dealerNote}
                  onChange={(event) => setDealerNote(event.target.value)}
                  placeholder="Branch, urgency, dispatch preference, or any special instruction…"
                  style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", padding: 12, fontSize: 13, resize: "vertical" }}
                />
                <div style={{ marginTop: 4, textAlign: "right", fontSize: 11, color: "var(--color-graphite, #707070)" }}>{dealerNote.length} / 250</div>
              </div>

              <PrimaryButton icon="lock" onClick={handleSubmit} disabled={disabled} style={{ width: "100%", height: 46 }}>
                {submitting ? "Placing Order…" : "Place Order"}
              </PrimaryButton>

              <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12, color: "var(--color-graphite, #707070)", lineHeight: 1.5, display: "flex", gap: 8 }}>
                <DashboardIcon name="info" size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: "var(--color-azure, #0071e3)" }} />
                <span>Once submitted, this becomes an official order for Meitu's internal review - factory-handled dealers are verified by admin, dispatcher-routed dealers by their assigned dispatcher.</span>
              </div>
            </Surface>
          </div>
        </div>
      )}

      <style>{`
        .dealer-cart-layout{
          display:grid;
          grid-template-columns:minmax(0,1fr) 340px;
          gap:16px;
          align-items:start;
        }
        .dealer-cart-summary-rail{
          position:sticky;
          top:0;
        }
        @media (max-width:960px){
          .dealer-cart-layout{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </div>
  );
}
