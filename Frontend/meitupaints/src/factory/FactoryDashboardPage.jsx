import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider.jsx";
import {
  useAmendFactoryOrderMutation,
  useBulkUpdateStockMutation,
  useGetAllStockHistoryQuery,
  useGetFactoryDashboardQuery,
  useGetFactoryOrdersQuery,
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
  OVERVIEW: "overview",
  ORDERS: "orders",
  STOCK: "stock",
  INVOICES: "invoices",
  STOCK_HISTORY: "stock-history",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
};

const ROUTES = {
  [SECTIONS.OVERVIEW]: "/factory/dashboard",
  [SECTIONS.ORDERS]: "/factory/dashboard/orders",
  [SECTIONS.STOCK]: "/factory/dashboard/stock",
  [SECTIONS.INVOICES]: "/factory/dashboard/invoices",
  [SECTIONS.STOCK_HISTORY]: "/factory/dashboard/stock-history",
  [SECTIONS.NOTIFICATIONS]: "/factory/dashboard/notifications",
  [SECTIONS.PROFILE]: "/factory/dashboard/profile",
};

const SIDEBAR_ITEMS = [
  { key: SECTIONS.OVERVIEW, label: "Overview" },
  { key: SECTIONS.ORDERS, label: "Orders" },
  { key: SECTIONS.STOCK, label: "Stock" },
  { key: SECTIONS.INVOICES, label: "Invoices" },
  { key: SECTIONS.STOCK_HISTORY, label: "Stock History" },
  { key: SECTIONS.NOTIFICATIONS, label: "Notifications" },
  { key: SECTIONS.PROFILE, label: "Profile" },
];

