import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadOrderSummaryPdf } from "../../../utils/downloadOrderSummaryPdf.js";
import {
  useAmendAdminOrderMutation,
  useDeleteAdminOrderMutation,
  useGetAdminOrderQuery,
  useGetAdminOrderStockCheckQuery,
  useRejectAdminOrderMutation,
  useVerifyAdminOrderMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { OrderDetailStyles, OrderMilestoneStepper } from "../../../dealer/orderDetailUI.jsx";
import { formatFullDateTime, money } from "./orderFormatting.js";
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

  const orderId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/orders\/([^/]+)$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [amending, setAmending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const orderQuery = useGetAdminOrderQuery(orderId, { skip: !orderId });
  const order = orderQuery.data?.item || null;

  const [verifyAdminOrder] = useVerifyAdminOrderMutation();
  const [rejectAdminOrder] = useRejectAdminOrderMutation();
  const [amendAdminOrder] = useAmendAdminOrderMutation();
  const [deleteAdminOrder] = useDeleteAdminOrderMutation();

  const dealer = order?.dealerSnapshot || order?.dealerId || {};
  const dispatcher = order?.dispatcherSnapshot || order?.dispatcherId || {};
  const isFactoryFulfillment = (dealer?.fulfillmentMode || "FACTORY") === "FACTORY";
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
  // history so the list's exact filters/page/scroll (all preserved in its URL
  // and the shell's scroll cache) are restored, instead of a fresh default list.
  const goBackToOrders = () => {
    if (location.state?.fromOrdersList) {
      navigate(-1);
    } else {
      navigate("/admin/dashboard/orders");
    }
  };

  const handleVerify = async () => {
    const reviewNote = window.prompt("Optional verification note:", "") ?? "";
    const success = await runAction(`verify-${order._id}`, () =>
      verifyAdminOrder({
        orderId: order._id,
        payload: { reviewNote: reviewNote.trim() },
      }).unwrap(),
    );
    if (success) goBackToOrders();
  };

  const handleReject = async () => {
    const reviewNote = window.prompt("Reason / rejection note:", "");
    if (reviewNote === null) return;

    const success = await runAction(`reject-${order._id}`, () =>
      rejectAdminOrder({
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

              {order.status === "SUBMITTED" ? (
                <>
                  <ActionButton
                    subtle
                    icon="edit"
                    onClick={() => setAmending(true)}
                    disabled={busyAction === `amend-${order._id}`}
                  >
                    Amend
                  </ActionButton>
                  <ActionButton
                    icon="checkmark"
                    onClick={handleVerify}
                    disabled={busyAction === `verify-${order._id}` || stockBlocksVerify}
                  >
                    {busyAction === `verify-${order._id}`
                      ? "Verifying..."
                      : stockBlocksVerify
                        ? "Stock blocked"
                        : "Verify"}
                  </ActionButton>
                  <ActionButton
                    danger
                    icon="reject"
                    onClick={handleReject}
                    disabled={busyAction === `reject-${order._id}`}
                  >
                    {busyAction === `reject-${order._id}` ? "Rejecting..." : "Reject"}
                  </ActionButton>
                </>
              ) : null}

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
          <StatusBadge status={order.status} />
          <RoutingBadge mode={dealer?.fulfillmentMode || "FACTORY"} />
          <OriginBadge origin={order?.orderOrigin} />
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

      <OrderDetailStyles />
    </div>
  );
}
