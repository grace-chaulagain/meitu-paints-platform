// iOS UISegmentedControl equivalent (spec §2.4) - one sliding white thumb
// (a single absolutely-positioned element, never per-segment backgrounds
// fading independently) under equal-width segments. Replaces the
// independent filter-chip row pattern for Orders filters and the
// Inventory card/list toggle.
export function SegmentedControl({ options, value, onChange }) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );

  return (
    <div className="dealer-m-segmented" style={{ "--dealer-m-segment-count": options.length }}>
      <div className="dealer-m-segmented-thumb" style={{ transform: `translateX(${activeIndex * 100}%)` }} />
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`dealer-m-segmented-item ${option.key === value ? "active" : ""}`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
          {typeof option.count === "number" ? <span className="dealer-m-segmented-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
