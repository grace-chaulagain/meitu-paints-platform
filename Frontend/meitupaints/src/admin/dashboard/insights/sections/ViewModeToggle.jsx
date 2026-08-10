// Charts / Data switch shown at the top of every section that has both.
// A single absolutely-positioned thumb slides between the two segments
// (one moving element, transform-only) rather than each segment fading
// its own background - so a rapid double-tap retargets smoothly from
// wherever the thumb currently is instead of restarting.
import { VIEW_CHARTS, VIEW_DATA } from "./viewMode.js";

const OPTIONS = [
  { key: VIEW_CHARTS, label: "Charts" },
  { key: VIEW_DATA, label: "Data" },
];

export default function ViewModeToggle({ value, onChange }) {
  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((option) => option.key === value),
  );

  return (
    <div className="iw-viewtoggle" role="tablist" aria-label="Section view">
      <span
        className="iw-viewtoggle-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`iw-viewtoggle-item ${active ? "active" : ""}`}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        );
      })}

      <style>{`
        .iw-viewtoggle{
          position:relative;
          display:inline-grid;
          grid-template-columns:repeat(2, minmax(72px, 1fr));
          padding:2px;
          border-radius:10px;
          background:var(--color-fog, #f5f5f7);
          border:1px solid var(--color-silver-mist, #e8e8ed);
        }
        .iw-viewtoggle-thumb{
          position:absolute; top:2px; bottom:2px; left:2px;
          width:calc(50% - 2px);
          border-radius:8px;
          background:var(--color-snow, #fff);
          border:1px solid rgba(29,29,31,.06);
          transition:transform 250ms cubic-bezier(0.32, 0.72, 0, 1);
        }
        .iw-viewtoggle-item{
          position:relative;
          min-height:30px; padding:0 14px;
          border:none; background:transparent; cursor:pointer;
          font-size:13px; font-weight:500;
          color:var(--color-graphite, #707070);
          border-radius:8px;
          transition:color 150ms ease-out, transform 120ms ease-out;
        }
        .iw-viewtoggle-item.active{ color:var(--color-ink, #1d1d1f); font-weight:600; }
        .iw-viewtoggle-item:active{ transform:scale(0.97); }

        @media (hover:hover) and (pointer:fine){
          .iw-viewtoggle-item:not(.active):hover{ color:var(--color-ink, #1d1d1f); }
        }
        @media (prefers-reduced-motion: reduce){
          .iw-viewtoggle-thumb{ transition:none; }
          .iw-viewtoggle-item{ transition:none; }
          .iw-viewtoggle-item:active{ transform:none; }
        }
      `}</style>
    </div>
  );
}
