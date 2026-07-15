import React, { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import NavBar from "./components/NavBar";
import AppleCardsCarousel from "./components/ui/AppleCardsCarousel";
import ParallaxHeroImages from "./components/ui/ParallaxHeroImages";

const PREVIEW_MATRIX_COLORS = [
  "rgb(244,236,207)",
  "rgb(244,231,183)",
  "rgb(240,220,151)",
  "rgb(239,215,137)",
  "rgb(234,210,127)",
  "rgb(219,188,87)",
  "rgb(185,155,48)",
  "rgb(246,242,223)",
  "rgb(248,240,207)",
  "rgb(250,235,183)",
  "rgb(251,231,161)",
  "rgb(255,226,130)",
  "rgb(255,213,75)",
  "rgb(250,193,0)",
  "rgb(246,243,226)",
  "rgb(247,240,212)",
  "rgb(250,234,188)",
  "rgb(254,226,157)",
  "rgb(255,223,140)",
  "rgb(255,201,72)",
  "rgb(255,178,0)",
  "rgb(248,240,217)",
  "rgb(252,235,197)",
  "rgb(255,226,170)",
  "rgb(255,218,143)",
  "rgb(255,208,111)",
  "rgb(255,186,58)",
  "rgb(255,166,0)",
  "rgb(248,241,220)",
  "rgb(250,235,203)",
  "rgb(253,226,174)",
  "rgb(254,210,136)",
  "rgb(252,199,113)",
  "rgb(242,176,69)",
  "rgb(229,158,47)",
  "rgb(248,238,217)",
  "rgb(248,232,201)",
  "rgb(249,219,169)",
  "rgb(246,202,135)",
  "rgb(241,189,113)",
  "rgb(227,167,79)",
  "rgb(218,157,69)",
  "rgb(246,234,212)",
  "rgb(248,230,200)",
  "rgb(242,211,166)",
  "rgb(235,196,141)",
  "rgb(222,171,105)",
  "rgb(216,160,91)",
  "rgb(194,138,71)",
];

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const BoxIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
    <path d="M4 7.5v9L12 21l8-4.5v-9" />
    <path d="M12 12v9" />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3v5" />
    <path d="M12 16v5" />
    <path d="M3 12h5" />
    <path d="M16 12h5" />
    <path d="m5.6 5.6 3.2 3.2" />
    <path d="m15.2 15.2 3.2 3.2" />
    <path d="m18.4 5.6-3.2 3.2" />
    <path d="m8.8 15.2-3.2 3.2" />
  </svg>
);

const SwatchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 4a8 8 0 1 0 8 8c0-1.2-.9-2-2.1-2H16a2 2 0 0 1-2-2V6.1C14 4.9 13.2 4 12 4Z" />
    <circle cx="8.6" cy="11.2" r=".7" />
    <circle cx="10.8" cy="8.3" r=".7" />
    <circle cx="14.1" cy="15.2" r=".7" />
  </svg>
);

const TruckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 6h10v10H4V6Z" />
    <path d="M14 10h3l3 3v3h-6v-6Z" />
    <circle cx="8" cy="18" r="1.7" />
    <circle cx="17" cy="18" r="1.7" />
  </svg>
);

const PARALLAX_HERO_IMAGES = [
  "/HomePage1.webp",
  "/HomePage2.webp",
  "/HomePage3.webp",
  "/bedroom.webp",
  "/Granite Textures/201.webp",
  "/Granite Textures/6004.webp",
];

