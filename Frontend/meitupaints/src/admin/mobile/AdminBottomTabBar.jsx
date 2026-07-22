import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useGetAdminScopedOrdersQuery } from "../../redux/api/meituApi.js";

// Mirrors src/dealer/mobile/BottomTabBar.jsx / src/dispatcher/mobile/
// DispatcherBottomTabBar.jsx exactly (same .dealer-m-tabbar* CSS - see
// DispatcherShopPage.jsx's own comment on why these classes are reused
// unprefixed rather than forked under an admin-m- prefix). ADMIN_MOBILE_
// DESIGN_PROMPT.md §1: Home · Orders · Catalog · Dealers · More.
//
// Catalog is a real route change (/admin/products), not a
// SECTION_ROUTE_MAP entry - it's a standalone top-level route, separate
// from everything else here which lives inside AdminDashboardPage's own
// internal path-based section switch. Tapping it does a normal
// navigate(), same as it already would from the desktop sidebar.
const TABS = [
  { key: "overview", path: "/admin/dashboard", icon: "home", iconFill: "homeFill", label: "Home", exact: true },
  { key: "orders", path: "/admin/dashboard/orders", icon: "orders", iconFill: "ordersFill", label: "Orders" },
  { key: "catalog", path: "/admin/products", icon: "overview", iconFill: "overviewFill", label: "Catalog" },
  { key: "dealers", path: "/admin/dashboard/dealers", icon: "store", iconFill: "store", label: "Dealers" },
];

function TabGlyph({ icon, iconFill, active }) {
  return (
    <span key={active ? `${icon}-on` : `${icon}-off`} className={`dealer-m-tabbar-icon-crossfade ${active ? "dealer-m-tabbar-icon-bounce" : ""}`}>
      <DashboardIcon name={icon} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-outline" style={{ opacity: active ? 0 : 1 }} />
      <DashboardIcon name={iconFill} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-fill" style={{ opacity: active ? 1 : 0 }} />
    </span>
  );
}

export function AdminBottomTabBar({ onMoreClick, moreActive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Same query + filter DashboardOverview's "Factory Orders" metric tile
  // already runs - shares RTK Query's cache, no extra request either way.
  const factoryOrdersQuery = useGetAdminScopedOrdersQuery({ status: "SUBMITTED", fulfillmentMode: "FACTORY", limit: 5 });
  const hasPendingFactoryOrder = Number(factoryOrdersQuery.data?.total ?? factoryOrdersQuery.data?.items?.length ?? 0) > 0;

  return (
    <nav className="dealer-m-tabbar" aria-label="Admin navigation">
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
              {tab.key === "orders" && hasPendingFactoryOrder ? <span className="dealer-m-tabbar-dot" /> : null}
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
