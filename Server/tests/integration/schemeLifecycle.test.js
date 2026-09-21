// End-to-end scheme-order lifecycle against a real database.
//
// This one WRITES, so it is off by default and refuses to run anywhere that
// looks like production:
//   * skipped entirely unless RUN_DB_TESTS=1
//   * assertSafeDatabaseWrite() rejects a production-shaped target
//   * every record it creates is removed again in the teardown below
//
// Run: npm run test:integration          (from Server/, uses .env.staging)
//
// It covers the rules that are expensive to get wrong and invisible in a unit
// test: what a scheme does to factory stock, what the dealer ends up holding,
// and which serial sequence its Proforma Invoice draws from.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const ENABLED = process.env.RUN_DB_TESTS === "1";

let Order;
let Product;
let User;
let DealerProfile;
let DealerProductStock;
let InventoryMovement;
let StockAdjustmentLog;
let Notification;
let Counter;
let schemeService;
let orderService;
let factoryService;

let admin;
let factoryUser;
let dealer;
let product;
const created = [];
let baselineOnHand = 0;
let baselineReserved = 0;
let baselineSchemeSerial = 0;

before(async () => {
  if (!ENABLED) return;
  // Mail and web-push are side effects we neither want nor need here; blanking
  // the transports makes the services skip them instead of reaching the network.
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]) {
    process.env[key] = "";
  }

  // Hard stop before any credentials are even read. assertSafeDatabaseWrite
  // below cannot be the only lock: this repo's plain .env is NODE_ENV
  // "development" while pointing at the live production cluster, so a
  // target-shape check alone would wave it through. The env file has to say
  // staging, explicitly.
  const envPath = process.env.DOTENV_CONFIG_PATH || "";
  assert.match(
    envPath,
    /staging/i,
    `refusing to run write-tests with DOTENV_CONFIG_PATH="${envPath}" - point it at a staging env file (npm run test:integration does this)`,
  );

  // Loaded here rather than at the top of the file so a skipped run never even
  // reads an env file.
  await import("dotenv/config");

  const { assertSafeDatabaseWrite, describeDatabaseTarget } = await import("../../src/utils/dbWriteSafety.js");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeDatabaseWrite({ mongoUri: uri, operation: "scheme lifecycle integration test", destructive: true });
  console.log(`[integration] ${describeDatabaseTarget(uri)}`);

  ({ default: Order } = await import("../../src/models/Order.model.js"));
  ({ default: Product } = await import("../../src/models/Product.model.js"));
  ({ default: User } = await import("../../src/models/User.model.js"));
  ({ default: DealerProfile } = await import("../../src/models/DealerProfile.model.js"));
  ({ default: DealerProductStock } = await import("../../src/models/DealerProductStock.model.js"));
  ({ default: InventoryMovement } = await import("../../src/models/InventoryMovement.model.js"));
  ({ default: StockAdjustmentLog } = await import("../../src/models/StockAdjustmentLog.model.js"));
  ({ default: Notification } = await import("../../src/models/Notification.model.js"));
  ({ default: Counter } = await import("../../src/models/Counter.model.js"));
  schemeService = await import("../../src/services/schemeOrder.service.js");
  orderService = await import("../../src/services/order.service.js");
  factoryService = await import("../../src/services/factory.service.js");

  await mongoose.connect(uri);

  admin = await User.findOne({ role: "ADMIN", isActive: true });
  factoryUser = await User.findOne({ role: "FACTORY", isActive: true });
  dealer = await DealerProfile.findOne({ status: { $ne: "SUSPENDED" }, fulfillmentMode: { $ne: "DISPATCHER" } });
  // A plain stocked product - a kit would expand into components and make the
  // stock arithmetic below a different (and separately tested) story.
  product = await Product.findOne({
    "stock.currentQuantity": { $gte: 25 },
    $or: [{ components: { $exists: false } }, { components: { $size: 0 } }],
  });

  assert.ok(admin, "needs an active ADMIN user");
  assert.ok(factoryUser, "needs an active FACTORY user");
  assert.ok(dealer, "needs a factory-routed dealer");
  assert.ok(product, "needs a non-kit product with at least 25 units in stock");

  baselineOnHand = Number(product.stock.currentQuantity || 0);
  baselineReserved = Number(product.stock.reservedQuantity || 0);
  baselineSchemeSerial = (await Counter.findById("schemeOrderSerialNumber").lean())?.seq ?? 0;
});

