import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDealerInventoryQuery, useGetDealerSalesQuery, useVoidDealerSaleMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { getPrimaryImage } from "../inventory/inventoryHelpers.js";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { MobileSheet } from "./MobileSheet.jsx";
import { StatusChip } from "./StatusChip.jsx";
import { useCountUp } from "./useCountUp.js";
import { useScrollInset } from "./useScrollInset.js";
import { NewSaleMobileSheet } from "./NewSaleMobileSheet.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatMoneyCompact(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `NPR ${(amount / 100000).toFixed(1)}L`;
  return formatMoney(amount);
}

function formatDayLabel(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function groupSalesByDay(items) {
  const map = new Map();
  for (const sale of items) {
    const date = new Date(sale.saleDate);
    const key = date.toDateString();
    let group = map.get(key);
    if (!group) {
      group = { key, date, sales: [] };
      map.set(key, group);
    }
    group.sales.push(sale);
  }
  return Array.from(map.values());
}

function SalesStat({ value, label, format }) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : Math.round(animated).toLocaleString();
  return (
    <div className="dealer-m-home-stat">
      <div className="dealer-m-home-stat-value">{display}</div>
      <div className="dealer-m-home-stat-label">{label}</div>
    </div>
  );
}

function SaleDetailSheet({ sale, onClose }) {
  // Same retain-last-content pattern as ProductSheet.jsx: keep rendering the
  // last non-null sale while MobileSheet animates closed instead of
  // unmounting the instant `sale` goes null - and pass a real `open` down
  // rather than the old hardcoded shorthand, since MobileSheet's exit
  // animation is driven entirely by that prop transitioning to false.
  // Adjusted during render (not in an effect) so a re-open never commits a
  // stale/null frame first.
  const [renderedSale, setRenderedSale] = useState(sale);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [voidSale, voidState] = useVoidDealerSaleMutation();

  // A new sale opening into the same still-mounted sheet must not inherit
  // the previous sale's half-typed void reason or expanded void form.
  if (sale && sale !== renderedSale) {
    setRenderedSale(sale);
    setVoiding(false);
    setReason("");
    setError("");
  }

  if (!renderedSale) return null;
  const canVoid = renderedSale.status === "COMPLETED";

  function cancelVoid() {
    setVoiding(false);
    setReason("");
    setError("");
  }

  async function handleVoid() {
    setError("");
    if (!reason.trim()) {
      setError("A reason is required to void this sale.");
      return;
    }
    try {
      await voidSale({ saleId: renderedSale._id, reason }).unwrap();
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not void this sale."));
    }
  }

  return (
    <MobileSheet open={Boolean(sale)} onClose={onClose} ariaLabel="Sale detail">
      <div className="dealer-m-sale-detail-title">
        Bill {renderedSale.billId}
        {renderedSale.status === "VOIDED" ? <StatusChip tone="critical">Voided</StatusChip> : null}
      </div>
      <div className="dealer-m-sale-detail-sub">{new Date(renderedSale.saleDate).toLocaleString("en-US")}</div>

      <div className="dealer-m-sale-detail-items">
        {renderedSale.items.map((item) => (
          <div className="dealer-m-sale-detail-item" key={item.productId}>
            <span>
              {item.name} &times; {item.quantity}
            </span>
            <span className="dealer-m-sale-detail-item-total">{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="dealer-m-sale-detail-total-row">
        <span>Total</span>
        <span className="dealer-m-sale-detail-total-value">{formatMoney(renderedSale.totals?.total)}</span>
      </div>

      {renderedSale.notes ? <div className="dealer-m-sale-detail-notes">{renderedSale.notes}</div> : null}

      {renderedSale.status === "VOIDED" ? (
        <div className="dealer-m-sale-detail-voided">Voided: {renderedSale.voidReason}</div>
      ) : canVoid ? (
        <div className="dealer-m-sale-detail-manage">
          <div className="dealer-m-sale-detail-divider" />
          {voiding ? (
            <div className="dealer-m-sale-detail-void">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for voiding this sale"
                className="dealer-m-newsale-input"
                autoFocus
              />
              {error ? <div className="dealer-m-newsale-error">{error}</div> : null}
              <div className="dealer-m-sale-detail-void-actions">
                <button type="button" className="dealer-m-newsale-ghost" onClick={cancelVoid} disabled={voidState.isLoading}>
                  Cancel
                </button>
                <button type="button" className="dealer-m-sale-void-btn" onClick={handleVoid} disabled={voidState.isLoading}>
                  {voidState.isLoading ? "Voiding…" : "Confirm void"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="dealer-m-sale-void-trigger" onClick={() => setVoiding(true)}>
              Void this sale
            </button>
          )}
        </div>
      ) : null}
    </MobileSheet>
  );
}

export function DealerSalesMobileView() {
  const navigate = useNavigate();
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const insetTop = useScrollInset();

  const salesQuery = useGetDealerSalesQuery({ status: "ALL", limit: 200 });
  const inventoryQuery = useGetDealerInventoryQuery({ limit: 200 });

  const imageMap = useMemo(() => {
    const map = new Map();
    for (const item of inventoryQuery.data?.items || []) {
      const image = getPrimaryImage(item.images);
      if (image) map.set(String(item.productId), image);
    }
    return map;
  }, [inventoryQuery.data]);

  const items = useMemo(() => salesQuery.data?.items || [], [salesQuery.data]);
  const dayGroups = useMemo(() => groupSalesByDay(items), [items]);
  const loadError = salesQuery.error ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.") : "";
  const loading = salesQuery.isLoading && items.length === 0;

  const stats = useMemo(() => {
    const completed = items.filter((sale) => sale.status !== "VOIDED");
    const revenue = completed.reduce((sum, sale) => sum + Number(sale.totals?.total || 0), 0);
    const avg = completed.length ? revenue / completed.length : 0;
    return { count: completed.length, revenue, avg };
  }, [items]);

  return (
    <div className="dealer-m-sales">
      <MobilePushHeader
        title="Sales"
        onBack={() => navigate("/dealer")}
        action={
          <button type="button" className="dealer-m-sales-new-btn" onClick={() => setNewSaleOpen(true)} aria-label="New sale">
            <DashboardIcon name="plus" size={16} strokeWidth={2.2} />
          </button>
        }
      />

      {items.length > 0 ? (
        <div className="dealer-m-home-card dealer-m-home-stats">
          <div className="dealer-m-home-stats-row">
            <SalesStat value={stats.count} label="Sales" />
            <SalesStat value={stats.revenue} label="Revenue" format={formatMoneyCompact} />
            <SalesStat value={stats.avg} label="Avg sale" format={formatMoneyCompact} />
          </div>
        </div>
      ) : null}

      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-skel" style={{ height: 70, marginTop: 16, borderRadius: 16 }} />
            <div className="dealer-m-skel" style={{ height: 70, marginTop: 12, borderRadius: 16 }} />
          </>
        }
      >
      {loadError ? (
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => salesQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : dayGroups.length === 0 ? (
        <div className="dealer-m-empty">
          <DashboardIcon name="orders" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
          <div className="dealer-m-empty-title">No sales yet</div>
          <button type="button" className="dealer-m-empty-action" onClick={() => setNewSaleOpen(true)}>
            Record your first sale
          </button>
        </div>
      ) : (
        <div className="dealer-m-sales-timeline">
          {dayGroups.map((group) => (
            <div key={group.key} className="dealer-m-sales-day">
              <div className="dealer-m-sales-day-label" style={{ top: -insetTop }}>
                {formatDayLabel(group.date)}
              </div>
              <div className="dealer-m-sales-day-cards">
                {group.sales.map((sale, index) => {
                  const firstItem = sale.items?.[0];
                  const image = firstItem ? imageMap.get(String(firstItem.productId)) : null;
                  const stagger = index < 8;
                  return (
                    <button
                      type="button"
                      key={sale._id}
                      className={`dealer-m-sales-card ${stagger ? "dealer-m-orders-card-stagger" : ""}`}
                      style={stagger ? { animationDelay: `${index * 40}ms` } : undefined}
                      onClick={() => setSelectedSale(sale)}
                    >
                      <span className={`dealer-m-sales-card-avatar ${sale.status === "VOIDED" ? "voided" : ""}`}>
                        {image?.url ? (
                          <img src={image.url} alt="" />
                        ) : (
                          <DashboardIcon name={sale.status === "VOIDED" ? "reject" : "checkSquare"} size={14} strokeWidth={1.8} />
                        )}
                      </span>
                      <span className="dealer-m-sales-card-body">
                        <span className="dealer-m-sales-card-title">
                          Bill {sale.billId}
                          {sale.status === "VOIDED" ? <span className="dealer-m-sales-card-voided">Voided</span> : null}
                        </span>
                        <span className="dealer-m-sales-card-sub">{sale.items?.length || 0} items</span>
                      </span>
                      <span className="dealer-m-sales-card-right">
                        <span className="dealer-m-sales-card-amount">{formatMoney(sale.totals?.total)}</span>
                        <span className="dealer-m-sales-card-time">{formatTime(sale.saleDate)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </SkeletonSwap>

      <NewSaleMobileSheet
        open={newSaleOpen}
        onClose={() => setNewSaleOpen(false)}
        onCreated={() => salesQuery.refetch()}
      />
      <SaleDetailSheet sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  );
}
