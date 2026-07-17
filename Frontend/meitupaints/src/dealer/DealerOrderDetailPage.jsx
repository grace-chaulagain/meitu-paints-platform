import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetDealerOrderQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../redux/api/selectors.js";
import { downloadOrderSummaryPdf } from "../utils/downloadOrderSummaryPdf.jsx";
import { formatMoney } from "./pricing.js";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { EmptyState, GhostButton, Pill, Surface } from "../components/dashboard/DashboardUI.jsx";
import {
  DeliveryDetailsCard,
  InfoTooltip,
  OrderDetailStyles,
  OrderInfoCard,
  OrderItemsTable,
  OrderMilestoneStepper,
  OrderSummaryCard,
} from "./orderDetailUI.jsx";
import {
  DISPLAY_BUCKET_META,
  canDownloadOrderPdf,
  formatDateTime,
  normalizeStatus,
  orderDisplayBucket,
} from "./orderDetailLogic.js";

export default function DealerOrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const orderQuery = useGetDealerOrderQuery(orderId, { skip: !orderId });
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const order = orderQuery.data || null;

  const productsMap = useMemo(() => {
    const map = {};
    for (const item of productsQuery.data || []) map[item.sku] = item;
    return map;
  }, [productsQuery.data]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [familiesQuery.data]);

  function goBack() {
    navigate("/dealer/orders");
  }

  if (orderQuery.isLoading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={18}>
          <div style={{ height: 400, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (orderQuery.error || !order) {
    const message = orderQuery.error ? getQueryErrorMessage(orderQuery.error, "Failed to load this order.") : "This order could not be found.";
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={20}>
          <EmptyState icon="orders" title="Order not found" subtitle={message} />
          <div style={{ marginTop: 4 }}>
            <GhostButton onClick={goBack}>Back to Orders</GhostButton>
          </div>
        </Surface>
      </div>
    );
  }

  const isDownloadable = canDownloadOrderPdf(order);
  const bucket = orderDisplayBucket(normalizeStatus(order.status));
  const bucketMeta = DISPLAY_BUCKET_META[bucket];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={18} className="dash-fade-up">
        <div className="dealer-order-detail-header">
          <button type="button" onClick={goBack} className="dealer-order-back-btn">
            <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
            Back to Orders
          </button>
          <div className="dealer-order-detail-actions">
            <GhostButton icon="print" onClick={() => window.print()}>Print</GhostButton>
            <GhostButton
              icon="download"
              disabled={!isDownloadable}
              onClick={() => isDownloadable && downloadOrderSummaryPdf({ order })}
            >
              {isDownloadable ? "Download Invoice" : "Invoice after verification"}
            </GhostButton>
            {!isDownloadable ? (
              <InfoTooltip text="This order summary PDF becomes available once the order is verified by Meitu." />
            ) : null}
          </div>
        </div>

        <div className="dealer-order-detail-body">
          <div className="dealer-order-detail-main">
            <div className="dealer-order-detail-title-row">
              <div>
                <div className="dealer-order-detail-title">
                  <span>{order.orderNumber || "Order Detail"}</span>
                  <Pill tone={bucketMeta.pillTone} size="small">{bucketMeta.pillLabel}</Pill>
                </div>
                <div className="dealer-order-detail-subtitle">{formatDateTime(order.createdAt)}</div>
              </div>
              <div className="dealer-order-detail-amount">
                <div className="dealer-order-side-label">Total Amount</div>
                <div className="dealer-order-detail-amount-value">{formatMoney(order?.totals?.total, order?.totals?.currency)}</div>
              </div>
            </div>

            <Surface padding={18} style={{ marginTop: 18, background: "var(--color-fog, #f5f5f7)" }}>
              <OrderMilestoneStepper order={order} />
            </Surface>

            <Surface padding={0} style={{ marginTop: 16, border: "1px solid rgba(0,0,0,.06)" }}>
              <div style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--color-graphite, #707070)" }}>
                Items ({(order.items || []).length})
              </div>
              <OrderItemsTable items={order.items || []} productsMap={productsMap} familyMap={familyMap} />
            </Surface>

            {(order.dealerNote || order.internalNote) ? (
              <Surface padding={14} style={{ marginTop: 16, display: "grid", gap: 8 }}>
                {order.dealerNote ? (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--color-graphite, #707070)" }}>Dealer Note</div>
                    <div style={{ marginTop: 3, fontSize: 12.5 }}>{order.dealerNote}</div>
                  </div>
                ) : null}
                {order.internalNote ? (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--color-graphite, #707070)" }}>Internal Note</div>
                    <div style={{ marginTop: 3, fontSize: 12.5 }}>{order.internalNote}</div>
                  </div>
                ) : null}
              </Surface>
            ) : null}
          </div>

          <div className="dealer-order-detail-sidebar">
            <OrderSummaryCard order={order} />
            <OrderInfoCard order={order} />
            <DeliveryDetailsCard order={order} />
          </div>
        </div>
      </Surface>

      <OrderDetailStyles />
    </div>
  );
}
