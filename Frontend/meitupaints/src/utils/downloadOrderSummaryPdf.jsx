// @react-pdf/renderer pulls in its own layout engine and font metrics (a
// sizeable chunk) - dynamically imported so only whoever actually clicks
// "Download PDF" fetches it, instead of it inflating the shared app bundle
// every visitor loads (same pattern as downloadProformaPdf.jsx).
export async function downloadOrderSummaryPdf({ order, dealer }) {
  if (!order) return;

  const [{ pdf }, { default: OrderSummaryPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./OrderSummaryPdfDocument.jsx"),
  ]);

  const blob = await pdf(<OrderSummaryPdfDocument order={order} dealer={dealer} />).toBlob();

  const filename = `${String(order?.orderNumber || "order-summary").replace(/\s+/g, "-")}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // See downloadProformaPdf.jsx for why the revoke is deferred instead of
  // running immediately after click().
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
