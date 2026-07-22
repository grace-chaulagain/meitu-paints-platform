import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status) {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED" || status === "SUSPENDED") return "critical";
  return "caution";
}

// Real fields only - replenishment/network/stock/commercial straight from
// useGetAdminDispatcherAnalyticsQuery, same shape AdminDispatcherProfilePage.jsx
// already reads. No Activate/Deactivate here since desktop doesn't expose
// that action from the profile either (it's list-page-only there) - not
// reintroducing a control desktop itself doesn't have in this spot.
export function AdminDispatcherProfileMobileView({ dispatcher, replenishment, network, stock, commercial, assignedDealers, loading, loadError, onBack, onOpenDealer }) {
  if (!loading && (loadError || !dispatcher)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Dispatcher" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This dispatcher could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to dispatchers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Dispatcher" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 200, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        {dispatcher ? (
          <>
            <MobilePushHeader title={dispatcher.companyName || dispatcher.name || "Dispatcher"} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className="dealer-m-order-hero-headline">{dispatcher.name || dispatcher.companyName}</div>
              <div className="dealer-m-order-hero-sub">
                Last replenishment {replenishment.daysSinceLastReplenishment != null ? `${replenishment.daysSinceLastReplenishment}d ago` : "—"}
              </div>
            </div>

            <div style={{ marginTop: 4 }}>
              <StatusChip tone={statusTone(dispatcher.status)}>{dispatcher.status}</StatusChip>
            </div>

            <div className="admin-m-card" style={{ marginTop: 16 }}>
              <div className="admin-m-section-title">Operational Workload</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{network.assignedDealerCount || 0}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Assigned Dealers</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{replenishment.totalOrders || 0}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Replenishment Orders</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{money(replenishment.totalSpend)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Spend</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>
                    {commercial.businessHealthScore != null ? `${commercial.businessHealthScore}/100` : "—"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Health Score</div>
                </div>
              </div>
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Stock</div>
              <div className="admin-m-kv-row" style={{ paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>SKUs held</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{stock.totalSkusHeld || 0}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Units on hand</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{stock.totalUnitsOnHand || 0}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Low / zero stock</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {stock.lowStockSkuCount || 0} / {stock.zeroStockSkuCount || 0}
                </span>
              </div>
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Contact</div>
              <div className="admin-m-kv-row" style={{ paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Phone</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{dispatcher.phone || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Email</span>
                <span style={{ fontSize: 13, fontWeight: 700, wordBreak: "break-word", textAlign: "right" }}>{dispatcher.email || "—"}</span>
              </div>
            </div>

            {assignedDealers.length ? (
              <>
                <div className="admin-m-section-title" style={{ marginTop: 4 }}>
                  Assigned Dealers · {assignedDealers.length}
                </div>
                <div className="admin-m-card-list" style={{ marginTop: 10 }}>
                  {assignedDealers.map((dealer) => (
                    <button key={dealer._id} type="button" className="admin-m-card admin-m-feed-row" onClick={() => onOpenDealer(dealer)}>
                      <span className="admin-m-feed-icon">
                        <DashboardIcon name="store" size={16} strokeWidth={1.8} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="admin-m-feed-title">{dealer.companyName || "Dealer"}</span>
                        <span className="admin-m-feed-detail">
                          {dealer.activitySummary?.pendingOrders || 0} pending · last {formatDate(dealer.activitySummary?.lastOrderAt)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
