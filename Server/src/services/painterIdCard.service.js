import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, PDFOperator, PDFOperatorNames, PDFNumber, rgb, breakTextIntoLines } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_SVG_PATH = path.join(__dirname, "../assets/painterIdCardTemplate.svg");
// The back of the card is identical for every painter - no photo, no
// variable fields - so it's just replayed once per PDF as a second,
// static page.
const BACK_TEMPLATE_SVG_PATH = path.join(__dirname, "../assets/painterIdCardBackTemplate.svg");
const FONT_PATH = path.join(__dirname, "../assets/fonts/Inter-SemiBold.ttf");

// The template's own coordinate space (its viewBox), and the physical page
// we render it onto: 85.6x53mm trim + 1.7mm bleed per side = 89x56.4mm,
// exactly as specified for the print vendor. The template's canvas ratio
// (1560:1000 = 1.56) doesn't exactly match the bleed-page ratio (1.578) -
// confirmed with the requester that the artwork should stretch non-uniformly
// (~1.1% on one axis, imperceptible) to fill the page edge-to-edge, rather
// than letterbox and leave an unprinted sliver at the trim edge.
const SVG_WIDTH = 1560;
const SVG_HEIGHT = 1000;
const MM_TO_PT = 2.834645669;
const PAGE_WIDTH_MM = 89;
const PAGE_HEIGHT_MM = 56.4;
const PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT;
const SCALE_X = PAGE_WIDTH_PT / SVG_WIDTH;
const SCALE_Y = PAGE_HEIGHT_PT / SVG_HEIGHT;

// Template redesign (2026-07-22): the designer replaced the old template
// with one where the 4 credential labels ("PAINTER ID", "NAME", "PHONE",
// "ISSUE DATE") share one aligned colon column, and the header caption
// ("Trained Painter / Granite Texture Paints Training Program") is now
// baked into the template art at its own final size - both are fixed
// vector artwork now, not something this file draws or resizes. The old
// gold certification badge that used to sit to the right of the values
// (and constrained their width to ~68pt) is gone too, replaced by a much
// larger, low-opacity watermark that values are free to run over (same as
// the header already does) since it reads fine under printed text.
//
// Value field positions, measured directly off the new template's own
// vector geometry via getBBox (the colon glyph ending each label row, all
// 4 now perfectly x-aligned at SVG x~716.8) rather than eyeballed. Re-read
// these off the template's own paths if it ever changes again - see this
// session's conversation notes for the getBBox measurement method.
const FIELD_X_SVG = 750;
const FIELD_BASELINE_SVG = {
  licenseId: 473,
  phone: 637,
  issueDate: 719,
};
// Right margin matches the template's own established content boundary
// (the footer rule spans SVG x 67-1493) rather than a badge or watermark
// edge, since neither constrains the value rows in this template - the
// watermark is faint enough to run text over, and the baked header sits
// entirely above y=417 (the value rows start at y>440), so it doesn't
// intrude either.
const VALUE_RIGHT_EDGE_SVG = 1493;
const VALUE_MAX_WIDTH_SVG = VALUE_RIGHT_EDGE_SVG - FIELD_X_SVG;
// 12pt (matching the cited "primary text" band in isolation) still read as
// oversized once printed next to the actual baked labels - the designer
// drew those at their own fixed size, not ours. Measured directly (getBBox
// cap-height of "PAINTER ID"/"NAME"/"PHONE"/"ISSUE DATE"'s own glyphs,
// averaged across all 4: 25.8 SVG units -> 4.13pt real cap-height) and
// solved for the Inter-SemiBold `size` that reproduces that same cap-height
// (font.heightAtSize(size)/size gives the font's own cap-height ratio,
// ~0.716 - matching cap-height, not nominal size, is what makes two
// different typefaces/tools look the same size side by side). That solves
// to ~5.76pt; 6pt is close enough to be visually identical and happens to
// land exactly on the cited "fine print >= 6pt" floor rather than under it.
const VALUE_FONT_SIZE_PT = 6;
const VALUE_MIN_FONT_SIZE_PT = 5;
const VALUE_COLOR = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255);

