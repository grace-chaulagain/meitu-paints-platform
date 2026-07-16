import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ProductEditorModal from "./components/ProductEditorModal";
import DispatcherPricingWorkspace from "./dispatcherPricing/DispatcherPricingWorkspace.jsx";
import { useAuth } from "../../auth/AuthProvider.jsx";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  DashboardUIStyles,
  Dropdown,
  EmptyState,
  GhostButton,
  ListRow,
  MetricTile,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
  ViewToggle,
} from "../../components/dashboard/DashboardUI.jsx";
import {
  useDeleteAdminFamilyImageMutation,
  useGetAdminProductCategoriesQuery,
  useGetAdminProductFamiliesQuery,
  useGetAdminProductsQuery,
  useUploadAdminFamilyImageMutation,
  useUploadAdminProductImageMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { exportToCsv } from "../../utils/exportToCsv.js";
import {
  markImageFailed,
  markImageLoaded,
  selectImageFailedMap,
  selectImageLoadedMap,
} from "../../redux/imageCacheSlice.js";

const VIEW_STORAGE_KEY = "meitu.admin.catalog.view";

function getInitialView() {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "card";
  } catch {
    return "card";
  }
}

function hasDispatcherPricing(product) {
  return Boolean(product?.dispatcherPricing?.tiers?.length > 0);
}

const ALL_CATEGORY_OPTION = { value: "ALL", label: "All categories" };
const STATUS_OPTIONS = [
  { key: "ALL", label: "All status" },
  { key: "ACTIVE", label: "Active only" },
  { key: "INACTIVE", label: "Inactive only" },
  { key: "MISSING_FAMILY", label: "Missing family" },
];
const SORT_OPTIONS = [
  { key: "NAME_ASC", label: "Sort by name" },
  { key: "UPDATED_DESC", label: "Recently updated" },
  { key: "VARIANTS_DESC", label: "Most variants" },
  { key: "PRICE_ASC", label: "Lowest price" },
];
const CATALOG_EXPORT_COLUMNS = [
  { key: "familyCode", label: "Family Code" },
  { key: "name", label: "Product Name" },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "pack", label: "Pack" },
  { key: "status", label: "Status" },
  { key: "pricingModel", label: "Pricing Model" },
  { key: "startingPrice", label: "Starting Price (NPR)" },
  { key: "dispatcherPriced", label: "Dispatcher Priced" },
  { key: "updatedAt", label: "Last Updated" },
];
const adminImagePreloadRegistry = new Map();

function preloadAdminImage(src, dispatch) {
  if (!src || typeof window === "undefined") return null;
  if (adminImagePreloadRegistry.has(src)) {
    return adminImagePreloadRegistry.get(src);
  }

  const request = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      dispatch(markImageLoaded(src));
      resolve({ src, ok: true });
    };
    image.onerror = () => {
      dispatch(markImageFailed(src));
      resolve({ src, ok: false });
    };
    image.src = src;
  });

  adminImagePreloadRegistry.set(src, request);
  return request;
}

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  if (value === "ALL") return "All categories";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryOption(option) {
  const value =
    typeof option === "string"
      ? option
      : option?.value || option?.code || option?.category || "";
  const cleanValue = String(value || "").trim();

  if (!cleanValue || cleanValue === "ALL") return null;

  return {
    value: cleanValue,
    label:
      typeof option === "object" && option?.label
        ? String(option.label)
        : categoryLabel(cleanValue),
  };
}

