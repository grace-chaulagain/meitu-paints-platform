import { useMemo, useState } from "react";
import { useGetAdminInsightsQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { TrendChart, RankedBarList, SignalList } from "../dashboard/insights/InsightsPrimitives.jsx";
import { money, number, percent, formatDate, rangeForPreset } from "../dashboard/insights/insightsFormatting.js";

// ADMIN_MOBILE_DESIGN_PROMPT.md §7 - rebuilt mobile-first per its own
// explicit instruction, not a port of the desktop InsightsFilterBar/
// InsightTable. TrendChart/RankedBarList/SignalList are reused unmodified
// (already dataviz-skill-compliant, already proven live in
// AdminHomeMobileView.jsx's revenue chart). Every InsightTable on desktop
// (largestOrders, dealers.rows, products.ranking, dispatchers.rows,
// routing.byDealer) becomes a capped "top rows" card list here instead -
// per the spec's own instruction, a <table> must never render at this
// width, and a full sortable/paginated table has no mobile equivalent worth
// building for a "less depth" pass.
//
// Scope cuts, documented: the Reports/export tab (jspdf + CSV/anchor-
// download, a desktop file-management pattern) is dropped entirely with an
// honest note rather than faked; the per-dealer/per-dispatcher/category
// filter pickers (long name lists) and custom date range are dropped in
// favor of date presets + a status segment, matching what the research
// pass flagged as the two filters that materially change the numbers shown
// (silently hiding status would misrepresent revenue).
const SECTIONS = [
  { key: "home", label: "Home", icon: "overview" },
  { key: "orders", label: "Orders", icon: "orders" },
  { key: "dealers", label: "Dealers", icon: "store" },
  { key: "products", label: "Products", icon: "package" },
  { key: "dispatchers", label: "Dispatchers", icon: "handshake" },
  { key: "routing", label: "Routing", icon: "truck" },
];

const PERIODS = [
  { key: "7d", label: "Week" },
  { key: "30d", label: "Month" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All Time" },
];

const STATUSES = [
  { key: "ALL", label: "All" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "SUBMITTED", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
];

function KpiCard({ icon, label, value, helper, tone }) {
  return (
    <div className="admin-m-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-graphite, #707070)" }}>
        <DashboardIcon name={icon} size={13} strokeWidth={1.9} />
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".02em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800, color: tone === "accent" ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)" }}>
        {value}
      </div>
      {helper ? <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{helper}</div> : null}
    </div>
  );
}

