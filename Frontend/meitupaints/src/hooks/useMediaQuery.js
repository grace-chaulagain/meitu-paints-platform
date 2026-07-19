import { useEffect, useState } from "react";

// Lazy-initialized so the correct layout paints on the very first render -
// no post-mount flash of the wrong layout, which a useEffect-driven initial
// value would cause. Safe for SSR-less Vite CSR (no hydration mismatch to
// worry about, unlike Next.js). Mirrors the addEventListener/addListener
// fallback already used ad hoc in meituColors.jsx, just shared and generic.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [query]);

  return matches;
}
