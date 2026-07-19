// One chip component for every order/payment status shown on mobile - spec
// §5: "12px/600, 6px radius, tinted-bg-at-8% + full-strength text." Tone
// names match the existing Pill-tone vocabulary used everywhere else in
// this codebase (ORDER_STATUS_META/DISPLAY_BUCKET_META already return
// these exact tone strings) so callers never need a translation layer.
const TONE_COLORS = {
  neutral: "#707070",
  accent: "#0071e3",
  positive: "#1a7f37",
  caution: "#b64400",
  critical: "#b42318",
};

// `inverted` (spec §2.2): the Home Live Activity card is the one dark
// surface in the app - a tone-tinted chip designed for a white background
// reads muddy on ink, so that context asks for a flat white-on-translucent
// chip instead, independent of status tone.
export function StatusChip({ children, tone = "neutral", inverted = false }) {
  if (inverted) {
    return <span className="dealer-m-status-chip dealer-m-status-chip-inverted">{children}</span>;
  }
  const color = TONE_COLORS[tone] || TONE_COLORS.neutral;
  return (
    <span
      className="dealer-m-status-chip"
      style={{
        color,
        background: tone === "neutral" ? "var(--color-fog, #f5f5f7)" : `${color}14`,
      }}
    >
      {children}
    </span>
  );
}
