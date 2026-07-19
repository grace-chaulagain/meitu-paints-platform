import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useGetProductCategoriesQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../redux/api/selectors.js";
import {
  buildCart,
  calculateCartTotals,
  getTierLabel,
  groupProductsByCode,
  formatMoney,
  formatPack,
} from "./pricing.js";
import { loadDraft, saveDraft, sanitizeDraft } from "./draftStorage.js";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { AppleDropdown, PopoverListMenu } from "../components/dashboard/ApplePickers.jsx";
import {
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../utils/scrollResultsToTop.js";
import { useIsMobileDealer } from "./mobile/useIsMobileDealer.js";
import { DealerCatalogMobileView } from "./mobile/DealerCatalogMobileView.jsx";

const CATEGORIES_PER_PAGE = 4;

const ALL_CATEGORY_OPTION = { key: "ALL", label: "All Products" };

function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) result.push("ellipsis-" + p);
    result.push(p);
    prev = p;
  });
  return result;
}

function categoryLabel(value) {
  if (!value) return "";
  if (value === "ALL") return "All Categories";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryOption(option) {
  const value =
    typeof option === "string"
      ? option
      : option?.value || option?.code || option?.category || "";
  const cleanValue = String(value || "").trim();

  if (!cleanValue || cleanValue === "ALL") return null;

  return {
    key: cleanValue,
    label:
      typeof option === "object" && option?.label
        ? String(option.label)
        : categoryLabel(cleanValue),
  };
}

function buildCategoryOptions(categoryItems = [], products = []) {
  const map = new Map();

  for (const option of categoryItems) {
    const normalized = normalizeCategoryOption(option);
    if (normalized) map.set(normalized.key, normalized);
  }

  for (const product of products) {
    const normalized = normalizeCategoryOption(product?.category);
    if (normalized && !map.has(normalized.key)) {
      map.set(normalized.key, normalized);
    }
  }

  return [
    ALL_CATEGORY_OPTION,
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function getFamilySelectionCount(family, quantities) {
  return family.items.reduce((acc, item) => {
    const qty = Number(quantities[item.sku] || 0);
    return acc + (qty > 0 ? qty : 0);
  }, 0);
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function resolveFamilyDisplayImage(family) {
  const firstItem = family?.items?.[0] || null;

  const familyPrimary =
    family?.primaryImage ||
    getPrimaryImage(family?.familyImages || []) ||
    firstItem?.family?.primaryImage ||
    getPrimaryImage(firstItem?.family?.images || []) ||
    getPrimaryImage(firstItem?.familyImages || []);

  const productPrimary = getPrimaryImage(firstItem?.images || []);
  const displayImage = familyPrimary || productPrimary || null;

  return {
    url: displayImage?.url || "",
    alt:
      displayImage?.alt || family?.name || firstItem?.name || "Meitu product",
  };
}

function QtyStepper({ value, onChange, selected = false, disabled = false }) {
  const qty = Number(value || 0);

  return (
    <div className={`dealer-qty-stepper ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, qty - 1))}
        aria-label="Decrease quantity"
        className="dealer-qty-btn"
        disabled={disabled}
      >
        <DashboardIcon name="minus" size={12} strokeWidth={2.4} />
      </button>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Math.max(0, Number(event.target.value)))
        }
        className="dealer-qty-input"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
        className="dealer-qty-btn"
        disabled={disabled}
      >
        <DashboardIcon name="plus" size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// Compact inline sibling to AppleDropdown (same PopoverListMenu portal-popover
// underneath, same checkmark-on-selected-row treatment) sized to sit inline
// inside a single variant row instead of a toolbar - AppleDropdown's own
// 44px-tall pill trigger is too tall for this context. The trigger itself
// only ever shows the selected size + a chevron - which size is queued and
// how much is a decision made inside the popover, not a number glued onto
// the closed pill (that read as a stray "20L 1", easy to mistake for part
// of the size itself).
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
        <button
          type="button"
          ref={triggerRef}
          onClick={onClick}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="dealer-size-picker-trigger"
        >
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
            {option.quantity > 0 ? <span className="dealer-size-picker-row-qty">{option.quantity} in cart</span> : null}
            {isSelected ? <DashboardIcon name="checkmark" size={13} strokeWidth={2.4} style={{ color: "var(--color-azure, #0071e3)" }} /> : null}
          </span>
        </button>
      )}
    />
  );
}

function VariantRow({ product, quantity, cartLine, onQtyChange, sizeOptions, onSizeChange }) {
  const qty = Number(quantity || 0);
  const selected = qty > 0;
  const isPriceless = !(product?.pricing?.tiers || []).length;
  const tier = cartLine?.tier || null;
  const unitPrice = Number(cartLine?.unitPrice || 0);
  const subtotal = Number(cartLine?.lineTotal || 0);
  const tierLabel = getTierLabel(tier, product.pricing);
  // getTierLabel falls back to "—" when there's no tier yet (nothing in the
  // cart at this size) - that placeholder isn't a real tier, so it shouldn't
  // render as a badge at all, only an actual tier or the "Flat" label should.
  // List view (identified by sizeOptions being passed - only its call site
  // supplies that prop) never shows this badge at all - the bulk-pricing
  // range ("1–80L") reads as visual noise glued onto the size picker there.
  const showTier = Boolean(tier) && tierLabel && tierLabel !== "Flat" && !sizeOptions;

  return (
    <div className={`dealer-variant-row ${selected ? "selected" : ""} ${isPriceless ? "priceless" : ""}`} title={product.sku}>
      <span className="dealer-variant-icon">
        <DashboardIcon name="package" size={14} strokeWidth={1.8} />
      </span>

      <div className="dealer-variant-copy">
        <div className="dealer-variant-pack">
          {sizeOptions && sizeOptions.length > 1 ? (
            <SizePickerDropdown value={product.sku} options={sizeOptions} onChange={onSizeChange} />
          ) : (
            formatPack(product.pack)
          )}
          {showTier ? <span className="dealer-variant-tier">{tierLabel}</span> : null}
        </div>
        <div className="dealer-variant-price">
          {isPriceless ? (
            "Pricing pending"
          ) : (
            <>
              {formatMoney(unitPrice, product.currency)}
              {selected ? <strong> · {formatMoney(subtotal, product.currency)}</strong> : null}
            </>
          )}
        </div>
      </div>

      <QtyStepper value={quantity} selected={selected} disabled={isPriceless} onChange={(next) => onQtyChange(product.sku, next)} />
    </div>
  );
}

function ProductFamilyCard({ family, quantities, cartBySku, onQtyChange, layout = "card" }) {
  const selectionCount = getFamilySelectionCount(family, quantities);
  const artwork = resolveFamilyDisplayImage(family);
  const sortedItems = family.items.slice().sort((a, b) => Number(b?.pack?.size || 0) - Number(a?.pack?.size || 0));
  const selected = selectionCount > 0;

  // List view shows one size at a time (picked via the dropdown built into
  // VariantRow's pack label) instead of stacking every pack size as its own
  // row - defaults to whichever size already has a quantity set, falling
  // back to the largest pack.
  const defaultActiveSku = sortedItems.find((item) => Number(quantities[item.sku] || 0) > 0)?.sku || sortedItems[0]?.sku;
  const [activeSku, setActiveSku] = useState(defaultActiveSku);
  const activeProduct = sortedItems.find((item) => item.sku === activeSku) || sortedItems[0];

  if (layout === "list") {
    const sizeOptions = sortedItems.map((item) => ({
      key: item.sku,
      label: formatPack(item.pack),
      quantity: Number(quantities[item.sku] || 0),
    }));

    return (
      <Surface padding={14} className={`dealer-product-row dash-fade-up ${selected ? "selected" : ""}`}>
        <div className="dealer-product-row-media">
          {artwork.url ? (
            <img src={artwork.url} alt={artwork.alt} loading="lazy" />
          ) : (
            <DashboardIcon name="package" size={26} strokeWidth={1.4} style={{ color: "rgba(0,0,0,.22)" }} />
          )}
          {selectionCount > 0 ? (
            <span className="dealer-product-badge dealer-product-badge-sm">
              <DashboardIcon name="checkmark" size={10} strokeWidth={2.6} />
              {selectionCount}
            </span>
          ) : null}
        </div>

        <div className="dealer-product-row-body">
          <div className="dealer-product-meta">
            <DashboardIcon name="store" size={11} strokeWidth={2} />
            <span>{categoryLabel(family.category)}</span>
          </div>
          <div className="dealer-product-name">{family.name}</div>
        </div>

        <div className="dealer-variant-list dealer-variant-list-row">
          {activeProduct ? (
            <VariantRow
              key={activeProduct.sku}
              product={activeProduct}
              quantity={quantities[activeProduct.sku] || ""}
              cartLine={cartBySku[activeProduct.sku] || null}
              onQtyChange={onQtyChange}
              sizeOptions={sizeOptions}
              onSizeChange={setActiveSku}
            />
          ) : null}
        </div>
      </Surface>
    );
  }

  return (
    <Surface padding={0} style={{ overflow: "hidden" }} className={`dealer-product-card dash-fade-up ${selected ? "selected" : ""}`}>
      <div className="dealer-product-media">
        {artwork.url ? (
          <img src={artwork.url} alt={artwork.alt} loading="lazy" />
        ) : (
          <DashboardIcon name="package" size={40} strokeWidth={1.3} style={{ color: "rgba(0,0,0,.22)" }} />
        )}

        {selectionCount > 0 ? (
          <span className="dealer-product-badge">
            <DashboardIcon name="checkmark" size={11} strokeWidth={2.6} />
            {selectionCount}
          </span>
        ) : null}
      </div>

      <div className="dealer-product-body">
        <div className="dealer-product-meta">
          <DashboardIcon name="store" size={11} strokeWidth={2} />
          <span>{categoryLabel(family.category)}</span>
        </div>
        <div className="dealer-product-name">{family.name}</div>

        <div className="dealer-variant-list">
          {sortedItems.map((product) => (
            <VariantRow
              key={product.sku}
              product={product}
              quantity={quantities[product.sku] || ""}
              cartLine={cartBySku[product.sku] || null}
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
    <div className="dealer-draft-list" style={{ display: "grid", gap: 8, maxHeight: "calc(100vh - 430px)", overflowY: "auto", paddingRight: 4 }}>
      {cart.map((line) => (
        <div key={line.sku} style={{ padding: 10, borderRadius: 16, background: "var(--color-fog, #f5f5f7)", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{formatPack(line.pack)} · {getTierLabel(line.tier, line.pricing)}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <QtyStepper value={line.quantity} onChange={(next) => onQtyChange(line.sku, next)} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{formatMoney(line.lineTotal, line.currency)}</div>
              <button
                type="button"
                onClick={() => onQtyChange(line.sku, 0)}
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
    <div className="dealer-draft-rail">
      <Surface padding={20} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <SectionHeader eyebrow="Order Draft" icon="package" title={`${totalQty} pack${totalQty === 1 ? "" : "s"}`} subtitle={`${cart.length} active line${cart.length === 1 ? "" : "s"}`} />
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close order draft" className="dealer-draft-close-btn">
              <DashboardIcon name="close" size={13} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(0,113,227,.06)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Estimated Subtotal</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(draftMetrics.subtotal)}</div>
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
      className="dealer-floating-draft"
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
      {disabled ? "Build Your Order" : `Review Order · ${formatMoney(subtotal)}`}
    </button>
  );
}

// Same Apple-style bag glyph used by the site's global NavBar (NavAccountIcon
// "bag") — a solid fill icon, not the stroke-based line icons in
// DashboardIcons.jsx, so it's kept local rather than shoehorned into that
// shared stroke-only icon set.
function BagIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function CatalogPagination({ page, totalPages, totalCount, startIndex, endIndex, onChange }) {
  if (totalCount === 0) return null;

  const pages = buildPageList(page, totalPages);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Showing {startIndex} to {endIndex} of {totalCount} products
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="dealer-catalog-page-btn"
        >
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`dealer-catalog-page-btn ${p === page ? "is-active" : ""}`}
            >
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              …
            </span>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="dealer-catalog-page-btn"
        >
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function LoadingGrid() {
  const shimmer = "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))";
  return (
    <div className="dealer-catalog-grid">
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

export default function DealerCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderSearchParam = searchParams.get("search") || "";

  const productsQuery = useGetProductsQuery();
  const categoriesQuery = useGetProductCategoriesQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const products = useMemo(
    () => (productsQuery.data || []).filter((item) => item?.isActive !== false),
    [productsQuery.data],
  );

  // groupProductsByCode (pricing.js) builds each "family" purely from
  // Product documents (per-size items), which have no family-level image
  // concept - it never touches the real ProductFamily collection, so the
  // grouped families it returns have no `images` field at all. This maps
  // ProductFamily.images (the single shared photo, independent of which
  // size a dealer picks) onto each grouped family by code, so the catalog
  // card can show one consistent picture per product instead of whichever
  // size happened to be items[0].
  const familyImageMap = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family.images || [];
    }
    return map;
  }, [familiesQuery.data]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categoriesQuery.data || [], products),
    [categoriesQuery.data, products],
  );

  const hasCachedProducts = products.length > 0;
  const loading = productsQuery.isLoading && !hasCachedProducts;
  const refreshing = !loading && (productsQuery.isFetching || categoriesQuery.isFetching);
  const loadError = productsQuery.error
    ? getQueryErrorMessage(productsQuery.error, "Failed to load product catalog.")
    : "";

  const [quantities, setQuantities] = useState(loadDraft());
  const [search, setSearch] = useState(orderSearchParam);
  const [category, setCategory] = useState("ALL");
  const [viewMode, setViewMode] = useState("card");
  const [page, setPage] = useState(1);
  const [draftOpen, setDraftOpen] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);
  const previousQtyRef = useRef(0);

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  // This effect intentionally synchronizes route query state into the visible controls.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSearch(orderSearchParam);
    if (orderSearchParam) setCategory("ALL");
  }, [orderSearchParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((item) => {
      const categoryOk = activeCategory === "ALL" ? true : item.category === activeCategory;
      const queryOk = q
        ? [item.name, item.code, item.sku, item.category, item.pack?.label]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;

      return categoryOk && queryOk;
    });
  }, [products, activeCategory, search]);

  const productsMap = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
    }, {});
  }, [products]);

  const cart = useMemo(() => buildCart(productsMap, quantities), [productsMap, quantities]);
  const draftMetrics = useMemo(() => calculateCartTotals(cart), [cart]);

  // Detecting an increase requires comparing against the previous render's
  // value, which a ref + effect is the correct tool for (not derivable from
  // props/state alone during render).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const qty = Number(draftMetrics.totalQty || 0);
    if (qty > previousQtyRef.current) setBadgeBump(true);
    previousQtyRef.current = qty;
  }, [draftMetrics.totalQty]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cartBySku = useMemo(() => {
    return cart.reduce((acc, line) => {
      acc[line.sku] = line;
      return acc;
    }, {});
  }, [cart]);

  const families = useMemo(() => {
    const grouped = groupProductsByCode(filteredProducts);
    return grouped
      .map((family) => ({ ...family, images: familyImageMap[family.code] || [] }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [filteredProducts, familyImageMap]);

  // Paginated by whole category, CATEGORIES_PER_PAGE per page — a category's
  // products always stay together (never split across a page boundary),
  // regardless of how many products that category has.
  const allGroups = useMemo(() => {
    const map = new Map();
    for (const family of families) {
      const key = family.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(family);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, label: categoryLabel(key) || "Uncategorized", items }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [families]);

  const catalogPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < allGroups.length; i += CATEGORIES_PER_PAGE) {
      const groups = allGroups.slice(i, i + CATEGORIES_PER_PAGE);
      pages.push({ groups, count: groups.reduce((sum, group) => sum + group.items.length, 0) });
    }
    return pages;
  }, [allGroups]);

  const totalPages = Math.max(1, catalogPages.length);
  const currentPage = Math.min(page, totalPages);
  const activePage = catalogPages[currentPage - 1] || { groups: [], count: 0 };
  const familyGroups = activePage.groups;

  const pageStartIndex = useMemo(() => {
    let start = 1;
    for (let i = 0; i < currentPage - 1; i += 1) start += catalogPages[i].count;
    return start;
  }, [catalogPages, currentPage]);
  const pageEndIndex = pageStartIndex + Math.max(0, activePage.count - 1);

  function handleQtyChange(sku, nextValue) {
    setQuantities((prev) => sanitizeDraft({ ...prev, [sku]: nextValue }));
  }

  function handleReviewDraft() {
    saveDraft(sanitizeDraft(quantities));
    navigate("/dealer/cart");
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    scrollResultsToTop();
  }

  // Search and category are mutually exclusive rather than combinable -
  // activating one clears the other, keeping filter state simple and
  // predictable instead of a combinatorial search+category mix.
  function changeCategory(nextCategory) {
    setCategory(nextCategory);
    setPage(1);
    scrollResultsToTop();
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
    setPage(1);
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

  const isMobile = useIsMobileDealer();
  if (isMobile) {
    return (
      <DealerCatalogMobileView
        loading={loading}
        loadError={loadError}
        onRetry={() => productsQuery.refetch()}
        families={families}
        search={search}
        onSearchChange={updateSearch}
        categoryOptions={categoryOptions}
        activeCategory={activeCategory}
        onCategoryChange={changeCategory}
      />
    );
  }

  return (
    <div className="dealer-catalog-shell">
      <div
        className="dealer-catalog-main"
        style={{
          display: "grid",
          gap: 24,
          marginRight: draftOpen ? 340 : 0,
          transition: "margin-right 300ms cubic-bezier(.23,1,.32,1)",
        }}
      >
        <Surface padding={24} className="dash-fade-up">
          <SectionHeader
            icon="store"
            title="Products"
            size="large"
            action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="dealer-catalog-category-filter" style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 600 }}>Category</span>
              <AppleDropdown
                value={activeCategory}
                options={categoryOptions}
                onChange={changeCategory}
                placeholder="All Products"
                icon="filter"
                style={{ minWidth: 240 }}
              />
            </div>
            <div style={{ maxWidth: 340, flex: "1 1 240px" }}>
              <SearchField value={search} onChange={updateSearch} placeholder="Search products…" />
            </div>
            <ViewToggle value={viewMode === "list" ? "list" : "card"} onChange={(next) => setViewMode(next === "list" ? "list" : "card")} />
          </div>

          {loadError ? (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              <span>{loadError}</span>
              <GhostButton onClick={() => productsQuery.refetch()}>Retry</GhostButton>
            </div>
          ) : null}
        </Surface>

        {loading ? (
          <LoadingGrid />
        ) : families.length === 0 ? (
          <EmptyState icon="store" title="No products found" subtitle="Try broadening your search or clearing the current filters." />
        ) : (
          <>
            <div style={{ display: "grid", gap: 40 }}>
              {familyGroups.map((group) => (
                <div key={group.key || "uncategorized"}>
                  <div className="dealer-category-heading">
                    <span>{group.label}</span>
                    <span className="dealer-category-count">{group.items.length}</span>
                  </div>
                  <div className={viewMode === "list" ? "dealer-catalog-list" : "dealer-catalog-grid"}>
                    {group.items.map((family) => (
                      <ProductFamilyCard
                        key={family.code}
                        family={family}
                        quantities={quantities}
                        cartBySku={cartBySku}
                        onQtyChange={handleQtyChange}
                        layout={viewMode === "list" ? "list" : "card"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <CatalogPagination
              page={currentPage}
              totalPages={totalPages}
              totalCount={families.length}
              startIndex={pageStartIndex}
              endIndex={pageEndIndex}
              onChange={goToPage}
            />
          </>
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
                className="dealer-catalog-cart-badge"
              >
                <BagIcon size={17} />
                {draftMetrics.totalQty > 0 ? (
                  <span
                    className={`dealer-catalog-cart-sticker ${badgeBump ? "is-bumping" : ""}`}
                    onAnimationEnd={() => setBadgeBump(false)}
                  >
                    {draftMetrics.totalQty}
                  </span>
                ) : null}
              </button>

              <div className={`dealer-draft-panel ${draftOpen ? "is-open" : ""}`} aria-hidden={!draftOpen}>
                <DraftRail
                  draftMetrics={draftMetrics}
                  cart={cart}
                  onQtyChange={handleQtyChange}
                  onReview={handleReviewDraft}
                  onClose={() => setDraftOpen(false)}
                />
              </div>
            </>,
            document.body,
          )
        : null}

      <FloatingDraftBar
        itemCount={draftMetrics.totalQty}
        subtotal={draftMetrics.subtotal}
        disabled={draftMetrics.totalQty <= 0}
        onReview={handleReviewDraft}
      />

      <style>{`
        .dealer-catalog-main{
          min-width:0;
        }

        /* Fixed to the viewport — stays in place while the page scrolls
           behind it, and the panel visually opens from this same anchor
           point (shared transform-origin: top right). */
        .dealer-draft-panel{
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

        .dealer-draft-panel.is-open{
          opacity:1;
          transform:scale(1) translateY(0);
          pointer-events:auto;
          transition:opacity 240ms ease 60ms, transform 280ms cubic-bezier(.23,1,.32,1) 60ms;
        }

        @media (max-width:1100px){
          .dealer-catalog-cart-badge,
          .dealer-draft-panel{
            display:none;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .dealer-draft-panel,
          .dealer-draft-panel.is-open,
          .dealer-catalog-cart-sticker.is-bumping,
          .dealer-catalog-cart-badge,
          .dealer-draft-close-btn{
            transition:none!important;
            animation:none!important;
          }
        }

        .dealer-catalog-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(min(100%, 288px), 1fr));
          gap:20px;
        }

        .dealer-catalog-list{
          display:grid;
          gap:12px;
        }

        .dealer-catalog-cart-badge{
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

        .dealer-catalog-cart-badge:hover{
          background:var(--color-fog, #f5f5f7);
        }

        .dealer-catalog-cart-badge:active{
          background:rgba(29,29,31,.08);
        }

        .dealer-catalog-cart-badge[aria-pressed="true"]{
          border-color:rgba(0,113,227,.35);
          color:var(--color-azure, #0071e3);
          background:rgba(0,113,227,.06);
        }

        .dealer-catalog-cart-sticker{
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

        .dealer-catalog-cart-sticker.is-bumping{
          animation:cartStickerBump 320ms cubic-bezier(.34,1.56,.64,1);
        }

        @keyframes cartStickerBump{
          0%{ transform:scale(1); }
          40%{ transform:scale(1.45); }
          100%{ transform:scale(1); }
        }

        .dealer-draft-close-btn{
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

        .dealer-draft-close-btn:hover{
          background:rgba(29,29,31,.1);
        }

        .dealer-draft-close-btn:active{
          transform:scale(.92);
        }

        .dealer-product-row{
          display:flex;
          align-items:center;
          gap:16px;
          flex-wrap:wrap;
          transition:border-color .16s ease;
        }

        .dealer-product-row.selected{
          border-color:rgba(0,113,227,.28)!important;
        }

        .dealer-product-row-media{
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

        .dealer-product-row-media img{
          width:100%;
          height:100%;
          object-fit:contain;
          mix-blend-mode:multiply;
          padding:8px;
        }

        .dealer-product-badge-sm{
          position:absolute;
          top:-4px;
          right:-4px;
          height:18px;
          padding:0 6px;
          font-size:10px;
        }

        .dealer-product-row-body{
          flex:0 0 auto;
          width:200px;
          min-width:160px;
          display:grid;
          gap:4px;
        }

        .dealer-variant-list-row{
          flex:1;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:0;
        }

        .dealer-variant-list-row .dealer-variant-row{
          flex:0 0 auto;
          width:230px;
        }

        .dealer-catalog-page-btn{
          min-width:32px;
          height:32px;
          padding:0 8px;
          border-radius:8px;
          border:none;
          background:transparent;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }

        .dealer-catalog-page-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .dealer-catalog-page-btn.is-active{ background:var(--color-azure, #0071e3); color:#fff; }
        .dealer-catalog-page-btn:not(.is-active):not(:disabled):hover{ background:rgba(29,29,31,.06); }

        .dealer-category-heading{
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

        .dealer-category-count{
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

        .dealer-product-card{
          display:flex;
          flex-direction:column;
          transition:transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s ease, border-color .22s ease;
        }

        .dealer-product-card:hover{
          transform:translateY(-3px);
          box-shadow:0 16px 32px rgba(15,23,42,.1);
        }

        .dealer-product-card.selected{
          border-color:rgba(0,113,227,.28)!important;
        }

        .dealer-product-media{
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

        .dealer-product-media img{
          position:absolute;
          inset:18px;
          width:calc(100% - 36px);
          height:calc(100% - 36px);
          object-fit:contain;
          mix-blend-mode:multiply;
        }

        .dealer-product-badge{
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

        .dealer-product-body{
          display:grid;
          gap:10px;
          padding:18px 18px 20px;
        }

        .dealer-product-meta{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--color-graphite, #707070);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
        }

        .dealer-product-name{
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

        .dealer-variant-list{
          display:grid;
          gap:6px;
          margin-top:4px;
        }

        .dealer-variant-row{
          display:grid;
          grid-template-columns:22px minmax(0,1fr) auto;
          align-items:center;
          gap:8px;
          padding:8px 9px;
          border-radius:14px;
          background:var(--color-fog, #f5f5f7);
          transition:background .16s ease;
        }

        .dealer-variant-row.selected{
          background:rgba(0,113,227,.08);
        }

        .dealer-variant-row.priceless{
          background:rgba(193,18,31,.06);
        }
        .dealer-variant-row.priceless .dealer-variant-price{
          color:var(--color-meitu-red, #c1121f);
        }

        .dealer-variant-icon{
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:var(--color-graphite, #707070);
          background:rgba(255,255,255,.7);
        }

        .dealer-variant-row.selected .dealer-variant-icon{
          color:var(--color-azure, #0071e3);
          background:#fff;
        }

        .dealer-variant-copy{
          min-width:0;
        }

        .dealer-variant-pack{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          white-space:nowrap;
        }

        .dealer-size-picker-trigger{
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
        .dealer-size-picker-trigger:hover{
          background:rgba(29,29,31,.1);
        }
        .dealer-size-picker-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:2px;
        }
        .dealer-size-picker-row-qty{
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

        .dealer-catalog-category-filter .apple-dropdown-menu-trigger{
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          border:1px solid rgba(255,255,255,.08);
          box-shadow:none;
        }

        .dealer-catalog-category-filter .apple-dropdown-menu-trigger:hover{
          background:#000;
        }

        .dealer-catalog-category-filter .apple-dropdown-menu-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.42);
          outline-offset:3px;
        }

        .dealer-variant-tier{
          padding:1px 6px;
          border-radius:999px;
          background:rgba(0,113,227,.12);
          color:var(--color-azure, #0071e3);
          font-size:9.5px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.02em;
        }

        .dealer-variant-price{
          margin-top:1px;
          font-size:10.5px;
          color:var(--color-graphite, #707070);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .dealer-variant-price strong{
          color:var(--color-azure, #0071e3);
          font-weight:800;
        }

        .dealer-qty-stepper{
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(29,29,31,.08);
          overflow:hidden;
        }

        .dealer-qty-stepper.selected{
          border-color:rgba(0,113,227,.22);
        }

        .dealer-qty-stepper.disabled{
          opacity:.45;
        }
        .dealer-qty-btn:disabled{
          cursor:not-allowed;
        }
        .dealer-qty-input:disabled{
          cursor:not-allowed;
        }

        .dealer-qty-btn{
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

        .dealer-qty-btn:hover{
          background:rgba(29,29,31,.06);
        }

        .dealer-qty-btn:active{
          transform:scale(.88);
        }

        .dealer-qty-input{
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

        .dealer-qty-input::-webkit-inner-spin-button,
        .dealer-qty-input::-webkit-outer-spin-button{
          -webkit-appearance:none;
          margin:0;
        }

        .dealer-draft-rail{
          height:100%;
        }

        .dealer-draft-list::-webkit-scrollbar{
          width:6px;
        }
        .dealer-draft-list::-webkit-scrollbar-thumb{
          border-radius:999px;
          background:rgba(15,23,42,.16);
        }

        @media (min-width:1101px){
          .dealer-floating-draft{ display:none!important; }
        }

        @media (max-width:640px){
          .dealer-catalog-grid{
            grid-template-columns:1fr;
          }
          .dealer-floating-draft{
            left:14px!important;
            right:14px!important;
            justify-content:center!important;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .dealer-product-card,
          .dealer-qty-btn,
          .dealer-floating-draft{
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}
