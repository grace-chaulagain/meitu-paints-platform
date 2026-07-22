import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Scrolls to the top of the document on every route change (React Router
// doesn't do this itself - without it, navigating to a new page keeps
// whatever scroll position the previous page was at). A single scrollTo on
// mount/pathname-change is all this needs; an earlier version of this
// component re-forced the scroll position up to 6 times over a 250ms
// window after every navigation (immediately, on two animation frames, and
// via setTimeout at 0/80/250ms) to work around old mobile Safari scroll-
// restoration quirks - but that window meant any real scroll attempt (mouse
// wheel or trackpad) landing in the first ~250ms after a navigation got
// silently snapped back to the top, which read as the page being "locked".
//
// `behavior: "instant"` (not the bare `scrollTo(0, 0)` positional form) is
// required here: Bootstrap's CSS sets `:root { scroll-behavior: smooth }`
// globally, and the positional form inherits that, turning this jump into a
// ~400ms animation that fights any scroll the user starts during it - the
// exact same "locked" symptom the multi-timer version above used to cause,
// just from a different mechanism. Explicit "instant" bypasses CSS
// scroll-behavior regardless of cascade/specificity.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
