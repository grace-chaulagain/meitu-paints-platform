import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";

// Shared "‹ Back" + title row used at the top of every step in the coupon
// redemption wizard (CouponRedeemPage.jsx and its step components).
export function StepHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "none",
          background: "var(--color-fog, #f5f5f7)",
          color: "var(--color-ink, #1d1d1f)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
      </button>
      <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{title}</span>
    </div>
  );
}

// Large tappable choice card - shared by PainterTypeStep (TTP/RTP) and
// RtpChoiceStep (register/cash-only). Dealer UX is mobile-first, so choices
// are big finger-friendly tap targets rather than a dropdown.
export function ChoiceCard({ icon, title, subtitle, onClick, tone = "neutral" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 16px",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,.08)",
        background: "#fff",
        cursor: "pointer",
        textAlign: "left",
      }}
      className="coupon-wizard-choice-card"
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: tone === "accent" ? "rgba(0,113,227,.1)" : "var(--color-fog, #f5f5f7)",
          color: tone === "accent" ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)",
        }}
      >
        <DashboardIcon name={icon} size={19} strokeWidth={1.8} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{title}</div>
        <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{subtitle}</div>
      </div>
      <DashboardIcon
        name="chevron"
        size={14}
        strokeWidth={2.2}
        style={{ marginLeft: "auto", flexShrink: 0, color: "var(--color-graphite, #707070)" }}
      />
    </button>
  );
}

// A masked painter search result row - shared by TtpPainterSearchStep and
// RtpPainterSearchStep.
export function PainterResultRow({ painter, maskedIdLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,.07)",
        background: "#fff",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{painter.name}</div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
          {maskedIdLabel}
        </div>
      </div>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ flexShrink: 0, color: "var(--color-graphite, #707070)" }} />
    </button>
  );
}

