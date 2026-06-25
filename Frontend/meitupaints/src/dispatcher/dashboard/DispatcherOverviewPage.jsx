import { useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNotifications } from "../../notifications/notificationContext.js";
import {
  useGetDispatcherDealersQuery,
  useGetDispatcherOrdersArchiveQuery,
  useGetDispatcherOrdersQuery,
} from "../../redux/api/meituApi.js";

const RECENT_HANDLED_WINDOW_START_MS = Date.now() - 7 * 86400000;

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

function MetricCard({ label, value, helper = "", accent = false }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "16px 18px",
        background: accent ? "rgba(180,35,24,.06)" : "rgba(248,250,252,.95)",
        border: accent
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.46)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
      {helper ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.54)",
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            lineHeight: 1.65,
            fontWeight: 700,
            color: "rgba(15,23,42,.58)",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, description }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 18,
        background: "rgba(248,250,252,.95)",
        border: "1px solid rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          lineHeight: 1.65,
          fontWeight: 700,
          color: "rgba(15,23,42,.62)",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function WorkflowStep({ index, title, desc }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px minmax(0,1fr)",
        gap: 14,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(180,35,24,.08)",
          color: "#b42318",
          fontWeight: 950,
          fontSize: 13,
        }}
      >
        {index}
      </div>

      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            lineHeight: 1.7,
            fontWeight: 700,
            color: "rgba(15,23,42,.58)",
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

export default function DispatcherOverviewPage() {
  const { user } = useAuth();
  const notifications = useNotifications();
  const pendingOrdersQuery = useGetDispatcherOrdersQuery({
    status: "SUBMITTED",
    limit: 1,
  });
  const archiveOrdersQuery = useGetDispatcherOrdersArchiveQuery({ limit: 5 });
  const assignedDealersQuery = useGetDispatcherDealersQuery({ limit: 1 });

  const dispatcherName =
    user?.name ||
    user?.username ||
    user?.fullName ||
    (user?.email ? String(user.email).split("@")[0] : "Dispatcher");

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

  const hasCachedPulse = Boolean(
    pendingOrdersQuery.data || archiveOrdersQuery.data || assignedDealersQuery.data,
  );
  const loading =
    !hasCachedPulse &&
    (pendingOrdersQuery.isLoading ||
      archiveOrdersQuery.isLoading ||
      assignedDealersQuery.isLoading);
  const refreshing =
    hasCachedPulse &&
    (pendingOrdersQuery.isFetching ||
      archiveOrdersQuery.isFetching ||
      assignedDealersQuery.isFetching);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 24 }}>
        <SectionHeader
          title={`Welcome, ${dispatcherName}`}
          subtitle={refreshing ? "Updating the cached dispatcher pulse in the background." : "A focused workspace for handling assigned dealer operations, submitted order review, and dispatcher-side verification flow."}
        />

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            label="Pending Orders"
            value={loading ? "…" : pulse.pendingOrders}
            helper="Assigned submitted orders"
            accent
          />
          <MetricCard
            label="Unread"
            value={Number(notifications?.totalUnread || 0)}
            helper="Assigned order alerts"
          />
          <MetricCard
            label="Assigned Dealers"
            value={loading ? "…" : pulse.assignedDealers}
            helper="Active routing scope"
          />
          <MetricCard
            label="Recently Handled"
            value={loading ? "…" : pulse.recentHandledOrders}
            helper={`${pulse.handledOrders} handled total`}
            accent
          />
        </div>
      </GlassCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <GlassCard style={{ padding: 24 }}>
          <SectionHeader
            title="Dispatcher Workflow"
            subtitle="Your workspace is intentionally narrow so you can process assigned dealer orders quickly and clearly."
          />

          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            <WorkflowStep
              index={1}
              title="Review submitted dealer orders"
              desc="Inspect only the orders routed to your dispatcher account and verify the core product, quantity, and payment context."
            />
            <WorkflowStep
              index={2}
              title="Amend orders when required"
              desc="Before verification, adjust eligible order details where operational correction is necessary."
            />
            <WorkflowStep
              index={3}
              title="Verify or reject"
              desc="Use concise dispatcher review notes to approve or reject the submitted order based on actual dispatch readiness."
            />
            <WorkflowStep
              index={4}
              title="Maintain continuity"
              desc="Track handled dealer activity through the dispatcher-side history and dealer-specific order views."
            />
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 24 }}>
          <SectionHeader
            title="Scope Boundaries"
            subtitle="This role is not meant to replace admin operations."
          />

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <InfoBlock
              title="Assigned dealers only"
              description="You should only access dealers that are explicitly routed to your dispatcher network."
            />
            <InfoBlock
              title="No global admin access"
              description="Dealer onboarding, dispatcher approval, and system-wide operational controls remain under admin governance."
            />
            <InfoBlock
              title="Order-first workflow"
              description="The dispatcher workspace is built primarily around order review, amendment, and verification."
            />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
