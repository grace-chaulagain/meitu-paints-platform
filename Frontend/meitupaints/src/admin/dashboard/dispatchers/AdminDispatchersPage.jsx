import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useApproveDispatcherMutation,
  useDeleteAdminDispatcherMutation,
  useGetAdminDispatchersQuery,
  useRejectDispatcherMutation,
  useSetAdminDispatcherActiveMutation,
  useUndoAdminDispatcherDeletionMutation,
  useUpdateAdminDispatcherMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import AdminEntityCard, {
  AdminEntityCardStyles,
} from "../components/AdminEntityCard.jsx";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
];

function getDispatcherForm(dispatcher) {
  return {
    name: dispatcher?.name || "",
    companyName: dispatcher?.companyName || "",
    phone: dispatcher?.phone || "",
    email: dispatcher?.email || "",
    address: dispatcher?.address || "",
    notes: dispatcher?.notes || "",
  };
}

function GlassCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
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
        placeholder="Search dispatcher, company, phone, email..."
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

function TabButton({ active, children, onClick, count }) {
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
        boxShadow: active ? "0 12px 24px rgba(180,35,24,.16)" : "none",
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
  danger = false,
  subtle = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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

function InlineLabel({ children }) {
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

function DispatchersCard({
  dispatcher,
  busyAction,
  onApprove,
  onReject,
  onViewProfile,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  const initial = String(dispatcher.name || dispatcher.companyName || "D")
    .trim()
    .charAt(0)
    .toUpperCase();
  const access = dispatcher.accessState || {};
  const deletionPending = Boolean(dispatcher.deletion?.pending);
  const isVerified = dispatcher.status === "VERIFIED";
  const isPending = dispatcher.status === "PENDING";
  const isRejected = dispatcher.status === "REJECTED";

  return (
    <AdminEntityCard
      accent={isVerified ? "success" : isRejected ? "danger" : "neutral"}
      initial={initial}
      title={dispatcher.name || "Unnamed Dispatcher"}
      subtitle={dispatcher.companyName || "No company name"}
      line={dispatcher.email || "No email"}
      badges={[
        {
          label: dispatcher.status || "Pending",
          tone: isVerified ? "success" : isRejected ? "danger" : "muted",
        },
        isVerified
          ? {
              label: dispatcher.isActive ? "Active" : "Inactive",
              tone: dispatcher.isActive ? "success" : "danger",
            }
          : null,
        deletionPending ? { label: "Trash Pending", tone: "danger" } : null,
        isVerified
          ? {
              label: access.passwordSet ? "Access Ready" : "Setup Pending",
              tone: access.passwordSet ? "success" : "danger",
            }
          : null,
      ]}
      actions={[
        isPending
          ? {
              key: "approve",
              label: "Approve",
              busyLabel: "Approving...",
              busy: busyAction === `approve-${dispatcher._id}`,
              disabled: busyAction === `approve-${dispatcher._id}`,
              variant: "primary",
              onClick: onApprove,
            }
          : null,
        isPending
          ? {
              key: "reject",
              label: "Reject",
              busyLabel: "Rejecting...",
              busy: busyAction === `reject-${dispatcher._id}`,
              disabled: busyAction === `reject-${dispatcher._id}`,
              variant: "danger",
              onClick: onReject,
            }
          : null,
        isVerified
          ? {
              key: "profile",
              label: "Profile",
              variant: "primary",
              onClick: onViewProfile,
            }
          : null,
        { key: "edit", label: "Edit", onClick: onEdit },
        isVerified
          ? {
              key: "active",
              label: dispatcher.isActive ? "Deactivate" : "Activate",
              busyLabel: "Saving...",
              busy: busyAction === `active-${dispatcher._id}`,
              disabled:
                busyAction === `active-${dispatcher._id}` || deletionPending,
              variant: dispatcher.isActive ? "danger" : "",
              onClick: onToggleActive,
            }
          : null,
        deletionPending
          ? {
              key: "undo-delete",
              label: "Undo",
              busyLabel: "Restoring...",
              busy: busyAction === `undo-delete-${dispatcher._id}`,
              disabled: busyAction === `undo-delete-${dispatcher._id}`,
              onClick: onDelete,
            }
          : {
              key: "delete",
              label: "Delete",
              busyLabel: "Moving...",
              busy: busyAction === `delete-${dispatcher._id}`,
              disabled: busyAction === `delete-${dispatcher._id}`,
              variant: "danger",
              onClick: onDelete,
            },
      ]}
    />
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 86,
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
        No dispatchers found
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
        Try adjusting the current search or status filters to view dispatcher
        applications and approved dispatch partners.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onReset}>
          Clear filters
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function FormField({ label, value, onChange, placeholder, textarea = false }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <InlineLabel>{label}</InlineLabel>
      {textarea ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          style={{
            width: "100%",
            borderRadius: 16,
            border: "1px solid rgba(15,23,42,.08)",
            background: "#fff",
            padding: 14,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            outline: "none",
            resize: "vertical",
          }}
        />
      ) : (
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 16,
            border: "1px solid rgba(15,23,42,.08)",
            background: "#fff",
            padding: "0 14px",
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            outline: "none",
          }}
        />
      )}
    </div>
  );
}

