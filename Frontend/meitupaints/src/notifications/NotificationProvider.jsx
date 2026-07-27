import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "../auth/AuthProvider.jsx";
import {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useGetVapidPublicKeyQuery,
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useSubscribePushMutation,
} from "../redux/api/meituApi.js";
import { NotificationCtx } from "./notificationContext.js";

// PushManager.subscribe() needs the VAPID public key as a raw Uint8Array,
// not the base64url string the server hands back.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function emptySummary() {
  return {
    totalUnread: 0,
    categories: {},
  };
}

function canUseNotifications(user) {
  const role = String(user?.role || "").toUpperCase();
  return (
    role === "ADMIN" ||
    role === "READ_ONLY_ADMIN" ||
    role === "DISPATCHER" ||
    role === "FACTORY"
  );
}

// Desktop (native OS) notifications - admin and factory only for now
// (see canUseDesktopNotifications). Deliberately a separate, opt-in
// layer on top of the existing in-app bell/summary: the browser
// Notification API requires explicit permission, and even once granted
// we don't want to replay an entire unread backlog the moment it's
// flipped on - so the first poll after permission is granted is
// treated as a baseline (nothing fires), and only notifications
// strictly newer than the last-seen createdAt (persisted in
// localStorage, so a page reload doesn't replay history either)
// trigger a native notification.
const DESKTOP_NOTIF_LAST_SEEN_KEY_PREFIX = "meitu_desktop_notif_last_seen_at_";
// Worst-case delivery latency is bounded by this interval (a notification
// created 1ms after a poll fires won't be picked up until the next one) -
// 7s keeps that comfortably under the 10s target with headroom for actual
// request/render time, without polling so aggressively it's wasteful.
const DESKTOP_NOTIF_POLL_MS = 7000;

function canUseDesktopNotifications(user) {
  const role = String(user?.role || "").toUpperCase();
  return role === "ADMIN" || role === "FACTORY";
}

function getNotificationApiSupport() {
  return typeof window !== "undefined" && "Notification" in window;
}

