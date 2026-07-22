import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import {
  ArrowIcon,
  CalculatorIcon,
  PaletteIcon,
  ShieldIcon,
  StoreIcon,
  SupportIcon,
  TruckIcon,
} from "../components/ui/ApplePageIcons.jsx";

export default function DealershipPage() {
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
    items.forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);
      io.observe(item);
    });
    return () => io.disconnect();
  }, []);

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-dealer-page">
        <section className="dealer-hero" data-reveal>
          <div className="dealer-hero-copy">
            <p>Meitu dealership</p>
            <h1>Grow with a paint system built for real markets.</h1>
            <span>
              Join Meitu’s dealer network with product guidance, shade support,
              texture systems, and operational workflows designed for repeatable
              service.
            </span>
            <div className="dealer-actions">
              <Link to="/dealership/register" className="apple-pill primary">
                Apply for dealership <ArrowIcon />
              </Link>
              <Link to="/support" className="apple-text-link">
                Talk to support <ArrowIcon />
              </Link>
            </div>
            <div className="dealer-quick-steps" aria-label="Dealership application steps">
              {[
                ["1", "Apply"],
                ["2", "Review"],
                ["3", "Activate"],
              ].map(([num, label]) => (
                <span key={num}>
                  <b>{num}</b>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="dealer-device" aria-hidden="true">
            <span className="dealer-glow glow-one" />
            <span className="dealer-glow glow-two" />
            <div className="dealer-portal-card">
              <div className="dealer-portal-head">
                <span>
                  <StoreIcon />
                </span>
                <div>
                  <strong>Dealer Portal</strong>
                  <small>Catalog, cart, orders, and reports.</small>
                </div>
              </div>
              <div className="dealer-portal-screen">
                {[
                  ["Catalog access", "Live", <StoreIcon />],
                  ["Shade support", "Ready", <PaletteIcon />],
                  ["Order routing", "Tracked", <TruckIcon />],
                ].map(([label, status, icon], index) => (
                  <div
                    key={label}
                    className={`dealer-portal-row ${index === 0 ? "active" : ""}`}
                  >
                    <span>
                      {icon}
                      {label}
                    </span>
                    <b>{status}</b>
                  </div>
                ))}
              </div>
              <div className="dealer-portal-stats">
                <span>
                  <b>24/7</b>
                  portal
                </span>
                <span>
                  <b>Fast</b>
                  ordering
                </span>
              </div>
            </div>
            <div className="dealer-orbit-card card-one">
              <StoreIcon />
              <span>Retail ready</span>
            </div>
            <div className="dealer-orbit-card card-two">
              <TruckIcon />
              <span>Order flow</span>
            </div>
          </div>
        </section>

        <section className="dealer-process" data-reveal>
          <div className="dealer-section-head">
            <p>Onboarding</p>
            <h2>Four steps from application to launch.</h2>
          </div>
          <div className="dealer-step-grid">
            {[
              ["01", "Apply", "Submit business and contact details."],
              ["02", "Review", "Meitu reviews territory and readiness."],
              ["03", "Activate", "Account credentials and dealer portal setup."],
              ["04", "Operate", "Place orders and serve customers faster."],
            ].map(([num, title, copy]) => (
              <article key={num}>
                <span>{num}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dealer-value" data-reveal>
          <div className="dealer-section-head">
            <p>Partnership value</p>
            <h2>Tools that help dealers sell better, not louder.</h2>
          </div>
          <div className="dealer-value-grid">
            {[
              ["Product systems", "Organized catalog across buckets, colors, textures, primers, and utilities.", <StoreIcon />],
              ["Color support", "Use room previews and shade references to guide customers.", <PaletteIcon />],
              ["Pricing clarity", "Estimate project costs with the rate calculator.", <CalculatorIcon />],
              ["Reliable service", "Support for product choice, order flow, and technical questions.", <SupportIcon />],
              ["Trust signals", "Eco-aware, low-odor, and weather-conscious systems.", <ShieldIcon />],
              ["Delivery workflow", "Orders stay traceable through admin, factory, and dispatch handling.", <TruckIcon />],
            ].map(([title, copy, icon]) => (
              <article key={title}>
                <div>{icon}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dealer-final" data-reveal>
          <h2>Ready to apply?</h2>
          <p>Keep documents and business details ready. Optional fields can be added later in the registration flow.</p>
          <div>
            <Link to="/dealership/register" className="apple-pill primary">
              Start application <ArrowIcon />
            </Link>
            <Link to="/products" className="apple-text-link">
              Review products <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <style>{`
        .apple-dealer-page {
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
        }
        .apple-dealer-page svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .dealer-hero,
        .dealer-process,
        .dealer-value,
        .dealer-final {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
        }
        .dealer-hero {
          width: 100%;
          max-width: none;
          margin: 0;
          min-height: calc(100svh - 44px);
          display: grid;
          grid-template-columns: minmax(0, .95fr) minmax(320px, 1.05fr);
          gap: clamp(28px, 5vw, 70px);
          align-items: center;
          padding: clamp(62px, 8vw, 106px) max(20px, calc((100% - 1200px) / 2)) clamp(52px, 7vw, 84px);
          background:
            radial-gradient(circle at 16% 14%, rgba(255,255,255,.9), transparent 25%),
            radial-gradient(circle at 84% 18%, rgba(0,113,227,.14), transparent 28%),
            radial-gradient(circle at 70% 88%, rgba(221,220,140,.34), transparent 34%),
            var(--meitu-home-hero-gradient);
          isolation: isolate;
        }
        .dealer-hero-copy p,
        .dealer-section-head p {
          margin: 0 0 10px;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          letter-spacing: -0.1px;
        }
        .dealer-hero h1,
        .dealer-section-head h2,
        .dealer-final h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(48px, 7.5vw, 96px);
          line-height: 1.03;
          font-weight: 700;
          letter-spacing: -0.024em;
        }
        .dealer-hero-copy > span,
        .dealer-final p {
          display: block;
          max-width: 610px;
          margin-top: 20px;
          color: var(--color-graphite, #707070);
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.42;
        }
        .dealer-actions,
        .dealer-final div {
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
        .dealer-quick-steps {
          width: min(610px, 100%);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 28px;
        }
        .dealer-quick-steps span {
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          border: 1px solid rgba(232,232,237,.9);
          background: rgba(255,255,255,.72);
          padding: 8px 13px 8px 9px;
          color: var(--color-ink, #1d1d1f);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          backdrop-filter: blur(18px);
        }
        .dealer-quick-steps b {
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
        .dealer-device {
          position: relative;
          min-height: 560px;
          border-radius: 36px;
          border: 1px solid rgba(232,232,237,.92);
          background:
            radial-gradient(circle at 26% 14%, rgba(255,255,255,.96), transparent 32%),
            radial-gradient(circle at 82% 22%, rgba(0,113,227,.14), transparent 30%),
            rgba(255,255,255,.72);
          backdrop-filter: blur(20px);
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .dealer-glow {
          position: absolute;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          filter: blur(24px);
          opacity: .42;
          pointer-events: none;
        }
        .dealer-glow.glow-one {
          left: -80px;
          top: 40px;
          background: rgba(0,113,227,.26);
          animation: dealer-float 8s ease-in-out infinite;
        }
        .dealer-glow.glow-two {
          right: -100px;
          bottom: 20px;
          background: rgba(221,220,140,.46);
          animation: dealer-float 9s ease-in-out -2.6s infinite;
        }
        .dealer-portal-card {
          position: relative;
          z-index: 2;
          width: min(430px, 82%);
          display: grid;
          gap: 16px;
          border-radius: 34px;
          border: 1px solid rgba(232,232,237,.92);
          background: rgba(255,255,255,.82);
          backdrop-filter: blur(20px);
          padding: 20px;
          animation: dealer-rise .344s ease both;
        }
        .dealer-portal-head {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          align-items: center;
          gap: 13px;
        }
        .dealer-portal-head > span {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
        }
        .dealer-portal-head strong {
          display: block;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 30px;
          line-height: 1.05;
          letter-spacing: -0.038em;
        }
        .dealer-portal-head small {
          display: block;
          margin-top: 5px;
          color: var(--color-graphite, #707070);
          font-size: 13px;
          letter-spacing: -0.003em;
        }
        .dealer-portal-screen {
          display: grid;
          gap: 9px;
          border-radius: 26px;
          background:
            radial-gradient(circle at 100% 0%, rgba(0,113,227,.08), transparent 30%),
            var(--color-fog, #f5f5f7);
          padding: 12px;
        }
        .dealer-portal-row {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 18px;
          background: rgba(255,255,255,.72);
          padding: 10px 12px;
          color: var(--color-ink, #1d1d1f);
        }
        .dealer-portal-row.active {
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(0,113,227,.2) !important;
        }
        .dealer-portal-row span {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 600;
        }
        .dealer-portal-row svg {
          width: 17px;
          height: 17px;
        }
        .dealer-portal-row b {
          border-radius: 999px;
          background: rgba(210,210,215,.64);
          color: var(--color-graphite, #707070);
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .dealer-portal-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .dealer-portal-stats span {
          display: grid;
          gap: 3px;
          border-radius: 22px;
          background: rgba(245,245,247,.78);
          padding: 14px;
          color: var(--color-graphite, #707070);
          font-size: 13px;
        }
        .dealer-portal-stats b {
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 24px;
          letter-spacing: -0.04em;
        }
        .dealer-orbit-card span,
        .dealer-step-grid p,
        .dealer-value-grid p,
        .dealer-final p {
          color: var(--color-graphite, #707070);
        }
        .dealer-orbit-card {
          position: absolute;
          min-width: 150px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(18px);
          padding: 12px 16px;
          z-index: 3;
          animation: dealer-float 7s ease-in-out infinite;
        }
        .dealer-orbit-card.card-one { left: 8%; top: 18%; }
        .dealer-orbit-card.card-two {
          right: 8%;
          bottom: 18%;
          animation-delay: -3s;
        }
        .dealer-process,
        .dealer-value {
          padding: 56px 0;
        }
        .dealer-section-head {
          max-width: 760px;
          margin-bottom: 28px;
        }
        .dealer-section-head h2,
        .dealer-final h2 {
          font-size: clamp(40px, 5.2vw, 72px);
        }
        .dealer-step-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .dealer-step-grid article,
        .dealer-value-grid article,
        .dealer-final {
          border-radius: 28px;
          border: 1px solid rgba(232,232,237,.92);
          background:
            radial-gradient(circle at 100% 0%, rgba(255,255,255,.96), transparent 30%),
            rgba(255,255,255,.84);
          padding: 28px;
          transition: transform .16s ease, border-color .16s ease, background-color .16s ease;
        }
        .dealer-step-grid article:hover,
        .dealer-value-grid article:hover {
          transform: translateY(-2px);
          border-color: rgba(29,29,31,.16);
        }
        .dealer-step-grid article span {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-graphite, #707070);
          font-weight: 700;
        }
        .dealer-step-grid h3,
        .dealer-value-grid h3 {
          margin: 22px 0 8px;
          font-size: 24px;
          letter-spacing: -0.015em;
        }
        .dealer-value-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .dealer-value-grid article div {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: var(--color-fog, #f5f5f7);
        }
        .dealer-final {
          display: grid;
          justify-items: center;
          text-align: center;
          margin-top: 38px;
          margin-bottom: 72px;
          padding: 64px 24px;
        }
        .dealer-final p {
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
        }
        [data-reveal] {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity .72s ease, transform .72s ease;
          transition-delay: var(--reveal-delay, 0ms);
        }
        [data-reveal].is-in {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes dealer-float {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -12px, 0);
          }
        }
        @keyframes dealer-rise {
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
          .dealer-glow,
          .dealer-orbit-card,
          .dealer-portal-card,
          [data-reveal] {
            animation: none !important;
            transition: none !important;
          }
        }
        @media (max-width: 980px) {
          .dealer-hero {
            grid-template-columns: 1fr;
          }
          .dealer-step-grid,
          .dealer-value-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 620px) {
          .dealer-hero {
            padding-top: 56px;
          }
          .dealer-quick-steps {
            grid-template-columns: 1fr;
          }
          .dealer-step-grid,
          .dealer-value-grid {
            grid-template-columns: 1fr;
          }
          .dealer-device {
            min-height: 430px;
          }
          .dealer-portal-card {
            width: min(100% - 28px, 430px);
          }
          .dealer-orbit-card {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
