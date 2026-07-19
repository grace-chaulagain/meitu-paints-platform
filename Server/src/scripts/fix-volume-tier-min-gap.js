// Fixes a systemic tier-boundary gap uncovered while fixing the
// ML/L pack.size scaling bug (fix-volume-tier-unit-mismatch.js): every
// VOLUME_TOTAL-basis product's first tier is { min: 1, max: 20 }. For any
// product whose own single-pack size is below 1 in the tier's unit (0.5L,
// 0.2L, 0.1L packs - Enamel/Enamel Primer 500ML, Gold Color, and even the
// already-correctly-scaled Aluminum Paints 0.5L / PU Silicon 0.5L), ordering
// just one pack computes a metric value below 1, which matches NEITHER tier
// (min:1 nor min:21) - getTierPrice() then falls back to unitPrice:0, so a
// lone small-pack order would display/charge NPR 0.
//
// Fix: widen every VOLUME_TOTAL product's tiers[0].min from 1 to 0. This
// only WIDENS the first tier's match range (adds [0,1), which currently
// matches nothing) - it can never cause an order that previously matched
// tier1 to resolve differently, and products whose smallest pack is already
// >= 1 unit (all the 20L/10L/4L/1L items) never reach the newly-added range
// at all, so this is a no-op for them. Applied universally (confirmed via
// audit: all 134 active VOLUME_TOTAL products currently have tiers[0].min
// === 1, none deviate) rather than only the SKUs currently reachable, so a
// future sub-1-unit pack added to any of these product lines doesn't
// reintroduce the same gap.
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "fix volume-tier min gap", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const candidates = await Product.find({
    "pricing.basis": "VOLUME_TOTAL",
    "pricing.tiers.0.min": 1,
  }).lean();

  console.log(`Found ${candidates.length} VOLUME_TOTAL products with tiers[0].min === 1.`);

  let fixed = 0;
  for (const p of candidates) {
    if (mode === "apply") {
      await Product.updateOne({ _id: p._id }, { $set: { "pricing.tiers.0.min": 0 } });
      fixed += 1;
    }
  }

  console.log(mode === "apply" ? `Fixed ${fixed} products (tiers[0].min: 1 -> 0).` : `Dry run complete - re-run with --apply to write.`);
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
