import { useRef } from "react";

const START_THRESHOLD_PX = 8;
const RUBBER_BAND_FACTOR = 0.15;
const RUBBER_BAND_MAX_PX = 24;
const VELOCITY_DISMISS = 0.11;
const DISTANCE_DISMISS_RATIO = 0.3;
const RELEASE_DISMISS_MS = 200;
const RELEASE_SPRING_MS = 300;

// Bespoke to MobileSheet - not the generic §4.6 useSwipeAction hook. This
// gesture has chrome-region gating (handle always drags, the close button
// never does, everywhere else only drags once the inner scroller is
// confirmed at the top) - concerns a reusable swipe-reveal hook shouldn't
// need to know about. This hook doesn't touch MobileSheet's phase lifecycle
// directly either - it just calls `onDismiss` once a release qualifies;
// the caller decides what "dismissed" means (mark it, call onClose, etc).
//
// The DOM refs are owned by the caller so its own phase-effect and this
// hook's drag handlers touch the exact same nodes rather than duplicating
// state. Live style writes only - transform/opacity are written directly on
// the node during the drag (no React state, no CSS variable on a shared
// parent), and a transition is applied only once the finger lifts, so the
// drag itself never fights a CSS transition mid-flight.
export function useSheetDrag({ sheetRef, scrimRef, scrollRef, onDismiss }) {
  const stateRef = useRef(null);

  function getSheetHeight() {
    return sheetRef.current?.getBoundingClientRect().height || 1;
  }

  function handlePointerDown(e) {
    if (e.target.closest?.(".dealer-m-sheet-close")) return; // never drags - let its own click fire untouched
    if (stateRef.current) return; // a drag is already in flight - ignore a second pointer

    const isHandle = Boolean(e.target.closest?.(".dealer-m-sheet-handle"));
    const scrollEl = scrollRef.current;
    const atTop = !scrollEl || scrollEl.scrollTop <= 0;

    stateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startTime: Date.now(),
      atTop,
      dragging: isHandle, // handle drags immediately; everywhere else waits for the threshold below
      offset: 0,
    };

    if (isHandle) {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (sheetRef.current) {
        sheetRef.current.style.transition = "none";
        sheetRef.current.style.touchAction = "none";
      }
    }
  }

  function handlePointerMove(e) {
    const state = stateRef.current;
    if (!state || e.pointerId !== state.pointerId) return;

    const deltaY = e.clientY - state.startY;

    if (!state.dragging) {
      if (deltaY > START_THRESHOLD_PX && state.atTop) {
        state.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (sheetRef.current) {
          sheetRef.current.style.transition = "none";
          sheetRef.current.style.touchAction = "none";
        }
      } else {
        return; // still a candidate - let native content scrolling happen
      }
    }

    const offset = deltaY < 0 ? -Math.min(RUBBER_BAND_MAX_PX, Math.abs(deltaY) * RUBBER_BAND_FACTOR) : deltaY;
    state.offset = offset;

    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${offset}px)`;
    if (scrimRef.current) {
      const ratio = Math.max(0, Math.min(1, 1 - offset / getSheetHeight()));
      scrimRef.current.style.opacity = String(ratio);
    }
  }

  function handlePointerUp(e) {
    const state = stateRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    stateRef.current = null;
    if (!state.dragging) return;

    if (sheetRef.current) sheetRef.current.style.touchAction = "";

    const elapsedMs = Math.max(1, Date.now() - state.startTime);
    const offset = state.offset;
    const sheetHeight = getSheetHeight();
    const velocity = Math.abs(offset) / elapsedMs;
    const shouldDismiss = offset > 0 && (velocity > VELOCITY_DISMISS || offset > sheetHeight * DISTANCE_DISMISS_RATIO);

    if (shouldDismiss) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = `transform ${RELEASE_DISMISS_MS}ms ease-out`;
        sheetRef.current.style.transform = `translateY(${sheetHeight}px)`;
      }
      if (scrimRef.current) {
        scrimRef.current.style.transition = `opacity ${RELEASE_DISMISS_MS}ms ease-out`;
        scrimRef.current.style.opacity = "0";
      }
      onDismiss?.();
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transition = `transform ${RELEASE_SPRING_MS}ms var(--ease-sheet, ease)`;
        sheetRef.current.style.transform = "translateY(0)";
      }
      if (scrimRef.current) {
        scrimRef.current.style.transition = `opacity ${RELEASE_SPRING_MS}ms var(--ease-sheet, ease)`;
        scrimRef.current.style.opacity = "1";
      }
    }
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };
}
