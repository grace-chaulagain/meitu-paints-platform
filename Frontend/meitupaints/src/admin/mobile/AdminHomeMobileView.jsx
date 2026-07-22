import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { useCountUp } from "../../dealer/mobile/useCountUp.js";
import { TrendChart } from "../dashboard/insights/InsightsPrimitives.jsx";
import { isoDate, money, rangeForPreset } from "../dashboard/insights/insightsFormatting.js";
import {
  useGetAdminInsightsQuery,
  useGetAdminDealerApplicationsQuery,
  useGetAdminDispatcherApplicationsQuery,
  useGetAdminScopedOrdersQuery,
  useGetStockQuery,
  useGetAllStockHistoryQuery,
} from "../../redux/api/meituApi.js";

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function HomeStat({ value, label, format }) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : Math.round(animated).toLocaleString();
  return (
    <div className="dealer-m-home-stat">
      <div className="dealer-m-home-stat-value">{display}</div>
      <div className="dealer-m-home-stat-label">{label}</div>
    </div>
  );
}

const TREND_PERIODS = [
  { key: "7d", label: "Week" },
  { key: "30d", label: "Month" },
  { key: "90d", label: "Quarter" },
];

const QUICK_ACTIONS = [
  { key: "applications", icon: "inbox", label: "Applications", section: "applications" },
  { key: "draftOrder", icon: "invoice", label: "Draft Order", section: "draftOrder" },
  { key: "catalog", icon: "overview", label: "Catalog", route: "/admin/products" },
  { key: "insights", icon: "chart", label: "Insights", section: "insights" },
];

