// Recomputes every DispatcherProductPrice row's netPrice from its own
// price + product tax bucket, using the same formula as
// dispatcherPricing.service.js's computeNetPrice (and the Proforma
// Invoice's factoryHelpers.js) - Net Price used to be a manually-typed
// field with no enforced relationship to Price, and a live audit found
// real drift: every Tools & Accessories row stored netPrice=0 regardless
// of price, and at least one colorant showed a netPrice nearly 10x
// *higher* than its own price (impossible under any tax-reduction
// formula - almost certainly a stale value left over from before the
// price itself was changed).
//
// Usage:
//   node -r dotenv/config src/scripts/backfill-dispatcher-net-prices.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/backfill-dispatcher-net-prices.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import DispatcherProductPrice from "../models/DispatcherProductPrice.model.js";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const VAT_RATE = 0.13;
const EXCISE_MULTIPLIER_BY_BUCKET = {
  WALL_PUTTY: 1.05,
  OTHER: 1.07,
  TOOLS_ACCESSORIES: 1,
};

function excisemultiplierForProduct(product) {
  const code = product?.code || "";
  if (code.startsWith("WALLPUTTY-")) return EXCISE_MULTIPLIER_BY_BUCKET.WALL_PUTTY;
  if (code.startsWith("COLORANT-") || code.startsWith("TOOLS-")) {
    return EXCISE_MULTIPLIER_BY_BUCKET.TOOLS_ACCESSORIES;
  }
  if (product?.category === "TOOLS_AND_ACCESSORIES" || product?.category === "COLORANTS") {
    return EXCISE_MULTIPLIER_BY_BUCKET.TOOLS_ACCESSORIES;
  }
  return EXCISE_MULTIPLIER_BY_BUCKET.OTHER;
}

function computeNetPrice(price, product) {
  const multiplier = excisemultiplierForProduct(product);
  return Math.round(Number(price || 0) / (1 + VAT_RATE) / multiplier);
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "backfill dispatcher net prices", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") {
    console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");
  } else {
    console.log("*** APPLY MODE - this WILL write to the database above. ***\n");
  }

  await mongoose.connect(MONGODB_URI);

  const rows = await DispatcherProductPrice.find({}).lean();
  console.log(`Found ${rows.length} dispatcher price row(s).\n`);

  const productIds = [...new Set(rows.map((row) => String(row.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id code category name")
    .lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  let changedCount = 0;
  let missingProductCount = 0;
  const ops = [];

  for (const row of rows) {
    const product = productById.get(String(row.productId));
    if (!product) {
      missingProductCount += 1;
      console.warn(`  ! No product found for price row ${row._id} (productId=${row.productId}) - skipped.`);
      continue;
    }

    const nextNetPrice = computeNetPrice(row.price, product);
    if (nextNetPrice !== row.netPrice) {
      changedCount += 1;
      console.log(
        `  ${product.name} (${product.code}): price=${row.price} | netPrice ${row.netPrice} -> ${nextNetPrice}`,
      );
      ops.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { netPrice: nextNetPrice } },
        },
      });
    }
  }

  console.log(`\nWould change ${changedCount}/${rows.length} row(s). ${missingProductCount} row(s) skipped (product not found).`);

  if (mode === "apply" && ops.length) {
    const result = await DispatcherProductPrice.bulkWrite(ops);
    console.log(`\nApplied. Modified: ${result.modifiedCount}`);
  } else if (mode === "dry-run") {
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
