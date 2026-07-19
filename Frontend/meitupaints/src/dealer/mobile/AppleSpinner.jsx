// The iOS activity indicator: 8 rounded-rect spokes at fixed, pre-staggered
// opacities (leading spoke brightest, trailing spokes fading), the whole
// assembly spun by a single CSS rotation - not 8 independently-animated
// opacities. Sizes: 16 (in-button, e.g. PrimaryButton loading state) / 28
// (inline, e.g. a card's own in-flight indicator).
const SPOKE_COUNT = 8;
const SPOKE_OPACITIES = [1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.22, 0.15];

export function AppleSpinner({ size = 16, color }) {
  const spokeColor = color || "var(--color-graphite, #707070)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="dealer-m-apple-spinner"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {Array.from({ length: SPOKE_COUNT }).map((_, i) => (
        <rect
          key={i}
          x="9.25"
          y="1.5"
          width="1.5"
          height="5"
          rx="0.75"
          fill={spokeColor}
          opacity={SPOKE_OPACITIES[i]}
          transform={`rotate(${i * 45} 10 10)`}
        />
      ))}
    </svg>
  );
}
