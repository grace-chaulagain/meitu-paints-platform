import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import {
  ArrowIcon,
  LeafIcon,
  PaletteIcon,
  ShieldIcon,
  StoreIcon,
  TextureIcon,
} from "../components/ui/ApplePageIcons.jsx";

export default function About() {
  const pageRef = useRef(null);

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

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-about-page">
        <section className="about-hero" data-reveal>
          <div className="about-hero-copy">
            <p>Meitu Paints Nepal</p>
            <h1>Built for Nepal’s walls, weather, and workmanship.</h1>
            <span>
              Meitu Construction Materials manufactures complete paint systems:
              putting, primers, interior and exterior paints, granite textures,
              floor coatings, enamel, and supporting tools.
            </span>
            <div className="about-actions">
              <Link to="/products" className="apple-pill primary">
                Explore products <ArrowIcon />
              </Link>
              <Link to="/support" className="apple-text-link">
                Talk to support <ArrowIcon />
              </Link>
            </div>
          </div>
          <div className="about-hero-media">
            <img src="/About Us Image.webp" alt="Meitu Paints finish" />
          </div>
        </section>

        <section className="about-metrics" data-reveal>
          {[
            ["Technology", "China-German"],
            ["Products", "Complete system"],
            ["Focus", "Eco conscious"],
            ["Office", "Bhimsengola"],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="about-system" data-reveal>
          <div className="about-section-copy">
            <p>System-first thinking</p>
            <h2>Not just paint. The layers that make paint last.</h2>
            <span>
              Durable finishes depend on the full sequence: surface repair,
              primer, product choice, application method, drying time, and
              color behavior under real light.
            </span>
          </div>
          <div className="about-card-grid">
            {[
              ["Surface integrity", "Putting and primer prepare the wall.", <ShieldIcon />],
              ["Color confidence", "Shade choices should work in real rooms.", <PaletteIcon />],
              ["Texture excellence", "Granite finishes add architectural depth.", <TextureIcon />],
              ["Cleaner choices", "Low-odor and eco-aware systems matter.", <LeafIcon />],
            ].map(([title, copy, icon]) => (
              <article key={title}>
                <div>{icon}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-dark-band" data-reveal>
          <div>
            <p>Mission</p>
            <h2>Bring new innovations and move forward together.</h2>
          </div>
          <span>
            We combine modern coating technology with practical site guidance,
            helping homeowners, contractors, and dealers choose the right product
            for the right surface.
          </span>
        </section>

        <section className="about-final" data-reveal>
          <StoreIcon />
          <h2>Ready to build with Meitu?</h2>
          <p>Explore systems, estimate rates, or become a dealer.</p>
          <div>
            <Link to="/dealership" className="apple-pill primary">
              Become a dealer <ArrowIcon />
            </Link>
            <Link to="/ratecalculator" className="apple-text-link">
              Estimate cost <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <style>{`
        .apple-about-page {
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          overflow: hidden;
        }
        .apple-about-page svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .about-hero,
        .about-system,
        .about-dark-band,
        .about-final,
        .about-metrics {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
        }
        .about-hero {
          width: 100%;
          max-width: none;
          margin: 0;
          min-height: 88vh;
          display: grid;
          grid-template-columns: minmax(0, .95fr) minmax(320px, 1.05fr);
          gap: clamp(28px, 5vw, 70px);
          align-items: center;
          padding: clamp(88px, 10vw, 132px) max(20px, calc((100% - 1200px) / 2)) 58px;
          background: var(--meitu-home-hero-gradient);
        }
        .about-hero-copy p,
        .about-section-copy p,
        .about-dark-band p {
          margin: 0 0 10px;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          letter-spacing: -0.1px;
        }
        .about-hero h1,
        .about-section-copy h2,
        .about-dark-band h2,
        .about-final h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(48px, 7.5vw, 96px);
          line-height: 1.03;
          font-weight: 700;
          letter-spacing: -0.024em;
        }
        .about-hero-copy > span,
        .about-section-copy > span,
        .about-dark-band > span,
        .about-final p {
          display: block;
          margin-top: 20px;
          max-width: 620px;
          color: var(--color-graphite, #707070);
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.42;
        }
        .about-actions,
        .about-final div {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          align-items: center;
          margin-top: 30px;
        }
        .apple-pill,
        .apple-text-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          text-decoration: none;
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
        }
        .apple-pill.primary {
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
        .apple-pill.primary:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          transform: translateY(-1px);
        }
        .apple-pill.primary:active {
          transform: scale(.985);
        }
        .about-hero-media {
          min-height: 560px;
          border-radius: 28px;
          overflow: hidden;
          background: #fff;
        }
        .about-hero-media img {
          width: 100%;
          height: 100%;
          min-height: 560px;
          object-fit: cover;
          display: block;
        }
        .about-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          padding-bottom: 58px;
        }
        .about-metrics div,
        .about-card-grid article,
        .about-final {
          border-radius: 28px;
          background: #fff;
          padding: 28px;
        }
        .about-metrics span {
          display: block;
          color: var(--color-graphite, #707070);
          font-size: 13px;
          margin-bottom: 10px;
        }
        .about-metrics strong {
          display: block;
          font-size: clamp(22px, 3vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.02em;
        }
        .about-system {
          display: grid;
          grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
          gap: 28px;
          align-items: start;
          padding: 56px 0;
        }
        .about-section-copy h2,
        .about-dark-band h2,
        .about-final h2 {
          font-size: clamp(40px, 5.2vw, 72px);
        }
        .about-card-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .about-card-grid article {
          min-height: 210px;
          display: grid;
          align-content: start;
          gap: 10px;
        }
        .about-card-grid article div {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
        }
        .about-card-grid h3 {
          margin: 16px 0 0;
          font-size: 24px;
          letter-spacing: -0.015em;
        }
        .about-card-grid p {
          margin: 0;
          color: var(--color-graphite, #707070);
          line-height: 1.5;
        }
        .about-dark-band {
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 28px;
          align-items: end;
          border-radius: 28px;
          background: #000;
          color: #fff;
          padding: clamp(34px, 5vw, 58px);
        }
        .about-dark-band p,
        .about-dark-band > span {
          color: rgba(255,255,255,.72);
        }
        .about-final {
          display: grid;
          justify-items: center;
          text-align: center;
          margin-top: 72px;
          margin-bottom: 72px;
          padding: 64px 24px;
        }
        .about-final > svg {
          width: 42px;
          height: 42px;
          margin-bottom: 18px;
        }
        .about-final p {
          margin-left: auto;
          margin-right: auto;
        }
        [data-reveal] {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity .72s ease, transform .72s ease;
        }
        [data-reveal].is-in {
          opacity: 1;
          transform: translateY(0);
        }
        @media (max-width: 920px) {
          .about-hero,
          .about-system,
          .about-dark-band {
            grid-template-columns: 1fr;
          }
          .about-metrics,
          .about-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .about-metrics,
          .about-card-grid {
            grid-template-columns: 1fr;
          }
          .about-hero {
            min-height: auto;
          }
          .about-hero-media,
          .about-hero-media img {
            min-height: 320px;
          }
        }
      `}</style>
    </>
  );
}
