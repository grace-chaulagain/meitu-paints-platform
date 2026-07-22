import { useMemo, useState } from "react";
import {
  useGetAdminProductCategoriesQuery,
  useGetAdminProductFamiliesQuery,
  useGetAdminProductsQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";
import { AdminFamilySheet } from "./AdminFamilySheet.jsx";
import { AdminProductEditorSheet } from "./AdminProductEditorSheet.jsx";

// ADMIN_MOBILE_DESIGN_PROMPT.md §4, the spec's own "headline ask": family
// cards -> a family sheet (variants list) -> a sectioned product editor
// sheet, replacing the desktop's 1834-line AdminProductsPage.jsx grid/list
// toggle and 1199-line ProductEditorModal.jsx dialog for phones. Data model
// and grouping logic (groupProductsByCode/buildCatalogEntries) are copied
// verbatim from AdminProductsPage.jsx rather than imported, since neither
// is exported from that file - see this file's own copies below.
function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function groupProductsByCode(products) {
  const map = new Map();
  for (const product of products) {
    const key = product.code;
    if (!map.has(key)) map.set(key, []);
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

function priceRangeLabel(variants) {
  const prices = variants.flatMap((variant) =>
    (variant?.pricing?.tiers || [])
      .map((tier) => tier?.pricePerPack ?? tier?.priceInclTax ?? tier?.priceExclTax)
      .filter((value) => typeof value === "number"),
  );
  if (!prices.length) return "No price";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants[0]?.currency || "NPR";
  if (min === max) return `${currency} ${min.toLocaleString()}`;
  return `${currency} ${min.toLocaleString()}–${max.toLocaleString()}`;
}

export function AdminCatalogMobileView() {
  const [query, setQuery] = useState("");
  const [activeEntry, setActiveEntry] = useState(null);
  const [editorState, setEditorState] = useState(null); // { product, prefill, returnEntryCode }

  const familiesQuery = useGetAdminProductFamiliesQuery();
  const productsQuery = useGetAdminProductsQuery();
  const categoriesQuery = useGetAdminProductCategoriesQuery();

  const families = useMemo(() => familiesQuery.data || [], [familiesQuery.data]);
  const products = useMemo(() => productsQuery.data || [], [productsQuery.data]);
  const categoryOptions = categoriesQuery.data || [];

  const catalogEntries = useMemo(() => {
    const grouped = groupProductsByCode(products);
    return buildCatalogEntries(families, grouped);
  }, [families, products]);

  const visibleEntries = useMemo(
    () =>
      rankBySearch(catalogEntries, query, (entry) => [
        entry.name,
        entry.code,
        entry.category,
        ...entry.variants.flatMap((v) => [v.sku, v.pack?.label]),
      ]),
    [catalogEntries, query],
  );

  const hasCatalogData = families.length > 0 || products.length > 0;
  const loading = !hasCatalogData && (familiesQuery.isLoading || productsQuery.isLoading);
  const loadError =
    familiesQuery.error || productsQuery.error
      ? getQueryErrorMessage(familiesQuery.error || productsQuery.error, "Failed to load the catalog.")
      : "";

  // Keep the open family sheet's data fresh as the underlying query refetches
  // (e.g. right after saving a variant) instead of a stale snapshot.
  const activeEntryLive = activeEntry ? catalogEntries.find((entry) => entry.code === activeEntry.code) || null : null;

  function openEditorForNewVariant(entry) {
    setEditorState({
      product: null,
      prefill: { code: entry.code, name: entry.name, category: entry.category, description: entry.description },
      returnEntryCode: entry.code,
    });
  }

  function openEditorForProduct(product, fromEntryCode) {
    setEditorState({ product, prefill: null, returnEntryCode: fromEntryCode });
  }

  function closeEditor(reopenFamily) {
    const returnCode = editorState?.returnEntryCode;
    setEditorState(null);
    if (reopenFamily && returnCode) {
      const entry = catalogEntries.find((e) => e.code === returnCode);
      if (entry) setActiveEntry(entry);
    }
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => familiesQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Catalog</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader
          title="Catalog"
          contextLabel={`${visibleEntries.length} ${visibleEntries.length === 1 ? "family" : "families"}`}
          trailing={
            <button
              type="button"
              className="admin-m-feed-icon"
              style={{ border: "none" }}
              aria-label="New product"
              onClick={() => setEditorState({ product: null, prefill: null, returnEntryCode: "" })}
            >
              <DashboardIcon name="plus" size={16} strokeWidth={2.2} />
            </button>
          }
        />

        <div style={{ marginTop: 6 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, code, SKU, pack…"
          />
        </div>

        {visibleEntries.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="package" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No products found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visibleEntries.map((entry) => {
              const primaryImage = getPrimaryImage(entry.familyImages) || getPrimaryImage(entry.variants[0]?.images);
              const liveCount = entry.variants.filter((v) => v.isActive !== false).length;
              return (
                <button
                  key={entry._id}
                  type="button"
                  className="admin-m-catalog-card"
                  onClick={() => setActiveEntry(entry)}
                >
                  <span className="admin-m-catalog-thumb">
                    {primaryImage?.url ? (
                      <img src={primaryImage.url} alt="" />
                    ) : (
                      <DashboardIcon name="package" size={22} strokeWidth={1.6} />
                    )}
                  </span>
                  <span className="admin-m-catalog-body">
                    <span className="admin-m-catalog-name">{entry.name}</span>
                    <span className="admin-m-catalog-meta">
                      {entry.variants.length} variant{entry.variants.length === 1 ? "" : "s"} · {liveCount} live
                    </span>
                    <span className="admin-m-catalog-meta">{priceRangeLabel(entry.variants)}</span>
                  </span>
                  <DashboardIcon name="chevron" size={16} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}
      </SkeletonSwap>

      <AdminFamilySheet
        open={Boolean(activeEntryLive)}
        entry={activeEntryLive}
        onClose={() => setActiveEntry(null)}
        onAddVariant={openEditorForNewVariant}
        onEditProduct={(product) => openEditorForProduct(product, activeEntryLive?.code)}
      />

      <AdminProductEditorSheet
        open={Boolean(editorState)}
        product={editorState?.product || null}
        prefill={editorState?.prefill || null}
        categoryOptions={categoryOptions}
        onClose={() => closeEditor(false)}
        onSaved={() => closeEditor(Boolean(editorState?.returnEntryCode))}
      />
    </div>
  );
}
