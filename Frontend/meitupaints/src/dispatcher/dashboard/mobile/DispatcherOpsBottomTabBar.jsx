import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { useGetDispatcherOrdersQuery } from "../../../redux/api/meituApi.js";

// Mirrors admin/mobile/AdminBottomTabBar.jsx exactly (same .dealer-m-tabbar*
// CSS, same crossfade glyph) - this is the "dashboard" (Tree A: review/
// verify/dispatch assigned dealer orders) tree's own tab bar, deliberately a
// separate file from dispatcher/mobile/DispatcherBottomTabBar.jsx, which
// belongs to the unrelated "Tree B" shop (buy replenishment stock from the
// factory) workspace under /dispatcher - the two trees intentionally never
// share a nav, per DispatcherDashboardPage.jsx's own header comment.
const TABS = [
  { key: "overview", path: "/dispatcher/dashboard", icon: "home", iconFill: "homeFill", label: "Home", exact: true },
  { key: "orders", path: "/dispatcher/dashboard/orders", icon: "orders", iconFill: "ordersFill", label: "Orders" },
  { key: "dealers", path: "/dispatcher/dashboard/dealers", icon: "store", iconFill: "store", label: "Dealers" },
];

function TabGlyph({ icon, iconFill, active }) {
  return (
    <span key={active ? `${icon}-on` : `${icon}-off`} className={`dealer-m-tabbar-icon-crossfade ${active ? "dealer-m-tabbar-icon-bounce" : ""}`}>
      <DashboardIcon name={icon} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-outline" style={{ opacity: active ? 0 : 1 }} />
      <DashboardIcon name={iconFill} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-fill" style={{ opacity: active ? 1 : 0 }} />
    </span>
  );
}

export function DispatcherOpsBottomTabBar({ onMoreClick, moreActive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Same query DispatcherOverviewPage.jsx's Pending-Orders metric tile
  // already runs - shares RTK Query's cache, no extra request either way.
  const pendingOrdersQuery = useGetDispatcherOrdersQuery({ status: "SUBMITTED", limit: 5 });
  const hasPendingOrder = Number(pendingOrdersQuery.data?.total ?? pendingOrdersQuery.data?.items?.length ?? 0) > 0;

  return (
    <nav className="dealer-m-tabbar" aria-label="Dispatcher navigation">
      {TABS.map((tab) => {
        const active = tab.exact ? location.pathname === tab.path : location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.key}
            type="button"
            className={`dealer-m-tabbar-item ${active ? "active" : ""}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="dealer-m-tabbar-icon-wrap">
              <TabGlyph icon={tab.icon} iconFill={tab.iconFill} active={active} />
              {tab.key === "orders" && hasPendingOrder ? <span className="dealer-m-tabbar-dot" /> : null}
            </span>
            <span className="dealer-m-tabbar-label">{tab.label}</span>
          </button>
        );
      })}
      <button type="button" className={`dealer-m-tabbar-item ${moreActive ? "active" : ""}`} onClick={onMoreClick}>
        <span className="dealer-m-tabbar-icon-wrap">
          <DashboardIcon name="moreHorizontal" size={24} strokeWidth={1.8} />
        </span>
        <span className="dealer-m-tabbar-label">More</span>
      </button>
    </nav>
  );
}
