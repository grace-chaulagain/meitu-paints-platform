import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
  useGetVerifiedDispatchersQuery,
  useVerifyAdminOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import CreateSchemeOrderModal from "./CreateSchemeOrderModal.jsx";
import { handleTransitionError, GENERIC_ACTION_ERROR } from "../../../shared/orderConflict.js";
import { TransitionConfirmSheet, TransitionConfirmSheetStyles } from "../../../components/orderflow/TransitionConfirmSheet.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { adminOrderStatusMeta, formatTime, groupOrdersByDay, money } from "./orderFormatting.js";
import { normalizeStatus, resolveOrderItemImage } from "../../../dealer/orderDetailLogic.js";
import {
  EmptyState as DashboardEmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader as DashboardSectionHeader,
  Spinner,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown, PopoverListMenu } from "../../../components/dashboard/ApplePickers.jsx";
import OpsRefetchHairline from "../../../components/dashboard/OpsRefetchHairline.jsx";
import { getTransitions, isWaitingOn } from "../../../shared/orderStateMachine.js";
import { OwnerChip, OwnerChipStyles } from "../../../components/orderflow/OwnerChip.jsx";
import { OrderStatusRail, OrderFlowRailStyles } from "../../../components/orderflow/OrderStatusRail.jsx";
import { useQueueArrivals } from "../../../components/orderflow/arrivals.js";
import { ArrivalStyles, SoundMuteToggle } from "../../../components/orderflow/ArrivalIndicators.jsx";

const PAGE_SIZE_OPTIONS = [
  { key: "25", label: "25 per page" },
  { key: "50", label: "50 per page" },
  { key: "100", label: "100 per page" },
  { key: "200", label: "200 per page" },
];

const STATUS_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "ARCHIVE", label: "Archive" },
  { key: "ALL", label: "All" },
];

