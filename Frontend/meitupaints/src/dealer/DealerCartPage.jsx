import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
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

const DRAFT_KEY = "meitu_dealer_order_draft_v1";

function sanitizeDraft(draft = {}) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => Number(value || 0) > 0),
  );
}

function loadDraft() {
  try {
    return sanitizeDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"));
  } catch {
    return {};
  }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizeDraft(draft)));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function money(value, currency = "NPR") {
  return formatMoney(value, currency);
}

function packLabel(pack) {
  return formatPack(pack);
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function resolveCartItemImage(product, familyMap = {}) {
  const familyByCode = familyMap?.[product?.code] || null;

  return (
    getPrimaryImage(product?.familyImages || []) ||
    getPrimaryImage(product?.family?.images || []) ||
    getPrimaryImage(familyByCode?.images || []) ||
    getPrimaryImage(product?.images || []) ||
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

  return {
    totalItems: totals.totalQty,
    subtotal: totals.subtotal,
    lines: cart.length,
  };
}

/* -----------------------------
   UI primitives
----------------------------- */
function GlassPanel({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 30,
        background: "rgba(255,255,255,.76)",
        border: "1px solid rgba(255,255,255,.68)",
        boxShadow:
          "0 20px 60px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.84)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,.82)",
        border: "1px solid rgba(0,0,0,.05)",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(0,0,0,.56)",
      }}
    >
      {children}
    </div>
  );
}

