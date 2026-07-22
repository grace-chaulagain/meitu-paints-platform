import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminSalesQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "No sales yet";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getDealerName(summary) {
  return summary?.dealer?.companyName || summary?.dealer?.contactName || "Unnamed Dealer";
}

// Fleet-wide dealer sales leaderboard, not a per-transaction ledger -
// individual Sale documents live on AdminDealerSalesPurchasesPage.jsx
// (desktop-only for now, same as the Dealers mobile phase left it). Date-
// range/status filters and CSV export stay desktop-only; dealerLimit is
// raised instead of paginated so search/sort work instantly client-side,
// same pattern as the other list views this phase.
export function AdminSalesMobileView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const salesQuery = useGetAdminSalesQuery({ status: "ALL", dealerPage: 1, dealerLimit: 200 });
  const summary = salesQuery.data?.summary || {};
  const dealerSummaries = useMemo(() => salesQuery.data?.dealerSummaries || [], [salesQuery.data]);

  const visible = useMemo(
    () => rankBySearch(dealerSummaries, query, (row) => [getDealerName(row), row?.dealer?.contactName, row?.dealer?.email]),
    [dealerSummaries, query],
  );

  const loading = salesQuery.isLoading && dealerSummaries.length === 0;
  const loadError = salesQuery.error ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.") : "";

  function openDealer(row) {
    const id = row?.dealerId || row?.dealer?._id;
    if (id) navigate(`/admin/dashboard/dealers/${id}/sales-purchases`);
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => salesQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Sales</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Sales" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
          <div className="admin-m-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Total Sales</div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{money(summary.totalRevenue)}</div>
          </div>
          <div className="admin-m-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Avg Sale</div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800 }}>{money(summary.averageSaleValue)}</div>
          </div>
          <div className="admin-m-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Completed</div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800 }}>{Number(summary.completedCount || 0).toLocaleString()}</div>
          </div>
          <div className="admin-m-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Voided</div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800, color: summary.voidedCount ? "#b42318" : "var(--color-ink, #1d1d1f)" }}>
              {Number(summary.voidedCount || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dealer…"
          />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="chart" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No dealer sales found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((row) => (
              <button key={String(row.dealerId)} type="button" className="admin-m-card admin-m-feed-row" onClick={() => openDealer(row)}>
                <span className="admin-m-feed-icon">
                  <DashboardIcon name="store" size={16} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="admin-m-feed-title">{getDealerName(row)}</span>
                  <span className="admin-m-feed-detail">
                    {Number(row.completedCount || 0)} completed · {formatDate(row.latestSaleAt)}
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", flexShrink: 0 }}>{money(row.totalRevenue)}</span>
              </button>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
