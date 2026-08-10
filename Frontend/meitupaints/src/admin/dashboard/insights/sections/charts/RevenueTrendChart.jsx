import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { compactCurrency, money, formatTrendLabel } from "../../insightsFormatting.js";
import { AZURE, GRAPHITE, GRIDLINE, CHART_MARGIN } from "./chartTheme.js";
import { ChartTooltip, EmptyChartNote } from "./ChartPrimitives.jsx";

// Single-series revenue trend: azure line/area, no legend (a single series
// needs none - the panel title already names what's plotted, per the
// dataviz skill's mark-and-anatomy rules and the project's own mobile
// design doc, which prescribes exactly this for this chart).
export default function RevenueTrendChart({ data = [], currency = "NPR", height = 220 }) {
  if (!data.length) return <EmptyChartNote>No trend signal yet.</EmptyChartNote>;

  return (
    <div style={{ padding: "8px 10px 4px" }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZURE} stopOpacity={0.1} />
              <stop offset="100%" stopColor={AZURE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRIDLINE} />
          <XAxis
            dataKey="label"
            tickFormatter={formatTrendLabel}
            tick={{ fontSize: 11, fill: GRAPHITE }}
            axisLine={{ stroke: GRIDLINE }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: GRAPHITE }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(value) => compactCurrency(value, currency)}
          />
          <Tooltip
            content={<ChartTooltip formatValue={(value) => money(value, currency)} />}
            labelFormatter={formatTrendLabel}
            cursor={{ stroke: GRIDLINE }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={AZURE}
            strokeWidth={2}
            fill="url(#revenueTrendFill)"
            dot={false}
            activeDot={{ r: 4, fill: AZURE, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
