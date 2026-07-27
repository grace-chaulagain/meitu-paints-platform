import { useMemo, useRef, useState } from "react";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  MetricTile,
  Pill,
  PrimaryButton,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import {
  DATE_PRESETS,
  ROUTING_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
  formatTrendLabel,
  money,
  rangeForPreset,
} from "./insightsFormatting.js";

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--color-graphite, #707070)",
};

export function EmptyNote({ children }) {
  return (
    <div style={{ padding: "16px 18px", fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------
// Filters: a plain-language chip strip that is always visible (so the
// active scope - e.g. "Accepted orders only, last 30 days" - is never a
// silent surprise) which expands into the actual controls on demand.
// ----------------------------------------------------------------------

function rangeChipLabel(filters) {
  if (filters.preset === "custom") {
    if (!filters.from && !filters.to) return "Custom range";
    return `${filters.from ? formatDate(filters.from) : "…"} – ${filters.to ? formatDate(filters.to) : "…"}`;
  }
  return DATE_PRESETS.find((option) => option.key === filters.preset)?.label || "Last 30 days";
}

function routingChipLabel(filters, dispatchers) {
  if (filters.dispatcherId) {
    return dispatchers.find((item) => item.id === filters.dispatcherId)?.label || "One dispatcher";
  }
  return ROUTING_OPTIONS.find((option) => option.key === filters.routing)?.label || "All routing";
}

function dealerChipLabel(filters, dealers) {
  if (filters.dealerId) {
    return dealers.find((item) => item.id === filters.dealerId)?.label || "One dealer";
  }
  if (filters.dealerState === "ACTIVE_ONLY") return "Active dealers only";
  if (filters.dealerState === "DORMANT_ONLY") return "Dormant dealers only";
  return "All dealers";
}

export function InsightsFilterBar({ filters, setFilters, options, loading, onRefresh, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const dealers = options.dealers || [];
  const dispatchers = options.dispatchers || [];
  const categories = Array.from(
    new Set([
      ...(filters.category !== "ALL" ? [filters.category] : []),
      ...(options.categories || []),
    ]),
  );

  const routingValue = filters.dispatcherId ? `DISPATCHER:${filters.dispatcherId}` : filters.routing;
  const dealerValue = filters.dealerId ? `DEALER:${filters.dealerId}` : filters.dealerState;
  const isAllTime = filters.preset === "all";

  function updatePreset(value) {
    if (value === "custom") {
      setFilters((current) => ({ ...current, preset: value }));
      return;
    }
    setFilters((current) => ({ ...current, preset: value, ...rangeForPreset(value) }));
  }

  function updateRouting(value) {
    if (value.startsWith("DISPATCHER:")) {
      setFilters((current) => ({ ...current, routing: "DISPATCHER_ALL", dispatcherId: value.split(":")[1] || "" }));
      return;
    }
    setFilters((current) => ({ ...current, routing: value, dispatcherId: "" }));
  }

  function updateDealer(value) {
    if (value.startsWith("DEALER:")) {
      setFilters((current) => ({ ...current, dealerId: value.split(":")[1] || "", dealerState: "ALL" }));
      return;
    }
    setFilters((current) => ({ ...current, dealerState: value, dealerId: "" }));
  }

  const routingOptions = [
    ...ROUTING_OPTIONS,
    ...dispatchers.map((dispatcher) => ({ key: `DISPATCHER:${dispatcher.id}`, label: dispatcher.label })),
  ];
  const dealerOptions = [
    { key: "ALL", label: "All dealers" },
    { key: "ACTIVE_ONLY", label: "Active only" },
    { key: "DORMANT_ONLY", label: "Dormant only" },
    ...dealers.map((dealer) => ({ key: `DEALER:${dealer.id}`, label: dealer.label })),
  ];
  const categoryOptions = [
    { key: "ALL", label: "All categories" },
    ...categories.map((category) => ({ key: category, label: category })),
  ];

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
          Filters
          <DashboardIcon
            name="chevron"
            size={11}
            strokeWidth={2}
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .15s ease" }}
          />
        </button>

        <Pill tone="accent" size="small">{STATUS_OPTIONS.find((o) => o.key === filters.status)?.label || "All statuses"}</Pill>
        <Pill tone="neutral" size="small">{rangeChipLabel(filters)}</Pill>
        {filters.routing !== "ALL" || filters.dispatcherId ? (
          <Pill tone="neutral" size="small">{routingChipLabel(filters, dispatchers)}</Pill>
        ) : null}
        {filters.dealerId || filters.dealerState !== "ALL" ? (
          <Pill tone="neutral" size="small">{dealerChipLabel(filters, dealers)}</Pill>
        ) : null}
        {filters.category !== "ALL" ? (
          <Pill tone="neutral" size="small">{filters.category}</Pill>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <GhostButton onClick={onReset}>Reset</GhostButton>
          <PrimaryButton onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </PrimaryButton>
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
            <AppleDropdown value={filters.preset} options={DATE_PRESETS} onChange={updatePreset} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>From</span>
            <AppleDateField
              value={filters.from}
              disabled={isAllTime}
              onChange={(value) => setFilters((current) => ({ ...current, preset: "custom", from: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>To</span>
            <AppleDateField
              value={filters.to}
              disabled={isAllTime}
              onChange={(value) => setFilters((current) => ({ ...current, preset: "custom", to: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>Routing</span>
            <AppleDropdown value={routingValue} options={routingOptions} onChange={updateRouting} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>Dealer</span>
            <AppleDropdown value={dealerValue} options={dealerOptions} onChange={updateDealer} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>Status</span>
            <AppleDropdown
              value={filters.status}
              options={STATUS_OPTIONS}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle}>Category</span>
            <AppleDropdown
              value={filters.category}
              options={categoryOptions}
              onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
            />
          </label>
        </div>
      ) : null}
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

// ----------------------------------------------------------------------
// Ranked bar list - restyled BarList, same shape/behavior.
// ----------------------------------------------------------------------

export function RankedBarList({ items = [], valueKey = "value", labelKey = "label", formatValue = (v) => v, empty = "No data" }) {
  if (!items.length) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));

  return (
    <div style={{ display: "grid", gap: 12, padding: "15px 18px 17px" }}>
      {items.map((item) => (
        <div key={`${item[labelKey]}-${item[valueKey]}`} style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
            <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item[labelKey]}</span>
            <span style={{ flex: "0 0 auto", color: "var(--color-graphite, #707070)", fontSize: 11.5, fontWeight: 600 }}>
              {formatValue(item[valueKey])}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--color-fog, #f5f5f7)", overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                borderRadius: 999,
                background: "var(--color-azure, #0071e3)",
                width: `${Math.max(4, (Number(item[valueKey] || 0) / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Signals - retoned onto Pill's tone vocabulary.
// ----------------------------------------------------------------------

const SIGNAL_TONES = {
  positive: { bg: "rgba(22,163,74,.08)", border: "#15803d", text: "var(--color-ink, #1d1d1f)" },
  risk: { bg: "rgba(180,35,24,.08)", border: "#b42318", text: "var(--color-ink, #1d1d1f)" },
  watch: { bg: "rgba(182,68,0,.08)", border: "var(--color-caution, #b64400)", text: "var(--color-ink, #1d1d1f)" },
  neutral: { bg: "var(--color-fog, #f5f5f7)", border: "rgba(29,29,31,.18)", text: "var(--color-ink, #1d1d1f)" },
};

export function SignalList({ signals = [] }) {
  if (!signals.length) return <EmptyNote>No signals available yet.</EmptyNote>;

  return (
    <div style={{ display: "grid", gap: 10, padding: "15px 18px" }}>
      {signals.map((signal) => {
        const tone = SIGNAL_TONES[signal.tone] || SIGNAL_TONES.neutral;
        return (
          <div
            key={signal.title}
            style={{
              borderLeft: `3px solid ${tone.border}`,
              background: tone.bg,
              borderRadius: "0 12px 12px 0",
              padding: "10px 12px",
              display: "grid",
              gap: 3,
            }}
          >
            <strong style={{ fontSize: 12.5, fontWeight: 700, color: tone.text }}>{signal.title}</strong>
            <span style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {signal.body}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// Table - sortable, paginated. Since the backend already returns the full
// filtered dataset in one response, sorting/pagination here is pure
// client-side display logic - nothing is silently truncated without saying so.
// ----------------------------------------------------------------------

function compareValues(a, b) {
  if (typeof a === "number" || typeof b === "number") {
    return Number(a || 0) - Number(b || 0);
  }
  return String(a || "").localeCompare(String(b || ""));
}

export function InsightTable({ columns, rows = [], empty = "No rows available.", pageSize = 10 }) {
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const tableRef = useRef(null);

  // Insight tables are often one of several on a page, so paging scrolls
  // just this table back into view rather than jumping to the page top.
  function goToPage(updater) {
    setPage(updater);
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return rows;
    const getValue = column.sortValue || ((row) => row[column.key]);
    const sign = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * compareValues(getValue(a), getValue(b)));
  }, [rows, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function toggleSort(column) {
    if (column.sortable === false) return;
    if (sortKey === column.key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDir("desc");
    }
    setPage(1);
  }

  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>;

  return (
    <div ref={tableRef}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {columns.map((column) => {
                const sortable = column.sortable !== false;
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    onClick={sortable ? () => toggleSort(column) : undefined}
                    style={{
                      padding: "0 14px 10px 0",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: active ? "var(--color-ink, #1d1d1f)" : "var(--color-graphite, #707070)",
                      cursor: sortable ? "pointer" : "default",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {column.label}
                      {active ? (
                        <DashboardIcon
                          name="chevron"
                          size={10}
                          strokeWidth={2.4}
                          style={{ transform: sortDir === "asc" ? "rotate(-90deg)" : "rotate(90deg)" }}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr
                key={row.id || row.dealerId || row.productKey || row.dispatcherId || row.orderId || `${index}`}
                style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: "11px 14px 11px 0",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--color-ink, #1d1d1f)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {column.render ? column.render(row, index) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Showing {start + 1}-{Math.min(sorted.length, start + pageRows.length)} of {sorted.length}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GhostButton onClick={() => goToPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
              Previous
            </GhostButton>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Page {safePage} of {totalPages}
            </span>
            <GhostButton onClick={() => goToPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
              Next
            </GhostButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
