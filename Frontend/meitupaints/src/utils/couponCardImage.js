import QRCode from "qrcode";
import goldFrontSvg from "../assets/coupons/gold-front.svg?raw";
import greenFrontSvg from "../assets/coupons/green-front.svg?raw";
import goldBackSvg from "../assets/coupons/gold-back.svg?raw";
import greenBackSvg from "../assets/coupons/green-back.svg?raw";

// Print-ready coupon cards: the QR code and points value get composited
// directly onto the real Gold/Green card artwork (bleed-accurate
// 56.496x90.736mm at 660x1060px, ~297 DPI) instead of a bare QR on a plain
// background - the template already carries all branding/copy/geometry.
// Backs carry no per-coupon data (verified against the source templates -
// no placeholder rect), so they're exported once per batch, not per coupon.

const CARD_WIDTH = 660;
const CARD_HEIGHT = 1060;

// Coordinates read directly off the front templates (identical between
// Gold and Green - only the gradient/title paths differ) and confirmed via
// rendered screenshot.
const QR_SIZE = 340;
const QR_X = (138 + (385 - QR_SIZE) / 2).toFixed(2); // centers inside the white rounded square at (138,210) 385x384
const QR_Y = (210 + (384 - QR_SIZE) / 2).toFixed(2);
const POINTS_TEXT_X = 378; // right-aligned, ends just left of the "POINTS" wordmark (which starts at x=390.79)
const POINTS_TEXT_Y = 856; // shares the "POINTS" wordmark's baseline
const POINTS_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const POINTS_FONT_SIZE = 52;

function frontTemplateFor(type) {
  return type === "GOLDEN" ? goldFrontSvg : greenFrontSvg;
}

function backTemplateFor(type) {
  return type === "GOLDEN" ? goldBackSvg : greenBackSvg;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Rasterizes any self-contained SVG string (no external references, so this
// never taints the canvas) to a PNG data URL at the given pixel size.
async function rasterizeSvg(svgString, width, height) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// qrcode.js's SVG output uses its own small module-grid viewBox (e.g.
// "0 0 31 31" - one unit per QR module, independent of the requested pixel
// `width`), with that outer <svg>'s width/height + viewBox pair doing the
// scaling up to pixel size. Dropping the outer tag and keeping only the
// inner <path> loses that viewBox, so the module-grid coordinates end up
// interpreted directly against the card's own 660x1060 canvas - rendering as
// a tiny QR stamped in the corner. Nesting the QR's inner content inside its
// own <svg x y width height viewBox="0 0 N N"> at the exact card slot
// preserves the same auto-scaling the standalone QR SVG relied on.
async function qrCodeMarkup(redeemUrl) {
  const qrSvg = await QRCode.toString(redeemUrl, { type: "svg", margin: 1, width: QR_SIZE });
  const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/i);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${QR_SIZE} ${QR_SIZE}`;
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const inner = innerMatch ? innerMatch[1] : qrSvg;
  return `<svg x="${QR_X}" y="${QR_Y}" width="${QR_SIZE}" height="${QR_SIZE}" viewBox="${qrViewBox}">${inner}</svg>`;
}

// Composites the live QR + points value onto the Gold/Green front template.
export async function renderCouponFrontSvg({ type, redeemUrl, points }) {
  const template = frontTemplateFor(type);
  const qrMarkup = await qrCodeMarkup(redeemUrl);
  const pointsMarkup = `<text x="${POINTS_TEXT_X}" y="${POINTS_TEXT_Y}" text-anchor="end" font-family='${POINTS_FONT_FAMILY}' font-weight="800" font-size="${POINTS_FONT_SIZE}" fill="white">${points}</text>`;
  return template.replace("</svg>", `${qrMarkup}${pointsMarkup}</svg>`);
}

export async function renderCouponFrontPng({ type, redeemUrl, points, scale = 2 } = {}) {
  const svgString = await renderCouponFrontSvg({ type, redeemUrl, points });
  const pngDataUrl = await rasterizeSvg(svgString, CARD_WIDTH * scale, CARD_HEIGHT * scale);
  return { svgString, pngDataUrl };
}

// Backs are static per coupon type - no QR, no per-coupon data.
export function getCouponBackSvg(type) {
  return backTemplateFor(type);
}

export async function renderCouponBackPng(type, { scale = 2 } = {}) {
  const svgString = backTemplateFor(type);
  return rasterizeSvg(svgString, CARD_WIDTH * scale, CARD_HEIGHT * scale);
}
