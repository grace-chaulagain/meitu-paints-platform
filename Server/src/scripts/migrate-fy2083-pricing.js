// One-time FY2083 price list migration (see 208384 DP Price list.pdf).
// Updates existing SKU prices in place (never deletes/reinserts Product
// docs - that would orphan the 9 other collections that reference
// Product._id by ObjectId), retires the Tools & Accessories SKUs no longer
// in the new price list, flags Wall Putty + Colorants as priceless (no new
// prices given), adds the new 2D Granite Surface Paint 4KG pack size, and
// merges the 7 separately-sold Granite Epoxy Floor Paint components into a
// single set product.
//
// Usage:
//   node -r dotenv/config src/scripts/migrate-fy2083-pricing.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/migrate-fy2083-pricing.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const priceData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../seed/meitu-products-fy2083-prices.json"), "utf-8"),
);

const RETIRED_TOOL_SKUS = [
  "TOOLS-REGULAR-ROLLER-10IN-1PC",
  "TOOLS-PUTTING-PATA-TRI-1PC",
  "TOOLS-WALL-GRINDER-MACHINE-1PC",
  "TOOLS-PAINT-BRUSH-1PC",
  "TOOLS-DESIGN-ROLLER-1PC",
  "TOOLS-REGULAR-ROLLER-8IN-1PC",
  "TOOLS-PAINT-BRUSH-1_5IN-1PC",
  "TOOLS-PAINT-BRUSH-2IN-1PC",
  "TOOLS-SANDPAPER-ROLL-KHAXI-180-100-120-1ROLL",
  "TOOLS-TEXTURE-ROLLER-DECORATIVE-1SET",
  "TOOLS-PAINT-BRUSH-1IN-1PC",
  "TOOLS-PAINT-BRUSH-2_5IN-1PC",
  "TOOLS-REFILLABLE-PAINT-ROLLER-1SET",
  "TOOLS-PAINT-BRUSH-3IN-1PC",
  "TOOLS-WALL-GRINDER-MACHINE-1SET",
  "TOOLS-PUTTING-PATA-RECT-1PC",
  "TOOLS-SANDPAPER-KHAXI-80-100-120-1PC",
];

const PRICELESS_SKUS = [
  "WALLPUTTY-WHITE-20KG",
  "WALLPUTTY-GRAY-20KG",
  "COLORANT-BRIGHT-RED-RLZ-1000ML",
  "COLORANT-CARBON-BLACK-NNZ-1000ML",
  "COLORANT-DPP-ORANGE-ARZ-1000ML",
  "COLORANT-DPP-RED-REZ-1000ML",
  "COLORANT-EVERLASTING-ORANGE-ALZ-1000ML",
  "COLORANT-EVERLASTING-PURPLE-VLZ-1000ML",
  "COLORANT-IRON-OXIDE-BLACK-NXZ-1000ML",
  "COLORANT-IRON-OXIDE-RED-RXZ-1000ML",
  "COLORANT-IRON-OXIDE-YELLOW-YXZ-1000ML",
  "COLORANT-MEDIUM-YELLOW-YRZ-1000ML",
  "COLORANT-ORANGE-YELLOW-YMZ-1000ML",
  "COLORANT-PHTHALEIN-BLUE-BNZ-1000ML",
  "COLORANT-PHTHALEIN-GREEN-GPZ-1000ML",
  "COLORANT-ROSE-RED-PNZ-1000ML",
  "COLORANT-TITANIUM-WHITE-WXZ-1000ML",
  "COLORANT-YELLOWISH-BROWN-YQZ-1000ML",
];

const FLOOR_BUNDLE_COMPONENT_CODES = [
  "GRANITE-FLOOR-GRIPCOAT-A",
  "GRANITE-FLOOR-GRIPCOAT-B",
  "GRANITE-FLOOR-TRUE-BOND-A",
  "GRANITE-FLOOR-TRUE-BOND-B",
  "GRANITE-FLOOR-PRIME-SHINE-A",
  "GRANITE-FLOOR-PRIME-SHINE-B",
  "GRANITE-FLOOR-SURFACE",
];

// Read straight from the retiring SKUs' own current pack labels/names at
// runtime (see main()) rather than hardcoding them here, so the bundle's
// component list can never drift out of sync with what's actually being
// retired.

const NEW_2D_SURFACE_4KG = {
  code: "GTONE-2D-GRANITE-SURFACE",
  sku: "GTONE-2D-GRANITE-SURFACE-4KG",
  tiers: [
    { min: 1, max: 5, pricePerPack: 4705 },
    { min: 6, max: 10, pricePerPack: 4485 },
    { min: 11, max: null, pricePerPack: 4275 },
  ],
};

