import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import {
  useAssignDispatcherToDealerMutation,
  useDeleteAdminDealerMutation,
  useGetAdminDealersQuery,
  useGetVerifiedDispatchersQuery,
  useUndoDeleteAdminDealerMutation,
  useUnassignDispatcherFromDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useUpdateAdminDealerStatusMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminEntityCard, {
  AdminEntityCardStyles,
} from "../components/AdminEntityCard.jsx";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "VERIFIED", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
];

const ROUTING_MODES = [
  { value: "FACTORY", label: "Factory" },
  { value: "DISPATCHER", label: "Dispatcher" },
];

const ACTIVITY_FILTERS = [
  { key: "ALL", label: "All Activity" },
  { key: "ACTIVE", label: "Active" },
  { key: "WATCH", label: "Watch" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "NO_APPROVED_ORDERS", label: "No Approved Orders" },
];

const DEALER_SORTS = [
  { key: "totalSales", label: "Highest sales" },
  { key: "orderCount", label: "Most approved orders" },
  { key: "latestActivity", label: "Latest activity" },
  { key: "biggestOrder", label: "Largest order" },
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
        height: 38,
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
        fontSize: 12,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        boxShadow: active ? "0 10px 20px rgba(180,35,24,.14)" : "none",
      }}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.06)",
            color: active ? "#fff" : "#0f172a",
            fontSize: 10,
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
  danger = false,
  subtle = false,
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
        minHeight: 42,
        padding: "10px 14px",
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
        boxShadow: subtle
          ? "inset 0 1px 0 rgba(255,255,255,.72)"
          : "0 12px 22px rgba(180,35,24,.16)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        whiteSpace: "normal",
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === "VERIFIED"
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
      {status === "VERIFIED" ? "ACTIVE" : status || "—"}
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
              height: 180,
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
        No dealers found
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
        Try adjusting the search or status filters to view dealer accounts.
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

function getDealerRoutingState(dealer) {
  return {
    fulfillmentMode: dealer?.fulfillmentMode || "FACTORY",
    dispatcherId:
      dealer?.dispatcherId?._id ||
      dealer?.dispatcherId ||
      dealer?.dispatcher?._id ||
      "",
  };
}

