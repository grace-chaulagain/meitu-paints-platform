import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminOrdersQuery, useVerifyAdminOrderMutation, useRejectAdminOrderMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../../dealer/pricing.js";
import { ORDER_STATUS_META, normalizeStatus } from "../../dealer/orderDetailLogic.js";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { useSwipeAction } from "../../dealer/mobile/useSwipeAction.js";
import { toast } from "../../dealer/mobile/useToast.js";
import { AdminOrderConfirmSheet } from "./AdminOrderConfirmSheet.jsx";

// ADMIN_MOBILE_DESIGN_PROMPT.md §3: 6-segment status filter, swipeable
// cards (Verify/Reject via a confirm sheet), no <table>. Mirrors the real
// ORDER_STATUS enum from Server/src/models/Order.model.js (6 values) - "All"
// is a 7th UI-only convenience, not a real status. CANCELLED is left out of
// the segment row to stay at exactly 6 segments per spec; it's still
// reachable - a cancelled order still shows up as a card if it happens to
// match "All" - just not its own filter tab, matching how the desktop
// AdminOrdersPage's own filter set already treats it as secondary.
const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Sent" },
  { key: "COMPLETED", label: "Done" },
  { key: "REJECTED", label: "Rejected" },
];

const REVEAL_WIDTH = 168;

function adminOrderStatusMeta(status) {
  const normalized = normalizeStatus(status);
  const base = ORDER_STATUS_META[normalized] || { label: normalized || "—", tone: "neutral", live: false };
  if (normalized === "VERIFIED" || normalized === "DISPATCHED") {
    return { ...base, tone: "accent", live: true };
  }
  return base;
}

function routingLabel(order) {
  const dealer = order?.dealerSnapshot || order?.dealerId || {};
  const dispatcher = order?.dispatcherSnapshot || order?.dispatcherId || {};
  if (order?.orderOrigin === "DISPATCHER_REPLENISHMENT") return "Dispatcher order";
  if ((dealer?.fulfillmentMode || "FACTORY") === "DISPATCHER") {
    return `Via ${dispatcher?.companyName || dispatcher?.name || "dispatcher"}`;
  }
  return "Factory";
}

function cardDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Swipe-left reveals Verify/Reject side by side (SUBMITTED orders only) -
// same useSwipeAction reveal-then-tap shape as DealerOrdersMobileView's
// reorder swipe, sized for two actions instead of one.
function OrderCardSwipe({ order, revealedOrderId, onReveal, onNavigate, onVerify, onReject }) {
  const status = normalizeStatus(order.status);
  const meta = adminOrderStatusMeta(status);
  const canAct = status === "SUBMITTED";
  const dealer = order?.dealerSnapshot || order?.dealerId || {};
  const dealerName = dealer?.companyName || dealer?.contactName || "Unassigned dealer";
  const itemCount = order.items?.length || 0;

  const swipe = useSwipeAction({
    axis: "x",
    onCommit: ({ passed }) => {
      onReveal(passed ? order._id : null);
      return passed ? -REVEAL_WIDTH : 0;
    },
  });

  useEffect(() => {
    if (revealedOrderId !== order._id) swipe.setPos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedOrderId, order._id]);

  return (
    <div className="dealer-m-orders-card-wrap">
      {canAct ? (
        <div className="admin-m-order-swipe-actions">
          <button type="button" className="admin-m-order-swipe-verify" onClick={() => onVerify(order)}>
            <DashboardIcon name="checkmark" size={16} strokeWidth={2.2} />
            Verify
          </button>
          <button type="button" className="admin-m-order-swipe-reject" onClick={() => onReject(order)}>
            <DashboardIcon name="reject" size={16} strokeWidth={2.2} />
            Reject
          </button>
        </div>
      ) : null}
      <button
        type="button"
        ref={canAct ? swipe.ref : undefined}
        {...(canAct ? swipe.handlers : {})}
        className={`dealer-m-orders-card ${meta.live ? "live" : ""}`}
        onClick={() => {
          if (canAct && swipe.wasDragged()) return;
          onNavigate();
        }}
      >
        <span className="dealer-m-orders-card-body">
          <span className="dealer-m-orders-card-number">{dealerName}</span>
          <span className="dealer-m-orders-card-meta">
            {order.orderNumber} · {routingLabel(order)}
          </span>
          <span className="dealer-m-orders-card-meta">
            {cardDateLabel(order.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </span>
        <span className="dealer-m-orders-card-right">
          <span className="dealer-m-orders-card-total">{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
          <span className="dealer-m-orders-card-status-row">
            <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
            <DashboardIcon name="chevron" size={16} strokeWidth={2} className="dealer-m-orders-card-chevron" />
          </span>
        </span>
      </button>
    </div>
  );
}

export function AdminOrdersMobileView() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState("ALL");
  const [revealedOrderId, setRevealedOrderId] = useState(null);
  const [sheet, setSheet] = useState(null); // { action: "verify"|"reject", order }
  const [sheetError, setSheetError] = useState("");

  const ordersQuery = useGetAdminOrdersQuery({ status: segment, limit: 50 });
  const [verifyAdminOrder, verifyState] = useVerifyAdminOrderMutation();
  const [rejectAdminOrder, rejectState] = useRejectAdminOrderMutation();
  const busy = verifyState.isLoading || rejectState.isLoading;

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const loading = ordersQuery.isLoading && orders.length === 0;
  const loadError = ordersQuery.error ? getQueryErrorMessage(ordersQuery.error, "Failed to load orders.") : "";

  function openOrder(order) {
    navigate(`/admin/dashboard/orders/${order._id}`, { state: { fromOrdersList: true } });
  }

  function closeSheet() {
    if (busy) return;
    setSheet(null);
    setSheetError("");
    setRevealedOrderId(null);
  }

  async function handleConfirm(note) {
    if (!sheet?.order) return;
    setSheetError("");
    try {
      if (sheet.action === "verify") {
        await verifyAdminOrder({ orderId: sheet.order._id, payload: { reviewNote: note } }).unwrap();
        toast(`${sheet.order.orderNumber} verified`);
      } else {
        await rejectAdminOrder({ orderId: sheet.order._id, payload: { reviewNote: note } }).unwrap();
        toast(`${sheet.order.orderNumber} rejected`);
      }
      setSheet(null);
      setRevealedOrderId(null);
    } catch (err) {
      setSheetError(getQueryErrorMessage(err, "Action failed."));
    }
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => ordersQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const activeOption = SEGMENTS.find((option) => option.key === segment);

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Orders</div>
            <div className="dealer-m-skel" style={{ height: 34, marginTop: 14, borderRadius: 999, width: "90%" }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader
          title="Orders"
          contextLabel={activeOption ? `${activeOption.label} · ${ordersQuery.data?.total ?? orders.length}` : null}
        />

        <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />

        {orders.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="orders" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No orders here</div>
          </div>
        ) : (
          <div className="dealer-m-orders-list" style={{ marginTop: 18 }}>
            {orders.map((order) => (
              <OrderCardSwipe
                key={order._id}
                order={order}
                revealedOrderId={revealedOrderId}
                onReveal={setRevealedOrderId}
                onNavigate={() => openOrder(order)}
                onVerify={(o) => setSheet({ action: "verify", order: o })}
                onReject={(o) => setSheet({ action: "reject", order: o })}
              />
            ))}
          </div>
        )}
      </SkeletonSwap>

      <AdminOrderConfirmSheet
        open={Boolean(sheet)}
        action={sheet?.action}
        order={sheet?.order}
        dealerName={(sheet?.order?.dealerSnapshot || sheet?.order?.dealerId || {}).companyName}
        busy={busy}
        error={sheetError}
        onClose={closeSheet}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
