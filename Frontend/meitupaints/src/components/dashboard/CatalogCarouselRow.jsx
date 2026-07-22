import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "./DashboardIcons.jsx";

// Wraps a set of already-built cards (e.g. ProductFamilyCard) in an
// Apple-product-page-style horizontal scroll row: native momentum scroll
// (the browser's own physics — nothing to reinvent), scroll-snap so a
// stopped drag settles on a card edge, hover-revealed arrow buttons that
// page by roughly one viewport width, and an edge fade that only appears
// on the side that actually has more content. Generic on purpose - unlike
// AppleCardsCarousel.jsx (hardcoded marketing-card markup + a slice-swap
// "carousel" with no real scrolling), this only lays out whatever
// children it's given and never touches their content.
export default function CatalogCarouselRow({ children }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const measure = () => {
      const { scrollLeft, scrollWidth, clientWidth } = track;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    };

    measure();
    track.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(track);

    return () => {
      track.removeEventListener("scroll", measure);
      observer.disconnect();
    };
    // Re-measure whenever the set of cards changes (filtering/search can
    // change how many children this row has, which changes scrollWidth).
  }, [children]);

  function scrollByPage(direction) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div className="catalog-carousel-row">
      <div className="catalog-carousel-track" ref={trackRef} data-fade-left={canScrollLeft} data-fade-right={canScrollRight}>
        {Array.isArray(children)
          ? children.map((child) => (
              <div className="catalog-carousel-item" key={child.key}>
                {child}
              </div>
            ))
          : children}
      </div>

      <button
        type="button"
        className="catalog-carousel-arrow is-left"
        onClick={() => scrollByPage(-1)}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <DashboardIcon name="chevron" size={14} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button
        type="button"
        className="catalog-carousel-arrow is-right"
        onClick={() => scrollByPage(1)}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        tabIndex={canScrollRight ? 0 : -1}
      >
        <DashboardIcon name="chevron" size={14} strokeWidth={2.4} />
      </button>

      <style>{`
        .catalog-carousel-row{
          position:relative;
        }

        .catalog-carousel-track{
          display:flex;
          gap:20px;
          overflow-x:auto;
          scroll-snap-type:x proximity;
          scroll-padding-left:4px;
          padding:2px 4px 10px;
          margin:-2px -4px -10px;
          scrollbar-width:none;
          -ms-overflow-style:none;
        }

        .catalog-carousel-track::-webkit-scrollbar{
          display:none;
        }

        .catalog-carousel-track[data-fade-left="true"]{
          mask-image:linear-gradient(to right, transparent 0, black 32px);
          -webkit-mask-image:linear-gradient(to right, transparent 0, black 32px);
        }

        .catalog-carousel-track[data-fade-right="true"]{
          mask-image:linear-gradient(to left, transparent 0, black 32px);
          -webkit-mask-image:linear-gradient(to left, transparent 0, black 32px);
        }

        .catalog-carousel-track[data-fade-left="true"][data-fade-right="true"]{
          mask-image:linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%);
          -webkit-mask-image:linear-gradient(to right, transparent 0, black 32px, black calc(100% - 32px), transparent 100%);
        }

        .catalog-carousel-item{
          flex:0 0 288px;
          width:288px;
          scroll-snap-align:start;
        }

        .catalog-carousel-arrow{
          position:absolute;
          top:calc(50% - 10px);
          transform:translateY(-50%);
          width:36px;
          height:36px;
          border-radius:999px;
          border:1px solid var(--color-silver-mist, #e8e8ed);
          background:var(--surface-card, #ffffff);
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          opacity:0;
          pointer-events:none;
          transition:opacity 160ms cubic-bezier(.23,1,.32,1), transform 160ms cubic-bezier(.23,1,.32,1);
        }

        .catalog-carousel-arrow.is-left{ left:-8px; }
        .catalog-carousel-arrow.is-right{ right:-8px; }

        @media (hover:hover) and (pointer:fine){
          .catalog-carousel-row:hover .catalog-carousel-arrow:not(:disabled){
            opacity:1;
            pointer-events:auto;
          }
        }

        .catalog-carousel-arrow:disabled{
          opacity:0!important;
          pointer-events:none!important;
        }

        .catalog-carousel-arrow:active:not(:disabled){
          transform:translateY(-50%) scale(.94);
        }

        @media (prefers-reduced-motion: reduce){
          .catalog-carousel-track{ scroll-behavior:auto; }
          .catalog-carousel-arrow{ transition:none; }
        }
      `}</style>
    </div>
  );
}
