import React, { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import { Link, useLocation } from "react-router-dom";
import ProductOrderLink from "../components/ProductOrderLink.jsx";
import productCategories from "../ProductsList/productCategories.json";
import productsConfig from "../ProductsList/productsConfig.json";

// Load ALL product JSON files from ProductsList without hard-coding imports.
// Vite will include these at build time.
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

function Products() {
  const location = useLocation();

  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem("meitu_products_view");
      return saved === "all" || saved === "categories" ? saved : "categories";
    } catch {
      return "categories";
    }
  }); // "categories" | "all"

  useEffect(() => {
    try {
      localStorage.setItem("meitu_products_view", view);
    } catch {
      // ignore (private mode / blocked storage)
    }
  }, [view]);

  // Always start at the top when arriving on this page (route enter / reload)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.key]);

  // Config-driven route map (editable in ProductsList/productsConfig.json)
  // Keys are normalized via `compactCat()` to avoid casing/spacing mismatches.
  const ROUTE_BASE = useMemo(() => {
    const rb = productsConfig?.routeBase || {};
    const out = {};

    Object.entries(rb).forEach(([k, v]) => {
      if (!v) return;
      out[compactCat(k)] = String(v);
    });

    return out;
  }, []);

  // ALL_GROUPS is now resolved directly via Vite glob and getJsonArrayByKey.
  const ALL_GROUPS = useMemo(() => {
    const cfgGroups = Array.isArray(productsConfig?.groups)
      ? productsConfig.groups
      : [];

    const groups = cfgGroups.map((g) => {
      const datasets = Array.isArray(g.datasets) ? g.datasets : [];

      // Make a lookup: datasetKey -> order index (0,1,2...)
      const datasetRank = new Map(datasets.map((k, i) => [String(k), i]));

      // Build items while preserving which dataset they came from
      const items = datasets.flatMap((k) =>
        getJsonArrayByKey(k).map((p) => ({
          ...p,
          __datasetKey: String(k),
          __rank: datasetRank.get(String(k)) ?? 999, // unknowns go last
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

          // ✅ Regular group: use explicit order field first
          if (isRegular) {
            const ao = Number.isFinite(Number(a.order))
              ? Number(a.order)
              : null;
            const bo = Number.isFinite(Number(b.order))
              ? Number(b.order)
              : null;

            const aHas = ao !== null;
            const bHas = bo !== null;

            // items with order come first, sorted by order asc
            if (aHas && bHas) {
              if (ao !== bo) return ao - bo;
              // tie-breaker (stable + predictable)
              return String(a.name).localeCompare(String(b.name));
            }
            if (aHas) return -1;
            if (bHas) return 1;

            // if neither has order, fall back to existing logic
          }

          // default behavior (all other groups + fallback)
          const r = (a.__rank ?? 999) - (b.__rank ?? 999);
          if (r !== 0) return r;

          return String(a.name).localeCompare(String(b.name));
        });

      return { ...g, items };
    });
  }, []);

  const buildProductLink = (p, fallbackBase) => {
    const raw = p?.category ?? "";
    const key = compactCat(raw);

    // Try normalized lookup, then fallback to the group link, then final safe fallback
    const base = ROUTE_BASE[key] || fallbackBase || "/products";
    return `${base}/${p.id}`;
  };

  return (
    <>
      <NavBar />

      <div className="products-hero">
        <div className="container py-5">
          <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3 mb-4">
            <div>
              <h1 className="display-6 fw-bold mb-2 products-title">
                Products
              </h1>
              <p className="text-muted mb-0">
                Explore our categories crafted for durability, finish, and
                performance.
              </p>
            </div>

            <div className="d-flex gap-2">
              <Link
                to="/ratecalculator"
                className="btn btn-dark btn-lg px-4 rounded-pill"
              >
                Rate Calculator
              </Link>
              <Link
                to="/inquiry"
                className="btn btn-outline-dark btn-lg px-4 rounded-pill"
              >
                Inquiry
              </Link>
            </div>
          </div>

          {/* VIEW PARTITION */}
          <div className="view-switch-wrap">
            <div
              className="view-switch"
              role="tablist"
              aria-label="Products view"
            >
              <button
                type="button"
                className={`view-btn ${view === "all" ? "active" : ""}`}
                onClick={() => setView("all")}
                role="tab"
                aria-selected={view === "all"}
              >
                All
              </button>
              <button
                type="button"
                className={`view-btn ${view === "categories" ? "active" : ""}`}
                onClick={() => setView("categories")}
                role="tab"
                aria-selected={view === "categories"}
              >
                Categories
              </button>
              <span className={`view-glide ${view}`} aria-hidden="true" />
            </div>

            <div className="view-hint">
              {view === "all"
                ? "Browse every product, grouped by collection."
                : "Browse collections and explore categories."}
            </div>
          </div>

          {/* CATEGORIES GRID (UNCHANGED) */}
          {view === "categories" && (
            <div className="row g-4">
              {productCategories.map((c) => (
                <div key={c.id} className="col-12 col-md-6 col-lg-4">
                  <Link to={c.link} className="text-decoration-none">
                    <div className={`product-tile tone-${c.tone}`}>
                      <div className="tile-top">
                        <div>
                          <div className="tile-kicker">Category</div>
                          <h3 className="tile-title">{c.id}</h3>
                          <p className="tile-desc">{c.description}</p>
                        </div>

                        <div className="tile-arrow" aria-hidden="true">
                          <span>→</span>
                        </div>
                      </div>

                      <div className="tile-bottom">
                        <div className="tile-imageWrap">
                          <img src={c.img} alt={c.id} className="tile-image" />
                        </div>

                        <div className="tile-meta">
                          <span className="meta-pill">View Collection</span>
                          <span className="meta-dot" />
                          <span className="meta-text">Premium finishes</span>
                        </div>
                      </div>

                      <div className="tile-accent" aria-hidden="true" />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* ALL PRODUCTS */}
          {view === "all" && (
            <div className="all-wrap">
              {ALL_GROUPS.map((g) => (
                <section key={g.key} className="all-group">
                  <div className="group-head">
                    <div className="group-left">
                      <div className="group-kicker">Collection</div>
                      <h2 className="group-title">{g.title}</h2>
                      <p className="group-desc">{g.desc}</p>
                    </div>

                    <div className="group-right">
                      <Link to={g.link} className="group-cta">
                        View Category →
                      </Link>
                    </div>
                  </div>

                  <div className="row g-4">
                    {g.items.map((p) => {
                      const productLink = buildProductLink(p, g.link);

                      return (
                        <div key={p.id} className="col-12 col-sm-6 col-lg-4">
                          <div className="all-card">
                            <Link to={productLink} className="all-card-link">
                              <div className="all-top">
                                <div className="all-chips">
                                  <span className="all-chip">
                                    {String(p.category || g.key)}
                                  </span>
                                  {Array.isArray(p.sizes) &&
                                  p.sizes.length > 0 ? (
                                    <span className="all-chip soft">
                                      {p.sizes.length} sizes
                                    </span>
                                  ) : null}
                                </div>
                                <div className="all-arrow" aria-hidden="true">
                                  →
                                </div>
                              </div>

                              <div className="all-imageWrap">
                                <img
                                  src={p.src}
                                  alt={p.name}
                                  className="all-image"
                                  loading="lazy"
                                />
                              </div>

                              <div className="all-body">
                                <div className="all-name">{p.name}</div>
                                {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                                  <div className="all-sizes">
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
                                View details
                              </Link>
                              <ProductOrderLink
                                product={p}
                                productName={p.name}
                                className="all-order-link"
                              />
                            </div>

                            <div className="all-accent" aria-hidden="true" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div><style>{`
        :root {
          --brand-red: #c1121f;
          --brand-red-soft: rgba(193, 18, 31, 0.18);
          --brand-red-glow: rgba(193, 18, 31, 0.28);
          --brand-black: #0b0b0c;
          --brand-black-soft: rgba(11, 11, 12, 0.65);
        }

        .products-hero{
          position: relative;
          background:
            radial-gradient(900px 400px at 10% 10%, var(--brand-red-soft), transparent 55%),
            radial-gradient(800px 420px at 90% 20%, rgba(0,0,0,0.08), transparent 55%),
            radial-gradient(900px 520px at 30% 90%, rgba(0,0,0,0.05), transparent 60%),
            #ffffff;
        }

        .products-title{
          letter-spacing: -0.6px;
          color: var(--brand-black);
        }

        /* ===== view switch (premium segmented control) ===== */
        .view-switch-wrap{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
          margin: 14px 0 22px;
        }

        .view-switch{
          position:relative;
          display:inline-flex;
          gap:0;
          border-radius:999px;
          padding:6px;
          background: rgba(255,255,255,0.78);
          border:1px solid rgba(0,0,0,0.10);
          box-shadow:
            0 18px 46px rgba(0,0,0,0.10),
            inset 0 1px 0 rgba(255,255,255,0.60);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          overflow:hidden;
          isolation:isolate;
        }

        /* subtle “glass” sheen */
        .view-switch::before{
          content:"";
          position:absolute;
          inset:0;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.55),
            rgba(255,255,255,0.08)
          );
          opacity:.55;
          pointer-events:none;
          z-index:0;
        }

        .view-btn{
          position:relative;
          z-index:2;
          border:none;
          background:transparent;
          padding:10px 20px;
          border-radius:999px;
          font-weight:850;
          font-size:13px;
          letter-spacing:.01em;
          color: rgba(0,0,0,0.62);
          cursor:pointer;
          transition:
            color 220ms ease,
            transform 220ms ease,
            opacity 220ms ease;
          user-select:none;
          outline:none;
          min-width:110px;
        }

        .view-btn:hover{
          transform: translateY(-1px);
          opacity:.96;
        }

        .view-btn:focus-visible{
          box-shadow: 0 0 0 4px rgba(193,18,31,0.22);
        }

        .view-btn.active{
          color:#fff;
          text-shadow: 0 1px 10px rgba(0,0,0,0.22);
        }

        .view-glide{
          position:absolute;
          top:6px;
          bottom:6px;
          left:6px;
          width: calc(50% - 6px);
          border-radius:999px;
          background: linear-gradient(180deg, rgba(225,29,46,1), var(--brand-red));
          box-shadow:
            0 22px 56px rgba(193,18,31,.32),
            inset 0 1px 0 rgba(255,255,255,.28);
          transition:
            transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
            filter 220ms ease;
          will-change: transform;
          z-index:1;
        }

        /* IMPORTANT: order is All (left) then Categories (right) */
        .view-glide.all{ transform: translateX(0); }
        .view-glide.categories{ transform: translateX(100%); }

        .view-switch:has(.view-btn:hover) .view-glide{
          filter: saturate(1.05) contrast(1.02);
        }

        .view-hint{
          font-size:13px;
          font-weight:650;
          color: rgba(0,0,0,0.55);
        }

        @media (max-width: 520px){
          .view-btn{ min-width: 96px; padding:10px 16px; }
          .view-hint{ display:none; }
        }

        /* ===== categories tile (your existing) ===== */
        .product-tile{
          position: relative;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.06);
          padding: 18px 18px 14px 18px;
          min-height: 260px;
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
          animation: fadeUp 420ms ease;
        }

        .product-tile:hover{
          transform: translateY(-4px);
          box-shadow: 0 18px 46px rgba(0,0,0,0.10);
          border-color: rgba(0,0,0,0.12);
        }

        .tile-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 14px;
          position: relative;
          z-index: 2;
        }

        .tile-kicker{
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.45);
          margin-bottom: 8px;
        }

        .tile-title{
          font-weight: 800;
          letter-spacing: -0.3px;
          margin: 0 0 6px 0;
          color: var(--brand-black);
        }

        .tile-desc{
          margin: 0;
          color: rgba(0,0,0,0.60);
          line-height: 1.35;
          max-width: 28ch;
        }

        .tile-arrow{
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(0,0,0,0.03);
          font-size: 18px;
          font-weight: 800;
          color: rgba(0,0,0,0.65);
          transition: transform 200ms ease, background 200ms ease;
        }

        .product-tile:hover .tile-arrow{
          transform: translateX(2px);
          background: rgba(0,0,0,0.06);
        }

        .tile-bottom{
          margin-top: 18px;
          position: relative;
          z-index: 2;
          display:flex;
          flex-direction: column;
          gap: 12px;
        }

        .tile-imageWrap{
          width: 100%;
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(0,0,0,0.02);
          display:flex;
          align-items:center;
          justify-content:center;
          min-height: 120px;
        }

        .tile-image{
          max-height: 90px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 14px 20px rgba(0,0,0,0.10));
          transform: translateZ(0);
          transition: transform 220ms ease;
        }

        .product-tile:hover .tile-image{ transform: scale(1.03); }

        .tile-meta{
          display:flex;
          align-items:center;
          gap: 10px;
          color: rgba(0,0,0,0.55);
          font-size: 13px;
          font-weight: 600;
        }

        .meta-pill{
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(255,255,255,0.8);
        }

        .meta-dot{
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(0,0,0,0.25);
        }

        .tile-accent{
          position:absolute;
          inset: -1px;
          opacity: 0.75;
          pointer-events:none;
          background: radial-gradient(520px 220px at 10% 15%, var(--toneA), transparent 60%),
                      radial-gradient(520px 220px at 90% 85%, var(--toneB), transparent 55%);
          mix-blend-mode: multiply;
          transition: opacity 200ms ease;
        }

        .product-tile:hover .tile-accent{ opacity: 0.95; }

        /* Tone presets */
        .tone-blue { --toneA: rgba(13,110,253,0.18); --toneB: rgba(0,0,0,0.00); }
        .tone-slate{ --toneA: rgba(108,117,125,0.18); --toneB: rgba(0,0,0,0.00); }
        .tone-amber{ --toneA: rgba(255,193,7,0.20); --toneB: rgba(253,126,20,0.10); }
        .tone-mint { --toneA: rgba(25,135,84,0.16); --toneB: rgba(32,201,151,0.10); }
        .tone-purple{ --toneA: rgba(111,66,193,0.18); --toneB: rgba(214,51,132,0.10); }
        .tone-mono { --toneA: rgba(0,0,0,0.10); --toneB: rgba(0,0,0,0.00); }

        /* ===== All view styles ===== */
        .all-wrap{
          display:flex;
          flex-direction:column;
          gap: 26px;
          padding-top: 6px;
        }

        .all-group{
          padding: 18px 0 4px;
          border-top: 1px solid rgba(0,0,0,0.08);
        }
        .all-group:first-child{ border-top:none; padding-top: 0; }

        .group-head{
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap: 14px;
          flex-wrap:wrap;
          margin-bottom: 14px;
        }

        .group-kicker{
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.45);
          margin-bottom: 6px;
        }

        .group-title{
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.4px;
          color: var(--brand-black);
          font-size: 22px;
        }

        .group-desc{
          margin: 8px 0 0 0;
          color: rgba(0,0,0,0.60);
          max-width: 62ch;
          line-height: 1.55;
          font-weight: 600;
          font-size: 13px;
        }

        .group-cta{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding: 12px 18px;
          border-radius: 999px;
          text-decoration:none;
          font-weight: 800;
          font-size: 13px;
          color: var(--brand-black);
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08);
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
          white-space:nowrap;
        }
        .group-cta:hover{
          transform: translateY(-2px);
          border-color: rgba(0,0,0,0.20);
          box-shadow: 0 18px 46px rgba(0,0,0,0.12);
        }

        .all-card{
          position:relative;
          display:flex;
          flex-direction:column;
          border-radius: 22px;
          overflow:hidden;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.06);
          padding: 16px;
          min-height: 290px;
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
          animation: fadeUp 420ms ease;
        }

        .all-card-link{
          position:relative;
          z-index:2;
          display:flex;
          flex:1;
          flex-direction:column;
          color:inherit;
          text-decoration:none;
        }

        .all-card:hover{
          transform: translateY(-4px);
          box-shadow: 0 18px 46px rgba(0,0,0,0.10);
          border-color: rgba(0,0,0,0.12);
        }

        .all-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
          position:relative;
          z-index:2;
          margin-bottom: 12px;
        }

        .all-chips{
          display:flex;
          gap: 8px;
          flex-wrap:wrap;
        }

        .all-chip{
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid rgba(193,18,31,0.32);
          background: rgba(193,18,31,0.06);
          color: var(--brand-red);
        }

        .all-chip.soft{
          border-color: rgba(0,0,0,0.10);
          background: rgba(0,0,0,0.03);
          color: rgba(0,0,0,0.55);
        }

        .all-arrow{
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display:grid;
          place-items:center;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(0,0,0,0.03);
          font-size: 18px;
          font-weight: 900;
          color: rgba(0,0,0,0.60);
          transition: transform 200ms ease, background 200ms ease;
        }

        .all-card:hover .all-arrow{
          transform: translateX(2px);
          background: rgba(0,0,0,0.06);
        }

        .all-imageWrap{
          width: 100%;
          border-radius: 18px;
          padding: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(0,0,0,0.02);
          display:flex;
          align-items:center;
          justify-content:center;
          min-height: 140px;
          position:relative;
          z-index:2;
        }

        .all-image{
          max-height: 112px;
          width:auto;
          object-fit:contain;
          filter: drop-shadow(0 16px 26px rgba(0,0,0,0.12));
          transition: transform 220ms ease;
          transform: translateZ(0);
        }

        .all-card:hover .all-image{ transform: scale(1.04); }

        .all-body{
          margin-top: 14px;
          display:flex;
          flex-direction:column;
          gap: 10px;
          position:relative;
          z-index:2;
        }

        .all-name{
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: var(--brand-black);
          line-height: 1.28;
        }

        .all-sizes{
          display:flex;
          flex-wrap:wrap;
          gap: 8px;
        }

        .size-pill{
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(255,255,255,0.86);
          color: rgba(0,0,0,0.60);
        }

        .size-pill.more{
          border-color: rgba(193,18,31,0.30);
          background: rgba(193,18,31,0.06);
          color: var(--brand-red);
        }

        .all-actions{
          position:relative;
          z-index:2;
          display:grid;
          grid-template-columns: 1fr;
          gap:10px;
          margin-top:16px;
        }

        .all-detail-link,
        .all-order-link{
          min-height:42px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:0 14px;
          text-decoration:none;
          font-size:13px;
          font-weight:900;
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .all-detail-link{
          color: var(--brand-black);
          border:1px solid rgba(0,0,0,.10);
          background:rgba(255,255,255,.86);
        }

        .all-order-link{
          color:#fff;
          border:1px solid rgba(193,18,31,.18);
          background:linear-gradient(135deg, var(--brand-red), #ff5b2e);
          box-shadow:0 16px 28px rgba(193,18,31,.20);
        }

        .all-detail-link:hover,
        .all-order-link:hover{
          transform:translateY(-1px);
        }

        .all-accent{
          position:absolute;
          inset:-1px;
          pointer-events:none;
          opacity: .72;
          background:
            radial-gradient(520px 240px at 12% 18%, rgba(193,18,31,0.14), transparent 60%),
            radial-gradient(520px 240px at 92% 86%, rgba(0,0,0,0.06), transparent 55%);
          mix-blend-mode: multiply;
          transition: opacity 200ms ease;
        }
        .all-card:hover .all-accent{ opacity: .92; }

        .btn-dark{
          background: var(--brand-black);
          border-color: var(--brand-black);
        }
        .btn-dark:hover{
          background: var(--brand-red);
          border-color: var(--brand-red);
        }

        @keyframes fadeUp{
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .carousel-reveal{
          opacity: 0;
          transform: translateY(18px);
          animation: carouselFadeUp 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 120ms;
        }

        @keyframes carouselFadeUp{
          to{ opacity: 1; transform: translateY(0); }
        }

        @media(max-width: 768px){
          .view-hint{ display:none; }
          .group-title{ font-size:20px; }
        }
      `}</style>
    </>
  );
}

export default Products;
