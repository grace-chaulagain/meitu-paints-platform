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
        href: "/dispatcher/dashboard",
      },
      {
        key: SECTIONS.DRAFT_ORDER,
        title: "Draft Order",
        subtitle: "Price calculator",
        badge: "Tool",
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
        href: "/dispatcher/dashboard/orders",
      },
      {
        key: SECTIONS.DEALERS,
        title: "Assigned Dealers",
        subtitle: "Assigned dealer network",
        badge: "Live",
        href: "/dispatcher/dashboard/dealers",
      },
      {
        key: SECTIONS.NOTIFICATIONS,
        title: "Notifications",
        subtitle: "Assigned order alerts",
        badge: badgeForCount(notifications?.totalUnread, ""),
        href: "/dispatcher/dashboard/notifications",
      },
      {
        key: SECTIONS.PROFILE,
        title: "Profile",
        subtitle: "Account and identity",
        badge: "",
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
      priorityText="Keep dispatcher operations lean: process assigned submitted orders quickly, clearly, and only within the authorized network scope."
    >
      <Outlet />
    </DashboardShell>
  );
}
