import ViewModeToggle from "./ViewModeToggle.jsx";
import { VIEW_CHARTS, VIEW_DATA } from "./viewMode.js";

// Wraps a section so its summary (KPI tiles) stays pinned above the
// toggle while only the charts/tables below swap - the headline numbers
// are the section's answer, so asking to see the rows behind them
// shouldn't take them away.
//
// `data` is optional: sections that only have charts (or only tables)
// render without a toggle rather than offering an empty second view.
export default function SectionViewFrame({ summary = null, charts = null, data = null, view, onViewChange }) {
  const hasBoth = Boolean(charts) && Boolean(data);
  const activeView = hasBoth ? view : charts ? VIEW_CHARTS : VIEW_DATA;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {summary}

      {hasBoth ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ViewModeToggle value={activeView} onChange={onViewChange} />
        </div>
      ) : null}

      {/* Keyed so the incoming view plays its entrance instead of two
          different data shapes cross-fading through each other. */}
      <div className="iw-viewpane" key={activeView}>
        {activeView === VIEW_DATA ? data : charts}
      </div>

      <style>{`
        .iw-viewpane{
          display:grid; gap:14px;
          animation:iw-view-enter 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes iw-view-enter{
          from{ opacity:0; transform:translateY(4px); }
          to{ opacity:1; transform:none; }
        }
        @media (prefers-reduced-motion: reduce){
          .iw-viewpane{ animation:none; }
        }
      `}</style>
    </div>
  );
}