const ORDER_STATUS_FILTERS = [
  { key: "ALL", label: "All statuses" },
  { key: "SUBMITTED", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

const ARCHIVE_STATUS_FILTERS = ORDER_STATUS_FILTERS.filter(
  (option) => option.key !== "SUBMITTED",
).map((option) => (option.key === "ALL" ? { ...option, label: "All archived" } : option));

// Primary routing segments, always visible (promoted out of the collapsible
// "Filters" panel - this is how an admin picks which fulfillment pipeline
// they're looking at, not a secondary refinement). "Dispatcher" here means a
// dispatcher's own replenishment orders; "Dispatcher Routed" means dealer
// orders whose fulfillmentMode routes them through a dispatcher rather than
// the factory - the specific-dispatcher picker below only applies to that one.
// "Dispatcher" vs "Dispatcher Routed" used to be the only distinction
// between these two - two different concepts (a dispatcher's own
// restock order vs. a dealer's order fulfilled through a dispatcher) with
// near-identical names. Spelled out so the label alone disambiguates them.
//
// "Scheme Orders" is an origin, not a route, but it belongs in this same
// control for one concrete reason: a scheme snapshots
// `fulfillmentMode: "FACTORY"` (schemes always ship from the factory, even
// for a dispatcher-served dealer), so without its own segment it has nowhere
// to live except mixed into "Factory" alongside real, billable dealer sales.
// Picking it here scopes to schemes only; picking "Factory" now explicitly
// excludes them, so the two are cleanly separable in both directions.
const ROUTE_MODES = [
  { key: "ALL", label: "All" },
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER_REPLENISHMENT", label: "Dispatcher's Own Orders" },
  { key: "DISPATCHER_ALL", label: "Dealer Orders via Dispatcher" },
  { key: "SCHEME", label: "Scheme Orders" },
];

// Collapses the fine-grained routeMode value (which includes DISPATCHER:<id>
// for one specific dispatcher) back to whichever top-level segment it
// belongs to, so the toggle's sliding highlight lands on "Dispatcher Routed"
// regardless of whether a specific dispatcher is also selected.
function routeModeGroup(routeMode) {
  if (routeMode === "FACTORY") return "FACTORY";
  if (routeMode === "SCHEME") return "SCHEME";
  if (routeMode === "DISPATCHER_REPLENISHMENT") return "DISPATCHER_REPLENISHMENT";
  if (routeMode === "DISPATCHER_ALL" || String(routeMode || "").startsWith("DISPATCHER:")) return "DISPATCHER_ALL";
  return "ALL";
}

// "Factory" is the only routing scope that never surprises anyone - it's
// what every dealer order looks like by default, and it's the universal
// default across every status tab, including "All" (an admin who's picked
// "All" in the routing dropdown is deliberately asking to see everything,
// so that's the state worth calling out, not Factory). Anything other than
// Factory silently narrows or redirects the list toward dealers/orders an
// admin scoped to Factory work has never touched - that's exactly the gap
// that reads as "I don't recognize any of these dealers." The scope banner
// and the route-menu trigger's own color both key off this single check.
function isDefaultRouteScope(routeMode) {
  return routeModeGroup(routeMode) === "FACTORY";
}

// Plain-English description of the active routing scope, for the banner
// that replaces "check the dropdown" with "read one sentence." Only called
// when isDefaultRouteScope is false, so every branch here describes a
// deviation worth explaining, not the default state.
function describeRouteScope(routeMode, dispatchers) {
  const group = routeModeGroup(routeMode);
  if (group === "SCHEME") {
    return {
      tone: "caution",
      text: "Showing free-of-cost scheme grants only - these carry no value and are excluded from revenue and receivables.",
    };
  }
  if (group === "DISPATCHER_REPLENISHMENT") {
    return {
      tone: "caution",
      text: "Showing dispatchers' own stock-replenishment orders - not dealer orders.",
    };
  }
  if (group === "DISPATCHER_ALL") {
    if (String(routeMode).startsWith("DISPATCHER:")) {
      const id = String(routeMode).split(":")[1];
      const dispatcher = dispatchers.find((d) => String(d._id) === id);
      const name = dispatcher?.companyName || dispatcher?.name || "a dispatcher";
      return {
        tone: "caution",
        text: `Showing dealer orders routed through ${name} - these dealers aren't part of your Factory queue.`,
      };
    }
    return {
      tone: "caution",
      text: "Showing dealer orders routed through dispatchers - these dealers aren't part of your Factory queue.",
    };
  }
  return { tone: "info", text: "Showing every routing path - Factory, dispatcher-routed, and dispatchers' own orders." };
}

const DATE_PRESETS = [
  { key: "ALL", label: "All time" },
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "Last 7 days" },
  { key: "30D", label: "Last 30 days" },
  { key: "MONTH", label: "This month" },
  { key: "CUSTOM", label: "Custom range…" },
];

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

// Resolves a date-range preset into concrete from/to values (YYYY-MM-DD).
// CUSTOM defers entirely to whatever the admin has picked in the two date
// inputs, so it just passes those straight through.
function resolveDateRange(preset, customFrom, customTo) {
  const now = new Date();

  if (preset === "TODAY") {
    return { from: toDateInputValue(now), to: toDateInputValue(now) };
  }
  if (preset === "7D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }
  if (preset === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }
  if (preset === "MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }
  if (preset === "CUSTOM") {
    return { from: customFrom || "", to: customTo || "" };
  }
  return { from: "", to: "" };
}

const ORDER_LIST_DEFAULTS = {
  filterMode: "PENDING",
  routeMode: "FACTORY",
  datePreset: "ALL",
  customFrom: "",
  customTo: "",
  committedSearch: "",
  orderStatus: "ALL",
  page: 1,
  pageSize: 50,
};

function normalizeFilterMode(value) {
  const mode = String(value || "").toUpperCase();
  return ["PENDING", "ARCHIVE", "ALL"].includes(mode) ? mode : "";
}

function normalizeOrderStatus(value, filterMode) {
  const status = String(value || "").toUpperCase();
  const known = ORDER_STATUS_FILTERS.some((option) => option.key === status);
  if (!known) return "ALL";
  if (filterMode === "ARCHIVE" && status === "SUBMITTED") return "ALL";
  return status;
}

// routeMode's "no need to write this to the URL" default isn't a flat
// constant - it's "FACTORY" on every tab except "All" (which starts broad,
// at "ALL"). Both parseOrderListState's fallback (for a missing `route`
// param) and buildOrderListSearch's omission check (deciding whether
// `route` needs writing at all) must agree on this SAME contextual default,
// or a value that happens to equal the default for its tab round-trips
// through the URL as itself, then gets misread back under a different tab's
// default. Concretely: picking "Factory" while on the All tab used to get
// silently written as "no route param" (FACTORY is the flat default), then
// read back as "ALL" (All tab's own fallback) - resetting the scope the
// admin had just picked and quietly re-including dispatcher-routed orders.
function defaultRouteModeFor(filterMode) {
  return filterMode === "ALL" ? "ALL" : ORDER_LIST_DEFAULTS.routeMode;
}

// The list's filters/pagination live entirely in the URL (rather than plain
// component state) so that navigating into an order's detail page and back
// restores the exact same view - same filters, same page, same scroll spot -
// instead of resetting to defaults on remount.
function parseOrderListState(search) {
  const params = new URLSearchParams(search || "");
  const legacyStatus = String(params.get("status") || "").toUpperCase();
  const viewFromQuery = normalizeFilterMode(params.get("view"));
  const filterMode =
    viewFromQuery ||
    normalizeFilterMode(legacyStatus) ||
    (ORDER_STATUS_FILTERS.some((option) => option.key === legacyStatus)
      ? "ALL"
      : ORDER_LIST_DEFAULTS.filterMode);

  return {
    filterMode,
    routeMode: params.get("route") || defaultRouteModeFor(filterMode),
    datePreset: params.get("date") || ORDER_LIST_DEFAULTS.datePreset,
    customFrom: params.get("from") || "",
    customTo: params.get("to") || "",
    committedSearch: params.get("q") || "",
    orderStatus: normalizeOrderStatus(params.get("orderStatus") || legacyStatus, filterMode),
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize: Number(params.get("pageSize")) || ORDER_LIST_DEFAULTS.pageSize,
  };
}

function buildOrderListSearch(state) {
  const params = new URLSearchParams();
  if (state.filterMode && state.filterMode !== ORDER_LIST_DEFAULTS.filterMode) {
    params.set("view", state.filterMode);
  }
  if (state.routeMode && state.routeMode !== defaultRouteModeFor(state.filterMode)) {
    params.set("route", state.routeMode);
  }
  if (state.datePreset && state.datePreset !== ORDER_LIST_DEFAULTS.datePreset) {
    params.set("date", state.datePreset);
  }
  if (state.customFrom) params.set("from", state.customFrom);
  if (state.customTo) params.set("to", state.customTo);
  if (state.committedSearch) params.set("q", state.committedSearch);
  if (state.orderStatus && state.orderStatus !== ORDER_LIST_DEFAULTS.orderStatus) {
    params.set("orderStatus", state.orderStatus);
  }
  if (state.page && state.page !== ORDER_LIST_DEFAULTS.page) {
    params.set("page", String(state.page));
  }
  if (state.pageSize && state.pageSize !== ORDER_LIST_DEFAULTS.pageSize) {
    params.set("pageSize", String(state.pageSize));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const dateFieldLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-graphite, #707070)",
};

// Apple Maps "mode of transport" picker style: generously spaced rows, no
// dividers, the selected row gets a soft gray rounded-rect fill instead of
// a checkmark.
function RouteModeMenu({ options, value, onChange, isNonDefault = false }) {
  const selectedOption = options.find((option) => option.key === value) || options[0];

  return (
    <PopoverListMenu
      ariaLabel="Order routing"
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
          className={`admin-route-menu-trigger ${isNonDefault ? "is-non-default" : ""}`}
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

// The single fix for "I didn't even know the filter was applied" - a
// sentence, not a dropdown's current value, sitting directly above the
// results so it can't be scrolled past unread. "caution" (amber) is for
// scopes that put unfamiliar dealers on screen (anything dispatcher-related
// - the actual case that caused the confusion); "info" (blue) is for scopes
// that are still her own dealers, just broader or narrower than usual.
function RouteScopeBanner({ scope, resetLabel, onReset }) {
  return (
    <div className={`admin-route-scope-banner tone-${scope.tone}`}>
      <DashboardIcon name={scope.tone === "caution" ? "warning" : "info"} size={15} strokeWidth={2.2} />
      <span className="admin-route-scope-banner-text">{scope.text}</span>
      <button type="button" className="admin-route-scope-banner-reset" onClick={onReset}>
        {resetLabel}
      </button>
    </div>
  );
}

// A trigger-anchored popover for the secondary, less-often-touched filters
// (date range, status, page size) - replaces the old approach of an inline
// GhostButton whose "active" state was a plain style-object swap (an
// instant, unanimated flash to a black pill) toggling a block of controls
// that shoved the rest of the page down with zero transition. This is a
// real floating panel instead: portaled, positioned off the trigger's own
// rect, and animated in/out (scale + opacity, custom ease, transform-origin
// pinned to the trigger since it's a popover, not a centered modal - see
// dash-modal-surface-in's own comment for why modals differ). Closes on
// outside click or Escape, mirroring PopoverListMenu's mechanics in
// ApplePickers.jsx, but hosts arbitrary filter controls as children instead
// of a single-select option list.
function FiltersPopover({ activeCount = 0, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 300;
    const viewportPadding = 12;
    const right = Math.max(viewportPadding, window.innerWidth - rect.right);
    const top = rect.bottom + 8;
    setPosition({ right, top, width });
  }, []);

  const startClose = useCallback(() => {
    setClosing(true);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 160);
  }, []);

  function toggle() {
    if (open) {
      startClose();
    } else {
      updatePosition();
      setOpen(true);
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        startClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, startClose]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`admin-filters-trigger ${open && !closing ? "is-open" : ""}`}
      >
        <DashboardIcon name="filter" size={14} strokeWidth={2} />
        <span>Filters</span>
        {activeCount > 0 ? <span className="admin-filters-badge">{activeCount}</span> : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={startClose} />
              <div
                ref={panelRef}
                role="dialog"
                aria-label="Order filters"
                className={`admin-filters-panel ${closing ? "is-closing" : ""}`}
                style={{ position: "fixed", top: position.top, right: position.right, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                {children}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

export function GlassCard({ children, style = {}, ...rest }) {
  return (
    <Surface {...rest} padding={0} style={style}>
      {children}
    </Surface>
  );
}

export function SectionHeader({ title, subtitle, action = null }) {
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
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-ink, #1d1d1f)",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              lineHeight: 1.55,
              fontWeight: 500,
              color: "var(--color-graphite, #707070)",
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


// The "All routes" scope is the one place Factory orders and dispatcher-
// related orders legitimately land in the same list together (it's the
// tab-level default there, not a mistake) - so it's also the one place a
// flat day-grouped list can genuinely read as "whose order is this?" A
// route section per routing type, each with its own day-grouped list
// inside, keeps the day-grouping everyone's used to while making the type
// boundary a real heading instead of a badge you have to read per card.
// Returns a single ungrouped section when `active` is false, so callers
// that don't need this (the normal single-route scopes) pay no extra cost.
function groupOrdersByRoute(orders, { active }) {
  if (!active) {
    return [{ routeKey: null, routeLabel: null, dayGroups: groupOrdersByDay(orders) }];
  }

  const buckets = new Map();
  orders.forEach((order) => {
    const dealer = order?.dealerSnapshot || order?.dealerId || {};
    const dispatcher = order?.dispatcherSnapshot || order?.dispatcherId || {};
    const isReplenishment = order?.orderOrigin === "DISPATCHER_REPLENISHMENT";
    // Checked before the routing test, not after: a scheme snapshots
    // fulfillmentMode FACTORY, so it would otherwise fall through into the
    // "Factory Orders" bucket and read as a real dealer sale worth NPR 0.
    const isScheme = order?.orderOrigin === "SCHEME";
    const isDispatcherRouted =
      !isReplenishment && !isScheme && (dealer?.fulfillmentMode || "FACTORY") === "DISPATCHER";

    let routeKey;
    let routeLabel;
    if (isScheme) {
      routeKey = "scheme";
      routeLabel = "Scheme Orders (free of cost)";
    } else if (isReplenishment) {
      routeKey = "dispatcher-replenishment";
      routeLabel = "Dispatchers' Own Orders";
    } else if (isDispatcherRouted) {
      const name = dispatcher?.companyName || dispatcher?.name || "Unknown Dispatcher";
      // Keyed on the actual dispatcherId (populated-or-not), not the
      // display name - two dispatchers sharing a company name would
      // otherwise merge into one section/count here, exactly the "wrong
      // dealers grouped together" failure this feature exists to prevent.
      const dispatcherIdValue = order?.dispatcherId?._id || order?.dispatcherId || name;
      routeKey = `dispatcher:${String(dispatcherIdValue)}`;
      routeLabel = `Routed via ${name}`;
    } else {
      routeKey = "factory";
      routeLabel = "Factory Orders";
    }

    if (!buckets.has(routeKey)) {
      buckets.set(routeKey, {
        routeKey,
        routeLabel,
        isDispatcherRelated: routeKey !== "factory" && routeKey !== "scheme",
        // Factory is home base, schemes are the small internal exception,
        // dispatcher-related groups come last. An explicit rank rather than
        // the old boolean flip, now that there are three tiers rather than
        // two.
        rank: routeKey === "factory" ? 0 : routeKey === "scheme" ? 1 : 2,
        orders: [],
      });
    }
    buckets.get(routeKey).orders.push(order);
  });

  // Factory first, then schemes, then dispatcher-related groups
  // alphabetically by label so the list order is stable across reloads.
  return [...buckets.values()]
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.routeLabel.localeCompare(b.routeLabel);
    })
    .map((bucket) => ({ ...bucket, dayGroups: groupOrdersByDay(bucket.orders) }));
}

function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) result.push("ellipsis-" + p);
    result.push(p);
    prev = p;
  });
  return result;
}

export function AdminOrderTabs({ options, value, onChange }) {
  return (
    <div className="admin-order-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            data-status={option.key}
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`admin-order-tab ${active ? "is-active" : ""}`}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span className="admin-order-tab-count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// A true Apple-style sliding segmented control: one shared highlight pill
// physically translates/resizes to the active segment (measured off the DOM)
// rather than each button independently fading its own background - that
// single moving element is what makes it read as fluid instead of just a
// row of toggle buttons.
export function ActionButton({
  children,
  onClick,
  danger = false,
  subtle = false,
  disabled = false,
  icon = "",
  loading = false,
}) {
  const isDisabled = disabled || loading;
  const spinnerColor = danger ? "#b42318" : subtle ? "#707070" : "#fff";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={isDisabled}
      style={{
        height: 36,
        padding: "0 14px",
        borderRadius: 10,
        border: "none",
        background: danger
          ? "rgba(180,35,24,.08)"
          : subtle
            ? "var(--color-fog, #f5f5f7)"
            : "var(--color-azure,#0071e3)",
        color: danger ? "#b42318" : subtle ? "var(--color-ink, #1d1d1f)" : "#fff",
        fontWeight: 600,
        fontSize: 13,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {loading ? (
        <Spinner size={13} color={spinnerColor} />
      ) : icon ? (
        <DashboardIcon name={icon} size={14} strokeWidth={2} />
      ) : null}
      {children}
    </button>
  );
}

export function StatusBadge({ status }) {
  const meta = adminOrderStatusMeta(status);

  return (
    <Pill tone={meta.tone} size="small">
      {meta.label}
    </Pill>
  );
}

export function RoutingBadge({ mode, dispatcherName = "" }) {
  const isDispatcher = mode === "DISPATCHER";
  const label = isDispatcher && dispatcherName ? `Via ${dispatcherName}` : mode || "FACTORY";
  return (
    <Pill tone={isDispatcher ? "accent" : "neutral"} size="small">
      {label}
    </Pill>
  );
}

// Keyed off orderOrigin rather than any derived signal (a zero total, for
// instance) so a scheme is recognisable the instant it appears in any
// list, and can never be confused with an ordinary order that happens to
// total zero. Shared with AdminOrderDetailPage.
export function OriginBadge({ origin, scheme = null }) {
  if (origin === "SCHEME") {
    return (
      <Pill tone="caution" size="small" title={scheme?.label || "Free-of-cost scheme order"}>
        {scheme?.label ? `SCHEME · ${scheme.label}` : "SCHEME · Free of cost"}
      </Pill>
    );
  }
  if (origin !== "DISPATCHER_REPLENISHMENT") return null;
  return (
    <Pill tone="accent" size="small">
      Dispatcher Order
    </Pill>
  );
}

export function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".02em",
          textTransform: "uppercase",
          color: "var(--color-graphite, #707070)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          fontWeight: 500,
          color: "var(--color-ink, #1d1d1f)",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        color: "var(--color-graphite, #707070)",
      }}
    >
      {children}
    </div>
  );
}


function toSafeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function deriveLineTotal(quantity, unitPrice) {
  return toSafeNumber(quantity) * toSafeNumber(unitPrice);
}

export function OrderThumbnails({ items, productsMap, familyMap }) {
  const visible = items.slice(0, 4);
  const overflow = items.length - visible.length;

  if (!visible.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {visible.map((item, index) => {
        const image = resolveOrderItemImage(item, productsMap, familyMap);
        return (
          <div key={`${item.sku || item.code || "item"}-${index}`} className="admin-order-thumb">
            {image?.url ? (
              <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <DashboardIcon name="package" size={16} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
            )}
          </div>
        );
      })}
      {overflow > 0 ? <div className="admin-order-thumb admin-order-thumb-more">+{overflow}</div> : null}
    </div>
  );
}

export function AdminOrderTimelineRow({ item, onOpen, onVerify, isArrived, productsMap, familyMap }) {
  const status = normalizeStatus(item.status);
  const meta = adminOrderStatusMeta(status);
  const items = Array.isArray(item.items) ? item.items : [];
  const dealer = item?.dealerSnapshot || item?.dealerId || {};
  const dealerName = dealer?.companyName || dealer?.contactName || "Unassigned dealer";
  const dispatcher = item?.dispatcherSnapshot || item?.dispatcherId || {};
  // getTransitions already knows admin can never verify a dispatcher-mode
  // order - reusing it here means the inline button and the detail page's
  // action area can never disagree about what's actually offered.
  const verifyTransition = getTransitions(item, "ADMIN").find((t) => t.action === "verify");
  // The one binary distinction that actually matters at a glance: is this
  // Factory's normal work, or is it routed through a dispatcher in some way
  // (a dealer order fulfilled via dispatcher, or a dispatcher's own restock
  // order)? A colored left edge in the app's one accent color (DESIGN.md:
  // azure is the sole accent, so this reuses it rather than adding a new
  // hue) reads before any text does - the exact signal that was missing.
  const isDispatcherRelated =
    (dealer?.fulfillmentMode || "FACTORY") === "DISPATCHER" || item?.orderOrigin === "DISPATCHER_REPLENISHMENT";

  // Status used to be repeated four ways on one card (a colored marker icon,
  // this Pill, the rail, and a bottom "state copy" row with its own spinner)
  // - the Pill + rail together already say everything those extra two said,
  // so this card keeps exactly those two and drops the rest.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className={`dash-selectable-row admin-order-card ${isDispatcherRelated ? "is-dispatcher-related" : ""} ${isArrived ? "orderflow-arrival-highlight" : ""}`}
    >
      <div className="admin-order-card-top">
        <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <span className="admin-order-dealer">{dealerName}</span>
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="admin-order-number">{item.orderNumber || "Unnamed Order"}</span>
            <Pill tone={meta.tone} size="small">{meta.label}</Pill>
            <RoutingBadge
              mode={dealer?.fulfillmentMode || "FACTORY"}
              dispatcherName={dispatcher?.companyName || dispatcher?.name || ""}
            />
            <OriginBadge origin={item?.orderOrigin} scheme={item?.scheme} />
            <OwnerChip order={item} role="ADMIN" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {verifyTransition ? (
            <ActionButton icon="checkmark" onClick={() => onVerify(item, verifyTransition)}>
              Verify
            </ActionButton>
          ) : null}
          <span className="admin-order-amount">{money(item?.totals?.total, item?.totals?.currency)}</span>
          <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)" }} />
        </div>
      </div>

      <div className="admin-order-card-meta-row">
        <OrderThumbnails items={items} productsMap={productsMap} familyMap={familyMap} />
        <span className="admin-order-meta">
          {formatTime(item.createdAt)} · {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <OrderStatusRail order={item} size="sm" />
    </div>
  );
}

