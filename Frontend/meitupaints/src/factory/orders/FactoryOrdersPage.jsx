import { useMemo, useState } from "react";
import { useGetFactoryOrdersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  EmptyState,
  GhostButton,
  ListRow,
  Pill,
  SearchField,
  SectionHeader,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown, PopoverListMenu } from "../../components/dashboard/ApplePickers.jsx";
import { Toast } from "../../components/dashboard/Toast.jsx";
import { groupOrdersByDay } from "../../utils/orderDayGrouping.js";
import {
  factoryQueueTimestamp,
  money,
  orderMatchesLane,
  priorityForOrder,
  productCount,
  statusTone,
  timeAgo,
  titleCaseLabel,
  todayKey,
} from "../factoryHelpers.js";
import FactoryOrderModal from "./FactoryOrderModal.jsx";

const ORDER_LANES = [
  { key: "INBOX", label: "Inbox", icon: "inbox" },
  { key: "SHIPMENT", label: "Shipment", icon: "truck" },
  { key: "COMPLETED", label: "Completed", icon: "checkmark" },
  { key: "REJECTED", label: "Rejected", icon: "reject" },
];

const PRIORITY_OPTIONS = [
  { key: "ALL", label: "All priorities" },
  { key: "High", label: "High priority" },
  { key: "Medium", label: "Medium priority" },
  { key: "Normal", label: "Normal priority" },
];

// Same routing segments as the Admin Orders page's route filter
// (view=ARCHIVE&route=ALL), minus "Dispatcher Routed" (dealer orders
// fulfilled through a dispatcher rather than the factory directly) - the
// factory never dispatches those itself, only its own dealers' orders and
// dispatchers' own replenishment orders, so that option doesn't belong on
// this page. Applied server-side (fulfillmentMode/origin) rather than as a
// client-side filter, since the factory orders endpoint defaults to
// FACTORY-only otherwise.
const ROUTE_MODES = [
  { key: "ALL", label: "All" },
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER_REPLENISHMENT", label: "Dispatcher" },
];

function routeModeParams(routeMode) {
  if (routeMode === "FACTORY") return { fulfillmentMode: "FACTORY" };
  if (routeMode === "DISPATCHER_REPLENISHMENT") {
    return { fulfillmentMode: "ALL", origin: "DISPATCHER_REPLENISHMENT" };
  }
  return { fulfillmentMode: "ALL" };
}

const SORT_OPTIONS = [
  { key: "received-desc", label: "Newest first" },
  { key: "dealer", label: "Dealer name" },
  { key: "total-desc", label: "Highest total" },
  { key: "total-asc", label: "Lowest total" },
];