function HeroMetric({ label, value, accent = false }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 20,
        background: accent ? "rgba(196,0,0,.07)" : "rgba(248,248,250,.94)",
        border: accent
          ? "1px solid rgba(196,0,0,.12)"
          : "1px solid rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,.45)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function QtyStepper({ value, onChange }) {
  const qty = Number(value || 0);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: "rgba(255,255,255,.96)",
        border: "1px solid rgba(0,0,0,.08)",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.92)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, qty - 1))}
        style={{
          width: 42,
          height: 42,
          border: "none",
          background: "transparent",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        −
      </button>

      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
          )
        }
        style={{
          width: 56,
          height: 42,
          border: "none",
          outline: "none",
          background: "transparent",
          textAlign: "center",
          fontWeight: 950,
          color: "#0f172a",
          fontSize: 14,
        }}
      />

      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        style={{
          width: 42,
          height: 42,
          border: "none",
          background: "transparent",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

function LineArtwork({ image, alt }) {
  return (
    <div
      style={{
        height: 96,
        width: 96,
        borderRadius: 22,
        background:
          "linear-gradient(180deg, rgba(248,248,250,1) 0%, rgba(233,236,241,1) 100%)",
        border: "1px solid rgba(0,0,0,.05)",
        overflow: "hidden",
        position: "relative",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {image?.url ? (
        <img
          src={image.url}
          alt={alt || "Product"}
          style={{
            width: "auto",
            height: "96px",
          }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 56,
            borderRadius: "14px 14px 10px 10px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(244,244,247,1) 100%)",
            border: "1px solid rgba(0,0,0,.05)",
          }}
        />
      )}
    </div>
  );
}

function CartLine({ item, onQtyChange, onRemove }) {
  return (
    <div
      style={{
        padding: 18,
        borderTop: "1px solid rgba(0,0,0,.06)",
        display: "grid",
        gridTemplateColumns: "96px minmax(0,1fr) auto",
        gap: 16,
        alignItems: "center",
      }}
    >
      <LineArtwork image={item.image} alt={item.name} />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontWeight: 950,
                fontSize: 18,
                lineHeight: 1.2,
                color: "#0f172a",
              }}
            >
              {item.name}
            </div>

            {item.familyName && item.familyName !== item.name ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(15,23,42,.52)",
                  letterSpacing: ".02em",
                }}
              >
                Family · {item.familyName}
              </div>
            ) : null}
          </div>

          <span
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(196,0,0,.08)",
              color: "#b42318",
              fontWeight: 900,
              fontSize: 11,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            {item.category?.replaceAll("_", " ")}
          </span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "rgba(0,0,0,.52)",
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {item.sku} · {packLabel(item.pack)} ·{" "}
          {getTierLabel(item.tier, item.pricing)}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <QtyStepper
            value={item.quantity}
            onChange={(next) => onQtyChange(item.sku, next)}
          />

          <span
            style={{
              color: "rgba(0,0,0,.58)",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Unit: {money(item.unitPrice, item.currency)}
          </span>

          <button
            type="button"
            onClick={() => onRemove(item.sku)}
            style={{
              border: "none",
              background: "transparent",
              color: "#b42318",
              fontWeight: 900,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Remove
          </button>
        </div>
      </div>

      <div
        style={{
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontWeight: 950,
            fontSize: 18,
            color: "#0f172a",
          }}
        >
          {money(item.lineTotal, item.currency)}
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(0,0,0,.46)",
          }}
        >
          {item.quantity} × {money(item.unitPrice, item.currency)}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span
        style={{
          color: "rgba(0,0,0,.56)",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontWeight: strong ? 950 : 900,
          color: "#0f172a",
          fontSize: strong ? 18 : 15,
        }}
      >
        {value}
      </strong>
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
    (productsQuery.isLoading && products.length === 0) ||
    (familiesQuery.isLoading && families.length === 0);
  const refreshing =
    !loading && (productsQuery.isFetching || familiesQuery.isFetching);
  const catalogError = productsQuery.error || familiesQuery.error
    ? getQueryErrorMessage(
        productsQuery.error || familiesQuery.error,
        "Failed to load order draft products.",
      )
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

  const cart = useMemo(
    () => buildCart(productsMap, quantities, familyMap),
    [productsMap, quantities, familyMap],
  );

  const totalsData = useMemo(() => summary(cart), [cart]);

  const handleQtyChange = (sku, nextValue) => {
    setQuantities((prev) => {
      const nextDraft = {
        ...prev,
        [sku]: nextValue,
      };
      return sanitizeDraft(nextDraft);
    });
  };

  const handleRemove = (sku) => {
    setQuantities((prev) => {
      const nextDraft = {
        ...prev,
        [sku]: 0,
      };
      return sanitizeDraft(nextDraft);
    });
  };

  const handleClearDraft = () => {
    setQuantities({});
    clearDraft();
    setDealerNote("");
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentNote("");
    setShowPaymentReference(false);
    setShowPaymentNote(false);
    setPaymentPrompted(false);
    setSuccess("");
    setError("");
  };

  const handleSubmit = async () => {
    try {
      if (cart.length === 0) {
        setError("Your draft is empty.");
        return;
      }

      if (!paymentMethod) {
        setPaymentPrompted(true);
        setError(
          "Select a payment method before placing this order. This is required for internal review and payment tracking.",
        );
        return;
      }

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
          packLabel: packLabel(item.pack),
          quantity: Number(item.quantity || 0),
          unit: item?.pack?.unit || "",
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: Number(item.lineTotal || 0),
          notes: "",
        })),
        totals: {
          subtotal,
          discount: 0,
          taxableAmount: subtotal,
          tax: 0,
          total: subtotal,
          currency: cart[0]?.currency || "NPR",
        },
        payment: {
          method: paymentMethod,
          reference: paymentReference.trim(),
          note: paymentNote.trim(),
        },
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
        navigate("/dealer/catalog");
      }, 1200);
    } catch (e) {
      setError(getQueryErrorMessage(e, "Failed to place order."));
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = cart.length === 0 || submitting;
  const currency = cart[0]?.currency || "NPR";
  const paymentRequired = cart.length > 0 && !paymentMethod;
  const placeOrderButton = (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={disabled}
      style={{
        height: 56,
        borderRadius: 18,
        border: paymentRequired
          ? "1px solid rgba(180,35,24,.22)"
          : "1px solid rgba(196,0,0,.18)",
        background: disabled
          ? "rgba(0,0,0,.10)"
          : paymentRequired
            ? "linear-gradient(135deg, #7f1d1d 0%, #b42318 100%)"
            : "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
        color: "#fff",
        fontWeight: 950,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "0 18px 34px rgba(196,0,0,.24)",
      }}
    >
      {submitting
        ? "Placing Order..."
        : paymentRequired
          ? "Select Payment Method"
          : "Place Order"}
    </button>
  );
  const paymentFieldRemoveButton = (label, onClick) => (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        border: "1px solid rgba(196,0,0,.14)",
        background: "rgba(196,0,0,.06)",
        color: "#b42318",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 950,
        lineHeight: 1,
        cursor: "pointer",
        padding: 0,
      }}
    >
      -
    </button>
  );

  return (
    <>
      <NavBar />
      <div
        className="dealer-cart-page"
        style={{
          minHeight: "100vh",
          paddingTop: 18,
          paddingBottom: 60,
          background:
            "radial-gradient(900px 520px at 12% 0%, rgba(255,230,160,.46), transparent 52%), radial-gradient(900px 520px at 88% 10%, rgba(255,120,80,.18), transparent 45%), linear-gradient(180deg, #f5f6f8 0%, #edf1f5 100%)",
        }}
      >
        <div className="container" style={{ maxWidth: 1520 }}>
          <GlassPanel style={{ padding: 26, marginBottom: 22 }}>
            <div
              className="dealer-cart-hero-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, .8fr)",
                gap: 22,
                alignItems: "start",
              }}
            >
              <div>
                <SectionEyebrow>Draft Review</SectionEyebrow>

                <div
                  style={{
                    marginTop: 16,
                    fontSize: 48,
                    fontWeight: 950,
                    letterSpacing: "-0.05em",
                    lineHeight: 1,
                    color: "#0f172a",
                  }}
                >
                  Review Your Draft Order
                </div>

                <div
                  style={{
                    marginTop: 14,
                    maxWidth: 780,
                    color: "rgba(0,0,0,.58)",
                    fontWeight: 700,
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  Confirm pack quantities, review pricing tiers, choose the
                  payment route, and submit your dealer order into Meitu’s
                  internal review workflow.
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 18,
                  }}
                >
                  <Link
                    to="/dealer/catalog"
                    style={{
                      height: 50,
                      padding: "0 18px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,.08)",
                      background: "rgba(255,255,255,.96)",
                      display: "inline-flex",
                      alignItems: "center",
                      color: "#111827",
                      fontWeight: 900,
                      textDecoration: "none",
                    }}
                  >
                    Back to Catalog
                  </Link>

                  <button
                    type="button"
                    onClick={handleClearDraft}
                    style={{
                      height: 50,
                      padding: "0 18px",
                      borderRadius: 999,
                      border: "1px solid rgba(180,35,24,.12)",
                      background: "rgba(180,35,24,.06)",
                      color: "#b42318",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Clear Draft
                  </button>
                </div>
              </div>

              <div
                className="dealer-cart-metrics-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  alignContent: "start",
                }}
              >
                <HeroMetric label="Draft Lines" value={totalsData.lines} />
                <HeroMetric
                  label="Draft Units"
                  value={totalsData.totalItems}
                  accent
                />
                <HeroMetric label="Currency" value={currency} />
                <HeroMetric
                  label="Estimated Value"
                  value={money(totalsData.subtotal, currency)}
                  accent
                />
              </div>
            </div>


            {refreshing ? (
              <div
                style={{
                  marginTop: 12,
                  color: "rgba(15,23,42,.52)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Updating catalog data...
              </div>
            ) : null}

            {(visibleError || success) && (
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 16,
                  fontWeight: 800,
                  background: visibleError
                    ? "rgba(180,35,24,.08)"
                    : "rgba(18,183,106,.10)",
                  color: visibleError ? "#b42318" : "#067647",
                  border: visibleError
                    ? "1px solid rgba(180,35,24,.16)"
                    : "1px solid rgba(18,183,106,.16)",
                }}
              >
                {visibleError || success}
              </div>
            )}
          </GlassPanel>

          {loading ? (
            <GlassPanel style={{ padding: 24 }}>
              <div style={{ fontWeight: 900, color: "rgba(0,0,0,.62)" }}>
                Loading draft order...
              </div>
            </GlassPanel>
          ) : (
            <div
              className="dealer-cart-layout-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 390px",
                gap: 22,
                alignItems: "start",
              }}
            >
              <GlassPanel style={{ overflow: "hidden" }}>
                <div
                  style={{
                    padding: 22,
                    borderBottom: "1px solid rgba(0,0,0,.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 950,
                        letterSpacing: "-0.03em",
                        color: "#0f172a",
                      }}
                    >
                      Draft Items
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        color: "rgba(0,0,0,.5)",
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      Review each selected SKU before final submission.
                    </div>
                  </div>

                  <div
                    style={{
                      color: "rgba(0,0,0,.5)",
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {totalsData.totalItems} units selected
                  </div>
                </div>

                {cart.length === 0 ? (
                  <div
                    style={{
                      padding: 28,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 950,
                        letterSpacing: "-0.03em",
                        color: "#0f172a",
                      }}
                    >
                      Your draft is empty
                    </div>
                    <div
                      style={{
                        color: "rgba(0,0,0,.58)",
                        fontWeight: 700,
                        lineHeight: 1.6,
                        maxWidth: 560,
                      }}
                    >
                      Go back to the catalog, select the products you need, and
                      they will appear here for final review before submission.
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Link
                        to="/dealer/catalog"
                        style={{
                          height: 48,
                          padding: "0 18px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,.08)",
                          background: "rgba(255,255,255,.96)",
                          display: "inline-flex",
                          alignItems: "center",
                          color: "#111827",
                          fontWeight: 900,
                          textDecoration: "none",
                        }}
                      >
                        Return to Catalog
                      </Link>
                    </div>
                  </div>
                ) : (
                  cart.map((item) => (
                    <CartLine
                      key={item.sku}
                      item={item}
                      onQtyChange={handleQtyChange}
                      onRemove={handleRemove}
                    />
                  ))
                )}
              </GlassPanel>

              <div
                style={{
                  position: "sticky",
                  top: 76,
                  display: "grid",
                  gap: 18,
                }}
              >
                <GlassPanel style={{ padding: 22 }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 950,
                      letterSpacing: "-0.03em",
                      color: "#0f172a",
                    }}
                  >
                    Order Summary
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: "grid",
                      gap: 14,
                      paddingBottom: 18,
                      borderBottom: "1px solid rgba(0,0,0,.06)",
                    }}
                  >
                    <SummaryRow label="Draft Lines" value={totalsData.lines} />
                    <SummaryRow
                      label="Total Units"
                      value={totalsData.totalItems}
                    />
                    <SummaryRow
                      label="Estimated Subtotal"
                      value={money(totalsData.subtotal, currency)}
                      strong
                    />
                  </div>

                  <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <label
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 900,
                            color: paymentRequired
                              ? "#b42318"
                              : "rgba(0,0,0,.5)",
                            textTransform: "uppercase",
                            letterSpacing: ".08em",
                          }}
                        >
                          Payment Method
                        </label>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            minHeight: 24,
                            padding: "4px 9px",
                            borderRadius: 999,
                            background: paymentRequired
                              ? "rgba(180,35,24,.08)"
                              : "rgba(18,183,106,.10)",
                            color: paymentRequired ? "#b42318" : "#067647",
                            border: paymentRequired
                              ? "1px solid rgba(180,35,24,.14)"
                              : "1px solid rgba(18,183,106,.14)",
                            fontSize: 10,
                            fontWeight: 950,
                            letterSpacing: ".06em",
                            textTransform: "uppercase",
                          }}
                        >
                          {paymentRequired ? "Required" : "Selected"}
                        </span>
                      </div>

                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          setPaymentPrompted(false);
                          if (error?.startsWith("Select a payment method")) {
                            setError("");
                          }
                        }}
                        style={{
                          width: "100%",
                          height: 50,
                          borderRadius: 18,
                          border:
                            paymentRequired && paymentPrompted
                              ? "1px solid rgba(180,35,24,.28)"
                              : "1px solid rgba(0,0,0,.08)",
                          background: "rgba(255,255,255,.96)",
                          padding: "0 14px",
                          fontWeight: 900,
                          color: paymentMethod
                            ? "#0f172a"
                            : "rgba(15,23,42,.46)",
                          outline: "none",
                          boxShadow:
                            paymentRequired && paymentPrompted
                              ? "0 0 0 4px rgba(180,35,24,.08)"
                              : "none",
                        }}
                      >
                        <option value="" disabled>
                          Select payment method before placing order
                        </option>
                        <option value="CASH">Cash</option>
                        <option value="ONLINE">Online</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="BANK_GUARANTEE">Bank Guarantee</option>
                        <option value="CREDIT">Credit</option>
                      </select>

                      {paymentRequired ? (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "12px 14px",
                            borderRadius: 16,
                            background: "rgba(180,35,24,.06)",
                            border: "1px solid rgba(180,35,24,.12)",
                            color: "#b42318",
                            fontSize: 13,
                            lineHeight: 1.55,
                            fontWeight: 800,
                          }}
                        >
                          Choose how this order will be paid. Meitu will use
                          this selection for review, verification, and payment
                          follow-up.
                        </div>
                      ) : null}
                    </div>

                    {placeOrderButton}

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      {!showPaymentReference ? (
                        <button
                          type="button"
                          onClick={() => setShowPaymentReference(true)}
                          style={{
                            minHeight: 36,
                            border: "none",
                            background: "transparent",
                            color: "#0f172a",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 9,
                            fontSize: 12,
                            fontWeight: 900,
                            letterSpacing: ".04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            justifySelf: "start",
                            padding: 0,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(196,0,0,.08)",
                              color: "#b42318",
                              border: "1px solid rgba(196,0,0,.14)",
                              fontSize: 16,
                              fontWeight: 950,
                              lineHeight: 1,
                            }}
                          >
                            +
                          </span>
                          Add Payment Reference
                        </button>
                      ) : null}

                      {!showPaymentNote ? (
                        <button
                          type="button"
                          onClick={() => setShowPaymentNote(true)}
                          style={{
                            minHeight: 36,
                            border: "none",
                            background: "transparent",
                            color: "#0f172a",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 9,
                            fontSize: 12,
                            fontWeight: 900,
                            letterSpacing: ".04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            justifySelf: "start",
                            padding: 0,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(196,0,0,.08)",
                              color: "#b42318",
                              border: "1px solid rgba(196,0,0,.14)",
                              fontSize: 16,
                              fontWeight: 950,
                              lineHeight: 1,
                            }}
                          >
                            +
                          </span>
                          Add Payment Note
                        </button>
                      ) : null}
                    </div>

                    {showPaymentReference ? (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 8,
                          }}
                        >
                          <label
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 900,
                              color: "rgba(0,0,0,.5)",
                              textTransform: "uppercase",
                              letterSpacing: ".08em",
                            }}
                          >
                            Payment Reference
                          </label>
                          {paymentFieldRemoveButton("payment reference", () => {
                            setPaymentReference("");
                            setShowPaymentReference(false);
                          })}
                        </div>

                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Cheque no, transaction ref, guarantee ref..."
                          style={{
                            width: "100%",
                            height: 50,
                            borderRadius: 18,
                            border: "1px solid rgba(0,0,0,.08)",
                            background: "rgba(255,255,255,.96)",
                            padding: "0 14px",
                            fontWeight: 700,
                            outline: "none",
                            color: "#0f172a",
                          }}
                        />
                      </div>
                    ) : null}

                    {showPaymentNote ? (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 8,
                          }}
                        >
                          <label
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 900,
                              color: "rgba(0,0,0,.5)",
                              textTransform: "uppercase",
                              letterSpacing: ".08em",
                            }}
                          >
                            Payment Note
                          </label>
                          {paymentFieldRemoveButton("payment note", () => {
                            setPaymentNote("");
                            setShowPaymentNote(false);
                          })}
                        </div>

                        <textarea
                          rows={3}
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          placeholder="Optional payment context..."
                          style={{
                            width: "100%",
                            borderRadius: 18,
                            border: "1px solid rgba(0,0,0,.08)",
                            background: "rgba(255,255,255,.96)",
                            padding: 14,
                            resize: "vertical",
                            fontWeight: 700,
                            outline: "none",
                            color: "#0f172a",
                          }}
                        />
                      </div>
                    ) : null}

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontSize: 11,
                          fontWeight: 900,
                          color: "rgba(0,0,0,.5)",
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Dealer Note
                      </label>

                      <textarea
                        rows={5}
                        value={dealerNote}
                        onChange={(e) => setDealerNote(e.target.value)}
                        placeholder="Add branch, urgency, payment note, dispatch preference, or any special instruction..."
                        style={{
                          width: "100%",
                          borderRadius: 18,
                          border: "1px solid rgba(0,0,0,.08)",
                          background: "rgba(255,255,255,.96)",
                          padding: 14,
                          resize: "vertical",
                          fontWeight: 700,
                          outline: "none",
                          color: "#0f172a",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 18,
                        background: "rgba(248,248,250,.92)",
                        border: "1px solid rgba(0,0,0,.05)",
                        color: "rgba(0,0,0,.58)",
                        fontWeight: 700,
                        lineHeight: 1.6,
                        fontSize: 13,
                      }}
                    >
                      Once submitted, this draft becomes an official order for
                      Meitu’s internal review. Factory-handled dealers are
                      verified by admin, while dispatcher-routed dealers are
                      verified by their assigned dispatcher.
                    </div>

                  </div>
                </GlassPanel>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dealer-cart-page,
        .dealer-cart-page *{
          box-sizing:border-box;
          min-width:0;
        }

        @media (max-width:1040px){
          .dealer-cart-hero-grid,
          .dealer-cart-layout-grid{
            grid-template-columns:1fr!important;
          }
        }

        @media (max-width:720px){
          .dealer-cart-page{
            padding-top:84px!important;
            padding-bottom:36px!important;
          }

          .dealer-cart-page .container{
            padding-left:14px;
            padding-right:14px;
          }

          .dealer-cart-metrics-grid{
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
          }

          .dealer-cart-page [style*="grid-template-columns: 96px"],
          .dealer-cart-page [style*="minmax(0, 1fr) 390px"],
          .dealer-cart-page [style*="1fr 1fr"]{
            grid-template-columns:1fr!important;
          }

          .dealer-cart-page [style*="font-size: 48px"]{
            font-size:34px!important;
            letter-spacing:-.04em!important;
          }
        }

        @media (max-width:480px){
          .dealer-cart-metrics-grid{
            grid-template-columns:1fr!important;
          }

          .dealer-cart-page a,
          .dealer-cart-page button{
            max-width:100%;
          }
        }
      `}</style>
    </>
  );
}
