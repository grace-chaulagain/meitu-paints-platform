import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGetProductsQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import {
  buildCart,
  calculateCartTotals,
  formatMoney,
  formatPack,
  getTierLabel,
  groupProductsByCode,
} from "../../dealer/pricing.js";
import { DashboardIcon } from "./DashboardIcons.jsx";
import {
  Dropdown,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
} from "./DashboardUI.jsx";
import CatalogCarouselRow from "./CatalogCarouselRow.jsx";
import { downloadDraftOrderPdf } from "../../utils/downloadDraftOrderPdf.js";

// Same Apple-style bag glyph as DealerCatalogPage.jsx's BagIcon (and the
// site's global NavBar) - kept local rather than shared since it's a
// solid-fill icon, not the stroke-based line icons in DashboardIcons.jsx.
function BagIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </svg>
  );
}

// Mirrors src/dealer/DealerCatalogPage.jsx's visual language exactly (same
// class-naming convention, "draft-" instead of "dealer-") so this internal
// pricing utility (used by both Admin and Dispatcher, via roleLabel/
// enableOfficeExport props) reads as the same product as the page dealers
// actually shop from, not a different generic admin tool.

const ALL_CATEGORY_OPTION = { key: "ALL", label: "All Categories" };

function categoryLabel(value) {
  if (!value) return "";
  if (value === "ALL") return "All Categories";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCategoryOptions(products = []) {
  const map = new Map();
  for (const product of products) {
    const value = String(product?.category || "").trim();
    if (!value || map.has(value)) continue;
    map.set(value, { key: value, label: categoryLabel(value) });
  }
  return [
    ALL_CATEGORY_OPTION,
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function money(value, currency = "NPR") {
  return formatMoney(value, currency);
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((image) => image?.isPrimary) || images[0] || null;
}

function resolveFamilyImage(family) {
  const items = Array.isArray(family?.items) ? family.items : [];

  for (const product of items) {
    const image =
      product?.primaryImage ||
      getPrimaryImage(product?.familyImages || []) ||
      getPrimaryImage(product?.family?.images || []) ||
      getPrimaryImage(product?.images || []);

    if (image?.url) return image;
  }

  return null;
}

function QtyStepper({ value, onChange, selected = false }) {
  const qty = Number(value || 0);

  return (
    <div className={`draft-qty-stepper ${selected ? "selected" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, qty - 1))}
        aria-label="Decrease quantity"
        className="draft-qty-btn"
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
        className="draft-qty-input"
      />
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
        className="draft-qty-btn"
      >
        <DashboardIcon name="plus" size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function VariantRow({ product, quantity, cartLine, onQtyChange, setLineRef }) {
  const qty = Number(quantity || 0);
  const selected = qty > 0;
  const tier = cartLine?.tier || null;
  const unitPrice = Number(cartLine?.unitPrice || 0);
  const subtotal = Number(cartLine?.lineTotal || 0);
  const tierLabel = getTierLabel(tier, product.pricing);

  return (
    <div
      className={`draft-variant-row ${selected ? "selected" : ""}`}
      title={product.sku}
      ref={(node) => setLineRef(product.sku, node)}
      data-sku={product.sku}
    >
      <span className="draft-variant-icon">
        <DashboardIcon name="package" size={14} strokeWidth={1.8} />
      </span>

      <div className="draft-variant-copy">
        <div className="draft-variant-pack">
          {formatPack(product.pack)}
          {tierLabel && tierLabel !== "Flat" ? <span className="draft-variant-tier">{tierLabel}</span> : null}
        </div>
        <div className="draft-variant-price">
          {money(unitPrice, product.currency)}
          {selected ? <strong> · {money(subtotal, product.currency)}</strong> : null}
        </div>
      </div>

      <QtyStepper value={quantity} selected={selected} onChange={(next) => onQtyChange(product.sku, next)} />
    </div>
  );
}

function ProductFamilyCard({ family, quantities, cartBySku, onQtyChange, setLineRef }) {
  const selectionCount = family.items.reduce(
    (count, product) => count + (Number(quantities[product.sku] || 0) > 0 ? 1 : 0),
    0,
  );
  const artwork = resolveFamilyImage(family);
  const sortedItems = family.items.slice().sort((a, b) => Number(b?.pack?.size || 0) - Number(a?.pack?.size || 0));
  const selected = selectionCount > 0;
  const largestPack = sortedItems[0]?.pack || null;

  return (
    <Surface padding={0} style={{ overflow: "hidden" }} className={`draft-product-card dash-fade-up ${selected ? "selected" : ""}`}>
      <div className="draft-product-media">
        {artwork?.url ? (
          <img src={artwork.url} alt={artwork.alt || family.name || "Product"} loading="lazy" />
        ) : (
          <DashboardIcon name="package" size={40} strokeWidth={1.3} style={{ color: "rgba(0,0,0,.22)" }} />
        )}

        {largestPack ? <span className="draft-product-pack-badge">{formatPack(largestPack)}</span> : null}

        {selectionCount > 0 ? (
          <span className="draft-product-badge">
            <DashboardIcon name="checkmark" size={11} strokeWidth={2.6} />
            {selectionCount}
          </span>
        ) : null}
      </div>

      <div className="draft-product-body">
        <div className="draft-product-meta">
          <DashboardIcon name="store" size={11} strokeWidth={2} />
          <span>{categoryLabel(family.category)}</span>
        </div>
        <div className="draft-product-name">{family.name}</div>

        <div className="draft-variant-list">
          {sortedItems.map((product) => (
            <VariantRow
              key={product.sku}
              product={product}
              quantity={quantities[product.sku] || ""}
              cartLine={cartBySku[product.sku] || null}
              onQtyChange={onQtyChange}
              setLineRef={setLineRef}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
}

function SelectedProductsList({ cart, onQtyChange, onLineSelect }) {
  if (cart.length === 0) {
    return (
      <div style={{ padding: 14, borderRadius: 16, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Select product quantities to calculate a draft total.
      </div>
    );
  }

  return (
    <div className="draft-lines-list" style={{ display: "grid", gap: 8, maxHeight: "calc(100vh - 430px)", overflowY: "auto", paddingRight: 4 }}>
      {cart.map((line) => (
        <div key={line.sku} style={{ padding: 10, borderRadius: 16, background: "var(--color-fog, #f5f5f7)", display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => onLineSelect(line)}
            style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", display: "grid", gap: 2 }}
            aria-label={`Scroll to ${line.name} ${formatPack(line.pack)}`}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</span>
            <span style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{formatPack(line.pack)} · {getTierLabel(line.tier, line.pricing)}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <QtyStepper value={line.quantity} onChange={(next) => onQtyChange(line.sku, next)} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{money(line.lineTotal, line.currency)}</div>
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

function DraftRail({ cart, totals, currency, onClear, onExport, onQtyChange, onLineSelect, enableExport, onClose }) {
  const totalQty = Number(totals.totalQty || 0);

  return (
    <Surface padding={20} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <SectionHeader eyebrow="Draft Order" icon="invoice" title={`${totalQty} pack${totalQty === 1 ? "" : "s"}`} subtitle={`${cart.length} active line${cart.length === 1 ? "" : "s"}`} />
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close draft order" className="draft-panel-close-btn">
            <DashboardIcon name="close" size={13} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

        <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(0,113,227,.06)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Draft Total</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{money(totals.subtotal, currency)}</div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {enableExport ? (
            <PrimaryButton icon="download" onClick={onExport} disabled={!cart.length} style={{ width: "100%", height: 46 }}>
              Export PDF
            </PrimaryButton>
          ) : null}
          <GhostButton icon="refresh" onClick={onClear} disabled={!cart.length} style={{ width: "100%", justifyContent: "center" }}>
            Clear draft
          </GhostButton>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", marginBottom: 8 }}>Selected Products</div>
          <SelectedProductsList cart={cart} onQtyChange={onQtyChange} onLineSelect={onLineSelect} />
        </div>
    </Surface>
  );
}

function LoadingGrid() {
  const shimmer = "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))";
  return (
    <div className="draft-catalog-grid">
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

export default function DraftOrderUtilityPage({
  roleLabel = "Workspace",
  title = "Draft Order",
  subtitle = "Select product quantities to calculate a draft total. This utility does not submit an order.",
  enableOfficeExport = false,
}) {
  const productsQuery = useGetProductsQuery();
  const products = useMemo(
    () => (productsQuery.data || []).filter((item) => item?.isActive !== false),
    [productsQuery.data],
  );
  const loading = productsQuery.isLoading && products.length === 0;
  const refreshing = !loading && productsQuery.isFetching;
  const error = productsQuery.error
    ? getQueryErrorMessage(productsQuery.error, "Failed to load product catalog.")
    : "";

  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [draftOpen, setDraftOpen] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);
  const previousQtyRef = useRef(0);
  const productLineRefs = useRef(new Map());

  const categoryOptions = useMemo(() => buildCategoryOptions(products), [products]);
  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((product) => {
      const categoryOk = activeCategory === "ALL" || product.category === activeCategory;
      const queryOk = q
        ? [product.name, product.sku, product.code, product.category]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;
      return categoryOk && queryOk;
    });
  }, [activeCategory, products, search]);

  const productsMap = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
    }, {});
  }, [products]);

  const cart = useMemo(() => buildCart(productsMap, quantities), [productsMap, quantities]);
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);

  // Detecting an increase requires comparing against the previous render's
  // value, which a ref + effect is the correct tool for (not derivable from
  // props/state alone during render) - mirrors DealerCatalogPage.jsx's
  // identical badge-bump effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const qty = Number(totals.totalQty || 0);
    if (qty > previousQtyRef.current) setBadgeBump(true);
    previousQtyRef.current = qty;
  }, [totals.totalQty]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cartBySku = useMemo(() => {
    return cart.reduce((acc, line) => {
      acc[line.sku] = line;
      return acc;
    }, {});
  }, [cart]);

  const families = useMemo(() => groupProductsByCode(filteredProducts), [filteredProducts]);

  const familyGroups = useMemo(() => {
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

  const currency = cart[0]?.currency || products[0]?.currency || "NPR";

  function handleQtyChange(sku, nextValue) {
    setQuantities((prev) => {
      const next = { ...prev, [sku]: nextValue };
      if (!Number(nextValue || 0)) delete next[sku];
      return next;
    });
  }

  function setProductLineRef(sku, node) {
    if (!sku) return;
    if (node) {
      productLineRefs.current.set(sku, node);
    } else {
      productLineRefs.current.delete(sku);
    }
  }

  function handleScrollToLine(line) {
    const product = productsMap[line.sku];

    if (product && activeCategory !== "ALL" && product.category !== activeCategory) {
      setCategory("ALL");
    }

    if (search.trim()) {
      setSearch("");
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const node = productLineRefs.current.get(line.sku);
        if (!node) return;

        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        node.classList.remove("draft-line-focus");
        node.getBoundingClientRect();
        node.classList.add("draft-line-focus");
      });
    });
  }

  function handleExportDraftPdf() {
    downloadDraftOrderPdf({ cart, totals, currency, roleLabel, search, category: activeCategory });
  }

  return (
    <div
      className="draft-catalog-shell"
      style={{
        marginRight: draftOpen ? 340 : 0,
        transition: "margin-right 300ms cubic-bezier(.23,1,.32,1)",
      }}
    >
      <Surface padding={16} className="dash-fade-up">
        <SectionHeader
          icon="invoice"
          title={title}
          subtitle={subtitle}
          action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 340, flex: "1 1 240px" }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search by name, SKU, code, category…" />
          </div>
          <Dropdown value={activeCategory} options={categoryOptions} onChange={setCategory} style={{ width: 190 }} />
        </div>

        {error ? (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <LoadingGrid />
      ) : familyGroups.length === 0 ? (
        <EmptyState icon="search" title="No products found" subtitle="Try clearing the search or selecting a broader category." />
      ) : (
        <div style={{ marginTop: 24, display: "grid", gap: 40 }}>
          {familyGroups.map((group) => (
            <div key={group.key || "uncategorized"}>
              <div className="draft-category-heading">
                <span>{group.label}</span>
                <span className="draft-category-count">{group.items.length}</span>
              </div>
              <CatalogCarouselRow>
                {group.items.map((family) => (
                  <ProductFamilyCard
                    key={family.code}
                    family={family}
                    quantities={quantities}
                    cartBySku={cartBySku}
                    onQtyChange={handleQtyChange}
                    setLineRef={setProductLineRef}
                  />
                ))}
              </CatalogCarouselRow>
            </div>
          ))}
        </div>
      )}

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                onClick={() => setDraftOpen((open) => !open)}
                aria-pressed={draftOpen}
                aria-label={`${draftOpen ? "Close" : "Open"} draft order, ${totals.totalQty} item${totals.totalQty === 1 ? "" : "s"}`}
                className="draft-cart-badge"
              >
                <BagIcon size={17} />
                {totals.totalQty > 0 ? (
                  <span
                    className={`draft-cart-sticker ${badgeBump ? "is-bumping" : ""}`}
                    onAnimationEnd={() => setBadgeBump(false)}
                  >
                    {totals.totalQty}
                  </span>
                ) : null}
              </button>

              <div className={`draft-panel ${draftOpen ? "is-open" : ""}`} aria-hidden={!draftOpen}>
                <DraftRail
                  cart={cart}
                  totals={totals}
                  currency={currency}
                  onClear={() => setQuantities({})}
                  onExport={handleExportDraftPdf}
                  onQtyChange={handleQtyChange}
                  onLineSelect={handleScrollToLine}
                  enableExport={enableOfficeExport}
                  onClose={() => setDraftOpen(false)}
                />
              </div>
            </>,
            document.body,
          )
        : null}

      <DashboardUIStyles />
      <style>{`
        .draft-catalog-shell{
          min-width:0;
        }

        .draft-catalog-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(min(100%, 288px), 1fr));
          gap:20px;
        }

        .draft-category-heading{
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

        .draft-category-count{
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

        .draft-product-card{
          display:flex;
          flex-direction:column;
          transition:transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s ease, border-color .22s ease;
        }

        .draft-product-card:hover{
          transform:translateY(-3px);
          box-shadow:0 16px 32px rgba(15,23,42,.1);
        }

        .draft-product-card.selected{
          border-color:rgba(0,113,227,.28)!important;
        }

        .draft-product-media{
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

        .draft-product-media img{
          position:absolute;
          inset:18px;
          width:calc(100% - 36px);
          height:calc(100% - 36px);
          object-fit:contain;
          mix-blend-mode:multiply;
        }

        .draft-product-pack-badge{
          position:absolute;
          left:12px;
          bottom:12px;
          padding:5px 11px;
          border-radius:999px;
          background:rgba(255,255,255,.92);
          color:var(--color-ink, #1d1d1f);
          font-size:12px;
          font-weight:700;
          letter-spacing:-.01em;
          box-shadow:0 1px 2px rgba(15,23,42,.06);
        }

        .draft-product-badge{
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

        .draft-product-body{
          display:grid;
          gap:10px;
          padding:18px 18px 20px;
        }

        .draft-product-meta{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--color-graphite, #707070);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
        }

        .draft-product-name{
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

        .draft-variant-list{
          display:grid;
          gap:6px;
          margin-top:4px;
        }

        .draft-variant-row{
          display:grid;
          grid-template-columns:22px minmax(0,1fr) auto;
          align-items:center;
          gap:8px;
          padding:8px 9px;
          border-radius:14px;
          background:var(--color-fog, #f5f5f7);
          transition:background .16s ease;
        }

        .draft-variant-row.selected{
          background:rgba(0,113,227,.08);
        }

        .draft-variant-row.draft-line-focus{
          animation:draftLineFocus 1.15s ease;
        }

        .draft-variant-icon{
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:var(--color-graphite, #707070);
          background:rgba(255,255,255,.7);
        }

        .draft-variant-row.selected .draft-variant-icon{
          color:var(--color-azure, #0071e3);
          background:#fff;
        }

        .draft-variant-copy{
          min-width:0;
        }

        .draft-variant-pack{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          white-space:nowrap;
        }

        .draft-variant-tier{
          padding:1px 6px;
          border-radius:999px;
          background:rgba(0,113,227,.12);
          color:var(--color-azure, #0071e3);
          font-size:9.5px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.02em;
        }

        .draft-variant-price{
          margin-top:1px;
          font-size:10.5px;
          color:var(--color-graphite, #707070);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .draft-variant-price strong{
          color:var(--color-azure, #0071e3);
          font-weight:800;
        }

        .draft-qty-stepper{
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(29,29,31,.08);
          overflow:hidden;
        }

        .draft-qty-stepper.selected{
          border-color:rgba(0,113,227,.22);
        }

        .draft-qty-btn{
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

        .draft-qty-btn:hover{
          background:rgba(29,29,31,.06);
        }

        .draft-qty-btn:active{
          transform:scale(.88);
        }

        .draft-qty-input{
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

        .draft-qty-input::-webkit-inner-spin-button,
        .draft-qty-input::-webkit-outer-spin-button{
          -webkit-appearance:none;
          margin:0;
        }

        /* Fixed to the viewport - stays in place while the page scrolls
           behind it, and the panel visually opens from this same anchor
           point (shared transform-origin: top right). Mirrors
           DealerCatalogPage.jsx's .dealer-draft-panel/.dealer-catalog-cart-badge
           exactly, renamed for this shared Admin/Dispatcher tool. Unlike the
           dealer version, this stays available at every viewport width -
           there's no separate mobile page for this internal quoting tool to
           fall back to, so the panel narrows to fit instead of disappearing. */
        .draft-cart-badge{
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
          transition:background 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms var(--ease-out, ease);
        }

        .draft-cart-badge:hover{
          background:var(--color-fog, #f5f5f7);
        }

        .draft-cart-badge:active{
          transform:scale(.94);
        }

        .draft-cart-badge[aria-pressed="true"]{
          border-color:rgba(0,113,227,.35);
          color:var(--color-azure, #0071e3);
          background:rgba(0,113,227,.06);
        }

        .draft-cart-sticker{
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

        .draft-cart-sticker.is-bumping{
          animation:draftCartStickerBump 320ms cubic-bezier(.34,1.56,.64,1);
        }

        @keyframes draftCartStickerBump{
          0%{ transform:scale(1); }
          40%{ transform:scale(1.45); }
          100%{ transform:scale(1); }
        }

        .draft-panel{
          position:fixed;
          top:104px;
          right:40px;
          width:min(320px, calc(100vw - 24px));
          max-height:calc(100vh - 140px);
          z-index:499;
          overflow:hidden;
          opacity:0;
          transform:scale(.95) translateY(-6px);
          transform-origin:top right;
          pointer-events:none;
          transition:opacity 160ms ease, transform 180ms cubic-bezier(.23,1,.32,1);
        }

        .draft-panel.is-open{
          opacity:1;
          transform:scale(1) translateY(0);
          pointer-events:auto;
          transition:opacity 240ms ease 60ms, transform 280ms cubic-bezier(.23,1,.32,1) 60ms;
        }

        .draft-panel-close-btn{
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
          transition:background 140ms ease;
        }

        .draft-panel-close-btn:hover{
          background:rgba(29,29,31,.1);
        }

        .draft-lines-list::-webkit-scrollbar{
          width:6px;
        }
        .draft-lines-list::-webkit-scrollbar-thumb{
          border-radius:999px;
          background:rgba(15,23,42,.16);
        }

        @keyframes draftLineFocus{
          0%{
            box-shadow:0 0 0 0 rgba(0,113,227,.28);
            background:rgba(0,113,227,.16);
          }
          100%{
            box-shadow:0 0 0 12px rgba(0,113,227,0);
          }
        }

        @media (max-width:640px){
          /* The mobile dashboard shell's own bottom tab bar (height 64px,
             z-index 1500 - see .dealer-m-tabbar in DealerMobileStyles.core.jsx,
             reused for the admin mobile shell too) sits well above this
             component's z-index, so the badge must clear it entirely rather
             than just avoid overlapping visually - otherwise the tab bar
             intercepts every tap meant for the badge underneath it. */
          .draft-cart-badge{
            top:auto;
            bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 16px);
            right:16px;
          }
          .draft-panel{
            top:auto;
            bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 72px);
            right:16px;
            transform-origin:bottom right;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .draft-product-card,
          .draft-qty-btn,
          .draft-cart-badge,
          .draft-cart-sticker.is-bumping,
          .draft-panel,
          .draft-panel.is-open,
          .draft-panel-close-btn{
            transition:none!important;
            animation:none!important;
          }
        }
      `}</style>
    </div>
  );
}
