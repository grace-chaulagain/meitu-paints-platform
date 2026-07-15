import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DashboardIcon } from "../components/dashboard/DashboardIcons.jsx";
import { Surface } from "../components/dashboard/DashboardUI.jsx";

const MODAL_EASE_OUT = [0.23, 1, 0.32, 1];

export function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="factory-ui-close-btn"
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-graphite, #707070)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        transition: "transform .14s var(--ease-out, ease), background .14s ease",
      }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

export function ModalOverlay({ open, onClose, children, maxWidth = 720 }) {
  const shouldReduceMotion = useReducedMotion();
  const scale = shouldReduceMotion ? 1 : 0.95;
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const slow = shouldReduceMotion ? 0.001 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fast, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            background: "rgba(0,0,0,.4)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            padding: 28,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale }}
            transition={{ duration: slow, ease: MODAL_EASE_OUT }}
            style={{ transformOrigin: "center", width: `min(${maxWidth}px, 100%)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <Surface style={{ width: "100%", maxHeight: "92vh", overflow: "auto" }} padding={22}>
              {children}
            </Surface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DetailGrid({ rows }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, columnGap: 16 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{label}</span>
          <strong style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

// Shared between the stock-history table and the stock-edit modal's audit
// list so a stock movement reads identically wherever it appears. Pairs
// color with a directional arrow and explicit sign so additions/deductions
// don't rely on color alone to be told apart.
export function MovementBadge({ delta }) {
  const value = Number(delta || 0);
  const isAddition = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: isAddition ? "rgba(22,163,74,.1)" : "rgba(180,35,24,.1)",
        color: isAddition ? "#15803d" : "#b42318",
        fontSize: 12.5,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">{isAddition ? "↑" : "↓"}</span>
      {isAddition ? `+${value}` : value}
    </span>
  );
}

export function Banner({ tone = "info", children }) {
  const palette = {
    info: { bg: "rgba(0,113,227,.08)", color: "var(--color-azure, #0071e3)", icon: "download" },
    success: { bg: "rgba(22,163,74,.08)", color: "#15803d", icon: "checkmark" },
    error: { bg: "rgba(180,35,24,.08)", color: "#b42318", icon: "warning" },
  };
  const p = palette[tone] || palette.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        background: p.bg,
        color: p.color,
      }}
    >
      <DashboardIcon name={p.icon} size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}
