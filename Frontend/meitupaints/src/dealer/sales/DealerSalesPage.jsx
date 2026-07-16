import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useGetDealerSalesQuery,
  useGetDealerInventoryQuery,
  useVoidDealerSaleMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  EmptyState,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../utils/scrollResultsToTop.js";
import { getPrimaryImage } from "../inventory/inventoryHelpers.js";
import { Toast } from "../../components/dashboard/Toast.jsx";
import NewSaleModal from "./NewSaleModal.jsx";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All sales" },
  { key: "COMPLETED", label: "Completed" },
  { key: "VOIDED", label: "Voided" },
];

const RANGE_PRESETS = [
  { key: "THIS_MONTH", label: "This month" },
  { key: "LAST_MONTH", label: "Last month" },
  { key: "LAST_7", label: "Last 7 days" },
  { key: "LAST_30", label: "Last 30 days" },
  { key: "TODAY", label: "Today" },
  { key: "ALL_TIME", label: "All time" },
];

const SALES_PER_DAY_CAP = 2;
const DAYS_PER_PAGE = 5;

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatWeekday(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatRangeLabel(from, to) {
  if (!from || !to) return "All time";
  const fromLabel = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const toLabel = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fromLabel} – ${toLabel}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonths(date, delta) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

// "This month"'s comparison is the same day-of-month range one calendar
// month back (May 1-24 vs Apr 1-24), which controls for month-length
// better than a flat 30-day shift. Day-count presets (Last 7/30/Today) and
// custom ranges instead compare against the immediately preceding window
// of equal length, which is the more natural comparison for a rolling window.
function getRangeBounds(preset, customFrom, customTo) {
  const now = new Date();

  if (preset === "TODAY") {
    const from = startOfDay(now);
    const to = endOfDay(now);
    const yesterday = new Date(now.getTime() - 86400000);
    return { from, to, prevFrom: startOfDay(yesterday), prevTo: endOfDay(yesterday) };
  }

  if (preset === "LAST_7" || preset === "LAST_30") {
    const days = preset === "LAST_7" ? 7 : 30;
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
    const spanMs = to.getTime() - from.getTime() + 1;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs + 1);
    return { from, to, prevFrom, prevTo };
  }

  if (preset === "LAST_MONTH") {
    const thisMonthStart = startOfMonth(now);
    const to = endOfDay(new Date(thisMonthStart.getTime() - 1));
    const from = startOfMonth(to);
    const prevTo = endOfDay(new Date(from.getTime() - 1));
    const prevFrom = startOfMonth(prevTo);
    return { from, to, prevFrom, prevTo };
  }

  if (preset === "ALL_TIME") {
    return { from: null, to: null, prevFrom: null, prevTo: null };
  }

  if (preset === "CUSTOM") {
    const from = customFrom ? startOfDay(new Date(customFrom)) : null;
    const to = customTo ? endOfDay(new Date(customTo)) : null;
    if (!from || !to) return { from, to, prevFrom: null, prevTo: null };
    const spanMs = to.getTime() - from.getTime() + 1;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs + 1);
    return { from, to, prevFrom, prevTo };
  }

  // THIS_MONTH (default)
  const from = startOfMonth(now);
  const to = endOfDay(now);
  return { from, to, prevFrom: shiftMonths(from, -1), prevTo: shiftMonths(to, -1) };
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

function groupSalesByDay(items) {
  const map = new Map();
  for (const sale of items) {
    const date = new Date(sale.saleDate);
    const key = date.toDateString();
    let group = map.get(key);
    if (!group) {
      group = { key, date, sales: [], total: 0 };
      map.set(key, group);
    }
    group.sales.push(sale);
    if (sale.status !== "VOIDED") group.total += Number(sale.totals?.total || 0);
  }
  return Array.from(map.values());
}

