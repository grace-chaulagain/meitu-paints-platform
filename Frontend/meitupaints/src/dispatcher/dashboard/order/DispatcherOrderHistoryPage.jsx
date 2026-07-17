import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  useGetDispatcherReplenishmentOrderQuery,
  useGetDispatcherReplenishmentOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { formatMoney } from "../../../dealer/pricing.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import {
  OrderDetailStyles,
  OrderInfoCard,
  OrderItemsTable,
  OrderMilestoneStepper,
  OrderSummaryCard,
  Spinner,
} from "../../../dealer/orderDetailUI.jsx";
import { AppleDateField } from "../../../components/dashboard/ApplePickers.jsx";
import {
  DISPLAY_BUCKET_META,
  formatDate,
  formatTime,
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
  statusLabel,
} from "../../../dealer/orderDetailLogic.js";

const PAGE_SIZE = 10;

const ORDER_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ALL", label: "All Orders" },
];

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

function orderWithinDateRange(order, bounds) {
  if (!bounds.from && !bounds.to) return true;
  const created = new Date(order.createdAt);
  if (bounds.from && created < bounds.from) return false;
  if (bounds.to && created > bounds.to) return false;
  return true;
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

function OrderThumbnails({ items, productsMap, familyMap }) {
  const visible = items.slice(0, 4);
  const overflow = items.length - visible.length;

  if (!visible.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {visible.map((item, index) => {
        const image = resolveOrderItemImage(item, productsMap, familyMap);
        return (
          <div key={`${item.sku || item.code || "item"}-${index}`} className="dealer-order-thumb">
            {image?.url ? (
              <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <DashboardIcon name="package" size={16} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
            )}
          </div>
        );
      })}
      {overflow > 0 ? <div className="dealer-order-thumb dealer-order-thumb-more">+{overflow}</div> : null}
    </div>
  );
}

function OrderTimelineRow({ order, onOpen, productsMap, familyMap }) {
  const status = normalizeStatus(order.status);
  const bucket = orderDisplayBucket(status);
  const meta = DISPLAY_BUCKET_META[bucket];
  const pillLabel = meta.pillLabel || statusLabel(status);
  const items = Array.isArray(order.items) ? order.items : [];
  const stateClass = bucket === "COMPLETED" ? "is-completed" : bucket === "REJECTED" ? "is-rejected" : "is-pending";

  return (
    <div className={`dealer-order-timeline-row ${stateClass}`}>
      <span className="dealer-order-marker" style={{ "--marker-color": meta.color, "--marker-bg": meta.bg }} aria-hidden="true">
        <DashboardIcon name={meta.icon} size={13} strokeWidth={2.4} />
      </span>

      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(order)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(order);
          }
        }}
        className="dash-selectable-row dealer-order-card"
      >
        <div className="dealer-order-card-top">
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="dealer-order-number">{order.orderNumber || "Unnamed Order"}</span>
            <Pill tone={meta.pillTone} size="small">{pillLabel}</Pill>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span className="dealer-order-amount">{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
            <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)" }} />
          </div>
        </div>

        <div className="dealer-order-meta">
          {formatTime(order.createdAt)} · {items.length} {items.length === 1 ? "item" : "items"}
        </div>

        <div className="dealer-order-card-bottom">
          <OrderThumbnails items={items} productsMap={productsMap} familyMap={familyMap} />
          <div className="dealer-order-state-copy">
            {bucket === "PENDING" ? (
              <>
                <Spinner size={26} color={meta.color} />
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>Processing</span>
              </>
            ) : (
              <>
                <DashboardIcon name={meta.icon} size={12} strokeWidth={2.4} style={{ color: meta.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.stateLabel}</span>
                <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{formatDate(order.updatedAt || order.createdAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const IconButton = forwardRef(function IconButton({ icon, onClick, active = false, label }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="dealer-order-icon-btn"
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

function FilterMenu({ options, value, onChange, dateFrom, dateTo, onApplyDate, onClearDate }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const dateActive = Boolean(dateFrom || dateTo);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, left: Math.max(12, rect.right - 260) });
  }

  function toggleOpen() {
    setOpen((current) => {
      if (!current) {
        setDraftFrom(dateFrom);
        setDraftTo(dateTo);
      }
      return !current;
    });
  }

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      if (event.target.closest?.(".apple-calendar-pop")) return;
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

  function applyDate() {
    onApplyDate({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  function clearDate() {
    setDraftFrom("");
    setDraftTo("");
    onClearDate();
  }

  return (
    <>
      <IconButton
        ref={buttonRef}
        icon="filter"
        active={open || value !== "ALL" || dateActive}
        onClick={() => {
          toggleOpen();
          requestAnimationFrame(updatePosition);
        }}
        label="Filter orders"
      />
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: 260,
                background: "#fff",
                borderRadius: 14,
                border: "1px solid rgba(29,29,31,.08)",
                boxShadow: "0 12px 32px rgba(29,29,31,.16)",
                padding: 6,
                zIndex: 1300,
              }}
            >
              {options.map((option) => {
                const active = option.key === value;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChange(option.key);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 9,
                      border: "none",
                      background: active ? "rgba(0,113,227,.08)" : "transparent",
                      color: active ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)",
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{option.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-graphite, #707070)" }}>{option.count}</span>
                  </button>
                );
              })}

              <div className="dealer-order-filter-divider" />

              <div className="dealer-order-filter-date-title">
                <DashboardIcon name="calendar" size={12} strokeWidth={1.9} />
                Date range
              </div>

              <label className="dealer-order-filter-date-field">
                <span>From</span>
                <AppleDateField value={draftFrom || ""} onChange={setDraftFrom} />
              </label>

              <label className="dealer-order-filter-date-field">
                <span>To</span>
                <AppleDateField value={draftTo || ""} onChange={setDraftTo} />
              </label>

              <div className="dealer-order-filter-date-actions">
                <GhostButton onClick={clearDate}>Clear</GhostButton>
                <PrimaryButton onClick={applyDate} disabled={!draftFrom && !draftTo} style={{ height: 34, padding: "0 14px", fontSize: 12.5 }}>
                  Apply
                </PrimaryButton>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function OrderStatusTabs({ options, value, onChange }) {
  return (
    <div className="dealer-order-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button key={option.key} type="button" role="tab" data-status={option.key} aria-selected={active} onClick={() => onChange(option.key)} className={`dealer-order-tab ${active ? "is-active" : ""}`}>
            <span>{option.label}</span>
            <span className="dealer-order-tab-count">{option.count}</span>
          </button>
        );
      })}
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
        Showing {start} to {end} of {totalCount} orders
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="dealer-order-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`dealer-order-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              …
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="dealer-order-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

// No routed detail page exists for a dispatcher's own replenishment orders
// (unlike DealerOrderDetailPage.jsx) - a modal built from the same shared
// dealer/orderDetailUI.jsx pieces (milestone stepper, items table, summary
// cards) keeps this page's detail view visually identical without adding a
// new route nobody asked for.
function ReplenishmentOrderModal({ orderId, onClose, productsMap, familyMap }) {
  const orderQuery = useGetDispatcherReplenishmentOrderQuery(orderId, { skip: !orderId });
  const order = orderQuery.data?.item;

  if (!orderId) return null;

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(760px, 100%)", maxHeight: "92vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        {orderQuery.isLoading || !order ? (
          <div style={{ height: 240, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <SectionHeader eyebrow="Order" icon="package" title={order.orderNumber || "Order"} subtitle={`Placed ${formatDate(order.createdAt)}`} />
              <CloseButton onClick={onClose} />
            </div>

            <OrderMilestoneStepper order={order} />

            <OrderItemsTable items={order.items || []} productsMap={productsMap} familyMap={familyMap} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <OrderInfoCard order={order} />
              <OrderSummaryCard order={order} />
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}

export default function DispatcherOrderHistoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const resultsRef = useRef(null);

  const visibleParams = useMemo(() => {
    const params = { limit: 100 };
    if (committedSearch.trim()) params.q = committedSearch.trim();
    return params;
  }, [committedSearch]);

  const countsQuery = useGetDispatcherReplenishmentOrdersQuery({ limit: 100 });
  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery(visibleParams);
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const allOrders = useMemo(
    () => (countsQuery.data?.items || []).map((item) => ({ ...item, status: normalizeStatus(item?.status) })),
    [countsQuery.data],
  );

  const dateBounds = useMemo(() => ({ from: startOfDayFromInput(dateFrom), to: endOfDayFromInput(dateTo) }), [dateFrom, dateTo]);

  const dateFilteredAllOrders = useMemo(() => allOrders.filter((item) => orderWithinDateRange(item, dateBounds)), [allOrders, dateBounds]);

  const visibleOrders = useMemo(
    () =>
      (ordersQuery.data?.items || [])
        .map((item) => ({ ...item, status: normalizeStatus(item?.status) }))
        .filter((item) => {
          if (statusFilter !== "ALL" && orderDisplayBucket(item.status) !== statusFilter) return false;
          return orderWithinDateRange(item, dateBounds);
        }),
    [ordersQuery.data, statusFilter, dateBounds],
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

  const loading = (countsQuery.isLoading && allOrders.length === 0) || (ordersQuery.isLoading && visibleOrders.length === 0);
  const isRefreshing = !loading && (countsQuery.isFetching || ordersQuery.isFetching);
  const queryError = ordersQuery.error || countsQuery.error;
  const error = queryError ? getQueryErrorMessage(queryError, "Failed to load your order history.") : "";

  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedOrders = useMemo(() => visibleOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visibleOrders, currentPage]);

  function goToPage(nextPage) {
    setPage(nextPage);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function submitSearch() {
    setCommittedSearch(search);
    setPage(1);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetFilters() {
    setSearch("");
    setCommittedSearch("");
    setSearchOpen(false);
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function changeStatusFilter(nextFilter) {
    setStatusFilter(nextFilter);
    setPage(1);
  }

  function applyDateFilter({ from, to }) {
    setDateFrom(from || "");
    setDateTo(to || "");
    setPage(1);
  }

  function clearDateFilter() {
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const countsByFilter = useMemo(() => {
    return {
      ALL: dateFilteredAllOrders.length,
      PENDING: dateFilteredAllOrders.filter((o) => orderDisplayBucket(o.status) === "PENDING").length,
      COMPLETED: dateFilteredAllOrders.filter((o) => orderDisplayBucket(o.status) === "COMPLETED").length,
    };
  }, [dateFilteredAllOrders]);

  const filterOptions = ORDER_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }));
  const groupedOrders = useMemo(() => groupOrdersByDay(pagedOrders), [pagedOrders]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={18} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <SectionHeader
            icon="history"
            title="My Order History"
            subtitle="Track every order you've placed with the Factory, from submission through delivery."
            action={isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {searchOpen ? (
              <div style={{ width: 240 }}>
                <SearchField value={search} onChange={setSearch} onSubmit={submitSearch} placeholder="Search order number, payment, notes…" />
              </div>
            ) : null}
            <IconButton
              icon={searchOpen ? "close" : "search"}
              active={searchOpen}
              onClick={() => {
                if (searchOpen && committedSearch) {
                  setSearch("");
                  setCommittedSearch("");
                  setPage(1);
                }
                setSearchOpen((v) => !v);
              }}
              label={searchOpen ? "Close search" : "Search orders"}
            />
            <FilterMenu
              options={filterOptions}
              value={statusFilter}
              onChange={changeStatusFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApplyDate={applyDateFilter}
              onClearDate={clearDateFilter}
            />
            <PrimaryButton icon="plus" onClick={() => navigate("/dispatcher/dashboard/order")}>New Order</PrimaryButton>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <OrderStatusTabs options={filterOptions} value={statusFilter} onChange={changeStatusFilter} />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      <div ref={resultsRef} style={{ scrollMarginTop: 16, display: "grid", gap: 16 }}>
        {loading ? (
          <Surface padding={18}>
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          </Surface>
        ) : visibleOrders.length === 0 ? (
          <Surface padding={20}>
            <EmptyState icon="orders" title="No orders found" subtitle="Try adjusting the search or status filters." />
            <div style={{ marginTop: 4 }}>
              <GhostButton onClick={resetFilters}>Clear filters</GhostButton>
            </div>
          </Surface>
        ) : (
          <>
            <div className="dealer-order-timeline">
              {groupedOrders.map((group) => (
                <div key={group.key} className="dealer-order-timeline-day">
                  <div className="dealer-order-timeline-day-header">
                    <div className="dealer-order-timeline-day-label">
                      {group.relativeLabel ? (
                        <>
                          <strong>{group.relativeLabel}</strong>
                          <span className="dealer-order-timeline-day-sep">•</span>
                          <span>{group.dateText}</span>
                        </>
                      ) : (
                        <strong>{group.dateText}</strong>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    {group.orders.map((order) => (
                      <OrderTimelineRow key={order._id} order={order} onOpen={(item) => setSelectedOrderId(item._id)} productsMap={productsMap} familyMap={familyMap} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={currentPage} totalPages={totalPages} totalCount={visibleOrders.length} pageSize={PAGE_SIZE} onChange={goToPage} />
          </>
        )}
      </div>

      <ReplenishmentOrderModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} productsMap={productsMap} familyMap={familyMap} />

      <OrderDetailStyles />

      <style>{`
        .dealer-order-filter-divider{ height:1px; margin:6px 4px; background:rgba(29,29,31,.08); }
        .dealer-order-filter-date-title{ display:flex; align-items:center; gap:6px; padding:6px 10px 4px; font-size:11px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; color:var(--color-graphite, #707070); }
        .dealer-order-filter-date-field{ display:grid; gap:4px; padding:4px 10px; }
        .dealer-order-filter-date-field span{ font-size:10.5px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; color:var(--color-graphite, #707070); }
        .dealer-order-filter-date-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:10px 6px 4px; }

        .dealer-order-tabs{ display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid rgba(29,29,31,.1); overflow-x:auto; scrollbar-width:none; }
        .dealer-order-tabs::-webkit-scrollbar{ display:none; }
        .dealer-order-tab{ min-width:max-content; display:flex; align-items:center; gap:10px; padding:12px 18px 15px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; white-space:nowrap; }
        .dealer-order-tab span:first-child{ font-size:13.5px; font-weight:650; color:var(--color-graphite, #707070); }
        .dealer-order-tab-count{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:750; background:rgba(29,29,31,.06); color:var(--color-graphite, #707070); }
        .dealer-order-tab.is-active{ --tab-accent:var(--color-azure, #0071e3); border-bottom-color:var(--tab-accent); }
        .dealer-order-tab[data-status="COMPLETED"].is-active{ --tab-accent:#2fb344; }
        .dealer-order-tab.is-active span:first-child{ color:var(--tab-accent); font-weight:700; }
        .dealer-order-tab.is-active .dealer-order-tab-count{ background:color-mix(in srgb, var(--tab-accent) 12%, transparent); color:var(--tab-accent); }

        .dealer-order-timeline{ position:relative; display:grid; gap:26px; }
        .dealer-order-timeline-day{ position:relative; display:grid; gap:14px; }
        .dealer-order-timeline-day-header{ position:relative; display:grid; grid-template-columns:32px 1fr; align-items:center; column-gap:14px; }
        .dealer-order-timeline-day-label{ grid-column:2; display:flex; align-items:center; font-size:12.5px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .dealer-order-timeline-day-label strong{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .dealer-order-timeline-day-sep{ margin:0 8px; opacity:.5; }

        .dealer-order-timeline-row{ position:relative; display:grid; grid-template-columns:32px 1fr; column-gap:14px; align-items:center; }
        .dealer-order-marker{ position:relative; z-index:1; justify-self:center; width:24px; height:24px; border-radius:999px; display:grid; place-items:center; background:var(--marker-bg); color:var(--marker-color); border:2px solid #fff; box-shadow:0 0 0 1px rgba(29,29,31,.08); flex-shrink:0; }
        .dealer-order-timeline-row.is-completed .dealer-order-marker{ background:#2fb344; color:#fff; }
        .dealer-order-timeline-row.is-rejected .dealer-order-marker{ background:#b42318; color:#fff; }
        .dealer-order-timeline-row.is-pending .dealer-order-marker{ background:#fff; border-color:var(--color-azure, #0071e3); color:var(--color-azure, #0071e3); box-shadow:0 0 0 1px rgba(0,113,227,.2); }

        .dealer-order-card{ border-radius:16px; border:1px solid rgba(29,29,31,.08); background:#fff; padding:20px 22px; cursor:pointer; box-shadow:0 12px 32px rgba(29,29,31,.06); transition:box-shadow .18s ease, transform .16s ease, border-color .16s ease; }
        .dealer-order-card:hover{ transform:translateY(-1px); box-shadow:0 16px 42px rgba(29,29,31,.09); border-color:rgba(0,113,227,.18); }
        .dealer-order-card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
        .dealer-order-number{ font-size:15px; font-weight:760; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
        .dealer-order-amount{ font-size:15px; font-weight:760; color:var(--color-ink, #1d1d1f); white-space:nowrap; }
        .dealer-order-meta{ margin-top:5px; font-size:12px; color:var(--color-graphite, #707070); }
        .dealer-order-card-bottom{ margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .dealer-order-state-copy{ display:flex; align-items:center; gap:7px; flex-shrink:0; }

        .dealer-order-page-btn{ min-width:32px; height:32px; padding:0 8px; border-radius:8px; border:none; background:transparent; font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .dealer-order-page-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .dealer-order-page-btn.is-active{ background:var(--color-azure, #0071e3); color:#fff; }
        .dealer-order-page-btn:not(.is-active):not(:disabled):hover{ background:rgba(29,29,31,.06); }

        @media (max-width:760px){
          .dealer-order-tab{ padding-left:10px; padding-right:10px; }
          .dealer-order-card{ padding:16px; }
          .dealer-order-card-top{ align-items:flex-start; }
          .dealer-order-thumb{ width:46px; height:46px; }
        }

        @media (max-width:560px){
          .dealer-order-timeline-row,
          .dealer-order-timeline-day-header{
            grid-template-columns:24px 1fr;
            column-gap:10px;
          }
          .dealer-order-marker{ width:22px; height:22px; }
          .dealer-order-card-top{ flex-direction:column; }
          .dealer-order-card-bottom{ align-items:flex-start; }
          .dealer-order-state-copy{ width:100%; justify-content:flex-start; }
        }
      `}</style>
    </div>
  );
}
