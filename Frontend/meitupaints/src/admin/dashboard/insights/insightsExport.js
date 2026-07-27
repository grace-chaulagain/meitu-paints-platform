import jsPDF from "jspdf";
import { formatDate, money, number, percent } from "./insightsFormatting.js";

// One row-builder per section, shared by CSV export, PDF export, and the
// Reports tab's on-screen preview table - so all three always agree on what
// "the current section's report" contains instead of drifting independently.
export function buildReportRows(section, data, currency) {
  if (section === "orders") {
    return (data.orders?.rankings?.largestOrders || []).map((row) => ({
      Order: row.orderNumber,
      Dealer: row.dealerName,
      Route: row.route,
      Total: money(row.total, currency),
      Date: formatDate(row.createdAt),
    }));
  }
  if (section === "dealers") {
    return (data.dealers?.rows || []).map((row) => ({
      Dealer: row.dealerName,
      Sales: money(row.approvedSales, currency),
      Orders: row.approvedOrders,
      AOV: money(row.averageOrderValue, currency),
      Route: row.routingMode,
      Health: row.healthScore,
    }));
  }
  if (section === "products") {
    return (data.products?.ranking || []).map((row) => ({
      Product: row.product,
      SKU: row.sku,
      Category: row.category,
      Quantity: row.quantitySold,
      Revenue: money(row.revenue, currency),
      "Top dealer": row.topDealer,
    }));
  }
  if (section === "dispatchers") {
    return (data.dispatchers?.rows || []).map((row) => ({
      Dispatcher: row.dispatcherName,
      Dealers: row.assignedDealerCount,
      Revenue: money(row.approvedRevenue, currency),
      Orders: row.routedOrders,
      Acceptance: percent(row.approvalRate),
    }));
  }
  if (section === "routing") {
    return (data.routing?.byDealer || []).map((row) => ({
      Dealer: row.dealerName,
      Route: row.route,
      Sales: money(row.sales, currency),
      Orders: row.orders,
      Suitability: row.suitability,
    }));
  }
  return [
    { Metric: "Accepted revenue", Value: money(data.home?.kpis?.approvedRevenue, currency) },
    { Metric: "Accepted orders", Value: number(data.home?.kpis?.approvedOrders) },
    { Metric: "Average order value", Value: money(data.home?.kpis?.averageOrderValue, currency) },
    { Metric: "Active dealers", Value: number(data.home?.kpis?.activeDealers) },
    { Metric: "Revenue growth", Value: percent(data.home?.kpis?.revenueGrowth) },
  ];
}

// "Current vs previous period" and "Factory vs dispatcher" are the two
// comparisons the existing data model can answer honestly without a new
// entity picker. Previous-period revenue is reconstructed from the already
// -returned growth percentage (growth = (current-previous)/previous * 100),
// labeled "estimated" since it's derived rather than an independent figure.
export function buildComparisonRows(key, data, currency) {
  if (key === "ROUTE") {
    const summary = data.routing?.summary || {};
    return [
      {
        Route: "Factory",
        Revenue: money(summary.factoryApprovedRevenue, currency),
        Orders: number(summary.factoryOrderCount),
        AOV: money(summary.factoryAverageOrderValue, currency),
        Acceptance: percent(summary.factoryApprovalRate),
      },
      {
        Route: "Dispatcher",
        Revenue: money(summary.dispatcherApprovedRevenue, currency),
        Orders: number(summary.dispatcherOrderCount),
        AOV: money(summary.dispatcherAverageOrderValue, currency),
        Acceptance: percent(summary.dispatcherApprovalRate),
      },
    ];
  }

  const kpis = data.home?.kpis || {};
  const growthRate = Number(kpis.revenueGrowth || 0);
  const current = Number(kpis.approvedRevenue || 0);
  const previous = growthRate <= -100 ? 0 : current / (1 + growthRate / 100);
  return [
    { Period: "Current", "Accepted Revenue": money(current, currency) },
    { Period: "Previous (estimated)", "Accepted Revenue": money(previous, currency) },
    { Period: "Growth", "Accepted Revenue": percent(growthRate) },
  ];
}

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

export function downloadInsightsPdf({ data, section, currency }) {
  if (!data) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = 42;

  const write = (text, x, yy, options = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size || 10);
    doc.setTextColor(...(options.color || [29, 29, 31]));
    doc.text(String(text), x, yy, { maxWidth: options.maxWidth || pageWidth - margin * 2 });
  };

  write("Meitu Paints Admin Insights", margin, y, { size: 18, bold: true });
  y += 22;
  write(`Section: ${section.label}`, margin, y, { size: 11, color: [112, 112, 112] });
  y += 16;
  write(
    `Filters: ${data.reports?.filterSummary?.period || "Selected period"} | ${data.reports?.filterSummary?.routing || "ALL"} | ${data.reports?.filterSummary?.status || "All statuses"}`,
    margin,
    y,
    { size: 10, color: [112, 112, 112] },
  );
  y += 28;

  // The Home tab gets its own KPI + signals layout since it isn't row-shaped
  // data; every other section renders as a table built from the exact same
  // rows the on-screen preview and CSV export use, so PDF export always
  // reflects whichever section was actually active.
  if (section.key === "home") {
    const kpis = data.home?.kpis || {};
    [
      ["Accepted revenue", money(kpis.approvedRevenue, currency)],
      ["Accepted orders", number(kpis.approvedOrders)],
      ["Average order value", money(kpis.averageOrderValue, currency)],
      ["Active dealers", number(kpis.activeDealers)],
      ["Revenue growth", percent(kpis.revenueGrowth)],
    ].forEach(([label, value], index) => {
      const x = margin + index * 150;
      write(label, x, y, { size: 8, bold: true, color: [112, 112, 112] });
      write(value, x, y + 18, { size: 13, bold: true });
    });

    y += 46;
    write("Key signals", margin, y, { size: 13, bold: true });
    y += 20;
    (data.home?.signals || []).slice(0, 8).forEach((signal) => {
      write(`${signal.title}: ${signal.body}`, margin, y, { size: 10 });
      y += 16;
    });

    doc.save(`meitu-insights-${section.key}.pdf`);
    return;
  }

  const rows = buildReportRows(section.key, data, currency);
  if (!rows.length) {
    write("No rows available for this section and filter set.", margin, y, { size: 11 });
    doc.save(`meitu-insights-${section.key}.pdf`);
    return;
  }

  const headers = Object.keys(rows[0]);
  const columnWidth = (pageWidth - margin * 2) / headers.length;
  const rowHeight = 18;

  headers.forEach((header, index) => {
    write(header, margin + index * columnWidth, y, { size: 9, bold: true, color: [112, 112, 112] });
  });
  y += 10;
  doc.setDrawColor(226, 226, 231);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  rows.forEach((row) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = 42;
    }
    headers.forEach((header, index) => {
      write(String(row[header] ?? ""), margin + index * columnWidth, y, {
        size: 9,
        maxWidth: columnWidth - 8,
      });
    });
    y += rowHeight;
  });

  doc.save(`meitu-insights-${section.key}.pdf`);
}