after(async () => {
  if (!ENABLED || mongoose.connection.readyState === 0) return;
  // Undo everything, in the same order the app would have done it.
  for (const id of created) {
    const order = await Order.findById(id).lean();
    if (!order) continue;
    for (const item of order.items || []) {
      const qty = Number(item.quantity || 0);
      if (order.status === "COMPLETED") {
        await Product.updateOne({ _id: item.productId }, { $inc: { "stock.currentQuantity": qty } });
        if (order.dealerId) {
          await DealerProductStock.updateOne(
            { dealerId: order.dealerId, productId: item.productId },
            { $inc: { currentQuantity: -qty, totalSchemeQuantity: -qty } },
          );
        }
      } else if (order.status === "DISPATCHED") {
        // Shipped but not yet received: central stock was spent, the dealer
        // has not been credited.
        await Product.updateOne({ _id: item.productId }, { $inc: { "stock.currentQuantity": qty } });
      } else if (order.stockReservation?.status === "RESERVED") {
        await Product.updateOne(
          { _id: item.productId, "stock.reservedQuantity": { $gte: qty } },
          { $inc: { "stock.reservedQuantity": -qty } },
        );
      }
    }
  }
  await Order.deleteMany({ _id: { $in: created } });
  await InventoryMovement.deleteMany({ orderId: { $in: created } });
  await StockAdjustmentLog.deleteMany({ orderId: { $in: created } });
  await Notification.deleteMany({ orderId: { $in: created } });

  // The PI test draws a real scheme serial. Nothing holds it once these orders
  // are gone, so hand it back rather than leaving a gap in the sequence every
  // time someone runs the suite.
  const schemeSerialNow = (await Counter.findById("schemeOrderSerialNumber").lean())?.seq ?? 0;
  if (schemeSerialNow > baselineSchemeSerial) {
    const stillUsed = await Order.countDocuments({
      orderOrigin: "SCHEME",
      serialNumber: { $gt: baselineSchemeSerial, $lte: schemeSerialNow },
    });
    if (stillUsed === 0) {
      await Counter.updateOne({ _id: "schemeOrderSerialNumber" }, { $set: { seq: baselineSchemeSerial } });
    }
  }

  const after = await Product.findById(product._id).select("stock").lean();
  assert.equal(after.stock.currentQuantity, baselineOnHand, "teardown must restore on-hand stock");
  assert.equal(after.stock.reservedQuantity, baselineReserved, "teardown must leave no stranded reservation");

  await mongoose.disconnect();
});

const raise = async (quantity, label = "Integration test scheme") => {
  const result = await schemeService.createSchemeOrder(
    {
      recipientType: "DEALER",
      recipientId: String(dealer._id),
      label,
      note: "Created by the automated lifecycle test.",
      items: [{ productId: String(product._id), quantity }],
    },
    admin,
  );
  created.push(result.orderId);
  return result;
};
const reservedNow = async () =>
  Number((await Product.findById(product._id).select("stock.reservedQuantity").lean()).stock.reservedQuantity || 0);

test("a new scheme is born approved, free, and holding factory stock", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(2);
  const order = await Order.findById(orderId).lean();

  assert.equal(order.status, "VERIFIED", "a scheme is its own approval");
  assert.equal(order.orderOrigin, "SCHEME");
  assert.equal(order.totals.total, 0, "a scheme is free of cost");
  assert.equal(order.dealerSnapshot.fulfillmentMode, "FACTORY", "schemes always ship from the factory");
  assert.equal(order.dealerNote, "Created by the automated lifecycle test.", "the admin note prints on summaries");
  assert.equal(await reservedNow(), baselineReserved + 2, "creation reserves the goods");
  await schemeService.deleteSchemeOrder(orderId, admin, { reason: "test cleanup" });
});

test("editing a verified scheme moves the reservation and leaves a trace", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(1);
  await schemeService.updateSchemeOrder(orderId, { items: [{ productId: String(product._id), quantity: 3 }] }, admin);

  const order = await Order.findById(orderId).lean();
  assert.equal(order.items[0].quantity, 3);
  assert.equal(await reservedNow(), baselineReserved + 3, "the reservation follows the new basket");

  const entry = (order.amendments || [])[0];
  assert.ok(entry, "the edit is recorded in the order's activity history");
  assert.equal(entry.kind, "SCHEME_UPDATE");
  assert.match(entry.reason, /→ 3/);
  await schemeService.deleteSchemeOrder(orderId, admin, { reason: "test cleanup" });
});