// The painter's name is still the one credential value with no fixed
// format - real names in the actual painter directory range from ~10 to 24
// characters, 2-3 words, median 15 (measured against the live painter
// collection). Matched to VALUE_FONT_SIZE_PT for the same label-matching
// reason - at 6pt against the ~120pt column even the longest real name
// fits on a single line, so the wrap/shrink machinery below is now a rare
// safety net rather than the common case it was before.
//
// The vertical budget (between license-ID's baseline, which has no
// descender, and phone's own ink-top) is effectively unchanged from before
// since the row baselines barely moved in the new template - computed at
// render time from the font's real heightAtSize metric (see the
// name-drawing block below), not a hand-measured guess.
const NAME_FONT_SIZE_PT = 6;
const NAME_MIN_FONT_SIZE_PT = 5;
const NAME_MAX_LINES = 3;
const NAME_LINE_GAP_RATIO = 0.2; // extra gap between baselines, as a fraction of font size

// The template's grey photo placeholder (the <rect fill="#D9D9D9" rx="22">
// in painterIdCardTemplate.svg) - a rounded rect whose exact bezier corners
// we reuse verbatim as a clip path when a photo is supplied, so the photo
// is trimmed to precisely the same shape the template already draws, never
// an approximation. The 2026-07-22 template redesign shifted this box left
// (x 98->69) at the same size (311x373, rx=22) - PHOTO_PLACEHOLDER_PATH_D
// below is the old path translated by that same (-29, +0.5) offset, not
// hand-drawn. If the template art ever changes again, re-read the rect's
// own x/y/width/height/rx rather than eyeballing new numbers.
const PHOTO_PLACEHOLDER_PATH_D =
  "M69 417.5C69 405.35 78.85 395.5 91 395.5H358C370.15 395.5 380 405.35 380 417.5V746.5C380 758.65 370.15 768.5 358 768.5H91C78.85 768.5 69 758.65 69 746.5V417.5Z";
const PHOTO_BBOX_SVG = { x: 69, y: 395.5, width: 311, height: 373 };

let cachedTemplate = null;
let cachedBackTemplate = null;
let cachedFontBytes = null;
let cachedRawSvg = null;

