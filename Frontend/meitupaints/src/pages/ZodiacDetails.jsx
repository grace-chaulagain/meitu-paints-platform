import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import ZODIACS from "../ProductsList/ZodiacList.json";
import {
  ArrowIcon,
  PaletteIcon,
  ShieldIcon,
  StoreIcon,
  TextureIcon,
} from "../components/ui/ApplePageIcons.jsx";

function getColorCode(name = "") {
  const match = name.match(/\(([^)]+)\)/);
  return match?.[1] || "Meitu";
}

function getColorName(name = "") {
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim();
}

export default function ZodiacDetails() {
  const { zodiac } = useParams();
  const location = useLocation();
  const pageRef = useRef(null);

  const activeZodiac = useMemo(
    () => ZODIACS.find((item) => item.id === zodiac) || null,
    [zodiac],
  );

  const relatedSigns = useMemo(() => {
    if (!activeZodiac) return [];
    const currentIndex = ZODIACS.findIndex((item) => item.id === activeZodiac.id);
    return [1, 2, 3]
      .map((offset) => ZODIACS[(currentIndex + offset) % ZODIACS.length])
      .filter(Boolean);
  }, [activeZodiac]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.key]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReduced) {
      root.querySelectorAll("[data-zodiac-reveal]").forEach((node) => {
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

    root.querySelectorAll("[data-zodiac-reveal]").forEach((node, index) => {
      node.style.setProperty("--zodiac-delay", `${Math.min(index * 50, 280)}ms`);
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [activeZodiac]);

  if (!activeZodiac) {
    return (
      <>
        <NavBar />
        <main className="apple-zodiac-detail zodiac-missing">
          <section className="zodiac-missing-card">
            <p>Meitu colour horoscope</p>
            <h1>Zodiac not found.</h1>
            <span>Return to the horoscope studio and choose a palette.</span>
            <Link to="/horoscope" className="zodiac-primary">
              Back to horoscope <ArrowIcon />
            </Link>
          </section>
        </main>
      </>
    );
  }

  const foundationColor = activeZodiac.bestColors?.[0];
  const accentColor = activeZodiac.bestColors?.[1];
  const supportColor = activeZodiac.bestColors?.[2];
  const darkColor = activeZodiac.bestColors?.[5] || activeZodiac.bestColors?.[3];

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-zodiac-detail">
        <section className="zodiac-hero">
          <div className="zodiac-back-row" data-zodiac-reveal>
            <Link to="/horoscope" className="zodiac-back">
              <span>‹</span>
              Horoscope
            </Link>
          </div>

          <div className="zodiac-hero-grid">
            <div className="zodiac-hero-copy" data-zodiac-reveal>
              <p>Meitu zodiac colour system</p>
              <h1>{activeZodiac.name}</h1>
              <span>{activeZodiac.hook}</span>
              <div className="zodiac-copy-card">
                <PaletteIcon />
                <p>{activeZodiac.copywrite}</p>
              </div>
              <div className="zodiac-actions">
                <Link to="/colors" className="zodiac-primary">
                  Explore colours <ArrowIcon />
                </Link>
                <Link to="/inquiry" className="zodiac-text-link">
                  Ask for palette help <ArrowIcon />
                </Link>
              </div>
            </div>

            <aside className="zodiac-symbol-stage" data-zodiac-reveal>
              <div
                className="zodiac-symbol-card"
                style={{
                  "--zodiac-main": foundationColor?.rgb || "#e8e8ed",
                  "--zodiac-accent": accentColor?.rgb || "#0071e3",
                  "--zodiac-support": supportColor?.rgb || "#f5f5f7",
                }}
              >
                <div className="zodiac-symbol-rings" aria-hidden="true" />
                <img src={activeZodiac.imgSrc} alt={activeZodiac.name} />
                <div className="zodiac-symbol-caption">
                  <small>Signature tone</small>
                  <strong>{getColorName(foundationColor?.name)}</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="zodiac-palette-section">
          <header className="zodiac-section-head" data-zodiac-reveal>
            <p>Official palette</p>
            <h2>Six colours, one room direction.</h2>
            <span>
              Use one foundation shade, one accent shade, then keep the remaining
              colours as supporting trims, texture accents, and contrast points.
            </span>
          </header>

          <div className="zodiac-palette-grid">
            {activeZodiac.bestColors.map((color, index) => (
              <article
                key={color.name}
                className="zodiac-color-card"
                data-zodiac-reveal
                style={{ "--card-color": color.rgb }}
              >
                <div className="zodiac-color-surface" />
                <div className="zodiac-color-info">
                  <small>{index === 0 ? "Foundation" : index === 1 ? "Accent" : "Support"}</small>
                  <strong>{getColorName(color.name)}</strong>
                  <span>{getColorCode(color.name)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="zodiac-room-section">
          <div className="zodiac-room-preview" data-zodiac-reveal>
            <div
              className="zodiac-room-art"
              style={{
                "--room-base": foundationColor?.rgb || "#f5f5f7",
                "--room-accent": accentColor?.rgb || "#e8e8ed",
                "--room-support": supportColor?.rgb || "#ffffff",
                "--room-dark": darkColor?.rgb || "#1d1d1f",
              }}
            >
              <div className="room-wall" />
              <div className="room-panel" />
              <div className="room-floor" />
              <div className="room-frame one" />
              <div className="room-frame two" />
              <div className="room-console" />
            </div>
          </div>

          <div className="zodiac-guide-stack">
            {[
              {
                icon: <StoreIcon />,
                label: "Foundation",
                title: "Start with the calmest large-surface colour.",
                body: `${getColorName(foundationColor?.name)} works as the anchor tone for walls, hallways, or larger rooms.`,
              },
              {
                icon: <TextureIcon />,
                label: "Texture",
                title: "Use the stronger colour where light can shape it.",
                body: `${getColorName(accentColor?.name)} is better as a feature wall, niche, column, or texture surface.`,
              },
              {
                icon: <ShieldIcon />,
                label: "Finish",
                title: "Pick the finish after checking daylight and surface quality.",
                body: "Matte keeps the palette soft. Satin and eggshell make trims and high-use areas easier to maintain.",
              },
            ].map((item) => (
              <article key={item.label} className="zodiac-guide-card" data-zodiac-reveal>
                <div>{item.icon}</div>
                <small>{item.label}</small>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="zodiac-related-section" data-zodiac-reveal>
          <div>
            <p>Keep exploring</p>
            <h2>Related palettes</h2>
          </div>
          <div className="zodiac-related-grid">
            {relatedSigns.map((item) => (
              <Link
                key={item.id}
                to={`/horoscope/${item.id}`}
                className="zodiac-related-card"
              >
                <img src={item.imgSrc} alt="" />
                <span>
                  <small>Zodiac palette</small>
                  <strong>{item.name}</strong>
                </span>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="zodiac-final" data-zodiac-reveal>
          <div>
            <p>Apply the palette</p>
            <h2>Turn {activeZodiac.name} into a practical paint plan.</h2>
            <span>
              Share your wall area, room lighting, and surface condition. We’ll
              help translate this palette into the right Meitu product system.
            </span>
          </div>
          <div className="zodiac-final-actions">
            <Link to="/ratecalculator" className="zodiac-primary dark">
              Calculate estimate <ArrowIcon />
            </Link>
            <Link to="/products" className="zodiac-dark-link">
              View products <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <style>{`
        .apple-zodiac-detail {
          min-height: 100vh;
          background:
            radial-gradient(circle at 12% 4%, rgba(0,113,227,.08), transparent 28%),
            radial-gradient(circle at 86% 18%, rgba(245,0,180,.07), transparent 30%),
            var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          overflow: clip;
        }

        .apple-zodiac-detail svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .zodiac-hero,
        .zodiac-palette-section,
        .zodiac-room-section,
        .zodiac-related-section,
        .zodiac-final {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
        }

        .zodiac-hero {
          min-height: calc(100svh - 44px);
          display: grid;
          align-content: center;
          gap: 28px;
          padding: clamp(48px, 7vw, 82px) 0 clamp(42px, 7vw, 78px);
        }

        .zodiac-back-row {
          display: flex;
        }

        .zodiac-back {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(232,232,237,.92);
          color: var(--color-ink, #1d1d1f);
          padding: 7px 13px 7px 10px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .zodiac-back span {
          font-size: 22px;
          line-height: 1;
          transform: translateY(-1px);
        }

        .zodiac-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 490px);
          align-items: center;
          gap: clamp(28px, 5vw, 72px);
        }

        .zodiac-hero-copy > p,
        .zodiac-section-head p,
        .zodiac-color-info small,
        .zodiac-guide-card small,
        .zodiac-related-section > div > p,
        .zodiac-final p,
        .zodiac-symbol-caption small {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .zodiac-hero-copy h1 {
          margin: 10px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(72px, 11vw, 132px);
          line-height: .92;
          font-weight: 700;
          letter-spacing: -0.065em;
        }

        .zodiac-hero-copy > span {
          display: block;
          max-width: 630px;
          margin-top: 24px;
          color: var(--color-slate, #474747);
          font-size: clamp(20px, 2.1vw, 25px);
          line-height: 1.34;
          font-weight: 300;
          letter-spacing: -0.012em;
        }

        .zodiac-copy-card {
          max-width: 650px;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 14px;
          margin-top: 24px;
          border-radius: 30px;
          border: 1px solid rgba(232,232,237,.92);
          background: rgba(255,255,255,.74);
          padding: 18px;
        }

        .zodiac-copy-card svg {
          width: 24px;
          height: 24px;
          margin: 8px auto;
        }

        .zodiac-copy-card p {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 15px;
          line-height: 1.55;
          letter-spacing: -0.006em;
        }

        .zodiac-actions,
        .zodiac-final-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
          margin-top: 28px;
        }

        .zodiac-primary,
        .zodiac-dark-link {
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

        .zodiac-primary:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          color: #fff;
          transform: translateY(-1px);
        }

        .zodiac-text-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 17px;
          letter-spacing: -0.1px;
        }

        .zodiac-symbol-stage {
          min-height: 520px;
          display: grid;
          place-items: center;
        }

        .zodiac-symbol-card {
          position: relative;
          width: min(480px, 100%);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 44px;
          border: 1px solid rgba(232,232,237,.92);
          background:
            radial-gradient(circle at 50% 24%, rgba(255,255,255,.98), transparent 36%),
            radial-gradient(circle at 24% 82%, color-mix(in srgb, var(--zodiac-main) 28%, transparent), transparent 36%),
            radial-gradient(circle at 86% 20%, color-mix(in srgb, var(--zodiac-accent) 24%, transparent), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.88), rgba(245,245,247,.78));
          overflow: hidden;
        }

        .zodiac-symbol-card img {
          position: relative;
          z-index: 2;
          width: min(62%, 290px);
          height: min(62%, 290px);
          object-fit: contain;
          filter: saturate(.96);
          animation: zodiac-float 7s ease-in-out infinite;
        }

        .zodiac-symbol-rings,
        .zodiac-symbol-rings::before,
        .zodiac-symbol-rings::after {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(29,29,31,.08);
          content: "";
        }

        .zodiac-symbol-rings {
          inset: 12%;
          animation: zodiac-spin 22s linear infinite;
        }

        .zodiac-symbol-rings::before {
          inset: 15%;
        }

        .zodiac-symbol-rings::after {
          inset: 31%;
        }

        .zodiac-symbol-caption {
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 22px;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-radius: 24px;
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(232,232,237,.9);
          padding: 14px 16px;
          backdrop-filter: blur(20px);
        }

        .zodiac-symbol-caption strong {
          color: var(--color-ink, #1d1d1f);
          font-size: 15px;
          text-align: right;
        }

        .zodiac-palette-section {
          padding: clamp(54px, 8vw, 92px) 0;
        }

        .zodiac-section-head {
          max-width: 760px;
          margin-bottom: 28px;
        }

        .zodiac-section-head h2,
        .zodiac-related-section h2,
        .zodiac-final h2 {
          margin: 10px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(38px, 5vw, 64px);
          line-height: 1.05;
          letter-spacing: -0.044em;
        }

        .zodiac-section-head > span,
        .zodiac-final > div > span {
          display: block;
          max-width: 670px;
          margin-top: 14px;
          color: var(--color-graphite, #707070);
          font-size: 20px;
          font-weight: 300;
          line-height: 1.42;
          letter-spacing: -0.01em;
        }

        .zodiac-palette-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .zodiac-color-card {
          min-height: 255px;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          border-radius: 28px;
          border: 1px solid rgba(232,232,237,.92);
          background: rgba(255,255,255,.8);
          overflow: hidden;
        }

        .zodiac-color-surface {
          min-height: 145px;
          background: var(--card-color);
        }

        .zodiac-color-info {
          display: grid;
          gap: 6px;
          padding: 15px;
        }

        .zodiac-color-info strong {
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 18px;
          line-height: 1.1;
          letter-spacing: -0.024em;
        }

        .zodiac-color-info span {
          color: var(--color-graphite, #707070);
          font-size: 13px;
        }

        .zodiac-room-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
          gap: 18px;
          align-items: stretch;
          padding-bottom: clamp(54px, 8vw, 92px);
        }

        .zodiac-room-preview,
        .zodiac-guide-card,
        .zodiac-related-section,
        .zodiac-final,
        .zodiac-missing-card {
          border-radius: 36px;
          border: 1px solid rgba(232,232,237,.92);
          background: rgba(255,255,255,.78);
        }

        .zodiac-room-preview {
          min-height: 560px;
          padding: 18px;
        }

        .zodiac-room-art {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 520px;
          border-radius: 28px;
          background: var(--room-base);
          overflow: hidden;
        }

        .room-wall {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 72% 18%, rgba(255,255,255,.32), transparent 28%),
            linear-gradient(115deg, var(--room-base), color-mix(in srgb, var(--room-base) 72%, white));
        }

        .room-panel {
          position: absolute;
          left: 9%;
          top: 10%;
          width: 34%;
          height: 70%;
          border-radius: 28px;
          background:
            radial-gradient(circle at 30% 18%, rgba(255,255,255,.28), transparent 32%),
            var(--room-accent);
        }

        .room-floor {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 28%;
          background: linear-gradient(180deg, color-mix(in srgb, var(--room-support) 74%, white), var(--room-support));
        }

        .room-frame {
          position: absolute;
          border: 10px solid rgba(255,255,255,.72);
          border-radius: 20px;
          background: color-mix(in srgb, var(--room-dark) 78%, white);
        }

        .room-frame.one {
          right: 13%;
          top: 17%;
          width: 22%;
          height: 22%;
        }

        .room-frame.two {
          right: 23%;
          top: 46%;
          width: 16%;
          height: 16%;
          opacity: .72;
        }

        .room-console {
          position: absolute;
          right: 8%;
          bottom: 23%;
          width: 42%;
          height: 10%;
          border-radius: 999px;
          background: color-mix(in srgb, var(--room-dark) 84%, white);
        }

        .zodiac-guide-stack {
          display: grid;
          gap: 14px;
        }

        .zodiac-guide-card {
          display: grid;
          gap: 9px;
          padding: 22px;
        }

        .zodiac-guide-card > div {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: var(--color-fog, #f5f5f7);
        }

        .zodiac-guide-card strong {
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 22px;
          line-height: 1.14;
          letter-spacing: -0.034em;
        }

        .zodiac-guide-card p {
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 14px;
          line-height: 1.48;
        }

        .zodiac-related-section {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 18px;
          align-items: center;
          padding: 22px;
          margin-bottom: clamp(54px, 8vw, 92px);
        }

        .zodiac-related-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .zodiac-related-card {
          min-height: 92px;
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) 18px;
          align-items: center;
          gap: 12px;
          border-radius: 24px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          padding: 13px;
          text-decoration: none;
        }

        .zodiac-related-card img {
          width: 54px;
          height: 54px;
          object-fit: contain;
        }

        .zodiac-related-card small {
          display: block;
          color: var(--color-graphite, #707070);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .zodiac-related-card strong {
          display: block;
          margin-top: 2px;
          color: var(--color-ink, #1d1d1f);
          font-size: 18px;
        }

        .zodiac-final {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: clamp(58px, 8vw, 96px);
          padding: 30px;
          background: #000;
          color: #fff;
        }

        .zodiac-final p,
        .zodiac-final h2,
        .zodiac-final > div > span {
          color: #fff;
        }

        .zodiac-final > div > span {
          color: rgba(255,255,255,.64);
        }

        .zodiac-primary.dark {
          background: #fff;
          color: #000;
        }

        .zodiac-primary.dark:hover,
        .zodiac-dark-link:hover {
          background: rgba(255,255,255,.86);
          color: #000;
        }

        .zodiac-dark-link {
          background: rgba(255,255,255,.12);
          color: #fff;
        }

        .zodiac-missing {
          display: grid;
          place-items: center;
          padding: 90px 20px;
        }

        .zodiac-missing-card {
          width: min(680px, 100%);
          display: grid;
          justify-items: center;
          gap: 14px;
          padding: 44px 28px;
          text-align: center;
        }

        .zodiac-missing-card h1 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(44px, 8vw, 80px);
          letter-spacing: -0.055em;
        }

        .zodiac-missing-card > span {
          color: var(--color-graphite, #707070);
        }

        [data-zodiac-reveal] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity .72s ease, transform .72s ease;
          transition-delay: var(--zodiac-delay, 0ms);
        }

        [data-zodiac-reveal].is-in {
          opacity: 1;
          transform: translateY(0);
        }

        @keyframes zodiac-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes zodiac-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .zodiac-symbol-card img,
          .zodiac-symbol-rings,
          [data-zodiac-reveal] {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 1080px) {
          .zodiac-hero-grid,
          .zodiac-room-section,
          .zodiac-related-section {
            grid-template-columns: 1fr;
          }

          .zodiac-symbol-stage {
            min-height: auto;
          }

          .zodiac-palette-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .zodiac-hero,
          .zodiac-palette-section,
          .zodiac-room-section,
          .zodiac-related-section,
          .zodiac-final {
            width: min(100% - 28px, 1200px);
          }

          .zodiac-hero-copy h1 {
            font-size: clamp(56px, 18vw, 88px);
          }

          .zodiac-hero-copy > span,
          .zodiac-section-head > span,
          .zodiac-final > div > span {
            font-size: 17px;
          }

          .zodiac-symbol-card {
            border-radius: 34px;
          }

          .zodiac-palette-grid,
          .zodiac-related-grid {
            grid-template-columns: 1fr;
          }

          .zodiac-room-preview {
            min-height: 420px;
          }

          .zodiac-room-art {
            min-height: 390px;
          }

          .zodiac-final {
            display: grid;
          }

          .zodiac-actions,
          .zodiac-final-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .zodiac-primary,
          .zodiac-dark-link {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
