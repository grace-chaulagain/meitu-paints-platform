import { useMemo } from "react";

import { useGetAdminProductPerformanceQuery } from "../../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../../redux/api/selectors.js";
import { Surface, DataTable } from "../../../../../components/dashboard/DashboardUI.jsx";
import { money, number, formatDate } from "../../insightsFormatting.js";
import { CURRENCY, twoColStyle } from "../sectionLayout.js";
import { PanelHead, PanelBody, ErrorBanner } from "../sectionShared.jsx";
import SectionViewFrame from "../SectionViewFrame.jsx";
import MagnitudeBarChart from "../charts/MagnitudeBarChart.jsx";

export default function ProductsPerformanceTab({ dateFilters, view, onViewChange }) {
  const query = useGetAdminProductPerformanceQuery({ ...dateFilters, limit: 20 });
  const data = query.data;
  const error = query.error ? getQueryErrorMessage(query.error, "Failed to load product performance.") : "";

  const revenueItems = useMemo(
    () => (data?.ranking || []).slice(0, 8).map((row) => ({ label: row.product, value: row.revenue })),
    [data],
  );

  const categoryItems = useMemo(
    () => (data?.categoryMix || []).slice(0, 8).map((row) => ({ label: row.category, value: row.revenue })),
    [data],
  );

  const columns = useMemo(
    () => [
      { key: "product", header: "Product", render: (row) => row.product },
      { key: "sku", header: "SKU", render: (row) => row.sku },
      { key: "category", header: "Category", render: (row) => row.category },
      { key: "quantitySold", header: "Qty", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => number(row.quantitySold) },
      {
        key: "revenue",
        header: "Revenue",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.revenue, CURRENCY),
      },
      { key: "orderCount", header: "Orders", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => number(row.orderCount) },
      { key: "lastOrdered", header: "Last ordered", render: (row) => formatDate(row.lastOrdered) },
    ],
    [],
  );

  if (error) return <ErrorBanner message={error} />;

  const charts = (
      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Revenue" icon="invoice" title="Top products by revenue" />
          <MagnitudeBarChart items={revenueItems} formatValue={(v) => money(v, CURRENCY)} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Category mix" icon="package" title="Category revenue share" />
          <MagnitudeBarChart items={categoryItems} formatValue={(v) => money(v, CURRENCY)} />
        </Surface>
      </div>
  );

  const dataView = (
      <Surface padding={0}>
        <PanelHead eyebrow="Ranking" icon="list" title="Product performance" />
        <PanelBody>
          <DataTable
            columns={columns}
            rows={data?.ranking || []}
            getRowKey={(row) => row.sku || row.product}
            loading={query.isLoading && !query.data}
            emptyState={{ icon: "package", title: "No product activity yet", subtitle: "Accepted order line items will appear here." }}
            minWidth={760}
          />
        </PanelBody>
      </Surface>
  );

  return <SectionViewFrame charts={charts} data={dataView} view={view} onViewChange={onViewChange} />;
}