// ADMIN_MOBILE_DESIGN_PROMPT.md §2 "Morning Brief" - every number here reads
// from a real endpoint already used elsewhere in the admin app (see the
// research trail in this session: no "Fulfillment %" or "Painter
// verifications" field exists anywhere in the codebase, so neither is
// invented here - the hero's third stat is "Verified Today" instead of a
// fabricated fulfillment rate, and the attention shelf uses 5 real queues
// (including dispatcher applications, alongside the dealer one
// DashboardOverview already fetches) rather than a 5th fake "painter
// verification" card - painters have no approval workflow, only account
// standing (see AdminPaintersPage.jsx's painterIdStatusKey comment).
export function AdminHomeMobileView({ onNavigate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const adminName = user?.name || user?.username || (user?.email ? String(user.email).split("@")[0] : "there");
  const [trendPeriod, setTrendPeriod] = useState("7d");

  const today = isoDate(new Date());
  const todayInsightsQuery = useGetAdminInsightsQuery({
    range: "custom",
    from: today,
    to: today,
    status: "ALL",
    routing: "ALL",
    dealerState: "ALL",
  });

  const trendRange = useMemo(() => rangeForPreset(trendPeriod), [trendPeriod]);
  const trendInsightsQuery = useGetAdminInsightsQuery({
    range: trendPeriod,
    from: trendRange.from,
    to: trendRange.to,
    status: "ALL",
    routing: "ALL",
    dealerState: "ALL",
  });

  // Shares RTK Query's cache with AdminBottomTabBar.jsx / DashboardOverview's
  // identical calls - no duplicate network traffic for these three.
  const factoryOrdersQuery = useGetAdminScopedOrdersQuery({ status: "SUBMITTED", fulfillmentMode: "FACTORY", limit: 5 });
  const readyToDispatchQuery = useGetAdminScopedOrdersQuery({ status: "VERIFIED", limit: 1 });
  const dealerApplicationsQuery = useGetAdminDealerApplicationsQuery({ status: "PENDING", limit: 5 });
  const dispatcherApplicationsQuery = useGetAdminDispatcherApplicationsQuery({ status: "PENDING", limit: 5 });
  // status:"ALL" - a filtered call only returns ONE of lowStock/outOfStock
  // (stock.service.js computes `summary` after the status filter narrows
  // the set), so both counts together require the unfiltered call.
  const stockQuery = useGetStockQuery({ status: "ALL" });

  const recentOrdersQuery = useGetAdminScopedOrdersQuery({ limit: 6 });
  const recentDealerAppsQuery = useGetAdminDealerApplicationsQuery({ limit: 6 });
  const recentDispatcherAppsQuery = useGetAdminDispatcherApplicationsQuery({ limit: 6 });
  const recentStockHistoryQuery = useGetAllStockHistoryQuery({ limit: 6 });

  const heroLoading = todayInsightsQuery.isLoading && !todayInsightsQuery.data;
  const todayData = todayInsightsQuery.data;
  const ordersToday = todayData?.orders?.summary?.totalOrders ?? 0;
  const revenueToday = todayData?.home?.kpis?.approvedRevenue ?? 0;
  const verifiedToday = todayData?.home?.kpis?.approvedOrders ?? 0;

  const attentionCards = useMemo(() => {
    const cards = [
      {
        key: "review",
        icon: "inbox",
        label: "Awaiting review",
        value: Number(factoryOrdersQuery.data?.total ?? 0),
        section: "orders",
      },
      {
        key: "dispatch",
        icon: "truck",
        label: "Ready to dispatch",
        value: Number(readyToDispatchQuery.data?.total ?? 0),
        section: "orders",
      },
      {
        key: "stock",
        icon: "warning",
        label: "Inventory alerts",
        value: Number(stockQuery.data?.summary?.lowStock ?? 0) + Number(stockQuery.data?.summary?.outOfStock ?? 0),
        route: "/admin/products",
      },
      {
        key: "dealerApps",
        icon: "store",
        label: "Dealer applications",
        value: Number(dealerApplicationsQuery.data?.total ?? 0),
        section: "applications",
      },
      {
        key: "dispatcherApps",
        icon: "handshake",
        label: "Dispatcher applications",
        value: Number(dispatcherApplicationsQuery.data?.total ?? 0),
        section: "applications",
      },
    ];
    return cards.filter((card) => card.value > 0);
  }, [
    factoryOrdersQuery.data,
    readyToDispatchQuery.data,
    stockQuery.data,
    dealerApplicationsQuery.data,
    dispatcherApplicationsQuery.data,
  ]);

  const attentionLoading =
    factoryOrdersQuery.isLoading ||
    readyToDispatchQuery.isLoading ||
    stockQuery.isLoading ||
    dealerApplicationsQuery.isLoading ||
    dispatcherApplicationsQuery.isLoading;

  const feedItems = useMemo(() => {
    const orders = (recentOrdersQuery.data?.items || []).map((order) => ({
      key: `order-${order._id}`,
      at: order.createdAt,
      icon: "orders",
      title: order.orderNumber || "Order",
      detail: `${order.dealerId?.companyName || "Dealer"} · ${money(order?.totals?.total, order?.totals?.currency)}`,
      section: "orders",
    }));
    const dealerApps = (recentDealerAppsQuery.data?.items || []).map((app) => ({
      key: `dealerApp-${app._id}`,
      at: app.createdAt,
      icon: "store",
      title: app.companyName || app.contactName || "Dealer application",
      detail: `Dealer application · ${app.status || ""}`.trim(),
      section: "applications",
    }));
    const dispatcherApps = (recentDispatcherAppsQuery.data?.items || []).map((app) => ({
      key: `dispatcherApp-${app._id}`,
      at: app.createdAt,
      icon: "handshake",
      title: app.companyName || app.name || "Dispatcher application",
      detail: `Dispatcher application · ${app.status || ""}`.trim(),
      section: "applications",
    }));
    const stockAdjustments = (recentStockHistoryQuery.data?.items || []).map((entry) => ({
      key: `stock-${entry._id}`,
      at: entry.changedAt || entry.createdAt,
      icon: "package",
      title: entry.productName || entry.code || "Stock adjustment",
      detail: `${entry.reason || "Adjusted"} · ${entry.delta > 0 ? "+" : ""}${entry.delta ?? ""}`,
      route: "/admin/products",
    }));

    return [...orders, ...dealerApps, ...dispatcherApps, ...stockAdjustments]
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [recentOrdersQuery.data, recentDealerAppsQuery.data, recentDispatcherAppsQuery.data, recentStockHistoryQuery.data]);

  const feedLoading =
    recentOrdersQuery.isLoading ||
    recentDealerAppsQuery.isLoading ||
    recentDispatcherAppsQuery.isLoading ||
    recentStockHistoryQuery.isLoading;

  function goto(card) {
    if (card.route) {
      navigate(card.route);
      return;
    }
    onNavigate?.(card.section);
  }

  return (
    <div className="dealer-m-home">
      <SkeletonSwap
        loading={heroLoading}
        skeleton={
          <>
            <div className="dealer-m-home-skeleton-line" style={{ width: "70%", height: 28 }} />
            <div className="dealer-m-home-skeleton-line" style={{ width: "40%", height: 14, marginTop: 8 }} />
            <div className="dealer-m-home-skeleton-card" />
            <div className="dealer-m-home-skeleton-card" />
          </>
        }
      >
        <LargeTitleHeader title={`${greetingPrefix()}, ${adminName}`} eyebrow={todayLabel()} size="medium" />

        <div className="dealer-m-home-card dealer-m-home-stats dealer-m-home-stagger" style={{ animationDelay: "0ms" }}>
          <div className="dealer-m-home-stats-row">
            <HomeStat value={ordersToday} label="Orders Today" />
            <HomeStat value={revenueToday} label="Revenue Today" format={(v) => money(v)} />
            <HomeStat value={verifiedToday} label="Verified Today" />
          </div>
        </div>

        {attentionLoading || attentionCards.length ? (
          <div className="dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
            <div className="admin-m-section-title">Needs attention</div>
            {attentionLoading ? (
              <div className="dealer-m-home-skeleton-card" style={{ marginTop: 10, height: 96 }} />
            ) : (
              <div className="admin-m-shelf">
                {attentionCards.map((card) => (
                  <button key={card.key} type="button" className="admin-m-shelf-card" onClick={() => goto(card)}>
                    <span className="admin-m-shelf-icon">
                      <DashboardIcon name={card.icon} size={18} strokeWidth={1.8} />
                    </span>
                    <span className="admin-m-shelf-value">{card.value}</span>
                    <span className="admin-m-shelf-label">{card.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="dealer-m-home-card dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
            <div className="dealer-m-home-firstrun-title">All caught up</div>
          </div>
        )}

        <div className="admin-m-card dealer-m-home-stagger" style={{ animationDelay: "100ms", padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0" }}>
            <div className="admin-m-section-title">Revenue</div>
            <SegmentedControl options={TREND_PERIODS} value={trendPeriod} onChange={setTrendPeriod} />
          </div>
          <SkeletonSwap
            loading={trendInsightsQuery.isLoading && !trendInsightsQuery.data}
            skeleton={<div className="dealer-m-home-skeleton-card" style={{ margin: 16, height: 180 }} />}
          >
            <TrendChart data={trendInsightsQuery.data?.home?.pulse || []} currency="NPR" height={180} />
          </SkeletonSwap>
        </div>

        <div className="dealer-m-home-quick-row dealer-m-home-stagger" style={{ animationDelay: "150ms" }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              className="dealer-m-home-quick-card"
              onClick={() => (action.route ? navigate(action.route) : onNavigate?.(action.section))}
            >
              <span className="dealer-m-home-quick-icon">
                <DashboardIcon name={action.icon} size={26} strokeWidth={1.6} />
              </span>
              <span className="dealer-m-home-quick-label">{action.label}</span>
            </button>
          ))}
        </div>

        {feedLoading || feedItems.length ? (
          <div className="dealer-m-home-stagger" style={{ animationDelay: "200ms" }}>
            <div className="admin-m-section-title">Recent activity</div>
            {feedLoading ? (
              <div className="dealer-m-home-skeleton-card" style={{ marginTop: 10, height: 140 }} />
            ) : (
              <div className="admin-m-card-list" style={{ marginTop: 10 }}>
                {feedItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="admin-m-card admin-m-feed-row"
                    onClick={() => (item.route ? navigate(item.route) : onNavigate?.(item.section))}
                  >
                    <span className="admin-m-feed-icon">
                      <DashboardIcon name={item.icon} size={16} strokeWidth={1.8} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="admin-m-feed-title">{item.title}</span>
                      <span className="admin-m-feed-detail">{item.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
