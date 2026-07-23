import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.jsx";
import { downloadProformaPdf } from "../../../factory/invoices/downloadProformaPdf.jsx";
import {
  useAmendAdminOrderMutation,
  useDeleteAdminOrderMutation,
  useEnsureProformaInvoiceMetadataMutation,
  useGetAdminOrderQuery,
  useGetAdminOrderStockCheckQuery,
  useRejectAdminOrderMutation,
  useRevertAdminOrderVerificationMutation,
  useVerifyAdminOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { handleTransitionError, GENERIC_ACTION_ERROR } from "../../../shared/orderConflict.js";
import { ACTION_VERB, getTransitions } from "../../../shared/orderStateMachine.js";
import { useIsMobileAdmin } from "../../mobile/useIsMobileAdmin.js";
import { AdminOrderDetailMobileView } from "../../mobile/AdminOrderDetailMobileView.jsx";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { Surface } from "../../../components/dashboard/DashboardUI.jsx";
import OpsRefetchHairline from "../../../components/dashboard/OpsRefetchHairline.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import { OrderDetailStyles } from "../../../dealer/orderDetailUI.jsx";
import { formatFullDateTime, money } from "./orderFormatting.js";
import { OrderStatusRail, OrderFlowRailStyles } from "../../../components/orderflow/OrderStatusRail.jsx";
import { OwnerChip, OwnerChipStyles } from "../../../components/orderflow/OwnerChip.jsx";
import { OrderEventFeed, OrderEventFeedStyles } from "../../../components/orderflow/OrderEventFeed.jsx";
import { TransitionConfirmSheet, TransitionConfirmSheetStyles } from "../../../components/orderflow/TransitionConfirmSheet.jsx";
import { useOrderTransition } from "../../../components/orderflow/useOrderTransition.js";
import { CelebrationLine, OrderTransitionStyles } from "../../../components/orderflow/CelebrationLine.jsx";
import {
  ActionButton,
  AmendModal,
  CardLabel,
  DetailItem,
  GlassCard,
  OrderItemsTable,
  OriginBadge,
  RoutingBadge,
  SectionHeader,
  StatusBadge,
  StockCheckPanel,
} from "./AdminOrdersPage.jsx";

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 12px 0 8px",
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-ink, #1d1d1f)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
      Orders
    </button>
  );
}