function hexToRgb(hex) {
  if (!hex || hex === "none") return null;
  if (hex === "white") return rgb(1, 1, 1);
  if (hex === "black") return rgb(0, 0, 0);
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// The back template has exactly one element with its own transform="matrix(...)"
// (the bottom red bar, a horizontal-flip-plus-translate) rather than the
// translate()-only transforms every <g> in this file otherwise uses. Only
// axis-aligned matrices (b=c=0, a pure horizontal/vertical flip+scale) are
// supported - sufficient for this one rect; a rotated/skewed matrix would
// need real bbox-corner math, which nothing in either template requires.
function parseMatrixTransform(transformAttr) {
  const m = /matrix\(\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(
    transformAttr || "",
  );
  if (!m) return null;
  const [a, b, c, d, e, f] = m.slice(1).map(Number);
  if (b !== 0 || c !== 0) {
    throw new Error(`Unsupported rotated/skewed matrix() transform: ${transformAttr}`);
  }
  return { a, b, c, d, e, f };
}

function applyMatrixToRectBBox(matrix, x, y, w, h) {
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => [matrix.a * px + matrix.c * py + matrix.e, matrix.b * px + matrix.d * py + matrix.f]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

// The template only ever uses absolute M/L/H/V/C/Z commands (verified
// against the actual file - no arcs, no relative commands, no shorthand
// curves), so this deliberately doesn't handle the rest of the SVG path
// grammar.
function parsePathCommands(d) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const argCounts = { M: 2, L: 2, H: 1, V: 1, C: 6 };
  const cmds = [];
  let i = 0;
  while (i < tokens.length) {
    const rawCmd = tokens[i];
    // Numeric tokens can themselves contain a lowercase "e" (scientific
    // notation), so only single-letter tokens are command letters.
    if (rawCmd.length === 1 && /[a-z]/.test(rawCmd)) {
      throw new Error(`Unsupported relative path command "${rawCmd}" in: ${d}`);
    }
    const cmd = rawCmd.toUpperCase();
    i += 1;
    if (cmd === "Z") {
      cmds.push({ cmd: "Z" });
      continue;
    }
    const n = argCounts[cmd];
    cmds.push({ cmd, args: tokens.slice(i, i + n).map(Number) });
    i += n;
  }
  return cmds;
}

// Converts one <path d="..."> into pdf-lib content-stream operators,
// applying the template's own (offsetX, offsetY) translate plus the global
// non-uniform page scale to every coordinate, and flipping Y (SVG is
// top-down, PDF is bottom-up).
function pathToOperators(d, offsetX, offsetY) {
  const toX = (x) => (x + offsetX) * SCALE_X;
  const toY = (y) => PAGE_HEIGHT_PT - (y + offsetY) * SCALE_Y;

  const ops = [];
  let curX = 0;
  let curY = 0;
  for (const { cmd, args } of parsePathCommands(d)) {
    if (cmd === "M" || cmd === "L") {
      [curX, curY] = args;
      const name = cmd === "M" ? PDFOperatorNames.MoveTo : PDFOperatorNames.LineTo;
      ops.push(PDFOperator.of(name, [PDFNumber.of(toX(curX)), PDFNumber.of(toY(curY))]));
    } else if (cmd === "H") {
      curX = args[0];
      ops.push(PDFOperator.of(PDFOperatorNames.LineTo, [PDFNumber.of(toX(curX)), PDFNumber.of(toY(curY))]));
    } else if (cmd === "V") {
      curY = args[0];
      ops.push(PDFOperator.of(PDFOperatorNames.LineTo, [PDFNumber.of(toX(curX)), PDFNumber.of(toY(curY))]));
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = args;
      ops.push(
        PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
          PDFNumber.of(toX(x1)),
          PDFNumber.of(toY(y1)),
          PDFNumber.of(toX(x2)),
          PDFNumber.of(toY(y2)),
          PDFNumber.of(toX(x)),
          PDFNumber.of(toY(y)),
        ]),
      );
      curX = x;
      curY = y;
    } else if (cmd === "Z") {
      ops.push(PDFOperator.of(PDFOperatorNames.ClosePath));
    }
  }
  return ops;
}

// pdf-lib's high-level page.drawSvgPath() always fills nonzero and only
// supports a single uniform scale - this file needs even-odd fill (the
// logo mark's negative-space loops rely on it) and independent x/y scale,
// so shapes are drawn via raw content-stream operators instead.
function drawTemplatePath(page, d, { offsetX = 0, offsetY = 0, fill, fillRule, opacity = 1 }) {
  const contentStream = page.getContentStream();
  const ops = [PDFOperator.of(PDFOperatorNames.PushGraphicsState)];
  if (opacity < 1) {
    const gsKey = page.maybeEmbedGraphicsState({ opacity });
    if (gsKey) ops.push(PDFOperator.of(PDFOperatorNames.SetGraphicsStateParams, [gsKey]));
  }
  ops.push(...pathToOperators(d, offsetX, offsetY));
  ops.push(
    PDFOperator.of(PDFOperatorNames.NonStrokingColorRgb, [
      PDFNumber.of(fill.red),
      PDFNumber.of(fill.green),
      PDFNumber.of(fill.blue),
    ]),
  );
  ops.push(PDFOperator.of(fillRule === "evenodd" ? PDFOperatorNames.FillEvenOdd : PDFOperatorNames.FillNonZero));
  ops.push(PDFOperator.of(PDFOperatorNames.PopGraphicsState));
  contentStream.push(...ops);
}

