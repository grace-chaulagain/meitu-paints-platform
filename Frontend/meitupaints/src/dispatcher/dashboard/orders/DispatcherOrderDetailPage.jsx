import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.jsx";
import {
  useAmendAdminOrderMutation,
  useCompleteDispatcherOrderMutation,
  useDispatchDispatcherOrderMutation,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrderStockCheckQuery,
  useRejectDispatcherOrderMutation,
  useVerifyDispatcherOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../../../admin/dashboard/components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import { OrderDetailStyles, OrderMilestoneStepper } from "../../../dealer/orderDetailUI.jsx";
import { normalizeStatus } from "../../../dealer/orderDetailLogic.js";
import { formatFullDateTime, money } from "../../../admin/dashboard/orders/orderFormatting.js";
import { AmendModal, StockCheckPanel } from "../../../admin/dashboard/orders/AdminOrdersPage.jsx";
import {
  ActionButton,
  CardLabel,
  DetailItem,
  GlassCard,
  OrderItemsTable,
  StatusBadge,
} from "./DispatcherOrdersPage.jsx";

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

// Same shape as Admin's own order detail page (see
// admin/dashboard/orders/AdminOrderDetailPage.jsx) - reached only from the
// Pending tab, since that's the one place a dispatcher actually makes a
// verify/reject/amend decision. Trimmed to what a dispatcher can actually
// do: no delete, no factory Proforma Invoice, no cross-fulfillment routing
// badges - just the order, the dealer, and the two real steps (verify then
// dispatch) a dispatcher's own assigned order goes through.
export default function DispatcherOrderDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const orderId = useMemo(() => {
    const match = location.pathname.match(/^\/dispatcher\/dashboard\/orders\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [amending, setAmending] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyNote, setVerifyNote] = useState("");
  const [toast, setToast] = useState(null);

  const orderQuery = useGetDispatcherOrderQuery(orderId, { skip: !orderId });
  const order = orderQuery.data?.item || null;

  const [verifyDispatcherOrder] = useVerifyDispatcherOrderMutation();
  const [rejectDispatcherOrder] = useRejectDispatcherOrderMutation();
  const [amendAdminOrder] = useAmendAdminOrderMutation();
  const [dispatchDispatcherOrder] = useDispatchDispatcherOrderMutation();
  const [completeDispatcherOrder] = useCompleteDispatcherOrderMutation();

  const dealer = order?.dealerId || order?.dealerSnapshot || {};
  const normalizedStatus = normalizeStatus(order?.status);
  const canAct = normalizedStatus === "SUBMITTED";
  const canFulfill = normalizedStatus === "VERIFIED";
  const canComplete = normalizedStatus === "DISPATCHED";
  const canDownloadPdf = normalizedStatus === "VERIFIED" || normalizedStatus === "DISPATCHED" || normalizedStatus === "COMPLETED";
  // Dispatcher orders never touch the central factory stock ledger - they're
  // covered by the dispatcher's own stock, only actually consumed at
  // dispatch time (see consumeDispatcherStockForOrder). So this stays
  // visible through both pre-dispatch stages (not just pre-verify like
  // Admin's factory stock check), and only the Dispatch action - the real
  // consumption point - gets blocked by it, not Verify.
  const shouldCheckStock = Boolean(order?._id) && (canAct || canFulfill);
  const stockCheckQuery = useGetDispatcherOrderStockCheckQuery(order?._id, { skip: !shouldCheckStock });
  const stockCheck = stockCheckQuery.data;
  const stockCheckError = stockCheckQuery.error ? getQueryErrorMessage(stockCheckQuery.error) : "";
  const stockCheckLoading = shouldCheckStock && (stockCheckQuery.isLoading || (stockCheckQuery.isFetching && !stockCheck));
  const stockBlocksDispatch = canFulfill && (stockCheckLoading || Boolean(stockCheckError) || stockCheck?.ok !== true);

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

  // If we arrived here by clicking a row in the list, go back via browser
  // history so the list's exact filters/page/scroll are restored, instead
  // of a fresh default list.
  const goBackToOrders = () => {
    if (location.state?.fromOrdersList) {
      navigate(-1);
    } else {
      navigate("/dispatcher/dashboard/orders");
    }
  };

  const handleVerify = async () => {
    const success = await runAction(`verify-${order._id}`, () =>
      verifyDispatcherOrder({
        orderId: order._id,
        payload: { reviewNote: verifyNote.trim() },
      }).unwrap(),
    );
    if (success) {
      setVerifyModalOpen(false);
      setVerifyNote("");
      setToast({
        tone: "success",
        title: "Order verified",
        description: `${order.orderNumber} is ready to dispatch.`,
      });
    }
  };

  const handleDispatch = async () => {
    const success = await runAction(`dispatch-${order._id}`, () =>
      dispatchDispatcherOrder({
        orderId: order._id,
        payload: { note: "" },
      }).unwrap(),
    );
    if (success) {
      setToast({
        tone: "success",
        title: "Order dispatched",
        description: `${order.orderNumber} has been dispatched and your stock deducted.`,
      });
    }
  };

  const handleComplete = async () => {
    const success = await runAction(`complete-${order._id}`, () =>
      completeDispatcherOrder({
        orderId: order._id,
        payload: { note: "" },
      }).unwrap(),
    );
    if (success) {
      setToast({
        tone: "success",
        title: "Order completed",
        description: `${order.orderNumber} is now marked as completed.`,
      });
    }
  };

  const handleReject = async () => {
    const reviewNote = window.prompt("Reason / rejection note:", "");
    if (reviewNote === null) return;

    const success = await runAction(`reject-${order._id}`, () =>
      rejectDispatcherOrder({
        orderId: order._id,
        payload: { reviewNote: reviewNote.trim() },
      }).unwrap(),
    );
    if (success) goBackToOrders();
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

  function handleDownloadPdf() {
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

  if (orderQuery.isLoading && !order) {
    return <DetailSkeleton />;
  }

  if (!orderQuery.isLoading && !order) {
    return (
      <Surface padding={26} style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>Order not found</div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          It may not be assigned to you, or the link is out of date.
        </div>
        <div style={{ marginTop: 16 }}>
          <BackButton onClick={goBackToOrders} />
        </div>
      </Surface>
    );
  }

  const contactLine = [dealer?.contactName, dealer?.phone].filter(Boolean).join(" · ");
  const paymentLine = [order?.payment?.method, order?.payment?.reference].filter(Boolean).join(" · ");
  const notes = [
    { label: "Dealer note", value: order?.dealerNote },
    { label: "Internal note", value: order?.internalNote },
    { label: "Review note", value: order?.review?.reviewNote },
  ].filter((note) => note.value);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <BackButton onClick={goBackToOrders} />
      </div>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          title={order.orderNumber || "Order Detail"}
          subtitle={order?.createdAt ? `Submitted ${formatFullDateTime(order.createdAt)}` : "Order detail"}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <ActionButton subtle icon="download" onClick={handleDownloadPdf} disabled={!canDownloadPdf}>
                PDF
              </ActionButton>

              {canAct ? (
                <>
                  <ActionButton subtle icon="edit" onClick={() => setAmending(true)} disabled={busyAction === `amend-${order._id}`}>
                    Amend
                  </ActionButton>
                  <ActionButton icon="checkmark" onClick={() => setVerifyModalOpen(true)} disabled={busyAction === `verify-${order._id}`}>
                    Verify
                  </ActionButton>
                  <ActionButton
                    danger
                    icon="reject"
                    onClick={handleReject}
                    disabled={busyAction === `reject-${order._id}`}
                    loading={busyAction === `reject-${order._id}`}
                  >
                    {busyAction === `reject-${order._id}` ? "Rejecting…" : "Reject"}
                  </ActionButton>
                </>
              ) : canFulfill ? (
                <ActionButton
                  icon="checkmark"
                  onClick={handleDispatch}
                  disabled={busyAction === `dispatch-${order._id}` || stockBlocksDispatch}
                  loading={busyAction === `dispatch-${order._id}`}
                >
                  {busyAction === `dispatch-${order._id}`
                    ? "Dispatching…"
                    : stockBlocksDispatch
                      ? "Stock blocked"
                      : "Dispatch (deducts your stock)"}
                </ActionButton>
              ) : canComplete ? (
                <ActionButton
                  icon="checkmark"
                  onClick={handleComplete}
                  disabled={busyAction === `complete-${order._id}`}
                  loading={busyAction === `complete-${order._id}`}
                >
                  {busyAction === `complete-${order._id}` ? "Completing…" : "Complete"}
                </ActionButton>
              ) : null}
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge status={order.status} />
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
          <OrderMilestoneStepper order={order} />
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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,.85fr)", gap: 16 }}>
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
          title="My Stock Check"
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
        open={verifyModalOpen}
        title="Verify this order?"
        subtitle="The order becomes ready to dispatch. You can leave a note for the record — it's optional."
        confirmLabel="Verify Order"
        busy={busyAction === `verify-${order._id}`}
        details={[
          { label: "Order", value: order?.orderNumber },
          { label: "Dealer", value: dealer?.companyName },
          { label: "Total", value: money(order?.totals?.total, order?.totals?.currency || "NPR") },
        ]}
        onClose={() => {
          if (!busyAction) {
            setVerifyModalOpen(false);
            setVerifyNote("");
          }
        }}
        onConfirm={handleVerify}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
            Verification note (optional)
          </span>
          <textarea
            value={verifyNote}
            onChange={(event) => setVerifyNote(event.target.value)}
            placeholder="e.g. Payment receipt confirmed, stock checked manually…"
            rows={3}
            disabled={busyAction === `verify-${order._id}`}
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
      </AdminDecisionModal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <OrderDetailStyles />
    </div>
  );
}