// Shared note/reason field for TransitionConfirmSheet's `children` slot -
// same field, relabeled per action, used by both the mobile and desktop
// confirm sheets below (replaces the old AdminDecisionModal textarea).
function TransitionNoteField({ action, value, onChange, disabled }) {
  if (action !== "verify" && action !== "reject") return null;
  const label = action === "verify" ? "Verification note (optional)" : "Rejection reason (optional)";
  const placeholder =
    action === "verify"
      ? "e.g. Payment receipt confirmed, stock checked manually…"
      : "e.g. Out of stock, payment not received…";
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
        style={{
          width: "100%",
          borderRadius: 14,
          border: "none",
          background: "var(--color-fog, #f5f5f7)",
          padding: 12,
          fontSize: 13.5,
          fontWeight: 500,
          color: "var(--color-ink, #1d1d1f)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={20}>
        <div style={{ height: 20, width: 160, borderRadius: 8, background: "rgba(0,0,0,.06)" }} />
        <div style={{ marginTop: 10, height: 14, width: 220, borderRadius: 6, background: "rgba(0,0,0,.05)" }} />
      </Surface>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,.85fr)", gap: 16 }}>
        <GlassCard style={{ padding: 18, minHeight: 220 }}>
          <div style={{ height: 180, borderRadius: 12, background: "rgba(0,0,0,.04)" }} />
        </GlassCard>
        <div style={{ display: "grid", gap: 16 }}>
          <GlassCard style={{ padding: 18, minHeight: 100 }}>
            <div style={{ height: 70, borderRadius: 12, background: "rgba(0,0,0,.04)" }} />
          </GlassCard>
          <GlassCard style={{ padding: 18, minHeight: 100 }}>
            <div style={{ height: 70, borderRadius: 12, background: "rgba(0,0,0,.04)" }} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobileAdmin();

  // This same page is reused verbatim for a dealer's own "Full Order
  // History" flow (a nested route under their profile, rather than the
  // shared /admin/dashboard/orders list) so both entry points show
  // identical detail/history/PDF UI - only orderId extraction and the back
  // target below need to know which URL shape got them here.
  const orderId = useMemo(() => {
    const match =
      location.pathname.match(/^\/admin\/dashboard\/orders\/([^/]+)$/) ||
      location.pathname.match(/^\/admin\/dashboard\/dealers\/[^/]+\/orders\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const dealerOrdersDealerId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)\/orders\/[^/]+$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [amending, setAmending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [confirmTransition, setConfirmTransition] = useState(null); // { action, target, kind, irreversible } from getTransitions
  const [reviewNote, setReviewNote] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const orderTransition = useOrderTransition();

  const orderQuery = useGetAdminOrderQuery(orderId, { skip: !orderId, pollingInterval: 15000 });
  const order = orderQuery.data?.item || null;

  const [verifyAdminOrder] = useVerifyAdminOrderMutation();
  const [rejectAdminOrder] = useRejectAdminOrderMutation();
  const [amendAdminOrder] = useAmendAdminOrderMutation();
  const [deleteAdminOrder] = useDeleteAdminOrderMutation();
  const [ensureProformaInvoiceMetadata] = useEnsureProformaInvoiceMetadataMutation();
  const [revertAdminOrderVerification] = useRevertAdminOrderVerificationMutation();

  const dealer = order?.dealerSnapshot || order?.dealerId || {};
  const dispatcher = order?.dispatcherSnapshot || order?.dispatcherId || {};
  const isFactoryFulfillment = (dealer?.fulfillmentMode || "FACTORY") === "FACTORY";
  // Once the factory has actually dispatched the order, its driver details
  // are saved on order.factory - the Proforma Invoice can be (re)generated
  // straight from that record, mirroring the factory dashboard's own
  // "Download Proforma Invoice" affordance for Shipment/Completed orders.
  const hasDispatchRecord = Boolean(order?.factory?.driverName);
  const shouldCheckStock =
    Boolean(order?._id) && order?.status === "SUBMITTED" && isFactoryFulfillment;

  const stockCheckQuery = useGetAdminOrderStockCheckQuery(order?._id, {
    skip: !shouldCheckStock,
  });
  const stockCheck = stockCheckQuery.data;
  const stockCheckError = stockCheckQuery.error
    ? getQueryErrorMessage(stockCheckQuery.error)
    : "";
  const stockCheckLoading =
    shouldCheckStock &&
    (stockCheckQuery.isLoading || (stockCheckQuery.isFetching && !stockCheck));
  const stockBlocksVerify =
    shouldCheckStock &&
    (stockCheckLoading || Boolean(stockCheckError) || stockCheck?.ok !== true);

  // getTransitions(order,"ADMIN") drives what's offered, including
  // revert-verification once the Phase 6 backend endpoint exists (below) -
  // stockBlocksVerify is a runtime availability check the state machine has
  // no way to know about, so it's applied separately, same as the old
  // verify button's disabled logic.
  const availableTransitions = order ? getTransitions(order, "ADMIN") : [];

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        refetchOrder: () => orderQuery.refetch(),
        showToast: (t) => setToast({ tone: t.tone, title: t.message }),
      });
      if (wasConflict) {
        // The transition being confirmed is no longer valid - close the
        // sheet instead of leaving it open with a stale action, the fresh
        // order data (just refetched) is now visible on the page itself.
        setConfirmTransition(null);
      } else {
        setActionError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
    } finally {
      setBusyAction("");
    }
  }

  // If we arrived here by clicking a row in the list, go back via browser
  // history so the list's exact filters/page/scroll (all preserved in its URL
  // and the shell's scroll cache) are restored, instead of a fresh default list.
  const goBackToOrders = () => {
    if (dealerOrdersDealerId) {
      if (location.state?.fromDealerOrdersList) {
        navigate(-1);
      } else {
        navigate(`/admin/dashboard/dealers/${dealerOrdersDealerId}/orders`);
      }
      return;
    }
    if (location.state?.fromOrdersList) {
      navigate(-1);
    } else {
      navigate("/admin/dashboard/orders");
    }
  };

  function openTransition(transition) {
    setReviewNote("");
    setConfirmTransition(transition);
  }

  // Single handler for every ADMIN transition (verify, reject, and now
  // Phase 6's revert-verification) - replaces the old separate
  // handleVerify/window.prompt-based handleReject. Returns true/false
  // (TransitionConfirmSheet's own convention) so it auto-closes on success
  // and stays open with `actionError` visible on failure, exactly like the
  // desktop/mobile runAction call sites elsewhere.
  const handleConfirmTransition = async () => {
    if (!confirmTransition || !order) return false;
    const { action, kind, irreversible } = confirmTransition;
    const mutation =
      action === "verify"
        ? () => verifyAdminOrder({ orderId: order._id, payload: { reviewNote: reviewNote.trim() } }).unwrap()
        : action === "reject"
          ? () => rejectAdminOrder({ orderId: order._id, payload: { reviewNote: reviewNote.trim() } }).unwrap()
          : action === "revert-verification"
            ? () => revertAdminOrderVerification(order._id).unwrap()
            : null;
    if (!mutation) return false;

    const success = await runAction(`${action}-${order._id}`, mutation);
    if (success) {
      if (action === "reject") {
        goBackToOrders();
        return true;
      }
      if (action === "revert-verification") {
        // §6.3: quiet toast, no sound, no celebratory animation - this IS
        // the undo, so it doesn't get its own Undo-able celebration.
        orderTransition.dismissCelebration();
        setToast({ tone: "success", title: "Verification undone" });
        return true;
      }
      orderTransition.celebrate({ action, kind, irreversible, holdMs: 5000 });
      setToast({ tone: "success", title: "Order verified" });
    }
    return success;
  };

  async function handleUndoVerification() {
    if (!order) return;
    const success = await runAction(`revert-verification-${order._id}`, () =>
      revertAdminOrderVerification(order._id).unwrap(),
    );
    if (success) {
      orderTransition.dismissCelebration();
      setToast({ tone: "success", title: "Verification undone" });
    }
  }

  const handleDownloadProforma = async () => {
    if (!order) return;
    setPdfBusy(true);
    try {
      const { item } = await ensureProformaInvoiceMetadata(order._id).unwrap();
      await downloadProformaPdf({
        orderId: order._id,
        orderNumber: order.orderNumber,
        serialNumber: item?.serialNumber,
        generatedAt: item?.generatedAt,
        dealer,
        payment: order.payment || {},
        driver: {
          name: order.factory?.driverName || "",
          phone: order.factory?.driverPhone || "",
          vehicleNumber: order.factory?.vehicleNumber || "",
        },
        items: order.items || [],
        totals: order.totals || {},
      });
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to generate the Proforma Invoice."));
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSaveAmendment = async (payload) => {
    if (!order?._id) return;

    const success = await runAction(`amend-${order._id}`, async () => {
      const items = Array.isArray(payload.items) ? payload.items : [];
      const subtotal = items.reduce(
        (sum, item) => sum + Number(item?.lineTotal || 0),
        0,
      );

      await amendAdminOrder({
        orderId: order._id,
        payload: {
          items,
          totals: {
            subtotal,
            discount: 0,
            taxableAmount: subtotal,
            tax: 0,
            total: subtotal,
            currency: order?.totals?.currency || "NPR",
          },
          dealerNote: payload.dealerNote,
          internalNote: payload.internalNote,
          reason: payload.reason,
          note: payload.note,
        },
      }).unwrap();
    });

    if (success) setAmending(false);
  };

  const handleHardDelete = async () => {
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

    if (success) goBackToOrders();
  };

  if (isMobile) {
    return (
      <>
        <AdminOrderDetailMobileView
          order={order}
          loading={orderQuery.isLoading && !order}
          loadError={!orderQuery.isLoading && !order ? "Order not found" : ""}
          onBack={goBackToOrders}
          dealer={dealer}
          dispatcher={dispatcher}
          hasDispatchRecord={hasDispatchRecord}
          pdfBusy={pdfBusy}
          onDownloadProforma={handleDownloadProforma}
          onOpenVerify={() => openTransition(availableTransitions.find((t) => t.action === "verify"))}
          onOpenReject={() => openTransition(availableTransitions.find((t) => t.action === "reject"))}
          busyAction={busyAction}
        />
        <TransitionConfirmSheet
          open={Boolean(confirmTransition)}
          onClose={() => {
            if (!busyAction) {
              setConfirmTransition(null);
              setActionError("");
            }
          }}
          order={order}
          action={confirmTransition?.action}
          target={confirmTransition?.target}
          onConfirm={handleConfirmTransition}
          busy={Boolean(busyAction)}
          error={actionError}
        >
          <TransitionNoteField
            action={confirmTransition?.action}
            value={reviewNote}
            onChange={setReviewNote}
            disabled={Boolean(busyAction)}
          />
        </TransitionConfirmSheet>
        <TransitionConfirmSheetStyles />
        <OrderFlowRailStyles />
      </>
    );
  }

  if (orderQuery.isLoading && !order) {
    return <DetailSkeleton />;
  }

  if (!orderQuery.isLoading && !order) {
    return (
      <Surface padding={26} style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
          Order not found
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          It may have been moved to trash or the link is out of date.
        </div>
        <div style={{ marginTop: 16 }}>
          <BackButton onClick={goBackToOrders} />
        </div>
      </Surface>
    );
  }

  const contactLine = [dealer?.contactName, dealer?.phone].filter(Boolean).join(" · ");
  const paymentLine = [order?.payment?.method, order?.payment?.reference]
    .filter(Boolean)
    .join(" · ");
  const notes = [
    { label: "Dealer note", value: order?.dealerNote },
    { label: "Internal note", value: order?.internalNote },
    { label: "Review note", value: order?.review?.reviewNote },
    { label: "Payment note", value: order?.payment?.note },
  ].filter((note) => note.value);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <BackButton onClick={goBackToOrders} />
      </div>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle={
            order?.createdAt
              ? `Submitted ${formatFullDateTime(order.createdAt)}`
              : "Order detail"
          }
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <ActionButton
                subtle
                icon="download"
                onClick={() => downloadOrderSummaryPdf({ order, dealer })}
              >
                PDF
              </ActionButton>

              {hasDispatchRecord ? (
                <ActionButton
                  subtle
                  icon="invoice"
                  onClick={handleDownloadProforma}
                  disabled={pdfBusy}
                  loading={pdfBusy}
                >
                  {pdfBusy ? "Generating…" : "Proforma Invoice"}
                </ActionButton>
              ) : null}

              {order.status === "SUBMITTED" ? (
                <ActionButton
                  subtle
                  icon="edit"
                  onClick={() => setAmending(true)}
                  disabled={busyAction === `amend-${order._id}`}
                >
                  Amend
                </ActionButton>
              ) : null}

              {/* Only getTransitions(order,"ADMIN") drives what's offered here -
                  no more local status===SUBMITTED branching deciding what a
                  user may do (Phase 1's "Deletions" instruction). */}
              {availableTransitions.map((t) => {
                const stockGated = t.action === "verify" && stockBlocksVerify;
                return (
                  <ActionButton
                    key={t.action}
                    subtle={t.action === "revert-verification"}
                    danger={t.kind === "destructive"}
                    icon={t.action === "reject" ? "reject" : t.action === "revert-verification" ? "refresh" : "checkmark"}
                    onClick={() => openTransition(t)}
                    disabled={Boolean(busyAction) || stockGated}
                  >
                    {stockGated ? "Stock blocked" : ACTION_VERB[t.action]}
                  </ActionButton>
                );
              })}

              <ActionButton
                danger
                icon="trash"
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setDeleteConfirmation("");
                }}
                disabled={busyAction === `delete-${order._id}`}
              >
                {busyAction === `delete-${order._id}` ? "Moving..." : "Delete"}
              </ActionButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <OwnerChip order={order} role="ADMIN" />
          <StatusBadge status={order.status} />
          <RoutingBadge
            mode={dealer?.fulfillmentMode || "FACTORY"}
            dispatcherName={dispatcher?.companyName || dispatcher?.name || ""}
          />
          <OriginBadge origin={order?.orderOrigin} />
          <CelebrationLine
            celebration={orderTransition.celebration}
            onUndo={handleUndoVerification}
            holdOpen={orderTransition.holdOpen}
            resumeCountdown={orderTransition.resumeCountdown}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 18,
            background: "var(--color-fog, #f5f5f7)",
            border: "1px solid rgba(29,29,31,.06)",
          }}
        >
          <OrderStatusRail order={order} size="lg" />
        </div>

        {actionError ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {actionError}
          </div>
        ) : null}
      </Surface>

      <OpsRefetchHairline visible={orderQuery.isFetching && !(orderQuery.isLoading && !order)} />

      <GlassCard style={{ padding: 18 }}>
        <CardLabel icon="history">Activity</CardLabel>
        <div style={{ marginTop: 10 }}>
          <OrderEventFeed order={order} limit={6} />
        </div>
      </GlassCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(300px,.85fr)",
          gap: 16,
        }}
      >
        <GlassCard style={{ padding: 18 }}>
          <CardLabel icon="package">Order Items</CardLabel>
          <div style={{ marginTop: 8 }}>
            <OrderItemsTable items={order.items || []} />
          </div>
        </GlassCard>

        <div style={{ display: "grid", gap: 16 }}>
          <GlassCard style={{ padding: 18 }}>
            <CardLabel icon="store">Dealer</CardLabel>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <DetailItem label="Dealer" value={dealer?.companyName} />
              {contactLine ? <DetailItem label="Contact" value={contactLine} /> : null}
              {dealer?.email ? <DetailItem label="Email" value={dealer.email} /> : null}
              {dealer?.address ? <DetailItem label="Address" value={dealer.address} /> : null}
              {dealer?.fulfillmentMode === "DISPATCHER" ? (
                <DetailItem label="Assigned Dispatcher" value={dispatcher?.name || "Unassigned"} />
              ) : null}
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 18 }}>
            <CardLabel icon="invoice">Payment</CardLabel>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-ink, #1d1d1f)" }}>
                {money(order?.totals?.total, order?.totals?.currency || "NPR")}
              </div>
              {paymentLine ? (
                <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  {paymentLine}
                </div>
              ) : null}
            </div>
            {notes.length ? (
              <div style={{ marginTop: 14, display: "grid", gap: 10, borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 12 }}>
                {notes.map((note) => (
                  <DetailItem key={note.label} label={note.label} value={note.value} />
                ))}
              </div>
            ) : null}
          </GlassCard>
        </div>
      </div>

      {shouldCheckStock ? (
        <StockCheckPanel
          stockCheck={stockCheck}
          loading={stockCheckLoading || stockCheckQuery.isFetching}
          error={stockCheckError}
        />
      ) : null}

      <AmendModal
        open={amending}
        order={order}
        saving={busyAction === `amend-${order._id}`}
        onClose={() => {
          if (!busyAction) setAmending(false);
        }}
        onSave={handleSaveAmendment}
      />

      <AdminDecisionModal
        open={deleteConfirmOpen}
        title="Delete Order"
        subtitle="This moves the order to Settings Trash for 30 days before permanent database deletion. It can be restored during that window."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${order._id}`}
        details={[
          { label: "Order", value: order?.orderNumber },
          { label: "Status", value: order?.status },
          { label: "Dealer", value: dealer?.companyName },
          {
            label: "Total",
            value: money(order?.totals?.total, order?.totals?.currency || "NPR"),
          },
        ]}
        requireText={order?.orderNumber || ""}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (!busyAction) {
            setDeleteConfirmOpen(false);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={handleHardDelete}
      />

      <TransitionConfirmSheet
        open={Boolean(confirmTransition)}
        onClose={() => {
          if (!busyAction) {
            setConfirmTransition(null);
            setActionError("");
          }
        }}
        order={order}
        action={confirmTransition?.action}
        target={confirmTransition?.target}
        onConfirm={handleConfirmTransition}
        busy={Boolean(busyAction)}
        error={actionError}
      >
        <TransitionNoteField
          action={confirmTransition?.action}
          value={reviewNote}
          onChange={setReviewNote}
          disabled={Boolean(busyAction)}
        />
      </TransitionConfirmSheet>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <OrderDetailStyles />
      <OrderFlowRailStyles />
      <OwnerChipStyles />
      <OrderEventFeedStyles />
      <TransitionConfirmSheetStyles />
      <OrderTransitionStyles />
    </div>
  );
}
