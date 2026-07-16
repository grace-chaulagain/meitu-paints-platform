import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { amountInWords, compactDateWithYear, deriveProformaId, money } from "../factoryHelpers.js";

const MEITU_PAN = "606572561";

// Mirrors FactoryInvoiceModal.jsx's on-screen layout, but declared with
// react-pdf's flexbox primitives instead of raw HTML/CSS. Unlike the earlier
// hand-drawn jsPDF version, wrapping and row height are handled by the same
// Yoga (flexbox) engine React Native uses - a long dealer name or email
// wraps and pushes sibling rows down automatically, instead of needing each
// wrapped-line count computed and accounted for by hand.
const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: "#111111" },
  header: { textAlign: "center", position: "relative" },
  panLabel: {
    position: "absolute",
    top: 2,
    right: 0,
    fontSize: 8.5,
    fontWeight: 700,
    color: "#555555",
  },
  companyName: { fontSize: 16, fontWeight: 700 },
  companyAddress: { marginTop: 3, fontSize: 9.5, fontWeight: 700, color: "#444444" },
  docTitle: { marginTop: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase" },
  infoSection: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#dddddd" },
  infoRow: { flexDirection: "row", gap: 18 },
  infoColLeft: { flex: 1.3 },
  infoColRight: { flex: 1 },
  infoLine: { flexDirection: "row", marginBottom: 6 },
  infoLabel: { width: 92, fontSize: 8.5, color: "#666666" },
  infoValue: { fontSize: 9.5, fontWeight: 700, flex: 1 },
  driverLine: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    borderTopStyle: "dashed",
    fontSize: 8.5,
    color: "#666666",
  },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#cccccc", borderRadius: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    columnGap: 8,
    backgroundColor: "#f2f2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    columnGap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  headerLabel: { fontSize: 8, fontWeight: 700, color: "#666666", textTransform: "uppercase" },
  colProduct: { flex: 2.4, fontSize: 9.5, fontWeight: 700 },
  colQty: { flex: 0.6, fontSize: 9.5, textAlign: "right" },
  colUnit: { flex: 0.7, fontSize: 9 },
  colRate: { flex: 1, fontSize: 9.5, textAlign: "right" },
  colAmount: { flex: 1.2, fontSize: 9.5, fontWeight: 700, textAlign: "right" },
  amountInWordsRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    borderTopStyle: "dashed",
  },
  amountInWordsLabel: { fontSize: 7.5, fontWeight: 700, color: "#888888", textTransform: "uppercase" },
  amountInWordsValue: { marginTop: 2, fontSize: 8.5, fontWeight: 700, color: "#333333" },
  totalsWrap: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: 230, borderWidth: 1, borderColor: "#cccccc", borderRadius: 4 },
  bucketLabel: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    fontSize: 8,
    fontWeight: 700,
    backgroundColor: "#f7f7f7",
  },
  bucketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    paddingLeft: 14,
    paddingRight: 8,
    fontSize: 7.5,
  },
  bucketRowEmphasis: { fontWeight: 700 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
  },
  totalsRowEmphasis: { backgroundColor: "#f2f2f2" },
  totalsLabel: { fontSize: 8, fontWeight: 500 },
  totalsLabelEmphasis: { fontSize: 8.5, fontWeight: 700 },
  totalsValue: { fontSize: 8, fontWeight: 700 },
  totalsValueEmphasis: { fontSize: 8.5, fontWeight: 700 },
  signatureRow: {
    marginTop: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9.5,
    fontWeight: 700,
    color: "#444444",
  },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    fontSize: 8.5,
    color: "#888888",
    textAlign: "center",
  },
});

