import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { MeituLogoMark } from "./pdfBrand.jsx";
import { PDF_COLORS } from "./pdfColors.js";

// Same "document family" as the factory Proforma Invoice (structure,
// spacing, table proportions) but with its own lighter touch: the red mark
// and a red accent on the header rule/total instead of Proforma's grey/blue,
// and no boxed table/totals rectangles - rows just flow on thin hairlines,
// closer to how the dashboard itself favors whitespace and a restrained
// accent over bordered cards (see DESIGN.md). Dealer/order context stays
// condensed into one small block up top so the product table - the thing
// this document actually exists to show - gets most of the page.

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
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
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

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{titleCase(order?.status)}</Text>
        </View>
        <MeituLogoMark width={38} style={styles.logo} color={PDF_COLORS.red} />
        <Text style={styles.companyName}>Meitu Construction Materials Pvt. Ltd.</Text>
        <Text style={styles.companyAddress}>Madhyapur Thimi-08, Bhaktapur</Text>
        <Text style={styles.docTitle}>ORDER SUMMARY</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <InfoLine label="Dealer" value={dealerInfo?.companyName} />
            <InfoLine label="Contact" value={dealerInfo?.contactName} />
            <InfoLine label="Phone" value={dealerInfo?.phone} />
          </View>
          <View style={styles.infoCol}>
            <InfoLine label="Order No." value={order?.orderNumber} />
            <InfoLine label="Submitted" value={formatDateTime(order?.createdAt)} />
            <InfoLine label="Payment" value={order?.payment?.method} />
          </View>
        </View>

        <Text style={styles.contextLine}>
          Email: {safe(dealerInfo?.email)}   ·   Address: {safe(dealerInfo?.address)}   ·   Ref: {safe(order?.payment?.reference)}
        </Text>
      </View>

      <View wrap>
        <View style={styles.tableHeaderRow} fixed>
          <Text style={[styles.headerLabel, styles.colSN]}>SN</Text>
          <Text style={[styles.headerLabel, styles.colProduct]}>PRODUCT</Text>
          <Text style={[styles.headerLabel, styles.colQty]}>QTY</Text>
          <Text style={[styles.headerLabel, styles.colUnit]}>UNIT</Text>
          <Text style={[styles.headerLabel, styles.colRate]}>RATE</Text>
          <Text style={[styles.headerLabel, styles.colAmount]}>AMOUNT</Text>
        </View>
        {items.map((item, index) => (
          <View key={item.sku || item.name || index} style={styles.tableRow} wrap={false}>
            <Text style={styles.colSN}>{index + 1}</Text>
            <Text style={styles.colProduct}>{productDisplayName(item)}</Text>
            <Text style={styles.colQty}>{item?.quantity ?? "—"}</Text>
            <Text style={styles.colUnit}>{item?.unit || item?.packLabel || item?.variantLabel || "—"}</Text>
            <Text style={styles.colRate}>{money(item?.unitPrice, currency)}</Text>
            <Text style={styles.colAmount}>{money(item?.lineTotal, currency)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsWrap} wrap={false}>
        <View style={styles.totalsBox}>
          {totalsRows.map((row) => (
            <View key={row.label} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{row.label}</Text>
              <Text style={styles.totalsValue}>{money(row.value, currency)}</Text>
            </View>
          ))}
          <View style={[styles.totalsRow, styles.totalsRowEmphasis]}>
            <Text style={styles.totalsLabelEmphasis}>Total</Text>
            <Text style={styles.totalsValueEmphasis}>{money(order?.totals?.total, currency)}</Text>
          </View>
        </View>
      </View>

      {order?.dealerNote ? (
        <View style={styles.noteBlock} wrap={false}>
          <Text style={styles.noteLabel}>Dealer note</Text>
          <Text style={styles.noteValue}>{order.dealerNote}</Text>
        </View>
      ) : null}

      {order?.internalNote ? (
        <View style={styles.noteBlock} wrap={false}>
          <Text style={styles.noteLabel}>Internal note</Text>
          <Text style={styles.noteValue}>{order.internalNote}</Text>
        </View>
      ) : null}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Computer-generated order summary · {formatDateTime(new Date())}</Text>
        <Text style={styles.footerId}>Order: {safe(order?.orderNumber)}</Text>
      </View>
    </Page>
  );
}

export default function OrderSummaryPdfDocument({ order, dealer }) {
  return (
    <Document title={`Order Summary ${order?.orderNumber || ""}`}>
      <SummaryPage order={order} dealer={dealer} />
    </Document>
  );
}
