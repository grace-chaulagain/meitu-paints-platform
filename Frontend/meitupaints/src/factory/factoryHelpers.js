import { jsPDF } from "jspdf";

export function money(value, currency = "NPR", options = {}) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, options)}`;
}

export function titleCaseLabel(value) {
  if (!value) return "Unknown";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function compactDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
}

// Same as compactDate, plus the year - kept separate rather than changing
// compactDate itself, since compactDate is used across many other dashboard
// views where the year would just be redundant clutter.
export function compactDateWithYear(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(value) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function todayKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

// Local-calendar-day grouping key to pair with formatDayHeading below (which
// also compares in local time). todayKey() above is UTC-based (toISOString),
// so using it to group rows that are then labeled with formatDayHeading can
// split one local day into two UTC-day buckets near local midnight - both
// showing the same "Sunday, July 5" heading twice. This stays entirely in
// local time so the grouping key and the heading always agree.
export function localDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid-date";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Groups timestamps into calendar-day buckets with a friendly heading -
// "Today"/"Yesterday" read faster than a bare date for the last couple of
// days, falling back to a full date (with year only if not the current one).
export function formatDayHeading(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

// Time-only companion to formatDayHeading - once rows are grouped under a
// day heading, repeating the month/day per row (as compactDate does) is
// redundant, so views that group by day show just this instead.
export function formatTimeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function orderStatus(order) {
  return String(order?.status || "").toUpperCase();
}

// There's no separate factoryStage field anymore - the order's own status
// fully determines its kanban column now that the collapse leaves nothing
// ambiguous: VERIFIED is the Inbox, DISPATCHED is Shipment, COMPLETED is
// done. REJECTED gets its own lane rather than folding into Completed, so
// a factory worker can see turned-away orders separately from fulfilled ones.
export function laneForOrder(order) {
  const status = orderStatus(order);

  if (status === "REJECTED") return "REJECTED";
  if (["COMPLETED", "CANCELLED"].includes(status)) return "COMPLETED";
  if (status === "DISPATCHED") return "SHIPMENT";
  return "INBOX";
}

export function orderMatchesLane(order, lane) {
  return laneForOrder(order) === lane;
}

export function productCount(order) {
  return (order?.items || []).length;
}

export function priorityForOrder(order) {
  const ageMs = Date.now() - new Date(order?.factory?.sentToFactoryAt || order?.updatedAt || order?.createdAt || Date.now()).getTime();
  const hours = ageMs / 36e5;
  if (hours >= 24) return "High";
  if (hours >= 8) return "Medium";
  return "Normal";
}

export function isOrderAwaitingFactory(order) {
  return orderStatus(order) === "VERIFIED";
}

export function isOrderInShipment(order) {
  return orderStatus(order) === "DISPATCHED";
}

export function isOrderDone(order) {
  return ["COMPLETED", "REJECTED", "CANCELLED"].includes(orderStatus(order));
}

export function nextFactoryStep(order) {
  if (isOrderAwaitingFactory(order)) return "Generate invoice, assign driver, dispatch";
  if (isOrderInShipment(order)) return "Mark delivered after dealer handoff";
  if (orderStatus(order) === "COMPLETED") return "Delivery completed";
  if (orderStatus(order) === "REJECTED") return "Order rejected";
  return "Review order";
}

export function reservationLabel(order) {
  const status = String(order?.stockReservation?.status || "NONE").toUpperCase();
  if (status === "RESERVED") return "Reserved";
  if (status === "CONSUMED") return "Deducted";
  if (status === "RELEASED") return "Released";
  return "Not reserved";
}

export function stockCheckTone(status = "") {
  const normalized = String(status).toUpperCase();
  if (normalized === "AVAILABLE") return "positive";
  if (normalized === "LOW") return "caution";
  if (["INSUFFICIENT", "OUT_OF_STOCK"].includes(normalized)) return "critical";
  return "neutral";
}

export function statusTone(status) {
  const s = orderStatus({ status });
  if (s === "COMPLETED") return "positive";
  if (s === "REJECTED" || s === "CANCELLED") return "critical";
  if (s === "DISPATCHED" || s === "VERIFIED") return "accent";
  return "caution";
}

export function stockStatusTone(status = "") {
  const normalized = String(status).toUpperCase();
  if (normalized === "IN_STOCK") return "positive";
  if (normalized === "LOW_STOCK") return "caution";
  if (normalized === "OUT_OF_STOCK") return "critical";
  return "neutral";
}

export function stockImageUrl(item) {
  return (
    item?.primaryImage?.url ||
    item?.image?.url ||
    item?.imageUrl ||
    item?.images?.find?.((image) => image?.isPrimary)?.url ||
    item?.images?.[0]?.url ||
    ""
  );
}

export function makeActivity({ orders = [], history = [] }) {
  const orderEvents = orders.slice(0, 12).map((order) => ({
    id: `order-${order._id}`,
    at: order.updatedAt || order.createdAt,
    title: `Order ${order.orderNumber || ""} ${titleCaseLabel(order.status).toLowerCase()}`,
    meta: order.dealerSnapshot?.companyName || "Dealer",
  }));
  const stockEvents = history.slice(0, 12).map((row) => ({
    id: `stock-${row._id}`,
    at: row.changedAt,
    title: "Stock updated",
    meta: `${row.productName || row.sku || "Product"} ${Number(row.delta || 0) >= 0 ? "+" : ""}${row.delta || 0}`,
  }));
  return [...orderEvents, ...stockEvents]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);
}

export function fieldInputStyle() {
  return {
    width: "100%",
    height: 36,
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: "0 10px",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
  };
}

export const STOCK_REASONS = [
  "Manual Count",
  "Stock Received",
  "Stock Correction",
  "Damage / Loss",
  "Return",
  "Adjustment",
  "Other",
];

const INVOICE_BRAND = {
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

const PROFORMA_VAT_RATE = 0.13;

// Every product category maps to one of three tax buckets - shown as
// separate groups in the totals summary, in this display order.
const PROFORMA_TAX_BUCKET_ORDER = ["WALL_PUTTY", "OTHER", "TOOLS_ACCESSORIES"];
const PROFORMA_TAX_BUCKET_META = {
  WALL_PUTTY: { label: "Putting", exciseMultiplier: 1.05 },
  OTHER: { label: "Buckets", exciseMultiplier: 1.07 },
  TOOLS_ACCESSORIES: { label: "Tools and Accessories", exciseMultiplier: 1 },
};

function proformaBucketKey(category) {
  if (category === "WALL_PUTTY") return "WALL_PUTTY";
  if (category === "TOOLS_ACCESSORIES" || category === "COLORANT") return "TOOLS_ACCESSORIES";
  return "OTHER";
}

// Every stored unitPrice/lineTotal is already tax-inclusive (VAT + category
// excise baked in). This backs out the pre-tax "Amount" per line and the
// excise portion it contains, per the fixed scheme:
//   Wall Putty                    -> unitPrice / 1.13 / 1.05
//   Tools & Accessories / Colorant -> unitPrice / 1.13            (0% excise)
//   Everything else                -> unitPrice / 1.13 / 1.07
export function computeProformaLineAmounts(item) {
  const rate = Number(item?.unitPrice || 0);
  const quantity = Number(item?.quantity || 0);
  const bucketKey = proformaBucketKey(item?.category);
  const exciseMultiplier = PROFORMA_TAX_BUCKET_META[bucketKey].exciseMultiplier;
  const netUnitPrice = rate / (1 + PROFORMA_VAT_RATE) / exciseMultiplier;
  const netAmount = netUnitPrice * quantity;
  const exciseAmount = netAmount * (exciseMultiplier - 1);
  return { netUnitPrice, netAmount, exciseAmount, bucketKey };
}

// Per tax bucket: Basic Amount (net) + Excise Duty (skipped when the
// bucket's rate is 0%, e.g. Tools and Accessories) = Taxable Amount.
// Overall: Total Taxable Amount (sum of every bucket's Taxable Amount) minus
// Discount, taxed at 13% VAT, gives the Grand Total - reconciles exactly to
// the sum of the original tax-inclusive line totals when discount is 0.
export function computeProformaTotals(items = [], { discount = 0 } = {}) {
  let basicAmount = 0;
  let totalExcise = 0;
  const bucketAmounts = new Map();

  const lines = (items || []).map((item) => {
    const { netUnitPrice, netAmount, exciseAmount, bucketKey } = computeProformaLineAmounts(item);
    basicAmount += netAmount;
    totalExcise += exciseAmount;

    const bucket = bucketAmounts.get(bucketKey) || { basicAmount: 0, exciseAmount: 0 };
    bucket.basicAmount += netAmount;
    bucket.exciseAmount += exciseAmount;
    bucketAmounts.set(bucketKey, bucket);

    return { ...item, netUnitPrice, netAmount };
  });

  const buckets = PROFORMA_TAX_BUCKET_ORDER.filter((key) => bucketAmounts.has(key)).map((key) => {
    const meta = PROFORMA_TAX_BUCKET_META[key];
    const { basicAmount: bucketBasic, exciseAmount: bucketExcise } = bucketAmounts.get(key);
    return {
      key,
      label: meta.label,
      exciseRatePercent: Math.round((meta.exciseMultiplier - 1) * 100),
      basicAmount: bucketBasic,
      exciseAmount: bucketExcise,
      taxableAmount: bucketBasic + bucketExcise,
    };
  });

  const taxableAmount = basicAmount + totalExcise;
  const discountAmount = Math.min(Number(discount || 0), taxableAmount);
  const vat = (taxableAmount - discountAmount) * PROFORMA_VAT_RATE;
  const grandTotal = taxableAmount - discountAmount + vat;

  return { lines, buckets, basicAmount, taxableAmount, discountAmount, vat, grandTotal };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(value) {
  if (value < 20) return ONES[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(value) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

// Nepali/Indian numbering convention (Lakh = 10^5, Crore = 10^7) rather than
// the Western thousand/million grouping - the correct convention for an NPR
// invoice, and how the amount would actually be read aloud locally.
function integerToWords(value) {
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const hundred = value % 1000;

  const parts = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return parts.join(" ");
}

// e.g. amountInWords(72500) -> "Rupees Seventy Two Thousand Five Hundred Only"
export function amountInWords(value, currency = "NPR") {
  const numeric = Math.round(Number(value) || 0);
  const currencyWord = currency === "NPR" ? "Rupees" : currency;
  return `${currencyWord} ${integerToWords(Math.abs(numeric))} Only`;
}

// "PI-XXXXXX" identifier - reuses the order number's own trailing 6
// characters (e.g. "ORD-20260629-9C3450" -> "PI-9C3450") rather than a
// derived hash, so it's instantly recognizable as the same order rather
// than an unrelated-looking code. Still stable across repeat previews,
// downloads, and all 3 copies within one PDF, since it's read straight off
// the order's own permanent number rather than computed fresh each time.
export function deriveProformaId(invoice) {
  const source = String(invoice?.orderNumber || invoice?.orderId || "");
  const cleaned = source.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = cleaned.slice(-6).padStart(6, "0");
  return `PI-${tail}`;
}

// A real, numbered tax invoice - distinct from the 3-copy proforma above.
// Modeled on the same branded layout as downloadOrderSummaryPdf.js so
// every PDF this app produces reads as one consistent document family.
export function downloadTaxInvoicePdf({ invoice, order }) {
  if (!invoice || !order) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;
  const usableBottom = pageHeight - 74;
  const currency = order.totals?.currency || invoice.totalsSnapshot?.currency || "NPR";
  const billedTo = order.dealerSnapshot || {};
  const items = Array.isArray(order.items) ? order.items : [];

  let y = 0;
  let pageNo = 1;

  function setFont({ size = 11, bold = false, color = INVOICE_BRAND.ink } = {}) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  function addText(text, x, yy, opts = {}) {
    setFont(opts);
    doc.text(String(text), x, yy, { align: opts.align || "left", maxWidth: opts.maxWidth });
  }

  function addWrappedText(text, x, yy, maxWidth, opts = {}) {
    setFont(opts);
    const lines = doc.splitTextToSize(String(text ?? "—"), maxWidth);
    doc.text(lines, x, yy, { align: opts.align || "left", maxWidth });
    return lines;
  }

  function footer() {
    doc.setDrawColor(...INVOICE_BRAND.line);
    doc.line(marginX, pageHeight - 34, pageWidth - marginX, pageHeight - 34);
    addText(`Computer-generated invoice — no signature required · ${compactDate(new Date())}`, marginX, pageHeight - 18, { size: 8.5, color: INVOICE_BRAND.muted });
    addText(`Page ${pageNo}`, pageWidth - marginX, pageHeight - 18, { size: 8.5, color: INVOICE_BRAND.muted, align: "right" });
  }

  function header(firstPage) {
    if (firstPage) {
      doc.setFillColor(...INVOICE_BRAND.redDark);
      doc.rect(0, 0, pageWidth, 104, "F");
      doc.setFillColor(...INVOICE_BRAND.redSoft);
      doc.rect(0, 104, pageWidth, 6, "F");

      addText("Meitu Construction Materials Pvt. Ltd.", marginX, 34, { size: 14, bold: true, color: INVOICE_BRAND.white, maxWidth: 340 });
      addText("Madhyapur Thimi-08, Bhaktapur", marginX, 58, { size: 9.5, color: [255, 236, 236] });
      addText("TAX INVOICE", pageWidth - marginX, 38, { size: 15, bold: true, color: INVOICE_BRAND.white, align: "right" });
      addText(invoice.invoiceNumber, pageWidth - marginX, 58, { size: 12, bold: true, color: [255, 236, 236], align: "right" });
      addText(`Issued ${compactDate(invoice.issuedAt)}`, pageWidth - marginX, 76, { size: 9, color: [255, 236, 236], align: "right" });
      y = 134;
    } else {
      doc.setFillColor(...INVOICE_BRAND.softBg);
      doc.rect(0, 0, pageWidth, 56, "F");
      addText("Meitu Construction Materials Pvt. Ltd.", marginX, 24, { size: 11, bold: true, color: INVOICE_BRAND.ink });
      addText(invoice.invoiceNumber, pageWidth - marginX, 26, { size: 10, bold: true, color: INVOICE_BRAND.ink, align: "right" });
      y = 74;
    }
  }

  function newPage() {
    footer();
    doc.addPage();
    pageNo += 1;
    header(false);
  }

  function ensureSpace(needed = 40) {
    if (y + needed > usableBottom) newPage();
  }

  function sectionTitle(title) {
    ensureSpace(34);
    addText(title, marginX, y, { size: 12.5, bold: true, color: INVOICE_BRAND.ink });
    y += 12;
    doc.setDrawColor(...INVOICE_BRAND.line);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 18;
  }

  function infoGrid(rows) {
    const leftX = marginX;
    const rightX = pageWidth / 2 + 12;
    const colWidth = pageWidth / 2 - marginX - 24;

    for (let i = 0; i < rows.length; i += 2) {
      const left = rows[i];
      const right = rows[i + 1];
      ensureSpace(54);

      if (left) addText(left.label, leftX, y, { size: 9, bold: true, color: INVOICE_BRAND.muted });
      if (right) addText(right.label, rightX, y, { size: 9, bold: true, color: INVOICE_BRAND.muted });
      y += 14;

      const leftLines = left ? addWrappedText(left.value, leftX, y, colWidth, { size: 11, color: INVOICE_BRAND.ink }) : ["—"];
      const rightLines = right ? addWrappedText(right.value, rightX, y, colWidth, { size: 11, color: INVOICE_BRAND.ink }) : ["—"];
      y += Math.max(leftLines.length, rightLines.length) * 14 + 14;
    }
  }

  header(true);

  sectionTitle("Order Reference");
  infoGrid([
    { label: "Order Number", value: order.orderNumber },
    { label: "Order Date", value: compactDate(order.createdAt) },
    { label: "Payment Method", value: order.payment?.method },
    { label: "Payment Reference", value: order.payment?.reference },
  ]);

  sectionTitle("Billed To");
  infoGrid([
    { label: "Name", value: billedTo.companyName || billedTo.contactName },
    { label: "Contact", value: billedTo.contactName },
    { label: "Phone", value: billedTo.phone },
    { label: "Email", value: billedTo.email },
    { label: "Address", value: billedTo.address },
  ]);

  sectionTitle("Items");
  const col = { snX: marginX, itemX: 74, packX: 344, qtyX: 420, rateX: 486, amountX: 556, itemWidth: 260 };

  function tableHeader() {
    ensureSpace(34);
    doc.setFillColor(...INVOICE_BRAND.softBg);
    doc.roundedRect(marginX, y - 12, contentWidth, 26, 6, 6, "F");
    addText("SN", col.snX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted });
    addText("Item", col.itemX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted });
    addText("Pack", col.packX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted });
    addText("Qty", col.qtyX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted, align: "right" });
    addText("Rate", col.rateX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted, align: "right" });
    addText("Amount", col.amountX, y + 5, { size: 9, bold: true, color: INVOICE_BRAND.muted, align: "right" });
    y += 32;
  }

  tableHeader();
  items.forEach((item, index) => {
    const nameLines = doc.splitTextToSize(String(item.name || "—"), col.itemWidth);
    const rowHeight = Math.max(24, nameLines.length * 13 + 8);
    ensureSpace(rowHeight + 14);
    if (y + rowHeight > usableBottom) {
      newPage();
      sectionTitle("Items (continued)");
      tableHeader();
    }

    addText(String(index + 1), col.snX, y, { size: 10, color: INVOICE_BRAND.muted });
    addText(nameLines, col.itemX, y, { size: 10, bold: true, color: INVOICE_BRAND.ink, maxWidth: col.itemWidth });
    addText(item.packLabel || item.variantLabel || "—", col.packX, y, { size: 10, color: INVOICE_BRAND.ink });
    addText(Number(item.quantity || 0).toLocaleString(), col.qtyX, y, { size: 10, color: INVOICE_BRAND.ink, align: "right" });
    addText(Number(item.unitPrice || 0).toLocaleString(), col.rateX, y, { size: 10, color: INVOICE_BRAND.ink, align: "right" });
    addText(Number(item.lineTotal || 0).toLocaleString(), col.amountX, y, { size: 10, bold: true, color: INVOICE_BRAND.ink, align: "right" });
    y += rowHeight;

    if (index !== items.length - 1) {
      doc.setDrawColor(...INVOICE_BRAND.line);
      doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
      y += 8;
    }
  });

  y += 16;
  ensureSpace(112);
  const boxWidth = 238;
  const boxX = pageWidth - marginX - boxWidth;
  doc.setFillColor(252, 244, 243);
  doc.setDrawColor(...INVOICE_BRAND.redSoft);
  doc.roundedRect(boxX, y, boxWidth, 92, 12, 12, "FD");
  addText("Subtotal", boxX + 16, y + 22, { size: 9.5, color: INVOICE_BRAND.muted });
  addText(money(order.totals?.subtotal, currency), boxX + boxWidth - 16, y + 22, { size: 10.5, color: INVOICE_BRAND.ink, align: "right" });
  addText("Tax", boxX + 16, y + 42, { size: 9.5, color: INVOICE_BRAND.muted });
  addText(money(order.totals?.tax, currency), boxX + boxWidth - 16, y + 42, { size: 10.5, color: INVOICE_BRAND.ink, align: "right" });
  addText("Grand Total", boxX + 16, y + 70, { size: 11, bold: true, color: INVOICE_BRAND.ink });
  addText(money(order.totals?.total, currency), boxX + boxWidth - 16, y + 70, { size: 15, bold: true, color: INVOICE_BRAND.red, align: "right" });

  footer();
  doc.save(`${invoice.invoiceNumber}.pdf`);
}
