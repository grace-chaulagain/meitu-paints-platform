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
import {
  Avatar,
  BulkActionBar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  ListRow,
  Pill,
  PrimaryButton,
  RowCheckbox,
  SearchField,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { exportToCsv } from "../../../utils/exportToCsv.js";

const STATUS_FILTERS = [
  { key: "ALL", label: "All Status" },
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
];

const ACTIVE_FILTERS = [
  { key: "ALL", label: "All Dispatchers" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
];

const ACCESS_FILTERS = [
  { key: "ALL", label: "All Access" },
  { key: "READY", label: "Access Ready" },
  { key: "PENDING", label: "Setup Pending" },
];

const DISPATCHER_SORTS = [
  { key: "assignedDealers", label: "Most dealers assigned" },
  { key: "handledOrders", label: "Most orders handled" },
  { key: "latestActivity", label: "Latest activity" },
  { key: "pendingOrders", label: "Most pending orders" },
];

const VIEW_STORAGE_KEY = "meitu.admin.dispatchers.view";

function getInitialView() {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "list";
  } catch {
    return "list";
  }
}

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

// Unlike dealers (only Active/Suspended), dispatchers carry four operationally
// distinct states admins scan for at a glance - so instead of the hash-based
// decorative palette dealers use, the avatar/dot color here is state-driven.
function dispatcherStateColor(dispatcher) {
  if (dispatcher.deletion?.pending) return { bg: "rgba(107,114,128,.12)", fg: "#6b7280" };
  if (dispatcher.status === "REJECTED") return { bg: "rgba(220,38,38,.12)", fg: "#dc2626" };
  if (dispatcher.status === "PENDING") return { bg: "rgba(217,119,6,.12)", fg: "#d97706" };
  if (dispatcher.status === "VERIFIED") {
    return dispatcher.isActive
      ? { bg: "rgba(22,163,74,.12)", fg: "#16a34a" }
      : { bg: "rgba(220,38,38,.12)", fg: "#dc2626" };
  }
  return { bg: "rgba(75,85,99,.12)", fg: "#4b5563" };
}

function dispatcherInitials(dispatcher) {
  const name = String(dispatcher.name || dispatcher.companyName || "Dispatcher").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function dispatcherLocation(dispatcher) {
  const address = String(dispatcher.address || "").trim();
  if (!address) return "No address on file";
  return address.split(",")[0].trim();
}

function accessTone(dispatcher) {
  return dispatcher.accessState?.passwordSet ? "positive" : "caution";
}

function InlineLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        color: "var(--color-graphite,#707070)",
      }}
    >
      {children}
    </div>
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
            borderRadius: 10,
            border: "none",
            background: "var(--color-fog,#f5f5f7)",
            padding: 12,
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--color-ink,#1d1d1f)",
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
            height: 40,
            borderRadius: 10,
            border: "none",
            background: "var(--color-fog,#f5f5f7)",
            padding: "0 12px",
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--color-ink,#1d1d1f)",
            outline: "none",
          }}
        />
      )}
    </div>
  );
}