function FactoryOrderTabs({ options, value, onChange }) {
  return (
    <div className="factory-order-tabs" role="tablist" aria-label="Factory order states">
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
            className={`factory-order-tab ${active ? "is-active" : ""}`}
          >
            <span>{option.label}</span>
            <span className="factory-order-tab-count">{option.count || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function FactoryRouteMenu({ value, onChange }) {
  const selectedOption = ROUTE_MODES.find((option) => option.key === value) || ROUTE_MODES[0];

  return (
    <PopoverListMenu
      ariaLabel="Order routing"
      menuClassName="factory-route-menu"
      options={ROUTE_MODES}
      value={value}
      onChange={onChange}
      trigger={({ open, onClick, triggerRef }) => (
        <button
          type="button"
          ref={triggerRef}
          onClick={onClick}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="factory-route-menu-trigger"
        >
          <span>{selectedOption.label}</span>
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
          className={`factory-route-menu-row ${isSelected ? "is-selected" : isHighlighted ? "is-highlighted" : ""}`}
        >
          {option.label}
        </button>
      )}
    />
  );
}

function OrderRow({ order, onOpen }) {
  return (
    <ListRow onClick={() => onOpen(order._id)}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
            {order.dealerSnapshot?.companyName || "Dealer"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            #{order.orderNumber}
          </span>
          {order.orderOrigin === "DISPATCHER_REPLENISHMENT" ? (
            <Pill tone="accent" size="small">Dispatcher</Pill>
          ) : null}
        </div>
        <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <DashboardIcon name="stock" size={12} strokeWidth={1.8} />
            {productCount(order)} items
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <DashboardIcon name="history" size={12} strokeWidth={1.8} />
            {timeAgo(factoryQueueTimestamp(order))}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <DashboardIcon name="truck" size={12} strokeWidth={1.8} />
            {order.factory?.driverName || "No driver"}
          </span>
        </div>
      </div>
      <strong style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", flexShrink: 0 }}>
        {money(order.totals?.total, order.totals?.currency)}
      </strong>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <Pill tone={statusTone(order.status)} size="small">{titleCaseLabel(order.status)}</Pill>
        <Pill tone={priorityForOrder(order) === "High" ? "critical" : priorityForOrder(order) === "Medium" ? "caution" : "neutral"} size="small">
          {priorityForOrder(order)}
        </Pill>
      </div>
      <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
    </ListRow>
  );
}

export default function FactoryOrdersPage() {
  const [lane, setLane] = useState("INBOX");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [dealer, setDealer] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [routeMode, setRouteMode] = useState("FACTORY");
  const [sort, setSort] = useState("received-desc");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const listQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: query, limit: 100, ...routeModeParams(routeMode) });
  const allOrders = listQuery.data?.items || [];

  const counts = ORDER_LANES.reduce((acc, item) => {
    acc[item.key] = allOrders.filter((order) => orderMatchesLane(order, item.key)).length;
    return acc;
  }, {});

  const items = [...allOrders]
    .filter((order) => {
      if (!orderMatchesLane(order, lane)) return false;
      if (date && todayKey(order.createdAt) !== date) return false;
      if (dealer && !String(order.dealerSnapshot?.companyName || "").toLowerCase().includes(dealer.toLowerCase())) return false;
      if (priority !== "ALL" && priorityForOrder(order) !== priority) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "total-desc") return Number(b.totals?.total || 0) - Number(a.totals?.total || 0);
      if (sort === "total-asc") return Number(a.totals?.total || 0) - Number(b.totals?.total || 0);
      if (sort === "dealer") {
        return String(a.dealerSnapshot?.companyName || "").localeCompare(String(b.dealerSnapshot?.companyName || ""));
      }
      const diff = new Date(factoryQueueTimestamp(b) || 0) - new Date(factoryQueueTimestamp(a) || 0);
      return sortOrder === "asc" ? -diff : diff;
    });

  const groupedOrders = useMemo(() => groupOrdersByDay(items, factoryQueueTimestamp), [items]);

  const hasFilters = Boolean(
    query || draftQuery || date || dealer || priority !== "ALL" || routeMode !== "FACTORY" || sort !== "received-desc" || sortOrder !== "desc",
  );

  function toggleSortOrder() {
    setSort("received-desc");
    setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
  }

  function clearFilters() {
    setDraftQuery("");
    setQuery("");
    setDate("");
    setDealer("");
    setPriority("ALL");
    setRouteMode("FACTORY");
    setSort("received-desc");
    setSortOrder("desc");
  }

  const loadError = listQuery.error ? getQueryErrorMessage(listQuery.error, "Failed to load factory orders.") : "";

  // Both handlers close the order card and jump to the lane the order just
  // moved into - staying on a now-stale card (or one that's vanished from
  // the current lane's filter) would just confuse whoever dispatched it.
  // The toast is what carries the "yes, it worked" confirmation across that
  // transition, since it's rendered here rather than inside the modal that's
  // about to unmount.
  function handleDispatched(order) {
    setSelectedOrderId(null);
    setLane("SHIPMENT");
    setToast({
      tone: "success",
      title: "Order dispatched",
      description: `${order.orderNumber} moved to Shipment.`,
    });
  }

  function handleDelivered(order) {
    setSelectedOrderId(null);
    setLane("COMPLETED");
    setToast({
      tone: "success",
      title: "Order completed",
      description: `${order.orderNumber} marked delivered.`,
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Factory Order Queue"
          subtitle="Search, prepare, invoice, and dispatch factory-routed orders."
          action={listQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 16 }}>
          <FactoryOrderTabs
            options={ORDER_LANES.map((lane_) => ({ ...lane_, count: counts[lane_.key] || 0 }))}
            value={lane}
            onChange={setLane}
          />
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
            <SearchField
              value={draftQuery}
              onChange={setDraftQuery}
              onSubmit={() => setQuery(draftQuery.trim())}
              placeholder="Search order number or dealer…"
            />
          </div>
          <FactoryRouteMenu value={routeMode} onChange={setRouteMode} />
          <GhostButton onClick={toggleSortOrder}>
            <span
              style={{
                display: "inline-flex",
                transform: sortOrder === "asc" ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .22s var(--ease-out, ease)",
              }}
            >
              <DashboardIcon name="sort" size={14} />
            </span>
            {sortOrder === "asc" ? "Oldest First" : "Newest First"}
          </GhostButton>
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
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} className="dash-fade-up">
            <AppleDateField value={date} onChange={setDate} />
            <input
              value={dealer}
              onChange={(event) => setDealer(event.target.value)}
              placeholder="Dealer"
              className="factory-order-dealer-filter"
            />
            <AppleDropdown value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} style={{ width: 160 }} />
            <AppleDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} style={{ width: 160 }} />
            {hasFilters ? <GhostButton onClick={clearFilters}>Clear</GhostButton> : null}
          </div>
        ) : null}

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {listQuery.isLoading && !listQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 240, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="orders" title="No orders match this view" />
      ) : (
        <div className="factory-order-timeline dash-fade-up">
          {groupedOrders.map((group) => (
            <div key={group.key} className="factory-order-timeline-day">
              <div className="factory-order-timeline-day-header">
                <span className="factory-order-timeline-day-marker" aria-hidden="true" />
                <div className="factory-order-timeline-day-label">
                  {group.relativeLabel ? (
                    <>
                      <strong>{group.relativeLabel}</strong>
                      <span className="factory-order-timeline-day-sep">•</span>
                      <span>{group.dateText}</span>
                    </>
                  ) : (
                    <strong>{group.dateText}</strong>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 46 }}>
                <Surface padding={0}>
                  {group.orders.map((order) => (
                    <OrderRow key={order._id} order={order} onOpen={setSelectedOrderId} />
                  ))}
                </Surface>
              </div>
            </div>
          ))}
        </div>
      )}

      <FactoryOrderModal
        key={selectedOrderId || "none"}
        orderId={selectedOrderId}
        orders={allOrders}
        onClose={() => setSelectedOrderId(null)}
        onDispatched={handleDispatched}
        onDelivered={handleDelivered}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <style>{`
        .factory-order-dealer-filter{
          width:130px;
          height:36px;
          border-radius:10px;
          border:1px solid transparent;
          background:var(--color-fog, #f5f5f7);
          padding:0 10px;
          font-size:13px;
          font-weight:500;
          color:var(--color-ink, #1d1d1f);
          outline:none;
          transition:background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .14s cubic-bezier(.23,1,.32,1);
        }
        .factory-order-dealer-filter:hover{
          background:#fff;
          border-color:rgba(29,29,31,.14);
          box-shadow:0 10px 24px rgba(29,29,31,.08), inset 0 1px 0 rgba(255,255,255,.9);
          transform:translateY(-1px);
        }
        .factory-order-dealer-filter:focus{
          background:#fff;
          border-color:rgba(0,113,227,.3);
          box-shadow:0 0 0 4px rgba(0,113,227,.08);
        }
        .factory-route-menu-trigger{
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
          transition:background .16s ease, transform .14s cubic-bezier(.23,1,.32,1), box-shadow .16s ease;
        }
        .factory-route-menu-trigger:hover{
          background:rgba(29,29,31,.09);
          box-shadow:0 10px 24px rgba(29,29,31,.08), inset 0 1px 0 rgba(255,255,255,.7);
          transform:translateY(-1px);
        }
        .factory-route-menu-trigger:active{
          background:rgba(29,29,31,.13);
          box-shadow:0 3px 10px rgba(29,29,31,.08), inset 0 1px 1px rgba(29,29,31,.06);
          transform:translateY(0) scale(.97);
        }
        .factory-route-menu-trigger:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:2px;
        }
        .factory-route-menu{
          z-index:1401;
          padding:10px;
          border-radius:20px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 16px 40px rgba(0,0,0,.14), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top;
          animation:factoryRouteMenuIn .16s cubic-bezier(.23,1,.32,1) both;
        }
        @keyframes factoryRouteMenuIn{
          from{ opacity:0; transform:scale(.95) translateY(-4px); }
          to{ opacity:1; transform:scale(1) translateY(0); }
        }
        .factory-route-menu-row{
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
        .factory-route-menu-row:hover{
          background:rgba(29,29,31,.055);
          transform:translateX(2px);
        }
        .factory-route-menu-row:active{
          background:rgba(29,29,31,.09);
          transform:translateX(2px) scale(.99);
        }
        .factory-route-menu-row:last-child{ margin-bottom:0; }
        .factory-route-menu-row.is-highlighted{ background:rgba(29,29,31,.045); }
        .factory-route-menu-row.is-selected{ background:rgba(29,29,31,.08); }
        .factory-order-tabs{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:24px;
          border-bottom:1px solid rgba(29,29,31,.1);
          overflow-x:auto;
          scrollbar-width:none;
        }
        .factory-order-tabs::-webkit-scrollbar{ display:none; }
        .factory-order-tab{
          min-width:max-content;
          display:flex;
          align-items:center;
          gap:10px;
          padding:12px 18px 15px;
          border:none;
          background:transparent;
          cursor:pointer;
          border-bottom:3px solid transparent;
          margin-bottom:-1px;
          white-space:nowrap;
          border-radius:14px 14px 0 0;
          -webkit-tap-highlight-color:transparent;
          transition:
            transform .16s cubic-bezier(.23,1,.32,1),
            background-color .18s ease,
            border-color .18s ease,
            color .18s ease;
        }
        .factory-order-tab:not(.is-active):hover{ background:rgba(29,29,31,.045); }
        .factory-order-tab:not(.is-active):active{
          background:rgba(29,29,31,.075);
          transform:translateY(1px) scale(.985);
        }
        .factory-order-tab:focus-visible{
          outline:2px solid rgba(0,113,227,.42);
          outline-offset:3px;
        }
        .factory-order-tab span:first-child{
          font-size:13.5px;
          font-weight:650;
          color:var(--color-graphite, #707070);
        }
        .factory-order-tab-count{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:24px;
          height:22px;
          padding:0 8px;
          border-radius:999px;
          font-size:11px;
          font-weight:750;
          background:rgba(29,29,31,.06);
          color:var(--color-graphite, #707070);
        }
        .factory-order-tab.is-active{
          --factory-tab-accent:var(--color-azure, #0071e3);
          border-bottom-color:var(--factory-tab-accent);
        }
        .factory-order-tab.is-active:hover{ background:color-mix(in srgb, var(--factory-tab-accent) 7%, transparent); }
        .factory-order-tab.is-active:active{
          background:color-mix(in srgb, var(--factory-tab-accent) 10%, transparent);
          transform:translateY(1px) scale(.985);
        }
        .factory-order-tab[data-status="COMPLETED"].is-active{ --factory-tab-accent:#2fb344; }
        .factory-order-tab[data-status="REJECTED"].is-active{ --factory-tab-accent:#b42318; }
        .factory-order-tab.is-active span:first-child{
          color:var(--factory-tab-accent);
          font-weight:700;
        }
        .factory-order-tab.is-active .factory-order-tab-count{
          background:color-mix(in srgb, var(--factory-tab-accent) 12%, transparent);
          color:var(--factory-tab-accent);
        }
        .factory-order-timeline{ position:relative; display:grid; gap:22px; }
        .factory-order-timeline::before{
          content:"";
          position:absolute;
          left:15px;
          top:4px;
          bottom:4px;
          width:2px;
          background:linear-gradient(180deg, rgba(0,113,227,.24), rgba(29,29,31,.09));
        }
        .factory-order-timeline-day{ position:relative; display:grid; gap:10px; }
        .factory-order-timeline-day-header{ position:relative; display:grid; grid-template-columns:32px 1fr; align-items:center; column-gap:14px; }
        .factory-order-timeline-day-label{ display:flex; align-items:center; font-size:12.5px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .factory-order-timeline-day-label strong{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .factory-order-timeline-day-sep{ margin:0 8px; opacity:.5; }
        .factory-order-timeline-day-marker{
          position:relative;
          z-index:1;
          justify-self:center;
          width:13px;
          height:13px;
          border-radius:999px;
          background:#fff;
          border:2px solid rgba(0,113,227,.82);
          flex-shrink:0;
          box-shadow:0 0 0 4px #fff;
        }
        @media (max-width:560px){
          .factory-order-tab{ padding-left:10px; padding-right:10px; }
          .factory-order-timeline::before{ left:11px; }
          .factory-order-timeline-day-header{ grid-template-columns:24px 1fr; column-gap:10px; }
        }
        @media (prefers-reduced-motion: reduce){
          .factory-order-tab{ transition:none!important; }
          .factory-route-menu{ animation:none!important; }
          .factory-route-menu-trigger,
          .factory-order-dealer-filter{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
