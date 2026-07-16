import JSZip from "jszip";
import { renderCouponFrontPng, getCouponBackSvg, renderCouponBackPng } from "./couponCardImage.js";

// Meitu doesn't print these coupons in-house - the assets get handed off to
// an external print vendor, who cut/produce the physical cards from them.
// So the deliverable is one print-ready front card per coupon (QR + points
// composited onto the real Gold/Green template, both as a vector SVG - the
// format professional print shops prefer, since it never pixelates
// regardless of final print size - and a high-res PNG fallback), plus one
// shared back card per batch (the back carries no per-coupon data), plus a
// manifest so the vendor's and Meitu's records both trace back cleanly from
// a physical coupon to its exact coupon code / points / cash amount.
function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

// Every coupon shares a filesystem-unsafe character blocklist regardless of
// OS (Windows is the strictest, and the print vendor may be on Windows).
function sanitizeForFilename(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// One batch is always one product (+ size) and one coupon type -
// schemeProductId is fixed per generateCoupons call - so the root folder
// name and the shared back card are derived once from the first coupon
// rather than per-coupon.
//
// onProgress (optional) is called repeatedly with { phase, done, total } for
// the "render" phase (one call per coupon, as its SVG/PNG is drawn) and
// { phase, percent } for the "zip" phase (JSZip's own compression progress) -
// a 5000-coupon batch takes long enough that a caller should show real
// feedback instead of a single indeterminate spinner.
export async function downloadCouponPrintAssets({ coupons = [], batchId = "", onProgress } = {}) {
  if (!coupons.length) return;

  const productName = sanitizeForFilename(coupons[0].productName) || "Coupon";
  const bucketSize = sanitizeForFilename(coupons[0].bucketSize);
  const rootName = `${productName}${bucketSize ? `-${bucketSize}-QR` : "QR"}`;
  const type = coupons[0].type;
  const backLabel = type === "GOLDEN" ? "Gold" : "Green";

  const zip = new JSZip();
  const root = zip.folder(rootName);
  const pngFolder = root.folder("PNG");
  const svgFolder = root.folder("SVG");
  const backFolder = root.folder("Back");

  const backSvgFilename = `${backLabel}-Back.svg`;
  const backPngFilename = `${backLabel}-Back.png`;
  backFolder.file(backSvgFilename, getCouponBackSvg(type));
  backFolder.file(backPngFilename, (await renderCouponBackPng(type)).replace(/^data:image\/png;base64,/, ""), {
    base64: true,
  });

  const manifestRows = [
    ["Coupon Code", "Type", "Points", "Cash Amount", "Expires At", "Front SVG File", "Front PNG File", "Back SVG File", "Back PNG File"],
  ];

  const total = coupons.length;
  let done = 0;
  for (const coupon of coupons) {
    const { svgString, pngDataUrl } = await renderCouponFrontPng({
      type: coupon.type,
      redeemUrl: coupon.redeemUrl,
      points: coupon.points,
    });
    const pngBase64 = pngDataUrl.replace(/^data:image\/png;base64,/, "");

    const svgFilename = `${coupon.couponCode}.svg`;
    const pngFilename = `${coupon.couponCode}.png`;

    svgFolder.file(svgFilename, svgString);
    pngFolder.file(pngFilename, pngBase64, { base64: true });

    manifestRows.push([
      coupon.couponCode,
      coupon.type,
      coupon.points,
      coupon.cashAmount,
      new Date(coupon.expiresAt).toISOString(),
      `SVG/${svgFilename}`,
      `PNG/${pngFilename}`,
      `Back/${backSvgFilename}`,
      `Back/${backPngFilename}`,
    ]);

    done += 1;
    onProgress?.({ phase: "render", done, total });
  }

  root.file("manifest.csv", manifestRows.map((row) => row.map(csvEscape).join(",")).join("\n"));

  const blob = await zip.generateAsync({ type: "blob" }, (metadata) => {
    onProgress?.({ phase: "zip", percent: Math.round(metadata.percent) });
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${rootName || `coupon-qr-assets-${batchId || Date.now()}`}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
