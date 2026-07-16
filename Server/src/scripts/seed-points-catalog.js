/**
 * Seeds (upserts, safe to re-run) the "Painter Points Scheme 2083/84"
 * catalog that drives QR coupon generation. Matched on {category, name} so
 * re-running after editing this file updates existing rows in place rather
 * than duplicating them - useful for the yearly scheme refresh the name
 * implies.
 *
 * Business rule: Granite 2D, Granite 3D, Real Stone Paint, and Floor Paint
 * (Epoxy Floor Paint) generate GOLDEN coupons. Every other product generates
 * GREEN.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.staging node src/scripts/seed-points-catalog.js
 *   ... --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";
import PointsCatalogProduct from "../models/PointsCatalogProduct.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const DRY_RUN = process.argv.includes("--dry-run");

function sizesProduct(category, name, sizes) {
  return {
    category,
    name,
    couponType: "GREEN",
    pricingMode: "SIZES",
    sizes: Object.entries(sizes).map(([size, points]) => ({ size, points })),
  };
}

function flatProduct(category, name, points, rule, couponType = "GREEN") {
  return { category, name, couponType, pricingMode: "FLAT", flatPoints: points, rule };
}

const PRODUCTS = [
  // Regular Exterior Emulsion
  sizesProduct("Regular Exterior Emulsion", "High Glossy Exterior Paint", { "20L": 800, "10L": 400, "4L": 100 }),
  sizesProduct("Regular Exterior Emulsion", "High Glossy Natural Exterior Paint", { "20L": 600, "10L": 300, "4L": 100 }),
  sizesProduct("Regular Exterior Emulsion", "Friendly Natural Exterior Paint", { "20L": 400, "10L": 200, "4L": 100 }),
  sizesProduct("Regular Exterior Emulsion", "Constant Color Exterior Paint", { "20L": 200, "10L": 100 }),
  sizesProduct("Regular Exterior Emulsion", "Dark Color C2", { "20L": 800, "10L": 400, "4L": 100 }),

  // Regular Interior Emulsion
  sizesProduct("Regular Interior Emulsion", "High Glossy Interior Paint", { "20L": 800, "10L": 400, "4L": 100 }),
  sizesProduct("Regular Interior Emulsion", "High Glossy Natural Interior Paint", { "20L": 600, "10L": 300, "4L": 100 }),
  sizesProduct("Regular Interior Emulsion", "Friendly Natural Interior Paint", { "20L": 400, "10L": 200, "4L": 100 }),
  sizesProduct("Regular Interior Emulsion", "Constant Color Interior Paint", { "20L": 200, "10L": 100 }),
  sizesProduct("Regular Interior Emulsion", "Dark Color C1", { "20L": 400, "10L": 200 }),
  sizesProduct("Regular Interior Emulsion", "High Glossy Ceiling White", { "20L": 400, "10L": 200, "4L": 100 }),
  sizesProduct("Regular Interior Emulsion", "Eco Friendly Ceiling White", { "20L": 200, "10L": 100 }),

  // Primers
  sizesProduct("Primers", "Efficient Exterior Primer", { "20L": 200, "10L": 100 }),
  sizesProduct("Primers", "Alkali Resistant Interior Primer", { "20L": 200, "10L": 100 }),

  // Granite Textures - GOLDEN-eligible products in the scheme.
  // Flat points, no distribution/rule breakdown - same as any other product.
  flatProduct("Granite Textures", "Granite 2D", 200, "", "GOLDEN"),
  flatProduct("Granite Textures", "Granite 3D", 300, "", "GOLDEN"),
  flatProduct("Granite Textures", "Real Stone Paint", 300, "", "GOLDEN"),

  // Floor Paint - same flat-points shape as Granite Textures, also GOLDEN.
  flatProduct("Floor Paint", "Epoxy Floor Paint", 200, "200 points on True Bond A.", "GOLDEN"),

  // Enamel
  sizesProduct("Enamel", "Meitu Glossy Enamels", { "4L": 100 }),

  // Specialty
  sizesProduct("Specialty", "Terracotta", { "20L": 200, "10L": 100 }),
  sizesProduct("Specialty", "Damp Proof", { "20L": 200, "10L": 100 }),
];

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  assertSafeDatabaseWrite({ mongoUri, operation: "seed points catalog", destructive: false });
  console.log(`[db-write] ${describeDatabaseTarget(mongoUri)} dryRun=${DRY_RUN}`);

  await mongoose.connect(mongoUri);

  let upserted = 0;
  for (const product of PRODUCTS) {
    console.log(`${DRY_RUN ? "[dry-run] would upsert" : "Upserting"}: ${product.category} / ${product.name} (${product.couponType})`);
    if (!DRY_RUN) {
      await PointsCatalogProduct.findOneAndUpdate(
        { category: product.category, name: product.name },
        { $set: product },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    upserted += 1;
  }

  console.log(`Points catalog seed complete - ${upserted} product(s) processed.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Points catalog seed failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
