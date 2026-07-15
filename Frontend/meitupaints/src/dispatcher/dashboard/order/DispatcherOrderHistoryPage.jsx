import { useMemo, useState } from "react";
import { useGetDispatcherReplenishmentOrderQuery, useGetDispatcherReplenishmentOrdersQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
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

const HISTORY_FILTERS = [
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_STEPS = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "COMPLETED", label: "Completed" },
];

function titleCaseLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return "positive";
  if (s === "REJECTED" || s === "CANCELLED") return "critical";
  if (s === "DISPATCHED" || s === "VERIFIED") return "accent";
  return "caution";
}

function StatusStepper({ status }) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "REJECTED" || normalized === "CANCELLED") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)" }}>
        <DashboardIcon name="reject" size={14} strokeWidth={2} style={{ color: "#b42318" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#b42318" }}>{normalized === "CANCELLED" ? "Cancelled" : "Rejected"}</span>
      </div>
    );
  }

  const activeIndex = STATUS_STEPS.findIndex((step) => step.key === normalized);

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {STATUS_STEPS.map((step, index) => {
        const reached = activeIndex >= 0 && index <= activeIndex;
        const isLast = index === STATUS_STEPS.length - 1;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 64 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: reached ? "var(--color-azure, #0071e3)" : "var(--color-fog, #f5f5f7)",
                  color: reached ? "#fff" : "var(--color-graphite, #707070)",
                  flexShrink: 0,
                }}
              >
                {reached ? <DashboardIcon name="checkmark" size={10} strokeWidth={3} /> : null}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, textAlign: "center", color: reached ? "var(--color-ink, #1d1d1f)" : "var(--color-graphite, #707070)" }}>
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <div style={{ flex: 1, height: 2, marginBottom: 16, background: index < activeIndex ? "var(--color-azure, #0071e3)" : "rgba(0,0,0,.08)" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OrderItemsTable({ items = [] }) {
  if (!items.length) return <EmptyState icon="package" title="No items found" />;

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
                  <div style={{ fontWeight: 600, color: "var(--color-ink, #1d1d1f)", fontSize: 13 }}>{item.name || "—"}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku || item.code || ""}</div>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>{item.packLabel || "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                  {Number(item.quantity || 0).toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-ink, #1d1d1f)" }}>
                  {Number(item.unitPrice || 0).toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
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

function ReplenishmentOrderModal({ orderId, onClose }) {
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
              <SectionHeader
                eyebrow="Order"
                icon="package"
                title={order.orderNumber || "Order"}
                subtitle={`Placed ${formatDate(order.createdAt)}`}
              />
              <CloseButton onClick={onClose} />
            </div>

            <StatusStepper status={order.status} />

            <OrderItemsTable items={order.items || []} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.06)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Payment</div>
                <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{order.payment?.method || "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Total</div>
                <div style={{ marginTop: 2, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{money(order.totals?.total, order.totals?.currency)}</div>
              </div>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}

function OrderHistoryRow({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item._id)}
      className="dash-list-row dash-selectable-row"
      style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.orderNumber || "Unnamed Order"}</span>
          <Pill tone={statusTone(item.status)} size="small">{titleCaseLabel(item.status)}</Pill>
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {formatDate(item.createdAt)} · {Array.isArray(item.items) ? `${item.items.length} item${item.items.length === 1 ? "" : "s"}` : "—"}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
        {money(item.totals?.total, item.totals?.currency)}
      </div>
      <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
    </button>
  );
}

export default function DispatcherOrderHistoryPage() {
  const [filter, setFilter] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const queryParams = useMemo(() => {
    if (filter === "COMPLETED") return { status: "COMPLETED", q: search };
    if (filter === "REJECTED") return { status: "REJECTED", q: search };
    return { q: search };
  }, [filter, search]);

  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery(queryParams);
  const items = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);

  const loading = ordersQuery.isLoading;
  const loadError = ordersQuery.error ? getQueryErrorMessage(ordersQuery.error, "Failed to load your orders.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="history"
          title="Order History"
          subtitle="Track every order you've placed with the Factory, from submission through delivery."
          action={<GhostButton icon="refresh" onClick={() => ordersQuery.refetch()}>Refresh</GhostButton>}
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SegmentedControl options={HISTORY_FILTERS} value={filter} onChange={setFilter} />
          <div style={{ maxWidth: 320, flex: 1, minWidth: 220 }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search order number…" />
          </div>
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="history" title="No orders here yet" subtitle="Orders you place from the catalog will show up in this list." />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {items.map((item) => (
            <OrderHistoryRow key={item._id} item={item} onOpen={setSelectedOrderId} />
          ))}
        </Surface>
      )}

      <ReplenishmentOrderModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
