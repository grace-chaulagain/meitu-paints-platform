import { useMemo, useState } from "react";
import { useGetAllStockHistoryQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { EmptyState, GhostButton, Pill, SearchField, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../utils/scrollResultsToTop.js";
import { AppleDateField, AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { MovementBadge } from "../factoryUI.jsx";
import { STOCK_REASONS, formatDayHeading, formatTimeOnly, localDayKey } from "../factoryHelpers.js";

const REASON_OPTIONS = [{ key: "ALL", label: "All reasons" }, ...STOCK_REASONS.map((item) => ({ key: item, label: item }))];
const PAGE_SIZE = 50;

function exportCsv(items) {
  const headers = ["Date", "Product", "Size", "Old", "New", "Difference", "Reason", "Factory User"];
  const rows = items.map((row) => [
    formatDayHeading(row.changedAt) === "Today" || formatDayHeading(row.changedAt) === "Yesterday"
      ? `${formatDayHeading(row.changedAt)} ${formatTimeOnly(row.changedAt)}`
      : `${new Date(row.changedAt).toLocaleDateString("en-US")} ${formatTimeOnly(row.changedAt)}`,
    row.productName || row.sku || "",
    row.packLabel || "",
    row.previousQuantity ?? "",
    row.newQuantity ?? "",
    row.delta ?? "",
    row.reason || "",
    row.changedBy?.username || row.changedBy?.email || row.changedByRole || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "factory-stock-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function FactoryStockHistoryPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const historyQuery = useGetAllStockHistoryQuery({
    q: query,
    reason: reason === "ALL" ? "" : reason,
    dateFrom,
    dateTo,
    onlyMovements: "true",
    page,
    limit: PAGE_SIZE,
  });
  const items = useMemo(() => historyQuery.data?.items || [], [historyQuery.data]);
  const pagination = historyQuery.data?.pagination || { page: 1, limit: PAGE_SIZE, total: items.length, pages: 1 };
  const loadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load stock history.") : "";

  // Rows already arrive newest-first from the API, so grouping preserves
  // that order - each bucket just collects consecutive same-day rows.
  const dayGroups = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    for (const row of items) {
      const key = localDayKey(row.changedAt);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: formatDayHeading(row.changedAt), rows: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  }, [items]);

  const totalPages = Math.max(1, Number(pagination.pages || 1));
  const totalCount = Number(pagination.total ?? items.length);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * PAGE_SIZE);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="history"
          title="Stock Movement History"
          subtitle="Every stock addition or deduction at the factory, grouped by day."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {historyQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              <GhostButton icon="download" onClick={() => exportCsv(items)}>CSV</GhostButton>
              <GhostButton icon="print" onClick={() => window.print()}>Print</GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
            <SearchField
              value={draftQuery}
              onChange={setDraftQuery}
              onSubmit={() => {
                setPage(1);
                setQuery(draftQuery.trim());
              }}
              placeholder="Search product, SKU, reason, order…"
            />
          </div>
          <AppleDropdown
            value={reason}
            options={REASON_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setReason(value);
            }}
            style={{ width: 180 }}
          />
          <AppleDateField
            value={dateFrom}
            onChange={(value) => {
              setPage(1);
              setDateFrom(value);
            }}
          />
          <AppleDateField
            value={dateTo}
            onChange={(value) => {
              setPage(1);
              setDateTo(value);
            }}
          />
        </div>

        {loadError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError}
          </div>
        ) : null}
      </Surface>

      {historyQuery.isLoading && !historyQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 260, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="history" title="No stock movements found" />
      ) : (
        <>
          <Surface padding={0} className="dash-fade-up">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
                    {["Time", "Product", "Size", "Old", "New", "Movement", "Reason", "Factory User"].map((head, index) => (
                      <th
                        key={head}
                        style={{
                          textAlign: index >= 3 && index <= 5 ? "right" : "left",
                          padding: "10px 16px",
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          color: "var(--color-graphite, #707070)",
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayGroups.flatMap((group) => [
                    <tr key={`day-${group.key}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                      <td colSpan={8} style={{ padding: "9px 16px", background: "rgba(0,0,0,.02)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>{group.label}</span>
                          <Pill size="small">{group.rows.length}</Pill>
                        </div>
                      </td>
                    </tr>,
                    ...group.rows.map((row) => (
                      <tr key={row._id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatTimeOnly(row.changedAt)}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{row.productName || row.sku}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{row.packLabel || "—"}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13 }}>{row.previousQuantity}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13 }}>{row.newQuantity}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <MovementBadge delta={row.delta} />
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5 }}>{row.reason}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
                          {row.changedBy?.username || row.changedBy?.email || row.changedByRole || "—"}
                        </td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </Surface>

          {totalPages > 1 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Showing {rangeStart}-{rangeEnd} of {totalCount} movements
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GhostButton
                  onClick={() => {
                    setPage((value) => Math.max(1, value - 1));
                    scrollResultsToTop();
                  }}
                  disabled={page <= 1}
                >
                  Previous
                </GhostButton>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  Page {page} of {totalPages}
                </span>
                <GhostButton
                  onClick={() => {
                    setPage((value) => Math.min(totalPages, value + 1));
                    scrollResultsToTop();
                  }}
                  disabled={page >= totalPages}
                >
                  Next
                </GhostButton>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
