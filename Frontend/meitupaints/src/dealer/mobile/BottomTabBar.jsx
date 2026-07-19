import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useGetDealerOrdersQuery } from "../../redux/api/meituApi.js";
import { ORDER_STATUS_META } from "../orderDetailLogic.js";

// Spec §3: 4 tabs (Home/Browse/Orders/More), fixed bottom, one-thumb reach.
// Cart is deliberately NOT a tab - it's the floating CartPill instead.
const TABS = [
  { key: "home", path: "/dealer", icon: "home", iconFill: "homeFill", label: "Home", exact: true },
  { key: "catalog", path: "/dealer/catalog", icon: "overview", iconFill: "overviewFill", label: "Products" },
  { key: "orders", path: "/dealer/orders", icon: "orders", iconFill: "ordersFill", label: "Orders" },
];

// SF Symbols-style outline<->fill crossfade (spec §1.2): both glyphs are
// stacked in the same slot and swap via opacity, never a hard icon-name
// swap, so the transition is a real 150ms fade instead of a pop. The
// `key` change on becoming active remounts just this span, restarting the
// compressed-bounce keyframe - a one-shot state-change flourish, not a
// mid-flight-retriggerable animation, so a keyframe (not a transition) is
// the right tool here per the emil-design-eng constitution.
function TabGlyph({ icon, iconFill, active }) {
  return (
    <span key={active ? `${icon}-on` : `${icon}-off`} className={`dealer-m-tabbar-icon-crossfade ${active ? "dealer-m-tabbar-icon-bounce" : ""}`}>
      <DashboardIcon name={icon} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-outline" style={{ opacity: active ? 0 : 1 }} />
      <DashboardIcon name={iconFill} size={24} strokeWidth={1.8} className="dealer-m-tabbar-icon-fill" style={{ opacity: active ? 1 : 0 }} />
    </span>
  );
}

export function BottomTabBar({ onMoreClick, moreActive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Shares RTK Query's cache with DealerOrdersPage's own identical call - no
  // extra network request once that page (or this bar) has fetched once.
  const ordersQuery = useGetDealerOrdersQuery({ limit: 100 });
  const hasLiveOrder = (ordersQuery.data?.items || []).some((order) => ORDER_STATUS_META[order.status]?.live);

  return (
    <nav className="dealer-m-tabbar" aria-label="Dealer navigation">
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
              {tab.key === "orders" && hasLiveOrder ? <span className="dealer-m-tabbar-dot" /> : null}
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
