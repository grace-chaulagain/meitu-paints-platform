import { useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.js";
import {
  useAmendAdminOrderMutation,
  useDeleteAdminOrderMutation,
  useGetAdminOrderQuery,
  useGetAdminOrdersQuery,
  useGetVerifiedDispatchersQuery,
  useRejectAdminOrderMutation,
  useSendAdminOrderToFactoryMutation,
  useVerifyAdminOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";

const STATUS_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "ARCHIVE", label: "Archive" },
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

function SearchInput({ value, onChange, onSubmit, onClear }) {
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
        placeholder="Search order number or dealer..."
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

function StatusSegmentedControl({ value, options, counts, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 4,
        borderRadius: 999,
        border: "1px solid rgba(15,23,42,.08)",
        background: "rgba(241,245,249,.92)",
        boxShadow: "inset 0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            style={{
              minHeight: 34,
              padding: "0 13px",
              borderRadius: 999,
              border: "1px solid transparent",
              background: active ? "#fff" : "transparent",
              color: active ? "#0f172a" : "rgba(15,23,42,.58)",
              fontSize: 12,
              fontWeight: 950,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: active ? "0 8px 20px rgba(15,23,42,.10)" : "none",
              transform: active ? "translateY(-1px)" : "translateY(0)",
              transition:
                "background .2s ease, color .2s ease, box-shadow .2s ease, transform .2s ease",
            }}
          >
            <span>{option.label}</span>
            {typeof counts?.[option.key] === "number" ? (
              <span
                style={{
                  minWidth: 21,
                  height: 21,
                  padding: "0 6px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active
                    ? "rgba(180,35,24,.08)"
                    : "rgba(15,23,42,.06)",
                  color: active ? "#b42318" : "rgba(15,23,42,.58)",
                  fontSize: 11,
                  fontWeight: 950,
                  transition: "background .2s ease, color .2s ease",
                }}
              >
                {counts[option.key]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function UtilityReportsButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        color: "#0f172a",
        fontWeight: 950,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(180,35,24,.08)",
          color: "#b42318",
          fontSize: 13,
          fontWeight: 950,
        }}
      >
        ↓
      </span>
      Utility Reports
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  subtle = false,
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
  const tone =
    status === "VERIFIED"
      ? {
          bg: "rgba(22,163,74,.08)",
          color: "#15803d",
          border: "1px solid rgba(22,163,74,.12)",
        }
      : status === "REJECTED"
        ? {
            bg: "rgba(180,35,24,.08)",
            color: "#b42318",
            border: "1px solid rgba(180,35,24,.12)",
          }
        : {
            bg: "rgba(15,23,42,.05)",
            color: "#475569",
            border: "1px solid rgba(15,23,42,.08)",
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
      {mode || "FACTORY"}
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

function formatRelativeTime(value) {
  if (!value) return "Placed date unavailable";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "Placed date unavailable";

  const diffSeconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return "Placed just now";

  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    const valueCount = Math.floor(diffSeconds / seconds);
    if (valueCount >= 1) {
      return `Placed ${valueCount} ${unit}${valueCount > 1 ? "s" : ""} ago`;
    }
  }

  return "Placed just now";
}

function toSafeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function deriveLineTotal(quantity, unitPrice) {
  return toSafeNumber(quantity) * toSafeNumber(unitPrice);
}

function OrdersRow({ item, onOpen }) {
  const dealer = item?.dealerSnapshot || item?.dealerId || {};
  const dispatcher = item?.dispatcherSnapshot || item?.dispatcherId || {};
  const orderTotal = item?.totals?.total || 0;
  const currency = item?.totals?.currency || "NPR";
  const routingMode =
    item?.dealerSnapshot?.fulfillmentMode ||
    item?.dealerId?.fulfillmentMode ||
    "FACTORY";
  const paymentMethod = item?.payment?.method || "No payment method";
  const dealerName =
    dealer?.companyName || dealer?.contactName || "Unassigned dealer";
  const dispatcherName =
    dispatcher?.name || dispatcher?.companyName || "Assigned dispatcher";

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
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
              alignItems: "center",
              gap: 8,
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
              {dealerName}
            </div>
            <RoutingBadge mode={routingMode} />
          </div>

          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(15,23,42,.56)",
            }}
          >
            <span>{item.orderNumber || "Unnamed Order"}</span>
            {dealer?.contactName ? <span>•</span> : null}
            {dealer?.contactName ? <span>{dealer.contactName}</span> : null}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(15,23,42,.56)",
            }}
          >
            <span>{money(orderTotal, currency)}</span>
            <span>•</span>
            <span>{paymentMethod}</span>
          </div>
          {routingMode === "DISPATCHER" ? (
            <div
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                minHeight: 30,
                padding: "0 10px",
                borderRadius: 999,
                border: "1px solid rgba(180,35,24,.12)",
                background: "rgba(180,35,24,.06)",
                color: "#991b1b",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              <span style={{ color: "rgba(153,27,27,.68)" }}>Routed to</span>
              <strong style={{ color: "#7f1d1d", fontWeight: 950 }}>
                {dispatcherName}
              </strong>
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <StatusBadge status={item.status} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(15,23,42,.48)",
            }}
          >
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 86,
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

