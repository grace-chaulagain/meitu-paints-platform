import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.js";
import {
  useAmendDispatcherOrderMutation,
  useDispatchDispatcherOrderMutation,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrdersQuery,
  useRejectDispatcherOrderMutation,
  useVerifyDispatcherOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { groupOrdersByDay } from "../../../utils/orderDayGrouping.js";

const VIEW_FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVE", label: "Archive" },
];

function statusTone(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "VERIFIED" || normalized === "DISPATCHED") return "positive";
  if (normalized === "REJECTED") return "critical";
  if (normalized === "ARCHIVED") return "neutral";
  return "caution";
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toUpperCase();
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

  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, seconds] of units) {
    const valueCount = Math.floor(diffSeconds / seconds);
    if (valueCount >= 1) return `Placed ${valueCount} ${unit}${valueCount > 1 ? "s" : ""} ago`;
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

function OrdersRow({ item, selected, onSelect }) {
  const dealer = item?.dealerId || item?.dealerSnapshot || {};
  const orderTotal = item?.totals?.total || 0;
  const currency = item?.totals?.currency || "NPR";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`dash-list-row dash-selectable-row ${selected ? "is-selected" : ""}`}
      style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.orderNumber || "Unnamed Order"}</span>
          <Pill tone={statusTone(item.status)} size="small">{normalizeStatus(item.status)}</Pill>
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {dealer?.companyName || "Unknown dealer"}
          {dealer?.contactName ? ` · ${dealer.contactName}` : ""}
        </div>
        <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {dealer?.phone || "No phone"} · {money(orderTotal, currency)} · {formatRelativeTime(item.createdAt)}
        </div>
      </div>
      <div style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
        {Array.isArray(item.items) ? `${item.items.length} items` : "—"}
      </div>
    </button>
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

function AmendOrderModal({ open, order, saving, onClose, onSave }) {
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
  const canDownloadPdf = normalizedStatus === "VERIFIED" || normalizedStatus === "DISPATCHED" || normalizedStatus === "ARCHIVED";
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
        <Pill tone={statusTone(normalizedStatus)} size="small">{normalizedStatus}</Pill>
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

  const queryOrderId = useMemo(() => new URLSearchParams(location.search || "").get("orderId") || "", [location.search]);

  const clearOrderQuery = useCallback(() => {
    if (!queryOrderId) return;
    navigate({ pathname: location.pathname }, { replace: true });
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
    const params = { limit: 100 };
    if (committedSearch.trim()) params.q = committedSearch.trim();

    if (viewMode === "ARCHIVE") {
      params.archive = true;
    } else if (viewMode === "VERIFIED") {
      params.status = "VERIFIED";
    } else if (viewMode === "REJECTED") {
      params.status = viewMode;
    } else {
      params.status = "SUBMITTED";
    }

    return params;
  }, [committedSearch, viewMode]);

  const ordersQuery = useGetDispatcherOrdersQuery(orderParams);
  const orderDetailQuery = useGetDispatcherOrderQuery(queryOrderId, { skip: !queryOrderId });
  const [verifyDispatcherOrder] = useVerifyDispatcherOrderMutation();
  const [rejectDispatcherOrder] = useRejectDispatcherOrderMutation();
  const [amendDispatcherOrder] = useAmendDispatcherOrderMutation();
  const [dispatchDispatcherOrder] = useDispatchDispatcherOrderMutation();

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
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
      PENDING: viewMode === "PENDING" ? orders.filter((o) => normalizeStatus(o.status) === "SUBMITTED").length : undefined,
      VERIFIED: viewMode === "VERIFIED" ? orders.filter((o) => normalizeStatus(o.status) === "VERIFIED").length : undefined,
      REJECTED: viewMode === "REJECTED" ? orders.filter((o) => normalizeStatus(o.status) === "REJECTED").length : undefined,
      ARCHIVE: viewMode === "ARCHIVE" ? orders.filter((o) => ["VERIFIED", "REJECTED", "ARCHIVED"].includes(normalizeStatus(o.status))).length : undefined,
    }),
    [orders, viewMode],
  );

  const segmentOptions = VIEW_FILTERS.map((filter) => ({ ...filter, count: countsByFilter[filter.key] }));

  const groupedOrders = useMemo(() => groupOrdersByDay(orders), [orders]);

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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Dispatcher Orders"
          subtitle={isRefreshing ? "Updating…" : "Review, amend, process, and download summaries for your assigned dealer orders."}
          action={<GhostButton icon="refresh" onClick={refetchOrders}>Refresh</GhostButton>}
        />

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
            <SearchField value={search} onChange={setSearch} onSubmit={applySearch} placeholder="Search order number, dealer, phone, payment…" />
          </div>
          <GhostButton onClick={applySearch}>Search</GhostButton>
          <SegmentedControl options={segmentOptions} value={viewMode} onChange={setViewMode} />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : orders.length === 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          <EmptyState icon="orders" title={viewMode === "ARCHIVE" ? "No handled orders found" : "No pending orders found"} subtitle="Try adjusting the search or status filter." />
          <div style={{ justifySelf: "center" }}>
            <GhostButton onClick={resetFilters}>Clear filters</GhostButton>
          </div>
        </div>
      ) : (
        <div className="dispatcher-order-timeline dash-fade-up">
          {groupedOrders.map((group) => (
            <div key={group.key} className="dispatcher-order-timeline-day">
              <div className="dispatcher-order-timeline-day-header">
                <span className="dispatcher-order-timeline-day-marker" aria-hidden="true" />
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
              <div style={{ marginLeft: 46 }}>
                <Surface padding={0}>
                  {group.orders.map((item) => (
                    <OrdersRow key={item._id} item={item} selected={selectedOrderView?._id === item._id} onSelect={openOrderPreview} />
                  ))}
                </Surface>
              </div>
            </div>
          ))}
        </div>
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
        .dispatcher-order-timeline{ position:relative; display:grid; gap:22px; }
        .dispatcher-order-timeline::before{
          content:"";
          position:absolute;
          left:15px;
          top:4px;
          bottom:4px;
          width:2px;
          background:linear-gradient(180deg, rgba(0,113,227,.24), rgba(29,29,31,.09));
        }
        .dispatcher-order-timeline-day{ position:relative; display:grid; gap:10px; }
        .dispatcher-order-timeline-day-header{ position:relative; display:grid; grid-template-columns:32px 1fr; align-items:center; column-gap:14px; }
        .dispatcher-order-timeline-day-label{ display:flex; align-items:center; font-size:12.5px; color:var(--color-graphite, #707070); white-space:nowrap; }
        .dispatcher-order-timeline-day-label strong{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
        .dispatcher-order-timeline-day-sep{ margin:0 8px; opacity:.5; }
        .dispatcher-order-timeline-day-marker{
          position:relative;
          z-index:1;
          justify-self:center;
          width:13px;
          height:13px;
          border-radius:999px;
          background:#fff;
          border:2px solid rgba(0,113,227,.82);
          flex-shrink:0;
          box-shadow:0 0 0 4px #fff;
        }
        @media (max-width:560px){
          .dispatcher-order-timeline::before{ left:11px; }
          .dispatcher-order-timeline-day-header{ grid-template-columns:24px 1fr; column-gap:10px; }
        }
      `}</style>
    </div>
  );
}
