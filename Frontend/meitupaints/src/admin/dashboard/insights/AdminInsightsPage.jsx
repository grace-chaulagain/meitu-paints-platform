import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetAdminInsightsQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { formatDate, money, number, percent, rangeForPreset } from "./insightsFormatting.js";
import {
  InsightTable,
  InsightsFilterBar,
  KpiTile,
  RankedBarList,
  SignalList,
  TrendChart,
} from "./InsightsPrimitives.jsx";
import {
  buildComparisonRows,
  buildReportRows,
  downloadCsv,
  downloadInsightsPdf,
} from "./insightsExport.js";

const INSIGHT_SECTIONS = [
  { key: "home", label: "Home", path: "/admin/dashboard/insights", summary: "Executive pulse", icon: "overview" },
  { key: "orders", label: "Orders", path: "/admin/dashboard/insights/orders", summary: "Order desk", icon: "orders" },
  { key: "dealers", label: "Dealers", path: "/admin/dashboard/insights/dealers", summary: "Account intelligence", icon: "store" },
  { key: "products", label: "Products", path: "/admin/dashboard/insights/products", summary: "Product movement", icon: "package" },
  { key: "dispatchers", label: "Dispatchers", path: "/admin/dashboard/insights/dispatchers", summary: "Lane performance", icon: "handshake" },
  { key: "routing", label: "Routing", path: "/admin/dashboard/insights/routing", summary: "Factory vs dispatcher", icon: "truck" },
  { key: "reports", label: "Reports", path: "/admin/dashboard/insights/reports", summary: "Exports", icon: "invoice" },
];

const REPORT_TYPE_SECTION = {
  "Executive Sales Summary": "home",
  "Dealer Ranking Report": "dealers",
  "Product Performance Report": "products",
  "Routing Performance Report": "routing",
  "Dispatcher Performance Report": "dispatchers",
  "Dormant Dealer Report": "dormant-dealers",
};

function sectionFromPath(pathname) {
  const section = INSIGHT_SECTIONS.find((item) => item.path === pathname);
  return section?.key || "home";
}

function twoColStyle() {
  return { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 };
}

function threeColStyle() {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 };
}

function kpiRowStyle() {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 };
}

function PanelHead({ eyebrow, icon, title, action }) {
  return (
    <div style={{ padding: "18px 18px 4px" }}>
      <SectionHeader eyebrow={eyebrow} icon={icon} title={title} size="small" action={action} />
    </div>
  );
}

function reportCardStyle() {
  return {
    textAlign: "left",
    border: "none",
    borderRadius: 14,
    background: "var(--color-fog, #f5f5f7)",
    padding: "13px 14px",
    cursor: "pointer",
    display: "grid",
    gap: 4,
  };
}

// ----------------------------------------------------------------------
// Sections
// ----------------------------------------------------------------------

