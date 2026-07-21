import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  useGetDispatcherReplenishmentOrdersQuery,
  useGetMyDispatcherStockQuery,
} from "../redux/api/meituApi.js";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  MetricTile,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../components/dashboard/DashboardUI.jsx";
import { loadDraft } from "./dashboard/order/dispatcherOrderDraftStorage.js";
import { useIsMobileDispatcher } from "./mobile/useIsMobileDispatcher.js";
import { DispatcherHomeMobileView } from "./mobile/DispatcherHomeMobileView.jsx";

function QuickLinkCard({ icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,.06)",
        background: "#fff",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "rgba(0,113,227,.08)",
          color: "var(--color-azure, #0071e3)",
        }}
      >
        <DashboardIcon name={icon} size={18} strokeWidth={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
          {title}
        </span>
        <span style={{ display: "block", marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export default function DispatcherHomePage() {
  const isMobile = useIsMobileDispatcher();
  return isMobile ? <DispatcherHomeMobileView /> : <DispatcherHomeDesktopView />;
}

function DispatcherHomeDesktopView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dispatcherName = user?.name || user?.username || (user?.email ? String(user.email).split("@")[0] : "Dispatcher");

  const stockQuery = useGetMyDispatcherStockQuery({ limit: 200 });
  const ordersQuery = useGetDispatcherReplenishmentOrdersQuery({ limit: 5 });

  const cartItemCount = useMemo(() => Object.keys(loadDraft()).length, []);

  const stockItems = stockQuery.data?.items || [];
  const lowStockCount = stockItems.filter((row) => {
    const threshold = Number(row?.product?.stock?.lowStockThreshold || 0);
    return threshold > 0 && Number(row?.currentQuantity || 0) <= threshold;
  }).length;

  const recentOrders = ordersQuery.data?.items || [];
  const pendingOrders = recentOrders.filter((order) => order.status === "SUBMITTED").length;

  const loading = stockQuery.isLoading || ordersQuery.isLoading;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          title={`Welcome, ${dispatcherName}`}
          subtitle="Order and track your own replenishment stock from the factory."
        />

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <MetricTile
            icon="package"
            label="Stock Items"
            value={loading ? "…" : stockItems.length}
            helper="Tracked products"
          />
          <MetricTile
            icon="cart"
            label="In Your Cart"
            value={cartItemCount}
            helper="Draft replenishment order"
            tone={cartItemCount ? "accent" : "neutral"}
          />
          <MetricTile
            icon="history"
            label="Pending Orders"
            value={loading ? "…" : pendingOrders}
            helper="Awaiting factory verification"
          />
          <MetricTile
            icon="bell"
            label="Low Stock"
            value={loading ? "…" : lowStockCount}
            helper="At or below threshold"
          />
        </div>
      </Surface>

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Quick Actions"
          subtitle="Jump straight into ordering or checking your stock."
        />
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <QuickLinkCard
            icon="package"
            title="Browse Catalog"
            subtitle="Order more stock from the factory"
            onClick={() => navigate("/dispatcher/catalog")}
          />
          <QuickLinkCard
            icon="cart"
            title="Review Cart"
            subtitle={cartItemCount ? `${cartItemCount} item${cartItemCount === 1 ? "" : "s"} waiting` : "Your cart is empty"}
            onClick={() => navigate("/dispatcher/cart")}
          />
          <QuickLinkCard
            icon="history"
            title="Order History"
            subtitle="Track your factory replenishment orders"
            onClick={() => navigate("/dispatcher/orders")}
          />
          <QuickLinkCard
            icon="stock"
            title="Inventory"
            subtitle="Your regional warehouse quantities"
            onClick={() => navigate("/dispatcher/inventory")}
          />
        </div>
      </Surface>

      {recentOrders.length > 0 ? (
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader
            icon="history"
            title="Recent Orders"
            subtitle="Your last few replenishment orders."
            action={<GhostButton icon="chevron" onClick={() => navigate("/dispatcher/orders")}>View all</GhostButton>}
          />
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {recentOrders.slice(0, 5).map((order) => (
              <div
                key={order._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 4px",
                  borderTop: "1px solid rgba(0,0,0,.06)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
                    {order.orderNumber}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    {order.status}
                  </div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
                  {order?.totals?.currency || "NPR"} {Number(order?.totals?.total || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}

      {!loading && recentOrders.length === 0 ? (
        <Surface padding={22} style={{ textAlign: "center" }} className="dash-fade-up">
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            No replenishment orders yet
          </div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Browse the catalog to place your first order from the factory.
          </div>
          <div style={{ marginTop: 16 }}>
            <PrimaryButton icon="package" onClick={() => navigate("/dispatcher/catalog")}>
              Browse Catalog
            </PrimaryButton>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