function DispatcherListRow({ dispatcher, selectionMode, selected, onSelectChange, onOpen }) {
  const initial = String(dispatcher.name || dispatcher.companyName || "D")
    .trim()
    .charAt(0)
    .toUpperCase();
  const isVerified = dispatcher.status === "VERIFIED";
  const isRejected = dispatcher.status === "REJECTED";
  const summary = dispatcher.operationalSummary || {};

  return (
    <ListRow
      onClick={selectionMode ? () => onSelectChange(!selected) : onOpen}
      selected={selectionMode && selected}
    >
      {selectionMode ? <RowCheckbox checked={selected} onChange={onSelectChange} /> : null}
      <Avatar label={initial} size={34} />

      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
          {dispatcher.name || "Unnamed Dispatcher"}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {dispatcher.companyName || "No company name"}
        </div>
      </div>

      <div className="dash-list-row-trailing" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: "0 0 90px" }}>
          <Pill tone={isVerified ? "positive" : isRejected ? "critical" : "neutral"} size="small">
            {dispatcher.status || "Pending"}
          </Pill>
        </div>

        <div style={{ flex: "0 0 90px" }}>
          {isVerified ? (
            <Pill tone={dispatcher.isActive ? "positive" : "critical"} size="small">
              {dispatcher.isActive ? "Active" : "Inactive"}
            </Pill>
          ) : null}
        </div>

        <div style={{ flex: "0 0 120px" }}>
          <Pill tone={accessTone(dispatcher)} size="small">
            {dispatcher.accessState?.passwordSet ? "Access Ready" : "Setup Pending"}
          </Pill>
        </div>

        <div style={{ flex: "0 0 150px", textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
            {summary.assignedDealerCount || 0} dealer{summary.assignedDealerCount === 1 ? "" : "s"}
          </div>
          <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            {summary.handledOrders || 0} orders handled
          </div>
        </div>
      </div>
    </ListRow>
  );
}

