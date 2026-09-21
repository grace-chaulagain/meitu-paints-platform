// Small "i" affordance that opens a short plain-language explainer next to
// a label - a field, a picker, a metric. Positioned via getBoundingClientRect
// and rendered through a portal so it's never clipped by a card/modal's
// overflow, and flips to whichever side of the trigger has viewport room.
// Extracted from DashboardUI.jsx's MetricTile-only MetricInfoButton so any
// form field can use the same pattern instead of only metric tiles.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function InfoTip({ label, info }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 16;
    const width = Math.min(340, window.innerWidth - viewportPadding * 2);
    const rightSideLeft = rect.right + 12;
    const placeRight = rightSideLeft + width <= window.innerWidth - viewportPadding;
    const left = placeRight ? rightSideLeft : Math.max(viewportPadding, rect.left - width - 12);
    const estimatedHeight = Math.min(420, window.innerHeight - viewportPadding * 2);
    const top = Math.max(
      viewportPadding,
      Math.min(rect.top - 8, window.innerHeight - viewportPadding - estimatedHeight),
    );
    const maxHeight = Math.max(180, Math.min(420, window.innerHeight - top - viewportPadding));

    // The popover renders to whichever side of the trigger has room, so its
    // scale-in should originate from that same side (Emil Kowalski: popovers
    // should scale from their trigger, not from a fixed corner).
    setPosition({ left, top, width, maxHeight, origin: placeRight ? "top left" : "top right" });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (popoverRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => {
            const next = !current;
            if (next) requestAnimationFrame(updatePosition);
            return next;
          });
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "none",
          background: "rgba(0,0,0,.06)",
          color: "var(--color-graphite, #707070)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10.5,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        i
      </button>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open && position ? (
                <motion.div
                  ref={popoverRef}
                  role="dialog"
                  aria-label={`${label} details`}
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
                  transition={{ duration: shouldReduceMotion ? 0.001 : 0.15, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: "fixed",
                    top: position.top,
                    left: position.left,
                    zIndex: 9999,
                    width: position.width,
                    maxHeight: position.maxHeight,
                    overflow: "auto",
                    overscrollBehavior: "contain",
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(29,29,31,.08)",
                    background: "var(--color-snow, #fff)",
                    boxShadow: "0 8px 28px rgba(0,0,0,.14)",
                    color: "var(--color-ink, #1d1d1f)",
                    transformOrigin: position.origin,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{info.title}</div>
                  {info.summary ? (
                    <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                      {info.summary}
                    </div>
                  ) : null}
                  {info.sections?.length ? (
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {info.sections.map((section) => (
                        <div key={section.title}>
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: ".03em",
                              textTransform: "uppercase",
                              color: "var(--color-graphite, #707070)",
                            }}
                          >
                            {section.title}
                          </div>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 15, display: "grid", gap: 4, fontSize: 12, lineHeight: 1.4, fontWeight: 500 }}>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
