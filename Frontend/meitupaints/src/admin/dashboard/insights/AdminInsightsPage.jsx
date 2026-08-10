import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SegmentedControl, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { rangeForPreset } from "./insightsFormatting.js";
import DateRangeFilterBar from "./sections/DateRangeFilterBar.jsx";
import CashPositionSection from "./sections/CashPositionSection.jsx";
import DealerStatementsSection from "./sections/DealerStatementsSection.jsx";
import PaymentReconciliationSection from "./sections/PaymentReconciliationSection.jsx";
import OrderAnalyticsSection from "./sections/OrderAnalyticsSection.jsx";
import PerformanceSection from "./sections/PerformanceSection.jsx";
import ReportsSection from "./sections/ReportsSection.jsx";

// Account-keeping first: Cash Position is the default landing tab,
// Statements & AR and Reconciliation are the other two account-keeping
// tabs, then Order Analytics and Performance (Dealers/Products/
// Dispatchers/Routing, nested under one tab - see PerformanceSection.jsx)
// carry the operational-analytics content the old 7-tab page used to
// spread across five top-level tabs. Every section fetches its own data
// from its own aggregation endpoint (admin.insights.routes.js) - there is
// no more single combined blob endpoint behind this page.
const INSIGHT_SECTIONS = [
  { key: "cash-position", label: "Cash Position", path: "/admin/dashboard/insights" },
  { key: "statements", label: "Statements & AR", path: "/admin/dashboard/insights/statements" },
  { key: "reconciliation", label: "Reconciliation", path: "/admin/dashboard/insights/reconciliation" },
  { key: "orders", label: "Order Analytics", path: "/admin/dashboard/insights/orders" },
  { key: "performance", label: "Performance", path: "/admin/dashboard/insights/performance" },
  { key: "reports", label: "Reports", path: "/admin/dashboard/insights/reports" },
];

function sectionFromPath(pathname) {
  const section = INSIGHT_SECTIONS.find((item) => item.path === pathname);
  return section?.key || "cash-position";
}

// One responsive tree for both desktop and mobile now - DataTable already
// auto-switches to a card list under 640px, SegmentedControl/TabBar wrap,
// and the section layout helpers (sectionLayout.js) collapse to a single
// column under ~768px, so a second hand-maintained mobile component tree
// (the old AdminInsightsMobileView.jsx) is no longer needed.
export default function AdminInsightsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = sectionFromPath(location.pathname);

  const initialRange = useMemo(() => rangeForPreset("30d"), []);
  const [range, setRange] = useState({ preset: "30d", from: initialRange.from, to: initialRange.to });

  function updateRange(patch) {
    setRange((current) => {
      const next = { ...current, ...patch };
      if (patch.preset && patch.preset !== "custom") {
        return { ...next, ...rangeForPreset(patch.preset) };
      }
      return next;
    });
  }

  function resetRange() {
    const defaultRange = rangeForPreset("30d");
    setRange({ preset: "30d", from: defaultRange.from, to: defaultRange.to });
  }

  const dateFilters = useMemo(() => {
    const params = { range: range.preset };
    if (range.preset !== "all") {
      params.from = range.from;
      params.to = range.to;
    }
    return params;
  }, [range.preset, range.from, range.to]);

  function renderSection() {
    if (activeSection === "cash-position") return <CashPositionSection dateFilters={dateFilters} />;
    if (activeSection === "statements") return <DealerStatementsSection dateFilters={dateFilters} />;
    if (activeSection === "reconciliation") return <PaymentReconciliationSection dateFilters={dateFilters} />;
    if (activeSection === "orders") return <OrderAnalyticsSection dateFilters={dateFilters} />;
    if (activeSection === "performance") return <PerformanceSection dateFilters={dateFilters} />;
    if (activeSection === "reports") return <ReportsSection dateFilters={dateFilters} />;
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SegmentedControl
        value={activeSection}
        onChange={(key) => navigate(INSIGHT_SECTIONS.find((item) => item.key === key)?.path || "/admin/dashboard/insights")}
        options={INSIGHT_SECTIONS.map((item) => ({ key: item.key, label: item.label }))}
      />

      <Surface padding={16}>
        <DateRangeFilterBar preset={range.preset} from={range.from} to={range.to} onChange={updateRange} onReset={resetRange} />
      </Surface>

      {renderSection()}
    </div>
  );
}
