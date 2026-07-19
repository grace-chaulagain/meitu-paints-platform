import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGetDealerOrdersQuery, useGetProductFamiliesQuery, useGetProductsQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../pricing.js";
import {
  DISPLAY_BUCKET_META,
  ORDER_STATUS_META,
  buildReorderDraft,
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
} from "../orderDetailLogic.js";
import { StatusChip } from "./StatusChip.jsx";
import { SegmentedControl } from "./SegmentedControl.jsx";
import { LargeTitleHeader } from "./LargeTitleHeader.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";
import { useSwipeAction } from "./useSwipeAction.js";
import { useOrderDraft } from "./useOrderDraft.js";

// Spec §4.6: Stripe's payment list - scannable, quiet, chronological. A
// deliberately simpler 4-way split than the desktop page's own filter set
// (which never actually surfaces a distinct "Cancelled" filter despite its
// bucket helper computing one) - Active/Cancelled are split out explicitly
// here since spec calls for exactly that.
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

// First screenful only, once per mount (spec §1.4/§3) - stagger must never
// replay on a filter switch, so this window is timed to outlast the whole
// 8-card sequence (last delay 280ms + 250ms card duration) and then the
// class is dropped for good.
const STAGGER_CARD_CAP = 8;
const STAGGER_WINDOW_MS = 8 * 40 + 300;
const REORDER_REVEAL_WIDTH = 96;

