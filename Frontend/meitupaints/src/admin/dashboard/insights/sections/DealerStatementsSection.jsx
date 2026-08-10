import { useMemo, useState } from "react";

import {
  useGetAdminArSummaryQuery,
  useGetAdminArAgingQuery,
  useLazyGetAdminOrderStatementReportQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, PrimaryButton } from "../../../../components/dashboard/DashboardUI.jsx";
import { money } from "../insightsFormatting.js";
import { downloadOrderStatementsReportPdf } from "../../../../utils/downloadOrderStatementsReportPdf.js";
import { CURRENCY, twoColStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import ArAgingBarChart from "./charts/ArAgingBarChart.jsx";

function outstandingColor(value) {
  if (value < 0) return "#15803d"; // credit owed back to the dealer
  if (value > 0) return "#b42318"; // owed to Meitu
  return "var(--color-ink, #1d1d1f)";
}

export default function DealerStatementsSection({ dateFilters }) {
  const arSummaryQuery = useGetAdminArSummaryQuery();
  const arAgingQuery = useGetAdminArAgingQuery();
  const [fetchStatement, statementQuery] = useLazyGetAdminOrderStatementReportQuery();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const arRows = useMemo(() => arSummaryQuery.data || [], [arSummaryQuery.data]);
  const arError = arSummaryQuery.error
    ? getQueryErrorMessage(arSummaryQuery.error, "Failed to load outstanding balances.")
    : "";
  const agingRows = arAgingQuery.data || [];

  const arTotals = useMemo(
    () =>
      arRows.reduce(
        (acc, row) => ({
          totalOrdered: acc.totalOrdered + Number(row.totalOrdered || 0),
          totalPaid: acc.totalPaid + Number(row.totalPaid || 0),
          outstanding: acc.outstanding + Number(row.outstanding || 0),
        }),
        { totalOrdered: 0, totalPaid: 0, outstanding: 0 },
      ),
    [arRows],
  );

  const arColumns = useMemo(
    () => [
      {
        key: "dealer",
        header: "Dealer",
        render: (row) => <span style={{ fontWeight: 700 }}>{row.dealer?.companyName || "Unknown dealer"}</span>,
      },
      {
        key: "totalOrdered",
        header: "Total Ordered",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.totalOrdered, CURRENCY),
      },
      {
        key: "totalPaid",
        header: "Total Paid",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.totalPaid, CURRENCY),
      },
      {
        key: "outstanding",
        header: "Outstanding",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => (
          <span style={{ fontWeight: 700, color: outstandingColor(row.outstanding) }}>
            {money(row.outstanding, CURRENCY)}
          </span>
        ),
      },
    ],
    [],
  );

  const arFooter = arRows.length
    ? [
        { key: "dealer", content: "Total", align: "left" },
        { key: "totalOrdered", content: money(arTotals.totalOrdered, CURRENCY), align: "right" },
        { key: "totalPaid", content: money(arTotals.totalPaid, CURRENCY), align: "right" },
        {
          key: "outstanding",
          content: (
            <span style={{ fontWeight: 700, color: outstandingColor(arTotals.outstanding) }}>
              {money(arTotals.outstanding, CURRENCY)}
            </span>
          ),
          align: "right",
        },
      ]
    : null;

  async function handleGenerateStatement() {
    setGenerateError("");
    setGenerating(true);
    try {
      const params = {};
      if (dateFilters.from) params.from = dateFilters.from;
      if (dateFilters.to) params.to = dateFilters.to;
      const report = await fetchStatement(params).unwrap();
      await downloadOrderStatementsReportPdf({ report, title: "Dealer Statements Report" });
    } catch (err) {
      setGenerateError(getQueryErrorMessage(err, "Failed to generate the statement report."));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {arError ? <ErrorBanner message={arError} /> : null}

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Aging" icon="warning" title="AR aging buckets" />
          <ArAgingBarChart items={agingRows} formatValue={(v) => money(v, CURRENCY)} />
        </Surface>
        <Surface padding={0}>
          <PanelHead
            eyebrow="Export"
            icon="download"
            title="Dealer statement report"
            action={
              <PrimaryButton icon="download" onClick={handleGenerateStatement} disabled={generating || statementQuery.isFetching}>
                {generating || statementQuery.isFetching ? "Generating…" : "Generate PDF"}
              </PrimaryButton>
            }
          />
          <div style={{ padding: "0 18px 18px", fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Dealer-grouped statement (order count, subtotal, total per dealer) for the current date range, downloaded as
            PDF.
          </div>
          {generateError ? (
            <div style={{ padding: "0 18px 18px" }}>
              <ErrorBanner message={generateError} />
            </div>
          ) : null}
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Accounts receivable" icon="invoice" title="Dealer outstanding balances" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={arColumns}
            rows={arRows}
            getRowKey={(row) => row.dealerId}
            loading={arSummaryQuery.isLoading && !arSummaryQuery.data}
            footerCells={arFooter}
            emptyState={{ icon: "invoice", title: "No outstanding balances", subtitle: "Every dealer is settled." }}
            minWidth={640}
          />
        </div>
      </Surface>
    </div>
  );
}
