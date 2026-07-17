// Consolidates every coupon front (+ one shared back) into a single
// print-ready PDF for handoff to an external print vendor, instead of
// thousands of loose SVG/PNG files (see downloadCouponPrintAssets.js for
// that per-file alternative, still offered alongside this one). One page
// per physical card, sized to the exact bleed dimensions, full-bleed -
// vendors' imposition software (Preps, Prinect, etc.) expects single-item
// pages at true trim size and steps/repeats them onto their own press
// sheet layout, so this deliberately doesn't pre-impose a fixed n-up grid.
//
// @react-pdf/renderer is dynamically imported (same reason as
// downloadProformaPdf.jsx: it's a sizeable chunk only admins generating a
// batch ever need) - this module itself is also only ever imported from
// inside GenerateTab.jsx's export handler, never eagerly.
import JSZip from "jszip";
import { CARD_DPI, CARD_HEIGHT, CARD_WIDTH, renderCouponBackPng, renderCouponFrontPng } from "./couponCardImage.js";

const PT_PER_INCH = 72;
// scale:1 (not the 2x used for the standalone PNG export) - at thousands of
// pages in one file, embedded-image weight compounds fast, and 660x1060px
// at ~297 DPI is already commercial-print quality for a 56x91mm card.
const CARD_WIDTH_PT = (CARD_WIDTH / CARD_DPI) * PT_PER_INCH;
const CARD_HEIGHT_PT = (CARD_HEIGHT / CARD_DPI) * PT_PER_INCH;

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function sanitizeForFilename(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// onProgress fires { phase: "render", done, total } while compositing each
// front, then { phase: "pdf" } once while react-pdf serializes the
// assembled document (no per-page signal available from its blob API, so
// this is a single indeterminate step rather than a percent), then
// { phase: "zip", percent } while JSZip compresses the PDF + manifest -
// see pdfExportProgressPercent/Label in couponFormatting.js for how the
// UI turns these into a single progress bar.
export async function downloadCouponPrintPdf({ coupons = [], batchId = "", onProgress } = {}) {
  if (!coupons.length) return;

  const { pdf, Document, Page, Image, StyleSheet } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 0 },
    image: { width: "100%", height: "100%" },
  });

  const productName = sanitizeForFilename(coupons[0].productName) || "Coupon";
  const bucketSize = sanitizeForFilename(coupons[0].bucketSize);
  const rootName = `${productName}${bucketSize ? `-${bucketSize}-QR` : "QR"}`;
  const type = coupons[0].type;

  const total = coupons.length;
  let done = 0;
  const frontImages = [];
  const manifestRows = [["Coupon Code", "Type", "Points", "Cash Amount", "Expires At", "PDF Page"]];

  for (const coupon of coupons) {
    const { pngDataUrl } = await renderCouponFrontPng({
      type: coupon.type,
      redeemUrl: coupon.redeemUrl,
      points: coupon.points,
      scale: 1,
    });
    frontImages.push(pngDataUrl);
    manifestRows.push([
      coupon.couponCode,
      coupon.type,
      coupon.points,
      coupon.cashAmount,
      new Date(coupon.expiresAt).toISOString(),
      String(frontImages.length),
    ]);

    done += 1;
    onProgress?.({ phase: "render", done, total });
  }

  const backImage = await renderCouponBackPng(type, { scale: 1 });
  manifestRows.push(["(shared back design)", type, "", "", "", String(frontImages.length + 1)]);

  onProgress?.({ phase: "pdf" });

  const doc = (
    <Document>
      {frontImages.map((src, index) => (
        <Page key={index} size={[CARD_WIDTH_PT, CARD_HEIGHT_PT]} style={styles.page}>
          <Image src={src} style={styles.image} />
        </Page>
      ))}
      <Page size={[CARD_WIDTH_PT, CARD_HEIGHT_PT]} style={styles.page}>
        <Image src={backImage} style={styles.image} />
      </Page>
    </Document>
  );

  const pdfBlob = await pdf(doc).toBlob();

  const zip = new JSZip();
  const root = zip.folder(rootName);
  root.file("print-ready.pdf", pdfBlob);
  root.file("manifest.csv", manifestRows.map((row) => row.map(csvEscape).join(",")).join("\n"));

  const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
    onProgress?.({ phase: "zip", percent: Math.round(metadata.percent) });
  });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${rootName || `coupon-print-pdf-${batchId || Date.now()}`}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
