// Fixes a third tier-boundary bug in the same family as
// fix-volume-tier-unit-mismatch.js and fix-volume-tier-min-gap.js: every
// TOTALVOL_L_1_20_21_PLUS product has tiers [{min:0,max:20},{min:21,max:null}]
// (after the earlier tiers[0].min fix). Metric values strictly between 20
// and 21 - reachable now that fractional pack sizes (0.5L/0.2L/0.1L) are
// correctly scaled - match NEITHER tier and silently price at 0. Example:
// 5x Wood Primer 4L (=20L) already in the cart, then adding one 500ML
// (=0.5L) gives a family total of 20.5L.
//
// Fix: close the gap by setting tier2.min = tier1.max (20, not 21). Array
// .find() takes the first match, so exactly-20 still resolves to tier1 (the
// "1-20L" price) - only values strictly greater than 20 shift to tier2,
// with no gap left in between. Confirmed via audit that all 20 families
// under this pricing model have at least one fractional pack size, so this
// applies to all of them; the other tiered model (VOL_L_1_80_81_250_251_PLUS,
// 1-80/81-250/251+) has zero fractional pack sizes anywhere in any of its
// families, so its equivalent gaps are structurally unreachable and are not
// touched here.
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "fix volume-tier boundary gap", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const candidates = await Product.find({
    "pricing.pricingModelKey": "TOTALVOL_L_1_20_21_PLUS",
    "pricing.tiers.1.min": 21,
  }).lean();

  console.log(`Found ${candidates.length} products with tiers[1].min === 21.`);

  let fixed = 0;
  for (const p of candidates) {
    const tier1Max = p.pricing.tiers[0]?.max;
    if (mode === "apply") {
      await Product.updateOne({ _id: p._id }, { $set: { "pricing.tiers.1.min": tier1Max } });
      fixed += 1;
    }
  }

  console.log(mode === "apply" ? `Fixed ${fixed} products (tiers[1].min: 21 -> 20).` : `Dry run complete - re-run with --apply to write.`);
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
