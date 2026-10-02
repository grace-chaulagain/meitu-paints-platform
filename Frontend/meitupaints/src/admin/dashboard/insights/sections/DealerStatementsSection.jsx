import { useMemo, useState } from "react";

import {
  useGetAdminArSummaryQuery,
  useGetAdminArAgingQuery,
  useLazyGetAdminOrderStatementReportQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, PrimaryButton, Pill } from "../../../../components/dashboard/DashboardUI.jsx";
import { money } from "../insightsFormatting.js";
import { downloadOrderStatementsReportPdf } from "../../../../utils/downloadOrderStatementsReportPdf.js";
import { CURRENCY, twoColStyle } from "./sectionLayout.js";
import { PanelHead, PanelBody, ErrorBanner } from "./sectionShared.jsx";
import SectionViewFrame from "./SectionViewFrame.jsx";
import ArAgingBarChart from "./charts/ArAgingBarChart.jsx";

function outstandingColor(value) {
  if (value < 0) return "#15803d"; // credit owed back to the dealer/dispatcher
  if (value > 0) return "#b42318"; // owed to Meitu
  return "var(--color-ink, #1d1d1f)";
}

// Rows are Meitu's receivables: dealers for orders the factory supplied,
// dispatchers for their restock (see getReceivableBalances on the server).

export default function DealerStatementsSection({ dateFilters, view, onViewChange }) {
  // AR is a balance-to-date figure, so the server ignores the date window
  // here - but the entity scope in dateFilters must still reach it, or the
  // header would claim a filter the numbers don't honour.
  const arSummaryQuery = useGetAdminArSummaryQuery(dateFilters);
  const arAgingQuery = useGetAdminArAgingQuery(dateFilters);
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
        key: "name",
        header: "Account",
        render: (row) => (
          <span>
            <span style={{ fontWeight: 700 }}>{row.name}</span>
            {row.partyType === "DISPATCHER" ? (
              <Pill tone="neutral" size="small" style={{ marginLeft: 6 }}>
                Dispatcher
              </Pill>
            ) : null}
          </span>
        ),
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
        { key: "name", content: "Total", align: "left" },
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

  const exportPanel = (
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
            <PanelBody>
              <ErrorBanner message={generateError} />
            </PanelBody>
          ) : null}
        </Surface>
  );

  const summary = arError ? <ErrorBanner message={arError} /> : null;

  const charts = (
    <div style={twoColStyle()}>
      <Surface padding={0}>
        <PanelHead eyebrow="Aging" icon="warning" title="AR aging buckets" />
        <ArAgingBarChart items={agingRows} formatValue={(v) => money(v, CURRENCY)} />
      </Surface>
      {exportPanel}
    </div>
  );

  const dataView = (
    <>
      <Surface padding={0}>
        <PanelHead eyebrow="Accounts receivable" icon="invoice" title="Outstanding balances" />
        <PanelBody>
          <DataTable
            columns={arColumns}
            rows={arRows}
            getRowKey={(row) => row.key}
            loading={arSummaryQuery.isLoading && !arSummaryQuery.data}
            footerCells={arFooter}
            emptyState={{ icon: "invoice", title: "No outstanding balances", subtitle: "Everyone is settled." }}
            minWidth={640}
          />
        </PanelBody>
      </Surface>
      {exportPanel}
    </>
  );

  return (
    <SectionViewFrame
      summary={summary}
      charts={charts}
      data={dataView}
      view={view}
      onViewChange={onViewChange}
    />
  );
}
