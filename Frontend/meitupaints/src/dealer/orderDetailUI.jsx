// Shared JSX building blocks between DealerOrdersPage.jsx (the list) and
// DealerOrderDetailPage.jsx (the routed detail page) — the milestone
// stepper, activity timeline, items table, and sidebar cards all live here
// so both pages render one source of truth instead of drifting apart.
// Pure logic (status/bucket/milestone helpers) lives in orderDetailLogic.js
// so this file can stay component-only for react-refresh.
import { useState } from "react";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "./pricing.js";
import {
  buildOrderMilestones,
  formatDateTime,
  formatPaymentMethod,
  formatShortDateTime,
  normalizeStatus,
  resolveOrderItemImage,
} from "./orderDetailLogic.js";

// A genuine spinning circular loader (radial-gradient dots faded into a
// ring) rather than a rotating icon glyph — this is what "Processing"
// pending orders show, both in the list and on the detail page.
export function Spinner({ size = 24, color }) {
  return (
    <span
      aria-hidden="true"
      className="dealer-order-spinner"
      style={{ width: size, height: size, "--spinner-color": color }}
    />
  );
}

// Small hover/focus-triggered info bubble — used to explain a disabled action
// inline (beside the button it qualifies) instead of a separate banner.
export function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label={text}
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          border: "none",
          background: "var(--color-fog, #f5f5f7)",
          color: "var(--color-graphite, #707070)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <DashboardIcon name="info" size={12} strokeWidth={2} />
      </button>
      {open ? (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            padding: "8px 10px",
            borderRadius: 10,
            background: "var(--color-ink, #1d1d1f)",
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 500,
            lineHeight: 1.4,
            textAlign: "center",
            zIndex: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,.18)",
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function RejectedBanner({ status }) {
  const normalized = normalizeStatus(status);
  return (
    <div className="dealer-order-rejected-banner">
      <DashboardIcon name="reject" size={14} strokeWidth={2} />
      <span>{normalized === "CANCELLED" ? "This order was cancelled." : "This order was rejected."}</span>
    </div>
  );
}

// The compact "at a glance" progress track at the top of the detail view —
// a horizontal 4-step layout (done/current/upcoming), with the current step
// shown as a spinning ring rather than a static icon.
export function OrderMilestoneStepper({ order }) {
  const milestones = buildOrderMilestones(order);
  if (!milestones) return <RejectedBanner status={order?.status} />;

  return (
    <div className="dealer-order-milestones">
      {milestones.map((milestone, index) => (
        <div key={milestone.key} className={`dealer-order-milestone dealer-order-milestone--${milestone.state}`}>
          <div className="dealer-order-milestone-row">
            <span className="dealer-order-milestone-icon">
              {milestone.state === "current" ? (
                <Spinner size={18} color="var(--color-azure, #0071e3)" />
              ) : (
                <DashboardIcon name={milestone.state === "done" ? "checkmark" : milestone.icon} size={11} strokeWidth={2.6} />
              )}
            </span>
            {index < milestones.length - 1 ? <span className="dealer-order-milestone-line" /> : null}
          </div>
          <div className="dealer-order-milestone-label">{milestone.label}</div>
          <div className="dealer-order-milestone-sub">
            {milestone.state === "done" ? formatShortDateTime(milestone.date) : milestone.state === "current" ? "In Progress" : "Pending"}
          </div>
        </div>
      ))}
    </div>
  );
}

// The detailed vertical activity log further down the page — same milestone
// data as the stepper above, just with the boilerplate description text and
// full timestamp each stage's row shows.
export function OrderActivityTimeline({ order }) {
  const milestones = buildOrderMilestones(order);

  if (!milestones) {
    const normalized = normalizeStatus(order?.status);
    return (
      <div className="dealer-order-activity-item">
        <span className="dealer-order-activity-icon dealer-order-activity-icon--negative">
          <DashboardIcon name="reject" size={12} strokeWidth={2.6} />
        </span>
        <div className="dealer-order-activity-copy">
          <div className="dealer-order-activity-label">{normalized === "CANCELLED" ? "Cancelled" : "Rejected"}</div>
          <div className="dealer-order-activity-desc">{order?.rejection?.reason || "This order did not proceed further."}</div>
        </div>
        <div className="dealer-order-activity-date">{formatDateTime(order?.rejection?.rejectedAt || order?.updatedAt)}</div>
      </div>
    );
  }

  return (
    <div className="dealer-order-activity">
      {milestones.map((milestone) => (
        <div key={milestone.key} className={`dealer-order-activity-item dealer-order-activity-item--${milestone.state}`}>
          <span className="dealer-order-activity-icon">
            {milestone.state === "current" ? (
              <Spinner size={16} color="var(--color-azure, #0071e3)" />
            ) : (
              <DashboardIcon name={milestone.state === "done" ? "checkmark" : milestone.icon} size={11} strokeWidth={2.6} />
            )}
          </span>
          <div className="dealer-order-activity-copy">
            <div className="dealer-order-activity-label">{milestone.label}</div>
            <div className="dealer-order-activity-desc">{milestone.description}</div>
          </div>
          <div className="dealer-order-activity-date">{milestone.state === "upcoming" ? "Pending" : formatDateTime(milestone.date)}</div>
        </div>
      ))}
    </div>
  );
}

export function OrderItemsTable({ items = [], productsMap, familyMap }) {
  if (!items.length) {
    return <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>No items found.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Item", "Pack", "Qty", "Rate", "Amount"].map((head) => (
              <th key={head} style={{ textAlign: head === "Item" || head === "Pack" ? "left" : "right", padding: "8px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const image = productsMap ? resolveOrderItemImage(item, productsMap, familyMap) : null;
            return (
              <tr key={`${item.sku || item.code || item.name}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {productsMap ? (
                      <div className="dealer-order-thumb" style={{ width: 36, height: 36, borderRadius: 8 }}>
                        {image?.url ? (
                          <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <DashboardIcon name="package" size={14} strokeWidth={1.6} style={{ color: "var(--color-graphite, #707070)" }} />
                        )}
                      </div>
                    ) : null}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>{item.name || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{item.sku || item.code || ""}</div>
                      {item.components?.length ? (
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--color-graphite, #707070)", lineHeight: 1.4 }}>
                          Includes: {item.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 12.5 }}>{item.packLabel || item.variantLabel || item.unit || "—"}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{Number(item.quantity || 0).toLocaleString()}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5 }}>{Number(item.unitPrice || 0).toLocaleString()}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{Number(item.lineTotal || 0).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OrderSummaryCard({ order }) {
  const totals = order?.totals || {};
  return (
    <div className="dealer-order-side-card">
      <div className="dealer-order-side-title">Order Summary</div>
      <div className="dealer-order-side-rows">
        <div className="dealer-order-side-row">
          <span>Subtotal</span>
          <span>{formatMoney(totals.subtotal, totals.currency)}</span>
        </div>
        {totals.discount ? (
          <div className="dealer-order-side-row">
            <span>Discount</span>
            <span>-{formatMoney(totals.discount, totals.currency)}</span>
          </div>
        ) : null}
        {totals.tax ? (
          <div className="dealer-order-side-row">
            <span>Tax</span>
            <span>{formatMoney(totals.tax, totals.currency)}</span>
          </div>
        ) : null}
        <div className="dealer-order-side-row dealer-order-side-row--total">
          <span>Total Amount</span>
          <span>{formatMoney(totals.total, totals.currency)}</span>
        </div>
      </div>
    </div>
  );
}

export function OrderInfoCard({ order }) {
  return (
    <div className="dealer-order-side-card">
      <div className="dealer-order-side-title">Order Information</div>
      <div className="dealer-order-side-rows">
        <div className="dealer-order-side-row">
          <span>Order ID</span>
          <span>{order?.orderNumber || "—"}</span>
        </div>
        <div className="dealer-order-side-row">
          <span>Order Date</span>
          <span>{formatDateTime(order?.createdAt)}</span>
        </div>
        <div className="dealer-order-side-row">
          <span>Payment Method</span>
          <span>{formatPaymentMethod(order?.payment?.method)}</span>
        </div>
        {order?.payment?.reference ? (
          <div className="dealer-order-side-row">
            <span>Payment Ref.</span>
            <span>{order.payment.reference}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeliveryDetailsCard({ order }) {
  const snapshot = order?.dealerSnapshot || {};
  if (!snapshot.companyName && !snapshot.address) return null;

  return (
    <div className="dealer-order-side-card">
      <div className="dealer-order-side-title">Delivery Details</div>
      {snapshot.companyName ? <div className="dealer-order-side-strong">{snapshot.companyName}</div> : null}
      {snapshot.contactName ? <div className="dealer-order-side-text">{snapshot.contactName}</div> : null}
      {snapshot.phone ? <div className="dealer-order-side-text">{snapshot.phone}</div> : null}
      {snapshot.address ? <div className="dealer-order-side-text dealer-order-side-address">{snapshot.address}</div> : null}
    </div>
  );
}

// Rendered once by each page that uses the pieces above (mirrors the
// DashboardUIStyles pattern in components/dashboard/DashboardUI.jsx).
export function OrderDetailStyles() {
  return (
    <style>{`
      .dealer-order-spinner{
        display:inline-block;
        border-radius:999px;
        background:
          radial-gradient(circle at 50% 9%, var(--spinner-color) 0 8%, transparent 9%),
          radial-gradient(circle at 78% 20%, color-mix(in srgb, var(--spinner-color) 88%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 91% 50%, color-mix(in srgb, var(--spinner-color) 76%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 78% 80%, color-mix(in srgb, var(--spinner-color) 64%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 50% 91%, color-mix(in srgb, var(--spinner-color) 52%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 22% 80%, color-mix(in srgb, var(--spinner-color) 40%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 9% 50%, color-mix(in srgb, var(--spinner-color) 30%, transparent) 0 7%, transparent 8%),
          radial-gradient(circle at 22% 20%, color-mix(in srgb, var(--spinner-color) 20%, transparent) 0 7%, transparent 8%);
        animation:dealerSpin 1.6s linear infinite;
        filter:drop-shadow(0 0 4px color-mix(in srgb, var(--spinner-color) 24%, transparent));
      }
      @keyframes dealerSpin{ to{ transform:rotate(360deg); } }
      @media (prefers-reduced-motion: reduce){
        .dealer-order-spinner{ animation:none; }
      }

      .dealer-order-thumb{ width:54px; height:54px; border-radius:10px; overflow:hidden; background:var(--color-fog, #f5f5f7); display:grid; place-items:center; flex-shrink:0; border:1px solid rgba(29,29,31,.04); }
      .dealer-order-thumb-more{ font-size:12px; font-weight:700; color:var(--color-graphite, #707070); }

      .dealer-order-detail-header{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .dealer-order-back-btn{ display:inline-flex; align-items:center; gap:8px; border:none; background:transparent; color:var(--color-ink, #1d1d1f); font-size:13.5px; font-weight:700; cursor:pointer; padding:6px 2px; }
      .dealer-order-detail-actions{ display:flex; align-items:center; gap:8px; flex-shrink:0; }

      .dealer-order-detail-body{ display:grid; grid-template-columns:1.7fr 1fr; gap:22px; align-items:start; margin-top:18px; }
      .dealer-order-detail-main{ min-width:0; }
      .dealer-order-detail-sidebar{ min-width:0; display:grid; gap:14px; align-content:start; }

      .dealer-order-detail-title-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
      .dealer-order-detail-title{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .dealer-order-detail-title span:first-child{ font-size:20px; font-weight:800; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }
      .dealer-order-detail-subtitle{ margin-top:4px; font-size:12.5px; color:var(--color-graphite, #707070); }
      .dealer-order-detail-amount{ text-align:right; flex-shrink:0; }
      .dealer-order-detail-amount-value{ font-size:22px; font-weight:800; color:var(--color-ink, #1d1d1f); letter-spacing:-.01em; }

      .dealer-order-rejected-banner{ display:flex; align-items:center; gap:8px; padding:12px 14px; border-radius:12px; background:rgba(180,35,24,.08); color:#b42318; font-size:13px; font-weight:700; }

      .dealer-order-milestones{ display:flex; align-items:flex-start; }
      .dealer-order-milestone{ flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; min-width:0; }
      .dealer-order-milestone-row{ display:flex; align-items:center; width:100%; }
      .dealer-order-milestone-icon{ width:30px; height:30px; border-radius:999px; display:grid; place-items:center; flex-shrink:0; background:var(--color-fog, #f5f5f7); color:var(--color-graphite, #707070); margin-left:auto; margin-right:auto; }
      .dealer-order-milestone--done .dealer-order-milestone-icon{ background:var(--color-azure, #0071e3); color:#fff; }
      .dealer-order-milestone--current .dealer-order-milestone-icon{ background:#fff; border:1px solid rgba(0,113,227,.25); }
      .dealer-order-milestone-line{ flex:1; height:2px; background:rgba(29,29,31,.1); margin:0 -50%; position:relative; z-index:-1; }
      .dealer-order-milestone--done + .dealer-order-milestone .dealer-order-milestone-line,
      .dealer-order-milestone--done .dealer-order-milestone-line{ background:var(--color-azure, #0071e3); }
      .dealer-order-milestone-label{ margin-top:8px; font-size:11.5px; font-weight:700; color:var(--color-ink, #1d1d1f); }
      .dealer-order-milestone-sub{ margin-top:2px; font-size:10.5px; color:var(--color-graphite, #707070); }
      .dealer-order-milestone--upcoming .dealer-order-milestone-label{ color:var(--color-graphite, #707070); }

      .dealer-order-activity{ display:grid; gap:16px; }
      .dealer-order-activity-item{ display:flex; align-items:flex-start; gap:12px; }
      .dealer-order-activity-icon{ width:26px; height:26px; border-radius:999px; display:grid; place-items:center; flex-shrink:0; background:var(--color-fog, #f5f5f7); color:var(--color-graphite, #707070); }
      .dealer-order-activity-item--done .dealer-order-activity-icon,
      .dealer-order-activity-item--current .dealer-order-activity-icon{ background:rgba(0,113,227,.1); color:var(--color-azure, #0071e3); }
      .dealer-order-activity-icon--negative{ background:rgba(180,35,24,.1); color:#b42318; }
      .dealer-order-activity-copy{ flex:1; min-width:0; }
      .dealer-order-activity-label{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
      .dealer-order-activity-desc{ margin-top:2px; font-size:12px; color:var(--color-graphite, #707070); line-height:1.4; }
      .dealer-order-activity-item--upcoming .dealer-order-activity-label,
      .dealer-order-activity-item--upcoming .dealer-order-activity-desc{ color:var(--color-graphite, #707070); }
      .dealer-order-activity-date{ flex-shrink:0; font-size:11.5px; color:var(--color-graphite, #707070); white-space:nowrap; }

      .dealer-order-side-card{ border-radius:16px; border:1px solid rgba(29,29,31,.07); background:#fff; padding:16px; }
      .dealer-order-side-title{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-graphite, #707070); margin-bottom:12px; }
      .dealer-order-side-label{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-graphite, #707070); }
      .dealer-order-side-rows{ display:grid; gap:9px; }
      .dealer-order-side-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12.5px; color:var(--color-graphite, #707070); }
      .dealer-order-side-row span:last-child{ color:var(--color-ink, #1d1d1f); font-weight:600; text-align:right; }
      .dealer-order-side-row--total{ margin-top:2px; padding-top:9px; border-top:1px solid rgba(29,29,31,.08); }
      .dealer-order-side-row--total span{ font-size:14px; font-weight:800; color:var(--color-ink, #1d1d1f) !important; }
      .dealer-order-side-strong{ font-size:13px; font-weight:700; color:var(--color-ink, #1d1d1f); }
      .dealer-order-side-text{ margin-top:3px; font-size:12.5px; color:var(--color-graphite, #707070); }
      .dealer-order-side-address{ margin-top:8px; line-height:1.4; }

      @media (max-width:820px){
        .dealer-order-detail-body{ grid-template-columns:1fr; }
        .dealer-order-milestone-label{ font-size:10.5px; }
      }
    `}</style>
  );
}
