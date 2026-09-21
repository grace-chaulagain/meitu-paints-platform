import { GRAPHITE, INK } from "./chartTheme.js";

// Shared tooltip shell for every recharts chart in the account-keeping
// section - per the dataviz skill, every chart ships a hover layer by
// default (step 5), this is the one visual for it.
export function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(29,29,31,.1)",
        borderRadius: 10,
        padding: "8px 11px",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,.10)",
      }}
    >
      {label ? (
        <div style={{ color: GRAPHITE, fontWeight: 500, marginBottom: 3 }}>{label}</div>
      ) : null}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} style={{ color: INK, fontWeight: 700 }}>
          {formatValue ? formatValue(entry.value, entry) : entry.value}
        </div>
      ))}
    </div>
  );
}

export function EmptyChartNote({ children = "No data for this window yet." }) {
  return (
    <div
      style={{
        padding: "28px 18px",
        textAlign: "center",
        fontSize: 12.5,
        fontWeight: 500,
        color: GRAPHITE,
      }}
    >
      {children}
    </div>
  );
}
