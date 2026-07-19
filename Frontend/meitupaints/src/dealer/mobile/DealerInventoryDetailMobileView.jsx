import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetDealerInventoryItemQuery, useGetDealerInventoryMovementsQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { categoryLabel, formatMoney, getPrimaryImage, statusLabel, statusTone, timeAgo } from "../inventory/inventoryHelpers.js";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { StatusChip } from "./StatusChip.jsx";
import { SegmentedControl } from "./SegmentedControl.jsx";
import { MovementCardList } from "./MovementCardList.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "History" },
];

const PAGE_SIZE = 20;

function OverviewField({ label, value }) {
  return (
    <div className="dealer-m-invd-field">
      <div className="dealer-m-invd-field-label">{label}</div>
      <div className="dealer-m-invd-field-value">{value}</div>
    </div>
  );
}

export function DealerInventoryDetailMobileView() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);
  const lastAppendedPageRef = useRef(0);

  const itemQuery = useGetDealerInventoryItemQuery(productId);
  const item = itemQuery.data;

  const historyQuery = useGetDealerInventoryMovementsQuery(
    { productId, type: "ALL", page: historyPage, limit: PAGE_SIZE },
    { skip: tab !== "history" },
  );
  const historyPageItems = historyQuery.data?.items;
  const historyTotalPages = Math.max(1, Number(historyQuery.data?.pagination?.pages || 1));

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

  const loading = itemQuery.isLoading && !item;

  if (!loading && (itemQuery.error || !item)) {
    return (
      <div className="dealer-m-invd">
        <MobilePushHeader title="Product" onBack={() => navigate("/dealer/inventory")} />
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{getQueryErrorMessage(itemQuery.error, "This product isn't in your inventory.")}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => navigate("/dealer/inventory")}>
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const image = item ? getPrimaryImage(item.images) : null;
  const historyLoadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load stock history.") : "";

  return (
    <div className="dealer-m-invd">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Product" onBack={() => navigate("/dealer/inventory")} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 16, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 80, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        {item ? (
          <>
            <MobilePushHeader title={item.name} onBack={() => navigate("/dealer/inventory")} />

            <div className="dealer-m-invd-identity">
              <span className="dealer-m-invd-thumb">
                {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={26} strokeWidth={1.4} />}
              </span>
              <span className="dealer-m-invd-identity-body">
                <span className="dealer-m-invd-name">{item.name}</span>
                <span className="dealer-m-invd-sub">
                  {[item.pack?.label, categoryLabel(item.category)].filter(Boolean).join(" · ") || "Product"}
                </span>
              </span>
              <StatusChip tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusChip>
            </div>

            <div className="dealer-m-invd-stats">
              <div className="dealer-m-invd-stat">
                <div className="dealer-m-invd-stat-value">{item.currentQuantity.toLocaleString()}</div>
                <div className="dealer-m-invd-stat-label">Current stock</div>
              </div>
              <div className="dealer-m-invd-stat">
                <div className="dealer-m-invd-stat-value">{item.totalReceivedQuantity.toLocaleString()}</div>
                <div className="dealer-m-invd-stat-label">Total in</div>
              </div>
              <div className="dealer-m-invd-stat">
                <div className="dealer-m-invd-stat-value">{item.totalSoldQuantity.toLocaleString()}</div>
                <div className="dealer-m-invd-stat-label">Total sold</div>
              </div>
              <div className="dealer-m-invd-stat">
                <div className="dealer-m-invd-stat-value">{item.lastKnownUnitCost ? formatMoney(item.lastKnownUnitCost) : "—"}</div>
                <div className="dealer-m-invd-stat-label">Avg price</div>
              </div>
            </div>

            <SegmentedControl options={TABS} value={tab} onChange={setTab} />

            {tab === "overview" ? (
              <div className="dealer-m-invd-overview">
                <OverviewField label="SKU" value={item.sku || "—"} />
                <OverviewField label="Product code" value={item.code || "—"} />
                <OverviewField label="Low stock threshold" value={item.lowStockThreshold ? `${item.lowStockThreshold} units` : "—"} />
                <OverviewField label="Last movement" value={timeAgo(item.lastMovementAt)} />
              </div>
            ) : (
              <div className="dealer-m-invd-history">
                {historyQuery.isLoading && historyItems.length === 0 ? (
                  <div className="dealer-m-skel" style={{ height: 60, marginTop: 16, borderRadius: 16 }} />
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
                    <MovementCardList items={historyItems} showProduct={false} />
                    {historyPage < historyTotalPages ? (
                      <button type="button" className="dealer-m-load-more" onClick={() => setHistoryPage((p) => p + 1)}>
                        Load more
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
