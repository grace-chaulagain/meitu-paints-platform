import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MeituLogoMark } from "./pdfBrand.js";
import { PDF_COLORS } from "./pdfColors.js";

// Server-side port of Frontend/meitupaints/src/utils/OrderSummaryPdfDocument.jsx
// - same component, styles, and layout, written with React.createElement
// instead of JSX (the server has no JSX transform). This is what gets
// emailed to the factory as an attachment at order-verification time
// (orderPdf.service.js) - it must stay visually identical to what the
// dealer downloads from their own order detail page, so any change to the
// frontend source should be mirrored here by hand.

const e = React.createElement;

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function safe(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" });
}

function titleCase(value) {
  if (!value) return "—";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function productDisplayName(item) {
  const size = item?.packLabel || item?.variantLabel || item?.unit;
  return size ? `${item?.name || "—"} (${size})` : item?.name || "—";
}

function resolveDealer(order, dealer) {
  return dealer || order?.dealerSnapshot || order?.dealerId || {};
}

function resolveItems(order) {
  if (Array.isArray(order?.items)) return order.items;
  if (Array.isArray(order?.snapshot?.items)) return order.snapshot.items;
  return [];
}

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: PDF_COLORS.ink },
  header: { textAlign: "center", alignItems: "center", position: "relative" },
  logo: { marginBottom: 7 },
  statusPill: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: PDF_COLORS.redSoft,
  },
  statusPillText: { fontSize: 8, fontWeight: 700, color: PDF_COLORS.red, textTransform: "uppercase" },
  companyName: { fontSize: 16, fontWeight: 700 },
  companyAddress: { marginTop: 3, fontSize: 9.5, fontWeight: 700, color: PDF_COLORS.graphite },
  docTitle: { marginTop: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase" },
  infoSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1.5, borderTopColor: PDF_COLORS.red },
  infoRow: { flexDirection: "row", gap: 18 },
  infoCol: { flex: 1 },
  infoLine: { flexDirection: "row", marginBottom: 6 },
  infoLabel: { width: 78, fontSize: 8.5, color: PDF_COLORS.graphite },
  infoValue: { fontSize: 9.5, fontWeight: 700, flex: 1 },
  contextLine: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.lineSoft,
    fontSize: 8.5,
    color: PDF_COLORS.graphite,
  },
  tableHeaderRow: {
    flexDirection: "row",
    columnGap: 6,
    marginTop: 22,
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_COLORS.red,
    paddingBottom: 7,
  },
  tableRow: {
    flexDirection: "row",
    columnGap: 6,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.lineSoft,
    paddingVertical: 8,
  },
  headerLabel: { fontSize: 8, fontWeight: 700, color: PDF_COLORS.graphite, textTransform: "uppercase" },
  colSN: { width: 18, fontSize: 9, textAlign: "center", color: PDF_COLORS.graphite },
  colProduct: { flex: 2.9, fontSize: 9.5, fontWeight: 700 },
  colQty: { flex: 0.5, fontSize: 9.5, textAlign: "right" },
  colUnit: { flex: 0.6, fontSize: 9, paddingLeft: 12 },
  colRate: { flex: 0.85, fontSize: 9.5, textAlign: "right" },
  colAmount: { flex: 1.05, fontSize: 9.5, fontWeight: 700, textAlign: "right" },
  totalsWrap: { marginTop: 6, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: 210 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.lineSoft,
  },
  totalsRowEmphasis: { borderTopWidth: 1.5, borderTopColor: PDF_COLORS.red, marginTop: 2, paddingTop: 8 },
  totalsLabel: { fontSize: 8.5, fontWeight: 500, color: PDF_COLORS.graphite },
  totalsLabelEmphasis: { fontSize: 10, fontWeight: 700, color: PDF_COLORS.ink },
  totalsValue: { fontSize: 8.5, fontWeight: 700, color: PDF_COLORS.ink },
  totalsValueEmphasis: { fontSize: 13, fontWeight: 700, color: PDF_COLORS.red },
  noteBlock: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.lineSoft,
  },
  noteLabel: { fontSize: 8, fontWeight: 700, color: PDF_COLORS.muted },
  noteValue: { marginTop: 3, fontSize: 9, color: PDF_COLORS.ink },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.line,
    textAlign: "center",
  },
  footerText: { fontSize: 8.5, color: PDF_COLORS.muted },
  footerId: { marginTop: 2, fontSize: 7, color: "#aaaaaa" },
});

function InfoLine({ label, value }) {
  return e(View, { style: styles.infoLine }, [
    e(Text, { style: styles.infoLabel, key: "label" }, label),
    e(Text, { style: styles.infoValue, key: "value" }, value || "—"),
  ]);
}

