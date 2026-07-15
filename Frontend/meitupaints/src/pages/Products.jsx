import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import { Link, useLocation } from "react-router-dom";
import productCategories from "../ProductsList/productCategories.json";
import productsConfig from "../ProductsList/productsConfig.json";

const PRODUCTS_MODULES = import.meta.glob("../ProductsList/*.json", {
  eager: true,
});

const getJsonArrayByKey = (key) => {
  if (!key) return [];
  const mod = PRODUCTS_MODULES[`../ProductsList/${key}.json`];
  const data = mod?.default ?? mod;
  return Array.isArray(data) ? data : [];
};

const normCat = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

const compactCat = (v) => normCat(v).replace(/\s+/g, "");

const ArrowIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const StackIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
    <path d="m4 12 8 4.5 8-4.5" />
    <path d="m4 16.5 8 4.5 8-4.5" />
  </svg>
);

const DetailIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 6h14" />
    <path d="M5 12h14" />
    <path d="M5 18h9" />
  </svg>
);

const SPOTLIGHTS = [
  {
    label: "Exterior systems",
    title: "Gloss, weather resistance, and color depth.",
    description: "High-performance buckets for exterior walls that need a clean finish and durable film.",
    image: "/Regular/exterior/Meitu Eco-Friendly High Glossy Exterior Wall Paint.webp",
    color: "#0071e3",
    link: "/regular",
  },
  {
    label: "Texture systems",
    title: "Stone-like surfaces with architectural character.",
    description: "Granite, 3D, liquid granite, and real stone finishes for premium facades.",
    image: "/3d/Meitu Granite 3D Imitation Stone Paint.webp",
    color: "#596680",
    link: "/granite",
  },
  {
    label: "Color experience",
    title: "A complete palette for every project mood.",
    description: "Explore room-ready shades and color references before selecting the final finish.",
    image: "/Colorant/RLZ.webp",
    color: "#f500b4",
    link: "/colors",
  },
  {
    label: "Worksite essentials",
    title: "Professional tools that support a cleaner finish.",
    description: "Rollers, accessories, and support products arranged for fast dealer discovery.",
    image: "/Utilities.webp",
    color: "#1d1d1f",
    link: "/utilities",
  },
];

