import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { playCompletion } from "../../dealer/mobile/completionFeedback.js";

const DEFAULT_HOLD_MS = 2500;

// §2.5. The actual chip-crossfade/rail-advance "morph" isn't orchestrated
// here - OwnerChip and OrderStatusRail already animate themselves the
// instant their `order` prop changes (that's what their own CSS
// transitions/crossfades are for), so a successful mutation's refetch
// alone produces the morph for free. What genuinely needs orchestration is
// timing: the transient "Verified · just now" callout, the hold-then-decay
// Undo window (reversible transitions only), and the eventual exit
// animation when an order is about to leave the caller's current filter.
//
// Contract for callers: call `celebrate()` right after a successful
// mutation. Render `celebration` via `CelebrationLine` (CelebrationLine.jsx
// - kept in its own file, not here, since a file exporting both a hook and
// components breaks React Fast Refresh) or your own markup. If the order no
// longer belongs in the current view, call `exitToward(direction)` - apply
// the matching `orderflow-card-exit-*` class from OrderTransitionStyles to
// the card and remove it from your list in that element's onTransitionEnd.
// If the filter still contains the order, never call exitToward - it just
// stays, transformed in place.
export function useOrderTransition() {
  const shouldReduceMotion = useReducedMotion();
  const [celebration, setCelebration] = useState(null); // { action, canUndo }
  const [exitDirection, setExitDirection] = useState(null); // null | "left" | "right" | "up"
  const holdTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(holdTimerRef.current), []);

  function retractUndo() {
    setCelebration((current) => (current ? { ...current, canUndo: false } : current));
  }

  function startHoldTimer(holdMs) {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(retractUndo, shouldReduceMotion ? Math.min(holdMs, 400) : holdMs);
  }

  // `kind` is the same "primary"|"destructive"|"bookkeeping" tag every
  // getTransitions() entry already carries - sound fires for real
  // fulfillment progress, never for a bookkeeping confirmation (§2.5).
  function celebrate({ action, kind = "primary", irreversible = true, holdMs = DEFAULT_HOLD_MS } = {}) {
    if (kind !== "bookkeeping") playCompletion();
    setCelebration({ action, canUndo: !irreversible });
    if (!irreversible) startHoldTimer(holdMs);
  }

  // Wire to the Undo button/celebration line's hover+focus - keeps the
  // affordance alive while the user is actually looking at it.
  function holdOpen() {
    clearTimeout(holdTimerRef.current);
  }

  function resumeCountdown(holdMs = DEFAULT_HOLD_MS) {
    if (celebration?.canUndo) startHoldTimer(holdMs);
  }

  function dismissCelebration() {
    clearTimeout(holdTimerRef.current);
    setCelebration(null);
  }

  function exitToward(direction) {
    setExitDirection(direction || "right");
  }

  return {
    celebration,
    exitDirection,
    isExiting: Boolean(exitDirection),
    celebrate,
    holdOpen,
    resumeCountdown,
    dismissCelebration,
    exitToward,
    shouldReduceMotion,
  };
}