// The back template's one decorative flourish (a squiggle near the bottom)
// is stroke-only - no fill attribute at all - unlike every other path in
// either template. Mirrors drawTemplatePath's raw-operator approach, just
// with stroke color/width/S instead of fill color/rule.
function strokeTemplatePath(page, d, { offsetX = 0, offsetY = 0, stroke, strokeWidth = 1, opacity = 1 }) {
  const contentStream = page.getContentStream();
  const ops = [PDFOperator.of(PDFOperatorNames.PushGraphicsState)];
  if (opacity < 1) {
    // StrokePath ("S") is governed by the ExtGState's CA (stroking alpha),
    // not ca (nonstroking/fill alpha) - pdf-lib's maybeEmbedGraphicsState
    // maps its `opacity` option to ca and `borderOpacity` to CA, so a
    // stroke-only draw must pass borderOpacity or the alpha is silently
    // dropped (CA stays unset -> full opacity) even though a real ExtGState
    // gets embedded.
    const gsKey = page.maybeEmbedGraphicsState({ borderOpacity: opacity });
    if (gsKey) ops.push(PDFOperator.of(PDFOperatorNames.SetGraphicsStateParams, [gsKey]));
  }
  ops.push(...pathToOperators(d, offsetX, offsetY));
  ops.push(
    PDFOperator.of(PDFOperatorNames.StrokingColorRgb, [
      PDFNumber.of(stroke.red),
      PDFNumber.of(stroke.green),
      PDFNumber.of(stroke.blue),
    ]),
  );
  ops.push(PDFOperator.of(PDFOperatorNames.SetLineWidth, [PDFNumber.of(strokeWidth * ((SCALE_X + SCALE_Y) / 2))]));
  ops.push(PDFOperator.of(PDFOperatorNames.StrokePath));
  ops.push(PDFOperator.of(PDFOperatorNames.PopGraphicsState));
  contentStream.push(...ops);
}

// Draws an embedded raster image clipped to the template's own photo
// placeholder shape (PHOTO_PLACEHOLDER_PATH_D), so the photo's corners are
// trimmed to exactly the same rounding the template already draws - not a
// CSS-style approximation. The frontend pre-crops to the placeholder's
// exact aspect ratio before upload, so this is a plain stretch-to-fill of
// the bounding box (equivalent to "cover" with zero leftover, since the
// source aspect already matches).
function drawClippedImage(page, pdfImage, bbox) {
  const contentStream = page.getContentStream();
  contentStream.push(PDFOperator.of(PDFOperatorNames.PushGraphicsState));
  contentStream.push(...pathToOperators(PHOTO_PLACEHOLDER_PATH_D, 0, 0));
  contentStream.push(PDFOperator.of(PDFOperatorNames.ClipNonZero));
  contentStream.push(PDFOperator.of(PDFOperatorNames.EndPath));

  page.drawImage(pdfImage, {
    x: bbox.x * SCALE_X,
    y: PAGE_HEIGHT_PT - (bbox.y + bbox.height) * SCALE_Y,
    width: bbox.width * SCALE_X,
    height: bbox.height * SCALE_Y,
  });

  contentStream.push(PDFOperator.of(PDFOperatorNames.PopGraphicsState));
}

function tagOf(node) {
  return Object.keys(node).find((key) => key !== ":@");
}

function childrenOf(node) {
  return node[tagOf(node)];
}

