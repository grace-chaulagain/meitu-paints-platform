import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { couponTypeLabel, formatDateTime, formatMoney } from "../dashboard/coupons/couponFormatting.js";

const REDEMPTIONS_CAP = 50;

// Read-only on mobile - no raw redeem token is ever persisted (only its
// hash, per AdminCouponBatchDetailPage.jsx's own comment), so a past batch
// can only ever show coupon data, never a re-scannable QR. Delete (batch or
// individual coupon) stays desktop-only, matching this session's "rare
// destructive action" cut precedent.
export function AdminCouponBatchDetailMobileView({ summary, items, loading, loadError, onBack }) {
  if (!loading && (loadError || !summary)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Batch" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This batch could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to coupons
          </button>
        </div>
      </div>
    );
  }

  const redeemed = (items || []).filter((coupon) => coupon.status === "REDEEMED");

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Batch" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
          </>
        }
      >
        {summary ? (
          <>
            <MobilePushHeader title={summary.productName} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className="dealer-m-order-hero-headline">
                {summary.productName}
                {summary.bucketSize ? ` · ${summary.bucketSize}` : ""}
              </div>
              <div className="dealer-m-order-hero-sub">Generated {formatDateTime(summary.createdAt)}</div>
            </div>

            <div style={{ marginTop: 4 }}>
              <StatusChip tone={summary.type === "GOLDEN" ? "caution" : "positive"}>{couponTypeLabel(summary.type)}</StatusChip>
            </div>

            <div className="admin-m-card" style={{ marginTop: 16 }}>
              <div className="admin-m-section-title">Batch Summary</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{summary.totalCount}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Coupons</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{summary.unusedCount}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Unused</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{summary.redeemedCount}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Redeemed</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{formatMoney(summary.totalCashAmount)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Cash Liability</div>
                </div>
              </div>
            </div>

            <div className="admin-m-section-title">Redemptions {redeemed.length ? `· ${redeemed.length}` : ""}</div>
            {redeemed.length === 0 ? (
              <div className="admin-m-card">
                <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>No coupons from this batch have been redeemed yet.</div>
              </div>
            ) : (
              <div className="admin-m-card-list" style={{ marginTop: 10 }}>
                {redeemed.slice(0, REDEMPTIONS_CAP).map((coupon) => (
                  <div key={coupon._id} className="admin-m-card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{coupon.couponCode}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(coupon.cashAmount)}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-graphite, #707070)" }}>
                      {coupon.redeemedByDealerId?.companyName || "Unknown dealer"} · {coupon.painterId?.name || "Unknown painter"}
                    </div>
                  </div>
                ))}
                {redeemed.length > REDEMPTIONS_CAP ? (
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-graphite, #707070)", padding: "8px 0" }}>
                    +{redeemed.length - REDEMPTIONS_CAP} more on desktop
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </SkeletonSwap>
    </div>
  );
}
