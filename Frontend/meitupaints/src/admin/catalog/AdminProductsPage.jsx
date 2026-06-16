import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteFamilyImage,
  getProductFamilies,
  getProducts,
  uploadFamilyImage,
  uploadProductImage,
} from "../api/adminCatalogApi";
import ProductEditorModal from "./components/ProductEditorModal";
import NavBar from "../../components/NavBar";

const CATEGORY_OPTIONS = [
  "ALL",
  "EXTERIOR_PAINT",
  "INTERIOR_PAINT",
  "PRIMER",
  "DISTEMPER",
  "INTERIOR_EXTERIOR_PAINT",
  "CEILING_WHITE",
  "SPECIALTY",
  "ENAMEL",
  "ENAMEL_PRIMER",
  "LIQUID_GRANITE_GTONE_2D",
  "LIQUID_GRANITE_GTONE_3D",
  "REAL_STONE",
  "WALL_PUTTY",
  "GRANITE_FLOOR",
  "TOOLS_ACCESSORIES",
];

const CATEGORY_DIVISIONS = [
  {
    key: "core",
    label: "Core Paint Systems",
    shortLabel: "Core",
    description: "Interior, exterior, primer, distemper and ceiling systems.",
    categories: [
      "EXTERIOR_PAINT",
      "INTERIOR_PAINT",
      "PRIMER",
      "DISTEMPER",
      "INTERIOR_EXTERIOR_PAINT",
      "CEILING_WHITE",
    ],
  },
  {
    key: "decorative",
    label: "Decorative & Texture",
    shortLabel: "Decorative",
    description:
      "Liquid granite, real stone, specialty finishes and floor systems.",
    categories: [
      "SPECIALTY",
      "LIQUID_GRANITE_GTONE_2D",
      "LIQUID_GRANITE_GTONE_3D",
      "REAL_STONE",
      "GRANITE_FLOOR",
    ],
  },
  {
    key: "protective",
    label: "Enamel & Primers",
    shortLabel: "Enamel",
    description:
      "Wood and metal primers, enamel shade groups and solvent-led products.",
    categories: ["ENAMEL", "ENAMEL_PRIMER"],
  },
  {
    key: "auxiliary",
    label: "Putty, Tools & Accessories",
    shortLabel: "Auxiliary",
    description:
      "Wall putty, machines, rollers, brushes, tapes and support tools.",
    categories: ["WALL_PUTTY", "TOOLS_ACCESSORIES"],
  },
];

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  if (value === "ALL") return "All categories";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function divisionForCategory(category) {
  return (
    CATEGORY_DIVISIONS.find((division) =>
      division.categories.includes(category || ""),
    ) || {
      key: "other",
      label: "Other Products",
      shortLabel: "Other",
      description: "Unmapped or uncategorized catalog entries.",
      categories: [],
    }
  );
}

function groupProductsByCode(products) {
  const map = new Map();

  for (const product of products) {
    const key = product.code;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(product);
  }

  return map;
}

function buildCatalogEntries(families, groupedProducts) {
  const entries = [];
  const familyCodes = new Set();

  for (const family of families) {
    const code = family.code;
    familyCodes.add(code);

    entries.push({
      _id: family._id || code,
      familyId: family._id || null,
      code,
      name: family.name,
      category: family.category || "",
      description: family.description || "",
      familyImages: family.images || [],
      isFallback: false,
      variants: groupedProducts.get(code) || [],
    });
  }

  for (const [code, variants] of groupedProducts.entries()) {
    if (familyCodes.has(code)) continue;

    const first = variants[0] || {};
    entries.push({
      _id: `fallback-${code}`,
      familyId: null,
      code,
      name: first.name || code,
      category: first.category || "",
      description: first.description || "",
      familyImages: [],
      isFallback: true,
      variants,
    });
  }

  return entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function getStartingPrice(product) {
  const firstTier = product?.pricing?.tiers?.[0];
  return (
    firstTier?.pricePerPack ??
    firstTier?.priceInclTax ??
    firstTier?.priceExclTax ??
    null
  );
}

function getTierSummary(product) {
  const tiers = product?.pricing?.tiers || [];
  if (!tiers.length) return "Flat";
  if (tiers.length === 1) return tiers[0]?.label || "Flat";
  return `${tiers.length} tiers`;
}

function getPackSummary(variants) {
  if (!variants.length) return "—";

  return variants
    .map((variant) => variant?.pack?.label)
    .filter(Boolean)
    .join(" · ");
}

function getLowestPrice(variants) {
  const prices = variants.flatMap((variant) => {
    const tiers = variant?.pricing?.tiers || [];

    if (!tiers.length) {
      const startingPrice = getStartingPrice(variant);
      return typeof startingPrice === "number" ? [startingPrice] : [];
    }

    return tiers
      .map(
        (tier) =>
          tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax,
      )
      .filter((value) => typeof value === "number");
  });

  if (!prices.length) return null;
  return Math.min(...prices);
}

function getHighestPrice(variants) {
  const prices = variants.flatMap((variant) =>
    (variant?.pricing?.tiers || [])
      .map(
        (tier) =>
          tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax,
      )
      .filter((value) => typeof value === "number"),
  );

  if (!prices.length) return null;
  return Math.max(...prices);
}

function formatMoney(value, currency = "NPR") {
  if (typeof value !== "number") return "—";
  return `${currency} ${value.toLocaleString()}`;
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function getEntryMeta(entry) {
  const division = divisionForCategory(entry.category);
  const variants = entry.variants || [];
  const inactiveCount = variants.filter(
    (item) => item?.isActive === false,
  ).length;
  const liveCount = variants.length - inactiveCount;
  const lowestPrice = getLowestPrice(variants);
  const highestPrice = getHighestPrice(variants);

  return {
    division,
    inactiveCount,
    liveCount,
    lowestPrice,
    highestPrice,
    packs: getPackSummary(variants),
  };
}

function Surface({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 24,
        background: "rgba(255,255,255,.9)",
        border: "1px solid rgba(15,23,42,.06)",
        boxShadow: "0 18px 45px rgba(15,23,42,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function BlurLayer({ active, children, style = {} }) {
  return (
    <div
      style={{
        transition: "filter .24s ease, opacity .24s ease, transform .24s ease",
        filter: active ? "blur(10px) saturate(.92)" : "none",
        opacity: active ? 0.7 : 1,
        pointerEvents: active ? "none" : "auto",
        userSelect: active ? "none" : "auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SubtleButton({
  children,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  style = {},
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 14,
        border: danger
          ? "1px solid rgba(180,35,24,.12)"
          : active
            ? "1px solid rgba(180,35,24,.14)"
            : "1px solid rgba(15,23,42,.08)",
        background: danger
          ? "rgba(180,35,24,.06)"
          : active
            ? "rgba(180,35,24,.07)"
            : "#fff",
        color: danger ? "#b42318" : active ? "#b42318" : "#0f172a",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "all .18s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  style = {},
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44,
        padding: "0 16px",
        borderRadius: 14,
        border: "1px solid rgba(180,35,24,.18)",
        background: "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)",
        color: "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: "0 12px 28px rgba(180,35,24,.18)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SearchInput({ value, onChange, onClear }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 46,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: "0 14px",
      }}
    >
      <span style={{ fontWeight: 900, color: "rgba(15,23,42,.42)" }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search product, code, SKU, pack"
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(15,23,42,.08)",
            background: "rgba(248,250,252,.95)",
            color: "rgba(15,23,42,.58)",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 46,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: "0 12px",
        fontSize: 14,
        fontWeight: 700,
        color: "#0f172a",
        outline: "none",
      }}
    >
      {options.map((option) => {
        const normalized =
          typeof option === "string"
            ? { value: option, label: categoryLabel(option) }
            : option;

        return (
          <option key={normalized.value} value={normalized.value}>
            {normalized.label}
          </option>
        );
      })}
    </select>
  );
}

function LoadingGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 18,
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Surface key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 220,
              borderRadius: 20,
              background:
                "linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9))",
            }}
          />
        </Surface>
      ))}
    </div>
  );
}

