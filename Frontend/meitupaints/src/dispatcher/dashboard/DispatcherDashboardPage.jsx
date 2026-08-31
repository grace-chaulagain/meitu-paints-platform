import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import { DashboardUIStyles } from "../../components/dashboard/DashboardUI.jsx";
import {
  NOTIFICATION_CATEGORIES,
  useNotifications,
} from "../../notifications/notificationContext.js";
import { useIsMobileDispatcher } from "../mobile/useIsMobileDispatcher.js";
import { DispatcherOpsBottomTabBar } from "./mobile/DispatcherOpsBottomTabBar.jsx";
// Reused directly, not forked - see DispatcherOpsBottomTabBar.jsx's own
// header comment and the plan doc this rewrite was built from: Admin's
// mobile stylesheet already declares only the handful of rules genuinely
// admin-specific and reuses Dealer's .dealer-m-* classes/components for
// everything structural, so this dashboard shares that same design system
// directly (the .admin-m class wrapper below) instead of forking a third
// near-identical stylesheet.
import { AdminMobileStyles } from "../../admin/mobile/AdminMobileStyles.jsx";
import { MobileToastRenderer } from "../../dealer/mobile/MobileToast.jsx";
import { DealerMoreDrawer } from "../../dealer/mobile/DealerMoreDrawer.jsx";
import { DealerMobileStylesCore } from "../../dealer/mobile/DealerMobileStyles.core.jsx";
import { DealerMobileStylesPages } from "../../dealer/mobile/DealerMobileStyles.pages.jsx";

// This is strictly the "handle assigned dealer orders" workspace - placing
// the dispatcher's own replenishment orders (catalog/cart/order history/
// inventory) lives entirely separately under /dispatcher (DispatcherShopPage),
// not nested here. Keeping the two apart means a dispatcher reviewing orders
// never has "buy stock from the factory" navigation in the same sidebar as
// "verify/dispatch a dealer's order".
const SECTIONS = {
  OVERVIEW: "overview",
  ORDERS: "orders",
  DEALERS: "dealers",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
};

function badgeForCount(count, fallback = "") {
  const value = Number(count || 0);
  if (value <= 0) return fallback;
  return value > 99 ? "99+" : String(value);
}

