import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetDispatcherDealerQuery, useGetDispatcherOrdersQuery } from "../../../redux/api/meituApi.js";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
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
  { key: "ALL", label: "All", status: "SUBMITTED,VERIFIED,REJECTED,DISPATCHED" },
  { key: "SUBMITTED", label: "Submitted", status: "SUBMITTED" },
  { key: "VERIFIED", label: "Verified", status: "VERIFIED" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
  { key: "ARCHIVED", label: "Dispatched", status: "DISPATCHED" },
];

function statusTone(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "VERIFIED" || normalized === "DISPATCHED") return "positive";
  if (normalized === "REJECTED") return "critical";
  return "caution";
}

function normalizeStatus(status) {
  return String(status || "").toUpperCase().trim();
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function extractDealerIdFromPath(pathname) {
  const match = pathname.match(/^\/dispatcher\/dashboard\/dealers\/([^/]+)\/orders$/);
  return match?.[1] || "";
}

function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {children}
      </div>
    </div>
  );
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
    <button
      type="button"
      onClick={() => onOpen(order)}
      className="dash-list-row dash-selectable-row"
      style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{order.orderNumber || "Unnamed Order"}</span>
          <Pill tone={statusTone(order.status)} size="small">{normalizeStatus(order.status)}</Pill>
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {money(order?.totals?.total, order?.totals?.currency || "NPR")} · {order?.payment?.method || "No payment method"} ·{" "}
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
        {Array.isArray(order.items) ? `${order.items.length} items` : "—"}
      </div>
    </button>
  );
}

function OrderItemsTable({ items = [] }) {
  if (!items.length) {
    return <EmptyState icon="package" title="No items found" />;
  }

  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
              {["Item", "Pack", "Qty", "Rate", "Amount"].map((head) => (
                <th
                  key={head}
                  style={{
                    textAlign: head === "Item" || head === "Pack" ? "left" : "right",
                    padding: "10px 14px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--color-graphite, #707070)",
                  }}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.sku || item.code || item.name}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "10px 14px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 600, color: "var(--color-ink, #1d1d1f)", fontSize: 13 }}>{item.name || item.nameSnapshot || "—"}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku || item.skuSnapshot || item.code || ""}</div>
                  {item.components?.length ? (
                    <div style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-graphite, #707070)", lineHeight: 1.4 }}>
                      Includes: {item.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                  {item.packLabel || item.variantLabel || item.unit || item.uom || "—"}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                  {Number(item.quantity ?? item.qty ?? 0).toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                  {Number(item.unitPrice ?? item.rate ?? 0).toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
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

function OrderDetailModal({ open, order, dealer, onClose, onGoToGlobalOrders, onDownloadPdf }) {
  if (!open || !order) return null;

  const normalizedStatus = normalizeStatus(order.status);
  const canDownloadPdf = normalizedStatus === "VERIFIED" || normalizedStatus === "DISPATCHED";

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(1000px, 100%)", maxHeight: "92vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <SectionHeader
          eyebrow="Order"
          icon="orders"
          title={order.orderNumber || "Order Detail"}
          subtitle="Dispatcher-side review of this dealer's order."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <GhostButton icon="download" onClick={() => onDownloadPdf(order)} disabled={!canDownloadPdf}>
                PDF
              </GhostButton>
              <GhostButton icon="orders" onClick={onGoToGlobalOrders}>Open in Orders</GhostButton>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                <DashboardIcon name="close" size={14} strokeWidth={2} />
              </button>
            </div>
          }
        />

        <div style={{ marginTop: 14 }}>
          <Pill tone={statusTone(order.status)} size="small">{normalizedStatus}</Pill>
        </div>

        {!canDownloadPdf ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", fontSize: 13, fontWeight: 500 }}>
            PDF download becomes available after the order is verified.
          </div>
        ) : null}

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.85fr)", gap: 18 }}>
          <div>
            <CardLabel icon="package">Order Items</CardLabel>
            <div style={{ marginTop: 10 }}>
              <OrderItemsTable items={order.items || []} />
            </div>
          </div>

          <div>
            <CardLabel icon="store">Order Context</CardLabel>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <DetailItem label="Dealer" value={dealer?.companyName} />
              <DetailItem label="Contact" value={dealer?.contactName} />
              <DetailItem label="Total" value={money(order?.totals?.total, order?.totals?.currency || "NPR")} />
              <DetailItem label="Payment Method" value={order?.payment?.method} />
              <DetailItem label="Payment Reference" value={order?.payment?.reference || order?.payment?.referenceNo} />
              <DetailItem label="Dealer Note" value={order?.dealerNote} />
              <DetailItem label="Internal Note" value={order?.internalNote} />
              <DetailItem label="Submitted" value={order?.createdAt ? new Date(order.createdAt).toLocaleString() : "—"} />
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

export default function DispatcherDealerOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => extractDealerIdFromPath(location.pathname), [location.pathname]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeOrder, setActiveOrder] = useState(null);

  const activeFilter = ORDER_FILTERS.find((filter) => filter.key === statusFilter) || ORDER_FILTERS[0];
  const orderParams = useMemo(() => ({ dealerId, status: activeFilter.status, limit: 100 }), [dealerId, activeFilter.status]);

  const dealerQuery = useGetDispatcherDealerQuery(dealerId, { skip: !dealerId });
  const ordersQuery = useGetDispatcherOrdersQuery(orderParams, { skip: !dealerId });

  const dealer = dealerQuery.data?.item || null;
  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);

  const loading = !dealer && (dealerQuery.isLoading || ordersQuery.isLoading);
  const refreshing = Boolean(dealer) && (dealerQuery.isFetching || ordersQuery.isFetching);
  const error = dealerQuery.error?.message || ordersQuery.error?.message || "";

  function loadPageData() {
    dealerQuery.refetch();
    ordersQuery.refetch();
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [order.orderNumber, order.payment?.method, order.payment?.reference, order.payment?.referenceNo, order.dealerNote, order.internalNote]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [orders, search]);

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
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {error ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
        <EmptyState icon="store" title="Dealer not found" subtitle="This dealer is not currently assigned to your dispatcher account." />
        <div>
          <GhostButton onClick={() => navigate("/dispatcher/dashboard/dealers")}>Back to Dealers</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar label={dealer.companyName || dealer.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer.companyName || "Assigned Dealer"} · Order History
              </div>
              <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {refreshing ? "Updating…" : "Every order from this dealer within your dispatcher scope."}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <GhostButton icon="user" onClick={() => navigate(`/dispatcher/dashboard/dealers/${dealerId}`)}>Profile</GhostButton>
            <GhostButton onClick={() => navigate("/dispatcher/dashboard/dealers")}>Back to Dealers</GhostButton>
          </div>
        </div>
      </Surface>

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Dealer Orders"
          action={<GhostButton icon="refresh" onClick={loadPageData}>Refresh</GhostButton>}
        />

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search order number, payment, notes…" />
          </div>
          <SegmentedControl options={ORDER_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      {filteredOrders.length === 0 ? (
        <EmptyState icon="orders" title="No orders found" subtitle="Try adjusting the search or status filter." />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {filteredOrders.map((order) => (
            <OrderRow key={order._id} order={order} onOpen={setActiveOrder} />
          ))}
        </Surface>
      )}

      <OrderDetailModal
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
