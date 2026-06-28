import { useCallback, useMemo } from "react";

import { useAuth } from "../auth/AuthProvider.jsx";
import {
  useGetNotificationSummaryQuery,
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
} from "../redux/api/meituApi.js";
import { NotificationCtx } from "./notificationContext.js";

function emptySummary() {
  return {
    totalUnread: 0,
    categories: {},
  };
}

function canUseNotifications(user) {
  const role = String(user?.role || "").toUpperCase();
  return role === "ADMIN" || role === "DISPATCHER" || role === "FACTORY";
}

export function NotificationProvider({ children }) {
  const { user, booting } = useAuth();
  const enabled = canUseNotifications(user);

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
    ],
  );

  return (
    <NotificationCtx.Provider value={value}>
      {children}
    </NotificationCtx.Provider>
  );
}
