// Quiet "data is refreshing" indicator for the three ops portals (Admin,
// Factory, Dispatcher) - a 2px azure indeterminate bar, not a spinner and
// not a dimmed/overlaid list. Matches the pattern already shipped for the
// dealer mobile app (DealerMobileStyles.core.jsx's .dealer-m-refetch-
// hairline) exactly, just generalized under a portal-agnostic class name
// so it isn't scoped to dealer-mobile-only markup.
//
// Render unconditionally; it collapses to nothing when not visible - callers
// pass `visible={isFetching && !isLoading}` so the FIRST load (which has no
// prior data to show stale) still gets its own loading state, not this bar.
export default function OpsRefetchHairline({ visible }) {
  return (
    <div className={`ops-refetch-hairline ${visible ? "is-visible" : ""}`} aria-hidden="true">
      <style>{`
        .ops-refetch-hairline{
          position:relative;
          height:0;
          border-radius:999px;
          overflow:hidden;
          background:rgba(0,113,227,.14);
          opacity:0;
          transition:height 160ms ease-out, opacity 160ms ease-out, margin 160ms ease-out;
        }

        .ops-refetch-hairline.is-visible{
          height:2px;
          opacity:1;
          margin-bottom:12px;
        }

        .ops-refetch-hairline::after{
          content:"";
          position:absolute;
          top:0; bottom:0; left:-40%;
          width:40%;
          background:var(--color-azure, #0071e3);
          border-radius:999px;
        }

        .ops-refetch-hairline.is-visible::after{
          animation:opsRefetchSlide 1.1s ease-in-out infinite;
        }

        @keyframes opsRefetchSlide{
          0%{ left:-40%; }
          100%{ left:100%; }
        }

        @media (prefers-reduced-motion: reduce){
          .ops-refetch-hairline.is-visible::after{
            animation:none;
            left:0;
            width:100%;
            opacity:.5;
          }
        }
      `}</style>
    </div>
  );
}