// The .admin-order-card* CSS lives inline in this page's own big <style>
// block below (unchanged, left as-is to avoid surgery on a huge, already-
// working template literal) - this is a standalone copy of exactly those
// rules so AdminOrderTimelineRow can be reused verbatim from pages that
// don't render AdminOrdersPage's own JSX tree at all (e.g.
// AdminDealerOrdersPage.jsx), and therefore never get that inline <style>
// injected. Only ever render one or the other on a given page, not both -
// they're identical, so it's harmless but pointless to double them up.
export function AdminOrderCardStyles() {
  return (
    <style>{`
      .admin-order-timeline{ position:relative; display:grid; gap:18px; }
      .admin-order-timeline-day{ position:relative; display:grid; gap:8px; }
      .admin-order-timeline-day-header{ display:flex; align-items:center; padding:0 2px; }
      .admin-order-timeline-day-label{ display:flex; align-items:center; font-size:12px; color:var(--color-graphite, #707070); white-space:nowrap; }
      .admin-order-timeline-day-label strong{ font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); }
      .admin-order-timeline-day-sep{ margin:0 8px; opacity:.5; }
      .admin-order-card{
        border-radius:14px;
        border:1px solid rgba(29,29,31,.08);
        border-left-width:3px;
        background:#fff;
        padding:14px 16px 14px 14px;
        cursor:pointer;
        box-shadow:0 1px 2px rgba(29,29,31,.03);
        transition:border-color .16s ease, background-color .16s ease, box-shadow .16s ease;
      }
      .admin-order-card:hover{ border-color:rgba(0,113,227,.22); box-shadow:0 2px 8px rgba(29,29,31,.05); }
      .admin-order-card.is-dispatcher-related:hover{ border-left-color:var(--color-azure, #0071e3); }
      .admin-order-card:active{ background:rgba(0,113,227,.025); }
      .admin-order-card:focus-visible{ outline:2px solid rgba(0,113,227,.38); outline-offset:2px; }
      .admin-order-card.is-dispatcher-related{ border-left-color:var(--color-azure, #0071e3); }
      .admin-order-card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .admin-order-dealer{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
      .admin-order-number{ font-size:11.5px; font-weight:600; color:var(--color-graphite, #707070); }
      .admin-order-amount{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); white-space:nowrap; }
      .admin-order-card-meta-row{ margin-top:10px; display:flex; align-items:center; gap:10px; }
      .admin-order-meta{ font-size:11.5px; color:var(--color-graphite, #707070); }
      .admin-order-card > .orderflow-rail{ margin-top:10px; }
      .admin-order-thumb{ width:28px; height:28px; border-radius:7px; overflow:hidden; background:var(--color-fog, #f5f5f7); display:grid; place-items:center; flex-shrink:0; border:1px solid rgba(29,29,31,.04); }
      .admin-order-thumb-more{ font-size:10px; font-weight:700; color:var(--color-graphite, #707070); }
      .admin-order-tabs{ display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid rgba(29,29,31,.1); overflow-x:auto; scrollbar-width:none; }
      .admin-order-tabs::-webkit-scrollbar{ display:none; }
      .admin-order-tab{ min-width:max-content; display:flex; align-items:center; gap:10px; padding:12px 18px 15px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; white-space:nowrap; border-radius:14px 14px 0 0; }
      .admin-order-tab:not(.is-active):hover{ background:rgba(29,29,31,.045); }
      .admin-order-tab:not(.is-active):active{ background:rgba(29,29,31,.075); transform:translateY(1px) scale(.985); }
      .admin-order-tab span:first-child{ font-size:13.5px; font-weight:650; color:var(--color-graphite, #707070); }
      .admin-order-tab-count{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:750; background:rgba(29,29,31,.06); color:var(--color-graphite, #707070); }
      .admin-order-tab.is-active{ --tab-accent:var(--color-azure, #0071e3); border-bottom-color:var(--tab-accent); }
      .admin-order-tab.is-active:hover{ background:color-mix(in srgb, var(--tab-accent) 7%, transparent); }
      .admin-order-tab.is-active:active{ background:color-mix(in srgb, var(--tab-accent) 10%, transparent); transform:translateY(1px) scale(.985); }
      .admin-order-tab[data-status="ARCHIVE"].is-active{ --tab-accent:#707070; }
      .admin-order-tab[data-status="ALL"].is-active{ --tab-accent:var(--color-ink, #1d1d1f); }
      .admin-order-tab.is-active span:first-child{ color:var(--tab-accent); font-weight:700; }
      .admin-order-tab.is-active .admin-order-tab-count{ background:color-mix(in srgb, var(--tab-accent) 12%, transparent); color:var(--tab-accent); }
      @media (prefers-reduced-motion: reduce){
        .admin-order-card,
        .admin-order-tab{ transition:none!important; }
        .admin-order-card:hover,
        .admin-order-tab:active{ transform:none!important; }
      }
      @media (max-width:760px){
        .admin-order-tab{ padding-left:10px; padding-right:10px; }
        .admin-order-card{ padding:12px 14px; }
        .admin-order-card-top{ align-items:flex-start; }
      }
      @media (max-width:560px){
        .admin-order-card-top{ flex-direction:column; }
      }
    `}</style>
  );
}

