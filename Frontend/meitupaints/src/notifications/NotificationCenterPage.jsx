import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider.jsx";
import NavBar from "../components/NavBar.jsx";
import { useGetNotificationsQuery } from "../redux/api/meituApi.js";
import { useNotifications } from "./notificationContext.js";

const CATEGORY_LABELS = {
  DEALER_REGISTRATION: "Dealer Registration",
  DISPATCHER_REGISTRATION: "Dispatcher Registration",
  FACTORY_ORDER: "Factory Order",
  ASSIGNED_DEALER_ORDER: "Assigned Dealer Order",
};

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

function EmptyState({ onRefresh }) {
  return (
    <GlassCard style={{ padding: 26 }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#0f172a",
        }}
      >
        No recent notifications
      </div>
      <div
        style={{
          marginTop: 8,
          maxWidth: 620,
          fontSize: 14,
          lineHeight: 1.7,
          fontWeight: 700,
          color: "rgba(15,23,42,.56)",
        }}
      >
        The notification center shows operational items from the last 7 days.
      </div>
      <button type="button" className="mn-button subtle" onClick={onRefresh}>
        Refresh
      </button>
    </GlassCard>
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
  const notificationsEnabled = role === "ADMIN" || role === "DISPATCHER";

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

  return (
    <>
      {embedded ? null : <NavBar />}
      <main className={embedded ? "mn-page mn-page-embedded" : "mn-page"}>
        <div className="mn-shell">
          <GlassCard style={{ padding: 18 }}>
            <div className="mn-header">
              <div>
                <div className="mn-kicker">{role || "Workspace"}</div>
                <h1>Notification Center</h1>
                <p>
                  Recent operational notifications from the last 7 days,
                  filtered to your account role.
                </p>
              </div>

              <div className="mn-actions">
                <span className="mn-summary">
                  {formatBadgeCount(unreadCount) || "0"} unread
                </span>
                <button
                  type="button"
                  className="mn-button subtle"
                  onClick={loadNotifications}
                >
                  {refreshing ? "Updating..." : "Refresh"}
                </button>
                <button
                  type="button"
                  className="mn-button"
                  onClick={markAllVisibleRead}
                  disabled={!visibleItems.some((item) => !item.isRead)}
                >
                  Mark visible read
                </button>
              </div>
            </div>

            {error ? <div className="mn-error">{error}</div> : null}
          </GlassCard>

          {loading ? (
            <div className="mn-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <GlassCard key={index} style={{ padding: 18 }}>
                  <div className="mn-skeleton" />
                </GlassCard>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState onRefresh={loadNotifications} />
          ) : (
            <div className="mn-list">
              {grouped.map(([dateLabel, dateItems]) => (
                <GlassCard key={dateLabel}>
                  <div className="mn-date-head">{dateLabel}</div>
                  <div className="mn-items">
                    {dateItems.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        className={`mn-item ${item.isRead ? "read" : "unread"}`}
                        onClick={() => openNotification(item)}
                      >
                        <span className="mn-dot" />
                        <span className="mn-item-main">
                          <span className="mn-item-top">
                            <strong>{item.title}</strong>
                            <span>{formatTime(item.createdAt)}</span>
                          </span>
                          <span className="mn-item-desc">
                            {item.description}
                          </span>
                          <span className="mn-category">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`
        .mn-page{
          min-height:100vh;
          padding:118px 18px 54px;
          background:
            radial-gradient(900px 560px at 20% 8%, rgba(255,204,0,.11), transparent 55%),
            radial-gradient(850px 620px at 80% 12%, rgba(255,80,0,.08), transparent 56%),
            linear-gradient(180deg, #fafafc 0%, #f5f5f8 100%);
        }
        .mn-page-embedded{
          min-height:auto;
          padding:0;
          background:transparent;
        }
        .mn-shell{ max-width:1040px; margin:0 auto; display:grid; gap:18px; }
        .mn-shell,
        .mn-shell *{ box-sizing:border-box; min-width:0; }
        .mn-page-embedded .mn-shell{ max-width:none; margin:0; padding-top:0; align-content:start; }
        .mn-header{ display:flex; justify-content:space-between; align-items:flex-end; gap:18px; flex-wrap:wrap; }
        .mn-kicker{ font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .mn-header h1{ margin:8px 0 0; color:#0f172a; font-size:32px; line-height:1.1; font-weight:950; letter-spacing:-.03em; }
        .mn-header p{ margin:8px 0 0; max-width:640px; color:rgba(15,23,42,.58); font-size:14px; line-height:1.7; font-weight:700; }
        .mn-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .mn-summary{ height:38px; display:inline-flex; align-items:center; padding:0 12px; border-radius:999px; background:rgba(180,35,24,.08); color:#b42318; font-size:12px; font-weight:950; }
        .mn-button{ min-height:40px; padding:9px 14px; border-radius:14px; border:1px solid rgba(180,35,24,.14); background:linear-gradient(135deg, #b91c1c 0%, #dd5127 100%); color:#fff; font-weight:900; cursor:pointer; }
        .mn-button.subtle{ background:#fff; color:#0f172a; border-color:rgba(15,23,42,.08); }
        .mn-button:disabled{ opacity:.5; cursor:not-allowed; }
        .mn-error{ margin-top:14px; padding:13px 15px; border-radius:16px; background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.14); font-weight:800; }
        .mn-list{ display:grid; gap:14px; }
        .mn-date-head{ padding:16px 18px; border-bottom:1px solid rgba(15,23,42,.07); font-size:12px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:rgba(15,23,42,.5); }
        .mn-items{ display:grid; }
        .mn-item{ width:100%; border:0; border-bottom:1px solid rgba(15,23,42,.06); background:#fff; display:grid; grid-template-columns:10px minmax(0,1fr); gap:14px; text-align:left; padding:16px 18px; cursor:pointer; }
        .mn-item:last-child{ border-bottom:0; }
        .mn-item.unread{ background:linear-gradient(90deg, rgba(180,35,24,.045), #fff 46%); }
        .mn-dot{ width:9px; height:9px; border-radius:999px; margin-top:7px; background:rgba(15,23,42,.16); }
        .mn-item.unread .mn-dot{ background:#b42318; box-shadow:0 0 0 4px rgba(180,35,24,.08); }
        .mn-item-main{ min-width:0; display:grid; gap:7px; }
        .mn-item-top{ display:flex; justify-content:space-between; gap:12px; align-items:center; }
        .mn-item-top strong{ color:#0f172a; font-size:15px; font-weight:950; }
        .mn-item-top span{ color:rgba(15,23,42,.48); font-size:12px; font-weight:800; white-space:nowrap; }
        .mn-item-desc{ color:rgba(15,23,42,.62); font-size:13px; line-height:1.55; font-weight:700; }
        .mn-category{ width:max-content; max-width:100%; border-radius:999px; background:rgba(15,23,42,.05); color:rgba(15,23,42,.58); padding:5px 9px; font-size:11px; font-weight:900; }
        .mn-skeleton{ height:78px; border-radius:18px; background:linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9)); }
        @media (max-width:720px){
          .mn-page{ padding-top:104px; }
          .mn-header{ align-items:flex-start; }
          .mn-actions{ width:100%; }
          .mn-button{ flex:1 1 auto; }
          .mn-item-top{ align-items:flex-start; flex-direction:column; gap:4px; }
        }
        @media (max-width:520px){
          .mn-page{ padding:92px 12px 34px; }
          .mn-page-embedded{ padding:0; }
          .mn-header h1{ font-size:26px; }
          .mn-actions{ display:grid; grid-template-columns:1fr; }
          .mn-summary,
          .mn-button{ width:100%; justify-content:center; }
          .mn-date-head{ padding:14px; }
          .mn-item{
            grid-template-columns:1fr;
            gap:8px;
            padding:14px;
          }
          .mn-dot{ display:none; }
          .mn-item-desc{ overflow-wrap:anywhere; }
        }
      `}</style>
    </>
  );
}
