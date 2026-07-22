import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminOrdersQuery, useVerifyAdminOrderMutation, useRejectAdminOrderMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { handleTransitionError, GENERIC_ACTION_ERROR } from "../../shared/orderConflict.js";
import { getTransitions } from "../../shared/orderStateMachine.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../../dealer/pricing.js";
import { ORDER_STATUS_META, normalizeStatus } from "../../dealer/orderDetailLogic.js";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { useSwipeAction } from "../../dealer/mobile/useSwipeAction.js";
import { toast } from "../../dealer/mobile/useToast.js";
import { TransitionConfirmSheet, TransitionConfirmSheetStyles } from "../../components/orderflow/TransitionConfirmSheet.jsx";
import { OrderStatusRail, OrderFlowRailStyles } from "../../components/orderflow/OrderStatusRail.jsx";
import { OwnerChip, OwnerChipStyles } from "../../components/orderflow/OwnerChip.jsx";
import { useQueueArrivals } from "../../components/orderflow/arrivals.js";
import { ArrivalStyles, SoundMuteToggle } from "../../components/orderflow/ArrivalIndicators.jsx";

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

// Swipe-left reveals Verify/Reject side by side - same useSwipeAction
// reveal-then-tap shape as DealerOrdersMobileView's reorder swipe, sized
// for two actions instead of one. getTransitions (not a bare status===
// check) decides whether they're offered, so a dispatcher-mode order -
// which Admin never reviews - correctly shows neither (§Phase 1 "Deletions").
function OrderCardSwipe({ order, revealedOrderId, onReveal, onNavigate, onVerify, onReject, isArrived }) {
  const status = normalizeStatus(order.status);
  const meta = adminOrderStatusMeta(status);
  const transitions = getTransitions(order, "ADMIN");
  const verifyTransition = transitions.find((t) => t.action === "verify");
  const rejectTransition = transitions.find((t) => t.action === "reject");
  const canAct = Boolean(verifyTransition || rejectTransition);
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
    <div className={`dealer-m-orders-card-wrap ${isArrived ? "orderflow-arrival-highlight" : ""}`}>
      {canAct ? (
        <div className="admin-m-order-swipe-actions">
          {verifyTransition ? (
            <button type="button" className="admin-m-order-swipe-verify" onClick={() => onVerify(order, verifyTransition)}>
              <DashboardIcon name="checkmark" size={16} strokeWidth={2.2} />
              Verify
            </button>
          ) : null}
          {rejectTransition ? (
            <button type="button" className="admin-m-order-swipe-reject" onClick={() => onReject(order, rejectTransition)}>
              <DashboardIcon name="reject" size={16} strokeWidth={2.2} />
              Reject
            </button>
          ) : null}
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
          <span style={{ marginTop: 6, display: "block" }}>
            <OrderStatusRail order={order} size="sm" />
          </span>
        </span>
        <span className="dealer-m-orders-card-right">
          <span className="dealer-m-orders-card-total">{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
          <span className="dealer-m-orders-card-status-row">
            <OwnerChip order={order} role="ADMIN" />
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
  const [sheet, setSheet] = useState(null); // { order, action, target }
  const [sheetError, setSheetError] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const ordersQuery = useGetAdminOrdersQuery({ status: segment, limit: 50 }, { pollingInterval: 20000 });
  const [verifyAdminOrder, verifyState] = useVerifyAdminOrderMutation();
  const [rejectAdminOrder, rejectState] = useRejectAdminOrderMutation();
  const busy = verifyState.isLoading || rejectState.isLoading;

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const loading = ordersQuery.isLoading && orders.length === 0;
  const loadError = ordersQuery.error ? getQueryErrorMessage(ordersQuery.error, "Failed to load orders.") : "";

  // Same lane-diff pattern as the desktop Order Register (§2.6) - scoped
  // to the Pending segment, the only status bucket ADMIN can ever own.
  const arrivedIds = useQueueArrivals(segment === "SUBMITTED" ? orders : [], segment, { laneLabel: "Pending" });

  function openOrder(order) {
    navigate(`/admin/dashboard/orders/${order._id}`, { state: { fromOrdersList: true } });
  }

  function closeSheet() {
    if (busy) return;
    setSheet(null);
    setSheetError("");
    setRevealedOrderId(null);
  }

  function openSheet(order, transition) {
    setSheetError("");
    setReviewNote("");
    setSheet({ order, action: transition.action, target: transition.target });
  }

  // Matches TransitionConfirmSheet's onConfirm contract - true closes the
  // sheet itself, false leaves it open with `sheetError` visible.
  async function handleConfirm() {
    if (!sheet?.order) return false;
    setSheetError("");
    try {
      if (sheet.action === "verify") {
        await verifyAdminOrder({ orderId: sheet.order._id, payload: { reviewNote: reviewNote.trim() } }).unwrap();
        toast(`${sheet.order.orderNumber} verified`);
      } else {
        await rejectAdminOrder({ orderId: sheet.order._id, payload: { reviewNote: reviewNote.trim() } }).unwrap();
        toast(`${sheet.order.orderNumber} rejected`);
      }
      setRevealedOrderId(null);
      return true;
    } catch (err) {
      const wasConflict = await handleTransitionError(err, {
        invalidateList: () => ordersQuery.refetch(),
        showToast: (t) => toast(t.message, { duration: 4000 }),
      });
      if (wasConflict) {
        setRevealedOrderId(null);
        setSheet(null);
      } else {
        setSheetError(getQueryErrorMessage(err, GENERIC_ACTION_ERROR));
      }
      return false;
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
          trailing={<SoundMuteToggle />}
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
                onVerify={openSheet}
                onReject={openSheet}
                isArrived={arrivedIds.has(order._id)}
              />
            ))}
          </div>
        )}
      </SkeletonSwap>

      <TransitionConfirmSheet
        open={Boolean(sheet)}
        order={sheet?.order}
        action={sheet?.action}
        target={sheet?.target}
        busy={busy}
        error={sheetError}
        onClose={closeSheet}
        onConfirm={handleConfirm}
      >
        <TransitionNoteField action={sheet?.action} value={reviewNote} onChange={setReviewNote} disabled={busy} />
      </TransitionConfirmSheet>
      <TransitionConfirmSheetStyles />
      <OrderFlowRailStyles />
      <OwnerChipStyles />
      <ArrivalStyles />
    </div>
  );
}

// Same field/copy as the desktop detail page's TransitionNoteField
// (AdminOrderDetailPage.jsx) - kept as its own local copy rather than a
// cross-import between two "page" modules, matching this codebase's
// per-portal-duplication convention.
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
        className="dealer-m-newsale-textarea"
      />
    </label>
  );
}