const ORDER_LANES = [
  { key: "INBOX", label: "Inbox" },
  { key: "PREPARING", label: "Preparing" },
  { key: "AWAITING_SHIPMENT", label: "Awaiting Shipment" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVE", label: "Archive" },
];

const STOCK_REASONS = [
  "Manual Count",
  "Stock Received",
  "Correction",
  "Damage",
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
  if (status === "PROCESSING") return "PREPARING";
  if (status === "AWAITING_SHIPMENT" || status === "VERIFIED") return "INBOX";
  if (status === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "REJECTED") return "REJECTED";
  if (["CLOSED", "CANCELLED"].includes(status)) return "ARCHIVE";
  return "INBOX";
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
          <button type="button" onClick={onClose} className="icon-btn">x</button>
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

function FactoryShell({ active, globalSearch, setGlobalSearch, children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="factory-workspace">
      <aside className="factory-sidebar">
        <div className="factory-brand">
          <div className="factory-logo">M</div>
          <div>
            <strong>Meitu Factory</strong>
            <span>Operations</span>
          </div>
        </div>
        <div className="sidebar-title">Factory Dashboard</div>
        <nav className="factory-sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              className={active === item.key ? "active" : ""}
              type="button"
              onClick={() => navigate(ROUTES[item.key])}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="factory-sidebar-footer">
          <span>{user?.email || user?.username || "Factory"}</span>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="factory-main">
        <header className="factory-topbar">
          <div>
            <span>Global Search</span>
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Dealer, SKU, order, invoice, product, driver"
            />
          </div>
          <div className="topbar-status">
            <span>Staging ready</span>
            <strong>{new Date().toLocaleDateString()}</strong>
          </div>
        </header>
        <section className="factory-scroll">{children}</section>
      </main>
      <FactoryStyles />
    </div>
  );
}

function OverviewPage({ globalSearch, onNavigate }) {
  const dashboard = useGetFactoryDashboardQuery();
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: globalSearch, limit: 20 });
  const historyQuery = useGetAllStockHistoryQuery({ q: globalSearch, limit: 20 });
  const orders = ordersQuery.data?.items || [];
  const history = historyQuery.data?.items || [];
  const summary = dashboard.data || {};
  const today = todayKey();
  const todayDispatches = orders.filter(
    (order) =>
      order.status === "OUT_FOR_DELIVERY" &&
      todayKey(order.factory?.outForDeliveryAt || order.updatedAt) === today,
  ).length;
  const activity = makeActivity({ orders, history });

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
      label: "Today's Dispatches",
      value: todayDispatches,
      onClick: () => onNavigate(SECTIONS.ORDERS),
    },
  ];

  return (
    <div className="factory-page">
      <div className="page-head">
        <div>
          <p>Overview</p>
          <h1>Operational control room</h1>
        </div>
        <button type="button" onClick={() => {
          dashboard.refetch();
          ordersQuery.refetch();
          historyQuery.refetch();
        }}>
          {dashboard.isFetching || ordersQuery.isFetching || historyQuery.isFetching
            ? "Updating"
            : "Refresh"}
        </button>
      </div>
      <MetricStrip items={metrics} />
      <div className="split-grid">
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

function OrderDrawer({ order, onClose, onInvoice }) {
  const [driverName, setDriverName] = useState(order?.factory?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(order?.factory?.driverPhone || "");
  const [vehicleNumber, setVehicleNumber] = useState(order?.factory?.vehicleNumber || "");
  const [remarks, setRemarks] = useState(order?.factory?.remarks || "");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState({
    stock: false,
    packing: false,
    invoice: false,
    driver: Boolean(order?.factory?.driverName),
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
  const readyForShipment =
    Object.values(checklist).every(Boolean) && driverName.trim() && driverPhone.trim();

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Action failed.");
    }
  };

  const toggleChecklist = (key) => {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Drawer
      title={order.orderNumber}
      eyebrow={`${order.dealerSnapshot?.companyName || "Dealer"} - ${statusLabel(order.status)}`}
      onClose={onClose}
      wide
    >
      <div className="drawer-actions sticky">
        <button
          type="button"
          onClick={() =>
            run(() =>
              startPreparing({ orderId: order._id, payload: { note: remarks } }).unwrap(),
            )
          }
          disabled={busy}
        >
          Prepare Order
        </button>
        <button type="button" onClick={() => onInvoice(order._id)}>
          Generate Proforma
        </button>
        <button
          type="button"
          disabled={busy || !readyForShipment}
          onClick={() =>
            run(() =>
              markOut({
                orderId: order._id,
                payload: { driverName, driverPhone, vehicleNumber, remarks },
              }).unwrap(),
            )
          }
        >
          Mark Out For Delivery
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              markDelivered({ orderId: order._id, payload: { note: remarks } }).unwrap(),
            )
          }
        >
          Mark Delivered
        </button>
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
          Reject
        </button>
      </div>
      {error ? <div className="alert-line">{error}</div> : null}
      <details open>
        <summary>Order Preparation</summary>
        <div className="checklist">
          {[
            ["stock", "Stock Available"],
            ["packing", "Packing Complete"],
            ["invoice", "Invoice Generated"],
            ["driver", "Driver Assigned"],
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
        </div>
        <div className="ready-line">
          {readyForShipment ? "Ready for shipment" : "Complete checklist and driver details"}
        </div>
      </details>
      <details open>
        <summary>Dealer Information</summary>
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
      </details>
      <details open>
        <summary>Product List</summary>
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
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Order Summary and Payment</summary>
        <div className="info-grid">
          <span>Products</span>
          <strong>{productCount(order)}</strong>
          <span>Total</span>
          <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
          <span>Payment Method</span>
          <strong>{order.payment?.method || "-"}</strong>
          <span>Payment Reference</span>
          <strong>{order.payment?.reference || "-"}</strong>
        </div>
      </details>
      <details>
        <summary>Driver Assignment</summary>
        <div className="form-grid">
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
      </details>
      <details>
        <summary>Internal Notes and Rejection</summary>
        <div className="form-grid">
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
            onClick={() => {
              const reason = window.prompt("Factory amendment reason:", "");
              if (!reason) return;
              run(() =>
                amendOrder({
                  orderId: order._id,
                  payload: { reason, note: remarks },
                }).unwrap(),
              );
            }}
          >
            Amend Order
          </button>
        </div>
      </details>
      <details>
        <summary>History Timeline</summary>
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
        </div>
      </details>
    </Drawer>
  );
}

function OrdersPage({ globalSearch, onInvoice }) {
  const [lane, setLane] = useState("INBOX");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [dealer, setDealer] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const effectiveSearch = query || globalSearch;
  const listQuery = useGetFactoryOrdersQuery({
    stage: ["AWAITING_SHIPMENT", "ARCHIVE"].includes(lane) ? "ALL" : lane,
    q: effectiveSearch,
    limit: 100,
  });
  const allQuery = useGetFactoryOrdersQuery({ stage: "ALL", limit: 100 });
  const allOrders = allQuery.data?.items || [];
  const counts = ORDER_LANES.reduce((acc, item) => {
    acc[item.key] = allOrders.filter((order) => {
      if (item.key === "AWAITING_SHIPMENT") {
        return ["AWAITING_SHIPMENT", "VERIFIED"].includes(String(order.status || "").toUpperCase());
      }
      if (item.key === "ARCHIVE") {
        return ["DELIVERED", "REJECTED", "CLOSED", "CANCELLED"].includes(
          String(order.status || "").toUpperCase(),
        );
      }
      return laneForOrder(order) === item.key;
    }).length;
    return acc;
  }, {});
  const items = (listQuery.data?.items || []).filter((order) => {
    const orderLane = laneForOrder(order);
    if (lane === "AWAITING_SHIPMENT") {
      if (!["AWAITING_SHIPMENT", "VERIFIED"].includes(String(order.status || "").toUpperCase())) return false;
    } else if (lane === "ARCHIVE") {
      if (!["DELIVERED", "REJECTED", "CLOSED", "CANCELLED"].includes(String(order.status || "").toUpperCase())) return false;
    } else if (orderLane !== lane) {
      return false;
    }
    if (date && todayKey(order.createdAt) !== date) return false;
    if (dealer && !String(order.dealerSnapshot?.companyName || "").toLowerCase().includes(dealer.toLowerCase())) return false;
    if (priority !== "ALL" && priorityForOrder(order) !== priority) return false;
    return true;
  });

  return (
    <div className="factory-page orders-layout">
      <aside className="orders-lanes">
        {ORDER_LANES.map((item) => (
          <button
            key={item.key}
            className={lane === item.key ? "active" : ""}
            type="button"
            onClick={() => setLane(item.key)}
          >
            <span>{item.label}</span>
            <strong>{counts[item.key] || 0}</strong>
          </button>
        ))}
      </aside>
      <section className="orders-board">
        <div className="page-head compact">
          <div>
            <p>Orders</p>
            <h1>Factory inbox</h1>
          </div>
          <button type="button" onClick={listQuery.refetch}>
            {listQuery.isFetching ? "Updating" : "Refresh"}
          </button>
        </div>
        <div className="filter-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input value={dealer} onChange={(event) => setDealer(event.target.value)} placeholder="Dealer" />
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="ALL">Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Normal">Normal</option>
          </select>
        </div>
        <div className="order-list">
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
              <span>{productCount(order)} Products</span>
              <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
              <span>{compactDate(order.createdAt)}</span>
              <span className={`status-pill ${String(order.status || "").toLowerCase()}`}>
                {statusLabel(order.status)}
              </span>
              <span className={`priority ${priorityForOrder(order).toLowerCase()}`}>
                {priorityForOrder(order)}
              </span>
              <span>{order.factory?.driverName || "-"}</span>
              <span>{timeAgo(order.factory?.sentToFactoryAt || order.updatedAt || order.createdAt)}</span>
            </button>
          ))}
          {!items.length ? <div className="empty-line">No orders in this lane.</div> : null}
        </div>
      </section>
      {selected ? (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onInvoice={onInvoice}
        />
      ) : null}
    </div>
  );
}

