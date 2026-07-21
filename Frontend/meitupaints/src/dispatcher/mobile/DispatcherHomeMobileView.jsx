import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import {
  useGetDispatcherReplenishmentOrdersQuery,
  useGetMyDispatcherStockQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { useCountUp } from "../../dealer/mobile/useCountUp.js";
import { useDispatcherOrderDraft } from "./useDispatcherOrderDraft.js";

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function money(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `NPR ${(amount / 100000).toFixed(1)}L`;
  return `NPR ${amount.toLocaleString()}`;
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

// Mirrors src/dealer/DealerHomePage.jsx's structure (greeting, live-status
// card, continue/browse card, quick actions, month stats) - no sparkline,
// since a dispatcher's replenishment cadence is far lower-volume than a
// dealer's daily order flow and a 7-day spend chart would mostly read empty.
export function DispatcherHomeMobileView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dispatcherName = user?.name || user?.username || (user?.email ? String(user.email).split("@")[0] : "there");

  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery({ limit: 100 });
  const stockQuery = useGetMyDispatcherStockQuery({ limit: 200 });
  const draft = useDispatcherOrderDraft();

  const orders = useMemo(() => {
    const items = ordersQuery.data?.items || [];
    return items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [ordersQuery.data]);

  const pendingOrder = orders.find((order) => order.status === "SUBMITTED") || null;

  const monthStats = useMemo(() => {
    const now = new Date();
    const thisMonthOrders = orders.filter((order) => {
      const d = new Date(order.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const spend = thisMonthOrders.reduce((sum, order) => sum + Number(order?.totals?.total || 0), 0);
    return { count: thisMonthOrders.length, spend };
  }, [orders]);

  const stockItems = stockQuery.data?.items || [];
  const hasDraft = draft.itemCount > 0;

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
        <LargeTitleHeader title={`${greetingPrefix()}, ${dispatcherName}`} eyebrow={todayLabel()} size="medium" />

        {pendingOrder ? (
          <button
            type="button"
            className="dealer-m-home-card dealer-m-home-live-card dealer-m-home-stagger"
            style={{ animationDelay: "0ms" }}
            onClick={() => navigate("/dispatcher/orders")}
          >
            <div className="dealer-m-home-live-top">
              <span className="dealer-m-home-live-number">{pendingOrder.orderNumber}</span>
              <span className="dealer-m-home-live-stage">Awaiting factory verification</span>
            </div>
          </button>
        ) : null}

        {hasDraft ? (
          <div className="dealer-m-home-card dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
            <div className="dealer-m-home-reorder-head">
              <div className="dealer-m-home-card-label">Continue your order</div>
              <div className="dealer-m-home-card-total">{money(draft.subtotal)}</div>
            </div>
            <PrimaryButton onClick={() => navigate("/dispatcher/cart")} style={{ marginTop: 14 }}>
              Continue &mdash; {money(draft.subtotal)}
            </PrimaryButton>
          </div>
        ) : (
          <div className="dealer-m-home-card dealer-m-home-stagger" style={{ animationDelay: "50ms" }}>
            <div className="dealer-m-home-card-label">Get started</div>
            <div className="dealer-m-home-firstrun-title">Order stock from the factory</div>
            <PrimaryButton onClick={() => navigate("/dispatcher/catalog")} style={{ marginTop: 14 }}>
              Browse catalog
            </PrimaryButton>
          </div>
        )}

        <div className="dealer-m-home-quick-row dealer-m-home-stagger" style={{ animationDelay: "100ms" }}>
          <button type="button" className="dealer-m-home-quick-card" onClick={() => navigate("/dispatcher/catalog")}>
            <span className="dealer-m-home-quick-icon">
              <DashboardIcon name="overview" size={26} strokeWidth={1.6} />
            </span>
            <span className="dealer-m-home-quick-label">Browse catalog</span>
          </button>
          <button type="button" className="dealer-m-home-quick-card" onClick={() => navigate("/dispatcher/inventory")}>
            <span className="dealer-m-home-quick-icon">
              <DashboardIcon name="package" size={26} strokeWidth={1.6} />
            </span>
            <span className="dealer-m-home-quick-label">My inventory</span>
          </button>
        </div>

        <div className="dealer-m-home-card dealer-m-home-stats dealer-m-home-stagger" style={{ animationDelay: "150ms" }}>
          <div className="dealer-m-home-stats-row">
            <HomeStat value={monthStats.count} label="Orders" />
            <HomeStat value={monthStats.spend} label="Spend" format={money} />
            <HomeStat value={stockItems.length} label="Stock Items" />
          </div>
        </div>
      </SkeletonSwap>
    </div>
  );
}
