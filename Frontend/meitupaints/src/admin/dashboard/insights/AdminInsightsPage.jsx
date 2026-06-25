import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { useGetAdminInsightsQuery } from "../../../redux/api/meituApi.js";

const INSIGHT_SECTIONS = [
  {
    key: "home",
    label: "Home",
    path: "/admin/dashboard/insights",
    summary: "Executive pulse",
  },
  {
    key: "orders",
    label: "Orders",
    path: "/admin/dashboard/insights/orders",
    summary: "Order desk",
  },
  {
    key: "dealers",
    label: "Dealers",
    path: "/admin/dashboard/insights/dealers",
    summary: "Account intelligence",
  },
  {
    key: "products",
    label: "Products",
    path: "/admin/dashboard/insights/products",
    summary: "Product movement",
  },
  {
    key: "dispatchers",
    label: "Dispatchers",
    path: "/admin/dashboard/insights/dispatchers",
    summary: "Lane performance",
  },
  {
    key: "routing",
    label: "Routing",
    path: "/admin/dashboard/insights/routing",
    summary: "Factory vs dispatcher",
  },
  {
    key: "reports",
    label: "Reports",
    path: "/admin/dashboard/insights/reports",
    summary: "Exports",
  },
];

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Approved" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL", label: "All statuses" },
];

const ROUTING_OPTIONS = [
  { value: "ALL", label: "All routing" },
  { value: "FACTORY", label: "Factory" },
  { value: "DISPATCHER_ALL", label: "All dispatcher-assigned" },
];

const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "custom", label: "Custom" },
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset) {
  if (preset === "all") return { from: "", to: "" };

  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  if (preset === "7d") from.setDate(now.getDate() - 6);
  else if (preset === "90d") from.setDate(now.getDate() - 89);
  else if (preset === "month") from.setDate(1);
  else if (preset === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  } else from.setDate(now.getDate() - 29);

  return { from: isoDate(from), to: isoDate(to) };
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function number(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function compactCurrency(value, currency = "NPR") {
  const amount = Number(value || 0);
  if (!amount) return "0";
  const compact = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: amount >= 100000 ? 1 : 0,
  }).format(amount);
  return `${currency} ${compact}`;
}

