import { useMemo } from "react";

import { useGetAdminDealerLeaderboardQuery } from "../../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../../redux/api/selectors.js";
import { Surface, DataTable, Pill } from "../../../../../components/dashboard/DashboardUI.jsx";
import { money, number, percent, formatDate } from "../../insightsFormatting.js";
import { CURRENCY } from "../sectionLayout.js";
import { PanelHead, ErrorBanner } from "../sectionShared.jsx";
import MagnitudeBarChart from "../charts/MagnitudeBarChart.jsx";

function activityTone(status) {
  if (status === "ACTIVE") return "positive";
  if (status === "SLOW") return "caution";
  return "neutral";
}

// Resurrects GET /admin/dealers/analytics/leaderboard - backend-complete,
// correct, real $group/$unwind aggregation, but zero frontend consumers
// before this tab.
export default function DealersPerformanceTab() {
  const query = useGetAdminDealerLeaderboardQuery({ sort: "totalSales", limit: 50 });
  const rows = useMemo(() => query.data || [], [query.data]);
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load dealer leaderboard.") : "";

  const chartItems = useMemo(
    () => rows.slice(0, 8).map((row) => ({ label: row.dealer?.companyName || "Unknown dealer", value: row.totalSales })),
    [rows],
  );

  const columns = useMemo(
    () => [
      { key: "dealer", header: "Dealer", render: (row) => <span style={{ fontWeight: 700 }}>{row.dealer?.companyName || "Unknown dealer"}</span> },
      { key: "tier", header: "Tier", render: (row) => row.dealerTier },
      {
        key: "totalSales",
        header: "Sales",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.totalSales, CURRENCY),
      },
      { key: "orderCount", header: "Orders", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => number(row.orderCount) },
      {
        key: "growth",
        header: "30d Growth",
        align: "right",
        render: (row) => percent(row.growthRateRevenue30d),
      },
      {
        key: "activity",
        header: "Activity",
        render: (row) => <Pill tone={activityTone(row.currentActivityStatus)}>{row.currentActivityStatus}</Pill>,
      },
      { key: "latestActivity", header: "Last activity", render: (row) => formatDate(row.latestActivity) },
    ],
    [],
  );

  if (error) return <ErrorBanner message={error} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Surface padding={0}>
        <PanelHead eyebrow="Leadership" icon="store" title="Dealer revenue leaders" />
        <MagnitudeBarChart items={chartItems} formatValue={(v) => money(v, CURRENCY)} />
      </Surface>
      <Surface padding={0}>
        <PanelHead eyebrow="Comparison" icon="list" title="Dealer leaderboard" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.dealerId}
            loading={query.isLoading && !query.data}
            emptyState={{ icon: "store", title: "No dealer activity yet", subtitle: "Accepted dealer orders will appear here." }}
            minWidth={760}
          />
        </div>
      </Surface>
    </div>
  );
}
