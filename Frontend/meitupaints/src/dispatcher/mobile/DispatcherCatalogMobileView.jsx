import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useDispatcherOrderDraft } from "./useDispatcherOrderDraft.js";
import { DispatcherProductSheet } from "./DispatcherProductSheet.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";

// Mirrors src/dealer/mobile/DealerCatalogMobileView.jsx, minus the
// TierProgressBar nudge under each selected card (no tiers in dispatcher
// pricing - see dispatcherOrderPricing.js). Search/category filtering state
// is owned by the parent DispatcherOrderCatalogPage, same split as the
// dealer version.

function categoryLabel(value) {
  if (!value) return "";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(value) {
  return `NPR ${Number(value || 0).toLocaleString()}`;
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function getFamilyImage(family) {
  return getPrimaryImage(family?.familyImages) || getPrimaryImage(family?.items?.[0]?.images);
}

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
    .map((item) => Number(item.price || 0))
    .filter((price) => price > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function DispatcherCatalogMobileView({
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
  const draft = useDispatcherOrderDraft();
  const [openFamily, setOpenFamily] = useState(null);

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
    if (e.key === "Escape") closeSearch({ animate: false });
  }

  const showSearchOverlay = searchOpen || searchClosing;

  function renderFamilyCard(family) {
    const price = lowestPrice(family);
    const isPriceless = price === null;
    const primaryImage = getFamilyImage(family);
    const familyLines = draft.cart.filter((line) => line.code === family.code);
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
                : `From ${money(price)} · ${family.items.length} size${family.items.length === 1 ? "" : "s"}`}
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

  return (
    <div className="dealer-m-catalog">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Catalog</div>
            <div className="dealer-m-skel" style={{ height: 44, marginTop: 14, borderRadius: 12 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 24, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 12, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 96, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
      <LargeTitleHeader
        title="Catalog"
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
                  placeholder="Search products, SKUs…"
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
            <div className="dealer-m-empty-title">No results for &quot;{search}&quot;</div>
          ) : (
            <div className="dealer-m-empty-title">No products found</div>
          )}
        </div>
      ) : groupedByCategory ? (
        <div className="dealer-m-catalog-groups">
          {groupedByCategory.map((group) => (
            <div key={group.key} className="dealer-m-catalog-group">
              <button type="button" className="dealer-m-catalog-group-header" onClick={() => onCategoryChange(group.key)}>
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

      <DispatcherProductSheet open={Boolean(openFamily)} onClose={() => setOpenFamily(null)} family={openFamily} draft={draft} />
      </SkeletonSwap>
    </div>
  );
}