function StockEditDrawer({ product, onClose }) {
  const [newStock, setNewStock] = useState(product?.stock?.currentQuantity || 0);
  const [threshold, setThreshold] = useState(product?.stock?.lowStockThreshold || 0);
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

  const save = async () => {
    setError("");
    try {
      await updateStock({
        productId: product.productId || product._id,
        payload: { newQuantity: next, reason, note },
      }).unwrap();
      if (Number(threshold) !== Number(product?.stock?.lowStockThreshold || 0)) {
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
          <input type="number" min="0" value={newStock} onChange={(event) => setNewStock(event.target.value)} />
        </div>
        <div>
          <span>Difference</span>
          <strong className={delta < 0 ? "negative" : "positive"}>{delta >= 0 ? `+${delta}` : delta}</strong>
        </div>
      </div>
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
          <input type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
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
          <span>Reason: {reason}</span>
          <div className="drawer-actions">
            <button type="button" onClick={() => setConfirming(false)}>Back</button>
            <button type="button" onClick={save} disabled={stockState.isLoading || thresholdState.isLoading}>
              Confirm Save
            </button>
          </div>
        </div>
      ) : (
        <div className="drawer-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={() => setConfirming(true)}>Review Change</button>
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
    <details className="bulk-panel">
      <summary>Bulk Stock Update</summary>
      <p>Import a CSV exported from Excel. Preview changes before saving.</p>
      <div className="filter-row">
        <input type="file" accept=".csv,text/csv" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) parseFile(file);
        }} />
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          {STOCK_REASONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Import note" />
      </div>
      {error ? <div className="alert-line">{error}</div> : null}
      {rows.length ? (
        <>
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
    </details>
  );
}

function StockPage({ globalSearch }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const effectiveSearch = query || globalSearch;
  const stockQuery = useGetStockQuery({ q: effectiveSearch, category, status, limit: 150 });
  const items = stockQuery.data?.items || [];
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Stock</p>
          <h1>Inventory rows</h1>
        </div>
        <button type="button" onClick={stockQuery.refetch}>
          {stockQuery.isFetching ? "Updating" : "Refresh"}
        </button>
      </div>
      <div className="filter-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, category" />
        <input value={category} list="factory-categories" onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
        <datalist id="factory-categories">
          {categories.map((item) => <option value={item} key={item} />)}
        </datalist>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">All stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out Of Stock</option>
          <option value="IN_STOCK">In Stock</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="dense-table stock-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th>Current</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Status</th>
              <th>Quick Edit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id || item.sku} className={`stock-${String(item.stock?.status || "").toLowerCase()}`}>
                <td><strong>{item.name}</strong></td>
                <td>{item.packLabel || item.pack?.label || "-"}</td>
                <td>{item.sku}</td>
                <td>{item.stock?.currentQuantity || 0}</td>
                <td>{item.stock?.reservedQuantity || 0}</td>
                <td>{item.stock?.availableQuantity || 0}</td>
                <td><span className="status-pill">{statusLabel(item.stock?.status)}</span></td>
                <td><button type="button" onClick={() => setSelected(item)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <div className="empty-line">No stock rows found.</div> : null}
      </div>
      <BulkImportPanel products={items} />
      {selected ? <StockEditDrawer product={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function StockHistoryPage({ globalSearch }) {
  const [query, setQuery] = useState("");
  const effectiveSearch = query || globalSearch;
  const historyQuery = useGetAllStockHistoryQuery({ q: effectiveSearch, limit: 120 });
  const items = historyQuery.data?.items || [];

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Stock History</p>
          <h1>Audit timeline</h1>
        </div>
        <button type="button" onClick={historyQuery.refetch}>
          {historyQuery.isFetching ? "Updating" : "Refresh"}
        </button>
      </div>
      <div className="filter-row single">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, reason, order" />
      </div>
      <div className="audit-timeline">
        {items.map((row) => (
          <div key={row._id} className="audit-row">
            <time>{compactDate(row.changedAt)}</time>
            <strong>{row.productName || row.sku}</strong>
            <span>{row.previousQuantity}</span>
            <span>{row.newQuantity}</span>
            <span className={Number(row.delta || 0) < 0 ? "negative" : "positive"}>
              {Number(row.delta || 0) >= 0 ? `+${row.delta || 0}` : row.delta}
            </span>
            <span>{row.reason}</span>
            <span>{row.changedBy?.username || row.changedBy?.email || row.changedByRole || "-"}</span>
          </div>
        ))}
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
        <button type="button" onClick={() => window.print()}>Print</button>
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
  const [query, setQuery] = useState("");
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: query || globalSearch, limit: 100 });
  const orders = ordersQuery.data?.items || [];

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Proforma Invoices</p>
          <h1>Recent invoice-ready orders</h1>
        </div>
      </div>
      <div className="filter-row single">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dealer, order, invoice" />
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
            <button type="button" onClick={() => onInvoice(order._id)}>Preview</button>
            <button type="button" onClick={() => onInvoice(order._id)}>Print</button>
            <button type="button" onClick={() => onInvoice(order._id)}>Duplicate</button>
          </div>
        ))}
        {!orders.length ? <div className="empty-line">No invoices available.</div> : null}
      </div>
    </div>
  );
}

