import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDealerQuery,
  useGetAdminScopedOrdersQuery,
  useLazyGetAdminScopedOrderQuery,
} from "../../../redux/api/meituApi.js";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

const ORDER_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVED", label: "Archived" },
];

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

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "VERIFIED") return "positive";
  if (s === "REJECTED") return "critical";
  if (s === "ARCHIVED") return "neutral";
  return "caution";
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-ink, #1d1d1f)", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function OrderRow({ order, onOpen }) {
  return (
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
      className="dash-list-row dash-selectable-row"
      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 130px 100px", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer" }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.orderNumber || "Unnamed Order"}</div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{order?.payment?.method || "No payment method"} · {Array.isArray(order.items) ? `${order.items.length} items` : "—"}</div>
      </div>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(order.createdAt)}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{money(order?.totals?.total, order?.totals?.currency)}</span>
      <span><Pill tone={statusTone(order.status)} size="small">{order.status || "—"}</Pill></span>
    </div>
  );
}

function OrderItemsTable({ items = [] }) {
  if (!items.length) {
    return <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>No items found.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Item", "Pack", "Qty", "Rate", "Amount"].map((head) => (
              <th key={head} style={{ textAlign: head === "Item" || head === "Pack" ? "left" : "right", padding: "8px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.sku || item.code || item.name}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
              <td style={{ padding: "8px 10px" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>{item.name || "—"}</div>
                <div style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{item.sku || item.code || ""}</div>
              </td>
              <td style={{ padding: "8px 10px", fontSize: 12.5 }}>{item.packLabel || item.variantLabel || item.unit || "—"}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{Number(item.quantity || 0).toLocaleString()}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5 }}>{Number(item.unitPrice || 0).toLocaleString()}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{Number(item.lineTotal || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(920px, 100%)", maxHeight: "90vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader eyebrow={dealer?.companyName || "Dealer"} icon="orders" title={order.orderNumber || "Order Detail"} />
          <CloseButton onClick={onClose} />
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={statusTone(order.status)} size="small">{order.status || "—"}</Pill>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{money(order?.totals?.total, order?.totals?.currency)}</span>
          <GhostButton icon="download" onClick={() => downloadOrderSummaryPdf({ order, dealer })}>
            Download PDF
          </GhostButton>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.9fr)", gap: 16 }}>
          <Surface padding={0} style={{ border: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--color-graphite, #707070)" }}>Order Items</div>
            {loading ? (
              <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>Loading order items…</div>
            ) : (
              <OrderItemsTable items={resolvedItems} />
            )}
          </Surface>

          <Surface padding={16} style={{ display: "grid", gap: 12 }}>
            <DetailItem label="Dealer" value={dealer?.companyName} />
            <DetailItem label="Contact" value={dealer?.contactName} />
            <DetailItem label="Phone" value={dealer?.phone} />
            <DetailItem label="Email" value={dealer?.email} />
            <DetailItem label="Payment Method" value={order?.payment?.method} />
            <DetailItem label="Payment Reference" value={order?.payment?.reference} />
            {order?.dealerNote ? <DetailItem label="Dealer Note" value={order.dealerNote} /> : null}
            {order?.internalNote ? <DetailItem label="Internal Note" value={order.internalNote} /> : null}
            <DetailItem label="Submitted" value={order?.createdAt ? new Date(order.createdAt).toLocaleString() : "—"} />
          </Surface>
        </div>
      </Surface>
    </div>
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

  const dealer = dealerQuery.data?.item || null;
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
  const isRefreshing =
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

  const filterOptions = ORDER_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}`)}>Back to Dealer Profile</BackLink>

      <Surface padding={18} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Order History"
          subtitle={dealer?.companyName || ""}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              <GhostButton icon="refresh" onClick={loadPageData}>Refresh</GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 320, flex: "1 1 240px" }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search order number, payment, notes…" />
          </div>
          <SegmentedControl options={filterOptions} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {(error || queryError) ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error || queryError}</div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : filteredOrders.length === 0 ? (
        <Surface padding={20}>
          <EmptyState
            icon="orders"
            title="No orders found"
            subtitle={dealer?.companyName ? `No matching order records were found for ${dealer.companyName}.` : "No matching order records were found for this dealer."}
          />
          <div style={{ marginTop: 4 }}>
            <GhostButton onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>Clear filters</GhostButton>
          </div>
        </Surface>
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {filteredOrders.map((order) => (
            <OrderRow key={order._id} order={order} onOpen={handleOpenOrder} />
          ))}
        </Surface>
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
