/**
 * Read-only diagnostic: finds trashed (isDeleted) orders whose stock
 * reservation was never released, and reports how much reserved quantity
 * each affected product is stranding as a result. Makes no writes.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/diagnose-stuck-reservations.js
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Order from "../models/Order.model.js";
import Product from "../models/Product.model.js";

await connectDB();

const stuckOrders = await Order.find({
  isDeleted: true,
  "stockReservation.status": "RESERVED",
})
  .select("_id orderNumber status stockReservation deletion")
  .lean();

console.log(`[diagnose] Found ${stuckOrders.length} deleted order(s) with an unreleased reservation`);

const byProduct = new Map();
for (const order of stuckOrders) {
  console.log(`  - ${order.orderNumber || order._id} (deleted ${order.deletion?.requestedAt || "?"})`);
  for (const item of order.stockReservation?.items || []) {
    const key = String(item.productId || item.sku);
    const entry = byProduct.get(key) || { name: item.name, sku: item.sku, strandedQuantity: 0, productId: item.productId };
    entry.strandedQuantity += Number(item.quantity || 0);
    byProduct.set(key, entry);
  }
}

console.log("\n[diagnose] Stranded reserved quantity by product:");
for (const entry of byProduct.values()) {
  const product = entry.productId ? await Product.findById(entry.productId).select("stock.reservedQuantity stock.currentQuantity").lean() : null;
  console.log(
    `  - ${entry.name || entry.sku}: stranded=${entry.strandedQuantity}` +
      (product ? ` (product currentReserved=${product.stock?.reservedQuantity ?? "?"}, currentQuantity=${product.stock?.currentQuantity ?? "?"})` : " (product not found)"),
  );
}

await mongoose.disconnect();
