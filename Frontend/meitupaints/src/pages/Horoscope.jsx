import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import NavBar from "../components/NavBar";
import horoscopeList from "../ProductsList/horoscopeList.json";
import {
  ArrowIcon,
  PaletteIcon,
  ShieldIcon,
  TextureIcon,
} from "../components/ui/ApplePageIcons.jsx";

const ORBIT_SIGNS = horoscopeList.slice(0, 8);

function Horoscope() {
  const location = useLocation();
  const pageRef = useRef(null);
  const zodiacSectionRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.key]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReduced) {
      root.querySelectorAll("[data-horo-reveal]").forEach((node) => {
        node.classList.add("is-in");
      });
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

    root.querySelectorAll("[data-horo-reveal]").forEach((node, index) => {
      node.style.setProperty("--horo-delay", `${Math.min(index * 42, 260)}ms`);
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const featuredSign = horoscopeList[0];

  const scrollToZodiacs = () => {
    zodiacSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-horoscope-page">
        <section className="horo-hero">
          <div className="horo-hero-copy" data-horo-reveal>
            <p className="horo-kicker">Meitu colour horoscope</p>
            <h1>Find a palette that feels personal.</h1>
            <span>
              Zodiac-inspired colour stories for walls, accents, textures, and
              full-room moods. Built to feel calm, practical, and easy to choose.
            </span>
            <div className="horo-actions">
              <button type="button" className="horo-primary" onClick={scrollToZodiacs}>
                Explore palettes <ArrowIcon />
              </button>
              <Link to="/colors" className="horo-link">
                Open colour studio <ArrowIcon />
              </Link>
            </div>
            <div className="horo-metrics" aria-label="Horoscope colour summary">
              <span>
                <b>{horoscopeList.length}</b>
                zodiac palettes
              </span>
              <span>
                <b>48</b>
                curated tones
              </span>
              <span>
                <b>Meitu</b>
                finish guidance
              </span>
            </div>
          </div>

          <aside className="horo-stage" aria-label="Animated zodiac colour artwork" data-horo-reveal>
            <div className="horo-orbit" aria-hidden="true">
              {ORBIT_SIGNS.map((zodiac, index) => (
                <span
                  key={zodiac.id}
                  className="horo-orbit-item"
                  style={{
                    "--orbit-index": index,
                    "--orbit-count": ORBIT_SIGNS.length,
                    "--orbit-color": zodiac.palette?.[0] || "#e8e8ed",
                  }}
                >
                  <img src={zodiac.src} alt="" loading="eager" />
                </span>
              ))}
            </div>
            <div className="horo-feature-card">
              <div className="horo-feature-icon">
                <PaletteIcon />
              </div>
              <p>Featured shade mood</p>
              <strong>{featuredSign.name}</strong>
              <div className="horo-feature-swatches" aria-hidden="true">
                {featuredSign.palette?.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section ref={zodiacSectionRef} className="horo-zodiacs">
          <div className="horo-section-head" data-horo-reveal>
            <p>Zodiac palettes</p>
            <h2>Choose by mood, then refine by room.</h2>
            <span>
              Every card combines symbolic energy with usable colour direction:
              base shades, accent tones, and texture-friendly supporting colours.
            </span>
          </div>

          <div className="horo-grid">
            {horoscopeList.map((zodiac) => (
              <Link
                key={zodiac.id}
                to={`/horoscope/${zodiac.id}`}
                className="horo-card"
                style={{ "--zodiac-accent": zodiac.palette?.[0] || "#0071e3" }}
                data-horo-reveal
              >
                <div className="horo-card-media">
                  <img src={zodiac.src} alt={zodiac.name} loading="lazy" />
                </div>
                <div className="horo-card-body">
                  <div>
                    <small>Zodiac palette</small>
                    <h3>{zodiac.name}</h3>
                  </div>
                  <div className="horo-card-swatches" aria-label={`${zodiac.name} palette`}>
                    {zodiac.palette?.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </div>
                  <div className="horo-card-footer">
                    <span>
                      {(zodiac.chips || []).slice(0, 3).map((chip) => (
                        <b key={chip}>{chip}</b>
                      ))}
                    </span>
                    <em>
                      View <ArrowIcon />
                    </em>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="horo-utility" data-horo-reveal>
          <div>
            <TextureIcon />
            <p>Texture fit</p>
            <strong>Use the palette as a mood system, not a rule.</strong>
          </div>
          <div>
            <ShieldIcon />
            <p>Practical next step</p>
            <strong>Confirm product, finish, surface, and area before ordering.</strong>
          </div>
          <Link to="/ratecalculator" className="horo-dark-link">
            Calculate estimate <ArrowIcon />
          </Link>
        </section>
      </main>

      <style>{`
        .apple-horoscope-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 6%, rgba(0,113,227,.10), transparent 26%),
            radial-gradient(circle at 88% 20%, rgba(245,0,180,.08), transparent 30%),
            var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          overflow: clip;
        }

        .apple-horoscope-page svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .horo-hero {
          width: min(1200px, calc(100% - 40px));
          min-height: calc(100svh - 44px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
          align-items: center;
          gap: clamp(28px, 5vw, 72px);
          padding: clamp(56px, 8vw, 96px) 0 clamp(42px, 7vw, 78px);
        }

        .horo-kicker,
        .horo-section-head p,
        .horo-feature-card p,
        .horo-utility p {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .horo-hero-copy h1 {
          max-width: 820px;
          margin: 12px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(56px, 8.5vw, 104px);
          font-weight: 700;
          line-height: .98;
          letter-spacing: -0.055em;
        }

        .horo-hero-copy > span {
          display: block;
          max-width: 610px;
          margin-top: 24px;
          color: var(--color-slate, #474747);
          font-size: clamp(18px, 2vw, 23px);
          font-weight: 300;
          line-height: 1.38;
          letter-spacing: -0.012em;
        }

        .horo-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px;
          margin-top: 32px;
        }

        .horo-primary,
        .horo-dark-link {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
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

        .horo-primary:hover,
        .horo-dark-link:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          color: #fff;
          transform: translateY(-1px);
        }

        .horo-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 17px;
          letter-spacing: -0.1px;
        }

        .horo-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          max-width: 620px;
          margin-top: 34px;
        }

        .horo-metrics span {
          min-height: 74px;
          display: grid;
          align-content: center;
          gap: 3px;
          border: 1px solid rgba(232,232,237,.86);
          border-radius: 24px;
          background: rgba(255,255,255,.72);
          padding: 13px 16px;
          color: var(--color-graphite, #707070);
          font-size: 13px;
          letter-spacing: -0.003em;
        }

        .horo-metrics b {
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 22px;
          letter-spacing: -0.035em;
        }

        .horo-stage {
          position: relative;
          min-height: 540px;
          display: grid;
          place-items: center;
        }

        .horo-stage::before {
          content: "";
          position: absolute;
          inset: 32px 0;
          border-radius: 44px;
          background:
            radial-gradient(circle at 50% 36%, rgba(255,255,255,.98), rgba(255,255,255,.42) 42%, transparent 65%),
            var(--meitu-home-hero-gradient, #f5f5f7);
          border: 1px solid rgba(232,232,237,.88);
        }

        .horo-orbit {
          position: relative;
          width: min(430px, 86vw);
          aspect-ratio: 1;
          border-radius: 50%;
          animation: horo-orbit 24s linear infinite;
        }

        .horo-orbit::before,
        .horo-orbit::after {
          content: "";
          position: absolute;
          inset: 13%;
          border: 1px solid rgba(29,29,31,.08);
          border-radius: 50%;
        }

        .horo-orbit::after {
          inset: 28%;
        }

        .horo-orbit-item {
          --angle: calc(360deg / var(--orbit-count) * var(--orbit-index));
          position: absolute;
          left: 50%;
          top: 50%;
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background:
            radial-gradient(circle at 50% 20%, rgba(255,255,255,.98), transparent 54%),
            color-mix(in srgb, var(--orbit-color) 24%, white);
          border: 1px solid rgba(255,255,255,.82);
          transform:
            translate(-50%, -50%)
            rotate(var(--angle))
            translateY(-178px)
            rotate(calc(var(--angle) * -1));
        }

        .horo-orbit-item img {
          width: 78%;
          height: 78%;
          object-fit: contain;
          filter: saturate(.94);
        }

        .horo-feature-card {
          position: absolute;
          width: min(255px, 74%);
          display: grid;
          justify-items: center;
          gap: 10px;
          border-radius: 32px;
          border: 1px solid rgba(232,232,237,.9);
          background: rgba(255,255,255,.84);
          padding: 24px;
          text-align: center;
          backdrop-filter: blur(22px);
        }

        .horo-feature-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
        }

        .horo-feature-icon svg {
          width: 24px;
          height: 24px;
        }

        .horo-feature-card strong {
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 34px;
          letter-spacing: -0.045em;
        }

        .horo-feature-swatches {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
          margin-top: 4px;
        }

        .horo-feature-swatches i,
        .horo-card-swatches span {
          display: block;
          height: 9px;
          border-radius: 999px;
          border: 1px solid rgba(29,29,31,.07);
        }

        .horo-zodiacs {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
          padding: clamp(20px, 4vw, 52px) 0 clamp(70px, 10vw, 116px);
        }

        .horo-section-head {
          max-width: 760px;
          margin-bottom: 28px;
        }

        .horo-section-head h2 {
          margin: 10px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(38px, 5vw, 64px);
          line-height: 1.05;
          letter-spacing: -0.044em;
        }

        .horo-section-head > span {
          display: block;
          max-width: 660px;
          margin-top: 14px;
          color: var(--color-graphite, #707070);
          font-size: 20px;
          font-weight: 300;
          line-height: 1.42;
          letter-spacing: -0.01em;
        }

        .horo-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .horo-card {
          min-height: 345px;
          display: grid;
          grid-template-rows: 168px 1fr;
          border-radius: 30px;
          border: 1px solid rgba(232,232,237,.92);
          background:
            radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--zodiac-accent) 18%, transparent), transparent 36%),
            rgba(255,255,255,.84);
          color: var(--color-ink, #1d1d1f);
          text-decoration: none;
          overflow: hidden;
          transition: transform .16s ease, border-color .16s ease, background-color .16s ease;
        }

        .horo-card:hover {
          transform: translateY(-3px);
          border-color: rgba(29,29,31,.18);
          color: var(--color-ink, #1d1d1f);
        }

        .horo-card-media {
          display: grid;
          place-items: center;
          margin: 14px 14px 0;
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 18%, rgba(255,255,255,.98), transparent 54%),
            var(--color-fog, #f5f5f7);
          overflow: hidden;
        }

        .horo-card-media img {
          width: min(74%, 150px);
          height: 74%;
          object-fit: contain;
          filter: saturate(.96);
          transition: transform .24s ease;
        }

        .horo-card:hover .horo-card-media img {
          transform: scale(1.045);
        }

        .horo-card-body {
          display: grid;
          align-content: space-between;
          gap: 16px;
          padding: 18px;
        }

        .horo-card small {
          display: block;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .horo-card h3 {
          margin: 5px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 25px;
          line-height: 1.1;
          letter-spacing: -0.034em;
        }

        .horo-card-swatches {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        .horo-card-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }

        .horo-card-footer > span {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .horo-card-footer b {
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-graphite, #707070);
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: -0.003em;
        }

        .horo-card-footer em {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--color-cobalt-link, #0066cc);
          font-size: 14px;
          font-style: normal;
          white-space: nowrap;
        }

        .horo-utility {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto clamp(58px, 8vw, 96px);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
          gap: 14px;
          align-items: stretch;
          border-radius: 36px;
          background: #000;
          color: #fff;
          padding: 18px;
        }

        .horo-utility > div,
        .horo-dark-link {
          border-radius: 26px;
          background: rgba(255,255,255,.08);
          padding: 20px;
        }

        .horo-utility > div {
          display: grid;
          align-content: start;
          gap: 10px;
        }

        .horo-utility p {
          color: rgba(255,255,255,.58);
        }

        .horo-utility strong {
          max-width: 360px;
          color: #fff;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 23px;
          line-height: 1.16;
          letter-spacing: -0.035em;
        }

        .horo-dark-link {
          align-self: center;
          background: #fff;
          color: #000;
        }

        .horo-dark-link:hover {
          background: rgba(255,255,255,.86);
          color: #000;
        }

        [data-horo-reveal] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity .72s ease, transform .72s ease;
          transition-delay: var(--horo-delay, 0ms);
        }

        [data-horo-reveal].is-in {
          opacity: 1;
          transform: translateY(0);
        }

        @keyframes horo-orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .horo-orbit,
          [data-horo-reveal] {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1060px) {
          .horo-hero {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .horo-stage {
            min-height: 460px;
          }

          .horo-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .horo-utility {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .horo-hero,
          .horo-zodiacs,
          .horo-utility {
            width: min(100% - 28px, 1200px);
          }

          .horo-hero {
            padding-top: 62px;
          }

          .horo-hero-copy h1 {
            font-size: clamp(46px, 13vw, 70px);
          }

          .horo-hero-copy > span,
          .horo-section-head > span {
            font-size: 17px;
          }

          .horo-metrics {
            grid-template-columns: 1fr;
          }

          .horo-stage {
            min-height: 400px;
          }

          .horo-orbit {
            width: min(330px, 86vw);
          }

          .horo-orbit-item {
            width: 54px;
            height: 54px;
            border-radius: 18px;
            transform:
              translate(-50%, -50%)
              rotate(var(--angle))
              translateY(-132px)
              rotate(calc(var(--angle) * -1));
          }

          .horo-feature-card {
            width: min(232px, 78%);
            padding: 20px;
          }

          .horo-grid {
            grid-template-columns: 1fr;
          }

          .horo-card {
            min-height: auto;
            grid-template-rows: 170px auto;
          }

          .horo-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .horo-primary {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .horo-stage {
            min-height: 340px;
          }

          .horo-orbit {
            display: none;
          }

          .horo-stage::before {
            inset: 0;
          }

          .horo-feature-card {
            position: relative;
          }

        }
      `}</style>
    </>
  );
}

export default Horoscope;