function HomeSection({ data, currency, onNavigate }) {
  const kpis = data.home?.kpis || {};
  const modules = INSIGHT_SECTIONS.filter((section) => section.key !== "home");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="invoice" label="Approved Revenue" value={money(kpis.approvedRevenue, currency)} tone="accent" />
        <KpiTile icon="orders" label="Approved Orders" value={number(kpis.approvedOrders)} />
        <KpiTile icon="chart" label="Avg Order Value" value={money(kpis.averageOrderValue, currency)} />
        <KpiTile icon="store" label="Active Dealers" value={number(kpis.activeDealers)} />
        <KpiTile
          icon="trend"
          label="Revenue Growth"
          value={percent(kpis.revenueGrowth)}
          direction={Number(kpis.revenueGrowth || 0) >= 0 ? "up" : "down"}
        />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Business pulse" icon="chart" title="Revenue over time" />
          <TrendChart data={data.home?.pulse || []} currency={currency} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Signals" icon="warning" title="Executive intelligence" />
          <SignalList signals={data.home?.signals || []} />
        </Surface>
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Routing snapshot" icon="truck" title="Factory vs dispatcher" />
          <RankedBarList
            items={[
              { label: "Factory revenue", value: data.home?.routingSnapshot?.factoryApprovedRevenue || 0 },
              { label: "Dispatcher revenue", value: data.home?.routingSnapshot?.dispatcherApprovedRevenue || 0 },
            ]}
            formatValue={(value) => money(value, currency)}
          />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Workspace" icon="list" title="Drill into deeper intelligence" />
          <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 8 }}>
            {modules.map((section) => (
              <button key={section.key} type="button" onClick={() => onNavigate(section.path)} style={reportCardStyle()}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                  <DashboardIcon name={section.icon} size={13} strokeWidth={1.9} />
                  {section.label}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{section.summary}</span>
              </button>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function OrdersSection({ data, currency }) {
  const summary = data.orders?.summary || {};
  const rankings = data.orders?.rankings || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="orders" label="Total Orders" value={number(summary.totalOrders)} />
        <KpiTile icon="checkmark" label="Approved" value={number(summary.approvedOrders)} tone="accent" />
        <KpiTile icon="invoice" label="Approved Revenue" value={money(summary.totalApprovedRevenue, currency)} tone="accent" />
        <KpiTile icon="chart" label="Approval Rate" value={percent(summary.approvalRate)} />
        <KpiTile icon="list" label="Median Order" value={money(summary.medianOrderValue, currency)} />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Trend analysis" icon="chart" title="Revenue over time" />
          <TrendChart data={data.orders?.trend || []} currency={currency} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Distribution" icon="list" title="Order value bands" />
          <RankedBarList items={data.orders?.distribution?.valueBuckets || []} labelKey="label" valueKey="revenue" formatValue={(v) => money(v, currency)} />
        </Surface>
      </div>

      <div style={threeColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Cadence" icon="calendar" title="Orders by day" />
          <RankedBarList items={data.orders?.distribution?.byDay || []} valueKey="count" formatValue={number} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Timing" icon="history" title="Orders by time window" />
          <RankedBarList items={data.orders?.distribution?.byTimeWindow || []} valueKey="count" formatValue={number} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Payment" icon="invoice" title="Payment methods" />
          <RankedBarList items={data.orders?.distribution?.byPaymentMethod || []} valueKey="revenue" formatValue={(v) => money(v, currency)} />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Ranked intelligence" icon="list" title="Largest approved orders" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable
            rows={rankings.largestOrders || []}
            columns={[
              { key: "orderNumber", label: "Order" },
              { key: "dealerName", label: "Dealer" },
              { key: "route", label: "Route" },
              { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
              { key: "total", label: "Total", render: (row) => money(row.total, currency) },
            ]}
          />
        </div>
      </Surface>
    </div>
  );
}

function DealersSection({ data, currency }) {
  const dealers = data.dealers || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Leadership" icon="store" title="Dealer revenue leaders" />
          <RankedBarList
            items={(dealers.leadership?.topBySales || []).map((row) => ({ label: row.dealerName, value: row.approvedSales }))}
            formatValue={(v) => money(v, currency)}
          />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Segmentation" icon="chart" title="Activity states" />
          <RankedBarList items={dealers.segmentation?.activity || []} valueKey="count" formatValue={number} />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Comparison" icon="list" title="Dealer intelligence table" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable
            rows={dealers.rows || []}
            columns={[
              { key: "dealerName", label: "Dealer" },
              { key: "approvedSales", label: "Sales", render: (row) => money(row.approvedSales, currency) },
              { key: "approvedOrders", label: "Orders", render: (row) => number(row.approvedOrders) },
              { key: "averageOrderValue", label: "AOV", render: (row) => money(row.averageOrderValue, currency) },
              { key: "largestOrder", label: "Largest", render: (row) => money(row.largestOrder, currency) },
              { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity), sortValue: (row) => new Date(row.lastActivity || 0).getTime() },
              { key: "routingMode", label: "Route" },
              { key: "growthRate", label: "Growth", render: (row) => percent(row.growthRate) },
              { key: "activityState", label: "State" },
              { key: "healthScore", label: "Health", render: (row) => number(row.healthScore) },
            ]}
          />
        </div>
      </Surface>

      <div style={threeColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Revenue bands" icon="chart" title="Dealer tiers" />
          <RankedBarList items={dealers.segmentation?.revenueBands || []} valueKey="count" formatValue={number} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Affinity" icon="package" title="Top dealer categories" />
          <RankedBarList
            items={(dealers.rows || [])
              .filter((row) => row.topCategory !== "None")
              .slice(0, 8)
              .map((row) => ({ label: `${row.dealerName}: ${row.topCategory}`, value: row.approvedSales }))}
            formatValue={(v) => money(v, currency)}
          />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Signals" icon="warning" title="Dealer concentration" />
          <SignalList
            signals={[
              {
                title: "Top 5 contribution",
                body: `${percent(dealers.signals?.topFiveRevenueShare)} of approved revenue is concentrated in the top five dealers.`,
                tone: Number(dealers.signals?.topFiveRevenueShare || 0) > 60 ? "watch" : "positive",
              },
              {
                title: "Declining accounts",
                body: `${dealers.signals?.decliningDealers?.length || 0} dealers are declining by more than 20%.`,
                tone: "risk",
              },
            ]}
          />
        </Surface>
      </div>
    </div>
  );
}

function ProductsSection({ data, currency }) {
  const products = data.products || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="package" label="Unique Products" value={number(products.summary?.uniqueProductsOrdered)} />
        <KpiTile
          icon="invoice"
          label="Top Revenue Product"
          value={products.summary?.topProductByRevenue?.product || "None"}
          helper={money(products.summary?.topProductByRevenue?.revenue, currency)}
          tone="accent"
        />
        <KpiTile
          icon="trend"
          label="Highest Growth"
          value={products.summary?.highestGrowthProduct?.product || "None"}
          helper={percent(products.summary?.highestGrowthProduct?.growthRate)}
          direction="up"
        />
        <KpiTile
          icon="warning"
          label="Slow Mover"
          value={products.summary?.slowMovingProduct?.product || "None"}
          helper={money(products.summary?.slowMovingProduct?.revenue, currency)}
        />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Revenue" icon="invoice" title="Top products by revenue" />
          <RankedBarList items={products.charts?.topProductsByRevenue || []} labelKey="product" valueKey="revenue" formatValue={(v) => money(v, currency)} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Quantity" icon="package" title="Top products by quantity" />
          <RankedBarList items={products.charts?.topProductsByQuantity || []} labelKey="product" valueKey="quantitySold" formatValue={number} />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Ranking" icon="list" title="Product performance table" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable
            rows={products.ranking || []}
            columns={[
              { key: "product", label: "Product" },
              { key: "sku", label: "SKU" },
              { key: "category", label: "Category" },
              { key: "quantitySold", label: "Qty", render: (row) => number(row.quantitySold) },
              { key: "revenue", label: "Revenue", render: (row) => money(row.revenue, currency) },
              { key: "orderCount", label: "Orders", render: (row) => number(row.orderCount) },
              { key: "lastOrdered", label: "Last ordered", render: (row) => formatDate(row.lastOrdered), sortValue: (row) => new Date(row.lastOrdered || 0).getTime() },
              { key: "topDealer", label: "Top dealer" },
            ]}
          />
        </div>
      </Surface>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Category mix" icon="chart" title="Category revenue share" />
          <RankedBarList items={products.categoryMix || []} labelKey="category" valueKey="revenue" formatValue={(v) => money(v, currency)} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Signals" icon="warning" title="Concentration and slow movers" />
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
        </Surface>
      </div>
    </div>
  );
}

function DispatchersSection({ data, currency }) {
  const dispatchers = data.dispatchers || {};
  const summary = dispatchers.summary || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="invoice" label="Dispatcher Revenue" value={money(summary.dispatcherApprovedRevenue, currency)} tone="accent" />
        <KpiTile icon="orders" label="Dispatcher Orders" value={number(summary.dispatcherRoutedOrders)} />
        <KpiTile icon="chart" label="Avg Routed Order" value={money(summary.averageRoutedOrderValue, currency)} />
        <KpiTile
          icon="handshake"
          label="Top Revenue Lane"
          value={summary.topDispatcherByRevenue?.dispatcherName || "None"}
          helper={money(summary.topDispatcherByRevenue?.approvedRevenue, currency)}
        />
        <KpiTile icon="warning" label="Lowest Activity" value={summary.lowestActivityDispatcher?.dispatcherName || "None"} />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Revenue" icon="invoice" title="Revenue by dispatcher" />
          <RankedBarList items={dispatchers.charts?.revenueByDispatcher || []} labelKey="dispatcherName" valueKey="approvedRevenue" formatValue={(v) => money(v, currency)} />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Order count" icon="orders" title="Orders by dispatcher" />
          <RankedBarList items={dispatchers.charts?.ordersByDispatcher || []} labelKey="dispatcherName" valueKey="routedOrders" formatValue={number} />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Comparison" icon="list" title="Dispatcher performance table" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable
            rows={dispatchers.rows || []}
            columns={[
              { key: "dispatcherName", label: "Dispatcher" },
              { key: "assignedDealerCount", label: "Dealers", render: (row) => number(row.assignedDealerCount) },
              { key: "approvedRevenue", label: "Revenue", render: (row) => money(row.approvedRevenue, currency) },
              { key: "routedOrders", label: "Orders", render: (row) => number(row.routedOrders) },
              { key: "approvalRate", label: "Approval", render: (row) => percent(row.approvalRate) },
              { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity), sortValue: (row) => new Date(row.lastActivity || 0).getTime() },
              { key: "largestOrder", label: "Biggest order", render: (row) => money(row.largestOrder, currency) },
              { key: "bestDealer", label: "Best dealer" },
            ]}
          />
        </div>
      </Surface>
    </div>
  );
}

