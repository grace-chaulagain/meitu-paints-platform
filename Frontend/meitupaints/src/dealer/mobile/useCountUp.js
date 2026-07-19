import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

// Stripe-style stat count-up (spec §2.3): 0 -> value over 600ms ease-out,
// once per mount only - a stat re-rendering with a new number (e.g. a
// background refetch) must NOT re-trigger the animation, so the rAF loop
// only ever runs once per component lifetime, gated by startedRef.
export function useCountUp(target, { duration = 600 } = {}) {
  const numericTarget = Number(target) || 0;
  const [value, setValue] = useState(() => (prefersReducedMotion() ? numericTarget : 0));
  const animatedOnceRef = useRef(false);

  useEffect(() => {
    // Guards "once per mount", not "once ever, ignore every future target":
    // a stat can legitimately mount with a placeholder 0 before its RTK
    // Query data has settled (isLoading flips false a tick before the
    // fetched items land), then re-render moments later with the real
    // number. Without this branch the count-up would freeze on that first
    // stale 0 forever, since the effect below never re-runs after target
    // changes. A later target change snaps straight to the new value
    // instead of replaying the animation on every background refetch.
    function snapToTarget() {
      setValue(numericTarget);
    }

    if (animatedOnceRef.current) {
      snapToTarget();
      return undefined;
    }
    animatedOnceRef.current = true;

    if (prefersReducedMotion()) {
      snapToTarget();
      return undefined;
    }

    let raf = null;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(numericTarget * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [numericTarget, duration]);

  return value;
}
