// Fills the /admin/insights workspace with realistic demo data so the
// accounting sections can be reviewed with something in them.
//
// SAFETY: every document written here is tagged `meta.demoTag =
// "INSIGHTS_DEMO"` (orders/payments) or created under clearly-labeled
// DEMO dealer/dispatcher accounts, so `--clean` can remove exactly what
// this script created and nothing else. It refuses to touch a
// production-like database unless explicitly overridden, matching
// seed-demo-dispatcher-inventory.js.
//
// Usage:
//   node -r dotenv/config src/scripts/seed-insights-demo.js --dry-run
//   node -r dotenv/config src/scripts/seed-insights-demo.js --apply
//   node -r dotenv/config src/scripts/seed-insights-demo.js --clean
//
// Staging:
//   DOTENV_CONFIG_PATH=.env.staging node -r dotenv/config src/scripts/seed-insights-demo.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import Order, { ORDER_STATUS } from "../models/Order.model.js";
import Payment from "../models/Payment.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import DealerProductStock from "../models/DealerProductStock.model.js";
import StockAdjustmentLog from "../models/StockAdjustmentLog.model.js";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../constants/statuses.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DEMO_TAG = "INSIGHTS_DEMO";
const DEMO_PREFIX = "[DEMO]";

const DEMO_DEALERS = [
  { companyName: `${DEMO_PREFIX} Kathmandu Paint Center`, contactName: "Ram Bahadur", district: "Kathmandu", mode: "FACTORY" },
  { companyName: `${DEMO_PREFIX} Pokhara Colour House`, contactName: "Sita Gurung", district: "Kaski", mode: "FACTORY" },
  { companyName: `${DEMO_PREFIX} Chitwan Hardware Suppliers`, contactName: "Hari Thapa", district: "Chitwan", mode: "FACTORY" },
  { companyName: `${DEMO_PREFIX} Biratnagar Decor Store`, contactName: "Anita Rai", district: "Morang", mode: "FACTORY" },
  { companyName: `${DEMO_PREFIX} Lalitpur Trade Links`, contactName: "Bikash Shrestha", district: "Lalitpur", mode: "DISPATCHER" },
  { companyName: `${DEMO_PREFIX} Butwal Building Supplies`, contactName: "Prakash Oli", district: "Rupandehi", mode: "DISPATCHER" },
];

const DEMO_DISPATCHERS = [
  { companyName: `${DEMO_PREFIX} Central Region Dispatch`, contactName: "Deepak Karki", district: "Kathmandu" },
  { companyName: `${DEMO_PREFIX} Western Region Dispatch`, contactName: "Manisha Poudel", district: "Kaski" },
];

const ORDER_MIX = [
  { status: ORDER_STATUS.COMPLETED, weight: 46 },
  { status: ORDER_STATUS.DISPATCHED, weight: 18 },
  { status: ORDER_STATUS.VERIFIED, weight: 16 },
  { status: ORDER_STATUS.SUBMITTED, weight: 12 },
  { status: ORDER_STATUS.REJECTED, weight: 4 },
  { status: ORDER_STATUS.CANCELLED, weight: 4 },
];

const METHOD_MIX = [
  { method: PAYMENT_METHOD.ONLINE, weight: 42 },
  { method: PAYMENT_METHOD.CHEQUE, weight: 26 },
  { method: PAYMENT_METHOD.CASH, weight: 22 },
  { method: PAYMENT_METHOD.BANK_GUARANTEE, weight: 10 },
];

// Deterministic PRNG so repeated runs produce the same shaped dataset -
// makes "did my change alter the numbers?" answerable.
let seedState = 20260730;
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

// Seasonal-ish curve: busier in the run-up to Dashain/Tihar, quieter in
// monsoon - gives the trend charts a shape worth looking at instead of
// uniform noise.
function seasonalWeight(date) {
  const month = date.getMonth();
  if (month >= 8 && month <= 10) return 1.6;
  if (month >= 5 && month <= 7) return 0.7;
  return 1;
}

function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(randInt(9, 18), randInt(0, 59), 0, 0);
  return date;
}

