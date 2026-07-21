import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useGetDispatcherReplenishmentOrderQuery,
  useGetDispatcherReplenishmentOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../../dealer/pricing.js";
import {
  DISPLAY_BUCKET_META,
  ORDER_STATUS_META,
  formatPaymentMethod,
  formatShortDateTime,
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
} from "../../dealer/orderDetailLogic.js";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { StatusRail } from "../../dealer/mobile/StatusRail.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";

// Mirrors src/dealer/mobile/DealerOrdersMobileView.jsx's filter/month-group
// list, minus the swipe-to-reorder gesture (the desktop dispatcher history
// page has no reorder shortcut either - see DispatcherOrderHistoryPage.jsx).
// There's no routed order-detail page for a dispatcher's own replenishment
// orders (see that same file's ReplenishmentOrderModal comment), so instead
// of a route param this pushes an inline detail screen via local state -
// same "no new route nobody asked for" reasoning, just a mobile push instead
// of a desktop modal.
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STAGGER_CARD_CAP = 8;
const STAGGER_WINDOW_MS = 8 * 40 + 300;

const STAGE_HEADLINE = {
  SUBMITTED: "Order placed",
  VERIFIED: "Verified — being prepared",
  DISPATCHED: "On its way",
  COMPLETED: "Delivered",
};

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

function milestoneDateFor(order, status) {
  switch (status) {
    case "SUBMITTED":
      return order?.createdAt;
    case "VERIFIED":
      return order?.review?.reviewedAt || order?.factory?.sentToFactoryAt;
    case "DISPATCHED":
      return order?.factory?.outForDeliveryAt;
    case "COMPLETED":
      return order?.factory?.deliveredAt;
    default:
      return null;
  }
}

function OrderCard({ order, isLive, image, itemCount, bucket, stagger, animationDelay, onNavigate }) {
  return (
    <button
      type="button"
      className={`dealer-m-orders-card ${isLive ? "live" : ""} ${stagger ? "dealer-m-orders-card-stagger" : ""}`}
      style={stagger ? { animationDelay } : undefined}
      onClick={onNavigate}
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
        <span className="dealer-m-orders-card-total">{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
        <span className="dealer-m-orders-card-status-row">
          <StatusChip tone={DISPLAY_BUCKET_META[bucket]?.pillTone}>{DISPLAY_BUCKET_META[bucket]?.pillLabel}</StatusChip>
          <DashboardIcon name="chevron" size={16} strokeWidth={2} className="dealer-m-orders-card-chevron" />
        </span>
      </span>
    </button>
  );
}

// Mirrors src/dealer/mobile/DealerOrderDetailMobileView.jsx, minus the
// reorder action (buildReorderDraft() keys by sku - dispatcher's draft is
// keyed by productId, see dispatcherOrderPricing.js - and the desktop
// dispatcher history page has no reorder shortcut to mirror anyway) and the
// invoice-PDF affordance (not offered for replenishment orders on desktop
// either).
function DispatcherOrderDetailView({ orderId, onBack, productsMap, familyMap }) {
  const orderQuery = useGetDispatcherReplenishmentOrderQuery(orderId, { skip: !orderId });
  const order = orderQuery.data?.item;
  const loading = orderQuery.isLoading && !order;
  const loadError = orderQuery.error ? getQueryErrorMessage(orderQuery.error, "This order could not be found.") : "";

  if (!loading && (loadError || !order)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Order" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This order could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  const status = order ? normalizeStatus(order.status) : null;
  const bucket = order ? orderDisplayBucket(status) : null;
  const isOffRamp = status === "REJECTED" || status === "CANCELLED";
  const stageDate = order ? milestoneDateFor(order, status) : null;

  const familyGroups = order
    ? (() => {
        const map = new Map();
        for (const item of order.items || []) {
          const key = item.code || item.sku;
          if (!map.has(key)) map.set(key, { code: key, name: item.name, lines: [] });
          map.get(key).lines.push(item);
        }
        return Array.from(map.values());
      })()
    : [];

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Order" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 200, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        {order ? (
          <>
            <MobilePushHeader title={order.orderNumber || "Order"} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className={`dealer-m-order-hero-headline ${isOffRamp ? "off-ramp" : ""}`}>
                {isOffRamp ? DISPLAY_BUCKET_META[bucket]?.stateLabel : STAGE_HEADLINE[status] || DISPLAY_BUCKET_META[bucket]?.stateLabel}
              </div>
              <div className="dealer-m-order-hero-sub">
                {isOffRamp
                  ? order?.review?.rejectionReason || order?.review?.notes || "Contact Meitu for details."
                  : stageDate
                    ? formatShortDateTime(stageDate)
                    : null}
              </div>
            </div>

            {!isOffRamp ? (
              <div className="dealer-m-order-card">
                <StatusRail order={order} size="lg" />
              </div>
            ) : null}

            {order?.payment?.method ? (
              <div className="dealer-m-order-chip-row">
                <span className="dealer-m-order-chip">{formatPaymentMethod(order.payment.method)}</span>
              </div>
            ) : null}

            <div className="dealer-m-order-items-card">
              <div className="dealer-m-order-items-title">Items</div>
              {familyGroups.map((group) => {
                const image = resolveOrderItemImage(group.lines[0], productsMap, familyMap);
                return (
                  <div className="dealer-m-order-item-group" key={group.code}>
                    <div className="dealer-m-cart-card-head">
                      <span className="dealer-m-cart-card-thumb">
                        {image?.url ? <img src={image.url} alt="" /> : <DashboardIcon name="package" size={18} strokeWidth={1.6} />}
                      </span>
                      <span className="dealer-m-cart-card-name">{group.name}</span>
                    </div>
                    {group.lines.map((item, index) => (
                      <div className="dealer-m-cart-line" key={`${item.sku}-${index}`}>
                        <div className="dealer-m-cart-line-info">
                          <div className="dealer-m-cart-line-label">
                            {item.packLabel} &times; {item.quantity}
                          </div>
                          <div className="dealer-m-cart-line-rate">{formatMoney(item.unitPrice, order?.totals?.currency)}/pack</div>
                        </div>
                        <div className="dealer-m-cart-line-total">{formatMoney(item.lineTotal, order?.totals?.currency)}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="dealer-m-order-items-total">
                <span>Total</span>
                <span>{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
              </div>
            </div>
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}

export function DispatcherOrdersMobileView() {
  const [filter, setFilter] = useState("ALL");
  const [staggerActive, setStaggerActive] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  // status:"ALL" is required here - the backend's default (no status
  // passed) only returns the pending bucket, but this view buckets and
  // filters across every status (Active/Completed/Cancelled) client-side,
  // so it needs the full, unfiltered dataset to filter from.
  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery({ limit: 100, status: "ALL" });
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

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

  if (selectedOrderId) {
    return (
      <DispatcherOrderDetailView
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
        productsMap={productsMap}
        familyMap={familyMap}
      />
    );
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
            <Link to="/dispatcher/catalog" className="dealer-m-empty-action">
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
                    <OrderCard
                      key={order._id}
                      order={order}
                      isLive={isLive}
                      image={image}
                      itemCount={itemCount}
                      bucket={bucket}
                      stagger={stagger}
                      animationDelay={`${idx * 40}ms`}
                      onNavigate={() => setSelectedOrderId(order._id)}
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
