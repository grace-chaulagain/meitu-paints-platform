import jsPDF from "jspdf";
import { formatMoney, formatPack, getTierLabel } from "../dealer/pricing.js";

function safe(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function cleanFilename(value) {
  return safe(value, "draft-order")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(doc, value, maxWidth) {
  const text = safe(value);
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let next = text;
  while (next.length > 3 && doc.getTextWidth(`${next}...`) > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

export function downloadDraftOrderPdf({
  cart = [],
  totals = {},
  currency = "NPR",
  roleLabel = "Admin Utility",
  search = "",
  category = "ALL",
} = {}) {
  if (!Array.isArray(cart) || cart.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;
  const usableBottom = pageHeight - 58;
  const footerY = pageHeight - 20;
  const generatedAt = new Date();

  const brand = {
    ink: [29, 29, 31],
    graphite: [112, 112, 112],
    slate: [71, 71, 71],
    fog: [245, 245, 247],
    line: [232, 232, 237],
    blue: [0, 113, 227],
    white: [255, 255, 255],
  };

  let page = 1;
  let y = 0;

  function setFont({ size = 10, bold = false, color = brand.ink } = {}) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  function addText(text, x, yy, options = {}) {
    setFont(options);
    doc.text(safe(text), x, yy, {
      align: options.align || "left",
      maxWidth: options.maxWidth,
    });
  }

  function footer() {
    doc.setDrawColor(...brand.line);
    doc.line(marginX, pageHeight - 36, pageWidth - marginX, pageHeight - 36);
    addText(`Generated ${formatDateTime(generatedAt)}`, marginX, footerY, {
      size: 8,
      color: brand.graphite,
    });
    addText(`Page ${page}`, pageWidth - marginX, footerY, {
      size: 8,
      color: brand.graphite,
      align: "right",
    });
  }

  function header(firstPage = false) {
    if (firstPage) {
      doc.setFillColor(...brand.fog);
      doc.roundedRect(marginX, 34, contentWidth, 104, 18, 18, "F");
      doc.setFillColor(...brand.ink);
      doc.roundedRect(pageWidth - marginX - 84, 54, 46, 46, 14, 14, "F");

      addText("MEITU CONSTRUCTION MATERIALS PVT. LTD.", marginX + 18, 62, {
        size: 15,
        bold: true,
        color: brand.ink,
        maxWidth: contentWidth - 132,
      });
      addText("Order Draft", marginX + 18, 84, {
        size: 26,
        bold: true,
        color: brand.ink,
        maxWidth: contentWidth - 132,
      });
      addText("Admin / Office use only. This document is an internal draft and does not submit an order.", marginX + 18, 110, {
        size: 9.5,
        color: brand.graphite,
        maxWidth: contentWidth - 132,
      });
      addText("DRAFT", pageWidth - marginX - 61, 81, {
        size: 8,
        bold: true,
        color: brand.white,
        align: "center",
      });
      y = 166;
    } else {
      doc.setFillColor(...brand.fog);
      doc.rect(0, 0, pageWidth, 48, "F");
      addText("Meitu Construction Materials Pvt. Ltd.", marginX, 24, {
        size: 11,
        bold: true,
        color: brand.ink,
      });
      addText("Order Draft", pageWidth - marginX, 24, {
        size: 10,
        bold: true,
        color: brand.graphite,
        align: "right",
      });
      y = 72;
    }
  }

  function ensureSpace(height) {
    if (y + height <= usableBottom) return;
    footer();
    doc.addPage();
    page += 1;
    header(false);
  }

  function summaryCard() {
    doc.setFillColor(...brand.white);
    doc.setDrawColor(...brand.line);
    doc.roundedRect(marginX, y, contentWidth, 82, 16, 16, "FD");

    const colWidth = contentWidth / 4;
    const summary = [
      ["Prepared by", roleLabel],
      ["Date", formatDateTime(generatedAt)],
      ["Selected lines", String(cart.length)],
      ["Quantity", Number(totals.totalQty || 0).toLocaleString()],
    ];

    summary.forEach(([label, value], index) => {
      const x = marginX + 16 + index * colWidth;
      addText(label, x, y + 28, { size: 8, bold: true, color: brand.graphite });
      addText(value, x, y + 50, { size: 11, bold: true, color: brand.ink, maxWidth: colWidth - 24 });
    });

    y += 106;

    const filterLabel = `${category === "ALL" ? "All categories" : category}${search ? ` · Search: ${search}` : ""}`;
    addText(`Scope: ${filterLabel}`, marginX, y - 14, {
      size: 9,
      color: brand.graphite,
      maxWidth: contentWidth,
    });
  }

  function tableHeader() {
    ensureSpace(34);
    doc.setFillColor(...brand.ink);
    doc.roundedRect(marginX, y, contentWidth, 28, 9, 9, "F");
    const columns = [
      ["#", marginX + 10, { align: "left" }],
      ["Product", marginX + 32, { align: "left" }],
      ["Pack", marginX + 304, { align: "left" }],
      ["Qty", marginX + 374, { align: "right" }],
      ["Rate", pageWidth - marginX - 74, { align: "right" }],
      ["Total", pageWidth - marginX - 8, { align: "right" }],
    ];
    columns.forEach(([label, x, options]) =>
      addText(label, x, y + 18, {
        size: 8,
        bold: true,
        color: brand.white,
        ...options,
      }),
    );
    y += 34;
  }

  function drawRow(line, index) {
    ensureSpace(44);
    if (index > 0 && index % 12 === 0) tableHeader();

    const rowHeight = 38;
    if (index % 2 === 0) {
      doc.setFillColor(...brand.fog);
      doc.roundedRect(marginX, y - 4, contentWidth, rowHeight, 7, 7, "F");
    }

    const tier = getTierLabel(line.tier, line.pricing);
    addText(String(index + 1), marginX + 10, y + 16, { size: 8.5, color: brand.graphite });
    addText(truncate(doc, line.name, 252), marginX + 32, y + 16, { size: 9.5, bold: true, color: brand.ink });
    addText(safe(formatPack(line.pack)), marginX + 304, y + 16, { size: 8.5, color: brand.slate });
    addText(String(line.quantity || 0), marginX + 374, y + 16, {
      size: 8.5,
      bold: true,
      color: brand.ink,
      align: "right",
    });
    addText(formatMoney(line.unitPrice, line.currency), pageWidth - marginX - 74, y + 16, {
      size: 8.5,
      color: brand.slate,
      align: "right",
    });
    addText(formatMoney(line.lineTotal, line.currency), pageWidth - marginX - 8, y + 16, {
      size: 8.5,
      bold: true,
      color: brand.ink,
      align: "right",
    });
    addText(`Tier: ${tier}`, marginX + 32, y + 30, { size: 7.5, color: brand.graphite });
    y += rowHeight + 2;
  }

  function totalsBlock() {
    ensureSpace(110);
    y += 8;
    const blockWidth = 230;
    const x = pageWidth - marginX - blockWidth;

    doc.setFillColor(...brand.fog);
    doc.roundedRect(x, y, blockWidth, 82, 16, 16, "F");
    addText("Draft Total", x + 16, y + 26, { size: 9, bold: true, color: brand.graphite });
    addText(formatMoney(totals.subtotal, currency), x + blockWidth - 16, y + 54, {
      size: 19,
      bold: true,
      color: brand.blue,
      align: "right",
    });

    addText("Office note: final invoice, availability, tax treatment, and dispatch terms may vary after order verification.", marginX, y + 28, {
      size: 9,
      color: brand.graphite,
      maxWidth: contentWidth - blockWidth - 24,
    });
    y += 106;
  }

  header(true);
  summaryCard();
  tableHeader();
  cart.forEach(drawRow);
  totalsBlock();
  footer();

  doc.save(`meitu-admin-order-draft-${cleanFilename(formatDateTime(generatedAt))}.pdf`);
}
