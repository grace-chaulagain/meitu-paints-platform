import { useEffect, useRef, useState } from "react";
import { useScrollInset } from "./useScrollInset.js";

// iOS large-title collapse (spec §2.1): the 34px in-flow title crossfades
// into a 44px pinned compact header once the page scrolls past ~32px.
// `.dashboard-main-shell` (DashboardShell.jsx) is the actual overflow:auto
// scroll container for every dashboard page - queried by class rather than
// threaded through props since every mobile dealer screen is a descendant
// of exactly one instance of it at a time.
const COLLAPSE_DISTANCE = 32;

// `trailing` (V3 §2) is generic - a trailing action rendered once in the
// large-title row and once in the compact pinned bar, each inheriting that
// container's existing --collapse-driven crossfade for free. This component
// stays unaware of what `trailing` IS (a search button, anything else) -
// only the caller (e.g. DealerCatalogMobileView) knows that.
//
// `contextLabel` (V3 §5.7) is a quiet secondary string shown ONLY in the
// compact pinned bar next to the title once scrolled (e.g. "Active · 2",
// "14 results") - orientation once the large title has scrolled out of
// view, never shown in the large-title state since there's no room/need
// for it there.
export function LargeTitleHeader({ title, eyebrow, size = "large", sticky, trailing, contextLabel }) {
  const [collapse, setCollapse] = useState(0);
  const insetTop = useScrollInset();
  const rafRef = useRef(null);

  useEffect(() => {
    const scrollEl = document.querySelector(".dashboard-main-shell");
    if (!scrollEl) return undefined;

    function measure() {
      rafRef.current = null;
      setCollapse(Math.max(0, Math.min(1, scrollEl.scrollTop / COLLAPSE_DISTANCE)));
    }
    function onScroll() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(measure);
    }

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // The compact header stays an unwrapped sibling of the page's full-height
  // container - position:sticky is constrained to its own immediate
  // parent's box, and a wrapper sized only to the title's own height would
  // give it just a few px of "track" before it runs out of room and
  // un-sticks. The large title + optional eyebrow (Home's date-above-
  // greeting) don't use sticky, so they're safe to share a small wrapper
  // that carries the crossfade opacity/transform as one group.
  const collapseVar = { "--collapse": collapse };
  return (
    <>
      <div className="dealer-m-compact-header" style={{ ...collapseVar, top: -insetTop }}>
        <span className="dealer-m-compact-header-title">{title}</span>
        {contextLabel ? <span className="dealer-m-compact-header-context">{contextLabel}</span> : null}
        {trailing ? <span className="dealer-m-compact-header-trailing">{trailing}</span> : null}
      </div>
      <div className="dealer-m-large-title-group" style={collapseVar}>
        {eyebrow ? <div className="dealer-m-large-title-eyebrow">{eyebrow}</div> : null}
        <div className="dealer-m-large-title-row">
          <div className={`dealer-m-large-title ${size === "medium" ? "dealer-m-large-title-medium" : ""}`}>{title}</div>
          {trailing ? <div className="dealer-m-large-title-trailing">{trailing}</div> : null}
        </div>
      </div>
      {sticky ? (
        <div className="dealer-m-sticky-under-header" style={{ ...collapseVar, top: 44 - insetTop }}>
          {sticky}
        </div>
      ) : null}
    </>
  );
}
