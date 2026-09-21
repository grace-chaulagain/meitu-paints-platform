import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAssignDispatcherToDealerMutation,
  useGetAdminDealersQuery,
  useGetVerifiedDispatchersQuery,
  useUnassignDispatcherFromDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useUpdateAdminDealerStatusMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
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
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown, PopoverListMenu } from "../../../components/dashboard/ApplePickers.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { useIsMobileAdmin } from "../../mobile/useIsMobileAdmin.js";
import { AdminDealersMobileView } from "../../mobile/AdminDealersMobileView.jsx";

const STATUS_FILTERS = [
  { key: "ALL", label: "All Status" },
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

const DEALER_ROUTE_MODES = [
  { key: "ALL", label: "All" },
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER_ALL", label: "Dispatcher Routed" },
];

const VIEW_STORAGE_KEY = "meitu.admin.dealers.view";

function getInitialView() {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "list";
  } catch {
    return "list";
  }
}

function dealerRouteGroup(routeMode) {
  if (routeMode === "FACTORY") return "FACTORY";
  if (routeMode === "DISPATCHER_ALL" || String(routeMode || "").startsWith("DISPATCHER:")) return "DISPATCHER_ALL";
  return "ALL";
}

function DealerRouteMenu({ options, value, onChange }) {
  const selectedOption = options.find((option) => option.key === value) || options[0];

  return (
    <PopoverListMenu
      ariaLabel="Dealer routing"
      menuClassName="admin-route-menu"
      options={options}
      value={value}
      onChange={onChange}
      trigger={({ open, onClick, triggerRef }) => (
        <button
          type="button"
          ref={triggerRef}
          onClick={onClick}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="admin-route-menu-trigger"
        >
          <span>{selectedOption?.label || "Select"}</span>
          <DashboardIcon name="chevron" size={11} strokeWidth={2} style={{ transform: "rotate(90deg)" }} />
        </button>
      )}
      renderRow={(option, { isSelected, isHighlighted, onClick, onMouseEnter }) => (
        <button
          key={option.key}
          type="button"
          role="option"
          aria-selected={isSelected}
          onMouseEnter={onMouseEnter}
          onClick={onClick}
          className={`admin-route-menu-row ${isSelected ? "is-selected" : isHighlighted ? "is-highlighted" : ""}`}
        >
          {option.label}
        </button>
      )}
    />
  );
}


function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
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

