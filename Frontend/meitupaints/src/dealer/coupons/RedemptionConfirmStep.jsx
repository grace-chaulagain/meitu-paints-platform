import { PrimaryButton } from "../../components/dashboard/DashboardUI.jsx";
import { StepHeader } from "./wizardUI.jsx";

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function RedemptionConfirmStep({ coupon, selection, onConfirm, onBack, submitting, error }) {
  // No painterType at all (not even "RTP") means the painter-selection
  // wizard was skipped entirely - the new streamlined path for an expired
  // coupon, which is always cash-only regardless of who's selected, so
  // there's nothing meaningful to show in a "Painter" row at all here.
  const hasPainterInfo = Boolean(selection.painterId) || selection.painterType === "RTP";
  const painterLine = selection.painterId
    ? `${selection.painterName} (${selection.painterType})`
    : "Cash only — no painter profile recorded";

  return (
    <div>
      <StepHeader title="Confirm redemption" onBack={onBack} />

      <div style={{ padding: "16px 16px", borderRadius: 16, background: "var(--color-fog, #f5f5f7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--color-graphite, #707070)" }}>Coupon</span>
          <span style={{ fontWeight: 700 }}>{coupon.couponCode}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--color-graphite, #707070)" }}>Points</span>
          <span style={{ fontWeight: 700 }}>{coupon.points.toLocaleString()}</span>
        </div>
        {hasPainterInfo ? (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Painter</span>
            <span style={{ fontWeight: 700, textAlign: "right" }}>{painterLine}</span>
          </div>
        ) : null}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Cash to give painter</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{formatMoney(coupon.cashAmount)}</span>
        </div>
      </div>

      {coupon.isExpired ? (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(180,90,0,.08)", color: "#8a5300", fontSize: 12, fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
          This coupon has expired — redeeming it now pays out cash only. No painter needs to be selected.
        </div>
      ) : null}

      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(180,90,0,.08)", color: "#8a5300", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
        This action is final. The coupon cannot be redeemed again once confirmed.
      </div>

      {error ? (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 12.5, fontWeight: 600, textAlign: "center" }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <PrimaryButton onClick={onConfirm} disabled={submitting} style={{ width: "100%", justifyContent: "center", height: 48, fontSize: 15 }}>
          {submitting ? "Redeeming…" : "Confirm & Redeem"}
        </PrimaryButton>
      </div>
    </div>
  );
}
