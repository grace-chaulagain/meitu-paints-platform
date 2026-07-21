// Creates two clearly-labeled DEMO dispatcher accounts (separate from the
// real, already-verified "Dipak Trading House" and "Kritagya Traders"
// dispatchers already in the system) and seeds their DispatcherProductStock
// from real physical stock-count sheets, transcribed and hand-matched
// against the product catalog - see the MATCHED_* arrays below.
//
// Every line was matched by hand against the live catalog (code + pack
// size/unit, not exact-string pack.label, so formatting differences like
// "0.5 L" vs "0.5L" don't cause false negatives). Ambiguous or genuinely
// unmatched source lines were deliberately left out rather than guessed -
// see UNMATCHED_NOTES for exactly what was skipped and why. A handful of
// judgment calls (defaulting to a specific putty/enamel/tape variant when
// the source didn't specify, or summing two source rows that clearly
// referred to the same product split across the sheet) are called out
// inline with a comment on the affected line.
//
// Usage:
//   node -r dotenv/config src/scripts/seed-demo-dispatcher-inventory.js --dry-run
//   ALLOW_PRODUCTION_DB_WRITE=true node -r dotenv/config src/scripts/seed-demo-dispatcher-inventory.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import Product from "../models/Product.model.js";
import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import { ROLES } from "../constants/roles.js";
import { hashPassword } from "../services/auth.service.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

function normLabel(s) {
  return String(s || "").toUpperCase().replace(/\s+/g, "");
}