// A prominent, hard-to-miss prompt shown right after an admin or factory
// user logs in (mounted at the app root, so it floats above whichever page they land
// on rather than waiting for them to find a toggle buried in the
// Notification Center). "Allow" is a direct synchronous click handler -
// deliberately not auto-triggered on mount - because Safari (and, on a
// long enough timeline, every other browser) only honors
// Notification.requestPermission() when it's the direct result of a
// user gesture. Tying it to a real click here is what makes this work
// the same way across Chrome/Edge/Firefox/Safari, and therefore across
// Windows/macOS/Linux - permission behavior is a browser thing, not an
// OS thing.
function DesktopPermissionPrompt({ visible, onAllow, onDismiss }) {
  if (!visible || typeof document === "undefined") return null;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  return createPortal(
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 10000,
        width: "min(380px, calc(100vw - 40px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "16px 16px 16px 18px",
          borderRadius: 20,
          background: "rgba(255,255,255,.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(29,29,31,.08)",
          boxShadow: "0 20px 48px rgba(15,23,42,.18), 0 2px 8px rgba(15,23,42,.06)",
          animation: prefersReducedMotion
            ? "none"
            : "meitu-desktop-prompt-in .32s cubic-bezier(.23,1,.32,1)",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,113,227,.1)",
            color: "var(--color-azure, #0071e3)",
          }}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            Turn on desktop notifications?
          </div>
          <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Get notified the moment something needs your attention, even when this tab isn't focused.
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onAllow}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 999,
                border: "none",
                background: "var(--color-azure, #0071e3)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                transition: "transform .14s ease",
              }}
            >
              Allow
            </button>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 999,
                border: "1px solid rgba(29,29,31,.12)",
                background: "transparent",
                color: "var(--color-graphite, #707070)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,.05)",
            color: "var(--color-graphite, #707070)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes meitu-desktop-prompt-in {
          from { opacity: 0; transform: translateY(12px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

export function NotificationProvider({ children }) {
  const { user, booting } = useAuth();
  const enabled = canUseNotifications(user);
  const desktopCapable = canUseDesktopNotifications(user);
  const desktopSupported = getNotificationApiSupport();
  // Role-scoped so a shared browser used by both an admin and a factory
  // account (or a role switch) doesn't cross-contaminate baselines.
  const desktopNotifLastSeenKey = `${DESKTOP_NOTIF_LAST_SEEN_KEY_PREFIX}${String(user?.role || "").toUpperCase()}`;

  const { data, isLoading, isFetching, refetch } = useGetNotificationSummaryQuery(
    undefined,
    {
      skip: booting || !enabled,
      pollingInterval: enabled ? 45000 : 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );
  const [markNotificationsRead] = useMarkNotificationsReadMutation();
  const [markNotificationReadMutation] = useMarkNotificationReadMutation();

  const [desktopPermission, setDesktopPermission] = useState(() =>
    desktopSupported ? window.Notification.permission : "unsupported",
  );

  const requestDesktopPermission = useCallback(async () => {
    if (!desktopSupported) return "unsupported";
    const result = await window.Notification.requestPermission();
    setDesktopPermission(result);
    return result;
  }, [desktopSupported]);

  const desktopActive = desktopCapable && desktopSupported && desktopPermission === "granted";

  // Web Push - delivers notifications even with the tab backgrounded or
  // unfocused, which the polling fallback above physically cannot do
  // (browsers throttle timers in background tabs). Registering the
  // service worker and subscribing is idempotent - re-running this for
  // an already-subscribed browser just returns the existing
  // subscription, so it's safe to fire on every mount once desktopActive
  // is true, not just the first time.
  const { data: vapidPublicKey } = useGetVapidPublicKeyQuery(undefined, {
    skip: !desktopCapable,
  });
  const [subscribePush] = useSubscribePushMutation();

  useEffect(() => {
    if (!desktopActive || !vapidPublicKey) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        // .register() can resolve before the worker is actually active
        // (installing/waiting) - .ready only resolves once there's an
        // active worker, which subscribe() requires.
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        if (!cancelled && subscription) {
          await subscribePush(subscription.toJSON()).unwrap();
        }
      } catch (error) {
        console.warn("[web-push] subscribe failed:", error?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [desktopActive, vapidPublicKey, subscribePush]);

  // Session-only "not now" - resets on the next full page load/login, so
  // an admin who dismisses it isn't nagged again this session but is
  // asked again next time if they still haven't decided either way.
  const [promptDismissed, setPromptDismissed] = useState(false);
  const showPermissionPrompt =
    !booting &&
    desktopCapable &&
    desktopSupported &&
    desktopPermission === "default" &&
    !promptDismissed;

  const { data: recentItems } = useGetNotificationsQuery(
    { days: 1, limit: 30 },
    {
      skip: !desktopActive,
      pollingInterval: desktopActive ? DESKTOP_NOTIF_POLL_MS : 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  const lastSeenAtRef = useRef(null);
  const lastSeenInitialized = useRef(false);

  useEffect(() => {
    if (!desktopActive) {
      // Feature turned off (or role/permission changed) - forget the
      // in-memory baseline so re-enabling re-establishes a fresh one
      // instead of instantly replaying whatever arrived while it was off.
      lastSeenInitialized.current = false;
      return;
    }
    if (!lastSeenInitialized.current) {
      lastSeenAtRef.current = localStorage.getItem(desktopNotifLastSeenKey) || null;
      lastSeenInitialized.current = true;
    }
  }, [desktopActive, desktopNotifLastSeenKey]);

  useEffect(() => {
    if (!desktopActive || !Array.isArray(recentItems) || recentItems.length === 0) return;

    const sorted = [...recentItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const newestCreatedAt = sorted[sorted.length - 1].createdAt;

    if (!lastSeenAtRef.current) {
      // First poll since the feature became active - establish the
      // baseline without firing anything for the existing backlog.
      lastSeenAtRef.current = newestCreatedAt;
      localStorage.setItem(desktopNotifLastSeenKey, newestCreatedAt);
      return;
    }

    const lastSeenMs = new Date(lastSeenAtRef.current).getTime();
    const freshItems = sorted.filter((item) => new Date(item.createdAt).getTime() > lastSeenMs);
    if (!freshItems.length) return;

    for (const item of freshItems) {
      try {
        const notification = new window.Notification(item.title || "Meitu Paints", {
          body: item.description || "",
          // A raster icon, not the SVG logo - SVG notification icons render
          // inconsistently across OS-level notification surfaces (Windows
          // toast rendering in particular), a plain PNG is safe everywhere.
          icon: "/apple-touch-icon.png",
          tag: item._id,
        });
        notification.onclick = () => {
          window.focus();
          if (item.targetUrl) {
            window.location.href = item.targetUrl;
          }
          notification.close();
        };
      } catch {
        // Notification constructor can throw in odd embedded contexts -
        // never let a desktop-alert failure break the app.
      }
    }

    lastSeenAtRef.current = newestCreatedAt;
    localStorage.setItem(desktopNotifLastSeenKey, newestCreatedAt);
  }, [desktopActive, recentItems, desktopNotifLastSeenKey]);

  const summary = enabled ? data || emptySummary() : emptySummary();

  const refreshSummary = useCallback(async () => {
    if (!enabled) return emptySummary();
    const result = await refetch();
    return result?.data || emptySummary();
  }, [enabled, refetch]);

  const markCategoriesRead = useCallback(
    async (categories = []) => {
      const cleanCategories = categories.filter(Boolean);
      if (!enabled || cleanCategories.length === 0) return { ok: true };

      const result = await markNotificationsRead({
        categories: cleanCategories,
      }).unwrap();
      return result || { ok: true };
    },
    [enabled, markNotificationsRead],
  );

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!enabled || !notificationId) return { ok: true };
      const result = await markNotificationReadMutation(notificationId).unwrap();
      return result || { ok: true };
    },
    [enabled, markNotificationReadMutation],
  );

  const markNotificationIdsRead = useCallback(
    async (notificationIds = []) => {
      const cleanIds = notificationIds.filter(Boolean);
      if (!enabled || cleanIds.length === 0) return { ok: true };

      const result = await markNotificationsRead({
        notificationIds: cleanIds,
      }).unwrap();
      return result || { ok: true };
    },
    [enabled, markNotificationsRead],
  );

  const value = useMemo(
    () => ({
      enabled,
      loading: isLoading && !data,
      refreshing: isFetching && Boolean(data),
      totalUnread: Number(summary?.totalUnread || 0),
      categories: summary?.categories || {},
      refreshSummary,
      markCategoriesRead,
      markNotificationRead,
      markNotificationIdsRead,
      desktopCapable,
      desktopSupported,
      desktopPermission,
      desktopActive,
      requestDesktopPermission,
    }),
    [
      enabled,
      isLoading,
      isFetching,
      data,
      summary,
      refreshSummary,
      markCategoriesRead,
      markNotificationRead,
      markNotificationIdsRead,
      desktopCapable,
      desktopSupported,
      desktopPermission,
      desktopActive,
      requestDesktopPermission,
    ],
  );

  return (
    <NotificationCtx.Provider value={value}>
      {children}
      <DesktopPermissionPrompt
        visible={showPermissionPrompt}
        onAllow={() => {
          requestDesktopPermission();
        }}
        onDismiss={() => setPromptDismissed(true)}
      />
    </NotificationCtx.Provider>
  );
}
