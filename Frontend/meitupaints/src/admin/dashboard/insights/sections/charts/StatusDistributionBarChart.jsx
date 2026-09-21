import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

import { number } from "../../insightsFormatting.js";
import { statusColor, GRAPHITE, GRIDLINE, INK } from "./chartTheme.js";
import { ChartTooltip, EmptyChartNote } from "./ChartPrimitives.jsx";

// Order status is a real state (SUBMITTED -> VERIFIED/DISPATCHED ->
// COMPLETED, or REJECTED/CANCELLED off-ramps) - a genuine status job, so
// each column wears Meitu's existing status tone rather than a generic
// categorical hue (per the dataviz skill: "when a series means good/bad
// it wears status tokens... never both in one chart").
export default function StatusDistributionBarChart({ items = [], height = 200 }) {
  if (!items.length) return <EmptyChartNote>No orders in this window.</EmptyChartNote>;

  return (
    <div style={{ padding: "8px 10px 4px" }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRIDLINE} />
          <XAxis
            dataKey="status"
            tick={{ fontSize: 11, fill: GRAPHITE, fontWeight: 600 }}
            axisLine={{ stroke: GRIDLINE }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={<ChartTooltip formatValue={(value) => `${number(value)} orders`} />}
            cursor={{ fill: "rgba(29,29,31,.04)" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {items.map((item) => (
              <Cell key={item.status} fill={statusColor(item.status)} />
            ))}
            <LabelList dataKey="count" position="top" formatter={number} style={{ fontSize: 11.5, fontWeight: 700, fill: INK }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
