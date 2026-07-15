import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useDeleteAdminDealerMutation,
  useGetAdminDealerAnalyticsQuery,
  useGetAdminDealerQuery,
  useGetAdminOrdersQuery,
  useGetAdminSalesQuery,
  useGetAdminScopedOrdersQuery,
  useGetVerifiedDispatchersQuery,
  useLazyGetAdminScopedOrderQuery,
  useResendDealerSetupEmailMutation,
  useUpdateAdminDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useUpdateAdminDealerStatusMutation,
} from "../../../redux/api/meituApi.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  MetricTile,
  Pill,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";

// Credit limits/terms were removed entirely (2026) - dealer payments are
// reconciled manually outside this system, so there is no "credit status"
// or "outstanding balance" concept left to show here. Don't reintroduce a
// credit UI without a real ledger backing it.

const ROUTING_MODES = [
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER", label: "Dispatcher" },
];

const TAB_OPTIONS = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Orders" },
  { key: "history", label: "History" },
  { key: "sales", label: "Sales" },
  { key: "notes", label: "Notes" },
];

const HISTORY_DAYS_PAGE_SIZE = 6;

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatWeekday(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatFilterDate(value) {
  if (!value) return "";
  // Interpreted as a plain calendar date (no time zone shift) since it's
  // always a "YYYY-MM-DD" key.
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateRangeLabel(from, to) {
  if (!from && !to) return "All time";
  if (from && to) return `${formatFilterDate(from)} – ${formatFilterDate(to)}`;
  if (from) return `From ${formatFilterDate(from)}`;
  return `Through ${formatFilterDate(to)}`;
}

function startOfDayFromInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDayFromInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
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

// Orders and sales are two different collections with two different date
// fields (createdAt vs saleDate) - normalized here into one common "event"
// shape so both can be sorted and grouped by calendar day together.
function buildHistoryEvents(orders, sales) {
  const orderEvents = orders.map((order) => ({
    type: "order",
    key: `order-${order._id}`,
    date: new Date(order.createdAt),
    order,
  }));
  const saleEvents = sales.map((sale) => ({
    type: "sale",
    key: `sale-${sale._id}`,
    date: new Date(sale.saleDate),
    sale,
  }));
  return [...orderEvents, ...saleEvents]
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

function groupEventsByDay(events) {
  const map = new Map();
  for (const event of events) {
    const key = event.date.toDateString();
    let group = map.get(key);
    if (!group) {
      group = { key, date: event.date, events: [] };
      map.set(key, group);
    }
    group.events.push(event);
  }
  return Array.from(map.values());
}

// No dealer-number sequence exists in the data model - this is a stable,
// honest display transform of the real Mongo id, not a fabricated field.
function dealerDisplayId(dealer) {
  const id = String(dealer?._id || "");
  return id ? `DLR-${id.slice(-6).toUpperCase()}` : "—";
}

// There's no dedicated "route"/"territory" field on a dealer, only a
// free-text address - the first comma-separated segment (usually the city)
// stands in for it, same convention used on the dealer grid cards.
function dealerLocation(dealer) {
  const address = String(dealer?.address || "").trim();
  if (!address) return "No address on file";
  return address.split(",")[0].trim();
}

function getDealerFormValues(currentDealer = {}) {
  return {
    companyName: currentDealer.companyName || "",
    contactName: currentDealer.contactName || "",
    email: currentDealer.email || "",
    phone: currentDealer.phone || "",
    address: currentDealer.address || "",
    panVat: currentDealer.panVat || "",
  };
}

function getMutationErrorMessage(err, fallback = "Action failed.") {
  return (
    err?.data?.error ||
    err?.data?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function fieldInputStyle(disabled = false) {
  return {
    width: "100%",
    height: 38,
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: "0 12px",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
    opacity: disabled ? 0.55 : 1,
  };
}

function fieldTextareaStyle() {
  return {
    ...fieldInputStyle(),
    height: "auto",
    padding: 12,
    resize: "vertical",
  };
}

function ErrorBanner({ children }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function SuccessBanner({ children }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(22,163,74,.08)", color: "#15803d", fontSize: 13, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Surface key={index} padding={20}>
          <div style={{ height: 120, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ))}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="dealer-profile-info-tile">
      <div className="dealer-profile-info-label">{label}</div>
      <div className="dealer-profile-info-value">{value || "—"}</div>
    </div>
  );
}

function CompanyInfoRow({ icon, label, value }) {
  return (
    <div className="dealer-profile-row">
      <span className="dealer-profile-row-icon">
        <DashboardIcon name={icon} size={14} strokeWidth={1.8} />
      </span>
      <span className="dealer-profile-row-label">{label}</span>
      <span className="dealer-profile-row-value">{value || "—"}</span>
    </div>
  );
}

function TabBar({ options, value, onChange }) {
  return (
    <div className="dealer-profile-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dealer-profile-tab ${active ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MoreMenu({ open, onToggle, onClose, isVerified, canResendSetup, deletionPending, busy, onToggleStatus, onChangeRouting, onResendSetup, onScheduleDeletion }) {
  return (
    <div className="dealer-profile-more-wrap">
      <GhostButton icon="moreHorizontal" onClick={onToggle}>
        More
      </GhostButton>
      {open ? (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={onClose} />
          <div className="dealer-profile-more-menu dash-modal-surface-in">
            <button type="button" disabled={busy} onClick={onToggleStatus}>
              {isVerified ? "Suspend dealer" : "Activate dealer"}
            </button>
            <button type="button" onClick={onChangeRouting}>
              Change routing
            </button>
            {canResendSetup ? (
              <button type="button" disabled={busy} onClick={onResendSetup}>
                Resend setup link
              </button>
            ) : null}
            <div className="dealer-profile-more-divider" />
            <button type="button" className="danger" disabled={busy || deletionPending} onClick={onScheduleDeletion}>
              {deletionPending ? "Deletion pending" : "Schedule deletion"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RoutingModal({ open, dealer, dispatchers, saving, onClose, onSave }) {
  const initialDispatcherId = dealer?.dispatcherId?._id || dealer?.dispatcherId || "";
  const [fulfillmentMode, setFulfillmentMode] = useState(dealer?.fulfillmentMode || "FACTORY");
  const [dispatcherId, setDispatcherId] = useState(initialDispatcherId);

  if (!open || !dealer) return null;

  const canSave = fulfillmentMode === "FACTORY" || (fulfillmentMode === "DISPATCHER" && dispatcherId);
  const dispatcherOptions = dispatchers.map((dispatcher) => ({
    key: dispatcher._id,
    label: dispatcher.companyName ? `${dispatcher.name} · ${dispatcher.companyName}` : dispatcher.name,
  }));

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(520px, 100%)" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <SectionHeader
          eyebrow="Routing"
          icon="truck"
          title="Dealer Routing"
          subtitle={`Update fulfillment for ${dealer.companyName || "this dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          }
        />

        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
          <Field label="Fulfillment Mode">
            <SegmentedControl options={ROUTING_MODES} value={fulfillmentMode} onChange={setFulfillmentMode} />
          </Field>

          {fulfillmentMode === "DISPATCHER" ? (
            <Field label="Assigned Dispatcher">
              <AppleDropdown value={dispatcherId} options={dispatcherOptions} onChange={setDispatcherId} placeholder="Select dispatcher" />
              {dispatchers.length === 0 ? (
                <ErrorBanner>No verified dispatchers are currently available. Verify a dispatcher first.</ErrorBanner>
              ) : null}
            </Field>
          ) : null}
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            icon="checkmark"
            disabled={!canSave || saving}
            onClick={() =>
              onSave({
                fulfillmentMode,
                dispatcherId: fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
              })
            }
          >
            {saving ? "Saving…" : "Save Routing"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function EditDealerModal({ open, dealer, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => getDealerFormValues(dealer));

  useEffect(() => {
    if (open) setForm(getDealerFormValues(dealer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealer?._id]);

  if (!open || !dealer) return null;

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <SectionHeader
          eyebrow="Edit"
          icon="edit"
          title="Edit Dealer"
          subtitle={`Update contact and registration details for ${dealer.companyName || "this dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
          <Field label="Company Name">
            <input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} style={fieldInputStyle()} />
          </Field>
          <Field label="Contact Person">
            <input value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} style={fieldInputStyle()} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} style={fieldInputStyle()} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} style={fieldInputStyle()} />
          </Field>
          <Field label="Address">
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} style={fieldInputStyle()} />
          </Field>
          <Field label="PAN / VAT Number">
            <input value={form.panVat} onChange={(e) => updateField("panVat", e.target.value)} style={fieldInputStyle()} />
          </Field>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton icon="checkmark" onClick={() => onSave(form)} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function OrderActivityRow({ order, onOpen }) {
  const status = normalizeStatus(order.status);
  const meta = orderStatusMeta(status);
  const dotColor = { positive: "#15803d", accent: "var(--color-azure,#0071e3)", critical: "#b42318", caution: "var(--color-caution,#b64400)", neutral: "var(--color-graphite,#707070)" }[meta.tone] || "var(--color-graphite,#707070)";

  return (
    <button type="button" className="dealer-profile-activity-row" onClick={() => onOpen(order)}>
      <span className="dealer-profile-activity-dot" style={{ background: dotColor }} aria-hidden="true" />
      <span className="dealer-profile-activity-copy">
        <span className="dealer-profile-activity-title">
          Order {order.orderNumber || "—"} {meta.label.toLowerCase()}
        </span>
        <span className="dealer-profile-activity-time">{formatDateTime(order.updatedAt || order.createdAt)}</span>
      </span>
      <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

// Same portal-popover pattern as the Sales & Purchases date filter - this
// tab's cards sit inside a "dash-fade-up" surface, which permanently gains a
// stacking context once its entrance animation finishes, so a plain
// absolutely-positioned popover would paint underneath later DOM siblings
// regardless of z-index. Escaping to document.body sidesteps that entirely.
function HistoryDateFilter({ from, to, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [position, setPosition] = useState(null);
  const active = Boolean(from || to);
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 240;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const top = rect.bottom + 8;

    setPosition({ left, top, width });
  }, []);

  function closePopover() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPopover() {
    setDraftFrom(from);
    setDraftTo(to);
    updatePosition();
    setOpen(true);
  }

  function apply() {
    onApply({ from: draftFrom, to: draftTo });
    closePopover();
  }

  function clear() {
    setDraftFrom("");
    setDraftTo("");
    onClear();
    closePopover();
  }

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePopover();
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
  }, [open, updatePosition]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : openPopover())}
        aria-label="Filter by date range"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`dealer-profile-history-filter-btn ${active ? "is-active" : ""}`}
      >
        <DashboardIcon name="filter" size={15} strokeWidth={1.9} />
        {active ? <span className="dealer-profile-history-filter-dot" aria-hidden="true" /> : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={closePopover} />
              <div
                className="dealer-profile-history-filter-pop"
                role="dialog"
                aria-label="Filter by date range"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="dealer-profile-history-filter-pop-title">
                  <DashboardIcon name="calendar" size={13} strokeWidth={1.9} />
                  Filter by date range
                </div>

                <label className="dealer-profile-history-filter-field">
                  <span>From</span>
                  <AppleDateField value={draftFrom || ""} onChange={setDraftFrom} />
                </label>

                <label className="dealer-profile-history-filter-field">
                  <span>To</span>
                  <AppleDateField value={draftTo || ""} onChange={setDraftTo} />
                </label>

                <div className="dealer-profile-history-filter-pop-actions">
                  <GhostButton onClick={clear}>Clear</GhostButton>
                  <PrimaryButton
                    onClick={apply}
                    disabled={!draftFrom && !draftTo}
                    style={{ height: 34, padding: "0 14px", fontSize: 12.5 }}
                  >
                    Apply
                  </PrimaryButton>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function HistoryPagination({ page, totalPages, totalCount, pageSize, onChange }) {
  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pages = buildPageList(page, totalPages);

  return (
    <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Showing {start} to {end} of {totalCount} days
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="dealer-profile-history-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`dealer-profile-history-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="dealer-profile-history-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function HistoryOrderCard({ order, onOpen }) {
  const status = normalizeStatus(order.status);
  const meta = orderStatusMeta(status);

  return (
    <button
      type="button"
      className="dealer-profile-history-card dealer-profile-history-card--order"
      onClick={() => onOpen(order)}
    >
      <span className="dealer-profile-history-card-icon">
        <DashboardIcon name="orders" size={16} strokeWidth={1.8} />
      </span>
      <div className="dealer-profile-history-card-main">
        <div className="dealer-profile-history-card-title">
          <span className="dealer-profile-history-card-kind">Order</span>
          {order.orderNumber || "Unnamed Order"}
        </div>
        <div className="dealer-profile-history-card-sub">
          {formatTime(order.createdAt)} · {Array.isArray(order.items) ? `${order.items.length} items` : meta.label}
        </div>
      </div>
      <Pill tone={meta.tone} size="small">{meta.label}</Pill>
      <span className="dealer-profile-history-card-amount">{money(order?.totals?.total, order?.totals?.currency)}</span>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

function HistorySaleCard({ sale, onOpen }) {
  const voided = sale.status === "VOIDED";

  return (
    <button
      type="button"
      className={`dealer-profile-history-card dealer-profile-history-card--sale ${voided ? "is-voided" : ""}`}
      onClick={() => onOpen(sale)}
    >
      <span className="dealer-profile-history-card-icon">
        <DashboardIcon name={voided ? "reject" : "checkSquare"} size={16} strokeWidth={1.8} />
      </span>
      <div className="dealer-profile-history-card-main">
        <div className="dealer-profile-history-card-title">
          <span className="dealer-profile-history-card-kind">Sale</span>
          {sale.saleNumber || "Sale"}
        </div>
        <div className="dealer-profile-history-card-sub">
          {formatTime(sale.saleDate)}{sale.billId ? ` · Bill ${sale.billId}` : ""}
        </div>
      </div>
      <Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>
      <span className="dealer-profile-history-card-amount">{money(sale?.totals?.total)}</span>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

function HistoryDayGroup({ group, onOpenOrder, onOpenSale }) {
  return (
    <div className="dealer-profile-history-day">
      <div className="dealer-profile-history-day-header">
        <span className="dealer-profile-history-day-marker" aria-hidden="true" />
        <div>
          <div className="dealer-profile-history-day-date">{formatDayLabel(group.date)}</div>
          <div className="dealer-profile-history-day-weekday">{formatWeekday(group.date)}</div>
        </div>
      </div>
      <div className="dealer-profile-history-day-body">
        {group.events.map((event) =>
          event.type === "order" ? (
            <HistoryOrderCard key={event.key} order={event.order} onOpen={onOpenOrder} />
          ) : (
            <HistorySaleCard key={event.key} sale={event.sale} onOpen={onOpenSale} />
          ),
        )}
      </div>
    </div>
  );
}

function OrderPreviewModal({ order, dealer, loading, onClose, onViewFull }) {
  if (!order) return null;

  const status = normalizeStatus(order.status);
  const meta = orderStatusMeta(status);
  const resolvedItems = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.snapshot?.items)
      ? order.snapshot.items
      : [];

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)", maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader eyebrow="Order" icon="orders" title={order.orderNumber || "Order"} subtitle={dealer?.companyName || ""} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <DashboardIcon name="close" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={meta.tone} size="small">{meta.label}</Pill>
          <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDateTime(order.createdAt)}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading && resolvedItems.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>Loading order items…</div>
          ) : resolvedItems.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>No items found.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resolvedItems.map((item, index) => (
                <div key={`${item.sku || item.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
                  <span>{item.name} × {item.quantity}</span>
                  <span style={{ fontWeight: 700 }}>{money(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{money(order?.totals?.total, order?.totals?.currency)}</span>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <GhostButton icon="chevron" onClick={onViewFull}>View Full Order</GhostButton>
        </div>
      </Surface>
    </div>
  );
}

function SalePreviewModal({ sale, onClose }) {
  if (!sale) return null;

  const voided = sale.status === "VOIDED";

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(520px, 100%)", maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader eyebrow="Sale" icon="checkSquare" title={sale.saleNumber || "Sale"} subtitle={sale.billId ? `Bill ${sale.billId}` : ""} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <DashboardIcon name="close" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>
          <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDateTime(sale.saleDate)}</span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
          {(sale.items || []).map((item, index) => (
            <div key={`${item.productId || item.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
              <span>{item.name} × {item.quantity}</span>
              <span style={{ fontWeight: 700 }}>{money(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{money(sale?.totals?.total)}</span>
        </div>

        {voided && sale.voidReason ? (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#b42318" }}>Voided: {sale.voidReason}</div>
        ) : null}
        {sale.notes ? (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{sale.notes}</div>
        ) : null}
      </Surface>
    </div>
  );
}

export default function AdminDealerProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dealers\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDealerId, setNotesDealerId] = useState("");
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewOrderLoading, setPreviewOrderLoading] = useState(false);
  const [previewSale, setPreviewSale] = useState(null);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const analyticsQuery = useGetAdminDealerAnalyticsQuery(dealerId, { skip: !dealerId });
  const ordersQuery = useGetAdminOrdersQuery({ dealerId, limit: 8 }, { skip: !dealerId });
  const isHistoryTab = activeTab === "history";
  // The underlying "/api/orders" (and "/api/admin/orders") listing defaults
  // to SUBMITTED-only unless `archive: true` is passed, and it never
  // scopes by dealerId server-side - so the full per-dealer order history
  // needs both branches fetched and then filtered/deduped client-side
  // (same defensive dealerId filter already used on the dedicated Order
  // History page for this dealer).
  const historySubmittedOrdersQuery = useGetAdminScopedOrdersQuery({ dealerId, limit: 100 }, { skip: !dealerId || !isHistoryTab });
  const historyArchivedOrdersQuery = useGetAdminScopedOrdersQuery({ dealerId, archive: true, limit: 100 }, { skip: !dealerId || !isHistoryTab });
  const historySalesQuery = useGetAdminSalesQuery({ dealerId, limit: 200 }, { skip: !dealerId || !isHistoryTab });
  const [fetchOrderDetail] = useLazyGetAdminScopedOrderQuery();
  const [updateDealer] = useUpdateAdminDealerMutation();
  const [deleteAdminDealer] = useDeleteAdminDealerMutation();
  const [updateDealerStatus] = useUpdateAdminDealerStatusMutation();
  const [updateDealerRouting] = useUpdateAdminDealerRoutingMutation();
  const [resendDealerSetupEmail] = useResendDealerSetupEmailMutation();

  const dealer = dealerQuery.data?.item || null;
  const dispatchers = dispatchersQuery.data?.items || [];
  const analytics = analyticsQuery.data || null;
  const recentOrders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const loading = !dealer && (dealerQuery.isLoading || dispatchersQuery.isLoading || analyticsQuery.isLoading);
  const loadError = dealerQuery.error?.message || dispatchersQuery.error?.message || analyticsQuery.error?.message || "";

  const historyOrders = useMemo(() => {
    const combined = [...(historySubmittedOrdersQuery.data?.items || []), ...(historyArchivedOrdersQuery.data?.items || [])];
    const seen = new Set();
    const scoped = [];
    for (const order of combined) {
      const id = String(order._id);
      if (seen.has(id)) continue;
      seen.add(id);
      const directDealerId = String(order?.dealerId?._id || order?.dealerId || "");
      const snapshotDealerId = String(order?.dealerSnapshot?._id || "");
      if (directDealerId === dealerId || snapshotDealerId === dealerId) scoped.push(order);
    }
    return scoped;
  }, [historySubmittedOrdersQuery.data, historyArchivedOrdersQuery.data, dealerId]);
  const historySales = useMemo(() => historySalesQuery.data?.items || [], [historySalesQuery.data]);
  const historyEvents = useMemo(() => buildHistoryEvents(historyOrders, historySales), [historyOrders, historySales]);
  const hasHistoryDateFilter = Boolean(historyFrom || historyTo);
  const historyDateLabel = dateRangeLabel(historyFrom, historyTo);
  const historyFilteredEvents = useMemo(() => {
    if (!historyFrom && !historyTo) return historyEvents;
    const startBound = startOfDayFromInput(historyFrom);
    const endBound = endOfDayFromInput(historyTo);
    return historyEvents.filter((event) => {
      if (startBound && event.date < startBound) return false;
      if (endBound && event.date > endBound) return false;
      return true;
    });
  }, [historyEvents, historyFrom, historyTo]);
  const historyDayGroups = useMemo(() => groupEventsByDay(historyFilteredEvents), [historyFilteredEvents]);
  const historyLoading =
    isHistoryTab &&
    historyEvents.length === 0 &&
    (historySubmittedOrdersQuery.isLoading || historyArchivedOrdersQuery.isLoading || historySalesQuery.isLoading);
  const historyTotalPages = Math.max(1, Math.ceil(historyDayGroups.length / HISTORY_DAYS_PAGE_SIZE));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const visibleHistoryGroups = historyDayGroups.slice(
    (historyCurrentPage - 1) * HISTORY_DAYS_PAGE_SIZE,
    historyCurrentPage * HISTORY_DAYS_PAGE_SIZE,
  );

  useEffect(() => {
    if (!dealer?._id || notesDealerId === dealer._id) return;
    setNotes(dealer.notes || "");
    setNotesDealerId(dealer._id);
  }, [dealer, notesDealerId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [dealerId, historyFrom, historyTo]);

  function openHistoryOrderPreview(order) {
    setPreviewOrder(order);
    setPreviewOrderLoading(true);
    fetchOrderDetail(order._id, true)
      .unwrap()
      .then((full) => setPreviewOrder(full || order))
      .catch(() => {})
      .finally(() => setPreviewOrderLoading(false));
  }

  function closeHistoryOrderPreview() {
    setPreviewOrder(null);
    setPreviewOrderLoading(false);
  }

  const performanceSummary = analytics?.performanceSummary || {};
  const productIntelligence = analytics?.productIntelligence || {};
  const accessState = dealer?.accessState || {};
  const isVerified = dealer?.status === "VERIFIED";
  const assignedDispatcher = dealer?.dispatcherId && typeof dealer.dispatcherId === "object" ? dealer.dispatcherId : null;

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setError("");
      setSuccess("");
      await request();
      return true;
    } catch (err) {
      setError(getMutationErrorMessage(err));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveProfile(form) {
    if (!dealer?._id) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateDealer({
        dealerId: dealer._id,
        payload: {
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          panVat: form.panVat.trim(),
        },
      }).unwrap();

      setEditOpen(false);
      setSuccess("Dealer profile updated.");
    } catch (err) {
      setError(getMutationErrorMessage(err, "Failed to update dealer profile."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!dealer?._id) return;
    const ok = await runAction(`notes-${dealer._id}`, () =>
      updateDealer({ dealerId: dealer._id, payload: { notes: notes.trim() } }).unwrap(),
    );
    if (ok) setSuccess("Notes updated.");
  }

  async function handleToggleStatus() {
    if (!dealer?._id) return;
    const nextStatus = dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED";

    const ok = await runAction(`status-${dealer._id}`, () =>
      updateDealerStatus({ dealerId: dealer._id, status: nextStatus }).unwrap(),
    );

    if (ok) {
      setSuccess(`Dealer status updated to ${nextStatus}.`);
      setStatusConfirmOpen(false);
      setStatusConfirmation("");
    }
  }

  async function handleDeleteDealer() {
    if (!dealer?._id) return;

    const ok = await runAction(`delete-${dealer._id}`, () =>
      deleteAdminDealer({
        dealerId: dealer._id,
        payload: { confirmation: deleteConfirmation, reason: "Admin scheduled dealer deletion from dealer profile" },
      }).unwrap(),
    );

    if (ok) {
      setDeleteConfirmOpen(false);
      setDeleteConfirmation("");
      navigate("/admin/dashboard/dealers");
    }
  }

  async function handleSaveRouting({ fulfillmentMode, dispatcherId }) {
    if (!dealer?._id) return;

    const ok = await runAction(`routing-${dealer._id}`, () =>
      updateDealerRouting({ dealerId: dealer._id, payload: { fulfillmentMode, dispatcherId } }).unwrap(),
    );

    if (ok) {
      setRoutingOpen(false);
      setSuccess("Dealer routing updated.");
    }
  }

  function handleResendSetup() {
    const userId = accessState.userId;
    if (!userId || !dealer?._id) return;

    runAction(`setup-${dealer._id}`, () => resendDealerSetupEmail(userId).unwrap()).then((ok) => {
      if (ok) setSuccess("A fresh password setup link has been sent.");
    });
  }

  function openOrder(order) {
    navigate(`/admin/dashboard/orders/${order._id}`, { state: { fromOrdersList: true } });
  }

  if (loading) return <LoadingState />;

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <EmptyState icon="store" title="Dealer not found" subtitle="This dealer profile could not be located in the admin register." />
        <div>
          <GhostButton onClick={() => navigate("/admin/dashboard/dealers")}>Back to Dealer Register</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <div className="dealer-profile-breadcrumb">
        <button type="button" className="dealer-profile-back-btn" onClick={() => navigate("/admin/dashboard/dealers")} aria-label="Back to dealers">
          <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" className="dealer-profile-crumb-link" onClick={() => navigate("/admin/dashboard/dealers")}>
          Dealers
        </button>
        <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
        <span className="dealer-profile-crumb-current">Dealer Profile</span>
        <div style={{ flex: 1 }} />
        <GhostButton icon="edit" onClick={() => setEditOpen(true)}>
          Edit Dealer
        </GhostButton>
        <MoreMenu
          open={moreOpen}
          onToggle={() => setMoreOpen((v) => !v)}
          onClose={() => setMoreOpen(false)}
          isVerified={isVerified}
          canResendSetup={accessState.canResendSetup}
          deletionPending={Boolean(dealer.deletion?.pending)}
          busy={Boolean(busyAction)}
          onToggleStatus={() => {
            setMoreOpen(false);
            setStatusConfirmation("");
            setStatusConfirmOpen(true);
          }}
          onChangeRouting={() => {
            setMoreOpen(false);
            setRoutingOpen(true);
          }}
          onResendSetup={() => {
            setMoreOpen(false);
            handleResendSetup();
          }}
          onScheduleDeletion={() => {
            setMoreOpen(false);
            setDeleteConfirmation("");
            setDeleteConfirmOpen(true);
          }}
        />
      </div>

      <Surface padding={24} className="dash-fade-up">
        <div className="dealer-profile-summary">
          <Avatar label={dealer.companyName || dealer.contactName || "D"} size={56} />
          <div className="dealer-profile-summary-copy">
            <div className="dealer-profile-name">{dealer.companyName || "Dealer Profile"}</div>
            <div className="dealer-profile-status">
              <span className="dealer-profile-status-dot" style={{ background: isVerified ? "#15803d" : "#b42318" }} aria-hidden="true" />
              {isVerified ? "Active Dealer" : dealer.status === "SUSPENDED" ? "Suspended Dealer" : dealer.status || "Unknown"}
            </div>
          </div>

          <div className="dealer-profile-info-tiles">
            <InfoTile label="Dealer ID" value={dealerDisplayId(dealer)} />
            <InfoTile label="Route" value={dealerLocation(dealer)} />
            <InfoTile label="Joined On" value={formatDate(dealer.createdAt)} />
          </div>
        </div>
      </Surface>

      {error || loadError ? <ErrorBanner>{error || loadError}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}

      <TabBar
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={(key) => {
          if (key === "sales") {
            navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases`);
            return;
          }
          setActiveTab(key);
        }}
      />

      {activeTab === "overview" ? (
        <div className="dealer-profile-overview-grid">
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="user" title="Company Information" />
              <div style={{ marginTop: 12 }}>
                <CompanyInfoRow icon="store" label="Company Name" value={dealer.companyName} />
                <CompanyInfoRow icon="user" label="Contact Person" value={dealer.contactName} />
                <CompanyInfoRow icon="headset" label="Phone" value={dealer.phone} />
                <CompanyInfoRow icon="inbox" label="Email" value={dealer.email} />
                <CompanyInfoRow icon="invoice" label="PAN/VAT Number" value={dealer.panVat} />
                <CompanyInfoRow icon="pin" label="Address" value={dealer.address} />
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="truck" title="Assigned Dispatcher" />
              {assignedDispatcher ? (
                <div className="dealer-profile-dispatcher">
                  <Avatar label={assignedDispatcher.name || "D"} size={44} tone="accent" />
                  <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{assignedDispatcher.name || "Dispatcher"}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Dispatcher</div>
                    <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
                      {assignedDispatcher.phone ? <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{assignedDispatcher.phone}</div> : null}
                      {assignedDispatcher.email ? <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{assignedDispatcher.email}</div> : null}
                    </div>
                  </div>
                  <GhostButton icon="user" onClick={() => navigate(`/admin/dashboard/dispatchers/${assignedDispatcher._id}`)}>
                    View Profile
                  </GhostButton>
                </div>
              ) : (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-graphite,#707070)", maxWidth: 380 }}>
                    This dealer is fulfilled directly by the factory - no dispatcher is assigned.
                  </div>
                  <GhostButton icon="truck" onClick={() => setRoutingOpen(true)}>
                    Assign Dispatcher
                  </GhostButton>
                </div>
              )}
            </Surface>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="chart" title="Performance Summary" action={<Pill tone="neutral" size="small">Lifetime</Pill>} />
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetricTile label="Total Orders" value={performanceSummary.totalApprovedOrders || 0} icon="orders" />
                <MetricTile label="Total Units Sold" value={Number(productIntelligence.totalUnitsOrdered || 0).toLocaleString()} icon="package" />
                <MetricTile label="Total Sales" value={money(performanceSummary.totalSalesApproved)} icon="chart" tone="accent" />
                <MetricTile label="Avg. Order Value" value={money(performanceSummary.averageApprovedOrderValue)} icon="invoice" tone="accent" />
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader
                icon="history"
                title="Recent Activity"
                action={
                  <GhostButton onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}/orders`)}>
                    View All
                  </GhostButton>
                }
              />
              <div style={{ marginTop: 10 }}>
                {ordersQuery.isLoading ? (
                  <div style={{ height: 120, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
                ) : recentOrders.length === 0 ? (
                  <div style={{ padding: "14px 4px", fontSize: 12.5, color: "var(--color-graphite,#707070)" }}>No orders yet.</div>
                ) : (
                  recentOrders.slice(0, 5).map((order) => <OrderActivityRow key={order._id} order={order} onOpen={openOrder} />)
                )}
              </div>
            </Surface>
          </div>
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader
            icon="orders"
            title="Orders"
            subtitle="Most recent orders from this dealer."
            action={
              <GhostButton onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}/orders`)}>
                Full Order History
              </GhostButton>
            }
          />
          <div style={{ marginTop: 12 }}>
            {ordersQuery.isLoading ? (
              <div style={{ height: 160, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
            ) : recentOrders.length === 0 ? (
              <EmptyState icon="orders" title="No orders yet" subtitle="Orders placed by this dealer will show up here." />
            ) : (
              recentOrders.map((order) => <OrderActivityRow key={order._id} order={order} onOpen={openOrder} />)
            )}
          </div>
        </Surface>
      ) : null}

      {activeTab === "history" ? (
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader
            icon="history"
            title="History"
            subtitle={hasHistoryDateFilter ? "Every order and sale in" : "Every order and sale from this dealer, combined into one timeline."}
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {hasHistoryDateFilter ? <Pill tone="accent" size="small">{historyDateLabel}</Pill> : null}
                <HistoryDateFilter
                  from={historyFrom}
                  to={historyTo}
                  onApply={({ from, to }) => {
                    setHistoryFrom(from);
                    setHistoryTo(to);
                  }}
                  onClear={() => {
                    setHistoryFrom("");
                    setHistoryTo("");
                  }}
                />
              </div>
            }
          />
          <div style={{ marginTop: 14 }}>
            {historyLoading ? (
              <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
            ) : historyDayGroups.length === 0 ? (
              <EmptyState
                icon="history"
                title={hasHistoryDateFilter ? "No activity in this range" : "No activity yet"}
                subtitle={
                  hasHistoryDateFilter
                    ? `No orders or sales were found for ${historyDateLabel}.`
                    : "Orders and sales from this dealer will appear here, grouped by day."
                }
              />
            ) : (
              <>
                <div className="dealer-profile-history-timeline">
                  {visibleHistoryGroups.map((group) => (
                    <HistoryDayGroup key={group.key} group={group} onOpenOrder={openHistoryOrderPreview} onOpenSale={setPreviewSale} />
                  ))}
                </div>
                <HistoryPagination
                  page={historyCurrentPage}
                  totalPages={historyTotalPages}
                  totalCount={historyDayGroups.length}
                  pageSize={HISTORY_DAYS_PAGE_SIZE}
                  onChange={setHistoryPage}
                />
              </>
            )}
          </div>
        </Surface>
      ) : null}

      {activeTab === "notes" ? (
        <Surface padding={22} className="dash-fade-up" style={{ maxWidth: 720 }}>
          <SectionHeader icon="edit" title="Notes" subtitle="Internal notes about this dealer - not visible to the dealer." />
          <div style={{ marginTop: 16 }}>
            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this dealer…"
              style={fieldTextareaStyle()}
            />
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton icon="checkmark" onClick={handleSaveNotes} disabled={busyAction === `notes-${dealer._id}`}>
              {busyAction === `notes-${dealer._id}` ? "Saving…" : "Save Notes"}
            </PrimaryButton>
          </div>
        </Surface>
      ) : null}

      <OrderPreviewModal
        order={previewOrder}
        dealer={dealer}
        loading={previewOrderLoading}
        onClose={closeHistoryOrderPreview}
        onViewFull={() => {
          if (previewOrder) openOrder(previewOrder);
        }}
      />

      <SalePreviewModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      <RoutingModal
        open={routingOpen}
        dealer={dealer}
        dispatchers={dispatchers}
        saving={busyAction === `routing-${dealer._id}`}
        onClose={() => {
          if (!busyAction) setRoutingOpen(false);
        }}
        onSave={handleSaveRouting}
      />

      <EditDealerModal
        open={editOpen}
        dealer={dealer}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveProfile}
      />

      <AdminDecisionModal
        open={statusConfirmOpen}
        title={dealer.status === "VERIFIED" ? "Suspend dealer access?" : "Activate dealer access?"}
        subtitle={
          dealer.status === "VERIFIED"
            ? "This suspends the dealer account, blocks new activity, and revokes active sessions for linked users."
            : "This restores linked dealer access and allows the dealer to use their portal again."
        }
        tone={dealer.status === "VERIFIED" ? "danger" : "default"}
        confirmLabel={dealer.status === "VERIFIED" ? "Suspend Dealer" : "Activate Dealer"}
        busy={busyAction === `status-${dealer._id}`}
        details={[
          { label: "Dealer", value: dealer.companyName || dealer.contactName || dealer.email || "Dealer" },
          { label: "Current status", value: dealer.status || "—" },
          { label: "New status", value: dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED" },
        ]}
        requireText={dealer.status === "VERIFIED" ? dealer.companyName || dealer.contactName || dealer.email || String(dealer._id) : ""}
        confirmationText={statusConfirmation}
        onConfirmationTextChange={setStatusConfirmation}
        onClose={() => {
          if (busyAction === `status-${dealer._id}`) return;
          setStatusConfirmOpen(false);
          setStatusConfirmation("");
        }}
        onConfirm={handleToggleStatus}
      />

      <AdminDecisionModal
        open={deleteConfirmOpen}
        title="Schedule dealer deletion?"
        subtitle="This revokes dealer access and moves the profile to Settings Trash for the undo window before permanent deletion."
        tone="danger"
        confirmLabel="Schedule Deletion"
        busy={busyAction === `delete-${dealer._id}`}
        details={[
          { label: "Dealer", value: dealer.companyName || dealer.contactName || dealer.email || "Dealer" },
          { label: "Contact", value: dealer.contactName || dealer.email || "—" },
          { label: "Undo Window", value: "30 days in Settings Trash" },
        ]}
        requireText={dealer.companyName || dealer.contactName || dealer.email || String(dealer._id)}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (busyAction === `delete-${dealer._id}`) return;
          setDeleteConfirmOpen(false);
          setDeleteConfirmation("");
        }}
        onConfirm={handleDeleteDealer}
      />

      <style>{`
        .dealer-profile-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-profile-back-btn{
          width:32px;
          height:32px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:10px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dealer-profile-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-back-btn:active{
          transform:scale(.92);
        }
        .dealer-profile-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .dealer-profile-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-more-wrap{
          position:relative;
        }
        .dealer-profile-more-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:190px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .dealer-profile-more-menu button{
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
        .dealer-profile-more-menu button:hover:not(:disabled){
          background:rgba(0,113,227,.08);
        }
        .dealer-profile-more-menu button:disabled{
          opacity:.5;
          cursor:not-allowed;
        }
        .dealer-profile-more-menu button.danger{
          color:#b42318;
        }
        .dealer-profile-more-menu button.danger:hover:not(:disabled){
          background:rgba(180,35,24,.08);
        }
        .dealer-profile-more-divider{
          height:1px;
          margin:4px 2px;
          background:rgba(0,0,0,.06);
        }
        .dealer-profile-summary{
          display:flex;
          align-items:center;
          gap:18px;
          flex-wrap:wrap;
        }
        .dealer-profile-summary-copy{
          min-width:0;
          flex:0 1 auto;
        }
        .dealer-profile-name{
          font-size:21px;
          font-weight:700;
          letter-spacing:-.02em;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-status{
          margin-top:5px;
          display:inline-flex;
          align-items:center;
          gap:7px;
          font-size:13px;
          font-weight:650;
          color:#15803d;
        }
        .dealer-profile-status-dot{
          width:7px;
          height:7px;
          border-radius:999px;
          flex:0 0 auto;
        }
        .dealer-profile-info-tiles{
          margin-left:auto;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-profile-info-tile{
          min-width:126px;
          padding:10px 14px;
          border-radius:14px;
          background:var(--color-fog,#f5f5f7);
        }
        .dealer-profile-info-label{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-info-value{
          margin-top:3px;
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-tabs{
          display:flex;
          align-items:center;
          gap:22px;
          border-bottom:1px solid rgba(29,29,31,.08);
          overflow-x:auto;
          scrollbar-width:none;
        }
        .dealer-profile-tabs::-webkit-scrollbar{
          display:none;
        }
        .dealer-profile-tab{
          flex:0 0 auto;
          padding:12px 2px 13px;
          border:none;
          background:transparent;
          border-bottom:2px solid transparent;
          margin-bottom:-1px;
          font-size:13.5px;
          font-weight:650;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          white-space:nowrap;
        }
        .dealer-profile-tab.is-active{
          color:var(--color-ink,#1d1d1f);
          font-weight:700;
          border-bottom-color:#dc2626;
        }
        .dealer-profile-overview-grid{
          display:grid;
          grid-template-columns:1.1fr 1fr;
          gap:16px;
          align-items:start;
        }
        .dealer-profile-row{
          display:flex;
          align-items:center;
          gap:10px;
          padding:11px 0;
          border-top:1px solid rgba(0,0,0,.06);
        }
        .dealer-profile-row:first-child{
          border-top:none;
        }
        .dealer-profile-row-icon{
          width:26px;
          height:26px;
          flex:0 0 auto;
          border-radius:8px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-row-label{
          flex:0 0 160px;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-row-value{
          flex:1 1 auto;
          min-width:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-ink,#1d1d1f);
          overflow-wrap:anywhere;
        }
        .dealer-profile-dispatcher{
          margin-top:14px;
          display:flex;
          align-items:center;
          gap:14px;
          flex-wrap:wrap;
        }
        .dealer-profile-activity-row{
          width:100%;
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 4px;
          border-top:1px solid rgba(0,0,0,.06);
          border-left:0;
          border-right:0;
          border-bottom:0;
          background:transparent;
          cursor:pointer;
          text-align:left;
          transition:background .14s ease;
        }
        .dealer-profile-activity-row:first-child{
          border-top:none;
        }
        .dealer-profile-activity-row:hover{
          background:rgba(0,113,227,.05);
          border-radius:10px;
        }
        .dealer-profile-activity-dot{
          width:7px;
          height:7px;
          border-radius:999px;
          flex:0 0 auto;
        }
        .dealer-profile-activity-copy{
          min-width:0;
          flex:1 1 auto;
          display:grid;
          gap:2px;
        }
        .dealer-profile-activity-title{
          font-size:13px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          text-transform:capitalize;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dealer-profile-activity-time{
          font-size:11.5px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-history-timeline{
          position:relative;
          display:grid;
          gap:22px;
        }
        .dealer-profile-history-timeline::before{
          content:"";
          position:absolute;
          left:6px;
          top:4px;
          bottom:4px;
          width:2px;
          background:linear-gradient(180deg, rgba(0,113,227,.22), rgba(29,29,31,.08));
        }
        .dealer-profile-history-day{
          position:relative;
          display:grid;
          gap:10px;
        }
        .dealer-profile-history-day-header{
          position:relative;
          display:flex;
          align-items:center;
          gap:14px;
        }
        .dealer-profile-history-day-marker{
          position:relative;
          z-index:1;
          width:13px;
          height:13px;
          border-radius:999px;
          background:#fff;
          border:2px solid rgba(0,113,227,.8);
          flex-shrink:0;
          box-shadow:0 0 0 4px #fff;
        }
        .dealer-profile-history-day-date{
          font-size:13.5px;
          font-weight:750;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-history-day-weekday{
          margin-top:1px;
          font-size:11.5px;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-history-day-body{
          margin-left:27px;
          display:grid;
          gap:8px;
        }
        .dealer-profile-history-card{
          display:flex;
          align-items:center;
          gap:12px;
          width:100%;
          padding:11px 14px;
          border-radius:14px;
          border:1px solid rgba(29,29,31,.07);
          border-left-width:3px;
          background:#fff;
          cursor:pointer;
          text-align:left;
          transition:box-shadow .16s var(--ease-out, ease), border-color .16s ease, transform .16s var(--ease-out, ease);
        }
        .dealer-profile-history-card:hover{
          box-shadow:0 10px 24px rgba(15,23,42,.06);
          transform:translateY(-1px);
        }
        .dealer-profile-history-card:active{
          transform:scale(.99);
        }
        .dealer-profile-history-card-icon{
          width:32px;
          height:32px;
          border-radius:10px;
          flex-shrink:0;
          display:grid;
          place-items:center;
        }
        .dealer-profile-history-card--order{
          border-left-color:var(--color-azure,#0071e3);
        }
        .dealer-profile-history-card--order .dealer-profile-history-card-icon{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .dealer-profile-history-card--sale{
          border-left-color:#15803d;
        }
        .dealer-profile-history-card--sale .dealer-profile-history-card-icon{
          background:rgba(22,163,74,.1);
          color:#15803d;
        }
        .dealer-profile-history-card--sale.is-voided{
          border-left-color:#b42318;
        }
        .dealer-profile-history-card--sale.is-voided .dealer-profile-history-card-icon{
          background:rgba(180,35,24,.1);
          color:#b42318;
        }
        .dealer-profile-history-card-main{
          min-width:0;
          flex:1 1 auto;
        }
        .dealer-profile-history-card-title{
          display:flex;
          align-items:center;
          gap:7px;
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dealer-profile-history-card-kind{
          flex-shrink:0;
          font-size:9.5px;
          font-weight:800;
          letter-spacing:.05em;
          text-transform:uppercase;
          padding:2px 6px;
          border-radius:999px;
        }
        .dealer-profile-history-card--order .dealer-profile-history-card-kind{
          background:rgba(0,113,227,.12);
          color:var(--color-azure,#0071e3);
        }
        .dealer-profile-history-card--sale .dealer-profile-history-card-kind{
          background:rgba(22,163,74,.12);
          color:#15803d;
        }
        .dealer-profile-history-card--sale.is-voided .dealer-profile-history-card-kind{
          background:rgba(180,35,24,.12);
          color:#b42318;
        }
        .dealer-profile-history-card-sub{
          margin-top:2px;
          font-size:11.5px;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-history-card-amount{
          flex-shrink:0;
          min-width:90px;
          text-align:right;
          font-size:13px;
          font-weight:750;
          color:var(--color-ink,#1d1d1f);
        }
        @media (max-width:640px){
          .dealer-profile-history-card{
            flex-wrap:wrap;
          }
          .dealer-profile-history-card-amount{
            order:5;
          }
        }
        .dealer-profile-history-filter-btn{
          position:relative;
          width:38px;
          height:38px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.1);
          background:rgba(255,255,255,.88);
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform .14s var(--ease-out, ease), background .14s ease, border-color .14s ease;
        }
        .dealer-profile-history-filter-btn:hover{
          background:rgba(29,29,31,.05);
        }
        .dealer-profile-history-filter-btn:active{
          transform:scale(.93);
        }
        .dealer-profile-history-filter-btn.is-active{
          border-color:rgba(0,113,227,.32);
          background:rgba(0,113,227,.08);
          color:var(--color-azure, #0071e3);
        }
        .dealer-profile-history-filter-dot{
          position:absolute;
          top:6px;
          right:6px;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--color-azure, #0071e3);
          border:1.5px solid #fff;
        }
        .dealer-profile-history-filter-pop{
          /* position/top/left/width are set inline (computed from the
             trigger's getBoundingClientRect via a portal) since this
             renders into document.body. */
          z-index:1401;
          padding:14px;
          border-radius:16px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top right;
          animation:dealerProfileHistoryFilterPopIn .15s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes dealerProfileHistoryFilterPopIn{
          from{ opacity:0; transform:scale(.96); }
          to{ opacity:1; transform:scale(1); }
        }
        @media (prefers-reduced-motion: reduce){
          .dealer-profile-history-filter-pop{ animation:none!important; }
          .dealer-profile-history-filter-btn{ transition:none!important; }
        }
        .dealer-profile-history-filter-pop-title{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          margin-bottom:10px;
        }
        .dealer-profile-history-filter-field{
          display:grid;
          gap:4px;
          margin-bottom:10px;
        }
        .dealer-profile-history-filter-field span{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .dealer-profile-history-filter-pop-actions{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:8px;
          margin-top:2px;
        }
        .dealer-profile-history-page-btn{
          min-width:32px;
          height:32px;
          padding:0 8px;
          border-radius:8px;
          border:none;
          background:transparent;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }
        .dealer-profile-history-page-btn:disabled{
          opacity:.35;
          cursor:not-allowed;
        }
        .dealer-profile-history-page-btn.is-active{
          background:var(--color-azure, #0071e3);
          color:#fff;
        }
        .dealer-profile-history-page-btn:not(.is-active):not(:disabled):hover{
          background:rgba(29,29,31,.06);
        }
        @media (max-width:980px){
          .dealer-profile-overview-grid{
            grid-template-columns:1fr;
          }
          .dealer-profile-info-tiles{
            margin-left:0;
          }
        }
        @media (max-width:640px){
          .dealer-profile-summary{
            flex-direction:column;
            align-items:flex-start;
          }
          .dealer-profile-info-tiles{
            width:100%;
          }
          .dealer-profile-info-tile{
            flex:1 1 auto;
          }
        }
      `}</style>
    </div>
  );
}
