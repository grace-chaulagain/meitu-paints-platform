import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
  useGetVerifiedDispatchersQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { formatOrderDate, money } from "./orderFormatting.js";
import { normalizeStatus, ORDER_STATUS_META, resolveOrderItemImage } from "../../../dealer/orderDetailLogic.js";
import {
  EmptyState as DashboardEmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader as DashboardSectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown, PopoverListMenu } from "../../../components/dashboard/ApplePickers.jsx";

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
const ROUTE_MODES = [
  { key: "ALL", label: "All" },
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER_REPLENISHMENT", label: "Dispatcher" },
  { key: "DISPATCHER_ALL", label: "Dispatcher Routed" },
];

// Collapses the fine-grained routeMode value (which includes DISPATCHER:<id>
// for one specific dispatcher) back to whichever top-level segment it
// belongs to, so the toggle's sliding highlight lands on "Dispatcher Routed"
// regardless of whether a specific dispatcher is also selected.
function routeModeGroup(routeMode) {
  if (routeMode === "FACTORY") return "FACTORY";
  if (routeMode === "DISPATCHER_REPLENISHMENT") return "DISPATCHER_REPLENISHMENT";
  if (routeMode === "DISPATCHER_ALL" || String(routeMode || "").startsWith("DISPATCHER:")) return "DISPATCHER_ALL";
  return "ALL";
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
    routeMode: params.get("route") || (filterMode === "ALL" ? "ALL" : ORDER_LIST_DEFAULTS.routeMode),
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
  if (state.routeMode && state.routeMode !== ORDER_LIST_DEFAULTS.routeMode) {
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
function RouteModeMenu({ options, value, onChange }) {
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

// Day-grouping + tab/timeline visual pieces below mirror
// src/dealer/DealerOrdersPage.jsx's design exactly (same class-naming
// convention, "admin-order-*" instead of "dealer-order-*") - this list is
// fleet-wide (many dealers, server-paginated) rather than one dealer's own
// history, so grouping-by-day only groups within the current page of
// results, same as the flat list this replaces already did.
function formatDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatRelativeDayLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (formatDayKey(date) === formatDayKey(today)) return "Today";
  if (formatDayKey(date) === formatDayKey(yesterday)) return "Yesterday";
  return null;
}

function groupOrdersByDay(orders) {
  const groups = [];
  const indexByKey = new Map();

  orders.forEach((order) => {
    const key = formatDayKey(order.createdAt);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        relativeLabel: formatRelativeDayLabel(order.createdAt),
        dateText: formatDayDate(order.createdAt),
        orders: [],
      });
    }
    groups[indexByKey.get(key)].orders.push(order);
  });

  return groups;
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

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

function AdminOrderSpinner({ size = 22, color }) {
  return <span aria-hidden="true" className="admin-order-spinner" style={{ width: size, height: size, "--spinner-color": color }} />;
}

function AdminOrderTabs({ options, value, onChange }) {
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
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon ? <DashboardIcon name={icon} size={14} strokeWidth={2} /> : null}
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

export function RoutingBadge({ mode }) {
  const isDispatcher = mode === "DISPATCHER";
  return (
    <Pill tone={isDispatcher ? "accent" : "neutral"} size="small">
      {mode || "FACTORY"}
    </Pill>
  );
}