// [code, packLabel, qty]
const DIPAK_ITEMS = [
  ["GTONE-2D-DUSTPROOF-SURFACE", "3KG", 3],
  ["ACRYLIC-DIST-INT", "10KG", 4],
  ["ACRYLIC-DIST-INT", "5KG", 12],
  ["ACRYLIC-DIST-INT", "20KG", 4],
  ["ALKALI-RES-INT-PRIMER", "10L", 8],
  ["ALKALI-RES-INT-PRIMER", "1L", 18],
  ["ALKALI-RES-INT-PRIMER", "20L", 5],
  ["ALKALI-RES-INT-PRIMER", "4L", 12],
  ["ALUMINUM-PAINTS", "0.5L", 4],
  ["ENAMEL-G1-BLACK", "500ML", 24],
  ["ENAMEL-G1-BLACK", "4L", 12],
  ["ENAMEL-G1-CHOCOLATE", "4L", 4],
  ["ENV-FRIENDLY-CONST-EXT", "10L", 1],
  ["ENV-FRIENDLY-CONST-EXT", "1L", 6],
  ["ENV-FRIENDLY-CONST-EXT", "20L", 3],
  ["ENV-FRIENDLY-CONST-EXT", "4L", 4],
  ["ENV-FRIENDLY-CONST-INT", "1L", 6],
  ["ENV-FRIENDLY-CONST-INT", "20L", 2],
  ["ENV-FRIENDLY-CONST-INT", "4L", 4],
  ["ENV-FRIENDLY-CONST-INT", "10L", 5],
  ["MEITU-DAMP-PROOF", "1L", 6],
  ["MEITU-DAMP-PROOF", "10L", 5],
  ["MEITU-DAMP-PROOF", "20L", 6],
  ["DARK-COLOR-INT-EXT-C1", "1L", 6],
  ["DARK-COLOR-INT-EXT-C1", "20L", 6],
  ["DARK-COLOR-INT-EXT-C1", "10L", 6],
  ["DARK-COLOR-INT-EXT-C1", "4L", 3],
  ["DARK-COLOR-INT-EXT-C2", "10L", 1],
  ["DARK-COLOR-INT-EXT-C2", "1L", 6],
  ["DARK-COLOR-INT-EXT-C2", "20L", 5],
  ["GTONE-3D-DUSTPROOF-SURFACE", "3KG", 1], // "Dust Proof Surface Paint 3d" - inferred as the 3D line's only pack size
  ["ECO-CEILING-WHITE", "10L", 2],
  ["ECO-CEILING-WHITE", "1L", 6],
  ["ECO-CEILING-WHITE", "20L", 4],
  ["ECO-CEILING-WHITE", "4L", 4],
  ["ECO-INT-WALL", "10L", 9],
  ["ECO-INT-WALL", "1L", 12],
  ["ECO-INT-WALL", "20L", 4],
  ["ECO-INT-PRIMER", "1L", 18],
  ["ECO-INT-PRIMER", "4L", 12],
  ["EE-EXT-PRIMER", "1L", 18],
  ["EE-EXT-PRIMER", "20L", 2],
  ["EE-EXT-PRIMER", "4L", 12],
  ["ENV-FRIENDLY-NAT-EXT", "10L", 1],
  ["ENV-FRIENDLY-NAT-EXT", "1L", 6],
  ["ENV-FRIENDLY-NAT-EXT", "20L", 1],
  ["ENV-FRIENDLY-NAT-EXT", "4L", 4],
  ["ENV-FRIENDLY-NAT-INT", "10L", 6],
  ["ENV-FRIENDLY-NAT-INT", "1L", 6],
  ["ENV-FRIENDLY-NAT-INT", "20L", 6],
  ["ENAMEL-G1-CHOCOLATE", "500ML", 16],
  ["ENAMEL-G1-CHOCOLATE", "1L", 12],
  ["GOLD-COLOR", "100ML", 24],
  ["GOLD-COLOR", "200ML", 12],
  ["GOLD-COLOR", "500ML", 8],
  ["ENAMEL-G3-GOLDEN-BROWN", "500ML", 32],
  ["ENAMEL-G3-GOLDEN-BROWN", "1L", 12],
  ["ENAMEL-G3-GOLDEN-BROWN", "4L", 12],
  ["GTONE-3D-GRANITE-PRIMER", "3KG", 3],
  ["GTONE-3D-GRANITE-SURFACE", "24KG", 6],
  ["ECO-HG-CEILING-WHITE", "10L", 2],
  ["ECO-HG-CEILING-WHITE", "1L", 6],
  ["ECO-HG-CEILING-WHITE", "20L", 6],
  ["ECO-HG-CEILING-WHITE", "4L", 4],
  ["ECO-HG-EXT", "10L", 6],
  ["ECO-HG-EXT", "1L", 6],
  ["ECO-HG-EXT", "4L", 4],
  ["ECO-HG-EXT", "20L", 2],
  ["ECO-HG-NAT-INT", "10L", 3], // two source rows for this exact SKU+qty - treated as one line
  ["ECO-HG-NAT-INT", "1L", 6],
  ["ECO-HG-NAT-EXT", "10L", 6],
  ["ECO-HG-NAT-EXT", "1L", 6],
  ["ECO-HG-NAT-EXT", "20L", 4],
  ["ECO-HG-NAT-EXT", "4L", 4],
  ["ECO-HG-INT", "4L", 4],
  ["ECO-HG-INT", "20L", 6],
  ["ENAMEL-G2-LEAF-BROWN", "500ML", 32],
  ["ENAMEL-G2-LEAF-BROWN", "1L", 12],
  ["ENAMEL-G2-LEAF-BROWN", "4L", 8],
  ["METAL-PRIMER", "500ML", 16],
  ["METAL-PRIMER", "1L", 12],
  ["METAL-PRIMER", "4L", 12],
  ["ENAMEL-G2-PHIROZA", "500ML", 16],
  ["ENAMEL-G2-PHIROZA", "1L", 18],
  ["ENAMEL-G2-PHIROZA", "4L", 12],
  ["ENAMEL-G2-PO-RED", "500ML", 24],
  ["ENAMEL-G2-PO-RED", "1L", 18],
  ["ENAMEL-G2-PO-RED", "4L", 12],
  ["PU-SILICON-EXT-INT", "0.5L", 8],
  ["PU-SILICON-EXT-INT", "1L", 6],
  ["PU-SILICON-EXT-INT", "4L", 4],
  ["ENAMEL-G2-SMOKE-GRAY", "500ML", 24],
  ["ENAMEL-G2-SMOKE-GRAY", "1L", 13],
  ["ENAMEL-G2-SMOKE-GRAY", "4L", 12],
  ["TERRACOTTA", "10L", 2],
  ["TERRACOTTA", "1L", 6],
  ["TERRACOTTA", "20L", 4],
  ["TERRACOTTA", "4L", 4],
  ["WALLPUTTY-WHITE-20KG", "20KG (PB)", 2], // "Int&Ext White" - White is the closest color match; PB is the default packaging variant (RB unspecified in source)
  ["ENAMEL-G1-WHITE", "500ML", 32],
  ["ENAMEL-G1-WHITE", "1L", 18],
  ["ENAMEL-G1-WHITE", "4L", 12],
  ["WOOD-PRIMER", "500ML", 24],
  ["WOOD-PRIMER", "1L", 6],
  ["WOOD-PRIMER", "4L", 4],
  ["TOOLS-SEWING-TAPE", "50M", 91],
  ["TOOLS-SAFETY-BELT-SINGLE-HOOK", "1PC", 4], // "Safety Belt" - hook type unspecified, defaulted to Single Hook
  ["TOOLS-FLOOR-PAINT-SHOES", "1PAIR", 3],
  ["TOOLS-SCAFFOLDING-SET", "1SET", 20],
];

