import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductOrderLink from "../components/ProductOrderLink.jsx";

export default function ProductDetails({
  product,
  contextLabel,
  heroCaption,
  leadText,
  whyTitle,
  whyText,
  benefits = [],
  features = [],
  detailNote,
  warranty,
  nscertified,
}) {
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || null);
  const navigate = useNavigate();

  // Ensure the page always opens at the top when navigating into a product
  useEffect(() => {
    // Use both window + documentElement for Safari consistency
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [product?.id]);

  /* ===== IMAGE RESOLUTION LOGIC ===== */
  const imageSrc = useMemo(() => {
    if (!selectedSize || !product.sizes) return product.src;
    const base = product.src.replace(".webp", "");
    return `${base} (${selectedSize}).webp`;
  }, [product.src, selectedSize, product.sizes]);

  return (
    <>
      {/* HERO */}
      <section className="product-hero">
        <div className="container py-6">
          <div className="row align-items-center g-5">
            {/* VISUAL */}
            <div className="col-lg-6">
              {/* Mobile/tablet: show product name above image */}
              <div className="mobile-only">
                <span className="context-pill mobile-context">
                  {contextLabel}
                </span>
                <h1 className="headline mobile-headline">{product.name}</h1>
              </div>

              <div className="visual-stage">
                <div className="visual-surface">
                  <img
                    key={imageSrc}
                    src={imageSrc}
                    alt={`${product.name} ${selectedSize || ""}`}
                    className="hero-image fade-swap"
                  />
                </div>

                {/* Mobile/tablet: sizes directly under the image */}
                {product.sizes && (
                  <div className="mobile-only">
                    <div className="size-selector mobile-size-selector">
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
                  </div>
                )}

                <div className="visual-caption">{heroCaption}</div>
              </div>
            </div>

            {/* NARRATIVE */}
            <div className="col-lg-6">
              <div className="narrative">
                <span className="context-pill desktop-only">
                  {contextLabel}
                </span>

                <h1 className="headline desktop-only">{product.name}</h1>

                {selectedSize && (
                  <p className="subline">
                    Selected pack size: <strong>{selectedSize}</strong>
                  </p>
                )}

                {/* SIZE SELECTOR (desktop only; mobile is under image) */}
                {product.sizes && (
                  <div className="size-selector desktop-only">
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
                      <div className="trust-pill trust-pill-secondary">
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
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => navigate(-1)}
                  >
                    Back to collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
      </section>

      <style>{`
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

/* Responsive visibility helpers */
.mobile-only{ display:none; }
.desktop-only{ display:block; }

@media (max-width: 991.98px){
  .mobile-only{ display:block !important; }
  .desktop-only{ display:none !important; }

  /* tighten the mobile headline spacing above the image */
  .mobile-headline{
    margin-bottom:14px;
    font-size:30px;
    line-height:1.15;
  }

  /* keep sizes visually attached to the image */
  .mobile-size-selector{
    margin-top:16px;
    margin-bottom:6px;
  }

  .mobile-context{ margin-bottom:12px; }
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
  width:100%;
  height:auto;
  max-width:520px;
  display:block;
  margin:0 auto;
  object-fit:contain;
  filter:drop-shadow(0 30px 40px rgba(0,0,0,.18));
}
/* Mobile: reduce padding so the image stays visually centered */
@media (max-width: 640px){
  .visual-surface{ padding:26px; border-radius:26px; }
  .hero-image{ max-height:320px; max-width:340px; }
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

/* ================= TRUST (WARRANTY + NS) ================= */
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
`}</style>
    </>
  );
}
