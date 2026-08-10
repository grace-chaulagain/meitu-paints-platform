import { useState } from "react";

import {
  useGetAdminArSummaryQuery,
  useGetAdminOrderAnalyticsQuery,
  useGetAdminProductPerformanceQuery,
  useLazyGetAdminOrderStatementReportQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface } from "../../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import { money, number, formatDate } from "../insightsFormatting.js";
import { downloadCsv } from "../insightsExport.js";
import { downloadOrderStatementsReportPdf } from "../../../../utils/downloadOrderStatementsReportPdf.js";
import { CURRENCY } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";

function reportCardStyle() {
  return {
    textAlign: "left",
    border: "none",
    borderRadius: 14,
    background: "var(--color-fog, #f5f5f7)",
    padding: "13px 14px",
    cursor: "pointer",
    display: "grid",
    gap: 4,
  };
}

// Repointed at the new per-section aggregation endpoints instead of the
// legacy combined useGetAdminInsightsQuery blob - each button here exports
// exactly the data one of the account-keeping tabs already shows, sourced
// live (RTK Query dedupes against whatever a tab has already fetched).
export default function ReportsSection({ dateFilters }) {
  const [exporting, setExporting] = useState(false);
  const [statementError, setStatementError] = useState("");

  const arSummaryQuery = useGetAdminArSummaryQuery();
  const orderAnalyticsQuery = useGetAdminOrderAnalyticsQuery(dateFilters);
  const productPerformanceQuery = useGetAdminProductPerformanceQuery({ ...dateFilters, limit: 50 });
  const [fetchStatement] = useLazyGetAdminOrderStatementReportQuery();

  function runExport(task) {
    setExporting(true);
    try {
      task();
    } finally {
      setExporting(false);
    }
  }

  function exportArSummary() {
    const rows = (arSummaryQuery.data || []).map((row) => ({
      Dealer: row.dealer?.companyName || "Unknown dealer",
      "Total Ordered": money(row.totalOrdered, CURRENCY),
      "Total Paid": money(row.totalPaid, CURRENCY),
      Outstanding: money(row.outstanding, CURRENCY),
    }));
    runExport(() => downloadCsv("meitu-ar-summary.csv", rows));
  }

  function exportLargestOrders() {
    const rows = (orderAnalyticsQuery.data?.largestOrders || []).map((row) => ({
      Order: row.orderNumber,
      Dealer: row.dealerName,
      Route: row.route,
      Date: formatDate(row.createdAt),
      Total: money(row.total, CURRENCY),
    }));
    runExport(() => downloadCsv("meitu-largest-orders.csv", rows));
  }

  function exportProductPerformance() {
    const rows = (productPerformanceQuery.data?.ranking || []).map((row) => ({
      Product: row.product,
      SKU: row.sku,
      Category: row.category,
      Quantity: number(row.quantitySold),
      Revenue: money(row.revenue, CURRENCY),
      Orders: number(row.orderCount),
      "Last Ordered": formatDate(row.lastOrdered),
    }));
    runExport(() => downloadCsv("meitu-product-performance.csv", rows));
  }

  async function exportDealerStatementPdf() {
    setStatementError("");
    setExporting(true);
    try {
      const params = {};
      if (dateFilters.from) params.from = dateFilters.from;
      if (dateFilters.to) params.to = dateFilters.to;
      const report = await fetchStatement(params).unwrap();
      await downloadOrderStatementsReportPdf({ report, title: "Dealer Statements Report" });
    } catch (err) {
      setStatementError(getQueryErrorMessage(err, "Failed to generate the statement report."));
    } finally {
      setExporting(false);
    }
  }

  const REPORTS = [
    {
      key: "ar-summary",
      title: "AR Summary (CSV)",
      description: "Outstanding balance per dealer.",
      onClick: exportArSummary,
    },
    {
      key: "largest-orders",
      title: "Largest Orders (CSV)",
      description: "Largest accepted orders for the current date range.",
      onClick: exportLargestOrders,
    },
    {
      key: "product-performance",
      title: "Product Performance (CSV)",
      description: "Product ranking by revenue for the current date range.",
      onClick: exportProductPerformance,
    },
    {
      key: "dealer-statement",
      title: "Dealer Statement (PDF)",
      description: "Dealer-grouped statement, branded PDF, current date range.",
      onClick: exportDealerStatementPdf,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {statementError ? <ErrorBanner message={statementError} /> : null}
      <Surface padding={0}>
        <PanelHead eyebrow="Exports" icon="download" title="Reports" />
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 10 }}>
          {REPORTS.map((report) => (
            <button key={report.key} type="button" disabled={exporting} onClick={report.onClick} style={reportCardStyle()}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
                <DashboardIcon name="download" size={13} strokeWidth={1.9} />
                {report.title}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{report.description}</span>
            </button>
          ))}
        </div>
      </Surface>
    </div>
  );
}
