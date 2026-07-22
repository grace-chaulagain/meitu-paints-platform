import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { downloadOrderSummaryPdf } from "../../utils/downloadOrderSummaryPdf.jsx";
import { formatMoney } from "../../dealer/pricing.js";
import {
  DISPLAY_BUCKET_META,
  formatPaymentMethod,
  formatShortDateTime,
  normalizeStatus,
  orderDisplayBucket,
} from "../../dealer/orderDetailLogic.js";
import { StatusRail } from "../../dealer/mobile/StatusRail.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";

const STAGE_HEADLINE = {
  SUBMITTED: "Awaiting review",
  VERIFIED: "Verified — in factory queue",
  DISPATCHED: "Out for delivery",
  COMPLETED: "Completed",
};

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

// Admin's mobile counterpart to DispatcherOwnOrderDetailMobileView.jsx /
// DealerOrderDetailMobileView.jsx (same hero/status-rail/items shell), plus
// the dealer/payment context an admin needs and the Verify/Reject actions a
// dealer's own order view has no reason to show. Item thumbnails are
// skipped (plain package icon per line) rather than wiring in
// useGetProductsQuery/useGetProductFamiliesQuery here too - AdminOrdersPage
// already pays that cost for the desktop list; duplicating it for a mobile
// detail view's thumbnails wasn't worth the extra requests for this slice.
// Amend and hard-delete stay desktop-only for now - both are dense editing/
// destructive-confirmation flows out of scope for this pass; ADMIN_MOBILE_
// DESIGN_PROMPT.md's §3 ask was Verify/Reject swipe actions + a push detail
// page, not full action parity.
export function AdminOrderDetailMobileView({
  order,
  loading,
  loadError,
  onBack,
  dealer,
  dispatcher,
  hasDispatchRecord,
  pdfBusy,
  onDownloadProforma,
  onOpenVerify,
  onOpenReject,
  busyAction,
}) {
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
  const canAct = status === "SUBMITTED";
  const contactLine = [dealer?.contactName, dealer?.phone].filter(Boolean).join(" · ");
  const paymentLine = [order?.payment?.method, order?.payment?.reference].filter(Boolean).join(" · ");
  const notes = order
    ? [
        { label: "Dealer note", value: order?.dealerNote },
        { label: "Internal note", value: order?.internalNote },
        { label: "Review note", value: order?.review?.reviewNote },
      ].filter((note) => note.value)
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
            <MobilePushHeader
              title={order.orderNumber || "Order"}
              onBack={onBack}
              action={
                <button
                  type="button"
                  className="admin-m-feed-icon"
                  style={{ border: "none" }}
                  onClick={() => downloadOrderSummaryPdf({ order, dealer })}
                  aria-label="Download PDF"
                >
                  <DashboardIcon name="download" size={15} strokeWidth={2} />
                </button>
              }
            />

            <div className="dealer-m-order-hero">
              <div className={`dealer-m-order-hero-headline ${isOffRamp ? "off-ramp" : ""}`}>
                {isOffRamp ? DISPLAY_BUCKET_META[bucket]?.stateLabel : STAGE_HEADLINE[status] || DISPLAY_BUCKET_META[bucket]?.stateLabel}
              </div>
              <div className="dealer-m-order-hero-sub">
                {isOffRamp
                  ? order?.review?.reviewNote || "Contact the dealer for details."
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

            <div className="dealer-m-order-chip-row">
              {order?.payment?.method ? <span className="dealer-m-order-chip">{formatPaymentMethod(order.payment.method)}</span> : null}
              {hasDispatchRecord ? (
                <button type="button" className="dealer-m-order-chip-link" disabled={pdfBusy} onClick={onDownloadProforma}>
                  <DashboardIcon name="invoice" size={13} strokeWidth={2} />
                  {pdfBusy ? "Generating…" : "Proforma Invoice"}
                </button>
              ) : null}
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Dealer</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{dealer?.companyName || "Dealer"}</div>
                {contactLine ? <div style={{ fontSize: 13, color: "var(--color-graphite, #707070)" }}>{contactLine}</div> : null}
                {dealer?.address ? <div style={{ fontSize: 13, color: "var(--color-graphite, #707070)" }}>{dealer.address}</div> : null}
                {dealer?.fulfillmentMode === "DISPATCHER" ? (
                  <div style={{ fontSize: 13, color: "var(--color-graphite, #707070)" }}>
                    Via {dispatcher?.companyName || dispatcher?.name || "dispatcher"}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="dealer-m-order-items-card">
              <div className="dealer-m-order-items-title">Items</div>
              {(order.items || []).map((item, index) => (
                <div className="dealer-m-cart-line" key={`${item.sku}-${index}`}>
                  <div className="dealer-m-cart-line-info">
                    <div className="dealer-m-cart-line-label">
                      {item.name} — {item.packLabel} &times; {item.quantity}
                    </div>
                    <div className="dealer-m-cart-line-rate">{formatMoney(item.unitPrice, order?.totals?.currency)}/pack</div>
                  </div>
                  <div className="dealer-m-cart-line-total">{formatMoney(item.lineTotal, order?.totals?.currency)}</div>
                </div>
              ))}
              <div className="dealer-m-order-items-total">
                <span>Total</span>
                <span>{formatMoney(order?.totals?.total, order?.totals?.currency)}</span>
              </div>
              {paymentLine ? (
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{paymentLine}</div>
              ) : null}
            </div>

            {notes.length ? (
              <div className="admin-m-card">
                <div className="admin-m-section-title">Notes</div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {notes.map((note) => (
                    <div key={note.label}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em", color: "var(--color-graphite, #707070)" }}>
                        {note.label}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>{note.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {canAct ? (
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <PrimaryButton variant="danger" onClick={onOpenReject} disabled={Boolean(busyAction)}>
                  Reject
                </PrimaryButton>
                <PrimaryButton variant="primary" onClick={onOpenVerify} disabled={Boolean(busyAction)}>
                  Verify
                </PrimaryButton>
              </div>
            ) : null}
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
