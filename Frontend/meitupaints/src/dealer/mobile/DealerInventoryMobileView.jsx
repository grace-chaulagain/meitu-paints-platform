import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDealerInventoryHistoryQuery, useGetDealerInventoryQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { categoryLabel, getPrimaryImage, statusLabel, statusTone } from "../inventory/inventoryHelpers.js";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { SegmentedControl } from "./SegmentedControl.jsx";
import { MovementCardList } from "./MovementCardList.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";

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

export function DealerInventoryMobileView() {
  const navigate = useNavigate();
  const [section, setSection] = useState("inventory");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);

  const inventoryQuery = useGetDealerInventoryQuery({ q: search, status: "ALL", sort: "name", limit: 200 });
  const historyQuery = useGetDealerInventoryHistoryQuery(
    { type: "ALL", sort: "desc", page: historyPage, limit: PAGE_SIZE },
    { skip: section !== "history" },
  );

  const allItems = useMemo(() => inventoryQuery.data?.items || [], [inventoryQuery.data]);
  const categoryOptions = useMemo(() => buildCategoryOptions(allItems), [allItems]);
  const activeCategory = categoryOptions.some((option) => option.key === category) ? category : "ALL";
  const items = useMemo(
    () => (activeCategory === "ALL" ? allItems : allItems.filter((item) => item.category === activeCategory)),
    [allItems, activeCategory],
  );
  const visibleItems = items.slice(0, visibleCount);

  // The history endpoint is page-based, but the mobile spec calls for a
  // "Load more" ghost button rather than page-number pagination - each new
  // page's rows are appended to a locally-held accumulator instead of
  // replacing the view, so scrolled position/context is never lost. Guarded
  // by lastAppendedPageRef so a background refetch of the SAME page (a new
  // array reference, same page number) never double-appends its rows.
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

  const loadError = inventoryQuery.error ? getQueryErrorMessage(inventoryQuery.error, "Failed to load your inventory.") : "";
  const historyLoadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load stock history.") : "";
  const loading = inventoryQuery.isLoading && allItems.length === 0;

  function changeSection(next) {
    setSection(next);
  }

  function changeCategory(next) {
    setCategory(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="dealer-m-inventory">
      <MobilePushHeader title="Inventory" onBack={() => navigate("/dealer")} />

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
              <button type="button" className="dealer-m-error-retry" onClick={() => inventoryQuery.refetch()}>
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="dealer-m-empty">
              <DashboardIcon name="stock" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
              <div className="dealer-m-empty-title">No inventory yet</div>
            </div>
          ) : (
            <>
              <div className="dealer-m-inv-list">
                {visibleItems.map((item) => {
                  const image = getPrimaryImage(item.images);
                  const tone = statusTone(item.status);
                  return (
                    <button
                      type="button"
                      key={item.productId}
                      className="dealer-m-inv-card"
                      onClick={() => navigate(`/dealer/inventory/${item.productId}`)}
                    >
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
                          {statusLabel(item.status)}
                        </span>
                        <span className="dealer-m-inv-card-qty">{item.currentQuantity} units</span>
                      </span>
                    </button>
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
                <MovementCardList items={historyItems} showProduct />
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
