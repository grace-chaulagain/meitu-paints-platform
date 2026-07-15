import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import {
  ArrowIcon,
  CalculatorIcon,
  MailIcon,
  PaletteIcon,
  PhoneIcon,
  ShieldIcon,
  StoreIcon,
  SupportIcon,
  TextureIcon,
} from "../components/ui/ApplePageIcons.jsx";

const SUPPORT_PHONE = "+97715199724";
const SUPPORT_EMAIL = "sujata.meitupaints@gmail.com";
const WHATSAPP_PHONE = "9779808299777";

export default function Support() {
  const pageRef = useRef(null);
  const [toast, setToast] = useState("");

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

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setToast("Email copied.");
      window.setTimeout(() => setToast(""), 2600);
    } catch {
      setToast(SUPPORT_EMAIL);
    }
  };

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-support-page">
        <section className="support-hero" data-reveal>
          <div className="support-hero-copy">
            <p>Meitu support</p>
            <h1>Fast answers for real paint decisions.</h1>
            <span>
              Get guidance on products, colors, texture systems, application,
              dealer support, and project estimates.
            </span>
            <div className="support-actions">
              <a href={`tel:${SUPPORT_PHONE}`} className="apple-pill primary">
                Call support <PhoneIcon />
              </a>
              <button type="button" className="apple-text-button" onClick={copyEmail}>
                Copy email <MailIcon />
              </button>
            </div>
          </div>

          <div className="support-hero-panel" aria-label="Support contact options">
            {[
              ["Call", SUPPORT_PHONE, `tel:${SUPPORT_PHONE}`, <PhoneIcon />],
              ["Email", SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`, <MailIcon />],
              ["WhatsApp", "Message support", `https://wa.me/${WHATSAPP_PHONE}`, <SupportIcon />],
            ].map(([label, value, href, icon]) => (
              <a key={label} href={href} className="support-contact-card">
                <span>{icon}</span>
                <strong>{label}</strong>
                <small>{value}</small>
              </a>
            ))}
          </div>
        </section>

        <section className="support-grid-section" data-reveal>
          <div className="support-section-head">
            <p>Choose a path</p>
            <h2>Everything important, without the clutter.</h2>
          </div>
          <div className="support-path-grid">
            {[
              ["Products", "Find the right coating system.", "/products", <StoreIcon />],
              ["Colors", "Browse shades and preview rooms.", "/colors", <PaletteIcon />],
              ["Textures", "Search granite texture codes.", "/textures", <TextureIcon />],
              ["Rate Calculator", "Estimate project cost quickly.", "/ratecalculator", <CalculatorIcon />],
            ].map(([title, copy, href, icon]) => (
              <Link key={title} to={href} className="support-path-card">
                <div>{icon}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span>
                  Open <ArrowIcon />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="support-feature-band" data-reveal>
          <div className="support-feature-copy">
            <p>Application guidance</p>
            <h2>Better finishes start before the first coat.</h2>
            <span>
              Meitu support focuses on surface prep, primer compatibility,
              coating sequence, drying discipline, and final color behavior.
            </span>
          </div>
          <div className="support-feature-list">
            {[
              ["Surface prep", "Clean, dry, stable surfaces reduce failure risk."],
              ["Primer selection", "Match primer to wall condition and topcoat."],
              ["Coat timing", "Respect drying intervals for better durability."],
              ["Lighting check", "Validate color under real room lighting."],
            ].map(([title, copy]) => (
              <div key={title}>
                <ShieldIcon />
                <strong>{title}</strong>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="support-faq-section" data-reveal>
          <div className="support-section-head">
            <p>Common questions</p>
            <h2>Clear answers for common site problems.</h2>
          </div>
          <div className="support-faq-grid">
            {[
              ["Which product should I use first?", "Start from the surface. Putty and primer prepare the wall; topcoat selection comes after surface condition is understood."],
              ["Why does color look different at home?", "Lighting, sheen, room size, and nearby surfaces shift perception. Always preview in the actual space if possible."],
              ["Can Meitu help with texture selection?", "Yes. Use the texture library code, then contact support or inquiry with the selected code."],
              ["How do I estimate cost?", "Use the rate calculator with area, product, and system. Final pricing can still change with site condition."],
            ].map(([question, answer]) => (
              <details key={question} className="support-faq">
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="support-final" data-reveal>
          <h2>Need project-specific help?</h2>
          <p>Send your wall photo, location, product goal, or texture code.</p>
          <div>
            <Link to="/inquiry" className="apple-pill primary">
              Start inquiry <ArrowIcon />
            </Link>
            <Link to="/dealership" className="apple-text-link">
              Dealership support <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      {toast ? <div className="support-toast">{toast}</div> : null}

      <style>{`
        .apple-support-page {
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          overflow: hidden;
        }
        .apple-support-page svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .support-hero {
          width: 100%;
          max-width: none;
          min-height: 82vh;
          margin: 0;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
          gap: clamp(28px, 5vw, 70px);
          align-items: center;
          padding: clamp(88px, 10vw, 132px) max(20px, calc((100% - 1200px) / 2)) 58px;
          background: var(--meitu-home-hero-gradient);
        }
        .support-hero-copy p,
        .support-section-head p,
        .support-feature-copy p {
          margin: 0 0 10px;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          letter-spacing: -0.1px;
        }
        .support-hero h1,
        .support-section-head h2,
        .support-feature-copy h2,
        .support-final h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(48px, 7.4vw, 92px);
          line-height: 1.03;
          font-weight: 700;
          letter-spacing: -0.024em;
        }
        .support-hero-copy > span,
        .support-feature-copy > span,
        .support-final p {
          display: block;
          max-width: 570px;
          margin-top: 20px;
          color: var(--color-graphite, #707070);
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.42;
        }
        .support-actions,
        .support-final > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 30px;
        }
        .apple-pill,
        .apple-text-link,
        .apple-text-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          text-decoration: none;
          font-size: 17px;
          line-height: 1.24;
          letter-spacing: -0.1px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
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
        .apple-text-link,
        .apple-text-button {
          color: var(--color-cobalt-link, #0066cc);
        }
        .apple-pill.primary:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          transform: translateY(-1px);
        }
        .apple-pill.primary:active {
          transform: scale(.985);
        }
        .support-hero-panel {
          display: grid;
          gap: 14px;
          padding: 18px;
          border-radius: 28px;
          background: rgba(255,255,255,.84);
          backdrop-filter: blur(20px);
        }
        .support-contact-card,
        .support-path-card,
        .support-feature-list div,
        .support-faq {
          background: #fff;
          border-radius: 28px;
          text-decoration: none;
          color: inherit;
        }
        .support-contact-card {
          display: grid;
          grid-template-columns: 46px 1fr;
          gap: 4px 14px;
          align-items: center;
          padding: 18px;
          background: var(--color-fog, #f5f5f7);
        }
        .support-contact-card span {
          grid-row: span 2;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          background: #fff;
          display: grid;
          place-items: center;
        }
        .support-contact-card small,
        .support-path-card p,
        .support-feature-list span,
        .support-faq p {
          color: var(--color-graphite, #707070);
        }
        .support-grid-section,
        .support-feature-band,
        .support-faq-section,
        .support-final {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto;
          padding: 56px 0;
        }
        .support-section-head {
          max-width: 780px;
          margin-bottom: 28px;
        }
        .support-section-head h2,
        .support-feature-copy h2,
        .support-final h2 {
          font-size: clamp(40px, 5vw, 70px);
        }
        .support-path-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .support-path-card {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .support-path-card div {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--color-fog, #f5f5f7);
          margin-bottom: 34px;
        }
        .support-path-card h3 {
          margin: 0 0 8px;
          font-size: 24px;
          letter-spacing: -0.015em;
        }
        .support-path-card span {
          margin-top: auto;
          color: var(--color-cobalt-link, #0066cc);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .support-feature-band {
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 28px;
          align-items: center;
        }
        .support-feature-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .support-feature-list div {
          display: grid;
          gap: 10px;
          padding: 24px;
          min-height: 190px;
        }
        .support-faq-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .support-faq {
          padding: 20px 22px;
        }
        .support-faq summary {
          cursor: pointer;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .support-faq p {
          margin: 12px 0 0;
          line-height: 1.55;
        }
        .support-final {
          display: grid;
          justify-items: center;
          text-align: center;
          border-radius: 28px;
          background: #fff;
          margin-bottom: 72px;
          padding: 64px 24px;
        }
        .support-final p {
          margin-left: auto;
          margin-right: auto;
        }
        .support-toast {
          position: fixed;
          left: 50%;
          bottom: 26px;
          z-index: 9000;
          transform: translateX(-50%);
          border-radius: 999px;
          background: rgba(29,29,31,.92);
          color: #fff;
          padding: 12px 18px;
          backdrop-filter: blur(18px);
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
        @media (max-width: 980px) {
          .support-hero,
          .support-feature-band {
            grid-template-columns: 1fr;
          }
          .support-path-grid,
          .support-faq-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .support-path-grid,
          .support-feature-list,
          .support-faq-grid {
            grid-template-columns: 1fr;
          }
          .support-hero {
            min-height: auto;
          }
        }
      `}</style>
    </>
  );
}