function SummaryPage({ order, dealer }) {
  const dealerInfo = resolveDealer(order, dealer);
  const items = resolveItems(order);
  const currency = order?.totals?.currency || "NPR";
  const totals = order?.totals || {};

  const totalsRows = [
    { label: "Subtotal", value: totals.subtotal },
    totals.discount > 0 ? { label: "Discount", value: -totals.discount } : null,
    totals.tax > 0 ? { label: "Tax", value: totals.tax } : null,
  ].filter(Boolean);

  return e(Page, { size: "A4", style: styles.page }, [
    e(View, { style: styles.header, key: "header" }, [
      e(View, { style: styles.statusPill, key: "pill" }, e(Text, { style: styles.statusPillText }, titleCase(order?.status))),
      e(MeituLogoMark, { width: 38, style: styles.logo, color: PDF_COLORS.red, key: "logo" }),
      e(Text, { style: styles.companyName, key: "companyName" }, "Meitu Construction Materials Pvt. Ltd."),
      e(Text, { style: styles.companyAddress, key: "companyAddress" }, "Madhyapur Thimi-08, Bhaktapur"),
      e(Text, { style: styles.docTitle, key: "docTitle" }, "ORDER SUMMARY"),
    ]),

    e(View, { style: styles.infoSection, key: "infoSection" }, [
      e(View, { style: styles.infoRow, key: "infoRow" }, [
        e(View, { style: styles.infoCol, key: "col1" }, [
          e(InfoLine, { label: "Dealer", value: dealerInfo?.companyName, key: "dealer" }),
          e(InfoLine, { label: "Contact", value: dealerInfo?.contactName, key: "contact" }),
          e(InfoLine, { label: "Phone", value: dealerInfo?.phone, key: "phone" }),
        ]),
        e(View, { style: styles.infoCol, key: "col2" }, [
          e(InfoLine, { label: "Order No.", value: order?.orderNumber, key: "orderNo" }),
          e(InfoLine, { label: "Submitted", value: formatDateTime(order?.createdAt), key: "submitted" }),
          e(InfoLine, { label: "Payment", value: order?.payment?.method, key: "payment" }),
        ]),
      ]),
      e(
        Text,
        { style: styles.contextLine, key: "contextLine" },
        `Email: ${safe(dealerInfo?.email)}   ·   Address: ${safe(dealerInfo?.address)}   ·   Ref: ${safe(order?.payment?.reference)}`,
      ),
    ]),

    e(View, { wrap: true, key: "table" }, [
      e(
        View,
        { style: styles.tableHeaderRow, fixed: true, key: "tableHeaderRow" },
        [
          e(Text, { style: [styles.headerLabel, styles.colSN], key: "sn" }, "SN"),
          e(Text, { style: [styles.headerLabel, styles.colProduct], key: "product" }, "PRODUCT"),
          e(Text, { style: [styles.headerLabel, styles.colQty], key: "qty" }, "QTY"),
          e(Text, { style: [styles.headerLabel, styles.colUnit], key: "unit" }, "UNIT"),
          e(Text, { style: [styles.headerLabel, styles.colRate], key: "rate" }, "RATE"),
          e(Text, { style: [styles.headerLabel, styles.colAmount], key: "amount" }, "AMOUNT"),
        ],
      ),
      ...items.map((item, index) =>
        e(View, { key: item.sku || item.name || index, style: styles.tableRow, wrap: false }, [
          e(Text, { style: styles.colSN, key: "sn" }, index + 1),
          e(Text, { style: styles.colProduct, key: "product" }, productDisplayName(item)),
          e(Text, { style: styles.colQty, key: "qty" }, item?.quantity ?? "—"),
          e(Text, { style: styles.colUnit, key: "unit" }, item?.unit || item?.packLabel || item?.variantLabel || "—"),
          e(Text, { style: styles.colRate, key: "rate" }, money(item?.unitPrice, currency)),
          e(Text, { style: styles.colAmount, key: "amount" }, money(item?.lineTotal, currency)),
        ]),
      ),
    ]),

    e(View, { style: styles.totalsWrap, wrap: false, key: "totalsWrap" }, [
      e(View, { style: styles.totalsBox, key: "totalsBox" }, [
        ...totalsRows.map((row) =>
          e(View, { key: row.label, style: styles.totalsRow }, [
            e(Text, { style: styles.totalsLabel, key: "label" }, row.label),
            e(Text, { style: styles.totalsValue, key: "value" }, money(row.value, currency)),
          ]),
        ),
        e(View, { style: [styles.totalsRow, styles.totalsRowEmphasis], key: "total" }, [
          e(Text, { style: styles.totalsLabelEmphasis, key: "label" }, "Total"),
          e(Text, { style: styles.totalsValueEmphasis, key: "value" }, money(order?.totals?.total, currency)),
        ]),
      ]),
    ]),

    order?.dealerNote
      ? e(View, { style: styles.noteBlock, wrap: false, key: "dealerNote" }, [
          e(Text, { style: styles.noteLabel, key: "label" }, "Dealer note"),
          e(Text, { style: styles.noteValue, key: "value" }, order.dealerNote),
        ])
      : null,

    order?.internalNote
      ? e(View, { style: styles.noteBlock, wrap: false, key: "internalNote" }, [
          e(Text, { style: styles.noteLabel, key: "label" }, "Internal note"),
          e(Text, { style: styles.noteValue, key: "value" }, order.internalNote),
        ])
      : null,

    e(View, { style: styles.footer, fixed: true, key: "footer" }, [
      e(Text, { style: styles.footerText, key: "footerText" }, `Computer-generated order summary · ${formatDateTime(new Date())}`),
      e(Text, { style: styles.footerId, key: "footerId" }, `Order: ${safe(order?.orderNumber)}`),
    ]),
  ]);
}

export default function OrderSummaryPdfDocument({ order, dealer }) {
  return e(Document, { title: `Order Summary ${order?.orderNumber || ""}` }, e(SummaryPage, { order, dealer }));
}
