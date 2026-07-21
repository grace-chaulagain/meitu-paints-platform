import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider.jsx";
import NavBar from "../components/NavBar.jsx";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../components/dashboard/DashboardUI.jsx";
import { useGetNotificationsQuery } from "../redux/api/meituApi.js";
import { useNotifications } from "./notificationContext.js";

const CATEGORY_META = {
  DEALER_REGISTRATION: { label: "Dealer Registration", icon: "store" },
  DISPATCHER_REGISTRATION: { label: "Dispatcher Registration", icon: "handshake" },
  FACTORY_ORDER: { label: "Factory Order", icon: "orders" },
  ASSIGNED_DEALER_ORDER: { label: "Assigned Dealer Order", icon: "truck" },
};

function categoryMeta(category) {
  return CATEGORY_META[category] || { label: category || "Notification", icon: "bell" };
}

// Admin-only opt-in for native OS notifications (see NotificationProvider's
// desktopActive/requestDesktopPermission) - renders nothing for any other
// role or if the browser lacks the Notification API entirely.
function DesktopAlertControl({ notifications }) {
  if (!notifications?.desktopCapable || !notifications?.desktopSupported) return null;

  const permission = notifications.desktopPermission;

  if (permission === "granted") {
    return (
      <Pill tone="positive" size="small">
        Desktop alerts on
      </Pill>
    );
  }

  if (permission === "denied") {
    return (
      <Pill tone="critical" size="small">
        Desktop alerts blocked — enable in browser settings
      </Pill>
    );
  }

  return (
    <GhostButton icon="bell" onClick={() => notifications.requestDesktopPermission?.()}>
      Enable Desktop Alerts
    </GhostButton>
  );
}

function formatBadgeCount(count) {
  const value = Number(count || 0);
  if (value <= 0) return "";
  return value > 99 ? "99+" : String(value);
}

function formatDateKey(value) {
  if (!value) return "Earlier";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationRow({ item, onOpen }) {
  const meta = categoryMeta(item.category);
  const unread = !item.isRead;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="dash-list-row"
      style={{
        width: "100%",
        textAlign: "left",
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
        background: unread ? "rgba(0,113,227,.04)" : "transparent",
        padding: "14px 18px",
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "36px minmax(0,1fr) auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: unread ? "rgba(0,113,227,.12)" : "var(--color-fog, #f5f5f7)",
          color: unread ? "var(--color-azure, #0071e3)" : "var(--color-graphite, #707070)",
          flexShrink: 0,
        }}
      >
        <DashboardIcon name={meta.icon} size={16} strokeWidth={1.8} />
      </span>

      <span style={{ minWidth: 0, display: "grid", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong
            style={{
              fontSize: 14,
              fontWeight: unread ? 700 : 600,
              color: "var(--color-ink, #1d1d1f)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </strong>
          {unread ? (
            <span
              aria-hidden="true"
              style={{ width: 7, height: 7, borderRadius: 999, background: "var(--color-azure, #0071e3)", flexShrink: 0 }}
            />
          ) : null}
        </span>
        <span
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            fontWeight: 500,
            color: "var(--color-graphite, #707070)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.description}
        </span>
        <Pill tone="neutral" size="small">{meta.label}</Pill>
      </span>

      <span
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: "var(--color-graphite, #707070)",
          whiteSpace: "nowrap",
          alignSelf: "start",
        }}
      >
        {formatTime(item.createdAt)}
      </span>
    </button>
  );
}

export default function NotificationCenterPage({ embedded = false } = {}) {
  const { user } = useAuth();
  const notifications = useNotifications();
  const navigate = useNavigate();
  const [localReadIds, setLocalReadIds] = useState(() => new Set());
  const refreshSummary = notifications?.refreshSummary;
  const notificationParams = useMemo(() => ({ days: 7, limit: 120 }), []);
  const role = String(user?.role || "").toUpperCase();
  const notificationsEnabled =
    role === "ADMIN" || role === "DISPATCHER" || role === "FACTORY";

  const {
    data: items = [],
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetNotificationsQuery(notificationParams, {
    skip: !notificationsEnabled,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const visibleItems = useMemo(() => {
    if (!localReadIds.size) return items;
    return items.map((item) =>
      localReadIds.has(item._id) ? { ...item, isRead: true } : item,
    );
  }, [items, localReadIds]);

  async function loadNotifications() {
    if (!notificationsEnabled) return;
    await refetch();
    await refreshSummary?.();
  }

  const grouped = useMemo(() => {
    const out = new Map();
    for (const item of visibleItems) {
      const key = formatDateKey(item.createdAt);
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(item);
    }
    return Array.from(out.entries());
  }, [visibleItems]);

  const unreadCount = Number(notifications?.totalUnread || 0);
  const loading = isLoading && visibleItems.length === 0;
  const refreshing = isFetching && visibleItems.length > 0;
  const error = queryError?.message || "";

  async function openNotification(item) {
    if (!item?.isRead) {
      await notifications?.markNotificationRead?.(item._id);
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.add(item._id);
        return next;
      });
    }

    if (item?.targetUrl) {
      navigate(item.targetUrl);
    }
  }

  async function markAllVisibleRead() {
    const notificationIds = visibleItems
      .filter((item) => !item.isRead)
      .map((item) => item._id);
    if (!notificationIds.length) return;
    await notifications?.markNotificationIdsRead?.(notificationIds);
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      notificationIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const hasUnreadVisible = visibleItems.some((item) => !item.isRead);

  const content = (
    <div style={{ maxWidth: embedded ? "none" : 900, margin: embedded ? 0 : "0 auto", display: "grid", gap: 16 }}>
      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow={role || "Workspace"}
          icon="bell"
          title="Notification Center"
          subtitle="Recent operational notifications from the last 7 days, filtered to your account role."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill tone={unreadCount ? "critical" : "neutral"} size="small">
                {formatBadgeCount(unreadCount) || "0"} unread
              </Pill>
              <DesktopAlertControl notifications={notifications} />
              <GhostButton icon="refresh" onClick={loadNotifications}>
                {refreshing ? "Updating…" : "Refresh"}
              </GhostButton>
              <PrimaryButton icon="checkmark" onClick={markAllVisibleRead} disabled={!hasUnreadVisible}>
                Mark visible read
              </PrimaryButton>
            </div>
          }
        />

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Surface key={index} padding={18}>
              <div
                style={{
                  height: 60,
                  borderRadius: 12,
                  background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            </Surface>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <Surface padding={28} style={{ textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              margin: "0 auto",
              display: "grid",
              placeItems: "center",
              background: "var(--color-fog, #f5f5f7)",
              color: "var(--color-graphite, #707070)",
            }}
          >
            <DashboardIcon name="bell" size={19} strokeWidth={1.8} />
          </div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            No recent notifications
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            The notification center shows operational items from the last 7 days.
          </div>
          <div style={{ marginTop: 16 }}>
            <GhostButton icon="refresh" onClick={loadNotifications}>Refresh</GhostButton>
          </div>
        </Surface>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {grouped.map(([dateLabel, dateItems]) => (
            <Surface key={dateLabel} padding={0}>
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(0,0,0,.06)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--color-graphite, #707070)",
                }}
              >
                {dateLabel}
              </div>
              <div>
                {dateItems.map((item) => (
                  <NotificationRow key={item._id} item={item} onOpen={openNotification} />
                ))}
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <>
        {content}
        <DashboardUIStyles />
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main style={{ minHeight: "100vh", padding: "118px 18px 54px", background: "var(--color-fog, #f5f5f7)" }}>
        {content}
      </main>
      <DashboardUIStyles />
    </>
  );
}
