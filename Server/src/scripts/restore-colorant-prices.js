// Restores Colorant prices to their pre-FY2083 values (the FY2083 DP price
// list didn't include new colorant prices, so migrate-fy2083-pricing.js
// flagged all 16 as priceless - per the user's request, revert that and
// keep the old prices instead). Values sourced from Server/src/seed/
// meitu-products.json (confirmed as an exact match for the live pre-
// migration DB - cross-checked ECO-CEILING-WHITE-20L's 4655 against the
// FY2083 migration's own dry-run "old price" output).
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const COLORANT_PRICES = {
  "COLORANT-CARBON-BLACK-NNZ-1000ML": 998,
  "COLORANT-IRON-OXIDE-BLACK-NXZ-1000ML": 1260,
  "COLORANT-IRON-OXIDE-RED-RXZ-1000ML": 1330,
  "COLORANT-IRON-OXIDE-YELLOW-YXZ-1000ML": 1330,
  "COLORANT-EVERLASTING-ORANGE-ALZ-1000ML": 1663,
  "COLORANT-PHTHALEIN-GREEN-GPZ-1000ML": 1829,
  "COLORANT-PHTHALEIN-BLUE-BNZ-1000ML": 1635,
  "COLORANT-EVERLASTING-PURPLE-VLZ-1000ML": 2106,
  "COLORANT-TITANIUM-WHITE-WXZ-1000ML": 1720,
  "COLORANT-BRIGHT-RED-RLZ-1000ML": 2217,
  "COLORANT-MEDIUM-YELLOW-YRZ-1000ML": 2163,
  "COLORANT-ORANGE-YELLOW-YMZ-1000ML": 1913,
  "COLORANT-YELLOWISH-BROWN-YQZ-1000ML": 3548,
  "COLORANT-DPP-RED-REZ-1000ML": 2772,
  "COLORANT-DPP-ORANGE-ARZ-1000ML": 4900,
  "COLORANT-ROSE-RED-PNZ-1000ML": 3548,
};

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "restore colorant prices", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  for (const [sku, price] of Object.entries(COLORANT_PRICES)) {
    const existing = await Product.findOne({ sku }).lean();
    if (!existing) {
      console.warn(`  ! SKU not found, skipping: ${sku}`);
      continue;
    }
    console.log(`  ${sku}: tiers=${JSON.stringify(existing.pricing?.tiers)} -> [{min:1,max:null,pricePerPack:${price}}]`);
    if (mode === "apply") {
      await Product.updateOne(
        { sku },
        { $set: { "pricing.tiers": [{ min: 1, max: null, pricePerPack: price }], basePrice: price } },
      );
    }
  }

  console.log(mode === "apply" ? "\nRestored." : "\nDry run complete - re-run with --apply to write.");
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