function RoutingModal({
  open,
  dealer,
  bulkCount,
  dispatchers,
  saving,
  onClose,
  onSave,
}) {
  const [routingState, setRoutingState] = useState(() =>
    getDealerRoutingState(dealer),
  );
  const { fulfillmentMode, dispatcherId } = routingState;

  if (!open) return null;

  const canSave =
    fulfillmentMode === "FACTORY" ||
    (fulfillmentMode === "DISPATCHER" && dispatcherId);

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
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)" }} padding={22}>
        <SectionHeader
          title="Dealer Routing"
          subtitle={
            bulkCount
              ? `Update routing for ${bulkCount} selected dealers.`
              : `Update routing for ${dealer?.companyName || "dealer"}.`
          }
          action={
            <GhostButton onClick={onClose} icon="reject">
              Close
            </GhostButton>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".02em",
                textTransform: "uppercase",
                color: "var(--color-graphite,#707070)",
              }}
            >
              Fulfillment Mode
            </span>
            <SegmentedControl
              options={ROUTING_MODES.map((option) => ({
                key: option.value,
                label: option.label,
              }))}
              value={fulfillmentMode}
              onChange={(value) =>
                setRoutingState((prev) => ({
                  fulfillmentMode: value,
                  dispatcherId: value === "DISPATCHER" ? prev.dispatcherId : "",
                }))
              }
            />
          </div>

          {fulfillmentMode === "DISPATCHER" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".02em",
                  textTransform: "uppercase",
                  color: "var(--color-graphite,#707070)",
                }}
              >
                Assigned Dispatcher
              </span>
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
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-fog,#f5f5f7)",
                  padding: "0 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-ink,#1d1d1f)",
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
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            onClick={() =>
              onSave({
                fulfillmentMode,
                dispatcherId:
                  fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
              })
            }
            disabled={!canSave || saving}
          >
            {saving ? "Saving…" : "Save Routing"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function activityTone(status) {
  if (status === "ACTIVE") return "positive";
  if (status === "WATCH") return "caution";
  if (status === "INACTIVE") return "critical";
  return "neutral";
}

function DealerListRow({ dealer, selectionMode, selected, onSelectChange, onOpen }) {
  const initial = String(dealer.companyName || dealer.contactName || "D")
    .trim()
    .charAt(0)
    .toUpperCase();
  const isDispatcherRouted = dealer.fulfillmentMode === "DISPATCHER";
  const isVerified = dealer.status === "VERIFIED";
  const summary = dealer.analyticsSummary || {};
  const activityStatus = summary.currentActivityStatus || "NO_APPROVED_ORDERS";

  return (
    <ListRow
      onClick={selectionMode ? () => onSelectChange(!selected) : onOpen}
      selected={selectionMode && selected}
    >
      {selectionMode ? <RowCheckbox checked={selected} onChange={onSelectChange} /> : null}
      <Avatar label={initial} size={34} />

      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
          {dealer.companyName || "Unnamed Dealer"}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {dealer.contactName || "No contact name"}
        </div>
      </div>

      <div className="dash-list-row-trailing" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: "0 0 90px" }}>
          <Pill tone={isVerified ? "positive" : "critical"} size="small">
            {isVerified ? "Active" : dealer.status}
          </Pill>
        </div>

        <div style={{ flex: "0 0 110px" }}>
          <Pill tone={isDispatcherRouted ? "accent" : "neutral"} size="small">
            {isDispatcherRouted ? "Dispatcher" : "Factory"}
          </Pill>
        </div>

        <div style={{ flex: "0 0 120px" }}>
          <Pill tone={activityTone(activityStatus)} size="small">
            {activityStatus.replace(/_/g, " ")}
          </Pill>
        </div>

        <div style={{ flex: "0 0 120px", textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
            {money(summary.totalApprovedSales)}
          </div>
          <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
            {summary.totalApprovedOrders || 0} orders
          </div>
        </div>
      </div>
    </ListRow>
  );
}

// Deterministic per-dealer color, so the same dealer always gets the same
// avatar/route-dot hue across renders (not random) - gives the grid the
// quick-scan visual variety of the reference design without depending on
// any "route"/"territory"/"logo" field this app's data model doesn't have.
const AVATAR_PALETTE = [
  { bg: "rgba(220,38,38,.12)", fg: "#dc2626" },
  { bg: "rgba(124,58,237,.12)", fg: "#7c3aed" },
  { bg: "rgba(234,88,12,.12)", fg: "#ea580c" },
  { bg: "rgba(22,163,74,.12)", fg: "#16a34a" },
  { bg: "rgba(0,113,227,.12)", fg: "#0071e3" },
  { bg: "rgba(219,39,119,.12)", fg: "#db2777" },
  { bg: "rgba(13,148,136,.12)", fg: "#0d9488" },
  { bg: "rgba(75,85,99,.12)", fg: "#4b5563" },
];

function hashString(value) {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dealerPalette(dealer) {
  const key = dealer._id || dealer.companyName || "dealer";
  return AVATAR_PALETTE[hashString(key) % AVATAR_PALETTE.length];
}

function dealerInitials(dealer) {
  const name = String(dealer.companyName || dealer.contactName || "Dealer").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// The reference design shows a colored dot + short "route" label per dealer.
// This app only stores a free-text address, so the first comma-separated
// segment (usually the city/area) stands in for that route label.
function dealerLocation(dealer) {
  const address = String(dealer.address || "").trim();
  if (!address) return "No address on file";
  return address.split(",")[0].trim();
}

// The exact same six fields AdminDealerProfilePage.jsx's own "Company
// Information" panel shows - a dealer missing any of these has a real gap
// an admin would otherwise only discover by opening the profile.
const REQUIRED_DEALER_FIELDS = [
  ["companyName", "Company Name"],
  ["contactName", "Contact Person"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["panVat", "PAN/VAT Number"],
  ["address", "Address"],
];

function missingDealerFields(dealer) {
  return REQUIRED_DEALER_FIELDS.filter(([key]) => !String(dealer?.[key] || "").trim()).map(
    ([, label]) => label,
  );
}

// A corner badge, not a banner - overlapping the card's own edge (like
// Apple's notification-dot convention, or Uber's small status pills) so it
// reads as "something needs attention" without competing with the card's
// real content or the "..." menu button already sitting in that top-right
// corner's padded content area. Light red fill per spec, not the app's
// bold Meitu red - this is an incompleteness nudge, not an error state.
function IncompleteProfileBadge({ missingFields }) {
  if (!missingFields.length) return null;
  return (
    <span
      className="dealer-grid-incomplete-badge"
      title={`Missing: ${missingFields.join(", ")}`}
    >
      <DashboardIcon name="warning" size={10.5} strokeWidth={2.6} />
      Incomplete
    </span>
  );
}

function DealersCard({
  dealer,
  selectionMode,
  selected,
  onSelectChange,
  onViewProfile,
  onAssignRouting,
  onToggleStatus,
  busy,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const palette = dealerPalette(dealer);
  const isVerified = dealer.status === "VERIFIED";
  const missingFields = missingDealerFields(dealer);

  return (
    <article
      className={`dealer-grid-card ${selected ? "selected" : ""}`}
      onClick={selectionMode ? () => onSelectChange(!selected) : onViewProfile}
    >
      <IncompleteProfileBadge missingFields={missingFields} />

      <div className="dealer-grid-card-top">
        {selectionMode ? (
          <RowCheckbox checked={selected} onChange={onSelectChange} />
        ) : (
          <div
            className="dealer-grid-avatar"
            style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}
          >
            {dealerInitials(dealer)}
          </div>
        )}

        {!selectionMode ? (
          <div className="dealer-grid-menu-wrap" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="dealer-grid-menu-btn"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <DashboardIcon name="moreHorizontal" size={16} strokeWidth={2} />
            </button>
            {menuOpen ? (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div className="dealer-grid-menu dash-modal-surface-in">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleStatus();
                    }}
                  >
                    {isVerified ? "Suspend dealer" : "Activate dealer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onAssignRouting();
                    }}
                  >
                    Assign routing
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="dealer-grid-copy">
        <h3>{dealer.companyName || "Unnamed Dealer"}</h3>
        <div className="dealer-grid-location">
          <span className="dealer-grid-dot" style={{ "--dot-color": palette.fg }} aria-hidden="true" />
          {dealerLocation(dealer)}
        </div>
      </div>

      {!selectionMode ? (
        <div className="dealer-grid-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="dealer-grid-action-btn"
            onClick={onAssignRouting}
            aria-label="Assign routing"
            title="Assign routing"
          >
            <DashboardIcon name="user" size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="dealer-grid-action-btn"
            onClick={onViewProfile}
            aria-label="View dealer profile"
            title="View profile"
          >
            <DashboardIcon name="eye" size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="dealer-grid-action-btn"
            onClick={onViewProfile}
            aria-label="Edit dealer details"
            title="Edit details"
          >
            <DashboardIcon name="edit" size={15} strokeWidth={1.8} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

// Search/status/routing/activity/sort filters (plus whether the advanced
// filter row is expanded) live in the URL rather than plain component state,
// so that navigating into a dealer's profile and back restores the exact
// same list view instead of resetting to defaults on remount - the shell's
// scroll cache (DashboardShell.jsx) already restores scroll position by
// pathname on browser-back, this just makes sure the filters that produced
// that scroll position are restored too. Mirrors AdminOrdersPage.jsx's
// listState/updateListState pattern.
const DEALER_LIST_DEFAULTS = {
  search: "",
  statusFilter: "ALL",
  routingFilter: "ALL",
  activityFilter: "ALL",
  dealerSort: "totalSales",
  advancedOpen: false,
};

function parseDealerListState(search) {
  const params = new URLSearchParams(search || "");
  return {
    search: params.get("q") || DEALER_LIST_DEFAULTS.search,
    statusFilter: params.get("status") || DEALER_LIST_DEFAULTS.statusFilter,
    routingFilter: params.get("routing") || DEALER_LIST_DEFAULTS.routingFilter,
    activityFilter: params.get("activity") || DEALER_LIST_DEFAULTS.activityFilter,
    dealerSort: params.get("sort") || DEALER_LIST_DEFAULTS.dealerSort,
    advancedOpen: params.get("advanced") === "1",
  };
}

function buildDealerListSearch(state) {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.statusFilter && state.statusFilter !== DEALER_LIST_DEFAULTS.statusFilter) {
    params.set("status", state.statusFilter);
  }
  if (state.routingFilter && state.routingFilter !== DEALER_LIST_DEFAULTS.routingFilter) {
    params.set("routing", state.routingFilter);
  }
  if (state.activityFilter && state.activityFilter !== DEALER_LIST_DEFAULTS.activityFilter) {
    params.set("activity", state.activityFilter);
  }
  if (state.dealerSort && state.dealerSort !== DEALER_LIST_DEFAULTS.dealerSort) {
    params.set("sort", state.dealerSort);
  }
  if (state.advancedOpen) params.set("advanced", "1");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function AdminDealersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileAdmin();
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");

  const listState = useMemo(() => parseDealerListState(location.search), [location.search]);
  const { search, statusFilter, routingFilter, activityFilter, dealerSort, advancedOpen } = listState;

  const updateListState = useCallback(
    (patch) => {
      const next = { ...listState, ...patch };
      navigate(
        { pathname: "/admin/dashboard/dealers", search: buildDealerListSearch(next) },
        { replace: true },
      );
    },
    [listState, navigate],
  );

  const setSearch = useCallback((value) => updateListState({ search: value }), [updateListState]);
  const setStatusFilter = useCallback((value) => updateListState({ statusFilter: value }), [updateListState]);
  const setRoutingFilter = useCallback((value) => updateListState({ routingFilter: value }), [updateListState]);
  const setActivityFilter = useCallback((value) => updateListState({ activityFilter: value }), [updateListState]);
  const setDealerSort = useCallback((value) => updateListState({ dealerSort: value }), [updateListState]);
  const setAdvancedOpen = useCallback(
    (next) => updateListState({ advancedOpen: typeof next === "function" ? next(advancedOpen) : next }),
    [updateListState, advancedOpen],
  );

  const [view, setView] = useState(getInitialView);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [routingDealer, setRoutingDealer] = useState(null);
  const [bulkRouting, setBulkRouting] = useState(false);

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  // Status is filtered client-side alongside routing/activity/search below,
  // rather than passed to the backend - otherwise switching status tabs
  // would replace the fetched set entirely, making counts for the *other*
  // tabs collapse to whatever happened to be in the last response.
  const dealerParams = useMemo(() => ({ limit: 1000 }), []);

  const dealersQuery = useGetAdminDealersQuery(dealerParams);
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const [updateDealerStatus] = useUpdateAdminDealerStatusMutation();
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

  const dispatcherPickerOptions = useMemo(() => {
    const dispatcherOptions = dispatchers.map((dispatcher) => ({
      key: `DISPATCHER:${dispatcher._id}`,
      label: dispatcher.companyName || dispatcher.name || "Dispatcher",
    }));

    return [
      { key: "DISPATCHER_ALL", label: "All Dispatchers" },
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

      const matchesStatus =
        statusFilter === "ALL" || dealer.status === statusFilter;

      return matchesSearch && matchesRouting && matchesActivity && matchesStatus;
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
  }, [activityFilter, dealerSort, dealers, search, routingFilter, statusFilter]);

  const selectedDealers = useMemo(
    () => filteredDealers.filter((dealer) => selectedIds.has(dealer._id)),
    [filteredDealers, selectedIds],
  );

  function toggleSelect(dealerId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(dealerId);
      else next.delete(dealerId);
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
    updateListState({
      search: DEALER_LIST_DEFAULTS.search,
      statusFilter: DEALER_LIST_DEFAULTS.statusFilter,
      routingFilter: DEALER_LIST_DEFAULTS.routingFilter,
      activityFilter: DEALER_LIST_DEFAULTS.activityFilter,
      dealerSort: DEALER_LIST_DEFAULTS.dealerSort,
    });
  }

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

  const handleSaveRouting = async ({ fulfillmentMode, dispatcherId }) => {
    const targets = bulkRouting ? selectedDealers : [routingDealer].filter(Boolean);
    if (!targets.length) return;

    const actionKey = bulkRouting ? "bulk-routing" : `routing-${routingDealer._id}`;

    const success = await runAction(actionKey, async () => {
      const results = await Promise.allSettled(
        targets.map(async (dealer) => {
          try {
            await updateDealerRouting({
              dealerId: dealer._id,
              payload: { fulfillmentMode, dispatcherId },
            }).unwrap();
          } catch {
            if (fulfillmentMode === "DISPATCHER") {
              await assignDispatcherToDealer({
                dealerId: dealer._id,
                dispatcherId,
              }).unwrap();
              return;
            }
            await unassignDispatcherFromDealer(dealer._id).unwrap();
          }
        }),
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(
          `${failed} of ${targets.length} dealer${targets.length === 1 ? "" : "s"} failed to update.`,
        );
      }
    });

    if (success) {
      setRoutingDealer(null);
      setBulkRouting(false);
      if (bulkRouting) clearSelection();
    }
  };

  async function handleBulkStatus(nextStatus) {
    const targets = selectedDealers;
    if (!targets.length) return;

    const success = await runAction("bulk-status", async () => {
      const results = await Promise.allSettled(
        targets.map((dealer) =>
          updateDealerStatus({ dealerId: dealer._id, status: nextStatus }).unwrap(),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(
          `${failed} of ${targets.length} dealer${targets.length === 1 ? "" : "s"} failed to update.`,
        );
      }
    });

    if (success) clearSelection();
  }

  async function handleToggleDealerStatus(dealer) {
    const nextStatus = dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED";
    await runAction(`status-${dealer._id}`, () =>
      updateDealerStatus({ dealerId: dealer._id, status: nextStatus }).unwrap(),
    );
  }

  function handleExport(dealersToExport) {
    exportToCsv("dealers", [
      { key: "companyName", label: "Company" },
      { key: "contactName", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
      {
        key: "routing",
        label: "Routing",
        value: (dealer) => dealer.fulfillmentMode || "FACTORY",
      },
      {
        key: "dispatcher",
        label: "Assigned Dispatcher",
        value: (dealer) => dealer.dispatcherId?.name || dealer.dispatcher?.name || "",
      },
      {
        key: "approvedOrders",
        label: "Approved Orders",
        value: (dealer) => dealer.analyticsSummary?.totalApprovedOrders || 0,
      },
      {
        key: "approvedSales",
        label: "Approved Sales",
        value: (dealer) => dealer.analyticsSummary?.totalApprovedSales || 0,
      },
      {
        key: "lastOrder",
        label: "Last Order",
        value: (dealer) =>
          dealer.analyticsSummary?.lastApprovedOrderAt
            ? new Date(dealer.analyticsSummary.lastApprovedOrderAt).toISOString()
            : "",
      },
      { key: "panVat", label: "PAN/VAT" },
    ], dealersToExport);
  }

  if (isMobile) {
    return <AdminDealersMobileView />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />
      <Surface padding={0} className="dealer-nav-panel dash-fade-up">
        <div className="dealer-nav-top">
          <div className="dealer-nav-heading">
            <h1>Dealers</h1>
            <p>Manage and monitor all dealers across Meitu Paints.</p>
          </div>

          <div className="dealer-nav-actions">
            <div className="dealer-nav-search">
              <SearchField value={search} onChange={setSearch} placeholder="Search dealers…" />
            </div>
            <button
              type="button"
              className={`dealer-nav-icon-btn ${advancedOpen ? "active" : ""}`}
              onClick={() => setAdvancedOpen((value) => !value)}
              aria-label="More filters"
              aria-expanded={advancedOpen}
            >
              <DashboardIcon name="filter" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className="dealer-nav-icon-btn"
              onClick={() => handleExport(filteredDealers)}
              aria-label="Export dealers"
            >
              <DashboardIcon name="download" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`dealer-nav-icon-btn ${view === "list" ? "active" : ""}`}
              onClick={() => updateView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <DashboardIcon name="list" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`dealer-nav-icon-btn ${view === "grid" ? "active" : ""}`}
              onClick={() => updateView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <DashboardIcon name="overview" size={16} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="dealer-nav-filters">
          <div className="dealer-nav-filters-left">
            <DealerRouteMenu options={DEALER_ROUTE_MODES} value={dealerRouteGroup(routingFilter)} onChange={setRoutingFilter} />
            {dealerRouteGroup(routingFilter) === "DISPATCHER_ALL" ? (
              <div className="dealer-dispatcher-picker dash-fade-up">
                <AppleDropdown
                  icon="truck"
                  value={String(routingFilter).startsWith("DISPATCHER:") ? routingFilter : "DISPATCHER_ALL"}
                  options={dispatcherPickerOptions}
                  onChange={setRoutingFilter}
                  style={{ width: 210 }}
                />
              </div>
            ) : null}
            <AppleDropdown value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} style={{ width: 138 }} />
          </div>
          <div className="dealer-nav-filters-right">
            <span className="dealer-nav-count">
              {filteredDealers.length.toLocaleString()} Dealer{filteredDealers.length === 1 ? "" : "s"}
            </span>
            <button type="button" className="dealer-nav-clear" onClick={resetFilters}>
              Clear
            </button>
          </div>
        </div>

        {advancedOpen ? (
          <div className="dealer-nav-advanced dash-fade-up">
            <AppleDropdown value={activityFilter} options={ACTIVITY_FILTERS} onChange={setActivityFilter} style={{ width: 176 }} />
            <AppleDropdown value={dealerSort} options={DEALER_SORTS} onChange={setDealerSort} style={{ width: 192 }} />
            <GhostButton onClick={refetchPageData} icon="sort">
              Refresh
            </GhostButton>
            <button
              type="button"
              className={`dealer-select-mini ${selectionMode ? "active" : ""}`}
              onClick={toggleSelectionMode}
            >
              <DashboardIcon name="checkSquare" size={13} strokeWidth={2} />
              {selectionMode ? "Done" : "Select"}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="dealer-nav-error">{error}</div>
        ) : null}

        {isRefreshing ? (
          <div className="dealer-nav-updating">Updating dealers…</div>
        ) : null}
      </Surface>

      <BulkActionBar count={selectedIds.size} onClear={clearSelection}>
        <GhostButton onClick={() => handleBulkStatus("VERIFIED")} disabled={busyAction === "bulk-status"}>
          Activate
        </GhostButton>
        <GhostButton onClick={() => handleBulkStatus("SUSPENDED")} disabled={busyAction === "bulk-status"}>
          Suspend
        </GhostButton>
        <GhostButton
          onClick={() => {
            setBulkRouting(true);
            setRoutingDealer(selectedDealers[0] || null);
          }}
        >
          Reassign Routing
        </GhostButton>
        <GhostButton onClick={() => handleExport(selectedDealers)} icon="download">
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
      ) : filteredDealers.length === 0 ? (
        <EmptyState
          icon="store"
          title="No dealers found"
          subtitle="Try adjusting the search or status filters to view dealer accounts."
        />
      ) : view === "list" ? (
        <Surface padding={0} className="dash-fade-up">
          {filteredDealers.map((dealer) => (
            <DealerListRow
              key={dealer._id}
              dealer={dealer}
              selectionMode={selectionMode}
              selected={selectedIds.has(dealer._id)}
              onSelectChange={(checked) => toggleSelect(dealer._id, checked)}
              onOpen={() =>
                navigate(`/admin/dashboard/dealers/${dealer._id}`, {
                  state: { fromDealersList: true },
                })
              }
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
          {filteredDealers.map((dealer) => (
            <DealersCard
              key={dealer._id}
              dealer={dealer}
              selectionMode={selectionMode}
              selected={selectedIds.has(dealer._id)}
              onSelectChange={(checked) => toggleSelect(dealer._id, checked)}
              onViewProfile={() =>
                navigate(`/admin/dashboard/dealers/${dealer._id}`, {
                  state: { fromDealersList: true },
                })
              }
              onAssignRouting={() => setRoutingDealer(dealer)}
              onToggleStatus={() => handleToggleDealerStatus(dealer)}
              busy={busyAction === `status-${dealer._id}`}
            />
          ))}
        </div>
      )}

      <RoutingModal
        key={bulkRouting ? "bulk" : routingDealer?._id || "closed"}
        open={Boolean(routingDealer)}
        dealer={routingDealer}
        bulkCount={bulkRouting ? selectedDealers.length : 0}
        dispatchers={dispatchers}
        saving={
          busyAction === "bulk-routing" ||
          busyAction === `routing-${routingDealer?._id}`
        }
        onClose={() => {
          if (!busyAction) {
            setRoutingDealer(null);
            setBulkRouting(false);
          }
        }}
        onSave={handleSaveRouting}
      />

      <style>{`
        .dealer-nav-panel{
          overflow:visible;
          border-radius:20px !important;
          background:#fff !important;
        }
        .dealer-nav-top{
          padding:20px 24px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:18px;
          flex-wrap:wrap;
        }
        .dealer-nav-heading{
          min-width:0;
        }
        .dealer-nav-heading h1{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:30px;
          line-height:1.1;
          font-weight:800;
          letter-spacing:-.03em;
        }
        .dealer-nav-heading p{
          margin:4px 0 0;
          color:var(--color-graphite,#707070);
          font-size:13.5px;
          line-height:1.45;
          font-weight:500;
        }
        .dealer-nav-actions{
          flex:0 0 auto;
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .dealer-nav-search{
          width:220px;
        }
        .dealer-nav-icon-btn{
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
        .dealer-nav-icon-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-nav-icon-btn:active{
          transform:scale(.93);
        }
        .dealer-nav-icon-btn.active{
          border-color:rgba(220,38,38,.24);
          background:rgba(220,38,38,.08);
          color:#dc2626;
        }
        .admin-route-menu-trigger{
          display:inline-flex;
          align-items:center;
          gap:8px;
          height:38px;
          padding:0 16px;
          border:none;
          border-radius:999px;
          background:rgba(29,29,31,.05);
          color:var(--color-ink, #1d1d1f);
          font-size:13px;
          font-weight:650;
          font-family:inherit;
          cursor:pointer;
          transition:background .16s ease, transform .14s var(--ease-out, ease), box-shadow .16s ease;
        }
        .admin-route-menu-trigger:hover{
          background:rgba(29,29,31,.09);
          box-shadow:0 10px 24px rgba(29,29,31,.08), inset 0 1px 0 rgba(255,255,255,.7);
          transform:translateY(-1px);
        }
        .admin-route-menu-trigger:active{
          background:rgba(29,29,31,.13);
          box-shadow:0 3px 10px rgba(29,29,31,.08), inset 0 1px 1px rgba(29,29,31,.06);
          transform:translateY(0) scale(.97);
        }
        .admin-route-menu-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:2px;
        }
        .admin-route-menu{
          /* z-index is set inline by PopoverListMenu - see ApplePickers.jsx. */
          padding:10px;
          border-radius:20px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 16px 40px rgba(0,0,0,.14), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top;
          animation:adminRouteMenuIn .16s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminRouteMenuIn{
          from{ opacity:0; transform:scale(.95) translateY(-4px); }
          to{ opacity:1; transform:scale(1) translateY(0); }
        }
        .admin-route-menu-row{
          display:block;
          width:100%;
          padding:14px 16px;
          margin-bottom:2px;
          border:none;
          border-radius:14px;
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          font-size:15.5px;
          font-weight:500;
          font-family:inherit;
          text-align:left;
          cursor:pointer;
        }
        .admin-route-menu-row:hover{
          background:rgba(29,29,31,.055);
          transform:translateX(2px);
        }
        .admin-route-menu-row:active{
          background:rgba(29,29,31,.09);
          transform:translateX(2px) scale(.99);
        }
        .admin-route-menu-row:last-child{
          margin-bottom:0;
        }
        .admin-route-menu-row.is-highlighted{
          background:rgba(29,29,31,.045);
        }
        .admin-route-menu-row.is-selected{
          background:rgba(29,29,31,.08);
        }
        .dealer-dispatcher-picker{
          display:inline-flex;
        }
        .dealer-nav-filters{
          padding:14px 24px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
        }
        .dealer-nav-filters-left{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-nav-filters-right{
          display:flex;
          align-items:center;
          gap:14px;
          flex:0 0 auto;
        }
        .dealer-nav-count{
          color:var(--color-graphite,#707070);
          font-size:13px;
          font-weight:600;
          white-space:nowrap;
        }
        .dealer-nav-clear{
          border:0;
          background:transparent;
          padding:0;
          color:#dc2626;
          font-size:13px;
          font-weight:700;
          cursor:pointer;
        }
        .dealer-nav-clear:hover{
          text-decoration:underline;
        }
        .dealer-nav-advanced{
          padding:0 24px 16px;
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-nav-error{
          margin:0 24px 16px;
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          border:1px solid rgba(180,35,24,.14);
          font-size:13px;
          font-weight:600;
        }
        .dealer-nav-updating{
          padding:0 24px 14px;
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }
        .dealer-select-mini{
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
        .dealer-select-mini:hover,
        .dealer-select-mini.active{
          color:#fff;
          background:var(--color-azure,#0071e3);
        }
        .dealer-grid-card{
          position:relative;
          min-height:226px;
          display:flex;
          flex-direction:column;
          border-radius:20px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
          padding:18px;
          cursor:pointer;
          transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .dealer-grid-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.16);
          box-shadow:0 14px 30px rgba(0,0,0,.06);
        }
        .dealer-grid-card.selected{
          border-color:rgba(0,113,227,.3);
          background:rgba(0,113,227,.04);
        }
        .dealer-grid-incomplete-badge{
          position:absolute;
          top:-8px;
          right:14px;
          z-index:2;
          display:inline-flex;
          align-items:center;
          gap:4px;
          height:22px;
          padding:0 9px 0 7px;
          border-radius:999px;
          background:#ffe8e6;
          border:1px solid rgba(255,59,48,.2);
          box-shadow:0 3px 8px rgba(29,29,31,.08);
          color:#c0281c;
          font-size:10.5px;
          font-weight:700;
          letter-spacing:-.005em;
          white-space:nowrap;
        }
        .dealer-grid-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .dealer-grid-avatar{
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
        .dealer-grid-menu-wrap{
          position:relative;
          flex:0 0 auto;
        }
        .dealer-grid-menu-btn{
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
        .dealer-grid-menu-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-grid-menu-btn:active{
          transform:scale(.9);
        }
        .dealer-grid-menu{
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
        .dealer-grid-menu button{
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
        .dealer-grid-menu button:hover:not(:disabled){
          background:rgba(0,113,227,.08);
        }
        .dealer-grid-menu button:disabled{
          opacity:.5;
          cursor:not-allowed;
        }
        .dealer-grid-copy{
          min-width:0;
          margin-top:14px;
          flex:1 1 auto;
          display:grid;
          align-content:start;
          gap:6px;
        }
        .dealer-grid-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:15.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.02em;
          white-space:normal;
          overflow-wrap:anywhere;
          word-break:normal;
        }
        .dealer-grid-location{
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
        .dealer-grid-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--dot-color, var(--color-azure,#0071e3));
        }
        .dealer-grid-actions{
          margin-top:16px;
          padding-top:14px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .dealer-grid-action-btn{
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
        .dealer-grid-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .dealer-grid-action-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .dealer-grid-menu-btn,
          .dealer-grid-action-btn,
          .admin-route-menu-trigger{
            transition:none!important;
          }
          .admin-route-menu{ animation:none!important; }
        }
        @media (prefers-reduced-motion: reduce){
          .dealer-nav-icon-btn{
            transition:none!important;
          }
        }
        @media (max-width:900px){
          .dealer-nav-top{
            flex-direction:column;
            align-items:stretch;
          }
          .dealer-nav-actions{
            justify-content:space-between;
          }
          .dealer-nav-search{
            width:100%;
            flex:1 1 auto;
          }
        }
        @media (max-width:760px){
          .dealer-nav-top{
            padding:16px 18px;
          }
          .dealer-nav-filters{
            padding:12px 18px;
            flex-direction:column;
            align-items:stretch;
          }
          .dealer-nav-filters-left{
            width:100%;
          }
          .dealer-nav-filters-left > *{
            flex:1 1 auto;
          }
          .dealer-nav-filters-right{
            justify-content:space-between;
          }
          .dealer-nav-advanced{
            padding:0 18px 14px;
          }
        }
      `}</style>
    </div>
  );
}