export default function Home() {
  const pageRef = useRef(null);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const families = useMemo(
    () => [
      {
        title: "Buckets",
        subtitle: "Paint systems",
        description: "Interior, exterior, primer, putting, utility, and specialty product families.",
        href: "/products",
        image: "/Regular.svg",
        icon: <BoxIcon />,
      },
      {
        title: "Colors",
        subtitle: "1008 shades",
        description: "A refined shade library for homes, commercial spaces, and architectural projects.",
        href: "/colors",
        image: "/HomePage3.webp",
        icon: <SwatchIcon />,
      },
      {
        title: "Textures",
        subtitle: "Granite finishes",
        description: "Code-first granite texture previews for premium exterior and feature surfaces.",
        href: "/textures",
        image: "/HomePage2.webp",
        icon: <SparkIcon />,
      },
    ],
    [],
  );

  const productCards = useMemo(
    () => [
      ["Regular Paints", "Everyday interior and exterior excellence.", "/regular", "/Regular.svg"],
      ["Granite & Stone", "Architectural texture and depth.", "/granite", "/Granite.svg"],
      ["Primer", "Surface preparation for flawless top coats.", "/primer", "/Primer.svg"],
      ["Putting", "Smoother walls before the finish.", "/putting", "/Wall Putting.svg"],
      ["Specialty", "Decorative and supporting coating systems.", "/specialty", "/Specialty.svg"],
      ["Utilities", "Tools that keep professional work moving.", "/utilities", "/Utilities.svg"],
    ],
    [],
  );

  const methods = useMemo(
    () => [
      ["01", "Prepare", "Clean, repair, seal, and prime the surface before any final coat."],
      ["02", "Match", "Choose the product family based on surface, climate, and finish goal."],
      ["03", "Apply", "Use the right coat sequence, tool, drying time, and coverage rate."],
      ["04", "Protect", "Keep color stable, washable, and durable across real conditions."],
    ],
    [],
  );

  const texturePanels = useMemo(
    () => [
      ["Granite 3D", "Raised stone texture for architectural facades.", "/granite", "/Granite Textures/201.webp"],
      ["Liquid Stone", "Soft mineral movement with a refined surface feel.", "/granite", "/Granite Textures/6004.webp"],
      ["Real Stone", "Natural aggregate depth translated into coating systems.", "/granite", "/Granite Textures/7019.webp"],
      ["Floor Grip", "Functional texture for grip, movement, and endurance.", "/granite", "/HomePage2.webp"],
    ],
    [],
  );

  return (
    <>
      <NavBar />

      <main ref={pageRef} className="apple-home">
        <section className="home-hero" data-reveal>
          <ParallaxHeroImages images={PARALLAX_HERO_IMAGES} />

          <div className="home-hero-copy parallax-hero-copy">
            <p className="hero-eyebrow">Meitu Paints Nepal</p>
            <h1>Color, texture, and finish. Everywhere.</h1>

            <div className="hero-actions">
              <Link to="/products" className="apple-blue-pill">
                Explore products
              </Link>
              <Link to="/colors" className="apple-text-link">
                View colors <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <section className="home-carousel-band" data-reveal>
          <AppleCardsCarousel />
        </section>

        <section className="finish-gallery" data-reveal>
          <div className="finish-gallery-copy">
            <p>Gallery wall</p>
            <h2>Surfaces that feel finished before the furniture arrives.</h2>
          </div>
          <div className="finish-gallery-grid">
            <Link to="/regular" className="finish-card finish-card-large">
              <img src="/HomePage1.webp" alt="Meitu premium wall finish" />
              <span>Clean sheen</span>
            </Link>
            <Link to="/granite" className="finish-card">
              <img src="/HomePage2.webp" alt="Meitu granite texture finish" />
              <span>Granite depth</span>
            </Link>
            <Link to="/colors" className="finish-card">
              <img src="/HomePage3.webp" alt="Meitu color finish" />
              <span>Color mood</span>
            </Link>
          </div>
        </section>

        <section className="home-product-triad">
          <div className="section-header" data-reveal>
            <p>Product architecture</p>
            <h2>Three ways to choose the perfect finish.</h2>
          </div>

          <div className="triad-grid">
            {families.map((item) => (
              <Link key={item.title} to={item.href} className="triad-card" data-reveal>
                <div className="triad-icon">{item.icon}</div>
                <div className="triad-media">
                  <img src={item.image} alt="" />
                </div>
                <div className="triad-copy">
                  <span>{item.subtitle}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <strong>
                    Explore <ArrowIcon />
                  </strong>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-color-stage" data-reveal>
          <div className="color-stage-copy">
            <p>Meitu color library</p>
            <h2>1008 shades, arranged for real spaces.</h2>
            <span>
              Search by shade, filter by tone, preview in rooms, and move from
              inspiration to inquiry without noise.
            </span>
            <div className="stage-actions">
              <Link to="/colors" className="dark-pill">
                Open color library
              </Link>
              <Link to="/horoscope" className="light-link">
                Zodiac palettes <ArrowIcon />
              </Link>
            </div>
          </div>

          <div className="color-matrix" aria-label="Warm Meitu shade matrix">
            {PREVIEW_MATRIX_COLORS.map((color, index) => (
              <span
                key={`${color}-${index}`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </section>

        <section className="texture-lab" data-reveal>
          <div className="texture-lab-copy">
            <p>Texture paint excellence</p>
            <h2>Depth you can see before the wall is touched.</h2>
            <span>
              Meitu texture systems translate stone movement, mineral grain,
              and grip into clean, repeatable coating families.
            </span>
            <Link to="/textures" className="apple-text-link">
              Open texture codes <ArrowIcon />
            </Link>
          </div>

          <div className="texture-lab-grid" aria-label="Texture paint systems">
            {texturePanels.map(([title, text, href, image], index) => (
              <Link
                key={title}
                to={href}
                className={`texture-sample texture-sample-${index + 1}`}
              >
                <div className="sample-art" aria-hidden="true">
                  <img src={image} alt="" loading="lazy" />
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-system-showcase">
          <div className="showcase-copy" data-reveal>
            <p>Coating systems</p>
            <h2>Built as layers, not isolated products.</h2>
            <span>
              Meitu systems combine preparation, coating, texture, tools, and
              support so every surface gets the correct finish path.
            </span>
          </div>

          <div className="system-grid">
            {productCards.map(([title, text, href, image]) => (
              <Link key={title} to={href} className="system-card" data-reveal>
                <div>
                  <BoxIcon />
                  <span>Collection</span>
                </div>
                <img src={image} alt="" />
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="texture-feature" data-reveal>
          <div className="texture-media">
            <img src="/HomePage2.webp" alt="Meitu granite texture finish" />
          </div>
          <div className="texture-copy">
            <p>Texture library</p>
            <h2>Granite depth, simplified into codes.</h2>
            <span>
              Browse texture references, preview finishes, and send accurate
              inquiries using code-first granite selections.
            </span>
            <Link to="/textures" className="apple-text-link">
              Explore textures <ArrowIcon />
            </Link>
          </div>
        </section>

        <section className="method-section">
          <div className="section-header" data-reveal>
            <p>Meitu system method</p>
            <h2>Professional results follow a sequence.</h2>
          </div>

          <div className="method-grid">
            {methods.map(([number, title, text]) => (
              <article key={number} className="method-card" data-reveal>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dealer-band" data-reveal>
          <div className="dealer-graphic" aria-hidden="true">
            <TruckIcon />
            <div />
          </div>
          <div>
            <p>Dealer network</p>
            <h2>Order faster. Track cleaner. Work directly with Meitu.</h2>
            <span>
              Join the dealer platform for catalog ordering, draft review,
              order history, and operational support.
            </span>
          </div>
          <Link to="/dealership" className="apple-blue-pill">
            Become a dealer
          </Link>
        </section>

        <section className="final-home-cta" data-reveal>
          <p>Ready to plan your next surface?</p>
          <h2>Design with confidence.</h2>
          <div>
            <Link to="/ratecalculator" className="dark-pill">
              Estimate cost
            </Link>
            <Link to="/inquiry" className="light-link">
              Talk to an expert <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <style>{`
        .apple-home {
          min-height: 100vh;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-text);
          overflow: hidden;
        }

        .apple-home svg {
          width: 18px;
          height: 18px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.85;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex: 0 0 auto;
        }

        .apple-home a {
          text-decoration: none;
        }



        .home-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          max-width: none;
          margin: 0;
          padding: clamp(8px, 2vw, 22px) 24px clamp(32px, 5vw, 64px);
          background: var(--surface-canvas);
          overflow: hidden;
        }

        .home-hero-copy {
          position: relative;
          z-index: 4;
        }

        .parallax-hero-copy {
          display: flex;
          max-width: 860px;
          flex-direction: column;
          align-items: center;
          text-align: center;
          text-shadow: 0 0 22px rgba(255,255,255,.88);
        }

        .hero-eyebrow,
        .section-header p,
        .color-stage-copy p,
        .showcase-copy p,
        .texture-copy p,
        .dealer-band p,
        .final-home-cta p {
          margin: 0 0 10px;
          font-family: var(--font-display);
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.36px;
          color: var(--color-ink, #1d1d1f);
        }

        .home-hero h1 {
          max-width: 940px;
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(50px, 8.5vw, 104px);
          line-height: 0.98;
          font-weight: 700;
          letter-spacing: -0.024em;
        }

        .hero-lead {
          max-width: 540px;
          margin: 20px auto 0;
          font-size: clamp(19px, 2vw, 24px);
          line-height: 1.36;
          font-weight: 300;
          letter-spacing: -0.01em;
          color: var(--color-graphite, #707070);
        }

        .hero-actions,
        .stage-actions,
        .final-home-cta > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 22px;
          margin-top: 30px;
        }

        .apple-blue-pill,
        .dark-pill {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          border-radius: 999px;
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
        }

        .apple-blue-pill {
          background: var(--color-azure, #0071e3);
          color: #fff;
        }

        .dark-pill {
          background: #000;
          color: #fff;
        }

        .apple-text-link,
        .light-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
        }

        .parallax-hero-images {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: var(--surface-canvas);
          pointer-events: none;
        }

        .parallax-image-card {
          position: absolute;
          z-index: 2;
          overflow: hidden;
          margin: 0;
          width: clamp(132px, 20vw, 320px);
          height: clamp(92px, 15vw, 240px);
          border-radius: 22px;
          background: rgba(255,255,255,.76);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(29,29,31,.08);
          will-change: transform, filter, opacity;
        }

        .parallax-image-card img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .parallax-image-card figcaption {
          position: absolute;
          left: 12px;
          bottom: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.74);
          color: var(--color-ink, #1d1d1f);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: -0.26px;
          backdrop-filter: blur(18px);
        }

        .parallax-card-1 {
          width: clamp(150px, 22vw, 330px);
          height: clamp(110px, 16.5vw, 248px);
        }

        .parallax-card-2 {
          width: clamp(150px, 21vw, 330px);
          height: clamp(110px, 16vw, 248px);
        }

        .parallax-card-3 {
          width: clamp(120px, 16vw, 260px);
          height: clamp(90px, 12vw, 195px);
        }

        .parallax-card-4 {
          width: clamp(120px, 16vw, 260px);
          height: clamp(90px, 12vw, 195px);
        }

        .parallax-card-5 {
          width: clamp(150px, 20vw, 310px);
          height: clamp(112px, 15vw, 232px);
        }

        .parallax-card-6 {
          width: clamp(150px, 20vw, 310px);
          height: clamp(112px, 15vw, 232px);
        }

        .home-carousel-band {
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          padding: 0;
          background: var(--color-fog, #f5f5f7);
        }

        .section-header {
          max-width: 860px;
          margin: 0 auto 28px;
          text-align: center;
        }

        .section-header h2,
        .color-stage-copy h2,
        .showcase-copy h2,
        .texture-copy h2,
        .dealer-band h2,
        .final-home-cta h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(42px, 6vw, 76px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.022em;
        }

        .finish-gallery {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          padding: 62px 24px 36px;
        }

        .finish-gallery-copy {
          max-width: 820px;
          margin-bottom: 24px;
        }

        .finish-gallery-copy p {
          margin: 0 0 10px;
          font-family: var(--font-display);
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.36px;
        }

        .finish-gallery-copy h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(42px, 6vw, 72px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.022em;
        }

        .finish-gallery-grid {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          grid-template-rows: repeat(2, 260px);
          gap: 18px;
        }

        .finish-card {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background: #fff;
          color: var(--color-ink, #1d1d1f);
        }

        .finish-card-large {
          grid-row: span 2;
        }

        .finish-card img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transform: scale(1.02);
          transition: transform 1.2s ease;
        }

        .finish-card:hover img {
          transform: scale(1);
        }

        .finish-card span {
          position: absolute;
          left: 20px;
          bottom: 20px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.76);
          color: var(--color-ink, #1d1d1f);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.04px;
          backdrop-filter: blur(20px);
        }

        .home-product-triad,
        .home-system-showcase,
        .method-section {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          padding: 60px 24px;
        }

        .triad-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
        }

        .triad-card,
        .system-card,
        .method-card {
          border-radius: 28px;
          background: #fff;
          color: var(--color-ink, #1d1d1f);
          overflow: hidden;
          transition: transform 0.344s ease, background-color 0.1s ease;
        }

        .triad-card {
          min-height: 470px;
          display: grid;
          grid-template-rows: auto 1fr auto;
          padding: 24px;
        }

        .triad-card:hover,
        .system-card:hover,
        .method-card:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,.9);
        }

        .triad-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
        }

        .triad-media {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          margin-top: 18px;
          border-radius: 24px;
          background: var(--color-fog, #f5f5f7);
          overflow: hidden;
        }

        .triad-media img {
          width: 100%;
          max-height: 210px;
          object-fit: contain;
        }

        .triad-card:nth-child(2) .triad-media img,
        .triad-card:nth-child(3) .triad-media img {
          height: 100%;
          object-fit: cover;
        }

        .triad-copy {
          padding-top: 22px;
        }

        .triad-copy span,
        .system-card div span,
        .method-card span {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .triad-copy h3,
        .system-card h3,
        .method-card h3 {
          margin: 4px 0 8px;
          font-family: var(--font-display);
          font-size: 28px;
          line-height: 1.16;
          font-weight: 700;
          letter-spacing: -0.006em;
        }

        .triad-copy p,
        .system-card p,
        .method-card p,
        .showcase-copy span,
        .texture-copy span,
        .dealer-band span,
        .final-home-cta p:not(:first-child),
        .color-stage-copy span {
          color: var(--color-graphite, #707070);
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
        }

        .triad-copy strong {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 6px;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 17px;
          font-weight: 400;
        }

        .home-color-stage {
          display: grid;
          grid-template-columns: minmax(0, .85fr) minmax(440px, 1.15fr);
          gap: 48px;
          align-items: center;
          padding: 78px 24px;
          background: #000;
          color: #fff;
        }

        .color-stage-copy {
          max-width: 520px;
          justify-self: end;
        }

        .color-stage-copy p,
        .color-stage-copy h2 {
          color: #fff;
        }

        .color-stage-copy span {
          display: block;
          margin-top: 20px;
          color: rgba(255,255,255,.72);
        }

        .color-matrix {
          display: grid;
          grid-template-columns: repeat(7, minmax(32px, 1fr));
          gap: 10px;
          max-width: 700px;
        }

        .color-matrix span {
          aspect-ratio: 1;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.15);
        }

        .texture-lab {
          position: relative;
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(280px, .78fr) minmax(0, 1.22fr);
          gap: 34px;
          align-items: stretch;
          padding: 60px 24px 50px;
        }



        .texture-lab-copy {
          position: relative;
          z-index: 1;
          align-self: center;
        }

        .texture-lab-copy p {
          margin: 0 0 10px;
          font-family: var(--font-display);
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.36px;
        }

        .texture-lab-copy h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(42px, 6vw, 76px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.022em;
        }

        .texture-lab-copy > span {
          display: block;
          max-width: 520px;
          margin-top: 18px;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
        }

        .texture-lab-copy .apple-text-link {
          margin-top: 22px;
        }

        .texture-lab-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .texture-sample {
          min-height: 270px;
          display: grid;
          grid-template-rows: 1fr auto;
          gap: 16px;
          padding: 18px;
          border-radius: 28px;
          background: #fff;
          color: var(--color-ink, #1d1d1f);
          overflow: hidden;
          transition: transform .344s ease, background-color .1s ease;
        }

        .texture-sample:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,.9);
        }

        .sample-art {
          position: relative;
          min-height: 150px;
          border-radius: 24px;
          overflow: hidden;
          background:
            radial-gradient(circle at 18% 24%, rgba(255,255,255,.72) 0 7px, transparent 8px),
            radial-gradient(circle at 70% 42%, rgba(255,255,255,.55) 0 5px, transparent 6px),
            radial-gradient(circle at 46% 78%, rgba(255,255,255,.45) 0 9px, transparent 10px),
            linear-gradient(135deg, #1d1d1f, #596680);
        }

        .sample-art img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: .62;
          mix-blend-mode: overlay;
          transform: scale(1.08);
          animation: textureDrift 9s ease-in-out infinite alternate;
        }

        .texture-sample-1 .sample-art { background:
          repeating-radial-gradient(circle at 30% 30%, rgba(255,255,255,.55) 0 2px, transparent 3px 13px),
          linear-gradient(135deg, #1d1d1f, #dfe74f 44%, #0a8619);
        }
        .texture-sample-2 .sample-art { background:
          repeating-linear-gradient(132deg, rgba(255,255,255,.3) 0 3px, transparent 4px 18px),
          linear-gradient(135deg, #1d1d1f, #a8d3fb 48%, #0012f9);
        }
        .texture-sample-3 .sample-art { background:
          radial-gradient(circle at 18% 28%, rgba(255,255,255,.6) 0 10px, transparent 11px),
          radial-gradient(circle at 62% 45%, rgba(255,255,255,.42) 0 18px, transparent 19px),
          radial-gradient(circle at 82% 72%, rgba(255,255,255,.5) 0 9px, transparent 10px),
          linear-gradient(135deg, #242424, #9f8c71);
        }
        .texture-sample-4 .sample-art { background:
          repeating-linear-gradient(45deg, rgba(255,255,255,.26) 0 4px, transparent 5px 14px),
          linear-gradient(135deg, #1d1d1f, #ffb347 54%, #b64400);
        }

        .sample-art span {
          position: absolute;
          border-radius: 999px;
          background: rgba(255,255,255,.56);
          backdrop-filter: blur(8px);
        }

        .sample-art span:nth-child(1) { width: 112px; height: 18px; left: 18px; top: 24px; transform: rotate(-12deg); }
        .sample-art span:nth-child(2) { width: 86px; height: 14px; right: 20px; top: 74px; transform: rotate(18deg); }
        .sample-art span:nth-child(3) { width: 136px; height: 20px; left: 46px; bottom: 24px; transform: rotate(6deg); }

        @keyframes textureDrift {
          from { transform: scale(1.08) translate3d(-2%, -1%, 0); }
          to { transform: scale(1.16) translate3d(2%, 1%, 0); }
        }

        .texture-sample strong {
          display: block;
          font-family: var(--font-display);
          font-size: 24px;
          line-height: 1.16;
          letter-spacing: -0.006em;
        }

        .texture-sample p {
          margin: 6px 0 0;
          color: var(--color-graphite, #707070);
          font-size: 15px;
          line-height: 1.43;
          letter-spacing: -0.04px;
        }

        .home-system-showcase {
          display: grid;
          grid-template-columns: minmax(280px, .7fr) minmax(0, 1.3fr);
          gap: 42px;
          align-items: start;
        }

        .showcase-copy {
          position: sticky;
          top: 96px;
        }

        .showcase-copy span,
        .texture-copy span,
        .dealer-band span {
          display: block;
          margin-top: 18px;
        }

        .system-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
        }

        .system-card {
          display: flex;
          min-height: 326px;
          flex-direction: column;
          padding: 22px;
        }

        .system-card div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .system-card img {
          width: 100%;
          height: 158px;
          margin: 18px 0;
          border-radius: 24px;
          object-fit: contain;
          background: var(--color-fog, #f5f5f7);
          padding: 18px;
        }

        .texture-feature {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.16fr) minmax(320px, .84fr);
          gap: 36px;
          align-items: center;
          padding: 42px 24px 62px;
        }

        .texture-media {
          overflow: hidden;
          border-radius: 28px;
          background: #fff;
        }

        .texture-media img {
          width: 100%;
          height: min(58vw, 560px);
          min-height: 360px;
          object-fit: cover;
          display: block;
        }

        .texture-copy {
          padding: 18px 0;
        }

        .texture-copy .apple-text-link {
          margin-top: 24px;
        }

        .method-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 28px;
        }

        .method-card {
          min-height: 206px;
          padding: 28px;
        }

        .method-card span {
          display: inline-flex;
          margin-bottom: 28px;
        }

        .dealer-band {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto 70px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 28px;
          align-items: center;
          padding: 28px;
          border-radius: 28px;
          background: #fff;
        }

        .dealer-graphic {
          width: 86px;
          height: 86px;
          display: grid;
          place-items: center;
          position: relative;
          border-radius: 24px;
          background: var(--color-fog, #f5f5f7);
        }

        .dealer-graphic svg {
          width: 36px;
          height: 36px;
        }

        .dealer-graphic div {
          position: absolute;
          inset: 12px;
          border-radius: inherit;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
        }

        .final-home-cta {
          display: grid;
          justify-items: center;
          text-align: center;
          padding: 82px 24px 96px;
          background: #fff;
        }

        .final-home-cta h2 {
          font-size: clamp(56px, 8vw, 96px);
        }

        @media (max-width: 1080px) {
          .home-hero,
          .home-color-stage,
          .home-system-showcase,
          .texture-feature,
          .texture-lab,
          .dealer-band {
            grid-template-columns: 1fr;
          }

          .color-stage-copy,
          .showcase-copy {
            max-width: none;
            justify-self: stretch;
            position: static;
          }

          .method-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .triad-grid,
          .system-grid {
            grid-template-columns: 1fr;
          }

          .home-hero {
            min-height: 760px;
            padding-top: 18px;
          }

          .parallax-card-5,
          .parallax-card-6 {
            display: none;
          }

          .home-product-triad,
          .home-system-showcase,
          .method-section,
          .home-color-stage,
          .texture-lab,
          .finish-gallery,
          .texture-feature {
            padding-top: 44px;
            padding-bottom: 44px;
          }

          .method-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .home-hero h1,
          .final-home-cta h2 {
            font-size: 52px;
          }

          .home-hero {
            min-height: 690px;
          }

          .parallax-hero-images {
            display: none;
          }

          .parallax-image-card figcaption {
            display: none;
          }

          .parallax-image-card {
            width: 132px;
            height: 98px;
            border-radius: 16px;
          }

          .color-matrix {
            grid-template-columns: repeat(5, minmax(30px, 1fr));
          }

          .texture-lab-grid {
            grid-template-columns: 1fr;
          }

          .finish-gallery-grid {
            grid-template-columns: 1fr;
            grid-template-rows: none;
          }

          .finish-card,
          .finish-card-large {
            min-height: 260px;
            grid-row: auto;
          }

          .dealer-band {
            margin-left: 24px;
            margin-right: 24px;
          }

          .apple-blue-pill,
          .dark-pill,
          .apple-text-link,
          .light-link {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
