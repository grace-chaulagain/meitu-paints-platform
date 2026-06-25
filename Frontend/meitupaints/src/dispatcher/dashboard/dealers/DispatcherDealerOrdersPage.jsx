import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetDispatcherDealersQuery,
  useGetDispatcherOrdersQuery,
} from "../../../redux/api/meituApi.js";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.js";

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
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
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

function MetricCard({ label, value, helper = "", accent = false }) {
  return (
    <div
      style={{
        borderRadius: 20,
        padding: "16px 18px",
        background: accent ? "rgba(180,35,24,.06)" : "rgba(248,250,252,.95)",
        border: accent
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.46)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
      {helper ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.54)",
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div
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
    </div>
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
  subtle = false,
  danger = false,
  disabled = false,
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

function RoutingBadge({ mode }) {
  const isDispatcher = mode === "DISPATCHER";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: isDispatcher ? "rgba(180,35,24,.08)" : "rgba(15,23,42,.05)",
        color: isDispatcher ? "#b42318" : "#475569",
        border: isDispatcher
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.08)",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {mode || "DISPATCHER"}
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

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 110,
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
        Try adjusting the search or status filters to review this assigned
        dealer’s order history.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onReset}>
          Clear filters
        </ActionButton>
      </div>
    </GlassCard>
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

function extractDealerIdFromPath(pathname) {
  const match = pathname.match(
    /^\/dispatcher\/dashboard\/dealers\/([^/]+)\/orders$/,
  );
  return match?.[1] || "";
}

function OrderRow({ order, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid rgba(15,23,42,.06)",
        background: "#fff",
        borderRadius: 20,
        padding: 18,
        cursor: "pointer",
      }}
    >
      <div
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
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 17,
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
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ background: "rgba(15,23,42,.03)" }}>
              {["Item", "Pack", "Qty", "Rate", "Amount"].map((head) => (
                <th
                  key={head}
                  style={{
                    textAlign:
                      head === "Qty" || head === "Rate" || head === "Amount"
                        ? "right"
                        : "left",
                    padding: "12px 14px",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "rgba(15,23,42,.52)",
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
                style={{ borderTop: "1px solid rgba(15,23,42,.06)" }}
              >
                <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#0f172a",
                      lineHeight: 1.35,
                    }}
                  >
                    {item.name || item.nameSnapshot || "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(15,23,42,.52)",
                    }}
                  >
                    {item.sku || item.skuSnapshot || item.code || ""}
                  </div>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                  }}
                >
                  {item.packLabel ||
                    item.variantLabel ||
                    item.unit ||
                    item.uom ||
                    "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  {Number(item.quantity ?? item.qty ?? 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                  }}
                >
                  {Number(item.unitPrice ?? item.rate ?? 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  {Number(item.lineTotal ?? item.amount ?? 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalShell({ open, onClose, children, maxWidth = 1120 }) {
  if (!open) return null;

  return (
    <div
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

function DispatcherDealerOrderDetailModal({
  open,
  order,
  dealer,
  onClose,
  onGoToGlobalOrders,
  onDownloadPdf,
}) {
  if (!open || !order) return null;

  const normalizedStatus = normalizeStatus(order.status);
  const canDownloadPdf =
    normalizedStatus === "VERIFIED" || normalizedStatus === "ARCHIVED";

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1120}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle="Dispatcher-side review of this dealer order record."
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton
                subtle
                onClick={() => onDownloadPdf(order)}
                disabled={!canDownloadPdf}
              >
                Download PDF
              </ActionButton>

              <ActionButton subtle onClick={onGoToGlobalOrders}>
                Open in Dispatcher Orders
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
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge status={normalizedStatus} />
          <RoutingBadge mode={dealer?.fulfillmentMode || "DISPATCHER"} />
        </div>

        {!canDownloadPdf ? (
          <div
            style={{
              marginTop: 14,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(15,23,42,.04)",
              color: "rgba(15,23,42,.62)",
              border: "1px solid rgba(15,23,42,.08)",
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            PDF download becomes available after the order is verified or
            archived.
          </div>
        ) : null}

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,.9fr)",
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
                <DetailItem label="Dealer" value={dealer?.companyName} />
                <DetailItem label="Contact" value={dealer?.contactName} />
                <DetailItem label="Phone" value={dealer?.phone} />
                <DetailItem label="Email" value={dealer?.email} />
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
                <DetailItem
                  label="Payment Reference"
                  value={
                    order?.payment?.reference || order?.payment?.referenceNo
                  }
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

export default function DispatcherDealerOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(
    () => extractDealerIdFromPath(location.pathname),
    [location.pathname],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeOrder, setActiveOrder] = useState(null);

  const orderParams = useMemo(
    () =>
      statusFilter !== "ALL"
        ? { status: statusFilter }
        : { archive: true },
    [statusFilter],
  );
  const dealersQuery = useGetDispatcherDealersQuery(undefined, { skip: !dealerId });
  const ordersQuery = useGetDispatcherOrdersQuery(orderParams, { skip: !dealerId });

  const dealer = useMemo(() => {
    const dealerItems = dealersQuery.data?.items || [];
    return dealerItems.find((item) => item._id === dealerId) || null;
  }, [dealersQuery.data, dealerId]);

  const orders = useMemo(() => {
    const allDispatcherOrders = ordersQuery.data?.items || [];
    return allDispatcherOrders.filter((order) => {
      const linkedDealerId =
        order?.dealerId?._id ||
        order?.dealerId ||
        order?.dealerSnapshot?._id ||
        order?.dealerSnapshot?.id ||
        "";
      return String(linkedDealerId) === String(dealerId);
    });
  }, [ordersQuery.data, dealerId]);

  const loading =
    !dealer &&
    orders.length === 0 &&
    (dealersQuery.isLoading || ordersQuery.isLoading);
  const refreshing =
    Boolean(dealer || orders.length) &&
    (dealersQuery.isFetching || ordersQuery.isFetching);
  const error = dealersQuery.error?.message || ordersQuery.error?.message || "";

  function loadPageData() {
    dealersQuery.refetch();
    ordersQuery.refetch();
  }


  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) =>
      [
        order.orderNumber,
        order.payment?.method,
        order.payment?.reference,
        order.payment?.referenceNo,
        order.dealerNote,
        order.internalNote,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [orders, search]);

  const countsByFilter = useMemo(() => {
    return {
      ALL: orders.length,
      SUBMITTED: orders.filter((o) => normalizeStatus(o.status) === "SUBMITTED")
        .length,
      VERIFIED: orders.filter((o) => normalizeStatus(o.status) === "VERIFIED")
        .length,
      REJECTED: orders.filter((o) => normalizeStatus(o.status) === "REJECTED")
        .length,
      ARCHIVED: orders.filter((o) => normalizeStatus(o.status) === "ARCHIVED")
        .length,
    };
  }, [orders]);

  function handleDownloadPdf(order) {
    downloadOrderSummaryPdf({
      order,
      dealer: {
        companyName: dealer?.companyName || "",
        contactName: dealer?.contactName || "",
        email: dealer?.email || "",
        phone: dealer?.phone || "",
        address: dealer?.address || "",
      },
    });
  }

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <LoadingState />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {error ? (
          <GlassCard style={{ padding: 18 }}>
            <div
              style={{
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
          </GlassCard>
        ) : null}

        <EmptyState onReset={() => navigate("/dispatcher/dashboard/dealers")} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title={`Order History · ${dealer.companyName || "Assigned Dealer"}`}
          subtitle={refreshing ? "Updating cached dealer orders in the background." : "Search and inspect every order from this assigned dealer within your dispatcher scope."}
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton
                subtle
                onClick={() =>
                  navigate(`/dispatcher/dashboard/dealers/${dealerId}`)
                }
              >
                View Profile
              </ActionButton>

              <ActionButton
                subtle
                onClick={() => navigate("/dispatcher/dashboard/dealers")}
              >
                Back to Dealers
              </ActionButton>
            </div>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <StatusBadge status={dealer.status} />
          <RoutingBadge mode={dealer.fulfillmentMode || "DISPATCHER"} />
        </div>
      </GlassCard>

      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Dealer Orders"
          subtitle="Search and inspect the order history for this assigned dealer."
          action={
            <ActionButton
              subtle
              onClick={loadPageData}
            >
              Refresh
            </ActionButton>
          }
        />

        <div
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
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        <div style={{ marginTop: 14 }}>
          <ActionButton
            subtle
            onClick={loadPageData}
          >
            Apply Search
          </ActionButton>
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
      </GlassCard>

      {filteredOrders.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filteredOrders.map((order) => (
            <OrderRow
              key={order._id}
              order={order}
              onOpen={(next) => setActiveOrder(next)}
            />
          ))}
        </div>
      )}

      <DispatcherDealerOrderDetailModal
        open={Boolean(activeOrder)}
        order={activeOrder}
        dealer={dealer}
        onClose={() => setActiveOrder(null)}
        onGoToGlobalOrders={() => {
          setActiveOrder(null);
          navigate("/dispatcher/dashboard/orders");
        }}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
}
