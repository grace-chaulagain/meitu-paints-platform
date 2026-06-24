import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import { useGetDealerOrdersQuery } from "../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../redux/api/selectors.js";
import { downloadOrderSummaryPdf } from "../utils/downloadOrderSummaryPdf.js";

const ORDER_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVED", label: "Archived" },
];

function GlassCard({ children, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        borderRadius: 26,
        border: "1px solid rgba(15,23,42,.08)",
        background: "rgba(255,255,255,.82)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow:
          "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.82)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, action = null }) {
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
            fontSize: 28,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 700,
              color: "rgba(15,23,42,.58)",
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

function SearchInput({ value, onChange, placeholder, onSubmit, onClear }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 50,
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: "0 14px",
      }}
    >
      <span style={{ fontWeight: 900, color: "rgba(15,23,42,.42)" }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(15,23,42,.08)",
            background: "rgba(248,250,252,.95)",
            color: "rgba(15,23,42,.58)",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          ×
        </button>
      ) : null}
    </form>
  );
}

function FilterPill({ active, children, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(180,35,24,.16)"
          : "1px solid rgba(15,23,42,.08)",
        background: active
          ? "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)"
          : "#fff",
        color: active ? "#fff" : "#0f172a",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.06)",
            color: active ? "#fff" : "#0f172a",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  subtle = false,
  disabled = false,
  title = "",
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onClick?.(e);
      }}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 14,
        border: danger
          ? "1px solid rgba(180,35,24,.14)"
          : "1px solid rgba(15,23,42,.08)",
        background: danger
          ? "rgba(180,35,24,.06)"
          : subtle
            ? "#fff"
            : "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)",
        color: danger ? "#b42318" : subtle ? "#0f172a" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();

  const tone =
    normalized === "VERIFIED"
      ? {
          bg: "rgba(22,163,74,.08)",
          color: "#15803d",
          border: "1px solid rgba(22,163,74,.12)",
        }
      : normalized === "REJECTED"
        ? {
            bg: "rgba(180,35,24,.08)",
            color: "#b42318",
            border: "1px solid rgba(180,35,24,.12)",
          }
        : normalized === "ARCHIVED"
          ? {
              bg: "rgba(15,23,42,.08)",
              color: "#334155",
              border: "1px solid rgba(15,23,42,.12)",
            }
          : {
              bg: "rgba(245,158,11,.10)",
              color: "#b45309",
              border: "1px solid rgba(245,158,11,.16)",
            };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: tone.border,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: ".04em",
      }}
    >
      {status || "—"}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.44)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          fontWeight: 800,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(15,23,42,.44)",
      }}
    >
      {children}
    </div>
  );
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function normalizeStatus(status) {
  const s = String(status || "")
    .toUpperCase()
    .trim();
  if (s === "ARCHIVE") return "ARCHIVED";
  return s;
}

function canDownloadOrderPdf(order) {
  return normalizeStatus(order?.status) === "VERIFIED";
}


