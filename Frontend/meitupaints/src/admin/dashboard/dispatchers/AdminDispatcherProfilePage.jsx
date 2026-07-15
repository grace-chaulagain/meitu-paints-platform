import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDispatcherAnalyticsQuery,
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherStockQuery,
  useResendDispatcherSetupEmailMutation,
} from "../../../redux/api/meituApi.js";
import {
  DashboardUIStyles,
  GhostButton,
  ListRow,
  MetricTile,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "No activity";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  const tone =
    normalized === "VERIFIED"
      ? "positive"
      : normalized === "REJECTED" || normalized === "SUSPENDED"
        ? "critical"
        : "neutral";
  return (
    <Pill tone={tone} size="small">
      {status || "—"}
    </Pill>
  );
}

export default function AdminDispatcherProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dispatchers\/([^/]+)$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const {
    data: dispatcher = null,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const analyticsQuery = useGetAdminDispatcherAnalyticsQuery(dispatcherId, {
    skip: !dispatcherId,
  });
  const stockQuery = useGetAdminDispatcherStockQuery(dispatcherId, {
    skip: !dispatcherId,
  });
  const [resendSetupEmail] = useResendDispatcherSetupEmailMutation();

  const loading = isLoading && !dispatcher;
  const pageError = error || queryError?.message || "";
  const analytics = analyticsQuery.data || null;
  const stockItems = stockQuery.data?.items || [];

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Surface key={index} padding={18}>
            <div
              style={{
                height: 86,
                borderRadius: 12,
                background:
                  "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
              }}
            />
          </Surface>
        ))}
      </div>
    );
  }

  if (!dispatcher) {
    return (
      <Surface padding={26}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>
          Dispatcher not found
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          The requested dispatcher profile could not be loaded.
        </div>
        <div style={{ marginTop: 16 }}>
          <GhostButton onClick={() => navigate("/admin/dashboard/dispatchers")}>
            Back to Dispatchers
          </GhostButton>
        </div>
      </Surface>
    );
  }

  const summary = dispatcher.operationalSummary || {};
  const assignedDealers = dispatcher.assignedDealers || [];
  const accessState = dispatcher.accessState || {};
  const replenishment = analytics?.replenishment || {};
  const network = analytics?.network || {};
  const stock = analytics?.stock || {};
  const commercial = analytics?.commercial || {};

  async function handleResendSetup() {
    if (!accessState.userId) return;

    try {
      setBusy("setup");
      setError("");
      setSuccess("");
      await resendSetupEmail(accessState.userId).unwrap();
      await refetch();
      setSuccess("A fresh password setup link has been sent if eligible.");
    } catch (err) {
      setError(
        err?.data?.error ||
          err?.data?.message ||
          err?.message ||
          "Failed to resend setup link.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <div className="dispatcher-profile-breadcrumb">
        <button
          type="button"
          className="dispatcher-profile-back-btn"
          onClick={() => navigate("/admin/dashboard/dispatchers")}
          aria-label="Back to dispatchers"
        >
          <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" className="dispatcher-profile-crumb-link" onClick={() => navigate("/admin/dashboard/dispatchers")}>
          Dispatchers
        </button>
        <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
        <span className="dispatcher-profile-crumb-current">Dispatcher Profile</span>
      </div>

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          title={dispatcher.name || dispatcher.companyName || "Dispatcher"}
          subtitle="Assigned dealer network, workload, commercial health, and stock posture for this dispatcher."
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <GhostButton onClick={refetch} icon="sort">
                {isFetching && dispatcher ? "Updating…" : "Refresh"}
              </GhostButton>
              {accessState.canResendSetup ? (
                <GhostButton onClick={handleResendSetup} disabled={busy === "setup"}>
                  {busy === "setup" ? "Sending…" : "Resend Setup"}
                </GhostButton>
              ) : null}
            </div>
          }
        />

        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={dispatcher.status} />
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <GhostButton icon="stock" onClick={() => navigate(`/admin/dashboard/dispatchers/${dispatcherId}/stock`)}>
            View Stock
          </GhostButton>
          <GhostButton icon="chart" onClick={() => navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases`)}>
            Sales and Purchases
          </GhostButton>
          <GhostButton icon="orders" onClick={() => navigate(`/admin/dashboard/dispatchers/${dispatcherId}/orders`)}>
            View Orders
          </GhostButton>
        </div>

        {pageError ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {pageError}
          </div>
        ) : null}
        {success ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(22,163,74,.1)",
              color: "#15803d",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        ) : null}
      </Surface>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader title="Operational Workload" size="small" />
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <MetricTile
            label="Assigned Dealers"
            value={summary.assignedDealerCount || 0}
            helper={`${summary.activeAssignedDealerCount || 0} active`}
            tone="accent"
          />
          <MetricTile
            label="Pending Workload"
            value={summary.pendingOrders || 0}
            helper="Submitted assigned orders"
          />
          <MetricTile
            label="Verified / Rejected"
            value={`${summary.verifiedOrders || 0}/${summary.rejectedOrders || 0}`}
            helper="Handled outcomes"
          />
          <MetricTile
            label="Verified Sales"
            value={money(summary.totalVerifiedSales)}
            helper="Dispatcher-routed"
            tone="accent"
          />
        </div>
      </Surface>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          title="Commercial Intelligence"
          subtitle="Replenishment behavior, assigned-network health, and stock posture."
          size="small"
        />

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <MetricTile
            label="Health Score"
            value={
              commercial.businessHealthScore != null
                ? `${commercial.businessHealthScore}/100`
                : "—"
            }
            helper="Composite operational health"
            tone="accent"
          />
          <MetricTile
            label="Replenishment Orders"
            value={replenishment.totalOrders || 0}
            helper={
              replenishment.daysSinceLastReplenishment != null
                ? `Last order ${replenishment.daysSinceLastReplenishment}d ago`
                : "No replenishment yet"
            }
          />
          <MetricTile
            label="Replenishment Spend"
            value={money(replenishment.totalSpend)}
            helper={`${replenishment.revenueGrowth30d >= 0 ? "+" : ""}${Number(
              replenishment.revenueGrowth30d || 0,
            ).toFixed(1)}% vs prior 30d`}
          />
          <MetricTile
            label="Network Rejection Rate"
            value={`${Number(network.networkRejectionRate || 0).toFixed(1)}%`}
            helper={`${network.activeDealerCount || 0}/${network.assignedDealerCount || 0} dealers active`}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <MetricTile
            label="SKUs Held"
            value={stock.totalSkusHeld || 0}
            helper={`${stock.totalUnitsOnHand || 0} units on hand`}
          />
          <MetricTile
            label="Low Stock SKUs"
            value={stock.lowStockSkuCount || 0}
            helper="At or below threshold"
          />
          <MetricTile
            label="Out of Stock SKUs"
            value={stock.zeroStockSkuCount || 0}
            helper="Zero units on hand"
            tone={stock.zeroStockSkuCount > 0 ? "accent" : "neutral"}
          />
        </div>

        {[
          ...(commercial.riskFlags || []),
          ...(commercial.opportunityTags || []),
          ...(commercial.recommendations || []),
        ].length ? (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {(commercial.riskFlags || []).map((item, index) => (
              <div key={`risk-${index}`} style={signalStyle("critical")}>
                {item}
              </div>
            ))}
            {(commercial.opportunityTags || []).map((item, index) => (
              <div key={`opp-${index}`} style={signalStyle("positive")}>
                {item}
              </div>
            ))}
            {(commercial.recommendations || []).map((item, index) => (
              <div key={`rec-${index}`} style={signalStyle("neutral")}>
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </Surface>

      <Surface padding={0} className="dash-fade-up">
        <div style={{ padding: "18px 20px 0" }}>
          <SectionHeader title="Access State" size="small" />
        </div>
        <div
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={detailBoxStyle}>
            <span style={detailLabelStyle}>Account Status</span>
            <strong style={detailValueStyle}>{accessState.accountStatus || "—"}</strong>
          </div>
          <div style={detailBoxStyle}>
            <span style={detailLabelStyle}>Password Set</span>
            <strong style={detailValueStyle}>{accessState.passwordSet ? "Yes" : "No"}</strong>
          </div>
          <div style={detailBoxStyle}>
            <span style={detailLabelStyle}>Invitation Last Sent</span>
            <strong style={detailValueStyle}>
              {accessState.invitationLastSentAt
                ? formatDate(accessState.invitationLastSentAt)
                : "—"}
            </strong>
          </div>
          <div style={detailBoxStyle}>
            <span style={detailLabelStyle}>Invitation Expires</span>
            <strong style={detailValueStyle}>
              {accessState.invitationExpiresAt
                ? formatDate(accessState.invitationExpiresAt)
                : "—"}
            </strong>
          </div>
        </div>
      </Surface>

      <Surface padding={0} className="dash-fade-up">
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid rgba(0,0,0,.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SectionHeader title="Stock Ledger" size="small" />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            {stockItems.length} SKUs
          </span>
        </div>

        {stockItems.length ? (
          stockItems.slice(0, 20).map((item) => {
            const isLow =
              item.lowStockThreshold > 0 && item.currentQuantity <= item.lowStockThreshold;
            const isZero = item.currentQuantity <= 0;
            return (
              <ListRow key={item.productId}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
                    {item.name || item.sku}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                    {item.sku} · {item.category || "Uncategorized"}
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {isZero ? (
                    <Pill tone="critical" size="small">Out of stock</Pill>
                  ) : isLow ? (
                    <Pill tone="caution" size="small">Low stock</Pill>
                  ) : null}
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
                    {item.currentQuantity}
                  </span>
                </div>
              </ListRow>
            );
          })
        ) : (
          <div style={{ padding: 20, fontSize: 13, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            This dispatcher does not currently hold any stock.
          </div>
        )}
      </Surface>

      <Surface padding={0} className="dash-fade-up">
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid rgba(0,0,0,.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SectionHeader title="Assigned Dealers" size="small" />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            {assignedDealers.length} accounts
          </span>
        </div>

        {assignedDealers.length ? (
          assignedDealers.map((dealer) => {
            const activity = dealer.activitySummary || {};
            return (
              <ListRow
                key={dealer._id}
                onClick={() => navigate(`/admin/dashboard/dealers/${dealer._id}`)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
                    {dealer.companyName || "Dealer"}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                    {dealer.contactName || "No contact"} · last {formatDate(activity.lastOrderAt)}
                  </div>
                </div>
                <StatusBadge status={dealer.status} />
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
                    {activity.pendingOrders || 0} pending
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                    {activity.verifiedOrders || 0} verified · {money(activity.totalVerifiedSales)}
                  </div>
                </div>
              </ListRow>
            );
          })
        ) : (
          <div style={{ padding: 20, fontSize: 13, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            No dealers are currently assigned to this dispatcher.
          </div>
        )}
      </Surface>

      <style>{`
        .dispatcher-profile-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dispatcher-profile-back-btn{
          width:32px;
          height:32px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:10px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-profile-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dispatcher-profile-back-btn:active{
          transform:scale(.92);
        }
        .dispatcher-profile-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .dispatcher-profile-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .dispatcher-profile-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        @media (prefers-reduced-motion: reduce){
          .dispatcher-profile-back-btn{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}

function signalStyle(tone) {
  const tones = {
    critical: { bg: "rgba(180,35,24,.06)", color: "#b42318" },
    positive: { bg: "rgba(22,163,74,.06)", color: "#15803d" },
    neutral: { bg: "var(--color-fog,#f5f5f7)", color: "var(--color-ink,#1d1d1f)" },
  };
  const t = tones[tone] || tones.neutral;
  return {
    padding: "12px 14px",
    borderRadius: 12,
    background: t.bg,
    color: t.color,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 500,
  };
}

const detailBoxStyle = {
  padding: 14,
  borderRadius: 12,
  background: "var(--color-fog,#f5f5f7)",
  display: "grid",
  gap: 6,
};

const detailLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".02em",
  textTransform: "uppercase",
  color: "var(--color-graphite,#707070)",
};

const detailValueStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-ink,#1d1d1f)",
  wordBreak: "break-word",
};
