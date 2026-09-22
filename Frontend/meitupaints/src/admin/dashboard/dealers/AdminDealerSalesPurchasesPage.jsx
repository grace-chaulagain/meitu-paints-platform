import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDealerQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminSalesQuery,
  useGetAdminOrdersQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  DataTable,
  GhostButton,
  Pagination,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField } from "../../../components/dashboard/ApplePickers.jsx";
import { useCountUp } from "../../../dealer/mobile/useCountUp.js";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stockTone(status) {
  if (status === "OUT_OF_STOCK") return "critical";
  if (status === "LOW_STOCK") return "caution";
  return "positive";
}

function stockLabel(status) {
  if (status === "OUT_OF_STOCK") return "Out of stock";
  if (status === "LOW_STOCK") return "Low stock";
  return "In stock";
}

function isoDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Interpreted as a plain calendar date (no time zone shift) since it's
// always a "YYYY-MM-DD" key.
function formatFilterDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// `to` is inclusive of the whole day (callers pass a "YYYY-MM-DDT23:59:59.999"
// bound), so a single-day range naturally has from === to on the date part.
function dateRangeLabel(from, to) {
  if (!from && !to) return "All time";
  if (from && to && from === to) return formatFilterDate(from);
  if (from && to) return `${formatFilterDate(from)} – ${formatFilterDate(to)}`;
  if (from) return `From ${formatFilterDate(from)}`;
  return `Until ${formatFilterDate(to)}`;
}

