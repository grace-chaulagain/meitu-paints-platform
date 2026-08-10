import { useMemo, useState } from "react";

import {
  useGetAdminInventoryOverviewQuery,
  useGetAdminFactoryStockQuery,
  useGetAdminDispatcherStockLevelsQuery,
  useGetAdminDealerStockLevelsQuery,
  useGetAdminStockMovementsQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, TabBar, Pill, MetricTile } from "../../../../components/dashboard/DashboardUI.jsx";
import { number, formatDate } from "../insightsFormatting.js";
import { kpiRowStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import SectionViewFrame from "./SectionViewFrame.jsx";
import MagnitudeBarChart from "./charts/MagnitudeBarChart.jsx";

const TIER_TABS = [
  { key: "factory", label: "Factory" },
  { key: "dispatcher", label: "Dispatchers" },
  { key: "dealer", label: "Dealers" },
];

function statusTone(status) {
  if (status === "OUT") return "danger";
  if (status === "LOW") return "warning";
  return "success";
}

function statusLabel(status) {
  if (status === "OUT") return "Out of stock";
  if (status === "LOW") return "Low";
  return "In stock";
}

export default function InventorySection({ dateFilters, view, onViewChange }) {
  const [tier, setTier] = useState("factory");

  // Only the entity scope is meaningful for stock levels - a stock level
  // is a "right now" figure, not something that happened inside a date
  // window. Movements below do use the date range.
  const scope = useMemo(() => {
    const params = {};
    if (dateFilters.dealerId) params.dealerId = dateFilters.dealerId;
    if (dateFilters.dispatcherId) params.dispatcherId = dateFilters.dispatcherId;
    return params;
  }, [dateFilters]);

  const overviewQuery = useGetAdminInventoryOverviewQuery(scope);
  const factoryQuery = useGetAdminFactoryStockQuery(undefined, { skip: tier !== "factory" });
  const dispatcherQuery = useGetAdminDispatcherStockLevelsQuery(scope, { skip: tier !== "dispatcher" });
  const dealerQuery = useGetAdminDealerStockLevelsQuery(scope, { skip: tier !== "dealer" });

  const movementsQuery = useGetAdminStockMovementsQuery({
    tier,
    range: dateFilters.range,
    ...(dateFilters.from ? { from: dateFilters.from } : {}),
    ...(dateFilters.to ? { to: dateFilters.to } : {}),
    ...scope,
  });

  const activeQuery = tier === "factory" ? factoryQuery : tier === "dispatcher" ? dispatcherQuery : dealerQuery;
  const rows = useMemo(() => activeQuery.data || [], [activeQuery.data]);
  const movements = useMemo(() => movementsQuery.data || [], [movementsQuery.data]);
  const overview = overviewQuery.data || {};

  const stockError = activeQuery.error ? getQueryErrorMessage(activeQuery.error, "Failed to load stock levels.") : "";
  const movementsError = movementsQuery.error
    ? getQueryErrorMessage(movementsQuery.error, "Failed to load stock movements.")
    : "";

  const tierTotals = overview[tier] || { skuCount: 0, lowStock: 0, outOfStock: 0, totalQuantity: 0 };

  const stockColumns = useMemo(() => {
    const base = [];
    if (tier !== "factory") {
      base.push({ key: "holder", header: tier === "dispatcher" ? "Dispatcher" : "Dealer", render: (row) => row.holder });
    }
    base.push(
      {
        key: "name",
        header: "Product",
        render: (row) => (
          <span>
            <span style={{ fontWeight: 700 }}>{row.name}</span>
            {row.packLabel ? (
              <span style={{ color: "var(--color-graphite, #707070)" }}> · {row.packLabel}</span>
            ) : null}
          </span>
        ),
      },
      { key: "sku", header: "SKU", render: (row) => row.sku || "—" },
      {
        key: "quantity",
        header: "On hand",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => number(row.quantity),
      },
    );

    if (tier === "dealer") {
      base.push(
        {
          key: "received",
          header: "Received",
          align: "right",
          cellClassName: () => "dash-table-tabular",
          render: (row) => number(row.received),
        },
        {
          key: "sold",
          header: "Sold",
          align: "right",
          cellClassName: () => "dash-table-tabular",
          render: (row) => number(row.sold),
        },
      );
    } else {
      base.push(
        {
          key: "reserved",
          header: "Reserved",
          align: "right",
          cellClassName: () => "dash-table-tabular",
          render: (row) => number(row.reserved),
        },
        {
          key: "available",
          header: "Available",
          align: "right",
          cellClassName: () => "dash-table-tabular",
          render: (row) => number(row.available),
        },
      );
    }

    base.push({
      key: "status",
      header: "Status",
      render: (row) => <Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill>,
    });

    return base;
  }, [tier]);

  const movementColumns = useMemo(
    () => [
      { key: "createdAt", header: "When", render: (row) => formatDate(row.createdAt) },
      ...(tier === "factory" ? [] : [{ key: "holder", header: "Holder", render: (row) => row.holder }]),
      {
        key: "name",
        header: "Product",
        render: (row) => row.name || row.sku || "—",
      },
      { key: "type", header: "Type", render: (row) => <Pill tone="neutral">{row.type}</Pill> },
      {
        key: "quantity",
        header: "Change",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => {
          const delta = Number(row.quantity || 0);
          return (
            <span style={{ color: delta < 0 ? "#b42318" : "var(--color-ink, #1d1d1f)", fontWeight: 700 }}>
              {delta > 0 ? `+${number(delta)}` : number(delta)}
            </span>
          );
        },
      },
      {
        key: "newQuantity",
        header: "Balance",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => number(row.newQuantity),
      },
    ],
    [tier],
  );

  const summary = (
    <div style={{ display: "grid", gap: 14 }}>
      {stockError ? <ErrorBanner message={stockError} /> : null}
      {movementsError ? <ErrorBanner message={movementsError} /> : null}

      <div style={kpiRowStyle()}>
        <MetricTile icon="package" label="SKUs tracked" value={number(tierTotals.skuCount)} />
        <MetricTile icon="stock" label="Units on hand" value={number(tierTotals.totalQuantity)} tone="accent" />
        <MetricTile icon="warning" label="Low stock" value={number(tierTotals.lowStock)} />
        <MetricTile icon="reject" label="Out of stock" value={number(tierTotals.outOfStock)} />
      </div>

      <TabBar value={tier} onChange={setTier} options={TIER_TABS} />
    </div>
  );

  const lowestFirst = useMemo(
    () =>
      rows
        .filter((row) => row.status !== "OK")
        .slice(0, 12)
        .map((row) => ({ label: `${row.name}${row.holder ? ` · ${row.holder}` : ""}`, value: row.quantity })),
    [rows],
  );

  const charts = (
    <Surface padding={0}>
      <PanelHead eyebrow="Attention" icon="warning" title="Low and out-of-stock items" />
      <MagnitudeBarChart
        items={lowestFirst}
        formatValue={number}
        empty="Every tracked item is above its threshold."
      />
    </Surface>
  );

  const dataView = (
    <>
      <Surface padding={0}>
        <PanelHead eyebrow="Stock levels" icon="package" title="Current stock" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={stockColumns}
            rows={rows}
            getRowKey={(row) => row.key}
            loading={activeQuery.isLoading && !activeQuery.data}
            emptyState={{ icon: "package", title: "No stock records", subtitle: "Nothing tracked for this tier yet." }}
            minWidth={860}
          />
        </div>
      </Surface>

      <Surface padding={0}>
        <PanelHead eyebrow="History" icon="history" title="Stock movements" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={movementColumns}
            rows={movements}
            getRowKey={(row) => row.key}
            loading={movementsQuery.isLoading && !movementsQuery.data}
            emptyState={{ icon: "history", title: "No movements", subtitle: "Nothing recorded in this window." }}
            minWidth={860}
          />
        </div>
      </Surface>
    </>
  );

  return (
    <SectionViewFrame
      summary={summary}
      charts={charts}
      data={dataView}
      view={view}
      onViewChange={onViewChange}
    />
  );
}
