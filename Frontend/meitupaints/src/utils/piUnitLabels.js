// The Proforma Invoice and Order Summary PDFs used to show whatever raw
// pack.unit the product was priced in (LTRS/KGS/GM/ML/...) in their UNIT
// column - accurate, but confusing to read on a business document where
// most people expect "how many sets/pieces/bags/buckets," not a metric
// abbreviation. This maps each order line to a business-friendly label
// instead, scoped deliberately to just these two PDFs (every other surface
// in the app - catalog cards, cart lines, dealer order pages - keeps
// showing the real pack size/unit, which is what those need).
//
// Two-tier lookup: a handful of specific products inside TOOLS_AND_ACCESSORIES
// need their own label rather than that category's "pcs" default (they're
// sold as a set/pair, not individually), checked by product code before the
// category-level default applies.
const PRODUCT_CODE_OVERRIDES = {
  "TOOLS-SPRAY-GUN-WITH-SET": "set",
  "TOOLS-FLOOR-PAINT-SHOES": "pair",
  "TOOLS-SCAFFOLDING-SET": "set",
};

const CATEGORY_UNIT_LABELS = {
  // GRANITE_EPOXY_FLOOR was renamed to FLOOR_PAINT (2026-07-22); kept here
  // since historical Order line items snapshot the category value at the
  // time of purchase and are never rewritten when a live category renames.
  GRANITE_EPOXY_FLOOR: "set",
  FLOOR_PAINT: "set",
  TOOLS_AND_ACCESSORIES: "pcs",
  WALL_PUTTY: "bag",
};

// Everything else - COLORANTS, EXTERIOR_EMULSION, GRANITE_WALL,
// INTERIOR_EMULSION, PRIMERS, PRIMER_WITH_ENAMELS, SPECIALTY, and any
// legacy/uncategorized line - is a paint sold by the bucket.
const DEFAULT_UNIT_LABEL = "Bkt";

export function resolvePiUnitLabel(item) {
  const code = String(item?.code || "").trim().toUpperCase();
  if (code && PRODUCT_CODE_OVERRIDES[code]) {
    return PRODUCT_CODE_OVERRIDES[code];
  }

  const category = String(item?.category || "").trim().toUpperCase();
  if (category && CATEGORY_UNIT_LABELS[category]) {
    return CATEGORY_UNIT_LABELS[category];
  }

  return DEFAULT_UNIT_LABEL;
}
