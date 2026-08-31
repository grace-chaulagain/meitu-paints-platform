import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthProvider.jsx";
import { useGetCouponPreviewQuery, useRedeemCouponMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import PainterTypeStep from "./PainterTypeStep.jsx";
import TtpChoiceStep from "./TtpChoiceStep.jsx";
import TtpPainterSearchStep from "./TtpPainterSearchStep.jsx";
import RtpChoiceStep from "./RtpChoiceStep.jsx";
import RtpPainterSearchStep from "./RtpPainterSearchStep.jsx";
import RtpRegisterForm from "./RtpRegisterForm.jsx";
import RedemptionConfirmStep from "./RedemptionConfirmStep.jsx";

const ERROR_CONTENT = {
  COUPON_INVALID: {
    icon: "warning",
    title: "Invalid QR code",
    subtitle: "This QR code is invalid or was not issued by Meitu.",
  },
  COUPON_ALREADY_REDEEMED: {
    icon: "reject",
    title: "Already redeemed",
    subtitle: "This QR code has already been used to redeem the points inside.",
  },
  COUPON_EXPIRED: {
    icon: "warning",
    title: "Coupon expired",
    subtitle: "This coupon has expired and can no longer be redeemed.",
  },
  DEALER_NOT_APPROVED: {
    icon: "reject",
    title: "Dealer not approved",
    subtitle: "Only approved Meitu dealers can redeem coupons. Please contact Meitu admin.",
  },
  DISPATCHER_NOT_APPROVED: {
    icon: "reject",
    title: "Dispatcher not approved",
    subtitle: "Only approved Meitu dispatchers can redeem coupons. Please contact Meitu admin.",
  },
};

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function couponTypeLabel(type) {
  return type === "GOLDEN" ? "Golden Coupon" : "Green Coupon";
}

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(180deg, #fbfbfc, #f2f4f7)",
      }}
    >
      <DashboardUIStyles />
      <div style={{ width: "min(440px, 100%)" }}>{children}</div>
    </div>
  );
}

const EMPTY_SELECTION = { painterType: null, painterId: null, painterName: null };

