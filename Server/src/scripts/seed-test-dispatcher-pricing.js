// Seeds DispatcherProductPrice for the TEST dispatcher account
// (dispatcher.test@meitu.internal), from a real "6% price list" PDF issued
// to a real dispatcher (Kritagya) - used here purely as realistic sample
// pricing data. "Net Price" in the PDF -> netPrice (dispatcher's cost),
// "Price" -> price (what the dispatcher charges). Reuses
// upsertDispatcherPricing() from dispatcherPricing.service.js so this goes
// through the same validation the real Admin pricing UI does.
//
// Two judgment calls, consistent with the earlier stock-seeding pass:
// - Wall Putty PB/RB: the PDF doesn't distinguish batches, so the same
//   price is applied to both the PB and RB SKUs of each color.
// - "Color Tools And Accessories" section only lists one number per row
//   (no separate Net Price column) - treated as `price`, netPrice left
//   at 0/unset for those rows.
// "Floor Crack Seal" (2Kg) has no matching product in the catalog at all
// and is skipped.
//
// Usage:
//   node src/scripts/seed-test-dispatcher-pricing.js
//   node src/scripts/seed-test-dispatcher-pricing.js --apply
import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/Product.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import { upsertDispatcherPricing } from "../services/dispatcherPricing.service.js";
import { assertSafeDatabaseWrite, describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const TEST_DISPATCHER_EMAIL = "dispatcher.test@meitu.internal";

// sku -> [netPrice, price]
const PRICING = {
  // Exterior Emulsion
  "ECO-HG-EXT-20L": [12916, 15617],
  "ECO-HG-EXT-10L": [6998, 8461],
  "ECO-HG-EXT-4L": [2801, 3386],
  "ECO-HG-EXT-1L": [711, 860],
  "ECO-HG-NAT-EXT-20L": [9864, 11927],
  "ECO-HG-NAT-EXT-10L": [5249, 6347],
  "ECO-HG-NAT-EXT-4L": [2349, 2840],
  "ECO-HG-NAT-EXT-1L": [592, 716],
  "ENV-FRIENDLY-NAT-EXT-20L": [7846, 9486],
  "ENV-FRIENDLY-NAT-EXT-10L": [4025, 4867],
  "ENV-FRIENDLY-NAT-EXT-4L": [1680, 2032],
  "ENV-FRIENDLY-NAT-EXT-1L": [457, 553],
  "ENV-FRIENDLY-CONST-EXT-20L": [4783, 5783],
  "ENV-FRIENDLY-CONST-EXT-10L": [2537, 3068],
  "ENV-FRIENDLY-CONST-EXT-4L": [894, 1081],
  "ENV-FRIENDLY-CONST-EXT-1L": [257, 310],
  "DARK-COLOR-INT-EXT-C2-20L": [12488, 15099],
  "DARK-COLOR-INT-EXT-C2-10L": [6760, 8174],
  "DARK-COLOR-INT-EXT-C2-4L": [2707, 3273],
  "DARK-COLOR-INT-EXT-C2-1L": [679, 821],

  // Interior Emulsion
  "ECO-HG-INT-20L": [12953, 15662],
  "ECO-HG-INT-10L": [6757, 8171],
  "ECO-HG-INT-4L": [2711, 3278],
  "ECO-HG-INT-1L": [676, 818],
  "ECO-HG-NAT-INT-20L": [10765, 13016],
  "ECO-HG-NAT-INT-10L": [5722, 6919],
  "ECO-HG-NAT-INT-4L": [2419, 2925],
  "ECO-HG-NAT-INT-1L": [610, 738],
  "ENV-FRIENDLY-NAT-INT-20L": [7726, 9342],
  "ENV-FRIENDLY-NAT-INT-10L": [3959, 4788],
  "ENV-FRIENDLY-NAT-INT-4L": [1619, 1958],
  "ENV-FRIENDLY-NAT-INT-1L": [451, 545],
  "ENV-FRIENDLY-CONST-INT-20L": [4533, 5481],
  "ENV-FRIENDLY-CONST-INT-10L": [2349, 2840],
  "ENV-FRIENDLY-CONST-INT-4L": [991, 1199],
  "ENV-FRIENDLY-CONST-INT-1L": [260, 315],
  "DARK-COLOR-INT-EXT-C1-20L": [7193, 8697],
  "DARK-COLOR-INT-EXT-C1-10L": [3872, 4682],
  "DARK-COLOR-INT-EXT-C1-4L": [1623, 1963],
  "DARK-COLOR-INT-EXT-C1-1L": [417, 504],
  "ECO-INT-WALL-20L": [2973, 3594],
  "ECO-INT-WALL-10L": [1578, 1908],
  "ECO-INT-WALL-4L": [685, 828],
  "ECO-INT-WALL-1L": [195, 236],
  "ECO-HG-CEILING-WHITE-20L": [9367, 11325],
  "ECO-HG-CEILING-WHITE-10L": [5107, 6174],
  "ECO-HG-CEILING-WHITE-4L": [2044, 2478],
  "ECO-HG-CEILING-WHITE-1L": [513, 621],
  "ECO-CEILING-WHITE-20L": [3671, 4438],
  "ECO-CEILING-WHITE-10L": [2048, 2476],
  "ECO-CEILING-WHITE-4L": [823, 995],
  "ECO-CEILING-WHITE-1L": [211, 255],
  "ACRYLIC-DIST-INT-20KG": [1467, 1773],
  "ACRYLIC-DIST-INT-10KG": [749, 905],
  "ACRYLIC-DIST-INT-5KG": [382, 462],

  // Primers
  "EE-EXT-PRIMER-20L": [3382, 4089],
  "EE-EXT-PRIMER-10L": [1809, 2188],
  "EE-EXT-PRIMER-4L": [766, 926],
  "EE-EXT-PRIMER-1L": [246, 297],
  "ALKALI-RES-INT-PRIMER-20L": [2819, 3408],
  "ALKALI-RES-INT-PRIMER-10L": [1410, 1705],
  "ALKALI-RES-INT-PRIMER-4L": [669, 809],
  "ALKALI-RES-INT-PRIMER-1L": [200, 242],
  "ECO-INT-PRIMER-20L": [1701, 2057],
  "ECO-INT-PRIMER-10L": [893, 1080],
  "ECO-INT-PRIMER-4L": [447, 540],
  "ECO-INT-PRIMER-1L": [118, 143],

  // Granite Wall Textures - 2D
  "GTONE-2D-GRANITE-PRIMER-5KG": [1666, 2014],
  "GTONE-2D-INTERMEDIATE-COAT-8KG": [2996, 3622],
  "GTONE-2D-GRANITE-SURFACE-9KG": [7381, 8924],
  "GTONE-2D-DUSTPROOF-SURFACE-3KG": [1907, 2306],
  "GTONE-2D-GRANITE-SURFACE-4KG": [3335, 4032],

  // Granite Wall Textures - 3D
  "GTONE-3D-GRANITE-PRIMER-3KG": [1002, 1212],
  "GTONE-3D-INTERMEDIATE-COAT-5KG": [1876, 2269],
  "GTONE-3D-GRANITE-SURFACE-24KG": [11984, 14490],
  "GTONE-3D-DUSTPROOF-SURFACE-3KG": [1908, 2306],

  // Real Stone Paint
  "REALSTONE-PRIMER-3KG": [850, 1028],
  "REALSTONE-SURFACE-60KG": [9808, 11858],
  "REALSTONE-DUSTPROOF-3KG": [1677, 2028],

  // Granite Epoxy Floor Paint - one bundled price for the whole set
  "GRANITE-FLOOR-SET-1SET": [17977, 21735],

  // Wall Putty - same price applied to both PB and RB SKUs of each color
  "WALLPUTTY-WHITE-20KG": [529, 627],
  "WALLPUTTY-WHITE-20KG-RB": [529, 627],
  "WALLPUTTY-GRAY-20KG": [596, 707],
  "WALLPUTTY-GRAY-20KG-RB": [596, 707],

  // Primer with Enamels
  "WOOD-PRIMER-4L": [987, 1193],
  "WOOD-PRIMER-1L": [257, 311],
  "WOOD-PRIMER-500ML": [133, 160],
  "METAL-PRIMER-4L": [796, 962],
  "METAL-PRIMER-1L": [218, 264],
  "METAL-PRIMER-500ML": [109, 132],

  // Glossy Enamel group 1: White, Chocolate, Black
  "ENAMEL-G1-WHITE-4L": [2157, 2608],
  "ENAMEL-G1-WHITE-1L": [546, 660],
  "ENAMEL-G1-WHITE-500ML": [285, 344],
  "ENAMEL-G1-CHOCOLATE-4L": [2157, 2608],
  "ENAMEL-G1-CHOCOLATE-1L": [546, 660],
  "ENAMEL-G1-CHOCOLATE-500ML": [285, 344],
  "ENAMEL-G1-BLACK-4L": [2157, 2608],
  "ENAMEL-G1-BLACK-1L": [546, 660],
  "ENAMEL-G1-BLACK-500ML": [285, 344],

  // Glossy Enamel group 2: Po Red, Leaf Brown, Phiroza, Smoke Gray
  "ENAMEL-G2-PO-RED-4L": [1998, 2416],
  "ENAMEL-G2-PO-RED-1L": [507, 613],
  "ENAMEL-G2-PO-RED-500ML": [276, 334],
  "ENAMEL-G2-LEAF-BROWN-4L": [1998, 2416],
  "ENAMEL-G2-LEAF-BROWN-1L": [507, 613],
  "ENAMEL-G2-LEAF-BROWN-500ML": [276, 334],
  "ENAMEL-G2-PHIROZA-4L": [1998, 2416],
  "ENAMEL-G2-PHIROZA-1L": [507, 613],
  "ENAMEL-G2-PHIROZA-500ML": [276, 334],
  "ENAMEL-G2-SMOKE-GRAY-4L": [1998, 2416],
  "ENAMEL-G2-SMOKE-GRAY-1L": [507, 613],
  "ENAMEL-G2-SMOKE-GRAY-500ML": [276, 334],

  // Glossy Enamel group 3: Bus Green, Golden Brown, Golden Yellow
  "ENAMEL-G3-BUS-GREEN-4L": [1845, 2231],
  "ENAMEL-G3-BUS-GREEN-1L": [472, 570],
  "ENAMEL-G3-BUS-GREEN-500ML": [246, 298],
  "ENAMEL-G3-GOLDEN-BROWN-4L": [1845, 2231],
  "ENAMEL-G3-GOLDEN-BROWN-1L": [472, 570],
  "ENAMEL-G3-GOLDEN-BROWN-500ML": [246, 298],
  "ENAMEL-G3-GOLDEN-YELLOW-4L": [1845, 2231],
  "ENAMEL-G3-GOLDEN-YELLOW-1L": [472, 570],
  "ENAMEL-G3-GOLDEN-YELLOW-500ML": [246, 298],

  // Glossy Enamel group 4: Sky Blue, Olive Green, Mint Green, Oxford Blue, Deep Orange
  "ENAMEL-G4-SKY-BLUE-4L": [1630, 1971],
  "ENAMEL-G4-SKY-BLUE-1L": [419, 506],
  "ENAMEL-G4-SKY-BLUE-500ML": [214, 259],
  "ENAMEL-G4-OLIVE-GREEN-4L": [1630, 1971],
  "ENAMEL-G4-OLIVE-GREEN-1L": [419, 506],
  "ENAMEL-G4-OLIVE-GREEN-500ML": [214, 259],
  "ENAMEL-G4-MINT-GREEN-4L": [1630, 1971],
  "ENAMEL-G4-MINT-GREEN-1L": [419, 506],
  "ENAMEL-G4-MINT-GREEN-500ML": [214, 259],
  "ENAMEL-G4-OXFORD-BLUE-4L": [1630, 1971],
  "ENAMEL-G4-OXFORD-BLUE-1L": [419, 506],
  "ENAMEL-G4-OXFORD-BLUE-500ML": [214, 259],
  "ENAMEL-G4-DEEP-ORANGE-4L": [1630, 1971],
  "ENAMEL-G4-DEEP-ORANGE-1L": [419, 506],
  "ENAMEL-G4-DEEP-ORANGE-500ML": [214, 259],

  // Specialty Products
  "ALUMINUM-PAINTS-1L": [531, 642],
  "ALUMINUM-PAINTS-0_5L": [309, 373],
  "GOLD-COLOR-500ML": [1117, 1351],
  "GOLD-COLOR-200ML": [474, 573],
  "GOLD-COLOR-100ML": [262, 317],
  "TERRACOTTA-20L": [9285, 11226],
  "TERRACOTTA-10L": [5083, 6146],
  "TERRACOTTA-4L": [2036, 2462],
  "TERRACOTTA-1L": [525, 635],
  "MEITU-DAMP-PROOF-20L": [9967, 12052],
  "MEITU-DAMP-PROOF-10L": [4997, 6042],
  "MEITU-DAMP-PROOF-4L": [2040, 2467],
  "MEITU-DAMP-PROOF-1L": [519, 627],
  "PU-SILICON-EXT-INT-4L": [2523, 3051],
  "PU-SILICON-EXT-INT-1L": [699, 845],
  "PU-SILICON-EXT-INT-0_5L": [356, 431],

  // Color Tools And Accessories - single price only, no separate net price
  "TOOLS-MANUAL-MACHINE-1PC": [0, 126665],
  "TOOLS-AUTOMATIC-MACHINE-1PC": [0, 262260],
  "TOOLS-COLOR-MIXING-MACHINE-1PC": [0, 94000],
  "TOOLS-SPRAY-GUN-WITH-SET-1SET": [0, 6904],
  "TOOLS-SPRAY-GUN-HEAD-1PC": [0, 2820],
  "TOOLS-REAL-STONE-PAINT-GUN-1PC": [0, 5964],
  "TOOLS-AIR-COMPRESSOR-MACHINE-1PC": [0, 36237],
  "TOOLS-SEWING-TAPE-50M": [0, 65],
  "TOOLS-FLOOR-ROLLER-9IN-1SET": [0, 206],
  "TOOLS-FLOOR-ROLLER-4IN-1PC": [0, 49],
  "TOOLS-FLOOR-ROLLER-HANDLE-4IN-1PC": [0, 53],
  "TOOLS-REGULAR-ROLLER-9IN-1SET": [0, 94],
  "TOOLS-SAFETY-BELT-SINGLE-HOOK-1PC": [0, 1776],
  "TOOLS-SAFETY-BELT-DOUBLE-HOOK-1PC": [0, 2810],
  "TOOLS-FLOOR-PAINT-SHOES-1PAIR": [0, 1034],
  "TOOLS-PLASTIC-COVER-20M-1ROLL": [0, 150],
  "TOOLS-REGULAR-ROLLER-4IN-1PC": [0, 58],
  "TOOLS-FOAM-TAPE-2MM-3MM-1PC": [0, 97],
  "TOOLS-PUTTING-PATA-HANDLE-1PC": [0, 131],
  "TOOLS-PUTTING-KNIFE-1PC": [0, 113],
  "TOOLS-DESIGN-TAPE-50M-1SET": [0, 2491],
  "TOOLS-SCAFFOLDING-1SET": [0, 13630],
};

// "Floor Crack Seal" (2Kg, net=1447, price=1750) - no matching product
// exists in the catalog at all. Intentionally skipped.

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mode === "apply") {
    assertSafeDatabaseWrite({ mongoUri: MONGODB_URI, operation: "seed test dispatcher pricing" });
  }
  console.log(`[${mode}] ${describeDatabaseTarget(MONGODB_URI)}`);
  await mongoose.connect(MONGODB_URI);

  const dispatcher = await Dispatcher.findOne({ email: TEST_DISPATCHER_EMAIL }).select("_id companyName");
  if (!dispatcher) {
    throw new Error(`Test dispatcher not found (${TEST_DISPATCHER_EMAIL}) - run seed-test-dispatcher.js first.`);
  }
  console.log(`Target dispatcher: ${dispatcher.companyName} (${dispatcher._id})\n`);

  const skus = Object.keys(PRICING);
  const products = await Product.find({ sku: { $in: skus } }).select("_id sku name").lean();
  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const missing = skus.filter((sku) => !productBySku.has(sku));
  if (missing.length) {
    throw new Error(`These SKUs don't exist in the product catalog: ${missing.join(", ")}`);
  }

  console.log(`Rows to price: ${skus.length}`);
  skus.forEach((sku) => {
    const p = productBySku.get(sku);
    const [netPrice, price] = PRICING[sku];
    console.log(`  ${p.name} (${sku}): net=${netPrice} price=${price}`);
  });

  if (mode !== "apply") {
    console.log("\nDry run complete - re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  const items = skus.map((sku) => {
    const product = productBySku.get(sku);
    const [netPrice, price] = PRICING[sku];
    return { productId: product._id, price, netPrice };
  });

  const result = await upsertDispatcherPricing({
    dispatcherId: dispatcher._id,
    items,
    adminUser: null,
  });

  console.log(`\nDone. ${JSON.stringify(result)}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
