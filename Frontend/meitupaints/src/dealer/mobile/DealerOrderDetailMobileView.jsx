import { useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { downloadOrderSummaryPdf } from "../../utils/downloadOrderSummaryPdf.jsx";
import { formatMoney } from "../pricing.js";
import {
  DISPLAY_BUCKET_META,
  buildReorderDraft,
  canDownloadOrderPdf,
  formatPaymentMethod,
  formatShortDateTime,
  normalizeStatus,
  orderDisplayBucket,
  resolveOrderItemImage,
} from "../orderDetailLogic.js";
import { useOrderDraft } from "./useOrderDraft.js";
import { StatusRail } from "./StatusRail.jsx";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { PrimaryButton } from "./PrimaryButton.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";

// spec §4.5: the Uber Eats tracker, mapped onto the real 4 (+2 off-ramp)
// statuses. Headline copy per status, subline from the matching milestone's
// real timestamp (buildOrderMilestones/orderDetailLogic.js) - nothing here
// is fabricated, only worded for a dealer glancing at their phone.
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

export function DealerOrderDetailMobileView({ order, loading, loadError, onBack, productsMap, familyMap }) {
  const navigate = useNavigate();
  const draft = useOrderDraft();

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
          if (!map.has(key)) map.set(key, { code: key, name: item.name, components: item.components || [], lines: [] });
          map.get(key).lines.push(item);
        }
        return Array.from(map.values());
      })()
    : [];

  function handleReorderAll() {
    if (!order) return;
    draft.setDraft(buildReorderDraft(order.items));
    navigate("/dealer/cart");
  }

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
            ) : (
              <div className="dealer-m-order-card">
                <PrimaryButton onClick={handleReorderAll}>Order these items again</PrimaryButton>
              </div>
            )}

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
                          <div className="dealer-m-cart-line-rate">{formatMoney(item.unitPrice)}/pack</div>
                        </div>
                        <div className="dealer-m-cart-line-total">{formatMoney(item.lineTotal)}</div>
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

            {status === "COMPLETED" ? (
              <div className="dealer-m-cart-footer">
                <PrimaryButton onClick={handleReorderAll}>Reorder all items</PrimaryButton>
              </div>
            ) : null}
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