function StatChip({ label, value, tone = "default" }) {
  const tones = {
    default: {
      background: "rgba(15,23,42,.05)",
      color: "#0f172a",
      border: "1px solid rgba(15,23,42,.06)",
    },
    accent: {
      background: "rgba(180,35,24,.08)",
      color: "#b42318",
      border: "1px solid rgba(180,35,24,.12)",
    },
    success: {
      background: "rgba(22,163,74,.08)",
      color: "#15803d",
      border: "1px solid rgba(22,163,74,.12)",
    },
  };

  const palette = tones[tone] || tones.default;

  return (
    <div
      style={{
        minHeight: 56,
        padding: "10px 12px",
        borderRadius: 16,
        background: palette.background,
        color: palette.color,
        border: palette.border,
        display: "grid",
        alignContent: "space-between",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 900,
          opacity: 0.7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ImagePreview({ image, label = "No image", height = 88 }) {
  return (
    <div
      style={{
        width: height,
        height,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(15,23,42,.08)",
        background:
          "linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {image?.url ? (
        <img
          src={image.url}
          alt={image.alt || label}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: "#fff",
          }}
        />
      ) : (
        <div
          style={{
            padding: 10,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(15,23,42,.42)",
            lineHeight: 1.4,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function ImageViewerModal({ open, image, title, onClose }) {
  if (!open || !image?.url) return null;

  return (
    <div
      className="catalog-detail-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15,23,42,.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 28,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1100px, 92vw)",
          maxHeight: "88vh",
          borderRadius: 28,
          overflow: "hidden",
          background: "rgba(255,255,255,.96)",
          border: "1px solid rgba(255,255,255,.65)",
          boxShadow: "0 24px 80px rgba(15,23,42,.28)",
          display: "grid",
          gridTemplateRows: "auto minmax(0,1fr)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid rgba(15,23,42,.08)",
            background: "rgba(248,250,252,.92)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title || image.alt || "Product image"}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(15,23,42,.56)",
              }}
            >
              Full preview
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              color: "#0f172a",
              fontSize: 20,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 20,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))",
          }}
        >
          <img
            src={image.url}
            alt={image.alt || title || "Product image"}
            style={{
              maxWidth: "100%",
              maxHeight: "calc(88vh - 110px)",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
              borderRadius: 22,
              boxShadow: "0 22px 54px rgba(15,23,42,.16)",
              background: "#fff",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CompactVariantRow({
  variant,
  onEditProduct,
  onUploadVariantImage,
  uploadingVariantId,
}) {
  const startingPrice = getStartingPrice(variant);
  const inactive = variant?.isActive === false;
  const variantPrimaryImage = getPrimaryImage(variant?.images || []);
  const isUploading = uploadingVariantId === variant._id;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px minmax(0,1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: 12,
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,.06)",
        background: inactive ? "rgba(248,250,252,.92)" : "#fff",
      }}
    >
      <ImagePreview image={variantPrimaryImage} label="Variant" height={64} />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            {variant?.pack?.label || "—"}
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 24,
              padding: "0 8px",
              borderRadius: 999,
              background: inactive
                ? "rgba(15,23,42,.06)"
                : "rgba(22,163,74,.08)",
              color: inactive ? "#475569" : "#15803d",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {inactive ? "Inactive" : "Live"}
          </span>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.7)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {variant?.sku || "SKU unavailable"}
        </div>

        <div
          style={{
            marginTop: 6,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.58)",
          }}
        >
          <span>{getTierSummary(variant)}</span>
          <span>•</span>
          <span>{formatMoney(startingPrice, variant?.currency || "NPR")}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <SubtleButton
          onClick={() => onUploadVariantImage(variant)}
          disabled={isUploading}
          style={{ height: 34, borderRadius: 12, padding: "0 12px" }}
        >
          {isUploading
            ? "Uploading..."
            : variantPrimaryImage
              ? "Replace image"
              : "Upload image"}
        </SubtleButton>
        <SubtleButton
          onClick={() => onEditProduct(variant)}
          style={{ height: 34, borderRadius: 12, padding: "0 12px" }}
        >
          Edit
        </SubtleButton>
      </div>
    </div>
  );
}

function MinimalCatalogCard({ entry, onOpen, onViewImage }) {
  const meta = getEntryMeta(entry);
  const familyPrimaryImage = getPrimaryImage(entry.familyImages || []);
  const productPrimaryImage = getPrimaryImage(
    entry.variants?.[0]?.images || [],
  );
  const heroImage = familyPrimaryImage || productPrimaryImage;

  return (
    <article
      style={{
        width: "100%",
        border: "1px solid rgba(15,23,42,.06)",
        background: "#fff",
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 12,
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        transition:
          "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-1px)";
        event.currentTarget.style.boxShadow = "0 18px 44px rgba(15,23,42,.08)";
        event.currentTarget.style.borderColor = "rgba(180,35,24,.12)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,.04)";
        event.currentTarget.style.borderColor = "rgba(15,23,42,.06)";
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onOpen(entry);
        }}
        style={{
          width: "322.664px",
          height: "270.484px",
          maxWidth: "100%",
          justifySelf: "center",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(15,23,42,.06)",
          background:
            "linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        {heroImage?.url ? (
          <img
            src={heroImage.url}
            alt={heroImage.alt || entry.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              background: "#fff",
            }}
          />
        ) : (
          <div
            style={{
              padding: 18,
              textAlign: "center",
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 850,
              color: "rgba(15,23,42,.42)",
            }}
          >
            Product preview
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10, padding: "2px 2px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 24,
              padding: "0 9px",
              borderRadius: 999,
              background: "rgba(15,23,42,.05)",
              color: "rgba(15,23,42,.56)",
              fontSize: 10,
              fontWeight: 950,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            {meta.division.shortLabel}
          </span>

          {entry.isFallback ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 24,
                padding: "0 9px",
                borderRadius: 999,
                background: "rgba(180,35,24,.08)",
                color: "#b42318",
                fontSize: 10,
                fontWeight: 950,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Missing family
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpen(entry)}
          style={{
            border: 0,
            background: "transparent",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: 20,
              lineHeight: 1.1,
              fontWeight: 950,
              letterSpacing: "-0.04em",
              color: "#0f172a",
            }}
          >
            {entry.name}
          </div>
          <div
            style={{
              marginTop: 7,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 12,
              fontWeight: 750,
              color: "rgba(15,23,42,.55)",
            }}
          >
            <span>{entry.code}</span>
            <span>•</span>
            <span>{categoryLabel(entry.category)}</span>
          </div>
        </button>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            paddingTop: 2,
          }}
        >
          <SubtleButton
            onClick={() => onOpen(entry)}
            style={{ height: 36, borderRadius: 12, padding: "0 12px" }}
          >
            View details
          </SubtleButton>
          <SubtleButton
            onClick={() => {
              if (heroImage?.url) {
                onViewImage?.(
                  heroImage,
                  `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`,
                );
              }
            }}
            disabled={!heroImage?.url}
            style={{ height: 36, borderRadius: 12, padding: "0 12px" }}
          >
            Preview image
          </SubtleButton>
        </div>
      </div>
    </article>
  );
}

