import { useMemo } from "react";

import { useGetAdminDispatcherPerformanceQuery } from "../../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../../redux/api/selectors.js";
import { Surface, DataTable } from "../../../../../components/dashboard/DashboardUI.jsx";
import { money, number, formatDate } from "../../insightsFormatting.js";
import { CURRENCY } from "../sectionLayout.js";
import { PanelHead, PanelBody, ErrorBanner } from "../sectionShared.jsx";
import SectionViewFrame from "../SectionViewFrame.jsx";
import MagnitudeBarChart from "../charts/MagnitudeBarChart.jsx";

export default function DispatchersPerformanceTab({ dateFilters, view, onViewChange }) {
  const query = useGetAdminDispatcherPerformanceQuery({ ...dateFilters, limit: 20 });
  const rows = useMemo(() => query.data || [], [query.data]);
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load dispatcher performance.") : "";

  const chartItems = useMemo(
    () => rows.slice(0, 8).map((row) => ({ label: row.dispatcherName, value: row.revenue })),
    [rows],
  );

  const columns = useMemo(
    () => [
      { key: "dispatcherName", header: "Dispatcher", render: (row) => row.dispatcherName },
      {
        key: "revenue",
        header: "Revenue",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.revenue, CURRENCY),
      },
      { key: "orderCount", header: "Orders", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => number(row.orderCount) },
      {
        key: "averageOrderValue",
        header: "AOV",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.averageOrderValue, CURRENCY),
      },
      {
        key: "largestOrder",
        header: "Biggest order",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.largestOrder, CURRENCY),
      },
      { key: "lastActivity", header: "Last activity", render: (row) => formatDate(row.lastActivity) },
    ],
    [],
  );

  if (error) return <ErrorBanner message={error} />;

  const charts = (
      <Surface padding={0}>
        <PanelHead eyebrow="Revenue" icon="invoice" title="Revenue by dispatcher" />
        <MagnitudeBarChart items={chartItems} formatValue={(v) => money(v, CURRENCY)} />
      </Surface>
  );

  const dataView = (
      <Surface padding={0}>
        <PanelHead eyebrow="Comparison" icon="list" title="Dispatcher performance" />
        <PanelBody>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.dispatcherId}
            loading={query.isLoading && !query.data}
            emptyState={{ icon: "handshake", title: "No dispatcher-routed orders yet", subtitle: "Accepted dispatcher orders will appear here." }}
            minWidth={760}
          />
        </PanelBody>
      </Surface>
  );

  return <SectionViewFrame charts={charts} data={dataView} view={view} onViewChange={onViewChange} />;
}