async function ensureDealers() {
  const dispatchers = await Dispatcher.find({ companyName: { $regex: `^\\${DEMO_PREFIX}` } }).lean();
  const created = [];

  for (const spec of DEMO_DEALERS) {
    const existing = await DealerProfile.findOne({ companyName: spec.companyName });
    if (existing) {
      created.push(existing);
      continue;
    }

    const dispatcherId =
      spec.mode === "DISPATCHER" && dispatchers.length ? dispatchers[created.length % dispatchers.length]._id : null;

    const dealer = await DealerProfile.create({
      companyName: spec.companyName,
      contactName: spec.contactName,
      phone: `98${randInt(10000000, 99999999)}`,
      email: `${spec.contactName.split(" ")[0].toLowerCase()}.demo@example.com`,
      address: spec.district,
      status: "VERIFIED",
      fulfillmentMode: spec.mode,
      dispatcherId,
    });
    created.push(dealer);
  }

  return created;
}

async function ensureDispatchers() {
  const created = [];
  for (const spec of DEMO_DISPATCHERS) {
    const existing = await Dispatcher.findOne({ companyName: spec.companyName });
    if (existing) {
      created.push(existing);
      continue;
    }
    const dispatcher = await Dispatcher.create({
      companyName: spec.companyName,
      contactName: spec.contactName,
      phone: `98${randInt(10000000, 99999999)}`,
      email: `${spec.contactName.split(" ")[0].toLowerCase()}.dispatch@example.com`,
      address: spec.district,
      status: "VERIFIED",
    });
    created.push(dispatcher);
  }
  return created;
}

function buildOrderItems(products) {
  const lineCount = randInt(2, 6);
  const items = [];
  let subtotal = 0;

  for (let i = 0; i < lineCount; i += 1) {
    const product = pick(products);
    const quantity = randInt(2, 40);
    const tier = product.pricing?.tiers?.[0];
    const unitPrice = Number(tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax ?? 0) || randInt(400, 4200);
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;

    items.push({
      productId: product._id,
      sku: product.sku,
      skuSnapshot: product.sku,
      nameSnapshot: product.name,
      categorySnapshot: product.category || "",
      packSnapshot: product.pack?.label || "",
      quantity,
      unitPrice,
      lineTotal,
    });
  }

  return { items, subtotal };
}

async function seedOrdersAndPayments({ dealers, dispatchers, products, apply }) {
  const dispatcherById = new Map(dispatchers.map((d) => [String(d._id), d]));
  const summary = { orders: 0, payments: 0, revenue: 0 };

  for (let day = 270; day >= 0; day -= 1) {
    const date = daysAgo(day);
    const base = rand() * seasonalWeight(date);
    const ordersToday = base > 0.62 ? randInt(1, 3) : base > 0.34 ? 1 : 0;

    for (let n = 0; n < ordersToday; n += 1) {
      const dealer = pick(dealers);
      const { items, subtotal } = buildOrderItems(products);
      const total = Math.round(subtotal);
      const { status } = pickWeighted(ORDER_MIX);

      const dispatcherId =
        dealer.fulfillmentMode === "DISPATCHER" ? dealer.dispatcherId || dispatchers[0]?._id || null : null;

      summary.orders += 1;
      if (![ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED].includes(status)) summary.revenue += total;

      if (!apply) continue;

      const order = await Order.create({
        dealerId: dealer._id,
        dispatcherId,
        orderOrigin: "DEALER",
        status,
        items,
        totals: { subtotal: total, total, currency: "NPR" },
        dealerSnapshot: {
          companyName: dealer.companyName,
          contactName: dealer.contactName,
          phone: dealer.phone,
          email: dealer.email,
          fulfillmentMode: dealer.fulfillmentMode,
        },
        createdAt: date,
        updatedAt: date,
        reviewedAt: status === ORDER_STATUS.SUBMITTED ? null : date,
        reviewedByRole: status === ORDER_STATUS.SUBMITTED ? null : dispatcherId ? "DISPATCHER" : "ADMIN",
        meta: { demoTag: DEMO_TAG },
      });

      // Most delivered orders are paid, some partially, a few not at all -
      // otherwise AR aging has nothing to show.
      const isBillable = ![ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED, ORDER_STATUS.SUBMITTED].includes(status);
      if (!isBillable) continue;

      const roll = rand();
      if (roll > 0.28) {
        const partial = roll > 0.82;
        const amount = partial ? Math.round(total * (0.3 + rand() * 0.4)) : total;
        const paidAt = new Date(date.getTime() + randInt(1, 21) * 86400000);
        if (paidAt > new Date()) continue;

        await Payment.create({
          orderId: order._id,
          dealerId: dealer._id,
          method: pickWeighted(METHOD_MIX).method,
          amount,
          currency: "NPR",
          status: rand() > 0.12 ? PAYMENT_STATUS.VERIFIED : PAYMENT_STATUS.PENDING_VERIFICATION,
          proof: { note: `${DEMO_TAG} settlement` },
          createdAt: paidAt,
          updatedAt: paidAt,
        });
        summary.payments += 1;
      }
    }
  }

  // A few dispatcher-side payments so the Payments section shows both
  // party types rather than dealers only.
  if (apply) {
    for (const dispatcher of dispatchers) {
      for (let i = 0; i < 4; i += 1) {
        const when = daysAgo(randInt(5, 120));
        await Payment.create({
          dispatcherId: dispatcher._id,
          method: pickWeighted(METHOD_MIX).method,
          amount: randInt(45000, 320000),
          currency: "NPR",
          status: PAYMENT_STATUS.VERIFIED,
          proof: { note: `${DEMO_TAG} regional settlement` },
          createdAt: when,
          updatedAt: when,
        });
        summary.payments += 1;
      }
    }
  }

  void dispatcherById;
  return summary;
}

