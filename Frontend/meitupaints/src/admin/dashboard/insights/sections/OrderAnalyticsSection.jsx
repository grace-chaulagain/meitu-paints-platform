import { useMemo, useState } from "react";

import { useGetAdminOrderAnalyticsQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, SegmentedControl } from "../../../../components/dashboard/DashboardUI.jsx";
import { KpiTile } from "../InsightsPrimitives.jsx";
import { money, number, formatDate } from "../insightsFormatting.js";
import { CURRENCY, twoColStyle, kpiRowStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import RevenueTrendChart from "./charts/RevenueTrendChart.jsx";
import StatusDistributionBarChart from "./charts/StatusDistributionBarChart.jsx";
import MagnitudeBarChart from "./charts/MagnitudeBarChart.jsx";

const GRANULARITY_OPTIONS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function OrderAnalyticsSection({ dateFilters }) {
  // Real user-selectable trend granularity - the old page hardcoded a
  // binary daily/monthly switch based on the selected date range's length.
  const [granularity, setGranularity] = useState("day");
  const query = useGetAdminOrderAnalyticsQuery({ ...dateFilters, granularity });
  const data = query.data;
  const loading = query.isLoading && !data;
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load order analytics.") : "";

  const trendPoints = useMemo(
    () => (data?.trend || []).map((point) => ({ label: String(point.date).slice(0, 10), revenue: point.revenue })),
    [data],
  );

  const valueDistItems = useMemo(
    () => (data?.valueDistribution || []).map((row) => ({ label: row.label, value: row.revenue })),
    [data],
  );

  const dayOfWeekItems = useMemo(
    () => (data?.dayOfWeek || []).map((row) => ({ label: row.label, value: row.count })),
    [data],
  );

  const totals = useMemo(() => {
    const rows = data?.statusDistribution || [];
    return rows.reduce(
      (acc, row) => ({
        orders: acc.orders + Number(row.count || 0),
        revenue: acc.revenue + Number(row.revenue || 0),
      }),
      { orders: 0, revenue: 0 },
    );
  }, [data]);

  const largestOrdersColumns = useMemo(
    () => [
      { key: "orderNumber", header: "Order", render: (row) => row.orderNumber },
      { key: "dealerName", header: "Dealer", render: (row) => row.dealerName },
      { key: "route", header: "Route", render: (row) => row.route },
      { key: "createdAt", header: "Date", render: (row) => formatDate(row.createdAt) },
      {
        key: "total",
        header: "Total",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.total, CURRENCY),
      },
    ],
    [],
  );

  if (error) return <ErrorBanner message={error} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="orders" label="Orders in window" value={loading ? "…" : number(totals.orders)} />
        <KpiTile icon="invoice" label="Revenue in window" value={loading ? "…" : money(totals.revenue, CURRENCY)} tone="accent" />
      </div>

      <Surface padding={0}>
        <PanelHead
          eyebrow="Trend analysis"
          icon="chart"
          title="Revenue over time"
          action={<SegmentedControl value={granularity} onChange={setGranularity} options={GRANULARITY_OPTIONS} size="small" />}
        />
        <RevenueTrendChart data={trendPoints} currency={CURRENCY} />
      </Surface>

      <Surface padding={0}>
        <PanelHead eyebrow="Funnel" icon="list" title="Orders by status" />
        <StatusDistributionBarChart items={data?.statusDistribution || []} />
      </Surface>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Distribution" icon="invoice" title="Order value bands" />
          <MagnitudeBarChart items={valueDistItems} formatValue={(v) => money(v, CURRENCY)} empty="No accepted orders in this window." />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Cadence" icon="calendar" title="Orders by day of week" />
          <MagnitudeBarChart items={dayOfWeekItems} formatValue={number} empty="No accepted orders in this window." />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Ranked" icon="list" title="Largest accepted orders" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={largestOrdersColumns}
            rows={data?.largestOrders || []}
            getRowKey={(row) => row.orderId}
            loading={loading}
            emptyState={{ icon: "invoice", title: "No accepted orders", subtitle: "Nothing accepted in this window yet." }}
            minWidth={640}
          />
        </div>
      </Surface>
    </div>
  );
}
