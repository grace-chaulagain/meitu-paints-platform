import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useGetDealerOrdersQuery, useGetProductFamiliesQuery } from "../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../redux/api/selectors.js";
import { formatMoney } from "./pricing.js";
import { ORDER_STATUS_META, buildOrderMilestones, resolveOrderItemImage } from "./orderDetailLogic.js";
import { useOrderDraft } from "./mobile/useOrderDraft.js";
import { StatusChip } from "./mobile/StatusChip.jsx";
import { StatusRail } from "./mobile/StatusRail.jsx";
import { PrimaryButton } from "./mobile/PrimaryButton.jsx";
import { LargeTitleHeader } from "./mobile/LargeTitleHeader.jsx";
import { useCountUp } from "./mobile/useCountUp.js";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { SkeletonSwap } from "./mobile/SkeletonSwap.jsx";

const RAIL_STAGE_COPY = {
  SUBMITTED: "Submitted — awaiting review",
  VERIFIED: "Being verified",
  DISPATCHED: "On its way",
};

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

// Home-stats-only lakh compression (spec §5: "may compress on Home stats
// only... never compress in cart/checkout/detail") - deliberately not in
// pricing.js, which stays the plain, uncompressed source of truth.
function formatMoneyCompact(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `NPR ${(amount / 100000).toFixed(1)}L`;
  return formatMoney(amount);
}

// Home-only display sugar for the Live Activity card's "Verified 2h ago"
// line (spec §2.2) - same rationale as formatMoneyCompact above, not a
// general-purpose formatter shared with the detail/history views.
function relativeTimeAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Last 7 calendar days' spend (spec §2.3 sparkline), oldest first so the
// last bar is always "today".
function last7DaysSpend(orders) {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ key: d.getTime(), total: 0 });
  }
  orders.forEach((order) => {
    const d = new Date(order.createdAt);
    d.setHours(0, 0, 0, 0);
    const match = days.find((day) => day.key === d.getTime());
    if (match) match.total += Number(order?.totals?.total || 0);
  });
  return days;
}

function HomeStat({ value, label, format }) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : Math.round(animated).toLocaleString();
  return (
    <div className="dealer-m-home-stat">
      <div className="dealer-m-home-stat-value">{display}</div>
      <div className="dealer-m-home-stat-label">{label}</div>
    </div>
  );
}