test("deleting a scheme hands its reserved stock straight back", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(2);
  assert.equal(await reservedNow(), baselineReserved + 2);

  await schemeService.deleteSchemeOrder(orderId, admin, { reason: "integration test" });
  assert.equal(await reservedNow(), baselineReserved, "nothing stays reserved behind a deleted scheme");
  assert.equal((await Order.findById(orderId).lean()).isDeleted, true);
});

test("a scheme cannot be pushed back into the review queue", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(1);
  await assert.rejects(
    () => orderService.revertOrderVerification({ orderId, actorUser: admin }),
    /can't be reverted/i,
    "undoing verification would drop a scheme into a state it was never in",
  );
  await schemeService.deleteSchemeOrder(orderId, admin, { reason: "test cleanup" });
});

test("its Proforma Invoice numbers from the scheme sequence, not the sales one", { skip: !ENABLED }, async () => {
  const salesBefore = (await Counter.findById("orderSerialNumber").lean())?.seq ?? 0;
  const { orderId } = await raise(1);

  const first = await orderService.ensureProformaInvoiceMetadata({ orderId, actorUser: admin });
  const schemeCounter = (await Counter.findById("schemeOrderSerialNumber").lean())?.seq ?? 0;
  assert.equal(first.serialNumber, schemeCounter, "the scheme PI takes the scheme sequence's latest number");

  const again = await orderService.ensureProformaInvoiceMetadata({ orderId, actorUser: admin });
  assert.equal(again.serialNumber, first.serialNumber, "re-downloading a PI never renumbers it");

  const salesAfter = (await Counter.findById("orderSerialNumber").lean())?.seq ?? 0;
  assert.equal(salesAfter, salesBefore, "a scheme must not consume a commercial invoice number");
  await schemeService.deleteSchemeOrder(orderId, admin, { reason: "test cleanup" });
});

test("dispatch and delivery move the goods from the factory to the dealer", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(3);

  await factoryService.markOutForDelivery({
    orderId,
    factoryUser,
    // Deliberately not 10 digits: a short driver number warns on the PI but
    // must never block a load from leaving.
    driverName: "Integration Driver",
    driverPhone: "98000",
    vehicleNumber: "BA 1 KHA 1234",
  });
  let order = await Order.findById(orderId).lean();
  assert.equal(order.status, "DISPATCHED");
  assert.equal(await reservedNow(), baselineReserved, "dispatch consumes the reservation");

  const dealerBefore = await DealerProductStock.findOne({ dealerId: dealer._id, productId: product._id }).lean();
  await factoryService.markDelivered({ orderId, factoryUser, note: "" });

  order = await Order.findById(orderId).lean();
  assert.equal(order.status, "COMPLETED");

  const dealerAfter = await DealerProductStock.findOne({ dealerId: dealer._id, productId: product._id }).lean();
  assert.equal(
    Number(dealerAfter.currentQuantity || 0) - Number(dealerBefore?.currentQuantity || 0),
    3,
    "delivered scheme goods become real sellable stock",
  );
  assert.equal(
    Number(dealerAfter.totalSchemeQuantity || 0) - Number(dealerBefore?.totalSchemeQuantity || 0),
    3,
    "and are tallied separately from goods the dealer paid for",
  );

  const history = (order.statusHistory || []).map((h) => h.toStatus);
  assert.ok(history.includes("DISPATCHED") && history.includes("COMPLETED"), "both transitions are on the record");
});

test("a dispatched scheme can no longer be edited or withdrawn", { skip: !ENABLED }, async () => {
  const { orderId } = await raise(1);
  await factoryService.markOutForDelivery({
    orderId,
    factoryUser,
    driverName: "Integration Driver",
    driverPhone: "9800000000",
    vehicleNumber: "BA 1 KHA 1234",
  });

  await assert.rejects(
    () => schemeService.updateSchemeOrder(orderId, { label: "Too late" }, admin),
    /no longer be edited/i,
  );
  await assert.rejects(
    () => schemeService.deleteSchemeOrder(orderId, admin, { reason: "too late" }),
    /no longer be deleted/i,
  );
});
