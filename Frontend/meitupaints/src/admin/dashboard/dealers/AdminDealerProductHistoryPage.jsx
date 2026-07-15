import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDealerQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminDealerInventoryMovementsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

const HISTORY_DAYS_PAGE_SIZE = 6;

const VIEW_OPTIONS = [
  { key: "all", label: "Sales and Purchases" },
  { key: "purchases", label: "Purchases" },
  { key: "sales", label: "Sales" },
];

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function orderStatusTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  return "accent";
}

// Movements are a single ledger of many entry types (PURCHASE, SALE, RETURN,
// ADJUSTMENT, TRANSFER_*) - normalized here into one "event" shape (mirrors
// the same normalize-then-group-by-day pattern already used for the dealer's
// own combined History tab) so purchase and sale movements can be sorted and
// grouped by calendar day together, regardless of which tab is active.
function buildProductHistoryEvents(movements) {
  return movements
    .map((movement) => ({
      type: movement.type === "SALE" ? "sale" : "order",
      key: movement._id,
      date: new Date(movement.createdAt),
      movement,
    }))
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

// A plain, minimal top-left back link - Apple's own back-navigation
// convention (chevron + text, no button chrome) rather than a boxed
// button competing with the page's real actions.
function BackLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        color: "var(--color-azure, #0071e3)",
        fontSize: 14.5,
        fontWeight: 600,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {children}
    </button>
  );
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        flexShrink: 0,
        border: "none",
        borderRadius: 6,
        background: "transparent",
        color: copied ? "#1a7f37" : "var(--color-graphite, #707070)",
        cursor: "pointer",
      }}
    >
      <DashboardIcon name={copied ? "checkmark" : "copy"} size={13} strokeWidth={1.8} />
    </button>
  );
}

function CloseButton({ onClick }) {
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

function ModalShell({ children, onClose, width = 560 }) {
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

function OrderPreviewModal({ order, onClose }) {
  if (!order) return null;

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={order.orderNumber} icon="orders" title="Order Preview" />
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={orderStatusTone(order.status)} size="small">{order.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(order.createdAt)}</span>
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
    </ModalShell>
  );
}

function SaleDetailModal({ sale, onClose }) {
  if (!sale) return null;

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={sale.saleNumber} icon="orders" title={sale.billId ? `Bill ${sale.billId}` : "Sale"} />
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">{sale.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(sale.saleDate)}</span>
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
    </ModalShell>
  );
}