const DIPAK_UNMATCHED = [
  'Glossy Enamel G2 Black 1L (qty 11) - no "G2 Black" enamel exists in the catalog (G1 Black exists, already seeded separately)',
  'Liquid Granite Texture 2D Paint (qty 4, unit "Set") - no clear catalog match (Granite Wall 2D line is sold by KG, not as a "Set")',
];

// [code, packLabel, qty]
const KRITAGYA_ITEMS = [
  ["ECO-INT-PRIMER", "10L", 26],
  ["ECO-INT-PRIMER", "4L", 8],
  ["ECO-INT-PRIMER", "1L", 12],
  ["EE-EXT-PRIMER", "20L", 15],
  ["ECO-HG-INT", "20L", 23], // "High Glossy Interior Wall Paint" 20L:20 + "Eco-friendly High Glossy Interior" 20L:3 - same product, two sheet rows, summed
  ["ECO-HG-INT", "10L", 17], // 8 + 9, same reasoning
  ["ECO-HG-INT", "4L", 4],
  ["ECO-HG-INT", "1L", 16], // 1 carton (6) + 10 loose, same row in source
  ["ECO-HG-NAT-EXT", "20L", 6], // "High Glossy Nature Exterior wall paint" + "High Glossy Nature Exterior" rows combined
  ["ECO-HG-NAT-EXT", "10L", 7],
  ["ECO-HG-NAT-EXT", "4L", 8],
  ["ECO-HG-NAT-EXT", "1L", 6],
  ["ALKALI-RES-INT-PRIMER", "20L", 8],
  ["ALKALI-RES-INT-PRIMER", "10L", 12],
  ["ALKALI-RES-INT-PRIMER", "4L", 8],
  ["ALKALI-RES-INT-PRIMER", "1L", 12],
  ["TOOLS-FLOOR-PAINT-SHOES", "1PAIR", 30], // "Floor Paint Shores" (typo)
  ["TOOLS-SAFETY-BELT-SINGLE-HOOK", "1PC", 20],
  ["TOOLS-SAFETY-BELT-DOUBLE-HOOK", "1PC", 15],
  ["ACRYLIC-DIST-INT", "20KG", 4],
  ["ACRYLIC-DIST-INT", "10KG", 8],
  ["ACRYLIC-DIST-INT", "5KG", 5],
  ["PU-SILICON-EXT-INT", "4L", 12],
  ["ENAMEL-G1-WHITE", "4L", 16],
  ["ENAMEL-G1-BLACK", "4L", 12],
  ["ENAMEL-G1-BLACK", "500ML", 16],
  ["ENAMEL-G2-PHIROZA", "1L", 12],
  ["ENAMEL-G2-PHIROZA", "500ML", 16],
  ["ENAMEL-G3-GOLDEN-YELLOW", "1L", 18], // "Yellow Enamel" - inferred as Golden Yellow (closest/only plain-yellow enamel in catalog)
  ["ENAMEL-G2-LEAF-BROWN", "1L", 18],
  ["TOOLS-PLASTIC-COVER-20M", "1ROLL", 200],
  ["ECO-HG-EXT", "10L", 8],
  ["ECO-HG-EXT", "4L", 8],
  ["ECO-HG-EXT", "1L", 16],
  ["ENV-FRIENDLY-NAT-EXT", "20L", 2],
  ["ENV-FRIENDLY-NAT-EXT", "10L", 3],
  ["ENV-FRIENDLY-NAT-EXT", "4L", 8],
  ["ENV-FRIENDLY-NAT-EXT", "1L", 6],
  ["ENV-FRIENDLY-CONST-EXT", "20L", 3],
  ["ENV-FRIENDLY-CONST-EXT", "10L", 4],
  ["ENV-FRIENDLY-CONST-EXT", "4L", 4],
  ["ENV-FRIENDLY-CONST-EXT", "1L", 6],
  ["ALUMINUM-PAINTS", "1L", 18],
  ["ALUMINUM-PAINTS", "0.5L", 24],
  ["WOOD-PRIMER", "4L", 20],
  ["WOOD-PRIMER", "1L", 18],
  ["WOOD-PRIMER", "500ML", 16],
  ["METAL-PRIMER", "4L", 8],
  ["METAL-PRIMER", "1L", 12],
  ["TERRACOTTA", "10L", 2],
  ["TERRACOTTA", "4L", 12],
  ["TERRACOTTA", "1L", 30],
  ["GOLD-COLOR", "500ML", 24],
  ["GOLD-COLOR", "200ML", 24],
  ["GOLD-COLOR", "100ML", 48],
  ["MEITU-DAMP-PROOF", "20L", 5],
  ["MEITU-DAMP-PROOF", "10L", 5],
  ["MEITU-DAMP-PROOF", "4L", 8],
  ["MEITU-DAMP-PROOF", "1L", 12],
  ["ENV-FRIENDLY-CONST-INT", "20L", 7], // "Constant Interior" 4 + "Environmentally Constant Interior" 3 - same product, summed
  ["ENV-FRIENDLY-CONST-INT", "10L", 9], // 5 + 4, same reasoning
  ["ENV-FRIENDLY-CONST-INT", "4L", 8],
  ["ENV-FRIENDLY-CONST-INT", "1L", 16],
  ["DARK-COLOR-INT-EXT-C2", "20L", 1],
  ["DARK-COLOR-INT-EXT-C2", "4L", 21],
  ["DARK-COLOR-INT-EXT-C1", "20L", 1],
  ["DARK-COLOR-INT-EXT-C1", "4L", 3],
  ["ECO-HG-NAT-INT", "10L", 17],
  ["ECO-HG-NAT-INT", "4L", 14],
  ["ECO-HG-NAT-INT", "20L", 3],
  ["WALLPUTTY-GRAY-20KG", "20KG (PB)", 30], // "Putty Exterior" - PB is the default packaging variant (RB unspecified)
  ["WALLPUTTY-WHITE-20KG", "20KG (PB)", 100], // "Putty Interior"
  ["ENAMEL-G2-SMOKE-GRAY", "4L", 3],
  ["ENAMEL-G2-SMOKE-GRAY", "1L", 12],
  ["GRANITE-FLOOR-SET", "1 SET", 4], // "Floor Paint" - unit "sets" matches this product's pack exactly
  ["ENAMEL-G2-PO-RED", "1L", 25], // "Pro-Red" (typo for Po Red)
  ["ENAMEL-G2-PO-RED", "500ML", 18],
  ["ENAMEL-G1-CHOCOLATE", "1L", 10],
  ["ENAMEL-G1-CHOCOLATE", "500ML", 14],
];