function CatalogSidebar({
  divisions,
  divisionCounts,
  categoryCounts,
  divisionFilter,
  categoryFilter,
  totalFamilies,
  totalVariants,
  liveVariants,
  fallbackFamilies,
  onDivisionChange,
  onCategoryChange,
  onCreateProduct,
  onReset,
}) {
  return (
    <aside className="catalog-rail" aria-label="Catalog navigation">
      <div className="catalog-rail-head">
        <div className="catalog-eyebrow">Meitu Catalog</div>
        <div className="catalog-rail-title">Admin Products</div>
        <div className="catalog-rail-subtitle">
          Product families, SKU variants, pricing, and media.
        </div>
      </div>

      <div className="catalog-rail-actions">
        <PrimaryButton onClick={onCreateProduct} style={{ width: "100%" }}>
          Add Product
        </PrimaryButton>
        <SubtleButton onClick={onReset} style={{ width: "100%" }}>
          Reset View
        </SubtleButton>
      </div>

      <nav className="catalog-nav" aria-label="Product divisions">
        <div className="catalog-nav-group">
          <div className="catalog-nav-label">Divisions</div>
          <button
            type="button"
            className={`catalog-nav-item ${divisionFilter === "ALL" ? "active" : ""}`}
            onClick={() => onDivisionChange("ALL")}
          >
            <span>All Products</span>
            <strong>{totalFamilies}</strong>
          </button>
          {divisions.map((division) => (
            <button
              type="button"
              key={division.key}
              className={`catalog-nav-item ${
                divisionFilter === division.key ? "active" : ""
              }`}
              onClick={() => {
                onDivisionChange(division.key);
                onCategoryChange("ALL");
              }}
            >
              <span>{division.label}</span>
              <strong>{divisionCounts.get(division.key) || 0}</strong>
            </button>
          ))}
        </div>

        <div className="catalog-nav-group">
          <div className="catalog-nav-label">Categories</div>
          <button
            type="button"
            className={`catalog-nav-item ${categoryFilter === "ALL" ? "active" : ""}`}
            onClick={() => onCategoryChange("ALL")}
          >
            <span>All Categories</span>
            <strong>{totalFamilies}</strong>
          </button>
          {CATEGORY_OPTIONS.filter((category) => category !== "ALL").map(
            (category) => (
              <button
                type="button"
                key={category}
                className={`catalog-nav-item ${
                  categoryFilter === category ? "active" : ""
                }`}
                onClick={() => onCategoryChange(category)}
              >
                <span>{categoryLabel(category)}</span>
                <strong>{categoryCounts.get(category) || 0}</strong>
              </button>
            ),
          )}
        </div>
      </nav>

      <div className="catalog-rail-summary">
        <div className="catalog-nav-label">Catalog Health</div>
        <div className="catalog-health-grid">
          <div>
            <span>Variants</span>
            <strong>{totalVariants}</strong>
          </div>
          <div>
            <span>Live</span>
            <strong>{liveVariants}</strong>
          </div>
          <div>
            <span>Fallback</span>
            <strong>{fallbackFamilies}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CatalogMobileNav({
  divisions,
  divisionCounts,
  divisionFilter,
  totalFamilies,
  onDivisionChange,
}) {
  return (
    <div className="catalog-mobile-nav" aria-label="Product divisions">
      <button
        type="button"
        className={divisionFilter === "ALL" ? "active" : ""}
        onClick={() => onDivisionChange("ALL")}
      >
        All <span>{totalFamilies}</span>
      </button>
      {divisions.map((division) => (
        <button
          type="button"
          key={division.key}
          className={divisionFilter === division.key ? "active" : ""}
          onClick={() => onDivisionChange(division.key)}
        >
          {division.shortLabel} <span>{divisionCounts.get(division.key) || 0}</span>
        </button>
      ))}
    </div>
  );
}

function CatalogControls({
  search,
  onSearchChange,
  onSearchClear,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  categoryFilter,
  onCategoryChange,
  onReset,
}) {
  return (
    <Surface style={{ padding: 14, boxShadow: "none", borderRadius: 16 }}>
      <div className="catalog-controls">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          onClear={onSearchClear}
        />
        <SelectField
          value={categoryFilter}
          onChange={onCategoryChange}
          options={CATEGORY_OPTIONS}
        />
        <SelectField
          value={statusFilter}
          onChange={onStatusChange}
          options={[
            { value: "ALL", label: "All status" },
            { value: "ACTIVE", label: "Active only" },
            { value: "INACTIVE", label: "Inactive only" },
            { value: "MISSING_FAMILY", label: "Missing family" },
          ]}
        />
        <SelectField
          value={sortBy}
          onChange={onSortChange}
          options={[
            { value: "NAME_ASC", label: "Sort by name" },
            { value: "UPDATED_DESC", label: "Recently updated" },
            { value: "VARIANTS_DESC", label: "Most variants" },
            { value: "PRICE_ASC", label: "Lowest price" },
          ]}
        />
        <SubtleButton
          danger
          onClick={onReset}
          style={{ height: 46, borderRadius: 14, padding: "0 14px" }}
        >
          Reset
        </SubtleButton>
      </div>
    </Surface>
  );
}

function CatalogWorkspaceStyles() {
  return (
    <style>{`
      .catalog-shell{
        --catalog-nav-height:70px;
        --catalog-rail-width:310px;
        height:calc(100dvh - var(--catalog-nav-height));
        margin-top:var(--catalog-nav-height);
        min-height:0;
        display:grid;
        grid-template-columns:var(--catalog-rail-width) minmax(0,1fr);
        overflow:hidden;
        background:linear-gradient(180deg,#fafafc 0%,#f5f6f8 100%);
        color:#0f172a;
      }

      body.meitu-catalog-editor-open .apple-nav{
        filter:blur(12px) saturate(.82);
        opacity:.34;
        pointer-events:none;
        z-index:100 !important;
        transition:filter .2s ease, opacity .2s ease;
      }

      .catalog-rail{
        height:100%;
        min-height:0;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        border-right:1px solid rgba(15,23,42,.09);
        background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(248,250,252,.96));
        padding:0 16px 16px 22px;
      }

      .catalog-rail-head{
        padding:0 10px 14px;
        border-bottom:1px solid rgba(15,23,42,.08);
      }

      .catalog-eyebrow{
        font-size:11px;
        font-weight:950;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:rgba(15,23,42,.44);
      }

      .catalog-rail-title{
        margin-top:8px;
        font-size:22px;
        line-height:1.1;
        font-weight:950;
        letter-spacing:-.03em;
      }

      .catalog-rail-subtitle,
      .catalog-subtitle{
        margin:8px 0 0;
        font-size:13px;
        line-height:1.65;
        font-weight:700;
        color:rgba(15,23,42,.58);
      }

      .catalog-rail-actions{
        display:grid;
        gap:8px;
        padding:14px 10px;
        border-bottom:1px solid rgba(15,23,42,.08);
      }

      .catalog-nav{
        flex:1 1 auto;
        min-height:0;
        overflow-y:auto;
        padding:14px 0;
        display:grid;
        gap:22px;
        scrollbar-width:none;
      }

      .catalog-nav::-webkit-scrollbar{ width:0; height:0; }

      .catalog-nav-group{ display:grid; gap:6px; }

      .catalog-nav-label{
        padding:0 10px;
        font-size:11px;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:rgba(15,23,42,.42);
      }

      .catalog-nav-item{
        width:100%;
        min-height:42px;
        border:0;
        border-left:3px solid transparent;
        border-radius:0 12px 12px 0;
        background:transparent;
        color:#0f172a;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        padding:8px 10px 8px 12px;
        text-align:left;
        cursor:pointer;
        transition:background .16s ease,color .16s ease,border-color .16s ease;
      }

      .catalog-nav-item:hover{ background:rgba(15,23,42,.045); }
      .catalog-nav-item.active{
        border-left-color:#b42318;
        background:rgba(180,35,24,.075);
        color:#b42318;
      }
      .catalog-nav-item span{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:13px;
        font-weight:900;
      }
      .catalog-nav-item strong{
        min-width:28px;
        height:22px;
        padding:0 7px;
        border-radius:999px;
        background:rgba(15,23,42,.07);
        color:rgba(15,23,42,.62);
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:10px;
        font-weight:950;
      }
      .catalog-nav-item.active strong{
        background:rgba(180,35,24,.12);
        color:#b42318;
      }

      .catalog-rail-summary{
        flex:0 0 auto;
        padding:12px 10px 0;
        border-top:1px solid rgba(15,23,42,.08);
      }

      .catalog-health-grid{
        margin-top:10px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }
      .catalog-health-grid div{
        border-radius:12px;
        background:rgba(15,23,42,.045);
        padding:9px 8px;
        display:grid;
        gap:4px;
      }
      .catalog-health-grid span{
        font-size:10px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.08em;
        color:rgba(15,23,42,.42);
      }
      .catalog-health-grid strong{
        font-size:16px;
        font-weight:950;
      }

      .catalog-main{
        min-width:0;
        min-height:0;
        height:100%;
        overflow-y:auto;
        overflow-x:hidden;
        overscroll-behavior:contain;
        scrollbar-gutter:stable;
        padding:24px 32px 48px;
      }

      .catalog-content{
        width:min(100%,1460px);
        display:grid;
        gap:18px;
      }

      .catalog-title{
        margin:8px 0 0;
        font-size:38px;
        line-height:1;
        font-weight:950;
        letter-spacing:-.055em;
      }

      .catalog-header-grid{
        display:grid;
        grid-template-columns:minmax(0,1.25fr) minmax(360px,.85fr);
        gap:20px;
        align-items:start;
      }

      .catalog-header-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:18px;
      }

      .catalog-metrics{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .catalog-controls{
        display:grid;
        grid-template-columns:minmax(260px,1fr) minmax(180px,.55fr) minmax(160px,.42fr) minmax(160px,.42fr) auto;
        gap:10px;
        align-items:center;
      }

      .catalog-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:16px;
      }

      .catalog-mobile-nav{ display:none; }

      @media (max-width:1280px){
        .catalog-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
        .catalog-header-grid{ grid-template-columns:1fr; }
      }

      @media (max-width:1100px){
        .catalog-shell{
          display:block;
          height:auto;
          min-height:calc(100dvh - var(--catalog-nav-height));
          overflow:visible;
        }
        .catalog-rail{ display:none; }
        .catalog-main{
          height:auto;
          min-height:calc(100dvh - var(--catalog-nav-height));
          overflow:visible;
          padding:18px 18px 42px;
        }
        .catalog-mobile-nav{
          position:sticky;
          top:0;
          z-index:40;
          margin:-18px -18px 18px;
          padding:10px 18px;
          display:flex;
          gap:8px;
          overflow-x:auto;
          border-bottom:1px solid rgba(15,23,42,.08);
          background:rgba(248,250,252,.94);
          backdrop-filter:blur(16px);
          -webkit-backdrop-filter:blur(16px);
        }
        .catalog-mobile-nav button{
          min-width:max-content;
          min-height:38px;
          border-radius:999px;
          border:1px solid rgba(15,23,42,.08);
          background:#fff;
          color:#0f172a;
          padding:0 12px;
          font-size:13px;
          font-weight:900;
        }
        .catalog-mobile-nav button.active{
          border-color:rgba(180,35,24,.18);
          background:rgba(180,35,24,.08);
          color:#b42318;
        }
        .catalog-mobile-nav span{
          margin-left:6px;
          opacity:.65;
        }
        .catalog-controls{
          grid-template-columns:1fr 1fr;
        }
      }

      @media (max-width:720px){
        .catalog-shell{
          --catalog-nav-height:64px;
        }
        .catalog-main{ padding:14px 14px 36px; }
        .catalog-mobile-nav{
          margin-left:-14px;
          margin-right:-14px;
          padding-left:14px;
          padding-right:14px;
        }
        .catalog-title{ font-size:30px; }
        .catalog-metrics,
        .catalog-controls,
        .catalog-grid{
          grid-template-columns:1fr;
        }
        .catalog-controls input,
        .catalog-controls select,
        .catalog-controls button{
          width:100%;
          min-width:0;
        }
      }

      @media (max-width:420px){
        .catalog-main{ padding:12px 10px 30px; }
        .catalog-mobile-nav{
          margin-left:-10px;
          margin-right:-10px;
          padding-left:10px;
          padding-right:10px;
        }
      }
    `}</style>
  );
}

function CatalogDetailModal({
  open,
  entry,
  onClose,
  onAddVariant,
  onEditProduct,
  onUploadFamilyImage,
  onRemoveFamilyImage,
  onUploadVariantImage,
  onViewImage,
  uploadingFamilyCode,
  removingFamilyCode,
  uploadingVariantId,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [open, entry?._id]);

  if (!open || !entry) return null;

  const meta = getEntryMeta(entry);
  const familyPrimaryImage = getPrimaryImage(entry.familyImages || []);
  const productPrimaryImage = getPrimaryImage(
    entry.variants?.[0]?.images || [],
  );
  const heroImage = familyPrimaryImage || productPrimaryImage;
  const isUploadingFamily = uploadingFamilyCode === entry.code;
  const isRemovingFamily = removingFamilyCode === entry.code;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1350,
        background: "rgba(15,23,42,.42)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        className="catalog-detail-dialog"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1180px, 96vw)",
          maxHeight: "88vh",
          overflow: "auto",
          borderRadius: 30,
          background: "rgba(255,255,255,.96)",
          border: "1px solid rgba(255,255,255,.7)",
          boxShadow: "0 32px 100px rgba(15,23,42,.22)",
          padding: 22,
          display: "grid",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                padding: "7px 11px",
                borderRadius: 999,
                background: "rgba(15,23,42,.05)",
                color: "rgba(15,23,42,.58)",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Product Workspace
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 30,
                fontWeight: 950,
                letterSpacing: "-0.05em",
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              {entry.name}
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(15,23,42,.58)",
              }}
            >
              <span>{entry.code}</span>
              <span>•</span>
              <span>{categoryLabel(entry.category)}</span>
              <span>•</span>
              <span>{meta.division.label}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.08)",
              background: "#fff",
              color: "#0f172a",
              fontSize: 20,
              fontWeight: 900,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div
          className="catalog-detail-body"
          style={{
            display: "grid",
            gridTemplateColumns: "360px minmax(0,1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Surface style={{ padding: 16, boxShadow: "none" }}>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (heroImage?.url) {
                      onViewImage?.(
                        heroImage,
                        `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`,
                      );
                    }
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    textAlign: "left",
                    cursor: heroImage?.url ? "zoom-in" : "default",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 24,
                      overflow: "hidden",
                      border: "1px solid rgba(15,23,42,.08)",
                      background:
                        "linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {heroImage?.url ? (
                      <img
                        src={heroImage.url}
                        alt={heroImage.alt || entry.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                          background: "#fff",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: 18,
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "rgba(15,23,42,.42)",
                        }}
                      >
                        No preview image
                      </div>
                    )}
                  </div>
                </button>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <StatChip label="Variants" value={entry.variants.length} />
                  <StatChip
                    label="Live"
                    value={meta.liveCount}
                    tone="success"
                  />
                  <StatChip
                    label="From"
                    value={formatMoney(meta.lowestPrice)}
                  />
                  <StatChip
                    label="To"
                    value={formatMoney(meta.highestPrice)}
                    tone="accent"
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <SubtleButton
                    onClick={() => {
                      if (heroImage?.url) {
                        onViewImage?.(
                          heroImage,
                          `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`,
                        );
                      }
                    }}
                    disabled={!heroImage?.url}
                    style={{ flex: 1, minWidth: 140 }}
                  >
                    View image
                  </SubtleButton>
                  <PrimaryButton
                    onClick={() => onUploadFamilyImage(entry)}
                    disabled={
                      !entry.familyId || isUploadingFamily || isRemovingFamily
                    }
                    style={{ flex: 1, minWidth: 160 }}
                  >
                    {isUploadingFamily
                      ? "Uploading..."
                      : familyPrimaryImage
                        ? "Replace family image"
                        : "Upload family image"}
                  </PrimaryButton>
                  {familyPrimaryImage?.publicId ? (
                    <SubtleButton
                      danger
                      onClick={() => onRemoveFamilyImage(entry)}
                      disabled={isUploadingFamily || isRemovingFamily}
                      style={{ flex: 1, minWidth: 150 }}
                    >
                      {isRemovingFamily ? "Removing..." : "Remove image"}
                    </SubtleButton>
                  ) : null}
                </div>

                {entry.isFallback ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(180,35,24,.06)",
                      border: "1px solid rgba(180,35,24,.12)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#b42318",
                      lineHeight: 1.55,
                    }}
                  >
                    This product code has no family record yet. Create or seed
                    the family first if you want dealers to inherit family-level
                    imagery.
                  </div>
                ) : null}
              </div>
            </Surface>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <Surface style={{ padding: 18, boxShadow: "none" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#0f172a",
                    }}
                  >
                    Family overview
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      lineHeight: 1.65,
                      fontWeight: 600,
                      color: "rgba(15,23,42,.58)",
                      maxWidth: 700,
                    }}
                  >
                    {entry.description ||
                      "No family description available yet for this product group."}
                  </div>
                </div>

                <SubtleButton onClick={() => onAddVariant(entry)}>
                  Add variant
                </SubtleButton>
              </div>
            </Surface>

            <Surface style={{ padding: 18, boxShadow: "none" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#0f172a",
                    }}
                  >
                    Variant management
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(15,23,42,.55)",
                    }}
                  >
                    Edit SKU-level details, upload product images, and manage
                    pack-level pricing entries.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {entry.variants.length ? (
                  entry.variants.map((variant) => (
                    <CompactVariantRow
                      key={variant._id}
                      variant={variant}
                      onEditProduct={onEditProduct}
                      onUploadVariantImage={onUploadVariantImage}
                      uploadingVariantId={uploadingVariantId}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: "1px solid rgba(15,23,42,.06)",
                      background: "rgba(248,250,252,.72)",
                      fontWeight: 700,
                      color: "rgba(15,23,42,.58)",
                    }}
                  >
                    No variants found for this family.
                  </div>
                )}
              </div>
            </Surface>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width:780px){
          .catalog-detail-overlay{
            padding:10px !important;
            place-items:stretch !important;
          }
          .catalog-detail-dialog{
            width:100% !important;
            max-height:calc(100dvh - 20px) !important;
            border-radius:22px !important;
            padding:14px !important;
          }
          .catalog-detail-body{
            grid-template-columns:1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function AdminProductsPage() {
  const [families, setFamilies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NAME_ASC");
  const [activeEntry, setActiveEntry] = useState(null);
  const [uploadingFamilyCode, setUploadingFamilyCode] = useState(null);
  const [removingFamilyCode, setRemovingFamilyCode] = useState(null);
  const [uploadingVariantId, setUploadingVariantId] = useState(null);
  const [viewerState, setViewerState] = useState({
    open: false,
    image: null,
    title: "",
  });

  useEffect(() => {
    document.body.classList.toggle("meitu-catalog-editor-open", showModal);
    return () => {
      document.body.classList.remove("meitu-catalog-editor-open");
    };
  }, [showModal]);

  const applyCatalogData = useCallback((familyData, productData) => {
    setFamilies(familyData);
    setProducts(productData);

    const nextEntries = buildCatalogEntries(
      familyData,
      groupProductsByCode(productData),
    );

    setActiveEntry((current) => {
      if (!current) return current;
      return (
        nextEntries.find(
          (entry) =>
            entry._id === current._id ||
            (entry.familyId &&
              current.familyId &&
              entry.familyId === current.familyId) ||
            entry.code === current.code,
        ) || null
      );
    });
  }, []);

  async function reloadData() {
    try {
      setLoading(true);
      const [familyData, productData] = await Promise.all([
        getProductFamilies(),
        getProducts(),
      ]);
      applyCatalogData(familyData, productData);
    } catch (error) {
      console.error("Admin catalog reload error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const [familyData, productData] = await Promise.all([
          getProductFamilies(),
          getProducts(),
        ]);

        if (!alive) return;
        applyCatalogData(familyData, productData);
      } catch (error) {
        console.error("Admin catalog load error:", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [applyCatalogData]);

  const groupedProducts = useMemo(
    () => groupProductsByCode(products),
    [products],
  );

  const catalogEntries = useMemo(
    () => buildCatalogEntries(families, groupedProducts),
    [families, groupedProducts],
  );

  useEffect(() => {
    if (!activeEntry?.code) return;

    const nextActiveEntry = catalogEntries.find(
      (entry) => entry.code === activeEntry.code,
    );

    if (!nextActiveEntry) {
      setActiveEntry(null);
      return;
    }

    if (nextActiveEntry !== activeEntry) {
      setActiveEntry(nextActiveEntry);
    }
  }, [catalogEntries, activeEntry]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();

    const scoped = catalogEntries.filter((entry) => {
      const division = divisionForCategory(entry.category);
      const categoryOk =
        categoryFilter === "ALL" ? true : entry.category === categoryFilter;
      const divisionOk =
        divisionFilter === "ALL" ? true : division.key === divisionFilter;
      const meta = getEntryMeta(entry);
      const statusOk =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
            ? meta.liveCount > 0
            : statusFilter === "INACTIVE"
              ? meta.liveCount === 0
              : statusFilter === "MISSING_FAMILY"
                ? entry.isFallback
                : true;

      const queryOk = q
        ? [
            entry.name,
            entry.code,
            entry.category,
            entry.description,
            ...entry.variants.flatMap((variant) => [
              variant?.sku,
              variant?.pack?.label,
              variant?.pricing?.model,
            ]),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;

      return categoryOk && divisionOk && statusOk && queryOk;
    });

    return [...scoped].sort((a, b) => {
      if (sortBy === "UPDATED_DESC") {
        const aUpdated = Math.max(
          ...[a, ...(a.variants || [])].map((item) =>
            Number.isFinite(
              new Date(item?.updatedAt || item?.createdAt || 0).getTime(),
            )
              ? new Date(item?.updatedAt || item?.createdAt || 0).getTime()
              : 0,
          ),
          0,
        );
        const bUpdated = Math.max(
          ...[b, ...(b.variants || [])].map((item) =>
            Number.isFinite(
              new Date(item?.updatedAt || item?.createdAt || 0).getTime(),
            )
              ? new Date(item?.updatedAt || item?.createdAt || 0).getTime()
              : 0,
          ),
          0,
        );
        return bUpdated - aUpdated;
      }

      if (sortBy === "VARIANTS_DESC") {
        return (b.variants?.length || 0) - (a.variants?.length || 0);
      }

      if (sortBy === "PRICE_ASC") {
        const aPrice = getEntryMeta(a).lowestPrice ?? Number.POSITIVE_INFINITY;
        const bPrice = getEntryMeta(b).lowestPrice ?? Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      }

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [
    catalogEntries,
    search,
    categoryFilter,
    divisionFilter,
    statusFilter,
    sortBy,
  ]);

  const divisionCounts = useMemo(() => {
    const counts = new Map();
    CATEGORY_DIVISIONS.forEach((division) => counts.set(division.key, 0));
    counts.set("other", 0);

    for (const entry of catalogEntries) {
      const division = divisionForCategory(entry.category);
      counts.set(division.key, (counts.get(division.key) || 0) + 1);
    }

    return counts;
  }, [catalogEntries]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    CATEGORY_OPTIONS.forEach((category) => {
      if (category !== "ALL") counts.set(category, 0);
    });

    for (const entry of catalogEntries) {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    }

    return counts;
  }, [catalogEntries]);

  const totalVariants = products.length;
  const inactiveVariants = products.filter(
    (item) => item?.isActive === false,
  ).length;
  const liveVariants = totalVariants - inactiveVariants;
  const fallbackFamilies = catalogEntries.filter(
    (entry) => entry.isFallback,
  ).length;

  const handleCreateProduct = () => {
    setActiveEntry(null);
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleAddVariant = (entry) => {
    setActiveEntry(null);
    setEditingProduct({
      code: entry.code || "",
      name: entry.name || "",
      category: entry.category || "",
      description: entry.description || "",
      _prefillOnly: true,
    });
    setShowModal(true);
  };

  const handleEditProduct = (product) => {
    setActiveEntry(null);
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleViewImage = (image, title = "") => {
    if (!image?.url) return;
    setViewerState({
      open: true,
      image,
      title,
    });
  };

  const handleUploadFamilyImage = async (entry) => {
    if (!entry?.familyId) return;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setUploadingFamilyCode(entry.code);
        await uploadFamilyImage(entry.familyId, file);
        await reloadData();
      } catch (error) {
        console.error("Family image upload failed:", error);
        alert(error?.message || "Failed to upload family image");
      } finally {
        setUploadingFamilyCode(null);
      }
    };
    fileInput.click();
  };

  const handleRemoveFamilyImage = async (entry) => {
    const primaryImage = getPrimaryImage(entry?.familyImages || []);
    if (!entry?.familyId || !primaryImage?.publicId) return;

    const confirmed = window.confirm(
      `Remove the family image for ${entry.name}? This will remove it from the catalog preview.`,
    );
    if (!confirmed) return;

    try {
      setRemovingFamilyCode(entry.code);
      await deleteFamilyImage(entry.familyId, primaryImage.publicId);
      setViewerState((current) =>
        current.image?.publicId === primaryImage.publicId
          ? { open: false, image: null, title: "" }
          : current,
      );
      await reloadData();
    } catch (error) {
      console.error("Family image removal failed:", error);
      alert(error?.message || "Failed to remove family image");
    } finally {
      setRemovingFamilyCode(null);
    }
  };

  const handleUploadVariantImage = async (variant) => {
    if (!variant?._id) return;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setUploadingVariantId(variant._id);
        await uploadProductImage(variant._id, file);
        await reloadData();
      } catch (error) {
        console.error("Variant image upload failed:", error);
        alert(error?.message || "Failed to upload variant image");
      } finally {
        setUploadingVariantId(null);
      }
    };
    fileInput.click();
  };

  const isAnyOverlayOpen =
    viewerState.open || Boolean(activeEntry) || showModal;

  const resetCatalogView = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setDivisionFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("NAME_ASC");
  };

  const handleCategoryScopeChange = (nextCategory) => {
    setCategoryFilter(nextCategory);
    if (nextCategory !== "ALL") {
      setDivisionFilter(divisionForCategory(nextCategory).key);
    }
  };

  return (
    <>
      <NavBar />
      <div className="catalog-shell">
        <CatalogSidebar
          divisions={CATEGORY_DIVISIONS}
          divisionCounts={divisionCounts}
          categoryCounts={categoryCounts}
          divisionFilter={divisionFilter}
          categoryFilter={categoryFilter}
          totalFamilies={catalogEntries.length}
          totalVariants={totalVariants}
          liveVariants={liveVariants}
          fallbackFamilies={fallbackFamilies}
          onDivisionChange={(nextDivision) => {
            setDivisionFilter(nextDivision);
            setCategoryFilter("ALL");
          }}
          onCategoryChange={handleCategoryScopeChange}
          onCreateProduct={handleCreateProduct}
          onReset={resetCatalogView}
        />

        <section className="catalog-main">
          <CatalogMobileNav
            divisions={CATEGORY_DIVISIONS}
            divisionCounts={divisionCounts}
            divisionFilter={divisionFilter}
            totalFamilies={catalogEntries.length}
            onDivisionChange={(nextDivision) => {
              setDivisionFilter(nextDivision);
              setCategoryFilter("ALL");
            }}
          />

          <BlurLayer active={isAnyOverlayOpen} style={{ minHeight: "100%" }}>
            <div className="catalog-content">
              <CatalogControls
                search={search}
                onSearchChange={setSearch}
                onSearchClear={() => setSearch("")}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
                categoryFilter={categoryFilter}
                onCategoryChange={handleCategoryScopeChange}
                onReset={resetCatalogView}
              />

              {loading ? (
                <LoadingGrid />
              ) : filteredEntries.length === 0 ? (
                <Surface style={{ padding: 22, boxShadow: "none" }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: "#0f172a",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    No products found
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      lineHeight: 1.7,
                      fontWeight: 650,
                      color: "rgba(15,23,42,.58)",
                      maxWidth: 620,
                    }}
                  >
                    Broaden the current search or reset the scope filters to
                    restore the full family register.
                  </div>
                </Surface>
              ) : (
                <div className="catalog-grid">
                  {filteredEntries.map((entry) => (
                    <MinimalCatalogCard
                      key={entry._id}
                      entry={entry}
                      onOpen={setActiveEntry}
                      onViewImage={handleViewImage}
                    />
                  ))}
                </div>
              )}
            </div>
          </BlurLayer>
        </section>

        <CatalogDetailModal
          open={Boolean(activeEntry)}
          entry={activeEntry}
          onClose={() => setActiveEntry(null)}
          onAddVariant={handleAddVariant}
          onEditProduct={handleEditProduct}
          onUploadFamilyImage={handleUploadFamilyImage}
          onRemoveFamilyImage={handleRemoveFamilyImage}
          onUploadVariantImage={handleUploadVariantImage}
          onViewImage={handleViewImage}
          uploadingFamilyCode={uploadingFamilyCode}
          removingFamilyCode={removingFamilyCode}
          uploadingVariantId={uploadingVariantId}
        />

        <ImageViewerModal
          open={viewerState.open}
          image={viewerState.image}
          title={viewerState.title}
          onClose={() =>
            setViewerState({ open: false, image: null, title: "" })
          }
        />

        {showModal ? (
          <ProductEditorModal
            product={editingProduct}
            onClose={() => {
              setShowModal(false);
              setEditingProduct(null);
            }}
            onSaved={reloadData}
          />
        ) : null}
      </div>

      <CatalogWorkspaceStyles />
    </>
  );
}