function formatTrendLabel(value) {
  const label = String(value || "");
  if (/^\d{4}-\d{2}$/.test(label)) {
    const date = new Date(`${label}-01T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const date = new Date(`${label}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  return label;
}

function sectionFromPath(pathname) {
  const section = INSIGHT_SECTIONS.find((item) => item.path === pathname);
  return section?.key || "home";
}

function downloadCsv(filename, rows = []) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadInsightsPdf({ data, section }) {
  if (!data) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = 42;

  const write = (text, x, yy, options = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size || 10);
    doc.setTextColor(...(options.color || [15, 23, 42]));
    doc.text(String(text), x, yy, { maxWidth: options.maxWidth || pageWidth - margin * 2 });
  };

  write("Meitu Paints Admin Insights", margin, y, { size: 18, bold: true });
  y += 22;
  write(`Section: ${section.label}`, margin, y, { size: 11, color: [100, 116, 139] });
  y += 16;
  write(`Filters: ${data.reports?.filterSummary?.period || "Selected period"} | ${data.reports?.filterSummary?.routing || "ALL"} | ${data.reports?.filterSummary?.status || "APPROVED"}`, margin, y, { size: 10, color: [100, 116, 139] });
  y += 30;

  const kpis = data.home?.kpis || {};
  const currency = data.meta?.currency || "NPR";
  [
    ["Approved revenue", money(kpis.approvedRevenue, currency)],
    ["Approved orders", number(kpis.approvedOrders)],
    ["Average order value", money(kpis.averageOrderValue, currency)],
    ["Active dealers", number(kpis.activeDealers)],
    ["Factory share", percent(kpis.factoryRevenueShare)],
    ["Dispatcher share", percent(kpis.dispatcherRevenueShare)],
    ["Revenue growth", percent(kpis.revenueGrowth)],
  ].forEach(([label, value], index) => {
    const x = margin + (index % 4) * 190;
    if (index === 4) y += 54;
    write(label, x, y, { size: 8, bold: true, color: [100, 116, 139] });
    write(value, x, y + 18, { size: 13, bold: true });
  });

  y += 82;
  write("Key signals", margin, y, { size: 13, bold: true });
  y += 20;
  (data.home?.signals || []).slice(0, 6).forEach((signal) => {
    write(`${signal.title}: ${signal.body}`, margin, y, { size: 10 });
    y += 16;
  });

  doc.save(`meitu-insights-${section.key}.pdf`);
}

function Panel({ children, className = "", style = {} }) {
  return (
    <section className={`insight-panel ${className}`} style={style}>
      {children}
    </section>
  );
}

function PanelHeader({ eyebrow, title, subtitle, action = null }) {
  return (
    <div className="insight-panel-head">
      <div>
        {eyebrow ? <div className="insight-eyebrow">{eyebrow}</div> : null}
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, helper, tone = "default" }) {
  return (
    <div className={`insight-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <em>{helper}</em> : null}
    </div>
  );
}

function BarList({ items = [], valueKey = "value", labelKey = "label", formatValue = number, empty = "No data" }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  if (!items.length) return <div className="insight-empty">{empty}</div>;

  return (
    <div className="insight-bars">
      {items.map((item) => (
        <div className="insight-bar-row" key={`${item[labelKey]}-${item[valueKey]}`}>
          <div className="insight-bar-top">
            <span>{item[labelKey]}</span>
            <strong>{formatValue(item[valueKey])}</strong>
          </div>
          <div className="insight-bar-track">
            <span style={{ width: `${Math.max(4, (Number(item[valueKey] || 0) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendStrip({ data = [], currency = "NPR" }) {
  if (!data.length) return <div className="insight-empty">No trend signal yet.</div>;
  const visible = data.slice(-18);
  const max = Math.max(1, ...visible.map((item) => Number(item.revenue || 0)));
  const scale = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    value: max * ratio,
  }));

  return (
    <div className="insight-trend-wrap">
      <div className="insight-trend-axis" aria-hidden="true">
        {scale.map((tick) => (
          <span key={tick.ratio}>{compactCurrency(tick.value, currency)}</span>
        ))}
      </div>
      <div className="insight-trend-chart">
        <div className="insight-trend-grid" aria-hidden="true">
          {scale.map((tick) => (
            <span key={tick.ratio} />
          ))}
        </div>
        <div className="insight-trend">
          {visible.map((point) => (
            <div className="insight-trend-point" key={point.label}>
              <span
                style={{
                  height: `${Math.max(8, (Number(point.revenue || 0) / max) * 100)}%`,
                }}
                title={`${point.label}: ${money(point.revenue, currency)}`}
              />
              <em>{formatTrendLabel(point.label)}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataTable({ columns, rows, empty = "No rows available." }) {
  if (!rows?.length) return <div className="insight-empty">{empty}</div>;

  return (
    <div className="insight-table-wrap">
      <table className="insight-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.dealerId || row.productKey || row.dispatcherId || `${row.label}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row, index) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignalList({ signals = [] }) {
  if (!signals.length) return <div className="insight-empty">No signals available yet.</div>;

  return (
    <div className="insight-signals">
      {signals.map((signal) => (
        <div className={`insight-signal ${signal.tone || "neutral"}`} key={signal.title}>
          <strong>{signal.title}</strong>
          <span>{signal.body}</span>
        </div>
      ))}
    </div>
  );
}

function WorkspaceNav({ active, onNavigate }) {
  return (
    <div className="insights-module-nav">
      {INSIGHT_SECTIONS.map((section) => (
        <button
          key={section.key}
          type="button"
          className={active === section.key ? "active" : ""}
          onClick={() => onNavigate(section.path)}
        >
          <strong>{section.label}</strong>
          <span>{section.summary}</span>
        </button>
      ))}
    </div>
  );
}

function FilterBar({ filters, setFilters, options, loading, onRefresh }) {
  const routingValue = filters.dispatcherId
    ? `DISPATCHER:${filters.dispatcherId}`
    : filters.routing;
  const dealerValue = filters.dealerId
    ? `DEALER:${filters.dealerId}`
    : filters.dealerState;
  const categories = Array.from(
    new Set([
      ...(filters.category !== "ALL" ? [filters.category] : []),
      ...(options.categories || []),
    ]),
  );
  const isAllTime = filters.preset === "all";

  function updatePreset(value) {
    if (value === "custom") {
      setFilters((current) => ({ ...current, preset: value }));
      return;
    }
    setFilters((current) => ({ ...current, preset: value, ...rangeForPreset(value) }));
  }

  function updateRouting(value) {
    if (value.startsWith("DISPATCHER:")) {
      setFilters((current) => ({
        ...current,
        routing: "DISPATCHER_ALL",
        dispatcherId: value.split(":")[1] || "",
      }));
      return;
    }
    setFilters((current) => ({ ...current, routing: value, dispatcherId: "" }));
  }

  function updateDealer(value) {
    if (value.startsWith("DEALER:")) {
      setFilters((current) => ({
        ...current,
        dealerId: value.split(":")[1] || "",
        dealerState: "ALL",
      }));
      return;
    }
    setFilters((current) => ({ ...current, dealerState: value, dealerId: "" }));
  }

  return (
    <Panel className="insights-filter-panel">
      <div className="insights-filter-grid">
        <label>
          <span>Range</span>
          <select value={filters.preset} onChange={(e) => updatePreset(e.target.value)}>
            {DATE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="date"
            value={filters.from}
            disabled={isAllTime}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                preset: "custom",
                from: e.target.value,
              }))
            }
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={filters.to}
            disabled={isAllTime}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                preset: "custom",
                to: e.target.value,
              }))
            }
          />
        </label>
        <label>
          <span>Routing</span>
          <select value={routingValue} onChange={(e) => updateRouting(e.target.value)}>
            {ROUTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {(options.dispatchers || []).map((dispatcher) => (
              <option key={dispatcher.id} value={`DISPATCHER:${dispatcher.id}`}>
                {dispatcher.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Dealer</span>
          <select value={dealerValue} onChange={(e) => updateDealer(e.target.value)}>
            <option value="ALL">All dealers</option>
            <option value="ACTIVE_ONLY">Active only</option>
            <option value="DORMANT_ONLY">Dormant only</option>
            {(options.dealers || []).map((dealer) => (
              <option key={dealer.id} value={`DEALER:${dealer.id}`}>
                {dealer.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((current) => ({ ...current, status: e.target.value }))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters((current) => ({ ...current, category: e.target.value }))
            }
          >
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </Panel>
  );
}

function HomeSection({ data, currency, onNavigate }) {
  const kpis = data.home?.kpis || {};
  const largest = kpis.largestOrder;
  const modules = INSIGHT_SECTIONS.filter((section) => section.key !== "home");

  return (
    <div className="insight-section">
      <div className="insight-kpi-strip">
        <Metric label="Approved Revenue" value={money(kpis.approvedRevenue, currency)} tone="accent" />
        <Metric label="Approved Orders" value={number(kpis.approvedOrders)} />
        <Metric label="Avg Order Value" value={money(kpis.averageOrderValue, currency)} />
        <Metric label="Active Dealers" value={number(kpis.activeDealers)} />
        <Metric label="Factory Share" value={percent(kpis.factoryRevenueShare)} />
        <Metric label="Dispatcher Share" value={percent(kpis.dispatcherRevenueShare)} />
        <Metric label="Largest Order" value={largest ? money(largest.total, currency) : money(0, currency)} helper={largest?.dealerName} />
        <Metric label="Revenue Growth" value={percent(kpis.revenueGrowth)} tone={Number(kpis.revenueGrowth || 0) >= 0 ? "good" : "risk"} />
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader
            eyebrow="Business pulse"
            title="Revenue and order activity"
            subtitle="Compact period trend, intentionally limited for the home view."
          />
          <TrendStrip data={data.home?.pulse || []} currency={currency} />
        </Panel>
        <Panel>
          <PanelHeader
            eyebrow="Signals"
            title="Executive intelligence"
            subtitle="High-signal notes from the selected filter set."
          />
          <SignalList signals={data.home?.signals || []} />
        </Panel>
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Routing snapshot" title="Factory vs dispatcher" />
          <BarList
            items={[
              { label: "Factory revenue", value: data.home?.routingSnapshot?.factoryApprovedRevenue || 0 },
              { label: "Dispatcher revenue", value: data.home?.routingSnapshot?.dispatcherApprovedRevenue || 0 },
            ]}
            valueKey="value"
            formatValue={(value) => money(value, currency)}
          />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Workspace" title="Drill into deeper intelligence" />
          <div className="insight-entry-grid">
            {modules.map((section) => (
              <button key={section.key} type="button" onClick={() => onNavigate(section.path)}>
                <strong>{section.label}</strong>
                <span>{section.summary}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OrdersSection({ data, currency }) {
  const summary = data.orders?.summary || {};
  const rankings = data.orders?.rankings || {};

  return (
    <div className="insight-section">
      <div className="insight-kpi-strip compact">
        <Metric label="Total Orders" value={number(summary.totalOrders)} />
        <Metric label="Approved" value={number(summary.approvedOrders)} tone="good" />
        <Metric label="Submitted" value={number(summary.submittedOrders)} />
        <Metric label="Rejected" value={number(summary.rejectedOrders)} tone="risk" />
        <Metric label="Archived" value={number(summary.archivedOrders)} />
        <Metric label="Approved Revenue" value={money(summary.totalApprovedRevenue, currency)} tone="accent" />
        <Metric label="Median Order" value={money(summary.medianOrderValue, currency)} />
        <Metric label="Approval Rate" value={percent(summary.approvalRate)} />
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Trend analysis" title="Revenue over time" />
          <TrendStrip data={data.orders?.trend || []} currency={currency} />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Distribution" title="Order value bands" />
          <BarList
            items={data.orders?.distribution?.valueBuckets || []}
            labelKey="label"
            valueKey="revenue"
            formatValue={(value) => money(value, currency)}
          />
        </Panel>
      </div>

      <div className="insight-three-col">
        <Panel>
          <PanelHeader eyebrow="Cadence" title="Orders by day" />
          <BarList items={data.orders?.distribution?.byDay || []} valueKey="count" />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Timing" title="Orders by time window" />
          <BarList items={data.orders?.distribution?.byTimeWindow || []} valueKey="count" />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Payment" title="Payment methods" />
          <BarList items={data.orders?.distribution?.byPaymentMethod || []} valueKey="revenue" formatValue={(value) => money(value, currency)} />
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Ranked intelligence" title="Largest approved orders" />
        <DataTable
          rows={rankings.largestOrders || []}
          columns={[
            { key: "orderNumber", label: "Order" },
            { key: "dealerName", label: "Dealer" },
            { key: "route", label: "Route" },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
            { key: "total", label: "Total", render: (row) => money(row.total, currency) },
          ]}
        />
      </Panel>
    </div>
  );
}

function DealersSection({ data, currency }) {
  const dealers = data.dealers || {};
  return (
    <div className="insight-section">
      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Leadership" title="Dealer revenue leaders" />
          <BarList
            items={(dealers.leadership?.topBySales || []).map((row) => ({
              label: row.dealerName,
              value: row.approvedSales,
            }))}
            formatValue={(value) => money(value, currency)}
          />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Segmentation" title="Activity states" />
          <BarList items={dealers.segmentation?.activity || []} valueKey="count" />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Comparison"
          title="Dealer intelligence table"
          subtitle="Sortable server-side intelligence can build from this shape later; the current table is ranked by approved sales."
        />
        <DataTable
          rows={(dealers.rows || []).slice(0, 40)}
          columns={[
            { key: "dealerName", label: "Dealer" },
            { key: "approvedSales", label: "Approved sales", render: (row) => money(row.approvedSales, currency) },
            { key: "approvedOrders", label: "Orders", render: (row) => number(row.approvedOrders) },
            { key: "averageOrderValue", label: "AOV", render: (row) => money(row.averageOrderValue, currency) },
            { key: "largestOrder", label: "Largest", render: (row) => money(row.largestOrder, currency) },
            { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity) },
            { key: "routingMode", label: "Route" },
            { key: "growthRate", label: "Growth", render: (row) => percent(row.growthRate) },
            { key: "activityState", label: "State" },
            { key: "healthScore", label: "Health", render: (row) => number(row.healthScore) },
          ]}
        />
      </Panel>

      <div className="insight-three-col">
        <Panel>
          <PanelHeader eyebrow="Revenue bands" title="Dealer tiers" />
          <BarList items={dealers.segmentation?.revenueBands || []} valueKey="count" />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Affinity" title="Top dealer categories" />
          <BarList
            items={(dealers.rows || [])
              .filter((row) => row.topCategory !== "None")
              .slice(0, 8)
              .map((row) => ({ label: `${row.dealerName}: ${row.topCategory}`, value: row.approvedSales }))}
            formatValue={(value) => money(value, currency)}
          />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Signals" title="Dealer concentration" />
          <SignalList
            signals={[
              {
                title: "Top 5 contribution",
                body: `${percent(dealers.signals?.topFiveRevenueShare)} of approved revenue is concentrated in the top five dealers.`,
                tone: Number(dealers.signals?.topFiveRevenueShare || 0) > 60 ? "watch" : "neutral",
              },
              {
                title: "Declining accounts",
                body: `${dealers.signals?.decliningDealers?.length || 0} dealers are declining by more than 20%.`,
                tone: "risk",
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function ProductsSection({ data, currency }) {
  const products = data.products || {};
  return (
    <div className="insight-section">
      <div className="insight-kpi-strip compact">
        <Metric label="Unique Products" value={number(products.summary?.uniqueProductsOrdered)} />
        <Metric label="Top Revenue Product" value={products.summary?.topProductByRevenue?.product || "None"} helper={money(products.summary?.topProductByRevenue?.revenue, currency)} tone="accent" />
        <Metric label="Top Quantity Product" value={products.summary?.topProductByQuantity?.product || "None"} helper={`${number(products.summary?.topProductByQuantity?.quantitySold)} units`} />
        <Metric label="Highest Growth" value={products.summary?.highestGrowthProduct?.product || "None"} helper={percent(products.summary?.highestGrowthProduct?.growthRate)} />
        <Metric label="Slow Mover" value={products.summary?.slowMovingProduct?.product || "None"} helper={money(products.summary?.slowMovingProduct?.revenue, currency)} tone="risk" />
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Revenue" title="Top products by revenue" />
          <BarList items={products.charts?.topProductsByRevenue || []} labelKey="product" valueKey="revenue" formatValue={(value) => money(value, currency)} />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Quantity" title="Top products by quantity" />
          <BarList items={products.charts?.topProductsByQuantity || []} labelKey="product" valueKey="quantitySold" />
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Ranking" title="Product performance table" />
        <DataTable
          rows={(products.ranking || []).slice(0, 50)}
          columns={[
            { key: "product", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "quantitySold", label: "Qty", render: (row) => number(row.quantitySold) },
            { key: "revenue", label: "Revenue", render: (row) => money(row.revenue, currency) },
            { key: "orderCount", label: "Orders", render: (row) => number(row.orderCount) },
            { key: "lastOrdered", label: "Last ordered", render: (row) => formatDate(row.lastOrdered) },
            { key: "topDealer", label: "Top dealer" },
          ]}
        />
      </Panel>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Category mix" title="Category revenue share" />
          <BarList items={products.categoryMix || []} labelKey="category" valueKey="revenue" formatValue={(value) => money(value, currency)} />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Signals" title="Concentration and slow movers" />
          <SignalList
            signals={[
              {
                title: "Concentrated products",
                body: `${products.concentratedProducts?.length || 0} products depend heavily on one dealer.`,
                tone: "watch",
              },
              {
                title: "Slow movers",
                body: `${products.slowMoving?.length || 0} products are low-revenue movers in this filter.`,
                tone: "neutral",
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function DispatchersSection({ data, currency }) {
  const dispatchers = data.dispatchers || {};
  const summary = dispatchers.summary || {};

  return (
    <div className="insight-section">
      <div className="insight-kpi-strip compact">
        <Metric label="Dispatcher Revenue" value={money(summary.dispatcherApprovedRevenue, currency)} tone="accent" />
        <Metric label="Dispatcher Orders" value={number(summary.dispatcherRoutedOrders)} />
        <Metric label="Avg Routed Order" value={money(summary.averageRoutedOrderValue, currency)} />
        <Metric label="Top Revenue Lane" value={summary.topDispatcherByRevenue?.dispatcherName || "None"} helper={money(summary.topDispatcherByRevenue?.approvedRevenue, currency)} />
        <Metric label="Top Order Count" value={summary.topDispatcherByOrderCount?.dispatcherName || "None"} helper={`${number(summary.topDispatcherByOrderCount?.routedOrders)} orders`} />
        <Metric label="Lowest Activity" value={summary.lowestActivityDispatcher?.dispatcherName || "None"} tone="risk" />
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Revenue" title="Revenue by dispatcher" />
          <BarList items={dispatchers.charts?.revenueByDispatcher || []} labelKey="dispatcherName" valueKey="approvedRevenue" formatValue={(value) => money(value, currency)} />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Order count" title="Orders by dispatcher" />
          <BarList items={dispatchers.charts?.ordersByDispatcher || []} labelKey="dispatcherName" valueKey="routedOrders" />
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Comparison" title="Dispatcher performance table" />
        <DataTable
          rows={dispatchers.rows || []}
          columns={[
            { key: "dispatcherName", label: "Dispatcher" },
            { key: "assignedDealerCount", label: "Dealers", render: (row) => number(row.assignedDealerCount) },
            { key: "approvedRevenue", label: "Revenue", render: (row) => money(row.approvedRevenue, currency) },
            { key: "routedOrders", label: "Orders", render: (row) => number(row.routedOrders) },
            { key: "approvalRate", label: "Approval", render: (row) => percent(row.approvalRate) },
            { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity) },
            { key: "largestOrder", label: "Biggest order", render: (row) => money(row.largestOrder, currency) },
            { key: "bestDealer", label: "Best dealer" },
          ]}
        />
      </Panel>
    </div>
  );
}

function RoutingSection({ data, currency }) {
  const routing = data.routing || {};
  const summary = routing.summary || {};
  return (
    <div className="insight-section">
      <div className="insight-kpi-strip compact">
        <Metric label="Factory Revenue" value={money(summary.factoryApprovedRevenue, currency)} />
        <Metric label="Dispatcher Revenue" value={money(summary.dispatcherApprovedRevenue, currency)} />
        <Metric label="Factory Orders" value={number(summary.factoryOrderCount)} />
        <Metric label="Dispatcher Orders" value={number(summary.dispatcherOrderCount)} />
        <Metric label="Factory AOV" value={money(summary.factoryAverageOrderValue, currency)} />
        <Metric label="Dispatcher AOV" value={money(summary.dispatcherAverageOrderValue, currency)} />
        <Metric label="Factory Approval" value={percent(summary.factoryApprovalRate)} />
        <Metric label="Dispatcher Approval" value={percent(summary.dispatcherApprovalRate)} />
      </div>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Comparison" title="Revenue by route" />
          <BarList
            items={[
              { label: "Factory", value: summary.factoryApprovedRevenue || 0 },
              { label: "Dispatcher", value: summary.dispatcherApprovedRevenue || 0 },
            ]}
            formatValue={(value) => money(value, currency)}
          />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Efficiency" title="Routing intelligence notes" />
          <SignalList signals={(routing.notes || []).map((body, index) => ({ title: `Signal ${index + 1}`, body }))} />
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Dealer routing" title="Routing by dealer" />
        <DataTable
          rows={(routing.byDealer || []).slice(0, 50)}
          columns={[
            { key: "dealerName", label: "Dealer" },
            { key: "route", label: "Route" },
            { key: "sales", label: "Sales", render: (row) => money(row.sales, currency) },
            { key: "orders", label: "Orders", render: (row) => number(row.orders) },
            { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity) },
            { key: "suitability", label: "Suitability" },
          ]}
        />
      </Panel>
    </div>
  );
}

function ReportsSection({ data, currency, activeSection }) {
  const reportRows = {
    home: [
      { Metric: "Approved revenue", Value: money(data.home?.kpis?.approvedRevenue, currency) },
      { Metric: "Approved orders", Value: number(data.home?.kpis?.approvedOrders) },
      { Metric: "Revenue growth", Value: percent(data.home?.kpis?.revenueGrowth) },
    ],
    orders: (data.orders?.rankings?.largestOrders || []).map((row) => ({
      Order: row.orderNumber,
      Dealer: row.dealerName,
      Route: row.route,
      Total: money(row.total, currency),
      Date: formatDate(row.createdAt),
    })),
    dealers: (data.dealers?.rows || []).map((row) => ({
      Dealer: row.dealerName,
      Sales: money(row.approvedSales, currency),
      Orders: row.approvedOrders,
      AOV: money(row.averageOrderValue, currency),
      Route: row.routingMode,
      Health: row.healthScore,
    })),
    products: (data.products?.ranking || []).map((row) => ({
      Product: row.product,
      SKU: row.sku,
      Category: row.category,
      Quantity: row.quantitySold,
      Revenue: money(row.revenue, currency),
      "Top dealer": row.topDealer,
    })),
    dispatchers: (data.dispatchers?.rows || []).map((row) => ({
      Dispatcher: row.dispatcherName,
      Dealers: row.assignedDealerCount,
      Revenue: money(row.approvedRevenue, currency),
      Orders: row.routedOrders,
      Approval: percent(row.approvalRate),
    })),
    routing: (data.routing?.byDealer || []).map((row) => ({
      Dealer: row.dealerName,
      Route: row.route,
      Sales: money(row.sales, currency),
      Orders: row.orders,
      Suitability: row.suitability,
    })),
  };

  return (
    <div className="insight-section">
      <Panel>
        <PanelHeader
          eyebrow="Reports"
          title="Saved report types"
          subtitle="Operational report templates for the current filter context."
        />
        <div className="report-card-grid">
          {(data.reports?.reportTypes || []).map((report) => (
            <div className="report-card" key={report}>
              <strong>{report}</strong>
              <span>Uses the current Insights filter context.</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="insight-two-col">
        <Panel>
          <PanelHeader eyebrow="Export tools" title="Current filtered view" />
          <div className="report-actions">
            <button type="button" onClick={() => downloadCsv(`meitu-insights-${activeSection}.csv`, reportRows[activeSection] || reportRows.home)}>
              Export CSV
            </button>
            <button type="button" onClick={() => downloadInsightsPdf({ data, section: INSIGHT_SECTIONS.find((item) => item.key === activeSection) || INSIGHT_SECTIONS[0] })}>
              Export PDF Summary
            </button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Filter summary" title="Report context" />
          <div className="filter-summary">
            {Object.entries(data.reports?.filterSummary || {}).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Comparison reports" title="Available comparisons" />
        <div className="report-card-grid compact">
          {["Current period vs previous period", "Factory vs dispatcher", "Dealer vs dealer", "Dispatcher vs dispatcher"].map((item) => (
            <div className="report-card" key={item}>
              <strong>{item}</strong>
              <span>Prepared from the same intelligence model.</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export default function AdminInsightsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = sectionFromPath(location.pathname);
  const initialRange = useMemo(() => rangeForPreset("30d"), []);
  const [filters, setFilters] = useState({
    preset: "30d",
    from: initialRange.from,
    to: initialRange.to,
    routing: "ALL",
    dispatcherId: "",
    dealerId: "",
    dealerState: "ALL",
    status: "APPROVED",
    category: "ALL",
  });
  const queryParams = useMemo(() => {
    const params = {
      range: filters.preset,
      status: filters.status,
      routing: filters.routing,
      dealerState: filters.dealerState,
    };
    if (filters.preset !== "all") {
      params.from = filters.from;
      params.to = filters.to;
    }
    if (filters.dispatcherId) params.dispatcherId = filters.dispatcherId;
    if (filters.dealerId) params.dealerId = filters.dealerId;
    if (filters.category !== "ALL") params.category = filters.category;
    return params;
  }, [filters]);

  const {
    data = null,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetAdminInsightsQuery(queryParams);
  const loading = isLoading && !data;
  const error = queryError?.message || "";

  function loadData() {
    refetch();
  }

  const currency = data?.meta?.currency || "NPR";
  const section = INSIGHT_SECTIONS.find((item) => item.key === activeSection) || INSIGHT_SECTIONS[0];

  function renderSection() {
    if (!data) return null;
    if (activeSection === "orders") return <OrdersSection data={data} currency={currency} />;
    if (activeSection === "dealers") return <DealersSection data={data} currency={currency} />;
    if (activeSection === "products") return <ProductsSection data={data} currency={currency} />;
    if (activeSection === "dispatchers") return <DispatchersSection data={data} currency={currency} />;
    if (activeSection === "routing") return <RoutingSection data={data} currency={currency} />;
    if (activeSection === "reports") return <ReportsSection data={data} currency={currency} activeSection={activeSection} />;
    return <HomeSection data={data} currency={currency} onNavigate={navigate} />;
  }

  return (
    <div className="insights-workspace">
      <Panel className="insights-hero">
        <div>
          <div className="insight-eyebrow">Admin Intelligence</div>
          <h2>{section.label === "Home" ? "Insights" : `${section.label} Intelligence`}</h2>
          <p>
            Minimal first layer, deeper operational intelligence by module.
            Filters apply across the Insights workspace.
          </p>
        </div>
        <div className="insights-generated">
          <span>Generated</span>
          <strong>{data?.meta?.generatedAt ? new Date(data.meta.generatedAt).toLocaleString() : "Pending"}</strong>
        </div>
      </Panel>

      <WorkspaceNav active={activeSection} onNavigate={navigate} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        options={data?.options || {}}
        loading={isFetching}
        onRefresh={loadData}
      />

      {error ? <div className="insights-error">{error}</div> : null}
      {loading && !data ? (
        <div className="insights-loading">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : (
        renderSection()
      )}

      <style>{`
        .insights-workspace{ display:grid; gap:14px; color:#0f172a; }
        .insight-panel{ border:1px solid rgba(15,23,42,.08); background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.04); border-radius:16px; overflow:hidden; }
        .insights-hero{ display:flex; justify-content:space-between; gap:18px; align-items:flex-end; padding:18px 20px; }
        .insight-eyebrow{ font-size:11px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:rgba(15,23,42,.45); }
        .insights-hero h2{ margin:7px 0 0; font-size:28px; line-height:1.05; font-weight:950; letter-spacing:-.03em; }
        .insights-hero p{ margin:8px 0 0; max-width:760px; color:rgba(15,23,42,.58); font-size:14px; line-height:1.55; font-weight:750; }
        .insights-generated{ min-width:180px; display:grid; justify-items:end; gap:4px; font-size:12px; color:rgba(15,23,42,.56); font-weight:800; }
        .insights-generated strong{ color:#0f172a; font-size:13px; }
        .insights-module-nav{ display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:1px; border:1px solid rgba(15,23,42,.08); background:rgba(15,23,42,.08); border-radius:16px; overflow:hidden; }
        .insights-module-nav button{ min-width:0; border:0; background:#fff; padding:13px 14px; display:grid; gap:4px; text-align:left; cursor:pointer; color:#0f172a; }
        .insights-module-nav button:hover{ background:#f8fafc; }
        .insights-module-nav button.active{ background:rgba(180,35,24,.075); color:#b42318; }
        .insights-module-nav strong{ font-size:13px; font-weight:950; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .insights-module-nav span{ font-size:11px; line-height:1.2; font-weight:800; color:rgba(15,23,42,.52); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .insights-filter-panel{ padding:14px; }
        .insights-filter-grid{ display:grid; grid-template-columns:1.1fr repeat(6, minmax(118px,1fr)) auto; gap:10px; align-items:end; }
        .insights-filter-grid label{ display:grid; gap:5px; min-width:0; }
        .insights-filter-grid label span{ font-size:10px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .insights-filter-grid select,
        .insights-filter-grid input,
        .insights-filter-grid button,
        .report-actions button{ min-height:38px; border:1px solid rgba(15,23,42,.1); border-radius:10px; background:#fff; color:#0f172a; font-size:12px; font-weight:900; padding:0 10px; }
        .insights-filter-grid button,
        .report-actions button{ background:#111827; color:#fff; cursor:pointer; border-color:#111827; }
        .insights-filter-grid button:disabled{ opacity:.62; cursor:not-allowed; }
        .insights-error{ padding:13px 15px; border-radius:14px; border:1px solid rgba(180,35,24,.16); background:rgba(180,35,24,.07); color:#b42318; font-weight:850; }
        .insights-loading{ display:grid; gap:10px; }
        .insights-loading span{ height:72px; border-radius:14px; background:linear-gradient(90deg,#f1f5f9,#fff,#f1f5f9); border:1px solid rgba(15,23,42,.06); }
        .insight-section{ display:grid; gap:14px; }
        .insight-kpi-strip{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
        .insight-kpi-strip.compact{ grid-template-columns:repeat(4,minmax(0,1fr)); }
        .insight-metric{ min-width:0; border:1px solid rgba(15,23,42,.08); background:#fff; border-radius:14px; padding:13px 14px; display:grid; gap:6px; }
        .insight-metric span{ font-size:10px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; color:rgba(15,23,42,.46); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .insight-metric strong{ min-width:0; font-size:19px; line-height:1.1; font-weight:950; letter-spacing:-.03em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .insight-metric em{ font-style:normal; font-size:11px; line-height:1.3; font-weight:800; color:rgba(15,23,42,.54); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .insight-metric.accent{ background:rgba(180,35,24,.06); border-color:rgba(180,35,24,.14); }
        .insight-metric.accent strong{ color:#b42318; }
        .insight-metric.good strong{ color:#047857; }
        .insight-metric.risk strong{ color:#b42318; }
        .insight-two-col{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
        .insight-three-col{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .insight-panel-head{ padding:15px 16px 12px; border-bottom:1px solid rgba(15,23,42,.07); display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
        .insight-panel-head h3{ margin:5px 0 0; font-size:17px; font-weight:950; letter-spacing:-.02em; }
        .insight-panel-head p{ margin:5px 0 0; max-width:720px; font-size:12px; line-height:1.45; color:rgba(15,23,42,.55); font-weight:750; }
        .insight-bars{ display:grid; gap:11px; padding:15px 16px 17px; }
        .insight-bar-row{ display:grid; gap:6px; }
        .insight-bar-top{ display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:12px; font-weight:850; color:#0f172a; }
        .insight-bar-top span{ min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .insight-bar-top strong{ flex:0 0 auto; color:rgba(15,23,42,.62); font-size:11px; }
        .insight-bar-track{ height:7px; border-radius:999px; background:rgba(15,23,42,.06); overflow:hidden; }
        .insight-bar-track span{ display:block; height:100%; border-radius:999px; background:#b42318; }
        .insight-trend-wrap{ height:240px; display:grid; grid-template-columns:72px minmax(0,1fr); gap:10px; padding:18px 16px 12px; }
        .insight-trend-axis{ display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; padding:0 0 25px; font-size:10px; line-height:1; font-weight:900; color:rgba(15,23,42,.48); font-variant-numeric:tabular-nums; }
        .insight-trend-chart{ position:relative; min-width:0; overflow:hidden; }
        .insight-trend-grid{ position:absolute; inset:0 0 25px; display:flex; flex-direction:column; justify-content:space-between; pointer-events:none; }
        .insight-trend-grid span{ display:block; border-top:1px solid rgba(15,23,42,.075); }
        .insight-trend{ position:relative; z-index:1; height:100%; display:flex; align-items:end; gap:6px; padding:0 0 0; }
        .insight-trend-point{ flex:1; min-width:28px; height:100%; display:grid; grid-template-rows:1fr 21px; gap:4px; align-items:end; justify-items:center; }
        .insight-trend-point span{ width:100%; border-radius:8px 8px 2px 2px; background:linear-gradient(180deg,#b42318,#ef4444); }
        .insight-trend-point em{ width:100%; min-width:0; font-style:normal; font-size:10px; line-height:1.15; font-weight:850; color:rgba(15,23,42,.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center; }
        .insight-signals{ display:grid; gap:10px; padding:15px 16px; }
        .insight-signal{ border-left:3px solid rgba(15,23,42,.2); background:#f8fafc; border-radius:0 12px 12px 0; padding:11px 12px; display:grid; gap:4px; }
        .insight-signal.positive{ border-left-color:#047857; background:rgba(4,120,87,.06); }
        .insight-signal.risk{ border-left-color:#b42318; background:rgba(180,35,24,.06); }
        .insight-signal.watch{ border-left-color:#b45309; background:rgba(180,83,9,.06); }
        .insight-signal strong{ font-size:12px; font-weight:950; }
        .insight-signal span{ font-size:12px; line-height:1.45; font-weight:750; color:rgba(15,23,42,.58); }
        .insight-entry-grid,
        .report-card-grid{ padding:15px 16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .report-card-grid.compact{ grid-template-columns:repeat(4,minmax(0,1fr)); }
        .insight-entry-grid button,
        .report-card{ min-width:0; border:1px solid rgba(15,23,42,.08); background:#fff; border-radius:12px; padding:13px; text-align:left; display:grid; gap:5px; }
        .insight-entry-grid button{ cursor:pointer; }
        .insight-entry-grid button:hover{ border-color:rgba(180,35,24,.28); background:rgba(180,35,24,.035); }
        .insight-entry-grid strong,
        .report-card strong{ font-size:13px; font-weight:950; }
        .insight-entry-grid span,
        .report-card span{ font-size:12px; line-height:1.4; color:rgba(15,23,42,.56); font-weight:750; }
        .insight-table-wrap{ overflow:auto; }
        .insight-table{ width:100%; border-collapse:collapse; min-width:850px; }
        .insight-table th{ position:sticky; top:0; z-index:1; background:#f8fafc; color:rgba(15,23,42,.55); font-size:10px; letter-spacing:.08em; text-transform:uppercase; text-align:left; padding:11px 12px; border-bottom:1px solid rgba(15,23,42,.08); }
        .insight-table td{ padding:12px; border-bottom:1px solid rgba(15,23,42,.06); font-size:12px; font-weight:800; color:#0f172a; white-space:nowrap; }
        .insight-empty{ padding:16px; font-size:12px; color:rgba(15,23,42,.55); font-weight:800; }
        .report-actions{ padding:15px 16px; display:flex; gap:10px; flex-wrap:wrap; }
        .filter-summary{ padding:15px 16px; display:grid; gap:10px; }
        .filter-summary div{ display:flex; justify-content:space-between; gap:12px; padding-bottom:9px; border-bottom:1px solid rgba(15,23,42,.06); }
        .filter-summary span{ color:rgba(15,23,42,.52); font-size:12px; font-weight:850; text-transform:capitalize; }
        .filter-summary strong{ font-size:12px; font-weight:950; text-align:right; }
        @media (max-width:1220px){
          .insights-module-nav{ grid-template-columns:repeat(4,minmax(0,1fr)); }
          .insights-filter-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); }
          .insight-kpi-strip,
          .insight-kpi-strip.compact{ grid-template-columns:repeat(2,minmax(0,1fr)); }
          .insight-three-col{ grid-template-columns:1fr; }
          .report-card-grid.compact{ grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        @media (max-width:760px){
          .insights-hero{ display:grid; align-items:start; }
          .insights-generated{ justify-items:start; }
          .insights-module-nav,
          .insights-filter-grid,
          .insight-two-col,
          .insight-kpi-strip,
          .insight-kpi-strip.compact,
          .insight-entry-grid,
          .report-card-grid,
          .report-card-grid.compact{ grid-template-columns:1fr; }
          .insights-filter-grid button{ width:100%; }
          .insight-trend-wrap{ height:210px; grid-template-columns:62px minmax(0,1fr); padding:14px 12px 10px; }
          .insight-trend-chart{ overflow-x:auto; }
          .insight-trend{ min-width:520px; }
          .insight-trend-point{ min-width:28px; }
        }
      `}</style>
    </div>
  );
}
