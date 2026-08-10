// Trimmed in the Insights rebuild's Phase 4 cleanup: buildReportRows,
// buildComparisonRows, and downloadInsightsPdf were tied to the old
// combined-blob response shape and had zero remaining callers once
// ReportsSection.jsx (sections/ReportsSection.jsx) was rebuilt against the
// new per-section endpoints. downloadCsv is shape-agnostic (any array of
// flat objects) and is still used there.

export function downloadCsv(filename, rows = []) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
