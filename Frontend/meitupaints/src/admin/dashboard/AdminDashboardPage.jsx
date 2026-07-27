import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import { useIsMobileAdmin } from "../mobile/useIsMobileAdmin.js";
import { AdminBottomTabBar } from "../mobile/AdminBottomTabBar.jsx";
import { AdminMobileStyles } from "../mobile/AdminMobileStyles.jsx";
import { AdminHomeMobileView } from "../mobile/AdminHomeMobileView.jsx";
import { AdminOrdersMobileView } from "../mobile/AdminOrdersMobileView.jsx";
import { AdminNotificationsMobileView } from "../mobile/AdminNotificationsMobileView.jsx";
import { AdminApplicationsMobileView } from "../mobile/AdminApplicationsMobileView.jsx";
import { AdminSalesMobileView } from "../mobile/AdminSalesMobileView.jsx";
import { AdminCouponsMobileView } from "../mobile/AdminCouponsMobileView.jsx";
import { AdminSettingsMobileView } from "../mobile/AdminSettingsMobileView.jsx";
import { AdminTrashMobileView } from "../mobile/AdminTrashMobileView.jsx";
// Reused directly, unmodified - same reasoning as DispatcherShopPage.jsx:
// these are pure, prop-driven/role-agnostic components with zero
// dealer-specific data coupling, and DealerMobileStylesCore/.pages carry
// every .dealer-m-* class this file's mobile chrome (tab bar, sheets,
// toast, more drawer) renders with - forking a second ~7,000-line CSS
// copy under an admin-m- prefix would be a maintenance liability with no
// visual upside. See DESIGN.md's "same token system" rule.
import { MobileToastRenderer } from "../../dealer/mobile/MobileToast.jsx";
import { DealerMoreDrawer } from "../../dealer/mobile/DealerMoreDrawer.jsx";
import { DealerMobileStylesCore } from "../../dealer/mobile/DealerMobileStyles.core.jsx";
import { DealerMobileStylesPages } from "../../dealer/mobile/DealerMobileStyles.pages.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  MetricTile,
  SectionHeader,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import {
  ReadOnlyAdminProvider,
  ReadOnlyAdminStyles,
  installReadOnlyAdminDomGuard,
  isReadOnlyAdminUser,
} from "../../components/dashboard/readOnlyAdminMode.jsx";
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
import AdminDealersPage from "./dealers/AdminDealersPage.jsx";
import AdminPaintersPage from "./painters/AdminPaintersPage.jsx";
import AdminAnnouncementsPage from "./network/AdminAnnouncementsPage.jsx";
import AdminPainterProfilePage from "./painters/AdminPainterProfilePage.jsx";
import AdminDispatcherProfilePage from "./dispatchers/AdminDispatcherProfilePage.jsx";
import AdminDispatchersPage from "./dispatchers/AdminDispatchersPage.jsx";
import AdminDispatcherStockPage from "./dispatchers/AdminDispatcherStockPage.jsx";
import AdminDispatcherOrdersPage from "./dispatchers/AdminDispatcherOrdersPage.jsx";
import AdminDispatcherSalesPurchasesPage from "./dispatchers/AdminDispatcherSalesPurchasesPage.jsx";
import AdminDispatcherProductHistoryPage from "./dispatchers/AdminDispatcherProductHistoryPage.jsx";
import AdminInsightsPage from "./insights/AdminInsightsPage.jsx";
import AdminOrderDetailPage from "./orders/AdminOrderDetailPage.jsx";
import AdminOrdersPage from "./orders/AdminOrdersPage.jsx";
import AdminSalesPage from "./sales/AdminSalesPage.jsx";
import AdminCouponsPage from "./coupons/AdminCouponsPage.jsx";
import AdminCouponBatchDetailPage from "./coupons/AdminCouponBatchDetailPage.jsx";
import AdminSettingsPage from "./AdminSettingsPage.jsx";
import AdminTrashPage from "./settings/AdminTrashPage.jsx";

import AdminDealerProfilePage from "./dealers/AdminDealerProfilePage.jsx";
import AdminDealerOrdersPage from "./dealers/AdminDealerOrdersPage.jsx";
import AdminDealerStockPage from "./dealers/AdminDealerStockPage.jsx";
import AdminDealerSalesPurchasesPage from "./dealers/AdminDealerSalesPurchasesPage.jsx";
import AdminDealerProductHistoryPage from "./dealers/AdminDealerProductHistoryPage.jsx";