function RoutingSection({ data, currency }) {
  const routing = data.routing || {};
  const summary = routing.summary || {};
  const noteLabels = ["Revenue balance", "Value efficiency", "Lane risk"];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={kpiRowStyle()}>
        <KpiTile icon="invoice" label="Factory Revenue" value={money(summary.factoryApprovedRevenue, currency)} />
        <KpiTile icon="invoice" label="Dispatcher Revenue" value={money(summary.dispatcherApprovedRevenue, currency)} />
        <KpiTile icon="orders" label="Factory Orders" value={number(summary.factoryOrderCount)} />
        <KpiTile icon="orders" label="Dispatcher Orders" value={number(summary.dispatcherOrderCount)} />
        <KpiTile icon="chart" label="Factory AOV" value={money(summary.factoryAverageOrderValue, currency)} />
        <KpiTile icon="chart" label="Dispatcher AOV" value={money(summary.dispatcherAverageOrderValue, currency)} />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Comparison" icon="truck" title="Revenue by route" />
          <RankedBarList
            items={[
              { label: "Factory", value: summary.factoryApprovedRevenue || 0 },
              { label: "Dispatcher", value: summary.dispatcherApprovedRevenue || 0 },
            ]}
            formatValue={(value) => money(value, currency)}
          />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Approval" icon="checkmark" title="Approval rate by route" />
          <RankedBarList
            items={[
              { label: "Factory", value: summary.factoryApprovalRate || 0 },
              { label: "Dispatcher", value: summary.dispatcherApprovalRate || 0 },
            ]}
            formatValue={percent}
          />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Efficiency" icon="chart" title="Routing intelligence notes" />
        <SignalList signals={(routing.notes || []).map((body, index) => ({ title: noteLabels[index] || `Signal ${index + 1}`, body }))} />
      </Surface>

      <Surface padding={0}>
        <PanelHead eyebrow="Dealer routing" icon="store" title="Routing by dealer" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable
            rows={routing.byDealer || []}
            columns={[
              { key: "dealerName", label: "Dealer" },
              { key: "route", label: "Route" },
              { key: "sales", label: "Sales", render: (row) => money(row.sales, currency) },
              { key: "orders", label: "Orders", render: (row) => number(row.orders) },
              { key: "lastActivity", label: "Last activity", render: (row) => formatDate(row.lastActivity), sortValue: (row) => new Date(row.lastActivity || 0).getTime() },
              { key: "suitability", label: "Suitability" },
            ]}
          />
        </div>
      </Surface>
    </div>
  );
}

