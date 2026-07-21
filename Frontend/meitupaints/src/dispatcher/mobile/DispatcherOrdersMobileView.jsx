import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
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
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
} from "../../dealer/orderDetailLogic.js";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";

// Mirrors src/dealer/mobile/DealerOrdersMobileView.jsx's filter/month-group
// list, minus the swipe-to-reorder gesture (the desktop dispatcher history
// page has no reorder shortcut either - see DispatcherOrderHistoryPage.jsx).
// Detail is now a real routed page (/dispatcher/orders/:orderId, rendered
// via DispatcherOwnOrderDetailPage.jsx -> DispatcherOwnOrderDetailMobileView
// on this viewport) - same navigate() pattern DealerOrdersMobileView.jsx
// already uses, replacing the old inline local-state push panel.
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STAGGER_CARD_CAP = 8;
const STAGGER_WINDOW_MS = 8 * 40 + 300;

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

export function DispatcherOrdersMobileView() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("ALL");
  const [staggerActive, setStaggerActive] = useState(true);
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
                      onNavigate={() => navigate(`/dispatcher/orders/${order._id}`)}
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