function EditDispatcherModal({ open, dispatcher, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => getDispatcherForm(dispatcher));

  if (!open || !dispatcher) return null;

  const canSave =
    form.name.trim() && form.phone.trim() && form.email.trim() && !saving;

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
      onClick={onClose}
    >
      <GlassCard
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionHeader
          title="Edit Dispatcher"
          subtitle="Update operational and contact details for this dispatcher."
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

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <FormField
            label="Name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Dispatcher name"
          />
          <FormField
            label="Company Name"
            value={form.companyName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, companyName: e.target.value }))
            }
            placeholder="Company name"
          />
          <FormField
            label="Phone"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="Phone"
          />
          <FormField
            label="Email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="Email"
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              label="Address"
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Address"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              label="Notes"
              textarea
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Operational notes"
            />
          </div>
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
                name: form.name.trim(),
                companyName: form.companyName.trim(),
                phone: form.phone.trim(),
                email: form.email.trim().toLowerCase(),
                address: form.address.trim(),
                notes: form.notes.trim(),
              })
            }
            disabled={!canSave}
          >
            {saving ? "Saving..." : "Save Changes"}
          </ActionButton>
        </div>
      </GlassCard>
    </div>
  );
}

export default function AdminDispatchersPage() {
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("ALL");
  const [actionError, setActionError] = useState("");
  const [editingDispatcher, setEditingDispatcher] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [confirmationText, setConfirmationText] = useState("");

  const dispatcherParams = useMemo(() => {
    const params = {};
    if (statusTab !== "ALL") params.status = statusTab;
    return params;
  }, [statusTab]);

  const dispatchersQuery = useGetAdminDispatchersQuery(dispatcherParams);
  const [approveDispatcher] = useApproveDispatcherMutation();
  const [rejectDispatcher] = useRejectDispatcherMutation();
  const [setDispatcherActive] = useSetAdminDispatcherActiveMutation();
  const [deleteDispatcher] = useDeleteAdminDispatcherMutation();
  const [undoDispatcherDeletion] = useUndoAdminDispatcherDeletionMutation();
  const [updateDispatcher] = useUpdateAdminDispatcherMutation();

  const items = useMemo(
    () => dispatchersQuery.data?.items || [],
    [dispatchersQuery.data],
  );
  const loading = dispatchersQuery.isLoading && items.length === 0;
  const isRefreshing = !loading && dispatchersQuery.isFetching;
  const error =
    actionError ||
    (dispatchersQuery.error
      ? getQueryErrorMessage(dispatchersQuery.error, "Failed to load dispatchers.")
      : "");

  function refetchDispatchers() {
    dispatchersQuery.refetch();
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.name,
        item.companyName,
        item.phone,
        item.email,
        item.address,
        item.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const metrics = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.status === "PENDING").length;
    const verified = items.filter((item) => item.status === "VERIFIED").length;
    const rejected = items.filter((item) => item.status === "REJECTED").length;
    return { total, pending, verified, rejected };
  }, [items]);

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Action could not be completed."));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  const handleApprove = (dispatcher) =>
    runAction(`approve-${dispatcher._id}`, () =>
      approveDispatcher({
        dispatcherId: dispatcher._id,
        payload: { notes: dispatcher.notes || "" },
      }).unwrap(),
    );

  const handleReject = (dispatcher) =>
    runAction(`reject-${dispatcher._id}`, () =>
      rejectDispatcher({
        dispatcherId: dispatcher._id,
        payload: { notes: dispatcher.notes || "" },
      }).unwrap(),
    );

  const handleToggleActive = (dispatcher) =>
    runAction(`active-${dispatcher._id}`, () =>
      setDispatcherActive({
        dispatcherId: dispatcher._id,
        isActive: !dispatcher.isActive,
      }).unwrap(),
    );

  const handleDelete = (dispatcher) => {
    return runAction(`delete-${dispatcher._id}`, () =>
      deleteDispatcher({
        dispatcherId: dispatcher._id,
        payload: {
          confirmation: confirmationText,
          reason: "Admin scheduled dispatcher deletion",
        },
      }).unwrap(),
    );
  };

  const handleUndoDelete = (dispatcher) => {
    return runAction(`undo-delete-${dispatcher._id}`, () =>
      undoDispatcherDeletion(dispatcher._id).unwrap(),
    );
  };

  const handleSaveEdit = async (payload) => {
    if (!editingDispatcher?._id) return;

    try {
      setSavingEdit(true);
      setActionError("");
      await updateDispatcher({
        dispatcherId: editingDispatcher._id,
        payload,
      }).unwrap();
      setEditingDispatcher(null);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to update dispatcher."));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <AdminEntityCardStyles />
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Dispatcher Register"
          subtitle="Filter, review, and manage dispatcher applications and approved dispatch partners."
          action={
            <ActionButton subtle onClick={refetchDispatchers}>
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
            {STATUS_TABS.map((tab) => {
              const counts = {
                ALL: metrics.total,
                PENDING: metrics.pending,
                VERIFIED: metrics.verified,
                REJECTED: metrics.rejected,
              };

              return (
                <TabButton
                  key={tab.key}
                  active={statusTab === tab.key}
                  onClick={() => setStatusTab(tab.key)}
                  count={counts[tab.key]}
                >
                  {tab.label}
                </TabButton>
              );
            })}
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
            Updating dispatchers...
          </div>
        ) : null}
      </GlassCard>

      {loading ? (
        <LoadingState />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setStatusTab("ALL");
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
          {filteredItems.map((dispatcher) => (
            <DispatchersCard
              key={dispatcher._id}
              dispatcher={dispatcher}
              busyAction={busyAction}
              onApprove={() =>
                setPendingDecision({ type: "approve", dispatcher })
              }
              onReject={() =>
                setPendingDecision({ type: "reject", dispatcher })
              }
              onViewProfile={() =>
                navigate(`/admin/dashboard/dispatchers/${dispatcher._id}`)
              }
              onEdit={() => setEditingDispatcher(dispatcher)}
              onToggleActive={() =>
                setPendingDecision({ type: "active", dispatcher })
              }
              onDelete={() => {
                setPendingDecision({
                  type: dispatcher.deletion?.pending ? "undoDelete" : "delete",
                  dispatcher,
                });
                setConfirmationText("");
              }}
            />
          ))}
        </div>
      )}

      <EditDispatcherModal
        key={editingDispatcher?._id || "closed"}
        open={Boolean(editingDispatcher)}
        dispatcher={editingDispatcher}
        saving={savingEdit}
        onClose={() => {
          if (!savingEdit) setEditingDispatcher(null);
        }}
        onSave={handleSaveEdit}
      />

      <AdminDecisionModal
        open={Boolean(pendingDecision)}
        title={
          pendingDecision?.type === "approve"
            ? "Approve Dispatcher"
            : pendingDecision?.type === "reject"
              ? "Reject Dispatcher"
              : pendingDecision?.type === "delete"
                ? "Schedule Dispatcher Deletion"
                : pendingDecision?.type === "undoDelete"
                  ? "Undo Dispatcher Deletion"
                : pendingDecision?.dispatcher?.isActive
                  ? "Deactivate Dispatcher"
                  : "Activate Dispatcher"
        }
        subtitle={
          pendingDecision?.type === "approve"
            ? "This will verify the dispatcher and make the account eligible for operational assignment."
            : pendingDecision?.type === "reject"
              ? "This records a rejection decision for the dispatcher application."
              : pendingDecision?.type === "delete"
                ? "This immediately revokes dispatcher access, unassigns their dealers to factory handling, and moves the record to Settings Trash for 30 days."
                : pendingDecision?.type === "undoDelete"
                  ? "This restores the dispatcher deletion window and reassigns dealers that were unassigned by the scheduled delete."
                : pendingDecision?.dispatcher?.isActive
                  ? "This will prevent this dispatcher from actively handling assigned operations."
                  : "This will restore dispatcher operational availability."
        }
        tone={
          ["reject", "delete"].includes(pendingDecision?.type) ||
          (pendingDecision?.type === "active" &&
            pendingDecision?.dispatcher?.isActive)
            ? "danger"
            : "default"
        }
        confirmLabel={
          pendingDecision?.type === "approve"
            ? "Approve Dispatcher"
            : pendingDecision?.type === "reject"
              ? "Reject Dispatcher"
              : pendingDecision?.type === "delete"
                ? "Schedule Deletion"
                : pendingDecision?.type === "undoDelete"
                  ? "Undo Deletion"
                : pendingDecision?.dispatcher?.isActive
                  ? "Deactivate Dispatcher"
                  : "Activate Dispatcher"
        }
        busy={
          pendingDecision
            ? busyAction ===
              `${
                pendingDecision.type === "undoDelete"
                  ? "undo-delete"
                  : pendingDecision.type
              }-${pendingDecision.dispatcher?._id}`
            : false
        }
        details={[
          { label: "Name", value: pendingDecision?.dispatcher?.name },
          {
            label: "Company",
            value: pendingDecision?.dispatcher?.companyName,
          },
          { label: "Email", value: pendingDecision?.dispatcher?.email },
          { label: "Phone", value: pendingDecision?.dispatcher?.phone },
        ]}
        requireText={
          pendingDecision?.type === "delete"
            ? pendingDecision?.dispatcher?.name || "DELETE"
            : ""
        }
        confirmationText={confirmationText}
        onConfirmationTextChange={setConfirmationText}
        onClose={() => {
          if (!busyAction) {
            setPendingDecision(null);
            setConfirmationText("");
          }
        }}
        onConfirm={async () => {
          if (!pendingDecision?.dispatcher) return;

          const { type, dispatcher } = pendingDecision;
          let success = false;

          if (type === "approve") success = await handleApprove(dispatcher);
          if (type === "reject") success = await handleReject(dispatcher);
          if (type === "active") success = await handleToggleActive(dispatcher);
          if (type === "delete") success = await handleDelete(dispatcher);
          if (type === "undoDelete") success = await handleUndoDelete(dispatcher);

          if (success !== false) {
            setPendingDecision(null);
            setConfirmationText("");
          }
        }}
      />
    </div>
  );
}
