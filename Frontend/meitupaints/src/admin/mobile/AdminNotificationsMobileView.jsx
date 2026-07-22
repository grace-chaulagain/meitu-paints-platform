import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetNotificationsQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { useNotifications } from "../../notifications/notificationContext.js";

// NOT a branch inside the shared NotificationCenterPage.jsx - that component
// is used by dispatcher and the generic /notifications route too, so the
// isMobile check lives one level up, in AdminDashboardPage.jsx's own
// SECTIONS.NOTIFICATIONS case, keeping this file admin-only.
const CATEGORY_META = {
  DEALER_REGISTRATION: { label: "Dealer Registration", icon: "store" },
  DISPATCHER_REGISTRATION: { label: "Dispatcher Registration", icon: "handshake" },
  FACTORY_ORDER: { label: "Factory Order", icon: "orders" },
  ASSIGNED_DEALER_ORDER: { label: "Assigned Dealer Order", icon: "truck" },
};

function categoryMeta(category) {
  return CATEGORY_META[category] || { label: category || "Notification", icon: "bell" };
}

function formatDateKey(value) {
  if (!value) return "Earlier";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AdminNotificationsMobileView() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [localReadIds, setLocalReadIds] = useState(() => new Set());

  const notificationsQuery = useGetNotificationsQuery({ days: 7, limit: 120 }, { refetchOnFocus: true, refetchOnReconnect: true });
  const items = useMemo(() => notificationsQuery.data || [], [notificationsQuery.data]);

  const visibleItems = useMemo(() => {
    if (!localReadIds.size) return items;
    return items.map((item) => (localReadIds.has(item._id) ? { ...item, isRead: true } : item));
  }, [items, localReadIds]);

  const grouped = useMemo(() => {
    const out = new Map();
    for (const item of visibleItems) {
      const key = formatDateKey(item.createdAt);
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(item);
    }
    return Array.from(out.entries());
  }, [visibleItems]);

  const loading = notificationsQuery.isLoading && items.length === 0;
  const loadError = notificationsQuery.error ? getQueryErrorMessage(notificationsQuery.error, "Failed to load notifications.") : "";
  const hasUnreadVisible = visibleItems.some((item) => !item.isRead);

  async function openNotification(item) {
    if (!item?.isRead) {
      await notifications?.markNotificationRead?.(item._id);
      setLocalReadIds((prev) => new Set(prev).add(item._id));
    }
    if (item?.targetUrl) navigate(item.targetUrl);
  }

  async function markAllVisibleRead() {
    const ids = visibleItems.filter((item) => !item.isRead).map((item) => item._id);
    if (!ids.length) return;
    await notifications?.markNotificationIdsRead?.(ids);
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => notificationsQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Notifications</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader
          title="Notifications"
          trailing={
            hasUnreadVisible ? (
              <button type="button" className="admin-m-feed-icon" style={{ border: "none" }} onClick={markAllVisibleRead} aria-label="Mark all read">
                <DashboardIcon name="checkmark" size={15} strokeWidth={2} />
              </button>
            ) : null
          }
        />

        {visibleItems.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="bell" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No recent notifications</div>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 18 }}>
            {grouped.map(([dateLabel, dateItems]) => (
              <div key={dateLabel}>
                <div className="admin-m-section-title">{dateLabel}</div>
                <div className="admin-m-card-list" style={{ marginTop: 10 }}>
                  {dateItems.map((item) => {
                    const meta = categoryMeta(item.category);
                    const unread = !item.isRead;
                    return (
                      <button
                        key={item._id}
                        type="button"
                        className="admin-m-card admin-m-feed-row"
                        style={unread ? { background: "rgba(0,113,227,.05)" } : undefined}
                        onClick={() => openNotification(item)}
                      >
                        <span className="admin-m-feed-icon" style={unread ? { background: "rgba(0,113,227,.12)", color: "var(--color-azure, #0071e3)" } : undefined}>
                          <DashboardIcon name={meta.icon} size={16} strokeWidth={1.8} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span className="admin-m-feed-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {item.title}
                            {unread ? <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-azure, #0071e3)", flexShrink: 0 }} /> : null}
                          </span>
                          <span className="admin-m-feed-detail" style={{ whiteSpace: "normal" }}>{item.description}</span>
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-graphite, #707070)", flexShrink: 0, alignSelf: "flex-start" }}>
                          {formatTime(item.createdAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
