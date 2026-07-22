import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.jsx";
import {
  useAmendDispatcherOrderMutation,
  useCompleteDispatcherOrderMutation,
  useDispatchDispatcherOrderMutation,
  useGetDispatcherDealersQuery,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
  useRejectDispatcherOrderMutation,
  useVerifyDispatcherOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { handleTransitionError, GENERIC_ACTION_ERROR } from "../../../shared/orderConflict.js";
import { ACTION_VERB, getTransitions } from "../../../shared/orderStateMachine.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import OpsRefetchHairline from "../../../components/dashboard/OpsRefetchHairline.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import { ORDER_STATUS_META, normalizeStatus, resolveOrderItemImage } from "../../../dealer/orderDetailLogic.js";
import { formatOrderDate, money } from "../../../admin/dashboard/orders/orderFormatting.js";
import { groupOrdersByDay } from "../../../utils/orderDayGrouping.js";
import { OrderStatusRail, OrderFlowRailStyles } from "../../../components/orderflow/OrderStatusRail.jsx";
import { OwnerChip, OwnerChipStyles } from "../../../components/orderflow/OwnerChip.jsx";
import { TransitionConfirmSheet, TransitionConfirmSheetStyles } from "../../../components/orderflow/TransitionConfirmSheet.jsx";
import { useQueueArrivals } from "../../../components/orderflow/arrivals.js";
import { ArrivalStyles, SoundMuteToggle } from "../../../components/orderflow/ArrivalIndicators.jsx";

// Every tab maps to exactly one real order status - simpler than the
// earlier "Archive merges three statuses" scheme, and each tab now means
// exactly what it says.
const VIEW_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCH", label: "Dispatch" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
];

const PAGE_SIZE_OPTIONS = [
  { key: "20", label: "20 per page" },
  { key: "50", label: "50 per page" },
  { key: "100", label: "100 per page" },
];

function orderStatusMeta(status) {
  const normalized = normalizeStatus(status);
  return ORDER_STATUS_META[normalized] || { label: normalized || "—", tone: "neutral", live: false };
}

export function StatusBadge({ status }) {
  const meta = orderStatusMeta(status);
  return (
    <Pill tone={meta.tone} size="small">
      {meta.label}
    </Pill>
  );
}

export function GlassCard({ children, style = {}, ...rest }) {
  return (
    <Surface {...rest} padding={0} style={style}>
      {children}
    </Surface>
  );
}

// Compact pill-style action button - deliberately mirrors Admin's own
// ActionButton exactly (same 36px height, same tone rules) so the
// dispatcher order detail page reads as visually identical to Admin's.
export function ActionButton({ children, onClick, danger = false, subtle = false, disabled = false, icon = "" }) {
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
        height: 36,
        padding: "0 14px",
        borderRadius: 10,
        border: "none",
        background: danger ? "rgba(180,35,24,.08)" : subtle ? "var(--color-fog, #f5f5f7)" : "var(--color-azure,#0071e3)",
        color: danger ? "#b42318" : subtle ? "var(--color-ink, #1d1d1f)" : "#fff",
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon ? <DashboardIcon name={icon} size={14} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

const EMPTY_STATE_TITLES = {
  PENDING: "No pending orders found",
  VERIFIED: "No verified orders found",
  DISPATCH: "No dispatched orders found",
  COMPLETED: "No completed orders found",
  REJECTED: "No rejected orders found",
};

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

export function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {children}
      </div>
    </div>
  );
}

