import { useMemo } from "react";
import {
  useGetAllStockHistoryQuery,
  useGetFactoryDashboardQuery,
  useGetFactoryOrdersQuery,
  useGetNotificationsQuery,
  useGetStockQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  EmptyState,
  GhostButton,
  ListRow,
  MetricTile,
  Pill,
  SectionHeader,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import {
  compactDate,
  makeActivity,
  statusTone,
  timeAgo,
  titleCaseLabel,
  todayKey,
} from "../factoryHelpers.js";

export default function FactoryOverviewPage({ onNavigate }) {
  const dashboard = useGetFactoryDashboardQuery();
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", limit: 20 });
  const historyQuery = useGetAllStockHistoryQuery({ limit: 20, onlyMovements: "true" });
  const lowStockQuery = useGetStockQuery({ status: "LOW_STOCK", limit: 6 });
  const notificationsQuery = useGetNotificationsQuery({ days: 14, limit: 5 });

  const orders = useMemo(() => ordersQuery.data?.items || [], [ordersQuery.data]);
  const history = useMemo(() => historyQuery.data?.items || [], [historyQuery.data]);
  const lowStockItems = lowStockQuery.data?.items || [];
  const notifications = notificationsQuery.data || [];
  const summary = dashboard.data || {};

  const today = todayKey();
  const completedToday = orders.filter(
    (order) => order.status === "COMPLETED" && todayKey(order.factory?.deliveredAt || order.updatedAt) === today,
  ).length;

  const activity = useMemo(() => makeActivity({ orders, history }), [orders, history]);

  const refreshing =
    dashboard.isFetching || ordersQuery.isFetching || historyQuery.isFetching || lowStockQuery.isFetching;

  const loadError = dashboard.error ? getQueryErrorMessage(dashboard.error, "Failed to load the dashboard summary.") : "";

  const metrics = [
    { label: "Awaiting Dispatch", value: summary.orders?.awaitingShipment || 0, icon: "inbox", onClick: () => onNavigate("orders") },
    { label: "Dispatched", value: summary.orders?.dispatched || 0, icon: "truck", onClick: () => onNavigate("orders") },
    { label: "Low Stock", value: summary.stock?.lowStock || 0, icon: "warning", tone: summary.stock?.lowStock ? "accent" : "neutral", onClick: () => onNavigate("stock") },
    { label: "Out Of Stock", value: summary.stock?.outOfStock || 0, icon: "reject", onClick: () => onNavigate("stock") },
    { label: "Completed Today", value: completedToday || summary.orders?.completedRecent || 0, icon: "checkmark", onClick: () => onNavigate("orders") },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="overview"
          title="Factory Operations"
          subtitle="Live order, shipment, and inventory work queue for the Factory team."
          action={refreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />
        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {metrics.map((metric) => (
            <button
              key={metric.label}
              type="button"
              onClick={metric.onClick}
              style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}
            >
              <MetricTile label={metric.label} value={metric.value} icon={metric.icon} tone={metric.tone} />
            </button>
          ))}
        </div>
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
        <Surface padding={20} className="dash-fade-up">
          <SectionHeader
            size="small"
            title="Recent Orders"
            action={<GhostButton icon="chevron" onClick={() => onNavigate("orders")}>View Orders</GhostButton>}
          />
          <div style={{ marginTop: 14 }}>
            {orders.length === 0 ? (
              <EmptyState icon="orders" title="No recent orders" />
            ) : (
              <Surface padding={0}>
                {orders.slice(0, 6).map((order) => (
                  <ListRow key={order._id} onClick={() => onNavigate("orders")}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                        {order.dealerSnapshot?.companyName || "Dealer"}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                        {order.orderNumber || "Factory order"}
                      </div>
                    </div>
                    <Pill tone={statusTone(order.status)} size="small">{titleCaseLabel(order.status)}</Pill>
                  </ListRow>
                ))}
              </Surface>
            )}
          </div>
        </Surface>

        <Surface padding={20} className="dash-fade-up">
          <SectionHeader
            size="small"
            title="Low Stock Products"
            action={<GhostButton icon="chevron" onClick={() => onNavigate("stock")}>View Stock</GhostButton>}
          />
          <div style={{ marginTop: 14 }}>
            {lowStockItems.length === 0 ? (
              <EmptyState icon="stock" title="No low-stock products" />
            ) : (
              <Surface padding={0}>
                {lowStockItems.slice(0, 6).map((item) => (
                  <ListRow key={item._id || item.sku} onClick={() => onNavigate("stock")}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.name}</div>
                      <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku}</div>
                    </div>
                    <Pill tone="caution" size="small">{item.stock?.availableQuantity || 0} available</Pill>
                  </ListRow>
                ))}
              </Surface>
            )}
          </div>
        </Surface>

        <Surface padding={20} className="dash-fade-up">
          <SectionHeader size="small" title="Today's Activity" />
          <div style={{ marginTop: 14 }}>
            {activity.length === 0 ? (
              <EmptyState icon="history" title="No recent activity yet" />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {activity.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <DashboardIcon name="history" size={13} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)", marginTop: 3, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.title}</div>
                      <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                        {item.meta} · {compactDate(item.at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>

        <Surface padding={20} className="dash-fade-up">
          <SectionHeader
            size="small"
            title="Recent Notifications"
            action={<GhostButton icon="chevron" onClick={() => onNavigate("notifications")}>View All</GhostButton>}
          />
          <div style={{ marginTop: 14 }}>
            {notifications.length === 0 ? (
              <EmptyState icon="bell" title="No notifications" />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {notifications.slice(0, 5).map((item) => (
                  <div key={item._id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <DashboardIcon name="bell" size={13} strokeWidth={1.8} style={{ color: item.isRead ? "var(--color-graphite, #707070)" : "var(--color-azure, #0071e3)", marginTop: 3, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{item.title}</div>
                      <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                        {item.description} · {timeAgo(item.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
