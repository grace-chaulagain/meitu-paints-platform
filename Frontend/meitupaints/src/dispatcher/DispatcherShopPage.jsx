import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { DashboardUIStyles } from "../components/dashboard/DashboardUI.jsx";
import { useIsMobileDispatcher } from "./mobile/useIsMobileDispatcher.js";
import { DispatcherBottomTabBar } from "./mobile/DispatcherBottomTabBar.jsx";
import { DispatcherCartPill } from "./mobile/DispatcherCartPill.jsx";
// Reused directly, unmodified - both are pure, prop-driven components with
// zero dealer-specific data coupling (MobileToastRenderer is a role-agnostic
// module-level toast queue; DealerMoreDrawer just renders whatever `groups`
// it's given). Writing dispatcher-only forks of these would be a pure copy
// with no actual behavior change.
import { MobileToastRenderer } from "../dealer/mobile/MobileToast.jsx";
import { DealerMoreDrawer } from "../dealer/mobile/DealerMoreDrawer.jsx";
// Also reused directly - these inject the `.dealer-m-*` CSS every mobile
// component here (DispatcherBottomTabBar, DispatcherCartPill, and every
// Dispatcher*MobileView) deliberately renders with, so the dispatcher mobile
// experience is pixel-identical to the dealer one instead of a redrawn
// approximation. See DESIGN.md's "same token system" rule - forking an
// entire second copy of ~7,000 lines of CSS under a `dispatcher-m-*` prefix
// would be a maintenance liability with no visual upside.
import { DealerMobileStylesCore } from "../dealer/mobile/DealerMobileStyles.core.jsx";
import { DealerMobileStylesPages } from "../dealer/mobile/DealerMobileStyles.pages.jsx";

// The dispatcher's own "buy replenishment stock from the factory" workspace
// - structurally the same idea as DealerDashboardPage.jsx (Home/Catalog/
// Cart/Orders/Inventory, no /dashboard prefix), just for a dispatcher acting
// as a customer of the factory rather than a dealer. Deliberately separate
// from DispatcherDashboardPage.jsx (/dispatcher/dashboard), which is the
// "review/verify/dispatch assigned dealer orders" workspace - the two never
// share a sidebar so "place my own order" and "handle someone else's order"
// stay unambiguous.
const SECTIONS = {
  HOME: "home",
  CATALOG: "catalog",
  CART: "cart",
  ORDERS: "orders",
  INVENTORY: "inventory",
};

const ROUTES = {
  [SECTIONS.HOME]: "/dispatcher",
  [SECTIONS.CATALOG]: "/dispatcher/catalog",
  [SECTIONS.CART]: "/dispatcher/cart",
  [SECTIONS.ORDERS]: "/dispatcher/orders",
  [SECTIONS.INVENTORY]: "/dispatcher/inventory",
};

// Sections that live behind the bottom tab bar's own tabs - matches
// BottomTabBar.jsx's TABS (Home/Catalog/Orders). Everything else (Cart via
// the pill, Inventory via More) reads as "More" being the active trigger.
const TAB_BAR_SECTIONS = new Set([SECTIONS.HOME, SECTIONS.CATALOG, SECTIONS.ORDERS]);

function sectionFromPath(pathname = "") {
  if (pathname === ROUTES[SECTIONS.HOME] || pathname === `${ROUTES[SECTIONS.HOME]}/`) return SECTIONS.HOME;
  if (pathname.startsWith(ROUTES[SECTIONS.CATALOG])) return SECTIONS.CATALOG;
  if (pathname.startsWith(ROUTES[SECTIONS.CART])) return SECTIONS.CART;
  if (pathname.startsWith(ROUTES[SECTIONS.ORDERS])) return SECTIONS.ORDERS;
  if (pathname.startsWith(ROUTES[SECTIONS.INVENTORY])) return SECTIONS.INVENTORY;
  return SECTIONS.HOME;
}

export default function DispatcherShopPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobileDispatcher();
  const [moreOpen, setMoreOpen] = useState(false);

  const accountLabel = user?.name || user?.username || user?.email || "Dispatcher";
  const active = sectionFromPath(location.pathname);

  const navGroups = useMemo(
    () => [
      {
        label: "My Orders",
        items: [
          { key: SECTIONS.HOME, title: "Home", icon: "overview" },
          { key: SECTIONS.CATALOG, title: "Catalog", icon: "package" },
          { key: SECTIONS.CART, title: "Cart", icon: "cart" },
          { key: SECTIONS.ORDERS, title: "Orders", icon: "history" },
        ],
      },
      {
        label: "Inventory",
        items: [{ key: SECTIONS.INVENTORY, title: "Inventory", icon: "stock" }],
      },
    ],
    [],
  );

  // Subset for the mobile "More" drawer - Home/Catalog/Orders already live
  // in the bottom tab bar, so only Inventory (no dedicated tab, no dealer-
  // style Sales Register for dispatcher) needs to be here.
  const moreGroups = useMemo(
    () => [
      {
        label: "Operations",
        items: [{ key: SECTIONS.INVENTORY, title: "Inventory", icon: "stock" }],
      },
      { label: "Account", items: [{ key: "logout", title: "Logout", icon: "logout" }] },
    ],
    [],
  );

  function handleNavigate(item) {
    if (item.key === "logout") {
      logout();
      return;
    }
    navigate(ROUTES[item.key] || ROUTES[SECTIONS.HOME]);
  }

  return (
    <>
      <DashboardShell
        title="Dispatcher Orders"
        eyebrow="Meitu Dispatch"
        accountLabel={accountLabel}
        navGroups={navGroups}
        activeKey={active}
        onNavigate={handleNavigate}
        hideMobileTopbar={isMobile}
        mobileBleed={isMobile}
      >
        <DashboardUIStyles />
        <DealerMobileStylesCore />
        <DealerMobileStylesPages />
        <Outlet />
      </DashboardShell>

      {/* Rendered as siblings of DashboardShell, not children - matches
          DealerDashboardPage.jsx's own reasoning: .dashboard-content carries
          a transform during its entrance animation, which would constrain
          these fixed-position elements to its bounds instead of the
          viewport. */}
      {isMobile ? (
        <>
          <DispatcherBottomTabBar onMoreClick={() => setMoreOpen(true)} moreActive={!TAB_BAR_SECTIONS.has(active)} />
          <DispatcherCartPill />
          <MobileToastRenderer />
          <DealerMoreDrawer
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            groups={moreGroups}
            activeKey={active}
            onNavigate={(item) => {
              handleNavigate(item);
              setMoreOpen(false);
            }}
          />
        </>
      ) : null}
    </>
  );
}
