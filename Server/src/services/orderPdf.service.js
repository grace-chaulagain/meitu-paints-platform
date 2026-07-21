import React from "react";
import { pdf } from "@react-pdf/renderer";
import OrderSummaryPdfDocument from "./pdf/orderSummaryPdfDocument.js";

// Renders the exact same Order Summary document the dealer downloads from
// their own order detail page (Frontend/meitupaints/src/utils/
// OrderSummaryPdfDocument.jsx, ported to ./pdf/orderSummaryPdfDocument.js
// since the server has no JSX transform) - this used to be a hand-rolled,
// no-library raw-PDF-byte generator with its own older design; replaced so
// the copy emailed to the factory at verification time is visually
// identical to what the dealer sees, not a second, drifted-apart design.
function filenameSafe(value) {
  return String(value || "order-summary")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// pdf(...).toBuffer() resolves to a Node ReadableStream despite the name
// (react-pdf's own API naming) - collect it into an actual Buffer.
async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function buildOrderSummaryPdfBuffer(order, dealer) {
  const instance = pdf(React.createElement(OrderSummaryPdfDocument, { order, dealer }));
  const stream = await instance.toBuffer();
  return streamToBuffer(stream);
}

export async function buildOrderSummaryPdfAttachment(order, dealer) {
  return {
    filename: `${filenameSafe(order?.orderNumber || "order-summary")}.pdf`,
    content: await buildOrderSummaryPdfBuffer(order, dealer),
    contentType: "application/pdf",
  };
}
