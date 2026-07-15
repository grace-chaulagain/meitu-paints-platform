import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AutoSizer, Grid, WindowScroller } from "react-virtualized";
import "react-virtualized/styles.css";
import colorsRaw from "../ProductsList/meitu-colors.json";
import NavBar from "../components/NavBar";
import {
  selectColorsCacheInitialized,
  selectPreparedColors,
  setPreparedColors,
} from "../redux/colorsCacheSlice.js";

/**
 * EXPECTED JSON SHAPE (each item):
 * {
 *   id: "2001P",               // shade code
 *   name: "Sunny Lemon",
 *   rgb: "rgb(244,236,207)",
 *   category: "yellows",       // reds, oranges, yellows, greens, blues, violets, earth tones, classic neutrals, dark accents, whispering whites
 *   type: "Light"              // Dark, Light, Neutral
 * }
 */

const TYPE_ORDER = ["Neutral", "Light", "Dark"];
const TONE_RAIL = ["All", ...TYPE_ORDER];
const FALLBACK_SHADE = {
  id: "MEITU",
  name: "Meitu White",
  rgb: "rgb(245,245,247)",
  category: "classic neutrals",
  type: "Neutral",
  _text: "#1d1d1f",
};

function normalize(s = "") {
  return String(s).trim().toLowerCase();
}

function clamp255(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 180;
  return Math.max(0, Math.min(255, Math.round(x)));
}

function hexToRgb(hex) {
  const h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return [180, 180, 180];
    return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return [180, 180, 180];
    return [r, g, b];
  }
  return [180, 180, 180];
}

