import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import {
  NOTIFICATION_CATEGORIES,
  useNotifications,
} from "../../notifications/notificationContext.js";

const SECTIONS = {
  OVERVIEW: "overview",
  DRAFT_ORDER: "draftOrder",
  ORDERS: "orders",
  DEALERS: "dealers",
  STOCK: "stock",
  ORDER_FROM_FACTORY: "orderFromFactory",
  ORDER_HISTORY: "orderHistory",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
};

function badgeForCount(count, fallback = "") {
  const value = Number(count || 0);
  if (value <= 0) return fallback;
  return value > 99 ? "99+" : String(value);
}

export default function DispatcherDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const notificationCategories = notifications?.categories;
  const markCategoriesRead = notifications?.markCategoriesRead;

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

    if (path.startsWith("/dispatcher/dashboard/draft-order")) {
      return SECTIONS.DRAFT_ORDER;
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

    if (path.startsWith("/dispatcher/dashboard/stock")) {
      return SECTIONS.STOCK;
    }

    if (path.startsWith("/dispatcher/dashboard/order/history")) {
      return SECTIONS.ORDER_HISTORY;
    }

    if (path.startsWith("/dispatcher/dashboard/order")) {
      return SECTIONS.ORDER_FROM_FACTORY;
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
        title: "Overview",
        subtitle: "Operational summary",
        badge: "Home",
        icon: "overview",
        href: "/dispatcher/dashboard",
      },
      {
        key: SECTIONS.DRAFT_ORDER,
        title: "Draft Order",
        subtitle: "Price calculator",
        badge: "Tool",
        icon: "invoice",
        href: "/dispatcher/dashboard/draft-order",
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
        key: SECTIONS.STOCK,
        title: "My Stock",
        subtitle: "Regional warehouse quantities",
        badge: "",
        icon: "stock",
        href: "/dispatcher/dashboard/stock",
      },
      {
        key: SECTIONS.ORDER_FROM_FACTORY,
        title: "Order",
        subtitle: "Replenish your stock",
        badge: "",
        icon: "package",
        href: "/dispatcher/dashboard/order",
      },
      {
        key: SECTIONS.ORDER_HISTORY,
        title: "Order History",
        subtitle: "Track factory orders",
        badge: "",
        icon: "history",
        href: "/dispatcher/dashboard/order/history",
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
          [SECTIONS.OVERVIEW, SECTIONS.DRAFT_ORDER, SECTIONS.ORDERS].includes(
            item.key,
          ),
        ),
      },
      {
        label: "Network",
        items: navigationItems.filter((item) =>
          [SECTIONS.DEALERS].includes(item.key),
        ),
      },
      {
        label: "Inventory",
        items: navigationItems.filter((item) =>
          [SECTIONS.STOCK, SECTIONS.ORDER_FROM_FACTORY, SECTIONS.ORDER_HISTORY].includes(item.key),
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

  useEffect(() => {
    if (activeSection === SECTIONS.ORDERS) {
      markCategoriesRead?.([NOTIFICATION_CATEGORIES.ASSIGNED_DEALER_ORDER])
        .catch(() => {});
    }
  }, [activeSection, markCategoriesRead]);

  return (
    <DashboardShell
      title="Dispatcher Dashboard"
      eyebrow="Meitu Dispatch"
      accountLabel={dispatcherName}
      navGroups={navigationGroups}
      activeKey={activeSection}
      onNavigate={(item) => navigate(item.href)}
    >
      <Outlet />
    </DashboardShell>
  );
}