function NotificationsPage({ globalSearch }) {
  const ordersQuery = useGetFactoryOrdersQuery({ stage: "ALL", q: globalSearch, limit: 30 });
  const historyQuery = useGetAllStockHistoryQuery({ q: globalSearch, limit: 30 });
  const activity = makeActivity({
    orders: ordersQuery.data?.items || [],
    history: historyQuery.data?.items || [],
  });

  return (
    <div className="factory-page">
      <div className="page-head compact">
        <div>
          <p>Notifications</p>
          <h1>Operational alerts</h1>
        </div>
        <span className="unread-badge">{activity.length} unread</span>
      </div>
      <div className="notification-list">
        {activity.map((item) => (
          <div className="notification-row" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
            <time>{timeAgo(item.at)}</time>
          </div>
        ))}
        {!activity.length ? <div className="empty-line">No notifications.</div> : null}
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
  const [globalSearch, setGlobalSearch] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [loadInvoice, invoiceState] = useLazyGetProformaInvoiceQuery();
  const active = sectionFromPath(location.pathname);

  const goTo = (key) => navigate(ROUTES[key] || ROUTES.overview);
  const openInvoice = async (orderId) => {
    const item = await loadInvoice(orderId).unwrap();
    setInvoice(item);
  };

  return (
    <FactoryShell active={active} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch}>
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
      :root{--factory-red:#c42318;--factory-ink:#111827;--factory-muted:#6b7280;--factory-line:#e5e7eb;--factory-soft:#f6f7f9;}
      .factory-workspace{min-height:100vh;background:#f5f6f8;color:var(--factory-ink);display:grid;grid-template-columns:248px minmax(0,1fr);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
      .factory-sidebar{position:sticky;top:0;height:100vh;background:#fff;border-right:1px solid var(--factory-line);display:flex;flex-direction:column;padding:18px 14px;z-index:20;}
      .factory-brand{display:flex;gap:10px;align-items:center;padding:8px 8px 18px;}
      .factory-logo{width:36px;height:36px;border-radius:10px;background:var(--factory-red);color:#fff;display:grid;place-items:center;font-weight:950;}
      .factory-brand strong{display:block;font-size:15px;letter-spacing:.02em;}
      .factory-brand span,.sidebar-title,.factory-sidebar-footer span,.factory-topbar span{font-size:12px;color:var(--factory-muted);font-weight:800;text-transform:uppercase;letter-spacing:.08em;}
      .sidebar-title{padding:8px;margin-bottom:8px;}
      .factory-sidebar-nav{display:grid;gap:2px;}
      .factory-sidebar-nav button,.factory-sidebar-footer button{border:0;background:transparent;text-align:left;padding:10px 12px;border-radius:8px;font-weight:850;color:#374151;cursor:pointer;}
      .factory-sidebar-nav button:hover,.factory-sidebar-nav button.active{background:#f3f4f6;color:var(--factory-red);}
      .factory-sidebar-footer{margin-top:auto;display:grid;gap:8px;padding:12px 8px;border-top:1px solid var(--factory-line);}
      .factory-sidebar-footer button{background:#fff1f0;color:var(--factory-red);text-align:center;}
      .factory-main{height:100vh;overflow:hidden;display:grid;grid-template-rows:auto 1fr;}
      .factory-topbar{height:72px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--factory-line);display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 22px;}
      .factory-topbar>div:first-child{display:grid;gap:4px;width:min(680px,70%);}
      .factory-topbar input,.filter-row input,.filter-row select,.form-grid input,.form-grid select,.form-grid textarea,.stock-change input{width:100%;border:1px solid var(--factory-line);background:#fff;border-radius:9px;padding:10px 12px;font:inherit;font-weight:700;}
      .factory-scroll{overflow:auto;padding:22px;}
      .factory-page{display:grid;gap:16px;max-width:1440px;margin:0 auto;}
      .page-head{display:flex;justify-content:space-between;align-items:center;gap:14px;}
      .page-head.compact h1{font-size:26px;}
      .page-head p{margin:0 0 4px;color:var(--factory-red);font-size:12px;text-transform:uppercase;font-weight:950;letter-spacing:.12em;}
      .page-head h1{margin:0;font-size:34px;line-height:1.05;letter-spacing:-.02em;}
      button{font:inherit;}
      .page-head button,.drawer-actions button,.filter-row button,.dense-table button,.invoice-row button{border:1px solid var(--factory-line);background:#fff;border-radius:9px;padding:9px 12px;font-weight:850;cursor:pointer;}
      .drawer-actions button:last-child,.page-head button{background:var(--factory-red);border-color:var(--factory-red);color:#fff;}
      .drawer-actions button.danger,.danger{background:#991b1b!important;border-color:#991b1b!important;color:#fff!important;}
      .metric-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;}
      .metric-strip button{border:1px solid var(--factory-line);background:#fff;border-radius:10px;padding:12px;text-align:left;cursor:pointer;}
      .metric-strip span{display:block;color:var(--factory-muted);font-size:12px;font-weight:850;}
      .metric-strip strong{display:block;margin-top:6px;font-size:24px;}
      .split-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;}
      .plain-section,.bulk-panel{background:#fff;border:1px solid var(--factory-line);border-radius:10px;padding:16px;}
      .section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
      .section-head h2{margin:0;font-size:18px;}
      .section-head button{border:0;background:transparent;color:var(--factory-red);font-weight:900;cursor:pointer;}
      .timeline-list,.notification-list{display:grid;gap:8px;}
      .timeline-item,.notification-row{display:grid;grid-template-columns:84px minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid #f0f1f3;}
      .timeline-item time,.notification-row time{color:var(--factory-muted);font-size:12px;font-weight:850;}
      .timeline-item div,.notification-row{min-width:0;}
      .timeline-item strong,.notification-row strong{display:block;font-size:14px;}
      .timeline-item span,.notification-row span{display:block;color:var(--factory-muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .orders-layout{grid-template-columns:220px minmax(0,1fr);display:grid;align-items:start;}
      .orders-lanes{position:sticky;top:0;background:#fff;border:1px solid var(--factory-line);border-radius:10px;padding:8px;display:grid;gap:2px;}
      .orders-lanes button{border:0;background:transparent;border-radius:8px;padding:10px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;font-weight:850;}
      .orders-lanes button.active{background:#fff1f0;color:var(--factory-red);}
      .orders-board{display:grid;gap:12px;min-width:0;}
      .filter-row{display:grid;grid-template-columns:1.4fr .7fr .8fr .7fr;gap:8px;}
      .filter-row.single{grid-template-columns:1fr;}
      .order-list{display:grid;gap:6px;}
      .order-row,.invoice-row{display:grid;grid-template-columns:1.5fr .75fr .8fr .8fr .9fr .7fr .8fr .8fr;align-items:center;gap:10px;border:1px solid var(--factory-line);background:#fff;border-radius:8px;padding:10px 12px;text-align:left;cursor:pointer;}
      .invoice-row{grid-template-columns:1.5fr .8fr .8fr auto auto auto;cursor:default;}
      .order-main{display:grid;gap:2px;min-width:0;}
      .order-main strong,.invoice-row strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .order-row span,.invoice-row span{color:var(--factory-muted);font-size:13px;font-weight:750;}
      .status-pill,.priority,.unread-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#f3f4f6;color:#374151;padding:5px 8px;font-size:11px!important;font-weight:950!important;text-transform:uppercase;white-space:nowrap;}
      .status-pill.out_for_delivery,.status-pill.awaiting_shipment,.priority.high{background:#fff7ed;color:#c2410c;}
      .status-pill.rejected,.stock-out_of_stock{background:#fef2f2!important;}
      .priority.normal{background:#ecfdf3;color:#027a48;}
      .priority.medium{background:#fff7ed;color:#c2410c;}
      .factory-drawer-backdrop{position:fixed;inset:0;background:rgba(17,24,39,.26);z-index:1000;display:flex;justify-content:flex-end;}
      .factory-drawer{height:100vh;width:min(520px,100vw);background:#fff;border-left:1px solid var(--factory-line);box-shadow:-20px 0 60px rgba(17,24,39,.16);overflow:auto;padding:18px;display:grid;align-content:start;gap:14px;}
      .factory-drawer.wide{width:min(820px,100vw);}
      .drawer-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid var(--factory-line);padding-bottom:12px;}
      .drawer-head span{color:var(--factory-red);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .drawer-head h2{margin:4px 0 0;font-size:24px;}
      .icon-btn{width:34px;height:34px;border:1px solid var(--factory-line);background:#fff;border-radius:8px;font-weight:950;cursor:pointer;}
      .drawer-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}
      .drawer-actions.sticky{position:sticky;top:-18px;background:#fff;z-index:2;padding:10px 0;border-bottom:1px solid var(--factory-line);}
      details{border:1px solid var(--factory-line);border-radius:10px;background:#fff;padding:0;}
      summary{cursor:pointer;padding:12px 14px;font-weight:950;}
      details>div,details>.table-wrap{padding:0 14px 14px;}
      .checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .checklist label{display:flex;gap:8px;align-items:center;background:#f9fafb;border-radius:8px;padding:9px;font-weight:850;}
      .ready-line,.alert-line,.inline-loading{border-radius:8px;padding:10px 12px;background:#fff7ed;color:#c2410c;font-weight:850;}
      .info-grid,.stock-change{display:grid;grid-template-columns:150px 1fr;gap:8px 12px;}
      .info-grid span,.stock-change span{color:var(--factory-muted);font-weight:850;}
      .form-grid{display:grid;gap:10px;}
      .form-grid label{display:grid;gap:5px;font-weight:850;}
      .form-grid textarea{min-height:80px;resize:vertical;}
      .table-wrap{overflow:auto;background:#fff;border:1px solid var(--factory-line);border-radius:10px;}
      .dense-table{width:100%;border-collapse:collapse;font-size:14px;}
      .dense-table th,.dense-table td{border-bottom:1px solid #f0f1f3;padding:9px 10px;text-align:left;vertical-align:middle;}
      .dense-table th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--factory-muted);}
      .stock-low_stock{background:#fffbeb;}
      .stock-out_of_stock{background:#fff5f5;}
      .stock-in_stock{background:#fff;}
      .stock-change{grid-template-columns:repeat(3,1fr);}
      .stock-change>div{display:grid;gap:6px;border:1px solid var(--factory-line);border-radius:10px;padding:12px;}
      .stock-change strong{font-size:24px;}
      .positive{color:#027a48!important;}
      .negative{color:#b42318!important;}
      .confirm-box{display:grid;gap:10px;border:1px solid rgba(196,35,24,.22);background:#fff7f5;border-radius:10px;padding:12px;}
      .bulk-panel summary{padding:0;list-style:none;}
      .bulk-panel p{color:var(--factory-muted);font-weight:750;}
      .import-preview tr.invalid{background:#fef2f2;}
      .audit-timeline{display:grid;gap:6px;}
      .audit-row{display:grid;grid-template-columns:150px 1.4fr .5fr .5fr .6fr 1fr .8fr;gap:10px;align-items:center;background:#fff;border:1px solid var(--factory-line);border-radius:8px;padding:10px 12px;}
      .audit-row time,.audit-row span{font-size:13px;color:var(--factory-muted);font-weight:750;}
      .notification-list.compact .notification-row{grid-template-columns:1fr;}
      .notification-row{grid-template-columns:1fr 1fr 90px;background:#fff;border:1px solid var(--factory-line);border-radius:8px;padding:10px 12px;}
      .empty-line{background:#fff;border:1px dashed #d1d5db;border-radius:10px;padding:18px;text-align:center;color:var(--factory-muted);font-weight:850;}
      .topbar-status{display:grid;gap:4px;text-align:right;}
      .proforma-copy{page-break-after:always;border:1px solid #d1d5db;padding:22px;margin-bottom:18px;background:#fff;color:#111827;}
      .proforma-copy header{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:12px;}
      .proforma-copy h1{margin:0;font-size:26px;letter-spacing:.08em;}
      .proforma-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px;}
      .proforma-total{display:grid;justify-items:end;gap:5px;margin-top:12px;}
      .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:46px;}
      .signatures span{border-top:1px solid #111827;text-align:center;padding-top:8px;}
      @media (max-width: 980px){
        .factory-workspace{grid-template-columns:1fr;}
        .factory-sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--factory-line);}
        .factory-sidebar-nav{grid-template-columns:repeat(3,minmax(0,1fr));}
        .factory-main{height:auto;min-height:100vh;}
        .factory-topbar{height:auto;align-items:stretch;flex-direction:column;}
        .factory-topbar>div:first-child{width:100%;}
        .metric-strip{grid-template-columns:repeat(2,minmax(0,1fr));}
        .split-grid,.orders-layout{grid-template-columns:1fr;}
        .orders-lanes{position:relative;grid-template-columns:repeat(2,minmax(0,1fr));}
        .filter-row,.filter-row.single,.stock-change,.audit-row,.order-row,.invoice-row,.info-grid{grid-template-columns:1fr;}
        .factory-drawer,.factory-drawer.wide{width:100vw;}
        .checklist{grid-template-columns:1fr;}
      }
      @media print{
        body *{visibility:hidden!important;}
        .invoice-print-area,.invoice-print-area *{visibility:visible!important;}
        .invoice-print-area{position:absolute;inset:0;background:#fff;}
        .no-print,.factory-sidebar,.factory-topbar,.drawer-head,.drawer-actions{display:none!important;}
        .factory-drawer-backdrop,.factory-drawer{position:static!important;display:block!important;box-shadow:none!important;padding:0!important;overflow:visible!important;width:100%!important;}
      }
    `}</style>
  );
}

export default FactoryDashboardPage;
