import { useMemo, useState } from "react";
import {
  useAmendFactoryOrderMutation,
  useMarkFactoryOrderDeliveredMutation,
  useMarkFactoryOrderOutForDeliveryMutation,
  useRejectFactoryOrderMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton, SectionHeader, ToggleSwitch } from "../../components/dashboard/DashboardUI.jsx";
import { Banner, CloseButton, DetailGrid, ModalOverlay } from "../factoryUI.jsx";
import {
  fieldInputStyle,
  isOrderAwaitingFactory,
  isOrderDone,
  isOrderInShipment,
  laneForOrder,
  money,
  nextFactoryStep,
  productCount,
  reservationLabel,
  statusTone,
  compactDate,
  stockCheckTone,
  titleCaseLabel,
  priorityForOrder,
} from "../factoryHelpers.js";

const CHECKLIST_ITEMS = [
  ["stock", "Stock Available"],
  ["packing", "Packing Complete"],
  ["invoice", "Invoice Generated"],
  ["quality", "Quality Checked"],
];

function TableWrap({ headers, children }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
              {headers.map((head, index) => (
                <th
                  key={head}
                  style={{
                    textAlign: index === 0 ? "left" : "right",
                    padding: "9px 12px",
                    fontSize: 10.5,
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
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function FactoryOrderModal({ orderId, orders, onClose }) {
  const order = useMemo(() => (orders || []).find((item) => item._id === orderId) || null, [orders, orderId]);

  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [amendReason, setAmendReason] = useState("");
  const [amendNote, setAmendNote] = useState("");
  const [checklist, setChecklist] = useState({ stock: false, packing: false, invoice: false, quality: false });
  const [confirmingDispatch, setConfirmingDispatch] = useState(false);
  const [error, setError] = useState("");

  const [markOut, markOutState] = useMarkFactoryOrderOutForDeliveryMutation();
  const [markDelivered, deliveredState] = useMarkFactoryOrderDeliveredMutation();
  const [rejectOrder, rejectState] = useRejectFactoryOrderMutation();
  const [amendOrder, amendState] = useAmendFactoryOrderMutation();

  const busy = markOutState.isLoading || deliveredState.isLoading || rejectState.isLoading || amendState.isLoading;

  if (!order) return null;

  const canDispatch = isOrderAwaitingFactory(order);
  const canDeliver = isOrderInShipment(order);
  const canAmend = isOrderAwaitingFactory(order);
  const canReject = !isOrderDone(order);
  const driverReady = Boolean(driverName.trim() && driverPhone.trim());
  const readyForShipment = checklist.stock && checklist.packing && checklist.invoice && checklist.quality && driverReady;
  const stockRows = order.stockCheck?.items || [];
  const reservationStatus = reservationLabel(order);
  const hasDeductedStock = Boolean(order.stockDeduction?.deductedAt);

  async function run(fn) {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Action failed."));
    }
  }

  function toggleChecklist(key) {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <ModalOverlay open={Boolean(order)} onClose={onClose} maxWidth={900}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader
            eyebrow={`${order.dealerSnapshot?.companyName || "Dealer"} · ${titleCaseLabel(order.status)}`}
            icon="orders"
            title={order.orderNumber}
            subtitle={`${productCount(order)} item${productCount(order) === 1 ? "" : "s"} · ${money(order.totals?.total, order.totals?.currency)}`}
          />
          <CloseButton onClick={onClose} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 12, background: "var(--color-fog, #f5f5f7)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Current Step</div>
            <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{titleCaseLabel(laneForOrder(order))}</div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{nextFactoryStep(order)}</div>
          </div>
          <Pill tone={statusTone(order.status)}>{titleCaseLabel(order.status)}</Pill>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {canDispatch && !confirmingDispatch ? (
            <PrimaryButton
              icon="truck"
              disabled={busy || !readyForShipment}
              onClick={() => setConfirmingDispatch(true)}
            >
              Dispatch
            </PrimaryButton>
          ) : null}
          {canDispatch && confirmingDispatch ? (
            <>
              <GhostButton onClick={() => setConfirmingDispatch(false)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton
                icon="checkmark"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    markOut({ orderId: order._id, payload: { driverName, driverPhone, vehicleNumber, remarks } }).unwrap(),
                  ).then(() => setConfirmingDispatch(false))
                }
              >
                {busy ? "Dispatching…" : "Confirm Dispatch — consumes reserved stock"}
              </PrimaryButton>
            </>
          ) : null}
          {canDeliver ? (
            <PrimaryButton
              icon="checkmark"
              disabled={busy}
              onClick={() => run(() => markDelivered({ orderId: order._id, payload: { note: remarks } }).unwrap())}
            >
              Mark Delivered
            </PrimaryButton>
          ) : null}
          {!canDispatch && !canDeliver ? (
            <Pill tone="neutral">No pending factory action</Pill>
          ) : null}
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {canDispatch ? (
          <section style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
              Dispatch Checklist
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {CHECKLIST_ITEMS.map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{label}</span>
                  <ToggleSwitch checked={checklist[key]} onChange={() => toggleChecklist(key)} label={label} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: driverReady ? "rgba(22,163,74,.08)" : "var(--color-fog, #f5f5f7)" }}>
                <DashboardIcon name="truck" size={15} strokeWidth={1.8} style={{ color: driverReady ? "#15803d" : "var(--color-graphite, #707070)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: driverReady ? "#15803d" : "var(--color-ink, #1d1d1f)" }}>
                  {driverReady ? "Driver Ready" : "Driver Details Needed"}
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Name</span>
                <input value={driverName} onChange={(event) => setDriverName(event.target.value)} style={fieldInputStyle()} />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Phone</span>
                <input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} style={fieldInputStyle()} />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Vehicle Number</span>
                <input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} style={fieldInputStyle()} />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Dispatch Remarks</span>
                <input value={remarks} onChange={(event) => setRemarks(event.target.value)} style={fieldInputStyle()} />
              </label>
            </div>
          </section>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ padding: 16, borderRadius: 14, background: "var(--color-fog, #f5f5f7)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)", marginBottom: 10 }}>Dealer</div>
            <DetailGrid
              rows={[
                ["Dealer", order.dealerSnapshot?.companyName || "—"],
                ["Contact", order.dealerSnapshot?.contactName || "—"],
                ["Email", order.dealerSnapshot?.email || "—"],
                ["Phone", order.dealerSnapshot?.phone || "—"],
              ]}
            />
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: "var(--color-fog, #f5f5f7)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)", marginBottom: 10 }}>Order Summary</div>
            <DetailGrid
              rows={[
                ["Products", productCount(order)],
                ["Total", money(order.totals?.total, order.totals?.currency)],
                ["Payment", order.payment?.method || "—"],
                ["Reference", order.payment?.reference || "—"],
              ]}
            />
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: "var(--color-fog, #f5f5f7)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)", marginBottom: 10 }}>Factory Status</div>
            <DetailGrid
              rows={[
                ["Priority", priorityForOrder(order)],
                ["Received", compactDate(order.factory?.sentToFactoryAt || order.createdAt)],
                ["Stock", reservationStatus],
                ["Deduction", hasDeductedStock ? "Deducted" : "Not deducted"],
              ]}
            />
          </div>
        </div>

        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Stock Reservation Snapshot</span>
            <Pill tone={reservationStatus === "Reserved" || reservationStatus === "Deducted" ? "positive" : "neutral"} size="small">{reservationStatus}</Pill>
          </div>
          <TableWrap headers={["Product", "Requested", "Current", "Reserved", "Available", "Status"]}>
            {stockRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
                  No stock snapshot attached yet — new orders receive one during Admin verification.
                </td>
              </tr>
            ) : (
              stockRows.map((row, index) => (
                <tr key={`${row.sku || row.name || "stock"}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{row.name || "Product"}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{row.sku || "No SKU"}</div>
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{Number(row.requestedQuantity || 0).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{Number(row.currentQuantity || 0).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{Number(row.reservedQuantity || 0).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{Number(row.availableQuantity || 0).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>
                    <Pill tone={stockCheckTone(row.status)} size="small">{titleCaseLabel(row.status)}</Pill>
                  </td>
                </tr>
              ))
            )}
          </TableWrap>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Product List</span>
          <TableWrap headers={["Product", "SKU", "Pack", "Qty", "Rate", "Total"]}>
            {(order.items || []).map((item, index) => (
              <tr key={`${item.sku}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.name}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{item.sku}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{item.packLabel || item.variantLabel}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{item.quantity}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13 }}>{money(item.unitPrice, order.totals?.currency)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{money(item.lineTotal, order.totals?.currency)}</td>
              </tr>
            ))}
          </TableWrap>
        </section>

        {canAmend || canReject ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {canAmend ? (
              <div style={{ display: "grid", gap: 8, padding: 16, borderRadius: 14, background: "var(--color-fog, #f5f5f7)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>Amend</span>
                <input value={amendReason} onChange={(event) => setAmendReason(event.target.value)} placeholder="Amendment reason (required)" style={fieldInputStyle()} />
                <input value={amendNote} onChange={(event) => setAmendNote(event.target.value)} placeholder="Optional internal note" style={fieldInputStyle()} />
                <GhostButton
                  icon="edit"
                  disabled={busy || !amendReason.trim()}
                  onClick={() => run(() => amendOrder({ orderId: order._id, payload: { reason: amendReason, note: amendNote } }).unwrap())}
                >
                  Record Amendment
                </GhostButton>
              </div>
            ) : null}
            {canReject ? (
              <div style={{ display: "grid", gap: 8, padding: 16, borderRadius: 14, background: "rgba(180,35,24,.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#b42318" }}>Reject</span>
                <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason (required)" style={fieldInputStyle()} />
                <GhostButton
                  danger
                  icon="reject"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() => run(() => rejectOrder({ orderId: order._id, payload: { reason: rejectReason } }).unwrap())}
                >
                  Reject Order
                </GhostButton>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>History</span>
          {(order.statusHistory || []).length === 0 ? (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>No status history recorded.</span>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {order.statusHistory.slice().reverse().map((item, index) => (
                <div key={`${item.toStatus}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <DashboardIcon name="history" size={13} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)", marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{titleCaseLabel(item.toStatus)}</div>
                    <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                      {item.note || item.reason || "Status changed"} · {compactDate(item.changedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ModalOverlay>
  );
}
