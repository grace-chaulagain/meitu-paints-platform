import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ProductOrderLink from "../components/ProductOrderLink.jsx";
import {
  markImageFailed,
  markImageLoaded,
  selectImageFailedMap,
  selectImageLoadedMap,
} from "../redux/imageCacheSlice.js";

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M19 12H6" />
    <path d="m11 6-6 6 6 6" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m5 12 4 4L19 6" />
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

const ACCENTS = {
  blue: { color: "#0071e3", rgb: "0,113,227" },
  indigo: { color: "#596680", rgb: "89,102,128" },
  citrus: { color: "#5e9c2a", rgb: "94,156,42" },
  blush: { color: "#f500b4", rgb: "245,0,180" },
  amber: { color: "#b64400", rgb: "182,68,0" },
  ink: { color: "#1d1d1f", rgb: "29,29,31" },
};

const getProductAccent = (product = {}, contextLabel = "") => {
  const source = `${product.category || ""} ${product.name || ""} ${contextLabel}`.toLowerCase();
  if (source.includes("granite") || source.includes("3d") || source.includes("stone")) {
    return ACCENTS.indigo;
  }
  if (source.includes("putting") || source.includes("eco") || source.includes("natural")) {
    return ACCENTS.citrus;
  }
  if (source.includes("specialty") || source.includes("enamel") || source.includes("gold")) {
    return ACCENTS.blush;
  }
  if (source.includes("primer") || source.includes("floor") || source.includes("road")) {
    return ACCENTS.amber;
  }
  if (source.includes("utility") || source.includes("tools")) {
    return ACCENTS.ink;
  }
  return ACCENTS.blue;
};

const resolveSizedImage = (src = "", selectedSize, hasSizes) => {
  if (!selectedSize || !hasSizes) return src;
  const match = src.match(/\.(webp|png|jpe?g)$/i);
  if (!match) return `${src} (${selectedSize}).webp`;
  return src.replace(match[0], ` (${selectedSize})${match[0]}`);
};

const imagePreloadRegistry = new Map();

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

const preloadProductImage = (src, dispatch) => {
  if (!src || typeof window === "undefined") return null;
  if (imagePreloadRegistry.has(src)) return imagePreloadRegistry.get(src);

  const request = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      dispatch(markImageLoaded(src));
      resolve({ src, ok: true });
    };
    image.onerror = () => {
      dispatch(markImageFailed(src));
      resolve({ src, ok: false });
    };
    image.src = src;
  });

  imagePreloadRegistry.set(src, request);
  return request;
};

