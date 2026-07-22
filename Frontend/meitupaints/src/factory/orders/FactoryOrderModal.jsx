import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useEnsureProformaInvoiceMetadataMutation,
  useMarkFactoryOrderDeliveredMutation,
  useMarkFactoryOrderOutForDeliveryMutation,
  useRejectFactoryOrderMutation,
  useUpdateFactoryDispatchPrepMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { handleTransitionError, GENERIC_ACTION_ERROR } from "../../shared/orderConflict.js";
import { getTransitions } from "../../shared/orderStateMachine.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton, SectionHeader, Spinner, ToggleSwitch } from "../../components/dashboard/DashboardUI.jsx";
import { Toast } from "../../components/dashboard/Toast.jsx";
import { Banner, CloseButton, DetailGrid, Disclosure, ModalOverlay } from "../factoryUI.jsx";
import { downloadProformaPdf } from "../invoices/downloadProformaPdf.jsx";
import { downloadOrderSummaryPdf } from "../../utils/downloadOrderSummaryPdf.jsx";
import {
  fieldInputStyle,
  money,
  productCount,
  productDisplayName,
  reservationLabel,
  compactDate,
  stockCheckTone,
  titleCaseLabel,
  priorityForOrder,
} from "../factoryHelpers.js";
import { OrderStatusRail, OrderFlowRailStyles } from "../../components/orderflow/OrderStatusRail.jsx";
import { OwnerChip, OwnerChipStyles } from "../../components/orderflow/OwnerChip.jsx";
import { OrderEventFeed, OrderEventFeedStyles } from "../../components/orderflow/OrderEventFeed.jsx";
import { TransitionConfirmSheet, TransitionConfirmSheetStyles } from "../../components/orderflow/TransitionConfirmSheet.jsx";
import { useOrderTransition } from "../../components/orderflow/useOrderTransition.js";
import { CelebrationLine, OrderTransitionStyles } from "../../components/orderflow/CelebrationLine.jsx";

const CHECKLIST_ITEMS = [
  ["stock", "Stock Available"],
  ["packing", "Packing Complete"],
];

