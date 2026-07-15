import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DashboardIcon } from "./DashboardIcons.jsx";

const TOAST_EASE_OUT = [0.23, 1, 0.32, 1];
const AUTO_DISMISS_MS = 3500;

const TONES = {
  success: { bg: "rgba(22,163,74,.1)", color: "#15803d", icon: "checkmark" },
  error: { bg: "rgba(180,35,24,.1)", color: "#b42318", icon: "reject" },
};

// A single, local (non-global-provider) toast - only one call site needs
// this today (recording a sale), so there's no shared queue/context to
// build. Rendered through a portal so it always paints above whichever
// modal/surface is currently open, fixed to the bottom-center like
// Apple's own system notification banners.
export function Toast({ toast, onDismiss }) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (typeof document === "undefined") return null;

  const tone = TONES[toast?.tone] || TONES.success;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        zIndex: 9999,
        pointerEvents: toast ? "auto" : "none",
      }}
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18, scale: shouldReduceMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 10,
              scale: shouldReduceMotion ? 1 : 0.97,
              transition: { duration: shouldReduceMotion ? 0.001 : 0.16, ease: "easeIn" },
            }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.34, ease: TOAST_EASE_OUT }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              width: "min(400px, calc(100vw - 40px))",
              padding: "14px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(29,29,31,.06)",
              boxShadow: "0 16px 40px rgba(15,23,42,.16), 0 2px 8px rgba(15,23,42,.06)",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 30,
                height: 30,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                background: tone.bg,
                color: tone.color,
              }}
            >
              <DashboardIcon name={tone.icon} size={15} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{toast.title}</div>
              {toast.description ? (
                <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                  {toast.description}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 999,
                border: "none",
                background: "rgba(0,0,0,.05)",
                color: "var(--color-graphite, #707070)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <DashboardIcon name="close" size={11} strokeWidth={2.2} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export default Toast;
