import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetMyDispatcherStockHistoryQuery, useGetMyDispatcherStockQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  categoryLabel,
  computeStatus,
  formatDayHeading,
  formatTimeOnly,
  getPrimaryImage,
  localDayKey,
  movementDelta,
  movementLabel,
  movementReference,
  statusLabel,
  statusTone,
} from "../dashboard/stock/dispatcherInventoryHelpers.js";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";

const SECTION_OPTIONS = [
  { key: "inventory", label: "Inventory" },
  { key: "history", label: "History" },
];

const PAGE_SIZE = 20;
const STOCK_TONE_COLOR = { critical: "#b42318", caution: "var(--color-caution, #b64400)", positive: "#15803d" };

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

// Mirrors src/dealer/mobile/MovementCardList.jsx's card-list shape, but that
// component hardcodes an import of dealer's OWN inventoryHelpers.js (dealer
// movement types PURCHASE/SALE/RETURN/ADJUSTMENT/TRANSFER_IN/TRANSFER_OUT),
// so it can't be reused as-is for dispatcher stock movements
// (REPLENISHMENT_IN/DISPATCH_OUT/ADJUSTMENT - see
// dispatcherInventoryHelpers.js). Always shows the product thumbnail (no
// showProduct=false mode) since every dispatcher stock movement is tied to
// a specific product.
function DispatcherMovementCardList({ items = [] }) {
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

  return (
    <div className="dealer-m-movement-list">
      {dayGroups.map((group) => (
        <div key={group.key} className="dealer-m-movement-day">
          <div className="dealer-m-movement-day-label">{group.label}</div>
          {group.rows.map((movement) => {
            const delta = movementDelta(movement);
            const isIn = delta >= 0;
            const product = movement.productId;
            const image = getPrimaryImage(product?.images);
            return (
              <div className="dealer-m-movement-card" key={movement._id}>
                <span className="dealer-m-movement-thumb">
                  {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={16} strokeWidth={1.6} />}
                </span>
                <span className="dealer-m-movement-body">
                  <span className="dealer-m-movement-title">{product?.name || movementLabel(movement.type)}</span>
                  <span className="dealer-m-movement-sub">
                    {formatTimeOnly(movement.createdAt)} &middot; {movementReference(movement)}
                  </span>
                </span>
                <span className="dealer-m-movement-right">
                  <span className={`dealer-m-movement-delta ${isIn ? "in" : "out"}`}>
                    {isIn ? "+" : ""}
                    {delta}
                  </span>
                  <span className="dealer-m-movement-balance">{movement.newQuantity}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Mirrors src/dealer/mobile/DealerInventoryMobileView.jsx's Inventory/
// History segmented layout. No per-item detail drill-down (dispatcher stock
// cards aren't links even on desktop - DispatcherStockPage.jsx's
// InventoryProductCard has no onClick either, since there's no per-product
// route to send it to).
export function DispatcherInventoryMobileView() {
  const navigate = useNavigate();
  const [section, setSection] = useState("inventory");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);

  const stockQuery = useGetMyDispatcherStockQuery({ limit: 200 });
  const historyQuery = useGetMyDispatcherStockHistoryQuery(
    { sort: "desc", page: historyPage, limit: PAGE_SIZE },
    { skip: section !== "history" },
  );

  const allItems = useMemo(() => stockQuery.data?.items || [], [stockQuery.data]);
  const categoryOptions = useMemo(() => buildCategoryOptions(allItems), [allItems]);
  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = activeCategory === "ALL" ? allItems : allItems.filter((item) => item.category === activeCategory);
    if (q) {
      list = list.filter((item) =>
        [item.name, item.sku, item.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allItems, activeCategory, search]);
  const visibleItems = items.slice(0, visibleCount);

  const historyPageItems = historyQuery.data?.items;
  const lastAppendedPageRef = useRef(0);

  useEffect(() => {
    function appendPage() {
      if (historyPage === 1) {
        setHistoryItems(historyPageItems);
      } else {
        setHistoryItems((prev) => [...prev, ...historyPageItems]);
      }
    }
    if (!historyPageItems) return;
    if (historyPage === lastAppendedPageRef.current) return;
    lastAppendedPageRef.current = historyPage;
    appendPage();
  }, [historyPageItems, historyPage]);

  const historyTotalPages = Math.max(1, Number(historyQuery.data?.pagination?.pages || 1));

  const loadError = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load your stock.") : "";
  const historyLoadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load stock history.") : "";
  const loading = stockQuery.isLoading && allItems.length === 0;

  function changeSection(next) {
    setSection(next);
  }

  function changeCategory(next) {
    setCategory(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="dealer-m-inventory">
      <MobilePushHeader title="Inventory" onBack={() => navigate("/dispatcher")} />

      <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={changeSection} />

      {section === "inventory" ? (
        <>
          <div className="dealer-m-catalog-search">
            <DashboardIcon name="search" size={16} strokeWidth={2} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" />
          </div>

          <div className="dealer-m-catalog-chips">
            {categoryOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`dealer-m-catalog-chip ${activeCategory === option.key ? "active" : ""}`}
                onClick={() => changeCategory(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <SkeletonSwap
            loading={loading}
            skeleton={
              <>
                <div className="dealer-m-skel" style={{ height: 88, marginTop: 16, borderRadius: 16 }} />
                <div className="dealer-m-skel" style={{ height: 88, marginTop: 12, borderRadius: 16 }} />
              </>
            }
          >
          {loadError ? (
            <div className="dealer-m-error-card">
              <div className="dealer-m-error-title">{loadError}</div>
              <button type="button" className="dealer-m-error-retry" onClick={() => stockQuery.refetch()}>
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="dealer-m-empty">
              <DashboardIcon name="stock" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
              <div className="dealer-m-empty-title">No stock yet</div>
            </div>
          ) : (
            <>
              <div className="dealer-m-inv-list">
                {visibleItems.map((item) => {
                  const image = getPrimaryImage(item.images);
                  const status = computeStatus(item);
                  const tone = statusTone(status);
                  return (
                    <div key={item.productId} className="dealer-m-inv-card">
                      <span className="dealer-m-inv-card-thumb">
                        {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={20} strokeWidth={1.6} />}
                      </span>
                      <span className="dealer-m-inv-card-body">
                        <span className="dealer-m-inv-card-name">{item.name}</span>
                        <span className="dealer-m-inv-card-sub">{item.pack?.label || categoryLabel(item.category) || "Product"}</span>
                      </span>
                      <span className="dealer-m-inv-card-right">
                        <span className="dealer-m-inv-card-status" style={{ color: STOCK_TONE_COLOR[tone] }}>
                          <span className="dealer-m-inv-card-status-dot" style={{ background: STOCK_TONE_COLOR[tone] }} />
                          {statusLabel(status)}
                        </span>
                        <span className="dealer-m-inv-card-qty">{item.currentQuantity} units</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {visibleCount < items.length ? (
                <button type="button" className="dealer-m-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  Load more
                </button>
              ) : null}
            </>
          )}
          </SkeletonSwap>
        </>
      ) : (
        <>
          {historyQuery.isLoading && historyItems.length === 0 ? (
            <>
              <div className="dealer-m-skel" style={{ height: 60, marginTop: 16, borderRadius: 16 }} />
              <div className="dealer-m-skel" style={{ height: 60, marginTop: 12, borderRadius: 16 }} />
            </>
          ) : historyLoadError ? (
            <div className="dealer-m-error-card">
              <div className="dealer-m-error-title">{historyLoadError}</div>
              <button type="button" className="dealer-m-error-retry" onClick={() => historyQuery.refetch()}>
                Try again
              </button>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="dealer-m-empty">
              <DashboardIcon name="history" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
              <div className="dealer-m-empty-title">No stock movements found</div>
            </div>
          ) : (
            <>
              <div className="dealer-m-inv-history-wrap">
                <DispatcherMovementCardList items={historyItems} />
              </div>
              {historyPage < historyTotalPages ? (
                <button type="button" className="dealer-m-load-more" onClick={() => setHistoryPage((p) => p + 1)}>
                  Load more
                </button>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
