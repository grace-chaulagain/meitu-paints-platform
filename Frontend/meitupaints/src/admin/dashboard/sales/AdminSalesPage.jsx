import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import {
  useGetAdminDealersQuery,
  useGetAdminSalesQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All sales" },
  { key: "COMPLETED", label: "Completed" },
  { key: "VOIDED", label: "Voided" },
];

const DEALER_PAGE_SIZE = 6;

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value) {
  if (!value) return "No sale yet";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFilterDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDealerName(summary) {
  return (
    summary?.dealer?.companyName ||
    summary?.dealer?.contactName ||
    "Unnamed Dealer"
  );
}

function getDealerContact(summary) {
  return summary?.dealer?.contactName || summary?.dealer?.email || "No contact";
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

// "up" isn't always good news - a rising Voided count is bad, so the tile
// that shows it passes invert=true to flip the color read without changing
// the underlying direction math.
function TrendBadge({ trend, invert = false }) {
  const { percent = 0, direction = "flat" } = trend || {};
  const isGood = direction === "flat" ? null : invert ? direction === "down" : direction === "up";
  const color = isGood === null ? "var(--color-graphite, #707070)" : isGood ? "#15803d" : "#b42318";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "•";

  return (
    <span className="admin-sales-trend" style={{ color }}>
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(percent).toFixed(1)}%
      <span className="admin-sales-trend-label">vs last 30 days</span>
    </span>
  );
}

function SalesMetricTile({ label, value, icon, iconColor, iconBg, trend, invertTrend = false }) {
  return (
    <div className="admin-sales-metric-tile">
      <div className="admin-sales-metric-icon" style={{ background: iconBg, color: iconColor }}>
        <DashboardIcon name={icon} size={18} strokeWidth={1.9} />
      </div>
      <div className="admin-sales-metric-label">{label}</div>
      <div className="admin-sales-metric-value">{value}</div>
      <TrendBadge trend={trend} invert={invertTrend} />
    </div>
  );
}

// Self-contained trigger button + portal popover, mirroring the DateFilter
// pattern already established on the Dealer Sales & Purchases page: the
// component that owns the trigger ref also owns "open" and computes the
// popover's position inside the click handler that opens it (a legitimate
// event-handler context) rather than in an effect, avoiding both a
// setState-in-effect and a read-ref-during-render issue. The effect below
// only subscribes to resize/scroll/Escape for an *already-open* popover.
function SalesFiltersControl({ activeFilterCount, dateFrom, dateTo, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const viewportPadding = 12;
    const left = Math.min(Math.max(viewportPadding, rect.right - width), window.innerWidth - width - viewportPadding);
    const top = rect.bottom + 8;
    setPosition({ left, top, width });
  }, []);

  function closePopover() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPopover() {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
    updatePosition();
    setOpen(true);
  }

  function apply() {
    onApply(draftFrom, draftTo);
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
        className={`admin-sales-filters-btn ${activeFilterCount > 0 ? "is-active" : ""}`}
      >
        <DashboardIcon name="filter" size={14} strokeWidth={1.9} />
        Filters
        {activeFilterCount > 0 ? <span className="admin-sales-filters-badge">{activeFilterCount}</span> : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={closePopover} />
              <div
                className="admin-sales-filter-pop"
                role="dialog"
                aria-label="Filter by date range"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-sales-filter-pop-title">
                  <DashboardIcon name="calendar" size={13} strokeWidth={1.9} />
                  Filter by date range
                </div>

                <label className="admin-sales-filter-field">
                  <span>From</span>
                  <AppleDateField value={draftFrom || ""} onChange={setDraftFrom} />
                </label>
                <label className="admin-sales-filter-field">
                  <span>To</span>
                  <AppleDateField value={draftTo || ""} onChange={setDraftTo} />
                </label>

                <div className="admin-sales-filter-pop-actions">
                  <GhostButton onClick={clear}>Clear</GhostButton>
                  <PrimaryButton onClick={apply} disabled={!draftFrom && !draftTo} style={{ height: 34, padding: "0 14px", fontSize: 12.5 }}>
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

function SalesDealerCard({ summary, onOpen }) {
  const dealerName = getDealerName(summary);
  const initial = dealerName.trim().charAt(0).toUpperCase() || "D";

  return (
    <article className="admin-sales-dealer-card" onClick={onOpen}>
      <div className="admin-sales-dealer-top">
        <div className="admin-sales-avatar">{initial}</div>
        <div className="admin-sales-dealer-copy">
          <h3>{dealerName}</h3>
          <p>{getDealerContact(summary)}</p>
        </div>
        <button type="button" aria-label={`Open stock for ${dealerName}`}>
          <DashboardIcon name="chevron" size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="admin-sales-total">
        <span>Total sales</span>
        <strong>{formatMoney(summary.totalRevenue)}</strong>
      </div>

      <div className="admin-sales-meta">
        <span>
          <DashboardIcon name="orders" size={13} strokeWidth={2} />
          {Number(summary.completedCount || 0).toLocaleString()} completed
        </span>
        <span>
          <DashboardIcon name="warning" size={13} strokeWidth={2} />
          {Number(summary.voidedCount || 0).toLocaleString()} voided
        </span>
        <span>
          <DashboardIcon name="history" size={13} strokeWidth={2} />
          {formatDate(summary.latestSaleAt)}
        </span>
      </div>
    </article>
  );
}

function SalesListRow({ summary, onOpen }) {
  const dealerName = getDealerName(summary);
  const voided = Number(summary.voidedCount || 0);

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }} className="admin-sales-list-row">
      <div className="admin-sales-list-dealer">
        <Avatar label={dealerName} size={40} />
        <div style={{ minWidth: 0 }}>
          <div className="admin-sales-list-name">{dealerName}</div>
          <div className="admin-sales-list-contact">{getDealerContact(summary)}</div>
        </div>
      </div>
      <span className="admin-sales-list-value">{formatMoney(summary.totalRevenue)}</span>
      <span className="admin-sales-list-value">{Number(summary.completedCount || 0).toLocaleString()}</span>
      <span className="admin-sales-list-value" style={{ color: voided > 0 ? "#b42318" : "var(--color-graphite, #707070)" }}>
        {voided.toLocaleString()}
      </span>
      <span className="admin-sales-list-date">{formatDate(summary.latestSaleAt)}</span>
      <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
    </div>
  );
}

