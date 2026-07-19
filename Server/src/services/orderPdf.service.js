const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const USABLE_BOTTOM = PAGE_HEIGHT - 74;

const COLOR = {
  red: [181, 28, 28],
  redDark: [137, 17, 17],
  redSoft: [229, 62, 62],
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  softBg: [248, 250, 252],
  softCard: [252, 252, 253],
  white: [255, 255, 255],
};

function safe(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function pdfText(value) {
  return safe(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value) {
  return pdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function color(parts = COLOR.ink) {
  return parts.map((part) => (Number(part) / 255).toFixed(3)).join(" ");
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function filenameSafe(value) {
  return pdfText(value || "order-summary")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function wrapText(value, maxWidth, size) {
  const text = pdfText(value);
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
  const words = text.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function buildPdf(objects) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function buildOrderSummaryPdfBuffer(order) {
  const pages = [];
  let ops = [];
  let y = 0;
  let pageNumber = 0;

  const items = Array.isArray(order?.items) ? order.items : [];
  const currency = order?.totals?.currency || "NPR";
  const dealer = order?.dealerSnapshot || order?.dealerId || {};

  const yPdf = (topY) => PAGE_HEIGHT - topY;

  function push(value) {
    ops.push(value);
  }

  function rect(x, topY, width, height, fill = null, stroke = null) {
    if (fill) push(`${color(fill)} rg`);
    if (stroke) push(`${color(stroke)} RG`);
    push(`${x.toFixed(2)} ${yPdf(topY + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
  }

  function line(x1, topY1, x2, topY2, stroke = COLOR.line) {
    push(`${color(stroke)} RG`);
    push(`${x1.toFixed(2)} ${yPdf(topY1).toFixed(2)} m ${x2.toFixed(2)} ${yPdf(topY2).toFixed(2)} l S`);
  }

  function text(value, x, topY, options = {}) {
    const size = options.size || 10;
    const font = options.bold ? "F2" : "F1";
    const fill = options.color || COLOR.ink;
    const align = options.align || "left";
    const printable = escapePdfString(value);
    const approxWidth = pdfText(value).length * size * 0.52;
    const tx =
      align === "right"
        ? x - approxWidth
        : align === "center"
          ? x - approxWidth / 2
          : x;

    push(`${color(fill)} rg`);
    push(`BT /${font} ${size} Tf ${tx.toFixed(2)} ${yPdf(topY).toFixed(2)} Td (${printable}) Tj ET`);
  }

  function wrappedText(value, x, topY, maxWidth, options = {}) {
    const size = options.size || 10;
    const lineHeight = options.lineHeight || size + 4;
    const lines = wrapText(value, maxWidth, size);

    lines.forEach((lineText, index) => {
      text(lineText, x, topY + index * lineHeight, options);
    });

    return lines;
  }

  function addPage(firstPage = false) {
    ops = [];
    pages.push(ops);
    pageNumber += 1;

    if (firstPage) {
      rect(0, 0, PAGE_WIDTH, 104, COLOR.redDark);
      rect(0, 104, PAGE_WIDTH, 6, COLOR.redSoft);

      text("Meitu Construction Materials Pvt. Ltd.", MARGIN_X, 38, {
        size: 18,
        bold: true,
        color: COLOR.white,
      });
      text("Order Summary", MARGIN_X, 84, {
        size: 12,
        bold: true,
        color: [255, 236, 236],
      });
      text(safe(order?.orderNumber), PAGE_WIDTH - MARGIN_X, 38, {
        size: 12,
        bold: true,
        color: COLOR.white,
        align: "right",
      });
      text(`Status: ${safe(order?.status)}`, PAGE_WIDTH - MARGIN_X, 62, {
        size: 10,
        color: [255, 236, 236],
        align: "right",
      });
      text(`Submitted: ${formatDateTime(order?.createdAt)}`, PAGE_WIDTH - MARGIN_X, 84, {
        size: 9,
        color: [255, 236, 236],
        align: "right",
      });
      y = 134;
      return;
    }

    rect(0, 0, PAGE_WIDTH, 56, COLOR.softBg);
    text("Meitu Construction Materials Pvt. Ltd.", MARGIN_X, 24, {
      size: 12,
      bold: true,
      color: COLOR.ink,
    });
    text(safe(order?.orderNumber), PAGE_WIDTH - MARGIN_X, 26, {
      size: 10,
      bold: true,
      color: COLOR.ink,
      align: "right",
    });
    y = 78;
  }

  function footer() {
    line(MARGIN_X, PAGE_HEIGHT - 34, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 34);
    text(`Generated on ${formatDateTime(new Date())}`, MARGIN_X, PAGE_HEIGHT - 18, {
      size: 9,
      color: COLOR.muted,
    });
    text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 18, {
      size: 9,
      color: COLOR.muted,
      align: "right",
    });
  }

  function ensureSpace(heightNeeded = 40) {
    if (y + heightNeeded <= USABLE_BOTTOM) return;
    footer();
    addPage(false);
  }

  function section(title) {
    ensureSpace(34);
    text(title, MARGIN_X, y, { size: 13, bold: true, color: COLOR.ink });
    y += 12;
    line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
    y += 18;
  }

  function infoGrid(rows = []) {
    const leftX = MARGIN_X;
    const rightX = PAGE_WIDTH / 2 + 12;
    const colWidth = PAGE_WIDTH / 2 - MARGIN_X - 24;

    for (let index = 0; index < rows.length; index += 2) {
      const left = rows[index];
      const right = rows[index + 1];
      ensureSpace(54);

      if (left) text(left.label, leftX, y, { size: 9, bold: true, color: COLOR.muted });
      if (right) text(right.label, rightX, y, { size: 9, bold: true, color: COLOR.muted });
      y += 14;

      const leftLines = left
        ? wrappedText(left.value, leftX, y, colWidth, {
            size: 11,
            bold: Boolean(left.bold),
            color: COLOR.ink,
          })
        : ["-"];
      const rightLines = right
        ? wrappedText(right.value, rightX, y, colWidth, {
            size: 11,
            bold: Boolean(right.bold),
            color: COLOR.ink,
          })
        : ["-"];

      y += Math.max(leftLines.length, rightLines.length) * 14 + 14;
    }
  }

  function summaryStrip() {
    ensureSpace(78);
    const gap = 10;
    const boxWidth = (CONTENT_WIDTH - gap * 2) / 3;
    const boxHeight = 58;
    const cards = [
      ["Dealer", dealer?.companyName],
      ["Payment", order?.payment?.method],
      ["Total", money(order?.totals?.total, currency)],
    ];

    cards.forEach(([label, value], index) => {
      const x = MARGIN_X + index * (boxWidth + gap);
      rect(x, y, boxWidth, boxHeight, COLOR.softCard, COLOR.line);
      text(label, x + 12, y + 18, { size: 8, bold: true, color: COLOR.muted });
      text(value, x + 12, y + 40, {
        size: 11,
        bold: true,
        color: index === 2 ? COLOR.red : COLOR.ink,
      });
    });

    y += boxHeight + 20;
  }

  function itemsTable() {
    section("Order Items");

    const col = {
      sn: MARGIN_X,
      item: 74,
      pack: 338,
      qty: 424,
      rate: 488,
      amount: PAGE_WIDTH - MARGIN_X,
      itemWidth: 248,
    };

    function header() {
      ensureSpace(36);
      rect(MARGIN_X, y - 12, CONTENT_WIDTH, 28, COLOR.softBg);
      text("SN", col.sn, y + 6, { size: 9, bold: true, color: [71, 85, 105] });
      text("Item", col.item, y + 6, { size: 9, bold: true, color: [71, 85, 105] });
      text("Pack", col.pack, y + 6, { size: 9, bold: true, color: [71, 85, 105] });
      text("Qty", col.qty, y + 6, { size: 9, bold: true, color: [71, 85, 105], align: "right" });
      text("Rate", col.rate, y + 6, { size: 9, bold: true, color: [71, 85, 105], align: "right" });
      text("Amount", col.amount, y + 6, { size: 9, bold: true, color: [71, 85, 105], align: "right" });
      y += 34;
    }

    header();

    items.forEach((item, index) => {
      const nameLines = wrapText(item?.name, col.itemWidth, 10);
      const codeLines = item?.sku || item?.code ? wrapText(item?.sku || item?.code, col.itemWidth, 9) : [];
      const componentsText = item?.components?.length
        ? `Includes: ${item.components.map((c) => `${c.name}${c.packLabel ? ` ${c.packLabel}` : ""}`).join(", ")}`
        : "";
      const componentsLines = componentsText ? wrapText(componentsText, col.itemWidth, 8.5) : [];
      const rowHeight = Math.max(
        30,
        nameLines.length * 13 + codeLines.length * 10 + (codeLines.length ? 5 : 0) + componentsLines.length * 10 + (componentsLines.length ? 5 : 0),
      );

      ensureSpace(rowHeight + 22);
      if (y + rowHeight > USABLE_BOTTOM) {
        footer();
        addPage(false);
        section("Order Items (continued)");
        header();
      }

      const rowTop = y;
      text(String(index + 1), col.sn, rowTop, { size: 10, bold: true, color: COLOR.muted });
      nameLines.forEach((lineText, lineIndex) => {
        text(lineText, col.item, rowTop + lineIndex * 13, {
          size: 10,
          bold: true,
          color: COLOR.ink,
        });
      });

      codeLines.forEach((lineText, lineIndex) => {
        text(lineText, col.item, rowTop + nameLines.length * 13 + 5 + lineIndex * 10, {
          size: 9,
          color: COLOR.muted,
        });
      });

      componentsLines.forEach((lineText, lineIndex) => {
        text(lineText, col.item, rowTop + nameLines.length * 13 + codeLines.length * 10 + (codeLines.length ? 5 : 0) + 5 + lineIndex * 10, {
          size: 8.5,
          color: COLOR.muted,
        });
      });

      text(safe(item?.packLabel || item?.variantLabel || item?.unit), col.pack, rowTop, {
        size: 10,
        color: COLOR.ink,
      });
      text(Number(item?.quantity || 0).toLocaleString(), col.qty, rowTop, {
        size: 10,
        color: COLOR.ink,
        align: "right",
      });
      text(Number(item?.unitPrice || 0).toLocaleString(), col.rate, rowTop, {
        size: 10,
        color: COLOR.ink,
        align: "right",
      });
      text(Number(item?.lineTotal || 0).toLocaleString(), col.amount, rowTop, {
        size: 10,
        bold: true,
        color: COLOR.ink,
        align: "right",
      });

      y += rowHeight + 10;
      line(MARGIN_X, y - 2, PAGE_WIDTH - MARGIN_X, y - 2);
      y += 8;
    });
  }

  function totalsBox() {
    ensureSpace(122);
    const boxWidth = 238;
    const boxX = PAGE_WIDTH - MARGIN_X - boxWidth;
    rect(boxX, y, boxWidth, 102, [252, 244, 243], COLOR.redSoft);
    text("Order Total", boxX + 16, y + 24, { size: 10, bold: true, color: COLOR.muted });
    text(money(order?.totals?.total, currency), boxX + boxWidth - 16, y + 50, {
      size: 18,
      bold: true,
      color: COLOR.red,
      align: "right",
    });
    text(`Status: ${safe(order?.status)}`, boxX + 16, y + 74, {
      size: 10,
      color: COLOR.ink,
    });
    text(`Items: ${items.length}`, boxX + boxWidth - 16, y + 74, {
      size: 10,
      color: COLOR.ink,
      align: "right",
    });
    y += 122;
  }

  addPage(true);
  summaryStrip();

  section("Order Overview");
  infoGrid([
    { label: "Order Number", value: order?.orderNumber, bold: true },
    { label: "Status", value: order?.status, bold: true },
    { label: "Dealer", value: dealer?.companyName },
    { label: "Submitted", value: formatDateTime(order?.createdAt) },
  ]);

  section("Dealer Information");
  infoGrid([
    { label: "Contact", value: dealer?.contactName },
    { label: "Phone", value: dealer?.phone },
    { label: "Email", value: dealer?.email },
    { label: "Address", value: dealer?.address },
  ]);

  section("Payment Information");
  infoGrid([
    { label: "Method", value: order?.payment?.method },
    { label: "Reference", value: order?.payment?.reference },
  ]);

  itemsTable();
  totalsBox();

  if (order?.dealerNote) {
    section("Dealer Note");
    wrappedText(order.dealerNote, MARGIN_X, y, CONTENT_WIDTH, { size: 11, color: COLOR.ink });
    y += 32;
  }

  if (order?.internalNote) {
    section("Internal Note");
    wrappedText(order.internalNote, MARGIN_X, y, CONTENT_WIDTH, { size: 11, color: COLOR.ink });
    y += 32;
  }

  footer();

  const objects = [null];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageIds = [];
  for (const pageOps of pages) {
    const stream = pageOps.join("\n");
    const contentId = objects.length;
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);

    const pageId = objects.length;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  return buildPdf(objects);
}

export function buildOrderSummaryPdfAttachment(order) {
  return {
    filename: `${filenameSafe(order?.orderNumber || "order-summary")}.pdf`,
    content: buildOrderSummaryPdfBuffer(order),
    contentType: "application/pdf",
  };
}