function InfoLine({ label, value }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

function productDisplayName(item) {
  const size = item.packLabel || item.variantLabel;
  return size ? `${item.name || "—"} (${size})` : item.name || "—";
}

function InvoicePage({ invoice, proforma, proformaId }) {
  const currency = invoice.totals?.currency;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.panLabel}>PAN: {MEITU_PAN}</Text>
        <Text style={styles.companyName}>Meitu Construction Materials Pvt. Ltd.</Text>
        <Text style={styles.companyAddress}>Madhyapur Thimi-08, Bhaktapur</Text>
        <Text style={styles.docTitle}>PROFORMA INVOICE</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <View style={styles.infoColLeft}>
            <InfoLine label="Company Name" value={invoice.dealer?.companyName} />
            <InfoLine label="Phone" value={invoice.dealer?.phone} />
            <InfoLine label="Email" value={invoice.dealer?.email} />
            <InfoLine label="Address" value={invoice.dealer?.address} />
            <InfoLine label="VAT / PAN No." value={invoice.dealer?.panVat} />
          </View>
          <View style={styles.infoColRight}>
            <InfoLine label="Proforma ID" value={proformaId} />
            <InfoLine label="Date" value={compactDateWithYear(invoice.generatedAt)} />
            <InfoLine label="Payment Method" value={invoice.payment?.method} />
          </View>
        </View>
      </View>

      <Text style={styles.driverLine}>
        Driver: {invoice.driver?.name || "—"}   ·   Vehicle: {invoice.driver?.vehicleNumber || "—"}   ·   Phone: {invoice.driver?.phone || "—"}
      </Text>

      <View style={styles.table} wrap>
        <View style={styles.tableHeaderRow} fixed>
          <Text style={[styles.headerLabel, styles.colProduct]}>PRODUCT</Text>
          <Text style={[styles.headerLabel, styles.colQty]}>QTY</Text>
          <Text style={[styles.headerLabel, styles.colUnit]}>UNIT</Text>
          <Text style={[styles.headerLabel, styles.colRate]}>RATE</Text>
          <Text style={[styles.headerLabel, styles.colAmount]}>AMOUNT</Text>
        </View>
        {proforma.lines.map((item, index) => (
          <View key={item.sku || item.name || index} style={styles.tableRow} wrap={false}>
            <Text style={styles.colProduct}>{productDisplayName(item)}</Text>
            <Text style={styles.colQty}>{item.quantity ?? "—"}</Text>
            <Text style={styles.colUnit}>{item.unit || item.packLabel || item.variantLabel || "—"}</Text>
            <Text style={styles.colRate}>
              {money(item.netUnitPrice, currency, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.colAmount}>
              {money(item.netAmount, currency, { maximumFractionDigits: 0 })}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.amountInWordsRow} wrap={false}>
        <Text style={styles.amountInWordsLabel}>Amount in Words</Text>
        <Text style={styles.amountInWordsValue}>{amountInWords(proforma.grandTotal, currency)}</Text>
      </View>

      <View style={styles.totalsWrap} wrap={false}>
        <View style={styles.totalsBox}>
          {proforma.buckets.length === 1 ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Basic Amount</Text>
                <Text style={styles.totalsValue}>
                  {money(proforma.buckets[0].basicAmount, currency, { maximumFractionDigits: 0 })}
                </Text>
              </View>
              {proforma.buckets[0].exciseRatePercent > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Excise Duty {proforma.buckets[0].exciseRatePercent}%</Text>
                  <Text style={styles.totalsValue}>
                    {money(proforma.buckets[0].exciseAmount, currency, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ) : null}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabelEmphasis}>Taxable Amount</Text>
                <Text style={styles.totalsValueEmphasis}>
                  {money(proforma.buckets[0].taxableAmount, currency, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </>
          ) : (
            proforma.buckets.map((bucket) => (
              <View key={bucket.key}>
                <Text style={styles.bucketLabel}>{bucket.label}</Text>
                <View style={styles.bucketRow}>
                  <Text>Basic Amount</Text>
                  <Text>{money(bucket.basicAmount, currency, { maximumFractionDigits: 0 })}</Text>
                </View>
                {bucket.exciseRatePercent > 0 ? (
                  <View style={styles.bucketRow}>
                    <Text>Excise Duty {bucket.exciseRatePercent}%</Text>
                    <Text>{money(bucket.exciseAmount, currency, { maximumFractionDigits: 0 })}</Text>
                  </View>
                ) : null}
                <View style={[styles.bucketRow, styles.bucketRowEmphasis]}>
                  <Text>Taxable Amount</Text>
                  <Text>{money(bucket.taxableAmount, currency, { maximumFractionDigits: 0 })}</Text>
                </View>
              </View>
            ))
          )}
          {proforma.buckets.length > 1 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total Taxable Amount</Text>
              <Text style={styles.totalsValue}>
                {money(proforma.taxableAmount, currency, { maximumFractionDigits: 0 })}
              </Text>
            </View>
          ) : null}
          {[
            ["Discount", -proforma.discountAmount, false],
            ["VAT 13%", proforma.vat, false],
            ["Grand Total", proforma.grandTotal, true],
          ].map(([label, value, emphasize]) => (
            <View key={label} style={[styles.totalsRow, emphasize && styles.totalsRowEmphasis]}>
              <Text style={emphasize ? styles.totalsLabelEmphasis : styles.totalsLabel}>{label}</Text>
              <Text style={emphasize ? styles.totalsValueEmphasis : styles.totalsValue}>
                {money(value, currency, { maximumFractionDigits: 0 })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.signatureRow} wrap={false}>
        <Text>Factory ____________</Text>
        <Text>Driver ____________</Text>
        <Text>Receiver ____________</Text>
      </View>

      <Text style={styles.footer} fixed>
        Computer-generated proforma · Not a tax invoice · {compactDateWithYear(new Date())}
      </Text>
    </Page>
  );
}

export default function ProformaPdfDocument({ invoice, proforma }) {
  const proformaId = deriveProformaId(invoice);

  return (
    <Document title={`Proforma ${invoice?.orderNumber || ""}`}>
      <InvoicePage invoice={invoice} proforma={proforma} proformaId={proformaId} />
    </Document>
  );
}
