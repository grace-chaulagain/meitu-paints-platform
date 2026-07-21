import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useGetDispatcherReplenishmentOrdersQuery } from "../../redux/api/meituApi.js";

// Mirrors src/dealer/mobile/BottomTabBar.jsx - 3 fixed tabs (Home/Catalog/
// Orders) + More (Inventory lives behind More, same as Dealer's Inventory).
// Cart is deliberately not a tab - it's the floating DispatcherCartPill.
const TABS = [
  { key: "home", path: "/dispatcher", icon: "home", iconFill: "homeFill", label: "Home", exact: true },
  { key: "catalog", path: "/dispatcher/catalog", icon: "overview", iconFill: "overviewFill", label: "Catalog" },
  { key: "orders", path: "/dispatcher/orders", icon: "orders", iconFill: "ordersFill", label: "Orders" },
];

function TabGlyph({ icon, iconFill, active }) {
  return (
    <span key={active ? `${icon}-on` : `${icon}-off`} className={`dealer-m-tabbar-icon-crossfade ${active ? "dealer-m-tabbar-icon-bounce" : ""}`}>
      <DashboardIcon name={icon} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-outline" style={{ opacity: active ? 0 : 1 }} />
      <DashboardIcon name={iconFill} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-fill" style={{ opacity: active ? 1 : 0 }} />
    </span>
  );
}

export function DispatcherBottomTabBar({ onMoreClick, moreActive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Shares RTK Query's cache with DispatcherOrdersMobileView's own identical
  // call - no extra network request once either has fetched once.
  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery({ limit: 100 });
  const hasPendingOrder = (ordersQuery.data?.items || []).some((order) => order.status === "SUBMITTED");

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
