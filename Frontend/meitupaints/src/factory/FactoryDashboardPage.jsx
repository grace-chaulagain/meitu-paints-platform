import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { jsPDF } from "jspdf";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import DashboardIcon from "../components/dashboard/DashboardIcons.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  NOTIFICATION_CATEGORIES,
  useNotifications,
} from "../notifications/notificationContext.js";
import {
  useAmendFactoryOrderMutation,
  useBulkUpdateStockMutation,
  useGetAllStockHistoryQuery,
  useGetFactoryDashboardQuery,
  useGetFactoryOrdersQuery,
  useGetNotificationsQuery,
  useGetStockHistoryQuery,
  useGetStockQuery,
  useLazyGetProformaInvoiceQuery,
  useMarkFactoryOrderDeliveredMutation,
  useMarkFactoryOrderOutForDeliveryMutation,
  useRejectFactoryOrderMutation,
  useStartFactoryOrderPreparingMutation,
  useUpdateStockQuantityMutation,
  useUpdateStockThresholdMutation,
} from "../redux/api/meituApi.js";

const SECTIONS = {
  DASHBOARD: "dashboard",
  OVERVIEW: "overview",
  ORDERS: "orders",
  STOCK: "stock",
  INVOICES: "invoices",
  STOCK_HISTORY: "stock-history",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
  LOGOUT: "logout",
};

const ROUTES = {
  [SECTIONS.DASHBOARD]: "/factory/dashboard",
  [SECTIONS.OVERVIEW]: "/factory/dashboard/overview",
  [SECTIONS.ORDERS]: "/factory/dashboard/orders",
  [SECTIONS.STOCK]: "/factory/dashboard/stock",
  [SECTIONS.INVOICES]: "/factory/dashboard/invoices",
  [SECTIONS.STOCK_HISTORY]: "/factory/dashboard/stock-history",
  [SECTIONS.NOTIFICATIONS]: "/factory/dashboard/notifications",
  [SECTIONS.PROFILE]: "/factory/dashboard/profile",
};

const ORDER_LANES = [
  { key: "INBOX", label: "Inbox", icon: "orders" },
  { key: "PREPARING", label: "Preparing", icon: "play" },
  { key: "SHIPMENT", label: "Shipment", icon: "truck" },
  { key: "COMPLETED", label: "Completed", icon: "check" },
  { key: "REJECTED", label: "Rejected", icon: "reject" },
];

