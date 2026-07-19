import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useToastQueue } from "./useToast.js";
import { useSwipeAction } from "./useSwipeAction.js";

// Mounted once in DealerDashboardPage.jsx. Bottom-docked above the cart
// pill/tab bar, swipe-down to dismiss with velocity-based release (spec:
// dismiss if |dy|/dt > 0.11 regardless of distance), rubber-banded against
// upward drags (can't be dragged past its resting position) via
// useSwipeAction's `invert` option - this toast commits at a POSITIVE y
// position (down), the reverse of the hook's default negative-commit
// convention (cart/order-card swipe-left). Uses transitions (data-enter
// toggling the transition-duration, not a second keyframe set) so a rapid
// second toast can retarget mid-flight.
export function MobileToastRenderer() {
  const { current, phase, dismiss } = useToastQueue();
  const swipe = useSwipeAction({
    axis: "y",
    invert: true,
    threshold: 40,
    onCommit: ({ passed }) => {
      if (passed) dismiss();
      return 0;
    },
  });

  const isEnterPhase = phase === "entering" || phase === "shown";
  const isVisible = phase === "shown";

  if (!current) return null;

  // react-hooks/refs false positive, confirmed by elimination: this is the
  // exact same ref={swipe.ref} {...swipe.handlers} pass-through pattern
  // DealerCartMobileView.jsx's CartLineRow and DealerOrdersMobileView.jsx's
  // OrderCardSwipe both use without any lint complaint - swipe.ref is a
  // plain ref object handed to the ref= prop, never dereferenced during
  // render. The rule only fires on THIS component specifically once it's
  // exported at module top level (tested: stripping every other line down
  // to just the hook call + these two JSX props still flags it, but the
  // identical shape as a local, unexported subcomponent doesn't).
  /* eslint-disable react-hooks/refs */
  return (
    <div
      ref={swipe.ref}
      {...swipe.handlers}
      className={`dealer-m-toast ${isVisible ? "visible" : ""} ${current.action ? "has-action" : ""}`}
      data-enter={isEnterPhase ? "true" : undefined}
    >
      {current.icon ? <DashboardIcon name={current.icon} size={16} strokeWidth={2} /> : null}
      <span className="dealer-m-toast-text">{current.message}</span>
      {current.action ? (
        <button
          type="button"
          className="dealer-m-toast-action"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            current.action.onClick();
            dismiss();
          }}
        >
          {current.action.label}
        </button>
      ) : null}
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
