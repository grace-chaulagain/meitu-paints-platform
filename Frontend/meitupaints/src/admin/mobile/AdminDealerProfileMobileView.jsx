import { useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function safeNumber(value, fallback = 0) {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) ? next : fallback;
}

function count(value) {
  return safeNumber(value).toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ADMIN_MOBILE_DESIGN_PROMPT.md §5's own fictional draft asked for a
// "tier/region" pill and a "Since 2022" hero line and Payments/Documents
// tabs - none of that exists in this data model (credit/documents were
// explicitly removed from dealers in 2026, per AdminDealerProfilePage.jsx's
// own comment). Built instead from what's real: analyticsQuery's
// performanceSummary/productIntelligence for the stat row, dealer.createdAt
// for "Joined", a single scroll rather than tabs (History's date-range
// filtering and Notes editing stay desktop-only for this pass - same
// "less depth" scope cut as Orders' Amend/Delete).
export function AdminDealerProfileMobileView({
  dealer,
  dispatchers,
  performanceSummary,
  productIntelligence,
  recentOrders,
  loading,
  loadError,
  onBack,
  busyAction,
  error,
  onToggleStatus,
  onSaveRouting,
  onOpenOrder,
}) {
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [routingSheetOpen, setRoutingSheetOpen] = useState(false);
  const [routingChoice, setRoutingChoice] = useState("");

  if (!loading && (loadError || !dealer)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Dealer" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This dealer could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to dealers
          </button>
        </div>
      </div>
    );
  }

  const isVerified = dealer?.status === "VERIFIED";
  const assignedDispatcher = dealer?.dispatcherId && typeof dealer.dispatcherId === "object" ? dealer.dispatcherId : null;
  const busy = Boolean(busyAction);
  const totalOrders = safeNumber(
    performanceSummary?.totalOrdersAllTime,
    recentOrders?.length || performanceSummary?.totalApprovedOrders || 0,
  );
  const completedOrders = safeNumber(performanceSummary?.totalApprovedOrders);
  const totalOrderValue = safeNumber(performanceSummary?.totalSalesAllTime, performanceSummary?.totalSalesApproved || 0);
  const completedOrderValue = safeNumber(performanceSummary?.totalSalesApproved);
  const averageCompletedOrderValue = safeNumber(performanceSummary?.averageApprovedOrderValue);
  const unitsDelivered = safeNumber(productIntelligence?.totalUnitsOrdered);

  function openRoutingSheet() {
    setRoutingChoice(assignedDispatcher ? String(assignedDispatcher._id) : "FACTORY");
    setRoutingSheetOpen(true);
  }

  function confirmRouting() {
    if (routingChoice === "FACTORY") {
      onSaveRouting({ fulfillmentMode: "FACTORY", dispatcherId: null }).then(() => setRoutingSheetOpen(false));
    } else {
      onSaveRouting({ fulfillmentMode: "DISPATCHER", dispatcherId: routingChoice }).then(() => setRoutingSheetOpen(false));
    }
  }

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Dealer" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 200, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        {dealer ? (
          <>
            <MobilePushHeader title={dealer.companyName || "Dealer"} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className="dealer-m-order-hero-headline">{dealer.companyName || "Dealer"}</div>
              <div className="dealer-m-order-hero-sub">Joined {formatDate(dealer.createdAt)}</div>
            </div>

            <div style={{ marginTop: 4 }}>
              <StatusChip tone={isVerified ? "positive" : "critical"}>{isVerified ? "Active Dealer" : "Suspended Dealer"}</StatusChip>
            </div>

            {error ? <div className="dealer-m-newsale-error" style={{ marginTop: 12 }}>{error}</div> : null}

            <div className="admin-m-card" style={{ marginTop: 16 }}>
              <div className="admin-m-section-title">Order Statistics</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{count(totalOrders)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Orders</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{money(totalOrderValue)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Order Value</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{count(completedOrders)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Completed</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{money(completedOrderValue)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Completed Value</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{count(unitsDelivered)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Units Delivered</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{money(averageCompletedOrderValue)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Avg. Completed</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.45, color: "var(--color-graphite, #707070)" }}>
                Order value includes every non-deleted order. Completed value and units count delivered orders only.
              </div>
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Company</div>
              <div className="admin-m-kv-row" style={{ paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Contact</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{dealer.contactName || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Phone</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{dealer.phone || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Email</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", wordBreak: "break-word" }}>{dealer.email || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>PAN/VAT</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{dealer.panVat || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Address</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", wordBreak: "break-word" }}>{dealer.address || "—"}</span>
              </div>
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Fulfillment</div>
              {assignedDispatcher ? (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>Via {assignedDispatcher.name}</span>
                  <button type="button" className="admin-m-image-btn" onClick={openRoutingSheet} disabled={busy}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>Factory-fulfilled</span>
                  <button type="button" className="admin-m-image-btn" onClick={openRoutingSheet} disabled={busy}>
                    Assign dispatcher
                  </button>
                </div>
              )}
            </div>

            {recentOrders.length ? (
              <>
                <div className="admin-m-section-title" style={{ marginTop: 4 }}>
                  Recent Orders
                </div>
                <div className="admin-m-card-list" style={{ marginTop: 10 }}>
                  {recentOrders.map((order) => (
                    <button key={order._id} type="button" className="admin-m-card admin-m-feed-row" onClick={() => onOpenOrder(order)}>
                      <span className="admin-m-feed-icon">
                        <DashboardIcon name="orders" size={16} strokeWidth={1.8} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="admin-m-feed-title">{order.orderNumber}</span>
                        <span className="admin-m-feed-detail">{money(order?.totals?.total, order?.totals?.currency)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <button
              type="button"
              className="dealer-m-newsale-ghost"
              style={{ marginTop: 8 }}
              onClick={() => setStatusSheetOpen(true)}
              disabled={busy}
            >
              {isVerified ? "Suspend this dealer" : "Reactivate this dealer"}
            </button>
          </>
        ) : null}
      </SkeletonSwap>

      <MobileSheet
        open={statusSheetOpen}
        onClose={() => {
          if (!busy) setStatusSheetOpen(false);
        }}
        ariaLabel="Confirm status change"
        footer={
          <PrimaryButton variant={isVerified ? "danger" : "primary"} loading={busy} onClick={() => onToggleStatus().then(() => setStatusSheetOpen(false))}>
            {isVerified ? "Suspend Dealer" : "Reactivate Dealer"}
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">{isVerified ? "Suspend this dealer?" : "Reactivate this dealer?"}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          {isVerified
            ? `${dealer?.companyName} will no longer be able to place orders until reactivated.`
            : `${dealer?.companyName} will be able to place orders again.`}
        </div>
      </MobileSheet>

      <MobileSheet
        open={routingSheetOpen}
        onClose={() => {
          if (!busy) setRoutingSheetOpen(false);
        }}
        ariaLabel="Change routing"
        footer={
          <PrimaryButton loading={busy} onClick={confirmRouting}>
            Save Routing
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Fulfillment routing</div>
        <div className="dealer-m-newsale-field-label">Route via</div>
        <select className="admin-m-select" value={routingChoice} onChange={(e) => setRoutingChoice(e.target.value)}>
          <option value="FACTORY">Factory (direct)</option>
          {dispatchers.map((dispatcher) => (
            <option key={dispatcher._id} value={dispatcher._id}>
              {dispatcher.companyName || dispatcher.name}
            </option>
          ))}
        </select>
      </MobileSheet>
    </div>
  );
}
