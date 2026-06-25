import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import {
  useGetAdminDealerApplicationsQuery,
  useGetAdminDispatcherApplicationsQuery,
  useGetAdminScopedOrdersQuery,
} from "../../redux/api/meituApi.js";
import DraftOrderUtilityPage from "../../components/dashboard/DraftOrderUtilityPage.jsx";
import {
  NOTIFICATION_CATEGORIES,
  useNotifications,
} from "../../notifications/notificationContext.js";

import NotificationCenterPage from "../../notifications/NotificationCenterPage.jsx";
import AdminApplicationsPage from "./applications/AdminApplicationsPage.jsx";
import AdminDealerApplicationsPage from "./dealers/AdminDealerApplicationsPage.jsx";
import AdminDealersPage from "./dealers/AdminDealersPage.jsx";
import AdminDispatcherProfilePage from "./dispatchers/AdminDispatcherProfilePage.jsx";
import AdminDispatchersPage from "./dispatchers/AdminDispatchersPage.jsx";
import AdminInsightsPage from "./insights/AdminInsightsPage.jsx";
import AdminOrderReportsPage from "./orders/AdminOrderReportsPage.jsx";
import AdminOrdersPage from "./orders/AdminOrdersPage.jsx";
import AdminSettingsPage from "./AdminSettingsPage.jsx";
import AdminTrashPage from "./settings/AdminTrashPage.jsx";

import AdminDealerProfilePage from "./dealers/AdminDealerProfilePage.jsx";
import AdminDealerOrdersPage from "./dealers/AdminDealerOrdersPage.jsx";

const SECTIONS = {
  OVERVIEW: "overview",
  DRAFT_ORDER: "draftOrder",
  APPLICATIONS: "applications",
  DEALERS: "dealers",
  DISPATCHERS: "dispatchers",
  ORDERS: "orders",
  NOTIFICATIONS: "notifications",
  INSIGHTS: "insights",
  SETTINGS: "settings",
};

const SECTION_ROUTE_MAP = {
  [SECTIONS.OVERVIEW]: "/admin/dashboard",
  [SECTIONS.DRAFT_ORDER]: "/admin/dashboard/draft-order",
  [SECTIONS.APPLICATIONS]: "/admin/dashboard/applications",
  [SECTIONS.DEALERS]: "/admin/dashboard/dealers",
  [SECTIONS.DISPATCHERS]: "/admin/dashboard/dispatchers",
  [SECTIONS.ORDERS]: "/admin/dashboard/orders",
  [SECTIONS.NOTIFICATIONS]: "/admin/dashboard/notifications",
  [SECTIONS.INSIGHTS]: "/admin/dashboard/insights",
  [SECTIONS.SETTINGS]: "/admin/dashboard/settings",
};

function badgeForCount(count, fallback = "") {
  const value = Number(count || 0);
  if (value <= 0) return fallback;
  return value > 99 ? "99+" : String(value);
}

function GlassCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({ label, value, helper = "", accent = false }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "16px 18px",
        background: accent ? "rgba(180,35,24,.06)" : "rgba(248,250,252,.95)",
        border: accent
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.46)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
      {helper ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.54)",
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            lineHeight: 1.65,
            fontWeight: 700,
            color: "rgba(15,23,42,.58)",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function DashboardOverview({ onNavigate, notificationCategories, totalUnread }) {
  const dealerApplicationsQuery = useGetAdminDealerApplicationsQuery({
    status: "PENDING",
    limit: 5,
  });
  const dispatcherApplicationsQuery = useGetAdminDispatcherApplicationsQuery({
    status: "PENDING",
    limit: 5,
  });
  const factoryOrdersQuery = useGetAdminScopedOrdersQuery({
    status: "SUBMITTED",
    fulfillmentMode: "FACTORY",
    limit: 5,
  });

  const pulse = useMemo(() => {
    const dealerApplications = dealerApplicationsQuery.data || {};
    const dispatcherApplications = dispatcherApplicationsQuery.data || {};
    const factoryOrders = factoryOrdersQuery.data || {};

    return {
      pendingDealerApplications:
        dealerApplications.total ?? dealerApplications.items?.length ?? 0,
      pendingDispatcherApplications:
        dispatcherApplications.total ?? dispatcherApplications.items?.length ?? 0,
      pendingFactoryOrders: factoryOrders.total ?? factoryOrders.items?.length ?? 0,
      recentFactoryOrders: factoryOrders.items || [],
    };
  }, [dealerApplicationsQuery.data, dispatcherApplicationsQuery.data, factoryOrdersQuery.data]);

  const hasCachedPulse = Boolean(
    dealerApplicationsQuery.data ||
      dispatcherApplicationsQuery.data ||
      factoryOrdersQuery.data,
  );
  const loading =
    !hasCachedPulse &&
    (dealerApplicationsQuery.isLoading ||
      dispatcherApplicationsQuery.isLoading ||
      factoryOrdersQuery.isLoading);
  const refreshing =
    hasCachedPulse &&
    (dealerApplicationsQuery.isFetching ||
      dispatcherApplicationsQuery.isFetching ||
      factoryOrdersQuery.isFetching);

  const applicationUnread =
    Number(
      notificationCategories?.[NOTIFICATION_CATEGORIES.DEALER_REGISTRATION] ||
        0,
    ) +
    Number(
      notificationCategories?.[
        NOTIFICATION_CATEGORIES.DISPATCHER_REGISTRATION
      ] || 0,
    );

  return (
    <div style={{ display: "grid", gap: 20, marginTop: 0, paddingTop: 0 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Operations Overview"
          subtitle={refreshing ? "Updating the cached operations pulse in the background." : "The focus layer for what needs attention now: applications, factory-routed orders, and unread operational notifications."}
        />

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            label="Dealer Applications"
            value={loading ? "…" : pulse.pendingDealerApplications}
            helper="Pending review"
            accent
          />
          <MetricCard
            label="Dispatcher Applications"
            value={loading ? "…" : pulse.pendingDispatcherApplications}
            helper="Pending review"
          />
          <MetricCard
            label="Factory Orders"
            value={loading ? "…" : pulse.pendingFactoryOrders}
            helper="Submitted and factory-routed"
          />
          <MetricCard
            label="Unread"
            value={Number(totalUnread || 0)}
            helper={`${applicationUnread} application notices`}
            accent
          />
        </div>
      </GlassCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <GlassCard style={{ padding: 24 }}>
          <SectionHeader
            title="Operational Navigation"
            subtitle="The workspace is intentionally shallow here. Deep work lives inside the module pages."
          />

          <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
            {[
              {
                title: "Review applications",
                desc: "Process dealer and dispatcher applications from one intake point, then use focused review workspaces for decisions.",
                action: () => onNavigate(SECTIONS.APPLICATIONS),
                cta: "Open applications",
              },
              {
                title: "Handle factory orders",
                desc: "Factory-routed submitted orders stay with admin. Dispatcher-routed orders stay out of this lane.",
                action: () => onNavigate(SECTIONS.ORDERS),
                cta: "Open orders",
              },
              {
                title: "Review commercial accounts",
                desc: "Use dealer intelligence and rankings to prioritize high-value accounts, inactive dealers, and routing quality.",
                action: () => onNavigate(SECTIONS.DEALERS),
                cta: "Open dealers",
              },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px minmax(0,1fr) auto",
                  gap: 14,
                  alignItems: "start",
                  padding: "14px 0",
                  borderTop:
                    index === 0 ? "none" : "1px solid rgba(15,23,42,.06)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(180,35,24,.08)",
                    color: "#b42318",
                    fontWeight: 950,
                    fontSize: 13,
                  }}
                >
                  {index + 1}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#0f172a",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      lineHeight: 1.7,
                      fontWeight: 700,
                      color: "rgba(15,23,42,.58)",
                    }}
                  >
                    {item.desc}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={item.action}
                  style={{
                    height: 38,
                    padding: "0 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(15,23,42,.08)",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 24 }}>
          <SectionHeader
            title="Recent Factory Queue"
            subtitle="A compact snapshot of the factory-routed orders currently waiting for admin attention."
          />

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {pulse.recentFactoryOrders.length ? (
              pulse.recentFactoryOrders.map((order) => (
                <button
                  key={order._id}
                  type="button"
                  onClick={() => onNavigate(SECTIONS.ORDERS)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(248,250,252,.95)",
                    border: "1px solid rgba(15,23,42,.06)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      fontSize: 13,
                      fontWeight: 950,
                      color: "#0f172a",
                    }}
                  >
                    <span>{order.orderNumber || "Factory order"}</span>
                    <span>
                      {Number(order?.totals?.total || 0).toLocaleString()}{" "}
                      {order?.totals?.currency || "NPR"}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      lineHeight: 1.55,
                      fontWeight: 700,
                      color: "rgba(15,23,42,.56)",
                    }}
                  >
                    {order?.dealerId?.companyName || "Dealer"} ·{" "}
                    {order?.payment?.method || "No payment method"}
                  </div>
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "rgba(248,250,252,.95)",
                  border: "1px solid rgba(15,23,42,.06)",
                  fontSize: 13,
                  lineHeight: 1.65,
                  fontWeight: 700,
                  color: "rgba(15,23,42,.62)",
                }}
              >
                No submitted factory-routed orders need attention.
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const notificationCategories = notifications?.categories;
  const markCategoriesRead = notifications?.markCategoriesRead;

  const activeSection = useMemo(() => {
    const path = location.pathname;

    if (path === "/admin/dashboard" || path === "/admin/dashboard/") {
      return SECTIONS.OVERVIEW;
    }
    if (path.startsWith("/admin/dashboard/draft-order")) {
      return SECTIONS.DRAFT_ORDER;
    }
    if (path.startsWith("/admin/dashboard/applications")) {
      return SECTIONS.APPLICATIONS;
    }
    if (path.startsWith("/admin/dashboard/dealers")) {
      return SECTIONS.DEALERS;
    }
    if (path.startsWith("/admin/dashboard/dispatchers")) {
      return SECTIONS.DISPATCHERS;
    }
    if (path.startsWith("/admin/dashboard/orders")) {
      return SECTIONS.ORDERS;
    }
    if (path.startsWith("/admin/dashboard/notifications")) {
      return SECTIONS.NOTIFICATIONS;
    }
    if (path.startsWith("/admin/dashboard/insights")) {
      return SECTIONS.INSIGHTS;
    }
    if (path.startsWith("/admin/dashboard/settings")) {
      return SECTIONS.SETTINGS;
    }

    return SECTIONS.OVERVIEW;
  }, [location.pathname]);

  const handleNavigate = (sectionKey) => {
    navigate(SECTION_ROUTE_MAP[sectionKey] || "/admin/dashboard");
  };

  useEffect(() => {
    const categoryMap = {
      [SECTIONS.APPLICATIONS]: [
        NOTIFICATION_CATEGORIES.DEALER_REGISTRATION,
        NOTIFICATION_CATEGORIES.DISPATCHER_REGISTRATION,
      ],
      [SECTIONS.ORDERS]: [NOTIFICATION_CATEGORIES.FACTORY_ORDER],
    };

    const categories = categoryMap[activeSection];
    if (categories?.length) {
      markCategoriesRead?.(categories).catch(() => {});
    }
  }, [activeSection, markCategoriesRead]);

  const navigationItems = useMemo(
    () => [
      {
        key: SECTIONS.OVERVIEW,
        title: "Overview",
        subtitle: "Operations summary",
        badge: "Home",
      },
      {
        key: SECTIONS.DRAFT_ORDER,
        title: "Draft Order",
        subtitle: "Price calculator",
        badge: "Tool",
      },
      {
        key: SECTIONS.APPLICATIONS,
        title: "Applications",
        subtitle: "Dealer and dispatcher intake",
        badge: badgeForCount(
          Number(
            notificationCategories?.[
              NOTIFICATION_CATEGORIES.DEALER_REGISTRATION
            ] || 0,
          ) +
            Number(
              notificationCategories?.[
                NOTIFICATION_CATEGORIES.DISPATCHER_REGISTRATION
              ] || 0,
            ),
          "Live",
        ),
      },
      {
        key: SECTIONS.ORDERS,
        title: "Orders",
        subtitle: "Factory and routing control",
        badge: badgeForCount(
          notificationCategories?.[NOTIFICATION_CATEGORIES.FACTORY_ORDER],
          "Live",
        ),
      },
      {
        key: SECTIONS.DEALERS,
        title: "Dealers",
        subtitle: "Accounts and intelligence",
        badge: "Live",
      },
      {
        key: SECTIONS.DISPATCHERS,
        title: "Dispatchers",
        subtitle: "Partner operations",
        badge: badgeForCount(
          notificationCategories?.[
            NOTIFICATION_CATEGORIES.DISPATCHER_REGISTRATION
          ],
          "Live",
        ),
      },
      {
        key: SECTIONS.NOTIFICATIONS,
        title: "Notifications",
        subtitle: "Unread operational events",
        badge: badgeForCount(notifications?.totalUnread, ""),
      },
      {
        key: SECTIONS.INSIGHTS,
        title: "Insights",
        subtitle: "Business intelligence workspace",
        badge: "",
      },
      {
        key: SECTIONS.SETTINGS,
        title: "Settings",
        subtitle: "Email and notification config",
        badge: "",
      },
    ],
    [notificationCategories, notifications?.totalUnread],
  );

  const navigationGroups = useMemo(
    () => [
      {
        label: "Workspace",
        items: navigationItems.filter((item) =>
          [SECTIONS.OVERVIEW, SECTIONS.APPLICATIONS, SECTIONS.ORDERS].includes(
            item.key,
          ) || item.key === SECTIONS.DRAFT_ORDER,
        ),
      },
      {
        label: "Network",
        items: navigationItems.filter((item) =>
          [SECTIONS.DEALERS, SECTIONS.DISPATCHERS, SECTIONS.INSIGHTS].includes(
            item.key,
          ),
        ),
      },
      {
        label: "System",
        items: navigationItems.filter((item) =>
          [SECTIONS.NOTIFICATIONS, SECTIONS.SETTINGS].includes(item.key),
        ),
      },
    ],
    [navigationItems],
  );

  const renderContent = () => {
    const path = location.pathname;

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      path.endsWith("/orders")
    ) {
      return <AdminDealerOrdersPage />;
    }

    if (path.startsWith("/admin/dashboard/dealers/")) {
      return <AdminDealerProfilePage />;
    }

    if (path.startsWith("/admin/dashboard/dispatchers/")) {
      return <AdminDispatcherProfilePage />;
    }

    if (path === "/admin/dashboard/applications/dealers") {
      return <AdminDealerApplicationsPage />;
    }

    if (path === "/admin/dashboard/applications/dispatchers") {
      return <AdminDispatchersPage />;
    }

    if (path === "/admin/dashboard/orders/reports") {
      return <AdminOrderReportsPage />;
    }

    if (path === "/admin/dashboard/settings/trash") {
      return <AdminTrashPage />;
    }

    switch (activeSection) {
      case SECTIONS.OVERVIEW:
        return (
          <DashboardOverview
            onNavigate={handleNavigate}
            notificationCategories={notificationCategories}
            totalUnread={notifications?.totalUnread}
          />
        );

      case SECTIONS.DRAFT_ORDER:
        return (
          <DraftOrderUtilityPage
            roleLabel="Admin Utility"
            title="Draft Order"
            subtitle="Calculate product totals for internal quoting and order preparation. This page does not submit dealer orders."
          />
        );

      case SECTIONS.APPLICATIONS:
        return <AdminApplicationsPage />;

      case SECTIONS.DEALERS:
        return <AdminDealersPage />;

      case SECTIONS.DISPATCHERS:
        return <AdminDispatchersPage />;

      case SECTIONS.ORDERS:
        return <AdminOrdersPage />;

      case SECTIONS.NOTIFICATIONS:
        return <NotificationCenterPage embedded />;

      case SECTIONS.INSIGHTS:
        return <AdminInsightsPage />;

      case SECTIONS.SETTINGS:
        return <AdminSettingsPage />;

      default:
        return (
          <DashboardOverview
            onNavigate={handleNavigate}
            notificationCategories={notificationCategories}
            totalUnread={notifications?.totalUnread}
          />
        );
    }
  };

  return (
    <DashboardShell
      title="Admin Dashboard"
      eyebrow="Meitu Operations"
      accountLabel={user?.email || "Meitu Paints operations"}
      navGroups={navigationGroups}
      activeKey={activeSection}
      onNavigate={(item) => handleNavigate(item.key)}
      priorityText="Onboarding, dealer intelligence, and order handling are live. Keep the workspace focused on routing clarity, notification hygiene, and dealer-specific admin decisions."
    >
      {renderContent()}
    </DashboardShell>
  );
}