export function DetailItem({ label, value }) {
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

function fieldInputStyle() {
  return {
    width: "100%",
    height: 38,
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: "0 12px",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
  };
}

function fieldTextareaStyle() {
  return { ...fieldInputStyle(), height: "auto", padding: 12, resize: "vertical" };
}

export function CloseButton({ onClick }) {
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

function DispatcherOrderTabs({ options, value, onChange }) {
  return (
    <div className="dispatcher-order-tabs" role="tablist">
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
            className={`dispatcher-order-tab ${active ? "is-active" : ""}`}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? <span className="dispatcher-order-tab-count">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function OrderThumbnails({ items, productsMap, familyMap }) {
  const visible = items.slice(0, 4);
  const overflow = items.length - visible.length;

  if (!visible.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {visible.map((item, index) => {
        const image = resolveOrderItemImage(item, productsMap, familyMap);
        return (
          <div key={`${item.sku || item.code || "item"}-${index}`} className="dispatcher-order-thumb">
            {image?.url ? (
              <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <DashboardIcon name="package" size={16} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
            )}
          </div>
        );
      })}
      {overflow > 0 ? <div className="dispatcher-order-thumb dispatcher-order-thumb-more">+{overflow}</div> : null}
    </div>
  );
}

// Matches AdminOrdersPage.jsx's Order Register card exactly - status used
// to be repeated four ways here too (a colored marker icon, this Pill, the
// rail, and a bottom row repeating the label with its own spinner); trimmed
// to just the Pill + rail, which already say everything the other two said.
// The inline primary-action button is new here (Admin's list only ever has
// one primary transition - verify; this list has three depending on tab -
// verify/dispatch/confirm-handover) - getTransitions is the single source
// for which one applies, so the button never disagrees with the detail page.
function DispatcherOrderTimelineRow({ item, onOpen, onQuickAction, isArrived, productsMap, familyMap }) {
  const status = normalizeStatus(item.status);
  const meta = orderStatusMeta(status);
  const items = Array.isArray(item.items) ? item.items : [];
  const dealer = item?.dealerId || item?.dealerSnapshot || {};
  const dealerName = dealer?.companyName || dealer?.contactName || "Unassigned dealer";
  const primaryTransition = getTransitions(item, "DISPATCHER").find((t) => t.kind === "primary");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className={`dash-selectable-row dispatcher-order-card ${isArrived ? "orderflow-arrival-highlight" : ""}`}
    >
      <div className="dispatcher-order-card-top">
        <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <span className="dispatcher-order-dealer">{dealerName}</span>
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="dispatcher-order-number">{item.orderNumber || "Unnamed Order"}</span>
            <Pill tone={meta.tone} size="small">{meta.label}</Pill>
            <OwnerChip order={item} role="DISPATCHER" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {primaryTransition ? (
            <ActionButton icon="checkmark" onClick={() => onQuickAction(item, primaryTransition)}>
              {ACTION_VERB[primaryTransition.action]}
            </ActionButton>
          ) : null}
          <span className="dispatcher-order-amount">{money(item?.totals?.total, item?.totals?.currency)}</span>
          <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)" }} />
        </div>
      </div>

      <div className="dispatcher-order-card-meta-row">
        <OrderThumbnails items={items} productsMap={productsMap} familyMap={familyMap} />
        <span className="dispatcher-order-meta">
          {formatOrderDate(item.createdAt)} · {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <OrderStatusRail order={item} size="sm" />
    </div>
  );
}

export function OrderItemsTable({ items = [] }) {
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
                  <div style={{ fontWeight: 600, color: "var(--color-ink, #1d1d1f)", fontSize: 13 }}>{item.name || item.nameSnapshot || "—"}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku || item.skuSnapshot || item.code || ""}</div>
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

const MODAL_EASE_OUT = [0.23, 1, 0.32, 1];

function ModalOverlay({ open, onClose, children, maxWidth = 1080 }) {
  const shouldReduceMotion = useReducedMotion();
  const scale = shouldReduceMotion ? 1 : 0.95;
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const slow = shouldReduceMotion ? 0.001 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fast, ease: "easeOut" }}
          style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale }}
            transition={{ duration: slow, ease: MODAL_EASE_OUT }}
            style={{ transformOrigin: "center", width: `min(${maxWidth}px, 100%)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <Surface style={{ width: "100%", maxHeight: "92vh", overflow: "auto" }} padding={22}>
              {children}
            </Surface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function AmendOrderModal({ open, order, saving, onClose, onSave }) {
  const [items, setItems] = useState(() => buildEditableItems(order?.items || []));
  const [dealerNote, setDealerNote] = useState(order?.dealerNote || "");
  const [internalNote, setInternalNote] = useState(order?.internalNote || "");
  const [reviewNote, setReviewNote] = useState(order?.review?.reviewNote || "");
  const [error, setError] = useState("");

  if (!open || !order) return null;

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0);

  function updateItem(index, key, value) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [key]: key === "quantity" || key === "rate" ? Number(value || 0) : value } : item)),
    );
  }
  function addItem() {
    setItems((current) => [...current, { name: "", sku: "", pack: "", quantity: 1, rate: 0 }]);
  }
  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  return (
    <ModalOverlay open={open} onClose={onClose} maxWidth={1180}>
      <SectionHeader
        eyebrow="Amend"
        icon="edit"
        title={order.orderNumber || "Order"}
        subtitle="Revise items and notes before verification."
        action={<CloseButton onClick={onClose} />}
      />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CardLabel icon="package">Order Items</CardLabel>
            <GhostButton icon="plus" onClick={addItem}>Add Item</GhostButton>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {items.map((item, index) => {
              const amount = Number(item.quantity || 0) * Number(item.rate || 0);
              return (
                <div key={`${item.sku}-${index}`} style={{ borderRadius: 14, background: "var(--color-fog, #f5f5f7)", padding: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(120px, .7fr) auto", gap: 10, alignItems: "end" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Item Name</div>
                      <input value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} placeholder="Product name" style={fieldInputStyle()} />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>SKU</div>
                      <input value={item.sku} onChange={(e) => updateItem(index, "sku", e.target.value)} placeholder="SKU" style={fieldInputStyle()} />
                    </div>
                    <GhostButton danger icon="trash" onClick={() => removeItem(index)}>Remove</GhostButton>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(100px, 1fr))", gap: 10 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Pack</div>
                      <input value={item.pack} onChange={(e) => updateItem(index, "pack", e.target.value)} placeholder="20L / 10L / unit" style={fieldInputStyle()} />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Quantity</div>
                      <input type="number" min="0" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} style={fieldInputStyle()} />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Rate</div>
                      <input type="number" min="0" value={item.rate} onChange={(e) => updateItem(index, "rate", e.target.value)} style={fieldInputStyle()} />
                    </div>
                    <div style={{ borderRadius: 10, background: "var(--color-snow, #fff)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)", padding: "8px 10px", display: "grid", alignContent: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Amount</div>
                      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{Number(amount).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ minWidth: 200, borderRadius: 14, background: "rgba(0,113,227,.06)", border: "1px solid rgba(0,113,227,.14)", padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Recalculated Total</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: "var(--color-azure, #0071e3)", letterSpacing: "-0.02em" }}>
                NPR {Number(subtotal).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <CardLabel icon="user">Dealer Note</CardLabel>
            <textarea rows={4} value={dealerNote} onChange={(e) => setDealerNote(e.target.value)} placeholder="Dealer-facing note" style={{ ...fieldTextareaStyle(), marginTop: 10 }} />
          </div>
          <div>
            <CardLabel icon="edit">Internal Note</CardLabel>
            <textarea rows={4} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Internal operations note" style={{ ...fieldTextareaStyle(), marginTop: 10 }} />
          </div>
        </div>

        <div>
          <CardLabel icon="edit">Dispatcher Amendment Note</CardLabel>
          <textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Explain the changes made before verification…" style={{ ...fieldTextareaStyle(), marginTop: 10 }} />
        </div>

        {error ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <GhostButton onClick={onClose} disabled={saving}>Cancel</GhostButton>
          <PrimaryButton
            icon="checkmark"
            disabled={saving}
            onClick={() => {
              if (!items.length) {
                setError("At least one order item is required.");
                return;
              }
              const hasInvalidItem = items.some((item) => !String(item.name || "").trim() || Number(item.quantity || 0) <= 0 || Number(item.rate || 0) < 0);
              if (hasInvalidItem) {
                setError("Every item must have a name, quantity greater than 0, and a valid rate.");
                return;
              }
              setError("");
              onSave({ items: buildPayloadItems(items), dealerNote: dealerNote.trim(), internalNote: internalNote.trim(), reviewNote: reviewNote.trim(), subtotal });
            }}
          >
            {saving ? "Saving…" : "Save Amendment"}
          </PrimaryButton>
        </div>
      </div>
    </ModalOverlay>
  );
}

function DispatcherOrderModal({ open, order, busyAction, onClose, onVerify, onReject, onAmend, onDownloadPdf, onDispatch }) {
  const [reviewNote, setReviewNote] = useState(order?.review?.reviewNote || "");

  if (!open || !order) return null;

  const normalizedStatus = normalizeStatus(order.status);
  const canAct = normalizedStatus === "SUBMITTED";
  const canFulfill = normalizedStatus === "VERIFIED";
  const canDownloadPdf = normalizedStatus === "VERIFIED" || normalizedStatus === "DISPATCHED" || normalizedStatus === "COMPLETED";
  const dealer = order?.dealerId || order?.dealerSnapshot || {};
  const actionKeyPrefix = order?._id || "order";

  return (
    <ModalOverlay open={open} onClose={onClose} maxWidth={1080}>
      <SectionHeader
        eyebrow="Order"
        icon="orders"
        title={order.orderNumber || "Order Detail"}
        subtitle="Review the assigned dealer order and make a dispatcher decision."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <GhostButton icon="download" onClick={() => onDownloadPdf(order)} disabled={!canDownloadPdf}>PDF</GhostButton>
            <CloseButton onClick={onClose} />
          </div>
        }
      />

      <div style={{ marginTop: 14 }}>
        <Pill tone={orderStatusMeta(normalizedStatus).tone} size="small">{normalizedStatus}</Pill>
      </div>

      {!canDownloadPdf ? (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", fontSize: 13, fontWeight: 500 }}>
          PDF download becomes available after the order is verified.
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,.9fr)", gap: 18 }}>
        <div>
          <CardLabel icon="package">Order Items</CardLabel>
          <div style={{ marginTop: 10 }}>
            <OrderItemsTable items={order.items || []} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <CardLabel icon="store">Dealer Context</CardLabel>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <DetailItem label="Dealer" value={dealer?.companyName} />
              <DetailItem label="Contact" value={dealer?.contactName} />
              <DetailItem label="Phone" value={dealer?.phone} />
              <DetailItem label="Total" value={money(order?.totals?.total, order?.totals?.currency || "NPR")} />
              <DetailItem label="Payment Method" value={order?.payment?.method} />
              <DetailItem label="Dealer Note" value={order?.dealerNote} />
              <DetailItem label="Internal Note" value={order?.internalNote} />
              <DetailItem label="Submitted" value={order?.createdAt ? new Date(order.createdAt).toLocaleString() : "—"} />
            </div>
          </div>

          <div>
            <CardLabel icon="edit">Dispatcher Review Note</CardLabel>
            <textarea
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a verification or rejection note…"
              style={{ ...fieldTextareaStyle(), marginTop: 10 }}
            />

            {canAct ? (
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GhostButton icon="edit" onClick={() => onAmend(order)} disabled={busyAction === `amend-${actionKeyPrefix}`}>
                  {busyAction === `amend-${actionKeyPrefix}` ? "Opening…" : "Amend"}
                </GhostButton>
                <PrimaryButton icon="checkmark" onClick={() => onVerify(order, reviewNote)} disabled={busyAction === `verify-${actionKeyPrefix}`}>
                  {busyAction === `verify-${actionKeyPrefix}` ? "Verifying…" : "Verify"}
                </PrimaryButton>
                <GhostButton danger icon="reject" onClick={() => onReject(order, reviewNote)} disabled={busyAction === `reject-${actionKeyPrefix}`}>
                  {busyAction === `reject-${actionKeyPrefix}` ? "Rejecting…" : "Reject"}
                </GhostButton>
              </div>
            ) : canFulfill ? (
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PrimaryButton icon="checkmark" onClick={() => onDispatch(order, reviewNote)} disabled={busyAction === `dispatch-${actionKeyPrefix}`}>
                  {busyAction === `dispatch-${actionKeyPrefix}` ? "Dispatching…" : "Dispatch (deducts your stock)"}
                </PrimaryButton>
              </div>
            ) : (
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", fontSize: 13, fontWeight: 500 }}>
                This order is already finalized and can no longer be acted on from the dispatcher workspace.
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
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

// Statuses whose row click opens the full detail page instead of the
// lightweight popup - see openOrderPreview below.
const FULL_PAGE_STATUSES = new Set(["SUBMITTED", "VERIFIED", "DISPATCHED"]);

export default function DispatcherOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [viewMode, setViewMode] = useState("PENDING");
  const [dealerFilter, setDealerFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [amendOrder, setAmendOrder] = useState(null);
  // Inline quick-action from the list (Admin's Order Register pattern) -
  // covers whichever primary transition applies to the row's current status
  // (verify/dispatch/confirm-handover), always through the same
  // TransitionConfirmSheet every detail page uses, never a bare-confirm.
  const [confirmAction, setConfirmAction] = useState(null); // { order, action, target }
  const [listActionBusy, setListActionBusy] = useState(false);
  const [listActionError, setListActionError] = useState("");

  const queryOrderId = useMemo(() => new URLSearchParams(location.search || "").get("orderId") || "", [location.search]);

  const clearOrderQuery = useCallback(() => {
    if (!queryOrderId) return;
    navigate({ pathname: location.pathname }, { replace: true });
  }, [location.pathname, navigate, queryOrderId]);

  // Pending (SUBMITTED), Verified, and Dispatched orders get the full
  // Admin-style detail page - that's where the actual verify/reject/amend/
  // dispatch decisions happen, so they earn the extra screen real estate.
  // Completed/Rejected orders are just a status check, so those stay a
  // lightweight popup instead of a full navigation.
  const openOrderPreview = useCallback(
    (order) => {
      if (FULL_PAGE_STATUSES.has(normalizeStatus(order?.status))) {
        navigate(`/dispatcher/dashboard/orders/${order._id}`, { state: { fromOrdersList: true } });
        return;
      }
      setSelectedOrder(order);
      clearOrderQuery();
    },
    [clearOrderQuery, navigate],
  );

  const closeOrderPreview = useCallback(() => {
    if (busyAction) return;
    setSelectedOrder(null);
    clearOrderQuery();
  }, [busyAction, clearOrderQuery]);

  const orderParams = useMemo(() => {
    const params = { page, limit: pageSize };
    if (committedSearch.trim()) params.q = committedSearch.trim();
    if (dealerFilter !== "ALL") params.dealerId = dealerFilter;

    if (viewMode === "COMPLETED") {
      params.status = "COMPLETED";
    } else if (viewMode === "VERIFIED") {
      params.status = "VERIFIED";
    } else if (viewMode === "DISPATCH") {
      params.status = "DISPATCHED";
    } else if (viewMode === "REJECTED") {
      params.status = "REJECTED";
    } else {
      params.status = "SUBMITTED";
    }

    return params;
  }, [committedSearch, dealerFilter, page, pageSize, viewMode]);

  const ordersQuery = useGetDispatcherOrdersQuery(orderParams, { pollingInterval: 20000 });
  const orderDetailQuery = useGetDispatcherOrderQuery(queryOrderId, { skip: !queryOrderId, pollingInterval: 15000 });
  const dealersQuery = useGetDispatcherDealersQuery({ limit: 100 });
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();
  const [verifyDispatcherOrder] = useVerifyDispatcherOrderMutation();
  const [rejectDispatcherOrder] = useRejectDispatcherOrderMutation();
  const [amendDispatcherOrder] = useAmendDispatcherOrderMutation();
  const [dispatchDispatcherOrder] = useDispatchDispatcherOrderMutation();
  const [completeDispatcherOrder] = useCompleteDispatcherOrderMutation();

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const totalOrders = ordersQuery.data?.total ?? orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const rangeStart = totalOrders === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalOrders, page * pageSize);
  const pageList = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const dealers = useMemo(() => dealersQuery.data?.items || [], [dealersQuery.data]);
  const dealerFilterOptions = useMemo(
    () => [
      { key: "ALL", label: "All My Dealers" },
      ...dealers.map((dealer) => ({ key: dealer._id, label: dealer.companyName || dealer.contactName || "Dealer" })),
    ],
    [dealers],
  );

  const productsMap = useMemo(() => {
    const map = {};
    for (const item of productsQuery.data || []) map[item.sku] = item;
    return map;
  }, [productsQuery.data]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [familiesQuery.data]);

  const loading = ordersQuery.isLoading && orders.length === 0;
  const isRefreshing = !loading && (ordersQuery.isFetching || orderDetailQuery.isFetching);
  const queryError = ordersQuery.error || orderDetailQuery.error;
  const error = actionError || (queryError ? getQueryErrorMessage(queryError, "Failed to load assigned orders.") : "");

  const selectedOrderView = useMemo(() => {
    if (queryOrderId) {
      return orderDetailQuery.data?.item || orders.find((item) => item._id === queryOrderId) || null;
    }
    if (!selectedOrder?._id) return null;
    return orders.find((item) => item._id === selectedOrder._id) || selectedOrder;
  }, [orderDetailQuery.data, orders, queryOrderId, selectedOrder]);

  const countsByFilter = useMemo(
    () => ({
      PENDING: viewMode === "PENDING" ? totalOrders : undefined,
      VERIFIED: viewMode === "VERIFIED" ? totalOrders : undefined,
      DISPATCH: viewMode === "DISPATCH" ? totalOrders : undefined,
      COMPLETED: viewMode === "COMPLETED" ? totalOrders : undefined,
      REJECTED: viewMode === "REJECTED" ? totalOrders : undefined,
    }),
    [totalOrders, viewMode],
  );

  const segmentOptions = VIEW_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }));

  const groupedOrders = useMemo(() => groupOrdersByDay(orders), [orders]);

  // Pending (SUBMITTED) is already the "needs you" view for a dispatcher -
  // reviewerParty owns every SUBMITTED order here, no separate toggle
  // needed the way Admin's list needed one (where Pending mixes both
  // fulfillment modes). Arrivals treatment is scoped to it the same way
  // Factory's Inbox lane is scoped (§2.6/Phase 5).
  const arrivedIds = useQueueArrivals(viewMode === "PENDING" ? orders : [], viewMode, { laneLabel: "Pending" });

  function refetchOrders() {
    ordersQuery.refetch();
    if (queryOrderId) orderDetailQuery.refetch();
  }

  function applySearch() {
    setCommittedSearch(search);
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setCommittedSearch("");
    setViewMode("PENDING");
    setDealerFilter("ALL");
    setPage(1);
  }

  function changeViewMode(next) {
    setViewMode(next);
    setPage(1);
  }

  function changeDealerFilter(next) {
    setDealerFilter(next);
    setPage(1);
  }

  function changePageSize(next) {
    setPageSize(Number(next));
    setPage(1);
  }

  function goToPage(next) {
    setPage(next);
  }

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        refetchOrder: () => (queryOrderId ? orderDetailQuery.refetch() : null),
        invalidateList: () => ordersQuery.refetch(),
        showToast: (t) => setToast({ tone: t.tone, title: t.message }),
      });
      if (!wasConflict) {
        setActionError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function handleVerify(order, reviewNote) {
    const success = await runAction(`verify-${order._id}`, () =>
      verifyDispatcherOrder({ orderId: order._id, payload: { reviewNote: String(reviewNote || "").trim() } }).unwrap(),
    );
    if (success) {
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  async function handleReject(order, reviewNote) {
    const success = await runAction(`reject-${order._id}`, () =>
      rejectDispatcherOrder({ orderId: order._id, payload: { reviewNote: String(reviewNote || "").trim() } }).unwrap(),
    );
    if (success) {
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  async function handleDispatch(order, note) {
    const success = await runAction(`dispatch-${order._id}`, () =>
      dispatchDispatcherOrder({ orderId: order._id, payload: { note: String(note || "").trim() } }).unwrap(),
    );
    if (success) {
      setSelectedOrder(null);
      clearOrderQuery();
    }
  }

  // Backs the inline quick-action button on each list card - one handler
  // for all three primary transitions (verify/dispatch/confirm-handover),
  // matching AdminOrdersPage.jsx's handleInlineVerify shape.
  async function handleInlineConfirm() {
    if (!confirmAction?.order) return false;
    const { order, action } = confirmAction;
    const mutation =
      action === "verify"
        ? () => verifyDispatcherOrder({ orderId: order._id, payload: {} }).unwrap()
        : action === "dispatch"
          ? () => dispatchDispatcherOrder({ orderId: order._id, payload: {} }).unwrap()
          : action === "confirm-handover"
            ? () => completeDispatcherOrder({ orderId: order._id, payload: {} }).unwrap()
            : null;
    if (!mutation) return false;

    setListActionBusy(true);
    setListActionError("");
    try {
      await mutation();
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        invalidateList: () => ordersQuery.refetch(),
        showToast: (t) => setToast({ tone: t.tone, title: t.message }),
      });
      if (wasConflict) {
        setConfirmAction(null);
      } else {
        setListActionError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
    } finally {
      setListActionBusy(false);
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
      dealer: { companyName: dealer?.companyName || "", contactName: dealer?.contactName || "", email: dealer?.email || "", phone: dealer?.phone || "", address: dealer?.address || "" },
    });
  }

  const hasFilters = Boolean(search || committedSearch || dealerFilter !== "ALL" || viewMode !== "PENDING" || pageSize !== 20);

  return (
    <div className="dispatcher-orders-page" style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={18} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <SectionHeader
            icon="orders"
            title="Dealer orders you fulfill"
            subtitle="Review, amend, process, and download summaries for your assigned dealer orders."
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
                <SoundMuteToggle />
              </div>
            }
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ width: 240 }}>
              <SearchField value={search} onChange={setSearch} onSubmit={applySearch} placeholder="Search order number or dealer…" />
            </div>
            <GhostButton icon="refresh" onClick={refetchOrders}>Refresh</GhostButton>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <DispatcherOrderTabs options={segmentOptions} value={viewMode} onChange={changeViewMode} />
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GhostButton
            icon="filter"
            onClick={() => setFiltersOpen((value) => !value)}
            style={
              filtersOpen
                ? { background: "var(--color-ink, #1d1d1f)", color: "#fff", borderColor: "var(--color-ink, #1d1d1f)", boxShadow: "0 12px 26px rgba(29,29,31,.16)" }
                : undefined
            }
          >
            Filters
          </GhostButton>
          {hasFilters ? <GhostButton onClick={resetFilters}>Clear filters</GhostButton> : null}
        </div>

        {filtersOpen ? (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} className="dash-fade-up">
            <AppleDropdown icon="store" value={dealerFilter} options={dealerFilterOptions} onChange={changeDealerFilter} style={{ width: 210 }} />
            <AppleDropdown value={String(pageSize)} options={PAGE_SIZE_OPTIONS} onChange={changePageSize} style={{ width: 150 }} />
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      <OpsRefetchHairline visible={isRefreshing} />

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : orders.length === 0 ? (
        <Surface padding={20}>
          <EmptyState icon="orders" title={EMPTY_STATE_TITLES[viewMode] || "No orders found"} subtitle="Try adjusting the search or filters." />
          <div style={{ marginTop: 4 }}>
            <GhostButton onClick={resetFilters}>Clear filters</GhostButton>
          </div>
        </Surface>
      ) : (
        <>
          <div className="dispatcher-order-timeline dash-fade-up">
            {groupedOrders.map((group) => (
              <div key={group.key} className="dispatcher-order-timeline-day">
                <div className="dispatcher-order-timeline-day-header">
                  <div className="dispatcher-order-timeline-day-label">
                    {group.relativeLabel ? (
                      <>
                        <strong>{group.relativeLabel}</strong>
                        <span className="dispatcher-order-timeline-day-sep">•</span>
                        <span>{group.dateText}</span>
                      </>
                    ) : (
                      <strong>{group.dateText}</strong>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {group.orders.map((item) => (
                    <DispatcherOrderTimelineRow
                      key={item._id}
                      item={item}
                      onOpen={openOrderPreview}
                      onQuickAction={(order, transition) => {
                        setListActionError("");
                        setConfirmAction({ order, action: transition.action, target: transition.target });
                      }}
                      isArrived={arrivedIds.has(item._id)}
                      productsMap={productsMap}
                      familyMap={familyMap}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
            <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
              Showing {rangeStart}-{rangeEnd} of {totalOrders} orders
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="dispatcher-order-page-btn"
              >
                <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
              </button>
              {pageList.map((p) =>
                typeof p === "number" ? (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    className={`dispatcher-order-page-btn ${p === page ? "is-active" : ""}`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
                    …
                  </span>
                ),
              )}
              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="dispatcher-order-page-btn"
              >
                <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </>
      )}

      <DispatcherOrderModal
        key={selectedOrderView?._id || "order-modal-closed"}
        open={Boolean(selectedOrderView)}
        order={selectedOrderView}
        busyAction={busyAction}
        onClose={closeOrderPreview}
        onVerify={handleVerify}
        onReject={handleReject}
        onDispatch={handleDispatch}
        onAmend={(order) => {
          setSelectedOrder(null);
          clearOrderQuery();
          setAmendOrder(order);
        }}
        onDownloadPdf={handleDownloadPdf}
      />

      <TransitionConfirmSheet
        open={Boolean(confirmAction)}
        onClose={() => {
          if (!listActionBusy) {
            setConfirmAction(null);
            setListActionError("");
          }
        }}
        order={confirmAction?.order}
        action={confirmAction?.action}
        target={confirmAction?.target}
        onConfirm={handleInlineConfirm}
        busy={listActionBusy}
        error={listActionError}
      />

      <AmendOrderModal
        key={amendOrder?._id || "amend-modal-closed"}
        open={Boolean(amendOrder)}
        order={amendOrder}
        saving={busyAction === `amend-${amendOrder?._id}`}
        onClose={() => {
          if (!busyAction) setAmendOrder(null);
        }}
        onSave={handleSaveAmendment}
      />

      <style>{`
        .dispatcher-orders-page button{ -webkit-tap-highlight-color:transparent; }

        .dispatcher-order-tabs{ display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid rgba(29,29,31,.1); overflow-x:auto; scrollbar-width:none; }
        .dispatcher-order-tabs::-webkit-scrollbar{ display:none; }
        .dispatcher-order-tab{ min-width:max-content; display:flex; align-items:center; gap:10px; padding:12px 18px 15px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; white-space:nowrap; border-radius:14px 14px 0 0; transition:background .16s ease; }
        .dispatcher-order-tab:not(.is-active):hover{ background:rgba(29,29,31,.045); }
        .dispatcher-order-tab:not(.is-active):active{ background:rgba(29,29,31,.075); }
        .dispatcher-order-tab span:first-child{ font-size:13.5px; font-weight:650; color:var(--color-graphite, #707070); }
        .dispatcher-order-tab-count{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:750; background:rgba(29,29,31,.06); color:var(--color-graphite, #707070); }
        .dispatcher-order-tab.is-active{ --tab-accent:var(--color-azure, #0071e3); border-bottom-color:var(--tab-accent); }
        .dispatcher-order-tab[data-status="COMPLETED"].is-active{ --tab-accent:#2fb344; }
        .dispatcher-order-tab[data-status="REJECTED"].is-active{ --tab-accent:#b42318; }
        .dispatcher-order-tab.is-active:hover{ background:color-mix(in srgb, var(--tab-accent) 7%, transparent); }
        .dispatcher-order-tab.is-active span:first-child{ color:var(--tab-accent); font-weight:700; }
        .dispatcher-order-tab.is-active .dispatcher-order-tab-count{ background:color-mix(in srgb, var(--tab-accent) 12%, transparent); color:var(--tab-accent); }

        .dispatcher-order-timeline{ position:relative; display:grid; gap:18px; }
        .dispatcher-order-timeline-day{ position:relative; display:grid; gap:8px; }
        .dispatcher-order-timeline-day-header{ display:flex; align-items:center; padding:0 2px; }
        .dispatcher-order-timeline-day-label{ display:flex; align-items:center; font-size:12px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .dispatcher-order-timeline-day-label strong{ font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .dispatcher-order-timeline-day-sep{ margin:0 8px; opacity:.5; }

        /* Matches AdminOrdersPage.jsx's Order Register card exactly - status
           used to live in four places here too (a colored marker icon, this
           Pill, the rail, and a bottom row repeating the label with its own
           spinner) - trimmed to just the Pill + rail. Flatter elevation
           (hairline border, near-flush shadow) matches DESIGN.md's
           restrained-shadow guidance instead of the floating-card look this
           previously had. */
        .dispatcher-order-card{
          border-radius:14px;
          border:1px solid rgba(29,29,31,.08);
          background:#fff;
          padding:14px 16px;
          cursor:pointer;
          box-shadow:0 1px 2px rgba(29,29,31,.03);
          transition:border-color .16s ease, background-color .16s ease, box-shadow .16s ease;
        }
        .dispatcher-order-card:hover{ border-color:rgba(0,113,227,.22); box-shadow:0 2px 8px rgba(29,29,31,.05); }
        .dispatcher-order-card:active{ background:rgba(0,113,227,.025); }
        .dispatcher-order-card:focus-visible{ outline:2px solid rgba(0,113,227,.38); outline-offset:2px; }
        .dispatcher-order-card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .dispatcher-order-dealer{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
        .dispatcher-order-number{ font-size:11.5px; font-weight:600; color:var(--color-graphite, #707070); }
        .dispatcher-order-amount{ font-size:14.5px; font-weight:700; color:var(--color-ink, #1d1d1f); white-space:nowrap; }
        .dispatcher-order-card-meta-row{ margin-top:10px; display:flex; align-items:center; gap:10px; }
        .dispatcher-order-meta{ font-size:11.5px; color:var(--color-graphite, #707070); }
        .dispatcher-order-card > .orderflow-rail{ margin-top:10px; }

        .dispatcher-order-thumb{ width:28px; height:28px; border-radius:7px; overflow:hidden; background:var(--color-fog, #f5f5f7); display:grid; place-items:center; flex-shrink:0; border:1px solid rgba(29,29,31,.04); }
        .dispatcher-order-thumb-more{ font-size:10px; font-weight:700; color:var(--color-graphite, #707070); }

        .dispatcher-order-page-btn{ min-width:32px; height:32px; padding:0 8px; border-radius:10px; border:none; background:transparent; font-size:12.5px; font-weight:700; color:var(--color-ink, #1d1d1f); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .16s ease, transform .14s ease; }
        .dispatcher-order-page-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .dispatcher-order-page-btn.is-active{ background:var(--color-azure, #0071e3); color:#fff; box-shadow:0 8px 18px rgba(0,113,227,.2); }
        .dispatcher-order-page-btn:not(.is-active):not(:disabled):hover{ background:rgba(29,29,31,.06); transform:translateY(-1px); }
        .dispatcher-order-page-btn:not(.is-active):not(:disabled):active{ background:rgba(29,29,31,.1); transform:translateY(0) scale(.965); }
        .dispatcher-order-page-btn.is-active:not(:disabled):hover{ background:#0077ed; transform:translateY(-1px); }
        .dispatcher-order-page-btn.is-active:not(:disabled):active{ background:#006edb; transform:translateY(0) scale(.965); }

        @media (prefers-reduced-motion: reduce){
          .dispatcher-order-card,
          .dispatcher-order-page-btn{ transition:none!important; }
          .dispatcher-order-card:hover,
          .dispatcher-order-page-btn:hover{ transform:none!important; }
        }

        @media (max-width:760px){
          .dispatcher-order-tab{ padding-left:10px; padding-right:10px; }
          .dispatcher-order-card{ padding:12px 14px; }
          .dispatcher-order-card-top{ align-items:flex-start; }
        }

        @media (max-width:560px){
          .dispatcher-order-card-top{ flex-direction:column; }
        }
      `}</style>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <OrderFlowRailStyles />
      <OwnerChipStyles />
      <ArrivalStyles />
      <TransitionConfirmSheetStyles />
    </div>
  );
}
