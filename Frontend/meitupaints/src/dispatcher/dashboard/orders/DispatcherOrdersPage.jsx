import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.js";
import {
  useAmendDispatcherOrderMutation,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrdersQuery,
  useRejectDispatcherOrderMutation,
  useVerifyDispatcherOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";

const VIEW_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Recently Verified" },
  { key: "REJECTED", label: "Recently Rejected" },
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

function SearchInput({ value, onChange }) {
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
        placeholder="Search order number, dealer, phone, payment..."
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

function normalizeStatus(status) {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  if (s === "ARCHIVE") return "ARCHIVED";
  return s;
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

function getItemName(item) {
  return item?.name || item?.nameSnapshot || "";
}

function getItemSku(item) {
  return item?.sku || item?.skuSnapshot || item?.code || "";
}

function getItemPack(item) {
  return item?.packLabel || item?.variantLabel || item?.unit || item?.uom || "";
}

function getItemQty(item) {
  return Number(item?.quantity ?? item?.qty ?? 0);
}

function getItemRate(item) {
  return Number(item?.unitPrice ?? item?.rate ?? 0);
}

function buildEditableItems(items = []) {
  return items.map((item) => ({
    name: getItemName(item),
    sku: getItemSku(item),
    pack: getItemPack(item),
    quantity: getItemQty(item),
    rate: getItemRate(item),
  }));
}

function buildPayloadItems(items = []) {
  return items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount = quantity * rate;

    return {
      sku: String(item.sku || "").trim(),
      name: String(item.name || "").trim(),
      unit: String(item.pack || "").trim(),
      qty: quantity,
      rate,
      amount,
      quantity,
      unitPrice: rate,
      lineTotal: amount,
      packLabel: String(item.pack || "").trim(),
    };
  });
}

function OrdersRow({ item, selected, onSelect }) {
  const dealer = item?.dealerId || item?.dealerSnapshot || {};
  const orderTotal = item?.totals?.total || 0;
  const currency = item?.totals?.currency || "NPR";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      style={{
        width: "100%",
        textAlign: "left",
        border: selected
          ? "1px solid rgba(180,35,24,.16)"
          : "1px solid rgba(15,23,42,.06)",
        background: selected ? "rgba(180,35,24,.04)" : "#fff",
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
              {item.orderNumber || "Unnamed Order"}
            </div>
            <StatusBadge status={normalizeStatus(item.status)} />
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
            {dealer?.companyName ? <span>{dealer.companyName}</span> : null}
            {dealer?.companyName && dealer?.contactName ? <span>•</span> : null}
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
            <span>{dealer?.phone || "No phone"}</span>
            <span>•</span>
            <span>{money(orderTotal, currency)}</span>
            <span>•</span>
            <span>{formatRelativeTime(item.createdAt)}</span>
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
          {Array.isArray(item.items) ? `${item.items.length} items` : "—"}
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
        {archiveMode ? "No handled orders found" : "No pending orders found"}
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
        Try adjusting the search filters to review dispatcher order records.
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

function AmendOrderModal({ open, order, saving, onClose, onSave }) {
  const [items, setItems] = useState(() =>
    buildEditableItems(order?.items || []),
  );
  const [dealerNote, setDealerNote] = useState(order?.dealerNote || "");
  const [internalNote, setInternalNote] = useState(order?.internalNote || "");
  const [reviewNote, setReviewNote] = useState(
    order?.review?.reviewNote || "",
  );
  const [error, setError] = useState("");

  if (!open || !order) return null;

  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    return sum + quantity * rate;
  }, 0);

  function updateItem(index, key, value) {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]:
                key === "quantity" || key === "rate"
                  ? Number(value || 0)
                  : value,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { name: "", sku: "", pack: "", quantity: 1, rate: 0 },
    ]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={1240}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title={`Amend ${order.orderNumber || "Order"}`}
          subtitle="Revise items and notes before dispatcher verification."
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

        <div style={{ marginTop: 20, display: "grid", gap: 18 }}>
          <GlassCard style={{ padding: 18, background: "#fff" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Label>Order Items</Label>
              <ActionButton subtle onClick={addItem}>
                Add Item
              </ActionButton>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {items.map((item, index) => {
                const amount =
                  Number(item.quantity || 0) * Number(item.rate || 0);

                return (
                  <div
                    key={`${item.sku}-${index}`}
                    style={{
                      borderRadius: 18,
                      border: "1px solid rgba(15,23,42,.08)",
                      background: "rgba(248,250,252,.9)",
                      padding: 14,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 1.4fr) minmax(140px, .7fr) auto",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <Label>Item Name</Label>
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(index, "name", e.target.value)
                          }
                          placeholder="Product name"
                          style={fieldStyle}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <Label>SKU</Label>
                        <input
                          value={item.sku}
                          onChange={(e) =>
                            updateItem(index, "sku", e.target.value)
                          }
                          placeholder="SKU"
                          style={fieldStyle}
                        />
                      </div>

                      <ActionButton
                        danger
                        subtle
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </ActionButton>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(120px, .8fr) minmax(120px, .6fr) minmax(120px, .6fr) minmax(120px, .7fr)",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <Label>Pack</Label>
                        <input
                          value={item.pack}
                          onChange={(e) =>
                            updateItem(index, "pack", e.target.value)
                          }
                          placeholder="20L / 10L / unit"
                          style={fieldStyle}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <Label>Quantity</Label>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                          style={fieldStyle}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <Label>Rate</Label>
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(index, "rate", e.target.value)
                          }
                          style={fieldStyle}
                        />
                      </div>

                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(15,23,42,.08)",
                          background: "#fff",
                          padding: 14,
                          display: "grid",
                          alignContent: "center",
                        }}
                      >
                        <Label>Amount</Label>
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 15,
                            fontWeight: 900,
                            color: "#0f172a",
                          }}
                        >
                          {Number(amount).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  minWidth: 220,
                  borderRadius: 18,
                  border: "1px solid rgba(180,35,24,.12)",
                  background: "rgba(180,35,24,.05)",
                  padding: 16,
                }}
              >
                <Label>Recalculated Total</Label>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    fontWeight: 950,
                    color: "#b42318",
                    letterSpacing: "-0.03em",
                  }}
                >
                  NPR {Number(subtotal).toLocaleString()}
                </div>
              </div>
            </div>
          </GlassCard>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Dealer Note</Label>
              <textarea
                rows={5}
                value={dealerNote}
                onChange={(e) => setDealerNote(e.target.value)}
                placeholder="Dealer-facing note"
                style={{
                  ...fieldStyle,
                  height: "auto",
                  padding: 14,
                  resize: "vertical",
                }}
              />
            </GlassCard>

            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Internal Note</Label>
              <textarea
                rows={5}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Internal operations note"
                style={{
                  ...fieldStyle,
                  height: "auto",
                  padding: 14,
                  resize: "vertical",
                }}
              />
            </GlassCard>
          </div>

          <GlassCard style={{ padding: 18, background: "#fff" }}>
            <Label>Dispatcher Amendment Note</Label>
            <textarea
              rows={4}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Explain the changes made before verification..."
              style={{
                ...fieldStyle,
                height: "auto",
                padding: 14,
                resize: "vertical",
              }}
            />
          </GlassCard>

          {error ? (
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
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <ActionButton subtle onClick={onClose} disabled={saving}>
              Cancel
            </ActionButton>
            <ActionButton
              onClick={() => {
                if (!items.length) {
                  setError("At least one order item is required.");
                  return;
                }

                const hasInvalidItem = items.some(
                  (item) =>
                    !String(item.name || "").trim() ||
                    Number(item.quantity || 0) <= 0 ||
                    Number(item.rate || 0) < 0,
                );

                if (hasInvalidItem) {
                  setError(
                    "Every item must have a name, quantity greater than 0, and a valid rate.",
                  );
                  return;
                }

                setError("");
                onSave({
                  items: buildPayloadItems(items),
                  dealerNote: dealerNote.trim(),
                  internalNote: internalNote.trim(),
                  reviewNote: reviewNote.trim(),
                  subtotal,
                });
              }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Amendment"}
            </ActionButton>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

const fieldStyle = {
  width: "100%",
  height: 48,
  borderRadius: 16,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  outline: "none",
};

function DispatcherOrderModal({
  open,
  order,
  busyAction,
  onClose,
  onVerify,
  onReject,
  onAmend,
  onDownloadPdf,
}) {
  const [reviewNote, setReviewNote] = useState(
    order?.review?.reviewNote || "",
  );

  if (!open || !order) return null;

  const normalizedStatus = normalizeStatus(order.status);
  const canAct = normalizedStatus === "SUBMITTED";
  const canDownloadPdf =
    normalizedStatus === "VERIFIED" || normalizedStatus === "ARCHIVED";
  const dealer = order?.dealerId || order?.dealerSnapshot || {};
  const actionKeyPrefix = order?._id || "order";

  return (
    <ModalShell open={open} onClose={onClose}>
      <div style={{ padding: 24 }}>
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle="Review the assigned dealer order and make a dispatcher decision."
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
                onClick={() => onDownloadPdf(order)}
                disabled={!canDownloadPdf}
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
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge status={normalizedStatus} />
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

            <GlassCard style={{ padding: 18, background: "#fff" }}>
              <Label>Dispatcher Review Note</Label>
              <textarea
                rows={4}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a verification or rejection note for this order..."
                style={{
                  marginTop: 12,
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
                }}
              />

              {canAct ? (
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <ActionButton
                    subtle
                    onClick={() => onAmend(order)}
                    disabled={busyAction === `amend-${actionKeyPrefix}`}
                  >
                    {busyAction === `amend-${actionKeyPrefix}`
                      ? "Opening..."
                      : "Amend"}
                  </ActionButton>

                  <ActionButton
                    onClick={() => onVerify(order, reviewNote)}
                    disabled={busyAction === `verify-${actionKeyPrefix}`}
                  >
                    {busyAction === `verify-${actionKeyPrefix}`
                      ? "Verifying..."
                      : "Verify"}
                  </ActionButton>

                  <ActionButton
                    danger
                    onClick={() => onReject(order, reviewNote)}
                    disabled={busyAction === `reject-${actionKeyPrefix}`}
                  >
                    {busyAction === `reject-${actionKeyPrefix}`
                      ? "Rejecting..."
                      : "Reject"}
                  </ActionButton>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "rgba(15,23,42,.04)",
                    color: "rgba(15,23,42,.62)",
                    border: "1px solid rgba(15,23,42,.08)",
                    fontWeight: 800,
                    lineHeight: 1.6,
                  }}
                >
                  This order is already finalized and can no longer be acted on
                  from the dispatcher workspace.
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export default function DispatcherOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [viewMode, setViewMode] = useState("PENDING");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [amendOrder, setAmendOrder] = useState(null);

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
      setSelectedOrder(order);
      clearOrderQuery();
    },
    [clearOrderQuery],
  );

  const closeOrderPreview = useCallback(() => {
    if (busyAction) return;
    setSelectedOrder(null);
    clearOrderQuery();
  }, [busyAction, clearOrderQuery]);

  const orderParams = useMemo(() => {
    const params = {};
    if (committedSearch.trim()) params.q = committedSearch.trim();

    if (viewMode === "ARCHIVE") {
      params.archive = true;
    } else if (viewMode === "VERIFIED" || viewMode === "REJECTED") {
      params.status = viewMode;
    } else {
      params.status = "SUBMITTED";
    }

    return params;
  }, [committedSearch, viewMode]);

  const ordersQuery = useGetDispatcherOrdersQuery(orderParams);
  const orderDetailQuery = useGetDispatcherOrderQuery(queryOrderId, {
    skip: !queryOrderId,
  });
  const [verifyDispatcherOrder] = useVerifyDispatcherOrderMutation();
  const [rejectDispatcherOrder] = useRejectDispatcherOrderMutation();
  const [amendDispatcherOrder] = useAmendDispatcherOrderMutation();

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const loading = ordersQuery.isLoading && orders.length === 0;
  const isRefreshing =
    !loading && (ordersQuery.isFetching || orderDetailQuery.isFetching);
  const queryError = ordersQuery.error || orderDetailQuery.error;
  const error =
    actionError ||
    (queryError
      ? getQueryErrorMessage(queryError, "Failed to load assigned orders.")
      : "");

  const selectedOrderView = useMemo(() => {
    if (queryOrderId) {
      return (
        orderDetailQuery.data?.item ||
        orders.find((item) => item._id === queryOrderId) ||
        null
      );
    }

    if (!selectedOrder?._id) return null;
    return (
      orders.find((item) => item._id === selectedOrder._id) || selectedOrder
    );
  }, [orderDetailQuery.data, orders, queryOrderId, selectedOrder]);

  const countsByFilter = useMemo(() => {
    return {
      PENDING:
        viewMode === "PENDING"
          ? orders.filter((o) => normalizeStatus(o.status) === "SUBMITTED")
              .length
          : undefined,
      VERIFIED:
        viewMode === "VERIFIED"
          ? orders.filter((o) => normalizeStatus(o.status) === "VERIFIED")
              .length
          : undefined,
      REJECTED:
        viewMode === "REJECTED"
          ? orders.filter((o) => normalizeStatus(o.status) === "REJECTED")
              .length
          : undefined,
      ARCHIVE:
        viewMode === "ARCHIVE"
          ? orders.filter((o) =>
              ["VERIFIED", "REJECTED", "ARCHIVED"].includes(
                normalizeStatus(o.status),
              ),
            ).length
          : undefined,
    };
  }, [orders, viewMode]);

  function refetchOrders() {
    ordersQuery.refetch();
    if (queryOrderId) orderDetailQuery.refetch();
  }

  function applySearch() {
    setCommittedSearch(search);
  }

  function resetFilters() {
    setSearch("");
    setCommittedSearch("");
    setViewMode("PENDING");
  }

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

  async function handleVerify(order, reviewNote) {
    const success = await runAction(`verify-${order._id}`, () =>
      verifyDispatcherOrder({
        orderId: order._id,
        payload: { reviewNote: String(reviewNote || "").trim() },
      }).unwrap(),
    );

    if (success) {
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  async function handleReject(order, reviewNote) {
    const success = await runAction(`reject-${order._id}`, () =>
      rejectDispatcherOrder({
        orderId: order._id,
        payload: { reviewNote: String(reviewNote || "").trim() },
      }).unwrap(),
    );

    if (success) {
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  async function handleSaveAmendment(payload) {
    if (!amendOrder?._id) return;

    const success = await runAction(`amend-${amendOrder._id}`, () =>
      amendDispatcherOrder({
        orderId: amendOrder._id,
        payload: {
          items: payload.items,
          totals: {
            subtotal: payload.subtotal,
            discount: 0,
            taxableAmount: payload.subtotal,
            tax: 0,
            total: payload.subtotal,
            currency: amendOrder?.totals?.currency || "NPR",
          },
          dealerNote: payload.dealerNote,
          internalNote: payload.internalNote,
          reviewNote: payload.reviewNote,
        },
      }).unwrap(),
    );

    if (success) {
      setAmendOrder(null);
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  function handleDownloadPdf(order) {
    const dealer = order?.dealerId || order?.dealerSnapshot || {};
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Dispatcher Orders"
          subtitle="Review, amend, process, and download summaries for the dealer orders assigned to your dispatcher account."
          action={
            <ActionButton subtle onClick={refetchOrders}>
              Refresh
            </ActionButton>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
            alignItems: "center",
          }}
        >
          <SearchInput value={search} onChange={setSearch} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {VIEW_FILTERS.map((filter) => (
              <FilterPill
                key={filter.key}
                active={viewMode === filter.key}
                onClick={() => setViewMode(filter.key)}
                count={countsByFilter[filter.key]}
              >
                {filter.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <ActionButton subtle onClick={applySearch}>
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

      {loading ? (
        <LoadingState />
      ) : orders.length === 0 ? (
        <EmptyState
          archiveMode={viewMode === "ARCHIVE"}
          onReset={resetFilters}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {orders.map((item) => (
            <OrdersRow
              key={item._id}
              item={item}
              selected={selectedOrderView?._id === item._id}
              onSelect={openOrderPreview}
            />
          ))}
        </div>
      )}

      <DispatcherOrderModal
        key={selectedOrderView?._id || "closed"}
        open={Boolean(selectedOrderView)}
        order={selectedOrderView}
        busyAction={busyAction}
        onClose={closeOrderPreview}
        onVerify={handleVerify}
        onReject={handleReject}
        onAmend={(order) => {
          setSelectedOrder(null);
          clearOrderQuery();
          setAmendOrder(order);
        }}
        onDownloadPdf={handleDownloadPdf}
      />

      <AmendOrderModal
        key={amendOrder?._id || "closed"}
        open={Boolean(amendOrder)}
        order={amendOrder}
        saving={busyAction === `amend-${amendOrder?._id}`}
        onClose={() => {
          if (!busyAction) setAmendOrder(null);
        }}
        onSave={handleSaveAmendment}
      />
    </div>
  );
}