// Real Stone Surface Paint's pack size changed from 30KG to 60KG this FY
// (the new price list only lists a 60KG price - confirmed with the user
// this is a genuine repack, not a straight price hike on the old 30KG
// pack) - sku is renamed to match, mirroring how every other sku encodes
// its pack size.
const REAL_STONE_SURFACE_REPACK = {
  oldSku: "REALSTONE-SURFACE-30KG",
  newSku: "REALSTONE-SURFACE-60KG",
  pack: { label: "60KG", size: 60, unit: "KG" },
  tiers: [
    { min: 1, max: 5, pricePerPack: 13820 },
    { min: 6, max: 10, pricePerPack: 13180 },
    { min: 11, max: null, pricePerPack: 12570 },
  ],
};

const FLOOR_SET_TIERS = [
  { min: 1, max: 5, pricePerPack: 25368 },
  { min: 6, max: 10, pricePerPack: 24177 },
  { min: 11, max: null, pricePerPack: 23041 },
];

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "FY2083 price migration", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);

  await mongoose.connect(MONGODB_URI);

  // ---- 1. Straight price updates ----
  console.log(`\n=== Price updates (${Object.keys(priceData.priceUpdates).length} SKUs) ===`);
  for (const [sku, tiers] of Object.entries(priceData.priceUpdates)) {
    const existing = await Product.findOne({ sku }).lean();
    if (!existing) {
      console.warn(`  ! SKU not found, skipping: ${sku}`);
      continue;
    }
    const oldTier1 = existing.pricing?.tiers?.[0];
    const oldPrice = oldTier1?.pricePerPack ?? oldTier1?.priceExclTax ?? null;
    const newPrice = tiers[0]?.pricePerPack ?? tiers[0]?.priceExclTax ?? null;
    const changed = oldPrice !== newPrice;
    console.log(`  ${sku}: ${oldPrice} -> ${newPrice}${changed ? "" : " (unchanged)"}`);
    if (mode === "apply") {
      const basePrice = newPrice ?? 0;
      await Product.updateOne({ sku }, { $set: { "pricing.tiers": tiers, basePrice } });
    }
  }

  // ---- 1b. Real Stone Surface Paint repack (30KG -> 60KG) ----
  console.log(`\n=== Repacking ${REAL_STONE_SURFACE_REPACK.oldSku} -> ${REAL_STONE_SURFACE_REPACK.newSku} ===`);
  const realStoneSurface = await Product.findOne({ sku: REAL_STONE_SURFACE_REPACK.oldSku }).lean();
  if (!realStoneSurface) {
    console.warn(`  ! SKU not found, skipping: ${REAL_STONE_SURFACE_REPACK.oldSku}`);
  } else {
    console.log(
      `  ${REAL_STONE_SURFACE_REPACK.oldSku} (pack ${realStoneSurface.pack?.label}) -> ${REAL_STONE_SURFACE_REPACK.newSku} (pack ${REAL_STONE_SURFACE_REPACK.pack.label}), price ${realStoneSurface.pricing?.tiers?.[0]?.pricePerPack} -> ${REAL_STONE_SURFACE_REPACK.tiers[0].pricePerPack}`,
    );
    if (mode === "apply") {
      await Product.updateOne(
        { sku: REAL_STONE_SURFACE_REPACK.oldSku },
        {
          $set: {
            sku: REAL_STONE_SURFACE_REPACK.newSku,
            pack: REAL_STONE_SURFACE_REPACK.pack,
            "pricing.tiers": REAL_STONE_SURFACE_REPACK.tiers,
            basePrice: REAL_STONE_SURFACE_REPACK.tiers[0].pricePerPack,
          },
        },
      );
    }
  }

  // ---- 2. Tools & Accessories retirement ----
  console.log(`\n=== Retiring ${RETIRED_TOOL_SKUS.length} Tools & Accessories SKUs (not in new price list) ===`);
  for (const sku of RETIRED_TOOL_SKUS) {
    const existing = await Product.findOne({ sku }).lean();
    if (!existing) {
      console.warn(`  ! SKU not found, skipping: ${sku}`);
      continue;
    }
    console.log(`  ${sku} (${existing.name}) -> isActive:false`);
  }
  if (mode === "apply") {
    const res = await Product.updateMany({ sku: { $in: RETIRED_TOOL_SKUS } }, { $set: { isActive: false } });
    console.log(`  matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  // ---- 3. Wall Putty + Colorants -> priceless ----
  console.log(`\n=== Flagging ${PRICELESS_SKUS.length} Wall Putty + Colorant SKUs as priceless ===`);
  for (const sku of PRICELESS_SKUS) {
    console.log(`  ${sku} -> pricing.tiers = []`);
  }
  if (mode === "apply") {
    const res = await Product.updateMany(
      { sku: { $in: PRICELESS_SKUS } },
      { $set: { "pricing.tiers": [], basePrice: 0 } },
    );
    console.log(`  matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  // ---- 4. New 2D Granite Surface Paint 4KG pack size ----
  console.log(`\n=== Adding new pack size: ${NEW_2D_SURFACE_4KG.sku} ===`);
  const existing4kg = await Product.findOne({ sku: NEW_2D_SURFACE_4KG.sku }).lean();
  if (existing4kg) {
    console.log(`  already exists, skipping insert`);
  } else {
    const sibling = await Product.findOne({ code: NEW_2D_SURFACE_4KG.code, sku: "GTONE-2D-GRANITE-SURFACE-9KG" }).lean();
    if (!sibling) {
      console.warn(`  ! sibling 9KG product not found - cannot derive shared fields, skipping`);
    } else {
      console.log(`  will insert, cloning shared fields from ${sibling.sku}`);
      if (mode === "apply") {
        await Product.create({
          sku: NEW_2D_SURFACE_4KG.sku,
          code: sibling.code,
          name: sibling.name,
          category: sibling.category,
          description: sibling.description,
          uom: sibling.uom,
          pack: { label: "4KG", size: 4, unit: "KG" },
          pricing: {
            model: sibling.pricing?.model || "TIERED",
            pricingModelKey: sibling.pricing?.pricingModelKey,
            basis: sibling.pricing?.basis,
            tierUnit: sibling.pricing?.tierUnit,
            tiers: NEW_2D_SURFACE_4KG.tiers,
          },
          currency: sibling.currency || "NPR",
          basePrice: NEW_2D_SURFACE_4KG.tiers[0].pricePerPack,
          isActive: true,
          meta: { source: priceData.meta.datasetKey, notes: "New pack size added FY2083" },
        });
      }
    }
  }

  // ---- 5. Granite Epoxy Floor Paint set ----
  console.log(`\n=== Merging ${FLOOR_BUNDLE_COMPONENT_CODES.length} floor-paint components into one set product ===`);
  const componentProducts = await Product.find({ code: { $in: FLOOR_BUNDLE_COMPONENT_CODES } }).lean();
  if (componentProducts.length !== FLOOR_BUNDLE_COMPONENT_CODES.length) {
    console.warn(
      `  ! expected ${FLOOR_BUNDLE_COMPONENT_CODES.length} component products, found ${componentProducts.length} - check codes`,
    );
  }
  const components = componentProducts.map((p) => ({ name: p.name, packLabel: p.pack?.label || "", quantity: 1 }));
  console.log("  components:", components.map((c) => `${c.name} ${c.packLabel}`).join(", "));

  const bundleSku = "GRANITE-FLOOR-SET-1SET";
  const existingBundle = await Product.findOne({ sku: bundleSku }).lean();
  console.log(`  ${existingBundle ? "bundle already exists" : "will create bundle"}: ${bundleSku}`);
  console.log(`  will deactivate component codes: ${FLOOR_BUNDLE_COMPONENT_CODES.join(", ")}`);

  if (mode === "apply") {
    await Product.updateMany({ code: { $in: FLOOR_BUNDLE_COMPONENT_CODES } }, { $set: { isActive: false } });
    await ProductFamily.updateMany({ code: { $in: FLOOR_BUNDLE_COMPONENT_CODES } }, { $set: { isActive: false } });

    if (!existingBundle) {
      const referenceComponent = componentProducts[0];
      await ProductFamily.create({
        code: "GRANITE-FLOOR-SET",
        name: "Meitu Granite Epoxy Floor Paint Set",
        category: "GRANITE_FLOOR",
        description: "7-piece Granite Epoxy Floor Paint kit, sold as a single set from FY2083 onward.",
        isActive: true,
      });
      await Product.create({
        sku: bundleSku,
        code: "GRANITE-FLOOR-SET",
        name: "Meitu Granite Epoxy Floor Paint Set",
        category: "GRANITE_FLOOR",
        description: "7-piece Granite Epoxy Floor Paint kit, sold as a single set.",
        uom: { base: "SET", allowed: ["SET"] },
        pack: { label: "1 SET", size: 1, unit: "SET" },
        pricing: {
          model: "TIERED",
          pricingModelKey: referenceComponent?.pricing?.pricingModelKey || "BKT_1_5_6_10_11_PLUS",
          basis: "PACK_COUNT",
          tierUnit: "SET",
          tiers: FLOOR_SET_TIERS,
        },
        currency: "NPR",
        basePrice: FLOOR_SET_TIERS[0].pricePerPack,
        components,
        isActive: true,
        meta: { source: priceData.meta.datasetKey, notes: "Merged from 7 previously-separate SKUs, FY2083" },
      });
    }
  }

  console.log(`\n${mode === "dry-run" ? "Dry run complete - no writes performed. Re-run with --apply to write." : "Migration applied."}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