export default function DealerHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dealerProfile = useSelector((state) => state?.user?.dealerProfile || null);
  const contactName = dealerProfile?.contactName || user?.email || user?.username || "there";

  const ordersQuery = useGetDealerOrdersQuery({ limit: 100 });
  const familiesQuery = useGetProductFamiliesQuery();
  const draft = useOrderDraft();

  const orders = useMemo(() => {
    const items = ordersQuery.data?.items || [];
    return items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [ordersQuery.data]);

  const familyMap = useMemo(() => {
    const items = familiesQuery.data || [];
    return items.reduce((acc, family) => {
      acc[family.code] = family;
      return acc;
    }, {});
  }, [familiesQuery.data]);

  const liveOrders = useMemo(() => orders.filter((order) => ORDER_STATUS_META[order.status]?.live), [orders]);
  const primaryLiveOrder = liveOrders[0] || null;
  const lastOrder = orders[0] || null;

  const currentMilestone = useMemo(() => {
    if (!primaryLiveOrder) return null;
    const milestones = buildOrderMilestones(primaryLiveOrder);
    return milestones?.find((m) => m.state === "current") || null;
  }, [primaryLiveOrder]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const thisMonthOrders = orders.filter((order) => {
      const d = new Date(order.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const spend = thisMonthOrders.reduce((sum, order) => sum + Number(order?.totals?.total || 0), 0);
    const inTransit = orders.filter((order) => order.status === "DISPATCHED").length;
    return { count: thisMonthOrders.length, spend, inTransit };
  }, [orders]);

  const sparkline = useMemo(() => last7DaysSpend(orders), [orders]);
  const sparklineMax = Math.max(1, ...sparkline.map((d) => d.total));

  const hasDraft = draft.itemCount > 0;
  // "Continue your order" (an active draft) always takes priority over
  // "Order again" (the last completed order) - the draft is what the
  // dealer is actively building right now.
  const reorderSource = hasDraft
    ? { label: "Continue your order", items: draft.cart, total: draft.subtotal, isPastOrder: false }
    : lastOrder
      ? { label: "Order again", items: lastOrder.items || [], total: Number(lastOrder?.totals?.total || 0), isPastOrder: true }
      : null;

  function handleReorder() {
    if (!reorderSource) return;
    if (!reorderSource.isPastOrder) {
      navigate("/dealer/cart");
      return;
    }
    const nextDraft = {};
    (lastOrder.items || []).forEach((item) => {
      if (item.sku) nextDraft[item.sku] = Number(item.quantity || 0);
    });
    draft.setDraft(nextDraft);
    navigate("/dealer/cart");
  }

  const thumbItems = (reorderSource?.items || []).slice(0, 4);
  const thumbOverflow = Math.max(0, (reorderSource?.items || []).length - 4);

  const loading = ordersQuery.isLoading && orders.length === 0;
  const loadError = ordersQuery.error ? getQueryErrorMessage(ordersQuery.error, "Couldn't load your dashboard.") : "";

  if (loadError) {
    return (
      <div className="dealer-m-home">
        <div className="dealer-m-home-error-card">
          <div className="dealer-m-home-error-title">Couldn&apos;t load your dashboard</div>
          <button type="button" className="dealer-m-home-error-retry" onClick={() => ordersQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-home">
      {ordersQuery.isFetching ? <div className="dealer-m-refetch-hairline" /> : null}

      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-home-skeleton-line" style={{ width: "70%", height: 28 }} />
            <div className="dealer-m-home-skeleton-line" style={{ width: "40%", height: 14, marginTop: 8 }} />
            <div className="dealer-m-home-skeleton-card" />
            <div className="dealer-m-home-skeleton-card" />
          </>
        }
      >
      <LargeTitleHeader title={`${greetingPrefix()}, ${contactName}`} eyebrow={todayLabel()} size="medium" />

      {primaryLiveOrder ? (
        <button
          type="button"
          className="dealer-m-home-card dealer-m-home-live-card dealer-m-home-stagger"
          style={{ animationDelay: "0ms" }}
          onClick={() => navigate(`/dealer/orders/${primaryLiveOrder._id}`)}
        >
          <div className="dealer-m-home-live-top">
            <span className="dealer-m-home-live-number">{primaryLiveOrder.orderNumber}</span>
            <StatusChip inverted>{ORDER_STATUS_META[primaryLiveOrder.status]?.label}</StatusChip>
          </div>
          <StatusRail order={primaryLiveOrder} size="sm" />
          <div className="dealer-m-home-live-stage">
            {RAIL_STAGE_COPY[primaryLiveOrder.status] || ORDER_STATUS_META[primaryLiveOrder.status]?.label}
          </div>
          {currentMilestone?.date ? (
            <div className="dealer-m-home-live-timestamp">
              {currentMilestone.label} {relativeTimeAgo(currentMilestone.date)}
            </div>
          ) : null}
          {liveOrders.length > 1 ? (
            <div className="dealer-m-home-live-more">
              {liveOrders.length - 1} more active order{liveOrders.length - 1 === 1 ? "" : "s"} &rarr;
            </div>
          ) : null}
        </button>
      ) : null}

      {reorderSource ? (
        <div className="dealer-m-home-card dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
          <div className="dealer-m-home-reorder-head">
            <div className="dealer-m-home-card-label">{reorderSource.label}</div>
            <div className="dealer-m-home-card-total">{formatMoney(reorderSource.total)}</div>
          </div>
          <div className="dealer-m-home-thumbs">
            {thumbItems.map((item, index) => {
              const image = reorderSource.isPastOrder
                ? resolveOrderItemImage(item, draft.productsMap, familyMap)
                : getPrimaryImage(draft.productsMap?.[item.sku]?.images);
              return (
                <span className="dealer-m-home-thumb" key={item.sku || index} style={{ zIndex: thumbItems.length - index }}>
                  {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={20} strokeWidth={1.6} />}
                </span>
              );
            })}
            {thumbOverflow > 0 ? (
              <span className="dealer-m-home-thumb-overflow" style={{ zIndex: 100 }}>
                +{thumbOverflow}
              </span>
            ) : null}
          </div>
          <PrimaryButton onClick={handleReorder} style={{ marginTop: 14 }}>
            {reorderSource.isPastOrder ? `Reorder — ${formatMoney(reorderSource.total)}` : `Continue — ${formatMoney(reorderSource.total)}`}
          </PrimaryButton>
        </div>
      ) : (
        <div className="dealer-m-home-card dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
          <div className="dealer-m-home-card-label">Get started</div>
          <div className="dealer-m-home-firstrun-title">Start your first order</div>
          <PrimaryButton onClick={() => navigate("/dealer/catalog")} style={{ marginTop: 14 }}>
            Browse products
          </PrimaryButton>
        </div>
      )}

      <div className="dealer-m-home-quick-row dealer-m-home-stagger" style={{ animationDelay: "100ms" }}>
        <button type="button" className="dealer-m-home-quick-card" onClick={() => navigate("/dealer/catalog")}>
          <span className="dealer-m-home-quick-icon">
            <DashboardIcon name="overview" size={26} strokeWidth={1.6} />
          </span>
          <span className="dealer-m-home-quick-label">Browse products</span>
        </button>
        <button type="button" className="dealer-m-home-quick-card" onClick={() => navigate("/dealer/inventory")}>
          <span className="dealer-m-home-quick-icon">
            <DashboardIcon name="package" size={26} strokeWidth={1.6} />
          </span>
          <span className="dealer-m-home-quick-label">My inventory</span>
        </button>
      </div>

      <div className="dealer-m-home-card dealer-m-home-stats dealer-m-home-stagger" style={{ animationDelay: "150ms" }}>
        <div className="dealer-m-home-stats-row">
          <HomeStat value={monthStats.count} label="Orders" />
          <HomeStat value={monthStats.spend} label="Spend" format={formatMoneyCompact} />
          <HomeStat value={monthStats.inTransit} label="In transit" />
        </div>
        {monthStats.count >= 2 ? (
          <div className="dealer-m-home-sparkline">
            {sparkline.map((day, index) => (
              <span
                key={day.key}
                className={`dealer-m-home-sparkline-bar ${index === sparkline.length - 1 ? "today" : ""}`}
                style={{ height: Math.max(2, (day.total / sparklineMax) * 24) }}
              />
            ))}
          </div>
        ) : null}
      </div>
      </SkeletonSwap>
    </div>
  );
}
