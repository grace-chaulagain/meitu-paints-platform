// FY2083.84 simplification: consolidates the 15 existing category codes
// down to the 9 the user specified (matching the new price list's section
// headers), and renames every product family's name to the short form used
// in that PDF's "Product Name" column. See
// .claude/plans/prancy-wandering-bunny.md (or git history around this
// script) for the full old->new mapping and reasoning - in particular, why
// Wall Putty folding into Specialty required a companion fix in
// Frontend/meitupaints/src/factory/factoryHelpers.js's Proforma tax-bucket
// logic (that file no longer keys off category for Wall Putty).
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import ProductFamily from "../models/ProductFamily.model.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

// Old category -> new category. Every Product/ProductFamily doc with the
// old value gets this new value, regardless of code (blanket fold).
const CATEGORY_MAP = {
  EXTERIOR_PAINT: "EXTERIOR_EMULSION",
  INTERIOR_PAINT: "INTERIOR_EMULSION",
  CEILING_WHITE: "INTERIOR_EMULSION",
  DISTEMPER: "INTERIOR_EMULSION",
  PRIMER: "PRIMERS",
  LIQUID_GRANITE_GTONE_2D: "GRANITE_WALL",
  LIQUID_GRANITE_GTONE_3D: "GRANITE_WALL",
  REAL_STONE: "GRANITE_WALL",
  GRANITE_FLOOR: "GRANITE_EPOXY_FLOOR",
  ENAMEL_PRIMER: "PRIMER_WITH_ENAMELS",
  ENAMEL: "PRIMER_WITH_ENAMELS",
  SPECIALTY: "SPECIALTY",
  WALL_PUTTY: "SPECIALTY",
  TOOLS_ACCESSORIES: "TOOLS_AND_ACCESSORIES",
  COLORANT: "COLORANTS",
};

// Per-family name corrections, matched by `code` (shared across every pack
// size / PB-RB variant of that family). Only families whose name actually
// changes are listed - everything else keeps its current name.
const NAME_MAP = {
  "ECO-HG-EXT": "High Glossy Exterior Paint",
  "ECO-HG-NAT-EXT": "High Glossy Natural Exterior Paint",
  "ENV-FRIENDLY-NAT-EXT": "Friendly Natural Exterior Paint",
  "ENV-FRIENDLY-CONST-EXT": "Constant Color Exterior Paint",
  "DARK-COLOR-INT-EXT-C2": "Dark Color C2",

  "ECO-HG-INT": "High Glossy Interior Paint",
  "ECO-HG-NAT-INT": "High Glossy Natural Interior Paint",
  "ENV-FRIENDLY-NAT-INT": "Friendly Natural Interior Paint",
  "ENV-FRIENDLY-CONST-INT": "Constant Color Interior Paint",
  "DARK-COLOR-INT-EXT-C1": "Dark Color C1",
  "ECO-INT-WALL": "Eco Friendly Interior Paint",
  "ECO-HG-CEILING-WHITE": "High Glossy Ceiling White",
  "ECO-CEILING-WHITE": "Eco Friendly Ceiling White",
  "ACRYLIC-DIST-INT": "Distemper",

  "EE-EXT-PRIMER": "Efficient Exterior Primer",
  "ALKALI-RES-INT-PRIMER": "Alkali Resistant Interior Primer",
  "ECO-INT-PRIMER": "Eco Friendly Primer",

  "GTONE-2D-GRANITE-PRIMER": "2D primer",
  "GTONE-2D-INTERMEDIATE-COAT": "2D Intermediate coating paint",
  "GTONE-2D-GRANITE-SURFACE": "2D Granite surface paint",
  "GTONE-2D-DUSTPROOF-SURFACE": "2D Dust-proof Surface Paint",
  "GTONE-3D-GRANITE-PRIMER": "3D primer",

  "GRANITE-FLOOR-SET": "Granite Epoxy Floor Paint",

  "ENAMEL-G1-BLACK": "Glossy Enamel - Black",
  "ENAMEL-G1-CHOCOLATE": "Glossy Enamel - Chocolate",
  "ENAMEL-G1-WHITE": "Glossy Enamel - White",
  "ENAMEL-G2-LEAF-BROWN": "Glossy Enamel - Leaf Brown",
  "ENAMEL-G2-PHIROZA": "Glossy Enamel - Phiroza",
  "ENAMEL-G2-PO-RED": "Glossy Enamel - Po Red",
  "ENAMEL-G2-SMOKE-GRAY": "Glossy Enamel - Smoke Gray",
  "ENAMEL-G3-BUS-GREEN": "Glossy Enamel - Bus Green",
  "ENAMEL-G3-GOLDEN-BROWN": "Glossy Enamel - Golden Brown",
  "ENAMEL-G3-GOLDEN-YELLOW": "Glossy Enamel - Golden Yellow",
  "ENAMEL-G4-DEEP-ORANGE": "Glossy Enamel - Deep Orange",
  "ENAMEL-G4-MINT-GREEN": "Glossy Enamel - Mint Green",
  "ENAMEL-G4-OLIVE-GREEN": "Glossy Enamel - Olive Green",
  "ENAMEL-G4-OXFORD-BLUE": "Glossy Enamel - Oxford Blue",
  "ENAMEL-G4-SKY-BLUE": "Glossy Enamel - Sky Blue",

  "MEITU-DAMP-PROOF": "Damp-Proof",
  "WALLPUTTY-WHITE-20KG": "Interior White Wall Putty",
  "WALLPUTTY-GRAY-20KG": "Exterior Grey Waterproof Wall Putty",
};

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "rename products + consolidate categories (FY2083.84)" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  console.log(`=== Category consolidation (${Object.keys(CATEGORY_MAP).length} old categories -> ${new Set(Object.values(CATEGORY_MAP)).size} new) ===`);
  for (const [oldCat, newCat] of Object.entries(CATEGORY_MAP)) {
    const productCount = await Product.countDocuments({ category: oldCat });
    const familyCount = await ProductFamily.countDocuments({ category: oldCat });
    console.log(`  ${oldCat} -> ${newCat}: ${productCount} products, ${familyCount} families`);
    if (mode === "apply") {
      await Product.updateMany({ category: oldCat }, { $set: { category: newCat } });
      await ProductFamily.updateMany({ category: oldCat }, { $set: { category: newCat } });
    }
  }

  console.log(`\n=== Name corrections (${Object.keys(NAME_MAP).length} families) ===`);
  for (const [code, name] of Object.entries(NAME_MAP)) {
    const existing = await Product.findOne({ code }).lean();
    if (!existing) {
      console.warn(`  ! code not found, skipping: ${code}`);
      continue;
    }
    console.log(`  ${code}: "${existing.name}" -> "${name}"`);
    if (mode === "apply") {
      await Product.updateMany({ code }, { $set: { name } });
      await ProductFamily.updateOne({ code }, { $set: { name } });
    }
  }

  console.log(mode === "apply" ? "\nDone." : "\nDry run complete - re-run with --apply to write.");
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