function EmptyState({ onReset, archiveMode }) {
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
        {archiveMode ? "No archived orders found" : "No pending orders found"}
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
        Try adjusting the search filters to review order records.
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

function OrderViewModal({
  open,
  order,
  busyAction,
  onClose,
  onAmend,
  onVerify,
  onReject,
  onSendToFactory,
  onDelete,
}) {
  if (!open || !order) return null;

  const dealer = order?.dealerSnapshot || order?.dealerId || {};
  const dispatcher = order?.dispatcherSnapshot || order?.dispatcherId || {};

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1120}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle="Order, dealer, routing, payment, and item detail"
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
                onClick={() => downloadOrderSummaryPdf({ order, dealer })}
              >
                Download PDF
              </ActionButton>
              <ActionButton
                danger
                onClick={() => onDelete(order)}
                disabled={busyAction === `delete-${order._id}`}
              >
                {busyAction === `delete-${order._id}`
                  ? "Moving..."
                  : "Delete"}
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
          <StatusBadge status={order.status} />
          <RoutingBadge mode={dealer?.fulfillmentMode || "FACTORY"} />
        </div>

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
              <Label>Dealer Context</Label>
              <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                <DetailItem label="Dealer" value={dealer?.companyName} />
                <DetailItem label="Contact" value={dealer?.contactName} />
                <DetailItem label="Phone" value={dealer?.phone} />
                <DetailItem label="Email" value={dealer?.email} />
                <DetailItem label="Address" value={dealer?.address} />
                <DetailItem
                  label="Assigned Dispatcher"
                  value={dispatcher?.name || "Factory handled"}
                />
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Order & Payment Context</Label>
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
                <DetailItem
                  label="Payment Reference"
                  value={order?.payment?.reference}
                />
                <DetailItem label="Payment Note" value={order?.payment?.note} />
                <DetailItem label="Dealer Note" value={order?.dealerNote} />
                <DetailItem label="Internal Note" value={order?.internalNote} />
                <DetailItem
                  label="Review Note"
                  value={order?.review?.reviewNote}
                />
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

        {order.status === "SUBMITTED" ? (
          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <ActionButton
              subtle
              onClick={() => onAmend(order)}
              disabled={busyAction === `amend-${order._id}`}
            >
              Amend Order
            </ActionButton>

            <ActionButton
              onClick={() => onVerify(order)}
              disabled={busyAction === `verify-${order._id}`}
            >
              {busyAction === `verify-${order._id}` ? "Verifying..." : "Verify"}
            </ActionButton>

            {(order?.dealerSnapshot?.fulfillmentMode || "FACTORY") === "FACTORY" ? (
              <ActionButton
                onClick={() => onSendToFactory(order)}
                disabled={busyAction === `factory-${order._id}`}
              >
                {busyAction === `factory-${order._id}`
                  ? "Sending..."
                  : "Send to Factory"}
              </ActionButton>
            ) : null}

            <ActionButton
              danger
              onClick={() => onReject(order)}
              disabled={busyAction === `reject-${order._id}`}
            >
              {busyAction === `reject-${order._id}` ? "Rejecting..." : "Reject"}
            </ActionButton>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

function LineEditor({ item, onChange, onRemove, currency = "NPR" }) {
  const lineTotal = deriveLineTotal(item.quantity, item.unitPrice);

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0,1.2fr) minmax(150px,.8fr) 110px 130px auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <Label>Item Name</Label>
          <input
            value={item.name || ""}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            placeholder="Product name"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Label>Pack / Variant</Label>
          <input
            value={item.packLabel || item.variantLabel || ""}
            onChange={(e) =>
              onChange({
                ...item,
                packLabel: e.target.value,
              })
            }
            placeholder="10L / variant"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Label>Qty</Label>
          <input
            type="number"
            min="0"
            value={item.quantity ?? 0}
            onChange={(e) =>
              onChange({
                ...item,
                quantity: toSafeNumber(e.target.value),
                lineTotal: deriveLineTotal(e.target.value, item.unitPrice),
              })
            }
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Label>Unit Rate</Label>
          <input
            type="number"
            min="0"
            value={item.unitPrice ?? 0}
            onChange={(e) =>
              onChange({
                ...item,
                unitPrice: toSafeNumber(e.target.value),
                lineTotal: deriveLineTotal(item.quantity, e.target.value),
              })
            }
            style={inputStyle}
          />
        </div>

        <ActionButton subtle danger onClick={onRemove}>
          Remove
        </ActionButton>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 180px minmax(0,1fr)",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <Label>SKU</Label>
          <input
            value={item.sku || ""}
            onChange={(e) => onChange({ ...item, sku: e.target.value })}
            placeholder="SKU"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Label>Code</Label>
          <input
            value={item.code || ""}
            onChange={(e) => onChange({ ...item, code: e.target.value })}
            placeholder="Code"
            style={inputStyle}
          />
        </div>

        <div
          style={{
            justifySelf: "end",
            textAlign: "right",
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(15,23,42,.44)",
            }}
          >
            Line Total
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: 950,
              color: "#0f172a",
            }}
          >
            {money(lineTotal, currency)}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  padding: 14,
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
  resize: "vertical",
};