const STOCK_STATUS_OPTIONS = [
  { value: "ALL", label: "All stock" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "LOW_STOCK", label: "Low stock" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Sort by name" },
  { value: "stock-asc", label: "Lowest stock" },
  { value: "stock-desc", label: "Highest stock" },
  { value: "updated", label: "Recently updated" },
];

const STOCK_REASONS = [
  "Manual Count",
  "Stock Received",
  "Stock Correction",
  "Damage / Loss",
  "Return",
  "Adjustment",
  "Other",
];

function currency(value, code = "NPR") {
  return `${code} ${Number(value || 0).toLocaleString()}`;
}

function statusLabel(value = "") {
  return String(value || "UNKNOWN").replace(/_/g, " ");
}

function compactDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(value) {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function todayKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function sectionFromPath(pathname = "") {
  if (pathname === ROUTES[SECTIONS.DASHBOARD] || pathname === `${ROUTES[SECTIONS.DASHBOARD]}/`) {
    return SECTIONS.OVERVIEW;
  }
  if (pathname.startsWith(ROUTES[SECTIONS.ORDERS])) return SECTIONS.ORDERS;
  if (pathname.startsWith(ROUTES[SECTIONS.STOCK_HISTORY])) return SECTIONS.STOCK_HISTORY;
  if (pathname.startsWith(ROUTES[SECTIONS.STOCK])) return SECTIONS.STOCK;
  if (pathname.startsWith(ROUTES[SECTIONS.INVOICES])) return SECTIONS.INVOICES;
  if (pathname.startsWith(ROUTES[SECTIONS.NOTIFICATIONS])) return SECTIONS.NOTIFICATIONS;
  if (pathname.startsWith(ROUTES[SECTIONS.PROFILE])) return SECTIONS.PROFILE;
  return SECTIONS.OVERVIEW;
}

function laneForOrder(order) {
  const status = String(order?.status || "").toUpperCase();
  const stage = String(order?.factoryStage || "").toUpperCase();

  if (status === "REJECTED") return "REJECTED";
  if (["DELIVERED", "CLOSED", "CANCELLED"].includes(status)) return "COMPLETED";
  if (stage === "COMPLETED") return "COMPLETED";
  if (stage === "SHIPMENT" || status === "OUT_FOR_DELIVERY") return "SHIPMENT";
  if (stage === "PREPARING" || status === "PROCESSING") return "PREPARING";
  return "INBOX";
}

function orderMatchesLane(order, lane) {
  return laneForOrder(order) === lane;
}

function productCount(order) {
  return (order?.items || []).length;
}

function priorityForOrder(order) {
  const ageMs = Date.now() - new Date(order?.factory?.sentToFactoryAt || order?.updatedAt || order?.createdAt || Date.now()).getTime();
  const hours = ageMs / 36e5;
  if (hours >= 24) return "High";
  if (hours >= 8) return "Medium";
  return "Normal";
}

function orderStatus(order) {
  return String(order?.status || "").toUpperCase();
}

function isOrderAwaitingFactory(order) {
  return ["AWAITING_SHIPMENT", "VERIFIED"].includes(orderStatus(order));
}

function isOrderPreparing(order) {
  return orderStatus(order) === "PROCESSING";
}

function isOrderInShipment(order) {
  return orderStatus(order) === "OUT_FOR_DELIVERY";
}

function isOrderDone(order) {
  return ["DELIVERED", "REJECTED", "CLOSED", "CANCELLED"].includes(orderStatus(order));
}

function nextFactoryStep(order) {
  if (isOrderAwaitingFactory(order)) return "Start preparation";
  if (isOrderPreparing(order)) return "Generate invoice, assign driver, dispatch";
  if (isOrderInShipment(order)) return "Mark delivered after dealer handoff";
  if (orderStatus(order) === "DELIVERED") return "Delivery completed";
  if (orderStatus(order) === "REJECTED") return "Order rejected";
  return "Review order";
}

function reservationLabel(order) {
  const status = String(order?.stockReservation?.status || "NONE").toUpperCase();
  if (status === "RESERVED") return "Reserved";
  if (status === "CONSUMED") return "Deducted";
  if (status === "RELEASED") return "Released";
  return "Not reserved";
}

function stockCheckTone(status = "") {
  const normalized = String(status).toUpperCase();
  if (normalized === "AVAILABLE") return "success";
  if (normalized === "LOW") return "warning";
  if (["INSUFFICIENT", "OUT_OF_STOCK"].includes(normalized)) return "danger";
  return "neutral";
}

function makeActivity({ orders = [], history = [] }) {
  const orderEvents = orders.slice(0, 12).map((order) => ({
    id: `order-${order._id}`,
    at: order.updatedAt || order.createdAt,
    title: `Order ${order.orderNumber || ""} ${statusLabel(order.status).toLowerCase()}`,
    meta: order.dealerSnapshot?.companyName || "Dealer",
    type: "order",
  }));
  const stockEvents = history.slice(0, 12).map((row) => ({
    id: `stock-${row._id}`,
    at: row.changedAt,
    title: "Stock updated",
    meta: `${row.productName || row.sku || "Product"} ${Number(row.delta || 0) >= 0 ? "+" : ""}${row.delta || 0}`,
    type: "stock",
  }));
  return [...orderEvents, ...stockEvents]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);
}

function stockImageUrl(item) {
  return (
    item?.primaryImage?.url ||
    item?.image?.url ||
    item?.imageUrl ||
    item?.images?.find?.((image) => image?.isPrimary)?.url ||
    item?.images?.[0]?.url ||
    ""
  );
}

function IconText({ icon, children }) {
  return (
    <>
      <DashboardIcon name={icon} size={16} />
      <span>{children}</span>
    </>
  );
}

function downloadInvoicePdf(invoice) {
  if (!invoice) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const copies = invoice.copies || ["Factory Copy", "Driver Copy", "Dealer Copy"];
  const left = 42;
  const lineHeight = 17;

  copies.forEach((copy, copyIndex) => {
    if (copyIndex > 0) doc.addPage();
    let y = 46;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("MEITU PAINTS", left, y);
    doc.setFontSize(11);
    doc.text(copy, 430, y);
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.text("Proforma Invoice", left, y);
    y += 26;
    [
      `Order: ${invoice.orderNumber || "-"}`,
      `Date: ${compactDate(invoice.generatedAt)}`,
      `Dealer: ${invoice.dealer?.companyName || "-"}`,
      `Driver: ${invoice.driver?.name || "-"}`,
      `Vehicle: ${invoice.driver?.vehicleNumber || "-"}`,
    ].forEach((line) => {
      doc.text(line, left, y);
      y += lineHeight;
    });
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text("Items", left, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    (invoice.items || []).forEach((item, index) => {
      if (y > 710) {
        doc.addPage();
        y = 46;
      }
      const text = `${index + 1}. ${item.name || "-"} | ${item.sku || "-"} | ${item.packLabel || item.variantLabel || "-"} | Qty ${item.quantity || 0} | ${currency(item.lineTotal, invoice.totals?.currency)}`;
      doc.text(doc.splitTextToSize(text, 510), left, y);
      y += lineHeight * Math.max(1, Math.ceil(text.length / 78));
    });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: ${currency(invoice.totals?.total, invoice.totals?.currency)}`, left, y);
    y += 66;
    doc.setFont("helvetica", "normal");
    doc.text("Factory", left, y);
    doc.text("Driver", 250, y);
    doc.text("Dealer", 430, y);
  });

  doc.save(`proforma-${invoice.orderNumber || "factory-order"}.pdf`);
}

function Drawer({ title, eyebrow, children, onClose, wide = false }) {
  return (
    <div className="factory-drawer-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className={`factory-drawer ${wide ? "wide" : ""}`}>
        <div className="drawer-head">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close drawer">
            <DashboardIcon name="reject" size={17} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function MetricStrip({ items }) {
  return (
    <div className="metric-strip">
      {items.map((item) => (
        <button type="button" key={item.label} onClick={item.onClick}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search...",
}) {
  return (
    <form
      className="factory-search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <DashboardIcon name="search" size={20} className="factory-search-icon" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="factory-clear-search"
        >
          ×
        </button>
      ) : null}
    </form>
  );
}

function StatusTabs({ value, options, counts = {}, onChange }) {
  return (
    <div className="factory-tabs" role="tablist" aria-label="Factory status filters">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? "active" : ""}
            key={option.key}
            onClick={() => onChange(option.key)}
          >
            {option.icon ? <DashboardIcon name={option.icon} size={15} /> : null}
            <span>{option.label}</span>
            {typeof counts[option.key] === "number" ? (
              <strong>{counts[option.key]}</strong>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FactoryShell({ active, children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const notifications = useNotifications();
  const factoryOrderBadge = Number(
    notifications?.categories?.[NOTIFICATION_CATEGORIES.FACTORY_ORDER] || 0,
  );
  const navGroups = [
    {
      label: "Operations",
      items: [
        { key: SECTIONS.OVERVIEW, title: "Overview", subtitle: "Operational pulse", icon: "overview" },
        {
          key: SECTIONS.ORDERS,
          title: "Orders",
          subtitle: "Factory workflow",
          icon: "orders",
          badge: factoryOrderBadge > 0 ? factoryOrderBadge : "",
        },
        { key: SECTIONS.STOCK, title: "Stock", subtitle: "Inventory control", icon: "stock" },
        {
          key: SECTIONS.STOCK_HISTORY,
          title: "Stock History",
          subtitle: "Audit trail",
          icon: "history",
        },
        {
          key: SECTIONS.INVOICES,
          title: "Invoices",
          subtitle: "Proforma prints",
          icon: "invoice",
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          key: SECTIONS.NOTIFICATIONS,
          title: "Notifications",
          subtitle: "Alerts",
          icon: "bell",
          badge: notifications?.totalUnread ? notifications.totalUnread : "",
        },
        { key: SECTIONS.PROFILE, title: "Profile", subtitle: "Factory user", icon: "user" },
      ],
    },
    {
      label: "Session",
      items: [{ key: SECTIONS.LOGOUT, title: "Logout", subtitle: "End session", icon: "logout" }],
    },
  ];

  const handleNavigate = (item) => {
    if (item.key === SECTIONS.LOGOUT) {
      logout();
      return;
    }
    navigate(ROUTES[item.key] || ROUTES[SECTIONS.DASHBOARD]);
  };

  return (
    <>
      <DashboardShell
        eyebrow="Meitu Operations"
        title="Factory Dashboard"
        accountLabel={user?.email || user?.username || "Factory"}
        navGroups={navGroups}
        activeKey={active}
        onNavigate={handleNavigate}
        priorityLabel="Factory Rule"
        priorityText="Stock is deducted only when an order is marked out for delivery."
      >
        {children}
      </DashboardShell>
      <FactoryStyles />
    </>
  );
}

function OverviewPage({ globalSearch, onNavigate }) {
  const dashboard = useGetFactoryDashboardQuery();
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: globalSearch, limit: 20 });
  const historyQuery = useGetAllStockHistoryQuery({ q: globalSearch, limit: 20 });
  const lowStockQuery = useGetStockQuery({ status: "LOW_STOCK", limit: 8 });
  const orders = ordersQuery.data?.items || [];
  const history = historyQuery.data?.items || [];
  const lowStockItems = lowStockQuery.data?.items || [];
  const summary = dashboard.data || {};
  const today = todayKey();
  const deliveredToday = orders.filter(
    (order) =>
      order.status === "DELIVERED" &&
      todayKey(order.factory?.deliveredAt || order.updatedAt) === today,
  ).length;
  const activity = makeActivity({ orders, history });
  const refreshing =
    dashboard.isFetching ||
    ordersQuery.isFetching ||
    historyQuery.isFetching ||
    lowStockQuery.isFetching;

  const metrics = [
    {
      label: "Awaiting Shipment",
      value: summary.orders?.awaitingShipment || 0,
      onClick: () => onNavigate(SECTIONS.ORDERS),
    },
    {
      label: "Preparing",
      value: summary.orders?.preparing || 0,
      onClick: () => onNavigate(SECTIONS.ORDERS),
    },
    {
      label: "Out For Delivery",
      value: summary.orders?.outForDelivery || 0,
      onClick: () => onNavigate(SECTIONS.ORDERS),
    },
    {
      label: "Low Stock",
      value: summary.stock?.lowStock || 0,
      onClick: () => onNavigate(SECTIONS.STOCK),
    },
    {
      label: "Out Of Stock",
      value: summary.stock?.outOfStock || 0,
      onClick: () => onNavigate(SECTIONS.STOCK),
    },
    {
      label: "Delivered Today",
      value: deliveredToday || summary.orders?.deliveredToday || 0,
      onClick: () => onNavigate(SECTIONS.ORDERS),
    },
  ];

  return (
    <div className="factory-page">
      <div className="page-head">
        <div>
          <p>Overview</p>
          <h1>Factory operations</h1>
          <span>
            Live order, shipment, and inventory work queue for the Factory team.
          </span>
        </div>
        {refreshing ? <div className="updating-chip">Updating...</div> : null}
      </div>
      <MetricStrip items={metrics} />
      <div className="split-grid factory-overview-grid">
        <section className="plain-section">
          <div className="section-head">
            <h2>Recent Orders</h2>
            <button type="button" onClick={() => onNavigate(SECTIONS.ORDERS)}>
              View Orders
            </button>
          </div>
          <div className="mini-list">
            {orders.slice(0, 6).map((order) => (
              <button
                type="button"
                key={order._id}
                onClick={() => onNavigate(SECTIONS.ORDERS)}
              >
                <div>
                  <strong>{order.dealerSnapshot?.companyName || "Dealer"}</strong>
                  <span>{order.orderNumber || "Factory order"}</span>
                </div>
                <span className="status-pill">{statusLabel(order.status)}</span>
              </button>
            ))}
            {!orders.length ? <div className="empty-line">No recent orders.</div> : null}
          </div>
        </section>
        <section className="plain-section">
          <div className="section-head">
            <h2>Low Stock Products</h2>
            <button type="button" onClick={() => onNavigate(SECTIONS.STOCK)}>
              View Stock
            </button>
          </div>
          <div className="mini-list warning">
            {lowStockItems.slice(0, 6).map((item) => (
              <button
                type="button"
                key={item._id || item.sku}
                onClick={() => onNavigate(SECTIONS.STOCK)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.sku}</span>
                </div>
                <span>{item.stock?.availableQuantity || 0} available</span>
              </button>
            ))}
            {!lowStockItems.length ? (
              <div className="empty-line">No low-stock products.</div>
            ) : null}
          </div>
        </section>
        <section className="plain-section">
          <div className="section-head">
            <h2>Today's Activity Timeline</h2>
          </div>
          {activity.length ? (
            <div className="timeline-list">
              {activity.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <time>{compactDate(item.at).split(",").pop()?.trim()}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-line">No recent activity yet.</div>
          )}
        </section>
        <section className="plain-section">
          <div className="section-head">
            <h2>Recent Notifications</h2>
            <button type="button" onClick={() => onNavigate(SECTIONS.NOTIFICATIONS)}>
              View All
            </button>
          </div>
          <div className="notification-list compact">
            {activity.slice(0, 5).map((item) => (
              <div key={`note-${item.id}`} className="notification-row">
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            ))}
            {!activity.length ? <div className="empty-line">No notifications.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderDrawer({ order, onClose, onInvoice, onOrderChange }) {
  const [driverName, setDriverName] = useState(order?.factory?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(order?.factory?.driverPhone || "");
  const [vehicleNumber, setVehicleNumber] = useState(order?.factory?.vehicleNumber || "");
  const [remarks, setRemarks] = useState(order?.factory?.remarks || "");
  const [rejectReason, setRejectReason] = useState("");
  const [amendReason, setAmendReason] = useState("");
  const [amendNote, setAmendNote] = useState("");
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState({
    stock: false,
    packing: false,
    invoice: false,
    quality: false,
  });
  const [startPreparing, preparingState] = useStartFactoryOrderPreparingMutation();
  const [markOut, markOutState] = useMarkFactoryOrderOutForDeliveryMutation();
  const [markDelivered, deliveredState] = useMarkFactoryOrderDeliveredMutation();
  const [rejectOrder, rejectState] = useRejectFactoryOrderMutation();
  const [amendOrder, amendState] = useAmendFactoryOrderMutation();
  const busy =
    preparingState.isLoading ||
    markOutState.isLoading ||
    deliveredState.isLoading ||
    rejectState.isLoading ||
    amendState.isLoading;
  const canStart = isOrderAwaitingFactory(order);
  const canDispatch = isOrderPreparing(order);
  const canDeliver = isOrderInShipment(order);
  const canAmend = isOrderAwaitingFactory(order) || isOrderPreparing(order);
  const canReject = !isOrderDone(order);
  const canInvoice = isOrderPreparing(order) || isOrderInShipment(order) || orderStatus(order) === "DELIVERED";
  const driverReady = Boolean(driverName.trim() && driverPhone.trim());
  const readyForShipment =
    checklist.stock && checklist.packing && checklist.invoice && checklist.quality && driverReady;
  const stockRows = order?.stockCheck?.items || [];
  const reservationStatus = reservationLabel(order);
  const hasReservedStock = String(order?.stockReservation?.status || "").toUpperCase() === "RESERVED";
  const hasDeductedStock = Boolean(order?.stockDeduction?.deductedAt);

  const run = async (fn) => {
    setError("");
    try {
      const updatedOrder = await fn();
      if (updatedOrder?._id) {
        onOrderChange?.(updatedOrder);
      }
    } catch (err) {
      setError(err?.data?.message || err?.message || "Action failed.");
    }
  };

  const toggleChecklist = (key) => {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleInvoice = () => {
    setChecklist((current) => ({ ...current, invoice: true }));
    onInvoice(order._id);
  };

  return (
    <Drawer
      title={order.orderNumber}
      eyebrow={`${order.dealerSnapshot?.companyName || "Dealer"} - ${statusLabel(order.status)}`}
      onClose={onClose}
      wide
    >
      <div className="stage-banner">
        <div>
          <span>Current step</span>
          <strong>{statusLabel(laneForOrder(order))}</strong>
          <small>{nextFactoryStep(order)}</small>
        </div>
        <span className={`status-pill ${String(order.status || "").toLowerCase()}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="drawer-actions sticky">
        {canStart ? (
          <button
            type="button"
            className="primary-action"
            onClick={() =>
              run(() =>
                startPreparing({ orderId: order._id, payload: { note: remarks } }).unwrap(),
              )
            }
            disabled={busy}
          >
            <IconText icon="play">Prepare</IconText>
          </button>
        ) : null}
        {canInvoice ? (
          <button type="button" onClick={handleInvoice} disabled={busy}>
            <IconText icon="invoice">Invoice</IconText>
          </button>
        ) : null}
        {canDispatch ? (
          <button
            type="button"
            className="primary-action"
            disabled={busy || !readyForShipment}
            title={
              readyForShipment
                ? "Dispatch order"
                : "Complete checklist and driver details first"
            }
            onClick={() => {
              const confirmed = window.confirm(
                `Dispatch ${order.orderNumber || "this order"} now?\n\nThis will consume the reserved stock and mark the order out for delivery.`,
              );
              if (!confirmed) return;
              run(() =>
                markOut({
                  orderId: order._id,
                  payload: { driverName, driverPhone, vehicleNumber, remarks },
                }).unwrap(),
              );
            }}
          >
            <IconText icon="truck">Dispatch</IconText>
          </button>
        ) : null}
        {canDeliver ? (
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={() =>
              run(() =>
                markDelivered({ orderId: order._id, payload: { note: remarks } }).unwrap(),
              )
            }
          >
            <IconText icon="check">Delivered</IconText>
          </button>
        ) : null}
        {!canStart && !canInvoice && !canDispatch && !canDeliver ? (
          <span className="drawer-stage-note">No pending factory action</span>
        ) : null}
      </div>
      {error ? <div className="alert-line">{error}</div> : null}

      <section className="drawer-section workflow-section">
        <div className="drawer-section-head">
          <div>
            <span>Workflow</span>
            <h3>Order preparation</h3>
          </div>
          <div className={readyForShipment ? "ready-line success" : "ready-line"}>
            {readyForShipment ? "Ready for shipment" : nextFactoryStep(order)}
          </div>
        </div>

        {canStart ? (
          <p className="drawer-hint">
            Start preparation to unlock checklist, driver details, invoice, and dispatch controls.
          </p>
        ) : null}

        {canDispatch ? (
          <>
            <div className="checklist">
              {[
                ["stock", "Stock Available"],
                ["packing", "Packing Complete"],
                ["invoice", "Invoice Generated"],
                ["quality", "Quality Checked"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={() => toggleChecklist(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <label className={driverReady ? "ready" : ""}>
                <DashboardIcon name="truck" size={16} />
                <span>{driverReady ? "Driver Ready" : "Driver Details Needed"}</span>
              </label>
            </div>
            <div className="form-grid shipment-form">
              <label>
                Driver Name
                <input value={driverName} onChange={(event) => setDriverName(event.target.value)} />
              </label>
              <label>
                Driver Phone
                <input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} />
              </label>
              <label>
                Vehicle Number
                <input
                  value={vehicleNumber}
                  onChange={(event) => setVehicleNumber(event.target.value)}
                />
              </label>
              <label>
                Dispatch Remarks
                <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} />
              </label>
            </div>
          </>
        ) : null}

        {(canDeliver || isOrderDone(order)) && (driverName || driverPhone || vehicleNumber) ? (
          <div className="info-grid">
            <span>Driver</span>
            <strong>{driverName || "-"}</strong>
            <span>Phone</span>
            <strong>{driverPhone || "-"}</strong>
            <span>Vehicle</span>
            <strong>{vehicleNumber || "-"}</strong>
            <span>Remarks</span>
            <strong>{remarks || "-"}</strong>
          </div>
        ) : null}
      </section>

      <div className="drawer-section-grid">
        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <span>Dealer</span>
              <h3>Dealer information</h3>
            </div>
          </div>
        <div className="info-grid">
          <span>Dealer</span>
          <strong>{order.dealerSnapshot?.companyName || "-"}</strong>
          <span>Contact</span>
          <strong>{order.dealerSnapshot?.contactName || "-"}</strong>
          <span>Email</span>
          <strong>{order.dealerSnapshot?.email || "-"}</strong>
          <span>Phone</span>
          <strong>{order.dealerSnapshot?.phone || "-"}</strong>
        </div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <span>Payment</span>
              <h3>Order summary</h3>
            </div>
          </div>
          <div className="info-grid">
            <span>Products</span>
            <strong>{productCount(order)}</strong>
            <span>Total</span>
            <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
            <span>Payment</span>
            <strong>{order.payment?.method || "-"}</strong>
            <span>Reference</span>
            <strong>{order.payment?.reference || "-"}</strong>
          </div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <span>Stage</span>
              <h3>Factory status</h3>
            </div>
          </div>
          <div className="info-grid">
            <span>Stage</span>
            <strong>{statusLabel(order.factoryStage || laneForOrder(order))}</strong>
            <span>Status</span>
            <strong>{statusLabel(order.status)}</strong>
            <span>Priority</span>
            <strong>{priorityForOrder(order)}</strong>
            <span>Received</span>
            <strong>{compactDate(order.factory?.sentToFactoryAt || order.createdAt)}</strong>
            <span>Stock</span>
            <strong>{reservationStatus}</strong>
            <span>Deduction</span>
            <strong>{hasDeductedStock ? "Deducted" : hasReservedStock ? "Pending dispatch" : "Not deducted"}</strong>
          </div>
        </section>
      </div>

      <section className="drawer-section stock-snapshot-section">
        <div className="drawer-section-head">
          <div>
            <span>Stock</span>
            <h3>Reservation snapshot</h3>
          </div>
          <span className={`stock-state-chip ${hasReservedStock || hasDeductedStock ? "success" : "neutral"}`}>
            {reservationStatus}
          </span>
        </div>
        <div className="table-wrap">
          <table className="dense-table stock-snapshot-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Requested</th>
                <th>Current</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row, index) => (
                <tr key={`${row.sku || row.name || "stock"}-${index}`}>
                  <td>
                    <strong>{row.name || "Product"}</strong>
                    <span>{row.sku || "No SKU"}</span>
                  </td>
                  <td>{Number(row.requestedQuantity || 0).toLocaleString()}</td>
                  <td>{Number(row.currentQuantity || 0).toLocaleString()}</td>
                  <td>{Number(row.reservedQuantity || 0).toLocaleString()}</td>
                  <td>{Number(row.availableQuantity || 0).toLocaleString()}</td>
                  <td>
                    <span className={`stock-state-chip ${stockCheckTone(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                    {row.message ? <small>{row.message}</small> : null}
                  </td>
                </tr>
              ))}
              {!stockRows.length ? (
                <tr>
                  <td colSpan={6}>
                    No stock snapshot is attached to this order yet. New Factory orders receive one during Admin verification.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="drawer-section">
        <div className="drawer-section-head">
          <div>
            <span>Items</span>
            <h3>Product list</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="dense-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Pack</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, index) => (
                <tr key={`${item.sku}-${index}`}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{item.packLabel || item.variantLabel}</td>
                  <td>{item.quantity}</td>
                  <td>{currency(item.unitPrice, order.totals?.currency)}</td>
                  <td>{currency(item.lineTotal, order.totals?.currency)}</td>
                </tr>
              ))}
              {!(order.items || []).length ? (
                <tr>
                  <td colSpan={6}>No product items found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canAmend || canReject ? (
        <section className="drawer-section corrections-section">
          <div className="drawer-section-head">
            <div>
              <span>Correction</span>
              <h3>Amend or reject</h3>
            </div>
          </div>
          <div className="correction-grid">
            {canAmend ? (
              <div className="form-grid">
                <label>
                  Amendment Reason
                  <input
                    value={amendReason}
                    onChange={(event) => setAmendReason(event.target.value)}
                    placeholder="Required before amending"
                  />
                </label>
                <label>
                  Amendment Note
                  <textarea
                    value={amendNote}
                    onChange={(event) => setAmendNote(event.target.value)}
                    placeholder="Optional internal note"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !amendReason.trim()}
                  onClick={() =>
                    run(() =>
                      amendOrder({
                        orderId: order._id,
                        payload: { reason: amendReason, note: amendNote || remarks },
                      }).unwrap(),
                    )
                  }
                >
                  <IconText icon="edit">Record Amendment</IconText>
                </button>
              </div>
            ) : null}
            {canReject ? (
              <div className="form-grid reject-panel">
                <label>
                  Rejection Reason
                  <input
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Required only when rejecting"
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() =>
                    run(() =>
                      rejectOrder({
                        orderId: order._id,
                        payload: { reason: rejectReason, note: remarks },
                      }).unwrap(),
                    )
                  }
                >
                  <IconText icon="reject">Reject Order</IconText>
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="drawer-section">
        <div className="drawer-section-head">
          <div>
            <span>Timeline</span>
            <h3>History</h3>
          </div>
        </div>
        <div className="timeline-list">
          {(order.statusHistory || []).slice().reverse().map((item, index) => (
            <div className="timeline-item" key={`${item.toStatus}-${index}`}>
              <time>{compactDate(item.changedAt)}</time>
              <div>
                <strong>{statusLabel(item.toStatus)}</strong>
                <span>{item.note || item.reason || "Status changed"}</span>
              </div>
            </div>
          ))}
          {!(order.statusHistory || []).length ? (
            <div className="empty-line">No status history recorded.</div>
          ) : null}
        </div>
      </section>
    </Drawer>
  );
}

function OrdersPage({ globalSearch, onInvoice }) {
  const [lane, setLane] = useState("INBOX");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [dealer, setDealer] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [sort, setSort] = useState("received-desc");
  const [selected, setSelected] = useState(null);
  const effectiveSearch = query || globalSearch;
  const listQuery = useGetFactoryOrdersQuery({
    stage: "ALL",
    q: effectiveSearch,
    limit: 100,
  });
  const allOrders = listQuery.data?.items || [];
  const counts = ORDER_LANES.reduce((acc, item) => {
    acc[item.key] = allOrders.filter((order) => orderMatchesLane(order, item.key)).length;
    return acc;
  }, {});
  const items = [...allOrders].filter((order) => {
    if (!orderMatchesLane(order, lane)) return false;
    if (date && todayKey(order.createdAt) !== date) return false;
    if (dealer && !String(order.dealerSnapshot?.companyName || "").toLowerCase().includes(dealer.toLowerCase())) return false;
    if (priority !== "ALL" && priorityForOrder(order) !== priority) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "total-desc") return Number(b.totals?.total || 0) - Number(a.totals?.total || 0);
    if (sort === "total-asc") return Number(a.totals?.total || 0) - Number(b.totals?.total || 0);
    if (sort === "dealer") {
      return String(a.dealerSnapshot?.companyName || "").localeCompare(
        String(b.dealerSnapshot?.companyName || ""),
      );
    }
    return new Date(b.factory?.sentToFactoryAt || b.updatedAt || b.createdAt || 0) -
      new Date(a.factory?.sentToFactoryAt || a.updatedAt || a.createdAt || 0);
  });
  const hasFilters = Boolean(query || draftQuery || date || dealer || priority !== "ALL" || sort !== "received-desc");

  const clearFilters = () => {
    setDraftQuery("");
    setQuery("");
    setDate("");
    setDealer("");
    setPriority("ALL");
    setSort("received-desc");
  };

  return (
    <div className="factory-page">
      <section className="orders-board">
        <div className="page-head compact">
          <div>
            <p>Orders</p>
            <h1>Factory order queue</h1>
            <span>
              Search, prepare, invoice, and dispatch factory-routed orders.
            </span>
          </div>
          {listQuery.isFetching ? <div className="updating-chip">Updating...</div> : null}
        </div>
        <StatusTabs
          value={lane}
          options={ORDER_LANES}
          counts={counts}
          onChange={setLane}
        />
        <div className="filter-row orders-filter-row">
          <SearchField
            value={draftQuery}
            onChange={setDraftQuery}
            onSubmit={() => setQuery(draftQuery.trim())}
            onClear={() => {
              setDraftQuery("");
              setQuery("");
            }}
            placeholder="Search order number or dealer..."
          />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input value={dealer} onChange={(event) => setDealer(event.target.value)} placeholder="Dealer" />
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="ALL">Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Normal">Normal</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="received-desc">Newest first</option>
            <option value="dealer">Dealer name</option>
            <option value="total-desc">Highest total</option>
            <option value="total-asc">Lowest total</option>
          </select>
          {hasFilters ? (
            <button type="button" className="clear-filter-btn" onClick={clearFilters}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="order-list">
          {listQuery.isLoading && !listQuery.data ? (
            <div className="empty-line">Loading factory orders...</div>
          ) : null}
          {items.map((order) => (
            <button
              key={order._id}
              type="button"
              className="order-row"
              onClick={() => setSelected(order)}
            >
              <div className="order-main">
                <strong>{order.dealerSnapshot?.companyName || "Dealer"}</strong>
                <span>#{order.orderNumber}</span>
              </div>
              <span className="order-stat">
                <DashboardIcon name="stock" size={15} />
                {productCount(order)}
              </span>
              <strong className="order-total">{currency(order.totals?.total, order.totals?.currency)}</strong>
              <span className="order-stat">
                <DashboardIcon name="history" size={15} />
                {timeAgo(order.factory?.sentToFactoryAt || order.updatedAt || order.createdAt)}
              </span>
              <span className={`status-pill ${String(order.status || "").toLowerCase()}`}>
                {statusLabel(order.status)}
              </span>
              <span className={`priority ${priorityForOrder(order).toLowerCase()}`}>
                {priorityForOrder(order)}
              </span>
              <span className="order-stat">
                <DashboardIcon name="truck" size={15} />
                {order.factory?.driverName || "No driver"}
              </span>
              <span className="row-open">
                <DashboardIcon name="chevron" size={17} />
              </span>
            </button>
          ))}
          {!listQuery.isLoading && !items.length ? (
            <div className="empty-line">No orders match this view.</div>
          ) : null}
        </div>
      </section>
      {selected ? (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onInvoice={onInvoice}
          onOrderChange={setSelected}
        />
      ) : null}
    </div>
  );
}

function StockEditDrawer({ product, onClose }) {
  const [newStock, setNewStock] = useState(product?.stock?.currentQuantity || 0);
  const [threshold, setThreshold] = useState(product?.stock?.lowStockThreshold || 0);
  const [editMode, setEditMode] = useState("quick");
  const [customDelta, setCustomDelta] = useState(1);
  const [reason, setReason] = useState("Manual Count");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [updateStock, stockState] = useUpdateStockQuantityMutation();
  const [updateThreshold, thresholdState] = useUpdateStockThresholdMutation();
  const historyQuery = useGetStockHistoryQuery(
    product ? { productId: product.productId || product._id, limit: 12 } : skipToken,
  );
  const current = Number(product?.stock?.currentQuantity || 0);
  const next = Number(newStock || 0);
  const delta = next - current;
  const thresholdChanged = Number(threshold) !== Number(product?.stock?.lowStockThreshold || 0);
  const hasChange = delta !== 0 || thresholdChanged;
  const saving = stockState.isLoading || thresholdState.isLoading;

  const applyDelta = (amount) => {
    setConfirming(false);
    setNewStock((value) => Math.max(0, Number(value || 0) + Number(amount || 0)));
  };

  const resetStock = () => {
    setConfirming(false);
    setNewStock(current);
    setThreshold(product?.stock?.lowStockThreshold || 0);
    setCustomDelta(1);
  };

  const save = async () => {
    setError("");
    if (!hasChange) {
      setError("No stock or threshold changes to save.");
      return;
    }
    if (!Number.isFinite(next) || next < 0) {
      setError("Stock cannot be negative.");
      return;
    }
    try {
      if (delta !== 0) {
        await updateStock({
          productId: product.productId || product._id,
          payload: { newQuantity: next, reason, note },
        }).unwrap();
      }
      if (thresholdChanged) {
        await updateThreshold({
          productId: product.productId || product._id,
          payload: { lowStockThreshold: Number(threshold), reason, note },
        }).unwrap();
      }
      onClose();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Stock update failed.");
    }
  };

  if (!product) return null;

  return (
    <Drawer title={product.name} eyebrow={`${product.sku} - ${product.packLabel || ""}`} onClose={onClose}>
      <div className="stock-change">
        <div>
          <span>Current Stock</span>
          <strong>{current}</strong>
        </div>
        <div>
          <span>New Stock</span>
          <strong>{next}</strong>
        </div>
        <div>
          <span>Difference</span>
          <strong className={delta < 0 ? "negative" : "positive"}>{delta >= 0 ? `+${delta}` : delta}</strong>
        </div>
      </div>
      <section className="stock-edit-console">
        <div className="stock-edit-head">
          <div>
            <strong>Edit stock</strong>
            <span>Use quick controls for receiving stock, or switch to exact count after a manual count.</span>
          </div>
          <div className="stock-edit-mode" aria-label="Stock edit mode">
            <button
              type="button"
              className={editMode === "quick" ? "active" : ""}
              onClick={() => setEditMode("quick")}
            >
              Quick
            </button>
            <button
              type="button"
              className={editMode === "exact" ? "active" : ""}
              onClick={() => setEditMode("exact")}
            >
              Exact
            </button>
          </div>
        </div>
        {editMode === "quick" ? (
          <>
            <div className="stock-step-grid" aria-label="Quick stock adjustments">
              {[-10, -5, -1, 1, 5, 10].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={amount < 0 ? "minus" : "plus"}
                  onClick={() => applyDelta(amount)}
                >
                  {amount > 0 ? `+${amount}` : amount}
                </button>
              ))}
            </div>
            <div className="stock-custom-adjust">
              <label>
                Custom add/remove
                <input
                  type="number"
                  min="1"
                  value={customDelta}
                  onChange={(event) => setCustomDelta(event.target.value)}
                />
              </label>
              <button type="button" onClick={() => applyDelta(-Number(customDelta || 0))}>
                Remove
              </button>
              <button type="button" onClick={() => applyDelta(Number(customDelta || 0))}>
                Add
              </button>
            </div>
          </>
        ) : (
          <label className="exact-stock-input">
            Exact stock count
            <input
              type="number"
              min="0"
              value={newStock}
              onChange={(event) => {
                setConfirming(false);
                setNewStock(event.target.value);
              }}
            />
          </label>
        )}
        <button type="button" className="stock-reset-btn" onClick={resetStock}>
          Reset to current stock
        </button>
      </section>
      <div className="form-grid">
        <label>
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {STOCK_REASONS.map((item) => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Low Stock Threshold
          <input
            type="number"
            min="0"
            value={threshold}
            onChange={(event) => {
              setConfirming(false);
              setThreshold(event.target.value);
            }}
          />
        </label>
        <label>
          Notes
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      {Math.abs(delta) >= 100 ? (
        <div className="alert-line">Large stock adjustment. Review before confirming.</div>
      ) : null}
      {confirming ? (
        <div className="confirm-box">
          <strong>
            You are about to change {product.name} stock from {current} to {next}.
          </strong>
          <span>Difference: {delta >= 0 ? `+${delta}` : delta}</span>
          <span>Threshold: {thresholdChanged ? `${product?.stock?.lowStockThreshold || 0} → ${threshold}` : "No threshold change"}</span>
          <span>Reason: {reason}</span>
          <div className="drawer-actions">
            <button type="button" onClick={() => setConfirming(false)}>Back</button>
            <button type="button" onClick={save} disabled={saving || !hasChange}>
              {saving ? "Saving..." : "Confirm Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="drawer-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={() => setConfirming(true)} disabled={!hasChange}>
            Review Change
          </button>
        </div>
      )}
      {error ? <div className="alert-line">{error}</div> : null}
      <details open>
        <summary>Recent Audit</summary>
        <div className="timeline-list">
          {(historyQuery.data?.items || []).map((row) => (
            <div className="timeline-item" key={row._id}>
              <time>{compactDate(row.changedAt)}</time>
              <div>
                <strong>
                  {row.previousQuantity} {"->"} {row.newQuantity}
                </strong>
                <span>{row.reason}</span>
              </div>
            </div>
          ))}
          {!(historyQuery.data?.items || []).length ? <div className="empty-line">No history.</div> : null}
        </div>
      </details>
    </Drawer>
  );
}

function BulkImportPanel({ products }) {
  const [rows, setRows] = useState([]);
  const [reason, setReason] = useState("Stock Received");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [bulkUpdate, bulkState] = useBulkUpdateStockMutation();
  const productBySku = useMemo(() => {
    const map = new Map();
    products.forEach((product) => map.set(String(product.sku || "").toLowerCase(), product));
    return map;
  }, [products]);

  const parseFile = async (file) => {
    setError("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must include headers and at least one row.");
      return;
    }
    const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
    const skuIndex = headers.findIndex((item) => ["sku", "product_sku"].includes(item));
    const quantityIndex = headers.findIndex((item) =>
      ["newquantity", "new_quantity", "quantity", "stock", "currentstock", "current_stock"].includes(item),
    );
    if (skuIndex === -1 || quantityIndex === -1) {
      setError("CSV needs sku and newQuantity columns.");
      return;
    }
    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(",").map((item) => item.trim());
      const sku = cols[skuIndex] || "";
      const product = productBySku.get(sku.toLowerCase());
      const oldQuantity = Number(product?.stock?.currentQuantity || 0);
      const newQuantity = Number(cols[quantityIndex] || 0);
      return {
        sku,
        productName: product?.name || "Not found",
        productId: product?.productId || product?._id || "",
        oldQuantity,
        newQuantity,
        delta: newQuantity - oldQuantity,
        valid: Boolean(product && Number.isFinite(newQuantity) && newQuantity >= 0),
      };
    });
    setRows(parsed);
  };

  const confirm = async () => {
    const validRows = rows.filter((row) => row.valid);
    if (!validRows.length) {
      setError("No valid rows to import.");
      return;
    }
    try {
      await bulkUpdate({
        reason,
        note,
        changes: validRows.map((row) => ({
          productId: row.productId,
          sku: row.sku,
          newQuantity: row.newQuantity,
        })),
      }).unwrap();
      setRows([]);
      setNote("");
    } catch (err) {
      setError(err?.data?.message || err?.message || "Bulk import failed.");
    }
  };

  return (
    <section className="bulk-panel stock-import-panel">
      <div className="stock-import-head">
        <div>
          <span>Bulk Update</span>
          <h2>Import stock from CSV or Excel</h2>
          <p>Upload a CSV exported from Excel. Changes are previewed before stock is updated.</p>
        </div>
        <div className="format-help">
          <button type="button" aria-label="View import file format">
            i
          </button>
          <div className="format-popover" role="note">
            <strong>Accepted format</strong>
            <p>Use CSV from Excel with these columns. Header names are not case-sensitive.</p>
            <table>
              <thead>
                <tr>
                  <th>sku</th>
                  <th>newQuantity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>EXT-HIGH-GLOSS-20L</td>
                  <td>145</td>
                </tr>
                <tr>
                  <td>ROLLER-10IN</td>
                  <td>32</td>
                </tr>
              </tbody>
            </table>
            <small>Also accepted: product_sku, quantity, stock, current_stock.</small>
          </div>
        </div>
      </div>
      <div className="stock-import-grid">
        <label className="stock-file-drop">
          <DashboardIcon name="download" size={22} />
          <span>
            <strong>Choose CSV file</strong>
            <small>Export your Excel sheet as .csv before uploading.</small>
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) parseFile(file);
            }}
          />
        </label>
        <label>
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {STOCK_REASONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional import note" />
        </label>
      </div>
      {error ? <div className="alert-line">{error}</div> : null}
      {rows.length ? (
        <>
          <div className="import-summary">
            <span>{rows.length} rows parsed</span>
            <span>{rows.filter((row) => row.valid).length} ready</span>
            <span>{rows.filter((row) => !row.valid).length} skipped</span>
          </div>
          <div className="table-wrap import-preview">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Old</th>
                  <th>New</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.sku}-${index}`} className={!row.valid ? "invalid" : ""}>
                    <td>{row.sku}</td>
                    <td>{row.productName}</td>
                    <td>{row.oldQuantity}</td>
                    <td>{row.newQuantity}</td>
                    <td>{row.delta >= 0 ? `+${row.delta}` : row.delta}</td>
                    <td>{row.valid ? "Ready" : "Skipped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="drawer-actions">
            <button type="button" onClick={() => setRows([])}>Clear Preview</button>
            <button type="button" onClick={confirm} disabled={bulkState.isLoading}>
              {bulkState.isLoading ? "Importing" : "Confirm Import"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function StockPage({ globalSearch }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [family, setFamily] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState(null);
  const effectiveSearch = query || globalSearch;
  const stockQuery = useGetStockQuery({
    q: effectiveSearch,
    category: category === "ALL" ? "" : category,
    code: family === "ALL" ? "" : family,
    status,
    limit: 200,
  });
  const allStockQuery = useGetStockQuery({ limit: 200 });
  const allItems = allStockQuery.data?.items || [];
  const categories = [...new Set(allItems.map((item) => item.category).filter(Boolean))].sort();
  const families = [
    ...new Set(allItems.map((item) => item.code).filter(Boolean)),
  ].sort();
  const items = [...(stockQuery.data?.items || [])]
    .sort((a, b) => {
      if (sort === "stock-asc") {
        return Number(a.stock?.availableQuantity || 0) - Number(b.stock?.availableQuantity || 0);
      }
      if (sort === "stock-desc") {
        return Number(b.stock?.availableQuantity || 0) - Number(a.stock?.availableQuantity || 0);
      }
      if (sort === "updated") {
        return new Date(b.stock?.lastUpdatedAt || 0) - new Date(a.stock?.lastUpdatedAt || 0);
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Stock</p>
          <h1>Factory stock catalog</h1>
          <span>Search products, review available stock, and update inventory safely.</span>
        </div>
        {stockQuery.isFetching ? <div className="updating-chip">Updating...</div> : null}
      </div>
      <div className="filter-row stock-filter-row">
        <SearchField
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={() => setQuery(draftQuery.trim())}
          onClear={() => {
            setDraftQuery("");
            setQuery("");
          }}
          placeholder="Search product, SKU, category"
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="ALL">All categories</option>
          {categories.map((item) => (
            <option value={item} key={item}>{statusLabel(item)}</option>
          ))}
        </select>
        <select value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value="ALL">All families</option>
          {families.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {STOCK_STATUS_OPTIONS.map((item) => (
            <option value={item.value} key={item.value}>{item.label}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          {SORT_OPTIONS.map((item) => (
            <option value={item.value} key={item.value}>{item.label}</option>
          ))}
        </select>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            <IconText icon="overview">Grid</IconText>
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <IconText icon="orders">List</IconText>
          </button>
        </div>
      </div>
      {stockQuery.isLoading && !stockQuery.data ? (
        <div className="empty-line">Loading stock catalog...</div>
      ) : null}
      {view === "grid" ? (
        <div className="stock-catalog-grid">
          {items.map((item) => {
            return (
              <button
                type="button"
                key={item._id || item.sku}
                className={`stock-card stock-${String(item.stock?.status || "").toLowerCase()}`}
                onClick={() => setSelected(item)}
              >
                <div className="stock-card-head">
                  <div className="stock-card-copy">
                    <h3>{item.name}</h3>
                    <span>{item.packLabel || item.pack?.label || "Variant"}</span>
                  </div>
                  <span className="quick-edit" aria-hidden="true">
                    <DashboardIcon name="edit" size={15} />
                  </span>
                </div>
                <div className="stock-card-numbers">
                  <div>
                    <DashboardIcon name="stock" size={15} />
                    <span>Current</span>
                    <strong>{item.stock?.currentQuantity || 0}</strong>
                  </div>
                  <div>
                    <DashboardIcon name="history" size={15} />
                    <span>Reserved</span>
                    <strong>{item.stock?.reservedQuantity || 0}</strong>
                  </div>
                  <div>
                    <DashboardIcon name="check" size={15} />
                    <span>Available</span>
                    <strong>{item.stock?.availableQuantity || 0}</strong>
                  </div>
                </div>
              </button>
            );
          })}
          {!stockQuery.isLoading && !items.length ? (
            <div className="empty-line">No stock rows found.</div>
          ) : null}
        </div>
      ) : (
        <div className="table-wrap stock-table-wrap">
          <table className="dense-table stock-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Current</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const imageUrl = stockImageUrl(item);
                const rowKey = item._id || item.sku;
                return (
                  <tr
                    key={rowKey}
                    className={`stock-table-row stock-${String(item.stock?.status || "").toLowerCase()}`}
                    onClick={() => setSelected(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td>
                      <div className="stock-table-product">
                        <span className="stock-table-thumb">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name || item.sku || "Product"}
                              loading="lazy"
                            />
                          ) : (
                            <strong>{String(item.name || "M").slice(0, 1)}</strong>
                          )}
                        </span>
                        <span>
                          <strong>{item.name || "-"}</strong>
                          <small>{item.category || "Uncategorized"}</small>
                        </span>
                        <button
                          type="button"
                          className="table-action-btn"
                          aria-label={`Update stock for ${item.name || item.sku || "product"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(item);
                          }}
                        >
                          <DashboardIcon name="edit" size={16} />
                        </button>
                      </div>
                    </td>
                    <td>{item.packLabel || item.pack?.label || "-"}</td>
                    <td>{item.stock?.currentQuantity || 0}</td>
                    <td>{item.stock?.reservedQuantity || 0}</td>
                    <td>
                      <strong>{item.stock?.availableQuantity || 0}</strong>
                    </td>
                    <td>
                      <span className="status-pill">{statusLabel(item.stock?.status)}</span>
                    </td>
                    <td>{item.stock?.lastUpdatedAt ? timeAgo(item.stock.lastUpdatedAt) : "Not updated"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!stockQuery.isLoading && !items.length ? (
            <div className="empty-line">No stock rows found.</div>
          ) : null}
        </div>
      )}
      <BulkImportPanel products={items} />
      {selected ? <StockEditDrawer product={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function StockHistoryPage({ globalSearch }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const effectiveSearch = query || globalSearch;
  const historyQuery = useGetAllStockHistoryQuery({
    q: effectiveSearch,
    reason: reason === "ALL" ? "" : reason,
    dateFrom,
    dateTo,
    limit: 120,
  });
  const items = historyQuery.data?.items || [];
  const exportCsv = () => {
    const headers = ["Date", "Product", "Old", "New", "Difference", "Reason", "Factory User"];
    const rows = items.map((row) => [
      compactDate(row.changedAt),
      row.productName || row.sku || "",
      row.previousQuantity ?? "",
      row.newQuantity ?? "",
      row.delta ?? "",
      row.reason || "",
      row.changedBy?.username || row.changedBy?.email || row.changedByRole || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "factory-stock-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Stock History</p>
          <h1>Stock audit trail</h1>
          <span>Every stock correction is recorded with reason, user, and timestamp.</span>
        </div>
        <div className="page-actions">
          {historyQuery.isFetching ? <div className="updating-chip">Updating...</div> : null}
          <button type="button" onClick={exportCsv}>
            <IconText icon="download">CSV</IconText>
          </button>
          <button type="button" onClick={() => window.print()}>
            <IconText icon="print">Print</IconText>
          </button>
        </div>
      </div>
      <div className="filter-row history-filter-row">
        <SearchField
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={() => setQuery(draftQuery.trim())}
          onClear={() => {
            setDraftQuery("");
            setQuery("");
          }}
          placeholder="Search product, SKU, reason, order"
        />
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="ALL">All reasons</option>
          {STOCK_REASONS.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label="Date from"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          aria-label="Date to"
        />
      </div>
      <div className="table-wrap">
        <table className="dense-table audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Old</th>
              <th>New</th>
              <th>Difference</th>
              <th>Reason</th>
              <th>Factory User</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id}>
                <td>{compactDate(row.changedAt)}</td>
                <td><strong>{row.productName || row.sku}</strong></td>
                <td>{row.previousQuantity}</td>
                <td>{row.newQuantity}</td>
                <td className={Number(row.delta || 0) < 0 ? "negative" : "positive"}>
                  {Number(row.delta || 0) >= 0 ? `+${row.delta || 0}` : row.delta}
                </td>
                <td>{row.reason}</td>
                <td>{row.changedBy?.username || row.changedBy?.email || row.changedByRole || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <div className="empty-line">No stock history found.</div> : null}
      </div>
    </div>
  );
}

function InvoicePreview({ invoice, onClose }) {
  if (!invoice) return null;
  return (
    <Drawer title={`Proforma ${invoice.orderNumber}`} eyebrow="Print Preview" onClose={onClose} wide>
      <div className="drawer-actions no-print">
        <button type="button" onClick={() => window.print()}>
          <IconText icon="print">Print</IconText>
        </button>
        <button type="button" onClick={() => downloadInvoicePdf(invoice)}>
          <IconText icon="download">Download PDF</IconText>
        </button>
      </div>
      <div className="invoice-print-area">
        {(invoice.copies || ["Factory Copy", "Driver Copy", "Dealer Copy"]).map((copy) => (
          <section className="proforma-copy" key={copy}>
            <header>
              <div>
                <h1>MEITU PAINTS</h1>
                <p>Proforma Invoice</p>
              </div>
              <strong>{copy}</strong>
            </header>
            <div className="proforma-meta">
              <span>Order: {invoice.orderNumber}</span>
              <span>Date: {compactDate(invoice.generatedAt)}</span>
              <span>Dealer: {invoice.dealer?.companyName || "-"}</span>
              <span>Driver: {invoice.driver?.name || "-"}</span>
              <span>Vehicle: {invoice.driver?.vehicleNumber || "-"}</span>
              <span>Phone: {invoice.driver?.phone || "-"}</span>
            </div>
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Pack</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item, index) => (
                  <tr key={`${copy}-${item.sku}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td>{item.packLabel || item.variantLabel}</td>
                    <td>{item.quantity}</td>
                    <td>{currency(item.unitPrice, invoice.totals?.currency)}</td>
                    <td>{currency(item.lineTotal, invoice.totals?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="proforma-total">
              <span>Subtotal: {currency(invoice.totals?.subtotal, invoice.totals?.currency)}</span>
              <span>Tax: {currency(invoice.totals?.tax, invoice.totals?.currency)}</span>
              <strong>Grand Total: {currency(invoice.totals?.total, invoice.totals?.currency)}</strong>
            </div>
            <div className="signatures">
              <span>Factory</span>
              <span>Driver</span>
              <span>Dealer</span>
            </div>
          </section>
        ))}
      </div>
    </Drawer>
  );
}

function InvoicesPage({ globalSearch, onInvoice }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("ALL");
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: query || globalSearch, limit: 100 });
  const orders = (ordersQuery.data?.items || []).filter((order) => {
    if (date && todayKey(order.createdAt) !== date) return false;
    if (status !== "ALL" && String(order.status || "").toUpperCase() !== status) return false;
    return true;
  });

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Proforma Invoices</p>
          <h1>Factory invoice center</h1>
          <span>Open, print, download, or duplicate proforma invoices from factory orders.</span>
        </div>
        {ordersQuery.isFetching ? <div className="updating-chip">Updating...</div> : null}
      </div>
      <div className="filter-row invoice-filter-row">
        <SearchField
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={() => setQuery(draftQuery.trim())}
          onClear={() => {
            setDraftQuery("");
            setQuery("");
          }}
          placeholder="Search dealer, order, invoice"
        />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="PROCESSING">Preparing</option>
          <option value="AWAITING_SHIPMENT">Awaiting Shipment</option>
          <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <div className="order-list">
        {orders.map((order) => (
          <div className="invoice-row" key={order._id}>
            <div>
              <strong>{order.orderNumber}</strong>
              <span>{order.dealerSnapshot?.companyName || "Dealer"}</span>
            </div>
            <span>{statusLabel(order.status)}</span>
            <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
            <button type="button" onClick={() => onInvoice(order._id)}>
              <IconText icon="invoice">Preview</IconText>
            </button>
            <button type="button" onClick={() => onInvoice(order._id, "print")}>
              <IconText icon="print">Print</IconText>
            </button>
            <button type="button" onClick={() => onInvoice(order._id, "download")}>
              <IconText icon="download">PDF</IconText>
            </button>
          </div>
        ))}
        {!orders.length ? <div className="empty-line">No invoices available.</div> : null}
      </div>
    </div>
  );
}

function NotificationsPage({ globalSearch }) {
  const notificationsQuery = useGetNotificationsQuery({ days: 14, limit: 80 });
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: globalSearch, limit: 30 });
  const historyQuery = useGetAllStockHistoryQuery({ q: globalSearch, limit: 30 });
  const activity = makeActivity({
    orders: ordersQuery.data?.items || [],
    history: historyQuery.data?.items || [],
  });
  const backendItems = notificationsQuery.data || [];
  const visibleItems = backendItems.length
    ? backendItems.map((item) => ({
        id: item._id,
        title: item.title,
        meta: item.description,
        at: item.createdAt,
        isRead: item.isRead,
      }))
    : activity;
  const unread = backendItems.length
    ? backendItems.filter((item) => !item.isRead).length
    : activity.length;

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Notifications</p>
          <h1>Operational alerts</h1>
        </div>
        <span className="unread-badge">{unread} unread</span>
      </div>
      <div className="notification-list">
        {visibleItems.map((item) => (
          <div className="notification-row" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
            <time>{timeAgo(item.at)}</time>
          </div>
        ))}
        {!visibleItems.length ? <div className="empty-line">No notifications.</div> : null}
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Profile</p>
          <h1>Factory operator</h1>
        </div>
      </div>
      <div className="plain-section">
        <div className="info-grid">
          <span>Email</span>
          <strong>{user?.email || "-"}</strong>
          <span>Username</span>
          <strong>{user?.username || "-"}</strong>
          <span>Role</span>
          <strong>{user?.role || "FACTORY"}</strong>
        </div>
      </div>
    </div>
  );
}

function FactoryDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const globalSearch = "";
  const [invoice, setInvoice] = useState(null);
  const [loadInvoice, invoiceState] = useLazyGetProformaInvoiceQuery();
  const active = sectionFromPath(location.pathname);

  const goTo = (key) => navigate(ROUTES[key] || ROUTES[SECTIONS.DASHBOARD]);
  const openInvoice = async (orderId, action = "preview") => {
    const item = await loadInvoice(orderId).unwrap();
    setInvoice(item);
    if (action === "download") {
      downloadInvoicePdf(item);
    }
    if (action === "print") {
      window.setTimeout(() => window.print(), 120);
    }
  };

  return (
    <FactoryShell active={active}>
      {invoiceState.isFetching ? <div className="inline-loading">Loading invoice...</div> : null}
      {active === SECTIONS.OVERVIEW ? (
        <OverviewPage globalSearch={globalSearch} onNavigate={goTo} />
      ) : null}
      {active === SECTIONS.ORDERS ? (
        <OrdersPage globalSearch={globalSearch} onInvoice={openInvoice} />
      ) : null}
      {active === SECTIONS.STOCK ? <StockPage globalSearch={globalSearch} /> : null}
      {active === SECTIONS.INVOICES ? (
        <InvoicesPage globalSearch={globalSearch} onInvoice={openInvoice} />
      ) : null}
      {active === SECTIONS.STOCK_HISTORY ? (
        <StockHistoryPage globalSearch={globalSearch} />
      ) : null}
      {active === SECTIONS.NOTIFICATIONS ? (
        <NotificationsPage globalSearch={globalSearch} />
      ) : null}
      {active === SECTIONS.PROFILE ? <ProfilePage /> : null}
      <InvoicePreview invoice={invoice} onClose={() => setInvoice(null)} />
    </FactoryShell>
  );
}

function FactoryStyles() {
  return (
    <style>{`
      :root{--factory-red:#b42318;--factory-ink:#0f172a;--factory-muted:rgba(15,23,42,.58);--factory-line:rgba(15,23,42,.08);--factory-soft:#f8fafc;}
      .factory-page{display:grid;gap:18px;max-width:1480px;margin:0 auto;color:var(--factory-ink);}
      .page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
      .page-head p{margin:0 0 5px;color:var(--factory-red);font-size:12px;text-transform:uppercase;font-weight:950;letter-spacing:.12em;}
      .page-head h1{margin:0;font-size:clamp(28px,3vw,42px);line-height:1.03;letter-spacing:-.035em;font-weight:950;color:var(--factory-ink);}
      .page-head.compact h1{font-size:clamp(25px,2.5vw,34px);}
      .page-head span{display:block;margin-top:7px;color:var(--factory-muted);font-weight:750;line-height:1.55;}
      .page-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .page-actions button,.drawer-actions button,.dense-table button,.invoice-row button,.form-grid button,.quick-edit,.clear-filter-btn{border:1px solid var(--factory-line);background:#fff;border-radius:14px;padding:9px 13px;font-weight:900;color:var(--factory-ink);cursor:pointer;}
      .page-actions button,.drawer-actions button,.invoice-row button,.form-grid button,.quick-edit,.view-toggle button{display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .page-actions button:hover,.drawer-actions button:hover,.dense-table button:hover,.invoice-row button:hover,.form-grid button:hover{border-color:rgba(180,35,24,.22);color:var(--factory-red);}
      .drawer-actions button.primary-action{background:linear-gradient(135deg,#b91c1c 0%,#dd5127 100%);border-color:transparent;color:#fff;}
      .drawer-actions button:disabled,.form-grid button:disabled,.clear-filter-btn:disabled{opacity:.52;cursor:not-allowed;box-shadow:none;}
      .drawer-actions button.danger,.danger{background:#991b1b!important;border-color:#991b1b!important;color:#fff!important;}
      .updating-chip,.ready-line,.alert-line,.inline-loading{display:inline-flex;align-items:center;border-radius:999px;padding:9px 12px;background:rgba(180,35,24,.07);color:var(--factory-red);font-size:12px;font-weight:950;}
      .metric-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;}
      .metric-strip button{border:1px solid var(--factory-line);background:#fff;border-radius:16px;padding:15px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .metric-strip span{display:block;color:var(--factory-muted);font-size:12px;font-weight:850;}
      .metric-strip strong{display:block;margin-top:7px;font-size:26px;letter-spacing:-.04em;color:var(--factory-ink);}
      .split-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
      .factory-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      .plain-section,.bulk-panel{background:#fff;border:1px solid var(--factory-line);border-radius:16px;padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;}
      .section-head h2{margin:0;font-size:18px;letter-spacing:-.02em;color:var(--factory-ink);}
      .section-head button{border:0;background:transparent;color:var(--factory-red);font-weight:950;cursor:pointer;}
      .mini-list,.timeline-list,.notification-list,.order-list{display:grid;gap:8px;}
      .mini-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;width:100%;border:1px solid rgba(15,23,42,.06);background:#fff;border-radius:14px;padding:12px;text-align:left;cursor:pointer;}
      .mini-list.warning button{background:#fffbeb;}
      .mini-list strong,.timeline-item strong,.notification-row strong{display:block;font-size:14px;color:var(--factory-ink);}
      .mini-list span,.timeline-item span,.notification-row span{display:block;color:var(--factory-muted);font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .timeline-item{display:grid;grid-template-columns:84px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid rgba(15,23,42,.06);}
      .timeline-item time,.notification-row time{color:var(--factory-muted);font-size:12px;font-weight:850;}
      .factory-tabs{display:flex;align-items:center;gap:4px;overflow-x:auto;padding:4px;border:1px solid var(--factory-line);background:rgba(241,245,249,.92);border-radius:999px;width:max-content;max-width:100%;}
      .factory-tabs button{min-height:36px;border:1px solid transparent;background:transparent;border-radius:999px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:950;color:var(--factory-muted);cursor:pointer;white-space:nowrap;}
      .factory-tabs button.active{background:#fff;color:var(--factory-ink);box-shadow:0 8px 20px rgba(15,23,42,.10);}
      .factory-tabs strong{min-width:21px;height:21px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(15,23,42,.06);color:inherit;font-size:11px;}
      .filter-row{display:grid;gap:10px;align-items:center;}
      .orders-filter-row{grid-template-columns:minmax(280px,1.4fr) .7fr .85fr .75fr .75fr auto;}
      .stock-filter-row{grid-template-columns:minmax(260px,1.5fr) .75fr .75fr .7fr .75fr auto;}
      .history-filter-row{grid-template-columns:minmax(280px,1.4fr) .75fr .6fr .6fr;}
      .invoice-filter-row{grid-template-columns:minmax(280px,1.4fr) .65fr .75fr;}
      .filter-row.single{grid-template-columns:1fr;}
      .factory-search{height:50px;display:flex;align-items:center;gap:10px;border:1px solid var(--factory-line);background:#fff;border-radius:16px;padding:0 14px;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .factory-search-icon{flex:0 0 auto;color:rgba(15,23,42,.42);}
      .factory-search input{width:100%;border:0;outline:0;background:transparent;font:inherit;font-size:14px;font-weight:800;color:var(--factory-ink);}
      .factory-clear-search{width:28px;height:28px;border-radius:999px;border:1px solid var(--factory-line);background:var(--factory-soft);color:var(--factory-muted);font-size:18px;font-weight:950;line-height:1;cursor:pointer;}
      .filter-row input,.filter-row select,.form-grid input,.form-grid select,.form-grid textarea,.stock-change input,.stock-edit-console input{width:100%;min-height:50px;border:1px solid var(--factory-line);background:#fff;border-radius:16px;padding:0 14px;font:inherit;font-size:14px;font-weight:800;color:var(--factory-ink);outline:0;}
      .form-grid textarea{min-height:92px;padding:12px 14px;resize:vertical;}
      .form-grid input:disabled,.form-grid textarea:disabled{background:#f8fafc;color:rgba(15,23,42,.55);cursor:not-allowed;}
      .view-toggle{height:50px;display:inline-flex;align-items:center;gap:3px;padding:4px;border-radius:16px;border:1px solid var(--factory-line);background:rgba(241,245,249,.92);}
      .view-toggle button{height:40px;border:0;background:transparent;border-radius:12px;padding:0 13px;font-weight:950;color:var(--factory-muted);cursor:pointer;}
      .view-toggle button.active{background:#fff;color:var(--factory-red);box-shadow:0 8px 20px rgba(15,23,42,.10);}
      .orders-board{display:grid;gap:14px;min-width:0;}
      .order-row,.invoice-row{display:grid;grid-template-columns:minmax(220px,1.45fr) .45fr .82fr .78fr .9fr .65fr minmax(110px,.78fr) 28px;align-items:center;gap:12px;border:1px solid var(--factory-line);background:#fff;border-radius:16px;padding:13px 14px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .invoice-row{grid-template-columns:1.4fr .8fr .8fr auto auto auto;cursor:default;}
      .order-row:hover,.invoice-row:hover,.stock-card:hover{border-color:rgba(180,35,24,.18);box-shadow:0 12px 30px rgba(15,23,42,.08);}
      .order-main{display:grid;gap:3px;min-width:0;}
      .order-main strong,.invoice-row strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--factory-ink);}
      .order-row span,.invoice-row span{color:var(--factory-muted);font-size:13px;font-weight:750;}
      .order-stat{display:inline-flex!important;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .order-stat svg{flex:0 0 auto;color:rgba(15,23,42,.42);}
      .order-total{font-size:14px;color:var(--factory-ink);white-space:nowrap;}
      .row-open{display:inline-flex!important;align-items:center;justify-content:center;color:rgba(15,23,42,.42);}
      .status-pill,.priority,.unread-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,.06);color:#475569;padding:5px 9px;font-size:11px!important;font-weight:950!important;text-transform:uppercase;white-space:nowrap;}
      .status-pill.out_for_delivery,.status-pill.awaiting_shipment,.priority.high{background:#fff7ed;color:#c2410c;}
      .status-pill.rejected,.stock-out_of_stock{background:#fef2f2!important;}
      .priority.normal{background:#ecfdf3;color:#027a48;}
      .priority.medium{background:#fff7ed;color:#c2410c;}
      .stock-state-chip{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:950;text-transform:uppercase;white-space:nowrap;background:#f8fafc;color:#475569;border:1px solid rgba(15,23,42,.08);}
      .stock-state-chip.success{background:#ecfdf3;color:#027a48;border-color:#abefc6;}
      .stock-state-chip.warning{background:#fffaeb;color:#b54708;border-color:#fedf89;}
      .stock-state-chip.danger{background:#fef3f2;color:#b42318;border-color:#fecdca;}
      .stock-state-chip.neutral{background:#f8fafc;color:#475569;border-color:#e2e8f0;}
      .stock-snapshot-table td:nth-child(n+2):nth-child(-n+5){text-align:right;font-weight:900;color:var(--factory-ink);}
      .stock-snapshot-table td:first-child strong{display:block;color:var(--factory-ink);font-size:13px;}
      .stock-snapshot-table td:first-child span,.stock-snapshot-table small{display:block;margin-top:3px;color:var(--factory-muted);font-size:12px;font-weight:780;}
      .stock-catalog-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .stock-catalog-list{display:grid;gap:10px;}
      .stock-card{position:relative;display:grid;gap:12px;border:1px solid var(--factory-line);background:#fff;border-radius:14px;padding:12px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .stock-catalog-list .stock-card{grid-template-columns:88px minmax(0,1fr) minmax(280px,.9fr) auto;align-items:center;}
      .stock-preview{height:112px;border-radius:16px;border:1px solid rgba(15,23,42,.06);background:linear-gradient(180deg,#f8fafc,#eef2f7);display:grid;place-items:center;color:rgba(15,23,42,.32);font-size:32px;font-weight:950;}
      .stock-preview img{width:100%;height:100%;object-fit:contain;border-radius:14px;background:#fff;}
      .stock-catalog-list .stock-preview{height:78px;}
      .stock-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;}
      .stock-card-copy{display:grid;gap:6px;min-width:0;}
      .stock-card-copy h3{margin:0;font-size:15px;line-height:1.2;letter-spacing:-.018em;color:var(--factory-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .stock-card-copy p,.stock-card-copy span,.stock-card-copy small{margin:0;color:var(--factory-muted);font-size:13px;font-weight:800;}
      .stock-card-copy span{font-size:12px;}
      .stock-card-copy small{font-size:12px;color:rgba(15,23,42,.48);}
      .stock-card-numbers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
      .stock-catalog-list .stock-card-numbers{grid-column:auto;}
      .stock-card-numbers div{min-height:64px;border:1px solid rgba(15,23,42,.06);border-radius:12px;padding:8px;background:#fff;display:grid;align-content:center;justify-items:start;gap:3px;}
      .stock-card-numbers svg{color:rgba(15,23,42,.44);}
      .stock-card-numbers span{display:block;color:var(--factory-muted);font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.05em;}
      .stock-card-numbers strong{display:block;font-size:18px;line-height:1;color:var(--factory-ink);letter-spacing:-.03em;}
      .quick-edit{width:30px;height:30px;border:1px solid rgba(15,23,42,.07);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:rgba(15,23,42,.54);background:#fff;}
      .stock-low_stock{background:#fffbeb;}
      .stock-out_of_stock{background:#fff5f5;}
      .stock-in_stock{background:#fff;}
      .factory-drawer-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.28);z-index:1000;display:flex;justify-content:flex-end;}
      .factory-drawer{height:100dvh;width:min(560px,100vw);background:#fff;border-left:1px solid var(--factory-line);box-shadow:-24px 0 70px rgba(15,23,42,.18);overflow:auto;padding:18px;display:grid;align-content:start;gap:14px;}
      .factory-drawer.wide{width:min(860px,100vw);}
      .drawer-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid var(--factory-line);padding-bottom:14px;}
      .drawer-head span{color:var(--factory-red);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .drawer-head h2{margin:4px 0 0;font-size:24px;letter-spacing:-.03em;color:var(--factory-ink);}
      .icon-btn{width:34px;height:34px;border:1px solid var(--factory-line);background:#fff;border-radius:12px;font-weight:950;cursor:pointer;}
      .stage-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid rgba(15,23,42,.08);background:linear-gradient(180deg,#fff,#f8fafc);border-radius:18px;padding:14px;}
      .stage-banner div{display:grid;gap:3px;min-width:0;}
      .stage-banner span:first-child{color:var(--factory-red);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .stage-banner strong{font-size:18px;color:var(--factory-ink);letter-spacing:-.025em;}
      .stage-banner small{color:var(--factory-muted);font-weight:780;line-height:1.35;}
      .drawer-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}
      .drawer-actions.sticky{position:sticky;top:-18px;background:#fff;z-index:2;padding:10px 0;border-bottom:1px solid var(--factory-line);}
      .drawer-stage-note{display:inline-flex;align-items:center;min-height:38px;border-radius:999px;background:rgba(15,23,42,.055);color:var(--factory-muted);padding:0 12px;font-size:12px;font-weight:950;}
      .drawer-section{display:grid;gap:12px;border:1px solid var(--factory-line);border-radius:16px;background:#fff;padding:15px;box-shadow:0 1px 2px rgba(15,23,42,.035);}
      .drawer-section-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
      .drawer-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
      .drawer-section-head span{display:block;color:var(--factory-red);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .drawer-section-head h3{margin:3px 0 0;color:var(--factory-ink);font-size:17px;letter-spacing:-.02em;}
      .workflow-section{background:linear-gradient(180deg,#fff,#f8fafc);}
      .drawer-hint{margin:0;color:var(--factory-muted);font-size:13px;font-weight:780;line-height:1.55;}
      .ready-line.success{background:#ecfdf3;color:#027a48;}
      .shipment-form{grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;}
      .shipment-form label:last-child{grid-column:1 / -1;}
      .correction-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;}
      .reject-panel{align-content:start;}
      .factory-drawer details,.factory-page details{border:1px solid var(--factory-line);border-radius:16px;background:#fff;padding:0;overflow:hidden;}
      .factory-drawer summary,.factory-page summary{cursor:pointer;padding:13px 15px;font-weight:950;color:var(--factory-ink);}
      .factory-drawer details>div,.factory-page details>div,.factory-drawer details>.table-wrap{padding:0 15px 15px;}
      .checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .checklist label{display:flex;gap:8px;align-items:center;background:var(--factory-soft);border-radius:12px;padding:10px;font-weight:850;}
      .checklist label.ready{background:#ecfdf3;color:#027a48;}
      .info-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 12px;}
      .info-grid span,.stock-change span{color:var(--factory-muted);font-weight:850;}
      .form-grid{display:grid;gap:10px;}
      .form-grid label{display:grid;gap:6px;font-weight:850;color:var(--factory-ink);}
      .table-wrap{overflow:auto;background:#fff;border:1px solid var(--factory-line);border-radius:16px;}
      .dense-table{width:100%;border-collapse:collapse;font-size:14px;}
      .dense-table th,.dense-table td{border-bottom:1px solid rgba(15,23,42,.06);padding:11px 12px;text-align:left;vertical-align:middle;}
      .dense-table th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--factory-muted);background:rgba(248,250,252,.9);}
      .stock-table-wrap{box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .stock-table{min-width:860px;}
      .stock-table-row{cursor:pointer;transition:background .14s ease, box-shadow .14s ease;}
      .stock-table-row:hover,.stock-table-row:focus{background:rgba(180,35,24,.035);outline:0;}
      .stock-table-row.stock-low_stock{background:#fffbeb;}
      .stock-table-row.stock-low_stock:hover,.stock-table-row.stock-low_stock:focus{background:#fff7d6;}
      .stock-table-row.stock-out_of_stock{background:#fff5f5;}
      .stock-table-row.stock-out_of_stock:hover,.stock-table-row.stock-out_of_stock:focus{background:#feecec;}
      .stock-table td{font-size:13px;font-weight:800;color:rgba(15,23,42,.72);white-space:nowrap;}
      .stock-table td:first-child{min-width:340px;white-space:normal;}
      .stock-table-product{display:flex;align-items:center;gap:11px;min-width:0;}
      .stock-table-product>span:not(.stock-table-thumb){display:grid;gap:3px;min-width:0;flex:1 1 auto;}
      .stock-table-product strong{display:block;color:var(--factory-ink);font-size:14px;line-height:1.25;}
      .stock-table-product small{display:block;color:var(--factory-muted);font-size:12px;font-weight:800;}
      .stock-table-thumb{width:44px;height:44px;flex:0 0 44px;border-radius:12px;border:1px solid rgba(15,23,42,.07);background:linear-gradient(180deg,#f8fafc,#eef2f7);display:grid;place-items:center;overflow:hidden;color:rgba(15,23,42,.36);}
      .stock-table-thumb img{width:100%;height:100%;object-fit:contain;background:#fff;}
      .stock-table-thumb strong{font-size:17px;color:rgba(15,23,42,.42);}
      .table-action-btn{width:36px;height:36px;border:1px solid var(--factory-line);background:#fff;border-radius:12px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--factory-ink);cursor:pointer;flex:0 0 36px;}
      .table-action-btn:hover{border-color:rgba(180,35,24,.22);color:var(--factory-red);}
      .stock-change{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      .stock-change>div{display:grid;gap:6px;border:1px solid var(--factory-line);border-radius:16px;padding:12px;background:#fff;}
      .stock-change strong{font-size:24px;letter-spacing:-.04em;color:var(--factory-ink);}
      .stock-edit-console{display:grid;gap:13px;border:1px solid rgba(15,23,42,.08);background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);border-radius:18px;padding:14px;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .stock-edit-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
      .stock-edit-head strong{display:block;font-size:16px;font-weight:950;color:var(--factory-ink);letter-spacing:-.02em;}
      .stock-edit-head span{display:block;margin-top:4px;font-size:12px;font-weight:750;line-height:1.45;color:var(--factory-muted);}
      .stock-edit-mode{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;padding:4px;border:1px solid var(--factory-line);border-radius:999px;background:rgba(241,245,249,.92);}
      .stock-edit-mode button{height:34px;border:0;background:transparent;border-radius:999px;padding:0 12px;font-size:12px;font-weight:950;color:var(--factory-muted);cursor:pointer;}
      .stock-edit-mode button.active{background:#fff;color:var(--factory-red);box-shadow:0 8px 20px rgba(15,23,42,.10);}
      .stock-step-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;}
      .stock-step-grid button{min-height:44px;border:1px solid var(--factory-line);border-radius:14px;background:#fff;font-size:14px;font-weight:950;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .stock-step-grid button.plus{background:rgba(236,253,243,.86);color:#027a48;border-color:rgba(2,122,72,.16);}
      .stock-step-grid button.minus{background:rgba(254,242,242,.86);color:#b42318;border-color:rgba(180,35,24,.16);}
      .stock-custom-adjust{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:end;}
      .stock-custom-adjust label,.exact-stock-input{display:grid;gap:6px;font-size:12px;font-weight:950;letter-spacing:.04em;text-transform:uppercase;color:var(--factory-muted);}
      .stock-custom-adjust button,.stock-reset-btn{min-height:50px;border:1px solid var(--factory-line);background:#fff;border-radius:16px;padding:0 14px;font-weight:950;color:var(--factory-ink);cursor:pointer;}
      .stock-custom-adjust button:last-child{background:linear-gradient(135deg,#b91c1c 0%,#dd5127 100%);border-color:transparent;color:#fff;}
      .stock-reset-btn{justify-self:start;min-height:40px;background:transparent;color:var(--factory-muted);}
      .positive{color:#027a48!important;}
      .negative{color:#b42318!important;}
      .confirm-box{display:grid;gap:10px;border:1px solid rgba(180,35,24,.22);background:#fff7f5;border-radius:16px;padding:14px;}
      .stock-import-panel{display:grid;gap:14px;padding:16px;}
      .stock-import-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:12px;border-bottom:1px solid rgba(15,23,42,.07);}
      .stock-import-head span{display:block;color:var(--factory-red);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .stock-import-head h2{margin:4px 0 0;color:var(--factory-ink);font-size:18px;line-height:1.2;letter-spacing:-.025em;}
      .stock-import-head p{margin:5px 0 0;color:var(--factory-muted);font-size:13px;font-weight:750;line-height:1.55;}
      .format-help{position:relative;flex:0 0 auto;}
      .format-help>button{width:32px;height:32px;border-radius:999px;border:1px solid rgba(15,23,42,.09);background:#fff;color:rgba(15,23,42,.62);font-size:14px;font-weight:950;font-family:Georgia,serif;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .format-help>button:hover,.format-help>button:focus{border-color:rgba(180,35,24,.2);color:var(--factory-red);outline:0;}
      .format-popover{position:absolute;top:40px;right:0;width:min(340px,calc(100vw - 42px));z-index:12;border:1px solid rgba(15,23,42,.1);border-radius:16px;background:#fff;padding:14px;box-shadow:0 22px 60px rgba(15,23,42,.16);opacity:0;pointer-events:none;transform:translateY(-4px);transition:opacity .15s ease, transform .15s ease;}
      .format-help:hover .format-popover,.format-help:focus-within .format-popover{opacity:1;pointer-events:auto;transform:translateY(0);}
      .format-popover strong{display:block;color:var(--factory-ink);font-size:14px;}
      .format-popover p,.format-popover small{display:block;margin:6px 0 0;color:var(--factory-muted);font-size:12px;font-weight:750;line-height:1.5;}
      .format-popover table{width:100%;margin-top:10px;border-collapse:collapse;font-size:12px;}
      .format-popover th,.format-popover td{border:1px solid rgba(15,23,42,.08);padding:7px 8px;text-align:left;}
      .format-popover th{background:#f8fafc;color:rgba(15,23,42,.58);font-size:10px;text-transform:uppercase;letter-spacing:.08em;}
      .stock-import-grid{display:grid;grid-template-columns:minmax(260px,1.2fr) .65fr .9fr;gap:10px;align-items:end;}
      .stock-import-grid label{display:grid;gap:7px;color:var(--factory-ink);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.04em;}
      .stock-import-grid select,.stock-import-grid input:not([type="file"]){width:100%;min-height:48px;border:1px solid var(--factory-line);background:#fff;border-radius:14px;padding:0 13px;font:inherit;font-size:14px;font-weight:800;color:var(--factory-ink);outline:0;text-transform:none;letter-spacing:0;}
      .stock-file-drop{position:relative;min-height:74px;border:1px dashed rgba(15,23,42,.22);border-radius:16px;background:linear-gradient(180deg,#fff,#f8fafc);padding:13px 15px;display:grid!important;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:12px;cursor:pointer;text-transform:none!important;letter-spacing:0!important;}
      .stock-file-drop:hover{border-color:rgba(180,35,24,.28);background:#fff7f5;}
      .stock-file-drop>svg{color:var(--factory-red);}
      .stock-file-drop span{display:grid;gap:3px;}
      .stock-file-drop strong{font-size:14px;color:var(--factory-ink);}
      .stock-file-drop small{font-size:12px;line-height:1.45;color:var(--factory-muted);font-weight:750;}
      .stock-file-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;}
      .import-summary{display:flex;gap:8px;flex-wrap:wrap;}
      .import-summary span{display:inline-flex;align-items:center;min-height:30px;border-radius:999px;background:rgba(15,23,42,.055);color:rgba(15,23,42,.66);padding:0 11px;font-size:12px;font-weight:950;}
      .import-preview tr.invalid{background:#fef2f2;}
      .notification-list.compact .notification-row{grid-template-columns:1fr;}
      .notification-row{display:grid;grid-template-columns:1fr 1fr 90px;gap:12px;align-items:center;background:#fff;border:1px solid var(--factory-line);border-radius:14px;padding:12px;}
      .empty-line{background:#fff;border:1px dashed rgba(15,23,42,.18);border-radius:16px;padding:18px;text-align:center;color:var(--factory-muted);font-weight:850;}
      .proforma-copy{page-break-after:always;border:1px solid #d1d5db;padding:22px;margin-bottom:18px;background:#fff;color:#111827;}
      .proforma-copy header{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:12px;}
      .proforma-copy h1{margin:0;font-size:26px;letter-spacing:.08em;}
      .proforma-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px;}
      .proforma-total{display:grid;justify-items:end;gap:5px;margin-top:12px;}
      .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:46px;}
      .signatures span{border-top:1px solid #111827;text-align:center;padding-top:8px;}
      @media (max-width: 1280px){
        .stock-catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
      }
      @media (max-width: 980px){
        .metric-strip,.factory-overview-grid,.split-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
        .stock-catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
        .orders-filter-row,.stock-filter-row,.history-filter-row,.invoice-filter-row,.stock-import-grid,.filter-row.single,.stock-change,.order-row,.invoice-row,.info-grid,.drawer-section-grid,.shipment-form,.correction-grid,.stock-catalog-list .stock-card{grid-template-columns:1fr;}
        .stock-import-head{display:grid;}
        .format-popover{right:auto;left:0;}
        .stock-card-numbers,.stock-catalog-list .stock-card-numbers{grid-column:1 / -1;}
        .stock-step-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
        .stock-custom-adjust{grid-template-columns:1fr;}
        .stock-edit-head{display:grid;}
        .factory-drawer,.factory-drawer.wide{width:100vw;}
        .checklist{grid-template-columns:1fr;}
      }
      @media (max-width: 640px){
        .metric-strip,.factory-overview-grid,.split-grid,.stock-catalog-grid,.stock-card,.stock-card-numbers{grid-template-columns:1fr;}
        .stock-preview{height:92px;}
        .factory-tabs{border-radius:16px;width:100%;}
      }
      @media print{
        body *{visibility:hidden!important;}
        .invoice-print-area,.invoice-print-area *{visibility:visible!important;}
        .invoice-print-area{position:absolute;inset:0;background:#fff;}
        .no-print,.drawer-head,.drawer-actions{display:none!important;}
        .factory-drawer-backdrop,.factory-drawer{position:static!important;display:block!important;box-shadow:none!important;padding:0!important;overflow:visible!important;width:100%!important;}
      }
    `}</style>
  );
}

export default FactoryDashboardPage;