function ReportsSection({ data, currency, exporting, onExportSection, onExportReportType, onExportComparison }) {
  const activePreviewRows = buildReportRows("home", data, currency);
  const previewColumns = activePreviewRows.length
    ? Object.keys(activePreviewRows[0]).map((key) => ({ key, label: key }))
    : [];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Surface padding={0}>
        <PanelHead eyebrow="Reports" icon="invoice" title="Saved report types" />
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10 }}>
          {(data.reports?.reportTypes || []).map((report) => (
            <button
              key={report}
              type="button"
              disabled={exporting}
              onClick={() => onExportReportType(report)}
              style={reportCardStyle()}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                <DashboardIcon name="download" size={13} strokeWidth={1.9} />
                {report}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Downloads this report as CSV
              </span>
            </button>
          ))}
        </div>
      </Surface>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Export tools" icon="download" title="Current filtered view" />
          <div style={{ padding: "0 18px 18px", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PrimaryButton icon="download" onClick={() => onExportSection("csv")} disabled={exporting}>
              Export CSV
            </PrimaryButton>
            <GhostButton icon="invoice" onClick={() => onExportSection("pdf")} disabled={exporting}>
              Export PDF Summary
            </GhostButton>
          </div>
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Filter summary" icon="filter" title="Report context" />
          <div style={{ padding: "0 18px 18px", display: "grid", gap: 8 }}>
            {Object.entries(data.reports?.filterSummary || {}).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid rgba(0,0,0,.06)",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)", textTransform: "capitalize" }}>{key}</span>
                <strong style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{value}</strong>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Preview" icon="list" title="Executive summary rows" />
        <div style={{ padding: "0 18px 18px" }}>
          <InsightTable rows={activePreviewRows} columns={previewColumns} pageSize={5} />
        </div>
      </Surface>

      <Surface padding={0}>
        <PanelHead eyebrow="Comparison reports" icon="chart" title="Available comparisons" />
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10 }}>
          <button type="button" disabled={exporting} onClick={() => onExportComparison("PERIOD")} style={reportCardStyle()}>
            <strong style={{ fontSize: 13, fontWeight: 600 }}>Current vs previous period</strong>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Approved revenue, current period vs the prior comparable period.
            </span>
          </button>
          <button type="button" disabled={exporting} onClick={() => onExportComparison("ROUTE")} style={reportCardStyle()}>
            <strong style={{ fontSize: 13, fontWeight: 600 }}>Factory vs dispatcher</strong>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Revenue, orders, AOV, and approval rate by route.
            </span>
          </button>
        </div>
      </Surface>
    </div>
  );
}