function AmendModal({ open, order, saving, onClose, onSave }) {
  const [items, setItems] = useState(() =>
    (order?.items || []).map((item) => ({
      ...item,
      quantity: toSafeNumber(item.quantity),
      unitPrice: toSafeNumber(item.unitPrice),
      lineTotal: toSafeNumber(item.lineTotal),
    })),
  );
  const [dealerNote, setDealerNote] = useState(order?.dealerNote || "");
  const [internalNote, setInternalNote] = useState(order?.internalNote || "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  if (!open || !order) return null;

  const currency = order?.totals?.currency || "NPR";
  const subtotal = items.reduce(
    (sum, item) => sum + deriveLineTotal(item.quantity, item.unitPrice),
    0,
  );

  function updateItem(index, nextItem) {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...nextItem,
              quantity: toSafeNumber(nextItem.quantity),
              unitPrice: toSafeNumber(nextItem.unitPrice),
              lineTotal: deriveLineTotal(nextItem.quantity, nextItem.unitPrice),
            }
          : item,
      ),
    );
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        sku: "",
        code: "",
        name: "",
        category: "",
        variantLabel: "",
        packLabel: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        lineTotal: 0,
        notes: "",
      },
    ]);
  }

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1180}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title="Amend Order"
          subtitle={`Update ${order.orderNumber || "order"} before verification.`}
          action={
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
          }
        />

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "minmax(0,1.15fr) minmax(320px,.85fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Label>Order Items</Label>
              <ActionButton subtle onClick={addItem}>
                Add Item
              </ActionButton>
            </div>

            {items.length === 0 ? (
              <GlassCard style={{ padding: 18, background: "#fff" }}>
                <div
                  style={{
                    fontWeight: 800,
                    color: "rgba(15,23,42,.56)",
                  }}
                >
                  No line items left. Add at least one item to save the
                  amendment.
                </div>
              </GlassCard>
            ) : (
              items.map((item, index) => (
                <LineEditor
                  key={`${item.sku || item.code || "line"}-${index}`}
                  item={item}
                  onChange={(nextItem) => updateItem(index, nextItem)}
                  onRemove={() => removeItem(index)}
                  currency={currency}
                />
              ))
            )}
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Amendment Summary</Label>
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                <DetailItem label="Order" value={order.orderNumber} />
                <DetailItem label="Line Count" value={items.length} />
                <DetailItem
                  label="Updated Total"
                  value={money(subtotal, currency)}
                />
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <Label>Dealer Note</Label>
                  <textarea
                    rows={4}
                    value={dealerNote}
                    onChange={(e) => setDealerNote(e.target.value)}
                    style={textareaStyle}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <Label>Internal Note</Label>
                  <textarea
                    rows={4}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    style={textareaStyle}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <Label>Reason</Label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for amendment"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <Label>Amendment Note</Label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional internal note"
                    style={inputStyle}
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {localError ? (
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
            {localError}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <ActionButton subtle onClick={onClose} disabled={saving}>
            Cancel
          </ActionButton>
          <ActionButton
            onClick={() => {
              if (!items.length) {
                setLocalError("At least one item is required.");
                return;
              }

              const invalid = items.some(
                (item) =>
                  !String(item.name || "").trim() ||
                  toSafeNumber(item.quantity) <= 0,
              );

              if (invalid) {
                setLocalError(
                  "Each line needs a product name and quantity greater than zero.",
                );
                return;
              }

              setLocalError("");
              onSave({
                items: items.map((item) => ({
                  ...item,
                  quantity: toSafeNumber(item.quantity),
                  unitPrice: toSafeNumber(item.unitPrice),
                  lineTotal: deriveLineTotal(item.quantity, item.unitPrice),
                })),
                dealerNote: dealerNote.trim(),
                internalNote: internalNote.trim(),
                reason: reason.trim(),
                note: note.trim(),
              });
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Amendment"}
          </ActionButton>
        </div>
      </div>
    </ModalShell>
  );
}

export default function AdminOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [filterMode, setFilterMode] = useState("PENDING");
  const [routeMode, setRouteMode] = useState("FACTORY");
  const [activeOrder, setActiveOrder] = useState(null);
  const [amendOrder, setAmendOrder] = useState(null);
  const [deleteOrder, setDeleteOrder] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const resultsRef = useRef(null);

  const queryOrderId = useMemo(() => {
    return new URLSearchParams(location.search || "").get("orderId") || "";
  }, [location.search]);

  const clearOrderQuery = useCallback(() => {
    if (!queryOrderId) return;
    navigate(
      {
        pathname: location.pathname,
      },
      { replace: true },
    );
  }, [location.pathname, navigate, queryOrderId]);

  const openOrderPreview = useCallback(
    (order) => {
      setActiveOrder(order);
      clearOrderQuery();
    },
    [clearOrderQuery],
  );

  const closeOrderPreview = useCallback(() => {
    if (busyAction) return;
    setActiveOrder(null);
    clearOrderQuery();
  }, [busyAction, clearOrderQuery]);

  const orderParams = useMemo(() => {
    const params = {};

    if (filterMode === "ARCHIVE") {
      params.archive = true;
    } else {
      params.status = "SUBMITTED";
    }

    if (routeMode === "DISPATCHER_ALL") {
      params.fulfillmentMode = "DISPATCHER";
    } else if (String(routeMode).startsWith("DISPATCHER:")) {
      params.fulfillmentMode = "DISPATCHER";
      params.dispatcherId = String(routeMode).split(":")[1] || "";
    } else if (routeMode !== "ALL") {
      params.fulfillmentMode = routeMode;
    }

    if (committedSearch.trim()) {
      params.q = committedSearch.trim();
    }

    return params;
  }, [committedSearch, filterMode, routeMode]);

  const ordersQuery = useGetAdminOrdersQuery(orderParams);
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const orderDetailQuery = useGetAdminOrderQuery(queryOrderId, {
    skip: !queryOrderId,
  });
  const [verifyAdminOrder] = useVerifyAdminOrderMutation();
  const [rejectAdminOrder] = useRejectAdminOrderMutation();
  const [amendAdminOrder] = useAmendAdminOrderMutation();
  const [deleteAdminOrder] = useDeleteAdminOrderMutation();
  const [sendAdminOrderToFactory] = useSendAdminOrderToFactoryMutation();

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const dispatchers = useMemo(
    () => dispatchersQuery.data?.items || [],
    [dispatchersQuery.data],
  );

  const loading = ordersQuery.isLoading && orders.length === 0;
  const isRefreshing =
    !loading &&
    (ordersQuery.isFetching ||
      dispatchersQuery.isFetching ||
      orderDetailQuery.isFetching);
  const queryError =
    ordersQuery.error || dispatchersQuery.error || orderDetailQuery.error;
  const error =
    actionError ||
    (queryError ? getQueryErrorMessage(queryError, "Failed to load orders.") : "");

  const activeOrderView = useMemo(() => {
    if (queryOrderId) {
      return (
        orderDetailQuery.data?.item ||
        orders.find((item) => item._id === queryOrderId) ||
        null
      );
    }

    if (!activeOrder?._id) return null;
    return orders.find((item) => item._id === activeOrder._id) || activeOrder;
  }, [activeOrder, orderDetailQuery.data, orders, queryOrderId]);

  const routingFilters = useMemo(
    () => [
      { key: "FACTORY", label: "Factory orders" },
      { key: "DISPATCHER_ALL", label: "All dispatcher orders" },
      ...dispatchers.map((dispatcher) => ({
        key: `DISPATCHER:${dispatcher._id}`,
        label: dispatcher.companyName || dispatcher.name || "Dispatcher",
      })),
      { key: "ALL", label: "All routing" },
    ],
    [dispatchers],
  );

  const countsByFilter = useMemo(
    () => ({
      PENDING: filterMode === "PENDING" ? orders.length : undefined,
      ARCHIVE: filterMode === "ARCHIVE" ? orders.length : undefined,
    }),
    [orders, filterMode],
  );

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Action failed."));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  const applySearch = (nextSearch = search) => {
    setCommittedSearch(nextSearch);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const clearSearch = () => {
    setSearch("");
    setCommittedSearch("");
  };

  const resetFilters = () => {
    setSearch("");
    setCommittedSearch("");
    setFilterMode("PENDING");
    setRouteMode("FACTORY");
  };

  const handleVerify = async (order) => {
    const reviewNote = window.prompt("Optional verification note:", "") ?? "";
    const success = await runAction(`verify-${order._id}`, () =>
      verifyAdminOrder({
        orderId: order._id,
        payload: { reviewNote: reviewNote.trim() },
      }).unwrap(),
    );
    if (success) {
      setActiveOrder(null);
      clearOrderQuery();
    }
  };

  const handleReject = async (order) => {
    const reviewNote = window.prompt("Reason / rejection note:", "");
    if (reviewNote === null) return;

    const success = await runAction(`reject-${order._id}`, () =>
      rejectAdminOrder({
        orderId: order._id,
        payload: { reviewNote: reviewNote.trim() },
      }).unwrap(),
    );
    if (success) {
      setActiveOrder(null);
      clearOrderQuery();
    }
  };

  const handleSendToFactory = async (order) => {
    const note = window.prompt("Optional Factory handoff note:", "") ?? "";
    const success = await runAction(`factory-${order._id}`, () =>
      sendAdminOrderToFactory({
        orderId: order._id,
        payload: { note: note.trim() },
      }).unwrap(),
    );
    if (success) {
      setActiveOrder(null);
      clearOrderQuery();
    }
  };

  const handleSaveAmendment = async (payload) => {
    if (!amendOrder?._id) return;

    const success = await runAction(`amend-${amendOrder._id}`, async () => {
      const items = Array.isArray(payload.items) ? payload.items : [];
      const subtotal = items.reduce(
        (sum, item) => sum + Number(item?.lineTotal || 0),
        0,
      );

      await amendAdminOrder({
        orderId: amendOrder._id,
        payload: {
          items,
          totals: {
            subtotal,
            discount: 0,
            taxableAmount: subtotal,
            tax: 0,
            total: subtotal,
            currency: amendOrder?.totals?.currency || "NPR",
          },
          dealerNote: payload.dealerNote,
          internalNote: payload.internalNote,
          reason: payload.reason,
          note: payload.note,
        },
      }).unwrap();
    });

    if (success) {
      setAmendOrder(null);
      setActiveOrder(null);
      clearOrderQuery();
    }
  };

  const handleHardDelete = async (order) => {
    if (!order?._id) return;

    const success = await runAction(`delete-${order._id}`, () =>
      deleteAdminOrder({
        orderId: order._id,
        payload: {
          confirmation: deleteConfirmation,
          reason: "Admin moved order to trash",
        },
      }).unwrap(),
    );

    if (success) {
      setDeleteOrder(null);
      setDeleteConfirmation("");
      setActiveOrder(null);
      clearOrderQuery();
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Order Register"
          action={
            <UtilityReportsButton
              onClick={() => navigate("/admin/dashboard/orders/reports")}
            />
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatusSegmentedControl
            value={filterMode}
            options={STATUS_FILTERS}
            counts={countsByFilter}
            onChange={setFilterMode}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
            alignItems: "center",
          }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={() => applySearch(search)}
            onClear={clearSearch}
          />
          <select
            value={routeMode}
            onChange={(e) => setRouteMode(e.target.value)}
            style={{
              minHeight: 42,
              minWidth: 240,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              padding: "0 14px",
              color: "#0f172a",
              fontWeight: 900,
              outline: "none",
            }}
          >
            {routingFilters.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>
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
        ) : orders.length === 0 ? (
          <EmptyState
            archiveMode={filterMode === "ARCHIVE"}
            onReset={resetFilters}
          />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {orders.map((item) => (
              <OrdersRow
                key={item._id}
                item={item}
                onOpen={openOrderPreview}
              />
            ))}
          </div>
        )}
      </div>

      <OrderViewModal
        open={Boolean(activeOrderView)}
        order={activeOrderView}
        busyAction={busyAction}
        onClose={closeOrderPreview}
        onAmend={(order) => {
          setActiveOrder(null);
          clearOrderQuery();
          setAmendOrder(order);
        }}
        onVerify={handleVerify}
        onReject={handleReject}
        onSendToFactory={handleSendToFactory}
        onDelete={(order) => {
          setDeleteOrder(order);
          setDeleteConfirmation("");
        }}
      />

      <AmendModal
        key={amendOrder?._id || "closed"}
        open={Boolean(amendOrder)}
        order={amendOrder}
        saving={busyAction === `amend-${amendOrder?._id}`}
        onClose={() => {
          if (!busyAction) setAmendOrder(null);
        }}
        onSave={handleSaveAmendment}
      />

      <AdminDecisionModal
        open={Boolean(deleteOrder)}
        title="Delete Order"
        subtitle="This moves the order to Settings Trash for 30 days before permanent database deletion. It can be restored during that window."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${deleteOrder?._id}`}
        details={[
          { label: "Order", value: deleteOrder?.orderNumber },
          { label: "Status", value: deleteOrder?.status },
          {
            label: "Dealer",
            value:
              deleteOrder?.dealerSnapshot?.companyName ||
              deleteOrder?.dealerId?.companyName,
          },
          {
            label: "Total",
            value: deleteOrder
              ? money(
                  deleteOrder?.totals?.total,
                  deleteOrder?.totals?.currency || "NPR",
                )
              : "",
          },
        ]}
        requireText={deleteOrder?.orderNumber || ""}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (!busyAction) {
            setDeleteOrder(null);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={() => handleHardDelete(deleteOrder)}
      />
    </div>
  );
}
