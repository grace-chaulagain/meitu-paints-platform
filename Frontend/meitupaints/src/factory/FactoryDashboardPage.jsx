import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
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
  STOCK: "stock",
  ORDERS: "orders",
  INVOICES: "invoices",
};

const SECTION_ROUTES = {
  [SECTIONS.OVERVIEW]: "/factory/dashboard",
  [SECTIONS.STOCK]: "/factory/dashboard/stock",
  [SECTIONS.ORDERS]: "/factory/dashboard/orders",
  [SECTIONS.INVOICES]: "/factory/dashboard/invoices",
};

const STAGE_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "INBOX", label: "Inbox" },
  { key: "PREPARING", label: "Preparing" },
  { key: "SHIPMENT", label: "Shipment" },
  { key: "COMPLETED", label: "Completed" },
];

const STOCK_STATUS_OPTIONS = [
  { key: "ALL", label: "All stock" },
  { key: "IN_STOCK", label: "In stock" },
  { key: "LOW_STOCK", label: "Low stock" },
  { key: "OUT_OF_STOCK", label: "Out of stock" },
];

function currency(value, code = "NPR") {
  return `${code} ${Number(value || 0).toLocaleString()}`;
}

function statusLabel(status = "") {
  return String(status || "UNKNOWN").replace(/_/g, " ");
}

function getSection(pathname = "") {
  if (pathname.startsWith("/factory/dashboard/stock")) return SECTIONS.STOCK;
  if (pathname.startsWith("/factory/dashboard/orders")) return SECTIONS.ORDERS;
  if (pathname.startsWith("/factory/dashboard/invoices")) return SECTIONS.INVOICES;
  return SECTIONS.OVERVIEW;
}

