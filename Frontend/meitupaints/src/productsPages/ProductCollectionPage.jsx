import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M19 12H6" />
    <path d="m11 6-6 6 6 6" />
  </svg>
);

const BoxIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
    <path d="M4 7.5v9L12 21l8-4.5v-9" />
    <path d="M12 12v9" />
  </svg>
);

const normalizeList = (items) => {
  if (Array.isArray(items)) return items;
  if (items && typeof items === "object") return Object.values(items);
  return [];
};

export default function ProductCollectionPage({
  eyebrow,
  title,
  description,
  routeBase,
  searchPlaceholder = "Search products...",
  categories = [],
  products = [],
  defaultCategory,
  detailHint = "Details • sizes • finish",
}) {
  const normalizedCategories = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        items: normalizeList(category.items),
      })),
    [categories]
  );

  const hasCategories = normalizedCategories.length > 0;
  const firstCategory = defaultCategory || normalizedCategories[0]?.key || "all";
  const [selectedCategory, setSelectedCategory] = useState(firstCategory);
  const [query, setQuery] = useState("");

  const activeCategory = useMemo(
    () => normalizedCategories.find((category) => category.key === selectedCategory),
    [normalizedCategories, selectedCategory]
  );

  const sourceProducts = useMemo(() => {
    if (hasCategories) return activeCategory?.items || [];
    return normalizeList(products);
  }, [activeCategory, hasCategories, products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sourceProducts;
    return sourceProducts.filter((product) => {
      const haystack = [
        product?.name,
        product?.id,
        product?.category,
        product?.size,
        ...(Array.isArray(product?.sizes) ? product.sizes : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, sourceProducts]);

  const activeLabel = hasCategories ? activeCategory?.label || selectedCategory : title;
  const productCount = sourceProducts.length;

  return (
    <>
      <NavBar />
      <main className="apple-collection-page">
        <section className="apple-collection-hero">
          <div className="apple-collection-shell">
            <Link to="/products" className="apple-back-link">
              <BackIcon />
              Back to products
            </Link>

            <p className="apple-collection-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>

            <div className="apple-collection-actions">
              <Link to="/ratecalculator" className="apple-blue-pill">
                Rate Calculator
              </Link>
              <Link to="/products" className="apple-inline-link">
                All products <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <section className="apple-collection-toolbar" aria-label="Collection filters">
          <div className="apple-collection-toolbar-inner">
            {hasCategories ? (
              <div className="apple-segmented" role="tablist" aria-label="Product category">
                {normalizedCategories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={selectedCategory === category.key ? "active" : ""}
                    onClick={() => setSelectedCategory(category.key)}
                    role="tab"
                    aria-selected={selectedCategory === category.key}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="apple-toolbar-title">
                <span>Collection</span>
                <strong>{title}</strong>
              </div>
            )}

            <div className="apple-search-field">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search products"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  ×
                </button>
              ) : null}
            </div>
          </div>

          <div className="apple-collection-counts">
            <span>
              Showing <strong>{filtered.length}</strong> of <strong>{productCount}</strong>
            </span>
            <span>{activeLabel}</span>
          </div>
        </section>

        <section className="apple-product-grid-wrap">
          {filtered.length > 0 ? (
            <div className="apple-product-grid">
              {filtered.map((product) => {
                const sizes = Array.isArray(product?.sizes)
                  ? product.sizes
                  : product?.size
                    ? [product.size]
                    : [];
                const productLabel = hasCategories
                  ? activeCategory?.label || selectedCategory
                  : product?.category || title;

                return (
                  <Link key={product.id} to={`${routeBase}/${product.id}`} className="apple-product-card">
                    {product.sale ? <span className="apple-sale-pill">Sale</span> : null}
                    <div className="apple-product-media">
                      <img src={product.src} alt={product.name} loading="lazy" />
                    </div>
                    <div className="apple-product-info">
                      <div className="apple-product-kicker">
                        <BoxIcon />
                        <span>{productLabel}</span>
                      </div>
                      <h2>{product.name}</h2>
                      {sizes.length ? (
                        <div className="apple-product-sizes" aria-label="Available sizes">
                          {sizes.slice(0, 4).map((size) => (
                            <span key={size}>{size}</span>
                          ))}
                          {sizes.length > 4 ? <span>+{sizes.length - 4}</span> : null}
                        </div>
                      ) : null}
                      <div className="apple-product-foot">
                        <span>{detailHint}</span>
                        <ArrowIcon />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="apple-empty-state">
              <strong>No products found.</strong>
              <span>Try another search term or switch collection.</span>
            </div>
          )}
        </section>
      </main>

      <style>{`
        .apple-collection-page {
          min-height: 100vh;
          padding-top: 0;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .apple-collection-page svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.85;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex: 0 0 auto;
        }

        .apple-collection-hero {
          padding: clamp(14px, 3vw, 34px) 24px clamp(18px, 3vw, 30px);
          text-align: center;
          background: var(--meitu-home-hero-gradient);
        }

        .apple-collection-shell {
          max-width: 1020px;
          margin: 0 auto;
          position: relative;
        }

        .apple-back-link {
          position: absolute;
          left: 0;
          top: -12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 14px;
          letter-spacing: -0.04px;
          cursor: pointer;
        }

        .apple-collection-eyebrow {
          margin: 0 0 10px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.36px;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-collection-hero h1 {
          max-width: 980px;
          margin: 0 auto;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(40px, 6vw, 72px);
          line-height: 1.05;
          font-weight: 700;
          letter-spacing: -0.022em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-collection-hero p:not(.apple-collection-eyebrow) {
          max-width: 680px;
          margin: 14px auto 0;
          font-size: clamp(17px, 1.8vw, 21px);
          line-height: 1.38;
          font-weight: 300;
          letter-spacing: -0.01em;
          color: var(--color-graphite, #707070);
        }

        .apple-collection-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 22px;
          margin-top: 22px;
        }

        .apple-blue-pill,
        .apple-inline-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          text-decoration: none;
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
        }

        .apple-blue-pill {
          min-height: 38px;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--apple-control-blue, #0071e3);
          color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          font-weight: 400;
          transition: background-color .1s ease, transform .1s ease;
        }

        .apple-inline-link {
          color: var(--color-cobalt-link, #0066cc);
        }
        .apple-blue-pill:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          transform: translateY(-1px);
        }

        .apple-collection-toolbar {
          position: sticky;
          top: 44px;
          z-index: 8;
          padding: 12px 24px;
          background: rgba(245, 245, 247, 0.84);
          border-top: 1px solid rgba(232, 232, 237, 0.72);
          border-bottom: 1px solid rgba(232, 232, 237, 0.9);
          backdrop-filter: blur(20px);
        }

        .apple-collection-toolbar-inner,
        .apple-collection-counts,
        .apple-product-grid-wrap {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
        }

        .apple-collection-toolbar-inner {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(260px, 440px);
          gap: 16px;
          align-items: center;
        }

        .apple-toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .apple-toolbar-title span,
        .apple-collection-counts {
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .apple-toolbar-title strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: -0.2px;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-segmented {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          gap: 4px;
          padding: 4px;
          overflow-x: auto;
          border-radius: 999px;
          background: rgba(210, 210, 215, 0.64);
          backdrop-filter: blur(20px);
          scrollbar-width: none;
        }

        .apple-segmented::-webkit-scrollbar { display: none; }

        .apple-segmented button {
          min-height: 34px;
          padding: 0 16px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(0, 0, 0, 0.56);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.04px;
          white-space: nowrap;
          cursor: pointer;
        }

        .apple-segmented button.active {
          background: #fff;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-search-field {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--color-silver-mist, #e8e8ed);
        }

        .apple-search-field input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--color-ink, #1d1d1f);
          font-size: 15px;
          letter-spacing: -0.04px;
        }

        .apple-search-field button {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-graphite, #707070);
          cursor: pointer;
        }

        .apple-collection-counts {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 10px;
        }

        .apple-product-grid-wrap {
          padding: 44px 24px 96px;
        }

        .apple-product-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
        }

        .apple-product-card {
          position: relative;
          display: flex;
          min-height: 100%;
          flex-direction: column;
          padding: 18px;
          border-radius: 28px;
          background: #fff;
          color: var(--color-ink, #1d1d1f);
          text-decoration: none;
          overflow: hidden;
          transition: background-color 0.1s ease, transform 0.344s ease;
        }

        .apple-product-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.9);
        }

        .apple-sale-pill {
          position: absolute;
          top: 18px;
          left: 18px;
          z-index: 2;
          padding: 5px 10px;
          border-radius: 999px;
          background: var(--color-caution, #b64400);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .apple-product-media {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 230px;
          padding: 24px;
          border-radius: 24px;
          background: var(--color-fog, #f5f5f7);
        }

        .apple-product-media img {
          display: block;
          max-width: 100%;
          max-height: 172px;
          width: auto;
          object-fit: contain;
          filter: none;
          transition: transform 0.344s ease;
        }

        .apple-product-card:hover .apple-product-media img {
          transform: scale(1.025);
        }

        .apple-product-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 11px;
          padding: 18px 4px 0;
        }

        .apple-product-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .apple-product-info h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 24px;
          line-height: 1.16;
          font-weight: 700;
          letter-spacing: -0.006em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-product-sizes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .apple-product-sizes span {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          color: var(--color-graphite, #707070);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: -0.26px;
        }

        .apple-product-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: auto;
          padding-top: 14px;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 15px;
          letter-spacing: -0.04px;
        }

        .apple-empty-state {
          display: grid;
          gap: 6px;
          justify-items: center;
          padding: 48px 24px;
          border-radius: 28px;
          background: #fff;
          text-align: center;
        }

        .apple-empty-state strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 24px;
          letter-spacing: -0.36px;
        }

        .apple-empty-state span {
          color: var(--color-graphite, #707070);
        }

        @media (max-width: 1020px) {
          .apple-product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .apple-collection-toolbar-inner { grid-template-columns: 1fr; }
        }

        @media (max-width: 680px) {
          .apple-collection-hero { padding-top: 14px; }
          .apple-collection-toolbar { position: static; }
          .apple-product-grid { grid-template-columns: 1fr; }
          .apple-back-link { position: static; margin-bottom: 22px; }
          .apple-collection-counts { align-items: flex-start; flex-direction: column; }
          .apple-segmented { width: 100%; }
          .apple-segmented button { flex: 1; }
        }
      `}</style>
    </>
  );
}
