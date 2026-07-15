import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const cards = [
  {
    category: "Texture systems",
    title: "Granite depth, made calm.",
    src: "/HomePage2.webp",
    href: "/textures",
    summary:
      "Explore texture-led finishes for exterior walls, feature surfaces, and architectural statements.",
    points: ["3D granite character", "Stone-inspired movement", "Finish codes for precise selection"],
  },
  {
    category: "Wall finishes",
    title: "Clean walls with a gallery finish.",
    src: "/HomePage1.webp",
    href: "/regular",
    summary:
      "Interior and exterior systems designed around smooth coverage, refined sheen, and long-term durability.",
    points: ["Interior and exterior ranges", "Primer-to-topcoat workflow", "Professional dealer ordering"],
  },
  {
    category: "Color library",
    title: "A thousand shades, quietly organized.",
    src: "/HomePage3.webp",
    href: "/colors",
    summary:
      "Browse Meitu shades with room previews and tonal filters that keep selection fast and practical.",
    points: ["Room preview support", "Warm-to-cool tone library", "Dealer-ready shade references"],
  },
  {
    category: "Room preview",
    title: "See the color before the wall changes.",
    src: "/bedroom.webp",
    href: "/colors",
    summary:
      "Preview selected colors in familiar spaces so choices feel grounded before a dealer places an order.",
    points: ["Bedroom preview", "Instant tone comparison", "Clear shade identity"],
  },
  {
    category: "Product families",
    title: "Every coating system in one place.",
    src: "/Granite Textures/201.webp",
    href: "/products",
    summary:
      "Move from buckets to textures, colors, primers, putting, specialty products, and utilities with less friction.",
    points: ["Catalog-first navigation", "Consistent family structure", "Built for dealer workflows"],
  },
];

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M15 6 9 12l6 6" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </svg>
);

function getVisibleCount() {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 720) return 1;
  if (window.innerWidth < 1080) return 2;
  return 3;
}

