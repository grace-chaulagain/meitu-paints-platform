import { useEffect } from "react";
import { createPortal } from "react-dom";
// `motion` is used via JSX (<motion.div>) - this repo's eslint config has no
// react/jsx-uses-vars, so no-unused-vars can't see that usage.
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TOAST_EASE_OUT = [0.23, 1, 0.32, 1];
const AUTO_DISMISS_MS = 3500;

function CheckIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// Same visual language and timing as components/dashboard/Toast.jsx, but
// self-contained (own inline icons, no DashboardIcon import) so public
// marketing pages outside the dashboard shell don't have to reach into a
// dashboard-scoped folder for something this generic.
export default function Toast({ open, message, onDismiss }) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [open, onDismiss]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        zIndex: 9999,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18, scale: shouldReduceMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 10,
              scale: shouldReduceMotion ? 1 : 0.97,
              transition: { duration: shouldReduceMotion ? 0.001 : 0.16, ease: TOAST_EASE_OUT },
            }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.34, ease: TOAST_EASE_OUT }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "min(400px, calc(100vw - 40px))",
              padding: "14px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(29,29,31,.06)",
              boxShadow: "0 16px 40px rgba(15,23,42,.16), 0 2px 8px rgba(15,23,42,.06)",
              fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif",
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
                background: "rgba(22,163,74,.1)",
                color: "#15803d",
              }}
            >
              <CheckIcon />
            </span>
            <div style={{ minWidth: 0, flex: "1 1 auto", fontSize: 13.5, fontWeight: 700, color: "#1d1d1f" }}>
              {message}
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
                color: "#707070",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <CloseIcon />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
