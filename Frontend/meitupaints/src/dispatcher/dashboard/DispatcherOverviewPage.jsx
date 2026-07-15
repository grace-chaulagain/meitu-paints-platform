import { useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNotifications } from "../../notifications/notificationContext.js";
import {
  useGetDispatcherDealersQuery,
  useGetDispatcherOrdersArchiveQuery,
  useGetDispatcherOrdersQuery,
} from "../../redux/api/meituApi.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { DashboardUIStyles, MetricTile, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";

const RECENT_HANDLED_WINDOW_START_MS = Date.now() - 7 * 86400000;

function WorkflowStep({ index, title, desc }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(0,113,227,.1)",
          color: "var(--color-azure, #0071e3)",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {index}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.55, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, title, description }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 26,
          height: 26,
          flex: "0 0 auto",
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background: "var(--color-fog, #f5f5f7)",
          color: "var(--color-graphite, #707070)",
        }}
      >
        <DashboardIcon name={icon} size={13} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {description}
        </div>
      </div>
    </div>
  );
}

export default function DispatcherOverviewPage() {
  const { user } = useAuth();
  const notifications = useNotifications();
  const pendingOrdersQuery = useGetDispatcherOrdersQuery({ status: "SUBMITTED", limit: 1 });
  const archiveOrdersQuery = useGetDispatcherOrdersArchiveQuery({ limit: 5 });
  const assignedDealersQuery = useGetDispatcherDealersQuery({ limit: 1 });

  const dispatcherName =
    user?.name || user?.username || user?.fullName || (user?.email ? String(user.email).split("@")[0] : "Dispatcher");

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
      handledOrders: archiveOrders.total ?? archiveOrders.items?.length ?? 0,
      assignedDealers: assignedDealers.total ?? assignedDealers.items?.length ?? 0,
      recentHandledOrders,
    };
  }, [pendingOrdersQuery.data, archiveOrdersQuery.data, assignedDealersQuery.data]);

  const hasCachedPulse = Boolean(pendingOrdersQuery.data || archiveOrdersQuery.data || assignedDealersQuery.data);
  const loading =
    !hasCachedPulse && (pendingOrdersQuery.isLoading || archiveOrdersQuery.isLoading || assignedDealersQuery.isLoading);
  const refreshing =
    hasCachedPulse && (pendingOrdersQuery.isFetching || archiveOrdersQuery.isFetching || assignedDealersQuery.isFetching);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          title={`Welcome, ${dispatcherName}`}
          subtitle={
            refreshing
              ? "Updating…"
              : "Your workspace for assigned dealer operations and submitted order review."
          }
        />

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <MetricTile icon="orders" label="Pending Orders" value={loading ? "…" : pulse.pendingOrders} helper="Assigned submitted orders" tone="accent" />
          <MetricTile icon="bell" label="Unread" value={Number(notifications?.totalUnread || 0)} helper="Assigned order alerts" />
          <MetricTile icon="store" label="Assigned Dealers" value={loading ? "…" : pulse.assignedDealers} helper="Active routing scope" />
          <MetricTile icon="history" label="Recently Handled" value={loading ? "…" : pulse.recentHandledOrders} helper={`${pulse.handledOrders} handled total`} />
        </div>
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16, alignItems: "start" }}>
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader icon="orders" title="Dispatcher Workflow" subtitle="How assigned orders move through your workspace." />
          <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
            <WorkflowStep index={1} title="Review submitted dealer orders" desc="Inspect only the orders routed to your dispatcher account." />
            <WorkflowStep index={2} title="Amend when required" desc="Adjust eligible order details before verification, if needed." />
            <WorkflowStep index={3} title="Verify or reject" desc="Approve or reject with a concise dispatcher review note." />
            <WorkflowStep index={4} title="Maintain continuity" desc="Track handled activity via dealer-specific and dispatcher-wide history." />
          </div>
        </Surface>

        <Surface padding={22} className="dash-fade-up">
          <SectionHeader icon="handshake" title="Scope Boundaries" subtitle="This role does not replace admin operations." />
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <InfoRow icon="store" title="Assigned dealers only" description="Access is limited to dealers explicitly routed to your dispatcher network." />
            <InfoRow icon="gear" title="No global admin access" description="Dealer onboarding, dispatcher approval, and system controls remain admin-governed." />
            <InfoRow icon="checkmark" title="Order-first workflow" description="This workspace is built around order review, amendment, and verification." />
          </div>
        </Surface>
      </div>
    </div>
  );
}
