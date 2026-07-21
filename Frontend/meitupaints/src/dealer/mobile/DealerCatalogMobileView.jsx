import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../pricing.js";
import { useOrderDraft } from "./useOrderDraft.js";
import { ProductSheet } from "./ProductSheet.jsx";
import { TierProgressBar } from "./TierProgressBar.jsx";
import { LargeTitleHeader } from "./LargeTitleHeader.jsx";
import { MobilePushHeader } from "./MobilePushHeader.jsx";
import { SkeletonSwap } from "./SkeletonSwap.jsx";

// Same formatter DealerCatalogPage.jsx uses for its own category grouping
// labels (kept local here too - it's a 4-line pure string transform, not
// worth a cross-page-file export).
function categoryLabel(value) {
  if (!value) return "";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

// One consistent picture per product, regardless of which pack size a
// dealer happens to be looking at - a family with 4 sizes shouldn't show
// items[0]'s photo just because it's first in the array. Falls back to
// that first size's own image only when the family has no dedicated photo
// uploaded yet (DealerCatalogPage.jsx merges ProductFamily.images onto
// each family by code), so a family isn't left with a blank placeholder
// just because nobody's gotten around to giving it its own shot.
function getFamilyImage(family) {
  return getPrimaryImage(family?.images) || getPrimaryImage(family?.items?.[0]?.images);
}

// App Store "Recently Updated"-style horizontal grid: a category's total
// product-family count decides how many rows tall each scrollable column
// is, so a sparse category never gets stretched into an awkwardly tall,
// mostly-empty column, and a dense one gets the full 3-row treatment.
function rowsPerColumnFor(count) {
  if (count <= 2) return 1;
  if (count <= 8) return 2;
  return 3;
}

function chunkIntoColumns(items, rowsPerColumn) {
  const columns = [];
  for (let i = 0; i < items.length; i += rowsPerColumn) {
    columns.push(items.slice(i, i + rowsPerColumn));
  }
  return columns;
}

function lowestPrice(family) {
  const prices = (family.items || [])
    .map((item) => {
      const tiers = item?.pricing?.tiers || [];
      const first = tiers[0];
      return first ? Number(first.pricePerPack ?? first.priceInclTax ?? first.priceExclTax ?? 0) : null;
    })
    .filter((price) => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

// Spec §4.2: Uber Eats browsing speed with Apple product presentation.
// Search/category filtering state is owned by the parent DealerCatalogPage
// (identical logic to the desktop view, just a different render target);
// cart/draft state is owned locally via useOrderDraft() so this view and
// ProductSheet always agree on the same numbers.
export function DealerCatalogMobileView({
  loading,
  loadError,
  onRetry,
  families,
  search,
  onSearchChange,
  categoryOptions,
  activeCategory,
  onCategoryChange,
}) {
  const draft = useOrderDraft();
  const [openFamily, setOpenFamily] = useState(null);

  // A category chevron used to reuse onCategoryChange - the same handler
  // the horizontal pills use - which re-filtered this same "All Products"
  // view in place (losing the grouped browsing context, no way back).
  // This is a separate, purely local "push" instead (mirrors
  // DispatcherCatalogMobileView.jsx exactly): it never touches the
  // parent's activeCategory/URL state at all, so the All Products view
  // underneath is completely undisturbed and still there, exactly as left,
  // the moment this closes.
  const [drilldownCategory, setDrilldownCategory] = useState(null);
  const savedScrollTopRef = useRef(0);

  // One rAF isn't reliably enough: the target view (the tall, grouped All
  // Products layout on the way back in particular) doesn't always finish
  // relayout within a single frame, so a scrollTop assigned too early gets
  // silently clamped to whatever's scrollable at that instant. Retrying at
  // a few points covers that without guessing a single "safe" delay - same
  // multi-attempt reliability pattern already used for exactly this class
  // of problem in ScrollToTop.jsx.
  function applyScrollTop(value) {
    const setIt = () => {
      const el = document.querySelector(".dashboard-main-shell");
      if (el) el.scrollTop = value;
    };
    setIt();
    requestAnimationFrame(() => requestAnimationFrame(setIt));
    setTimeout(setIt, 80);
    setTimeout(setIt, 250);
  }

  function openCategoryDrilldown(group) {
    const scrollEl = document.querySelector(".dashboard-main-shell");
    savedScrollTopRef.current = scrollEl ? scrollEl.scrollTop : 0;
    setDrilldownCategory(group);
    applyScrollTop(0);
  }

  function closeCategoryDrilldown() {
    setDrilldownCategory(null);
    applyScrollTop(savedScrollTopRef.current);
  }

  // "All Products" groups by category (same grouping DealerCatalogPage.jsx's
  // desktop view already does, just without its pagination) so browsing the
  // full catalog reads as sections instead of one long undifferentiated
  // list - picking a specific category chip already narrows to one category,
  // so grouping there would just be a single redundant section header.
  const groupedByCategory = useMemo(() => {
    if (activeCategory !== "ALL") return null;
    const map = new Map();
    for (const family of families) {
      const key = family.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(family);
    }
    return Array.from(map.entries())
      .map(([key, items]) => {
        const rowsPerColumn = rowsPerColumnFor(items.length);
        return {
          key,
          label: categoryLabel(key) || "Uncategorized",
          items,
          columns: chunkIntoColumns(items, rowsPerColumn),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [families, activeCategory]);

  // V3 §2: icon-activated search overlay, replacing the old permanently-
  // pinned bar. `searchClosing` keeps the overlay mounted for one more
  // frame-cycle after Cancel/clear-and-blur so its own reverse CSS
  // animation (dealerSearchOverlayOut) gets to play, rather than the
  // element just vanishing outright the instant `searchOpen` flips false.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function openSearch() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSearchClosing(false);
    setSearchOpen(true);
  }

  function closeSearch({ animate = true } = {}) {
    setSearchOpen(false);
    onSearchChange("");
    if (!animate) {
      setSearchClosing(false);
      return;
    }
    setSearchClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setSearchClosing(false);
    }, 220);
  }

  function handleSearchKeyDown(e) {
    // Keyboard-initiated close skips the animation entirely (constitution:
    // never animate a keyboard-driven action).
    if (e.key === "Escape") closeSearch({ animate: false });
  }

  const showSearchOverlay = searchOpen || searchClosing;

  // Extracted so both the flat list (a specific category chip is active)
  // and the grouped-by-category sections (the "All Products" chip) render
  // identical cards from one place, instead of two copies of this drifting
  // apart over time.
  function renderFamilyCard(family) {
    const price = lowestPrice(family);
    const isPriceless = price === null;
    const primaryImage = getFamilyImage(family);
    const familyLines = draft.cart.filter((line) => line.code === family.code);
    const familyLine = familyLines[0] || null;
    const familyQuantity = familyLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const isSelected = familyLines.length > 0;

    return (
      <div key={family.code}>
        <button
          type="button"
          className={`dealer-m-catalog-card ${isSelected ? "selected" : ""} ${isPriceless ? "priceless" : ""}`}
          onClick={() => setOpenFamily(family)}
        >
          <span className="dealer-m-catalog-card-image">
            {primaryImage?.url ? (
              <img src={primaryImage.url} alt="" />
            ) : (
              <DashboardIcon name="package" size={28} strokeWidth={1.4} />
            )}
          </span>
          <span className="dealer-m-catalog-card-body">
            <span className="dealer-m-catalog-card-name">{family.name}</span>
            <span className="dealer-m-catalog-card-category">{categoryLabel(family.category)}</span>
            <span className={`dealer-m-catalog-card-price ${isPriceless ? "priceless" : ""}`}>
              {isPriceless
                ? "Pricing pending"
                : `From ${formatMoney(price)} · ${family.items.length} size${family.items.length === 1 ? "" : "s"}`}
            </span>
          </span>
          {isSelected ? (
            <span
              className="dealer-m-catalog-card-chip"
              onClick={(e) => {
                e.stopPropagation();
                setOpenFamily(family);
              }}
              role="button"
              tabIndex={-1}
              aria-label={`Edit ${family.name}`}
            >
              ×{familyQuantity}
            </span>
          ) : (
            <span
              className="dealer-m-catalog-card-add"
              onClick={(e) => {
                e.stopPropagation();
                setOpenFamily(family);
              }}
              role="button"
              tabIndex={-1}
              aria-label={`Add ${family.name}`}
            >
              <DashboardIcon name="plus" size={16} strokeWidth={2.2} />
            </span>
          )}
        </button>
        {familyLine ? (
          <TierProgressBar
            variant="nudge"
            tiers={familyLine.pricing?.tiers || []}
            metricValue={familyLine.metricValue}
            activeTier={familyLine.tier}
            pricing={familyLine.pricing}
            productName={family.name}
          />
        ) : null}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dealer-m-catalog">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (drilldownCategory) {
    return (
      <div className="dealer-m-catalog">
        <MobilePushHeader title={drilldownCategory.label} onBack={closeCategoryDrilldown} />
        <div className="dealer-m-catalog-list">{drilldownCategory.items.map(renderFamilyCard)}</div>
        <ProductSheet open={Boolean(openFamily)} onClose={() => setOpenFamily(null)} family={openFamily} draft={draft} />
      </div>
    );
  }

  return (
    <div className="dealer-m-catalog">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Products</div>
            <div className="dealer-m-skel" style={{ height: 44, marginTop: 14, borderRadius: 12 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 24, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 12, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
      <LargeTitleHeader
        title="Products"
        contextLabel={searchOpen && search ? `${families.length} result${families.length === 1 ? "" : "s"}` : null}
        trailing={
          !showSearchOverlay ? (
            <button type="button" className="dealer-m-catalog-search-btn" onClick={openSearch} aria-label="Search products">
              <DashboardIcon name="search" size={18} strokeWidth={2} />
            </button>
          ) : null
        }
        sticky={
          showSearchOverlay ? (
            <div className={`dealer-m-catalog-search-overlay ${searchOpen ? "" : "closing"}`}>
              <div className="dealer-m-catalog-search-overlay-field">
                <DashboardIcon name="search" size={16} strokeWidth={2} />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => {
                    if (!search) closeSearch();
                  }}
                  placeholder="Search paints, primers, SKUs…"
                />
              </div>
              <button type="button" className="dealer-m-catalog-search-cancel" onClick={() => closeSearch()}>
                Cancel
              </button>
            </div>
          ) : null
        }
      />

      <div className="dealer-m-catalog-chips">
        {categoryOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`dealer-m-catalog-chip ${activeCategory === option.key ? "active" : ""}`}
            onClick={() => onCategoryChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {families.length === 0 ? (
        <div className="dealer-m-empty">
          <DashboardIcon name="search" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
          {search ? (
            <>
              <div className="dealer-m-empty-title">No results for &quot;{search}&quot;</div>
              <div className="dealer-m-catalog-suggestions">
                <span className="dealer-m-catalog-suggestions-label">Try:</span>
                {categoryOptions
                  .filter((option) => option.key !== "ALL")
                  .map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="dealer-m-catalog-suggestion-pill"
                      onClick={() => {
                        closeSearch();
                        onCategoryChange(option.key);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <div className="dealer-m-empty-title">No products found</div>
          )}
        </div>
      ) : groupedByCategory ? (
        <div className="dealer-m-catalog-groups">
          {groupedByCategory.map((group) => (
            <div key={group.key} className="dealer-m-catalog-group">
              <button type="button" className="dealer-m-catalog-group-header" onClick={() => openCategoryDrilldown(group)}>
                <span className="dealer-m-catalog-group-label">{group.label}</span>
                <DashboardIcon name="chevron" size={14} strokeWidth={2.4} className="dealer-m-catalog-group-chevron" />
              </button>
              <div className="dealer-m-catalog-scroll-row">
                {group.columns.map((column, index) => (
                  <div key={index} className="dealer-m-catalog-scroll-column">
                    {column.map(renderFamilyCard)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dealer-m-catalog-list">{families.map(renderFamilyCard)}</div>
      )}

      <ProductSheet open={Boolean(openFamily)} onClose={() => setOpenFamily(null)} family={openFamily} draft={draft} />
      </SkeletonSwap>
    </div>
  );
}
