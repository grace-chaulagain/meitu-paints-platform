import { useMemo } from "react";
import { useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkNotificationsReadMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { EmptyState, GhostButton, Pill, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";
import { timeAgo } from "../factoryHelpers.js";

export default function FactoryNotificationsPage() {
  const notificationsQuery = useGetNotificationsQuery({ days: 30, limit: 100 });
  const [markOneRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkNotificationsReadMutation();

  const items = useMemo(() => notificationsQuery.data || [], [notificationsQuery.data]);
  const unreadItems = items.filter((item) => !item.isRead);
  const loadError = notificationsQuery.error ? getQueryErrorMessage(notificationsQuery.error, "Failed to load notifications.") : "";

  function handleMarkAllRead() {
    if (!unreadItems.length) return;
    markAllRead({ notificationIds: unreadItems.map((item) => item._id) });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="bell"
          title="Operational Alerts"
          subtitle="Factory-relevant order and inventory notifications."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pill tone={unreadItems.length ? "accent" : "neutral"}>{unreadItems.length} unread</Pill>
              <GhostButton icon="checkmark" onClick={handleMarkAllRead} disabled={!unreadItems.length || markAllState.isLoading}>
                {markAllState.isLoading ? "Marking…" : "Mark All Read"}
              </GhostButton>
            </div>
          }
        />
        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {notificationsQuery.isLoading && !notificationsQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="No notifications" subtitle="You're all caught up." />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {items.map((item, index) => (
            <div
              key={item._id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 18px",
                borderTop: index === 0 ? "none" : "1px solid rgba(0,0,0,.06)",
                background: item.isRead ? "transparent" : "rgba(0,113,227,.04)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  background: item.isRead ? "var(--color-fog, #f5f5f7)" : "rgba(0,113,227,.12)",
                  color: item.isRead ? "var(--color-graphite, #707070)" : "var(--color-azure, #0071e3)",
                }}
              >
                <DashboardIcon name="bell" size={13} strokeWidth={1.8} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.title}</div>
                <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.description}</div>
                <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{timeAgo(item.createdAt)}</div>
              </div>
              {!item.isRead ? (
                <GhostButton onClick={() => markOneRead(item._id)}>Mark Read</GhostButton>
              ) : null}
            </div>
          ))}
        </Surface>
      )}
    </div>
  );
}