function LoadingState() {
  return (
    <Surface padding={18}>
      <div
        style={{
          height: 220,
          borderRadius: 14,
          background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
        }}
      />
    </Surface>
  );
}

export function OrderItemsTable({ items = [] }) {
  if (!items.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "var(--color-fog, #f5f5f7)",
          color: "var(--color-graphite, #707070)",
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        No items found.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Item", "Qty", "Rate", "Amount"].map((head) => (
              <th
                key={head}
                style={{
                  textAlign: head === "Item" ? "left" : "right",
                  padding: "0 0 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--color-graphite, #707070)",
                }}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={`${item.sku || item.code || item.name}-${index}`}
              style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}
            >
              <td style={{ padding: "12px 0" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                  {item.name || "—"}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  {[item.sku || item.code, item.packLabel || item.variantLabel || item.unit]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              <td style={{ padding: "12px 0", textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                {Number(item.quantity || 0).toLocaleString()}
              </td>
              <td style={{ padding: "12px 0", textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {Number(item.unitPrice || 0).toLocaleString()}
              </td>
              <td style={{ padding: "12px 0", textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                {Number(item.lineTotal || 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STOCK_STATUS_TONES = {
  AVAILABLE: "positive",
  LOW: "caution",
  INSUFFICIENT: "critical",
  OUT_OF_STOCK: "critical",
  UNMATCHED: "neutral",
  CHECKING: "accent",
};

function StockStatusPill({ status }) {
  return (
    <Pill tone={STOCK_STATUS_TONES[status] || "neutral"} size="small">
      {String(status || "UNKNOWN").replace(/_/g, " ")}
    </Pill>
  );
}

export function StockCheckPanel({ stockCheck, loading, error, title = "Factory Stock Check" }) {
  const rows = stockCheck?.items || [];
  const ok = stockCheck?.ok === true;
  const checkedAt = stockCheck?.checkedAt
    ? new Date(stockCheck.checkedAt).toLocaleString()
    : null;

  return (
    <GlassCard style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DashboardIcon name="stock" size={15} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
          <Label>{title}</Label>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {checkedAt ? (
            <span style={{ color: "var(--color-graphite, #707070)", fontSize: 12, fontWeight: 500 }}>
              {checkedAt}
            </span>
          ) : null}
          {loading ? <StockStatusPill status="CHECKING" /> : <StockStatusPill status={ok ? "AVAILABLE" : "INSUFFICIENT"} />}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            background: "rgba(180,35,24,.08)",
            color: "#b42318",
            padding: 12,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              {["Product", "Requested", "Available", "Status"].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "0 10px 8px",
                    textAlign: heading === "Product" || heading === "Status" ? "left" : "right",
                    color: "var(--color-graphite, #707070)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.sku || row.name || "stock"}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "10px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                    {row.name || "Product"}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    {row.sku || "No SKU"}
                  </div>
                </td>
                <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                  {Number(row.requestedQuantity || 0).toLocaleString()}
                </td>
                <td style={{ padding: "10px", textAlign: "right" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                    {Number(row.availableQuantity || 0).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    {Number(row.currentQuantity || 0).toLocaleString()} in stock · {Number(row.reservedQuantity || 0).toLocaleString()} reserved
                  </div>
                </td>
                <td style={{ padding: "10px" }}>
                  <StockStatusPill status={row.status} />
                  {row.message ? (
                    <div style={{ marginTop: 6, color: "var(--color-graphite, #707070)", fontSize: 12, fontWeight: 500 }}>
                      {row.message}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, color: "var(--color-graphite, #707070)", fontWeight: 500, fontSize: 13, textAlign: "center" }}>
                  {loading ? "Checking stock..." : "No stock check rows available."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

export function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <Label>{children}</Label>
    </div>
  );
}

// Search-only picker for a line's product identity - the only way name,
// SKU, code, category, and pack label get set is by selecting a real,
// active catalog product, so an admin can no longer type arbitrary text
// into an order line.
function ProductSearchPicker({ onSelect, onRemove, onCancel }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const productsQuery = useGetProductsQuery({ q: trimmed }, { skip: trimmed.length < 2 });
  const results = productsQuery.data || [];

  return (
    <Surface padding={14} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Label>Search Catalog Product</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel ? <GhostButton onClick={onCancel}>Cancel</GhostButton> : null}
          <GhostButton danger icon="trash" onClick={onRemove}>
            Remove
          </GhostButton>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by product name, SKU, or code…"
        style={inputStyle}
      />

      {trimmed.length < 2 ? (
        <div style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>
          Type at least 2 characters to search the live catalog.
        </div>
      ) : productsQuery.isFetching ? (
        <div style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Searching…</div>
      ) : results.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>No matching products found.</div>
      ) : (
        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {results.slice(0, 20).map((product) => (
            <button
              key={product._id || product.sku}
              type="button"
              onClick={() => onSelect(product)}
              style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,.08)", background: "#fff", cursor: "pointer" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {product.name}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
                  {product.sku} · {product.pack?.label || "—"}
                </div>
              </div>
              <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

function LineEditor({ item, onChange, onRemove, currency = "NPR" }) {
  // Whether to search is tracked as local UI state, not by clearing
  // item.productId - that way clicking "Change" and then backing out
  // (Cancel) leaves the previously-selected product completely intact
  // instead of losing it.
  const [searching, setSearching] = useState(!item.productId);
  const lineTotal = deriveLineTotal(item.quantity, item.unitPrice);

  if (searching) {
    return (
      <ProductSearchPicker
        onRemove={onRemove}
        onCancel={item.productId ? () => setSearching(false) : null}
        onSelect={(product) => {
          const unitPrice = Number(product.pricing?.tiers?.[0]?.pricePerPack || 0);
          const quantity = toSafeNumber(item.quantity) || 1;
          onChange({
            ...item,
            productId: product._id,
            sku: product.sku || "",
            code: product.code || "",
            name: product.name || "",
            category: product.category || "",
            packLabel: product.pack?.label || "",
            unit: product.uom?.base || "",
            quantity,
            unitPrice,
            lineTotal: deriveLineTotal(quantity, unitPrice),
          });
          setSearching(false);
        }}
      />
    );
  }

  return (
    <Surface padding={14} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 110px auto", gap: 10, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </div>
          <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
              {item.sku}{item.packLabel ? ` · ${item.packLabel}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setSearching(true)}
              style={{ border: "none", background: "transparent", color: "var(--color-azure, #0071e3)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              Change
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Label>Qty</Label>
          <input
            type="number"
            min="0"
            value={item.quantity ?? 0}
            onChange={(e) =>
              onChange({
                ...item,
                quantity: toSafeNumber(e.target.value),
                lineTotal: deriveLineTotal(e.target.value, item.unitPrice),
              })
            }
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Label>Unit Rate</Label>
          <input
            type="number"
            min="0"
            value={item.unitPrice ?? 0}
            onChange={(e) =>
              onChange({
                ...item,
                unitPrice: toSafeNumber(e.target.value),
                lineTotal: deriveLineTotal(item.quantity, e.target.value),
              })
            }
            style={inputStyle}
          />
        </div>

        <GhostButton danger icon="trash" onClick={onRemove}>
          Remove
        </GhostButton>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
          Line Total
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
          {money(lineTotal, currency)}
        </span>
      </div>
    </Surface>
  );
}

const inputStyle = {
  width: "100%",
  height: 40,
  borderRadius: 10,
  border: "none",
  background: "var(--color-fog, #f5f5f7)",
  padding: "0 12px",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  borderRadius: 12,
  border: "none",
  background: "var(--color-fog, #f5f5f7)",
  padding: 12,
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
  resize: "vertical",
};

function buildAmendItems(order) {
  return (order?.items || []).map((item) => ({
    ...item,
    quantity: toSafeNumber(item.quantity),
    unitPrice: toSafeNumber(item.unitPrice),
    lineTotal: toSafeNumber(item.lineTotal),
  }));
}

export function AmendModal({ open, order, saving, onClose, onSave }) {
  const [items, setItems] = useState(() => buildAmendItems(order));
  const [dealerNote, setDealerNote] = useState(order?.dealerNote || "");
  const [internalNote, setInternalNote] = useState(order?.internalNote || "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  // This modal stays mounted (controlled purely via `open`), so its state
  // would otherwise only ever initialize once on the first render - any
  // edits (or removed lines) from a prior open would still be there the
  // next time it's reopened. Reset to a fresh copy of the current order
  // every time it transitions from closed to open. Depends on the order's
  // id (not the object reference) so a background refetch of the same
  // order while the modal is open doesn't wipe out an in-progress edit.
  useEffect(() => {
    if (!open || !order) return;
    setItems(buildAmendItems(order));
    setDealerNote(order.dealerNote || "");
    setInternalNote(order.internalNote || "");
    setReason("");
    setNote("");
    setLocalError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?._id]);

  if (!open || !order) return null;

  const currency = order?.totals?.currency || "NPR";
  const subtotal = items.reduce(
    (sum, item) => sum + deriveLineTotal(item.quantity, item.unitPrice),
    0,
  );

  function updateItem(index, nextItem) {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...nextItem,
              quantity: toSafeNumber(nextItem.quantity),
              unitPrice: toSafeNumber(nextItem.unitPrice),
              lineTotal: deriveLineTotal(nextItem.quantity, nextItem.unitPrice),
            }
          : item,
      ),
    );
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addItem() {
    setItems((prev) => [
      {
        productId: null,
        sku: "",
        code: "",
        name: "",
        category: "",
        variantLabel: "",
        packLabel: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        lineTotal: 0,
        notes: "",
      },
      ...prev,
    ]);
  }

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(1080px, 100%)", maxHeight: "90vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader title="Amend Order" subtitle={`Update ${order.orderNumber || "order"} before verification.`} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <DashboardIcon name="close" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(300px,.85fr)", gap: 16, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <CardLabel icon="package">Order Items</CardLabel>
              <GhostButton icon="plus" onClick={addItem}>Add Item</GhostButton>
            </div>

            {items.length === 0 ? (
              <Surface padding={16}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  No line items left. Add at least one item to save the amendment.
                </div>
              </Surface>
            ) : (
              items.map((item, index) => (
                <LineEditor
                  key={`${item.sku || item.code || "line"}-${index}`}
                  item={item}
                  onChange={(nextItem) => updateItem(index, nextItem)}
                  onRemove={() => removeItem(index)}
                  currency={currency}
                />
              ))
            )}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Surface padding={16} style={{ background: "rgba(0,113,227,.06)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                Amendment Total
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>
                {money(subtotal, currency)}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {order.orderNumber} · {items.length} line{items.length === 1 ? "" : "s"}
              </div>
            </Surface>

            <Surface padding={16} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Label>Dealer Note</Label>
                <textarea rows={3} value={dealerNote} onChange={(e) => setDealerNote(e.target.value)} style={textareaStyle} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <Label>Internal Note</Label>
                <textarea rows={3} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} style={textareaStyle} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <Label>Reason for Amendment</Label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Dealer requested quantity change"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <Label>Amendment Note</Label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional internal note"
                  style={inputStyle}
                />
              </div>
            </Surface>
          </div>
        </div>

        {localError ? (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {localError}
          </div>
        ) : null}

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            icon="checkmark"
            disabled={saving}
            onClick={() => {
              if (!items.length) {
                setLocalError("At least one item is required.");
                return;
              }

              const invalid = items.some(
                (item) =>
                  !item.productId ||
                  !String(item.name || "").trim() ||
                  toSafeNumber(item.quantity) <= 0,
              );

              if (invalid) {
                setLocalError(
                  "Each line must be a real catalog product (search and select one) with a quantity greater than zero.",
                );
                return;
              }

              setLocalError("");
              onSave({
                items: items.map((item) => ({
                  ...item,
                  quantity: toSafeNumber(item.quantity),
                  unitPrice: toSafeNumber(item.unitPrice),
                  lineTotal: deriveLineTotal(item.quantity, item.unitPrice),
                })),
                dealerNote: dealerNote.trim(),
                internalNote: internalNote.trim(),
                reason: reason.trim(),
                note: note.trim(),
              });
            }}
          >
            {saving ? "Saving…" : "Save Amendment"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultsRef = useRef(null);
  // "Needs you" isn't a real order status (isWaitingOn is derived client-side
  // from orderStateMachine.js), so it layers on top of the Pending tab
  // rather than becoming a new server-side status value - the only status
  // bucket ADMIN can ever own is factory-mode SUBMITTED, so Pending is
  // already the exact superset this needs. Defaults on; remembered per
  // session once the admin explicitly toggles it off.
  const [needsYouOverride, setNeedsYouOverride] = useState(() => {
    try {
      return sessionStorage.getItem("meitu.admin.orders.needsYouOff") === "1" ? false : null;
    } catch {
      return null;
    }
  });

  const listState = useMemo(
    () => parseOrderListState(location.search),
    [location.search],
  );
  const {
    filterMode,
    routeMode,
    datePreset,
    customFrom,
    customTo,
    committedSearch,
    orderStatus,
    page,
    pageSize,
  } = listState;

  // The search box shows whatever was last committed to the URL - if the admin
  // navigated away and came back, this restores the exact text they searched.
  const [search, setSearch] = useState(() => listState.committedSearch);
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);

  const updateListState = useCallback(
    (patch) => {
      const next = { ...listState, ...patch };
      navigate(
        { pathname: "/admin/dashboard/orders", search: buildOrderListSearch(next) },
        { replace: true },
      );
    },
    [listState, navigate],
  );

  const openOrder = useCallback(
    (order) => {
      navigate(`/admin/dashboard/orders/${order._id}`, {
        state: { fromOrdersList: true },
      });
    },
    [navigate],
  );

  // Inline verify from the list (Phase 3) - never a bare-confirm, always
  // through the same TransitionConfirmSheet the detail page uses.
  const [confirmVerify, setConfirmVerify] = useState(null); // { order, action, target }
  const [listActionBusy, setListActionBusy] = useState(false);
  const [listActionError, setListActionError] = useState("");
  const [verifyAdminOrder] = useVerifyAdminOrderMutation();

  async function handleInlineVerify() {
    if (!confirmVerify) return false;
    setListActionBusy(true);
    setListActionError("");
    try {
      await verifyAdminOrder({ orderId: confirmVerify.order._id, payload: {} }).unwrap();
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        invalidateList: () => ordersQuery.refetch(),
        showToast: () => {}, // the sheet closes on conflict below; no separate page-level toast surface here
      });
      if (wasConflict) {
        setConfirmVerify(null);
      } else {
        setListActionError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
    } finally {
      setListActionBusy(false);
    }
  }

  const orderParams = useMemo(() => {
    const params = {};

    if (filterMode === "ARCHIVE") {
      if (orderStatus && orderStatus !== "ALL") {
        params.status = orderStatus;
      } else {
        params.archive = true;
      }
    } else if (filterMode === "ALL") {
      params.status = orderStatus && orderStatus !== "ALL" ? orderStatus : "ALL";
    } else {
      params.status = "SUBMITTED";
    }

    if (routeMode === "DISPATCHER_REPLENISHMENT") {
      params.orderOrigin = "DISPATCHER_REPLENISHMENT";
    } else if (routeMode === "SCHEME") {
      params.orderOrigin = "SCHEME";
    } else if (routeMode === "DISPATCHER_ALL") {
      params.fulfillmentMode = "DISPATCHER";
    } else if (String(routeMode).startsWith("DISPATCHER:")) {
      params.fulfillmentMode = "DISPATCHER";
      params.dispatcherId = String(routeMode).split(":")[1] || "";
    } else if (routeMode !== "ALL") {
      params.fulfillmentMode = routeMode;
      // Schemes snapshot fulfillmentMode FACTORY, so without this they'd
      // sit inside the Factory scope next to real dealer sales at NPR 0.
      // Excluded here rather than server-side-by-default so the "All"
      // scope still genuinely means all.
      if (routeMode === "FACTORY") params.excludeOrigins = "SCHEME";
    }

    if (committedSearch.trim()) {
      params.q = committedSearch.trim();
    }

    const { from, to } = resolveDateRange(datePreset, customFrom, customTo);
    if (from) params.from = from;
    if (to) params.to = to;

    params.page = page;
    params.limit = pageSize;

    return params;
  }, [
    committedSearch,
    filterMode,
    routeMode,
    datePreset,
    customFrom,
    customTo,
    orderStatus,
    page,
    pageSize,
  ]);

  const ordersQuery = useGetAdminOrdersQuery(orderParams, { pollingInterval: 20000 });
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const totalOrders = ordersQuery.data?.total ?? orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const rangeStart = totalOrders === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalOrders, page * pageSize);
  const dispatchers = useMemo(
    () => dispatchersQuery.data?.items || [],
    [dispatchersQuery.data],
  );

  const productsMap = useMemo(() => {
    const map = {};
    for (const item of productsQuery.data || []) map[item.sku] = item;
    return map;
  }, [productsQuery.data]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [familiesQuery.data]);

  // Only meaningful on the Pending tab (the only status bucket ADMIN can
  // ever own) - elsewhere the toggle has nothing to filter and stays hidden.
  const needsYouEligible = filterMode === "PENDING";
  const needsYouCount = useMemo(
    () => (needsYouEligible ? orders.filter((order) => isWaitingOn(order, "ADMIN")).length : 0),
    [orders, needsYouEligible],
  );
  const needsYouActive = needsYouEligible && (needsYouOverride ?? needsYouCount > 0);
  const visibleOrders = needsYouActive ? orders.filter((order) => isWaitingOn(order, "ADMIN")) : orders;

  // Same lane-diff pattern as Dispatcher's Pending queue and Factory's
  // Inbox lane (§2.6/Phase 4-5) - scoped to the Pending tab, the only
  // status bucket ADMIN can ever own.
  const arrivedIds = useQueueArrivals(filterMode === "PENDING" ? orders : [], filterMode, { laneLabel: "Pending" });

  function toggleNeedsYou() {
    const next = !needsYouActive;
    setNeedsYouOverride(next);
    try {
      sessionStorage.setItem("meitu.admin.orders.needsYouOff", next ? "0" : "1");
    } catch {
      // sessionStorage unavailable - the toggle just won't persist, not fatal
    }
  }

  const showRouteGroups = routeModeGroup(routeMode) === "ALL";
  const routeGroups = useMemo(
    () => groupOrdersByRoute(visibleOrders, { active: showRouteGroups }),
    [visibleOrders, showRouteGroups],
  );
  const pageList = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const loading = ordersQuery.isLoading && orders.length === 0;
  const isRefreshing =
    !loading && (ordersQuery.isFetching || dispatchersQuery.isFetching);
  const queryError = ordersQuery.error || dispatchersQuery.error;
  const error = queryError
    ? getQueryErrorMessage(queryError, "Failed to load orders.")
    : "";

  // Only surfaced once "Dispatcher Routed" is the active segment - narrows
  // that segment down to one specific dispatcher's routed orders.
  const dispatcherPickerOptions = useMemo(
    () => [
      { key: "DISPATCHER_ALL", label: "All Dispatchers" },
      ...dispatchers.map((dispatcher) => ({
        key: `DISPATCHER:${dispatcher._id}`,
        label: dispatcher.companyName || dispatcher.name || "Dispatcher",
      })),
    ],
    [dispatchers],
  );

  const countsByFilter = useMemo(
    () => ({
      PENDING: filterMode === "PENDING" ? orders.length : undefined,
      ARCHIVE: filterMode === "ARCHIVE" ? orders.length : undefined,
      ALL: filterMode === "ALL" ? orders.length : undefined,
    }),
    [orders, filterMode],
  );

  const orderStatusOptions = filterMode === "ARCHIVE" ? ARCHIVE_STATUS_FILTERS : ORDER_STATUS_FILTERS;
  const showStatusFilter = filterMode !== "PENDING";
  const activeFilterCount =
    (datePreset !== ORDER_LIST_DEFAULTS.datePreset ? 1 : 0) +
    (showStatusFilter && orderStatus !== ORDER_LIST_DEFAULTS.orderStatus ? 1 : 0) +
    (pageSize !== ORDER_LIST_DEFAULTS.pageSize ? 1 : 0);

  const applySearch = (nextSearch = search) => {
    updateListState({ committedSearch: nextSearch, page: 1 });
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const resetFilters = () => {
    setSearch("");
    updateListState({
      filterMode: "PENDING",
      routeMode: "FACTORY",
      datePreset: "ALL",
      customFrom: "",
      customTo: "",
      committedSearch: "",
      orderStatus: "ALL",
      page: 1,
    });
  };

  // Narrower than resetFilters() - only clears the secondary filters that
  // live inside the Filters popover (date/status/page size), leaving the
  // status tab, route scope, and search untouched. This is what the
  // popover's own "Clear filters" footer link does; the empty-state's
  // "Clear filters" button still uses the full resetFilters() above.
  const resetSecondaryFilters = () =>
    updateListState({
      datePreset: "ALL",
      customFrom: "",
      customTo: "",
      orderStatus: "ALL",
      page: 1,
    });

  // routeMode is deliberately left untouched here - it used to force-reset to
  // "ALL" every time the All tab was selected, which discarded whatever route
  // scope the admin had already picked (e.g. Factory) the moment they left and
  // came back to this tab. The "All tab starts broad" default still applies on
  // a fresh page load with no route in the URL yet (see defaultRouteModeFor),
  // this only stops re-forcing that default over an explicit choice.
  const changeFilterMode = (next) =>
    updateListState({
      filterMode: next,
      orderStatus: "ALL",
      page: 1,
    });
  const changeRouteMode = (next) => updateListState({ routeMode: next, page: 1 });
  // Deliberately narrower than resetFilters() - only snaps the routing scope
  // back to Factory (the universal default, see isDefaultRouteScope), leaving
  // search/date/status filters untouched. This is the banner's "wrong
  // dealers on screen" fix, not a full "start over."
  const resetRouteScope = () => updateListState({ routeMode: "FACTORY", page: 1 });
  const changeDatePreset = (next) => updateListState({ datePreset: next, page: 1 });
  const changeCustomFrom = (next) => updateListState({ customFrom: next, page: 1 });
  const changeCustomTo = (next) => updateListState({ customTo: next, page: 1 });
  const changeOrderStatus = (next) => updateListState({ orderStatus: normalizeOrderStatus(next, filterMode), page: 1 });
  const changePageSize = (next) => updateListState({ pageSize: Number(next), page: 1 });
  const goToPage = (next) => {
    updateListState({ page: next });
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="admin-orders-page" style={{ display: "grid", gap: 16 }}>
      {/* Mounted only while open so the form always starts clean. */}
      {schemeModalOpen ? (
        <CreateSchemeOrderModal
          open={schemeModalOpen}
          onClose={() => setSchemeModalOpen(false)}
          onCreated={() => setSchemeModalOpen(false)}
        />
      ) : null}

      <Surface padding={16} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <DashboardSectionHeader
            icon="orders"
            title="Order Register"
            subtitle="Track and manage every dealer's order."
            size="small"
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
                <SoundMuteToggle />
              </div>
            }
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ width: 240 }}>
              <SearchField
                value={search}
                onChange={setSearch}
                onSubmit={() => applySearch(search)}
                placeholder="Search order number or dealer…"
              />
            </div>
            <PrimaryButton icon="plus" onClick={() => setSchemeModalOpen(true)}>
              Scheme order
            </PrimaryButton>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <RouteModeMenu
            options={ROUTE_MODES}
            value={routeModeGroup(routeMode)}
            onChange={changeRouteMode}
            isNonDefault={!isDefaultRouteScope(routeMode)}
          />
          {routeModeGroup(routeMode) === "DISPATCHER_ALL" ? (
            <div className="admin-dispatcher-picker dash-fade-up">
              <AppleDropdown
                icon="truck"
                value={String(routeMode).startsWith("DISPATCHER:") ? routeMode : "DISPATCHER_ALL"}
                options={dispatcherPickerOptions}
                onChange={changeRouteMode}
                style={{ width: 210 }}
              />
            </div>
          ) : null}
        </div>

        {!isDefaultRouteScope(routeMode) ? (
          <RouteScopeBanner
            scope={describeRouteScope(routeMode, dispatchers)}
            resetLabel="Back to my Factory queue"
            onReset={resetRouteScope}
          />
        ) : null}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <AdminOrderTabs
              options={STATUS_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }))}
              value={filterMode}
              onChange={changeFilterMode}
            />
            {needsYouEligible ? (
              <button type="button" className={`admin-needs-you-toggle ${needsYouActive ? "active" : ""}`} onClick={toggleNeedsYou}>
                Needs you {needsYouCount > 0 ? `(${needsYouCount})` : ""}
              </button>
            ) : null}
          </div>

          <FiltersPopover activeCount={activeFilterCount}>
            <div className="admin-filters-panel-row">
              <span className="admin-filters-panel-label">Date range</span>
              <AppleDropdown icon="calendar" value={datePreset} options={DATE_PRESETS} onChange={changeDatePreset} />
            </div>
            {datePreset === "CUSTOM" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ ...dateFieldLabelStyle, flex: 1 }}>
                  From
                  <AppleDateField value={customFrom} onChange={changeCustomFrom} />
                </label>
                <label style={{ ...dateFieldLabelStyle, flex: 1 }}>
                  To
                  <AppleDateField value={customTo} onChange={changeCustomTo} />
                </label>
              </div>
            ) : null}
            {showStatusFilter ? (
              <div className="admin-filters-panel-row">
                <span className="admin-filters-panel-label">Status</span>
                <AppleDropdown icon="checkmark" value={orderStatus} options={orderStatusOptions} onChange={changeOrderStatus} />
              </div>
            ) : null}
            <div className="admin-filters-panel-row">
              <span className="admin-filters-panel-label">Page size</span>
              <AppleDropdown value={String(pageSize)} options={PAGE_SIZE_OPTIONS} onChange={changePageSize} />
            </div>
            {activeFilterCount > 0 ? (
              <div className="admin-filters-panel-foot">
                <GhostButton onClick={resetSecondaryFilters}>Clear filters</GhostButton>
              </div>
            ) : null}
          </FiltersPopover>
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      <OpsRefetchHairline visible={isRefreshing} />

      <div ref={resultsRef} style={{ scrollMarginTop: 16, display: "grid", gap: 16 }}>
        {loading ? (
          <LoadingState />
        ) : orders.length === 0 ? (
          <Surface padding={20}>
            <DashboardEmptyState
              icon="orders"
              title={
                filterMode === "ARCHIVE"
                  ? "No archived orders found"
                  : filterMode === "ALL"
                    ? "No orders found"
                    : "No pending orders found"
              }
              subtitle="Try adjusting the search or filters."
            />
            <div style={{ marginTop: 4 }}>
              <GhostButton onClick={resetFilters}>Clear filters</GhostButton>
            </div>
          </Surface>
        ) : (
          <>
            <div className="admin-order-timeline">
              {routeGroups.map((routeGroup) => (
                <div key={routeGroup.routeKey || "flat"} className="admin-order-route-group">
                  {routeGroup.routeLabel ? (
                    <div
                      className={`admin-order-route-heading ${routeGroup.isDispatcherRelated ? "is-dispatcher-related" : ""} ${
                        routeGroup.routeKey === "scheme" ? "is-scheme" : ""
                      }`}
                    >
                      <span className="admin-order-route-heading-dot" aria-hidden="true" />
                      {routeGroup.routeLabel}
                      <span className="admin-order-route-heading-count">{routeGroup.orders.length}</span>
                    </div>
                  ) : null}
                  {routeGroup.dayGroups.map((group) => (
                    <div key={group.key} className="admin-order-timeline-day">
                      <div className="admin-order-timeline-day-header">
                        <div className="admin-order-timeline-day-label">
                          {group.relativeLabel ? (
                            <>
                              <strong>{group.relativeLabel}</strong>
                              <span className="admin-order-timeline-day-sep">•</span>
                              <span>{group.dateText}</span>
                            </>
                          ) : (
                            <strong>{group.dateText}</strong>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {group.orders.map((item) => (
                          <AdminOrderTimelineRow
                            key={item._id}
                            item={item}
                            onOpen={openOrder}
                            onVerify={(order, transition) => {
                              setListActionError("");
                              setConfirmVerify({ order, action: transition.action, target: transition.target });
                            }}
                            isArrived={arrivedIds.has(item._id)}
                            productsMap={productsMap}
                            familyMap={familyMap}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
              <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
                Showing {rangeStart}-{rangeEnd} of {totalOrders} orders
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="admin-order-page-btn"
                >
                  <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
                </button>
                {pageList.map((p) =>
                  typeof p === "number" ? (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      className={`admin-order-page-btn ${p === page ? "is-active" : ""}`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
                      …
                    </span>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="admin-order-page-btn"
                >
                  <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <TransitionConfirmSheet
        open={Boolean(confirmVerify)}
        onClose={() => {
          if (!listActionBusy) {
            setConfirmVerify(null);
            setListActionError("");
          }
        }}
        order={confirmVerify?.order}
        action={confirmVerify?.action}
        target={confirmVerify?.target}
        onConfirm={handleInlineVerify}
        busy={listActionBusy}
        error={listActionError}
      />
      <TransitionConfirmSheetStyles />
      <OwnerChipStyles />
      <OrderFlowRailStyles />
      <ArrivalStyles />

      <style>{`
        .admin-orders-page{
          --admin-button-ease:cubic-bezier(.23,1,.32,1);
        }
        .admin-orders-page button{
          -webkit-tap-highlight-color:transparent;
        }
        .admin-orders-page button:not(:disabled){
          transition:
            transform .16s var(--admin-button-ease),
            background-color .18s ease,
            color .18s ease,
            border-color .18s ease,
            box-shadow .18s ease,
            opacity .18s ease,
            filter .18s ease;
        }
        .admin-orders-page button:not(:disabled):active{
          transform:translateY(1px) scale(.982);
        }
        .admin-orders-page button:focus-visible{
          outline:2px solid rgba(0,113,227,.42);
          outline-offset:3px;
        }
        .admin-needs-you-toggle{
          height:32px;
          padding:0 14px;
          border-radius:999px;
          border:1px solid rgba(0,113,227,.22);
          background:#fff;
          color:var(--color-azure, #0071e3);
          font-size:12.5px;
          font-weight:700;
          cursor:pointer;
        }
        .admin-needs-you-toggle.active{
          background:rgba(0,113,227,.1);
          border-color:transparent;
        }
        .admin-orders-page .admin-ui-ghost-btn:not(:disabled):hover{
          background:rgba(255,255,255,.98)!important;
          border-color:rgba(29,29,31,.16)!important;
          box-shadow:0 10px 24px rgba(29,29,31,.09), inset 0 1px 0 rgba(255,255,255,.9);
          transform:translateY(-1px);
        }
        .admin-orders-page .admin-ui-ghost-btn:not(:disabled):active{
          background:rgba(232,232,237,.72)!important;
          box-shadow:0 3px 10px rgba(29,29,31,.08), inset 0 1px 1px rgba(29,29,31,.06);
          transform:translateY(0) scale(.975);
        }
        .admin-orders-page .admin-ui-primary-btn:not(:disabled):hover{
          background:#0077ed!important;
          box-shadow:0 12px 26px rgba(0,113,227,.22);
          transform:translateY(-1px);
        }
        .admin-orders-page .admin-ui-primary-btn:not(:disabled):active{
          background:#006edb!important;
          box-shadow:0 4px 12px rgba(0,113,227,.18);
          transform:translateY(0) scale(.976);
        }
        .admin-orders-page .apple-dropdown-menu-trigger:not(:disabled):hover,
        .admin-orders-page .apple-date-field-trigger:not(:disabled):hover{
          background:rgba(255,255,255,.98);
          border-color:rgba(29,29,31,.14);
          box-shadow:0 10px 24px rgba(29,29,31,.08), inset 0 1px 0 rgba(255,255,255,.9);
          transform:translateY(-1px);
        }
        .admin-orders-page .apple-dropdown-menu-trigger:not(:disabled):active,
        .admin-orders-page .apple-date-field-trigger:not(:disabled):active{
          background:rgba(232,232,237,.7);
          box-shadow:0 3px 10px rgba(29,29,31,.08), inset 0 1px 1px rgba(29,29,31,.06);
          transform:translateY(0) scale(.978);
        }
        .admin-order-tabs{ display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid rgba(29,29,31,.1); overflow-x:auto; scrollbar-width:none; }
        .admin-order-tabs::-webkit-scrollbar{ display:none; }
        .admin-order-tab{ min-width:max-content; display:flex; align-items:center; gap:10px; padding:12px 18px 15px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; white-space:nowrap; border-radius:14px 14px 0 0; }
        .admin-order-tab:not(.is-active):hover{ background:rgba(29,29,31,.045); }
        .admin-order-tab:not(.is-active):active{ background:rgba(29,29,31,.075); transform:translateY(1px) scale(.985); }
        .admin-order-tab span:first-child{ font-size:13.5px; font-weight:650; color:var(--color-graphite, #707070); }
        .admin-order-tab-count{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:750; background:rgba(29,29,31,.06); color:var(--color-graphite, #707070); }
        .admin-order-tab.is-active{ --tab-accent:var(--color-azure, #0071e3); border-bottom-color:var(--tab-accent); }
        .admin-order-tab.is-active:hover{ background:color-mix(in srgb, var(--tab-accent) 7%, transparent); }
        .admin-order-tab.is-active:active{ background:color-mix(in srgb, var(--tab-accent) 10%, transparent); transform:translateY(1px) scale(.985); }
        .admin-order-tab[data-status="ARCHIVE"].is-active{ --tab-accent:#707070; }
        .admin-order-tab[data-status="ALL"].is-active{ --tab-accent:var(--color-ink, #1d1d1f); }
        .admin-order-tab.is-active span:first-child{ color:var(--tab-accent); font-weight:700; }
        .admin-order-tab.is-active .admin-order-tab-count{ background:color-mix(in srgb, var(--tab-accent) 12%, transparent); color:var(--tab-accent); }

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
          transition:background .16s ease, transform .14s var(--ease-out, ease);
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
        /* Same "this control is doing something notable" treatment the
           "Needs you" toggle already uses when active - the route filter
           previously looked identical whether it was showing everything or
           a narrowed slice, which was half of why a narrowed view went
           unnoticed. */
        .admin-route-menu-trigger.is-non-default{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .admin-route-menu-trigger.is-non-default:hover{
          background:rgba(0,113,227,.16);
        }

        .admin-route-scope-banner{
          margin-top:12px;
          display:flex;
          align-items:center;
          gap:9px;
          padding:11px 14px;
          border-radius:12px;
          font-size:12.5px;
          font-weight:600;
          animation:dashFadeUp .18s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        .admin-route-scope-banner.tone-caution{
          background:rgba(180,131,9,.1);
          color:#8a6300;
          border:1px solid rgba(180,131,9,.18);
        }
        .admin-route-scope-banner.tone-info{
          background:rgba(0,113,227,.07);
          color:#0058b8;
          border:1px solid rgba(0,113,227,.16);
        }
        .admin-route-scope-banner-text{ flex:1 1 auto; min-width:0; }
        .admin-route-scope-banner-reset{
          flex-shrink:0;
          border:none;
          background:rgba(255,255,255,.6);
          color:inherit;
          font-size:12px;
          font-weight:700;
          padding:6px 12px;
          border-radius:999px;
          cursor:pointer;
          transition:background .14s ease;
        }
        .admin-route-scope-banner.tone-caution .admin-route-scope-banner-reset:hover{ background:rgba(255,255,255,.9); }
        .admin-route-scope-banner.tone-info .admin-route-scope-banner-reset:hover{ background:rgba(255,255,255,.9); }

        .admin-route-menu{
          /* No z-index here on purpose - PopoverListMenu sets it inline on
             both the scrim and this panel (MENU_SCRIM_Z/MENU_PANEL_Z in
             ApplePickers.jsx) so the two can't drift apart again. */
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
        @media (prefers-reduced-motion: reduce){
          .admin-route-menu{ animation:none!important; }
          .admin-route-menu-trigger{ transition:none!important; }
        }

        .admin-filters-trigger{
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
          transition:background .16s ease, color .16s ease, transform .12s var(--ease-out, ease);
        }
        .admin-filters-trigger:hover{
          background:rgba(29,29,31,.09);
        }
        .admin-filters-trigger:active{
          transform:scale(.97);
        }
        .admin-filters-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:2px;
        }
        .admin-filters-trigger.is-open{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .admin-filters-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:18px;
          height:18px;
          padding:0 5px;
          border-radius:999px;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-size:11px;
          font-weight:750;
        }

        .admin-filters-panel{
          z-index:1401;
          display:grid;
          gap:12px;
          padding:16px;
          border-radius:20px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 16px 40px rgba(0,0,0,.14), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top right;
          animation:adminFiltersPanelIn .18s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        .admin-filters-panel.is-closing{
          animation:adminFiltersPanelOut .16s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminFiltersPanelIn{
          from{ opacity:0; transform:scale(.95) translateY(-4px); }
          to{ opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes adminFiltersPanelOut{
          from{ opacity:1; transform:scale(1) translateY(0); }
          to{ opacity:0; transform:scale(.97) translateY(-2px); }
        }
        .admin-filters-panel-row{ display:grid; gap:6px; }
        .admin-filters-panel-label{
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-filters-panel-foot{
          display:flex;
          justify-content:flex-end;
          padding-top:2px;
          border-top:1px solid rgba(29,29,31,.08);
        }
        @media (prefers-reduced-motion: reduce){
          .admin-filters-panel{ animation:none!important; }
          .admin-filters-trigger{ transition:none!important; }
        }

        .admin-dispatcher-picker{ display:inline-flex; }

        .admin-order-timeline{ position:relative; display:grid; gap:18px; }
        .admin-order-route-group{ display:grid; gap:14px; }
        /* Only rendered when the "All routes" scope could genuinely mix
           Factory and dispatcher-related orders in one list - a real
           heading per routing type instead of a per-card badge you have to
           read every time, so "whose order is this" is answered once per
           group instead of once per card. */
        .admin-order-route-heading{
          display:flex;
          align-items:center;
          gap:8px;
          padding:0 2px;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-graphite, #707070);
          text-transform:uppercase;
          letter-spacing:.03em;
        }
        .admin-order-route-heading.is-dispatcher-related{ color:var(--color-azure, #0071e3); }
        /* Same amber as the SCHEME pill on each card (Pill tone="caution"),
           so the section heading and the badges inside it read as one thing
           rather than two unrelated highlights. */
        .admin-order-route-heading.is-scheme{ color:var(--color-caution, #b64400); }
        .admin-order-route-heading.is-scheme .admin-order-route-heading-dot{ background:var(--color-caution, #b64400); }
        .admin-order-route-heading-dot{
          width:7px;
          height:7px;
          border-radius:999px;
          background:rgba(29,29,31,.25);
          flex-shrink:0;
        }
        .admin-order-route-heading.is-dispatcher-related .admin-order-route-heading-dot{ background:var(--color-azure, #0071e3); }
        .admin-order-route-heading-count{
          font-weight:600;
          color:var(--color-graphite, #707070);
          text-transform:none;
          letter-spacing:normal;
        }
        .admin-order-timeline-day{ position:relative; display:grid; gap:8px; }
        .admin-order-timeline-day-header{ display:flex; align-items:center; padding:0 2px; }
        .admin-order-timeline-day-label{ display:flex; align-items:center; font-size:12px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .admin-order-timeline-day-label strong{ font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .admin-order-timeline-day-sep{ margin:0 8px; opacity:.5; }

        /* Status used to live in four places on one card (a colored marker
           icon, this Pill, the rail, and a bottom row repeating the label
           with its own spinner) - trimmed to just the Pill + rail, which
           already say everything the other two said. Flatter elevation
           (hairline border, near-flush shadow) matches DESIGN.md's
           restrained-shadow guidance instead of the floating-card look this
           previously had. */
        .admin-order-card{
          border-radius:14px;
          border:1px solid rgba(29,29,31,.08);
          border-left-width:3px;
          background:#fff;
          padding:14px 16px 14px 14px;
          cursor:pointer;
          box-shadow:0 1px 2px rgba(29,29,31,.03);
          transition:border-color .16s ease, background-color .16s ease, box-shadow .16s ease;
        }
        .admin-order-card:hover{ border-color:rgba(0,113,227,.22); box-shadow:0 2px 8px rgba(29,29,31,.05); }
        .admin-order-card.is-dispatcher-related:hover{ border-left-color:var(--color-azure, #0071e3); }
        .admin-order-card:active{ background:rgba(0,113,227,.025); }
        .admin-order-card:focus-visible{ outline:2px solid rgba(0,113,227,.38); outline-offset:2px; }
        /* The one binary "is this mine or a dispatcher's" signal, readable
           before any text is - reuses the app's sole accent color rather
           than introducing a new hue per routing type. */
        .admin-order-card.is-dispatcher-related{ border-left-color:var(--color-azure, #0071e3); }
        .admin-order-card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .admin-order-dealer{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
        .admin-order-number{ font-size:11.5px; font-weight:600; color:var(--color-graphite, #707070); }
        .admin-order-amount{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); white-space:nowrap; }
        .admin-order-card-meta-row{ margin-top:10px; display:flex; align-items:center; gap:10px; }
        .admin-order-meta{ font-size:11.5px; color:var(--color-graphite, #707070); }
        .admin-order-card > .orderflow-rail{ margin-top:10px; }

        .admin-order-thumb{ width:28px; height:28px; border-radius:7px; overflow:hidden; background:var(--color-fog, #f5f5f7); display:grid; place-items:center; flex-shrink:0; border:1px solid rgba(29,29,31,.04); }
        .admin-order-thumb-more{ font-size:10px; font-weight:700; color:var(--color-graphite, #707070); }
        @media (prefers-reduced-motion: reduce){
          .admin-orders-page button,
          .admin-orders-page .admin-order-card{
            transition:none!important;
          }
          .admin-orders-page button:not(:disabled):active,
          .admin-orders-page .admin-ui-ghost-btn:not(:disabled):hover,
          .admin-orders-page .admin-ui-primary-btn:not(:disabled):hover,
          .admin-orders-page .apple-dropdown-menu-trigger:not(:disabled):hover,
          .admin-orders-page .apple-date-field-trigger:not(:disabled):hover,
          .admin-route-menu-trigger:hover,
          .admin-route-menu-row:hover,
          .admin-order-card:hover,
          .admin-order-page-btn:not(.is-active):not(:disabled):hover,
          .admin-order-page-btn.is-active:not(:disabled):hover{
            transform:none!important;
          }
        }

        .admin-order-page-btn{ min-width:32px; height:32px; padding:0 8px; border-radius:10px; border:none; background:transparent; font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .admin-order-page-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .admin-order-page-btn.is-active{ background:var(--color-azure, #0071e3); color:#fff; box-shadow:0 8px 18px rgba(0,113,227,.2); }
        .admin-order-page-btn:not(.is-active):not(:disabled):hover{ background:rgba(29,29,31,.06); transform:translateY(-1px); }
        .admin-order-page-btn:not(.is-active):not(:disabled):active{ background:rgba(29,29,31,.1); transform:translateY(0) scale(.965); }
        .admin-order-page-btn.is-active:not(:disabled):hover{ background:#0077ed; transform:translateY(-1px); box-shadow:0 10px 22px rgba(0,113,227,.24); }
        .admin-order-page-btn.is-active:not(:disabled):active{ background:#006edb; transform:translateY(0) scale(.965); box-shadow:0 4px 12px rgba(0,113,227,.18); }

        @media (max-width:760px){
          .admin-order-tab{ padding-left:10px; padding-right:10px; }
          .admin-order-card{ padding:12px 14px; }
          .admin-order-card-top{ align-items:flex-start; }
        }

        @media (max-width:560px){
          .admin-order-card-top{ flex-direction:column; }
        }
      `}</style>
    </div>
  );
}
