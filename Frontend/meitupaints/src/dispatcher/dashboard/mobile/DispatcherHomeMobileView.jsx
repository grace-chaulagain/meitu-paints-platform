import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider.jsx";
import { useNotifications } from "../../../notifications/notificationContext.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../../dealer/mobile/SkeletonSwap.jsx";
import { useCountUp } from "../../../dealer/mobile/useCountUp.js";
import {
  useGetDispatcherDealersQuery,
  useGetDispatcherOrdersArchiveQuery,
  useGetDispatcherOrdersQuery,
} from "../../../redux/api/meituApi.js";

// Mirrors admin/mobile/AdminHomeMobileView.jsx's "Morning Brief" structure,
// scoped to data that actually exists for this role - no fabricated metrics
// (no revenue chart: dispatcher has no Insights access; no stock-alert shelf
// card: no aggregated low-stock count is exposed on the dispatcher-facing
// API today). Every number here reads from the exact same queries
// DispatcherOverviewPage.jsx (the desktop Home) already uses.
const RECENT_HANDLED_WINDOW_START_MS = Date.now() - 7 * 86400000;

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function HomeStat({ value, label }) {
  const animated = useCountUp(value);
  return (
    <div className="dealer-m-home-stat">
      <div className="dealer-m-home-stat-value">{Math.round(animated).toLocaleString()}</div>
      <div className="dealer-m-home-stat-label">{label}</div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { key: "orders", icon: "orders", label: "Orders", path: "/dispatcher/dashboard/orders" },
  { key: "dealers", icon: "store", label: "Assigned Dealers", path: "/dispatcher/dashboard/dealers" },
  { key: "notifications", icon: "bell", label: "Notifications", path: "/dispatcher/dashboard/notifications" },
  { key: "profile", icon: "user", label: "Profile", path: "/dispatcher/dashboard/profile" },
];

export function DispatcherHomeMobileView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const dispatcherName = user?.name || user?.username || (user?.email ? String(user.email).split("@")[0] : "there");

  const pendingOrdersQuery = useGetDispatcherOrdersQuery({ status: "SUBMITTED", limit: 1 });
  // Bumped from the desktop Home's limit:5 to limit:20 - "Recently Handled"
  // below is a client-side filter over this list's own items, so a small
  // limit silently undercounts real activity past that many rows. 20 is
  // still a cheap fetch and covers a week of activity for any dispatcher
  // realistically handling under ~3 orders/day.
  const archiveOrdersQuery = useGetDispatcherOrdersArchiveQuery({ limit: 20 });
  const assignedDealersQuery = useGetDispatcherDealersQuery({ limit: 1 });
  const readyToDispatchQuery = useGetDispatcherOrdersQuery({ status: "VERIFIED", limit: 1 });
  const outForDeliveryQuery = useGetDispatcherOrdersQuery({ status: "DISPATCHED", limit: 1 });

  const pulse = useMemo(() => {
    const pendingOrders = pendingOrdersQuery.data || {};
    const archiveOrders = archiveOrdersQuery.data || {};
    const assignedDealers = assignedDealersQuery.data || {};
    const archiveItems = archiveOrders.items || [];
    const recentHandledOrders = archiveItems.filter((order) => {
      const updated = new Date(order.updatedAt || order.createdAt).getTime();
      return Number.isFinite(updated) && updated >= RECENT_HANDLED_WINDOW_START_MS;
    }).length;

    return {
      pendingOrders: pendingOrders.total ?? pendingOrders.items?.length ?? 0,
      assignedDealers: assignedDealers.total ?? assignedDealers.items?.length ?? 0,
      recentHandledOrders,
    };
  }, [pendingOrdersQuery.data, archiveOrdersQuery.data, assignedDealersQuery.data]);

  const hasCachedPulse = Boolean(pendingOrdersQuery.data || archiveOrdersQuery.data || assignedDealersQuery.data);
  const heroLoading = !hasCachedPulse && (pendingOrdersQuery.isLoading || archiveOrdersQuery.isLoading || assignedDealersQuery.isLoading);

  const attentionCards = useMemo(() => {
    const cards = [
      { key: "review", icon: "inbox", label: "Awaiting your review", value: Number(pendingOrdersQuery.data?.total ?? 0), view: "PENDING" },
      { key: "dispatch", icon: "truck", label: "Ready to dispatch", value: Number(readyToDispatchQuery.data?.total ?? 0), view: "VERIFIED" },
      { key: "delivery", icon: "orders", label: "Out for delivery", value: Number(outForDeliveryQuery.data?.total ?? 0), view: "DISPATCH" },
    ];
    return cards.filter((card) => card.value > 0);
  }, [pendingOrdersQuery.data, readyToDispatchQuery.data, outForDeliveryQuery.data]);

  const attentionLoading = pendingOrdersQuery.isLoading || readyToDispatchQuery.isLoading || outForDeliveryQuery.isLoading;

  const feedItems = useMemo(() => {
    return (archiveOrdersQuery.data?.items || [])
      .map((order) => ({
        key: order._id,
        at: order.updatedAt || order.createdAt,
        title: order.orderNumber || "Order",
        detail: `${order.dealerId?.companyName || order.dealerSnapshot?.companyName || "Dealer"} · ${order.status || ""}`.trim(),
      }))
      .filter((item) => item.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [archiveOrdersQuery.data]);

  const feedLoading = !hasCachedPulse && archiveOrdersQuery.isLoading;

  function goToOrders(view) {
    navigate(`/dispatcher/dashboard/orders?view=${view}`);
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
        <LargeTitleHeader title={`${greetingPrefix()}, ${dispatcherName}`} eyebrow={todayLabel()} size="medium" />

        <div className="dealer-m-home-card dealer-m-home-stats dealer-m-home-stagger" style={{ animationDelay: "0ms" }}>
          <div className="dealer-m-home-stats-row">
            <HomeStat value={pulse.pendingOrders} label="Pending" />
            <HomeStat value={Number(notifications?.totalUnread || 0)} label="Unread" />
            <HomeStat value={pulse.assignedDealers} label="Dealers" />
            <HomeStat value={pulse.recentHandledOrders} label="Handled (7d)" />
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
                  <button key={card.key} type="button" className="admin-m-shelf-card" onClick={() => goToOrders(card.view)}>
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

        <div className="dealer-m-home-quick-row dealer-m-home-stagger" style={{ animationDelay: "100ms" }}>
          {QUICK_ACTIONS.map((action) => (
            <button key={action.key} type="button" className="dealer-m-home-quick-card" onClick={() => navigate(action.path)}>
              <span className="dealer-m-home-quick-icon">
                <DashboardIcon name={action.icon} size={26} strokeWidth={1.6} />
              </span>
              <span className="dealer-m-home-quick-label">{action.label}</span>
            </button>
          ))}
        </div>

        {feedLoading || feedItems.length ? (
          <div className="dealer-m-home-stagger" style={{ animationDelay: "150ms" }}>
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
                    onClick={() => navigate(`/dispatcher/dashboard/orders?orderId=${item.key}`)}
                  >
                    <span className="admin-m-feed-icon">
                      <DashboardIcon name="orders" size={16} strokeWidth={1.8} />
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