function EmptyState({ title, text }) {
  return (
    <div className="factory-empty">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function OverviewSection({ onNavigate }) {
  const { data, isLoading, isFetching, error, refetch } =
    useGetFactoryDashboardQuery();

  if (isLoading && !data) {
    return <div className="factory-panel">Loading Factory dashboard...</div>;
  }

  const stock = data?.stock || {};
  const orders = data?.orders || {};

  return (
    <section className="factory-stack">
      <div className="factory-head">
        <div>
          <p className="factory-kicker">Factory Overview</p>
          <h1>Stock and logistics control</h1>
        </div>
        <button className="factory-secondary" onClick={refetch} type="button">
          {isFetching ? "Updating..." : "Refresh"}
        </button>
      </div>
      {error ? <div className="factory-alert">Could not refresh dashboard.</div> : null}
      <div className="factory-metrics">
        <button onClick={() => onNavigate(SECTIONS.STOCK)} type="button">
          <span>Total SKUs</span>
          <strong>{stock.total || 0}</strong>
        </button>
        <button onClick={() => onNavigate(SECTIONS.STOCK)} type="button">
          <span>Low stock</span>
          <strong>{stock.lowStock || 0}</strong>
        </button>
        <button onClick={() => onNavigate(SECTIONS.STOCK)} type="button">
          <span>Out of stock</span>
          <strong>{stock.outOfStock || 0}</strong>
        </button>
        <button onClick={() => onNavigate(SECTIONS.ORDERS)} type="button">
          <span>Awaiting shipment</span>
          <strong>{orders.awaitingShipment || 0}</strong>
        </button>
        <button onClick={() => onNavigate(SECTIONS.ORDERS)} type="button">
          <span>Out for delivery</span>
          <strong>{orders.outForDelivery || 0}</strong>
        </button>
        <button onClick={() => onNavigate(SECTIONS.ORDERS)} type="button">
          <span>Delivered recently</span>
          <strong>{orders.deliveredRecent || 0}</strong>
        </button>
      </div>
    </section>
  );
}

function StockAmendModal({ product, mode, onClose }) {
  const [value, setValue] = useState(
    mode === "threshold"
      ? product?.stock?.lowStockThreshold || 0
      : product?.stock?.currentQuantity || 0,
  );
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [updateStock, { isLoading: stockSaving }] = useUpdateStockQuantityMutation();
  const [updateThreshold, { isLoading: thresholdSaving }] =
    useUpdateStockThresholdMutation();

  if (!product) return null;

  const current =
    mode === "threshold"
      ? Number(product.stock?.lowStockThreshold || 0)
      : Number(product.stock?.currentQuantity || 0);
  const next = Number(value || 0);
  const delta = next - current;
  const saving = stockSaving || thresholdSaving;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (!Number.isFinite(next) || next < 0) {
      setError("Value cannot be negative.");
      return;
    }

    try {
      if (mode === "threshold") {
        await updateThreshold({
          productId: product.productId || product._id,
          payload: { lowStockThreshold: next, reason, note },
        }).unwrap();
      } else {
        await updateStock({
          productId: product.productId || product._id,
          payload: { newQuantity: next, reason, note },
        }).unwrap();
      }
      onClose();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Could not update stock.");
    }
  };

  return (
    <div className="factory-modal-backdrop">
      <form className="factory-modal" onSubmit={submit}>
        <div className="factory-modal-head">
          <div>
            <p className="factory-kicker">Secure stock amendment</p>
            <h2>{mode === "threshold" ? "Update threshold" : "Correct stock"}</h2>
          </div>
          <button type="button" onClick={onClose} className="factory-icon-btn">
            x
          </button>
        </div>
        <div className="factory-confirm-grid">
          <span>Product</span>
          <strong>{product.name}</strong>
          <span>SKU</span>
          <strong>{product.sku}</strong>
          <span>Current</span>
          <strong>{current}</strong>
          <span>New</span>
          <strong>{next}</strong>
          <span>Difference</span>
          <strong className={delta < 0 ? "danger" : ""}>{delta}</strong>
        </div>
        {Math.abs(delta) >= 100 ? (
          <div className="factory-alert">
            Large adjustment. Confirm the quantity and reason before saving.
          </div>
        ) : null}
        <label>
          New value
          <input
            min="0"
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label>
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Stock count correction, received shipment..."
          />
        </label>
        <label>
          Note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional internal note"
          />
        </label>
        {error ? <div className="factory-alert">{error}</div> : null}
        <div className="factory-actions">
          <button type="button" className="factory-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="factory-primary" disabled={saving}>
            {saving ? "Saving..." : "Confirm amendment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StockSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const params = useMemo(() => ({ q, status, limit: 100 }), [q, status]);
  const { data, isLoading, isFetching, error, refetch } = useGetStockQuery(params);
  const historyQuery = useGetStockHistoryQuery(
    selected ? { productId: selected.productId || selected._id, limit: 20 } : skipToken,
  );
  const items = data?.items || [];

  return (
    <section className="factory-stack">
      <div className="factory-head">
        <div>
          <p className="factory-kicker">Stock Management</p>
          <h1>SKU stock controls</h1>
        </div>
        <button className="factory-secondary" onClick={refetch} type="button">
          {isFetching ? "Updating..." : "Refresh"}
        </button>
      </div>
      <div className="factory-toolbar">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search product, SKU, category"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {STOCK_STATUS_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="factory-alert">Could not load stock.</div> : null}
      {isLoading && !data ? (
        <div className="factory-panel">Loading stock...</div>
      ) : items.length ? (
        <div className="factory-grid stock-grid">
          {items.map((item) => (
            <button
              className={`factory-card ${selected?._id === item._id ? "selected" : ""}`}
              key={item._id || item.sku}
              onClick={() => setSelected(item)}
              type="button"
            >
              <span className={`factory-pill ${item.stock?.status || ""}`}>
                {statusLabel(item.stock?.status)}
              </span>
              <h3>{item.name}</h3>
              <p>{item.sku}</p>
              <div className="factory-stock-number">
                {item.stock?.availableQuantity ?? 0}
                <span>{item.stock?.unit || item.pack?.unit || "PCS"}</span>
              </div>
              <small>Low threshold: {item.stock?.lowStockThreshold || 0}</small>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No stock items" text="Try another search or filter." />
      )}

      {selected ? (
        <div className="factory-panel">
          <div className="factory-panel-head">
            <div>
              <p className="factory-kicker">Selected Product</p>
              <h2>{selected.name}</h2>
              <span>{selected.sku}</span>
            </div>
            <div className="factory-actions">
              <button className="factory-secondary" onClick={() => setModal("threshold")}>
                Threshold
              </button>
              <button className="factory-primary" onClick={() => setModal("stock")}>
                Amend stock
              </button>
            </div>
          </div>
          <div className="factory-history">
            <h3>Recent stock history</h3>
            {historyQuery.isFetching ? <span>Updating history...</span> : null}
            {(historyQuery.data?.items || []).length ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyQuery.data?.items || []).map((row) => (
                    <tr key={row._id}>
                      <td>{new Date(row.changedAt).toLocaleString()}</td>
                      <td>{statusLabel(row.type)}</td>
                      <td>{row.previousQuantity}</td>
                      <td>{row.newQuantity}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No stock history yet.</p>
            )}
          </div>
        </div>
      ) : null}
      {modal ? (
        <StockAmendModal
          product={selected}
          mode={modal}
          onClose={() => setModal(null)}
        />
      ) : null}
    </section>
  );
}

function OrderDetail({ order, onClose, onInvoice }) {
  const [driverName, setDriverName] = useState(order?.factory?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(order?.factory?.driverPhone || "");
  const [remarks, setRemarks] = useState(order?.factory?.remarks || "");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [startPreparing, preparingState] = useStartFactoryOrderPreparingMutation();
  const [markOut, markOutState] = useMarkFactoryOrderOutForDeliveryMutation();
  const [markDelivered, deliveredState] = useMarkFactoryOrderDeliveredMutation();
  const [rejectOrder, rejectState] = useRejectFactoryOrderMutation();
  const busy =
    preparingState.isLoading ||
    markOutState.isLoading ||
    deliveredState.isLoading ||
    rejectState.isLoading;

  if (!order) return null;

  const submitAction = async (fn) => {
    setError("");
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Factory action failed.");
    }
  };

  return (
    <div className="factory-modal-backdrop">
      <div className="factory-modal wide">
        <div className="factory-modal-head">
          <div>
            <p className="factory-kicker">Factory Order</p>
            <h2>{order.orderNumber}</h2>
            <span>{statusLabel(order.status)}</span>
          </div>
          <button type="button" onClick={onClose} className="factory-icon-btn">
            x
          </button>
        </div>
        <div className="factory-confirm-grid">
          <span>Dealer</span>
          <strong>{order.dealerSnapshot?.companyName || "-"}</strong>
          <span>Contact</span>
          <strong>{order.dealerSnapshot?.contactName || "-"}</strong>
          <span>Total</span>
          <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
          <span>Payment</span>
          <strong>{order.payment?.method || "-"}</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
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
        <div className="factory-toolbar two">
          <input
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder="Driver name"
          />
          <input
            value={driverPhone}
            onChange={(event) => setDriverPhone(event.target.value)}
            placeholder="Driver phone"
          />
        </div>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Shipment remarks"
        />
        <input
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Required rejection reason if rejecting"
        />
        {error ? <div className="factory-alert">{error}</div> : null}
        <div className="factory-actions wrap">
          <button
            className="factory-secondary"
            disabled={busy}
            onClick={() =>
              submitAction(() =>
                startPreparing({ orderId: order._id, payload: { note: remarks } }).unwrap(),
              )
            }
          >
            Start preparing
          </button>
          <button
            className="factory-primary"
            disabled={busy}
            onClick={() =>
              submitAction(() =>
                markOut({
                  orderId: order._id,
                  payload: { driverName, driverPhone, remarks },
                }).unwrap(),
              )
            }
          >
            Mark out for delivery
          </button>
          <button
            className="factory-primary"
            disabled={busy}
            onClick={() =>
              submitAction(() =>
                markDelivered({ orderId: order._id, payload: { note: remarks } }).unwrap(),
              )
            }
          >
            Mark delivered
          </button>
          <button className="factory-secondary" onClick={() => onInvoice(order._id)}>
            Proforma Invoice
          </button>
          <button
            className="factory-danger"
            disabled={busy || !rejectReason.trim()}
            onClick={() =>
              submitAction(() =>
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
      </div>
    </div>
  );
}

function OrdersSection({ onInvoice }) {
  const [stage, setStage] = useState("INBOX");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const params = useMemo(() => ({ stage, q, limit: 80 }), [stage, q]);
  const { data, isLoading, isFetching, error, refetch } =
    useGetFactoryOrdersQuery(params);
  const items = data?.items || [];

  return (
    <section className="factory-stack">
      <div className="factory-head">
        <div>
          <p className="factory-kicker">Factory Orders</p>
          <h1>Inbox and shipment workflow</h1>
        </div>
        <button className="factory-secondary" onClick={refetch} type="button">
          {isFetching ? "Updating..." : "Refresh"}
        </button>
      </div>
      <div className="factory-toolbar">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search order, dealer, email"
        />
        <select value={stage} onChange={(event) => setStage(event.target.value)}>
          {STAGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="factory-alert">Could not load factory orders.</div> : null}
      {isLoading && !data ? (
        <div className="factory-panel">Loading orders...</div>
      ) : items.length ? (
        <div className="factory-order-list">
          {items.map((order) => (
            <button
              className="factory-order-row"
              key={order._id}
              onClick={() => setSelected(order)}
              type="button"
            >
              <div>
                <strong>{order.orderNumber}</strong>
                <span>{order.dealerSnapshot?.companyName || "Dealer"}</span>
              </div>
              <span className="factory-pill">{statusLabel(order.status)}</span>
              <strong>{currency(order.totals?.total, order.totals?.currency)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No factory orders" text="Orders sent by Admin will appear here." />
      )}
      {selected ? (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onInvoice={onInvoice}
        />
      ) : null}
    </section>
  );
}

function InvoicePreview({ invoice, onClose }) {
  if (!invoice) return null;

  const print = () => window.print();

  return (
    <div className="factory-modal-backdrop">
      <div className="factory-modal invoice-modal">
        <div className="factory-modal-head no-print">
          <div>
            <p className="factory-kicker">Proforma Invoice</p>
            <h2>{invoice.orderNumber}</h2>
          </div>
          <div className="factory-actions">
            <button className="factory-secondary" onClick={onClose}>
              Close
            </button>
            <button className="factory-primary" onClick={print}>
              Print
            </button>
          </div>
        </div>
        <div className="invoice-print-area">
          {(invoice.copies || ["Factory Copy", "Driver Copy", "Dealer Copy"]).map((copy) => (
            <section className="proforma-copy" key={copy}>
              <div className="proforma-head">
                <div>
                  <h1>MEITU PAINTS</h1>
                  <p>Certified Proforma Invoice</p>
                </div>
                <strong>{copy}</strong>
              </div>
              <div className="proforma-meta">
                <span>Order No: {invoice.orderNumber}</span>
                <span>Generated: {new Date(invoice.generatedAt).toLocaleString()}</span>
                <span>Dealer: {invoice.dealer?.companyName || "-"}</span>
                <span>Contact: {invoice.dealer?.contactName || "-"}</span>
                <span>Driver: {invoice.driver?.name || "-"}</span>
                <span>Driver Phone: {invoice.driver?.phone || "-"}</span>
              </div>
              <table>
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
                <strong>
                  Grand Total: {currency(invoice.totals?.total, invoice.totals?.currency)}
                </strong>
              </div>
              <div className="proforma-signatures">
                <span>Factory Signature</span>
                <span>Driver Signature</span>
                <span>Dealer Signature</span>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function FactoryDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const section = getSection(location.pathname);
  const [invoice, setInvoice] = useState(null);
  const [loadInvoice, invoiceState] = useLazyGetProformaInvoiceQuery();

  const navGroups = [
    {
      label: "Operations",
      items: [
        { key: SECTIONS.OVERVIEW, title: "Overview", subtitle: "Summary" },
        { key: SECTIONS.STOCK, title: "Stock", subtitle: "SKU inventory" },
        { key: SECTIONS.ORDERS, title: "Orders", subtitle: "Factory workflow" },
        { key: SECTIONS.INVOICES, title: "Invoices", subtitle: "Proforma prints" },
      ],
    },
  ];

  const handleNavigate = (key) => navigate(SECTION_ROUTES[key] || SECTION_ROUTES.overview);
  const handleInvoice = async (orderId) => {
    const out = await loadInvoice(orderId).unwrap();
    setInvoice(out);
  };

  return (
    <>
      <DashboardShell
        eyebrow="Meitu Factory"
        title="Factory Dashboard"
        accountLabel={user?.email || user?.username || "Factory"}
        navGroups={navGroups}
        activeKey={section}
        onNavigate={(item) => handleNavigate(item.key)}
        priorityLabel="Stock Rule"
        priorityText="Stock is deducted only when an order is marked out for delivery."
      >
        {invoiceState.isFetching ? <div className="factory-alert">Loading invoice...</div> : null}
        {section === SECTIONS.OVERVIEW ? (
          <OverviewSection onNavigate={handleNavigate} />
        ) : null}
        {section === SECTIONS.STOCK ? <StockSection /> : null}
        {section === SECTIONS.ORDERS ? <OrdersSection onInvoice={handleInvoice} /> : null}
        {section === SECTIONS.INVOICES ? (
          <section className="factory-stack">
            <div className="factory-head">
              <div>
                <p className="factory-kicker">Invoices</p>
                <h1>Generate from Factory orders</h1>
              </div>
            </div>
            <EmptyState
              title="Open an order to print"
              text="Choose Proforma Invoice from a Factory order detail."
            />
          </section>
        ) : null}
      </DashboardShell>
      <FactoryDashboardStyles />
      <InvoicePreview invoice={invoice} onClose={() => setInvoice(null)} />
    </>
  );
}

function FactoryDashboardStyles() {
  return (
    <style>{`
      .factory-stack{display:grid;gap:18px;}
      .factory-head,.factory-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
      .factory-kicker{margin:0 0 6px;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#b42318;}
      .factory-head h1,.factory-panel h2,.factory-modal h2{margin:0;color:#111827;font-size:clamp(26px,3vw,42px);line-height:1.02;font-weight:950;}
      .factory-panel,.factory-card,.factory-empty{border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(15,23,42,.08);padding:20px;}
      .factory-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
      .factory-metrics button{border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:18px;text-align:left;box-shadow:0 14px 34px rgba(15,23,42,.07);cursor:pointer;}
      .factory-metrics span,.factory-card p,.factory-card small,.factory-order-row span{color:#6b7280;font-weight:800;}
      .factory-metrics strong{display:block;margin-top:10px;font-size:34px;color:#111827;}
      .factory-toolbar{display:grid;grid-template-columns:1fr 220px;gap:12px;}
      .factory-toolbar.two{grid-template-columns:1fr 1fr;}
      .factory-toolbar input,.factory-toolbar select,.factory-modal input,.factory-modal textarea,.factory-modal select{width:100%;border:1px solid rgba(15,23,42,.12);border-radius:14px;padding:13px 14px;font:inherit;font-weight:750;background:#fff;}
      .factory-modal textarea{min-height:84px;resize:vertical;}
      .factory-primary,.factory-secondary,.factory-danger,.factory-icon-btn{border:0;border-radius:14px;padding:12px 16px;font-weight:900;cursor:pointer;}
      .factory-primary{background:linear-gradient(135deg,#b42318,#ef4423);color:#fff;}
      .factory-secondary{background:#fff;border:1px solid rgba(15,23,42,.12);color:#111827;}
      .factory-danger{background:#991b1b;color:#fff;}
      .factory-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;}
      .factory-actions.wrap{flex-wrap:wrap;}
      .factory-grid{display:grid;gap:14px;}
      .stock-grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr));}
      .factory-card{text-align:left;cursor:pointer;}
      .factory-card.selected{outline:3px solid rgba(180,35,24,.22);}
      .factory-card h3{margin:12px 0 4px;font-size:18px;color:#111827;}
      .factory-stock-number{margin:16px 0 6px;font-size:34px;font-weight:950;color:#111827;}
      .factory-stock-number span{margin-left:8px;font-size:14px;color:#6b7280;}
      .factory-pill{display:inline-flex;align-items:center;border-radius:999px;background:#f3f4f6;padding:6px 10px;font-size:11px;font-weight:950;color:#374151;text-transform:uppercase;}
      .factory-pill.LOW_STOCK{background:#fff7ed;color:#c2410c;}
      .factory-pill.OUT_OF_STOCK{background:#fef2f2;color:#b42318;}
      .factory-pill.IN_STOCK{background:#ecfdf3;color:#027a48;}
      .factory-empty{display:grid;gap:6px;text-align:center;color:#6b7280;}
      .factory-empty strong{color:#111827;font-size:20px;}
      .factory-alert{border:1px solid rgba(180,35,24,.22);background:#fff5f5;color:#991b1b;border-radius:14px;padding:12px 14px;font-weight:800;}
      .factory-history{display:grid;gap:10px;margin-top:18px;overflow:auto;}
      table{width:100%;border-collapse:collapse;}
      th,td{border-bottom:1px solid rgba(15,23,42,.08);padding:10px;text-align:left;vertical-align:top;}
      th{font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:.08em;}
      .factory-order-list{display:grid;gap:10px;}
      .factory-order-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:14px;border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:15px;text-align:left;cursor:pointer;}
      .factory-order-row div{display:grid;gap:4px;}
      .factory-modal-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:20px;}
      .factory-modal{width:min(640px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 80px rgba(15,23,42,.24);display:grid;gap:16px;}
      .factory-modal.wide{width:min(1000px,100%);}
      .factory-modal.invoice-modal{width:min(1100px,100%);}
      .factory-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
      .factory-icon-btn{width:38px;height:38px;padding:0;background:#f3f4f6;color:#111827;}
      .factory-confirm-grid{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;border:1px solid rgba(15,23,42,.08);border-radius:16px;padding:14px;background:#f9fafb;}
      .factory-confirm-grid span{color:#6b7280;font-weight:850;}
      .danger{color:#b42318;}
      .proforma-copy{page-break-after:always;border:1px solid #d1d5db;padding:22px;margin-bottom:18px;background:#fff;color:#111827;}
      .proforma-head,.proforma-meta,.proforma-total,.proforma-signatures{display:grid;gap:8px;}
      .proforma-head{grid-template-columns:1fr auto;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:12px;}
      .proforma-head h1{margin:0;font-size:26px;letter-spacing:.08em;}
      .proforma-meta{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:12px;}
      .proforma-total{justify-items:end;margin-top:12px;}
      .proforma-signatures{grid-template-columns:repeat(3,1fr);margin-top:48px;}
      .proforma-signatures span{border-top:1px solid #111827;padding-top:8px;text-align:center;}
      @media (max-width: 860px){
        .factory-metrics,.factory-toolbar,.factory-toolbar.two,.factory-order-row,.proforma-meta,.proforma-signatures{grid-template-columns:1fr;}
        .factory-head,.factory-panel-head,.factory-actions{align-items:stretch;flex-direction:column;}
      }
      @media print{
        body *{visibility:hidden!important;}
        .invoice-print-area,.invoice-print-area *{visibility:visible!important;}
        .invoice-print-area{position:absolute;inset:0;background:#fff;}
        .no-print{display:none!important;}
        .factory-modal-backdrop,.factory-modal{position:static!important;display:block!important;box-shadow:none!important;padding:0!important;overflow:visible!important;}
      }
    `}</style>
  );
}

export default FactoryDashboardPage;
