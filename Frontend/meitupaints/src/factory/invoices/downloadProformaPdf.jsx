import { computeProformaTotals, deriveProformaId } from "../factoryHelpers.js";

// @react-pdf/renderer pulls in its own layout engine and font metrics (a
// sizeable chunk) - dynamically imported so only factory users who actually
// click "Download PDF" fetch it, instead of it inflating the shared app
// bundle every visitor downloads on load.
export async function downloadProformaPdf(invoice) {
  if (!invoice) return;

  const [{ pdf }, { default: ProformaPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ProformaPdfDocument.jsx"),
  ]);

  const proforma = computeProformaTotals(invoice.items || [], { discount: invoice.totals?.discount });
  const blob = await pdf(<ProformaPdfDocument invoice={invoice} proforma={proforma} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${deriveProformaId(invoice)}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
