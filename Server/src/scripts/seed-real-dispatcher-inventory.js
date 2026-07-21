// Seeds initial DispatcherProductStock for the two REAL, already-verified
// dispatcher accounts - "Dipak trading house" (dth2075@gmail.com) and
// "Kritagya Traders" (kkritagyatraders@gmail.com) - from the same physical
// stock-count sheets used for the disposable demo accounts in
// seed-demo-dispatcher-inventory.js (see that file's header for the full
// hand-matching methodology). This script targets the real accounts by
// email lookup only; it never creates/modifies a Dispatcher or User record.
//
// Both KRITAGYA_ITEMS and DIPAK_ITEMS are reused verbatim from the demo
// script - reconciled by total-quantity accounting against the source
// sheet (matched sum + unmatched sum + intentional duplicate-row drops =
// source total) with zero discrepancy. That reconciliation found and fixed
// one gap in DIPAK_ITEMS (two missing "High Glossy Na Inte/Inter Wall
// Paint" / Nature Interior rows) directly in the shared source file.
//
// Refuses to write over a dispatcher that already has ANY
// DispatcherProductStock rows, since this script is only for the
// one-time initial seed of a genuinely empty ledger - re-running it
// against an account with real activity would silently stomp real stock.
//
// Usage:
//   node -r dotenv/config src/scripts/seed-real-dispatcher-inventory.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/seed-real-dispatcher-inventory.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Dispatcher from "../models/Dispatcher.model.js";
import Product from "../models/Product.model.js";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";
import {
  DIPAK_ITEMS,
  KRITAGYA_ITEMS,
  DIPAK_UNMATCHED,
  KRITAGYA_UNMATCHED,
} from "./seed-demo-dispatcher-inventory.js";

function normLabel(s) {
  return String(s || "").toUpperCase().replace(/\s+/g, "");
}

const REAL_DISPATCHERS = [
  {
    key: "kritagya",
    email: "kkritagyatraders@gmail.com",
    items: KRITAGYA_ITEMS,
    unmatched: KRITAGYA_UNMATCHED,
    sourceFile: "Inventory_Stock_Transcription.txt",
  },
  {
    key: "dipak",
    email: "dth2075@gmail.com",
    items: DIPAK_ITEMS,
    unmatched: DIPAK_UNMATCHED,
    sourceFile: "Paint_Stock updated.txt",
  },
];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed real dispatcher inventory", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");

  await mongoose.connect(MONGODB_URI);

  const products = await Product.find({ isActive: { $ne: false } }).select("_id code name pack").lean();
  const byCodeAndLabel = new Map();
  for (const p of products) {
    byCodeAndLabel.set(`${p.code}::${normLabel(p.pack?.label)}`, p);
  }

  for (const dispatcherDef of REAL_DISPATCHERS) {
    console.log(`\n=== ${dispatcherDef.email} (source: ${dispatcherDef.sourceFile}) ===`);

    const dispatcher = await Dispatcher.findOne({ email: dispatcherDef.email });
    if (!dispatcher) {
      console.log(`  ! Dispatcher not found for ${dispatcherDef.email} - skipping.`);
      continue;
    }
    console.log(`  Dispatcher: ${dispatcher.companyName} (${dispatcher._id})`);

    const existingCount = await DispatcherProductStock.countDocuments({ dispatcherId: dispatcher._id });
    if (existingCount > 0) {
      console.log(`  ! REFUSING TO SEED: this dispatcher already has ${existingCount} DispatcherProductStock row(s). This script only seeds a genuinely empty ledger.`);
      continue;
    }

    const resolvedItems = [];
    const lookupFailures = [];
    for (const [code, packLabel, qty] of dispatcherDef.items) {
      const key = `${code}::${normLabel(packLabel)}`;
      const product = byCodeAndLabel.get(key);
      if (!product) {
        lookupFailures.push(`${code} / ${packLabel} (qty ${qty})`);
        continue;
      }
      resolvedItems.push({ product, qty });
    }

    if (lookupFailures.length) {
      console.log(`  ! LOOKUP FAILURES (mapping bug - fix the script, do not apply):`);
      lookupFailures.forEach((f) => console.log(`      ${f}`));
    }

    const totalQty = resolvedItems.reduce((s, r) => s + r.qty, 0);
    console.log(`  Matched ${resolvedItems.length}/${dispatcherDef.items.length} line(s), totaling ${totalQty} pieces.`);
    console.log(`  Skipped as unmatched/ambiguous (${dispatcherDef.unmatched.length}):`);
    dispatcherDef.unmatched.forEach((note) => console.log(`      - ${note}`));

    if (mode === "dry-run") {
      console.log("  Would write:");
      resolvedItems.forEach(({ product, qty }) => console.log(`      ${product.name} (${product.code} ${product.pack?.label}): currentQuantity=${qty}`));
      continue;
    }

    if (lookupFailures.length) {
      console.log("  Skipping apply for this dispatcher due to lookup failures above.");
      continue;
    }

    const stockOps = resolvedItems.map(({ product, qty }) => ({
      updateOne: {
        filter: { dispatcherId: dispatcher._id, productId: product._id },
        update: {
          $set: { currentQuantity: qty, reservedQuantity: 0, lastUpdatedAt: new Date(), lastUpdatedBy: null },
        },
        upsert: true,
      },
    }));
    const result = await DispatcherProductStock.bulkWrite(stockOps);
    console.log(`  Applied. Upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}.`);
  }

  if (mode === "dry-run") {
    console.log("\nDry run complete - no writes performed. Re-run with --apply to write.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