export default function DispatcherDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const notificationCategories = notifications?.categories;
  const markCategoriesRead = notifications?.markCategoriesRead;
  const isMobile = useIsMobileDispatcher();
  const [moreOpen, setMoreOpen] = useState(false);

  const dispatcherName = useMemo(() => {
    return (
      user?.name ||
      user?.username ||
      user?.fullName ||
      user?.email ||
      "Dispatcher"
    );
  }, [user]);

  const activeSection = useMemo(() => {
    const path = location.pathname;

    if (path === "/dispatcher/dashboard" || path === "/dispatcher/dashboard/") {
      return SECTIONS.OVERVIEW;
    }

    if (
      path.startsWith("/dispatcher/dashboard/orders") ||
      (path.includes("/dispatcher/dashboard/dealers/") &&
        path.endsWith("/orders"))
    ) {
      return SECTIONS.ORDERS;
    }

    if (path.startsWith("/dispatcher/dashboard/dealers")) {
      return SECTIONS.DEALERS;
    }

    if (path.startsWith("/dispatcher/dashboard/notifications")) {
      return SECTIONS.NOTIFICATIONS;
    }

    if (path.startsWith("/dispatcher/dashboard/profile")) {
      return SECTIONS.PROFILE;
    }

    return SECTIONS.OVERVIEW;
  }, [location.pathname]);

  const navigationItems = useMemo(
    () => [
      {
        key: SECTIONS.OVERVIEW,
        title: "Home",
        subtitle: "Operational summary",
        badge: "",
        icon: "overview",
        href: "/dispatcher/dashboard",
      },
      {
        key: SECTIONS.ORDERS,
        title: "Orders",
        subtitle: "Assigned order processing",
        badge: badgeForCount(
          notificationCategories?.[
            NOTIFICATION_CATEGORIES.ASSIGNED_DEALER_ORDER
          ],
          "Live",
        ),
        icon: "orders",
        href: "/dispatcher/dashboard/orders",
      },
      {
        key: SECTIONS.DEALERS,
        title: "Assigned Dealers",
        subtitle: "Assigned dealer network",
        badge: "Live",
        icon: "store",
        href: "/dispatcher/dashboard/dealers",
      },
      {
        key: SECTIONS.NOTIFICATIONS,
        title: "Notifications",
        subtitle: "Assigned order alerts",
        badge: badgeForCount(notifications?.totalUnread, ""),
        icon: "bell",
        href: "/dispatcher/dashboard/notifications",
      },
      {
        key: SECTIONS.PROFILE,
        title: "Profile",
        subtitle: "Account and identity",
        badge: "",
        icon: "user",
        href: "/dispatcher/dashboard/profile",
      },
    ],
    [notificationCategories, notifications?.totalUnread],
  );

  const navigationGroups = useMemo(
    () => [
      {
        label: "Workspace",
        items: navigationItems.filter((item) =>
          [SECTIONS.OVERVIEW, SECTIONS.ORDERS].includes(item.key),
        ),
      },
      {
        label: "Network",
        items: navigationItems.filter((item) =>
          [SECTIONS.DEALERS].includes(item.key),
        ),
      },
      {
        label: "System",
        items: navigationItems.filter((item) =>
          [SECTIONS.NOTIFICATIONS, SECTIONS.PROFILE].includes(item.key),
        ),
      },
    ],
    [navigationItems],
  );

  // Home/Orders/Dealers live on the bottom tab bar; this holds the rest -
  // same "everything not on the tab bar" grouping AdminDashboardPage.jsx
  // uses for its own More drawer.
  const moreGroups = useMemo(
    () => [
      {
        label: "System",
        items: navigationItems.filter((item) =>
          [SECTIONS.NOTIFICATIONS, SECTIONS.PROFILE].includes(item.key),
        ),
      },
      {
        label: "Account",
        items: [{ key: "logout", title: "Logout", icon: "logout" }],
      },
    ],
    [navigationItems],
  );

  // Tab-bar-owned sections - everything else reads as "More" being active,
  // same reasoning as AdminDashboardPage.jsx's isTabBarSection.
  const isTabBarSection = [SECTIONS.OVERVIEW, SECTIONS.ORDERS, SECTIONS.DEALERS].includes(activeSection);

  useEffect(() => {
    if (activeSection === SECTIONS.ORDERS) {
      markCategoriesRead?.([NOTIFICATION_CATEGORIES.ASSIGNED_DEALER_ORDER])
        .catch(() => {});
    }
  }, [activeSection, markCategoriesRead]);

  return (
    <>
      <DashboardShell
        title="Dispatcher Dashboard"
        eyebrow="Meitu Dispatch"
        accountLabel={dispatcherName}
        navGroups={navigationGroups}
        activeKey={activeSection}
        onNavigate={(item) => navigate(item.href)}
        hideMobileTopbar={isMobile}
        mobileBleed={isMobile}
      >
        <DashboardUIStyles />
        <AdminMobileStyles />
        <DealerMobileStylesCore />
        <DealerMobileStylesPages />
        {isMobile ? <div className="admin-m"><Outlet /></div> : <Outlet />}
      </DashboardShell>

      {/* Rendered as siblings of DashboardShell, not children - same
          reasoning AdminDashboardPage.jsx documents: .dashboard-content
          carries a transform during its entrance animation, which would
          constrain these fixed-position elements to its bounds instead of
          the viewport. */}
      {isMobile ? (
        <>
          <DispatcherOpsBottomTabBar onMoreClick={() => setMoreOpen(true)} moreActive={!isTabBarSection} />
          <MobileToastRenderer />
          <DealerMoreDrawer
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            groups={moreGroups}
            activeKey={activeSection}
            onNavigate={(item) => {
              if (item.key === "logout") {
                logout();
                return;
              }
              navigate(item.href);
              setMoreOpen(false);
            }}
          />
        </>
      ) : null}
    </>
  );
}
