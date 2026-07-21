import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { downloadOrderSummaryPdf } from "../../utils/downloadOrderSummaryPdf.jsx";
import { formatMoney } from "../../dealer/pricing.js";
import {
  DISPLAY_BUCKET_META,
  canDownloadOrderPdf,
  formatPaymentMethod,
  formatShortDateTime,
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
} from "../../dealer/orderDetailLogic.js";
import { StatusRail } from "../../dealer/mobile/StatusRail.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";

// Mirrors src/dealer/mobile/DealerOrderDetailMobileView.jsx (same
// hero/status-rail/items layout, same prop signature - order/loading/
// loadError already fetched once by the routed parent page, see
// DispatcherOwnOrderDetailPage.jsx), minus the reorder action (no
// dispatcher-side "reorder from history" shortcut exists, desktop doesn't
// have one either). Now includes the invoice-PDF chip - the "not offered
// for replenishment orders" reasoning that used to justify skipping it here
// no longer holds now that the desktop detail page has it too.
const STAGE_HEADLINE = {
  SUBMITTED: "Order placed",
  VERIFIED: "Verified — being prepared",
  DISPATCHED: "On its way",
  COMPLETED: "Delivered",
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

export function DispatcherOwnOrderDetailMobileView({ order, loading, loadError, onBack, productsMap, familyMap }) {
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
  const isDownloadable = order ? canDownloadOrderPdf(order) : false;
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

            <div className="dealer-m-order-chip-row">
              {order?.payment?.method ? <span className="dealer-m-order-chip">{formatPaymentMethod(order.payment.method)}</span> : null}
              <button
                type="button"
                className="dealer-m-order-chip-link"
                disabled={!isDownloadable}
                onClick={() => isDownloadable && downloadOrderSummaryPdf({ order })}
              >
                <DashboardIcon name="download" size={13} strokeWidth={2} />
                {isDownloadable ? "Invoice PDF" : "Invoice after verification"}
              </button>
            </div>

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
