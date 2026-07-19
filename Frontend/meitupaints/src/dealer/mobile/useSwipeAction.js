import { useRef } from "react";

const DEFAULT_THRESHOLD = 40;
const DEFAULT_VELOCITY = 0.11;
const DEFAULT_MAX_OVERSHOOT = 24;
const DEFAULT_RUBBER_BAND = 0.15;
const DRAG_START_SLOP = 6;
const SETTLE_TRANSITION = "transform 200ms var(--ease-sheet, ease)";

// Shared axis-agnostic swipe-reveal mechanics (V3 §4.1) - consumed by cart
// pack rows (swipe-left-to-remove, DealerCartMobileView.jsx) and order-
// history cards (swipe-left-to-reorder, V3 §5.6). Same pointer-capture/
// velocity-release shape as useSheetDrag.js, generalized; deliberately NOT
// used by MobileSheet's own drag (that stays bespoke - chrome-region
// gating and phase-lifecycle coupling don't belong in a reusable hook).
//
// Direct DOM style writes during the drag (never React state for the live
// position) - same reasoning as useSheetDrag.js: a re-render per
// pointermove is exactly the style-recalc cost the constitution rules out.
// `onCommit` is where the caller decides what "committing" means (reveal
// an action vs. spring closed) - this hook only does drag math, never
// removal/navigation logic.
// `invert` flips which side of 0 is the "wrong direction" that gets
// rubber-banded - the default (false) assumes the commit position is
// negative (swipe-left-to-reveal on the x axis, the common case here);
// MobileToast.jsx's swipe-down-to-dismiss commits at a POSITIVE y
// position instead, so it passes invert:true to rubber-band the negative
// (upward) side instead.
export function useSwipeAction({
  axis = "x",
  threshold = DEFAULT_THRESHOLD,
  velocityThreshold = DEFAULT_VELOCITY,
  maxOvershoot = DEFAULT_MAX_OVERSHOOT,
  rubberBand = DEFAULT_RUBBER_BAND,
  invert = false,
  onCommit,
} = {}) {
  const nodeRef = useRef(null);
  const posRef = useRef(0); // last settled/rest position - source of truth, not state
  const dragRef = useRef(null); // in-flight drag data
  const draggedRef = useRef(false); // click-guard: true past ~6px movement, cleared only at next pointerdown

  function applyTransform(px, animate) {
    const node = nodeRef.current;
    if (!node) return;
    node.style.transition = animate ? SETTLE_TRANSITION : "none";
    node.style.transform = axis === "x" ? `translateX(${px}px)` : `translateY(${px}px)`;
  }

  function handlePointerDown(e) {
    if (dragRef.current) return; // a drag is already in flight - ignore a second pointer
    dragRef.current = {
      pointerId: e.pointerId,
      start: axis === "x" ? e.clientX : e.clientY,
      startTime: Date.now(),
      startPos: posRef.current,
      lastPos: posRef.current,
    };
    draggedRef.current = false;
  }

  function handlePointerMove(e) {
    const state = dragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    const current = axis === "x" ? e.clientX : e.clientY;
    const delta = current - state.start;

    if (!draggedRef.current) {
      if (Math.abs(delta) < DRAG_START_SLOP) return; // still a candidate - not a real drag yet
      draggedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    let next = state.startPos + delta;
    // Rubber-band only the "wrong direction" past fully-closed (0) - the
    // reveal direction is left free since the wrapper's own overflow:hidden
    // + fixed-width action button naturally contain any overshoot there.
    if (invert ? next < 0 : next > 0) {
      next = invert ? Math.max(-maxOvershoot, next * rubberBand) : Math.min(maxOvershoot, next * rubberBand);
    }
    state.lastPos = next;
    applyTransform(next, false);
  }

  function handlePointerUp(e) {
    const state = dragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    dragRef.current = null;
    if (!draggedRef.current) return;

    const elapsedMs = Math.max(1, Date.now() - state.startTime);
    const gestureDelta = state.lastPos - state.startPos; // signed, this-gesture-only movement
    const velocity = Math.abs(gestureDelta) / elapsedMs;
    // A fast flick commits by THIS gesture's direction, regardless of
    // distance or where it started - swiping back out of an already-
    // revealed row is a flick toward 0 (the "wrong"/rubber-banded side),
    // so it must resolve to "not passed" (close), not re-trigger reveal.
    // A slow drag (no flick) instead falls back to the absolute rest
    // position, which already works symmetrically for both opening (from
    // 0) and closing (back past halfway from the revealed position).
    const passed =
      velocity > velocityThreshold ? (invert ? gestureDelta > 0 : gestureDelta < 0) : Math.abs(state.lastPos) > threshold;
    const next = onCommit ? onCommit({ pos: state.lastPos, passed, velocity }) : passed ? state.lastPos : 0;

    posRef.current = next;
    applyTransform(next, true);
  }

  // Imperative escape hatch so a parent can force this row to a specific
  // rest position (e.g. closing it when a sibling's swipe opens instead).
  function setPos(value) {
    posRef.current = value;
    applyTransform(value, true);
  }

  return {
    ref: nodeRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
    wasDragged: () => draggedRef.current,
    setPos,
  };
}
