import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDealerQuery,
  useGetAdminScopedOrdersQuery,
  useLazyGetAdminScopedOrderQuery,
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
      <div style={{ minWidth: 0 }}>
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
        height: 40,
        padding: "0 14px",
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

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
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

function EmptyState({ companyName, onReset }) {
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
        {companyName
          ? `No matching order records were found for ${companyName}.`
          : "No matching order records were found for this dealer."}
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
        borderRadius: 22,
        padding: 18,
        cursor: "pointer",
        transition:
          "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
        boxShadow: "0 10px 26px rgba(15,23,42,.04)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gap: 16,
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
            <StatusBadge status={order.status} />
          </div>

          <div
            style={{
              marginTop: 12,
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
            whiteSpace: "nowrap",
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
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {item.name || "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(15,23,42,.52)",
                    }}
                  >
                    {item.sku || item.code || ""}
                  </div>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                  }}
                >
                  {item.packLabel || item.variantLabel || item.unit || "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  {Number(item.quantity || 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "rgba(15,23,42,.76)",
                  }}
                >
                  {Number(item.unitPrice || 0).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#0f172a",
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

function OrderDetailModal({ open, order, dealer, loading, onClose }) {
  if (!open || !order) return null;

  const resolvedItems = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.snapshot?.items)
      ? order.snapshot.items
      : [];

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1120}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle={
            dealer?.companyName
              ? `${dealer.companyName} · Full order record`
              : "Complete order record"
          }
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton
                subtle
                onClick={() => downloadOrderSummaryPdf({ order, dealer })}
              >
                Download PDF
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
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,.9fr)",
            gap: 18,
          }}
        >
          <GlassCard style={{ padding: 18, background: "#fff" }}>
            <Label>Order Items</Label>
            <div style={{ marginTop: 10 }}>
              {loading ? (
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
                  Loading order items...
                </div>
              ) : (
                <OrderItemsTable items={resolvedItems} />
              )}
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
                  value={order?.payment?.reference}
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

export default function AdminDealerOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)\/orders$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeOrder, setActiveOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const ordersQuery = useGetAdminScopedOrdersQuery({ dealerId }, { skip: !dealerId });
  const [fetchOrderDetail] = useLazyGetAdminScopedOrderQuery();

  const dealer = dealerQuery.data || null;
  const allDealerOrders = useMemo(() => {
    const incomingOrders = ordersQuery.data?.items || [];
    return incomingOrders.filter((order) => {
      const directDealerId = String(order?.dealerId?._id || order?.dealerId || "");
      const snapshotDealerId = String(order?.dealerSnapshot?._id || "");
      return directDealerId === dealerId || snapshotDealerId === dealerId;
    });
  }, [ordersQuery.data, dealerId]);

  const loading =
    !dealer &&
    allDealerOrders.length === 0 &&
    (dealerQuery.isLoading || ordersQuery.isLoading);
  const refreshing =
    Boolean(dealer || allDealerOrders.length) &&
    (dealerQuery.isFetching || ordersQuery.isFetching);
  const queryError = dealerQuery.error?.message || ordersQuery.error?.message || "";

  function loadPageData() {
    dealerQuery.refetch();
    ordersQuery.refetch();
  }

  useEffect(() => {
    setActiveOrder((current) => {
      if (!current?._id) return null;
      return allDealerOrders.find((item) => item._id === current._id) || current;
    });
  }, [allDealerOrders]);

  async function handleOpenOrder(nextOrder) {
    if (!nextOrder?._id) return;

    try {
      setDetailLoading(true);
      setError("");
      const fullOrder = await fetchOrderDetail(nextOrder._id, true).unwrap();
      setActiveOrder(fullOrder || nextOrder);
    } catch (err) {
      setActiveOrder(nextOrder);
      setError(
        err?.data?.error ||
          err?.data?.message ||
          err?.message ||
          "Failed to load full order details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const searchedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDealerOrders;

    return allDealerOrders.filter((order) =>
      [
        order.orderNumber,
        order.payment?.method,
        order.payment?.reference,
        order.dealerNote,
        order.internalNote,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [allDealerOrders, search]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "ALL") return searchedOrders;
    return searchedOrders.filter(
      (order) => String(order.status || "").toUpperCase() === statusFilter,
    );
  }, [searchedOrders, statusFilter]);

  const countsByFilter = useMemo(() => {
    return {
      ALL: allDealerOrders.length,
      SUBMITTED: allDealerOrders.filter((o) => o.status === "SUBMITTED").length,
      VERIFIED: allDealerOrders.filter((o) => o.status === "VERIFIED").length,
      REJECTED: allDealerOrders.filter((o) => o.status === "REJECTED").length,
      ARCHIVED: allDealerOrders.filter((o) => o.status === "ARCHIVED").length,
    };
  }, [allDealerOrders]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <ActionButton
          subtle
          onClick={() => navigate(`/admin/dashboard/dealers`)}
        >
          ← Back
        </ActionButton>

        {dealer?.companyName ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,.78)",
              border: "1px solid rgba(15,23,42,.08)",
              color: "#0f172a",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "-0.01em",
            }}
          >
            {dealer.companyName}
          </div>
        ) : null}
      </div>

      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Order History"
          subtitle={refreshing ? "Updating cached dealer orders in the background." : "Search and inspect every order submitted by this dealer."}
          action={
            <ActionButton subtle onClick={loadPageData}>
              Refresh
            </ActionButton>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search order number, payment, notes..."
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
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

            <ActionButton subtle onClick={loadPageData}>
              Apply Search
            </ActionButton>
          </div>
        </div>

        {(error || queryError) ? (
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
            {error || queryError}
          </div>
        ) : null}
      </GlassCard>

      {loading ? (
        <LoadingState />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          companyName={dealer?.companyName}
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filteredOrders.map((order) => (
            <OrderRow key={order._id} order={order} onOpen={handleOpenOrder} />
          ))}
        </div>
      )}

      <OrderDetailModal
        open={Boolean(activeOrder)}
        order={activeOrder}
        dealer={dealer}
        loading={detailLoading}
        onClose={() => {
          setActiveOrder(null);
          setDetailLoading(false);
        }}
      />
    </div>
  );
}
