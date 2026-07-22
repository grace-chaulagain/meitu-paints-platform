import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useGetDispatcherReplenishmentCatalogQuery,
  useGetProductFamiliesQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { buildCart, calculateCartTotals, groupCatalogItemsByCode } from "./dispatcherOrderPricing.js";
import { loadDraft, saveDraft, sanitizeDraft } from "./dispatcherOrderDraftStorage.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { AppleDropdown, PopoverListMenu } from "../../../components/dashboard/ApplePickers.jsx";
import {
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../../../components/dashboard/DashboardUI.jsx";
import { useIsMobileDispatcher } from "../../mobile/useIsMobileDispatcher.js";
import { DispatcherCatalogMobileView } from "../../mobile/DispatcherCatalogMobileView.jsx";
import CatalogCarouselRow from "../../../components/dashboard/CatalogCarouselRow.jsx";

const ALL_CATEGORY_OPTION = { key: "ALL", label: "All Products" };

function categoryLabel(value) {
  if (!value) return "";
  if (value === "ALL") return "All Categories";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCategoryOptions(items = []) {
  const map = new Map();
  for (const item of items) {
    const value = String(item?.category || "").trim();
    if (value && !map.has(value)) map.set(value, categoryLabel(value));
  }
  return [
    ALL_CATEGORY_OPTION,
    ...Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function getFamilySelectionCount(family, quantities) {
  return family.items.reduce((acc, item) => {
    const qty = Number(quantities[item.productId] || 0);
    return acc + (qty > 0 ? qty : 0);
  }, 0);
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function QtyStepper({ value, onChange, selected = false }) {
  const qty = Number(value || 0);

  return (
    <div className={`dispatcher-qty-stepper ${selected ? "selected" : ""}`}>
      <button type="button" onClick={() => onChange(Math.max(0, qty - 1))} aria-label="Decrease quantity" className="dispatcher-qty-btn">
        <DashboardIcon name="minus" size={12} strokeWidth={2.4} />
      </button>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value === "" ? "" : Math.max(0, Number(event.target.value)))}
        className="dispatcher-qty-input"
      />
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Increase quantity" className="dispatcher-qty-btn">
        <DashboardIcon name="plus" size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// Compact inline sibling to AppleDropdown, sized to sit inside a single
// variant row - mirrors src/dealer/DealerCatalogPage.jsx's SizePickerDropdown
// exactly, keyed by productId instead of sku (dispatcher's cart/draft shape).
function SizePickerDropdown({ value, options, onChange }) {
  const selectedOption = options.find((option) => option.key === value);

  return (
    <PopoverListMenu
      ariaLabel="Select pack size"
      menuClassName="apple-dropdown-menu"
      options={options}
      value={value}
      onChange={onChange}
      trigger={({ open, onClick, triggerRef }) => (
        <button type="button" ref={triggerRef} onClick={onClick} aria-haspopup="listbox" aria-expanded={open} className="dispatcher-size-picker-trigger">
          <span>{selectedOption?.label}</span>
          <DashboardIcon name="chevron" size={10} strokeWidth={2.4} style={{ transform: "rotate(90deg)" }} />
        </button>
      )}
      renderRow={(option, { isSelected, isHighlighted, onClick, onMouseEnter }) => (
        <button
          key={option.key}
          type="button"
          role="option"
          aria-selected={isSelected}
          onMouseEnter={onMouseEnter}
          onClick={onClick}
          className={`apple-dropdown-menu-row ${isHighlighted ? "is-highlighted" : ""}`}
        >
          <span>{option.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {option.quantity > 0 ? <span className="dispatcher-size-picker-row-qty">{option.quantity} in cart</span> : null}
            {isSelected ? <DashboardIcon name="checkmark" size={13} strokeWidth={2.4} style={{ color: "var(--color-azure, #0071e3)" }} /> : null}
          </span>
        </button>
      )}
    />
  );
}

// No tier engine here (dispatcher replenishment pricing is a flat per-SKU
// rate - see dispatcherOrderPricing.js), so unlike the dealer's VariantRow
// there is no tier badge to compute or render.
function VariantRow({ item, quantity, cartLine, onQtyChange, sizeOptions, onSizeChange }) {
  const qty = Number(quantity || 0);
  const selected = qty > 0;
  const unitPrice = Number(cartLine?.unitPrice || item.price || 0);
  const subtotal = Number(cartLine?.lineTotal || 0);

  return (
    <div className={`dispatcher-variant-row ${selected ? "selected" : ""}`} title={item.sku}>
      <span className="dispatcher-variant-icon">
        <DashboardIcon name="package" size={14} strokeWidth={1.8} />
      </span>

      <div className="dispatcher-variant-copy">
        <div className="dispatcher-variant-pack">
          {sizeOptions && sizeOptions.length > 1 ? (
            <SizePickerDropdown value={item.productId} options={sizeOptions} onChange={onSizeChange} />
          ) : (
            item.packLabel || "Variant"
          )}
        </div>
        <div className="dispatcher-variant-price">
          {money(unitPrice, item.currency)}
          {selected ? <strong> · {money(subtotal, item.currency)}</strong> : null}
        </div>
      </div>

      <QtyStepper value={quantity} selected={selected} onChange={(next) => onQtyChange(item.productId, next)} />
    </div>
  );
}

function ProductFamilyCard({ family, quantities, cartByProductId, onQtyChange, layout = "card" }) {
  const selectionCount = getFamilySelectionCount(family, quantities);
  const image = getPrimaryImage(family.familyImages);
  // No numeric pack.size on dispatcher catalog items (only a display
  // packLabel string) - price descending is the closest available proxy
  // for "largest pack first" ordering within a family.
  const sortedItems = family.items.slice().sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
  const selected = selectionCount > 0;

  const defaultActiveProductId = sortedItems.find((item) => Number(quantities[item.productId] || 0) > 0)?.productId || sortedItems[0]?.productId;
  const [activeProductId, setActiveProductId] = useState(defaultActiveProductId);
  const activeItem = sortedItems.find((item) => item.productId === activeProductId) || sortedItems[0];

  if (layout === "list") {
    const sizeOptions = sortedItems.map((item) => ({
      key: item.productId,
      label: item.packLabel || "Variant",
      quantity: Number(quantities[item.productId] || 0),
    }));

    return (
      <Surface padding={14} className={`dispatcher-product-row dash-fade-up ${selected ? "selected" : ""}`}>
        <div className="dispatcher-product-row-media">
          {image?.url ? (
            <img src={image.url} alt={family.name} loading="lazy" />
          ) : (
            <DashboardIcon name="package" size={26} strokeWidth={1.4} style={{ color: "rgba(0,0,0,.22)" }} />
          )}
          {selectionCount > 0 ? (
            <span className="dispatcher-product-badge dispatcher-product-badge-sm">
              <DashboardIcon name="checkmark" size={10} strokeWidth={2.6} />
              {selectionCount}
            </span>
          ) : null}
        </div>

        <div className="dispatcher-product-row-body">
          <div className="dispatcher-product-meta">
            <DashboardIcon name="store" size={11} strokeWidth={2} />
            <span>{categoryLabel(family.category)}</span>
          </div>
          <div className="dispatcher-product-name">{family.name}</div>
        </div>

        <div className="dispatcher-variant-list dispatcher-variant-list-row">
          {activeItem ? (
            <VariantRow
              key={activeItem.productId}
              item={activeItem}
              quantity={quantities[activeItem.productId] || ""}
              cartLine={cartByProductId[activeItem.productId] || null}
              onQtyChange={onQtyChange}
              sizeOptions={sizeOptions}
              onSizeChange={setActiveProductId}
            />
          ) : null}
        </div>
      </Surface>
    );
  }

  return (
    <Surface padding={0} style={{ overflow: "hidden" }} className={`dispatcher-product-card dash-fade-up ${selected ? "selected" : ""}`}>
      <div className="dispatcher-product-media">
        {image?.url ? (
          <img src={image.url} alt={family.name} loading="lazy" />
        ) : (
          <DashboardIcon name="package" size={40} strokeWidth={1.3} style={{ color: "rgba(0,0,0,.22)" }} />
        )}
        {selectionCount > 0 ? (
          <span className="dispatcher-product-badge">
            <DashboardIcon name="checkmark" size={11} strokeWidth={2.6} />
            {selectionCount}
          </span>
        ) : null}
      </div>

      <div className="dispatcher-product-body">
        <div className="dispatcher-product-meta">
          <DashboardIcon name="store" size={11} strokeWidth={2} />
          <span>{categoryLabel(family.category)}</span>
        </div>
        <div className="dispatcher-product-name">{family.name}</div>

        <div className="dispatcher-variant-list">
          {sortedItems.map((item) => (
            <VariantRow
              key={item.productId}
              item={item}
              quantity={quantities[item.productId] || ""}
              cartLine={cartByProductId[item.productId] || null}
              onQtyChange={onQtyChange}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
}

function SelectedProductsList({ cart, onQtyChange }) {
  if (cart.length === 0) {
    return (
      <div style={{ padding: 14, borderRadius: 16, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Products you add from the catalog will appear here.
      </div>
    );
  }

  return (
    <div className="dispatcher-draft-list" style={{ display: "grid", gap: 8, maxHeight: "calc(100vh - 430px)", overflowY: "auto", paddingRight: 4 }}>
      {cart.map((line) => (
        <div key={line.productId} style={{ padding: 10, borderRadius: 16, background: "var(--color-fog, #f5f5f7)", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{line.packLabel || "Variant"}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <QtyStepper value={line.quantity} onChange={(next) => onQtyChange(line.productId, next)} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{money(line.lineTotal, line.currency)}</div>
              <button
                type="button"
                onClick={() => onQtyChange(line.productId, 0)}
                style={{ border: "none", background: "transparent", color: "#b42318", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 2 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftRail({ draftMetrics, cart, onQtyChange, onReview, onClose }) {
  const totalQty = Number(draftMetrics.totalQty || 0);

  return (
    <div className="dispatcher-draft-rail">
      <Surface padding={20} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <SectionHeader eyebrow="Order Draft" icon="package" title={`${totalQty} pack${totalQty === 1 ? "" : "s"}`} subtitle={`${cart.length} active line${cart.length === 1 ? "" : "s"}`} />
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close order draft" className="dispatcher-draft-close-btn">
              <DashboardIcon name="close" size={13} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(0,113,227,.06)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Estimated Subtotal</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{money(draftMetrics.subtotal)}</div>
        </div>

        <PrimaryButton onClick={onReview} disabled={totalQty <= 0} style={{ width: "100%", height: 46 }}>
          Review Order
        </PrimaryButton>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", marginBottom: 8 }}>Selected Products</div>
          <SelectedProductsList cart={cart} onQtyChange={onQtyChange} />
        </div>
      </Surface>
    </div>
  );
}

function FloatingDraftBar({ itemCount, subtotal, onReview, disabled = false }) {
  return (
    <button
      type="button"
      className="dispatcher-floating-draft"
      onClick={onReview}
      disabled={disabled}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        height: 52,
        padding: "0 18px",
        borderRadius: 999,
        border: "none",
        background: disabled ? "rgba(0,0,0,.16)" : "var(--color-azure, #0071e3)",
        color: "#fff",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        zIndex: 80,
        boxShadow: disabled ? "none" : "0 8px 24px rgba(0,113,227,.28)",
      }}
    >
      <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 999, background: "rgba(255,255,255,.22)", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
        {itemCount}
      </span>
      {disabled ? "Build Your Order" : `Review Order · ${money(subtotal)}`}
    </button>
  );
}

// Same solid-fill bag glyph as src/dealer/DealerCatalogPage.jsx's local
// BagIcon (the site's global NavBar "bag" icon) - kept local for the same
// reason: it's a fill icon, not part of the shared stroke-only DashboardIcons set.
function BagIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function LoadingGrid() {
  const shimmer = "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))";
  return (
    <div className="dispatcher-catalog-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <Surface key={i} padding={0} style={{ overflow: "hidden" }}>
          <div style={{ height: 180, background: shimmer }} />
          <div style={{ display: "grid", gap: 10, padding: 18 }}>
            <div style={{ height: 12, width: "60%", borderRadius: 6, background: shimmer }} />
            <div style={{ height: 44, borderRadius: 14, background: shimmer }} />
          </div>
        </Surface>
      ))}
    </div>
  );
}

export default function DispatcherOrderCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderSearchParam = searchParams.get("search") || "";

  const catalogQuery = useGetDispatcherReplenishmentCatalogQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const families = useMemo(() => familiesQuery.data || [], [familiesQuery.data]);
  const familyByCode = useMemo(() => {
    const map = new Map();
    for (const family of families) map.set(family.code, family);
    return map;
  }, [families]);

  const categoryOptions = useMemo(() => buildCategoryOptions(items), [items]);

  const hasCachedItems = items.length > 0;
  const loading = catalogQuery.isLoading && !hasCachedItems;
  const refreshing = !loading && catalogQuery.isFetching;
  const loadError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load your price list.") : "";

  const [quantities, setQuantities] = useState(loadDraft());
  const [search, setSearch] = useState(orderSearchParam);
  const [category, setCategory] = useState("ALL");
  const [viewMode, setViewMode] = useState("card");
  const [draftOpen, setDraftOpen] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);
  const previousQtyRef = useRef(0);

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSearch(orderSearchParam);
    if (orderSearchParam) setCategory("ALL");
  }, [orderSearchParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const categoryOk = activeCategory === "ALL" ? true : item.category === activeCategory;
      const queryOk = q
        ? [item.name, item.code, item.sku, item.category, item.packLabel].filter(Boolean).some((value) => String(value).toLowerCase().includes(q))
        : true;
      return categoryOk && queryOk;
    });
  }, [items, activeCategory, search]);

  const itemsByProductId = useMemo(() => {
    const map = {};
    for (const item of items) map[item.productId] = item;
    return map;
  }, [items]);

  const cart = useMemo(() => buildCart(itemsByProductId, quantities), [itemsByProductId, quantities]);
  const draftMetrics = useMemo(() => calculateCartTotals(cart), [cart]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const qty = Number(draftMetrics.totalQty || 0);
    if (qty > previousQtyRef.current) setBadgeBump(true);
    previousQtyRef.current = qty;
  }, [draftMetrics.totalQty]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cartByProductId = useMemo(() => {
    return cart.reduce((acc, line) => {
      acc[line.productId] = line;
      return acc;
    }, {});
  }, [cart]);

  const familyGroupsFlat = useMemo(() => {
    const groups = groupCatalogItemsByCode(filteredItems).map((group) => {
      const family = familyByCode.get(group.code);
      return {
        ...group,
        name: family?.name || group.name,
        familyImages: family?.images || [],
      };
    });
    return groups.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [familyByCode, filteredItems]);

  // Every category groups into its own horizontal carousel row - no
  // pagination, the whole catalog is shown at once (a row's own scroll
  // handles browsing within a category, matching Apple's own product
  // listing pages).
  const familyGroups = useMemo(() => {
    const map = new Map();
    for (const family of familyGroupsFlat) {
      const key = family.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(family);
    }
    return Array.from(map.entries())
      .map(([key, groupItems]) => ({ key, label: categoryLabel(key) || "Uncategorized", items: groupItems }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [familyGroupsFlat]);

  function handleQtyChange(productId, nextValue) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [productId]: nextValue }));
  }

  function handleReviewDraft() {
    saveDraft(sanitizeDraft(quantities));
    navigate("/dispatcher/cart");
  }

  function changeCategory(nextCategory) {
    setCategory(nextCategory);
    if (nextCategory !== "ALL" && search) {
      setSearch("");
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("search");
        return next;
      }, { replace: true });
    }
  }

  function updateSearch(value) {
    setSearch(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const cleanValue = String(value || "").trim();
        if (cleanValue) next.set("search", value);
        else next.delete("search");
        return next;
      },
      { replace: true },
    );
    setCategory("ALL");
  }

  const isMobile = useIsMobileDispatcher();

  if (isMobile) {
    return (
      <DispatcherCatalogMobileView
        loading={loading}
        loadError={loadError}
        onRetry={catalogQuery.refetch}
        families={familyGroupsFlat}
        search={search}
        onSearchChange={updateSearch}
        categoryOptions={categoryOptions}
        activeCategory={activeCategory}
        onCategoryChange={changeCategory}
      />
    );
  }

  return (
    <div className="dispatcher-catalog-shell">
      <div
        className="dispatcher-catalog-main"
        style={{
          display: "grid",
          gap: 24,
          marginRight: draftOpen ? 340 : 0,
          transition: "margin-right 300ms cubic-bezier(.23,1,.32,1)",
        }}
      >
        <Surface padding={24} className="dash-fade-up">
          <SectionHeader
            icon="package"
            title="My Order"
            size="large"
            subtitle="Replenish your regional stock at your own price list."
            action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="dispatcher-catalog-category-filter" style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 600 }}>Category</span>
              <AppleDropdown value={activeCategory} options={categoryOptions} onChange={changeCategory} placeholder="All Products" icon="filter" style={{ minWidth: 240 }} />
            </div>
            <div style={{ maxWidth: 340, flex: "1 1 240px" }}>
              <SearchField value={search} onChange={updateSearch} placeholder="Search products…" />
            </div>
            <ViewToggle value={viewMode === "list" ? "list" : "card"} onChange={(next) => setViewMode(next === "list" ? "list" : "card")} />
          </div>

          {loadError ? (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              <span>{loadError}</span>
              <GhostButton onClick={() => catalogQuery.refetch()}>Retry</GhostButton>
            </div>
          ) : null}
        </Surface>

        {loading ? (
          <LoadingGrid />
        ) : familyGroupsFlat.length === 0 ? (
          <EmptyState
            icon="package"
            title={search ? "No products match this search" : "No priced products yet"}
            subtitle={search ? "" : "Ask your Meitu admin to set up your dispatcher price list before you can place an order."}
          />
        ) : (
          <div style={{ display: "grid", gap: 40 }}>
            {familyGroups.map((group) => {
              const cards = group.items.map((family) => (
                <ProductFamilyCard
                  key={family.code}
                  family={family}
                  quantities={quantities}
                  cartByProductId={cartByProductId}
                  onQtyChange={handleQtyChange}
                  layout={viewMode === "list" ? "list" : "card"}
                />
              ));

              return (
                <div key={group.key || "uncategorized"}>
                  <div className="dispatcher-category-heading">
                    <span>{group.label}</span>
                    <span className="dispatcher-category-count">{group.items.length}</span>
                  </div>
                  {viewMode === "list" ? (
                    <div className="dispatcher-catalog-list">{cards}</div>
                  ) : (
                    <CatalogCarouselRow>{cards}</CatalogCarouselRow>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                onClick={() => setDraftOpen((open) => !open)}
                aria-pressed={draftOpen}
                aria-label={`${draftOpen ? "Close" : "Open"} order draft, ${draftMetrics.totalQty} item${draftMetrics.totalQty === 1 ? "" : "s"}`}
                className="dispatcher-catalog-cart-badge"
              >
                <BagIcon size={17} />
                {draftMetrics.totalQty > 0 ? (
                  <span className={`dispatcher-catalog-cart-sticker ${badgeBump ? "is-bumping" : ""}`} onAnimationEnd={() => setBadgeBump(false)}>
                    {draftMetrics.totalQty}
                  </span>
                ) : null}
              </button>

              <div className={`dispatcher-draft-panel ${draftOpen ? "is-open" : ""}`} aria-hidden={!draftOpen}>
                <DraftRail draftMetrics={draftMetrics} cart={cart} onQtyChange={handleQtyChange} onReview={handleReviewDraft} onClose={() => setDraftOpen(false)} />
              </div>
            </>,
            document.body,
          )
        : null}

      <FloatingDraftBar itemCount={draftMetrics.totalQty} subtotal={draftMetrics.subtotal} disabled={draftMetrics.totalQty <= 0} onReview={handleReviewDraft} />

      <style>{`
        .dispatcher-catalog-main{
          min-width:0;
        }

        .dispatcher-draft-panel{
          position:fixed;
          top:104px;
          right:40px;
          width:320px;
          max-height:calc(100vh - 140px);
          z-index:499;
          overflow:hidden;
          opacity:0;
          transform:scale(.95) translateY(-6px);
          transform-origin:top right;
          pointer-events:none;
          transition:opacity 160ms ease, transform 180ms cubic-bezier(.23,1,.32,1);
        }

        .dispatcher-draft-panel.is-open{
          opacity:1;
          transform:scale(1) translateY(0);
          pointer-events:auto;
          transition:opacity 240ms ease 60ms, transform 280ms cubic-bezier(.23,1,.32,1) 60ms;
        }

        @media (prefers-reduced-motion: reduce){
          .dispatcher-draft-panel,
          .dispatcher-draft-panel.is-open,
          .dispatcher-catalog-cart-sticker.is-bumping,
          .dispatcher-catalog-cart-badge,
          .dispatcher-draft-close-btn{
            transition:none!important;
            animation:none!important;
          }
        }

        .dispatcher-catalog-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(min(100%, 288px), 1fr));
          gap:20px;
        }

        .dispatcher-catalog-list{
          display:grid;
          gap:12px;
        }

        .dispatcher-catalog-cart-badge{
          position:fixed;
          top:56px;
          right:40px;
          z-index:500;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:40px;
          height:40px;
          border-radius:12px;
          border:1px solid rgba(29,29,31,.1);
          background:#fff;
          color:var(--color-ink, #1d1d1f);
          cursor:pointer;
          flex-shrink:0;
          box-shadow:0 4px 16px rgba(29,29,31,.08);
          transition:background 160ms ease, border-color 160ms ease, color 160ms ease;
        }

        .dispatcher-catalog-cart-badge:hover{
          background:var(--color-fog, #f5f5f7);
        }

        .dispatcher-catalog-cart-badge:active{
          background:rgba(29,29,31,.08);
        }

        .dispatcher-catalog-cart-badge[aria-pressed="true"]{
          border-color:rgba(0,113,227,.35);
          color:var(--color-azure, #0071e3);
          background:rgba(0,113,227,.06);
        }

        @media (max-width:1100px){
          .dispatcher-catalog-cart-badge,
          .dispatcher-draft-panel{
            display:none;
          }
        }

        .dispatcher-catalog-cart-sticker{
          position:absolute;
          top:-6px;
          right:-6px;
          min-width:18px;
          height:18px;
          padding:0 4px;
          border-radius:999px;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-size:10.5px;
          font-weight:800;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          line-height:1;
          box-shadow:0 0 0 2px #fff;
        }

        .dispatcher-catalog-cart-sticker.is-bumping{
          animation:dispatcherCartStickerBump 320ms cubic-bezier(.34,1.56,.64,1);
        }

        @keyframes dispatcherCartStickerBump{
          0%{ transform:scale(1); }
          40%{ transform:scale(1.45); }
          100%{ transform:scale(1); }
        }

        .dispatcher-draft-close-btn{
          width:28px;
          height:28px;
          border-radius:999px;
          border:none;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          flex-shrink:0;
          transition:transform 160ms ease-out, background 160ms ease;
        }

        .dispatcher-draft-close-btn:hover{
          background:rgba(29,29,31,.1);
        }

        .dispatcher-draft-close-btn:active{
          transform:scale(.92);
        }

        .dispatcher-product-row{
          display:flex;
          align-items:center;
          gap:16px;
          flex-wrap:wrap;
          transition:border-color .16s ease;
        }

        .dispatcher-product-row.selected{
          border-color:rgba(0,113,227,.28)!important;
        }

        .dispatcher-product-row-media{
          position:relative;
          width:64px;
          height:64px;
          flex:0 0 auto;
          border-radius:14px;
          overflow:hidden;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
        }

        .dispatcher-product-row-media img{
          width:100%;
          height:100%;
          object-fit:contain;
          mix-blend-mode:multiply;
          padding:8px;
        }

        .dispatcher-product-badge-sm{
          position:absolute;
          top:-4px;
          right:-4px;
          height:18px;
          padding:0 6px;
          font-size:10px;
        }

        .dispatcher-product-row-body{
          flex:0 0 auto;
          width:200px;
          min-width:160px;
          display:grid;
          gap:4px;
        }

        .dispatcher-variant-list-row{
          flex:1;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:0;
        }

        .dispatcher-variant-list-row .dispatcher-variant-row{
          flex:0 0 auto;
          width:230px;
        }

        .dispatcher-category-heading{
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:16px;
          padding-bottom:10px;
          border-bottom:1px solid rgba(29,29,31,.08);
          font-size:13px;
          font-weight:800;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-ink, #1d1d1f);
        }

        .dispatcher-category-count{
          min-width:20px;
          height:20px;
          padding:0 6px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:0;
          text-transform:none;
        }

        .dispatcher-product-card{
          display:flex;
          flex-direction:column;
          transition:transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s ease, border-color .22s ease;
        }

        .dispatcher-product-card:hover{
          transform:translateY(-3px);
          box-shadow:0 16px 32px rgba(15,23,42,.1);
        }

        .dispatcher-product-card.selected{
          border-color:rgba(0,113,227,.28)!important;
        }

        .dispatcher-product-media{
          position:relative;
          height:180px;
          flex:0 0 auto;
          overflow:hidden;
          display:grid;
          place-items:center;
          background:
            radial-gradient(circle at 30% 20%, rgba(0,113,227,.05), transparent 55%),
            var(--color-fog, #f5f5f7);
          border-bottom:1px solid rgba(29,29,31,.06);
        }

        .dispatcher-product-media img{
          position:absolute;
          inset:18px;
          width:calc(100% - 36px);
          height:calc(100% - 36px);
          object-fit:contain;
          mix-blend-mode:multiply;
        }

        .dispatcher-product-badge{
          position:absolute;
          top:12px;
          right:12px;
          height:24px;
          padding:0 9px 0 7px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          gap:4px;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-size:11px;
          font-weight:800;
          box-shadow:0 4px 12px rgba(0,113,227,.3);
        }

        .dispatcher-product-body{
          display:grid;
          gap:10px;
          padding:18px 18px 20px;
        }

        .dispatcher-product-meta{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--color-graphite, #707070);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
        }

        .dispatcher-product-name{
          font-size:16px;
          line-height:1.3;
          font-weight:700;
          letter-spacing:-.01em;
          color:var(--color-ink, #1d1d1f);
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        }

        .dispatcher-variant-list{
          display:grid;
          gap:6px;
          margin-top:4px;
        }

        .dispatcher-variant-row{
          display:grid;
          grid-template-columns:22px minmax(0,1fr) auto;
          align-items:center;
          gap:8px;
          padding:8px 9px;
          border-radius:14px;
          background:var(--color-fog, #f5f5f7);
          transition:background .16s ease;
        }

        .dispatcher-variant-row.selected{
          background:rgba(0,113,227,.08);
        }

        .dispatcher-variant-icon{
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:var(--color-graphite, #707070);
          background:rgba(255,255,255,.7);
        }

        .dispatcher-variant-row.selected .dispatcher-variant-icon{
          color:var(--color-azure, #0071e3);
          background:#fff;
        }

        .dispatcher-variant-copy{
          min-width:0;
        }

        .dispatcher-variant-pack{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          white-space:nowrap;
        }

        .dispatcher-size-picker-trigger{
          display:inline-flex;
          align-items:center;
          gap:4px;
          height:22px;
          padding:0 8px;
          border:none;
          border-radius:999px;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
          font-size:12.5px;
          font-weight:700;
          font-family:inherit;
          cursor:pointer;
          transition:background .14s ease;
        }
        .dispatcher-size-picker-trigger:hover{
          background:rgba(29,29,31,.1);
        }
        .dispatcher-size-picker-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:2px;
        }
        .dispatcher-size-picker-row-qty{
          display:inline-flex;
          align-items:center;
          height:20px;
          padding:0 8px;
          border-radius:999px;
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
          font-size:11px;
          font-weight:800;
          white-space:nowrap;
        }

        .dispatcher-catalog-category-filter .apple-dropdown-menu-trigger{
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          border:1px solid rgba(255,255,255,.08);
          box-shadow:none;
        }

        .dispatcher-catalog-category-filter .apple-dropdown-menu-trigger:hover{
          background:#000;
        }

        .dispatcher-catalog-category-filter .apple-dropdown-menu-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.42);
          outline-offset:3px;
        }

        .dispatcher-variant-price{
          margin-top:1px;
          font-size:10.5px;
          color:var(--color-graphite, #707070);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .dispatcher-variant-price strong{
          color:var(--color-azure, #0071e3);
          font-weight:800;
        }

        .dispatcher-qty-stepper{
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(29,29,31,.08);
          overflow:hidden;
        }

        .dispatcher-qty-stepper.selected{
          border-color:rgba(0,113,227,.22);
        }

        .dispatcher-qty-btn{
          width:24px;
          height:24px;
          border:none;
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform .14s var(--ease-out, ease), background .14s ease;
        }

        .dispatcher-qty-btn:hover{
          background:rgba(29,29,31,.06);
        }

        .dispatcher-qty-btn:active{
          transform:scale(.88);
        }

        .dispatcher-qty-input{
          width:26px;
          height:24px;
          border:none;
          outline:none;
          background:transparent;
          text-align:center;
          font-weight:800;
          font-size:12px;
          color:var(--color-ink, #1d1d1f);
          -moz-appearance:textfield;
        }

        .dispatcher-qty-input::-webkit-inner-spin-button,
        .dispatcher-qty-input::-webkit-outer-spin-button{
          -webkit-appearance:none;
          margin:0;
        }

        .dispatcher-draft-rail{
          height:100%;
        }

        .dispatcher-draft-list::-webkit-scrollbar{
          width:6px;
        }
        .dispatcher-draft-list::-webkit-scrollbar-thumb{
          border-radius:999px;
          background:rgba(15,23,42,.16);
        }

        @media (min-width:1101px){
          .dispatcher-floating-draft{ display:none!important; }
        }

        @media (max-width:640px){
          .dispatcher-catalog-grid{
            grid-template-columns:1fr;
          }
          .dispatcher-floating-draft{
            left:14px!important;
            right:14px!important;
            justify-content:center!important;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .dispatcher-product-card,
          .dispatcher-qty-btn,
          .dispatcher-floating-draft{
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}