export function OriginBadge({ origin }) {
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

// Marker/spinner color per status tone (positive/caution/accent/critical/
// neutral - the same tone vocabulary ORDER_STATUS_META already uses),
// generalizing the dealer timeline's two-state (pending/completed) marker
// into one that reads correctly across the full admin status set.
const TONE_MARKER = {
  positive: { color: "#2fb344", bg: "rgba(47,179,68,.14)", icon: "checkmark" },
  caution: { color: "#b45309", bg: "rgba(180,131,9,.14)", icon: "info" },
  accent: { color: "var(--color-azure, #0071e3)", bg: "rgba(0,113,227,.12)", icon: "refresh" },
  critical: { color: "#b42318", bg: "rgba(180,35,24,.12)", icon: "reject" },
  neutral: { color: "var(--color-graphite, #707070)", bg: "rgba(29,29,31,.08)", icon: "package" },
};

function adminOrderStatusMeta(status) {
  const normalized = normalizeStatus(status);
  const base = ORDER_STATUS_META[normalized] || { label: normalized || "—", tone: "neutral", live: false };
  if (normalized === "VERIFIED" || normalized === "DISPATCHED") {
    return { ...base, tone: "accent", live: true };
  }
  return base;
}

function OrderThumbnails({ items, productsMap, familyMap }) {
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

function AdminOrderTimelineRow({ item, onOpen, productsMap, familyMap }) {
  const status = normalizeStatus(item.status);
  const meta = adminOrderStatusMeta(status);
  const marker = TONE_MARKER[meta.tone] || TONE_MARKER.neutral;
  const items = Array.isArray(item.items) ? item.items : [];
  const dealer = item?.dealerSnapshot || item?.dealerId || {};
  const dealerName = dealer?.companyName || dealer?.contactName || "Unassigned dealer";

  return (
    <div className="admin-order-timeline-row">
      <span
        className="admin-order-marker"
        style={{ "--marker-color": marker.color, "--marker-bg": marker.bg }}
        aria-hidden="true"
      >
        <DashboardIcon name={marker.icon} size={13} strokeWidth={2.4} />
      </span>

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
        className="dash-selectable-row admin-order-card"
      >
        <div className="admin-order-card-top">
          <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
            <span className="admin-order-dealer">{dealerName}</span>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="admin-order-number">{item.orderNumber || "Unnamed Order"}</span>
              <Pill tone={meta.tone} size="small">{meta.label}</Pill>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span className="admin-order-amount">{money(item?.totals?.total, item?.totals?.currency)}</span>
            <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)" }} />
          </div>
        </div>

        <div className="admin-order-meta">
          {formatTime(item.createdAt)} · {items.length} {items.length === 1 ? "item" : "items"}
        </div>

        <div className="admin-order-card-bottom">
          <OrderThumbnails items={items} productsMap={productsMap} familyMap={familyMap} />
          <div className="admin-order-state-copy">
            {meta.live ? (
              <>
                <AdminOrderSpinner size={26} color={marker.color} />
                <span style={{ fontSize: 12, fontWeight: 700, color: marker.color }}>{meta.label}</span>
              </>
            ) : (
              <>
                <DashboardIcon name={marker.icon} size={12} strokeWidth={2.4} style={{ color: marker.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: marker.color }}>{meta.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
                  {formatOrderDate(item.updatedAt || item.createdAt)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
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
                {item.components?.length ? (
                  <div style={{ marginTop: 3, fontSize: 12, color: "var(--color-graphite, #707070)", lineHeight: 1.4 }}>
                    Includes: {item.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
                  </div>
                ) : null}
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    } else if (routeMode === "DISPATCHER_ALL") {
      params.fulfillmentMode = "DISPATCHER";
    } else if (String(routeMode).startsWith("DISPATCHER:")) {
      params.fulfillmentMode = "DISPATCHER";
      params.dispatcherId = String(routeMode).split(":")[1] || "";
    } else if (routeMode !== "ALL") {
      params.fulfillmentMode = routeMode;
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

  const ordersQuery = useGetAdminOrdersQuery(orderParams);
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

  const groupedOrders = useMemo(() => groupOrdersByDay(orders), [orders]);
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

  const changeFilterMode = (next) =>
    updateListState({
      filterMode: next,
      routeMode: next === "ALL" ? "ALL" : routeMode,
      orderStatus: "ALL",
      page: 1,
    });
  const changeRouteMode = (next) => updateListState({ routeMode: next, page: 1 });
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
      <Surface padding={18} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <DashboardSectionHeader
            icon="orders"
            title="Order Register"
            subtitle="Track and manage every dealer's order."
            action={isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
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
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <AdminOrderTabs
            options={STATUS_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }))}
            value={filterMode}
            onChange={changeFilterMode}
          />
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <RouteModeMenu options={ROUTE_MODES} value={routeModeGroup(routeMode)} onChange={changeRouteMode} />
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
          <GhostButton
            icon="filter"
            onClick={() => setFiltersOpen((value) => !value)}
            style={
              filtersOpen
                ? {
                    background: "var(--color-ink, #1d1d1f)",
                    color: "#fff",
                    borderColor: "var(--color-ink, #1d1d1f)",
                    boxShadow: "0 12px 26px rgba(29,29,31,.16)",
                  }
                : undefined
            }
          >
            Filters
          </GhostButton>
        </div>

        {filtersOpen ? (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AppleDropdown icon="calendar" value={datePreset} options={DATE_PRESETS} onChange={changeDatePreset} style={{ width: 170 }} />
            {showStatusFilter ? (
              <AppleDropdown
                icon="checkmark"
                value={orderStatus}
                options={orderStatusOptions}
                onChange={changeOrderStatus}
                style={{ width: 178 }}
              />
            ) : null}
            <AppleDropdown value={String(pageSize)} options={PAGE_SIZE_OPTIONS} onChange={changePageSize} style={{ width: 150 }} />
            {datePreset === "CUSTOM" ? (
              <>
                <label style={dateFieldLabelStyle}>
                  From
                  <AppleDateField value={customFrom} onChange={changeCustomFrom} />
                </label>
                <label style={dateFieldLabelStyle}>
                  To
                  <AppleDateField value={customTo} onChange={changeCustomTo} />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

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
              {groupedOrders.map((group) => (
                <div key={group.key} className="admin-order-timeline-day">
                  <div className="admin-order-timeline-day-header">
                    <span className="admin-order-timeline-day-marker" aria-hidden="true" />
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
                  <div style={{ display: "grid", gap: 14 }}>
                    {group.orders.map((item) => (
                      <AdminOrderTimelineRow key={item._id} item={item} onOpen={openOrder} productsMap={productsMap} familyMap={familyMap} />
                    ))}
                  </div>
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

        .admin-route-menu{
          z-index:1401;
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

        .admin-dispatcher-picker{ display:inline-flex; }

        .admin-order-timeline{ position:relative; display:grid; gap:26px; }
        .admin-order-timeline-day{ position:relative; display:grid; gap:14px; }
        .admin-order-timeline-day-header{ position:relative; display:grid; grid-template-columns:32px 1fr; align-items:center; column-gap:14px; }
        .admin-order-timeline-day-label{ grid-column:2; display:flex; align-items:center; font-size:12.5px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .admin-order-timeline-day-label strong{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .admin-order-timeline-day-sep{ margin:0 8px; opacity:.5; }
        .admin-order-timeline-day-marker{ display:none; }

        .admin-order-timeline-row{ position:relative; display:grid; grid-template-columns:32px 1fr; column-gap:14px; align-items:center; }
        .admin-order-marker{ position:relative; z-index:1; justify-self:center; width:24px; height:24px; border-radius:999px; display:grid; place-items:center; background:var(--marker-bg); color:var(--marker-color); border:2px solid #fff; box-shadow:0 0 0 1px rgba(29,29,31,.08); flex-shrink:0; }

        .admin-order-card{ border-radius:16px; border:1px solid rgba(29,29,31,.08); background:#fff; padding:20px 22px; cursor:pointer; box-shadow:0 12px 32px rgba(29,29,31,.06); transition:box-shadow .18s ease, transform .16s ease, border-color .16s ease, background .18s ease; }
        .admin-order-card:hover{ transform:translateY(-1px); box-shadow:0 16px 42px rgba(29,29,31,.09); border-color:rgba(0,113,227,.18); }
        .admin-order-card:active{ transform:translateY(0) scale(.996); box-shadow:0 8px 22px rgba(29,29,31,.07); background:rgba(255,255,255,.96); }
        .admin-order-card:focus-visible{ outline:2px solid rgba(0,113,227,.38); outline-offset:3px; }
        .admin-order-card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .admin-order-dealer{ font-size:15px; font-weight:760; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
        .admin-order-number{ font-size:12px; font-weight:600; color:var(--color-graphite, #707070); }
        .admin-order-amount{ font-size:15px; font-weight:760; color:var(--color-ink, #1d1d1f); white-space:nowrap; }
        .admin-order-meta{ margin-top:5px; font-size:12px; color:var(--color-graphite, #707070); }
        .admin-order-card-bottom{ margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .admin-order-state-copy{ display:flex; align-items:center; gap:7px; flex-shrink:0; }

        .admin-order-thumb{ width:46px; height:46px; border-radius:10px; overflow:hidden; background:var(--color-fog, #f5f5f7); display:grid; place-items:center; flex-shrink:0; border:1px solid rgba(29,29,31,.04); }
        .admin-order-thumb-more{ font-size:12px; font-weight:700; color:var(--color-graphite, #707070); }

        .admin-order-spinner{
          display:inline-block;
          border-radius:999px;
          background:
            radial-gradient(circle at 50% 9%, var(--spinner-color) 0 8%, transparent 9%),
            radial-gradient(circle at 78% 20%, color-mix(in srgb, var(--spinner-color) 88%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 91% 50%, color-mix(in srgb, var(--spinner-color) 76%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 78% 80%, color-mix(in srgb, var(--spinner-color) 64%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 50% 91%, color-mix(in srgb, var(--spinner-color) 52%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 22% 80%, color-mix(in srgb, var(--spinner-color) 40%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 9% 50%, color-mix(in srgb, var(--spinner-color) 30%, transparent) 0 7%, transparent 8%),
            radial-gradient(circle at 22% 20%, color-mix(in srgb, var(--spinner-color) 20%, transparent) 0 7%, transparent 8%);
          animation:adminOrderSpin .78s linear infinite;
          filter:drop-shadow(0 0 4px color-mix(in srgb, var(--spinner-color) 24%, transparent));
        }
        @keyframes adminOrderSpin{ to{ transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce){ .admin-order-spinner{ animation:none; } }
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
          .admin-order-card{ padding:16px; }
          .admin-order-card-top{ align-items:flex-start; }
          .admin-order-thumb{ width:42px; height:42px; }
        }

        @media (max-width:560px){
          .admin-order-timeline-row,
          .admin-order-timeline-day-header{
            grid-template-columns:24px 1fr;
            column-gap:10px;
          }
          .admin-order-marker{ width:22px; height:22px; }
          .admin-order-card-top{ flex-direction:column; }
          .admin-order-card-bottom{ align-items:flex-start; }
          .admin-order-state-copy{ width:100%; justify-content:flex-start; }
        }
      `}</style>
    </div>
  );
}
