import { AppleSpinner } from "./AppleSpinner.jsx";

// The one azure button per mobile screen (spec §5/§8: "exactly one azure
// element visible per screen" - V2 amends this to "one azure CTA + the
// active tab tint"). 52px tall (grows for `subtext`), full width, loading
// swaps the label for a spinner without changing the button's width (no
// layout jump). `variant="secondary"` is the plain ink-bordered style used
// for non-destructive-but-not-primary actions (e.g. ProductSheet's "Remove
// from order" - still one button, still full width, just not azure).
export function PrimaryButton({
  children,
  subtext,
  onClick,
  disabled = false,
  loading = false,
  type = "button",
  variant = "primary",
  style = {},
}) {
  return (
    <button
      type={type}
      className={`dealer-m-primary-btn ${variant === "secondary" ? "dealer-m-primary-btn-secondary" : ""}`}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
    >
      <span className="dealer-m-primary-btn-content" style={{ opacity: loading ? 0 : 1 }}>
        <span className="dealer-m-primary-btn-label">{children}</span>
        {subtext ? <span className="dealer-m-primary-btn-subtext">{subtext}</span> : null}
      </span>
      {loading ? (
        <span className="dealer-m-primary-btn-spinner">
          <AppleSpinner size={20} color={variant === "secondary" ? "var(--color-ink, #1d1d1f)" : "#fff"} />
        </span>
      ) : null}
    </button>
  );
}
