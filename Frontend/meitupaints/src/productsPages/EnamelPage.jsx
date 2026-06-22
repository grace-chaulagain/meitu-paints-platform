import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import NavBar from "../components/NavBar";
import ProductOrderLink from "../components/ProductOrderLink.jsx";
import paintsSpecialty from "../ProductsList/paintsSpecialty.json";

export default function Enamel() {
  const location = useLocation();
  const topRef = useRef(null);

  // Prevent the browser from restoring previous scroll position on SPA navigation
  useLayoutEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // ignore
    }
  }, []);

  // Always jump to the top on route entry + reload (no animation)
  useLayoutEffect(() => {
    const jumpTop = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      topRef.current?.scrollIntoView?.({ block: "start" });
    };

    jumpTop();
    const raf = requestAnimationFrame(jumpTop);
    const t0 = window.setTimeout(jumpTop, 0);
    const t50 = window.setTimeout(jumpTop, 50);
    const t150 = window.setTimeout(jumpTop, 150);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(t50);
      window.clearTimeout(t150);
    };
  }, [location.pathname]);

  const ENAMEL_COLORS = [
    { name: "White", rgb: "rgb(248, 250, 251)" },
    { name: "Chocolate", rgb: "rgb(93, 51, 23)" },
    { name: "Black", rgb: "rgb(0, 0, 0)" },
    { name: "Po Red", rgb: "rgb(190, 19, 40)" },
    { name: "Leaf Brown", rgb: "rgb(127, 76, 53)" },
    { name: "Phiroza", rgb: "rgb(1, 105, 130)" },
    { name: "Smoke Gray", rgb: "rgb(120, 125, 133)" },
    { name: "Bus Green", rgb: "rgb(38, 116, 76)" },
    { name: "Golden Brown", rgb: "rgb(132, 67, 0)" },
    { name: "Golden Yellow", rgb: "rgb(255, 178, 7)" },
    { name: "Sky Blue", rgb: "rgb(134, 210, 255)" },
    { name: "Olive Green", rgb: "rgb(73, 125, 74)" },
    { name: "Mint Green", rgb: "rgb(73, 125, 74)" },
    { name: "Oxford Blue", rgb: "rgb(0, 33, 72)" },
    { name: "Deep Orange", rgb: "rgb(255, 52, 25)" },
  ];

  const [showColors, setShowColors] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [colorModalOpen, setColorModalOpen] = useState(false);

  const colorsSectionRef = useRef(null);
  useEffect(() => {
    if (showColors && colorsSectionRef.current) {
      colorsSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showColors]);

  useEffect(() => {
    if (!colorModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setColorModalOpen(false);
        setActiveColor(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [colorModalOpen]);

  const id = "oth-002";
  const product = paintsSpecialty.find((p) => p.id === id);

  if (!product) return null;

  const backLink = "/specialty";
  const contextLabel = "Supporting & Specialty Series";
  const heroCaption = "Supporting layers. Professional results.";
  const leadText = product.leadtext;
  const whyTitle = "Why this product exists";
  const whyText =
    "High-quality finishes depend on what lies beneath. These formulations ensure system compatibility, protection, and surface readiness.";
  const benefits = [
    "Enhances surface performance",
    "Improves topcoat adhesion",
    "Protects underlying substrates",
    "Compatible with multiple systems",
  ];
  const features = product.features;
  const detailNote =
    "Ideal for primers, sealers, protective layers, and specialty coatings.";
  const warranty = product.warranty;
  const nscertified = product.nscertified;
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || null);

  /* ===== IMAGE RESOLUTION LOGIC ===== */
  const imageSrc = useMemo(() => {
    if (!selectedSize || !product.sizes) return product.src;
    const base = product.src.replace(".webp", "");
    return `${base} (${selectedSize}).webp`;
  }, [product.src, selectedSize, product.sizes]);

  return (
    <>
      <div ref={topRef} style={{ height: 0, overflow: "hidden" }} />
      <NavBar />
      {/* HERO */}
      <section className="product-hero">
        <div className="container py-6">
          <div className="row align-items-center g-5">
            {/* VISUAL */}
            <div className="col-lg-6">
              <div className="visual-stage">
                <div className="visual-surface">
                  <img
                    key={imageSrc}
                    src={imageSrc}
                    alt={`${product.name} ${selectedSize || ""}`}
                    className="hero-image fade-swap"
                  />
                </div>
                <div className="visual-caption">{heroCaption}</div>
              </div>
            </div>

            {/* NARRATIVE */}
            <div className="col-lg-6">
              <div className="narrative">
                <div className="context-row">
                  <span className="context-pill">{contextLabel}</span>
                </div>

                <h1 className="headline">{product.name}</h1>

                {selectedSize && (
                  <p className="subline">
                    Selected pack size: <strong>{selectedSize}</strong>
                  </p>
                )}

                {/* SIZE SELECTOR */}
                {product.sizes && (
                  <div className="size-selector">
                    <span className="size-label">Available sizes</span>
                    <div className="size-options">
                      {product.sizes.map((size) => (
                        <button
                          key={size}
                          className={`size-pill ${
                            selectedSize === size ? "active" : ""
                          }`}
                          onClick={() => setSelectedSize(size)}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!!warranty || !!nscertified ? (
                  <div
                    className="trust-row"
                    aria-label="Product assurance information"
                  >
                    {!!warranty ? (
                      <div className="trust-pill">
                        <span className="trust-dot" aria-hidden="true" />
                        <span className="trust-label">Warranty</span>
                        <span className="trust-value">{warranty}</span>
                      </div>
                    ) : null}

                    {!!nscertified ? (
                      <div className="trust-pill trust-pill-secondary">
                        <span className="trust-check" aria-hidden="true">
                          ✓
                        </span>
                        <span className="trust-label">Certification</span>
                        <span className="trust-value">NS Certified</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <p className="lead-text">{leadText}</p>

                <div className="action-row">
                  <ProductOrderLink
                    product={product}
                    productName={product.name}
                    className="primary-action"
                  />
                  <Link to={backLink} className="secondary-action">
                    Back to collection
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COLORS CTA (below product, above details) */}
      <section className="colors-cta-wrap" aria-label="Enamel colors">
        <div className="container">
          <div className="colors-cta-row">
            <button
              className={`context-pill ghost view-colors ${
                showColors ? "active" : ""
              }`}
              onClick={() => setShowColors((v) => !v)}
              type="button"
              aria-expanded={showColors}
              aria-controls="enamel-colors-section"
            >
              <span className="view-colors-text">
                {showColors ? "Hide enamel colors" : "Show enamel colors"}
              </span>
            </button>
          </div>
        </div>
      </section>

      {showColors && (
        <section
          id="enamel-colors-section"
          className="colors-section"
          ref={colorsSectionRef}
        >
          <div className="container py-6">
            <div className="colors-header">
              <h3>Available enamel colors</h3>
              <p>Professionally curated shades for durable enamel finishes.</p>
            </div>

            <div className="row g-4">
              {ENAMEL_COLORS.map((color) => (
                <div key={color.name} className="col-6 col-md-3">
                  <button
                    type="button"
                    className="color-card"
                    onClick={() => {
                      setActiveColor(color);
                      setColorModalOpen(true);
                    }}
                    aria-label={`View ${color.name} details`}
                  >
                    <div
                      className="color-swatch"
                      style={{ background: color.rgb }}
                    />
                    <div className="color-meta">
                      <span className="color-name">{color.name}</span>
                      <span className="color-rgb">{color.rgb}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {colorModalOpen && activeColor && (
        <div
          className="color-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeColor.name} color details`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setColorModalOpen(false);
              setActiveColor(null);
            }
          }}
        >
          <div className="color-modal-card">
            <div className="color-modal-top">
              <div
                className="color-modal-swatch"
                style={{ background: activeColor.rgb }}
              />

              <button
                type="button"
                className="color-modal-close"
                aria-label="Close"
                onClick={() => {
                  setColorModalOpen(false);
                  setActiveColor(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="color-modal-body">
              <div className="color-modal-kicker">Enamel Color</div>
              <h3 className="color-modal-title">{activeColor.name}</h3>

              <div className="color-modal-sub">
                <span className="chip">{activeColor.rgb}</span>
              </div>

              <p className="color-modal-lead">
                Durable enamel finish shade for professional applications. Tell
                us your surface type and approximate coverage and we’ll
                recommend the right system.
              </p>

              <div className="color-modal-actions">
                <Link
                  to="/inquiry"
                  className="color-modal-cta"
                  onClick={() => {
                    setColorModalOpen(false);
                    setActiveColor(null);
                  }}
                >
                  Enquire about this color
                </Link>

                <button
                  type="button"
                  className="color-modal-secondary"
                  onClick={() => {
                    setColorModalOpen(false);
                    setActiveColor(null);
                  }}
                >
                  Back to colors
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS */}
      <section className="details-section">
        <div className="container py-6">
          <div className="row g-5">
            <div className="col-lg-6">
              <div className="detail-block">
                <h3>{whyTitle}</h3>
                <p>{whyText}</p>
              </div>

              {benefits.length > 0 && (
                <div className="detail-block">
                  <h3>Key benefits</h3>
                  <ul className="benefits">
                    {benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="col-lg-6">
              {features.length > 0 && (
                <div className="detail-block">
                  <h3>Technical features</h3>
                  <ul className="features">
                    {features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {detailNote && <div className="detail-note">{detailNote}</div>}
            </div>
          </div>
        </div>
      </section><style>{`
:root{
  --red:#c1121f;
  --black:#0b0b0c;
  --ink70:rgba(11,11,12,.7);
  --ink55:rgba(11,11,12,.55);
}

/* Spacing */
.py-6{
  padding-top:6rem;
  padding-bottom:6rem;
}

/* ================= HERO ================= */
.product-hero{
  background:
    radial-gradient(900px 420px at 15% 10%, rgba(193,18,31,.12), transparent 60%),
    radial-gradient(700px 420px at 85% 30%, rgba(0,0,0,.06), transparent 55%),
    #fff;
  animation:fadeUp 420ms ease;
}

.visual-stage{
  position:relative;
}

.visual-surface{
  border-radius:32px;
  padding:48px;
  background:#fff;
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 30px 60px rgba(0,0,0,.12);
  display:flex;
  align-items:center;
  justify-content:center;
}

.hero-image{
  max-height:420px;
  max-width:100%;
  width:100%;
  height:auto;
  display:block;
  margin:auto;
  object-fit:contain;
  object-position:center;
  filter:drop-shadow(0 30px 40px rgba(0,0,0,.18));
}

/* Smooth image swap on size change */
.fade-swap{
  animation:imageFade 240ms ease;
}

@keyframes imageFade{
  from{opacity:.6;transform:scale(.98);}
  to{opacity:1;transform:scale(1);}
}

.visual-caption{
  margin-top:16px;
  font-size:13px;
  color:var(--ink55);
  text-align:center;
  letter-spacing:.04em;
  text-transform:uppercase;
}

/* ================= NARRATIVE ================= */
.context-pill{
  display:inline-block;
  padding:10px 18px;
  border-radius:999px;
  border:1px solid rgba(193,18,31,.35);
  background:rgba(193,18,31,.06);
  color:var(--red);
  font-size:12px;
  font-weight:600;
  margin-bottom:18px;
}

.headline{
  font-size:38px;
  font-weight:500;
  letter-spacing:-.6px;
  line-height:1.15;
  color:var(--black);
  margin-bottom:14px;
}

.subline{
  color:var(--ink55);
  font-size:15px;
  margin-bottom:12px;
}

/* ================= SIZE SELECTOR ================= */
.size-selector{
  margin:18px 0 10px;
}

.size-label{
  display:block;
  font-size:12px;
  color:var(--ink55);
  letter-spacing:.08em;
  text-transform:uppercase;
  margin-bottom:10px;
}

.size-options{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.size-pill{
  padding:10px 18px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.18);
  background:#fff;
  font-size:14px;
  font-weight:500;
  cursor:pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.size-pill:hover{
  transform:translateY(-1px);
  box-shadow:0 12px 24px rgba(0,0,0,.12);
}

.size-pill.active{
  background:rgba(193,18,31,.08);
  border-color:rgba(193,18,31,.45);
  color:var(--red);
  box-shadow:0 14px 30px rgba(193,18,31,.25);
}

/* ================= AVAILABILITY ================= */
.availability{
  display:flex;
  align-items:center;
  gap:10px;
  margin:22px 0;
  font-size:14px;
  color:var(--ink70);
}

.availability-dot{
  width:10px;
  height:10px;
  border-radius:50%;
  background:var(--red);
}

/* ================= LEAD TEXT ================= */
.lead-text{
  font-size:17px;
  color:var(--ink70);
  max-width:520px;
  margin-bottom:32px;
}

/* ================= ACTIONS ================= */
.action-row{
  display:flex;
  gap:18px;
  flex-wrap:wrap;
}

.primary-action{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:16px 34px;
  border-radius:999px;
  background:var(--red);
  color:#fff;
  font-weight:600;
  text-decoration:none;
  cursor:pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
  box-shadow:0 20px 40px rgba(193,18,31,.35);
}

.primary-action:hover{
  transform:translateY(-1px);
  background:#a50f1a;
  box-shadow:0 24px 48px rgba(193,18,31,.45);
}

.secondary-action{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:16px 34px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.18);
  color:var(--black);
  text-decoration:none;
  font-weight:600;
  background:#fff;
  cursor:pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.secondary-action:hover{
  transform:translateY(-1px);
  border-color:rgba(0,0,0,.35);
  box-shadow:0 12px 24px rgba(0,0,0,.12);
}

/* ================= DETAILS ================= */
.details-section{
  background:#fafafa;
}

.detail-block{
  margin-bottom:40px;
}

.detail-block h3{
  font-size:18px;
  font-weight:600;
  margin-bottom:12px;
  color:var(--black);
}

.detail-block p{
  font-size:16px;
  color:var(--ink70);
  max-width:520px;
}

.benefits,
.features{
  list-style:none;
  padding-left:0;
  color:var(--ink70);
}

.benefits li,
.features li{
  padding-left:26px;
  margin-bottom:12px;
  position:relative;
}

.benefits li::before{
  content:"✔";
  position:absolute;
  left:0;
  color:var(--red);
}

.features li::before{
  content:"–";
  position:absolute;
  left:0;
  color:var(--black);
}

.detail-note{
  font-size:14px;
  color:var(--ink55);
  max-width:420px;
}

/* ================= ANIMATION ================= */
@keyframes fadeUp{
  from{
    opacity:0;
    transform:translateY(10px);
  }
  to{
    opacity:1;
    transform:translateY(0);
  }
}

/* ================= CONTEXT ROW ================= */
.context-row{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin-bottom:18px;
}

.context-pill.ghost{
  background:rgba(0,0,0,.04);
  border:1px solid rgba(0,0,0,.14);
  color:var(--black);
  cursor:pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
  position:relative;
  isolation:isolate;
  overflow:hidden;
}

.context-pill.ghost:hover{
  transform:translateY(-1px);
  box-shadow:0 12px 24px rgba(0,0,0,.12);
}

.context-pill.ghost.active{
  background:rgba(193,18,31,.08);
  border-color:rgba(193,18,31,.45);
  color:var(--red);
  box-shadow:0 14px 30px rgba(193,18,31,.25);
}

/* Premium CTA for "View enamel colors" */
.context-pill.ghost.view-colors{
  border-color:rgba(193,18,31,.35);
  background:linear-gradient(135deg, rgba(193,18,31,.12), rgba(193,18,31,.04));
  box-shadow:
    0 18px 40px rgba(193,18,31,.16),
    0 10px 22px rgba(0,0,0,.10);
  font-weight:700;
  letter-spacing:.02em;
  display:inline-flex;
  align-items:center;
  gap:10px;
  padding:12px 20px;
}

.context-pill.ghost.view-colors::before{
  content:"";
  position:absolute;
  inset:-2px;
  background:linear-gradient(120deg, rgba(193,18,31,.55), rgba(193,18,31,0));
  opacity:.22;
  transform:translateX(-22%);
  z-index:-1;
}

.context-pill.ghost.view-colors::after{
  content:"";
  position:absolute;
  top:-40%;
  left:-30%;
  width:60%;
  height:180%;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
  transform:rotate(18deg) translateX(-120%);
  opacity:.55;
  pointer-events:none;
}

.context-pill.ghost.view-colors:hover{
  border-color:rgba(193,18,31,.55);
  box-shadow:
    0 22px 52px rgba(193,18,31,.22),
    0 14px 30px rgba(0,0,0,.14);
}

.context-pill.ghost.view-colors:hover::after{
  animation:shimmer 900ms ease forwards;
}

.context-pill.ghost.view-colors .view-colors-icon{
  width:22px;
  height:22px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  filter:drop-shadow(0 10px 16px rgba(193,18,31,.25));
}

.context-pill.ghost.view-colors.active{
  background:linear-gradient(135deg, rgba(193,18,31,.22), rgba(193,18,31,.08));
  border-color:rgba(193,18,31,.65);
  color:var(--red);
  box-shadow:
    0 24px 62px rgba(193,18,31,.28),
    0 14px 30px rgba(0,0,0,.12);
}

@keyframes shimmer{
  to{ transform:rotate(18deg) translateX(260%); }
}

/* Subtle attention cue on first load */
@media (prefers-reduced-motion: no-preference){
  .context-pill.ghost.view-colors{
    animation:ctaPulse 1800ms ease 2;
  }
  @keyframes ctaPulse{
    0%,100%{ transform:translateY(0); }
    45%{ transform:translateY(-1px); }
    60%{ transform:translateY(0); }
  }
}

/* ================= COLORS CTA ================= */
.colors-cta-wrap{
  background:#fff;
  padding:0 0 28px;
}

.colors-cta-row{
  display:flex;
  justify-content:center;
  align-items:center;
  padding:0 0 10px;
}

/* ================= COLORS SECTION ================= */
.colors-section{
  background:#fff;
  animation:fadeUp 420ms ease;
}

.colors-header{
  max-width:520px;
  margin-bottom:42px;
}

.colors-header h3{
  font-size:22px;
  font-weight:600;
  color:var(--black);
  margin-bottom:8px;
}

.colors-header p{
  font-size:15px;
  color:var(--ink55);
}

/* ================= COLOR CARD ================= */
.color-card{
  width:100%;
  text-align:left;
  border-radius:22px;
  overflow:hidden;
  background:#fff;
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 16px 36px rgba(0,0,0,.12);
  transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  cursor:pointer;
  padding:0;
  appearance:none;
  -webkit-appearance:none;
  outline:none;
}

.color-card:focus-visible{
  box-shadow:0 0 0 4px rgba(193,18,31,.18), 0 16px 36px rgba(0,0,0,.12);
  border-color:rgba(193,18,31,.35);
}

.color-card:hover{
  transform:translateY(-4px);
  box-shadow:0 26px 56px rgba(0,0,0,.18);
}

.color-swatch{
  height:120px;
}

.color-meta{
  padding:16px;
  display:flex;
  flex-direction:column;
  gap:6px;
}

.color-name{
  font-size:14px;
  font-weight:600;
  color:var(--black);
}

.color-rgb{
  font-size:12px;
  color:var(--ink55);
  letter-spacing:.02em;
}
/* ================= COLOR MODAL (PREMIUM) ================= */
.color-modal{
  position:fixed;
  inset:0;
  z-index:1200;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(11,11,12,.44);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  animation:modalFade 180ms ease;
}

@keyframes modalFade{
  from{opacity:0;}
  to{opacity:1;}
}

.color-modal-card{
  width:min(560px, 100%);
  border-radius:28px;
  background:
    radial-gradient(700px 340px at 20% 5%, rgba(193,18,31,.18), transparent 55%),
    radial-gradient(700px 340px at 85% 35%, rgba(0,0,0,.10), transparent 60%),
    #ffffff;
  border:1px solid rgba(255,255,255,.65);
  box-shadow:0 34px 90px rgba(0,0,0,.35);
  overflow:hidden;
  transform:translateY(4px);
  animation:modalUp 220ms ease;
}

@keyframes modalUp{
  from{opacity:.8; transform:translateY(14px) scale(.99);}
  to{opacity:1; transform:translateY(4px) scale(1);}
}

.color-modal-top{
  position:relative;
  padding:18px;
}

.color-modal-swatch{
  height:220px;
  border-radius:22px;
  border:1px solid rgba(0,0,0,.12);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);
}

.color-modal-close{
  position:absolute;
  top:18px;
  right:18px;
  width:38px;
  height:38px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.10);
  background:rgba(255,255,255,.78);
  color:rgba(11,11,12,.8);
  font-size:22px;
  line-height:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.color-modal-close:hover{
  transform:translateY(-1px);
  background:rgba(255,255,255,.92);
  box-shadow:0 14px 30px rgba(0,0,0,.16);
}

.color-modal-body{
  padding:4px 26px 26px;
}

.color-modal-kicker{
  font-size:12px;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--ink55);
  margin-bottom:10px;
}

.color-modal-title{
  font-size:26px;
  font-weight:600;
  letter-spacing:-.4px;
  color:var(--black);
  margin:0 0 10px;
}

.color-modal-sub{
  display:flex;
  gap:10px;
  align-items:center;
  margin-bottom:14px;
}

.chip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:8px 12px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.14);
  background:rgba(0,0,0,.04);
  color:rgba(11,11,12,.75);
  font-size:12px;
  letter-spacing:.02em;
}

.color-modal-lead{
  font-size:15px;
  color:var(--ink70);
  margin:0 0 18px;
  max-width:520px;
}

.color-modal-actions{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
}

.color-modal-cta{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:14px 22px;
  border-radius:999px;
  background:var(--red);
  color:#fff;
  font-weight:600;
  text-decoration:none;
  box-shadow:0 18px 40px rgba(193,18,31,.36);
  transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.color-modal-cta:hover{
  transform:translateY(-1px);
  background:#a50f1a;
  box-shadow:0 22px 46px rgba(193,18,31,.44);
}

.color-modal-secondary{
  padding:14px 22px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.18);
  background:#fff;
  color:var(--black);
  font-weight:600;
  cursor:pointer;
  transition:transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.color-modal-secondary:hover{
  transform:translateY(-1px);
  border-color:rgba(0,0,0,.32);
  box-shadow:0 12px 24px rgba(0,0,0,.12);
}

@media (max-width: 640px){
  .color-modal-swatch{ height:190px; }
  .color-modal-body{ padding:4px 18px 20px; }
  .color-modal-title{ font-size:22px; }
  .visual-surface{ padding:22px; }
  .hero-image{ max-height:320px; }
  .context-pill.ghost.view-colors{ width:100%; justify-content:center; }
  .context-row{ gap:10px; }
  .colors-cta-wrap{ padding:0 0 18px; }
  .colors-cta-row{ padding:0 0 6px; }
}
.trust-row{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin:18px 0 12px;
}

.trust-pill{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 14px;
  border-radius:999px;
  background:rgba(11,11,12,.03);
  border:1px solid rgba(0,0,0,.10);
  box-shadow:0 14px 30px rgba(0,0,0,.08);
  backdrop-filter:saturate(160%);
  -webkit-backdrop-filter:saturate(160%);
}

.trust-pill-secondary{
  background:rgba(193,18,31,.06);
  border-color:rgba(193,18,31,.22);
}

.trust-dot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:var(--red);
  box-shadow:0 0 0 4px rgba(193,18,31,.12);
}

.trust-check{
  width:18px;
  height:18px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  font-weight:700;
  color:#fff;
  background:var(--red);
  box-shadow:0 0 0 4px rgba(193,18,31,.12);
}

.trust-label{
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:var(--ink55);
  font-weight:600;
}

.trust-value{
  font-size:14px;
  color:var(--black);
  font-weight:600;
}

@media (max-width: 640px){
  .trust-row{ margin-top:14px; }
  .trust-pill{ width:100%; justify-content:space-between; }
}
`}</style>
    </>
  );
}