function RoutingModal({ open, dealer, dispatchers, saving, onClose, onSave }) {
  const [routingState, setRoutingState] = useState(() =>
    getDealerRoutingState(dealer),
  );
  const { fulfillmentMode, dispatcherId } = routingState;

  if (!open || !dealer) return null;

  const canSave =
    fulfillmentMode === "FACTORY" ||
    (fulfillmentMode === "DISPATCHER" && dispatcherId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15,23,42,.38)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 28,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassCard
        style={{
          width: "min(680px, 100%)",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionHeader
          title="Dealer Routing"
          subtitle={`Update routing for ${dealer.companyName || "dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,.08)",
                background: "#fff",
                fontSize: 20,
                fontWeight: 900,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              ×
            </button>
          }
        />

        <div style={{ marginTop: 20, display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Label>Fulfillment Mode</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ROUTING_MODES.map((option) => (
                <ActionButton
                  key={option.value}
                  subtle={fulfillmentMode !== option.value}
                  onClick={() =>
                    setRoutingState((prev) => ({
                      fulfillmentMode: option.value,
                      dispatcherId:
                        option.value === "DISPATCHER" ? prev.dispatcherId : "",
                    }))
                  }
                >
                  {option.label}
                </ActionButton>
              ))}
            </div>
          </div>

          {fulfillmentMode === "DISPATCHER" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <Label>Assigned Dispatcher</Label>
              <select
                value={dispatcherId}
                onChange={(e) =>
                  setRoutingState((prev) => ({
                    ...prev,
                    dispatcherId: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  height: 50,
                  borderRadius: 16,
                  border: "1px solid rgba(15,23,42,.08)",
                  background: "#fff",
                  padding: "0 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  outline: "none",
                }}
              >
                <option value="">Select dispatcher</option>
                {dispatchers.map((dispatcher) => (
                  <option key={dispatcher._id} value={dispatcher._id}>
                    {dispatcher.name}
                    {dispatcher.companyName
                      ? ` · ${dispatcher.companyName}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <ActionButton subtle onClick={onClose} disabled={saving}>
            Cancel
          </ActionButton>
          <ActionButton
            onClick={() =>
              onSave({
                fulfillmentMode,
                dispatcherId:
                  fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
              })
            }
            disabled={!canSave || saving}
          >
            {saving ? "Saving..." : "Save Routing"}
          </ActionButton>
        </div>
      </GlassCard>
    </div>
  );
}

function DealersCard({
  dealer,
  busyAction,
  onToggleStatus,
  onEditRouting,
  onViewProfile,
  onViewOrders,
  onDelete,
  onUndoDelete,
}) {
  const companyInitial = String(dealer.companyName || dealer.contactName || "D")
    .trim()
    .charAt(0)
    .toUpperCase();

  const dispatcherName =
    dealer.dispatcherId?.name || dealer.dispatcher?.name || "Factory handled";
  const access = dealer.accessState || {};
  const deletionPending = Boolean(dealer.deletion?.pending);
  const isDispatcherRouted = dealer.fulfillmentMode === "DISPATCHER";
  const isVerified = dealer.status === "VERIFIED";

  return (
    <AdminEntityCard
      accent={isDispatcherRouted ? "accent" : isVerified ? "success" : "danger"}
      initial={companyInitial}
      title={dealer.companyName || "Unnamed Dealer"}
      subtitle={dealer.contactName || "No contact name"}
      line={isDispatcherRouted ? `Routed to ${dispatcherName}` : "Factory handled"}
      badges={[
        {
          label: dealer.status === "VERIFIED" ? "Active" : dealer.status,
          tone: isVerified ? "success" : "danger",
        },
        {
          label: isDispatcherRouted ? "Dispatcher" : "Factory",
          tone: isDispatcherRouted ? "accent" : "muted",
        },
        deletionPending ? { label: "Trash Pending", tone: "danger" } : null,
        {
          label: access.passwordSet ? "Access Ready" : "Setup Pending",
          tone: access.passwordSet ? "success" : "danger",
        },
      ]}
      actions={[
        {
          key: "profile",
          label: "Profile",
          variant: "primary",
          onClick: onViewProfile,
        },
        { key: "orders", label: "Orders", onClick: onViewOrders },
        { key: "routing", label: "Routing", onClick: onEditRouting },
        {
          key: "status",
          label: isVerified ? "Deactivate" : "Activate",
          busyLabel: "Saving...",
          busy: busyAction === `status-${dealer._id}`,
          disabled: busyAction === `status-${dealer._id}` || deletionPending,
          variant: isVerified ? "danger" : "",
          onClick: onToggleStatus,
        },
        deletionPending
          ? {
              key: "undo-delete",
              label: "Undo",
              busyLabel: "Restoring...",
              busy: busyAction === `undo-delete-${dealer._id}`,
              disabled: busyAction === `undo-delete-${dealer._id}`,
              onClick: onUndoDelete,
            }
          : {
              key: "delete",
              label: "Delete",
              busyLabel: "Moving...",
              busy: busyAction === `delete-${dealer._id}`,
              disabled: busyAction === `delete-${dealer._id}`,
              variant: "danger",
              onClick: onDelete,
            },
      ]}
    />
  );
}

export default function AdminDealersPage() {
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [routingFilter, setRoutingFilter] = useState("ALL");
  const [activityFilter, setActivityFilter] = useState("ALL");
  const [dealerSort, setDealerSort] = useState("totalSales");
  const [routingDealer, setRoutingDealer] = useState(null);
  const [statusDealer, setStatusDealer] = useState(null);
  const [deleteDealer, setDeleteDealer] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const dealerParams = useMemo(() => {
    const params = {};
    if (statusFilter !== "ALL") params.status = statusFilter;
    return params;
  }, [statusFilter]);

  const dealersQuery = useGetAdminDealersQuery(dealerParams);
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const [updateDealerStatus] = useUpdateAdminDealerStatusMutation();
  const [deleteAdminDealer] = useDeleteAdminDealerMutation();
  const [undoDeleteAdminDealer] = useUndoDeleteAdminDealerMutation();
  const [updateDealerRouting] = useUpdateAdminDealerRoutingMutation();
  const [assignDispatcherToDealer] = useAssignDispatcherToDealerMutation();
  const [unassignDispatcherFromDealer] = useUnassignDispatcherFromDealerMutation();

  const dealers = useMemo(() => dealersQuery.data?.items || [], [dealersQuery.data]);
  const dispatchers = useMemo(
    () => dispatchersQuery.data?.items || [],
    [dispatchersQuery.data],
  );

  const loading = dealersQuery.isLoading && dealers.length === 0;
  const isRefreshing =
    !loading && (dealersQuery.isFetching || dispatchersQuery.isFetching);
  const queryError = dealersQuery.error || dispatchersQuery.error;
  const error =
    actionError ||
    (queryError ? getQueryErrorMessage(queryError, "Failed to load dealers.") : "");

  function refetchPageData() {
    dealersQuery.refetch();
    dispatchersQuery.refetch();
  }

  const routingFilterOptions = useMemo(() => {
    const dispatcherOptions = dispatchers.map((dispatcher) => ({
      key: `DISPATCHER:${dispatcher._id}`,
      label: dispatcher.name,
    }));

    return [
      { key: "ALL", label: "All Routing" },
      { key: "FACTORY", label: "Factory" },
      { key: "DISPATCHER_ALL", label: "All Dispatcher" },
      ...dispatcherOptions,
    ];
  }, [dispatchers]);

  const filteredDealers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return dealers
      .filter((dealer) => {
      const matchesSearch =
        !q ||
        [
          dealer.companyName,
          dealer.contactName,
          dealer.phone,
          dealer.email,
          dealer.address,
          dealer.panVat,
          dealer.dispatcherId?.name,
          dealer.dispatcher?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const effectiveMode = String(
        dealer.fulfillmentMode ||
          (dealer.dispatcherId || dealer.dispatcher ? "DISPATCHER" : "FACTORY"),
      ).toUpperCase();

      const effectiveDispatcherId = String(
        dealer.dispatcherId?._id ||
          dealer.dispatcherId ||
          dealer.dispatcher?._id ||
          "",
      );

      let matchesRouting = true;

      if (routingFilter === "FACTORY") {
        matchesRouting = effectiveMode === "FACTORY";
      } else if (routingFilter === "DISPATCHER_ALL") {
        matchesRouting = effectiveMode === "DISPATCHER";
      } else if (routingFilter.startsWith("DISPATCHER:")) {
        const selectedDispatcherId = routingFilter.split(":")[1] || "";
        matchesRouting =
          effectiveMode === "DISPATCHER" &&
          String(effectiveDispatcherId) === String(selectedDispatcherId);
      }

      const activityStatus =
        dealer.analyticsSummary?.currentActivityStatus || "NO_APPROVED_ORDERS";
      const matchesActivity =
        activityFilter === "ALL" || activityStatus === activityFilter;

      return matchesSearch && matchesRouting && matchesActivity;
    })
      .sort((a, b) => {
        const aSummary = a.analyticsSummary || {};
        const bSummary = b.analyticsSummary || {};
        if (dealerSort === "orderCount") {
          return (
            Number(bSummary.totalApprovedOrders || 0) -
            Number(aSummary.totalApprovedOrders || 0)
          );
        }
        if (dealerSort === "latestActivity") {
          return (
            new Date(bSummary.lastApprovedOrderAt || 0).getTime() -
            new Date(aSummary.lastApprovedOrderAt || 0).getTime()
          );
        }
        if (dealerSort === "biggestOrder") {
          return (
            Number(bSummary.largestApprovedOrderValue || 0) -
            Number(aSummary.largestApprovedOrderValue || 0)
          );
        }
        return (
          Number(bSummary.totalApprovedSales || 0) -
          Number(aSummary.totalApprovedSales || 0)
        );
      });
  }, [activityFilter, dealerSort, dealers, search, routingFilter]);

  const countsByFilter = useMemo(() => {
    return {
      ALL: dealers.length,
      VERIFIED: dealers.filter((d) => d.status === "VERIFIED").length,
      SUSPENDED: dealers.filter((d) => d.status === "SUSPENDED").length,
    };
  }, [dealers]);

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Action failed."));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  const handleToggleStatus = (dealer) => {
    const nextStatus =
      dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED";
    return runAction(`status-${dealer._id}`, () =>
      updateDealerStatus({ dealerId: dealer._id, status: nextStatus }).unwrap(),
    );
  };

  const handleDeleteDealer = (dealer) =>
    runAction(`delete-${dealer._id}`, () =>
      deleteAdminDealer({
        dealerId: dealer._id,
        payload: {
          confirmation: deleteConfirmation,
          reason: "Admin scheduled dealer deletion",
        },
      }).unwrap(),
    );

  const handleUndoDeleteDealer = (dealer) =>
    runAction(`undo-delete-${dealer._id}`, () =>
      undoDeleteAdminDealer(dealer._id).unwrap(),
    );

  const handleSaveRouting = async ({ fulfillmentMode, dispatcherId }) => {
    if (!routingDealer?._id) return;

    const actionKey = `routing-${routingDealer._id}`;

    const success = await runAction(actionKey, async () => {
      try {
        await updateDealerRouting({
          dealerId: routingDealer._id,
          payload: { fulfillmentMode, dispatcherId },
        }).unwrap();
      } catch {
        if (fulfillmentMode === "DISPATCHER") {
          await assignDispatcherToDealer({
            dealerId: routingDealer._id,
            dispatcherId,
          }).unwrap();
          return;
        }

        await unassignDispatcherFromDealer(routingDealer._id).unwrap();
      }
    });

    if (success) {
      setRoutingDealer(null);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        marginTop: 0,
      }}
    >
      <AdminEntityCardStyles />
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Dealer Register"
          subtitle="Search, review, and manage dealer accounts with routing and operational visibility."
          action={
            <ActionButton subtle onClick={refetchPageData}>
              Refresh
            </ActionButton>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
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

          <select
            value={routingFilter}
            onChange={(e) => setRoutingFilter(e.target.value)}
            style={{
              height: 42,
              minWidth: 220,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              outline: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.72)",
            }}
          >
            {routingFilterOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            style={{
              height: 42,
              minWidth: 200,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              outline: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.72)",
            }}
          >
            {ACTIVITY_FILTERS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={dealerSort}
            onChange={(e) => setDealerSort(e.target.value)}
            style={{
              height: 42,
              minWidth: 200,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              outline: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.72)",
            }}
          >
            {DEALER_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
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
            Updating dealers...
          </div>
        ) : null}
      </GlassCard>

      {loading ? (
        <LoadingState />
      ) : filteredDealers.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
            setRoutingFilter("ALL");
            setActivityFilter("ALL");
            setDealerSort("totalSales");
          }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          {filteredDealers.map((dealer) => (
            <DealersCard
              key={dealer._id}
              dealer={dealer}
              busyAction={busyAction}
              onToggleStatus={() => setStatusDealer(dealer)}
              onEditRouting={() => setRoutingDealer(dealer)}
              onViewProfile={() =>
                navigate(`/admin/dashboard/dealers/${dealer._id}`)
              }
              onViewOrders={() =>
                navigate(`/admin/dashboard/dealers/${dealer._id}/orders`)
              }
              onDelete={() => {
                setDeleteDealer(dealer);
                setDeleteConfirmation("");
              }}
              onUndoDelete={() => handleUndoDeleteDealer(dealer)}
            />
          ))}
        </div>
      )}

      <RoutingModal
        key={routingDealer?._id || "closed"}
        open={Boolean(routingDealer)}
        dealer={routingDealer}
        dispatchers={dispatchers}
        saving={busyAction === `routing-${routingDealer?._id}`}
        onClose={() => {
          if (!busyAction) setRoutingDealer(null);
        }}
        onSave={handleSaveRouting}
      />

      <AdminDecisionModal
        open={Boolean(statusDealer)}
        title={
          statusDealer?.status === "VERIFIED"
            ? "Deactivate Dealer Account"
            : "Activate Dealer Account"
        }
        subtitle={
          statusDealer?.status === "VERIFIED"
            ? "This will suspend dealer portal access, prevent new dealer orders, and revoke refresh access for linked dealer users."
            : "This will restore linked dealer user access and allow the dealer to place orders again."
        }
        tone={statusDealer?.status === "VERIFIED" ? "danger" : "default"}
        confirmLabel={
          statusDealer?.status === "VERIFIED"
            ? "Deactivate Dealer"
            : "Activate Dealer"
        }
        busy={busyAction === `status-${statusDealer?._id}`}
        details={[
          { label: "Company", value: statusDealer?.companyName },
          { label: "Contact", value: statusDealer?.contactName },
          { label: "Email", value: statusDealer?.email },
          {
            label: "New Status",
            value:
              statusDealer?.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED",
          },
        ]}
        onClose={() => {
          if (!busyAction) setStatusDealer(null);
        }}
        onConfirm={async () => {
          if (!statusDealer) return;
          const success = await handleToggleStatus(statusDealer);
          if (success) setStatusDealer(null);
        }}
      />

      <AdminDecisionModal
        open={Boolean(deleteDealer)}
        title="Schedule Dealer Deletion"
        subtitle="This immediately revokes dealer access and moves the dealer profile to Settings Trash for 30 days before permanent database deletion."
        tone="danger"
        confirmLabel="Schedule Deletion"
        busy={busyAction === `delete-${deleteDealer?._id}`}
        details={[
          { label: "Company", value: deleteDealer?.companyName },
          { label: "Contact", value: deleteDealer?.contactName },
          { label: "Email", value: deleteDealer?.email },
          {
            label: "Undo Window",
            value: "30 days in Settings Trash",
          },
        ]}
        requireText={deleteDealer?.companyName || ""}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (!busyAction) {
            setDeleteDealer(null);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={async () => {
          if (!deleteDealer) return;
          const success = await handleDeleteDealer(deleteDealer);
          if (success) {
            setDeleteDealer(null);
            setDeleteConfirmation("");
          }
        }}
      />
    </div>
  );
}