function DealerPagination({ page, totalPages, totalCount, onChange }) {
  if (totalCount === 0) return null;

  const start = (page - 1) * DEALER_PAGE_SIZE + 1;
  const end = Math.min(page * DEALER_PAGE_SIZE, totalCount);
  const pages = buildPageList(page, totalPages);

  return (
    <div className="admin-sales-pagination">
      <span>
        Showing {start} to {end} of {totalCount} results
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="admin-sales-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`admin-sales-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="admin-sales-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export default function AdminSalesPage() {
  const navigate = useNavigate();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [dealerId, setDealerId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dealerPage, setDealerPage] = useState(1);
  const [viewMode, setViewMode] = useState("list");

  const dealersQuery = useGetAdminDealersQuery({ limit: 200 });
  const dealerOptions = useMemo(() => {
    const dealers = dealersQuery.data?.items || [];
    return [
      { key: "ALL", label: "All dealers" },
      ...dealers.map((dealer) => ({
        key: dealer._id,
        label: dealer.companyName || dealer.contactName || "Dealer",
      })),
    ];
  }, [dealersQuery.data]);

  const salesQuery = useGetAdminSalesQuery({
    q: query,
    dealerId: dealerId === "ALL" ? "" : dealerId,
    status,
    from: dateFrom || undefined,
    to: dateTo ? `${dateTo}T23:59:59.999` : undefined,
    dealerPage,
    dealerLimit: DEALER_PAGE_SIZE,
  });

  const summary = salesQuery.data?.summary || {
    totalCount: 0,
    completedCount: 0,
    voidedCount: 0,
    totalRevenue: 0,
    averageSaleValue: 0,
    trend: {},
  };
  const dealerSummaries = useMemo(
    () => salesQuery.data?.dealerSummaries || [],
    [salesQuery.data],
  );
  const dealerPagination = salesQuery.data?.dealerPagination || { page: 1, pages: 1, total: 0 };
  const loadError = salesQuery.error
    ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.")
    : "";

  const activeFilterCount = [
    dealerId !== "ALL",
    status !== "ALL",
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length;

  function openDealerSalesPurchases(summaryRow) {
    const id = summaryRow?.dealerId || summaryRow?.dealer?._id;
    if (!id) return;
    navigate(`/admin/dashboard/dealers/${id}/sales-purchases`);
  }

  function handleDealerChange(value) {
    setDealerId(value);
    setDealerPage(1);
  }

  function handleStatusChange(value) {
    setStatus(value);
    setDealerPage(1);
  }

  function handleSearchSubmit() {
    setQuery(draftQuery.trim());
    setDealerPage(1);
  }

  function applyDateFilter(from, to) {
    setDateFrom(from);
    setDateTo(to);
    setDealerPage(1);
  }

  function clearDateFilter() {
    setDateFrom("");
    setDateTo("");
    setDealerPage(1);
  }

  function handleExport() {
    const dateLabel = dateFrom || dateTo
      ? `${formatFilterDate(dateFrom) || "…"} – ${formatFilterDate(dateTo) || "…"}`
      : "All time";
    exportToCsv("admin-sales", [
      { key: "name", label: "Dealer", value: (row) => getDealerName(row) },
      { key: "contact", label: "Contact", value: (row) => getDealerContact(row) },
      { key: "totalRevenue", label: "Total Sales" },
      { key: "completedCount", label: "Completed" },
      { key: "voidedCount", label: "Voided" },
      { key: "latestSaleAt", label: "Last Sale", value: (row) => formatDate(row.latestSaleAt) },
      { key: "range", label: "Date Range", value: () => dateLabel },
    ], dealerSummaries);
  }

  return (
    <div className="admin-sales-page">
      <Surface padding={22} className="dash-fade-up admin-sales-hero">
        <SectionHeader
          icon="chart"
          title="Sales"
          subtitle="Track dealer sales performance across the Meitu network."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {salesQuery.isFetching ? (
                <Pill tone="accent" size="small">Updating…</Pill>
              ) : null}
              <GhostButton icon="download" onClick={handleExport} disabled={dealerSummaries.length === 0}>
                Export
              </GhostButton>
              <SalesFiltersControl
                activeFilterCount={activeFilterCount}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onApply={applyDateFilter}
                onClear={clearDateFilter}
              />
            </div>
          }
        />

        <div className="admin-sales-metrics">
          <SalesMetricTile
            label="Completed Sales"
            value={Number(summary.completedCount || 0).toLocaleString()}
            icon="checkSquare"
            iconBg="rgba(239,68,68,.12)"
            iconColor="#ef4444"
            trend={summary.trend?.completedCount}
          />
          <SalesMetricTile
            label="Total Revenue"
            value={formatMoney(summary.totalRevenue)}
            icon="chart"
            iconBg="rgba(0,113,227,.12)"
            iconColor="var(--color-azure, #0071e3)"
            trend={summary.trend?.totalRevenue}
          />
          <SalesMetricTile
            label="Average Sale"
            value={formatMoney(summary.averageSaleValue)}
            icon="trend"
            iconBg="rgba(147,51,234,.12)"
            iconColor="#9333ea"
            trend={summary.trend?.averageSaleValue}
          />
          <SalesMetricTile
            label="Voided Sales"
            value={Number(summary.voidedCount || 0).toLocaleString()}
            icon="warning"
            iconBg="rgba(245,158,11,.12)"
            iconColor="#f59e0b"
            trend={summary.trend?.voidedCount}
            invertTrend
          />
        </div>

        {loadError ? <div className="admin-sales-error">{loadError}</div> : null}
      </Surface>

      <Surface padding={22} className="dash-fade-up">
        <div className="admin-sales-toolbar">
          <div className="admin-sales-search">
            <SearchField
              value={draftQuery}
              onChange={setDraftQuery}
              onSubmit={handleSearchSubmit}
              placeholder="Search sale number…"
            />
          </div>
          <AppleDropdown value={dealerId} options={dealerOptions} onChange={handleDealerChange} />
          <AppleDropdown value={status} options={STATUS_OPTIONS} onChange={handleStatusChange} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {salesQuery.isLoading && !salesQuery.data ? (
          <div className="admin-sales-skeleton" style={{ marginTop: 16 }} />
        ) : dealerSummaries.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState
              icon="orders"
              title="No dealer sales found"
              subtitle="Try adjusting the search, dealer, status, or date filters."
            />
          </div>
        ) : viewMode === "list" ? (
          <div className="admin-sales-list" style={{ marginTop: 16 }}>
            <div className="admin-sales-list-row admin-sales-list-head">
              <span>Dealer</span>
              <span>Total Sales</span>
              <span>Completed</span>
              <span>Voided</span>
              <span>Date</span>
              <span />
            </div>
            {dealerSummaries.map((row) => (
              <SalesListRow key={String(row.dealerId)} summary={row} onOpen={() => openDealerSalesPurchases(row)} />
            ))}
          </div>
        ) : (
          <div className="admin-sales-grid dash-fade-up" style={{ marginTop: 16 }}>
            {dealerSummaries.map((row) => (
              <SalesDealerCard
                key={String(row.dealerId)}
                summary={row}
                onOpen={() => openDealerSalesPurchases(row)}
              />
            ))}
          </div>
        )}

        <DealerPagination
          page={dealerPagination.page}
          totalPages={dealerPagination.pages}
          totalCount={dealerPagination.total}
          onChange={setDealerPage}
        />
      </Surface>

      <style>{`
        .admin-sales-page{
          display:grid;
          gap:16px;
        }
        .admin-sales-hero{
          border-radius:30px !important;
          overflow:hidden;
          background:
            radial-gradient(circle at 92% 10%, rgba(0,113,227,.1), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,.98), rgba(245,245,247,.9)) !important;
        }
        .admin-sales-metrics{
          margin-top:16px;
          display:grid;
          grid-template-columns:repeat(4, minmax(0,1fr));
          gap:14px;
        }
        .admin-sales-metric-tile{
          display:grid;
          gap:8px;
          padding:18px;
          border-radius:20px;
          background:#fff;
          box-shadow:0 1px 2px rgba(0,0,0,.04), 0 10px 26px rgba(15,23,42,.07);
        }
        .admin-sales-metric-icon{
          width:38px;
          height:38px;
          border-radius:12px;
          display:grid;
          place-items:center;
        }
        .admin-sales-metric-label{
          font-size:12.5px;
          font-weight:650;
          color:var(--color-graphite,#707070);
        }
        .admin-sales-metric-value{
          font-size:24px;
          font-weight:800;
          letter-spacing:-.03em;
          color:var(--color-ink,#1d1d1f);
        }
        .admin-sales-trend{
          display:flex;
          align-items:center;
          gap:4px;
          font-size:12px;
          font-weight:700;
        }
        .admin-sales-trend-label{
          color:var(--color-graphite,#707070);
          font-weight:500;
        }
        .admin-sales-error{
          margin-top:14px;
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          font-size:13px;
          font-weight:600;
        }
        .admin-sales-filters-btn{
          position:relative;
          display:inline-flex;
          align-items:center;
          gap:6px;
          height:40px;
          padding:0 15px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.1);
          background:rgba(255,255,255,.88);
          color:var(--color-ink, #1d1d1f);
          font-size:13px;
          font-weight:700;
          cursor:pointer;
          transition:transform .14s var(--ease-out, ease), background .14s ease, border-color .14s ease;
        }
        .admin-sales-filters-btn:hover{
          background:rgba(29,29,31,.05);
        }
        .admin-sales-filters-btn:active{
          transform:scale(.96);
        }
        .admin-sales-filters-btn.is-active{
          border-color:rgba(180,35,24,.28);
        }
        .admin-sales-filters-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:18px;
          height:18px;
          padding:0 5px;
          border-radius:999px;
          background:#e11d48;
          color:#fff;
          font-size:10.5px;
          font-weight:800;
        }
        .admin-sales-filter-pop{
          z-index:1401;
          padding:14px;
          border-radius:16px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top right;
          animation:adminSalesFilterPopIn .15s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminSalesFilterPopIn{
          from{ opacity:0; transform:scale(.96); }
          to{ opacity:1; transform:scale(1); }
        }
        @media (prefers-reduced-motion: reduce){
          .admin-sales-filter-pop{ animation:none!important; }
        }
        .admin-sales-filter-pop-title{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          margin-bottom:10px;
        }
        .admin-sales-filter-field{
          display:grid;
          gap:4px;
          margin-bottom:10px;
        }
        .admin-sales-filter-field span{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-sales-filter-pop-actions{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:8px;
          margin-top:2px;
        }
        .admin-sales-toolbar{
          display:grid;
          grid-template-columns:minmax(220px, 1fr) 200px 160px auto;
          gap:10px;
          align-items:center;
        }
        .admin-sales-search{
          min-width:0;
        }
        .admin-sales-skeleton{
          height:260px;
          border-radius:14px;
          background:linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04));
        }
        .admin-sales-list{
          border-radius:16px;
          border:1px solid rgba(0,0,0,.06);
          overflow:hidden;
        }
        .admin-sales-list-row{
          display:grid;
          grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 20px;
          gap:14px;
          align-items:center;
          padding:14px 18px;
          cursor:pointer;
          transition:background-color .12s ease;
        }
        .admin-sales-list-row + .admin-sales-list-row{
          border-top:1px solid rgba(0,0,0,.06);
        }
        .admin-sales-list-head{
          background:var(--color-fog, #f5f5f7);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
          cursor:default;
        }
        .admin-sales-list-head:hover{
          background:var(--color-fog, #f5f5f7);
        }
        div[role="button"].admin-sales-list-row:hover{
          background:rgba(0,113,227,.045);
        }
        .admin-sales-list-dealer{
          display:flex;
          align-items:center;
          gap:12px;
          min-width:0;
        }
        .admin-sales-list-name{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .admin-sales-list-contact{
          margin-top:1px;
          font-size:11.5px;
          color:var(--color-graphite,#707070);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .admin-sales-list-value{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .admin-sales-list-date{
          font-size:12.5px;
          color:var(--color-graphite,#707070);
        }
        .admin-sales-pagination{
          margin-top:18px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          padding:6px 4px;
        }
        .admin-sales-pagination span{
          font-size:12.5px;
          color:var(--color-graphite, #707070);
        }
        .admin-sales-page-btn{
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
        .admin-sales-page-btn:disabled{
          opacity:.35;
          cursor:not-allowed;
        }
        .admin-sales-page-btn.is-active{
          background:var(--color-azure, #0071e3);
          color:#fff;
        }
        .admin-sales-page-btn:not(.is-active):not(:disabled):hover{
          background:rgba(29,29,31,.06);
        }
        .admin-sales-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr));
          gap:14px;
          align-items:start;
        }
        .admin-sales-dealer-card{
          border:1px solid rgba(29,29,31,.07);
          border-radius:28px;
          padding:16px;
          display:grid;
          gap:14px;
          cursor:pointer;
          background:
            radial-gradient(circle at 92% 8%, rgba(0,113,227,.07), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.92));
          transition:transform .18s ease, border-color .18s ease;
        }
        .admin-sales-dealer-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.2);
        }
        .admin-sales-dealer-top{
          display:grid;
          grid-template-columns:44px minmax(0,1fr) 34px;
          gap:12px;
          align-items:center;
        }
        .admin-sales-avatar{
          width:44px;
          height:44px;
          border-radius:16px;
          display:grid;
          place-items:center;
          color:var(--color-azure,#0071e3);
          background:rgba(0,113,227,.08);
          font-size:17px;
          font-weight:850;
          letter-spacing:-.03em;
        }
        .admin-sales-dealer-copy{
          min-width:0;
        }
        .admin-sales-dealer-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:17px;
          line-height:1.15;
          font-weight:850;
          letter-spacing:-.04em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .admin-sales-dealer-copy p{
          margin:4px 0 0;
          color:var(--color-graphite,#707070);
          font-size:12px;
          font-weight:650;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .admin-sales-dealer-top button{
          width:34px;
          height:34px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          cursor:pointer;
          color:var(--color-graphite,#707070);
          background:var(--color-fog,#f5f5f7);
        }
        .admin-sales-total{
          display:grid;
          gap:5px;
          padding:14px;
          border-radius:20px;
          background:var(--color-fog,#f5f5f7);
        }
        .admin-sales-total span{
          color:var(--color-graphite,#707070);
          font-size:10.5px;
          font-weight:800;
          letter-spacing:.07em;
          text-transform:uppercase;
        }
        .admin-sales-total strong{
          color:var(--color-ink,#1d1d1f);
          font-size:24px;
          line-height:1;
          font-weight:850;
          letter-spacing:-.055em;
        }
        .admin-sales-meta{
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:6px;
        }
        .admin-sales-meta span{
          min-height:26px;
          border-radius:999px;
          padding:0 9px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          color:var(--color-graphite,#707070);
          background:var(--color-fog,#f5f5f7);
          font-size:11px;
          font-weight:750;
        }
        @media (max-width:980px){
          .admin-sales-metrics{
            grid-template-columns:repeat(2, minmax(0,1fr));
          }
          .admin-sales-toolbar{
            grid-template-columns:1fr;
          }
          .admin-sales-list-row{
            grid-template-columns:minmax(0,1fr) auto;
            row-gap:6px;
          }
          .admin-sales-list-head{
            display:none;
          }
        }
        @media (max-width:560px){
          .admin-sales-metrics{
            grid-template-columns:1fr;
          }
          .admin-sales-total strong{
            font-size:21px;
          }
        }
      `}</style>
    </div>
  );
}
