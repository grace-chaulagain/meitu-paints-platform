import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDispatcherReplenishmentCatalogQuery, useGetProductFamiliesQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { EmptyState, GhostButton, SearchField, SectionHeader, Surface, ViewToggle } from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { buildCart, calculateCartTotals, groupCatalogItemsByCode } from "./dispatcherOrderPricing.js";
import { loadDraft, saveDraft } from "./dispatcherOrderDraftStorage.js";

const SORT_OPTIONS = [
  { key: "name-asc", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
];

const VIEW_STORAGE_KEY = "meitu.dispatcher.order.view";

function getInitialView() {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "card";
  } catch {
    return "card";
  }
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function titleCaseLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stepperButtonStyle() {
  return {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "none",
    background: "var(--color-snow, #fff)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)",
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
      <input
        type="number"
        min="0"
        value={value || ""}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        placeholder="0"
        style={{
          width: 48,
          height: 30,
          borderRadius: 8,
          border: "none",
          background: "var(--color-snow, #fff)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)",
          textAlign: "center",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--color-ink, #1d1d1f)",
        }}
      />
      <button type="button" onClick={() => onChange(qty + 1)} style={stepperButtonStyle()} aria-label="Increase quantity">
        <DashboardIcon name="plus" size={11} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function CategoryPillRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dispatcher-order-category-pill ${active ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ProductFamilyCard({ family, quantities, onQtyChange, layout }) {
  const familyImage = getPrimaryImage(family.familyImages);
  const selectedCount = family.items.filter((item) => Number(quantities[item.productId] || 0) > 0).length;

  return (
    <Surface padding={0} className={`dispatcher-order-family-card layout-${layout}`}>
      <div className="dispatcher-order-family-top">
        <div className="dispatcher-order-family-image">
          {familyImage ? (
            <img src={familyImage.url} alt={family.name} loading="lazy" />
          ) : (
            <DashboardIcon name="package" size={22} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
            {titleCaseLabel(family.category)}
          </div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{family.name}</div>
        </div>
        {selectedCount > 0 ? (
          <span className="dispatcher-order-family-badge">{selectedCount} selected</span>
        ) : null}
      </div>

      <div className="dispatcher-order-family-variants">
        {family.items.map((item) => {
          const qty = quantities[item.productId];
          const isSelected = Number(qty || 0) > 0;
          return (
            <div key={item.productId} className={`dispatcher-order-variant-row ${isSelected ? "is-selected" : ""}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.packLabel || "Variant"}</div>
                <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  {item.sku} · {money(item.price, item.currency)}
                </div>
              </div>
              <QuantityStepper value={qty} onChange={(value) => onQtyChange(item.productId, value)} />
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

export default function DispatcherOrderCatalogPage() {
  const navigate = useNavigate();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("name-asc");
  const [view, setView] = useState(getInitialView);
  const [quantities, setQuantities] = useState(() => loadDraft());

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  const catalogQuery = useGetDispatcherReplenishmentCatalogQuery({ q: query });
  const familiesQuery = useGetProductFamiliesQuery();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const families = useMemo(() => familiesQuery.data || [], [familiesQuery.data]);
  const familyByCode = useMemo(() => {
    const map = new Map();
    for (const family of families) map.set(family.code, family);
    return map;
  }, [families]);

  const itemsById = useMemo(() => {
    const map = {};
    for (const item of items) map[item.productId] = item;
    return map;
  }, [items]);

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  const categoryOptions = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean));
    return [{ key: "ALL", label: "All Categories" }, ...[...set].sort().map((value) => ({ key: value, label: titleCaseLabel(value) }))];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (category === "ALL") return items;
    return items.filter((item) => item.category === category);
  }, [category, items]);

  const familyGroups = useMemo(() => {
    const groups = groupCatalogItemsByCode(filteredItems).map((group) => {
      const family = familyByCode.get(group.code);
      return {
        ...group,
        name: family?.name || group.name,
        familyImages: family?.images || [],
      };
    });
    groups.sort((a, b) => (sort === "name-desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
    return groups;
  }, [familyByCode, filteredItems, sort]);

  function setQuantity(productId, value) {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  }

  const cart = useMemo(() => buildCart(itemsById, quantities), [itemsById, quantities]);
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);

  const loading = catalogQuery.isLoading;
  const loadError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load your price list.") : "";

  return (
    <div style={{ display: "grid", gap: 16, paddingBottom: totals.totalQty > 0 ? 72 : 0 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="package"
          title="Order from Factory"
          subtitle="Replenish your regional stock at your own price list — routed through the same Admin review and Factory fulfillment as any other order."
          action={
            <GhostButton icon="history" onClick={() => navigate("/dispatcher/dashboard/order/history")}>
              Order History
            </GhostButton>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
            <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={() => setQuery(draftQuery.trim())} placeholder="Search products…" />
          </div>
          <AppleDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} style={{ width: 150 }} />
          <ViewToggle value={view} onChange={updateView} />
        </div>

        <div style={{ marginTop: 14 }}>
          <CategoryPillRow options={categoryOptions} value={category} onChange={setCategory} />
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 240, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : familyGroups.length === 0 ? (
        <EmptyState
          icon="package"
          title={query ? "No products match this search" : "No priced products yet"}
          subtitle={query ? "" : "Ask your Meitu admin to set up your dispatcher price list before you can place an order."}
        />
      ) : (
        <div
          className="dash-fade-up"
          style={
            view === "card"
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, alignItems: "start" }
              : { display: "grid", gap: 12 }
          }
        >
          {familyGroups.map((family) => (
            <ProductFamilyCard key={family.code} family={family} quantities={quantities} onQtyChange={setQuantity} layout={view} />
          ))}
        </div>
      )}

      {totals.totalQty > 0 ? (
        <button
          type="button"
          className="dispatcher-order-floating-cart"
          onClick={() => navigate("/dispatcher/dashboard/order/cart")}
        >
          <span className="dispatcher-order-floating-cart-count">{totals.totalQty}</span>
          Review Order · {money(totals.subtotal)}
        </button>
      ) : null}

      <style>{`
        .dispatcher-order-category-pill{
          height:32px;
          padding:0 14px;
          border-radius:999px;
          border:none;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          font-size:12.5px;
          font-weight:650;
          cursor:pointer;
          transition:background .14s ease, color .14s ease;
        }
        .dispatcher-order-category-pill:hover{
          background:rgba(0,113,227,.08);
        }
        .dispatcher-order-category-pill.is-active{
          background:var(--color-azure, #0071e3);
          color:#fff;
        }
        .dispatcher-order-family-card{
          overflow:hidden;
        }
        .dispatcher-order-family-card.layout-card{
          height:100%;
        }
        .dispatcher-order-family-top{
          display:flex;
          align-items:center;
          gap:12px;
          padding:16px;
          border-bottom:1px solid rgba(0,0,0,.06);
        }
        .dispatcher-order-family-image{
          width:44px;
          height:44px;
          border-radius:12px;
          flex:0 0 44px;
          background:var(--color-fog, #f5f5f7);
          display:grid;
          place-items:center;
          overflow:hidden;
        }
        .dispatcher-order-family-image img{
          width:100%;
          height:100%;
          object-fit:cover;
        }
        .dispatcher-order-family-badge{
          flex-shrink:0;
          height:22px;
          padding:0 9px;
          border-radius:999px;
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
          font-size:11px;
          font-weight:700;
          display:inline-flex;
          align-items:center;
        }
        .dispatcher-order-family-variants{
          display:grid;
        }
        .dispatcher-order-variant-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:12px 16px;
          border-top:1px solid rgba(0,0,0,.05);
          transition:background .14s ease;
        }
        .dispatcher-order-variant-row:first-child{
          border-top:none;
        }
        .dispatcher-order-variant-row.is-selected{
          background:rgba(0,113,227,.05);
        }
        .dispatcher-order-floating-cart{
          position:fixed;
          right:20px;
          bottom:20px;
          height:52px;
          padding:0 18px;
          border-radius:999px;
          border:none;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-weight:600;
          font-size:14px;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:10px;
          z-index:80;
          box-shadow:0 8px 24px rgba(0,113,227,.28);
          transition:transform .14s var(--ease-out, ease);
        }
        .dispatcher-order-floating-cart:active{
          transform:scale(.97);
        }
        .dispatcher-order-floating-cart-count{
          display:inline-flex;
          width:24px;
          height:24px;
          border-radius:999px;
          background:rgba(255,255,255,.22);
          align-items:center;
          justify-content:center;
          font-size:12px;
          font-weight:700;
        }
        @media (prefers-reduced-motion: reduce){
          .dispatcher-order-floating-cart{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
