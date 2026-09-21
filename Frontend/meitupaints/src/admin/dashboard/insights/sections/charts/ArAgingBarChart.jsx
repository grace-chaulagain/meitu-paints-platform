import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

import { AR_AGING_RAMP, GRAPHITE, GRIDLINE, INK } from "./chartTheme.js";
import { ChartTooltip, EmptyChartNote } from "./ChartPrimitives.jsx";

// Ordinal ramp (one hue, monotone light->dark = mild->severe) - swapping
// bucket order would change the meaning, so per the dataviz skill this is
// an ordinal job, not categorical. Ramp validated in chartTheme.js.
export default function ArAgingBarChart({ items = [], formatValue = (v) => v, height = 200 }) {
  if (!items.length) return <EmptyChartNote>No outstanding orders older than today.</EmptyChartNote>;

  return (
    <div style={{ padding: "8px 10px 4px" }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRIDLINE} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: GRAPHITE, fontWeight: 600 }}
            axisLine={{ stroke: GRIDLINE }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ fill: "rgba(29,29,31,.04)" }} />
          <Bar dataKey="outstanding" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {items.map((item, index) => (
              <Cell key={item.bucket} fill={AR_AGING_RAMP[index] || AR_AGING_RAMP[AR_AGING_RAMP.length - 1]} />
            ))}
            <LabelList dataKey="outstanding" position="top" formatter={formatValue} style={{ fontSize: 11, fontWeight: 700, fill: INK }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