const KRITAGYA_UNMATCHED = [
  "Eco-friendly Primer 25L: 25 pcs - no 25L size exists for this product (only 1L/4L/10L/20L); likely a transcription typo, not applied to any size to avoid guessing which",
  'Celling White 20L:8 / 10L:5 - two catalog products ("Eco Friendly Ceiling White" and "High Glossy Ceiling White") match "Ceiling White"; source doesn\'t specify which',
  "Spray 5 pcs - two catalog products (Spray Gun With Set, Spray Gun Head) could match; source doesn't specify which",
  "Bases (277:4, 225:5, 16005:6, 223:5) - these look like tinting-base shade codes, not represented as catalog products at all",
  "Black Primer 20 pcs - no catalog product matches this name",
  "Dust proof 20 pcs - two catalog products (2D and 3D Dust-proof Surface Paint) could match; source doesn't specify which",
  "Texture (217:13, 6005:2, 223:unspecified) - shade/texture codes, not catalog products",
  "Floor Paint Roller 100 pcs - two catalog products (4in and 9in) could match; source doesn't specify which",
  "Yellow Tape 2 cartons - no catalog product named \"Yellow Tape\"; also no carton-to-pieces conversion given for tape in the source's own conversion table",
];

const DEMO_DISPATCHERS = [
  {
    key: "kritagya",
    name: "Kritagya Traders (Demo)",
    companyName: "Kritagya Traders (Demo)",
    email: "demo.kritagya@meitu.internal",
    phone: "9800000011",
    items: KRITAGYA_ITEMS,
    unmatched: KRITAGYA_UNMATCHED,
    sourceFile: "Inventory_Stock_Transcription.txt",
  },
  {
    key: "dipak",
    name: "Dipak Trading House (Demo)",
    companyName: "Dipak Trading House (Demo)",
    email: "demo.dipak@meitu.internal",
    phone: "9800000012",
    items: DIPAK_ITEMS,
    unmatched: DIPAK_UNMATCHED,
    sourceFile: "Paint_Stock updated.txt",
  },
];