// Matches the icon-button treatment used in the Orders page toolbar
// (search/filter toggles beside the primary action button), so the two
// list pages share one visual language for their header controls.
const IconButton = forwardRef(function IconButton({ icon, onClick, active = false, label }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${active ? "var(--color-azure, #0071e3)" : "rgba(29,29,31,.1)"}`,
        background: active ? "rgba(0,113,227,.08)" : "rgba(255,255,255,.9)",
        color: active ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <DashboardIcon name={icon} size={16} strokeWidth={1.9} />
    </button>
  );
});

// Portal-rendered to document.body with fixed positioning computed from the
// trigger's own rect (same pattern as the Orders page's FilterMenu) — this
// header now sits inside a "dash-fade-up" Surface, which permanently gains
// its own stacking context once the entrance animation finishes (a
// transform other than "none" always creates one), so a plain
// absolutely-positioned popover paints underneath the sales list below it
// regardless of z-index. Escaping to a body-level portal sidesteps that
// ancestor-stacking-context ambiguity entirely.
function StatusFilterMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, left: Math.max(12, rect.right - 180) });
  }

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <IconButton
        ref={buttonRef}
        icon="filter"
        active={open || value !== "ALL"}
        onClick={() => {
          setOpen((v) => !v);
          requestAnimationFrame(updatePosition);
        }}
        label="Filter sales"
      />
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="dealer-sales-range-popover"
              style={{ position: "fixed", top: position.top, left: position.left, right: "auto", width: 180, zIndex: 1300 }}
            >
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                  className={`dealer-sales-range-option ${value === option.key ? "is-active" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function DateRangePicker({ preset, customFrom, customTo, from, to, onApply }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [draftFrom, setDraftFrom] = useState(customFrom || "");
  const [draftTo, setDraftTo] = useState(customTo || "");
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, left: Math.max(12, rect.right - 240) });
  }

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          requestAnimationFrame(updatePosition);
        }}
        className="dealer-sales-range-btn"
      >
        <DashboardIcon name="calendar" size={14} strokeWidth={1.8} />
        <span>{formatRangeLabel(from, to)}</span>
        <DashboardIcon name="chevron" size={11} strokeWidth={2.4} style={{ transform: "rotate(90deg)" }} />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              className="dealer-sales-range-popover"
              style={{ position: "fixed", top: position.top, left: position.left, right: "auto", zIndex: 1300 }}
            >
              {RANGE_PRESETS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onApply({ preset: option.key });
                    setOpen(false);
                  }}
                  className={`dealer-sales-range-option ${preset === option.key ? "is-active" : ""}`}
                >
                  {option.label}
                </button>
              ))}
              <div className="dealer-sales-range-custom">
                <div className="dealer-sales-range-custom-label">Custom range</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="dealer-sales-range-date" />
                  <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="dealer-sales-range-date" />
                </div>
                <button
                  type="button"
                  disabled={!draftFrom || !draftTo}
                  onClick={() => {
                    onApply({ preset: "CUSTOM", customFrom: draftFrom, customTo: draftTo });
                    setOpen(false);
                  }}
                  className="dealer-sales-range-apply"
                >
                  Apply
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function SaleThumbStack({ items, imageMap }) {
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {visible.map((item, index) => {
        const image = imageMap.get(String(item.productId));
        return (
          <div key={item.productId || index} className="dealer-sales-thumb" style={{ marginLeft: index === 0 ? 0 : -8, zIndex: visible.length - index }}>
            {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={13} strokeWidth={1.6} style={{ color: "rgba(0,0,0,.25)" }} />}
          </div>
        );
      })}
      {overflow > 0 ? (
        <div className="dealer-sales-thumb dealer-sales-thumb-more" style={{ marginLeft: -8 }}>
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

function DayGroup({ group, forceExpanded, isExpanded, onToggleExpand, onOpenSale, imageMap }) {
  const expanded = forceExpanded || isExpanded;
  const visibleSales = expanded ? group.sales : group.sales.slice(0, SALES_PER_DAY_CAP);
  const hiddenCount = group.sales.length - visibleSales.length;

  return (
    <div className="dealer-sales-day">
      <div className="dealer-sales-day-header">
        <span className="dealer-sales-day-marker" aria-hidden="true" />
        <div>
          <div className="dealer-sales-day-date">{formatDayLabel(group.date)}</div>
          <div className="dealer-sales-day-weekday">{formatWeekday(group.date)}</div>
        </div>
      </div>

      <div className="dealer-sales-day-body">
        {visibleSales.map((sale) => (
          <button key={sale._id} type="button" onClick={() => onOpenSale(sale)} className="dealer-sales-row">
            <span className={`dealer-sales-row-icon ${sale.status === "VOIDED" ? "is-voided" : ""}`}>
              <DashboardIcon name={sale.status === "VOIDED" ? "reject" : "checkSquare"} size={15} strokeWidth={1.8} />
            </span>
            <div className="dealer-sales-row-main">
              <div className="dealer-sales-row-title">
                Sale ID: {sale.saleNumber}
                {sale.status === "VOIDED" ? (
                  <Pill tone="critical" size="small">
                    Voided
                  </Pill>
                ) : null}
              </div>
              <div className="dealer-sales-row-sub">
                {formatTime(sale.saleDate)} &middot; {sale.items?.length || 0} Items
              </div>
            </div>
            <SaleThumbStack items={sale.items || []} imageMap={imageMap} />
            <span className="dealer-sales-row-total">{formatMoney(sale.totals?.total)}</span>
            <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
          </button>
        ))}

        <div className="dealer-sales-day-footer">
          {hiddenCount > 0 ? (
            <button type="button" onClick={() => onToggleExpand(group.key)} className="dealer-sales-view-more">
              View {hiddenCount} more sale{hiddenCount === 1 ? "" : "s"}
              <DashboardIcon name="chevron" size={11} strokeWidth={2.4} style={{ transform: "rotate(90deg)" }} />
            </button>
          ) : expanded && group.sales.length > SALES_PER_DAY_CAP ? (
            <button type="button" onClick={() => onToggleExpand(group.key)} className="dealer-sales-view-more">
              Show less
              <DashboardIcon name="chevron" size={11} strokeWidth={2.4} style={{ transform: "rotate(-90deg)" }} />
            </button>
          ) : (
            <span />
          )}
          <span className="dealer-sales-day-total">{formatMoney(group.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, totalCount, pageSize, onChange }) {
  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pages = buildPageList(page, totalPages);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Showing {start} to {end} of {totalCount} days
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="dealer-sales-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`dealer-sales-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="dealer-sales-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function SaleDetailModal({ sale, onClose }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [voidSale, voidState] = useVoidDealerSaleMutation();

  if (!sale) return null;

  const canVoid = sale.status === "COMPLETED";

  async function handleVoid() {
    setError("");
    if (!reason.trim()) {
      setError("A reason is required to void this sale.");
      return;
    }
    try {
      await voidSale({ saleId: sale._id, reason }).unwrap();
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not void this sale."));
    }
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
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)", maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader eyebrow={sale.saleNumber} icon="orders" title={sale.billId ? `Bill ${sale.billId}` : "Sale"} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <DashboardIcon name="close" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">
            {sale.status}
          </Pill>
          <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(sale.saleDate)}</span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
          {sale.items.map((item) => (
            <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
              <span>
                {item.name} &times; {item.quantity}
              </span>
              <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(sale.totals?.total)}</span>
        </div>

        {sale.notes ? <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{sale.notes}</div> : null}

        {sale.status === "VOIDED" ? (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#b42318" }}>Voided: {sale.voidReason}</div>
        ) : canVoid ? (
          <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for voiding this sale"
              style={{ height: 38, borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", padding: "0 12px", fontSize: 13 }}
            />
            {error ? <div style={{ fontSize: 12, fontWeight: 600, color: "#b42318" }}>{error}</div> : null}
            <button
              type="button"
              onClick={handleVoid}
              disabled={voidState.isLoading}
              style={{ height: 38, borderRadius: 10, border: "1px solid rgba(180,35,24,.3)", background: "rgba(180,35,24,.06)", color: "#b42318", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {voidState.isLoading ? "Voiding…" : "Void this sale"}
            </button>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}

export default function DealerSalesPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [toast, setToast] = useState(null);

  const [rangePreset, setRangePreset] = useState("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dayPage, setDayPage] = useState(1);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const { from, to } = useMemo(() => getRangeBounds(rangePreset, customFrom, customTo), [rangePreset, customFrom, customTo]);

  const salesQuery = useGetDealerSalesQuery({
    q: query,
    status,
    dateFrom: from ? from.toISOString() : undefined,
    dateTo: to ? to.toISOString() : undefined,
    limit: 200,
  });

  const inventoryQuery = useGetDealerInventoryQuery({ limit: 200 });
  const imageMap = useMemo(() => {
    const map = new Map();
    for (const item of inventoryQuery.data?.items || []) {
      const image = getPrimaryImage(item.images);
      if (image) map.set(String(item.productId), image);
    }
    return map;
  }, [inventoryQuery.data]);

  const items = useMemo(() => salesQuery.data?.items || [], [salesQuery.data]);

  const dayGroups = useMemo(() => groupSalesByDay(items), [items]);
  const totalDayPages = Math.max(1, Math.ceil(dayGroups.length / DAYS_PER_PAGE));
  const currentDayPage = Math.min(dayPage, totalDayPages);
  const visibleDayGroups = dayGroups.slice((currentDayPage - 1) * DAYS_PER_PAGE, currentDayPage * DAYS_PER_PAGE);

  const loadError = salesQuery.error ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.") : "";

  function submitSearch() {
    setQuery(draftQuery.trim());
    setDayPage(1);
  }

  function changeStatus(next) {
    setStatus(next);
    setDayPage(1);
  }

  function applyRange({ preset, customFrom: nextFrom, customTo: nextTo }) {
    setRangePreset(preset);
    if (preset === "CUSTOM") {
      setCustomFrom(nextFrom);
      setCustomTo(nextTo);
    }
    setDayPage(1);
  }

  function toggleDayExpand(key) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleExpandAll() {
    setAllExpanded((value) => !value);
    setExpandedDays(new Set());
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={18} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <SectionHeader
            icon="orders"
            title="Sales"
            subtitle="View and track all your sales history."
            size="large"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            {searchOpen ? (
              <div style={{ width: 220 }}>
                <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={submitSearch} placeholder="Search sales…" />
              </div>
            ) : null}
            <IconButton
              icon={searchOpen ? "close" : "search"}
              active={searchOpen}
              onClick={() => {
                if (searchOpen && query) {
                  setDraftQuery("");
                  setQuery("");
                  setDayPage(1);
                }
                setSearchOpen((v) => !v);
              }}
              label={searchOpen ? "Close search" : "Search sales"}
            />
            <StatusFilterMenu value={status} onChange={changeStatus} />
            <DateRangePicker preset={rangePreset} customFrom={customFrom} customTo={customTo} from={from} to={to} onApply={applyRange} />
            <PrimaryButton icon="plus" onClick={() => setNewSaleOpen(true)}>
              New Sale
            </PrimaryButton>
          </div>
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{loadError}</div>
        ) : null}
      </Surface>

      {salesQuery.isLoading && !salesQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : dayGroups.length === 0 ? (
        <EmptyState icon="orders" title="No sales yet" subtitle="Record your first sale to see it appear here." />
      ) : (
        <>
          <Surface padding={0} className="dash-fade-up">
            <div className="dealer-sales-timeline-header">
              <span>Date</span>
              <span>Sales Details</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                Total (NPR)
                <button type="button" onClick={toggleExpandAll} aria-label={allExpanded ? "Collapse all" : "Expand all"} className="dealer-sales-collapse-all">
                  <DashboardIcon name="chevron" size={12} strokeWidth={2.4} style={{ transform: allExpanded ? "rotate(-90deg)" : "rotate(90deg)" }} />
                </button>
              </span>
            </div>

            <div style={{ padding: "18px 20px 20px" }}>
              <div className="dealer-sales-timeline">
                {visibleDayGroups.map((group) => (
                  <DayGroup
                    key={group.key}
                    group={group}
                    forceExpanded={allExpanded}
                    isExpanded={expandedDays.has(group.key)}
                    onToggleExpand={toggleDayExpand}
                    onOpenSale={setSelectedSale}
                    imageMap={imageMap}
                  />
                ))}
              </div>
            </div>
          </Surface>

          <Pagination
            page={currentDayPage}
            totalPages={totalDayPages}
            totalCount={dayGroups.length}
            pageSize={DAYS_PER_PAGE}
            onChange={(next) => {
              setDayPage(next);
              scrollResultsToTop();
            }}
          />
        </>
      )}

      <NewSaleModal
        open={newSaleOpen}
        onClose={() => setNewSaleOpen(false)}
        onCreated={(sale) =>
          setToast({
            tone: "success",
            title: "Sale recorded",
            description: `${sale.saleNumber} · ${formatMoney(sale?.totals?.total)}`,
          })
        }
      />
      <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <style>{`
        .dealer-sales-range-btn{
          display:inline-flex; align-items:center; gap:8px; height:40px; padding:0 16px;
          border-radius:999px; border:1px solid rgba(29,29,31,.1); background:#fff;
          font-size:13px; font-weight:650; color:var(--color-ink, #1d1d1f); cursor:pointer;
          white-space:nowrap;
        }
        .dealer-sales-range-btn:hover{ background:rgba(29,29,31,.03); }
        .dealer-sales-range-popover{
          position:absolute; top:46px; right:0; z-index:30; width:240px; padding:8px;
          border-radius:16px; border:1px solid rgba(29,29,31,.08); background:#fff;
          box-shadow:0 16px 40px rgba(15,23,42,.14);
        }
        .dealer-sales-range-option{
          display:block; width:100%; text-align:left; padding:9px 10px; border-radius:10px;
          border:none; background:transparent; font-size:13px; font-weight:600;
          color:var(--color-ink, #1d1d1f); cursor:pointer;
        }
        .dealer-sales-range-option:hover{ background:var(--color-fog, #f5f5f7); }
        .dealer-sales-range-option.is-active{ background:rgba(0,113,227,.1); color:var(--color-azure, #0071e3); }
        .dealer-sales-range-custom{ margin-top:6px; padding:10px 8px 8px; border-top:1px solid rgba(29,29,31,.08); }
        .dealer-sales-range-custom-label{ font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--color-graphite, #707070); margin-bottom:6px; }
        .dealer-sales-range-date{ flex:1; min-width:0; height:34px; border-radius:9px; border:1px solid rgba(0,0,0,.12); padding:0 8px; font-size:12px; }
        .dealer-sales-range-apply{
          width:100%; margin-top:8px; height:34px; border-radius:9px; border:none;
          background:var(--color-azure, #0071e3); color:#fff; font-size:12.5px; font-weight:700; cursor:pointer;
        }
        .dealer-sales-range-apply:disabled{ opacity:.4; cursor:not-allowed; }

        .dealer-sales-timeline-header{
          display:grid; grid-template-columns:170px minmax(0,1fr) 200px; gap:12px; align-items:center;
          padding:14px 20px; border-bottom:1px solid rgba(0,0,0,.06);
          font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--color-graphite, #707070);
        }
        .dealer-sales-collapse-all{
          width:22px; height:22px; border-radius:7px; border:none; background:var(--color-fog, #f5f5f7);
          display:inline-flex; align-items:center; justify-content:center; cursor:pointer; color:var(--color-graphite, #707070);
        }
        .dealer-sales-collapse-all:hover{ background:rgba(29,29,31,.1); }

        .dealer-sales-timeline{ position:relative; display:grid; gap:26px; }
        .dealer-sales-timeline::before{
          content:""; position:absolute; left:6px; top:4px; bottom:4px; width:2px;
          background:linear-gradient(180deg, rgba(0,113,227,.24), rgba(29,29,31,.09));
        }
        .dealer-sales-day{ position:relative; display:grid; gap:14px; }
        .dealer-sales-day-header{ position:relative; display:flex; align-items:center; gap:14px; padding-left:0; }
        .dealer-sales-day-marker{
          position:relative; z-index:1; width:13px; height:13px; border-radius:999px;
          background:#fff; border:2px solid rgba(0,113,227,.82); flex-shrink:0; box-shadow:0 0 0 4px #fff;
        }
        .dealer-sales-day-date{ font-size:14px; font-weight:750; color:var(--color-ink, #1d1d1f); }
        .dealer-sales-day-weekday{ margin-top:1px; font-size:12px; color:var(--color-graphite, #707070); }
        .dealer-sales-day-body{ margin-left:27px; display:grid; gap:8px; }

        .dealer-sales-row{
          display:flex; align-items:center; gap:12px; width:100%; padding:12px 14px;
          border-radius:14px; border:1px solid rgba(29,29,31,.07); background:#fff;
          cursor:pointer; text-align:left; transition:box-shadow .16s ease, border-color .16s ease, transform .16s ease;
        }
        .dealer-sales-row:hover{ box-shadow:0 10px 26px rgba(15,23,42,.07); border-color:rgba(0,113,227,.16); transform:translateY(-1px); }
        .dealer-sales-row-icon{
          width:32px; height:32px; border-radius:10px; flex-shrink:0; display:grid; place-items:center;
          background:rgba(22,163,74,.1); color:#15803d;
        }
        .dealer-sales-row-icon.is-voided{ background:rgba(180,35,24,.1); color:#b42318; }
        .dealer-sales-row-main{ min-width:0; flex:1 1 auto; }
        .dealer-sales-row-title{ display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:700; color:var(--color-ink, #1d1d1f); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dealer-sales-row-sub{ margin-top:2px; font-size:11.5px; color:var(--color-graphite, #707070); }
        .dealer-sales-row-total{ flex-shrink:0; min-width:90px; text-align:right; font-size:13.5px; font-weight:750; color:var(--color-ink, #1d1d1f); }

        .dealer-sales-thumb{
          position:relative; width:26px; height:26px; border-radius:8px; background:var(--color-fog, #f5f5f7);
          border:2px solid #fff; box-shadow:0 0 0 1px rgba(29,29,31,.08); display:grid; place-items:center; overflow:hidden; flex-shrink:0;
        }
        .dealer-sales-thumb img{ width:100%; height:100%; object-fit:cover; }
        .dealer-sales-thumb-more{ font-size:9.5px; font-weight:750; color:var(--color-graphite, #707070); background:var(--color-fog, #f5f5f7); }

        .dealer-sales-day-footer{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 2px; }
        .dealer-sales-view-more{
          display:inline-flex; align-items:center; gap:5px; border:none; background:transparent; padding:0;
          font-size:12.5px; font-weight:650; color:var(--color-azure, #0071e3); cursor:pointer;
        }
        .dealer-sales-day-total{ font-size:12.5px; font-weight:700; color:var(--color-graphite, #707070); }

        .dealer-sales-page-btn{ min-width:32px; height:32px; padding:0 8px; border-radius:8px; border:none; background:transparent; font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .dealer-sales-page-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .dealer-sales-page-btn.is-active{ background:var(--color-azure, #0071e3); color:#fff; }
        .dealer-sales-page-btn:not(.is-active):not(:disabled):hover{ background:rgba(29,29,31,.06); }

        @media (max-width:720px){
          .dealer-sales-timeline-header{ grid-template-columns:1fr; gap:4px; }
          .dealer-sales-timeline-header span:nth-child(2){ display:none; }
          .dealer-sales-row{ flex-wrap:wrap; }
          .dealer-sales-row-total{ order:5; }
        }
      `}</style>
    </div>
  );
}
