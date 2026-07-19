import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { DashboardUIStyles } from "../components/dashboard/DashboardUI.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useIsMobileDealer } from "./mobile/useIsMobileDealer.js";
import { BottomTabBar } from "./mobile/BottomTabBar.jsx";
import { CartPill } from "./mobile/CartPill.jsx";
import { MobileToastRenderer } from "./mobile/MobileToast.jsx";
import { DealerMoreDrawer } from "./mobile/DealerMoreDrawer.jsx";
import { DealerMobileStylesCore } from "./mobile/DealerMobileStyles.core.jsx";
import { DealerMobileStylesPages } from "./mobile/DealerMobileStyles.pages.jsx";

const SECTIONS = {
  HOME: "home",
  CATALOG: "catalog",
  CART: "cart",
  ORDERS: "orders",
  INVENTORY: "inventory",
  SALES: "sales",
  LOGOUT: "logout",
};

const ROUTES = {
  [SECTIONS.HOME]: "/dealer",
  [SECTIONS.CATALOG]: "/dealer/catalog",
  [SECTIONS.CART]: "/dealer/cart",
  [SECTIONS.ORDERS]: "/dealer/orders",
  [SECTIONS.INVENTORY]: "/dealer/inventory",
  [SECTIONS.SALES]: "/dealer/sales",
};

// Sections that live behind the mobile bottom tab bar's own tabs, rather
// than the "More" drawer - used below to decide when the More trigger
// itself should read as active (spec: losing "where am I" the moment the
// current section isn't one of the visible tabs).
const TAB_BAR_SECTIONS = new Set([SECTIONS.HOME, SECTIONS.CATALOG, SECTIONS.ORDERS]);

function sectionFromPath(pathname = "") {
  if (pathname === ROUTES[SECTIONS.HOME] || pathname === `${ROUTES[SECTIONS.HOME]}/`) return SECTIONS.HOME;
  if (pathname.startsWith(ROUTES[SECTIONS.ORDERS])) return SECTIONS.ORDERS;
  if (pathname.startsWith(ROUTES[SECTIONS.CART])) return SECTIONS.CART;
  if (pathname.startsWith(ROUTES[SECTIONS.INVENTORY])) return SECTIONS.INVENTORY;
  if (pathname.startsWith(ROUTES[SECTIONS.SALES])) return SECTIONS.SALES;
  if (pathname.startsWith(ROUTES[SECTIONS.CATALOG])) return SECTIONS.CATALOG;
  // No silent default to Catalog: an unrecognized dealer route (spec §1.2's
  // "coupon routes" case, or any future addition) must fall through to
  // "unowned by any tab" so the More trigger picks up the active state
  // instead of a wrong tab quietly lighting up.
  return null;
}

export default function DealerDashboardPage({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const dealerProfile = useSelector((state) => state?.user?.dealerProfile || null);
  const isMobile = useIsMobileDealer();
  const [moreOpen, setMoreOpen] = useState(false);

  const active = sectionFromPath(location.pathname);
  const accountLabel = dealerProfile?.contactName || user?.email || user?.username || "Dealer";

  // Full nav, used by the desktop rail (DashboardShell's own render) -
  // unaffected by the mobile tab bar/drawer split below.
  const navGroups = [
    {
      label: "Sell",
      items: [
        { key: SECTIONS.HOME, title: "Home", icon: "home" },
        { key: SECTIONS.CATALOG, title: "Catalog", icon: "store" },
        { key: SECTIONS.CART, title: "Cart", icon: "package" },
        { key: SECTIONS.ORDERS, title: "Orders", icon: "orders" },
      ],
    },
    {
      label: "Sales",
      items: [{ key: SECTIONS.SALES, title: "Sales Register", icon: "chart" }],
    },
    {
      label: "Inventory",
      items: [{ key: SECTIONS.INVENTORY, title: "Inventory", icon: "stock" }],
    },
    {
      label: "Session",
      items: [{ key: SECTIONS.LOGOUT, title: "Logout", icon: "logout" }],
    },
  ];

  // Subset for the mobile "More" drawer - Home/Catalog/Orders already live
  // in the bottom tab bar, so only the sections without a dedicated
  // one-thumb entry point need to be here. Cart also has the floating pill
  // as a shortcut, but only once a draft exists - it stays listed here too
  // so an empty cart is still reachable. Grouped as Operations/Account per
  // spec §4.3 (a Coupons/Profile entry was in the spec's own example list,
  // but neither has a real destination in this app today, so they're
  // omitted rather than linking nowhere).
  const moreGroups = [
    {
      label: "Operations",
      items: [
        { key: SECTIONS.CART, title: "Cart", icon: "package" },
        { key: SECTIONS.INVENTORY, title: "Inventory", icon: "stock" },
        { key: SECTIONS.SALES, title: "Sales Register", icon: "chart" },
      ],
    },
    { label: "Account", items: [{ key: SECTIONS.LOGOUT, title: "Logout", icon: "logout" }] },
  ];

  function handleNavigate(item) {
    if (item.key === SECTIONS.LOGOUT) {
      logout();
      return;
    }
    navigate(ROUTES[item.key] || ROUTES[SECTIONS.CATALOG]);
  }

  return (
    <>
      <DashboardShell
        eyebrow="Meitu Dealer"
        title="Dealer Dashboard"
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
        {children}
      </DashboardShell>

      {/* Rendered as siblings of DashboardShell, not children - .dashboard-content
          carries a transform during its entrance animation, which would create a
          new containing block and constrain these fixed-position elements to its
          bounds instead of the viewport. */}
      {isMobile ? (
        <>
          <BottomTabBar onMoreClick={() => setMoreOpen(true)} moreActive={!TAB_BAR_SECTIONS.has(active)} />
          <CartPill />
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
