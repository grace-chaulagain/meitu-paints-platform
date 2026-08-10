import { useCallback, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { rangeForPreset } from "./insightsFormatting.js";
import DateRangeFilterBar from "./sections/DateRangeFilterBar.jsx";
import EntityFilterBar from "./sections/EntityFilterBar.jsx";
import { ROUTE_ALL, routeToParams } from "./sections/entityScope.js";
import CashPositionSection from "./sections/CashPositionSection.jsx";
import DealerStatementsSection from "./sections/DealerStatementsSection.jsx";
import PaymentReconciliationSection from "./sections/PaymentReconciliationSection.jsx";
import OrderAnalyticsSection from "./sections/OrderAnalyticsSection.jsx";
import PerformanceSection from "./sections/PerformanceSection.jsx";
import ReportsSection from "./sections/ReportsSection.jsx";

// Standalone accounting workspace (route: /admin/insights), deliberately
// outside the /admin/dashboard shell: with this many account-keeping
// sections the dashboard's own sidebar was competing with section
// navigation for the same edge of the screen. The rail below owns section
// nav; the pinned header owns the filters that every section obeys, so
// switching sections never resets the lens you set (Phase 2 adds the
// dealer/dispatcher picker to that same header).
const INSIGHT_SECTIONS = [
  { key: "cash-position", label: "Cash Position", path: "/admin/insights", icon: "trend" },
  { key: "statements", label: "Statements & AR", path: "/admin/insights/statements", icon: "list" },
  { key: "reconciliation", label: "Reconciliation", path: "/admin/insights/reconciliation", icon: "checkSquare" },
  { key: "orders", label: "Order Analytics", path: "/admin/insights/orders", icon: "orders" },
  { key: "performance", label: "Performance", path: "/admin/insights/performance", icon: "chart" },
  { key: "reports", label: "Reports", path: "/admin/insights/reports", icon: "download" },
];

function sectionFromPath(pathname) {
  const exact = INSIGHT_SECTIONS.find((item) => item.path === pathname);
  if (exact) return exact.key;
  // Tolerate trailing slashes and unknown sub-paths rather than rendering
  // a blank workspace.
  const nested = INSIGHT_SECTIONS.find(
    (item) => item.path !== "/admin/insights" && pathname.startsWith(`${item.path}/`),
  );
  return nested?.key || "cash-position";
}

// Keeps every bookmark and in-app link to the old /admin/dashboard/insights
// URLs working after the move to the standalone route.
export function LegacyInsightsRedirect() {
  const { section } = useParams();
  const target = INSIGHT_SECTIONS.some((item) => item.path === `/admin/insights/${section}`)
    ? `/admin/insights/${section}`
    : "/admin/insights";
  return <Navigate to={target} replace />;
}

export default function AdminInsightsWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = sectionFromPath(location.pathname);

  const initialRange = useMemo(() => rangeForPreset("30d"), []);
  const [range, setRange] = useState({ preset: "30d", from: initialRange.from, to: initialRange.to });

  // Entity scope lives in the URL (same convention as the admin orders
  // list) so a filtered view is shareable and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const route = searchParams.get("route") || ROUTE_ALL;
  const dealerId = searchParams.get("dealer") || "";

  const setScopeParam = useCallback(
    (patch) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Changing route invalidates a dealer chosen under the previous route.
  const handleRouteChange = useCallback(
    (nextRoute) => setScopeParam({ route: nextRoute === ROUTE_ALL ? "" : nextRoute, dealer: "" }),
    [setScopeParam],
  );
  const handleDealerChange = useCallback(
    (nextDealer) => setScopeParam({ dealer: nextDealer }),
    [setScopeParam],
  );

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

  // One object every section receives: date window + entity scope. Named
  // `dateFilters` still because that's the prop the sections already take.
  const dateFilters = useMemo(() => {
    const params = { range: range.preset };
    if (range.preset !== "all") {
      params.from = range.from;
      params.to = range.to;
    }
    Object.assign(params, routeToParams(route));
    // Performance ranks entities against each other, so a single-dealer
    // scope would reduce it to a one-row ranking - the picker is disabled
    // there (see below) and the param is dropped to match.
    if (dealerId && activeSection !== "performance") {
      params.dealerId = dealerId;
    }
    return params;
  }, [range.preset, range.from, range.to, route, dealerId, activeSection]);

  const dealerFilterDisabled = activeSection === "performance";

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
    <div className="insights-workspace">
      <aside className="iw-rail" aria-label="Insights sections">
        <button type="button" className="iw-back" onClick={() => navigate("/admin/dashboard")}>
          <DashboardIcon name="chevron" size={16} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
          <span className="iw-rail-label">Dashboard</span>
        </button>

        <nav className="iw-rail-nav">
          {INSIGHT_SECTIONS.map((item) => {
            const active = item.key === activeSection;
            return (
              <button
                key={item.key}
                type="button"
                className={`iw-rail-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
                onClick={() => navigate(item.path)}
              >
                <span className="iw-rail-marker" aria-hidden="true" />
                <DashboardIcon name={item.icon} size={18} strokeWidth={1.9} />
                <span className="iw-rail-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="iw-main">
        <header className="iw-header">
          <div className="iw-filters">
            <DateRangeFilterBar
              preset={range.preset}
              from={range.from}
              to={range.to}
              onChange={updateRange}
              onReset={resetRange}
            />
            <EntityFilterBar
              route={route}
              dealerId={dealerId}
              onRouteChange={handleRouteChange}
              onDealerChange={handleDealerChange}
              dealerDisabled={dealerFilterDisabled}
              dealerDisabledReason="Rankings compare all dealers"
            />
          </div>
        </header>

        {/* Keyed so a section switch replays the entrance rather than
            cross-fading two different data shapes into each other. */}
        <main className="iw-content" key={activeSection}>
          {renderSection()}
        </main>
      </div>

      <style>{`
        .insights-workspace{
          display:grid;
          grid-template-columns:232px minmax(0,1fr);
          min-height:100vh;
          background:var(--color-fog, #f5f5f7);
        }
        .iw-rail{
          position:sticky; top:0; align-self:start;
          height:100vh;
          display:flex; flex-direction:column; gap:14px;
          padding:20px 12px;
          background:var(--color-snow, #fff);
          border-right:1px solid var(--color-silver-mist, #e8e8ed);
        }
        .iw-back{
          display:flex; align-items:center; gap:8px;
          min-height:36px; padding:0 10px;
          border:none; border-radius:10px;
          background:transparent; cursor:pointer;
          color:var(--color-graphite, #707070);
          font-size:13px; font-weight:500;
          transition:background 150ms ease-out, color 150ms ease-out, transform 120ms ease-out;
        }
        .iw-back:active{ transform:scale(0.97); }
        .iw-rail-nav{ display:flex; flex-direction:column; gap:2px; }
        .iw-rail-item{
          position:relative;
          display:flex; align-items:center; gap:10px;
          min-height:40px; padding:0 10px;
          border:none; border-radius:10px;
          background:transparent; cursor:pointer;
          color:var(--color-graphite, #707070);
          font-size:13.5px; font-weight:500; text-align:left;
          transition:background 150ms ease-out, color 150ms ease-out, transform 120ms ease-out;
        }
        .iw-rail-item:active{ transform:scale(0.97); }
        .iw-rail-item.active{
          background:color-mix(in srgb, var(--color-azure, #0071e3) 8%, transparent);
          color:var(--color-azure, #0071e3);
          font-weight:600;
        }
        /* Left accent scales in from the item's own edge - no measured
           sliding indicator, so it stays correct at every rail width. */
        .iw-rail-marker{
          position:absolute; left:0; top:9px; bottom:9px; width:3px;
          border-radius:0 3px 3px 0;
          background:var(--color-azure, #0071e3);
          transform:scaleY(0); transform-origin:center;
          transition:transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .iw-rail-item.active .iw-rail-marker{ transform:scaleY(1); }

        .iw-main{ display:flex; flex-direction:column; min-width:0; }
        .iw-header{
          position:sticky; top:0; z-index:5;
          padding:14px 24px;
          background:color-mix(in srgb, var(--color-fog, #f5f5f7) 82%, transparent);
          backdrop-filter:saturate(180%) blur(20px);
          -webkit-backdrop-filter:saturate(180%) blur(20px);
          border-bottom:1px solid var(--color-silver-mist, #e8e8ed);
        }
        .iw-filters{
          display:flex; align-items:center; flex-wrap:wrap; gap:10px;
        }
        .iw-content{
          display:grid; gap:16px;
          padding:20px 24px 48px;
          min-width:0;
          animation:iw-enter 260ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes iw-enter{
          from{ opacity:0; transform:translateY(6px); }
          to{ opacity:1; transform:none; }
        }

        @media (hover:hover) and (pointer:fine){
          .iw-back:hover{ background:var(--color-fog, #f5f5f7); color:var(--color-ink, #1d1d1f); }
          .iw-rail-item:hover:not(.active){ background:var(--color-fog, #f5f5f7); color:var(--color-ink, #1d1d1f); }
        }

        /* Tablet: icon-only rail, labels fall away (title attr carries them). */
        @media (max-width:1024px){
          .insights-workspace{ grid-template-columns:60px minmax(0,1fr); }
          .iw-rail{ padding:16px 8px; align-items:center; }
          .iw-rail-label{ display:none; }
          .iw-back, .iw-rail-item{ justify-content:center; gap:0; width:44px; padding:0; }
          .iw-header{ padding:12px 16px; }
          .iw-content{ padding:16px 16px 40px; }
        }

        /* Phone: rail becomes a horizontal tab strip above the content. */
        @media (max-width:640px){
          .insights-workspace{ grid-template-columns:minmax(0,1fr); }
          .iw-rail{
            position:static; height:auto; width:100%;
            flex-direction:row; align-items:center; gap:6px;
            padding:8px 12px;
            overflow-x:auto; scrollbar-width:none;
            border-right:none; border-bottom:1px solid var(--color-silver-mist, #e8e8ed);
          }
          .iw-rail::-webkit-scrollbar{ display:none; }
          .iw-rail-nav{ flex-direction:row; gap:6px; }
          .iw-back, .iw-rail-item{ flex:0 0 auto; width:40px; height:40px; }
          .iw-rail-marker{
            left:9px; right:9px; top:auto; bottom:2px; width:auto; height:2px;
            border-radius:2px 2px 0 0;
            transform:scaleX(0);
            transition:transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
          }
          .iw-rail-item.active .iw-rail-marker{ transform:scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce){
          .iw-rail-marker{ transition:none; }
          .iw-content{ animation:none; }
          .iw-back, .iw-rail-item{ transition:none; }
          .iw-back:active, .iw-rail-item:active{ transform:none; }
        }
      `}</style>
    </div>
  );
}
