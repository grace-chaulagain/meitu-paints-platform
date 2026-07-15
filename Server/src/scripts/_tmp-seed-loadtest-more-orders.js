/**
 * Bulk-adds ~90-110 more dummy orders per LOADTEST-* dealer (continuing the
 * LOADTEST-ORD- numbering sequence), so the fleet has enough order volume
 * to stress-test list pagination, filters, and reporting at real scale -
 * on top of the original ~2-4/dealer seed. Same weighted status funnel as
 * the original seed (SUBMITTED/VERIFIED/REJECTED/DISPATCHED/COMPLETED) so
 * the admin review queue stays realistically mixed even at this volume.
 *
 * Run `_tmp-seed-loadtest-purchases-sales.js` afterwards to promote the
 * newly-eligible orders to COMPLETED and generate matching dealer
 * purchase/sales history for them.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/_tmp-seed-loadtest-more-orders.js
 *   ... --dry-run
 *   ... --per-dealer=100
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { MONGO_URI } from "../config/env.js";
import Order, { ORDER_STATUS } from "../models/Order.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import User from "../models/User.model.js";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");
const PER_DEALER = (() => {
  const arg = process.argv.find((item) => item.startsWith("--per-dealer="));
  const value = Number(arg?.split("=")?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : 100;
})();
const DEALER_CONCURRENCY = 12;

const STATUS_WEIGHTS = [
  [ORDER_STATUS.SUBMITTED, 0.34],
  [ORDER_STATUS.VERIFIED, 0.43],
  [ORDER_STATUS.REJECTED, 0.15],
  [ORDER_STATUS.DISPATCHED, 0.04],
  [ORDER_STATUS.COMPLETED, 0.04],
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedStatus() {
  const roll = Math.random();
  let cumulative = 0;
  for (const [status, weight] of STATUS_WEIGHTS) {
    cumulative += weight;
    if (roll <= cumulative) return status;
  }
  return STATUS_WEIGHTS[STATUS_WEIGHTS.length - 1][0];
}

function randomBackdate(daysBack = 90) {
  const now = Date.now();
  const past = now - randomInt(0, daysBack) * 24 * 60 * 60 * 1000 - randomInt(0, 86400000);
  return new Date(past);
}

function buildItems(products) {
  const count = randomInt(1, 4);
  const chosen = new Set();
  const items = [];
  while (chosen.size < count && chosen.size < products.length) {
    const product = pick(products);
    if (chosen.has(product._id.toString())) continue;
    chosen.add(product._id.toString());
    const quantity = randomInt(5, 50);
    const unitPrice = Number(product.pricing?.tiers?.[0]?.pricePerPack || product.basePrice || 0) || 1000;
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    items.push({
      productId: product._id,
      sku: product.sku || "",
      code: product.code || "",
      name: product.name || "",
      category: product.category || "",
      packLabel: product.pack?.label || "",
      quantity,
      unit: product.uom?.base || "",
      unitPrice,
      lineTotal,
    });
  }
  return items;
}

function buildOrder({ seq, dealer, dispatcher, userId, products }) {
  const items = buildItems(products);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const status = weightedStatus();
  const createdAt = randomBackdate(90);

  const order = {
    orderNumber: `LOADTEST-ORD-${String(seq).padStart(6, "0")}`,
    orderOrigin: "DEALER",
    dealerId: dealer._id,
    dealerSnapshot: {
      companyName: dealer.companyName || "",
      contactName: dealer.contactName || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address: dealer.address || "",
      panVat: dealer.panVat || "",
      fulfillmentMode: dealer.fulfillmentMode || "FACTORY",
    },
    dispatcherId: dealer.fulfillmentMode === "DISPATCHER" ? dealer.dispatcherId : null,
    dispatcherSnapshot:
      dealer.fulfillmentMode === "DISPATCHER" && dispatcher
        ? {
            name: dispatcher.name || "",
            companyName: dispatcher.companyName || "",
            email: dispatcher.email || "",
            phone: dispatcher.phone || "",
          }
        : undefined,
    items,
    totals: {
      subtotal,
      discount: 0,
      taxableAmount: subtotal,
      tax: 0,
      total: subtotal,
      currency: "NPR",
    },
    status,
    submittedByUserId: userId,
    createdAt,
    statusHistory: [
      {
        fromStatus: "",
        toStatus: ORDER_STATUS.SUBMITTED,
        note: "LOADTEST seed",
        changedByRole: "SYSTEM_SEED",
        changedAt: createdAt,
      },
    ],
  };

  if (status !== ORDER_STATUS.SUBMITTED) {
    order.statusHistory.push({
      fromStatus: ORDER_STATUS.SUBMITTED,
      toStatus: status,
      note: "LOADTEST seed",
      changedByRole: "SYSTEM_SEED",
      changedAt: createdAt,
    });
  }

  return order;
}

async function processDealer({ dealer, seqStart, dispatcherById, userIdByDealer, products }) {
  const userId = userIdByDealer.get(String(dealer._id));
  if (!userId) return { created: 0, skipped: PER_DEALER, reason: "no-linked-user" };

  const dispatcher = dealer.dispatcherId ? dispatcherById.get(String(dealer.dispatcherId)) : null;
  const count = randomInt(Math.max(1, PER_DEALER - 10), PER_DEALER + 10);

  const docs = [];
  for (let i = 0; i < count; i += 1) {
    docs.push(buildOrder({ seq: seqStart + i, dealer, dispatcher, userId, products }));
  }

  if (DRY_RUN) return { created: docs.length, skipped: 0 };

  await Order.create(docs);
  return { created: docs.length, skipped: 0 };
}

async function main() {
  assertSafeDatabaseWrite({ mongoUri: MONGO_URI, operation: "seed additional LOADTEST orders" });
  console.log(`[db-write] ${describeDatabaseTarget(MONGO_URI)} dryRun=${DRY_RUN} perDealer=${PER_DEALER}`);

  await connectDB();

  const [dealers, dispatchers, users, products, maxOrder] = await Promise.all([
    DealerProfile.find({ email: /^loadtest-dealer-/ }).lean(),
    Dispatcher.find({ email: /^loadtest-dispatcher-/ }).lean(),
    User.find({ dealerId: { $ne: null } }).select("_id dealerId").lean(),
    Product.find({ isActive: true }).select("name sku code category pack pricing uom basePrice").lean(),
    Order.findOne({ orderNumber: /^LOADTEST-ORD-/ }).sort({ orderNumber: -1 }).select("orderNumber").lean(),
  ]);

  console.log(
    `[seed-loadtest-more-orders] dealers=${dealers.length} dispatchers=${dispatchers.length} products=${products.length}`,
  );

  const dispatcherById = new Map(dispatchers.map((dispatcher) => [String(dispatcher._id), dispatcher]));
  const userIdByDealer = new Map(users.map((user) => [String(user.dealerId), user._id]));

  const lastSeq = Number(maxOrder?.orderNumber?.split("-").pop() || 0);
  let nextSeq = lastSeq + 1;

  let totalCreated = 0;
  let totalSkipped = 0;
  let dealersProcessed = 0;

  for (let i = 0; i < dealers.length; i += DEALER_CONCURRENCY) {
    const chunk = dealers.slice(i, i + DEALER_CONCURRENCY);
    const seqStarts = [];
    for (const dealer of chunk) {
      seqStarts.push(nextSeq);
      nextSeq += PER_DEALER + 10; // reserve enough headroom for the +/-10 jitter
    }

    const results = await Promise.all(
      chunk.map((dealer, index) =>
        processDealer({
          dealer,
          seqStart: seqStarts[index],
          dispatcherById,
          userIdByDealer,
          products,
        }).catch((error) => {
          console.error(`[seed-loadtest-more-orders] Failed for dealer ${dealer.email}:`, error?.message || error);
          return { created: 0, skipped: PER_DEALER, reason: "error" };
        }),
      ),
    );

    for (const result of results) {
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    dealersProcessed += chunk.length;
    console.log(
      `[seed-loadtest-more-orders] Progress: ${dealersProcessed}/${dealers.length} dealers, ${totalCreated} orders created so far`,
    );
  }

  console.log(
    `[seed-loadtest-more-orders] Done. dealers=${dealers.length} ordersCreated=${totalCreated} skipped=${totalSkipped}`,
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed-loadtest-more-orders] Failed:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
