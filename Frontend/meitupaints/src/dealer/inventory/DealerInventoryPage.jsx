import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useGetDealerInventoryQuery, useGetDealerInventoryHistoryQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  Dropdown,
  EmptyState,
  GhostButton,
  Pill,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../utils/scrollResultsToTop.js";
import { AppleDateField, AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { useIsMobileDealer } from "../mobile/useIsMobileDealer.js";
import { DealerInventoryMobileView } from "../mobile/DealerInventoryMobileView.jsx";
import {
  categoryLabel,
  formatDayHeading,
  formatMoney,
  formatTimeOnly,
  getPrimaryImage,
  localDayKey,
  movementDelta,
  movementLabel,
  movementReference,
  statusLabel,
  statusTone,
  timeAgo,
} from "./inventoryHelpers.js";

const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 20;

const HISTORY_TYPE_OPTIONS = [
  { key: "ALL", label: "All Transactions" },
  { key: "PURCHASE", label: "Purchases" },
  { key: "SCHEME", label: "Scheme goods" },
  { key: "SALE", label: "Sales" },
];

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
  { key: "value-desc", label: "Highest value" },
  { key: "recent", label: "Recently moved" },
];

// Category pills are derived from whatever categories are actually present
// in this dealer's own inventory (not a fixed taxonomy), same convention as
// the catalog page's category filter.
function buildCategoryOptions(items) {
  const map = new Map();
  for (const item of items) {
    const value = String(item?.category || "").trim();
    if (value && !map.has(value)) map.set(value, categoryLabel(value));
  }
  return [
    { key: "ALL", label: "All" },
    ...Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function InventoryProductCard({ item, onSelect }) {
  const image = getPrimaryImage(item.images);
  return (
    <Surface padding={0} style={{ overflow: "hidden" }} className="dealer-inv-card">
      <button
        type="button"
        onClick={() => onSelect(item)}
        style={{ textAlign: "left", border: "none", padding: 0, cursor: "pointer", background: "transparent", width: "100%", display: "block" }}
      >
        <div className="dealer-inv-card-media">
          {image?.url ? (
            <img src={image.url} alt={item.name} loading="lazy" />
          ) : (
            <DashboardIcon name="package" size={34} strokeWidth={1.3} style={{ color: "rgba(0,0,0,.2)" }} />
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSelect(item);
              }
            }}
            aria-label={`Manage ${item.name}`}
            className="dealer-inv-card-menu"
          >
            <DashboardIcon name="moreHorizontal" size={15} strokeWidth={1.8} />
          </span>
        </div>
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
          <div style={{ marginTop: 2, fontSize: 12, color: "var(--color-graphite, #707070)" }}>{item.pack?.label || categoryLabel(item.category) || "Product"}</div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            {/* Status (dot + word) leads, quantity trails as secondary detail -
                mobile spec: "surface stock as a colored dot + word, never a
                bare number first." */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: statusTone(item.status) === "critical" ? "#b42318" : statusTone(item.status) === "caution" ? "var(--color-caution, #b64400)" : "#15803d" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
              {statusLabel(item.status)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{item.currentQuantity} Units</span>
          </div>
        </div>
      </button>
    </Surface>
  );
}

function CategorySectionHeading({ label, count }) {
  return (
    <div className="dealer-inv-category-heading">
      <span>{label}</span>
      <span className="dealer-inv-category-count">{count}</span>
    </div>
  );
}

function InventoryStatCard({ icon, label, value, tone = "neutral" }) {
  return (
    <div className="dealer-inv-stat">
      <span className={`dealer-inv-stat-icon dealer-inv-stat-icon--${tone}`}>
        <DashboardIcon name={icon} size={18} strokeWidth={1.8} />
      </span>
      <div>
        <div className="dealer-inv-stat-label">{label}</div>
        <div className="dealer-inv-stat-value">{value}</div>
      </div>
    </div>
  );
}

const SECTION_TABS = [
  { key: "inventory", label: "Inventory" },
  { key: "history", label: "History" },
];

// Same underline-tab treatment as the Dealer Orders page's status tabs
// (.dealer-order-tab), reused here to switch between the on-hand Inventory
// view and the stock-movement History view.
function InventorySectionTabs({ value, onChange }) {
  return (
    <div className="dealer-inv-section-tabs" role="tablist">
      {SECTION_TABS.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dealer-inv-section-tab ${active ? "is-active" : ""}`}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function HistoryMovementDirectionIcon({ delta }) {
  const isIn = delta >= 0;
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isIn ? "rgba(22,163,74,.1)" : "rgba(180,35,24,.1)",
        color: isIn ? "#15803d" : "#b42318",
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {isIn ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
      </svg>
    </span>
  );
}

// Dealer-wide counterpart to DealerInventoryDetailPage's per-product
// MovementsTable - every order/sale that moved stock across this dealer's
// whole catalog, newest first, with a Product column since rows now span
// many products instead of just one.
function InventoryHistoryTable({ query, page, totalPages, onPageChange }) {
  const items = useMemo(() => query.data?.items || [], [query.data]);
  const totalCount = Number(query.data?.pagination?.total || 0);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * HISTORY_PAGE_SIZE);
  const loadError = query.error ? getQueryErrorMessage(query.error, "Failed to load stock history.") : "";

  // Rows already arrive newest-first from the API, so grouping preserves
  // that order - each bucket just collects consecutive same-day rows, same
  // convention as the factory stock history page.
  const dayGroups = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    for (const movement of items) {
      const key = localDayKey(movement.createdAt);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: formatDayHeading(movement.createdAt), rows: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.rows.push(movement);
    }
    return groups;
  }, [items]);

  if (query.isLoading && !query.data) {
    return (
      <Surface padding={18}>
        <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
      </Surface>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
        {loadError}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon="history" title="No stock movements found" subtitle="Orders and sales that change your stock will show up here." />;
  }

  return (
    <>
      <Surface padding={0} className="dash-fade-up">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
                {["Time", "Product", "Type", "Reference", "Quantity", "Balance"].map((head, index) => (
                  <th
                    key={head}
                    style={{
                      textAlign: index >= 4 ? "right" : "left",
                      padding: "10px 16px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-graphite, #707070)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayGroups.flatMap((group) => [
                <tr key={`day-${group.key}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                  <td colSpan={6} style={{ padding: "9px 16px", background: "rgba(0,0,0,.02)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>{group.label}</span>
                      <Pill size="small">{group.rows.length}</Pill>
                    </div>
                  </td>
                </tr>,
                ...group.rows.map((movement) => {
                  const delta = movementDelta(movement);
                  const product = movement.productId;
                  const image = getPrimaryImage(product?.images);
                  return (
                    <tr key={movement._id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                      <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)", whiteSpace: "nowrap" }}>
                        {formatTimeOnly(movement.createdAt)}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--color-fog, #f5f5f7)", overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            {image?.url ? (
                              <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <DashboardIcon name="package" size={13} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
                            )}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
                            {product?.name || "—"}
                            {product?.pack?.label ? (
                              <span style={{ marginLeft: 6, fontWeight: 700, color: "var(--color-graphite, #707070)" }}>
                                {product.pack.label}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <HistoryMovementDirectionIcon delta={delta} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
                            {movementLabel(movement.type)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{movementReference(movement)}</td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          fontSize: 13,
                          fontWeight: 700,
                          color: delta >= 0 ? "#15803d" : "#b42318",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {delta >= 0 ? "+" : ""}
                        {delta}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{movement.newQuantity}</td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      </Surface>

      {totalPages > 1 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Showing {rangeStart}-{rangeEnd} of {totalCount} movements
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GhostButton onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
              Previous
            </GhostButton>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Page {page} of {totalPages}
            </span>
            <GhostButton onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              Next
            </GhostButton>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function DealerInventoryPage() {
  const isMobile = useIsMobileDealer();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [category, setCategory] = useState("ALL");
  const [view, setView] = useState("card");
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const navigate = useNavigate();

  const [section, setSection] = useState("inventory");
  const [historyDraftQuery, setHistoryDraftQuery] = useState("");
  const [historyQueryText, setHistoryQueryText] = useState("");
  const [historyType, setHistoryType] = useState("ALL");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historySort, setHistorySort] = useState("desc");
  const [historyPage, setHistoryPage] = useState(1);

  const inventoryQuery = useGetDealerInventoryQuery(
    {
      q: query,
      status,
      sort,
      limit: 200,
    },
    { skip: isMobile },
  );

  const historyQuery = useGetDealerInventoryHistoryQuery(
    {
      q: historyQueryText,
      type: historyType,
      from: historyDateFrom || undefined,
      to: historyDateTo || undefined,
      sort: historySort,
      page: historyPage,
      limit: HISTORY_PAGE_SIZE,
    },
    { skip: isMobile || section !== "history" },
  );
  const historyTotalPages = Math.max(1, Number(historyQuery.data?.pagination?.pages || 1));

  function submitHistorySearch() {
    setHistoryPage(1);
    setHistoryQueryText(historyDraftQuery.trim());
  }

  function changeHistoryType(next) {
    setHistoryPage(1);
    setHistoryType(next);
  }

  function toggleHistorySortOrder() {
    setHistoryPage(1);
    setHistorySort((current) => (current === "asc" ? "desc" : "asc"));
  }

  const allItems = useMemo(() => inventoryQuery.data?.items || [], [inventoryQuery.data]);
  const summary = inventoryQuery.data?.summary || { totalValue: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 };

  const categoryOptions = useMemo(() => buildCategoryOptions(allItems), [allItems]);
  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";

  const items = useMemo(
    () => (activeCategory === "ALL" ? allItems : allItems.filter((item) => item.category === activeCategory)),
    [allItems, activeCategory],
  );
  const visibleItems = items.slice(0, visibleCount);

  function groupByCategory(list) {
    const map = new Map();
    for (const item of list) {
      const key = item.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return Array.from(map.entries())
      .map(([key, groupItems]) => ({ key, label: categoryLabel(key) || "Uncategorized", items: groupItems }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const groupedVisibleItems = useMemo(() => groupByCategory(visibleItems), [visibleItems]);
  const groupedItems = useMemo(() => groupByCategory(items), [items]);

  const loadError = inventoryQuery.error
    ? getQueryErrorMessage(inventoryQuery.error, "Failed to load your inventory.")
    : "";

  function changeCategory(nextCategory) {
    setCategory(nextCategory);
    setVisibleCount(PAGE_SIZE);
  }

  function submitSearch() {
    setQuery(draftQuery.trim());
    setVisibleCount(PAGE_SIZE);
  }

  function openProduct(item) {
    navigate(`/dealer/inventory/${item.productId}`);
  }

  if (isMobile) {
    return <DealerInventoryMobileView />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16} className="dash-fade-up dealer-inv-toolbar">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <SectionHeader
            icon="stock"
            title="Inventory"
            size="large"
            subtitle="All products and available stock"
            action={inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 240 }}>
              <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={submitSearch} placeholder="Search products…" />
            </div>
            <GhostButton icon="filter" onClick={() => setFilterOpen((open) => !open)}>Filter</GhostButton>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>

        {filterOpen ? (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Dropdown value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: 160 }} />
            <Dropdown value={sort} options={SORT_OPTIONS} onChange={setSort} style={{ width: 170 }} />
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <InventoryStatCard icon="package" label="Total Products" value={summary.totalProducts.toLocaleString()} />
          <InventoryStatCard icon="stock" label="Total Stock" value={<>{summary.totalUnits.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Units</span></>} />
          <InventoryStatCard icon="invoice" label="Inventory Value" value={formatMoney(summary.totalValue)} tone="accent" />
        </div>

        <div className="dealer-inv-category-filter" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 600 }}>Category</span>
          <AppleDropdown
            value={activeCategory}
            options={categoryOptions}
            onChange={changeCategory}
            placeholder="All"
            icon="filter"
            style={{ width: 220 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <InventorySectionTabs value={section} onChange={setSection} />
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {section === "history" ? (
        <>
          <Surface padding={16} className="dash-fade-up">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 240 }}>
                <SearchField
                  value={historyDraftQuery}
                  onChange={setHistoryDraftQuery}
                  onSubmit={submitHistorySearch}
                  placeholder="Search product, order, sale…"
                />
              </div>
              <Dropdown value={historyType} options={HISTORY_TYPE_OPTIONS} onChange={changeHistoryType} style={{ width: 180 }} />
              <AppleDateField value={historyDateFrom} onChange={(value) => { setHistoryPage(1); setHistoryDateFrom(value); }} />
              <AppleDateField value={historyDateTo} onChange={(value) => { setHistoryPage(1); setHistoryDateTo(value); }} />
              <GhostButton onClick={toggleHistorySortOrder}>
                <span
                  style={{
                    display: "inline-flex",
                    transform: historySort === "asc" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform .22s var(--ease-out, ease)",
                  }}
                >
                  <DashboardIcon name="sort" size={14} />
                </span>
                {historySort === "asc" ? "Oldest First" : "Newest First"}
              </GhostButton>
              {historyQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
            </div>
          </Surface>
          <InventoryHistoryTable
            query={historyQuery}
            page={historyPage}
            totalPages={historyTotalPages}
            onPageChange={(next) => {
              setHistoryPage(next);
              scrollResultsToTop();
            }}
          />
        </>
      ) : inventoryQuery.isLoading && !inventoryQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="stock" title="No inventory yet" subtitle="Once your delivered orders arrive, they'll show up here automatically." />
      ) : view === "card" ? (
        <>
          <div style={{ display: "grid", gap: 32 }} className="dash-fade-up">
            {groupedVisibleItems.map((group) => (
              <div key={group.key || "uncategorized"}>
                <CategorySectionHeading label={group.label} count={group.items.length} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                  {group.items.map((item) => (
                    <InventoryProductCard key={item.productId} item={item} onSelect={openProduct} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {visibleCount < items.length ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
              <GhostButton onClick={() => setVisibleCount(items.length)}>Show more</GhostButton>
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ display: "grid", gap: 24 }} className="dash-fade-up">
          {groupedItems.map((group) => (
            <div key={group.key || "uncategorized"}>
              <CategorySectionHeading label={group.label} count={group.items.length} />
              <Surface padding={0}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 110px 110px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                  <span>Product</span>
                  <span style={{ textAlign: "right" }}>On hand</span>
                  <span style={{ textAlign: "right" }}>Value</span>
                  <span>Status</span>
                  <span>Last moved</span>
                </div>
                {group.items.map((item) => {
                  const image = getPrimaryImage(item.images);
                  return (
                    <div
                      key={item.productId}
                      role="button"
                      tabIndex={0}
                      onClick={() => openProduct(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openProduct(item);
                        }
                      }}
                      className="dash-list-row dash-selectable-row"
                      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 110px 110px", gap: 12, alignItems: "center", padding: "10px 16px", cursor: "pointer" }}
                    >
                      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--color-fog, #f5f5f7)", overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {image?.url ? (
                            <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <DashboardIcon name="package" size={14} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "—"}</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{categoryLabel(item.category) || "Uncategorized"}</div>
                        </div>
                      </div>
                      <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{item.currentQuantity}</span>
                      <span style={{ textAlign: "right", fontSize: 13 }}>{item.inventoryValue ? formatMoney(item.inventoryValue) : "—"}</span>
                      <span><Pill tone={statusTone(item.status)} size="small">{statusLabel(item.status)}</Pill></span>
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{timeAgo(item.lastMovementAt)}</span>
                    </div>
                  );
                })}
              </Surface>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .dealer-inv-category-heading{
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:14px;
          padding-bottom:10px;
          border-bottom:1px solid rgba(29,29,31,.08);
          font-size:13px;
          font-weight:800;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-ink, #1d1d1f);
        }

        .dealer-inv-category-count{
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

        .dealer-inv-category-filter .apple-dropdown-menu-trigger{
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          border:1px solid rgba(255,255,255,.08);
          box-shadow:none;
        }

        .dealer-inv-category-filter .apple-dropdown-menu-trigger:hover{
          background:#000;
        }

        .dealer-inv-category-filter .apple-dropdown-menu-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.42);
          outline-offset:3px;
        }

        .dealer-inv-toolbar .dash-section-heading{
          gap:8px;
        }

        .dealer-inv-toolbar .dash-section-title{
          font-size:24px!important;
          line-height:1.12!important;
        }

        .dealer-inv-toolbar .dash-section-subtitle{
          margin-top:2px!important;
          font-size:12.5px!important;
          line-height:1.35!important;
        }

        .dealer-inv-stat{
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
        }
        .dealer-inv-stat-icon{
          width:34px;
          height:34px;
          border-radius:10px;
          display:grid;
          place-items:center;
          flex-shrink:0;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
        }
        .dealer-inv-stat-icon--accent{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .dealer-inv-stat-label{
          font-size:11.5px;
          font-weight:600;
          color:var(--color-graphite, #707070);
        }
        .dealer-inv-stat-value{
          margin-top:1px;
          font-size:17px;
          font-weight:800;
          letter-spacing:-.02em;
          color:var(--color-ink, #1d1d1f);
        }

        .dealer-inv-card{
          transition:transform .2s cubic-bezier(.2,.7,.3,1), box-shadow .2s ease, border-color .2s ease;
        }
        .dealer-inv-card:hover{
          transform:translateY(-2px);
          box-shadow:0 12px 28px rgba(15,23,42,.08);
        }
        .dealer-inv-card-media{
          position:relative;
          height:150px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          border-bottom:1px solid rgba(29,29,31,.06);
        }
        .dealer-inv-card-media img{
          position:absolute;
          inset:16px;
          width:calc(100% - 32px);
          height:calc(100% - 32px);
          object-fit:contain;
          mix-blend-mode:multiply;
        }
        .dealer-inv-card-menu{
          position:absolute;
          top:10px;
          right:10px;
          width:26px;
          height:26px;
          border-radius:8px;
          background:rgba(255,255,255,.9);
          color:var(--color-graphite, #707070);
          display:grid;
          place-items:center;
          cursor:pointer;
        }
        .dealer-inv-card-menu:hover{
          background:#fff;
          color:var(--color-ink, #1d1d1f);
        }

        .dealer-inv-section-tabs{ display:flex; align-items:center; gap:24px; border-bottom:1px solid rgba(29,29,31,.1); overflow-x:auto; scrollbar-width:none; }
        .dealer-inv-section-tabs::-webkit-scrollbar{ display:none; }
        .dealer-inv-section-tab{ min-width:max-content; display:flex; align-items:center; gap:10px; padding:10px 4px 13px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; white-space:nowrap; }
        .dealer-inv-section-tab span{ font-size:13.5px; font-weight:650; color:var(--color-graphite, #707070); }
        .dealer-inv-section-tab.is-active{ border-bottom-color:var(--color-azure, #0071e3); }
        .dealer-inv-section-tab.is-active span{ color:var(--color-azure, #0071e3); font-weight:700; }
      `}</style>
    </div>
  );
}