function useVisibleCardCount() {
  const [visibleCount, setVisibleCount] = useState(getVisibleCount);

  useEffect(() => {
    const onResize = () => setVisibleCount(getVisibleCount());
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return visibleCount;
}

function useOutsideClick(ref, callback, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [callback, enabled, ref]);
}

export default function AppleCardsCarousel() {
  const visibleCount = useVisibleCardCount();
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = Math.max(0, cards.length - visibleCount);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, maxIndex));
  }, [maxIndex]);

  const visibleCards = useMemo(
    () => cards.slice(activeIndex, activeIndex + visibleCount),
    [activeIndex, visibleCount],
  );

  const goPrevious = () => setActiveIndex((index) => Math.max(0, index - 1));
  const goNext = () => setActiveIndex((index) => Math.min(maxIndex, index + 1));

  return (
    <section className="apple-cards-showcase" aria-label="Meitu finish gallery">
      <div className="apple-cards-header">
        <p>Meitu finish gallery</p>
        <h2>Get to know the surfaces.</h2>
      </div>

      <div className="apple-card-carousel-shell">
        <div
          className="apple-card-grid"
          style={{ "--visible-card-count": visibleCount }}
        >
          <AnimatePresence mode="popLayout">
            {visibleCards.map((card, index) => (
              <motion.div
                key={card.title}
                className="apple-card-frame"
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  duration: 0.32,
                  delay: index * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <AppleCard card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="apple-card-toolbar">
          <div className="apple-card-dots" aria-hidden="true">
            {Array.from({ length: maxIndex + 1 }).map((_, index) => (
              <button
                key={`surface-dot-${index}`}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show finish set ${index + 1}`}
              />
            ))}
          </div>

          <div className="apple-card-controls">
            <button
              type="button"
              onClick={goPrevious}
              disabled={activeIndex === 0}
              aria-label="Previous finish cards"
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={activeIndex === maxIndex}
              aria-label="Next finish cards"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </div>

      <AppleCardsStyles />
    </section>
  );
}

function AppleCard({ card }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const previousOverflowRef = useRef("");

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose, open]);

  useOutsideClick(containerRef, handleClose, open);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="apple-card-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="apple-card-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.article
              ref={containerRef}
              className="apple-card-detail"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                className="apple-card-close"
                onClick={handleClose}
                aria-label="Close finish detail"
              >
                <CloseIcon />
              </button>

              <div className="apple-card-detail-media">
                <BlurImage src={card.src} alt={card.title} />
              </div>

              <div className="apple-card-detail-copy">
                <p>{card.category}</p>
                <h3>{card.title}</h3>
                <span>{card.summary}</span>
                <ul>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link to={card.href} onClick={handleClose}>
                  Explore this area
                  <ArrowRightIcon />
                </Link>
              </div>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className="apple-card"
        onClick={() => setOpen(true)}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.985 }}
      >
        <BlurImage src={card.src} alt={card.title} />
        <span className="apple-card-shade" />
        <span className="apple-card-copy">
          <small>{card.category}</small>
          <strong>{card.title}</strong>
        </span>
      </motion.button>
    </>
  );
}

const BlurImage = memo(function BlurImage({ src, alt }) {
  const [isLoading, setLoading] = useState(true);

  return (
    <img
      className={isLoading ? "is-loading" : "is-loaded"}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoading(false)}
    />
  );
});

function AppleCardsStyles() {
  return (
    <style>{`
      .apple-cards-showcase {
        width: 100%;
        padding: clamp(46px, 7vw, 82px) 0 clamp(44px, 6vw, 74px);
        background: var(--color-fog, #f5f5f7);
        color: var(--color-ink, #1d1d1f);
        overflow: hidden;
      }

      .apple-cards-header,
      .apple-card-carousel-shell {
        width: min(1200px, calc(100% - 40px));
        margin: 0 auto;
      }

      .apple-cards-header p {
        margin: 0 0 8px;
        color: var(--color-graphite, #707070);
        font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
        font-size: 17px;
        line-height: 1.35;
        letter-spacing: -0.1px;
      }

      .apple-cards-header h2 {
        max-width: 760px;
        margin: 0;
        color: var(--color-ink, #1d1d1f);
        font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
        font-size: clamp(44px, 6.4vw, 80px);
        line-height: 1.04;
        font-weight: 700;
        letter-spacing: -0.022em;
      }

      .apple-card-carousel-shell {
        margin-top: clamp(26px, 4vw, 44px);
      }

      .apple-card-grid {
        display: grid;
        grid-template-columns: repeat(var(--visible-card-count), minmax(0, 1fr));
        gap: clamp(14px, 2vw, 20px);
        align-items: stretch;
      }

      .apple-card-frame {
        min-width: 0;
      }

      .apple-card {
        position: relative;
        width: 100%;
        height: clamp(420px, 50vw, 610px);
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        overflow: hidden;
        border: 0;
        border-radius: 28px;
        background: #fff;
        color: #fff;
        cursor: pointer;
        text-align: left;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
      }

      .apple-card img,
      .apple-card-detail-media img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        transition: filter .3s ease, opacity .3s ease, transform .6s ease;
      }

      .apple-card:hover img {
        transform: scale(1.035);
      }

      .apple-card img.is-loading,
      .apple-card-detail-media img.is-loading {
        filter: blur(14px);
        opacity: .62;
      }

      .apple-card img.is-loaded,
      .apple-card-detail-media img.is-loaded {
        filter: blur(0);
        opacity: 1;
      }

      .apple-card-shade {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(0,0,0,.56) 0%, rgba(0,0,0,.12) 42%, rgba(0,0,0,.28) 100%),
          radial-gradient(circle at 24% 18%, rgba(255,255,255,.18), transparent 28%);
        pointer-events: none;
      }

      .apple-card-copy {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 2;
        display: grid;
        gap: 10px;
        padding: clamp(22px, 3vw, 30px);
      }

      .apple-card-copy small {
        color: rgba(255,255,255,.82);
        font-size: 15px;
        line-height: 1.3;
        font-weight: 500;
        letter-spacing: -0.003em;
      }

      .apple-card-copy strong {
        max-width: 310px;
        color: #fff;
        font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
        font-size: clamp(28px, 3.2vw, 38px);
        line-height: 1.08;
        font-weight: 700;
        letter-spacing: -0.018em;
        text-wrap: balance;
      }

      .apple-card-toolbar {
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        margin-top: 22px;
      }

      .apple-card-dots {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .apple-card-dots button {
        width: 8px;
        height: 8px;
        border: 0;
        border-radius: 999px;
        background: rgba(210,210,215,.9);
        cursor: pointer;
        padding: 0;
        transition: width .2s ease, background-color .2s ease;
      }

      .apple-card-dots button.active {
        width: 22px;
        background: var(--color-ink, #1d1d1f);
      }

      .apple-card-controls {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .apple-card-controls button,
      .apple-card-close {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        background: rgba(210,210,215,.64);
        color: rgba(0,0,0,.62);
        backdrop-filter: blur(20px);
        cursor: pointer;
        transition: opacity .2s ease, transform .2s ease, background-color .2s ease;
      }

      .apple-card-controls button:hover,
      .apple-card-close:hover {
        background: rgba(255,255,255,.86);
        transform: translateY(-1px);
      }

      .apple-card-controls button:disabled {
        opacity: .36;
        cursor: default;
        transform: none;
      }

      .apple-card-controls svg,
      .apple-card-close svg,
      .apple-card-detail-copy a svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .apple-card-overlay {
        position: fixed;
        inset: 0;
        z-index: 3000;
        overflow-y: auto;
        padding: clamp(18px, 4vw, 52px);
      }

      .apple-card-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.52);
        backdrop-filter: blur(24px);
      }

      .apple-card-detail {
        position: relative;
        z-index: 1;
        max-width: 1060px;
        min-height: min(760px, calc(100vh - 64px));
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
        overflow: hidden;
        border-radius: 28px;
        background: #fff;
        color: var(--color-ink, #1d1d1f);
      }

      .apple-card-close {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 3;
        background: rgba(255,255,255,.74);
        color: #000;
      }

      .apple-card-detail-media {
        min-height: 420px;
        background: var(--color-fog, #f5f5f7);
      }

      .apple-card-detail-copy {
        align-self: center;
        padding: clamp(30px, 5vw, 58px);
      }

      .apple-card-detail-copy p {
        margin: 0 0 12px;
        color: var(--color-graphite, #707070);
        font-size: 17px;
        line-height: 1.35;
        letter-spacing: -0.1px;
      }

      .apple-card-detail-copy h3 {
        margin: 0;
        font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
        font-size: clamp(38px, 5vw, 64px);
        line-height: 1.04;
        font-weight: 700;
        letter-spacing: -0.022em;
      }

      .apple-card-detail-copy > span {
        display: block;
        margin-top: 18px;
        color: var(--color-graphite, #707070);
        font-size: 18px;
        line-height: 1.48;
        letter-spacing: -0.1px;
      }

      .apple-card-detail-copy ul {
        display: grid;
        gap: 12px;
        margin: 28px 0 0;
        padding: 0;
        list-style: none;
      }

      .apple-card-detail-copy li {
        position: relative;
        padding-left: 22px;
        color: var(--color-slate, #474747);
        font-size: 15px;
        line-height: 1.45;
        letter-spacing: -0.04px;
      }

      .apple-card-detail-copy li::before {
        content: "";
        position: absolute;
        left: 0;
        top: .62em;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--color-azure, #0071e3);
      }

      .apple-card-detail-copy a {
        width: fit-content;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 32px;
        color: var(--color-cobalt-link, #0066cc);
        font-size: 17px;
        letter-spacing: -0.1px;
        text-decoration: none;
      }

      @media (max-width: 760px) {
        .apple-cards-showcase {
          padding-top: 42px;
        }

        .apple-card {
          height: 420px;
        }

        .apple-card-toolbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .apple-card-detail {
          min-height: auto;
          grid-template-columns: 1fr;
        }

        .apple-card-detail-media {
          min-height: 300px;
        }

        .apple-card-detail-copy {
          padding: 28px;
        }
      }
    `}</style>
  );
}
