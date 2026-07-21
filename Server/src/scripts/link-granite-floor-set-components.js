// Turns the Granite Epoxy Floor Paint set's existing display-only
// `components` array into a real Bill-of-Materials link, so its factory
// stock is computed automatically from the 7 components' own independent
// stock instead of being tracked as its own disconnected number (see
// stock.service.js's resolveOrderStockLines/getStock for the read/write
// side of this).
//
// What this script does:
//   1. Sets `productId` on each of GRANITE-FLOOR-SET-1SET's 7
//      `components[]` entries, matched 1:1 by name to the 7 known
//      component product codes below.
//   2. Reactivates those 7 component products (isActive:true) so factory
//      staff can see and stock-manage them individually again.
//   3. Marks those same 7 as sellable:false so they stay invisible to
//      dealer/dispatcher catalogs and cannot be ordered directly, even
//      though they're active again.
//   4. Confirms the SET itself is sellable:true (explicit, matches the
//      schema default - it's the only orderable SKU here).
//
// Deliberately does NOT touch the SET's own `stock` object - it must keep
// serving whatever legacy order reservations already reference its own
// productId directly (releaseReservationForOrder/consumeReservationForOrder
// replay a stored snapshot, not a live re-resolution, so those orders are
// unaffected either way) until they naturally dispatch/complete/cancel.
//
// Usage:
//   node -r dotenv/config src/scripts/link-granite-floor-set-components.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/link-granite-floor-set-components.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const SET_CODE = "GRANITE-FLOOR-SET";

const COMPONENT_CODES = [
  "GRANITE-FLOOR-GRIPCOAT-A",
  "GRANITE-FLOOR-GRIPCOAT-B",
  "GRANITE-FLOOR-TRUE-BOND-A",
  "GRANITE-FLOOR-TRUE-BOND-B",
  "GRANITE-FLOOR-PRIME-SHINE-A",
  "GRANITE-FLOOR-PRIME-SHINE-B",
  "GRANITE-FLOOR-SURFACE",
];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "link Granite Epoxy Floor Paint components", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") {
    console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");
  } else {
    console.log("*** APPLY MODE - this WILL write to the database above. ***\n");
  }

  await mongoose.connect(MONGODB_URI);

  const set = await Product.findOne({ code: SET_CODE });
  if (!set) throw new Error(`Set product not found for code ${SET_CODE}`);

  const components = await Product.find({ code: { $in: COMPONENT_CODES } });
  if (components.length !== COMPONENT_CODES.length) {
    const found = new Set(components.map((c) => c.code));
    const missing = COMPONENT_CODES.filter((code) => !found.has(code));
    throw new Error(`Missing component product(s): ${missing.join(", ")}`);
  }
  const componentByName = new Map(components.map((c) => [c.name, c]));

  console.log(`Set: ${set.name} (${set.sku}) — currently ${set.components.length} display-only component row(s)`);
  console.log(`Set stock left untouched: currentQuantity=${set.stock?.currentQuantity ?? 0}, reservedQuantity=${set.stock?.reservedQuantity ?? 0}\n`);

  const nextComponents = set.components.map((entry) => {
    const match = componentByName.get(entry.name);
    if (!match) {
      console.warn(`  ! No component product matched by name "${entry.name}" — left unlinked.`);
      return entry;
    }
    console.log(`  - "${entry.name}" -> ${match.code} (${match.sku}), qty ${entry.quantity}, current stock ${match.stock?.currentQuantity ?? 0}`);
    return { ...(entry.toObject ? entry.toObject() : entry), productId: match._id };
  });

  const linkedCount = nextComponents.filter((c) => c.productId).length;
  console.log(`\nWould link ${linkedCount}/${nextComponents.length} component rows.`);
  console.log(`Would set isActive:true, sellable:false on ${components.length} component product(s).`);
  console.log(`Would confirm sellable:true on the set itself.`);

  if (mode === "apply") {
    set.components = nextComponents;
    set.sellable = true;
    await set.save();

    await Product.updateMany(
      { code: { $in: COMPONENT_CODES } },
      { $set: { isActive: true, sellable: false } },
    );

    console.log("\nApplied.");
  } else {
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