export default function CouponRedeemPage() {
  const { token } = useParams();
  const { user } = useAuth();
  // Same page, same wizard, for either role - only the "back"/"done"
  // destination differs, since a dealer and dispatcher land on different
  // dashboards. RequireDealerOrDispatcher (main.jsx) guarantees the role is
  // one of these two.
  const homePath = user?.role === "DISPATCHER" ? "/dispatcher/dashboard" : "/dealer/catalog";
  const previewQuery = useGetCouponPreviewQuery(token);
  const [redeemCoupon, redeemState] = useRedeemCouponMutation();
  const [redeemed, setRedeemed] = useState(null);
  const [redeemError, setRedeemError] = useState("");

  // Simple step-stack so "back" always returns to the exact previous step,
  // even across the branching TTP/RTP sub-flows.
  const [stepStack, setStepStack] = useState(["preview"]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const step = stepStack[stepStack.length - 1];

  function pushStep(next) {
    setStepStack((prev) => [...prev, next]);
  }
  function popStep() {
    setStepStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  async function handleRedeem() {
    setRedeemError("");
    try {
      const result = await redeemCoupon({
        token,
        painterType: selection.painterType,
        painterId: selection.painterId,
      }).unwrap();
      setRedeemed(result);
    } catch (err) {
      setRedeemError(getQueryErrorMessage(err, "Redemption failed. Please try again."));
      previewQuery.refetch();
    }
  }

  // Checked before the loading/error branches below: redeeming invalidates
  // the same cache tag getCouponPreview provides, which triggers an
  // automatic background refetch of the (now "already redeemed") preview.
  // Once we've captured a successful redemption locally, it must always
  // win the render regardless of what that background refetch returns.
  if (!redeemed && previewQuery.isLoading) {
    return (
      <PageShell>
        <Surface padding={22}>
          <div style={{ height: 200, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </PageShell>
    );
  }

  if (!redeemed && previewQuery.error) {
    const code = previewQuery.error?.data?.code;
    const content = ERROR_CONTENT[code] || {
      icon: "warning",
      title: "Something went wrong",
      subtitle: getQueryErrorMessage(previewQuery.error, "Could not verify this coupon."),
    };
    return (
      <PageShell>
        <Surface padding={22}>
          <EmptyState icon={content.icon} title={content.title} subtitle={content.subtitle} />
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <Link to={homePath} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-azure, #0071e3)", textDecoration: "none" }}>
              Back to dashboard
            </Link>
          </div>
        </Surface>
      </PageShell>
    );
  }

  const coupon = redeemed || previewQuery.data;
  const alreadyRedeemedNow = Boolean(redeemed);

  if (alreadyRedeemedNow) {
    const painterLine = selection.painterId
      ? `Painter: ${selection.painterName}`
      : selection.painterType
        ? "Cash-only redemption — no painter profile recorded"
        : "";
    return (
      <PageShell>
        <Surface padding={26}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <img src="/meitulogo.svg" alt="Meitu Paints" style={{ height: 28 }} />
          </div>
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <Pill tone={coupon.type === "GOLDEN" ? "caution" : "positive"}>{couponTypeLabel(coupon.type)}</Pill>
          </div>
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <span
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "rgba(22,163,74,.1)",
                color: "#15803d",
              }}
            >
              <DashboardIcon name="checkmark" size={26} strokeWidth={2.4} />
            </span>
          </div>
          <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 650, color: "var(--color-graphite, #707070)" }}>
            Redeemed successfully. Give the painter:
          </div>
          <div style={{ marginTop: 6, textAlign: "center", fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-ink, #1d1d1f)" }}>
            {formatMoney(coupon.cashAmount)}
          </div>
          <div style={{ marginTop: 4, textAlign: "center", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
            Coupon {coupon.couponCode} &middot; {coupon.points} points
          </div>
          {painterLine ? (
            <div style={{ marginTop: 4, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
              {painterLine}
            </div>
          ) : null}
          {coupon.pointsAwarded === false && coupon.skipReason === "EXPIRED" ? (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(180,90,0,.08)",
                color: "#8a5300",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              This coupon had expired — it was redeemed for cash only, with no painter selected.
            </div>
          ) : null}
          <div style={{ marginTop: 22 }}>
            <Link to={homePath} style={{ textDecoration: "none" }}>
              <PrimaryButton style={{ width: "100%", justifyContent: "center" }}>Done</PrimaryButton>
            </Link>
          </div>
        </Surface>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Surface padding={26}>
        {step === "preview" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <img src="/meitulogo.svg" alt="Meitu Paints" style={{ height: 28 }} />
            </div>

            <div style={{ marginTop: 18, textAlign: "center" }}>
              <Pill tone={coupon.type === "GOLDEN" ? "caution" : "positive"}>{couponTypeLabel(coupon.type)}</Pill>
            </div>

            <div style={{ marginTop: 18, textAlign: "center", fontSize: 12.5, fontWeight: 650, color: "var(--color-graphite, #707070)" }}>
              Coupon {coupon.couponCode}
            </div>
            <div style={{ marginTop: 4, textAlign: "center", fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-ink, #1d1d1f)" }}>
              {formatMoney(coupon.cashAmount)}
            </div>
            <div style={{ marginTop: 4, textAlign: "center", fontSize: 13, color: "var(--color-graphite, #707070)" }}>
              {coupon.points.toLocaleString()} points &middot; expires {formatDate(coupon.expiresAt)}
            </div>

            {coupon.isExpired ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(180,90,0,.08)",
                  color: "#8a5300",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                This coupon expired on {formatDate(coupon.expiresAt)}. Redeeming it now pays out cash only, with no points added — you won't need to select a painter.
              </div>
            ) : null}

            <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
              <PrimaryButton
                onClick={() => pushStep(coupon.isExpired ? "confirm" : "painterType")}
                style={{ width: "100%", justifyContent: "center", height: 48, fontSize: 15 }}
              >
                {coupon.isExpired ? "Redeem for cash" : "Continue"}
              </PrimaryButton>
              <Link to={homePath} style={{ textDecoration: "none" }}>
                <GhostButton style={{ width: "100%", justifyContent: "center" }}>Cancel</GhostButton>
              </Link>
            </div>
          </>
        ) : step === "painterType" ? (
          <PainterTypeStep
            couponType={coupon.type}
            onBack={popStep}
            onSelectType={(painterType) => {
              // Company policy: Golden coupon points are reserved for TTP
              // accumulation only - an RTP redeeming a Golden coupon is
              // always cash-only, so the register-or-cash choice (and the
              // painter search/registration behind it) never appears at
              // all; go straight to confirming a cash-only redemption.
              if (painterType === "RTP" && coupon.type === "GOLDEN") {
                setSelection({ painterType: "RTP", painterId: null, painterName: null });
                pushStep("confirm");
                return;
              }
              setSelection({ ...EMPTY_SELECTION, painterType });
              pushStep(painterType === "TTP" ? "ttpChoice" : "rtpChoice");
            }}
          />
        ) : step === "ttpChoice" ? (
          <TtpChoiceStep
            onBack={popStep}
            onChooseLookup={() => pushStep("ttpSearch")}
            onChooseCashOnly={() => {
              setSelection({ painterType: "TTP", painterId: null, painterName: null });
              pushStep("confirm");
            }}
          />
        ) : step === "ttpSearch" ? (
          <TtpPainterSearchStep
            onBack={popStep}
            onSelect={(painter) => {
              setSelection({ painterType: "TTP", painterId: painter._id, painterName: painter.name });
              pushStep("confirm");
            }}
          />
        ) : step === "rtpChoice" ? (
          <RtpChoiceStep
            onBack={popStep}
            onChooseRegister={() => pushStep("rtpSearch")}
            onChooseCashOnly={() => {
              setSelection({ painterType: "RTP", painterId: null, painterName: null });
              pushStep("confirm");
            }}
          />
        ) : step === "rtpSearch" ? (
          <RtpPainterSearchStep
            onBack={popStep}
            onRegisterNew={() => pushStep("rtpRegister")}
            onSelect={(painter) => {
              setSelection({ painterType: "RTP", painterId: painter._id, painterName: painter.name });
              pushStep("confirm");
            }}
          />
        ) : step === "rtpRegister" ? (
          <RtpRegisterForm
            onBack={popStep}
            onRegistered={(painter) => {
              setSelection({ painterType: "RTP", painterId: painter._id, painterName: painter.name });
              pushStep("confirm");
            }}
          />
        ) : (
          <RedemptionConfirmStep
            coupon={coupon}
            selection={selection}
            onBack={popStep}
            onConfirm={handleRedeem}
            submitting={redeemState.isLoading}
            error={redeemError}
          />
        )}
      </Surface>
    </PageShell>
  );
}
