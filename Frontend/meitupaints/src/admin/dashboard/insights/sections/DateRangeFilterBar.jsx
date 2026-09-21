import { useState } from "react";

import { GhostButton, Pill } from "../../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import { AppleDateField, AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import { DATE_PRESETS, formatDate } from "../insightsFormatting.js";

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--color-graphite, #707070)",
};

function rangeChipLabel(preset, from, to) {
  if (preset === "custom") {
    if (!from && !to) return "Custom range";
    return `${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}`;
  }
  return DATE_PRESETS.find((option) => option.key === preset)?.label || "Last 30 days";
}

// The account-keeping sections (Cash Position, Statements & AR,
// Reconciliation, Order Analytics, Performance) only accept a date-range
// filter today - the legacy InsightsFilterBar's dealer/dispatcher/status/
// category controls don't apply to any of them, so this bar is deliberately
// simpler rather than showing dead controls that quietly do nothing.
export default function DateRangeFilterBar({ preset, from, to, onChange, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const isAllTime = preset === "all";

  function updatePreset(value) {
    onChange({ preset: value });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 32,
            padding: "0 12px",
            borderRadius: 999,
            border: "none",
            background: expanded ? "rgba(0,113,227,.1)" : "var(--color-fog, #f5f5f7)",
            color: expanded ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <DashboardIcon name="filter" size={13} strokeWidth={1.9} />
          Date range
          <DashboardIcon
            name="chevron"
            size={11}
            strokeWidth={2}
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .15s ease" }}
          />
        </button>

        <Pill tone="neutral" size="small">{rangeChipLabel(preset, from, to)}</Pill>

        <div style={{ marginLeft: "auto" }}>
          <GhostButton onClick={onReset}>Reset</GhostButton>
        </div>
      </div>

      {expanded ? (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "var(--color-fog, #f5f5f7)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>Range</span>
            <AppleDropdown value={preset} options={DATE_PRESETS} onChange={updatePreset} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>From</span>
            <AppleDateField value={from} disabled={isAllTime} onChange={(value) => onChange({ preset: "custom", from: value })} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>To</span>
            <AppleDateField value={to} disabled={isAllTime} onChange={(value) => onChange({ preset: "custom", to: value })} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