// ----------------------------------------------------------------------
// Shell
// ----------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Surface key={index} padding={18}>
          <div
            style={{
              height: 84,
              borderRadius: 14,
              background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
            }}
          />
        </Surface>
      ))}
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
  const [exporting, setExporting] = useState(false);

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
  const error = queryError ? getQueryErrorMessage(queryError, "Failed to load insights.") : "";

  const currency = data?.meta?.currency || "NPR";
  const section = INSIGHT_SECTIONS.find((item) => item.key === activeSection) || INSIGHT_SECTIONS[0];

  function resetFilters() {
    const defaultRange = rangeForPreset("30d");
    setFilters({
      preset: "30d",
      from: defaultRange.from,
      to: defaultRange.to,
      routing: "ALL",
      dispatcherId: "",
      dealerId: "",
      dealerState: "ALL",
      status: "APPROVED",
      category: "ALL",
    });
  }

  function runExport(task) {
    setExporting(true);
    try {
      task();
    } finally {
      setExporting(false);
    }
  }

  function exportSection(kind) {
    if (!data) return;
    runExport(() => {
      if (kind === "csv") {
        downloadCsv(`meitu-insights-${activeSection}.csv`, buildReportRows(activeSection, data, currency));
      } else {
        downloadInsightsPdf({ data, section, currency });
      }
    });
  }

  function exportReportType(reportName) {
    if (!data) return;
    const target = REPORT_TYPE_SECTION[reportName] || "home";
    runExport(() => {
      const rows =
        target === "dormant-dealers"
          ? (data.dealers?.leadership?.mostDormant || []).map((row) => ({
              Dealer: row.dealerName,
              "Last activity": formatDate(row.lastActivity),
              "Approved sales": money(row.approvedSales, currency),
              "Approved orders": number(row.approvedOrders),
            }))
          : buildReportRows(target, data, currency);
      downloadCsv(`meitu-insights-${reportName.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
    });
  }

  function exportComparison(key) {
    if (!data) return;
    runExport(() => {
      downloadCsv(`meitu-insights-comparison-${key.toLowerCase()}.csv`, buildComparisonRows(key, data, currency));
    });
  }

  function renderSection() {
    if (!data) return null;
    if (activeSection === "orders") return <OrdersSection data={data} currency={currency} />;
    if (activeSection === "dealers") return <DealersSection data={data} currency={currency} />;
    if (activeSection === "products") return <ProductsSection data={data} currency={currency} />;
    if (activeSection === "dispatchers") return <DispatchersSection data={data} currency={currency} />;
    if (activeSection === "routing") return <RoutingSection data={data} currency={currency} />;
    if (activeSection === "reports") {
      return (
        <ReportsSection
          data={data}
          currency={currency}
          exporting={exporting}
          onExportSection={exportSection}
          onExportReportType={exportReportType}
          onExportComparison={exportComparison}
        />
      );
    }
    return <HomeSection data={data} currency={currency} onNavigate={navigate} />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Admin Intelligence"
          title={section.label === "Home" ? "Insights" : `${section.label} Intelligence`}
          action={
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Generated{" "}
              <strong style={{ color: "var(--color-ink, #1d1d1f)", fontWeight: 600 }}>
                {data?.meta?.generatedAt ? new Date(data.meta.generatedAt).toLocaleString() : "pending"}
              </strong>
            </span>
          }
        />
      </Surface>

      <SegmentedControl
        value={activeSection}
        onChange={(key) => navigate(INSIGHT_SECTIONS.find((item) => item.key === key)?.path || "/admin/dashboard/insights")}
        options={INSIGHT_SECTIONS.map((item) => ({ key: item.key, label: item.label }))}
      />

      <Surface padding={16}>
        <InsightsFilterBar
          filters={filters}
          setFilters={setFilters}
          options={data?.options || {}}
          loading={isFetching}
          onRefresh={refetch}
          onReset={resetFilters}
        />
      </Surface>

      {error ? (
        <div
          style={{
            padding: "13px 15px",
            borderRadius: 14,
            background: "rgba(180,35,24,.08)",
            color: "#b42318",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? <LoadingSkeleton /> : renderSection()}
    </div>
  );
}