export default function ProductDetails({
  product,
  backLink = "/products",
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
  const dispatch = useDispatch();
  const loadedImages = useSelector(selectImageLoadedMap);
  const failedImages = useSelector(selectImageFailedMap);
  const defaultSelectedSize = product.sizes?.[0] || null;
  const [selectedSizeState, setSelectedSizeState] = useState(() => ({
    productId: product?.id,
    value: defaultSelectedSize,
  }));
  const [storyState, setStoryState] = useState(() => ({
    productId: product?.id,
    index: 0,
  }));
  const [activeEnamelColor, setActiveEnamelColor] = useState(null);
  const hasEnamelColors = product?.id === "oth-002";
  const selectedSize =
    selectedSizeState.productId === product?.id
      ? selectedSizeState.value
      : defaultSelectedSize;
  const storyIndex = storyState.productId === product?.id ? storyState.index : 0;

  const setSelectedSize = (size) => {
    setSelectedSizeState({ productId: product?.id, value: size });
  };

  const selectStoryIndex = (index) => {
    setStoryState({ productId: product?.id, index });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [product?.id]);

  useEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const body = document.body;
    const previousRootOverflowX = root?.style.overflowX || "";
    const previousHtmlOverflowX = html.style.overflowX || "";
    const previousBodyOverflowX = body.style.overflowX || "";

    if (root) root.style.overflowX = "visible";
    html.style.overflowX = "visible";
    body.style.overflowX = "visible";

    return () => {
      if (root) root.style.overflowX = previousRootOverflowX;
      html.style.overflowX = previousHtmlOverflowX;
      body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  const galleryItems = useMemo(() => {
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizes.length) {
      return [
        {
          label: "Product",
          size: null,
          src: product.src,
        },
      ];
    }
    return sizes.map((size) => ({
      label: size,
      size,
      src: resolveSizedImage(product.src, size, true),
    }));
  }, [product.src, product.sizes]);

  const activeGalleryItem = useMemo(
    () =>
      galleryItems.find((item) => item.size === selectedSize) ||
      galleryItems[0],
    [galleryItems, selectedSize]
  );

  const imageSrc = activeGalleryItem?.src || product.src;
  const imageSources = useMemo(
    () =>
      Array.from(
        new Set([product.src, ...galleryItems.map((item) => item.src)].filter(Boolean))
      ),
    [galleryItems, product.src]
  );
  const isImageReady = Boolean(
    loadedImages[imageSrc] ||
      (failedImages[imageSrc] &&
        (imageSrc === product.src || loadedImages[product.src]))
  );
  const detailAccent = useMemo(
    () => getProductAccent(product, contextLabel),
    [contextLabel, product]
  );
  const quickFacts = [
    {
      label: "System",
      value: contextLabel || "Meitu Paints",
    },
    {
      label: "Pack",
      value: selectedSize || product.size || "Standard",
    },
    {
      label: "Finish",
      value: product.category || "Professional coating",
    },
  ];
  const storySlides = useMemo(
    () => [
      {
        key: "finish",
        icon: SparkIcon,
        eyebrow: "Finish",
        title: "A composed surface system, not just a bucket.",
        body:
          benefits[0] ||
          heroCaption ||
          "Balanced visual depth with practical application behavior.",
      },
      {
        key: "assurance",
        icon: CheckIcon,
        eyebrow: "Assurance",
        title: "Size, confidence, and product clarity in one place.",
        body:
          features?.[0] ||
          "Clear product details, pack selection, and order path in one view.",
      },
      {
        key: "workflow",
        icon: ArrowIcon,
        eyebrow: "Workflow",
        title: "From discovery to dealer ordering without friction.",
        body:
          selectedSize
            ? `Review the ${selectedSize} pack, compare product details, then continue directly to ordering.`
            : "Review product details, compare system benefits, then continue directly to ordering.",
      },
    ],
    [benefits, features, heroCaption, selectedSize]
  );
  const activeStory = storySlides[storyIndex] || storySlides[0];

  useEffect(() => {
    imageSources.forEach((src) => preloadProductImage(src, dispatch));
  }, [dispatch, imageSources]);

  useEffect(() => {
    const productId = product?.id;
    const timer = window.setInterval(() => {
      setStoryState((previous) => {
        const current = previous.productId === productId ? previous.index : 0;
        return {
          productId,
          index: (current + 1) % storySlides.length,
        };
      });
    }, 5600);
    return () => window.clearInterval(timer);
  }, [product?.id, storySlides.length]);

  useEffect(() => {
    if (!activeEnamelColor) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setActiveEnamelColor(null);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeEnamelColor]);

  return (
    <>
      <main
        className="apple-detail-page"
        style={{
          "--detail-accent": detailAccent.color,
          "--detail-accent-rgb": detailAccent.rgb,
        }}
      >
        <section className="apple-detail-hero">
          <div className="apple-detail-ambient" aria-hidden="true" />
          <div className="apple-detail-shell">
            <Link to={backLink} className="apple-detail-back">
              <BackIcon />
              Back to collection
            </Link>

            <div className="apple-detail-grid">
              <div className="apple-detail-visual">
                <div className="apple-detail-media">
                  <div className="apple-detail-glow" aria-hidden="true" />
                  <div className="apple-detail-gridlines" aria-hidden="true" />
                  <div className="apple-detail-orbit orbit-a" aria-hidden="true" />
                  <div className="apple-detail-orbit orbit-b" aria-hidden="true" />
                  <div className="apple-detail-orbit orbit-c" aria-hidden="true" />
                  {!isImageReady ? (
                    <div className="apple-detail-loader" aria-hidden="true">
                      <span />
                    </div>
                  ) : null}
                  <img
                    src={imageSrc}
                    alt={`${product.name} ${selectedSize || ""}`}
                    className={`apple-detail-image ${
                      isImageReady ? "is-ready" : "is-pending"
                    }`}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    onLoad={(event) => {
                      const isFallback =
                        event.currentTarget.dataset.fallbackFor === imageSrc;
                      dispatch(
                        markImageLoaded(isFallback ? product.src : imageSrc)
                      );
                    }}
                    onError={(event) => {
                      dispatch(markImageFailed(imageSrc));
                      if (
                        event.currentTarget.dataset.fallbackFor !== imageSrc &&
                        product.src &&
                        imageSrc !== product.src
                      ) {
                        event.currentTarget.dataset.fallbackFor = imageSrc;
                        event.currentTarget.src = product.src;
                        preloadProductImage(product.src, dispatch);
                      }
                    }}
                  />
                </div>

                {galleryItems.length > 1 ? (
                  <div className="apple-detail-carousel" aria-label="Pack size image carousel">
                    {galleryItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={item.size === selectedSize ? "active" : ""}
                        onClick={() => setSelectedSize(item.size)}
                        aria-pressed={item.size === selectedSize}
                      >
                        <img
                          src={item.src}
                          alt=""
                          loading="eager"
                          decoding="async"
                          onError={(event) => {
                            dispatch(markImageFailed(item.src));
                            if (
                              event.currentTarget.dataset.fallbackFor !== item.src &&
                              product.src &&
                              item.src !== product.src
                            ) {
                              event.currentTarget.dataset.fallbackFor = item.src;
                              event.currentTarget.src = product.src;
                            }
                          }}
                        />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <p>{heroCaption}</p>
              </div>

              <div className="apple-detail-copy">
                <div className="apple-detail-order-panel">
                  <div>
                    <span className="apple-detail-kicker">{contextLabel}</span>
                    <h1>{product.name}</h1>
                    {selectedSize ? (
                      <p className="apple-detail-selected">
                        Selected pack size <strong>{selectedSize}</strong>
                      </p>
                    ) : null}

                    {product.sizes ? (
                      <div className="apple-size-selector" aria-label="Available sizes">
                        <span>Available sizes</span>
                        <div>
                          {product.sizes.map((size) => (
                            <button
                              key={size}
                              type="button"
                              className={selectedSize === size ? "active" : ""}
                              onClick={() => setSelectedSize(size)}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {warranty || nscertified ? (
                      <div className="apple-trust-row" aria-label="Product assurance information">
                        {warranty ? (
                          <div>
                            <SparkIcon />
                            <span>Warranty</span>
                            <strong>{warranty}</strong>
                          </div>
                        ) : null}
                        {nscertified ? (
                          <div>
                            <CheckIcon />
                            <span>Certification</span>
                            <strong>NS Certified</strong>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="apple-detail-order-footer">
                    <div className="apple-detail-actions">
                      <ProductOrderLink
                        product={product}
                        productName={product.name}
                        className="apple-detail-primary"
                      />
                      <Link to={backLink} className="apple-detail-secondary">
                        Collection <ArrowIcon />
                      </Link>
                    </div>

                    <div className="apple-detail-facts" aria-label="Product quick facts">
                      {quickFacts.map((fact) => (
                        <div key={fact.label}>
                          <span>{fact.label}</span>
                          <strong>{fact.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <article className="apple-detail-description-panel">
                  <span>Description</span>
                  <h2>Product description</h2>
                  <p>{leadText}</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {hasEnamelColors ? (
          <section className="apple-enamel-colors" aria-label="Enamel color catalog">
            <div className="apple-enamel-shell">
              <div className="apple-enamel-head">
                <div>
                  <span>Enamel color catalog</span>
                  <h2>Gloss colors for metal, wood, and masonry.</h2>
                </div>
                <p>
                  Select a shade to preview the color and send an inquiry with
                  the color name.
                </p>
              </div>

              <div className="apple-enamel-grid">
                {ENAMEL_COLORS.map((color, index) => (
                  <button
                    key={color.name}
                    type="button"
                    className="apple-enamel-card"
                    style={{ "--color": color.rgb, "--delay": `${index * 22}ms` }}
                    onClick={() => setActiveEnamelColor(color)}
                    aria-label={`Preview enamel color ${color.name}`}
                  >
                    <span className="apple-enamel-swatch" />
                    <strong>{color.name}</strong>
                    <small>Enamel shade</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="apple-detail-showcase" aria-label="Product experience">
          <div className="apple-showcase-copy">
            <span>{activeStory.eyebrow}</span>
            <h2>{activeStory.title}</h2>
            <p>{activeStory.body}</p>
            <div className="apple-story-dots" aria-label="Product story carousel">
              {storySlides.map((slide, index) => (
                <button
                  key={slide.key}
                  type="button"
                  className={index === storyIndex ? "active" : ""}
                  aria-label={`Show ${slide.eyebrow}`}
                  aria-pressed={index === storyIndex}
                  onClick={() => selectStoryIndex(index)}
                />
              ))}
            </div>
          </div>
          <div className="apple-showcase-strip">
            {storySlides.map((slide, index) => {
              const Icon = slide.icon;
              return (
                <button
                  key={slide.key}
                  type="button"
                  className={index === storyIndex ? "active" : ""}
                  onClick={() => selectStoryIndex(index)}
                >
                  <Icon />
                  <strong>{slide.eyebrow}</strong>
                  <span>{slide.body}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="apple-detail-info">
          <div className="apple-detail-info-shell">
            <article className="apple-info-card apple-info-card-large">
              <span>Purpose</span>
              <h2>{whyTitle}</h2>
              <p>{whyText}</p>
            </article>

            {benefits.length > 0 ? (
              <article className="apple-info-card">
                <span>Benefits</span>
                <h2>Key benefits</h2>
                <ul>
                  {benefits.map((benefit) => (
                    <li key={benefit}>
                      <CheckIcon />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {features.length > 0 ? (
              <article className="apple-info-card">
                <span>Features</span>
                <h2>Technical features</h2>
                <ul>
                  {features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {detailNote ? (
              <article className="apple-info-card apple-info-note">
                <span>Note</span>
                <p>{detailNote}</p>
              </article>
            ) : null}
          </div>
        </section>
      </main>

      {hasEnamelColors && activeEnamelColor ? (
        <div className="apple-enamel-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="apple-enamel-modal-backdrop"
            aria-label="Close enamel color preview"
            onClick={() => setActiveEnamelColor(null)}
          />
          <article className="apple-enamel-modal-card">
            <button
              type="button"
              className="apple-enamel-modal-close"
              aria-label="Close"
              onClick={() => setActiveEnamelColor(null)}
            >
              ×
            </button>
            <div
              className="apple-enamel-modal-swatch"
              style={{ "--color": activeEnamelColor.rgb }}
            />
            <div className="apple-enamel-modal-copy">
              <span>Enamel color</span>
              <h2>{activeEnamelColor.name}</h2>
              <p>
                Durable glossy enamel shade for professional applications.
                Mention the color name when requesting surface guidance or
                dealer support.
              </p>
              <Link
                to={`/inquiry?subject=${encodeURIComponent(`Enamel color ${activeEnamelColor.name}`)}`}
                className="apple-detail-primary"
                onClick={() => setActiveEnamelColor(null)}
              >
                Inquire about this color
              </Link>
            </div>
          </article>
        </div>
      ) : null}

      <style>{`
        .apple-detail-page {
          min-height: 100vh;
          padding-top: 0;
          background: var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          overflow: visible;
        }

        .apple-detail-page svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.85;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex: 0 0 auto;
        }

        .apple-detail-hero {
          position: relative;
          padding: clamp(14px, 2.4vw, 28px) 24px clamp(54px, 8vw, 96px);
          background: var(--meitu-home-hero-gradient);
          overflow: visible;
        }

        .apple-detail-ambient {
          position: absolute;
          inset: -28% 0 auto;
          height: 58%;
          width: 100%;
          background:
            radial-gradient(circle at 22% 40%, rgba(var(--detail-accent-rgb), .18), transparent 36%),
            radial-gradient(circle at 76% 26%, rgba(0,113,227,.12), transparent 38%),
            radial-gradient(circle at 48% 82%, rgba(223,231,79,.18), transparent 42%);
          filter: blur(18px);
          opacity: .86;
          pointer-events: none;
          animation: appleDetailAura 8s ease-in-out infinite alternate;
        }

        .apple-detail-shell {
          position: relative;
          z-index: 1;
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
        }

        .apple-detail-back,
        .apple-detail-secondary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 15px;
          letter-spacing: -0.04px;
        }

        .apple-detail-back {
          min-height: 34px;
          padding: 0;
          background: transparent;
        }

        .apple-detail-grid {
          --detail-sticky-top: 56px;
          --detail-media-height: min(clamp(410px, 46vw, 620px), calc(100svh - 188px));
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(360px, 0.96fr);
          gap: clamp(34px, 6vw, 78px);
          align-items: start;
          margin-top: 18px;
        }

        .apple-detail-visual {
          position: sticky;
          top: var(--detail-sticky-top);
          align-self: start;
          min-height: min-content;
          max-height: calc(100svh - var(--detail-sticky-top) - 18px);
          display: flex;
          flex-direction: column;
        }

        .apple-detail-media {
          position: relative;
          flex: 0 0 var(--detail-media-height);
          height: var(--detail-media-height);
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(28px, 5vw, 56px);
          box-sizing: border-box;
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.74), rgba(255,255,255,.42)),
            radial-gradient(circle at 50% 76%, rgba(29,29,31,.08), transparent 32%),
            radial-gradient(circle at 50% 34%, rgba(var(--detail-accent-rgb), .12), transparent 42%);
          backdrop-filter: blur(20px);
          overflow: hidden;
          isolation: isolate;
        }

        .apple-detail-glow {
          position: absolute;
          inset: 10% 8% -6%;
          background:
            radial-gradient(ellipse at 50% 52%, rgba(var(--detail-accent-rgb), .2), transparent 46%),
            radial-gradient(ellipse at 32% 68%, rgba(245,0,180,.08), transparent 42%),
            radial-gradient(ellipse at 72% 70%, rgba(223,231,79,.14), transparent 44%);
          filter: blur(22px);
          opacity: .82;
          z-index: -1;
        }

        .apple-detail-gridlines {
          position: absolute;
          inset: 8%;
          border-radius: 28px;
          background:
            linear-gradient(rgba(29,29,31,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,29,31,.045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,.42), transparent 68%);
          opacity: .56;
          pointer-events: none;
        }

        .apple-detail-orbit {
          position: absolute;
          border: 1px solid rgba(29,29,31,.08);
          border-radius: 999px;
          pointer-events: none;
        }

        .orbit-a {
          width: 72%;
          aspect-ratio: 1 / .42;
          transform: rotate(-8deg);
        }

        .orbit-b {
          width: 48%;
          aspect-ratio: 1 / .5;
          transform: rotate(12deg);
          opacity: .56;
        }

        .orbit-c {
          width: 34%;
          aspect-ratio: 1 / .56;
          transform: rotate(-22deg);
          opacity: .34;
          border-color: rgba(var(--detail-accent-rgb), .18);
        }

        .apple-detail-loader {
          position: absolute;
          z-index: 0;
          width: min(54%, 320px);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 34px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.78), rgba(255,255,255,.34)),
            radial-gradient(circle at 32% 26%, rgba(var(--detail-accent-rgb), .16), transparent 42%);
          overflow: hidden;
          opacity: .9;
        }

        .apple-detail-loader::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,.72) 42%, transparent 72%);
          transform: translateX(-120%);
          animation: appleDetailImageShimmer 1.25s ease infinite;
        }

        .apple-detail-loader span {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid rgba(29,29,31,.1);
          border-top-color: rgba(var(--detail-accent-rgb), .46);
          animation: appleDetailImageSpin .9s linear infinite;
        }

        .apple-detail-image {
          position: relative;
          z-index: 1;
          display: block;
          width: min(88%, 540px);
          height: 100%;
          max-height: 520px;
          object-fit: contain;
          filter: drop-shadow(0 18px 32px rgba(29,29,31,.13));
          opacity: 0;
          animation: appleProductFloat 5.6s ease-in-out infinite;
          transition: opacity .18s ease, filter .18s ease;
          will-change: transform;
        }

        .apple-detail-image.is-ready {
          opacity: 1;
        }

        .apple-detail-image.is-pending {
          opacity: 0;
        }

        @keyframes appleProductFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -10px, 0) scale(1.012); }
        }

        @keyframes appleDetailImageShimmer {
          to { transform: translateX(120%); }
        }

        @keyframes appleDetailImageSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes appleDetailAura {
          from { transform: translate3d(-1%, -1%, 0) scale(1); }
          to { transform: translate3d(1%, 1%, 0) scale(1.04); }
        }

        .apple-detail-carousel {
          flex: 0 0 auto;
          display: flex;
          gap: 10px;
          margin-top: 14px;
          padding: 8px;
          border-radius: 24px;
          background: rgba(210,210,215,.64);
          backdrop-filter: blur(20px);
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
        }

        .apple-detail-carousel::-webkit-scrollbar {
          display: none;
        }

        .apple-detail-carousel button {
          min-width: 86px;
          display: grid;
          justify-items: center;
          gap: 6px;
          padding: 8px 10px;
          border: 0;
          border-radius: 18px;
          background: transparent;
          color: rgba(0,0,0,.58);
          font: inherit;
          font-size: 12px;
          letter-spacing: -0.26px;
          cursor: pointer;
          transition: background-color .1s ease, color .1s ease, transform .1s ease;
          scroll-snap-align: start;
        }

        .apple-detail-carousel button.active {
          background: #fff;
          color: var(--color-ink, #1d1d1f);
          box-shadow: inset 0 0 0 1px rgba(var(--detail-accent-rgb), .18);
        }

        .apple-detail-carousel button:hover {
          transform: translateY(-1px);
        }

        .apple-detail-carousel img {
          width: 52px;
          height: 52px;
          object-fit: contain;
        }

        .apple-detail-visual p {
          margin: 16px 0 0;
          text-align: center;
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .apple-detail-copy {
          min-width: 0;
          display: grid;
          gap: clamp(84px, 12vh, 132px);
        }

        .apple-detail-order-panel {
          min-height: var(--detail-media-height);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-top: 0;
        }

        .apple-detail-order-footer {
          margin-top: auto;
          padding-top: clamp(22px, 4vw, 38px);
        }

        .apple-detail-kicker {
          display: inline-flex;
          margin-bottom: 12px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 21px;
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: 0.004em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-detail-copy h1 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(44px, 6.5vw, 76px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.022em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-detail-selected {
          margin: 18px 0 0;
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
          color: var(--color-graphite, #707070);
        }

        .apple-size-selector {
          margin-top: 22px;
        }

        .apple-size-selector > span {
          display: block;
          margin-bottom: 10px;
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .apple-size-selector > div {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .apple-size-selector button {
          min-height: 34px;
          padding: 0 14px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 999px;
          background: #fff;
          color: var(--color-graphite, #707070);
          font-size: 14px;
          letter-spacing: -0.04px;
          cursor: pointer;
        }

        .apple-size-selector button.active {
          border-color: rgba(var(--detail-accent-rgb), .44);
          color: var(--color-ink, #1d1d1f);
          box-shadow: inset 0 0 0 1px rgba(var(--detail-accent-rgb), .44);
        }

        .apple-trust-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .apple-trust-row div {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          padding: 8px 12px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 999px;
          background: #fff;
        }

        .apple-trust-row span {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          letter-spacing: -0.26px;
        }

        .apple-trust-row strong {
          color: var(--color-ink, #1d1d1f);
          font-size: 13px;
          letter-spacing: -0.04px;
        }

        .apple-detail-lead {
          max-width: 560px;
          margin: 26px 0 0;
          font-size: 20px;
          line-height: 1.4;
          font-weight: 300;
          letter-spacing: -0.2px;
          color: var(--color-graphite, #707070);
        }

        .apple-detail-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 0;
        }

        .apple-detail-primary {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--apple-control-blue, #0071e3);
          color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          text-decoration: none;
          font-size: 17px;
          font-weight: 400;
          line-height: 1.24;
          letter-spacing: -0.1px;
          transition: background-color .1s ease, transform .1s ease;
        }
        .apple-detail-primary:hover {
          background: var(--apple-control-blue-hover, #0077ed);
          color: #fff;
          transform: translateY(-1px);
        }

        .apple-detail-secondary {
          min-height: 40px;
          position: relative;
        }

        .apple-detail-secondary::after {
          content: "";
          position: absolute;
          left: 0;
          right: 20px;
          bottom: 7px;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform .344s ease;
        }

        .apple-detail-secondary:hover::after {
          transform: scaleX(1);
        }

        .apple-detail-facts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          margin-top: 16px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 28px;
          background: var(--color-silver-mist, #e8e8ed);
        }

        .apple-detail-facts div {
          min-width: 0;
          padding: 15px 16px;
          background: rgba(255,255,255,.74);
          backdrop-filter: blur(20px);
        }

        .apple-detail-facts span,
        .apple-detail-facts strong {
          display: block;
        }

        .apple-detail-facts span {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
        }

        .apple-detail-facts strong {
          margin-top: 4px;
          color: var(--color-ink, #1d1d1f);
          font-size: 13px;
          line-height: 1.25;
          letter-spacing: -0.04px;
        }

        .apple-detail-description-panel {
          min-height: max(440px, min(62vh, 620px));
          display: grid;
          align-content: center;
          padding: clamp(26px, 5vw, 44px);
          border-radius: 28px;
          background:
            radial-gradient(circle at 12% 18%, rgba(var(--detail-accent-rgb), .1), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.72));
          border: 1px solid rgba(255,255,255,.72);
          backdrop-filter: blur(18px);
        }

        .apple-detail-description-panel span {
          display: block;
          margin-bottom: 10px;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .apple-detail-description-panel h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.018em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-detail-description-panel p {
          max-width: 620px;
          margin: 16px 0 0;
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.42;
          font-weight: 300;
          letter-spacing: -0.2px;
          color: var(--color-graphite, #707070);
        }

        .apple-detail-showcase {
          width: min(1200px, calc(100% - 40px));
          display: grid;
          grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr);
          gap: 28px;
          align-items: stretch;
          margin: 0 auto 28px;
        }

        .apple-showcase-copy,
        .apple-showcase-strip {
          border-radius: 28px;
          background: #fff;
        }

        .apple-showcase-copy {
          display: grid;
          align-content: end;
          min-height: 260px;
          padding: 28px;
          background:
            radial-gradient(circle at 18% 18%, rgba(var(--detail-accent-rgb), .12), transparent 30%),
            radial-gradient(circle at 82% 78%, rgba(0,113,227,.10), transparent 35%),
            #fff;
        }

        .apple-showcase-copy span,
        .apple-showcase-strip button span {
          color: var(--color-graphite, #707070);
          font-size: 13px;
          line-height: 1.42;
          letter-spacing: -0.04px;
        }

        .apple-showcase-copy > span {
          margin-bottom: 10px;
          font-weight: 600;
        }

        .apple-showcase-copy h2 {
          max-width: 540px;
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(32px, 4.5vw, 56px);
          line-height: 1.07;
          font-weight: 700;
          letter-spacing: -0.018em;
        }

        .apple-showcase-copy p {
          max-width: 560px;
          margin: 14px 0 0;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
        }

        .apple-story-dots {
          display: inline-flex;
          width: max-content;
          gap: 7px;
          margin-top: 22px;
          padding: 7px;
          border-radius: 999px;
          background: rgba(210,210,215,.64);
          backdrop-filter: blur(20px);
        }

        .apple-story-dots button {
          width: 8px;
          height: 8px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(29,29,31,.25);
          cursor: pointer;
          transition: width .344s ease, background-color .1s ease;
        }

        .apple-story-dots button.active {
          width: 24px;
          background: var(--detail-accent);
        }

        .apple-showcase-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          background: var(--color-silver-mist, #e8e8ed);
        }

        .apple-showcase-strip button {
          display: grid;
          align-content: start;
          text-align: left;
          gap: 10px;
          padding: 24px;
          border: 0;
          background: #fff;
          color: inherit;
          font: inherit;
          cursor: pointer;
          transition: background-color .1s ease, transform .344s ease;
        }

        .apple-showcase-strip button.active {
          background:
            radial-gradient(circle at 18% 18%, rgba(var(--detail-accent-rgb), .1), transparent 34%),
            #fff;
        }

        .apple-showcase-strip button:hover {
          transform: translateY(-2px);
        }

        .apple-showcase-strip button svg {
          width: 24px;
          height: 24px;
          color: var(--detail-accent);
        }

        .apple-showcase-strip button strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: -0.2px;
        }

        .apple-detail-info {
          padding: 0 24px 96px;
        }

        .apple-detail-info-shell {
          max-width: var(--page-max-width, 1200px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
        }

        .apple-info-card {
          min-height: 260px;
          padding: 28px;
          border-radius: 28px;
          background: #fff;
          transition: transform .344s ease, background-color .1s ease;
          position: relative;
          overflow: hidden;
        }

        .apple-info-card::before {
          content: "";
          position: absolute;
          inset: auto -28% -46%;
          height: 58%;
          background:
            radial-gradient(ellipse at 50% 8%, rgba(255,255,255,.8), transparent 45%),
            radial-gradient(ellipse at 50% 74%, rgba(var(--detail-accent-rgb), .1), transparent 52%);
          filter: blur(16px);
          opacity: 0;
          transition: opacity .344s ease, transform .344s ease;
          transform: translateY(16px);
          pointer-events: none;
        }

        .apple-info-card:hover {
          transform: translateY(-2px);
        }

        .apple-info-card:hover::before {
          opacity: 1;
          transform: translateY(0);
        }

        .apple-info-card-large {
          grid-column: span 2;
          min-height: 220px;
        }

        .apple-info-card span {
          display: block;
          margin-bottom: 10px;
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .apple-info-card h2 {
          margin: 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.17;
          font-weight: 700;
          letter-spacing: -0.016em;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-info-card p {
          max-width: 760px;
          margin: 16px 0 0;
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
          color: var(--color-graphite, #707070);
        }

        .apple-info-card ul {
          display: grid;
          gap: 12px;
          margin: 18px 0 0;
          padding: 0;
          list-style: none;
        }

        .apple-info-card li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: var(--color-graphite, #707070);
          font-size: 16px;
          line-height: 1.42;
          letter-spacing: -0.1px;
        }

        .apple-info-card li svg {
          margin-top: 2px;
          color: var(--color-ink, #1d1d1f);
        }

        .apple-info-note {
          min-height: auto;
          grid-column: span 2;
          background: var(--color-ink, #1d1d1f);
        }

        .apple-info-note span,
        .apple-info-note p {
          color: rgba(255, 255, 255, 0.72);
        }

        .apple-enamel-colors {
          width: min(1200px, calc(100% - 40px));
          margin: 0 auto 28px;
        }

        .apple-enamel-shell {
          padding: clamp(24px, 4vw, 34px);
          border-radius: 28px;
          background:
            radial-gradient(circle at 12% 12%, rgba(var(--detail-accent-rgb), .1), transparent 28%),
            #fff;
        }

        .apple-enamel-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 24px;
          margin-bottom: 22px;
        }

        .apple-enamel-head span {
          display: block;
          margin-bottom: 10px;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .apple-enamel-head h2 {
          max-width: 620px;
          margin: 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.018em;
        }

        .apple-enamel-head p {
          max-width: 360px;
          margin: 0;
          color: var(--color-graphite, #707070);
          font-size: 15px;
          line-height: 1.45;
          letter-spacing: -0.04px;
        }

        .apple-enamel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
          gap: 12px;
        }

        .apple-enamel-card {
          min-height: 150px;
          border: 0;
          border-radius: 24px;
          background: rgba(245,245,247,.92);
          padding: 12px;
          display: grid;
          align-content: space-between;
          text-align: left;
          cursor: pointer;
          font: inherit;
          opacity: 0;
          transform: translateY(10px);
          animation: appleEnamelCardIn .42s ease forwards;
          animation-delay: var(--delay);
          transition: background-color .18s ease, transform .18s ease;
        }

        .apple-enamel-card:hover {
          background: #fff;
          transform: translateY(-2px);
        }

        .apple-enamel-swatch {
          width: 100%;
          aspect-ratio: 1.35;
          border-radius: 18px;
          background: var(--color);
          border: 1px solid rgba(29,29,31,.08);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.28);
        }

        .apple-enamel-card strong {
          margin-top: 12px;
          color: var(--color-ink, #1d1d1f);
          font-size: 15px;
          line-height: 1.2;
          font-weight: 600;
        }

        .apple-enamel-card small {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.3;
        }

        .apple-enamel-modal {
          position: fixed;
          inset: 0;
          z-index: 10020;
          display: grid;
          place-items: center;
          padding: 24px;
        }

        .apple-enamel-modal-backdrop {
          position: fixed;
          inset: 0;
          border: 0;
          background: rgba(245,245,247,.74);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
        }

        .apple-enamel-modal-card {
          position: relative;
          width: min(860px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, .86fr);
          border-radius: 28px;
          overflow: hidden;
          background: #fff;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          animation: appleEnamelModalIn .28s ease both;
        }

        .apple-enamel-modal-swatch {
          min-height: 430px;
          background:
            radial-gradient(circle at 50% 18%, rgba(255,255,255,.45), transparent 24%),
            var(--color);
        }

        .apple-enamel-modal-copy {
          align-self: center;
          padding: clamp(28px, 5vw, 54px);
        }

        .apple-enamel-modal-copy span {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          letter-spacing: -0.26px;
        }

        .apple-enamel-modal-copy h2 {
          margin: 10px 0 0;
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(42px, 6vw, 72px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.022em;
        }

        .apple-enamel-modal-copy p {
          margin: 18px 0 0;
          color: var(--color-graphite, #707070);
          font-size: 17px;
          line-height: 1.47;
        }

        .apple-enamel-modal-copy .apple-detail-primary {
          margin-top: 26px;
        }

        .apple-enamel-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: rgba(232,232,237,.82);
          color: #1d1d1f;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        @keyframes appleEnamelCardIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes appleEnamelModalIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 920px) {
          .apple-detail-grid,
          .apple-detail-info-shell,
          .apple-detail-showcase,
          .apple-enamel-modal-card {
            grid-template-columns: 1fr;
          }

          .apple-detail-visual {
            position: relative;
            top: auto;
            max-height: none;
          }

          .apple-detail-order-panel {
            min-height: auto;
          }

          .apple-detail-copy {
            gap: 32px;
          }

          .apple-info-card-large,
          .apple-info-note {
            grid-column: auto;
          }

          .apple-showcase-strip {
            grid-template-columns: 1fr;
          }

          .apple-enamel-head {
            display: grid;
          }
        }

        @media (max-width: 640px) {
          .apple-detail-hero {
            padding-top: 16px;
          }

          .apple-detail-media {
            flex-basis: 330px;
            height: 330px;
            min-height: 0;
            padding: 24px;
          }

          .apple-detail-actions,
          .apple-detail-primary,
          .apple-detail-secondary {
            width: 100%;
          }

          .apple-detail-facts {
            grid-template-columns: 1fr;
          }

          .apple-enamel-colors {
            width: calc(100% - 28px);
          }

          .apple-enamel-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .apple-enamel-modal {
            padding: 12px;
          }

          .apple-enamel-modal-card {
            border-radius: 24px;
          }

          .apple-enamel-modal-swatch {
            min-height: 300px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .apple-detail-image,
          .apple-detail-ambient,
          .apple-enamel-card,
          .apple-enamel-modal-card {
            animation: none;
          }
          .apple-info-card,
          .apple-detail-carousel button {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
