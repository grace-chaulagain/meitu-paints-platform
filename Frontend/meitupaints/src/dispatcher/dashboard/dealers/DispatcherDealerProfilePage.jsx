import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetDispatcherDealersQuery } from "../../../redux/api/meituApi.js";

function GlassCard({ children, style = {}, ...rest }) {
  return (
    <div
      {...rest}
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

function SectionHeader({ title, subtitle, action = null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
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
              lineHeight: 1.6,
              fontWeight: 700,
              color: "rgba(15,23,42,.58)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, helper = "", accent = false }) {
  return (
    <div
      style={{
        borderRadius: 20,
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

function ActionButton({
  children,
  onClick,
  subtle = false,
  danger = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 14,
        border: danger
          ? "1px solid rgba(180,35,24,.14)"
          : "1px solid rgba(15,23,42,.08)",
        background: danger
          ? "rgba(180,35,24,.06)"
          : subtle
            ? "#fff"
            : "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)",
        color: danger ? "#b42318" : subtle ? "#0f172a" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === "ACTIVE"
      ? {
          bg: "rgba(22,163,74,.08)",
          color: "#15803d",
          border: "1px solid rgba(22,163,74,.12)",
        }
      : status === "SUSPENDED"
        ? {
            bg: "rgba(180,35,24,.08)",
            color: "#b42318",
            border: "1px solid rgba(180,35,24,.12)",
          }
        : {
            bg: "rgba(15,23,42,.05)",
            color: "#475569",
            border: "1px solid rgba(15,23,42,.08)",
          };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: tone.border,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: ".04em",
      }}
    >
      {status || "—"}
    </span>
  );
}

function RoutingBadge({ mode }) {
  const isDispatcher = mode === "DISPATCHER";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        background: isDispatcher ? "rgba(180,35,24,.08)" : "rgba(15,23,42,.05)",
        color: isDispatcher ? "#b42318" : "#475569",
        border: isDispatcher
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.08)",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {mode || "FACTORY"}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.44)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          fontWeight: 800,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <GlassCard style={{ padding: 22 }}>
      <div
        style={{
          height: 180,
          borderRadius: 20,
          background:
            "linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9))",
        }}
      />
    </GlassCard>
  );
}

function EmptyState({ onBack }) {
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
        Dealer not found
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
        The requested assigned dealer profile could not be located in your
        dispatcher register.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onBack}>
          Back to Dealers
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function normalizeDealer(item) {
  return item || null;
}

function extractDealerIdFromPath(pathname) {
  const match = pathname.match(/^\/dispatcher\/dashboard\/dealers\/([^/]+)$/);
  return match?.[1] || "";
}

export default function DispatcherDealerProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(
    () => extractDealerIdFromPath(location.pathname),
    [location.pathname],
  );

  const {
    data: assignedDealerResponse,
    isLoading,
    isFetching,
    error: queryError,
  } = useGetDispatcherDealersQuery(undefined, { skip: !dealerId });

  const allAssignedDealers = useMemo(
    () => (assignedDealerResponse?.items || []).map(normalizeDealer),
    [assignedDealerResponse],
  );
  const dealer = useMemo(
    () => allAssignedDealers.find((item) => item?._id === dealerId) || null,
    [allAssignedDealers, dealerId],
  );
  const loading = isLoading && allAssignedDealers.length === 0;
  const error = queryError?.message || "";

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {error ? (
          <GlassCard style={{ padding: 18 }}>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                background: "rgba(180,35,24,.08)",
                color: "#b42318",
                border: "1px solid rgba(180,35,24,.14)",
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          </GlassCard>
        ) : null}

        <EmptyState onBack={() => navigate("/dispatcher/dashboard/dealers")} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title={dealer.companyName || "Dealer Profile"}
          subtitle={isFetching && dealer ? "Updating cached assigned dealer profile in the background." : "Assigned dealer profile view for dispatcher-side operational reference."}
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton
                subtle
                onClick={() =>
                  navigate(`/dispatcher/dashboard/dealers/${dealerId}/orders`)
                }
              >
                View Orders
              </ActionButton>

              <ActionButton
                subtle
                onClick={() => navigate("/dispatcher/dashboard/dealers")}
              >
                Back to Dealers
              </ActionButton>
            </div>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <StatusBadge status={dealer.status} />
          <RoutingBadge mode={dealer.fulfillmentMode || "DISPATCHER"} />
        </div>
      </GlassCard>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, .9fr) minmax(0, 1.1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <GlassCard style={{ padding: 22 }}>
          <SectionHeader
            title="Operational Identity"
            subtitle="Primary dealer details visible to the assigned dispatcher."
          />

          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            <DetailItem label="Company Name" value={dealer.companyName} />
            <DetailItem label="Contact Name" value={dealer.contactName} />
            <DetailItem label="Email" value={dealer.email} />
            <DetailItem label="Phone" value={dealer.phone} />
            <DetailItem label="Address" value={dealer.address} />
            <DetailItem label="PAN / VAT" value={dealer.panVat} />
          </div>
        </GlassCard>

        <div style={{ display: "grid", gap: 20 }}>
          <GlassCard style={{ padding: 22 }}>
            <SectionHeader
              title="Dispatcher Scope"
              subtitle="This dealer is visible here because it belongs to your assigned dispatcher network."
            />

            <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
              <DetailItem
                label="Fulfillment Mode"
                value={dealer.fulfillmentMode || "DISPATCHER"}
              />
              <DetailItem label="Account Status" value={dealer.status || "—"} />
              <DetailItem
                label="Assigned Dispatcher Link"
                value="This profile is currently routed inside your dispatcher workspace."
              />
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionHeader
              title="Quick Actions"
              subtitle="Continue into order-level processing for this dealer."
            />

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <ActionButton
                subtle
                onClick={() =>
                  navigate(`/dispatcher/dashboard/dealers/${dealerId}/orders`)
                }
              >
                View Dealer Orders
              </ActionButton>

              <ActionButton
                subtle
                onClick={() => navigate("/dispatcher/dashboard/orders")}
              >
                Open Dispatcher Orders
              </ActionButton>
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionHeader
              title="Assigned Network Context"
              subtitle="A simple reference count of currently visible assigned dealers in your workspace."
            />

            <div style={{ marginTop: 18 }}>
              <MetricCard
                label="Assigned Dealers"
                value={allAssignedDealers.length}
                helper="Current dispatcher scope"
                accent
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {error ? (
        <GlassCard style={{ padding: 18 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              border: "1px solid rgba(180,35,24,.14)",
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