const DEMO_PASSWORD = "MeituDemo2026!";

function usernameFromEmail(email) {
  return String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed demo dispatcher inventory", destructive: false });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  if (mode === "dry-run") console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");

  await mongoose.connect(MONGODB_URI);

  // Build a normalized-label lookup index once, covering every active product.
  const products = await Product.find({ isActive: { $ne: false } })
    .select("_id code name pack")
    .lean();
  const byCodeAndLabel = new Map();
  for (const p of products) {
    byCodeAndLabel.set(`${p.code}::${normLabel(p.pack?.label)}`, p);
  }

  const results = [];

  for (const dispatcherDef of DEMO_DISPATCHERS) {
    console.log(`\n=== ${dispatcherDef.companyName} (source: ${dispatcherDef.sourceFile}) ===`);

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
      console.log(`  ! LOOKUP FAILURES (mapping bug, not a source-data issue - fix the script):`);
      lookupFailures.forEach((f) => console.log(`      ${f}`));
    }

    console.log(`  Matched ${resolvedItems.length}/${dispatcherDef.items.length} line(s).`);
    console.log(`  Skipped as unmatched/ambiguous (${dispatcherDef.unmatched.length}):`);
    dispatcherDef.unmatched.forEach((note) => console.log(`      - ${note}`));

    if (mode === "apply") {
      const dispatcher = await Dispatcher.findOneAndUpdate(
        { email: dispatcherDef.email },
        {
          $set: {
            name: dispatcherDef.name,
            companyName: dispatcherDef.companyName,
            phone: dispatcherDef.phone,
            email: dispatcherDef.email,
            address: `Demo account seeded from real stock-count sheet (${dispatcherDef.sourceFile}) - not a real dispatcher registration.`,
            status: DISPATCHER_STATUS.VERIFIED,
            isActive: true,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { new: true, upsert: true },
      );

      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const user = await User.findOneAndUpdate(
        { email: dispatcherDef.email },
        {
          $set: {
            email: dispatcherDef.email,
            username: usernameFromEmail(dispatcherDef.email),
            role: ROLES.DISPATCHER,
            dispatcherId: dispatcher._id,
            dealerId: null,
            isActive: true,
            accountStatus: "ACTIVE",
            passwordHash,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { new: true, upsert: true },
      ).lean();

      const stockOps = resolvedItems.map(({ product, qty }) => ({
        updateOne: {
          filter: { dispatcherId: dispatcher._id, productId: product._id },
          update: {
            $set: {
              currentQuantity: qty,
              lastUpdatedAt: new Date(),
              lastUpdatedBy: null,
            },
          },
          upsert: true,
        },
      }));
      const stockResult = stockOps.length ? await DispatcherProductStock.bulkWrite(stockOps) : null;

      results.push({
        companyName: dispatcherDef.companyName,
        email: dispatcherDef.email,
        password: DEMO_PASSWORD,
        dispatcherId: dispatcher._id.toString(),
        userId: user._id.toString(),
        stockRowsUpserted: stockResult ? stockResult.upsertedCount + stockResult.modifiedCount : 0,
      });
    }
  }

  if (mode === "apply") {
    console.log("\n=== Applied - login credentials ===");
    results.forEach((r) => {
      console.log(`\n${r.companyName}`);
      console.log(`  Email:    ${r.email}`);
      console.log(`  Password: ${r.password}`);
      console.log(`  Stock rows seeded: ${r.stockRowsUpserted}`);
    });
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
