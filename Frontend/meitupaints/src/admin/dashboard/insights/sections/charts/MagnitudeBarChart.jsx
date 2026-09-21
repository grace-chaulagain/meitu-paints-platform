import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

import { AZURE, GRAPHITE, GRIDLINE } from "./chartTheme.js";
import { ChartTooltip, EmptyChartNote } from "./ChartPrimitives.jsx";

// Single-hue horizontal ranking bar - "compare magnitude" is the job here
// (payment-method mix, dealer/product/dispatcher leaderboards), not
// "distinguish identity" (each bar's label already carries that), so per
// the dataviz skill's own form-selection rule, sequential/single-hue is
// the right choice, not a categorical palette.
export default function MagnitudeBarChart({
  items = [],
  labelKey = "label",
  valueKey = "value",
  formatValue = (v) => v,
  height,
  empty = "No data yet.",
}) {
  if (!items.length) return <EmptyChartNote>{empty}</EmptyChartNote>;
  const chartHeight = height || Math.max(120, items.length * 36 + 20);

  return (
    <div style={{ padding: "8px 10px 4px" }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={GRIDLINE} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey={labelKey}
            tick={{ fontSize: 12, fill: GRAPHITE, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ fill: "rgba(0,113,227,.06)" }} />
          <Bar dataKey={valueKey} fill={AZURE} radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList
              dataKey={valueKey}
              position="right"
              formatter={formatValue}
              style={{ fontSize: 11.5, fontWeight: 700, fill: "#1d1d1f" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