function Products() {
  const location = useLocation();

  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem("meitu_products_view");
      return saved === "all" || saved === "categories" ? saved : "categories";
    } catch {
      return "categories";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("meitu_products_view", view);
    } catch {
      // ignore private mode / blocked storage
    }
  }, [view]);

  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const activeSpotlight = SPOTLIGHTS[spotlightIndex] || SPOTLIGHTS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % SPOTLIGHTS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.key]);

  const ROUTE_BASE = useMemo(() => {
    const rb = productsConfig?.routeBase || {};
    const out = {};

    Object.entries(rb).forEach(([k, v]) => {
      if (!v) return;
      out[compactCat(k)] = String(v);
    });

    return out;
  }, []);

  const ALL_GROUPS = useMemo(() => {
    const cfgGroups = Array.isArray(productsConfig?.groups)
      ? productsConfig.groups
      : [];

    const groups = cfgGroups.map((g) => {
      const datasets = Array.isArray(g.datasets) ? g.datasets : [];
      const datasetRank = new Map(datasets.map((k, i) => [String(k), i]));

      const items = datasets.flatMap((k) =>
        getJsonArrayByKey(k).map((p) => ({
          ...p,
          __datasetKey: String(k),
          __rank: datasetRank.get(String(k)) ?? 999,
        }))
      );

      return {
        key: g.key,
        title: g.title,
        desc: g.desc,
        link: g.link,
        items,
      };
    });

    return groups.map((g) => {
      const items = (Array.isArray(g.items) ? g.items : [])
        .map((p) => ({
          ...p,
          __cat: String(p.category || g.key)
            .trim()
            .toLowerCase(),
        }))
        .sort((a, b) => {
          const isRegular = compactCat(g.key) === "regular";

          if (isRegular) {
            const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : null;
            const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : null;
            const aHas = ao !== null;
            const bHas = bo !== null;

            if (aHas && bHas) {
              if (ao !== bo) return ao - bo;
              return String(a.name).localeCompare(String(b.name));
            }
            if (aHas) return -1;
            if (bHas) return 1;
          }

          const r = (a.__rank ?? 999) - (b.__rank ?? 999);
          if (r !== 0) return r;

          return String(a.name).localeCompare(String(b.name));
        });

      return { ...g, items };
    });
  }, []);

  const productCount = useMemo(
    () => ALL_GROUPS.reduce((sum, group) => sum + group.items.length, 0),
    [ALL_GROUPS]
  );

  const buildProductLink = (p, fallbackBase) => {
    const raw = p?.category ?? "";
    const key = compactCat(raw);
    const base = ROUTE_BASE[key] || fallbackBase || "/products";
    return `${base}/${p.id}`;
  };

  return (
    <>
      <NavBar />

      <main className="apple-products-page">
        <section className="products-hero" aria-labelledby="products-title">
          <div className="products-hero-inner">
            <div className="products-hero-copy">
              <p className="products-kicker">Meitu product systems</p>
              <h1 id="products-title" className="products-title">
                Choose the right finish for every surface.
              </h1>
              <p className="products-copy">
                Buckets, colors, textures, tools, and specialty coatings arranged
                as one premium surface system.
              </p>

              <div className="products-hero-actions" aria-label="Product actions">
                <Link to="/ratecalculator" className="apple-primary-pill">
                  Rate Calculator
                </Link>
                <Link to="/inquiry" className="apple-text-link">
                  Talk to Meitu <ArrowIcon />
                </Link>
              </div>

              <div className="products-metrics" aria-label="Catalog summary">
                <div>
                  <strong>{productCategories.length}</strong>
                  <span>collections</span>
                </div>
                <div>
                  <strong>{productCount}</strong>
                  <span>products</span>
                </div>
                <div>
                  <strong>3</strong>
                  <span>ways to browse</span>
                </div>
              </div>
            </div>

            <aside
              className="products-spotlight"
              aria-label="Featured product system"
              style={{ "--spotlight": activeSpotlight.color }}
            >
              <div className="spotlight-aura" aria-hidden="true" />
              <div className="spotlight-stage">
                <img
                  key={activeSpotlight.image}
                  src={activeSpotlight.image}
                  alt=""
                  className="spotlight-image"
                />
                <div className="spotlight-orbit orbit-one" aria-hidden="true" />
                <div className="spotlight-orbit orbit-two" aria-hidden="true" />
              </div>
              <div className="spotlight-caption">
                <p>{activeSpotlight.label}</p>
                <h2>{activeSpotlight.title}</h2>
                <span>{activeSpotlight.description}</span>
                <Link to={activeSpotlight.link} className="spotlight-link">
                  Explore <ArrowIcon />
                </Link>
              </div>
              <div className="spotlight-controls" aria-label="Product spotlight carousel">
                {SPOTLIGHTS.map((slide, index) => (
                  <button
                    key={slide.label}
                    type="button"
                    className={index === spotlightIndex ? "active" : ""}
                    aria-label={`Show ${slide.label}`}
                    aria-pressed={index === spotlightIndex}
                    onClick={() => setSpotlightIndex(index)}
                  />
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="products-controls" aria-label="Product view controls">
          <div className="products-controls-inner">
            <div className="products-control-copy">
              <span>Browse</span>
              <strong>
                {view === "all" ? "Every product" : "Product collections"}
              </strong>
            </div>

            <div
              className="view-switch"
              role="tablist"
              aria-label="Products view"
            >
              <button
                type="button"
                className={`view-btn ${view === "categories" ? "active" : ""}`}
                onClick={() => setView("categories")}
                role="tab"
                aria-selected={view === "categories"}
              >
                Categories
              </button>
              <button
                type="button"
                className={`view-btn ${view === "all" ? "active" : ""}`}
                onClick={() => setView("all")}
                role="tab"
                aria-selected={view === "all"}
              >
                All products
              </button>
              <span className={`view-glide ${view}`} aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="products-content">
          {view === "categories" && (
            <div className="products-category-grid">
              {productCategories.map((c) => (
                <Link key={c.id} to={c.link} className="product-tile">
                  <div className="tile-copy">
                    <div className="tile-kicker">Collection</div>
                    <h3 className="tile-title">{c.id}</h3>
                    <p className="tile-desc">{c.description}</p>
                  </div>

                  <div className="tile-imageWrap">
                    <img src={c.img} alt={c.id} className="tile-image" />
                  </div>

                  <div className="tile-meta">
                    <span className="tile-meta-text">View collection</span>
                    <span className="tile-arrow" aria-hidden="true">
                      <ArrowIcon />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {view === "all" && (
            <div className="all-wrap">
              {ALL_GROUPS.map((g) => (
                <section key={g.key} className="all-group">
                  <div className="group-head">
                    <div>
                      <div className="group-kicker">Collection</div>
                      <h2 className="group-title">{g.title}</h2>
                      <p className="group-desc">{g.desc}</p>
                    </div>
                    <Link to={g.link} className="group-cta">
                      View category <ArrowIcon />
                    </Link>
                  </div>

                  <div className="products-all-grid">
                    {g.items.map((p) => {
                      const productLink = buildProductLink(p, g.link);

                      return (
                        <article key={p.id} className="all-card">
                          <Link to={productLink} className="all-card-link">
                            <div className="all-imageWrap">
                              <img
                                src={p.src}
                                alt={p.name}
                                className="all-image"
                                loading="lazy"
                              />
                            </div>

                            <div className="all-body">
                              <div className="all-kicker">
                                <StackIcon />
                                <span>{String(p.category || g.key)}</span>
                              </div>
                              <h3 className="all-name">{p.name}</h3>
                              {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                                <div className="all-sizes" aria-label="Available sizes">
                                  {p.sizes.slice(0, 4).map((s) => (
                                    <span key={s} className="size-pill">
                                      {s}
                                    </span>
                                  ))}
                                  {p.sizes.length > 4 && (
                                    <span className="size-pill more">
                                      +{p.sizes.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </Link>

                          <div className="all-actions">
                            <Link to={productLink} className="all-detail-link">
                              <DetailIcon />
                              Details
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>

      <style>{`
        .apple-products-page {
          min-height: 100vh;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          padding-top: 0;
        }

        .apple-products-page svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.85;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex: 0 0 auto;
        }

        .apple-products-page .products-hero {
          background: var(--meitu-home-hero-gradient) !important;
          padding: clamp(46px, 7vw, 86px) 24px clamp(38px, 6vw, 72px) !important;
          overflow: hidden;
        }

        .products-hero-inner {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, .92fr) minmax(340px, 1.08fr);
          gap: clamp(32px, 6vw, 84px);
          align-items: center;
        }

        .products-hero-copy {
          text-align: left;
        }

        .products-kicker {
          margin: 0 0 10px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.36px;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-products-page .products-title {
          max-width: 980px;
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(48px, 8vw, 92px) !important;
          line-height: 1.04 !important;
          font-weight: 700 !important;
          letter-spacing: -0.022em !important;
          color: var(--color-ink, #1d1d1f) !important;
        }

        .products-copy {
          max-width: 680px;
          margin: 22px 0 0;
          font-size: clamp(18px, 2.2vw, 24px);
          line-height: 1.35;
          font-weight: 300;
          letter-spacing: -0.01em;
          color: var(--color-graphite, #707070);
        }

        .products-hero-actions {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 22px;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .apple-primary-pill,
        .apple-text-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          text-decoration: none;
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
        }

        .apple-primary-pill {
          min-height: 38px;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--apple-control-blue, #0071e3);
          color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          font-weight: 400;
          transition: background-color .1s ease, transform .1s ease;
        }

        .apple-text-link {
          color: var(--color-cobalt-link, #0066cc);
        }

        .products-metrics {
          display: inline-grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          margin-top: 44px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 28px;
          background: var(--color-silver-mist, #e8e8ed);
        }

        .products-metrics div {
          min-width: 150px;
          padding: 18px 24px;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(20px);
        }

        .products-metrics strong,
        .products-metrics span {
          display: block;
        }

        .products-metrics strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -0.005em;
          color: var(--color-ink, #1d1d1f);
        }

        .products-metrics span {
          margin-top: 2px;
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .products-spotlight {
          position: relative;
          min-height: clamp(520px, 52vw, 660px);
          display: grid;
          align-content: end;
          border-radius: 28px;
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(20px);
          overflow: hidden;
          isolation: isolate;
        }

        .spotlight-aura {
          position: absolute;
          inset: -24% -18% 16%;
          background:
            radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--spotlight) 30%, transparent), transparent 58%),
            radial-gradient(circle at 24% 28%, rgba(245,0,180,.13), transparent 30%),
            radial-gradient(circle at 78% 16%, rgba(0,113,227,.14), transparent 34%),
            radial-gradient(circle at 50% 90%, rgba(223,231,79,.16), transparent 34%);
          filter: blur(1px);
          opacity: .95;
          animation: spotlightAura 6s ease-in-out infinite alternate;
          z-index: -1;
        }

        .spotlight-stage {
          position: absolute;
          inset: 20px 20px 170px;
          display: grid;
          place-items: center;
          border-radius: 26px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.58), rgba(245,245,247,.22)),
            radial-gradient(circle at 50% 64%, rgba(29,29,31,.08), transparent 34%);
        }

        .spotlight-image {
          width: min(76%, 410px);
          max-height: 360px;
          object-fit: contain;
          filter: drop-shadow(0 18px 32px rgba(29,29,31,.13));
          animation: spotlightFloat 4.8s ease-in-out infinite;
        }

        .spotlight-orbit {
          position: absolute;
          border: 1px solid rgba(29,29,31,.08);
          border-radius: 999px;
          pointer-events: none;
        }

        .orbit-one {
          width: 72%;
          aspect-ratio: 1 / .46;
          transform: rotate(-8deg);
        }

        .orbit-two {
          width: 48%;
          aspect-ratio: 1 / .5;
          transform: rotate(12deg);
          opacity: .58;
        }

        .spotlight-caption {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 8px;
          padding: 0 28px 26px;
        }

        .spotlight-caption p {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .spotlight-caption h2 {
          max-width: 520px;
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(28px, 3.6vw, 44px);
          line-height: 1.08;
          font-weight: 700;
          letter-spacing: -0.018em;
          color: var(--color-ink, #1d1d1f);
        }

        .spotlight-caption span {
          max-width: 520px;
          color: var(--color-graphite, #707070);
          font-size: 15px;
          line-height: 1.44;
        }

        .spotlight-link {
          width: max-content;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 4px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 15px;
          letter-spacing: -0.1px;
        }

        .spotlight-controls {
          position: absolute;
          right: 22px;
          bottom: 26px;
          z-index: 3;
          display: inline-flex;
          gap: 7px;
          padding: 7px;
          border-radius: 999px;
          background: rgba(210,210,215,.64);
          backdrop-filter: blur(20px);
        }

        .spotlight-controls button {
          width: 8px;
          height: 8px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(29,29,31,.25);
          cursor: pointer;
          transition: width .344s ease, background-color .1s ease;
        }

        .spotlight-controls button.active {
          width: 24px;
          background: var(--color-ink, #1d1d1f);
        }

        .products-controls {
          position: sticky;
          top: 44px;
          z-index: 8;
          padding: 12px 24px;
          background: rgba(245, 245, 247, 0.82);
          border-top: 1px solid rgba(232, 232, 237, 0.7);
          border-bottom: 1px solid rgba(232, 232, 237, 0.88);
          backdrop-filter: blur(20px);
        }

        .products-controls-inner {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .products-control-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .products-control-copy span {
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .products-control-copy strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: -0.2px;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-products-page .view-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: auto;
          padding: 4px;
          border: 0 !important;
          border-radius: 999px;
          background: rgba(210, 210, 215, 0.64) !important;
          box-shadow: none !important;
          backdrop-filter: blur(20px);
          isolation: isolate;
        }

        .apple-products-page .view-btn {
          position: relative;
          z-index: 2;
          min-width: 128px;
          height: 34px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(0, 0, 0, 0.56) !important;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.04px;
          cursor: pointer;
          outline: none;
          transition: color 0.18s ease;
        }

        .apple-products-page .view-btn.active {
          color: var(--color-ink, #1d1d1f) !important;
        }

        .apple-products-page .view-btn:focus-visible {
          box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.18);
        }

        .apple-products-page .view-glide {
          position: absolute;
          top: 4px;
          bottom: 4px;
          left: 4px;
          width: calc(50% - 4px);
          border-radius: 999px;
          background: #fff !important;
          box-shadow: none !important;
          z-index: 1;
          transition: transform 0.344s ease;
        }

        .apple-products-page .view-glide.categories { transform: translateX(0); }
        .apple-products-page .view-glide.all { transform: translateX(100%); }

        .products-content {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          padding: 44px 24px 96px;
        }

        .products-category-grid,
        .products-all-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
        }

        .apple-products-page .product-tile,
        .apple-products-page .all-card {
          min-height: auto !important;
          position: relative;
          border: 0;
          border-radius: 28px;
          background: #fff;
          box-shadow: none;
          color: var(--color-ink, #1d1d1f);
          text-decoration: none;
          overflow: hidden;
          isolation: isolate;
          transition: background-color 0.1s ease, transform 0.344s ease;
        }

        .apple-products-page .product-tile {
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 22px;
          padding: 28px;
        }

        .apple-products-page .product-tile::before {
          content: "";
          position: absolute;
          left: -42%;
          right: -42%;
          bottom: -48%;
          height: 82%;
          background:
            radial-gradient(ellipse at 50% 12%, rgba(255,255,255,.82) 0 18%, transparent 50%),
            radial-gradient(ellipse at 22% 70%, rgba(0,113,227,.13), transparent 48%),
            radial-gradient(ellipse at 62% 72%, rgba(245,0,180,.08), transparent 46%),
            radial-gradient(ellipse at 82% 78%, rgba(223,231,79,.16), transparent 44%);
          opacity: .62;
          filter: blur(18px);
          mask-image: linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.58) 50%, transparent 100%);
          transform: translateY(28px) scale(1.08);
          transition: opacity .344s ease, transform .344s ease;
          z-index: -1;
        }

        .apple-products-page .product-tile::after {
          content: "";
          position: absolute;
          inset: 0;
          border: 1.5px solid rgba(0, 113, 227, 0);
          border-radius: inherit;
          pointer-events: none;
          transition:
            border-color .344s ease,
            opacity .344s ease,
            transform .344s ease;
          opacity: 0;
          transform: scale(.992);
        }

        .apple-products-page .product-tile:nth-child(2)::before {
          background:
            radial-gradient(ellipse at 50% 12%, rgba(255,255,255,.82) 0 18%, transparent 50%),
            radial-gradient(ellipse at 30% 74%, rgba(168,211,251,.26), transparent 46%),
            radial-gradient(ellipse at 70% 76%, rgba(0,18,249,.16), transparent 48%),
            radial-gradient(ellipse at 54% 86%, rgba(37,53,224,.14), transparent 46%);
          opacity: .46;
        }

        .apple-products-page .product-tile:nth-child(3)::before {
          background:
            radial-gradient(ellipse at 50% 12%, rgba(255,255,255,.82) 0 18%, transparent 50%),
            radial-gradient(ellipse at 34% 74%, rgba(255,179,71,.2), transparent 48%),
            radial-gradient(ellipse at 74% 80%, rgba(182,68,0,.12), transparent 46%);
        }

        .apple-products-page .product-tile:nth-child(4)::before {
          background:
            radial-gradient(ellipse at 50% 12%, rgba(255,255,255,.82) 0 18%, transparent 50%),
            radial-gradient(ellipse at 28% 74%, rgba(223,231,79,.22), transparent 48%),
            radial-gradient(ellipse at 68% 80%, rgba(10,134,26,.13), transparent 46%);
          opacity: .44;
        }

        .apple-products-page .product-tile:nth-child(5)::before {
          background:
            radial-gradient(ellipse at 50% 12%, rgba(255,255,255,.82) 0 18%, transparent 50%),
            radial-gradient(ellipse at 30% 74%, rgba(243,196,246,.24), transparent 48%),
            radial-gradient(ellipse at 72% 80%, rgba(245,0,180,.12), transparent 46%);
          opacity: .44;
        }

        .apple-products-page .product-tile:hover::before {
          opacity: .72;
          transform: translateY(18px) scale(1.12);
        }

        .apple-products-page .product-tile:hover::after {
          border-color: rgba(0, 113, 227, .34);
          opacity: 1;
          transform: scale(1);
        }

        .apple-products-page .product-tile:hover,
        .apple-products-page .all-card:hover {
          transform: translateY(-2px) !important;
          background: rgba(255, 255, 255, 0.9);
        }

        .tile-kicker,
        .group-kicker,
        .all-kicker {
          text-transform: none;
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .tile-title,
        .group-title,
        .all-name {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          color: var(--color-ink, #1d1d1f) !important;
        }

        .tile-title {
          margin: 4px 0 8px;
          font-size: clamp(28px, 3vw, 40px);
          line-height: 1.12;
          font-weight: 700;
          letter-spacing: -0.016em;
        }

        .tile-desc {
          max-width: 26ch;
          margin: 0;
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
          color: var(--color-graphite, #707070);
        }

        .apple-products-page .tile-imageWrap,
        .apple-products-page .all-imageWrap {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0 !important;
          border-radius: 24px !important;
          background: var(--color-fog, #f5f5f7) !important;
        }

        .apple-products-page .tile-imageWrap {
          min-height: 230px;
          padding: 28px;
          overflow: hidden;
        }

        .apple-products-page .tile-image,
        .apple-products-page .all-image {
          display: block;
          max-width: 100%;
          width: auto;
          object-fit: contain;
          filter: none !important;
          transition: transform 0.344s ease;
        }

        .apple-products-page .tile-image {
          max-height: 170px;
        }

        .apple-products-page .product-tile:hover .tile-image,
        .apple-products-page .all-card:hover .all-image {
          transform: scale(1.025);
        }

        .tile-meta {
          width: max-content;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 7px;
          position: relative;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--color-cobalt-link, #0066cc) !important;
          font-size: 17px;
          font-weight: 400;
          letter-spacing: -0.1px;
        }

        .tile-meta-text {
          position: relative;
          display: inline-block;
        }

        .tile-meta-text::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -3px;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform .344s ease;
        }

        .tile-arrow {
          width: 17px;
          height: 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--color-cobalt-link, #0066cc) !important;
          transition: transform .344s ease;
        }

        .apple-products-page .product-tile:hover .tile-meta-text::after {
          transform: scaleX(1);
        }

        .apple-products-page .product-tile:hover .tile-arrow {
          transform: translateX(3px);
        }

        .all-wrap {
          display: grid;
          gap: 76px;
        }

        .all-group {
          padding: 0;
          border: 0;
        }

        .group-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .group-title {
          margin: 4px 0 0;
          font-size: clamp(32px, 5vw, 56px);
          line-height: 1.07;
          font-weight: 700;
          letter-spacing: -0.016em;
        }

        .group-desc {
          max-width: 680px;
          margin: 12px 0 0;
          font-size: 20px;
          line-height: 1.4;
          font-weight: 300;
          letter-spacing: -0.2px;
          color: var(--color-graphite, #707070);
        }

        .group-cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          white-space: nowrap;
          font-size: 17px;
          letter-spacing: -0.1px;
        }

        .apple-products-page .all-card {
          display: flex;
          flex-direction: column;
          padding: 18px;
        }

        .all-card-link {
          display: flex;
          flex: 1;
          flex-direction: column;
          color: inherit;
          text-decoration: none;
        }

        .apple-products-page .all-imageWrap {
          min-height: 205px;
          padding: 20px;
        }

        .apple-products-page .all-image {
          max-height: 152px;
        }

        .all-body {
          display: flex;
          flex-direction: column;
          gap: 11px;
          padding: 18px 4px 0;
        }

        .all-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .all-name {
          margin: 0;
          font-size: 22px;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.005em;
        }

        .all-sizes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .apple-products-page .size-pill {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 5px 10px;
          border: 1px solid var(--color-silver-mist, #e8e8ed) !important;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7) !important;
          color: var(--color-graphite, #707070) !important;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: -0.26px;
        }

        .apple-products-page .size-pill.more {
          color: var(--color-ink, #1d1d1f) !important;
        }

        .all-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
          margin-top: 18px;
        }

        .all-detail-link,
        .all-order-link {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.04px;
          transition: opacity 0.1s ease;
        }

        .all-detail-link {
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          background: #fff;
          color: var(--color-ink, #1d1d1f);
        }

        .all-order-link {
          border: 1px solid rgba(255,255,255,.18);
          background: var(--apple-control-blue, #0071e3);
          color: #fff;
          font-weight: 400;
        }

        .all-detail-link:hover,
        .all-order-link:hover,
        .group-cta:hover {
          opacity: 0.82;
        }
        .apple-primary-pill:hover,
        .all-order-link:hover {
          opacity: 1;
          background: var(--apple-control-blue-hover, #0077ed);
          transform: translateY(-1px);
        }

        @keyframes spotlightFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -10px, 0) scale(1.012); }
        }

        @keyframes spotlightAura {
          from { transform: translate3d(-1%, -1%, 0) scale(1); }
          to { transform: translate3d(1%, 1%, 0) scale(1.04); }
        }

        @media (max-width: 991px) {
          .products-hero-inner {
            grid-template-columns: 1fr;
          }

          .products-hero-copy {
            text-align: center;
          }

          .products-copy,
          .apple-products-page .products-title {
            margin-left: auto;
            margin-right: auto;
          }

          .products-hero-actions {
            justify-content: center;
          }

          .products-category-grid,
          .products-all-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .group-head {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 720px) {
          .apple-products-page {
            padding-top: 44px;
          }

          .apple-products-page .products-hero {
            padding-top: 28px !important;
          }

          .products-spotlight {
            min-height: 470px;
          }

          .spotlight-stage {
            inset: 16px 16px 176px;
          }

          .spotlight-caption {
            padding: 0 20px 22px;
          }

          .spotlight-controls {
            right: 18px;
            bottom: 22px;
          }

          .products-controls {
            position: static;
          }

          .products-controls-inner {
            align-items: stretch;
            flex-direction: column;
          }

          .apple-products-page .view-switch,
          .apple-products-page .view-btn {
            width: 100%;
          }

          .products-category-grid,
          .products-all-grid {
            grid-template-columns: 1fr;
          }

          .products-metrics {
            width: 100%;
            grid-template-columns: 1fr;
          }

          .products-metrics div {
            min-width: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .spotlight-image,
          .spotlight-aura {
            animation: none;
          }
          .apple-products-page .product-tile,
          .apple-products-page .all-card,
          .apple-products-page .tile-image,
          .apple-products-page .all-image {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

export default Products;
