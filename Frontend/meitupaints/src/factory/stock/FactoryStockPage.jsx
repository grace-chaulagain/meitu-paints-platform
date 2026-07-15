import { useMemo, useState } from "react";
import { useGetStockQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import {
  EmptyState,
  GhostButton,
  Pill,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { stockImageUrl, stockStatusTone, timeAgo, titleCaseLabel } from "../factoryHelpers.js";
import FactoryStockEditModal from "./FactoryStockEditModal.jsx";
import FactoryBulkImportModal from "./FactoryBulkImportModal.jsx";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All stock" },
  { key: "IN_STOCK", label: "In stock" },
  { key: "LOW_STOCK", label: "Low stock" },
  { key: "OUT_OF_STOCK", label: "Out of stock" },
];

const SORT_OPTIONS = [
  { key: "name", label: "Sort by name" },
  { key: "stock-asc", label: "Lowest stock" },
  { key: "stock-desc", label: "Highest stock" },
  { key: "updated", label: "Recently updated" },
];

// Deterministic per-category color (not per-item) so every product within
// the same category reads as the same color across the grid, mirroring
// AdminDealersPage's avatar palette but keyed by category instead of by
// individual dealer.
const CATEGORY_PALETTE = [
  { bg: "rgba(0,113,227,.12)", fg: "#0071e3" },
  { bg: "rgba(220,38,38,.12)", fg: "#dc2626" },
  { bg: "rgba(124,58,237,.12)", fg: "#7c3aed" },
  { bg: "rgba(234,88,12,.12)", fg: "#ea580c" },
  { bg: "rgba(22,163,74,.12)", fg: "#16a34a" },
  { bg: "rgba(219,39,119,.12)", fg: "#db2777" },
  { bg: "rgba(13,148,136,.12)", fg: "#0d9488" },
  { bg: "rgba(75,85,99,.12)", fg: "#4b5563" },
];

function hashString(value) {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function categoryPalette(category) {
  const key = category || "uncategorized";
  return CATEGORY_PALETTE[hashString(key) % CATEGORY_PALETTE.length];
}

function FactoryStockGridCard({ item, onAdjust }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const palette = categoryPalette(item.category);
  const imageUrl = stockImageUrl(item);

  return (
    <article className="factory-stock-grid-card" onClick={() => onAdjust(item)}>
      <div className="factory-stock-grid-card-top">
        <div className="factory-stock-grid-avatar" style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}>
          {imageUrl ? (
            <img src={imageUrl} alt={item.name || item.sku} loading="lazy" />
          ) : (
            String(item.name || "M").slice(0, 1).toUpperCase()
          )}
        </div>

        <div className="factory-stock-grid-menu-wrap" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="factory-stock-grid-menu-btn"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <DashboardIcon name="moreHorizontal" size={16} strokeWidth={2} />
          </button>
          {menuOpen ? (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div className="factory-stock-grid-menu dash-modal-surface-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onAdjust(item);
                  }}
                >
                  Adjust stock
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="factory-stock-grid-copy">
        <h3>{item.name}</h3>
        <div className="factory-stock-grid-location">
          <span className="factory-stock-grid-dot" style={{ "--dot-color": palette.fg }} aria-hidden="true" />
          {item.category ? titleCaseLabel(item.category) : "Uncategorized"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: "var(--color-azure, #0071e3)" }}>{item.stock?.availableQuantity || 0}</span>
          <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>available</span>
        </div>
        <Pill tone={stockStatusTone(item.stock?.status)} size="small">{titleCaseLabel(item.stock?.status)}</Pill>
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
        {item.packLabel || item.pack?.label || "Variant"} · {item.stock?.currentQuantity || 0} current · {item.stock?.reservedQuantity || 0} reserved
      </div>

      <div className="factory-stock-grid-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="factory-stock-grid-action-btn"
          onClick={() => onAdjust(item)}
          aria-label="Adjust stock"
          title="Adjust stock"
        >
          <DashboardIcon name="edit" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </article>
  );
}