// Draws every rect/path/line in the template, in document order, tracking
// the two things this specific file's <g> elements ever carry: an opacity
// multiplier and a translate() offset. clip-path is deliberately not
// applied - every clipPath in this template is a rect sized to exactly
// match its content's own bounding box (verified directly against the
// file), so clipping is a no-op here; it's not general clip-path support.
function drawTemplate(page, nodes, ctx) {
  for (const node of nodes) {
    const tag = tagOf(node);
    const attrs = node[":@"] || {};

    if (tag === "rect") {
      const fill = hexToRgb(attrs.fill);
      if (!fill) continue;
      const matrix = parseMatrixTransform(attrs.transform);
      // A rect can carry its own transform="translate(x y)" directly
      // (distinct from an ancestor <g>'s translate, already handled via
      // ctx.offsetX/offsetY) - e.g. the front/back templates' top-level
      // opacity overlay rects. Both templates' only currently-rendered
      // instance of this happens to be a white rect on a white canvas, so
      // getting this wrong was visually silent - but it's still wrong.
      const rectTranslate = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(attrs.transform || "");
      let x, y, w, h;
      if (matrix) {
        const box = applyMatrixToRectBBox(matrix, Number(attrs.x || 0), Number(attrs.y || 0), Number(attrs.width), Number(attrs.height));
        x = box.x + ctx.offsetX;
        y = box.y + ctx.offsetY;
        w = box.width;
        h = box.height;
      } else {
        const ownOffsetX = rectTranslate ? Number(rectTranslate[1]) : 0;
        const ownOffsetY = rectTranslate ? Number(rectTranslate[2]) : 0;
        x = Number(attrs.x || 0) + ownOffsetX + ctx.offsetX;
        y = Number(attrs.y || 0) + ownOffsetY + ctx.offsetY;
        w = Number(attrs.width);
        h = Number(attrs.height);
      }
      page.drawRectangle({
        x: x * SCALE_X,
        y: PAGE_HEIGHT_PT - (y + h) * SCALE_Y,
        width: w * SCALE_X,
        height: h * SCALE_Y,
        color: fill,
        opacity: ctx.opacity,
      });
    } else if (tag === "line") {
      page.drawLine({
        start: {
          x: (Number(attrs.x1) + ctx.offsetX) * SCALE_X,
          y: PAGE_HEIGHT_PT - (Number(attrs.y1) + ctx.offsetY) * SCALE_Y,
        },
        end: {
          x: (Number(attrs.x2) + ctx.offsetX) * SCALE_X,
          y: PAGE_HEIGHT_PT - (Number(attrs.y2) + ctx.offsetY) * SCALE_Y,
        },
        thickness: Number(attrs["stroke-width"] || 1) * ((SCALE_X + SCALE_Y) / 2),
        color: hexToRgb(attrs.stroke) || rgb(0, 0, 0),
        opacity: ctx.opacity,
      });
    } else if (tag === "path") {
      const fill = hexToRgb(attrs.fill);
      const stroke = hexToRgb(attrs.stroke);
      if (fill && stroke && attrs.d) {
        // Only one of fill/stroke is ever rendered below - a path needing
        // both would silently lose one. Neither template currently has
        // this, so fail loudly instead of dropping a render pass.
        throw new Error(`Path with both fill and stroke is not supported: ${attrs.d.slice(0, 40)}...`);
      }
      if (fill && attrs.d) {
        drawTemplatePath(page, attrs.d, {
          offsetX: ctx.offsetX,
          offsetY: ctx.offsetY,
          fill,
          fillRule: attrs["fill-rule"],
          opacity: ctx.opacity,
        });
      } else if (stroke && attrs.d) {
        const strokeOpacity = attrs["stroke-opacity"] !== undefined ? ctx.opacity * Number(attrs["stroke-opacity"]) : ctx.opacity;
        strokeTemplatePath(page, attrs.d, {
          offsetX: ctx.offsetX,
          offsetY: ctx.offsetY,
          stroke,
          strokeWidth: Number(attrs["stroke-width"] || 1),
          opacity: strokeOpacity,
        });
      }
    } else if (tag === "g") {
      const nextOpacity = attrs.opacity !== undefined ? ctx.opacity * Number(attrs.opacity) : ctx.opacity;
      let nextOffsetX = ctx.offsetX;
      let nextOffsetY = ctx.offsetY;
      const translateMatch = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(attrs.transform || "");
      if (translateMatch) {
        nextOffsetX += Number(translateMatch[1]);
        nextOffsetY += Number(translateMatch[2]);
      }
      drawTemplate(page, childrenOf(node), { offsetX: nextOffsetX, offsetY: nextOffsetY, opacity: nextOpacity });
    }
    // rect/path/line with no recognized fill, and <defs> (clipPath
    // definitions only, never rendered directly), are silently skipped.
  }
}