const SECTIONS = {
  OVERVIEW: "overview",
  DRAFT_ORDER: "draftOrder",
  APPLICATIONS: "applications",
  DEALERS: "dealers",
  DISPATCHERS: "dispatchers",
  PAINTERS: "painters",
  ANNOUNCEMENTS: "announcements",
  ORDERS: "orders",
  SALES: "sales",
  COUPONS: "coupons",
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
  [SECTIONS.PAINTERS]: "/admin/dashboard/painters",
  [SECTIONS.ANNOUNCEMENTS]: "/admin/dashboard/announcements",
  [SECTIONS.ORDERS]: "/admin/dashboard/orders",
  [SECTIONS.SALES]: "/admin/dashboard/sales",
  [SECTIONS.COUPONS]: "/admin/dashboard/coupons",
  [SECTIONS.NOTIFICATIONS]: "/admin/dashboard/notifications",
  [SECTIONS.INSIGHTS]: "/admin/dashboard/insights",
  [SECTIONS.SETTINGS]: "/admin/dashboard/settings",
};

function badgeForCount(count, fallback = "") {
  const value = Number(count || 0);
  if (value <= 0) return fallback;
  return value > 99 ? "99+" : String(value);
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
  const loadError =
    dealerApplicationsQuery.error?.message ||
    dispatcherApplicationsQuery.error?.message ||
    factoryOrdersQuery.error?.message ||
    "";

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

  const navCards = [
    {
      icon: "inbox",
      title: "Review applications",
      desc: "Process dealer and dispatcher intake from one queue, then decide in a focused review workspace.",
      action: () => onNavigate(SECTIONS.APPLICATIONS),
      cta: "Open applications",
    },
    {
      icon: "orders",
      title: "Handle factory orders",
      desc: "Factory-routed submitted orders stay with admin; dispatcher-routed orders stay out of this lane.",
      action: () => onNavigate(SECTIONS.ORDERS),
      cta: "Open orders",
    },
    {
      icon: "store",
      title: "Review commercial accounts",
      desc: "Use dealer intelligence and rankings to prioritize high-value accounts and routing quality.",
      action: () => onNavigate(SECTIONS.DEALERS),
      cta: "Open dealers",
    },
  ];

  return (
    <div className="admin-overview-page">
      <Surface padding={26} className="admin-overview-hero dash-fade-up">
        <div className="admin-overview-hero-copy">
          <div className="admin-overview-eyebrow">
            <DashboardIcon name="overview" size={14} strokeWidth={2} />
            Admin Operations
          </div>
          <h1>Control center for today’s work.</h1>
          <p>
            {refreshing
              ? "Updating the cached operations pulse in the background."
              : "Applications, factory-routed orders, dealer network health, and unread notices in one calm workspace."}
          </p>
        </div>

        <div
          className="admin-overview-metrics"
        >
          <MetricTile
            icon="inbox"
            label="Dealer Applications"
            value={loading ? "…" : pulse.pendingDealerApplications}
            helper="Pending review"
            tone="accent"
          />
          <MetricTile
            icon="handshake"
            label="Dispatcher Applications"
            value={loading ? "…" : pulse.pendingDispatcherApplications}
            helper="Pending review"
          />
          <MetricTile
            icon="orders"
            label="Factory Orders"
            value={loading ? "…" : pulse.pendingFactoryOrders}
            helper="Submitted and factory-routed"
          />
          <MetricTile
            icon="bell"
            label="Unread"
            value={Number(totalUnread || 0)}
            helper={`${applicationUnread} application notices`}
            tone="accent"
          />
        </div>
      </Surface>

      {loadError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      ) : null}

      <div
        className="admin-overview-grid dash-fade-up"
      >
        <Surface padding={22} className="admin-overview-panel">
          <SectionHeader
            title="Operational Navigation"
            subtitle="Shortcuts to the work queues admins use most."
            size="small"
            icon="overview"
          />

          <div className="admin-overview-shortcuts">
            {navCards.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className={`admin-nav-card-row ${index === 0 ? "first" : ""}`}
              >
                <div className="admin-nav-card-icon">
                  <DashboardIcon name={item.icon} size={16} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="admin-nav-card-title">
                    {item.title}
                  </div>
                  <div className="admin-nav-card-desc">
                    {item.desc}
                  </div>
                </div>

                <div className="admin-nav-card-cta">
                  {item.cta}
                  <DashboardIcon name="chevron" size={13} />
                </div>
              </button>
            ))}
          </div>
        </Surface>

        <Surface padding={22} className="admin-overview-panel">
          <SectionHeader
            title="Recent Factory Queue"
            subtitle="Factory-routed orders currently waiting for admin attention."
            size="small"
            icon="orders"
          />

          <div className="admin-factory-queue">
            {loading ? (
              <div style={{ height: 120, borderRadius: 18, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
            ) : pulse.recentFactoryOrders.length ? (
              pulse.recentFactoryOrders.map((order) => (
                <button
                  key={order._id}
                  type="button"
                  onClick={() => onNavigate(SECTIONS.ORDERS)}
                  className="admin-factory-row"
                >
                  <div className="admin-factory-row-main">
                    <span className="admin-factory-row-icon">
                      <DashboardIcon name="orders" size={15} strokeWidth={2} />
                    </span>
                    <span className="admin-factory-row-order">{order.orderNumber || "Factory order"}</span>
                    <span className="admin-factory-row-total">
                      {Number(order?.totals?.total || 0).toLocaleString()}{" "}
                      {order?.totals?.currency || "NPR"}
                    </span>
                  </div>
                  <div className="admin-factory-row-meta">
                    {order?.dealerId?.companyName || "Dealer"} ·{" "}
                    {order?.payment?.method || "No payment method"}
                  </div>
                </button>
              ))
            ) : (
              <div className="admin-factory-empty">
                No submitted factory-routed orders need attention.
              </div>
            )}
          </div>
        </Surface>
      </div>

      <style>{`
        .admin-overview-page{
          display:grid;
          gap:20px;
        }
        .admin-overview-hero{
          position:relative;
          overflow:hidden;
          min-height:250px;
          background:
            radial-gradient(circle at 82% 12%, rgba(0,113,227,.15), transparent 28%),
            radial-gradient(circle at 72% 74%, rgba(89,102,128,.12), transparent 26%),
            linear-gradient(145deg, #ffffff 0%, #f5f5f7 100%) !important;
        }
        .admin-overview-hero-copy{
          position:relative;
          z-index:1;
          max-width:720px;
        }
        .admin-overview-eyebrow{
          display:inline-flex;
          align-items:center;
          gap:8px;
          color:var(--color-graphite,#707070);
          font-size:11px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }
        .admin-overview-hero h1{
          margin:10px 0 0;
          max-width:680px;
          color:var(--color-ink,#1d1d1f);
          font-size:clamp(34px, 5vw, 64px);
          line-height:1.03;
          letter-spacing:-.055em;
          font-weight:800;
        }
        .admin-overview-hero p{
          margin:14px 0 0;
          max-width:620px;
          color:var(--color-graphite,#707070);
          font-size:16px;
          line-height:1.55;
          font-weight:600;
        }
        .admin-overview-metrics{
          position:relative;
          z-index:1;
          margin-top:24px;
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));
          gap:12px;
        }
        .admin-overview-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(min(100%, 390px), 1fr));
          gap:20px;
          align-items:start;
        }
        .admin-overview-panel{
          min-height:100%;
        }
        .admin-overview-shortcuts,
        .admin-factory-queue{
          margin-top:16px;
          display:grid;
          gap:8px;
        }
        .admin-nav-card-row{
          display:grid;
          grid-template-columns:38px minmax(0,1fr) auto;
          gap:12px;
          align-items:center;
          padding:13px 10px;
          border:0;
          border-top:1px solid rgba(29,29,31,.06);
          background:transparent;
          text-align:left;
          cursor:pointer;
          border-radius:16px;
          transition:background .16s ease, transform .16s ease;
        }
        .admin-nav-card-row.first{
          border-top-color:transparent;
        }
        .admin-nav-card-row:hover{
          background:rgba(0,113,227,.045);
          transform:translateX(2px);
        }
        .admin-nav-card-row:active{
          transform:scale(.97);
        }
        .admin-nav-card-icon,
        .admin-factory-row-icon{
          width:38px;
          height:38px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:rgba(0,113,227,.08);
          color:var(--color-azure,#0071e3);
        }
        .admin-nav-card-title{
          color:var(--color-ink,#1d1d1f);
          font-size:14.5px;
          line-height:1.25;
          font-weight:800;
          letter-spacing:-.02em;
        }
        .admin-nav-card-desc{
          margin-top:3px;
          color:var(--color-graphite,#707070);
          font-size:12.5px;
          line-height:1.5;
          font-weight:600;
        }
        .admin-nav-card-cta{
          display:flex;
          align-items:center;
          gap:4px;
          color:var(--color-cobalt-link,#0066cc);
          font-size:12.5px;
          font-weight:700;
          white-space:nowrap;
        }
        .admin-factory-row{
          width:100%;
          text-align:left;
          padding:13px 14px;
          border-radius:18px;
          background:var(--color-fog,#f5f5f7);
          border:1px solid transparent;
          cursor:pointer;
          transition:background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .admin-factory-row:hover{
          background:#fff;
          border-color:rgba(29,29,31,.08);
          transform:translateY(-1px);
        }
        .admin-factory-row:active{
          transform:scale(.98);
        }
        .admin-factory-row-main{
          display:grid;
          grid-template-columns:38px minmax(0,1fr) auto;
          gap:10px;
          align-items:center;
        }
        .admin-factory-row-order{
          color:var(--color-ink,#1d1d1f);
          font-size:13.5px;
          font-weight:800;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .admin-factory-row-total{
          color:var(--color-ink,#1d1d1f);
          font-size:13px;
          font-weight:800;
          white-space:nowrap;
        }
        .admin-factory-row-meta{
          margin:5px 0 0 48px;
          color:var(--color-graphite,#707070);
          font-size:12px;
          line-height:1.5;
          font-weight:600;
        }
        .admin-factory-empty{
          padding:16px;
          border-radius:20px;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          font-size:13px;
          line-height:1.6;
          font-weight:600;
        }
        @media (max-width:720px){
          .admin-overview-hero{ min-height:0; }
          .admin-nav-card-row,
          .admin-factory-row-main{
            grid-template-columns:34px minmax(0,1fr);
          }
          .admin-nav-card-cta,
          .admin-factory-row-total{
            grid-column:2;
            justify-self:start;
          }
          .admin-factory-row-meta{ margin-left:44px; }
        }
        @media (prefers-reduced-motion: reduce){
          .admin-nav-card-row,
          .admin-factory-row{ transition:none!important; }
          .admin-nav-card-row:hover,
          .admin-nav-card-row:active,
          .admin-factory-row:hover,
          .admin-factory-row:active{ transform:none!important; }
        }
      `}</style>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const notificationCategories = notifications?.categories;
  const markCategoriesRead = notifications?.markCategoriesRead;
  const isMobile = useIsMobileAdmin();
  const isReadOnlyAdmin = isReadOnlyAdminUser(user);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isReadOnlyAdmin || typeof document === "undefined") return undefined;

    document.body.classList.add("admin-readonly-mode");
    const cleanupGuard = installReadOnlyAdminDomGuard();

    return () => {
      cleanupGuard?.();
      document.body.classList.remove("admin-readonly-mode");
    };
  }, [isReadOnlyAdmin, location.pathname]);

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
    if (path.startsWith("/admin/dashboard/painters")) {
      return SECTIONS.PAINTERS;
    }
    if (path.startsWith("/admin/dashboard/announcements")) {
      return SECTIONS.ANNOUNCEMENTS;
    }
    if (path.startsWith("/admin/dashboard/orders")) {
      return SECTIONS.ORDERS;
    }
    if (path.startsWith("/admin/dashboard/sales")) {
      return SECTIONS.SALES;
    }
    if (path.startsWith("/admin/dashboard/coupons")) {
      return SECTIONS.COUPONS;
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
    if (isReadOnlyAdmin) return;

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
  }, [activeSection, isReadOnlyAdmin, markCategoriesRead]);

  const navigationItems = useMemo(
    () => [
      {
        key: SECTIONS.OVERVIEW,
        title: "Overview",
        subtitle: "Operations summary",
        icon: "overview",
      },
      {
        key: SECTIONS.DRAFT_ORDER,
        title: "Draft Order",
        subtitle: "Price calculator",
        icon: "invoice",
      },
      {
        key: SECTIONS.APPLICATIONS,
        title: "Applications",
        subtitle: "Dealer and dispatcher intake",
        icon: "inbox",
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
        ),
      },
      {
        key: SECTIONS.ORDERS,
        title: "Orders",
        subtitle: "Factory and routing control",
        icon: "orders",
        badge: badgeForCount(
          notificationCategories?.[NOTIFICATION_CATEGORIES.FACTORY_ORDER],
        ),
      },
      {
        key: SECTIONS.SALES,
        title: "Sales",
        subtitle: "Fleet-wide dealer sales",
        icon: "chart",
      },
      {
        key: SECTIONS.COUPONS,
        title: "Coupons",
        subtitle: "QR coupon generation and redemptions",
        icon: "invoice",
      },
      {
        key: SECTIONS.DEALERS,
        title: "Dealers",
        subtitle: "Accounts and intelligence",
        icon: "store",
      },
      {
        key: SECTIONS.DISPATCHERS,
        title: "Dispatchers",
        subtitle: "Partner operations",
        icon: "handshake",
        badge: badgeForCount(
          notificationCategories?.[
            NOTIFICATION_CATEGORIES.DISPATCHER_REGISTRATION
          ],
        ),
      },
      {
        key: SECTIONS.PAINTERS,
        title: "Painters",
        subtitle: "Contact directory",
        icon: "user",
        badge: "",
      },
      {
        key: SECTIONS.ANNOUNCEMENTS,
        title: "Announcements",
        subtitle: "Notify the dealer/dispatcher network",
        icon: "bell",
        badge: "",
      },
      {
        key: SECTIONS.NOTIFICATIONS,
        title: "Notifications",
        subtitle: "Unread operational events",
        icon: "bell",
        badge: badgeForCount(notifications?.totalUnread, ""),
      },
      {
        key: SECTIONS.INSIGHTS,
        title: "Insights",
        subtitle: "Business intelligence workspace",
        icon: "chart",
        badge: "",
      },
      {
        key: SECTIONS.SETTINGS,
        title: "Settings",
        subtitle: "Email and notification config",
        icon: "gear",
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
          [SECTIONS.OVERVIEW, SECTIONS.APPLICATIONS, SECTIONS.ORDERS, SECTIONS.SALES, SECTIONS.COUPONS].includes(
            item.key,
          ) || item.key === SECTIONS.DRAFT_ORDER,
        ),
      },
      {
        label: "Network",
        items: navigationItems.filter((item) =>
          [SECTIONS.DEALERS, SECTIONS.DISPATCHERS, SECTIONS.PAINTERS, SECTIONS.ANNOUNCEMENTS, SECTIONS.INSIGHTS].includes(
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

  // Mobile-only "More" drawer (ADMIN_MOBILE_DESIGN_PROMPT.md §1) - Home/
  // Orders/Dealers already live on the bottom tab bar (Catalog is its own
  // top-level route, not a section here), so this holds the rest. The spec
  // names 8 sections explicitly and doesn't mention Draft Order, but it's a
  // real existing section (not something to silently drop) - grouped here
  // alongside the other quoting/settlement tools rather than invented a
  // 5th tab slot for it.
  const moreGroups = useMemo(
    () => [
      {
        label: "Operations",
        items: navigationItems.filter((item) =>
          [SECTIONS.APPLICATIONS, SECTIONS.SALES, SECTIONS.COUPONS, SECTIONS.DRAFT_ORDER].includes(item.key),
        ),
      },
      {
        label: "Network",
        items: navigationItems.filter((item) =>
          [SECTIONS.DISPATCHERS, SECTIONS.PAINTERS, SECTIONS.ANNOUNCEMENTS, SECTIONS.INSIGHTS].includes(item.key),
        ),
      },
      {
        label: "System",
        items: navigationItems.filter((item) =>
          [SECTIONS.NOTIFICATIONS, SECTIONS.SETTINGS].includes(item.key),
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
  // same reasoning as DispatcherShopPage.jsx's TAB_BAR_SECTIONS.
  const isTabBarSection = [SECTIONS.OVERVIEW, SECTIONS.ORDERS, SECTIONS.DEALERS].includes(activeSection);

  const renderContent = () => {
    const path = location.pathname;

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      /\/orders\/[^/]+$/.test(path)
    ) {
      return <AdminOrderDetailPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      path.endsWith("/orders")
    ) {
      return <AdminDealerOrdersPage />;
    }

    if (
      path.startsWith("/admin/dashboard/sales/") &&
      path.endsWith("/stock")
    ) {
      return <AdminDealerStockPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      path.endsWith("/stock")
    ) {
      return <AdminDealerStockPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      /\/sales-purchases\/[^/]+\/(purchases|sales|all)$/.test(path)
    ) {
      return <AdminDealerProductHistoryPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dealers/") &&
      path.endsWith("/sales-purchases")
    ) {
      return <AdminDealerSalesPurchasesPage />;
    }

    if (path.startsWith("/admin/dashboard/dealers/")) {
      return <AdminDealerProfilePage />;
    }

    if (path.startsWith("/admin/dashboard/painters/")) {
      return <AdminPainterProfilePage />;
    }

    if (path.startsWith("/admin/dashboard/coupons/batches/")) {
      return <AdminCouponBatchDetailPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dispatchers/") &&
      /\/sales-purchases\/[^/]+\/(purchases|sales)$/.test(path)
    ) {
      return <AdminDispatcherProductHistoryPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dispatchers/") &&
      path.endsWith("/sales-purchases")
    ) {
      return <AdminDispatcherSalesPurchasesPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dispatchers/") &&
      path.endsWith("/stock")
    ) {
      return <AdminDispatcherStockPage />;
    }

    if (
      path.startsWith("/admin/dashboard/dispatchers/") &&
      path.endsWith("/orders")
    ) {
      return <AdminDispatcherOrdersPage />;
    }

    if (path.startsWith("/admin/dashboard/dispatchers/")) {
      return <AdminDispatcherProfilePage />;
    }

    if (path === "/admin/dashboard/orders/reports") {
      return <Navigate to="/admin/dashboard/orders" replace />;
    }

    if (path.startsWith("/admin/dashboard/orders/")) {
      return <AdminOrderDetailPage />;
    }

    if (path === "/admin/dashboard/settings/trash") {
      return isMobile ? <AdminTrashMobileView onBack={() => navigate("/admin/dashboard/settings")} /> : <AdminTrashPage />;
    }

    switch (activeSection) {
      case SECTIONS.OVERVIEW:
        return isMobile ? (
          <AdminHomeMobileView onNavigate={handleNavigate} />
        ) : (
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
            enableOfficeExport
          />
        );

      case SECTIONS.APPLICATIONS:
        return isMobile ? <AdminApplicationsMobileView /> : <AdminApplicationsPage />;

      case SECTIONS.DEALERS:
        return <AdminDealersPage />;

      case SECTIONS.DISPATCHERS:
        return <AdminDispatchersPage />;

      case SECTIONS.PAINTERS:
        return <AdminPaintersPage />;

      case SECTIONS.ANNOUNCEMENTS:
        return <AdminAnnouncementsPage />;

      case SECTIONS.ORDERS:
        return isMobile ? <AdminOrdersMobileView /> : <AdminOrdersPage />;

      case SECTIONS.SALES:
        return isMobile ? <AdminSalesMobileView /> : <AdminSalesPage />;

      case SECTIONS.COUPONS:
        return isMobile ? <AdminCouponsMobileView /> : <AdminCouponsPage />;

      case SECTIONS.NOTIFICATIONS:
        return isMobile ? <AdminNotificationsMobileView /> : <NotificationCenterPage embedded />;

      case SECTIONS.INSIGHTS:
        return <AdminInsightsPage />;

      case SECTIONS.SETTINGS:
        return isMobile ? <AdminSettingsMobileView /> : <AdminSettingsPage />;

      default:
        return isMobile ? (
          <AdminHomeMobileView onNavigate={handleNavigate} />
        ) : (
          <DashboardOverview
            onNavigate={handleNavigate}
            notificationCategories={notificationCategories}
            totalUnread={notifications?.totalUnread}
          />
        );
    }
  };

  return (
    <ReadOnlyAdminProvider enabled={isReadOnlyAdmin}>
      <DashboardShell
        title="Admin Dashboard"
        eyebrow="Meitu Operations"
        accountLabel={
          isReadOnlyAdmin
            ? `${user?.email || "Meitu Paints operations"} · Read only`
            : user?.email || "Meitu Paints operations"
        }
        navGroups={navigationGroups}
        activeKey={activeSection}
        onNavigate={(item) => handleNavigate(item.key)}
        hideMobileTopbar={isMobile}
        mobileBleed={isMobile}
      >
        <DashboardUIStyles />
        <AdminMobileStyles />
        <DealerMobileStylesCore />
        <DealerMobileStylesPages />
        {isReadOnlyAdmin ? <ReadOnlyAdminStyles /> : null}
        {isMobile ? <div className="admin-m">{renderContent()}</div> : renderContent()}
      </DashboardShell>

      {/* Rendered as siblings of DashboardShell, not children - same
          reasoning as DispatcherShopPage.jsx: .dashboard-content carries a
          transform during its entrance animation, which would constrain
          these fixed-position elements to its bounds instead of the
          viewport. */}
      {isMobile ? (
        <>
          <AdminBottomTabBar onMoreClick={() => setMoreOpen(true)} moreActive={!isTabBarSection} />
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
              handleNavigate(item.key);
              setMoreOpen(false);
            }}
          />
        </>
      ) : null}
    </ReadOnlyAdminProvider>
  );
}
