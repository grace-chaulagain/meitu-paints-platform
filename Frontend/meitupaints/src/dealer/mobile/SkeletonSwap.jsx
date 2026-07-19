import { useEffect, useRef, useState } from "react";

const SKELETON_OUT_MS = 150;

// V3 §5.5: shared skeleton -> content crossfade, replacing every dealer
// mobile page's own ad hoc instant swap (if(loading) return <skeleton/>).
// Mirrors MobileSheet.jsx's own phase machine (open/closing/closed):
// "loading" (skeleton showing, content unmounted) -> "leaving" (loading
// just went false - skeleton fading out while content is already mounted
// underneath, fading in) -> "done" (skeleton unmounted for good). Both
// layers share one CSS Grid cell (the same stacked-opacity technique
// BottomTabBar.jsx's TabGlyph already uses for its icon crossfade) so the
// fade is a real overlap, not skeleton-vanishes-then-content-appears.
export function SkeletonSwap({ loading, skeleton, children }) {
  const [phase, setPhase] = useState(loading ? "loading" : "done");
  const timerRef = useRef(null);

  function scheduleDone() {
    if (timerRef.current) return; // already scheduled - don't double up
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPhase("done");
    }, SKELETON_OUT_MS);
  }

  useEffect(() => {
    if (loading) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Bare value call, not wrapped in a setState updater - only the
      // ref-timer cleanup above needs the effect body itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("loading");
    } else {
      // Updater form (not a bare value) so this never needs `phase` as an
      // effect dependency and never risks a stale read of it - matches
      // MobileSheet.jsx's own close-branch precedent. scheduleDone() is
      // idempotent, so a StrictMode double-invoke can't double-schedule.
      setPhase((prev) => {
        if (prev === "done") return prev;
        scheduleDone();
        return "leaving";
      });
    }
  }, [loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="dealer-m-skeleton-swap">
      {phase !== "done" ? (
        <div className={`dealer-m-skeleton-swap-skel ${phase === "leaving" ? "leaving" : ""}`}>{skeleton}</div>
      ) : null}
      {phase !== "loading" ? <div className="dealer-m-skeleton-swap-content">{children}</div> : null}
    </div>
  );
}
