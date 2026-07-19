import { useEffect } from "react";

// Module-level (not per-hook-instance) reference count, so a sheet stacked
// on top of another sheet - or a toast surviving underneath one - doesn't
// unlock the body the moment the first one closes while a second is still
// open. Uses the iOS-Safari-proof technique (position:fixed + a negative
// top offset holding the visual scroll position, restored on unlock) since
// plain `overflow:hidden` on body doesn't stop iOS's touch-scroll chaining.
let lockCount = 0;
let savedScrollY = 0;

export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = "100%";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active]);
}