function parseSvgFile(svgPath) {
  const svgXml = fs.readFileSync(svgPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", preserveOrder: true });
  const parsed = parser.parse(svgXml);
  const svgRoot = parsed.find((node) => tagOf(node) === "svg");
  return childrenOf(svgRoot);
}

function loadTemplate() {
  if (!cachedTemplate) cachedTemplate = parseSvgFile(TEMPLATE_SVG_PATH);
  return cachedTemplate;
}

function loadBackTemplate() {
  if (!cachedBackTemplate) cachedBackTemplate = parseSvgFile(BACK_TEMPLATE_SVG_PATH);
  return cachedBackTemplate;
}

function loadFontBytes() {
  if (!cachedFontBytes) cachedFontBytes = fs.readFileSync(FONT_PATH);
  return cachedFontBytes;
}

// Serves the exact same source file drawTemplate() replays, so the admin's
// photo-adjustment preview (AdminPainterProfilePage's crop modal) is backed
// by the real design, not a hand-recreated approximation - it just never
// needs the parsed/preserveOrder form loadTemplate() produces.
export function getIdCardTemplateSvgRaw() {
  if (!cachedRawSvg) cachedRawSvg = fs.readFileSync(TEMPLATE_SVG_PATH, "utf8");
  return cachedRawSvg;
}

// Shrinks a single line's font size only if it would otherwise overrun its
// column width at the base size (a genuinely long name/phone, or a
// template copy change), floored at minSize so it degrades gracefully
// instead of disappearing back toward the old unreadable size. Text that
// already fits at baseSize is returned unchanged. Used for both the 4
// credential values and the 3 header caption lines - real Inter-SemiBold
// metrics via fontkit, not an estimate, so this is correct regardless of
// how the hand-measured baseline/column constants above were derived.
function fitFontSize(font, text, baseSize, maxWidthPt, minSize) {
  if (font.widthOfTextAtSize(text, baseSize) <= maxWidthPt) return baseSize;
  for (let size = baseSize - 0.5; size >= minSize; size -= 0.5) {
    if (font.widthOfTextAtSize(text, size) <= maxWidthPt) return size;
  }
  return minSize;
}

// Finds the largest font size (base down to minSize, in 0.5pt steps) at
// which `text` both word-wraps into at most maxLines within maxWidthPt,
// AND the resulting block of lines - using the font's own real cap-height
// metric plus a proportional gap, not an assumed ratio - fits within
// verticalBudgetPt with real breathing room (NAME_MIN_CLEARANCE_PT), not
// just mathematically without literal overlap. A fit that only clears the
// neighboring row by a few tenths of a point is invisible at print
// resolution and reads as touching/crowded - caught via a debug render
// during this template's rollout where a 24-character name's second line
// sat 0.29pt above the phone row, indistinguishable from touching once
// printed. Search runs largest-first so the first size that satisfies all
// three constraints is already the best available; if nothing does even at
// minSize, falls back to minSize's own wrap (however many lines that
// takes) rather than throwing - the same graceful-degradation choice
// fitFontSize() makes for the other fields.
// Returns { fontSize, lines, lineGapPt }.
const NAME_MIN_CLEARANCE_PT = 2;
function layoutWrappedName(font, text, { baseSize, minSize, maxWidthPt, maxLines, verticalBudgetPt }) {
  let fallback = null;
  for (let size = baseSize; size >= minSize; size -= 0.5) {
    const lines = breakTextIntoLines(text, [" "], maxWidthPt, (t) => font.widthOfTextAtSize(t, size)).map((line) =>
      line.trim(),
    );
    const capHeight = font.heightAtSize(size, { descender: false });
    const lineGapPt = size * NAME_LINE_GAP_RATIO;
    const blockHeight = lines.length * capHeight + Math.max(0, lines.length - 1) * lineGapPt;
    const result = { fontSize: size, lines, lineGapPt };
    fallback = result; // last-written (smallest size tried) wins if the loop never satisfies both constraints
    if (lines.length <= maxLines && blockHeight <= verticalBudgetPt - NAME_MIN_CLEARANCE_PT) return result;
  }
  return fallback;
}

function formatIssueDate(value) {
  const date = value ? new Date(value) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${day} ${month} ${date.getFullYear()}`;
}

// Generates one Trained Painter ID card PDF, at the exact 89x56.4mm bleed
// size the print vendor needs, with the 4 variable fields (Painter ID,
// Name, Phone, Issue Date) drawn in Inter SemiBold on top of the
// company-designed template - the template artwork itself is never
// redrawn, rasterized, or otherwise modified, only read and replayed as
// vector operators. photoBuffer/photoMimeType are optional (the automatic
// promotion-time call never supplies one, since no photo is ever stored on
// the painter - see painter.service.js:regeneratePainterIdCardWithPhoto);
// when present it's drawn over the template's grey placeholder, clipped to
// that placeholder's exact shape.
export async function generatePainterIdCardPdf({ licenseId, name, phone, issueDate, photoBuffer, photoMimeType } = {}) {
  const templateNodes = loadTemplate();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);

  drawTemplate(page, templateNodes, { offsetX: 0, offsetY: 0, opacity: 1 });

  if (photoBuffer) {
    const pdfImage = photoMimeType === "image/png" ? await pdfDoc.embedPng(photoBuffer) : await pdfDoc.embedJpg(photoBuffer);
    drawClippedImage(page, pdfImage, PHOTO_BBOX_SVG);
  }

  const font = await pdfDoc.embedFont(loadFontBytes(), { subset: true });

  const fieldValues = {
    licenseId: String(licenseId || "").trim(),
    name: String(name || "").trim().toUpperCase(),
    phone: String(phone || "").trim(),
    issueDate: formatIssueDate(issueDate),
  };
  const valueMaxWidthPt = VALUE_MAX_WIDTH_SVG * SCALE_X;

  for (const [field, baselineSvgY] of Object.entries(FIELD_BASELINE_SVG)) {
    const text = fieldValues[field];
    if (!text) continue;
    page.drawText(text, {
      x: FIELD_X_SVG * SCALE_X,
      y: PAGE_HEIGHT_PT - baselineSvgY * SCALE_Y,
      size: fitFontSize(font, text, VALUE_FONT_SIZE_PT, valueMaxWidthPt, VALUE_MIN_FONT_SIZE_PT),
      font,
      color: VALUE_COLOR,
    });
  }

  if (fieldValues.name) {
    // License-ID's baseline (its ink ends exactly there, no descender) down
    // to phone's own ink-top (phone's baseline plus its cap-height, since
    // phone always renders at the fixed VALUE_FONT_SIZE_PT - confirmed
    // earlier it never needs to shrink) is the real usable vertical budget
    // for name's wrapped lines - not the raw baseline-to-baseline gap.
    const licenseIdBaselinePt = PAGE_HEIGHT_PT - FIELD_BASELINE_SVG.licenseId * SCALE_Y;
    const phoneBaselinePt = PAGE_HEIGHT_PT - FIELD_BASELINE_SVG.phone * SCALE_Y;
    const phoneCapHeightPt = font.heightAtSize(VALUE_FONT_SIZE_PT, { descender: false });
    const nameRangeBottomPt = phoneBaselinePt + phoneCapHeightPt;
    const nameVerticalBudgetPt = licenseIdBaselinePt - nameRangeBottomPt;

    const { fontSize, lines, lineGapPt } = layoutWrappedName(font, fieldValues.name, {
      baseSize: NAME_FONT_SIZE_PT,
      minSize: NAME_MIN_FONT_SIZE_PT,
      maxWidthPt: valueMaxWidthPt,
      maxLines: NAME_MAX_LINES,
      verticalBudgetPt: nameVerticalBudgetPt,
    });

    const capHeightPt = font.heightAtSize(fontSize, { descender: false });
    const baselineStepPt = capHeightPt + lineGapPt;
    const blockHeightPt = lines.length * capHeightPt + Math.max(0, lines.length - 1) * lineGapPt;
    const blockTopPt = licenseIdBaselinePt - (nameVerticalBudgetPt - blockHeightPt) / 2;
    let lineY = blockTopPt - capHeightPt;

    for (const line of lines) {
      page.drawText(line, { x: FIELD_X_SVG * SCALE_X, y: lineY, size: fontSize, font, color: VALUE_COLOR });
      lineY -= baselineStepPt;
    }
  }

  // Page 2: the card back, identical for every painter - no photo, no
  // variable fields, just the template replayed as-is.
  const backPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  drawTemplate(backPage, loadBackTemplate(), { offsetX: 0, offsetY: 0, opacity: 1 });

  return Buffer.from(await pdfDoc.save());
}
