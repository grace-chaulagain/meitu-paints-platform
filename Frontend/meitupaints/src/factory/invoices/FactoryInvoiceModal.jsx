import { useMemo } from "react";
import { useGetProformaInvoiceQuery } from "../../redux/api/meituApi.js";
import { GhostButton, SectionHeader } from "../../components/dashboard/DashboardUI.jsx";
import { CloseButton, ModalOverlay } from "../factoryUI.jsx";
import { compactDateWithYear, computeProformaTotals, deriveProformaId, money } from "../factoryHelpers.js";
import { downloadProformaPdf } from "./downloadProformaPdf.jsx";

const PAGE_WIDTH_PX = 794; // A4 @ 96 CSS px/in, so this maps 1:1 to 595.28pt in the PDF

function InfoRow({ label, value }) {
  return (
    <>
      <span style={{ color: "#666", fontSize: 11.5 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#111", wordBreak: "break-word" }}>{value || "—"}</span>
    </>
  );
}

function productDisplayName(item) {
  const size = item.packLabel || item.variantLabel;
  return size ? `${item.name || "—"} (${size})` : item.name || "—";
}

export default function FactoryInvoiceModal({ orderId, onClose }) {
  const invoiceQuery = useGetProformaInvoiceQuery(orderId, { skip: !orderId });
  const invoice = invoiceQuery.data;
  const proforma = useMemo(
    () => computeProformaTotals(invoice?.items || [], { discount: invoice?.totals?.discount }),
    [invoice],
  );

  if (!orderId) return null;

  const copies = invoice?.copies || ["Factory Copy", "Driver Copy", "Dealer Copy"];
  const currency = invoice?.totals?.currency;
  const proformaId = deriveProformaId(invoice);

  return (
    <ModalOverlay open={Boolean(orderId)} onClose={onClose} maxWidth={900}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .factory-invoice-print, .factory-invoice-print * { visibility: visible; }
          .factory-invoice-print { position: absolute; top: 0; left: 0; width: 100%; }
          .factory-invoice-no-print { display: none !important; }
        }
      `}</style>
      {invoiceQuery.isLoading || !invoice ? (
        <div style={{ height: 320, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          <div className="factory-invoice-no-print" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <SectionHeader eyebrow="Print Preview" icon="invoice" title={`Proforma ${invoice.orderNumber}`} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GhostButton icon="print" onClick={() => window.print()}>Print</GhostButton>
              <GhostButton icon="download" onClick={() => downloadProformaPdf(invoice)}>
                Download PDF
              </GhostButton>
              <CloseButton onClick={onClose} />
            </div>
          </div>

          <div className="factory-invoice-print" style={{ display: "grid", gap: 24, justifyItems: "center" }}>
            {copies.map((copy) => (
              <section
                key={copy}
                style={{
                  width: PAGE_WIDTH_PX,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  padding: 36,
                  borderRadius: 8,
                  border: "1px solid #cfcfcf",
                  background: "#fff",
                  color: "#111",
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                <div style={{ textAlign: "center", position: "relative" }}>
                  <strong style={{ position: "absolute", top: 0, right: 0, fontSize: 11.5, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: ".03em" }}>
                    {copy}
                  </strong>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>Meitu Construction Materials Pvt. Ltd.</div>
                  <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: "#444" }}>Madhyapur Thimi-08, Bhaktapur</div>
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Proforma Invoice</div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #ddd", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 10 }}>
                    <InfoRow label="Dealer Name" value={invoice.dealer?.companyName} />
                    <InfoRow label="Contact Person" value={invoice.dealer?.contactName} />
                    <InfoRow label="Phone" value={invoice.dealer?.phone} />
                    <InfoRow label="Email" value={invoice.dealer?.email} />
                    <InfoRow label="Address" value={invoice.dealer?.address} />
                    <InfoRow label="VAT / PAN No." value={invoice.dealer?.panVat} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 10 }}>
                    <InfoRow label="Proforma ID" value={proformaId} />
                    <InfoRow label="Order No." value={invoice.orderNumber} />
                    <InfoRow label="Date" value={compactDateWithYear(invoice.generatedAt)} />
                    <InfoRow label="Payment Method" value={invoice.payment?.method} />
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #ddd", fontSize: 10.5, color: "#666" }}>
                  Driver: {invoice.driver?.name || "—"} &nbsp;·&nbsp; Vehicle: {invoice.driver?.vehicleNumber || "—"} &nbsp;·&nbsp; Phone: {invoice.driver?.phone || "—"}
                </div>

                <div style={{ marginTop: 16, border: "1px solid #ccc", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f2f2f2" }}>
                        {["Product", "Qty", "Unit", "Rate", "Amount"].map((head, index) => (
                          <th
                            key={head}
                            style={{
                              textAlign: index === 1 || index >= 3 ? "right" : "left",
                              padding: "8px 12px",
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: ".04em",
                              textTransform: "uppercase",
                              color: "#333",
                              borderBottom: "1px solid #ccc",
                            }}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {proforma.lines.map((item, index) => (
                        <tr key={`${copy}-${item.sku}-${index}`} style={{ borderTop: "1px solid #e2e2e2" }}>
                          <td style={{ padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>{productDisplayName(item)}</td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12 }}>{item.quantity}</td>
                          <td style={{ padding: "7px 12px", fontSize: 11.5 }}>{item.unit || item.packLabel || item.variantLabel || "—"}</td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12 }}>
                            {money(item.netUnitPrice, currency, { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                            {money(item.netAmount, currency, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: 280, border: "1px solid #ccc", borderRadius: 4, overflow: "hidden" }}>
                    {proforma.buckets.length === 1 ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", fontSize: 12 }}>
                          <span>Basic Amount</span>
                          <span>{money(proforma.buckets[0].basicAmount, currency, { maximumFractionDigits: 0 })}</span>
                        </div>
                        {proforma.buckets[0].exciseRatePercent > 0 ? (
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", fontSize: 12, borderTop: "1px solid #e2e2e2" }}>
                            <span>Excise Duty {proforma.buckets[0].exciseRatePercent}%</span>
                            <span>{money(proforma.buckets[0].exciseAmount, currency, { maximumFractionDigits: 0 })}</span>
                          </div>
                        ) : null}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", fontSize: 12.5, fontWeight: 700, borderTop: "1px solid #e2e2e2" }}>
                          <span>Taxable Amount</span>
                          <span>{money(proforma.buckets[0].taxableAmount, currency, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </>
                    ) : (
                      proforma.buckets.map((bucket) => (
                        <div key={bucket.key}>
                          <div style={{ padding: "7px 12px", borderTop: "1px solid #e2e2e2", fontSize: 11.5, fontWeight: 700, background: "#f7f7f7" }}>
                            {bucket.label}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px 6px 20px", fontSize: 12 }}>
                            <span>Basic Amount</span>
                            <span>{money(bucket.basicAmount, currency, { maximumFractionDigits: 0 })}</span>
                          </div>
                          {bucket.exciseRatePercent > 0 ? (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px 6px 20px", fontSize: 12 }}>
                              <span>Excise Duty {bucket.exciseRatePercent}%</span>
                              <span>{money(bucket.exciseAmount, currency, { maximumFractionDigits: 0 })}</span>
                            </div>
                          ) : null}
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px 6px 20px", fontSize: 12, fontWeight: 700 }}>
                            <span>Taxable Amount</span>
                            <span>{money(bucket.taxableAmount, currency, { maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      ))
                    )}
                    {proforma.buckets.length > 1 ? (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderTop: "1px solid #e2e2e2", fontSize: 12 }}>
                        <span>Total Taxable Amount</span>
                        <span>{money(proforma.taxableAmount, currency, { maximumFractionDigits: 0 })}</span>
                      </div>
                    ) : null}
                    {[
                      ["Discount", -proforma.discountAmount, false],
                      ["VAT 13%", proforma.vat, false],
                      ["Grand Total", proforma.grandTotal, true],
                    ].map(([label, value, emphasize]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "7px 12px",
                          borderTop: "1px solid #e2e2e2",
                          fontSize: emphasize ? 12.5 : 12,
                          fontWeight: emphasize ? 700 : 500,
                          background: emphasize ? "#f2f2f2" : "transparent",
                        }}
                      >
                        <span>{label}</span>
                        <span>{money(value, currency, { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 34, display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, color: "#444" }}>
                  <span>Factory ____________</span>
                  <span>Driver ____________</span>
                  <span>Dealer ____________</span>
                </div>

                <div style={{ marginTop: 18, paddingTop: 10, borderTop: "1px solid #ddd", fontSize: 9.5, color: "#888", textAlign: "center" }}>
                  Computer-generated proforma · Not a tax invoice · {compactDateWithYear(new Date())}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}
