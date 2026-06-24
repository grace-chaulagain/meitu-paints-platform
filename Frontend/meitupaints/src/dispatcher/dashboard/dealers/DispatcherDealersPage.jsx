import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDispatcherDealersQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "VERIFIED", label: "Verified" },
];

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

function SearchInput({ value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 50,
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: "0 14px",
      }}
    >
      <span style={{ fontWeight: 900, color: "rgba(15,23,42,.42)" }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search company, contact, phone, email..."
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
        }}
      />
    </div>
  );
}

function FilterPill({ active, children, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(180,35,24,.16)"
          : "1px solid rgba(15,23,42,.08)",
        background: active
          ? "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)"
          : "#fff",
        color: active ? "#fff" : "#0f172a",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.06)",
            color: active ? "#fff" : "#0f172a",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
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
        height: 40,
        padding: "0 14px",
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
        height: 28,
        padding: "0 10px",
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
        height: 28,
        padding: "0 10px",
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

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 150,
              borderRadius: 18,
              background:
                "linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9))",
            }}
          />
        </GlassCard>
      ))}
    </div>
  );
}

function EmptyState({ onReset }) {
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
        No assigned dealers found
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
        Try adjusting the search or filter to review the dealers assigned to
        your dispatcher network.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onReset}>
          Clear filters
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(15,23,42,.44)",
      }}
    >
      {children}
    </div>
  );
}

function DealersCard({ dealer, onViewProfile, onViewOrders }) {
  return (
    <GlassCard
      style={{
        padding: 18,
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              {dealer.companyName || "Unnamed Dealer"}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(15,23,42,.58)",
              }}
            >
              {dealer.contactName ? <span>{dealer.contactName}</span> : null}
              {dealer.contactName && dealer.email ? <span>•</span> : null}
              {dealer.email ? <span>{dealer.email}</span> : null}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <StatusBadge status={dealer.status} />
            <RoutingBadge mode={dealer.fulfillmentMode || "DISPATCHER"} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,.06)",
              background: "rgba(248,250,252,.9)",
              padding: 14,
            }}
          >
            <Label>Phone</Label>
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {dealer.phone || "—"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,.06)",
              background: "rgba(248,250,252,.9)",
              padding: 14,
            }}
          >
            <Label>PAN / VAT</Label>
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {dealer.panVat || "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.65,
            color: "rgba(15,23,42,.58)",
          }}
        >
          {dealer.address || "No address available"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <ActionButton subtle onClick={onViewProfile}>
            View Profile
          </ActionButton>

          <ActionButton subtle onClick={onViewOrders}>
            View Orders
          </ActionButton>
        </div>
      </div>
    </GlassCard>
  );
}

export default function DispatcherDealersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const dealerParams = useMemo(() => {
    const params = {};
    if (statusFilter !== "ALL") params.status = statusFilter;
    return params;
  }, [statusFilter]);

  const dealersQuery = useGetDispatcherDealersQuery(dealerParams);
  const dealers = useMemo(() => dealersQuery.data?.items || [], [dealersQuery.data]);
  const loading = dealersQuery.isLoading && dealers.length === 0;
  const isRefreshing = !loading && dealersQuery.isFetching;
  const error = dealersQuery.error
    ? getQueryErrorMessage(dealersQuery.error, "Failed to load assigned dealers.")
    : "";

  function refetchDealers() {
    dealersQuery.refetch();
  }

  const filteredDealers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;

    return dealers.filter((dealer) =>
      [
        dealer.companyName,
        dealer.contactName,
        dealer.phone,
        dealer.email,
        dealer.address,
        dealer.panVat,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [dealers, search]);

  const metrics = useMemo(() => {
    const total = dealers.length;
    const active = dealers.filter((d) => d.status === "ACTIVE").length;
    const suspended = dealers.filter((d) => d.status === "SUSPENDED").length;
    const routed = dealers.filter(
      (d) => (d.fulfillmentMode || "FACTORY") === "DISPATCHER",
    ).length;

    return { total, active, suspended, routed };
  }, [dealers]);

  const countsByFilter = useMemo(() => {
    return {
      ALL: dealers.length,
      VERIFIED: dealers.filter((d) => d.status === "VERIFIED").length,
      ACTIVE: dealers.filter((d) => d.status === "ACTIVE").length,
      SUSPENDED: dealers.filter((d) => d.status === "SUSPENDED").length,
    };
  }, [dealers]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Assigned Dealers"
          subtitle="Review only the dealer accounts routed to your dispatcher workspace."
          action={
            <ActionButton subtle onClick={refetchDealers}>
              Refresh
            </ActionButton>
          }
        />

        <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 12,
          alignItems: "center",
        }}
        >
          <SearchInput value={search} onChange={setSearch} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((filter) => (
              <FilterPill
                key={filter.key}
                active={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
                count={countsByFilter[filter.key]}
              >
                {filter.label}
              </FilterPill>
            ))}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 16,
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
        ) : null}

        {isRefreshing ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(15,23,42,.46)",
            }}
          >
            Updating assigned dealers...
          </div>
        ) : null}
      </GlassCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Assigned Dealers", value: metrics.total },
          { label: "Active", value: metrics.active || metrics.routed },
          { label: "Suspended", value: metrics.suspended },
          { label: "Dispatcher Routed", value: metrics.routed },
        ].map((item) => (
          <GlassCard key={item.label} style={{ padding: "14px 16px" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 950,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(15,23,42,.44)",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                color: "#0f172a",
              }}
            >
              {Number(item.value || 0).toLocaleString()}
            </div>
          </GlassCard>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : filteredDealers.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {filteredDealers.map((dealer) => (
            <DealersCard
              key={dealer._id}
              dealer={dealer}
              onViewProfile={() =>
                navigate(`/dispatcher/dashboard/dealers/${dealer._id}`)
              }
              onViewOrders={() =>
                navigate(`/dispatcher/dashboard/dealers/${dealer._id}/orders`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