function DispatchersGridCard({
  dispatcher,
  selectionMode,
  selected,
  onSelectChange,
  onReview,
  onViewProfile,
  onEdit,
  onToggleActive,
  onDelete,
  busy,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const palette = dispatcherStateColor(dispatcher);
  const isVerified = dispatcher.status === "VERIFIED";
  const isPending = dispatcher.status === "PENDING";
  const deletionPending = Boolean(dispatcher.deletion?.pending);

  return (
    <article
      className={`dispatcher-grid-card ${selected ? "selected" : ""}`}
      onClick={selectionMode ? () => onSelectChange(!selected) : onViewProfile}
    >
      <div className="dispatcher-grid-card-top">
        {selectionMode ? (
          <RowCheckbox checked={selected} onChange={onSelectChange} />
        ) : (
          <div
            className="dispatcher-grid-avatar"
            style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}
          >
            {dispatcherInitials(dispatcher)}
          </div>
        )}

        {!selectionMode ? (
          <div className="dispatcher-grid-menu-wrap" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="dispatcher-grid-menu-btn"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <DashboardIcon name="moreHorizontal" size={16} strokeWidth={2} />
            </button>
            {menuOpen ? (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div className="dispatcher-grid-menu dash-modal-surface-in">
                  {isVerified ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleActive();
                      }}
                    >
                      {dispatcher.isActive ? "Deactivate dispatcher" : "Activate dispatcher"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    {deletionPending ? "Undo delete" : "Delete dispatcher"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="dispatcher-grid-copy">
        <h3>{dispatcher.name || "Unnamed Dispatcher"}</h3>
        <div className="dispatcher-grid-location">
          <span className="dispatcher-grid-dot" style={{ "--dot-color": palette.fg }} aria-hidden="true" />
          {dispatcherLocation(dispatcher)}
        </div>
      </div>

      {!selectionMode ? (
        <div className="dispatcher-grid-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="dispatcher-grid-action-btn"
            onClick={isPending ? onReview : onViewProfile}
            aria-label={isPending ? "Review dispatcher application" : "View dispatcher profile"}
            title={isPending ? "Review application" : "View profile"}
          >
            <DashboardIcon name={isPending ? "inbox" : "eye"} size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="dispatcher-grid-action-btn"
            onClick={onEdit}
            aria-label="Edit dispatcher details"
            title="Edit details"
          >
            <DashboardIcon name="edit" size={15} strokeWidth={1.8} />
          </button>
          {isVerified ? (
            <button
              type="button"
              className="dispatcher-grid-action-btn"
              onClick={onToggleActive}
              aria-label={dispatcher.isActive ? "Deactivate dispatcher" : "Activate dispatcher"}
              title={dispatcher.isActive ? "Deactivate" : "Activate"}
            >
              <DashboardIcon name="shield" size={15} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EditDispatcherModal({ open, dispatcher, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => getDispatcherForm(dispatcher));

  if (!open || !dispatcher) return null;

  const canSave =
    form.name.trim() && form.phone.trim() && form.email.trim() && !saving;

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,.4)",
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
      <Surface
        className="dash-modal-surface-in"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        padding={22}
      >
        <SectionHeader
          title="Edit Dispatcher"
          subtitle="Update operational and contact details for this dispatcher."
          action={
            <GhostButton onClick={onClose} icon="reject">
              Close
            </GhostButton>
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
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
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
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

export default function AdminDispatchersPage() {
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [accessFilter, setAccessFilter] = useState("ALL");
  const [dispatcherSort, setDispatcherSort] = useState("assignedDealers");
  const [actionError, setActionError] = useState("");
  const [editingDispatcher, setEditingDispatcher] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [view, setView] = useState(getInitialView);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  // Status/active/access are filtered client-side alongside search below,
  // rather than passed to the backend - otherwise switching filters would
  // replace the fetched set entirely, making counts for the *other* filter
  // values collapse to whatever happened to be in the last response.
  const dispatcherParams = useMemo(() => ({ limit: 1000 }), []);

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

    return items
      .filter((item) => {
        const matchesSearch =
          !q ||
          [item.name, item.companyName, item.phone, item.email, item.address, item.notes]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));

        const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

        const matchesActive =
          activeFilter === "ALL" ||
          (activeFilter === "ACTIVE" && item.isActive) ||
          (activeFilter === "INACTIVE" && !item.isActive);

        const hasAccess = Boolean(item.accessState?.passwordSet);
        const matchesAccess =
          accessFilter === "ALL" ||
          (accessFilter === "READY" && hasAccess) ||
          (accessFilter === "PENDING" && !hasAccess);

        return matchesSearch && matchesStatus && matchesActive && matchesAccess;
      })
      .sort((a, b) => {
        const aSummary = a.operationalSummary || {};
        const bSummary = b.operationalSummary || {};
        if (dispatcherSort === "handledOrders") {
          return Number(bSummary.handledOrders || 0) - Number(aSummary.handledOrders || 0);
        }
        if (dispatcherSort === "latestActivity") {
          const aTime = new Date(
            aSummary.latestHandledOrderAt || aSummary.latestAssignedOrderAt || 0,
          ).getTime();
          const bTime = new Date(
            bSummary.latestHandledOrderAt || bSummary.latestAssignedOrderAt || 0,
          ).getTime();
          return bTime - aTime;
        }
        if (dispatcherSort === "pendingOrders") {
          return Number(bSummary.pendingAssignedOrders || 0) - Number(aSummary.pendingAssignedOrders || 0);
        }
        return Number(bSummary.assignedDealerCount || 0) - Number(aSummary.assignedDealerCount || 0);
      });
  }, [accessFilter, activeFilter, dispatcherSort, items, search, statusFilter]);

  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item._id)),
    [filteredItems, selectedIds],
  );

  function toggleSelect(dispatcherId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(dispatcherId);
      else next.delete(dispatcherId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) clearSelection();
      return !current;
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setActiveFilter("ALL");
    setAccessFilter("ALL");
    setDispatcherSort("assignedDealers");
  }

  function handleExport(itemsToExport) {
    exportToCsv("dispatchers", [
      { key: "name", label: "Name" },
      { key: "companyName", label: "Company" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
      {
        key: "isActive",
        label: "Active",
        value: (item) => (item.isActive ? "Yes" : "No"),
      },
      { key: "address", label: "Address" },
      {
        key: "assignedDealers",
        label: "Assigned Dealers",
        value: (item) => item.operationalSummary?.assignedDealerCount || 0,
      },
      {
        key: "handledOrders",
        label: "Handled Orders",
        value: (item) => item.operationalSummary?.handledOrders || 0,
      },
    ], itemsToExport);
  }

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

  async function handleBulkActive(nextActive) {
    const targets = selectedItems.filter((item) => item.status === "VERIFIED");
    if (!targets.length) return;

    const success = await runAction("bulk-active", async () => {
      const results = await Promise.allSettled(
        targets.map((item) =>
          setDispatcherActive({ dispatcherId: item._id, isActive: nextActive }).unwrap(),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(
          `${failed} of ${targets.length} dispatcher${targets.length === 1 ? "" : "s"} failed to update.`,
        );
      }
    });

    if (success) clearSelection();
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
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />
      <Surface padding={0} className="dispatcher-nav-panel dash-fade-up">
        <div className="dispatcher-nav-top">
          <div className="dispatcher-nav-heading">
            <h1>Dispatchers</h1>
            <p>Manage and monitor all dispatch partners across Meitu Paints.</p>
          </div>

          <div className="dispatcher-nav-actions">
            <div className="dispatcher-nav-search">
              <SearchField value={search} onChange={setSearch} placeholder="Search dispatchers…" />
            </div>
            <button
              type="button"
              className={`dispatcher-nav-icon-btn ${advancedOpen ? "active" : ""}`}
              onClick={() => setAdvancedOpen((value) => !value)}
              aria-label="More filters"
              aria-expanded={advancedOpen}
            >
              <DashboardIcon name="filter" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className="dispatcher-nav-icon-btn"
              onClick={() => handleExport(filteredItems)}
              aria-label="Export dispatchers"
            >
              <DashboardIcon name="download" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`dispatcher-nav-icon-btn ${view === "list" ? "active" : ""}`}
              onClick={() => updateView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <DashboardIcon name="list" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`dispatcher-nav-icon-btn ${view === "grid" ? "active" : ""}`}
              onClick={() => updateView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <DashboardIcon name="overview" size={16} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="dispatcher-nav-filters">
          <div className="dispatcher-nav-filters-left">
            <AppleDropdown value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} style={{ width: 150 }} />
            <AppleDropdown value={activeFilter} options={ACTIVE_FILTERS} onChange={setActiveFilter} style={{ width: 166 }} />
          </div>
          <div className="dispatcher-nav-filters-right">
            <span className="dispatcher-nav-count">
              {filteredItems.length.toLocaleString()} Dispatcher{filteredItems.length === 1 ? "" : "s"}
            </span>
            <button type="button" className="dispatcher-nav-clear" onClick={resetFilters}>
              Clear
            </button>
          </div>
        </div>

        {advancedOpen ? (
          <div className="dispatcher-nav-advanced dash-fade-up">
            <AppleDropdown value={accessFilter} options={ACCESS_FILTERS} onChange={setAccessFilter} style={{ width: 166 }} />
            <AppleDropdown value={dispatcherSort} options={DISPATCHER_SORTS} onChange={setDispatcherSort} style={{ width: 208 }} />
            <GhostButton onClick={refetchDispatchers} icon="sort">
              Refresh
            </GhostButton>
            <button
              type="button"
              className={`dispatcher-select-mini ${selectionMode ? "active" : ""}`}
              onClick={toggleSelectionMode}
            >
              <DashboardIcon name="checkSquare" size={13} strokeWidth={2} />
              {selectionMode ? "Done" : "Select"}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="dispatcher-nav-error">{error}</div>
        ) : null}

        {isRefreshing ? (
          <div className="dispatcher-nav-updating">Updating dispatchers…</div>
        ) : null}
      </Surface>

      <BulkActionBar count={selectedIds.size} onClear={clearSelection}>
        <GhostButton onClick={() => handleBulkActive(true)} disabled={busyAction === "bulk-active"}>
          Activate
        </GhostButton>
        <GhostButton onClick={() => handleBulkActive(false)} disabled={busyAction === "bulk-active"}>
          Deactivate
        </GhostButton>
        <GhostButton onClick={() => handleExport(selectedItems)} icon="download">
          Export Selected
        </GhostButton>
      </BulkActionBar>

      {loading ? (
        <Surface padding={18}>
          <div style={{ display: "grid", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: 60,
                  borderRadius: 12,
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            ))}
          </div>
        </Surface>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="truck"
          title="No dispatchers found"
          subtitle="Try adjusting the search or status filters to view dispatch partners."
        />
      ) : view === "list" ? (
        <Surface padding={0} className="dash-fade-up">
          {filteredItems.map((dispatcher) => (
            <DispatcherListRow
              key={dispatcher._id}
              dispatcher={dispatcher}
              selectionMode={selectionMode}
              selected={selectedIds.has(dispatcher._id)}
              onSelectChange={(checked) => toggleSelect(dispatcher._id, checked)}
              onOpen={() => {
                if (dispatcher.status === "VERIFIED") {
                  navigate(`/admin/dashboard/dispatchers/${dispatcher._id}`);
                } else {
                  navigate("/admin/dashboard/applications", {
                    state: { openDispatcherId: dispatcher._id },
                  });
                }
              }}
            />
          ))}
        </Surface>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 264px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {filteredItems.map((dispatcher) => (
            <DispatchersGridCard
              key={dispatcher._id}
              dispatcher={dispatcher}
              selectionMode={selectionMode}
              selected={selectedIds.has(dispatcher._id)}
              onSelectChange={(checked) => toggleSelect(dispatcher._id, checked)}
              busy={busyAction === `active-${dispatcher._id}` || busyAction === `delete-${dispatcher._id}`}
              onReview={() =>
                navigate("/admin/dashboard/applications", {
                  state: { openDispatcherId: dispatcher._id },
                })
              }
              onViewProfile={() => navigate(`/admin/dashboard/dispatchers/${dispatcher._id}`)}
              onEdit={() => setEditingDispatcher(dispatcher)}
              onToggleActive={() => setPendingDecision({ type: "active", dispatcher })}
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

      <style>{`
        .dispatcher-nav-panel{
          overflow:visible;
          border-radius:20px !important;
          background:#fff !important;
        }
        .dispatcher-nav-top{
          padding:20px 24px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:18px;
          flex-wrap:wrap;
        }
        .dispatcher-nav-heading{
          min-width:0;
        }
        .dispatcher-nav-heading h1{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:30px;
          line-height:1.1;
          font-weight:800;
          letter-spacing:-.03em;
        }
        .dispatcher-nav-heading p{
          margin:4px 0 0;
          color:var(--color-graphite,#707070);
          font-size:13.5px;
          line-height:1.45;
          font-weight:500;
        }
        .dispatcher-nav-actions{
          flex:0 0 auto;
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .dispatcher-nav-search{
          width:220px;
        }
        .dispatcher-nav-icon-btn{
          width:38px;
          height:38px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:11px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, border-color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-nav-icon-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dispatcher-nav-icon-btn:active{
          transform:scale(.93);
        }
        .dispatcher-nav-icon-btn.active{
          border-color:rgba(220,38,38,.24);
          background:rgba(220,38,38,.08);
          color:#dc2626;
        }
        .dispatcher-nav-filters{
          padding:14px 24px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
        }
        .dispatcher-nav-filters-left{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dispatcher-nav-filters-right{
          display:flex;
          align-items:center;
          gap:14px;
          flex:0 0 auto;
        }
        .dispatcher-nav-count{
          color:var(--color-graphite,#707070);
          font-size:13px;
          font-weight:600;
          white-space:nowrap;
        }
        .dispatcher-nav-clear{
          border:0;
          background:transparent;
          padding:0;
          color:#dc2626;
          font-size:13px;
          font-weight:700;
          cursor:pointer;
        }
        .dispatcher-nav-clear:hover{
          text-decoration:underline;
        }
        .dispatcher-nav-advanced{
          padding:0 24px 16px;
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dispatcher-nav-error{
          margin:0 24px 16px;
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          border:1px solid rgba(180,35,24,.14);
          font-size:13px;
          font-weight:600;
        }
        .dispatcher-nav-updating{
          padding:0 24px 14px;
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }
        .dispatcher-select-mini{
          min-height:34px;
          border:0;
          border-radius:999px;
          padding:0 12px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          cursor:pointer;
          color:var(--color-ink,#1d1d1f);
          background:var(--color-fog,#f5f5f7);
          font-size:12px;
          font-weight:800;
          letter-spacing:-.01em;
          transition:background .16s ease, color .16s ease;
        }
        .dispatcher-select-mini:hover,
        .dispatcher-select-mini.active{
          color:#fff;
          background:var(--color-azure,#0071e3);
        }
        .dispatcher-grid-card{
          position:relative;
          height:208px;
          display:flex;
          flex-direction:column;
          border-radius:20px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
          padding:18px;
          cursor:pointer;
          transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .dispatcher-grid-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.16);
          box-shadow:0 14px 30px rgba(0,0,0,.06);
        }
        .dispatcher-grid-card.selected{
          border-color:rgba(0,113,227,.3);
          background:rgba(0,113,227,.04);
        }
        .dispatcher-grid-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .dispatcher-grid-avatar{
          width:44px;
          height:44px;
          border-radius:13px;
          flex:0 0 44px;
          display:grid;
          place-items:center;
          color:var(--avatar-fg, var(--color-azure,#0071e3));
          background:var(--avatar-bg, rgba(0,113,227,.08));
          font-size:15px;
          font-weight:800;
          letter-spacing:-.01em;
        }
        .dispatcher-grid-menu-wrap{
          position:relative;
          flex:0 0 auto;
        }
        .dispatcher-grid-menu-btn{
          width:28px;
          height:28px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:transparent;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-grid-menu-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dispatcher-grid-menu-btn:active{
          transform:scale(.9);
        }
        .dispatcher-grid-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:172px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .dispatcher-grid-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .dispatcher-grid-menu button:hover:not(:disabled){
          background:rgba(0,113,227,.08);
        }
        .dispatcher-grid-menu button:disabled{
          opacity:.5;
          cursor:not-allowed;
        }
        .dispatcher-grid-copy{
          min-width:0;
          margin-top:14px;
          flex:1 1 auto;
          display:grid;
          align-content:start;
          gap:6px;
        }
        .dispatcher-grid-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:15.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.02em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dispatcher-grid-location{
          display:flex;
          align-items:center;
          gap:7px;
          color:var(--color-graphite,#707070);
          font-size:12.5px;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dispatcher-grid-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--dot-color, var(--color-azure,#0071e3));
        }
        .dispatcher-grid-actions{
          margin-top:16px;
          padding-top:14px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .dispatcher-grid-action-btn{
          width:34px;
          height:34px;
          border:0;
          border-radius:11px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-grid-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .dispatcher-grid-action-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .dispatcher-grid-menu-btn,
          .dispatcher-grid-action-btn{
            transition:none!important;
          }
        }
        @media (prefers-reduced-motion: reduce){
          .dispatcher-nav-icon-btn{
            transition:none!important;
          }
        }
        @media (max-width:900px){
          .dispatcher-nav-top{
            flex-direction:column;
            align-items:stretch;
          }
          .dispatcher-nav-actions{
            justify-content:space-between;
          }
          .dispatcher-nav-search{
            width:100%;
            flex:1 1 auto;
          }
        }
        @media (max-width:760px){
          .dispatcher-nav-top{
            padding:16px 18px;
          }
          .dispatcher-nav-filters{
            padding:12px 18px;
            flex-direction:column;
            align-items:stretch;
          }
          .dispatcher-nav-filters-left{
            width:100%;
          }
          .dispatcher-nav-filters-left > *{
            flex:1 1 auto;
          }
          .dispatcher-nav-filters-right{
            justify-content:space-between;
          }
          .dispatcher-nav-advanced{
            padding:0 18px 14px;
          }
        }
      `}</style>
    </div>
  );
}