function ProductOrderCard({ movement, onOpen, style }) {
  const order = movement.orderId;
  const status = normalizeStatus(order?.status);
  const meta = orderStatusMeta(status);

  return (
    <button
      type="button"
      className="admin-sph-card admin-sph-card--order"
      style={style}
      onClick={() => order && onOpen(order)}
    >
      <span className="admin-sph-card-icon">
        <DashboardIcon name="truck" size={16} strokeWidth={1.8} />
      </span>
      <div className="admin-sph-card-main">
        <div className="admin-sph-card-title">
          <span className="admin-sph-card-kind">Purchase</span>
          {order?.orderNumber || "Unnamed Order"}
        </div>
        <div className="admin-sph-card-sub">{formatTime(movement.createdAt)}</div>
      </div>
      <Pill tone={meta.tone} size="small">{meta.label}</Pill>
      <span className="admin-sph-card-qty">{formatQty(movement.quantity)}</span>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

function ProductSaleCard({ movement, onOpen, style }) {
  const sale = movement.saleId;
  const voided = sale?.status === "VOIDED";

  return (
    <button
      type="button"
      className={`admin-sph-card admin-sph-card--sale ${voided ? "is-voided" : ""}`}
      style={style}
      onClick={() => sale && onOpen(sale)}
    >
      <span className="admin-sph-card-icon">
        <DashboardIcon name={voided ? "reject" : "checkSquare"} size={16} strokeWidth={1.8} />
      </span>
      <div className="admin-sph-card-main">
        <div className="admin-sph-card-title">
          <span className="admin-sph-card-kind">Sale</span>
          {sale?.saleNumber || "Sale"}
        </div>
        <div className="admin-sph-card-sub">
          {formatTime(movement.createdAt)}{sale?.billId ? ` · Bill ${sale.billId}` : ""}
        </div>
      </div>
      <Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>
      <span className="admin-sph-card-qty">{formatQty(movement.quantity)}</span>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

function ProductHistoryDayGroup({ group, onOpenOrder, onOpenSale, animate }) {
  return (
    <div className="admin-sph-day">
      <div className="admin-sph-day-header">
        <span className="admin-sph-day-marker" aria-hidden="true" />
        <div>
          <div className="admin-sph-day-date">{formatDayLabel(group.date)}</div>
          <div className="admin-sph-day-weekday">{formatWeekday(group.date)}</div>
        </div>
      </div>
      <div className="admin-sph-day-body">
        {group.events.map((event, index) => {
          // Staggered entrance only plays once per tab load - each card's
          // own re-renders (e.g. a background refetch updating its status
          // pill) don't replay it, since the delay is baked into a single
          // mount-time inline style, not re-derived from index on every render.
          const cardStyle = animate ? { animationDelay: `${Math.min(index, 8) * 35}ms` } : undefined;
          return event.type === "order" ? (
            <ProductOrderCard key={event.key} movement={event.movement} onOpen={onOpenOrder} style={cardStyle} />
          ) : (
            <ProductSaleCard key={event.key} movement={event.movement} onOpen={onOpenSale} style={cardStyle} />
          );
        })}
      </div>
    </div>
  );
}

function ProductHistoryPagination({ page, totalPages, totalCount, onChange }) {
  if (totalCount === 0) return null;

  const start = (page - 1) * HISTORY_DAYS_PAGE_SIZE + 1;
  const end = Math.min(page * HISTORY_DAYS_PAGE_SIZE, totalCount);
  const pages = buildPageList(page, totalPages);

  return (
    <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Showing {start} to {end} of {totalCount} days
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="admin-sph-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`admin-sph-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="admin-sph-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export default function AdminDealerProductHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { dealerId, productId, mode } = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)\/sales-purchases\/([^/]+)\/(purchases|sales|all)$/,
    );
    return { dealerId: match?.[1] || "", productId: match?.[2] || "", mode: match?.[3] || "all" };
  }, [location.pathname]);

  // "view" is derived from the URL ("mode") rather than the other way
  // around - changeView() only navigates, it never sets view/page itself.
  // The sync check below (adjusting state during render, not inside an
  // effect - React's recommended pattern for this) catches every way the
  // URL can change: a tab click, or the browser back/forward button
  // landing on a different product/mode entirely while this same page
  // component instance stays mounted.
  const [syncKey, setSyncKey] = useState(`${productId}:${mode}`);
  const [view, setView] = useState(mode);
  const [page, setPage] = useState(1);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewSale, setPreviewSale] = useState(null);

  const urlKey = `${productId}:${mode}`;
  if (syncKey !== urlKey) {
    setSyncKey(urlKey);
    setView(mode);
    setPage(1);
  }

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const inventoryQuery = useGetAdminDealerInventoryQuery(dealerId, { skip: !dealerId });
  const movementsQuery = useGetAdminDealerInventoryMovementsQuery(
    { dealerId, productId, type: "ALL", limit: 200 },
    { skip: !dealerId || !productId },
  );

  const dealer = dealerQuery.data?.item || null;
  const product = useMemo(
    () => (inventoryQuery.data?.items || []).find((item) => String(item.productId) === String(productId)) || null,
    [inventoryQuery.data, productId],
  );

  const movements = useMemo(() => movementsQuery.data?.items || [], [movementsQuery.data]);

  // Purchases and sales only ("orders and sales", not the full ledger) -
  // returns/adjustments/transfers are excluded from all three tabs.
  const filteredMovements = useMemo(() => {
    if (view === "purchases") return movements.filter((movement) => movement.type === "PURCHASE");
    if (view === "sales") return movements.filter((movement) => movement.type === "SALE");
    return movements.filter((movement) => movement.type === "PURCHASE" || movement.type === "SALE");
  }, [movements, view]);

  const dayGroups = useMemo(() => groupEventsByDay(buildProductHistoryEvents(filteredMovements)), [filteredMovements]);
  const totalPages = Math.max(1, Math.ceil(dayGroups.length / HISTORY_DAYS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleDayGroups = dayGroups.slice((currentPage - 1) * HISTORY_DAYS_PAGE_SIZE, currentPage * HISTORY_DAYS_PAGE_SIZE);

  function changeView(nextView) {
    navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases/${productId}/${nextView}`, { replace: true });
  }

  const movementsError = movementsQuery.error ? getQueryErrorMessage(movementsQuery.error, "Failed to load product history.") : "";

  const productLabel = product ? `${product.name}${product.pack?.label ? ` · ${product.pack.label}` : ""}` : "";

  const viewCopy = {
    all: { icon: "overview", title: "Sales and Purchases", empty: "No activity yet", emptySubtitle: "This dealer hasn't ordered or sold this product yet." },
    purchases: { icon: "truck", title: "Purchases", empty: "No purchases yet", emptySubtitle: "This product hasn't been delivered to this dealer yet." },
    sales: { icon: "handshake", title: "Sales", empty: "No sales yet", emptySubtitle: "This dealer hasn't sold this product yet." },
  }[view];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases`)}>Back to Sales &amp; Purchases</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer?.companyName || "Dealer"} · {viewCopy.title}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {productLabel || "Loading product…"}
              </div>
            </div>
          </div>

          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
        </div>
      </Surface>

      {movementsError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {movementsError}
        </div>
      ) : null}

      <Surface padding={26} className="dash-fade-up" key={view}>
        <SectionHeader
          icon={viewCopy.icon}
          title={viewCopy.title}
          subtitle={productLabel}
          action={movementsQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 16 }}>
          {movementsQuery.isLoading && !movementsQuery.data ? (
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : dayGroups.length === 0 ? (
            <EmptyState icon={viewCopy.icon} title={viewCopy.empty} subtitle={viewCopy.emptySubtitle} />
          ) : (
            <>
              <div className="admin-sph-timeline">
                {visibleDayGroups.map((group) => (
                  <ProductHistoryDayGroup
                    key={group.key}
                    group={group}
                    onOpenOrder={setPreviewOrder}
                    onOpenSale={setPreviewSale}
                    animate
                  />
                ))}
              </div>
              <ProductHistoryPagination page={currentPage} totalPages={totalPages} totalCount={dayGroups.length} onChange={setPage} />
            </>
          )}
        </div>
      </Surface>

      <OrderPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      <SaleDetailModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      <style>{`
        .admin-sph-timeline{
          position:relative;
          display:grid;
          gap:22px;
        }
        .admin-sph-timeline::before{
          content:"";
          position:absolute;
          left:6px;
          top:4px;
          bottom:4px;
          width:2px;
          background:linear-gradient(180deg, rgba(0,113,227,.22), rgba(29,29,31,.08));
        }
        .admin-sph-day{
          position:relative;
          display:grid;
          gap:10px;
        }
        .admin-sph-day-header{
          position:relative;
          display:flex;
          align-items:center;
          gap:14px;
        }
        .admin-sph-day-marker{
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
        .admin-sph-day-date{
          font-size:13.5px;
          font-weight:750;
          color:var(--color-ink,#1d1d1f);
        }
        .admin-sph-day-weekday{
          margin-top:1px;
          font-size:11.5px;
          color:var(--color-graphite,#707070);
        }
        .admin-sph-day-body{
          margin-left:27px;
          display:grid;
          gap:8px;
        }
        .admin-sph-card{
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
          animation:adminSphCardIn .3s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminSphCardIn{
          from{ opacity:0; transform:translateY(6px) scale(.98); }
          to{ opacity:1; transform:translateY(0) scale(1); }
        }
        .admin-sph-card:hover{
          box-shadow:0 10px 24px rgba(15,23,42,.06);
          transform:translateY(-1px);
        }
        .admin-sph-card:active{
          transform:scale(.99);
        }
        .admin-sph-card-icon{
          width:32px;
          height:32px;
          border-radius:10px;
          flex-shrink:0;
          display:grid;
          place-items:center;
        }
        .admin-sph-card--order{
          border-left-color:var(--color-azure,#0071e3);
        }
        .admin-sph-card--order .admin-sph-card-icon{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .admin-sph-card--sale{
          border-left-color:#15803d;
        }
        .admin-sph-card--sale .admin-sph-card-icon{
          background:rgba(22,163,74,.1);
          color:#15803d;
        }
        .admin-sph-card--sale.is-voided{
          border-left-color:#b42318;
        }
        .admin-sph-card--sale.is-voided .admin-sph-card-icon{
          background:rgba(180,35,24,.1);
          color:#b42318;
        }
        .admin-sph-card-main{
          min-width:0;
          flex:1 1 auto;
        }
        .admin-sph-card-title{
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
        .admin-sph-card-kind{
          flex-shrink:0;
          font-size:9.5px;
          font-weight:800;
          letter-spacing:.05em;
          text-transform:uppercase;
          padding:2px 6px;
          border-radius:999px;
        }
        .admin-sph-card--order .admin-sph-card-kind{
          background:rgba(0,113,227,.12);
          color:var(--color-azure,#0071e3);
        }
        .admin-sph-card--sale .admin-sph-card-kind{
          background:rgba(22,163,74,.12);
          color:#15803d;
        }
        .admin-sph-card--sale.is-voided .admin-sph-card-kind{
          background:rgba(180,35,24,.12);
          color:#b42318;
        }
        .admin-sph-card-sub{
          margin-top:2px;
          font-size:11.5px;
          color:var(--color-graphite,#707070);
        }
        .admin-sph-card-qty{
          flex-shrink:0;
          min-width:60px;
          text-align:right;
          font-size:13px;
          font-weight:750;
          color:var(--color-ink,#1d1d1f);
        }
        .admin-sph-page-btn{
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
        .admin-sph-page-btn:disabled{
          opacity:.35;
          cursor:not-allowed;
        }
        .admin-sph-page-btn.is-active{
          background:var(--color-azure, #0071e3);
          color:#fff;
        }
        .admin-sph-page-btn:not(.is-active):not(:disabled):hover{
          background:rgba(29,29,31,.06);
        }
        @media (max-width:640px){
          .admin-sph-card{
            flex-wrap:wrap;
          }
          .admin-sph-card-qty{
            order:5;
          }
        }
        @media (prefers-reduced-motion: reduce){
          .admin-sph-card{ animation:none!important; }
        }
      `}</style>
    </div>
  );
}