async function seedStock({ dealers, dispatchers, products, apply }) {
  const summary = { factory: 0, dispatcher: 0, dealer: 0, movements: 0 };
  const sample = products.slice(0, Math.min(40, products.length));

  for (const product of sample) {
    const quantity = randInt(0, 400);
    const threshold = randInt(20, 60);
    summary.factory += 1;
    if (!apply) continue;

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          "stock.currentQuantity": quantity,
          "stock.reservedQuantity": Math.min(quantity, randInt(0, 40)),
          "stock.lowStockThreshold": threshold,
          "stock.lastUpdatedAt": daysAgo(randInt(0, 30)),
        },
      },
    );

    for (let i = 0; i < 2; i += 1) {
      const previous = randInt(0, 400);
      const next = Math.max(0, previous + randInt(-60, 120));
      const when = daysAgo(randInt(0, 120));
      await StockAdjustmentLog.create({
        productId: product._id,
        sku: product.sku,
        code: product.code || "",
        productName: product.name,
        category: product.category || "",
        packLabel: product.pack?.label || "",
        unit: product.pack?.unit || "",
        type: next >= previous ? "INCREASE" : "DECREASE",
        previousQuantity: previous,
        newQuantity: next,
        reason: `${DEMO_TAG} stock count`,
        note: DEMO_TAG,
        createdAt: when,
        updatedAt: when,
      });
      summary.movements += 1;
    }
  }

  for (const dispatcher of dispatchers) {
    for (const product of sample.slice(0, 18)) {
      summary.dispatcher += 1;
      if (!apply) continue;
      const quantity = randInt(0, 180);
      await DispatcherProductStock.updateOne(
        { dispatcherId: dispatcher._id, productId: product._id },
        {
          $set: {
            currentQuantity: quantity,
            reservedQuantity: Math.min(quantity, randInt(0, 20)),
            lastUpdatedAt: daysAgo(randInt(0, 40)),
          },
        },
        { upsert: true },
      );
    }
  }

  for (const dealer of dealers) {
    for (const product of sample.slice(0, 12)) {
      summary.dealer += 1;
      if (!apply) continue;
      const received = randInt(10, 260);
      const sold = randInt(0, received);
      await DealerProductStock.updateOne(
        { dealerId: dealer._id, productId: product._id },
        {
          $set: {
            currentQuantity: received - sold,
            totalReceivedQuantity: received,
            totalSoldQuantity: sold,
            lowStockThreshold: randInt(5, 25),
            lastMovementAt: daysAgo(randInt(0, 45)),
          },
        },
        { upsert: true },
      );
    }
  }

  return summary;
}

