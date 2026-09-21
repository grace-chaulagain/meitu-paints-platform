import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { MetricTile } from "../../../components/dashboard/DashboardUI.jsx";
import { formatTrendLabel, money } from "./insightsFormatting.js";

// Trimmed in the Insights rebuild's Phase 4 cleanup: RankedBarList,
// InsightTable, SignalList, and InsightsFilterBar were only ever consumed
// by the now-deleted AdminInsightsMobileView.jsx and the old combined-blob
// desktop page - both retired. KpiTile and TrendChart survive because
// AdminHomeMobileView.jsx's "Morning Brief" revenue chart still uses them
// (see that file's own comment on why it still calls useGetAdminInsights,
// and Server/src/services/adminInsights.service.js's header comment).

export function EmptyNote({ children }) {
  return (
    <div style={{ padding: "16px 18px", fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------
// KPI tile - MetricTile plus an optional small up/down direction indicator
// for growth figures, without changing the shared MetricTile used elsewhere.
// ----------------------------------------------------------------------

export function KpiTile({ label, value, helper, icon, tone = "neutral", direction }) {
  return (
    <div style={{ position: "relative" }}>
      <MetricTile label={label} value={value} helper={helper} icon={icon} tone={tone} />
      {direction ? (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            color: direction === "up" ? "#15803d" : "#b42318",
          }}
        >
          <DashboardIcon
            name="trend"
            size={13}
            strokeWidth={2}
            style={{ transform: direction === "down" ? "rotate(90deg)" : "none" }}
          />
        </span>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// Trend chart - a single, minimal SVG line/area chart (no chart library).
// ----------------------------------------------------------------------

export function TrendChart({ data = [], currency = "NPR", height = 200 }) {
  if (!data.length) return <EmptyNote>No trend signal yet.</EmptyNote>;

  const visible = data.slice(-18);
  const max = Math.max(1, ...visible.map((point) => Number(point.revenue || 0)));
  const width = 100;
  const chartHeight = 40;
  const stepX = visible.length > 1 ? width / (visible.length - 1) : 0;

  const points = visible.map((point, index) => ({
    x: visible.length > 1 ? index * stepX : width / 2,
    y: chartHeight - (Number(point.revenue || 0) / max) * (chartHeight - 4),
    point,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L${last.x.toFixed(2)},${chartHeight} L${first.x.toFixed(2)},${chartHeight} Z`;
  const mid = points[Math.floor((points.length - 1) / 2)];

  return (
    <div style={{ padding: "16px 18px 14px" }}>
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="insightTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,113,227,.25)" />
            <stop offset="100%" stopColor="rgba(0,113,227,0)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#insightTrendFill)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-azure, #0071e3)"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r="2.2" fill="var(--color-azure, #0071e3)" stroke="#fff" strokeWidth="1">
          <title>{`${last.point.label}: ${money(last.point.revenue, currency)}`}</title>
        </circle>
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-graphite, #707070)",
        }}
      >
        <span>{formatTrendLabel(first.point.label)}</span>
        {points.length > 2 ? <span>{formatTrendLabel(mid.point.label)}</span> : null}
        <span>{formatTrendLabel(last.point.label)}</span>
      </div>
    </div>
  );
}