function filterBucket(status) {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "REJECTED" || status === "CANCELLED") return "CANCELLED";
  return "ACTIVE";
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function cardDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// V3 §5.6: swipe-left-to-reorder, consuming the useSwipeAction hook §4.1
// already built for the cart's swipe-to-remove rows (same reveal-then-tap
// shape, different action). A separate component because useSwipeAction is
// a hook and can't be called inside the parent's groupedByMonth.map()
// (Rules of Hooks). `revealedOrderId` is owned by the parent so opening
// one card's swipe closes any other; `swipe.wasDragged()` guards the
// card's own onClick so releasing a drag doesn't also fire a navigation.
function OrderCardSwipe({ order, isLive, image, itemCount, bucket, stagger, animationDelay, revealedOrderId, onReveal, onNavigate, onReorder }) {
  const swipe = useSwipeAction({
    axis: "x",
    onCommit: ({ passed }) => {
      onReveal(passed ? order._id : null);
      return passed ? -REORDER_REVEAL_WIDTH : 0;
    },
  });

  useEffect(() => {
    if (revealedOrderId !== order._id) swipe.setPos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedOrderId, order._id]);

  return (
    <div className="dealer-m-orders-card-wrap">
      <button type="button" className="dealer-m-orders-card-reorder-action" onClick={() => onReorder(order)}>
        <DashboardIcon name="refresh" size={16} strokeWidth={2} />
        Reorder
      </button>
      <button
        type="button"
        ref={swipe.ref}
        {...swipe.handlers}
        className={`dealer-m-orders-card ${isLive ? "live" : ""} ${stagger ? "dealer-m-orders-card-stagger" : ""}`}
        style={stagger ? { animationDelay } : undefined}
        onClick={() => {
          if (swipe.wasDragged()) return;
          onNavigate();
        }}
      >
        <span className="dealer-m-orders-card-thumb">
          {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={18} strokeWidth={1.6} />}
          {itemCount > 1 ? <span className="dealer-m-orders-card-badge">+{itemCount - 1}</span> : null}
        </span>
        <span className="dealer-m-orders-card-body">
          <span className="dealer-m-orders-card-number">{order.orderNumber}</span>
          <span className="dealer-m-orders-card-meta">
            {cardDateLabel(order.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </span>
        <span className="dealer-m-orders-card-right">
          <span className="dealer-m-orders-card-total">{formatMoney(order?.totals?.total)}</span>
          <span className="dealer-m-orders-card-status-row">
            <StatusChip tone={DISPLAY_BUCKET_META[bucket]?.pillTone}>{DISPLAY_BUCKET_META[bucket]?.pillLabel}</StatusChip>
            <DashboardIcon name="chevron" size={16} strokeWidth={2} className="dealer-m-orders-card-chevron" />
          </span>
        </span>
      </button>
    </div>
  );
}

export function DealerOrdersMobileView() {
  const navigate = useNavigate();
  const draft = useOrderDraft();
  const [filter, setFilter] = useState("ALL");
  const [staggerActive, setStaggerActive] = useState(true);
  const [revealedOrderId, setRevealedOrderId] = useState(null);
  const ordersQuery = useGetDealerOrdersQuery({ limit: 100 });
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  function handleReorder(order) {
    draft.setDraft(buildReorderDraft(order.items));
    navigate("/dealer/cart");
  }

  useEffect(() => {
    const timer = setTimeout(() => setStaggerActive(false), STAGGER_WINDOW_MS);
    return () => clearTimeout(timer);
  }, []);

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

  const orders = useMemo(() => {
    const items = (ordersQuery.data?.items || []).map((item) => ({ ...item, status: normalizeStatus(item.status) }));
    return items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [ordersQuery.data]);

  const counts = useMemo(() => {
    const result = { ALL: orders.length, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
    orders.forEach((order) => {
      result[filterBucket(order.status)] += 1;
    });
    return result;
  }, [orders]);

  const segmentOptions = useMemo(() => FILTERS.map((option) => ({ ...option, count: counts[option.key] })), [counts]);
  // V3 §5.7: quiet orientation once the large title has scrolled away -
  // which filter is active and how many orders it holds.
  const activeFilterOption = segmentOptions.find((option) => option.key === filter);

  const visibleOrders = useMemo(
    () => (filter === "ALL" ? orders : orders.filter((order) => filterBucket(order.status) === filter)),
    [orders, filter],
  );

  const groupedByMonth = useMemo(() => {
    const map = new Map();
    for (const order of visibleOrders) {
      const key = monthKey(order.createdAt);
      if (!map.has(key)) map.set(key, { key, label: monthLabel(order.createdAt), orders: [] });
      map.get(key).orders.push(order);
    }
    return Array.from(map.values());
  }, [visibleOrders]);

  const loading = ordersQuery.isLoading && orders.length === 0;
  const loadError = ordersQuery.error ? getQueryErrorMessage(ordersQuery.error, "Failed to load your order history.") : "";

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

  let cardIndex = -1;

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Orders</div>
            <div className="dealer-m-skel" style={{ height: 34, marginTop: 14, borderRadius: 999, width: "70%" }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader
          title="Orders"
          contextLabel={activeFilterOption ? `${activeFilterOption.label} · ${activeFilterOption.count}` : null}
        />

        <SegmentedControl options={segmentOptions} value={filter} onChange={setFilter} />

        {visibleOrders.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="orders" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No orders yet</div>
            <Link to="/dealer/catalog" className="dealer-m-empty-action">
              Browse products
            </Link>
          </div>
        ) : (
          groupedByMonth.map((group) => (
          <div key={group.key} className="dealer-m-orders-month">
            <div className="dealer-m-orders-month-label">{group.label}</div>
            <div className="dealer-m-orders-list">
              {group.orders.map((order) => {
                cardIndex += 1;
                const idx = cardIndex;
                const bucket = orderDisplayBucket(order.status);
                const isLive = ORDER_STATUS_META[order.status]?.live;
                const image = resolveOrderItemImage(order.items?.[0], productsMap, familyMap);
                const itemCount = order.items?.length || 0;
                const stagger = staggerActive && idx < STAGGER_CARD_CAP;
                return (
                  <OrderCardSwipe
                    key={order._id}
                    order={order}
                    isLive={isLive}
                    image={image}
                    itemCount={itemCount}
                    bucket={bucket}
                    stagger={stagger}
                    animationDelay={`${idx * 40}ms`}
                    revealedOrderId={revealedOrderId}
                    onReveal={setRevealedOrderId}
                    onNavigate={() => navigate(`/dealer/orders/${order._id}`)}
                    onReorder={handleReorder}
                  />
                );
              })}
            </div>
          </div>
        ))
        )}
      </SkeletonSwap>
    </div>
  );
}
