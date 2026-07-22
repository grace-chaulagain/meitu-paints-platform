import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useBodyScrollLock } from "./useBodyScrollLock.js";
import { useSheetDrag } from "./useSheetDrag.js";

const EXIT_DURATION_MS = 250;
const DRAG_EXIT_DURATION_MS = 200;

// Generic animated bottom-sheet shell (scrim + portal + grab handle + close
// button + scrollable body + optional sticky footer), extracted from the
// original ProductSheet so ProductSheet, the Cart confirm sheet, and
// NewSaleModal (mobile) all share one animated container instead of three
// copies of the same scrim/spring CSS (spec §6). `height="full"` is the
// 92%-tall variant used by NewSaleModal; default is content-height-driven
// (max 85vh), used by ProductSheet/confirm sheets.
//
// V3 §1: a real drawer, not a mount/unmount switch. `phase` stays mounted
// through the close animation instead of the old `if (!open) return null`,
// which made every close (scrim tap, submit, programmatic) vanish in one
// frame. IMPORTANT for callers: this only works if the caller keeps
// rendering `<MobileSheet open={false}>` while closing rather than removing
// the element outright - see ProductSheet.jsx/DealerSalesMobileView.jsx's
// "retain last content" pattern for the two consumers that needed that fix.
//
// `phase` is one of "open" | "closing" | "closing-drag" | "closed" - the
// drag/non-drag distinction lives IN the phase value itself (not a second
// piece of state that has to stay in sync with it), so there's nothing to
// reset on reopen and no risk of the two ever disagreeing. "closing-drag"
// skips the CSS `.closing` keyframe entirely, since a drag release already
// animated the sheet to its dismissed position via its own inline-style
// transition (useSheetDrag.js) - applying the keyframe on top would restart
// the motion from scratch.
//
// `handleCoachMark` (V3 §5.8) is a generic opt-in slot, same shape as
// LargeTitleHeader's `trailing` - this component stays unaware of WHY the
// handle should dip (a first-open hint), only that it should. Only
// ProductSheet.jsx passes it, gated by its own once-ever localStorage
// check; every other MobileSheet consumer leaves it at the default false.
//
// `dragDisabled` (default false, additive - no existing caller passes it,
// so behavior is unchanged for all of them) blocks drag-to-dismiss, e.g.
// TransitionConfirmSheet while its confirm mutation is in flight.
export function MobileSheet({ open, onClose, ariaLabel, height = "auto", children, footer, handleCoachMark = false, dragDisabled = false }) {
  const [phase, setPhase] = useState(open ? "open" : "closed");
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  const scrollRef = useRef(null);
  const unmountTimerRef = useRef(null);

  function scheduleUnmount(ms) {
    if (unmountTimerRef.current) return; // already scheduled - don't double up
    unmountTimerRef.current = setTimeout(() => {
      unmountTimerRef.current = null;
      setPhase("closed");
    }, ms);
  }

  useEffect(() => {
    if (open) {
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      // Drop any inline transform/opacity/transition a prior drag left
      // behind - covers both a fresh open and the "reopened while still
      // closing" defensive case below.
      if (sheetRef.current) sheetRef.current.style.cssText = "";
      if (scrimRef.current) scrimRef.current.style.cssText = "";
      // This effect does real DOM/timer synchronization above, not just
      // mirroring a prop into state - genuinely needs to be an effect.
      // IMPORTANT: keep this a bare value call, never wrap side effects
      // inside a setState updater function (the `setPhase(prev => ...)`
      // form) - React (StrictMode, and potentially concurrent features
      // generally) may invoke updater functions twice to check purity,
      // which would double-clear these styles and clobber a live drag's
      // in-flight inline transform out from under it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("open");
    } else {
      setPhase((prev) => {
        if (prev === "closed" || prev === "closing-drag") return prev; // nothing to animate out, or the drag path already scheduled its own unmount
        scheduleUnmount(EXIT_DURATION_MS);
        return "closing";
      });
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, []);

  // Locked for the whole open+closing duration, not just while `open` is
  // literally true - unlocking early would snap the page's scroll position
  // back mid-exit-animation.
  useBodyScrollLock(phase !== "closed");

  const dragHandlers = useSheetDrag({
    sheetRef,
    scrimRef,
    scrollRef,
    disabled: dragDisabled,
    onDismiss: () => {
      setPhase("closing-drag");
      scheduleUnmount(DRAG_EXIT_DURATION_MS);
      onClose();
    },
  });

  if (phase === "closed") return null;

  const closing = phase === "closing";

  return createPortal(
    <div
      ref={scrimRef}
      className={`dealer-m-sheet-scrim ${closing ? "closing" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={sheetRef}
        className={`dealer-m-sheet ${height === "full" ? "dealer-m-sheet-full" : ""} ${closing ? "closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        {...dragHandlers}
      >
        <div className={`dealer-m-sheet-handle ${handleCoachMark ? "coachmark" : ""}`} />
        <button type="button" className="dealer-m-sheet-close" onClick={onClose} aria-label="Close">
          <DashboardIcon name="close" size={14} strokeWidth={2.2} />
        </button>
        <div className="dealer-m-sheet-scroll" ref={scrollRef}>
          {children}
        </div>
        {footer ? <div className="dealer-m-sheet-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
