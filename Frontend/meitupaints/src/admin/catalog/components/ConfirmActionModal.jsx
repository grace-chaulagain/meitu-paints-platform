import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Spinner } from "../../../components/dashboard/DashboardUI.jsx";

const MODAL_EASE_OUT = [0.23, 1, 0.32, 1];

export default function ConfirmActionModal({
  open,
  title = "Confirm Action",
  description = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  loading = false,
  onClose,
  onConfirm,
}) {
  const shouldReduceMotion = useReducedMotion();
  const scale = shouldReduceMotion ? 1 : 0.95;
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const slow = shouldReduceMotion ? 0.001 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fast, ease: "easeOut" }}
          style={overlayStyle}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale }}
            transition={{ duration: slow, ease: MODAL_EASE_OUT }}
            style={{ ...modalStyle, transformOrigin: "center" }}
          >
            <div style={eyebrowStyle}>
              {danger ? "Danger Zone" : "Confirmation"}
            </div>

            <div style={titleStyle}>{title}</div>

            <div style={descStyle}>{description}</div>

            <div style={footerStyle}>
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                style={{
                  ...primaryBtnStyle,
                  ...(danger ? dangerBtnStyle : {}),
                  opacity: loading ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? <Spinner size={13} /> : null}
                {loading ? "Processing..." : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.28)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  display: "grid",
  placeItems: "center",
  zIndex: 3000,
  padding: 24,
};

const modalStyle = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 28,
  background: "rgba(255,255,255,.92)",
  border: "1px solid rgba(255,255,255,.72)",
  boxShadow: "0 30px 80px rgba(15,23,42,.18)",
  padding: 24,
};

const eyebrowStyle = {
  display: "inline-flex",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "rgba(0,0,0,.52)",
  background: "rgba(248,248,250,.95)",
  border: "1px solid rgba(0,0,0,.06)",
};

const titleStyle = {
  marginTop: 14,
  fontSize: 28,
  fontWeight: 950,
  letterSpacing: "-0.04em",
  color: "#0f172a",
};

const descStyle = {
  marginTop: 10,
  color: "rgba(0,0,0,.58)",
  fontWeight: 700,
  lineHeight: 1.65,
  fontSize: 14,
};

const footerStyle = {
  marginTop: 22,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
};

const secondaryBtnStyle = {
  height: 48,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,.08)",
  background: "rgba(255,255,255,.94)",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtnStyle = {
  height: 48,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(196,0,0,.16)",
  background: "linear-gradient(135deg, #111827, #374151)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerBtnStyle = {
  background: "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
  boxShadow: "0 16px 32px rgba(196,0,0,.20)",
};