function formatDayHeading(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

// A full-width, high-contrast section divider for DataTable's
// renderGroupHeader - the shared component's own default group-row styling
// (12px muted-gray caption text on a transparent background) reads as a
// footnote, not a section break, which is exactly why grouping by category
// was unreadable with more than a couple of groups on screen. This is
// scoped to this page only via the .admin-sp-datatable wrapper class in the
// stylesheet below, rather than changing DataTable's shared CSS, since
// other pages already use that component's default grouping successfully
// for lower-group-count cases (day-grouped history, etc.).
function GroupHeaderRow({ label, count, countLabel }) {
  return (
    <div className="admin-sp-group-header">
      <span>{label}</span>
      {count ? <span className="admin-sp-group-count">{count} {countLabel}{count === 1 ? "" : "s"}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range control - the applied range is always the control's own visible
// label (never hidden behind an icon-only trigger), with a one-tap clear and
// a set of one-click presets for the common cases. Custom start/end dates
// remain available in the same popover for anything else.
//
// Rendered through a portal into document.body (position computed from the
// trigger's own getBoundingClientRect) rather than as a plain absolutely-
// positioned descendant. Every "dash-fade-up" card on this page keeps a
// non-"none" `transform` after its entrance animation finishes (animation-
// fill-mode: both holding the final keyframe), and a transform other than
// none always creates a new CSS stacking context - so a plain z-index on a
// popover nested inside the header card could never out-rank a sibling card
// lower in the DOM. Escaping to document.body sidesteps that entirely.
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
];

function DateRangeControl({ from, to, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [position, setPosition] = useState(null);
  const active = Boolean(from || to);
  const triggerRef = useRef(null);
  // Plain string comparison is safe here - both are "YYYY-MM-DD" keys, which
  // sort lexicographically the same as chronologically.
  const invalidRange = Boolean(draftFrom && draftTo && draftTo < draftFrom);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const viewportPadding = 12;
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    setPosition({ left, top: rect.bottom + 8, width });
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

  function applyCustom() {
    onApply(draftFrom, draftTo);
    closePopover();
  }

  function applyPreset(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    onApply(isoDateKey(start), isoDateKey(end));
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
    <div className="admin-sp-daterange">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : openPopover())}
        aria-label="Filter by date range"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`admin-sp-daterange-trigger ${active ? "is-active" : ""}`}
      >
        <DashboardIcon name="calendar" size={14} strokeWidth={1.9} />
        <span>{active ? dateRangeLabel(from, to) : "All time"}</span>
      </button>

      {active ? (
        <button
          type="button"
          className="admin-sp-daterange-clear"
          aria-label="Clear date filter"
          onClick={(event) => {
            event.stopPropagation();
            clear();
          }}
        >
          <DashboardIcon name="close" size={11} strokeWidth={2.6} />
        </button>
      ) : null}

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={closePopover} />
              <div
                className="admin-sp-filter-pop"
                role="dialog"
                aria-label="Filter by date range"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-sp-filter-presets">
                  {DATE_PRESETS.map((preset) => (
                    <button key={preset.key} type="button" onClick={() => applyPreset(preset.days)}>
                      {preset.label}
                    </button>
                  ))}
                  <button type="button" onClick={clear}>
                    All Time
                  </button>
                </div>

                <div className="admin-sp-filter-pop-title">Or pick a custom range</div>

                <label className="admin-sp-filter-field">
                  <span>Start date</span>
                  <AppleDateField value={draftFrom || ""} onChange={setDraftFrom} />
                </label>
                <label className="admin-sp-filter-field">
                  <span>End date</span>
                  <AppleDateField value={draftTo || ""} onChange={setDraftTo} />
                </label>
                {invalidRange ? (
                  <div className="admin-sp-filter-pop-error">End date can&apos;t be before the start date.</div>
                ) : null}

                <div className="admin-sp-filter-pop-actions">
                  <PrimaryButton
                    onClick={applyCustom}
                    disabled={!draftFrom || !draftTo || invalidRange}
                    style={{ height: 34, padding: "0 14px", fontSize: 12.5, width: "100%" }}
                  >
                    Apply Range
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

// ---------------------------------------------------------------------------
// History preview modals - a lightweight read-only look at one entry without
// leaving this page. Kept, since navigating away just to check what was in
// an order is real friction on a page whose entire point is quick review.
// ---------------------------------------------------------------------------

function HistoryModalShell({ children, onClose, width = 560 }) {
  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: `min(${width}px, 100%)`, maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        {children}
      </Surface>
    </div>
  );
}

function HistoryCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

function orderStatusTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  return "accent";
}

function HistoryOrderPreviewModal({ order, onClose }) {
  if (!order) return null;
  return (
    <HistoryModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={order.orderNumber} icon="orders" title="Order Preview" />
        <HistoryCloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={orderStatusTone(order.status)} size="small">{order.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatFilterDate((order.createdAt || "").slice(0, 10))}</span>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(order.items || []).map((item, index) => (
          <div key={`${item.productId || item.sku || index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name}{item.packLabel ? ` (${item.packLabel})` : ""} × {formatQty(item.quantity)}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(order.totals?.total)}</span>
      </div>

      {order.dealerNote ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>Dealer note: {order.dealerNote}</div>
      ) : null}
    </HistoryModalShell>
  );
}

function HistorySaleDetailModal({ sale, onClose }) {
  if (!sale) return null;
  return (
    <HistoryModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={sale.saleNumber} icon="orders" title={sale.billId ? `Bill ${sale.billId}` : "Sale"} />
        <HistoryCloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">{sale.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatFilterDate((sale.saleDate || "").slice(0, 10))}</span>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(sale.items || []).map((item, index) => (
          <div key={`${item.productId || index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name}{item.packLabel ? ` (${item.packLabel})` : ""} × {formatQty(item.quantity)}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(sale.totals?.total)}</span>
      </div>

      {sale.status === "VOIDED" ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#b42318" }}>Voided: {sale.voidReason}</div>
      ) : null}
    </HistoryModalShell>
  );
}

// One row per real Sale/Order document, not per InventoryMovement line item -
// a 3-product order is one order event, not three rows.
function buildHistoryEvents(sales, orders) {
  const saleEvents = sales.map((sale) => ({ type: "sale", key: `sale-${sale._id}`, date: new Date(sale.saleDate), sale }));
  const orderEvents = orders.map((order) => ({ type: "order", key: `order-${order._id}`, date: new Date(order.createdAt), order }));
  return [...saleEvents, ...orderEvents]
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

const HISTORY_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDealerSalesPurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dealers\/([^/]+)\/sales-purchases$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [view, setView] = useState(location.state?.initialView === "stock" ? "stock" : "history");
  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewSale, setPreviewSale] = useState(null);

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const inventoryQuery = useGetAdminDealerInventoryQuery(
    {
      dealerId,
      // The end date is sent as its own end-of-day bound so the range
      // includes everything that happened on that last day, not just up to
      // midnight.
      from: filterFrom || undefined,
      to: filterTo ? `${filterTo}T23:59:59.999` : undefined,
    },
    { skip: !dealerId },
  );
  // Fetched only once the tab is actually opened - the same date range
  // filter as the By Product tab applies here too. This reads the actual
  // Sale and Order collections directly (not the per-product movement
  // ledger), and is scoped to real purchases only - status:"ALL" so
  // delivered/completed history isn't hidden behind the default
  // submitted-only view, excludeOrigins:"SCHEME" so free grants don't show
  // up as paid purchases.
  const salesForHistoryQuery = useGetAdminSalesQuery(
    {
      dealerId,
      from: filterFrom || undefined,
      to: filterTo ? `${filterTo}T23:59:59.999` : undefined,
      limit: 100,
    },
    { skip: !dealerId || view !== "history" },
  );
  const ordersForHistoryQuery = useGetAdminOrdersQuery(
    {
      dealerId,
      status: "ALL",
      excludeOrigins: "SCHEME",
      from: filterFrom || undefined,
      to: filterTo ? `${filterTo}T23:59:59.999` : undefined,
      limit: 100,
    },
    { skip: !dealerId || view !== "history" },
  );

  const dealer = dealerQuery.data?.item || null;
  const items = useMemo(() => inventoryQuery.data?.items || [], [inventoryQuery.data]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const purchase = Number(item.totalReceivedQuantity || 0);
      const scheme = Number(item.totalSchemeQuantity || 0);
      const sales = Number(item.totalSoldQuantity || 0);
      const unitCost = Number(item.lastKnownUnitCost || 0);
      return {
        productId: item.productId,
        name: item.name || "Unnamed product",
        sku: item.sku || "",
        category: item.category || "",
        pack: item.pack || {},
        purchase,
        scheme,
        sales,
        // Scheme goods enter stock the same as any other order (they're
        // genuinely sellable), so Balance has to include them to keep
        // meaning "what this dealer actually has" - matching the Stock
        // tab's live currentQuantity rather than just Purchase minus Sales.
        // Purchase itself stays purchase-only on purpose (a commercial
        // figure a free grant shouldn't inflate).
        balance: purchase + scheme - sales,
        unitCost,
        purchaseValue: purchase * unitCost,
      };
    });
  }, [items]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q) || row.category.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Sorted category-then-name so a category's rows are contiguous - required
  // for the group-header-on-first-row-of-group pattern below.
  const sortedProductRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
      return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name);
    });
  }, [filteredRows]);

  const productGroupHeaderByFirstId = useMemo(() => {
    const counts = new Map();
    for (const row of sortedProductRows) counts.set(row.category, (counts.get(row.category) || 0) + 1);
    const map = new Map();
    let lastCategory = null;
    for (const row of sortedProductRows) {
      if (row.category !== lastCategory) {
        map.set(row.productId, { label: categoryLabel(row.category), count: counts.get(row.category) });
        lastCategory = row.category;
      }
    }
    return map;
  }, [sortedProductRows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.purchase += row.purchase;
        acc.scheme += row.scheme;
        acc.sales += row.sales;
        acc.balance += row.balance;
        acc.purchaseValue += row.purchaseValue;
        return acc;
      },
      { purchase: 0, scheme: 0, sales: 0, balance: 0, purchaseValue: 0 },
    );
  }, [rows]);

  const purchaseCountUp = useCountUp(totals.purchase);
  const schemeCountUp = useCountUp(totals.scheme);
  const salesCountUp = useCountUp(totals.sales);
  const balanceCountUp = useCountUp(totals.balance);

  // On-hand quantity/value/status reflect live stock and aren't affected by
  // the date filter (only totalReceivedQuantity/totalSchemeQuantity/
  // totalSoldQuantity change with that filter - see the backend's
  // listDealerStock), so the Stock view reuses this same already-fetched
  // "items" list rather than issuing a second query, and has no date filter
  // control of its own.
  // currentQuantity isn't tracked by source (a sale debits the one shared
  // pool, so which specific units - purchased or scheme - actually left
  // can't be known after the fact). Purchased/Scheme Value below is
  // therefore an honest proportional split of the current Total Value,
  // weighted by how much of everything this product ever received came
  // from each source - not a claim about which exact units remain. It
  // always adds up to the Total exactly, which a lifetime-received split
  // wouldn't once anything's been sold.
  const sortedStockRows = useMemo(() => {
    return [...items]
      .map((item) => {
        const totalValue = Number(item.inventoryValue || 0);
        const totalAcquired = Number(item.totalReceivedQuantity || 0) + Number(item.totalSchemeQuantity || 0);
        const purchasedValue = totalAcquired > 0 ? (totalValue * item.totalReceivedQuantity) / totalAcquired : 0;
        const schemeValue = totalAcquired > 0 ? (totalValue * item.totalSchemeQuantity) / totalAcquired : 0;
        return { ...item, purchasedValue, schemeValue };
      })
      .sort((a, b) => {
        const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
        return catCompare !== 0 ? catCompare : (a.name || "").localeCompare(b.name || "");
      });
  }, [items]);

  const stockGroupHeaderByFirstId = useMemo(() => {
    const counts = new Map();
    for (const item of sortedStockRows) counts.set(item.category, (counts.get(item.category) || 0) + 1);
    const map = new Map();
    let lastCategory = null;
    for (const item of sortedStockRows) {
      if (item.category !== lastCategory) {
        map.set(item.productId, { label: categoryLabel(item.category), count: counts.get(item.category) });
        lastCategory = item.category;
      }
    }
    return map;
  }, [sortedStockRows]);

  const stockSummary = inventoryQuery.data?.summary || { totalValue: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 };

  // The server summary only covers current-state numbers (on-hand units/
  // value) - it has nothing about what was actually purchased over time.
  // Computed client-side from the same already-fetched "items" list rather
  // than a second query, same pattern as `totals` above.
  const purchaseSummary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number(item.totalReceivedQuantity || 0);
        const unitCost = Number(item.lastKnownUnitCost || 0);
        acc.totalUnits += qty;
        acc.totalValue += qty * unitCost;
        return acc;
      },
      { totalUnits: 0, totalValue: 0 },
    );
  }, [items]);

  // Sum of the same per-row proportional split computed in sortedStockRows -
  // adds up to stockSummary.totalValue exactly, just broken into where it
  // came from.
  const valueSplitSummary = useMemo(() => {
    return sortedStockRows.reduce(
      (acc, row) => {
        acc.purchasedValue += row.purchasedValue;
        acc.schemeValue += row.schemeValue;
        return acc;
      },
      { purchasedValue: 0, schemeValue: 0 },
    );
  }, [sortedStockRows]);

  const purchasedCountUp = useCountUp(purchaseSummary.totalUnits);
  const onHandCountUp = useCountUp(stockSummary.totalUnits);

  const historySales = useMemo(() => salesForHistoryQuery.data?.items || [], [salesForHistoryQuery.data]);
  const historyOrders = useMemo(() => ordersForHistoryQuery.data?.items || [], [ordersForHistoryQuery.data]);
  const historyEvents = useMemo(() => buildHistoryEvents(historySales, historyOrders), [historySales, historyOrders]);
  const historyTotalPages = Math.max(1, Math.ceil(historyEvents.length / HISTORY_PAGE_SIZE));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const historyVisibleEvents = historyEvents.slice((historyCurrentPage - 1) * HISTORY_PAGE_SIZE, historyCurrentPage * HISTORY_PAGE_SIZE);

  const historyGroupHeaderByKey = useMemo(() => {
    const counts = new Map();
    for (const event of historyVisibleEvents) {
      const dayKey = event.date.toDateString();
      counts.set(dayKey, (counts.get(dayKey) || 0) + 1);
    }
    const map = new Map();
    let lastDay = null;
    for (const event of historyVisibleEvents) {
      const dayKey = event.date.toDateString();
      if (dayKey !== lastDay) {
        map.set(event.key, { label: formatDayHeading(event.date), count: counts.get(dayKey) });
        lastDay = dayKey;
      }
    }
    return map;
  }, [historyVisibleEvents]);

  const historyLoading = (salesForHistoryQuery.isLoading && !salesForHistoryQuery.data) || (ordersForHistoryQuery.isLoading && !ordersForHistoryQuery.data);
  const historyFetching = salesForHistoryQuery.isFetching || ordersForHistoryQuery.isFetching;
  const historyError = salesForHistoryQuery.error
    ? getQueryErrorMessage(salesForHistoryQuery.error, "Failed to load sales history.")
    : ordersForHistoryQuery.error
      ? getQueryErrorMessage(ordersForHistoryQuery.error, "Failed to load purchase order history.")
      : "";

  const loadError = (view === "history" ? historyError : "") || (inventoryQuery.error ? getQueryErrorMessage(inventoryQuery.error, "Failed to load sales and purchases.") : "");
  const hasDateFilter = Boolean(filterFrom || filterTo);
  const dateLabel = dateRangeLabel(filterFrom, filterTo);

  function handleExportHistory() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${dealer?.companyName || "dealer"}-sales-purchases-history${filenameSuffix}`, [
      { key: "date", label: "Date", value: (event) => formatFilterDate(isoDateKey(event.date)) },
      { key: "type", label: "Type", value: (event) => (event.type === "sale" ? "Sale" : "Purchase") },
      { key: "reference", label: "Reference", value: (event) => (event.type === "sale" ? event.sale.billId || event.sale.saleNumber || "" : event.order.orderNumber || "") },
      { key: "items", label: "Items", value: (event) => (event.type === "sale" ? event.sale.items?.length : event.order.items?.length) || 0 },
      { key: "total", label: "Total", value: (event) => (event.type === "sale" ? event.sale.totals?.total : event.order.totals?.total) || 0 },
      { key: "status", label: "Status", value: (event) => (event.type === "sale" ? event.sale.status : event.order.status) || "" },
    ], historyEvents);
  }

  function handleExport() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${dealer?.companyName || "dealer"}-sales-purchases${filenameSuffix}`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "purchase", label: "Purchase" },
      { key: "unitCost", label: "Unit Cost", value: (row) => row.unitCost },
      { key: "purchaseValue", label: "Purchase Value", value: (row) => row.purchaseValue },
      { key: "scheme", label: "Scheme" },
      { key: "sales", label: "Sales" },
      { key: "balance", label: "Balance" },
      { key: "date", label: "Date", value: () => dateLabel },
    ], sortedProductRows);
  }

  function handleExportStock() {
    exportToCsv(`${dealer?.companyName || "dealer"}-stock`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (item) => categoryLabel(item.category) },
      { key: "totalReceivedQuantity", label: "Total Purchased" },
      { key: "lastKnownUnitCost", label: "Unit Cost", value: (item) => item.lastKnownUnitCost || 0 },
      { key: "currentQuantity", label: "On Hand" },
      { key: "purchasedValue", label: "Purchased Value", value: (item) => Math.round(item.purchasedValue || 0) },
      { key: "schemeValue", label: "Scheme Value", value: (item) => Math.round(item.schemeValue || 0) },
      { key: "inventoryValue", label: "Total Value" },
      { key: "status", label: "Status", value: (item) => stockLabel(item.status) },
    ], sortedStockRows);
  }

  // ---- Columns ----

  const productColumns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        isTitle: true,
        render: (row) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            {row.pack?.label ? (
              <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{row.pack.label}</div>
            ) : null}
          </div>
        ),
      },
      { key: "purchase", header: "Purchase", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => formatQty(row.purchase) },
      {
        key: "scheme",
        header: "Scheme",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => (row.scheme > 0 ? formatQty(row.scheme) : <span style={{ color: "var(--color-graphite, #707070)" }}>—</span>),
      },
      { key: "sales", header: "Sales", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => formatQty(row.sales) },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        // Color only carries a signal when something is actually wrong
        // (a negative balance means more was sold than the ledger says
        // this dealer ever received) - an ordinary positive balance is not
        // a "status" worth a colored pill, just a plain number.
        render: (row) => <strong style={{ color: row.balance < 0 ? "#b42318" : "var(--color-ink, #1d1d1f)" }}>{formatQty(row.balance)}</strong>,
      },
    ],
    [],
  );

  const productFooter = sortedProductRows.length
    ? [
        { key: "product", content: `${sortedProductRows.length} product${sortedProductRows.length === 1 ? "" : "s"} · Total`, align: "left" },
        {
          key: "purchase",
          content: (
            <>
              <div>{formatQty(purchaseCountUp)}</div>
              {totals.purchaseValue > 0 ? <div style={{ marginTop: 1, fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>{formatMoney(totals.purchaseValue)}</div> : null}
            </>
          ),
          align: "right",
        },
        { key: "scheme", content: formatQty(schemeCountUp), align: "right" },
        { key: "sales", content: formatQty(salesCountUp), align: "right" },
        { key: "balance", content: formatQty(balanceCountUp), align: "right" },
      ]
    : null;

  const stockColumns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        isTitle: true,
        render: (item) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
            {item.pack?.label ? (
              <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.pack.label}</div>
            ) : null}
          </div>
        ),
      },
      { key: "purchased", header: "Purchased", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => formatQty(item.totalReceivedQuantity) },
      { key: "unitCost", header: "Unit Cost", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => (item.lastKnownUnitCost ? formatMoney(item.lastKnownUnitCost) : "—") },
      { key: "onHand", header: "On Hand", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => <strong>{formatQty(item.currentQuantity)}</strong> },
      {
        key: "value",
        header: "Value",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (item) =>
          item.inventoryValue ? (
            <div>
              <strong>{formatMoney(item.inventoryValue)}</strong>
              <div style={{ marginTop: 1, fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Purchased {formatMoney(item.purchasedValue)} · Scheme {formatMoney(item.schemeValue)}
              </div>
            </div>
          ) : (
            "—"
          ),
      },
      { key: "status", header: "Status", render: (item) => <Pill tone={stockTone(item.status)} size="small">{stockLabel(item.status)}</Pill> },
    ],
    [],
  );

  const stockFooter = sortedStockRows.length
    ? [
        { key: "product", content: `${sortedStockRows.length} product${sortedStockRows.length === 1 ? "" : "s"} · Total`, align: "left" },
        { key: "purchased", content: formatQty(purchasedCountUp), align: "right" },
        { key: "unitCost", content: "", align: "right" },
        { key: "onHand", content: formatQty(onHandCountUp), align: "right" },
        {
          key: "value",
          content: (
            <div>
              <strong>{formatMoney(stockSummary.totalValue)}</strong>
              <div style={{ marginTop: 1, fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
                Purchased {formatMoney(valueSplitSummary.purchasedValue)} · Scheme {formatMoney(valueSplitSummary.schemeValue)}
              </div>
            </div>
          ),
          align: "right",
        },
        { key: "status", content: "", align: "left" },
      ]
    : null;

  const historyColumns = useMemo(
    () => [
      { key: "time", header: "Time", render: (event) => formatTime(event.type === "sale" ? event.sale?.saleDate : event.order?.createdAt) },
      {
        key: "type",
        header: "Type",
        render: (event) => {
          if (event.type === "sale") {
            const voided = event.sale?.status === "VOIDED";
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: voided ? "#b42318" : "#15803d" }}>
                <DashboardIcon name={voided ? "reject" : "checkSquare"} size={14} strokeWidth={1.8} />
                Sale
              </span>
            );
          }
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-azure, #0071e3)" }}>
              <DashboardIcon name="truck" size={14} strokeWidth={1.8} />
              Purchase
            </span>
          );
        },
      },
      {
        key: "reference",
        header: "Reference",
        render: (event) => (event.type === "sale" ? event.sale?.billId || event.sale?.saleNumber || "Sale" : event.order?.orderNumber || "Order"),
      },
      {
        key: "items",
        header: "Items",
        align: "right",
        render: (event) => {
          const count = event.type === "sale" ? event.sale?.items?.length : event.order?.items?.length;
          return count || 0;
        },
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (event) => formatMoney(event.type === "sale" ? event.sale?.totals?.total : event.order?.totals?.total),
      },
      {
        key: "status",
        header: "Status",
        render: (event) => {
          if (event.type === "sale") {
            const voided = event.sale?.status === "VOIDED";
            return <Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>;
          }
          const meta = orderStatusMeta(normalizeStatus(event.order?.status));
          return <Pill tone={meta.tone} size="small">{meta.label}</Pill>;
        },
      },
    ],
    [],
  );

  function goToProductHistory(productId) {
    navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases/${productId}/all`, {
      state: { fromSalesPurchases: true },
    });
  }

  // This page is reached from the dealer's profile and from the Sales list.
  // When we know which, go back through browser history so that page returns
  // exactly as it was left (filters, scroll, and the profile's own way back to
  // the dealers list). Opened any other way - a pasted link, a refresh - there
  // is no history to trust, so the dealer's profile is the sensible parent.
  const cameFromSales = Boolean(location.state?.fromSalesList);
  const cameFromProfile = Boolean(location.state?.fromDealerProfile);

  function goBack() {
    if (cameFromSales || cameFromProfile) navigate(-1);
    else navigate(`/admin/dashboard/dealers/${dealerId}`);
  }

  function openHistoryEvent(event) {
    if (event.type === "sale") setPreviewSale(event.sale);
    else setPreviewOrder(event.order);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <button
        type="button"
        onClick={goBack}
        className="admin-sp-back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {cameFromSales ? "Back to Sales" : "Back to Dealer Profile"}
      </button>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer?.companyName || "Dealer"}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Sales &amp; Purchases
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view === "sales" || view === "history" ? (
              <DateRangeControl
                from={filterFrom}
                to={filterTo}
                onApply={(from, to) => {
                  setFilterFrom(from);
                  setFilterTo(to);
                  setHistoryPage(1);
                }}
                onClear={() => {
                  setFilterFrom("");
                  setFilterTo("");
                  setHistoryPage(1);
                }}
              />
            ) : null}
            {view === "sales" ? (
              <div style={{ width: 220 }}>
                <SearchField value={search} onChange={setSearch} placeholder="Search products…" />
              </div>
            ) : null}
            <GhostButton
              icon="download"
              onClick={view === "stock" ? handleExportStock : view === "history" ? handleExportHistory : handleExport}
              disabled={view === "stock" ? sortedStockRows.length === 0 : view === "history" ? historyEvents.length === 0 : sortedProductRows.length === 0}
            >
              Export
            </GhostButton>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SegmentedControl
            options={[
              { key: "history", label: "Sales & Purchases" },
              { key: "sales", label: "By Product" },
              { key: "stock", label: "Stock" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </Surface>

      {loadError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      ) : null}

      {view === "sales" ? (
        <Surface key="sales" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="chart"
            title="By Product"
            subtitle={hasDateFilter ? `Purchase, scheme, and sale totals for ${dateLabel}.` : "Lifetime purchase, scheme, and sale totals, per product."}
            action={inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={productColumns}
              rows={sortedProductRows}
              getRowKey={(row) => row.productId}
              onRowClick={(row) => goToProductHistory(row.productId)}
              loading={inventoryQuery.isLoading && !inventoryQuery.data}
              renderGroupHeader={(row) => {
                const group = productGroupHeaderByFirstId.get(row.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={productFooter}
              emptyState={{
                icon: "chart",
                title: rows.length === 0 ? "No purchases yet" : "No matching products",
                subtitle: rows.length === 0 ? "This dealer hasn't received any delivered orders yet." : "Try a different search term.",
              }}
            />
          </div>
        </Surface>
      ) : view === "history" ? (
        <Surface key="history" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="overview"
            title="Sales & Purchases"
            subtitle={hasDateFilter ? `Every purchase and sale for ${dateLabel}.` : "Every individual sale and purchase order for this dealer, newest first."}
            action={historyFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={historyColumns}
              rows={historyVisibleEvents}
              getRowKey={(event) => event.key}
              onRowClick={openHistoryEvent}
              loading={historyLoading}
              renderGroupHeader={(event) => {
                const group = historyGroupHeaderByKey.get(event.key);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="record" />;
              }}
              emptyState={{
                icon: "overview",
                title: "No activity yet",
                subtitle: hasDateFilter ? "Nothing happened in this date range." : "This dealer hasn't ordered or sold anything yet.",
              }}
            />
          </div>

          {!historyLoading && historyEvents.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <Pagination page={historyCurrentPage} totalPages={historyTotalPages} totalCount={historyEvents.length} itemLabel="entries" onChange={setHistoryPage} />
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface key="stock" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="stock"
            title="Stock"
            subtitle="Live on-hand stock, per product - not affected by the date filter."
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {stockSummary.lowStockCount > 0 ? <Pill tone="caution" size="small">{stockSummary.lowStockCount} low</Pill> : null}
                {stockSummary.outOfStockCount > 0 ? <Pill tone="critical" size="small">{stockSummary.outOfStockCount} out</Pill> : null}
                {inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              </div>
            }
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={stockColumns}
              rows={sortedStockRows}
              getRowKey={(item) => item.productId}
              loading={inventoryQuery.isLoading && !inventoryQuery.data}
              renderGroupHeader={(item) => {
                const group = stockGroupHeaderByFirstId.get(item.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={stockFooter}
              emptyState={{ icon: "stock", title: "No stock yet", subtitle: "This dealer hasn't received any delivered orders yet." }}
            />
          </div>
        </Surface>
      )}

      <HistoryOrderPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      <HistorySaleDetailModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      <style>{`
        .admin-sp-back{
          display:inline-flex;
          align-items:center;
          gap:4px;
          border:none;
          background:transparent;
          padding:0;
          cursor:pointer;
          color:var(--color-azure, #0071e3);
          font-size:14.5px;
          font-weight:600;
          width:fit-content;
        }

        .admin-sp-daterange{
          position:relative;
          display:flex;
          align-items:center;
        }
        .admin-sp-daterange-trigger{
          display:inline-flex;
          align-items:center;
          gap:7px;
          height:38px;
          padding:0 14px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.1);
          background:rgba(255,255,255,.88);
          color:var(--color-ink, #1d1d1f);
          font-size:12.5px;
          font-weight:600;
          white-space:nowrap;
          cursor:pointer;
          transition:transform .14s var(--ease-out, cubic-bezier(.23,1,.32,1)), background .14s ease, border-color .14s ease, color .14s ease;
        }
        .admin-sp-daterange-trigger:hover{
          background:rgba(29,29,31,.05);
        }
        .admin-sp-daterange-trigger:active{
          transform:scale(.97);
        }
        .admin-sp-daterange-trigger.is-active{
          border-color:rgba(0,113,227,.32);
          background:rgba(0,113,227,.08);
          color:var(--color-azure, #0071e3);
          padding-right:30px;
        }
        .admin-sp-daterange-clear{
          position:absolute;
          right:6px;
          top:50%;
          transform:translateY(-50%);
          width:22px;
          height:22px;
          border-radius:999px;
          border:none;
          background:rgba(0,113,227,.14);
          color:var(--color-azure, #0071e3);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .12s ease, transform .12s var(--ease-out, ease);
        }
        .admin-sp-daterange-clear:hover{
          background:rgba(0,113,227,.24);
        }
        .admin-sp-daterange-clear:active{
          transform:translateY(-50%) scale(.88);
        }

        .admin-sp-filter-pop{
          z-index:1401;
          padding:14px;
          border-radius:16px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top left;
          animation:adminSpFilterPopIn .16s var(--ease-out, cubic-bezier(.16,1,.3,1)) both;
        }
        @keyframes adminSpFilterPopIn{
          from{ opacity:0; transform:scale(.96) translateY(-4px); }
          to{ opacity:1; transform:scale(1) translateY(0); }
        }
        .admin-sp-filter-presets{
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin-bottom:12px;
        }
        .admin-sp-filter-presets button{
          height:30px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.1);
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
          font-size:12px;
          font-weight:600;
          cursor:pointer;
          transition:background .12s ease, transform .1s ease;
        }
        .admin-sp-filter-presets button:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .admin-sp-filter-presets button:active{
          transform:scale(.95);
        }
        .admin-sp-filter-pop-title{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
          margin-bottom:10px;
          padding-top:10px;
          border-top:1px solid rgba(0,0,0,.06);
        }
        .admin-sp-filter-field{
          display:grid;
          gap:4px;
          margin-bottom:10px;
        }
        .admin-sp-filter-field span{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-sp-filter-pop-error{
          margin:-2px 0 10px;
          font-size:11px;
          font-weight:600;
          color:#b42318;
        }
        .admin-sp-filter-pop-actions{
          margin-top:4px;
        }

        @media (prefers-reduced-motion: reduce){
          .admin-sp-daterange-trigger{ transition:none!important; }
          .admin-sp-filter-pop{ animation:none!important; }
        }

        /* ---- Section (category/day) headers inside the data tables ----
           DataTable's own default group-row styling (small muted-gray
           caption text, transparent background) reads as a footnote, not a
           section break - fine for a handful of groups, unreadable once a
           dealer's catalog spans many categories. This overrides it with a
           full-width shaded band, bold ink-colored label, and a clear count
           badge - scoped to .admin-sp-datatable so no other page's tables
           are affected. */
        .admin-sp-datatable .dash-table-group-row td{
          padding:0 !important;
          background:transparent;
        }
        .admin-sp-group-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:11px 16px;
          margin-top:14px;
          background:var(--color-fog, #f5f5f7);
          border-top:1px solid rgba(0,0,0,.06);
          border-bottom:1px solid rgba(0,0,0,.06);
          font-size:12.5px;
          font-weight:800;
          letter-spacing:-.005em;
          color:var(--color-ink, #1d1d1f);
        }
        .admin-sp-datatable .dash-table-group-row:first-child .admin-sp-group-header{
          margin-top:0;
          border-top:none;
        }
        .admin-sp-group-count{
          flex-shrink:0;
          padding:2px 9px;
          border-radius:999px;
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
          font-size:11px;
          font-weight:700;
          letter-spacing:0;
        }
      `}</style>
    </div>
  );
}