export default function FactoryStockPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [family, setFamily] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("card");
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const stockQuery = useGetStockQuery({
    q: query,
    category: category === "ALL" ? "" : category,
    code: family === "ALL" ? "" : family,
    status,
    limit: 200,
  });
  // The catalog can exceed the API's per-request cap of 200, so this list
  // (used to build category/family filters and the bulk-import SKU lookup)
  // is assembled from two pages - generous headroom over the current
  // catalog size without needing open-ended pagination.
  const allStockPage1 = useGetStockQuery({ limit: 200, page: 1 });
  const allStockPage2 = useGetStockQuery({ limit: 200, page: 2 });
  const allItems = useMemo(
    () => [...(allStockPage1.data?.items || []), ...(allStockPage2.data?.items || [])],
    [allStockPage1.data, allStockPage2.data],
  );
  const categories = useMemo(() => [...new Set(allItems.map((item) => item.category).filter(Boolean))].sort(), [allItems]);
  const families = useMemo(() => [...new Set(allItems.map((item) => item.code).filter(Boolean))].sort(), [allItems]);

  const items = useMemo(() => {
    return [...(stockQuery.data?.items || [])].sort((a, b) => {
      if (sort === "stock-asc") return Number(a.stock?.availableQuantity || 0) - Number(b.stock?.availableQuantity || 0);
      if (sort === "stock-desc") return Number(b.stock?.availableQuantity || 0) - Number(a.stock?.availableQuantity || 0);
      if (sort === "updated") return new Date(b.stock?.lastUpdatedAt || 0) - new Date(a.stock?.lastUpdatedAt || 0);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [stockQuery.data, sort]);

  // Groups the already-filtered/sorted list by category so the grid/list
  // reads as sections instead of one undifferentiated wall of products.
  // Skipped visually once a single category is already selected via the
  // filter above, since a lone group heading for the whole page would just
  // repeat what the dropdown already says.
  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of items) {
      const key = item.category || "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((key) => ({
      key,
      label: key === "Uncategorized" ? key : titleCaseLabel(key),
      items: groups.get(key),
    }));
  }, [items]);
  const showGroupHeadings = category === "ALL" && groupedItems.length > 1;

  const categoryOptions = [{ key: "ALL", label: "All categories" }, ...categories.map((item) => ({ key: item, label: titleCaseLabel(item) }))];
  const familyOptions = [{ key: "ALL", label: "All families" }, ...families.map((item) => ({ key: item, label: item }))];

  const loadError = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load the stock catalog.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="stock"
          title="Factory Stock Catalog"
          subtitle="Search products, review available stock, and update inventory safely."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {stockQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              <GhostButton icon="download" onClick={() => setImportOpen(true)}>Bulk Import</GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
            <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={() => setQuery(draftQuery.trim())} placeholder="Search product, SKU, category…" />
          </div>
          <AppleDropdown value={category} options={categoryOptions} onChange={setCategory} style={{ width: 170 }} />
          <AppleDropdown value={family} options={familyOptions} onChange={setFamily} style={{ width: 170 }} />
          <AppleDropdown value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: 150 }} />
          <AppleDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} style={{ width: 160 }} />
          <ViewToggle value={view} onChange={setView} />
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {stockQuery.isLoading && !stockQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="stock" title="No stock rows found" />
      ) : view === "card" ? (
        <div style={{ display: "grid", gap: 24 }} className="dash-fade-up">
          {groupedItems.map((group) => (
            <div key={group.key} style={{ display: "grid", gap: 12 }}>
              {showGroupHeadings ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>
                    {group.label}
                  </span>
                  <Pill size="small">{group.items.length}</Pill>
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {group.items.map((item) => (
                  <FactoryStockGridCard key={item._id || item.sku} item={item} onAdjust={setSelected} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Surface padding={0} className="dash-fade-up">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 90px 90px 100px 110px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
            <span>Product</span>
            <span>Size</span>
            <span style={{ textAlign: "right" }}>Current</span>
            <span style={{ textAlign: "right" }}>Reserved</span>
            <span style={{ textAlign: "right" }}>Available</span>
            <span>Status</span>
            <span>Updated</span>
          </div>
          {groupedItems.map((group) => (
            <div key={group.key}>
              {showGroupHeadings ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--color-fog, #f5f5f7)" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>{group.label}</span>
                  <Pill size="small">{group.items.length}</Pill>
                </div>
              ) : null}
              {group.items.map((item) => {
                const imageUrl = stockImageUrl(item);
                return (
                  <div
                    key={item._id || item.sku}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(item);
                      }
                    }}
                    className="dash-list-row dash-selectable-row"
                    style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 90px 90px 100px 110px", gap: 12, alignItems: "center", padding: "10px 16px", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--color-fog, #f5f5f7)", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.name || item.sku} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <strong style={{ fontSize: 12 }}>{String(item.name || "M").slice(0, 1)}</strong>
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "—"}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.category || "Uncategorized"}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>{item.packLabel || item.pack?.label || "—"}</span>
                    <span style={{ textAlign: "right", fontSize: 13 }}>{item.stock?.currentQuantity || 0}</span>
                    <span style={{ textAlign: "right", fontSize: 13 }}>{item.stock?.reservedQuantity || 0}</span>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{item.stock?.availableQuantity || 0}</span>
                    <span><Pill tone={stockStatusTone(item.stock?.status)} size="small">{titleCaseLabel(item.stock?.status)}</Pill></span>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                      {item.stock?.lastUpdatedAt ? timeAgo(item.stock.lastUpdatedAt) : "Not updated"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </Surface>
      )}

      <FactoryStockEditModal key={selected?._id || selected?.sku || "none"} product={selected} onClose={() => setSelected(null)} />
      <FactoryBulkImportModal open={importOpen} products={allItems} onClose={() => setImportOpen(false)} />

      <style>{`
        .factory-stock-grid-card{
          position:relative;
          display:flex;
          flex-direction:column;
          gap:10px;
          border-radius:20px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
          padding:16px;
          cursor:pointer;
          transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .factory-stock-grid-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.16);
          box-shadow:0 14px 30px rgba(0,0,0,.06);
        }
        .factory-stock-grid-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .factory-stock-grid-avatar{
          width:40px;
          height:40px;
          border-radius:11px;
          flex:0 0 40px;
          display:grid;
          place-items:center;
          overflow:hidden;
          color:var(--avatar-fg, var(--color-azure,#0071e3));
          background:var(--avatar-bg, rgba(0,113,227,.08));
          font-size:14px;
          font-weight:800;
          letter-spacing:-.01em;
        }
        .factory-stock-grid-avatar img{
          width:100%;
          height:100%;
          object-fit:cover;
        }
        .factory-stock-grid-menu-wrap{
          position:relative;
          flex:0 0 auto;
        }
        .factory-stock-grid-menu-btn{
          width:28px;
          height:28px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:transparent;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .factory-stock-grid-menu-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .factory-stock-grid-menu-btn:active{
          transform:scale(.9);
        }
        .factory-stock-grid-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:150px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .factory-stock-grid-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .factory-stock-grid-menu button:hover{
          background:rgba(0,113,227,.08);
        }
        .factory-stock-grid-copy{
          min-width:0;
        }
        .factory-stock-grid-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-size:14.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.01em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .factory-stock-grid-location{
          margin-top:4px;
          display:flex;
          align-items:center;
          gap:7px;
          color:var(--color-graphite,#707070);
          font-size:11.5px;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .factory-stock-grid-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--dot-color, var(--color-azure,#0071e3));
        }
        .factory-stock-grid-actions{
          margin-top:2px;
          padding-top:10px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .factory-stock-grid-action-btn{
          width:32px;
          height:32px;
          border:0;
          border-radius:10px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .factory-stock-grid-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .factory-stock-grid-action-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .factory-stock-grid-card,
          .factory-stock-grid-menu-btn,
          .factory-stock-grid-action-btn{
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}
