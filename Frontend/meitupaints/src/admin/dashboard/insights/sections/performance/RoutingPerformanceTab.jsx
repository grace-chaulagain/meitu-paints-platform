import { useMemo } from "react";

import { useGetAdminRoutingPerformanceQuery } from "../../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../../redux/api/selectors.js";
import { Surface } from "../../../../../components/dashboard/DashboardUI.jsx";
import { KpiTile } from "../../InsightsPrimitives.jsx";
import { money, number, percent } from "../../insightsFormatting.js";
import { CURRENCY, kpiRowStyle } from "../sectionLayout.js";
import { PanelHead, ErrorBanner } from "../sectionShared.jsx";
import MagnitudeBarChart from "../charts/MagnitudeBarChart.jsx";

export default function RoutingPerformanceTab({ dateFilters }) {
  const query = useGetAdminRoutingPerformanceQuery(dateFilters);
  const data = query.data;
  const loading = query.isLoading && !data;
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load routing performance.") : "";

  const factory = data?.factory || {};
  const dispatcher = data?.dispatcher || {};

  const revenueItems = useMemo(
    () => [
      { label: "Factory", value: factory.revenue || 0 },
      { label: "Dispatcher", value: dispatcher.revenue || 0 },
    ],
    [factory.revenue, dispatcher.revenue],
  );

  if (error) return <ErrorBanner message={error} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="invoice" label="Factory Revenue" value={loading ? "…" : money(factory.revenue, CURRENCY)} />
        <KpiTile icon="invoice" label="Dispatcher Revenue" value={loading ? "…" : money(dispatcher.revenue, CURRENCY)} />
        <KpiTile icon="orders" label="Factory Orders" value={loading ? "…" : number(factory.orderCount)} />
        <KpiTile icon="orders" label="Dispatcher Orders" value={loading ? "…" : number(dispatcher.orderCount)} />
        <KpiTile icon="chart" label="Factory AOV" value={loading ? "…" : money(factory.averageOrderValue, CURRENCY)} />
        <KpiTile icon="chart" label="Dispatcher AOV" value={loading ? "…" : money(dispatcher.averageOrderValue, CURRENCY)} />
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Comparison" icon="truck" title="Revenue by route" />
        <MagnitudeBarChart items={revenueItems} formatValue={(v) => money(v, CURRENCY)} />
      </Surface>

      <div style={kpiRowStyle()}>
        <KpiTile icon="chart" label="Factory Revenue Share" value={loading ? "…" : percent(factory.revenueShare)} />
        <KpiTile icon="chart" label="Dispatcher Revenue Share" value={loading ? "…" : percent(dispatcher.revenueShare)} />
      </div>
    </div>
  );
}
