import QRCode from "qrcode";

// Both the admin's on-screen QR preview and the print-vendor export need
// the exact same "QR + points caption" composition, so it lives here once
// rather than being duplicated (and risking drifting apart) in both places.

const CAPTION_HEIGHT_RATIO = 0.18;
const CAPTION_FONT_RATIO = 0.08;
const CAPTION_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Renders a PNG data URL with the QR code on top and the points caption
// centered directly beneath it, on a plain white background.
export async function renderCouponQrPng(redeemUrl, captionText, { size = 600 } = {}) {
  const qrDataUrl = await QRCode.toDataURL(redeemUrl, { width: size, margin: 1 });
  const qrImage = await loadImage(qrDataUrl);

  const captionHeight = Math.round(size * CAPTION_HEIGHT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size + captionHeight;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrImage, 0, 0, size, size);

  ctx.fillStyle = "#1d1d1f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(size * CAPTION_FONT_RATIO)}px ${CAPTION_FONT_FAMILY}`;
  ctx.fillText(captionText, size / 2, size + captionHeight / 2);

  return canvas.toDataURL("image/png");
}

// Renders the same composition as an SVG string - re-embeds the QR-only
// SVG markup qrcode.js produces inside a taller viewBox with a <text>
// element below it, so print shops still get an infinitely-scalable vector
// asset rather than a rasterized caption.
//
// qrcode.js's SVG output uses its own small module-grid viewBox (e.g.
// "0 0 31 31" - one unit per QR module, independent of the requested pixel
// `width`), with that outer <svg>'s width/height + viewBox pair doing the
// scaling up to pixel size. Dropping the outer tag and keeping only the
// inner <path> loses that viewBox, so the module-grid coordinates end up
// interpreted directly against this function's pixel-scale canvas -
// rendering as a tiny QR stamped in the corner. Nesting the QR's inner
// content inside its own <svg width={size} height={size} viewBox="0 0 N N">
// preserves the same auto-scaling the original standalone QR SVG relied on.
export async function renderCouponQrSvg(redeemUrl, captionText, { size = 600 } = {}) {
  const qrSvg = await QRCode.toString(redeemUrl, { type: "svg", margin: 1, width: size });
  const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/i);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${size} ${size}`;
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const inner = innerMatch ? innerMatch[1] : qrSvg;

  const captionHeight = Math.round(size * CAPTION_HEIGHT_RATIO);
  const totalHeight = size + captionHeight;
  const fontSize = Math.round(size * CAPTION_FONT_RATIO);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalHeight}" viewBox="0 0 ${size} ${totalHeight}">
  <rect width="${size}" height="${totalHeight}" fill="#ffffff" />
  <svg x="0" y="0" width="${size}" height="${size}" viewBox="${qrViewBox}">${inner}</svg>
  <text x="${size / 2}" y="${size + captionHeight / 2}" text-anchor="middle" dominant-baseline="middle" font-family='${CAPTION_FONT_FAMILY}' font-weight="700" font-size="${fontSize}" fill="#1d1d1f">${captionText}</text>
</svg>`;
}
