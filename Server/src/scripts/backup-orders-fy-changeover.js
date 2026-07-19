// Full backup of every Order document, organized per-dealer, before the
// fiscal-year order-history wipe (see delete-orders-fy-changeover.js).
// Read-only - never writes to the database. For each dealer with at least
// one order: writes a complete raw JSON export (every field, for exact
// restoration if ever needed) plus one human-readable invoice PDF per
// order (reusing the same generator the app's own "Invoice PDF" download
// button calls), plus a top-level summary across all dealers.
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Order from "../models/Order.model.js";
import { buildOrderSummaryPdfBuffer } from "../services/orderPdf.service.js";

function sanitizeFolderName(name) {
  return String(name || "Unknown Dealer")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "Unknown Dealer";
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGODB_URI);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const outRoot = path.join(
    process.env.HOME,
    "Desktop",
    `Meitu-Order-Backup-${dateStamp}`,
  );
  fs.mkdirSync(outRoot, { recursive: true });
  console.log(`Backup root: ${outRoot}`);

  const orders = await Order.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${orders.length} orders total.`);

  const byDealer = new Map();
  for (const order of orders) {
    const dealerName = order.dealerSnapshot?.companyName || "Unknown Dealer";
    const key = `${dealerName}__${order.dealerId || "none"}`;
    if (!byDealer.has(key)) byDealer.set(key, { dealerName, dealerId: order.dealerId, orders: [] });
    byDealer.get(key).orders.push(order);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalOrders: orders.length,
    totalDealers: byDealer.size,
    grandTotal: 0,
    byStatus: {},
    dealers: [],
  };

  let pdfCount = 0;
  let pdfFailures = [];

  for (const { dealerName, dealerId, orders: dealerOrders } of byDealer.values()) {
    const folderName = sanitizeFolderName(dealerName);
    const dealerDir = path.join(outRoot, folderName);
    fs.mkdirSync(dealerDir, { recursive: true });

    fs.writeFileSync(
      path.join(dealerDir, "orders.json"),
      JSON.stringify(dealerOrders, null, 2),
    );

    let dealerTotal = 0;
    for (const order of dealerOrders) {
      dealerTotal += Number(order.totals?.total || 0);
      summary.byStatus[order.status] = (summary.byStatus[order.status] || 0) + 1;
      summary.grandTotal += Number(order.totals?.total || 0);

      try {
        const pdfBuffer = buildOrderSummaryPdfBuffer(order);
        const pdfPath = path.join(dealerDir, `${order.orderNumber || order._id}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
        pdfCount += 1;
      } catch (err) {
        pdfFailures.push({ orderNumber: order.orderNumber, error: err.message });
      }
    }

    summary.dealers.push({
      dealerName,
      dealerId: dealerId ? String(dealerId) : null,
      orderCount: dealerOrders.length,
      total: dealerTotal,
      folder: folderName,
    });

    console.log(`  ${dealerName}: ${dealerOrders.length} orders, NPR ${dealerTotal.toLocaleString()} -> ${dealerDir}`);
  }

  summary.dealers.sort((a, b) => b.total - a.total);
  fs.writeFileSync(path.join(outRoot, "_SUMMARY.json"), JSON.stringify(summary, null, 2));

  console.log(`\n=== Backup complete ===`);
  console.log(`Total orders backed up: ${orders.length}`);
  console.log(`Total dealers: ${byDealer.size}`);
  console.log(`Total PDFs written: ${pdfCount}`);
  console.log(`Grand total (all orders): NPR ${summary.grandTotal.toLocaleString()}`);
  console.log(`By status:`, summary.byStatus);
  if (pdfFailures.length) {
    console.log(`\nPDF FAILURES (${pdfFailures.length}) - JSON backup still has these orders, but no PDF was generated:`);
    pdfFailures.forEach((f) => console.log(`  ${f.orderNumber}: ${f.error}`));
  }
  console.log(`\nSummary file: ${path.join(outRoot, "_SUMMARY.json")}`);

  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