function buildCategoryOptions(categoryItems = [], families = [], products = []) {
  const map = new Map();

  for (const option of categoryItems) {
    const normalized = normalizeCategoryOption(option);
    if (normalized) map.set(normalized.value, normalized);
  }

  for (const item of [...families, ...products]) {
    const normalized = normalizeCategoryOption(item?.category);
    if (normalized && !map.has(normalized.value)) {
      map.set(normalized.value, normalized);
    }
  }

  return [
    ALL_CATEGORY_OPTION,
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function buildCategoryDivisions(categoryOptions = []) {
  const categories = categoryOptions
    .map((option) => option.value)
    .filter((value) => value && value !== "ALL");

  if (categories.length === 0) return [];

  return [
    {
      key: "catalog",
      label: "Catalog Categories",
      shortLabel: "Catalog",
      description: "Categories currently used by product families and variants.",
      categories,
    },
  ];
}

function divisionForCategory(category, divisions = []) {
  return (
    divisions.find((division) => division.categories.includes(category || "")) || {
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
  return firstTier?.pricePerPack ?? firstTier?.priceInclTax ?? firstTier?.priceExclTax ?? null;
}

function getTierSummary(product) {
  const tiers = product?.pricing?.tiers || [];
  if (!tiers.length) return "Flat";
  if (tiers.length === 1) return tiers[0]?.label || "Flat";
  return `${tiers.length} tiers`;
}

function getPackSummary(variants) {
  if (!variants.length) return "—";
  return variants.map((variant) => variant?.pack?.label).filter(Boolean).join(" · ");
}

function getLowestPrice(variants) {
  const prices = variants.flatMap((variant) => {
    const tiers = variant?.pricing?.tiers || [];
    if (!tiers.length) {
      const startingPrice = getStartingPrice(variant);
      return typeof startingPrice === "number" ? [startingPrice] : [];
    }
    return tiers.map((tier) => tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax).filter((value) => typeof value === "number");
  });

  if (!prices.length) return null;
  return Math.min(...prices);
}

function getHighestPrice(variants) {
  const prices = variants.flatMap((variant) =>
    (variant?.pricing?.tiers || [])
      .map((tier) => tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax)
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

function getEntryMeta(entry, divisions = []) {
  const division = divisionForCategory(entry.category, divisions);
  const variants = entry.variants || [];
  const inactiveCount = variants.filter((item) => item?.isActive === false).length;
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

function BlurLayer({ active, children, style = {} }) {
  return (
    <div
      style={{
        transition: "filter .24s ease, opacity .24s ease",
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

function CachedImageElement({ src, alt, style, fetchPriority }) {
  const dispatch = useDispatch();
  const loadedImages = useSelector(selectImageLoadedMap);
  const failedImages = useSelector(selectImageFailedMap);
  const isSettled = Boolean(loadedImages[src] || failedImages[src]);

  useEffect(() => {
    preloadAdminImage(src, dispatch);
  }, [dispatch, src]);

  if (!src) return null;

  return (
    <>
      {!isSettled ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--color-graphite, #707070)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            background: "linear-gradient(120deg, rgba(255,255,255,.5), rgba(0,0,0,.03), rgba(255,255,255,.5))",
          }}
        >
          Loading
        </div>
      ) : null}
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        fetchPriority={fetchPriority}
        style={{ ...style, opacity: loadedImages[src] ? 1 : 0, transition: "opacity .18s ease" }}
        onLoad={() => dispatch(markImageLoaded(src))}
        onError={() => dispatch(markImageFailed(src))}
      />
    </>
  );
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-graphite, #707070)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

function ImageViewerModal({ open, image, title, onClose }) {
  if (!open || !image?.url) return null;

  return (
    <div
      className="dash-modal-backdrop-in"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
    >
      <div
        className="dash-modal-surface-in"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(1100px, 92vw)", maxHeight: "88vh", borderRadius: 20, overflow: "hidden", background: "var(--color-snow, #fff)", display: "grid", gridTemplateRows: "auto minmax(0,1fr)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title || image.alt || "Product image"}
            </div>
            <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Full preview</div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div style={{ padding: 20, minHeight: 0, height: "min(720px, calc(88vh - 78px))", display: "grid", placeItems: "center", position: "relative", background: "var(--color-fog, #f5f5f7)" }}>
          <CachedImageElement
            src={image.url}
            alt={image.alt || title || "Product image"}
            fetchPriority="high"
            style={{ maxWidth: "100%", maxHeight: "100%", width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 14, background: "var(--color-snow, #fff)" }}
          />
        </div>
      </div>
    </div>
  );
}

function CatalogGridStyles() {
  return (
    <style>{`
      .catalog-product-grid{
        display:grid;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        align-items:stretch;
        gap:18px;
      }
      .catalog-card-shell{
        min-width:0;
        height:100%;
        display:grid;
        gap:12px;
        align-content:start;
        border-radius:24px !important;
        overflow:hidden;
        transition:transform .18s ease, border-color .18s ease, background .18s ease;
      }
      .catalog-card-shell:hover{
        transform:translateY(-2px);
        border-color:rgba(29,29,31,.14) !important;
      }
      .catalog-card-media{
        width:100%;
        aspect-ratio:4 / 3;
        border-radius:18px;
        overflow:hidden;
        background:
          radial-gradient(circle at 30% 20%, rgba(0,113,227,.05), transparent 55%),
          var(--color-fog, #f5f5f7);
        cursor:pointer;
        display:grid;
        place-items:center;
        position:relative;
      }
      .catalog-card-media::after{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background:linear-gradient(180deg, rgba(255,255,255,0) 58%, rgba(245,245,247,.68) 100%);
      }
      .catalog-card-title-btn{
        border:0;
        background:transparent;
        padding:0;
        text-align:left;
        cursor:pointer;
      }
      .catalog-card-title-btn:focus-visible,
      .catalog-card-media:focus-visible,
      .catalog-add-product-card:focus-visible,
      .catalog-reset-compact:focus-visible{
        outline:2px solid rgba(0,113,227,.38);
        outline-offset:3px;
      }
      .catalog-card-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:auto;
      }
      .catalog-card-actions .admin-ui-ghost-btn{
        flex:1 1 118px;
        justify-content:center;
        background:var(--color-fog, #f5f5f7) !important;
        border-color:transparent !important;
      }
      .catalog-header-actions{
        display:flex;
        align-items:stretch;
        justify-content:flex-end;
        gap:10px;
        flex-wrap:wrap;
      }
      .catalog-reset-compact{
        height:auto;
        min-height:52px;
        padding:0 14px;
        border-radius:18px;
        border:1px solid rgba(29,29,31,.08);
        background:var(--color-fog, #f5f5f7);
        color:var(--color-ink, #1d1d1f);
        display:inline-flex;
        align-items:center;
        gap:8px;
        font-size:13px;
        font-weight:700;
        cursor:pointer;
      }
      .catalog-add-product-card{
        min-height:52px;
        border:1px solid rgba(0,113,227,.18);
        border-radius:22px;
        background:linear-gradient(145deg, rgba(255,255,255,.96), rgba(245,250,255,.96));
        color:var(--color-ink, #1d1d1f);
        padding:8px 12px 8px 10px;
        display:inline-flex;
        align-items:center;
        gap:10px;
        cursor:pointer;
        text-align:left;
        transition:transform .16s ease, border-color .16s ease, background .16s ease;
      }
      .catalog-add-product-card:hover{
        transform:translateY(-1px);
        border-color:rgba(0,113,227,.3);
      }
      .catalog-add-product-icon{
        width:34px;
        height:34px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:var(--color-azure, #0071e3);
        color:#fff;
        flex:0 0 auto;
      }
      .catalog-add-product-copy{
        display:grid;
        gap:1px;
      }
      .catalog-add-product-copy strong{
        font-size:13.5px;
        line-height:1.2;
        letter-spacing:-.01em;
      }
      .catalog-add-product-copy span{
        font-size:11.5px;
        line-height:1.25;
        font-weight:600;
        color:var(--color-graphite, #707070);
      }
      @media (min-width:1540px){
        .catalog-product-grid{
          grid-template-columns:repeat(4, minmax(0, 1fr));
        }
      }
      @media (max-width:1180px){
        .catalog-product-grid{
          grid-template-columns:repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width:760px){
        .catalog-product-grid{
          grid-template-columns:1fr;
          justify-content:stretch;
          gap:12px;
        }
        .catalog-toolbar-row > *{
          flex:1 1 100% !important;
          max-width:none !important;
        }
        .catalog-header-actions{
          width:100%;
          justify-content:stretch;
        }
        .catalog-reset-compact,
        .catalog-add-product-card{
          flex:1 1 100%;
          justify-content:center;
        }
      }

      .catalog-list-header-row{
        padding:9px 16px;
        font-size:10.5px;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
        color:var(--color-graphite, #707070);
        border-bottom:1px solid rgba(29,29,31,.08);
      }
      .catalog-list-thumb{
        width:40px;
        height:40px;
        border-radius:10px;
        overflow:hidden;
        background:var(--color-fog, #f5f5f7);
        display:grid;
        place-items:center;
        flex-shrink:0;
      }
      @media (max-width:900px){
        .catalog-list-header-row{ display:none !important; }
        .catalog-list-row-grid{
          grid-template-columns:40px minmax(0,1fr) !important;
        }
        .catalog-list-row-grid > :nth-child(3),
        .catalog-list-row-grid > :nth-child(4),
        .catalog-list-row-grid > :nth-child(5),
        .catalog-list-row-grid > :nth-child(6){
          display:none;
        }
      }

      .catalog-detail-overlay{ padding:24px; }
      .catalog-detail-dialog{
        width:min(1040px, 96vw);
        max-height:88vh;
        overflow:auto;
        border-radius:30px;
        padding:20px;
        border:1px solid rgba(29,29,31,.1);
        background:rgba(255,255,255,.96);
        color:var(--color-ink, #1d1d1f);
      }
      .catalog-detail-body{
        display:grid;
        grid-template-columns:300px minmax(0,1fr);
        gap:16px;
        align-items:start;
      }
      .catalog-workspace-head{
        display:grid;
        gap:12px;
        padding:4px 2px 16px;
      }
      .catalog-workspace-title-row{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
      }
      .catalog-workspace-title-group{
        min-width:0;
        display:grid;
        gap:7px;
      }
      .catalog-workspace-eyebrow{
        display:inline-flex;
        align-items:center;
        gap:7px;
        width:max-content;
        max-width:100%;
        color:var(--color-graphite, #707070);
        font-size:11px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .catalog-workspace-title{
        margin:0;
        color:var(--color-ink, #1d1d1f);
        font-size:clamp(22px, 3vw, 32px);
        line-height:1.06;
        letter-spacing:-.035em;
        font-weight:800;
      }
      .catalog-workspace-subline{
        display:flex;
        align-items:center;
        gap:7px;
        flex-wrap:wrap;
      }
      .catalog-workspace-token{
        min-height:28px;
        padding:0 10px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-graphite, #707070);
        font-size:12px;
        font-weight:700;
      }
      .catalog-detail-preview{
        width:100%;
        aspect-ratio:1 / 1;
        border-radius:22px;
        overflow:hidden;
        background:
          radial-gradient(circle at 30% 20%, rgba(0,113,227,.05), transparent 55%),
          var(--color-fog, #f5f5f7);
        display:grid;
        place-items:center;
        position:relative;
      }
      .catalog-detail-stat-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      }
      .catalog-workspace-stat{
        min-height:70px;
        padding:12px;
        border-radius:18px;
        background:var(--color-fog, #f5f5f7);
        display:grid;
        align-content:space-between;
        gap:8px;
      }
      .catalog-workspace-stat-icon{
        width:24px;
        height:24px;
        border-radius:999px;
        display:grid;
        place-items:center;
        color:var(--color-azure, #0071e3);
        background:rgba(0,113,227,.09);
      }
      .catalog-workspace-stat-label{
        color:var(--color-graphite, #707070);
        font-size:10.5px;
        line-height:1.2;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
      }
      .catalog-workspace-stat-value{
        color:var(--color-ink, #1d1d1f);
        font-size:15px;
        line-height:1.15;
        font-weight:800;
        letter-spacing:-.02em;
      }
      .catalog-workspace-stat.accent .catalog-workspace-stat-value{
        color:var(--color-azure, #0071e3);
      }
      .catalog-detail-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .catalog-detail-actions > *{
        flex:1 1 130px;
        justify-content:center;
      }
      .catalog-workspace-panel{
        border-radius:24px;
        border:1px solid rgba(29,29,31,.08);
        background:rgba(255,255,255,.88);
        padding:14px;
      }
      .catalog-workspace-description{
        display:grid;
        grid-template-columns:30px minmax(0,1fr);
        gap:11px;
        align-items:start;
      }
      .catalog-workspace-description-icon{
        width:30px;
        height:30px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-graphite, #707070);
      }
      .catalog-workspace-description p{
        margin:5px 0 0;
        color:var(--color-graphite, #707070);
        font-size:13px;
        line-height:1.55;
        font-weight:500;
      }
      .catalog-variant-toolbar{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }
      .catalog-variant-count{
        min-height:30px;
        padding:0 10px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-graphite, #707070);
        font-size:12px;
        font-weight:700;
      }
      .catalog-variant-row{
        display:grid;
        grid-template-columns:minmax(72px,.7fr) minmax(0,1.5fr) minmax(92px,.8fr) auto;
        gap:10px;
        align-items:center;
        padding:9px 10px;
        border-radius:16px;
        background:var(--color-snow, #fff);
        border:1px solid rgba(29,29,31,.08);
      }
      .catalog-variant-row.inactive{
        background:var(--color-fog, #f5f5f7);
      }
      .catalog-variant-pack{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }
      .catalog-variant-pack-icon{
        width:28px;
        height:28px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(0,113,227,.08);
        color:var(--color-azure, #0071e3);
        flex:0 0 auto;
        overflow:hidden;
      }
      .catalog-variant-pack strong{
        display:block;
        color:var(--color-ink, #1d1d1f);
        font-size:13.5px;
        line-height:1.15;
        letter-spacing:-.01em;
      }
      .catalog-variant-sku{
        min-width:0;
        color:var(--color-graphite, #707070);
        font-size:12px;
        line-height:1.25;
        font-weight:600;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .catalog-variant-price{
        color:var(--color-ink, #1d1d1f);
        font-size:12.5px;
        line-height:1.25;
        font-weight:700;
        text-align:right;
        white-space:nowrap;
      }
      .catalog-variant-row-actions{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }
      @media (max-width:760px){
        .catalog-detail-overlay{ padding:0; align-items:stretch; }
        .catalog-detail-dialog{
          width:100%;
          max-height:100dvh;
          border-radius:0;
          padding:16px;
        }
        .catalog-workspace-title-row{
          gap:12px;
        }
        .catalog-detail-body{ grid-template-columns:1fr; }
        .catalog-detail-actions > *{ flex:1 1 100%; }
        .catalog-variant-row{
          grid-template-columns:minmax(0,1fr) auto;
        }
        .catalog-variant-sku,
        .catalog-variant-price{
          grid-column:1 / -1;
          text-align:left;
        }
        .catalog-variant-row-actions{
          grid-column:1 / -1;
          justify-content:stretch;
        }
        .catalog-variant-row-actions > *{
          flex:1 1 120px;
          justify-content:center;
        }
      }
    `}</style>
  );
}

function CatalogHeaderActions({ onReset, onCreate }) {
  return (
    <div className="catalog-header-actions">
      <button type="button" className="catalog-reset-compact" onClick={onReset}>
        <DashboardIcon name="refresh" size={15} strokeWidth={1.9} />
        <span>Reset</span>
      </button>
      <button type="button" className="catalog-add-product-card" onClick={onCreate}>
        <span className="catalog-add-product-icon">
          <DashboardIcon name="plus" size={17} strokeWidth={2.1} />
        </span>
        <span className="catalog-add-product-copy">
          <strong>Add Product</strong>
          <span>New SKU variant</span>
        </span>
      </button>
    </div>
  );
}

function IconTitle({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{children}</div>
    </div>
  );
}

function WorkspaceStat({ icon, label, value, tone = "neutral" }) {
  return (
    <div className={`catalog-workspace-stat ${tone === "accent" ? "accent" : ""}`}>
      <span className="catalog-workspace-stat-icon">
        <DashboardIcon name={icon} size={13} strokeWidth={2} />
      </span>
      <span>
        <span className="catalog-workspace-stat-label">{label}</span>
        <span className="catalog-workspace-stat-value">{value}</span>
      </span>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="catalog-product-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <Surface key={index} padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ))}
    </div>
  );
}

function CompactVariantRow({ variant, onEditProduct, onUploadVariantImage, uploadingVariantId }) {
  const startingPrice = getStartingPrice(variant);
  const inactive = variant?.isActive === false;
  const isUploading = uploadingVariantId === variant._id;
  const variantImage = getPrimaryImage(variant?.images || []);

  return (
    <div className={`catalog-variant-row ${inactive ? "inactive" : ""}`}>
      <div className="catalog-variant-pack">
        <span className="catalog-variant-pack-icon">
          {variantImage?.url ? (
            <CachedImageElement
              src={variantImage.url}
              alt={variantImage.alt || variant?.pack?.label || "Variant image"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "999px" }}
            />
          ) : (
            <DashboardIcon name={inactive ? "minus" : "package"} size={13} strokeWidth={2} />
          )}
        </span>
        <span>
          <strong>{variant?.pack?.label || "—"}</strong>
          <span style={{ display: "block", marginTop: 2 }}>
            <Pill tone={inactive ? "neutral" : "positive"} size="small">{inactive ? "Inactive" : "Live"}</Pill>
          </span>
        </span>
      </div>

      <div className="catalog-variant-sku">{variant?.sku || "SKU unavailable"}</div>
      <div className="catalog-variant-price">{getTierSummary(variant)} · {formatMoney(startingPrice, variant?.currency || "NPR")}</div>

      <div className="catalog-variant-row-actions">
        <GhostButton icon="download" onClick={() => onUploadVariantImage(variant)} disabled={isUploading}>
          {isUploading ? "Uploading…" : "Image"}
        </GhostButton>
        <GhostButton icon="edit" onClick={() => onEditProduct(variant)}>Edit</GhostButton>
      </div>
    </div>
  );
}

function MinimalCatalogCard({ entry, divisions, onOpen, onViewImage }) {
  const meta = getEntryMeta(entry, divisions);
  const familyPrimaryImage = getPrimaryImage(entry.familyImages || []);
  const productPrimaryImage = getPrimaryImage(entry.variants?.[0]?.images || []);
  const heroImage = familyPrimaryImage || productPrimaryImage;

  return (
    <Surface padding={14} className="catalog-card-shell dash-fade-up">
      <div
        className="catalog-card-media"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onOpen(entry);
        }}
      >
        {heroImage?.url ? (
          <CachedImageElement
            src={heroImage.url}
            alt={heroImage.alt || entry.name}
            style={{ position: "absolute", inset: 18, width: "calc(100% - 36px)", height: "calc(100% - 36px)", objectFit: "contain", mixBlendMode: "multiply" }}
          />
        ) : (
          <div style={{ padding: 18, textAlign: "center", fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Product preview
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Pill tone="neutral" size="small">{meta.division.shortLabel}</Pill>
          {entry.isFallback ? <Pill tone="critical" size="small">Missing family</Pill> : null}
        </div>

        <button type="button" onClick={() => onOpen(entry)} className="catalog-card-title-btn">
          <div style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>{entry.name}</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            {entry.code} · {categoryLabel(entry.category)}
          </div>
        </button>

        <div className="catalog-card-actions">
          <GhostButton icon="list" onClick={() => onOpen(entry)}>View details</GhostButton>
          <GhostButton
            icon="download"
            onClick={() => {
              if (heroImage?.url) {
                onViewImage?.(heroImage, `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`);
              }
            }}
            disabled={!heroImage?.url}
          >
            Preview image
          </GhostButton>
        </div>
      </div>
    </Surface>
  );
}

const LIST_COLUMNS = "40px minmax(0,1fr) 76px 64px 190px 104px";

function ProductListHeaderRow() {
  return (
    <div className="catalog-list-header-row" style={{ display: "grid", gridTemplateColumns: LIST_COLUMNS, gap: 12 }}>
      <span style={{ gridColumn: "1 / span 2" }}>Product</span>
      <span>Variants</span>
      <span>Live</span>
      <span>Price Range</span>
      <span>Updated</span>
    </div>
  );
}

function ProductListRow({ entry, divisions, onOpen, onViewImage }) {
  const meta = getEntryMeta(entry, divisions);
  const familyPrimaryImage = getPrimaryImage(entry.familyImages || []);
  const productPrimaryImage = getPrimaryImage(entry.variants?.[0]?.images || []);
  const heroImage = familyPrimaryImage || productPrimaryImage;
  const latestUpdate = Math.max(
    ...[entry, ...(entry.variants || [])].map((item) => new Date(item?.updatedAt || item?.createdAt || 0).getTime() || 0),
    0,
  );

  return (
    <ListRow onClick={() => onOpen(entry)}>
      <div className="catalog-list-row-grid" style={{ display: "grid", gridTemplateColumns: LIST_COLUMNS, gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
        <div
          className="catalog-list-thumb"
          style={heroImage?.url ? { padding: 5 } : undefined}
          onClick={(event) => {
            if (heroImage?.url) {
              event.stopPropagation();
              onViewImage?.(heroImage, `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`);
            }
          }}
        >
          {heroImage?.url ? (
            <CachedImageElement src={heroImage.url} alt={heroImage.alt || entry.name} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", mixBlendMode: "multiply" }} />
          ) : (
            <DashboardIcon name="package" size={16} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
            {entry.isFallback ? <Pill tone="critical" size="small">Missing family</Pill> : null}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.code} · {categoryLabel(entry.category)}
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{entry.variants.length}</div>

        <div>
          <Pill tone={meta.liveCount > 0 ? "positive" : "neutral"} size="small">{meta.liveCount}</Pill>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meta.lowestPrice === null ? "—" : `${formatMoney(meta.lowestPrice)} – ${formatMoney(meta.highestPrice)}`}
        </div>

        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {latestUpdate ? new Date(latestUpdate).toLocaleDateString() : "—"}
        </div>
      </div>
    </ListRow>
  );
}

function CatalogDetailModal({
  open,
  entry,
  divisions,
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
      if (event.key === "Escape") onClose?.();
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

  const meta = getEntryMeta(entry, divisions);
  const familyPrimaryImage = getPrimaryImage(entry.familyImages || []);
  const productPrimaryImage = getPrimaryImage(entry.variants?.[0]?.images || []);
  const heroImage = familyPrimaryImage || productPrimaryImage;
  const isUploadingFamily = uploadingFamilyCode === entry.code;
  const isRemovingFamily = removingFamilyCode === entry.code;

  return (
    <div
      className="catalog-detail-overlay dash-modal-backdrop-in"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(245,245,247,.78)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", display: "grid", placeItems: "center" }}
    >
      <div
        ref={dialogRef}
        className="catalog-detail-dialog dash-modal-surface-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="catalog-workspace-head">
          <div className="catalog-workspace-title-row">
            <div className="catalog-workspace-title-group">
              <div className="catalog-workspace-eyebrow">
                <DashboardIcon name="package" size={13} strokeWidth={2} />
                Product Workspace
              </div>
              <h2 className="catalog-workspace-title">{entry.name}</h2>
              <div className="catalog-workspace-subline">
                <span className="catalog-workspace-token">
                  <DashboardIcon name="list" size={12} strokeWidth={2} />
                  {entry.code}
                </span>
                <span className="catalog-workspace-token">
                  <DashboardIcon name="filter" size={12} strokeWidth={2} />
                  {categoryLabel(entry.category)}
                </span>
                <span className="catalog-workspace-token">
                  <DashboardIcon name="overview" size={12} strokeWidth={2} />
                  {meta.division.label}
                </span>
              </div>
            </div>
            <CloseButton onClick={onClose} />
          </div>
        </div>

        <div className="catalog-detail-body" style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gap: 14 }}>
            <button
              type="button"
              onClick={() => {
                if (heroImage?.url) onViewImage?.(heroImage, `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`);
              }}
              style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: heroImage?.url ? "zoom-in" : "default" }}
            >
              <div className="catalog-detail-preview">
                {heroImage?.url ? (
                  <CachedImageElement
                    src={heroImage.url}
                    alt={heroImage.alt || entry.name}
                    style={{ position: "absolute", inset: 28, width: "calc(100% - 56px)", height: "calc(100% - 56px)", objectFit: "contain", mixBlendMode: "multiply" }}
                  />
                ) : (
                  <div style={{ padding: 18, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>No preview image</div>
                )}
              </div>
            </button>

            <div className="catalog-detail-stat-grid">
              <WorkspaceStat icon="package" label="Variants" value={entry.variants.length} />
              <WorkspaceStat icon="check" label="Live" value={meta.liveCount} tone="accent" />
              <WorkspaceStat icon="invoice" label="From" value={formatMoney(meta.lowestPrice)} />
              <WorkspaceStat icon="trend" label="To" value={formatMoney(meta.highestPrice)} tone="accent" />
            </div>

            <div className="catalog-detail-actions">
              <GhostButton
                icon="download"
                onClick={() => {
                  if (heroImage?.url) onViewImage?.(heroImage, `${entry.name}${familyPrimaryImage ? " · Family Image" : " · Product Image"}`);
                }}
                disabled={!heroImage?.url}
                style={{ flex: 1 }}
              >
                Preview
              </GhostButton>
              <PrimaryButton icon="plus" onClick={() => onUploadFamilyImage(entry)} disabled={!entry.familyId || isUploadingFamily || isRemovingFamily} style={{ flex: 1, justifyContent: "center" }}>
                {isUploadingFamily ? "Uploading…" : familyPrimaryImage ? "Replace" : "Upload"}
              </PrimaryButton>
              {familyPrimaryImage?.publicId ? (
                <GhostButton danger icon="trash" onClick={() => onRemoveFamilyImage(entry)} disabled={isUploadingFamily || isRemovingFamily} style={{ flex: 1 }}>
                  {isRemovingFamily ? "Removing…" : "Remove"}
                </GhostButton>
              ) : null}
            </div>

            {entry.isFallback ? (
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(180,35,24,.08)", fontSize: 12, fontWeight: 600, color: "#b42318", lineHeight: 1.5 }}>
                This product code has no family record yet. Create or seed the family first if you want dealers to inherit family-level imagery.
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div className="catalog-workspace-panel catalog-workspace-description">
              <span className="catalog-workspace-description-icon">
                <DashboardIcon name="list" size={15} strokeWidth={2} />
              </span>
              <div>
                <IconTitle icon="list">Family overview</IconTitle>
                <p>{entry.description || "No family description available yet for this product group."}</p>
              </div>
            </div>

            <div className="catalog-workspace-panel">
              <div className="catalog-variant-toolbar">
                <div>
                  <IconTitle icon="package">Variant management</IconTitle>
                  <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    SKU details, images, pack sizes, and price tiers.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="catalog-variant-count">
                    <DashboardIcon name="checkSquare" size={13} strokeWidth={2} />
                    {entry.variants.length} variants
                  </span>
                  <GhostButton icon="plus" onClick={() => onAddVariant(entry)}>Add</GhostButton>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {entry.variants.length ? (
                  entry.variants.map((variant) => (
                    <CompactVariantRow key={variant._id} variant={variant} onEditProduct={onEditProduct} onUploadVariantImage={onUploadVariantImage} uploadingVariantId={uploadingVariantId} />
                  ))
                ) : (
                  <EmptyState icon="package" title="No variants found for this family" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const { user } = useAuth();
  const familiesQuery = useGetAdminProductFamiliesQuery();
  const productsQuery = useGetAdminProductsQuery();
  const categoriesQuery = useGetAdminProductCategoriesQuery();
  const [uploadFamilyImage] = useUploadAdminFamilyImageMutation();
  const [uploadProductImage] = useUploadAdminProductImageMutation();
  const [deleteFamilyImage] = useDeleteAdminFamilyImageMutation();

  const families = useMemo(() => familiesQuery.data || [], [familiesQuery.data]);
  const products = useMemo(() => productsQuery.data || [], [productsQuery.data]);
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categoriesQuery.data || [], families, products),
    [categoriesQuery.data, families, products],
  );
  const hasCatalogData = families.length > 0 || products.length > 0;
  const loading = !hasCatalogData && (familiesQuery.isLoading || productsQuery.isLoading);
  const refreshing = !loading && (familiesQuery.isFetching || productsQuery.isFetching || categoriesQuery.isFetching);
  const catalogError = familiesQuery.error || productsQuery.error
    ? getQueryErrorMessage(familiesQuery.error || productsQuery.error, "Failed to load admin product catalog.")
    : "";

  const [editingProduct, setEditingProduct] = useState(null);
  const [returnEntryCode, setReturnEntryCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NAME_ASC");
  const [activeEntry, setActiveEntry] = useState(null);
  const [uploadingFamilyCode, setUploadingFamilyCode] = useState(null);
  const [removingFamilyCode, setRemovingFamilyCode] = useState(null);
  const [uploadingVariantId, setUploadingVariantId] = useState(null);
  const [viewerState, setViewerState] = useState({ open: false, image: null, title: "" });
  const [view, setView] = useState(getInitialView);
  const [section, setSection] = useState("catalog"); // "catalog" | "dispatcherPricing"
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [createWithNewCategory, setCreateWithNewCategory] = useState(false);

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  const groupedProducts = useMemo(() => groupProductsByCode(products), [products]);
  const catalogEntries = useMemo(() => buildCatalogEntries(families, groupedProducts), [families, groupedProducts]);
  const categoryDivisions = useMemo(() => buildCategoryDivisions(categoryOptions), [categoryOptions]);

  useEffect(() => {
    if (!categoryOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter("ALL");
    }
  }, [categoryFilter, categoryOptions]);

  useEffect(() => {
    if (!activeEntry?.code) return;

    const nextActiveEntry = catalogEntries.find((entry) => entry.code === activeEntry.code);

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
      const categoryOk = categoryFilter === "ALL" ? true : entry.category === categoryFilter;
      const meta = getEntryMeta(entry, categoryDivisions);
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
        ? [entry.name, entry.code, entry.category, entry.description, ...entry.variants.flatMap((variant) => [variant?.sku, variant?.pack?.label, variant?.pricing?.model])]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;

      return categoryOk && statusOk && queryOk;
    });

    return [...scoped].sort((a, b) => {
      if (sortBy === "UPDATED_DESC") {
        const aUpdated = Math.max(...[a, ...(a.variants || [])].map((item) => new Date(item?.updatedAt || item?.createdAt || 0).getTime() || 0), 0);
        const bUpdated = Math.max(...[b, ...(b.variants || [])].map((item) => new Date(item?.updatedAt || item?.createdAt || 0).getTime() || 0), 0);
        return bUpdated - aUpdated;
      }

      if (sortBy === "VARIANTS_DESC") {
        return (b.variants?.length || 0) - (a.variants?.length || 0);
      }

      if (sortBy === "PRICE_ASC") {
        const aPrice = getEntryMeta(a, categoryDivisions).lowestPrice ?? Number.POSITIVE_INFINITY;
        const bPrice = getEntryMeta(b, categoryDivisions).lowestPrice ?? Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      }

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [catalogEntries, search, categoryFilter, categoryDivisions, statusFilter, sortBy]);

  // Groups the already-filtered/sorted entries by category so the grid/list
  // reads as sections instead of one undifferentiated wall of products.
  // Skipped visually once a single category is already selected via the
  // filter above, since a lone group heading for the whole page would just
  // repeat what the dropdown already says.
  const groupedEntries = useMemo(() => {
    const groups = new Map();
    for (const entry of filteredEntries) {
      const key = entry.category || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return categoryLabel(a).localeCompare(categoryLabel(b));
    });
    return sortedKeys.map((key) => ({
      key: key || "uncategorized",
      label: categoryLabel(key),
      entries: groups.get(key),
    }));
  }, [filteredEntries]);
  const showGroupHeadings = categoryFilter === "ALL" && groupedEntries.length > 1;

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    categoryOptions.forEach((category) => {
      if (category.value !== "ALL") counts.set(category.value, 0);
    });

    for (const entry of catalogEntries) {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    }

    return counts;
  }, [catalogEntries, categoryOptions]);

  const totalVariants = products.length;
  const inactiveVariants = products.filter((item) => item?.isActive === false).length;
  const liveVariants = totalVariants - inactiveVariants;
  const fallbackFamilies = catalogEntries.filter((entry) => entry.isFallback).length;

  const handleCreateProduct = ({ forceNewCategory = false } = {}) => {
    setActiveEntry(null);
    setReturnEntryCode("");
    setEditingProduct(null);
    setCreateWithNewCategory(forceNewCategory);
    setShowModal(true);
  };

  const handleAddVariant = (entry) => {
    setReturnEntryCode(entry?.code || "");
    setActiveEntry(null);
    setEditingProduct({ code: entry.code || "", name: entry.name || "", category: entry.category || "", description: entry.description || "", _prefillOnly: true });
    setShowModal(true);
  };

  const handleEditProduct = (product) => {
    setReturnEntryCode(activeEntry?.code || product?.code || "");
    setActiveEntry(null);
    setEditingProduct(product);
    setShowModal(true);
  };

  const closeProductEditor = () => {
    setShowModal(false);
    setEditingProduct(null);
    setReturnEntryCode("");
    setCreateWithNewCategory(false);
  };

  const returnToProductWorkspace = () => {
    const nextEntry = returnEntryCode ? catalogEntries.find((entry) => entry.code === returnEntryCode) : null;
    setShowModal(false);
    setEditingProduct(null);
    setReturnEntryCode("");
    if (nextEntry) setActiveEntry(nextEntry);
  };

  const handleViewImage = (image, title = "") => {
    if (!image?.url) return;
    setViewerState({ open: true, image, title });
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
        await uploadFamilyImage({ familyId: entry.familyId, file }).unwrap();
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

    const confirmed = window.confirm(`Remove the family image for ${entry.name}? This will remove it from the catalog preview.`);
    if (!confirmed) return;

    try {
      setRemovingFamilyCode(entry.code);
      await deleteFamilyImage({ familyId: entry.familyId, publicId: primaryImage.publicId }).unwrap();
      setViewerState((current) => (current.image?.publicId === primaryImage.publicId ? { open: false, image: null, title: "" } : current));
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
        await uploadProductImage({ productId: variant._id, file }).unwrap();
      } catch (error) {
        console.error("Variant image upload failed:", error);
        alert(error?.message || "Failed to upload variant image");
      } finally {
        setUploadingVariantId(null);
      }
    };
    fileInput.click();
  };

  const isAnyOverlayOpen = viewerState.open || Boolean(activeEntry) || showModal;

  const resetCatalogView = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("NAME_ASC");
  };

  function buildVariantExportRow(entry, variant) {
    const hasVariant = Boolean(variant && Object.keys(variant).length);
    return {
      familyCode: entry.code,
      name: hasVariant ? variant.name || entry.name : entry.name,
      sku: hasVariant ? variant.sku || "" : "",
      category: categoryLabel(entry.category),
      pack: hasVariant ? variant.pack?.label || "" : "",
      status: hasVariant ? (variant.isActive === false ? "Inactive" : "Live") : "No variants",
      pricingModel: hasVariant ? getTierSummary(variant) : "",
      startingPrice: hasVariant ? getStartingPrice(variant) ?? "" : "",
      dispatcherPriced: hasVariant ? (hasDispatcherPricing(variant) ? "Yes" : "No") : "",
      updatedAt: hasVariant && variant.updatedAt ? new Date(variant.updatedAt).toLocaleDateString() : "",
    };
  }

  // SKU-level export of exactly what's currently on screen (search/category/
  // status/sort applied) - "export what I'm looking at" is the least
  // surprising behavior for an admin who just narrowed the catalog down.
  const handleExportCatalogCsv = () => {
    const rows = filteredEntries.flatMap((entry) =>
      entry.variants.length ? entry.variants.map((variant) => buildVariantExportRow(entry, variant)) : [buildVariantExportRow(entry, {})],
    );
    exportToCsv("meitu-product-catalog", CATALOG_EXPORT_COLUMNS, rows);
  };

  // A standalone audit report across the WHOLE catalog (ignores active
  // filters on purpose) - flags every SKU a dispatcher cannot actually order
  // as a Factory replenishment today, since dispatcherPricing is opt-in per
  // SKU and empty by default (see priceProductLine's "No matching pricing
  // tier found" failure this surfaces for dispatchers otherwise).
  const handleExportMissingDispatcherPricing = () => {
    const rows = products
      .filter((product) => !hasDispatcherPricing(product))
      .map((product) => buildVariantExportRow({ code: product.code, name: product.name, category: product.category }, product));
    exportToCsv("meitu-missing-dispatcher-pricing", CATALOG_EXPORT_COLUMNS, rows);
  };

  const navGroups = useMemo(() => {
    const categoryItems = [
      { key: "ALL", title: "All Products", icon: "list", badge: catalogEntries.length },
      {
        key: "__TOGGLE_CATEGORIES__",
        title: categoriesExpanded ? "Hide Categories" : "Show Categories",
        icon: categoriesExpanded ? "minus" : "plus",
      },
    ];

    if (categoriesExpanded) {
      categoryOptions
        .filter((option) => option.value !== "ALL")
        .forEach((option) => {
          categoryItems.push({ key: option.value, title: option.label, icon: "package", badge: categoryCounts.get(option.value) || 0 });
        });
      categoryItems.push({ key: "__ADD_CATEGORY__", title: "Add Category", icon: "plus" });
    }

    return [
      { label: "Categories", items: categoryItems },
      { label: "Pricing", items: [{ key: "__DISPATCHER_PRICE__", title: "Dispatcher Price", icon: "truck" }] },
    ];
  }, [categoryOptions, categoryCounts, catalogEntries.length, categoriesExpanded]);

  const activeNavKey = section === "dispatcherPricing" ? "__DISPATCHER_PRICE__" : categoryFilter;

  function handleNavigate(item) {
    if (item.key === "__TOGGLE_CATEGORIES__") {
      setCategoriesExpanded((current) => !current);
      return;
    }
    if (item.key === "__ADD_CATEGORY__") {
      handleCreateProduct({ forceNewCategory: true });
      return;
    }
    if (item.key === "__DISPATCHER_PRICE__") {
      setSection("dispatcherPricing");
      return;
    }
    setSection("catalog");
    setCategoryFilter(item.key);
  }

  return (
    <DashboardShell
      title="Meitu Catalog"
      eyebrow="Admin Catalog"
      accountLabel={user?.email || "Meitu Paints operations"}
      navGroups={navGroups}
      activeKey={activeNavKey}
      onNavigate={handleNavigate}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <DashboardUIStyles />

        {section === "dispatcherPricing" ? (
          <DispatcherPricingWorkspace />
        ) : (
          <>
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader
                icon="package"
                title="Product Catalog"
                subtitle={refreshing ? "Updating…" : "Product families, SKU variants, pricing, and media."}
                action={
                  <CatalogHeaderActions onReset={resetCatalogView} onCreate={() => handleCreateProduct()} />
                }
              />

              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                <MetricTile icon="package" label="Variants" value={totalVariants} tone="accent" />
                <MetricTile icon="checkmark" label="Live" value={liveVariants} />
                <MetricTile icon="warning" label="Fallback" value={fallbackFamilies} />
              </div>

              {catalogError ? (
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{catalogError}</div>
              ) : null}
            </Surface>

            <CatalogGridStyles />

            <Surface padding={16} className="dash-fade-up">
              <div className="catalog-toolbar-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
                  <SearchField value={search} onChange={setSearch} placeholder="Search product, code, SKU, pack…" />
                </div>
                <Dropdown
                  icon="list"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categoryOptions.map((option) => ({ key: option.value, label: option.label }))}
                />
                <Dropdown icon="filter" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
                <Dropdown icon="sort" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
                <ViewToggle value={view} onChange={updateView} />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GhostButton icon="download" onClick={handleExportCatalogCsv} disabled={filteredEntries.length === 0}>
                  Export CSV ({filteredEntries.reduce((sum, entry) => sum + (entry.variants.length || 1), 0)})
                </GhostButton>
                <GhostButton icon="warning" onClick={handleExportMissingDispatcherPricing}>
                  Export Missing Dispatcher Pricing
                </GhostButton>
              </div>
            </Surface>

            <BlurLayer active={isAnyOverlayOpen}>
              {loading ? (
                <LoadingGrid />
              ) : filteredEntries.length === 0 ? (
                <EmptyState icon="package" title="No products found" subtitle="Broaden the current search or reset the scope filters to restore the full family register." />
              ) : view === "list" ? (
                <Surface padding={0} className="dash-fade-up">
                  <ProductListHeaderRow />
                  {groupedEntries.map((group) => (
                    <div key={group.key}>
                      {showGroupHeadings ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--color-fog, #f5f5f7)" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>{group.label}</span>
                          <Pill size="small">{group.entries.length}</Pill>
                        </div>
                      ) : null}
                      {group.entries.map((entry) => (
                        <ProductListRow key={entry._id} entry={entry} divisions={categoryDivisions} onOpen={setActiveEntry} onViewImage={handleViewImage} />
                      ))}
                    </div>
                  ))}
                </Surface>
              ) : (
                <div style={{ display: "grid", gap: 24 }}>
                  {groupedEntries.map((group) => (
                    <div key={group.key} style={{ display: "grid", gap: 12 }}>
                      {showGroupHeadings ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.01em", color: "var(--color-ink, #1d1d1f)" }}>{group.label}</span>
                          <Pill size="small">{group.entries.length}</Pill>
                        </div>
                      ) : null}
                      <div className="catalog-product-grid">
                        {group.entries.map((entry) => (
                          <MinimalCatalogCard key={entry._id} entry={entry} divisions={categoryDivisions} onOpen={setActiveEntry} onViewImage={handleViewImage} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </BlurLayer>

            <CatalogDetailModal
              open={Boolean(activeEntry)}
              entry={activeEntry}
              divisions={categoryDivisions}
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

            <ImageViewerModal open={viewerState.open} image={viewerState.image} title={viewerState.title} onClose={() => setViewerState({ open: false, image: null, title: "" })} />
          </>
        )}

        {showModal ? (
          <ProductEditorModal
            product={editingProduct}
            categoryOptions={categoryOptions}
            forceNewCategory={createWithNewCategory}
            onClose={closeProductEditor}
            onBack={returnEntryCode ? returnToProductWorkspace : undefined}
            onSaved={async () => {}}
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}