function KpiRow({ tiles }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {tiles.map((tile) => (
        <KpiCard key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="admin-m-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="admin-m-section-title" style={{ padding: "14px 16px 0" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// Caps every desktop InsightTable at the top 6 rows, rendered as a compact
// card list (name + one highlighted value + one meta line) instead of a
// sortable/paginated table - see file header comment.
function TopRowsCard({ title, rows, primary, secondary, empty = "No data yet." }) {
  const top = (rows || []).slice(0, 6);
  return (
    <div className="admin-m-card">
      <div className="admin-m-section-title">{title}</div>
      {top.length === 0 ? (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{empty}</div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {top.map((row, index) => (
            <div key={index} className="admin-m-kv-row" style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {primary.label(row)}
              </span>
              <span style={{ marginLeft: "auto", flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{primary.value(row)}</div>
                {secondary ? <div style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{secondary(row)}</div> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeSection({ data, currency }) {
  const kpis = data.home?.kpis || {};
  return (
    <>
      <KpiRow
        tiles={[
          { icon: "invoice", label: "Accepted Revenue", value: money(kpis.approvedRevenue, currency), tone: "accent" },
          { icon: "orders", label: "Accepted Orders", value: number(kpis.approvedOrders) },
          { icon: "chart", label: "Avg Order Value", value: money(kpis.averageOrderValue, currency) },
          { icon: "trend", label: "Revenue Growth", value: percent(kpis.revenueGrowth) },
        ]}
      />
      <ChartCard title="Revenue over time">
        <TrendChart data={data.home?.pulse || []} currency={currency} height={180} />
      </ChartCard>
      <div className="admin-m-card">
        <div className="admin-m-section-title">Executive Signals</div>
        <SignalList signals={data.home?.signals || []} />
      </div>
      <ChartCard title="Factory vs Dispatcher Revenue">
        <RankedBarList
          items={[
            { label: "Factory", value: data.home?.routingSnapshot?.factoryApprovedRevenue || 0 },
            { label: "Dispatcher", value: data.home?.routingSnapshot?.dispatcherApprovedRevenue || 0 },
          ]}
          formatValue={(v) => money(v, currency)}
        />
      </ChartCard>
    </>
  );
}

function OrdersSection({ data, currency }) {
  const summary = data.orders?.summary || {};
  return (
    <>
      <KpiRow
        tiles={[
          { icon: "orders", label: "Total Orders", value: number(summary.totalOrders) },
          { icon: "checkmark", label: "Accepted", value: number(summary.approvedOrders), tone: "accent" },
          { icon: "invoice", label: "Accepted Revenue", value: money(summary.totalApprovedRevenue, currency), tone: "accent" },
          { icon: "chart", label: "Acceptance Rate", value: percent(summary.acceptanceRate ?? summary.approvalRate) },
        ]}
      />
      <ChartCard title="Revenue over time">
        <TrendChart data={data.orders?.trend || []} currency={currency} height={180} />
      </ChartCard>
      <ChartCard title="Order Value Bands">
        <RankedBarList items={data.orders?.distribution?.valueBuckets || []} labelKey="label" valueKey="revenue" formatValue={(v) => money(v, currency)} />
      </ChartCard>
      <TopRowsCard
        title="Largest Accepted Orders"
        rows={data.orders?.rankings?.largestOrders || []}
        primary={{ label: (row) => row.dealerName || row.orderNumber, value: (row) => money(row.total, currency) }}
        secondary={(row) => `${row.orderNumber} · ${formatDate(row.createdAt)}`}
      />
    </>
  );
}

function DealersSection({ data, currency }) {
  const dealers = data.dealers || {};
  return (
    <>
      <ChartCard title="Dealer Revenue Leaders">
        <RankedBarList
          items={(dealers.leadership?.topBySales || []).map((row) => ({ label: row.dealerName, value: row.approvedSales }))}
          formatValue={(v) => money(v, currency)}
        />
      </ChartCard>
      <ChartCard title="Activity States">
        <RankedBarList items={dealers.segmentation?.activity || []} valueKey="count" formatValue={number} />
      </ChartCard>
      <TopRowsCard
        title="Dealer Intelligence"
        rows={dealers.rows || []}
        primary={{ label: (row) => row.dealerName, value: (row) => money(row.approvedSales, currency) }}
        secondary={(row) => `${number(row.approvedOrders)} orders · ${row.routingMode || "—"}`}
      />
      <div className="admin-m-card">
        <div className="admin-m-section-title">Concentration Signals</div>
        <SignalList
          signals={[
            {
              title: "Top 5 contribution",
              body: `${percent(dealers.signals?.topFiveRevenueShare)} of accepted revenue is concentrated in the top five dealers.`,
              tone: Number(dealers.signals?.topFiveRevenueShare || 0) > 60 ? "watch" : "positive",
            },
            {
              title: "Declining accounts",
              body: `${dealers.signals?.decliningDealers?.length || 0} dealers are declining by more than 20%.`,
              tone: "risk",
            },
          ]}
        />
      </div>
    </>
  );
}

function ProductsSection({ data, currency }) {
  const products = data.products || {};
  return (
    <>
      <KpiRow
        tiles={[
          { icon: "package", label: "Unique Products", value: number(products.summary?.uniqueProductsOrdered) },
          {
            icon: "invoice",
            label: "Top Revenue Product",
            value: products.summary?.topProductByRevenue?.product || "None",
            helper: money(products.summary?.topProductByRevenue?.revenue, currency),
            tone: "accent",
          },
          {
            icon: "trend",
            label: "Highest Growth",
            value: products.summary?.highestGrowthProduct?.product || "None",
            helper: percent(products.summary?.highestGrowthProduct?.growthRate),
          },
          {
            icon: "warning",
            label: "Slow Mover",
            value: products.summary?.slowMovingProduct?.product || "None",
            helper: money(products.summary?.slowMovingProduct?.revenue, currency),
          },
        ]}
      />
      <ChartCard title="Top Products by Revenue">
        <RankedBarList items={products.charts?.topProductsByRevenue || []} labelKey="product" valueKey="revenue" formatValue={(v) => money(v, currency)} />
      </ChartCard>
      <ChartCard title="Category Revenue Share">
        <RankedBarList items={products.categoryMix || []} labelKey="category" valueKey="revenue" formatValue={(v) => money(v, currency)} />
      </ChartCard>
      <TopRowsCard
        title="Product Performance"
        rows={products.ranking || []}
        primary={{ label: (row) => row.product, value: (row) => money(row.revenue, currency) }}
        secondary={(row) => `${number(row.quantitySold)} sold · ${row.category || "—"}`}
      />
    </>
  );
}

function DispatchersSection({ data, currency }) {
  const summary = data.dispatchers?.summary || {};
  return (
    <>
      <KpiRow
        tiles={[
          { icon: "invoice", label: "Dispatcher Revenue", value: money(summary.dispatcherApprovedRevenue, currency), tone: "accent" },
          { icon: "orders", label: "Dispatcher Orders", value: number(summary.dispatcherRoutedOrders) },
          { icon: "chart", label: "Avg Routed Order", value: money(summary.averageRoutedOrderValue, currency) },
          {
            icon: "handshake",
            label: "Top Revenue Lane",
            value: summary.topDispatcherByRevenue?.dispatcherName || "None",
            helper: money(summary.topDispatcherByRevenue?.approvedRevenue, currency),
          },
        ]}
      />
      <ChartCard title="Revenue by Dispatcher">
        <RankedBarList items={data.dispatchers?.charts?.revenueByDispatcher || []} labelKey="dispatcherName" valueKey="approvedRevenue" formatValue={(v) => money(v, currency)} />
      </ChartCard>
      <TopRowsCard
        title="Dispatcher Performance"
        rows={data.dispatchers?.rows || []}
        primary={{ label: (row) => row.dispatcherName, value: (row) => money(row.approvedRevenue, currency) }}
        secondary={(row) => `${number(row.assignedDealerCount)} dealers · ${percent(row.approvalRate)} acceptance`}
      />
    </>
  );
}

function RoutingSection({ data, currency }) {
  const summary = data.routing?.summary || {};
  const noteLabels = ["Revenue balance", "Value efficiency", "Lane risk"];
  return (
    <>
      <KpiRow
        tiles={[
          { icon: "invoice", label: "Factory Revenue", value: money(summary.factoryApprovedRevenue, currency) },
          { icon: "invoice", label: "Dispatcher Revenue", value: money(summary.dispatcherApprovedRevenue, currency) },
          { icon: "orders", label: "Factory Orders", value: number(summary.factoryOrderCount) },
          { icon: "orders", label: "Dispatcher Orders", value: number(summary.dispatcherOrderCount) },
        ]}
      />
      <ChartCard title="Revenue by Route">
        <RankedBarList
          items={[
            { label: "Factory", value: summary.factoryApprovedRevenue || 0 },
            { label: "Dispatcher", value: summary.dispatcherApprovedRevenue || 0 },
          ]}
          formatValue={(v) => money(v, currency)}
        />
      </ChartCard>
      <ChartCard title="Acceptance Rate by Route">
        <RankedBarList
          items={[
            { label: "Factory", value: summary.factoryApprovalRate || 0 },
            { label: "Dispatcher", value: summary.dispatcherApprovalRate || 0 },
          ]}
          formatValue={percent}
        />
      </ChartCard>
      <div className="admin-m-card">
        <div className="admin-m-section-title">Routing Intelligence</div>
        <SignalList signals={(data.routing?.notes || []).map((body, index) => ({ title: noteLabels[index] || `Signal ${index + 1}`, body }))} />
      </div>
      <TopRowsCard
        title="Routing by Dealer"
        rows={data.routing?.byDealer || []}
        primary={{ label: (row) => row.dealerName, value: (row) => money(row.sales, currency) }}
        secondary={(row) => `${row.route || "—"} · ${row.suitability || "—"}`}
      />
    </>
  );
}

const SECTION_RENDERERS = {
  home: HomeSection,
  orders: OrdersSection,
  dealers: DealersSection,
  products: ProductsSection,
  dispatchers: DispatchersSection,
  routing: RoutingSection,
};

export function AdminInsightsMobileView() {
  const [section, setSection] = useState("home");
  const [period, setPeriod] = useState("30d");
  const [status, setStatus] = useState("ALL");

  const range = useMemo(() => rangeForPreset(period), [period]);
  const queryParams = useMemo(() => {
    const params = { range: period, status, routing: "ALL", dealerState: "ALL" };
    if (period !== "all") {
      params.from = range.from;
      params.to = range.to;
    }
    return params;
  }, [period, status, range]);

  const insightsQuery = useGetAdminInsightsQuery(queryParams);
  const data = insightsQuery.data;
  const currency = data?.meta?.currency || "NPR";
  const loading = insightsQuery.isLoading && !data;
  const loadError = insightsQuery.error ? getQueryErrorMessage(insightsQuery.error, "Failed to load insights.") : "";

  const Section = SECTION_RENDERERS[section] || HomeSection;

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => insightsQuery.refetch()}>
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
            <div className="dealer-m-large-title">Insights</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 180, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Insights" />

        <div style={{ marginTop: 6, overflowX: "auto", marginInline: "calc(var(--am-gutter) * -1)", paddingInline: "var(--am-gutter)" }}>
          <div style={{ display: "flex", gap: 8, width: "max-content" }}>
            {SECTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`dealer-m-catalog-chip ${section === option.key ? "active" : ""}`}
                onClick={() => setSection(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
        </div>
        <div style={{ marginTop: 10 }}>
          <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
        </div>

        {insightsQuery.isFetching && data ? (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)", textAlign: "center" }}>
            Updating…
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>{data ? <Section data={data} currency={currency} /> : null}</div>

        <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-graphite, #707070)", textAlign: "center", padding: "8px 0" }}>
          Full reports &amp; CSV/PDF exports are available on desktop.
        </div>
      </SkeletonSwap>
    </div>
  );
}