function OrderRow({ order, onOpen }) {
  return (
    <button
      type="button"
      className="dealer-order-row"
      onClick={() => onOpen(order)}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid rgba(15,23,42,.06)",
        background: "#fff",
        borderRadius: 22,
        padding: 18,
        cursor: "pointer",
      }}
    >
      <div
        className="dealer-order-row-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              {order.orderNumber || "Unnamed Order"}
            </div>

            <StatusBadge status={normalizeStatus(order.status)} />
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(15,23,42,.56)",
            }}
          >
            <span>
              {money(order?.totals?.total, order?.totals?.currency || "NPR")}
            </span>
            <span>•</span>
            <span>{order?.payment?.method || "No payment method"}</span>
            <span>•</span>
            <span>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </div>

        <div
          className="dealer-order-count"
          style={{
            justifySelf: "end",
            textAlign: "right",
            fontSize: 12,
            fontWeight: 800,
            color: "rgba(15,23,42,.52)",
          }}
        >
          {Array.isArray(order.items) ? `${order.items.length} items` : "—"}
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 96,
              borderRadius: 18,
              background:
                "linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9))",
            }}
          />
        </GlassCard>
      ))}
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <GlassCard style={{ padding: 26 }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#0f172a",
        }}
      >
        No orders found
      </div>
      <div
        style={{
          marginTop: 8,
          maxWidth: 620,
          fontSize: 14,
          lineHeight: 1.7,
          fontWeight: 700,
          color: "rgba(15,23,42,.56)",
        }}
      >
        Try adjusting the search or status filters to view your submitted order
        history.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onReset}>
          Clear filters
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function OrderItemsTable({ items = [] }) {
  if (!items.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,.06)",
          background: "#fff",
          color: "rgba(15,23,42,.56)",
          fontWeight: 800,
        }}
      >
        No items found.
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,.06)",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div className="dealer-order-table-wrap" style={{ overflowX: "auto" }}>
        <table
          className="dealer-order-items-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ background: "rgba(15,23,42,.03)" }}>
              <th
                style={{
                  width: "54%",
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,.52)",
                }}
              >
                Item
              </th>
              <th
                style={{
                  width: "14%",
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,.52)",
                }}
              >
                Pack
              </th>
              <th
                style={{
                  width: "10%",
                  textAlign: "right",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,.52)",
                }}
              >
                Qty
              </th>
              <th
                style={{
                  width: "11%",
                  textAlign: "right",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,.52)",
                }}
              >
                Rate
              </th>
              <th
                style={{
                  width: "11%",
                  textAlign: "right",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,.52)",
                }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={`${item.sku || item.code || item.name}-${index}`}
                style={{ borderTop: "1px solid rgba(15,23,42,.06)" }}
              >
                <td
                  style={{
                    padding: "12px 14px",
                    verticalAlign: "top",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#0f172a",
                      lineHeight: 1.35,
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.name || "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      lineHeight: 1.4,
                      fontWeight: 700,
                      color: "rgba(15,23,42,.52)",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.sku || item.code || ""}
                  </div>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    verticalAlign: "top",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  {item.packLabel || item.variantLabel || item.unit || "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    verticalAlign: "top",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number(item.quantity || 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    verticalAlign: "top",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number(item.unitPrice || 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    verticalAlign: "top",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number(item.lineTotal || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalShell({ open, onClose, children, maxWidth = 1080 }) {
  if (!open) return null;

  return (
    <div
      className="dealer-order-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15,23,42,.38)",
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
      <GlassCard
        style={{
          width: `min(${maxWidth}px, 100%)`,
          maxHeight: "92vh",
          overflow: "auto",
        }}
      >
        {children}
      </GlassCard>
    </div>
  );
}

function OrderDetailModal({ open, order, onClose }) {
  if (!open || !order) return null;

  const isDownloadable = canDownloadOrderPdf(order);

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1120}>
      <div className="dealer-order-modal-body" style={{ padding: 24 }}>
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle="Complete record of your submitted order"
          action={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <ActionButton
                subtle
                disabled={!isDownloadable}
                title={
                  isDownloadable
                    ? "Download verified order summary PDF"
                    : "PDF download becomes available after admin verification"
                }
                onClick={() => {
                  if (!isDownloadable) return;
                  downloadOrderSummaryPdf({ order });
                }}
              >
                {isDownloadable
                  ? "Download PDF"
                  : "Available after verification"}
              </ActionButton>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,.08)",
                  background: "#fff",
                  fontSize: 20,
                  fontWeight: 900,
                  cursor: "pointer",
                  color: "#0f172a",
                }}
              >
                ×
              </button>
            </div>
          }
        />

        <div
          className="dealer-order-detail-grid"
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge status={normalizeStatus(order.status)} />
        </div>

        {!isDownloadable ? (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(245,158,11,.10)",
              color: "#b45309",
              border: "1px solid rgba(245,158,11,.16)",
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            This order summary PDF can be downloaded only after the order has
            been verified by Meitu.
          </div>
        ) : null}

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(320px,.9fr)",
            gap: 18,
          }}
        >
          <GlassCard style={{ padding: 18, background: "#fff" }}>
            <Label>Order Items</Label>
            <div style={{ marginTop: 10 }}>
              <OrderItemsTable items={order.items || []} />
            </div>
          </GlassCard>

          <div style={{ display: "grid", gap: 18 }}>
            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Order Context</Label>
              <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                <DetailItem
                  label="Total"
                  value={money(
                    order?.totals?.total,
                    order?.totals?.currency || "NPR",
                  )}
                />
                <DetailItem
                  label="Payment Method"
                  value={order?.payment?.method}
                />
                <DetailItem label="Dealer Note" value={order?.dealerNote} />
                <DetailItem label="Internal Note" value={order?.internalNote} />
                <DetailItem
                  label="Submitted"
                  value={
                    order?.createdAt
                      ? new Date(order.createdAt).toLocaleString()
                      : "—"
                  }
                />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export default function DealerOrdersPage() {
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeOrder, setActiveOrder] = useState(null);
  const resultsRef = useRef(null);

  const visibleParams = useMemo(() => {
    const params = {};

    if (statusFilter !== "ALL") {
      params.status = statusFilter === "ARCHIVED" ? "ARCHIVE" : statusFilter;
    }

    if (committedSearch.trim()) {
      params.q = committedSearch.trim();
    }

    return params;
  }, [committedSearch, statusFilter]);

  const countsQuery = useGetDealerOrdersQuery({});
  const ordersQuery = useGetDealerOrdersQuery(visibleParams);

  const allOrders = useMemo(() => {
    return (countsQuery.data?.items || []).map((item) => ({
      ...item,
      status: normalizeStatus(item?.status),
    }));
  }, [countsQuery.data]);

  const visibleOrders = useMemo(() => {
    return (ordersQuery.data?.items || []).map((item) => ({
      ...item,
      status: normalizeStatus(item?.status),
    }));
  }, [ordersQuery.data]);

  const loading =
    (countsQuery.isLoading && allOrders.length === 0) ||
    (ordersQuery.isLoading && visibleOrders.length === 0);
  const isRefreshing =
    !loading && (countsQuery.isFetching || ordersQuery.isFetching);
  const queryError = ordersQuery.error || countsQuery.error;
  const error = queryError
    ? getQueryErrorMessage(queryError, "Failed to load your order history.")
    : "";

  const activeOrderView = useMemo(() => {
    if (!activeOrder?._id) return null;
    return (
      visibleOrders.find((item) => item._id === activeOrder._id) ||
      allOrders.find((item) => item._id === activeOrder._id) ||
      activeOrder
    );
  }, [activeOrder, allOrders, visibleOrders]);

  function submitSearch() {
    setCommittedSearch(search);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function clearSearch() {
    setSearch("");
    setCommittedSearch("");
  }

  function resetFilters() {
    setSearch("");
    setCommittedSearch("");
    setStatusFilter("ALL");
  }

  const countsByFilter = useMemo(() => {
    return {
      ALL: allOrders.length,
      SUBMITTED: allOrders.filter(
        (o) => normalizeStatus(o.status) === "SUBMITTED",
      ).length,
      VERIFIED: allOrders.filter(
        (o) => normalizeStatus(o.status) === "VERIFIED",
      ).length,
      REJECTED: allOrders.filter(
        (o) => normalizeStatus(o.status) === "REJECTED",
      ).length,
      ARCHIVED: allOrders.filter(
        (o) => normalizeStatus(o.status) === "ARCHIVED",
      ).length,
    };
  }, [allOrders]);

  return (
    <>
      <NavBar />

      <div
        className="dealer-orders-page"
        style={{
          minHeight: "100vh",
          paddingTop: 96,
          paddingBottom: 52,
          background:
            "radial-gradient(1200px 700px at 20% 10%, rgba(255,204,0,.10), transparent 55%), radial-gradient(900px 600px at 80% 20%, rgba(255,80,0,.08), transparent 55%), radial-gradient(900px 700px at 50% 100%, rgba(196,0,0,.06), transparent 60%), linear-gradient(180deg, rgba(250,250,252,1) 0%, rgba(245,245,248,1) 100%)",
        }}
      >
        <div className="container" style={{ maxWidth: 1440 }}>
          <div style={{ display: "grid", gap: 20 }}>
            <GlassCard style={{ padding: 18 }}>
              <SectionHeader
                title="Order History"
                subtitle="Review every order you have submitted to Meitu."
                action={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      to="/dealer/orders/reports"
                      style={{
                        height: 42,
                        padding: "0 16px",
                        borderRadius: 14,
                        border: "1px solid rgba(15,23,42,.08)",
                        background: "#fff",
                        color: "#0f172a",
                        fontWeight: 900,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      Utility Reports
                    </Link>

                    <Link
                      to="/dealer/catalog"
                      style={{
                        height: 42,
                        padding: "0 16px",
                        borderRadius: 14,
                        border: "1px solid rgba(15,23,42,.08)",
                        background: "#fff",
                        color: "#0f172a",
                        fontWeight: 900,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      Back to Catalog
                    </Link>
                  </div>
                }
              />

              <div
                className="dealer-orders-filter-grid"
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "minmax(280px, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search order number, payment, notes..."
                  onSubmit={submitSearch}
                  onClear={clearSearch}
                />
                <div
                  className="dealer-orders-filter-pills"
                  style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                >
                  {ORDER_FILTERS.map((filter) => (
                    <FilterPill
                      key={filter.key}
                      active={statusFilter === filter.key}
                      onClick={() => setStatusFilter(filter.key)}
                      count={countsByFilter[filter.key]}
                    >
                      {filter.label}
                    </FilterPill>
                  ))}
                </div>
              </div>

              {error ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "rgba(180,35,24,.08)",
                    color: "#b42318",
                    border: "1px solid rgba(180,35,24,.14)",
                    fontWeight: 800,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {isRefreshing ? (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "rgba(15,23,42,.46)",
                  }}
                >
                  Updating orders...
                </div>
              ) : null}
            </GlassCard>

            <div ref={resultsRef} style={{ scrollMarginTop: 24 }}>
              {loading ? (
                <LoadingState />
              ) : visibleOrders.length === 0 ? (
                <EmptyState
                  onReset={resetFilters}
                />
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {visibleOrders.map((order) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      onOpen={(next) => setActiveOrder(next)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <OrderDetailModal
        open={Boolean(activeOrderView)}
        order={activeOrderView}
        onClose={() => setActiveOrder(null)}
      />

      <style>{`
        .dealer-orders-page,
        .dealer-orders-page *{
          box-sizing:border-box;
          min-width:0;
        }

        .dealer-order-table-wrap{
          -webkit-overflow-scrolling:touch;
        }

        @media (max-width:900px){
          .dealer-order-detail-grid{
            grid-template-columns:1fr!important;
          }
        }

        @media (max-width:720px){
          .dealer-orders-page{
            padding-top:84px!important;
            padding-bottom:36px!important;
          }

          .dealer-orders-page .container{
            padding-left:14px;
            padding-right:14px;
          }

          .dealer-orders-filter-grid{
            grid-template-columns:1fr!important;
          }

          .dealer-orders-filter-pills{
            overflow-x:auto;
            flex-wrap:nowrap!important;
            padding-bottom:4px;
            -webkit-overflow-scrolling:touch;
          }

          .dealer-orders-filter-pills button{
            flex:0 0 auto;
          }

          .dealer-order-row{
            border-radius:18px!important;
            padding:15px!important;
          }

          .dealer-order-row-grid{
            grid-template-columns:1fr!important;
          }

          .dealer-order-count{
            justify-self:start!important;
            text-align:left!important;
          }

          .dealer-order-items-table{
            min-width:0;
          }

          .dealer-order-items-table,
          .dealer-order-items-table tbody,
          .dealer-order-items-table tr,
          .dealer-order-items-table td{
            display:block;
            width:100%!important;
          }

          .dealer-order-items-table thead{
            display:none;
          }

          .dealer-order-items-table tr{
            padding:12px;
            border-top:1px solid rgba(15,23,42,.08)!important;
          }

          .dealer-order-items-table tr:first-child{
            border-top:0!important;
          }

          .dealer-order-items-table td{
            padding:8px 0!important;
            text-align:left!important;
            white-space:normal!important;
          }

          .dealer-order-items-table td::before{
            display:block;
            margin-bottom:4px;
            font-size:10px;
            font-weight:950;
            letter-spacing:.08em;
            text-transform:uppercase;
            color:rgba(15,23,42,.44);
          }

          .dealer-order-items-table td:nth-child(1)::before{ content:"Item"; }
          .dealer-order-items-table td:nth-child(2)::before{ content:"Pack"; }
          .dealer-order-items-table td:nth-child(3)::before{ content:"Qty"; }
          .dealer-order-items-table td:nth-child(4)::before{ content:"Rate"; }
          .dealer-order-items-table td:nth-child(5)::before{ content:"Amount"; }

          .dealer-order-table-wrap{
            overflow-x:hidden!important;
          }

          .dealer-order-modal-overlay{
            padding:12px!important;
            align-items:stretch!important;
            place-items:stretch!important;
          }

          .dealer-order-modal-overlay > div{
            width:100%!important;
            max-height:calc(100dvh - 24px)!important;
            border-radius:20px!important;
          }

          .dealer-order-modal-body{
            padding:16px!important;
          }
        }

        @media (max-width:520px){
          .dealer-orders-page h1,
          .dealer-orders-page [style*="font-size: 28px"]{
            font-size:24px!important;
          }

          .dealer-order-modal-body{
            padding:14px!important;
          }
        }
      `}</style>
    </>
  );
}