function TableWrap({ headers, cellPadding = "9px 12px", children }) {
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
                    padding: cellPadding,
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

export default function FactoryOrderModal({ orderId, orders, onClose, onDispatched, onDelivered, onRefetchList }) {
  const order = useMemo(() => (orders || []).find((item) => item._id === orderId) || null, [orders, orderId]);

  // Hydrated from order.dispatchPrep (persisted server-side) rather than
  // blank literals, so closing this modal before clicking Dispatch and
  // reopening the same order restores exactly where the factory left off -
  // no forced re-entry of driver details or PI regeneration.
  const [driverName, setDriverName] = useState(() => order?.dispatchPrep?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(() => order?.dispatchPrep?.driverPhone || "");
  const [vehicleNumber, setVehicleNumber] = useState(() => order?.dispatchPrep?.vehicleNumber || "");
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [checklist, setChecklist] = useState(() => ({
    stock: Boolean(order?.dispatchPrep?.stockConfirmed),
    packing: Boolean(order?.dispatchPrep?.packingConfirmed),
    invoice: Boolean(order?.dispatchPrep?.proformaGeneratedAt),
  }));
  const [piGenerated, setPiGenerated] = useState(() => Boolean(order?.dispatchPrep?.proformaGeneratedAt));
  const [invoiceHint, setInvoiceHint] = useState(false);
  const [confirmingDispatch, setConfirmingDispatch] = useState(false);
  const [confirmingDeliver, setConfirmingDeliver] = useState(false);
  const [generatingProforma, setGeneratingProforma] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [savingDispatchPrep, setSavingDispatchPrep] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const invoiceHintTimeout = useRef(null);
  const orderTransition = useOrderTransition();

  useEffect(() => () => clearTimeout(invoiceHintTimeout.current), []);

  const [markOut, markOutState] = useMarkFactoryOrderOutForDeliveryMutation();
  const [markDelivered, deliveredState] = useMarkFactoryOrderDeliveredMutation();
  const [rejectOrder, rejectState] = useRejectFactoryOrderMutation();
  const [updateDispatchPrep] = useUpdateFactoryDispatchPrepMutation();
  const [ensureProformaInvoiceMetadata] = useEnsureProformaInvoiceMetadataMutation();

  const busy = markOutState.isLoading || deliveredState.isLoading || rejectState.isLoading || pdfBusy || savingDispatchPrep;

  if (!order) return null;

  // getTransitions (not the old isOrderAwaitingFactory/isOrderInShipment/
  // isOrderDone booleans) decides what's legal - same names kept so every
  // existing `canDispatch`/`canDeliver`/`canReject` usage below is
  // unaffected by the source change (§Phase 1 "Deletions").
  const factoryTransitions = getTransitions(order, "FACTORY");
  const canDispatch = factoryTransitions.some((t) => t.action === "dispatch");
  const canDeliver = factoryTransitions.some((t) => t.action === "deliver");
  const canReject = factoryTransitions.some((t) => t.action === "reject");
  const driverReady = Boolean(driverName.trim() && driverPhone.trim());
  // The PI is a physical document handed to whoever's driving - the vehicle
  // number has to be on it before it can be generated, even though Dispatch
  // itself only strictly needs a driver name/phone to proceed.
  const proformaReady = driverReady && Boolean(vehicleNumber.trim());
  const readyForShipment = checklist.stock && checklist.packing && checklist.invoice && driverReady;
  // Once an order has actually been dispatched, its driver info is already
  // saved on the order itself - the PI can be (re)downloaded straight from
  // that, no form needed. Keyed off the saved data rather than status
  // strings so it naturally covers Shipment, Completed, and a cancelled
  // order that had already been dispatched before cancellation.
  const hasDispatchRecord = Boolean(order.factory?.driverName);
  const stockRows = order.stockCheck?.items || [];
  const reservationStatus = reservationLabel(order);
  const hasDeductedStock = Boolean(order.stockDeduction?.deductedAt);
  // The PI-generation flow still shows the inline driver form here (it can
  // run independently of dispatching); the dispatch flow's own copy of the
  // same fields now lives inside TransitionConfirmSheet's children instead
  // (§Phase 4: "driver details + PI controls injected as children").
  const showDriverDetails = generatingProforma;

  async function run(fn) {
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        refetchOrder: onRefetchList,
        showToast: (t) => setToast({ tone: t.tone, title: t.message }),
      });
      if (!wasConflict) {
        setError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
    }
  }

  function toggleChecklist(key) {
    const next = !checklist[key];
    setChecklist((current) => ({ ...current, [key]: next }));
    if (key === "stock" || key === "packing") {
      run(() =>
        updateDispatchPrep({
          orderId: order._id,
          payload: { [key === "stock" ? "stockConfirmed" : "packingConfirmed"]: next },
        }).unwrap(),
      );
    }
  }

  function showInvoiceHint() {
    setInvoiceHint(true);
    clearTimeout(invoiceHintTimeout.current);
    invoiceHintTimeout.current = setTimeout(() => setInvoiceHint(false), 2200);
  }

  function handleInvoiceToggle(next) {
    if (next && !piGenerated) {
      showInvoiceHint();
      return;
    }
    setChecklist((current) => ({ ...current, invoice: next }));
  }

  async function generateProforma(driver) {
    setPdfBusy(true);
    await run(async () => {
      const { item } = await ensureProformaInvoiceMetadata(order._id).unwrap();
      await downloadProformaPdf({
        orderId: order._id,
        orderNumber: order.orderNumber,
        serialNumber: item?.serialNumber,
        generatedAt: item?.generatedAt,
        dealer: order.dealerSnapshot || {},
        payment: order.payment || {},
        driver,
        items: order.items || [],
        totals: order.totals || {},
      });
    });
    setPdfBusy(false);
  }

  async function handleCreateProforma() {
    const wasAlreadyGenerated = piGenerated;
    await generateProforma({ name: driverName, phone: driverPhone, vehicleNumber });
    setSavingDispatchPrep(true);
    const success = await run(() =>
      updateDispatchPrep({
        orderId: order._id,
        payload: { driverName, driverPhone, vehicleNumber, generateProforma: true },
      }).unwrap(),
    );
    setSavingDispatchPrep(false);
    if (!success) return;
    setPiGenerated(true);
    setChecklist((current) => ({ ...current, invoice: true }));
    setGeneratingProforma(false);
    setToast({
      tone: "success",
      title: wasAlreadyGenerated ? "Proforma Invoice updated" : "Proforma Invoice generated",
      description: `${order.orderNumber} · download started.`,
    });
  }

  function handleDownloadExistingProforma() {
    return generateProforma({
      name: order.factory?.driverName || "",
      phone: order.factory?.driverPhone || "",
      vehicleNumber: order.factory?.vehicleNumber || "",
    });
  }

  async function handleDownloadOrderSummary() {
    setSummaryBusy(true);
    await run(() => downloadOrderSummaryPdf({ order, dealer: order.dealerSnapshot || {} }));
    setSummaryBusy(false);
  }

  // §Phase 4: "stop ejecting the operator" - success no longer closes the
  // modal or switches lanes by itself. It celebrates in place (rail
  // advances via the order prop naturally updating once markOut/
  // markDelivered's cache invalidation refetches); the actual close+switch+
  // toast (onDispatched/onDelivered, still owned by FactoryOrdersPage)
  // fires only when the operator deliberately chooses to leave, via the
  // ghost button or the modal's own close button.
  async function handleConfirmDispatch() {
    const success = await run(() =>
      markOut({ orderId: order._id, payload: { driverName, driverPhone, vehicleNumber } }).unwrap(),
    );
    if (success) {
      orderTransition.celebrate({ action: "dispatch", kind: "primary", irreversible: true });
    }
    return success;
  }

  async function handleConfirmDeliver() {
    const success = await run(() => markDelivered({ orderId: order._id }).unwrap());
    if (success) {
      orderTransition.celebrate({ action: "deliver", kind: "primary", irreversible: true });
    }
    return success;
  }

  function handleModalClose() {
    if (orderTransition.celebration?.action === "dispatch") {
      onDispatched?.(order);
    } else if (orderTransition.celebration?.action === "deliver") {
      onDelivered?.(order);
    } else {
      onClose();
    }
  }

  return (
    <ModalOverlay open={Boolean(order)} onClose={handleModalClose} maxWidth={900}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader
            eyebrow={`${order.dealerSnapshot?.companyName || "Dealer"} · ${titleCaseLabel(order.status)}`}
            icon="orders"
            title={order.orderNumber}
          />
          <CloseButton onClick={handleModalClose} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {canDispatch && !generatingProforma ? (
              <PrimaryButton
                icon="truck"
                disabled={busy || !readyForShipment}
                onClick={() => setConfirmingDispatch(true)}
              >
                Dispatch
              </PrimaryButton>
            ) : null}
            {canDispatch ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <GhostButton
                  disabled={busy || (generatingProforma && !proformaReady)}
                  onClick={generatingProforma ? handleCreateProforma : () => setGeneratingProforma(true)}
                  style={
                    generatingProforma
                      ? { background: "var(--color-ink, #1d1d1f)", color: "#fff", borderColor: "var(--color-ink, #1d1d1f)" }
                      : undefined
                  }
                >
                  {generatingProforma ? (
                    pdfBusy || savingDispatchPrep ? (
                      <Spinner size={14} color={generatingProforma ? "#fff" : undefined} />
                    ) : (
                      <DashboardIcon name="download" size={14} />
                    )
                  ) : piGenerated ? (
                    <DashboardIcon name="refresh" size={14} />
                  ) : (
                    <DashboardIcon name="invoice" size={14} />
                  )}
                  {generatingProforma
                    ? pdfBusy || savingDispatchPrep
                      ? "Saving…"
                      : piGenerated
                        ? "Update Proforma Invoice"
                        : "Create Proforma Invoice"
                    : piGenerated
                      ? "Regenerate Proforma Invoice"
                      : "Generate Proforma Invoice"}
                </GhostButton>
                {generatingProforma ? (
                  <button
                    type="button"
                    aria-label="Close driver details"
                    onClick={() => setGeneratingProforma(false)}
                    disabled={busy}
                    className="factory-order-mini-close"
                  >
                    <DashboardIcon name="close" size={12} strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {canDeliver ? (
              <PrimaryButton disabled={busy} onClick={() => setConfirmingDeliver(true)}>
                {deliveredState.isLoading ? <Spinner size={14} /> : <DashboardIcon name="checkmark" size={15} strokeWidth={2} />}
                {deliveredState.isLoading ? "Completing…" : "Mark Delivered"}
              </PrimaryButton>
            ) : null}
            {!canDispatch && hasDispatchRecord ? (
              <GhostButton icon="download" disabled={busy} onClick={handleDownloadExistingProforma}>
                {pdfBusy ? "Downloading…" : "Download Proforma Invoice"}
              </GhostButton>
            ) : null}
            {!canDispatch && !canDeliver && !hasDispatchRecord ? (
              <Pill tone="neutral">No pending factory action</Pill>
            ) : null}
          </div>

          <GhostButton
            icon="download"
            disabled={summaryBusy}
            onClick={handleDownloadOrderSummary}
            style={{ height: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 650 }}
          >
            {summaryBusy ? "…" : "Order Summary"}
          </GhostButton>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {orderTransition.celebration ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(0,113,227,.06)",
            }}
          >
            <CelebrationLine
              celebration={orderTransition.celebration}
              holdOpen={orderTransition.holdOpen}
              resumeCountdown={orderTransition.resumeCountdown}
            />
            <GhostButton onClick={handleModalClose}>
              Done — view {orderTransition.celebration.action === "dispatch" ? "Shipment" : "Completed"} lane
            </GhostButton>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <OrderStatusRail order={order} size="lg" />
          <OwnerChip order={order} role="FACTORY" />
        </div>

        {canDispatch ? (
          <section style={{ display: "grid", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (confirmingDispatch) return;
                setGeneratingProforma((value) => !value);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: confirmingDispatch ? "default" : "pointer",
                background: driverReady ? "rgba(22,163,74,.08)" : "var(--color-fog, #f5f5f7)",
                font: "inherit",
                textAlign: "left",
                transition: "background .16s ease",
              }}
            >
              <DashboardIcon name="truck" size={15} strokeWidth={1.8} style={{ color: driverReady ? "#15803d" : "var(--color-graphite, #707070)", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: driverReady ? "#15803d" : "var(--color-ink, #1d1d1f)" }}>
                {driverReady ? "Driver Ready" : "Driver Details Needed"}
              </span>
            </button>

            {showDriverDetails ? (
              <div className="dash-fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Name</span>
                  <input value={driverName} onChange={(event) => setDriverName(event.target.value)} style={fieldInputStyle()} autoFocus />
                </label>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Phone</span>
                  <input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} style={fieldInputStyle()} />
                </label>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
                    Vehicle Number{generatingProforma ? <span style={{ color: "var(--color-azure, #0071e3)" }}> (required for PI)</span> : null}
                  </span>
                  <input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} style={fieldInputStyle()} />
                </label>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {CHECKLIST_ITEMS.map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{label}</span>
                  <ToggleSwitch checked={checklist[key]} onChange={() => toggleChecklist(key)} label={label} />
                </div>
              ))}
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>Invoice Generated</span>
                  <ToggleSwitch checked={checklist.invoice} onChange={handleInvoiceToggle} label="Invoice Generated" />
                </div>
                <AnimatePresence>
                  {invoiceHint ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: "easeIn" } }}
                      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 8px)",
                        right: 0,
                        zIndex: 5,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "var(--color-ink, #1d1d1f)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        boxShadow: "0 10px 24px rgba(15,23,42,.18)",
                      }}
                    >
                      <DashboardIcon name="warning" size={13} strokeWidth={2} />
                      Generate the Proforma Invoice first
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </section>
        ) : null}

        <Disclosure label="Dealer, Order & Factory Details">
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
        </Disclosure>

        <Disclosure
          label="Stock Reservation Snapshot"
          trailing={
            <Pill tone={reservationStatus === "Reserved" || reservationStatus === "Deducted" ? "positive" : "neutral"} size="small">
              {reservationStatus}
            </Pill>
          }
        >
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
        </Disclosure>

        <Disclosure label="Activity" defaultOpen>
          <OrderEventFeed order={order} />
        </Disclosure>

        <Disclosure label={`Product List (${(order.items || []).length})`}>
          <TableWrap headers={["Product", "Qty", "Rate", "Total"]} cellPadding="13px 18px">
            {(order.items || []).map((item, index) => (
              <tr key={`${item.sku}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{productDisplayName(item)}</td>
                <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 13 }}>{item.quantity}</td>
                <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 13 }}>{money(item.unitPrice, order.totals?.currency)}</td>
                <td style={{ padding: "13px 18px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{money(item.lineTotal, order.totals?.currency)}</td>
              </tr>
            ))}
          </TableWrap>
        </Disclosure>

        {canReject ? (
          <section>
            {!rejecting ? (
              <GhostButton danger icon="reject" disabled={busy} onClick={() => setRejecting(true)}>
                Reject Order
              </GhostButton>
            ) : (
              <div className="dash-fade-up" style={{ display: "grid", gap: 8, padding: 16, borderRadius: 14, background: "rgba(180,35,24,.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#b42318" }}>Reject Order</span>
                <input
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Rejection reason (required)"
                  style={fieldInputStyle()}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <GhostButton
                    disabled={busy}
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </GhostButton>
                  <GhostButton
                    danger
                    icon="reject"
                    disabled={busy || !rejectReason.trim()}
                    onClick={() => run(() => rejectOrder({ orderId: order._id, payload: { reason: rejectReason } }).unwrap())}
                  >
                    Confirm Reject
                  </GhostButton>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <TransitionConfirmSheet
        open={confirmingDispatch}
        onClose={() => setConfirmingDispatch(false)}
        order={order}
        action="dispatch"
        target="DISPATCHED"
        onConfirm={handleConfirmDispatch}
        busy={busy}
        error={error}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Name</span>
            <input value={driverName} onChange={(event) => setDriverName(event.target.value)} style={fieldInputStyle()} autoFocus />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Driver Phone</span>
            <input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} style={fieldInputStyle()} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Vehicle Number</span>
            <input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} style={fieldInputStyle()} />
          </label>
        </div>
      </TransitionConfirmSheet>

      <TransitionConfirmSheet
        open={confirmingDeliver}
        onClose={() => setConfirmingDeliver(false)}
        order={order}
        action="deliver"
        target="COMPLETED"
        onConfirm={handleConfirmDeliver}
        busy={busy}
        error={error}
      />

      <OrderFlowRailStyles />
      <OwnerChipStyles />
      <OrderEventFeedStyles />
      <TransitionConfirmSheetStyles />
      <OrderTransitionStyles />

      <style>{`
        .factory-order-mini-close{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:26px;
          height:26px;
          flex-shrink:0;
          border:none;
          border-radius:999px;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          cursor:pointer;
          transition:transform .12s var(--ease-out, ease), background .14s ease, color .14s ease;
        }
        .factory-order-mini-close:hover{
          background:rgba(180,35,24,.08);
          color:#b42318;
        }
        .factory-order-mini-close:active{ transform:scale(.88); }
        .factory-order-mini-close:disabled{ opacity:.5; cursor:not-allowed; }
      `}</style>
    </ModalOverlay>
  );
}