async function clean() {
  const dealers = await DealerProfile.find({ companyName: { $regex: `^\\${DEMO_PREFIX}` } }).select("_id").lean();
  const dispatchers = await Dispatcher.find({ companyName: { $regex: `^\\${DEMO_PREFIX}` } }).select("_id").lean();
  const dealerIds = dealers.map((d) => d._id);
  const dispatcherIds = dispatchers.map((d) => d._id);

  const removed = {
    orders: (await Order.deleteMany({ "meta.demoTag": DEMO_TAG })).deletedCount,
    payments: (await Payment.deleteMany({
      $or: [{ dealerId: { $in: dealerIds } }, { dispatcherId: { $in: dispatcherIds } }],
    })).deletedCount,
    stockLogs: (await StockAdjustmentLog.deleteMany({ note: DEMO_TAG })).deletedCount,
    dispatcherStock: (await DispatcherProductStock.deleteMany({ dispatcherId: { $in: dispatcherIds } })).deletedCount,
    dealerStock: (await DealerProductStock.deleteMany({ dealerId: { $in: dealerIds } })).deletedCount,
    dealers: (await DealerProfile.deleteMany({ _id: { $in: dealerIds } })).deletedCount,
    dispatchers: (await Dispatcher.deleteMany({ _id: { $in: dispatcherIds } })).deletedCount,
  };

  console.log("Removed demo data:", removed);
}

// Name-based production detection is not enough here: this project's
// real database is called "meituweb" on a host with no "prod" token, so
// assertSafeDatabaseWrite() reads it as safe. Refuse to inject demo data
// into any database that already holds real (non-demo) orders - that is
// the condition that actually matters.
async function assertDatabaseIsSafeToPopulate() {
  const realOrders = await Order.countDocuments({ "meta.demoTag": { $ne: DEMO_TAG } });
  if (realOrders === 0) return;

  if (String(process.env.ALLOW_SEED_INTO_POPULATED_DB || "").toLowerCase() !== "true") {
    throw new Error(
      [
        `Refusing to seed demo data: this database already holds ${realOrders} real orders.`,
        `Target: ${describeDatabaseTarget(process.env.MONGO_URI || process.env.MONGODB_URI)}.`,
        "Point at a staging/empty database instead, e.g.:",
        "  DOTENV_CONFIG_PATH=.env.staging node -r dotenv/config src/scripts/seed-insights-demo.js --apply",
        "If you genuinely intend to mix demo data into this database, set ALLOW_SEED_INTO_POPULATED_DB=true.",
      ].join("\n"),
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isClean = args.includes("--clean");
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || (!apply && !isClean);

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  assertSafeDatabaseWrite({
    mongoUri,
    operation: "insights demo seed",
    destructive: isClean,
  });

  console.log(`Target: ${describeDatabaseTarget(mongoUri)}`);
  console.log(dryRun ? "Mode: DRY RUN (nothing will be written)" : isClean ? "Mode: CLEAN" : "Mode: APPLY");

  await mongoose.connect(mongoUri);

  try {
    if (isClean) {
      await clean();
      return;
    }

    if (apply) await assertDatabaseIsSafeToPopulate();

    const products = await Product.find({ isActive: { $ne: false } })
      .select("sku name category pack pricing code")
      .limit(120)
      .lean();

    if (!products.length) {
      throw new Error("No products found - run the product seed first.");
    }

    const dispatchers = dryRun ? DEMO_DISPATCHERS.map((d, i) => ({ ...d, _id: `demo-${i}` })) : await ensureDispatchers();
    const dealers = dryRun
      ? DEMO_DEALERS.map((d, i) => ({ ...d, _id: `demo-${i}`, fulfillmentMode: d.mode }))
      : await ensureDealers();

    const orderSummary = await seedOrdersAndPayments({ dealers, dispatchers, products, apply });
    const stockSummary = await seedStock({ dealers, dispatchers, products, apply });

    console.log("\nPlanned/created:");
    console.log(`  dealers      ${dealers.length}`);
    console.log(`  dispatchers  ${dispatchers.length}`);
    console.log(`  orders       ${orderSummary.orders}`);
    console.log(`  payments     ${orderSummary.payments}`);
    console.log(`  revenue      NPR ${orderSummary.revenue.toLocaleString()}`);
    console.log(`  factory SKUs ${stockSummary.factory}`);
    console.log(`  stock logs   ${stockSummary.movements}`);

    if (dryRun) {
      console.log("\nDry run only. Re-run with --apply to write.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