function parseRgbAny(input) {
  const s = String(input ?? "").trim();
  if (!s) return [180, 180, 180];

  // hex
  if (s.startsWith("#")) {
    return hexToRgb(s);
  }

  // rgb()/rgba()/hsl() etc -> extract first 3 numbers if present
  const m = s.match(/(-?\d+(?:\.\d+)?)/g);
  if (m && m.length >= 3) {
    return [clamp255(m[0]), clamp255(m[1]), clamp255(m[2])];
  }

  // raw triplet like "244,236,207" or "244 236 207"
  const t = s.match(/(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/);
  if (t) {
    return [clamp255(t[1]), clamp255(t[2]), clamp255(t[3])];
  }

  return [180, 180, 180];
}

function normalizeCssColor(v) {
  // Always return a safe, valid rgb(r,g,b) string so CSS never becomes invalid.
  const [r, g, b] = parseRgbAny(v);
  return `rgb(${r},${g},${b})`;
}

function parseRgb(rgbString) {
  // Backwards-compatible wrapper
  return parseRgbAny(rgbString);
}

function getContrastText(rgbString) {
  const [r, g, b] = parseRgb(rgbString);
  // Relative luminance-ish for text color decision
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.64 ? "#0b0b0c" : "#ffffff";
}

// Returns a robust, nonzero viewport height, using visualViewport for mobile browsers
function getSafeViewportHeight(fallback = 720) {
  if (typeof window === "undefined") return fallback;
  // visualViewport is the most accurate on mobile Safari/Chrome
  const vv = window.visualViewport;
  const h =
    vv?.height || window.innerHeight || document.documentElement?.clientHeight;
  return Math.max(320, Number(h) || fallback);
}

function safeCategory(c) {
  // category no longer controls filtering; keep it only for display/search
  return String(c ?? "").trim();
}

function safeType(t) {
  const norm = normalize(t);
  const hit = TYPE_ORDER.find((x) => normalize(x) === norm);
  return hit || "Neutral";
}

export default function MeituColors() {
  const location = useLocation();
  const dispatch = useDispatch();
  const cachedColors = useSelector(selectPreparedColors);
  const colorsCacheInitialized = useSelector(selectColorsCacheInitialized);
  const pageRef = useRef(null);
  const gridShellRef = useRef(null);
  const gridRef = useRef(null);
  const previewPanelRef = useRef(null);
  const previewCardRef = useRef(null);

  // UI state
  const [activeTone, setActiveTone] = useState("All");
  const [query, setQuery] = useState("");
  const [activeShade, setActiveShade] = useState(null);
  const [heroShadeIndex, setHeroShadeIndex] = useState(0);

  // Memoized subject for inquiry links (mobile/desktop preview)
  const inquirySubject = useMemo(() => {
    if (!activeShade) return "";
    return `${activeShade.id}  ${activeShade.name} color shade`.trim();
  }, [activeShade]);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 1080px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  // ===== Room preview (right panel) =====
  const ROOMS = useMemo(
    () => [
      {
        key: "bedroom",
        label: "Bedroom",
        img: "/bedroom.webp",
        mask: "/bedroom-mask.svg",
      },
      {
        key: "living",
        label: "Living Room",
        img: "/living.webp",
        mask: "/living-mask.svg",
      },
      {
        key: "kitchen",
        label: "Kitchen",
        img: "/kitchen.webp",
        mask: "/kitchen-mask.svg",
      },
    ],
    [],
  );

  const [activeRoom, setActiveRoom] = useState("bedroom");

  const room = useMemo(
    () => ROOMS.find((r) => r.key === activeRoom) || ROOMS[0],
    [ROOMS, activeRoom],
  );

  // Initial render window (performance): show 504, then allow full palette
  const INITIAL_VISIBLE = 504;
  const [visibleLimit, setVisibleLimit] = useState({
    key: "",
    count: INITIAL_VISIBLE,
  });
  const filterKey = useMemo(() => `${activeTone}\u0000${query}`, [
    activeTone,
    query,
  ]);

  // Always jump to the top on route entry + reload (disable browser scroll restoration)
  useLayoutEffect(() => {
    const prev = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // ignore
    }

    const jumpTop = () => {
      // set both to defeat Safari / mobile quirks
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    // Run immediately, then again after the next frame to override any late restoration
    jumpTop();
    const raf = requestAnimationFrame(jumpTop);
    const t = window.setTimeout(jumpTop, 0);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      try {
        window.history.scrollRestoration = prev;
      } catch {
        // ignore
      }
    };
  }, [location.key]);

  // Reveal polish (matches your home page behavior)
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const els = Array.from(root.querySelectorAll("[data-reveal]"));
    if (els.length === 0) return;

    // If IntersectionObserver is unavailable (older iOS / embedded webviews),
    // reveal everything immediately so the page never looks blank.
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }

    let io;
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add("is-in");
          });
        },
        { threshold: 0.08 },
      );

      els.forEach((el) => io.observe(el));

      // Safety: if something goes wrong with IO on mobile, reveal after a short delay
      const t = window.setTimeout(() => {
        els.forEach((el) => el.classList.add("is-in"));
      }, 700);

      return () => {
        window.clearTimeout(t);
        io?.disconnect?.();
      };
    } catch {
      // Ultimate fallback: reveal all
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
  }, []);

  // Normalize and pre-process once, then keep the prepared list in Redux so
  // this large static palette stays instant when users return to /colors.
  const colors = useMemo(() => {
    if (colorsCacheInitialized) return cachedColors;

    const rawList = Array.isArray(colorsRaw)
      ? colorsRaw
      : Array.isArray(colorsRaw?.colors)
        ? colorsRaw.colors
        : [];

    const list = rawList.map((c, idx) => {
      const id =
        String(c.id ?? c.code ?? c.shadeCode ?? "").trim() ||
        `shade-${idx + 1}`;
      const name = String(c.name ?? c.shadeName ?? "Untitled Shade").trim();
      const rgb = normalizeCssColor(c.rgb ?? "rgb(180,180,180)");
      const category = safeCategory(c.category);
      const type = safeType(c.type);
      const _q = normalize(`${id} ${name} ${category} ${type}`);
      const _text = getContrastText(rgb);
      return { ...c, id, name, rgb, category, type, _q, _text };
    });

    if (import.meta.env.DEV && list.length === 0) {
      console.warn(
        "[MeituColors] No colors loaded. Check meitu-colors.json shape (expected an array).",
        colorsRaw,
      );
    }
    // Keep the original JSON order (do not sort)
    return list;
  }, [cachedColors, colorsCacheInitialized]);

  useEffect(() => {
    if (!colorsCacheInitialized) {
      dispatch(setPreparedColors(colors));
    }
  }, [colors, colorsCacheInitialized, dispatch]);

  // Filtering (memoized)
  const filtered = useMemo(() => {
    const q = normalize(query);

    return colors.filter((c) => {
      // Tone filter (single select)
      if (activeTone !== "All" && c.type !== activeTone) return false;

      // Search filter
      if (q && !c._q.includes(q)) return false;

      return true;
    });
  }, [colors, activeTone, query]);

  const visibleCount =
    visibleLimit.key === filterKey ? visibleLimit.count : INITIAL_VISIBLE;

  // Visible slice (for initial 504 + Show all)
  const visible = useMemo(() => {
    return filtered.slice(0, Math.max(0, visibleCount));
  }, [filtered, visibleCount]);

  const heroShades = useMemo(() => {
    if (!colors.length) return [FALLBACK_SHADE];
    const picks = [
      0,
      Math.floor(colors.length * 0.18),
      Math.floor(colors.length * 0.36),
      Math.floor(colors.length * 0.54),
      Math.floor(colors.length * 0.72),
      Math.max(0, colors.length - 1),
    ];

    return Array.from(
      new Map(
        picks
          .map((index) => colors[index])
          .filter(Boolean)
          .map((shade) => [shade.id, shade])
      ).values()
    ).slice(0, 6);
  }, [colors]);

  const activeHeroShade =
    heroShades[heroShadeIndex % Math.max(1, heroShades.length)] ||
    FALLBACK_SHADE;

  useEffect(() => {
    if (heroShades.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroShadeIndex((current) => (current + 1) % heroShades.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [heroShades.length]);

  // Ensure the virtualized grid recomputes sizes after mount / reload and after filtering.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      try {
        gridRef.current?.recomputeGridSize?.();
        gridRef.current?.forceUpdateGrid?.();
      } catch {
        // no-op
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeTone, query, filtered.length]);

  // Ensure selected swatch highlight updates immediately
  useEffect(() => {
    try {
      gridRef.current?.recomputeGridSize?.();
      gridRef.current?.forceUpdateGrid?.();
    } catch {
      // no-op
    }
  }, [activeShade]);

  useEffect(() => {
    const shell = gridShellRef.current;
    const panel = previewPanelRef.current;
    const card = previewCardRef.current;

    if (!activeShade || isMobile || !shell || !panel || !card) {
      card?.classList.remove(
        "preview-dock-top",
        "preview-dock-fixed",
        "preview-dock-bottom",
      );
      return;
    }

    let frame = 0;
    const TOP_OFFSET = 56;
    const BOTTOM_GAP = 24;

    const setMode = (mode) => {
      card.classList.toggle("preview-dock-top", mode === "top");
      card.classList.toggle("preview-dock-fixed", mode === "fixed");
      card.classList.toggle("preview-dock-bottom", mode === "bottom");
    };

    const updateDock = () => {
      frame = 0;
      const viewportHeight =
        window.visualViewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        720;
      const panelRect = panel.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const panelWidth = Math.max(320, panelRect.width);
      const previewHeight = Math.max(
        420,
        Math.min(760, viewportHeight - TOP_OFFSET - BOTTOM_GAP),
      );
      const shellHeight = Math.max(shell.offsetHeight, previewHeight);
      const bottomTop = Math.max(0, shellHeight - previewHeight);

      panel.style.setProperty("--preview-height", `${previewHeight}px`);
      card.style.setProperty("--preview-left", `${panelRect.left}px`);
      card.style.setProperty("--preview-width", `${panelWidth}px`);
      card.style.setProperty("--preview-height", `${previewHeight}px`);
      card.style.setProperty("--preview-top", `${TOP_OFFSET}px`);
      card.style.setProperty("--preview-bottom-top", `${bottomTop}px`);

      if (shellRect.top > TOP_OFFSET) {
        setMode("top");
        return;
      }

      if (shellRect.bottom <= TOP_OFFSET + previewHeight) {
        setMode("bottom");
        return;
      }

      setMode("fixed");
    };

    const requestDockUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateDock);
    };

    updateDock();
    window.addEventListener("scroll", requestDockUpdate, { passive: true });
    window.addEventListener("resize", requestDockUpdate);
    window.addEventListener("orientationchange", requestDockUpdate);
    window.visualViewport?.addEventListener?.("resize", requestDockUpdate);
    window.visualViewport?.addEventListener?.("scroll", requestDockUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestDockUpdate);
      window.removeEventListener("resize", requestDockUpdate);
      window.removeEventListener("orientationchange", requestDockUpdate);
      window.visualViewport?.removeEventListener?.("resize", requestDockUpdate);
      window.visualViewport?.removeEventListener?.("scroll", requestDockUpdate);
      card.classList.remove(
        "preview-dock-top",
        "preview-dock-fixed",
        "preview-dock-bottom",
      );
      panel.style.removeProperty("--preview-height");
      card.style.removeProperty("--preview-left");
      card.style.removeProperty("--preview-width");
      card.style.removeProperty("--preview-height");
      card.style.removeProperty("--preview-top");
      card.style.removeProperty("--preview-bottom-top");
    };
  }, [activeShade, isMobile, filtered.length, visible.length]);

  useEffect(() => {
    const onResize = () => {
      try {
        gridRef.current?.recomputeGridSize?.();
        gridRef.current?.forceUpdateGrid?.();
      } catch {
        // no-op
      }
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    // Mobile: address bar / keyboard changes often only trigger visualViewport
    const vv = window.visualViewport;
    vv?.addEventListener?.("resize", onResize);
    vv?.addEventListener?.("scroll", onResize);

    // One extra pass after first paint helps iOS Safari report correct height
    const t = window.setTimeout(onResize, 120);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      vv?.removeEventListener?.("resize", onResize);
      vv?.removeEventListener?.("scroll", onResize);
      window.clearTimeout(t);
    };
  }, []);

  // Tone counts (respect search; used for pill counts)
  const toneCounts = useMemo(() => {
    const q = normalize(query);
    const counts = new Map();

    counts.set("All", 0);
    TYPE_ORDER.forEach((t) => counts.set(t, 0));

    colors.forEach((c) => {
      if (q && !c._q.includes(q)) return;
      counts.set("All", (counts.get("All") || 0) + 1);
      counts.set(c.type, (counts.get(c.type) || 0) + 1);
    });

    return counts;
  }, [colors, query]);

  function selectTone(tone) {
    setActiveTone(tone);
    const el = document.getElementById("colorsGridTop");
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeShade() {
    setActiveShade(null);
  }

  function renderPaletteGrid({
    height,
    isScrolling = false,
    onChildScroll,
    scrollTop = 0,
    registerChild,
  } = {}) {
    return (
      <div
        className={`rv-wrap ${isScrolling ? "is-scrolling" : ""}`}
        aria-label="Shades grid"
        ref={registerChild}
        style={{ minHeight: 360 }}
      >
        <AutoSizer disableHeight>
          {({ width }) => {
            const isNarrow = width < 560;
            const isPhone = width < 460;
            const PAD = isNarrow ? 8 : 10;
            const gutterX = isNarrow ? 8 : 10;
            const gutterY = isNarrow ? 28 : 28;
            const contentW = Math.max(0, width - PAD * 2);
            const safeH =
              height && height > 0 ? height : getSafeViewportHeight();
            const viewportH = Math.max(320, safeH - PAD * 2);

            const getColumnCount = (w) => {
              if (activeShade && !isMobile) return 4;
              if (w >= 1060) return 7;
              if (w >= 900) return 6;
              if (w >= 760) return 5;
              if (w >= 600) return 4;
              if (w >= 420) return 3;
              return 2;
            };

            const columnCount = getColumnCount(contentW);
            const itemH = isNarrow ? 86 : 88;
            const rowCount = Math.ceil(visible.length / columnCount);
            const minItemW = isPhone ? 132 : 112;
            const itemW = Math.max(
              minItemW,
              Math.floor(
                (contentW - gutterX * (columnCount - 1)) / columnCount
              )
            );

            return (
              <div className={isNarrow ? "rv-pad rv-pad-sm" : "rv-pad"}>
                <Grid
                  ref={gridRef}
                  className="rv-grid"
                  autoHeight
                  width={contentW}
                  height={viewportH}
                  columnCount={columnCount}
                  rowCount={rowCount}
                  columnWidth={itemW + gutterX}
                  rowHeight={itemH + gutterY}
                  overscanRowCount={isNarrow ? 14 : 12}
                  scrollingResetTimeInterval={140}
                  isScrolling={isScrolling}
                  onScroll={onChildScroll}
                  scrollTop={scrollTop}
                  style={{
                    overflowX: "hidden",
                    overflowY: "hidden",
                  }}
                  cellRenderer={({ columnIndex, rowIndex, key, style }) => {
                    const index = rowIndex * columnCount + columnIndex;
                    if (index >= visible.length) return null;

                    const shade = visible[index];
                    const isLastCol = columnIndex === columnCount - 1;
                    const isLastRow = rowIndex === rowCount - 1;

                    return (
                      <div
                        key={key}
                        style={{
                          ...style,
                          paddingRight: isLastCol ? 0 : gutterX,
                          paddingBottom: isLastRow ? 0 : gutterY,
                          boxSizing: "border-box",
                        }}
                      >
                        {isScrolling ? (
                          <SwatchLite
                            shade={shade}
                            isActive={activeShade?.id === shade.id}
                          />
                        ) : (
                          <SwatchCard
                            shade={shade}
                            onOpen={setActiveShade}
                            isActive={activeShade?.id === shade.id}
                          />
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            );
          }}
        </AutoSizer>
      </div>
    );
  }

  // Close on ESC + lock scroll while modal is open
  useEffect(() => {
    if (!activeShade) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeShade();
    };
    document.addEventListener("keydown", onKeyDown);

    let prevOverflow;
    if (isMobile) {
      // Mobile: lock background scroll while preview is open (do NOT change scroll position)
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (isMobile && prevOverflow !== undefined) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [activeShade, isMobile]);

  return (
    <>
      <NavBar />
      {activeShade && isMobile ? (
        <aside
          className="preview-panel mobile-abs"
          aria-label="Room preview"
          style={{ "--preview-shade": activeShade.rgb }}
        >
          <div
            className="preview-card"
            style={{ "--preview-shade": activeShade.rgb }}
          >
            <div className="preview-head">
              <div className="preview-head-copy">
                <span className="preview-kicker">Room Preview</span>
                <strong className="preview-room-name">{room.label}</strong>
              </div>
              <span
                className="preview-head-swatch"
                aria-hidden="true"
                style={{ backgroundColor: activeShade.rgb }}
              />
              <button
                type="button"
                className="preview-close"
                aria-label="Close preview"
                onClick={closeShade}
              >
                ×
              </button>
            </div>

            <div className="preview-room">
              <img className="room-img" src={room.img} alt={room.label} />

              <div
                className="room-tint"
                aria-hidden="true"
                style={{
                  backgroundColor: activeShade.rgb,
                  WebkitMaskImage: `url(${room.mask})`,
                  maskImage: `url(${room.mask})`,
                }}
              />

              <div
                className="room-shadow"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${room.img})`,
                  WebkitMaskImage: `url(${room.mask})`,
                  maskImage: `url(${room.mask})`,
                }}
              />

              <div className="room-sheen" aria-hidden="true" />
              <div className="room-floating-chip" aria-hidden="true">
                <span>{activeShade.id}</span>
                <strong>{activeShade.name}</strong>
              </div>
            </div>

            <div className="preview-info">
              <div className="pname">{activeShade.name}</div>
              <div className="pmeta">
                <span className="pcode">{activeShade.id}</span>
                <span className="pdot" aria-hidden="true">
                  •
                </span>
                <span className="prgb">{activeShade.rgb}</span>
              </div>
            </div>

            <div className="preview-footer">
              <div className="room-rail" role="tablist" aria-label="Rooms">
                {ROOMS.map((r) => {
                  const on = r.key === activeRoom;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      className={`room-pill ${on ? "on" : ""}`}
                      onClick={() => setActiveRoom(r.key)}
                      aria-pressed={on}
                      title={r.label}
                    >
                      <span
                        className="room-thumb"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${r.img})` }}
                      />
                      <span className="room-label">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="shade-ref" aria-label="Selected shade reference">
                <span
                  className="shade-ref-swatch"
                  aria-hidden="true"
                  style={{ backgroundColor: activeShade.rgb }}
                />
                <div className="shade-ref-meta">
                  <div className="shade-ref-k">Reference</div>
                  <div className="shade-ref-v">{activeShade.rgb}</div>
                </div>
              </div>
              <div className="preview-cta">
                <Link
                  to={`/inquiry?subject=${encodeURIComponent(inquirySubject)}`}
                  state={{ defaultSubject: inquirySubject }}
                  className="pill solid preview-cta-btn"
                >
                  Talk to an Expert
                </Link>
                <Link
                  to="/products"
                  className="pill glass preview-cta-btn"
                  aria-label="Go to products page"
                >
                  Explore Products
                </Link>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
      <div ref={pageRef} className="colors-root">
        {/* HERO */}
        <header className="colors-hero" data-reveal>
          <div className="hero-ambient" aria-hidden="true" />
          <div className="hero-shell">
            <div className="hero-left color-hero-copy">
              <span className="hero-eyebrow">MEITU COLOR STUDIO</span>
              <h1 className="hero-title">
                Find the shade
                <span className="hero-accent"> that holds the room.</span>
              </h1>
              <p className="hero-sub">
                Search {colors.length.toLocaleString()} Meitu shades, preview
                them on real interiors, and move through tone families without
                leaving the palette.
              </p>

              <div className="hero-actions">
                <a href="#colorsGridTop" className="pill solid">
                  Browse shades
                </a>
                <Link to="/support" className="studio-text-link">
                  Get colour advice
                </Link>
              </div>

              <div className="color-hero-stats" aria-label="Color library summary">
                <div>
                  <strong>{colors.length.toLocaleString()}</strong>
                  <span>catalog shades</span>
                </div>
                <div>
                  <strong>{TYPE_ORDER.length}</strong>
                  <span>tone families</span>
                </div>
                <div>
                  <strong>{ROOMS.length}</strong>
                  <span>room previews</span>
                </div>
              </div>
            </div>

            <div className="hero-right" data-reveal>
              <div
                className="hero-card color-spectrum-card"
                style={{ "--active-hero-shade": activeHeroShade.rgb }}
              >
                <div className="color-orbit orbit-large" aria-hidden="true" />
                <div className="color-orbit orbit-small" aria-hidden="true" />
                <div className="color-glass-room" aria-hidden="true">
                  <div className="room-wall" />
                  <div className="room-floor" />
                  <div className="room-window" />
                  <div className="room-art" />
                </div>

                <div className="color-hero-carousel" aria-label="Featured shades">
                  {heroShades.map((shade, index) => (
                    <button
                      key={shade.id}
                      type="button"
                      className={`color-slide ${
                        index === heroShadeIndex % heroShades.length
                          ? "active"
                          : ""
                      }`}
                      style={{ "--slide-color": shade.rgb }}
                      onClick={() => setHeroShadeIndex(index)}
                      aria-pressed={index === heroShadeIndex % heroShades.length}
                      aria-label={`Preview featured shade ${shade.name} ${shade.id}`}
                      title={`${shade.name} ${shade.id}`}
                    >
                      <span className="color-slide-swatch" />
                      <span className="color-slide-copy" aria-hidden="true">
                        <strong>{shade.name}</strong>
                        <small>{shade.id}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="hero-card-bottom color-hero-note">
                  <span>Featured shade</span>
                  <strong>{activeHeroShade.name}</strong>
                  <small>{activeHeroShade.id} · {activeHeroShade.rgb}</small>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* TOOLBAR (sticky / premium) */}
        <section className="toolbar" data-reveal>
          <div className="toolbar-shell">
            {/* Categories rail */}
            {/* Tone rail (reuses the exact same styling) */}
            <div
              className="cat-rail"
              role="tablist"
              aria-label="Tone categories"
            >
              {TONE_RAIL.map((t) => {
                const isActive = t === activeTone;
                const count = toneCounts.get(t) || 0;

                return (
                  <button
                    key={t}
                    type="button"
                    className={`cat-pill ${isActive ? "active" : ""}`}
                    onClick={() => selectTone(t)}
                    aria-pressed={isActive}
                    title={`${t} (${count})`}
                  >
                    <span className="cat-text">{t}</span>
                    <span className="cat-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search + type filters */}
            <div className="filters">
              <div className="search">
                <span className="sicon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="m21 21-4.35-4.35" />
                    <circle cx="11" cy="11" r="6.5" />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search shade name or code (e.g., 2001P, Sunny Lemon)…"
                  aria-label="Search shades"
                />
                {query ? (
                  <button
                    className="clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* GRID HEADER */}
        <section className="grid-head" data-reveal>
          <div className="grid-head-shell" id="colorsGridTop">
            <div>
              <h2 className="grid-title">{activeTone} Shades</h2>
              <p className="grid-sub">
                Showing <strong>{visible.length}</strong>
                {filtered.length > visible.length ? (
                  <>
                    {" "}
                    of <strong>{filtered.length}</strong>
                  </>
                ) : null}{" "}
                shades
                {query ? (
                  <>
                    {" "}
                    matching <strong>“{query}”</strong>
                  </>
                ) : null}
                . Tap a color to preview.
              </p>
            </div>
          </div>
        </section>

        {/* COLORS GRID (virtualized) */}
        <section className="grid-wrap" data-reveal>
          <div
            ref={gridShellRef}
            className={`grid-shell ${activeShade ? "has-preview" : ""}`}
          >
            <div className="grid-main">
              {filtered.length === 0 ? (
                <div className="endcap">
                  <div className="endcap-title">No shades found.</div>
                  <div className="endcap-sub">
                    Try switching tone pills or clearing your search.
                  </div>
                </div>
              ) : (
                <>
                  <WindowScroller>
                    {({
                      height,
                      isScrolling,
                      onChildScroll,
                      scrollTop,
                      registerChild,
                    }) =>
                      renderPaletteGrid({
                        height,
                        isScrolling,
                        onChildScroll,
                        scrollTop,
                        registerChild,
                      })
                    }
                  </WindowScroller>
                  {filtered.length > visible.length ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        paddingTop: 18,
                      }}
                    >
                      <button
                        type="button"
                        className="pill glass"
                        onClick={() =>
                          setVisibleLimit({
                            key: filterKey,
                            count: filtered.length,
                          })
                        }
                        aria-label="Show all colors"
                      >
                        Show all colors
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            {activeShade && !isMobile ? (
              <aside
                ref={previewPanelRef}
                className="preview-panel"
                aria-label="Room preview"
              >
                <div
                  ref={previewCardRef}
                  className="preview-card"
                  style={{ "--preview-shade": activeShade.rgb }}
                >
                  <div className="preview-head">
                    <div className="preview-head-copy">
                      <span className="preview-kicker">Room Preview</span>
                      <strong className="preview-room-name">{room.label}</strong>
                    </div>
                    <span
                      className="preview-head-swatch"
                      aria-hidden="true"
                      style={{ backgroundColor: activeShade.rgb }}
                    />
                    <button
                      type="button"
                      className="preview-close"
                      aria-label="Close preview"
                      onClick={closeShade}
                    >
                      ×
                    </button>
                  </div>

                  <div className="preview-room">
                    <img className="room-img" src={room.img} alt={room.label} />

                    {/* Pure RGB layer (accurate shade, no photo blending) */}
                    <div
                      className="room-tint"
                      aria-hidden="true"
                      style={{
                        backgroundColor: activeShade.rgb,
                        WebkitMaskImage: `url(${room.mask})`,
                        maskImage: `url(${room.mask})`,
                      }}
                    />

                    {/* Shadow/luminance layer (keeps original room shadows) */}
                    <div
                      className="room-shadow"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${room.img})`,
                        WebkitMaskImage: `url(${room.mask})`,
                        maskImage: `url(${room.mask})`,
                      }}
                    />

                    <div className="room-sheen" aria-hidden="true" />
                    <div className="room-floating-chip" aria-hidden="true">
                      <span>{activeShade.id}</span>
                      <strong>{activeShade.name}</strong>
                    </div>
                  </div>

                  <div className="preview-info">
                    <div className="pname">{activeShade.name}</div>
                    <div className="pmeta">
                      <span className="pcode">{activeShade.id}</span>
                      <span className="pdot" aria-hidden="true">
                        •
                      </span>
                      <span className="prgb">{activeShade.rgb}</span>
                    </div>
                  </div>

                  <div className="preview-footer">
                    <div
                      className="room-rail"
                      role="tablist"
                      aria-label="Rooms"
                    >
                      {ROOMS.map((r) => {
                        const on = r.key === activeRoom;
                        return (
                          <button
                            key={r.key}
                            type="button"
                            className={`room-pill ${on ? "on" : ""}`}
                            onClick={() => setActiveRoom(r.key)}
                            aria-pressed={on}
                            title={r.label}
                          >
                            <span
                              className="room-thumb"
                              aria-hidden="true"
                              style={{ backgroundImage: `url(${r.img})` }}
                            />
                            <span className="room-label">{r.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="shade-ref"
                      aria-label="Selected shade reference"
                    >
                      <span
                        className="shade-ref-swatch"
                        aria-hidden="true"
                        style={{ backgroundColor: activeShade.rgb }}
                      />
                      <div className="shade-ref-meta">
                        <div className="shade-ref-k">Reference</div>
                        <div className="shade-ref-v">{activeShade.rgb}</div>
                      </div>
                    </div>
                    <div className="preview-cta">
                      <Link
                        to={`/inquiry?subject=${encodeURIComponent(inquirySubject)}`}
                        state={{ defaultSubject: inquirySubject }}
                        className="pill solid preview-cta-btn"
                        aria-label="Go to inquiry page"
                      >
                        Talk to an Expert
                      </Link>
                      <Link
                        to="/products"
                        className="pill glass preview-cta-btn"
                        aria-label="Go to products page"
                      >
                        Explore Products
                      </Link>
                    </div>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </section>

        {/* FOOTER STRIP CTA */}
        <section className="bottom-strip" data-reveal>
          <div className="bottom-shell">
            <div className="bottom-left">
              <div className="bottom-eyebrow">NEXT STEP</div>
              <h3>Want a recommendation, not just a palette?</h3>
              <p>
                Tell us your surface type, lighting, and environment we’ll
                suggest a system and matching shades that look premium in real
                conditions.
              </p>
            </div>
            <div className="bottom-actions">
              <Link to="/inquiry" className="pill solid">
                Talk to an Expert
              </Link>
              <Link to="/ratecalculator" className="pill glass">
                Estimate Cost
              </Link>
            </div>
          </div>
        </section>
      </div><style>{`
:root{
  /* Premium “Apple-like” reds (deeper base + brighter highlight) */
  --red:#b3121b;      /* deep premium red */
  --red2:#ff3b30;     /* crisp highlight red */
  --red3:#ff6a5f;     /* soft glow accent */

  --black:#0b0b0c;

  --ink70:rgba(11,11,12,.70);
  --ink55:rgba(11,11,12,.55);

  --glass:rgba(255,255,255,.86);
  --glass2:rgba(255,255,255,.72);

  --shadow: 0 50px 120px rgba(0,0,0,.14);
  --shadow2: 0 30px 80px rgba(0,0,0,.10);

  --ease: cubic-bezier(.22,.61,.36,1);
}

        .colors-root{
          position:relative;
          background:
            radial-gradient(1200px 700px at 18% 0%, rgba(193,18,31,.10), transparent 55%),
            radial-gradient(1000px 700px at 85% 18%, rgba(193,18,31,.08), transparent 55%),
            #fff;
          min-height:100vh;
        }

        /* Reveal animation (same behavior as your home) */
        [data-reveal]{
          opacity:0;
          transform:translateY(14px);
          transition:opacity .75s ease, transform .75s ease;
          will-change:transform, opacity;
        }
        .is-in{
          opacity:1;
          transform:translateY(0);
        }

        /* Pills (reuse your language) */
        .pill{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          padding:14px 26px;
          border-radius:999px;
          font-weight:760;
          font-size:14px;
          text-decoration:none;
          letter-spacing:.01em;
          transition:transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
          user-select:none;
          border:none;
          cursor:pointer;
          white-space:nowrap;
        }
        .pill.solid{
          background:linear-gradient(180deg, var(--red2), var(--red));
          color:#fff;
          box-shadow:0 22px 60px rgba(193,18,31,.35), inset 0 1px 0 rgba(255,255,255,.25);
          border:1px solid rgba(255,255,255,.22);
        }
        .pill.glass{
          background:rgba(255,255,255,.78);
          border:1px solid rgba(0,0,0,.10);
          color:var(--black);
          backdrop-filter: blur(14px);
          box-shadow:0 20px 55px rgba(0,0,0,.10);
        }
        .pill:hover{
          transform:translateY(-2px);
          box-shadow:0 28px 80px rgba(0,0,0,.14);
        }

        /* HERO */
        .colors-hero{
          position:relative;
          padding: 140px 24px 70px;
          overflow:hidden;
        }
        .hero-ambient{
          position:absolute;
          inset:-180px -200px auto -200px;
          height:520px;
          background:
            radial-gradient(closest-side at 50% 45%, rgba(193,18,31,.20), transparent 72%),
            radial-gradient(closest-side at 22% 38%, rgba(225,29,46,.15), transparent 70%);
          filter: blur(10px);
          pointer-events:none;
        }
        .hero-shell{
          position:relative;
          max-width:1280px;
          margin:0 auto;
          display:grid;
          grid-template-columns: 1.2fr .8fr;
          gap:36px;
          align-items:start;
        }

        .hero-eyebrow{
          font-size:12px;
          letter-spacing:.34em;
          color:var(--red);
          font-weight:900;
        }
        .hero-title{
          font-size:56px;
          margin:18px 0 12px;
          letter-spacing:-.05em;
          font-weight:880;
          color:var(--black);
          line-height:1.06;
        }
        .hero-accent{ color:var(--red); }
        .hero-sub{
          font-size:17px;
          color:var(--ink70);
          line-height:1.75;
          max-width:740px;
        }

        .hero-actions{
          margin-top:22px;
          display:flex;
          gap:12px;
          flex-wrap:wrap;
        }

        .hero-stats{
          margin-top:26px;
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:12px;
          max-width:740px;
        }
        .hstat{
          background:rgba(255,255,255,.65);
          border:1px solid rgba(0,0,0,.06);
          border-radius:18px;
          padding:14px 14px;
          box-shadow:0 22px 50px rgba(0,0,0,.06);
          backdrop-filter: blur(14px);
        }
        .hval{
          font-size:18px;
          font-weight:880;
          letter-spacing:-.02em;
          color:var(--black);
        }
        .hkey{
          margin-top:6px;
          font-size:11px;
          letter-spacing:.16em;
          text-transform:uppercase;
          color:var(--ink55);
          font-weight:900;
        }

        .hero-right{
          display:flex;
          flex-direction:column;
          gap:14px;
        }

        .hero-card{
          border-radius:28px;
          background:rgba(255,255,255,.76);
          border:1px solid rgba(0,0,0,.08);
          backdrop-filter: blur(18px);
          box-shadow:var(--shadow);
          overflow:hidden;
        }
        .hero-card-top{
          padding:18px 18px 0;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }
        .hero-badge{
          font-size:11px;
          letter-spacing:.18em;
          text-transform:uppercase;
          font-weight:900;
          color:var(--red);
          background:rgba(193,18,31,.10);
          border:1px solid rgba(193,18,31,.20);
          padding:7px 10px;
          border-radius:999px;
          white-space:nowrap;
        }
        .hero-note{
          color:var(--ink55);
          font-size:12px;
          line-height:1.4;
          text-align:right;
        }
        .hero-visual{
          position:relative;
          margin:14px;
          border-radius:22px;
          overflow:hidden;
          min-height:220px;
          background:linear-gradient(180deg, rgba(193,18,31,.12), rgba(11,11,12,.06));
          border:1px solid rgba(0,0,0,.08);
        }
        .hero-visual img{
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          opacity:.9;
        }
        .hero-visual-fallback{
          position:absolute;
          inset:0;
          background:
            radial-gradient(closest-side at 30% 30%, rgba(193,18,31,.22), transparent 70%),
            radial-gradient(closest-side at 70% 60%, rgba(0,0,0,.10), transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,0));
          filter: blur(0px);
        }

        .hero-card-bottom{
          padding:16px 18px 18px;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .hero-card-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:10px 12px;
          border-radius:16px;
          background:rgba(255,255,255,.55);
          border:1px solid rgba(0,0,0,.06);
        }
        .label{
          font-size:11px;
          letter-spacing:.18em;
          text-transform:uppercase;
          font-weight:900;
          color:var(--ink55);
        }
        .value{
          font-size:13px;
          color:var(--ink70);
          text-align:right;
        }

        .zodiac-strip{
          border-radius:26px;
          padding:18px;
          background:rgba(11,11,12,.92);
          color:#fff;
          border:1px solid rgba(255,255,255,.10);
          box-shadow:0 44px 120px rgba(0,0,0,.18);
          overflow:hidden;
          position:relative;
        }
        .zodiac-strip::after{
          content:"";
          position:absolute;
          inset:-120px -120px auto auto;
          width:260px;
          height:260px;
          background:radial-gradient(circle, rgba(193,18,31,.22), transparent 60%);
          pointer-events:none;
        }
        .zstripe-title{
          font-weight:900;
          letter-spacing:-.02em;
          font-size:16px;
        }
        .zstripe-sub{
          margin-top:8px;
          color:rgba(255,255,255,.70);
          font-size:13px;
          line-height:1.6;
        }
        .zpill{ margin-top:12px; }

        /* TOOLBAR */
        .toolbar{
          position:sticky;
          top:78px; /* navbar height-ish */
          z-index:20;
          padding: 16px 24px;
          backdrop-filter: blur(18px);
          background:rgba(255,255,255,.70);
          border-top:1px solid rgba(0,0,0,.06);
          border-bottom:1px solid rgba(0,0,0,.06);
        }
        .toolbar-shell{
          max-width:1280px;
          margin:0 auto;
          display:flex;
          flex-direction:row;
          align-items:center;
          justify-content:space-between;
          gap:14px;
        }

                /* On smaller screens, stack back to column */
        @media (max-width: 820px){
          .toolbar-shell{
            flex-direction:column;
            align-items:stretch;
          }
        }


        .cat-rail{
          display:flex;
          align-items:center;
          flex: 1 1 auto;
          min-width: 0;
          gap:10px;
          overflow:auto;
          padding-bottom:6px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .cat-rail::-webkit-scrollbar{ display:none; }

        .cat-pill{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          border-radius:999px;
          border:1px solid rgba(0,0,0,.10);
          background:rgba(255,255,255,.75);
          backdrop-filter: blur(14px);
          color:var(--black);
          font-weight:760;
          font-size:13px;
          cursor:pointer;
          transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
          white-space:nowrap;
          outline:none;
        }
        .cat-pill:focus-visible{
          outline:3px solid rgba(193,18,31,.35);
          outline-offset:2px;
        }
        .cat-pill:hover{
          transform:translateY(-1px);
          box-shadow:var(--shadow2);
        }
        .cat-pill.active{
          background:linear-gradient(180deg, var(--red2), var(--red));
          color:#fff;
          border-color:rgba(255,255,255,.22);
          box-shadow:
            0 26px 70px rgba(193,18,31,.28),
            inset 0 1px 0 rgba(255,255,255,.22);
        }

        .cat-pill.active .cat-dot{
          background:#fff;
          box-shadow:0 0 0 6px rgba(255,255,255,.18);
        }

        .cat-pill.active .cat-text{ opacity:1; }

        .cat-pill.active .cat-count{
          background:rgba(0,0,0,.18);
          border-color:rgba(255,255,255,.18);
          color:rgba(255,255,255,.86);
        }
        .cat-dot{
          width:10px;
          height:10px;
          border-radius:999px;
          background:var(--red);
          box-shadow:0 0 0 6px rgba(193,18,31,.12);
        }
        .cat-text{ opacity:.92; }
        .cat-count{
          font-size:11px;
          font-weight:900;
          letter-spacing:.12em;
          padding:6px 10px;
          border-radius:999px;
          border:1px solid rgba(0,0,0,.08);
          background:rgba(255,255,255,.7);
          color:var(--ink55);
        }

        .filters{
          display:flex;
          gap:12px;
          align-items:center;
          justify-content:flex-end;
          flex: 0 0 auto;
          min-width: 0;
          white-space: nowrap;
        }

          @media (max-width: 820px){
          .filters{
            width:100%;
            justify-content:stretch;
          }
        }

        .search{
          width: min(520px, 42vw);
          flex: 0 1 auto;
          display:flex;
          align-items:center;
          gap:10px;
          padding:12px 14px;
          border-radius:18px;
          background:rgba(255,255,255,.76);
          border:1px solid rgba(0,0,0,.10);
          box-shadow:0 18px 50px rgba(0,0,0,.06);
          backdrop-filter: blur(14px);
          position:relative;
          min-width:280px;
        }
        .sicon{ color:var(--ink55); }
        .search input{
          border:none;
          outline:none;
          width:100%;
          background:transparent;
          font-size:14px;
        }
        .clear{
          border:none;
          background:rgba(0,0,0,.06);
          color:var(--black);
          width:30px;
          height:30px;
          border-radius:999px;
          cursor:pointer;
          transition:transform .16s ease, background .16s ease;
        }
        .clear:hover{
          transform:scale(1.04);
          background:rgba(193,18,31,.12);
        }

        /* GRID HEAD */
        .grid-head{
          padding: 34px 24px 6px;
        }
        .grid-head-shell{
          max-width:1280px;
          margin:0 auto;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:18px;
          flex-wrap:wrap;
        }
        .grid-title{
          font-size:36px;
          font-weight:880;
          letter-spacing:-.04em;
          margin:0;
          color:var(--black);
        }
        .grid-sub{
          margin-top:10px;
          color:var(--ink70);
          font-size:15px;
          line-height:1.7;
          max-width:720px;
        }

        .grid-meta{
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          justify-content:flex-end;
        }
        .meta-card{
          display:flex;
          align-items:center;
          gap:12px;
          padding:12px 14px;
          border-radius:18px;
          background:rgba(255,255,255,.76);
          border:1px solid rgba(0,0,0,.08);
          box-shadow:0 18px 50px rgba(0,0,0,.06);
          backdrop-filter: blur(14px);
          min-width:240px;
        }
        .meta-ico{
          width:38px;
          height:38px;
          border-radius:14px;
          display:grid;
          place-items:center;
          background:linear-gradient(180deg, rgba(193,18,31,.18), rgba(193,18,31,.06));
          border:1px solid rgba(193,18,31,.18);
          box-shadow:0 20px 44px rgba(193,18,31,.10);
          color:var(--black);
          font-weight:700;
        }
        .meta-top{
          font-weight:860;
          letter-spacing:-.02em;
          color:var(--black);
          font-size:14px;
        }
        .meta-sub{
          margin-top:2px;
          color:var(--ink55);
          font-size:12px;
          line-height:1.4;
        }

        /* GRID */
        .grid-wrap{
          padding: 14px 24px 70px;
        }
        .grid-shell{
          max-width:1280px;
          margin:0 auto;
        }

        /* When the preview is open, allow a wider layout so the panel can feel substantial */
        .grid-shell.has-preview{
          max-width: min(96vw, 1600px);
        }

        /* Grid + Preview split layout */
      .grid-shell.has-preview{
        display:flex;
        gap:16px;
        align-items:flex-start;
      }
      .grid-main{
        flex: 1 1 auto;
        min-width: 0;
      }
      .grid-shell.has-preview .grid-main{
        max-width: min(48vw, 760px);
      }

/* Sticky preview (stays put while grid scrolls) */
.preview-panel{
  /* ~half viewport on desktop, with sensible caps */
  flex: 0 0 min(48vw, 760px);
  position: sticky;
  top: calc(78px + 18px + env(safe-area-inset-top));
  align-self: flex-start;
}

/* Premium preview card */
.preview-card{
  border-radius: 26px;
  background: rgba(255,255,255,.82);
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 40px 120px rgba(0,0,0,.14);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  overflow:hidden;
}

.preview-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding: 16px 16px 10px;
}

.preview-kicker{
  font-size:11px;
  letter-spacing:.22em;
  text-transform:uppercase;
  font-weight:900;
  color: rgba(11,11,12,.55);
}
.preview-title{
  margin-top:6px;
  font-size:16px;
  font-weight:900;
  letter-spacing:-.02em;
  color: var(--black);
}
.preview-sub{
  margin-top:6px;
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  color: rgba(11,11,12,.62);
  font-size:12px;
  font-weight:800;
}
.preview-code{
  letter-spacing:.14em;
  text-transform:uppercase;
  padding:6px 10px;
  border-radius:999px;
  background: rgba(11,11,12,.06);
  border: 1px solid rgba(0,0,0,.08);
}
.preview-dot{ opacity:.5; }
.preview-rgb{ font-weight:800; }

.preview-close{
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.78);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display:grid;
  place-items:center;
  color: rgba(11,11,12,.72);
  box-shadow: 0 18px 55px rgba(0,0,0,.12);
  transition: transform .16s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}
.preview-close:hover{
  transform: translateY(-1px);
  border-color: rgba(0,0,0,.14);
  box-shadow: 0 26px 80px rgba(0,0,0,.16);
}

/* Room preview */
.preview-room{
  position: relative;
  margin: 12px 18px 0;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.70);
  box-shadow: 0 24px 70px rgba(0,0,0,.10);
}
.room-img{
  width: 100%;
  height: clamp(360px, 42vh, 520px);
  object-fit: cover;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}
.room-tint,
.room-shadow,
.room-sheen{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* exact RGB (no blending with photo) */
.room-tint{
  mix-blend-mode: normal;
  opacity: .88;

  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: cover;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: cover;
}

/* keep original shadows via luminance */
.room-shadow{
  mix-blend-mode: multiply;
  opacity: .65;
  filter: grayscale(1) contrast(1.18) brightness(.92);

  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: cover;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: cover;
}

/* subtle premium sheen */
.room-sheen{
  background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 44%);
  mix-blend-mode: soft-light;
  opacity: .75;
}

.preview-footer{
  padding: 14px 16px 16px;
  display:flex;
  flex-direction:column;
  gap: 12px;
}

.room-rail{
  display:flex;
  gap:10px;
  overflow:auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width:none;
}
.room-rail::-webkit-scrollbar{ display:none; }

.room-pill{
  display:flex;
  align-items:center;
  gap:10px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.72);
  cursor: pointer;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  white-space: nowrap;
}
.room-pill:hover{ transform: translateY(-1px); box-shadow: 0 24px 70px rgba(0,0,0,.10); }
.room-pill.on{
  /* Apple-like liquid glass selection (no red) */
  border-color: rgba(0,0,0,.14);
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow:
    0 26px 80px rgba(0,0,0,.14),
    inset 0 1px 0 rgba(255,255,255,.50),
    inset 0 0 0 1px rgba(255,255,255,.18);
}
.room-thumb{
  width: 46px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.12);
  background-size: cover;
  background-position: center;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.22);
  flex: 0 0 auto;
}
.room-label{
  font-size: 12px;
  font-weight: 900;
  color: rgba(11,11,12,.78);
}

.shade-ref{
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 12px 12px;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.74);
  box-shadow: 0 18px 55px rgba(0,0,0,.08);
}
.shade-ref-swatch{
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.12);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.28);
  flex: 0 0 auto;
}
.shade-ref-k{
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  font-weight: 900;
  color: rgba(11,11,12,.55);
}
.shade-ref-v{
  margin-top: 4px;
  font-size: 12px;
  font-weight: 850;
  color: rgba(11,11,12,.78);
  word-break: break-word;
  line-height: 1.2;
}

/* Responsive: stack preview below on smaller screens */
@media (max-width: 1080px){
  .grid-shell.has-preview{
    display:block;
  }

  /* Mobile: the right-side preview panel is not used; instead we render an absolute overlay */
  .preview-panel.mobile-abs{
    position: fixed;
    top: 76.5px;
    left: 0;
    right: 0;
    z-index: 99999;

    margin: 0;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    background: rgba(11,11,12,.40);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

    display:flex;
    align-items: stretch;
    justify-content: center;
  }

  /* Ensure any non-mobile-abs preview rules don't interfere */
  .preview-panel:not(.mobile-abs){
    position: static;
  }

  /* Fill the available height; no internal scrolling */
  .preview-card{
    width: 100%;
    max-width: 760px;
    height: 100%;
    border-radius: 22px;
    overflow: hidden;
    display:flex;
    flex-direction:column;
  }

  /* Keep header visible, but do NOT allow scrolling (so sticky is unnecessary) */
  .preview-head{
    background: rgba(255,255,255,.86);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    border-bottom: 1px solid rgba(0,0,0,.06);
  }

  /* Let the room preview take remaining height */
  .preview-room{
    margin: 12px 14px 0;
    border-radius: 20px;
    flex: 1 1 auto;
    height: auto;
    width: auto;
  }

  .room-img{
    height: 100%;
    width: 100%;
  }

  /* Keep info + controls compact and non-scrollable */
  .preview-info{
    padding: 10px 14px 0;
  }

  .preview-footer{
    padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
    overflow: hidden; /* IMPORTANT: no internal scroll */
  }

  /* Avoid horizontal scrolling on mobile too: wrap room pills */
  .room-rail{
    overflow: hidden;
    flex-wrap: wrap;
    padding-bottom: 0;
  }
}

        /* 7 columns on desktop; scales down automatically */
        
        /* Virtualized grid shell */
.rv-wrap{
  border-radius:22px;
  background:rgba(255,255,255,.70);
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 18px 50px rgba(0,0,0,.06);
  backdrop-filter: blur(14px);
  overflow:hidden;
}

/* inner padding without inline style churn */
.rv-pad{ padding:10px; }
.rv-pad-sm{ padding:8px; }

.rv-grid{ outline:none; }
.ReactVirtualized__Grid{ outline:none; }

/* While scrolling: reduce expensive paint (blur/shadows) for buttery performance */
.rv-wrap.is-scrolling{
  backdrop-filter:none;
}
.rv-wrap.is-scrolling .swatch,
.rv-wrap.is-scrolling .swatch.lite{
  box-shadow:none !important;
  backdrop-filter:none !important;
  transition:none !important;
}
/* Keep selection ring visible even while scrolling */
/* Keep selection visible even while scrolling (no heavy effects) */
.rv-wrap.is-scrolling .swatch.selected,
.rv-wrap.is-scrolling .swatch.lite.selected{
  border-color: rgba(0,0,0,.18);
  background: rgba(245,245,247,.92);
}
  
.rv-wrap.is-scrolling .swatch-chip{
  box-shadow:none !important;
}
.rv-wrap.is-scrolling .swatch-pop{
  display:none;
}

/* Swatch card (moved here to avoid per-item <style> injection) */
.swatch{
  position:relative;
  width:100%;
  padding:10px 10px 12px;
  border-radius:16px;
  border:1px solid rgba(0,0,0,.10);
  background:rgba(255,255,255,.72);
  backdrop-filter: blur(12px);
  box-shadow:0 16px 40px rgba(0,0,0,.06);
  cursor:pointer;
  text-align:left;
  transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  overflow:hidden;
  min-height:88px;
  contain: layout paint;
  will-change: transform;
  transform: translateZ(0);
}

.swatch.lite{
  cursor:default;
}
.swatch.lite:hover{
  transform:none;
}

.swatch::before{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0));
  pointer-events:none;
}

.swatch:hover{
  transform:translateY(-2px);
  box-shadow:0 26px 70px rgba(0,0,0,.10);
  border-color:rgba(193,18,31,.16);
}

/* Selected swatch (Apple-grade: subtle darkened glass press) */
.swatch.selected{
  border-color: rgba(0,0,0,.18);
  background: rgba(245,245,247,.88);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  box-shadow:
    0 24px 70px rgba(0,0,0,.14),
    inset 0 1px 0 rgba(255,255,255,.55),
    inset 0 0 0 1px rgba(255,255,255,.16),
    inset 0 -14px 28px rgba(0,0,0,.06);
  transform: translateY(-1px);
}

/* Subtle darkening overlay to signal selection */
.swatch.selected::after{
  content:"";
  position:absolute;
  inset:0;
  background: rgba(0,0,0,.035);
  pointer-events:none;
}

.swatch.selected .swatch-chip{
  filter: saturate(1.06) brightness(.95);
}

/* Keep the existing pop behavior but don't rely on it for selected */
.swatch.selected .swatch-pop{ display:none; }

        .swatch-chip{
  width:100%;
  height:44px;
  border-radius:12px;
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0)), var(--swatch, rgba(0,0,0,.08));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.25),
    0 14px 28px rgba(0,0,0,.10);
  border:1px solid rgba(0,0,0,.08);
}

.swatch-meta{
  margin-top:8px;
  display:flex;
  flex-direction:column;
  gap:2px;
}

.swatch-name{
  font-size:12px;
  font-weight:860;
  letter-spacing:-.01em;
  color:#0b0b0c;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.swatch-code{
  font-size:11px;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:rgba(11,11,12,.55);
  font-weight:900;
}

.swatch-pop{
  position:absolute;
  right:10px;
  top:10px;
  font-size:10px;
  letter-spacing:.18em;
  text-transform:uppercase;
  font-weight:900;
  padding:7px 10px;
  border-radius:999px;
  color:var(--swatchText);
  background:rgba(11,11,12,.76);
  border:1px solid rgba(255,255,255,.12);
  backdrop-filter: blur(10px);
  transform:translateY(-6px);
  opacity:0;
  transition:opacity .18s ease, transform .18s ease;
}

.swatch:hover .swatch-pop{
  opacity:1;
  transform:translateY(0);
}

.swatch.copied .swatch-pop{
  opacity:1;
  transform:translateY(0);
  background:linear-gradient(180deg, rgba(193,18,31,.92), rgba(193,18,31,.78));
  border-color:rgba(255,255,255,.18);
}

@media (hover:none){
  .swatch-pop{ opacity:1; transform:none; }
}

@media (prefers-reduced-motion: reduce){
  .swatch{ transition:none; }
  .swatch-pop{ transition:none; }
}


        .endcap{
          text-align:center;
          padding:18px 14px;
          border-radius:22px;
          background:rgba(255,255,255,.70);
          border:1px solid rgba(0,0,0,.08);
          backdrop-filter: blur(14px);
          box-shadow:0 18px 50px rgba(0,0,0,.06);
          max-width:620px;
        }
        .endcap-title{
          font-weight:880;
          letter-spacing:-.02em;
          color:var(--black);
        }
        .endcap-sub{
          margin-top:8px;
          color:var(--ink70);
          line-height:1.6;
          font-size:14px;
        }

        /* Bottom CTA strip */
        .bottom-strip{
          padding: 70px 24px 110px;
          background:
            radial-gradient(1000px 540px at 20% 50%, rgba(193,18,31,.10), transparent 60%),
            #fff;
        }
        .bottom-shell{
          max-width:1280px;
          margin:0 auto;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          flex-wrap:wrap;
          padding:28px 26px;
          border-radius:28px;
          background:rgba(11,11,12,.92);
          color:#fff;
          border:1px solid rgba(255,255,255,.10);
          box-shadow:0 44px 120px rgba(0,0,0,.18);
          position:relative;
          overflow:hidden;
        }
        .bottom-shell::after{
          content:"";
          position:absolute;
          inset:-140px -140px auto auto;
          width:320px;
          height:320px;
          background:radial-gradient(circle, rgba(193,18,31,.22), transparent 62%);
          pointer-events:none;
        }
        .bottom-eyebrow{
          font-size:11px;
          letter-spacing:.22em;
          text-transform:uppercase;
          font-weight:900;
          color:rgba(255,255,255,.72);
        }
        .bottom-left h3{
          margin:10px 0 8px;
          font-size:22px;
          letter-spacing:-.02em;
          font-weight:900;
        }
        .bottom-left p{
          margin:0;
          color:rgba(255,255,255,.72);
          line-height:1.7;
          max-width:720px;
          font-size:14px;
        }
        .bottom-actions{
          display:flex;
          gap:12px;
          flex-wrap:wrap;
        }

        /* Responsive */
        @media (max-width: 1180px){
          .hero-shell{
            grid-template-columns: 1fr;
          }
          .hero-title{ font-size:48px; }
          .hero-stats{ grid-template-columns:repeat(2, 1fr); }
        }

        @media (max-width: 820px){
          .grid-wrap{ padding: 12px 16px 60px; }
          .grid-head{ padding: 26px 16px 6px; }
          .grid-meta{ justify-content:flex-start; }
          .meta-card{ min-width: unset; }
        }

        @media (max-width: 520px){
          .grid-wrap{ padding: 10px 14px 54px; }
          .grid-head{ padding: 22px 14px 6px; }
          .grid-title{ font-size:30px; }
          .meta-card{ width:100%; }
          .search{ flex: 1 1 100%; min-width: 0; }
        }

        @media (max-width: 460px){
          
          .toolbar{ padding: 14px 14px; }
          .cat-pill{ padding: 9px 12px; font-size:12px; }
          .tchip{ padding: 9px 12px; font-size:12px; }
        }

        @media (prefers-reduced-motion: reduce){
          [data-reveal]{ transition:none; transform:none; opacity:1; }
          .pill, .cat-pill, .tchip{ transition:none; }
        }
        @media (max-width: 640px){
  .swatch{ min-height:82px; border-radius:14px; }
  .swatch-chip{ height:40px; border-radius:11px; }
}

        .preview-info{
          padding: 12px 18px 0;
        }
        .pname{
          font-size: 15px;
          font-weight: 920;
          letter-spacing: -.02em;
          color: var(--black);
        }
        .pmeta{
          margin-top: 7px;
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
          color: rgba(11,11,12,.62);
          font-size: 12px;
          font-weight: 850;
        }
        .pcode{
          letter-spacing:.14em;
          text-transform:uppercase;
          padding:6px 10px;
          border-radius:999px;
          background: rgba(11,11,12,.06);
          border: 1px solid rgba(0,0,0,.08);
        }
        .pdot{ opacity:.5; }
        .prgb{ font-weight: 850; }

        .preview-cta{
          display:flex;
          flex-direction:column;
          gap:10px;
          justify-content:stretch;
        }
        .preview-cta-btn{
          width:100%;
        }

        /* Apple design refresh overrides */
        .colors-root {
          background: var(--color-fog, #f5f5f7) !important;
          color: var(--color-ink, #1d1d1f) !important;
          font-family: var(--font-sf-pro-text, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif) !important;
        }
        .hero-ambient { display: none !important; }
        .colors-hero {
          padding: 82px 24px 70px !important;
          background: var(--meitu-home-hero-gradient) !important;
        }
        .hero-shell, .toolbar-shell, .grid-head-shell, .grid-shell, .bottom-shell {
          max-width: var(--page-max-width, 1200px) !important;
        }
        .hero-eyebrow, .hero-accent, .hero-badge, .bottom-eyebrow, .preview-kicker {
          color: var(--color-ink, #1d1d1f) !important;
          background: transparent !important;
          border-color: var(--color-silver-mist, #e8e8ed) !important;
        }
        .hero-title, .grid-title {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif) !important;
          color: var(--color-ink, #1d1d1f) !important;
          font-weight: 700 !important;
          letter-spacing: -0.022em !important;
        }
        .hero-title { font-size: clamp(48px, 7vw, 88px) !important; line-height: 1.04 !important; }
        .hero-sub, .grid-sub, .bottom-sub, .preview-card, .pmeta {
          color: var(--color-graphite, #707070) !important;
        }
        .hero-card, .toolbar, .preview-card, .search, .bottom-strip, .endcap {
          background: #fff !important;
          border: 0 !important;
          box-shadow: none !important;
          border-radius: 28px !important;
        }
        .toolbar { background: rgba(245,245,247,.84) !important; border-radius: 0 !important; border-top: 1px solid var(--color-silver-mist, #e8e8ed) !important; border-bottom: 1px solid var(--color-silver-mist, #e8e8ed) !important; }
        .cat-rail {
          background: rgba(210,210,215,.64) !important;
          border: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(20px) !important;
        }
        .cat-pill {
          border: 0 !important;
          box-shadow: none !important;
          color: rgba(0,0,0,.56) !important;
          background: transparent !important;
        }
        .cat-pill.active {
          background: #fff !important;
          color: var(--color-ink, #1d1d1f) !important;
        }
        .search input { color: var(--color-ink, #1d1d1f) !important; }
        .clear { background: var(--color-fog, #f5f5f7) !important; color: var(--color-graphite, #707070) !important; }
        .pill.solid, .preview-cta-btn.pill.solid {
          min-height: 38px !important;
          padding: 8px 18px !important;
          background: var(--apple-control-blue, #0071e3) !important;
          color: #fff !important;
          border: 1px solid rgba(255,255,255,.18) !important;
          box-shadow: none !important;
          font-weight: 400 !important;
          letter-spacing: -0.1px !important;
          transition: background-color .1s ease, transform .1s ease !important;
        }
        .pill.solid:hover, .preview-cta-btn.pill.solid:hover {
          background: var(--apple-control-blue-hover, #0077ed) !important;
          transform: translateY(-1px) !important;
        }
        .pill.glass, .preview-cta-btn.pill.glass {
          min-height: 38px !important;
          padding: 8px 18px !important;
          background: var(--apple-control-frost, rgba(210,210,215,.64)) !important;
          border: 0 !important;
          color: var(--color-ink, #1d1d1f) !important;
          box-shadow: none !important;
          backdrop-filter: blur(20px) !important;
          font-weight: 400 !important;
          letter-spacing: -0.1px !important;
        }
        .swatch {
          border: 0 !important;
          border-radius: 24px !important;
          background: #fff !important;
          box-shadow: none !important;
        }
        .swatch.selected {
          box-shadow: inset 0 0 0 2px var(--color-ink, #1d1d1f) !important;
        }
        .swatch-name { color: var(--color-ink, #1d1d1f) !important; }
        .swatch-code { color: var(--color-graphite, #707070) !important; }
        .preview-room, .room-rail, .shade-ref {
          border: 0 !important;
          border-radius: 24px !important;
          background: var(--color-fog, #f5f5f7) !important;
          box-shadow: none !important;
        }
        .room-pill.on { background: #fff !important; color: var(--color-ink, #1d1d1f) !important; }

        /* Apple color studio final layer */
        .colors-root {
          min-height: 100vh !important;
          background:
            radial-gradient(circle at 18% 12%, rgba(245,0,180,.09), transparent 28%),
            radial-gradient(circle at 78% 8%, rgba(0,113,227,.1), transparent 30%),
            radial-gradient(circle at 50% 98%, rgba(223,231,79,.16), transparent 34%),
            var(--color-fog, #f5f5f7) !important;
          overflow-x: clip;
        }

        .colors-hero {
          min-height: calc(100svh - 44px);
          display: grid;
          align-items: center;
          padding: clamp(54px, 8vw, 96px) 24px clamp(38px, 6vw, 72px) !important;
          background: transparent !important;
          overflow: hidden;
        }

        .hero-ambient {
          display: block !important;
          position: absolute;
          inset: -22% -10% auto;
          height: 64%;
          background:
            radial-gradient(circle at 24% 32%, rgba(245,0,180,.12), transparent 34%),
            radial-gradient(circle at 72% 20%, rgba(0,113,227,.12), transparent 38%),
            radial-gradient(circle at 52% 86%, rgba(223,231,79,.16), transparent 42%);
          filter: blur(18px);
          animation: colorAura 8s ease-in-out infinite alternate;
        }

        .hero-shell {
          display: grid !important;
          grid-template-columns: minmax(0, .95fr) minmax(360px, 1.05fr) !important;
          gap: clamp(36px, 7vw, 96px) !important;
          align-items: center !important;
          max-width: min(1320px, calc(100vw - 48px)) !important;
        }

        .hero-left {
          max-width: 660px;
        }

        .hero-eyebrow {
          display: inline-flex;
          margin-bottom: 14px;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: clamp(18px, 2vw, 24px) !important;
          line-height: 1.2;
          font-weight: 600 !important;
          letter-spacing: -0.36px !important;
          text-transform: none !important;
          color: var(--color-ink, #1d1d1f) !important;
        }

        .hero-title {
          max-width: 760px;
          margin: 0 !important;
          font-size: clamp(54px, 8.2vw, 96px) !important;
          line-height: 1.04 !important;
          font-weight: 700 !important;
          letter-spacing: -0.022em !important;
        }

        .hero-accent {
          display: block;
          background: linear-gradient(110deg, #1d1d1f 0%, #0071e3 36%, #f500b4 72%, #5e9c2a 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent !important;
        }

        .hero-sub {
          max-width: 610px;
          margin: 20px 0 0;
          font-size: clamp(18px, 2.1vw, 24px) !important;
          line-height: 1.4 !important;
          font-weight: 300 !important;
          letter-spacing: -0.2px;
          color: var(--color-graphite, #707070) !important;
        }

        .hero-actions {
          margin-top: 30px !important;
          gap: 14px !important;
        }

        .color-hero-stats {
          display: inline-grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          margin-top: 40px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 28px;
          background: var(--color-silver-mist, #e8e8ed);
        }

        .color-hero-stats div {
          min-width: 134px;
          padding: 16px 18px;
          background: rgba(255,255,255,.72);
          backdrop-filter: blur(20px);
        }

        .color-hero-stats strong,
        .color-hero-stats span {
          display: block;
        }

        .color-hero-stats strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 28px;
          line-height: 1.08;
          font-weight: 700;
          letter-spacing: -0.005em;
          color: var(--color-ink, #1d1d1f);
        }

        .color-hero-stats span {
          margin-top: 3px;
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          color: var(--color-graphite, #707070);
        }

        .color-spectrum-card {
          min-height: clamp(520px, 58vw, 700px);
          position: relative;
          display: grid;
          align-content: end;
          padding: clamp(18px, 3vw, 28px);
          border-radius: 28px !important;
          background:
            radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--active-hero-shade) 34%, transparent), transparent 34%),
            radial-gradient(circle at 20% 20%, rgba(245,0,180,.12), transparent 32%),
            radial-gradient(circle at 84% 16%, rgba(0,113,227,.12), transparent 34%),
            rgba(255,255,255,.72) !important;
          border: 1px solid rgba(255,255,255,.76) !important;
          box-shadow: none !important;
          overflow: hidden;
          isolation: isolate;
        }

        .color-spectrum-card::before {
          content: "";
          position: absolute;
          inset: 7%;
          border-radius: 28px;
          background:
            linear-gradient(rgba(29,29,31,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,29,31,.035) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(circle at 50% 45%, rgba(0,0,0,.42), transparent 68%);
          pointer-events: none;
        }

        .color-orbit {
          position: absolute;
          border: 1px solid rgba(29,29,31,.1);
          border-radius: 999px;
          pointer-events: none;
        }

        .orbit-large {
          width: 82%;
          aspect-ratio: 1 / .44;
          left: 9%;
          top: 22%;
          transform: rotate(-10deg);
          animation: colorOrbit 8s ease-in-out infinite;
        }

        .orbit-small {
          width: 48%;
          aspect-ratio: 1 / .5;
          left: 28%;
          top: 34%;
          transform: rotate(16deg);
          border-color: color-mix(in srgb, var(--active-hero-shade) 28%, rgba(29,29,31,.08));
          animation: colorOrbit 7s ease-in-out infinite reverse;
        }

        .color-glass-room {
          position: absolute;
          inset: 9% 9% 29%;
          border-radius: 28px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,255,255,.74), rgba(255,255,255,.34)),
            color-mix(in srgb, var(--active-hero-shade) 28%, #f5f5f7);
          border: 1px solid rgba(255,255,255,.74);
          backdrop-filter: blur(18px);
        }

        .room-wall {
          position: absolute;
          inset: 0 0 34%;
          background:
            radial-gradient(circle at 28% 22%, rgba(255,255,255,.38), transparent 30%),
            linear-gradient(180deg, color-mix(in srgb, var(--active-hero-shade) 72%, #ffffff), color-mix(in srgb, var(--active-hero-shade) 42%, #f5f5f7));
          transition: background-color .344s ease;
        }

        .room-floor {
          position: absolute;
          inset: auto 0 0;
          height: 38%;
          background:
            linear-gradient(12deg, rgba(29,29,31,.07), transparent 48%),
            rgba(255,255,255,.52);
          transform: skewY(-5deg);
          transform-origin: left top;
        }

        .room-window,
        .room-art {
          position: absolute;
          border: 1px solid rgba(29,29,31,.08);
          background: rgba(255,255,255,.48);
          backdrop-filter: blur(12px);
        }

        .room-window {
          width: 30%;
          height: 34%;
          right: 10%;
          top: 12%;
          border-radius: 20px;
        }

        .room-art {
          width: 25%;
          height: 22%;
          left: 12%;
          top: 18%;
          border-radius: 999px;
          background: var(--active-hero-shade);
        }

        .color-hero-carousel {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 10px;
          margin-top: auto;
        }

        .color-slide {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          min-height: 62px;
          padding: 9px 12px;
          border: 0;
          border-radius: 20px;
          background: rgba(255,255,255,.54);
          color: var(--color-ink, #1d1d1f);
          text-align: left;
          font: inherit;
          cursor: pointer;
          backdrop-filter: blur(18px);
          transition: transform .344s ease, background-color .1s ease;
        }

        .color-slide:hover,
        .color-slide.active {
          transform: translateX(4px);
          background: rgba(255,255,255,.9);
        }

        .color-slide-swatch {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: var(--slide-color);
          border: 1px solid rgba(29,29,31,.09);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.34);
        }

        .color-slide-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .color-slide-copy strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.1px;
        }

        .color-slide-copy small {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          letter-spacing: -0.26px;
        }

        .color-hero-note {
          position: relative;
          z-index: 1;
          margin-top: 12px;
          padding: 15px 16px;
          border-radius: 22px;
          background: rgba(255,255,255,.74);
          backdrop-filter: blur(20px);
        }

        .color-hero-note span,
        .color-hero-note small {
          display: block;
          color: var(--color-graphite, #707070);
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
        }

        .color-hero-note strong {
          display: block;
          margin: 4px 0;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 24px;
          line-height: 1.14;
          font-weight: 700;
          letter-spacing: -0.36px;
          color: var(--color-ink, #1d1d1f);
        }

        .toolbar {
          top: 44px !important;
          padding: 12px 24px !important;
          background: rgba(245,245,247,.82) !important;
          backdrop-filter: blur(22px) saturate(160%) !important;
        }

        .toolbar-shell {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 440px) !important;
          align-items: center !important;
          gap: 14px !important;
        }

        .cat-rail {
          padding: 5px !important;
          border-radius: 999px !important;
          background: rgba(210,210,215,.64) !important;
          backdrop-filter: blur(20px) !important;
        }

        .cat-pill {
          min-height: 36px;
          padding: 0 13px !important;
          border-radius: 999px !important;
          transition: background-color .1s ease, color .1s ease, transform .1s ease !important;
        }

        .cat-count {
          padding: 4px 8px !important;
          border: 0 !important;
          background: rgba(255,255,255,.58) !important;
          letter-spacing: -0.26px !important;
        }

        .cat-pill.active .cat-count {
          background: var(--color-fog, #f5f5f7) !important;
          color: var(--color-graphite, #707070) !important;
        }

        .search {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 46px;
          border-radius: 999px !important;
          background: rgba(232,232,237,.74) !important;
          box-shadow: none !important;
          border: 0 !important;
          padding: 0 13px !important;
        }

        .sicon {
          display: inline-flex;
          color: var(--color-graphite, #707070);
        }

        .sicon svg {
          width: 19px;
          height: 19px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .search input {
          font-size: 14px !important;
          letter-spacing: -0.04px;
        }

        .grid-head {
          padding: 44px 24px 10px !important;
        }

        .grid-title {
          font-size: clamp(34px, 5vw, 56px) !important;
          line-height: 1.07 !important;
        }

        .grid-sub {
          font-size: 17px !important;
          line-height: 1.47 !important;
          letter-spacing: -0.1px;
        }

        .rv-wrap {
          border: 0 !important;
          border-radius: 28px !important;
          background: rgba(255,255,255,.72) !important;
          box-shadow: none !important;
          backdrop-filter: blur(18px) !important;
        }

        .swatch {
          border-radius: 22px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.72)) !important;
          transition: transform .344s ease, background-color .1s ease, box-shadow .1s ease !important;
        }

        .swatch:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 0 0 1px rgba(29,29,31,.08) !important;
        }

        .swatch-chip {
          height: 46px !important;
          border-radius: 16px !important;
        }

        .preview-card {
          border-radius: 28px !important;
          background: rgba(255,255,255,.86) !important;
          border: 1px solid rgba(255,255,255,.74) !important;
          box-shadow: none !important;
        }

        .preview-head {
          padding: 18px 18px 10px !important;
        }

        .preview-kicker {
          font-size: 12px !important;
          line-height: 1.33;
          letter-spacing: -0.26px !important;
          text-transform: none !important;
          font-weight: 600 !important;
        }

        .preview-close {
          box-shadow: none !important;
          background: var(--color-fog, #f5f5f7) !important;
          border: 0 !important;
        }

        .preview-room {
          border-radius: 28px !important;
        }

        .room-img {
          height: clamp(340px, 42vh, 520px) !important;
        }

        .pname {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size: 24px !important;
          line-height: 1.17;
          font-weight: 700 !important;
          letter-spacing: -0.36px !important;
          color: var(--color-ink, #1d1d1f) !important;
        }

        .bottom-strip {
          padding: 70px 24px 110px !important;
          background: var(--color-fog, #f5f5f7) !important;
        }

        .bottom-shell {
          border-radius: 28px !important;
          background:
            radial-gradient(circle at 20% 30%, rgba(0,113,227,.16), transparent 30%),
            radial-gradient(circle at 80% 22%, rgba(245,0,180,.14), transparent 32%),
            var(--color-obsidian, #000) !important;
          box-shadow: none !important;
        }

        @keyframes colorAura {
          from { transform: translate3d(-1%, -1%, 0) scale(1); }
          to { transform: translate3d(1%, 1%, 0) scale(1.04); }
        }

        @keyframes colorOrbit {
          0%, 100% { transform: rotate(-10deg) translate3d(0, 0, 0); }
          50% { transform: rotate(-7deg) translate3d(0, -8px, 0); }
        }

        @media (max-width: 1080px) {
          .colors-hero {
            min-height: auto;
          }

          .hero-shell {
            grid-template-columns: 1fr !important;
            max-width: min(920px, calc(100vw - 32px)) !important;
          }

          .hero-left {
            max-width: 820px;
          }

          .color-spectrum-card {
            min-height: 560px;
          }

          .toolbar-shell {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .colors-hero {
            padding: 46px 16px 36px !important;
          }

          .hero-title {
            font-size: clamp(44px, 14vw, 62px) !important;
          }

          .hero-sub {
            font-size: 18px !important;
          }

          .hero-actions,
          .color-hero-stats,
          .bottom-actions {
            width: 100%;
          }

          .hero-actions .pill,
          .bottom-actions .pill {
            width: 100%;
          }

          .color-hero-stats {
            grid-template-columns: 1fr;
          }

          .color-spectrum-card {
            min-height: 520px;
            padding: 14px;
          }

          .color-glass-room {
            inset: 7% 7% 36%;
          }

          .toolbar {
            top: 44px !important;
            padding: 10px 14px !important;
          }

          .grid-head {
            padding: 32px 14px 8px !important;
          }
        }

        /* Clean pass requested: lighter, calmer, more Apple-like */
        .colors-root {
          background:
            radial-gradient(circle at 18% 6%, rgba(0,113,227,.035), transparent 26%),
            radial-gradient(circle at 86% 10%, rgba(245,0,180,.028), transparent 28%),
            var(--color-fog, #f5f5f7) !important;
        }

        .colors-hero {
          min-height: auto !important;
          padding: clamp(38px, 6vw, 74px) 24px clamp(34px, 5vw, 58px) !important;
        }

        .hero-ambient {
          opacity: .28 !important;
          filter: blur(28px) !important;
        }

        .hero-shell {
          grid-template-columns: minmax(0, 1fr) minmax(330px, 430px) !important;
          gap: clamp(28px, 5vw, 72px) !important;
          max-width: var(--page-max-width, 1200px) !important;
        }

        .hero-title {
          font-size: clamp(48px, 7vw, 82px) !important;
        }

        .hero-accent {
          background: linear-gradient(110deg, #1d1d1f 0%, #474747 44%, #0071e3 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
        }

        .hero-sub {
          max-width: 560px !important;
        }

        .pill,
        .pill.solid,
        .pill.glass,
        .preview-cta-btn {
          min-height: 36px !important;
          padding: 7px 15px !important;
          border-radius: 999px !important;
          font-size: 14px !important;
          font-weight: 400 !important;
        }

        .hero-actions {
          gap: 10px !important;
          margin-top: 24px !important;
        }

        .color-hero-stats {
          margin-top: 30px !important;
          border-radius: 22px !important;
        }

        .color-hero-stats div {
          min-width: 112px !important;
          padding: 13px 15px !important;
        }

        .color-spectrum-card {
          min-height: 500px !important;
          padding: 16px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.68)),
            radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--active-hero-shade) 16%, transparent), transparent 30%) !important;
        }

        .color-spectrum-card::before,
        .color-orbit {
          display: none !important;
        }

        .color-glass-room {
          inset: 8% 8% 44% !important;
          border-radius: 24px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.44)),
            color-mix(in srgb, var(--active-hero-shade) 18%, #f5f5f7) !important;
        }

        .room-window {
          width: 26% !important;
          height: 28% !important;
          border-radius: 16px !important;
          opacity: .72;
        }

        .room-art {
          width: 22% !important;
          height: 18% !important;
          opacity: .86;
        }

        .color-hero-carousel {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px !important;
        }

        .color-slide {
          grid-template-columns: 30px minmax(0, 1fr) !important;
          min-height: 46px !important;
          padding: 7px 9px !important;
          border-radius: 16px !important;
          background: rgba(255,255,255,.58) !important;
        }

        .color-slide:hover,
        .color-slide.active {
          transform: none !important;
          background: rgba(255,255,255,.9) !important;
        }

        .color-slide-swatch {
          width: 30px !important;
          height: 30px !important;
          border-radius: 11px !important;
        }

        .color-slide-copy strong {
          font-size: 12px !important;
        }

        .color-slide-copy small {
          font-size: 11px !important;
        }

        .color-hero-note {
          padding: 12px 13px !important;
          border-radius: 18px !important;
        }

        .color-hero-note strong {
          font-size: 18px !important;
        }

        .toolbar {
          padding: 9px 24px !important;
        }

        .toolbar-shell {
          grid-template-columns: minmax(0, 1fr) minmax(240px, 380px) !important;
        }

        .cat-rail {
          padding: 4px !important;
        }

        .cat-pill {
          min-height: 32px !important;
          padding: 0 11px !important;
          gap: 7px !important;
          font-size: 12px !important;
        }

        .cat-count {
          padding: 3px 7px !important;
          font-size: 10px !important;
        }

        .search {
          min-height: 38px !important;
          padding: 0 12px !important;
        }

        .clear {
          width: 26px !important;
          height: 26px !important;
        }

        .grid-head {
          padding: 30px 24px 8px !important;
        }

        .grid-wrap {
          padding-top: 10px !important;
        }

        .grid-shell.has-preview {
          max-width: min(1500px, calc(100vw - 48px)) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 420px) !important;
          gap: 20px !important;
          align-items: start !important;
        }

        .grid-shell.has-preview .grid-main {
          max-width: none !important;
          min-width: 0;
        }

        .preview-panel {
          position: sticky !important;
          top: calc(92px + env(safe-area-inset-top)) !important;
          flex: none !important;
          width: 100% !important;
        }

        .rv-wrap.internal-scroll {
          height: calc(100svh - 188px) !important;
          min-height: 500px !important;
          overflow: hidden !important;
        }

        .rv-wrap.internal-scroll .ReactVirtualized__Grid {
          scrollbar-width: thin;
          scrollbar-color: rgba(112,112,112,.28) transparent;
        }

        .rv-wrap.internal-scroll .ReactVirtualized__Grid::-webkit-scrollbar {
          width: 8px;
        }

        .rv-wrap.internal-scroll .ReactVirtualized__Grid::-webkit-scrollbar-thumb {
          background: rgba(112,112,112,.28);
          border-radius: 999px;
        }

        .swatch {
          border-radius: 18px !important;
          min-height: 78px !important;
          padding: 8px !important;
        }

        .swatch-chip {
          height: 38px !important;
          border-radius: 13px !important;
        }

        .swatch-meta {
          margin-top: 6px !important;
        }

        .swatch-name {
          font-size: 11px !important;
        }

        .swatch-code {
          font-size: 10px !important;
        }

        .preview-card {
          height: calc(100svh - 188px);
          min-height: 500px;
          display: flex;
          flex-direction: column;
          overflow: hidden !important;
        }

        .preview-room {
          margin: 10px 14px 0 !important;
          border-radius: 22px !important;
          flex: 1 1 auto;
          min-height: 0;
        }

        .room-img {
          height: 100% !important;
          min-height: 260px;
        }

        .preview-footer {
          gap: 10px !important;
          padding: 12px 14px 14px !important;
        }

        .room-rail,
        .shade-ref {
          border-radius: 18px !important;
        }

        .room-pill {
          padding: 7px 9px !important;
          border-radius: 14px !important;
        }

        .room-thumb {
          width: 34px !important;
          height: 28px !important;
          border-radius: 10px !important;
        }

        .shade-ref {
          padding: 9px !important;
        }

        .shade-ref-swatch {
          width: 36px !important;
          height: 36px !important;
          border-radius: 12px !important;
        }

        .preview-cta {
          gap: 8px !important;
        }

        @media (max-width: 1080px) {
          .grid-shell.has-preview {
            display: block !important;
            max-width: var(--page-max-width, 1200px) !important;
          }

          .rv-wrap.internal-scroll,
          .preview-card {
            height: auto !important;
            min-height: 0 !important;
          }

          .preview-panel {
            position: static !important;
          }
        }

        /* Remove toolbar containers and enlarge search */
        .toolbar {
          position: relative !important;
          top: auto !important;
          z-index: 2 !important;
          padding: 10px 24px 4px !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }

        .toolbar-shell {
          max-width: var(--page-max-width, 1200px) !important;
          display: grid !important;
          grid-template-columns: auto minmax(360px, 620px) !important;
          justify-content: space-between !important;
          align-items: center !important;
          gap: 24px !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .cat-rail {
          width: auto !important;
          flex: 0 1 auto !important;
          gap: 8px !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }

        .cat-pill {
          min-height: 32px !important;
          padding: 0 12px !important;
          gap: 7px !important;
          border-radius: 999px !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--color-graphite, #707070) !important;
        }

        .cat-pill:hover {
          transform: none !important;
          background: rgba(255,255,255,.64) !important;
          box-shadow: none !important;
        }

        .cat-pill.active {
          background: #fff !important;
          color: var(--color-ink, #1d1d1f) !important;
          box-shadow: inset 0 0 0 1px var(--color-silver-mist, #e8e8ed) !important;
        }

        .cat-count,
        .cat-pill.active .cat-count {
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 11px !important;
          letter-spacing: -0.26px !important;
        }

        .filters {
          width: 100% !important;
          justify-content: stretch !important;
          flex: none !important;
        }

        .search {
          width: 100% !important;
          min-width: 360px !important;
          max-width: 620px !important;
          min-height: 48px !important;
          border-radius: 999px !important;
          background: rgba(232,232,237,.72) !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 16px !important;
          backdrop-filter: none !important;
        }

        .search input {
          font-size: 15px !important;
        }

        @media (max-width: 820px) {
          .toolbar {
            padding: 8px 14px 2px !important;
          }

          .toolbar-shell {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .cat-rail {
            width: 100% !important;
          }

          .search {
            min-width: 0 !important;
            max-width: none !important;
          }
        }

        /* Active room preview: larger sticky preview, page-scroll catalog, 4-column shade grid */
        .grid-shell.has-preview {
          max-width: min(1560px, calc(100vw - 48px)) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(520px, 640px) !important;
          gap: 28px !important;
          align-items: start !important;
        }

        .grid-shell.has-preview .grid-main {
          max-width: none !important;
          min-width: 0 !important;
        }

        .grid-shell.has-preview .preview-panel {
          position: sticky !important;
          top: calc(58px + env(safe-area-inset-top)) !important;
          width: 100% !important;
          flex: none !important;
          align-self: start !important;
        }

        .grid-shell.has-preview .preview-card {
          height: clamp(560px, calc(100svh - 78px), 760px) !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          border-radius: 28px !important;
          box-shadow: none !important;
          background: rgba(255,255,255,.9) !important;
          border: 1px solid rgba(232,232,237,.92) !important;
        }

        .grid-shell.has-preview .preview-room {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          margin: 12px 16px 0 !important;
          border-radius: 26px !important;
        }

        .grid-shell.has-preview .room-img {
          height: 100% !important;
          min-height: 0 !important;
          object-fit: cover !important;
        }

        .grid-shell.has-preview .preview-footer {
          flex: 0 0 auto !important;
        }

        .rv-wrap.internal-scroll {
          height: auto !important;
          min-height: 360px !important;
          overflow: visible !important;
        }

        @media (max-width: 1240px) and (min-width: 1081px) {
          .grid-shell.has-preview {
            grid-template-columns: minmax(0, 1fr) minmax(460px, 540px) !important;
            gap: 22px !important;
          }
        }

        @media (max-width: 1080px) {
          .grid-shell.has-preview {
            display: block !important;
            max-width: var(--page-max-width, 1200px) !important;
          }
        }

        /* Final sticky/polish pass: keep preview bounded by the catalog section */
        .grid-wrap,
        .grid-shell.has-preview {
          overflow: visible !important;
        }

        .grid-wrap[data-reveal],
        .grid-wrap.is-in {
          opacity: 1 !important;
          transform: none !important;
          will-change: auto !important;
        }

        .grid-shell.has-preview {
          position: relative !important;
          max-width: min(1600px, calc(100vw - 48px)) !important;
          grid-template-columns: minmax(0, 1fr) minmax(560px, 680px) !important;
          gap: 30px !important;
          align-items: start !important;
        }

        .grid-shell.has-preview .preview-panel {
          position: sticky !important;
          top: calc(52px + env(safe-area-inset-top)) !important;
          align-self: start !important;
          z-index: 5 !important;
        }

        .grid-shell.has-preview .preview-card {
          height: min(760px, calc(100svh - 74px)) !important;
          min-height: min(540px, calc(100svh - 74px)) !important;
          border-radius: 30px !important;
          border: 1px solid rgba(232,232,237,.94) !important;
          background:
            radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--preview-shade, #f5f5f7) 18%, transparent), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.84)) !important;
          box-shadow: none !important;
          backdrop-filter: blur(22px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
        }

        .grid-shell.has-preview .preview-head {
          padding: 18px 18px 8px !important;
        }

        .grid-shell.has-preview .preview-kicker {
          color: var(--color-graphite, #707070) !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          letter-spacing: -0.26px !important;
          text-transform: none !important;
        }

        .grid-shell.has-preview .preview-close {
          width: 34px !important;
          height: 34px !important;
          border: 0 !important;
          background: rgba(232,232,237,.72) !important;
          color: var(--color-ash, #333) !important;
          box-shadow: none !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
        }

        .grid-shell.has-preview .preview-room {
          margin: 12px 16px 0 !important;
          border-radius: 28px !important;
          border: 1px solid rgba(232,232,237,.94) !important;
          background: var(--color-fog, #f5f5f7) !important;
          box-shadow: none !important;
        }

        .grid-shell.has-preview .preview-info {
          padding: 14px 18px 0 !important;
        }

        .grid-shell.has-preview .pname {
          font-size: 25px !important;
          line-height: 1.16 !important;
          letter-spacing: -0.42px !important;
        }

        .grid-shell.has-preview .preview-footer {
          padding: 12px 16px 16px !important;
          gap: 10px !important;
        }

        .grid-shell.has-preview .room-pill,
        .grid-shell.has-preview .shade-ref {
          border: 0 !important;
          background: rgba(245,245,247,.82) !important;
          box-shadow: none !important;
        }

        .grid-shell.has-preview .room-pill.on {
          background: #fff !important;
          box-shadow: inset 0 0 0 1px rgba(29,29,31,.09) !important;
        }

        .swatch,
        .swatch:focus,
        .swatch:focus-visible,
        .swatch.selected,
        .swatch.selected:focus,
        .swatch.selected:focus-visible {
          outline: none !important;
        }

        .swatch.selected {
          border: 0 !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.78)) !important;
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--swatch) 36%, rgba(29,29,31,.12)),
            0 0 0 5px color-mix(in srgb, var(--swatch) 18%, transparent) !important;
          transform: translateY(-1px) !important;
        }

        .swatch.selected::after {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--swatch) 10%, transparent), transparent 64%) !important;
        }

        .swatch.selected .swatch-chip {
          filter: saturate(1.08) brightness(.99) !important;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.42),
            0 10px 24px color-mix(in srgb, var(--swatch) 22%, transparent) !important;
        }

        .rv-wrap.is-scrolling .swatch.selected,
        .rv-wrap.is-scrolling .swatch.lite.selected {
          background: rgba(255,255,255,.9) !important;
          border-color: transparent !important;
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--swatch) 28%, rgba(29,29,31,.1)),
            0 0 0 4px color-mix(in srgb, var(--swatch) 12%, transparent) !important;
        }

        @media (max-width: 1320px) and (min-width: 1081px) {
          .grid-shell.has-preview {
            grid-template-columns: minmax(0, 1fr) minmax(500px, 560px) !important;
            gap: 24px !important;
          }

          .grid-shell.has-preview .preview-card {
            min-height: 520px !important;
          }
        }

        @media (max-width: 1080px) {
          .grid-wrap[data-reveal] {
            opacity: 1 !important;
            transform: none !important;
          }

          .swatch.selected {
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--swatch) 34%, rgba(29,29,31,.12)),
              0 0 0 4px color-mix(in srgb, var(--swatch) 14%, transparent) !important;
          }
        }

        /* Bounded lock: fixed only while the catalog section owns the viewport */
        @media (min-width: 1081px) {
          .grid-shell.has-preview {
            max-width: min(1600px, calc(100vw - 48px)) !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) clamp(520px, 38vw, 680px) !important;
            gap: 30px !important;
            align-items: start !important;
          }

          .grid-shell.has-preview .preview-panel {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: var(--preview-height, calc(100svh - 80px)) !important;
            min-height: 420px !important;
            z-index: 8 !important;
            transform: none !important;
            pointer-events: auto !important;
            will-change: auto !important;
            overflow: visible !important;
          }

          .grid-shell.has-preview .preview-card {
            position: relative !important;
            width: 100% !important;
            height: var(--preview-height, 100%) !important;
            min-height: 0 !important;
            max-height: none !important;
            border-radius: 32px !important;
            border: 1px solid rgba(232,232,237,.96) !important;
            background:
              radial-gradient(circle at 18% -4%, color-mix(in srgb, var(--preview-shade, #f5f5f7) 24%, transparent), transparent 36%),
              radial-gradient(circle at 88% 4%, rgba(255,255,255,.94), transparent 32%),
              linear-gradient(180deg, rgba(255,255,255,.96), rgba(245,245,247,.9)) !important;
            box-shadow: none !important;
            overflow: hidden !important;
            animation: previewFloatIn .344s ease both !important;
          }

          .grid-shell.has-preview .preview-card.preview-dock-top {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: var(--preview-height, 100%) !important;
          }

          .grid-shell.has-preview .preview-card.preview-dock-fixed {
            position: fixed !important;
            top: var(--preview-top, 56px) !important;
            left: var(--preview-left, auto) !important;
            width: var(--preview-width, 100%) !important;
            height: var(--preview-height, calc(100svh - 80px)) !important;
            z-index: 80 !important;
          }

          .grid-shell.has-preview .preview-card.preview-dock-bottom {
            position: absolute !important;
            top: var(--preview-bottom-top, 0) !important;
            left: 0 !important;
            width: 100% !important;
            height: var(--preview-height, 100%) !important;
          }

          .grid-shell.has-preview .preview-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(120deg, rgba(255,255,255,.58), transparent 26%, transparent 72%, rgba(255,255,255,.36)),
              radial-gradient(circle at 50% 0%, rgba(255,255,255,.76), transparent 32%);
            opacity: .72;
          }

          .grid-shell.has-preview .preview-head,
          .grid-shell.has-preview .preview-room,
          .grid-shell.has-preview .preview-info,
          .grid-shell.has-preview .preview-footer {
            position: relative;
            z-index: 1;
          }

          .grid-shell.has-preview .preview-room {
            flex: 1 1 auto !important;
            margin: 12px 16px 0 !important;
            min-height: 0 !important;
            border-radius: 30px !important;
            overflow: hidden !important;
          }

          .grid-shell.has-preview .room-img {
            height: 100% !important;
            width: 100% !important;
            object-fit: cover !important;
          }

          .grid-shell.has-preview .preview-footer {
            flex: 0 0 auto !important;
            overflow: hidden !important;
          }

          .grid-shell.has-preview .room-rail {
            overflow: hidden !important;
            flex-wrap: nowrap !important;
          }
        }

        @keyframes previewFloatIn {
          from {
            opacity: .86;
            transform: translate3d(10px, 0, 0) scale(.992);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        /* Smaller screens: foreground preview sheet under the navbar */
        @media (max-width: 1080px) {
          .preview-panel.mobile-abs {
            position: fixed !important;
            top: var(--nav-height, 44px) !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 1190 !important;
            margin: 0 !important;
            padding: 12px 12px calc(12px + env(safe-area-inset-bottom)) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background:
              radial-gradient(circle at 22% 0%, color-mix(in srgb, var(--preview-shade, #f5f5f7) 16%, transparent), transparent 34%),
              rgba(245,245,247,.74) !important;
            backdrop-filter: blur(22px) saturate(160%) !important;
            -webkit-backdrop-filter: blur(22px) saturate(160%) !important;
          }

          .preview-panel.mobile-abs .preview-card {
            position: relative !important;
            width: min(760px, calc(100vw - 24px)) !important;
            height: min(760px, calc(100svh - var(--nav-height, 44px) - 24px - env(safe-area-inset-bottom))) !important;
            min-height: 0 !important;
            max-height: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            border-radius: 28px !important;
            border: 1px solid rgba(232,232,237,.96) !important;
            background:
              radial-gradient(circle at 18% -4%, color-mix(in srgb, var(--preview-shade, #f5f5f7) 24%, transparent), transparent 36%),
              linear-gradient(180deg, rgba(255,255,255,.97), rgba(245,245,247,.92)) !important;
            box-shadow: none !important;
            animation: previewFloatIn .344s ease both !important;
          }

          .preview-panel.mobile-abs .preview-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(120deg, rgba(255,255,255,.58), transparent 28%, transparent 72%, rgba(255,255,255,.32)),
              radial-gradient(circle at 50% 0%, rgba(255,255,255,.74), transparent 32%);
            opacity: .72;
          }

          .preview-panel.mobile-abs .preview-head,
          .preview-panel.mobile-abs .preview-room,
          .preview-panel.mobile-abs .preview-info,
          .preview-panel.mobile-abs .preview-footer {
            position: relative;
            z-index: 1;
          }

          .preview-panel.mobile-abs .preview-head {
            padding: 14px 14px 8px !important;
            border-bottom: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .preview-panel.mobile-abs .preview-close {
            width: 34px !important;
            height: 34px !important;
            border: 0 !important;
            background: rgba(232,232,237,.82) !important;
            color: var(--color-ash, #333) !important;
            box-shadow: none !important;
          }

          .preview-panel.mobile-abs .preview-room {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            margin: 10px 12px 0 !important;
            border-radius: 24px !important;
            overflow: hidden !important;
            border: 1px solid rgba(232,232,237,.94) !important;
            background: var(--color-fog, #f5f5f7) !important;
            box-shadow: none !important;
          }

          .preview-panel.mobile-abs .room-img {
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            object-fit: cover !important;
          }

          .preview-panel.mobile-abs .preview-info {
            padding: 12px 14px 0 !important;
          }

          .preview-panel.mobile-abs .preview-footer {
            flex: 0 0 auto !important;
            padding: 10px 12px 12px !important;
            gap: 9px !important;
            overflow: hidden !important;
          }

          .preview-panel.mobile-abs .room-rail {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow: hidden !important;
            gap: 8px !important;
          }

          .preview-panel.mobile-abs .room-pill {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            justify-content: center !important;
            padding: 7px 8px !important;
            border-radius: 16px !important;
            border: 0 !important;
            background: rgba(245,245,247,.82) !important;
            box-shadow: none !important;
          }

          .preview-panel.mobile-abs .room-thumb {
            display: none !important;
          }

          .preview-panel.mobile-abs .shade-ref {
            border: 0 !important;
            border-radius: 18px !important;
            background: rgba(245,245,247,.82) !important;
            box-shadow: none !important;
          }
        }

        /* Premium upper color studio redesign */
        .colors-root {
          background:
            radial-gradient(circle at 18% 3%, rgba(255,255,255,.92), transparent 22%),
            radial-gradient(circle at 24% 16%, rgba(0,113,227,.055), transparent 28%),
            radial-gradient(circle at 78% 7%, rgba(245,0,180,.05), transparent 30%),
            radial-gradient(circle at 48% 28%, rgba(223,231,79,.07), transparent 34%),
            var(--color-fog, #f5f5f7) !important;
        }

        .colors-hero {
          min-height: auto !important;
          padding: clamp(52px, 7.2vw, 90px) 24px clamp(22px, 4.6vw, 54px) !important;
          display: block !important;
          overflow: hidden !important;
        }

        .hero-ambient {
          inset: -18% -10% auto !important;
          height: 58% !important;
          opacity: .7 !important;
          filter: blur(28px) saturate(120%) !important;
          background:
            radial-gradient(circle at 30% 30%, rgba(0,113,227,.12), transparent 34%),
            radial-gradient(circle at 68% 24%, rgba(245,0,180,.1), transparent 36%),
            radial-gradient(circle at 50% 88%, rgba(223,231,79,.14), transparent 42%) !important;
        }

        .hero-shell {
          max-width: min(1180px, calc(100vw - 48px)) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1.04fr) minmax(320px, .82fr) !important;
          gap: clamp(34px, 7vw, 86px) !important;
          align-items: center !important;
        }

        .hero-left {
          max-width: 680px !important;
        }

        .hero-eyebrow {
          display: inline-flex !important;
          margin: 0 0 13px !important;
          padding: 0 !important;
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif) !important;
          font-size: 13px !important;
          line-height: 1.33 !important;
          font-weight: 600 !important;
          letter-spacing: -0.08px !important;
          text-transform: none !important;
          color: var(--color-graphite, #707070) !important;
        }

        .hero-title {
          max-width: 760px !important;
          margin: 0 !important;
          font-size: clamp(52px, 7.8vw, 92px) !important;
          line-height: 1.02 !important;
          font-weight: 700 !important;
          letter-spacing: -0.024em !important;
          color: var(--color-ink, #1d1d1f) !important;
        }

        .hero-accent {
          display: block !important;
          color: transparent !important;
          background:
            linear-gradient(105deg, #1d1d1f 0%, #474747 23%, #0071e3 52%, #cc29bc 78%, #5e9c2a 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
        }

        .hero-sub {
          max-width: 570px !important;
          margin: 20px 0 0 !important;
          font-size: clamp(18px, 2vw, 22px) !important;
          line-height: 1.42 !important;
          font-weight: 300 !important;
          letter-spacing: -0.2px !important;
          color: var(--color-slate, #474747) !important;
        }

        .hero-actions {
          margin-top: 26px !important;
          display: flex !important;
          align-items: center !important;
          gap: 18px !important;
        }

        .hero-actions .pill.solid {
          min-height: 38px !important;
          padding: 8px 17px !important;
          border-radius: 999px !important;
          background: var(--color-azure, #0071e3) !important;
          color: #fff !important;
          box-shadow: none !important;
          border: 0 !important;
          font-size: 14px !important;
          font-weight: 400 !important;
          letter-spacing: -0.1px !important;
        }

        .studio-text-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          color: var(--color-cobalt-link, #0066cc);
          text-decoration: none;
          font-size: 15px;
          line-height: 1.4;
          letter-spacing: -0.1px;
          font-weight: 400;
        }

        .studio-text-link::after {
          content: "↗";
          margin-left: 5px;
          font-size: 12px;
          transform: translateY(-1px);
        }

        .color-hero-stats {
          width: fit-content !important;
          max-width: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(3, minmax(104px, 1fr)) !important;
          gap: 0 !important;
          margin-top: 34px !important;
          overflow: hidden !important;
          border-radius: 24px !important;
          border: 1px solid rgba(232,232,237,.92) !important;
          background: rgba(232,232,237,.92) !important;
          box-shadow: none !important;
        }

        .color-hero-stats div {
          min-width: 0 !important;
          padding: 13px 16px !important;
          background: rgba(255,255,255,.74) !important;
          backdrop-filter: blur(18px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
        }

        .color-hero-stats strong {
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif) !important;
          font-size: 26px !important;
          line-height: 1.04 !important;
          font-weight: 700 !important;
          letter-spacing: -0.005em !important;
          color: var(--color-ink, #1d1d1f) !important;
        }

        .color-hero-stats span {
          margin-top: 4px !important;
          color: var(--color-graphite, #707070) !important;
          font-size: 12px !important;
          line-height: 1.33 !important;
          letter-spacing: -0.26px !important;
        }

        .color-spectrum-card {
          min-height: clamp(420px, 42vw, 560px) !important;
          padding: 18px !important;
          display: grid !important;
          align-content: end !important;
          border-radius: 32px !important;
          border: 1px solid rgba(232,232,237,.92) !important;
          background:
            radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--active-hero-shade) 32%, transparent), transparent 34%),
            radial-gradient(circle at 18% 16%, rgba(0,113,227,.08), transparent 34%),
            radial-gradient(circle at 88% 8%, rgba(245,0,180,.08), transparent 34%),
            rgba(255,255,255,.76) !important;
          box-shadow: none !important;
          backdrop-filter: blur(22px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
        }

        .color-spectrum-card::before {
          inset: 10% !important;
          border-radius: 30px !important;
          opacity: .5 !important;
          background:
            linear-gradient(rgba(29,29,31,.026) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,29,31,.026) 1px, transparent 1px) !important;
          background-size: 42px 42px !important;
        }

        .color-glass-room {
          inset: 8% 8% 31% !important;
          border-radius: 30px !important;
          border: 1px solid rgba(255,255,255,.72) !important;
          box-shadow: none !important;
        }

        .color-orbit {
          opacity: .44 !important;
        }

        .color-hero-carousel {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          padding: 8px !important;
          margin: 0 auto 12px !important;
          width: fit-content !important;
          max-width: 100% !important;
          border-radius: 999px !important;
          background: rgba(255,255,255,.62) !important;
          border: 1px solid rgba(232,232,237,.86) !important;
          backdrop-filter: blur(18px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
        }

        .color-slide {
          display: inline-grid !important;
          place-items: center !important;
          width: 34px !important;
          height: 34px !important;
          min-height: 0 !important;
          padding: 0 !important;
          border-radius: 999px !important;
          background: transparent !important;
          border: 0 !important;
          transform: none !important;
          box-shadow: none !important;
        }

        .color-slide:hover,
        .color-slide.active {
          transform: none !important;
          background: rgba(255,255,255,.86) !important;
        }

        .color-slide-swatch {
          width: 26px !important;
          height: 26px !important;
          border-radius: 999px !important;
          background: var(--slide-color) !important;
          border: 1px solid rgba(29,29,31,.09) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.32) !important;
        }

        .color-slide.active .color-slide-swatch {
          box-shadow:
            0 0 0 3px #fff,
            0 0 0 4px rgba(29,29,31,.16),
            inset 0 1px 0 rgba(255,255,255,.32) !important;
        }

        .color-slide-copy {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          overflow: hidden !important;
          clip: rect(0 0 0 0) !important;
          white-space: nowrap !important;
        }

        .color-hero-note {
          width: min(100%, 420px) !important;
          margin: 0 auto !important;
          padding: 13px 16px !important;
          border-radius: 24px !important;
          border: 1px solid rgba(232,232,237,.86) !important;
          background: rgba(255,255,255,.72) !important;
          box-shadow: none !important;
          backdrop-filter: blur(18px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
          text-align: center !important;
        }

        .color-hero-note span,
        .color-hero-note small {
          color: var(--color-graphite, #707070) !important;
          font-size: 12px !important;
          line-height: 1.33 !important;
          letter-spacing: -0.26px !important;
        }

        .color-hero-note strong {
          margin: 3px 0 !important;
          font-size: 22px !important;
          line-height: 1.14 !important;
          letter-spacing: -0.36px !important;
        }

        .toolbar {
          padding: 8px 24px 20px !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .toolbar-shell {
          width: min(980px, calc(100vw - 48px)) !important;
          max-width: none !important;
          margin: 0 auto !important;
          display: grid !important;
          grid-template-columns: minmax(0, auto) minmax(320px, 520px) !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 14px !important;
          padding: 8px !important;
          border-radius: 999px !important;
          border: 1px solid rgba(232,232,237,.92) !important;
          background: rgba(255,255,255,.62) !important;
          backdrop-filter: blur(20px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
        }

        .cat-rail {
          display: flex !important;
          gap: 2px !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .cat-pill {
          min-height: 38px !important;
          padding: 0 13px !important;
          border-radius: 999px !important;
          background: transparent !important;
          color: var(--color-graphite, #707070) !important;
          font-size: 13px !important;
          font-weight: 400 !important;
          letter-spacing: -0.08px !important;
          gap: 7px !important;
        }

        .cat-pill:hover {
          background: rgba(245,245,247,.7) !important;
        }

        .cat-pill.active {
          background: #fff !important;
          color: var(--color-ink, #1d1d1f) !important;
          box-shadow: inset 0 0 0 1px rgba(232,232,237,.92) !important;
        }

        .cat-count {
          padding: 0 !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 11px !important;
          letter-spacing: -0.26px !important;
          opacity: .72 !important;
        }

        .filters {
          width: 100% !important;
          min-width: 0 !important;
        }

        .search {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 42px !important;
          padding: 0 14px !important;
          border-radius: 999px !important;
          background: var(--color-fog, #f5f5f7) !important;
          border: 0 !important;
          box-shadow: none !important;
          gap: 9px !important;
        }

        .sicon svg {
          width: 17px !important;
          height: 17px !important;
          stroke-width: 1.9 !important;
        }

        .search input {
          font-size: 14px !important;
          letter-spacing: -0.08px !important;
        }

        .clear {
          width: 26px !important;
          height: 26px !important;
          background: rgba(210,210,215,.7) !important;
        }

        @media (max-width: 1080px) {
          .colors-hero {
            padding: 42px 18px 20px !important;
          }

          .hero-shell {
            max-width: min(760px, calc(100vw - 32px)) !important;
            grid-template-columns: 1fr !important;
            gap: 26px !important;
            text-align: center !important;
          }

          .hero-left {
            max-width: none !important;
            display: grid !important;
            justify-items: center !important;
          }

          .hero-title {
            max-width: 680px !important;
            font-size: clamp(48px, 11vw, 76px) !important;
          }

          .hero-sub {
            max-width: 620px !important;
          }

          .hero-actions {
            justify-content: center !important;
          }

          .color-hero-stats {
            width: min(100%, 440px) !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .color-spectrum-card {
            min-height: 420px !important;
            width: min(100%, 560px) !important;
            margin: 0 auto !important;
          }

          .toolbar {
            padding: 6px 16px 18px !important;
          }

          .toolbar-shell {
            width: min(680px, calc(100vw - 32px)) !important;
            grid-template-columns: 1fr !important;
            border-radius: 28px !important;
            padding: 10px !important;
            gap: 10px !important;
          }

          .cat-rail {
            justify-content: center !important;
            flex-wrap: wrap !important;
          }
        }

        @media (max-width: 640px) {
          .colors-hero {
            padding: 34px 14px 18px !important;
          }

          .hero-title {
            font-size: clamp(42px, 13vw, 58px) !important;
          }

          .hero-sub {
            margin-top: 16px !important;
            font-size: 17px !important;
            line-height: 1.45 !important;
          }

          .hero-actions {
            width: 100% !important;
            gap: 12px !important;
          }

          .hero-actions .pill.solid,
          .studio-text-link {
            width: auto !important;
          }

          .color-hero-stats {
            grid-template-columns: 1fr !important;
            width: min(100%, 280px) !important;
            border-radius: 24px !important;
          }

          .color-hero-stats div {
            padding: 11px 14px !important;
          }

          .color-spectrum-card {
            min-height: 360px !important;
            border-radius: 28px !important;
          }

          .color-glass-room {
            inset: 8% 8% 36% !important;
          }

          .color-hero-carousel {
            gap: 7px !important;
            padding: 7px !important;
          }

          .color-slide {
            width: 30px !important;
            height: 30px !important;
          }

          .color-slide-swatch {
            width: 23px !important;
            height: 23px !important;
          }

          .toolbar-shell {
            width: calc(100vw - 24px) !important;
            border-radius: 24px !important;
          }

          .cat-pill {
            min-height: 34px !important;
            padding: 0 10px !important;
          }

          .search {
            min-height: 40px !important;
          }
        }

        /* Premium room preview final layer */
        .preview-panel .preview-card,
        .preview-panel.mobile-abs .preview-card,
        .grid-shell.has-preview .preview-card {
          color: var(--color-ink, #1d1d1f) !important;
          background:
            radial-gradient(circle at 18% -8%, color-mix(in srgb, var(--preview-shade, #f5f5f7) 26%, transparent), transparent 34%),
            radial-gradient(circle at 92% 0%, rgba(255,255,255,.96), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,.97), rgba(245,245,247,.92)) !important;
          border: 1px solid rgba(232,232,237,.96) !important;
          border-radius: 32px !important;
          box-shadow: none !important;
          backdrop-filter: blur(24px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
          isolation: isolate !important;
        }

        .preview-panel .preview-card::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 0 !important;
          pointer-events: none !important;
          background:
            linear-gradient(125deg, rgba(255,255,255,.72), transparent 28%, transparent 68%, rgba(255,255,255,.32)),
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.78), transparent 32%) !important;
          opacity: .68 !important;
        }

        .preview-panel .preview-head,
        .preview-panel .preview-room,
        .preview-panel .preview-info,
        .preview-panel .preview-footer {
          position: relative !important;
          z-index: 1 !important;
        }

        .preview-panel .preview-head {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto auto !important;
          align-items: center !important;
          gap: 11px !important;
          padding: 16px 16px 10px !important;
          border: 0 !important;
          background: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .preview-head-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .preview-panel .preview-kicker {
          color: var(--color-graphite, #707070) !important;
          font-size: 12px !important;
          line-height: 1.33 !important;
          font-weight: 500 !important;
          letter-spacing: -0.08px !important;
          text-transform: none !important;
        }

        .preview-room-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          color: var(--color-ink, #1d1d1f);
          font-size: 24px;
          line-height: 1.14;
          font-weight: 700;
          letter-spacing: -0.36px;
        }

        .preview-head-swatch {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(29,29,31,.1);
          box-shadow:
            0 0 0 4px rgba(255,255,255,.72),
            inset 0 1px 0 rgba(255,255,255,.36);
          flex: 0 0 auto;
        }

        .preview-panel .preview-close {
          width: 34px !important;
          height: 34px !important;
          border-radius: 999px !important;
          border: 0 !important;
          background: rgba(232,232,237,.78) !important;
          color: var(--color-ash, #333) !important;
          box-shadow: none !important;
          font-size: 19px !important;
          transition: background-color .1s ease, transform .1s ease !important;
        }

        .preview-panel .preview-close:hover {
          background: rgba(210,210,215,.9) !important;
          transform: scale(1.03) !important;
        }

        .preview-panel .preview-room {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          margin: 6px 16px 0 !important;
          border-radius: 30px !important;
          border: 1px solid rgba(232,232,237,.96) !important;
          background: var(--color-fog, #f5f5f7) !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }

        .preview-panel .room-img {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          object-fit: cover !important;
          transform: scale(1.002);
        }

        .preview-panel .room-tint {
          opacity: .86 !important;
        }

        .preview-panel .room-shadow {
          opacity: .58 !important;
          filter: grayscale(1) contrast(1.08) brightness(.98) !important;
        }

        .preview-panel .room-sheen {
          opacity: .82 !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,0) 42%),
            radial-gradient(circle at 22% 18%, rgba(255,255,255,.22), transparent 30%) !important;
        }

        .room-floating-chip {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 18px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(232,232,237,.88);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          color: var(--color-ink, #1d1d1f);
        }

        .room-floating-chip span {
          color: var(--color-graphite, #707070);
          font-size: 12px;
          letter-spacing: -0.26px;
          white-space: nowrap;
        }

        .room-floating-chip strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.08px;
        }

        .preview-panel .preview-info {
          padding: 13px 18px 0 !important;
        }

        .preview-panel .pname {
          color: var(--color-ink, #1d1d1f) !important;
          font-size: 25px !important;
          line-height: 1.14 !important;
          font-weight: 700 !important;
          letter-spacing: -0.42px !important;
        }

        .preview-panel .pmeta {
          margin-top: 6px !important;
          color: var(--color-graphite, #707070) !important;
          font-size: 12px !important;
          line-height: 1.33 !important;
          letter-spacing: -0.26px !important;
        }

        .preview-panel .preview-footer {
          padding: 12px 16px 16px !important;
          gap: 10px !important;
          flex: 0 0 auto !important;
          overflow: hidden !important;
        }

        .preview-panel .room-rail {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 7px !important;
          padding: 4px !important;
          border-radius: 999px !important;
          background: rgba(232,232,237,.62) !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }

        .preview-panel .room-pill {
          min-width: 0 !important;
          min-height: 34px !important;
          justify-content: center !important;
          padding: 0 10px !important;
          border-radius: 999px !important;
          border: 0 !important;
          background: transparent !important;
          color: var(--color-graphite, #707070) !important;
          box-shadow: none !important;
          transform: none !important;
        }

        .preview-panel .room-pill.on {
          background: #fff !important;
          color: var(--color-ink, #1d1d1f) !important;
          box-shadow: inset 0 0 0 1px rgba(232,232,237,.92) !important;
        }

        .preview-panel .room-thumb {
          display: none !important;
        }

        .preview-panel .room-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px !important;
          line-height: 1.33 !important;
          font-weight: 500 !important;
          letter-spacing: -0.08px !important;
        }

        .preview-panel .shade-ref {
          display: grid !important;
          grid-template-columns: 38px minmax(0, 1fr) !important;
          gap: 10px !important;
          padding: 9px 10px !important;
          border-radius: 20px !important;
          border: 1px solid rgba(232,232,237,.92) !important;
          background: rgba(245,245,247,.72) !important;
          box-shadow: none !important;
        }

        .preview-panel .shade-ref-swatch {
          width: 38px !important;
          height: 38px !important;
          border-radius: 14px !important;
          border: 1px solid rgba(29,29,31,.09) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.34) !important;
        }

        .preview-panel .shade-ref-k {
          color: var(--color-graphite, #707070) !important;
          font-size: 11px !important;
          line-height: 1.33 !important;
          font-weight: 500 !important;
          letter-spacing: -0.26px !important;
          text-transform: none !important;
        }

        .preview-panel .shade-ref-v {
          margin-top: 2px !important;
          color: var(--color-ink, #1d1d1f) !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
          font-weight: 500 !important;
          letter-spacing: -0.08px !important;
        }

        .preview-panel .preview-cta {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .preview-panel .preview-cta-btn {
          width: 100% !important;
          min-height: 36px !important;
          padding: 7px 10px !important;
          font-size: 13px !important;
        }

        @media (max-width: 1080px) {
          .preview-panel.mobile-abs {
            align-items: center !important;
            padding: 10px 10px calc(10px + env(safe-area-inset-bottom)) !important;
          }

          .preview-panel.mobile-abs .preview-card {
            width: min(760px, calc(100vw - 20px)) !important;
            height: min(760px, calc(100svh - var(--nav-height, 44px) - 20px - env(safe-area-inset-bottom))) !important;
            border-radius: 30px !important;
          }
        }

        @media (max-width: 640px) {
          .preview-panel.mobile-abs {
            align-items: stretch !important;
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom)) !important;
          }

          .preview-panel.mobile-abs .preview-card {
            width: 100% !important;
            height: calc(100svh - var(--nav-height, 44px) - 16px - env(safe-area-inset-bottom)) !important;
            border-radius: 26px !important;
          }

          .preview-panel .preview-head {
            padding: 13px 13px 8px !important;
          }

          .preview-room-name {
            font-size: 21px !important;
          }

          .preview-head-swatch,
          .preview-panel .preview-close {
            width: 32px !important;
            height: 32px !important;
          }

          .preview-panel .preview-room {
            margin: 6px 12px 0 !important;
            border-radius: 24px !important;
          }

          .room-floating-chip {
            left: 10px;
            right: 10px;
            bottom: 10px;
            border-radius: 16px;
          }

          .preview-panel .preview-info {
            padding: 11px 14px 0 !important;
          }

          .preview-panel .pname {
            font-size: 22px !important;
          }

          .preview-panel .preview-footer {
            padding: 10px 12px 12px !important;
            gap: 8px !important;
          }

          .preview-panel .shade-ref {
            display: none !important;
          }

          .preview-panel .preview-cta {
            grid-template-columns: 1fr !important;
          }
        }

        /* Apple-grade color search field */
        .toolbar-shell {
          grid-template-columns: minmax(0, auto) minmax(360px, 560px) !important;
          gap: 10px !important;
          padding: 7px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.62)) !important;
          border: 1px solid rgba(232,232,237,.96) !important;
          box-shadow: none !important;
        }

        .filters {
          display: flex !important;
          align-items: center !important;
          justify-content: stretch !important;
        }

        .search {
          position: relative !important;
          min-height: 44px !important;
          padding: 0 12px 0 15px !important;
          gap: 10px !important;
          border-radius: 999px !important;
          background:
            linear-gradient(180deg, rgba(245,245,247,.96), rgba(232,232,237,.72)) !important;
          border: 1px solid rgba(210,210,215,.72) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.88),
            inset 0 -1px 0 rgba(29,29,31,.035) !important;
          backdrop-filter: blur(18px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
          transition:
            background-color .16s ease,
            border-color .16s ease,
            box-shadow .16s ease,
            transform .16s ease !important;
        }

        .search:focus-within {
          background: rgba(255,255,255,.92) !important;
          border-color: rgba(210,210,215,.72) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.9),
            0 0 0 4px rgba(0,113,227,.08) !important;
        }

        .sicon {
          width: 22px !important;
          height: 22px !important;
          display: grid !important;
          place-items: center !important;
          color: rgba(29,29,31,.42) !important;
          flex: 0 0 auto !important;
        }

        .sicon svg {
          width: 18px !important;
          height: 18px !important;
          stroke: currentColor !important;
          stroke-width: 1.8 !important;
          fill: none !important;
        }

        .search input {
          height: 42px !important;
          border: 0 !important;
          outline: none !important;
          background: transparent !important;
          color: var(--color-ink, #1d1d1f) !important;
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif) !important;
          font-size: 14px !important;
          line-height: 1.43 !important;
          font-weight: 400 !important;
          letter-spacing: -0.08px !important;
          caret-color: var(--color-ink, #1d1d1f) !important;
        }

        .search input::placeholder {
          color: rgba(112,112,112,.74) !important;
        }

        .clear {
          width: 28px !important;
          height: 28px !important;
          display: grid !important;
          place-items: center !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: rgba(210,210,215,.64) !important;
          color: rgba(29,29,31,.58) !important;
          font-size: 19px !important;
          line-height: 1 !important;
          transition: background-color .1s ease, transform .1s ease !important;
        }

        .clear:hover {
          background: rgba(198,198,203,.86) !important;
          transform: scale(1.04) !important;
        }

        @media (max-width: 1080px) {
          .toolbar-shell {
            grid-template-columns: 1fr !important;
            gap: 9px !important;
            border-radius: 28px !important;
            padding: 9px !important;
          }

          .search {
            min-height: 46px !important;
          }
        }

        @media (max-width: 640px) {
          .toolbar {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .toolbar-shell {
            width: 100% !important;
            border-radius: 24px !important;
          }

          .search {
            min-height: 46px !important;
            padding-left: 14px !important;
          }

          .search input {
            font-size: 13px !important;
          }
        }

        /* Mobile room preview: show the complete room image, never cropped */
        @media (max-width: 1080px) {
          .preview-panel.mobile-abs {
            overflow: hidden !important;
          }

          .preview-panel.mobile-abs .preview-card {
            height: auto !important;
            max-height: calc(100svh - var(--nav-height, 44px) - 20px - env(safe-area-inset-bottom)) !important;
          }

          .preview-panel.mobile-abs .preview-head,
          .preview-panel.mobile-abs .preview-info,
          .preview-panel.mobile-abs .preview-footer {
            flex: 0 0 auto !important;
          }

          .preview-panel.mobile-abs .preview-room {
            flex: 0 1 auto !important;
            width: auto !important;
            aspect-ratio: 16 / 10 !important;
            min-height: clamp(220px, 36svh, 360px) !important;
            max-height: min(54svh, 520px) !important;
            display: grid !important;
            place-items: center !important;
            background:
              linear-gradient(180deg, rgba(255,255,255,.66), rgba(245,245,247,.96)),
              var(--color-fog, #f5f5f7) !important;
          }

          .preview-panel.mobile-abs .room-img {
            object-fit: contain !important;
            object-position: center !important;
            background: var(--color-fog, #f5f5f7) !important;
          }

          .preview-panel.mobile-abs .room-tint {
            -webkit-mask-size: contain !important;
            mask-size: contain !important;
            -webkit-mask-position: center !important;
            mask-position: center !important;
            -webkit-mask-repeat: no-repeat !important;
            mask-repeat: no-repeat !important;
          }

          .preview-panel.mobile-abs .room-shadow {
            background-size: contain !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            -webkit-mask-size: contain !important;
            mask-size: contain !important;
            -webkit-mask-position: center !important;
            mask-position: center !important;
            -webkit-mask-repeat: no-repeat !important;
            mask-repeat: no-repeat !important;
          }
        }

        @media (max-width: 640px) {
          .preview-panel.mobile-abs .preview-card {
            max-height: calc(100svh - var(--nav-height, 44px) - 16px - env(safe-area-inset-bottom)) !important;
          }

          .preview-panel.mobile-abs .preview-room {
            aspect-ratio: 4 / 3 !important;
            min-height: clamp(210px, 34svh, 330px) !important;
            max-height: 46svh !important;
          }

          .preview-panel.mobile-abs .room-floating-chip {
            display: none !important;
          }
        }

      `}</style>
    </>
  );
}

const SwatchCard = React.memo(
  function SwatchCard({ shade, onOpen, isActive }) {
    return (
      <button
        type="button"
        className={`swatch ${isActive ? "selected" : ""}`}
        aria-pressed={!!isActive}
        onClick={() => onOpen?.(shade)}
        title={`${shade.name} • ${shade.id} • ${shade.rgb}`}
        aria-label={`Preview shade ${shade.name} ${shade.id}`}
        style={{
          "--swatch": shade.rgb,
          "--swatchText": shade._text,
        }}
      >
        <div className="swatch-chip" aria-hidden="true" />
        <div className="swatch-meta">
          <div className="swatch-name">{shade.name}</div>
          <div className="swatch-code">{shade.id}</div>
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.shade === next.shade &&
    prev.onOpen === next.onOpen &&
    prev.isActive === next.isActive,
);

function SwatchLite({ shade, isActive }) {
  // ultra-light renderer used only during scroll
  return (
    <div
      className={`swatch lite ${isActive ? "selected" : ""}`}
      aria-hidden="true"
      style={{ "--swatch": shade.rgb, "--swatchText": shade._text }}
    >
      <div className="swatch-chip" aria-hidden="true" />
      <div className="swatch-meta">
        <div className="swatch-name">{shade.name}</div>
        <div className="swatch-code">{shade.id}</div>
      </div>
    </div>
  );
}
