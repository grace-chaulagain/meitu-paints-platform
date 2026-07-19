import { useCallback, useRef } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";

// Sizes 28px (cart rows) and 44px (ProductSheet). Long-press repeats -
// "Haptic-feel via 100ms scale-to-0.92 press animation" (spec §4.3.5) is
// the :active CSS rule in dealerMobileStyles.jsx; this component only
// owns the value/repeat logic.
//
// `showRemoveHint` (V3 §4.2, opt-in) crossfades the decrement icon to a
// trash glyph once the *next* tap would remove the line (value === min+1,
// not value===1 literally - NewSaleMobileSheet's stepper has min=1, where
// literal-1 would show a trash icon on an already-disabled button that can
// never actually remove anything). Only DealerCartMobileView.jsx passes
// this - every other consumer is unaffected.
export function QuantityStepper({ value = 0, onChange, min = 0, max = 9999, size = 28, showRemoveHint = false }) {
  const repeatTimer = useRef(null);
  const repeatInterval = useRef(null);

  const step = useCallback(
    (delta) => {
      const next = Math.min(max, Math.max(min, Number(value || 0) + delta));
      if (next !== value) onChange?.(next);
    },
    [value, onChange, min, max],
  );

  const startRepeat = useCallback(
    (delta) => {
      step(delta);
      repeatTimer.current = setTimeout(() => {
        repeatInterval.current = setInterval(() => step(delta), 90);
      }, 420);
    },
    [step],
  );

  const stopRepeat = useCallback(() => {
    clearTimeout(repeatTimer.current);
    clearInterval(repeatInterval.current);
  }, []);

  const isLarge = size >= 40;
  const willRemove = showRemoveHint && value === min + 1;
  const iconSize = isLarge ? 16 : 12;

  return (
    <div className={`dealer-m-stepper ${isLarge ? "dealer-m-stepper-lg" : ""}`} style={{ "--dealer-m-stepper-size": `${size}px` }}>
      <button
        type="button"
        className="dealer-m-stepper-btn"
        aria-label={willRemove ? "Remove" : "Decrease quantity"}
        disabled={value <= min}
        onPointerDown={() => startRepeat(-1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        {showRemoveHint ? (
          <span className="dealer-m-stepper-icon-crossfade" style={{ width: iconSize, height: iconSize }}>
            <DashboardIcon name="minus" size={iconSize} strokeWidth={2.4} style={{ opacity: willRemove ? 0 : 1 }} />
            <DashboardIcon name="trash" size={iconSize} strokeWidth={2.4} style={{ opacity: willRemove ? 1 : 0 }} />
          </span>
        ) : (
          <DashboardIcon name="minus" size={iconSize} strokeWidth={2.4} />
        )}
      </button>
      <span className="dealer-m-stepper-value">{value}</span>
      <button
        type="button"
        className="dealer-m-stepper-btn"
        aria-label="Increase quantity"
        disabled={value >= max}
        onPointerDown={() => startRepeat(1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        <DashboardIcon name="plus" size={isLarge ? 16 : 12} strokeWidth={2.4} />
      </button>
    </div>
  );
}
