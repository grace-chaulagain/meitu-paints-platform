import { useLocation, useNavigate } from "react-router-dom";

import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { DashboardUIStyles } from "../components/dashboard/DashboardUI.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { NOTIFICATION_CATEGORIES, useNotifications } from "../notifications/notificationContext.js";

import FactoryOverviewPage from "./overview/FactoryOverviewPage.jsx";
import FactoryOrdersPage from "./orders/FactoryOrdersPage.jsx";
import FactoryStockPage from "./stock/FactoryStockPage.jsx";
import FactoryStockHistoryPage from "./stock-history/FactoryStockHistoryPage.jsx";
import FactoryNotificationsPage from "./notifications/FactoryNotificationsPage.jsx";
import FactoryProfilePage from "./profile/FactoryProfilePage.jsx";

const SECTIONS = {
  OVERVIEW: "overview",
  ORDERS: "orders",
  STOCK: "stock",
  STOCK_HISTORY: "stock-history",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
  LOGOUT: "logout",
};

const ROUTES = {
  [SECTIONS.OVERVIEW]: "/factory/dashboard/overview",
  [SECTIONS.ORDERS]: "/factory/dashboard/orders",
  [SECTIONS.STOCK]: "/factory/dashboard/stock",
  [SECTIONS.STOCK_HISTORY]: "/factory/dashboard/stock-history",
  [SECTIONS.NOTIFICATIONS]: "/factory/dashboard/notifications",
  [SECTIONS.PROFILE]: "/factory/dashboard/profile",
};

function sectionFromPath(pathname = "") {
  if (pathname.startsWith(ROUTES[SECTIONS.ORDERS])) return SECTIONS.ORDERS;
  if (pathname.startsWith(ROUTES[SECTIONS.STOCK_HISTORY])) return SECTIONS.STOCK_HISTORY;
  if (pathname.startsWith(ROUTES[SECTIONS.STOCK])) return SECTIONS.STOCK;
  if (pathname.startsWith(ROUTES[SECTIONS.NOTIFICATIONS])) return SECTIONS.NOTIFICATIONS;
  if (pathname.startsWith(ROUTES[SECTIONS.PROFILE])) return SECTIONS.PROFILE;
  return SECTIONS.OVERVIEW;
}

export default function FactoryDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const notifications = useNotifications();

  const active = sectionFromPath(location.pathname);
  const factoryOrderBadge = Number(notifications?.categories?.[NOTIFICATION_CATEGORIES.FACTORY_ORDER] || 0);

  const navGroups = [
    {
      label: "Operations",
      items: [
        { key: SECTIONS.OVERVIEW, title: "Overview", icon: "overview" },
        { key: SECTIONS.ORDERS, title: "Orders", icon: "orders", badge: factoryOrderBadge > 0 ? factoryOrderBadge : "" },
        { key: SECTIONS.STOCK, title: "Stock", icon: "stock" },
        { key: SECTIONS.STOCK_HISTORY, title: "Stock History", icon: "history" },
      ],
    },
    {
      label: "System",
      items: [
        { key: SECTIONS.NOTIFICATIONS, title: "Notifications", icon: "bell", badge: notifications?.totalUnread ? notifications.totalUnread : "" },
        { key: SECTIONS.PROFILE, title: "Profile", icon: "user" },
      ],
    },
    {
      label: "Session",
      items: [{ key: SECTIONS.LOGOUT, title: "Logout", icon: "logout" }],
    },
  ];

  function handleNavigate(item) {
    if (item.key === SECTIONS.LOGOUT) {
      logout();
      return;
    }
    navigate(ROUTES[item.key] || ROUTES[SECTIONS.OVERVIEW]);
  }

  function goTo(key) {
    navigate(ROUTES[key] || ROUTES[SECTIONS.OVERVIEW]);
  }

  return (
    <DashboardShell
      eyebrow="Meitu Operations"
      title="Factory Dashboard"
      accountLabel={user?.email || user?.username || "Factory"}
      navGroups={navGroups}
      activeKey={active}
      onNavigate={handleNavigate}
    >
      <DashboardUIStyles />
      {active === SECTIONS.OVERVIEW ? <FactoryOverviewPage onNavigate={goTo} /> : null}
      {active === SECTIONS.ORDERS ? <FactoryOrdersPage /> : null}
      {active === SECTIONS.STOCK ? <FactoryStockPage /> : null}
      {active === SECTIONS.STOCK_HISTORY ? <FactoryStockHistoryPage /> : null}
      {active === SECTIONS.NOTIFICATIONS ? <FactoryNotificationsPage /> : null}
      {active === SECTIONS.PROFILE ? <FactoryProfilePage /> : null}
    </DashboardShell>
  );
}
