import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import NavBar from "../components/NavBar";
import paintRates from "../ProductsList/ratesData.json";
import SYSTEMS from "../ProductsList/ratecalculatorSystems.json";
import {
  ArrowIcon,
  CalculatorIcon,
  PaletteIcon,
  ShieldIcon,
  StoreIcon,
} from "../components/ui/ApplePageIcons.jsx";

const CATEGORIES = [
  "All",
  "Exterior",
  "Interior",
  "Granite (Exterior and Interior)",
  "Specialty",
  "RealStone",
  "Enamel",
];

const AREA_STEP = 50;

function assetPath(src = "") {
  const clean = String(src).trim();
  if (!clean) return "";
  if (/^(https?:)?\/\//.test(clean) || clean.startsWith("/")) return clean;
  return `/${clean}`;
}

function getStartingRate(rates = {}) {
  const values = Object.values(rates)
    .map(Number)
    .filter((rate) => Number.isFinite(rate));
  return values.length ? Math.min(...values) : null;
}

function normalizeAreaValue(value) {
  if (value === "") return "";
  const next = Number(value);
  if (!Number.isFinite(next)) return "";
  return String(Math.max(0, next));
}

export default function RateCalculator() {
  const location = useLocation();
  const pageRef = useRef(null);
  const builderRef = useRef(null);
  const resultRef = useRef(null);
  const [area, setArea] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeProductId, setActiveProductId] = useState(null);
  const [activeSystemKey, setActiveSystemKey] = useState("");

  const activeProduct = useMemo(
    () => paintRates.find((product) => product.id === activeProductId) || null,
    [activeProductId],
  );

  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") return paintRates;
    return paintRates.filter((product) => product.category === activeCategory);
  }, [activeCategory]);

  const availableSystems = useMemo(() => {
    if (!activeProduct) return [];
    return SYSTEMS.filter((system) => activeProduct.rates?.[system.key] != null);
  }, [activeProduct]);

  const ratePerSqft = activeProduct?.rates?.[activeSystemKey] ?? null;
  const selectedSystem = useMemo(
    () => SYSTEMS.find((system) => system.key === activeSystemKey) || null,
    [activeSystemKey],
  );
  const productRates = useMemo(() => {
    if (!activeProduct?.rates) return [];
    return Object.values(activeProduct.rates)
      .map(Number)
      .filter((rate) => Number.isFinite(rate));
  }, [activeProduct]);
  const startingRate = productRates.length ? Math.min(...productRates) : null;
  const total =
    area && ratePerSqft != null ? Number(area) * Number(ratePerSqft) : null;
  const canCalculate =
    Boolean(area) && Boolean(activeProduct) && Boolean(activeSystemKey);
  const categoryStats = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        label:
          category === "Granite (Exterior and Interior)" ? "Granite" : category,
        value: category,
        count:
          category === "All"
            ? paintRates.length
            : paintRates.filter((product) => product.category === category)
                .length,
      })),
    [],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.key]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const items = root.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }),
      { threshold: 0.12 },
    );
    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);

  const scrollResult = () => {
    if (!canCalculate) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToBuilder = () => {
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateArea = (value) => {
    setArea(normalizeAreaValue(value));
  };

  const stepArea = (delta) => {
    const current = Number(area || 0);
    const next = Math.max(0, current + delta);
    setArea(String(next));
  };

  const preventNegativeAreaInput = (event) => {
    if (["-", "+", "e", "E"].includes(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-rate-page">
        <section className="rate-hero" data-reveal>
          <div className="rate-hero-copy">
            <p className="rate-kicker">Meitu rate calculator</p>
            <h1>Build a clean site estimate in seconds.</h1>
            <span className="rate-hero-subtitle">
              Enter the coverage area, pick a finish, and compare Meitu wall
              systems with a calm quotation preview.
            </span>
            <div className="rate-hero-actions">
              <button
                type="button"
                className="rate-primary-link"
                onClick={scrollToBuilder}
              >
                Start estimate
              </button>
              <Link to="/products" className="apple-text-link">
                Browse products <ArrowIcon />
              </Link>
            </div>
            <div className="rate-hero-metrics" aria-label="Calculator coverage">
              <span>
                <b>{paintRates.length}</b>
                products
              </span>
              <span>
                <b>{SYSTEMS.length}</b>
                systems
              </span>
              <span>
                <b>Instant</b>
                preview
              </span>
            </div>
          </div>

          <aside className="rate-hero-stage" aria-label="Estimate preview graphic">
            <div className="rate-stage-card rate-stage-card-main">
              <div className="rate-result-head">
                <CalculatorIcon />
                <span>Live estimate</span>
              </div>
              <strong>
                {total != null ? `Rs. ${total.toLocaleString()}` : "Rs. 0"}
              </strong>
              <p>
                {activeProduct
                  ? activeProduct.name
                  : "Select a product to start the estimate."}
              </p>
              <div className="rate-stage-lines">
                <span>
                  Area <b>{area ? `${area} sqft` : "Waiting"}</b>
                </span>
                <span>
                  System <b>{selectedSystem?.title || "Not selected"}</b>
                </span>
              </div>
            </div>
            <div className="rate-stage-card rate-stage-card-rate">
              <PaletteIcon />
              <span>Rate</span>
              <b>
                {ratePerSqft != null
                  ? `Rs.${ratePerSqft}/sqft`
                  : startingRate != null
                    ? `From Rs.${startingRate}/sqft`
                    : "Select"}
              </b>
            </div>
            <div className="rate-stage-card rate-stage-card-system">
              <ShieldIcon />
              <span>System check</span>
              <b>{availableSystems.length || "0"} options</b>
            </div>
            <div className="rate-stage-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </aside>
        </section>

        <section id="rate-builder" className="rate-workspace" ref={builderRef}>
          <header className="rate-workspace-head">
            <p>Calculator workspace</p>
            <h2>Choose area, finish, and system.</h2>
            <span>
              Keep the estimate fluid. The preview updates as soon as the
              product and system are selected.
            </span>
          </header>

          <div className="rate-layout">
            <section className="rate-catalog-panel" aria-label="Product catalog">
              <div className="rate-section">
                <div className="rate-section-title">
                  <PaletteIcon />
                  <span>Filter catalog</span>
                </div>
                <div className="rate-segments">
                  {categoryStats.map((category) => {
                    const active = category.value === activeCategory;
                    return (
                      <button
                        key={category.value}
                        type="button"
                        className={active ? "active" : ""}
                        onClick={() => {
                          setActiveCategory(category.value);
                          setActiveProductId(null);
                          setActiveSystemKey("");
                        }}
                      >
                        <span>{category.label}</span>
                        <b>{category.count}</b>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rate-section">
                <div className="rate-guide" aria-label="Estimate calculation steps">
                  <span>
                    <b>1</b>
                    Add area
                  </span>
                  <span>
                    <b>2</b>
                    Select product
                  </span>
                  <span>
                    <b>3</b>
                    Select system
                  </span>
                </div>
                <div className="rate-section-title">
                  <StoreIcon />
                  <span>Select product</span>
                  <small>{visibleProducts.length} options</small>
                </div>
                <div className="rate-product-grid">
                  {visibleProducts.map((product) => {
                    const active = product.id === activeProductId;
                    const productStartingRate = getStartingRate(product.rates);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`rate-product-card ${active ? "active" : ""}`}
                        onClick={() => {
                          setActiveProductId(product.id);
                          setActiveSystemKey("");
                        }}
                      >
                        <span className="rate-product-thumb">
                          {product.src ? (
                            <img
                              src={assetPath(product.src)}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                        </span>
                        <span>
                          <small>{product.category}</small>
                          <strong>{product.name}</strong>
                          <em>
                            {productStartingRate != null
                              ? `From Rs.${productStartingRate}/sqft`
                              : "Rate pending"}
                          </em>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="rate-estimate-panel">
              <div className="rate-estimate-card">
                <section className="rate-system-panel" aria-label="System selection">
                  <div className="rate-input-card">
                    <div>
                      <CalculatorIcon />
                      <label htmlFor="rate-area">Add area</label>
                    </div>
                    <div className="rate-stepper" role="group" aria-label="Area stepper">
                      <button
                        type="button"
                        aria-label="Decrease area"
                        onClick={() => stepArea(-AREA_STEP)}
                        disabled={!area || Number(area) <= 0}
                      >
                        -
                      </button>
                      <input
                        id="rate-area"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step={AREA_STEP}
                        placeholder="e.g. 1200"
                        value={area}
                        onKeyDown={preventNegativeAreaInput}
                        onChange={(event) => updateArea(event.target.value)}
                        onBlur={(event) => updateArea(event.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Increase area"
                        onClick={() => stepArea(AREA_STEP)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rate-section">
                    <div className="rate-section-title">
                      <ShieldIcon />
                      <span>Select system</span>
                    </div>
                    {activeProduct ? (
                      <div className="rate-system-grid">
                        {availableSystems.map((system) => {
                          const active = system.key === activeSystemKey;
                          const price = activeProduct.rates[system.key];
                          return (
                            <button
                              key={system.key}
                              type="button"
                              className={`rate-system-card ${active ? "active" : ""}`}
                              onClick={() => setActiveSystemKey(system.key)}
                            >
                              <span>
                                <strong>{system.title}</strong>
                              </span>
                              <b>Rs.{price}/sqft</b>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rate-empty">
                        Choose a product from the catalog to reveal compatible
                        systems.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="rate-view-button"
                    disabled={!canCalculate}
                    onClick={scrollResult}
                  >
                    {canCalculate
                      ? "View estimate"
                      : "Enter area, product, and system"}
                    <ArrowIcon />
                  </button>
                </section>

                <section
                  className="rate-result-card"
                  ref={resultRef}
                  aria-label="Total price preview"
                >
                  <div className="rate-result-head">
                    <CalculatorIcon />
                    <span>Total price</span>
                  </div>
                  <strong>
                    {total != null ? `Rs. ${total.toLocaleString()}` : "Rs. 0"}
                  </strong>
                  <p>
                    Final quotation may vary by surface condition, application
                    method, and site requirement.
                  </p>
                  <Link to="/inquiry" className="rate-inquiry-link">
                    Request confirmed quotation <ArrowIcon />
                  </Link>
                </section>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <style>{`
        .apple-rate-page {
          min-height: 100vh;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
        }

        .apple-rate-page svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .rate-hero {
          position: relative;
          width: 100%;
          min-height: min(760px, 92vh);
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(340px, 1.08fr);
          gap: clamp(28px, 5vw, 78px);
          align-items: center;
          padding: 0 max(20px, calc((100% - 1200px) / 2)) clamp(54px, 7vw, 84px);
          background:
            radial-gradient(circle at 14% 18%, rgba(255,255,255,.88), transparent 24%),
            radial-gradient(circle at 78% 20%, rgba(0,113,227,.16), transparent 28%),
            radial-gradient(circle at 70% 86%, rgba(221,220,140,.42), transparent 32%),
            var(--meitu-home-hero-gradient);
          isolation: isolate;
        }

        .rate-hero::after {
          content: "";
          position: absolute;
          inset: auto 0 0;
          height: 130px;
          background: linear-gradient(180deg, rgba(245,245,247,0), var(--color-fog, #f5f5f7));
          pointer-events: none;
          z-index: -1;
        }

        .rate-kicker,
        .rate-workspace-head p {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .rate-hero h1,
        .rate-workspace-head h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          color: var(--color-ink, #1d1d1f);
          font-weight: 700;
          letter-spacing: -0.026em;
        }

        .rate-hero h1 {
          max-width: 670px;
          margin-top: 12px;
          font-size: clamp(52px, 8vw, 104px);
          line-height: .98;
        }

        .rate-hero-subtitle {
          display: block;
          max-width: 580px;
          margin-top: 24px;
          color: var(--color-slate, #474747);
          font-size: clamp(18px, 2vw, 23px);
          font-weight: 300;
          line-height: 1.38;
          letter-spacing: -0.012em;
        }

        .rate-hero-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px;
          margin-top: 32px;
        }

        .rate-primary-link,
        .rate-view-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          background: var(--apple-control-blue, #0071e3);
          color: #fff;
          padding: 10px 19px;
          font: inherit;
          font-size: 17px;
          text-decoration: none;
          letter-spacing: -0.1px;
          cursor: pointer;
          transition: background-color .1s ease, transform .1s ease;
        }

        .rate-primary-link:hover,
        .rate-view-button:not(:disabled):hover {
          background: var(--apple-control-blue-hover, #0077ed);
          transform: translateY(-1px);
        }

        .apple-text-link,
        .rate-inquiry-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 17px;
          letter-spacing: -0.1px;
        }

        .apple-text-link svg,
        .rate-inquiry-link svg,
        .rate-view-button svg {
          width: 17px;
          height: 17px;
        }

        .rate-hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          max-width: 520px;
          margin-top: 42px;
        }

        .rate-hero-metrics span {
          min-height: 88px;
          display: grid;
          align-content: center;
          gap: 3px;
          border-radius: 28px;
          background: rgba(255,255,255,.64);
          backdrop-filter: blur(22px);
          padding: 18px;
          color: var(--color-graphite, #707070);
          font-size: 13px;
          letter-spacing: -0.01em;
        }

        .rate-hero-metrics b {
          color: var(--color-ink, #1d1d1f);
          font-size: 25px;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .rate-hero-stage {
          position: relative;
          min-height: 520px;
          display: grid;
          place-items: center;
        }

        .rate-stage-orbit {
          position: absolute;
          inset: 22px;
          border-radius: 48px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,.26)),
            radial-gradient(circle at 25% 28%, rgba(255,255,255,.94), transparent 18%),
            radial-gradient(circle at 82% 78%, rgba(0,113,227,.13), transparent 28%);
          backdrop-filter: blur(22px);
          overflow: hidden;
          z-index: -1;
        }

        .rate-stage-orbit span {
          position: absolute;
          width: 180px;
          aspect-ratio: 1;
          border-radius: 999px;
          background:
            radial-gradient(circle at 36% 30%, rgba(255,255,255,.95), rgba(255,255,255,0) 34%),
            linear-gradient(145deg, rgba(0,113,227,.18), rgba(221,220,140,.32));
          animation: rate-float 8s ease-in-out infinite;
        }

        .rate-stage-orbit span:nth-child(1) {
          top: 8%;
          left: 8%;
        }

        .rate-stage-orbit span:nth-child(2) {
          width: 130px;
          right: 11%;
          top: 18%;
          animation-delay: -2.4s;
        }

        .rate-stage-orbit span:nth-child(3) {
          width: 220px;
          right: 18%;
          bottom: 7%;
          animation-delay: -4.7s;
        }

        .rate-stage-card {
          border-radius: 32px;
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(24px);
          color: var(--color-ink, #1d1d1f);
        }

        .rate-stage-card-main {
          width: min(430px, 86%);
          padding: clamp(28px, 4vw, 42px);
          animation: rate-rise .72s ease both;
        }

        .rate-stage-card-main > strong {
          display: block;
          margin-top: 20px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(45px, 5.6vw, 72px);
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .rate-stage-card-main > p {
          min-height: 44px;
          margin: 16px 0 0;
          color: var(--color-graphite, #707070);
          line-height: 1.4;
        }

        .rate-stage-lines {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .rate-stage-lines span,
        .rate-result-lines span {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          color: var(--color-graphite, #707070);
          border-top: 1px solid var(--color-silver-mist, #e8e8ed);
          padding-top: 12px;
          line-height: 1.35;
        }

        .rate-stage-lines b,
        .rate-result-lines b {
          color: var(--color-ink, #1d1d1f);
          text-align: right;
        }

        .rate-stage-card-rate,
        .rate-stage-card-system {
          position: absolute;
          display: grid;
          gap: 5px;
          min-width: 168px;
          padding: 18px;
          color: var(--color-graphite, #707070);
          animation: rate-float 7s ease-in-out infinite;
        }

        .rate-stage-card-rate {
          left: 4%;
          bottom: 17%;
        }

        .rate-stage-card-system {
          right: 2%;
          top: 12%;
          animation-delay: -3.1s;
        }

        .rate-stage-card-rate b,
        .rate-stage-card-system b {
          color: var(--color-ink, #1d1d1f);
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .rate-result-head,
        .rate-input-card > div,
        .rate-section-title {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: var(--color-graphite, #707070);
          font-weight: 600;
        }

        .rate-workspace {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
          padding: clamp(54px, 8vw, 92px) 0 clamp(70px, 10vw, 116px);
        }

        .rate-workspace-head {
          max-width: 720px;
          margin-bottom: 30px;
        }

        .rate-workspace-head h2 {
          margin-top: 10px;
          font-size: clamp(38px, 5vw, 64px);
          line-height: 1.05;
        }

        .rate-workspace-head > span {
          display: block;
          max-width: 620px;
          margin-top: 14px;
          color: var(--color-graphite, #707070);
          font-size: 20px;
          font-weight: 300;
          line-height: 1.42;
        }

        .rate-guide {
          width: min(760px, 100%);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 28px;
        }

        .rate-guide span {
          min-height: 54px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(232,232,237,.86);
          border-radius: 999px;
          background: rgba(255,255,255,.72);
          padding: 8px 14px 8px 9px;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .rate-guide b {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-graphite, #707070);
          font-size: 13px;
        }

        .rate-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
          gap: clamp(18px, 2.4vw, 28px);
          align-items: start;
        }

        .rate-system-panel,
        .rate-result-card {
          border-radius: 32px;
          border: 1px solid rgba(232,232,237,.94);
          background:
            radial-gradient(circle at 12% 0%, rgba(255,255,255,.98), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.96), rgba(250,250,252,.92));
        }

        .rate-catalog-panel {
          display: grid;
          align-content: start;
          gap: 28px;
        }

        .rate-catalog-panel > .rate-section:first-child {
          padding: 14px 0 16px;
        }

        .rate-estimate-panel {
          position: sticky;
          top: 44px;
          align-self: start;
          height: calc(100svh - 60px);
          min-height: 520px;
          overflow: visible;
          z-index: 7;
        }

        .rate-estimate-card {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 520px;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          align-content: space-between;
          gap: 14px;
          animation: rate-rise .344s ease both;
        }

        .rate-estimate-card::before {
          content: "";
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 62px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(29,29,31,.18), transparent);
        }

        .rate-system-panel {
          display: grid;
          align-content: start;
          gap: 12px;
          padding: clamp(16px, 2.2vw, 20px);
        }

        .rate-result-card {
          position: static;
          align-self: end;
          padding: clamp(18px, 2.6vw, 26px);
          background:
            radial-gradient(circle at 100% 0%, rgba(0,113,227,.10), transparent 34%),
            radial-gradient(circle at 10% 10%, rgba(255,255,255,.98), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,245,247,.96));
        }

        .rate-result-card > strong {
          display: block;
          margin-top: 12px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(38px, 4.7vw, 58px);
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .rate-result-lines {
          display: grid;
          gap: 12px;
          margin-top: 26px;
        }

        .rate-result-card p {
          margin: 14px 0 0;
          color: var(--color-graphite, #707070);
          font-size: 14px;
          line-height: 1.45;
        }

        .rate-inquiry-link {
          margin-top: 18px;
        }

        .rate-input-card {
          display: grid;
          gap: 8px;
          border-radius: 22px;
          background:
            radial-gradient(circle at 100% 0%, rgba(0,113,227,.09), transparent 32%),
            linear-gradient(180deg, rgba(245,245,247,.96), rgba(255,255,255,.72));
          padding: 12px;
        }

        .rate-input-card label,
        .rate-section-title {
          color: var(--color-ink, #1d1d1f);
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .rate-input-card input {
          width: 100%;
          min-height: 48px;
          border: 1px solid transparent;
          outline: 0;
          border-radius: 20px;
          background: rgba(255,255,255,.82);
          padding: 0 18px;
          color: var(--color-ink, #1d1d1f);
          font: inherit;
          font-size: clamp(24px, 3.2vw, 34px);
          font-weight: 600;
          letter-spacing: -0.04em;
          transition: border-color .16s ease, background-color .16s ease;
        }

        .rate-stepper {
          min-height: 58px;
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 44px;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(232,232,237,.92);
          border-radius: 999px;
          background: rgba(255,255,255,.78);
          padding: 6px;
        }

        .rate-stepper input {
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          padding: 0 8px;
          text-align: center;
          font-size: clamp(23px, 3vw, 32px);
        }

        .rate-stepper input:focus {
          border: 0;
          background: transparent;
        }

        .rate-stepper input::-webkit-outer-spin-button,
        .rate-stepper input::-webkit-inner-spin-button {
          appearance: none;
          margin: 0;
        }

        .rate-stepper input[type="number"] {
          -moz-appearance: textfield;
        }

        .rate-stepper button {
          width: 44px;
          height: 44px;
          border: 0;
          border-radius: 999px;
          background: var(--apple-control-frost, rgba(210,210,215,.64));
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 23px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          transition: background-color .1s ease, transform .1s ease, opacity .1s ease;
        }

        .rate-stepper button:hover:not(:disabled) {
          background: rgba(210,210,215,.84);
          transform: scale(1.03);
        }

        .rate-stepper button:disabled {
          cursor: not-allowed;
          opacity: .35;
        }

        .rate-input-card input:focus {
          border-color: rgba(0,113,227,.32);
          background: #fff;
        }

        .rate-input-card .rate-stepper input:focus {
          border: 0;
          background: transparent;
        }

        .rate-input-card input::placeholder {
          color: rgba(112,112,112,.58);
        }

        .rate-section {
          display: grid;
          gap: 16px;
        }

        .rate-section-title small {
          margin-left: auto;
          color: var(--color-graphite, #707070);
          font-weight: 500;
        }

        .rate-segments {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .rate-segments button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          border: 0;
          border-radius: 999px;
          padding: 8px 14px;
          background: var(--apple-control-frost, rgba(210,210,215,.64));
          color: var(--color-ink, #1d1d1f);
          font: inherit;
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-weight: 500;
          font-size: 14px;
          letter-spacing: -0.1px;
          cursor: pointer;
          backdrop-filter: blur(18px);
          transition: background-color .1s ease, transform .1s ease;
        }

        .rate-segments button:hover {
          transform: translateY(-1px);
        }

        .rate-segments button.active {
          background: var(--color-ink, #1d1d1f);
          color: #fff;
        }

        .rate-segments b {
          min-width: 26px;
          min-height: 22px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(255,255,255,.72);
          color: inherit;
          font-size: 12px;
        }

        .rate-segments button.active b {
          background: rgba(255,255,255,.18);
        }

        .rate-product-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .rate-system-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .rate-product-card,
        .rate-system-card,
        .rate-empty {
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          background:
            radial-gradient(circle at 100% 0%, rgba(255,255,255,.94), transparent 28%),
            #fff;
          border-radius: 26px;
          padding: 15px;
        }

        .rate-product-card,
        .rate-system-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          color: var(--color-ink, #1d1d1f);
          text-align: left;
          cursor: pointer;
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          overflow: hidden;
          transition: border-color .16s ease, background-color .16s ease, transform .16s ease;
        }

        .rate-product-card:hover,
        .rate-system-card:hover {
          transform: translateY(-2px);
          border-color: rgba(29,29,31,.22);
          background: #fbfbfd;
        }

        .rate-product-card.active,
        .rate-system-card.active {
          border-color: rgba(0,113,227,.48);
          background:
            radial-gradient(circle at 100% 0%, rgba(0,113,227,.12), transparent 28%),
            #fff;
        }

        .rate-product-card.active::after,
        .rate-system-card.active::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px rgba(0,113,227,.22);
          pointer-events: none;
        }

        .rate-product-thumb {
          width: 70px;
          height: 70px;
          flex: 0 0 70px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background:
            radial-gradient(circle at 50% 28%, #fff, transparent 52%),
            var(--color-fog, #f5f5f7);
          overflow: hidden;
        }

        .rate-product-thumb img {
          width: 88%;
          height: 88%;
          object-fit: contain;
          transition: transform .24s ease;
        }

        .rate-product-card:hover .rate-product-thumb img {
          transform: scale(1.04);
        }

        .rate-product-card small,
        .rate-system-card small,
        .rate-empty {
          display: block;
          color: var(--color-graphite, #707070);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.42;
          letter-spacing: -0.003em;
        }

        .rate-product-card strong {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 18px;
          font-weight: 600;
          line-height: 1.18;
          letter-spacing: -0.024em;
        }

        .rate-product-card em {
          display: block;
          margin-top: 7px;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 13px;
          font-weight: 500;
          font-style: normal;
          letter-spacing: -0.01em;
        }

        .rate-system-card {
          height: 74px;
          min-height: 74px;
          max-height: 74px;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          gap: 6px;
          border-radius: 20px;
          padding: 11px 12px;
        }

        .rate-system-card strong {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.12;
          letter-spacing: -0.02em;
        }

        .rate-system-card b {
          white-space: nowrap;
          color: var(--color-cobalt-link, #0066cc);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .rate-system-card small {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .rate-empty {
          color: var(--color-graphite, #707070);
          background: var(--color-fog, #f5f5f7);
        }

        .rate-view-button {
          width: 100%;
          min-height: 52px;
          font-weight: 600;
        }

        .rate-view-button:disabled {
          opacity: .48;
          cursor: not-allowed;
          background: var(--apple-control-frost, rgba(210,210,215,.64));
          color: var(--color-graphite, #707070);
          transform: none;
        }

        [data-reveal] {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity .72s ease, transform .72s ease;
        }

        [data-reveal].is-in {
          opacity: 1;
          transform: translateY(0);
        }

        @keyframes rate-float {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -12px, 0);
          }
        }

        @keyframes rate-rise {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rate-stage-orbit span,
          .rate-stage-card,
          [data-reveal] {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 980px) {
          .rate-hero {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .rate-hero-stage {
            min-height: 470px;
          }

          .rate-layout {
            grid-template-columns: 1fr;
          }

          .rate-catalog-panel {
            max-height: none;
            overflow: visible;
          }

          .rate-estimate-panel {
            position: static;
            height: auto;
            min-height: auto;
            align-content: stretch;
          }

          .rate-estimate-card {
            height: auto;
            min-height: auto;
            display: grid;
          }
        }

        @media (max-width: 720px) {
          .rate-hero {
            padding: 0 20px 48px;
          }

          .rate-hero h1 {
            font-size: clamp(44px, 14vw, 70px);
          }

          .rate-hero-metrics {
            grid-template-columns: 1fr;
            margin-top: 28px;
          }

          .rate-hero-metrics span {
            min-height: 68px;
          }

          .rate-hero-stage {
            min-height: 390px;
          }

          .rate-stage-orbit {
            inset: 0;
            border-radius: 32px;
          }

          .rate-stage-card-rate,
          .rate-stage-card-system {
            position: relative;
            inset: auto;
            justify-self: stretch;
            min-width: 0;
            width: min(430px, 86%);
            margin-top: 10px;
            animation: none;
          }

          .rate-hero-stage {
            align-content: center;
          }

          .rate-workspace {
            width: min(100% - 28px, 1200px);
            padding-top: 46px;
          }

          .rate-workspace-head > span {
            font-size: 17px;
          }

          .rate-guide {
            grid-template-columns: 1fr;
          }

          .rate-catalog-panel,
          .rate-estimate-card,
          .rate-system-panel,
          .rate-result-card {
            border-radius: 28px;
          }

          .rate-product-grid,
          .rate-system-grid {
            grid-template-columns: 1fr;
          }

          .rate-product-card {
            align-items: flex-start;
          }

          .rate-segments button {
            flex: 1 1 calc(50% - 8px);
            justify-content: space-between;
          }
        }

        @media (max-width: 460px) {
          .rate-hero-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .rate-primary-link {
            width: 100%;
          }

          .rate-input-card input {
            min-height: 64px;
          }

          .rate-product-thumb {
            width: 58px;
            height: 58px;
            flex-basis: 58px;
            border-radius: 18px;
          }
        }
      `}</style>
    </>
  );
}
